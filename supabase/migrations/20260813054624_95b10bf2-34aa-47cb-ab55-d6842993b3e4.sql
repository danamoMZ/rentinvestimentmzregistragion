-- Revogar acesso público padrão (anon) e autenticado (authenticated) para as funções SECURITY DEFINER
-- Elas serão chamadas apenas quando explicitamente permitido por GRANT

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_task(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_task(int) FROM authenticated;

-- Garantir que as funções possam ser executadas pelos administradores (authenticated com papel admin)
-- Ou conforme a lógica interna de cada função (SECURITY DEFINER já cuida do acesso interno)

-- Re-conceder acesso apenas para 'authenticated' onde for necessário para o funcionamento do app
-- claim_task é necessária para usuários comuns, mas as outras são internas ou administrativas.
GRANT EXECUTE ON FUNCTION public.claim_task(int) TO authenticated;

-- has_role é usada em RLS, mas se for SECURITY DEFINER e chamada por outras funções, 
-- talvez não precise de GRANT direto para o usuário, mas vamos manter o necessário para o frontend.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- apply_ledger NÃO deve ser executada diretamente por usuários autenticados (risco de fraude)
-- deve ser chamada apenas internamente por outras funções SECURITY DEFINER (como claim_task)
-- ou pelo service_role.
GRANT EXECUTE ON FUNCTION public.apply_ledger(uuid, text, numeric, text, text) TO service_role;
