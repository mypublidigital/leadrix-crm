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
