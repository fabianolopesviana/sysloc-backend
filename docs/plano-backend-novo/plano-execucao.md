# Backend Sysloc — plano de execução em fases

> Derivado de `decisao-e-stack.md` (stack aprovada) e do fatiamento F0–F8 de
> `.claude/plans/plano-saas.md`. As **40 decisões** de `plano-saas-decisoes.md` são vinculantes;
> cada fase cita as que consome.
>
> **Repositório**: `/opt/sysloc-backend`
>
> **Revisão de 2026-07-30 (a pedido do usuário)**: a ordem original punha a caracterização contra
> o Frappe como primeiro passo e empacotava "instalar a stack" junto de "criar a fundação
> multi-tenant" numa fase só. Reordenado: a **F0 agora é exclusivamente instalar e provar a
> stack**, sem uma linha de regra de negócio; a fundação SaaS virou a **F1**; e a caracterização
> saiu do caminho crítico e virou tarefa paralela.

---

## Princípio de ordenação

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
9. Autorização própria em `@sysloc/auth`: matriz **10 telas × 7 ações sensíveis**.
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

1. **Backup/restore novos**: `pg_dump -Fc` + tar dos segredos → `/opt/backups/sysloc/daily/`,
   autenticação por `.pgpass` 0600 (**nenhuma senha em script versionado** — corrige o achado 7 do
   plano e honra a ADR-0005), verificação com `pg_restore --list`, `restore` com `--dry-run` e
   confirmação explícita, systemd timer mantendo a janela das 02:30.
2. **Dados**: recadastro pelo app — o usuário confirmou que os dados atuais não estão em uso. Não
   há migração de dados a fazer.
3. **Virada**: parar as rotinas do Frappe → apontar o CloudPanel para a API nova → checklist de
   validação → manter a stack antiga **desligada e intacta por semanas** como rollback.
4. **Só então, desinstalação**: contêineres, volumes, imagens, `/opt/frappe`, os `run-*.sh`, os
   scripts em `/usr/local/bin` e as entradas de cron do root.

**Pré-requisito**: ativos de planejamento já migrados para `/opt/sysloc-backend` — **feito**.

**Decisões consumidas**: 32, 40.

**Aceitação**: app funcionando integralmente contra o backend novo · backup restaurado com sucesso
num banco vazio · a stack antiga volta a ser ativável até o momento da exclusão.

---

## Caracterização — tarefa paralela, fora do caminho crítico

**Roda contra o Frappe ainda vivo. Obrigatória antes da F3, executável a qualquer momento antes
disso.** Corresponde à **T4** da `saas-multi-empresa/v1`, já especificada em
`docs/specs/features/saas-multi-empresa/v1/tasks/T4.md`.

- Regra de agregação (metragem): valor produzido para imóvel sem cômodo, com um, com vários, e com
  metragem nula em algum.
- Regra que gera documento (contrato, 752 linhas): **texto extraído** do PDF, nunca os bytes — o
  artefato carrega metadados de geração que variam a cada execução.

**Por que existe**: é a especificação executável do que portar e a prova de equivalência do gerador
de contrato. Sem ela, a F3 porta 752 linhas sem ter contra o que comparar.

**Por que não é a F0**: o Frappe só é desligado na F7. A janela é larga. O que a torna obrigatória
é a dependência da F3, não urgência de calendário.

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
