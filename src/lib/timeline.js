// Timeline de relacionamento com a conta: todos os toques em ordem, vindos de
// lugares diferentes do CRM — ações ABM, interações registradas, e-mails da
// mensageria, criação e movimentação de oportunidades e conteúdo produzido.
//
// É a memória da conta: alimenta a leitura do time, o co-piloto e a métrica de
// engajamento ("a conta saiu de contato isolado para discussão corporativa?").

import { CRM_STAGES, TASK_TYPES, TASK_STATUS } from './constants'
import { PILLARS } from '../data/leadrix'
import { CONTENT_FORMATS } from '../data/abmPlaybook'
import { EMAIL_STATUS } from './messaging'

export const TIMELINE_TYPES = {
  conta: { label: 'Conta', icon: 'Building2', color: 'bg-ink-900 text-white' },
  oportunidade: { label: 'Oportunidade', icon: 'Briefcase', color: 'bg-brand-100 text-brand-700' },
  etapa: { label: 'Etapa do funil', icon: 'GitBranch', color: 'bg-sky-100 text-sky-700' },
  acao: { label: 'Ação ABM', icon: 'CalendarCheck', color: 'bg-accent-100 text-accent-800' },
  interacao: { label: 'Interação', icon: 'MessageSquare', color: 'bg-violet-100 text-violet-700' },
  email: { label: 'E-mail', icon: 'Mail', color: 'bg-amber-100 text-amber-800' },
  conteudo: { label: 'Conteúdo', icon: 'PenLine', color: 'bg-indigo-100 text-indigo-700' },
}

const day = (v) => (v ? String(v).slice(0, 10) : null)
const at = (v) => (v && String(v).length <= 10 ? `${v}T12:00:00.000Z` : v)

/**
 * @returns [{ id, at, type, title, detail, badge, done }] em ordem decrescente.
 */
export function buildTimeline({ account, tasks = [], interactions = [], emails = [], opportunities = [], contents = [] }) {
  const items = []
  const svcName = (o) => o?.service?.name || o?.service_id || 'serviço'

  if (account?.created_at) {
    items.push({
      id: `conta-${account.id}`,
      at: at(account.created_at),
      type: 'conta',
      title: 'Conta criada no CRM',
      detail: [account.lead_source_label, account.origin_label].filter(Boolean).join(' · ') || null,
    })
  }

  opportunities.forEach((o) => {
    items.push({
      id: `opp-${o.id}`,
      at: at(o.created_at),
      type: 'oportunidade',
      title: `Oportunidade criada: ${svcName(o)}`,
      detail: PILLARS[o.service?.macro_id]?.short || null,
      badge: CRM_STAGES[o.stage]?.label,
    })
    // Histórico de etapas: cada saída de etapa é um movimento do funil.
    ;(Array.isArray(o.stage_history) ? o.stage_history : []).forEach((h, i) => {
      if (!h.left_at) return
      items.push({
        id: `stage-${o.id}-${i}`,
        at: at(h.left_at),
        type: 'etapa',
        title: `${svcName(o)}: saiu de ${CRM_STAGES[h.stage]?.label || h.stage}`,
        detail: `${h.days ?? 0} dia(s) na etapa`,
      })
    })
    if (o.stage_entered_at && (o.stage_history || []).length) {
      items.push({
        id: `stage-current-${o.id}`,
        at: at(o.stage_entered_at),
        type: 'etapa',
        title: `${svcName(o)}: entrou em ${CRM_STAGES[o.stage]?.label || o.stage}`,
        detail: o.stage === 'perdido' ? o.lost_reason : o.stage === 'standby' ? `revisar em ${o.standby_review_date || '—'}` : null,
      })
    }
  })

  tasks.forEach((t) => {
    const done = t.status === 'concluida'
    items.push({
      id: `task-${t.id}`,
      at: at(t.scheduled_date || t.created_at),
      type: 'acao',
      title: t.title,
      detail: TASK_TYPES[t.task_type]?.label || t.task_type,
      badge: TASK_STATUS[t.status]?.label,
      done,
      future: !done && day(t.scheduled_date) > day(new Date().toISOString()),
      taskId: t.id,
    })
  })

  interactions.forEach((i) => {
    items.push({
      id: `int-${i.id}`,
      at: at(i.date),
      type: 'interacao',
      title: i.summary,
      detail: i.type,
      done: true,
    })
  })

  emails.forEach((e) => {
    items.push({
      id: `mail-${e.id}`,
      at: at(e.sent_at || e.scheduled_at || e.created_at),
      type: 'email',
      title: e.subject,
      detail: `para ${e.to_name || e.to_email}${e.from_alias ? ` · de ${e.from_alias}` : ''}`,
      badge: EMAIL_STATUS[e.status]?.label,
      done: e.status === 'enviado',
      future: e.status === 'agendado',
    })
  })

  contents.forEach((c) => {
    items.push({
      id: `content-${c.id}`,
      at: at(c.updated_at || c.created_at),
      type: 'conteudo',
      title: c.title || 'Conteúdo sem título',
      detail: CONTENT_FORMATS[c.format]?.label || c.format,
      badge: c.status,
      done: c.status === 'publicado',
    })
  })

  return items
    .filter((i) => i.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

/** Resumo para a régua de engajamento da conta. */
export function timelineSummary(items) {
  const count = (type) => items.filter((i) => i.type === type).length
  const touches = items.filter((i) => ['acao', 'interacao', 'email'].includes(i.type) && i.done)
  const last = touches[0]
  return {
    total: items.length,
    touches: touches.length,
    lastTouchAt: last?.at || null,
    lastTouchTitle: last?.title || null,
    byType: Object.fromEntries(Object.keys(TIMELINE_TYPES).map((t) => [t, count(t)])),
    upcoming: items.filter((i) => i.future).length,
  }
}
