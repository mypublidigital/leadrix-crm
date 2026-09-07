import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera, Upload, Loader2, CheckCircle2, XCircle, UserPlus, Trash2, ImageOff, Sparkles,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import {
  capturePhoto, listPreLeads, preLeadPhotoUrl, updatePreLead, promotePreLead, discardPreLead,
} from '../lib/data'

// Comprime a foto no navegador (max 1600px, JPEG) → base64 leve para a IA.
async function compressImage(file, maxSize = 1600, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const jpeg = canvas.toDataURL('image/jpeg', quality)
  // thumb pequena para exibição/demo
  const tScale = Math.min(1, 320 / Math.max(img.width, img.height))
  const tc = document.createElement('canvas')
  tc.width = Math.round(img.width * tScale)
  tc.height = Math.round(img.height * tScale)
  tc.getContext('2d').drawImage(img, 0, 0, tc.width, tc.height)
  return {
    base64: jpeg.split(',')[1],
    mediaType: 'image/jpeg',
    thumb: tc.toDataURL('image/jpeg', 0.7),
  }
}

function PhotoThumb({ pl }) {
  const [url, setUrl] = useState(pl.thumb || null)
  useEffect(() => {
    let alive = true
    if (!url) preLeadPhotoUrl(pl).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [pl.id])
  if (!url) return <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-300"><ImageOff size={20} /></div>
  return <img src={url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
}

function PreLeadCard({ pl, onChanged }) {
  const [f, setF] = useState({ name: pl.name || '', company: pl.company || '', role: pl.role || '', email: pl.email || '', phone: pl.phone || '' })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const dirty = ['name', 'company', 'role', 'email', 'phone'].some((k) => (pl[k] || '') !== f[k])

  async function saveEdits() {
    await updatePreLead(pl.id, f)
  }
  async function promote() {
    setBusy('promote'); setErr('')
    try {
      if (dirty) await saveEdits()
      await promotePreLead({ ...pl, ...f })
      onChanged()
    } catch (e) { setErr(e.message) } finally { setBusy('') }
  }
  async function discard() {
    setBusy('discard')
    try { await discardPreLead(pl.id); onChanged() } finally { setBusy('') }
  }

  return (
    <div className="card p-3">
      <div className="flex gap-3">
        <PhotoThumb pl={pl} />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
          <input className="input py-1.5 text-sm" placeholder="Nome" value={f.name} onChange={set('name')} />
          <input className="input py-1.5 text-sm" placeholder="Empresa" value={f.company} onChange={set('company')} />
          <input className="input py-1.5 text-sm" placeholder="Cargo" value={f.role} onChange={set('role')} />
          <input className="input py-1.5 text-sm" placeholder="E-mail" value={f.email} onChange={set('email')} />
          <input className="input py-1.5 text-sm sm:col-span-2" placeholder="Telefone" value={f.phone} onChange={set('phone')} />
        </div>
      </div>
      {pl.notes && <p className="mt-2 rounded bg-ink-50 px-2 py-1 text-xs text-ink-500">{pl.notes}</p>}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-ink-400">{new Date(pl.created_at).toLocaleString('pt-BR')}</span>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs text-rose-500" onClick={discard} disabled={Boolean(busy)}>
            <Trash2 size={14} /> Descartar
          </button>
          <button className="btn-primary text-xs" onClick={promote} disabled={Boolean(busy) || (!f.company && !f.name)}>
            {busy === 'promote' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Promover a conta
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Captura() {
  const qc = useQueryClient()
  const { data: preLeads = [] } = useQuery({ queryKey: ['pre-leads'], queryFn: listPreLeads })
  const fileRef = useRef(null)
  const [queue, setQueue] = useState([]) // {id, name, thumb, status: fila|enviando|ok|erro, error}
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('novo')

  function onFiles(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    files.forEach(async (file) => {
      const id = Math.random().toString(36).slice(2, 9)
      setQueue((q) => [...q, { id, name: file.name, thumb: null, status: 'fila', file }])
      try {
        const { thumb } = await compressImage(file, 320, 0.6)
        setQueue((q) => q.map((x) => (x.id === id ? { ...x, thumb } : x)))
      } catch { /* thumb é opcional */ }
    })
  }

  async function sendAll() {
    setSending(true)
    for (const item of queue.filter((x) => x.status === 'fila' || x.status === 'erro')) {
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'enviando' } : x)))
      try {
        const { base64, mediaType, thumb } = await compressImage(item.file)
        await capturePhoto(base64, mediaType, thumb)
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'ok' } : x)))
      } catch (e) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'erro', error: e.message } : x)))
      }
      qc.invalidateQueries({ queryKey: ['pre-leads'] })
    }
    setSending(false)
    // limpa os enviados com sucesso após um instante
    setTimeout(() => setQueue((q) => q.filter((x) => x.status !== 'ok')), 2500)
  }

  const pending = queue.filter((x) => x.status === 'fila' || x.status === 'erro').length
  const byStatus = { novo: [], promovido: [], descartado: [] }
  preLeads.forEach((p) => (byStatus[p.status] || byStatus.novo).push(p))
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pre-leads'] })
    qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  return (
    <>
      <PageHeader
        title="Captura de leads"
        subtitle="Evento, feira, almoço: fotografe o cartão de visita ou a tela de contato — a IA estrutura os dados na pré-base."
      />
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        {/* Zona de captura (mobile-first) */}
        <div className="card p-4">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} />
          <button
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-8 text-center hover:border-accent-500 hover:bg-accent-50/40"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={32} className="text-brand-500" />
            <span className="text-sm font-semibold text-ink-800">Tirar foto ou escolher da galeria</span>
            <span className="text-xs text-ink-500">Cartão de visita · tela de contato do WhatsApp · crachá — pode acumular várias e enviar depois</span>
          </button>

          {queue.length > 0 && (
            <div className="mt-3 space-y-2">
              {queue.map((x) => (
                <div key={x.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 text-sm">
                  {x.thumb
                    ? <img src={x.thumb} alt="" className="h-10 w-10 rounded object-cover" />
                    : <div className="grid h-10 w-10 place-items-center rounded bg-ink-100 text-ink-300"><Camera size={16} /></div>}
                  <span className="min-w-0 flex-1 truncate text-ink-700">{x.name}</span>
                  {x.status === 'fila' && <span className="text-xs text-ink-400">na fila</span>}
                  {x.status === 'enviando' && <Loader2 size={16} className="animate-spin text-brand-500" />}
                  {x.status === 'ok' && <CheckCircle2 size={16} className="text-accent-600" />}
                  {x.status === 'erro' && <span className="flex items-center gap-1 text-xs text-rose-600"><XCircle size={14} /> {x.error?.slice(0, 40)}</span>}
                  {x.status !== 'enviando' && x.status !== 'ok' && (
                    <button className="text-ink-300 hover:text-rose-500" onClick={() => setQueue((q) => q.filter((y) => y.id !== x.id))}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button className="btn-primary w-full" onClick={sendAll} disabled={sending || pending === 0}>
                {sending
                  ? <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                  : <><Upload size={16} /> Enviar {pending} foto(s) — extrair com IA <Sparkles size={14} /></>}
              </button>
            </div>
          )}
        </div>

        {/* Pré-base */}
        <div className="flex items-center gap-2">
          {[['novo', `Pré-base (${byStatus.novo.length})`], ['promovido', `Promovidos (${byStatus.promovido.length})`], ['descartado', `Descartados (${byStatus.descartado.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {byStatus[tab].map((pl) =>
            tab === 'novo'
              ? <PreLeadCard key={pl.id} pl={pl} onChanged={refresh} />
              : (
                <div key={pl.id} className="card flex items-center gap-3 p-3 text-sm">
                  <PhotoThumb pl={pl} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900">{pl.name || '—'} {pl.company && <span className="font-normal text-ink-500">· {pl.company}</span>}</div>
                    <div className="text-xs text-ink-500">{pl.email || ''} {pl.phone ? `· ${pl.phone}` : ''}</div>
                  </div>
                  {pl.status === 'promovido' && pl.promoted_account_id && (
                    <Link to={`/contas/${pl.promoted_account_id}`} className="btn-outline text-xs">Ver conta</Link>
                  )}
                </div>
              ),
          )}
          {byStatus[tab].length === 0 && (
            <p className="py-8 text-center text-sm text-ink-400">
              {tab === 'novo' ? 'Nenhum lead na pré-base. Capture fotos acima.' : 'Nada aqui ainda.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
