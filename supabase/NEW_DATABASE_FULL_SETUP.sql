-- BLUE ORIGIN / NOVO SUPABASE
-- Gerado a partir das migrations do repositório, em ordem cronológica.
-- Executar em um projeto Supabase NOVO.


-- ============================================================
-- supabase/migrations/20260810074415_168c1adb-a109-4b09-9127-e060b6ca9b7e.sql
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_emails(email) VALUES ('saloobeet@gmail.com'), ('vldfernando96@gmail.com');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  wallet_number text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  avatar_url text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  registration_bonus_received boolean NOT NULL DEFAULT false,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own avatar" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE INDEX idx_profiles_referred_by ON public.profiles(referred_by);

CREATE TABLE public.plans (
  id int PRIMARY KEY,
  name text NOT NULL,
  price numeric(14,2) NOT NULL,
  daily_task_count int NOT NULL,
  task_value numeric(14,2) NOT NULL,
  daily_income numeric(14,2) NOT NULL,
  duration_days int NOT NULL DEFAULT 90,
  total_task_income numeric(14,2) NOT NULL
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public" ON public.plans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans (id,name,price,daily_task_count,task_value,daily_income,duration_days,total_task_income) VALUES
 (1,'RENT 1',500,5,3.00,15.00,90,1350.00),
 (2,'RENT 2',1000,5,6.00,30.00,90,2700.00),
 (3,'RENT 3',3000,5,18.00,90.00,90,8100.00),
 (4,'RENT 4',5000,5,30.00,150.00,90,13500.00),
 (5,'RENT 5',10000,5,60.00,300.00,90,27000.00),
 (6,'RENT 6',20000,5,120.00,600.00,90,54000.00),
 (7,'RENT 7',30000,5,180.00,900.00,90,81000.00),
 (8,'RENT 8',50000,5,300.00,1500.00,90,135000.00),
 (9,'RENT 9',70000,5,420.00,2100.00,90,189000.00);

CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id int NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'ACTIVE',
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own plans" ON public.user_plans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_user_plans_user ON public.user_plans(user_id);

CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id int NOT NULL REFERENCES public.plans(id),
  amount numeric(14,2) NOT NULL,
  sender_number text NOT NULL,
  transaction_id text NOT NULL,
  proof_path text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own deposits" ON public.deposit_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_deposits_status ON public.deposit_requests(status);

CREATE TABLE public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  balance_before numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  reference text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ledger_transactions TO authenticated;
GRANT ALL ON public.ledger_transactions TO service_role;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ledger" ON public.ledger_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_ledger_user ON public.ledger_transactions(user_id, created_at DESC);

CREATE TABLE public.task_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_plan_id uuid NOT NULL REFERENCES public.user_plans(id) ON DELETE CASCADE,
  task_date date NOT NULL,
  task_index int NOT NULL,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_date, task_index)
);
GRANT SELECT ON public.task_claims TO authenticated;
GRANT ALL ON public.task_claims TO service_role;
ALTER TABLE public.task_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own tasks" ON public.task_claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL,
  fee numeric(14,2) NOT NULL,
  net_amount numeric(14,2) NOT NULL,
  phone text NOT NULL,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  rewarded boolean NOT NULL DEFAULT false,
  reward_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.affiliate_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  url text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  reward numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
GRANT SELECT ON public.affiliate_submissions TO authenticated;
GRANT ALL ON public.affiliate_submissions TO service_role;
ALTER TABLE public.affiliate_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own affiliate" ON public.affiliate_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  principal numeric(14,2) NOT NULL,
  return_rate numeric(6,4) NOT NULL DEFAULT 0.15,
  return_amount numeric(14,2) NOT NULL,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own donations" ON public.donations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ticket messages" ON public.support_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  amount numeric(14,2),
  reason text,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.admin_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.site_settings(key,value) VALUES
 ('whatsapp_group',''),('telegram_group',''),('support_tech',''),('support_help',''),('support_finance','');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_pub text;
  v_ref_code text;
  v_referrer uuid;
BEGIN
  v_code := 'RI-' || upper(substr(replace(NEW.id::text,'-',''),1,8));
  v_pub := upper(substr(replace(NEW.id::text,'-',''),1,10));
  v_ref_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code','');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(v_ref_code) AND id <> NEW.id;
  END IF;

  INSERT INTO public.profiles (id, public_id, full_name, email, phone, wallet_number, province, district, referral_code, referred_by, balance, registration_bonus_received)
  VALUES (
    NEW.id, v_pub,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone',''),
    COALESCE(NEW.raw_user_meta_data ->> 'wallet_number',''),
    COALESCE(NEW.raw_user_meta_data ->> 'province',''),
    COALESCE(NEW.raw_user_meta_data ->> 'district',''),
    v_code, v_referrer, 25, true
  );

  INSERT INTO public.ledger_transactions(user_id,type,amount,balance_before,balance_after,description)
  VALUES (NEW.id,'REGISTRATION_BONUS',25,0,25,'BÓNUS DE CADASTRO — +25 MZN');

  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.id,'🎁 Bónus de cadastro','Recebeu 25 MZN de bónus de cadastro.');

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

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.apply_ledger(_user_id uuid, _type text, _amount numeric, _reference text, _description text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before numeric;
  v_after numeric;
BEGIN
  SELECT balance INTO v_before FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  v_after := v_before + _amount;
  IF v_after < 0 THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE public.profiles SET balance = v_after WHERE id = _user_id;
  INSERT INTO public.ledger_transactions(user_id,type,amount,balance_before,balance_after,reference,description)
  VALUES (_user_id,_type,_amount,v_before,v_after,_reference,_description);
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_task(_task_index int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_plan record;
  v_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND blocked) THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT up.id AS id, up.plan_id AS plan_id, p.daily_task_count AS daily_task_count, p.task_value AS task_value INTO v_plan
  FROM public.user_plans up JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = v_user AND up.status = 'ACTIVE' AND up.start_date <= v_today AND up.end_date >= v_today
  ORDER BY up.created_at DESC LIMIT 1;

  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Não possui um plano ativo'; END IF;
  IF _task_index < 1 OR _task_index > v_plan.daily_task_count THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;

  INSERT INTO public.task_claims(user_id,user_plan_id,task_date,task_index,amount)
  VALUES (v_user, v_plan.id, v_today, _task_index, v_plan.task_value);

  v_balance := public.apply_ledger(v_user,'TASK_REWARD', v_plan.task_value, 'TASK-'||v_today||'-'||_task_index, 'Tarefa '||_task_index||' concluída');
  RETURN jsonb_build_object('balance', v_balance, 'amount', v_plan.task_value);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Tarefa já foi coletada hoje';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_task(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "proofs upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proofs read own or admin" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));


-- ============================================================
-- supabase/migrations/20260810074429_2a866472-880d-49a2-a5ed-4caefa9ca92d.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.apply_ledger(uuid,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_task(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_task(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;


-- ============================================================
-- supabase/migrations/20260810074551_52c2c7ae-2867-458b-a3ce-b59fb9cf8b32.sql
-- ============================================================

GRANT EXECUTE ON FUNCTION public.apply_ledger(uuid,text,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_due_donations()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.donations WHERE status = 'ACTIVE' AND end_date <= now() FOR UPDATE LOOP
    UPDATE public.donations SET status='COMPLETED', completed_at = now() WHERE id = r.id AND status='ACTIVE';
    IF FOUND THEN
      PERFORM public.apply_ledger(r.user_id,'DONATION_RETURN', r.return_amount, 'DON-'||r.id, 'Retorno da doação concluída');
      INSERT INTO public.notifications(user_id,title,body) VALUES (r.user_id,'💝 Doação concluída','Recebeu '||r.return_amount||' MZN de retorno da sua doação.');
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.process_due_donations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_donations() TO service_role;

CREATE OR REPLACE FUNCTION public.expire_plans()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.user_plans SET status='EXPIRED'
  WHERE status='ACTIVE' AND end_date < (now() AT TIME ZONE 'Africa/Maputo')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_plans() TO service_role;


-- ============================================================
-- supabase/migrations/20260813054200_5dff7fa2-4884-4093-ad5d-b49d72c249dc.sql
-- ============================================================
ALTER POLICY "update own avatar" ON public.profiles USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND (
  full_name IS NOT NULL OR 
  avatar_url IS NOT NULL OR
  phone IS NOT NULL OR
  province IS NOT NULL OR
  district IS NOT NULL
));

-- Opcional: restringir colunas sensíveis via trigger para garantir que balance, blocked, etc não sejam alterados via UPDATE direto
CREATE OR REPLACE FUNCTION public.check_profile_update_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.balance <> OLD.balance OR 
       NEW.blocked <> OLD.blocked OR 
       NEW.registration_bonus_received <> OLD.registration_bonus_received OR 
       NEW.referral_code <> OLD.referral_code OR
       NEW.id <> OLD.id OR
       NEW.public_id <> OLD.public_id
    THEN
      RAISE EXCEPTION 'Não tem permissão para alterar campos sensíveis.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_profile_update_security ON public.profiles;
CREATE TRIGGER tr_check_profile_update_security
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_security();

-- ============================================================
-- supabase/migrations/20260813054624_95b10bf2-34aa-47cb-ab55-d6842993b3e4.sql
-- ============================================================
-- Revogar acesso público padrão (anon) e autenticado (authenticated) para as funções SECURITY DEFINER
-- Elas serão chamadas apenas quando explicitamente permitido por GRANT

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_task(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_task(int) FROM authenticated;

-- Garantir que as funções possam ser executadas pelos administradores (authenticated com papel admin)
-- Ou conforme a lógica interna de cada função (SECURITY DEFINER já cuida do acesso interno)

-- Re-conceder acesso apenas para 'authenticated' onde for necessário para o funcionamento do app
-- claim_task é necessária para usuários comuns, mas as outras são internas ou administrativas.
GRANT EXECUTE ON FUNCTION public.claim_task(int) TO authenticated;

-- has_role é usada em RLS, mas se for SECURITY DEFINER e chamada por outras funções, 
-- talvez não precise de GRANT direto para o usuário, mas vamos manter o necessário para o frontend.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- apply_ledger NÃO deve ser executada diretamente por usuários autenticados (risco de fraude)
-- deve ser chamada apenas internamente por outras funções SECURITY DEFINER (como claim_task)
-- ou pelo service_role.
GRANT EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) TO service_role;


-- ============================================================
-- supabase/migrations/20260817080441_9b94e3f1-9d86-4bcc-aeec-d2018fab2e3e.sql
-- ============================================================
-- Allow trusted SECURITY DEFINER routines to update balances while still
-- blocking direct user edits of sensitive columns.
CREATE OR REPLACE FUNCTION public.apply_ledger(_user_id uuid, _type text, _amount numeric, _reference text, _description text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before numeric;
  v_after numeric;
BEGIN
  SELECT balance INTO v_before FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  v_after := v_before + _amount;
  IF v_after < 0 THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  PERFORM set_config('app.trusted_ledger', 'on', true);
  UPDATE public.profiles SET balance = v_after WHERE id = _user_id;
  PERFORM set_config('app.trusted_ledger', 'off', true);
  INSERT INTO public.ledger_transactions(user_id,type,amount,balance_before,balance_after,reference,description)
  VALUES (_user_id,_type,_amount,v_before,v_after,_reference,_description);
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_profile_update_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Trusted internal ledger updates and service_role/admin operations bypass the guard.
  IF coalesce(current_setting('app.trusted_ledger', true), 'off') = 'on'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance OR
     NEW.blocked IS DISTINCT FROM OLD.blocked OR
     NEW.registration_bonus_received IS DISTINCT FROM OLD.registration_bonus_received OR
     NEW.referral_code IS DISTINCT FROM OLD.referral_code OR
     NEW.id IS DISTINCT FROM OLD.id OR
     NEW.public_id IS DISTINCT FROM OLD.public_id
  THEN
    RAISE EXCEPTION 'Não tem permissão para alterar campos sensíveis.';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- supabase/migrations/20260817080456_761fa237-3260-48ce-958d-dea35ead2127.sql
-- ============================================================
REVOKE ALL ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_profile_update_security() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_task(integer) TO authenticated;

-- ============================================================
-- supabase/migrations/20260902122951_afa9076c-366a-4e2d-994e-c66ea59133f1.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_pub text;
  v_ref_code text;
  v_referrer uuid;
BEGIN
  v_code := 'RI-' || upper(substr(replace(NEW.id::text,'-',''),1,8));
  v_pub := upper(substr(replace(NEW.id::text,'-',''),1,10));
  v_ref_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code','');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(v_ref_code) AND id <> NEW.id;
  END IF;

  INSERT INTO public.profiles (id, public_id, full_name, email, phone, wallet_number, province, district, referral_code, referred_by, balance, registration_bonus_received)
  VALUES (
    NEW.id, v_pub,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone',''),
    COALESCE(NEW.raw_user_meta_data ->> 'wallet_number',''),
    COALESCE(NEW.raw_user_meta_data ->> 'province',''),
    COALESCE(NEW.raw_user_meta_data ->> 'district',''),
    v_code, v_referrer, 50, true
  );

  INSERT INTO public.ledger_transactions(user_id,type,amount,balance_before,balance_after,description)
  VALUES (NEW.id,'REGISTRATION_BONUS',50,0,50,'BÓNUS DE CADASTRO — +50 MZN');

  INSERT INTO public.notifications(user_id,title,body) VALUES (NEW.id,'🎁 Bónus de cadastro','Recebeu 50 MZN de bónus de cadastro.');

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id, referred_id) VALUES (v_referrer, NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(COALESCE(NEW.email,''))) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- supabase/migrations/20260903000914_f6329a55-066a-48b7-9761-978a2af54d74.sql
-- ============================================================
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

-- ============================================================
-- supabase/migrations/20260906114658_721b56a7-0b5c-410b-98da-a469ab5e759d.sql
-- ============================================================
CREATE TABLE public.share_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 40,
  reward_date date NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  granted_by uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_date)
);
CREATE INDEX share_rewards_user_status_idx ON public.share_rewards (user_id, status);

GRANT SELECT ON public.share_rewards TO authenticated;
GRANT ALL ON public.share_rewards TO service_role;

ALTER TABLE public.share_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own share rewards" ON public.share_rewards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_share_reward(_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_r record;
  v_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND blocked) THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT * INTO v_r FROM public.share_rewards WHERE id = _reward_id AND user_id = v_user FOR UPDATE;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Bónus não encontrado'; END IF;
  IF v_r.status = 'CLAIMED' THEN RAISE EXCEPTION 'Este bónus já foi reivindicado'; END IF;
  IF v_r.status = 'EXPIRED' OR v_r.expires_at <= now() THEN
    UPDATE public.share_rewards SET status = 'EXPIRED' WHERE id = v_r.id;
    RAISE EXCEPTION 'O prazo de 3 horas para reivindicar este bónus expirou';
  END IF;

  UPDATE public.share_rewards SET status = 'CLAIMED', claimed_at = now() WHERE id = v_r.id;
  v_balance := public.apply_ledger(v_user, 'SHARE_REWARD', v_r.amount, 'SHARE-' || v_r.id, 'PARTILHA E GANHA — bónus de ' || v_r.amount || ' MZN');
  INSERT INTO public.notifications(user_id, title, body)
  VALUES (v_user, '✅ PARTILHA E GANHA', 'Bónus de ' || v_r.amount || ' MZN creditado no seu saldo.');
  RETURN jsonb_build_object('balance', v_balance, 'amount', v_r.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_share_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_share_reward(uuid) TO authenticated, service_role;

-- ============================================================
-- supabase/migrations/20260908163713_8dac48be-e5ef-4d41-a03d-b3d1e4a0e2ae.sql
-- ============================================================
CREATE TABLE public.roulette_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cost numeric NOT NULL DEFAULT 5,
  prize numeric NOT NULL DEFAULT 0,
  spin_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roulette_spins TO authenticated;
GRANT ALL ON public.roulette_spins TO service_role;

ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own spins" ON public.roulette_spins
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_roulette_spins_user ON public.roulette_spins(user_id, created_at DESC);
CREATE INDEX idx_roulette_spins_created ON public.roulette_spins(created_at DESC);

-- ============================================================
-- supabase/migrations/20260920_binance_usdt.sql
-- ============================================================
-- ============================================================
-- BINANCE + USDT TRC20
-- Configuração segura da integração
-- ============================================================

CREATE TABLE IF NOT EXISTS public.binance_settings (
  id boolean PRIMARY KEY DEFAULT true,

  enabled boolean NOT NULL DEFAULT false,
  automatic_withdrawals boolean NOT NULL DEFAULT false,

  asset text NOT NULL DEFAULT 'USDT',
  network text NOT NULL DEFAULT 'TRC20',

  api_configured boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT binance_settings_single_row
    CHECK (id = true),

  CONSTRAINT binance_settings_asset_check
    CHECK (asset = 'USDT'),

  CONSTRAINT binance_settings_network_check
    CHECK (network = 'TRC20')
);

INSERT INTO public.binance_settings (
  id,
  enabled,
  automatic_withdrawals,
  asset,
  network,
  api_configured
)
VALUES (
  true,
  false,
  false,
  'USDT',
  'TRC20',
  false
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- CONTROLO DE PROCESSAMENTO DOS SAQUES BINANCE
-- ============================================================

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_withdrawal_id text;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_client_id text;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_response jsonb;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS failure_reason text;


-- Impede que o mesmo pedido seja associado
-- a mais de uma operação Binance.
CREATE UNIQUE INDEX IF NOT EXISTS
  usdt_withdrawals_binance_withdrawal_id_unique
ON public.usdt_withdrawals (binance_withdrawal_id)
WHERE binance_withdrawal_id IS NOT NULL;


-- Identificador interno único para cada tentativa.
CREATE UNIQUE INDEX IF NOT EXISTS
  usdt_withdrawals_binance_client_id_unique
ON public.usdt_withdrawals (binance_client_id)
WHERE binance_client_id IS NOT NULL;


-- ============================================================
-- EVENTOS BINANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.binance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  withdrawal_id uuid
    REFERENCES public.usdt_withdrawals(id)
    ON DELETE SET NULL,

  event_type text NOT NULL,

  binance_withdrawal_id text,
  client_id text,

  amount_usdt numeric(20,8),
  network text,
  address text,
  txid text,

  status text,
  message text,

  response jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  binance_events_withdrawal_id_idx
ON public.binance_events (withdrawal_id);

CREATE INDEX IF NOT EXISTS
  binance_events_binance_id_idx
ON public.binance_events (binance_withdrawal_id);

CREATE INDEX IF NOT EXISTS
  binance_events_created_at_idx
ON public.binance_events (created_at DESC);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.binance_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.binance_events ENABLE ROW LEVEL SECURITY;


-- O utilizador normal não pode alterar configurações Binance.
DROP POLICY IF EXISTS
  "binance_settings_admin_select"
ON public.binance_settings;

CREATE POLICY
  "binance_settings_admin_select"
ON public.binance_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);


DROP POLICY IF EXISTS
  "binance_events_admin_select"
ON public.binance_events;

CREATE POLICY
  "binance_events_admin_select"
ON public.binance_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);


-- Apenas service_role poderá inserir/alterar
-- estas informações através do servidor.
REVOKE ALL ON TABLE public.binance_settings
FROM anon, authenticated;

REVOKE ALL ON TABLE public.binance_events
FROM anon, authenticated;


GRANT SELECT ON TABLE public.binance_settings
TO authenticated;

GRANT SELECT ON TABLE public.binance_events
TO authenticated;


-- ============================================================
-- supabase/migrations/20260920_usdt_trc20.sql
-- ============================================================
-- ============================================================
-- USDT TRC20
-- Migration 12
-- ============================================================

-- Configurações do gateway USDT
CREATE TABLE IF NOT EXISTS public.usdt_settings (
  id boolean PRIMARY KEY DEFAULT true,

  network text NOT NULL DEFAULT 'TRC20',
  symbol text NOT NULL DEFAULT 'USDT',

  deposit_address text NOT NULL DEFAULT '',
  withdrawal_enabled boolean NOT NULL DEFAULT true,
  deposit_enabled boolean NOT NULL DEFAULT true,

  -- Quantos MZN correspondem a 1 USDT.
  usdt_mzn_rate numeric(14,4) NOT NULL DEFAULT 0,

  min_deposit_usdt numeric(14,6) NOT NULL DEFAULT 1,
  min_withdrawal_usdt numeric(14,6) NOT NULL DEFAULT 1,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_settings_single_row
    CHECK (id = true),

  CONSTRAINT usdt_rate_positive
    CHECK (usdt_mzn_rate >= 0),

  CONSTRAINT usdt_min_deposit_positive
    CHECK (min_deposit_usdt > 0),

  CONSTRAINT usdt_min_withdrawal_positive
    CHECK (min_withdrawal_usdt > 0)
);

GRANT SELECT ON public.usdt_settings TO anon, authenticated;
GRANT ALL ON public.usdt_settings TO service_role;

ALTER TABLE public.usdt_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read usdt settings"
ON public.usdt_settings;

CREATE POLICY "public read usdt settings"
ON public.usdt_settings
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================
-- DEPÓSITOS USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  network text NOT NULL DEFAULT 'TRC20',
  token text NOT NULL DEFAULT 'USDT',

  deposit_address text NOT NULL,

  txid text NOT NULL UNIQUE,

  sender_address text,
  recipient_address text,

  amount_usdt numeric(18,6) NOT NULL,

  exchange_rate numeric(14,4) NOT NULL,

  amount_mzn numeric(14,2) NOT NULL,

  confirmations integer NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'PENDING',

  ledger_reference text UNIQUE,

  detected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  credited_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_deposits_amount_positive
    CHECK (amount_usdt > 0),

  CONSTRAINT usdt_deposits_rate_positive
    CHECK (exchange_rate > 0),

  CONSTRAINT usdt_deposits_mzn_positive
    CHECK (amount_mzn > 0),

  CONSTRAINT usdt_deposits_status_check
    CHECK (
      status IN (
        'PENDING',
        'CONFIRMED',
        'CREDITED',
        'REJECTED'
      )
    )
);

GRANT SELECT ON public.usdt_deposits TO authenticated;
GRANT ALL ON public.usdt_deposits TO service_role;

ALTER TABLE public.usdt_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own usdt deposits"
ON public.usdt_deposits;

CREATE POLICY "read own usdt deposits"
ON public.usdt_deposits
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_user
ON public.usdt_deposits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_status
ON public.usdt_deposits(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_txid
ON public.usdt_deposits(txid);


-- ============================================================
-- SAQUES USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  network text NOT NULL DEFAULT 'TRC20',
  token text NOT NULL DEFAULT 'USDT',

  destination_address text NOT NULL,

  amount_mzn numeric(14,2) NOT NULL,
  exchange_rate numeric(14,4) NOT NULL,
  amount_usdt numeric(18,6) NOT NULL,

  fee_mzn numeric(14,2) NOT NULL DEFAULT 0,
  net_amount_mzn numeric(14,2) NOT NULL,

  txid text UNIQUE,

  status text NOT NULL DEFAULT 'PENDING',

  admin_id uuid,
  admin_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_withdrawals_amount_positive
    CHECK (amount_mzn > 0),

  CONSTRAINT usdt_withdrawals_rate_positive
    CHECK (exchange_rate > 0),

  CONSTRAINT usdt_withdrawals_usdt_positive
    CHECK (amount_usdt > 0),

  CONSTRAINT usdt_withdrawals_fee_nonnegative
    CHECK (fee_mzn >= 0),

  CONSTRAINT usdt_withdrawals_net_positive
    CHECK (net_amount_mzn > 0),

  CONSTRAINT usdt_withdrawals_status_check
    CHECK (
      status IN (
        'PENDING',
        'APPROVED',
        'PROCESSING',
        'SENT',
        'COMPLETED',
        'REJECTED',
        'FAILED'
      )
    )
);

GRANT SELECT ON public.usdt_withdrawals TO authenticated;
GRANT ALL ON public.usdt_withdrawals TO service_role;

ALTER TABLE public.usdt_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own usdt withdrawals"
ON public.usdt_withdrawals;

CREATE POLICY "read own usdt withdrawals"
ON public.usdt_withdrawals
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_user
ON public.usdt_withdrawals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_status
ON public.usdt_withdrawals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_txid
ON public.usdt_withdrawals(txid);


-- ============================================================
-- AUDITORIA DE OPERAÇÕES USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL,

  user_id uuid,

  deposit_id uuid
    REFERENCES public.usdt_deposits(id)
    ON DELETE SET NULL,

  withdrawal_id uuid
    REFERENCES public.usdt_withdrawals(id)
    ON DELETE SET NULL,

  txid text,

  amount_usdt numeric(18,6),
  amount_mzn numeric(14,2),

  message text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.usdt_events TO authenticated;
GRANT ALL ON public.usdt_events TO service_role;

ALTER TABLE public.usdt_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read usdt events"
ON public.usdt_events;

CREATE POLICY "admins read usdt events"
ON public.usdt_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_events_created
ON public.usdt_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_events_txid
ON public.usdt_events(txid);


-- ============================================================
-- CONFIGURAÇÃO INICIAL
-- ============================================================

INSERT INTO public.usdt_settings (
  id,
  network,
  symbol,
  deposit_address,
  withdrawal_enabled,
  deposit_enabled,
  usdt_mzn_rate,
  min_deposit_usdt,
  min_withdrawal_usdt
)
VALUES (
  true,
  'TRC20',
  'USDT',
  '',
  false,
  false,
  0,
  1,
  1
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- supabase/migrations/20261002001303_9a31cea7-e3cc-4e3a-b7ce-bd9a5d952f91.sql
-- ============================================================
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

-- ============================================================
-- supabase/migrations/20261003000000_admin_media_settings.sql
-- ============================================================
-- Configuração editável pelo administrador para imagens dos VIPs e conteúdo das tarefas.
-- Os valores ficam na tabela pública de definições e podem ser alterados pela área Administração > Definições.

INSERT INTO public.site_settings (key, value)
SELECT 'plan_' || n || '_image_url',
       CASE n
         WHEN 1 THEN '/__l5e/assets-v1/4fca6078-046a-4c88-a325-28a1fe6a0137/blue-moon-mark-1.jpg'
         WHEN 2 THEN '/__l5e/assets-v1/9a2c8f32-20a2-42df-9f48-e78867ae12aa/blue-moon-mark-2.jpeg'
         WHEN 3 THEN '/__l5e/assets-v1/bc8c703e-7ad7-4848-8335-c10932c01585/blue-moon-pathfinder.jpeg'
         WHEN 4 THEN '/__l5e/assets-v1/a4f987a8-79e9-4fd2-9f74-9da8708d7d0f/new-glenn.jpeg'
         WHEN 5 THEN '/__l5e/assets-v1/a615d874-bf92-4132-8ac7-ed45eb437e7a/blue-ring.jpg'
         WHEN 6 THEN '/__l5e/assets-v1/94d21066-9d73-4d59-8f62-6ff5b650da61/new-shepard-crew.jpeg'
         WHEN 7 THEN '/__l5e/assets-v1/135e4ea7-c421-4f13-9ba3-f3138b721841/new-shepard-booster.jpeg'
         WHEN 8 THEN '/__l5e/assets-v1/1f81782e-0970-4e71-bda2-7d1ae073299d/new-shepard-capsule.jpg'
         WHEN 9 THEN '/__l5e/assets-v1/cb02dff5-41d5-4add-9140-a570fa4433d5/orbital-factory.jpg'
         WHEN 10 THEN '/__l5e/assets-v1/a615d874-bf92-4132-8ac7-ed45eb437e7a/blue-ring.jpg'
         WHEN 11 THEN '/__l5e/assets-v1/a4f987a8-79e9-4fd2-9f74-9da8708d7d0f/new-glenn.jpeg'
       END
FROM generate_series(1, 11) AS n
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
SELECT 'task_' || n || '_image_url', ''
FROM generate_series(1, 5) AS n
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
SELECT 'task_' || n || '_video_url', ''
FROM generate_series(1, 5) AS n
ON CONFLICT (key) DO NOTHING;

UPDATE public.plans
SET name = 'VIP ' || id
WHERE id BETWEEN 1 AND 11;


-- ============================================================
-- supabase/migrations/20261003010000_blue_origin_cutover_and_video_tasks.sql
-- ============================================================
-- BLUE ORIGIN: corte de plataforma, RECRUTA, tarefas por vídeo e catálogo VIP
-- Esta migração prepara a nova versão. A eliminação física de contas Auth antigas
-- deve ser executada pelo Supabase Auth Admin/SQL Editor, pois auth.users é gerido pelo Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'USER';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS promotional_balance numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_tier_check CHECK (account_tier IN ('RECRUTA','USER'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_promotional_balance_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_promotional_balance_check CHECK (promotional_balance >= 0);

UPDATE public.profiles
SET platform_version = 1,
    balance = 0,
    promotional_balance = 0,
    account_tier = 'USER'
WHERE platform_version IS DISTINCT FROM 2;

UPDATE public.plans
SET name = 'VIP ' || id
WHERE id BETWEEN 1 AND 11;

CREATE TABLE IF NOT EXISTS public.task_watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date date NOT NULL,
  task_index integer NOT NULL CHECK (task_index BETWEEN 1 AND 20),
  started_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  UNIQUE(user_id, task_date, task_index)
);

ALTER TABLE public.task_watch_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own task watch sessions" ON public.task_watch_sessions;
CREATE POLICY "users read own task watch sessions"
ON public.task_watch_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.task_watch_sessions TO authenticated;
GRANT ALL ON public.task_watch_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.start_task_watch(_task_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _task_index < 1 OR _task_index > 20 THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;

  INSERT INTO public.task_watch_sessions(user_id,task_date,task_index,started_at,claimed_at)
  VALUES (v_user,v_today,_task_index,now(),NULL)
  ON CONFLICT (user_id,task_date,task_index)
  DO UPDATE SET started_at = CASE
    WHEN public.task_watch_sessions.claimed_at IS NULL THEN now()
    ELSE public.task_watch_sessions.started_at
  END;

  RETURN jsonb_build_object('ok',true,'startedAt',now(),'minimumSeconds',15);
END;
$$;

REVOKE ALL ON FUNCTION public.start_task_watch(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_task_watch(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_task(_task_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_watch public.task_watch_sessions;
  v_plan record;
  v_video text;
  v_profile record;
  v_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT id, blocked, account_tier INTO v_profile
  FROM public.profiles WHERE id=v_user;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT * INTO v_watch
  FROM public.task_watch_sessions
  WHERE user_id=v_user AND task_date=v_today AND task_index=_task_index
  FOR UPDATE;

  IF v_watch.id IS NULL THEN
    RAISE EXCEPTION 'Primeiro clique em "Assistir agora" e assista ao vídeo.';
  END IF;
  IF v_watch.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Tarefa já foi coletada hoje';
  END IF;
  IF v_watch.started_at > now() - interval '15 seconds' THEN
    RAISE EXCEPTION 'É necessário assistir durante pelo menos 15 segundos.';
  END IF;

  SELECT up.id, p.daily_task_count, p.task_value INTO v_plan
  FROM public.user_plans up
  JOIN public.plans p ON p.id=up.plan_id
  WHERE up.user_id=v_user AND up.status='ACTIVE'
    AND up.start_date<=v_today AND up.end_date>=v_today
  ORDER BY up.created_at DESC LIMIT 1;

  UPDATE public.task_watch_sessions
  SET claimed_at=now()
  WHERE id=v_watch.id;

  IF v_plan.id IS NULL THEN
    IF v_profile.account_tier <> 'RECRUTA' THEN
      RAISE EXCEPTION 'Não possui um VIP ativo';
    END IF;
    IF _task_index < 1 OR _task_index > 4 THEN
      RAISE EXCEPTION 'Tarefa inválida';
    END IF;

    INSERT INTO public.recruit_task_claims(user_id,task_date,task_index,amount)
    VALUES (v_user,v_today,_task_index,5);

    v_balance := public.apply_ledger(
      v_user,'RECRUIT_TASK_REWARD',5,
      'RECRUIT-TASK-'||v_today||'-'||_task_index,
      'Tarefa RECRUTA '||_task_index||' concluída'
    );

    RETURN jsonb_build_object('balance',v_balance,'amount',5,'recruit',true);
  END IF;

  IF _task_index < 1 OR _task_index > v_plan.daily_task_count THEN
    RAISE EXCEPTION 'Tarefa inválida';
  END IF;

  INSERT INTO public.task_claims(user_id,user_plan_id,task_date,task_index,amount)
  VALUES (v_user,v_plan.id,v_today,_task_index,v_plan.task_value);

  v_balance := public.apply_ledger(
    v_user,'TASK_REWARD',v_plan.task_value,
    'TASK-'||v_today||'-'||_task_index,
    'Tarefa '||_task_index||' concluída'
  );

  RETURN jsonb_build_object('balance',v_balance,'amount',v_plan.task_value,'recruit',false);

EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Tarefa já foi coletada hoje';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_task(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_task(integer) TO authenticated;

-- Novos registos entram exclusivamente na nova plataforma.
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
    SELECT id INTO v_referrer
    FROM public.profiles
    WHERE referral_code = upper(v_ref_code) AND id <> NEW.id;
  END IF;

  INSERT INTO public.profiles (
    id, public_id, full_name, email, phone, wallet_number, province, district,
    referral_code, referred_by, balance, registration_bonus_received,
    account_tier, promotional_balance, platform_version
  ) VALUES (
    NEW.id, v_pub, 'RECRUTA',
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone',''),
    COALESCE(NEW.raw_user_meta_data ->> 'wallet_number',''),
    '', '', v_code, v_referrer, 0, false,
    'RECRUTA', 200, 2
  );

  INSERT INTO public.promotional_ledger_transactions(
    user_id,type,amount,balance_before,balance_after,reference,description
  ) VALUES (
    NEW.id,'RECRUIT_PLAN_CREDIT',200,0,200,
    'RECRUIT-CREDIT-'||NEW.id,
    'Crédito RECRUTA exclusivo para ativação de VIPs — +200 MZN'
  );

  INSERT INTO public.notifications(user_id,title,body)
  VALUES (
    NEW.id,
    'Bem-vindo à BLUE ORIGIN',
    'A sua conta foi criada como RECRUTA. Saldo levantável: 0 MZN. Crédito para ativar VIPs: 200 MZN. Tem 4 tarefas diárias de 5 MZN.'
  );

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referrals(referrer_id,referred_id)
    VALUES (v_referrer,NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles(user_id,role)
  VALUES (NEW.id,'user') ON CONFLICT DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE lower(email)=lower(COALESCE(NEW.email,''))
  ) THEN
    INSERT INTO public.user_roles(user_id,role)
    VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- supabase/migrations/20261003180000_blue_origin_recruit_vip_rules.sql
-- ============================================================
-- BLUE ORIGIN: regras finais de RECRUTA, créditos VIP e recargas
-- 1 MZN pago em recarga = 3 MZN em créditos exclusivos para VIPs.
-- Créditos VIP não entram no saldo levantável.

ALTER TABLE public.deposit_requests
  ALTER COLUMN plan_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.start_task_watch(_task_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_profile record;
  v_recruit_day integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT id, blocked, account_tier, created_at INTO v_profile
  FROM public.profiles WHERE id=v_user;

  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;
  IF _task_index < 1 OR _task_index > 20 THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;

  IF v_profile.account_tier = 'RECRUTA' THEN
    v_recruit_day := v_today - (v_profile.created_at AT TIME ZONE 'Africa/Maputo')::date + 1;
    IF v_recruit_day < 1 OR v_recruit_day > 4 THEN
      RAISE EXCEPTION 'O período de 4 dias do RECRUTA terminou. Ative um VIP para continuar.';
    END IF;
    IF _task_index <> 1 THEN RAISE EXCEPTION 'RECRUTA tem apenas uma tarefa por dia.'; END IF;
  END IF;

  INSERT INTO public.task_watch_sessions(user_id,task_date,task_index,started_at,claimed_at)
  VALUES (v_user,v_today,_task_index,now(),NULL)
  ON CONFLICT (user_id,task_date,task_index)
  DO UPDATE SET started_at = CASE
    WHEN public.task_watch_sessions.claimed_at IS NULL THEN now()
    ELSE public.task_watch_sessions.started_at
  END;

  RETURN jsonb_build_object('ok',true,'startedAt',now(),'minimumSeconds',15);
END;
$$;

REVOKE ALL ON FUNCTION public.start_task_watch(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_task_watch(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_task(_task_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_watch public.task_watch_sessions;
  v_plan record;
  v_profile record;
  v_balance numeric;
  v_recruit_day integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT id, blocked, account_tier, created_at INTO v_profile
  FROM public.profiles WHERE id=v_user;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  SELECT * INTO v_watch
  FROM public.task_watch_sessions
  WHERE user_id=v_user AND task_date=v_today AND task_index=_task_index
  FOR UPDATE;

  IF v_watch.id IS NULL THEN RAISE EXCEPTION 'Primeiro clique em "Assistir agora" e assista ao vídeo.'; END IF;
  IF v_watch.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Tarefa já foi coletada hoje'; END IF;
  IF v_watch.started_at > now() - interval '15 seconds' THEN RAISE EXCEPTION 'É necessário assistir durante pelo menos 15 segundos.'; END IF;

  SELECT up.id, p.daily_task_count, p.task_value INTO v_plan
  FROM public.user_plans up
  JOIN public.plans p ON p.id=up.plan_id
  WHERE up.user_id=v_user AND up.status='ACTIVE'
    AND up.start_date<=v_today AND up.end_date>=v_today
  ORDER BY up.created_at DESC LIMIT 1;

  IF v_plan.id IS NULL THEN
    IF v_profile.account_tier <> 'RECRUTA' THEN RAISE EXCEPTION 'Não possui um VIP ativo'; END IF;

    v_recruit_day := v_today - (v_profile.created_at AT TIME ZONE 'Africa/Maputo')::date + 1;
    IF v_recruit_day < 1 OR v_recruit_day > 4 THEN
      RAISE EXCEPTION 'O período de 4 dias do RECRUTA terminou. Ative um VIP para continuar.';
    END IF;
    IF _task_index <> 1 THEN RAISE EXCEPTION 'RECRUTA tem apenas uma tarefa por dia.'; END IF;
    IF EXISTS (SELECT 1 FROM public.recruit_task_claims WHERE user_id=v_user AND task_date=v_today) THEN
      RAISE EXCEPTION 'A tarefa de hoje já foi coletada.';
    END IF;
    IF (SELECT count(*) FROM public.recruit_task_claims WHERE user_id=v_user) >= 4 THEN
      RAISE EXCEPTION 'As 4 tarefas RECRUTA já foram concluídas.';
    END IF;

    INSERT INTO public.recruit_task_claims(user_id,task_date,task_index,amount)
    VALUES (v_user,v_today,1,5);

    UPDATE public.task_watch_sessions SET claimed_at=now() WHERE id=v_watch.id;

    v_balance := public.apply_ledger(
      v_user,'RECRUIT_TASK_REWARD',5,
      'RECRUIT-TASK-'||v_today,
      'Tarefa RECRUTA concluída — dia '||v_recruit_day||' de 4'
    );

    RETURN jsonb_build_object('balance',v_balance,'amount',5,'recruit',true,'recruitDay',v_recruit_day);
  END IF;

  IF _task_index < 1 OR _task_index > v_plan.daily_task_count THEN RAISE EXCEPTION 'Tarefa inválida'; END IF;

  UPDATE public.task_watch_sessions SET claimed_at=now() WHERE id=v_watch.id;

  INSERT INTO public.task_claims(user_id,user_plan_id,task_date,task_index,amount)
  VALUES (v_user,v_plan.id,v_today,_task_index,v_plan.task_value);

  v_balance := public.apply_ledger(
    v_user,'TASK_REWARD',v_plan.task_value,
    'TASK-'||v_today||'-'||_task_index,
    'Tarefa '||_task_index||' concluída'
  );

  RETURN jsonb_build_object('balance',v_balance,'amount',v_plan.task_value,'recruit',false);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Tarefa já foi coletada hoje';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_task(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_task(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_vip_with_credits(_user_id uuid, _plan_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_plan record;
  v_start date := (now() AT TIME ZONE 'Africa/Maputo')::date;
  v_end date;
  v_new_plan uuid;
  v_reference text := 'VIP-' || _plan_id || '-' || _user_id || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id, balance, promotional_balance, blocked INTO v_profile
  FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_profile.blocked THEN RAISE EXCEPTION 'A sua conta está bloqueada'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id=_plan_id AND active=true;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Este VIP não está disponível'; END IF;
  IF v_profile.promotional_balance < v_plan.price THEN
    RAISE EXCEPTION 'Créditos VIP insuficientes. Necessário: ' || v_plan.price || ' MZN; disponível: ' || v_profile.promotional_balance || ' MZN.';
  END IF;

  v_end := v_start + v_plan.duration_days;

  PERFORM set_config('app.trusted_ledger','on',true);
  UPDATE public.profiles
  SET promotional_balance = promotional_balance - v_plan.price,
      account_tier = CASE WHEN account_tier='RECRUTA' THEN 'USER' ELSE account_tier END
  WHERE id=_user_id;
  PERFORM set_config('app.trusted_ledger','off',true);

  INSERT INTO public.promotional_ledger_transactions(user_id,type,amount,balance_before,balance_after,reference,description)
  VALUES (_user_id,'VIP_PURCHASE',-v_plan.price,v_profile.promotional_balance,v_profile.promotional_balance-v_plan.price,v_reference,'Ativação do '||v_plan.name);

  INSERT INTO public.user_plans(user_id,plan_id,status,start_date,end_date)
  VALUES (_user_id,v_plan.id,'ACTIVE',v_start,v_end) RETURNING id INTO v_new_plan;

  UPDATE public.user_plans SET status='REPLACED'
  WHERE user_id=_user_id AND status='ACTIVE' AND id<>v_new_plan;

  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_user_id,'VIP ativado',v_plan.name||' foi ativado com sucesso até '||to_char(v_end,'DD/MM/YYYY')||'.');

  RETURN jsonb_build_object(
    'planId',v_plan.id,'planName',v_plan.name,'amount',v_plan.price,
    'balance',v_profile.balance,'promotionalBalance',v_profile.promotional_balance-v_plan.price,
    'startDate',v_start,'endDate',v_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vip_with_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_vip_with_credits(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.purchase_plan_with_balances(_user_id uuid, _plan_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.purchase_vip_with_credits(_user_id,_plan_id);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_plan_with_balances(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_plan_with_balances(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.review_recharge_request(_deposit_id uuid,_admin_id uuid,_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit record;
  v_credit numeric;
  v_profile record;
  v_before numeric;
BEGIN
  IF NOT public.has_role(_admin_id,'admin') THEN RAISE EXCEPTION 'Acesso de administrador negado'; END IF;

  SELECT * INTO v_deposit FROM public.deposit_requests WHERE id=_deposit_id FOR UPDATE;
  IF v_deposit.id IS NULL THEN RAISE EXCEPTION 'Recarga não encontrada'; END IF;
  IF v_deposit.status <> 'PENDING' THEN RAISE EXCEPTION 'Pedido já foi processado.'; END IF;

  IF NOT _approve THEN
    UPDATE public.deposit_requests
    SET status='REJECTED',reviewed_at=now(),reviewed_by=_admin_id
    WHERE id=_deposit_id;
    RETURN jsonb_build_object('status','REJECTED','user_id',v_deposit.user_id,'amount',v_deposit.amount,'vip_credit',0);
  END IF;

  v_credit := round(v_deposit.amount*3,2);

  SELECT id,promotional_balance INTO v_profile
  FROM public.profiles WHERE id=v_deposit.user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil do utilizador não encontrado'; END IF;

  v_before := v_profile.promotional_balance;

  PERFORM set_config('app.trusted_ledger','on',true);
  UPDATE public.profiles SET promotional_balance=promotional_balance+v_credit WHERE id=v_deposit.user_id;
  PERFORM set_config('app.trusted_ledger','off',true);

  INSERT INTO public.promotional_ledger_transactions(
    user_id,type,amount,balance_before,balance_after,reference,description
  ) VALUES (
    v_deposit.user_id,'DEPOSIT_VIP_CREDIT',v_credit,v_before,v_before+v_credit,
    'DEPOSIT-VIP-'||v_deposit.id,
    'Crédito VIP por recarga aprovada de '||v_deposit.amount||' MZN'
  );

  UPDATE public.deposit_requests
  SET status='APPROVED',reviewed_at=now(),reviewed_by=_admin_id
  WHERE id=_deposit_id;

  RETURN jsonb_build_object(
    'status','APPROVED','user_id',v_deposit.user_id,'amount',v_deposit.amount,
    'vip_credit',v_credit,'promotional_balance',v_before+v_credit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_recharge_request(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_recharge_request(uuid,uuid,boolean) TO service_role;

INSERT INTO public.notifications(user_id,title,body)
SELECT p.id,'Regras RECRUTA atualizadas','RECRUTA: 1 tarefa de 5 MZN por dia durante 4 dias. Depois, ative um VIP com os seus créditos VIP.'
FROM public.profiles p
WHERE p.account_tier='RECRUTA';


-- ============================================================
-- supabase/migrations/20261003190000_fix_deposit_requests_plan_optional.sql
-- ============================================================
-- Corrige a estrutura da recarga VIP.
-- A recarga não pertence a um VIP específico: após aprovação,
-- o valor é convertido em créditos VIP (valor x3). Por isso plan_id
-- deve permanecer opcional em deposit_requests.
ALTER TABLE public.deposit_requests
  ALTER COLUMN plan_id DROP NOT NULL;



-- 20261004100000_blue_origin_recharge_welcome.sql
INSERT INTO public.site_settings (key, value) VALUES
  ('recharge_min_amount', '200'),
  ('recharge_quick_amounts', '900,3000,10200,30000,200000,500000,1000000,2000000,5000000'),
  ('welcome_title', 'Bem-vindo à BLUE ORIGIN'),
  ('welcome_message', 'Bem-vindo à BLUE ORIGIN. Somos uma plataforma digital de longo prazo, criada para oferecer uma experiência simples, transparente e organizada. Acompanhe as atividades, consulte os seus VIPs e utilize os canais oficiais da plataforma para receber novidades e suporte.'),
  ('welcome_icon_url', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
