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