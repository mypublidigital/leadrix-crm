// Gera o refresh token do Gmail usado pela mensageria do CRM.
//
//   npm run gmail:token
//
// Pede o Client ID e o Client Secret do cliente OAuth (tipo "Desktop app"),
// abre a tela de autorização do Google no navegador e, depois que você
// autoriza com a conta da Leadrix, imprime o refresh token.
//
// Nada é gravado em disco: o token aparece no terminal para você colocar nos
// secrets das Edge Functions.

import http from 'node:http'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { exec } from 'node:child_process'

const PORT = 5555
const REDIRECT = `http://localhost:${PORT}`
const SCOPE = 'https://www.googleapis.com/auth/gmail.send'

const rl = readline.createInterface({ input, output })
const clientId = (process.env.GMAIL_CLIENT_ID || await rl.question('Client ID: ')).trim()
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || await rl.question('Client Secret: ')).trim()
rl.close()

if (!clientId || !clientSecret) {
  console.error('\nClient ID e Client Secret são obrigatórios.')
  process.exit(1)
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPE,
  // offline + consent: sem os dois o Google devolve só o access token,
  // que expira em uma hora e não serve para o servidor enviar sozinho.
  access_type: 'offline',
  prompt: 'consent',
})

console.log('\n1. Abra este endereço e autorize com a conta que vai enviar os e-mails:\n')
console.log(authUrl)
console.log('\n2. Aguardando a autorização…\n')

// Tenta abrir o navegador (Windows/macOS/Linux) — se falhar, o link acima serve.
const opener = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open'
exec(`${opener} "${authUrl}"`, () => {})

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT)
    const erro = url.searchParams.get('error')
    const codigo = url.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<html><body style="font-family:system-ui;padding:40px">
      <h2>${codigo ? 'Autorização concluída' : 'Autorização recusada'}</h2>
      <p>${codigo ? 'Pode fechar esta aba e voltar ao terminal.' : erro || ''}</p>
    </body></html>`)
    server.close()
    codigo ? resolve(codigo) : reject(new Error(erro || 'autorização cancelada'))
  })
  server.listen(PORT)
  server.on('error', (e) => reject(new Error(`Não consegui escutar a porta ${PORT}: ${e.message}`)))
})

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
  }),
})
const data = await res.json()

if (!res.ok || !data.refresh_token) {
  console.error('\nFalhou:', data.error_description || data.error || res.status)
  console.error('Se veio "invalid_client", confira se o cliente OAuth é do tipo Desktop app.')
  process.exit(1)
}

console.log('\n── Refresh token ──────────────────────────────────────\n')
console.log(data.refresh_token)
// Em linha única de propósito: o PowerShell não aceita a quebra com "\".
console.log('\n── Agora rode (troque SEU_REF pelo ref do projeto) ────\n')
console.log(`npx supabase secrets set --project-ref SEU_REF GMAIL_CLIENT_ID="${clientId}" GMAIL_CLIENT_SECRET="${clientSecret}" GMAIL_REFRESH_TOKEN="${data.refresh_token}"`)
console.log('\nGuarde o token num lugar seguro: o Google só mostra uma vez.\n')
