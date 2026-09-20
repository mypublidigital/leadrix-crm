-- ============================================================
-- Leadrix CRM — instalação completa do schema (cole e rode)
-- Painel Supabase → SQL Editor → New query → cole tudo → Run
-- Equivale às migrations 0001 a 0011, em ordem.
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — modelo de dados (base)                         ║
-- ║  Projeto Supabase PRÓPRIO do CRM (não o operacional).          ║
-- ╚══════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────
do $$ begin
  create type classification as enum ('cliente', 'parceiro', 'cliente_parceiro', 'lead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type segment as enum
    ('fintech','banco','cooperativa','instituicao-pagamento','sociedade-credito','nao-financeiro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_size as enum ('seed','pme','mid-market','enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type crm_stage as enum
    ('lead','qualificado','proposta','negociacao','fechado','standby','perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type health as enum ('verde','amarelo','vermelho');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type as enum
    ('landing_page','podcast','encontro','ligacao','reuniao','almoco','evento','viagem','conteudo','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum
    ('backlog','planejada','em_execucao','concluida','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type handoff_status as enum ('pendente','enviando','sucesso','erro','cancelado');
exception when duplicate_object then null; end $$;

-- ── updated_at helper ───────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

-- ── accounts (núcleo do ABM) ────────────────────────────────────
create table if not exists accounts (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  trade_name           text,
  cnpj                 text,
  site                 text,
  classification       classification not null default 'lead',
  segment              segment,
  account_size         account_size,
  macro_categories     text[] not null default '{}',
  relationship_years   text[] not null default '{}',
  proposals            jsonb  not null default '[]',   -- [{ref, title}]
  status_base          text,
  observations         text,
  crm_stage            crm_stage not null default 'lead',
  owner_id             uuid references auth.users(id) on delete set null,
  health               health,
  external_account_id  text,                            -- sync c/ operacional (§11.1)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists accounts_name_key on accounts (lower(name));
create index if not exists accounts_classification_idx on accounts (classification);
create index if not exists accounts_stage_idx on accounts (crm_stage);
drop trigger if exists trg_accounts_updated on accounts;
create trigger trg_accounts_updated before update on accounts
  for each row execute function set_updated_at();

-- ── contacts ────────────────────────────────────────────────────
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text,
  role        text,
  email       text,
  phone       text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists contacts_account_idx on contacts (account_id);

-- ── account_strategy (1 por conta) ──────────────────────────────
create table if not exists account_strategy (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null unique references accounts(id) on delete cascade,
  objective          text,
  value_proposition  text,
  target_offering    text,
  notes              text,
  updated_at         timestamptz not null default now()
);
drop trigger if exists trg_strategy_updated on account_strategy;
create trigger trg_strategy_updated before update on account_strategy
  for each row execute function set_updated_at();

-- ── deals (oportunidades do funil) ──────────────────────────────
create table if not exists deals (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  title               text not null,
  stage               crm_stage not null default 'lead',
  value_brl           numeric(14,2),
  probability         int check (probability between 0 and 100),
  macro_category      text,   -- id do catálogo do operacional (§10)
  project_type        text,   -- id do catálogo do operacional (§10)
  project_size        text,   -- P1..P5
  complexity          int check (complexity between 1 and 5),
  manager_email       text,
  expected_close      date,
  signed_at           timestamptz,
  lost_reason         text,
  external_handoff_id text,   -- = external_id enviado ao operacional (idempotência)
  handoff_status      handoff_status not null default 'pendente',
  project_id          text,
  project_url         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists deals_external_handoff_key
  on deals (external_handoff_id) where external_handoff_id is not null;
create index if not exists deals_account_idx on deals (account_id);
create index if not exists deals_stage_idx on deals (stage);
drop trigger if exists trg_deals_updated on deals;
create trigger trg_deals_updated before update on deals
  for each row execute function set_updated_at();

-- ── tasks (ABM — tipadas e agrupáveis) ──────────────────────────
create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  title           text not null,
  description     text,
  task_type       task_type not null default 'outro',
  scheduled_date  date,
  scheduled_time  time,
  period_day      date,        -- = scheduled_date (derivado)
  period_week     date,        -- segunda-feira da semana (derivado)
  period_month    date,        -- 1º dia do mês (derivado)
  status          task_status not null default 'planejada',
  owner_id        uuid references auth.users(id) on delete set null,
  effort          int,
  result_notes    text,
  linked_deal_id  uuid references deals(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tasks_account_idx on tasks (account_id);
create index if not exists tasks_type_idx on tasks (task_type);
create index if not exists tasks_period_day_idx on tasks (period_day);
create index if not exists tasks_period_week_idx on tasks (period_week);
create index if not exists tasks_period_month_idx on tasks (period_month);
create index if not exists tasks_status_idx on tasks (status);

-- Deriva period_* a partir de scheduled_date (recalculado ao arrastar tarefas).
create or replace function derive_task_periods() returns trigger as $$
begin
  if new.scheduled_date is not null then
    new.period_day   = new.scheduled_date;
    new.period_week  = date_trunc('week',  new.scheduled_date)::date; -- segunda
    new.period_month = date_trunc('month', new.scheduled_date)::date;
  else
    new.period_day = null; new.period_week = null; new.period_month = null;
  end if;
  new.updated_at = now();
  return new;
end $$ language plpgsql;
drop trigger if exists trg_tasks_periods on tasks;
create trigger trg_tasks_periods before insert or update on tasks
  for each row execute function derive_task_periods();

-- ── interactions (histórico de toques) ──────────────────────────
create table if not exists interactions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  type        text,
  summary     text,
  date        timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);
create index if not exists interactions_account_idx on interactions (account_id);

-- ── webhook_logs (log de handoff/webhooks — tela de Config §12.7) ──
create table if not exists webhook_logs (
  id          uuid primary key default gen_random_uuid(),
  direction   text not null,        -- 'out' (handoff) | 'in' (status do operacional)
  deal_id     uuid references deals(id) on delete set null,
  endpoint    text,
  status_code int,
  request     jsonb,
  response    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists webhook_logs_deal_idx on webhook_logs (deal_id);

-- ── RLS ─────────────────────────────────────────────────────────
-- Ferramenta interna: qualquer usuário autenticado tem acesso total.
-- (Refinar por owner_id/role num incremento futuro.)
alter table accounts          enable row level security;
alter table contacts          enable row level security;
alter table account_strategy  enable row level security;
alter table deals             enable row level security;
alter table tasks             enable row level security;
alter table interactions      enable row level security;
alter table webhook_logs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','contacts','account_strategy','deals','tasks','interactions','webhook_logs']
  loop
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format(
      'create policy %I_auth_all on %I for all to authenticated using (true) with check (true)',
      t, t);
  end loop;
end $$;


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


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Ajustes: estágio Stand by, link de proposta, motivos de       ║
-- ║  não-venda, estratégia ABM "caderno", anotações de pipeline.   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Novo estágio do funil (ADD VALUE precisa estar commitado antes de uso).
-- (standby já incluído no enum acima — ADD VALUE não roda dentro da transação do SQL Editor)

-- Campos de pipeline na conta (pipeline é centrado na conta).
alter table accounts add column if not exists proposal_link        text;
alter table accounts add column if not exists lost_reason          text;
alter table accounts add column if not exists standby_review_date  date;
alter table accounts add column if not exists expected_close       date;
alter table accounts add column if not exists pipeline_notes       text;

-- Estratégia ABM como caderno de anotações (Oferta-alvo sai de uso — redundante
-- com Serviços de Interesse; a coluna fica para compatibilidade).
alter table account_strategy add column if not exists key_messages    text;
alter table account_strategy add column if not exists decision_makers text;
alter table account_strategy add column if not exists channels        text;
alter table account_strategy add column if not exists success_metrics text;
alter table account_strategy add column if not exists objections      text;

-- Motivos de não-venda (lista padrão editável na tela de Configurações).
create table if not exists lost_reasons (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table lost_reasons enable row level security;
drop policy if exists lost_reasons_auth_all on lost_reasons;
create policy lost_reasons_auth_all on lost_reasons for all to authenticated using (true) with check (true);

insert into lost_reasons (label, sort) values
  ('Preço acima do orçamento', 1),
  ('Sem budget no momento', 2),
  ('Escolheu concorrente', 3),
  ('Projeto adiado pelo cliente', 4),
  ('Sem fit técnico/regulatório', 5),
  ('Decisor mudou de prioridade', 6),
  ('Sem resposta / esfriou', 7),
  ('Outro', 8)
on conflict do nothing;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Termômetro comercial (substitui a "Saúde" do lead) +          ║
-- ║  contato específico na tarefa/ação ABM.                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Termômetro comercial: probabilidade manual por conta.
-- Níveis: 0 (sem chance) · 50 (em contato) · 60 (perspectiva) ·
--         75 (negociação) · 90 (só falta assinar) · 100 (assinado).
alter table accounts add column if not exists commercial_temp int
  check (commercial_temp in (0, 50, 60, 75, 90, 100));

-- Backfill a partir do estágio de funil (para não ficar tudo vazio).
update accounts set commercial_temp = case crm_stage
  when 'fechado'    then 100
  when 'negociacao' then 90
  when 'proposta'   then 75
  when 'qualificado' then 60
  when 'standby'    then 50
  else 0
end
where commercial_temp is null;

-- Contato específico da tarefa (ação ABM direcionada a uma pessoa).
alter table tasks add column if not exists contact_id uuid references contacts(id) on delete set null;
create index if not exists tasks_contact_idx on tasks (contact_id);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Oportunidade vira o centro do pipeline (reunião 13/07).       ║
-- ║  account_services = OPORTUNIDADES: cada uma com termômetro,    ║
-- ║  etapa própria, dono e histórico de etapas (aging/hemograma).  ║
-- ║  O termômetro da conta passa a ser leitura consolidada.        ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table account_services add column if not exists commercial_temp int
  check (commercial_temp in (0, 50, 60, 75, 90, 100)) default 0;
alter table account_services add column if not exists stage crm_stage not null default 'lead';
alter table account_services add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table account_services add column if not exists stage_entered_at timestamptz not null default now();
-- histórico: [{stage, entered_at, left_at, days}]
alter table account_services add column if not exists stage_history jsonb not null default '[]';
alter table account_services add column if not exists standby_review_date date;
alter table account_services add column if not exists lost_reason text;
alter table account_services add column if not exists proposal_link text;

create index if not exists account_services_stage_idx on account_services (stage);
create index if not exists account_services_owner_idx on account_services (owner_id);

-- Backfill: oportunidades existentes herdam etapa/termômetro da conta.
update account_services os set
  stage = a.crm_stage,
  commercial_temp = coalesce(a.commercial_temp, 0)
from accounts a
where a.id = os.account_id;


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


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Origem do lead + quem indicou (reunião 12/08).               ║
-- ║  "criar campo a mais em identidade, colocar indicação e quem" ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table accounts add column if not exists lead_source text;
alter table accounts add column if not exists referred_by text;

create index if not exists accounts_lead_source_idx on accounts (lead_source);


-- Aniversário do contato.
--
-- Guardado como data completa para o campo aceitar o seletor nativo do
-- navegador e permitir calcular a idade. O casamento com o período da agenda
-- usa só DIA e MÊS: aniversário se repete todo ano, o ano de nascimento não
-- entra no filtro.
alter table contacts add column if not exists birth_date date;


-- Detalhes da origem do lead.
--
-- Texto livre que qualifica a `lead_source`: qual evento, qual parceiro, qual
-- campanha. Fica sempre ao lado da origem no formulário e na conta-visão.
alter table accounts add column if not exists origin_details text;
create index if not exists accounts_origin_details_idx on accounts (origin_details);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — taxonomia, custo de venda, ABM e conteúdo       ║
-- ║                                                                ║
-- ║  1. Domínios da Leadrix: 4 mercados (+ microssegmentos         ║
-- ║     editáveis), porte, classificação, nível ABM, tipos de ação.║
-- ║  2. Catálogo de serviços pelos 4 pilares.                      ║
-- ║  3. Custo de venda: recursos (hora-homem), despesas, custos    ║
-- ║     fixos, configurações e lançamentos.                        ║
-- ║  4. Radar ABM (jogadas descartadas) e biblioteca de conteúdo.  ║
-- ║                                                                ║
-- ║  Escrita para um projeto Supabase NOVO (sem dados). Os valores ║
-- ║  espelham src/data/leadrix.js, servicesCatalog.js e            ║
-- ║  constants.js — mudou lá, mude aqui.                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. Domínios: enums do projeto de origem viram texto com CHECK ──
-- Texto + CHECK em vez de enum: acrescentar um valor depois é um ALTER
-- simples, sem a restrição de "ALTER TYPE ... ADD VALUE" fora de transação.

-- Mercado (macrossegmento)
alter table accounts alter column segment type text using segment::text;
update accounts set segment = null
  where segment is not null and segment not in ('servicos-b2b','industria','varejo-franquias','empresas-digitais');
alter table accounts drop constraint if exists accounts_segment_check;
alter table accounts add constraint accounts_segment_check
  check (segment in ('servicos-b2b','industria','varejo-franquias','empresas-digitais'));
drop type if exists segment;

-- Porte (faturamento anual)
alter table accounts alter column account_size type text using account_size::text;
update accounts set account_size = null
  where account_size is not null and account_size not in ('pequena','media','grande','enterprise');
alter table accounts drop constraint if exists accounts_account_size_check;
alter table accounts add constraint accounts_account_size_check
  check (account_size in ('pequena','media','grande','enterprise'));
drop type if exists account_size;

-- Classificação
alter table accounts alter column classification drop default;
alter table accounts alter column classification type text using classification::text;
update accounts set classification = 'cliente' where classification = 'cliente_parceiro';
alter table accounts alter column classification set default 'lead';
alter table accounts drop constraint if exists accounts_classification_check;
alter table accounts add constraint accounts_classification_check
  check (classification in ('cliente','conta_alvo','parceiro','lead'));
drop type if exists classification;

-- Tipos de ação ABM
alter table tasks alter column task_type drop default;
alter table tasks alter column task_type type text using task_type::text;
update tasks set task_type = 'outro'
  where task_type not in ('ligacao','email','linkedin','reuniao','diagnostico','workshop','almoco','jantar','evento','viagem','conteudo','proposta','brinde','landing_page','outro');
alter table tasks alter column task_type set default 'outro';
alter table tasks drop constraint if exists tasks_task_type_check;
alter table tasks add constraint tasks_task_type_check
  check (task_type in ('ligacao','email','linkedin','reuniao','diagnostico','workshop','almoco','jantar','evento','viagem','conteudo','proposta','brinde','landing_page','outro'));
drop type if exists task_type;

-- Campos novos da conta
alter table accounts add column if not exists micro_segment text;
alter table accounts add column if not exists abm_tier text;
alter table accounts add column if not exists entry_door text;
alter table accounts drop constraint if exists accounts_abm_tier_check;
alter table accounts add constraint accounts_abm_tier_check check (abm_tier in ('1:1','1:few','1:many'));
alter table accounts drop constraint if exists accounts_entry_door_check;
alter table accounts add constraint accounts_entry_door_check check (entry_door in ('margem','adocao','crescimento'));
create index if not exists accounts_segment_idx on accounts (segment);
create index if not exists accounts_micro_segment_idx on accounts (micro_segment);
create index if not exists accounts_abm_tier_idx on accounts (abm_tier);

-- Ação ABM ligada à oportunidade e à jogada do playbook que a originou
alter table tasks add column if not exists opportunity_id uuid references account_services(id) on delete set null;
alter table tasks add column if not exists abm_play_id text;
create index if not exists tasks_opportunity_idx on tasks (opportunity_id);

-- Microssegmentos (lista editável na tela de Configurações)
create table if not exists micro_segments (
  id         text primary key,
  segment    text not null check (segment in ('servicos-b2b','industria','varejo-franquias','empresas-digitais')),
  label      text not null,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (segment, label)
);

insert into micro_segments (id, segment, label, sort) values
  ('servicos-b2b--consultorias', 'servicos-b2b', 'Consultorias', 1),
  ('servicos-b2b--assessorias', 'servicos-b2b', 'Assessorias', 2),
  ('servicos-b2b--agencias', 'servicos-b2b', 'Agências', 3),
  ('servicos-b2b--escritorios-especializados', 'servicos-b2b', 'Escritórios especializados', 4),
  ('servicos-b2b--servicos-profissionais', 'servicos-b2b', 'Serviços profissionais', 5),
  ('industria--alimentos-e-bebidas', 'industria', 'Alimentos e bebidas', 1),
  ('industria--quimica-e-farmaceutica', 'industria', 'Química e farmacêutica', 2),
  ('industria--metalmecanica-e-autopecas', 'industria', 'Metalmecânica e autopeças', 3),
  ('industria--bens-de-consumo', 'industria', 'Bens de consumo', 4),
  ('industria--agroindustria', 'industria', 'Agroindústria', 5),
  ('industria--construcao-e-materiais', 'industria', 'Construção e materiais', 6),
  ('industria--textil-e-confeccao', 'industria', 'Têxtil e confecção', 7),
  ('industria--embalagens-e-plasticos', 'industria', 'Embalagens e plásticos', 8),
  ('varejo-franquias--supermercados-e-varejo-alimentar', 'varejo-franquias', 'Supermercados e varejo alimentar', 1),
  ('varejo-franquias--moda-e-calcados', 'varejo-franquias', 'Moda e calçados', 2),
  ('varejo-franquias--farmacias-e-drogarias', 'varejo-franquias', 'Farmácias e drogarias', 3),
  ('varejo-franquias--oticas', 'varejo-franquias', 'Óticas', 4),
  ('varejo-franquias--materiais-de-construcao', 'varejo-franquias', 'Materiais de construção', 5),
  ('varejo-franquias--food-service-e-restaurantes', 'varejo-franquias', 'Food service e restaurantes', 6),
  ('varejo-franquias--franquias-de-servicos', 'varejo-franquias', 'Franquias de serviços', 7),
  ('varejo-franquias--eletro-e-eletronicos', 'varejo-franquias', 'Eletro e eletrônicos', 8),
  ('empresas-digitais--saas-b2b', 'empresas-digitais', 'SaaS B2B', 1),
  ('empresas-digitais--e-commerce-e-marketplaces', 'empresas-digitais', 'E-commerce e marketplaces', 2),
  ('empresas-digitais--fintechs', 'empresas-digitais', 'Fintechs', 3),
  ('empresas-digitais--healthtechs', 'empresas-digitais', 'Healthtechs', 4),
  ('empresas-digitais--edtechs', 'empresas-digitais', 'Edtechs', 5),
  ('empresas-digitais--logtechs-e-mobilidade', 'empresas-digitais', 'Logtechs e mobilidade', 6),
  ('empresas-digitais--midia-e-conteudo-digital', 'empresas-digitais', 'Mídia e conteúdo digital', 7)
on conflict (id) do nothing;

-- ── 2. Catálogo pelos quatro pilares ────────────────────────────
-- Remove o catálogo do projeto de origem apenas onde nenhuma oportunidade o usa.
delete from services s
  where s.macro_id not in ('estruturas-hibridas','agentes-processos','educacao-adocao','novos-negocios')
    and not exists (select 1 from account_services a where a.service_id = s.id);

insert into services (macro_id, macro_label, service_id, name, complexity, complexity_range, anchor, suggested_value_brl) values
  ('estruturas-hibridas', 'Estruturas Organizacionais Híbridas', 'mapeamento-funcoes', 'Mapeamento de funções, decisões e conhecimentos críticos', 3, '2-3', false, 0),
  ('estruturas-hibridas', 'Estruturas Organizacionais Híbridas', 'redesenho-papeis', 'Redesenho de papéis entre pessoas, agentes e sistemas', 4, '3-5', true, 0),
  ('estruturas-hibridas', 'Estruturas Organizacionais Híbridas', 'modelo-supervisao', 'Modelo de supervisão, responsabilidade e exceções', 3, '2-4', false, 0),
  ('estruturas-hibridas', 'Estruturas Organizacionais Híbridas', 'indicadores-capacidade', 'Indicadores de capacidade, qualidade e produtividade', 2, '2-3', false, 0),
  ('agentes-processos', 'Agentes e Processos Automatizados para Eficiência', 'diagnostico-leadrix', 'Diagnóstico Leadrix (porta de entrada)', 2, '1-3', false, 0),
  ('agentes-processos', 'Agentes e Processos Automatizados para Eficiência', 'redesenho-processos-agentes', 'Diagnóstico e redesenho de processos com agentes', 3, '3-4', false, 0),
  ('agentes-processos', 'Agentes e Processos Automatizados para Eficiência', 'portfolio-priorizacao', 'Portfólio e priorização por impacto, custo, prazo e risco', 3, '2-3', false, 0),
  ('agentes-processos', 'Agentes e Processos Automatizados para Eficiência', 'implantacao-agentes', 'Implantação e integração de agentes, dados e sistemas', 5, '4-5', true, 0),
  ('agentes-processos', 'Agentes e Processos Automatizados para Eficiência', 'governanca-agentes', 'Regras, exceções, supervisão e indicadores dos agentes', 3, '2-4', false, 0),
  ('educacao-adocao', 'Educação e Adoção Produtiva', 'workshop-gratuito', 'Workshop gratuito / Workshop Mensal Leadrix', 1, '1', false, 0),
  ('educacao-adocao', 'Educação e Adoção Produtiva', 'workshop-in-company', 'Workshop in company personalizado por função', 2, '2-3', false, 0),
  ('educacao-adocao', 'Educação e Adoção Produtiva', 'formacao-executiva', 'Formação Executiva em IA (Curso de Formação Leadrix)', 3, '2-3', false, 0),
  ('educacao-adocao', 'Educação e Adoção Produtiva', 'multiplicadores-adocao', 'Formação de multiplicadores e acompanhamento de adoção', 3, '3-4', false, 0),
  ('educacao-adocao', 'Educação e Adoção Produtiva', 'playbook-ia', 'Playbook de IA (métodos, segurança, qualidade e indicadores)', 3, '2-4', true, 0),
  ('novos-negocios', 'Novos Negócios, Linhas de Receita e Spin-offs', 'mapeamento-ativos', 'Mapeamento de ativos, conhecimentos e oportunidades', 3, '2-3', false, 0),
  ('novos-negocios', 'Novos Negócios, Linhas de Receita e Spin-offs', 'teses-negocio', 'Construção e priorização de teses de negócio', 3, '3-4', false, 0),
  ('novos-negocios', 'Novos Negócios, Linhas de Receita e Spin-offs', 'prototipacao-validacao', 'Prototipação, validação e tese econômico-financeira', 4, '3-5', false, 0),
  ('novos-negocios', 'Novos Negócios, Linhas de Receita e Spin-offs', 'spin-off', 'Modelo de implantação, parceria, nova unidade ou spin-off', 5, '4-5', true, 0)
on conflict (service_id) do update set macro_id = excluded.macro_id, macro_label = excluded.macro_label, name = excluded.name,
  complexity = excluded.complexity, complexity_range = excluded.complexity_range, anchor = excluded.anchor;

-- ── 3. Custo de venda ───────────────────────────────────────────
-- Recursos: quem trabalha nas oportunidades e quanto custa a hora.
create table if not exists sales_resources (
  id            text primary key,
  name          text not null default '',
  role          text,
  user_id       uuid references auth.users(id) on delete set null,
  monthly_cost  numeric(14,2),     -- salário + encargos + benefícios (ou pró-labore)
  monthly_hours numeric(8,2),      -- horas produtivas no mês
  hourly_cost   numeric(14,2),     -- usado quando o mensal não é informado
  active        boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists sales_expense_categories (
  id           text primary key,
  label        text not null default '',
  unit         text,
  default_cost numeric(14,2) not null default 0,
  sort         int not null default 0
);

insert into sales_expense_categories (id, label, unit, default_cost, sort) values
  ('passagem', 'Passagem aérea / rodoviária', 'trecho', 0, 1),
  ('hospedagem', 'Hospedagem', 'diária', 0, 2),
  ('deslocamento', 'Deslocamento (app, táxi, km)', 'trajeto', 0, 3),
  ('almoco', 'Almoço', 'pessoa', 0, 4),
  ('jantar', 'Jantar', 'pessoa', 0, 5),
  ('evento', 'Evento / inscrição / espaço', 'evento', 0, 6),
  ('brinde', 'Brinde / envio físico', 'unidade', 0, 7),
  ('material', 'Material / impressos', 'unidade', 0, 8),
  ('midia', 'Mídia paga (LinkedIn Ads etc.)', 'campanha', 0, 9),
  ('outros', 'Outras despesas', 'unidade', 0, 10)
on conflict (id) do nothing;

create table if not exists sales_fixed_costs (
  id      text primary key,
  label   text not null default '',
  monthly numeric(14,2) not null default 0,
  sort    int not null default 0
);

-- Configurações chave → valor (horas por tipo de ação, margem, SLA de aging).
create table if not exists crm_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

insert into crm_settings (key, value) values
  ('task_hours', '{"ligacao":0.5,"email":0.5,"linkedin":0.25,"reuniao":1.5,"diagnostico":8,"workshop":4,"almoco":2,"jantar":3,"evento":6,"viagem":8,"conteudo":3,"proposta":6,"brinde":0.5,"landing_page":6,"outro":1}'),
  ('aging_sla', '{"lead":14,"qualificado":21,"proposta":14,"negociacao":21,"standby":45,"fechado":60}'),
  ('margin_pct', 'null')
on conflict (key) do nothing;

-- Lançamentos: horas de um recurso OU uma despesa. O custo/hora é gravado no
-- lançamento (snapshot) para reajustes não reescreverem o passado.
create table if not exists cost_entries (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  opportunity_id uuid references account_services(id) on delete set null,
  task_id        uuid references tasks(id) on delete cascade,
  kind           text not null check (kind in ('hours','expense')),
  resource_id    text references sales_resources(id) on delete set null,
  hours          numeric(8,2),
  hourly_cost    numeric(14,2),
  category_id    text references sales_expense_categories(id) on delete set null,
  quantity       numeric(10,2),
  unit_cost      numeric(14,2),
  description    text,
  date           date not null default current_date,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  check (
    (kind = 'hours'   and hours is not null and hours > 0 and hourly_cost is not null) or
    (kind = 'expense' and unit_cost is not null and unit_cost >= 0)
  )
);
create index if not exists cost_entries_account_idx on cost_entries (account_id);
create index if not exists cost_entries_opportunity_idx on cost_entries (opportunity_id);
create index if not exists cost_entries_task_idx on cost_entries (task_id);
create index if not exists cost_entries_date_idx on cost_entries (date);

-- ── 4. Radar ABM e conteúdo ─────────────────────────────────────
create table if not exists abm_dismissals (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references account_services(id) on delete cascade,
  play_id        text not null,
  reason         text,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists abm_dismissals_opportunity_idx on abm_dismissals (opportunity_id);

create table if not exists content_items (
  id               uuid primary key default gen_random_uuid(),
  format           text not null check (format in ('blog','linkedin','instagram','email')),
  title            text,
  body             text not null default '',
  meta_description text,
  hashtags         text[] not null default '{}',
  cta              text,
  status           text not null default 'rascunho' check (status in ('rascunho','revisao','aprovado','publicado')),
  account_id       uuid references accounts(id) on delete set null,
  opportunity_id   uuid references account_services(id) on delete set null,
  play_id          text,
  segment          text,
  micro_segment    text,
  pillar           text,
  persona          text,
  stage            text,
  angle            text,
  generated_by     text,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists content_items_account_idx on content_items (account_id);
drop trigger if exists trg_content_items_updated on content_items;
create trigger trg_content_items_updated before update on content_items
  for each row execute function set_updated_at();

-- ── RLS: mesmo modelo das demais tabelas (autenticado = acesso total) ──
-- ATENÇÃO (Guia §9.4): custo hora-homem é dado sensível. Se vendedores não
-- devem ver o custo de cada pessoa, restrinja sales_resources e cost_entries
-- por papel antes de colocar usuários reais.
do $$
declare t text;
begin
  foreach t in array array['micro_segments','sales_resources','sales_expense_categories','sales_fixed_costs','crm_settings','cost_entries','abm_dismissals','content_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format('create policy %I_auth_all on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — perfis de acesso, originação do lead,           ║
-- ║  contexto ABM e mensageria                                     ║
-- ║                                                                ║
-- ║  1. Perfis (admin / marketing / vendas) com regras no banco:    ║
-- ║     só admin apaga oportunidade; custo é de admin e marketing.  ║
-- ║  2. Originação do lead + comissão de indicação.                ║
-- ║  3. Contexto ABM: pontuação ICP, sinais, campanha e hipótese.   ║
-- ║  4. Mensageria: modelos, fila de e-mails e configuração.        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. Perfil do usuário ────────────────────────────────────────
-- O papel vive em auth.users.raw_app_meta_data->>'role' (definido pelo admin
-- via Edge Function, nunca pelo próprio usuário). SECURITY DEFINER para não
-- depender de permissão de leitura em auth.users — e sem consultar a tabela
-- protegida pela própria política (evita o laço 42P17 do Guia §9.3).
create or replace function crm_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (select nullif(u.raw_app_meta_data ->> 'role', '') from auth.users u where u.id = auth.uid()),
    'vendas'
  )
$$;

create or replace function crm_is_admin() returns boolean
language sql stable as $$ select crm_role() = 'admin' $$;

create or replace function crm_sees_cost() returns boolean
language sql stable as $$ select crm_role() in ('admin', 'marketing') $$;

revoke all on function crm_role() from public;
grant execute on function crm_role(), crm_is_admin(), crm_sees_cost() to authenticated;

-- Só administrador exclui oportunidade. As demais operações seguem liberadas
-- para usuário autenticado (leitura, criação e movimentação no funil).
drop policy if exists account_services_auth_all on account_services;
drop policy if exists account_services_select on account_services;
drop policy if exists account_services_insert on account_services;
drop policy if exists account_services_update on account_services;
drop policy if exists account_services_delete_admin on account_services;
create policy account_services_select on account_services for select to authenticated using (true);
create policy account_services_insert on account_services for insert to authenticated with check (true);
create policy account_services_update on account_services for update to authenticated using (true) with check (true);
create policy account_services_delete_admin on account_services for delete to authenticated using (crm_is_admin());

-- Módulo de custo: leitura e escrita só para admin e marketing. Vendas vê
-- resultado (contas, oportunidades, receita), não o custo hora-homem.
do $$
declare t text;
begin
  foreach t in array array['sales_resources','sales_expense_categories','sales_fixed_costs','cost_entries']
  loop
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format('drop policy if exists %I_cost_roles on %I', t, t);
    execute format(
      'create policy %I_cost_roles on %I for all to authenticated using (crm_sees_cost()) with check (crm_sees_cost())',
      t, t);
  end loop;
end $$;

-- crm_settings continua legível por todos (SLA de aging, remetente de e-mail),
-- mas só admin e marketing escrevem.
drop policy if exists crm_settings_auth_all on crm_settings;
drop policy if exists crm_settings_read on crm_settings;
drop policy if exists crm_settings_write on crm_settings;
create policy crm_settings_read on crm_settings for select to authenticated using (true);
create policy crm_settings_write on crm_settings for all to authenticated using (crm_sees_cost()) with check (crm_sees_cost());

-- ── 2. Originação do lead e comissão de indicação ───────────────
alter table accounts add column if not exists origin_source text;
alter table accounts add column if not exists origin_source_other text;
alter table accounts add column if not exists referral_commission boolean not null default false;
alter table accounts add column if not exists referral_commission_pct numeric(5,2);

alter table accounts drop constraint if exists accounts_origin_source_check;
alter table accounts add constraint accounts_origin_source_check
  check (origin_source in ('boomit','mypubli','carol','marcelo','edson','cristiano','outros'));
alter table accounts drop constraint if exists accounts_commission_pct_check;
alter table accounts add constraint accounts_commission_pct_check
  check (referral_commission_pct is null or (referral_commission_pct >= 0 and referral_commission_pct <= 100));
-- "Outros" exige a especificação de quem trouxe o lead.
alter table accounts drop constraint if exists accounts_origin_other_check;
alter table accounts add constraint accounts_origin_other_check
  check (origin_source is distinct from 'outros' or origin_source_other is not null);
create index if not exists accounts_origin_source_idx on accounts (origin_source);

-- ── 3. Contexto ABM na conta e na estratégia ────────────────────
alter table accounts add column if not exists icp_scores jsonb not null default '{}';
alter table accounts add column if not exists icp_blockers text[] not null default '{}';
alter table accounts add column if not exists signals text[] not null default '{}';
alter table accounts add column if not exists signal_notes text;
alter table accounts add column if not exists campaign text;
alter table accounts drop constraint if exists accounts_campaign_check;
alter table accounts add constraint accounts_campaign_check
  check (campaign in ('crescer-sem-estrutura','experimentacao-portfolio','ia-no-fluxo','capacidade-por-unidade','autopilot'));
create index if not exists accounts_campaign_idx on accounts (campaign);

alter table account_strategy add column if not exists hypothesis text;
alter table account_strategy add column if not exists affected_indicator text;
alter table account_strategy add column if not exists entry_offer text;
alter table account_strategy add column if not exists expansion_plan text;

-- ── 4. Mensageria ───────────────────────────────────────────────
create table if not exists email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  event       text not null default 'manual',
  subject     text not null default '',
  body        text not null default '',
  from_alias  text,
  auto        boolean not null default false,
  delay_days  int not null default 0,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_templates_event_idx on email_templates (event);
drop trigger if exists trg_email_templates_updated on email_templates;
create trigger trg_email_templates_updated before update on email_templates
  for each row execute function set_updated_at();

-- Fila de envio: todo e-mail passa por aqui antes de sair para o lead.
create table if not exists email_messages (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  contact_id          uuid references contacts(id) on delete set null,
  opportunity_id      uuid references account_services(id) on delete set null,
  task_id             uuid references tasks(id) on delete set null,
  template_id         uuid references email_templates(id) on delete set null,
  event               text not null default 'manual',
  to_email            text not null,
  to_name             text,
  from_alias          text,
  subject             text not null default '',
  body                text not null default '',
  status              text not null default 'rascunho'
                        check (status in ('rascunho','agendado','enviado','erro','cancelado')),
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  error               text,
  provider_message_id text,
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now()
);
create index if not exists email_messages_account_idx on email_messages (account_id);
create index if not exists email_messages_status_idx on email_messages (status);

insert into crm_settings (key, value) values
  ('email_settings', '{"from_name":"Leadrix","from_email":"marcelo@leadrix.com.br","default_alias":"marcelo@leadrix.com.br","aliases":["marcelo@leadrix.com.br"],"signature":"Equipe Leadrix\nLidere seu mercado com IA","auto_enabled":false}')
on conflict (key) do nothing;

-- Modelos iniciais na estrutura sinal → hipótese → consequência → convite.
insert into email_templates (name, event, subject, body, auto, delay_days) values
  ('Primeiro contato a partir de um sinal', 'conta_criada',
   '{{conta}}: uma hipótese sobre {{indicador}}',
   E'Olá, {{primeiro_nome}}.\n\nObservamos que a {{conta}} está passando por um movimento relevante no setor de {{microssegmento}}. Em operações com essa configuração, o desafio costuma aparecer quando o processo ainda depende de conferência manual — o que afeta {{indicador}}.\n\nEstamos analisando como empresas desse setor comparam processos, dados e capacidade antes de ampliar investimentos em IA. Vale reservarmos 30 minutos para avaliar quais atividades merecem prioridade e quais ainda não justificam implantação?\n\n{{assinatura}}',
   false, 0),
  ('Convite para conversa de diagnóstico', 'etapa_qualificado',
   'Conversa de diagnóstico — {{conta}} e {{pilar}}',
   E'Olá, {{primeiro_nome}}.\n\nPelo que conversamos, a hipótese é: {{hipotese}}\n\nNossa sugestão é uma conversa de diagnóstico de 45 minutos para validar isso com quem responde pelo processo, olhar a linha de base de {{indicador}} e sair com prioridades. Se fizer sentido, eu envio duas opções de horário.\n\n{{assinatura}}',
   true, 1),
  ('Envio de proposta com business case', 'etapa_proposta',
   'Proposta {{servico}} — {{conta}}',
   E'Olá, {{primeiro_nome}}.\n\nSegue a proposta de {{servico}} ({{pilar}}), com escopo, premissas e o impacto esperado em {{indicador}}.\n\nDeixei explícitos os critérios de continuidade: o que precisa acontecer para seguirmos para a fase seguinte e o que nos faria interromper. Podemos revisar juntos na próxima semana?\n\n{{assinatura}}',
   true, 0),
  ('Boas-vindas depois do fechamento', 'etapa_fechado',
   'Combinado, {{primeiro_nome}} — próximos passos da {{conta}}',
   E'Olá, {{primeiro_nome}}.\n\nObrigado pela confiança. Nos próximos dias enviamos o plano de implantação de {{servico}}, com responsáveis, marcos e os indicadores que vamos acompanhar — começando por {{indicador}}.\n\n{{assinatura}}',
   true, 0)
on conflict do nothing;

-- RLS: modelos são de admin e marketing; a fila é de todos os perfis
-- (vendas precisa enviar e-mail para o lead), sem acesso a custo.
alter table email_templates enable row level security;
alter table email_messages enable row level security;

drop policy if exists email_templates_read on email_templates;
drop policy if exists email_templates_write on email_templates;
create policy email_templates_read on email_templates for select to authenticated using (true);
create policy email_templates_write on email_templates for all to authenticated
  using (crm_role() in ('admin','marketing')) with check (crm_role() in ('admin','marketing'));

drop policy if exists email_messages_auth_all on email_messages;
create policy email_messages_auth_all on email_messages for all to authenticated using (true) with check (true);


