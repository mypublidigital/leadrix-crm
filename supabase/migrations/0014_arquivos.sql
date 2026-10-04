-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — arquivos da conta                               ║
-- ║                                                                ║
-- ║  Duas categorias:                                              ║
-- ║   • proposta — o que a Leadrix enviou (proposta, business case, ║
-- ║     escopo). Pode ficar ligada a uma oportunidade.             ║
-- ║   • cliente  — o que veio do cliente (briefing, planilha,       ║
-- ║     contrato, material de apoio).                              ║
-- ║                                                                ║
-- ║  O arquivo vai para um bucket PRIVADO; o acesso sai por URL     ║
-- ║  assinada de curta duração. A tabela guarda os metadados.      ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists account_files (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  opportunity_id uuid references account_services(id) on delete set null,
  category       text not null check (category in ('proposta', 'cliente')),
  name           text not null,                 -- nome original, como o usuário vê
  path           text not null unique,          -- caminho no bucket 'documentos'
  mime           text,
  size_bytes     bigint,
  notes          text,
  uploaded_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists account_files_account_idx on account_files (account_id);
create index if not exists account_files_opportunity_idx on account_files (opportunity_id);
create index if not exists account_files_category_idx on account_files (category);

-- Metadados: todo usuário autenticado lê e envia; só administrador apaga,
-- mesma régua da exclusão de oportunidade (não há desfazer).
alter table account_files enable row level security;
drop policy if exists account_files_read on account_files;
drop policy if exists account_files_insert on account_files;
drop policy if exists account_files_update on account_files;
drop policy if exists account_files_delete on account_files;
create policy account_files_read on account_files for select to authenticated using (true);
create policy account_files_insert on account_files for insert to authenticated with check (true);
create policy account_files_update on account_files for update to authenticated using (true) with check (true);
create policy account_files_delete on account_files for delete to authenticated using (crm_is_admin());

-- Bucket privado. 25 MB por arquivo: proposta em PDF e planilha cabem; vídeo
-- não — e vídeo em CRM vira custo de armazenamento sem leitor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists documentos_read on storage.objects;
drop policy if exists documentos_insert on storage.objects;
drop policy if exists documentos_delete on storage.objects;
create policy documentos_read on storage.objects
  for select to authenticated using (bucket_id = 'documentos');
create policy documentos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');
create policy documentos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documentos' and crm_is_admin());
