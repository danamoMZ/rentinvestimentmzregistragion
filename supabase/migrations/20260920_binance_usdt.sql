-- ============================================================
-- BINANCE + USDT TRC20
-- Configuração segura da integração
-- ============================================================

CREATE TABLE IF NOT EXISTS public.binance_settings (
  id boolean PRIMARY KEY DEFAULT true,

  enabled boolean NOT NULL DEFAULT false,
  automatic_withdrawals boolean NOT NULL DEFAULT false,

  asset text NOT NULL DEFAULT 'USDT',
  network text NOT NULL DEFAULT 'TRC20',

  api_configured boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT binance_settings_single_row
    CHECK (id = true),

  CONSTRAINT binance_settings_asset_check
    CHECK (asset = 'USDT'),

  CONSTRAINT binance_settings_network_check
    CHECK (network = 'TRC20')
);

INSERT INTO public.binance_settings (
  id,
  enabled,
  automatic_withdrawals,
  asset,
  network,
  api_configured
)
VALUES (
  true,
  false,
  false,
  'USDT',
  'TRC20',
  false
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- CONTROLO DE PROCESSAMENTO DOS SAQUES BINANCE
-- ============================================================

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_withdrawal_id text;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_client_id text;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS binance_response jsonb;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE public.usdt_withdrawals
  ADD COLUMN IF NOT EXISTS failure_reason text;


-- Impede que o mesmo pedido seja associado
-- a mais de uma operação Binance.
CREATE UNIQUE INDEX IF NOT EXISTS
  usdt_withdrawals_binance_withdrawal_id_unique
ON public.usdt_withdrawals (binance_withdrawal_id)
WHERE binance_withdrawal_id IS NOT NULL;


-- Identificador interno único para cada tentativa.
CREATE UNIQUE INDEX IF NOT EXISTS
  usdt_withdrawals_binance_client_id_unique
ON public.usdt_withdrawals (binance_client_id)
WHERE binance_client_id IS NOT NULL;


-- ============================================================
-- EVENTOS BINANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.binance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  withdrawal_id uuid
    REFERENCES public.usdt_withdrawals(id)
    ON DELETE SET NULL,

  event_type text NOT NULL,

  binance_withdrawal_id text,
  client_id text,

  amount_usdt numeric(20,8),
  network text,
  address text,
  txid text,

  status text,
  message text,

  response jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  binance_events_withdrawal_id_idx
ON public.binance_events (withdrawal_id);

CREATE INDEX IF NOT EXISTS
  binance_events_binance_id_idx
ON public.binance_events (binance_withdrawal_id);

CREATE INDEX IF NOT EXISTS
  binance_events_created_at_idx
ON public.binance_events (created_at DESC);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.binance_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.binance_events ENABLE ROW LEVEL SECURITY;


-- O utilizador normal não pode alterar configurações Binance.
DROP POLICY IF EXISTS
  "binance_settings_admin_select"
ON public.binance_settings;

CREATE POLICY
  "binance_settings_admin_select"
ON public.binance_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);


DROP POLICY IF EXISTS
  "binance_events_admin_select"
ON public.binance_events;

CREATE POLICY
  "binance_events_admin_select"
ON public.binance_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);


-- Apenas service_role poderá inserir/alterar
-- estas informações através do servidor.
REVOKE ALL ON TABLE public.binance_settings
FROM anon, authenticated;

REVOKE ALL ON TABLE public.binance_events
FROM anon, authenticated;


GRANT SELECT ON TABLE public.binance_settings
TO authenticated;

GRANT SELECT ON TABLE public.binance_events
TO authenticated;
