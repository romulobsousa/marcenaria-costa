-- =====================================================================
-- Marcenaria Costa — documento do cliente, para o contrato
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
--
-- Contrato sem CPF não identifica ninguém. O campo fica no orçamento
-- porque é lá que o cliente já mora — e só é obrigatório na hora de
-- gerar o contrato, não no orçamento.
-- =====================================================================

alter table public.orcamentos
  add column if not exists cliente_documento text not null default '';

-- Quando o contrato foi gerado. Serve para a tela avisar "esse já tem
-- contrato" e para o histórico, não para travar nada.
alter table public.orcamentos
  add column if not exists contrato_em timestamptz;
