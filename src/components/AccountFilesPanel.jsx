import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Upload, Download, Trash2, Loader2, FileText, FileSpreadsheet, Image, File } from 'lucide-react'
import InfoTip from './InfoTip'
import {
  listAccountFiles, uploadAccountFile, accountFileUrl, deleteAccountFile,
  FILE_CATEGORIES, MAX_FILE_BYTES, DEMO_MODE,
} from '../lib/data'
import { useAuth } from '../lib/useAuth'

const tamanho = (bytes) => {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function IconeArquivo({ mime, name }) {
  const ext = String(name || '').toLowerCase()
  if (mime?.startsWith('image/')) return <Image size={15} />
  if (/\.(xlsx?|csv)$/.test(ext) || mime?.includes('sheet')) return <FileSpreadsheet size={15} />
  if (/\.(pdf|docx?|txt|md)$/.test(ext) || mime?.includes('pdf') || mime?.includes('word')) return <FileText size={15} />
  return <File size={15} />
}

/**
 * Arquivos da conta nas duas categorias. Quando recebe `opportunityId`, a
 * proposta enviada já nasce ligada àquela oportunidade.
 */
export default function AccountFilesPanel({ account, opportunityId = null, opportunities = [] }) {
  const qc = useQueryClient()
  const { can } = useAuth()
  const { data: files = [] } = useQuery({
    queryKey: ['account-files', account.id],
    queryFn: () => listAccountFiles(account.id),
  })

  const [aba, setAba] = useState('proposta')
  const [enviando, setEnviando] = useState(false)
  const [err, setErr] = useState('')
  const [vinculo, setVinculo] = useState(opportunityId || '')
  const inputRef = useRef(null)

  // Dentro de uma oportunidade o painel mostra só os arquivos dela — e os
  // contadores precisam falar do mesmo conjunto que a lista.
  const escopo = files.filter((f) => !opportunityId || f.opportunity_id === opportunityId)
  const lista = escopo.filter((f) => f.category === aba)

  async function enviar(e) {
    const escolhidos = [...(e.target.files || [])]
    e.target.value = ''
    if (!escolhidos.length) return
    setEnviando(true); setErr('')
    try {
      for (const file of escolhidos) {
        await uploadAccountFile({
          accountId: account.id,
          opportunityId: aba === 'proposta' ? (vinculo || null) : null,
          category: aba,
          file,
        })
      }
      qc.invalidateQueries({ queryKey: ['account-files', account.id] })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setEnviando(false)
    }
  }

  async function abrir(f) {
    setErr('')
    try {
      const url = await accountFileUrl(f)
      if (!url) {
        setErr('Arquivo da demonstração não fica guardado: recarregar a página perde o conteúdo (os dados do arquivo continuam na lista).')
        return
      }
      window.open(url, '_blank', 'noopener')
    } catch (e2) {
      setErr(e2.message)
    }
  }

  async function apagar(f) {
    if (!window.confirm(`Apagar "${f.name}"? A ação não pode ser desfeita.`)) return
    setErr('')
    try {
      await deleteAccountFile(f)
      qc.invalidateQueries({ queryKey: ['account-files', account.id] })
    } catch (e2) {
      setErr(e2.message)
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <FolderOpen size={16} className="text-brand-500" /> Arquivos
          <InfoTip>
            Propostas são o que a Leadrix enviou; arquivos do cliente são o que veio dele.
            Ficam num armazenamento privado — o link de abertura expira em poucos minutos.
          </InfoTip>
        </h2>
        <span className="text-xs text-ink-500">{escopo.length} arquivo(s)</span>
      </div>

      <div className="mb-3 flex gap-1.5">
        {Object.entries(FILE_CATEGORIES).map(([k, c]) => (
          <button key={k} onClick={() => setAba(k)} title={c.help}
            className={`chip ${aba === k ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600'}`}>
            {c.label} ({escopo.filter((f) => f.category === k).length})
          </button>
        ))}
      </div>

      {aba === 'proposta' && !opportunityId && opportunities.length > 0 && (
        <div className="mb-2">
          <label className="label">Vincular a uma oportunidade (opcional)</label>
          <select className="input py-1.5 text-xs" value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
            <option value="">Conta toda</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>{o.service?.name || o.service_id}{o.title ? ` · ${o.title}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <input ref={inputRef} type="file" multiple className="hidden" onChange={enviar} />
      <button
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-300 p-3 text-sm text-ink-600 hover:border-brand-400 hover:bg-brand-50/40"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {enviando ? 'Enviando…' : `Enviar ${FILE_CATEGORIES[aba].label.toLowerCase()}`}
        <span className="text-xs text-ink-400">até {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB</span>
      </button>

      {err && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}

      <ul className="space-y-1.5">
        {lista.map((f) => {
          const opp = opportunities.find((o) => o.id === f.opportunity_id)
          return (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 text-sm">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink-100 text-ink-500">
                <IconeArquivo mime={f.mime} name={f.name} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink-900">{f.name}</div>
                <div className="truncate text-xs text-ink-500">
                  {tamanho(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                  {opp ? ` · ${opp.service?.name}${opp.title ? ` (${opp.title})` : ''}` : ''}
                </div>
              </div>
              <button className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-600"
                onClick={() => abrir(f)} title="Abrir / baixar" aria-label={`Abrir ${f.name}`}>
                <Download size={15} />
              </button>
              {can('opportunity.delete') && (
                <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                  onClick={() => apagar(f)} title="Apagar (só administradores)" aria-label={`Apagar ${f.name}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          )
        })}
        {lista.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-xs text-ink-400">
            {FILE_CATEGORIES[aba].help}
          </li>
        )}
      </ul>

      {DEMO_MODE && (
        <p className="mt-2 text-[11px] text-ink-400">
          Demonstração: o arquivo abre nesta sessão, mas não fica guardado ao recarregar a página.
        </p>
      )}
    </div>
  )
}
