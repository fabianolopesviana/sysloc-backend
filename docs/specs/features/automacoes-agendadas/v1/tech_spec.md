# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: Automações agendadas — F5, fatia (ii)
- **Variante**: backend
- **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js · PostgreSQL 18 · Zod 4 · BullMQ + Redis 7 · Vitest + embedded-postgres · systemd timers
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-22
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/automacoes-agendadas/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/automacoes-agendadas/v1/tech-alignment.md` (8 decisões, D1–D8)
- **Discovery**: `docs/specs/features/automacoes-agendadas/v1/pre-refinement.md`
- **Design Relacionado**: — (variante backend; a Fronteira do `CLAUDE.md` exclui frontend deste repositório)

> ⚠️ **Decisões auto-resolvidas pela regra A1** de `.claude/rules/autonomia-do-run.md` (escopo
> universal): onde esta skill mandaria `AskUserQuestion`, a alternativa recomendada foi **formulada,
> adotada e registrada** em vez de pausar. Os pontos assim decididos trazem a marca **`(A1)`** e são
> reversíveis. Eles são: a variante (§1), os cinco pontos técnicos em aberto do tech-alignment
> (§21.1), o prazo de retenção dos boletos guardados (§7.5), a leitura de CA-06 diante da
> irrepresentabilidade (§6.3) e a ausência de verificador em shell (§16.1).

---

## 2. Resumo Técnico da Solução

O produto tem seis filas, um processo de trabalho supervisionado e **nenhum produtor periódico**.
Esta fatia entrega a camada de **provocação** que falta e o único trabalho de domínio que nunca
existiu — o encerramento de contrato vencido.

O gatilho é **systemd timer** (decisão 30 refinada), um por rotina, com `Persistent=true` só nas
diárias. Cada timer executa um **processo efêmero de despacho** (`apps/worker/dist/despachante.js
<rotina>`, `Type=oneshot`) que **enumera as empresas ativas** — a primeira leitura legítima sem
contexto da ADR-0024, no schema sem noção de tenant — e **enfileira sem perguntar quem tem
trabalho** (tech-alignment D2: a pergunta seria uma terceira travessia nominal sobre dado
tenantizado). Todo trabalho de domínio continua no processo de trabalho, onde as portas já são
compostas (ADR-0025) e o contexto de tenant nasce da carga, uma vez, na borda que a recebe
(ADR-0024).

O encerramento é o **primeiro caso do repositório de transição de estado de entidade de negócio sem
ator** — conforme pela **emenda de 2026-08-22 à ADR-0021** —, e corre numa unidade de trabalho por
passagem, com `FOR UPDATE … SKIP LOCKED` e `UPDATE` sob predicado, o que lhe dá idempotência e
isolamento de concorrência **sem mecanismo de trava novo**. A liberação do imóvel usa a **porta
estreita** `definirSituacaoDeLocacaoDoImovel`, na mesma unidade (RN-03).

A observabilidade é o par que a decisão 31 pede: **falha** vai ao operador por `OnFailure=` e
journal; **ausência** é derivada de `negocio.execucao_de_rotina` — tabela tenantizada, gravada só
quando houve efeito (RN-15), expurgada por idade — e alimenta os dois consumidores da mesma
derivação: a rotina de vigilância e a **última rota que este repositório publica** antes do
congelamento, `GET /v1/automacao-de-cobranca/rotinas`.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
┌─ systemd (fuso declarado em OnCalendar=) ──────────────────────────────────┐
│  6 timers  ──►  6 .service Type=oneshot  ──►  node dist/despachante.js <r> │
│      │                    │                                                │
│      │                    └── OnFailure= ──► sysloc-alerta-de-rotina@.service│
└──────┼─────────────────────────────────────────────────────────────────────┘
       │  (o despachante abre banco + fila, enfileira e TERMINA)
       ▼
┌─ enumeração de tenants (identidade.empresa, sem contexto — ADR-0024 #1) ───┐
│   empresas ATIVAS (suspensa_em IS NULL)                                    │
└──────┬─────────────────────────────────────────────────────────────────────┘
       │
       ├── FILA_DA_REGUA                  { empresaId }             (existente)
       ├── FILA_DA_ROTINA_AGENDADA        { empresaId, rotina }     (NOVA)
       │     rotina ∈ ENCERRAMENTO_DE_CONTRATOS | CONFERENCIA_DE_LIQUIDACAO
       │              | VIGILANCIA_DAS_ROTINAS | EXPURGO_DO_HISTORICO
       │     ⚠️ EXPURGO_DO_HISTORICO é despachado pelo timer `manutencao`,
       │        que também enfileira a manutenção sem tenant — por isso ele
       │        NÃO tem entrada própria em CADENCIA_DA_ROTINA (§4.2)
       ├── FILA_DA_MANUTENCAO_DO_ACERVO   { }                       (NOVA)
       └── FILA_DA_NOTIFICACAO_BANCARIA   { notificacaoId }         (existente,
                                                     retomada das paradas)
       ▼
┌─ apps/worker (processo supervisionado, portas já compostas) ───────────────┐
│  processarReguaDeCobranca            (existente, inalterado)               │
│  processarRotinaAgendada  ──┬── ENCERRAMENTO_DE_CONTRATOS                   │
│    (contexto uma vez,       ├── CONFERENCIA_DE_LIQUIDACAO                   │
│     ADR-0024)               ├── VIGILANCIA_DAS_ROTINAS                      │
│                             └── EXPURGO_DO_HISTORICO                        │
│  processarManutencaoDoAcervo  ── notícias cruas vencidas + boletos vencidos │
└──────┬─────────────────────────────────────────────────────────────────────┘
       ▼
┌─ packages/db ──────────────────────────────────────────────────────────────┐
│  negocio.execucao_de_rotina  (empresa_id, RLS FORCE, FK composta)          │
│  encerrarContratosVencidos() · lerEstadoDasRotinas() · expurgar*()          │
└─────────────────────────────────────────────────────────────────────────────┘
       ▲
       │  (mesma derivação, segundo consumidor)
┌─ apps/api ─────────────────────────────────────────────────────────────────┐
│  GET /v1/automacao-de-cobranca/rotinas  ·  @ExigeChave(TELA:automacao_...) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `deploy/systemd/sysloc-rotina-*.timer` (6) | O relógio. `OnCalendar=` com **fuso declarado**; `Persistent=true` só nas diárias | Infraestrutura |
| `deploy/systemd/sysloc-rotina-*.service` (6) | `Type=oneshot` que executa o despachante com o nome da rotina; `OnFailure=` próprio | Infraestrutura |
| `deploy/systemd/sysloc-alerta-de-rotina@.service` | Unidade-modelo de alerta: grava no journal, com prioridade e **o nome da rotina que falhou** (CA-03, metade 1) | Infraestrutura |
| `apps/worker/src/despachante.ts` | Ponto de entrada efêmero: valida ambiente, abre banco e fila **por `conectarFila` do mesmo pacote**, **enumera empresas ativas**, enfileira, devolve recursos, termina | Composição raiz |
| `apps/worker/src/tarefas/rotina-agendada.ts` | Consumidor único das quatro rotinas por empresa: abre o contexto **uma vez**, despacha e grava o registro só quando houve efeito | Aplicação (worker) |
| `apps/worker/src/tarefas/manutencao-do-acervo.ts` | Consumidor sem tenant: expurgo do recebido cru vencido e dos boletos guardados vencidos | Aplicação (worker) |
| `packages/db/src/encerramento-de-contratos.ts` | Seleção dos candidatos e a transição pareada contrato→imóvel, numa unidade | Dados / domínio |
| `packages/db/src/execucao-de-rotina.ts` | Gravação do registro, leitura do estado com o **atraso derivado no banco**, e expurgo por idade | Dados / domínio |
| `packages/contracts/src/rotina-agendada.ts` | Roster publicado das rotinas, cadência, **limiar de atraso**, esquema de saída e vocabulário de impedimento | Contrato |
| `packages/shared/src/fila.ts` (M) | Duas filas novas e as duas cargas | Contrato de fila |
| `apps/api/src/automacao/*` (M) | A leitura `GET …/rotinas` — última rota antes do congelamento | Borda HTTP |

### 3.3 Camadas e Fronteiras

Hexagonal por dentro, camadas por fora — inalterado. As fronteiras que esta fatia respeita e que
governam a revisão:

- **ADR-0025** — o domínio declara a porta; a composição raiz escolhe o adaptador. O despachante
  **não** compõe porta de e-mail, de provedor bancário nem guarda de boletos: ele só precisa de
  banco e fila. As portas continuam vivendo em `apps/worker/src/main.ts`.
- **ADR-0024** — o contexto de tenant nasce da **carga**, uma vez, na borda que a recebe. Nenhuma
  rotina reabre contexto no meio do trabalho, e nenhuma rota aceita `empresaId` de fora.
- **ADR-0026** — a data e a hora que decidem comportamento vêm do **banco**. O timer apenas
  *provoca*; quem decide o que é "vencido" é `negocio.data_corrente_da_operacao()`.
- **ADR-0029** — o efeito externo sai por fila. O despachante **só enfileira**; ele não fala com
  SMTP nem com o provedor bancário.
- **Invariante 1** — `negocio.execucao_de_rotina` nasce com `empresa_id`, `FORCE ROW LEVEL
  SECURITY`, política nominal e chave estrangeira composta. **Não é caso da ADR-0031**: ela tem
  dono-empresa.
- **`.claude/rules/contrato-publicado.md`** — entrada fechada, saída aberta. A rota nova é `GET` sem
  corpo; a saída é `z.object`, o que torna reversível a decisão D3 (ampliar em vez de acrescentar
  rota).

### 3.4 Visão em Árvore

```
apps/
├── api/
│   ├── src/automacao/
│   │   ├── automacao.controller.ts                              [M]
│   │   └── automacao.service.ts                                 [M]
│   └── test/
│       ├── cobertura-de-autorizacao.e2e.spec.ts                 [M]
│       └── rotinas-agendadas.e2e.spec.ts                        [N]
└── worker/
    ├── src/
    │   ├── despachante.ts                                       [N]
    │   ├── fila.ts                                              [M]
    │   ├── main.ts                                              [M]
    │   └── tarefas/
    │       ├── manutencao-do-acervo.ts                          [N]
    │       ├── rotina-agendada.ts                               [N]
    │       ├── regua.ts                                         [M]
    │       └── conferencia-bancaria.ts                          [R]
    └── test/
        ├── despachante.spec.ts                                  [N]
        ├── manutencao-do-acervo.spec.ts                         [N]
        └── rotina-agendada.spec.ts                              [N]

packages/
├── contracts/
│   ├── src/
│   │   ├── index.ts                                             [M]
│   │   ├── rotina-agendada.ts                                   [N]
│   │   ├── automacao-de-cobranca.ts                             [R]
│   │   └── comum.ts                                             [R]
│   └── test/esquemas.spec.ts                                    [M]
├── db/
│   ├── migracoes/
│   │   ├── 0026_dominio_execucao_de_rotina.sql                  [N] (gerada)
│   │   └── 0027_seguranca_execucao_de_rotina.sql                [N] (autoral)
│   ├── src/
│   │   ├── encerramento-de-contratos.ts                         [N]
│   │   ├── execucao-de-rotina.ts                                [N]
│   │   ├── empresa.ts                                           [M]
│   │   ├── notificacao-bancaria.ts                              [M]
│   │   ├── index.ts                                             [M]
│   │   ├── esquema/negocio.ts                                   [M]
│   │   ├── contrato.ts                                          [R]
│   │   ├── imovel.ts                                            [R]
│   │   └── envio-de-cobranca.ts                                 [R]
│   └── test/
│       ├── encerramento-de-contratos.spec.ts                    [N]
│       ├── execucao-de-rotina.spec.ts                           [N]
│       ├── isolamento.spec.ts                                   [M]
│       ├── catalogo.spec.ts                                     [M]
│       └── unidade-de-trabalho.spec.ts                          [M]
├── cobranca-bancaria/
│   ├── src/guarda-de-boletos.ts                                 [M]
│   └── test/guarda-de-boletos.spec.ts                           [M]
└── shared/
    ├── src/fila.ts                                              [M]
    └── test/
        ├── fila.spec.ts                                         [M]
        └── unidades-agendadas.spec.ts                           [N]

deploy/
├── systemd/
│   ├── sysloc-rotina-aviso-de-cobranca.{service,timer}          [N]
│   ├── sysloc-rotina-encerramento-de-contratos.{service,timer}  [N]
│   ├── sysloc-rotina-conferencia-de-liquidacao.{service,timer}  [N]
│   ├── sysloc-rotina-vigilancia.{service,timer}                 [N]
│   ├── sysloc-rotina-manutencao.{service,timer}                 [N]
│   ├── sysloc-rotina-retomada-de-noticias.{service,timer}       [N]
│   ├── sysloc-alerta-de-rotina@.service                         [N]
│   └── sysloc-worker.service                                    [R]
└── scripts/instalacao/instalar-unidades.sh                      [M]

docs/
├── adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md  [R]
└── specs/features/caracterizacao-regras-legadas/v1/golden/
    └── encerrar-contratos-vencidos.json                         [R]

CLAUDE.md                                                        [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/contracts/src/rotina-agendada.ts` | `CADENCIA_DA_ROTINA` com as **6** unidades (tipo, hora e `publicada`), `ROTINAS_PUBLICADAS` **derivado** dela por filtro, limiar de atraso derivado da cadência, vocabulário fechado de impedimento e o esquema de saída da leitura | Contrato |
| `packages/db/src/execucao-de-rotina.ts` | `registrarExecucaoDeRotina`, `lerEstadoDasRotinas` (última execução + resumo + atraso derivado **no banco**), `lerHistoricoRecenteDeRotinas`, `expurgarExecucoesVencidas` | Dados |
| `packages/db/src/encerramento-de-contratos.ts` | `encerrarContratosVencidos(tx)` — seleção com `FOR UPDATE … SKIP LOCKED`, transição sob predicado e liberação do imóvel pela porta estreita, devolvendo as contagens do oráculo | Dados / domínio |
| `packages/db/migracoes/0026_dominio_execucao_de_rotina.sql` | **Gerada** por `drizzle-kit generate`: tabela, enum, unicidades, FK composta, `CHECK` e índice de histórico | Migração |
| `packages/db/migracoes/0027_seguranca_execucao_de_rotina.sql` | **Autoral**: `FORCE ROW LEVEL SECURITY` e política nominal de isolamento. Sem `GRANT` (o `ALTER DEFAULT PRIVILEGES` da `0001` já alcança) e **sem papel de leitura sem contexto** | Migração |
| `apps/worker/src/despachante.ts` | Ponto de entrada efêmero. Lê `<rotina>` de `process.argv`, valida **três** variáveis (`LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`), enumera empresas ativas, enfileira, devolve recursos e termina com código de saída explícito | Composição raiz |
| `apps/worker/src/tarefas/rotina-agendada.ts` | Consumidor único das quatro rotinas por empresa | Aplicação |
| `apps/worker/src/tarefas/manutencao-do-acervo.ts` | Consumidor sem tenant do expurgo do recebido cru e dos boletos guardados | Aplicação |
| `deploy/systemd/sysloc-rotina-*.{service,timer}` (12 arquivos) | O relógio, um par por rotina | Infraestrutura |
| `deploy/systemd/sysloc-alerta-de-rotina@.service` | Unidade-modelo de alerta acionada por `OnFailure=`, que nomeia a rotina no journal | Infraestrutura |
| `packages/shared/test/unidades-agendadas.spec.ts` | Asserção **estática** sobre `deploy/systemd/*`: fuso declarado, `Persistent=` conforme a cadência, `OnFailure=` presente em todo `.service`, `WantedBy=timers.target`, e a **igualdade** entre o `OnCalendar=` de cada unidade e a cadência declarada em `@sysloc/contracts` | Verificação |
| `packages/db/test/execucao-de-rotina.spec.ts` | Isolamento, retenção, RN-15, derivação do atraso | Verificação |
| `packages/db/test/encerramento-de-contratos.spec.ts` | Equivalência com o golden, idempotência, concorrência, irrepresentabilidade de RN-02 | Verificação |
| `apps/worker/test/{despachante,rotina-agendada,manutencao-do-acervo}.spec.ts` | Enumeração, falha isolada, contexto, expurgos | Verificação |
| `apps/api/test/rotinas-agendadas.e2e.spec.ts` | A leitura, o isolamento entre empresas e os impedimentos | Verificação |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/shared/src/fila.ts` | `FILA_DA_ROTINA_AGENDADA`, `FILA_DA_MANUTENCAO_DO_ACERVO`, `CargaDaRotinaAgendada`, `CargaDaManutencaoDoAcervo` | Nome único dos dois lados; **`empresaId` obrigatório** na primeira (classe 1 da ADR-0024) e **ausente** na segunda (não há empresa: os alvos são `plataforma` e sistema de arquivos) |
| `packages/db/src/esquema/negocio.ts` | Enum `rotina_agendada` e tabela `execucaoDeRotina` | Registro tenantizado (invariante 1) |
| `packages/db/src/empresa.ts` | `listarEmpresasAtivas(tx)` — enumeração de tenants **sem contexto**, no schema `identidade` | A leitura legítima #1 da ADR-0024; devolve **só** o identificador |
| `packages/db/src/notificacao-bancaria.ts` | `listarNaoTratadas(tx, folgaEmMinutos)` | A retomada precisa das paradas em `RECEBIDO`, e `listarRetidas` só devolve `RETIDO` (fecha o `D13 · F4/T6` da fatia `webhook-e-carne`) |
| `packages/db/src/index.ts` | Exporta os símbolos novos | Barril do pacote |
| `packages/contracts/src/index.ts` | Exporta o roster e o esquema | Barril do pacote |
| `packages/cobranca-bancaria/src/guarda-de-boletos.ts` | `expurgarBoletosVencidos(diasDeRetencao)` na interface `GuardaDeBoletos`; **remove o marcador `DÉBITO COM GATILHO — D26 · F4/T9`** | O gatilho literal daquele débito é *"a F5, que traz o agendamento"* — disparou |
| `apps/worker/src/fila.ts` | `TarefaDaRotinaAgendada`, `TarefaDaManutencaoDoAcervo` e os produtores correspondentes na interface `Fila` | O despachante enfileira pelas mesmas opções publicadas |
| `apps/worker/src/main.ts` | Registra os dois consumidores novos em `fila.processar` | Composição raiz do processo de trabalho |
| `apps/worker/src/tarefas/regua.ts` | Grava `registrarExecucaoDeRotina` para `AVISO_DE_COBRANCA` sob o predicado da RD-15 (`enviadas + falhas + semDestinatario > 0`), em unidade própria, dentro do contexto já aberto | ⚠️ **Correção de 2026-08-23 (T8)**: `AVISO_DE_COBRANCA` é `RotinaPublicada` com limiar de 15 min e **nada gravava** a execução dela — a vigilância da T6 a marcaria atrasada **permanentemente** e a leitura do Admin da T10 a publicaria assim. As linhas que a declaravam `[R]`/*inalterado* na §3.4 e na §5.3 eram o texto do spec que estava errado: a RD-15 e aquela marcação não podiam ser as duas verdadeiras |
| `apps/api/src/automacao/automacao.service.ts` | `lerEstadoDasRotinas(tx)` | Segundo consumidor da mesma derivação |
| `apps/api/src/automacao/automacao.controller.ts` | `@Get('rotinas')` com a documentação do contrato | A leitura da decisão 31 |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Sobe `ROTAS_PUBLICADAS_EM_PRODUCAO` e `MANIPULADORES_EXAMINADOS_EM_PRODUCAO`, com `SUT_IS_CORRECT_BECAUSE` | `.claude/rules/ancoras-de-superficie.md`: a âncora sobe **no mesmo diff** da publicação |
| `deploy/scripts/instalacao/instalar-unidades.sh` | O array `UNIDADES` passa a incluir os 12 pares e a unidade-modelo; `systemctl enable --now` para `.timer` em vez de `.service` | ADR-0005: instalação idempotente (CA-04) |
| `packages/db/test/{isolamento,catalogo,unidade-de-trabalho}.spec.ts` | Acolhem a tabela nova nas guardas de cobertura já existentes | As guardas cobram **toda** tabela do schema `negocio` |
| `packages/shared/test/fila.spec.ts` | Acolhe os nomes e cargas novos | A suíte afirma o roster de símbolos publicados |
| `packages/contracts/test/esquemas.spec.ts` | Acolhe o esquema novo | Idem |
| `CLAUDE.md` | Índice de débitos: remove `D26 · F4/T9` e `D13 · F4/T6` (`webhook-e-carne`); acrescenta o que esta fatia registrar | `.claude/rules/nao-regressao.md` §3-B, ciclo de vida do índice |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `docs/adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md` | ⚠️ **Abrir a `Decision` E as DUAS emendas.** A de 2026-08-22 é o fundamento do encerramento sem ator, e nomeia esta fatia |
| `docs/adr/0024-origem-do-contexto-de-tenant-sem-requisicao.md` | ⚠️ **Duas emendas.** A de 2026-08-13 declara as duas leituras legítimas; a de 2026-08-18, quando a carga leva empresa e quando não leva |
| `docs/adr/{0022,0025,0026,0029,0031,0005,0023}-*.md` | Derivação × gravação, direção da dependência, relógio no banco, efeito por fila, schema sem dono-empresa, instalação idempotente, onde vive a derivação |
| `docs/specs/features/caracterizacao-regras-legadas/v1/golden/encerrar-contratos-vencidos.json` | **O oráculo** das RN-01 a RN-05, com as contagens e o motivo de descarte |
| `packages/db/src/contrato.ts` | `ativarContrato`/`cancelarContrato`, `gravarSobIndiceDeVigencia` e o índice `contrato_imovel_vigente_uidx` — o molde da transição pareada |
| `packages/db/src/imovel.ts` | `definirSituacaoDeLocacaoDoImovel` — a **porta estreita**, e o docblock que enumera os chamadores |
| `packages/db/src/envio-de-cobranca.ts` | `lerHoraCorrenteDaOperacao`, `FUSO_DA_OPERACAO` e o molde do índice de histórico |
| `packages/db/src/conferencia-bancaria.ts` | `abrirConferencia`, `conferencia_bancaria_em_andamento_uidx` — a trava que já satisfaz RN-13 para a conferência |
| `apps/worker/src/tarefas/notificacao-bancaria.ts` | Onde `expurgarNotificacoesVencidas` é chamado hoje **de carona** (a razão da decisão D8) |
| `apps/api/src/master/empresa.service.ts` | `reativar` — o reenfileiramento das retidas na reativação (metade bancária da decisão 37, já entregue) |
| `packages/auth/src/catalogo-de-permissoes.ts` | O catálogo **fechado**: 10 telas, 7 ações. Nenhuma chave nova nasce aqui |
| `deploy/systemd/sysloc-worker.service` | O molde de unidade endurecida (as 12 diretivas de restrição, `EnvironmentFile`, caminho absoluto do runtime) |
| `.claude/rules/{ancoras-de-superficie,contrato-publicado,nao-regressao,testing-stack}.md` | Regras vinculantes desta fatia |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Ler o estado das rotinas da empresa | `GET` | `/v1/automacao-de-cobranca/rotinas` | — (sem corpo, sem parâmetro de consulta) | `EstadoDasRotinas` | `200`, `401`, `403` | Sessão + `@ExigeChave('TELA:automacao_de_cobranca')` |

**É a única rota desta fatia, e é a última que este repositório publica.** As três razões de ela
morar sob `automacao-de-cobranca`, e não em caminho próprio:

1. O **catálogo de permissões é fechado** (ADR-0011, decisão 38): há 10 áreas de tela e nenhuma se
   chama "automações". Publicar caminho próprio exigiria chave nova — alteração do catálogo, que
   esta fatia não tem mandato para fazer.
2. `apps/api/src/saude/` já existe, é `@RotaPublica()` e é liveness/readiness de **infraestrutura**.
   A saúde das rotinas é dado de negócio, por empresa, com sessão: **mesma palavra, naturezas
   opostas**. A rota nova não entra sob `/saude`.
3. `TELA:automacao_de_cobranca` é a área onde a régua já vive, e a régua é a rotina de maior
   cadência do roster.

**Superfície (§5.2 de `.claude/rules/ancoras-de-superficie.md`)**: a fatia acrescenta **uma** rota e
**um** manipulador — `105 → 106` e `90 → 91` —, e o conjunto `publicas` **não muda** (a rota exige
sessão), permanecendo em 20. ⚠️ Os três valores são **constantes executáveis** de
`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`; a task que publica a rota **refaz a medição do
zero, pelas duas medições independentes do `CT-1038`**, e a âncora sobe no **mesmo diff**. O valor
escrito aqui é a expectativa, não a fonte.

### 4.1.1 Exemplo de Payload por Endpoint

**N/A — a única rota é `GET` e não aceita corpo nem atualização parcial.** A cláusula anti-`required`
do template não tem sujeito aqui. A resposta é a seguinte (campos ilustrativos, com o esquema em
§4.2):

```
GET /v1/automacao-de-cobranca/rotinas
Cookie: <sessão do Admin Empresa>

200 OK
{
  "itens": [
    {
      "rotina": "AVISO_DE_COBRANCA",
      "cadencia": { "tipo": "A_CADA_MINUTO" },
      "ultimaExecucao": "2026-08-22T17:03:00.000Z",
      "resumo": { "candidatas": 4, "enviadas": 3, "falhas": 0, "semDestinatario": 1 },
      "proximaEsperada": "2026-08-22T17:04:00.000Z",
      "atrasada": false,
      "impedimento": null,
      "historicoRecente": [
        { "ocorridaEm": "2026-08-22T17:03:00.000Z", "resumo": { "candidatas": 4, "enviadas": 3, "falhas": 0, "semDestinatario": 1 } },
        { "ocorridaEm": "2026-08-22T13:41:00.000Z", "resumo": { "candidatas": 1, "enviadas": 1, "falhas": 0, "semDestinatario": 0 } }
      ]
    },
    {
      "rotina": "ENCERRAMENTO_DE_CONTRATOS",
      "cadencia": { "tipo": "DIARIA", "hora": "00:02" },
      "ultimaExecucao": "2026-08-22T03:02:00.000Z",
      "resumo": { "candidatos": 2, "encerrados": 2, "preservados": 0 },
      "proximaEsperada": "2026-08-23T03:02:00.000Z",
      "atrasada": false,
      "impedimento": null,
      "historicoRecente": []
    },
    {
      "rotina": "CONFERENCIA_DE_LIQUIDACAO",
      "cadencia": { "tipo": "DIARIA", "hora": "03:00" },
      "ultimaExecucao": null,
      "resumo": null,
      "proximaEsperada": "2026-08-23T06:00:00.000Z",
      "atrasada": true,
      "impedimento": { "codigo": "INTEGRACAO_BANCARIA_PENDENTE",
                       "mensagem": "a empresa não tem certificado do provedor vigente" },
      "historicoRecente": []
    }
  ]
}
```

Três propriedades da forma, todas deliberadas:

- **`ultimaExecucao: null` não é erro** — é a empresa que ainda não teve passagem com efeito, e é o
  estado normal de quem acabou de ser admitida. A leitura **não cria linha alguma**, no mesmo molde
  de `lerPolitica`, que devolve a régua desligada em vez de `404`.
- **Todos os instantes saem em ISO-8601 UTC compostos pelo servidor**, com `AT TIME ZONE 'UTC'`
  fixando o eixo — o mesmo idioma de `conferencia-bancaria.ts` e `emissao-em-lote.ts`.
- **`resumo` é um objeto de contagens diferente por rotina**, e a resposta o publica como veio do
  banco: é a decisão D4 do tech-alignment (corpo variável, e não colunas fixas por rotina).

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `esquemaDoEstadoDasRotinas` | `packages/contracts/src/rotina-agendada.ts` (Zod 4, **fonte única** — ADR-0016) | `itens: EstadoDeRotina[]` — ⚠️ a chave é **`itens`**, corrigida no Gate 2 da T1: a cláusula de lista da ADR-0017 tem dois eixos, e só o das TRÊS chaves de janela (`total`, `limite`, `deslocamento`) depende de haver janela. O molde é `esquemaDaTrilhaDaCobranca`, byte a byte | v1 |
| `esquemaDoEstadoDeRotina` | idem | `rotina`, `cadencia`, `ultimaExecucao`, `resumo`, `proximaEsperada`, `atrasada`, `impedimento`, `historicoRecente` | v1 |
| `esquemaDoImpedimento` | idem | `codigo` (união fechada), `mensagem` | v1 |
| `ROTINAS_PUBLICADAS` | idem | `['AVISO_DE_COBRANCA','ENCERRAMENTO_DE_CONTRATOS','CONFERENCIA_DE_LIQUIDACAO']` — **derivado de `CADENCIA_DA_ROTINA` por filtro explícito** (`publicada: true`), nunca redigitado. É o que a leitura devolve | v1 |
| `CADENCIA_DA_ROTINA` | idem | mapa de **SEIS** entradas — uma por unidade systemd, e não só pelas publicadas: `AVISO_DE_COBRANCA`, `ENCERRAMENTO_DE_CONTRATOS`, `CONFERENCIA_DE_LIQUIDACAO`, `VIGILANCIA_DAS_ROTINAS`, `MANUTENCAO`, `RETOMADA_DE_NOTICIAS`. ⚠️ **Declaração única** de que a asserção estática das unidades depende — ver a nota abaixo | v1 |
| `LIMIAR_DE_ATRASO_POR_CADENCIA` | idem | `A_CADA_MINUTO → 15 min`; `DIARIA → 26 h` (RN-17) — **derivado da cadência**, nunca número solto por rotina | v1 |
| `CODIGOS_DE_IMPEDIMENTO` | idem | `REGUA_DESLIGADA`, `AVISOS_RECUSADOS_PELO_PROVEDOR`, `INTEGRACAO_BANCARIA_PENDENTE` — união **fechada** | v1 |

⚠️ **`CADENCIA_DA_ROTINA` cobre as SEIS unidades, e `ROTINAS_PUBLICADAS` é subconjunto DERIVADO
dela** — decidido no challenge de 2026-08-22. A forma anterior tinha dois conjuntos livres para
divergir e produzia **contradição executável**: a asserção estática compara o `OnCalendar=` de cada
uma das 6 unidades contra a cadência declarada, e três delas (vigilância, manutenção, retomada) não
teriam entrada num mapa restrito às publicadas. Cada entrada carrega `publicada: boolean`, e a
razão de as três de manutenção não serem publicadas está escrita ali: elas são **infraestrutura**
(RN-18) e não geram registro tenantizado (§7.2). **Não "simplifique" o mapa para três entradas** —
é o que reabre a contradição.

**Estritude**: a saída é `z.object` (aberta), pela `.claude/rules/contrato-publicado.md` — é o que
torna reversível a decisão D3 do tech-alignment (ampliar a leitura existente em vez de publicar uma
segunda rota, se a tela vier a exigir percurso longo). Não há esquema de **entrada** nesta fatia.

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Tópico / Fila | Payload | Schema |
|--------|------|---------------|---------|--------|
| Aviso de cobrança de uma empresa | pub (despachante) / sub (worker) | `regua-de-cobranca` (**existente — o produtor é a novidade**) | `{ empresaId }` | `CargaDaRegua` |
| Rotina agendada de uma empresa | pub (despachante) / sub (worker) | `rotina-agendada` (**nova**) | `{ empresaId, rotina }` | `CargaDaRotinaAgendada` |
| Manutenção do acervo | pub (despachante) / sub (worker) | `manutencao-do-acervo` (**nova**) | `{}` | `CargaDaManutencaoDoAcervo` |
| Retomada de notícia parada | pub (despachante) / sub (worker) | `notificacao-bancaria` (**existente**) | `{ notificacaoId }` | `CargaDaNotificacaoBancaria` |

⚠️ **As duas classes de carga da ADR-0024 convivem nesta fatia, e a assimetria é conformidade:**

- `CargaDaRotinaAgendada` **leva `empresaId` obrigatório** — a enumeração de tenants é quem o
  produz, e ela *já detinha direito a ele*. É literalmente a primeira metade do discriminador da
  emenda de 2026-08-18.
- `CargaDaManutencaoDoAcervo` **não tem campo algum**, e não por analogia com a notícia bancária: os
  alvos dela são `plataforma.notificacao_bancaria` (schema **sem** noção de tenant, ADR-0031) e o
  diretório dos boletos (sistema de arquivos). **Não há empresa a levar, e inventar uma seria
  atribuir dono a dado que não tem.** O expurgo do histórico de execução — que **é** tenantizado —
  não corre aqui: corre como `EXPURGO_DO_HISTORICO` na fila da rotina agendada, sob contexto.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**(a) O trabalho acontece sozinho.**

1. `systemd` dispara `sysloc-rotina-<r>.timer` na hora declarada em `OnCalendar=`, **com fuso
   explícito**. Se a máquina esteve fora do ar e o timer é diário, `Persistent=true` faz o disparo
   perdido acontecer **uma vez** ao voltar (CA-10).
2. O `.service` `Type=oneshot` executa `node apps/worker/dist/despachante.js <rotina>`.
3. O despachante valida `LOG_LEVEL`, `DATABASE_URL` e `REDIS_URL` — **falha fechado**, nomeando a
   variável ausente, no molde de `apps/worker/src/main.ts` — e abre banco e fila.
   ⚠️ **Ele NÃO escreve um produtor próprio**: reusa `conectarFila` de `apps/worker/src/fila.ts`,
   cuja interface já publica cada `Queue` como campo, e enfileira com `OPCOES_PADRAO_DA_TAREFA` —
   o **único** caminho publicado. Um produtor próprio seria a **terceira** cópia do padrão (a borda
   HTTP em `apps/api/src/comum/produtor-de-fila.ts` é a primeira), e o Limiar de Três dispararia na
   hora de nascer. Ele **não** chama `fila.processar`: sem consumidor registrado, o processo não
   consome nada — é produtor puro.
4. Conforme a rotina:
   - **por empresa** (`AVISO_DE_COBRANCA`, `ENCERRAMENTO_DE_CONTRATOS`,
     `CONFERENCIA_DE_LIQUIDACAO`, `VIGILANCIA_DAS_ROTINAS`, `EXPURGO_DO_HISTORICO`) — enumera as
     empresas **ativas** (`identidade.empresa` com `suspensa_em IS NULL`, **sem contexto de
     tenant**, ADR-0024 leitura #1) e enfileira **uma tarefa por empresa**, na fila própria da
     rotina. Empresa suspensa **não é enumerada** (RN-09/CA-17): o filtro é da própria consulta, e
     não uma conferência posterior;
   - **sem tenant** (`MANUTENCAO_DO_ACERVO`) — enfileira **uma** tarefa de carga vazia, e ainda
     enumera empresas ativas para despachar `EXPURGO_DO_HISTORICO`;
   - **despacho puro** (`RETOMADA_DE_NOTICIAS`) — lê `plataforma.notificacao_bancaria` com
     `desfecho = 'RECEBIDO'` e `recebido_em` mais antigo que a folga declarada, e reenfileira cada
     uma na fila existente da notícia bancária. **Não abre contexto**: o schema não tem noção de
     tenant, e descobrir a empresa é trabalho da tarefa (ADR-0035 + emenda de 2026-08-18).
5. O despachante devolve fila e reserva de conexões, registra uma linha estruturada com a rotina e
   o número de tarefas enfileiradas, e **termina** com código `0`.
6. Falha em qualquer ponto → código de saída diferente de zero → `OnFailure=` aciona
   `sysloc-alerta-de-rotina@<unidade>.service`, que grava no journal **nomeando a rotina** (CA-03,
   metade 1 da decisão D5).

**(b) O trabalho de uma empresa é feito.**

7. `processarRotinaAgendada` recebe a tarefa, valida a carga com Zod (o mesmo molde de
   `apps/worker/src/tarefas/regua.ts`) e abre o contexto de tenant **uma vez**, com
   `contextoDeTenant.executarCom({ empresaId }, …)`.
8. Despacha para a rotina:
   - `ENCERRAMENTO_DE_CONTRATOS` → `encerrarContratosVencidos(tx)` numa unidade de trabalho;
   - `CONFERENCIA_DE_LIQUIDACAO` → `abrirConferencia(tx, { solicitadaPor: null })` e, na sequência,
     o mesmo trabalho que a rota manual já executa. ⚠️ **O `null` é conformidade, não lacuna**: a
     coluna `negocio.conferencia_bancaria.solicitada_por` é anulável e o docblock de
     `ConferenciaNova` diz literalmente *"ou `null` quando o disparo é do relógio"* — a F4 **previu
     esta fatia**. É o que dispensa inventar sessão de serviço sintética, que o tech-alignment
     proíbe. A trava de "uma em andamento por empresa" é o
     `conferencia_bancaria_em_andamento_uidx`, que **já existe** (RN-13);
   - `VIGILANCIA_DAS_ROTINAS` → `lerEstadoDasRotinas(tx)` e, para cada rotina `atrasada`, uma linha
     de registro estruturado em nível `error` com a empresa e a rotina (CA-03, metade 2);
   - `EXPURGO_DO_HISTORICO` → `expurgarExecucoesVencidas(tx)`.
9. **O registro só é gravado quando houve efeito** (RN-15/CA-11). O predicado é declarado por rotina
   em §6.3, e não inferido de "o resumo não é vazio".
10. Uma linha estruturada fecha a tarefa, com `{ idTarefa, fila, empresaId, rotina, ...resultado }`
    — o mesmo formato que a régua já emite.

**(c) O Admin consulta.**

11. `GET /v1/automacao-de-cobranca/rotinas` → a guarda de contexto estabelece a empresa da sessão →
    `sobContextoDaSessao` abre a unidade → `lerEstadoDasRotinas(tx)` devolve, **por rotina do roster
    publicado**, a última execução, o resumo, a próxima esperada, o atraso e o impedimento.
12. Rotina sem execução alguma aparece com `ultimaExecucao: null`. **Nada de outra empresa é
    alcançável** — a RLS decide, não a aplicação (CA-15).

### 5.2 Fluxos Alternativos

| Situação | Comportamento | CA |
|---|---|---|
| Máquina fora do ar na hora marcada, rotina **diária** | `Persistent=true`: o systemd dispara **uma** vez ao voltar. O dia não é pulado | CA-10 |
| Máquina fora do ar, rotina **de minuto** | Sem `Persistent=`: nada é recuperado, e é a decisão — recuperar um minuto perdido não recupera nada, e a régua é idempotente por predicado | — |
| Máquina volta **depois de dias** | Um disparo por timer diário, não N. A fila absorve o pico por concorrência controlada, e a régua **continua sem retroagir** (o predicado da janela e do intervalo mínimo decide) | CA-18 |
| Empresa **suspensa** | Não é enumerada. Nenhuma tarefa é enfileirada para ela, por rotina nenhuma | CA-17 · RN-09 |
| Empresa **reativada** | O reenfileiramento das notícias retidas já acontece em `EmpresaService.reativar` (F4). O encerramento e a conferência **põem em dia na próxima passagem**, que é *uma* passagem — as rotinas de estado são idempotentes. **Nenhum Aviso retroativo**: a régua respeita janela e intervalo mínimo | CA-18 · RN-10/RN-11 |
| Falha no processamento de **uma** empresa | A tarefa daquela empresa falha e é retentada pela política padrão (3 tentativas, espera crescente). As demais são tarefas **independentes** e correm normalmente. A falha fica no journal, apontando a empresa | CA-02 · RN-12 |
| Contrato vencido **sem imóvel** | ⚠️ **Irrepresentável** — `negocio.contrato.imovel_id` é `NOT NULL`. Ver §6.3 e §21.2 | CA-06 |
| Contrato vencido cujo imóvel está **`INDISPONIVEL`** | O contrato encerra; a situação do imóvel é **preservada**, e o resumo conta em `preservados` (RD-20) | — (achado do challenge) |
| Contrato cuja data de fim **ainda não chegou** | Não entra no predicado de seleção | CA-07 |
| Contrato **já encerrado** | Não entra no predicado (`status = 'ATIVO'`), e o `UPDATE` também o exige | CA-08 |
| Segunda passagem no **mesmo dia** | Conjunto de candidatos vazio (os de ontem já estão `ENCERRADO`) → nenhum efeito → **nenhum registro** | CA-09 · CA-11 |
| Passagem concorrente da **mesma** rotina para a **mesma** empresa | `FOR UPDATE … SKIP LOCKED`: a segunda encontra conjunto vazio, não produz efeito e não grava registro | CA-22 · RN-13 |
| Entrega da notícia **desabilitada** | A conferência diária continua descobrindo Liquidação — ela não depende da entrega | CA-16 |
| Provedor de e-mail recusando por limite | Derivado de `envio_de_cobranca`: impedimento `AVISOS_RECUSADOS_PELO_PROVEDOR` na leitura do Admin | CA-19 |
| Notícia parada em `RECEBIDO` | A rotina de retomada a reenfileira na fila existente; a tarefa é idempotente porque opera sobre o **mesmo** registro já gravado | CA-20 |
| Boleto guardado mais antigo que a retenção | Removido pela manutenção; os no prazo permanecem | CA-21 |
| Reinício da máquina | `WantedBy=timers.target` em todo `.timer` e `systemctl enable` pelo instalador: as rotinas voltam sem intervenção | CA-23 |

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | (c) 11–12 · `GET /v1/automacao-de-cobranca/rotinas` | `automacao.controller`, `automacao.service`, `execucao-de-rotina.ts` |
| US-02 | (c) 11–12, campo `impedimento` | `execucao-de-rotina.ts`, `rotina-agendada.ts` (contracts), `envio-de-cobranca` (derivação), `certificado-do-provedor` |
| US-03 | (a) 6 (`OnFailure=`) + (b) 8 (`VIGILANCIA_DAS_ROTINAS`) | `sysloc-alerta-de-rotina@.service`, `tarefas/rotina-agendada.ts`, `execucao-de-rotina.ts` |
| US-04 | (a) 1–4 + régua existente | `sysloc-rotina-aviso-de-cobranca.timer`, `despachante.ts`, `tarefas/regua.ts` (**modificado na T8**: grava o registro da passagem sob o predicado da RD-15), `packages/regua/src/janela.ts` |
| US-05 | (b) 8, régua sem retroatividade | `packages/regua/src/regua.ts` (inalterado), `envio_de_cobranca_trava_idx` |
| US-06 | (b) 8 `ENCERRAMENTO_DE_CONTRATOS` | `encerramento-de-contratos.ts`, `definirSituacaoDeLocacaoDoImovel` |
| US-07 | (b) 8 `CONFERENCIA_DE_LIQUIDACAO` | `sysloc-rotina-conferencia-de-liquidacao.timer`, `abrirConferencia`, `tarefas/conferencia-bancaria.ts` |
| US-08 | (a) 1, `Persistent=true` | `deploy/systemd/*.timer` |
| US-09 | (a) 4 + (b) 7 — uma tarefa por empresa | `despachante.ts`, `fila.ts`, política padrão de repetição |
| US-10 | §16.1 — `instalar-unidades.sh` idempotente | `deploy/scripts/instalacao/instalar-unidades.sh` |
| US-11 | (c) 11, impedimento `AVISOS_RECUSADOS_PELO_PROVEDOR` | `execucao-de-rotina.ts` (derivação sobre `envio_de_cobranca`) |
| US-12 | (a) 4 `RETOMADA_DE_NOTICIAS` | `despachante.ts`, `listarNaoTratadas`, `FILA_DA_NOTIFICACAO_BANCARIA` |
| US-13 | (b) 8 `EXPURGO_DO_HISTORICO` + `MANUTENCAO_DO_ACERVO` | `expurgarExecucoesVencidas`, `expurgarNotificacoesVencidas`, `expurgarBoletosVencidos` |
| US-14 | (a) 4 — filtro de enumeração; reativação já entregue na F4 | `listarEmpresasAtivas`, `EmpresaService.reativar` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| O nome da rotina recebido em `process.argv[2]` pertence ao roster de despacho | `apps/worker/src/despachante.ts` | Termina com código `2`, nomeando os valores aceitos. **Nunca** cai num ramo padrão silencioso |
| `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL` presentes e bem formados | `apps/worker/src/despachante.ts` | **Falha fechado** na partida, nomeando **cada** variável ausente, no molde de `main.ts`. Nunca imprime o valor |
| `CargaDaRotinaAgendada`: `empresaId` UUID e `rotina` na união fechada | `apps/worker/src/tarefas/rotina-agendada.ts` (Zod, `strictObject`) | Levanta com nome do campo; a tarefa é retentada e, esgotada a política, fica em falha retida. **Nunca** executa sem contexto |
| `CargaDaManutencaoDoAcervo`: objeto **vazio** | idem | `strictObject({})` recusa campo desconhecido — em especial um `empresaId` que alguém acrescentasse por analogia |
| A leitura `GET …/rotinas` não aceita corpo nem parâmetro de consulta | `automacao.controller.ts` | Não há esquema de entrada; parâmetro desconhecido é ignorado pelo roteador, e a rota não o lê |

### 6.2 Transformações de Dados

- **Instantes**: `timestamptz` → ISO-8601 **UTC** composto pelo servidor (`to_char(… AT TIME ZONE
  'UTC', …)`), idioma já usado em `conferencia-bancaria.ts` e `emissao-em-lote.ts`. A aplicação
  **não** formata data.
- **`resumo`**: `jsonb` do banco → objeto da resposta, sem remodelagem. As chaves já nascem em
  **vocabulário do produto** (RN-19) no ponto que grava. ⚠️ **O resumo da rotina de aviso REUSA os
  campos de `ResultadoDaRegua`** — `candidatas`, `enviadas`, `falhas`, `semDestinatario` —, que o
  pacote `@sysloc/regua` já publica. Inventar `avisadas`/`recusadas` criaria um **segundo
  vocabulário para o mesmo fato**, e o primeiro a divergir venceria em silêncio. Os campos próprios
  desta fatia são apenas os que ainda não existiam: `candidatos`/`encerrados`/`preservados` do
  encerramento, `liquidacoesDescobertas` da conferência e `removidos` do expurgo.
- **`proximaEsperada`**: derivada da cadência declarada em `@sysloc/contracts` sobre o instante
  corrente **do banco**. Para `DIARIA`, é a próxima ocorrência da hora declarada; para
  `A_CADA_MINUTO`, o minuto seguinte.
- **`atrasada`**: `agora - ultimaExecucao > limiar(cadencia)`, calculado **no banco**, na mesma
  consulta que lê a última execução. Rotina sem execução alguma é `atrasada` quando a empresa existe
  há mais que o limiar — e não desde o primeiro segundo de vida dela.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RD-01 | RN-01 | É candidato o contrato com `status = 'ATIVO'` **e** `data_fim_locacao < negocio.data_corrente_da_operacao()`. A data vem do **banco** (ADR-0026); `data_fim_locacao` nula (rascunho) nunca satisfaz o predicado | — (seleção vazia não é erro) |
| RD-02 | RN-02 | ⚠️ **Irrepresentável.** `negocio.contrato.imovel_id` é `NOT NULL` desde a `0007`: contrato sem imóvel não existe no produto novo. A regra é honrada **vacuamente**, e a rede é a prova de que o banco recusa a inserção. **Não relaxar a coluna para acomodar o oráculo** — ver §21.2 | violação `23502` do banco |
| RD-03 | RN-03 | Encerrar e liberar o imóvel são **um ato**: as duas escritas correm na **mesma unidade de trabalho**, pela porta estreita `definirSituacaoDeLocacaoDoImovel`. Falha em qualquer uma desfaz as duas | propaga; a unidade desfaz |
| RD-04 | RN-04 | O `UPDATE` repete o predicado (`WHERE codigo = … AND status = 'ATIVO'`), de modo que contrato já encerrado não é alcançado e o imóvel dele não é tocado | — |
| **RD-20** | — (achado do challenge) | ⚠️ **A liberação é CONDICIONAL: só `LOCADO → DISPONIVEL`.** Imóvel `INDISPONIVEL` tem o contrato encerrado normalmente e a **situação preservada**, com o fato registrado no resumo (`preservados`). Razão: `apps/api/src/imoveis/imovel.service.ts` declara por escrito que *"locar um imóvel `INDISPONIVEL` passa — `INDISPONIVEL` significa 'não ofereça nas buscas', e não 'proibido de locar'"*, de modo que o par `INDISPONIVEL` + contrato `ATIVO` é **estado legítimo**. Marcá-lo `DISPONIVEL` apagaria uma decisão deliberada do Admin, e nenhuma RN autoriza isso | — |
| RD-05 | RN-05 | Idempotência **por predicado**, e não por guarda: a segunda passagem do dia não encontra candidato porque o estado já mudou | — |
| RD-06 | RN-06 | A **Janela de horário** diz quando é *permitido*. A régua já a confere (`packages/regua/src/janela.ts`, bordas inclusivas, comparação lexicográfica sobre `HH:MM`) — **esta fatia não a toca** | — |
| RD-07 | RN-07 | A trava do intervalo mínimo é o `envio_de_cobranca_trava_idx` e o predicado da régua — **inalterados** | — |
| RD-08 | RN-08 | Cobrança paga ou cancelada nunca origina Aviso — predicado existente | — |
| RD-09 | RN-09 | Empresa suspensa **não é enumerada**. O filtro (`suspensa_em IS NULL`) é da consulta de enumeração, não uma conferência posterior — o que torna impossível enfileirar e depois descobrir | — |
| RD-10 | RN-10 | A reativação **não dispara nada retroativo**: o encerramento e a conferência põem em dia na próxima passagem, e a régua não retroage porque o predicado da janela e do intervalo mínimo decide no instante do envio | — |
| RD-11 | RN-11 | Já entregue na F4: `EmpresaService.reativar` reenfileira as notícias `RETIDO`. Esta fatia acrescenta a retomada das paradas em `RECEBIDO`, que é caso distinto | — |
| RD-12 | RN-12 | Falha isolada: **uma tarefa por empresa**. Não há laço que percorra empresas dentro de uma tarefa, e por isso não há como uma falha alcançar a próxima | — |
| RD-13 | RN-13 | Uma execução por vez por `(empresa, rotina)`, **pelo mecanismo que já governa cada rotina**: `FOR UPDATE … SKIP LOCKED` no encerramento; `conferencia_bancaria_em_andamento_uidx` na conferência; predicado na régua; idempotência natural no expurgo e na vigilância (leitura e `DELETE`). ⚠️ **Nenhum mecanismo genérico de trava é introduzido** — ver §21.1 P4 | — |
| RD-14 | **RN-14** | ⚠️ **DECISÃO FECHADA.** O estado da Cobrança e a Mora **nunca** são movidos por rotina: são derivados na leitura (ADR-0022, `negocio.cobranca_derivada`). Duas rotinas do sistema antigo (`marcar_cobrancas_vencidas`, `atualizar_atrasos_cobrancas`) **não têm sucessora, e isso é desenho**. O marcador vai no ponto do código com `REVERTER EXIGE` citando a ADR-0022 | — |
| RD-15 | RN-15 | **Passagem sem trabalho não gera registro.** O predicado é declarado por rotina: encerramento → `candidatos > 0`; régua → `enviadas + falhas + semDestinatario > 0` (**os campos de `ResultadoDaRegua`**, e note que `candidatas > 0` NÃO basta: a passagem que selecionou e não entregou nada por trava de intervalo não produziu efeito); conferência → `liquidacoesDescobertas > 0`; expurgo → `removidos > 0` | — |
| RD-16 | RN-16 | Retenção de **90 dias** para `negocio.execucao_de_rotina`, medida contra `now()` **do banco** — o mesmo idioma de `expurgarNotificacoesVencidas`, com `make_interval(days => …::integer)` | — |
| RD-17 | RN-17 | Limiar **derivado da cadência**, não número por rotina: `A_CADA_MINUTO → 15 min`, `DIARIA → 26 h`. Declarado uma vez em `@sysloc/contracts` e consumido pelos dois lados | — |
| RD-18 | RN-18 | **Dois canais por natureza.** Infraestrutura (rotina que não executa, processo caído) → journal + `OnFailure=`, para o operador; configuração da empresa (integração pendente, avisos recusados) → campo `impedimento` da leitura, para o Admin. O alerta de rotina parada **não depende do e-mail** | — |
| RD-19 | RN-19 | O `resumo` e o `impedimento.mensagem` são escritos em **vocabulário do produto**. Diagnóstico de terceiro obedece à ADR-0034 e à redação de `@sysloc/shared` | — |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, acesso por `postgres.js` sob a unidade de trabalho de `@sysloc/db`.
Esquema declarado em Drizzle; migrações em SQL versionado com `sha256sum` conferido. **Nenhum
gatilho de banco** — o produto tem zero em 25 migrações, e esta fatia não introduz o primeiro
(ver §21.1 P4 e §20).

### 7.2 Tabelas / Coleções

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|------|------------------|-------|-------------|---------|
| `negocio.execucao_de_rotina` (**nova**) | `id`, `empresa_id`, `rotina`, `ocorrida_em`, `resumo` | `uuid` PK default `gen_random_uuid()`; `uuid NOT NULL`; enum `negocio.rotina_agendada NOT NULL`; `timestamptz NOT NULL DEFAULT now()`; `jsonb NOT NULL` | `UNIQUE (id, empresa_id)` (alvo de FK composta futura, e o que a guarda de cobertura de `src/catalogo.ts` cobra); `FOREIGN KEY (empresa_id) REFERENCES identidade.empresa(id)`; `CHECK (jsonb_typeof(resumo) = 'object')` nomeada `execucao_de_rotina_resumo_chk` (a convenção do esquema é `_chk`, medida em 6 ocorrências — **não** `_check`); `FORCE ROW LEVEL SECURITY` + política `execucao_de_rotina_isolamento_empresa` | `execucao_de_rotina_historico_idx (empresa_id, rotina, ocorrida_em DESC)` — o molde que **cinco** tabelas já usam; serve à última execução, ao histórico recente **e** ao expurgo |
| `negocio.rotina_agendada` (**enum novo**) | `AVISO_DE_COBRANCA`, `ENCERRAMENTO_DE_CONTRATOS`, `CONFERENCIA_DE_LIQUIDACAO` | — | Três valores: **só as rotinas que geram registro**. Vigilância e expurgo não gravam (são manutenção, e gravá-las reintroduziria o defeito de 12 MB do sistema antigo com outro nome) | — |

**Nenhuma coluna `retirado_em`** — o registro é **fato**, não entidade referenciável: a ADR-0014 não
o alcança, pelo mesmo discriminador que `envio_de_cobranca` já registra. E, diferente daquela, esta
tabela **tem** expurgo, porque o PRD o exige (RN-16/CA-13).

**Nenhuma coluna `concluida_em`/`iniciada_em`**, e a ausência é decisão: uma linha aberta no início
da passagem nasceria antes de saber se há trabalho, o que contraria a RN-15 frontalmente. A trava de
concorrência é a de cada rotina (RD-13), não esta tabela.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0026 | `packages/db/migracoes/0026_dominio_execucao_de_rotina.sql` | up — **gerada** por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`. Uma intervenção à mão, a do padrão das 12 irmãs: o nome do arquivo e o `tag` de `meta/_journal.json`. **Nenhuma instrução autoral aqui** |
| 0027 | `packages/db/migracoes/0027_seguranca_execucao_de_rotina.sql` | up — **autoral**: `FORCE ROW LEVEL SECURITY` e a política de isolamento. Sem `GRANT` (o `ALTER DEFAULT PRIVILEGES` da `0001` já alcança `sysloc_app`) e **sem papel de leitura sem contexto** — não há caso que o justifique |

Não há `down`: as migrações deste produto são **imutáveis e aplicadas em avanço**, com `sha256sum`
conferido pelo instalador.

### 7.4 Estratégia de Transação e Consistência

- **Unidade de trabalho**: `BEGIN` → `SET LOCAL app.empresa_id` → operações → `COMMIT`, nessa ordem,
  pelo escritor único de `@sysloc/db`. Isolamento padrão (`READ COMMITTED`).
- **Encerramento** — a passagem inteira numa unidade: seleção com `FOR UPDATE … SKIP LOCKED`,
  `UPDATE` sob predicado, liberação do imóvel pela porta estreita, e o registro ao fim. É o que
  torna a RN-03 verdadeira sem coordenação extra.
- **Ordem das escritas dentro da unidade**: primeiro o contrato (`ATIVO → ENCERRADO`), depois o
  imóvel — e **só quando ele está `LOCADO`** (RD-20). A ordem importa e é a inversa da ativação: encerrar **libera** a
  posição do `contrato_imovel_vigente_uidx`, de modo que uma ativação concorrente sobre o mesmo
  imóvel ou é recusada pelo índice (enquanto o encerramento não commitou) ou ocorre **depois** de o
  imóvel já ter sido liberado. **Não há janela em que o imóvel fique `DISPONIVEL` com contrato
  vigente por causa desta rotina.**
- **Concorrência entre passagens**: `SKIP LOCKED` faz a segunda passagem encontrar conjunto vazio.
  A leitura de CA-22 é *"nenhum efeito duplicado e nenhum registro"*, provada por duas passagens
  concorrentes — ver §21.1 P4.
- **Entrega da fila**: *at-least-once*. Toda tarefa desta fatia é idempotente por predicado ou por
  operar sobre registro **já gravado**.

### 7.5 Política de Retenção / Archival

| Alvo | Prazo | Corte | Quem executa |
|---|---|---|---|
| `negocio.execucao_de_rotina` | **90 dias** (RN-16) | `ocorrida_em < now() - make_interval(days => 90)`, `now()` **do banco** | `EXPURGO_DO_HISTORICO`, por empresa, sob contexto |
| `plataforma.notificacao_bancaria` (recebido cru) | 90 dias (**já existente**) | `expurgarNotificacoesVencidas` — **reusada, não reescrita** | `MANUTENCAO_DO_ACERVO`, sem tenant |
| Diretório dos boletos guardados | **90 dias (A1)** | idade do arquivo sob o diretório-base conferido | `MANUTENCAO_DO_ACERVO`, sem tenant |

**(A1) O prazo dos boletos guardados é decisão de produto que o tech-alignment deixou em aberto
(ponto 6).** Adotada a recomendada: **90 dias**, com três razões e uma condição de reversão.
(i) O produto já tem **um** prazo de retenção, e três prazos divergentes é o que ninguém revisa
depois. (ii) O boleto **não é o único caminho** para o documento: a reemissão junto ao provedor
existe (`packages/cobranca-bancaria/src/reemissao.ts`) e o carnê é composto sob demanda (ADR-0030).
(iii) A emissão é mensal com vencimento em ~30 dias, de modo que 90 dias cobrem com folga o ciclo de
vida útil do arquivo; a projeção de ~1,4 GB/mês fica em ~4,2 GB de acervo estacionário.
**Reversão**: o prazo é um parâmetro do adaptador da guarda, não uma constante enterrada — trocá-lo
é uma linha na composição raiz.

⚠️ **O expurgo dos boletos NÃO conhece o banco**, e isso é preservado: `guarda-de-boletos.ts`
recebe o diretório-base por parâmetro (ADR-0025) e o expurgo opera **por idade do arquivo sob a
base conferida**, com a mesma comparação por igualdade literal de caminho que a guarda já faz. Ele
não recebe código de cobrança nem consulta estado.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| Provedor bancário (Sicoob) | REST sobre `node:https` com mTLS | `client_credentials` + certificado, **dentro do adaptador** | Os já declarados em `criarAdaptadorSicoob` | Política padrão da tarefa (3 tentativas, espera crescente) |
| Servidor SMTP | SMTP via `nodemailer` | `SMTP_URL` | Os já declarados em `criarAdaptadorSmtp` | idem |

**Esta fatia não acrescenta integração externa alguma, e não toca os adaptadores.** As duas acima
são consumidas pelo processo de trabalho **como já são hoje** — a conferência de liquidação e a
régua passam a ter *quem as dispare*, e nada mais. O **despachante não compõe nenhuma das duas
portas**: ele fala só com banco e fila (§3.3, ADR-0025).

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Tópico / Fila | Produtor | Consumidor | Garantia |
|---------------|----------|------------|----------|
| `regua-de-cobranca` (existente) | **despachante** (o produtor que faltava) | `processarReguaDeCobranca` (inalterado) | at-least-once |
| `rotina-agendada` (nova) | despachante | `processarRotinaAgendada` | at-least-once |
| `manutencao-do-acervo` (nova) | despachante | `processarManutencaoDoAcervo` | at-least-once |
| `notificacao-bancaria` (existente) | borda HTTP **e** despachante (retomada) | `processarNotificacaoBancaria` (inalterado) | at-least-once |

Todas usam `OPCOES_PADRAO_DA_TAREFA` — **o único caminho publicado**. Nenhum produtor desta fatia
monta opções à mão, que é exatamente a divergência que o fecho do `D32 · F0/T6` eliminou.

### 9.2 Idempotência

| Rotina | Fonte da idempotência |
|---|---|
| `AVISO_DE_COBRANCA` | Predicado da régua: a já avisada cai fora do conjunto pelo `envio_de_cobranca_trava_idx` |
| `ENCERRAMENTO_DE_CONTRATOS` | Predicado da seleção **e** do `UPDATE` (`status = 'ATIVO'`). Repetir não encontra candidato |
| `CONFERENCIA_DE_LIQUIDACAO` | `conferencia_bancaria_em_andamento_uidx` — uma em andamento por empresa |
| `VIGILANCIA_DAS_ROTINAS` | Leitura pura; repetir emite a mesma linha de journal |
| `EXPURGO_DO_HISTORICO` / `MANUTENCAO_DO_ACERVO` | `DELETE` e remoção de arquivo são idempotentes; o segundo é `ENOENT`-tolerante, como a guarda já é |
| `RETOMADA_DE_NOTICIAS` | A tarefa opera sobre a notícia **já gravada** — a mesma razão do `loteId` |

⚠️ **Nenhuma chave de idempotência (`jobId` determinístico) é usada**, e a ausência é decisão: com a
retenção por contagem de `OPCOES_PADRAO_DA_TAREFA`, um `jobId` fixo permaneceria no conjunto depois
de concluído e **recusaria em silêncio a passagem seguinte** — a rotina pararia sem que nada
falhasse. É o modo de falha mais caro desta fatia.

### 9.3 Outbox / Saga

**N/A** — não há consistência distribuída a coordenar. O único par de escritas que precisa ser
atômico (contrato + imóvel) vive na **mesma transação do mesmo banco** (RD-03). O enfileiramento
acontece **fora** da unidade de trabalho, pela mesma disciplina que a borda já pratica: grava-se
primeiro, enfileira-se depois — e a repetição é segura porque a tarefa opera sobre o registro
gravado.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Sessão ausente ou inválida | `401` `NAO_AUTENTICADO` | envelope da ADR-0017 | `contexto.guard` |
| Sem a área `TELA:automacao_de_cobranca` | `403` `ACESSO_NEGADO`, com `detalhes.exigido` | idem | guarda de exigência |

**Não há `404` nesta rota, e a ausência é decisão**: a empresa sem execução alguma recebe `200` com
`ultimaExecucao: null`, no mesmo molde de `lerPolitica`. *"Ainda não rodou"* e *"não existe"* são a
mesma coisa publicada, e é isso que faz a leitura concordar com o que o produto faz numa empresa
recém-admitida, que é nada.

**Erros do lado do trabalho não têm status HTTP** — não há requisição. Eles se manifestam como:
tarefa em falha (retentada pela política padrão), linha de journal em nível `error`, e — quando o
próprio despachante falha — código de saída diferente de zero, que o `OnFailure=` transforma em
alerta nomeando a rotina.

### 10.2 Resiliência

- **Repetição**: 3 tentativas com espera crescente a partir de 1 s (`OPCOES_PADRAO_DA_TAREFA`).
- **Falha isolada**: uma tarefa por empresa — não há laço que possa ser interrompido no meio.
- **Degradação declarada**: entrega da notícia desabilitada → a conferência diária continua
  descobrindo Liquidação. É mais devagar, não é incorreto (CA-16).
- **Recuperação de disparo perdido**: `Persistent=true` nas diárias — **uma** vez ao voltar, não N.
- **Guarda contra laço de reinício**: `StartLimitIntervalSec=60` / `StartLimitBurst=5` nas unidades,
  no molde das duas existentes. Em `Type=oneshot` **não há `Restart=always`**: a rotina que falha
  espera o próximo disparo do timer, em vez de reiniciar em laço.
- **A vigilância não se vigia** — trade-off **declarado** pela decisão D5: se ela mesma parar, a
  falha dela cai no `OnFailure=`, mas a parada silenciosa dela não é detectada por nada dentro do
  produto. Fechar essa recursão exige observação **de fora**, que é da F7.

### 10.3 Estratégia de Logging de Erros

Pino via `@sysloc/shared`, com a **redação única** de `log.ts`. Nível `error` para falha de tarefa e
para rotina atrasada; `warn` para impedimento de configuração; `info` para o fecho de cada passagem
com efeito. Nenhum segredo viaja em carga (§11.6), e diagnóstico de terceiro obedece à ADR-0034.

---

## 11. Segurança

### 11.1 Autenticação

Sessão via `better-auth`, inalterada. A rota nova é `@ExigeChave(...)` **herdada da classe** — não é
`@RotaPublica()`, e o conjunto de rotas públicas permanece em **20**.

O trabalho de fundo **não tem sessão e não a simula**: nenhuma sessão de serviço sintética é criada,
por decisão registrada no tech-alignment. O que governa o alcance é a **procedência da carga**
(ADR-0024) mais a RLS.

### 11.2 Autorização

- **Borda**: `@ExigeChave('TELA:automacao_de_cobranca')` na classe do controlador. Nenhuma chave nova
  entra no catálogo fechado (10 telas + 7 ações, ADR-0011/decisão 38).
- **Dados**: `FORCE ROW LEVEL SECURITY` com política nominal em `negocio.execucao_de_rotina`. **O
  isolamento é do banco** — CA-15 é satisfeita pela política, não por um `WHERE empresa_id = …` da
  aplicação.
- **Sem ator**: o encerramento é a **terceira classe** de ato da ADR-0021 (emenda de 2026-08-22) — a
  que não tem governança a exigir porque não tem ator. ⚠️ **A emenda não cria chave, não autoriza
  rota e não fundamenta transição sem exigência pela superfície**: o encerramento **manual** pela
  tela permanece decisão não tomada.
- **Enumeração de tenants**: `listarEmpresasAtivas` lê `identidade.empresa`, schema **sem** noção de
  tenant (ADR-0009), e devolve **só o identificador**. É a leitura legítima #1 da ADR-0024. ⚠️
  **Nenhuma travessia nominal nova é criada** — a alternativa que responderia *"quais empresas têm
  candidata"* foi medida e **rejeitada** no tech-alignment D2 por custo desproporcional (um furo
  permanente no isolamento para poupar trabalho barato).

### 11.3 Criptografia

Inalterada. `CHAVE_DE_CIFRA_DO_CERTIFICADO` continua sendo lida **apenas** por
`apps/worker/src/main.ts` (ADR-0032). **O despachante não a exige e não a lê** — ele não fala com o
provedor.

### 11.4 Sanitização e Validação

Consultas parametrizadas pelo driver; nada de concatenação. O único texto que entra em instrução por
composição é o `SET LOCAL` da unidade de trabalho, que já é escritor único com marcador `DECISÃO
FECHADA`. O nome da rotina recebido em `argv` é casado contra uma **união fechada** antes de
qualquer uso — ele nunca entra em SQL nem em nome de fila por interpolação.

### 11.5 Rate Limiting / Anti-abuse

**N/A para esta fatia.** A rota é de leitura, exige sessão e não é alcançável de fora enquanto a API
for local. O limitador de abuso da borda pública é da F7 (`D27 · F1/T6`, `D27 · F4/T11`), e esta
fatia não muda essa fronteira.

O que **é** anti-abuso aqui, e é interno: o despachante enfileira **uma** tarefa por empresa por
disparo, e a fila absorve o pico da volta de uma indisponibilidade por concorrência controlada.

### 11.6 Secrets Management

`EnvironmentFile=/etc/sysloc/backend.env` (0600, dono root), gravado por `provisionar-base.sh`.
**Nenhuma credencial entra nos arquivos de unidade** (ADR-0005, invariante 3). O despachante exige
**três** variáveis, das quais duas carregam credencial (`DATABASE_URL`, `REDIS_URL`) e nenhuma é
nova. **Nada de segredo viaja em carga de tarefa** — a `CargaDaRotinaAgendada` leva dois
identificadores e a de manutenção leva zero campos.

---

## 12. Performance

### 12.1 Metas

- **Latência p95 da rota** `GET …/rotinas`: ≤ 120 ms (uma consulta indexada por rotina, com o
  histórico recente limitado).
- **Latência p99**: ≤ 300 ms.
- **Custo do disparo de minuto**: uma consulta de enumeração + N enfileiramentos, com N = número de
  empresas ativas (hoje na casa das dezenas; o produto dimensiona 20–300).
- **Duração do despachante**: ≤ 2 s por disparo, incluindo partida do runtime e devolução dos
  recursos.

### 12.2 Estratégias

- **Índice único e suficiente**: `execucao_de_rotina_historico_idx (empresa_id, rotina, ocorrida_em
  DESC)` serve à última execução (`LIMIT 1`), ao histórico recente (`LIMIT k`) e ao expurgo.
- **Histórico recente limitado por construção**, e não por parâmetro do cliente — é o que dispensa a
  segunda rota da decisão D3 e mantém a resposta de tamanho previsível.
- **Uma consulta para as três rotinas**, com a última execução por rotina resolvida por
  `DISTINCT ON (rotina)` sobre o índice — não uma consulta por rotina.
- **A régua continua selecionando por índice parcial** (`cobranca_aberta_idx`), sem varredura. O
  defeito do sistema antigo — varrer todas as cobranças abertas em 1.438 dos 1.440 minutos — **não
  existe aqui**, e a passagem vazia **não deixa rastro** (RN-15), que é o que substitui o registro
  de 12 MB.

### 12.3 Limites Conhecidos

- **Passagens sem trabalho existem, e são o custo declarado de não furar o isolamento**
  (tech-alignment D2). Contidas por três propriedades já existentes: seleção por índice parcial,
  idempotência por predicado, e a proibição de registrar passagem sem efeito.
- **Custo de partida de um processo por disparo** (~1.440 partidas/dia só na rotina de minuto). É o
  trade-off aceito de D1, em troca de o trabalho ter um lugar só. **Se medir caro**, a alternativa
  registrada é reduzir a cadência do timer da régua — não mover o trabalho para dentro do gatilho.
- **A volta de uma indisponibilidade longa** dispara os timers diários acumulados de uma vez. O pico
  é `n empresas × m rotinas diárias`; a fila o absorve, e a régua **não retroage**.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| Despacho concluído | `info` | `rotina`, `empresasEnumeradas`, `tarefasEnfileiradas`, `duracaoMs` | sem PII |
| Despacho falhou | `error` | `rotina`, `erro` (redigido) | redação única de `log.ts` |
| Passagem com efeito | `info` | `idTarefa`, `fila`, `empresaId`, `rotina`, contagens do resumo | sem PII |
| Passagem sem efeito | `debug` | idem, com `efeito: false` | — |
| **Rotina atrasada** | `error` | `empresaId`, `rotina`, `ultimaExecucao`, `limiarMinutos` | é o alerta da metade 2 do D5 |
| Impedimento detectado | `warn` | `empresaId`, `rotina`, `impedimento.codigo` | mensagem em vocabulário do produto |
| Expurgo executado | `info` | `alvo`, `removidos` | — |

Pino JSON, via `@sysloc/shared`. Toda linha passa pelo **despacho único de redação**.

### 13.2 Métricas

**N/A — o produto não tem coletor de métricas.** A stack medida não inclui OpenTelemetry,
Prometheus nem equivalente (o `CLAUDE.md` registra que `decisao-e-stack.md` §4 ainda lista OTel, e
que ele **não existe** nos manifests). Introduzir um coletor é decisão transversal fora do escopo
desta fatia. O que faz o papel de métrica aqui é o **registro de execução** consultável e o journal
estruturado — e é deliberado que o histórico consultável seja **do Admin**, por empresa, e não um
painel do operador (o isolamento proíbe o segundo).

### 13.3 Tracing

**N/A** — não há tracing distribuído no produto. A correlação entre disparo e efeito se faz pelo par
`(rotina, empresaId)` que aparece nas duas pontas do registro estruturado.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| **O DESPACHO** falhou | Código de saída ≠ 0 do `.service` do despachante | alta | `OnFailure=sysloc-alerta-de-rotina@%n.service` → journal, **nomeando a rotina** (CA-03) |
| **A TAREFA** falhou (depois de enfileirada) | Esgotou a política de repetição no processo de trabalho | alta | Linha `error` do worker, com `empresaId` e `rotina` (CA-02) — **não** pelo `OnFailure=` |
| Rotina **parou** | `agora - ultimaExecucao > limiar(cadencia)` (RN-17) | alta | Linha `error` no journal emitida por `VIGILANCIA_DAS_ROTINAS` |
| Impedimento de configuração | Régua desligada, integração pendente, avisos recusados | média | Campo `impedimento` da leitura do Admin — **não** vai ao journal como alerta |

⚠️ **O `OnFailure=` alcança o DESPACHO, nunca a execução da tarefa** — e a distinção não é sutil:
o despachante enfileira e **sai com código 0**; se a tarefa falhar depois, no processo de trabalho,
a unidade systemd já terminou com sucesso e nada dispara ali. Esperar alerta de infraestrutura para
falha de tarefa é a leitura errada mais provável desta seção. Quem cobre a falha da tarefa é o
registro estruturado do worker (CA-02, CT-1076), e quem cobre a rotina que **parou de rodar** é a
vigilância (CA-03, CT-1086).

⚠️ **As duas metades são complementares e nenhuma substitui a outra** (decisão D5). O mecanismo do
supervisor dispara quando a unidade **falha**; rotina que **não executou** — unidade desabilitada,
timer não instalado, máquina fora do ar prolongada — **não produz evento algum**, e é cega
exatamente para o defeito que a decisão 31 quer cobrir. O alerta de rotina parada **não depende do
e-mail funcionar**, porque o e-mail pode ser justamente o que quebrou.

---

## 14. Feature Flags

### 14.1 Solução

**N/A — o produto não usa feature flags**, e esta fatia não introduz a primeira. O que se aproxima
disso e **já existe** é a política de aviso por empresa (`ativo`), que é configuração de negócio
publicada em contrato, não bandeira de implantação.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

⚠️ **Nenhuma bandeira que escolha entre operação e verificação será introduzida** — a ADR-0025 é
explícita: as portas chegam por parâmetro, e a mesma injeção vale para os dois casos, sem ramo que
escolha entre eles.

---

## 15. Versionamento de API

### 15.1 Estratégia

Prefixo de caminho (`PREFIXO_DE_VERSAO` = `v1`), aplicado por `setGlobalPrefix` em
`apps/api/src/main.ts`. Inalterado.

### 15.2 Compatibilidade

⚠️ **Esta é a última rota antes do congelamento da superfície** (item 2 do marco de entrega). O que
não nascer aqui **não entra depois sem custo de contrato**. Duas consequências que governam a
revisão desta fatia:

1. A escolha de **uma** leitura em vez de duas (tech-alignment D3) é reversível **porque a saída é
   contrato aberto** (`z.object`): campo novo na resposta nasce sem quebrar cliente publicado, e a
   ampliação da leitura existente é possível. Publicar a segunda rota "por precaução" congelaria o
   que não se provou necessário — e essa direção **não** é reversível.
2. A âncora de superfície sobe **no mesmo diff** da publicação
   (`.claude/rules/ancoras-de-superficie.md`), com igualdade de conjunto e controle antivácuo.

### 15.3 Schemas / Contratos

`@sysloc/contracts` é a fonte única (ADR-0016): a conferência de entrada, o tipo da aplicação e o
documento publicado derivam do mesmo esquema Zod. **Não há cliente ts-rest** — o pacote é Zod puro,
e é ele que o React importará no handoff.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

`pnpm build` (Turborepo) → `deploy/scripts/instalacao/migrar-banco.sh` → `instalar-unidades.sh`.
Sem CI hospedado: a verificação é local, e o instalador é a porta.

**O instalador cresce, e a idempotência é o requisito (CA-04).** As mudanças:

- o array `UNIDADES` passa a incluir os **12** arquivos novos (6 `.service` + 6 `.timer`) e a
  unidade-modelo `sysloc-alerta-de-rotina@.service`;
- as pré-condições existentes valem para todos: `systemd-analyze verify` **sem código de erro e sem
  aviso**, artefato construído presente, runtime na versão do `.mise.toml`, arquivo de ambiente 0600;
- **habilita-se o `.timer`, nunca o `.service`** — habilitar o `oneshot` o faria correr no boot fora
  do horário. É a única diferença de tratamento em relação às duas unidades existentes, e ela é
  explícita no laço;
- cada passo continua imprimindo `CRIADO` / `JA-OK`, de modo que **a segunda execução é auditável
  linha a linha** — que é como CA-04 é demonstrada.

**(A1) Nenhum `verificar-*.sh` novo é escrito.** A alternativa recomendada e adotada: a conformidade
das unidades é provada por **suíte Vitest com asserção estática** sobre `deploy/systemd/*`
(`packages/shared/test/unidades-agendadas.spec.ts`), somada ao `systemd-analyze verify` que o
instalador já roda. Razão: o `D9 · F0/T2` tem como gatilho literal *"a próxima fatia que escrever um
`verificar-*.sh`"* — são **10 cópias do esqueleto**, 10 formas distintas, e só 2 rodam sem
privilégio; fechá-lo exige janela assistida com privilégio, que não cabe num run. Escrever a 11ª
cópia **agrava** o débito sem entregar nada que a asserção estática não entregue, e ainda troca uma
prova que roda na suíte por uma que exige `sudo`. **Reversão**: se a F7 abrir a janela assistida, o
verificador nasce junto do fecho do D9, com o esqueleto já unificado.

### 16.2 Empacotamento

**Nativo, sem contêiner** (decisão do projeto). `dist/despachante.js` é produzido pelo mesmo
`pnpm build` de `apps/worker`, e é barrado pelo `.gitignore` como os dois `dist/main.js`. Quem
confere a presença dele é o **instalador**, uma vez, com um humano olhando — nunca um
`ExecStartPre` de construção no caminho de disparo.

### 16.3 Infraestrutura como Código

**Unidades systemd versionadas no repositório** (ADR-0005), posicionadas por procedimento
idempotente. Não há Terraform, Pulumi nem Helm — a infraestrutura é um servidor só, e o IaC dele são
os scripts de `deploy/scripts/`.

**Molde das unidades**, herdado de `sysloc-worker.service`, sem exceção:

```ini
# sysloc-rotina-encerramento-de-contratos.timer
[Unit]
Description=Relógio do encerramento de contratos vencidos

[Timer]
# ⚠️ O FUSO É DECLARADO. Sem ele, o horário depende do fuso do sistema, e hoje
# acerta POR ACIDENTE (a máquina está em America/Sao_Paulo). systemd 255 aceita
# o fuso no próprio OnCalendar= desde a 252.
OnCalendar=*-*-* 00:02:00 America/Sao_Paulo
# A garantia pela qual a decisão 30 foi refinada: a máquina fora do ar na hora
# marcada NÃO custa a execução. Uma vez ao voltar, não N.
Persistent=true
Unit=sysloc-rotina-encerramento-de-contratos.service

[Install]
WantedBy=timers.target
```

```ini
# sysloc-rotina-encerramento-de-contratos.service
[Unit]
Description=Encerramento de contratos vencidos — despacho
After=network.target postgresql.service redis-server@sysloc.service
Wants=postgresql.service redis-server@sysloc.service
# A metade 1 do alerta: quem falhou é NOMEADO (CA-03).
OnFailure=sysloc-alerta-de-rotina@%n.service

[Service]
Type=oneshot
User=sysloc
Group=sysloc
WorkingDirectory=/opt/sysloc-backend/apps/worker
EnvironmentFile=/etc/sysloc/backend.env
Environment=NODE_ENV=production
Environment=LOG_LEVEL=info
ExecStart=/home/sysloc/.local/share/mise/installs/node/24.18.1/bin/node \
  /opt/sysloc-backend/apps/worker/dist/despachante.js encerramento-de-contratos
# … as 12 diretivas de restrição idênticas às de sysloc-worker.service …
```

⚠️ **Não há `Restart=always` em `Type=oneshot`**: a rotina que falha espera o próximo disparo do
timer. Reiniciar um despacho em laço multiplicaria o enfileiramento em vez de o corrigir.

### 16.4 Estratégia de Rollout

Passo único, com o `instalar-unidades.sh`. **Serviço saudável não é reiniciado** — o instalador já
tem essa propriedade, e ela importa mais aqui: as duas unidades existentes não devem ser tocadas por
uma instalação que só acrescenta timers.

### 16.5 Escalabilidade

Vertical, num servidor só. O eixo que cresce é o **número de empresas ativas**: o despacho é
`O(empresas)` em enfileiramentos e `O(1)` em consultas. O produto dimensiona 20–300 empresas.

### 16.6 Rollback

`systemctl disable --now <timer>` em cada timer devolve o produto ao estado anterior à fatia —
nenhuma rotina dispara, e nada mais muda: as filas ficam sem produtor, como estão hoje. As
migrações **não** são revertidas (imutáveis); a tabela nova, vazia, é inerte. A rota nova é de
leitura e não tem efeito colateral.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | Tabela `negocio.execucao_de_rotina` + `lerEstadoDasRotinas` + esquema `esquemaDoEstadoDasRotinas` | `esquema/negocio.ts`, `execucao-de-rotina.ts`, `rotina-agendada.ts` (contracts), `automacao.{controller,service}.ts` |
| US-02 | União fechada `CODIGOS_DE_IMPEDIMENTO` e a derivação de cada um sobre fato já gravado | `rotina-agendada.ts` (contracts), `execucao-de-rotina.ts`, `envio_de_cobranca`, `certificado_do_provedor`, `politica_de_aviso` |
| US-03 | `OnFailure=` + unidade-modelo de alerta **e** rotina `VIGILANCIA_DAS_ROTINAS` com limiar por cadência | `sysloc-alerta-de-rotina@.service`, `tarefas/rotina-agendada.ts`, `LIMIAR_DE_ATRASO_POR_CADENCIA` |
| US-04 | Timer de minuto + o produtor que faltava para `FILA_DA_REGUA` | `sysloc-rotina-aviso-de-cobranca.{service,timer}`, `despachante.ts` |
| US-05 | Nenhum código novo — a não retroatividade é propriedade do predicado existente da régua, **preservada** | `packages/regua/src/regua.ts` [R], `envio_de_cobranca_trava_idx` [R] |
| US-06 | `encerrarContratosVencidos` — seleção, transição sob predicado e liberação pela porta estreita, uma unidade | `encerramento-de-contratos.ts`, `contrato.ts` [R], `imovel.ts` [R], golden [R] |
| US-07 | Timer diário + `abrirConferencia` na tarefa agendada | `sysloc-rotina-conferencia-de-liquidacao.*`, `tarefas/rotina-agendada.ts`, `conferencia-bancaria.ts` [R] |
| US-08 | `Persistent=true` nas diárias, ausente na de minuto | `deploy/systemd/*.timer`, `unidades-agendadas.spec.ts` |
| US-09 | Uma tarefa por empresa + política padrão de repetição | `despachante.ts`, `fila.ts` (shared e worker) |
| US-10 | Laço idempotente do instalador, com `CRIADO`/`JA-OK` por passo | `instalar-unidades.sh` |
| US-11 | Impedimento `AVISOS_RECUSADOS_PELO_PROVEDOR` derivado das tentativas recentes | `execucao-de-rotina.ts`, `envio_de_cobranca` [R] |
| US-12 | `listarNaoTratadas` + reenfileiramento na fila existente | `notificacao-bancaria.ts`, `despachante.ts` |
| US-13 | Três expurgos: histórico (tenantizado), recebido cru (reusado), boletos (novo na guarda) | `execucao-de-rotina.ts`, `notificacao-bancaria.ts` [R], `guarda-de-boletos.ts` |
| US-14 | `listarEmpresasAtivas` com `suspensa_em IS NULL` — o filtro é da enumeração | `empresa.ts`, `despachante.ts`, `EmpresaService.reativar` [R] |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | NestJS + Fastify | 11 / 5 | A rota nova entra no controlador existente |
| ORM / driver | Drizzle + `postgres.js` | já instalados | Esquema, migração e unidade de trabalho |
| Cliente HTTP | — | — | **Nenhum novo.** O `node:https` do adaptador bancário é consumido pelo worker, não pelo despachante |
| Mensageria | BullMQ + ioredis | já instalados | Duas filas novas, mesmas opções publicadas |
| Validação | Zod | 4 | Carga das tarefas e esquema de saída |
| Registro | Pino | já instalado | Registro estruturado com redação |
| Verificação | Vitest + `embedded-postgres` | já instalados | Instâncias efêmeras próprias (ADR-0006) |
| Agendamento | **systemd timers** | 255 (do host) | O gatilho. ⚠️ O fuso em `OnCalendar=` exige ≥ 252 — **medido: 255.4** |

**Nenhuma dependência nova de pacote é introduzida por esta fatia.**

---

## 19. Estratégia de Testes

> **Resumo**: **41 casos** — Unitários: **8** · Integração: **27** · E2E: **3** · Segurança: **3**
> **Padrão**: Vitest 4.1.10 com `embedded-postgres` (instância efêmera própria), Redis efêmero e
> servidor HTTP real em porta dinâmica. Numeração **CT-1057 a CT-1097** (o maior CT do repositório
> era o `CT-1056`; o `CT-1097` nasceu no challenge de 2026-08-22). Convenção de rastreabilidade `CA-xx → CT-xxxx (RD-xx)` com seção de INVARIANTES
> por arquivo, no molde de `apps/worker/test/regua.spec.ts`.
> **Gerado por** `agent-spec-qa-test-generator` (frente `backend`); JSON integral em
> `_run/test-cases.json`.

> ⚠️ **A prova de falsificação é obrigatória para toda asserção ESTÁTICA** desta suíte — CT-1057,
> CT-1058, CT-1059, CT-1060, CT-1061, CT-1062 e as pernas estáticas de CT-1078, CT-1088, CT-1089 e
> CT-1096 —, e ela **só vale se rodada pelo script `test` do pacote** (`pnpm --filter
> @sysloc/<pacote> test`). `vitest run` avulso produz **falso negativo** nos pacotes que consomem
> irmãos por `dist/`: o defeito reintroduzido no fonte nunca chega ao que executa, e a conclusão se
> **inverte**. ⚠️ **Asserção COMPORTAMENTAL não se falsifica por execução** — mutation testing está
> fora da stack por decisão de 2026-08-16; o que se exige é a declaração de qual asserção
> discrimina, registrada caso a caso.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | Cada empresa tem Aviso entregue dentro da própria Janela | CT-1057, CT-1080 |
| CA-02 | Falha de uma empresa não impede as demais, e fica registrada | CT-1076, CT-1077, CT-1078, CT-1084, CT-1089 |
| CA-03 | Rotina parada além do limiar avisa o Master, nomeando qual | CT-1059, CT-1074, CT-1086, CT-1090 |
| CA-04 | Instalação repetível, sem entrada duplicada | CT-1060 |
| CA-05 | Contrato vencido com imóvel: encerra e libera no mesmo ato | CT-1061, CT-1063, CT-1064, CT-1069 |
| CA-06 | Contrato vencido sem imóvel permanece valendo, com o motivo | CT-1066 |
| CA-07 | Contrato cuja data de fim não chegou permanece valendo | CT-1063, CT-1065 |
| CA-08 | Contrato já encerrado não é tocado | CT-1063, CT-1065 |
| CA-09 | Segunda passagem no mesmo dia produz o mesmo resultado | CT-1061, CT-1067 |
| CA-10 | Indisponibilidade **atrasa**, não perde a execução | CT-1057, CT-1058 |
| CA-11 | Passagem sem trabalho não grava registro | CT-1067, CT-1083 |
| CA-12 | Passagem com efeito grava **um** registro, em vocabulário do produto | CT-1070, CT-1071, CT-1082 |
| CA-13 | Registro com mais de 90 dias deixa de existir | CT-1061, CT-1062, CT-1072, CT-1075, CT-1088, CT-1089 |
| CA-14 | Admin consulta o estado das rotinas da própria empresa | CT-1074, CT-1090, CT-1091, CT-1093, CT-1094, CT-1095 |
| CA-15 | Admin de outra empresa não alcança nenhum registro da primeira | CT-1073, CT-1082, CT-1092, CT-1094 |
| CA-16 | Entrega desabilitada: a conferência diária continua descobrindo | CT-1085 |
| CA-17 | Empresa suspensa não executa rotina alguma | CT-1075 |
| CA-18 | Reativação põe em dia **uma vez**, sem Aviso retroativo | CT-1081 |
| CA-19 | Admin sabe que os Avisos pararam por limite do provedor | CT-1093 |
| CA-20 | Notícia retida é reprocessada e o efeito é registrado | CT-1079 |
| CA-21 | Boleto guardado fora do prazo deixa de ocupar espaço | CT-1062, CT-1087, CT-1088 |
| CA-22 | Execução em curso impede a segunda da mesma rotina/empresa | CT-1068, CT-1078 |
| CA-23 | As rotinas voltam sozinhas após reinício | CT-1060 |
| CA-24 | Cobrança fica vencida **sem que rotina alguma passe por ela** | CT-1096 |
| — (RD-20) | Imóvel `INDISPONIVEL` tem a situação preservada no encerramento | CT-1097 |

**Verificação mecânica**: os **24 CAs** têm ao menos um CT. Nenhum CT órfão — o `CT-1097` sustenta a
**RD-20**, regra técnica sem CA de origem (achado do challenge), e está declarado como tal. Nenhum
identificador pulado (CT-1057 a CT-1097, sequência contínua). Cada CT aparece em **um** arquivo-alvo — a regra de
deduplicação está satisfeita e sobrevive à distribuição em tasks.

---

### 19.1 Testes Unitários

#### Infraestrutura: unidades systemd e instalador (`packages/shared/test/unidades-agendadas.spec.ts` — **novo**)

Mock: nenhum. Fronteira real: **sistema de arquivos** (`fs` sobre `deploy/systemd/` e sobre o fonte
do instalador). Nenhuma suíte do repositório lê `deploy/systemd/` hoje.

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|------|--------------------------|
| CT-1057 | Fuso declarado e horário igual à cadência declarada | CA-01, CA-10 | Cada `.timer` tem **uma** linha `OnCalendar=` terminada em `America/Sao_Paulo`, e o horário é o mesmo que `CADENCIA_DA_ROTINA` declara — as duas declarações nunca divergem. ⚠️ A cobertura é **de conjunto nos dois sentidos**: seis unidades, seis entradas no mapa | os 6 `.timer` + o mapa de **6** entradas | `semFuso` é `[]` e `divergenciasDeHorario` é `[]`; `Object.keys(CADENCIA_DA_ROTINA)` é **igual como conjunto** ao dos 6 `.timer`; 6 arquivos examinados (controle antivácuo) | — | — |
| CT-1058 | `Persistent=true` só nas diárias | CA-10 | O conjunto de timers com `Persistent=true` é **exatamente** o das cadências `DIARIA`; a de minuto não o declara | os 6 `.timer` + o mapa de cadência | `persistentesIndevidos` e `diariasSemPersistent` são `[]`; igualdade nos dois sentidos | — | — |
| CT-1059 | `OnFailure=` nomeia a rotina; `oneshot` sem `Restart=` | CA-03 | Todo `.service` é `Type=oneshot`, declara `OnFailure=sysloc-alerta-de-rotina@%n.service` e **nenhum** `Restart=`; a unidade-modelo interpola `%i` | os 7 arquivos de serviço | `semOnFailure`, `comRestart` e `naoOneshot` são `[]`; `%i` presente no modelo | — | — |
| CT-1060 | Instalador cobre os 13, habilita só `.timer`, sem credencial | CA-04, CA-23 | O array `UNIDADES` é **igual como conjunto** ao diretório; o laço só habilita `*.timer`; todo `.timer` tem `WantedBy=timers.target`; nenhuma unidade contém segredo | fonte do instalador + as 13 unidades | os 4 achados são `[]`; **controle positivo** da varredura devolve as 4 agulhas plantadas | — | — |

#### Fonte do tempo: nenhuma decisão de negócio lê o relógio do processo

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|------|--------------------------|
| CT-1061 | `@sysloc/db` novo não lê o relógio do processo — estende `packages/db/test/fonte-unica-do-estado.spec.ts` | CA-05, CA-09, CA-13 | `encerramento-de-contratos.ts` e `execucao-de-rotina.ts` não contêm `new Date(`, `Date.now(`, `getHours(` nem `getTime(` em posição executável (ADR-0026) | os 2 fontes, sem comentários | `ocorrencias` é `[]`; controle positivo devolve **4** ocorrências, uma por agulha | — | Importa `semComentarios`/`varrerArquivos` de `packages/db/test/varredura-de-fontes.ts` — acessório da casa, não se copia |
| CT-1062 | `apps/worker` novo não deriva "hoje" do processo — estende `apps/worker/test/ambiente.spec.ts` | CA-13, CA-21 | Idem para `despachante.ts`, `rotina-agendada.ts` e `manutencao-do-acervo.ts`, fora da medição de duração declarada — e a **lista de exceções aceitas é ela mesma asserida** | os 3 fontes, sem comentários | `ocorrencias` fora da exceção é `[]`; a lista de exceções é igual à declarada | — | Reusa o molde do `CT-612` já instalado na suíte |

#### Contrato: filas e roster publicado

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|------|--------------------------|
| CT-1089 | Definição única das filas; a carga da manutenção **recusa** `empresaId` — estende `packages/shared/test/fila.spec.ts` | CA-02, CA-13 | Uma definição por símbolo; `CargaDaRotinaAgendada` exige `empresaId` UUID e `rotina` da união fechada; `CargaDaManutencaoDoAcervo` é `z.strictObject({})` e recusa `{ empresaId }` | fonte de `fila.ts` + cargas de teste | contagem exata `1` por símbolo; `unrecognized_keys` com `keys === ['empresaId']`; `safeParse({})` aceita | — | — |
| CT-1090 | Roster, cadência, limiar e impedimentos fechados e **mutuamente cobertos** — estende `packages/contracts/test/esquemas.spec.ts` | CA-03, CA-14 | `CADENCIA_DA_ROTINA` tem **6** entradas; `ROTINAS_PUBLICADAS` é **derivado** dela pelo filtro `publicada` e tem **3**; a diferença é **nomeada por igualdade de conjunto** (`{VIGILANCIA_DAS_ROTINAS, MANUTENCAO, RETOMADA_DE_NOTICIAS}`); cadência e limiar se cobrem; e a **saída é aberta** | os 4 conjuntos + resposta de exemplo | 6 e 3 exatos, não vazios; a diferença é **exatamente** as 3 de manutenção; `codigo`/`rotina` inventados falham com `invalid_value` no `path` exato; campo extra na saída é **aceito** | — | — |

---

### 19.2 Testes de Integração

#### Domínio novo: encerramento de contrato vencido (`packages/db/test/encerramento-de-contratos.spec.ts` — **novo**)

Setup: `bancoEfemero()` de `packages/db/test/banco-efemero.ts` (**importar, não copiar**), migrações
aplicadas, empresa semeada, golden `encerrar-contratos-vencidos.json` carregado. Todas as escritas
correm pela unidade de trabalho do escritor único — nunca `SET app.empresa_id` cru por fora.

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1063 | Encerra e libera no mesmo ato, contra o oráculo | CA-05, CA-07, CA-08 | Contrato `ATIVO` com `data_fim_locacao < data_corrente_da_operacao()` passa a `ENCERRADO` e o imóvel a `DISPONIVEL`, na mesma transação | semear os 3 contratos representáveis do golden → chamar → reler | comparação **campo a campo** com o `estado_resultante`; retorno exatamente `{candidatos:1, encerrados:1, ignorados:0}`, com a divergência frente ao golden (`total_candidatos: 2`) afirmada e justificada pela §21.2 | Unidade de trabalho do escritor único, molde de `packages/db/test/contrato.spec.ts` |
| CT-1064 | Falha na liberação **desfaz** o encerramento | CA-05 | Falha da segunda escrita desfaz o `UPDATE` do contrato: nenhum contrato `ENCERRADO` com imóvel `LOCADO` (RD-03) | pôr o imóvel em estado que o banco recusa → chamar → capturar rejeição | após o `ROLLBACK`, releitura em **conexão nova** devolve `ATIVO`/`LOCADO`; contagem de `ENCERRADO` é `0`; o `code` do erro é do Postgres | Falha provocada pelo **boundary real** (restrição do banco) — nunca flag nem ramo `se estiverTestando` |
| CT-1065 | Tabela dos **não-candidatos** | CA-07, CA-08 | Nada fora do predicado é alcançado — nem o contrato nem o `status_locacao` do imóvel mudam | `it.each` de 4 linhas (data futura, data nula, encerrado, cancelado) + controle positivo | 4 linhas devolvem zeros com estado **literalmente idêntico** ao semeado; a 5ª devolve `{1,1,0}` | Semeadura sob contexto pela unidade de trabalho |
| CT-1066 | Contrato sem imóvel é **irrepresentável** | CA-06 | `imovel_id` é `NOT NULL`: a inserção é recusada com `23502`, e o motivo `contrato_sem_imovel` do oráculo não é alcançável | controle positivo com `imovel_id` preenchido → `INSERT` com `NULL` | `code === '23502'`, `column_name === 'imovel_id'`; `count(*) WHERE imovel_id IS NULL` é `0` | Contexto de tenant aberto, para que a recusa seja a da coluna e não a da política — discriminador de `isolamento.spec.ts` |
| **CT-1097** | Imóvel `INDISPONIVEL`: encerra o contrato e **preserva** a situação | — (RD-20) | O par `INDISPONIVEL` + contrato `ATIVO` é legítimo; encerrar **não** o converte em `DISPONIVEL` | 3 contratos vencidos: imóveis `LOCADO`, `INDISPONIVEL` e `LOCADO` | os 3 contratos ficam `ENCERRADO`; o `LOCADO` vira `DISPONIVEL`; **o `INDISPONIVEL` permanece `INDISPONIVEL`, por igualdade literal**; resumo `{candidatos:3, encerrados:3, preservados:1}` | Semeadura sob contexto; a situação `INDISPONIVEL` é posta pelo caminho real (`definirSituacaoDeLocacao`), nunca por `UPDATE` cru |
| CT-1067 | Idempotência por predicado, **sem segundo registro** | CA-09, CA-11 | Segunda passagem no mesmo dia produz estado idêntico, devolve zeros, e o número de linhas de registro permanece `1` | passagem 1 → capturar estado e `ocorrida_em` → passagem 2 | estado igual campo a campo; segunda devolve `{0,0,0}`; `count(*)` da rotina é `1` com `ocorrida_em` inalterado | Duas unidades sucessivas, mesmo `empresaId` |
| CT-1068 | Duas passagens **concorrentes**: `SKIP LOCKED` | CA-22 | Soma de `encerrados` das duas é exatamente o número de candidatos; nenhum contrato encerrado duas vezes; no máximo uma linha de registro | 4 candidatos → A abre → **sondar `pg_stat_activity` até confirmar a sobreposição** → B | `encerradosDeA + encerradosDeB === 4`; nenhuma duplicidade; `count(*)` da rotina é `1`; a sobreposição é **afirmada**, não presumida | Molde do `CT-407`: duas conexões dedicadas, sondagem com limite em constante nomeada |
| CT-1069 | Sem janela de `DISPONIVEL` com contrato vigente | CA-05 | A ordem contrato→imóvel libera a posição do `contrato_imovel_vigente_uidx` antes de tocar o imóvel | encerramento e ativação do mesmo imóvel, sobrepostos | a consulta de pares inconsistentes devolve `0` **em todos os desfechos**; se recusada, `23505` nomeando o índice | Mesmo molde de sondagem do CT-1068 |

> ⚠️ **CT-1069 mede o agravamento declarado do `D44 · F2/T10`** — esta fatia cria o **terceiro**
> escritor do par contrato-vigente / situação-do-imóvel, e o débito **não fecha aqui** (§21.3). Este
> caso é a rede possível enquanto a restrição de banco não existir.

#### Registro de execução (`packages/db/test/execucao-de-rotina.spec.ts` — **novo**)

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1070 | Grava **um** registro, com o resumo preservado | CA-12 | A linha nasce com o `empresa_id` do **contexto** (não de parâmetro), `ocorrida_em` do `now()` do banco, e `resumo` recuperável como o mesmo objeto | `it.each` de um resumo por rotina (o de aviso com os campos de `ResultadoDaRegua`) → gravar → reler | 3 linhas; `resumo` **profundamente igual**; `empresa_id` do contexto; `ocorrida_em` no intervalo medido pelo banco; enum com **exatamente** os 3 valores por `pg_enum` | Chamar sem passar identificador de empresa — a asserção é que a linha nasceu com o do contexto |
| CT-1071 | O banco recusa resumo que não é objeto JSON | CA-12 | `CHECK (jsonb_typeof(resumo) = 'object')` recusa array, número, cadeia, booleano e `null` | controle positivo `{}` → 6 valores recusados | `code === '23514'` com `execucao_de_rotina_resumo_chk`; `count(*)` final é exatamente `1` | Contexto aberto, para que a recusa seja a da `CHECK` e não a da política |
| CT-1072 | Expurgo de 90 dias, medido contra o relógio do **banco** | CA-13 | Remove `ocorrida_em < now() - make_interval(days => 90)` da empresa do contexto, e o corte é **estritamente** menor | 5 idades de borda em A (91, 90, 90−1s, 89, 0) + 1 vencida em B | `removidos === 1`; 4 sobreviventes; **a linha de 120 dias de B permanece** — o expurgo não atravessa tenant | Idades semeadas com `now() - make_interval(...)` **no SQL**, nunca em JavaScript |
| CT-1074 | `atrasada` e `proximaEsperada` derivadas **no banco** | CA-03, CA-14 | `atrasada` é comparação com `LIMIAR_DE_ATRASO_POR_CADENCIA` na mesma consulta que lê a última execução; rotina sem execução só é atrasada se a empresa existe há mais que o limiar | `it.each` de 5 linhas cruzando cadência, idade da execução e idade da empresa | `atrasada` é exatamente `[false,true,false,true,false]`; o roster devolvido é igual a `ROTINAS_PUBLICADAS`, com nulos onde nunca executou | Os esperados vêm de **`@sysloc/contracts`**, não são literais do teste |

#### Isolamento (estende `packages/db/test/isolamento.spec.ts`)

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1073 | *(ver 19.4 — caso de segurança)* | CA-15 | — | — | — | — |

#### Composição raiz: o despachante (`apps/worker/test/despachante.spec.ts` — **novo**)

Setup: banco e Redis efêmeros pelos acessórios da casa; consumidores reais registrados pela fiação
de `main.ts`; espera **sempre** por sondagem com limite em constante nomeada — nunca pausa fixa.

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1075 | **A enumeração é o filtro**: suspensa não gera tarefa | CA-17, CA-13 | O conjunto de `empresaId` enfileirados é igual ao das empresas com `suspensa_em IS NULL` | `it.each` sobre as 5 formas de despacho, com A ativa, B suspensa, C ativa | conjunto **exatamente** `{A, C}` em todas; **o total é `2`**, não 3 com uma descartada depois; na linha `manutencao`, 1 tarefa de carga profundamente igual a `{}` | `listarEmpresasAtivas(tx)` pela unidade **sem** `empresaId` — molde de `roteamento-sem-contexto.spec.ts` |
| CT-1076 | Falha isolada, nomeando a empresa | CA-02 | A falha da tarefa de B deixa A e C concluídas, e a razão carrega o `empresaId` de B | 3 empresas, B em estado de domínio defeituoso | concluídas exatamente `{A, C}`; falhadas `{B}`; **o efeito de domínio de A e C está no banco**; tentativas lidas de `OPCOES_PADRAO_DA_TAREFA`, não literal | Falha pelo **estado de domínio** de B, nunca por flag no consumidor |
| CT-1077 | Partida recusada não enfileira **nada** | CA-02 | Variável ausente/mal formada e rotina desconhecida terminam com código ≠ 0, nomeando o que faltou, sem publicar tarefa e sem imprimir valor | 6 linhas inválidas + controle positivo | código ≠ 0 (e `2` na rotina desconhecida); contagem de tarefas em **todas** as filas é `0`; varredura de segredo devolve `[]` com controle positivo | Ponto de entrada como **subprocesso real**, por `packages/shared/test/cenario-subprocesso.ts` — sem extrair ramo de teste |
| CT-1078 | Sem `jobId` determinístico: duas execuções, duas tarefas | CA-02, CA-22 | Execuções consecutivas publicam tarefas distintas; nenhuma é recusada pelo conjunto de retenção | executar → consumir e sondar até terminal → executar de novo | exatamente `2` tarefas com identificadores **diferentes**; segunda sai `0`; perna estática: `0` ocorrências de `jobId` | Consumir a primeira pela fila real antes da segunda; nunca manipular o conjunto de retenção |
| CT-1079 | Retomada das notícias em `RECEBIDO`, carga **sem empresa** | CA-20 | Reenfileira exatamente as `RECEBIDO` mais antigas que a folga, com carga `{ notificacaoId }` | 5 notícias cruzando desfecho e idade | conjunto exatamente o das 2 `RECEBIDO` vencidas; **`Object.keys(carga) === ['notificacaoId']`** | `listarNaoTratadas(tx, folga)` **sem** contexto — `plataforma` não tem política de tenant |
| CT-1080 | Duas janelas opostas no **mesmo** disparo | CA-01 | O despachante enfileira para as duas; a régua entrega só à que está dentro da janela | derivar as janelas da hora corrente **do banco** → disparar → consumir | 2 tarefas (o disparo **não** discrimina); destinatários exatamente os de A; contagem de `envio_de_cobranca` sob B **idêntica** à de antes; **as duas tarefas concluem** | Janelas derivadas de `lerHoraCorrenteDaOperacao`; nunca `vi.setSystemTime` |
| CT-1081 | Reativação põe em dia **uma vez**, sem Aviso retroativo | CA-18 | A reativação não contorna a não retroatividade, que é do predicado da régua | disparo com suspensa → reativar → encerramento → repetir → aviso com **janela aberta** | `0` tarefas na suspensa; encerramento `{1,1,0}` e o seguinte `{0,0,0}`; **`0` destinatários** para as cobranças do período suspenso | Reativar por `EmpresaService.reativar`, já entregue na F4 |

> ⚠️ **CT-1081 é a história mais cara de errar.** O produto usa **remetente único de e-mail**: a
> reação de spam de um Locatário atinge todos os clientes. A asserção que discrimina é a contagem
> `0` de entregas retroativas **com a janela aberta** — com a janela fechada o caso passaria por
> outro motivo.

#### Consumidor das rotinas por empresa (`apps/worker/test/rotina-agendada.spec.ts` — **novo**)

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1082 | Contexto nasce da **carga**, uma vez, na borda | CA-12, CA-15 | Com a carga de B, o efeito ocorre exclusivamente em B; o registro nasce com o `empresa_id` de B | publicar **uma** tarefa com a carga de B na fila real | B encerrado/liberado; **A idêntico ao de antes**; exatamente 1 linha, com `empresa_id` de B | Entrada pela **fila real** (não chamada direta) — é o que faz o caso provar o *caminho* da ADR-0024. O teste **não** fixa `app.empresa_id` por fora |
| CT-1083 | Passagem sem trabalho **não deixa registro** | CA-11 | Para as 4 rotinas, o predicado de efeito falso ⇒ tarefa concluída e nenhuma linha gravada | empresa sem trabalho → 4 tarefas → controle positivo | `count(*)` é **exatamente `0`** e as 4 concluem; controle positivo grava exatamente `1` | Publicar na fila real; a borda abre o contexto |
| CT-1084 | Carga inválida falha nomeando o campo | CA-02 | Carga fora de `CargaDaRotinaAgendada` falha com o nome do campo, sem efeito e sem abrir contexto | 5 cargas inválidas + controle positivo, com trabalho disponível | 5 falhadas com o campo na razão; contagens cruas inalteradas; controle positivo conclui e produz o efeito | Semear trabalho **antes**, para que "nada aconteceu" seja informativo |
| CT-1085 | Entrega desabilitada: a conferência **continua** descobrindo | CA-16 | A conferência não depende da entrega; o resumo traz `liquidacoesDescobertas` igual ao apurado | empresa com entrega DESABILITADA e 2 liquidações no provedor | tarefa **conclui**; as 2 cobranças ganham o **fato** da liquidação e passam a derivar `PAGA`; resumo profundamente igual a `{liquidacoesDescobertas: 2}`; a entrega **permanece** desabilitada | Porta bancária injetada **por parâmetro** na composição (ADR-0025) — nunca `if (teste)` no consumidor |
| CT-1086 | A vigilância alerta a **parada**, e cala sobre as em dia | CA-03 | Uma linha `error` por rotina atrasada, com `empresaId`, `rotina`, `ultimaExecucao` e `limiarMinutos`; nenhuma para rotina dentro do limiar | 3 registros cruzando os dois limiares | exatamente 1 linha `error`, com `rotina === 'AVISO_DE_COBRANCA'` e `limiarMinutos === 15` **lido do contrato**; conjunto de rotinas alertadas igual a `{AVISO_DE_COBRANCA}`; **nenhuma linha nova de registro** | Capturar o fluxo de saída do Pino pela composição — nunca `vi.spyOn` sobre o módulo de registro |

> ⚠️ **CT-1059 e CT-1086 são as duas metades do CA-03, e nenhuma substitui a outra** (decisão D5): o
> `OnFailure=` cobre a unidade que **falhou**; a vigilância cobre a rotina que **não executou** — e
> para essa o supervisor não produz evento algum.

#### Manutenção sem tenant e guarda de boletos

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-1087 | Expurgo dos boletos por idade, com contenção — estende `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` | CA-21 | Remove só o que excede a retenção sob a base conferida, tolera ausente, e **nunca alcança caminho fora da base** | 3 idades (91, 90, 89) + travessia + ligação simbólica | `removidos === 1`; remanescentes exatamente `{90d, 89d}`; **o arquivo fora da base continua existindo**; `ErroDeBoletoForaDaGuarda` na travessia; 2ª chamada devolve `0` sem levantar | `fs.utimes` no **arranjo** (o arranjo pode ler o relógio; o SUT não); diretório-base por parâmetro |
| CT-1088 | Manutenção sem tenant **reusa** o expurgo existente (`apps/worker/test/manutencao-do-acervo.spec.ts` — **novo**) | CA-13, CA-21 | Notícias cruas vencidas removidas sem contexto de tenant (ADR-0031), e o expurgo deixa de depender do tráfego de notícias | carga `{}` na fila da manutenção, com 3 notícias e 1 boleto vencido | notícia de 91d removida, as de 90d e 1d permanecem; o boleto vencido some **na mesma passagem**; perna estática acha a chamada a `expurgarNotificacoesVencidas` e `0` reimplementações do corte | Consumidor abre a unidade **sem** `empresaId`; nunca fixar `app.empresa_id` "para facilitar" |
| CT-1096 | **Rede antirregressão da RN-14** — estende `packages/db/test/derivacao-de-cobranca.spec.ts` | CA-24 | Cobrança vencida é lida como `VENCIDA` **sem que rotina alguma tenha executado**, e nenhum fonte da fatia escreve estado de cobrança ou mora | semear 2 cobranças → afirmar `0` registros **antes** → ler a derivação | `count(*) FROM negocio.execucao_de_rotina === 0`; `VENCIDA`/`A_VENCER` por igualdade literal; varredura dos 5 fontes devolve `[]` | Ler na **mesma** unidade, sem publicar tarefa; a asserção de `0` registros **antes** é o que torna o "sem rotina" verificável em vez de presumido |

> ⚠️ **CT-1096 endereça o risco R3 de probabilidade ALTA da §20**: as duas rotinas mortas por
> desenho são convite permanente a "corrigir a lacuna". O ponto de produção recebe marcador
> **`DECISÃO FECHADA`** com `REVERTER EXIGE` citando a **ADR-0022**.

---

### 19.3 Testes End-to-End (E2E)

#### Fluxo: a leitura do estado das rotinas (CT-1091)

- **Framework**: HTTP black-box sobre a aplicação Nest/Fastify instrumentada, em porta dinâmica
  (`apps/api/test/aplicacao-instrumentada.ts`). Arquivo novo `apps/api/test/rotinas-agendadas.e2e.spec.ts`.
- **CA**: CA-14
- **Objetivo**: a rota devolve uma entrada por rotina do roster publicado; a empresa sem passagem
  alguma recebe `200` com nulos — **nunca `404`** —, e a leitura **não cria linha**.
- **Pré-condições**: empresa A com registros em 1 das 3 rotinas; empresa C recém-admitida sem
  nenhum; sessões montadas por `entrar`/`conceder` de `acessorios-de-borda.ts` (**importar, nunca
  redeclarar** — o `D40 · F5/T9` existe porque uma suíte tem duas formas de falar HTTP).
- **Passos**: (1) Admin de A pede a rota; (2) afirma `200` e que `itens.map(r => r.rotina)` é
  **igual** a `ROTINAS_PUBLICADAS`, campo a campo, com `historicoRecente` em ordem decrescente;
  (3) Admin de C repete.
- **Validações**: para A, `ultimaExecucao` em ISO-8601 UTC igual ao gravado e `resumo` profundamente
  igual; para C, `ultimaExecucao === null`, `resumo === null`, `historicoRecente === []`, e
  `count(*)` sob C **permanece `0` depois da leitura**. Comparação **campo a campo, nunca por
  snapshot**.

#### Fluxo: os impedimentos que o Admin pode resolver (CT-1093)

- **Framework**: idem. **CA**: CA-19, CA-14. Cobre **US-02** e **US-11**.
- **Objetivo**: `impedimento` é derivado de **fato já gravado** — política desligada, recusas
  recentes em `envio_de_cobranca`, certificado ausente ou vencido — e é `null` quando nada impede.
- **Pré-condições**: uma empresa por linha de cenário, com a sessão do Admin dela. Cada estado é
  montado pela **escrita real** do produto (`semearPoliticaDeAviso`, `par-do-provedor.ts`, gravação
  de `envio_de_cobranca` com desfecho de recusa) — nunca fabricando o impedimento.
- **Passos**: `it.each` de 4 linhas — `REGUA_DESLIGADA`, `AVISOS_RECUSADOS_PELO_PROVEDOR`,
  `INTEGRACAO_BANCARIA_PENDENTE` e a **linha de controle** em que nada impede.
- **Validações**: o `codigo` por igualdade literal e a pertinência a `CODIGOS_DE_IMPEDIMENTO`
  (**valor vindo do contrato**); `mensagem` não vazia, com varredura por vocabulário de processo
  devolvendo `[]` (RD-19 e ADR-0034); e na linha de controle, `impedimento === null` nas três
  rotinas. **A linha de controle é obrigatória** — sem ela, um serviço que sempre devolve
  impedimento passaria.

#### Fluxo: a âncora de superfície (CT-1095)

- **Framework**: estende `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`. **CA**: CA-14.
- **Objetivo**: `105 → 106` rotas, `90 → 91` manipuladores, `publicas` inalterado em **20**.
- **Passos**: (1) **refazer a medição do zero** pelas duas medições independentes do `CT-1038` —
  não derivar um número do outro; (2) afirmar **primeiro** a igualdade entre os dois eixos, à parte
  do valor esperado; (3) afirmar que `publicas` é o **mesmo conjunto** de antes e que o par novo
  consta no eixo **não-público**.
- **Validações**: as duas medições concordam; as três constantes por igualdade; nenhuma medição
  devolve conjunto vazio (controle antivácuo).

> ⚠️ A elevação das constantes exige a linha **`SUT_IS_CORRECT_BECAUSE:`** (P5 do Protocolo
> Antirregressão) — sem ela é **fraude de gate**. E a âncora sobe **no mesmo diff** da publicação
> (`.claude/rules/ancoras-de-superficie.md`). **Os números da §4.1 são expectativa; a fonte é a
> medição refeita.**

---

### 19.4 Cenários de Erro e Segurança

#### Segurança — casos por extenso

| CT | Cenário | CA | Objetivo (invariante) | Trigger | Status / Log Esperado |
|----|---------|----|----------------------|---------|------------------------|
| CT-1073 | Isolamento do histórico é da **política**, não de um `WHERE` — estende `packages/db/test/isolamento.spec.ts` | CA-15 | Sob o contexto de B, nenhuma linha de A é legível, atualizável ou removível; `INSERT` cruzado é recusado pelo `WITH CHECK`; e `relrowsecurity` **e** `relforcerowsecurity` são verdadeiros | 3 registros em A; sob B: `SELECT`/`UPDATE`/`DELETE`/`INSERT` cruzados e leitura com contexto **nulo** | `SELECT` → 0 linhas; `UPDATE`/`DELETE` → 0 afetadas; `INSERT` → `42501` com `row-level security policy`; contexto nulo → 0 linhas; política `execucao_de_rotina_isolamento_empresa` existe pelo nome exato. **Controle positivo sob A devolve as 3 linhas** — sem ele, tabela inexistente produziria os mesmos zeros. Conexão do papel `sysloc_app`, **nunca** `conexaoSuperusuaria` |
| CT-1092 | Admin de outra empresa não alcança, e a rota **não aceita `empresaId` de fora** | CA-15 | O alcance vem da sessão e da política de linha, nunca do pedido | sessão de B pedindo `?empresaId=<A>` e `?empresa_id=<A>` | corpos **iguais por comparação profunda** ao pedido sem parâmetro; todos os `historicoRecente` são `[]`; **interseção vazia** com os instantes de A. Controle positivo sob A mostra os 3 |
| CT-1094 | `401` sem sessão, `403` sem a área — **envelope inteiro** | CA-14, CA-15 | O corpo de erro é comparado por igualdade profunda, nunca por presença de campo (ADR-0017) | sem cookie; sessão válida **sem** a concessão; cookie forjado | `401` com `{codigo:'NAO_AUTENTICADO', mensagem}`; `403` com `{codigo:'ACESSO_NEGADO', mensagem, detalhes:{exigido:'TELA:automacao_de_cobranca'}}`; forjado → `401`; **nenhum corpo de erro contém identificador de empresa**. Controle positivo separa "403 por falta de área" de "403 porque a rota quebrou" |

#### Demais cenários de erro — referência cruzada

Os casos abaixo já estão detalhados em 19.1/19.2 e são listados aqui pelo eixo do **comportamento de
erro** que cobrem. Cada CT continua pertencendo a **um** arquivo-alvo — não há duplicação.

| Cenário | CT | CA | Trigger | Status / Log Esperado |
|---------|----|----|---------|------------------------|
| Falha de uma empresa não contamina as demais | CT-1076 | CA-02 | empresa B em estado de domínio defeituoso | concluídas `{A,C}`, falhada `{B}`, razão nomeia a empresa, efeito de A e C **presente no banco** |
| Partida sem variável de ambiente, ou rotina desconhecida | CT-1077 | CA-02 | 6 partidas inválidas em subprocesso | código ≠ 0 (`2` na rotina desconhecida), nome da variável na saída, **`0` tarefas em toda fila**, varredura de segredo `[]` |
| Carga de tarefa inválida | CT-1084 | CA-02 | 5 cargas fora do esquema | falha nomeando o campo, sem efeito, sem abrir contexto |
| `strictObject({})` recusa `{ empresaId }` na manutenção | CT-1089 | CA-13 | carga com chave desconhecida | `unrecognized_keys` com `keys === ['empresaId']` |
| Restrição `CHECK` do resumo | CT-1071 | CA-12 | 6 valores JSON não-objeto | `23514` com `execucao_de_rotina_resumo_chk`; `count(*)` final `1` |
| Coluna `NOT NULL` do imóvel | CT-1066 | CA-06 | `INSERT` com `imovel_id = NULL` | `23502` nomeando `imovel_id` |
| Atomicidade: falha na segunda escrita | CT-1064 | CA-05 | restrição do banco sobre a linha do imóvel | rollback total, releitura em conexão nova devolve o estado original |
| Concorrência entre passagens | CT-1068, CT-1069 | CA-22, CA-05 | duas transações **comprovadamente** sobrepostas | nenhum efeito duplicado; `23505` no índice de vigência quando a ativação perde |
| `jobId` fixo faria a rotina parar em silêncio | CT-1078 | CA-02, CA-22 | segunda execução com a primeira concluída e retida | duas tarefas distintas, segunda sai `0` |
| Bordas de retenção (o corte é `<`, não `<=`) | CT-1072, CT-1087 | CA-13, CA-21 | idades de 91, 90, 90−1s, 89 e 0 dias | só a de 91 dias sai; a de 90 exatos **permanece** |
| Travessia de caminho no expurgo de boletos | CT-1087 | CA-21 | `../` e ligação simbólica para fora da base | `ErroDeBoletoForaDaGuarda`; **o arquivo fora da base continua existindo** |
| Empresa suspensa | CT-1075, CT-1081 | CA-17, CA-18 | `suspensa_em` preenchido | **nenhuma** tarefa enfileirada; o total é `2`, não 3 com uma descartada |
| Entrega da notícia desabilitada (degradação, não erro) | CT-1085 | CA-16 | entrega DESABILITADA | a tarefa **conclui** e as liquidações são descobertas |
| Fuso ausente na unidade, ou divergente do contrato | CT-1057 | CA-01, CA-10 | cópias defeituosas dos `.timer` | listas de achados de tamanho 1, nomeando o arquivo |
| Credencial em arquivo de unidade | CT-1060 | CA-04 | `Environment=DATABASE_URL=postgres://u:senha@h/d` plantado | achado de tamanho 1; controle positivo devolve as 4 agulhas |

### 19.5 Cenários deliberadamente NÃO cobertos por suíte

| Cenário | Motivo |
|---|---|
| **CA-10 / CA-23, metade operacional** — `reboot` real, timers voltando e o disparo perdido acontecendo | Exige reinício real e `sudo` interativo. A **F0 já provou o molde** (invariante 7); as propriedades que o tornam verdadeiro são provadas por CT-1058 e CT-1060 |
| **CA-04, metade operacional** — rodar `instalar-unidades.sh` duas vezes e auditar `CRIADO`/`JA-OK` | Toca o SO e exige `sudo`. É a razão da decisão (A1) da §16.1: escrever a 11ª cópia do esqueleto `verificar-*.sh` **agravaria o `D9 · F0/T2`** e trocaria uma prova que roda na suíte por uma que exige privilégio |
| `systemd-analyze verify` sobre as 13 unidades | Já é **pré-condição executada pelo próprio instalador**; é passo de rollout, não caso de suíte |
| Carga e desempenho (§12.1) | Teste de carga está **fora da stack** deste projeto e não há coletor de métricas (§13.2) |
| A recursão da vigilância (quem vigia a vigilância) | **Trade-off declarado** da decisão D5 (§10.2): fechar exige observação de fora, que é da F7. Não é lacuna de teste — é escopo declarado fora |
| A restrição de banco do `D44 · F2/T10` | O gatilho literal não disparou (§21.3); o **CT-1069 é a rede possível** enquanto ela não existir |

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Superfície irreversível** — publicar uma leitura insuficiente na última janela antes do congelamento | Média | **Alto** — dívida que o handoff carrega sem correção possível | Saída em **contrato aberto** (`z.object`), o que permite ampliar em vez de acrescentar rota; a forma foi decidida contra a tela que a decisão 31 descreve (última execução, próxima esperada, falhas recentes), todas de horizonte curto, com a retenção de 90 dias limitando o conjunto por construção |
| **Duas fontes de tempo** — o timer usa o fuso do sistema; o domínio usa o banco; hoje acerta por acidente | **Alta** | Alto — a rotina de 00:02 encerraria contrato de ontem na virada | Assimetria explícita (D7), com as **duas** metades: (i) fuso **declarado** em todo `OnCalendar=`, provado por asserção estática; (ii) nenhuma rotina deriva "hoje" do relógio do processo, provado por varredura no molde do `CT-612` |
| **Regressão R3** — as duas rotinas mortas por desenho são convite permanente a "corrigir a lacuna" | **Alta** | Alto — reintroduziria a segunda fonte do estado que a F3 pagou para eliminar | Marcador **`DECISÃO FECHADA`** no ponto do código, com `REVERTER EXIGE` citando a ADR-0022, mais o `CT` que afirma a RN-14 pela outra ponta (cobrança fica vencida sem rotina passar) |
| **`jobId` determinístico como trava** — a forma intuitiva de satisfazer RN-13 | Média | **Alto** — a retenção por contagem manteria o id no conjunto e a rotina pararia **sem que nada falhasse** | Declarado em §9.2 por que não se usa, e a trava de cada rotina é a que já a governa (RD-13) |
| **Pico na volta de indisponibilidade longa** — timers diários acumulados disparam juntos | Média | Médio | O systemd dispara **uma** vez por timer, não N; a fila absorve por concorrência controlada; a régua **não retroage** |
| **A vigilância não se vigia** | Baixa | Médio | **Trade-off declarado** (D5). A falha dela cai no `OnFailure=`; a parada silenciosa exige observação de fora, que é da F7 |
| **`D44 · F2/T10` agravado** — esta fatia cria o **terceiro** escritor do par contrato-vigente / situação-do-imóvel | Certa | Médio | **Não fecha aqui** (D6): o gatilho literal é *"a fatia que criar no banco a restrição"*, e criá-la **não é requisito de nada** que o PRD pede — exigiria o **primeiro gatilho de banco do projeto** (zero em 25 migrações), decisão transversal e candidata a ADR. O que esta fatia faz é nascer com a disciplina certa: as duas pontas na mesma unidade. O agravamento é **anotado na §2 do run-report**, não silenciado |
| **`resumo` como `jsonb` sem esquema no banco** | Média | Baixo | `CHECK (jsonb_typeof(resumo) = 'object')` no banco; a forma por rotina é fechada em Zod na saída; o precedente é `entrega_da_noticia.motivo_diagnostico`, com limites de chaves e de caracteres |
| **11ª cópia do esqueleto de verificação em shell** | Baixa | Baixo | Evitada por decisão (A1, §16.1): a prova é asserção estática em Vitest, e o `D9` **não dispara** |

---

## 21. Observações Técnicas

### 21.1 Os cinco pontos técnicos em aberto do tech-alignment — decididos (A1)

**P1 · Granularidade do artefato de despacho.** Adotado **um executável único que recebe qual rotina
executar**, como **segundo ponto de entrada de `apps/worker`** (`dist/despachante.js <rotina>`) — e
não um workspace novo nem um executável por rotina. Razões: (i) o tech-alignment já observa que o
executável único tende a menos duplicação de composição raiz, e aqui a composição é pequena (banco +
fila), de modo que a legibilidade que o executável-por-rotina compraria é barata de obter com um
`switch` sobre união fechada; (ii) reusar o workspace do worker herda o build, o `package.json`, o
`EnvironmentFile` e o molde de partida que **falha fechado**; (iii) a legibilidade que se perderia
volta pelo nome da unidade systemd, que é por rotina de qualquer forma.

**P2 · Forma do corpo variável do registro.** Adotadas **colunas fixas + `resumo jsonb`**, e não
colunas de contagem por rotina. A alternativa esparsa exigiria migração a cada rotina nova e
publicaria colunas nulas para todas as outras. O precedente direto é
`entrega_da_noticia.motivo_diagnostico`.

**P3 · Onde mora a derivação de "rotina atrasada".** Adotado **`packages/db/src/execucao-de-rotina.ts`,
com a comparação corrida no banco**, na mesma consulta que lê a última execução. Fundamento:
ADR-0026 (o instante que decide vem do banco) e ADR-0023 (a derivação vive no banco quando participa
de seleção — e a vigilância **filtra** as atrasadas). Um lugar, dois consumidores — que é literalmente
o que a decisão D5 pede.

**P4 · Encerramento em massa × índice único parcial de vigência.** Adotada **uma unidade de trabalho
por passagem**, com `FOR UPDATE … SKIP LOCKED` na seleção e o predicado repetido no `UPDATE`. Três
consequências, e a terceira é a que evita trabalho:
- a ordem contrato→imóvel **libera** a posição do `contrato_imovel_vigente_uidx` antes de tocar o
  imóvel, de modo que uma ativação concorrente ou é recusada pelo índice ou ocorre depois — não há
  janela de `DISPONIVEL` com contrato vigente;
- a idempotência (RN-05/CA-09) vem do predicado, como na régua;
- **RN-13/CA-22 é satisfeita sem mecanismo novo.** As alternativas foram consideradas e rejeitadas:
  `jobId` determinístico falha em silêncio contra a retenção por contagem (§9.2); `pg_advisory_lock`
  de sessão amarra uma conexão pela duração da tarefa; uma tabela de trava com índice parcial
  obrigaria a gravar linha **antes** de saber se há trabalho, contrariando a RN-15 frontalmente.
  ⚠️ A leitura de CA-22 fica sendo *"nenhum efeito duplicado e nenhum registro"* — e não *"a segunda
  passagem não é iniciada"*, que nenhuma das alternativas entrega sem custo desproporcional.

**P5 · Vigilância e expurgo compartilham passagem?** **Não** — são rotinas distintas, com timers
distintos. As cadências são opostas (a vigilância precisa ser frequente para alcançar o limiar de 15
min da régua; o expurgo é diário de madrugada) e uni-las obrigaria a mais frequente a arrastar a
outra.

### 21.2 Achado que muda a leitura de uma regra do PRD — RN-02 / CA-06

⚠️ **`negocio.contrato.imovel_id` é `NOT NULL`** desde a migração `0007`. O caso `CTR-…-02` do golden
— contrato vencido **sem imóvel**, ignorado e mantido valendo — **não tem instância possível no
produto novo**. A regra do oráculo captura uma propriedade do esquema do Frappe, não uma decisão de
negócio que se queira preservar.

Decisão adotada **(A1)**: **manter a coluna `NOT NULL`** e honrar a RN-02 **vacuamente**, provando a
irrepresentabilidade em vez de relaxar o esquema. Razões: (i) relaxar a coluna para acomodar o
oráculo tornaria representável um contrato sem imóvel — estado que a F2 fechou por construção e que
nenhuma outra parte do produto sabe tratar; (ii) o PRD §9 diz que *"divergir do golden exige decisão
explícita"*, e esta é a decisão explícita, registrada aqui; (iii) o efeito observável é o mesmo que
o oráculo produz — nenhum contrato sem imóvel é encerrado.

**Rede exigida**: um caso que tenta inserir contrato com `imovel_id` nulo e afirma a recusa do banco
(`23502`), mais a declaração no docblock de `encerrarContratosVencidos` de que o motivo de descarte
`CONTRATO_SEM_IMOVEL` do golden **não é alcançável** — para que a rodada seguinte não "corrija a
lacuna" tornando a coluna anulável. **Isto é candidato a marcador `DECISÃO FECHADA`.**

### 21.3 Débitos com gatilho — o que esta fatia fecha, o que agrava e o que não toca

| Débito | Gatilho | Veredito nesta fatia |
|---|---|---|
| `D26 · F4/T9` (`emissao-e-conciliacao`) — sem expurgo dos boletos guardados | *"a **F5**, que traz o agendamento"* | ✅ **DISPARA E FECHA.** `expurgarBoletosVencidos` na guarda + rotina `MANUTENCAO_DO_ACERVO`. O marcador sai no mesmo commit, e a linha sai do índice do `CLAUDE.md` |
| `D13 · F4/T6` (`webhook-e-carne`) — notícia parada em `RECEBIDO` sem quem a reprocesse | *"a **F5**, que traz o agendamento"* | ✅ **DISPARA E FECHA.** `listarNaoTratadas` + rotina `RETOMADA_DE_NOTICIAS`. Idem quanto ao marcador e ao índice |
| `D44 · F2/T10` — restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao` | *"a fatia que criar **no banco** a restrição"* | ❌ **NÃO dispara** — criar a restrição não é requisito de nada que o PRD pede, e ela exigiria o primeiro gatilho de banco do projeto. ⚠️ **O débito é AGRAVADO** (terceiro escritor do par) e o agravamento vai para a §2 do run-report |
| `D9 · F0/T2` — 10 cópias do esqueleto de `verificar-*.sh` | *"a próxima fatia que escrever um `verificar-*.sh`"* | ❌ **NÃO dispara**, por decisão (A1, §16.1): esta fatia **não escreve** verificador em shell |
| `D26 · F3/T8`, `D14 · F3/T5`, `D25 · F4/T7` — aritmética de calendário e fuso da operação | terceiro/quarto consumidor | ⚠️ **Avaliar na task**: a derivação de `proximaEsperada` e o corte de retenção podem tornar esta fatia o consumidor que dispara. Se disparar, fecha-se; se não, registra-se a contagem medida |
| `D51 · F4/T16` — conferência de forma das variáveis com duas definições | *"a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`"* | ❌ **NÃO dispara** — esta fatia não abre aquele arquivo. O despachante lê **três** variáveis, todas já exigidas por `apps/worker/src/main.ts` |

### 21.4 ADRs Aplicáveis nesta Feature

Inventário sobre as **29 ADRs `accepted`**. As `deprecated` (0002, 0003, 0004) e as `superseded`
(0007, 0012, 0015, 0019) foram ignoradas, como manda o procedimento. Nenhum **conflito spec × ADR**
foi encontrado — as três decisões de maior alcance apoiam-se em ADR vigente e **nenhuma a estende**.

| ADR | Classificação | Conformidade literal (contra o texto da `Decision`) |
|---|---|---|
| **0005** | **APLICÁVEL** | §16.1/§16.3. A `Decision` diz *"toda rotina operacional agendada — a definição de agendamento e os scripts que ela invoca — vive no repositório e é posicionada por procedimento de instalação idempotente… nenhum entra no repositório carregando credencial"*. Os 13 arquivos de unidade vivem em `deploy/systemd/`, são posicionados por `instalar-unidades.sh` (idempotente, `CRIADO`/`JA-OK`), e **nenhum carrega credencial** — os segredos entram por `EnvironmentFile` 0600 |
| **0006** | **APLICÁVEL** | §19. A suíte roda contra instâncias efêmeras próprias (`embedded-postgres`), nunca contra o ambiente que atende a operação |
| **0008** | **APLICÁVEL** | §7.2/§11.2. *"toda tabela de negócio nasce com `empresa_id`, RLS habilitada e FK composta"* — `negocio.execucao_de_rotina` cumpre as três, e a política é nominal com `FORCE` |
| **0009** | **APLICÁVEL** | §11.2. A enumeração lê `identidade.empresa` — *"identidade, sem noção de tenant"* —, e a tabela nova vive em `negocio` |
| **0011** | **APLICÁVEL** | §11.2. A rota declara exigência (`@ExigeChave` herdada da classe), e o catálogo **fechado** não ganha chave nova |
| **0013** | **PARCIAL** | §13.2. A garantia é *"propriedade da sessão"* do operador do SaaS: é por isso que **não há painel dele** e o histórico é do Admin, por empresa |
| **0014** | **PARCIAL** | §7.2. O registro é **fato**, não entidade referenciável — o discriminador da ADR (*"ser referenciável"*) não o alcança, e por isso não há `retirado_em`. Mesmo raciocínio já escrito para `envio_de_cobranca` |
| **0016** | **APLICÁVEL** | §4.2/§15.3. O esquema Zod é a fonte única: conferência, tipo e documento derivam dele |
| **0017** | **APLICÁVEL** (⚠️ ler a **emenda de 2026-08-16**) | §4.1/§10.1. Envelope de erro canônico; a leitura não expõe chave interna — a rotina é identificada pelo **nome canônico do roster**, não por UUID |
| **0018** | **APLICÁVEL** | §11.2. A rota compõe exigência, e a cobertura de autorização confere **conteúdo**, não só existência |
| **0020** | **N/A** | Nenhuma série sequencial nasce aqui |
| **0021** | **APLICÁVEL** (⚠️ ler as **DUAS emendas**; a de **2026-08-22** nomeia esta fatia) | §5.1(b)/§11.2. A metade **categórica** — *"rota própria, nunca um campo gravado por atualização parcial do recurso"* — é cumprida **por construção**: não há recurso sendo editado, e `status` não existe em `esquemaDeContratoNovo` nem em `esquemaDeContratoAlterado`. A metade da **governança** não tem sujeito sem sessão, e o que governa é a **procedência da carga** (ADR-0024). O encerramento é a **instância declarada da terceira classe**, literalmente nomeada na emenda. ⚠️ A emenda **não** fundamenta o encerramento manual pela tela, que segue decisão não tomada (§4.1, §11.2) |
| **0022** | **APLICÁVEL** | §6.3 RD-14. *"o estado publicado de um fato financeiro é derivado dos fatos gravados, nunca uma coluna movida por rotina"* — é a razão de duas rotinas do sistema antigo não terem sucessora, e o ponto ganha marcador `DECISÃO FECHADA` |
| **0023** | **APLICÁVEL** | §21.1 P3. *"a derivação de um valor não persistido vive no banco quando ela participa de seleção — filtro, ordenação, paginação"* — a vigilância **filtra** as atrasadas, e por isso a comparação corre no banco |
| **0024** | **APLICÁVEL** (⚠️ ler as **DUAS emendas**) | §4.3/§5.1/§11.2. A **abertura** — *"estabelece o contexto de tenant a partir da carga do próprio trabalho, uma única vez, na borda que a recebe"* — é o que `processarRotinaAgendada` faz. O identificador é *"produzido por quem já detinha direito a ele: … ou a **enumeração de tenants**"* — que é `listarEmpresasAtivas`. A **enumeração de tenants é a leitura legítima #1**, e *"vive no schema sem noção de tenant"* — `identidade.empresa`. A emenda de **2026-08-18** é o que autoriza a `CargaDaManutencaoDoAcervo` **sem empresa**: não há travessia nem dono a declarar. ⚠️ **Nenhuma terceira leitura sem contexto é criada** — a que responderia *"quais empresas têm candidata"* foi medida e rejeitada (tech-alignment D2) |
| **0025** | **APLICÁVEL** | §3.3/§8. O despachante não compõe porta de e-mail nem de provedor; as portas continuam chegando por parâmetro na composição raiz do worker, sem bandeira que escolha entre operação e verificação |
| **0026** | **APLICÁVEL** | §6.2/§6.3 RD-01/§21.1 P3. *"Toda leitura de tempo que decide comportamento de negócio vem do banco… A aplicação recebe o instante já resolvido, por parâmetro, e a decisão que o consome é pura."* O timer **provoca**; `negocio.data_corrente_da_operacao()` decide |
| **0027** | **N/A** | Nenhuma rota desta fatia dispensa sessão |
| **0028** | **N/A** | Nenhuma rota devolve bytes |
| **0029** | **APLICÁVEL** | §9.1. *"Todo efeito externo cujo resultado não compõe a resposta do pedido… é enfileirado pela borda e executado pelo processo de trabalho, com o contexto de tenant viajando na carga"* — literalmente o desenho do despachante |
| **0030** | **PARCIAL** | §7.5. O boleto guardado está sob a **cláusula de exclusão** (fato recebido de terceiro, não derivado); expurgá-lo por idade não o transforma em derivado |
| **0031** | **APLICÁVEL, e por contraste** | §3.3/§4.3. *"Tabela que não é dado de negócio de nenhuma empresa vive fora do schema de negócio… e não carrega `empresa_id`"* — `execucao_de_rotina` **tem** dono-empresa e por isso vive em `negocio`, **não** é caso desta ADR. E `plataforma.notificacao_bancaria`, que é caso dela, é justamente o alvo sem tenant da manutenção |
| **0032** | **PARCIAL** | §11.3/§11.6. Nada de segredo viaja em carga; o despachante **não** lê a chave de cifra |
| **0033** | **N/A** | Nenhuma série nasce aqui |
| **0034** | **PARCIAL** | §13.1/§6.3 RD-19. Diagnóstico de terceiro que chegue ao `resumo` é registrado como tal, e a trilha fala vocabulário do produto |
| **0035** | **PARCIAL** | §4.3/§5.1. A retomada reenfileira na fila da notícia, **preservando** a ausência de empresa na carga — a empresa é o resultado da travessia nominal |
| **0036** | **N/A** | Material legado do certificado não é tocado |
| **0001, 0010** | **N/A** | Modelo canônico de cobrança e efetivo de permissão não são estendidos |

### 21.5 Candidatos a ADR (FASE 4B — 5 critérios canônicos)

| Decisão candidata | C1 transversal | C2 tag | C3 reversão cara | C4 surpreendente | C5 trade-off real | Veredito |
|---|---|---|---|---|---|---|
| **O gatilho é systemd timer, um por rotina, `Persistent=true` só nas diárias** | ✅ | ✅ `build` | ✅ | ✅ | ✅ | **Candidato a ADR parcial — mas NÃO se registra.** A decisão **já está tomada fora deste pipeline** (decisão 30 refinada, `plano-execucao.md` §F5(ii)) e o tech-alignment a declara *"não reabrir"*. Registrá-la agora seria churn |
| **Ausência de mecanismo genérico de trava; RN-13 pelo mecanismo de cada rotina** (§21.1 P4) | ❌ — é escolha desta fatia, e as três alternativas já são idiomas do repositório | ✅ `concurrency` | ❌ | ✅ | ✅ | **3/5 — candidato parcial.** Falha C1 e C3. Registra-se como decisão técnica em §21.1, com as alternativas nomeadas |
| **O prazo de retenção uniforme de 90 dias** (§7.5) | ⚠️ parcial | ✅ `data` | ❌ (um parâmetro) | ❌ | ✅ | **2/5 — parcial.** Fica como decisão de produto adotada por A1 |
| **Manter `imovel_id` `NOT NULL` e honrar RN-02 vacuamente** (§21.2) | ❌ | ✅ `data` | ✅ | ✅ | ✅ | **4/5 — candidato parcial.** Falha C1: é propriedade de **uma** entidade, decidida na F2. A rede certa é o marcador `DECISÃO FECHADA`, não uma ADR |
| **Liberação condicional do imóvel — RD-20** (achado do challenge) | ❌ — alcança só o par contrato/imóvel | ✅ `data` | ❌ (uma cláusula no `WHERE`) | ✅ | ✅ — a alternativa óbvia (`DISPONIVEL` sempre) é a que apaga a decisão do Admin | **3/5 — parcial.** Fica como RD-20 em §6.3, com o CT-1097 como rede |
| **`CADENCIA_DA_ROTINA` como fonte única das unidades systemd** (achado do challenge) | ❌ — há um só conjunto de unidades no produto | ✅ `build` | ❌ | ✅ | ✅ | **3/5 — parcial.** Fica declarado em §4.2 |

⚠️ **Duas ficam pré-qualificadas caso a condição delas chegue**, e ambas estão nomeadas como
alternativa **rejeitada**, não como proposta: a **travessia nominal de terceira leitura sem
contexto** (tech-alignment D2) e o **primeiro gatilho de banco do projeto** (D6/`D44`). Se qualquer
uma for reaberta, o caminho é `/agent-spec-adr-create` **antes** da implementação, nunca durante.

**Conclusão: nenhuma ADR nova é criada por esta fatia** — o mesmo veredito do tech-alignment,
reconfirmado contra o texto literal das `Decision`, e **mantido depois do challenge de 2026-08-22**:
os dois achados novos falham C1 e C3.

### 21.6 Glossário de domínio — termos novos

✅ **Canonizados e GRAVADOS** na sessão de `/agent-spec-challenge-spec` de 2026-08-22. Dois foram
para o glossário **global** (`docs/specs/domain-glossary.md`) e quatro para o **feature**
(`docs/specs/features/automacoes-agendadas/domain-glossary.md`, criado na sessão):

| Termo canônico | Definição em uma frase | Nível (gravado) |
|---|---|---|
| **Rotina agendada** | O trabalho que o sistema executa sem que ninguém o peça, disparado por relógio do SO, sempre no escopo de uma Empresa — a **Régua de cobrança** é uma delas | **global** ✅ |
| **Passagem** | Uma execução de uma Rotina agendada para uma Empresa, do disparo ao desfecho | **global** ✅ |
| **Registro de execução** | O que uma passagem deixa gravado quando — e só quando — ela produziu efeito | **feature** ✅ |
| **Limiar de atraso** | O tempo de silêncio a partir do qual uma rotina é considerada parada, derivado da cadência dela | **feature** ✅ |
| **Impedimento** | O que impede uma rotina de produzir efeito e está na alçada do Admin Empresa | **feature** ✅ |
| **Despachante** | O processo efêmero que enumera as Empresas ativas e enfileira o trabalho de uma rotina | feature |

⚠️ Os termos **já canônicos** foram usados sem sinônimo: *Empresa*, *Contrato de locação*, *Imóvel*,
*Cobrança*, *Aviso*, *Régua de cobrança*, *Janela de horário*, *Liquidação*, *Notícia do provedor*,
*Entrega da notícia do provedor*, *Provedor*, *Admin Empresa*, *Sysloc Master*, *Locatário*,
*Locador*, *Contrato vigente*, *Desfecho*.

---

### 21.7 Sessão de challenge — 2026-08-22

`/agent-spec-challenge-spec` rodou sobre esta spec e produziu **8 ajustes inline**. Registro do que
mudou, para que a próxima rodada não reabra:

| # | Achado | Resolução |
|---|---|---|
| Q1 | O resumo da régua inventava `avisadas`/`recusadas`, mas `ResultadoDaRegua` já publica `candidatas`/`enviadas`/`falhas`/`semDestinatario` | **Reusar** os campos existentes (§6.2, §6.3 RD-15). Segundo vocabulário para o mesmo fato é o que a RN-19 impede |
| Q2 | Três CTs afirmavam literais **inexistentes**: `EM_ABERTO`, `LIQUIDADA` e `PROCESSADO` | Corrigidos para `A_VENCER`, o **fato** da liquidação (`PAGA` é derivada — ADR-0022) e `APLICADO` |
| Q3 | **Contradição executável**: CT-1057 comparava 6 unidades contra um mapa que o CT-1090 exigia ter 3 | `CADENCIA_DA_ROTINA` passa a ter **6** entradas com `publicada: boolean`; `ROTINAS_PUBLICADAS` é **derivado** por filtro (§4.2) |
| Q4 | Imóvel `INDISPONIVEL` com contrato `ATIVO` é estado **legítimo**, e o encerramento o converteria em `DISPONIVEL`, apagando decisão do Admin | **RD-20**: liberação condicional (`LOCADO → DISPONIVEL` apenas); resumo ganha `preservados`; **CT-1097** novo |
| Q5 | A conferência agendada não tem ator, e a spec não dizia como | `ConferenciaNova.solicitadaPor` **já é** `string \| null`, com o docblock *"ou `null` quando o disparo é do relógio"* — a F4 previu esta fatia (§5.1) |
| Q6 | A `CHECK` seguia a convenção errada (`_check`) | `execucao_de_rotina_resumo_chk` — a convenção do esquema é `_chk`, medida em 6 ocorrências |
| Q7 | O despachante **produz**, e o produtor publicado é privado de `apps/api` | Reusa `conectarFila` do próprio `apps/worker`; produtor próprio seria a **terceira** cópia e dispararia o Limiar de Três (§5.1) |
| Q8 | A §13.4 induzia a esperar `OnFailure=` para falha de **tarefa** | Separados os dois eixos: `OnFailure=` alcança o **despacho**; falha de tarefa é registro do worker (§13.4) |

**Confirmado, não alterado**: a contagem `105 → 106 / 90 → 91` da §4.1 — o `HEAD` derivado do `GET`
**não entra** na medição (o módulo verificado o descarta), de modo que um `GET` novo vale **um** par.
A frase *"o `HEAD` que todo `GET` acrescenta ao roteador"*, no docblock da âncora, é sobre o roteador
cru e **não** sobre o eixo medido — não a leia como se fossem dois pares.

✅ **`_run/test-cases.json` foi corrigido em seguida**, por pedido explícito do usuário — o challenge
não o escreve por guardrail (ele só toca a spec, os glossários, o `workflow-report.md` e o
`steps.validation` do estado). Os dois artefatos estão **em sincronia**: 41 casos, os mesmos
identificadores, os mesmos literais. O JSON carrega um bloco `challenge` com os cinco ajustes
aplicados, e o `task_plan` pode consumi-lo para a distribuição de CTs sem correção prévia.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada (a **medida**, não a planejada — ver a advertência do `CLAUDE.md`)
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-14 mapeadas em 5.3 e em 17)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6) — RN-01 a RN-19 mapeadas em RD-01 a RD-19
- [x] Persistência: tabelas, índices, migrações, transação, retenção (seção 7)
- [x] Integrações externas mapeadas (seção 8) — nenhuma nova
- [x] Sincronização: eventos, idempotência (seção 9)
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13) — métricas e tracing declarados N/A com razão
- [x] Feature flags listadas (seção 14) — N/A com razão
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura: pipeline, empacotamento, IaC, rollout, rollback (seção 16)
- [x] Dependências externas listadas (seção 18) — nenhuma nova
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19, com rastreabilidade CA→CT) — 40 casos, CT-1057 a CT-1096, os 24 CAs cobertos; JSON integral em `_run/test-cases.json`
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21), com inventário de ADRs confrontado **literalmente**
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4–3.7)
