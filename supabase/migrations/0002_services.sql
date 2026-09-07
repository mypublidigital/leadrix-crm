-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Módulo de Serviços + Serviços de interesse do lead           ║
-- ║  (visão financeira do pipeline)                                ║
-- ╚══════════════════════════════════════════════════════════════╝

do $$ begin
  create type interest_level as enum ('explorando','interessado','proposto','ganho','perdido');
exception when duplicate_object then null; end $$;

-- ── services (catálogo, espelha a taxonomia §10 do operacional) ──
create table if not exists services (
  id                  uuid primary key default gen_random_uuid(),
  macro_id            text not null,   -- ex.: 'banking-conta-digital'
  macro_label         text not null,
  service_id          text not null,   -- id oficial do catálogo (ex.: 'baas')
  name                text not null,
  complexity          int check (complexity between 1 and 5),
  complexity_range    text,
  anchor              boolean not null default false,
  suggested_value_brl numeric(14,2) not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);
create unique index if not exists services_service_id_key on services (service_id);

-- ── account_services (interesse do lead × serviço) ──────────────
create table if not exists account_services (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  service_id          uuid not null references services(id) on delete cascade,
  estimated_value_brl numeric(14,2) not null default 0,
  interest            interest_level not null default 'interessado',
  notes               text,
  created_at          timestamptz not null default now(),
  unique (account_id, service_id)
);
create index if not exists account_services_account_idx on account_services (account_id);

-- Vínculo opcional tarefa → serviços (quais serviços a ação ABM trabalha).
alter table tasks add column if not exists service_ids text[] not null default '{}';

-- ── RLS ─────────────────────────────────────────────────────────
alter table services         enable row level security;
alter table account_services enable row level security;
do $$
declare t text;
begin
  foreach t in array array['services','account_services'] loop
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format('create policy %I_auth_all on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ── Seed do catálogo (valores sugeridos calibrados pela complexidade) ──
insert into services (macro_id, macro_label, service_id, name, complexity, complexity_range, anchor, suggested_value_brl) values
  ('contabil-regulatorio','Contábil/Regulatório','setup-contabil','Setup contábil completo',5,'4-5',true,600000),
  ('contabil-regulatorio','Contábil/Regulatório','revisao-cosif','Revisão COSIF',4,'3-4',false,180000),
  ('contabil-regulatorio','Contábil/Regulatório','mapeamento-bacen','Mapeamento BACEN',4,'3-4',false,150000),
  ('meios-pagamento','Meios de Pagamento','emissor-cartao','Emissor de cartão',5,'4-5',true,800000),
  ('meios-pagamento','Meios de Pagamento','migracao-processadora','Migração de processadora',5,'4-5',false,500000),
  ('meios-pagamento','Meios de Pagamento','otimizacao-tarifas','Otimização de tarifas',3,'2-3',false,90000),
  ('meios-pagamento','Meios de Pagamento','setup-bandeira','Setup de bandeira',4,'3-4',false,250000),
  ('meios-pagamento','Meios de Pagamento','estruturacao-adquirencia','Estruturação de adquirência',5,'4-5',false,600000),
  ('meios-pagamento','Meios de Pagamento','operacao-cartao','Operação de cartão',4,'2-4',false,200000),
  ('banking-conta-digital','Banking/Conta Digital','conta-digital','Conta digital',5,'4-5',false,500000),
  ('banking-conta-digital','Banking/Conta Digital','baas','BaaS (Banking as a Service)',5,'4-5',true,700000),
  ('banking-conta-digital','Banking/Conta Digital','pld-aml','PLD/AML',4,'3-4',false,180000),
  ('banking-conta-digital','Banking/Conta Digital','kyc-onboarding','KYC / Onboarding',3,'2-3',false,120000),
  ('consultoria-estrategica','Consultoria Estratégica','diagnostico','Diagnóstico',2,'1-3',false,60000),
  ('consultoria-estrategica','Consultoria Estratégica','estrategia-produto','Estratégia de produto',3,'2-4',false,150000),
  ('consultoria-estrategica','Consultoria Estratégica','modelo-negocio','Modelo de negócio',3,'2-4',false,150000),
  ('consultoria-estrategica','Consultoria Estratégica','transformacao-digital','Transformação digital',4,'2-4',false,200000),
  ('open-finance','Open Finance/Pagamentos Instantâneos','pix-implantacao','Implantação Pix',4,'3-4',false,200000),
  ('open-finance','Open Finance/Pagamentos Instantâneos','open-finance-assessoria','Assessoria Open Finance',3,'2-4',false,150000),
  ('revisao-operacional','Revisão Operacional','mandates-bandeira','Mandates de bandeira',3,'2-4',false,120000),
  ('revisao-operacional','Revisão Operacional','suporte-regulatorio','Suporte regulatório',3,'2-3',false,90000)
on conflict (service_id) do update set
  name = excluded.name,
  macro_label = excluded.macro_label,
  complexity = excluded.complexity,
  complexity_range = excluded.complexity_range,
  anchor = excluded.anchor;
