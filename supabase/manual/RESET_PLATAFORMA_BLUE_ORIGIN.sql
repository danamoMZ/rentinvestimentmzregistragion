-- RESET MANUAL DA PLATAFORMA BLUE ORIGIN
-- ATENÇÃO: destrutivo. Execute uma única vez no SQL Editor do Supabase depois de fazer backup.
-- Objetivo: remover contas de utilizadores antigos e os dados financeiros associados,
-- preservando as contas marcadas como admin.
--
-- O projeto não tem uma conexão Supabase administrativa disponível nesta conversa,
-- portanto este script NÃO é executado automaticamente pelo assistente.

BEGIN;

-- Remove contas antigas não administrativas.
-- public.user_roles usa ON DELETE CASCADE em relação a auth.users no esquema atual.
DELETE FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = u.id
    AND ur.role = 'admin'
);

-- Zera saldos dos administradores sem remover o acesso administrativo.
UPDATE public.profiles
SET balance = 0,
    promotional_balance = 0,
    account_tier = 'USER',
    platform_version = 2
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- Reinicia o catálogo e conteúdos básicos da nova versão.
UPDATE public.plans
SET name = 'VIP ' || id,
    active = true
WHERE id BETWEEN 1 AND 11;

COMMIT;

-- NOTA:
-- Se alguma tabela personalizada tiver uma FK sem ON DELETE CASCADE,
-- o DELETE de auth.users será interrompido pelo PostgreSQL. Nesse caso,
-- corrija a FK para ON DELETE CASCADE ou remova os registos dependentes
-- antes de repetir o corte. O Supabase recomenda CASCADE para tabelas
-- próprias ligadas a auth.users.
