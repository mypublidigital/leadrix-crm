import { useState } from 'react'
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import Logo from '../components/Logo'
import { trocarSenha } from '../lib/useAuth'

const MIN_SENHA = 8

// Mensagens do Supabase Auth vêm em inglês e técnicas demais para a tela.
function traduzirErro(msg = '') {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha atual inválidos.'
  if (/should be different from the old password/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/weak.?password|password.*weak/i.test(msg)) return 'Senha muito fraca. Misture letras, números e símbolos.'
  // O mínimo é configurado no Supabase e pode ser maior que o exigido aqui —
  // então usa o número que o próprio servidor informou, nunca um fixo.
  const minimoDoServidor = msg.match(/at least (\d+)/i)
  if (minimoDoServidor) return `A nova senha precisa ter pelo menos ${minimoDoServidor[1]} caracteres.`
  if (/too short/i.test(msg)) return 'A nova senha é curta demais para a política do sistema.'
  if (/Email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Fale com o administrador.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde um instante e tente de novo.'
  return msg
}

// Campo de senha com botão de exibir. Sem isso, digitar duas vezes uma senha
// gerada pelo sistema (cheia de símbolo) vira tentativa e erro.
function CampoSenha({ label, value, onChange, autoFocus, autoComplete, erro }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={visivel ? 'text' : 'password'}
          className={`input pr-10 ${erro ? 'border-rose-400' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {erro && <p className="mt-1 text-xs text-rose-600">{erro}</p>}
    </div>
  )
}

export default function Login({ onSignIn }) {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'trocar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [repetirSenha, setRepetirSenha] = useState('')
  const [error, setError] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [busy, setBusy] = useState(false)

  const curta = novaSenha !== '' && novaSenha.length < MIN_SENHA
  const naoConfere = repetirSenha !== '' && novaSenha !== repetirSenha
  const igualAtual = novaSenha !== '' && novaSenha === password
  const podeTrocar =
    email.trim() !== '' && password !== '' &&
    novaSenha.length >= MIN_SENHA && novaSenha === repetirSenha && !igualAtual

  function irPara(novoModo) {
    setModo(novoModo)
    setError(''); setSucesso('')
    setNovaSenha(''); setRepetirSenha('')
    if (novoModo === 'trocar') setPassword('')
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setSucesso('')

    if (modo === 'entrar') {
      const { error } = await onSignIn(email, password)
      if (error) setError(traduzirErro(error.message))
      setBusy(false)
      return
    }

    const { error } = await trocarSenha(email.trim(), password, novaSenha)
    if (error) {
      setError(traduzirErro(error.message))
    } else {
      // Volta para o login em vez de entrar direto: assim a nova senha é
      // usada uma vez e o usuário confirma que ela funciona.
      setModo('entrar')
      setPassword(''); setNovaSenha(''); setRepetirSenha('')
      setSucesso('Senha alterada. Entre com a nova senha.')
    }
    setBusy(false)
  }

  const trocando = modo === 'trocar'

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo tone="light" height={40} />
        </div>

        <h1 className="mb-1 text-lg font-bold text-ink-900">{trocando ? 'Trocar senha' : 'Entrar'}</h1>
        <p className="mb-5 text-sm text-ink-500">
          {trocando
            ? 'Informe a senha que o sistema gerou e escolha uma nova.'
            : 'Acesse com seu e-mail e senha.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={!trocando}
              autoComplete="username"
            />
          </div>

          <CampoSenha
            label={trocando ? 'Senha atual (a que o sistema enviou)' : 'Senha'}
            value={password}
            onChange={setPassword}
            autoFocus={trocando}
            autoComplete={trocando ? 'current-password' : 'current-password'}
          />

          {trocando && (
            <>
              <CampoSenha
                label="Nova senha"
                value={novaSenha}
                onChange={setNovaSenha}
                autoComplete="new-password"
                erro={
                  curta ? `Use pelo menos ${MIN_SENHA} caracteres.`
                    : igualAtual ? 'A nova senha precisa ser diferente da atual.'
                      : null
                }
              />
              <CampoSenha
                label="Repita a nova senha"
                value={repetirSenha}
                onChange={setRepetirSenha}
                autoComplete="new-password"
                erro={naoConfere ? 'As duas senhas não conferem.' : null}
              />
            </>
          )}

          {sucesso && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 size={16} /> {sucesso}
            </p>
          )}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={busy || (trocando && !podeTrocar)}
          >
            {busy
              ? <><Loader2 size={16} className="animate-spin" /> {trocando ? 'Gravando…' : 'Entrando…'}</>
              : trocando ? 'Gravar nova senha' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => irPara(trocando ? 'entrar' : 'trocar')}
          className="mt-4 w-full text-center text-sm font-medium text-brand-600 hover:underline"
        >
          {trocando ? 'Voltar para o login' : 'Trocar a senha gerada pelo sistema'}
        </button>
      </div>
    </div>
  )
}
