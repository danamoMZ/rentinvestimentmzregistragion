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