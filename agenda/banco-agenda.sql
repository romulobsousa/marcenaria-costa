-- =====================================================================
-- Marcenaria Costa — agenda de visitas
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- (O banco.sql dos orçamentos precisa já ter rodado antes.)
-- =====================================================================

create table if not exists public.visitas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  cliente_nome     text not null default '',
  cliente_telefone text not null default '',
  endereco         text not null default '',

  data          date not null,
  hora          time not null default '09:00',
  duracao_min   integer not null default 60,

  tipo          text not null default 'medicao'
                check (tipo in ('medicao','apresentacao','montagem','entrega','assistencia')),

  observacoes   text not null default '',

  status        text not null default 'agendada'
                check (status in ('agendada','confirmada','realizada','cancelada')),

  -- liga a visita ao orçamento que nasceu dela (opcional)
  orcamento_id  uuid references public.orcamentos(id) on delete set null,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists visitas_user_data_idx
  on public.visitas (user_id, data, hora);

-- carimbo de atualização
drop trigger if exists tg_visitas_atualizacao on public.visitas;
create trigger tg_visitas_atualizacao
  before update on public.visitas
  for each row execute function public.marca_atualizacao();

-- ---------------------------------------------------------------------
-- SEGURANÇA (RLS) — cada usuário só enxerga as próprias visitas
-- ---------------------------------------------------------------------
alter table public.visitas enable row level security;

drop policy if exists "le as proprias"    on public.visitas;
drop policy if exists "cria as proprias"  on public.visitas;
drop policy if exists "edita as proprias" on public.visitas;
drop policy if exists "apaga as proprias" on public.visitas;

create policy "le as proprias"
  on public.visitas for select using (auth.uid() = user_id);

create policy "cria as proprias"
  on public.visitas for insert with check (auth.uid() = user_id);

create policy "edita as proprias"
  on public.visitas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "apaga as proprias"
  on public.visitas for delete using (auth.uid() = user_id);
