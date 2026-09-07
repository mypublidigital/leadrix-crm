import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, Users, Building2 } from 'lucide-react'
import { listTasks, listAccounts } from '../lib/data'
import { TASK_TYPES, TASK_STATUS } from '../lib/constants'

// Quadro-resumo de tarefas: distribuição por tipo, por status e por cliente.
//
// Decisões de forma (não são estéticas — seguem o trabalho que cada dado faz):
// • Tipo é categoria NOMINAL (ligação, almoço, evento…): o que se compara é
//   magnitude, então todas as barras usam UMA cor só. Colorir cada barra por
//   valor gastaria o canal de identidade repetindo o que o comprimento já diz.
// • Status é parte-de-todo com 5 fatias (≤ 6): pizza/rosca é adequada, cada
//   fatia com sua cor de estado + legenda com quantidade e percentual.
// • "Clientes com tarefas" é um número único → cartão de número, não gráfico.

const PLOT_COLOR = '#354454' // Azul Consulcard — série única das barras
const pctOf = (n, total) => (total ? Math.round((n / total) * 100) : 0)

// ── Rosca (status) ──────────────────────────────────────────────
// Anel em SVG: cada fatia é um arco desenhado com dasharray. A separação
// entre fatias é um vão de 2px na cor da superfície (nunca uma borda).
const R = 52
const STROKE = 20
const CIRC = 2 * Math.PI * R
const GAP = 2

function StatusDonut({ slices, total }) {
  let offset = 0
  const single = slices.length === 1
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img"
      aria-label={`Tarefas por status: ${slices.map((s) => `${s.label} ${s.count}`).join(', ')}`}>
      <circle cx="64" cy="64" r={R} fill="none" stroke="#eaedf0" strokeWidth={STROKE} />
      {slices.map((s) => {
        const len = (s.count / total) * CIRC
        const dash = single ? CIRC : Math.max(0, len - GAP)
        const el = (
          <circle
            key={s.key}
            cx="64" cy="64" r={R} fill="none"
            stroke={s.color} strokeWidth={STROKE}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 64 64)"
          >
            <title>{`${s.label}: ${s.count} (${pctOf(s.count, total)}%)`}</title>
          </circle>
        )
        offset += len
        return el
      })}
      {/* miolo: o total, já que a rosca é parte-de-todo */}
      <text x="64" y="60" textAnchor="middle" className="fill-ink-900 text-[22px] font-extrabold">{total}</text>
      <text x="64" y="76" textAnchor="middle" className="fill-ink-500 text-[10px] font-medium">tarefas</text>
    </svg>
  )
}

// ── Barra horizontal (série única) ──────────────────────────────
// Barra fina (20px ≤ 24px), ponta arredondada em 4px e base reta, sobre uma
// trilha discreta. O valor fica FORA da ponta, em coluna própria, para nunca
// ser cortado por uma barra curta.
function BarRow({ label, icon, count, total, max }) {
  const width = max ? Math.max(2, (count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2" title={`${label}: ${count} (${pctOf(count, total)}%)`}>
      <div className="flex w-[104px] shrink-0 items-center gap-1.5 text-xs text-ink-600">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="h-5 flex-1 overflow-hidden rounded-sm bg-ink-100">
        <div className="h-full rounded-r" style={{ width: `${width}%`, background: PLOT_COLOR }} />
      </div>
      {/* Largura fixa para os valores alinharem entre as linhas; dimensionada
          para o pior caso realista (4 dígitos + "100%") para nunca cortar. */}
      <div className="w-[76px] shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-ink-700">
        <span className="font-semibold">{count}</span>
        <span className="ml-1 text-ink-400">{pctOf(count, total)}%</span>
      </div>
    </div>
  )
}

function Panel({ title, hint, children }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">{title}</h3>
      {hint && <p className="mb-2 mt-0.5 text-[11px] text-ink-400">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </div>
  )
}

export default function TaskSummaryCard() {
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: listTasks })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })

  const stats = useMemo(() => {
    const total = tasks.length

    // por tipo — só os tipos que existem, do maior para o menor
    const byType = new Map()
    tasks.forEach((t) => byType.set(t.task_type, (byType.get(t.task_type) || 0) + 1))
    const types = [...byType.entries()]
      .map(([key, count]) => ({ key, count, label: TASK_TYPES[key]?.label || key }))
      .sort((a, b) => b.count - a.count)

    // por status — ordem do fluxo de trabalho (não por volume)
    const byStatus = new Map()
    tasks.forEach((t) => byStatus.set(t.status, (byStatus.get(t.status) || 0) + 1))
    const statuses = Object.entries(TASK_STATUS)
      .map(([key, cfg]) => ({ key, label: cfg.label, color: cfg.chart, count: byStatus.get(key) || 0 }))
      .filter((s) => s.count > 0)

    // por cliente
    const byAccount = new Map()
    tasks.forEach((t) => {
      if (!t.account_id) return
      const name = t.account?.name || accounts.find((a) => a.id === t.account_id)?.name || '—'
      const cur = byAccount.get(t.account_id) || { name, count: 0 }
      cur.count++
      byAccount.set(t.account_id, cur)
    })
    const clients = [...byAccount.values()].sort((a, b) => b.count - a.count)
    const avg = clients.length ? total / clients.length : 0

    return { total, types, statuses, clients, avg }
  }, [tasks, accounts])

  const { total, types, statuses, clients, avg } = stats
  const maxType = Math.max(1, ...types.map((t) => t.count))
  const topClients = clients.slice(0, 5)
  const maxClient = Math.max(1, ...topClients.map((c) => c.count))

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <ListChecks size={16} className="text-brand-500" /> Resumo de tarefas
        </h2>
        <span className="text-xs text-ink-400">{total} tarefa(s) no total</span>
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          Nenhuma tarefa cadastrada ainda. Crie ações de ABM na Agenda de execução.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 1) Por tipo — barras horizontais, série única */}
          <Panel title="Por tipo" hint="Quantidade e % sobre o total de tarefas">
            <div className="space-y-1.5">
              {types.map((t) => (
                <BarRow key={t.key} label={t.label} count={t.count} total={total} max={maxType} />
              ))}
            </div>
          </Panel>

          {/* 2) Por status — rosca + legenda com quantidade e % */}
          <Panel title="Por status" hint="Distribuição das tarefas por situação">
            <div className="flex items-center gap-4">
              <StatusDonut slices={statuses} total={total} />
              {/* A legenda carrega TODO valor em texto — a cor nunca é o único canal */}
              <ul className="min-w-0 flex-1 space-y-1.5">
                {statuses.map((s) => (
                  <li key={s.key} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-ink-600">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-ink-700">
                      <span className="font-semibold">{s.count}</span>
                      <span className="ml-1 text-ink-400">{pctOf(s.count, total)}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          {/* 3) Por cliente — números únicos viram cartão, não gráfico */}
          <Panel title="Por cliente" hint="Cobertura da carteira e concentração de esforço">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-ink-100 p-2.5">
                <div className="flex items-center gap-1.5 text-xl font-extrabold text-ink-900">
                  <Users size={15} className="text-brand-500" /> {clients.length}
                </div>
                <div className="text-[11px] text-ink-500">
                  clientes com tarefas
                  {accounts.length > 0 && <span className="text-ink-400"> · de {accounts.length}</span>}
                </div>
              </div>
              <div className="rounded-lg border border-ink-100 p-2.5">
                <div className="flex items-center gap-1.5 text-xl font-extrabold text-ink-900">
                  <Building2 size={15} className="text-brand-500" /> {avg.toFixed(1).replace('.', ',')}
                </div>
                <div className="text-[11px] text-ink-500">tarefas por cliente (média)</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {topClients.map((c) => (
                <BarRow key={c.name} label={c.name} count={c.count} total={total} max={maxClient} />
              ))}
            </div>
            {clients.length > topClients.length && (
              <p className="mt-2 text-[11px] text-ink-400">
                mostrando os {topClients.length} com mais tarefas · outros {clients.length - topClients.length} cliente(s) não listados
              </p>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
