# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: `emissao-e-conciliacao` — fatia (ii) da F4 (integração bancária)
- **Variante**: `backend`
- **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js · PostgreSQL 18 · Zod 4 · BullMQ + ioredis · `node:https` · Vitest + `embedded-postgres`
- **Autor**: sysloc (usuário) · Tech Spec conduzida por `/agent-spec-sdd-generate-tech-spec`
- **Data**: 2026-08-16
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/emissao-e-conciliacao/v1/prd.md` (aprovado em 2026-08-16)
- **Tech Alignment**: `docs/specs/features/emissao-e-conciliacao/v1/tech-alignment.md` (D1–D6, decidido)
- **Design Relacionado**: — (variante `backend` não tem design)

---

## 2. Resumo Técnico da Solução

Nasce a porta que a **ADR-0001** reserva: `AdaptadorCobrancaBancaria`, declarada pelo domínio em
`packages/cobranca-bancaria` e satisfeita por um adaptador Sicoob sobre `node:https` com TLS mútuo.
Sobre ela, quatro atos de negócio — emitir, revogar o boleto, confirmar a revogação e consultar a
situação — sustentam sete rotas novas e dois processos de trabalho: a **emissão em lote por
competência**, enfileirada (ADR-0029), e a **conferência diária**, cuja *regra* é desta fatia e cujo
*gatilho por horário* é da F5.

Quatro tabelas novas em `negocio`, todas com `empresa_id`, RLS forçada e FK composta: a **trilha
bancária** (`evento_bancario`), que registra **efeito e nunca tentativa** (ADR-0034); a **emissão em
lote** com o desfecho por cobrança, que é a prestação de contas da CA-02; e a **conferência**, cujo
índice único parcial é o mecanismo — não a promessa — de que um disparo concorrente não inicia uma
segunda execução.

O estado da cobrança **continua derivado** (ADR-0022): a liquidação reusa `acusarPagamentoDeCobranca`
tal como está, de modo que a mora carimbada pela baixa vinda do provedor é, por construção, a mesma
que a baixa manual carimba (RN-07). Os seis campos de conciliação que nascem nulos desde a F3 ganham
enfim o produtor que lhes faltava.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                      ┌──────────────────────── apps/api (borda HTTP) ─────────────────────────┐
  Admin Empresa ────► │ CobrancaController (+4 rotas)   CobrancaBancariaController (+3 rotas)  │
                      │        │                                   │                          │
                      │  BoletoService              EmissaoEmLoteService  ConferenciaService   │
                      └────────┼───────────────────────────────────┼──────────────────────────┘
                               │ (em linha, ADR-0029)              │ (enfileira, ADR-0029)
                               │                                   ▼
                               │                      ┌──── Redis / BullMQ ────┐
                               │                      │ emissao-em-lote        │
                               │                      │ conferencia-bancaria   │
                               │                      └───────────┬────────────┘
                               │                                  ▼
                               │           ┌──────────── apps/worker ─────────────┐
                               │           │ tarefas/emissao-em-lote.ts           │
                               │           │ tarefas/conferencia-bancaria.ts      │
                               │           │  └─ contextoDeTenant (ADR-0024)      │
                               │           └───────────────┬──────────────────────┘
                               │                           │
              ┌────────────────┴───────────────────────────┴──────────────────┐
              │        packages/cobranca-bancaria  (DOMÍNIO — ADR-0025)        │
              │  porta AdaptadorCobrancaBancaria  ·  modelo canônico           │
              │  executarEmissaoEmLote · reemitirBoleto · conferirCobrancas    │
              └────────────────┬──────────────────────────────────────────────┘
                               │ implementa (dependência aponta PARA o domínio)
                               ▼
              ┌────────────────────────────────────────────────┐
              │  adaptador-sicoob.ts  (node:https, mTLS)        │
              │  credencial de acesso: cache em memória, 300 s  │──► Sicoob
              └────────────────────────────────────────────────┘

     packages/db ──► negocio.cobranca (6 campos) · evento_bancario · emissao_em_lote
                     item_da_emissao_em_lote · conferencia_bancaria · cobranca_derivada (view)

     guarda-de-boletos.ts ──► DIRETORIO_DOS_BOLETOS (bytes; a coluna guarda CAMINHO)
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `AdaptadorCobrancaBancaria` (porta) | Declara as **quatro** operações que o domínio exerce contra o provedor. Nenhum campo, URL ou vocabulário dele a atravessa (ADR-0001). | Domínio |
| `modelo-canonico.ts` (acrescido) | `PedidoDeEmissao`, `BoletoEmitido`, `ConsultaDeSituacao`, `SituacaoConsultada`, `DesfechoDaOperacao<T>`, `ClasseDaFalha`. | Domínio |
| `emissao-em-lote.ts` (`executarEmissaoEmLote`) | Percorre o conjunto em sequência, decide o que interrompe e o que só marca (RN-02), e devolve o desfecho por cobrança. | Domínio |
| `reemissao.ts` (`reemitirBoleto`) | Compõe **um ato só**: revogar → sondar a confirmação → emitir. Nunca deixa dois boletos pagáveis. | Domínio |
| `conferencia.ts` (`conferirCobrancas`) | Aplica o desfecho consultado a cada cobrança e devolve os efeitos. | Domínio |
| `adaptador-sicoob.ts` (estendido) | Satisfaz a porta; traduz o dialeto do provedor; obtém e reaproveita a credencial de acesso **internamente**. | Infraestrutura |
| `guarda-de-boletos.ts` | Grava, lê e apaga os bytes sob `DIRETORIO_DOS_BOLETOS`. A coluna guarda **caminho**. | Infraestrutura |
| `BoletoService` | Emissão unitária/reemissão, entrega do boleto e histórico bancário — em linha. | Aplicação |
| `EmissaoEmLoteService` | Abre o lote, recusa o concorrente e enfileira. | Aplicação |
| `ConferenciaBancariaService` | Abre a conferência, recusa a concorrente e enfileira. | Aplicação |
| `CobrancaController` (estendido) | 4 rotas sobre `:codigo`. | Apresentação |
| `CobrancaBancariaController` | 3 rotas de lote e conferência. | Apresentação |
| `packages/db/src/evento-bancario.ts` etc. | Toda instrução SQL sobre as tabelas novas, publicada como função de domínio. | Dados |
| `apps/worker/src/tarefas/*.ts` | A borda onde o contexto de tenant nasce da carga (ADR-0024). | Borda de tarefa |

### 3.3 Camadas e Fronteiras

Hexagonal por dentro, camadas por fora — como o resto do produto. **A direção da dependência é a da
ADR-0025**: `packages/cobranca-bancaria` declara a porta e os tipos que a atravessam;
`adaptador-sicoob.ts` **importa deles**; a composição raiz (`apps/api/src/main.ts` e
`apps/worker/src/main.ts`) escolhe a implementação e a injeta. A porta chega a quem a usa **por
parâmetro**, nunca por import — é o que faz trocar de banco não tocar uma linha do domínio.

Quatro fronteiras que esta fatia não atravessa, e cada ausência é mecanismo:

1. **Serviço de aplicação não abre unidade de trabalho.** `BoletoService`, `EmissaoEmLoteService` e
   `ConferenciaBancariaService` **não recebem `AcessoAoBanco` no construtor** — tomam o `tx` de quem
   já abriu. Mesma decisão, e mesma razão, de `CobrancaService` e `CertificadoDoProvedorService`.
2. **Serviço não escreve SQL e não compara empresa.** Toda instrução vive em `packages/db/src/`; o
   recorte por empresa é da política do banco (ADR-0008), e a ausência vira `404` num ponto único.
3. **A chamada de rede a terceiro corre FORA de `sql.begin`.** É o achado da T7 de
   `documentos-e-confirmacao`, já aplicado em `CertificadoDoProvedorService`: o que se protege é a
   **conexão física**, que é recurso escasso e compartilhado por todo o produto.
4. **O domínio não lê `process.env` e não lê relógio.** Endereço, tetos e caminho do diretório chegam
   por parâmetro da composição raiz; o instante que decide comportamento vem do banco (ADR-0026).

### 3.4 Visão em Árvore

```
apps/
├── api/
│   ├── src/
│   │   ├── cobrancas/
│   │   │   ├── cobranca.controller.ts                          [M]
│   │   │   ├── cobranca.service.ts                             [R]
│   │   │   ├── cobrancas.module.ts                             [M]
│   │   │   └── boleto.service.ts                               [N]
│   │   ├── cobranca-bancaria/
│   │   │   ├── cobranca-bancaria.controller.ts                 [N]
│   │   │   ├── cobranca-bancaria.module.ts                     [N]
│   │   │   ├── emissao-em-lote.service.ts                      [N]
│   │   │   └── conferencia-bancaria.service.ts                 [N]
│   │   ├── comum/
│   │   │   └── produtor-de-fila.ts                             [M]
│   │   ├── configuracao/
│   │   │   └── ambiente.ts                                     [M]
│   │   ├── integracoes-bancarias/
│   │   │   └── certificado.service.ts                          [R]
│   │   ├── app.module.ts                                       [M]
│   │   └── main.ts                                             [M]
│   ├── test/
│   │   ├── boleto-da-cobranca.e2e.spec.ts                      [N]
│   │   ├── cobranca-bancaria.e2e.spec.ts                       [N]
│   │   ├── historico-bancario.e2e.spec.ts                      [N]
│   │   ├── segredo-nao-escapa.e2e.spec.ts                      [M]
│   │   ├── cobertura-de-autorizacao.e2e.spec.ts                [M]
│   │   ├── recusa-indistinguivel.e2e.spec.ts                   [M]
│   │   ├── autorizacao-do-dominio.e2e.spec.ts                  [M]
│   │   └── contrato-publicado.e2e.spec.ts                      [M]
│   └── vitest.config.ts                                        [M]
└── worker/
    ├── src/
    │   ├── fila.ts                                             [M]
    │   ├── main.ts                                             [M]
    │   └── tarefas/
    │       ├── emissao-em-lote.ts                              [N]
    │       ├── conferencia-bancaria.ts                         [N]
    │       └── regua.ts                                        [R]
    └── test/
        ├── emissao-em-lote.spec.ts                             [N]
        ├── conferencia-bancaria.spec.ts                        [N]
        └── ambiente.spec.ts                                    [M]

packages/
├── cobranca-bancaria/
│   ├── src/
│   │   ├── porta-de-cobranca.ts                                [N]
│   │   ├── modelo-canonico.ts                                  [M]
│   │   ├── adaptador-sicoob.ts                                 [M]
│   │   ├── credencial-de-acesso.ts                             [N]
│   │   ├── emissao-em-lote.ts                                  [N]
│   │   ├── reemissao.ts                                        [N]
│   │   ├── conferencia.ts                                      [N]
│   │   ├── guarda-de-boletos.ts                                [N]
│   │   ├── porta-de-identidade.ts                              [R]
│   │   ├── leitura-do-material.ts                              [R]
│   │   └── index.ts                                            [M]
│   └── test/
│       ├── emissao-em-lote.spec.ts                             [N]
│       ├── reemissao.spec.ts                                   [N]
│       ├── conferencia.spec.ts                                 [N]
│       ├── guarda-de-boletos.spec.ts                           [N]
│       ├── adaptador-sicoob.spec.ts                            [M]
│       └── vocabulario-canonico.spec.ts                        [M]
├── contracts/
│   ├── src/
│   │   ├── cobranca.ts                                         [M]
│   │   ├── cobranca-bancaria.ts                                [N]
│   │   ├── integracao-bancaria.ts                              [R]
│   │   ├── comum.ts                                            [M]
│   │   └── index.ts                                            [M]
│   └── test/
│       └── esquemas.spec.ts                                    [M]
├── db/
│   ├── migracoes/
│   │   ├── 0017_dominio_emissao_e_conciliacao.sql              [N]
│   │   ├── 0018_seguranca_emissao_e_conciliacao.sql            [N]
│   │   ├── 0010_seguranca_cobranca.sql                         [R]
│   │   └── meta/_journal.json                                  [M]
│   ├── src/
│   │   ├── esquema/negocio.ts                                  [M]
│   │   ├── evento-bancario.ts                                  [N]
│   │   ├── emissao-em-lote.ts                                  [N]
│   │   ├── conferencia-bancaria.ts                             [N]
│   │   ├── boleto-da-cobranca.ts                               [N]
│   │   ├── cobranca.ts                                         [M]
│   │   ├── certificado-do-provedor.ts                          [R]
│   │   ├── identificador-bancario.ts                           [R]
│   │   ├── catalogo.ts                                         [R]
│   │   └── index.ts                                            [M]
│   └── test/
│       ├── evento-bancario.spec.ts                             [N]
│       ├── emissao-em-lote.spec.ts                             [N]
│       ├── conferencia-bancaria.spec.ts                        [N]
│       ├── boleto-da-cobranca.spec.ts                          [N]
│       ├── isolamento-bancario.spec.ts                         [N]
│       ├── coerencia-de-migracoes.spec.ts                      [M]
│       └── catalogo.spec.ts                                    [M]
└── shared/
    ├── src/
    │   ├── fila.ts                                             [M]
    │   └── log.ts                                              [R]
    └── test/
        └── fila.spec.ts                                        [M]

deploy/
└── scripts/
    ├── instalacao/
    │   ├── provisionar-base.sh                                 [M]
    │   └── verificar-fundacao.sh                               [R]
    └── cobranca-bancaria/
        └── verificar-guarda-de-boletos.sh                      [N]

.env.example                                                    [M]
docs/adr/0034-trilha-de-integracao-registra-efeito-nao-tentativa.md  [R]
CLAUDE.md                                                       [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/cobranca-bancaria/src/porta-de-cobranca.ts` | A porta `AdaptadorCobrancaBancaria` — quatro operações, todas resolvendo em `DesfechoDaOperacao<T>`. | Domínio |
| `packages/cobranca-bancaria/src/credencial-de-acesso.ts` | Cache em memória por processo, chaveado por empresa, renovado por expiração (D5). **Privado do pacote** — não sai no barril. | Infraestrutura |
| `packages/cobranca-bancaria/src/emissao-em-lote.ts` | `executarEmissaoEmLote` — o percurso em sequência e a distinção RN-02. | Domínio |
| `packages/cobranca-bancaria/src/reemissao.ts` | `reemitirBoleto` — revogar → sondar → emitir, num ato só (D3). | Domínio |
| `packages/cobranca-bancaria/src/conferencia.ts` | `conferirCobrancas` — aplica o desfecho consultado e devolve os efeitos. | Domínio |
| `packages/cobranca-bancaria/src/guarda-de-boletos.ts` | Grava, lê e apaga os bytes sob o diretório-base, que chega **por parâmetro** da composição raiz — o pacote não lê `process.env` (§3.3). O nome do arquivo é **derivado** de `<codigo>.pdf` e o caminho resolvido é conferido contra a base antes de qualquer leitura ou escrita (§11.4). A coluna guarda **caminho**, nunca bytes. | Infraestrutura |
| `packages/contracts/src/cobranca-bancaria.ts` | Esquemas publicados do lote, da conferência e da trilha; enums fechados de tipo de evento e origem. | Contrato |
| `packages/db/src/evento-bancario.ts` | `registrarEventoBancario`, `lerTrilhaDaCobranca`. | Dados |
| `packages/db/src/emissao-em-lote.ts` | `abrirEmissaoEmLote`, `selecionarCobrancasSemBoleto`, `registrarItemDoLote`, `concluirLote`, `interromperLote`, `lerLote`. | Dados |
| `packages/db/src/conferencia-bancaria.ts` | `abrirConferencia`, `selecionarCobrancasAConferir`, `concluirConferencia`, `lerConferenciaEmCurso`. | Dados |
| `packages/db/src/boleto-da-cobranca.ts` | `gravarBoletoDaCobranca`, `liquidarPeloProvedor`, `estornarLiquidacao`, `revogarBoleto`, `lerBoletoDaCobranca`. | Dados |
| `packages/db/migracoes/0017_dominio_emissao_e_conciliacao.sql` | **Gerada** por `drizzle-kit`: as quatro tabelas, os três enums, `ENABLE ROW LEVEL SECURITY`, FKs compostas e índices. | Dados |
| `packages/db/migracoes/0018_seguranca_emissao_e_conciliacao.sql` | **Autoral**: `FORCE ROW LEVEL SECURITY` e as políticas das quatro tabelas. | Dados |
| `apps/api/src/cobrancas/boleto.service.ts` | Emissão unitária/reemissão, entrega do boleto e histórico. | Aplicação |
| `apps/api/src/cobranca-bancaria/cobranca-bancaria.controller.ts` | 3 rotas: criar lote, ler lote, disparar conferência. | Apresentação |
| `apps/api/src/cobranca-bancaria/cobranca-bancaria.module.ts` | Fiação do módulo. | Apresentação |
| `apps/api/src/cobranca-bancaria/emissao-em-lote.service.ts` | Abre o lote, recusa o concorrente, enfileira. | Aplicação |
| `apps/api/src/cobranca-bancaria/conferencia-bancaria.service.ts` | Abre a conferência, recusa a concorrente, enfileira. | Aplicação |
| `apps/worker/src/tarefas/emissao-em-lote.ts` | Borda da tarefa do lote (ADR-0024). | Borda de tarefa |
| `apps/worker/src/tarefas/conferencia-bancaria.ts` | Borda da tarefa da conferência (ADR-0024). | Borda de tarefa |
| `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh` | Diretório existe, dono e modo corretos, e nenhum boleto na árvore versionada. | Infraestrutura |

> As suítes novas (`*.spec.ts` / `*.e2e.spec.ts`) constam da árvore em 3.4 e da §19; não se repetem
> nesta tabela para que ela continue sendo o mapa de impacto de **produção**.

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/cobranca-bancaria/src/modelo-canonico.ts` | Acrescenta os tipos das quatro operações. **`ResultadoDaVerificacaoDeIdentidade.detalhe` sobe para união fechada `+ null`** e o desfecho positivo perde a ressalva de alcance. | Fecha **D27 · F4/T8** e **D36 · F4/T10** |
| `packages/cobranca-bancaria/src/adaptador-sicoob.ts` | Quatro operações novas; obtenção e reaproveitamento da credencial; a sonda de identidade sobe para o `client_credentials`. | D5, D36 |
| `packages/cobranca-bancaria/src/index.ts` | Publica a porta e os tipos novos. **Âncora de superfície de pacote.** | ADR-0016 |
| `packages/contracts/src/cobranca.ts` | `esquemaDaCobranca` ganha **cinco** campos (18 → 23). Sobe `MAIOR_VALOR_MONETARIO`/`ESCALA_MONETARIA` para `comum.ts`. | CA-19; fecha **D1 · F3/T2** |
| `packages/contracts/src/comum.ts` | Recebe as duas constantes monetárias promovidas. | Limiar de três |
| `packages/contracts/src/index.ts` | Publica os esquemas de `cobranca-bancaria.ts`. **Âncora de superfície de pacote.** | ADR-0016 |
| `packages/db/src/esquema/negocio.ts` | Declara as quatro tabelas novas, os três enums e a coluna `identificador_no_provedor` de `cobranca` com o índice único global. | Fonte do gerador |
| `packages/db/src/cobranca.ts` | `LinhaDeCobranca` passa a carregar os cinco campos publicados; `listarCobrancas`/`localizarCobranca` os selecionam. O `identificador_no_provedor` **não entra na leitura publicada** — é interno. | CA-19 |
| `packages/db/src/index.ts` | Publica as funções novas. **Âncora de superfície de pacote (`CT-012`).** | ADR-0016 |
| `packages/shared/src/fila.ts` | `FILA_DA_EMISSAO_EM_LOTE`, `FILA_DA_CONFERENCIA_BANCARIA`, `CargaDaEmissaoEmLote`, `CargaDaConferenciaBancaria`. | ADR-0024, ADR-0029 |
| `apps/api/src/cobrancas/cobranca.controller.ts` | 4 rotas novas. | CA-05…CA-13 |
| `apps/api/src/cobrancas/cobrancas.module.ts` | Registra `BoletoService`. | Fiação |
| `apps/api/src/comum/produtor-de-fila.ts` | `enfileirarEmissaoEmLote` e `enfileirarConferenciaBancaria`, sob o **mesmo** saneamento de `semRastroDeComando`. | `DECISÃO FECHADA — T9 / Gate 2` |
| `apps/api/src/configuracao/ambiente.ts` | Exige `DIRETORIO_DOS_BOLETOS`; publica o adaptador de cobrança na composição raiz. | D6 |
| `apps/api/src/app.module.ts` | Registra `CobrancaBancariaModule`. | Fiação |
| `apps/api/src/main.ts` | Constrói o adaptador de cobrança e a guarda de boletos. | Composição raiz |
| `apps/worker/src/main.ts` | **`lerAmbiente` passa de 6 para 9 variáveis** (`CHAVE_DE_CIFRA_DO_CERTIFICADO`, `ENDERECO_DO_PROVEDOR_BANCARIO`, `DIRETORIO_DOS_BOLETOS`); registra os dois consumidores. | D1 |
| `apps/worker/src/fila.ts` | Duas filas e dois tipos de tarefa. | ADR-0029 |
| `apps/api/vitest.config.ts` | Semeia `DIRETORIO_DOS_BOLETOS` na verificação. | Suíte |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Inventário da fatia; **`ROTAS_PUBLICADAS_EM_PRODUCAO` 92 → 99** e **`MANIPULADORES_EXAMINADOS_EM_PRODUCAO` 77 → 84**, com a linha `SUT_IS_CORRECT_BECAUSE:`. | §5.2 desta spec |
| `apps/api/test/segredo-nao-escapa.e2e.spec.ts` | Acrescenta a superfície **`fila`** à enumeração da ADR-0032, com controle positivo. | Fecha **D58 · F4/T13** |
| **Suítes estendidas** — `apps/api/test/recusa-indistinguivel.e2e.spec.ts` (CT-926), `autorizacao-do-dominio.e2e.spec.ts` (CT-941), `contrato-publicado.e2e.spec.ts` (CT-945), `packages/contracts/test/esquemas.spec.ts` (CT-942), `packages/db/test/coerencia-de-migracoes.spec.ts` (CT-946), `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` (CT-933), `adaptador-sicoob.spec.ts` (CT-943), `apps/worker/test/ambiente.spec.ts` (CT-936) | Recebem os **11 casos que estendem suíte existente**. Cada uma **cresce**, e por isso entra aqui: a §5.2 da task tem de declará-las como âncora, senão o executor as descobre pela suíte vermelha e os gates gastam uma passagem decidindo se foi alargamento de escopo. | `.claude/rules/ancoras-de-superficie.md` §5.2 |
| `deploy/scripts/instalacao/provisionar-base.sh` | Provisiona o diretório dos boletos (dono, modo) e semeia a variável. | D6; fecha a lacuna do **D39 · F1** |
| `.env.example` | `DIRETORIO_DOS_BOLETOS=`. | D6 |
| `CLAUDE.md` | Atualiza a superfície (92/77 → 99/84), a contagem de casos, e **remove do índice as linhas dos débitos fechados** (D27, D36, D58, D1). | `.claude/rules/nao-regressao.md` §3-B |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `packages/cobranca-bancaria/src/porta-de-identidade.ts` | A porta irmã, e o cabeçalho que **reserva o nome** `AdaptadorCobrancaBancaria` para esta fatia. |
| `packages/cobranca-bancaria/src/leitura-do-material.ts` | Como o `.pfx` é aberto e por que a falha não vaza texto de OpenSSL. |
| `packages/db/migracoes/0010_seguranca_cobranca.sql` | A view `cobranca_derivada`, `data_corrente_da_operacao()` e a forma das políticas. **Imutável — carrega `DECISÃO FECHADA` e o `D20`.** |
| `packages/db/migracoes/0015_dominio_bancario.sql` / `0016_seguranca_bancaria.sql` | O molde exato do par gerada/autoral desta fase. |
| `packages/db/src/certificado-do-provedor.ts` | `obterEnvelopeCifradoDoVigente` — como o material chega ao ponto de uso. |
| `packages/db/src/identificador-bancario.ts` | `proximoIdentificadorBancario` — o consumo do contador do SaaS (ADR-0033). |
| `packages/db/src/cobranca.ts` (`acusarPagamentoDeCobranca`) | **Reusada sem alteração** pela liquidação vinda do provedor — é o que torna RN-07 verdadeira por construção. |
| `packages/db/src/catalogo.ts` | A guarda de cobertura que cobra as quatro propriedades de toda tabela de `negocio`. |
| `apps/api/src/contratos/contrato.controller.ts` (rota `documento`) | **O precedente literal da ADR-0028** — mídia, nome de arquivo, `format: 'binary'`, `@Res({ passthrough: true })` e a `DECISÃO FECHADA` sobre a extensão da unidade de trabalho. |
| `apps/api/src/integracoes-bancarias/certificado.service.ts` | Onde a transação fecha antes da chamada de rede, e a indistinguibilidade das duas causas. |
| `apps/worker/src/tarefas/regua.ts` | O molde da borda de tarefa: recusa da carga **antes** do contexto, `strictObject`, razão que nomeia o campo. |
| `packages/auth/src/catalogo-de-permissoes.ts` | O catálogo **fechado** (10 × 7) e as duas chaves já reservadas. |
| `apps/api/test/certificado-do-provedor.e2e.spec.ts` | Os acessórios de arranjo (`pedir`, `gerarMaterial`) — **D63 · F4/fechamento** dispara aqui. |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Emitir/reemitir o boleto de uma cobrança | `POST` | `/v1/cobrancas/:codigo/emissao-de-boleto` | corpo **vazio e fechado** | `Cobranca` (23 campos) | 200, 401, 403, 404, 422, 503 | sessão + `TELA:financeiro` + `ACAO:emitir_boleto` |
| Revogar o boleto | `POST` | `/v1/cobrancas/:codigo/revogacao-de-boleto` | corpo **vazio e fechado** | `Cobranca` | 200, 401, 403, 404, 422, 503 | sessão + `TELA:financeiro` + `ACAO:solicitar_baixa_de_boleto` |
| Entregar o arquivo do boleto | `GET` | `/v1/cobrancas/:codigo/boleto` | — | `application/pdf` (bytes) | 200, 401, 403, 404, 422, 503 | sessão + `TELA:financeiro` |
| Ler o histórico bancário | `GET` | `/v1/cobrancas/:codigo/historico-bancario` | — | `{ itens: EventoBancario[] }` | 200, 401, 403, 404, 422 | sessão + `TELA:financeiro` |
| Criar a emissão em lote | `POST` | `/v1/cobranca-bancaria/emissoes` | `{ competencia }` | `EmissaoEmLote` | 201, 401, 403, 422 | sessão + `TELA:financeiro` + `ACAO:emitir_boleto` |
| Acompanhar a emissão em lote | `GET` | `/v1/cobranca-bancaria/emissoes/:id` | — | `EmissaoEmLote` (com itens) | 200, 401, 403, 404, 422 | sessão + `TELA:financeiro` |
| Disparar a conferência | `POST` | `/v1/cobranca-bancaria/conferencias` | corpo **vazio e fechado** | `ConferenciaBancaria` | 200, 401, 403, **422**, 503 | sessão + `TELA:financeiro` |

**Superfície publicada: 92 → 99 pares e 77 → 84 manipuladores.** Nenhuma rota pública;
`semDeclaracao` continua vazio. A contagem exata é afirmada por **dupla medição independente com a
igualdade entre os eixos asserida**, no molde dos CT-533/CT-635/CT-732/CT-836 — ver §5.2 e §19.

### 4.1.1 Exemplo de Payload por Endpoint

**Nenhum endpoint desta fatia aceita atualização parcial.** Não há `PUT` nem `PATCH`: das sete rotas,
**quatro** são de escrita e todas são `POST` de ato — **três** com **corpo vazio e fechado**
(`ESQUEMA_DO_CORPO_VAZIO`, importado de `comum/esquema-de-corpo-vazio.ts`) e uma com um campo
obrigatório. As outras três são `GET`. O `201` do `POST /emissoes` é o padrão do Nest para criação,
e é o que as suítes já cobram nas criações existentes. A observação
anti-`required` do template **não se aplica**, e escrevê-la aqui seria ruído.

```
POST /v1/cobrancas/COB-2026-0000054/emissao-de-boleto
  Content-Type: application/json
  {}
  → 200  { "codigo": "COB-2026-0000054", …, "numeroDoTituloNoProvedor": "17000000012",
           "linhaDigitavel": "75691.11223 34455.667788 99001.122334 5 99230000012345",
           "codigoDeBarras": "75691992300000123451112233445566778899001122",
           "dataDoCredito": null, "valorCreditado": null }

POST /v1/cobranca-bancaria/emissoes
  Content-Type: application/json
  { "competencia": "2026-09-01" }        ← primeiro dia do mês; outro dia é 422
  → 201 { "id": "…", "competencia": "2026-09-01", "estado": "EM_ANDAMENTO",
          "emitidas": 0, "recusadas": 0, "itens": [] }

POST /v1/cobranca-bancaria/conferencias
  Content-Type: application/json
  {}
  → 200 { "id": "…", "iniciadaEm": "2026-09-01T12:00:00.000Z", "iniciadaAgora": true,
          "concluidaEm": null, "cobrancasConferidas": 0, "efeitos": 0 }
  → 200 { "id": "…", "iniciadaEm": "2026-09-01T11:59:12.000Z", "iniciadaAgora": false, … }
        ↑ CA-15: uma execução da mesma empresa já estava em curso. Nenhuma segunda foi iniciada,
          e o corpo informa QUAL está acontecendo e desde quando.
```

> **Por que `iniciadaAgora` e não um erro.** A CA-15 exige que o Admin *"seja informado"*, e o corpo
> informa mais do que um envelope de erro informaria: qual execução está em curso e desde quando. O
> `POST` fica **idempotente** — repetir devolve o mesmo recurso —, e o enum fechado de oito códigos
> de erro (`packages/shared/src/erros.ts`) não precisa crescer para acomodar um desfecho que não é
> falha. Um `409` exigiria código novo, e `STATUS_POR_CODIGO` cobra o par no compilador.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `esquemaDaCobranca` (estendido) | `packages/contracts/src/cobranca.ts` | **18 → 23**: acrescenta `numeroDoTituloNoProvedor`, `linhaDigitavel`, `codigoDeBarras`, `dataDoCredito`, `valorCreditado` — todos anuláveis. `z.object` (saída aberta). | v1 |
| `esquemaDaCompetencia` | `packages/contracts/src/cobranca-bancaria.ts` | `z.strictObject({ competencia: z.iso.date() })` + refino do primeiro dia. Entrada fechada. | v1 |
| `esquemaDaEmissaoEmLote` | idem | `id`, `competencia`, `estado`, `criadoEm`, `concluidoEm`, `interrompidoEm`, `motivoDaInterrupcao`, `emitidas`, `recusadas`, `itens[]`. | v1 |
| `esquemaDoItemDoLote` | idem | `cobrancaCodigo`, `desfecho` (`EMITIDO`\|`RECUSADO`), `motivo`. | v1 |
| `esquemaDaConferenciaBancaria` | idem | `id`, `iniciadaEm`, `concluidaEm`, `iniciadaAgora`, `cobrancasConferidas`, `efeitos`. | v1 |
| `esquemaDoEventoBancario` | idem | `tipo`, `origem`, `ocorridoEm`, `diagnostico`, `valorInformado`. | v1 |
| `TIPOS_DE_EVENTO_BANCARIO` | idem | Enum **fechado de seis**, `Object.freeze` + `as const`. | v1 |
| `ORIGENS_DO_EVENTO_BANCARIO` | idem | Enum **fechado de dois**: `ATO_DO_ADMIN`, `CONFERENCIA`. | v1 |
| `ESTADOS_DA_EMISSAO_EM_LOTE` | idem | Enum fechado de três: `EM_ANDAMENTO`, `CONCLUIDA`, `INTERROMPIDA`. | v1 |

**A direção decide a estritude** (`.claude/rules/contrato-publicado.md`): entrada `z.strictObject`,
saída `z.object`. Os enums do banco **derivam** destes literais (ADR-0016) — nunca redigitados.

> ⚠️ **`numeroDoTituloNoProvedor`, e não `nossoNumero`.** A coluna herdada da F3 chama-se
> `nosso_numero`, que é vocabulário **do provedor** — o glossário global o lista entre os termos a
> evitar, e a CA-20 proíbe que nome de campo dele apareça no que o produto publica. O nome publicado
> é do produto e o mapeamento morre na fronteira de dados. **A coluna não é renomeada nesta fatia**:
> ela é da migração `0009`, fora do escopo do PRD, e renomeá-la seria delta que ninguém pediu — fica
> **débito com gatilho** (§21).

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Fila | Payload | Schema |
|--------|------|------|---------|--------|
| Emissão em lote | pub (api) / sub (worker) | `emissao-em-lote` | `{ empresaId, loteId }` | `CargaDaEmissaoEmLote` (`@sysloc/shared`) |
| Conferência bancária | pub (api) / sub (worker) | `conferencia-bancaria` | `{ empresaId, conferenciaId }` | `CargaDaConferenciaBancaria` (`@sysloc/shared`) |

> ⚠️ **Nenhuma das duas cargas leva material, senha, envelope cifrado ou credencial** — apenas
> identificadores. É o vetor exato do achado crítico da fase anterior (`err.command.args`), e a
> ausência é o mecanismo, não a promessa: o processo de trabalho resolve o certificado pelo **banco**,
> sob o contexto de tenant, e decifra com a chave do próprio ambiente. Provado por medição (§19).

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Emissão em lote (US-01, US-02, US-03 → CA-01, CA-02, CA-03, CA-04)**

1. `POST /v1/cobranca-bancaria/emissoes` · o controlador valida `{ competencia }` e abre a unidade de
   trabalho sob o contexto da sessão.
2. `EmissaoEmLoteService.abrir(tx, competencia)` insere em `negocio.emissao_em_lote`. O **índice
   único parcial** `(empresa_id) WHERE concluido_em IS NULL AND interrompido_em IS NULL` recusa no
   banco um segundo lote em andamento — a violação é traduzida em `422` nomeando o lote em curso.
3. A unidade **commita**. Só então o controlador enfileira `{ empresaId, loteId }`. Falha ao
   enfileirar **não** desfaz o lote: ele fica `EM_ANDAMENTO` e o `503` informa; a próxima tentativa
   reusa o mesmo lote pelo índice parcial.
4. **No processo de trabalho**: a carga é recusada por `strictObject` **antes** de qualquer leitura e
   antes de abrir contexto (molde de `regua.ts`); `contextoDeTenant.executarCom` abre o contexto uma
   vez, na borda (ADR-0024).
5. Unidade 1 — lê o certificado vigente (`obterEnvelopeCifradoDoVigente`) e o conjunto:
   `selecionarCobrancasSemBoleto(tx, competencia)`, que é **predicado SQL** (ADR-0023): cobranças da
   competência com `pago_em IS NULL AND cancelado_em IS NULL AND nosso_numero IS NULL`. A unidade
   fecha; a decifra e a rede correm **fora** dela.
6. `executarEmissaoEmLote` percorre **em sequência**. Para cada cobrança: `proximoIdentificadorBancario`
   (unidade própria, ADR-0020 — o avanço não desfaz), `adaptador.emitir(...)`, e então **uma unidade
   por cobrança** grava os campos de conciliação — **inclusive o `identificador_no_provedor` que o
   produto compôs e enviou**, que é a chave de correlação da fatia (iii) e não se recupera depois —,
   os bytes pela guarda, o item do lote e o evento `BOLETO_EMITIDO`. Unidade por cobrança, e não uma para o lote: a falha da décima não pode desfazer
   as nove (precedente literal de `regua.ts`).
7. Desfecho `{ aceito: false, classe: 'DA_COBRANCA' }` grava item `RECUSADO` + evento
   `EMISSAO_RECUSADA` e o laço **segue**. Desfecho `classe: 'DA_EMPRESA'` grava `interrompido_em` e o
   motivo, e o laço **para** — o que já saiu permanece (RN-02, CA-03).
8. Ao fim sem interrupção, `concluirLote`. `GET /v1/cobranca-bancaria/emissoes/:id` devolve o lote
   com os itens — a prestação de contas da CA-02, nomeando cada cobrança e a razão.

**Liquidação pela conferência (US-06, US-11 → CA-10, CA-16)**

1. `POST /v1/cobranca-bancaria/conferencias` abre a conferência (índice único parcial em
   `(empresa_id) WHERE concluida_em IS NULL`) e enfileira. Conferência já em curso ⇒ `200` com
   `iniciadaAgora: false` e **nada é enfileirado**.
2. No processo de trabalho, `selecionarCobrancasAConferir(tx)` é **um predicado só** (CA-16):
   `nosso_numero IS NOT NULL AND ((pago_em IS NULL AND cancelado_em IS NULL) OR pago_em >=
   negocio.data_corrente_da_operacao() - INTERVAL '30 days')`. A janela de 30 dias sai do **relógio do
   banco** (ADR-0026), nunca de `new Date()`.
3. Para cada cobrança, `adaptador.consultarSituacao({ …, incluirDocumento: false })`.
4. `LIQUIDADO` e a cobrança ainda em aberto ⇒ `acusarPagamentoDeCobranca(tx, codigo, { pagoEm,
   valorPago })` — **a função da F3, sem alteração**, que copia multa, juros e os dois percentuais da
   `cobranca_derivada` pela mesma expressão que a leitura publicava um instante antes. É o que faz
   RN-07 valer *"sem exceção por caminho de entrada"* por construção, e não por disciplina. Grava
   também `data_credito` e `valor_creditado`, e o evento `COBRANCA_LIQUIDADA` com
   `origem: CONFERENCIA`.
5. **Se o valor informado difere do esperado** (CA-11): a baixa acontece **assim mesmo**, e um segundo
   evento `DIVERGENCIA_DE_VALOR` grava `valor_informado`. A divergência não impede nada — fica
   registrada.
6. `EM_ABERTO` e nada mudou ⇒ **nenhum evento** (ADR-0034). O contador `cobrancas_conferidas` sobe;
   `efeitos` não.
7. `concluirConferencia` grava o instante e os dois contadores.

### 5.2 Fluxos Alternativos

| # | Situação | Comportamento |
|---|----------|---------------|
| A | **Reemissão com boleto vivo** (CA-05) | Um ato só: `solicitarRevogacaoDeBoleto` → sondagem de `confirmarRevogacaoDeBoleto` a cada `INTERVALO_ENTRE_SONDAS_MS` até `TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS` → **só então** `emitir`. Em nenhum instante os dois são pagáveis. ⚠️ **A espera e o relógio chegam a `reemitirBoleto` por parâmetro**, como o adaptador da fatia (i) já faz: os dois limites permanecem constantes nomeadas no topo e são os **valores padrão** da composição raiz, mas a função não chama `setTimeout` nem `Date.now()` por dentro. Sem isso o CT-917 dormiria três intervalos reais, e a alternativa (`vi.useFakeTimers`) é a que o CT-943 proíbe no pacote. |
| B | **Revogação confirmada, emissão falha** (CA-06) | A cobrança fica **sem boleto**: as **colunas do título vivo** voltam a `NULL` — `nosso_numero`, `linha_digitavel`, `codigo_barras` e `boleto_arquivo`, as quatro que `revogarBoleto` limpa numa instrução só —, o arquivo é apagado, evento `BOLETO_REVOGADO` gravado, e a resposta é erro nomeando a cobrança com `detalhes: { boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' }`. O estado permanece em aberto. **Ela é recolhida pelo LOTE seguinte**, não pela conferência — ver a nota abaixo. |
| C | **Revogação não confirmada dentro do teto** | O ato **falha declarando** que a revogação foi pedida e o novo não foi emitido, com `detalhes: { revogacao: 'PEDIDA_NAO_CONFIRMADA' }`. Nada é apagado: o boleto anterior continua sendo o único, e a conferência seguinte apura o desfecho real junto ao provedor. |
| D | **Reexecutar a mesma competência** (CA-04) | O predicado do passo 5.1.5 já exclui quem tem `nosso_numero`. A idempotência vem **do predicado**, não de uma guarda escrita para ela — uma guarda seria uma segunda regra livre para divergir (precedente literal de `regua.ts`). |
| E | **Arquivo do boleto ausente do disco** (CA-08) | `consultarSituacao({ incluirDocumento: true })`, os bytes são regravados pela guarda e entregues. Quem pediu não percebe diferença. A re-obtenção corre **fora** da unidade de trabalho. |
| F | **Boleto nunca emitido** (CA-09) | `404 RECURSO_NAO_ENCONTRADO`, `campo: 'codigo'`, mensagem nomeando a cobrança e a ausência. **Nenhum byte é escrito** — o `content-type: application/pdf` só é definido **depois** da leitura, pela mesma razão registrada na rota do documento do contrato. |
| G | **Provedor informa revogação do boleto** (CA-17, CA-18) | A cobrança **permanece em aberto**, perde as **colunas do título vivo** (`nosso_numero`, `linha_digitavel`, `codigo_barras` e `boleto_arquivo`) e o arquivo, e ganha evento `BOLETO_REVOGADO` com `diagnostico` = o motivo **tal como o provedor o informou**, reconhecido ou não. `cancelado_em` **não é tocado**. Emitir de novo ocorre como a primeira vez. |
| H | **Provedor informa estorno** (CA-12) | `estornarLiquidacao` apaga, numa instrução só, os **oito** campos que a liquidação escreveu: `pago_em`, `valor_pago`, os **quatro** carimbos e — porque o crédito foi desfeito junto com o pagamento — `data_credito` e `valor_creditado`. Deixar os dois de crédito para trás publicaria uma cobrança em aberto com data de crédito, que é a incoerência que o estorno existe para desfazer. O `cobranca_carimbo_coerente_chk` recusaria a linha meio apagada. O estado volta a ser derivado pela view: `VENCIDA` ou `A_VENCER` conforme o vencimento. Evento `LIQUIDACAO_ESTORNADA`. A cobrança volta ao alcance da régua, por consequência da derivação. |
| I | **Histórico de cobrança de outra empresa** (CA-14) | A política do banco não casa a linha; a ausência vira `404` com o **mesmo corpo** de inexistente, num ponto único. Nenhuma comparação de empresa é escrita em código. |
| J | **Certificado ausente ou vencido na emissão unitária** | `422 CAMPO_INVALIDO` nomeando a data em que a validade terminou — mesma forma já publicada por `CertificadoDoProvedorService`. No lote, é falha `DA_EMPRESA` e **interrompe** (RN-02). |
| K | **Provedor indisponível** | `503 SERVICO_INDISPONIVEL` na rota em linha; falha `DA_EMPRESA` no lote. Sem repetição automática na borda — quem repete é a pessoa, e a fila repete a tarefa pela política declarada em `@sysloc/shared`. |

> ⚠️ **Correção medida contra o tech-alignment.** O D3 registra que a cobrança que ficou sem boleto
> *"é resolvida pela conferência seguinte"*. **Não é**: a CA-16 seleciona apenas cobranças **com
> boleto emitido**, e uma cobrança sem `nosso_numero` está fora do conjunto por construção. Quem a
> recolhe é o **lote seguinte da competência**, cujo predicado é exatamente *"em aberto e sem
> boleto"* (5.1.5). O desfecho prático que o D3 descreve — *"resolvido sem intervenção"* — continua
> verdadeiro; o mecanismo é outro, e escrevê-lo errado faria a task procurar a correção no lugar
> errado.

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | 5.1 Emissão em lote · `POST /v1/cobranca-bancaria/emissoes` | `CobrancaBancariaController`, `EmissaoEmLoteService`, `ProdutorDeFila`, `tarefas/emissao-em-lote.ts`, `executarEmissaoEmLote`, `emissao-em-lote.ts` (db) |
| US-02 | 5.1 passo 8 · `GET /v1/cobranca-bancaria/emissoes/:id` | `CobrancaBancariaController`, `EmissaoEmLoteService`, `lerLote`, `esquemaDaEmissaoEmLote` |
| US-03 | 5.1 passo 7 (`classe: DA_EMPRESA`) | `executarEmissaoEmLote`, `ClasseDaFalha`, `interromperLote` |
| US-04 | 5.2 A/B/C · `POST /v1/cobrancas/:codigo/emissao-de-boleto` | `BoletoService`, `reemitirBoleto`, `AdaptadorCobrancaBancaria` (3 das 4 operações) |
| US-05 | 5.2 E/F · `GET /v1/cobrancas/:codigo/boleto` | `CobrancaController`, `BoletoService`, `guarda-de-boletos.ts`, `consultarSituacao` |
| US-06 | 5.1 Liquidação passos 4–5 | `conferirCobrancas`, `acusarPagamentoDeCobranca` (reusada), `registrarEventoBancario` |
| US-07 | 5.2 H | `estornarLiquidacao`, `cobranca_derivada` (view), `registrarEventoBancario` |
| US-08 | `GET /v1/cobrancas/:codigo/historico-bancario` | `CobrancaController`, `BoletoService`, `lerTrilhaDaCobranca`, `esquemaDoEventoBancario` |
| US-09 | `POST /v1/cobranca-bancaria/conferencias` | `ConferenciaBancariaService`, índice único parcial, `ProdutorDeFila` |
| US-10 | 5.2 G | `conferirCobrancas`, `revogarBoleto` (**não toca `cancelado_em`**) |
| US-11 | 5.1 Liquidação passo 2 | `selecionarCobrancasAConferir` (predicado SQL), `data_corrente_da_operacao()` |
| US-12 | 5.1 passo 6 + `GET /v1/cobrancas/:codigo` | `esquemaDaCobranca` (23 campos), `LinhaDeCobranca`, `localizarCobranca` |
| US-13 | Transversal — §11.4 e §19 | `modelo-canonico.ts`, `adaptador-sicoob.ts`, varredura de vocabulário com controle positivo |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| `:codigo` no formato `COB-{ano}-{7 dígitos}` | `ESQUEMA_DO_CODIGO_DE_COBRANCA` no controlador | `422 CAMPO_INVALIDO`, `campo: 'codigo'`, **sem tocar o banco** |
| `:id` do lote é UUID canônico | `ESQUEMA_DO_IDENTIFICADOR` | `422`, `campo: 'id'` |
| `competencia` é data ISO **no primeiro dia do mês** | `esquemaDaCompetencia` (`strictObject` + refino) | `422`, `campo: 'competencia'` |
| Corpo **vazio e fechado** nas **três** rotas de ato sem campo | `ESQUEMA_DO_CORPO_VAZIO` | `422`, `code: 'unrecognized_keys'` nomeando a chave excedente |
| Carga da tarefa é **exatamente** `{ empresaId, loteId }` | `strictObject` na borda da tarefa, **antes** do contexto | Tarefa falha nomeando o **campo**, jamais o valor; a fila repete |
| `DIRETORIO_DOS_BOLETOS` presente, absoluto e gravável | Conferência de partida (api **e** worker) | Processo **recusa subir**, nomeando a variável e nunca o valor |

### 6.2 Transformações de Dados

- **`nossoNumero` chega do provedor como INTEIRO** no JSON (medido, §13-A.4 do discovery) — o
  adaptador **coage na fronteira** para cadeia; supor `string` quebraria na primeira resposta real.
- **O corpo útil vem envelopado em `resultado`** (medido) — o desenvelopamento morre no adaptador.
- **`identificacaoBoletoEmpresa` retornou 25 espaços nos três casos medidos.** É vizinho semântico do
  identificador que o produto gera e **não deve ser confundido com ele** no mapeamento: quem casa com
  o identificador perante o provedor é o `seuNumero`, cuja integridade em 18 posições foi medida 3 de
  3 no caminho de consulta.
- **Dinheiro atravessa como cadeia** (`numeric(15,2)` ↔ `string`) até a fronteira publicada, onde o
  esquema o converte para `z.number()` — o mesmo desenho já praticado por `esquemaDaCobranca`.
- **Datas de calendário viajam como `YYYY-MM-DD`**, sem passar por `Date` com fuso; instantes de ato
  viajam como ISO-8601 UTC em cadeia.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| Conjunto do lote | RN-01 | Predicado SQL: competência + `pago_em IS NULL` + `cancelado_em IS NULL` + `nosso_numero IS NULL`. O Admin informa só a competência. | — |
| Classe da falha | RN-02 | O **adaptador** classifica em `DA_COBRANCA` \| `DA_EMPRESA`; o domínio decide o que fazer com cada uma. Só o adaptador sabe distinguir, e só o domínio sabe o que a distinção causa. | `interromperLote` |
| Idempotência do lote | RN-03 | Vem do **predicado**, não de guarda dedicada. Dois lotes concorrentes são impossíveis pelo índice único parcial. | violação de índice → `422` |
| Reemissão é um ato só | RN-04 | `reemitirBoleto` compõe revogar → sondar → emitir. Falha após a confirmação ⇒ **sem boleto**, declarado. | `ErroDeReemissaoIncompleta` |
| Entrega e re-obtenção | RN-05 | Arquivo ausente é rebuscado; nunca emitido é recusa nomeada; **jamais** documento em branco. | `ErroDeBoletoInexistente` |
| Origem do pagamento | RN-06 | Só o que o provedor responde **quando consultado** move a cobrança. Não há caminho de notícia nesta fatia. | — |
| Mora da baixa | RN-07 | `acusarPagamentoDeCobranca` **reusada sem alteração** — a mesma expressão da view, no mesmo lugar. Divergência de valor não impede. | — |
| Estorno apaga o fato | RN-08 | Uma instrução apaga os **oito** campos escritos pela liquidação — `pago_em`, `valor_pago`, os quatro carimbos e os dois de crédito; o `check` bicondicional recusaria a linha meio apagada. O boleto **não** é revogado: os campos de emissão permanecem. | — |
| Revogação não cancela | RN-09 | `revogarBoleto` **não nomeia `cancelado_em` no `SET`** — a garantia é estrutural: coluna não nomeada não é escrita. | — |
| Cancelar é ato de quem opera | RN-10 | Nenhum caminho desta fatia escreve `cancelado_em`. Afirmado por varredura das instruções. | — |
| Conjunto da conferência | RN-11 | Predicado único, com a janela de 30 dias contra `data_corrente_da_operacao()`. | — |
| Disparo não duplica | RN-12 | Índice único parcial `(empresa_id) WHERE concluida_em IS NULL`. É **mecanismo do banco**, não checagem de aplicação. | `200` com `iniciadaAgora: false` |
| Trilha por cobrança | RN-13 | `evento_bancario` com `empresa_id`, RLS forçada, FK composta, ordenada por `ocorrido_em`. | — |
| Estado sempre derivado | RN-14 | Nenhuma coluna de status nasce nesta fatia. Afirmado pela guarda de cobertura do catálogo. | — |
| Vocabulário do provedor | RN-15 | Nada dele vira regra ou estado. O motivo desconhecido é gravado em `diagnostico` e **não decide nada** — por construção, já que nenhum ramo o lê. | — |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, com **Row Level Security habilitada e forçada** em toda tabela de negócio
(invariante 1, ADR-0008). Acesso por Drizzle (declaração do esquema) + postgres.js (execução). O
contexto de tenant é fixado por `SET LOCAL app.empresa_id` na abertura de cada unidade de trabalho, a
partir de `AsyncLocalStorage` — **nunca lido do request** (invariante 2).

### 7.2 Tabelas / Coleções

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|------|------------------|-------|-------------|---------|
| `negocio.evento_bancario` | `id`, `empresa_id`, `cobranca_id`, `tipo`, `origem`, `ocorrido_em`, `diagnostico`, `valor_informado` | `uuid`, `uuid`, `uuid`, `tipo_de_evento_bancario`, `origem_do_evento_bancario`, `timestamptz`, `text NULL`, `numeric(15,2) NULL` | PK `id`; UNIQUE `(id, empresa_id)`; FK composta `(cobranca_id, empresa_id) → cobranca(id, empresa_id)`; FK `empresa_id → identidade.empresa(id)`; RLS habilitada + **forçada** | `(empresa_id, cobranca_id, ocorrido_em DESC)` — a leitura da trilha |
| `negocio.emissao_em_lote` | `id`, `empresa_id`, `competencia`, `solicitado_por`, `criado_em`, `concluido_em`, `interrompido_em`, `motivo_da_interrupcao` | `uuid`, `uuid`, `date`, `uuid`, `timestamptz`, `timestamptz NULL`, `timestamptz NULL`, `text NULL` | PK; UNIQUE `(id, empresa_id)`; FK composta `(solicitado_por, empresa_id) → identidade.usuario(id, empresa_id)`; CHECK competência no 1º dia; CHECK `concluido_em IS NULL OR interrompido_em IS NULL` (desfecho único); CHECK `(interrompido_em IS NULL) = (motivo_da_interrupcao IS NULL)` (bicondicional); RLS forçada | **UNIQUE PARCIAL `(empresa_id) WHERE concluido_em IS NULL AND interrompido_em IS NULL`**; `(empresa_id, criado_em DESC)` |
| `negocio.item_da_emissao_em_lote` | `id`, `empresa_id`, `lote_id`, `cobranca_id`, `desfecho`, `motivo`, `registrado_em` | `uuid`, `uuid`, `uuid`, `uuid`, `desfecho_do_item_do_lote`, `text NULL`, `timestamptz` | PK; UNIQUE `(id, empresa_id)`; UNIQUE `(lote_id, cobranca_id)`; FKs compostas para lote e cobrança; CHECK `(desfecho = 'RECUSADO') = (motivo IS NOT NULL)`; RLS forçada | `(empresa_id, lote_id)` |
| `negocio.conferencia_bancaria` | `id`, `empresa_id`, `iniciada_em`, `concluida_em`, `solicitada_por`, `cobrancas_conferidas`, `efeitos` | `uuid`, `uuid`, `timestamptz`, `timestamptz NULL`, `uuid NULL`, `integer`, `integer` | PK; UNIQUE `(id, empresa_id)`; FK composta para usuário (**anulável** — na F5 o disparo é do relógio, sem usuário); RLS forçada | **UNIQUE PARCIAL `(empresa_id) WHERE concluida_em IS NULL`**; `(empresa_id, iniciada_em DESC)` |
| `negocio.cobranca` **(modificada)** | `nosso_numero`, `linha_digitavel`, `codigo_barras`, `data_credito`, `valor_creditado`, `boleto_arquivo` (já existem) **+ `identificador_no_provedor` (nova)** | os seis já existem, todos anuláveis; a nova é `text NULL` | **Nenhum `check` novo**, e a ausência é a decisão — ver abaixo | **UNIQUE `(identificador_no_provedor)`**, sem `empresa_id`: a série é do **SaaS** (ADR-0033) |

> **Por que `negocio.cobranca` ganha UMA coluna, e por que ela não é `nosso_numero`.** São **dois**
> identificadores distintos, e a fatia (i) já mediu a diferença: o produto **compõe** as 18 posições
> do *Identificador perante o provedor* (`proximoIdentificadorBancario`, `AAAAMM` + contador de 12) e
> as envia; o provedor **atribui** as suas e as devolve. Guardar só o segundo descartaria a chave que
> o glossário global declara ser aquela *"por que a notificação recebida do provedor descobre a que
> **Empresa** pertence"* — e a fatia (iii) ficaria sem por onde casar a notificação, exigindo migração
> sobre tabela já com dado.
>
> A coluna é **interna e não publicada**: nenhum esquema de `@sysloc/contracts` a expõe, e por isso
> `esquemaDaCobranca` continua indo de 18 para 23 campos. A unicidade é **global**, sem `empresa_id`
> no índice, porque a ADR-0033 fixa o escopo desta série no SaaS — parear com a empresa aqui seria
> exatamente o *"corrigir o contador para ser por empresa"* que a ADR proíbe.
>
> **Por que nenhum `check` nesta fatia.** A tentação natural é um
> `check` bicondicional pareando os cinco campos de conciliação, no molde de
> `cobranca_carimbo_coerente_chk`. Ele está **errado aqui**: `data_credito` e `valor_creditado`
> nascem depois dos outros três (o boleto é emitido, e só depois creditado), de modo que a
> bicondicional recusaria o estado legítimo *"emitido e ainda não pago"*. Um `check` mais fraco —
> `(linha_digitavel IS NULL) = (nosso_numero IS NULL)` — é correto e **fica de fora por escopo**: ele
> pertence à mesma classe do **D44 · F2/T10**, que agenda restrições de coerência entre entidades
> para a fatia que as criar no banco. Registrado como débito na §21.
>
> **E nenhuma coluna de status nasce aqui** (ADR-0022, RN-14). O estado publicado continua saindo da
> `cobranca_derivada`, e a `0010` que a define é **imutável** — ela carrega uma `DECISÃO FECHADA` e o
> `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco durável.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0017 | `0017_dominio_emissao_e_conciliacao.sql` | up — **gerada** por `drizzle-kit generate`: 3 enums, 4 tabelas novas, **`ALTER TABLE negocio.cobranca ADD COLUMN identificador_no_provedor text` + o índice único global sobre ela**, `ENABLE ROW LEVEL SECURITY`, FKs compostas, índices (inclusive os dois **únicos parciais**, que são declaráveis no Drizzle por `uniqueIndex().where()` e por isso saem daqui, e não da parceira autoral). O `ALTER` é aditivo e anulável — não reescreve linha existente nem exige janela |
| 0018 | `0018_seguranca_emissao_e_conciliacao.sql` | up — **autoral**: `FORCE ROW LEVEL SECURITY` e as políticas `USING`/`WITH CHECK` das quatro tabelas novas |

**Sem descida.** O caminho de volta é restauração de backup — mesma decisão da `0015`/`0016`.

Três restrições de manutenção, herdadas e não negociáveis:

1. **Nenhum `CREATE SCHEMA` em migração.** Os schemas nascem do provisionamento. A guarda é
   executável (`verificar-migracao.sh`, asserção `(e)`).
2. **Gerado e autoral nunca convivem no mesmo arquivo** — regeração futura sobrescreveria o trecho
   autoral em silêncio.
3. **Nenhuma migração de `0000` a `0016` é tocada.** O `sha256sum` que `migrar-banco.sh` registra por
   arquivo continua batendo para todas as anteriores.

> ⚠️ **Nenhuma tabela desta fatia vai para o schema `plataforma`.** As quatro têm dono-empresa e por
> isso pertencem a `negocio` (ADR-0031, pela contrapositiva). O roster enumerado de `plataforma`
> **não cresce**, e a guarda de cobertura de `src/catalogo.ts` continua exigindo as quatro
> propriedades de toda tabela de `negocio`: `empresa_id NOT NULL`, `UNIQUE (id, empresa_id)`, RLS
> forçada e FK composta.

### 7.4 Estratégia de Transação e Consistência

- **Nível de isolamento**: `READ COMMITTED` (o padrão), como no resto do produto. Não há leitura-e-grava
  que dependa de serialização — onde haveria corrida, ela é fechada por **restrição do banco**.
- **A concorrência é resolvida por índice, não por lock**: os dois índices únicos parciais recusam o
  segundo lote e a segunda conferência **no banco**. `SELECT` antes de `INSERT` seria corrida
  disfarçada (a mesma razão já registrada em `configuracao_de_mora_empresa_key`).
- **Uma unidade de trabalho por cobrança** no percurso do lote e da conferência — a falha da décima
  não desfaz as nove.
- **Nenhuma chamada de rede dentro de `sql.begin`**: o que se protege é a conexão física, que é
  recurso escasso do processo inteiro.
- **O avanço do contador não participa do desfazimento** (ADR-0020/0033): furo é aceito, número nunca
  é reusado.
- **Idempotência**: do lote, pelo predicado; da conferência, pelo índice parcial; da liquidação, pela
  guarda de estado (cobrança já paga não é repaga, e a repetição **informa**).

### 7.5 Política de Retenção / Archival

- **`evento_bancario`, `emissao_em_lote`, `item_da_emissao_em_lote` e `conferencia_bancaria` não têm
  expurgo.** São registro de negócio, alcançados pelo backup do item 1 da F7. Nada é apagado
  (RD-12 / ADR-0014).
- **Os bytes do boleto NÃO têm expurgo nesta fatia**, e a ausência é decisão, não omissão. Três
  razões: (a) o arquivo é **cache recuperável** — a re-obtenção da CA-08 já torna a perda inofensiva,
  então o expurgo não tem urgência funcional; (b) expurgo é rotina **agendada**, e o agendamento é da
  **F5** pela fronteira F4/F5 declarada no discovery; (c) o volume não é urgente mas também não é
  desprezível: projetado a 300 empresas × ~47 boletos/mês × ~100 KB ≈ **1,4 GB/mês**. Fica **débito
  com gatilho** (§21): a F5, ou a primeira medição do diretório acima de 20 GB.
- **O diretório entra no backup** do item 1 da F7 — a origem dos bytes é o provedor, mas restaurar
  sem eles faria toda entrega passar por re-obtenção no primeiro dia depois da restauração.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| Sicoob — Cobrança Bancária v3 | REST/JSON sobre HTTPS | **mTLS** (certificado A1 por empresa, `.pfx` cifrado em repouso) **+** credencial de acesso `client_credentials` | `TETO_DA_OPERACAO_MS = 10_000` por chamada; `TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS = 12_000` para a sondagem; `TETO_DA_REEMISSAO_MS = 30_000` para o ato composto | **Nenhuma na borda.** A fila repete a tarefa pela política de `@sysloc/shared` (3 tentativas, espera exponencial de 1 s) |

**Cliente**: `node:https` **nativo**. O `undici` foi **avaliado e recusado** na fatia (i) — a razão
está no docblock de `adaptador-sicoob.ts` e não se reabre aqui: o que ele acrescentaria é o
agrupamento de conexões, que manteria o material decifrado residente por tempo indefinido. O pacote
segue com **zero dependência externa**.

**Credencial de acesso** (D5, e a decisão do usuário sobre a porta): obtida e reaproveitada **dentro
do adaptador**, em `credencial-de-acesso.ts`, num cache em memória por processo chaveado por empresa,
renovado por **expiração** (medida: **300 s**). Ela **não atravessa a porta** — ver §21.1. Pior caso
com dois processos: 2 obtenções por empresa a cada 5 min, irrisório frente às ~420 mil chamadas/dia
do polling que esta fase elimina.

**Sem disjuntor**, e a ausência é declarada: o produto tem exatamente dois caminhos automáticos
contra o provedor (as duas tarefas), ambos com repetição limitada pela fila e ambos interrompendo o
lote na falha da empresa. Um disjuntor acrescentaria estado global que nenhum caso desta fatia
observa. **Degradação**: indisponibilidade é `503` na rota em linha e interrupção declarada no lote —
nunca sucesso silencioso.

**Fallback: não existe, e a ausência é o mecanismo.** Não há material padrão, variável de ambiente
com certificado, nem `?? certificadoDeReserva` em lugar nenhum. É o defeito central que a fase existe
para fechar — no sistema antigo *"existe um caminho de reserva que atende qualquer empresa que não
tenha a própria"*.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Tópico / Fila | Produtor | Consumidor | Garantia |
|---------------|----------|------------|----------|
| `emissao-em-lote` | `apps/api` (`ProdutorDeFila`) | `apps/worker` | **at-least-once** — a repetição é segura porque o predicado do conjunto já exclui quem tem boleto |
| `conferencia-bancaria` | `apps/api` (`ProdutorDeFila`) | `apps/worker` | **at-least-once** — a repetição é segura porque a conferência é leitura seguida de aplicação idempotente |

### 9.2 Idempotência

- **Do lote**: pelo **predicado** (`nosso_numero IS NULL`). Reexecutar tenta apenas quem ainda não
  tem boleto (CA-04). Nenhuma guarda de idempotência é escrita — ela seria uma segunda regra livre
  para divergir da do predicado.
- **Da conferência**: pelo **índice único parcial**, que impede a segunda execução concorrente; e pela
  natureza do ato, que é consultar e aplicar o que já é verdade no provedor.
- **Da liquidação**: `acusarPagamentoDeCobranca` só é chamada quando `pago_em IS NULL`; a cobrança já
  paga que o provedor reporta paga de novo **não gera evento** (ADR-0034 — nada mudou).
- **Do enfileiramento**: a carga leva `loteId` / `conferenciaId` já persistidos, de modo que a tarefa
  repetida opera sobre o **mesmo** registro em vez de criar um segundo.

### 9.3 Outbox / Saga

**Não se aplica, e a ausência é deliberada.** O padrão *outbox* existe para tornar atômicos o commit e
a publicação; aqui a ordem escolhida — **commitar o lote e só então enfileirar** — torna o pior caso
inofensivo por construção: se o enfileiramento falhar, o lote fica `EM_ANDAMENTO`, o `503` informa, e
a próxima tentativa reusa o mesmo lote pelo índice parcial. A falha oposta (enfileirar e o commit
desfazer) é **impossível**, porque nada é enfileirado antes do commit. Introduzir uma tabela de
outbox seria maquinaria para um modo de falha que a ordem já fecha.

O ato composto da reemissão (revogar → sondar → emitir) é a coisa mais próxima de uma saga nesta
fatia, e ele **não** é modelado como tal: não há compensação possível para uma revogação já confirmada
junto ao provedor. O que existe é o desfecho declarado da CA-06 — a cobrança fica sem boleto, é dito
nomeando-a, e o lote seguinte a recolhe.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Cobrança inexistente ou de outra empresa | `RECURSO_NAO_ENCONTRADO` (404) | idêntica nos dois casos, `campo: 'codigo'` | Dados → `BoletoService.exigir` |
| Boleto nunca emitido (CA-09) | `RECURSO_NAO_ENCONTRADO` (404) | nomeia a cobrança **e a ausência**, `detalhes: { boleto: 'NUNCA_EMITIDO' }` | Aplicação |
| Código malformado | `CAMPO_INVALIDO` (422) | nomeia o campo, **sem tocar o banco** | Apresentação |
| Competência fora do primeiro dia | `CAMPO_INVALIDO` (422) | `campo: 'competencia'` | Apresentação |
| Chave desconhecida no corpo | `CAMPO_INVALIDO` (422) | `code: 'unrecognized_keys'` nomeando a chave | Apresentação |
| Empresa sem certificado vigente | `CAMPO_INVALIDO` (422) | `detalhes: { certificado: 'AUSENTE' }` | Aplicação |
| Certificado vencido | `CAMPO_INVALIDO` (422) | data em que a validade terminou | Dados (`ErroDeCertificadoVencido`) |
| Lote em andamento para a empresa | `CAMPO_INVALIDO` (422) | `detalhes: { loteEmCurso: '<id>' }` | Dados (violação de índice) → Aplicação |
| Cobrança já liquidada, pedido de emissão | `CAMPO_INVALIDO` (422) | nomeia o estado atual | Aplicação |
| Revogação confirmada + emissão falhou (CA-06) | `SERVICO_INDISPONIVEL` (503) | nomeia a cobrança; `detalhes: { boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' }` | Aplicação |
| Revogação pedida e não confirmada no teto | `SERVICO_INDISPONIVEL` (503) | `detalhes: { revogacao: 'PEDIDA_NAO_CONFIRMADA' }` | Aplicação |
| Provedor indisponível / tempo esgotado | `SERVICO_INDISPONIVEL` (503) | texto do produto, **nunca** do runtime | Infraestrutura → Aplicação |
| Servidor de fila não aceitou a tarefa | `SERVICO_INDISPONIVEL` (503) | erro **construído** pela borda, causa reduzida a texto | `ProdutorDeFila` |
| Sem sessão | `NAO_AUTENTICADO` (401) | envelope canônico | Guarda |
| Sem a chave exigida | `ACESSO_NEGADO` (403) | `detalhes.exigido` nomeia a **primeira** ausente | Guarda (ADR-0018) |

O envelope é o da **ADR-0017** — `{ codigo, mensagem, campo?, detalhes? }` sobre status semântico —, e
o enum de códigos **não cresce**: `STATUS_POR_CODIGO` é `Record<CodigoErro, number>` e cobraria o par
no compilador. A rota de bytes usa **o mesmo envelope** em todas as falhas (ADR-0028).

### 10.2 Resiliência

- **Teto em toda chamada externa**, e ele vai **também ao transporte** (`timeout` da requisição), não
  só ao relógio do ato — é o par de garantias que faltava ao adaptador de e-mail, onde o limite
  existia no fonte e não alcançava o socket.
- **Sondagem com limite declarado, nunca pausa fixa** — exigência de determinismo da
  `.claude/rules/testing-stack.md`. Todo limite é constante nomeada no topo do arquivo.
- **Despachante próprio por ato**, `keepAlive: false`, cache de sessão zerado — a janela em que o
  material decifrado importa não sobrevive ao ato.
- **Repetição só na fila** (3 tentativas, espera exponencial). A borda não repete: repetir por conta
  própria transformaria um clique em três apertos de mão com o material decifrado.
- **Falha da empresa interrompe o lote** — é resiliência de verdade: 47 falhas idênticas por
  certificado vencido não ajudam ninguém.

### 10.3 Estratégia de Logging de Erros

Pino, JSON estruturado, com a **redação única** de `@sysloc/shared/log.ts`. Três regras que esta
fatia herda e não negocia:

1. **Nenhum objeto de exceção da biblioteca de fila atravessa a fronteira do produtor** — é a
   `DECISÃO FECHADA — T9 / Gate 2` de `produtor-de-fila.ts`, e as duas funções novas passam pelo
   **mesmo** `semRastroDeComando`. O `err.command.args` carrega a carga serializada.
2. **Nenhuma falha do runtime de transporte é repassada** — nem como `cause`, nem como propriedade,
   nem em texto. O desfecho é escolhido por fato **estrutural**, não pelo que a biblioteca escreveu.
3. **Nome de campo entra; valor de campo não.** Nome de campo não é segredo; valor de campo pode ser
   dado de outra empresa.

---

## 11. Segurança

### 11.1 Autenticação

Sessão via better-auth, como todo o produto. **Nenhuma das sete rotas dispensa sessão** — a ADR-0027
condiciona a dispensa a o ato ser exercido pelo **titular do dado**, e nenhum destes o é. O
`semDeclaracao` continua vazio.

### 11.2 Autorização

Declarada **por rota**, com default que nega (ADR-0011), e composta quando há mais de uma exigência
(ADR-0018). **O catálogo é fechado em 10 telas × 7 ações e NÃO cresce** — decisão do usuário nesta
spec, coerente com a decisão 38 do `plano-saas.md` e com a cardinalidade que o `CT-201` afirma:

| Rota | Exigência | Justificativa contra a `Decision` da ADR-0021 |
|------|-----------|-----------------------------------------------|
| emitir/reemitir | `TELA:financeiro` + `ACAO:emitir_boleto` | **Primeira classe** — o ato cria instrumento pagável, isto é, *move dinheiro*. A chave já existe, reservada. |
| revogar o boleto | `TELA:financeiro` + `ACAO:solicitar_baixa_de_boleto` | **Primeira classe** — o ato torna impagável um instrumento vivo. A chave já existe, reservada. |
| entregar o boleto | `TELA:financeiro` | Leitura. Não é transição de estado; a ADR-0021 não a alcança. |
| histórico bancário | `TELA:financeiro` | Leitura. |
| criar/ler o lote | `TELA:financeiro` (+ `ACAO:emitir_boleto` no `POST`) | O `POST` é o mesmo ato de emitir, sobre um conjunto. O `GET` é leitura. |
| disparar a conferência | `TELA:financeiro` | **Segunda classe.** O único desfecho que ela grava é *acusar pagamento de cobrança*, que a `Decision` da ADR-0021 **nomeia literalmente** entre as instâncias que exigem apenas a área — *"o ato registra dinheiro que se moveu fora do sistema; ele não o move"*. Uma rota não pode exigir mais do que o efeito que ela causa exige. |

O isolamento entre empresas **não** é dessas chaves: é da RLS forçada. Nenhuma comparação de empresa é
escrita em código de aplicação (ADR-0008).

### 11.3 Criptografia

- **Em trânsito**: TLS mútuo contra o provedor, com o `.pfx` da empresa; `https:` é o **único** esquema
  aceito, e a construção do adaptador recusa qualquer outro nomeando a **variável**, jamais o valor.
- **Em repouso**: o material do certificado permanece cifrado de forma reversível
  (`segredo_cifrado`), com `CHAVE_DE_CIFRA_DO_CERTIFICADO` vivendo **fora da árvore versionada** e
  fora do pacote que salvaguarda o material (ADR-0032). Esta fatia **não muda o esquema de cifra** —
  ela apenas acrescenta um segundo processo que detém a chave.
- **Os bytes do boleto não são cifrados**, e a decisão é explícita: o boleto é documento destinado a
  ser entregue ao locatário, e a linha digitável que ele contém já é publicada pela API. Cifrá-lo
  protegeria contra um adversário que já tem leitura no filesystem do host — que também teria a
  `EnvironmentFile`.

### 11.4 Sanitização e Validação

- **Injeção de SQL**: impossível por construção — toda instrução é template marcado do postgres.js,
  com valores parametrizados. Nenhuma concatenação de SQL existe no produto.
- **SSRF**: **nenhuma entrada do usuário decide para onde o produto conecta.** O endereço vem de
  `ENDERECO_DO_PROVEDOR_BANCARIO`, lido num ponto só na partida, resolvido **uma vez** na construção
  do adaptador. Nem o corpo, nem a sessão, nem a carga da tarefa o carregam.
- **Travessia de caminho no diretório dos boletos**: o nome do arquivo é **derivado**, nunca recebido
  — `<codigo>.pdf` com o código já validado contra `ESQUEMA_DO_CODIGO_DE_COBRANCA`, que só admite
  `COB-{4 dígitos}-{7 dígitos}`. O caminho resolvido é conferido contra o diretório-base antes de
  qualquer leitura ou escrita.
- **Vocabulário do provedor (CA-20, ADR-0001)**: a conformidade é exigível **por medição da saída
  real**, e a fatia (i) já estabeleceu a forma — varredura de termos proibidos sobre o desfecho
  serializado, **com controle positivo**. Aqui ela se estende a: corpo publicado das 7 rotas, corpo de
  erro, trilha publicada, símbolos declarados nos pacotes de domínio e de contrato.

### 11.5 Rate Limiting / Anti-abuse

Nada novo. O limitador existente cobre a superfície autenticada; as duas rotas que fazem trabalho
pesado são naturalmente contidas pelos índices únicos parciais — um Admin que clique cem vezes cria
**um** lote e **uma** conferência. É contenção estrutural, e vale mais que limite por chamada.

> O **D27 · F1/T6** (o limitador sem eixo de origem) e o **D23 · F1/T8** continuam com gatilho na
> **F7**, e esta fatia não os dispara: nenhuma rota daqui é publicada atrás do servidor de borda.

### 11.6 Secrets Management

| Segredo | Onde vive | Quem lê |
|---------|-----------|---------|
| `CHAVE_DE_CIFRA_DO_CERTIFICADO` | `EnvironmentFile` 0600, `/etc/sysloc/backend.env` | conferência de partida da **api** e — **novo** — do **worker**, uma vez cada, repassando o valor |
| `.pfx` + senha da empresa | coluna `segredo_cifrado`, cifrada | `decifrarSegredo` no ponto de uso; o claro nasce na chamada e morre com ela |
| Credencial de acesso ao provedor | **memória do processo**, cache com expiração | apenas `credencial-de-acesso.ts`, interno ao adaptador |

**A superfície que pode decifrar o segredo mais forte passa de um processo para dois.** É o trade-off
declarado do D1, e ele é aceito porque a alternativa — transportar o material na carga — é o vetor
exato do achado crítico da fase anterior. O `EnvironmentFile` já é **compartilhado** entre as duas
unidades systemd: o worker já **recebe** a chave fisicamente; o que falta é consumo declarado.

**Fecha o D58 · F4/T13**: a superfície **`fila`** entra na enumeração da ADR-0032 e ganha caso que a
mede — hoje ela não é medida por não existir carga de tarefa.

---

## 12. Performance

### 12.1 Metas

- **Latência p95** das quatro rotas em linha que não falam com o provedor (entrega com arquivo
  presente, histórico, leitura de lote): **< 150 ms**, no mesmo patamar das rotas de leitura já
  publicadas.
- **Latência p95** da emissão unitária: **< 3 s** (uma ida ao provedor). Reemissão: **< 8 s** (três
  idas mais sondagem), com teto duro de 30 s.
- **Throughput**: a emissão mensal é o pico. Medido no legado: **22 emissões para 16 cobranças em
  toda a operação**. Projetado a 300 empresas × ~47 cobranças, o lote de uma empresa é ~47 idas
  sequenciais — ordem de **2 a 4 minutos**, folgadamente dentro de uma tarefa de fila.

### 12.2 Estratégias

- **Cache da credencial de acesso** por processo e por empresa (D5): num lote de 47 boletos, **uma**
  obtenção em vez de 47.
- **Índice `(empresa_id, cobranca_id, ocorrido_em DESC)`** cobre a leitura da trilha sem ordenação
  em memória. ⚠️ **Premissa falsificada por medição na T3 — ver a anotação abaixo.**
- **A janela da carteira já é paginada** e não muda; a trilha por cobrança é naturalmente pequena
  (efeito, não tentativa — é o ganho medido da ADR-0034: 1.864 → 27 eventos no volume do legado).
- **Uma consulta por cobrança na conferência**, contra ~115 por cobrança do polling atual.
- **Nenhuma chamada de rede segura conexão do banco** — a razão está em §3.3.

#### Anotação de 2026-08-16 (T3) — a segunda estratégia acima está **falsificada**

> **O texto original fica preservado, byte a byte**, no molde das emendas de ADR já praticadas neste
> repositório: é a `Decision` que se abre ao citar, e corrigir por reescrita apagaria o rastro de que
> a premissa existiu e orientou decisões. O que segue é a medição que a substitui.

**O que se mediu.** `EXPLAIN` sobre a leitura da trilha na instância efêmera, nas duas formas do
`ORDER BY` — com e sem o desempate por `id DESC`:

```
Sort  (cost=16.39..16.40 rows=3 width=82)
  Sort Key: ev.ocorrido_em DESC, ev.id DESC
  ->  Nested Loop  (cost=0.32..16.37 rows=3 width=82)
        ->  Index Scan using cobranca_empresa_contrato_idx on cobranca c
              Index Cond: (empresa_id = (NULLIF(current_setting('app.empresa_id'), ''))::uuid)
              Filter: (codigo = 'COB-2026-…'::text)
        ->  Index Scan using evento_bancario_trilha_idx on evento_bancario ev
              Index Cond: ((empresa_id = (NULLIF(current_setting('app.empresa_id'), ''))::uuid)
                           AND (cobranca_id = c.id))
```

**O `Sort` existe nas duas formas**, com custo idêntico (`16.39..16.40`) e o mesmo
`evento_bancario_trilha_idx` no lado interno do laço. A leitura da trilha **não** é coberta "sem
ordenação em memória", e o desempate por `id` — que a premissa faria parecer caro — é determinismo
**sem preço**.

**A causa.** O índice serve o **acesso**, não a **ordenação**: o planejador só deriva a ordem do
prefixo do índice quando a igualdade da primeira coluna entra na classe de equivalência como
constante, e aqui ela vem de `current_setting('app.empresa_id')` — expressão `STABLE` da política de
RLS, que não é constante para esse fim. É consequência direta da ADR-0008 (o recorte é do banco), e
não um defeito de índice a corrigir.

⚠️ **Ressalva de alcance, para que a medida não seja lida por mais do que ela é.** O `EXPLAIN` correu
sobre instância efêmera com meia dúzia de linhas — os custos denunciam tabela essencialmente vazia, e
até a cobrança foi alcançada por `cobranca_empresa_contrato_idx` com o código em `Filter`, que é
escolha de tabela minúscula. **Ele prova que o `Sort` aparece; não é evidência forte sobre a forma do
plano em volume.** A conclusão operacional sobrevive assim mesmo porque a trilha é pequena **por
construção** (é o conteúdo da ADR-0034: 1.864 → 27 eventos), e não porque o volume tenha sido medido.
Trocar uma premissa frágil por outra seria repetir o defeito que esta anotação fecha.

### 12.3 Limites Conhecidos

- **O lote é sequencial** (D2): uma cobrança lenta atrasa as seguintes do mesmo lote. Aceito — a
  emissão é mensal, e o paralelismo exigiria coordenação que a feature não pede.
- **O teto do lote é o do provedor**, não o nosso: 47 idas a ~1,5 s cada.
- **Dois processos mantêm caches de credencial independentes** — no pior caso 2 obtenções por empresa
  a cada 5 min. Irrisório, e declarado.
- **A reserva de conexões é uma só** para o processo inteiro, no tamanho padrão de `postgres.js`. É
  por isso que nenhuma chamada externa corre dentro de `sql.begin`.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| boleto emitido | `info` | `empresaId`, `entidade: 'cobranca'`, `codigo`, `origem` | **sem** valor monetário, **sem** dado do locatário |
| emissão recusada | `warn` | `empresaId`, `codigo`, `classe` (`DA_COBRANCA`\|`DA_EMPRESA`) | o `detalhe` é texto **do produto**, de conjunto fechado |
| lote concluído | `info` | `empresaId`, `loteId`, `emitidas`, `recusadas` | só contagens |
| lote interrompido | `error` | `empresaId`, `loteId`, `motivo` | idem |
| conferência concluída | `info` | `empresaId`, `conferenciaId`, `cobrancasConferidas`, `efeitos` | só contagens |
| cobrança liquidada / estornada | `info` | `empresaId`, `codigo`, `tipo`, `origem` | sem valores |
| divergência de valor | `warn` | `empresaId`, `codigo` | **sem** os dois valores — eles vão para a trilha, que é escopada por empresa |
| falha do produtor de fila | `warn` | erro **construído**, causa reduzida a texto | `DECISÃO FECHADA — T9 / Gate 2` |

Pino, JSON, com a redação única de `@sysloc/shared/log.ts`. **A trilha registrada em banco e o
registro estruturado são coisas diferentes**, e a ADR-0034 é explícita: ela *"não alcança o registro
operacional de diagnóstico, que permanece livre para registrar todo contato"*. Consulta sem efeito
**não** vira evento; ela **pode** virar linha de `debug`.

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---------|------|--------|----------|
| — | — | — | — |

**N/A — o produto não tem coletor de métricas.** O `decisao-e-stack.md` §4 lista OpenTelemetry como
planejado, mas ele **não existe** nos manifests nem em `import` de `src/` (aviso da Stack no
`CLAUDE.md`), e introduzi-lo é decisão de fase, não desta fatia. O que existe é o **registro
estruturado**, e as contagens que uma métrica daria — emitidas, recusadas, conferidas, efeitos —
estão nas linhas de §13.1 **e** nas colunas de `emissao_em_lote` e `conferencia_bancaria`, isto é,
consultáveis por SQL.

### 13.3 Tracing

**N/A — não há tracing distribuído no produto**, pela mesma razão da §13.2. A correlação possível
hoje é por `loteId`/`conferenciaId`, que atravessa a borda HTTP, a carga da tarefa e todas as linhas
de registro do percurso. É o que existe, e é declarado como tal.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| — | — | — | — |

**N/A nesta fatia.** Não há despachante de alertas no produto; o `plano-execucao.md` põe *rotina
atrasada* na **F5**, junto do timer. O que esta fatia entrega no lugar é **estado consultável**: lote
`INTERROMPIDA` com motivo, e conferência sem `concluida_em` há muito tempo — as duas condições que um
alerta futuro observaria, já persistidas e legíveis.

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma, e a ausência é decisão.** O produto não tem solução de bandeira e não ganha uma aqui.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

O que poderia parecer bandeira nesta fatia **não é**: o `PIX` do enum `MEIOS_DE_RECEBIMENTO` é
declarado e não tem operação, e o `modelo-canonico.ts` já registra por que isso **não** é bandeira
desligada — *"bandeira desligada esconde código pronto; aqui não há código a esconder"*, e a ausência
é afirmada por lista vazia no `CT-835`. Esta fatia **preserva** essa propriedade: nenhum caminho de
execução novo consome `PIX`.

---

## 15. Versionamento de API

### 15.1 Estratégia

**Prefixo no caminho** (`/v1/...`), como todo o produto. As sete rotas nascem em `v1`. Nenhuma rota
existente muda de forma.

### 15.2 Compatibilidade

- **Acréscimo compatível**: `esquemaDaCobranca` vai de 18 para 23 campos. É **saída aberta**
  (`z.object`) justamente para que campo novo nasça sem quebrar cliente já publicado — e o frontend
  ainda não consome nenhuma das rotas.
- **Nenhuma remoção, nenhuma renomeação** de campo publicado.
- **Congelamento**: a superfície fecha em 99/84 *nesta* fatia, mas **não congela aqui** — a fatia
  (iii) e a F5 ainda publicam rota. O congelamento do marco de entrega é depois delas.

### 15.3 Schemas / Contratos

`@sysloc/contracts` é a **fonte única** (ADR-0016): a conferência de entrada, o tipo do TypeScript e o
documento OpenAPI derivam do mesmo esquema. Não há registry externo nem validação de contrato em CI
além da própria suíte — e não há cliente ts-rest: o pacote é **Zod puro**, e é ele que o frontend
importa no marco de entrega.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD neste projeto — **nativo, sem Docker**, instalado e verificado por script no próprio
host. Os gates são a suíte (`pnpm test`, por pacote), a análise estática (`pnpm lint`, que encadeia
`pnpm lint:shell`) e os verificadores de `deploy/scripts/`.

### 16.2 Empacotamento

Nenhum. Os dois processos sobem por **unit systemd** com `Restart=always`, do fonte compilado por
`pnpm build` (Turborepo). Esta fatia **não cria unidade nova** — os dois consumidores entram no
processo de trabalho existente.

### 16.3 Infraestrutura como Código

Não há Terraform/Helm. O equivalente do projeto é `deploy/scripts/instalacao/`, versionado e
idempotente (ADR-0005). Esta fatia acrescenta ali:

- criação de `DIRETORIO_DOS_BOLETOS` com dono e modo corretos;
- semeadura da variável no `EnvironmentFile`;
- `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`, no vocabulário de asserção do
  projeto (`caso` / `ok` / `afirmar_igual` / `fechar_caso`), com `exit 0` **se e somente se**
  `falhas_totais == 0`.

**Fecha a lacuna de provisionamento que o `D39 · F1` sinaliza**, no que toca a esta fatia.

### 16.4 Estratégia de Rollout

Reinício das duas unidades após `pnpm build` e `migrar-banco.sh`. **A ordem importa e é a de
sempre**: migração primeiro, processos depois — as migrações desta fatia são puramente aditivas
(tabelas e enums novos), de modo que o código anterior continua correto contra o esquema novo. Não há
blue-green nem canário: é um host, dois processos, e a operação segue no `/opt/frappe` até a F7.

### 16.5 Escalabilidade

Vertical, num host. O ganho de escala desta fatia não é de processo: é a **troca da varredura pela
conferência dirigida**, que corta as consultas ao provedor de ~115 por cobrança para no máximo uma por
dia por cobrança alcançada. A fatia (iii) corta de novo, ao trocar a passada pela notificação.

### 16.6 Rollback

- **Código**: reverter o commit e reconstruir. As tabelas novas ficam órfãs e inertes — nenhum
  caminho antigo as lê.
- **Esquema**: **não há descida**. O caminho de volta é a restauração de backup, e é por isso que o
  item 1 da F7 (backup provado num banco vazio) é critério do marco de entrega.
- **Efeito externo já produzido**: boleto emitido no provedor **não volta** por rollback de código. É
  a assimetria própria desta fatia, e ela é a razão de a revogação do boleto ser uma operação de
  primeira classe, com rota e chave próprias.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | Tabela `emissao_em_lote` com índice único parcial; fila `emissao-em-lote`; `CargaDaEmissaoEmLote`; predicado `selecionarCobrancasSemBoleto` | §7.2, §9.1, `packages/db/src/emissao-em-lote.ts`, `apps/worker/src/tarefas/emissao-em-lote.ts` |
| US-02 | Tabela `item_da_emissao_em_lote` + `esquemaDaEmissaoEmLote` com `itens[]`, `emitidas`, `recusadas` | §7.2, §4.2, `packages/contracts/src/cobranca-bancaria.ts` |
| US-03 | `ClasseDaFalha` no modelo canônico; `interrompido_em` + `motivo_da_interrupcao` com `check` bicondicional | §6.3, §7.2, `packages/cobranca-bancaria/src/modelo-canonico.ts` |
| US-04 | `reemitirBoleto` com sondagem de limite nomeado; três das quatro operações da porta | §5.2 A–C, §8, `packages/cobranca-bancaria/src/reemissao.ts` |
| US-05 | Rota de bytes conforme ADR-0028; `guarda-de-boletos.ts`; `consultarSituacao({ incluirDocumento: true })` | §4.1, §11.4, `apps/api/src/cobrancas/boleto.service.ts` |
| US-06 | `acusarPagamentoDeCobranca` **reusada sem alteração** + `data_credito`/`valor_creditado` | §5.1, `packages/db/src/cobranca.ts` (R), `boleto-da-cobranca.ts` |
| US-07 | `estornarLiquidacao` — uma instrução apaga fato e os quatro carimbos; estado volta a derivar da view | §5.2 H, §6.3, `packages/db/src/boleto-da-cobranca.ts` |
| US-08 | Tabela `evento_bancario` com enum fechado de 6 tipos e 2 origens; índice `(empresa_id, cobranca_id, ocorrido_em DESC)` | §7.2, §4.2, `packages/db/src/evento-bancario.ts` |
| US-09 | Tabela `conferencia_bancaria` com índice único parcial; `iniciadaAgora` no corpo | §4.1.1, §7.2, §9.2 |
| US-10 | `revogarBoleto` **não nomeia `cancelado_em` no `SET`** — garantia estrutural | §6.3 (RN-09/RN-10), `packages/db/src/boleto-da-cobranca.ts` |
| US-11 | `selecionarCobrancasAConferir` — predicado único com janela de 30 dias contra `data_corrente_da_operacao()` | §5.1, ADR-0023, ADR-0026 |
| US-12 | `esquemaDaCobranca` 18 → 23 campos; `LinhaDeCobranca` estendida | §4.2, `packages/contracts/src/cobranca.ts`, `packages/db/src/cobranca.ts` |
| US-13 | Modelo canônico sem termo do provedor; tradução morre no adaptador; varredura com controle positivo | §11.4, §19, §21.1 |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | NestJS + Fastify | 11 / 5 | Já em uso — as 7 rotas entram na borda existente |
| ORM / driver | Drizzle + drizzle-kit + postgres.js | em uso | Declaração do esquema e execução |
| Cliente HTTP | **`node:https` (nativo)** | Node 24.18.1 | Único cliente que completa TLS mútuo com `.pfx` sem despachante (medição M3). **`undici` avaliado e recusado** |
| Mensageria | BullMQ + ioredis | em uso | Duas filas novas, mesma política de `@sysloc/shared` |
| Criptografia | `node:crypto` | Node 24.18.1 | Cifra reversível do material (já em uso) |
| Validação | Zod | 4 | Fonte única do contrato (ADR-0016) |
| Observabilidade | Pino | em uso | Registro estruturado com redação única |
| Testes | Vitest + `embedded-postgres` | 4.1.10 | Fronteira real |

> **Nenhuma dependência nova é introduzida por esta fatia.** É propriedade, não coincidência: o
> `packages/cobranca-bancaria` segue com **zero dependência externa**, e o PDF do boleto **não é
> composto pelo produto** — ele chega pronto do provedor (a cláusula de exclusão da ADR-0030 o nomeia
> por escrito). O `@react-pdf/renderer` é do contrato e do **carnê**, que é da fatia (iii).

---

## 19. Estratégia de Testes

> **Resumo**: **37 casos de teste** | Unitários: 5 | Integração: 21 | E2E: 4 | Segurança: 7
> **Padrão**: Vitest 4.1.10 · `embedded-postgres` (instância efêmera própria) · HTTP real em porta
> dinâmica · fila real efêmera. **Mock evitado por decisão** — os dublês desta fatia são
> **implementações da porta**, nunca `vi.mock`/`vi.fn`/`vi.spyOn`. Nomes de caso na convenção
> `CA-xx → CT-xxx (RN-xx)`, com seção INVARIANTES por arquivo.
> **Numeração**: `CT-911` a `CT-947`. ⚠️ A faixa foi **medida, não estimada**: o maior identificador
> vivo da base é o **`CT-910`**, e os `CT-901`…`CT-910` pertencem à barreira executável do Protocolo
> Antirregressão (`packages/shared/test/protocolo-antirregressao.spec.ts`, commit `c0453d2`). Uma
> versão anterior desta spec supunha a base parada em `CT-843` e teria colidido em dez IDs.
> **32 dos 37 casos atravessam fronteira real.** A distribuição **não segue a pirâmide 60/30/10**, e é
> deliberado: as invariantes centrais desta fatia são restrição de banco (índices únicos parciais, RLS
> forçada, enums fechados), contrato HTTP e ordem de composição contra terceiro — nenhuma delas é
> observável sem fronteira real.

**Como rodar** — `pnpm --filter @sysloc/<pacote> test`, **nunca** `vitest run` avulso. Sete dos nove
pacotes resolvem `.` por `exports` para `dist/`, e uma suíte que carregue o SUT pela fronteira do
pacote leria o `dist/` da compilação anterior: o defeito reintroduzido nunca executaria, e o verde
seria lido como *"a asserção não pega o defeito"*. Numa fatia cujo eixo é segurança, **prova
inconclusiva é pior que prova ausente**.

**Três asserções estáticas, e só três** — `CT-933`, `CT-936` e `CT-946`. As três exigem **prova de
falsificação** registrada; as outras 33 são comportamentais e a dispensam. Já o **controle positivo é
exigido em toda varredura** de não-vazamento e de vocabulário — `CT-933`, `CT-934`, `CT-935`, `CT-939`
e `CT-946` —, com a lista de achados afirmada **por igualdade, canal a canal**.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | O lote alcança só as cobranças certas da competência | CT-911, CT-944 |
| CA-02 | Prestação de contas nomeando cada cobrança e a razão | CT-912, CT-913 |
| CA-03 | Falha da empresa interrompe o lote no ponto | CT-914, CT-944 |
| CA-04 | Reexecutar tenta só quem ainda não tem boleto | CT-915, CT-916 |
| CA-05 | Reemissão revoga o boleto antes de emitir | CT-917 |
| CA-06 | Revogação aceita + emissão falha ⇒ sem boleto, declarado | CT-918 |
| CA-07 | Entrega do boleto, com linha digitável e código de barras | CT-919, CT-945 |
| CA-08 | Arquivo ausente é rebuscado do provedor | CT-920, CT-947 |
| CA-09 | Boleto nunca emitido é recusa nomeada, sem documento | CT-921, CT-945 |
| CA-10 | Liquidação com data/valor do provedor e mora vigente | CT-922 |
| CA-11 | Valor divergente baixa assim mesmo e registra | CT-923 |
| CA-12 | Estorno devolve a cobrança ao estado derivado | CT-924 |
| CA-13 | Histórico na ordem em que ocorreu, com data e desfecho | CT-925, CT-938, CT-939 |
| CA-14 | Cobrança de outra empresa responde como inexistente | CT-926, CT-940, CT-946 |
| CA-15 | Conferência só da empresa dele; disparo não duplica | CT-927, CT-928, CT-941, CT-942 |
| CA-16 | O conjunto da conferência é exato, nem a mais nem a menos | CT-929 |
| CA-17 | Boleto revogado **não** cancela a cobrança | CT-930 |
| CA-18 | Emitir de novo após a revogação ocorre como a primeira | CT-931 |
| CA-19 | Os seis campos deixam de nascer órfãos | CT-919, CT-922, CT-932 |
| CA-20 | Vocabulário do provedor não vira regra nem estado | CT-930, CT-933, CT-934, CT-935, CT-936, CT-937, CT-939, CT-943 |

---

### 19.1 Testes Unitários

#### Domínio: `reemitirBoleto` (`packages/cobranca-bancaria/test/reemissao.spec.ts` — **novo**)

Mock: nenhum. Implementação de teste da porta `AdaptadorCobrancaBancaria`, que registra a sequência
de operações invocadas.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-917 | a reemissão revoga, confirma e só então emite | CA-05 | Sobre cobrança com boleto vivo, `emitir` **nunca** é invocado antes de a confirmação retornar positiva | cobrança com boleto vivo; adaptador confirma na 3ª sondagem | sequência **por igualdade de lista**: `['solicitarRevogacaoDeBoleto','confirmarRevogacaoDeBoleto'×3,'emitir']` | implementação da porta | **espera injetada pela assinatura** de `reemitirBoleto` (o teste passa uma que resolve na hora), no molde do relógio injetado do `CT-943` — nunca `vi.useFakeTimers`, nunca pausa fixa |

> `real_execution_boundary: none` é deliberado — a invariante é de **ordem de composição**, observável
> sem I/O. O companheiro de integração exigido pela Mock Budget Rule é o **CT-931**, que mede a mesma
> invariante atravessando HTTP e banco reais. O limite da sondagem é **constante nomeada no topo do
> arquivo**, nunca número mágico nem pausa fixa.

#### Domínio: porta `AdaptadorCobrancaBancaria` (`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` — **estendido**)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-933 | a porta declara exatamente quatro operações, sem termo do provedor | CA-20 | Os membros da porta são exatamente os quatro declarados, a implementação de referência tem essas chaves, e nenhum nome que a atravessa carrega termo do provedor | fontes do pacote + a lista escrita por extenso | membros `=== ['emitir','solicitarRevogacaoDeBoleto','confirmarRevogacaoDeBoleto','consultarSituacao']`; `Object.keys(referência)` igual; `ocorrenciasDeTermos(...) === []` **com controle positivo devolvendo a lista completa** | implementação de referência anotada com o tipo | — |

> ⚠️ **QUATRO, não cinco** — a divergência declarada da §21.1(1). O executor **preserva a razão por
> escrito no docblock**, senão a rodada seguinte "corrige" para cinco e reabre o debate.
> ⚠️ **`AdaptadorCobrancaBancaria` sai de `TERMOS_DO_PROVEDOR`** (hoje o 10º item, marcado como *nome
> reservado*): esta fatia passa a **usar** o nome, e mantê-lo na lista faria a varredura reprovar o
> próprio símbolo que a ADR-0001 mandou criar. **`pagador` permanece na lista** — o modelo canônico
> não pode nomear campo assim. **Asserção estática: exige prova de falsificação.**

#### Infraestrutura: `adaptador-sicoob.ts` (`packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` — **estendido**)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-943 | a credencial é reaproveitada por processo e por empresa, e renovada por expiração | CA-20 | Uma obtenção por empresa enquanto viva; nova após o prazo; a credencial de uma empresa nunca é usada em chamada de outra | 10 operações de A + 10 de B, relógio cruzando 300 s entre a 5ª e a 6ª de A | obtenções **`=== 3` exatas** (A inicial, A renovada, B inicial) — nunca 20 nem 2; credencial de B nunca apresentada em chamada de A | implementação da porta | imite `adaptador-sicoob.spec.ts`: **fonte de tempo injetada pela assinatura** do criador do adaptador — nunca `vi.useFakeTimers`, nunca pausa fixa; o prazo é constante nomeada no topo |

> **Fecha o `D36 · F4/T10`.** `clock` **não** conta como fronteira de execução real; o companheiro de
> integração é o **CT-935**.

#### Borda de processo: `lerAmbiente` do worker (`apps/worker/test/ambiente.spec.ts` — **estendido**)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-936 | o worker recusa a partida sem qualquer das três variáveis novas | CA-20 | A lista de exigidas cresce de **6 para 9**, e ausência **ou valor em branco** falha nomeando a variável — jamais ecoando o valor | ambiente completo; sem cada uma das três; com `'   '` em cada uma | `VARIAVEIS_EXIGIDAS.length === 9` e o conjunto por **igualdade** contra a lista escrita por extenso; as seis falhas nomeiam `CHAVE_DE_CIFRA_DO_CERTIFICADO`, `ENDERECO_DO_PROVEDOR_BANCARIO` e `DIRETORIO_DOS_BOLETOS`; nenhuma mensagem **contém o valor** | — | — |

> ⚠️ **São TRÊS, e o número é 9 — medido, não estimado.** `VARIAVEIS_EXIGIDAS` tem hoje **6** itens
> (`apps/worker/test/ambiente.spec.ts:136`), e a §3.6 acrescenta três: a chave de cifra (decifra o
> material), o endereço do provedor (constrói o adaptador na composição raiz do worker) e o diretório
> dos boletos (a §6.1 já o exige na partida dos **dois** processos, e o passo 6 de §5.1 grava bytes
> ali). Uma versão anterior desta spec escrevia `=== 7` cobrindo só a primeira — e o **`CT-643`**,
> que compara este conjunto com o que a execução de `lerAmbiente` revela, reprovaria a divergência.
>
> A suíte já **parametriza por `VARIAVEIS_EXIGIDAS`**: acrescentar as três faz os casos existentes
> cobrarem as novas. ⚠️ O **`CT-643`** dessa suíte cobra caminho de provisionamento para toda variável
> exigida — o executor acrescenta a nova ao `.env.example` **e** à unidade systemd, senão o `CT-643`
> reprova. **Essa reprovação seria correta, não regressão.** **Asserção estática: exige prova de
> falsificação.**

#### Contrato: esquemas publicados (`packages/contracts/test/esquemas.spec.ts` — **estendido**)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-942 | entrada recusa chave desconhecida nomeando-a; saída aceita campo novo | CA-15 | A **direção decide a estritude**: entrada `z.strictObject`, saída `z.object` | corpo válido; corpo com `empresaId` a mais; saída com campo extra | `erro.code === 'unrecognized_keys'` **e** `erro.keys` `toEqual(['empresaId'])` — nunca só `success === false`; a saída com campo extra **passa** | — | — |

> `empresaId` é a chave certa para o caso: é exatamente a que o **invariante 2** do projeto proíbe ler
> do pedido.

---

### 19.2 Testes de Integração

#### Dados — seleção e concorrência do lote (`packages/db/test/emissao-em-lote.spec.ts` — **novo**)

Setup: instância efêmera de PostgreSQL com as migrações `0000..0018`; empresas semeadas; contexto de
tenant aberto pela unidade de trabalho real (`contextoDeTenant.executarCom` + `SET LOCAL`).

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-911 | a seleção é exatamente a competência em aberto sem boleto | CA-01 | Devolve exatamente as elegíveis — nem uma a mais, nem uma a menos | 7 cobranças: 3 elegíveis + 4 intrusas (paga, cancelada, já com boleto, competência vizinha) | `diferencasDeConjunto(...)` `=== { excedentes: [], ausentes: [] }` **e** contagem igual — controle antivácuo pelas 3 elegíveis lidas | imite `packages/db/test/cobranca.spec.ts` (CT-536, CT-532) e `isolamento.spec.ts`: contexto pela unidade de trabalho real, **nunca** acrescentar `empresaId` à assinatura de produção |
| CT-916 | o índice único parcial impede dois lotes concorrentes | CA-04 | Segundo lote da mesma empresa é recusado **pelo banco**; o da empresa B é aceito; concluído o primeiro, um novo de A passa | insert de lote 1 de A → insert de lote 2 de A → insert de B → concluir 1 → novo de A | 2º insert de A levanta `code === '23505'` nomeando o índice; B aceito; **após concluir, novo de A é aceito** (prova que o índice é **parcial**, não total) | imite `packages/db/test/isolamento.spec.ts`: duas empresas por semente real, cada contexto pela unidade de trabalho |

#### Domínio — percurso do lote (`packages/cobranca-bancaria/test/emissao-em-lote.spec.ts` — **novo**)

Setup: instância efêmera de PostgreSQL; implementação de teste da porta que decide **por cobrança**.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-912 | o lote presta contas nomeando cada recusada e a razão | CA-02 | Um item por cobrança tentada; todo `RECUSADO` carrega `motivo` não-nulo e o `cobranca_id` certo | lote de 5; adaptador recusa a 2ª e a 4ª com textos distintos | 5 itens; 3 `EMITIDO` com `motivo IS NULL`; 2 `RECUSADO` com `motivo` **byte a byte** igual ao informado e códigos por igualdade de conjunto; `concluido_em` não-nulo | imite `vocabulario-canonico.spec.ts` (CT-809): implementação anotada com o tipo da porta. **Não** `vi.mock`, **não** ramo de teste no adaptador de produção |
| CT-913 | recusa de cobrança gera evento e o lote **segue** | CA-02 | A falha marca só aquela cobrança e não interrompe: as posteriores são tentadas | lote de 5; a 2ª recusada | posições 1,3,4,5 com `nosso_numero` não-nulo; a 2ª `IS NULL`; 1 evento `{EMISSAO_RECUSADA, ATO_DO_ADMIN}` com `diagnostico` igual ao texto; `interrompido_em IS NULL` | idem CT-912 |
| CT-914 | falha da empresa interrompe no ponto e preserva o emitido | CA-03 | Nenhuma cobrança **posterior** ao ponto é tentada; toda anterior permanece emitida | lote de 6; falha `DA_EMPRESA` na 3ª | `interrompido_em` e `motivo_da_interrupcao` não-nulos; **exatamente 2 itens**; posições 4,5,6 sem item e com `nosso_numero IS NULL`; `concluido_em IS NULL` | idem CT-912, com contador próprio no escopo do teste |
| CT-915 | reexecutar tenta apenas quem não tem boleto | CA-04 | O 2º lote seleciona o **complemento** do 1º, e nenhuma cobrança termina com dois identificadores | 1º lote emite 4 de 6 → retrato → 2º lote aceita tudo | 2º lote grava **exatamente 2** itens; as 4 já emitidas mantêm `nosso_numero` **idêntico ao retrato**; os 6 `identificador_no_provedor` têm 18 posições e são **distintos entre si por igualdade de conjunto** — o contador nunca reusa (ADR-0020/0033) | produzir o estado executando o 1º lote pelo caminho real — **nunca** escrever `nosso_numero` direto na tabela |

> A contagem **exata** de itens no CT-914 é o que separa *"interrompeu"* de *"tentou todas e recusou
> 4"*: uma asserção por presença de `interrompido_em` passaria nos dois SUTs. E a comparação contra o
> retrato no CT-915 é o que prova a idempotência — sem ela, um SUT que reemitisse todas passaria.

#### Apresentação + Domínio — reemissão, entrega e publicação (`apps/api/test/boleto-da-cobranca.e2e.spec.ts` — **novo**)

Setup: servidor HTTP real em porta dinâmica; diretório de boletos apontado para `tmpdir` descartável;
sessões pelo acessório `pedir`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-918 | revogação confirmada + emissão falha ⇒ sem boleto, nomeado | CA-06 | Termina sem boleto, em aberto, nomeando a cobrança; **em nenhum instante** houve dois identificadores vivos | retrato → `POST` de reemissão → adaptador confirma a revogação e recusa a emissão | `503` com envelope **asserido como objeto inteiro** `{ codigo: 'SERVICO_INDISPONIVEL', mensagem: <inclui o código> }`; no banco `nosso_numero`, `pago_em` e `cancelado_em` `IS NULL`; trilha com exatamente 2 eventos | imite `cobrancas.e2e.spec.ts` e `certificado-do-provedor.e2e.spec.ts` (`pedir`); o adaptador vem pela composição da aplicação de teste — **nunca** exportar símbolo novo da produção |
| CT-920 | arquivo ausente é rebuscado e reescrito, sem quem pediu perceber | CA-08 | `200` com os **mesmos bytes**, arquivo recriado, e as três colunas intactas | pedir → guardar bytes e retrato → apagar o arquivo → pedir de novo | antes: `existsSync === false` (**controle antivácuo**); depois: `200`, corpo **idêntico byte a byte**, `existsSync === true`, colunas idênticas, **nenhum evento novo** (rebusca de cache não é efeito — ADR-0034) | apagar o **arquivo** no `tmpdir` com `fs` real, nunca alterar a coluna — isso simularia outro defeito |
| CT-921 | boleto nunca emitido é recusa nomeada, jamais em branco | CA-09 | `404` nomeando a cobrança, e **nenhum byte de documento** no corpo | `GET` do boleto de cobrança sem emissão | `404` com `{ codigo: 'RECURSO_NAO_ENCONTRADO', mensagem: <inclui o código> }` por igualdade de objeto; `content-type` é JSON e **não** PDF; corpo **não** começa com `%PDF-` | imite `cobrancas.e2e.spec.ts` |
| CT-932 | os campos de conciliação deixam de nascer órfãos, e os **cinco publicáveis** são publicados | CA-19 | A publicação distingue **ausência** de valor: `null`, nunca string vazia nem chave omitida | consultar recém-criada → emitir → consultar → liquidar → consultar | estado 1: as chaves existem e valem `null`; estado 2: `numeroDoTituloNoProvedor`, `linhaDigitavel`, `codigoDeBarras` não-nulos e os de crédito ainda `null`; estado 3: `dataDoCredito` e `valorCreditado` preenchidos; conjunto de chaves por **igualdade** contra a lista do contrato | percorrer os três estados pelos caminhos reais |

> ⚠️ **CT-932 — a chave publicada NÃO pode ser `nossoNumero`.** Esse literal está em
> `TERMOS_DO_PROVEDOR`, e publicá-lo faria a varredura da CA-20 reprovar. A coluna física continua
> `nosso_numero`; a chave publicada é `numeroDoTituloNoProvedor` (§4.2, §21.1(3)).

#### Dados — liquidação, divergência e estorno (`packages/db/test/boleto-da-cobranca.spec.ts` — **novo**)

Setup: instância efêmera de PostgreSQL; política de mora vigente; datas posicionadas contra
`negocio.data_corrente_da_operacao()`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-922 | a baixa do provedor carimba a mora **igual** à baixa manual | CA-10, CA-19 | *A mesma regra, sem exceção por caminho de entrada* (RN-07) — provado contra o caminho de produção existente, nunca contra conta refeita no teste | duas cobranças **gêmeas** sob a mesma política; uma liquidada pela conferência, outra por `acusarPagamentoDeCobranca` | `pago_em`/`valor_pago` iguais aos informados; **os quatro carimbos idênticos campo a campo entre as duas**; 1 evento `{COBRANCA_LIQUIDADA, CONFERENCIA}` | imite `cobranca.spec.ts` (CT-527, CT-532) e `mora.e2e.spec.ts`. **O oráculo é a baixa manual** — re-derivar a mora no teste seria reimplementar o SUT |
| CT-923 | valor divergente baixa assim mesmo e registra | CA-11 | A divergência **não impede** a baixa | provedor informa `1000.00` para esperado `1234.56` | `pago_em` **não-nulo** e `valor_pago === '1000.00'`; exatamente 2 eventos, tipos por igualdade de conjunto `['COBRANCA_LIQUIDADA','DIVERGENCIA_DE_VALOR']`, o 2º com `valor_informado === '1000.00'` | o *valor esperado* é lido da view `cobranca_derivada`, não escrito pelo teste |
| CT-924 | o estorno apaga o fato e o estado volta a **derivar** | CA-12 | Os **oito** campos escritos pela liquidação voltam a `NULL` e a view recalcula conforme o vencimento | duas pagas — uma vencida há 10 dias, outra a vencer em 10 — estornadas | nas duas: `pago_em`, `valor_pago`, os **quatro** carimbos **e os dois de crédito** `IS NULL`; os campos de emissão (`nosso_numero`, `linha_digitavel`, `codigo_barras`) permanecem **não-nulos** — controle que separa estorno de revogação; a view publica `'VENCIDA'` numa e `'A_VENCER'` na outra; 1 evento `LIQUIDACAO_ESTORNADA` cada; `cancelado_em IS NULL` | posicionar os vencimentos contra `data_corrente_da_operacao()` do banco, **nunca** `new Date()` — imite `derivacao-de-cobranca.spec.ts` (CT-506) |

> **Os dois lados do vencimento no mesmo caso** (CT-924) são o que prova que o estado voltou a ser
> **derivado**, e não gravado: uma implementação que gravasse estado fixo acertaria um lado e erraria
> o outro.

#### Domínio/Dados — conferência (`packages/cobranca-bancaria/test/conferencia.spec.ts` — **novo**)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-929 | o conjunto da conferência é exato — nem a mais, nem a menos | CA-16 | União de *em aberto com boleto* e *paga há ≤30 dias com boleto*, com a fronteira medida contra o relógio do banco | matriz com as bordas 29/30/31 dias + em aberto sem boleto + cancelada com boleto + de outra empresa | `diferencasDeConjunto === { excedentes: [], ausentes: [] }`; **29 e 30 dentro, 31 fora**; as três exclusões ausentes | posicionar `pago_em` contra `data_corrente_da_operacao()` — imite `derivacao-de-cobranca.spec.ts` (CT-506) e `cobranca.spec.ts` (CT-513) |
| CT-930 | boleto revogado pelo provedor **não** cancela a cobrança | CA-17, CA-20 | Motivo reconhecido **ou não** produz o mesmo desfecho, e o motivo é preservado como diagnóstico | duas cobranças: motivo reconhecido e `'MOTIVO-INEXISTENTE-99'` | nas duas: `cancelado_em IS NULL`, `nosso_numero IS NULL`, status em `['VENCIDA','A_VENCER']`; evento `BOLETO_REVOGADO` com `diagnostico` **byte a byte** igual ao informado | a implementação da porta devolve o motivo como **texto opaco**; o produto **não** tem enum que o reconheça — é o que a RN-15 exige |
| CT-938 | a trilha registra efeito e **nunca** a tentativa que nada mudou | CA-13 | Zero eventos numa passada sem efeito, com `cobrancas_conferidas` registrando a passada mesmo assim | 1ª conferência: 5 cobranças, nada mudou · 2ª: 1 das 5 liquidou | 1ª: delta de eventos `=== 0`, `cobrancas_conferidas === 5`, `efeitos === 0` · 2ª: delta `=== 1`, `efeitos === 1`. **Nenhum evento de tipo `CONFERENCIA` existe** | imite `cobranca.spec.ts` (CT-521) |

> **O contraste com a 2ª conferência é obrigatório** (CT-938): sem ele, um escritor de eventos quebrado
> produziria zero nos dois casos e passaria. ⚠️ A ADR-0034 **exclui** o registro operacional de
> diagnóstico do seu alcance — *"nenhuma leitura desta ADR autoriza apagar o segundo"*. O caso **não
> deve** asserir ausência de linha de diário; o que ele mede é a **trilha publicada**.

#### Apresentação — trilha e conferência

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-925 (`apps/api/test/historico-bancario.e2e.spec.ts` — **novo**) | o histórico publica na ordem em que ocorreu | CA-13 | A **ordem** é o conteúdo da CA-13 | emitir → revogar → reemitir → liquidar → `GET` do histórico | lista de `tipo` por **igualdade de lista ordenada**: `['BOLETO_EMITIDO','BOLETO_REVOGADO','BOLETO_EMITIDO','COBRANCA_LIQUIDADA']`; `ocorridoEm` não-decrescente; `diagnostico` da revogação igual ao informado | produzir os quatro efeitos pelos **caminhos reais** — nunca inserir eventos direto na tabela, o que provaria a consulta e não o produtor |
| CT-928 (`apps/api/test/cobranca-bancaria.e2e.spec.ts` — **novo**) | disparo concorrente não inicia uma segunda conferência | CA-15 | Nenhuma linha nova, e quem pediu é informado de qual está em curso | disparar A → disparar A de novo → disparar B → concluir A → disparar A | após o 2º de A, `count === 1`; resposta `200` com o **mesmo id** da primeira; B cria a sua; **após concluir, novo de A é aceito** (índice **parcial**) | abrir a 1ª pela própria rota e mantê-la aberta **pelo estado do banco** — nunca por pausa fixa; se precisar esperar, sondagem com limite nomeado |

#### Dados — enums e migrações

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-939 (`packages/db/test/evento-bancario.spec.ts` — **novo**) | os enums da trilha são fechados e o banco recusa valor fora deles | CA-13, CA-20 | Seis tipos e duas origens, impostos **pelo banco** | ler `pg_enum` → comparar → tentar `tipo='CONFERENCIA'` e `origem='PROVEDOR'` | rótulos por igualdade de lista ordenada; os dois inserts inválidos levantam `code === '22P02'`; varredura dos oito literais devolve `[]` **com controle positivo** | consultar `pg_enum`/`pg_type` na instância efêmera — **não** derivar do fonte TypeScript, o que poria o artefato sob prova nos dois lados |
| CT-946 (`packages/db/test/coerencia-de-migracoes.spec.ts` — **estendido**) | as migrações separam gerado de autoral, e o ledger fica coerente | CA-14 | `0017` sem cláusula de segurança; `0018` sem DDL gerada | detector contra fonte de controle misturado → contra `0017` e `0018` → ledger | o controle **acusa** a mistura nomeando as duas naturezas; `0017` sem `CREATE POLICY`/`FORCE`; `0018` sem `CREATE TABLE`; ledger casa com o disco; `0018` nomeia as quatro tabelas em `FORCE ROW LEVEL SECURITY` | — |

> ⚠️ **CT-946: asserção estática — exige prova de falsificação.** E o **`D20 · F3/T7` alcança a `0010`,
> não esta**: nada aqui autoriza editar a `0010`.

#### Borda de tarefa (`apps/worker/test/emissao-em-lote.spec.ts` — **novo**)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-944 | a tarefa abre o contexto pela carga e recusa carga sem empresa | CA-01, CA-03 | Recusa **antes** de qualquer leitura — sem correr o trabalho e devolver vazio como se fosse sucesso | carga válida → sem `empresaId` → `empresaId` não-UUID → com campo extra | válida: itens gravados sob o contexto de A. Inválidas: recusa **nomeando o campo**, e a contagem de itens permanece a mesma (**delta `0`**). Campo extra não altera o contexto | imite `apps/worker/test/regua.spec.ts`: tarefa montada pelo contrato de fila de `@sysloc/shared`; **recusa primeiro, contexto depois** |

> A contagem inalterada após a recusa é o que discrimina *"recusou"* de *"correu sem contexto e não
> achou nada"* — que o docblock de `regua.ts` nomeia como **o pior modo de falha possível**.

---

### 19.3 Testes End-to-End (E2E)

#### Fluxo: entrega do boleto com mídia, nome de arquivo e campos publicados (CT-919)
- **Framework**: HTTP real (`apps/api`) em porta dinâmica, aplicação de produção montada
- **CA**: CA-07, CA-19
- **Objetivo**: a rota responde `200` com PDF de verdade, e a cobrança publica linha digitável e código de barras
- **Pré-condições**: sessão com `TELA:financeiro` pelo acessório `pedir`; diretório de boletos em `tmpdir` descartável; **o arquivo nasce pelo caminho real de emissão**, nunca escrito à mão pelo teste
- **Passos**: 1. emitir pela rota unitária · 2. `GET` do boleto · 3. afirmar status e cabeçalhos · 4. consultar a cobrança
- **Validações**: `content-type` começa com `application/pdf`; `content-disposition` contém `filename=`; os **5 primeiros bytes são `%PDF-`**; `linhaDigitavel` com 47 dígitos e `codigoDeBarras` com 44 — comprimentos que são contrato do meio de pagamento, não invenção do teste

#### Fluxo: emitir de novo após a revogação ocorre como a primeira vez (CT-931)
- **Framework**: HTTP real
- **CA**: CA-18
- **Objetivo**: sem boleto vivo, a emissão **não** executa etapa de revogação
- **Pré-condições**: cobrança cujo boleto foi revogado **pela conferência real** (CT-930) — nunca zerando `nosso_numero` direto na tabela, o que pularia o produtor sob prova; sessão com `ACAO:emitir_boleto`
- **Passos**: 1. guardar o identificador anterior · 2. conferência descobre a revogação · 3. `POST` de emissão · 4. afirmar a sequência
- **Validações**: sequência de operações recebidas pela porta é **exatamente `['emitir']`** — a igualdade é o que prova que não houve revogação supérflua sobre boleto inexistente; novo `nosso_numero` não-nulo e **diferente** do anterior, e o mesmo para `identificador_no_provedor` — os dois identificadores são distintos e a asserção separa os dois eixos; 1 evento `BOLETO_EMITIDO` com `origem: ATO_DO_ADMIN`. **É o companheiro de integração do CT-917.**

#### Fluxo: a superfície publicada fecha em 99/84 por dupla medição (CT-937)
- **Framework**: HTTP real, aplicação de produção montada
- **CA**: CA-20
- **Objetivo**: as duas medições independentes coincidem, `semDeclaracao` continua vazio e o catálogo **não cresce**
- **Pré-condições**: usar a **montagem instrumentada que a suíte já tem**; **não** registrar global novo fora do `AppModule` — é o segundo gatilho do `D57 · F3/T12`
- **Passos**: 1. atualizar as duas constantes (92→99, 77→84) · 2. medir pelo roteador · 3. medir pela composição · 4. afirmar igualdade e `semDeclaracao` · 5. afirmar o catálogo
- **Validações**: `peloRoteador === 99`, `pelaComposicao === 99`, `manipuladores === 84`, as três **por igualdade** contra as constantes (nunca `toContain`); `semDeclaracao` `toEqual([])`; `TOTAL_DE_CHAVES === 17` — o catálogo é **fechado** em 10×7; as 7 rotas novas nomeadas no inventário
- ⚠️ A **§5.2 da task** declara este arquivo como âncora que cresce, e a âncora sobe **no mesmo diff da publicação**. O **`D61 · F4/T14`** alcança este arquivo: a igualdade do retrato **precede** a garantia nomeada, na ordem canônica do `CT-836`. Toda contagem escrita em prosa (`CLAUDE.md`, esta spec) sobe no mesmo diff, com a linha `SUT_IS_CORRECT_BECAUSE:`.

#### Fluxo: a rota de bytes permanece no documento publicado (CT-945)
- **Framework**: HTTP real, documento publicado lido pela rota que o publica
- **CA**: CA-07, CA-09
- **Objetivo**: **o caso reprova se a rota desaparecer do documento** — a ADR-0028 nomeia essa prova como parte da decisão
- **Pré-condições**: aplicação montada; imite `apps/api/test/contrato-publicado.e2e.spec.ts`
- **Passos**: 1. obter o documento · 2. afirmar que o caminho consta · 3. afirmar mídia e nome sugerido · 4. afirmar os códigos de erro
- **Validações**: `/v1/cobrancas/{codigo}/boleto` consta do documento; declara `application/pdf` e o nome sugerido; **não** declara forma do corpo de sucesso; os códigos de erro pertencem ao enum fechado de 8 da ADR-0017

---

### 19.4 Cenários de Erro e Segurança

**Casos de segurança — home nesta subseção** (os **sete**; `real_execution_boundary` real em todos):

| Cenário | CA | Objetivo | Trigger | Status / Estado Esperado |
|---------|----|----------|---------|--------------------------|
| **CT-926** — histórico, boleto e emissão de outra empresa (`apps/api/test/recusa-indistinguivel.e2e.spec.ts` — **estendido**) | CA-14 | Resposta **byte a byte idêntica** à de código inexistente, e o isolamento é do **banco** | sessão de B pede as 3 rotas com o código real de A, e depois com `COB-2026-99999` | os pares de resposta são idênticos em status e corpo; `evento_bancario` sob o contexto de B devolve **0 linhas**, e sob o de A devolve as existentes (**controle antivácuo**) |
| **CT-927** — a conferência alcança só a empresa de quem disparou (`packages/cobranca-bancaria/test/conferencia.spec.ts`) | CA-15 | Medido pela **lista de identificadores que a porta recebeu** | 3 elegíveis em A e 3 em B; conferência de A | identificadores por igualdade de conjunto com os de A; interseção com B **vazia**; conjunto de B com 3 elementos — **provando que havia o que vazar** |
| **CT-934** — nenhum termo do provedor na **saída real** das 7 rotas (`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` — **estendido**) | CA-20 | Varre **valores que saíram em execução** — a metade que o CT-933 não alcança | 7 corpos de sucesso + 7 de erro + chaves do documento publicado | controle positivo devolve a lista completa **canal a canal por igualdade**; a varredura dos 14 corpos reais devolve `[]`; os 14 corpos são não-vazios (âncora antivácuo) |
| **CT-935** — nenhum material nem senha alcança a carga da tarefa (`apps/api/test/segredo-nao-escapa.e2e.spec.ts` — **estendido**) | CA-20 | A carga tem **exatamente** `{ empresaId, loteId }`, e nada vaza por texto cru, `JSON.stringify` ou `util.inspect` | material real registrado pela rota; lote enfileirado pela rota | `Object.keys(carga)` `=== ['empresaId','loteId']`; varredura `[]` nas **três** serializações e no corpo de erro da fila; **controle positivo com agulhas plantadas canal a canal** afirmado por igualdade |
| **CT-940** — as tabelas novas nascem isoladas (`packages/db/test/isolamento-bancario.spec.ts` — **novo**) | CA-14 | `relforcerowsecurity` é o que impede o **dono** de contornar a política, e é o mais esquecido | ler `pg_class` e `pg_policy` das 4 tabelas; semear em A; ler e inserir sob B | `relrowsecurity` **e** `relforcerowsecurity` `true` nas quatro; cada política com `qual` **e** `with_check` não-nulos; única `(id, empresa_id)` e FK composta; sob B o `SELECT` devolve 0 e sob A devolve N; `INSERT` com `empresa_id` de A recusado com `code === '42501'` |
| **CT-947** — a guarda de boletos não escreve nem lê fora do diretório-base (`packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` — **novo**) | CA-08 | A conferência que a §11.4 promete **existe e reprova** — a validação do código é o primeiro degrau, não o único | gravar e ler com `COB-2026-0000054`; depois com `../fora`, com caminho absoluto e com separador embutido | o legítimo grava e lê os **mesmos bytes** sob a base (**controle antivácuo** — sem ele uma guarda que recusasse tudo passaria); os três hostis são recusados **antes** de qualquer `fs`, e `readdir` da base e do pai devolve **exatamente** o arquivo legítimo; a recusa nomeia o **campo**, nunca o caminho recebido | `fs` real em `tmpdir` descartável |
| **CT-941** — as 7 rotas exigem sessão e a autorização declarada (`apps/api/test/autorizacao-do-dominio.e2e.spec.ts` — **estendido**) | CA-15 | Nenhuma é pública; as 3 de ato exigem também a chave de ação | matriz 7 rotas × 3 perfis | sem sessão `401 NAO_AUTENTICADO`; sem a tela `403 ACESSO_NEGADO`; nas 3 de ato, sem a ação, `403`; **com o perfil completo, não é 401 nem 403** — controle antivácuo indispensável, sem o qual uma rota quebrada que respondesse 403 sempre passaria |

**Cenários de erro cujo detalhe vive em 19.1/19.2** (referência cruzada — cada CT tem **uma** camada):

| Cenário | CA | Objetivo | Trigger | Status / Estado Esperado | Detalhe em |
|---------|----|----------|---------|--------------------------|-----------|
| Recusa de cobrança no lote | CA-02 | O lote segue | adaptador recusa a 2ª de 5 | evento `EMISSAO_RECUSADA`; posições 3–5 emitidas | 19.2 · CT-913 |
| Falha da empresa no lote | CA-03 | O lote para | falha `DA_EMPRESA` na 3ª de 6 | `interrompido_em` + motivo; exatamente 2 itens | 19.2 · CT-914 |
| Reemissão sem boleto novo | CA-06 | Declara sem boleto | revogação aceita, emissão recusada | `503` com `detalhes: { boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' }` | 19.2 · CT-918 |
| Arquivo do boleto sumiu | CA-08 | Rebusca transparente | arquivo apagado do `tmpdir` | `200` com bytes idênticos, **nunca** 404 nem 500 | 19.2 · CT-920 |
| Boleto nunca emitido | CA-09 | Recusa nomeada, sem documento | cobrança sem `nosso_numero` | `404`; `content-type` JSON; corpo sem `%PDF-` | 19.2 · CT-921 |
| Valor pago divergente | CA-11 | Baixa **não** é impedida | provedor informa valor menor | `pago_em` não-nulo + evento `DIVERGENCIA_DE_VALOR` | 19.2 · CT-923 |
| Motivo de revogação desconhecido | CA-17 | Inócuo por construção | `'MOTIVO-INEXISTENTE-99'` | `cancelado_em IS NULL`; motivo só como diagnóstico | 19.2 · CT-930 |
| Valor fora do enum da trilha | CA-13 | Recusado pelo banco | `tipo='CONFERENCIA'` | `code === '22P02'` | 19.2 · CT-939 |
| Carga de tarefa sem empresa | CA-01, CA-03 | Recusa antes de ler | carga sem `empresaId` | falha nomeando o campo; delta de itens `0` | 19.2 · CT-944 |
| Chave desconhecida no corpo | CA-15 | Recusa nomeando a chave | corpo com `empresaId` | `code: 'unrecognized_keys'`, `keys: ['empresaId']` | 19.1 · CT-942 |
| Worker sem qualquer das **três** variáveis novas | CA-20 | Recusa de partida | cada uma ausente ou em branco | falha nomeia a variável, **nunca** o valor; a lista fecha em **9** | 19.1 · CT-936 |
| Credencial expirada | CA-20 | Renova, não reusa | relógio cruza 300 s | obtenções `=== 3` exatas | 19.1 · CT-943 |

### 19.5 Cenários deliberadamente **não** cobertos

| Cenário | Motivo |
|---------|--------|
| **Chamada real ao provedor em produção** (mTLS real, emissão real) | A **ADR-0006** proíbe a suíte de executar contra o ambiente que atende a operação, e a configuração de teste aponta `ENDERECO_DO_PROVEDOR_BANCARIO` para domínio `.invalid`, que a RFC 6761 garante não resolver. Some-se o risco datado do PRD §9. A prova de que o identificador volta íntegro **alcança só o caminho de consulta** e já foi medida na fatia (i) — **não a escreva mais larga do que ela é.** |
| **Carga e desempenho** do lote de 47 e da conferência a 300 empresas | Fora do escopo da doutrina de testes (carga vira `recomendacao`, não caso). O trade-off do D2 já aceita por escrito que uma cobrança lenta atrasa as seguintes. |
| **Corrida real entre dois processos** consumindo a mesma tarefa | O índice único parcial (CT-916) fecha a classe **no banco**, que é onde a garantia mora. Reproduzir a corrida exigiria orquestração de subprocesso para provar o que a restrição já impõe. |
| **Provisionamento e expurgo do diretório** (dono, permissão) | É frente **shell**, não Vitest — o invariante só é observável inspecionando o SO. Vive em `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh` (§3.5). |
| **Agendamento por horário** da conferência | Fora do escopo pelo PRD §4.2 — esta fatia entrega a **regra** e o disparo sob comando; o timer é da **F5**. |

### 19.6 Notas de execução para o gerador de tasks

1. **A distribuição é 26 casos em 12 arquivos novos e 11 casos em 10 suítes estendidas** — contado
   caso a caso contra a §19, não estimado. Emissão em lote, conferência e reemissão são conceitos que
   **nascem** nesta fatia e nenhuma suíte existente os cobre; o que estende, estende porque o
   invariante já tem casa (vocabulário, ambiente, esquemas, migrações, recusa indistinguível,
   autorização, superfície, segredo, contrato publicado).
2. **O `D63 · F4/fechamento` dispara aqui**: `pedir` está em 24 de 24 suítes E2E, e esta fatia
   acrescenta **três** (`boleto-da-cobranca`, `cobranca-bancaria`, `historico-bancario`). Avaliar
   subir os acessórios para casa compartilhada em vez de fazer a 25ª cópia.
3. **A contagem 92→99 / 77→84 é estimativa até a dupla medição rodar.** Se a medição divergir, **vale
   a medição** — é o precedente confirmado cinco vezes nesta base (*prescrição de gate é hipótese, não
   ordem*), e o próprio arquivo-âncora já registra que o `77` de uma fase anterior era aritmética de
   estimativa e não superfície observada.
4. **Cada CT pertence a exatamente uma camada**, e nenhum ID se repete — **conferido por varredura
   contra a base**, não afirmado por suposição (`grep -rhoE "CT-[0-9]{3}" apps packages | sort -u`). A §19.4 lista os seis casos de
   segurança como **home** e referencia os demais por ponteiro, sem duplicar conteúdo.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **O certificado A1 vence em 2026-08-22** — seis dias após o PRD, medido por leitura do próprio material | **Certa** (é data) | **Alto** — sem ele nada opera contra o provedor | Decisão do usuário em 2026-08-16: **assumir a renovação**. As tasks que exigem chamada real ao provedor declaram a renovação como pré-condição; as demais correm contra par local. |
| A superfície que pode decifrar o segredo mais forte passa de 1 para 2 processos | Certa (é a decisão D1) | Alto se houver vazamento | O material **não trafega pela fila**; a superfície `fila` entra na enumeração da ADR-0032 e é **medida com controle positivo** (fecha o D58) |
| **Revogação aceita e emissão falha** deixa a cobrança sem boleto | Média | Médio — cobrança sem instrumento de pagamento | É o desfecho **declarado** da CA-06, não uma falha; o lote seguinte a recolhe pelo predicado (§5.2, nota) |
| O provedor é **assíncrono na revogação** e pode não confirmar no teto | Média | Médio | Sondagem com limite nomeado + falha declarada; nada é apagado, e a conferência apura o desfecho real |
| `nossoNumero` retorna **inteiro** e o contrato supõe cadeia | Baixa (já medida) | Alto se não coagido | Coerção **na fronteira** do adaptador, com caso que a exercita |
| Dois lotes concorrentes emitem dois boletos para a mesma cobrança | Baixa | **Alto** — quebra a métrica de sucesso nº 1 do PRD | **Índice único parcial no banco**, não checagem de aplicação; caso com duas transações concorrentes reais |
| O diretório dos boletos cresce sem expurgo (~1,4 GB/mês projetado) | Média | Baixo no horizonte desta fatia | Débito com gatilho declarado (§21); o arquivo é cache recuperável |
| A prova do `seuNumero` íntegro alcança **só a consulta** | Certa | Médio para a fatia (iii) | Escrito como tal, aqui e no discovery. **Não escrever a prova mais larga do que ela é.** |
| Regressão na fatia (i) ao estender `modelo-canonico.ts` e `adaptador-sicoob.ts` | Média | Alto — arquivos com `DECISÃO FECHADA` e dois `DÉBITO COM GATILHO` | Baseline **por pacote** antes e depois (o `turbo run test` aborta os irmãos); os marcadores são lidos antes de cada edição |

---

## 21. Observações Técnicas

### 21.1 Divergências declaradas — leia antes de julgar conformidade

**(1) A porta declara QUATRO operações, e a `Decision` da ADR-0001 lista cinco.**

A `Decision` diz: *"O núcleo conversa apenas com a porta `AdaptadorCobrancaBancaria` (`obter_token`,
`emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`)"*. Esta spec declara `emitir`,
`solicitarRevogacaoDeBoleto`, `confirmarRevogacaoDeBoleto` e `consultarSituacao` — **quatro** —,
e realiza a obtenção da credencial **dentro** do adaptador. A escolha foi **escalada ao usuário e
decidida por ele** em 2026-08-16. As três razões:

1. A **emenda de 2026-08-15** da própria ADR declara que a exclusividade é *"de critério, e não de
   contagem de portas"*, e que o que ela garante é que nenhuma das cinco fique *"alcançável **por
   fora** da porta que esta ADR reserva"*. Dentro do adaptador não é por fora.
2. A mesma `Decision` fecha: *"Nenhum campo, URL ou vocabulário específico de provedor cruza a
   porta"*. Uma credencial de acesso `client_credentials` **é** vocabulário do provedor. Pô-la na
   porta satisfaria o parentético contradizendo a cláusula que a emenda declara ser *"propriedade do
   vocabulário"*.
3. A operação **não teria chamador no domínio**. A fatia (i) recusou por escrito declarar assinaturas
   sem quem as chame — *"seria escolher quatro assinaturas sem quem as chame, e a fatia (ii) as
   reescreveria contra a API real"*. Reintroduzir o mesmo defeito agora seria regressão de decisão.

**Isto vai escrito aqui, e não só num docblock, porque é a `Decision` que se abre ao citar** — é
exatamente o custo que a emenda da ADR-0021 registrou (*"um gate futuro leria violação onde houve
decisão"*) e que o Gate 2 da T8 cobrou da fatia (i).

**(2) A CA-13 lista "conferência" entre os tipos da trilha; a ADR-0034 proíbe registrar tentativa.**

Escalado ao usuário e decidido em 2026-08-16: **não existe tipo de evento `CONFERENCIA`**. O que a
conferência descobre entra como **o efeito descoberto**, e cada evento carrega a `origem` que o
produziu (`ATO_DO_ADMIN` \| `CONFERENCIA`). A CA-13 fica satisfeita na substância — o leitor vê o que
se passou e que foi a conferência que achou —, e a `Decision` da ADR-0034 fica obedecida na letra. A
conferência que nada achou não aparece na trilha, e essa ausência é o `Cons` que a própria ADR já
declara aceito: *"a trilha deixa de provar, por si só, que a conferência rodou"*.

**(3) `numeroDoTituloNoProvedor` publicado sobre a coluna `nosso_numero` — e os DOIS identificadores.**

A coluna é da migração `0009`, vocabulário do provedor, e o glossário global lista *"nosso número"*
entre os termos a evitar. Renomeá-la exigiria migração sobre tabela fora do escopo do PRD. O nome
**publicado** é do produto; o mapeamento morre na fronteira de dados. Débito abaixo.

⚠️ **Não confunda os dois.** O *Identificador perante o provedor* (18 posições) é **composto pelo
produto** e vive agora em `identificador_no_provedor` (§7.2), interno e não publicado; o
`numeroDoTituloNoProvedor` é **atribuído pelo provedor**, vive em `nosso_numero` e é o publicado. A
fatia (i) mediu que quem casa com o primeiro é o `seuNumero` do dialeto do provedor. Tratar os dois
como um só apagaria a chave de correlação da fatia (iii).

**(4) `TERMOS_DO_PROVEDOR` muda nesta fatia, e a mudança é de UM item só.**

A lista de `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` tem **dez** termos, e o
décimo — `AdaptadorCobrancaBancaria` — não é termo do provedor: é o **nome reservado** que a fatia (i)
protegeu para que esta o criasse. Esta fatia o **usa**, então ele **sai da lista**, e a saída é a
condição de saída que o próprio docblock de lá escreveu. Os outros nove **permanecem**, e três deles
têm consequência direta e verificável para o executor:

- **`pagador` permanece.** O modelo canônico da emissão **não pode** nomear um campo assim — quem
  precisar dos dados de quem paga usa vocabulário do produto (`locatario`, `sacado` **não**).
- **`client_id` e `scope` permanecem**, e o D5 os traz para o envelope cifrado. Isso **não** os põe em
  conflito: a varredura do `CT-834` percorre **nomes declarados** — chaves de tipo, literais de enum,
  símbolos —, nunca valores em execução. Eles podem aparecer como **valor** dentro do adaptador, ao
  compor o pedido de credencial; o que não podem é virar nome de campo do modelo canônico ou chave
  publicada.
- **`nossoNumero` permanece**, e é exatamente por isso que a chave publicada é
  `numeroDoTituloNoProvedor` — ver (3) acima. Publicar `nossoNumero` faria a varredura da CA-20
  reprovar a própria fatia que a CA-19 mandou entregar.

### 21.2 ADRs Aplicáveis nesta Feature

| ADR | Classificação | Onde incide, e a conformidade confrontada contra o texto da `Decision` |
|-----|---------------|------------------------------------------------------------------------|
| ADR-0001 — Modelo canônico com adaptador por provedor | **APLICÁVEL** | §3.2, §3.3, §8, §11.4. A porta nasce aqui com o nome que a emenda reserva. **Divergência declarada em §21.1(1).** A cláusula de vocabulário é obedecida e **exigível por medição** (§19). |
| ADR-0005 — Rotinas operacionais versionadas com instalação idempotente | **PARCIAL** | §16.3 — o provisionamento do diretório entra em `deploy/scripts/instalacao/`, versionado e idempotente. |
| ADR-0006 — Ambiente de verificação separado | **APLICÁVEL** | §19 — instâncias efêmeras próprias; nenhum caso toca o banco que atende a operação. |
| ADR-0008 — Isolamento garantido pelo banco | **APLICÁVEL** | §7.2 — as quatro tabelas nascem com `empresa_id`, RLS **habilitada e forçada**, `USING` e `WITH CHECK`, e FK composta `(id, empresa_id)`. Nenhuma comparação de empresa em código (§3.3). |
| ADR-0009 — Fronteira identidade/negócio por schema | **APLICÁVEL** | §7.2 — as três vivem em `negocio`; a cobertura de `src/catalogo.ts` as alcança. |
| ADR-0011 — Cobertura de autorização declarada por rota | **APLICÁVEL** | §11.2 — as 7 rotas declaram; `semDeclaracao` continua vazio; a verificação é sobre a **superfície publicada** (§19). |
| ADR-0014 — Entidade de cadastro nunca é apagada | **PARCIAL** | §7.5 — nada é apagado nas tabelas novas. Não alcança os **bytes** do boleto, que são cache recuperável, nem os cinco campos de conciliação, que são fato de terceiro revogável por ele. |
| ADR-0016 — O esquema é a fonte única do contrato | **APLICÁVEL** | §4.2 — os enums do banco **derivam** dos literais do contrato; validação, tipo e documento saem do mesmo esquema. |
| ADR-0017 — Forma canônica do contrato, três classes de chave | **APLICÁVEL** | §4.1, §10.1 — cobrança tem série declarada, logo a chave exposta é o `codigo`; lote e conferência **não têm série**, logo **UUID**. O envelope de erro é o literal `{ codigo, mensagem, campo?, detalhes? }`. ⚠️ Lido **com a emenda de 2026-08-16** (o contador é a ADR-0033). |
| ADR-0018 — Uma rota compõe exigências | **APLICÁVEL** | §11.2 — as três rotas de primeira classe declaram conjunção `área + ação`, e a recusa nomeia a **primeira** ausente. |
| ADR-0020 — Série emitida por contador do banco fora do desfazimento | **APLICÁVEL** | §5.1 passo 6, §7.4 — `proximoIdentificadorBancario` em unidade própria; furo aceito, número nunca reusado. |
| ADR-0021 — Transição é rota própria, governada pela natureza do ato | **APLICÁVEL** | §11.2 — a tabela de justificativa confronta **cada** rota contra a `Decision`, inclusive a instância que ela **nomeia literalmente** (*acusar pagamento de cobrança* → apenas a área), que é o que sustenta a conferência exigir só `TELA:financeiro`. |
| ADR-0022 — O que se grava e o que se deriva num fato financeiro | **APLICÁVEL** | §7.2, §6.3 — **nenhuma coluna de status**; a liquidação grava fato e carimbo no mesmo ato, com a configuração vigente; o estorno apaga os dois juntos. |
| ADR-0023 — Onde vive a derivação de valor não persistido | **APLICÁVEL** | §5.1 passo 2 — os dois conjuntos (lote e conferência) **participam de seleção**, logo os predicados vivem **no banco**, nunca como filtragem em memória sobre página já lida. |
| ADR-0024 — Origem legítima do contexto de tenant sem requisição | **APLICÁVEL** | §5.1 passo 4 — o contexto sai da **carga**, **uma vez**, **na borda que a recebe**, pelo mesmo escritor único da borda HTTP. O `empresaId` é produzido pela sessão que enfileirou; nenhuma rota o aceita de fora. |
| ADR-0025 — O domínio declara a porta; o adaptador depende dele | **APLICÁVEL** | §3.3 — `porta-de-cobranca.ts` e `modelo-canonico.ts` no domínio; `adaptador-sicoob.ts` importa deles; a porta chega **por parâmetro**. |
| ADR-0026 — O relógio da operação mora no banco | **APLICÁVEL** | §5.1 passo 2 — a janela de 30 dias sai de `data_corrente_da_operacao()`. Instantes de **ato externo** (`ocorrido_em`) são carimbo, não decisão de negócio. |
| ADR-0028 — O que o contrato publica para rota que devolve bytes | **APLICÁVEL** | §4.1 — a rota do boleto declara **mídia**, **nome sugerido** e o **mesmo envelope de erro**; não declara forma do sucesso (`format: 'binary'` é a declaração da **ausência** de forma). A cláusula de exceção **não se ativa** — medido no precedente do documento do contrato. |
| ADR-0029 — Efeito externo sai por fila, nunca em linha na borda | **APLICÁVEL** | §9.1 — lote **e conferência** vão por fila (o resultado de nenhuma das duas compõe a resposta). A emissão unitária permanece **em linha e não é exceção**: o solicitante espera o retorno na própria resposta, e a `Decision` diz que essa classe *"está fora do que ela alcança"*. |
| ADR-0030 — Artefato derivado é composto sob demanda, nunca armazenado | **PARCIAL** | §7.5 — a **cláusula de exclusão** da `Decision` nomeia o boleto: *"boleto emitido pelo provedor … não é artefato derivado"*. Ele é fato recebido de terceiro e **se guarda**. Não confundir com o carnê, que é derivado e é da fatia (iii). |
| ADR-0031 — Tabela sem dono-empresa vive em schema próprio | **N/A por conformidade** | §7.3 — as quatro tabelas **têm** dono-empresa e vivem em `negocio`. O roster enumerado de `plataforma` **não cresce**. |
| ADR-0032 — Segredo operável é cifrado, nunca retorna, e se prova por medição | **APLICÁVEL** | §11.6, §19 — a chave fora da árvore versionada; nada retorna por superfície alguma; e a superfície **`fila`** entra na enumeração, medida **com controle positivo** (fecha o D58). |
| ADR-0033 — Cada série declara o próprio escopo | **APLICÁVEL** | §5.1 passo 6 — o identificador perante o provedor declara **o SaaS**; pedi-lo em nome de uma empresa é irrepresentável (a função não recebe parâmetro). **Não "corrigir" para ser por empresa.** |
| ADR-0034 — Trilha registra efeito, não tentativa | **APLICÁVEL** | §4.2, §5.1 passo 6, §13.1 — enum de seis tipos, todos efeito ou anomalia; **nenhum tipo de conferência**; e o registro operacional de diagnóstico permanece livre, que é o que a `Decision` ressalva. Ver §21.1(2). |
| ADR-0010, 0013, 0027 | **PARCIAL / N/A** | 0010 e 0013 incidem só pelo que já existe (efetivo de permissão, alcance do Master — nenhuma rota daqui é do Master). 0027 é **N/A**: nenhuma rota dispensa sessão. |
| ADR-0002, 0003, 0004 | **N/A** | `deprecated` — nomeiam primitivas do Frappe. |
| ADR-0007, 0012, 0015, 0019 | **N/A** | `superseded`. Vigem a 0017, a 0033 e a 0021, e **só a última de cada cadeia se cita**. |

### 21.3 Candidatos a ADR (FASE 4B — 5 critérios canônicos)

**Nenhum candidato confirmado.** A candidata que esta fatia produziria — *trilha de integração
registra efeito, não tentativa* — **já foi registrada**: é a **ADR-0034**, `accepted` em 2026-08-16, e
o `Applied in` dela já aponta para o tech-alignment desta feature.

**Um candidato parcial**, registrado para não se perder:

> **"O ato composto contra terceiro assíncrono sonda a confirmação antes de prosseguir"** (§5.2 A).
> **C1 transversal**: ✅ — a fatia (iii) enfrenta o mesmo com a notificação, e qualquer integração
> futura com terceiro assíncrono também. **C2 tag-alvo**: ✅ `architecture`, `cross-cutting`.
> **C3 custo de reversão**: ⚠️ **falha** — reverter é trocar o corpo de uma função de domínio; não
> há refactor em múltiplos lugares. **C4 surpreendente**: ✅ — a forma óbvia (pedir e emitir em
> seguida) é a errada, e a razão não é visível sem a medição do legado. **C5 trade-off real**: ✅ —
> C1 e C3 foram consideradas e rejeitadas por razão específica no D3.
> **4 de 5.** Registrado como decisão técnica desta fatia, com a razão no docblock de `reemissao.ts`.
> Se a fatia (iii) repetir a forma, o C3 muda de resposta e o candidato deve ser reavaliado.

### 21.4 Débitos que esta fatia FECHA

| Débito | O que fecha |
|--------|-------------|
| **D27 · F4/T8** | `ResultadoDaVerificacaoDeIdentidade.detalhe` sobe de `string` para união fechada `+ null` — a saída **estrutural** que o gatilho emendado agenda, agora que a fatia (ii) consome o campo. Marcador sai no mesmo commit. |
| **D36 · F4/T10** | `client_id` e `scope` entram no envelope cifrado; a sonda sobe para o `client_credentials`; o desfecho positivo perde a ressalva de alcance. |
| **D58 · F4/T13** | A superfície **`fila`** entra na enumeração da ADR-0032 e ganha caso que a mede com controle positivo. |
| **D1 · F3/T2** | Terceiro consumidor monetário do pacote de contratos: `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` sobem para `comum.ts`. |
| **D39 · F1** | No que toca a esta fatia: o diretório dos boletos entra no provisionamento com dono e modo. |

**Os demais se conferem contra o diff**: **D25 · F4/T7** (quarto consumidor do fuso da operação),
**D26 · F3/T8** (terceiro consumidor de aritmética de calendário), **D5 · F3/T7** (terceiro consumidor
de extração de texto de PDF — a entrega do boleto **pode** dispará-lo), **D12 · F3/T4**, **D12 ·
F3/T10** (terceira mensagem de e-mail — **não** dispara: esta fatia não envia e-mail), **D54 ·
F3/T11**, **D57 · F3/T12**, **D61 · F4/T14** e **D63 · F4/fechamento** (a próxima suíte E2E que
precisar dos acessórios de arranjo — **dispara**, e são quatro suítes novas).

⚠️ **O `D20 · F3/T7` não é tocado**: a `0010` permanece imutável, e o `sha256sum` por arquivo do
`migrar-banco.sh` continua batendo para todas as migrações anteriores.

### 21.5 Débitos que esta fatia ABRE (marcador + linha no índice do `CLAUDE.md`)

| Débito | Onde | Dispara quando |
|--------|------|----------------|
| **Expurgo do diretório dos boletos** | `packages/cobranca-bancaria/src/guarda-de-boletos.ts` | a **F5**, que traz o agendamento; ou a **primeira medição do diretório acima de 20 GB**. Hoje o arquivo é cache recuperável e a perda não é dano. |
| **`nosso_numero` é vocabulário do provedor em coluna** | `packages/db/src/esquema/negocio.ts` (a coluna) | ⚠️ **o gatilho original já disparou nesta fatia** — a `0017` altera `negocio.cobranca` para acrescentar `identificador_no_provedor` — e a decisão medida é **não pagar agora**: o `ADD COLUMN` é aditivo sobre coluna nula e não reescreve linha; um `RENAME` alcança a leitura, a escrita, a `LinhaDeCobranca` e todo caso que nomeia a coluna, o que é delta que o PRD não pediu **dentro da fatia que estreia a integração**. O gatilho reescrito é a **primeira migração que alterar `negocio.cobranca` depois desta**, ou a fatia (iii) ao consumir a coluna. O nome **publicado** já é do produto desde aqui (`numeroDoTituloNoProvedor`), de modo que o débito é de esquema físico, não de contrato. |
| **Coerência entre os campos de conciliação sem restrição no banco** | `packages/db/src/boleto-da-cobranca.ts` | a fatia que criar no banco a restrição pareando `linha_digitavel` com `nosso_numero` — hoje nada impede a linha meio preenchida. Mesma classe do **D44 · F2/T10**. |

> A numeração `Dnn` de cada um sai da **§2 do `run-report.md` desta fatia**, na execução — não desta
> spec, e não da sucessão dos marcadores existentes. É a regra da §3-B da
> `.claude/rules/nao-regressao.md`, e confundir os dois conjuntos foi a causa das três colisões da F1.

### 21.6 Glossário — três termos canonizados no challenge (2026-08-16)

O PRD §9 levantou dois e declarou que **não eram dele**; o challenge levantou um terceiro, por
colisão medida contra o glossário. Os três foram para o **GLOBAL**
(`docs/specs/domain-glossary.md`), porque a fatia (iii) e o handoff do frontend consomem os mesmos
campos e um termo de feature divergiria em silêncio.

1. **"Baixa" tem dois sentidos opostos** — no legado, *solicitar baixa* é **pedir a revogação do
   boleto**; no discovery, "baixa" aparece como **liquidação**. Esta spec **evita a palavra** e
   nomeia as duas por extenso: `revogação do boleto` e `liquidação`. A chave de permissão herdada
   (`ACAO:solicitar_baixa_de_boleto`) preserva o sentido do legado, e **não é renomeada** — ela é do
   catálogo fechado.
2. **`Número do título no provedor`** nomeia o identificador que **o provedor atribui** e devolve —
   publicado como `numeroDoTituloNoProvedor`. O termo entrou no glossário global, e *"número do
   título"* **saiu** da lista `_Evitar_` de *Identificador perante o provedor*, que passou a nomear
   só o que o produto compõe e envia. A ambiguidade está registrada por escrito lá.
3. **`Revogação de boleto` — e não "retirada de circulação".** ⚠️ Esta é a correção mais invasiva do
   challenge, e a razão é medida: *Retirada de circulação* **já é termo canônico do glossário**, e
   nomeia visibilidade de **cadastro** — a seção de ambiguidades fecha, literalmente, que ela *"não
   alcança a cobrança: é operação sobre cadastro, não sobre fato financeiro"*. Usar o mesmo nome
   para o ato sobre o boleto criaria dois conceitos sem parentesco com um nome só, no mesmo produto.
   Daí `solicitarRevogacaoDeBoleto`, `confirmarRevogacaoDeBoleto`, o evento `BOLETO_REVOGADO`, a
   rota `/revogacao-de-boleto` e o `detalhes: { revogacao: … }`. **Não "harmonize" de volta** — o
   texto antigo tinha coerência interna e é exatamente por isso que a colisão passaria despercebida.

### 21.7 Sessão de challenge — 2026-08-16

A spec passou por `/agent-spec-challenge-spec`. **Onze questões processadas**, cinco escaladas ao
usuário, **24 ajustes inline**. Os oito achados estruturais estão no `steps.validation` do
`_run/sdd_state.yaml` e já foram aplicados ao texto acima. Três observações **não** foram resolvidas
aqui e pertencem a quem gerar as tasks:

1. ✅ **O `_run/test-cases.json` foi regenerado** no fecho da sessão, a pedido do usuário: 37 casos,
   `CT-911`…`CT-947`, com o vocabulário da revogação, os patches de conteúdo desta sessão e o caso
   novo. A conferência cruzada não deixa diferença entre os dois lados — **os 37 IDs da §19 e os 37
   do JSON são o mesmo conjunto**, a distribuição bate (5 · 21 · 4 · 7) e os 20 CAs continuam
   cobertos. O `task_id` segue `null` em todos: a distribuição é do task-plan, não desta sessão. Em
   divergência futura, **a §19 é a fonte** — o JSON é derivado.
2. **O CT-934 mora em `cobertura-de-autorizacao.e2e.spec.ts`**, que já é o inventário de rotas e
   carrega o `D61 · F4/T14`. A varredura de vocabulário sobre a saída real é outro invariante, e
   empilhá-la ali torna o arquivo dono de dois assuntos. Avaliar suíte própria na geração das tasks —
   observação, não bloqueio: o `D61` já obriga a ordem canônica do `CT-836` nesse arquivo.
3. **A contagem 92→99 / 77→84 continua estimativa até a dupla medição rodar** (§19.6, item 3), e o
   precedente da base vale: se a medição divergir, **vale a medição**.

**Candidatos a ADR**: nenhum novo. O parcial de §21.3 (4 de 5) permanece como está — o challenge não
mudou nenhum dos cinco critérios dele. As decisões desta sessão são de **terminologia** (glossário
global) e de **completude da spec**, e nenhuma delas é transversal a ponto de exigir registro
arquitetural próprio.

---

## 22. Checklist Final

- [x] Variante registrada (`backend`) na seção 1
- [x] Stack identificada — a **medida**, não a planejada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-13 mapeadas em §5.3 **e** §17)
- [x] Resumo técnico claro e objetivo (§2)
- [x] Arquitetura definida com componentes, camadas e fronteiras (§3)
- [x] Contratos de API com payloads, status codes e schemas (§4)
- [x] Fluxos de negócio principais e alternativos (§5)
- [x] Regras de processamento, validações e RN-01…RN-15 rastreadas (§6)
- [x] Persistência: tabelas, índices, migrações, transação, retenção (§7)
- [x] Integrações externas mapeadas (§8)
- [x] Sincronização: filas, idempotência, ausência justificada de outbox (§9)
- [x] Gerenciamento de erros e resiliência (§10)
- [x] Segurança: auth, autorização, criptografia, sanitização, segredos (§11)
- [x] Performance: metas, estratégias, limites (§12)
- [x] Logs; métricas/tracing/alertas declarados **N/A com razão** (§13)
- [x] Feature flags — nenhuma, com razão (§14)
- [x] Versionamento de API definido (§15)
- [x] Deploy e infraestrutura (§16)
- [x] Dependências externas listadas — **nenhuma nova** (§18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada, com rastreabilidade CA→CT (§19)
- [x] Riscos técnicos identificados (§20)
- [x] Observações técnicas, inventário de ADRs com conformidade **literal**, as **quatro** divergências declaradas (§21.1) e a sessão de challenge registrada (§21.7)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (§3.4–3.7)
- [ ] Pronto para geração das TASKS
