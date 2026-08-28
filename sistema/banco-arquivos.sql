-- =====================================================================
-- Marcenaria Costa — guarda dos PDFs de orçamento
-- Cole no SQL Editor do Supabase e clique em RUN. Roda uma vez só.
-- =====================================================================

-- Espaço onde o PDF de cada orçamento fica guardado.
-- É "público" no sentido de que o link abre sem senha — é isso que
-- permite o cliente abrir o PDF pelo WhatsApp. O caminho do arquivo
-- inclui o id do orçamento (um UUID), então ninguém descobre o link
-- de outro cliente por tentativa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('orcamentos', 'orcamentos', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- ---------------------------------------------------------------------
-- Quem pode fazer o quê
-- ---------------------------------------------------------------------
drop policy if exists "qualquer um le os pdfs"  on storage.objects;
drop policy if exists "dono envia os pdfs"      on storage.objects;
drop policy if exists "dono atualiza os pdfs"   on storage.objects;
drop policy if exists "dono apaga os pdfs"      on storage.objects;

-- leitura: aberta, para o link funcionar no WhatsApp do cliente
create policy "qualquer um le os pdfs"
  on storage.objects for select
  using (bucket_id = 'orcamentos');

-- gravação: só você, e só dentro da sua própria pasta
create policy "dono envia os pdfs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'orcamentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "dono atualiza os pdfs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'orcamentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "dono apaga os pdfs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'orcamentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
