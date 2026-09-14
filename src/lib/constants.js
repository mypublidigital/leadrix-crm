// Taxonomias e enums do CRM (alinhados ao briefing §6, §7, §8).

export const CLASSIFICATIONS = {
  cliente: { label: 'Cliente', color: 'bg-emerald-100 text-emerald-700' },
  cliente_parceiro: { label: 'Cliente / Parceiro', color: 'bg-teal-100 text-teal-700' },
  parceiro: { label: 'Parceiro', color: 'bg-indigo-100 text-indigo-700' },
  lead: { label: 'Lead histórico', color: 'bg-ink-100 text-ink-600' },
}

// Conjunto de gestão ABM ativa (§4).
export const ABM_ACTIVE = ['cliente', 'cliente_parceiro']

export const SEGMENTS = {
  fintech: 'Fintech',
  banco: 'Banco',
  cooperativa: 'Cooperativa',
  'instituicao-pagamento': 'Instituição de Pagamento',
  'sociedade-credito': 'Sociedade de Crédito',
  'nao-financeiro': 'Não-financeiro',
}

export const ACCOUNT_SIZES = {
  seed: 'Seed (pré-operacional)',
  pme: 'PME (<500 contas)',
  'mid-market': 'Mid-market (500–50k)',
  enterprise: 'Enterprise (50k+)',
}

// Como o lead chegou até a Consulcard (reunião 12/08). Quando é "Indicação",
// o campo "Quem indicou" registra a pessoa/empresa que trouxe o lead.
export const LEAD_SOURCES = {
  indicacao: 'Indicação',
  evento: 'Evento / feira',
  inbound: 'Inbound (site, conteúdo)',
  prospeccao: 'Prospecção ativa',
  parceiro: 'Parceiro',
  base_historica: 'Base histórica',
  outro: 'Outro',
}

// O que preencher em "Detalhes da origem" para cada origem. O campo é texto
// livre — a dica só orienta, para a base não virar um amontoado de anotações
// soltas ("veio de feira" vs. "Febraban Tech 2026").
export const LEAD_SOURCE_DETAIL_HINT = {
  indicacao: 'Em que contexto veio a indicação',
  evento: 'Qual evento ou feira',
  inbound: 'Qual canal ou campanha',
  prospeccao: 'Qual lista, abordagem ou responsável',
  parceiro: 'Qual parceiro',
  base_historica: 'De qual base ou período',
  outro: 'Descreva a origem',
}

export const CRM_STAGES = {
  lead: { label: 'Lead', color: 'bg-ink-100 text-ink-600', order: 0 },
  qualificado: { label: 'Qualificado', color: 'bg-sky-100 text-sky-700', order: 1 },
  proposta: { label: 'Proposta', color: 'bg-amber-100 text-amber-700', order: 2 },
  negociacao: { label: 'Negociação', color: 'bg-orange-100 text-orange-700', order: 3 },
  fechado: { label: 'Fechado', color: 'bg-emerald-100 text-emerald-700', order: 4 },
  standby: { label: 'Stand by', color: 'bg-violet-100 text-violet-700', order: 5 },
  perdido: { label: 'Perdido', color: 'bg-rose-100 text-rose-700', order: 6 },
}

// Ordem das colunas do kanban do pipeline.
export const KANBAN_STAGES = ['lead', 'qualificado', 'proposta', 'negociacao', 'fechado', 'standby', 'perdido']

// A partir de qual etapa o link da proposta comercial fica disponível.
export const PROPOSAL_LINK_FROM = ['proposta', 'negociacao', 'fechado', 'standby']

// Termômetro comercial — substitui a antiga "Saúde". Probabilidade manual por conta.
export const THERMOMETER = {
  0: { label: '0% · Sem chance', short: '0%', color: 'bg-ink-400', text: 'text-ink-600', help: 'Sem condições de seguir no momento.' },
  50: { label: '50% · Em contato', short: '50%', color: 'bg-sky-400', text: 'text-sky-700', help: 'Em contato/andamento — conversa iniciada.' },
  60: { label: '60% · Perspectiva', short: '60%', color: 'bg-cyan-400', text: 'text-cyan-700', help: 'Há perspectiva, mas nada oficial ainda.' },
  75: { label: '75% · Negociação', short: '75%', color: 'bg-amber-400', text: 'text-amber-700', help: 'Em negociação — pode estar em compras/procurement.' },
  90: { label: '90% · Só falta assinar', short: '90%', color: 'bg-orange-500', text: 'text-orange-700', help: 'Praticamente fechado, só falta assinar.' },
  100: { label: '100% · Assinado', short: '100%', color: 'bg-emerald-500', text: 'text-emerald-700', help: 'Contrato assinado/fechado.' },
}

export const THERMOMETER_LEVELS = [0, 50, 60, 75, 90, 100]

export function thermo(value) {
  if (value == null) return null
  return THERMOMETER[value] || null
}

// Mantido por compatibilidade (não usar em telas novas).
export const HEALTH = {
  verde: { label: 'Saudável', color: 'bg-emerald-500', text: 'text-emerald-700' },
  amarelo: { label: 'Atenção', color: 'bg-amber-500', text: 'text-amber-700' },
  vermelho: { label: 'Risco', color: 'bg-rose-500', text: 'text-rose-700' },
}

export const TASK_TYPES = {
  landing_page: { label: 'Landing page', icon: 'Layout' },
  podcast: { label: 'Podcast', icon: 'Mic' },
  encontro: { label: 'Encontro', icon: 'Users' },
  ligacao: { label: 'Ligação', icon: 'Phone' },
  reuniao: { label: 'Reunião', icon: 'Video' },
  almoco: { label: 'Almoço', icon: 'Utensils' },
  evento: { label: 'Evento', icon: 'CalendarDays' },
  viagem: { label: 'Viagem', icon: 'Plane' },
  conteudo: { label: 'Conteúdo', icon: 'FileText' },
  outro: { label: 'Outro', icon: 'Tag' },
}

// Probabilidade de fechamento padrão por etapa do funil ABM (editável no futuro).
// Alimenta a previsão de faturamento ponderada da visão financeira.
export const STAGE_PROBABILITY = {
  lead: 0.1,
  qualificado: 0.25,
  proposta: 0.5,
  negociacao: 0.75,
  fechado: 1,
  standby: 0.2,
  perdido: 0,
}

// Motivos de não-venda padrão (editáveis na tela de Configurações).
export const DEFAULT_LOST_REASONS = [
  'Preço acima do orçamento',
  'Sem budget no momento',
  'Escolheu concorrente',
  'Projeto adiado pelo cliente',
  'Sem fit técnico/regulatório',
  'Decisor mudou de prioridade',
  'Sem resposta / esfriou',
  'Outro',
]

// Nível de interesse do lead em um serviço (vínculo conta↔serviço).
export const INTEREST_LEVELS = {
  explorando: { label: 'Explorando', color: 'bg-ink-100 text-ink-600' },
  interessado: { label: 'Interessado', color: 'bg-sky-100 text-sky-700' },
  proposto: { label: 'Proposto', color: 'bg-amber-100 text-amber-700' },
  ganho: { label: 'Ganho', color: 'bg-emerald-100 text-emerald-700' },
  perdido: { label: 'Perdido', color: 'bg-rose-100 text-rose-700' },
}

export const BILLING_MODELS = {
  milestone: 'Por marcos (milestone)',
  monthly: 'Mensal (recorrente)',
  fixed: 'Fixo (à vista)',
}

export function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

// `color` = classes do badge (fundo claro + texto). `chart` = preenchimento
// sólido para gráficos, na MESMA família de cor do badge (identidade consistente
// entre a lista e o gráfico), porém em passos próprios de visualização.
//
// A paleta `chart` foi validada (não escolhida no olho) contra a superfície
// branca do card, no modo all-pairs — num gráfico de pizza o leitor compara
// fatias não vizinhas: faixa de luminosidade PASS, separação sob
// protanopia/deuteranopia ΔE 8.5 (alvo ≥ 8) e piso de visão normal ΔE 16.5
// (piso ≥ 15). "Backlog" é cinza de propósito ("ainda não começou") — é a
// única cor abaixo do piso de croma, e por isso os gráficos sempre exibem
// rótulo + quantidade + percentual em texto, nunca a cor sozinha.
export const TASK_STATUS = {
  backlog: { label: 'Backlog', color: 'bg-ink-100 text-ink-600', chart: '#aab4bf' },
  planejada: { label: 'Planejada', color: 'bg-sky-100 text-sky-700', chart: '#0369a1' },
  em_execucao: { label: 'Em execução', color: 'bg-amber-100 text-amber-700', chart: '#f59e0b' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700', chart: '#10b981' },
  cancelada: { label: 'Cancelada', color: 'bg-rose-100 text-rose-700', chart: '#be123c' },
}
