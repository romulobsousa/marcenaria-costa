-- =====================================================================
-- Marcenaria Costa — prazo de entrega dos serviços aprovados
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- Precisa do banco-faturamento.sql rodado antes.
--
-- Hoje o prazo é um texto ("35 dias úteis após a aprovação"). Texto é
-- ótimo para o cliente ler no PDF e péssimo para o sistema contar os
-- dias. Então entra uma DATA de verdade ao lado dele:
--
--   entrega_em    até quando ficou combinado entregar
--   entregue_em   quando entregou de fato
--
-- O texto continua mandando no que o cliente lê. A data é só para a
-- tela inicial saber o que está no prazo, o que está esgotando e o que
-- estourou.
--
-- Repare que o orçamento entregue continua "aprovado": entregar não
-- desfaz a venda, então ele segue contando no faturamento. Só sai da
-- lista de entregas.
-- =====================================================================

alter table public.orcamentos add column if not exists entrega_em  date;
alter table public.orcamentos add column if not exists entregue_em date;

create index if not exists orcamentos_entrega_em
  on public.orcamentos (entrega_em)
  where entregue_em is null;

-- ---------------------------------------------------------------------
-- Desaprovou? Some o combinado de entrega junto — senão fica um prazo
-- correndo para um serviço que não existe mais.
-- ---------------------------------------------------------------------
create or replace function public.limpa_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and NEW.status <> 'aprovado' and OLD.status = 'aprovado' then
    NEW.entrega_em  := null;
    NEW.entregue_em := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tg_orcamentos_entrega on public.orcamentos;
create trigger tg_orcamentos_entrega
  before update on public.orcamentos
  for each row execute function public.limpa_entrega();

-- =====================================================================
-- Pronto. Abra um orçamento aprovado: no bloco Condições aparece
-- "Entregar até". Na tela inicial nasce o quadro "Entregas combinadas".
-- =====================================================================
