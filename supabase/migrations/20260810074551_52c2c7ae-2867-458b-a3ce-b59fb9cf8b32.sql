
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
