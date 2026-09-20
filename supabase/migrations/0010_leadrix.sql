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
