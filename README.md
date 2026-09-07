# Consulcard CRM

Segundo módulo do **ERP Consulcard**. CRM baseado em **Account Based Marketing (ABM)**:
cada cliente é uma conta-alvo com estratégia individual. Atua *upstream* do funil
(captação → qualificação → proposta → negociação → fechamento) e, no fechamento,
dispara o **handoff** para o módulo operacional **Consulcard Projetos**.

> Mesma stack do operacional: **React + Vite** (Vercel) · **Supabase** (Postgres + Auth +
> Edge Functions) · **Claude Haiku 4.5** para o co-piloto ABM. O CRM usa um **projeto
> Supabase próprio** — a integração com o operacional (`djdooeszhpftbiyzznli`) é por
> HTTP/Edge Function, nunca por banco compartilhado.

## Status do build (incremental)

| Módulo | Tela / artefato | Status |
|---|---|---|
| Fundação | Scaffold React+Vite+Tailwind, design system | ✅ |
| Modelo de dados | `supabase/migrations/0001_init.sql` + `0002_services.sql` | ✅ |
| Importador | `scripts/import-base.mjs` (planilha → Supabase) | ✅ |
| Contas (ABM) | Lista com filtros + Conta-visão | ✅ |
| Dashboard de funil | visão consolidada (parcial) | ✅ |
| Agenda de execução | dupla visão Dia/Semana/Mês + por cliente | ✅ |
| Serviços | catálogo (§10) com valores sugeridos editáveis | ✅ |
| Pipeline / Deals | kanban drag&drop, visão financeira, Stand by/Perdido, link de proposta, detalhe do card, handoff HMAC | ✅ |
| Co-piloto ABM | agente conversacional (Claude Sonnet) + heurística demo | ✅ |
| Conta-visão | campos completos + edição + interações + estratégia caderno | ✅ |
| Config / Integração | usuários (Edge Function admin), motivos de não-venda, serviços | ✅ |
| Importador | upload CSV/Excel com pré-visualização | ✅ |

> Pendente para a fase Supabase/Vercel: tela de teste de handoff + log de webhooks
> (a tabela `webhook_logs` já existe), e provisionar os endpoints do lado operacional.

### Modelo financeiro (Serviços → previsão por etapa)

1. **Serviços** (`services`) — catálogo derivado da taxonomia §10, cada serviço com
   `suggested_value_brl` (editável).
2. **Serviços de interesse do lead** (`account_services`) — ao criar/editar uma tarefa de
   ABM, o usuário marca os serviços que interessam à conta (valor estimado = sugerido,
   editável). Isso define o **valor de oportunidade** da conta.
3. **Visão financeira** (Pipeline) — para cada etapa do funil ABM mostra o **% de
   fechamento** (`STAGE_PROBABILITY`: lead 10% · qualificado 25% · proposta 50% ·
   negociação 75% · fechado 100%) e a **previsão de faturamento ponderada** =
   Σ(serviços de interesse) × % da etapa. A ação **Fechar** dispara o handoff.

## Modo demo (sem Supabase)

O app roda **sem credenciais**, em modo somente-leitura, lendo
`src/demo/accounts.json` (gerado da planilha real). Útil para desenvolver a UI antes de
provisionar o Supabase.

```bash
npm install
npm run gen:demo     # regenera o JSON demo a partir da planilha
npm run dev          # http://localhost:5174
```

## Setup do Supabase (produção)

1. **Criar projeto** em https://supabase.com (novo, **não** reusar o ref do operacional).
2. Copiar `.env.example` para `.env` e preencher:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (scripts — **nunca** no front)
3. **Aplicar o schema**: no SQL Editor do Supabase, cole e rode
   `supabase/migrations/0001_init.sql` (ou `supabase db push` com a CLI).
4. **Importar a base**:
   ```bash
   npm run import:base   # usa BASE_XLSX_PATH ou o default em Downloads
   ```
5. `npm run dev` — o app sai do modo demo automaticamente quando as credenciais
   `VITE_*` estão preenchidas.

## Integração com o Consulcard Projetos (handoff)

- **Trigger**: deal → `fechado` ⇒ `POST` para `OPERACIONAL_ONBOARDING_URL`
  (`/functions/v1/crm-onboarding`).
- **Auth**: HMAC-SHA256 (`X-Consulcard-Signature`, `X-Consulcard-Timestamp`), segredo
  compartilhado `CRM_WEBHOOK_SECRET`.
- **Idempotência**: `external_handoff_id` único por deal; retries com backoff.
- **Catálogo**: o seletor de `macro_category`/`project_type` consome o catálogo do
  operacional via `OPERACIONAL_CATALOG_URL` (não duplicar taxonomia).
- **Webhook de retorno**: status do projeto atualiza `accounts.health` no pós-venda.

> A camada de handoff (Edge Functions + tela de Pipeline) é o próximo incremento.

## Importação de planilha — o que ela faz com a base

- **Casa pelo nome da conta** (ignorando maiúsculas/minúsculas). Nome que já
  existe é **atualizado**; nome novo cria conta. Não duplica.
  > O CNPJ **não** é usado como chave: "Acme" e "Acme Brasil" viram
  > duas contas. Padronize os nomes antes de subir.
- **Coluna vazia não apaga o que já está no CRM.** A atualização só sobrescreve
  o que veio preenchido, então reimportar não zera segmento/porte/termômetro
  curados à mão. Vale também para valor recusado na validação.
- **Planilha sem contatos preserva os contatos existentes** (a base tem muitas
  linhas sem coluna de contato).
- **Dado fora do padrão não é gravado**: o campo fica vazio e a linha aparece no
  quadro de avisos da tela, com o **número da linha da planilha** para correção
  na origem. Nada de enum inválido chegando ao banco.

## Qualidade e integridade da base

**Bot de QA** — varre todas as telas exercitando filtros, consultas, inclusões e
exclusões, e reporta PASS/FAIL por verificação (91 checagens).

```bash
npm run dev            # precisa estar em MODO DEMO (sem .env) — o bot cria e apaga registros
```

Com o app aberto, cole `scripts/crm-bot.js` no console do navegador e rode:

```js
await crmBot()                             // varredura completa
await crmBot({ only: ['contas','agenda'] })// só um trecho
```

**Auditoria de contatos** — compara o banco com a planilha-base e aponta perdas.
Criada após o incidente de ago/2026 (ver `saveContacts` em `src/lib/data.js`):

```bash
npm run audit:contacts          # só relata
npm run audit:contacts -- --fix # restaura o que falta (nunca apaga)
```

O casamento é por **e-mail**, caindo no nome só quando a planilha não traz
e-mail: a coluna de nome da planilha costuma ser inconsistente (às vezes traz o
próprio e-mail no lugar do nome, às vezes "Sobrenome, Nome"), e casar por nome acusava
perda onde não havia. Confira a lista antes de usar `--fix` — contato que existe
no CRM com nome diferente do da planilha viraria duplicata.

## Estrutura

```
src/
  components/   Layout, PageHeader, Badge
  lib/          supabase.js, data.js (demo↔Supabase), constants.js
  pages/        Dashboard, AccountsList, AccountView, Placeholder
  demo/         accounts.json (gerado)
scripts/
  parse-base.mjs      parser canônico da planilha (regras §4)
  import-base.mjs     popula o Supabase (service role)
  gen-demo-data.mjs   gera o JSON do modo demo
supabase/
  migrations/0001_init.sql   modelo de dados (§5)
```
