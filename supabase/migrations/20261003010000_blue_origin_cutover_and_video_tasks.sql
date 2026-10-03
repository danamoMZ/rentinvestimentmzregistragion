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
