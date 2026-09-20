import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, Copy, Check, Save, RefreshCw, Loader2, Newspaper, Linkedin, Instagram, Mail } from 'lucide-react'
import Modal from './Modal'
import { MARKETS, MARKET_IDS, PILLARS, PILLAR_IDS } from '../data/leadrix'
import { CRM_STAGES, ABM_TIERS } from '../lib/constants'
import { generateContent, CONTENT_FORMATS, CONTENT_STATUS, FUNNEL_OBJECTIVE } from '../lib/content'
import { CONTENT_ASSETS, MESSAGE_STRUCTURE } from '../data/abmContext'
import { createEmailMessage, listEmailSettings } from '../lib/data'
import { pickRecipient } from '../lib/messaging'
import { saveContent as persist } from '../lib/data'
import { useAccounts, useMicroSegments } from '../lib/hooks'

const FORMAT_ICON = { blog: Newspaper, linkedin: Linkedin, instagram: Instagram, email: Mail }

export const EMPTY_BRIEF = {
  format: 'linkedin', account_id: '', personalize: false, segment: '', micro_segment: '', pillar: '',
  persona: '', stage: 'lead', angle: '', opportunity_id: '', play_id: '',
}

// Estúdio de conteúdo: briefing → geração → edição → biblioteca.
// Recebe `initial` (briefing vindo de uma jogada ABM ou de um item salvo).
export default function ContentComposer({ initial, onSaved, compact = false }) {
  const qc = useQueryClient()
  const { data: accounts = [] } = useAccounts()
  const { data: micros = [] } = useMicroSegments()

  const [brief, setBrief] = useState({ ...EMPTY_BRIEF, ...(initial || {}), personalize: initial?.personalize ?? Boolean(initial?.account_id) })
  const [draft, setDraft] = useState(initial?.body ? {
    id: initial.id, title: initial.title, body: initial.body, meta_description: initial.meta_description,
    hashtags: initial.hashtags || [], cta: initial.cta, generated_by: initial.generated_by, status: initial.status || 'rascunho',
  } : null)
  const [variant, setVariant] = useState(0)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const account = accounts.find((a) => a.id === brief.account_id) || null
  const market = MARKETS[brief.segment] || null
  const set = (patch) => setBrief((b) => ({ ...b, ...patch }))

  function pickAccount(id) {
    const a = accounts.find((x) => x.id === id)
    set({
      account_id: id,
      personalize: Boolean(id) && brief.format === 'email' ? true : brief.personalize && Boolean(id),
      segment: a?.segment || brief.segment,
      micro_segment: a?.micro_segment || brief.micro_segment,
    })
  }

  const microOptions = useMemo(() => micros.filter((m) => !brief.segment || m.segment === brief.segment), [micros, brief.segment])

  async function run(nextVariant = variant) {
    setBusy(true); setErr(''); setSavedMsg('')
    try {
      const out = await generateContent({ ...brief, variant: nextVariant }, account)
      setDraft((d) => ({ ...out, id: d?.id, status: d?.status || 'rascunho' }))
      setVariant(nextVariant)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft) return
    setSaving(true); setErr('')
    try {
      const { id } = await persist({ ...brief, ...draft })
      setDraft((d) => ({ ...d, id }))
      qc.invalidateQueries({ queryKey: ['contents'] })
      setSavedMsg('Salvo na biblioteca.')
      onSaved?.(id)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  // E-mail gerado aqui não é enviado direto: entra como rascunho na fila da
  // mensageria, para alguém revisar antes de sair para o lead.
  async function queueEmail() {
    if (!draft || !account) return
    setSaving(true); setErr('')
    try {
      const contact = pickRecipient(account)
      if (!contact) throw new Error('A conta não tem contato com e-mail cadastrado.')
      const settings = await listEmailSettings()
      // A primeira linha do corpo costuma ser "Assunto: ..." — vira o assunto.
      const lines = String(draft.body || '').split('\n')
      const hasSubjectLine = /^assunto:/i.test(lines[0] || '')
      await createEmailMessage({
        account_id: account.id,
        contact_id: contact.id,
        opportunity_id: brief.opportunity_id || null,
        event: 'manual',
        to_email: contact.email,
        to_name: contact.name,
        from_alias: settings.default_alias,
        subject: hasSubjectLine ? lines[0].replace(/^assunto:\s*/i, '') : draft.title || '',
        body: (hasSubjectLine ? lines.slice(1).join('\n') : draft.body).trim(),
        status: 'rascunho',
      })
      qc.invalidateQueries({ queryKey: ['email-messages'] })
      setSavedMsg('E-mail criado como rascunho na Mensageria — revise antes de enviar.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  function copy() {
    const text = [draft.title && brief.format === 'blog' ? '' : null, draft.body, draft.hashtags?.length ? `\n${draft.hashtags.join(' ')}` : '']
      .filter((x) => x !== null).join('\n')
    navigator.clipboard?.writeText(text.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`grid grid-cols-1 gap-5 ${compact ? '' : 'xl:grid-cols-5'}`}>
      {/* Briefing */}
      <div className={`space-y-3 ${compact ? '' : 'xl:col-span-2'}`}>
        <div>
          <label className="label">Formato</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {Object.entries(CONTENT_FORMATS).map(([k, f]) => {
              const Icon = FORMAT_ICON[k]
              return (
                <button key={k} onClick={() => set({ format: k, personalize: k === 'email' ? Boolean(brief.account_id) : brief.personalize })}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                    brief.format === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}>
                  <Icon size={14} /> {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Conta (opcional — ABM 1:1)</label>
            <select className="input" value={brief.account_id} onChange={(e) => pickAccount(e.target.value)}>
              <option value="">Sem conta — conteúdo por segmento (1:few / 1:many)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.abm_tier ? ` · ${ABM_TIERS[a.abm_tier]?.short}` : ''}</option>
              ))}
            </select>
            {account && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={brief.personalize} onChange={(e) => set({ personalize: e.target.checked })} />
                Personalizar com o nome e os dados da conta (não use em conteúdo público)
              </label>
            )}
          </div>
          <div>
            <label className="label">Mercado</label>
            <select className="input" value={brief.segment} onChange={(e) => set({ segment: e.target.value, micro_segment: '', persona: '' })}>
              <option value="">Todos</option>
              {MARKET_IDS.map((k) => <option key={k} value={k}>{MARKETS[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Microssegmento</label>
            <select className="input" value={brief.micro_segment} onChange={(e) => set({ micro_segment: e.target.value })}>
              <option value="">—</option>
              {microOptions.map((m) => <option key={m.id} value={m.label}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pilar</label>
            <select className="input" value={brief.pillar} onChange={(e) => set({ pillar: e.target.value })}>
              <option value="">Os quatro pilares</option>
              {PILLAR_IDS.map((k) => <option key={k} value={k}>{PILLARS[k].short}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Persona</label>
            <input className="input" list="personas-conteudo" value={brief.persona} onChange={(e) => set({ persona: e.target.value })} placeholder="Decisor-alvo" />
            <datalist id="personas-conteudo">
              {(market?.personas || MARKET_IDS.flatMap((k) => MARKETS[k].personas)).filter((v, i, a) => a.indexOf(v) === i).map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Etapa do funil (objetivo)</label>
            <select className="input" value={brief.stage} onChange={(e) => set({ stage: e.target.value })}>
              {Object.keys(FUNNEL_OBJECTIVE).map((k) => <option key={k} value={k}>{CRM_STAGES[k].label} — {FUNNEL_OBJECTIVE[k]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ângulo / mensagem central</label>
            <textarea className="input min-h-[70px]" value={brief.angle} onChange={(e) => set({ angle: e.target.value })}
              placeholder="Ex.: Por que pilotos de IA na indústria não escalam — e o critério de prioridade que resolve." />
            <div className="mt-1.5">
              <div className="eyebrow mb-1">Ativos da biblioteca ABM</div>
              <div className="flex flex-wrap gap-1">
                {CONTENT_ASSETS.slice(0, 6).map((a) => (
                  <button key={a} onClick={() => set({ angle: a })}
                    className="chip bg-ink-100 text-ink-600 hover:bg-brand-100 hover:text-brand-700">{a}</button>
                ))}
              </div>
            </div>
            {brief.format === 'email' && (
              <p className="mt-1.5 text-[11px] text-ink-500">
                Estrutura da mensagem: {MESSAGE_STRUCTURE.join(' → ').replace(/\.$/g, '')}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => run(variant)} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar conteúdo
          </button>
          {draft && (
            <button className="btn-outline" onClick={() => run(variant + 1)} disabled={busy}>
              <RefreshCw size={16} /> Outra versão
            </button>
          )}
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        {market && (
          <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
            <div className="eyebrow mb-1">Contexto usado</div>
            <p><b>Dores:</b> {market.pains.slice(0, 2).join('; ')}.</p>
            <p className="mt-1"><b>Indicadores:</b> {market.indicators.join(', ')}.</p>
          </div>
        )}
      </div>

      {/* Resultado */}
      <div className={compact ? '' : 'xl:col-span-3'}>
        {!draft && !busy && (
          <div className="grid h-full min-h-[320px] place-items-center rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">
            <div>
              <img src="/mark-positive.png" alt="" className="mx-auto mb-3 h-10 opacity-60" />
              Defina o briefing e gere o conteúdo. A voz da Leadrix — consultiva, anti-hype, orientada a indicador — é aplicada automaticamente.
            </div>
          </div>
        )}
        {busy && !draft && (
          <div className="grid min-h-[320px] place-items-center text-sm text-ink-500"><Loader2 className="animate-spin" /></div>
        )}
        {draft && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-ink-900 text-white">{CONTENT_FORMATS[brief.format]?.label}</span>
              <span className="chip bg-ink-100 text-ink-600">{draft.generated_by === 'ia' ? 'gerado por IA' : 'modelo (modo demo)'}</span>
              <select className="input ml-auto w-auto py-1 text-xs" value={draft.status || 'rascunho'} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                {Object.entries(CONTENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Título</label>
              <input className="input font-semibold" value={draft.title || ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            {brief.format === 'blog' && (
              <div>
                <label className="label">Meta description ({(draft.meta_description || '').length}/160)</label>
                <input className="input" value={draft.meta_description || ''} onChange={(e) => setDraft((d) => ({ ...d, meta_description: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="label">Texto</label>
              <textarea className={`input font-mono text-[13px] leading-relaxed ${compact ? 'min-h-[300px]' : 'min-h-[460px]'}`} value={draft.body || ''}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
              <p className="mt-1 text-[11px] text-ink-400">{(draft.body || '').length.toLocaleString('pt-BR')} caracteres{brief.format === 'linkedin' && (draft.body || '').length > 3000 ? ' — acima do limite do LinkedIn (3.000)' : ''}</p>
            </div>
            {draft.hashtags?.length > 0 && (
              <div>
                <label className="label">Hashtags</label>
                <input className="input" value={draft.hashtags.join(' ')} onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value.split(/\s+/).filter(Boolean) }))} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Salvando…' : draft.id ? 'Atualizar na biblioteca' : 'Salvar na biblioteca'}</button>
              <button className="btn-outline" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar'}</button>
              {brief.format === 'email' && account && (
                <button className="btn-outline" onClick={queueEmail} disabled={saving}>
                  <Mail size={16} /> Enviar para a fila de e-mails
                </button>
              )}
              {savedMsg && <span className="text-xs text-accent-700">{savedMsg}</span>}
            </div>
            <p className="text-[11px] text-ink-400">Revise antes de publicar: confira números, nomes e qualquer afirmação sobre clientes.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ContentModal({ initial, onClose }) {
  return (
    <Modal title="Gerar conteúdo ABM" onClose={onClose} wide>
      <ContentComposer initial={initial} compact />
    </Modal>
  )
}
