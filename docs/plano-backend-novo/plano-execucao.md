# Backend Sysloc — plano de execução em fases

> Derivado de `decisao-e-stack.md` (stack aprovada) e do fatiamento F0–F8 de
> `.claude/plans/plano-saas.md`. As **40 decisões** de `plano-saas-decisoes.md` são vinculantes;
> cada fase cita as que consome.
>
> **Repositório**: `/opt/sysloc-backend`
>
> **Revisão 1 de 2026-07-30 (a pedido do usuário)**: a ordem original punha a caracterização contra
> o Frappe como primeiro passo e empacotava "instalar a stack" junto de "criar a fundação
> multi-tenant" numa fase só. Reordenado: a **F0 agora é exclusivamente instalar e provar a
> stack**, sem uma linha de regra de negócio; a fundação SaaS virou a **F1**; e a caracterização
> saiu do caminho crítico e virou tarefa paralela.
>
> **Revisão 2 de 2026-07-30 — pré-refinamento**: este documento passou pelo brainstorm de entrega
> registrado em `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md`, que o validou
> como recorte de feature/versão. Quatro mudanças: (1) **este arquivo deixa de ser o plano e passa
> a ser o índice do programa** — cada fase aponta para uma feature do agent-spec (tabela abaixo);
> (2) a **caracterização volta para o início** como fatia própria e **ampliada** — a revisão 1 a
> tirou do caminho crítico por dependência, mas ela é o único ativo com **prazo de validade**;
> (3) a **F6 deixa de ser fase com execução aqui** e vira handoff de contrato + especificação
> executável, porque o fonte do React não vive neste servidor; (4) **cai a janela de rollback por
> tempo da F7** — o Frappe é single-tenant e sua base congela na virada, então nunca foi destino
> de rollback viável. Ver §F7.

---

## Princípio de ordenação

0. **Antes de tudo, o que expira.** A caracterização das regras legadas depende de um sistema que
   será desligado — é o único ativo do projeto com prazo de validade. Não bloqueia a F0 (são
   independentes), mas é a primeira coisa a executar. Ver § Caracterização.
1. **Primeiro a stack existe e se prova.** Instalada, funcional, reiniciando sozinha. Nenhum
   schema de domínio, nenhuma regra. O critério é operacional: dar `reboot` e tudo voltar.
2. **Depois a fundação SaaS.** Multi-tenancy e identidade **antes** da primeira entidade de
   negócio — é o ganho que justifica a troca total de backend, então nasce primeiro, não é
   retrofit.
3. **Só então o domínio.** Cada entidade de locação nasce dentro de um sistema que já sabe o que
   é empresa, usuário e permissão.

> No plano Frappe, multi-tenancy era a **F4** — retrofit sobre 19 DocTypes existentes, com 7
> camadas de enforcement e auditoria de 28 `ignore_permissions`. Aqui é a **F1**: a primeira
> migration de domínio já encontra RLS e FK composta prontas, e **nenhuma entidade de negócio
> consegue nascer sem tenant**.

---

## Recorte em features do agent-spec (índice do programa)

Cada fase é **uma feature própria em `v1`**, com nome de capacidade — não de fase, para sobreviver
a reordenação. Não existe feature guarda-chuva: `{version}` no agent-spec significa *nova iteração
da mesma feature*, não *próxima fase*.

| Fase | Feature (`docs/specs/features/…`) | Framework | Por quê |
|---|---|---|---|
| — | `caracterizacao-regras-legadas/v1` | **TaskCard** | 1 objetivo, só dev, sem decisão nova; a `T4.md` já existe quase pronta |
| F0 | `fundacao-stack-nativa/v1` | **miniSpec** | 8 entregas com CA executáveis, zero persona, zero regra de negócio |
| F1 | `fundacao-multitenancy-identidade/v1` | **SDD** | 3 perfis, matriz 10×7, RLS + FK composta + `AsyncLocalStorage` |
| F2 | `dominio-locacao/v1` | **SDD** | 8 entidades, 3 regras portadas, primeiros contratos ts-rest |
| F3 | `cobranca-mora-e-documentos/v1` | **SDD** | ciclo de cobrança, mora por empresa, régua, PDF de 752 linhas, carnê |
| F4 | `integracao-bancaria-sicoob/v1` | **SDD** | mTLS, webhook, `seu_numero` único do SaaS; consome a ADR-0001 |
| F5 | `automacoes-agendadas/v1` | **miniSpec** | porte com CA claros; o gatilho (systemd timers) já está decidido |
| F6 | `frontend-religado/v1` | **só handoff** (revisão 3) | o fonte do React não está neste servidor; a implementação inteira sai deste repositório |
| F7 | `virada-e-desinstalacao/v1` | **miniSpec, partida em duas** (revisão 3) | backup/restore e runbook entram no marco de entrega; virada e desinstalação viram sessão operacional futura |

O peso de cada fatia é **proposta, não decreto**: ao iniciar uma delas, roda-se um pré-refinamento
curto que recalcula amplitude/personas/novidade com o que já foi construído e pode promover ou
rebaixar o framework.

**Gates**: F1 e F4 tocam `auth`/`security`/`crypto`/`db_migrations` — pela heurística de Critical
Paths, `[qa, tech_review]` sempre, sem inferência para `[qa]`. E, pelo `CLAUDE.md`, **todo
subagente roda em Opus**, inclusive onde a regra do framework resolveria `sonnet`.

### Antes da primeira entidade de negócio: ADR de forma do contrato

Decisão arquitetural transversal a todas as fatias de domínio, a ser registrada **antes da F1**:
ID textual legível como chave exposta, corpo camelCase, `status` calculado no servidor, envelope de
erro com **código estruturado** e forma de paginação.

Motivo: `levantamento-frontend.md` §7.4 fecha com *"o maior risco não é técnico — é decidir o
contrato da nova API antes de escrever qualquer linha"*. Hoje o frontend classifica erro do Sicoob
**pelo prefixo do texto da mensagem** e extrai campo inválido por regex sobre `"O campo 'X'"`. Não
é desenhar os 35 endpoints agora — é fixar a *forma*, que é transversal e cara de reverter.

---

## Como o fatiamento muda em relação ao plano Frappe

| Fase do plano Frappe | Destino |
|---|---|
| F0 — contenção da credencial | **Sai do caminho crítico**, mas a credencial segue exposta enquanto o Frappe existir → rotação imediata (§ Pendências) |
| F1 — versionar 19 DocTypes | **Morre.** Schema em código é a definição do stack novo |
| F2 — infraestrutura Docker | **Morre.** Substituída pela F0 nova (infra nativa) |
| F3 — identidade e sessão | → **F1** |
| F4 — multi-tenancy | → **F1**, promovida de retrofit a **fundação** |
| F5+F6 — integração bancária e webhook | → **F4** |
| F7 — automações multi-tenant | → **F5** |
| F8 — painel Master e virada | → **F7** (virada) + feature própria `painel-master` (depois) |
| — | **F2 e F3 são novas**: o domínio de locação, que no plano Frappe já existia e aqui é construído |

---

## F0 — Stack instalada e provada

**Nenhuma regra de negócio. Nenhum schema de domínio.** O entregável é infraestrutura que
funciona e se recupera sozinha.

### Instalação

1. **`mise`** fixando Node 24 LTS; **pnpm**, **Turborepo**, **Biome**, **tsup**, **tsx**.
2. **PostgreSQL 18** — repositório PGDG, nativo, sob systemd, socket local.
3. **Redis 7** — APT, nativo, sob systemd, com **AOF ligado** (`appendonly yes`,
   `appendfsync everysec`) — ver § Persistência do Redis.
4. **Mailpit** — binário único, só em desenvolvimento.
5. Monorepo esqueleto: `apps/api` (NestJS+Fastify com `/health` e OpenAPI), `apps/worker`
   (BullMQ com um job trivial de ida e volta), `packages/shared`.
6. **`deploy/systemd/`**: units `sysloc-api.service` e `sysloc-worker.service`
   (`Restart=always`, `After=`/`Requires=` Postgres e Redis, `WantedBy=multi-user.target`),
   mais o instalador idempotente.
7. **Vitest + embedded-postgres** — um teste trivial que sobe Postgres real e efêmero.
8. **`mprocs.yaml`** para o ciclo de desenvolvimento.

### Aceitação (executável, não declarada)

- `mise install` + `pnpm install` + `pnpm build` limpos.
- `mprocs` sobe api, worker e Mailpit; `/health` verde; OpenAPI acessível.
- Um job enfileirado é consumido pelo worker.
- `pnpm test` passa com Postgres real e efêmero.
- **`reboot` na máquina** → a API responde, o worker consome, `systemctl list-timers` mostra os
  timers armados. **Sem intervenção manual.**
- Matar o processo da API → systemd sobe de novo.

### Persistência do Redis (decisão registrada nesta fase)

O Redis não guarda só cache — guarda a **fila do BullMQ**. Servidor caindo com jobs enfileirados
e Redis subindo vazio significa cobrança não enviada, boleto não emitido, webhook não processado.

Tratamento adotado, em duas camadas:

- **AOF ligado** (`appendfsync everysec`) — perde no máximo 1 segundo de fila. Padrão recomendado
  para BullMQ.
- **Job idempotente + reconciliação** — o trabalho pode ser reconstruído a partir do estado no
  Postgres. O plano já exige isso: as rotinas de estado são idempotentes por natureza e o webhook
  tem idempotência por `numeroIdentificadorBaixa`.

Com as duas, queda do Redis vira **lentidão, não perda**.

### Verificação pendente

`embedded-postgres` empacota binários por versão. Confirmar que já publica **PG 18** — se ainda
estiver em 17, os testes rodam em 17 e a produção em 18 (aceitável, mas é preciso saber antes de
escrever a primeira migration).

---

## F1 — Fundação SaaS: multi-tenancy e identidade

**É o ganho que justifica a troca total de backend.** Vem antes de qualquer entidade de negócio.

> **Desdobrada em duas fatias** (pré-refinamento de 2026-08-01,
> `docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md`, ramo A / direção A3).
> O corte **não** é isolamento × identidade — esse foi rebatido por atravessar a camada 5, cuja
> fonte legítima de `empresa_id` é a sessão, o que obrigaria a inventar uma fonte provisória e
> substituí-la depois (retrofit, contra o invariante 1). O corte é **depois da autenticação**:
>
> | Fatia | Itens desta seção | Framework |
> |---|---|---|
> | **`fundacao-multitenancy-identidade/v1`** | 1 a 8, mais os 3 perfis como rótulo (item 9 parcial) e a prova de que o Master vê vazio | SDD |
> | **`autorizacao-e-ciclo-de-acesso/v1`** | 9 (matriz completa), 10, 11, 12, mais as rotas do Master para o ciclo de vida da empresa | SDD |
>
> Ao fim da **segunda** é que vale o *"o SaaS existe — vazio, mas completo"* do fim desta seção.

### Multi-tenancy

1. `@sysloc/db`: `empresa`, `usuario`, `acesso_usuario_app`.
2. **RLS habilitada** em toda tabela de negócio — `USING` **e** `WITH CHECK`.
3. **FK composta `(id, empresa_id)`** como padrão de referência entre entidades tenantizadas.
4. `SET LOCAL app.empresa_id` por transação.
5. Contexto de tenant em **`AsyncLocalStorage`** + guard NestJS — a resolução **nunca lê do
   request** (camada 5 do plano mestre).
6. **Teste-guarda** que falha se alguma tabela de negócio nascer sem RLS habilitada.

**Tradução das 7 camadas do plano Frappe:**

| Camada original | Aqui |
|---|---|
| 1 — `permission_query_conditions` | **RLS policy** |
| 2 — `has_permission` | **a mesma RLS** — não há dois caminhos para o dado |
| 3 — `before_insert` carimba empresa | **RLS `WITH CHECK`** + default na coluna |
| 4 — `validate` proíbe Link cross-tenant | **FK composta** → cross-tenant vira estruturalmente impossível |
| 5 — resolução nunca lê do request | **AsyncLocalStorage** + guard |
| 6 — allowlist no nginx | **desnecessária** — a API só expõe o que declara |
| 7 — suíte de isolamento + teste-guarda | **mantida**, reforçada |

### Identidade e autorização

7. **better-auth**: senha ≥ 10 com verificação de força, lockout após 5 tentativas, sessão de 8h
   renovável, cookie `httpOnly+Secure+SameSite`, 2FA **obrigatório para o Master** e opcional
   para Admin, trilha de auditoria de login.
8. Perfis `Sysloc Master`, `Admin Empresa`, `Usuario Empresa`. O Master **não alcança dado de
   negócio por nenhum caminho** — e há teste que prova.
9. Autorização própria em `@sysloc/auth`: matriz **10 telas × 7 ações sensíveis**, com o **perfil
   como default e ajuste por usuário** — a decisão 8 fecha *"3 perfis **+ permissões ajustáveis por
   usuário**"*, e o efetivo de cada pessoa é o do perfil com os overrides dela aplicados. Isso
   implica que `versao_permissoes` (item 10) muda também quando um override muda, não só quando
   muda o perfil.
10. **Objeto de sessão "gordo"** com empresa, perfil, telas e ações liberadas, mais
    `versao_permissoes` — o frontend detecta revogação sem esperar 8h.
11. Onboarding com senha temporária e troca obrigatória; o Admin da empresa cria os demais pela
    mesma mecânica.
12. Suspensão de empresa **encerra sessões ativas na hora**, não no próximo login.

**Decisões consumidas**: 2, 8, 11, 13, 14, 15, 16, 38, 39 · direções D1+D3 do pré-refinamento.

### Aceitação

- **Suíte de isolamento parametrizada passa integralmente.**
- Empresa A não lê dado da B **mesmo com a camada de aplicação desligada** (RLS testada direto no
  banco).
- Teste-guarda falha ao adicionar tabela sem RLS.
- Requisição sem sessão → 401 · sessão expira em 8h · 6ª tentativa errada bloqueia.
- Master enxerga vazio nos dados de negócio.
- Revogação de permissão reflete na requisição seguinte.

> **Ao fim da F1 o SaaS existe — vazio, mas completo.** Dá para cadastrar empresa, criar usuário,
> logar, e o isolamento está provado. Tudo que vier depois nasce dentro disso.

---

## F2 — Domínio de locação

Entidades: `Conjunto`, `Imovel`, `Comodo`, `Locador`, `Locatario`, `Fiador`, `Contrato`,
`ContratoFiador`.

1. Schema com RLS e FK composta; **código legível por entidade** (`CTR-2026-0001`), único por
   empresa — é o que preserva as telas do frontend (estratégia C).
2. Tipos reais: dinheiro em `numeric(15,2)`, flags em `boolean`, datas em `date`/`timestamptz`,
   status em enum. Some a camada de coerção do frontend (`toInt`, `toDouble`, `isTruthy`).
3. Os **3 `Custom Field` de negócio** que a estrutura versionada do Frappe não alcançava entram
   como colunas de primeira classe.
4. Regras portadas: **metragem** (Server Script `Cálculo metragem imóvel`), **ativação de
   contrato** (`contrato_ativacao`, 340 LOC), **cancelamento em cascata**
   (`contrato_cancelamento`, 174 LOC).
5. `@sysloc/contracts`: primeiros contratos ts-rest + Zod, no modelo de domínio camelCase que o
   frontend já usa internamente.

**Aceitação**: a caracterização de metragem passa contra a implementação nova · criar `Contrato`
da empresa A apontando `Imovel` da B é recusado **pelo banco**, não por validação de aplicação.

---

## F3 — Cobrança, mora e documentos

1. `Cobranca` com o ciclo completo; `status` com **fonte única no servidor** (hoje é derivado no
   cliente por `normalizeStatus`).
2. **Mora**: multa e juros por empresa — `Atraso` deixa de ser Single global. Porta de
   `cobranca_atraso` (151 LOC); `_calcular_mora()` é pura e idempotente.
3. **Régua de cobrança**: porta de `cobranca_automation` (~700 LOC) — core, emailer, runner.
4. **PDF de contrato**: as 752 linhas, em `@react-pdf/renderer`, validadas contra a caracterização
   textual (§ Caracterização).
5. **Carnê**: montagem com `pdf-lib` **no servidor** — sai do browser, que hoje baixa N boletos.
6. `locatario_email_confirmacao` (222 LOC) portado.
7. **WhatsApp**: campos permanecem no modelo (o frontend os lê), canal **não implementado**;
   `whatsapp`/`ambos` recusados na validação Zod em vez de aceitos silenciosamente.

**Decisões consumidas**: 10, 34.

**Aceitação**: o texto extraído do PDF gerado bate com a referência · e-mail sai com
`sender_full_name` da empresa e `reply_to` dela.

---

## F4 — Integração bancária

A homologação com o Sicoob **já está feita** — certificado e credenciais seguem válidos; isto é
porte de cliente, não espera de banco.

1. `@sysloc/banking`: porta `AdaptadorCobrancaBancaria` (**ADR-0001 sobrevive intacta**), modelo
   canônico **generalizado para meio de recebimento** (`boleto` | `pix`) — prepara o Pix sem
   implementá-lo.
2. **mTLS com `undici`**: `Agent` com `pfx`/`passphrase`, pool por empresa. Certificado **por
   empresa**, cifrado em repouso (AES-256-GCM); **fallback global removido** — ausência de
   certificado próprio falha explicitamente.
3. **Contador `seu_numero` único do SaaS**, em linha própria, formato `AAAAMM` + 12 dígitos.
   Resolve o bug de `_obter_configuracao_ativa_for_update()`, que exige exatamente uma config
   ativa e quebraria no primeiro dia multi-empresa.
4. **Webhook**: URL única, `persistir payload cru → responder 200 → processar assíncrono`.
   Roteamento por `seu_numero`; **a empresa é derivada do documento encontrado, nunca do
   payload**. Confere `nossoNumero` e `numeroCliente`; divergência → registra e recusa.
   Idempotência por `numeroIdentificadorBaixa`. Datas UTC → America/Sao_Paulo. Trata a notificação
   de validação. Empresa suspensa → registra sem aplicar; aplica na reativação.
5. **API é a fonte da verdade** — o payload não decide nada. Reconciliação diária (o polling
   7×/dia cai para 1×).

**Decisões consumidas**: 9, 17, 18, 19, 20, 21, 23, 24, 33, 37 · **ADR-0001**.

**Pré-condição não resolvida**: confirmar contra boleto real que o `seuNumero` de 18 caracteres
**retorna íntegro** da API. Se truncar, a decisão 24 precisa ser revista **antes** desta fase.

**Aceitação**: duas empresas emitindo no mesmo mês sem colisão de `seu_numero` · empresa sem
certificado próprio falha com erro claro · payload forjado não altera nada · notificação duplicada
aplica uma vez.

---

## F5 — Automações

Gatilho no **SO**, por systemd timer (decisão 30 refinada).

1. `deploy/systemd/`: timers versionados, instalados por script idempotente, com
   **`Persistent=true`** — se o servidor estiver fora do ar na hora marcada, o timer dispara ao
   voltar, em vez de pular o dia em silêncio (o cron atual não faz isso). `OnFailure=` alimenta o
   alerta da decisão 31.
2. **Despachante por horário**: a rotina de 1 minuto faz **uma** consulta — quais empresas têm
   horário configurado para agora — e enfileira só essas. Corrige o desperdício atual, em que o
   runner varre todas as cobranças abertas a cada minuto e grava na config a cada execução
   (origem do log de 10 MB).
3. Rotinas diárias: um job por empresa ativa, **falha isolada**, lock por (empresa, rotina).
4. `ExecucaoRotina` gravado **só quando houve trabalho**, com expurgo automático.
5. **Alerta de rotina atrasada + tela de saúde** + alerta de falha de envio de e-mail por limite
   do provedor.
6. **Reativação**: rodar uma vez as três rotinas de estado, idempotentes por natureza. Régua de
   e-mail **não** é reenviada retroativamente.

**Decisões consumidas**: 25, 26, 27, 28, 29, 30, 31, 34, 37.

**Aceitação**: duas empresas com horários distintos rodam cada uma no seu · erro em A não impede
B · rotina parada gera alerta · instalador roda duas vezes sem duplicar entrada.

---

## F6 — Frontend religado

> **Natureza distinta das demais fases (revisão 2).** O pipeline agent-spec executa tasks **neste
> repositório**, e o fonte do React vive em `/home/fibron/dev/projetos/react/sysloc`, na máquina
> local do usuário (decisão 4). Não há como rodar `/agent-spec-*-run-tasks` sobre ele daqui.
>
> Esta fatia **não tem execução aqui**. Ela entrega: o **handoff de contrato**
> (`/agent-spec-backend-contract-handoff`), o **`@sysloc/contracts` publicado** e uma
> **especificação executável por arquivo** — mudanças descritas com trechos prontos e lista de
> verificação. A execução acontece na máquina local. Reavaliar depois do handoff se vale virar um
> projeto agent-spec próprio no repositório do React.

> **Recorte fechado na revisão 3.** A "especificação executável por arquivo" **sai do escopo deste
> repositório**. O que este servidor entrega é o **contrato mais o mapa de migração**: o
> `handoff-frontend.md` com modelo de domínio camelCase, envelope de erro da ADR-0007, autenticação
> por sessão e objeto de sessão gorda, somado ao **mapa endpoint-a-endpoint** dos 35 caminhos
> ERPNext (§ do `levantamento-frontend.md`) para as rotas novas — tudo derivável do que existe aqui.
>
> **Por que o roteiro por arquivo cai**: escrevê-lo exigiria ler os ~100 arquivos do React, e este
> servidor **não tem o fonte**. O que sairia seria um roteiro plausível redigido sobre um inventário,
> não sobre o código — e o agente local teria de conferir arquivo por arquivo de qualquer forma,
> agora com o risco extra de um roteiro desatualizado parecer autoridade. O agente da máquina local
> lê o fonte e planeja a implementação em cima do contrato.
>
> Os itens 1 a 6 abaixo permanecem como **descrição do trabalho a ser feito na máquina local** —
> são a entrada do agente de lá, não tarefa daqui. A aceitação (os 4 specs Playwright) é verificada
> lá pelo mesmo motivo.

Dimensionado pelo relatório do frontend: **~24 arquivos de religação mecânica + ~12 de refatoração
de vazamento + 10 fluxos redesenhados + 67 arquivos de teste com fixtures novas**.

1. **`@sysloc/contracts` publicado** no GitHub privado. O React importa tipos e cliente ts-rest —
   `apiEndpointContracts.test.ts` (que trava 35 paths ERPNext) fica desnecessário.
2. Camada de dados religada; **os ~36 mapeadores são deletados**.
3. Vazamento removido: `docstatus` sai dos tipos de domínio e da regra de status; `putDoctype` e
   os `bodyKey` snake_case saem de hooks e páginas.
4. Fluxos redesenhados: draft/submit → `POST /contratos`; joins no servidor; `regerarBoleto`
   (6 chamadas sem transação) → endpoint transacional; reset de e-mail do locatário (9 colunas
   escritas por um hook React) → `POST /locatarios/:id/email`.
5. Auth por sessão: guard de rota real, interceptor 401/403, sai o `localStorage`.
6. Ocultar URLs mantendo a base, restaurando a tela ao recarregar; menu filtrado por permissão;
   remoção do gate cosmético de senha da tela de Usuários.

**Decisões consumidas**: 4, 7 · itens 1–7 do §2.2 do plano mestre.

**Aceitação**: os 4 specs Playwright passam contra o backend novo · nenhuma credencial no bundle.

---

## F7 — Virada e desinstalação

> **Partida em duas na revisão 3.** Os itens abaixo não caem do mesmo lado da fronteira do
> `CLAUDE.md`, e tratá-los como uma fatia só esconde uma dependência que não se pode dissolver.
>
> **Entram no marco de entrega do backend** (construção, sem depender de frontend algum): o **item 1
> inteiro** — backup/restore, `.pgpass`, timer das 02:30 e a prova de restauração num banco vazio —
> e a **redação** do `deploy/scripts/virada.md` com o gate de desinstalação. O item 2 não é trabalho:
> não há migração de dados.
>
> **Ficam para uma sessão operacional futura neste servidor**: a **execução** da virada (item 3), a
> **desinstalação** (item 4) e a **retenção da trilha de tentativas** (item 5). O motivo é o primeiro critério de aceitação desta própria fase —
> *"app funcionando integralmente contra o backend novo"* —, que só é verificável com o frontend
> pronto, e o frontend é implementado fora daqui. As duas exigem este servidor, porque é onde o
> `/opt/frappe` e o CloudPanel existem.
>
> Essa sessão é **operação, não construção**: horas, não dias, nos moldes da janela de reinício da
> F0 — o agente conduz pelo runbook e o operador executa. Defeito encontrado nela se corrige como
> correção; **não reabre a construção do backend**.

1. **Backup/restore novos**: `pg_dump -Fc` + tar dos segredos → `/opt/backups/sysloc/daily/`,
   autenticação por `.pgpass` 0600 (**nenhuma senha em script versionado** — corrige o achado 7 do
   plano e honra a ADR-0005), verificação com `pg_restore --list`, `restore` com `--dry-run` e
   confirmação explícita, systemd timer mantendo a janela das 02:30.
2. **Dados**: recadastro pelo app — o usuário confirmou que os dados atuais não estão em uso. Não
   há migração de dados a fazer.
3. **Virada**: parar as rotinas do Frappe → apontar o CloudPanel para a API nova → checklist de
   validação versionado em `deploy/scripts/virada.md`.
4. **Desinstalação**: contêineres, volumes, imagens, `/opt/frappe`, os `run-*.sh`, os scripts em
   `/usr/local/bin` e as entradas de cron do root — liberada pelo gate abaixo, **sem espera por
   tempo**.
5. **Retenção da trilha de tentativas de entrada**: janela de retenção e purga periódica de
   `identidade.tentativa_login`, por timer systemd, nos moldes do item 1. Sem ela, a tabela que a
   operação lê para decidir se houve ataque cresce sem limite.
   **Origem**: é a metade não acionável do débito `P-T6-2` da F1 — a outra metade (ligar o limitador
   de taxa) foi fechada na fatia `autorizacao-e-ciclo-de-acesso`, que endereçou esta aqui.
   **A classificação como operação é conservadora**, e vale dizer por quê: escrever a política não
   depende da virada nem do frontend, então ela caberia no item 1, que já instala timer sobre o
   banco. Não foi movida para lá porque isso alteraria o marco de entrega do backend, cujos sete
   itens estão fixados no `CLAUDE.md` — antecipá-la é decisão do usuário, não do plano.

### Sem janela de rollback por tempo (revisão 2)

A versão anterior mandava manter a stack antiga *"desligada e intacta por semanas como rollback"*.
**Isso cai.** Duas razões:

- O Frappe é **single-tenant**. Voltar para ele é abandonar exatamente a capacidade que justificou
  a troca total de backend — ele é inútil como destino de rollback de um produto multi-empresa.
- **Não há migração de dados** (item 2 acima). No instante seguinte à virada as duas bases
  **divergem**: reverter devolveria dados velhos.

O valor residual do Frappe após a virada é **zero**. Como oráculo das regras legadas ele já foi
substituído pelos golden files da fatia de caracterização; como rollback ele nunca serviu.

**A rede de segurança deixa de ser uma stack de pé e passa a ser um dump preservado** — que não
ocupa CPU, não ocupa RAM, não diverge, e continua consultável indefinidamente (relevante com o
disco em 79%).

**Gate de desinstalação — todos obrigatórios:**

- [ ] Golden files capturados e commitados (metragem, texto do PDF de contrato, 3 rotinas de estado)
- [ ] Dump final da base antiga **e** dos segredos preservado em `/opt/backups/sysloc/`
- [ ] Checklist de virada executado e conferido
- [ ] Backup do banco **novo** restaurado com sucesso num banco vazio (`pg_restore --list` + restore de teste)
- [ ] `/etc/sysloc/producao` criado na instalação que passou a atender a operação — arma o guarda da ADR-0006 em `deploy/scripts/instalacao/verificar-provisionamento.sh`; enquanto o arquivo não existir, a bateria de verificação segue liberada a reiniciar a fila e a reexecutar o provisionamento contra produção

**Consequência aceita**: a partir da virada, defeito no backend novo se corrige para a frente — não
há para onde voltar. O risco desloca-se para a **qualidade dos CA antes da virada**: em particular,
os golden files das rotinas de estado e a suíte da F5 precisam cobrir o ciclo mensal **antes** da
virada, já que não haverá observação em produção com rede.

**Pré-requisito**: ativos de planejamento já migrados para `/opt/sysloc-backend` — **feito**.

**Decisões consumidas**: 32, 40.

**Aceitação**: app funcionando integralmente contra o backend novo · backup do banco novo restaurado
com sucesso num banco vazio · os 5 itens do gate de desinstalação verificados antes de qualquer
exclusão.

---

## Caracterização — primeira fatia a executar (revisão 2)

**Roda contra o Frappe ainda vivo, somente leitura.** Vira a feature
`caracterizacao-regras-legadas/v1` (TaskCard). O escopo abaixo veio da T4 do plano Frappe
`saas-multi-empresa`, **excluído do repositório em 2026-08-01**; a especificação está integralmente
absorvida em `docs/specs/features/caracterizacao-regras-legadas/v1/tasks/task-01-capturar-caracterizacao-regras-legadas.md`.

**Escopo:**

- Regra de agregação (metragem): valor produzido para imóvel sem cômodo, com um, com vários, e com
  metragem nula em algum.
- Regra que gera documento (contrato, 752 linhas): **texto extraído** do PDF, nunca os bytes — o
  artefato carrega metadados de geração que variam a cada execução.

**Escopo — ampliação da revisão 2:**

- As **3 rotinas de estado idempotentes**: `marcar_cobrancas_vencidas`, `encerrar_contratos_vencidos`
  e `_calcular_mora()`. Motivo: o achado 18 registra que as rotinas de cron do domínio **não têm
  teste algum**; sem golden, a F5 porta comportamento que ninguém verificou, contra o requisito
  declarado de que **todas** as automações devem funcionar corretamente. O custo é baixo — o próprio
  código documenta `_calcular_mora()` como *"PURA (sem acesso a banco): recalculável e idempotente"*.
- **Adiado**: caracterizar a régua de cobrança (`cobranca_automation`, ~700 LOC). Tem efeito
  colateral de envio de e-mail, exigindo isolar o envio ao capturar contra produção. Reavaliar na
  entrada da F3.

**Por que existe**: é a especificação executável do que portar e a prova de equivalência do gerador
de contrato. Sem ela, a F3 porta 752 linhas sem ter contra o que comparar.

**Por que agora, e não "a qualquer momento antes da F3"**: é o **único ativo do projeto com prazo de
validade** — depende de um sistema que será desligado. "Fora do caminho crítico" é verdade em
dependência e falso em risco. Com o gate de desinstalação da F7 exigindo os golden files
commitados, capturá-los cedo também é o que destrava o fim do programa.

**Os três oráculos e onde cada um bloqueia:**

| Oráculo | O que é | Onde é bloqueante |
|---|---|---|
| Golden files contra o Frappe | metragem, texto do PDF, 3 rotinas de estado | pré-condição de **F3** e **F5** |
| Invariantes estruturais | teste-guarda de RLS, suíte de isolamento, Master vê vazio, `reboot` real | CA de **F0** e **F1** |
| Paridade pelo frontend | 4 specs Playwright + 391 casos | CA de **F6** (executável só na máquina local) |

---

## Depois: `painel-master`

Feature de produto própria (direção E2 do pré-refinamento), especificada **após** a F7 — persona
distinta (o operador do SaaS), domínio distinto (`syslocadmin.systera.com.br`), ciclo de vida
distinto. Consome o contrato de endpoints do Master.

---

## Pendências fora do caminho crítico

1. **Rotacionar a credencial exposta** — `REACT_APP_ERPNEXT_API_KEY`/`_SECRET` seguem em texto
   claro no bundle público enquanto o Frappe existir. Independe de tudo.
2. **Sicoob**: confirmar allowlist de IP no lado do banco e onde vivem hoje certificado e
   credenciais.
3. **`seuNumero` de 18 caracteres** — validar contra boleto real antes da F4.
4. **`codigoMotivoCancelamento: 2`** — esclarecer com o Sicoob (decisão 22, não bloqueia).
5. **Remoto git do repositório novo** — criar repositório próprio no GitHub; o `origin` atual
   (`fabianolopesviana/frappe-locacao`) é do projeto que será desinstalado.
