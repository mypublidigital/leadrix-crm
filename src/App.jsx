import { Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AccountsList from './pages/AccountsList'
import AccountView from './pages/AccountView'
import Agenda from './pages/Agenda'
import Pipeline from './pages/Pipeline'
import Servicos from './pages/Servicos'
import Config from './pages/Config'
import Importar from './pages/Importar'
import Captura from './pages/Captura'
import Placeholder from './pages/Placeholder'
import RadarAbm from './pages/RadarAbm'
import Conteudo from './pages/Conteudo'
import CustosRoi from './pages/CustosRoi'
import Mensageria from './pages/Mensageria'
import Login from './pages/Login'
import { useAuth } from './lib/useAuth'

export default function App() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 text-ink-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <Login onSignIn={auth.signIn} />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="contas" element={<AccountsList />} />
        <Route path="contas/:id" element={<AccountView />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="radar" element={<RadarAbm />} />
        <Route path="conteudo" element={<Conteudo />} />
        <Route path="custos" element={<CustosRoi />} />
        <Route path="mensageria" element={<Mensageria />} />
        <Route path="servicos" element={<Servicos />} />
        <Route path="captura" element={<Captura />} />
        <Route path="importar" element={<Importar />} />
        <Route path="config" element={<Config />} />
        <Route path="*" element={<Placeholder title="Página não encontrada" subtitle="" />} />
      </Route>
    </Routes>
  )
}
