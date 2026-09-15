-- =====================================================================
-- Marcenaria Costa — faturamento e limpeza da tela
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
--
-- Duas colunas novas no orçamento:
--
--   aprovado_em   quando o cliente fechou. Sem isso o faturamento do mês
--                 sairia errado: um orçamento feito em janeiro e aprovado
--                 em março contaria em janeiro, que é quando ele nasceu.
--
--   arquivado_em  quando você tirou ele da tela inicial. NÃO é exclusão:
--                 o orçamento continua na lista, inteiro. Só para de
--                 atrapalhar a visão do que ainda está vivo.
-- =====================================================================

alter table public.orcamentos add column if not exists aprovado_em  timestamptz;
alter table public.orcamentos add column if not exists arquivado_em timestamptz;

create index if not exists orcamentos_aprovado_em on public.orcamentos (aprovado_em desc);

-- ---------------------------------------------------------------------
-- Carimbos automáticos
-- ---------------------------------------------------------------------
create or replace function public.marca_fechamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'aprovado' then
      NEW.aprovado_em := coalesce(NEW.aprovado_em, now());
    end if;
    return NEW;
  end if;

  -- virou aprovado agora: carimba a data do fechamento
  if NEW.status = 'aprovado' and OLD.status is distinct from 'aprovado' then
    NEW.aprovado_em := coalesce(NEW.aprovado_em, now());
  end if;

  -- deixou de ser aprovado: sai do faturamento, sem deixar rastro errado
  if NEW.status <> 'aprovado' then
    NEW.aprovado_em := null;
  end if;

  -- mexeu na situação: o orçamento voltou a ser assunto, então volta
  -- para a tela inicial mesmo que estivesse arquivado
  if NEW.status is distinct from OLD.status then
    NEW.arquivado_em := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists tg_orcamentos_fechamento on public.orcamentos;
create trigger tg_orcamentos_fechamento
  before insert or update on public.orcamentos
  for each row execute function public.marca_fechamento();

-- ---------------------------------------------------------------------
-- Os que já estão aprovados ganham a data que der para saber hoje:
-- a da última mexida. Não é exata para os antigos, mas é o mais perto
-- da verdade que existe — daqui para frente sai certa.
-- ---------------------------------------------------------------------
update public.orcamentos
   set aprovado_em = coalesce(atualizado_em, criado_em)
 where status = 'aprovado'
   and aprovado_em is null;

-- =====================================================================
-- Pronto. Na tela inicial aparece o faturamento (mês, mês passado e
-- geral) e o botão "Limpar a tela".
-- =====================================================================
