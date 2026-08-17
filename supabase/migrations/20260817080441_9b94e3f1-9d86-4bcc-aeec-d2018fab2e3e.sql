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