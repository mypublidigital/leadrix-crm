-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — mais de uma oportunidade do mesmo serviço        ║
-- ║                                                                ║
-- ║  A conta podia ter só uma oportunidade por serviço (unique      ║
-- ║  account_id + service_id). Na prática a mesma conta compra o    ║
-- ║  mesmo serviço mais de uma vez — outra unidade, outra fase,     ║
-- ║  outro ano. Agora pode repetir, e cada oportunidade ganha uma   ║
-- ║  identificação para não virar lista de nomes iguais.            ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table account_services drop constraint if exists account_services_account_id_service_id_key;

-- Identificação curta da oportunidade ("Unidade Sul", "Fase 2", "Safra 2027").
-- A observação detalhada continua em `notes`.
alter table account_services add column if not exists title text;

-- Índice que a unique dava de graça e o filtro por conta ainda usa.
create index if not exists account_services_account_service_idx
  on account_services (account_id, service_id);
