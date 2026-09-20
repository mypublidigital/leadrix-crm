import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import Modal from './Modal'
import { createAccount, updateAccount, saveContacts, listRoster } from '../lib/data'
import { isValidCNPJ, formatCNPJ, isValidEmail } from '../lib/validators'
import { CLASSIFICATIONS, SEGMENTS, ACCOUNT_SIZES, LEAD_SOURCES, LEAD_SOURCE_DETAIL_HINT, ABM_TIERS, LEAD_ORIGINATORS } from '../lib/constants'
import { ENTRY_DOORS, MARKETS } from '../data/leadrix'
import { CAMPAIGNS, CAMPAIGN_IDS } from '../data/abmContext'
import { useMicroSegments } from '../lib/hooks'

// Serve para CRIAR e para EDITAR: sem `account` (ou sem id) entra em modo
// cadastro. Um formulário só evita que os dois fluxos saiam do compasso.
export default function AccountEditModal({ account = {}, onClose, onCreated }) {
  const qc = useQueryClient()
  const isNew = !account?.id
  const { data: roster = [] } = useQuery({ queryKey: ['roster'], queryFn: listRoster })
  const { data: micros = [] } = useMicroSegments()
  const [f, setF] = useState({
    name: account.name || '',
    trade_name: account.trade_name || '',
    cnpj: account.cnpj || '',
    site: account.site || '',
    classification: account.classification || 'lead',
    segment: account.segment || '',
    micro_segment: account.micro_segment || '',
    abm_tier: account.abm_tier || '',
    entry_door: account.entry_door || '',
    account_size: account.account_size || '',
    owner_id: account.owner_id || '',
    lead_source: account.lead_source || '',
    origin_details: account.origin_details || '',
    referred_by: account.referred_by || '',
    origin_source: account.origin_source || '',
    origin_source_other: account.origin_source_other || '',
    referral_commission: Boolean(account.referral_commission),
    referral_commission_pct: account.referral_commission_pct ?? '',
    campaign: account.campaign || '',
    observations: account.observations || '',
  })
  const [contacts, setContacts] = useState((account.contacts || []).map((c) => ({ ...c })))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  // Mesmas regras do importador: CNPJ é opcional, mas se vier tem que ser
  // válido; e-mail de contato idem. Não deixa entrar dado que a importação
  // rejeitaria.
  const cnpjInvalido = f.cnpj.trim() !== '' && !isValidCNPJ(f.cnpj)
  const emailsInvalidos = contacts
    .map((c, i) => ({ i, email: (c.email || '').trim() }))
    .filter((c) => c.email !== '' && !isValidEmail(c.email))

  function setContact(i, k, v) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : (k === 'is_primary' && v ? { ...c, is_primary: false } : c))))
  }
  function addContact() {
    setContacts((cs) => [...cs, { name: '', role: '', email: '', phone: '', birth_date: '', is_primary: cs.length === 0 }])
  }
  function removeContact(i) {
    setContacts((cs) => cs.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (cnpjInvalido || emailsInvalidos.length) return
    setBusy(true); setErr('')
    const payload = {
      name: f.name.trim(),
      trade_name: f.trade_name || null,
      cnpj: f.cnpj.trim() ? formatCNPJ(f.cnpj) : null,
      site: f.site || null,
      classification: f.classification,
      segment: f.segment || null,
      micro_segment: f.micro_segment || null,
      abm_tier: f.abm_tier || null,
      entry_door: f.entry_door || null,
      account_size: f.account_size || null,
      owner_id: f.owner_id || null,
      lead_source: f.lead_source || null,
      origin_details: f.origin_details.trim() || null,
      referred_by: f.referred_by.trim() || null,
      origin_source: f.origin_source || null,
      origin_source_other: f.origin_source === 'outros' ? f.origin_source_other.trim() || null : null,
      referral_commission: Boolean(f.referral_commission),
      referral_commission_pct: f.referral_commission ? Number(f.referral_commission_pct) || 0 : null,
      campaign: f.campaign || null,
      observations: f.observations || null,
    }
    try {
      // só grava contatos que tenham algum conteúdo
      const validContacts = contacts.filter((c) => c.name || c.email || c.phone)
      if (isNew) {
        const created = await createAccount({ ...payload, contacts: validContacts })
        qc.invalidateQueries({ queryKey: ['accounts'] })
        onCreated?.(created.id)
      } else {
        await updateAccount(account.id, payload)
        await saveContacts(account.id, validContacts)
        qc.invalidateQueries({ queryKey: ['account', account.id] })
        qc.invalidateQueries({ queryKey: ['accounts'] })
      }
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const field = (label, k, type = 'text', extra = null) => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={f[k]} onChange={set(k)} />
      {extra}
    </div>
  )
  const select = (label, k, opts) => (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={f[k]} onChange={set(k)}>
        <option value="">—</option>
        {opts.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
      </select>
    </div>
  )

  const bloqueado = busy || !f.name.trim() || cnpjInvalido || emailsInvalidos.length > 0

  return (
    <Modal wide title={isNew ? 'Nova conta' : `Editar conta — ${account.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={bloqueado}>
          {busy ? 'Salvando…' : isNew ? 'Cadastrar conta' : 'Salvar'}
        </button>
      </>}>
      {err && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} /> {err}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('Nome (razão/cliente) *', 'name')}
        {field('Nome fantasia', 'trade_name')}
        {field('CNPJ', 'cnpj', 'text',
          cnpjInvalido && <p className="mt-1 text-xs text-rose-600">CNPJ inválido (dígito verificador não confere).</p>)}
        {field('Site', 'site')}
        {select('Classificação', 'classification', Object.entries(CLASSIFICATIONS).map(([k, v]) => [k, v.label]))}
        <div>
          <label className="label">Mercado</label>
          <select className="input" value={f.segment}
            onChange={(e) => setF((p) => ({
              ...p,
              segment: e.target.value,
              micro_segment: micros.some((m) => m.segment === e.target.value && m.label === p.micro_segment) ? p.micro_segment : '',
            }))}>
            <option value="">—</option>
            {Object.entries(SEGMENTS).map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Microssegmento</label>
          <select className="input" value={f.micro_segment} onChange={set('micro_segment')} disabled={!f.segment}>
            <option value="">{f.segment ? '—' : 'Escolha o mercado'}</option>
            {micros.filter((m) => m.segment === f.segment).map((m) => <option key={m.id} value={m.label}>{m.label}</option>)}
            {f.micro_segment && !micros.some((m) => m.segment === f.segment && m.label === f.micro_segment) && (
              <option value={f.micro_segment}>{f.micro_segment} (fora da lista)</option>
            )}
          </select>
          {f.segment && <p className="mt-1 text-xs text-ink-400">Decisores típicos: {MARKETS[f.segment]?.personas.join(', ')}.</p>}
        </div>
        {select('Nível ABM', 'abm_tier', Object.entries(ABM_TIERS).map(([k, v]) => [k, v.label]))}
        {select('Porta de entrada', 'entry_door', Object.entries(ENTRY_DOORS).map(([k, v]) => [k, `${v.label} — ${v.help}`]))}
        {select('Porte', 'account_size', Object.entries(ACCOUNT_SIZES))}
        {select('Responsável pela conta', 'owner_id', roster.map((u) => [u.id, u.full_name || u.email]))}
        <div>
          <label className="label">Campanha (tese)</label>
          <select className="input" value={f.campaign} onChange={set('campaign')}>
            <option value="">—</option>
            {CAMPAIGN_IDS.filter((k) => !f.segment || CAMPAIGNS[k].markets.includes(f.segment))
              .map((k) => <option key={k} value={k}>{CAMPAIGNS[k].label}</option>)}
          </select>
          {f.campaign && <p className="mt-1 text-xs text-ink-400">{CAMPAIGNS[f.campaign].thesis}</p>}
        </div>

        {/* ── Originação do lead e comissão de indicação ───────── */}
        <div className="sm:col-span-2 mt-2 rounded-lg border border-ink-200 p-3">
          <h3 className="mb-2 text-sm font-bold text-ink-900">Originação do lead</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Origem do lead (quem trouxe)</label>
              <select className="input" value={f.origin_source} onChange={set('origin_source')}>
                <option value="">—</option>
                {Object.entries(LEAD_ORIGINATORS).map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
              </select>
            </div>
            {f.origin_source === 'outros' && (
              <div>
                <label className="label">Especifique a origem *</label>
                <input className="input" value={f.origin_source_other} onChange={set('origin_source_other')} placeholder="Quem indicou esta conta" />
              </div>
            )}
            <div>
              <label className="label">Gera comissão de indicação?</label>
              <select className="input" value={f.referral_commission ? 'sim' : 'nao'}
                onChange={(e) => setF((p) => ({ ...p, referral_commission: e.target.value === 'sim' }))}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            {f.referral_commission && (
              <div>
                <label className="label">Percentual da comissão (%)</label>
                <input type="number" min="0" max="100" step="0.5" className="input"
                  value={f.referral_commission_pct} onChange={set('referral_commission_pct')} />
                <p className="mt-1 text-xs text-ink-400">Aplicado sobre o valor ganho e somado ao custo de venda — entra no custo de conversão e no ROI.</p>
              </div>
            )}
          </div>
        </div>

        {/* Canal de origem e seus detalhes andam juntos: o segundo só faz
            sentido lendo o primeiro, e a dica muda conforme o canal. */}
        {select('Canal de origem', 'lead_source', Object.entries(LEAD_SOURCES))}
        <div>
          <label className="label">Detalhes do canal</label>
          <input
            type="text"
            className="input"
            value={f.origin_details}
            onChange={set('origin_details')}
            placeholder={LEAD_SOURCE_DETAIL_HINT[f.lead_source] || 'Qualifique a origem'}
          />
          {!f.lead_source && (
            <p className="mt-1 text-xs text-ink-400">Escolha a origem ao lado para uma dica do que preencher.</p>
          )}
        </div>
        {field(f.lead_source === 'indicacao' ? 'Quem indicou *' : 'Quem indicou', 'referred_by', 'text',
          f.lead_source === 'indicacao' && !f.referred_by.trim()
            ? <p className="mt-1 text-xs text-amber-600">Informe quem trouxe esta indicação.</p>
            : null)}
        <div className="sm:col-span-2">
          <label className="label">Observações</label>
          <textarea className="input min-h-[60px]" value={f.observations} onChange={set('observations')} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-900">Contatos</h3>
          <button className="btn-outline text-xs" onClick={addContact}><Plus size={14} /> Adicionar</button>
        </div>
        <div className="space-y-3">
          {contacts.map((c, i) => {
            const emailRuim = emailsInvalidos.some((e) => e.i === i)
            return (
              <div key={i} className="rounded-lg border border-ink-200 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Nome" value={c.name || ''} onChange={(e) => setContact(i, 'name', e.target.value)} />
                  <input className="input" placeholder="Cargo" value={c.role || ''} onChange={(e) => setContact(i, 'role', e.target.value)} />
                  <div>
                    <input className={`input ${emailRuim ? 'border-rose-400' : ''}`} placeholder="E-mail"
                      value={c.email || ''} onChange={(e) => setContact(i, 'email', e.target.value)} />
                    {emailRuim && <p className="mt-1 text-xs text-rose-600">E-mail com formato inválido.</p>}
                  </div>
                  <input className="input" placeholder="Telefone" value={c.phone || ''} onChange={(e) => setContact(i, 'phone', e.target.value)} />
                  <div>
                    <input type="date" className="input" title="Aniversário"
                      value={(c.birth_date || '').slice(0, 10)} onChange={(e) => setContact(i, 'birth_date', e.target.value)} />
                    <p className="mt-1 text-xs text-ink-400">Aniversário — o ano só serve para mostrar a idade.</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500"
                      checked={Boolean(c.is_primary)} onChange={(e) => setContact(i, 'is_primary', e.target.checked)} />
                    Contato principal
                  </label>
                  <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => removeContact(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {contacts.length === 0 && <p className="text-sm text-ink-400">Nenhum contato. Clique em Adicionar.</p>}
        </div>
      </div>
    </Modal>
  )
}
