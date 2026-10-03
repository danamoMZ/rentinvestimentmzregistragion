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
