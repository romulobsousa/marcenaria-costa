-- =====================================================================
-- Marcenaria Costa — equipe e permissões
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
--
-- O que muda: até agora cada conta só enxergava o que ela mesma criou.
-- A partir daqui os orçamentos e a agenda são da MARCENARIA, e o que
-- separa as pessoas é o papel de cada uma:
--
--   admin       faz tudo, e é o único que mexe na equipe
--   marceneiro  faz tudo, menos mexer na equipe
--   vendedor    cria, edita e envia — mas não apaga nada
--   montador    só a agenda: vê as visitas e marca o que já foi feito
--
-- Quem entra e ainda não tem papel definido não vê nada e aparece para
-- você na tela Equipe, esperando liberação. É de propósito: conta nova
-- não nasce com acesso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quem é quem
-- ---------------------------------------------------------------------
create table if not exists public.equipe (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text not null default '',
  papel      text not null default 'montador'
             check (papel in ('admin','marceneiro','vendedor','montador')),
  ativo      boolean not null default false,
  criado_em  timestamptz not null default now()
);

alter table public.equipe enable row level security;

-- ---------------------------------------------------------------------
-- Duas perguntas que o sistema faz o tempo todo
-- Ficam como "security definer" para não cair em recursão de permissão:
-- ler a tabela equipe depende da equipe.
-- ---------------------------------------------------------------------
create or replace function public.meu_papel()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select papel from public.equipe
   where id = auth.uid() and ativo
   limit 1;
$$;

-- devolve o cadastro de quem está logado, mesmo que ainda não liberado —
-- é assim que a tela sabe dizer "sua conta está esperando liberação"
create or replace function public.meu_acesso()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'id',    e.id,
    'nome',  e.nome,
    'email', e.email,
    'papel', e.papel,
    'ativo', e.ativo
  )
  from public.equipe e
  where e.id = auth.uid()
  limit 1;
$$;

grant execute on function public.meu_papel()  to authenticated;
grant execute on function public.meu_acesso() to authenticated;

-- ---------------------------------------------------------------------
-- Conta nova entra sozinha na lista, sem acesso, esperando você liberar
-- ---------------------------------------------------------------------
create or replace function public.equipe_ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.equipe (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    'montador',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.equipe_ao_criar_usuario();

-- ---------------------------------------------------------------------
-- Quem já existe entra como admin — é você, dono da conta
-- (rode este arquivo ANTES de criar as contas novas)
-- ---------------------------------------------------------------------
-- a conta mais antiga (a primeira que você criou) vira admin; qualquer
-- outra que já exista entra sem acesso, esperando você liberar na tela
insert into public.equipe (id, nome, email, papel, ativo)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
       coalesce(u.email, ''),
       case when u.created_at = (select min(created_at) from auth.users)
            then 'admin' else 'montador' end,
       u.created_at = (select min(created_at) from auth.users)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Permissões da própria lista de equipe
-- ---------------------------------------------------------------------
drop policy if exists "equipe: a turma toda se ve"   on public.equipe;
drop policy if exists "equipe: so admin cadastra"    on public.equipe;
drop policy if exists "equipe: so admin altera"      on public.equipe;
drop policy if exists "equipe: so admin remove"      on public.equipe;

create policy "equipe: a turma toda se ve"
  on public.equipe for select to authenticated
  using (public.meu_papel() is not null);

create policy "equipe: so admin cadastra"
  on public.equipe for insert to authenticated
  with check (public.meu_papel() = 'admin');

create policy "equipe: so admin altera"
  on public.equipe for update to authenticated
  using (public.meu_papel() = 'admin');

create policy "equipe: so admin remove"
  on public.equipe for delete to authenticated
  using (public.meu_papel() = 'admin' and id <> auth.uid());  -- ninguém se apaga

-- ---------------------------------------------------------------------
-- Orçamentos: da marcenaria, não de quem digitou
-- ---------------------------------------------------------------------
-- tira as regras antigas (as de "cada um vê o seu"), quaisquer que sejam
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'orcamentos'
  loop
    execute format('drop policy %I on public.orcamentos', r.policyname);
  end loop;
end $$;

create policy "orcamentos: equipe le"
  on public.orcamentos for select to authenticated
  using (public.meu_papel() in ('admin','marceneiro','vendedor'));

create policy "orcamentos: equipe cria"
  on public.orcamentos for insert to authenticated
  with check (public.meu_papel() in ('admin','marceneiro','vendedor')
              and user_id = auth.uid());

create policy "orcamentos: equipe edita"
  on public.orcamentos for update to authenticated
  using (public.meu_papel() in ('admin','marceneiro','vendedor'));

-- apagar é definitivo: só admin e marceneiro
create policy "orcamentos: so chefia apaga"
  on public.orcamentos for delete to authenticated
  using (public.meu_papel() in ('admin','marceneiro'));

-- ---------------------------------------------------------------------
-- Agenda: todo mundo da equipe enxerga, inclusive o montador
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'visitas'
  loop
    execute format('drop policy %I on public.visitas', r.policyname);
  end loop;
end $$;

create policy "visitas: equipe le"
  on public.visitas for select to authenticated
  using (public.meu_papel() is not null);

create policy "visitas: equipe marca"
  on public.visitas for insert to authenticated
  with check (public.meu_papel() in ('admin','marceneiro','vendedor')
              and user_id = auth.uid());

-- o montador também edita: é assim que ele marca a visita como realizada
create policy "visitas: equipe edita"
  on public.visitas for update to authenticated
  using (public.meu_papel() is not null);

create policy "visitas: so chefia apaga"
  on public.visitas for delete to authenticated
  using (public.meu_papel() in ('admin','marceneiro'));

-- ---------------------------------------------------------------------
-- PDFs: qualquer um da equipe pode subir o PDF de um orçamento
-- (antes cada um só escrevia na própria pasta; com a lista compartilhada
--  o vendedor precisa conseguir reenviar um orçamento que outro criou)
-- ---------------------------------------------------------------------
drop policy if exists "dono envia os pdfs"     on storage.objects;
drop policy if exists "dono atualiza os pdfs"  on storage.objects;
drop policy if exists "dono apaga os pdfs"     on storage.objects;
drop policy if exists "equipe envia os pdfs"   on storage.objects;
drop policy if exists "equipe atualiza os pdfs" on storage.objects;
drop policy if exists "chefia apaga os pdfs"   on storage.objects;

create policy "equipe envia os pdfs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'orcamentos' and public.meu_papel() is not null);

create policy "equipe atualiza os pdfs"
  on storage.objects for update to authenticated
  using (bucket_id = 'orcamentos' and public.meu_papel() is not null);

create policy "chefia apaga os pdfs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'orcamentos' and public.meu_papel() in ('admin','marceneiro'));

-- =====================================================================
-- Depois de rodar isto:
--   1. Authentication → Users → Add user, para cada pessoa da equipe
--      (marque "Auto Confirm User")
--   2. Entre no sistema e vá em Equipe: a pessoa aparece esperando
--      liberação. Escolha o papel e ligue o acesso.
-- =====================================================================
