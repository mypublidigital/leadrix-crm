import { NavLink, Outlet } from 'react-router-dom'
import {
  Camera,
  LayoutDashboard,
  Building2,
  CalendarRange,
  KanbanSquare,
  Briefcase,
  Upload,
  Settings,
  LogOut,
  Radar,
  PenLine,
  Calculator,
  Mails,
} from 'lucide-react'
import { DEMO_MODE } from '../lib/data'
import Logo from './Logo'
import { useAuth, setDemoRole } from '../lib/useAuth'
import { ROLES, ROLE_IDS } from '../lib/permissions'

// `need` é a permissão exigida para o item aparecer no menu.
const groups = [
  {
    label: 'Carteira',
    items: [
      { to: '/', label: 'Dashboard de funil', icon: LayoutDashboard, end: true },
      { to: '/contas', label: 'Contas (ABM)', icon: Building2 },
      { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
      { to: '/agenda', label: 'Agenda de ações', icon: CalendarRange },
    ],
  },
  {
    label: 'ABM inteligente',
    items: [
      { to: '/radar', label: 'Radar ABM', icon: Radar },
      { to: '/conteudo', label: 'Estúdio de conteúdo', icon: PenLine },
      { to: '/mensageria', label: 'Mensageria', icon: Mails },
      { to: '/custos', label: 'Custo de venda & ROI', icon: Calculator, need: 'costs.view' },
    ],
  },
  {
    label: 'Base',
    items: [
      { to: '/servicos', label: 'Serviços (4 pilares)', icon: Briefcase },
      { to: '/captura', label: 'Captura de leads', icon: Camera },
      { to: '/importar', label: 'Importador', icon: Upload },
      { to: '/config', label: 'Configurações', icon: Settings },
    ],
  },
]

export default function Layout() {
  const { user, signOut, role, can } = useAuth()
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.need || can(i.need)) }))
    .filter((g) => g.items.length)

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-ink-900 text-ink-300">
        <div className="px-5 pb-4 pt-6">
          <Logo tone="dark" height={30} />
        </div>

        <nav className="flex-1 space-y-5 overflow-auto px-3 py-3">
          {visible.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1.5 font-display text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-accent-500 bg-white/10 text-white'
                          : 'border-transparent text-ink-300 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={17} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          {DEMO_MODE ? (
            <label className="block px-1">
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-ink-500">Perfil (demonstração)</span>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
                value={role}
                onChange={(e) => setDemoRole(e.target.value)}
                title="Em produção o perfil vem do cadastro do usuário"
              >
                {ROLE_IDS.map((r) => <option key={r} value={r} className="text-ink-900">{ROLES[r].label}</option>)}
              </select>
            </label>
          ) : (
            user && (
              <div className="rounded-md bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-ink-300" title={user.email}>{user.email}</span>
                  <button onClick={signOut} className="shrink-0 text-ink-400 hover:text-rose-400" title="Sair">
                    <LogOut size={15} />
                  </button>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-accent-500">{ROLES[role]?.label}</div>
              </div>
            )
          )}
          <div className="px-3 py-1 font-display text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Lidere seu mercado com IA
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {DEMO_MODE && (
          <div className="bg-ink-800 px-6 py-1.5 text-center text-xs font-medium text-ink-200">
            Modo demonstração — sem Supabase configurado. Contas, pessoas e valores são fictícios e ficam
            gravados só neste navegador. Configure o <code className="text-white">.env</code> para usar o banco.
          </div>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
