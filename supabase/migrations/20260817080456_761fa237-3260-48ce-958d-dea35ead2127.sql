REVOKE ALL ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_profile_update_security() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_task(integer) TO authenticated;