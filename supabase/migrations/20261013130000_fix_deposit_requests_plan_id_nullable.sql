-- BLUE ORIGIN: corrigir envio de recargas sem VIP associado.
-- As recargas adicionam créditos VIP e não pertencem a um plano específico.
-- Seguro para executar mesmo que plan_id já seja opcional.
ALTER TABLE public.deposit_requests
  ALTER COLUMN plan_id DROP NOT NULL;
