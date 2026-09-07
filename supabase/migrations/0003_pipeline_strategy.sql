-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Ajustes: estágio Stand by, link de proposta, motivos de       ║
-- ║  não-venda, estratégia ABM "caderno", anotações de pipeline.   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Novo estágio do funil (ADD VALUE precisa estar commitado antes de uso).
alter type crm_stage add value if not exists 'standby';

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
