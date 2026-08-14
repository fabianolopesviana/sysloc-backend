# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação

- **Feature/Projeto**: `documentos-e-confirmacao` — o contrato em PDF derivado do dado no instante do
  pedido, e a confirmação do endereço de e-mail do locatário por portador que não se forja
- **Variante**: `backend`
- **Stack**: Node 24 · TypeScript 7 strict · NestJS 11 + Fastify · Drizzle + postgres.js ·
  PostgreSQL 18 · Zod 4 · BullMQ + ioredis · Vitest + `embedded-postgres`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-12
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/documentos-e-confirmacao/v1/prd.md`
- **Alinhamento técnico**: `docs/specs/features/documentos-e-confirmacao/v1/tech-alignment.md`
  (8 decisões cravadas, D1 a D8 — respeitadas integralmente aqui)
- **Discovery**: `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md`

---

## 2. Resumo Técnico da Solução

Duas frentes que **não compartilham um único símbolo**, e o corte técnico é o mesmo do produto.

**O documento** troca *artefato armazenado* por *função pura do estado gravado*. Nasce o pacote de
domínio **`@sysloc/documentos`** (pacotes 5 → 6), no molde exato de `@sysloc/regua`: ele compõe o
contrato a partir de dados já resolvidos, **declara a porta de renderização** que a infraestrutura
satisfaz (ADR-0025), e não conhece banco, HTTP nem SMTP. A borda orquestra — lê o agregado, chama a
composição, devolve bytes `application/pdf` (ADR-0028). A marca de cancelamento é **parâmetro da
composição**, o que elimina a pré-condição legada *"sem documento, não cancela"* **por construção** e
fecha o **D36 (F2/T8)**. A coluna `negocio.contrato.pdf_contrato_arquivo` sai do banco, da camada de
dados e do contrato publicado — mudança incompatível deliberada (CA-07).

**A confirmação** instala o **primeiro ato de negócio sem sessão** do produto (ADR-0027). O portador
é aleatório de 256 bits; o banco guarda **SHA-256** dele com unicidade, e a apresentação **deriva e
procura pelo derivado** — segredo nunca é comparado com segredo. Sob RLS forçada não há
`app.empresa_id` antes de resolver o portador, e por isso uma função de superfície mínima devolve
**apenas** o par empresa + locatário, ou nada; a partir dela o contexto é estabelecido uma vez na
borda e a escrita corre sob RLS como qualquer outra (ADR-0024). ⚠️ **`SECURITY DEFINER` sozinho não a
faz atravessar a política** — sob `FORCE`, o dono da tabela também é alcançado. O que atravessa é o
`DEFINER` **mais** um papel `NOLOGIN` de propósito único como dono da função, alcançado por uma
política nominal `FOR SELECT`. O mecanismo inteiro, medido, está na §7.3. O disparo —
automático no cadastro e manual no reenvio — **enfileira a mesma tarefa** (ADR-0029); quem alcança o
mundo é o `worker`.

A superfície vai de **86 rotas / 71 manipuladores** a **89 / 74**, com `semDeclaracao` permanecendo
vazio e a medição por dois caminhos independentes (CA-17).

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
FRENTE A — O DOCUMENTO (sessão exigida, área Contratos)

  GET /v1/contratos/:codigo/documento
        │
        ▼
  ContratoController ─── sobContextoDaSessao ──► ContratoService.documento()
        │                                              │
        │                                     packages/db/src/documento-de-contrato.ts
        │                                     (uma consulta: contrato + locador +
        │                                      locatário + fiadores + imóvel, sob RLS)
        │                                              │
        │                                              ▼
        │                              @sysloc/documentos ── comporDocumentoDoContrato()
        │                                 │   (função PURA: dados → RepresentacaoTextual)
        │                                 │
        │                                 ▼
        │                              PortaDeRenderizacao  ◄── criarRenderizadorPdf()
        │                                 (declarada no domínio)   (@react-pdf/renderer)
        ▼
  bytes application/pdf + Content-Disposition


FRENTE B — A CONFIRMAÇÃO (o ato sem sessão)

  (1) automático                        (2) reenvio manual
  POST/PUT /v1/locatarios[/:id]         POST /v1/locatarios/:id/confirmacao-de-email
  @ExigeChave(TELA:cadastros)           @ExigeChave(TELA:cadastros)
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
        MESMA unidade de trabalho, sob contexto da sessão:
          · o UPDATE decide: o e-mail MUDOU?  (o reenvio manual: sempre)
          · se mudou → zera o fato  locatario.email_confirmado_em
          · invalida os portadores vivos do locatário  (RN-09)
          · grava portador novo (SHA-256, expira_em = now() + 72h)
          · enfileira CargaDaConfirmacao { empresaId, locatarioId, segredo }
                       │
                       ▼
              fila  confirmacao-de-email  (Redis, AOF ligado)
                       │
                       ▼
        apps/worker ── processarConfirmacaoDeEmail()
              contextoDeTenant.executarCom({ empresaId })   ◄── ADR-0024
              @sysloc/documentos ── comporMensagemDeConfirmacao()
              PortaDeEnvioDeEmail (@sysloc/regua) ──► SMTP  |  capturador (verificação)


  (3) o ato do titular — SEM SESSÃO
  POST /v1/confirmacoes-de-email   @RotaPublica()   corpo: { segredo }
        │
        ▼
  ConfirmacaoController ─► ConfirmacaoService
        │
        │  a) sha256(segredo)  →  negocio.resolver_portador_de_confirmacao(derivado)
        │                          ▲ SECURITY DEFINER + dono `sysloc_resolucao`
        │                          │ (papel NOLOGIN alcançado por política nominal;
        │                          │  DEFINER sozinho NÃO atravessa o FORCE — §7.3)
        │                          │ superfície mínima, NÃO aceita empresa_id por parâmetro
        │                          └─ devolve (empresa_id, locatario_id) ou NADA
        │
        │  b) contextoDeTenant.executarCom({ empresaId })  ── uma vez, na borda
        │  c) emUnidadeDeTrabalho: SET LOCAL app.empresa_id → escrita sob RLS
        ▼
  200 { confirmado: true }        |        404 RECURSO_NAO_ENCONTRADO (indistinguível)
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| `@sysloc/documentos` · `comporDocumentoDoContrato` | Traduz o agregado resolvido na representação textual do contrato, bloco a bloco. **Função pura**; a marca de cancelamento é parâmetro | Domínio |
| `@sysloc/documentos` · `PortaDeRenderizacao` | Interface que o domínio **declara** e a infraestrutura satisfaz (ADR-0025) | Domínio (porta) |
| `@sysloc/documentos` · `criarRenderizadorPdf` | Adaptador sobre `@react-pdf/renderer` — o único ponto que conhece PDF | Infraestrutura |
| `@sysloc/documentos` · `normalizarParaComparacao` | A normalização **declarada e fechada** do D3, usada só pela verificação | Domínio (verificação) |
| `@sysloc/documentos` · `comporMensagemDeConfirmacao` | Assunto e corpo da mensagem de confirmação, com o link montado a partir da base recebida | Domínio |
| `@sysloc/contracts` · `esquemaDoLocatario` | `esquemaDaPessoa` + `emailConfirmadoEm`. **Publicado só pelas 6 rotas de locatário** | Contrato |
| `@sysloc/contracts` · `confirmacao-de-email.ts` | Corpo da apresentação do portador e as duas respostas | Contrato |
| `@sysloc/db` · `documento-de-contrato.ts` | Lê o agregado inteiro do contrato numa consulta, sob RLS | Dados |
| `@sysloc/db` · `portador-de-confirmacao.ts` | Emitir, invalidar, resolver e consumir portador | Dados |
| `negocio.resolver_portador_de_confirmacao` | `SECURITY DEFINER` mínima, **de dono `sysloc_resolucao`**: derivado → `(empresa_id, locatario_id, consumido_em)` ou nada | Banco |
| `sysloc_resolucao` | Papel `NOLOGIN` de propósito único — dono da função acima, alcançado pela política nominal `FOR SELECT` da `0014`. Criado pelo **provisionamento**, nas duas frentes | Banco |
| `@sysloc/shared` · `fila.ts` | `FILA_DA_CONFIRMACAO` e `CargaDaConfirmacao` — contrato único entre produtor e consumidor | Compartilhado |
| `apps/api` · `ProdutorDeFila` | O produtor BullMQ da API, injetado por token, com as opções padrão de `@sysloc/shared` | Infraestrutura |
| `apps/api` · `ConfirmacaoDeEmailService` | Emite portador, invalida anteriores e enfileira — o caminho único dos dois disparos | Aplicação |
| `apps/api` · `ConfirmacaoController` | A **única** rota `@RotaPublica()` de negócio do produto | Apresentação |
| `apps/worker` · `processarConfirmacaoDeEmail` | Estabelece o contexto da carga, compõe e entrega | Aplicação (worker) |

### 3.3 Camadas e Fronteiras

Estilo **hexagonal por dentro, camadas por fora** — o mesmo que a sub-fatia irmã provou.

Direção das dependências (nenhuma aresta nova fecha ciclo):

```
@sysloc/contracts  (FOLHA — nada importa dela para dentro do servidor)
        ▲                    ▲                    ▲
        │                    │                    │
@sysloc/documentos    @sysloc/regua        @sysloc/db
        ▲                    ▲                    ▲
        └──────── apps/api ──┴──── apps/worker ───┘
```

- **`@sysloc/documentos` não importa `@sysloc/db` nem `@sysloc/regua`.** A composição recebe os dados
  já resolvidos por parâmetro, e a porta de renderização é declarada por ela — quem satisfaz é o
  adaptador, que importa dela (ADR-0025). É a propriedade que torna o domínio exercitável sem
  processo nenhum de pé.
- **`@sysloc/contracts` continua folha.** Nenhum símbolo novo dele referencia servidor.
- O único ponto do repositório que conhece `@react-pdf/renderer` é
  `packages/documentos/src/renderizador-pdf.ts`. O único que conhece `pdfjs-dist` é a **verificação**.

> ⚠️ **`react` entra no `package.json` deste backend, e isso NÃO viola a Fronteira do projeto.** O que
> a Fronteira proíbe é código de interface do produto. Aqui React é **motor de renderização
> server-side** — sem DOM, sem navegador, sem arquivo entregue ao frontend. Um leitor futuro que veja
> `react` num manifesto deste repositório vai suspeitar do contrário, e por isso a afirmação está
> escrita no cabeçalho de `packages/documentos/package.json` e do adaptador.

### 3.4 Visão em Árvore

```
apps
├── api
│   ├── package.json                                          [M] + bullmq
│   ├── src
│   │   ├── app.module.ts                                     [M] registra ConfirmacoesModule
│   │   ├── cadastros
│   │   │   ├── cadastros.module.ts                           [M] provê ConfirmacaoDeEmailService
│   │   │   ├── confirmacao-de-email.service.ts               [N] emite · invalida · enfileira
│   │   │   ├── locatario.controller.ts                       [M] +1 rota · esquemaDoLocatario
│   │   │   └── superficie-de-cadastro.ts                     [M] dispara no criar e no alterar
│   │   ├── confirmacoes
│   │   │   ├── confirmacao.controller.ts                     [N] a rota @RotaPublica()
│   │   │   ├── confirmacao.service.ts                        [N] resolve · consome · publica
│   │   │   └── confirmacoes.module.ts                        [N]
│   │   ├── configuracao
│   │   │   └── ambiente.ts                                   [M] URL_BASE_DA_CONFIRMACAO
│   │   ├── contratos
│   │   │   ├── contrato.controller.ts                        [M] +1 rota (bytes)
│   │   │   └── contrato.service.ts                           [M] documento() · REMOVE o D36
│   │   └── comum
│   │       └── produtor-de-fila.ts                           [N] o produtor BullMQ da borda
│   └── test
│       ├── automacao-de-cobranca.e2e.spec.ts                [M] fixture · §3.6.1
│       ├── autorizacao-do-dominio.e2e.spec.ts                [M] 3 rotas novas · fixture §3.6.1
│       ├── carteira.e2e.spec.ts                              [M] fixture · §3.6.1
│       ├── circulacao-de-cadastro.e2e.spec.ts                [M] fixture · §3.6.1
│       ├── cobertura-de-autorizacao.e2e.spec.ts              [M] 89/74 · publicas cresce em 1
│       ├── cobrancas.e2e.spec.ts                             [M] fixture · §3.6.1
│       ├── confirmacao-de-email.e2e.spec.ts                  [N]
│       ├── contratos.e2e.spec.ts                             [M] pdfContratoArquivo sai
│       ├── documento-do-contrato.e2e.spec.ts                 [N]
│       ├── equivalencia-com-o-documento.spec.ts              [N] vereditos escritos ANTES
│       └── equivalencia-com-o-oraculo.spec.ts                [M] fixture · §3.6.1
└── worker
    ├── src
    │   ├── fila.ts                                           [M] +1 fila e +1 processador
    │   ├── main.ts                                           [M] registra o processador
    │   └── tarefas
    │       └── confirmacao-de-email.ts                       [N]
    └── test
        ├── ambiente.spec.ts                                  [M] URL_BASE_DA_CONFIRMACAO
        ├── confirmacao-de-email.spec.ts                      [N]
        └── regua.spec.ts                                     [M] fixture · §3.6.1

packages
├── contracts
│   ├── src
│   │   ├── confirmacao-de-email.ts                           [N]
│   │   ├── contrato.ts                                       [M] REMOVE pdfContratoArquivo (2×)
│   │   ├── index.ts                                          [M]
│   │   └── pessoa.ts                                         [M] + esquemaDoLocatario
│   └── test
│       └── esquemas.spec.ts                                  [M]
├── db
│   ├── migracoes
│   │   ├── 0013_dominio_documentos_e_confirmacao.sql          [N] gerada por drizzle-kit
│   │   └── 0014_seguranca_confirmacao.sql                     [N] autoral (RLS + DEFINER)
│   ├── src
│   │   ├── cadastro-de-pessoa.ts                             [M] projeção de emailConfirmadoEm
│   │   ├── contrato.ts                                       [M] REMOVE pdf_contrato_arquivo
│   │   ├── documento-de-contrato.ts                          [N] o agregado numa consulta
│   │   ├── esquema
│   │   │   └── negocio.ts                                    [M] coluna nova · tabela nova
│   │   ├── index.ts                                          [M]
│   │   └── portador-de-confirmacao.ts                        [N]
│   └── test
│       ├── banco-efemero.ts                                  [M] semeadura do portador
│       ├── barreira-de-envio.spec.ts                         [M] fixture · §3.6.1
│       ├── catalogo.spec.ts                                  [M] a tabela nova entra na cobertura
│       ├── cobranca.spec.ts                                  [M] fixture · §3.6.1
│       ├── contrato.spec.ts                                  [M]
│       ├── derivacao-de-cobranca.spec.ts                     [M] fixture · §3.6.1
│       ├── documento-de-contrato.spec.ts                     [N]
│       ├── envio-de-cobranca.spec.ts                         [M] fixture · §3.6.1
│       ├── execucao-da-regua.spec.ts                         [M] CT-730 · fixture §3.6.1
│       ├── isolamento.spec.ts                                [M] tabela nova · colunaLivre §3.6.1
│       ├── janela.spec.ts                                    [M] fixture · §3.6.1
│       └── portador-de-confirmacao.spec.ts                   [N]
├── documentos                                                 [N] O PACOTE NOVO (5 → 6)
│   ├── package.json                                          [N]
│   ├── tsconfig.json                                         [N]
│   ├── tsconfig.test.json                                    [N]
│   ├── src
│   │   ├── contrato
│   │   │   ├── clausulas.ts                                  [N] o texto fixo das 21 cláusulas
│   │   │   ├── composicao.ts                                 [N] dados → RepresentacaoTextual
│   │   │   ├── dados.ts                                      [N] a entrada da composição
│   │   │   ├── extenso.ts                                    [N] valor por extenso em pt-BR
│   │   │   └── qualificacao.ts                               [N] PF/PJ · com/sem RG · fiadores
│   │   ├── index.ts                                          [N]
│   │   ├── mensagem-de-confirmacao.ts                        [N]
│   │   ├── normalizacao.ts                                   [N] a regra fechada do D3
│   │   ├── porta-de-renderizacao.ts                          [N]
│   │   └── renderizador-pdf.ts                               [N] adaptador @react-pdf/renderer
│   └── test
│       ├── composicao.spec.ts                                [N]
│       ├── extenso.spec.ts                                   [N]
│       ├── mensagem-de-confirmacao.spec.ts                   [N]
│       ├── normalizacao.spec.ts                              [N]
│       ├── qualificacao.spec.ts                              [N]
│       └── renderizador-pdf.spec.ts                          [N] renderiza e extrai de volta
└── shared
    ├── src
    │   └── fila.ts                                           [M] FILA_DA_CONFIRMACAO + carga
    └── test
        └── fila.spec.ts                                      [M]

deploy
└── scripts
    ├── caracterizacao
    │   ├── capturar.py                                       [M] os 3 caminhos sem oráculo
    │   └── verificar-golden.sh                               [M] os goldens novos
    └── documentos
        └── verificar-isolamento-de-verificacao.sh            [N] CT-733 — RN-16 executável

docs
└── specs/features/caracterizacao-regras-legadas/v1/golden
    ├── PROCEDENCIA.md                                        [M] procedência dos novos
    ├── contrato-pdf-com-fiador.txt                           [N] condicionado à existência
    ├── contrato-pdf-pessoa-juridica.txt                      [N] condicionado à existência
    └── contrato-pdf-sem-rg.txt                               [N] condicionado à existência
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/documentos/package.json` | Manifesto do pacote 6. Dependências: `@sysloc/contracts` e `react`/`@react-pdf/renderer`. **Sem `@sysloc/db`** | Build |
| `packages/documentos/tsconfig.json` · `tsconfig.test.json` | Fiação de compilação, cópia literal do molde de `@sysloc/regua` | Build |
| `packages/documentos/src/index.ts` | Superfície declarada **símbolo a símbolo** — nunca `export *` | Domínio |
| `packages/documentos/src/contrato/dados.ts` | `DadosDoContratoParaDocumento` — o agregado já resolvido que a composição consome | Domínio |
| `packages/documentos/src/contrato/qualificacao.ts` | Qualifica uma parte: PF (`CPF`) × PJ (`CNPJ`), com × sem RG, endereço. É o ponto onde os 3 caminhos sem oráculo se decidem | Domínio |
| `packages/documentos/src/contrato/clausulas.ts` | As 21 cláusulas em texto fixo, com os pontos de interpolação nomeados | Domínio |
| `packages/documentos/src/contrato/extenso.ts` | Valor monetário por extenso **em pt-BR** — a divergência DV-01 mora aqui | Domínio |
| `packages/documentos/src/contrato/composicao.ts` | `comporDocumentoDoContrato(dados, { cancelado })` → `RepresentacaoTextual` (lista de blocos) | Domínio |
| `packages/documentos/src/porta-de-renderizacao.ts` | `PortaDeRenderizacao { renderizar(rep): Promise<Uint8Array> }` (ADR-0025) | Domínio (porta) |
| `packages/documentos/src/renderizador-pdf.ts` | `criarRenderizadorPdf()` sobre `@react-pdf/renderer`, por `createElement` — **sem JSX** | Infraestrutura |
| `packages/documentos/src/normalizacao.ts` | `normalizarParaComparacao` — as 3 operações fechadas do D3, e nada além | Domínio (verificação) |
| `packages/documentos/src/mensagem-de-confirmacao.ts` | `comporMensagemDeConfirmacao({ nome, segredo, urlBase })` → `{ assunto, corpo }` | Domínio |
| `packages/db/migracoes/0013_dominio_documentos_e_confirmacao.sql` | **Gerada.** Coluna `locatario.email_confirmado_em`, tabela `portador_de_confirmacao`, **`DROP COLUMN contrato.pdf_contrato_arquivo`** | Banco |
| `packages/db/migracoes/0014_seguranca_confirmacao.sql` | **Autoral.** `FORCE RLS` + política `FOR ALL` na tabela nova; a **política nominal** e os privilégios mínimos de `sysloc_resolucao`; a função `SECURITY DEFINER` e o `ALTER … OWNER` que a faz atravessar | Banco |
| `packages/db/src/portador-de-confirmacao.ts` | `emitirPortador`, `invalidarPortadoresDoLocatario`, `resolverPortador`, `consumirPortador` | Dados |
| `packages/db/src/documento-de-contrato.ts` | `lerAgregadoDoContrato(tx, codigo)` — uma consulta, todas as partes, sob RLS | Dados |
| `packages/contracts/src/confirmacao-de-email.ts` | `esquemaDaApresentacaoDoPortador`, `esquemaDaConfirmacao`, `esquemaDoReenvioDeConfirmacao` | Contrato |
| `apps/api/src/comum/produtor-de-fila.ts` | `ProdutorDeFila` e o token de injeção — o único ponto da API que conhece BullMQ | Infraestrutura |
| `apps/api/src/cadastros/confirmacao-de-email.service.ts` | O caminho **único** dos dois disparos: invalida, emite, enfileira | Aplicação |
| `apps/api/src/confirmacoes/confirmacao.controller.ts` | A rota `@RotaPublica()` | Apresentação |
| `apps/api/src/confirmacoes/confirmacao.service.ts` | Deriva, resolve pela função do banco, estabelece contexto, consome | Aplicação |
| `apps/api/src/confirmacoes/confirmacoes.module.ts` | Composição do módulo | Composição |
| `apps/worker/src/tarefas/confirmacao-de-email.ts` | `processarConfirmacaoDeEmail` — contexto da carga, composição, entrega | Aplicação |
| `deploy/scripts/documentos/verificar-isolamento-de-verificacao.sh` | **CT-733**: varre os arquivos de teste novos provando que nenhum alcança SMTP real e nenhum escreve no legado. Convenção de `caso`/`ok`/`afirmar_igual`/`aviso`/`fechar_caso`, `set -euo pipefail`, `trap limpar EXIT` | Verificação (shell) |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/contracts/src/contrato.ts` | **Remove** `pdfContratoArquivo` de `esquemaDeContratoNovo` (entrada) **e** de `esquemaDoContrato` (saída) | CA-07 · mudança incompatível deliberada |
| `packages/contracts/src/pessoa.ts` | Acrescenta `esquemaDoLocatario = esquemaDaPessoa.extend({ emailConfirmadoEm })`. **`esquemaDaPessoa` fica intacto** | US-10 · RN-06 · decisão desta sessão |
| `packages/contracts/src/index.ts` | Publica `esquemaDoLocatario`, `Locatario` e os 3 símbolos da confirmação | ADR-0016 |
| `packages/shared/src/fila.ts` | `FILA_DA_CONFIRMACAO` e `CargaDaConfirmacao` (`empresaId`, `locatarioId`, **`segredo`** — os três obrigatórios). ⚠️ **Não é `portadorId`** — ver §4.3: o worker precisa do claro para montar o link e não tem como reconstruí-lo | ADR-0024 · ADR-0029 |
| `packages/db/src/esquema/negocio.ts` | Coluna `email_confirmado_em` **só** em `locatario`; tabela `portador_de_confirmacao`; remove `pdfContratoArquivo` de `contrato` | D4 · D7 |
| `packages/db/src/contrato.ts` | Remove a coluna das **7** ocorrências, medidas por `grep -n`: dois tipos (`:232`, `:292`), o apelido da projeção (`:429`), o mapeamento (`:479`), duas no `INSERT` (`:748`, `:754`) e uma no `UPDATE` (`:913`) | CA-07 |
| `packages/db/src/cadastro-de-pessoa.ts` | (a) A projeção emite `emailConfirmadoEm`: a coluna para `locatario`, `NULL::timestamptz` para os outros dois. **Comportamento de locador e fiador inalterado**. (b) O `UPDATE` do papel `locatario` zera a confirmação **condicionalmente** e devolve `emailMudou` por `RETURNING OLD./NEW.` — §5.1-B.1 passo 2 | US-10 · RD-07 |
| `packages/db/src/index.ts` | Publica os módulos novos | — |
| `packages/db/test/banco-efemero.ts` | `semearPortadorDeConfirmacao` — e é aqui que o **D13 (F3/T5)** deve ser reconsiderado, porque a política de aviso ganha o consumidor que lhe faltava | Precondição de teste |
| `packages/db/test/isolamento.spec.ts` · `catalogo.spec.ts` | A tabela nova entra nas varreduras de RLS forçada e de cobertura do catálogo | ADR-0008 · ADR-0009 |
| `apps/api/src/contratos/contrato.controller.ts` | `@Get(':codigo/documento')`, declarando mídia e nome de arquivo (ADR-0028) | US-02 · CA-08 |
| `apps/api/src/contratos/contrato.service.ts` | Acrescenta `documento()`; **remove o marcador `DÉBITO COM GATILHO — D36`**, que fecha por construção | D36 · RN-03 |
| `apps/api/src/cadastros/locatario.controller.ts` | `@Post(':id/confirmacao-de-email')`; as 6 rotas passam a publicar `esquemaDoLocatario` | US-09 · US-10 |
| `apps/api/src/cadastros/superficie-de-cadastro.ts` | Ganha um **quinto parâmetro opcional** de construtor (`aoGravarEmail?`), acionado dentro da mesma unidade de trabalho quando `emailMudou`. ⚠️ **Nenhum ramo `this.papel === 'locatario'` dentro da classe** — ela é o código genérico dos três papéis; quem supre o gancho é **só** o `LocatarioController` | RN-07 · CA-09 |
| `apps/api/src/cadastros/cadastros.module.ts` | Provê `ConfirmacaoDeEmailService` e o produtor de fila | Composição |
| `apps/api/src/configuracao/ambiente.ts` | Variável `URL_BASE_DA_CONFIRMACAO`, exigida na partida | Link do e-mail |
| `apps/api/src/app.module.ts` | Registra `ConfirmacoesModule` | Composição |
| `apps/api/package.json` | `bullmq` entra nas dependências | ADR-0029 |
| `apps/worker/src/fila.ts` | Constrói a fila da confirmação e aceita o processador | ADR-0029 |
| `apps/worker/src/main.ts` | Registra `processarConfirmacaoDeEmail` | Composição |
| `deploy/scripts/caracterizacao/capturar.py` | Os 3 caminhos ainda sem oráculo. ⚠️ **Não acrescenta caminho de leitura autenticada** — ele roda dentro do site efêmero, logo **não dispara o D3 (F3/T1)** | CA-01 |
| `deploy/scripts/caracterizacao/verificar-golden.sh` | Os goldens novos entram na verificação de integridade | CA-01 |

### 3.6.1 O raio completo do `DROP COLUMN` — 12 arquivos que a árvore não listava

⚠️ **Achado do challenge, medido:** `grep -rl "pdfContratoArquivo\|pdf_contrato_arquivo" --exclude-dir=dist apps packages`
retorna **22** arquivos. A §3.4 declarava **10**. Sob TypeScript strict, tirar o campo dos tipos de
`packages/db/src/contrato.ts` e do `esquemaDoContrato` faz **cada fixture que o carrega parar de
compilar**, em quatro pacotes. Não declará-los produziria o pior desfecho possível: o executor bate
no gatilho de parada *"arquivo fora de escopo"* no meio da task, ou desvia de escopo em silêncio.

**Edição mecânica — remover a linha `pdfContratoArquivo: null` da fixture de contrato:**

| Arquivo | Pacote |
|---|---|
| `packages/db/test/derivacao-de-cobranca.spec.ts` | `@sysloc/db` |
| `packages/db/test/barreira-de-envio.spec.ts` | `@sysloc/db` |
| `packages/db/test/envio-de-cobranca.spec.ts` | `@sysloc/db` |
| `packages/db/test/janela.spec.ts` | `@sysloc/db` |
| `packages/db/test/cobranca.spec.ts` | `@sysloc/db` |
| `packages/db/test/execucao-da-regua.spec.ts` | `@sysloc/db` (o mesmo arquivo do `CT-730`) |
| `apps/worker/test/regua.spec.ts` | `worker` |
| `apps/api/test/automacao-de-cobranca.e2e.spec.ts` | `api` |
| `apps/api/test/carteira.e2e.spec.ts` | `api` |
| `apps/api/test/circulacao-de-cadastro.e2e.spec.ts` | `api` |
| `apps/api/test/cobrancas.e2e.spec.ts` | `api` |
| `apps/api/test/equivalencia-com-o-oraculo.spec.ts` | `api` |

⚠️ **A contagem de casos NÃO pode cair em nenhum destes.** Só a *linha da fixture* sai; nenhum `it`,
nenhuma asserção. É P5 do Protocolo Antirregressão, e a monotonia por pacote é o `CT-733`.

**Edição de desenho — `packages/db/test/isolamento.spec.ts`, e ela não é mecânica.**

A coluna que sai é a **`colunaLivre` da entidade `contrato`** (`isolamento.spec.ts:1435-1439`), e o
comentário no ponto já registra por que `codigo` não serve: ele participa de
`contrato_empresa_codigo_key`, e reescrevê-lo faria o caso disputar com a unicidade em vez de medir
visibilidade. **Depois do `DROP`, `negocio.contrato` fica sem coluna de texto livre alguma.**

**Decisão desta sessão** — aplicar o precedente que o próprio arquivo já instalou para
`contrato_fiador` (§ docblock de `valorDaEscritaCruzada`, `isolamento.spec.ts:1199-1208`): quando não
há coluna de texto, usa-se uma coluna reescrevível tipada **com `valorDaEscritaCruzada` explícito**.

```ts
consultaDoRetrato: consultaDeRetrato('negocio.contrato', 'valor_total_contrato'),
colunaLivre: 'valor_total_contrato',
valorDaEscritaCruzada: '9999.99',
```

Por que **`valor_total_contrato`**, medido contra a `0007` e a `catalogo.spec.ts`:

1. `numeric(15,2)` **anulável**, sem unicidade e sem `CHECK` — as demais colunas ou são `NOT NULL`,
   ou carregam `CHECK` (`dia_vencimento`, `prazo_meses`, `valor_mensal`), ou são chave estrangeira.
2. É **derivada na ativação** (RD-10), e as linhas que o caso semeia são `RASCUNHO` — logo ela nasce
   `NULL` e **nada mais no produto disputa** aquele valor.
3. `valorDaEscritaCruzada: '9999.99'` é literal numérico válido, então a conversão do parâmetro passa
   e o caso volta a medir **política**, não tipagem — que é exatamente o risco que o docblock nomeia.

O `INSERT` de semeadura do mesmo bloco (`isolamento.spec.ts:1449`) também perde a coluna da lista e
o `${null}` correspondente dos `VALUES`.

**E `packages/db/test/catalogo.spec.ts`** perde `'n:contrato_pdf_contrato_arquivo_not_null'`? **Não** —
a coluna é anulável e o comentário de `catalogo.spec.ts:1110` afirma justamente que ela **não**
aparece na lista de restrições. A igualdade de conjunto ali segue verde sem edição; o que muda no
arquivo é só a entrada da tabela nova. **A menção a `pdf_contrato_arquivo` no comentário fica**, e
vira registro histórico — reescrevê-la para tirar o nome apagaria a razão pela qual as quatro
colunas anuláveis estão nomeadas ali.

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf.txt` | **O oráculo.** 174 linhas, texto extraído do PDF do wkhtmltopdf |
| `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf-fonte.py` | **A regra legada.** 759 linhas; é dela que sai a ordem dos blocos e a qualificação das partes |
| `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-cancelamento.json` | Os dois cenários com veredito escrito antes: `CTR-CARACT-CAN-SEM-PDF` e `CTR-CARACT-CAN-SEM-IMOVEL` |
| `packages/regua/src/index.ts` · `porta-de-dados.ts` · `porta-de-email.ts` | O molde de pacote de domínio com porta declarada, e o **capturador** que a verificação injeta |
| `packages/regua/src/adaptador-smtp.ts` | O adaptador de produção que o `worker` já compõe — **não se duplica** |
| `packages/db/migracoes/0008_seguranca_contrato.sql` · `0010_seguranca_cobranca.sql` | O molde literal de `SECURITY DEFINER` com `SET search_path` e sem `empresa_id` por parâmetro. ⚠️ **O molde para aqui**: as quatro funções de lá operam sobre **sequências**, que não têm RLS — copiá-lo para uma tabela sob `FORCE` reconstrói o defeito corrigido na §7.3 |
| `packages/db/migracoes/0012_seguranca_regua.sql` | O molde literal de `FORCE ROW LEVEL SECURITY` + política `FOR ALL` |
| `apps/api/src/autenticacao/cobertura-de-autorizacao.ts` | Como a superfície é enumerada pelo roteador montado, e por que o `HEAD` derivado é suprimido |
| `apps/api/src/autenticacao/rota-publica.decorator.ts` | A **única** forma de dispensar sessão |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | O `CT-635`: dupla medição independente com igualdade afirmada e três mutantes |
| `apps/api/test/equivalencia-com-o-oraculo.spec.ts` | O molde de equivalência com **vereditos escritos antes** e o lado do oráculo lido do golden |
| `apps/api/src/comum/filtro-excecao.ts` | ⚠️ A `DECISÃO FECHADA` que proíbe levantar `REQUISICAO_RECUSADA` de código de negócio |
| `packages/db/src/unidade-de-trabalho.ts` | A `DECISÃO FECHADA` do `SET LOCAL` — intocada por esta fatia |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

**3 rotas novas · 3 manipuladores novos · 86 → 89 rotas, 71 → 74 manipuladores.**

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|---|---|---|---|---|---|---|
| Baixar o documento do contrato | `GET` | `/v1/contratos/:codigo/documento` | — | **bytes** `application/pdf` + `Content-Disposition: attachment; filename="CTR-2026-00001.pdf"` | `200` · `401` · `403` · `404` | Sessão + `@ExigeChave('TELA:contratos')` (herdada da classe) |
| Reenviar a confirmação | `POST` | `/v1/locatarios/:id/confirmacao-de-email` | corpo vazio (`ESQUEMA_DO_CORPO_VAZIO`) | `{ reenviadoEm, expiraEm }` | `202` · `401` · `403` · `404` | Sessão + `@ExigeChave('TELA:cadastros')` (herdada da classe) |
| Confirmar o endereço | `POST` | `/v1/confirmacoes-de-email` | `{ segredo }` | `{ confirmado: true }` | `200` · `404` · `422` | **`@RotaPublica()`** — sem sessão |

**Sobre a exigência do reenvio.** É a **área e só a área** — `TELA:cadastros`, herdada da classe, sem
`@ExigeChaves` plural. O catálogo 10×7 **permanece fechado** (RN-13): nenhuma chave de ação nasce
aqui. A rota **não** declara nada própria, exatamente para que `getAllAndOverride` encontre a
declaração da classe — declarar só a área no método seria redundância que o `CT-355` já vigia.

**Sobre o `202` do reenvio — é o primeiro do produto, e a quebra do padrão é deliberada.** Os **20**
`@HttpCode` da API são hoje todos `200`, inclusive nas rotas de ação (`ativacao`, `cancelamento`,
`retirada`, `recirculacao`). A diferença é de conteúdo, não de gosto: aquelas devolvem o **estado já
alcançado** pelo ato, e esta devolve um **ato aceito cujo efeito externo corre fora da requisição**
(ADR-0029). É exatamente por isso que o corpo `{ reenviadoEm, expiraEm }` afirma só o que **já**
aconteceu — portador gravado, anteriores invalidados — e **cala sobre a entrega**, que ainda não
ocorreu. Um `200` prometeria um desfecho que a borda não tem. O `CT-719` torna a decisão verificável
ao cobrar `Object.keys` igual ao par declarado, sem chave alguma de desfecho de e-mail.

**Sobre a rota do documento.** Ela **permanece no contrato publicado** e declara as três coisas que a
ADR-0028 exige — tipo de mídia, nome sugerido do arquivo e o mesmo envelope de erro. A **cláusula de
exceção daquela ADR não se ativa**, e isso foi **medido, não assumido**:
`ApiResponseCommonMetadata extends Omit<ResponseObject, 'description'>`, e `ResponseObject` aceita
`content` e `headers`. Não escreva exceção declarada onde ela não é necessária.

```ts
@ApiOkResponse({
  description: 'o contrato em PDF, composto no instante do pedido',
  content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'attachment; filename="CTR-….pdf"' } },
})
```

### 4.1.1 Exemplo de Payload por Endpoint

**N/A — nenhuma rota desta fatia aceita atualização parcial.** As três são: uma leitura sem corpo, um
`POST` de corpo vazio e um `POST` de corpo `strictObject` **completo, sem campo opcional**. A
armadilha que esta subseção existe para evitar (copiar `required` do `POST` para um `PUT` parcial)
não tem onde acontecer aqui.

Corpo da rota sem sessão, por extenso:

```
POST /v1/confirmacoes-de-email
Content-Type: application/json

{ "segredo": "3q2-7bV1yZ8xK0pQwErTyUiOpAsDfGhJkLzXcVbNm4Y" }

200  { "confirmado": true }
404  { "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado" }
422  { "codigo": "CAMPO_INVALIDO", "mensagem": "…", "campo": "segredo" }
```

⚠️ **O `422` é do esquema (segredo com forma errada) e o `404` é do ato.** Os dois são distinguíveis
entre si de propósito — o que a RN-14 proíbe é distinguir **inválido, vencido e consumido fora da
validade**, e os três produzem o **mesmo** `404`, byte a byte.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|---|---|---|---|
| `esquemaDoLocatario` | `packages/contracts/src/pessoa.ts` (**novo**) | os **15** de `esquemaDaPessoa` + `emailConfirmadoEm: string \| null` (ISO-8601) | v1 |
| `esquemaDaPessoa` | `packages/contracts/src/pessoa.ts` (**intacto**) | os **15** campos de sempre — locador e fiador. ⚠️ São 15, e não 14: `id`, `nome`, `tipoPessoa`, `documentoPrincipal`, `rg`, `email`, `telefone`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`, `retiradoEm` — contados no arquivo, não estimados | v1 |
| `esquemaDaApresentacaoDoPortador` | `packages/contracts/src/confirmacao-de-email.ts` (**novo**) | `segredo: string` — `strictObject`, comprimento **exato** de 43 caracteres, molde `[A-Za-z0-9_-]{43}` (base64url de 32 bytes, sem enchimento) | v1 |
| `esquemaDaConfirmacao` | idem | `confirmado: z.literal(true)` | v1 |
| `esquemaDoReenvioDeConfirmacao` | idem | `reenviadoEm`, `expiraEm` (ISO-8601) | v1 |
| `esquemaDeContratoNovo` | `packages/contracts/src/contrato.ts` (**modificado**) | **sem** `pdfContratoArquivo` | v1 |
| `esquemaDoContrato` | idem | **sem** `pdfContratoArquivo` | v1 |
| `esquemaDoErro` | `apps/api/src/comum/esquema-de-erro.ts` (**reuso**) | `{ codigo, mensagem, campo?, detalhes? }` — ADR-0017 | v1 |

> O molde do segredo é **fechado no esquema**, e não conferido à mão: um segredo malformado é `422`
> do arcabouço, e nunca chega a virar consulta ao banco. Isso reduz a superfície da rota pública sem
> uma linha de verificação escrita.

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Fila | Payload | Schema |
|---|---|---|---|---|
| Confirmação de endereço a entregar | pub (API) / sub (worker) | `confirmacao-de-email` | `{ empresaId, locatarioId, segredo }` — **os três obrigatórios** | `CargaDaConfirmacao` em `packages/shared/src/fila.ts` |

Os três campos são obrigatórios pela mesma razão que `CargaDaRegua.empresaId` é: campo opcional
reabriria o pior modo de falha da ADR-0008 — sem contexto a RLS devolve vazio **em silêncio**, e o
trabalho *parece* ter rodado.

> ⚠️ **Sim, o segredo em claro viaja na carga — e é a única forma.** A borda gera o segredo, grava
> apenas o **derivado** e descarta o claro ao fim da transação. O worker precisa do claro para montar
> o link, e **não tem como reconstruí-lo**: é exatamente essa impossibilidade que a RN-11 exige, e
> ela vale também para o nosso próprio processo. Carregar `portadorId` em vez do segredo seria
> inútil — o worker leria o derivado e continuaria sem o que pôr no link.
>
> O que fecha o risco: (a) o claro **nunca** é gravado no banco; (b) `segredo` entra na lista de
> chaves **redigidas** do despacho único de redação que a F1 instalou, e por isso não aparece em
> registro nenhum; (c) ele vive em Redis apenas pelo tempo da tarefa. A exposição residual — a
> retenção de 1.000 tarefas concluídas — está declarada em §11.3, e não descoberta.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**A — O documento do contrato** (`GET /v1/contratos/:codigo/documento`)

1. **Guarda de contexto** — sessão exigida; `@ExigeChave('TELA:contratos')` **herdada da classe**, sem
   declaração própria no método. Sem sessão → `401 NAO_AUTENTICADO`; sem a área → `403 ACESSO_NEGADO`.
2. **`ContratoController.documento`** → `sobContextoDaSessao(banco, requisicao, …)`, que abre a
   unidade e emite `SET LOCAL app.empresa_id`.
3. **`lerAgregadoDoContrato(tx, codigo)`** — uma consulta, sob RLS: o contrato, o locador, o
   locatário, o imóvel e os fiadores. Contrato de outra empresa **não retorna linha** (é o banco que
   decide, não a aplicação) → `404 RECURSO_NAO_ENCONTRADO`.
4. **`comporDocumentoDoContrato(dados, { cancelado: contrato.status === 'CANCELADO' })`** — função
   pura, em `@sysloc/documentos`. Produz `RepresentacaoTextual`: a lista ordenada de blocos.
5. **`portaDeRenderizacao.renderizar(representacao)`** → `Uint8Array`.
6. **Resposta** — `200`, `Content-Type: application/pdf`,
   `Content-Disposition: attachment; filename="<codigo>.pdf"`.

**Nada é gravado em nenhum passo.** É a métrica nº 2 do PRD, e ela é obtida por **ausência de
caminho de escrita**, não por rotina de invalidação.

**B — A confirmação do endereço**

*B.1 — o disparo (automático e manual convergem)*

1. `POST /v1/locatarios` ou `PUT /v1/locatarios/:id` grava o cadastro; **ou**
   `POST /v1/locatarios/:id/confirmacao-de-email` é chamada pelo operador.
2. **A condição mora no próprio `UPDATE`, e é decisão desta sessão.** `PUT /v1/locatarios/:id` é
   substituição integral (`esquemaDePessoaNova`), logo **todo** `PUT` carrega `email` — se o disparo
   dependesse de *"o corpo trouxe o campo"*, ele ocorreria em toda alteração, contrariando o
   `CT-718`. `alterarPessoa` do papel `locatario` decide no comando, sem ler-antes-de-escrever:

   ```sql
   UPDATE negocio.locatario SET
     email = ${novo},
     -- a referência não qualificada a `email` no SET é o valor ANTERIOR (semântica do SQL)
     email_confirmado_em = CASE WHEN email IS DISTINCT FROM ${novo}
                                THEN NULL ELSE email_confirmado_em END
     -- … demais colunas …
   RETURNING <colunasDaPessoa>, (OLD.email IS DISTINCT FROM NEW.email) AS "emailMudou"
   ```

   ⚠️ **`RETURNING OLD.`/`NEW.` é recurso do PostgreSQL 18**, e a versão foi conferida: `psql 18.4`
   no host e `embedded-postgres 18.4.0-beta.17` na suíte. Numa base anterior isto é erro de sintaxe,
   não resultado errado — falha alto, o que é o desejável.

   No **criar**, `emailMudou` é verdadeiro por definição quando há e-mail. No **reenvio manual**, o
   disparo é incondicional e **não toca `email_confirmado_em`** — reenviar não desconfirma.

3. Com `emailMudou` verdadeiro, e na **mesma** unidade de trabalho,
   `ConfirmacaoDeEmailService.disparar(tx, locatarioId, email)`:
   a. `invalidarPortadoresDoLocatario` — marca os vivos como invalidados (RN-09);
   b. `emitirPortador` — 32 bytes de `node:crypto.randomBytes`, base64url; grava
      `sha256(segredo)`, `expira_em = pg_catalog.now() + interval '72 hours'`;
   c. **enfileira** `{ empresaId, locatarioId, segredo }` na fila `confirmacao-de-email`.

   **Onde o disparo é ligado, e por quê ali.** `SuperficieDeCadastro` é **compartilhada pelos três
   papéis** — locador, locatário e fiador constroem a mesma classe com `papel` fixado no construtor
   —, de modo que um disparo escrito nela sem condição alcançaria os três. A ligação é um **quinto
   parâmetro opcional** do construtor (`aoGravarEmail?`), suprido **só** por `LocatarioController`.
   ⚠️ **Não** escreva `if (this.papel === 'locatario')` dentro da superfície: ela é o código genérico
   dos três papéis, e comportamento específico de papel ali é o que a classe existe para evitar.
4. O commit da unidade e o enfileiramento: o `add` da fila roda **depois** do `COMMIT`, dentro do
   mesmo manipulador. Ver §9.2 sobre por que a perda é aceita e qual é a rede.

*B.2 — a entrega (worker)*

5. `processarConfirmacaoDeEmail(tarefa)` valida a carga por esquema Zod, e então
   `contextoDeTenant.executarCom({ empresaId }, …)` — **uma vez, na borda que a recebe** (ADR-0024).
6. Lê o locatário sob RLS, compõe com `comporMensagemDeConfirmacao` e entrega pela
   `PortaDeEnvioDeEmail`. Falha → rejeita, e a fila repete com a política de `@sysloc/shared`.

*B.3 — o ato do titular* (`POST /v1/confirmacoes-de-email`, sem sessão)

7. O esquema confere o molde do segredo. Malformado → `422 CAMPO_INVALIDO`.
8. `derivado := sha256(segredo)`.
9. `SELECT * FROM negocio.resolver_portador_de_confirmacao(derivado)` — **fora** de qualquer contexto
   de tenant, pela função `SECURITY DEFINER`. Ela devolve `(empresa_id, locatario_id, consumido_em)`
   **apenas** quando existe portador com aquele derivado, **não invalidado** e **dentro do prazo**;
   fora disso devolve **zero linhas**.
10. Zero linhas → `404 RECURSO_NAO_ENCONTRADO`, e **nenhuma escrita acontece**.
11. Uma linha → `contextoDeTenant.executarCom({ empresaId }, …)` e, na unidade de trabalho:
    - se `consumido_em IS NULL` → grava `consumido_em = now()` e
      `locatario.email_confirmado_em = now()`;
    - se `consumido_em IS NOT NULL` → **não grava nada** (RN-10);
    - nos dois casos → `200 { confirmado: true }`, resposta **idêntica**.

### 5.2 Fluxos Alternativos

| Situação | Comportamento | Regra |
|---|---|---|
| A mensagem não chega | O operador com `TELA:cadastros` reenvia; o portador anterior é invalidado no mesmo ato | RN-09 · CA-10 |
| O locatário abre o mesmo link duas vezes, dentro das 72 h | `200 { confirmado: true }`, **nada é alterado** — inclusive `email_confirmado_em`, que **não é reescrito** | RN-10 · CA-12 |
| O provedor de e-mail pré-visualiza o link | Idem ao anterior. A rota é `POST`, o que já reduz a chance; a RN-10 fecha o resto | RN-10 |
| Link com mais de 72 h | `404`, endereço permanece não confirmado, e a recusa **não distingue** de link inexistente | RN-14 · CA-13 |
| O derivado é apresentado como se fosse o segredo | **Duas camadas, e o CT-725 exercita as duas.** Na forma **hexadecimal** (64 caracteres) o molde do esquema recusa → `422`. Na forma **base64url** — o digest tem 32 bytes, logo `digest('base64url')` dá exatamente 43 caracteres e **passa** pelo esquema — a busca não encontra portador, porque o que está guardado é `sha256(segredo)` e não `sha256(derivado)` → `404` | CA-14 |
| Troca de endereço depois de confirmado | Endereço novo nasce não confirmado e uma confirmação sai sozinha | RN-07 · CA-09 |
| Contrato de outra empresa, ou operador sem `TELA:contratos`, ou pedido sem sessão | Nenhum dos três recebe o documento — `404`, `403` e `401` respectivamente | RN-05 · CA-08 |
| Contrato que nunca teve documento e precisa ser cancelado | **Cancela normalmente.** Não há pré-condição — ela não existe mais | RN-03 · CA-05 |
| Não existem no legado contratos que exercitem um caminho sem oráculo | A ausência é **medida e registrada** como ausência medida; o caminho segue provado por composição. **Nada é criado no sistema antigo** | CA-01 |

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | Fase 1 — captura no legado (fora do processo do produto) | `deploy/scripts/caracterizacao/capturar.py`, `preparar-site-efemero.sh`, `verificar-golden.sh` |
| US-02 | §5.1-A · `GET /v1/contratos/:codigo/documento` | `ContratoController`, `ContratoService.documento`, `lerAgregadoDoContrato`, `comporDocumentoDoContrato`, `criarRenderizadorPdf` |
| US-03 | §5.1-A passo 4, com `{ cancelado: true }` | `comporDocumentoDoContrato`, `clausulas.ts` |
| US-04 | `POST /v1/contratos/:codigo/cancelamento` — **sem** pré-condição de documento | `ContratoService.cancelar` (remove o marcador D36) |
| US-05 | Migração `0013` + contrato publicado | `0013_dominio_documentos_e_confirmacao.sql`, `packages/db/src/contrato.ts`, `packages/contracts/src/contrato.ts` |
| US-06 | §5.1-A passos 1 a 3 | `ContextoGuard`, `@ExigeChave`, RLS de `negocio.contrato` |
| US-07 | §5.1-B.3 · `POST /v1/confirmacoes-de-email` | `ConfirmacaoController`, `ConfirmacaoService`, `negocio.resolver_portador_de_confirmacao` |
| US-08 | §5.1-B.1 pelo caminho do cadastro | `SuperficieDeCadastro.criar`/`.alterar`, `ConfirmacaoDeEmailService` |
| US-09 | §5.1-B.1 pelo caminho manual · `POST /v1/locatarios/:id/confirmacao-de-email` | `LocatarioController`, `ConfirmacaoDeEmailService` |
| US-10 | `GET /v1/locatarios` e `GET /v1/locatarios/:id` | `esquemaDoLocatario`, projeção de `cadastro-de-pessoa.ts` |
| US-11 | Verificação — dupla medição da superfície e suíte por pacote | `cobertura-de-autorizacao.ts`, `cobertura-de-autorizacao.e2e.spec.ts` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|---|---|---|
| `segredo` casa `^[A-Za-z0-9_-]{43}$` | `esquemaDaApresentacaoDoPortador`, na borda | `422 CAMPO_INVALIDO` nomeando `segredo`, **antes** de qualquer consulta |
| Corpo do reenvio é **vazio e estrito** | `ESQUEMA_DO_CORPO_VAZIO` (reuso — ver o `D23` já fechado) | `422 CAMPO_INVALIDO` |
| `:codigo` do contrato casa `CTR-{ano}-{5 dígitos}` | `ESQUEMA_DO_CODIGO_DE_CONTRATO` (reuso) | `422 CAMPO_INVALIDO` |
| `:id` do locatário é UUID | `ESQUEMA_DO_IDENTIFICADOR` (reuso) | `422 CAMPO_INVALIDO` |
| `email` do locatário continua sendo normalizado e validado | `esquemaDePessoaNova` (**inalterado**) | `422 CAMPO_INVALIDO` |
| A carga da fila é conferida por esquema no consumidor | `apps/worker/src/tarefas/confirmacao-de-email.ts` | Rejeita a tarefa; a fila repete e depois a dá por falha |

### 6.2 Transformações de Dados

- **Segredo → derivado**: `createHash('sha256').update(segredo, 'utf8').digest('hex')`, 64
  caracteres. **Ponto único** em `packages/db/src/portador-de-confirmacao.ts`; a borda nunca deriva
  por conta própria.
- **Bytes → segredo**: `randomBytes(32).toString('base64url')` → 43 caracteres, sem enchimento.
- **Instante → ISO**: `emailConfirmadoEm` e `expiraEm` saem como `z.iso.datetime()`, como todo
  `timestamptz` publicado.
- **Agregado → `DadosDoContratoParaDocumento`**: a tradução acontece **na camada de dados**, de modo
  que `@sysloc/documentos` recebe um tipo que ele mesmo declara e nunca uma linha de banco.
- **Valor monetário → extenso**: `extenso.ts`, **em pt-BR**. O legado emite em inglês; é a divergência
  **DV-01**, com veredito escrito antes (§21).

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|---|---|---|---|
| RD-01 | RN-01 | O documento é composto no instante do pedido. **Não existe caminho de escrita** de documento no produto | — |
| RD-02 | RN-02 | A marca de cancelamento é **parâmetro** de `comporDocumentoDoContrato`, derivado de `status === 'CANCELADO'` | — |
| RD-03 | RN-03 | O cancelamento confere só o estado (`ATIVO`) e as condições do negócio | `422` estado inválido (já existente) |
| RD-04 | RN-04 | Contrato sem imóvel é **irrepresentável**: `contrato.imovel_id` é `NOT NULL` com FK composta. A garantia é do banco, não da aplicação | — (a aplicação não oferece recusa equivalente) |
| RD-05 | RN-05 | O documento exige sessão + `TELA:contratos` + empresa dona. Os três são impostos por mecanismos distintos: guarda, decorador e RLS | `401` · `403` · `404` |
| RD-06 | RN-06 | `emailConfirmadoEm` é **informativo**: nenhum predicado de elegibilidade da régua o consulta | — |
| RD-07 | RN-07 | O e-mail **mudar** — criar com e-mail, ou alterar para valor distinto — zera a confirmação e dispara. ⚠️ `PUT` é substituição integral e carrega `email` **sempre**: a condição é `IS DISTINCT FROM` sobre o valor anterior, nunca *"o corpo trouxe o campo"*. É o que o `CT-718` mede, e a RN-07 do PRD diz literalmente *"cadastrar ou alterar **o endereço de e-mail**"* | — |
| RD-08 | RN-08 | `expira_em = now() + interval '72 hours'`, calculado **pelo banco** (ADR-0026) | — |
| RD-09 | RN-09 | Emitir portador invalida os anteriores **do mesmo locatário**, no mesmo ato | — |
| RD-10 | RN-10 | Portador consumido dentro do prazo continua resolvendo, e a resposta é sucesso **sem escrita** | — |
| RD-11 | RN-11 | O segredo é sorteado, guardado só como SHA-256, e a busca é **pelo derivado** — segredo nunca é comparado com segredo | — |
| RD-12 | RN-12 | O contexto de empresa vem do registro que o portador resolve, **nunca** do pedido | — |
| RD-13 | RN-13 | Reenvio exige `TELA:cadastros`. **Nenhuma chave de ação nova** — o catálogo 10×7 permanece fechado | `403 ACESSO_NEGADO` |
| RD-14 | RN-14 | Inválido, vencido e consumido-fora-do-prazo produzem `404 RECURSO_NAO_ENCONTRADO` **idêntico**, e nenhum altera estado | `404` |
| RD-15 | RN-15 | Toda diferença com o oráculo tem veredito **escrito antes** (§21, DV-01 a DV-07) | — |
| RD-16 | RN-16 | Nenhuma verificação alcança destinatário real (capturador) nem escreve no legado (leitura autenticada e não destrutiva) | — |

> **RD-11, e por que ela não pede comparação de tempo constante.** A propriedade *"a verificação não
> revela informação pelo tempo"* é alcançada **estruturalmente**: não há comparação de segredos. O
> que existe é uma busca por índice sobre o derivado, cujo custo não depende de quão parecido o
> candidato é do valor guardado. Onde sobrar comparação em memória, use `timingSafeEqual`.

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, **nativo, sem Docker**. Instância única, isolamento lógico por
`empresa_id` com **RLS forçada** (ADR-0008/0009). Acesso por Drizzle + postgres.js sob o papel
`sysloc_app`; migrações sob `sysloc_migracao`. Esta fatia acrescenta um **terceiro** papel,
`sysloc_resolucao` — `NOLOGIN`, dono de uma única função e de nenhuma tabela, criado pelo
provisionamento. A razão está na §7.3, e ela não é preferência: sem ele a resolução do portador
devolve zero linhas.

### 7.2 Tabelas / Coleções

**`negocio.portador_de_confirmacao`** — a tabela nova.

| Coluna | Tipo | Constraints | Índices |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `empresa_id` | `uuid` | `NOT NULL REFERENCES identidade.empresa(id)` | parte do `uidx` abaixo |
| `locatario_id` | `uuid` | `NOT NULL`, **FK composta** `(locatario_id, empresa_id) → locatario(id, empresa_id)` | `idx (empresa_id, locatario_id)` |
| `derivado` | `text` | `NOT NULL`, **`UNIQUE`** | `uidx (derivado)` — é por ele que a resolução busca |
| `expira_em` | `timestamptz` | `NOT NULL` | — |
| `consumido_em` | `timestamptz` | anulável — **o portador consumido permanece** (RN-10) | — |
| `invalidado_em` | `timestamptz` | anulável — o reenvio marca os anteriores (RN-09) | — |
| `criado_em` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| — | — | `UNIQUE (id, empresa_id)` | a forma canônica de referência tenantizada |

- **`derivado` é `UNIQUE` global, e não por empresa.** É deliberado: a resolução acontece **antes** de
  existir contexto de tenant, e uma unicidade por empresa admitiria colisão entre empresas que a
  função `SECURITY DEFINER` teria de desempatar — desempate que só poderia vir do pedido, que é
  exatamente o que a ADR-0024 proíbe. Com 256 bits de entropia, a colisão é irrelevante e a restrição
  a torna impossível de passar em silêncio.
- **Não há coluna do segredo em claro.** A ausência é a decisão, e é o que a CA-14 afirma.

**`negocio.locatario`** — uma coluna nova, **só nesta tabela**.

| Coluna | Tipo | Constraints |
|---|---|---|
| `email_confirmado_em` | `timestamptz` | anulável. É o **fato**; o estado publicado é derivado dele (ADR-0022) |

**`negocio.contrato`** — uma coluna **removida**.

| Coluna | Operação |
|---|---|
| `pdf_contrato_arquivo` | `DROP COLUMN` — some do que se guarda **e** do que se publica (CA-07) |

### 7.3 Migrações

| Versão | Arquivo | Operação |
|---|---|---|
| `0013` | `0013_dominio_documentos_e_confirmacao.sql` | **up** — gerada por `drizzle-kit`: `CREATE TABLE negocio.portador_de_confirmacao` (com `ENABLE ROW LEVEL SECURITY`), `ALTER TABLE negocio.locatario ADD COLUMN email_confirmado_em`, `ALTER TABLE negocio.contrato DROP COLUMN pdf_contrato_arquivo` |
| `0014` | `0014_seguranca_confirmacao.sql` | **up** — autoral: `FORCE ROW LEVEL SECURITY` + política `FOR ALL` na tabela nova; guarda de existência de `sysloc_resolucao`, política nominal `FOR SELECT` e privilégios mínimos dele; `CREATE FUNCTION negocio.resolver_portador_de_confirmacao` e `ALTER FUNCTION … OWNER TO "sysloc_resolucao"` |

**Sem descida (`down`)** — reverter isolamento por migração é operação de risco, e o caminho de volta
é restauração de backup. É a convenção das cinco migrações de segurança anteriores.

**A `0007` NÃO é emendada** (D4). A remoção sai em arquivo novo, o que é correto **nos dois estados
possíveis do banco**: o `migrar-banco.sh` registra `sha256sum` por arquivo em
`identidade.migracao_aplicada` e **aborta** quando um arquivo já aplicado muda. A unidade
`sysloc-api.service` está **`active`** nesta máquina contra o banco da operação, o que é indício forte
de que a `0007` já é imutável — mas a decisão não depende da resposta.

> **Medição pendente, não bloqueante** (tech-alignment §5): a confirmação da `[DÚVIDA] B` interessa
> ao **D20 (F3/T7)**, cujo gatilho *fecha em silêncio*. O comando é
> `SELECT arquivo FROM identidade.migracao_aplicada ORDER BY arquivo`, executado com a credencial de
> `/etc/sysloc/migracao.env` (0600) — **pelo operador**, não por subagente. O resultado entra no
> `_run/run-report.md`; não altera nada desta especificação.

> ⚠️ **CORREÇÃO DE 2026-08-13 — `SECURITY DEFINER` NÃO atravessa `FORCE ROW LEVEL SECURITY`.** Esta
> seção afirmava que *"o molde é literalmente o das `0008` e `0010`"* e que uma função `DEFINER`
> bastava para resolver o portador sem contexto. **É falso, e foi medido** contra PostgreSQL 18.4
> real, com os papéis do provisionamento: a função devolvia `[]` em 100% das chamadas do único
> cenário que ela existe para atender. O mecanismo, em três frases: `SECURITY DEFINER` faz
> `current_user` virar o **dono da função**; o dono era `sysloc_migracao`, que é também o **dono da
> tabela**; e `FORCE` é exatamente o que deixa de isentar o dono da tabela. Os dois papéis nascem
> `NOSUPERUSER NOBYPASSRLS` nas duas frentes de provisionamento, então nada os resgata — a política
> é avaliada dentro da função, sem contexto vira `empresa_id = NULL` e não casa linha nenhuma.
>
> **Por que o molde não transportava a propriedade**: as quatro funções `DEFINER` já existentes
> (`0008` blocos 4-5, `0010`) operam sobre **sequências**, que não têm RLS. Esta é a **primeira** do
> produto a ler uma tabela com `FORCE`. Quem copiar aquele molde para outra tabela tenantizada
> reconstrói o mesmo defeito — e ele **não** aparece em asserção de catálogo: assinatura,
> `prosecdef`, `search_path` e as duas concessões ficam todas verdes sobre uma função morta.

**A travessia exige TRÊS peças, e nenhuma basta sozinha** — todas na `0014`, e todas com a
minimalidade medida (retirar qualquer uma reprova o **CT-735**):

1. um papel **`NOLOGIN` de propósito único**, `sysloc_resolucao`, que não conecta e não é dono de
   tabela alguma. Ele **nasce no provisionamento**, nas duas frentes
   (`deploy/scripts/instalacao/provisionar-base.sh` P15 e `provisionar()` de
   `packages/db/test/banco-efemero.ts`), porque `sysloc_migracao` é `NOCREATEROLE` — criar papel a
   partir da migração devolve `42501 · Only roles with the CREATEROLE attribute may create roles`. A
   `0014` apenas **confere** que ele existe e aborta nomeando o passo do provisionamento;
2. uma **política nominal** sobre a tabela, `FOR SELECT TO sysloc_resolucao USING (true)`, mais os
   privilégios mínimos (`USAGE` no schema e `SELECT` na tabela). A política de isolamento por empresa
   **permanece intacta**: políticas permissivas se combinam por OU, e esta acrescenta um caminho para
   **um papel só**;
3. `ALTER FUNCTION … OWNER TO "sysloc_resolucao"`, que é o que faz o `DEFINER` rodar como o papel
   alcançado pela política. O `ALTER` exige que quem o executa seja **membro** do papel de destino
   (daí a membership `WITH INHERIT FALSE, SET TRUE` concedida no provisionamento) e que o papel de
   destino tenha **`CREATE` no schema** — que a `0014` empresta imediatamente antes e **devolve**
   logo depois, para que o estado final seja só `USAGE` + `SELECT`.

A alternativa considerada e descartada era conceder a leitura irrestrita ao próprio `sysloc_migracao`
(política `FOR SELECT TO sysloc_migracao USING (true)`, dono inalterado). Funciona igual e é pior:
ele é o papel que aplica **toda** migração e é dono de **todas** as tabelas, de modo que a exceção
viraria precedente copiável. O invariante que o projeto sustenta em toda parte é *nenhum papel enxerga
linha de outra empresa sem contexto, nem o dono* — e a forma escolhida confina a exceção a um papel
auditável por nome.

**A função, por extenso** (o arquivo `0014` é a fonte; isto é a leitura dela):

```sql
CREATE FUNCTION "negocio"."resolver_portador_de_confirmacao"(p_derivado text)
	RETURNS TABLE (empresa_id uuid, locatario_id uuid, consumido_em timestamptz)
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
	SELECT p.empresa_id, p.locatario_id, p.consumido_em
	FROM negocio.portador_de_confirmacao p
	WHERE p.derivado = p_derivado
	  AND p.invalidado_em IS NULL
	  AND p.expira_em > pg_catalog.now();
$$;
-- …e, no fim do arquivo, o que a faz de fato atravessar:
ALTER FUNCTION "negocio"."resolver_portador_de_confirmacao"(text) OWNER TO "sysloc_resolucao";
```

Quatro propriedades, e cada uma é conteúdo:

1. **Não aceita `empresa_id` por parâmetro.** É a mesma decisão das quatro funções de série já
   existentes: `SECURITY DEFINER` roda com os direitos do dono, e um tenant vindo de fora seria uma
   segunda origem de contexto — exatamente o que a ADR-0024 fecha.
2. **Devolve três colunas, e nenhuma a mais.** Não devolve `derivado`, `expira_em`, `criado_em` nem
   coluna do locatário. A prova precisa afirmar o que ela **não** devolve, e não só o que devolve.
3. **O prazo e a invalidação estão no `WHERE`, e não na aplicação.** Portador vencido ou invalidado
   produz **zero linhas**, indistinguível de derivado inexistente — a RN-14 vira propriedade do banco,
   e não um `if` na borda que alguém pode reordenar.
4. **`pg_catalog.now()`, e não relógio do processo** (ADR-0026). Sendo `timestamptz`, a comparação é
   absoluta e **não precisa de literal de fuso** — o que evita, por construção, criar uma terceira
   declaração executável do fuso da operação e agravar o **D14 (F3/T5)**.

**Prova de que ela resolve, e não só de que ela existe**: o **CT-735**
(`packages/db/test/papel-de-conexao.spec.ts`) chama a função pelo papel `sysloc_app` e **sem
`app.empresa_id` fixado**, afirmando a tripla por igualdade, com os três companheiros negativos
(inexistente, vencido, invalidado) indistinguíveis entre si; e afirma, nas mesmas pernas, que a
leitura DIRETA da tabela sem contexto continua devolvendo vazio — a política não foi afrouxada. O
`CT-727` da T8 mede outra coisa (a **superfície de retorno**) e continua necessário.

### 7.4 Estratégia de Transação e Consistência

- **Uma unidade de trabalho por requisição**, `BEGIN → SET LOCAL app.empresa_id → … → COMMIT`. Nada
  desta fatia toca `packages/db/src/unidade-de-trabalho.ts`, que está sob `DECISÃO FECHADA`.
- **O disparo é atômico com o cadastro**: zerar a confirmação, invalidar os anteriores, emitir o
  portador e (no reenvio) responder acontecem na **mesma** transação. Falha em qualquer passo desfaz
  todos.
- **O enfileiramento fica FORA da transação**, depois do commit. A escolha e a rede estão em §9.2.
- **Isolamento**: `READ COMMITTED` (o padrão), que é o de toda a base. Não há leitura-e-decisão
  vulnerável a corrida aqui: a resolução do portador é uma busca por chave única, e o consumo é um
  `UPDATE … WHERE consumido_em IS NULL AND invalidado_em IS NULL AND expira_em > pg_catalog.now()
  RETURNING`, cuja ausência de retorno é ela própria o resultado.
  > ⚠️ **EMENDA — Gate 2 · T8 · rodada 2 (achado `TR-P1`), aplicada em 2026-08-13 pela RN-15.** Este
  > bullet declarava o `WHERE` com **um** predicado só, e nessa forma a afirmação *"não há corrida
  > aqui"* era **falsa**: os outros dois predicados de validade existiam apenas na função
  > `SECURITY DEFINER`, que `resolverPortador` invoca em transação **separada** e sem contexto. Sob
  > `READ COMMITTED`, o `UPDATE` que bloqueia na trava de linha **reavalia o predicado depois do
  > commit** — de modo que uma invalidação por reenvio comitada na janela entre resolver e consumir
  > **não impedia** o consumo, e um portador emitido para o endereço **antigo** confirmaria o endereço
  > **novo**. Com os três predicados a corrida está fechada: a linha invalidada passa a ser **pulada**.
  > ⚠️ A conjunção **não** alcança a `DECISÃO FECHADA — T3` da `0014`, que governa a **resolução** e
  > proíbe `consumido_em` no `WHERE` **daquela função** — são instruções diferentes, e a reapresentação
  > continua resolvendo e continua devolvendo `undefined` no consumo, mapeado em `200`.
- **Idempotência do consumo**: dupla apresentação simultânea do mesmo segredo produz um vencedor no
  `UPDATE` condicional e um perdedor sem linhas — **e os dois respondem `200`**, porque a RN-10 já
  manda responder sucesso a quem chega depois. A corrida não tem desfecho observável.

### 7.5 Política de Retenção / Archival

**Nenhuma nesta versão, e o registro disso é deliberado.** `portador_de_confirmacao` cresce e nada o
expurga: o consumido e o vencido **ficam**, porque a RN-10 precisa distinguir *"já foi usado"* de
*"nunca existiu"*. Ele passa a ser o **terceiro** registro do produto sem política de retenção, ao
lado de `identidade.tentativa_login` e `negocio.envio_de_cobranca`, e **entra na conta da F7** (item
5 da §F7 do plano de execução). Dimensionamento: uma linha por disparo, ~150 bytes — irrelevante na
escala do produto.

`negocio.contrato` **perde** dado nesta fatia (a coluna do arquivo). É perda deliberada de um resíduo
que a virada apagaria de qualquer forma; nada aponta para ele.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|---|---|---|---|---|
| Servidor SMTP | SMTP sobre `nodemailer` | credencial em `SMTP_URL` (`EnvironmentFile` 0600) | os do `nodemailer` | **pela fila**, com `OPCOES_PADRAO_DA_TAREFA` — 3 tentativas, espera exponencial de 1 s |
| ERPNext / `/opt/frappe` | HTTP autenticado, **somente leitura** | credencial de API do legado | — | — |

- **Nenhum cliente novo entra.** O SMTP é alcançado pelo adaptador que `@sysloc/regua` já publica e
  que o `worker` já compõe — **duplicá-lo é proibido por escrito** no cabeçalho de
  `packages/regua/src/adaptador-smtp.ts`, e é a razão medida da D8.
- **Nenhuma repetição escrita à mão.** A porta não retenta; quem retenta é a fila. Um adaptador que
  tentasse por conta própria multiplicaria as tentativas em silêncio.
- **O legado é tocado só na Fase 1** (CA-01), por leitura autenticada e não destrutiva, dentro do
  site efêmero que `preparar-site-efemero.sh` levanta. **Nada é escrito no sistema antigo.**

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Fila | Produtor | Consumidor | Garantia |
|---|---|---|---|
| `confirmacao-de-email` | `apps/api` (`ProdutorDeFila`) | `apps/worker` (`processarConfirmacaoDeEmail`) | **at-least-once** — Redis com AOF ligado (invariante 8), 3 tentativas com espera exponencial |
| `regua-de-cobranca` | (sem produtor em produção até a F5) | `apps/worker` | inalterada por esta fatia |
| `eco` | — | `apps/worker` | inalterada |

### 9.2 Idempotência

**A entrega é `at-least-once`, e a repetição é inofensiva por construção**: reprocessar a tarefa
reenvia a mesma mensagem com o **mesmo** segredo — o portador já está gravado, e a tarefa não o
recria. O pior desfecho é o locatário receber a mensagem duas vezes; o link continua sendo um só.

**A perda é possível, e é decisão declarada.** O `add` da fila corre depois do `COMMIT`: se o processo
morrer entre os dois, o portador existe e a mensagem não sai. A saída de produto já está declarada —
é a **RN-13**, o reenvio manual. O `outbox` no banco drenado pelo worker é tecnicamente superior e foi
**rejeitado por YAGNI** nesta versão (tech-alignment D8): acrescenta tabela, consumidor e política de
drenagem para uma mensagem cuja perda tem recurso. Se a F4 trouxer efeito externo que **não** possa
se perder, o outbox entra por cima desta decisão sem contradizê-la.

### 9.3 Outbox / Saga

**N/A nesta versão** — ver §9.2. Registrado como o caminho de evolução previsto, não como omissão.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|---|---|---|---|
| Segredo com forma inválida | `CAMPO_INVALIDO` (`422`) | mensagem do esquema, `campo: 'segredo'` | Borda (Zod) |
| **Portador não utilizável** — inválido, vencido **ou** consumido fora da validade | `RECURSO_NAO_ENCONTRADO` (`404`) | `recurso não encontrado` | `ConfirmacaoService` |
| Contrato inexistente ou de outra empresa | `RECURSO_NAO_ENCONTRADO` (`404`) | `recurso não encontrado` | `ContratoService` (na verdade, a RLS) |
| Locatário inexistente no reenvio | `RECURSO_NAO_ENCONTRADO` (`404`) | `recurso não encontrado` | `ConfirmacaoDeEmailService` |
| Sem sessão numa rota que a exige | `NAO_AUTENTICADO` (`401`) | — | `ContextoGuard` |
| Sem a área exigida | `ACESSO_NEGADO` (`403`) | com `detalhes.exigido` | `ContextoGuard` |
| Falha ao renderizar o PDF | `ERRO_INTERNO` (`500`) | `erro interno no processamento da requisição` | `ContratoService`, via filtro global |

> ⚠️ **`REQUISICAO_RECUSADA` NÃO é usado aqui, e a proibição é literal.** O `DECISÃO FECHADA` de
> `apps/api/src/comum/filtro-excecao.ts` declara: *"`REQUISICAO_RECUSADA` é código de FECHO deste
> filtro, não código de negócio levantável"*. `RECURSO_NAO_ENCONTRADO` é a escolha certa por outra
> razão, e não só por eliminação: ele é **honesto** (não existe portador utilizável com este segredo)
> e **indistinguível por construção** — os três casos que a RN-14 manda não separar produzem
> literalmente o mesmo corpo, sem que ninguém precise se lembrar de mantê-los iguais.

**Nenhum código novo entra no enum fechado de `@sysloc/shared`.** A superfície de erro do produto não
cresce nesta fatia.

### 10.2 Resiliência

- **Fila**: 3 tentativas, espera exponencial a partir de 1 s, retenção de 1.000 concluídas e 5.000
  falhas — a política única de `@sysloc/shared`, aplicada por quem enfileira.
- **SMTP indisponível**: a tarefa rejeita, a fila repete; esgotadas as tentativas, a tarefa é dada por
  falha e fica retida para diagnóstico. O cadastro **não** é afetado — ele já commitou.
- **Redis indisponível no momento do disparo**: o cadastro **já commitou**; o `add` falha e é
  registrado em nível `warn` com o `locatarioId`. A rede é a RN-13. ⚠️ **A falha do enfileiramento
  nunca derruba a resposta do cadastro** — seria trocar uma mensagem perdida por um cadastro perdido.
- **Renderização de PDF**: sem timeout externo, porque não há processo externo. A composição é
  síncrona e limitada pelo tamanho do contrato.
- **Sem `circuit breaker`, sem `bulkhead`** — não há dependência externa no caminho síncrono de
  nenhuma das três rotas.

### 10.3 Estratégia de Logging de Erros

- Pino estruturado, pelo despacho **único** de redação que a F1 instalou. O `logger.error` fica para
  falha de serviço; recusa de portador é `info`, e **não** `warn` — link vencido é operação normal.
- **O segredo em claro NUNCA entra em registro**, nem no da API, nem no da fila, nem no do worker. Ver
  §11.3 e §13.1.
- A causa da rejeição do SMTP entra no registro do worker, como já acontece com o aviso de cobrança.

---

## 11. Segurança

### 11.1 Autenticação

- **Duas das três rotas** exigem sessão `better-auth`, resolvida pela `ContextoGuard` global. Sem
  sessão → `401 NAO_AUTENTICADO`.
- **`POST /v1/confirmacoes-de-email` dispensa sessão**, e é a **única rota de negócio** do produto
  nessa condição. A dispensa é marcada por `@RotaPublica()` **no controlador** — a única forma que o
  mecanismo admite. O default continua sendo o oposto: rota nova nasce protegida por omissão, e o
  esquecimento produz `401`, nunca superfície aberta.
- **A dispensa é legítima pelo critério da ADR-0027, item a item**: o ato é exercido pelo **titular do
  dado que ele afeta** (o locatário), que **não é usuário do sistema e não terá sessão algum dia**; em
  troca a rota exige um portador de segredo aleatório **com entropia declarada** (256 bits), guardado
  como **hash**, com **expiração** (72 h) e de **uso único**, que resolve **um ato sobre um objeto**;
  o contexto de tenant vem do registro que o portador resolve; e a rota é declarada `publicas`, de
  modo que `semDeclaracao` permanece **vazio**.

### 11.2 Autorização

- **Dimensão de chave, nunca de perfil** — é o que permite ao Admin conceder e retirar por ajuste
  individual (ADR-0010).
- `GET /v1/contratos/:codigo/documento` → `TELA:contratos`, herdada da classe.
- `POST /v1/locatarios/:id/confirmacao-de-email` → `TELA:cadastros`, herdada da classe.
  ⚠️ **Não declare `@ExigeChave` no método.** `getAllAndOverride` é **override**, não união; e nesta
  superfície o erro seria **invisível por comportamento**, porque `TELA:cadastros` é exatamente
  `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`. O `CT-355` é a rede estrutural que acusa.
- **O catálogo 10×7 permanece fechado.** Nenhuma chave nasce nesta fatia (RN-13).
- **O isolamento não depende de nada disso**: mesmo com a área concedida, o contrato de outra empresa
  não retorna linha, porque quem decide é a RLS.

### 11.3 Criptografia

| Item | Decisão |
|---|---|
| Geração do segredo | `node:crypto.randomBytes(32)` — 256 bits de fonte criptográfica. **Nunca `Math.random`** |
| Transporte | base64url, 43 caracteres, sem enchimento — seguro para URL e para corpo JSON |
| Armazenamento | **SHA-256 em hexadecimal**, com `UNIQUE`. O claro não é guardado em lugar nenhum |
| Por que **não** scrypt/argon2 | Derivação cara existe para segredo de **baixa entropia escolhido por gente**. Com 256 bits, reverter o derivado é irrelevante, e o custo por verificação seria pago em toda apresentação. A API já paga scrypt no caminho de senha, onde ele é devido |
| Por que **não** HMAC com chave de servidor | Daria defesa extra contra dump de banco isolado, ao custo de mais um segredo a provisionar, custodiar e rotacionar, e de um modo de falha novo (chave perdida invalida todo portador vivo). Fica registrado como o caminho de endurecimento futuro |
| Comparação | **Não existe comparação de segredo com segredo.** Onde sobrar comparação em memória, `timingSafeEqual` |

**A janela em que o segredo em claro existe** é: gerado na borda → gravado só o derivado → posto na
carga da fila → lido pelo worker → montado no link → entregue. Ela é irredutível — sem o claro não há
link. O que a fecha é: (a) o claro **nunca** é gravado no banco; (b) ele é **redigido** do registro
estruturado; (c) ele vive em Redis apenas pelo tempo da tarefa, e a retenção de tarefas concluídas
(1.000) é a única exposição residual — declarada aqui, e coberta pelo fato de o Redis ser local, sem
porta pública, e o segredo morrer em 72 h.

### 11.4 Sanitização e Validação

- **SQL injection**: postgres.js com parâmetros vinculados em toda consulta. A função
  `SECURITY DEFINER` recebe `p_derivado` como parâmetro, nunca por concatenação, e tem
  `SET search_path = pg_catalog, pg_temp` — obrigatório em função com direitos elevados.
- **Injeção no documento**: a composição produz **texto**, não HTML. O legado precisava de
  `frappe.utils.escape_html` porque montava HTML por concatenação; aqui não há marcação a escapar, e
  a ausência dessa necessidade é consequência da escolha de motor (D1), não descuido.
- **Enumeração de portador**: impossível por força bruta — 256 bits. E sem limitador de taxa, a
  mitigação declarada é **uso único mais prazo**, que não depende do que falta (§11.5).
- **SSRF**: `URL_BASE_DA_CONFIRMACAO` é variável de ambiente do processo, nunca campo de requisição.
  Nenhum dado de usuário compõe URL alcançada pelo servidor.

### 11.5 Rate Limiting / Anti-abuse

**Ausente nesta versão, por dependência declarada — não por omissão.** O limitador exige origem
confiável do pedido, que só existe depois da publicação atrás do servidor de borda (**F7**); é o
mesmo fato que os débitos **D23**, **D24** e **D27** já registram. A mitigação desta entrega é **uso
único mais prazo de 72 horas**, que não depende do que falta.

⚠️ **Isto NÃO cria um débito com gatilho novo.** O gatilho — a publicação atrás do servidor de borda —
já está indexado três vezes, e um quarto marcador para o mesmo fato seria ruído que desarma os que
importam.

### 11.6 Secrets Management

Nada muda: `EnvironmentFile` 0600 fora do repositório, `.gitignore` barrando `.env`, `*.pfx` e
`secrets/`. A variável nova (`URL_BASE_DA_CONFIRMACAO`) **não é segredo** — é o endereço público do
app —, mas é **exigida na partida** dos dois processos, com a mensagem nomeando a variável e nunca o
valor.

---

## 12. Performance

### 12.1 Metas

Herdadas do produto; **nenhuma meta nova é declarada**, e a ausência é honesta — não há instrumentação
de latência neste backend (§13.2).

- Latência p95 — sem instrumentação; não medida.
- Latência p99 — idem.
- Throughput — a operação é de uma imobiliária: dezenas de pedidos por dia, não por segundo.

O que **é** dimensionado, porque foi medido: o documento tem ~174 linhas de texto e 21 cláusulas
fixas; a composição é uma concatenação de blocos, e a renderização é o custo real.

### 12.2 Estratégias

- **Uma consulta por documento.** `lerAgregadoDoContrato` traz contrato, locador, locatário, imóvel e
  fiadores de uma vez — nunca N+1 sobre os fiadores.
- **Índice único sobre `derivado`**, que é o eixo da única consulta quente da rota pública.
- **Sem cache e sem reaproveitamento de documento.** É a decisão central da feature: guardar cópia
  reintroduziria o problema que a RN-01 fecha. O PRD já registra que o reaproveitamento **entra
  depois, sem alterar o que o produto promete**, se a carga mostrar necessidade.
- **Sem paginação nova** — nenhuma das três rotas lista.

### 12.3 Limites Conhecidos

| Limite | Natureza |
|---|---|
| A composição corre no processo que atende a requisição | Contrato com muitos fiadores gasta mais CPU. Sem medição de carga real, é limite **declarado**, não medido |
| `@react-pdf/renderer` arrasta `react` e o reconciliador | Custo de partida do processo, uma vez |
| `portador_de_confirmacao` cresce sem expurgo | Ver §7.5 — entra na conta da F7 |
| Redis retém 1.000 tarefas concluídas com o segredo na carga | Ver §11.3 — exposição residual declarada |

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|---|---|---|---|
| Documento composto e entregue | `info` | `codigoDoContrato`, `empresaId`, `bytes` | — |
| Confirmação disparada (automático ou manual) | `info` | `locatarioId`, `empresaId`, `origem: 'cadastro' \| 'reenvio'`, `portadorId` | ⚠️ **nunca `segredo`, nunca `derivado`, nunca `email`** |
| Falha ao enfileirar | `warn` | `locatarioId`, `empresaId`, causa | idem |
| Confirmação entregue (worker) | `info` | `idTarefa`, `fila`, `locatarioId`, `empresaId` | idem |
| Falha de entrega (worker) | `warn` | `idTarefa`, causa da rejeição do SMTP | a causa pode citar o endereço — é o comportamento já existente do aviso |
| Portador recusado | `info` | `motivo: 'nao-resolvido'` — **um único motivo, sempre** | ⚠️ **o registro não pode distinguir os três casos** que a resposta não distingue |

> **O registro obedece à RN-14 tanto quanto a resposta.** Registrar `motivo: 'vencido'` × `'invalido'`
> abriria pela lateral exatamente a informação que a resposta fecha — para quem tem o journal, que é o
> operador da plataforma. O campo é constante de propósito.

Pino, formato JSON, redação de credencial pelo **despacho único** que a F1 instalou depois de o
vazamento sobreviver a quatro correções. O `segredo` entra na lista de chaves redigidas.

### 13.2 Métricas

**N/A — este backend não tem coletor de métricas.** A stack declara OpenTelemetry como destino, e ele
**não está instalado**. Declarar métricas aqui seria escrever contrato que ninguém cumpre. O que
existe de observável é o registro estruturado (§13.1) e o `journal` do systemd.

### 13.3 Tracing

**N/A — pela mesma razão de §13.2.** O `idTarefa` da fila é o único correlacionador entre o disparo e
a entrega, e ele já é registrado nas duas pontas.

### 13.4 Alertas

**N/A — não há gerenciador de alertas neste servidor.** A rede operacional é o `journal` e o
`Restart=always` das unidades systemd. A tela de saúde da automação é **F5**, declarada fora de
escopo pelo PRD.

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma — e não é omissão.** Este produto não tem mecanismo de bandeira de funcionalidade, e
introduzir um aqui seria decisão transversal grande para uma fatia que não precisa dela: as três
rotas nascem ligadas, e a remoção da coluna é migração, não bandeira.

O que existe de aparentado é a **configuração por empresa** (política de aviso, configuração de mora),
que é dado de negócio e não bandeira de entrega.

### 14.2 Flags Envolvidas

N/A.

---

## 15. Versionamento de API

### 15.1 Estratégia

**Prefixo de caminho** — `PREFIXO_DE_VERSAO = 'v1'`, aplicado globalmente na partida. Inalterado por
esta fatia; as três rotas novas nascem sob `/v1`.

### 15.2 Compatibilidade

⚠️ **Esta fatia introduz uma mudança incompatível deliberada, e é a única do produto até aqui.**

| O quê | Onde | Efeito |
|---|---|---|
| `pdfContratoArquivo` sai de `esquemaDoContrato` | resposta de 6 rotas de contrato | Cliente que lia o campo passa a não encontrá-lo |
| `pdfContratoArquivo` sai de `esquemaDeContratoNovo` | corpo de `POST /v1/contratos` e `PUT /v1/contratos/:codigo` | Cliente que **enviava** o campo passa a receber `422` — o esquema é `strictObject` |

A quebra é **aceitável e o PRD a autoriza (CA-07)** por um fato verificável: `@sysloc/contracts`
**ainda não foi publicado** — a publicação é item do marco de entrega —, e o frontend React ainda não
consome nenhuma dessas rotas. Não há consumidor a quebrar. **Não** se abre janela de descontinuação
nem se mantém o campo como opcional: manter o resíduo é exatamente o que a US-05 existe para impedir.

`esquemaDaPessoa` **não muda** — locador e fiador seguem idênticos. A adição de `emailConfirmadoEm` é
**crescimento de esquema** num símbolo novo (`esquemaDoLocatario`), nunca troca.

### 15.3 Schemas / Contratos

Fonte única em `@sysloc/contracts` (ADR-0016); o documento OpenAPI **deriva** por
`esquemaPublicado(esquema, lado)` — nenhuma descrição escrita à mão. A rota de bytes é a **primeira**
que declara `content` em vez de `schema` derivado, e a razão está em §4.1: bytes são opacos por
natureza, e a ADR-0028 fixa que ela declara mídia, nome de arquivo e o mesmo envelope de erro.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD neste projeto — a máquina é o servidor. Os portões são locais e obrigatórios, **por
pacote**:

```bash
rm -rf /tmp/sysloc-banco-*                 # o disco está em ~93%; resíduo se disfarça de teste vermelho
pnpm install && pnpm build
pnpm lint                                   # Biome + shellcheck
pnpm --filter @sysloc/<pacote> test         # por pacote — `turbo run test` aborta os irmãos
```

⚠️ **Meça a suíte por pacote.** O `turbo run test` **aborta os pacotes irmãos** quando um falha, e a
saída agregada não carrega contagem confiável dos interrompidos — o que arruinaria a baseline que o
Protocolo Antirregressão exige.

### 16.2 Empacotamento

**Nativo, sem Docker.** Node 24 fixado por `mise`, `pnpm` + Turborepo, `tsup`/`tsc --build` por
pacote. O pacote novo declara `exports` apontando para `dist/`, como os cinco existentes.

O que muda no manifesto:

| Processo | Dependência nova |
|---|---|
| `packages/documentos` | `@react-pdf/renderer` 4.6.0, `react` (par de `@react-pdf/renderer`) |
| `packages/documentos` (dev) | `pdfjs-dist` 6.2.108 — **só verificação** |
| `apps/api` | `bullmq` 5.81.3 (a mesma versão do `worker`), `@sysloc/documentos` |
| `apps/worker` | `@sysloc/documentos` |

### 16.3 Infraestrutura como Código

Sem Terraform/Helm — o provisionamento é shell idempotente em `deploy/scripts/instalacao/`
(**ADR-0005**). O que esta fatia acrescenta:

- `URL_BASE_DA_CONFIRMACAO` no `EnvironmentFile` dos dois serviços;
- as migrações `0013` e `0014` aplicadas por `migrar-banco.sh`, na ordem, com registro de `sha256sum`.

Nenhum papel de banco novo, nenhum schema novo, nenhuma unidade systemd nova.

### 16.4 Estratégia de Rollout

**Substituição direta**, com janela: `systemctl restart sysloc-api sysloc-worker` depois da migração.
Não há blue-green nem canário — é uma instância. A janela é de segundos e **não derruba o
`/opt/frappe`**, que atende a operação e permanece de pé.

**Ordem obrigatória**: migrar → construir → reiniciar. Inverter faria a API subir contra um esquema
que ainda tem a coluna que o código já não conhece.

### 16.5 Escalabilidade

Vertical, uma instância de cada processo. A composição do documento é CPU no processo da API; se a
carga mostrar necessidade, o caminho previsto é o reaproveitamento (declarado adiado no PRD), não
escala horizontal.

### 16.6 Rollback

- **Código**: `git revert` do commit da fatia + `pnpm build` + reinício.
- **Banco**: ⚠️ **a migração `0013` é destrutiva** (`DROP COLUMN`) e **não tem descida**. Reverter o
  esquema exige **restauração de backup** — que é o item 1 da F7 e **ainda não está entregue**.
- **Consequência operacional, e ela é conteúdo**: aplicar a `0013` a banco durável é ato sem volta
  enquanto a F7 não fechar. O dado perdido é a coluna resíduo do legado, que a virada apagaria de
  qualquer forma — mas a assimetria precisa estar escrita, e não descoberta.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| US-01 | Captura no site efêmero dos 3 caminhos sem oráculo; ausência **medida** vira registro | `capturar.py` [M], `verificar-golden.sh` [M], `PROCEDENCIA.md` [M], 3 goldens novos [N] |
| US-02 | Composição pura + porta de renderização + rota de bytes | `packages/documentos/src/contrato/*` [N], `porta-de-renderizacao.ts` [N], `renderizador-pdf.ts` [N], `documento-de-contrato.ts` [N], `contrato.controller.ts` [M] |
| US-03 | `cancelado` como **parâmetro** da composição, nunca mesclagem sobre bytes | `composicao.ts` [N], `clausulas.ts` [N] |
| US-04 | Remoção do marcador `DÉBITO COM GATILHO — D36`; o cancelamento deixa de ter pré-condição de documento | `contrato.service.ts` [M] |
| US-05 | `DROP COLUMN` + remoção nas 3 superfícies (banco, dados, contrato) | `0013` [N], `esquema/negocio.ts` [M], `db/src/contrato.ts` [M], `contracts/src/contrato.ts` [M] |
| US-06 | `@ExigeChave('TELA:contratos')` herdada + RLS de `negocio.contrato` | `contrato.controller.ts` [M], `ContextoGuard` [R] |
| US-07 | Portador de 256 bits, SHA-256 indexado, função `SECURITY DEFINER`, rota `@RotaPublica()` | `portador-de-confirmacao.ts` [N], `0014` [N], `confirmacao.controller.ts` [N], `confirmacao.service.ts` [N] |
| US-08 | Disparo dentro da unidade de trabalho do cadastro | `superficie-de-cadastro.ts` [M], `confirmacao-de-email.service.ts` [N] |
| US-09 | Rota de reenvio no controlador do locatário, mesmo serviço do automático | `locatario.controller.ts` [M], `confirmacao-de-email.service.ts` [N] |
| US-10 | `esquemaDoLocatario` + coluna `email_confirmado_em` + projeção condicional | `contracts/src/pessoa.ts` [M], `esquema/negocio.ts` [M], `cadastro-de-pessoa.ts` [M] |
| US-11 | Dupla medição independente da superfície + suíte monotônica por pacote | `cobertura-de-autorizacao.e2e.spec.ts` [M] |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|---|---|---|---|
| Renderização de PDF | `@react-pdf/renderer` | `4.6.0` | **D1.** JS puro; resolve justificação, quebra de linha e paginação por conta própria. Sem processo externo, sem binário de SO, sem os ~300 MB de Chromium que a máquina nativa da F0 não deve carregar |
| Par de renderização | `react` | par de `@react-pdf/renderer` | Motor de renderização **server-side**, sem DOM. ⚠️ Ver o aviso de Fronteira em §3.3 |
| Extração de texto (**verificação**) | `pdfjs-dist` | `6.2.108` | A segunda ponta do D3: prova que a renderização não perde, reordena nem trunca. **JS puro** — `unpdf` e `pdf-parse` foram descartados por serem invólucros sobre este mesmo motor |
| Mensageria (**na API**) | `bullmq` | `5.81.3` | **D8 / ADR-0029.** A mesma versão que o `worker` já usa — versões distintas do cliente sobre a mesma fila é divergência que nada acusa |
| Framework | NestJS + Fastify | `11.1.28` / `5.10.0` | já existente |
| ORM | Drizzle + postgres.js | `0.45.2` / `3.4.9` | já existente |
| Validação | Zod | `4.4.3` | já existente |
| SMTP | `nodemailer` | `7.0.13` | já existente, via `@sysloc/regua` — **não se duplica** |
| Fila (cliente) | `ioredis` | `5.11.1` | já existente nos dois processos |
| Observabilidade | Pino | já existente | § 13.1 |

**Rejeitadas, com a razão** (tech-alignment D1):

- **`pdfkit` / `pdf-lib` imperativo** — dependência menor e sem React, mas quebra de linha,
  justificação e paginação viram **código nosso**, na exata dimensão que o golden mede. Aumenta a
  superfície de defeito onde a prova é mais cara. `pdf-lib` permanece candidato natural para a **F4**
  (manipular boleto já emitido), que é outro problema.
- **HTML → PDF com navegador headless** — fidelidade máxima ao legado, que é literalmente HTML+CSS.
  Rejeitada pelo custo operacional numa máquina que a F0 fixou como nativa e reinicializável.

---

## 19. Estratégia de Testes

> **Resumo**: **33 casos** | Unitários: 8 · Integração: 9 · E2E: 8 · Segurança: 8
> **Padrão**: Vitest + `embedded-postgres` (instância efêmera própria) · E2E por HTTP real em porta
> dinâmica · **mock evitado por decisão** — repositório, rota e processador de fila atravessam
> fronteira real · nomenclatura `*.spec.ts` / `*.e2e.spec.ts` em `test/` espelhando `src/` ·
> rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de **INVARIANTES** por arquivo.
> **Sem medição de cobertura** — o julgamento é por rastreabilidade e **qualidade de asserção**.
>
> ⚠️ **A numeração pula o `CT-716`** (o lote vai de `CT-701` a `CT-715` e de `CT-717` a `CT-734`). O
> vão é intencional e **preservado**: renumerar dessincronizaria estas tabelas do
> `_run/test-cases.json`, que é a fonte lossless consumida pelo `task_plan`.
>
> **Três provas de falsificação são obrigatórias nesta fatia** — `CT-707` (a normalização do D3),
> `CT-712` (a ausência da coluna) e `CT-729` (o segredo nunca gravado em claro). Sem elas, as três
> asserções mais importantes da feature são estáticas e não podem falhar.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | Captura dos caminhos sem oráculo, ou ausência **medida** | CT-701 |
| CA-02 | Documento reflete o cadastro no instante do pedido | CT-702, CT-703, CT-714 |
| CA-03 | Igualdade sob normalização declarada, divergências escritas antes | CT-704, CT-705, CT-707, CT-708, CT-709 |
| CA-04 | Cancelado sai marcado; em vigor sai sem marca | CT-706 |
| CA-05 | Cancelar sem documento — divergência por vitória (fecha D36) | CT-710 |
| CA-06 | Contrato sem imóvel é **irrepresentável** | CT-711 |
| CA-07 | Nenhuma referência a arquivo, nem no que se guarda nem no que se publica | CT-712, CT-713, CT-714 |
| CA-08 | Nenhum dos três acessos ilegítimos recebe o documento | CT-715 |
| CA-09 | Cadastrar/corrigir e-mail zera a confirmação e dispara sozinho | CT-717, CT-718, CT-734 |
| CA-10 | Reenvio manual pela área Cadastros; link anterior deixa de valer | CT-719, CT-720, CT-722 |
| CA-11 | Link válido, sem sessão, dentro de 72 h, confirma | CT-721 |
| CA-12 | Reapresentação dentro da validade responde sucesso e **não altera nada** | CT-724 |
| CA-13 | Link vencido é recusado, **indistinguível** de inexistente | CT-723, CT-728 |
| CA-14 | O que está guardado não confirma, e não permite derivar segredo válido | CT-725, CT-729 |
| CA-15 | Isolamento sem que o pedido informe empresa | CT-726, CT-727 |
| CA-16 | Os dois locatários são avisados **exatamente como antes** | CT-730, CT-731 |
| CA-17 | Superfície por dupla medição: 89/74, `semDeclaracao` vazio | CT-732 |
| CA-18 | Suíte monotônica por pacote; nada alcança destinatário real nem escreve no legado | CT-733 |

**Os 18 CAs estão cobertos, e nenhum CT referencia CA inexistente** — validação nos dois sentidos.

---

### 19.1 Testes Unitários

#### Domínio: composição do documento (`packages/documentos/test/composicao.spec.ts`)

Mock: **nenhum** — a composição é função pura e não tem colaborador a dublar.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-702 | compõe do dado corrente, sem estado entre chamadas | CA-02 | A composição é função pura: o mesmo agregado dá a mesma representação, e um agregado alterado reflete a alteração — sem cache, sem estado retido | `agregadoV1.valorMensal = 2500,00` → `agregadoV2.valorMensal = 2800,00`, na mesma instância | 2ª composição contém `R$ 2.800,00` e **não** contém `R$ 2.500,00`; a 1ª permanece inalterada (sem mutação retroativa) | — | — |
| CT-703 | qualificação não vaza estado de uma composição para a seguinte | CA-02 | Compor sem fiador logo após compor com fiador produz documento sem traço algum do fiador anterior | `{fiadores:[{nome:'Carlos Fiador'}]}` → `{fiadores:[]}` | `indexOf('Carlos Fiador') === -1` na 2ª composição, em **todos** os blocos | — | — |
| CT-706 | a marca de cancelamento é parâmetro, não pós-processo | CA-04 | A marca aparece **se e somente se** o status é `CANCELADO`; nos outros três estados está ausente | os 4 estados: `RASCUNHO`, `ATIVO`, `CANCELADO`, `ENCERRADO` | só `CANCELADO` contém a marca; os outros três não contêm traço algum dela | — | — |

#### Domínio: qualificação das partes (`packages/documentos/test/qualificacao.spec.ts`)

Mock: **nenhum**.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-704 | os três eixos condicionais resolvem uma vez só | CA-03 | Os eixos medidos no legado (PF × PJ, com × sem RG) produzem o bloco correto, **sem reabrir a condição** nas 21 cláusulas que o consomem | PF com `rg:'MG-1234567'` · PF com `rg:null` · PJ | (1) contém literalmente `cédula de identidade civil número MG-1234567`; (2) **não** contém `cédula de identidade civil` em lugar nenhum; (3) qualifica por CNPJ, nunca pelo molde de RG | — | — |
| CT-705 | tipo de pessoa fora da união fechada é recusado | CA-03 | A composição nunca produz documento parcial silencioso: ela recusa | `tipoPessoa: 'ESTRANGEIRO'` | lança nomeando o valor ou o campo — **nunca** `undefined` encaixado no texto | — | — |

#### Domínio: normalização e extenso (`packages/documentos/test/normalizacao.spec.ts`, `extenso.spec.ts`)

Mock: **nenhum**.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-707 | ⚠️ a normalização é fechada, e a **prova de falsificação é obrigatória** | CA-03 | Ela tolera exatamente o declarado (§21.2: NFKC, colapso de espaço, `trim`) e **nada além** — uma regra mais frouxa deixaria de detectar divergência de conteúdo real | tolerado: `identiﬁcado como\nImovel PDF-001` × `identificado como Imovel PDF-001` · **não** tolerado: `R$ 2.500,00` × `R$ 2.550,00` | tolerado → igualdade estrita; não tolerado → **desigualdade**. A cópia com a regra afrouxada faz o par de conteúdo diferente passar como igual, e é isso que prova a asserção | — | os 5 mutantes de §21.2 (m1..m5), cada um deixando o caso vermelho, mais o controle pela outra ponta |
| CT-709 | igualdade normalizada com o golden, no cenário que ele cobre | CA-03 | Para os dados do contrato de referência, o texto normalizado do produto é igual ao golden normalizado — **exceto** pelas divergências declaradas **antes**, e nenhuma outra | golden lido do disco + agregado equivalente (Maria Locadora / Joao Locatario, R$ 2.500,00, 12 meses) | comparação **bloco a bloco**; toda divergência remanescente casa **exatamente** um veredito de §21.1 — divergência sem veredito **reprova nomeando o bloco** | — | ⚠️ o lado do oráculo é **lido do arquivo**, nunca redigitado no teste (molde do `CT-636`) |

#### Contrato publicado (`packages/contracts/test/esquemas.spec.ts`)

Mock: **nenhum**.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-713 | `pdfContratoArquivo` sai da entrada e da saída | CA-07 | `esquemaDeContratoNovo` **recusa** o corpo que traga a chave (é `strictObject`), e `esquemaDoContrato` não a declara | corpo válido + `pdfContratoArquivo: '/frappe/private/files/contrato.pdf'` | `safeParse.success === false`, com issue `unrecognized_keys` nomeando `pdfContratoArquivo` | — | — |
| CT-731 | `esquemaDoLocatario` cresce; `esquemaDaPessoa` fica **intacto** | CA-16 | O campo é publicado **só** pelas 6 rotas de locatário; locador e fiador continuam sem ele | objeto de pessoa + `emailConfirmadoEm: '2026-08-12T10:00:00.000Z'` | `Object.keys` do resultado de `esquemaDoLocatario.parse` **contém** o campo; o de `esquemaDaPessoa.parse` **não** contém — os dois por **igualdade de conjunto**, nunca "inclui pelo menos" | — | — |

#### Cobertura da superfície (`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-732 | dupla medição independente — 89/74 | CA-17 | As duas medições (roteador e composição) chegam ao mesmo total, **com a igualdade entre os eixos afirmada explicitamente**, e `semDeclaracao` fica vazio | aplicação Nest inicializada (`init()`, sem `listen()`) | **89 pares / 74 manipuladores** nos dois eixos; `semDeclaracao === []`; documento exige `TELA:contratos`, reenvio exige `TELA:cadastros`, confirmação está em `publicas`. Mutante: rota sem declaração faz `semDeclaracao` **nomear** `{metodo, caminho, controlador}` — nunca só o comprimento | — | molde literal do `CT-635` |

### 19.2 Testes de Integração

#### Renderização real (`packages/documentos/test/renderizador-pdf.spec.ts`)

Setup: `@react-pdf/renderer` real; extração por `pdfjs-dist`; escrita em `tmpdir` real, removido ao fim.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-708 | ⚠️ o PDF é renderizado **de fato** e o texto extraído de volta | CA-03 | A segunda ponta do D3: a renderização não perde, não reordena e não trunca conteúdo. Sem ela, o artefato **entregue** ao operador ficaria sem oráculo nenhum | compor → renderizar → gravar em `tmpdir` → ler bytes → extrair texto | os **21** cabeçalhos de cláusula aparecem **exatamente uma vez cada**, em ordem crescente — contagem exata `21`, nunca "pelo menos" | mutante: composer que omite a `CLÁUSULA DÉCIMA QUARTA` faz o caso reprovar |

#### Banco — o esquema e a função de resolução (`packages/db/test/contrato.spec.ts`, `portador-de-confirmacao.spec.ts`)

Setup: instância efêmera própria por `packages/db/test/banco-efemero.ts`, migrada até a `0014`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-711 | contrato sem imóvel é **irrepresentável** | CA-06 | A impossibilidade é do **banco**, não de validação de aplicação — por isso não há recusa equivalente a portar | `INSERT` direto com `imovel_id = NULL`, sob contexto de empresa válida | rejeita com **SQLSTATE 23502** nomeando `imovel_id`; a linha nunca entra | — |
| CT-712 | ⚠️ a coluna sumiu do **catálogo**, e a prova é falsificável | CA-07 | A ausência é **medida por introspecção**, nunca presumida do texto da migração | `SELECT column_name FROM information_schema.columns WHERE table_schema='negocio' AND table_name='contrato'` | pós-`0013`: `.not.toContain('pdf_contrato_arquivo')`. **Controle**: contra instância migrada só até a `0012`, a **mesma** asserção reprova | molde do `CT-430` (ausência de `retirado_em` em `contrato_fiador`) |
| CT-727 | a `SECURITY DEFINER` não aceita empresa e devolve o mínimo | CA-15 | A assinatura sem parâmetro de empresa torna o pedido cruzado **irrepresentável pela própria função**; e a prova afirma o que ela **não** devolve | introspecção de `information_schema.parameters` + chamada com derivado real | parâmetros **exatamente** `['p_derivado']`; conjunto de colunas **exatamente** `(empresa_id, locatario_id, consumido_em)` — igualdade de conjunto, nunca "inclui pelo menos" | molde do `CT-406` (funções de série de contrato) |
| CT-728 | derivado inexistente devolve vazio, sem revelar a causa | CA-13 | A indistinguibilidade da RN-14 **nasce na fonte**, e não de a borda tratar dois erros diferentes de forma igual | 3 chamadas: derivado nunca gravado · portador vencido · portador invalidado por reenvio | as três devolvem o **mesmo** conjunto vazio, sem exceção — nenhuma distinguível da outra | — |
| CT-729 | ⚠️ 256 bits de fonte criptográfica; o claro **nunca** é gravado | CA-14 | O gerador usa `node:crypto`; a coluna guarda `sha256(segredo)` em hexadecimal, nunca o segredo | gerar 2 segredos · gravar 1 portador · ler a coluna do disco | `randomBytes(32)` dá 32 bytes; os 2 diferem; o valor gravado é `createHash('sha256').update(segredo).digest('hex')` e **nunca** o segredo | **prova de falsificação**: varredura no módulo de gravação por referência ao segredo bruto fora do cálculo do hash; um mutante que o acrescente ao `INSERT` faz reprovar nomeando o arquivo |

#### Não-regressão da sub-fatia irmã (`packages/db/test/execucao-da-regua.spec.ts`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-730 | o estado de confirmação **não** entra na elegibilidade | CA-16 | `selecionarCandidatasAoAviso` ignora `email_confirmado_em` — os dois locatários são selecionados exatamente como a sub-fatia irmã provou | política ativa e dentro da janela; 2 locatários com cobrança elegível, um confirmado e outro não | o conjunto de candidatas contém **as duas** cobranças, por **igualdade de conjunto** (por código), nunca "pelo menos uma" | ⚠️ este caso é o que provavelmente **fecha o D13 (F3/T5)** — o gatilho dele é literalmente *"a primeira suíte que precisar da política como precondição sem ser objeto"* |

#### Processador da fila (`apps/worker/test/confirmacao-de-email.spec.ts`)

Setup: fila e banco efêmeros reais; capturador de e-mail no lugar do adaptador SMTP.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-734 | a carga é conferida **antes** de abrir contexto de tenant | CA-09 | Mesma disciplina de `empresaDaCarga` em `tarefas/regua.ts`: a recusa nomeia o **campo**, nunca o **valor** — o valor pode ser dado de outra empresa | carga válida (do fluxo real) × carga incompleta | válida: processa e a mensagem chega ao capturador. Incompleta: lança **antes** de qualquer `emUnidadeDeTrabalho`, nomeando os campos faltantes; nenhuma consulta ao banco é disparada | espelha `apps/worker/src/tarefas/regua.ts`; ⚠️ os nomes dos campos são os de §4.3 |

#### Verificação da verificação (`deploy/scripts/documentos/verificar-isolamento-de-verificacao.sh` — **novo**)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-733 | nada alcança destinatário real; nada escreve no legado; suíte monotônica | CA-18 | Materializa a RN-16 de forma executável, e a monotonia **por pacote** a partir de **1004** | suíte por pacote + 2 varreduras estáticas sobre os arquivos de teste novos | contagem por pacote nunca menor que a baseline; `grep` por `createTransport`/`nodemailer` encontra **só** o capturador; `grep` por `docker compose exec` não encontra nada | **prova de falsificação**: uma cópia com `createTransport({host:'smtp.real.com'})` faz a varredura reprovar nomeando `arquivo:linha` |

### 19.3 Testes End-to-End (E2E)

#### Fluxo: captura no legado dos caminhos sem oráculo (CT-701) — **TASK DE PRAZO**

- **Framework**: shell, convenção própria de `deploy/scripts/caracterizacao/` (`caso` / `ok` / `afirmar_igual` / `aviso` / `fechar_caso`)
- **CA**: CA-01 · **RN**: RN-16
- **Objetivo**: para cada um dos três eixos sem golden, **ou** existe contrato real que o exercite e ele é capturado, **ou** a ausência é registrada como **ausência medida** — nunca inferida — e nada é escrito no `/opt/frappe`.
- **Pré-condições**: `/opt/frappe` de pé; disco com folga (já esteve em ~93-94% — rode `rm -rf /tmp/sysloc-banco-*` antes).
  ⚠️ **Caminho legítimo**: reutilizar `consultar_o_legado` de `extrair-fonte-do-pdf.sh` / `capturar.py` **como está**. **Não escreva uma quarta cópia do caminho de leitura autenticada** — o `D3 (F3/T1)` dispara no quarto consumidor. Consulta nova entra como **parâmetro** do script existente.
  ⚠️ **`sudo` NÃO é exigido** por esta frente — ver §21.8, item 2.
- **Passos**:
  1. Para cada eixo (`contrato_com_fiador`, `locatario_pessoa_juridica`, `parte_sem_documento_identidade`), consultar contratos reais que o exercitem — leitura autenticada e **não destrutiva**.
  2. Encontrado → capturar pelo mesmo caminho da T1 e versionar o golden novo.
  3. Não encontrado → registrar a **ausência medida** em `PROCEDENCIA.md`, nomeando a consulta que não retornou nada.
  4. Em nenhum dos dois ramos escrever, alterar ou fabricar contrato no legado.
- **Validações**: cada eixo termina com **exatamente um** de dois desfechos registrados por extenso — nunca um terceiro estado implícito. Eixo ausente emite `aviso` e o script **termina com código 0**; ausência **não** é `falhar`. O legado termina sem nenhuma escrita nova.
- **Esta task vai PRIMEIRO.** É a única cuja janela fecha e não reabre.

#### Fluxo: o documento reflete o cadastro no instante do pedido (CT-714)

- **Framework**: HTTP real em porta dinâmica (molde de `apps/api/test/*.e2e.spec.ts`)
- **CA**: CA-02, CA-07
- **Objetivo**: a rota compõe do estado gravado **naquele instante** — dois pedidos com uma alteração no meio produzem PDFs de conteúdo diferente, sem ato intermediário de regeneração.
- **Pré-condições**: sessão real de operador com `TELA:contratos` na empresa dona, concedida **pelo caminho real** (sign-in + escrita de ajustes sob o contexto real).
- **Passos**:
  1. `GET /v1/contratos/:codigo/documento` → capturar bytes.
  2. `PUT /v1/contratos/:codigo` alterando `valorMensal` de 2.500,00 para 2.800,00.
  3. `GET /v1/contratos/:codigo/documento` de novo → capturar bytes.
  4. Extrair o texto dos dois PDFs (`pdfjs-dist`) e comparar o trecho da cláusula sétima.
- **Validações**: `Content-Type: application/pdf` nos dois; `Content-Disposition` sugere nome de arquivo (ADR-0028); o texto do 2º contém `R$ 2.800,00` e **não** contém `R$ 2.500,00`.

#### Fluxo: cancelar sem documento — a divergência por vitória que fecha o D36 (CT-710)

- **Framework**: HTTP real · **CA**: CA-05 · **RN**: RN-03
- **Objetivo**: o cancelamento depende **só** do estado `ATIVO`, nunca da existência de documento — divergindo de propósito do legado, que recusava `CTR-CARACT-CAN-SEM-PDF`.
- **Pré-condições**: sessão com `TELA:contratos` + `ACAO:cancelar_contrato`; contrato criado e ativado pelas rotas reais, **sem nenhum campo de documento no corpo** (ele não existe mais).
- **Passos**: criar e ativar → `POST /v1/contratos/:codigo/cancelamento` → conferir corpo.
- **Validações**: `200`, `status: 'CANCELADO'`, e `Object.keys(corpo)` **não** contém `pdfContratoArquivo`.
  O negativo simétrico (cancelar `RASCUNHO`/`CANCELADO` continua `422`) **já está coberto** pelo `CT-415` da suíte existente — não se reescreve.

#### Fluxo: acesso ao documento — os três negados (CT-715)

- **Framework**: HTTP real · **CA**: CA-08 · **RN**: RN-05
- **Objetivo**: as três condições (sessão, área, empresa dona) são impostas por mecanismos **distintos** — guarda, decorador e RLS — e a falta de qualquer uma recusa sem devolver bytes.
- **Pré-condições**: contrato da empresa A; sessão de operador da empresa B; sessão de operador de A **sem** `TELA:contratos`.
- **Passos**: três `GET .../documento`, um por cenário (`outra_empresa`, `sem_area_contratos`, `sem_sessao`).
- **Validações**: **nenhum** dos três tem `Content-Type: application/pdf`; os três devolvem o envelope de erro da ADR-0017 — `404`, `403` e `401` respectivamente (§10.1).

#### Fluxo: o disparo automático no cadastro (CT-717 e CT-718)

- **Framework**: HTTP real + fila real (BullMQ sobre Redis efêmero) · **CA**: CA-09 · **RN**: RN-07
- **Objetivo**: criar locatário com e-mail grava o endereço como não confirmado, cria portador com prazo de 72 h e **enfileira a mesma tarefa** do reenvio manual — nunca envio síncrono na borda.
- **Pré-condições**: sessão com `TELA:cadastros`; fila efêmera acessível para introspecção.
- **Passos (CT-717)**: `POST /v1/locatarios` com e-mail → `GET` do criado → consultar `negocio.portador_de_confirmacao` e a fila.
- **Validações (CT-717)**: `201`; `emailConfirmadoEm` é `null`; **exatamente uma** linha de portador, com `expira_em` ~72 h à frente e `consumido_em` nulo; a fila recebeu **exatamente 1** tarefa, com o **mesmo nome de fila** que o reenvio usa (CT-719).
- **Companheiro negativo (CT-718)**: `PUT` alterando **só** o telefone, com o **mesmo** e-mail já confirmado → `emailConfirmadoEm` permanece o **mesmo instante** (`toBe`, nunca `toBeTruthy`), a contagem de portadores **não** aumenta, e nenhuma tarefa nova é enfileirada. Sem ele, uma implementação que reenviasse a QUALQUER `PUT` passaria despercebida.

#### Fluxo: o reenvio manual (CT-719 e CT-720)

- **Framework**: HTTP real · **CA**: CA-10 · **RN**: RN-09, RN-13
- **Objetivo**: o reenvio cria portador novo, **invalida todos os anteriores** do locatário e responde `202` **sem** desfecho de SMTP.
- **Pré-condições**: locatário com portador automático já existente; sessão com `TELA:cadastros` concedida pelo caminho real.
- **Validações (CT-719)**: `202`; o corpo é **exatamente** `{ reenviadoEm, expiraEm }` — `Object.keys` igual ao par declarado, **nenhuma** chave de desfecho de e-mail. É essa asserção de igualdade de chaves que torna a decisão desta sessão **verificável**, e não apenas declarada. P1 fica com `invalidado_em` marcado; P2 nasce com prazo próprio.
- **Companheiro negativo (CT-720)**: sessão **sem** `TELA:cadastros` → `403 ACESSO_NEGADO` com o envelope da ADR-0017; a contagem de portadores **não** muda; nenhuma tarefa na fila.

#### Fluxo: o ato do titular, sem sessão (CT-721)

- **Framework**: HTTP real, **sem cookie algum** · **CA**: CA-11 · **RN**: RN-12
- **Objetivo**: o segredo no **corpo**, apresentado dentro de 72 h e sem sessão, confirma o endereço do locatário dono do portador.
- **Pré-condições — e este é o ponto delicado do arranjo**: o segredo em claro **não existe no banco**. O caminho legítimo é: criar o locatário pelo caminho real → deixar o **worker real** processar a tarefa contra o **capturador de e-mail** (substituído de fora por `overrideProvider(TOKEN_PORTA_DE_EMAIL)`, **nunca** por um ramo de ambiente dentro do adaptador) → **extrair o segredo do conteúdo da mensagem capturada**, exatamente como o locatário o receberia.
  ⚠️ **Nunca inserir o segredo direto no banco nem fabricar hash compatível** — isso provaria o teste, não o produto.
  Teste análogo: `apps/api/test/automacao-de-cobranca.e2e.spec.ts`.
- **Validações**: `200 { confirmado: true }` por **igualdade estrita** de corpo, sem campo extra; `emailConfirmadoEm` deixa de ser `null`; o segredo não aparece em URL alguma (o `POST` usa corpo, nunca caminho nem consulta).

#### Fluxo: reapresentação dentro da validade (CT-724)

- **Framework**: HTTP real, sem sessão · **CA**: CA-12 · **RN**: RN-10
- **Objetivo**: apresentar de novo, dentro das 72 h, um link **já consumido** responde sucesso e **não altera nada** — em particular, o instante de confirmação **não é reescrito**.
- **Pré-condições**: o próprio caminho feliz repetido — **sem manipulação de relógio**, porque a segunda apresentação acontece na mesma execução.
- **Validações**: 2ª apresentação responde `200 { confirmado: true }`, igual à 1ª; `instanteA === instanteB` por comparação de string ISO-8601 exata (`toBe`).
- É o caso que impede uma **pré-visualização de provedor de e-mail** de queimar o link antes do locatário.

#### Fluxo: o reenvio invalida o link anterior (CT-722)

- **Framework**: HTTP real · **CA**: CA-10 · **RN**: RN-09
- **Objetivo**: um link emitido antes do reenvio, **ainda dentro das 72 h originais**, deixa de confirmar.
- **Pré-condições**: dois segredos capturados de duas mensagens distintas — o automático e o do reenvio —, **sempre do capturador, nunca do banco**.
- **Validações**: 1º segredo → **exatamente** a mesma resposta e status da recusa indistinguível do CT-723, e `emailConfirmadoEm` continua `null`. 2º segredo → `200 { confirmado: true }`.
  ⚠️ **O controle positivo é obrigatório**: sem ele, a recusa do 1º poderia vir de qualquer defeito genérico da rota, e não da invalidação por reenvio.

### 19.4 Cenários de Erro

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---|---|---|---|---|
| ⚠️ **Recusa indistinguível — o caso mais delicado da fatia** (CT-723) | CA-13 | Inválido, vencido e consumido-fora-da-validade produzem **exatamente a mesma resposta, byte a byte**, e **nenhum altera estado** | 3 apresentações: segredo nunca emitido · segredo real com `expira_em` retrocedido · segredo consumido com `expira_em` retrocedido depois do consumo | as três respostas iguais entre si por **`toStrictEqual`** (status + corpo) e diferentes do `200` do CT-721 → `404 { codigo: 'RECURSO_NAO_ENCONTRADO', mensagem: 'recurso não encontrado' }` (§10.1). Cenário 2: `emailConfirmadoEm` continua `null`. Cenário 3: permanece o instante da 1ª confirmação, **não sobrescrito**. **Log**: `info` com `motivo: 'nao-resolvido'` — constante, **nunca** distinguindo os três casos (§13.1) |
| Apresentar o **derivado** como se fosse o segredo (CT-725) | CA-14 | O que o sistema guarda não confirma nada, e não permite derivar segredo válido | **duas apresentações, uma por camada**: (a) o hash lido da coluna em **hexadecimal** (64 caracteres); (b) o **mesmo** digest em **base64url** — `createHash('sha256').update(segredo).digest('base64url')` | (a) → `422 CAMPO_INVALIDO` nomeando `segredo`: o molde `[A-Za-z0-9_-]{43}` recusa 64 caracteres, e **nenhuma consulta ao banco é disparada**. (b) → `404 RECURSO_NAO_ENCONTRADO`: o digest tem **32 bytes**, logo em base64url dá **exatamente 43 caracteres** e **passa** pelo esquema — a recusa vem da busca, porque o guardado é `sha256(segredo)` e não `sha256(derivado)`. ⚠️ **As duas são obrigatórias.** Só (a) provaria o esquema achando que prova a derivação; a alínea (b) é a que exercita a CA-14 de fato, e ela existe **sem burlar camada nenhuma** |
| Isolamento com tentativa de influenciar o contexto (CT-726) | CA-15 | O contexto vem do **registro que o portador resolve**, nunca do pedido | `{ segredo: segredoDeA }` e depois `{ segredo: segredoDeA, empresaId: <id de B> }` | 1ª: locatário de A confirmado, o de B **intacto**. 2ª: `422 CAMPO_INVALIDO` pelo `strictObject` (chave desconhecida) e, em qualquer caso, o estado de B **permanece inalterado** |
| Segredo com forma inválida | CA-11 | A rota pública recusa **antes** de qualquer consulta ao banco | `{ segredo: 'abc' }` | `422 CAMPO_INVALIDO` nomeando `segredo` — nenhuma ida ao banco |
| Carga de fila malformada (CT-734) | CA-09 | O consumidor recusa nomeando o **campo**, nunca o **valor** | `{ empresaId }` sem os demais campos | lança **antes** de `emUnidadeDeTrabalho`; nenhuma consulta disparada; a mensagem nomeia os campos faltantes |
| SMTP indisponível na entrega | — | A falha não alcança o cadastro, que já commitou | capturador com `recusar(destinatario, causa)` | a tarefa rejeita; a fila repete (3 tentativas, espera exponencial); `warn` com `idTarefa` e causa. O cadastro permanece gravado |
| Redis indisponível no disparo | — | Mensagem perdida **nunca** vira cadastro perdido | fila derrubada entre `COMMIT` e `add` | a resposta do cadastro é `201`/`200` normalmente; `warn` com `locatarioId` e `empresaId`. A rede é a RN-13 (§9.2) |

### 19.5 Cenários não cobertos, e por quê

| Cenário | Motivo |
|---|---|
| Termo canônico da **marca de cancelamento** | Delegado ao challenge (`[DELEGAR_TECH_SPEC]`, §21.7). O CT-706 usa o termo provisório do PRD |
| Registro, para o handoff, da página que **não existe** neste repositório | Item de documentação, não comportamento executável — não gera caso |
| **Retenção** do registro do portador | Fora de escopo (F7, §7.5). Os casos provam que o registro **continua existindo** depois de consumido (RN-10), não a retenção |
| **Limitador de taxa** na rota pública | Dependência declarada da F7 (§11.5). A mitigação testada é uso único + prazo |
| Perda da mensagem entre `COMMIT` e enfileiramento | Janela **declarada e aceita** (§9.2). A rede de produto é a RN-13, já coberta pelo CT-719 |

### 19.6 Recomendações do gerador, e o que o arquiteto fez com cada uma

| Recomendação | Decisão |
|---|---|
| A task da CA-01 (CT-701) roda **antes** de todas | **Acolhida** — está em §21.8 e no roteiro de fases do PRD |
| Os vereditos de CA-05 e CA-06 escritos **antes** de tocar o cancelamento | **Acolhida e já cumprida** — §21.1, DV-05 e DV-06 |
| Antecipar CT-707 e CT-708 para o início do `@sysloc/documentos` | **Acolhida** — são as duas provas mais caras de reconstruir depois, e o D3 é o maior risco da fatia (§20) |
| Confirmar o nome da tabela e do módulo do portador | **Cumprida** — `negocio.portador_de_confirmacao` e `packages/db/src/portador-de-confirmacao.ts`, fixados em §7.2 e §3.5 |
| Não criar mecanismo novo de "avançar o relógio" | **Acolhida** — o vencimento é obtido por `UPDATE` direto no carimbo **depois** de criar a linha pelo caminho real, no molde de `lancarEm` de `automacao-de-cobranca.e2e.spec.ts` |

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **A normalização do D3 nasce frouxa e a prova vira carimbo** — é o risco central da fatia | Média | **Alto** — a igualdade com o oráculo passaria a aprovar qualquer coisa | A regra é **fechada em 3 operações** (§21, DV-02/DV-03) e **provada por falsificação** com 5 mutantes que precisam ficar vermelhos. O gate reprova asserção estática sem falsificação |
| **Divergência descoberta durante a execução** — o PRD a declara *falha de método*, não resultado | Média | Alto | Os 7 vereditos (DV-01 a DV-07) estão escritos **nesta especificação, antes da execução**. Divergência nova exige emenda ao artefato, e não ajuste de teste |
| **A janela do legado fecha antes da captura** (CA-01) | Baixa | **Irreversível** | A captura vai **primeiro**, na Fase 1 do roteiro. É o precedente medido da T1 das duas fatias anteriores |
| **A premissa que condiciona a captura é falsa** — *"existem contratos reais que exercitam cada caminho"* | Média | Médio | Ela é **medida antes de ser registrada**, nunca estimada. Ausência é registrada **como ausência medida**, e nada é criado no legado. ⚠️ É o erro que a T1 da fatia de contratos cometeu e que quatro comandos teriam derrubado |
| **A `0013` é destrutiva e não tem volta** enquanto a F7 não entregar backup | Baixa | Alto | §16.6. A ordem migrar → construir → reiniciar é obrigatória, e a assimetria está escrita |
| **`react` num manifesto deste repositório é lido como violação da Fronteira** | **Alta** | Baixo | A afirmação está no cabeçalho do pacote, do adaptador e em §3.3. É risco de **leitura**, não de comportamento — e por isso se mitiga por escrito |
| **`emailConfirmadoEm` vaza para a elegibilidade da régua** e quebra a CA-16 | Baixa | Alto | O predicado vive no banco (`envio-de-cobranca.ts`) e **não é tocado** por esta fatia. A CA-16 é prova comportamental com os dois locatários |
| **Duplicar a barreira do SMTP na API** — o antipadrão que a D8 existe para evitar | Baixa | Alto | A API **não fala SMTP** nesta fatia: ela enfileira. `adaptador-smtp.ts` proíbe por escrito o ramo de ambiente que a duplicação convidaria |
| **`MensagemDeEmail` nasce como segunda declaração do mesmo fato** | Alta | Baixo | Declarado como **débito com gatilho** (§21), com a promoção agendada para o terceiro consumidor. É a forma que o D1 e o D26 já usam |
| **O segredo em claro na carga da fila** fica retido em Redis | Média | Médio | §11.3 — Redis local sem porta pública, retenção de 1.000 tarefas, e o segredo morre em 72 h. Exposição **declarada**, não descoberta |
| **A rota pública nasce sem limitador de taxa** | Alta | Baixo | Dependência declarada da F7 (§11.5). 256 bits tornam a força bruta irrelevante; uso único e prazo são a mitigação que não depende do que falta |
| **Suíte encolhe num pacote sem que alguém veja** | Média | Alto | Baseline por pacote antes e depois (P1/P5 do Protocolo). ⚠️ `CT-907` é **flaky pré-existente** — falha por *timeout* é o flake; falha por *asserção* é achado |

---

## 21. Observações Técnicas

### 21.1 As divergências declaradas, com veredito escrito ANTES da execução

**Esta tabela é insumo, não subproduto.** A RN-15 é literal: *"divergência descoberta durante a
execução é falha de método, não resultado"*. O método é o da sub-fatia irmã, que fechou com **uma
única** divergência porque os dez vereditos estavam escritos antes e o lado do oráculo era **lido do
golden**.

| # | Divergência medida | Veredito | Razão |
|---|---|---|---|
| **DV-01** | Valor por extenso: o legado emite **em inglês** — `two thousand, ﬁve hundred only reais` está literalmente no golden, produzido por `frappe.utils.money_in_words(v, "BRL")` com o idioma padrão do site | **PRODUTO_VENCE** | É defeito do legado, não regra de negócio. O produto emite em pt-BR. A normalização **não** o absorve; o bloco entra na lista com divergência esperada |
| **DV-02** | Ligadura tipográfica `ﬁ` (U+FB01) em `identiﬁcado`, `ﬁns`, `ﬁcará`, `ﬁnanceiras` | **NORMALIZACAO** | Artefato do **extrator de PDF**, não do conteúdo. Absorvida por NFKC, que é operação Unicode padrão e reversível de significado |
| **DV-03** | Quebras de linha do layout do wkhtmltopdf, no meio de frases | **NORMALIZACAO** | Idem — é layout de outro motor. Absorvida pelo colapso de espaço **entre palavras**; onde a quebra caiu **colada à pontuação** (`</b>,` e `</b>.`), sobra um espaço **no lado do ORÁCULO**, e o bloco entra na lista de divergência esperada — o produto **não** reproduz o resíduo. ⚠️ **Emenda de 2026-08-13 (T5)**: a redação anterior dizia "absorvida pelo colapso de espaço em branco", prevendo **zero** divergência remanescente; a medição da T5 mostrou absorção **parcial**. Blocos alcançados: `clausula-primeira` (só DV-03) e, somado à DV-01, `clausula-setima` e `alinea-valor-total`. Reproduzir o resíduo poria no PDF um espaço antes da vírgula que o contrato não tem, só para casar com um artefato de extração |
| **DV-04** | `<DATA_GERACAO_EXTENSO>` no fecho | **PARAMETRO** | Máscara declarada na `PROCEDENCIA.md` §1. O instante entra por parâmetro, resolvido do banco (ADR-0026) |
| **DV-05** | Cancelar contrato **sem documento**: o legado recusa (`contrato_sem_pdf`, capturado em `contrato-cancelamento.json`); o produto **cancela** | **PRODUTO_VENCE** | CA-05 e RN-03. A recusa legada protegia o carimbo, não o negócio — fecha o **D36** por construção |
| **DV-06** | Contrato **sem imóvel**: o legado recusa; no produto o estado é **irrepresentável** (`contrato.imovel_id NOT NULL` + FK composta) | **IRREPRESENTAVEL** | CA-06 e RN-04. Registra-se que **nenhuma recusa equivalente é oferecida pela aplicação** — a impossibilidade é do armazenamento |
| **DV-07** | Marca de cancelamento: o legado mescla sobre bytes prontos e regrava o arquivo; o produto **compõe** | **PRODUTO_VENCE** | RN-02. Não há oráculo textual do carimbo no golden — o golden é de contrato **ativo** |

**Como a comparação roda** (CA-03): o golden é segmentado em blocos pelos marcadores estruturais que
ele próprio carrega (`LOCADOR (A):`, `OBJETO`, `CLÁUSULA PRIMEIRA:`, …); a composição produz os
**mesmos** blocos; a comparação é **bloco a bloco**, e cada divergência remanescente precisa casar
**exatamente** um veredito acima. Divergência sem veredito **reprova o caso** — não o ajuste.

### 21.2 A normalização do D3, fechada

`normalizarParaComparacao(texto: string): string` faz **três** operações, nesta ordem, **e nada além**:

1. `texto.normalize('NFKC')` — resolve ligadura tipográfica (DV-02).
2. Toda sequência de espaço em branco — incluindo `\n`, `\t` e `U+00A0` — vira **um** espaço `U+0020`
   (DV-03).
3. `.trim()`.

O que ela **NÃO** faz, e a lista é vinculante: não remove pontuação, não muda caixa, não remove
acento, não reordena, não remove palavra, não arredonda número, não normaliza moeda.

**Prova de falsificação obrigatória** — cada mutante abaixo tem de deixar o caso **vermelho**:

| Mutante | O que muda | Por que precisa reprovar |
|---|---|---|
| m1 | Trocar uma palavra do bloco composto | A normalização não pode absorver conteúdo |
| m2 | `R$ 2.500,00` → `R$ 2.500,01` | Dinheiro é o que mais importa no documento |
| m3 | Inverter dois parágrafos | Ordem é conteúdo |
| m4 | Remover a `CLÁUSULA VIGÉSIMA PRIMEIRA` | Omissão precisa doer |
| m5 | `LOCATÁRIO` → `locatário` | A regra não muda caixa, e isso tem de ser observável |

Mais o **controle pela outra ponta**: aplicar a normalização a **dois** blocos distintos do golden não
pode colapsá-los no mesmo valor.

### 21.3 ADRs Aplicáveis nesta Feature

**Conferência literal contra a seção `Decision` de cada ADR aberta** — não contra a linha-resumo do
`INDEX.md`, que é paráfrase e já divergiu do texto real.

| ADR | Classificação | Onde toca, e como a conformidade foi conferida |
|---|---|---|
| **ADR-0027** — critério para rota dispensar sessão | **APLICÁVEL** | §11.1 confronta a `Decision` **item a item**: titular do dado ✓, nunca terá sessão ✓, portador aleatório com entropia declarada (256 bits) ✓, guardado como hash ✓, expiração ✓, uso único ✓ (**leitura conjunta abaixo**), um ato sobre um objeto ✓, contexto do registro que o portador resolve ✓, rota declarada `publicas` com `semDeclaracao` vazio ✓ |
| **ADR-0028** — o que o contrato publica para rota de bytes | **APLICÁVEL** | §4.1. As três declarações estão presentes (mídia, nome do arquivo, mesmo envelope de erro). A **cláusula de exceção não se ativa**, e isso foi **medido**: `ApiResponseCommonMetadata extends Omit<ResponseObject,'description'>`, e `ResponseObject` aceita `content` e `headers`. Sobre o `schema:` do corpo de sucesso, ver a **leitura conjunta abaixo** |
| **ADR-0030** — artefato derivado é composto sob demanda, nunca armazenado | **APLICÁVEL** | **Registrada em 2026-08-12**, na sessão de challenge (candidato 5/5 de §21.4). Governa a RN-01: não existe caminho de escrita de documento, e a coerência vem da **ausência de cópia**. ⚠️ A `Decision` traz **cláusula de exclusão**: *fato recebido de terceiro — boleto emitido pelo provedor, retorno bancário, documento assinado — não é artefato derivado*, e está **fora** do alcance dela. É o que separa o carnê (derivado, composto) do boleto (fato, guardado) na F4. O `Con` sobre irreprodutibilidade de instante passado é o que autoriza **superseder** caso surja exigência probatória — nunca guardar cópia por baixo da ADR |
| **ADR-0029** — efeito externo sai por fila | **APLICÁVEL** | §5.1-B, §9.1. Os **dois** disparos enfileiram; nenhum envia em linha. A cláusula de exclusão (*"chamada síncrona cujo retorno o solicitante espera"*) **não** é invocada — o `202` do reenvio não carrega desfecho de SMTP, por decisão desta sessão |
| **ADR-0024** — origem do contexto sem requisição | **APLICÁVEL** | §5.1-B.2 e §5.1-B.3. Na fila o contexto vem da **carga**, uma vez, na borda que a recebe. Na rota pública vem do **registro que o portador resolve**. A função `SECURITY DEFINER` **não aceita `empresa_id` por parâmetro** — §7.3, propriedade 1. ⚠️ A **cláusula de exclusividade** da `Decision` (*"a enumeração de tenants é a única leitura legítima sem contexto de empresa"*) é a peça que esta linha **não** conferia até 2026-08-13 — ver a **leitura conjunta (3) abaixo** e a **emenda** que ela motivou na própria ADR |
| **ADR-0008** — isolamento garantido pelo banco | **APLICÁVEL** | §7.2. `portador_de_confirmacao` nasce com `empresa_id`, RLS habilitada (`0013`) e **forçada** (`0014`), `USING` e `WITH CHECK` com a **mesma expressão literal** das cinco migrações de segurança anteriores, e **FK composta** `(locatario_id, empresa_id)`. Nenhum filtro por empresa é escrito na aplicação |
| **ADR-0009** — fronteira por schema, cobertura no catálogo | **APLICÁVEL** | A tabela nasce em `negocio` e entra na varredura de `packages/db/test/catalogo.spec.ts`, que consulta o catálogo do sistema — nunca uma lista à mão |
| **ADR-0025** — o domínio declara a porta | **APLICÁVEL** | §3.3. `PortaDeRenderizacao` é declarada em `@sysloc/documentos`; `renderizador-pdf.ts` **importa dela**. A porta chega à composição **por parâmetro**, nunca por import |
| **ADR-0016** — o esquema é a fonte única | **APLICÁVEL** | §4.2, §15.3. Todo corpo e toda resposta JSON derivam por `esquemaPublicado`. A rota de bytes é a única que declara `content` literal, e a ADR-0028 é quem a autoriza |
| **ADR-0017** — três classes de chave exposta | **APLICÁVEL** | O contrato é alcançado por **código legível** (`CTR-{ano}-{5 dígitos}`, série declarada); o locatário por **UUID**; o portador **não é recurso exposto** — ele é resolvido pelo segredo e nunca aparece na superfície. O envelope de erro é o da `Decision`, literal |
| **ADR-0011** — cobertura declarada por rota, default que nega | **APLICÁVEL** | §11.2, CA-17. Nenhuma rota sem declaração; `semDeclaracao` **vazio**, medido sobre o roteador montado |
| **ADR-0018** — composição de exigências, cobertura por conteúdo | **APLICÁVEL** | §11.2. As duas rotas com sessão **herdam da classe** e nada declaram próprio, exatamente para não substituir por `getAllAndOverride`. O `CT-355` continua sendo a rede |
| **ADR-0022** — o que se grava e o que se deriva | **APLICÁVEL** | §7.2. Grava-se o **fato** (`email_confirmado_em`); publica-se estado **derivado** dele. Nenhuma coluna de estado movida por rotina |
| **ADR-0026** — o relógio mora no banco | **APLICÁVEL** | §7.3. `expira_em` e a comparação de prazo saem de `pg_catalog.now()`, **dentro do banco**. Nenhum `Date.now()` decide comportamento. Por ser `timestamptz`, **nenhum literal de fuso** é necessário — o que evita agravar o **D14** |
| **ADR-0014** — exclusão lógica | **PARCIAL** | O locatário segue com `retirado_em` intacto. `portador_de_confirmacao` **não** entra no alcance: é *detalhe de composição* pelo discriminador da `Decision` — não é referenciável por registro nenhum e seu ciclo é o do locatário. Ele **nunca é apagado**, mas por outra razão (RN-10), e não por esta ADR |
| **ADR-0021** — transição de estado é rota própria | **PARCIAL** | A confirmação é rota própria ✓. A governança, porém, **não** é ação sensível nem área: é o **portador**, que a ADR-0027 institui depois e para exatamente este caso. Não há contradição — pelo próprio discriminador da `Decision` da 0021, o ato *não transfere direito, não move dinheiro e não altera o que outra entidade pode fazer* (RN-06: é informativo), logo é da classe mais leve; a 0027 apenas substitui *"a área"* por *"o portador"* quando não há sessão. **Registrado por escrito para que um gate futuro não leia violação onde houve leitura conjunta** |
| **ADR-0023** — onde vive a derivação | **PARCIAL** | O predicado de prazo e invalidação **participa de seleção** e por isso vive **no banco** (a função). `emailConfirmadoEm` serve só à **apresentação** do registro já selecionado e por isso não vira visão |
| **ADR-0005** — rotinas versionadas com instalação idempotente | **PARCIAL** | §16.3. As duas migrações e a variável nova entram pelo caminho idempotente já existente |
| **ADR-0006** — ambiente de verificação separado | **APLICÁVEL** | Toda a suíte roda em instância efêmera própria; nenhuma verificação alcança o banco da operação, destinatário real de e-mail, ou escreve no legado (CA-18, RN-16) |
| **ADR-0010** · **ADR-0013** | **PARCIAL** | O efetivo de permissão e a garantia do operador do SaaS são consumidos como estão. A rota pública **não** cria caminho novo de sessão — ela não tem sessão nenhuma |
| **ADR-0015** · **ADR-0020** — contador de série | **N/A** | Nenhuma série declarada nasce aqui. O portador é resolvido por segredo, não por código legível |
| **ADR-0001** · **ADR-0019** · **ADR-0012** · **ADR-0007** | **N/A** | A 0001 é cobrança bancária (F4). As outras três estão `superseded` — cite só a vigente |
| **ADR-0002** · **ADR-0003** · **ADR-0004** | **N/A** | `deprecated` — nomeiam primitivas do Frappe |

**Nenhum conflito spec × ADR sobrevive**, e nenhum conflito ADR × ADR — sendo que a terceira leitura
conjunta abaixo só pôde afirmar isso depois de a ADR-0024 ser **emendada em 2026-08-13**. Os três
`PARCIAL` com leitura não óbvia — 0014, 0021 e 0023 — estão justificados acima **contra o texto real
da `Decision`**, e não contra a paráfrase do índice.

#### Três leituras conjuntas que ficam registradas por escrito

As duas primeiras vieram do challenge; a **terceira veio do Gate 2 da T11**, que confrontou a
cláusula que o challenge não havia confrontado. A afirmação anterior — *"nenhum conflito foi
encontrado"* — **não sobreviveu à leitura literal** das ADRs mais novas. As três tensões abaixo são
reais na letra e resolvidas na leitura conjunta; estão escritas aqui pelo mesmo motivo da nota da
ADR-0021: **para que um gate futuro não leia violação onde houve leitura conjunta**, e para que
ninguém "conserte" o código na direção errada.

**(1) ADR-0028 × o `schema:` do corpo de sucesso.** A `Decision` diz literalmente que a rota de bytes
*"**não** declara forma do corpo de sucesso — bytes são opacos por natureza"*, e a §4.1 prescreve
`content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } }`.

**Não há violação, e a razão é o que `format: binary` significa.** Ele não descreve *forma* — é o
idioma que o OpenAPI tem para dizer **"isto é uma sequência de bytes opaca"**. É a declaração da
ausência de forma, não uma forma. Omiti-lo produziria o desfecho pior nos dois sentidos: o documento
publicado descreveria um corpo de tipo indefinido, e o gerador de cliente do frontend trataria a
resposta como JSON. O que a `Decision` proíbe — e que esta fatia **não** faz — é declarar a
**estrutura** do sucesso: nenhum `esquemaPublicado`, nenhum objeto, nenhum campo.

**(2) ADR-0027 × a RN-10.** A `Decision` exige um portador *"de **uso único**"*, e a RD-10 manda o
portador **já consumido continuar resolvendo** dentro da validade — a função `SECURITY DEFINER` da
§7.3 **não** filtra por `consumido_em`, de propósito.

**Não há violação: "uso único" é o EFEITO, não a RESOLUÇÃO.** O ato acontece **uma vez só**, e a
unicidade é imposta pelo banco, não por um `if`: o consumo é
`UPDATE … WHERE consumido_em IS NULL RETURNING`, cuja ausência de retorno é ela própria o resultado
(§7.4). A segunda apresentação **resolve e não escreve** — `email_confirmado_em` não é reescrito, e o
`CT-724` prova isso por `instanteA === instanteB`, comparação estrita de ISO-8601.

⚠️ **A alternativa aparentemente mais segura é a errada.** Acrescentar `AND p.consumido_em IS NULL`
ao `WHERE` da função daria a RN-14 de graça e pareceria "endurecer" — e **quebraria a RN-10 do PRD**,
devolvendo `404` à reapresentação e reabrindo o defeito que o `CT-724` existe para fechar: a
pré-visualização de link pelo provedor de e-mail queimaria a confirmação antes de o locatário clicar.
**Essa linha não entra na função.**

**(3) ADR-0024 × ADR-0027 — a cláusula de exclusividade, levantada pelo Gate 2 da T11.** A `Decision`
da ADR-0024 diz literalmente que *"a enumeração de tenants é a **única** leitura legítima sem contexto
de empresa, e vive no schema sem noção de tenant"*. A rota do ato do titular instala a **segunda**:
`resolverPortador` sobre `negocio.resolver_portador_de_confirmacao` — sem contexto, e num schema que
**tem** noção de tenant. A tabela acima classificava a 0024 como aplicável conferindo apenas a origem
do contexto e a ausência do parâmetro de empresa; **a cláusula de exclusividade não havia sido
confrontada**, e o código de produção citava a 0024 nominalmente como fundamento do que a letra dela
proibia.

**A tensão era factual, não interpretativa, e por isso a saída não foi uma leitura conjunta e sim uma
emenda.** A ADR-0024 foi **emendada em 2026-08-13** — `Status`, `Context`, `Consequences` e as quatro
alternativas rejeitadas **intactos**, só a `Decision` ganhou o parágrafo, no molde da emenda de
2026-08-10 da ADR-0021 e com a mesma fórmula: *"a decisão não mudou: mudou o registro dela"*. A
emenda declara **duas** leituras legítimas e, com elas, o **discriminador** que distingue leitura sem
contexto de contorno do isolamento: a segunda só vale quando a travessia é **nominal e auditável** —
papel `NOLOGIN` de propósito único que não conecta e não é dono de tabela, política própria endereçada
a ele, `GRANT` mínimo (`USAGE` no schema, `SELECT` sobre uma tabela), `EXECUTE` revogado de `PUBLIC` e
concedido nominalmente, e a função sem parâmetro de empresa. É exatamente a maquinaria da migração
`0014` (§7.3), e **travessia por privilégio de dono continua rejeitada** — que é o defeito medido na
rodada 1 daquela migração.

⚠️ **Por que isto não podia ficar só aqui.** A **F4 é a integração bancária**, e *"retorno de
integração externa"* está nomeado no `Context` da própria 0024. Quem decidir de onde vem o contexto do
webhook Sicoob leria uma cláusula **já falsa**, e o erro é caro nas duas direções: lida como
proibição, bloqueia um mecanismo que a ADR-0027 institui; lida como autorização por analogia, abre
leitura sem contexto **sem** a maquinaria que torna esta aqui segura. Por isso a emenda troca
exclusividade por **contagem** por exclusividade por **critério**.

### 21.4 Candidatos a ADR (FASE 4B — os 5 critérios canônicos)

**Candidato a ADR confirmado — 5/5**

> *"Artefato derivado de dado gravado é composto sob demanda, nunca armazenado."*
> Tag: `architecture`, `data`.

| Critério | Justificativa |
|---|---|
| **C1 · transversal** | Governa o documento do contrato (aqui), o **carnê** e o boleto (F4), e qualquer relatório futuro |
| **C2 · tag-alvo** | `architecture` + `data` |
| **C3 · custo de reversão alto** | Reverter é reintroduzir coluna, caminho de escrita, política de invalidação e a classe inteira de defeitos *"o arquivo discorda do cadastro"* |
| **C4 · surpreendente sem contexto** | Um leitor futuro pergunta *"por que não guardamos o PDF, se compor custa CPU a cada pedido?"* — e a resposta não está no código |
| **C5 · trade-off real** | Guardar cópia para reaproveitamento foi considerado e **adiado por escrito** no PRD; e o legado fazia o contrário, com a pré-condição de cancelamento que isso produziu (D36) como evidência do custo |

> ✅ **REGISTRADA como ADR-0030 em 2026-08-12**, na mesma sessão de challenge. A razão que motivou o
> registro: a F4 decide carnê e boleto pelo mesmo eixo, e sem a ADR ela redecidiria do zero — que foi
> exatamente o que produziu o **D36**.
>
> A redação final ganhou **duas coisas que esta seção não previa**, e as duas importam a quem for
> executar: uma **cláusula de exclusão** separando *artefato derivado* de *fato recebido de terceiro*
> (o boleto do provedor é fato, e guardá-lo não viola nada), e o `Con` que nomeia a
> **irreprodutibilidade de instante passado** — com o caminho legítimo escrito por extenso: se surgir
> exigência probatória, **supersede-se a ADR**, nunca se guarda cópia por baixo dela. Ver §21.3.

**Candidato a ADR parcial — 4/5**

> *"Prova por igualdade com oráculo externo exige normalização declarada, fechada e provada por
> falsificação."* Tag: `testing`.
> **Falha o C3**: reverter uma normalização frouxa é conserto local de um arquivo, não refactor. Os
> outros quatro passam. Fica registrado como decisão técnica em §21.2, e não como ADR.

**Não são candidatos (0-1/5)**, e por isso ficam só nas seções acima: a escolha de `pdfjs-dist` para
extração (verificação, reversível), o `404` para a recusa indistinguível (consequência de uma
`DECISÃO FECHADA` já existente), e o `202` do reenvio (decisão de fatia).

### 21.5 Débito com gatilho a EMITIR nesta fatia

Um só, e ele segue a forma do **D1** e do **D26** — os dois que agendam promoção de símbolo
duplicado:

```ts
// DÉBITO COM GATILHO — D{n} · F3/T{n} · registrado 2026-08-1X
// O QUÊ: `MensagemDeEmail { assunto, corpo }` e a porta de envio são a SEGUNDA declaração
//        estrutural do mesmo fato — a primeira é `MensagemDeAviso` e `PortaDeEnvioDeEmail`,
//        em `packages/regua/src/`. Elas são estruturalmente compatíveis, e é por isso que o
//        adaptador SMTP satisfaz as duas sem uma linha de conversão.
// QUANDO FECHA: a TERCEIRA mensagem de e-mail do produto (a F4, com o boleto emitido) — ali
//        `MensagemDeEmail` e `PortaDeEnvioDeEmail` sobem para `@sysloc/shared` e os dois
//        pacotes de domínio passam a importá-las.
// POR QUE NÃO AGORA: promover exigiria editar `@sysloc/regua`, e o PRD põe fora de escopo
//        qualquer alteração no que a sub-fatia irmã entregou e provou.
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D{n}
```

**Emitido o marcador, acrescente a linha ao índice do `CLAUDE.md`** — as duas pontas, como manda a
§3-B da `nao-regressao.md`.

### 21.6 Débito EXISTENTE que esta fatia fecha, e os que ela NÃO deve disparar

| Débito | O que acontece aqui |
|---|---|
| **D36 (F2/T8)** | **FECHA por construção.** Sem documento armazenado não existe arquivo preexistente de que o cancelamento possa depender. O marcador sai de `contrato.service.ts` **no mesmo commit**, e a linha sai do índice do `CLAUDE.md` |
| **D3 (F3/T1)** — 4º consumidor da leitura autenticada do legado | ⚠️ **NÃO deve disparar.** A captura da CA-01 estende `capturar.py`, que roda **dentro** do site efêmero e não tem caminho de autenticação próprio. **Não crie um quarto script com bloco de conexão** |
| **D13 (F3/T5)** — `semearPolitica­DeAviso` sem consumidor | **Pode fechar de graça.** A CA-16 precisa da política como precondição sem ser objeto — que é literalmente o gatilho escrito no marcador. Confira e feche se couber |
| **D14 (F3/T5)** — fuso com duas declarações | **Não agrava.** `expira_em` é `timestamptz` comparado com `pg_catalog.now()`; nenhum literal de fuso novo nasce |
| **D20 (F3/T7)** — janela da `0010` fecha em silêncio | **Não toca a `0010`.** A medição de §7.3 informa o D20, mas nada aqui o dispara |
| **D23 · D24 · D27** — publicação atrás do servidor de borda | **Não cria um quarto marcador** para o mesmo gatilho (§11.5) |
| **D12 (F3/T4)** — `ESTADOS_AVISAVEIS` como tupla | ⚠️ **Dispara se** alguma task abrir `packages/contracts/src/cobranca.ts` por outra razão. Esta fatia **não deveria** abri-lo |
| **D1 (F3/T2)** — 3º consumidor monetário | ⚠️ **Vigie**: `extenso.ts` consome valor monetário. Se ele importar `MAIOR_VALOR_MONETARIO`/`ESCALA_MONETARIA`, o gatilho pode ter chegado |

### 21.7 Terminologia — canonizada pelo challenge em 2026-08-12

**Pendência fechada.** Duas correções de fato antes de mais nada: o glossário de domínio **existe**
(`docs/specs/domain-glossary.md`, 40 termos) — o que não existia era o de feature —, e **Carimbo** de
fato está ocupado, com o sentido financeiro (*"o valor que era derivado e passa a ser gravado no
instante do ato que liquida um fato financeiro"*).

**Marca de cancelamento** é o termo canônico, confirmado nesta sessão. Ele é neutro quanto à forma —
não promete tarja, faixa nem selo —, e essa neutralidade é conteúdo: a marca é **parâmetro de
composição de texto**, nunca mescla sobre bytes prontos (RN-02, DV-07). PRD e esta especificação já o
usam em todo lugar, de modo que a canonização não pede reescrita alguma.

Os seis termos foram registrados, e o nível de cada um seguiu o critério da
`agent-spec-workflow-rules.md`:

| Termo | Nível | Por quê |
|---|---|---|
| **Marca de cancelamento** | GLOBAL | A ambiguidade a resolver é contra **Carimbo**, que vive no global — separá-los em arquivos diferentes é o que faria a desambiguação apodrecer |
| **Documento do contrato** | GLOBAL | Entidade que o frontend nomeia, e o **carnê** da F4 é o irmão direto: ≥ 2 features |
| **Portador de confirmação** | GLOBAL | É registro de primeira classe, e a ADR-0027 institui *portador de segredo* como critério do **produto**, não desta fatia |
| **Derivado** | FEATURE | Conceito operacional do mecanismo do portador; não é substantivo do negócio |
| **Representação textual** | FEATURE | Interna a `@sysloc/documentos` — o degrau entre a composição e a porta de renderização |
| **Veredito de divergência** | GLOBAL | Já atravessa **duas** fatias: os dez vereditos da `regua-de-cobranca` e os sete de §21.1 usam o mesmo conceito, e ele é o que a RN-15 cobra |

### 21.8 Duas notas para quem for executar

1. **A ordem das fases importa, e uma delas tem prazo.** A captura no legado (CA-01) vai **primeiro** —
   a janela fecha na virada e não reabre. É o precedente medido das duas fatias anteriores.
   ⚠️ E a premissa que a condiciona — *existirem contratos reais cobrindo cada caminho* — **é medida
   antes de ser registrada**. A T1 da fatia de contratos ficou parada por uma premissa falsa que
   quatro comandos derrubaram.
2. **O `sudo` NÃO é exigido pela frente de caracterização.** `grep -n sudo` nos arquivos de
   `deploy/scripts/caracterizacao/` retorna vazio; o acesso ao `/opt/frappe` é por `docker compose` e
   o usuário do host está no grupo `docker`. A exigência de `sudo` que a `testing-stack.md` registra é
   verdadeira para `deploy/scripts/instalacao/`, que toca o SO. **A distinção é por frente, não por
   host** — não herde a frase errada.

---

## 22. Checklist Final

- [x] Variante registrada (`backend`) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-11 mapeadas em §17, e em §5.3 por fluxo)
- [x] Resumo técnico claro e objetivo (§2)
- [x] Arquitetura definida com componentes e camadas (§3)
- [x] Contratos de API definidos com payloads, status codes e schemas (§4)
- [x] Fluxos de negócio descritos (§5)
- [x] Regras de processamento e validações (§6) — RD-01 a RD-16 rastreadas a RN-01..RN-16
- [x] Persistência: tabelas, índices, migrações, transação, retenção (§7)
- [x] Integrações externas mapeadas (§8)
- [x] Sincronização: eventos, idempotência, decisão sobre outbox (§9)
- [x] Gerenciamento de erros e resiliência (§10)
- [x] Segurança: auth, autorização, criptografia, sanitização, secrets (§11)
- [x] Performance: metas, estratégias, limites (§12) — com a ausência de instrumentação declarada
- [x] Logs, métricas, tracing e alertas (§13) — com os três `N/A` justificados
- [x] Feature flags (§14) — `N/A` justificado
- [x] Versionamento de API e a **mudança incompatível deliberada** (§15)
- [x] Deploy e infraestrutura: pipeline, empacotamento, IaC, rollout, rollback (§16)
- [x] Dependências externas listadas, com as rejeitadas e a razão (§18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (§19) — **33 casos**, rastreabilidade CA→CT nos dois sentidos (18/18 cobertos, nenhum CA alucinado), 3 provas de falsificação obrigatórias, `mock_budget_observado: true`, os 7 gates aplicados, `discovery_needed: false`
- [x] Cada CT tem ID único e pertence a **exatamente uma** camada (regra de unicidade da fase de tech_spec)
- [x] JSON lossless persistido em `_run/test-cases.json`, com `task_id: null` em todos os casos
- [x] Riscos técnicos identificados (§20)
- [x] Observações técnicas: 7 vereditos escritos ANTES, normalização fechada, inventário de ADRs conferido contra a `Decision`, candidatos a ADR (§21)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (§3.4-3.7)
- [x] Pronto para geração das TASKS
