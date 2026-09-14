-- Detalhes da origem do lead.
--
-- Texto livre que qualifica a `lead_source`: qual evento, qual parceiro, qual
-- campanha. Fica sempre ao lado da origem no formulário e na conta-visão.
alter table accounts add column if not exists origin_details text;
create index if not exists accounts_origin_details_idx on accounts (origin_details);
