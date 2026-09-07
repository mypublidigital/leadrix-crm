import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, CalendarRange, Cake } from 'lucide-react'
import TaskTypeIcon from '../components/TaskTypeIcon'
import {
  format,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isAfter,
  isWithinInterval,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import PageHeader from '../components/PageHeader'
import { StatusBadge } from '../components/Badge'
import TaskModal from '../components/TaskModal'
import { listTasks, listAccounts } from '../lib/data'
import { aniversariantesNoIntervalo } from '../lib/birthdays'
import { TASK_TYPES, TASK_STATUS } from '../lib/constants'

const PERIODS = { dia: 'Dia', semana: 'Semana', mes: 'Mês', periodo: 'Período' }

// Aniversários seguem o MESMO período da agenda (Dia/Semana/Mês/Período), então
// o seletor de período já é o filtro por dia, semana e mês. Aqui só se decide
// se eles entram na lista.
const BIRTHDAY_MODES = { junto: 'Com aniversários', ocultar: 'Sem aniversários', so: 'Só aniversários' }

const iso = (d) => format(d, 'yyyy-MM-dd')

// Limites abertos: no modo "Período" cada ponta é opcional — só data inicial
// significa "a partir de", só data final significa "até".
const OPEN_START = new Date(1970, 0, 1)
const OPEN_END = new Date(2999, 11, 31)

function rangeFor(period, cursor, custom = {}) {
  if (period === 'periodo') {
    const s = custom.start ? startOfDay(parseISO(custom.start)) : OPEN_START
    const e = custom.end ? endOfDay(parseISO(custom.end)) : OPEN_END
    // se o usuário inverter as pontas, considera o intervalo mesmo assim
    return isAfter(s, e) ? { start: startOfDay(e), end: endOfDay(s) } : { start: s, end: e }
  }
  if (period === 'dia') return { start: startOfDay(cursor), end: endOfDay(cursor) }
  if (period === 'semana')
    return {
      start: startOfDay(startOfWeek(cursor, { weekStartsOn: 1 })),
      end: endOfDay(endOfWeek(cursor, { weekStartsOn: 1 })),
    }
  return { start: startOfDay(startOfMonth(cursor)), end: endOfDay(endOfMonth(cursor)) }
}

function rangeLabel(period, cursor, custom = {}) {
  if (period === 'periodo') {
    const fmt = (v) => format(parseISO(v), 'd MMM yyyy', { locale: ptBR })
    if (custom.start && custom.end) return `${fmt(custom.start)} – ${fmt(custom.end)}`
    if (custom.start) return `a partir de ${fmt(custom.start)}`
    if (custom.end) return `até ${fmt(custom.end)}`
    return 'todas as datas'
  }
  const { start, end } = rangeFor(period, cursor)
  if (period === 'dia') return format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR })
  if (period === 'mes') return format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
  return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`
}

export default function Agenda() {
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: listTasks })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })

  const [period, setPeriod] = useState('semana')
  const [cursor, setCursor] = useState(new Date())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [fType, setFType] = useState('')
  const [fAccount, setFAccount] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fAniv, setFAniv] = useState('junto')
  const [groupByType, setGroupByType] = useState(true)
  const [modal, setModal] = useState(null) // {task} | {new:true}

  const custom = { start: customStart, end: customEnd }
  const { start, end } = useMemo(
    () => rangeFor(period, cursor, { start: customStart, end: customEnd }),
    [period, cursor, customStart, customEnd],
  )

  const filtered = useMemo(() => {
    if (fAniv === 'so') return []
    return tasks.filter((t) => {
      if (!t.scheduled_date) return false
      const d = parseISO(t.scheduled_date)
      if (!isWithinInterval(d, { start, end })) return false
      if (fType && t.task_type !== fType) return false
      if (fAccount && t.account_id !== fAccount) return false
      if (fStatus && t.status !== fStatus) return false
      return true
    })
  }, [tasks, start, end, fType, fAccount, fStatus, fAniv])

  // O filtro de conta também vale para os aniversários; tipo e status são de
  // tarefa e não se aplicam a eles.
  const aniversarios = useMemo(() => {
    if (fAniv === 'ocultar') return []
    const contas = fAccount ? accounts.filter((a) => a.id === fAccount) : accounts
    return aniversariantesNoIntervalo(contas, start, end)
  }, [accounts, start, end, fAccount, fAniv])

  const grouped = useMemo(() => {
    if (!groupByType) return [['', filtered]]
    const map = new Map()
    filtered.forEach((t) => {
      if (!map.has(t.task_type)) map.set(t.task_type, [])
      map.get(t.task_type).push(t)
    })
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [filtered, groupByType])

  function move(dir) {
    if (period === 'dia') setCursor((c) => addDays(c, dir))
    else if (period === 'semana') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => addMonths(c, dir))
  }

  // Ao entrar no modo Período, herda o intervalo que já estava visível —
  // evita cair numa tela vazia (ou com tudo) sem contexto.
  function selectPeriod(k) {
    if (k === 'periodo' && !customStart && !customEnd) {
      const r = rangeFor(period, cursor)
      setCustomStart(iso(r.start))
      setCustomEnd(iso(r.end))
    }
    setPeriod(k)
  }

  return (
    <>
      <PageHeader
        title="Agenda de execução"
        subtitle="Visão por período — todas as contas misturadas. Use Dia/Semana/Mês ou um intervalo de datas, e filtre por tipo, conta, status e aniversários."
        actions={
          <button className="btn-primary" onClick={() => setModal({ new: true })}>
            <Plus size={16} /> Tarefa
          </button>
        }
      />

      <div className="space-y-4 p-6">
        {/* Controles */}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-ink-300 p-0.5">
              {Object.entries(PERIODS).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => selectPeriod(k)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    period === k ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {period === 'periodo' ? (
              /* Intervalo livre: data inicial e data final (ambas opcionais) */
              <>
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  De
                  <input
                    type="date"
                    className="input w-auto py-1.5 text-xs"
                    value={customStart}
                    max={customEnd || undefined}
                    onChange={(e) => setCustomStart(e.target.value)}
                    title="Data inicial"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                  até
                  <input
                    type="date"
                    className="input w-auto py-1.5 text-xs"
                    value={customEnd}
                    min={customStart || undefined}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    title="Data final"
                  />
                </label>
                <button
                  className="btn-outline text-xs"
                  onClick={() => { setCustomStart(''); setCustomEnd('') }}
                  disabled={!customStart && !customEnd}
                >
                  Limpar
                </button>
              </>
            ) : (
              <>
                <button className="btn-ghost px-2" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
                <div className="min-w-[200px] text-center text-sm font-semibold capitalize text-ink-800">
                  {rangeLabel(period, cursor)}
                </div>
                <button className="btn-ghost px-2" onClick={() => move(1)}><ChevronRight size={18} /></button>
                <button className="btn-outline text-xs" onClick={() => setCursor(new Date())}>Hoje</button>
                {/* Filtro de data: pula direto para a data escolhida (pedido da reunião 13/07) */}
                <input
                  type="date"
                  className="input w-auto py-1.5 text-xs"
                  value={format(cursor, 'yyyy-MM-dd')}
                  onChange={(e) => e.target.value && setCursor(parseISO(e.target.value))}
                  title="Ir para uma data específica"
                />
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input type="checkbox" checked={groupByType} onChange={(e) => setGroupByType(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-500" />
            Agrupar por tipo
          </label>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select className="input" value={fType} onChange={(e) => setFType(e.target.value)} disabled={fAniv === 'so'}>
            <option value="">Todos os tipos</option>
            {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
            <option value="">Todas as contas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)} disabled={fAniv === 'so'}>
            <option value="">Todos os status</option>
            {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={fAniv} onChange={(e) => setFAniv(e.target.value)}>
            {Object.entries(BIRTHDAY_MODES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>

        <div className="text-xs text-ink-400">
          {fAniv !== 'so' && <>{filtered.length} tarefa(s) · </>}
          {fAniv !== 'ocultar' && <>{aniversarios.length} aniversário(s) · </>}
          <span className="first-letter:uppercase">{rangeLabel(period, cursor, custom)}</span>
        </div>

        {/* Lista agrupada */}
        {filtered.length === 0 && aniversarios.length === 0 && (
          <div className="card grid place-items-center gap-2 p-12 text-center text-sm text-ink-500">
            <CalendarRange size={28} className="text-ink-300" />
            {fAniv === 'so'
              ? 'Nenhum aniversário neste período. Cadastre a data em Editar conta → Contatos.'
              : 'Nenhuma tarefa neste período com os filtros atuais.'}
          </div>
        )}

        {aniversarios.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-700">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-pink-50 text-pink-500">
                <Cake size={16} />
              </span>
              Aniversários
              <span className="chip bg-ink-100 text-ink-500">{aniversarios.length}</span>
            </div>
            <div className="card divide-y divide-ink-100">
              {aniversarios.map((a) => (
                <Link
                  key={`${a.conta.id}-${a.id || a.name}`}
                  to={`/contas/${a.conta.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pink-50 text-pink-500">
                    <Cake size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-900">
                      {a.name || 'Contato sem nome'}
                      {a.role && <span className="ml-1.5 font-normal text-ink-500">· {a.role}</span>}
                    </div>
                    <div className="truncate text-xs text-ink-500">
                      {a.conta.name} · {format(a.data, "d 'de' MMMM", { locale: ptBR })}
                      {a.idade != null && ` · faz ${a.idade}`}
                    </div>
                  </div>
                  <span className="chip shrink-0 bg-pink-50 text-pink-600">
                    {format(a.data, 'd MMM', { locale: ptBR })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {grouped.map(([type, list]) => (
            <div key={type || 'all'}>
              {groupByType && (
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-700">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-500">
                    <TaskTypeIcon type={type} />
                  </span>
                  {TASK_TYPES[type]?.label || 'Tarefas'}
                  <span className="chip bg-ink-100 text-ink-500">{list.length}</span>
                </div>
              )}
              <div className="card divide-y divide-ink-100">
                {list
                  .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setModal({ task: t })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
                        <TaskTypeIcon type={t.task_type} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink-900">{t.title}</div>
                        <div className="text-xs text-ink-500">
                          {t.account?.name} · {format(parseISO(t.scheduled_date), "d MMM", { locale: ptBR })}
                        </div>
                      </div>
                      <StatusBadge value={t.status} />
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <TaskModal
          task={modal.task}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
