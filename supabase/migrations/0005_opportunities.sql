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
