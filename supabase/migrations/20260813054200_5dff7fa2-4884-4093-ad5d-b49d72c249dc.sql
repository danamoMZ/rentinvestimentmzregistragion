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