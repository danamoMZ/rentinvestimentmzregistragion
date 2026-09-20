-- ============================================================
-- USDT TRC20
-- Migration 12
-- ============================================================

-- Configurações do gateway USDT
CREATE TABLE IF NOT EXISTS public.usdt_settings (
  id boolean PRIMARY KEY DEFAULT true,

  network text NOT NULL DEFAULT 'TRC20',
  symbol text NOT NULL DEFAULT 'USDT',

  deposit_address text NOT NULL DEFAULT '',
  withdrawal_enabled boolean NOT NULL DEFAULT true,
  deposit_enabled boolean NOT NULL DEFAULT true,

  -- Quantos MZN correspondem a 1 USDT.
  usdt_mzn_rate numeric(14,4) NOT NULL DEFAULT 0,

  min_deposit_usdt numeric(14,6) NOT NULL DEFAULT 1,
  min_withdrawal_usdt numeric(14,6) NOT NULL DEFAULT 1,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_settings_single_row
    CHECK (id = true),

  CONSTRAINT usdt_rate_positive
    CHECK (usdt_mzn_rate >= 0),

  CONSTRAINT usdt_min_deposit_positive
    CHECK (min_deposit_usdt > 0),

  CONSTRAINT usdt_min_withdrawal_positive
    CHECK (min_withdrawal_usdt > 0)
);

GRANT SELECT ON public.usdt_settings TO anon, authenticated;
GRANT ALL ON public.usdt_settings TO service_role;

ALTER TABLE public.usdt_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read usdt settings"
ON public.usdt_settings;

CREATE POLICY "public read usdt settings"
ON public.usdt_settings
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================
-- DEPÓSITOS USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  network text NOT NULL DEFAULT 'TRC20',
  token text NOT NULL DEFAULT 'USDT',

  deposit_address text NOT NULL,

  txid text NOT NULL UNIQUE,

  sender_address text,
  recipient_address text,

  amount_usdt numeric(18,6) NOT NULL,

  exchange_rate numeric(14,4) NOT NULL,

  amount_mzn numeric(14,2) NOT NULL,

  confirmations integer NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'PENDING',

  ledger_reference text UNIQUE,

  detected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  credited_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_deposits_amount_positive
    CHECK (amount_usdt > 0),

  CONSTRAINT usdt_deposits_rate_positive
    CHECK (exchange_rate > 0),

  CONSTRAINT usdt_deposits_mzn_positive
    CHECK (amount_mzn > 0),

  CONSTRAINT usdt_deposits_status_check
    CHECK (
      status IN (
        'PENDING',
        'CONFIRMED',
        'CREDITED',
        'REJECTED'
      )
    )
);

GRANT SELECT ON public.usdt_deposits TO authenticated;
GRANT ALL ON public.usdt_deposits TO service_role;

ALTER TABLE public.usdt_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own usdt deposits"
ON public.usdt_deposits;

CREATE POLICY "read own usdt deposits"
ON public.usdt_deposits
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_user
ON public.usdt_deposits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_status
ON public.usdt_deposits(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_deposits_txid
ON public.usdt_deposits(txid);


-- ============================================================
-- SAQUES USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  network text NOT NULL DEFAULT 'TRC20',
  token text NOT NULL DEFAULT 'USDT',

  destination_address text NOT NULL,

  amount_mzn numeric(14,2) NOT NULL,
  exchange_rate numeric(14,4) NOT NULL,
  amount_usdt numeric(18,6) NOT NULL,

  fee_mzn numeric(14,2) NOT NULL DEFAULT 0,
  net_amount_mzn numeric(14,2) NOT NULL,

  txid text UNIQUE,

  status text NOT NULL DEFAULT 'PENDING',

  admin_id uuid,
  admin_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usdt_withdrawals_amount_positive
    CHECK (amount_mzn > 0),

  CONSTRAINT usdt_withdrawals_rate_positive
    CHECK (exchange_rate > 0),

  CONSTRAINT usdt_withdrawals_usdt_positive
    CHECK (amount_usdt > 0),

  CONSTRAINT usdt_withdrawals_fee_nonnegative
    CHECK (fee_mzn >= 0),

  CONSTRAINT usdt_withdrawals_net_positive
    CHECK (net_amount_mzn > 0),

  CONSTRAINT usdt_withdrawals_status_check
    CHECK (
      status IN (
        'PENDING',
        'APPROVED',
        'PROCESSING',
        'SENT',
        'COMPLETED',
        'REJECTED',
        'FAILED'
      )
    )
);

GRANT SELECT ON public.usdt_withdrawals TO authenticated;
GRANT ALL ON public.usdt_withdrawals TO service_role;

ALTER TABLE public.usdt_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own usdt withdrawals"
ON public.usdt_withdrawals;

CREATE POLICY "read own usdt withdrawals"
ON public.usdt_withdrawals
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_user
ON public.usdt_withdrawals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_status
ON public.usdt_withdrawals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_txid
ON public.usdt_withdrawals(txid);


-- ============================================================
-- AUDITORIA DE OPERAÇÕES USDT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usdt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL,

  user_id uuid,

  deposit_id uuid
    REFERENCES public.usdt_deposits(id)
    ON DELETE SET NULL,

  withdrawal_id uuid
    REFERENCES public.usdt_withdrawals(id)
    ON DELETE SET NULL,

  txid text,

  amount_usdt numeric(18,6),
  amount_mzn numeric(14,2),

  message text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.usdt_events TO authenticated;
GRANT ALL ON public.usdt_events TO service_role;

ALTER TABLE public.usdt_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read usdt events"
ON public.usdt_events;

CREATE POLICY "admins read usdt events"
ON public.usdt_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_usdt_events_created
ON public.usdt_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdt_events_txid
ON public.usdt_events(txid);


-- ============================================================
-- CONFIGURAÇÃO INICIAL
-- ============================================================

INSERT INTO public.usdt_settings (
  id,
  network,
  symbol,
  deposit_address,
  withdrawal_enabled,
  deposit_enabled,
  usdt_mzn_rate,
  min_deposit_usdt,
  min_withdrawal_usdt
)
VALUES (
  true,
  'TRC20',
  'USDT',
  '',
  false,
  false,
  0,
  1,
  1
)
ON CONFLICT (id) DO NOTHING;
