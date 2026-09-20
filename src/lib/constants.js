// Taxonomias e enums do CRM Leadrix. Pilares e mercados moram em
// src/data/leadrix.js; aqui ficam os domínios do funil e do cadastro.

import { SEGMENT_LABELS } from '../data/leadrix'

export const CLASSIFICATIONS = {
  cliente: { label: 'Cliente', color: 'bg-emerald-100 text-emerald-700' },
  conta_alvo: { label: 'Conta-alvo (ICP)', color: 'bg-sky-100 text-sky-700' },
  parceiro: { label: 'Parceiro', color: 'bg-indigo-100 text-indigo-700' },
  lead: { label: 'Lead', color: 'bg-ink-100 text-ink-600' },
}

// Conjunto de gestão ABM ativa: contas-alvo selecionadas e clientes em expansão.
export const ABM_ACTIVE = ['cliente', 'conta_alvo']

// Os quatro macrossegmentos da Leadrix. Os microssegmentos ficam numa tabela
// editável (Config) ligada a estes ids.
export const SEGMENTS = SEGMENT_LABELS

// Porte por faturamento anual (faixas do BNDES, com recorte enterprise).
// A Leadrix atende principalmente empresas médias e grandes.
export const ACCOUNT_SIZES = {
  pequena: 'Pequena (até R$ 4,8 mi/ano)',
  media: 'Média (R$ 4,8 mi a 300 mi/ano)',
  grande: 'Grande (R$ 300 mi a 1 bi/ano)',
  enterprise: 'Enterprise (acima de R$ 1 bi/ano)',
}

// Nível de ABM (modelo ITSMA / ABM Leadership Alliance). Define a intensidade
// de personalização e o investimento aceitável por conta.
export const ABM_TIERS = {
  '1:1': { label: 'Nível 1 · 1:1 estratégico', short: 'N1 · 1:1', color: 'bg-brand-600 text-white', help: 'De 10 a 12 contas: pesquisa profunda, relacionamento com vários decisores e participação direta dos sócios.' },
  '1:few': { label: 'Nível 2 · 1:few por problema', short: 'N2 · 1:few', color: 'bg-brand-100 text-brand-700', help: 'De 25 a 35 contas: campanhas organizadas por problema, segmento ou contexto semelhante.' },
  '1:many': { label: 'Relacionamento · 1:many', short: '1:many', color: 'bg-ink-100 text-ink-600', help: 'Demais contas: relacionamento editorial, eventos e monitoramento até surgir sinal de intenção.' },
}

// Quem originou o lead (parceiro, empresa ou sócio). Diferente do canal de
// origem: aqui é a fonte da indicação, que pode gerar comissão.
export const LEAD_ORIGINATORS = {
  boomit: 'Boomit',
  mypubli: 'MyPubli',
  carol: 'Carol',
  marcelo: 'Marcelo',
  edson: 'Edson',
  cristiano: 'Cristiano',
  outros: 'Outros (especificar)',
}

// Canal por onde o lead chegou (workshop, evento, inbound…). Quem originou a
// indicação fica em LEAD_ORIGINATORS.
export const LEAD_SOURCES = {
  indicacao: 'Indicação',
  workshop: 'Workshop gratuito / mensal Leadrix',
  curso: 'Formação Executiva / curso',
  evento: 'Evento / palestra',
  inbound: 'Inbound (site, conteúdo)',
  linkedin: 'LinkedIn',
  prospeccao: 'Prospecção ativa (ABM)',
  parceiro: 'Parceiro',
  outro: 'Outro',
}

// O que preencher em "Detalhes da origem" para cada origem. O campo é texto
// livre — a dica só orienta, para a base não virar um amontoado de anotações
// soltas ("veio de workshop" vs. "Workshop mensal jan/26").
export const LEAD_SOURCE_DETAIL_HINT = {
  indicacao: 'Em que contexto veio a indicação',
  workshop: 'Qual edição do workshop',
  curso: 'Qual turma ou programa',
  evento: 'Qual evento ou palestra',
  inbound: 'Qual canal, conteúdo ou campanha',
  linkedin: 'Qual post, campanha ou abordagem',
  prospeccao: 'Qual lista, cluster ou responsável',
  parceiro: 'Qual parceiro',
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

// Etapas em que a oportunidade ainda está "viva" no funil.
export const OPEN_STAGES = ['lead', 'qualificado', 'proposta', 'negociacao', 'standby']

// A partir de qual etapa o link da proposta comercial fica disponível.
export const PROPOSAL_LINK_FROM = ['proposta', 'negociacao', 'fechado', 'standby']

// Termômetro comercial. Probabilidade manual por oportunidade.
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

// Tipos de ação ABM. `hours` é a sugestão inicial de esforço por pessoa (o
// valor efetivo fica editável em Config → Custo de venda).
export const TASK_TYPES = {
  ligacao: { label: 'Ligação', hours: 0.5 },
  email: { label: 'E-mail personalizado', hours: 0.5 },
  linkedin: { label: 'Toque no LinkedIn', hours: 0.25 },
  reuniao: { label: 'Reunião', hours: 1.5 },
  diagnostico: { label: 'Diagnóstico executivo', hours: 8 },
  workshop: { label: 'Workshop / convite', hours: 4 },
  almoco: { label: 'Almoço', hours: 2 },
  jantar: { label: 'Jantar executivo', hours: 3 },
  evento: { label: 'Evento', hours: 6 },
  viagem: { label: 'Viagem / visita', hours: 8 },
  conteudo: { label: 'Conteúdo personalizado', hours: 3 },
  proposta: { label: 'Proposta / business case', hours: 6 },
  brinde: { label: 'Envio físico / brinde', hours: 0.5 },
  landing_page: { label: 'Landing page da conta', hours: 6 },
  outro: { label: 'Outro', hours: 1 },
}

// Probabilidade de fechamento padrão por etapa do funil ABM.
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
  'Sem orçamento no momento',
  'Preço acima do esperado',
  'Preferiu fazer internamente',
  'Escolheu outro fornecedor / ferramenta',
  'Prioridade mudou (projeto adiado)',
  'Sem patrocinador executivo',
  'Receio de risco, segurança ou LGPD',
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
  per_seat: 'Por participante (educação)',
}

export function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value, digits = 0) {
  if (value == null || !isFinite(value)) return '—'
  return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}

// `color` = classes do badge (fundo claro + texto). `chart` = preenchimento
// sólido para gráficos, na MESMA família de cor do badge.
//
// A paleta `chart` foi validada contra a superfície branca do card, no modo
// all-pairs. "Backlog" é cinza de propósito ("ainda não começou") — por isso os
// gráficos sempre exibem rótulo + quantidade + percentual em texto, nunca a cor
// sozinha.
export const TASK_STATUS = {
  backlog: { label: 'Backlog', color: 'bg-ink-100 text-ink-600', chart: '#aab4bf' },
  planejada: { label: 'Planejada', color: 'bg-sky-100 text-sky-700', chart: '#0369a1' },
  em_execucao: { label: 'Em execução', color: 'bg-amber-100 text-amber-700', chart: '#f59e0b' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700', chart: '#10b981' },
  cancelada: { label: 'Cancelada', color: 'bg-rose-100 text-rose-700', chart: '#be123c' },
}
