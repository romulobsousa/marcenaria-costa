-- =====================================================================
-- Marcenaria Costa — histórico do que cada um faz
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- Precisa do banco-equipe.sql rodado antes.
--
-- Só o admin lê. E NINGUÉM edita nem apaga — nem você. Um histórico que
-- dá para arrumar depois não serve para nada; é por isso que não existe
-- política de update nem de delete aqui embaixo.
--
-- A maior parte dos registros nasce de gatilhos no próprio banco: se o
-- orçamento mudou, ficou registrado, não importa se foi pelo sistema,
-- pelo celular ou por fora. O que o banco não tem como saber sozinho
-- (entrar, sair, mandar no WhatsApp, baixar o PDF) o sistema registra.
-- =====================================================================

create table if not exists public.historico (
  id        bigserial primary key,
  user_id   uuid references auth.users(id) on delete set null,
  quando    timestamptz not null default now(),
  acao      text not null,
  alvo      text not null default '',   -- "Orçamento 004 · Ana Paula"
  detalhe   text not null default '',   -- "de Rascunho para Enviado"
  alvo_id   uuid
);

create index if not exists historico_quando  on public.historico (quando desc);
create index if not exists historico_pessoa  on public.historico (user_id, quando desc);

alter table public.historico enable row level security;

drop policy if exists "historico: so admin le"      on public.historico;
drop policy if exists "historico: equipe registra"  on public.historico;

-- ler: só o admin
create policy "historico: so admin le"
  on public.historico for select to authenticated
  using (public.meu_papel() = 'admin');

-- escrever: qualquer um da equipe, e só em nome de si mesmo
create policy "historico: equipe registra"
  on public.historico for insert to authenticated
  with check (public.meu_papel() is not null and user_id = auth.uid());

-- (de propósito: nenhuma política de update ou delete)

-- ---------------------------------------------------------------------
-- Quem escreve o histórico pelos gatilhos ignora as políticas acima —
-- por isso "security definer".
-- ---------------------------------------------------------------------
create or replace function public.anota(p_acao text, p_alvo text, p_detalhe text, p_alvo_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.historico (user_id, acao, alvo, detalhe, alvo_id)
  values (auth.uid(), p_acao, coalesce(p_alvo,''), coalesce(p_detalhe,''), p_alvo_id);
$$;

grant execute on function public.anota(text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Orçamentos
-- ---------------------------------------------------------------------
create or replace function public.historia_orcamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao text;
  v_det  text := '';
  v_orc  public.orcamentos;
begin
  v_orc := case when TG_OP = 'DELETE' then OLD else NEW end;

  if TG_OP = 'INSERT' then
    v_acao := 'orcamento_criado';

  elsif TG_OP = 'DELETE' then
    v_acao := 'orcamento_excluido';

  elsif NEW.status is distinct from OLD.status then
    v_acao := 'orcamento_' || NEW.status;
    v_det  := 'de ' || OLD.status || ' para ' || NEW.status;

  elsif NEW.contatos is distinct from OLD.contatos then
    v_acao := 'orcamento_cobrado';
    v_det  := 'cobrança nº ' || NEW.contatos;

  else
    v_acao := 'orcamento_editado';
  end if;

  perform public.anota(
    v_acao,
    'Orçamento ' || lpad(coalesce(v_orc.numero, 0)::text, 3, '0') ||
      case when coalesce(v_orc.cliente_nome,'') <> '' then ' · ' || v_orc.cliente_nome else '' end,
    v_det,
    v_orc.id);

  return null;   -- gatilho AFTER: o retorno não importa
end;
$$;

drop trigger if exists historia on public.orcamentos;
create trigger historia
  after insert or update or delete on public.orcamentos
  for each row execute function public.historia_orcamento();

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------
create or replace function public.historia_visita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao text;
  v_det  text := '';
  v_vis  public.visitas;
begin
  v_vis := case when TG_OP = 'DELETE' then OLD else NEW end;

  if TG_OP = 'INSERT' then
    v_acao := 'visita_criada';
  elsif TG_OP = 'DELETE' then
    v_acao := 'visita_excluida';
  elsif NEW.status is distinct from OLD.status then
    v_acao := 'visita_' || NEW.status;
    v_det  := 'de ' || OLD.status || ' para ' || NEW.status;
  elsif NEW.data is distinct from OLD.data or NEW.hora is distinct from OLD.hora then
    v_acao := 'visita_remarcada';
    v_det  := to_char(OLD.data, 'DD/MM') || ' ' || to_char(OLD.hora, 'HH24:MI') ||
              '  →  ' || to_char(NEW.data, 'DD/MM') || ' ' || to_char(NEW.hora, 'HH24:MI');
  else
    v_acao := 'visita_editada';
  end if;

  perform public.anota(
    v_acao,
    (case v_vis.tipo
       when 'medicao'      then 'Medição'
       when 'apresentacao' then 'Apresentação do projeto'
       when 'montagem'     then 'Montagem'
       when 'entrega'      then 'Entrega'
       when 'assistencia'  then 'Assistência'
       else initcap(v_vis.tipo) end) ||
      case when coalesce(v_vis.cliente_nome,'') <> '' then ' · ' || v_vis.cliente_nome else '' end ||
      '  (' || to_char(v_vis.data, 'DD/MM') || ' ' || to_char(v_vis.hora, 'HH24:MI') || ')',
    v_det,
    v_vis.id);

  return null;
end;
$$;

drop trigger if exists historia on public.visitas;
create trigger historia
  after insert or update or delete on public.visitas
  for each row execute function public.historia_visita();

-- ---------------------------------------------------------------------
-- Equipe — quem liberou quem, e quem virou o quê
-- ---------------------------------------------------------------------
create or replace function public.historia_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao text;
  v_det  text := '';
  v_eq   public.equipe;
begin
  v_eq := case when TG_OP = 'DELETE' then OLD else NEW end;

  if TG_OP = 'INSERT' then
    v_acao := 'equipe_entrou';
    v_det  := 'conta criada, ainda sem acesso';
  elsif TG_OP = 'DELETE' then
    v_acao := 'equipe_removida';
  elsif NEW.ativo is distinct from OLD.ativo then
    v_acao := case when NEW.ativo then 'equipe_liberada' else 'equipe_desligada' end;
    v_det  := 'como ' || NEW.papel;
  elsif NEW.papel is distinct from OLD.papel then
    v_acao := 'equipe_papel';
    v_det  := 'de ' || OLD.papel || ' para ' || NEW.papel;
  else
    return null;             -- mudança que não interessa registrar
  end if;

  perform public.anota(v_acao,
                       coalesce(nullif(v_eq.nome,''), v_eq.email),
                       v_det, v_eq.id);
  return null;
end;
$$;

drop trigger if exists historia on public.equipe;
create trigger historia
  after insert or update or delete on public.equipe
  for each row execute function public.historia_equipe();

-- =====================================================================
-- Pronto. Abra o sistema e vai aparecer a aba Histórico — só para você.
-- =====================================================================
