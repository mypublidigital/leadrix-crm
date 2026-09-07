-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Consulcard CRM — modelo de dados (briefing §5)                ║
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
    ('lead','qualificado','proposta','negociacao','fechado','perdido');
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
