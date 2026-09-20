# Remix para a Leadrix — estado

Este projeto nasceu como cópia limpa de um CRM ABM de outro cliente. O remix
para a Leadrix foi feito em set/2026. Este arquivo registra o que mudou e o que
ainda depende de decisão.

## Feito

| Item | Onde |
|---|---|
| Identidade Leadrix (menu preto, azul de interação, verde da marca, Jost/Manrope, logo) | `tailwind.config.js`, `src/index.css`, `Logo.jsx`, `Layout.jsx`, `public/` |
| 4 pilares de entrega e catálogo de serviços por pilar | `src/data/leadrix.js`, `src/data/servicesCatalog.js` |
| 4 mercados com decisores, dores e indicadores; microssegmentos editáveis e filtros encadeados | `src/data/leadrix.js`, `SegmentFilters.jsx`, Configurações |
| Nível ABM (1:1, 1:few, 1:many), porta de entrada, cobertura do comitê de compra | cadastro e visão da conta |
| Tabela de custo de venda (hora-homem, despesas, horas por ação, fixos, margem) | `SalesCostSettings.jsx`, `src/lib/costs.js` |
| Custo por ação, oportunidade e conta; custo do lead, de conversão e ROI | `TaskModal.jsx`, `AccountCostPanel.jsx`, `CustosRoi.jsx` |
| Radar ABM: jogadas proativas por aging, com custo estimado | `src/data/abmPlaybook.js`, `src/lib/abm.js`, `RadarAbm.jsx` |
| Estúdio de conteúdo (blog, LinkedIn, Instagram, e-mail 1:1) ligado às jogadas | `src/lib/content.js`, `ContentComposer.jsx`, `crm-content` |
| Co-piloto com conhecimento da Leadrix e de ABM | `copilot.js`, `crm-copilot`, `_shared/leadrix-knowledge.ts` |
| Schema e seeds | `supabase/migrations/0010_leadrix.sql`, `db/install.sql` |
| Perfis Admin / Marketing / Vendas, com regra no banco (só admin exclui oportunidade; custo restrito) | `src/lib/permissions.js`, `useAuth.js`, migração `0011` |
| Origem do lead (Boomit, MyPubli, sócios, Outros) e comissão de indicação no custo de conversão | `AccountEditModal.jsx`, `src/lib/costs.js`, `CustosRoi.jsx` |
| Contexto estratégico de ABM: pontuação ICP, sinais, campanhas, jornada, estrutura da mensagem, métricas | `src/data/abmContext.js`, `AccountAbmPanels.jsx`, `Dashboard.jsx` |
| Mensageria: modelos por evento, fila e envio pelo Gmail com alias | `src/lib/messaging.js`, `pages/Mensageria.jsx`, `supabase/functions/crm-email` |
| Timeline de relacionamento (ações, interações, e-mails, funil, conteúdo) | `src/lib/timeline.js`, `AccountAbmPanels.jsx` |
| Ambiente publicado (schema + functions no projeto `werxdvpowcpomleizhes`) | ver `DEPLOY.md` |

## Pendente de decisão

1. **Microssegmentos de Indústria, Varejo e Empresas Digitais** — o site não
   lista; entraram como proposta inicial.
2. **Preços dos serviços** — o catálogo nasce sem valor (o modo demo usa
   exemplos).
3. **Custos reais** — hora-homem, despesas e fixos da operação comercial.
4. **Credenciais do Gmail** — sem elas a mensageria enfileira mas não envia
   (ver DEPLOY §3).
5. **Primeiro usuário admin** — precisa ser criado no painel do Supabase
   (DEPLOY §1); criar conta com senha não é tarefa que eu faça.
6. **Envio automático de e-mail** — o app não tem agendador: modelos automáticos
   deixam a mensagem pronta na fila. Decidir se haverá disparo sem revisão.
7. **Handoff** — as functions de integração com sistema de projetos ficam
   dormentes até existir um.
8. **`scripts/crm-bot.js`** (QA automatizado) ainda cobre as telas antigas; não
   exercita Radar, Estúdio, Custos e Mensageria.
9. **Rotação de chaves** — Anthropic e Supabase passaram por conversa; vale
   trocar quando o ambiente estabilizar.
