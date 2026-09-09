-- =====================================================================
-- Marcenaria Costa — custo do marceneiro e sua margem
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- Precisa do banco-equipe.sql rodado antes.
--
-- Por que uma tabela separada, e não umas colunas a mais no orçamento:
-- o que você paga ao marceneiro e o quanto põe em cima são SEUS, e não
-- da equipe. Numa tabela à parte, com permissão só de admin, o vendedor
-- e o próprio marceneiro nem conseguem pedir esses números ao banco —
-- não é a tela que esconde, é o banco que não entrega.
--
-- E como o custo não mora dentro do orçamento, ele não tem como escapar
-- pelo link que o cliente abre nem pelo PDF. O que o cliente vê é o
-- preço já com a margem, e só.
-- =====================================================================

create table if not exists public.orcamento_custos (
  orcamento_id  uuid primary key references public.orcamentos(id) on delete cascade,

  -- { "<id do móvel>": 18500.00, ... } — o custo unitário de cada móvel
  custos        jsonb not null default '{}'::jsonb,

  -- quanto você põe em cima, em porcentagem
  margem        numeric(5,2) not null default 20 check (margem >= 0 and margem <= 100),

  atualizado_em timestamptz not null default now()
);

alter table public.orcamento_custos enable row level security;

drop policy if exists "custos: so admin le"     on public.orcamento_custos;
drop policy if exists "custos: so admin cria"   on public.orcamento_custos;
drop policy if exists "custos: so admin edita"  on public.orcamento_custos;
drop policy if exists "custos: so admin apaga"  on public.orcamento_custos;

create policy "custos: so admin le"
  on public.orcamento_custos for select to authenticated
  using (public.meu_papel() = 'admin');

create policy "custos: so admin cria"
  on public.orcamento_custos for insert to authenticated
  with check (public.meu_papel() = 'admin');

create policy "custos: so admin edita"
  on public.orcamento_custos for update to authenticated
  using (public.meu_papel() = 'admin');

create policy "custos: so admin apaga"
  on public.orcamento_custos for delete to authenticated
  using (public.meu_papel() = 'admin');

-- carimbo de atualização (a função já existe desde o banco.sql)
drop trigger if exists tg_custos_atualizacao on public.orcamento_custos;
create trigger tg_custos_atualizacao
  before update on public.orcamento_custos
  for each row execute function public.marca_atualizacao();

-- ---------------------------------------------------------------------
-- No histórico entra que a margem mudou — nunca o custo em si.
-- O histórico é lido só pelo admin, mas não custa nada ser cuidadoso:
-- número de custo não precisa ficar espalhado.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'historico') then

    execute $gatilho$
      create or replace function public.historia_custo()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $corpo$
      declare v_num text;
      begin
        if TG_OP = 'UPDATE' and NEW.margem is not distinct from OLD.margem then
          return null;
        end if;

        select lpad(coalesce(o.numero,0)::text, 3, '0') ||
               case when coalesce(o.cliente_nome,'') <> '' then ' · ' || o.cliente_nome else '' end
          into v_num
          from public.orcamentos o where o.id = NEW.orcamento_id;

        perform public.anota('orcamento_margem', 'Orçamento ' || coalesce(v_num, '?'),
                             'margem de ' || NEW.margem || '%', NEW.orcamento_id);
        return null;
      end;
      $corpo$;
    $gatilho$;

    execute 'drop trigger if exists historia on public.orcamento_custos';
    execute 'create trigger historia after insert or update on public.orcamento_custos
             for each row execute function public.historia_custo()';
  end if;
end $$;

-- =====================================================================
-- Pronto. Abra um orçamento e o bloco "Sua conta" aparece no lado —
-- só para você.
-- =====================================================================
