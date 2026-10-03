-- Corrige a estrutura da recarga VIP.
-- A recarga não pertence a um VIP específico: após aprovação,
-- o valor é convertido em créditos VIP (valor x3). Por isso plan_id
-- deve permanecer opcional em deposit_requests.
ALTER TABLE public.deposit_requests
  ALTER COLUMN plan_id DROP NOT NULL;
