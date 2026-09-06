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