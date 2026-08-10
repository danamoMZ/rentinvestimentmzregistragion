
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
