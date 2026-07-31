# Sysloc Backend

SaaS multi-empresa de gestão de locação de imóveis. Backend em Node/NestJS/PostgreSQL,
**nativo, sem Docker**. Substitui integralmente o backend Frappe/ERPNext que vive em
`/opt/frappe` e que será desinstalado ao fim do projeto.

> **Idioma**: **português brasileiro em tudo**, sem exceção. Vale para as **respostas no terminal**,
> perguntas de `AskUserQuestion`, raciocínio exibido, documentação, artefatos de spec, comentários
> de código e mensagens de commit. Decisão do usuário, sem negociação. Aplica-se à sessão principal
> **e** a todo subagente despachado por qualquer skill do framework agent-spec.
>
> **Modelo**: este projeto roda **exclusivamente em Opus**. Decisão do usuário, sem negociação.
> Vale para a sessão principal **e** para todo subagente despachado por qualquer skill do
> framework agent-spec — executor, `agent-spec-qa-validator` e
> `agent-spec-staff-architecture-review` inclusive. **Sonnet e Haiku estão proibidos**, mesmo
> quando a skill os recomenda no próprio `SKILL.md` ou quando a heurística de `gates`/`model` do
> `agent-spec-workflow-rules.md` os sugeriria. Onde a regra do framework mandar `sonnet`, leia
> `opus`; onde já mandar `opus[xhigh]`, mantenha.

---

## Estado atual

**Fase 0 não iniciada.** O repositório contém apenas os ativos de planejamento migrados e a
estrutura de diretórios. `apps/` e `packages/` estão vazios.

---

## ⚠️ Leitura obrigatória antes de qualquer implementação

Nesta ordem. **Nenhum destes é dispensável** — o plano de execução referencia decisões apenas
pelo número, e sem os dois arquivos de `.claude/plans/` essas referências ficam sem conteúdo.

| # | Arquivo | O que carrega |
|---|---|---|
| 1 | `docs/plano-backend-novo/decisao-e-stack.md` | A decisão, a **stack completa** com justificativas, o layout do monorepo, a estratégia de compatibilidade com o frontend, o inventário do que porta e do que morre, o destino das ADRs |
| 2 | `docs/plano-backend-novo/plano-execucao.md` | As **8 fases** (F0–F7), entregas e critérios de aceitação executáveis |
| 3 | `.claude/plans/plano-saas-decisoes.md` | As **40 decisões fechadas** — o plano de execução as cita por número |
| 4 | `.claude/plans/plano-saas.md` | Arquitetura-alvo, os 3 perfis, as **10 telas × 7 ações sensíveis**, a especificação do webhook Sicoob |
| 5 | `docs/plano-backend-novo/levantamento-frontend.md` | O frontend React: inventário dos **35 endpoints**, o **modelo de domínio que a API deve falar**, os acoplamentos a remover |
| 6 | `docs/adr/` | ADRs. **A ADR-0001 (modelo canônico de cobrança com adaptador por provedor) e a ADR-0006 (ambiente de verificação separado do que atende a operação) sobrevivem inteiras.** As 0002 e 0003 morreram com o Frappe |

Por fase: a **F4** exige `docs/specs/features/integracao-bancaria-configuravel/`; a **F6** exige
o levantamento do frontend (item 5).

**O critério que separa a ADR que morre da que sobrevive é o substrato.** A 0002 e a 0003 nomeiam
primitivas do Frappe — DocType, fixture, `Custom DocPerm` — e vão junto com elas. A 0006 não nomeia
mecanismo nenhum: a decisão é *"a suíte de verificação nunca executa contra o ambiente que atende a
operação; qual ambiente concreto cumpre o papel varia ao longo do tempo — o invariante é a separação,
não um servidor específico"*, e uma das alternativas que ela rejeita **antecipa literalmente esta
migração**. Ela é o que a **T4 da F0 materializa** (instâncias efêmeras próprias, `embedded-postgres`)
e o que impede a suíte de tocar o banco que opera enquanto `/opt/frappe` seguir de pé. Não superseder:
uma ADR nova com a mesma decisão seria churn.

---

## Stack

Detalhe e justificativa em `decisao-e-stack.md` §4. Resumo:

**Node 24 LTS · TypeScript strict · NestJS + Fastify · Drizzle + drizzle-kit + postgres.js ·
PostgreSQL 18 · Zod · ts-rest · better-auth · BullMQ + ioredis + Redis 7 · nodemailer ·
Pino + OpenTelemetry · Vitest + embedded-postgres · pnpm + Turborepo + Biome + mise + mprocs +
tsup + tsx**

Específicos deste domínio: **undici** (mTLS do Sicoob), **`node:crypto` `X509Certificate`**
(leitura de `.pfx`), **@react-pdf/renderer** + **pdf-lib** (contrato e carnê), **systemd timers**
(agendamento).

---

## Invariantes — não negociáveis

1. **Multi-tenancy é fundação, não retrofit.** Toda tabela de negócio nasce com `empresa_id`,
   **RLS habilitada** (`USING` e `WITH CHECK`) e **FK composta `(id, empresa_id)`**. Referência
   cross-tenant é impossível pelo banco, não impedida por validação de aplicação.
2. **O contexto de tenant nunca é lido do request.** `AsyncLocalStorage` + `SET LOCAL
   app.empresa_id` por transação.
3. **Nenhum segredo versionado.** Certificado `.pfx`, senha de banco e chave de cifra vivem fora
   do repositório (`EnvironmentFile` 0600). O `.gitignore` barra `.env`, `*.pfx`, `secrets/`.
4. **Dinheiro em `numeric(15,2)`**, nunca float.
5. **IDs textuais legíveis** (`CTR-2026-0001`) preservados — o frontend os exibe como título de
   contrato, label de select e campo "Identificador". Chave interna é UUID; o código legível é
   coluna própria, única por empresa.
6. **A API fala o modelo de domínio camelCase** que o frontend já usa internamente
   (`levantamento-frontend.md` §6) — não o formato do Frappe.
7. **Tudo sobe sozinho após reboot.** Unit systemd por serviço, `Restart=always`,
   `Persistent=true` nos timers. É critério de aceitação da F0, testado com `reboot` real.
8. **Redis com AOF ligado** — ele guarda a fila do BullMQ, não só cache.

---

## Convenções

- **Testes**: Vitest com `embedded-postgres` (Postgres real e efêmero). A convenção de
  rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de INVARIANTES por arquivo vem do backend
  antigo e **deve ser mantida**.
- **Lint/format**: Biome. Sem ESLint, sem Prettier.
- **Commits**: Conventional Commits em pt-BR — ver a skill `agent-spec-semantic-commit`.
- **Specs**: o framework agent-spec está em `.claude/` (36 skills, 6 rules, 3 agents). Features
  novas seguem o pipeline SDD/miniSpec/TaskCard com os gates de QA e Tech Review.

---

## Comandos

Ainda não existem — serão criados na F0. Previstos:

```bash
mise install          # fixa Node 24 e ferramentas
pnpm install
pnpm build            # Turborepo
pnpm test             # Vitest + embedded-postgres
mprocs                # sobe api, worker e Mailpit em desenvolvimento
```

---

## Contexto do backend antigo

`/opt/frappe` ainda está **de pé e operando** — só é desligado na F7. Consultá-lo é legítimo
(`docker compose exec -T backend bench --site frontend ...`), mas:

- O site `frontend` é **produção**. Nada destrutivo.
- A **caracterização das regras de negócio** (a T4, em
  `docs/specs/features/saas-multi-empresa/v1/tasks/T4.md`) precisa rodar contra ele **antes da
  F3** — é a prova de equivalência do gerador de contrato de 752 linhas.
- A credencial de API do ERPNext segue **exposta em texto claro** no bundle público da porta
  8300 enquanto ele existir. Pendência aberta.
