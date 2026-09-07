-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Pré-CRM / Captura de leads em eventos (reunião 13/07).        ║
-- ║  Foto (cartão de visita, tela de contato, crachá) → IA extrai ║
-- ║  nome/empresa/e-mail/telefone → pré-base → promover a Conta.   ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists pre_leads (
  id                   uuid primary key default gen_random_uuid(),
  photo_path           text,                         -- caminho no bucket 'captures'
  status               text not null default 'novo'  -- novo | promovido | descartado
    check (status in ('novo', 'promovido', 'descartado')),
  name                 text,
  company              text,
  role                 text,
  email                text,
  phone                text,
  notes                text,
  raw_extraction       jsonb,                        -- resposta bruta da IA
  promoted_account_id  uuid references accounts(id) on delete set null,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists pre_leads_status_idx on pre_leads (status);

alter table pre_leads enable row level security;
drop policy if exists pre_leads_auth_all on pre_leads;
create policy pre_leads_auth_all on pre_leads
  for all to authenticated using (true) with check (true);

-- Bucket privado para as fotos capturadas.
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

-- Leitura das fotos por usuários autenticados (exibição via signed URL).
drop policy if exists captures_read on storage.objects;
create policy captures_read on storage.objects
  for select to authenticated using (bucket_id = 'captures');
