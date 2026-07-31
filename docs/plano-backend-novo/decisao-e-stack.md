# Backend novo Sysloc — decisão, stack proposta e ponto de retomada

> **Documento de decisão e stack.** Criado em 2026-07-30 como handoff de sessão; atualizado no
> mesmo dia com as 4 respostas do usuário (§7).
>
> **Estado**: stack **aprovada**, caminho e refinamentos confirmados. Plano de execução em fases
> em `plano-execucao.md` (mesmo diretório).

---

## 1. A decisão (indiscutível — tomada pelo usuário em 2026-07-30)

**Abandonar o backend Frappe/ERPNext e construir um backend novo do zero**, nativo, sem Docker,
já nascido multi-empresa conforme o plano de SaaS fechado.

Requisitos declarados pelo usuário, literalmente:

1. Novo backend em diretório **fora de `/opt/frappe`**, num lugar relevante e correto.
2. **Totalmente nativo, SEM DOCKER.**
3. O backend novo é **reflexo do backend atual**.
4. O frontend **praticamente nem deveria sentir** que o backend é outro.
5. **TODAS** as automações atuais devem funcionar corretamente.
6. **TODO** o app deve funcionar como funciona e como funcionaria com o backend atual.
7. Da forma **mais profissional possível**.
8. Scripts em Python → **TypeScript**. Tudo de Python é reescrito.
9. Ao final, **excluir e desinstalar definitivamente** tudo do backend atual.
10. Scripts de **backup e restore reescritos** para o backend novo.
11. **Aproveitar literalmente tudo** que já foi planejado sobre a transformação em SaaS.

### Por que a decisão foi tomada (resumo do que a sessão apurou)

- **Não existe autenticação de usuário no sistema.** `isSignedIn()` é
  `localStorage.getItem('usuario') !== null`. O login retorna `{success, nome, usuario}` — sem
  token, sem sessão. Todo tráfego real usa **uma credencial de serviço compartilhada**, embutida
  no bundle público. O backend nunca soube quem está agindo. **Multi-tenancy é impossível sobre
  essa fundação** — o trabalho de reconstruir auth é pago nos dois caminhos.
- A `saas-multi-empresa/v1` (10 tasks) existe apenas para tornar o metadado do Frappe
  versionável. Após 2 tasks concluídas (uma parcial) e **9 rodadas de gate só na T1**, ela ainda
  não termina — e não entrega multi-tenancy.
- `bench migrate` pode **apagar silenciosamente a definição** dos cadastros por erro no nome
  derivado da classe do controller (`Verificar scheduler` → `Verificarscheduler`), saindo com
  exit 0.
- 10 fluxos do frontend foram desenhados **em torno das limitações do Frappe** (joins N+1 no
  cliente, transações multi-passo sem rollback na UI, edição campo-a-campo, draft/submit).

---

## 2. Ativos de planejamento aproveitados (fonte desta proposta)

| Arquivo | Conteúdo |
|---|---|
| `.claude/plans/plano-saas.md` (464 linhas) | Plano mestre: Parte 0 (espec. geral), Parte 1 (backend, F0–F8), Parte 2 (frontend) |
| `.claude/plans/plano-saas-decisoes.md` (424 linhas) | **As 40 decisões fechadas**, com o histórico das 10 rodadas |
| `docs/specs/features/saas-multi-empresa/v1/pre-refinement.md` | Tree-of-Thought, fatiamento A2/B3/C2/D1+D3/E2 |
| `docs/prds/.../saas-multi-empresa/v1/prd.md` | 8 US, 11 CA |
| `docs/adr/0001..0006` | ADRs (ver §6 — quais sobrevivem) |
| Relatório do frontend (produzido pelo agente na máquina local do usuário) | 25.566 LOC TS, 22 páginas, inventário completo dos 35 endpoints, 15 arquivos com vazamento do Frappe |

### Dimensionamento do backend atual

- **8.489 LOC** de Python de produção (89 arquivos `.py`)
- **9.735 LOC** de testes Python
- `PDF contrato`: **752 linhas**, existindo apenas no banco (Server Script)
- 19 Server Scripts desativados
- 6 rotinas de cron; 4 scripts de backup/restore

---

## 3. Onde vai morar

```
/opt/sysloc-backend/     ← repositório git novo, independente  (CONFIRMADO — §7)
```

Razão: `/opt` é onde o host já coloca aplicação (`/opt/frappe`, `/opt/react`), o CloudPanel não
disputa esse caminho e a separação é total. Backups em `/opt/backups/sysloc/`.

> **Nota de permissão**: `/opt` pertence ao `root` e o `sudo` deste host exige senha. A criação
> do diretório é o **único** passo que precisa de elevação:
> `sudo mkdir -p /opt/sysloc-backend && sudo chown sysloc:sysloc /opt/sysloc-backend`.
> Depois disso o diretório é do `sysloc`, como já é o `/opt/frappe`.

---

## 4. Stack proposta

Coluna "vs. frotas" compara com a lista de stack que o usuário forneceu do outro projeto.

| Camada | Escolha | vs. frotas |
|---|---|---|
| Runtime | **Node.js 24 LTS** | = |
| Linguagem | **TypeScript strict** | = |
| Monorepo | **pnpm workspaces + Turborepo** | = |
| Framework | **NestJS + Fastify** | = |
| ORM | **Drizzle + drizzle-kit + postgres.js** | = |
| Banco | **PostgreSQL 18** (PGDG, nativo) | = |
| Validação | **Zod** | = |
| Contratos | **ts-rest + Zod** | = · peça central aqui (§5) |
| Auth base | **better-auth** | = · com ressalva (§4.2) |
| Filas | **BullMQ + ioredis + Redis 7** | = |
| E-mail | **nodemailer** (Gmail em prod — decisão 34) + **Mailpit** em dev | = |
| Logs/traces | **Pino + OpenTelemetry** | = |
| Testes | **Vitest + embedded-postgres** | = |
| Build/dev | **tsup + tsx + Biome + mise + mprocs** | = |
| API docs | **@nestjs/swagger** | = |
| **mTLS Sicoob** | **undici** (`Agent` com `connect: {pfx, passphrase}`) | **novo** |
| **Leitura de certificado** | **`node:crypto` `X509Certificate`** (nativo) | **novo** — substitui `node-forge` |
| **PDF — contrato** | **@react-pdf/renderer** | **novo** |
| **PDF — merge (carnê)** | **pdf-lib** | **novo** |
| **Agendamento** | **systemd timers** → CLI que enfileira no BullMQ | **novo** (§4.3) |
| **Object storage** | **filesystem com interface S3** dia 1; MinIO só quando houver anexo real | **difere** |
| **Cripto de segredo** | **`node:crypto` AES-256-GCM**, chave em `EnvironmentFile` 0600 | **novo** |

### 4.1 Justificativa das divergências

- **`undici`**: o Sicoob exige mTLS com `.pfx`. É o motor do `fetch` nativo do Node e aceita
  `pfx`/`passphrase` direto no dispatcher, com pool por empresa. Zero dependência extra.
- **`X509Certificate` nativo**: hoje o *frontend* lê o `.pfx` com `node-forge` para mostrar
  titular/validade. No servidor é nativo desde o Node 15 — menos superfície, e o certificado
  para de trafegar para o browser.
- **Sem Puppeteer/Chromium**: fidelidade melhor, mas ~300 MB e um navegador headless num
  servidor com disco apertado. `@react-pdf/renderer` é declarativo e o time já usa no frontend;
  `pdf-lib` resolve concatenação — tirando do browser a montagem do carnê.
- **MinIO adiado**: hoje o único arquivo persistido é o `.pfx`. Subir serviço S3 para guardar um
  certificado é cerimônia. A interface nasce abstrata; trocar o adapter depois é uma linha.

### 4.2 Multi-tenancy — as 7 camadas do plano, traduzidas

| Camada do plano (Frappe) | Como fica no Postgres |
|---|---|
| 1 — `permission_query_conditions` (listagens) | **RLS policy** `USING (empresa_id = current_setting('app.empresa_id')::uuid)` |
| 2 — `has_permission` (documento único) | **a mesma RLS** — não há dois caminhos para o dado |
| 3 — `before_insert` carimba empresa do servidor | **RLS `WITH CHECK`** + default na coluna |
| 4 — `validate` proíbe Link cross-tenant | **FK composta `(id, empresa_id)`** → cross-tenant vira **estruturalmente impossível** |
| 5 — resolução de tenant nunca lê do request | **AsyncLocalStorage** + guard NestJS; `SET LOCAL` por transação |
| 6 — allowlist no nginx | **desnecessária** — a API só expõe o que declara |
| 7 — suíte de isolamento + teste-guarda | **mantida** + teste que falha se alguma tabela de negócio não tiver RLS habilitada |

**better-auth com ressalva**: cobre sessão, hash, lockout, 2FA/TOTP e cookie
`httpOnly+Secure+SameSite` — a decisão 13 inteira. O plugin `organization` mapeia `Empresa`. Mas
a matriz de **10 telas × 7 ações sensíveis** (decisão 38) é mais fina que o modelo de roles dele.
→ **better-auth para identidade e sessão; autorização 10×7 própria em `@sysloc/auth`**,
alimentando o objeto de sessão "gordo" com `versao_permissoes` (D1+D3 do pré-refinamento).

### 4.3 Agendamento — refinamento proposto da decisão 30

A decisão 26 recusa agendador embutido (o scheduler do Frappe parou sem aviso em produção); a
decisão 30 manda versionar em `/etc/cron.d`.

**Proposta: systemd timers em vez de cron.d.** Mesmo princípio (gatilho do SO, externo à
aplicação, versionado, instalado por script idempotente), mas com `systemctl list-timers`
mostrando a próxima execução, log no journald e `OnFailure=` disparando alerta — a decisão 31
(alerta de rotina atrasada) sai de graça. **Refinamento, não contradição. Pendente de aval (§7.2).**

---

## 5. Layout do monorepo

```
/opt/sysloc-backend/
├── apps/
│   ├── api/          @sysloc/api      — NestJS+Fastify: REST, webhook Sicoob, OpenAPI
│   └── worker/       @sysloc/worker   — BullMQ: régua de cobrança, sync, PDFs, e-mail
├── packages/
│   ├── db/           @sysloc/db       — schema Drizzle, migrations, políticas RLS, seed
│   ├── contracts/    @sysloc/contracts— ts-rest + Zod (o pacote que o React consome)
│   ├── domain/       @sysloc/domain   — regras puras: mora, metragem, vencimento, seu_numero
│   ├── banking/      @sysloc/banking  — porta AdaptadorCobranca + adapter Sicoob (ADR-0001)
│   ├── auth/         @sysloc/auth     — better-auth, contexto de empresa, RBAC 10×7
│   └── shared/       @sysloc/shared   — tipos, erros, chaves de cache por empresa
├── deploy/
│   ├── systemd/      — units e timers versionados
│   ├── scripts/      — backup, restore, instalador (TypeScript via tsx)
│   └── nginx/        — vhost do CloudPanel
├── docs/             — specs, ADRs, planos (MIGRADOS de /opt/frappe — ver §8)
└── mprocs.yaml · .mise.toml · turbo.json · biome.json
```

`@sysloc/domain` separado de `apps/` é deliberado: são as regras que hoje estão presas em Server
Script e em controller do Frappe. Puras, testáveis sem banco, portáveis.

### 5.1 "O frontend praticamente nem deveria sentir" — estratégia escolhida

Três formas de atender o requisito 4:

- **A — imitar a API do Frappe byte a byte.** Frontend não muda nada, mas carrega a forma do
  Frappe para sempre (N+1, `docstatus` como regra, transações na UI, 36 mapeadores).
  **Rejeitada** — trocaria o motor mantendo o defeito.
- **B — API nova, frontend se adapta.** Máximo ganho; mexe em ~36 dos 126 arquivos.
- **C — API nova preservando o que o usuário vê. ← RECOMENDADA**

**Estratégia C, em detalhe:**

1. **IDs textuais legíveis preservados** (`CTR-2026-0001`, `COB-…`). O relatório do frontend
   apontou que essa é a decisão de maior impacto: hoje `contrato.name` é **exibido como título
   de contrato**, como label de select e como campo "Identificador". Internamente a chave é
   UUID; o código legível é coluna própria, única por empresa.
2. **A API fala o modelo de domínio camelCase que o frontend já usa internamente**
   (`FinanceiroFaturaItem`, `ContratoListItem`, `ImovelGeralItem`) — os ~36 mapeadores **somem**.
3. **Joins vão para o servidor** — a tela Financeiro deixa de fazer 5 a 9 round-trips.
4. **`docstatus` sai**; `status` passa a ter uma fonte só.
5. **`@sysloc/contracts` publicado** no GitHub privado (GitHub Packages) — o React importa tipos
   e cliente ts-rest. O `apiEndpointContracts.test.ts` (que trava 35 paths ERPNext) fica
   desnecessário: o compilador garante.

Resultado: **as telas não mudam, o comportamento não muda, só a camada de dados é religada.**

---

## 6. Inventário — o que porta, o que morre

| Origem | Destino |
|---|---|
| `cobranca_sicoob/*` (~1.700 LOC) — emissão, sincronização, consulta, baixa, sequencial, auth | **porta** → `@sysloc/banking` |
| `cobranca_bancaria/*` (~1.500) — modelo canônico, adapter Sicoob, certificado | **porta** → `@sysloc/banking` |
| `cobranca_automation/*` (~700) — régua, emailer, runner | **porta** → `apps/worker` + `@sysloc/domain` |
| `contrato_ativacao`, `contrato_cancelamento`, `cobranca_atraso` (~665) | **porta** → `@sysloc/domain` |
| `locatario_email_confirmacao` (222) | **porta** |
| `PDF contrato` (752, só no banco) | **porta** → `@react-pdf/renderer` |
| `integracao_bancaria_api/service.py` (1.524) | **porta parcial** — boa parte é encanamento do Frappe |
| `patches/v1_0/*` (~540) | **morre** — patches de migração do Frappe |
| `deploy/scripts/portao_orfaos.py`, `veredito_suite.sh` | **morrem** — existem por causa do `remove_orphan_doctypes` |
| 19 Server Scripts desativados | **auditar e descartar** |
| 9.735 LOC de testes Python | **reescrever em Vitest** — manter a convenção `CA-xx → CT-xxx (RN-xx)` |

**Estimativa: ~6.000 linhas de lógica de domínio real** a portar. O resto é Frappe.

### 6.1 Destino das ADRs

| ADR | Destino |
|---|---|
| 0001 — modelo canônico de cobrança bancária com adaptador por provedor | **SOBREVIVE inteira** (agnóstica de stack) |
| 0002 — versionar estrutura de dados do app em arquivo | **MORRE** (é grátis no stack novo) |
| 0003 — `Custom DocPerm` como fonte única de permissão | **MORRE** (Frappe-specific) |
| 0004 — endpoints herdados de Server Script preservam nome curto | **MUDA** — vira a decisão de compatibilidade de path com o React |
| 0005 — rotinas operacionais versionadas com instalação idempotente | **SOBREVIVE adaptada** (systemd) |
| 0006 — ambiente de verificação separado do que atende a operação | **SOBREVIVE em espírito** — `embedded-postgres` resolve melhor |

---

## 7. As 4 perguntas — RESPONDIDAS pelo usuário em 2026-07-30

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Caminho do repositório | **`/opt/sysloc-backend`** — hífen (convenção de `/opt`, de nome de pacote npm e do próprio host, ex.: `sysloc-react-1`), com a ordem invertida a pedido do usuário: produto primeiro, papel depois, para ordenar junto de outros `sysloc-*` |
| 2 | systemd timers no lugar de `/etc/cron.d` | **Sim** — decisão 30 refinada. Ganha `systemctl list-timers`, journald e `OnFailure=` alimentando a decisão 31 |
| 3 | IDs textuais legíveis preservados (estratégia C) | **Confirmado** — as telas não mudam; só a camada de dados do React é religada |
| 4 | Canal WhatsApp | **Só modelado, não implementado** — ver §7.1 |

### 7.1 Consequência da resposta 4 (WhatsApp)

Os 7 campos de estado de WhatsApp por locatário (`whatsapp_verificado`, `whatsapp_numero_e164`,
`whatsapp_ultima_mensagem_id`, `whatsapp_status_validacao`, `whatsapp_ultima_tentativa_em`,
`whatsapp_ultimo_retorno`, `whatsapp_reenvios`) **existem no modelo e são lidos pelo frontend**
— `HomeFinanceiroPage` exibe `whatsappVerificado` na tabela de faturas, e o enum de canal
aceita `email | whatsapp | ambos`.

Decisão de escopo:

- **Os campos permanecem no modelo de domínio** — o frontend os consome e a estratégia C exige
  que a API devolva o modelo que ele já usa.
- **Nenhum canal WhatsApp é implementado no worker.** O único canal funcional é e-mail.
- `whatsappVerificado` responde sempre `false`; a opção `whatsapp`/`ambos` no canal da régua
  fica **desabilitada na API** (validação Zod recusa) até existir implementação, em vez de
  aceitar silenciosamente e não enviar — que é o comportamento de hoje.
- Registrado como lacuna conhecida, candidata a feature própria depois da virada.

---

## 8. Pré-requisito da desinstalação (requisito 9)

Os ativos de planejamento vivem **dentro** de `/opt/frappe`. Migrar para `/opt/sysloc-backend` é
pré-requisito da exclusão, não etapa final:

```
.claude/plans/plano-saas.md              ← 40 decisões, 8 fases
.claude/plans/plano-saas-decisoes.md     ← histórico das 10 rodadas
.claude/{skills,rules,agents}/           ← todo o framework agent-spec
docs/adr/                                ← 6 ADRs
docs/prds/ · docs/specs/                 ← PRDs, tech specs, pré-refinamento
```

---

## 9. Estado do run interrompido (`saas-multi-empresa/v1`)

O run da skill `/agent-spec-sdd-run-tasks` foi **interrompido pelo usuário** no meio da T1.

- **T1** — reaberta por decisão do usuário (contador zerado), executor rodou 2 vezes.
  Rodada 1: QA `APROVADO_COM_OBSERVACOES` (7/7), Tech Review **REJEITADO** (1 CRÍTICO
  `architecture`, 1 ALTO, 1 MÉDIO, 2 baixos). Rodada 2: executor corrigiu; **o Gate 1 foi
  interrompido antes de emitir veredito.** `T1.md` está em 1169 linhas.
- **Nada foi commitado.** Todo o trabalho está no working tree como *intent-to-add*.
  `base_sha = 5a4e5197ee1d4e1cd262b6886c054ddf9a0da9b2` (HEAD inalterado).
- Memória lazy preservada em `docs/specs/features/saas-multi-empresa/v1/_run/tmp/T1.md`;
  telemetria completa em `_run/workflow-report.md`.

**Com a decisão de abandonar o Frappe, a v1 inteira (T1, T2, T3, T5, T6, T7, T10) perde
propósito** — ela existe para versionar metadado do Frappe. A exceção é a **T4**
(capturar as caracterizações das 6 regras de negócio com o original ainda ativo): o valor dela
**sobrevive à decisão** — vira a especificação executável do que portar e a prova de
equivalência do gerador de contrato de 752 linhas. Recomendação registrada: rodar a T4 antes de
desligar o Frappe.

---

## 10. Pendências de segurança (independem da decisão)

1. **Credencial de API exposta no bundle público.** `/opt/react/sysloc/html/static/js/main.*.js`
   contém `REACT_APP_ERPNEXT_API_KEY` e `_SECRET` em texto claro. A chave pertence a
   `servico-app@dominio.com` (`System User`, habilitado), com os 9 `Custom DocPerm` da ADR-0003
   — leitura e escrita nos cadastros de negócio, incluindo dados pessoais de locadores e
   locatários (LGPD). **Rotacionar.**
2. **Sicoob**: confirmar se há allowlist de IP no lado do banco (o backend novo pode sair pelo
   mesmo IP, mas precisa ser verificado) e onde vivem certificado e credenciais hoje.
