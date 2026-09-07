# Deploy — Consulcard CRM

Publicação em **Supabase** (banco + auth + edge functions) **separado do operacional**
e **Vercel** (frontend). Siga na ordem. Tudo que precisa de você está marcado com 👉.

> Pré-requisitos: Node 18+ (ok), conta no [Supabase](https://supabase.com),
> conta no [Vercel](https://vercel.com), conta no [GitHub](https://github.com),
> (opcional) [API key da Anthropic](https://console.anthropic.com) para o co-piloto.
> As CLIs são usadas via `npx` (não precisa instalar global).

---

## 1. Criar o projeto Supabase do CRM

👉 Em https://supabase.com → **New project**:
- Nome: `consulcard-crm` (projeto **novo**, NÃO o operacional `djdooeszhpftbiyzznli`).
- Região: `South America (São Paulo)`.
- Defina e guarde a senha do banco.

👉 Em **Project Settings → API**, copie:
- **Project URL** → `https://XXXX.supabase.co`
- **anon public** key
- **service_role** key (secreta — nunca vai pro frontend)

👉 Em **Project Settings → General**, copie o **Reference ID** (`XXXX`).

---

## 2. Aplicar o schema (migrations)

**Opção A — CLI (recomendado):**
```bash
npx supabase login                 # abre o navegador
npx supabase link --project-ref XXXX
npx supabase db push               # aplica 0001, 0002, 0003 em ordem
```

**Opção B — SQL Editor (manual):** no painel do Supabase → **SQL Editor**, rode
os arquivos **na ordem**, um de cada vez:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_services.sql`
3. `supabase/migrations/0003_pipeline_strategy.sql`

> Se o passo 3 reclamar de `ALTER TYPE ... ADD VALUE ... cannot run inside a
> transaction`, rode **só essa primeira linha** sozinha e depois o resto do arquivo.

---

## 3. Secrets das Edge Functions

👉 Defina os segredos (server-side, nunca no frontend):
```bash
npx supabase secrets set \
  CRM_WEBHOOK_SECRET="<um-segredo-forte-compartilhado-com-o-operacional>" \
  OPERACIONAL_ONBOARDING_URL="https://djdooeszhpftbiyzznli.supabase.co/functions/v1/crm-onboarding" \
  OPERACIONAL_CANCEL_URL="https://djdooeszhpftbiyzznli.supabase.co/functions/v1/crm-cancel-onboarding" \
  ANTHROPIC_API_KEY="sk-ant-..." \
  ANTHROPIC_COPILOT_MODEL="claude-sonnet-4-6" \
  CRM_SITE_URL="https://SEU-APP.vercel.app"
```
> `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados
> automaticamente nas functions pelo Supabase — não precisa setar.

---

## 4. Deploy das Edge Functions

```bash
npx supabase functions deploy crm-handoff
npx supabase functions deploy crm-cancel
npx supabase functions deploy projects-status
npx supabase functions deploy crm-copilot
npx supabase functions deploy crm-admin-users
```
> O `verify_jwt` por função já está em `supabase/config.toml` (HMAC nas de webhook,
> JWT nas autenticadas).

---

## 5. Auth: primeiro usuário admin

👉 No painel → **Authentication → Users → Add user** (email + senha).
👉 Para esse usuário ter acesso à gestão de usuários, marque o papel admin.
No **SQL Editor**:
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'voce@consulcard.com.br';
```

---

## 6. Importar a base de clientes

👉 No seu `.env` local (copie de `.env.example`) preencha `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`, e rode:
```bash
npm run import:base
```
> Ou use a tela **Importador** do app depois de publicado (upload CSV/Excel).

---

## 7. Frontend no Vercel

**Deploy automático via GitHub (configuração atual)**

O projeto já está ligado a `github.com/mypublidigital/consulcard-crm`, branch **`main`**.
Publicar é só:

```bash
git push
```

A Vercel constrói e publica sozinha. Não é mais necessário token nem `vercel deploy`.

Onde ficam as configurações no painel da Vercel (projeto `consulcard-crm`):

| O quê | Onde |
|---|---|
| Repositório conectado | **Settings → Git** → *Connected Git Repository* |
| **Branch de produção** | **Settings → Environments → Production** → *Branch Tracking* |
| Variáveis (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | **Settings → Environment Variables** |
| Forçar republicação | **Deployments → ⋯ → Redeploy** |

> A Vercel só constrói em push **novo**. Um commit que já estava no repositório
> antes de conectar não dispara build sozinho — nesse caso, use *Redeploy* ou
> faça um novo push.

⚠️ Não conectar este projeto ao repositório `consulcard-app`: aquele é do
**Consulcard Projetos** (módulo 1). Cada módulo tem seu próprio repositório,
seu projeto Supabase e seu domínio.

**Opção B — Vercel CLI:**
```bash
npx vercel               # primeira vez: vincula o projeto
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

> Quando `VITE_SUPABASE_URL`/`ANON_KEY` estão setadas, o app sai do modo demo
> automaticamente e passa a ler/gravar no Supabase.

---

## 8. Conectar o operacional (depois)

Estes endpoints precisam existir **do lado do Consulcard Projetos** para o handoff
funcionar de ponta a ponta (hoje só existe o lado do CRM):
- `POST /functions/v1/crm-onboarding` (recebe o handoff, valida HMAC, cria projeto)
- `POST /functions/v1/crm-cancel-onboarding` (cancelamento)
- `GET` de catálogo (taxonomia §10) para o CRM consumir
- chamar `POST {CRM}/functions/v1/projects-status` em mudanças de status

O segredo `CRM_WEBHOOK_SECRET` deve ser **o mesmo** nos dois módulos.

---

## 9. Smoke test pós-deploy

- [ ] Login no app publicado (usuário do passo 5).
- [ ] Contas (ABM) lista a base importada.
- [ ] Abrir uma conta → editar, registrar interação, co-piloto responde (Sonnet).
- [ ] Pipeline → arrastar card, abrir detalhe, mover para Fechado dispara o handoff
      (vai falhar até o operacional ter o endpoint — esperado; ver `webhook_logs`).
- [ ] Config → criar usuário, cadastrar motivo de não-venda e serviço.
- [ ] Importador → subir um CSV de teste.
