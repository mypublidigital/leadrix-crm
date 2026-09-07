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
  Sparkles,
  LogOut,
} from 'lucide-react'
import { DEMO_MODE } from '../lib/data'
import Logo from './Logo'
import { useAuth } from '../lib/useAuth'

const nav = [
  { to: '/', label: 'Dashboard de funil', icon: LayoutDashboard, end: true },
  { to: '/contas', label: 'Contas (ABM)', icon: Building2 },
  { to: '/agenda', label: 'Agenda de execução', icon: CalendarRange },
  { to: '/pipeline', label: 'Pipeline / Deals', icon: KanbanSquare },
  { to: '/servicos', label: 'Serviços', icon: Briefcase },
  { to: '/captura', label: 'Captura de leads', icon: Camera },
  { to: '/importar', label: 'Importador', icon: Upload },
  { to: '/config', label: 'Config / Integração', icon: Settings },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="px-5 py-5">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-accent-500 bg-accent-50 text-brand-800'
                    : 'border-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-ink-200 p-3">
          {!DEMO_MODE && user && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2">
              <span className="min-w-0 truncate text-xs text-ink-600" title={user.email}>{user.email}</span>
              <button onClick={signOut} className="shrink-0 text-ink-400 hover:text-rose-500" title="Sair">
                <LogOut size={15} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            <Sparkles size={14} className="text-brand-500" />
            ERP Consulcard · módulo 2
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {DEMO_MODE && (
          <div className="bg-amber-50 px-6 py-1.5 text-center text-xs font-medium text-amber-800">
            Modo demo — sem Supabase configurado. Dados lidos da planilha importada (somente
            leitura). Configure o <code>.env</code> para ativar a persistência.
          </div>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
