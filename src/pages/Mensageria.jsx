import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Send, Plus, Trash2, Pencil, X, Loader2, AlertTriangle, Save, Inbox, FileText, AtSign, Info,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import InfoTip from '../components/InfoTip'
import { useAccounts, useEmailTemplates, useEmailMessages, useEmailSettings, useOpportunities } from '../lib/hooks'
import {
  saveEmailTemplate, deleteEmailTemplate, saveEmailSettings,
  createEmailMessage, updateEmailMessage, deleteEmailMessage, DEMO_MODE,
} from '../lib/data'
import {
  EMAIL_EVENTS, EMAIL_EVENT_IDS, EMAIL_STATUS, EMAIL_PLACEHOLDERS,
  renderTemplate, pickRecipient, sendEmail,
} from '../lib/messaging'
import { MESSAGE_STRUCTURE, MESSAGE_MODEL } from '../data/abmContext'
import { useAuth } from '../lib/useAuth'

export default function Mensageria() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const { data: messages = [] } = useEmailMessages()
  const { data: templates = [] } = useEmailTemplates()
  const { data: settings } = useEmailSettings()
  const { data: accounts = [] } = useAccounts()

  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(null)   // mensagem em edição/leitura
  const [composing, setComposing] = useState(false)
  const [tplEditing, setTplEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const list = messages.filter((m) => !status || m.status === status)
  const counts = useMemo(() => {
    const c = {}
    messages.forEach((m) => { c[m.status] = (c[m.status] || 0) + 1 })
    return c
  }, [messages])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['email-messages'] })
    qc.invalidateQueries({ queryKey: ['email-templates'] })
  }

  async function send(m) {
    setBusyId(m.id); setErr('')
    try {
      const r = await sendEmail(m)
      await updateEmailMessage(m.id, {
        status: 'enviado',
        sent_at: new Date().toISOString(),
        provider_message_id: r?.provider_message_id || null,
        error: null,
      })
    } catch (e) {
      await updateEmailMessage(m.id, { status: 'erro', error: e.message })
      setErr(e.message)
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  async function cancel(m) {
    await updateEmailMessage(m.id, { status: 'cancelado' })
    refresh()
  }

  async function remove(m) {
    if (!window.confirm('Apagar esta mensagem da fila?')) return
    await deleteEmailMessage(m.id)
    refresh()
  }

  return (
    <>
      <PageHeader
        eyebrow="ABM inteligente"
        title="Mensageria"
        subtitle="E-mails para o lead a partir do Gmail da Leadrix: modelos por evento do CRM, fila com revisão e envio manual."
        actions={<button className="btn-primary" onClick={() => setComposing(true)}><Plus size={16} /> Novo e-mail</button>}
      />
      <div className="space-y-5 p-6">
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}

        {/* Fila */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Inbox size={16} className="text-brand-500" /> Fila de envio ({messages.length})
              <InfoTip>Todo e-mail nasce aqui. Modelo em automático já entra como “agendado”; os outros ficam em “rascunho” para alguém revisar. O envio sai quando você clica em Enviar.</InfoTip>
            </h2>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button onClick={() => setStatus('')} className={`chip ${!status ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600'}`}>Todos</button>
              {Object.entries(EMAIL_STATUS).map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)} className={`chip ${status === k ? 'bg-ink-900 text-white' : v.color}`} title={v.help}>
                  {v.label} {counts[k] || 0}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Assunto</th>
                  <th className="px-4 py-2.5">Conta · destinatário</th>
                  <th className="px-4 py-2.5">Evento</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium text-ink-900 hover:text-brand-600" onClick={() => setEditing(m)}>
                        {m.subject || '(sem assunto)'}
                      </button>
                      {m.error && <div className="text-xs text-rose-600">{m.error}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">
                      <Link to={`/contas/${m.account_id}`} className="font-semibold hover:text-brand-600">{accById.get(m.account_id)?.name || '—'}</Link>
                      <div>{m.to_name || m.to_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">{EMAIL_EVENTS[m.event]?.label || m.event}</td>
                    <td className="px-4 py-2.5"><span className={`chip ${EMAIL_STATUS[m.status]?.color}`}>{EMAIL_STATUS[m.status]?.label}</span></td>
                    <td className="px-4 py-2.5 text-xs text-ink-500">
                      {new Date(m.sent_at || m.scheduled_at || m.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {['rascunho', 'agendado', 'erro'].includes(m.status) && can('email.send') && (
                          <button className="btn-primary py-1 text-xs" onClick={() => send(m)} disabled={busyId === m.id}>
                            {busyId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
                          </button>
                        )}
                        {['rascunho', 'agendado'].includes(m.status) && (
                          <button className="btn-ghost py-1 text-xs" onClick={() => cancel(m)}><X size={14} /></button>
                        )}
                        <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => remove(m)} aria-label="Apagar"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">Nada na fila com esse filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Modelos */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><FileText size={16} className="text-brand-500" /> Modelos por evento</h2>
              {can('templates.manage') && (
                <button className="btn-outline py-1 text-xs" onClick={() => setTplEditing({ event: 'manual', auto: false, delay_days: 0, active: true })}>
                  <Plus size={14} /> Modelo
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Modelo</th><th className="px-4 py-2.5">Evento</th><th className="px-4 py-2.5 text-center">Automático</th><th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink-900">{t.name}</div>
                      <div className="truncate text-xs text-ink-500">{t.subject}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">{EMAIL_EVENTS[t.event]?.label || t.event}</td>
                    <td className="px-4 py-2.5 text-center">
                      {t.auto
                        ? <span className="chip bg-accent-100 text-accent-800">{t.delay_days ? `+${t.delay_days}d` : 'sim'}</span>
                        : <span className="chip bg-ink-100 text-ink-500">não</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {can('templates.manage') && (
                        <div className="flex items-center justify-end gap-1">
                          <button className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-600" onClick={() => setTplEditing(t)} aria-label="Editar"><Pencil size={14} /></button>
                          <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                            onClick={async () => { if (window.confirm(`Apagar o modelo "${t.name}"?`)) { await deleteEmailTemplate(t.id); refresh() } }}
                            aria-label="Apagar"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-500">Nenhum modelo cadastrado.</td></tr>}
              </tbody>
            </table>
            <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-600">
              <div className="eyebrow mb-1">Estrutura da mensagem ABM</div>
              <ol className="list-decimal space-y-0.5 pl-4">{MESSAGE_STRUCTURE.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          </div>

          {/* Remetente */}
          <SenderCard settings={settings} canEdit={can('templates.manage')} onSaved={() => qc.invalidateQueries({ queryKey: ['email-settings'] })} />
        </div>
      </div>

      {composing && (
        <ComposeModal
          accounts={accounts}
          templates={templates}
          settings={settings}
          onClose={(created) => { setComposing(false); if (created) refresh() }}
        />
      )}
      {editing && (
        <MessageModal
          message={editing}
          account={accById.get(editing.account_id)}
          onSend={send}
          onClose={(changed) => { setEditing(null); if (changed) refresh() }}
        />
      )}
      {tplEditing && (
        <TemplateModal template={tplEditing} settings={settings} onClose={(saved) => { setTplEditing(null); if (saved) refresh() }} />
      )}
    </>
  )
}

function SenderCard({ settings, canEdit, onSaved }) {
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [alias, setAlias] = useState('')
  const state = f || settings
  if (!state) return <div className="card p-5 text-sm text-ink-500">Carregando…</div>
  const set = (patch) => setF({ ...state, ...patch })

  async function save() {
    setBusy(true); setMsg('')
    try {
      await saveEmailSettings(state)
      setMsg('Configuração salva.')
      onSaved?.()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900"><AtSign size={16} className="text-brand-500" /> Remetente</h2>
      <div className="space-y-3">
        <div>
          <label className="label">Nome de quem assina</label>
          <input className="input" value={state.from_name || ''} disabled={!canEdit} onChange={(e) => set({ from_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Conta Gmail (caixa de envio)</label>
          <input className="input" value={state.from_email || ''} disabled={!canEdit} onChange={(e) => set({ from_email: e.target.value })} />
        </div>
        <div>
          <label className="label flex items-center gap-1">
            Aliases autorizados
            <InfoTip>Endereços que o Gmail dessa conta pode usar como remetente (Configurações → Contas → Enviar e-mail como). O alias escolhido vai no campo De.</InfoTip>
          </label>
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {(state.aliases || []).map((a) => (
              <li key={a} className={`chip ${a === state.default_alias ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-700'}`}>
                {a}
                {canEdit && (
                  <>
                    {a !== state.default_alias && (
                      <button className="ml-1 text-ink-400 hover:text-brand-600" title="Tornar padrão" onClick={() => set({ default_alias: a })}>★</button>
                    )}
                    <button className="ml-1 text-ink-400 hover:text-rose-500" onClick={() => set({ aliases: state.aliases.filter((x) => x !== a) })}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="flex gap-2">
              <input className="input" placeholder="novo@leadrix.com.br" value={alias} onChange={(e) => setAlias(e.target.value)} />
              <button className="btn-outline shrink-0" disabled={!alias.includes('@')}
                onClick={() => { set({ aliases: [...(state.aliases || []), alias.trim()] }); setAlias('') }}>
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="label">Assinatura</label>
          <textarea className="input min-h-[60px]" value={state.signature || ''} disabled={!canEdit} onChange={(e) => set({ signature: e.target.value })} />
        </div>
        <label className="flex items-start gap-2 text-sm text-ink-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-ink-300" checked={Boolean(state.auto_enabled)} disabled={!canEdit}
            onChange={(e) => set({ auto_enabled: e.target.checked })} />
          <span>
            Permitir envios automáticos
            <span className="block text-xs text-ink-500">Com a trava desligada, os modelos automáticos continuam gerando a mensagem, mas ela fica na fila aguardando envio.</span>
          </span>
        </label>
        {canEdit && (
          <button className="btn-primary" onClick={save} disabled={busy || !f}><Save size={16} /> {busy ? 'Salvando…' : 'Salvar'}</button>
        )}
        {msg && <p className="text-xs text-ink-600">{msg}</p>}
        <div className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          <Info size={14} className="mt-0.5 shrink-0 text-ink-400" />
          <span>
            {DEMO_MODE
              ? 'Em demonstração o envio é simulado. Em produção, o e-mail sai pela Edge Function crm-email usando a API do Gmail.'
              : 'O envio usa a Edge Function crm-email com a API do Gmail. Enquanto as credenciais (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) não estiverem configuradas, a mensagem fica na fila com o erro explicado.'}
          </span>
        </div>
      </div>
    </div>
  )
}

function TemplateModal({ template, settings, onClose }) {
  const [f, setF] = useState({
    id: template.id, name: template.name || '', event: template.event || 'manual',
    subject: template.subject || '', body: template.body || '',
    from_alias: template.from_alias || '', auto: Boolean(template.auto),
    delay_days: template.delay_days || 0, active: template.active !== false,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await saveEmailTemplate(f)
      onClose(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={f.id ? `Editar modelo — ${template.name}` : 'Novo modelo de e-mail'} onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy || !f.name || !f.subject}>{busy ? 'Salvando…' : 'Salvar modelo'}</button>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className="label">Nome</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div>
          <label className="label">Evento do CRM</label>
          <select className="input" value={f.event} onChange={set('event')}>
            {EMAIL_EVENT_IDS.map((k) => <option key={k} value={k}>{EMAIL_EVENTS[k].label}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-500">{EMAIL_EVENTS[f.event]?.help}</p>
        </div>
        <div className="sm:col-span-2"><label className="label">Assunto</label><input className="input" value={f.subject} onChange={set('subject')} /></div>
        <div className="sm:col-span-2">
          <label className="label">Corpo</label>
          <textarea className="input min-h-[220px] font-mono text-[13px]" value={f.body} onChange={set('body')} />
        </div>
        <div>
          <label className="label">Alias remetente</label>
          <select className="input" value={f.from_alias} onChange={set('from_alias')}>
            <option value="">Padrão ({settings?.default_alias || '—'})</option>
            {(settings?.aliases || []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Enviar em automático</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={f.auto} onChange={set('auto')} /> Sim
            </label>
            <label className="flex items-center gap-1 text-sm text-ink-700">
              após <input type="number" min="0" className="input w-16 py-1 text-right" value={f.delay_days} onChange={set('delay_days')} /> dia(s)
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={f.active} onChange={set('active')} /> Modelo ativo
        </label>
        <div className="sm:col-span-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
          <div className="eyebrow mb-1">Marcadores</div>
          <div className="flex flex-wrap gap-1.5">
            {EMAIL_PLACEHOLDERS.map((p) => (
              <code key={p.key} className="rounded bg-white px-1.5 py-0.5" title={p.what}>{`{{${p.key}}}`}</code>
            ))}
          </div>
          <p className="mt-2"><b>Modelo de referência:</b> {MESSAGE_MODEL}</p>
        </div>
      </div>
    </Modal>
  )
}

function ComposeModal({ accounts, templates, settings, onClose }) {
  const [accountId, setAccountId] = useState('')
  const [contactId, setContactId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [alias, setAlias] = useState(settings?.default_alias || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { data: opportunities = [] } = useOpportunities()

  const account = accounts.find((a) => a.id === accountId) || null
  const contacts = (account?.contacts || []).filter((c) => c.email)
  const contact = contacts.find((c) => c.id === contactId) || pickRecipient(account)

  function applyTemplate(id) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (!t || !account) return
    const opp = opportunities.find((o) => o.account_id === accountId) || null
    const { subject: s, body: b } = renderTemplate(t, { account, contact, opportunity: opp, strategy: null, sender: settings })
    setSubject(s); setBody(b)
    if (t.from_alias) setAlias(t.from_alias)
  }

  async function save(sendNow) {
    if (!account || !contact) { setErr('Escolha a conta e um contato com e-mail.'); return }
    setBusy(true); setErr('')
    try {
      const { id } = await createEmailMessage({
        account_id: account.id, contact_id: contact.id, template_id: templateId || null, event: 'manual',
        to_email: contact.email, to_name: contact.name, from_alias: alias || settings?.default_alias,
        subject, body, status: 'rascunho',
      })
      if (sendNow) {
        const r = await sendEmail({ id, to_email: contact.email, to_name: contact.name, from_alias: alias, subject, body })
        await updateEmailMessage(id, { status: 'enviado', sent_at: new Date().toISOString(), provider_message_id: r?.provider_message_id || null })
      }
      onClose(true)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title="Novo e-mail" onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-outline" onClick={() => save(false)} disabled={busy || !subject}>Salvar na fila</button>
        <button className="btn-primary" onClick={() => save(true)} disabled={busy || !subject}><Send size={16} /> {busy ? 'Enviando…' : 'Enviar agora'}</button>
      </>}>
      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Conta</label>
          <select className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); setContactId('') }}>
            <option value="">Selecione…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Destinatário</label>
          <select className="input" value={contact?.id || ''} onChange={(e) => setContactId(e.target.value)} disabled={!contacts.length}>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            {!contacts.length && <option value="">Nenhum contato com e-mail</option>}
          </select>
        </div>
        <div>
          <label className="label">Modelo (opcional)</label>
          <select className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)} disabled={!account}>
            <option value="">Escrever do zero</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">De (alias)</label>
          <select className="input" value={alias} onChange={(e) => setAlias(e.target.value)}>
            {(settings?.aliases || []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Assunto</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="sm:col-span-2">
          <label className="label">Mensagem</label>
          <textarea className="input min-h-[240px] font-mono text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
        <AlertTriangle size={13} className="text-amber-500" /> “Enviar agora” manda o e-mail de verdade pela conta da Leadrix. Revise antes.
      </p>
    </Modal>
  )
}

function MessageModal({ message, account, onSend, onClose }) {
  const [subject, setSubject] = useState(message.subject || '')
  const [body, setBody] = useState(message.body || '')
  const [busy, setBusy] = useState(false)
  const editable = ['rascunho', 'agendado', 'erro'].includes(message.status)

  async function save() {
    setBusy(true)
    try {
      await updateEmailMessage(message.id, { subject, body })
      onClose(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={`${EMAIL_STATUS[message.status]?.label} — ${account?.name || ''}`} onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Fechar</button>
        {editable && <button className="btn-outline" onClick={save} disabled={busy}>Salvar alterações</button>}
        {editable && (
          <button className="btn-primary" onClick={async () => { await save(); onSend({ ...message, subject, body }) }} disabled={busy}>
            <Send size={16} /> Enviar
          </button>
        )}
      </>}>
      <dl className="mb-4 grid grid-cols-2 gap-2 text-xs text-ink-600">
        <div><dt className="eyebrow">Para</dt><dd>{message.to_name} · {message.to_email}</dd></div>
        <div><dt className="eyebrow">De</dt><dd>{message.from_alias}</dd></div>
        <div><dt className="eyebrow">Evento</dt><dd>{EMAIL_EVENTS[message.event]?.label || message.event}</dd></div>
        <div><dt className="eyebrow">Criado</dt><dd>{new Date(message.created_at).toLocaleString('pt-BR')}</dd></div>
      </dl>
      <div className="space-y-3">
        <div><label className="label">Assunto</label><input className="input" value={subject} disabled={!editable} onChange={(e) => setSubject(e.target.value)} /></div>
        <div>
          <label className="label">Mensagem</label>
          <textarea className="input min-h-[280px] font-mono text-[13px]" value={body} disabled={!editable} onChange={(e) => setBody(e.target.value)} />
        </div>
        {message.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{message.error}</p>}
      </div>
    </Modal>
  )
}
