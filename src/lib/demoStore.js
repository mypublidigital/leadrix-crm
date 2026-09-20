// Store de DEMO gravável (localStorage). Permite criar/editar contas, tarefas,
// oportunidades, custos e conteúdos SEM Supabase, para validar o fluxo completo.
// Em produção (Supabase configurado) este módulo não é usado — ver data.js.
//
// As contas, pessoas e valores daqui são FICTÍCIOS: servem só para as telas
// terem forma. Custos hora-homem e despesas são exemplos para demonstrar o
// cálculo de custo de venda e ROI — substitua em Configurações.

import demoAccounts from '../demo/accounts.json'
import { SERVICES_CATALOG } from '../data/servicesCatalog'
import { defaultMicroSegments, slug } from '../data/leadrix'
import { INTENT_SIGNALS, ICP_DIMENSIONS, ICP_BLOCKERS } from '../data/abmContext'
import { DEFAULT_LOST_REASONS, TASK_TYPES } from './constants'
import { defaultSalesCostSettings } from './costs'

const KEY = 'leadrix-crm-demo-v2'

function uid() {
  return 'd-' + Math.random().toString(36).slice(2, 10)
}

// Preços de exemplo para o modo demo (o catálogo real nasce sem preço).
const DEMO_PRICES = {
  'mapeamento-funcoes': 60000, 'redesenho-papeis': 220000, 'modelo-supervisao': 70000, 'indicadores-capacidade': 35000,
  'diagnostico-leadrix': 40000, 'redesenho-processos-agentes': 150000, 'portfolio-priorizacao': 80000,
  'implantacao-agentes': 300000, 'governanca-agentes': 60000,
  'workshop-gratuito': 0, 'workshop-in-company': 38000, 'formacao-executiva': 65000,
  'multiplicadores-adocao': 180000, 'playbook-ia': 90000,
  'mapeamento-ativos': 70000, 'teses-negocio': 140000, 'prototipacao-validacao': 240000, 'spin-off': 600000,
}

// [nome, mercado, microssegmento, porte, nível ABM, classificação, origem, contatos[[nome,cargo]]]
const DEMO_ACCOUNTS = [
  ['Vértice Consultoria Empresarial', 'servicos-b2b', 'Consultorias', 'media', '1:1', 'conta_alvo', 'indicacao', [['Ricardo Souza', 'Sócio'], ['Helena Prado', 'Diretora de Operações']]],
  ['Tríade Advogados Associados', 'servicos-b2b', 'Escritórios especializados', 'media', '1:few', 'conta_alvo', 'workshop', [['Paula Menezes', 'Sócia-administradora']]],
  ['Studio Pulso Comunicação', 'servicos-b2b', 'Agências', 'pequena', '1:many', 'lead', 'inbound', [['André Luz', 'CEO']]],
  ['Alvorada Assessoria Contábil', 'servicos-b2b', 'Assessorias', 'media', '1:few', 'cliente', 'indicacao', [['Marta Ribeiro', 'Sócia'], ['Jonas Teles', 'Gerente de Operações']]],
  ['Metalúrgica Serra Azul', 'industria', 'Metalmecânica e autopeças', 'grande', '1:1', 'conta_alvo', 'prospeccao', [['Carlos Mendes', 'Diretor de Operações'], ['Luiza Faria', 'Gerente de TI']]],
  ['Laticínios Campo Firme', 'industria', 'Alimentos e bebidas', 'grande', '1:few', 'conta_alvo', 'evento', [['Otávio Rezende', 'Diretor de Excelência Operacional']]],
  ['QuímicaSul Industrial', 'industria', 'Química e farmacêutica', 'enterprise', '1:1', 'cliente', 'curso', [['Beatriz Nogueira', 'Diretora de Transformação'], ['Rui Campos', 'Diretor de Unidade de Negócio']]],
  ['Embalar Plásticos', 'industria', 'Embalagens e plásticos', 'media', '1:many', 'lead', 'linkedin', []],
  ['Rede Farma Bem', 'varejo-franquias', 'Farmácias e drogarias', 'grande', '1:1', 'conta_alvo', 'prospeccao', [['Fernanda Lima', 'Diretora de Expansão'], ['Sérgio Dantas', 'Diretor de Operações']]],
  ['Óticas Horizonte', 'varejo-franquias', 'Óticas', 'media', '1:few', 'conta_alvo', 'workshop', [['Camila Torres', 'Diretora Comercial']]],
  ['Casa & Obra Materiais', 'varejo-franquias', 'Materiais de construção', 'grande', '1:few', 'lead', 'linkedin', [['Mauro Pacheco', 'Diretor de Operações']]],
  ['Sabor da Vila Franquias', 'varejo-franquias', 'Food service e restaurantes', 'media', '1:few', 'cliente', 'indicacao', [['Diego Martins', 'Diretor de Rede']]],
  ['Moda Aurora Calçados', 'varejo-franquias', 'Moda e calçados', 'media', '1:many', 'lead', 'inbound', []],
  ['Nuvem Fiscal SaaS', 'empresas-digitais', 'SaaS B2B', 'media', '1:1', 'conta_alvo', 'evento', [['Tiago Freitas', 'CEO'], ['Renata Alves', 'Líder de Produto']]],
  ['Pagora Fintech', 'empresas-digitais', 'Fintechs', 'media', '1:few', 'conta_alvo', 'parceiro', [['Bruno Lacerda', 'COO']]],
  ['EducaMais Edtech', 'empresas-digitais', 'Edtechs', 'pequena', '1:many', 'lead', 'workshop', [['Lívia Castro', 'Líder de Growth']]],
  ['Logix Mobilidade', 'empresas-digitais', 'Logtechs e mobilidade', 'media', '1:few', 'cliente', 'indicacao', [['Fábio Rocha', 'Líder de Tecnologia']]],
  ['Mercado Vivo Marketplace', 'empresas-digitais', 'E-commerce e marketplaces', 'grande', '1:few', 'conta_alvo', 'prospeccao', [['Juliana Pires', 'Líder de Operações']]],
]

// [conta, serviço, etapa, dias na etapa, dias no pipeline, dono]
const DEMO_OPPS = [
  [0, 'diagnostico-leadrix', 'qualificado', 30, 50, 0],
  [0, 'redesenho-papeis', 'lead', 40, 40, 0],
  [1, 'workshop-in-company', 'proposta', 20, 55, 1],
  [2, 'workshop-gratuito', 'lead', 50, 50, 1],
  [3, 'implantacao-agentes', 'fechado', 75, 160, 3],
  [3, 'playbook-ia', 'negociacao', 12, 70, 1],
  [4, 'redesenho-processos-agentes', 'proposta', 48, 95, 0],
  [4, 'formacao-executiva', 'qualificado', 10, 25, 1],
  [5, 'diagnostico-leadrix', 'lead', 25, 25, 3],
  [6, 'multiplicadores-adocao', 'fechado', 130, 240, 1],
  [6, 'spin-off', 'negociacao', 50, 150, 0],
  [7, 'workshop-gratuito', 'lead', 8, 8, 1],
  [8, 'implantacao-agentes', 'negociacao', 70, 170, 0],
  [8, 'playbook-ia', 'proposta', 25, 60, 1],
  [9, 'workshop-in-company', 'qualificado', 55, 80, 1],
  [10, 'portfolio-priorizacao', 'lead', 5, 5, 3],
  [11, 'formacao-executiva', 'fechado', 30, 110, 1],
  [11, 'implantacao-agentes', 'standby', 60, 140, 3],
  [12, 'workshop-gratuito', 'lead', 70, 70, 1],
  [13, 'teses-negocio', 'proposta', 9, 45, 0],
  [13, 'prototipacao-validacao', 'qualificado', 70, 90, 0],
  [14, 'redesenho-processos-agentes', 'negociacao', 30, 100, 2],
  [15, 'formacao-executiva', 'lead', 18, 18, 1],
  [16, 'implantacao-agentes', 'fechado', 200, 320, 2],
  [16, 'modelo-supervisao', 'perdido', 40, 120, 2],
  [17, 'mapeamento-funcoes', 'qualificado', 18, 35, 3],
  [17, 'implantacao-agentes', 'perdido', 15, 90, 0],
]

const STAGE_PATH = ['lead', 'qualificado', 'proposta', 'negociacao', 'fechado']
const TEMP_BY_STAGE = { lead: 50, qualificado: 60, proposta: 75, negociacao: 90, fechado: 100, standby: 50, perdido: 0 }

// Ações já executadas em cada etapa percorrida: [tipo, recursos, despesas]
const PAST_ACTIONS = {
  lead: [['linkedin', ['res-sdr'], []], ['ligacao', ['res-sdr'], []]],
  qualificado: [['reuniao', ['res-executivo', 'res-socio'], [['deslocamento', 2]]], ['diagnostico', ['res-head-projetos', 'res-arquiteto'], []]],
  proposta: [['proposta', ['res-head-projetos', 'res-executivo'], []], ['almoco', ['res-socio'], [['almoco', 2]]]],
  negociacao: [['reuniao', ['res-socio', 'res-executivo'], [['deslocamento', 2]]]],
}

const daysAgoIso = (today, n) => {
  const d = new Date(today)
  d.setDate(today.getDate() - n)
  return d.toISOString()
}

function seed() {
  const today = new Date()
  const sales_cost = defaultSalesCostSettings()
  sales_cost.resources = [
    { id: 'res-socio', name: 'Sócio(a) executivo(a)', role: 'Liderança comercial', monthly_cost: 42000, monthly_hours: 160, hourly_cost: null, active: true },
    { id: 'res-head-projetos', name: 'Head de Projetos', role: 'Pré-venda e escopo', monthly_cost: 28000, monthly_hours: 160, hourly_cost: null, active: true },
    { id: 'res-arquiteto', name: 'Arquiteto(a) de IA', role: 'Pré-venda técnica', monthly_cost: 26000, monthly_hours: 160, hourly_cost: null, active: true },
    { id: 'res-executivo', name: 'Executivo(a) de contas', role: 'Vendas', monthly_cost: 15000, monthly_hours: 168, hourly_cost: null, active: true },
    { id: 'res-sdr', name: 'SDR / pré-vendas', role: 'Prospecção', monthly_cost: 7000, monthly_hours: 168, hourly_cost: null, active: true },
    { id: 'res-conteudo', name: 'Marketing de conteúdo', role: 'Conteúdo ABM', monthly_cost: 9000, monthly_hours: 168, hourly_cost: null, active: true },
  ]
  const demoUnit = { passagem: 900, hospedagem: 450, deslocamento: 60, almoco: 120, jantar: 250, evento: 3000, brinde: 150, material: 80, midia: 2500 }
  sales_cost.expense_categories.forEach((c) => { if (demoUnit[c.id] != null) c.default_cost = demoUnit[c.id] })
  sales_cost.fixed_costs = [
    { id: 'fix-ferramentas', label: 'Ferramentas comerciais (CRM, LinkedIn Sales Navigator)', monthly: 1200 },
    { id: 'fix-midia', label: 'Mídia paga recorrente', monthly: 3000 },
  ]
  sales_cost.margin_pct = 45
  const hourlyOf = Object.fromEntries(sales_cost.resources.map((r) => [r.id, r.monthly_cost / r.monthly_hours]))

  const users = [
    { id: 'u-marcelo', email: 'marck.mpc@gmail.com', full_name: 'Marcelo Carvalho', role: 'admin', created_at: today.toISOString() },
    { id: 'u-carolina', email: 'carolina@demo.leadrix', full_name: 'Carolina Augusta', role: null, created_at: today.toISOString() },
    { id: 'u-cristiano', email: 'cristiano@demo.leadrix', full_name: 'Cristiano Correa', role: null, created_at: today.toISOString() },
    { id: 'u-edson', email: 'edson@demo.leadrix', full_name: 'Edson Machado', role: null, created_at: today.toISOString() },
  ]

  const services = SERVICES_CATALOG.map((sv) => ({
    id: `svc-${sv.service_id}`,
    ...sv,
    suggested_value_brl: DEMO_PRICES[sv.service_id] ?? null,
    active: true,
  }))

  // Base importada (se houver) + contas fictícias da demonstração.
  const accounts = structuredClone(demoAccounts)
  accounts.forEach((a) => (a.contacts || []).forEach((c) => { if (!c.id) c.id = uid() }))
  DEMO_ACCOUNTS.forEach(([name, segment, micro, size, tier, classification, source, contacts], i) => {
    accounts.push({
      id: `demo-${slug(name)}`,
      name,
      trade_name: null,
      cnpj: null,
      site: `www.${slug(name).split('-').slice(0, 2).join('')}.com.br`,
      classification,
      segment,
      micro_segment: micro,
      account_size: size,
      abm_tier: tier,
      entry_door: ['margem', 'adocao', 'crescimento'][i % 3],
      lead_source: source,
      origin_details: null,
      referred_by: source === 'indicacao' ? 'Cliente da base' : null,
      owner_id: users[i % users.length].id,
      crm_stage: 'lead',
      macro_categories: [], relationship_years: [], proposals: [],
      observations: null, status_base: null,
      created_at: daysAgoIso(today, 90 + i * 7),
      contacts: contacts.map(([cn, role], k) => ({
        id: uid(), name: cn, role,
        email: `${slug(cn).replace('-', '.')}@${slug(name).split('-')[0]}.com.br`,
        phone: null, birth_date: null, is_primary: k === 0,
      })),
    })
  })
  const demoAcc = accounts.filter((a) => a.id.startsWith('demo-'))

  // Originador do lead, comissão de indicação, campanha, sinais de intenção e
  // pontuação ICP — valores de exemplo, variados de propósito para as telas
  // mostrarem todos os casos.
  const originators = ['boomit', 'mypubli', 'carol', 'marcelo', 'edson', 'cristiano', 'outros']
  const commissionByOriginator = { boomit: 10, mypubli: 8, outros: 5 }
  const campaignByMarket = {
    'servicos-b2b': 'crescer-sem-estrutura',
    industria: 'ia-no-fluxo',
    'varejo-franquias': 'capacidade-por-unidade',
    'empresas-digitais': 'experimentacao-portfolio',
  }
  const signalPool = INTENT_SIGNALS.map((s) => s.id)
  const icpByTier = { '1:1': [25, 20, 13, 13, 8, 9, 4], '1:few': [18, 15, 11, 10, 6, 7, 3], '1:many': [12, 10, 8, 7, 5, 5, 2] }
  demoAcc.forEach((a, i) => {
    const originator = originators[i % originators.length]
    a.origin_source = originator
    a.origin_source_other = originator === 'outros' ? 'Parceiro de tecnologia' : null
    a.referral_commission = Boolean(commissionByOriginator[originator])
    a.referral_commission_pct = commissionByOriginator[originator] || null
    a.campaign = i % 5 === 4 ? 'autopilot' : campaignByMarket[a.segment]
    a.signals = i % 3 === 0 ? [signalPool[i % signalPool.length], signalPool[(i + 4) % signalPool.length]] : i % 3 === 1 ? [signalPool[(i + 2) % signalPool.length]] : []
    a.signal_notes = a.signals.length ? 'Sinal observado em notícia setorial e em vaga aberta.' : null
    const weights = icpByTier[a.abm_tier] || icpByTier['1:few']
    a.icp_scores = Object.fromEntries(ICP_DIMENSIONS.map((d, k) => [d.id, weights[k]]))
    a.icp_blockers = i === 12 ? [ICP_BLOCKERS[2]] : []
  })

  const account_services = []
  const tasks = []
  const cost_entries = []

  DEMO_OPPS.forEach(([ai, serviceId, stage, inStage, inPipeline, ownerIdx], oi) => {
    const acc = demoAcc[ai]
    const svc = services.find((x) => x.service_id === serviceId)
    const created = daysAgoIso(today, inPipeline)
    const entered = daysAgoIso(today, inStage)

    // Histórico: etapas anteriores dividindo o tempo entre criação e entrada na atual.
    const targetIdx = stage === 'perdido' || stage === 'standby' ? 2 + (oi % 2) : STAGE_PATH.indexOf(stage)
    const previous = STAGE_PATH.slice(0, Math.max(0, targetIdx))
    const history = []
    const span = inPipeline - inStage
    previous.forEach((st, k) => {
      const from = inPipeline - Math.round((span * k) / previous.length)
      const to = inPipeline - Math.round((span * (k + 1)) / previous.length)
      history.push({ stage: st, entered_at: daysAgoIso(today, from), left_at: daysAgoIso(today, to), days: from - to })
    })

    const opp = {
      id: `opp-${oi + 1}`,
      account_id: acc.id,
      service_id: svc.id,
      estimated_value_brl: svc.suggested_value_brl,
      interest: stage === 'fechado' ? 'ganho' : stage === 'perdido' ? 'perdido' : 'interessado',
      notes: null,
      stage,
      commercial_temp: TEMP_BY_STAGE[stage],
      owner_id: users[ownerIdx].id,
      created_at: created,
      stage_entered_at: entered,
      stage_history: history,
      standby_review_date: stage === 'standby' ? daysAgoIso(today, 10).slice(0, 10) : null,
      lost_reason: stage === 'perdido' ? (oi % 2 ? 'Preferiu fazer internamente' : 'Sem orçamento no momento') : null,
      proposal_link: ['proposta', 'negociacao', 'fechado'].includes(stage) ? 'https://docs.leadrix.com.br/propostas/exemplo' : null,
    }
    account_services.push(opp)

    // Ações já realizadas nas etapas percorridas (com custo lançado).
    const walked = [...previous, ...(STAGE_PATH.includes(stage) && stage !== 'fechado' ? [stage] : [])]
    walked.forEach((st, k) => {
      ;(PAST_ACTIONS[st] || []).forEach(([type, resources, expenses], j) => {
        if (st === 'qualificado' && type === 'diagnostico' && acc.abm_tier === '1:many') return
        const when = Math.max(1, inPipeline - Math.round(((k + (j + 1) / 3) / Math.max(1, walked.length)) * inPipeline))
        const date = daysAgoIso(today, when).slice(0, 10)
        const taskId = uid()
        tasks.push({
          id: taskId, account_id: acc.id, opportunity_id: opp.id, contact_id: acc.contacts[0]?.id || null,
          abm_play_id: null, title: `${TASK_TYPES[type].label} — ${acc.name}`, description: null,
          task_type: type, scheduled_date: date, scheduled_time: null, status: 'concluida',
          owner_id: opp.owner_id, effort: null, result_notes: null, service_ids: [svc.id], created_at: `${date}T12:00:00.000Z`,
        })
        resources.forEach((rid) => {
          cost_entries.push({
            id: uid(), account_id: acc.id, opportunity_id: opp.id, task_id: taskId, kind: 'hours',
            resource_id: rid, hours: sales_cost.task_hours[type], hourly_cost: Math.round(hourlyOf[rid] * 100) / 100,
            category_id: null, quantity: null, unit_cost: null, description: null, date, created_at: `${date}T12:00:00.000Z`,
          })
        })
        expenses.forEach(([cat, qty]) => {
          cost_entries.push({
            id: uid(), account_id: acc.id, opportunity_id: opp.id, task_id: taskId, kind: 'expense',
            resource_id: null, hours: null, hourly_cost: null, category_id: cat, quantity: qty, unit_cost: demoUnit[cat],
            description: null, date, created_at: `${date}T12:00:00.000Z`,
          })
        })
      })
    })

    // Contas 1:1 em proposta/negociação tiveram viagem de visita.
    if (acc.abm_tier === '1:1' && ['proposta', 'negociacao'].includes(stage)) {
      const date = daysAgoIso(today, inStage + 3).slice(0, 10)
      ;[['passagem', 2], ['hospedagem', 2], ['deslocamento', 4]].forEach(([cat, qty]) => {
        cost_entries.push({
          id: uid(), account_id: acc.id, opportunity_id: opp.id, task_id: null, kind: 'expense',
          resource_id: null, hours: null, hourly_cost: null, category_id: cat, quantity: qty, unit_cost: demoUnit[cat],
          description: 'Visita presencial ao sponsor', date, created_at: `${date}T12:00:00.000Z`,
        })
      })
    }
  })

  // Custo de marketing de conteúdo lançado na conta (rateado entre as oportunidades).
  demoAcc.filter((a) => a.abm_tier === '1:1').forEach((a, i) => {
    const date = daysAgoIso(today, 20 + i * 9).slice(0, 10)
    cost_entries.push({
      id: uid(), account_id: a.id, opportunity_id: null, task_id: null, kind: 'hours',
      resource_id: 'res-conteudo', hours: 6, hourly_cost: Math.round(hourlyOf['res-conteudo'] * 100) / 100,
      category_id: null, quantity: null, unit_cost: null, description: 'Conteúdo personalizado da conta (landing + artigo)', date, created_at: `${date}T12:00:00.000Z`,
    })
  })

  // Algumas ações futuras planejadas (Agenda).
  demoAcc.slice(0, 10).forEach((a, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + 2 + i * 2)
    const type = ['reuniao', 'ligacao', 'workshop', 'email', 'almoco'][i % 5]
    tasks.push({
      id: uid(), account_id: a.id, opportunity_id: null, contact_id: a.contacts[0]?.id || null, abm_play_id: null,
      title: `${TASK_TYPES[type].label} — ${a.name}`, description: null, task_type: type,
      scheduled_date: d.toISOString().slice(0, 10), scheduled_time: null, status: 'planejada',
      owner_id: a.owner_id, effort: null, result_notes: null, service_ids: [], created_at: today.toISOString(),
    })
  })

  const interactions = []
  const interactionTemplates = [
    { type: 'ligacao', summary: 'Ligação de qualificação: confirmou interesse em priorizar processos com maior retrabalho.' },
    { type: 'reuniao', summary: 'Reunião de descoberta com operações; mapeados sponsor e responsável de TI.' },
    { type: 'email', summary: 'Enviado artigo sobre governança de IA; respondeu pedindo agenda com o time.' },
    { type: 'evento', summary: 'Participou do Workshop Mensal Leadrix e perguntou sobre formação de multiplicadores.' },
  ]
  demoAcc.slice(0, 12).forEach((a, i) => {
    for (let k = 0; k < 1 + (i % 3); k++) {
      const t = interactionTemplates[(i + k) % interactionTemplates.length]
      interactions.push({ id: uid(), account_id: a.id, type: t.type, summary: t.summary, date: daysAgoIso(today, (k + 1) * 7 + i) })
    }
  })

  const strategies = {}
  const vertice = demoAcc[0]
  strategies[vertice.id] = {
    account_id: vertice.id,
    objective: 'Ser a parceira de referência em IA aplicada da consultoria nos próximos 12 meses, começando pelo diagnóstico e expandindo para estruturas híbridas.',
    value_proposition: 'Transformar a metodologia proprietária da Vértice em entregas mais rápidas e em produtos recorrentes, com governança.',
    key_messages: 'Método antes da ferramenta; margem por serviço; horas por entrega; propriedade intelectual protegida.',
    decision_makers: 'Ricardo Souza (sócio, sponsor econômico); Helena Prado (operações, campeã); TI terceirizada (influenciador).',
    channels: 'Almoço com sócios, Workshop Mensal Leadrix, LinkedIn da sócia fundadora, e-mail 1:1.',
    success_metrics: 'Diagnóstico contratado em 30 dias; proposta de redesenho em 60; primeiro pilar implantado em 120.',
    objections: 'Receio de expor a metodologia a ferramentas externas; agenda apertada dos sócios.',
    notes: 'Conta 1:1 do cluster de consultorias — usar como caso para o microssegmento.',
    hypothesis: 'O crescimento depende de contratar sênior porque a preparação de entregas é manual; automatizar pesquisa e documentos libera capacidade sem ampliar a estrutura.',
    affected_indicator: 'Horas por entrega e margem por serviço',
    entry_offer: 'Diagnóstico de trabalho intelectual e capacidade',
    expansion_plan: 'Depois do diagnóstico: estruturas híbridas para os papéis e, em 12 meses, produto recorrente a partir da metodologia.',
    updated_at: today.toISOString(),
  }

  // Mensageria: modelos de exemplo na estrutura sinal → hipótese →
  // consequência → convite, e algumas mensagens na fila.
  const email_templates = [
    {
      id: 'tpl-sinal',
      name: 'Primeiro contato a partir de um sinal',
      event: 'conta_criada',
      subject: '{{conta}}: uma hipótese sobre {{indicador}}',
      body: 'Olá, {{primeiro_nome}}.\n\nObservamos que a {{conta}} está passando por um movimento relevante no setor de {{microssegmento}}. Em operações com essa configuração, o desafio costuma aparecer quando o processo ainda depende de conferência manual — o que afeta {{indicador}}.\n\nEstamos analisando como empresas desse setor comparam processos, dados e capacidade antes de ampliar investimentos em IA. Vale reservarmos 30 minutos para avaliar quais atividades merecem prioridade e quais ainda não justificam implantação?\n\n{{assinatura}}',
      from_alias: null, auto: false, delay_days: 0, active: true,
      created_at: today.toISOString(), updated_at: today.toISOString(),
    },
    {
      id: 'tpl-diagnostico',
      name: 'Convite para conversa de diagnóstico',
      event: 'etapa_qualificado',
      subject: 'Conversa de diagnóstico — {{conta}} e {{pilar}}',
      body: 'Olá, {{primeiro_nome}}.\n\nPelo que conversamos, a hipótese é: {{hipotese}}\n\nNossa sugestão é uma conversa de diagnóstico de 45 minutos para validar isso com quem responde pelo processo, olhar a linha de base de {{indicador}} e sair com prioridades. Se fizer sentido, eu envio duas opções de horário.\n\n{{assinatura}}',
      from_alias: null, auto: true, delay_days: 1, active: true,
      created_at: today.toISOString(), updated_at: today.toISOString(),
    },
    {
      id: 'tpl-proposta',
      name: 'Envio de proposta com business case',
      event: 'etapa_proposta',
      subject: 'Proposta {{servico}} — {{conta}}',
      body: 'Olá, {{primeiro_nome}}.\n\nSegue a proposta de {{servico}} ({{pilar}}), com escopo, premissas e o impacto esperado em {{indicador}}.\n\nDeixei explícitos os critérios de continuidade: o que precisa acontecer para seguirmos para a fase seguinte e o que nos faria interromper. Podemos revisar juntos na próxima semana?\n\n{{assinatura}}',
      from_alias: null, auto: true, delay_days: 0, active: true,
      created_at: today.toISOString(), updated_at: today.toISOString(),
    },
    {
      id: 'tpl-fechado',
      name: 'Boas-vindas depois do fechamento',
      event: 'etapa_fechado',
      subject: 'Combinado, {{primeiro_nome}} — próximos passos da {{conta}}',
      body: 'Olá, {{primeiro_nome}}.\n\nObrigado pela confiança. Nos próximos dias enviamos o plano de implantação de {{servico}}, com responsáveis, marcos e os indicadores que vamos acompanhar — começando por {{indicador}}.\n\n{{assinatura}}',
      from_alias: null, auto: true, delay_days: 0, active: true,
      created_at: today.toISOString(), updated_at: today.toISOString(),
    },
  ]

  const email_messages = []
  demoAcc.slice(0, 5).forEach((a, i) => {
    const contact = (a.contacts || [])[0]
    if (!contact) return
    const tpl = email_templates[i % email_templates.length]
    const sentDays = 12 + i * 5
    email_messages.push({
      id: uid(), account_id: a.id, contact_id: contact.id,
      opportunity_id: account_services.find((o) => o.account_id === a.id)?.id || null,
      task_id: null, template_id: tpl.id, event: tpl.event,
      to_email: contact.email, to_name: contact.name,
      from_alias: 'marcelo@leadrix.com.br',
      subject: tpl.subject.replace('{{conta}}', a.name).replace('{{indicador}}', 'margem').replace('{{pilar}}', 'Agentes e Processos').replace('{{servico}}', 'Diagnóstico Leadrix').replace('{{primeiro_nome}}', contact.name.split(' ')[0]),
      body: 'Conteúdo enviado (exemplo de demonstração).',
      status: i === 0 ? 'rascunho' : i === 1 ? 'agendado' : 'enviado',
      scheduled_at: i === 1 ? daysAgoIso(today, -2) : null,
      sent_at: i > 1 ? daysAgoIso(today, sentDays) : null,
      error: null, provider_message_id: i > 1 ? `demo-${i}` : null,
      created_at: daysAgoIso(today, sentDays + 1),
    })
  })

  return {
    accounts,
    services,
    account_services,
    tasks,
    users,
    deals: [],
    strategies,
    interactions,
    lost_reasons: DEFAULT_LOST_REASONS.map((label, i) => ({ id: uid(), label, active: true, sort: i + 1 })),
    micro_segments: defaultMicroSegments(),
    sales_cost,
    cost_entries,
    contents: [],
    abm_dismissals: [],
    email_templates,
    email_messages,
    email_settings: null,
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const s = seed()
  saveState(s)
  return s
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function resetState() {
  localStorage.removeItem(KEY)
  return loadState()
}

// helper de mutação
export function mutate(fn) {
  const s = loadState()
  const result = fn(s)
  saveState(s)
  return result
}

export { uid }
