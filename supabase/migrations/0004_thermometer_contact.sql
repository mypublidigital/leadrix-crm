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
