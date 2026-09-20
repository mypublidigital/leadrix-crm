import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Library } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ContentComposer, { ContentModal } from '../components/ContentComposer'
import { PillarBadge } from '../components/SegmentFilters'
import { useContents, useAccounts } from '../lib/hooks'
import { deleteContent } from '../lib/data'
import { CONTENT_FORMATS, CONTENT_STATUS } from '../lib/content'
import { MARKETS } from '../data/leadrix'

export default function Conteudo() {
  const qc = useQueryClient()
  const { data: contents = [] } = useContents()
  const { data: accounts = [] } = useAccounts()
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const [format, setFormat] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [composerKey, setComposerKey] = useState(0)

  const list = contents.filter((c) => (!format || c.format === format) && (!status || c.status === status))

  async function remove(c) {
    if (!window.confirm(`Apagar "${c.title || 'sem título'}" da biblioteca?`)) return
    await deleteContent(c.id)
    qc.invalidateQueries({ queryKey: ['contents'] })
  }

  return (
    <>
      <PageHeader
        eyebrow="ABM inteligente"
        title="Estúdio de conteúdo"
        subtitle="Blog posts, posts para LinkedIn e Instagram e e-mails 1:1 — alinhados a mercado, microssegmento, pilar, persona e etapa do funil."
        actions={<button className="btn-outline" onClick={() => setComposerKey((k) => k + 1)}>Novo briefing</button>}
      />
      <div className="space-y-5 p-6">
        <div className="card p-5">
          <ContentComposer key={composerKey} />
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Library size={16} className="text-brand-500" /> Biblioteca ({contents.length})</h2>
            <select className="input ml-auto w-auto py-1.5 text-xs" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Todos os formatos</option>
              {Object.entries(CONTENT_FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input w-auto py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(CONTENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5">Título</th>
                <th className="px-4 py-2.5">Formato</th>
                <th className="px-4 py-2.5">Alvo</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Atualizado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                  <td className="px-4 py-2.5">
                    <button className="text-left font-medium text-ink-900 hover:text-brand-600" onClick={() => setOpen(c)}>{c.title || 'Sem título'}</button>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{CONTENT_FORMATS[c.format]?.label || c.format}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1 text-xs text-ink-600">
                      {c.account_id && <span className="font-semibold">{accName.get(c.account_id)}</span>}
                      {c.segment && <span>{MARKETS[c.segment]?.label}{c.micro_segment ? ` · ${c.micro_segment}` : ''}</span>}
                      {c.pillar && <PillarBadge id={c.pillar} />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><span className={`chip ${CONTENT_STATUS[c.status]?.color}`}>{CONTENT_STATUS[c.status]?.label}</span></td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">{new Date(c.updated_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => remove(c)} aria-label="Apagar"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">Nada salvo ainda. Gere um conteúdo acima ou a partir de uma jogada do Radar ABM.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {open && <ContentModal initial={open} onClose={() => setOpen(null)} />}
    </>
  )
}
