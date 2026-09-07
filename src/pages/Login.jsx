import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Logo from '../components/Logo'

export default function Login({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await onSignIn(email, password)
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message)
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo width={210} crmAlign="center" />
        </div>
        <h1 className="mb-1 text-lg font-bold text-ink-900">Entrar</h1>
        <p className="mb-5 text-sm text-ink-500">Acesse com seu e-mail e senha.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Senha</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Entrando…</> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
