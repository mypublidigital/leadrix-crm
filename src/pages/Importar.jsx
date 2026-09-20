import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, AlertTriangle, Search, Copy, Check } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { ClassificationBadge } from '../components/Badge'
import { parseUploadFile } from '../lib/parseUpload'
import { importAccounts, DEMO_MODE } from '../lib/data'

// Faixa de linhas da planilha que formou a conta (a base repete o cliente em
// várias linhas, uma por contato/proposta).
function faixaLinhas(linhas) {
  if (!linhas?.length) return '—'
  const min = Math.min(...linhas), max = Math.max(...linhas)
  return min === max ? String(min) : `${min}–${max}`
}

// Quadro com TODOS os avisos de uma vez, ordenados pela linha da planilha.
// Substitui o tooltip que abria no canto da tela e ficava ilegível: para
// corrigir a planilha o usuário precisa ver a lista inteira, não um de cada vez.
function QuadroAvisos({ avisos }) {
  const [copia, setCopia] = useState('') // '' | 'ok' | 'erro'

  // Alguns contextos bloqueiam a API de clipboard (permissão, aba sem foco).
  // Cai no método antigo e, se nem esse funcionar, avisa — clicar e não
  // acontecer nada deixaria o usuário sem saber o que houve.
  async function copiar() {
    const txt = avisos
      .map((a) => `Linha ${a.linha ?? '?'} | ${a.conta} | ${a.campo || 'Dado'} | ${a.msg}`)
      .join('\n')
    const avisar = (estado) => { setCopia(estado); setTimeout(() => setCopia(''), 2500) }
    try {
      await navigator.clipboard.writeText(txt)
      return avisar('ok')
    } catch { /* tenta o fallback abaixo */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = txt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const deu = document.execCommand('copy')
      document.body.removeChild(ta)
      avisar(deu ? 'ok' : 'erro')
    } catch {
      avisar('erro')
    }
  }

  return (
    <div className="card overflow-hidden border-amber-300">
      <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <AlertTriangle size={16} />
          {avisos.length} {avisos.length === 1 ? 'dado fora do padrão' : 'dados fora do padrão'}
        </div>
        <button
          type="button"
          onClick={copiar}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
            copia === 'erro'
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
          }`}
        >
          {copia === 'ok' && <><Check size={13} /> Copiado</>}
          {copia === 'erro' && <><AlertCircle size={13} /> Não foi possível copiar</>}
          {!copia && <><Copy size={13} /> Copiar lista</>}
        </button>
      </div>
      <p className="border-b border-amber-200 bg-amber-50/60 px-4 py-2 text-xs leading-snug text-amber-800">
        Estes campos <strong>não serão gravados</strong> — o resto da linha é importado normalmente.
        Corrija na planilha usando o número da linha e envie de novo.
      </p>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_theme(colors.ink.200)]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-2 w-20">Linha</th>
              <th className="px-4 py-2">Conta</th>
              <th className="px-4 py-2 w-40">Campo</th>
              <th className="px-4 py-2">Problema</th>
            </tr>
          </thead>
          <tbody>
            {avisos.map((a, i) => (
              <tr key={i} className="border-t border-ink-100 align-top">
                <td className="px-4 py-2 font-mono text-xs font-semibold text-ink-700">{a.linha ?? '—'}</td>
                <td className="px-4 py-2 font-medium text-ink-900">{a.conta}</td>
                <td className="px-4 py-2 text-ink-600">{a.campo || 'Dado'}</td>
                <td className="px-4 py-2 text-ink-700">{a.msg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Importar() {
  const qc = useQueryClient()
  const [parsed, setParsed] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [busca, setBusca] = useState('')
  const [soAvisos, setSoAvisos] = useState(false)

  // Lista achatada de avisos, ordenada pela linha da planilha — é assim que o
  // usuário percorre o arquivo para corrigir.
  const avisos = useMemo(() => {
    if (!parsed) return []
    return parsed
      .flatMap((a) => (a.warnings || []).map((w) => ({ ...w, conta: a.name })))
      .sort((x, y) => (x.linha ?? 0) - (y.linha ?? 0))
  }, [parsed])

  const contasComAviso = useMemo(
    () => (parsed ? parsed.filter((a) => a.warnings?.length).length : 0),
    [parsed],
  )

  const visiveis = useMemo(() => {
    if (!parsed) return []
    const q = busca.trim().toLowerCase()
    return parsed.filter((a) => {
      if (soAvisos && !a.warnings?.length) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [parsed, busca, soAvisos])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setResult(null); setFileName(file.name); setBusca(''); setSoAvisos(false)
    try {
      const accounts = await parseUploadFile(file)
      if (!accounts.length) setError('Nenhuma conta encontrada. Verifique se há uma coluna de nome (Cliente/Empresa/Nome).')
      setParsed(accounts)
    } catch (err) {
      setError(`Falha ao ler o arquivo: ${err.message}`)
      setParsed(null)
    }
  }

  async function doImport() {
    if (!parsed?.length) return
    setBusy(true); setError('')
    try {
      const r = await importAccounts(parsed)
      setResult(r)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setParsed(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Importador" subtitle="Importe listas de clientes em CSV ou Excel (.xlsx/.xls)." />
      <div className="space-y-5 p-6">
        <div className="card p-6">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-ink-300 p-10 text-center hover:border-brand-400 hover:bg-brand-50/40">
            <Upload size={28} className="text-brand-500" />
            <div>
              <div className="text-sm font-semibold text-ink-800">Clique para selecionar um arquivo</div>
              <div className="text-xs text-ink-500">
                CSV, XLSX ou XLS · colunas reconhecidas: Cliente, Contato (Nome/E-mail/Telefone), Classificação,
                CNPJ, Mercado, Microssegmento, Nível ABM, Porte, Termômetro, Site, Status…
              </div>
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
          </label>
          {fileName && <p className="mt-3 flex items-center gap-2 text-sm text-ink-600"><FileSpreadsheet size={16} /> {fileName}</p>}
          {error && <p className="mt-3 flex items-center gap-2 text-sm text-rose-600"><AlertCircle size={16} /> {error}</p>}
          <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-snug text-ink-600">
            Contas já existentes são <strong>atualizadas</strong> (casadas pelo nome), não duplicadas. Coluna vazia
            na planilha <strong>não apaga</strong> o que já está preenchido no CRM.
          </p>
        </div>

        {result && (
          <div className="space-y-2">
            <div className="card flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={18} /> Importação concluída: {result.created} criadas, {result.updated} atualizadas.
            </div>
            {result.errors?.length > 0 && (
              <div className="card overflow-hidden border-rose-300">
                <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
                  <AlertCircle size={16} /> {result.errors.length} conta(s) não foram gravadas
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white shadow-[0_1px_0_theme(colors.ink.200)]">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2 w-20">Linha</th>
                        <th className="px-4 py-2">Conta</th>
                        <th className="px-4 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t border-ink-100 align-top">
                          <td className="px-4 py-2 font-mono text-xs font-semibold text-ink-700">{faixaLinhas(e.linhas)}</td>
                          <td className="px-4 py-2 font-medium text-ink-900">{e.name}</td>
                          <td className="px-4 py-2 text-rose-700">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {parsed && parsed.length > 0 && avisos.length > 0 && <QuadroAvisos avisos={avisos} />}

        {parsed && parsed.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
              <h2 className="text-sm font-bold text-ink-900">
                Pré-visualização — {parsed.length} contas
                {contasComAviso > 0 && <span className="ml-2 font-medium text-amber-700">({contasComAviso} com avisos)</span>}
              </h2>
              <button className="btn-primary" onClick={doImport} disabled={busy}>
                {busy ? 'Importando…' : `Importar ${parsed.length} contas`}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-ink-50/60 px-4 py-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conta…"
                  className="w-56 rounded-lg border border-ink-300 py-1.5 pl-8 pr-2 text-sm focus:border-brand-400 focus:outline-none"
                />
              </div>
              {contasComAviso > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-700">
                  <input type="checkbox" checked={soAvisos} onChange={(e) => setSoAvisos(e.target.checked)} />
                  Só contas com avisos
                </label>
              )}
              <span className="ml-auto text-xs text-ink-500">
                {visiveis.length === parsed.length
                  ? `${parsed.length} contas`
                  : `${visiveis.length} de ${parsed.length} contas`}
              </span>
            </div>

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white shadow-[0_1px_0_theme(colors.ink.200)]">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-2.5 w-20">Linha</th>
                    <th className="px-4 py-2.5">Conta</th>
                    <th className="px-4 py-2.5">Classificação</th>
                    <th className="px-4 py-2.5 text-center">Contatos</th>
                    <th className="px-4 py-2.5 text-center">Propostas</th>
                    <th className="px-4 py-2.5">Macro categorias</th>
                    <th className="px-4 py-2.5 text-center">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a, i) => (
                    <tr key={i} className={`border-t border-ink-100 ${a.warnings?.length ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-500">{faixaLinhas(a.linhas)}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{a.name}</td>
                      <td className="px-4 py-2.5"><ClassificationBadge value={a.classification} /></td>
                      <td className="px-4 py-2.5 text-center text-ink-600">{a.contacts.length}</td>
                      <td className="px-4 py-2.5 text-center text-ink-600">{a.proposals.length}</td>
                      <td className="px-4 py-2.5 text-ink-600">{a.macro_categories.slice(0, 2).join(', ')}{a.macro_categories.length > 2 ? '…' : ''}</td>
                      <td className="px-4 py-2.5 text-center">
                        {a.warnings?.length
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              <AlertTriangle size={12} />{a.warnings.length}
                            </span>
                          : <span className="text-xs text-ink-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!visiveis.length && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">Nenhuma conta corresponde ao filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {DEMO_MODE && <p className="border-t border-ink-100 px-4 py-2 text-center text-xs text-ink-400">Modo demo: as contas serão adicionadas localmente (localStorage).</p>}
          </div>
        )}
      </div>
    </>
  )
}
