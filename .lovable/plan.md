# BLUE ORIGIN: nova identidade e regras RECRUTA

## Resultado
- Substituir a marca visível RENT INVESTIMENT por BLUE ORIGIN em toda a aplicação, notificações, metadados e instalação no telefone.
- Aplicar a direção Astro-tech escolhida, totalmente em português, valores em MZN e alternância persistente entre modo claro e escuro.
- Usar a pena azul enviada como logótipo, ícone e animação de carregamento; mostrar seta de voltar nas páginas internas.
- Atualizar os 11 planos com nomes de máquinas/projetos BLUE ORIGIN e as fotografias enviadas. Como foram enviadas 9 fotografias para 11 planos, duas serão reutilizadas com enquadramentos diferentes.

## Conta RECRUTA
- Novos utilizadores entram com o cargo visível **RECRUTA**.
- O saldo levantável começa em **0 MZN**.
- Uma carteira promocional separada começa com **200 MZN**, utilizável somente para comprar planos.
- O cadastro continua com quatro campos: nome, telefone, palavra-passe e convite opcional, entrando diretamente após criar a conta.
- Contas e saldos existentes não serão apagados nem convertidos.

## Tarefas e levantamentos
- RECRUTA sem plano ativo recebe 4 tarefas por dia, de 5 MZN cada, controladas pela data oficial de Maputo.
- Ganhos das tarefas entram no saldo levantável.
- O primeiro levantamento de um RECRUTA aceita o mínimo de 20 MZN; depois do primeiro levantamento aprovado, o mínimo passa a 150 MZN.
- A taxa permanece em 10% e o máximo permanece em 18.000 MZN.
- As regras serão verificadas no servidor; um pedido manipulado no navegador será recusado.

## Implementação técnica
- Criar saldo promocional separado e estado de RECRUTA no perfil, mantendo papéis administrativos na tabela protegida de permissões.
- Atualizar atomicamente cadastro, compra de plano e tarefas para evitar crédito duplicado ou gasto indevido.
- A compra usará primeiro o crédito promocional e depois o saldo normal quando necessário; o crédito promocional nunca entra no cálculo de saque.
- Atualizar catálogo, imagens, painel, carteira, tarefas, autenticação, menu e páginas administrativas sem alterar URLs existentes.
- Adicionar metadados próprios às páginas de conteúdo e validar os fluxos principais em ecrãs grandes e pequenos.

## Validação
- Conferir cadastro RECRUTA, separação dos dois saldos, quatro tarefas, compra com crédito promocional e mínimos de levantamento.
- Conferir botões, destinos, modo claro/escuro, animação de carregamento, logótipo, nomes e fotos dos 11 planos.
- Executar verificação de tipos, compilação e teste visual das páginas principais antes de concluir.
