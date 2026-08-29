-- =====================================================================
-- Marcenaria Costa — banco dos orçamentos
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Roda uma vez só. Rodar de novo não quebra nada.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tabela principal
-- ---------------------------------------------------------------------
create table if not exists public.orcamentos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  numero          integer not null,

  cliente_nome     text not null default '',
  cliente_telefone text not null default '',
  cliente_email    text not null default '',
  cliente_endereco text not null default '',

  -- [{ "descricao": "...", "detalhes": "...", "qtd": 1, "valor": 0 }]
  itens           jsonb not null default '[]'::jsonb,

  desconto        numeric(12,2) not null default 0,
  prazo_entrega   text not null default '',
  forma_pagamento text not null default '',
  observacoes     text not null default '',
  validade_dias   integer not null default 15,

  status          text not null default 'rascunho'
                  check (status in ('rascunho','enviado','aprovado','recusado')),

  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  unique (user_id, numero)
);

create index if not exists orcamentos_user_criado_idx
  on public.orcamentos (user_id, criado_em desc);

-- ---------------------------------------------------------------------
-- Numeração automática por usuário (001, 002, 003…)
-- ---------------------------------------------------------------------
create or replace function public.proximo_numero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero
      from public.orcamentos where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_proximo_numero on public.orcamentos;
create trigger tg_proximo_numero
  before insert on public.orcamentos
  for each row execute function public.proximo_numero();

-- ---------------------------------------------------------------------
-- Carimbo de atualização
-- ---------------------------------------------------------------------
create or replace function public.marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists tg_marca_atualizacao on public.orcamentos;
create trigger tg_marca_atualizacao
  before update on public.orcamentos
  for each row execute function public.marca_atualizacao();

-- ---------------------------------------------------------------------
-- SEGURANÇA (RLS) — cada usuário só enxerga o que é dele.
-- É isto que protege seus dados, não a chave pública do site.
-- ---------------------------------------------------------------------
alter table public.orcamentos enable row level security;

drop policy if exists "le os proprios"    on public.orcamentos;
drop policy if exists "cria os proprios"  on public.orcamentos;
drop policy if exists "edita os proprios" on public.orcamentos;
drop policy if exists "apaga os proprios" on public.orcamentos;

create policy "le os proprios"
  on public.orcamentos for select
  using (auth.uid() = user_id);

create policy "cria os proprios"
  on public.orcamentos for insert
  with check (auth.uid() = user_id);

create policy "edita os proprios"
  on public.orcamentos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "apaga os proprios"
  on public.orcamentos for delete
  using (auth.uid() = user_id);
