-- =====================================================================
-- Marcenaria Costa — cobrança de resposta nos orçamentos parados
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- =====================================================================

alter table public.orcamentos
  add column if not exists enviado_em     timestamptz,
  add column if not exists ultimo_contato timestamptz,
  add column if not exists contatos       integer not null default 0;

comment on column public.orcamentos.enviado_em     is 'Quando o orçamento foi enviado ao cliente pela primeira vez';
comment on column public.orcamentos.ultimo_contato is 'Última vez que você cobrou uma resposta';
comment on column public.orcamentos.contatos       is 'Quantas vezes você já cobrou';

-- ---------------------------------------------------------------------
-- Carimba a data de envio automaticamente quando o status vira "enviado".
-- Assim a conta de "há quantos dias está parado" nunca depende de você
-- lembrar de preencher nada.
-- ---------------------------------------------------------------------
create or replace function public.marca_envio()
returns trigger language plpgsql as $$
begin
  if new.status = 'enviado' and (old.status is distinct from 'enviado')
     and new.enviado_em is null then
    new.enviado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tg_marca_envio on public.orcamentos;
create trigger tg_marca_envio
  before update on public.orcamentos
  for each row execute function public.marca_envio();

-- mesma coisa para um orçamento que já nasce como "enviado"
create or replace function public.marca_envio_insert()
returns trigger language plpgsql as $$
begin
  if new.status = 'enviado' and new.enviado_em is null then
    new.enviado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tg_marca_envio_insert on public.orcamentos;
create trigger tg_marca_envio_insert
  before insert on public.orcamentos
  for each row execute function public.marca_envio_insert();

-- ---------------------------------------------------------------------
-- Preenche o histórico: orçamentos que já estão como "enviado" mas sem
-- data de envio passam a valer pela data de atualização.
-- ---------------------------------------------------------------------
update public.orcamentos
   set enviado_em = coalesce(atualizado_em, criado_em)
 where status = 'enviado' and enviado_em is null;
