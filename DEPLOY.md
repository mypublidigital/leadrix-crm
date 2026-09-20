# Deploy — Leadrix CRM

## Estado atual (20/09/2026)

| Item | Estado |
|---|---|
| Projeto Supabase `werxdvpowcpomleizhes` | **schema aplicado** (migrations 0001 → 0011) |
| Seeds | 18 serviços (4 pilares), 28 microssegmentos, 10 categorias de despesa, 4 modelos de e-mail |
| Edge Functions | **publicadas**: `crm-copilot`, `crm-content`, `crm-email`, `crm-admin-users`, `crm-capture` |
| Secrets | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-opus-5`, `GMAIL_SENDER` |
| Pendente | primeiro usuário admin · credenciais do Gmail · chave `service_role` correta · projeto na Vercel |

---

## 1. Primeiro usuário admin 👉 você

Criar usuário com senha é coisa sua, não minha. No painel:
**Authentication → Users → Add user** (e-mail + senha, marque *Auto Confirm*).

Depois, no **SQL Editor**, dê o papel de administrador:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'marcelo@leadrix.com.br';
```

Os perfis válidos são `admin`, `marketing` e `vendas` — quem não tem papel
definido entra como **vendas** (o mais restrito). Depois do primeiro admin, os
outros usuários saem da tela **Configurações → Usuários**.

Para mudar o papel de alguém:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"marketing"}'::jsonb
where email = 'pessoa@leadrix.com.br';
```

---

## 2. Chave `service_role` 👉 você

A chave enviada como `service_role` era, na verdade, a `anon` (o payload dizia
`"role":"anon"`). Pegue a correta em **Project Settings → API Keys** e coloque no
`.env` em `SUPABASE_SERVICE_ROLE_KEY` — ela só é usada pelos scripts locais
(importador). As Edge Functions recebem a chave de serviço automaticamente.

O frontend usa a `anon`, que é pública de propósito. Por isso as functions não
confiam só no `verify_jwt`: `_shared/auth.ts` exige um usuário logado de
verdade, senão qualquer pessoa com a chave pública mandaria e-mail pela conta da
Leadrix.

---

## 3. Mensageria: credenciais do Gmail 👉 você

O CRM envia pela API do Gmail da conta `marcelo@leadrix.com.br`. São três
segredos, obtidos uma vez só.

### 3.1 Cliente OAuth no Google Cloud

1. [console.cloud.google.com](https://console.cloud.google.com) → crie (ou escolha) um projeto, ex.: *Leadrix CRM*.
2. **APIs e serviços → Biblioteca** → procure **Gmail API** → **Ativar**.
3. **APIs e serviços → Tela de permissão OAuth**:
   - Se `leadrix.com.br` for **Google Workspace**: escolha **Interno**. É o melhor caminho — sem verificação e sem prazo de validade no token.
   - Se for **Gmail comum**: escolha **Externo** e, terminada a configuração, clique em **Publicar app**. ⚠️ Enquanto o app ficar em *Teste*, o Google **invalida o refresh token em 7 dias** e o envio para de funcionar.
   - Escopo: `https://www.googleapis.com/auth/gmail.send` (só enviar — não lê a caixa).
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **App para computador** → criar. Copie o **Client ID** e o **Client secret**.

### 3.2 Refresh token

Na pasta do projeto:

```bash
npm run gmail:token
```

O script pede o Client ID e o Client Secret, abre a autorização do Google (entre
com a conta que vai enviar), e imprime o refresh token junto com o comando
pronto do próximo passo. Se aparecer "app não verificado", siga em
**Avançado → Ir para…** — é o seu próprio app.

### 3.3 Gravar os segredos

```bash
npx supabase secrets set --project-ref werxdvpowcpomleizhes \
  GMAIL_CLIENT_ID="..." GMAIL_CLIENT_SECRET="..." GMAIL_REFRESH_TOKEN="..."
```

Não precisa republicar as funções: elas leem os segredos a cada chamada.

### 3.4 Testar

Em **Mensageria → Novo e-mail**, escolha uma conta com contato de e-mail (ou
mande para você mesmo) e clique em **Enviar agora**. Se falhar, o motivo aparece
na própria mensagem da fila:

| Mensagem | O que é |
|---|---|
| `invalid_client` | Client ID/secret errados ou o cliente não é do tipo *App para computador*. |
| `invalid_grant` | Refresh token expirado — app ficou em *Teste* (veja 3.1) ou o token foi revogado. Rode `npm run gmail:token` de novo. |
| `Delegation denied` / `From address not verified` | O alias não está verificado em *Gmail → Configurações → Contas e importação → Enviar e-mail como*. |

**Aliases:** cada remetente alternativo precisa estar em *Gmail → Configurações
→ Contas e importação → Enviar e-mail como*, verificado. Cadastre os aliases
autorizados em **Mensageria → Remetente**; o Google recusa um `From` que não
esteja verificado.

**Envio automático:** o CRM não tem agendador próprio. Modelos em automático
geram a mensagem e deixam na fila como *agendado*; o envio sai quando alguém
clica em Enviar. Para disparar sozinho, agende uma chamada (pg_cron ou
Scheduled Function) que processe os *agendados* com data vencida — decida antes
se quer e-mail saindo sem revisão humana.

---

## 4. Frontend na Vercel 👉 você

1. Conecte `github.com/mypublidigital/leadrix-crm` à Vercel.
2. **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` = `https://werxdvpowcpomleizhes.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a chave anon (publishable)
3. Cada push na branch de produção publica. Com as duas variáveis, o app sai do
   modo demonstração.

---

## 5. Configuração inicial dentro do app

Em **Configurações** (como admin ou marketing):

1. **Custo de venda** — recursos com custo mensal e horas/mês, custos unitários das despesas, custos fixos e margem de contribuição.
2. **SLA de aging** — dias por etapa usados pelo Radar ABM.
3. **Microssegmentos** — ajuste a lista (Indústria, Varejo e Empresas Digitais vieram como proposta).
4. **Serviços** — valor sugerido de cada serviço dos quatro pilares.
5. **Mensageria → Remetente** — nome, assinatura, aliases e a trava de envio automático.

---

## 6. Como reaplicar o schema

**CLI:**
```bash
export SUPABASE_ACCESS_TOKEN=...            # token pessoal do Supabase
npx supabase link --project-ref werxdvpowcpomleizhes
npx supabase db push
```

**SQL Editor:** cole `db/install.sql` (equivale às migrations 0001 → 0011, já com
o ajuste do estágio *standby* para rodar numa transação só).

**Functions:**
```bash
npx supabase functions deploy crm-copilot crm-content crm-email crm-admin-users crm-capture \
  --project-ref werxdvpowcpomleizhes --use-api
```

---

## 7. Antes de colocar usuários reais

- [ ] Primeiro admin criado e papel aplicado (passo 1).
- [ ] Testar cada perfil: Vendas não deve ver custo nem apagar oportunidade.
- [ ] Serviço de e-mail próprio para convites e recuperação de senha (Guia §9.6) — o SMTP embutido do Supabase é limitado.
- [ ] Rotacionar as chaves que passaram por conversa (Anthropic e Supabase) quando o ambiente estabilizar.
- [ ] Smoke test: login, criar conta com mercado/microssegmento/origem, pontuar ICP, criar ação ABM com custo, abrir Radar, gerar conteúdo, mandar um e-mail de teste para você mesmo, conferir Custo de venda & ROI.
