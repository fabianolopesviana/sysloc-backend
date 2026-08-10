# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: Cobrança e mora por empresa, com estado de fonte única no servidor (`cobranca-e-mora`, fatia 1 de 2 da F3)
- **Variante**: backend
- **Stack**: Node 24 LTS · TypeScript strict · NestJS 11 + Fastify · Drizzle + postgres.js · PostgreSQL 18 · Zod 4 · Vitest + `embedded-postgres`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-09
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/cobranca-e-mora/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/cobranca-e-mora/v1/tech-alignment.md` (D1–D5, todas absorvidas)
- **Discovery**: `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md`
- **Oráculo**: `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`

---

## 2. Resumo Técnico da Solução

A cobrança nasce como **fato financeiro tenantizado, sempre filho de contrato**, em `negocio.cobranca`,
com código legível de série declarada `COB-{ano}-{7 dígitos}` — largura **medida** no sistema antigo
(`autoname = COB-.YYYY.-.#######`, série viva em `COB-2026-0000058`), e não estimada. O que a tabela
guarda são **fatos** (`data_vencimento`, `pago_em`, `cancelado_em`, `valor_original`) mais os
**carimbos do ato que liquida** (multa, juros e os dois percentuais vigentes no instante do pagamento).
Não há coluna `status`, não há coluna de mora em aberto e não há `locatario_id`.

O **estado publicado e a mora em aberto são derivados no banco**, numa **view única**
`negocio.cobranca_derivada` declarada `WITH (security_invoker = true)` — a ADR-0023 manda derivar no
banco o que participa de seleção ou compõe aritmética monetária, e o `security_invoker` é o mecanismo
concreto pelo qual essa derivação **não** adquire direitos próprios e continua sujeita à RLS da
ADR-0008. É essa unicidade estrutural — e não disciplina de chamada — que fecha o defeito de origem:
o sistema antigo tem três avaliações divergentes do mesmo estado, a ponto de o envio manual cobrar por
uma dívida cancelada. A aritmética corre inteiramente em `numeric`, de modo que a exatidão em centavos
da RN-16 é propriedade do tipo, e não de uma técnica de contorno.

A **ativação do contrato passa a gerar as parcelas na mesma unidade de trabalho**, fechando o débito
**D28** exatamente onde o marcador o agendou, e o cancelamento do contrato cancela em cascata as
cobranças ainda canceláveis. A **configuração de multa e juros vira dado de negócio por empresa**
(`negocio.configuracao_de_mora`), substituindo o `Atraso` Single global do sistema antigo. Sete
manipuladores novos entram na superfície publicada (75 → **82 rotas**, 60 → **67 manipuladores**),
nenhum deles exigindo chave de ação: o catálogo fechado da ADR-0011 **não é aberto**.

Fora da aplicação, a fatia executa **primeiro** a captura do oráculo da régua de cobrança contra o
`/opt/frappe`, com o despachante de e-mail substituído por um registrador — é a única peça com prazo
irreversível, e ela não é implementada aqui, apenas capturada.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                    ┌─────────────────────────────────────────────┐
   HTTP /v1         │  apps/api                                   │
  ───────────────►  │                                             │
                    │  CobrancaController      MoraController     │
                    │   @ExigeChave(TELA:financeiro)              │
                    │                          @ExigeChave(       │
                    │                            TELA:multa_e_juros)
                    │        │                        │           │
                    │        ▼                        ▼           │
                    │  CobrancaService          MoraService       │
                    │        │        ▲               │           │
                    │        │        │ (mesma unidade de trabalho)│
                    │        │   ContratoService ◄────┘           │
                    │        │   (ativar / cancelar)              │
                    └────────┼────────────────────────────────────┘
                             │  sobContextoDaSessao → SET LOCAL app.empresa_id
                    ┌────────▼────────────────────────────────────┐
                    │  packages/db  (porta única de dado)          │
                    │   cobranca.ts · configuracao-de-mora.ts      │
                    │   derivacao-de-cobranca.ts  (função PURA)    │
                    └────────┬────────────────────────────────────┘
                             │
   ┌─────────────────────────▼──────────────────────────────────────────────┐
   │  PostgreSQL 18 — schema `negocio`, RLS FORÇADA                          │
   │                                                                         │
   │   TABELA  cobranca            ← só FATOS e CARIMBOS (sem `status`)      │
   │   TABELA  configuracao_de_mora                                          │
   │                                                                         │
   │   VIEW    cobranca_derivada  WITH (security_invoker = true)             │
   │            └─ status · dias_atraso · valor_multa · valor_juros ·        │
   │               valor_total          ── FONTE ÚNICA de leitura            │
   │                                                                         │
   │   FUNC    data_corrente_da_operacao()          STABLE                   │
   │   FUNC    garantir_contador_de_cobranca(...)   SECURITY DEFINER         │
   │   FUNC    proximo_numero_de_cobranca(...)      SECURITY DEFINER         │
   └─────────────────────────────────────────────────────────────────────────┘
```

**Toda leitura de cobrança atravessa a view; nenhuma escrita atravessa.** A escrita vai na tabela, e
é a assimetria que torna a unicidade verificável: existe exatamente um lugar onde `status` e mora são
calculados, e ele é o único que as leituras alcançam.

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `negocio.cobranca` (tabela) | Guarda os **fatos** da cobrança e os **carimbos** do pagamento. Não guarda estado nem mora em aberto | Banco |
| `negocio.configuracao_de_mora` (tabela) | A política de multa e juros **de uma empresa**, uma linha por empresa | Banco |
| `negocio.cobranca_derivada` (view, `security_invoker`) | **Fonte única** do estado publicado e da mora. Derivação que participa de seleção (ADR-0023) | Banco |
| `negocio.data_corrente_da_operacao()` | Ponto único da data corrente da operação, imune ao fuso da sessão | Banco |
| `negocio.garantir_contador_de_cobranca()` · `proximo_numero_de_cobranca()` | Emissão do número da série, escopo `(empresa, ano)`, fora do desfazimento (ADR-0015/0020) | Banco |
| `packages/db/src/cobranca.ts` | Porta de dados da cobrança: cria, lista pela view, localiza, acusa pagamento, cancela, cancela em cascata | Dados |
| `packages/db/src/configuracao-de-mora.ts` | Porta de dados da configuração de mora: lê e grava (upsert por empresa) | Dados |
| `packages/db/src/derivacao-de-cobranca.ts` | **Função pura** que deriva as parcelas de um contrato (competência, vencimento, referência, valor) | Dados (puro) |
| `packages/contracts/src/cobranca.ts` | Esquema publicado da cobrança e dos corpos aceitos; forma do código legível | Contrato |
| `packages/contracts/src/configuracao-de-mora.ts` | Esquema publicado da configuração de multa e juros | Contrato |
| `apps/api/src/cobrancas/cobranca.service.ts` | Regra de aplicação: conferências, transições, tradução de conflito | Aplicação |
| `apps/api/src/cobrancas/cobranca.controller.ts` | As 5 rotas de `/v1/cobrancas`, declaração de exigência, envelope de resposta | Apresentação |
| `apps/api/src/mora/mora.service.ts` · `mora.controller.ts` | As 2 rotas de `/v1/multa-e-juros` | Aplicação / Apresentação |
| `apps/api/src/contratos/contrato.service.ts` (**modificado**) | Ativação gera as parcelas; cancelamento cancela em cascata | Aplicação |
| `deploy/scripts/caracterizacao/capturar.py` (**modificado**) | Captura do oráculo da régua com o despachante substituído | Caracterização |

### 3.3 Camadas e Fronteiras

Layered com **porta única de dado**, exatamente como as fatias anteriores, e a direção das
dependências não muda:

```
apresentação (controller)  →  aplicação (service)  →  dados (packages/db)  →  banco
        │                            │
        └──────────┬─────────────────┘
                   ▼
        contrato (@sysloc/contracts)   ← folha: não importa @sysloc/db
```

Três fronteiras que esta fatia estabelece ou herda:

1. **`@sysloc/contracts` continua folha.** Os enums `NATUREZAS_DE_COBRANCA` e `ESTADOS_DA_COBRANCA`
   nascem lá e o `packages/db` os consome para derivar os tipos do banco — a mesma direção, e pela
   mesma razão, de `ESTADOS_DO_CONTRATO`. Invertê-la faria o frontend arrastar a camada de dados ao
   importar os tipos no marco de entrega.
2. **`apps/api/src/contratos` passa a depender de `apps/api/src/cobrancas`.** A direção segue a do
   domínio (a cobrança é filha do contrato) e é o que torna a atomicidade da RN-06 um commit só, sem
   orquestrador novo nem barramento de evento (D4 do tech alignment).
3. **Nenhuma derivação de estado ou de mora existe em TypeScript.** É proibição declarada, e a §19
   a prova por asserção estática com falsificação — a mesma técnica que o `CT-413 (c)` da fatia
   anterior usou para a aritmética de datas.

### 3.4 Visão em Árvore

```
.
├── apps
│   └── api
│       ├── src
│       │   ├── app.module.ts                                    [M]
│       │   ├── cobrancas
│       │   │   ├── cobranca.controller.ts                       [N]
│       │   │   ├── cobranca.service.ts                          [N]
│       │   │   └── cobrancas.module.ts                          [N]
│       │   ├── mora
│       │   │   ├── mora.controller.ts                           [N]
│       │   │   ├── mora.service.ts                              [N]
│       │   │   └── mora.module.ts                               [N]
│       │   ├── contratos
│       │   │   ├── contrato.controller.ts                       [M]
│       │   │   ├── contrato.service.ts                          [M]
│       │   │   └── contratos.module.ts                          [M]
│       │   └── comum
│       │       ├── contexto-da-sessao.ts                        [R]
│       │       ├── esquema-de-erro.ts                           [R]
│       │       ├── esquema-publicado.ts                         [R]
│       │       └── validacao.ts                                 [R]
│       └── test
│           ├── cobrancas.e2e.spec.ts                            [N]  CT-511,514..516,518..520,529
│           ├── mora.e2e.spec.ts                                 [N]  CT-538, CT-539
│           ├── estado-de-fonte-unica.e2e.spec.ts                [N]  CT-510
│           ├── cobertura-de-autorizacao.e2e.spec.ts             [M]  CT-533
│           ├── contratos.e2e.spec.ts                            [M]  CT-508,509,530,531
│           └── autorizacao-do-dominio.e2e.spec.ts               [M]  CT-534
├── packages
│   ├── contracts
│   │   ├── src
│   │   │   ├── cobranca.ts                                      [N]
│   │   │   ├── configuracao-de-mora.ts                          [N]
│   │   │   ├── contrato.ts                                      [M]
│   │   │   ├── comum.ts                                         [R]
│   │   │   └── index.ts                                         [M]
│   │   └── test
│   │       ├── esquemas.spec.ts                                 [M]
│   │       └── folha.spec.ts                                    [R]
│   └── db
│       ├── migracoes
│       │   ├── 0009_dominio_cobranca.sql                        [N]
│       │   ├── 0010_seguranca_cobranca.sql                      [N]
│       │   ├── 0007_dominio_contrato.sql                        [R]
│       │   └── 0008_seguranca_contrato.sql                      [R]
│       ├── src
│       │   ├── cobranca.ts                                      [N]
│       │   ├── configuracao-de-mora.ts                          [N]
│       │   ├── derivacao-de-cobranca.ts                         [N]
│       │   ├── esquema
│       │   │   └── negocio.ts                                   [M]
│       │   ├── catalogo.ts                                      [R]
│       │   ├── contrato.ts                                      [R]
│       │   ├── derivacao-de-contrato.ts                         [R]
│       │   ├── unidade-de-trabalho.ts                           [R]
│       │   └── index.ts                                         [M]
│       └── test
│           ├── cobranca.spec.ts                                 [N]
│           ├── derivacao-de-cobranca.spec.ts                    [N]
│           ├── isolamento.spec.ts                               [M]
│           ├── catalogo.spec.ts                                 [M]
│           ├── coerencia-de-migracoes.spec.ts                   [M]
│           └── banco-efemero.ts                                 [R]
├── deploy
│   └── scripts
│       └── caracterizacao
│           ├── capturar.py                                      [M]
│           ├── verificar-captura.sh                             [M]
│           └── verificar-golden.sh                              [M]
└── docs
    └── specs
        └── features
            └── caracterizacao-regras-legadas
                └── v1
                    └── golden
                        ├── regua-de-cobranca.json               [N]
                        ├── PROCEDENCIA.md                       [M]
                        ├── calcular-mora.json                   [R]
                        ├── contrato-ativacao.json               [R]
                        ├── atualizar-atrasos-cobrancas.json     [R]
                        └── marcar-cobrancas-vencidas.json       [R]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/db/migracoes/0009_dominio_cobranca.sql` | **Gerada** por `drizzle-kit`: dois enums, duas tabelas, FKs compostas, `ENABLE RLS`, índices | Banco |
| `packages/db/migracoes/0010_seguranca_cobranca.sql` | **Autoral**: `FORCE RLS`, as duas políticas, `GRANT USAGE` nos enums, a view `security_invoker`, as três funções, `REVOKE`/`GRANT` | Banco |
| `packages/db/src/cobranca.ts` | Porta de dados da cobrança — a leitura vai na view, a escrita na tabela | Dados |
| `packages/db/src/configuracao-de-mora.ts` | Porta de dados da configuração de mora | Dados |
| `packages/db/src/derivacao-de-cobranca.ts` | Função pura `derivarParcelasDoContrato` — molde de `derivacao-de-contrato.ts` | Dados (puro) |
| `packages/contracts/src/cobranca.ts` | `NATUREZAS_DE_COBRANCA`, `ESTADOS_DA_COBRANCA`, formato do código, esquemas de entrada e saída | Contrato |
| `packages/contracts/src/configuracao-de-mora.ts` | Esquema da configuração de multa e juros | Contrato |
| `apps/api/src/cobrancas/cobranca.service.ts` | Regra de aplicação da cobrança | Aplicação |
| `apps/api/src/cobrancas/cobranca.controller.ts` | 5 rotas de `/v1/cobrancas` | Apresentação |
| `apps/api/src/cobrancas/cobrancas.module.ts` | Módulo Nest | Aplicação |
| `apps/api/src/mora/mora.service.ts` | Regra de aplicação da configuração de mora | Aplicação |
| `apps/api/src/mora/mora.controller.ts` | 2 rotas de `/v1/multa-e-juros` | Apresentação |
| `apps/api/src/mora/mora.module.ts` | Módulo Nest | Aplicação |
| `docs/.../golden/regua-de-cobranca.json` | Oráculo capturado da régua, incluindo a divergência de estado do legado | Caracterização |
| `packages/db/test/*.spec.ts` · `apps/api/test/*.e2e.spec.ts` | Ver §19 — **a árvore da §3.4 nomeia o CT que cada arquivo hospeda**, e nenhum arquivo é criado sem caso | Teste |

> **Nenhum arquivo de teste nasce vazio.** A derivação de mora **não** ganha suíte própria em
> `packages/db/test/`: ela é propriedade da view, e a view se prova em `cobranca.spec.ts`
> (CT-524 a CT-528), onde o dado que a exercita já existe. Suíte separada por assunto, e não por
> objeto sob teste, duplicaria a montagem do cenário e criaria a duplicação cross-layer (AP-23) que a
> própria §19 recusa noutro ponto.

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/db/src/esquema/negocio.ts` | Acrescenta `naturezaCobranca`, `statusCobranca`, `cobranca`, `configuracaoDeMora` | O schema é a fonte da migração gerada |
| `packages/db/src/index.ts` | Publica as duas portas novas e `derivarParcelasDoContrato` | O índice é auditado por igualdade pelo `CT-012` |
| `packages/contracts/src/index.ts` | Publica os símbolos novos, um a um (nunca `export *`) | Superfície declarada do pacote |
| `packages/contracts/src/contrato.ts` | `efeitos.cobrancasGeradas` deixa de ser `z.literal(false)` e passa a `z.number().int().nonnegative()` | **Fecha o D28** — o débito existe justamente para obrigar esta edição |
| `apps/api/src/contratos/contrato.service.ts` | `ativar` gera as parcelas na mesma unidade; `cancelar` cancela em cascata; **remove o marcador do D28** | RN-06, RN-13; o marcador sai no mesmo commit |
| `apps/api/src/contratos/contrato.controller.ts` | A ativação abre a unidade que garante o contador da série de cobrança antes da unidade principal | ADR-0015/0020 — a sequência precisa estar commitada |
| `apps/api/src/contratos/contratos.module.ts` | Importa `CobrancasModule` | A ativação chama a porta de cobrança |
| `apps/api/src/app.module.ts` | Registra `CobrancasModule` e `MoraModule` | Publicação das rotas |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Âncora de contagem 75 → **82** rotas e 60 → **67** manipuladores; as 7 rotas novas com exigência conferida por conteúdo | ADR-0011/0018 |
| `apps/api/test/contratos.e2e.spec.ts` | O caso da ativação passa a esperar `cobrancasGeradas: N` | Crescimento de esquema |
| `packages/db/test/{isolamento,catalogo,coerencia-de-migracoes}.spec.ts` | As duas tabelas novas entram nas varreduras de RLS forçada e de coerência | ADR-0008/0009 |
| `deploy/scripts/caracterizacao/capturar.py` | Captura da régua com o despachante substituído por registrador | CA-01 |
| `deploy/scripts/caracterizacao/verificar-captura.sh` · `verificar-golden.sh` | Cobrem o golden novo | Rede do oráculo |
| `docs/.../golden/PROCEDENCIA.md` | Registra a captura da régua e retira a declaração de "fora do escopo desta captura" | Procedência |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `packages/db/migracoes/0007_dominio_contrato.sql` | Molde da migração gerada e da separação gerado × autoral |
| `packages/db/migracoes/0008_seguranca_contrato.sql` | Molde literal do `FORCE`, das políticas e das duas funções `SECURITY DEFINER` — **inclui um `DECISÃO FECHADA`** sobre não conceder a sequência |
| `packages/db/src/derivacao-de-contrato.ts` | Molde da função pura de datas: sem biblioteca, UTC, **nunca `Date.UTC`**, **nunca `new Date(a,m,d)`** |
| `packages/db/src/contrato.ts` | Molde da porta: projeção de colunas, predicado, tradução de conflito, emissão do número |
| `packages/db/src/unidade-de-trabalho.ts` | Dois `DECISÃO FECHADA`: recusa de aninhamento e `SET LOCAL` sempre emitido |
| `packages/contracts/src/contrato.ts` | `DECISÃO FECHADA` da largura do sequencial — o precedente que a largura 7 da cobrança segue |
| `packages/contracts/src/comum.ts` | `ESQUEMA_DO_IDENTIFICADOR`, `esquemaDaJanela`, `envelopeDeLista`, `MAIOR_TEXTO_CURTO`, `MAIOR_PAGINA` — ⚠️ **as constantes monetárias NÃO estão aqui** |
| `packages/contracts/src/contrato.ts` (2ª razão) | **`MAIOR_VALOR_MONETARIO` (L163) e `ESCALA_MONETARIA` (L193)** — é daqui que `cobranca.ts` as importa; redefini-las repetiria a forma do débito D3 (§6.1) |
| `packages/auth/src/catalogo-de-permissoes.ts` | Catálogo **fechado** — nenhuma chave nasce nesta fatia |
| `apps/api/src/comum/{validacao,esquema-de-erro,esquema-publicado,contexto-da-sessao}.ts` | Pontos únicos de validação, envelope de erro, esquema publicado e contexto |
| `packages/shared/src/erros.ts` | `CodigoErro` e `ErroDeAplicacao` |
| `docs/.../golden/calcular-mora.json` | **Oráculo da mora** — 6 casos, 9 invocações, fórmula declarada |
| `docs/.../golden/contrato-ativacao.json` | **Oráculo das parcelas** — 3 cenários, incluindo o discriminador da saturação iterativa |
| `docs/.../golden/atualizar-atrasos-cobrancas.json` · `marcar-cobrancas-vencidas.json` | Comportamento das rotinas noturnas que esta fatia **deixa de precisar** |
| `packages/db/test/derivacao-de-contrato.spec.ts` | Molde de suíte contra golden, com âncora de contagem por bloco |
| `.claude/rules/nao-regressao.md` · `.claude/rules/testing-stack.md` | Protocolo e doutrina de teste |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Todos sob o prefixo `/v1`. Autenticação por **sessão** (`better-auth`), como toda a superfície do
produto. A coluna `Auth` traz a **declaração de exigência** que a guarda de cobertura confere por
conteúdo (ADR-0011/0018).

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Lança cobrança avulsa | `POST` | `/v1/cobrancas` | `esquemaDeCobrancaNova` (fechado, 6 campos) | `esquemaDaCobranca` | 201, 401, 403, 404, 422 | `TELA:financeiro` |
| Lista a carteira | `GET` | `/v1/cobrancas` | — (consulta: `limite`, `deslocamento`, `contrato?`, `status?`, `natureza?`) | `envelopeDeLista(esquemaDaCobranca)` | 200, 401, 403, 422 | `TELA:financeiro` |
| Lê uma cobrança | `GET` | `/v1/cobrancas/:codigo` | — | `esquemaDaCobranca` | 200, 401, 403, 404, 422 | `TELA:financeiro` |
| Acusa pagamento | `POST` | `/v1/cobrancas/:codigo/pagamento` | `esquemaDoPagamentoDeCobranca` (2 campos) | `esquemaDaCobranca` | 200, 401, 403, 404, 422 | `TELA:financeiro` |
| Cancela | `POST` | `/v1/cobrancas/:codigo/cancelamento` | `{}` (corpo vazio e fechado) | `esquemaDaCobranca` | 200, 401, 403, 404, 422 | `TELA:financeiro` |
| Lê a política de mora | `GET` | `/v1/multa-e-juros` | — | `esquemaDaConfiguracaoDeMora` | 200, 401, 403 — **nunca 404** | `TELA:multa_e_juros` |
| Define a política de mora | `PUT` | `/v1/multa-e-juros` | `esquemaDaConfiguracaoDeMoraNova` (2 campos) | `esquemaDaConfiguracaoDeMora` | 200, 401, 403, 422 | `TELA:multa_e_juros` |

**Nenhuma rota exige chave de ação.** A classificação e a evidência que a sustenta estão na §11.2.
**Nenhuma rota de emissão de boleto, de baixa bancária, de retirada de circulação ou de recirculação
existe nesta fatia** — as duas primeiras são F4; as duas últimas não existem porque a cobrança não
tem ato de exclusão a traduzir (§11.2 e §21).

**Superfície resultante**: 75 → **82 rotas**, 60 → **67 manipuladores**, `semDeclaracao` continua
vazio. ⚠️ A âncora do `HEAD` derivado permanece **suprimida** pelo módulo de cobertura — não "corrija"
para 89.

### 4.1.1 Exemplo de Payload por Endpoint

> **Não há atualização parcial nesta superfície.** As duas rotas com corpo de conteúdo (`POST
> /v1/cobrancas` e `PUT /v1/multa-e-juros`) usam `strictObject` **completo e sem campo opcional**:
> campo ausente é recusa por campo obrigatório, **nunca** "preserve o valor atual". É a mesma decisão
> da fatia de contratos, e ela é o que impede o defeito do `PUT` parcial que copia `required` do
> `POST`. Nenhum `Request` desta fatia admite corpo parcial.

```
POST /v1/cobrancas
{
  "contratoCodigo": "CTR-2026-00007",
  "natureza": "AGUA",
  "referencia": "Conta de água — 03/2026",
  "competencia": "2026-03-01",
  "dataVencimento": "2026-03-10",
  "valorOriginal": 187.42
}
→ 201
{
  "codigo": "COB-2026-0000059",
  "contratoCodigo": "CTR-2026-00007",
  "locatarioId": "8f1c…",          ← DERIVADO do contrato; nunca aceito no corpo
  "natureza": "AGUA",
  "referencia": "Conta de água — 03/2026",
  "competencia": "2026-03-01",
  "dataVencimento": "2026-03-10",
  "valorOriginal": 187.42,
  "status": "A_VENCER",            ← DERIVADO
  "diasAtraso": 0,                 ← DERIVADO
  "valorMulta": 0,                 ← DERIVADO
  "valorJuros": 0,                 ← DERIVADO
  "valorTotal": 187.42,            ← DERIVADO
  "pagoEm": null, "valorPago": null, "canceladoEm": null,
  "multaPercentualAplicado": null, "jurosPercentualAplicado": null
}

POST /v1/cobrancas/COB-2026-0000059/pagamento
{ "pagoEm": "2026-03-25", "valorPago": 191.30 }
→ 200  (status: "PAGA"; valorMulta/valorJuros passam a ser os CARIMBOS gravados)

POST /v1/cobrancas/COB-2026-0000059/cancelamento
{}
→ 200  (status: "CANCELADA"; a cobrança segue legível e uma substituta pode ser criada)

PUT /v1/multa-e-juros
{ "multaPercentual": 2, "jurosPercentual": 1 }
→ 200
{ "multaPercentual": 2, "jurosPercentual": 1 }

GET /v1/multa-e-juros                      ← empresa que NUNCA configurou
→ 200
{ "multaPercentual": 0, "jurosPercentual": 0 }   ← RD-21: nunca 404, e nenhuma linha é criada
```

`POST /v1/contratos/:codigo/ativacao` **não muda de forma**, e muda de conteúdo:

```
→ 200
{ …contrato…, "efeitos": { "cobrancasGeradas": 12 } }     ← era `false`, literal (D28)
```

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `esquemaDeCobrancaNova` | `packages/contracts/src/cobranca.ts` (Zod, `strictObject`) | `contratoCodigo`, `natureza`, `referencia`, `competencia`, `dataVencimento`, `valorOriginal` | v1 |
| `esquemaDaCobranca` | idem | os 6 acima + `codigo`, `locatarioId`, `status`, `diasAtraso`, `valorMulta`, `valorJuros`, `valorTotal`, `pagoEm`, `valorPago`, `canceladoEm`, `multaPercentualAplicado`, `jurosPercentualAplicado` | v1 |
| `esquemaDoPagamentoDeCobranca` | idem | `pagoEm` (`z.iso.date()`), `valorPago` | v1 |
| `esquemaDaJanelaDeCobrancas` | idem, derivado de `esquemaDaJanela` | `limite`, `deslocamento`, `contrato?`, `status?`, `natureza?` | v1 |
| `esquemaDaConfiguracaoDeMoraNova` | `packages/contracts/src/configuracao-de-mora.ts` | `multaPercentual`, `jurosPercentual` | v1 |
| `esquemaDaConfiguracaoDeMora` | idem | os 2 acima | v1 |
| `esquemaDaAtivacaoDeContrato` (**alterado**) | `packages/contracts/src/contrato.ts` | `efeitos.cobrancasGeradas: z.number().int().nonnegative()` | v1 |

Pela **ADR-0016**, o documento OpenAPI e a conferência de entrada **derivam** desses esquemas
(`esquemaPublicado(...)`); nenhuma descrição é escrita à mão em paralelo.

**Os campos de conciliação bancária (F4) não aparecem em nenhum esquema publicado.** Eles nascem como
colunas nulas (§7.2) e **só a F4** os publica — é o molde `D1` do discovery, e é ele que obriga a F4 a
tocar o contrato em vez de mudar o significado da resposta por omissão.

### 4.3 Eventos Publicados / Consumidos

**N/A — nenhum.** Esta fatia não enfileira tarefa de negócio e não consome fila. O débito **D32**
(`apps/worker/src/fila.ts`) tem por gatilho *"a primeira fatia que enfileirar tarefa de negócio"*, e
essa é a **fatia 2** (a régua). O marcador do D32 **não é tocado aqui**.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**A · O Admin Empresa define a política de mora** (`PUT /v1/multa-e-juros`)

1. `MoraController` — a guarda confere `TELA:multa_e_juros`; `validar(esquemaDaConfiguracaoDeMoraNova, corpo, 'corpo')`.
2. `sobContextoDaSessao` abre a unidade de trabalho e emite `SET LOCAL app.empresa_id`.
3. `MoraService.definir(tx, entrada)` → `gravarConfiguracaoDeMora(tx, entrada)` — `INSERT … ON
   CONFLICT (empresa_id) DO UPDATE`, um só ida ao banco. A RLS cuida do escopo; o `empresa_id` sai do
   contexto, **nunca do corpo**.
4. Resposta 200 com a configuração vigente. **Nenhuma cobrança é reescrita** — a mora em aberto é
   derivada e passa a refletir a política nova na leitura seguinte (CA-14); a mora já carimbada não
   muda (CA-08).

**B · O operador ativa um contrato e as parcelas nascem** (`POST /v1/contratos/:codigo/ativacao`)

1. `ContratoController.ativar` — guarda confere `TELA:contratos` **e** `ACAO:ativar_contrato`.
2. **Primeira unidade de trabalho**: lê o ano do relógio do banco, garante o contador do contrato
   (já existente) **e** o contador da cobrança (`garantirContadorDeCobranca`). Ela **commita antes**
   da segunda abrir — sem isso, o desfazimento apagaria a sequência recém-criada e o número seria
   reusado, contra a ADR-0015. As duas unidades **não aninham** (o `DECISÃO FECHADA` de
   `unidade-de-trabalho.ts` não é tocado).
3. **Segunda unidade**, um commit só:
   1. `ContratoService.ativar` confere estado (`RASCUNHO`), as seis condições de entrada e a
      circulação dos cadastros referenciados — inalterado;
   2. deriva `dataFimLocacao` e `valorTotalContrato` pelas funções puras já existentes;
   3. grava a transição `RASCUNHO → ATIVO` e ocupa o imóvel (`LOCADO`) — inalterado;
   4. **novo**: `derivarParcelasDoContrato(...)` devolve N parcelas puras;
   5. **novo**: `emitirNumerosDeCobranca(tx, ano, N)` consome N números da série;
   6. **novo**: `criarCobrancasEmLote(tx, contratoId, parcelas, numeros)` — um `INSERT` com N linhas.
4. Resposta 200 com `efeitos.cobrancasGeradas: N`.

> **A atomicidade da RN-06 sai do commit único que já existia** — nenhum mecanismo novo. Recusa em
> qualquer etapa deixa o contrato `RASCUNHO`, o imóvel como estava e **zero parcelas** (CA-03). Os
> números consumidos da série **não voltam**, e o furo é o que a ADR-0015 aceita por escrito.

**F · O operador lança uma cobrança avulsa** (`POST /v1/cobrancas`)

> Este fluxo serve **as duas** entradas de cobrança avulsa: a de natureza ≠ `ALUGUEL` (US-04) e a
> **substituta** de uma cancelada (fluxo E). As duas são o mesmo `POST`, e nenhuma delas passa pela
> ativação — daí a razão de o fluxo existir escrito.

1. `CobrancaController.criar` — a guarda confere `TELA:financeiro`;
   `validar(esquemaDeCobrancaNova, corpo, 'corpo')`.
2. **Primeira unidade de trabalho**: lê o ano do relógio do banco e chama
   `garantirContadorDeCobranca`. Ela **commita antes** de a segunda abrir — molde literal de
   `contrato.controller.ts` (`criar`), e pela mesma razão: sem o commit, uma criação abortada
   desfaria a sequência recém-nascida e o número seria reusado, contra a ADR-0015/0020.
3. **Segunda unidade**, um commit só: `CobrancaService.criar` localiza o contrato pelo código
   (`404` se inalcançável, `422` se retirado de circulação), consome um número da série
   (`proximo_numero_de_cobranca`) e grava a linha. O `locatarioId` **não** é gravado — ele é derivado
   na leitura (§6.2), de modo que a resposta sai da view.
4. Resposta 201 com a cobrança já derivada.

> **A primeira cobrança de uma empresa num ano pode nascer por AQUI, e não pela ativação.** É o que
> torna a primeira unidade obrigatória nesta rota também: `proximo_numero_de_cobranca` não cria
> sequência — ele a consome. Omitir o passo faria a rota falhar exatamente no caso mais banal (empresa
> nova, primeira cobrança avulsa do ano), e a falha só apareceria em produção.

**C · O operador lê a carteira** (`GET /v1/cobrancas`)

1. Guarda confere `TELA:financeiro`; `validar(esquemaDaJanelaDeCobrancas, consulta, 'limite')`.
2. `listarCobrancas(tx, janela, filtros)` — `SELECT … FROM negocio.cobranca_derivada WHERE …
   ORDER BY data_vencimento, codigo LIMIT … OFFSET …`. O filtro por `status` é **predicado SQL sobre a
   coluna derivada**, e é exatamente essa possibilidade que justifica a ADR-0023.
3. O envelope traz a janela **de fato servida** e o `total` da empresa inteira (ADR-0017).

**D · O operador acusa o pagamento** (`POST /v1/cobrancas/:codigo/pagamento`)

1. Guarda confere `TELA:financeiro`; `validar(...)`; `sobContextoDaSessao`.
2. `CobrancaService.acusarPagamento(tx, codigo, entrada)`:
   1. `localizarCobranca(tx, codigo)` — **lê a view**, de modo que `status`, `valorMulta` e
      `valorJuros` chegam já derivados pela política vigente;
   2. `exigirEstado(atual, ESTADOS_PAGAVEIS, PAGAMENTO)` — `A_VENCER` ou `VENCIDA`;
   3. `acusarPagamentoDeCobranca(tx, codigo, { pagoEm, valorPago })` grava, **na mesma instrução**,
      `pago_em`, `valor_pago` e os **quatro carimbos** calculados pela **mesma expressão da view**,
      referenciada pelo mesmo ponto único (§6.3, RD-04).
3. Resposta 200. **Nenhum campo de conciliação bancária é tocado** — divergência declarada contra o
   sistema antigo, que zera seis deles (CA-16, RN-15).

**E · O operador cancela e emite substituta**

1. `POST /v1/cobrancas/:codigo/cancelamento` — `exigirEstado(atual, ESTADOS_CANCELAVEIS, CANCELAMENTO)`
   (`A_VENCER` ou `VENCIDA`), `UPDATE … SET cancelado_em = now()`.
2. A cobrança **permanece legível** e continua ocupando o código na unicidade `(empresa_id, codigo)`.
3. A substituta é um `POST /v1/cobrancas` comum, com número novo. **Não há vínculo explícito com a
   cancelada** — decisão registrada na §21.

### 5.2 Fluxos Alternativos

- **Cobrança que não é aluguel** — `POST /v1/cobrancas` com `natureza` em `{AGUA, CONDOMINIO, ENERGIA,
  OUTRO}`. A distinção é **de domínio**, não de texto: somar por tipo é `GROUP BY natureza`, sem
  interpretar `referencia` (CA-06).
- **Vencimento sem ação de ninguém** — passada a data, a leitura seguinte já devolve `VENCIDA`, porque
  o predicado é `data_vencimento < negocio.data_corrente_da_operacao()`. **Nenhuma rotina existe nesta
  fatia**, e é essa ausência que o CA-05 exige (§19).
- **Mudança de política com cobranças em aberto** — a leitura seguinte de toda cobrança em aberto
  reflete a política nova (CA-14); as pagas exibem os carimbos e não se movem (CA-08).
- **Empresa sem configuração de mora** — caso alcançável no primeiro dia de uma empresa nova, e ele
  aparece em **dois** lugares, com a mesma resposta nos dois. Na apuração, o `LEFT JOIN` com
  `COALESCE(…, 0)` dá **mora zero**: `valorTotal = valorOriginal` (§6.3, RD-08). Na leitura da
  política, `GET /v1/multa-e-juros` devolve **200 com `{ multaPercentual: 0, jurosPercentual: 0 }`** —
  **nunca 404 e nunca criando a linha** (RD-21). Nunca cobra o que ninguém configurou, e nunca falha
  por ausência de linha.
- **Contrato cancelado** — as cobranças dele que estão `A_VENCER` ou `VENCIDA` passam a `CANCELADA`
  na **mesma unidade** do cancelamento do contrato; as pagas e as já canceladas ficam como estavam
  (CA-15). Sendo o estado derivado, o predicado é literalmente `pago_em IS NULL AND cancelado_em IS
  NULL` — a regra de negócio e o predicado SQL coincidem, sem tradução.
- **Contrato com `gerarCobrancasAutomaticamente = false`** — a ativação **não gera parcela alguma** e
  responde `efeitos.cobrancasGeradas: 0`. O campo já existe na tabela `contrato` desde a F2 e até aqui
  não tinha consumidor; este é ele.
- **Sem alcance à área** — 403 com o envelope da ADR-0017, e nenhuma escrita acontece (CA-17).

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | Captura fora da API — `deploy/scripts/caracterizacao/capturar.py` contra site efêmero | `capturar.py`, `verificar-captura.sh`, `golden/regua-de-cobranca.json` |
| US-02 | Fluxo **B** — `POST /v1/contratos/:codigo/ativacao` | `ContratoService.ativar`, `derivarParcelasDoContrato`, `criarCobrancasEmLote`, `proximo_numero_de_cobranca` |
| US-03 | Fluxos **C**, **D**, **E** — toda leitura atravessa `negocio.cobranca_derivada` | view `cobranca_derivada`, `packages/db/src/cobranca.ts` |
| US-04 | `POST /v1/cobrancas` com `natureza` ≠ `ALUGUEL` | `esquemaDeCobrancaNova`, enum `natureza_cobranca` |
| US-05 | Fluxo **D** — `POST /v1/cobrancas/:codigo/pagamento` | `CobrancaService.acusarPagamento`, carimbos |
| US-06 | Fluxo **E** — `POST /v1/cobrancas/:codigo/cancelamento` + `POST /v1/cobrancas` | `CobrancaService.cancelar`, série declarada |
| US-07 | Fluxo **A** — `PUT /v1/multa-e-juros` | `MoraService`, `negocio.configuracao_de_mora`, RLS |
| US-08 | Fluxo **C** — mora derivada na view | expressões de multa e juros em `numeric` |
| US-09 | Fluxos **A** + **D** — carimbo no pagamento | colunas de carimbo, ADR-0022 |
| US-10 | `POST /v1/contratos/:codigo/cancelamento` | `ContratoService.cancelar`, `cancelarCobrancasDoContrato` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| `contratoCodigo` na forma canônica (`trim` → maiúsculas → `CTR-\d{4}-\d{5}`) | `esquemaDeCobrancaNova`, via `ESQUEMA_DO_CODIGO_DE_CONTRATO` importado | `422 CAMPO_INVALIDO`, `campo: "contratoCodigo"` |
| `codigo` da cobrança na forma canônica (`COB-\d{4}-\d{7}`) | caminho da rota, via `ESQUEMA_DO_CODIGO_DE_COBRANCA` | `422 CAMPO_INVALIDO`, `campo: "codigo"` |
| `natureza` ∈ lista fechada de 5 | `z.enum(NATUREZAS_DE_COBRANCA)` | `422 CAMPO_INVALIDO`, `campo: "natureza"` |
| `referencia` não vazia, ≤ `MAIOR_TEXTO_CURTO` (200) | `esquemaDeCobrancaNova` | `422 CAMPO_INVALIDO`, `campo: "referencia"` |
| `competencia` é o **1º dia do mês** (`z.iso.date()` + `refine`) | `esquemaDeCobrancaNova` | `422 CAMPO_INVALIDO`, `campo: "competencia"` |
| `valorOriginal > 0`, ≤ `MAIOR_VALOR_MONETARIO`, múltiplo de `ESCALA_MONETARIA` | `esquemaDeCobrancaNova` | `422 CAMPO_INVALIDO`, `campo: "valorOriginal"` |
| `valorPago > 0`, ≤ `MAIOR_VALOR_MONETARIO`, múltiplo de `ESCALA_MONETARIA` | `esquemaDoPagamentoDeCobranca` | `422 CAMPO_INVALIDO`, `campo: "valorPago"` |
| `multaPercentual` e `jurosPercentual` em `[0, 100]`, escala 0.01 | `esquemaDaConfiguracaoDeMoraNova` | `422 CAMPO_INVALIDO`, nomeando o campo |
| Chave desconhecida no corpo | `strictObject` em todos os corpos | `422 CAMPO_INVALIDO`, `campo: "corpo"` |
| `status` e `natureza` da consulta ∈ lista fechada | `esquemaDaJanelaDeCobrancas` | `422 CAMPO_INVALIDO`, `campo: "limite"` (campo padrão da consulta) |
| `limite` acima do teto (`MAIOR_PAGINA`) | `esquemaDaJanela` herdado | **recusa**, nunca trunca em silêncio |

> **De onde vem cada símbolo importado, medido no código — e por que isto está escrito.**
> `MAIOR_TEXTO_CURTO`, `MAIOR_PAGINA`, `ESQUEMA_DO_IDENTIFICADOR`, `esquemaDaJanela` e
> `envelopeDeLista` vêm de `packages/contracts/src/comum.ts`. Mas **`MAIOR_VALOR_MONETARIO` e
> `ESCALA_MONETARIA` NÃO estão em `comum.ts`** — as duas vivem em
> `packages/contracts/src/contrato.ts` (linhas 163 e 193), onde nasceram na F2. `cobranca.ts` **as
> importa de `./contrato.js`**, e não redefine nenhuma delas.
>
> A advertência não é ornamento: `comum.ts` é o lugar onde um implementador procuraria primeiro, e
> não achar lá é exatamente o que produz a segunda definição. O projeto já tem essa forma anotada
> como débito aberto — o **D3 (F2/T1)**, *"`ESQUEMA_DO_IDENTIFICADOR` tem duas definições"*. Repetir
> a forma com constante monetária seria pior, porque duas escalas que divergem passam a recusar
> valores diferentes na mesma superfície.
>
> A promoção das duas para `comum.ts` **não acontece nesta fatia** (tocaria um arquivo estável, com
> marcador, fora do que o PRD pede). Ela fica agendada por `DÉBITO COM GATILHO` — ver §21.

**Campos ausentes do corpo, e a ausência é o mecanismo**: `codigo`, `locatarioId`, `status`,
`diasAtraso`, `valorMulta`, `valorJuros`, `valorTotal`, `pagoEm`, `valorPago`, `canceladoEm`, os
carimbos, os seis de conciliação e `empresaId`. Todos são decididos pelo servidor, e o `strictObject`
converte a tentativa em recusa por chave desconhecida — o mesmo mecanismo que a fatia de contratos usa
para `status`.

### 6.2 Transformações de Dados

- **Canonização de código** — `trim` → `toUpperCase` no ponto único do esquema. É a mesma razão medida
  da fatia anterior: o código viaja no caminho da URL e é comparado com o valor gravado; um
  `cob-2026-0000059` em minúsculas produziria `404` sobre um registro que existe.
- **Datas como cadeia** — `competencia`, `dataVencimento` e `pagoEm` viajam como `YYYY-MM-DD` da
  consulta ao JSON, projetadas por `to_char(coluna, 'YYYY-MM-DD')`, **sem passar por `Date` com
  fuso**. `canceladoEm` é `timestamptz` e viaja como ISO-8601.
- **Dinheiro** — `numeric(15,2)` no banco; a projeção converte para `number` na borda, e os esquemas
  de **saída** não restringem escala (a assimetria deliberada que o `DECISÃO FECHADA` de `comum.ts`
  registra: esquema de saída que recusa **não produz 422**, ele derruba a rota).
- **`locatarioId` é derivado** — sai da junção `cobranca → contrato → locatario_id`, nunca de coluna
  própria. É o que torna **estruturalmente impossível** a incoerência que a FK dupla do legado permite.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RD-01 | RN-01 | Toda cobrança tem exatamente um `contrato_id`, com FK composta `(contrato_id, empresa_id)`. O locatário é **derivado** do contrato; não existe coluna própria | `404` se o contrato não é alcançável no contexto |
| RD-02 | RN-02 | O código é `COB-{ano}-{7 dígitos}`, emitido por contador do banco de escopo `(empresa, ano)`, fora do desfazimento. Furo aceito; número nunca reusado | `409 → 422 CAMPO_INVALIDO` com `detalhes.conflito` em colisão |
| RD-03 | RN-03 | `natureza` é enum fechado de 5 valores; `referencia` é texto livre. São campos **distintos** | `422` nomeando o campo |
| RD-04 | RN-04 · RN-05 | `status` = `CANCELADA` se `cancelado_em` não nulo; senão `PAGA` se `pago_em` não nulo; senão `VENCIDA` se `data_vencimento < data_corrente`; senão `A_VENCER`. **Avaliado num lugar só**: a view | — |
| RD-05 | RN-06 | A ativação gera N parcelas na **mesma unidade de trabalho**; recusa não deixa parcela | herda a recusa da ativação |
| RD-06 | RN-07 | O dia de vencimento vem do contrato e o `check` do banco já o limita a `[1, 28]` — **não satura nunca** | — |
| RD-07 | RN-08 | `multa = round(valorOriginal × multaPct/100, 2)`; `juros = round(valorOriginal × (jurosPct/100) / 30 × diasAtraso, 2)`; `total = round(valorOriginal + multa + juros, 2)`. Juros **simples**, base **mês comercial de 30 dias**, **não incidem sobre a multa** | — |
| RD-08 | RN-08 · RN-11 | Empresa sem configuração de mora apura **zero** (`COALESCE`), nunca falha | — |
| RD-09 | RN-09 | No pagamento gravam-se `multa_aplicada`, `juros_aplicados`, `multa_percentual_aplicado`, `juros_percentual_aplicado`, e eles não mudam mais | — |
| RD-10 | RN-10 | Alterar a política **não escreve em cobrança alguma**. Alcança o que está aberto por ser derivado, e não alcança o liquidado por estar carimbado | — |
| RD-11 | RN-11 | A configuração é uma linha por empresa, sob RLS forçada. A de uma nunca alcança outra | — |
| RD-12 | RN-12 | Nenhum caminho apaga cobrança. Não existe `DELETE`, não existe rota de exclusão | — |
| RD-13 | RN-13 | Cancelar contrato cancela as cobranças com `pago_em IS NULL AND cancelado_em IS NULL` | — |
| RD-14 | RN-14 | Pagamento e cancelamento exigem **apenas** `TELA:financeiro` (§11.2) | `403 ACESSO_NEGADO` |
| RD-15 | RN-15 | Acusar pagamento **não toca** nenhum dos 6 campos de conciliação. Divergência declarada | — |
| RD-16 | RN-16 | Toda a aritmética monetária corre em `numeric`; **nenhum valor monetário derivado passa por ponto flutuante** | — |
| RD-17 | RN-17 | **Sem materialização nesta fatia** — ver §21 | — |
| RD-18 | — | As parcelas nascem com `natureza = ALUGUEL` e `referencia` no formato `DD/MM/YYYY à DD/MM/YYYY` do oráculo | — |
| RD-19 | — | O início de cada período é **iterativo com saturação**: `inicio[i] = addMeses(inicio[i-1], 1)`. Para `2027-01-31` os inícios são `31/01`, `28/02`, `28/03` — **não** `31/03` no terceiro | — |
| RD-20 | — | `gerarCobrancasAutomaticamente = false` no contrato ⇒ ativação gera **zero** parcelas | — |
| RD-21 | RN-11 | Empresa sem linha de configuração **lê** `{ multaPercentual: 0, jurosPercentual: 0 }` com `200`. A ausência de linha e a configuração explicitamente zerada são **a mesma coisa publicada**, e é o que faz a leitura concordar com a apuração (RD-08). A leitura **não cria linha** — `GET` não escreve | — |

> **RD-07 tem UM arredondamento por parcela, e a posição dele é conteúdo.** O oráculo arredonda a
> multa, arredonda os juros e arredonda o total — três `round`, e **nenhum** nos passos intermediários
> do cálculo dos juros. Arredondar `valorOriginal × jurosPct/100` antes de dividir por 30 muda o
> resultado: `1234.56` a 17 dias sairia de `7,00` para `7,02`. O `numeric` do PostgreSQL leva a divisão
> a 16+ dígitos significativos, de modo que a forma declarada é exata; a forma equivalente de divisão
> única (`valor_original × juros_percentual × dias_atraso / 3000`) é admissível **desde que provada
> contra o golden**, e nunca por parecer mais limpa. `round(numeric, 2)` do PostgreSQL arredonda
> **meio para longe do zero**, que é o `ROUND_HALF_UP` que o oráculo declara — não é o modo bancário,
> e a coincidência precisa ser afirmada, não presumida.

> **A fronteira estrita de RD-04 é decisão do produto, e o oráculo NÃO a determina.** Medido: o
> golden `marcar-cobrancas-vencidas.json` tem os deslocamentos `-12`, `-3`, `+15` e `-40` — e
> **nenhum `0`**. Vencer *hoje* é o único ponto em que `<` e `<=` discordam, e o legado não foi
> perguntado sobre ele. Esta spec escolhe `<`: quem vence hoje ainda está em dia, e com `<=` a multa
> integral incidiria no próprio dia do vencimento, com `dias_atraso = 0` — cobrar 2% por zero dia de
> atraso. A escolha é registrada como **divergência não medida**, e não como porte; o CT-513 a prova
> como decisão desta fatia, não como reprodução do oráculo.

> **RD-19 é o discriminador do golden e o ponto mais fácil de errar da fatia.** A forma intuitiva
> (`addMeses(inicioOriginal, i)`) produz `31/03/2027` no terceiro período e **passa** em todo cenário
> cujo dia de início seja ≤ 28. Só os dois cenários iniciados em `2027-01-31` a reprovam.

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

Relacional — **PostgreSQL 18**, schema `negocio`, acessado por `postgres.js` sob Drizzle. Papel de
aplicação `sysloc_app`, sujeito a RLS **forçada**; papel de migração `sysloc_migracao`, dono dos
objetos e dos quais o `SECURITY DEFINER` toma direitos.

### 7.2 Tabelas / Coleções

**`negocio.cobranca`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | chave interna; **não trafega** (ADR-0017) |
| `empresa_id` | `uuid NOT NULL` | ADR-0008 |
| `codigo` | `text NOT NULL` | `COB-{ano}-{7 dígitos}` — chave exposta |
| `contrato_id` | `uuid NOT NULL` | FK composta |
| `natureza` | `negocio.natureza_cobranca NOT NULL` | enum de 5 |
| `referencia` | `text NOT NULL` | rótulo livre |
| `competencia` | `date NOT NULL` | 1º dia do mês |
| `data_vencimento` | `date NOT NULL` | fato |
| `valor_original` | `numeric(15,2) NOT NULL` | fato |
| `pago_em` | `date` | fato (nulo = não paga) |
| `valor_pago` | `numeric(15,2)` | fato |
| `cancelado_em` | `timestamptz` | fato (nulo = não cancelada) |
| `multa_aplicada` | `numeric(15,2)` | **carimbo** (ADR-0022) |
| `juros_aplicados` | `numeric(15,2)` | **carimbo** |
| `multa_percentual_aplicado` | `numeric(5,2)` | **carimbo da configuração vigente** |
| `juros_percentual_aplicado` | `numeric(5,2)` | **carimbo da configuração vigente** |
| `nosso_numero`, `linha_digitavel`, `codigo_barras` | `text` | **conciliação F4** — nascem nulos, sem rota |
| `data_credito` | `date` | idem |
| `valor_creditado` | `numeric(15,2)` | idem |
| `boleto_arquivo` | `text` | idem — é o `pdf_boleto_arquivo` medido no legado |

Restrições e índices:

| Nome | Definição |
|---|---|
| `cobranca_id_empresa_key` | `UNIQUE (id, empresa_id)` — alvo de FK composta futura |
| `cobranca_empresa_codigo_key` | `UNIQUE (empresa_id, codigo)` — **total**, nunca parcial (ADR-0015) |
| `cobranca_contrato_empresa_fkey` | `FOREIGN KEY (contrato_id, empresa_id) → negocio.contrato(id, empresa_id)` |
| `cobranca_valor_positivo_chk` | `CHECK (valor_original > 0)` |
| `cobranca_competencia_no_primeiro_dia_chk` | `CHECK (extract(day from competencia) = 1)` |
| `cobranca_desfecho_unico_chk` | `CHECK (pago_em IS NULL OR cancelado_em IS NULL)` — **paga e cancelada é irrepresentável** |
| `cobranca_carimbo_coerente_chk` | `CHECK ((pago_em IS NULL) = (multa_aplicada IS NULL) AND (pago_em IS NULL) = (juros_aplicados IS NULL) AND (pago_em IS NULL) = (multa_percentual_aplicado IS NULL) AND (pago_em IS NULL) = (juros_percentual_aplicado IS NULL) AND (pago_em IS NULL) = (valor_pago IS NULL))` — carimbo **só** existe com pagamento, e pagamento **sempre** carimba |
| `cobranca_empresa_vencimento_idx` | `(empresa_id, data_vencimento)` — a ordenação padrão da carteira |
| `cobranca_empresa_contrato_idx` | `(empresa_id, contrato_id)` — o filtro por contrato e a cascata |
| `cobranca_aberta_idx` | `(empresa_id, data_vencimento) WHERE pago_em IS NULL AND cancelado_em IS NULL` — parcial, serve o filtro por estado em aberto, que é a leitura mais frequente |

**`negocio.configuracao_de_mora`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `empresa_id` | `uuid NOT NULL` | |
| `multa_percentual` | `numeric(5,2) NOT NULL DEFAULT 0` | |
| `juros_percentual` | `numeric(5,2) NOT NULL DEFAULT 0` | ao mês |
| `configuracao_de_mora_id_empresa_key` | `UNIQUE (id, empresa_id)` | |
| `configuracao_de_mora_empresa_key` | `UNIQUE (empresa_id)` | **uma linha por empresa** — é o alvo do `ON CONFLICT` |
| `configuracao_de_mora_faixa_chk` | `CHECK (multa_percentual BETWEEN 0 AND 100 AND juros_percentual BETWEEN 0 AND 100)` | |

As duas tabelas nascem com `empresa_id NOT NULL`, `ENABLE` (no `0009`, do gerador) e **`FORCE ROW
LEVEL SECURITY`** mais política `FOR ALL` com a **mesma expressão literal** em `USING` e `WITH CHECK`
(no `0010`, autoral). A guarda de cobertura de `packages/db/src/catalogo.ts` é a autoridade sobre o
estado real das quatro propriedades e reprova a tabela que nasça sem qualquer uma delas.

**`negocio.cobranca_derivada` (view)**

```sql
CREATE VIEW "negocio"."cobranca_derivada"
  WITH (security_invoker = true) AS
SELECT
  c.*,
  ctr.codigo   AS contrato_codigo,
  ctr.locatario_id,
  d.dias_atraso,
  d.status,
  d.valor_multa,
  d.valor_juros,
  round(c.valor_original + d.valor_multa + d.valor_juros, 2) AS valor_total
FROM "negocio"."cobranca" c
JOIN "negocio"."contrato" ctr
  ON ctr.id = c.contrato_id AND ctr.empresa_id = c.empresa_id
LEFT JOIN "negocio"."configuracao_de_mora" m
  ON m.empresa_id = c.empresa_id
CROSS JOIN LATERAL (…)  AS d;   -- expressões de estado e mora, escritas UMA vez
```

> **`security_invoker = true` é o mecanismo, não um detalhe.** Sem ele a view executa com os direitos
> da dona (`sysloc_migracao`), a RLS das tabelas-base **não** é consultada, e a view devolve cobrança
> de outra empresa — furando a ADR-0008 por dentro do objeto que a ADR-0023 autorizou a criar. É a
> obrigação que a própria ADR-0023 escreve (*"objeto derivado com direitos próprios não é admitido"*),
> e ela tem caso de falsificação dedicado na §19.

**`negocio.data_corrente_da_operacao()`** — `RETURNS date`, `STABLE`, corpo
`(now() AT TIME ZONE 'America/Sao_Paulo')::date`. É **ponto único**, e a razão de existir em vez de
`CURRENT_DATE` é concreta: `CURRENT_DATE` depende do fuso da **sessão**, de modo que a virada do dia —
e portanto a transição para `VENCIDA` — mudaria de hora conforme quem conectou. A função torna o fuso
uma propriedade do objeto, dispensa fixar `TimeZone` na sessão e **não toca** o `DECISÃO FECHADA` de
`unidade-de-trabalho.ts`.

**As duas funções da série** — `negocio.garantir_contador_de_cobranca(p_ano integer, p_inicio bigint
DEFAULT 1)` e `negocio.proximo_numero_de_cobranca(p_ano integer)`. Cópia estrutural das do contrato
(`0008`), com quatro coisas preservadas item a item, porque cada uma fecha um buraco medido:
`SECURITY DEFINER` + `SET search_path = pg_catalog, pg_temp`; **nenhum parâmetro de empresa** (leem o
contexto e levantam quando ausente — é o que torna o pedido cruzado irrepresentável); guarda de faixa
`2000–2999` **nas duas**; e `REVOKE ALL … FROM PUBLIC` **antes** do `GRANT EXECUTE … TO sysloc_app`.
**Nenhuma concessão sobre as sequências** — a mesma decisão que o `DECISÃO FECHADA` do `0008` registra,
e pela mesma razão. Nome da sequência: `negocio.cobranca_{ano}_{32 hexadecimais}` — 46 caracteres,
dentro do limite de 63.

> **O ano do escopo é o ano da EMISSÃO, não o da competência.** Um contrato de 13 meses atravessa a
> virada do ano, e derivar o escopo da competência exigiria garantir dois contadores por ativação. O
> sistema antigo também nomeia pelo instante da criação (`COB-.YYYY.-.#######`), de modo que a escolha
> reproduz o oráculo em vez de divergir dele.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0009 | `0009_dominio_cobranca.sql` | **up** — gerada por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`. Dois enums, duas tabelas, FK composta, `ENABLE RLS`, índices |
| 0010 | `0010_seguranca_cobranca.sql` | **up** — **autoral**. `FORCE RLS`, duas políticas, `GRANT USAGE` nos dois enums, `data_corrente_da_operacao`, a view `security_invoker`, as duas funções da série, `REVOKE`/`GRANT` |

**Sem descida (`down`)**, pela mesma razão dos anteriores: o caminho de volta é restauração de backup.
**Gerado e autoral nunca convivem no mesmo arquivo** — uma regeração futura do `0009` sobrescreveria o
trecho autoral em silêncio, e isolamento perdido em silêncio é a pior forma de perdê-lo. Nada aqui
emenda a `0007` ou a `0008`, que descrevem schemas já aplicados e são imutáveis.

⚠️ **A ordem das instruções na saída do gerador precisa ser conferida a cada regeração** — o alvo de
cada FK tem de existir quando ela é criada, e a ordem é do gerador, não nossa. É a mesma nota que o
cabeçalho do `0007` carrega.

### 7.4 Estratégia de Transação e Consistência

- **Isolamento**: `READ COMMITTED` (padrão do PostgreSQL), como as fatias anteriores.
- **Porta única**: `sobContextoDaSessao` → `unidade-de-trabalho.ts`, que emite `SET LOCAL
  app.empresa_id` **sempre** e **recusa aninhamento** — os dois protegidos por `DECISÃO FECHADA`.
- **Duas unidades sequenciais em TODA rota que emite número de cobrança** (não aninhadas), e são
  **duas** rotas, não uma: `POST /v1/contratos/:codigo/ativacao` (fluxo B) e `POST /v1/cobrancas`
  (fluxo F). Em ambas a primeira unidade garante o contador e **commita**; a segunda faz o trabalho
  inteiro num commit só. Fundi-las devolveria o número `1` no desfazimento, contra a ADR-0015. É o
  molde literal do `criar` de `contrato.controller.ts`, e a rota que o omitir falha na primeira
  cobrança do ano — `proximo_numero_de_cobranca` consome a sequência, nunca a cria.
- **Cancelamento do contrato**: transição + liberação do imóvel + cascata nas cobranças, **um commit
  só**. Falha em qualquer ponto deixa tudo como estava.
- **Idempotência**: nenhuma operação desta fatia é idempotente por chave de cliente; a repetição de
  `pagamento` ou `cancelamento` é recusada pela guarda de estado, com `detalhes.estadoAtual` — a mesma
  forma que a fatia de contratos fixou. Repetir **informa**, em vez de silenciar.
- **Concorrência sobre o mesmo código**: recusada pela restrição `UNIQUE (empresa_id, codigo)`, e a
  tradução do conflito acontece **num ponto só** da porta, nunca por leitura prévia.
- **Concorrência sobre a configuração de mora**: `ON CONFLICT (empresa_id) DO UPDATE` — última escrita
  vence, sem leitura prévia e sem corrida entre `SELECT` e `INSERT`.

### 7.5 Política de Retenção / Archival

**Nenhuma retenção, nenhuma remoção, nenhum particionamento.** Cobrança **nunca é apagada** (RD-12), e
não há coluna de circulação: cancelar é transição de estado, e o registro permanece legível e continua
ocupando o código. O volume medido no sistema antigo é de dezenas de cobranças por ano por empresa —
particionar seria complexidade sem grandeza que a justifique.

O `Cons` da ADR-0014 sobre retenção indefinida de dado pessoal continua valendo e **não é agravado
aqui**: a cobrança não guarda dado pessoal — ela referencia o contrato, que referencia o locatário.

---

## 8. Integração com APIs Externas

**N/A — nenhuma.** Esta fatia não fala com serviço externo algum. A integração bancária (mTLS,
certificado por empresa, webhook Sicoob) é a **F4**, e a decisão registrada é que **a rota de emissão
não existe aqui**: os campos de conciliação nascem nulos e a F4 é obrigada a tocar o contrato
publicado para lhes dar produtor.

A **captura do oráculo** (CA-01) fala com o `/opt/frappe`, mas por `docker compose exec` contra um
**site efêmero restaurado de dump**, fora do processo da API e fora do caminho de qualquer requisição.
Não é integração da aplicação — é ferramenta de caracterização, e é o mesmo caminho que as 6 capturas
anteriores já usam.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

**N/A.** Nenhum produtor, nenhum consumidor, nenhum tópico. O débito **D32** não dispara nesta fatia.

### 9.2 Idempotência

Ver §7.4. Não há replay de evento a deduplicar. A única idempotência declarada é a de
`garantir_contador_de_cobranca`, que é idempotente **por contrato**: com a sequência já existente, ela
sai cedo e ignora `p_inicio` em silêncio — comportamento herdado e deliberado, com a mesma consequência
para a semeadura da virada (F7) que a função irmã do contrato já tem.

### 9.3 Outbox / Saga

**N/A.** A atomicidade exigida pela RN-06 é de um banco só, e sai do commit único. Não há participante
remoto, logo não há saga.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

Envelope da **ADR-0017**: `{ codigo, mensagem, campo?, detalhes? }`, `codigo` de enum fechado
(`CodigoErro`), montado no ponto único `apps/api/src/comum/esquema-de-erro.ts` e lançado como
`ErroDeAplicacao`.

| Erro | Código | Status | Mensagem / `detalhes` | Camada de Origem |
|------|--------|--------|------------------------|------------------|
| Sessão ausente ou inválida | `NAO_AUTENTICADO` | 401 | padrão | guarda |
| Sem alcance à área declarada | `ACESSO_NEGADO` | 403 | `detalhes.exigido: "TELA:financeiro"` | guarda |
| Cobrança inexistente ou de outra empresa | `RECURSO_NAO_ENCONTRADO` | 404 | **corpo idêntico** nos dois casos | aplicação |
| Contrato inexistente ou de outra empresa | `RECURSO_NAO_ENCONTRADO` | 404 | idem | aplicação |
| Contrato retirado de circulação | `CAMPO_INVALIDO` | 422 | `campo: "contratoCodigo"`, `detalhes.circulacao: "RETIRADO_DE_CIRCULACAO"` | aplicação |
| Transição impossível (pagar cobrança paga, cancelar cancelada) | `CAMPO_INVALIDO` | 422 | `campo: "codigo"`, `detalhes: { estadoAtual, transicaoPedida }` | aplicação |
| Corpo malformado, campo fora de faixa, chave desconhecida | `CAMPO_INVALIDO` | 422 | `campo` nomeado pelo Zod | borda |
| Colisão de código na gravação | `CAMPO_INVALIDO` | 422 | `campo: "codigo"`, `detalhes.conflito` | dados → aplicação |
| Contexto de empresa ausente na chamada da função da série | `ERRO_INTERNO` | 500 | a função **levanta**; é defeito de programação, não entrada de cliente | banco |

> **O `404` de recurso alheio é indistinguível do `404` de recurso inexistente**, byte a byte — é
> invariante já estabelecido pela F2 (`recusa-indistinguivel.e2e.spec.ts`) e esta fatia o herda sem
> reabrir.

> **`detalhes.estadoAtual` e `detalhes.transicaoPedida` reusam a forma que a fatia de contratos
> fixou.** Inventar um terceiro discriminador para a mesma classe de recusa faria o cliente tratar duas
> formas do mesmo fato.

### 10.2 Resiliência

Nada a acrescentar ao que a fundação já dá: sem chamada externa, não há retry, timeout de dependência,
circuit breaker ou degradação graciosa a especificar. O que existe é o comportamento do banco —
`READ COMMITTED`, restrições que recusam em vez de corromper, e o pool do `postgres.js` já configurado.

### 10.3 Estratégia de Logging de Erros

Pino estruturado, no molde do `contrato.controller.ts`: uma linha por ato bem-sucedido, com
`empresaId`, `entidade` e `codigo`. **Nunca** valor monetário no log, **nunca** dado do locatário. O
`filtro-excecao.ts` continua sendo o ponto único que converte `ErroDeAplicacao` em resposta e registra
o que não é erro de cliente.

---

## 11. Segurança

### 11.1 Autenticação

Sessão `better-auth`, com a barreira única de admissão já instalada na F1. Nada muda.

### 11.2 Autorização

Declaração por rota, conferida **por conteúdo** (ADR-0011, ADR-0018):

- `@Controller('cobrancas')` + `@ExigeChave('TELA:financeiro')` na classe, valendo para os 5
  manipuladores;
- `@Controller('multa-e-juros')` + `@ExigeChave('TELA:multa_e_juros')` na classe, valendo para os 2.

**Nenhuma chave de ação, e nenhuma chave nova.** O catálogo fechado da ADR-0011 permanece nas 10 telas
× 7 ações; `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado**.

> **A classificação dos dois atos, pela ADR-0021, e a evidência que a sustenta.**
> A ADR-0021 dá "apenas a área" ao ato que *"não transfere direito nem move dinheiro nem altera o que
> outra entidade pode fazer"*, e acusar pagamento e cancelar cobrança são, à primeira leitura,
> candidatos à classe do ato sensível. **Esta fatia os classifica como operacionais**, e a razão não é
> conveniência: o **próprio catálogo fechado já respondeu**. Ele enumera **duas** ações sensíveis dentro
> de `TELA:financeiro` — `ACAO:emitir_boleto` e `ACAO:solicitar_baixa_de_boleto` — e **nenhuma** para
> pagamento ou cancelamento de cobrança. Quem fechou o catálogo (decisão 38 do `plano-saas.md`) tinha
> as operações de cobrança à vista e concedeu chave própria só às que falam com o banco. Somam-se:
> acusar pagamento **registra** dinheiro que se moveu fora do sistema, não o move; e o cancelamento tem
> substituta prevista, o que o torna reversível — que é o teste de efeito que a ADR-0021 nomeia entre
> os *Neutros*.
> A decisão foi **escalada e confirmada** antes da geração desta spec. As alternativas consideradas e
> recusadas foram (a) abrir o catálogo com duas chaves novas, o que exigiria supersedê-la ADR-0011 e é
> o que o PRD §4.2 exclui nominalmente; e (b) estender a ADR-0021 com uma terceira instância declarada.

### 11.3 Criptografia

TLS na borda; nada em repouso nesta fatia. Nenhum segredo novo, nenhuma chave nova. O invariante 3 do
projeto (nada versionado) não é tocado.

### 11.4 Sanitização e Validação

- **Injeção de SQL**: consultas parametrizadas do `postgres.js` em toda a porta. O **único SQL
  dinâmico** desta fatia é o `format(… %I …)` das duas funções da série, e ele é seguro por construção
  pela mesma razão do `0008`: o ano é `integer` guardado por faixa e a empresa vem do contexto
  **convertida para `uuid`** — o cast recusa qualquer coisa que não seja UUID antes de o nome ser
  composto, e `%I` ainda cita o identificador resultante.
- **`search_path`**: fixado em `pg_catalog, pg_temp` nas duas funções `SECURITY DEFINER`, com o schema
  temporário em **último** lugar, de modo que nenhum objeto criado por quem chama sequestre um nome.
- **Esquema de entrada**: `strictObject` em todo corpo; nenhuma rota aceita campo que o servidor decide.
- **Isolamento**: propriedade do banco (RLS forçada + FK composta), **inclusive na view**, pelo
  `security_invoker`. A camada de aplicação **não** implementa filtro por empresa equivalente — não há
  dois caminhos para o dado (ADR-0008).

### 11.5 Rate Limiting / Anti-abuse

Herdado, inalterado. O limitador de taxa da F1 vive na autenticação; nada nesta fatia o toca, e o
débito **D27** (eixo de origem confiável) segue com gatilho na F7.

### 11.6 Secrets Management

Inalterado — `EnvironmentFile` 0600 fora do repositório. Esta fatia **não introduz segredo algum**.

---

## 12. Performance

### 12.1 Metas

- Latência p95 da leitura da carteira (`GET /v1/cobrancas`, página de 50): **< 150 ms**
- Latência p95 das transições (`pagamento`, `cancelamento`): **< 100 ms**
- Latência p95 da ativação com geração de 12 parcelas: **< 400 ms**
- Throughput esperado: dezenas de requisições por minuto por empresa — a operação é de escritório

> As metas são **âncoras de sanidade**, não SLO contratado: o projeto não tem instrumentação de
> latência publicada, e inventar SLO sem medição seria número sem dono.

### 12.2 Estratégias

- **Índices desenhados para as leituras reais**, e não por simetria: `(empresa_id, data_vencimento)`
  para a ordenação padrão; `(empresa_id, contrato_id)` para o filtro por contrato e para a cascata; e o
  **índice parcial** `WHERE pago_em IS NULL AND cancelado_em IS NULL`, que é a carteira em aberto — a
  leitura mais frequente e a que o filtro por estado mais pede.
- **Paginação no banco**, com teto de `MAIOR_PAGINA` que **recusa** em vez de truncar.
- **A geração das parcelas é um `INSERT` de N linhas**, não N `INSERT`s: 12 idas ao banco viram uma.
- **Derivar no banco evita trazer o conjunto para a memória** — é o ganho que a ADR-0023 nomeia, e o
  que torna filtro e ordenação por estado possíveis sobre a leitura mais pesada do produto.
- Sem cache. Introduzir cache sobre valor que é função do tempo criaria a segunda fonte que esta fatia
  existe para eliminar.

### 12.3 Limites Conhecidos

- **A view derivada tem custo por linha lida.** Numa carteira grande, ordenar por `status` — que é
  expressão, não coluna — não usa índice. Mitigação declarada: a ordenação **padrão** é por
  `data_vencimento` (indexada), e o filtro em aberto tem índice parcial. Materializar não é opção: a
  ADR-0022 recusa coluna movida por rotina.
- **Acima de 9 999 999 cobranças da mesma empresa no mesmo ano** o formatador produziria um código que
  a leitura recusa — mesma assimetria deliberada do contrato (preenche, não trunca), porque truncar
  produziria **colisão**. A série viva está em 58; a condição é inalcançável, e o furo, se chegar,
  aparece como recusa ruidosa em vez de colisão silenciosa.
- **`numeric` é mais lento que ponto flutuante.** É custo aceito por escrito: a exatidão em centavos
  da RN-16 é o requisito, e a grandeza aqui é de dezenas de linhas por página.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| `cobrança lançada` | info | `empresaId`, `entidade: "cobranca"`, `codigo`, `natureza` | sem valor monetário |
| `pagamento acusado` | info | `empresaId`, `entidade: "cobranca"`, `codigo` | **sem `valorPago`** |
| `cobrança cancelada` | info | `empresaId`, `entidade: "cobranca"`, `codigo` | — |
| `cobranças geradas na ativação` | info | `empresaId`, `entidade: "contrato"`, `codigo`, `quantidade` | — |
| `cobranças canceladas em cascata` | info | `empresaId`, `entidade: "contrato"`, `codigo`, `quantidade` | — |
| `política de mora definida` | info | `empresaId`, `entidade: "configuracao_de_mora"` | **sem os percentuais** |
| erro não tratado | error | `requestId`, `codigo` | a redação de entrada única da F0 continua valendo |

Pino, JSON, pela configuração já existente. **Nada de novo em infraestrutura de log.**

### 13.2 Métricas

**N/A nesta fatia.** O projeto tem OpenTelemetry na stack e **nenhuma métrica de negócio publicada até
hoje**; criar a primeira aqui seria decisão transversal fora do escopo do PRD, sem consumidor e sem
painel. Fica registrado como candidato à fase de automações (F5), que é quem ganha tela de saúde.

### 13.3 Tracing

Herdado da configuração existente; nenhum span novo declarado. A unidade de trabalho já é a fronteira
natural, e ela não muda.

### 13.4 Alertas

**N/A.** Nenhum alerta pertence a esta fatia — o alerta da decisão 34 é da F5, e o discovery já o
partiu (a F3 grava o fato; a F5 exibe e alerta).

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma.** O projeto não adota mecanismo de feature flag, e esta fatia não introduz um.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

> **`gerarCobrancasAutomaticamente` NÃO é feature flag** e não deve ser lido como tal: é **campo de
> negócio** do contrato, portado do sistema antigo na F2, decidido por contrato pelo operador. Ele
> ganha consumidor nesta fatia (RD-20).

---

## 15. Versionamento de API

### 15.1 Estratégia

**URL path** — prefixo `/v1`, como toda a superfície. Inalterado.

### 15.2 Compatibilidade

Esta fatia faz **uma mudança de contrato sobre superfície publicada**, e ela é deliberada e agendada:
`esquemaDaAtivacaoDeContrato.efeitos.cobrancasGeradas` passa de `z.literal(false)` para
`z.number().int().nonnegative()`. É **exatamente** o que o marcador `DÉBITO COM GATILHO — D28 · F2/T7`
agendou: o literal existe para obrigar esta fatia a tocar o contrato, em vez de mudar o significado da
resposta por omissão.

Tudo o mais é **crescimento**: rotas novas e esquemas novos. **Nenhum campo é removido, nenhum tipo é
estreitado, nenhuma igualdade vira asserção de presença.** O produto não tem consumidor externo
versionado — o único cliente é o React, que ainda não consome esta API —, de modo que não há janela de
descontinuação a declarar.

⚠️ **A superfície ainda não congela aqui.** O congelamento é depois da F5; esta fatia a leva de 75 a
82 rotas, e a fatia seguinte e as fases F4/F5 ainda publicam.

### 15.3 Schemas / Contratos

`@sysloc/contracts` é a fonte única (ADR-0016): conferência de entrada, tipo da resposta e documento
OpenAPI derivam dele por `esquemaPublicado(...)`. A publicação do pacote no GitHub privado é item do
**marco de entrega**, não desta fatia.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Inalterado. `pnpm build` → `pnpm lint` (Biome + `lint:shell`) → `pnpm test` (Vitest com instâncias
efêmeras). Sem CI hospedada: a verificação roda no próprio servidor.

### 16.2 Empacotamento

**Nativo, sem Docker.** Node 24 fixado por `mise`; serviços por unidade systemd com `Restart=always`.
Nada muda.

### 16.3 Infraestrutura como Código

Scripts versionados em `deploy/scripts/`, com instalação idempotente (ADR-0005). Esta fatia acrescenta
**apenas** as duas migrações, aplicadas por `deploy/scripts/instalacao/migrar-banco.sh` em operação e
por `packages/db/test/banco-efemero.ts` na verificação — os dois lendo os **mesmos arquivos**.

### 16.4 Estratégia de Rollout

Migração aplicada e serviço reiniciado. Não há blue-green nem canary: é uma instalação só, e o
`/opt/frappe` segue atendendo a operação em paralelo até a F7. **As duas migrações são puramente
aditivas** — nenhuma tabela existente é alterada, nenhuma coluna é removida —, de modo que a aplicação
antiga continua funcionando com o schema novo enquanto o binário novo não sobe.

### 16.5 Escalabilidade

Vertical, num servidor só. De 20 a 300 empresas sobre isolamento lógico, com dezenas de cobranças por
ano por empresa. Nada aqui pede escala horizontal.

### 16.6 Rollback

**Restauração de backup** — as migrações não têm `down`, pela mesma razão registrada desde a F0:
reverter isolamento por migração é operação de risco. Como as duas são aditivas, o rollback prático do
**código** (voltar o binário) não exige tocar o schema: as tabelas e a view novas ficam órfãs e inertes.

> ⚠️ **Item 1 da F7 ainda não existe** — backup e restauração provados são critério do marco de
> entrega e **não** pertencem a esta fatia. Enquanto não existirem, o rollback aqui declarado é
> teórico. Fica registrado como risco na §20.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | Extensão do capturador com **substituição do despachante** (`frappe.sendmail`, 2 call sites) por registrador; golden novo com a divergência de estado do legado; ordem de queda declarada (§21) | `capturar.py`, `verificar-captura.sh`, `verificar-golden.sh`, `golden/regua-de-cobranca.json`, `PROCEDENCIA.md` |
| US-02 | RD-05, RD-18, RD-19, RD-20 — função pura de parcelas + geração em lote na unidade da ativação + duas unidades sequenciais para o contador | `derivacao-de-cobranca.ts`, `cobranca.ts` (porta), `contrato.service.ts`, `contrato.controller.ts`, `0010` (funções da série) |
| US-03 | RD-04 — `status` derivado **na view**, e proibição de derivação em TypeScript | view `cobranca_derivada`, `data_corrente_da_operacao()`, `cobranca.ts` (porta), `esquemaDaCobranca` |
| US-04 | RD-03 — enum `natureza_cobranca` de 5 valores, separado de `referencia` | `esquema/negocio.ts`, `packages/contracts/src/cobranca.ts`, `cobranca.controller.ts` |
| US-05 | RD-09, RD-15 — carimbo na mesma instrução do pagamento; conciliação intocada | `cobranca.service.ts`, `cobranca.ts` (porta), `cobranca_carimbo_coerente_chk` |
| US-06 | RD-12, RD-02 — cancelamento como transição; substituta com número novo | `cobranca.service.ts`, `cobranca_empresa_codigo_key`, funções da série |
| US-07 | RD-11 — `negocio.configuracao_de_mora` com RLS forçada e uma linha por empresa | `0009`/`0010`, `configuracao-de-mora.ts` (porta e contrato), `mora.controller.ts`, `mora.service.ts` |
| US-08 | RD-07, RD-16 — expressões de multa e juros em `numeric`, contra o golden | view `cobranca_derivada`, `golden/calcular-mora.json` |
| US-09 | RD-09, RD-10 — o carimbo é o que separa aberto de liquidado | colunas de carimbo, view, `cobranca.service.ts` |
| US-10 | RD-13 — cascata na mesma unidade do cancelamento do contrato | `contrato.service.ts`, `cancelarCobrancasDoContrato` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | NestJS + Fastify | já instalado | superfície HTTP — **inalterado** |
| ORM / driver | Drizzle + drizzle-kit + postgres.js | já instalado | schema, migração gerada e porta de dado |
| Banco | PostgreSQL | 18 | `numeric`, RLS forçada, **`security_invoker` em view** (exige ≥ 15) |
| Validação / contrato | Zod | 4 | fonte única do contrato (ADR-0016) |
| Autenticação | better-auth | já instalado | sessão — **inalterado** |
| Observabilidade | Pino (+ OpenTelemetry) | já instalado | log estruturado — **inalterado** |
| Teste | Vitest + `embedded-postgres` | já instalado | fronteira real (ADR-0006) |
| Caracterização | Python 3 no contêiner do `/opt/frappe` | do legado | captura do oráculo (US-01) |

> **Nenhuma dependência nova é adicionada ao `package.json` por esta fatia.** Nem biblioteca de datas
> (a aritmética é escrita e provada contra o golden, pela mesma razão de `derivacao-de-contrato.ts`),
> nem biblioteca de decimal (o `numeric` do banco é o mecanismo), nem cliente HTTP.

---

## 19. Estratégia de Testes

> **Resumo**: **39 casos de teste** | Unitários: 5 | Integração: 15 | E2E: 14 | Segurança: 5
> (eram 37; **CT-538 e CT-539** entraram no challenge de 2026-08-09, fechando o vão das rotas de
> `/v1/multa-e-juros` — ver a subseção "Política de multa e juros" na §19.3)
> **Padrão**: Vitest + `embedded-postgres` (instância efêmera própria) · E2E em Vitest sobre HTTP real
> em porta dinâmica · verificadores em `bash` com o vocabulário `caso`/`ok`/`falhar`/`afirmar_igual`.
> **Mock é evitado por decisão de projeto** — a coluna `Mock` sai `—` em toda a seção, e nenhum caso
> a preenche. Rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção INVARIANTES por arquivo.
> Numeração a partir de **CT-501** (a fatia anterior fechou em CT-4xx).
>
> Gerada por `agent-spec-qa-test-generator` (frente `backend`) e validada pelo arquiteto. O JSON
> lossless está em `_run/test-cases.json`, com os **três ajustes do arquiteto** registrados em
> `ajustes_do_arquiteto` — leia-os antes de implementar CT-511, CT-515 e CT-530.
>
> ⚠️ **Prova de falsificação obrigatória em seis casos**: CT-502, CT-506, CT-510, CT-513, CT-523 e
> CT-526. Todo mutante roda por `pnpm --filter @sysloc/<pacote> test` — **`vitest run` avulso é
> inválido** para trabalho de mutante e produz falso negativo em suíte que carregue o SUT pela
> fronteira do pacote.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | Régua capturada, com a divergência de estado, sem enviar mensagem | CT-501, CT-502, CT-503 |
| CA-02 | Ativar contrato de N meses gera N parcelas iguais às do legado | CT-504, CT-505, CT-506, CT-507, CT-508, CT-535, CT-536, CT-537 |
| CA-03 | Ativação recusada não deixa parcela | CT-509 |
| CA-04 | Estado idêntico em qualquer caminho de leitura | CT-510, CT-511, CT-527 |
| CA-05 | Consta vencida sem rotina ter rodado | CT-512, CT-513 |
| CA-06 | Cobrança de água distinguível pela natureza, sem interpretar texto | CT-514, CT-515, CT-537 |
| CA-07 | Acusar pagamento registra valor e data | CT-516, CT-517 |
| CA-08 | Multa alterada não move a cobrança já paga | CT-518 |
| CA-09 | Cancelar preserva o histórico e libera substituta | CT-519, CT-520, CT-535, CT-536 |
| CA-10 | Nenhuma operação faz a cobrança deixar de existir | CT-517, CT-519, CT-520, CT-521, CT-530 |
| CA-11 | Cada empresa apura pela própria configuração | CT-522, CT-523, CT-524, CT-538, CT-539 |
| CA-12 | Mora coincide com o golden centavo a centavo | CT-525, CT-526, CT-527 |
| CA-13 | 60 dias dobram os juros; a multa é a mesma | CT-528 |
| CA-14 | Cobrança em aberto reflete a política nova | CT-529 |
| CA-15 | Cancelar contrato cancela só as canceláveis | CT-530, CT-531 |
| CA-16 | Pagamento não apaga a conciliação bancária | CT-532 |
| CA-17 | Sem alcance à área, a operação é recusada e nada muda | CT-533, CT-534 |

**Nenhum CA órfão e nenhum CT citando CA inexistente** — verificado nas duas direções sobre o JSON.

---

### 19.1 Testes Unitários

#### Dados: `derivarParcelasDoContrato` (`packages/db/test/derivacao-de-cobranca.spec.ts` — **novo**)

Mock: — (função pura; nenhum dublê)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-504 | reproduz os três cenários do bloco `cobrancas` do golden | CA-02 | Para os 3 cenários do golden, a lista tem comprimento igual ao prazo e cada parcela iguala o registro em `competencia`, `dataVencimento`, `referencia` e `valorOriginal` — igualdade exata, sem tolerância | os 3 cenários de `contrato-ativacao.json`, lidos do disco | 20 parcelas iguais campo a campo; contagem total 3+4+13 afirmada | — | — |
| CT-505 | a saturação da referência é ITERATIVA | CA-02 | `inicio[i] = addMeses(inicio[i-1], 1)` com saturação — a de fevereiro é HERDADA pelos meses seguintes | `2027-01-31`, dia 28, prazo 4 | `31/01`, `28/02`, **`28/03`**, `28/04`; o controle não-iterativo dá `31/03` e a divergência é afirmada no índice 2 | — | — |
| CT-506 | indiferente ao fuso; sem `Date.UTC` e sem `new Date(a,m,d)` | CA-02 | Mesmas cadeias sob UTC, `America/Sao_Paulo` e `Pacific/Kiritimati`; ano `0050` não vira `1950` | cenário do golden + contrato de ano baixo | parcelas idênticas nos 3 fusos; competência `0050-04-01`; grep dá 0 ocorrências e REPROVA na cópia mutada | — | imite `derivacao-de-contrato.spec.ts` (CT-432): fixar o fuso pelo mecanismo nativo do runtime e **afirmar os deslocamentos** (`0`, `180`, `-840`) antes do resultado. Nunca dar parâmetro de fuso à produção |
| CT-507 | prazo N produz N parcelas, ALUGUEL, valor mensal | CA-02 | Comprimento igual ao prazo; `natureza` e `valorOriginal` constantes; o dia de vencimento nunca satura | prazos 1/3/4/12/13 × dias 1 e 28 | 13 competências de `2027-01-01` a `2028-01-01`, todos os vencimentos em `-28`, inclusive fevereiro | — | — |

#### Contrato: `esquemaDaAtivacaoDeContrato` (`packages/contracts/test/esquemas.spec.ts` — **modificado**)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-537 | `cobrancasGeradas` passa a inteiro não negativo | CA-02, CA-06 | O esquema aceita inteiro ≥ 0, RECUSA `false`, e o `strictObject` de `efeitos` não foi afrouxado | `0`, `3`, `13` · `false`, `-1`, `2.5`, campo extra | os três primeiros aceitos; os três seguintes com `path` `['efeitos','cobrancasGeradas']`; o extra com `['efeitos','boletosEmitidos']`; os dois enums novos afirmados por lista ordenada | — | — |

> ⚠️ **CT-537 SUBSTITUI o CT-429**, que afirma o literal `false`. A substituição exige a linha
> `SUT_IS_CORRECT_BECAUSE:` declarando que o `z.literal(false)` era o registro fiel de uma fatia que
> não gerava cobrança, e que o `DÉBITO COM GATILHO — D28 · F2/T7` tem por gatilho exatamente esta.
> **O caso não pode sumir**: o CT-429 sai e este entra, e a contagem total da suíte não pode cair.

### 19.2 Testes de Integração

#### Caracterização — golden da régua (`deploy/scripts/caracterizacao/verificar-golden.sh` — **modificado**)

Setup: `capturar.py` estendido já executado contra site efêmero; artefatos versionados lidos do disco.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-501 | forma do golden e bijeção com o `PROCEDENCIA.md` | CA-01 | Chaves de topo presentes, contagem de cenários igual à declarada, e o conjunto de máscaras do artefato IGUAL ao do manifesto — sem órfã nas duas direções | ler os dois artefatos → conferir chaves → contar cenários → comparar conjuntos ordenados de máscaras | `falhas_totais == 0`; máscara nova sem algarismo, sob pena de escapar da varredura `<[A-Z_]+>` | — |
| CT-503 | o golden registra a divergência automático × manual | CA-01 | Para cobrança cancelada E vencida, `core` resolve `Fechada` e `emailer` resolve `Vencida` — valores diferentes, com mensagem só no manual | localizar o cenário → afirmar os dois templates → `afirmar_diferente` → contar mensagens | `Fechada` × `Vencida`; 1 mensagem no manual, 0 no automático. É o oráculo do defeito que a fatia 2 **não** deve portar | — |

#### Porta de dados + banco efêmero (`packages/db/test/cobranca.spec.ts` — **novo**)

Setup: instância efêmera com `0009` e `0010` aplicadas; contexto por `SET LOCAL app.empresa_id`; goldens lidos do disco, nunca redigitados.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-512 | consta VENCIDA sem rotina ter rodado | CA-05 | A linha física não sofre escrita: o `xmin` é idêntico antes e depois, e não há coluna `status` a escrever | inserir vencida há 30d → ler → reler `xmin` → introspecção → contar fila e timers | `VENCIDA`/`dias_atraso 30` na 1ª leitura; `xmin` idêntico nas 3 medições; sem `status`, `pagamento_confirmado`, `data_inicio_atraso`, `data_ultima_atualizacao_atraso`; 0 tarefas; timers inalterados | imite `janela.spec.ts`: posicionar o **dado** por `data_corrente_da_operacao() - INTERVAL 'N days'`. Nunca falsear o relógio nem parametrizar a data na produção |
| CT-513 | a fronteira do vencimento é ESTRITA | CA-05 | Vencer hoje é `A_VENCER`; só ontem é `VENCIDA` — é o único ponto em que `<` e `<=` discordam, e o golden **não** o cobre (não há deslocamento `0`), de modo que o caso prova uma **decisão desta fatia**, não um porte | inserir em −1/0/+1 dia → ler as três → variar o fuso da sessão → mutar a view | ontem `VENCIDA`/1/`20.00`/`0.33`/`1020.33`; hoje e amanhã `A_VENCER`/0/zeros; `data_corrente_da_operacao()` igual sob UTC e Kiritimati; o mutante `<=` faz hoje virar `VENCIDA` | idem CT-512 |
| CT-517 | o banco impede estado impossível | CA-07, CA-10 | Pago **e** cancelado é irrepresentável; carimbo sem pagamento também. Repetir a transição é recusado sem escrita | 3 escritas ilegítimas → 1 legítima (controle) → 2 chamadas de rota sobre terminais | `23514` nomeando a restrição nas três; a legítima aceita; `422` nas duas rotas; `xmin` idêntico | imite `contrato.spec.ts`: escrever pelo papel da **aplicação** com `SET LOCAL`. Nunca conectar como dona nem desligar a RLS |
| CT-521 | nenhuma operação apaga cobrança | CA-10 | Contagem preservada nas três operações; sem `retirado_em`; sem `DELETE` publicado | contar → pagar → cancelar → cancelar contrato → recontar → introspecção → cobertura | contagem `N` nas 4 medições; lista ordenada de colunas igual à declarada; métodos sob `/v1/cobrancas` = `['GET','POST']` | montar os estados pelas rotas de produção |
| CT-524 | empresa sem configuração apura mora ZERO | CA-11 | A ausência apura zero e **não some com a linha** — distingue `LEFT JOIN` de `INNER JOIN` | empresa nova sem configuração → cobrança vencida há 60d → ler → registrar 2% → reler | linha CONSTA (`count === 1`), `VENCIDA`/60/`0.00`/`0.00`/`1500.00`; controle positivo `30.00`/`0.00`/`1530.00` | criar empresa pelo caminho real e simplesmente **não** chamar `PUT /v1/multa-e-juros` |
| CT-525 | reproduz os 6 casos e 9 invocações do golden de mora | CA-12 | Igualdade **exata** de `numeric`, jamais tolerância — o golden é o oráculo | ler o golden → replicar cada invocação como cobrança real → ler a view | 27 asserções exatas; contagem de invocações comparadas = 9; juros iguais com multa 2% e 50% | posicionar atrasos por deslocamento; empresas distintas quando a configuração divergir (`unique(empresa_id)`) |
| CT-526 | `1234.56` a 5 e a 17 dias discrimina o arredondamento | CA-12 | Um único `round`, no fim; e nenhuma aritmética por ponto flutuante | ler as duas → grep na `0010` → 2 mutantes | `24.69`/`7.00`/`1266.25` e `24.69`/`2.06`/`1261.31`; grep 0 ocorrências e REPROVA na cópia com `double precision`; a cópia que arredonda **antes** da divisão por 30 devolve `7.02` | imite `coerencia-de-migracoes.spec.ts`: mutar **cópia** em diretório temporário, nunca o arquivo versionado |
| CT-527 | mora só é apurada quando VENCIDA | CA-12, CA-04 | A precedência `CANCELADA → PAGA → VENCIDA → A_VENCER` é o que impede o produto de reproduzir a divergência do legado | ler as quatro da view | A_VENCER e CANCELADA (vencida há 60d) com zeros; VENCIDA `40.00`/`40.00`/`2080.00` (controle positivo); PAGA publica os carimbos, não reapura | montar os terminais pelas rotas de produção |
| CT-528 | juros simples: 60 dias valem o dobro de 30 | CA-13 | A relação é afirmada **como relação**, não só pelos dois valores; a multa é aplicada uma vez | ler quatro atrasos (5/30/60/500) | `20.00`→`40.00` (dobro exato) com multa `40.00` idêntica; `3.33` e `333.33` com a mesma multa | posicionar por deslocamento relativo |
| CT-532 | pagamento NÃO apaga a conciliação bancária | CA-16 | Divergência declarada contra o legado, que zera seis campos | preencher os 6 → pagar → reler | os 6 idênticos, um a um; os 4 carimbos gravados; sem coluna `pagamento_confirmado` | escrever os 6 pelo papel da aplicação sob contexto. **Nunca** publicar rota de conciliação só para montar o cenário — a 8ª rota faria a âncora de 82 reprovar |
| CT-536 | `COB-{ano}-{7 dígitos}`, por empresa e ano, com furo | CA-02, CA-09 | Largura 7 afirmada pelo valor literal; escopo `(empresa, ano)`; transação abortada QUEIMA o número | emitir → abortar → emitir → emitir em B → duplicar | `0000001`, aborto sem linha, `0000003`; B emite `0000001` no mesmo ano; duplicata `23505`; nenhum sufixo com 5 ou 6 dígitos | abortar pelo mecanismo que a produção já usa (levantar dentro da transação). Nunca publicar flag de teste |

#### Isolamento (`packages/db/test/isolamento.spec.ts` — **modificado**)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-522 | duas empresas, duas políticas, sem se enxergarem | CA-11 | Cada contexto vê só o seu e apura pela própria configuração — com cobranças idênticas e multas dez vezes distintas | contexto A → ler → contexto B → ler → sem contexto | A: `40.00`/`20.00`/`2060.00`, interseção `[]`; B: `200.00`/`100.00`/`2300.00`, interseção `[]`; **sem contexto: vazio** | imite `isolamento.spec.ts` (`CONTEXTO_DE_A`/`CONTEXTO_DE_B`). Nunca conectar como dona nem desligar a RLS |

#### Catálogo (`packages/db/test/catalogo.spec.ts` — **modificado**)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-535 | as funções da série não aceitam empresa e não concedem a sequência | CA-02, CA-09 | O pedido cruzado é **irrepresentável**, não conferido; e não existe segundo caminho para o número | introspecção de `pg_proc` → chamadas sem contexto → faixa do ano → controle positivo → privilégios → `nextval` direto | nenhuma assinatura com `uuid`; `prosecdef` e `search_path` fixos; contexto ausente e `NULL`/`1999`/`3000` levantam; `2000`/`2027`/`2999` sucedem; `EXECUTE` sim, sequência não; `nextval` direto `42501` | imite `catalogo.spec.ts` (CT-421) e a mecânica dos CT-406/CT-431. **Nunca** conceder a sequência "para poder testar" |

### 19.3 Testes End-to-End (E2E)

Todos em Vitest sobre **HTTP real em porta dinâmica**, com banco efêmero. A sessão é sempre montada
pelo **caminho real de admissão** (login efetivo), e a área de tela concedida pelo caminho real de
administração — nunca por símbolo exportado, rota de teste ou `app.empresa_id` fixado por fora da
barreira.

**Ativação e cancelamento de contrato** (`apps/api/test/contratos.e2e.spec.ts` — **modificado**)

- **CT-508 — ativar contrato de 3 meses cria 3 cobranças** · CA-02. Objetivo: a resposta publica
  `cobrancasGeradas` igual ao prazo e o banco confirma o mesmo número, com códigos distintos e
  consecutivos. Validações: `200`, `cobrancasGeradas === 3`, contagem 0 → 3, códigos
  `COB-2027-0000001..3`, e as 3 parcelas iguais ao cenário `dia_seguro_tres_meses` do golden — o mesmo
  oráculo do CT-504, agora pela rota. ⚠️ `EFEITOS_ESPERADOS = { cobrancasGeradas: false }`
  (`contratos.e2e.spec.ts:936`) deixa de valer e a alteração exige `SUT_IS_CORRECT_BECAUSE:`.
- **CT-509 — ativação recusada não deixa parcela** · CA-03. Objetivo: a geração está na **mesma**
  unidade de trabalho da ativação, e o desfazimento alcança as duas. Validações: `422` com o envelope
  inteiro; **contagem de cobranças do contrato aferida DEPOIS da recusa** = 0; total da empresa
  inalterado; contrato segue `RASCUNHO`. Sem a contagem posterior, uma implementação que commitasse as
  parcelas em transação própria passaria.
- **CT-530 — cancelar contrato cancela só as canceláveis** · CA-15, CA-10. Objetivo: a cascata alcança
  `pago_em IS NULL AND cancelado_em IS NULL` e **não toca** as demais. Validações: as duas abertas
  passam a `CANCELADA`; PAGA e já CANCELADA com publicação **e `xmin`** idênticos; contagem 4 antes e
  depois; as quatro legíveis com `200`. O `xmin` distingue *não alterou* de *reescreveu com o mesmo
  valor*.
- **CT-531 — cancelamento recusado não cancela cobrança nenhuma** · CA-15. Objetivo: não existe
  cascata parcial. Validações: `422` para `CANCELADO` e para `RASCUNHO`; `xmin` e `status` de todas as
  cobranças idênticos. **Fronteira**: contrato ATIVO sem cobrança alguma responde `200` — cascata sobre
  conjunto vazio não é erro.

**Carteira de cobranças** (`apps/api/test/cobrancas.e2e.spec.ts` — **novo**)

- **CT-511 — estado idêntico em todos os caminhos publicados** · CA-04. Objetivo: metade
  **comportamental** do CA-04 (a estrutural é o CT-510). Os **quatro** caminhos: item, lista sem filtro,
  lista por contrato e lista por status. Validações: A_VENCER `1000.00`; VENCIDA há 30d `1030.00`;
  PAGA `1030.00` pelos carimbos; CANCELADA `1000.00` — iguais nos quatro, por igualdade estrita.
  ⚠️ **Ajuste do arquiteto**: o gerador propôs como quarto caminho uma projeção embutida na leitura do
  contrato, que **não existe** — esta fatia não acrescenta cobranças ao esquema do contrato.
- **CT-514 — cobrança de água distinguível pela natureza** · CA-06. Validações: `201` com código
  distinto no formato; filtro `natureza=ALUGUEL` devolve 3 e não a traz; `natureza=AGUA` devolve 1; sem
  filtro, 4. A contagem exata por filtro é o que prova que a distinção é **pelo campo** — filtrar por
  `referencia LIKE` daria 0 ou 4.
- **CT-515 — natureza inválida, sem contrato, valor não positivo e chave desconhecida** · CA-06.
  Validações: `422` nos quatro com o envelope inteiro; campos `natureza`, `contratoCodigo`,
  `valorOriginal` e `corpo`; contagem inalterada; e o `CHECK` do banco levanta `23514` na inserção
  direta. A dupla asserção (borda + `CHECK`) é deliberada. ⚠️ **Ajuste do arquiteto**: o passo de canal
  de comunicação (RN-17) foi **removido** — ver §21.
- **CT-516 — pagamento congela os quatro carimbos** · CA-07. Objetivo: os carimbos igualam, centavo a
  centavo, o que a view publicava no instante anterior. Validações: leitura prévia `40.00`/`34.67`/
  `2074.67` (caso canônico do golden); `200` e `PAGA`; carimbos `40.00`, `34.67`, **`2.00`**, **`1.00`**;
  a publicação da paga usa os carimbos, e não uma reapuração.
- **CT-518 — alterar a multa depois do pagamento não move um centavo** · CA-08. Validações: publicação
  da paga idêntica **por igualdade de objeto**; carimbos preservados; `valorTotal '2074.67'` e não
  `2373.33`. A asserção dos **percentuais** é o discriminador: carimbar só os valores passaria numa
  releitura ingênua e perderia a configuração vigente que a ADR-0022 manda gravar.
- **CT-519 — cancelar preserva o legível e libera substituta** · CA-09, CA-10. Validações: `200` e
  `CANCELADA`; releitura **`200`, nunca `404`**, com os campos de negócio íntegros; consta da lista;
  substituta com código maior; contagem N → N+1; esquema **sem** campo de vínculo com a cancelada.
  O `200` na releitura é o que separa *cancelar* de *retirar de circulação*, e é a materialização do
  invariante da ADR-0014 nesta fatia.
- **CT-520 — cancelar PAGA ou já CANCELADA é recusado** · CA-09, CA-10. Validações: `422` nomeando o
  estado; **`xmin` idêntico**; `cancelado_em` da já cancelada preserva o instante original. O `xmin`
  distingue *recusado* de *aceito sem efeito visível*.
- **CT-529 — a política nova alcança o aberto e só ele** · CA-14. Validações: VENCIDA passa de
  `40.00`/`2060.00` para `100.00`/`2120.00`; PAGA idêntica campo a campo; **`xmin` da VENCIDA
  inalterado** — a mudança veio da derivação, não de escrita. Uma implementação que reescrevesse as
  abertas ao salvar a configuração passaria pelos valores e reprovaria aqui, que é o desejado.

**Política de multa e juros** (`apps/api/test/mora.e2e.spec.ts` — **novo**)

> Esta subseção nasceu do challenge de 2026-08-09. Os 37 casos originais provavam a mora **apurada**
> (CT-522 a CT-529) e a autorização das rotas (CT-533/534), e deixavam sem prova o **comportamento
> das duas rotas** que a fatia publica: nenhum caso exercitava o `PUT` bem-sucedido, o upsert, o `GET`
> da empresa sem linha, nem qualquer das recusas de entrada que a §6.1 declara. Regra declarada sem
> caso que a falsifique é regra que ninguém verifica.

- **CT-538 — a política é gravada, regravada e lida, e a ausência de linha lê zero** · CA-11.
  Objetivo: as duas rotas fazem o que declaram, o upsert é uma escrita só, e a RD-21 vale. Fluxo:
  `GET` numa empresa que nunca configurou → `PUT {2, 1}` → `GET` → `PUT {5, 0.5}` → `GET` → contar as
  linhas de `negocio.configuracao_de_mora` da empresa. Validações: o primeiro `GET` responde **`200`
  com `{ multaPercentual: 0, jurosPercentual: 0 }` e a contagem de linhas é `0`** — a leitura não
  criou nada; os `PUT` respondem `200` **ecoando o corpo gravado**; as leituras seguintes devolvem o
  último gravado; e a contagem termina em **`1`**, não `2` — é o que distingue `ON CONFLICT DO UPDATE`
  de um `INSERT` que acumularia. Controle de isolamento: a empresa B, configurada com outro par, lê o
  **dela** na mesma bateria. ⚠️ A contagem de linhas é o discriminador do upsert; sem ela, uma
  implementação que inserisse uma linha por chamada passaria em todas as leituras.
- **CT-539 — a entrada da política recusa fora de faixa, fora de escala e corpo parcial** · CA-11.
  Objetivo: as regras da §6.1 existem na borda, e a recusa nomeia o campo. Fluxo: seis `PUT`
  malformados sobre uma empresa **já configurada** com `{2, 1}` → reler. Validações: `422` com o
  envelope inteiro da ADR-0017 nos seis, com `campo` igual a `multaPercentual` (`-1` e `100.01`),
  `jurosPercentual` (`0.005`, fora da escala 0.01) e `corpo` (chave desconhecida; corpo vazio `{}`;
  corpo com só um dos dois campos — **campo ausente é recusa, nunca "preserve o atual"**, que é a
  decisão da §4.1.1). E, depois dos seis, a releitura devolve **`{2, 1}` intacto**: recusa não
  escreve. Controle positivo: `{0, 0}` e `{100, 100}` são **aceitos** — as bordas da faixa são
  fechadas, e sem o controle o caso passaria com uma validação que recusasse tudo.

### 19.4 Cenários de Erro e Segurança

| Cenário | CT | CA | Objetivo | Trigger | Status / Log Esperado |
|---------|----|----|----------|---------|------------------------|
| A captura não despacha mensagem alguma | CT-502 | CA-01 | O despachante real é substituído nos dois call sites, e o contador de invocações vale `0` | `capturar.py` executando a régua contra site efêmero | Golden com `destinatario`/`assunto`/`corpo` por cenário e contador `0`. **Prova de falsificação**: remover a substituição de UM dos dois pontos faz a asserção reprovar nomeando `emailer.py:203` ou `:251` |
| Segunda derivação do estado em TypeScript | CT-510 | CA-04 | Metade **estrutural** do CA-04: os quatro literais de estado não aparecem em posição executável de decisão em `packages/db/src/**` nem `apps/api/src/**` | varredura de fontes + introspecção do catálogo | Lista ordenada de arquivos igual a `['packages/contracts/src/cobranca.ts']`; `cobranca` sem coluna `status`; `cobranca_derivada` com `status` do tipo `negocio.status_cobranca`. **Falsificação**: um ternário em `cobranca.service.ts` faz reprovar nomeando o arquivo |
| View sem `security_invoker` vaza entre empresas | CT-523 | CA-11 | A ausência do atributo é detectada por **duas vias independentes**: a guarda de catálogo e o vazamento comportamental | duas variantes da view em instância dedicada — uma pelo papel de migração, outra pela superusuária | Com o atributo: interseção `[]` e `excecoes === []`. Sem: interseção **igual** ao conjunto de B, e `excecoes` com `{ tabela: 'negocio.cobranca_derivada', motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO' }` — ⚠️ o campo é **`tabela`**, e não `objeto`: é o nome real em `ExcecaoDeIsolamento`, e o docblock de `tabelasExaminadas` registra por que ele se chama assim. **Falsificação da migração**: `0010` sem o atributo faz o CT-522 reprovar |
| Rota publicada sem declaração de exigência | CT-533 | CA-17 | As 7 rotas novas declaram exatamente a área devida, e **nenhuma** chave `ACAO:*` | enumeração da aplicação de produção montada, por duas medições independentes | `semDeclaracao === []`; 5 rotas com `['TELA:financeiro']` e 2 com `['TELA:multa_e_juros']`; total **82 pares / 67 manipuladores**, concordantes nas duas medições; catálogo de áreas inalterado |
| Operação sem alcance à área de tela | CT-534 | CA-17 | Recusa em todas as 7 rotas **e** nenhuma alteração de estado | sessões sem `TELA:financeiro` e sem `TELA:multa_e_juros` | Sete `403` com o envelope da ADR-0017, idênticos entre si e **indistinguíveis entre perfis**; `xmin` da cobrança e valores da configuração inalterados; **controle positivo**: a sessão com as duas áreas não recebe `403` em nenhuma |

> ⚠️ **Alterar `ROTAS_PUBLICADAS_EM_PRODUCAO = 75` exige `SUT_IS_CORRECT_BECAUSE:`.** O docblock de
> `cobertura-de-autorizacao.e2e.spec.ts:854-881` registra por que a âncora é 75 e não 77, e **a razão
> continua valendo**: a supressão do `HEAD` derivado faz 7 rotas somarem 7 pares, não 14.

### Cenários não cobertos, e por quê

1. **Concorrência real na emissão do código.** O mecanismo é o mesmo do contrato (ADR-0020), já
   provado na fatia anterior — reprovar aqui seria duplicação cross-layer (AP-23). O que esta fatia
   prova é a **instância nova**: assinatura sem empresa, guarda de faixa, ausência de privilégio
   (CT-535) e o furo aceito (CT-536).
2. **Desempenho da view sob carteira grande.** Teste de carga está fora do escopo por decisão de
   projeto; o risco está declarado na §12.3.
3. **Virada do dia durante a execução da suíte.** A fronteira se monta pelo **dado** (CT-513); um caso
   dependente da hora de execução seria flaky por construção, e a `testing-stack.md` proíbe retry.
4. **Emissão de boleto e uso efetivo dos 6 campos de conciliação.** É a F4. O CT-532 prova apenas que
   o pagamento não os apaga.
5. **Porte da régua.** Esta fatia apenas **captura** a referência (CT-501 a CT-503).
6. **Recusa de valor de canal (RN-17).** Não há campo de canal publicado por esta fatia — ver §21.

### Recomendações que a implementação deve carregar

- **Três `DECISÃO FECHADA`** (largura 7 · leitura só pela view · `security_invoker` e ausência de
  privilégio na sequência) — detalhadas na §21.
- **NÃO tocar `packages/db/src/catalogo.ts` — a guarda já cobre a espécie VIEW.** Medido contra o
  código: `MotivoDeExcecao` já tem `VISAO_NAO_DELEGA_ISOLAMENTO`; `LinhaDeCobertura` já traz `ehVisao`
  e `delegaIsolamento`; `PROPRIEDADES_DA_VISAO` já cobra a delegação; `propriedadesDe()` já escolhe o
  conjunto pela espécie; e a consulta já extrai `security_invoker` de `pg_options_to_table(reloptions)`
  normalizado por cast, com `COALESCE(…, 'false')` fechando a ausência. A região tem **`DECISÃO
  FECHADA` — T4 / Gate 2 · 2026-08-02** sobre o exame por exclusão de `relkind`, e o que ela protege é
  exatamente isto. A fatia **se submete** à guarda; ela não a estende, não a move e não a reescreve.
  A única coisa que muda é a expectativa das suítes que já a consomem: `cobranca_derivada` passa a
  constar em `tabelasExaminadas` sem exceção associada.
- **Baseline de 665 casos** antes e depois (P1/P5). O CT-537 substitui o CT-429 e o CT-508 altera
  `EFEITOS_ESPERADOS` — as duas exigem `SUT_IS_CORRECT_BECAUSE:`, e **a contagem final não pode cair**.
- **Os cinco valores de `natureza_cobranca` são criação do produto, não porte.** Medido: o DocType
  `Cobranca` do legado (48 campos) **não tem campo de natureza** — "novo título" se distingue apenas
  pelo texto de `referencia`. Não há lista real a confirmar contra o dado antigo; o CT-537 os congela.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **`security_invoker` omitido ou perdido numa regeração** — a view passa a rodar com os direitos da dona e devolve cobrança de outra empresa, furando a ADR-0008 por dentro do objeto que a ADR-0023 autorizou | baixa | **crítico** | O `0010` é autoral e nunca regerado; caso de isolamento de duas empresas **sobre a view** + prova de falsificação removendo o atributo; e a guarda de `catalogo.ts`, que **já cobre a espécie VIEW desde a F2** e reprova a view sem o atributo sem precisar de edição alguma |
| **Derivação de estado reaparecer em TypeScript** por conveniência de um consumidor futuro — reabre exatamente o defeito de origem (três avaliações divergentes) | **média** | alto | Asserção estática com falsificação sobre a ausência; `DECISÃO FECHADA` no ponto da porta declarando que a leitura vai na view; §3.3 registra a proibição |
| **Saturação iterativa implementada como não-iterativa** (RD-19) — passa em todo cenário com dia ≤ 28 e diverge do legado só nos iniciados em 29–31 | **média** | alto | Os dois cenários de `2027-01-31` do golden são o discriminador, e o terceiro período (`28/03`) é asserido nominalmente; mutante medido na task |
| **Falha da intercepção do envio na captura** (US-01) — 837 LOC portadas na fatia 2 sem oráculo, e **a janela não reabre** | média | **alto** | Ordem de queda fixada **antes** de começar (substituir despachante → servidor local que descarta → piso das frentes puras); a captura é a **primeira** task, com duas fatias de folga |
| **Perda de centavo em alguma composição** (RN-16) — juros proporcionais a dias é onde o arredondamento discrimina | baixa | alto | Aritmética inteiramente em `numeric`; igualdade **centavo a centavo** contra o golden, jamais tolerância; `1234.56` com 5 e 17 dias no conjunto |
| **Regressão em `contrato.service.ts`** — arquivo com marcadores e literais fixados, e a fatia precisa afrouxar um `z.literal` | média | alto | Protocolo Antirregressão com força máxima; as três linhas do P3 obrigatórias; o marcador do D28 sai **no mesmo commit**; baseline de 665 casos antes e depois |
| **Fuso do banco divergir do esperado** e a virada do dia acontecer em hora errada, movendo a transição para `VENCIDA` | baixa | médio | `data_corrente_da_operacao()` fixa a zona **no objeto**, sem depender da sessão; caso de fronteira montado **pelo dado**, não pelo relógio |
| **Ordem das instruções da migração gerada** mudar numa regeração e uma FK preceder o alvo | baixa | médio | Conferência declarada a cada regeração (§7.3), como o `0007` já registra; a suíte de coerência de migrações aplica os arquivos do disco |
| **Rollback sem backup provado** — o item 1 da F7 ainda não existe | baixa | médio | As duas migrações são **aditivas**, de modo que voltar o binário não exige tocar o schema; registrado como dependência do marco |
| **Colisão de identificador `Dnn`** ao registrar débitos desta fatia | média | baixo | A sequência corre dentro da §2 do `run-report.md` **desta** fatia (§3-B da `nao-regressao.md`); o par `Dnn · F3/Tn` é o identificador |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

Confrontadas **contra o texto integral da `Decision`**, não contra a linha-resumo do `INDEX.md`.

| ADR | Classificação | Onde toca, e o que satisfaz literalmente |
|---|---|---|
| **ADR-0008** — isolamento garantido pelo banco | **APLICÁVEL** | §7.2: as duas tabelas nascem com `empresa_id`, RLS `USING`+`WITH CHECK` e FK composta `(contrato_id, empresa_id)`. §11.4: a aplicação **não** implementa filtro por empresa equivalente. A view herda o invariante pelo `security_invoker` |
| **ADR-0009** — fronteira por schema, cobertura consultada no catálogo | **APLICÁVEL** | §7.2: as duas tabelas em `negocio`, RLS **forçada**; a varredura de `catalogo.ts` passa a cobri-las **sem edição** — ela é definida por exclusão de `relkind` e já examina tabela e visão, o que é a própria decisão que o `DECISÃO FECHADA` de lá protege. Cobertura consultada, nunca lista mantida à mão |
| **ADR-0011** — cobertura por rota, default que nega | **APLICÁVEL** | §11.2: as 7 rotas declaram; `semDeclaracao` continua vazio. O catálogo **fechado nas 7 chaves não é aberto** — nenhuma chave nasce |
| **ADR-0014** — entidade de cadastro nunca é apagada | **APLICÁVEL — obedecida no invariante** | A `Decision` **nomeia "cobrança"** na lista. O invariante literal — *"nunca é removida fisicamente… o registro permanece legível por quem já o referencia"* — é cumprido: não existe `DELETE`, não existe rota de exclusão, e o cancelamento é transição que preserva o registro e o código (RD-12, §7.5). O mecanismo *"excluir significa retirar de circulação"* **não tem instância** porque a fatia não publica ato de exclusão de cobrança — e o legado também não tem (só `PUT status='Cancelada'` e substituta). Os *Neutros* da própria ADR delegam à fatia *"como a marcação se chama, se aparece na API, e se há reativação"*. ⚠️ **Divergência escalada, resolvida e o PRD corrigido em 2026-08-09**: a §9 dizia *"ADR-0014 não se aplica a fato financeiro"*, o que contradizia a própria §1 do PRD (que já listava a 0014 entre as decisões vinculantes). A frase passou a declarar que a ADR **se aplica e é obedecida**, e que a "retirada de circulação" não tem instância por não haver exclusão a traduzir |
| **ADR-0015** — contador por empresa, furo aceito, nunca reusado | **APLICÁVEL** | §7.2: escopo `(empresa, ano)` declarado; as duas unidades sequenciais da §7.4 são o que impede o reuso por criação abortada |
| **ADR-0016** — o esquema é a fonte única | **APLICÁVEL** | §4.2: conferência, tipo e documento derivam dos esquemas Zod; nenhuma descrição escrita à mão em paralelo |
| **ADR-0017** — três classes de chave exposta | **APLICÁVEL** | A `Decision` **nomeia "contrato e cobrança"** como as entidades com série declarada. §4.1: a chave exposta é o `codigo`, o UUID não trafega, o corpo fala camelCase, `status` é calculado no servidor, a lista devolve `{itens, total, limite, deslocamento}` e o erro é `{codigo, mensagem, campo?, detalhes?}` |
| **ADR-0018** — conjunção de exigências e cobertura por conteúdo | **PARCIAL** | Nenhuma rota desta fatia declara **conjunção** (todas têm exigência única). A segunda metade aplica-se por inteiro: §3.6 estende a guarda para conferir o **conteúdo** das 7 declarações novas |
| **ADR-0020** — número emitido por contador do banco, fora do desfazimento | **APLICÁVEL** | §7.2: `nextval` em função `SECURITY DEFINER`, sem parâmetro de empresa, e **nenhuma concessão sobre a sequência** — a mesma decisão que o `DECISÃO FECHADA` do `0008` protege |
| **ADR-0021** — transição é rota própria, governada pela natureza do ato | **APLICÁVEL** | §4.1: pagamento e cancelamento são **rotas próprias**, nunca campo de atualização. A classificação dos dois atos e a evidência do catálogo estão na §11.2 |
| **ADR-0022** — o que se grava e o que se deriva | **APLICÁVEL** | §7.2: derivado enquanto aberto, gravado no ato que liquida **junto da configuração vigente** (os dois percentuais, não só os valores); o estado publicado é derivado, **nunca coluna movida por rotina** |
| **ADR-0023** — onde vive a derivação | **APLICÁVEL** | §3.1 e §7.2: a derivação participa de seleção (filtro/ordenação/paginação por estado) e compõe aritmética monetária, logo **vive no banco**; e preserva o isolamento por empresa pelo `security_invoker` — a obrigação literal da `Decision` |
| **ADR-0005** — rotinas operacionais versionadas | **PARCIAL** | Só o que já existe: as migrações entram no `migrar-banco.sh` idempotente. Nenhuma rotina agendada nasce aqui |
| **ADR-0006** — ambiente de verificação separado | **APLICÁVEL** | §19: instâncias efêmeras próprias; a captura de US-01 roda contra **site efêmero restaurado de dump**, nunca contra o site `frontend`, que é produção |
| **ADR-0001** — modelo canônico de cobrança bancária com adaptador por provedor | **N/A** | Nenhuma integração bancária existe nesta fatia; os campos de conciliação nascem nulos e sem produtor |
| **ADR-0010** · **ADR-0013** | **N/A** | Efetivo de permissão e alcance da garantia do Master — herdados, não tocados |
| **ADR-0002** · **0003** · **0004** · **0007** · **0012** · **0019** | **N/A** | `deprecated` ou `superseded` — não se citam. As formas vigentes são **0017** e **0021** |

### Conflitos spec × ADR — escalados e resolvidos antes desta spec

Três, todos apresentados ao usuário com o texto literal da ADR contra a decisão da spec:

1. **ADR-0014 nomeia "cobrança"**, e o PRD §9 dizia que ela não se aplica. **Resolvido**: obedecer o
   invariante sem eixo de circulação (linha da tabela acima). Nenhuma rota de retirada/recirculação
   nasce. **A frase do PRD §9 foi corrigida em 2026-08-09** — ela era o erro, e não a ADR: a §1 do
   próprio PRD já listava a 0014 entre as decisões vinculantes, de modo que o documento se
   contradizia.
2. **ADR-0021 e a natureza dos atos de cobrança**. **Resolvido**: manter a decisão do PRD, com a
   classificação e a evidência do catálogo registradas na §11.2. O catálogo não abre; a ADR-0011 não é
   supersedida.
3. **RN-17 sem materialização**. **Resolvido**: ver abaixo.

### RN-17 — a regra sem lugar nesta fatia

A RN-17 (*"valores de canal que o produto não implementa são recusados na entrada"*) **não tem CA no
PRD** e **não tem onde incidir aqui**. A medição: os únicos campos de canal do produto são
`canalAVencer` e `canalVencida`, da configuração da régua, e `canal`, do log de envio — os três da
**fatia 2** (`levantamento-frontend.md` linhas 408 e 412). Esta fatia **não publica campo de canal
algum**, logo não há valor a recusar. A regra migra para a fatia 2 junto com a entidade que a
hospeda. Registrado como vão do PRD, não como escopo cortado.

### Decisões dos "pontos em aberto" do tech alignment

| # | Ponto | Decisão desta spec |
|---|---|---|
| 1 | Forma concreta da derivação de D1 e como as leituras a alcançam preservando o isolamento | **View `security_invoker = true`**, com as expressões escritas uma vez num `LATERAL`. Toda leitura atravessa a view; nenhuma escrita atravessa |
| 2 | O booleano `pagamento_confirmado` sobrevive? | **Não.** `pago_em` responde à mesma pergunta, e o `cobranca_carimbo_coerente_chk` torna o par coerente por construção. A captura (US-01) registra o comportamento legado **antes** da eliminação, que é a condição que o tech alignment impunha |
| 3 | A substituta guarda vínculo com a cancelada? | **Não.** O PRD não pede rastrear a substituição, e o mecanismo do arcabouço que a expressa morre com ele. Criar o vínculo seria estrutura sem requisito |
| 4 | Empresa sem configuração de mora | **Mora zero**, por `LEFT JOIN` + `COALESCE(…, 0)`. Nunca cobra o que ninguém configurou, e nunca falha por ausência de linha (RD-08) |
| 5 | Valores exatos da lista fechada de natureza | Os **cinco do PRD** (`ALUGUEL`, `AGUA`, `CONDOMINIO`, `ENERGIA`, `OUTRO`). Medido contra o legado: a `Cobranca` de lá **não tem campo de natureza** (48 campos inspecionados) — "novo título" se distingue só pelo texto de `referencia`. Não há lista real a confirmar; a lista é criação do produto |
| 6 | Aviso ao operador quando a política muda | **Fora desta entrega**, como o PRD §9 registra. É consideração de experiência, a comunicar no handoff |
| 7 | D32 | **Não dispara aqui.** Nada nesta fatia enfileira; o gatilho é a fatia 2 |

### Medições feitas para esta spec (fatos, não estimativas)

- **`autoname` da `Cobranca` no legado = `COB-.YYYY.-.#######` → SETE dígitos.** Série viva em
  `COB-2026-0000058`; 16 registros para 58 números emitidos, o que confirma que a série **admite furo**
  e nunca reusa, exatamente como a ADR-0015 descreve. ⚠️ **É 7, não 5** — a largura do contrato é outra,
  e "harmonizar" as duas produziria código fora do formato que o usuário reconhece. **Exige marcador
  `DECISÃO FECHADA` em `packages/contracts/src/cobranca.ts`**, no molde do que a T2 da fatia de
  contratos deixou.
- **O terceiro `Custom Field` de negócio é `pdf_boleto_arquivo`** (Attach) — resolve a `[DÚVIDA] 3` do
  discovery, e ele pertence à **emissão de boleto (F4)**, que o PRD §4.2 já exclui. A coluna
  `boleto_arquivo` nasce aqui **nula e sem produtor**, pelo molde `D1`.
- **A `Cobranca` legada aponta para `contrato` E para `locatario`**, os dois `reqd`. A FK dupla **não é
  portada** (C-d do discovery): o `locatarioId` publicado é derivado da junção.
- **O efeito de envio da régua está em dois call sites** — `emailer.py:203` e `emailer.py:251`. É o
  que torna a opção 1 da ordem de queda viável a custo baixo.

### Glossário de domínio — conferido, e cinco termos novos

`docs/specs/domain-glossary.md` foi lido; **não há glossário-feature**. Quatro entradas dele governam
esta spec e foram seguidas à letra:

- **Série declarada** — *"o contador reinicia quando o escopo dela inclui o ano"* → §7.2, escopo
  `(empresa, ano)`. E a advertência de **não confundir com o "Número sequencial do provedor"**, que
  nunca reinicia — este último é F4, e nada aqui o toca.
- **Área de tela** — a lista fixa nomeia **"Multa e juros"**, e é dela que sai o caminho
  `/v1/multa-e-juros`, em vez de um `/v1/configuracoes/mora` inventado.
- **Ação sensível** — *"uma das sete operações de impacto"*, e a enumeração **não inclui** pagamento
  nem cancelamento de cobrança. É a mesma evidência da §11.2, agora também no vocabulário canônico.
- **Carteira** — *"sempre qualificada"*. Esta spec escreve **carteira de cobranças**, nunca "carteira".
- **Retirada de circulação** — definida como operação sobre **cadastro**, que *"deixa de ser oferecido
  ao montar um contrato"*. Não há leitura em que ela alcance um fato financeiro, o que corrobora a
  resolução do conflito da ADR-0014.

**Oito termos novos foram canonizados no GLOBAL** pelo `/agent-spec-challenge-spec` de 2026-08-09:
**Cobrança**, **Cobrança em aberto**, **Mora**, **Configuração de mora**, **Carimbo**, **Natureza da
cobrança**, **Competência** e **Referência**. Os cinco primeiros previstos por esta spec, mais três
que a sessão levantou: `Carimbo` (o conceito central da ADR-0022, usado em toda a §7.2 sem definição
canônica), `Cobrança em aberto` (par do `Boleto em aberto` que já existia) e `Configuração de mora`.
Todos no global — F4 e F5 leem cobrança.

⚠️ **`Cobrança` fechou um vão que precedia esta fatia**: o glossário já a usava em dois
*Relacionamentos* (*"Uma Cobrança pode originar um boleto"*) **sem nunca a definir** na seção Termos.

Quatro ambiguidades resolvidas foram registradas junto: natureza × referência ("novo título"),
cobrança em aberto × boleto em aberto, os três sentidos de "atraso", e cancelar × excluir cobrança —
esta última corroborando por escrito, no vocabulário canônico, a resolução do conflito da ADR-0014.

### Candidatos a ADR — aplicação dos 5 critérios canônicos

Nenhum candidato **confirmado**. As duas decisões transversais desta fatia já foram registradas
**antes** desta spec, e é por isso que ela não gera ADR nova: a **ADR-0022** (o que se grava e o que se
deriva) e a **ADR-0023** (onde a derivação vive) cobrem exatamente o material que produziria uma.

Dois **candidatos parciais**, registrados para não se perderem:

1. **`security_invoker` como forma canônica de todo objeto derivado no banco.** C1 ✅ transversal (F4 e
   F5 leem cobrança e podem querer derivar); C2 ✅ `security`/`data`; C3 ✅ reverter é migração; C5 ✅ a
   alternativa (view com direitos da dona mais filtro explícito por `empresa_id`) foi considerada e
   rejeitada por reintroduzir o segundo caminho para o dado que a ADR-0008 elimina. **C4 falha**: a
   ADR-0023 já escreve a obrigação (*"objeto derivado com direitos próprios não é admitido"*), e o
   `security_invoker` é o **mecanismo óbvio** dela em PostgreSQL — registrá-lo de novo seria churn, e
   o lugar certo é o comentário do `0010`, que esta spec exige.
2. **Data corrente da operação como função única com fuso fixo no objeto.** C1 ✅; C2 ✅ `data`;
   C4 ✅ (a alternativa idiomática é `CURRENT_DATE`, e a razão de recusá-la não se lê no código);
   C5 ✅ (`CURRENT_DATE` com `TimeZone` de sessão, e relógio da aplicação injetado, foram avaliados e
   rejeitados no tech alignment D2). **C3 falha**: hoje há **um** consumidor, e trocar a função de
   forma é edição de um objeto. Promover a ADR quando o segundo consumidor aparecer — provavelmente a
   régua, na fatia 2, que tem janela de horário.

### Débitos com gatilho — o que esta fatia fecha e o que ela não toca

| Débito | Ação nesta fatia |
|---|---|
| **D28 (F2/T7)** — `contrato.service.ts`, `cobrancasGeradas: false` | **FECHA.** O literal é afrouxado, a ativação gera as parcelas, e o marcador sai **no mesmo commit** da correção. A linha correspondente do `CLAUDE.md` é removida |
| **D36 (F2/T8)** — a guarda "sem PDF, não cancela" | **NÃO TOCA.** O gatilho é a F3, mas é a **fatia 2** que produz o documento e decide se o carimbo é pré-condição ou efeito. O marcador permanece |
| **D44 (F2/T10)** — restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao` | **NÃO TOCA.** O gatilho é a fatia que criar essa restrição no banco, e não é esta |
| **D32 (F0/T6)** — lado produtor da fila | **NÃO TOCA.** Nada aqui enfileira; o gatilho é a fatia 2 |
| **D3 (F2/T1)** — `ESQUEMA_DO_IDENTIFICADOR` com duas definições | **NÃO DISPARA** — o gatilho é abrir `usuario.controller.ts` por outra razão, e esta fatia não o abre |
| **D28 (F0/T5)** — `packages/shared/test/` por caminho relativo profundo | Já disparado e aberto. As suítes novas **não devem alargá-lo**: se precisarem do acessório, usem a fronteira do pacote |
| **D23 · D24 · D27 · D37 · D39** | **NÃO TOCA** — gatilhos na F7, na próxima instalação do zero, ou noutra superfície |

Débitos novos desta fatia numeram a partir de **D1**, dentro da §2 do `run-report.md` **desta** fatia
(a sequência corre por fatia, não globalmente — §3-B da `.claude/rules/nao-regressao.md`).

### Marcadores exigidos por esta spec

Três, e cada um com a razão que a §3 da `nao-regressao.md` cobra:

1. **`DECISÃO FECHADA`** em `packages/contracts/src/cobranca.ts`, sobre a **largura 7** do sequencial —
   valor medido no legado, divergente da largura 5 do contrato, e é o título que o usuário reconhece.
   `REVERTER EXIGE`: medir de novo o `autoname` no sistema antigo.
2. **`DECISÃO FECHADA`** em `packages/db/src/cobranca.ts`, sobre **toda leitura atravessar a view** —
   é a unicidade estrutural que fecha o defeito de três derivações divergentes. `REVERTER EXIGE`:
   provar que nenhum caminho de leitura alcança a cobrança sem passar pela view.
3. **`DECISÃO FECHADA`** em `packages/db/migracoes/0010_seguranca_cobranca.sql`, sobre o
   **`security_invoker = true`** — sem ele a view fura a RLS. `REVERTER EXIGE`: provar que a view
   preserva o isolamento por empresa por outro mecanismo, medido com duas empresas.

### Débito que esta fatia REGISTRA (marcador novo)

Um, e ele nasce do challenge de 2026-08-09:

- **`DÉBITO COM GATILHO`** em `packages/contracts/src/cobranca.ts`, no ponto do import.
  **O QUÊ**: `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` são vocabulário monetário de todo o
  produto, mas moram em `contrato.ts` porque foi lá que nasceram — e `cobranca.ts` passa a ser o
  **segundo** consumidor, importando de um módulo irmão em vez de do comum.
  **QUANDO FECHA**: no **terceiro** consumidor monetário do pacote (a emissão de boleto da F4 é a
  candidata óbvia) — aí as duas sobem para `comum.ts` de uma vez, com os três call sites ajustados no
  mesmo commit.
  **POR QUE NÃO AGORA**: promover exigiria editar superfície publicada de um módulo estável, com
  marcador, dentro de uma fatia que não pede isso; e com dois consumidores o import lateral ainda é
  a forma mais barata que **não** duplica a definição.
  **ÍNDICE**: `docs/specs/features/cobranca-e-mora/v1/_run/run-report.md` §2, o `Dnn` que a §2 desta
  fatia atribuir.

> A numeração sai da §2 do `run-report.md` **desta** fatia, na hora do registro — não deste texto.
> E a linha correspondente entra no bloco de débitos com gatilho do `CLAUDE.md`, pela §3-B.

O marcador `DÉBITO COM GATILHO` do **D28** é **removido**, e a linha correspondente sai do bloco do
`CLAUDE.md` (a checagem nos dois sentidos da §3-B roda no fecho da fatia).

### Ordem sugerida das tasks (o task plan decide; isto é insumo)

1. **Captura do oráculo da régua** — primeira **por prazo**, não por dependência. Nada mais depende
   dela, e é a única coisa que deixa de ser possível se demorar.
2. Contrato (`@sysloc/contracts`) — enums, formato do código, esquemas.
3. Schema e migração `0009` (gerada).
4. Migração `0010` (autoral) — RLS, funções da série, `data_corrente_da_operacao`, **a view**.
5. Porta de dados da cobrança + a função pura de parcelas.
6. Configuração de mora — porta, contrato e as 2 rotas.
7. As 5 rotas de cobrança.
8. Ativação gera parcelas + cancelamento em cascata (**fecha o D28**).
9. Cobertura de autorização e âncoras de superfície.

> As tasks 3 e 4 **não** paralelizam com nada: migração é ledger com ordem compartilhada, e a
> `agent-spec-workflow-rules.md` a classifica como arquivo de alta contenção.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-10 mapeadas em 5.3 e 17)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6) — RN-01 a RN-17 rastreadas em RD-01 a RD-20
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8) — N/A justificado
- [x] Sincronização: eventos, idempotência (seção 9) — N/A justificado
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13)
- [x] Feature flags listadas (seção 14) — nenhuma, com a ressalva sobre `gerarCobrancasAutomaticamente`
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura: pipeline, empacotamento, IaC, rollout (seção 16)
- [x] Dependências externas listadas (seção 18) — nenhuma nova
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19) — **39 casos** (37 do gerador + CT-538 e CT-539 do challenge), rastreabilidade CA→CT completa nas duas direções (17/17 CA cobertos, nenhum CA inexistente citado), JSON lossless em `_run/test-cases.json` — ⚠️ o JSON tem os **37 originais**; os dois do challenge vivem só aqui, e a task markdown é canônica
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21), com inventário de ADRs confrontado contra a `Decision`
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4-3.7)
- [x] Cada CT aparece em **exatamente uma** subseção da §19 (5 + 15 + 14 + 5 = 39) e tem ID único
- [x] Cada arquivo de teste da árvore (§3.4) hospeda ao menos um CT nomeado, e cada CT tem arquivo
- [x] Pronto para geração das TASKS
