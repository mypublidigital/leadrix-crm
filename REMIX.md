# Remix para a Leadrix — ponto de partida

Este projeto é uma **cópia limpa** de um CRM ABM já em produção para outro
cliente. O código veio inteiro; os dados e a identidade do cliente original,
não. Este arquivo existe para a próxima conversa começar sabendo o que já foi
feito e o que falta.

## O que já foi removido (não precisa refazer)

| Item | Estado |
|---|---|
| Histórico do Git do projeto original | não veio — repositório novo, sem ancestral comum |
| Base de demonstração (96 contas e 72 contatos reais) | `src/demo/accounts.json` esvaziado (`[]`) |
| Valores comerciais do catálogo (21 serviços) | zerados (`suggested_value_brl: null`) |
| Credenciais (`.env`, `.env.local`) | não vieram (o `.gitignore` já bloqueia) |
| Vínculos com Supabase e Vercel do original (`.vercel`, `supabase/.temp`) | não vieram |
| Menções a clientes reais em comentários | generalizadas |

Confirmado por varredura: **zero** ocorrências de nomes de clientes do projeto
original. O build passa.

## O que falta — o trabalho do remix

### 1. Identidade (mecânico, ~90 ocorrências)
O nome do cliente original ainda aparece em ~30 arquivos: `package.json`,
`index.html`, `README.md`, `DEPLOY.md`, `src/components/Logo.jsx`,
`src/components/Layout.jsx`, `tailwind.config.js` (paleta), migrations e Edge
Functions. É busca-e-substitui mais o logo e as cores.

### 2. Estrutura de campos — onde o esforço se concentra
Mudar um campo hoje exige tocar em **seis** lugares. Vale decidir logo se
compensa centralizar essas definições antes de mexer:

1. `supabase/migrations/` — o schema
2. `src/lib/constants.js` — classificação, segmento, porte, etapas do funil,
   termômetro, tipos de tarefa, origem do lead
3. `src/data/servicesCatalog.js` — **21 serviços de meios de pagamento**;
   a Leadrix é agência, a taxonomia é outra por completo
4. Formulários: `AccountEditModal`, `TaskModal`, `OpportunityModal`
5. Filtros: `AccountsList`, `Agenda`
6. `src/lib/parseUpload.js` — mapeamento de colunas do importador

### 3. Integração que não se aplica
O original faz *handoff* para um sistema operacional irmão via HMAC
(`supabase/functions/crm-handoff`, `crm-cancel`, `projects-status`, `catalog`).
Sem esse sistema do lado da Leadrix, essas funções não têm para onde apontar —
decidir se some, se vira outra coisa, ou se fica dormente.

### 4. Infraestrutura nova (nada é reaproveitável)
- Projeto **Supabase** próprio (aplicar as migrations `0001`→`0008` em ordem)
- Projeto **Vercel** próprio
- Repositório **GitHub** próprio

## Como rodar agora

```bash
npm install
npm run dev        # http://localhost:5174
```

Sobe em **modo demo** (sem `.env`), lendo `src/demo/accounts.json` — que está
vazio. Dá para evoluir a estrutura de campos inteira sem banco nenhum e só
provisionar o Supabase quando o modelo estiver fechado.

## O que vale saber sobre o código

- `src/lib/data.js` é a única fronteira entre modo demo (localStorage) e
  Supabase. Toda tela passa por ele.
- `saveContacts` **insere antes de apagar**, de propósito: a ordem inversa já
  causou perda de contatos em produção. Não inverter.
- A importação **atualiza** conta existente (casada pelo nome) e **não apaga**
  campo que a planilha traz vazio — reimportar não zera o que foi curado à mão.
- `scripts/crm-bot.js` é um bot de QA que varre todas as telas. Roda **só em
  modo demo**: ele cria e apaga registros.
- `scripts/audit-contacts.mjs` audita contatos contra uma planilha-base. Se a
  Leadrix não tiver esse fluxo de planilha, provavelmente não serve.
