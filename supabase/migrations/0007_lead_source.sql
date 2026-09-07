-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Origem do lead + quem indicou (reunião 12/08).               ║
-- ║  "criar campo a mais em identidade, colocar indicação e quem" ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table accounts add column if not exists lead_source text;
alter table accounts add column if not exists referred_by text;

create index if not exists accounts_lead_source_idx on accounts (lead_source);
