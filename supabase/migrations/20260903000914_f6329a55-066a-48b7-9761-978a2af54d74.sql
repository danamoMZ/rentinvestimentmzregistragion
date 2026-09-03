-- ===== PLANS: estrutura, validações e cálculo automático =====
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.plans_compute_values()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price < 0 THEN RAISE EXCEPTION 'Preço do plano não pode ser negativo'; END IF;
  IF NEW.daily_task_count <= 0 THEN RAISE EXCEPTION 'Quantidade de tarefas deve ser positiva'; END IF;
  IF NEW.duration_days <= 0 THEN RAISE EXCEPTION 'Duração deve ser positiva'; END IF;
  IF NEW.daily_income < 0 THEN RAISE EXCEPTION 'Ganho diário não pode ser negativo'; END IF;
  NEW.task_value := round(NEW.daily_income / NEW.daily_task_count, 2);
  NEW.total_task_income := round(NEW.daily_income * NEW.duration_days, 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_plans_compute ON public.plans;
CREATE TRIGGER tr_plans_compute BEFORE INSERT OR UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.plans_compute_values();

-- Novos valores (RENT 1–9 atualizados, RENT 10–11 novos)
INSERT INTO public.plans (id,name,price,daily_task_count,task_value,daily_income,duration_days,total_task_income,sort_order) VALUES
 (1,'RENT 1',300,5,6,30,160,4800,1),
 (2,'RENT 2',400,5,10,50,160,8000,2),
 (3,'RENT 3',800,5,25,125,155,19375,3),
 (4,'RENT 4',2000,5,70,350,120,42000,4),
 (5,'RENT 5',8000,5,320,1600,120,192000,5),
 (6,'RENT 6',20000,5,900,4500,100,450000,6),
 (7,'RENT 7',50000,5,2400,12000,100,1200000,7),
 (8,'RENT 8',100000,5,5200,26000,70,1820000,8),
 (9,'RENT 9',150000,5,10000,50000,70,3500000,9),
 (10,'RENT 10',200000,5,16000,80000,50,4000000,10),
 (11,'RENT 11',300000,5,28000,140000,50,7000000,11)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  daily_task_count = EXCLUDED.daily_task_count,
  daily_income = EXCLUDED.daily_income,
  duration_days = EXCLUDED.duration_days,
  sort_order = EXCLUDED.sort_order,
  active = true;

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_name_unique;
ALTER TABLE public.plans ADD CONSTRAINT plans_name_unique UNIQUE (name);
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_positive_values;
ALTER TABLE public.plans ADD CONSTRAINT plans_positive_values CHECK (
  price >= 0 AND daily_task_count > 0 AND duration_days > 0 AND daily_income >= 0 AND task_value >= 0 AND total_task_income >= 0
);

DROP POLICY IF EXISTS "plans public" ON public.plans;
CREATE POLICY "plans public" ON public.plans FOR SELECT TO anon, authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'));

-- ===== RECARGA SECRETA =====
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  bonus numeric(14,2) NOT NULL DEFAULT 20 CHECK (bonus > 0),
  max_uses int NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses_count int NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read promo codes" ON public.promo_codes;
CREATE POLICY "admins read promo codes" ON public.promo_codes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bonus_value numeric(14,2) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  status text NOT NULL DEFAULT 'CREDITED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own redemptions" ON public.promo_redemptions;
CREATE POLICY "read own redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON public.promo_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions(user_id);

CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text, _ip_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code record;
  v_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND blocked) THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT * INTO v_code FROM public.promo_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF NOT v_code.active THEN RAISE EXCEPTION 'Este código foi desativado'; END IF;
  IF v_code.expires_at <= now() THEN RAISE EXCEPTION 'Este código expirou'; END IF;
  IF v_code.uses_count >= v_code.max_uses THEN RAISE EXCEPTION 'Este código atingiu o limite de utilizações'; END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE code_id = v_code.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Já utilizou este código';
  END IF;

  INSERT INTO public.promo_redemptions(code_id, user_id, bonus_value, ip_hash, status)
  VALUES (v_code.id, v_user, v_code.bonus, _ip_hash, 'CREDITED');

  UPDATE public.promo_codes SET uses_count = uses_count + 1, updated_at = now() WHERE id = v_code.id;

  v_balance := public.apply_ledger(v_user, 'PROMO_BONUS', v_code.bonus, 'PROMO-' || v_code.id, 'Recarga secreta — código ' || v_code.code);

  INSERT INTO public.notifications(user_id, title, body)
  VALUES (v_user, '🎁 Recarga secreta', 'Recebeu ' || v_code.bonus || ' MZN com o código ' || v_code.code || '.');

  RETURN jsonb_build_object('balance', v_balance, 'bonus', v_code.bonus);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já utilizou este código';
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_promo_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.plans_compute_values() FROM PUBLIC, anon, authenticated;