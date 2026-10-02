ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS promotional_balance numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_tier_check CHECK (account_tier IN ('RECRUTA', 'USER'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_promotional_balance_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_promotional_balance_check CHECK (promotional_balance >= 0);

CREATE TABLE public.promotional_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  balance_before numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  reference text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotional_ledger_transactions TO authenticated;
GRANT ALL ON public.promotional_ledger_transactions TO service_role;
ALTER TABLE public.promotional_ledger_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own promotional ledger" ON public.promotional_ledger_transactions
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX promotional_ledger_reference_unique ON public.promotional_ledger_transactions(reference) WHERE reference IS NOT NULL;

CREATE TABLE public.recruit_task_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date date NOT NULL,
  task_index integer NOT NULL CHECK (task_index BETWEEN 1 AND 4),
  amount numeric(14,2) NOT NULL DEFAULT 5 CHECK (amount = 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_date, task_index)
);
GRANT SELECT ON public.recruit_task_claims TO authenticated;
GRANT ALL ON public.recruit_task_claims TO service_role;
ALTER TABLE public.recruit_task_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own recruit tasks" ON public.recruit_task_claims
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_pub text;
  v_ref_code text;
  v_referrer uuid;
BEGIN
  v_code := 'BO-' || upper(substr(replace(NEW.id::text,'-',''),1,8));
  v_pub := 'BO-' || upper(substr(replace(NEW.id::text,'-',''),1,8));
  v_ref_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code','');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(v_ref_code) AND id <> NEW.id;
  END IF;

  INSERT INTO public.profiles (
    id, public_id, full_name, email, phone, wallet_number, province, district,
    referral_code, referred_by, balance, registration_bonus_received,
    account_tier, promotional_balance
  ) VALUES (
    NEW.id, v_pub,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone',''),
    COALESCE(NEW.raw_user_meta_data ->> 'wallet_number',''),
    '', '', v_code, v_referrer, 0, false, 'RECRUTA', 200
  );

  INSERT INTO public.promotional_ledger_transactions(
    user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    NEW.id, 'RECRUIT_PLAN_CREDIT', 200, 0, 200,
    'RECRUIT-CREDIT-' || NEW.id,
    'Crédito RECRUTA exclusivo para ativação de planos — +200 MZN'
  );

  INSERT INTO public.notifications(user_id,title,body)
  VALUES (NEW.id,'Bem-vindo, RECRUTA','Tem 0 MZN para levantamento e 200 MZN reservados exclusivamente para ativar planos. Complete 4 tarefas diárias de 5 MZN.');

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id) VALUES (v_referrer, NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(COALESCE(NEW.email,''))) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_plan_with_balances(_user_id uuid, _plan_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_plan record;
  v_promo numeric;
  v_cash numeric;
  v_start date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_end date;
  v_new_plan uuid;
  v_reference text := 'PLAN-' || _plan_id || '-' || _user_id || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id, balance, promotional_balance, blocked INTO v_profile
  FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'A sua conta está bloqueada'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active = true;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Este plano não está disponível'; END IF;
  IF v_profile.balance + v_profile.promotional_balance < v_plan.price THEN
    RAISE EXCEPTION 'Saldo insuficiente para comprar este plano';
  END IF;

  v_promo := least(v_profile.promotional_balance, v_plan.price);
  v_cash := v_plan.price - v_promo;
  v_end := v_start + v_plan.duration_days;

  PERFORM set_config('app.trusted_ledger', 'on', true);
  UPDATE public.profiles
  SET promotional_balance = promotional_balance - v_promo,
      balance = balance - v_cash,
      account_tier = CASE WHEN account_tier = 'RECRUTA' THEN 'USER' ELSE account_tier END
  WHERE id = _user_id;
  PERFORM set_config('app.trusted_ledger', 'off', true);

  IF v_promo > 0 THEN
    INSERT INTO public.promotional_ledger_transactions(user_id,type,amount,balance_before,balance_after,reference,description)
    VALUES (_user_id,'PLAN_PURCHASE',-v_promo,v_profile.promotional_balance,v_profile.promotional_balance-v_promo,v_reference || '-PROMO','Compra de ' || v_plan.name);
  END IF;
  IF v_cash > 0 THEN
    INSERT INTO public.ledger_transactions(user_id,type,amount,balance_before,balance_after,reference,description)
    VALUES (_user_id,'PLAN_PURCHASE',-v_cash,v_profile.balance,v_profile.balance-v_cash,v_reference || '-CASH','Compra de ' || v_plan.name);
  END IF;

  INSERT INTO public.user_plans(user_id,plan_id,status,start_date,end_date)
  VALUES (_user_id,v_plan.id,'ACTIVE',v_start,v_end) RETURNING id INTO v_new_plan;
  UPDATE public.user_plans SET status='REPLACED'
  WHERE user_id=_user_id AND status='ACTIVE' AND id<>v_new_plan;

  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_user_id,'Plano ativado',v_plan.name || ' foi ativado com sucesso até ' || to_char(v_end,'DD/MM/YYYY') || '.');

  RETURN jsonb_build_object(
    'planId', v_plan.id, 'planName', v_plan.name, 'amount', v_plan.price,
    'balance', v_profile.balance-v_cash, 'promotionalBalance', v_profile.promotional_balance-v_promo,
    'startDate', v_start, 'endDate', v_end
  );
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_plan_with_balances(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_plan_with_balances(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_task(_task_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_plan record;
  v_profile record;
  v_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id, blocked, account_tier INTO v_profile FROM public.profiles WHERE id=v_user;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT up.id, p.daily_task_count, p.task_value INTO v_plan
  FROM public.user_plans up JOIN public.plans p ON p.id=up.plan_id
  WHERE up.user_id=v_user AND up.status='ACTIVE' AND up.start_date<=v_today AND up.end_date>=v_today
  ORDER BY up.created_at DESC LIMIT 1;

  IF v_plan.id IS NULL THEN
    IF v_profile.account_tier <> 'RECRUTA' THEN RAISE EXCEPTION 'Não possui um plano ativo'; END IF;
    IF _task_index < 1 OR _task_index > 4 THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;
    INSERT INTO public.recruit_task_claims(user_id,task_date,task_index,amount)
    VALUES (v_user,v_today,_task_index,5);
    v_balance := public.apply_ledger(v_user,'RECRUIT_TASK_REWARD',5,'RECRUIT-TASK-'||v_today||'-'||_task_index,'Tarefa RECRUTA '||_task_index||' concluída');
    RETURN jsonb_build_object('balance',v_balance,'amount',5,'recruit',true);
  END IF;

  IF _task_index < 1 OR _task_index > v_plan.daily_task_count THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;
  INSERT INTO public.task_claims(user_id,user_plan_id,task_date,task_index,amount)
  VALUES (v_user,v_plan.id,v_today,_task_index,v_plan.task_value);
  v_balance := public.apply_ledger(v_user,'TASK_REWARD',v_plan.task_value,'TASK-'||v_today||'-'||_task_index,'Tarefa '||_task_index||' concluída');
  RETURN jsonb_build_object('balance',v_balance,'amount',v_plan.task_value,'recruit',false);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Tarefa já foi coletada hoje';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_task(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_task(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_profile_update_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.trusted_ledger', true), 'off') = 'on'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance OR
     NEW.promotional_balance IS DISTINCT FROM OLD.promotional_balance OR
     NEW.account_tier IS DISTINCT FROM OLD.account_tier OR
     NEW.blocked IS DISTINCT FROM OLD.blocked OR
     NEW.registration_bonus_received IS DISTINCT FROM OLD.registration_bonus_received OR
     NEW.referral_code IS DISTINCT FROM OLD.referral_code OR
     NEW.id IS DISTINCT FROM OLD.id OR
     NEW.public_id IS DISTINCT FROM OLD.public_id
  THEN RAISE EXCEPTION 'Não tem permissão para alterar campos sensíveis.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_profile_update_security() FROM PUBLIC, anon, authenticated;

UPDATE public.plans SET name = CASE id
  WHEN 1 THEN 'Blue Moon Mark 1'
  WHEN 2 THEN 'Blue Moon Mark 2'
  WHEN 3 THEN 'Blue Moon Pathfinder'
  WHEN 4 THEN 'New Glenn'
  WHEN 5 THEN 'Blue Ring'
  WHEN 6 THEN 'New Shepard Crew'
  WHEN 7 THEN 'New Shepard Booster'
  WHEN 8 THEN 'New Shepard Capsule'
  WHEN 9 THEN 'Orbital Reef'
  WHEN 10 THEN 'BE-4 Engine'
  WHEN 11 THEN 'New Glenn Heavy'
END
WHERE id BETWEEN 1 AND 11;