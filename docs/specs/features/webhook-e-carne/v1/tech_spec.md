# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: `webhook-e-carne` — fatia (iii) e última da F4 (integração bancária)
- **Variante**: backend
- **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js · PostgreSQL 18 (RLS forçada) · Zod 4 · BullMQ + ioredis + Redis 7 · Vitest + `embedded-postgres` · pnpm 11 + Turborepo + Biome
- **Autor**: sysloc (usuário) · tech spec conduzida por `/agent-spec-sdd-generate-tech-spec`
- **Data**: 2026-08-18
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/webhook-e-carne/v1/prd.md` (aprovado 2026-08-18)
- **Tech Alignment**: `docs/specs/features/webhook-e-carne/v1/tech-alignment.md` (decidido 2026-08-18) — D1 a D6 e as 4 decisões diretas são **ponto de partida respeitado**; esta spec as instancia e fecha os 5 pontos que ela delegou ao arquiteto
- **Design Relacionado**: — (variante backend; não se aplica)

> **Autonomia do run (A1).** Nenhuma pergunta foi feita ao usuário: `.claude/rules/autonomia-do-run.md`
> é autorização permanente e manda **decidir pela recomendada e registrar**. As decisões
> auto-resolvidas estão registradas na **§21.1**, cada uma com as alternativas concorrentes, a
> escolhida e a razão em uma linha. A variante (**backend**) foi decidida pelo mesmo mecanismo: este
> repositório **só faz backend** (Fronteira do `CLAUDE.md`), o `tech-alignment.md` declara
> `Variante: backend`, e o `_run/sdd_state.yaml` já carregava `variant: backend`.

---

## 2. Resumo Técnico da Solução

A fatia acrescenta **uma entrada** e **uma saída**, e nenhuma regra de liquidação nova.

A **entrada** é uma rota pública única (`POST /v1/notificacoes-bancarias`) que persiste o recebido
**cru** em `plataforma.notificacao_bancaria` — tabela sem `empresa_id`, fora do alcance da RLS
(ADR-0031) —, responde **`204 No Content`** e enfileira. Quem trata é uma tarefa do processo de
trabalho: ela roteia **apenas** pelo *Identificador perante o provedor* (18 posições, emitido por
nós), descobrindo a empresa por uma função `SECURITY DEFINER` **sem parâmetro de empresa**, de papel
`NOLOGIN` de propósito único (`sysloc_roteamento`) — o mecanismo que a **emenda da ADR-0024**
institui e nomeia como herdeiro deste caso. Descoberta a empresa, o contexto de tenant é fixado e o
caminho volta ao normal: o resto do recebido é **conferência**, o que não casa morre **antes** de
qualquer consulta, e o efeito nasce **exclusivamente** da resposta do provedor à pergunta que o
produto faz — pelas mesmas `liquidarPeloProvedor` / `estornarLiquidacao` / `revogarBoleto` da fatia
(ii), com uma **terceira origem** na trilha (`NOTICIA_DO_PROVEDOR`) para a CA-13.

A **saída** é o carnê: `GET /v1/contratos/:codigo/carne`, que reúne os boletos das cobranças do
contrato num intervalo de competências, **em linha**, compondo sobre `BoletoService.entregar` — que
já resolve ler do disco, distinguir ausência de falha real, rebuscar do provedor e recusar nomeando.
A mesclagem entra por uma porta nova em `@sysloc/documentos`, satisfeita por `pdf-lib`: ela **copia
páginas**, sem re-renderizar, preservando intactos os bytes que o provedor emitiu (ADR-0030,
cláusula de exclusão).

A superfície publicada cresce de **99 pares / 84 manipuladores** para **101 / 86**, `publicas` de 19
para 20, `semDeclaracao` permanece **vazio**, e é a última vez que ela cresce antes da F5.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                        ┌───────────────────────────────────────────────┐
   Provedor  ──HTTPS──▶ │ borda (nginx, vhost dedicado)                 │
   (Sicoob)   :443      │ location = /v1/notificacoes-bancarias  ─┐     │
                        │ tudo o mais: 404, sem redirecionamento  │     │
                        └─────────────────────────────────────────┼─────┘
                                                                  ▼
    ┌──────────────────────────── apps/api (127.0.0.1) ────────────────────────────┐
    │ NotificacaoBancariaController  @RotaPublica()                                │
    │   1. registrarNotificacaoBancaria(cru)   → plataforma.notificacao_bancaria   │
    │   2. resposta 204, SEM CORPO             ← o desfecho nunca compõe a resposta │
    │   3. produtor.enfileirarNotificacaoBancaria({ notificacaoId })               │
    │                                                                              │
    │ ContratoController.carne  @ExigeChave(TELA:contratos)                        │
    │   → CarneService.compor → BoletoService.prepararEntrega/entregar (por boleto) │
    │                         → PortaDeMesclagem.mesclar → bytes (application/pdf)  │
    └──────────────────────────────────────────────────────────────────────────────┘
             │ fila `notificacao-bancaria` (BullMQ/Redis)          ▲
             ▼                                                    │ consulta ao provedor
    ┌──────────────────────── apps/worker ──────────────────────┐  │ (rebusca do documento)
    │ processarNotificacaoBancaria                              │  │
    │   a. lê o cru pelo id (sem contexto de tenant)            │  │
    │   b. interpreta → validação de endereço? ilegível?        │  │
    │   c. rotear_notificacao_bancaria(identificador)  ◀── SECURITY DEFINER
    │   d. empresa = a da COBRANÇA   → contextoDeTenant.executarCom
    │   e. confere · suspensa? · reentrega?                     │
    │   f. adaptador.consultarSituacao → grava o que ele disser │
    │   g. marca o desfecho no cru · expurga o cru > 90 dias    │
    └───────────────────────────────────────────────────────────┘
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `NotificacaoBancariaController` | Recebe a notícia, persiste o cru, responde `204`, enfileira. Não interpreta, não roteia, não decide. | Borda HTTP (apps/api) |
| `NotificacaoBancariaService` | Compõe as três etapas da borda numa ordem só e traduz a falha de enfileiramento em registro (nunca em recusa ao provedor). | Aplicação (apps/api) |
| `CarneService` | Seleciona as cobranças do recorte, obtém os boletos pela via existente e manda mesclar. | Aplicação (apps/api) |
| `PortaDeMesclagem` | Interface declarada pelo domínio de documentos: *"junte estes documentos prontos num só"*. | Domínio (packages/documentos) |
| `criarMescladorPdf` | Adaptador `pdf-lib` que satisfaz a porta copiando páginas, sem re-renderizar. | Infraestrutura (packages/documentos) |
| `processarNotificacaoBancaria` | Roteia, confere, decide o desfecho, consulta o provedor, grava o efeito e expurga o vencido. | Borda de fila (apps/worker) |
| `notificacao-bancaria.ts` (db) | Acesso à tabela crua e à função de roteamento. Nenhuma regra de negócio. | Dados (packages/db) |
| `negocio.rotear_notificacao_bancaria` | A **única** leitura desta fatia sem contexto de empresa — nominal, auditável, sem parâmetro de empresa. | Banco |
| `plataforma.notificacao_bancaria` | O recebido cru, sem dono-empresa, com desfecho e prazo de guarda. | Banco |
| vhost + `verificar-borda-de-notificacao.sh` | Publica **um** caminho e prova que só ele responde. | Infraestrutura (deploy) |

### 3.3 Camadas e Fronteiras

Hexagonal por dentro, camadas por fora — como o resto do monorepo, e sob a **ADR-0025**: quem declara
a porta é o pacote de domínio, quem a satisfaz importa dele, e a porta chega por **parâmetro/injeção**,
nunca por `import` do domínio para a infraestrutura.

Três fronteiras merecem registro nesta fatia:

1. **A borda HTTP não interpreta.** O controlador não valida o corpo para aceitar ou recusar: ele
   persiste o que chegou. A interpretação vive na tarefa, e o fracasso dela é um **desfecho**
   (`ILEGIVEL`), nunca um `422`. Ver a §21.2 — é uma divergência **declarada** de
   `.claude/rules/contrato-publicado.md`, e a razão está lá.
2. **O roteamento é do banco, não da aplicação.** Não existe `SELECT ... WHERE identificador = $1`
   escrito na aplicação contra `negocio.cobranca`: existe uma chamada à função que atravessa a
   política de linha por caminho nominal. A aplicação não tem, e não pode ter, um segundo caminho
   para o dado (ADR-0008).
3. **O carnê compõe, não reimplementa.** Ele **não** conhece a guarda de boletos, nem o adaptador do
   provedor, nem a cifra do certificado: tudo isso já está dentro de `BoletoService.entregar`, e o
   carnê o chama por boleto. Um segundo caminho para "obter os bytes de um boleto" seria o defeito
   que a `.claude/rules/nao-regressao.md` §7 documenta.

### 3.4 Visão em Árvore

```
apps/
├── api/
│   ├── src/
│   │   ├── app.module.ts                                    [M]
│   │   ├── cobrancas/
│   │   │   ├── boleto.service.ts                            [R]
│   │   │   ├── carne.service.ts                             [N]
│   │   │   └── cobrancas.module.ts                          [M]
│   │   ├── comum/
│   │   │   └── produtor-de-fila.ts                          [M]
│   │   ├── configuracao/
│   │   │   └── ambiente.ts                                  [M]
│   │   ├── contratos/
│   │   │   ├── contrato.controller.ts                       [M]
│   │   │   └── contratos.module.ts                          [M]
│   │   ├── master/
│   │   │   └── empresa.service.ts                           [M]
│   │   └── notificacoes-bancarias/
│   │       ├── notificacao-bancaria.controller.ts           [N]
│   │       ├── notificacao-bancaria.module.ts               [N]
│   │       └── notificacao-bancaria.service.ts              [N]
│   └── test/
│       ├── acessorios-de-borda.ts                           [N]
│       ├── carne-do-contrato.e2e.spec.ts                    [N]
│       ├── cobertura-de-autorizacao.e2e.spec.ts             [M]
│       ├── documento.ts                                     [M]
│       ├── documento-do-contrato.e2e.spec.ts                [M]
│       └── notificacao-bancaria.e2e.spec.ts                 [N]
└── worker/
    ├── src/
    │   ├── fila.ts                                          [M]
    │   ├── main.ts                                          [M]
    │   └── tarefas/
    │       ├── conferencia-bancaria.ts                      [R]
    │       └── notificacao-bancaria.ts                      [N]
    └── test/
        └── notificacao-bancaria.spec.ts                     [N]

packages/
├── cobranca-bancaria/
│   ├── src/
│   │   ├── adaptador-sicoob.ts                              [R]
│   │   ├── index.ts                                         [M]
│   │   ├── modelo-canonico.ts                               [R]
│   │   ├── porta-de-cobranca.ts                             [R]
│   │   └── tratamento-de-notificacao.ts                     [N]
│   └── test/
│       ├── adaptador-sicoob.spec.ts                         [M]  (fecha o D38)
│       ├── tratamento-de-notificacao.spec.ts                [N]
│       └── vocabulario-canonico.spec.ts                     [M]
├── contracts/
│   └── src/
│       ├── carne.ts                                         [N]
│       ├── cobranca-bancaria.ts                             [M]
│       └── index.ts                                         [M]
├── db/
│   ├── migracoes/
│   │   ├── 0019_dominio_webhook_e_carne.sql                 [N]
│   │   └── 0020_seguranca_webhook_e_carne.sql               [N]
│   ├── src/
│   │   ├── boleto-da-cobranca.ts                            [R]
│   │   ├── catalogo-de-plataforma.ts                        [M]
│   │   ├── cobranca.ts                                      [M]
│   │   ├── esquema/
│   │   │   ├── negocio.ts                                   [M]
│   │   │   └── plataforma.ts                                [N]
│   │   ├── evento-bancario.ts                               [R]
│   │   ├── index.ts                                         [M]
│   │   ├── notificacao-bancaria.ts                          [N]
│   │   └── portador-de-confirmacao.ts                       [R]
│   └── test/
│       ├── banco-efemero.ts                                 [M]
│       ├── catalogo-de-plataforma.spec.ts                   [M]
│       ├── notificacao-bancaria.spec.ts                     [N]
│       └── roteamento-sem-contexto.spec.ts                  [N]
├── documentos/
│   ├── package.json                                         [M]  (pdf-lib)
│   ├── src/
│   │   ├── index.ts                                         [M]
│   │   ├── mesclador-pdf.ts                                 [N]
│   │   └── porta-de-mesclagem.ts                            [N]
│   └── test/
│       └── mesclador-pdf.spec.ts                            [N]
└── shared/
    └── src/
        └── fila.ts                                          [M]

deploy/
├── nginx/
│   └── sysloc-notificacao-bancaria.conf                     [N]
└── scripts/
    ├── borda/
    │   ├── instalar-borda-de-notificacao.sh                 [N]
    │   └── verificar-notificacao-bancaria.sh                [N]
    └── instalacao/
        └── provisionar-base.sh                              [M]  (papel sysloc_roteamento)

CLAUDE.md                                                     [M]  (índice de débitos)
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/contracts/src/carne.ts` | `LARGURA_MAXIMA_DO_RECORTE = 12` e `esquemaDoRecorteDoCarne` (entrada fechada, `de`/`ate` como competência no primeiro dia). | Contrato |
| `packages/db/src/esquema/plataforma.ts` | `pgSchema('plataforma')`, o enum `desfecho_da_notificacao` e a tabela `notificacao_bancaria`. **Sem `empresa_id`** e **sem** `enableRLS()`. | Dados |
| `packages/db/src/notificacao-bancaria.ts` | `registrarNotificacaoBancaria`, `lerNotificacaoBancaria`, `rotearNotificacaoBancaria`, `marcarDesfecho`, `houveEfeitoDaLiquidacao`, `listarRetidas`, `expurgarNotificacoesVencidas`. | Dados |
| `packages/db/migracoes/0019_dominio_webhook_e_carne.sql` | Enum e tabela do cru; `RENAME COLUMN nosso_numero` (D14) com recriação da visão `negocio.cobranca_derivada`; valores novos dos enums da trilha. | Migração |
| `packages/db/migracoes/0020_seguranca_webhook_e_carne.sql` | Conferência do papel `sysloc_roteamento`; política nominal e `GRANT` mínimo sobre `negocio.cobranca`; função `SECURITY DEFINER`; `REVOKE`/`GRANT` de `EXECUTE`; `GRANT` da tabela crua a `sysloc_app`; `ALTER FUNCTION ... OWNER TO`. | Migração |
| `packages/cobranca-bancaria/src/tratamento-de-notificacao.ts` | `classificarNotificacaoBancaria` (aviso × validação de endereço × ilegível) e `ehReentregaDeEfeitoAplicado` — **funções puras**, sem I/O, declaradas pelo domínio (ADR-0025). | Domínio |
| `packages/documentos/src/porta-de-mesclagem.ts` | `PortaDeMesclagem.mesclar(documentos: readonly Uint8Array[]): Promise<Uint8Array>`. Declarada pelo domínio (ADR-0025). | Domínio |
| `packages/documentos/src/mesclador-pdf.ts` | `criarMescladorPdf()` — o **único** arquivo do repositório que conhece `pdf-lib`. | Infraestrutura |
| `apps/api/src/notificacoes-bancarias/notificacao-bancaria.controller.ts` | A rota pública, `@RotaPublica()`, `@HttpCode(204)`, e as declarações do contrato publicado. | Borda HTTP |
| `apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts` | Persistir → enfileirar, com a falha de fila registrada e **não** propagada. | Aplicação |
| `apps/api/src/notificacoes-bancarias/notificacao-bancaria.module.ts` | Composição do controlador e do serviço. | Composição |
| `apps/api/src/cobrancas/carne.service.ts` | Seleção do recorte, obtenção boleto a boleto e mesclagem; as duas recusas nomeadas. | Aplicação |
| `apps/worker/src/tarefas/notificacao-bancaria.ts` | O tratamento inteiro da notícia, mais o expurgo oportunista. | Borda de fila |
| `deploy/nginx/sysloc-notificacao-bancaria.conf` | Vhost dedicado; `location =` exato para o caminho da notícia; nada mais alcançável. | Infraestrutura |
| `deploy/scripts/borda/instalar-borda-de-notificacao.sh` | Instalação idempotente do vhost (ADR-0005). | Infraestrutura |
| `deploy/scripts/borda/verificar-notificacao-bancaria.sh` | Prova por medição: HTTPS responde, sem redirecionamento, e **nenhum** outro caminho atende. | Infraestrutura |
| `apps/api/test/acessorios-de-borda.ts` | Casa única de `pedir`, `entrar`, `conceder`, `credencialDeSessao` — **fecha o D63**. | Verificação |
| `apps/api/test/notificacao-bancaria.e2e.spec.ts` | A rota, o cru, a resposta, o inventário público. | Verificação |
| `apps/api/test/carne-do-contrato.e2e.spec.ts` | O carnê ponta a ponta, incluindo as duas recusas e a rebusca. | Verificação |
| `apps/worker/test/notificacao-bancaria.spec.ts` | Roteamento, conferência, desfechos, idempotência, retenção, expurgo, varredura de segredo. | Verificação |
| `packages/db/test/notificacao-bancaria.spec.ts` | A tabela crua, os desfechos e o expurgo. | Verificação |
| `packages/cobranca-bancaria/test/tratamento-de-notificacao.spec.ts` | Os dois predicados puros, por tabela de casos. | Verificação |
| `packages/db/test/roteamento-sem-contexto.spec.ts` | A travessia nominal: o papel, a política, o `GRANT` mínimo, o `EXECUTE` revogado de `PUBLIC`. | Verificação |
| `packages/documentos/test/mesclador-pdf.spec.ts` | A mesclagem preserva o conteúdo das páginas de origem e a ordem. | Verificação |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/contracts/src/cobranca-bancaria.ts` | `ORIGENS_DO_EVENTO_BANCARIO` ganha `NOTICIA_DO_PROVEDOR`; `TIPOS_DE_EVENTO_BANCARIO` ganha `NOTICIA_RECUSADA`. | CA-13 (a origem é o produtor do efeito) e CA-08 (a recusa é anomalia, não tentativa — ADR-0034). |
| `packages/contracts/src/index.ts` | Publicar `esquemaDoRecorteDoCarne`, `RecorteDoCarne`, `LARGURA_MAXIMA_DO_RECORTE`. | Ponto único de exportação do pacote. |
| `packages/db/src/esquema/negocio.ts` | Valores novos nos dois enums da trilha; **`nossoNumero` → `numeroDoTituloNoProvedor`** e remoção do marcador do D14. | O D14 declara *"a fatia (iii) ao consumir a coluna"* como gatilho, e esta fatia a consome. |
| `packages/db/src/cobranca.ts` | `colunasDaCobranca` deixa de traduzir o nome antigo. | Consequência direta do renome; a tradução some no mesmo commit. |
| `packages/db/src/catalogo-de-plataforma.ts` | `ROSTER_DE_PLATAFORMA` passa a conter `plataforma.notificacao_bancaria`; a **segunda direção** da igualdade ganha motivo próprio (`AUSENTE_DO_BANCO`) e caso próprio. | A ADR-0031 exige entrada por alteração explícita e revisada, e o cabeçalho do módulo já agenda a segunda direção para *"a fatia que puser a PRIMEIRA tabela no roster"*. |
| `packages/db/src/index.ts` | Exportar os símbolos de `notificacao-bancaria.ts` e o namespace de `esquema/plataforma.ts`. | Ponto único de exportação. |
| `packages/db/test/banco-efemero.ts` | Criar o papel `sysloc_roteamento` (`NOLOGIN`) e transferir a posse da função nova. | Uma das duas frentes de provisionamento; a migração **confere** e não cria. |
| `packages/db/test/catalogo-de-plataforma.spec.ts` | Roster com uma tabela; casos da segunda direção. | Consequência da mudança acima. |
| `packages/shared/src/fila.ts` | `FILA_DA_NOTIFICACAO_BANCARIA` e `CargaDaNotificacaoBancaria`. | Contrato de fila é do pacote compartilhado. |
| `apps/api/src/comum/produtor-de-fila.ts` | `enfileirarNotificacaoBancaria`. | O produtor é o ponto único de despacho. |
| `apps/api/src/configuracao/ambiente.ts` | `TOKEN_PORTA_DE_MESCLAGEM`. | Composição raiz escolhe a implementação. |
| `apps/api/src/cobrancas/cobrancas.module.ts` | Prover `CarneService` e o token da mesclagem; **exportar** `BoletoService` e `CarneService`. | O `ContratoController` injeta o carnê, e `ContratosModule` já importa `CobrancasModule`. |
| `apps/api/src/contratos/contrato.controller.ts` | Rota `GET :codigo/carne`, sem declaração no método (a área vem da classe). | RN-17: pedir o carnê é leitura do que `TELA:contratos` já dá — mesma forma da rota do documento. |
| `apps/api/src/contratos/contratos.module.ts` | Nenhuma alteração de `imports`; só o construtor do controlador muda. | `CobrancasModule` já está importado. |
| `apps/api/src/master/empresa.service.ts` | A reativação reenfileira as notícias retidas — **e o mesmo diff EMENDA o docblock de `reativar`**, preservando o texto original. | CA-10. ⚠️ O docblock hoje declara *"ela limpa a marca e nada mais (RN-05)… precisamente a diferença entre 'reativar o acesso' e 'retomar o que estava em curso'"*, e esta fatia instala exatamente a segunda coisa: sem a emenda é **R3** (`.claude/rules/nao-regressao.md` §1). Ver a §21.3 (6). |
| `apps/api/src/app.module.ts` | Registrar `NotificacoesBancariasModule` e **corrigir** o comentário que diz *"a única superfície de negócio sem sessão"*. | A afirmação deixa de ser verdadeira; deixá-la seria regressão de decisão (R3). |
| `apps/worker/src/fila.ts` | A fila nova e o tipo da tarefa. | Ponto único de construção de filas. |
| `apps/worker/src/main.ts` | Registrar o processador. | Composição raiz do processo. |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Âncoras da superfície: 101/86; `publicas` 20; inventário nomeado das duas rotas. | `.claude/rules/ancoras-de-superficie.md` — âncora no **mesmo diff** da publicação. |
| `apps/api/test/documento.ts` | Recebe `extrairTextoDePdf`. | **Fecha o D5**, cujo gatilho é literalmente *"o carnê da F4"*. |
| `apps/api/test/documento-do-contrato.e2e.spec.ts` | Passa a importar o extrator; o marcador do D5 sai. | Idem. |
| `packages/cobranca-bancaria/src/index.ts` | Publicar os dois símbolos de `tratamento-de-notificacao.ts`, símbolo a símbolo (nunca `export *`). | Ponto único de exportação do pacote. |
| `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` | Estender a varredura aos módulos novos (CT-991). | CA-21 — nenhum termo do provedor vira símbolo. |
| `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` | Três casos para `recusarPorForma`/`resolverDestino`. | **Fecha o D38**, cujo gatilho está **vencido** e cujo dono declarado é esta fatia. |
| `packages/documentos/package.json` | `pdf-lib` em `dependencies`. | D5 do tech-alignment. |
| `deploy/scripts/instalacao/provisionar-base.sh` | P15 passa a criar `sysloc_roteamento`. | Papéis nascem no provisionamento; a migração confere. |
| `CLAUDE.md` | Bloco de débitos: saem D5, D14, D38; entram os desta fatia. | `.claude/rules/nao-regressao.md` §3-B, ciclo de vida do índice. |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `packages/db/migracoes/0014_seguranca_confirmacao.sql` | **O molde literal** da travessia nominal: papel, política, `GRANT` mínimo, `SET search_path`, `REVOKE ... FROM PUBLIC`, `OWNER TO` por último. |
| `packages/db/src/portador-de-confirmacao.ts` | Como a aplicação chama uma função `SECURITY DEFINER` e o que ela publica (escassez de colunas). |
| `apps/worker/src/tarefas/conferencia-bancaria.ts` | O molde da tarefa: carga conferida, `contextoDeTenant.executarCom`, uma unidade de trabalho por escrita, reentrância benigna. |
| `apps/api/src/cobrancas/boleto.service.ts` | `prepararEntrega` / `entregar` / `rebuscarDoProvedor` — o caminho que o carnê **compõe**, e a repartição transacional que ele herda. |
| `apps/api/src/cobrancas/cobranca.controller.ts` (rota `SEGMENTO_DO_BOLETO`) | A forma da rota que devolve bytes: ordem dos cabeçalhos, `passthrough`, declaração ADR-0028. |
| `apps/api/src/contratos/contrato.controller.ts` (rota `:codigo/documento`) | O precedente de rota de leitura sem declaração no método. |
| `packages/db/src/boleto-da-cobranca.ts` | `liquidarPeloProvedor`, `estornarLiquidacao`, `revogarBoleto` e os desfechos que tornam a segunda camada de idempotência estrutural. |
| `packages/db/src/evento-bancario.ts` | `registrarEventoBancario` e a forma da trilha. |
| `packages/cobranca-bancaria/src/modelo-canonico.ts` | `SituacaoConsultada`, `DesfechoDaOperacao`, `ConsultaDeSituacao`. |
| `packages/db/src/catalogo.ts` | A restrição que impede nome de tabela em posição executável ali — e por que o roster mora no arquivo irmão. |
| `apps/api/src/confirmacoes/confirmacao.controller.ts` | O precedente da outra superfície sem sessão: caminho próprio, `@RotaPublica()`, módulo próprio. |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Receber a notícia do provedor | `POST` | `/v1/notificacoes-bancarias` | Objeto JSON **opaco** do provedor (ver §4.1.1) | **sem corpo** | `204` · `422` só para corpo que **não é JSON** (recusado pelo próprio adaptador HTTP antes do manipulador) | **Nenhuma** — `@RotaPublica()` (ADR-0035) |
| Obter o carnê de um contrato | `GET` | `/v1/contratos/:codigo/carne?de=YYYY-MM-01&ate=YYYY-MM-01` | — (parâmetros de consulta) | `application/pdf` (bytes) | `200` · `401` · `403` · `404` · `422` · `503` | Sessão + `TELA:contratos` (da classe) |

**As duas medições da superfície, e a igualdade entre elas.** Hoje o `CT-937` fixa `99` pares e `84`
manipuladores. Esta fatia acrescenta **dois manipuladores**, nenhum deles curinga:

```
manipuladores                     = 84 + 2 = 86
manipuladoresQueAtendemTodosOsVerbos = 1  (inalterado — só o encaminhador de /v1/auth)
pelaComposicao = 86 − 1 + 1 × 7 + 9 = 101
peloRoteador   = 101                       (a ser afirmado por igualdade com o de cima)
publicas       = 19 + 1 = 20               (a rota da notícia)
semDeclaracao  = []                        (permanece vazio — ADR-0011)
```

⚠️ **As duas medições são independentes e precisam concordar entre si**, e não apenas bater com a
âncora: é a concordância que torna cada uma verificável pela outra (precedente CT-533, CT-635,
CT-732, CT-937). A âncora sobe **no mesmo diff** que publica as rotas
(`.claude/rules/ancoras-de-superficie.md`).

### 4.1.1 Exemplo de Payload por Endpoint

Nenhuma rota desta fatia aceita **atualização parcial** (`PUT`/`PATCH`) — a exigência de payload
mínimo do template **não se aplica**. O que segue é o que de fato chega e sai.

```
POST /v1/notificacoes-bancarias        (o que o PROVEDOR envia — vocabulário dele, não nosso)

Caso A — notícia de recebimento:
  Content-Type: application/json
  {
    "idWebhook": 990,
    "tipoMovimento": 7,
    "dados": {
      "seuNumero": "202608000000000042",
      "nossoNumero": 1234567,
      "numeroCliente": 25546454,
      "numeroIdentificadorBaixa": "1600100000000000001",
      "codigoBarrasBoleto": "…", "codigoBarrasBaixa": "…",
      "valorBoleto": 1500.00, "valorPagamento": 1500.00,
      "dataHoraSituacaoBaixa": "2026-08-18T14:03:11Z",
      "dataVencimento": "2026-08-20",
      "cancelamentoBaixa": false, "baixaRealizadaEmContigencia": false,
      "codigoMotivoCancelamento": 2
    }
  }
  →  204 No Content, sem corpo.

Caso B — pedido de validação do endereço (cadastro, troca de endereço, reativação):
  { "idWebhook": 990, "validacaoWebhook": true }
  →  204 No Content, sem corpo. Nenhuma cobrança é procurada ou alterada.

Caso C — qualquer outra coisa que seja JSON (campo faltando, tipo trocado, objeto vazio):
  →  204 No Content, sem corpo. O recebido está gravado, e o desfecho é `ILEGIVEL`.

Regra: **a resposta nunca carrega o desfecho**, e não existe corpo em que ele pudesse caber. O
provedor aceita apenas 200/201/204 e reprova redirecionamento — a rota não redireciona em hipótese
alguma.
```

```
GET /v1/contratos/CTR-2026-00001/carne?de=2026-01-01&ate=2026-06-01

200 OK
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="CTR-2026-00001-2026-01-2026-06.pdf"
  <bytes>

404 (cobrança do recorte sem boleto emitido)
  { "codigo": "RECURSO_NAO_ENCONTRADO",
    "mensagem": "recurso não encontrado",
    "campo": "codigo",
    "detalhes": { "carne": "BOLETO_AUSENTE", "cobranca": "COB-2026-0000012" } }

404 (recorte que não alcança cobrança nenhuma)
  { …, "detalhes": { "carne": "SEM_COBRANCAS" } }

404 (contrato de outra empresa, ou inexistente — corpo IDÊNTICO nos dois casos)
  { "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado", "campo": "codigo" }

422 (de > ate, recorte com mais de 12 competências, competência fora do primeiro dia, data inválida)
  { "codigo": "CAMPO_INVALIDO", "mensagem": "campo inválido", "campo": "de" | "ate" }
```

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `esquemaDoRecorteDoCarne` | `@sysloc/contracts` (Zod 4) → OpenAPI por `esquemaPublicado(..., 'input')` | `de`, `ate` — competências no primeiro dia do mês | v1 |
| `esquemaDoEventoBancario` | `@sysloc/contracts`, **alterado** | `origem` ganha `NOTICIA_DO_PROVEDOR`; `tipo` ganha `NOTICIA_RECUSADA` | v1 (aditivo) |
| Corpo da notícia | **Nenhum** — o corpo é declarado no OpenAPI como objeto livre do provedor | ver §4.1.1 e §21.2 | — |
| `CargaDaNotificacaoBancaria` | `@sysloc/shared` | `notificacaoId` (UUID) — **e nada mais** | v1 |

> **ADR-0016 respeitada onde ela alcança.** As duas descrições que derivam de esquema derivam por
> `esquemaPublicado`; a rota que devolve bytes declara mídia, nome de arquivo e o envelope de erro
> pela **ADR-0028**, sem declarar forma do corpo de sucesso; e o corpo da notícia não tem esquema
> **porque não é contrato de entrada nosso** (§21.2).

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Tópico / Fila | Payload | Schema |
|--------|------|---------------|---------|--------|
| Notícia bancária recebida | pub (borda) / sub (worker) | `notificacao-bancaria` | `{ notificacaoId }` | `ESQUEMA_DA_CARGA` (`z.strictObject`, um campo) |
| Notícia retida reenfileirada | pub (reativação de empresa) | `notificacao-bancaria` | `{ notificacaoId }` | o mesmo |

⚠️ **A carga não leva empresa, e a ausência é o mecanismo.** A borda **não sabe** de que empresa a
notícia é — descobrir é justamente o trabalho da tarefa. Levar um identificador de empresa aí seria
reconstituir o recebido como origem do tenant, que é o que a **ADR-0024** proíbe. O contexto vem do
**registro resolvido** (a segunda leitura legítima da emenda de 2026-08-13 daquela ADR).

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**A · Recepção (apps/api, sem sessão, sem contexto de tenant)**

1. `NotificacaoBancariaController.receber(@Body() corpo: unknown, @Req())` — `@RotaPublica()`,
   `@HttpCode(204)`.
2. `NotificacaoBancariaService.receber(corpo)`:
   1. `banco.emUnidadeDeTrabalho` → `registrarNotificacaoBancaria(tx, { recebido: corpo })`, que
      grava `recebido jsonb`, `recebido_em = now()` (relógio do **banco**, ADR-0026) e
      `desfecho = 'RECEBIDO'`, devolvendo o `id`. **Sem contexto de tenant** — a tabela vive em
      `plataforma` e nenhuma política a alcança.
   2. **Fora** da unidade: `produtor.enfileirarNotificacaoBancaria({ notificacaoId })`.
      Falha aqui é **registrada em `warn` e engolida** — ver §5.2 (b).
3. O manipulador retorna `void`; o adaptador responde `204` sem corpo.

**B · Tratamento (apps/worker, fila `notificacao-bancaria`)**

1. `cargaConferida(ESQUEMA_DA_CARGA, …, tarefa.data)` → `{ notificacaoId }`.
2. `lerNotificacaoBancaria(tx, notificacaoId)` — sem contexto de tenant.
3. **Interpretação** (`z.object` tolerante, ver §6.1):
   - `validacaoWebhook === true` → `marcarDesfecho('VALIDACAO_DE_ENDERECO')`, **fim**. Nenhuma
     cobrança procurada.
   - forma não reconhecida → `marcarDesfecho('ILEGIVEL')`, **fim**.
4. **Roteamento**: `rotearNotificacaoBancaria(tx, identificadorPeranteOProvedor)` → chamada à função
   `SECURITY DEFINER`. Vazio → `marcarDesfecho('SEM_CORRESPONDENCIA')`, **fim**, **sem consulta ao
   provedor**.
5. **Idempotência** (RN-08): `houveEfeitoDaLiquidacao(tx, identificadorDaLiquidacao)` — existe outra
   linha com o mesmo identificador e desfecho `APLICADO`? → `marcarDesfecho('REENTREGA')`, **fim**.
6. **Suspensão**: `empresaSuspensa(tx, empresaId)` (leitura de `identidade.empresa.suspensa_em`,
   schema sem noção de tenant) → `marcarDesfecho('RETIDO')`, **fim**, sem efeito.
7. **Conferência** (RN-05): `numeroDoTituloNoProvedor` do recebido × o gravado na cobrança. São
   **três** ramos, e o do meio é o que a §21.3 (7) mede:
   - **gravado é `NULL`** → **não há o que conferir**; segue para B.8. Ausência não é divergência, e a
     RN-07 já nomeia quem decide: a consulta.
   - **gravado difere do recebido** → `contextoDeTenant.executarCom({ empresaId })` +
     `registrarEventoBancario({ tipo: 'NOTICIA_RECUSADA', origem: 'NOTICIA_DO_PROVEDOR', diagnostico })`
     + `marcarDesfecho('DIVERGENTE')`, **fim**, **sem consulta ao provedor**.
   - **gravado igual ao recebido** → segue para B.8.
8. **A consulta decide** (RN-07): dentro de `contextoDeTenant.executarCom({ empresaId })`,
   `obterEnvelopeCifradoDoVigente` → `decifrarSegredo` → `adaptador.consultarSituacao({ …,
   incluirDocumento: false })`.
   - `LIQUIDADO` → `liquidarPeloProvedor` + evento `COBRANCA_LIQUIDADA` (e `DIVERGENCIA_DE_VALOR`
     quando o valor não bate com o esperado), origem `NOTICIA_DO_PROVEDOR` → `APLICADO`.
   - `ESTORNADO` → `estornarLiquidacao` + `LIQUIDACAO_ESTORNADA` → `APLICADO`.
   - `REVOGADO` → `revogarBoleto` + `BOLETO_REVOGADO` (diagnóstico intacto) + `guarda.apagar` →
     `APLICADO`.
   - `EM_ABERTO`, ou desfecho que não mudou estado (`NAO_ESTAVA_EM_ABERTO`, `NAO_ESTAVA_PAGA`,
     `NAO_HAVIA_BOLETO`) → `CONFERIDO_SEM_EFEITO`.
   - Provedor recusou/indisponível → a tarefa **falha** e a fila reentrega (§10.2).
9. **Expurgo oportunista** (RN-11): `expurgarNotificacoesVencidas(tx)` — apaga todo cru com
   `recebido_em < now() - interval '90 days'`. Corre **sempre**, em unidade própria, ao final, e a
   falha dele **não derruba** o desfecho já gravado.

**C · Carnê (apps/api, com sessão)**

1. `validar(esquemaDoRecorteDoCarne, { de, ate })` e `validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, codigo)`
   — **antes** de qualquer ida ao banco.
2. `sobContextoDaSessao` (unidade 1, **só leitura de estado**): `CarneService.prepararRecorte` →
   contrato alcançável? cobranças do recorte, ordenadas por `data_vencimento`, com o título vivo de
   cada uma. Vazio → `404 SEM_COBRANCAS`. Alguma sem título → `404 BOLETO_AUSENTE` nomeando a
   **primeira** na ordem de vencimento.
3. **Fora da unidade**: para cada cobrança, `BoletoService.entregar(preparo, abrirUnidade)` — leitura
   de disco no caminho comum, rebusca do provedor no caminho raro. A abertura de unidade é a mesma
   que a rota do boleto avulso já passa.
4. `mesclador.mesclar(bytesPorBoleto)` → um documento só, na ordem em que os bytes chegaram.
5. Cabeçalhos escritos **depois** de os bytes existirem (a ordem é conteúdo — ver a nota do `CT-921`
   na rota do boleto), e o corpo é devolvido.

### 5.2 Fluxos Alternativos

- **(a) Corpo que não é JSON.** O adaptador HTTP o recusa antes do manipulador; nada é gravado. É o
  único `4xx` desta rota, e ele não é do produto — é do transporte.
- **(b) Redis fora do ar na recepção.** O cru **já está gravado**; o enfileiramento falha, e a falha
  é registrada em `warn` e **não** propaga: propagar devolveria `5xx` ao provedor, que reenviaria —
  e a reentrega é justamente o que a idempotência tem de absorver, não o que se deve provocar. A
  notícia fica em `RECEBIDO` e é alcançável pela reativação/reprocessamento manual (a varredura de
  `RECEBIDO` antigo é dívida declarada, §21.4).
- **(c) A mesma notícia chega de novo.** É gravada de novo (RN-08 manda registrar), e o
  passo B.5 a marca `REENTREGA`. **Segunda camada**: mesmo que o cru já tenha sido expurgado,
  `liquidarPeloProvedor` devolve `NAO_ESTAVA_EM_ABERTO` e nada acontece — a idempotência **final** é
  do estado, não do registro.
- **(d) Notícia de cobrança de empresa suspensa.** `RETIDO`. Na reativação (`EmpresaService.reativar`),
  `listarRetidas(tx)` devolve **todas** as retidas, na ordem de `recebido_em` crescente, e cada uma é
  reenfileirada. O re-roteamento é o **mesmo caminho** de B: o que for de outra empresa ainda suspensa
  volta a `RETIDO`, o que já produziu efeito vira `REENTREGA`.
- **(e) A consulta contradiz o aviso.** Vale a consulta, sempre. O aviso disse apenas *onde olhar*.
- **(f) Boleto do carnê ausente do disco.** `entregar` rebusca do provedor, regrava o cache e devolve.
  Nada é registrado na trilha — rebuscar cache **não é efeito** (ADR-0034), e a rota do boleto avulso
  já fixou essa leitura.
- **(g) Provedor indisponível durante a rebusca do carnê.** `503`, sem alterar coisa alguma — os
  bytes **são** a resposta, e engolir a falha entregaria documento incompleto.
- **(h) Certificado vencido e boletos todos em disco.** O carnê **sai**: a leitura do certificado só
  acontece dentro de `rebuscarDoProvedor`, e essa posição é decisão registrada da fatia (ii).

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | B.8 → `POST /v1/notificacoes-bancarias` + tarefa | `processarNotificacaoBancaria`, `adaptador.consultarSituacao`, `liquidarPeloProvedor` |
| US-02 | A.2/A.3 | `NotificacaoBancariaController`, `@HttpCode(204)` |
| US-03 | A.2.1 | `registrarNotificacaoBancaria`, `plataforma.notificacao_bancaria` |
| US-04 | B.8 | `adaptador.consultarSituacao` — o efeito nasce da resposta dele |
| US-05 | B.4 | `rotearNotificacaoBancaria` → `SEM_CORRESPONDENCIA` (sem consulta) |
| US-06 | B.4/B.6 | função `SECURITY DEFINER` + `contextoDeTenant` + RLS |
| US-07 | B.4 | a função **não tem** parâmetro de empresa |
| US-08 | B.7 | `NOTICIA_RECUSADA`, `DIVERGENTE` |
| US-09 | B.5 + camada 2 | `houveEfeitoDaLiquidacao`, `liquidarPeloProvedor` |
| US-10 | B.6 + (d) | `RETIDO`, `EmpresaService.reativar`, `listarRetidas` |
| US-11 | B.3 | `VALIDACAO_DE_ENDERECO` |
| US-12 | B.9 | `expurgarNotificacoesVencidas` |
| US-13 | B.8 | `origem: 'NOTICIA_DO_PROVEDOR'` na trilha |
| US-14 | C → `GET /v1/contratos/:codigo/carne` | `CarneService`, `PortaDeMesclagem` |
| US-15 | C.3 + (f) | `BoletoService.entregar` → `rebuscarDoProvedor` |
| US-16 | C.2 | `404 BOLETO_AUSENTE` |
| US-17 | C.4 | mesclagem determinística sobre os bytes vigentes |
| US-18 | B (todo) + §6.2 | tradução na fronteira; nenhum termo do provedor vira estado |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| O corpo da notícia **não é validado para aceitar/recusar** | `NotificacaoBancariaController` | Não existe falha: qualquer JSON é gravado e respondido `204` |
| Interpretação tolerante do recebido (`z.object`, chaves desconhecidas **ignoradas**) | `apps/worker/src/tarefas/notificacao-bancaria.ts` | Desfecho `ILEGIVEL`; nenhuma exceção, nenhuma reentrega |
| `identificadorPeranteOProvedor` conforme `ESQUEMA_DO_IDENTIFICADOR_BANCARIO` (18 posições) | idem | Desfecho `ILEGIVEL` — chave malformada não chega a rotear |
| `notificacaoId` é UUID, e a carga **não tem mais nada** (`z.strictObject`) | `cargaConferida` | Falha da tarefa nomeando o campo, no molde da conferência bancária |
| `codigo` do contrato conforme `ESQUEMA_DO_CODIGO_DE_CONTRATO` | `ContratoController.carne` | `422 CAMPO_INVALIDO` campo `codigo`, **sem tocar o banco** |
| `de` e `ate`: data ISO **no primeiro dia do mês** | `esquemaDoRecorteDoCarne` | `422 CAMPO_INVALIDO` nomeando `de` ou `ate` |
| `de <= ate` | `esquemaDoRecorteDoCarne` (`refine` do objeto, `path: ['de']`) | `422 CAMPO_INVALIDO` campo `de` |
| Recorte com no máximo **12 competências** | idem (`path: ['ate']`) | `422 CAMPO_INVALIDO` campo `ate` |

> **Por que a entrada da notícia foge da regra de estritude do projeto** — §21.2. Em uma linha: a
> regra existe porque *"chave desconhecida na entrada é erro do cliente"*, e o provedor **não é
> cliente nosso**: ele não pode corrigir o payload, e a RN-02/CA-03 obrigam a guardar e confirmar o
> que não se entende. Recusar seria perder a notícia — exatamente o defeito que a fatia existe para
> não ter.

### 6.2 Transformações de Dados

- **Tradução do dialeto do provedor → modelo do produto**, num ponto só (o módulo da tarefa):
  `seuNumero` → *Identificador perante o provedor*; `nossoNumero` → *Número do título no provedor*
  (chega **inteiro** no JSON e é coagido para cadeia na fronteira — medição §13-A.4 do discovery);
  `numeroIdentificadorBaixa` → *Identificador da liquidação*. **Nenhum desses nomes cruza** para
  esquema, coluna, log estruturado ou trilha (CA-21).
- **Datas**: **nenhuma data do recebido é convertida nem usada.** A restrição do PRD (*"as datas do
  recebido vêm em fuso universal e precisam ser lidas no fuso da operação"*) é **resolvida por
  refutação da premissa**: pela RN-07, o aviso não decide, e a única data que entra no domínio é a
  `pagoEm` que a **consulta** devolve — caminho que a fatia (ii) já fechou. As datas do recebido
  permanecem dentro do `jsonb` cru, como diagnóstico. O `recebido_em` é do **banco** (ADR-0026).
  Nada nesta fatia cria uma quarta declaração executável do fuso da operação (o D14 · F3/T5 e o
  D25 · F4/T7 **não** são agravados).
- **Dinheiro**: nenhum valor do recebido é gravado. O que se grava vem de `SituacaoConsultada`, por
  `liquidarPeloProvedor`, em `numeric(15,2)` (invariante 4).
- **Nome do arquivo do carnê**: `<codigo>-<de sem dia>-<ate sem dia>.pdf`, todos derivados de valores
  **já canonizados** pelos esquemas — não há aspa, quebra de linha ou caractere de controle a escapar,
  pela mesma razão registrada na rota do boleto.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RN-01 | RN-01 | Endereço único, o mesmo para todas as empresas; a empresa nunca vem do endereço | — |
| RN-02 | RN-02 | Grava o cru, confirma de imediato; o desfecho não compõe a resposta | — |
| RN-03 | RN-03 | Só o *Identificador perante o provedor* roteia | `ILEGIVEL` / `SEM_CORRESPONDENCIA` |
| RN-04 | RN-04 | A empresa é a da cobrança encontrada | — (estrutural: a função não aceita empresa) |
| RN-05 | RN-05 | O resto é conferência; divergência registra e recusa | `NOTICIA_RECUSADA` + `DIVERGENTE` |
| RN-06 | RN-06 | Órfão morre **antes** de qualquer consulta | `SEM_CORRESPONDENCIA` |
| RN-07 | RN-07 | O efeito nasce da resposta do provedor, pelas regras da fatia (ii) | os desfechos de `boleto-da-cobranca.ts` |
| RN-08 | RN-08 | Efeito único pelo *Identificador da liquidação* — em duas camadas | `REENTREGA`; `NAO_ESTAVA_EM_ABERTO` |
| RN-09 | RN-09 | Suspensa retém; a reativação aplica na ordem de chegada | `RETIDO` |
| RN-10 | RN-10 | O pedido de validação é respondido e não roteia | `VALIDACAO_DE_ENDERECO` |
| RN-11 | RN-11 | Cru guardado 90 dias; o efeito na trilha não tem prazo | — |
| RN-12 | RN-12 | A trilha registra efeito e anomalia, com origem distinguível | `NOTICIA_DO_PROVEDOR` |
| RN-13 | RN-13 | Carnê = contrato × intervalo, ordenado por vencimento | `SEM_COBRANCAS` |
| RN-14 | RN-14 | Composto sob demanda, nunca armazenado | — (não existe caminho de escrita) |
| RN-15 | RN-15 | Arquivo ausente é rebuscado | `SERVICO_INDISPONIVEL` se o provedor falhar |
| RN-16 | RN-16 | Cobrança sem boleto faz falhar nomeando | `BOLETO_AUSENTE` |
| RN-17 | RN-17 | Carnê exige quem alcança o contrato | `NAO_AUTENTICADO` / `ACESSO_NEGADO` / `404` |
| RN-18 | RN-18 | Vocabulário do provedor não vira regra nem estado | — (provado por varredura da saída real) |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, com **RLS forçada** em todo o schema `negocio` (ADR-0008/0009) e um
terceiro schema — `plataforma` — para o que **não é dado de empresa nenhuma** (ADR-0031). Acesso por
Drizzle + `postgres.js`, sempre por `AcessoAoBanco.emUnidadeDeTrabalho`, que fixa
`SET LOCAL app.empresa_id` por transação a partir do `AsyncLocalStorage` — **nunca** do request.

### 7.2 Tabelas / Coleções

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|------|------------------|-------|-------------|---------|
| `plataforma.notificacao_bancaria` **(nova)** | `id` · `recebido` · `recebido_em` · `desfecho` · `identificador_perante_o_provedor` · `identificador_da_liquidacao` · `diagnostico` · `tratado_em` | `uuid` PK default random · `jsonb` NOT NULL · `timestamptz` NOT NULL default `now()` · `plataforma.desfecho_da_notificacao` NOT NULL default `'RECEBIDO'` · `text` NULL · `text` NULL · `text` NULL · `timestamptz` NULL | **NENHUMA coluna `empresa_id`** (a guarda reprova por `CARREGA_COLUNA_DE_EMPRESA` antes de olhar o roster) · `check`: `(tratado_em IS NULL) = (desfecho = 'RECEBIDO')` | `notificacao_bancaria_expurgo_idx (recebido_em)` · `notificacao_bancaria_retida_idx (recebido_em) WHERE desfecho = 'RETIDO'` (parcial) · `notificacao_bancaria_efeito_idx (identificador_da_liquidacao) WHERE desfecho = 'APLICADO'` (parcial) |
| `negocio.cobranca` **(alterada)** | `nosso_numero` → **`numero_do_titulo_no_provedor`** | inalterado | inalteradas | inalterados |
| `negocio.evento_bancario` **(alterada)** | `tipo` e `origem` ganham um valor cada | enums | inalteradas | inalterados |

**Enum `plataforma.desfecho_da_notificacao` — conjunto fechado, nove valores, nesta ordem:**

```
RECEBIDO              gravado, ainda não tratado (o estado inicial, e o ÚNICO com tratado_em nulo)
VALIDACAO_DE_ENDERECO era o pedido de validação; nada foi procurado
ILEGIVEL              a forma não foi reconhecida; nada foi procurado
SEM_CORRESPONDENCIA   a chave não achou cobrança; NENHUMA consulta ao provedor
DIVERGENTE            casou a cobrança e a conferência reprovou; NENHUMA consulta; nada mudou
RETIDO                a empresa da cobrança está suspensa; PENDENTE até a reativação (não é definitivo)
REENTREGA             o mesmo identificador de liquidação já produziu efeito
CONFERIDO_SEM_EFEITO  o provedor foi consultado e nada havia a mudar
APLICADO              o provedor foi consultado e o estado da cobrança mudou
```

⚠️ **Dos nove, sete são DEFINITIVOS e dois são PENDENTES.** `RECEBIDO` e `RETIDO` são os pendentes,
e a distinção não é rótulo: é ela que a camada 3 da idempotência consome (§9.2). O `check` acima
amarra `tratado_em` a `RECEBIDO` apenas — `RETIDO` **tem** `tratado_em` gravado —, de modo que
`tratado_em` **não serve** como discriminador de reentrância. Ver a advertência da §9.2.

⚠️ **`CONFERIDO_SEM_EFEITO` e `APLICADO` não se fundem, e a separação é a idempotência.** A camada
1 (passo B.5) só pula a notícia cujo identificador já produziu **efeito**; uma primeira notícia que
encontrou o título ainda em aberto (corrida entre o aviso e a baixa no provedor) precisa poder ser
reprocessada pela reentrega seguinte. Fundir os dois transformaria a corrida benigna em recebimento
perdido.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0019 | `0019_dominio_webhook_e_carne.sql` | up — enum + tabela em `plataforma`; `ALTER TYPE … ADD VALUE` nos dois enums da trilha; `ALTER TABLE negocio.cobranca RENAME COLUMN nosso_numero TO numero_do_titulo_no_provedor` com **recriação de `negocio.cobranca_derivada`** (ela expandiu `c.*` no instante da criação) |
| 0020 | `0020_seguranca_webhook_e_carne.sql` | up — bloco `DO` que **confere** o papel `sysloc_roteamento` e falha nomeando o passo do provisionamento; política nominal `FOR SELECT TO sysloc_roteamento` em `negocio.cobranca`; `GRANT USAGE ON SCHEMA negocio` + `GRANT SELECT ON negocio.cobranca` ao papel; a função `SECURITY DEFINER`; `REVOKE ALL … FROM PUBLIC` **antes** do `GRANT EXECUTE` nominal a `sysloc_app`; `ALTER FUNCTION … OWNER TO "sysloc_roteamento"` por **último**; `GRANT SELECT, INSERT, UPDATE, DELETE ON plataforma.notificacao_bancaria TO sysloc_app` |

> ⚠️ **Suprima o `CREATE SCHEMA "plataforma"` que o gerador vai propor — e desta vez ele vai.** Os
> cabeçalhos da `0015` e da `0017` já avisam que `drizzle-kit generate` emite a instrução; até aqui o
> aviso era teórico, porque **nenhuma tabela vivia em `plataforma`**. Esta fatia é **a primeira** a
> declarar uma, de modo que a supressão deixa de ser precaução e vira passo obrigatório da `0019`. O
> schema nasce no `provisionar-base.sh` (`SCHEMA_PLATAFORMA`) e no `banco-efemero.ts` (a lista
> `SCHEMAS` já o traz), nunca na migração. O detector existe e é executável:
> `verificar-migracao.sh`, asserção **(e)**, exige **zero** `CREATE SCHEMA` em código — e a `0019`
> deve declarar a supressão em comentário de cabeçalho, no mesmo molde das duas anteriores, para que
> a próxima passada do gerador não a reintroduza em silêncio. Ver o risco **R11**.

> **Sem `down`.** Este projeto não tem migração reversível: as migrações são imutáveis, conferidas por
> `sha256sum` (o D20 · F3/T7 registra a consequência disso), e o desfazimento é operacional. A ordem
> `REVOKE` antes de `GRANT`, e `OWNER TO` por último, é o **molde literal** da `0014` — invertida, a
> primeira apaga a concessão que a segunda acabou de fazer.

**A função, com as quatro propriedades da emenda da ADR-0024:**

```sql
CREATE FUNCTION "negocio"."rotear_notificacao_bancaria"(p_identificador text)
	RETURNS TABLE (empresa_id uuid, cobranca_id uuid, codigo text, numero_do_titulo_no_provedor text)
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
	SELECT c.empresa_id, c.id, c.codigo, c.numero_do_titulo_no_provedor
	FROM negocio.cobranca c
	WHERE c.identificador_no_provedor = p_identificador;
$$;
```

1. **Não aceita `empresa_id` por parâmetro** — a empresa é o *resultado*, nunca a entrada (ADR-0024).
2. **Devolve quatro colunas, e nenhuma a mais** — não devolve valor, vencimento, locatário nem
   qualquer outra. Uma função `SECURITY DEFINER` é um furo declarado na política; cada coluna a mais
   alarga o furo.
3. **`SET search_path = pg_catalog, pg_temp`** fecha a interposição de objeto pelo chamador.
4. **`SECURITY DEFINER` sozinho NÃO atravessa `FORCE ROW LEVEL SECURITY`** — `negocio.cobranca` o tem
   desde a `0010`. É a **posse pelo papel nominal** mais a **política endereçada a ele** que
   atravessam. Este parágrafo repete, de propósito, a `DECISÃO FECHADA` da `0014`: foi exatamente o
   defeito da rodada 1 daquela task (função devolvendo zero linhas em 100% das chamadas), e o molde
   copiado sem a propriedade de que dependia.

### 7.4 Estratégia de Transação e Consistência

- **Uma unidade por escrita**, nunca uma unidade envolvendo conversa de rede. A tarefa abre e fecha
  unidades curtas entre as idas ao provedor — o mesmo desenho da conferência bancária, e pela mesma
  razão registrada lá: manter `sql.begin` aberto durante a espera reservaria uma conexão física da
  reserva que atende o produto inteiro.
- **Isolamento**: `read committed`, o padrão. Nenhuma leitura desta fatia depende de instantâneo
  estável entre unidades.
- **Nenhum bloqueio pessimista.** A corrida entre duas notícias do mesmo boleto é resolvida pelo
  **estado**: `liquidarPeloProvedor` é `UPDATE … WHERE pago_em IS NULL RETURNING`, cuja ausência de
  retorno **é** o resultado. A camada de idempotência por identificador é otimização de cota e de
  trilha, não a garantia — a garantia é o `WHERE`.
- **A recepção não é transacional com o enfileiramento**, e isso é decisão: gravar e enfileirar em
  duas fases, com a falha do segundo apenas registrada, é o único desenho em que a notícia **nunca**
  se perde por indisponibilidade da fila. O preço é a notícia que fica em `RECEBIDO` até alguém a
  reprocessar (§21.4).

### 7.5 Política de Retenção / Archival

| Dado | Prazo | Mecanismo | Onde |
|------|-------|-----------|------|
| Recebido cru (`plataforma.notificacao_bancaria`) | **90 dias** desde `recebido_em` | `DELETE` oportunista, a cada execução da tarefa | `expurgarNotificacoesVencidas` |
| Efeito na trilha (`negocio.evento_bancario`) | **sem prazo** | — | — |
| Bytes do boleto em disco | **sem expurgo** — dívida da F5 | — | `D26 · F4/T9`, fora do escopo por decisão de 2026-08-18 |

⚠️ **O expurgo apaga o `RETIDO` vencido também, e isso é escolha.** A RN-11 é incondicional, e a
CA-12 exige que o cru com mais de 90 dias *"deixe de existir"*. Excluir os retidos do expurgo criaria
retenção **sem prazo** de dado pessoal de terceiro exatamente no caso que a regra existe para fechar.
A rede para a suspensão que durar mais de 90 dias é a **conferência diária** da fatia (ii), que
descobre a liquidação de qualquer maneira: o que se perde é a *origem* na trilha (aparece
`CONFERENCIA` em vez de `NOTICIA_DO_PROVEDOR`), não o recebimento. Dentro da janela de guarda,
nada se perde — que é o alcance real da CA-10.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| Provedor (Sicoob), **saída** — `consultarSituacao` | REST sobre `node:https` nativo, mTLS | Certificado A1 da empresa (segredo operável, ADR-0032) + credencial `client_credentials` obtida **dentro** do adaptador | `TETO_DA_OPERACAO_MS = 10_000` por chamada | Nenhum no adaptador. Na tarefa: a fila reentrega (3 tentativas, espera exponencial). No carnê: **nenhum** — falha vira `503` |
| Provedor, **entrada** — a notícia | REST, iniciada por ele | **Nenhuma** — o provedor não oferece assinatura, segredo compartilhado nem faixa de origem | — | O provedor reenvia por conta própria; a idempotência absorve |

**A compensação pela ausência de autenticação na entrada é a forma da fatia**, e ela é enumerável:
(1) a chave de roteamento é **nossa** e fez o trajeto de ida e volta; (2) a empresa vem do **registro
encontrado**; (3) o resto é **conferência**; (4) o que não casa morre **antes** de qualquer consulta;
(5) **nada se grava** sem perguntar ao provedor pelo canal autenticado por mTLS. Um aviso forjado, no
melhor caso para o atacante, provoca **uma** consulta autenticada cuja resposta contradiz o forjado —
e nada acontece.

**Cache de credencial**: por processo, por empresa, com prazo de 300 s e margem de renovação de 30 s
(`credencial-de-acesso.ts`). No pior caso do carnê ele é obtido **uma vez** e reusado pelas demais
rebuscas do mesmo pedido.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Tópico / Fila | Produtor | Consumidor | Garantia |
|---------------|----------|------------|----------|
| `notificacao-bancaria` | `NotificacaoBancariaService` (borda HTTP) e `EmpresaService.reativar` | `processarNotificacaoBancaria` (apps/worker) | **at-least-once** — `OPCOES_PADRAO_DA_TAREFA`, 3 tentativas com espera exponencial |

### 9.2 Idempotência

Três camadas, e cada uma existe porque a de cima pode não estar disponível:

1. **Por identificador da liquidação** (`houveEfeitoDaLiquidacao`) — barata, evita consulta e evita
   linha duplicada na trilha. **Some com o expurgo dos 90 dias**, e isso é aceito.
2. **Por estado**, no `UPDATE … WHERE` de `liquidarPeloProvedor` / `estornarLiquidacao` /
   `revogarBoleto` — **estrutural e sem prazo**. É ela que sustenta a RN-08 depois do expurgo.
3. **Por reentrância da tarefa** — a mesma tarefa reexecutada relê o cru e reencontra o desfecho já
   gravado; o desfecho **definitivo** faz a execução seguinte **não repetir** o efeito, apenas
   registrar e sair. É o análogo direto do `comReentranciaBenigna` da conferência.

   ⚠️ **O discriminador é o DESFECHO, e nunca `tratado_em`.** Definitivos são os **sete**:
   `VALIDACAO_DE_ENDERECO`, `ILEGIVEL`, `SEM_CORRESPONDENCIA`, `DIVERGENTE`, `REENTREGA`,
   `CONFERIDO_SEM_EFEITO` e `APLICADO`. **`RECEBIDO` e `RETIDO` ficam de fora**, porque os dois são
   **pendentes** e reprocessá-los é justamente o caminho previsto: o primeiro pela varredura futura
   (§21.4), o segundo pela reativação (§5.2 (d)).

   Discriminar por `tratado_em` **não nulo** seria defeito, e a classe é nomeável: o `check` da §7.2
   fixa `(tratado_em IS NULL) = (desfecho = 'RECEBIDO')`, de modo que a notícia `RETIDO` já tem
   `tratado_em` gravado — e o curto-circuito a faria sair **sem efeito** exatamente na reentrega que a
   CA-10 exige que funcione, derrubando os CT-985 e CT-986. `tratado_em` responde *"quando a tarefa
   passou por aqui pela última vez"*, e não *"isto acabou"*; a segunda pergunta é do desfecho.

⚠️ **A camada 3 usa o discriminador de reentrância, e este é o TERCEIRO consumidor dele** — o gatilho
do **D58 · F4/T16** dispara aqui (§21.4).

### 9.3 Outbox / Saga

Não se aplica, e a ausência é decisão: não há transação distribuída a coordenar. O único par
não-atômico é *gravar o cru* × *enfileirar*, e ele é resolvido pela ordem (§7.4) — o cru primeiro,
sempre, porque perder a notícia é irreversível e enfileirar de novo não é.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Contrato inalcançável (inexistente **ou** de outra empresa) | `RECURSO_NAO_ENCONTRADO` (404) | corpo **idêntico** nos dois casos (ADR-0008) | `CarneService` |
| Recorte sem cobrança alguma | `RECURSO_NAO_ENCONTRADO` (404) | `detalhes: { carne: 'SEM_COBRANCAS' }` | `CarneService` |
| Cobrança do recorte sem boleto emitido | `RECURSO_NAO_ENCONTRADO` (404) | `detalhes: { carne: 'BOLETO_AUSENTE', cobranca: '<codigo>' }` | `CarneService` |
| Recorte malformado, invertido ou largo demais | `CAMPO_INVALIDO` (422) | nomeia `de` ou `ate` | borda (`validar`) |
| Provedor indisponível na rebusca | `SERVICO_INDISPONIVEL` (503) | mensagem canônica | `BoletoService.rebuscarDoProvedor` |
| Certificado ausente/vencido na rebusca | o **mesmo** que a emissão publica | não se traduz em indisponibilidade | `BoletoService` (inalterado) |
| Sem sessão / sem `TELA:contratos` | `NAO_AUTENTICADO` (401) / `ACESSO_NEGADO` (403) | guarda de contexto e de autorização | borda |
| **A rota da notícia** | — | **não publica erro de negócio algum**: todo desfecho é `204` | — |

### 10.2 Resiliência

- **A tarefa falha e a fila reentrega** quando o provedor está indisponível ou recusa por falha da
  empresa — é o caminho em que reentregar é o certo. Ela **não** falha por desfecho de negócio:
  `SEM_CORRESPONDENCIA`, `DIVERGENTE`, `ILEGIVEL`, `RETIDO` e `REENTREGA` são conclusões, não erros,
  e uma tarefa que falhasse neles reentregaria para sempre.
- **O expurgo nunca derruba o desfecho**: corre por último, em unidade própria, com a falha
  registrada em `warn` — mesma forma do `semDerrubarODesfecho` da entrega de boleto.
- **O carnê não engole falha**: os bytes **são** o desfecho; engolir responderia `200` com corpo
  vazio, que é o *"documento em branco"* que a RN-16 proíbe.
- **Sem circuit breaker, sem bulkhead** — nenhum dos dois existe no projeto hoje, e introduzi-los por
  esta fatia seria mecanismo novo sem consumidor medido.

### 10.3 Estratégia de Logging de Erros

Pino estruturado, com a redação de segredo já instalada em ponto único. Nada do recebido cru vai para
o log: ele carrega **dado pessoal do pagador**, e o lugar dele é a coluna `jsonb` com prazo de guarda,
não o journal — que não tem prazo. O que o log carrega é `notificacaoId`, `fila`, `idTarefa`,
`desfecho` e, quando houver, `empresaId` e `cobrancaId`.

---

## 11. Segurança

### 11.1 Autenticação

- **Carnê**: sessão por `better-auth`, resolvida pela `GuardaDeContexto` global.
- **Notícia**: **nenhuma**, e é declarada como tal com `@RotaPublica()`. É a **segunda** superfície
  sem sessão do produto (a primeira é a confirmação de e-mail, ADR-0027), e a primeira em que quem
  age **não é titular de dado nenhum** — o critério que a **ADR-0035** institui.
- **Saída para o provedor**: mTLS com o certificado A1 da empresa, mais credencial obtida dentro do
  adaptador. Nada disso muda nesta fatia.

### 11.2 Autorização

- **Carnê**: `@ExigeChave('TELA:contratos')` **da classe**, e **nada declarado no método** — baixar o
  carnê é *leitura* do que a área já dá, e a ADR-0021 governa transição de estado, que isto não é. É
  a mesma forma, e a mesma razão, da rota do documento do contrato e da rota do boleto.
  ⚠️ Declarar `@ExigeChave` no método seria **pior que redundante**: instalaria um segundo lugar por
  onde a área desta rota pode sumir em silêncio.
- **Notícia**: sem exigência, por marca explícita no manipulador. O default do arcabouço continua
  sendo negar, e `semDeclaracao` permanece **vazio** (ADR-0011).
- **Isolamento**: nenhum `WHERE empresa_id = …` escrito na aplicação. A cobrança de outra empresa é
  invisível pela política, e o carnê de contrato alheio responde `404` **idêntico** ao inexistente.

### 11.3 Criptografia

- **Em trânsito, para fora**: mTLS (saída) e TLS 1.2+ na borda (entrada), com o certificado do
  hostname público administrado pelo servidor de borda.
- **Em repouso**: o segredo operável do certificado continua cifrado de forma reversível, com a chave
  fora da árvore versionada (ADR-0032). **Esta fatia não alarga o envelope** e não acrescenta um
  segundo lugar por onde ele passe.
- **O recebido cru não é cifrado**, e a decisão é consciente: ele não é segredo — é dado pessoal com
  **prazo**, e o controle proporcional é a retenção, não a cifra.

### 11.4 Sanitização e Validação

- **SQL**: consultas parametrizadas por `postgres.js` em toda parte; a função de roteamento recebe o
  identificador como parâmetro vinculado.
- **SSRF**: nenhum endereço desta fatia vem de entrada. O endereço do provedor vem do ambiente e é
  conferido por `recusarPorForma` no adaptador — garantia que **hoje não tem caso**, e que esta fatia
  fecha (D38, §21.4).
- **Injeção em cabeçalho**: o nome do arquivo do carnê é composto de valores já canonizados pelos
  esquemas; nada do cliente atravessa a linha que escreve `Content-Disposition`.
- **`jsonb`**: o corpo é gravado como parâmetro, nunca interpolado. Profundidade e tamanho são
  limitados pelo teto de corpo do adaptador HTTP (§12.3).

### 11.5 Rate Limiting / Anti-abuse

- **Não há limitador nesta rota**, e a razão é medida: o custo por notícia forjada é **uma escrita
  pequena** e **zero consultas ao provedor** (RN-06 mata o órfão antes). Um limitador por origem
  também **não pode** existir aqui sem risco: limitar por endereço de origem faria uma rajada
  legítima do provedor ser descartada, e perder notícia é o dano que a fatia existe para não ter.
- ⚠️ **Correção factual de 2026-08-19 — a premissa "uma escrita pequena" agora é IMPOSTA, e não
  suposta.** Até a rodada 3 da T6 nada no repositório a garantia: `criarAplicacao()` montava
  `new FastifyAdapter()` sem opções, valia o teto padrão do arcabouço (**1 MiB**), e o custo por
  requisição forjada era ~2000× o de uma notícia real (514 bytes, medidos sobre o Caso A da §4.1.1).
  O teto passa a ser declarado em `MAIOR_CORPO_ACEITO` (`apps/api/src/main.ts`) — **64 KiB**, com
  7,8× de folga sobre o maior corpo legítimo de toda a API (registro de certificado, 8.346 bytes) e
  127× sobre a notícia. **Isto não é o limitador que o item acima proíbe**: aquele é **por origem** e
  descartaria rajada legítima; este é **por tamanho** e não recusa requisição legítima nenhuma. A
  âncora executável é o `CT-020 (e)` de `apps/api/test/contexto.e2e.spec.ts`, que mede o par contra a
  montagem real — acima do teto, `413` e nada gravado; abaixo dele, `204` e uma linha.
- ⚠️ **Os três débitos da F1 continuam SEM eixo — confirmado por medição nesta spec, não herdado.**
  **D23** é a conferência de origem do arcabouço de sessão, que só corre quando a requisição traz os
  cabeçalhos que um navegador envia: a notícia é chamada entre servidores, sem cookie e sem esses
  cabeçalhos. **D27** dimensiona o limitador das rotas de **autenticação**, que permanecem
  inalcançáveis de fora — o vhost publica **um** caminho. **D24** exige a **API inteira** publicada.
  Nenhum dos três dispara. Isto **corrige** a `[HIPÓTESE]` da §C-1 do discovery, e a §9 do PRD já foi
  corrigida em 2026-08-18 — as três pontas agora dizem o mesmo.

### 11.6 Secrets Management

`EnvironmentFile` 0600 por unidade systemd, fora do repositório. Esta fatia **não acrescenta segredo
algum**: a carga da fila leva um UUID, o vhost não guarda credencial, e o papel `sysloc_roteamento`
**não conecta** (`NOLOGIN`) — não existe senha para ele em lugar nenhum.

⚠️ **Prova por medição, não por leitura** (ADR-0032): a suíte da tarefa varre a saída real —
argumentos, carga, log estruturado e mensagem de falha — atrás das formas do material e da senha, com
**controle positivo** (o molde de `apps/worker/test/varredura-de-segredo.ts`). É o terceiro consumidor
desse molde e o gatilho do **D52** dispara (§21.4).

---

## 12. Performance

### 12.1 Metas

| Caminho | p95 | p99 | Observação |
|---------|-----|-----|------------|
| `POST /v1/notificacoes-bancarias` | **< 50 ms** | < 200 ms | Uma escrita curta e um `LPUSH`; nenhuma rede externa, nenhuma leitura de `negocio` |
| Tratamento da notícia (fila) | < 2 s | < 12 s | Dominado por **uma** ida ao provedor (teto 10 s) |
| `GET …/carne` — caminho comum (arquivos em disco) | **< 800 ms** para 12 boletos | < 1,5 s | Leitura de disco e mesclagem em memória |
| `GET …/carne` — pior caso (12 arquivos ausentes) | — | **~130 s** | 1 credencial + 12 consultas × teto de 10 s |

### 12.2 Estratégias

- **Recorte limitado a 12 competências**, conferido na borda. É o que transforma o pior caso do carnê
  de *ilimitado* em *declarável*, e o número não é arbitrário: o carnê é, por natureza, o caderno de
  um ano — o próprio PRD fala em *"doze parcelas"*.
- **Três índices na tabela crua**, dois deles **parciais** (`RETIDO`, `APLICADO`): eles são varridos
  por reativação e por reentrega, e a condição é o que os mantém pequenos enquanto o histórico cresce.
- **A credencial é obtida uma vez por pedido de carnê** — o cache por empresa (300 s) cobre as demais
  rebuscas do mesmo recorte. Foi por isso que **não** se alterou `BoletoService.entregar` para
  compartilhar a leitura do certificado: o que se repete é um `SELECT` indexado por rebusca, e ele é
  irrelevante diante da chamada de rede que o precede.
- **Nenhum cache novo**, nenhum pool novo, nenhuma conexão nova.

### 12.3 Limites Conhecidos

- **O pior caso do carnê é lento por natureza** e não se resolve com fila: os bytes **compõem** a
  resposta, o que pela ADR-0029 mantém o ato em linha, e guardar o carnê entre o preparo e a entrega
  é exatamente o armazenamento que a ADR-0030 proíbe.
- **Serialização do contador do SaaS** na emissão — herdado, inalterado, e fora desta fatia.
- **Teto de corpo do adaptador HTTP**: o padrão do Fastify (1 MiB). O maior payload documentado do
  provedor é de poucos KiB; corpo maior é recusado pelo transporte antes do manipulador.
- **O expurgo é eventualmente consistente com o prazo**, e não pontual no dia 91: numa parada longa
  de notícias, o cru vencido sobrevive até a próxima chegar. A RN-11 fixa o prazo de guarda, não a
  hora do apagamento.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| notícia recebida e gravada | `info` | `notificacaoId` | **nunca** o corpo recebido |
| notícia gravada e não enfileirada | `warn` | `notificacaoId`, `erro` | idem |
| notícia tratada | `info` | `idTarefa`, `fila`, `notificacaoId`, `desfecho`, `empresaId?`, `cobrancaId?` | sem dado do pagador |
| notícia recusada por divergência | `warn` | + `campoDivergente` (nome **do produto**) | sem o valor recebido |
| notícia retida | `info` | `notificacaoId`, `empresaId` | — |
| reativação reenfileirou retidas | `info` | `empresaId`, `quantidade` | — |
| expurgo do cru | `info` | `apagadas` | — |
| carnê composto | `info` | `contratoCodigo`, `boletos`, `rebuscados` | — |

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---------|------|--------|----------|
| — | — | — | — |

**Não há coleta de métricas neste produto**, e a ausência é medida, não esquecimento: o `CLAUDE.md`
registra que **OpenTelemetry foi planejado e não está instalado**, e nenhum manifesto o carrega. O
que existe é o log estruturado da §13.1, e é sobre ele que a operação responde. Introduzir um
coletor por esta fatia seria stack nova sem decisão.

### 13.3 Tracing

Não se aplica, pela mesma razão. A correlação disponível é o `notificacaoId`, que atravessa a borda,
a carga da fila, o log da tarefa e a coluna do cru — e é o que permite reconstruir o caminho inteiro
de uma notícia a partir de qualquer ponta.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| — | — | — | — |

Não há mecanismo de alerta instalado (a vigilância de rotina é decisão 31, da F5). O que esta fatia
deixa pronto é o **dado** sobre o qual um alerta futuro se apoiará: a contagem por `desfecho` na
tabela crua responde, com uma consulta, *"quantas notícias não viraram efeito, e por quê"*.

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma.** O produto não usa feature flags, e esta fatia não introduz a primeira. A reversibilidade
que o discovery exigiu (§C-1) é obtida por **infraestrutura**: desfazer é remover o vhost dedicado, e
o produto volta a ser inalcançável de fora sem que uma linha de código mude.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

---

## 15. Versionamento de API

### 15.1 Estratégia

Prefixo no caminho — `/v1` —, aplicado globalmente em `main.ts` com uma lista curta de exceções
(saúde e contrato publicado). As duas rotas desta fatia nascem **dentro** do prefixo, inclusive a da
notícia: o endereço que se cadastra junto ao provedor carrega a versão, de modo que uma `v2` futura
não obriga a reconfigurar o cadastro dele antes da hora.

### 15.2 Compatibilidade

Ambas as mudanças de contrato são **aditivas**: um valor novo em cada enum publicado da trilha, e
duas rotas novas. Nada é removido, nada muda de forma. O único renome — `nosso_numero` →
`numero_do_titulo_no_provedor` — é **de coluna**, e não de contrato: o nome publicado já era
`numeroDoTituloNoProvedor` desde a T1 da fatia anterior, e a tradução vivia num ponto só.

⚠️ **É a última vez que a superfície cresce antes do congelamento.** Depois desta fatia e da F5, ela
congela — é o que torna o handoff confiável.

### 15.3 Schemas / Contratos

`@sysloc/contracts` (Zod 4) é a **fonte única** (ADR-0016): a conferência de entrada, o tipo da
resposta e o documento OpenAPI derivam do mesmo objeto. Não há registry externo nem validação de
compatibilidade em CI além da suíte — que confere o documento publicado contra a superfície real.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD neste servidor: o ciclo é `pnpm lint` + `pnpm test` por pacote, aplicação de migração por
`deploy/scripts/instalacao/migrar-banco.sh` e reinício das unidades systemd. Os gates são o **QA** e
o **Tech Review** do pipeline agent-spec.

### 16.2 Empacotamento

**Nativo, sem Docker.** Duas unidades systemd (`sysloc-api.service`, `sysloc-worker.service`), com
`Restart=always`, `EnvironmentFile` 0600 e arranque automático (invariante 7). Esta fatia **não
acrescenta unidade nenhuma** — a decisão D3 do tech-alignment recusou explicitamente um segundo
agendador, e a D2 recusou um processo dedicado.

### 16.3 Infraestrutura como Código

Um arquivo de configuração de borda novo, versionado em `deploy/nginx/`, instalado por script
idempotente (ADR-0005) e **provado** por `verificar-borda-de-notificacao.sh`, no molde dos
`verificar-*.sh` existentes. O verificador afirma três coisas por **medição**, não por leitura:

1. o caminho da notícia responde por HTTPS, na 443, **sem redirecionamento** (o provedor reprova 302);
2. **nenhum outro caminho** da API responde por aquele hostname — inclusive `/docs`, `/v1/auth/*` e
   `/saude`;
3. o vhost que atende a operação (`/opt/frappe`) **não foi tocado** — sua configuração continua com o
   mesmo conteúdo.

### 16.4 Estratégia de Rollout

Aditivo e reversível, em três passos com ponto de parada entre eles: (1) instalar o vhost e provar
com o verificador; (2) subir a API com a rota nova e provar que ela responde `204` de fora;
(3) **cadastrar o webhook junto ao provedor** e responder a validação de endereço de verdade — o
critério de pronto da CA-20. Sem redirecionamento, sem janela de indisponibilidade, sem alteração no
que atende a operação hoje.

### 16.5 Escalabilidade

Um processo de API e um de trabalho, como hoje. O volume da entrada é proporcional aos **pagamentos
ocorridos** — não às cobranças em aberto —, que é precisamente a mudança que a decisão 17 buscava:
o polling atual faria ~420 mil chamadas/dia com 300 empresas; a notícia faz uma por pagamento real.

### 16.6 Rollback

**Remover a entrada do vhost.** O produto volta a ser inalcançável de fora, e nada mais precisa ser
desfeito: a tabela crua fica vazia e inofensiva, a fila fica ociosa, e o carnê continua funcionando
porque não depende de alcance externo. A migração **não** é revertida — migração é imutável neste
projeto, e uma tabela vazia num schema sem RLS não é risco.

---

## 17. Mapeamento de User Stories para Definições Técnicas

> Semântica **distinta** da §5.3: lá cada US aponta para o **fluxo/endpoint** que a realiza; aqui,
> para a **definição técnica consolidada** — componentes, modelo de dados e regra.

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | Efeito derivado da consulta, gravado pelas funções da fatia (ii), disparado por fila em vez de por relógio | `processarNotificacaoBancaria` · `AdaptadorCobrancaBancaria.consultarSituacao` · `liquidarPeloProvedor` · `negocio.evento_bancario` |
| US-02 | `@HttpCode(204)` e ausência de corpo: não existe lugar em que o desfecho pudesse viajar | `NotificacaoBancariaController` |
| US-03 | Coluna `recebido jsonb` gravada **antes** de qualquer interpretação; a interpretação é da tarefa | `registrarNotificacaoBancaria` · `plataforma.notificacao_bancaria` |
| US-04 | Nenhum caminho de escrita a partir do recebido; o único produtor de efeito é `SituacaoConsultada` | `processarNotificacaoBancaria` (passo B.8) |
| US-05 | Desfecho `SEM_CORRESPONDENCIA` antes do ramo que fala com o provedor | `rotearNotificacaoBancaria` · enum `desfecho_da_notificacao` |
| US-06 | Roteamento por chave única **no SaaS** (ADR-0033) + RLS na escrita subsequente | `negocio.rotear_notificacao_bancaria` · `contextoDeTenant` · políticas de `negocio` |
| US-07 | A função de roteamento **não tem parâmetro de empresa**; a carga da fila **não carrega empresa** | `negocio.rotear_notificacao_bancaria` · `CargaDaNotificacaoBancaria` |
| US-08 | Comparação `numeroDoTituloNoProvedor` recebido × gravado, com evento `NOTICIA_RECUSADA` | `processarNotificacaoBancaria` (B.7) · `registrarEventoBancario` · `TIPOS_DE_EVENTO_BANCARIO` |
| US-09 | Idempotência em três camadas (§9.2), sendo a estrutural o `WHERE` do `UPDATE` | `houveEfeitoDaLiquidacao` · `liquidarPeloProvedor` · reentrância da tarefa |
| US-10 | Desfecho `RETIDO` + índice parcial + reenfileiramento na reativação | `listarRetidas` · `EmpresaService.reativar` · `notificacao_bancaria_retida_idx` |
| US-11 | Ramo de interpretação que reconhece o pedido de validação **antes** de qualquer roteamento | `processarNotificacaoBancaria` (B.3) · desfecho `VALIDACAO_DE_ENDERECO` |
| US-12 | `DELETE` oportunista por `recebido_em`, com índice próprio | `expurgarNotificacoesVencidas` · `notificacao_bancaria_expurgo_idx` |
| US-13 | Terceiro valor de `ORIGENS_DO_EVENTO_BANCARIO`, publicado na trilha | `packages/contracts/src/cobranca-bancaria.ts` · `negocio.origem_do_evento_bancario` |
| US-14 | Seleção por `(contrato, competência ∈ recorte)` ordenada por vencimento + mesclagem sob demanda | `CarneService` · `PortaDeMesclagem` · `criarMescladorPdf` |
| US-15 | Reuso integral de `BoletoService.entregar`, que já distingue ausência de falha real | `BoletoService` · `GuardaDeBoletos` · adaptador |
| US-16 | Recusa **antes** de compor, nomeando a primeira cobrança sem título na ordem de vencimento | `CarneService.prepararRecorte` |
| US-17 | Composição pura sobre os bytes vigentes — nenhum estado guardado entre pedidos | `CarneService` · `criarMescladorPdf` |
| US-18 | Tradução do dialeto num ponto só, provada por varredura da **saída real** | `processarNotificacaoBancaria` · suíte de vocabulário |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| **Nova — composição de PDF** | `pdf-lib` | `^1.17` (fixar a exata no manifesto) | Única forma, em JavaScript puro, de **copiar páginas** de documentos já prontos sem re-renderizar. Reservada para esta fase **por escrito** pela tech-alignment da fatia `documentos-e-confirmacao`, ao rejeitá-la para o documento do contrato |
| Framework | NestJS + Fastify | 11 / 5 | Já instalado |
| ORM | Drizzle + `postgres.js` | já instalado | Já instalado |
| Cliente HTTP (saída) | `node:https` **nativo** | — | ⚠️ `undici` foi **avaliado e recusado**, com a razão no docblock de `adaptador-sicoob.ts`. Não o reintroduza |
| Mensageria | BullMQ + ioredis | já instalado | Fila nova, mecanismo velho |
| Renderização de PDF | `@react-pdf/renderer` | 4.6.0 | **Não serve aqui**: renderiza layout e não importa páginas de documento externo. Continua sendo o motor do contrato |
| Observabilidade | — | — | Não há coletor instalado (§13.2) |
| Verificação | `pdfjs-dist` | 6.2.108 (já em `@sysloc/documentos`) | Extrai o texto de volta para provar a mesclagem |

> **A introdução do `pdf-lib` não é inércia, e a distinção com o `undici` é o critério**: aquele tem
> substituto nativo equivalente; este **não tem substituto algum no monorepo** — a alternativa seria
> rasterizar ou reconstruir o boleto, o que **altera o fato recebido de terceiro** e contraria a
> cláusula de exclusão da ADR-0030.
>
> ⚠️ **A hipótese que o precede é medida antes de fixar a dependência**: que `pdf-lib` mescla
> preservando o conteúdo das páginas de origem sem re-renderizar. A prova é do caso de
> `packages/documentos/test/mesclador-pdf.spec.ts`, e ela roda **antes** de o carnê ser construído
> sobre ela. Se falhar, a fatia para e escala — não há plano B dentro da stack.

---

## 19. Estratégia de Testes

> **Resumo**: **40 casos de teste** (CT-967 a CT-1006) | Unitários: **3** | Integração: **20** |
> E2E: **16** (um deles na frente **shell**) | Segurança dedicado: **1**
> O **CT-1006** nasceu no challenge de 2026-08-18 (§21.3 (7)) — é a rede do terceiro ramo da
> conferência, e por isso ocupa o número seguinte ao último da geração.
> **Padrão**: Vitest 4.1.10 + `embedded-postgres` (Postgres real e efêmero) na frente TypeScript;
> `caso`/`ok`/`falhar`/`afirmar_igual`/`fechar_caso` na frente **shell** para infraestrutura
> (`.claude/rules/testing-stack.md`). Convenção de rastreabilidade `CA-xx → CT-xxx (RN-xx)` com
> seção de INVARIANTES por arquivo. **Sem mock de banco e sem mock de HTTP**: o provedor é
> substituído por uma implementação de **verificação** da porta `AdaptadorCobrancaBancaria`
> (ADR-0025), instrumentada para **contar chamadas** — contagem de chamada é efeito observável, não
> valor auto-setado.
> **Numeração**: o maior CT existente no repositório é o **CT-966**; esta fatia ocupa **967 a 1006**,
> sem lacuna e sem reuso.

> **Quatro correções aplicadas ao retorno do gerador** (ele rodou **antes** de este documento existir
> e inferiu nomes por convenção, o que ele próprio declarou):
> 1. **O caminho da rota é `/v1/notificacoes-bancarias`**, não `/v1/integracoes-bancarias/notificacoes`
>    — §21.1 (10). Onde um CT citar o segundo, leia o primeiro.
> 2. **O roster de `plataforma` compara nomes QUALIFICADOS pelo schema**: o CT-994 afirma
>    `['plataforma.notificacao_bancaria']`, e **não** `['notificacao_bancaria']`. O docblock de
>    `catalogo-de-plataforma.ts` é explícito: *"comparar nome curto contra nome qualificado é a
>    divergência silenciosa que faria toda tabela admitida reprovar como `FORA_DO_ROSTER`"*.
> 3. **A lógica pura ganha casa no pacote de domínio**, como o gerador sugeriu e esta spec adota:
>    `packages/cobranca-bancaria/src/tratamento-de-notificacao.ts` (classificação do recebido e
>    predicado de reentrega), com a suíte irmã. Os arquivos entram nas §3.4/§3.5.
> 4. **O verificador de borda vive em `deploy/scripts/borda/`**, área própria — é como os
>    verificadores já são agrupados (`caracterizacao/`, `cobranca-bancaria/`, `documentos/`,
>    `instalacao/`), e não dentro de `instalacao/`.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | A cobrança se publica paga minutos depois, pelo que a **consulta** informou | CT-979, CT-990 |
| CA-02 | O aviso é confirmado de imediato; o desfecho não compõe a resposta | CT-967, CT-969, CT-970 |
| CA-03 | Aviso ininterpretável é guardado como veio e confirmado igual | CT-968, CT-970 |
| CA-04 | Aviso forjado não liquida — só a consulta decide | CT-978, CT-990 |
| CA-05 | Órfão registrado e descartado **sem consultar** o provedor | CT-974 |
| CA-06 | Conta compartilhada não mistura carteiras | CT-973, CT-976 |
| CA-07 | A empresa vem da cobrança, nunca do recebido | CT-973, CT-977 |
| CA-08 | Divergência de conferência é registrada e recusada | CT-975, CT-1006 |
| CA-09 | Reentrega não repete efeito (três camadas) | CT-980, CT-981, CT-982 |
| CA-10 | Suspensa retém; a reativação aplica na ordem | CT-984, CT-985, CT-986 |
| CA-11 | O pedido de validação de endereço é respondido | CT-970, CT-987 |
| CA-12 | O cru é descartado depois de 90 dias | CT-988, CT-989 |
| CA-13 | Aviso e conferência de rotina se distinguem na trilha | CT-979, CT-983 |
| CA-14 | Carnê por contrato e intervalo, na ordem de vencimento | CT-995, CT-1001, CT-1002 |
| CA-15 | Carnê sai mesmo sem o arquivo guardado aqui | CT-996, CT-1003 |
| CA-16 | Carnê recusa nomeando a cobrança sem boleto | CT-997 |
| CA-17 | O mesmo recorte produz o mesmo documento | CT-999 |
| CA-18 | Recorte vazio recusa dizendo que não há o que reunir | CT-998 |
| CA-19 | Carnê de contrato de outra empresa é indistinguível de inexistente | CT-1000 |
| CA-20 | Só o caminho da notícia atende de fora; o cadastro se conclui | CT-971, CT-972, CT-1004, CT-1005 |
| CA-21 | Nenhum vocabulário do provedor vira regra ou estado | CT-991, CT-992, CT-993 |

**Nenhum CA órfão; nenhum CT sem CA.** O CT-994 é o único que rastreia uma exigência **transversal**
(a admissão do roster da ADR-0031) em vez de um CA — ele está anotado assim de propósito, porque a
regra que ele guarda é do projeto, não do PRD.

### 19.1 Testes Unitários

Funções puras, sem I/O — a camada mais baixa em que cada invariante pode viver.

#### Domínio: tratamento da notícia (`packages/cobranca-bancaria/test/tratamento-de-notificacao.spec.ts`)

Substituição: **nenhuma** (as funções não têm dependência).

| CT | Teste | CA | Objetivo | Input | Expected | Substituição | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|--------------|--------------------------|
| CT-970 | `classificarNotificacaoBancaria` decide entre as três categorias | CA-02, CA-03, CA-11 | Provar que a decisão *aviso × validação de endereço × ilegível* é pura e exaustiva, antes de qualquer banco | Tabela de 6 linhas: aviso completo · `validacaoWebhook:true` · sem identificador · identificador vazio · identificador com 17 posições · aviso válido **com campos extras desconhecidos** | `AVISO_DE_RECEBIMENTO` · `VALIDACAO_DE_ENDERECO` · `ILEGIVEL` (×3) · `AVISO_DE_RECEBIMENTO` — campo extra **não** desclassifica (RN-18) | — | — |
| CT-982 | `ehReentregaDeEfeitoAplicado` só reconhece desfecho `APLICADO` | CA-09 | Barrar o mutante que trata *qualquer* desfecho anterior como reentrega — o que faria um `DIVERGENTE` ou `RETIDO` nunca ser retratado | (a) mesmo identificador, anterior `APLICADO`; (b) mesmo identificador, anterior `DIVERGENTE` | (a) `true`; (b) `false` | — | — |

#### Contrato e vocabulário (`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`, estendida)

| CT | Teste | CA | Objetivo | Input | Expected | Substituição | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|--------------|--------------------------|
| CT-991 | Nenhum símbolo publicado usa vocabulário do provedor | CA-21 | Impedir que um nome do dialeto entre em enum, tipo ou valor de string dos módulos novos | Texto-fonte de `contracts/src/cobranca-bancaria.ts`, `db/src/notificacao-bancaria.ts` e `cobranca-bancaria/src/tratamento-de-notificacao.ts` | Zero ocorrências | — | — |

> ⚠️ **CT-991 é asserção ESTÁTICA e exige PROVA DE FALSIFICAÇÃO por execução.** Reintroduzir, numa
> cópia, um valor de enum com o nome do dialeto; ver o caso reprovar; reverter. Um arquivo íntegro de
> controle passa limpo no mesmo harness. É a regra do P4 do Protocolo Antirregressão e da
> `testing-stack.md`, e **não é opcional** aqui.

### 19.2 Testes de Integração

Fronteira real de banco em instância efêmera (`embedded-postgres`), com as migrações da fatia
aplicadas. O provedor entra pela porta, nunca por HTTP substituído.

#### Dados e catálogo (`packages/db/test/notificacao-bancaria.spec.ts` · `catalogo-de-plataforma.spec.ts`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-969 | O cru é gravado **sem contexto de tenant** e sem coluna de empresa | CA-02 | Provar por execução que a tabela vive fora do alcance da RLS (ADR-0031) | Unidade de trabalho **sem** `SET LOCAL app.empresa_id` → `registrarNotificacaoBancaria` → leitura de volta | A gravação sucede; a linha lida não tem coluna que identifique empresa | — |
| CT-973 | `negocio.rotear_notificacao_bancaria` roteia sem receber empresa | CA-06, CA-07 | Provar a travessia nominal da emenda da ADR-0024, e que a assinatura torna irrepresentável pedir roteamento em nome de uma empresa | Conectar pelo papel de aplicação, **sem** contexto → `SELECT * FROM negocio.rotear_notificacao_bancaria($1)` | Devolve a linha da empresa dona, com as **quatro** colunas e nenhuma a mais; `pg_proc` mostra **um** parâmetro; `proacl` mostra `EXECUTE` revogado de `PUBLIC` | A suíte **nunca** assume a identidade de `sysloc_roteamento` nem concede `EXECUTE` a `PUBLIC`: ela chama a função pelo papel de aplicação, como qualquer consulta. Análogo: `plataforma.proximo_identificador_bancario()` (migração `0016`) e `negocio.resolver_portador_de_confirmacao` (`0014`) |
| CT-994 | O roster de `plataforma` admite exatamente `plataforma.notificacao_bancaria` | (transversal — ADR-0031) | Fechar as **duas** direções da igualdade, e a **ordem normativa** dos motivos | `conferirAdmissaoDePlataforma` contra o banco real | `ROSTER_DE_PLATAFORMA` igual a `['plataforma.notificacao_bancaria']`; `excecoes: []`; `tabelasExaminadas` afirmado **contra o roster**, não contra o vazio; sub-caso de tabela com `empresa_id` reporta `CARREGA_COLUNA_DE_EMPRESA` **antes** de `FORA_DO_ROSTER`; sub-caso de tabela declarada e **ausente** reporta o motivo novo | — |

#### Tratamento da notícia (`apps/worker/test/notificacao-bancaria.spec.ts`)

Molde: `apps/worker/test/conferencia-bancaria.spec.ts`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-974 | Remessa de órfãos morre antes de qualquer consulta | CA-05 | Provar que envio forjado em massa **não consome cota** | 5 crus com identificador inexistente → tarefa | 5 × `SEM_CORRESPONDENCIA`; contador de `consultarSituacao` em **zero** | — |
| CT-975 | Divergência do número do título recusa sem tocar a cobrança | CA-08 | Provar que a conferência **recusa**, e que a divergência fica consultável | Aviso com identificador correto e número do título com um dígito trocado | `DIVERGENTE`; linha da cobrança **idêntica** antes e depois; zero consultas; evento `NOTICIA_RECUSADA` na trilha | — |
| CT-976 | Duas empresas na mesma conta do provedor | CA-06 | Provar que a conta compartilhada não mistura carteiras | Um aviso de cada empresa, mesma execução | Cada efeito na cobrança certa; sob contexto de A, a cobrança de B é **vazio** | `contextoDeTenant.executarCom({ empresaId })` com o `empresaId` que **a função de roteamento devolveu** — nunca um campo do recebido. Análogo: `apps/worker/src/tarefas/conferencia-bancaria.ts` |
| CT-977 | Campo do recebido que sugere outra empresa é ignorado | CA-07 | Barrar o mutante que lê empresa de campo do payload | Aviso da empresa A com campo extra sugerindo B | Efeito gravado sob o contexto de **A**; o campo extra sobrevive só no diagnóstico | idem CT-976 |
| CT-978 | Aviso forjado não move dinheiro | CA-04 | **O caso mais sensível do PRD**: o aviso alega recebimento e a consulta diz *em aberto* | Aviso válido + porta respondendo `EM_ABERTO` | `pago_em` permanece nulo; **nenhum** evento `COBRANCA_LIQUIDADA` | — |
| CT-979 | Aviso conferido: a consulta confirma e a cobrança se publica paga | CA-01, CA-13 | O caminho feliz inteiro, com a **origem** correta na trilha | Aviso válido + porta respondendo `LIQUIDADO` com data e valor conhecidos | `pago_em`/`valor_pago` batem com o que **a consulta** informou; evento com `origem: 'NOTICIA_DO_PROVEDOR'` | — |
| CT-980 | Reentrega do mesmo identificador de liquidação | CA-09 | Camada 1 da idempotência | Segundo aviso com o mesmo identificador da liquidação, após um `APLICADO` | `REENTREGA`; contador de consultas **não sobe**; cobrança inalterada | — |
| CT-981 | `liquidarPeloProvedor` recusa a segunda liquidação | CA-09 | Camada 2 — a **estrutural**, que sobrevive ao expurgo | Chamada direta sobre cobrança já paga | Retorno `NAO_ESTAVA_EM_ABERTO`; nenhum evento novo | — |
| CT-984 | Empresa suspensa retém sem efeito | CA-10 | Provar o bloqueio **lógico** | Aviso de cobrança de empresa com `suspensa_em` preenchido | `RETIDO`; zero consultas; cobrança inalterada | — |
| CT-985 | A reativação aplica os retidos na ordem de chegada | CA-10 | Provar que **nada se perde** | Reativação pela rota legítima do Master → 3 pendentes reprocessados | Os 3 efeitos gravados, na ordem cronológica original | Reusar a rota/serviço de reativação que a fatia `autorizacao-e-ciclo-de-acesso` publica — **nunca** um `UPDATE` direto em `identidade.empresa`. O reenfileiramento passa pelo mecanismo real de fila |
| CT-986 | Reativar A não aplica retidos de B, ainda suspensa | CA-10 | Barrar o vazamento que a varredura global poderia causar | Duas empresas suspensas, uma retida cada; reativa só A | O de A avança; o de B permanece `RETIDO` | idem CT-985 |
| CT-988 | Cru de 91 dias é apagado no expurgo oportunista | CA-12 | Provar o descarte **e** que o efeito sobrevive a ele | Processar um aviso recente, que dispara o expurgo | O cru de 91 dias não existe mais; o evento dele na trilha continua íntegro | — |
| CT-989 | Cru de 89 dias sobrevive | CA-12 | A **fronteira exata** do predicado — não "100 apaga, 1 não apaga" | idem | O cru de 89 dias permanece intacto | — |
| CT-1006 | Título gravado NULO não é divergência: a notícia atrasada de boleto revogado segue para a consulta | CA-04, CA-08 | Fechar o terceiro ramo da conferência (§21.3 (7)) — barrar o mutante de duas pernas, que compara contra `NULL` e recusa | Cobrança com boleto **revogado** (`nosso_numero` nulo, `identificador_no_provedor` vivo) + notícia com esse identificador → tarefa | `CONFERIDO_SEM_EFEITO`; **uma** consulta ao provedor; **zero** eventos `NOTICIA_RECUSADA`; cobrança inalterada | A revogação é feita pela via legítima (`revogarBoleto`), nunca por `UPDATE` direto — é ela que produz o par que o caso exercita |
| CT-993 | Motivo desconhecido do provedor viaja intacto | CA-21 | Provar que o que o produto não reconhece é **preservado**, não normalizado | Aviso divergente com motivo arbitrário inventado | A coluna de diagnóstico contém a cadeia **exata**, sem substituição por rótulo do produto | — |

#### Composição do carnê (`packages/documentos/test/mesclador-pdf.spec.ts`) e entrega

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-1002 | A mesclagem preserva as páginas de origem sem re-renderizar | CA-14 | **Validar a `[HIPÓTESE]` do `pdf-lib` ANTES de fixar a dependência** | Extrair texto dos PDFs de origem → mesclar pela porta → extrair texto do resultado por página | Texto de cada página do mesclado **idêntico** ao da origem correspondente; nenhuma página a mais | — |
| CT-1003 | Provedor indisponível na rebusca responde `503` sem alterar nada | CA-15 | Provar que os bytes **são** o desfecho e a falha não é engolida | Recorte com um arquivo apagado + porta respondendo indisponibilidade | `503`; nenhum documento; o arquivo continua ausente (nada foi regravado) | Sessão montada pela casa de acessórios de borda |

### 19.3 Testes End-to-End (E2E)

#### Fluxo A — a entrada da notícia (`apps/api/test/notificacao-bancaria.e2e.spec.ts`) — CT-967, CT-968, CT-971, CT-987

- **Arcabouço**: aplicação real instrumentada (`aplicacao-instrumentada.ts`) + Postgres efêmero,
  HTTP real em porta dinâmica, cliente **sem** seguir redirecionamento.
- **CA**: CA-02, CA-03, CA-11, CA-20.
- **Objetivo**: provar que a borda **confirma antes de tratar**, guarda o que não entende, nunca
  redireciona, e responde ao pedido de validação sem procurar cobrança alguma.
- **Pré-condições**: nenhuma sessão (a rota é pública); uma cobrança de arranjo para o corpo ser
  plausível.
- **Passos**: `POST` do aviso · `POST` de três corpos ininterpretáveis · `POST` do pedido de
  validação · em todos, ler status, corpo, cabeçalhos, e a linha crua no banco.
- **Validações**: `204` **sem corpo** e **sem `Location`** em todos; a linha crua carrega o payload
  como veio; os desfechos são `RECEBIDO`, `ILEGIVEL` e `VALIDACAO_DE_ENDERECO`; para a validação de
  endereço, **zero** chamadas à função de roteamento e à consulta.
  ⚠️ **Corpo sintaticamente inválido** é recusado pelo adaptador HTTP **antes** do manipulador
  (comportamento do Fastify, camada anterior a esta fatia): o CT-968 exercita **JSON válido e
  semanticamente desconhecido**, que é o que esta fatia de fato decide.

#### Fluxo B — o carnê (`apps/api/test/carne-do-contrato.e2e.spec.ts`) — CT-995 a CT-1001, CT-1003

- **Arcabouço**: aplicação real + Postgres efêmero + guarda de boletos em diretório temporário;
  porta do provedor substituída pela implementação de verificação.
- **CA**: CA-14 a CA-19.
- **Objetivo**: provar o documento único, a ordem, as duas recusas nomeadas, a rebusca silenciosa, a
  reprodutibilidade e o isolamento entre empresas.
- **Pré-condições**: contrato com 4 cobranças (competências de fevereiro a maio) com boleto emitido;
  sessão com `TELA:contratos` montada pela casa de acessórios.
- **Passos**: `GET` do recorte de 3 competências · `GET` com um arquivo apagado do disco · `GET` com
  uma cobrança sem boleto · `GET` de recorte vazio · `GET` duas vezes seguidas · `GET` com sessão de
  outra empresa · `GET` com os 4 recortes malformados.
- **Validações**: `200` com `application/pdf` e `attachment`; exatamente 3 boletos, na ordem de
  vencimento; a rebusca é invisível para quem pediu e **não** gera evento na trilha; `404` com
  `detalhes.carne` **distinto** em cada recusa (`BOLETO_AUSENTE` com o código da cobrança ·
  `SEM_COBRANCAS`); `404` de outra empresa **idêntico** ao de inexistente; `422` nomeando o campo
  **sem nenhuma consulta ao banco**; os dois documentos do mesmo recorte com **conteúdo e ordem**
  iguais.
  ⚠️ **CT-999 compara conteúdo e ordem, não bytes brutos** — §21.1 (9): metadado de geração do PDF
  divergiria por razão irrelevante à invariante, e fabricar um instante fixo seria mentira gravada no
  documento.

#### Fluxo C — a superfície e o vocabulário (suítes existentes, estendidas) — CT-972, CT-983, CT-990, CT-992, CT-1004

- `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`: **CT-972** (a rota está em `publicas`,
  ausente de `semDeclaracao`) e **CT-1004** (as duas medições fecham em **101/86** e **concordam
  entre si**; `publicas` em 20).
- `apps/api/test/historico-bancario.e2e.spec.ts`: **CT-983** — o item da trilha traz
  `origem: 'NOTICIA_DO_PROVEDOR'`, distinguível de `CONFERENCIA`.
- `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts`: **CT-992** — nenhum termo do dialeto nos
  corpos, cabeçalhos e no documento publicado das rotas novas, com **controle positivo** ativo.
- `apps/api/test/segredo-nao-escapa.e2e.spec.ts`: **CT-990** — varredura da **saída real** (carga da
  fila serializada, diário do processo, corpo e cabeçalhos da resposta) atrás do material do
  certificado e da chave de cifra, com **controle positivo canal a canal**.

> ⚠️ **CT-1004 é asserção ESTÁTICA (contagem sobre a tabela do roteador e a composição) e exige
> PROVA DE FALSIFICAÇÃO por execução**: introduzir uma rota fantasma — ou remover a rota da notícia —
> numa cópia, ver a asserção reprovar (`expected 100 to be 101`), reverter. Controle com a composição
> íntegra passa. Mesma forma canônica dos CT-533, CT-635, CT-732 e CT-937.

#### Fluxo D — a borda externa (`deploy/scripts/borda/verificar-notificacao-bancaria.sh`) — CT-1005

- **Arcabouço**: frente **shell**, sem Vitest — `caso`/`ok`/`falhar`/`afirmar_igual`/`fechar_caso`.
- **CA**: CA-20.
- **Objetivo**: provar por **medição** que a borda publica exatamente um caminho.
- **Passos**: requisitar o caminho da notícia (deve alcançar o serviço) · requisitar `/docs`,
  `/v1/auth/*`, `/saude` e um caminho inexistente (devem ser recusados **pela própria borda**, sem
  repasse) · requisitar em HTTP puro (não deve haver redirecionamento que altere método ou corpo) ·
  conferir que a configuração que atende a operação **não mudou**.
- ⚠️ **O hostname é lido de configuração, nunca fixado no verificador** — a `[DÚVIDA] 4` do discovery
  (qual hostname atende) é decisão operacional do usuário e continua aberta.

### 19.4 Cenários de Erro

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---------|----|----------|---------|------------------------|
| Corpo ininterpretável | CA-03 | Guardar mesmo sem entender | JSON válido, forma desconhecida | `204` + cru gravado + desfecho `ILEGIVEL` |
| Aviso órfão | CA-05 | Não gastar cota com o que não se reconhece | Identificador inexistente | `SEM_CORRESPONDENCIA` + **zero** consultas |
| Conferência divergente | CA-08 | Recusar em vez de aplicar | Número do título trocado | `DIVERGENTE` + evento `NOTICIA_RECUSADA` + cobrança intacta |
| Aviso forjado | CA-04 | O aviso não decide | Porta responde `EM_ABERTO` | Cobrança em aberto + nenhum evento de liquidação |
| Reentrega | CA-09 | Efeito único | Mesmo identificador da liquidação | `REENTREGA` + zero consultas |
| Empresa suspensa | CA-10 | Reter sem perder | `suspensa_em` preenchido | `RETIDO` + reprocessável na reativação |
| Fila indisponível na recepção | — | Nunca perder a notícia | Redis fora do ar | `204` mesmo assim + `warn` + cru em `RECEBIDO` |
| Recorte sem cobrança | CA-18 | Não devolver documento vazio | Intervalo sem cobrança do contrato | `404` + `detalhes: { carne: 'SEM_COBRANCAS' }` |
| Cobrança sem boleto no recorte | CA-16 | Não entregar documento parcial | Cobrança com título nulo | `404` + `detalhes: { carne: 'BOLETO_AUSENTE', cobranca }` |
| Recorte malformado / invertido / largo demais | CA-14 | Recusar **antes** de tocar o banco | 4 formas de entrada inválida | `422 CAMPO_INVALIDO` nomeando o campo + zero consultas |
| Contrato de outra empresa | CA-19 | Indistinguível de inexistente | Sessão de A, código de B | `404` com corpo **idêntico** |
| Provedor indisponível na rebusca | CA-15 | Não engolir a falha | Porta responde indisponibilidade | `503` + nada regravado |
| Caminho não publicado alcançado de fora | CA-20 | Superfície externa é uma só | `GET /docs` pelo hostname da notícia | Recusa **da borda**, sem repasse |

### 19.5 O que NÃO é testado, e por quê

Registrado porque **cap silencioso lê como cobertura completa**:

- **Visão administrativa das notícias recusadas** — fora do escopo do PRD §4.2, adiada com gatilho.
- **Expurgo dos boletos guardados em disco** — débito da F5 (`D26 · F4/T9`), fora desta fatia.
- **Autenticação do provedor no webhook** — ele não oferece nenhuma; a compensação é a forma da
  fatia, coberta pelos CT-973 a CT-978.
- **Agendamento por horário** — é da F5; aqui só o expurgo oportunista (CT-988/989).
- **Cobrança por Pix** — meio previsto sem operação (decisão 18).
- **Carga e desempenho do pior caso do carnê** — não se escreve teste de carga neste projeto; o
  dimensionamento está declarado na §12.
- **Reteste do que as fatias (i) e (ii) fecharam** — consumido como está; reprová-lo aqui seria
  duplicação entre camadas.

---

## 20. Riscos Técnicos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | ⚠️ **O certificado em uso vence em 2026-08-22** (medido em 2026-08-16 por leitura do próprio material). CA-01, CA-04, CA-15 e CA-20 dependem de conversa com o provedor | **Certa**, se a renovação não acontecer | **Bloqueante** para 4 CAs | Decisão do usuário de 2026-08-16: assumir a renovação e seguir o plano. Esta fatia é a que mais o consome, porque só ela cadastra a notificação de verdade. As tasks que **não** dependem do provedor (carnê com arquivos em disco, roteamento, desfechos, expurgo) são independentes e avançam mesmo com o risco aberto |
| R2 | **A prova de que o identificador volta íntegro alcança só o caminho de consulta.** A sonda de 2026-08-16 mediu 3 de 3 **consultando**; o caminho da notícia nunca recebeu tráfego (100% dos 1.864 registros do legado entraram por pergunta nossa). O roteamento inteiro depende disso | Média | **Crítico** — se o provedor truncar ou não devolver o `seuNumero`, o critério da ADR-0035 cai e o roteamento precisa ser redesenhado | **Medir aqui, não herdar por citação**: a primeira notícia real recebida no cadastro é a medição. Até ela, o desfecho `ILEGIVEL` preserva o recebido íntegro, de modo que a evidência fica gravada mesmo no caso adverso. É a razão de o cru ser gravado **antes** de interpretar |
| R3 | O provedor pode exigir **corpo** na resposta da validação de endereço, e não apenas o código `204` | Baixa (a documentação diz que só o código importa: 200/201/204) | Médio — o cadastro não se conclui | A medição é o próprio cadastro (CA-20), que é critério de pronto. O ajuste, se necessário, é **um decorador**: `@HttpCode(200)` mais o eco de `idWebhook`. A escolha do `204` é a mais forte enquanto ela servir, porque **não existe corpo** onde o desfecho pudesse vazar |
| R4 | `pdf-lib` pode re-renderizar, alterar ou perder conteúdo das páginas de origem | Baixa | Alto — alteraria o **fato recebido de terceiro** (ADR-0030) | Hipótese **medida antes** de a dependência ser fixada, em caso próprio (`mesclador-pdf.spec.ts`), com extração de texto de volta e comparação com o original. Falhando, a fatia **para e escala**: não há plano B na stack |
| R5 | Pior caso do carnê (12 arquivos ausentes) leva ~130 s numa requisição em linha | Baixa (exige perda do cache de disco) | Médio — cliente pode desistir antes | Recorte limitado a **12 competências** na borda, o que torna o pior caso **declarável**. A alternativa (fila com acompanhamento) conflita com ADR-0029 **e** ADR-0030 e foi recusada na D6 do tech-alignment |
| R6 | **A conferência do identificador do cliente não tem contra o que comparar** — o produto não modela a identidade da empresa perante o provedor (medido pelo D36 · F4/T10 em 2026-08-15, reafirmado em 2026-08-17) | **Certa** — é fato medido, não previsão | Médio — a CA-08 é cumprida pela metade que existe | Ver §21.3 (2). A conferência do **número do título** é implementada e provada; a do identificador do cliente vira débito com gatilho amarrado ao D36. Trazê-la agora exigiria alargar a superfície publicada (`esquemaDoCertificadoNovo`) às vésperas do congelamento — o que o próprio D36 mede como pior que adiar |
| R7 | Suspensão de empresa mais longa que 90 dias faz o cru retido ser expurgado | Baixa | Baixo | A conferência diária da fatia (ii) descobre a liquidação de qualquer maneira; o que se perde é a **origem** na trilha, não o recebimento (§7.5) |
| R8 | O `ALTER TYPE … ADD VALUE` de enum não roda dentro de bloco transacional em algumas versões/contextos do PostgreSQL | Média | Médio — migração aborta no meio | O valor novo entra na `0019` (domínio), separado das concessões da `0020`, e a task confere a aplicação num banco efêmero **antes** de tocar o durável. O verificador `verificar-migracao.sh` já existe |
| R9 | Publicar um caminho para fora é mudança de postura de segurança do produto | Média | Alto se o vhost expuser mais do que um caminho | O verificador de borda afirma por **medição** que nenhum outro caminho responde naquele hostname — inclusive `/docs`, `/v1/auth/*` e `/saude` —, e que o vhost que atende a operação não foi tocado |
| R11 | ⚠️ **O `drizzle-kit generate` vai propor `CREATE SCHEMA "plataforma"` na `0019`** — esta é a primeira fatia a declarar uma tabela naquele schema, e até agora o aviso dos cabeçalhos da `0015` e da `0017` era teórico | **Certa** — é comportamento conhecido do gerador, não previsão | Médio — `verificar-migracao.sh` asserção **(e)** reprova, e a migração não se aplica | Suprimir a instrução e **declarar a supressão em comentário de cabeçalho** da `0019`, no molde literal da `0015` e da `0017`. O schema nasce no `provisionar-base.sh` e no `banco-efemero.ts`. A asserção (e) é o detector, e ela já tem o próprio controle antivácuo (a varredura ingênua acusa; a com exclusão de comentário não) |
| R10 | Renomear `nosso_numero` (D14) alcança a visão `negocio.cobranca_derivada`, que expandiu `c.*` no instante da criação | Média | Médio — a visão quebra ou passa a publicar o nome antigo | O renome e a **recriação da visão** vivem na mesma migração, e as duas cópias homônimas de `COLUNAS_DA_COBRANCA` em `test/` são alteradas no mesmo diff. É exatamente o que o marcador do D14 manda fazer |

---

## 21. Observações Técnicas

### 21.1 Decisões auto-resolvidas pela Autonomia do Run (A1)

`.claude/rules/autonomia-do-run.md` é autorização **permanente** e manda decidir pela recomendada e
registrar. Nenhuma pergunta foi feita. As dez decisões, com as alternativas concorrentes e a razão:

| # | Decisão | Alternativas | Adotada | Razão |
|---|---------|--------------|---------|-------|
| 1 | Variante da tech spec | web · mobile · **backend** | **backend** | O repositório só faz backend (Fronteira do `CLAUDE.md`); tech-alignment e `sdd_state.yaml` já diziam `backend` |
| 2 | Papel que atravessa a política de linha | reusar `sysloc_resolucao` · **papel novo `sysloc_roteamento`** | **papel novo** | A emenda da ADR-0024 exige papel de **propósito único** com `SELECT` sobre *"a única tabela alcançada"*. Reusar o papel do portador o faria alcançar duas tabelas e diluiria a propriedade que a ADR nomeia. Custo: duas frentes de provisionamento, mecânicas e já precedentadas |
| 3 | Código de resposta ao provedor | `200` com corpo · `201` · **`204` sem corpo** | **`204`** | Está no conjunto que o provedor aceita, e é o **único** em que a CA-02 vira propriedade estrutural: não existe corpo onde o desfecho pudesse vazar. Risco R3 declarado, com ajuste de um decorador |
| 4 | Onde vive o desfecho do roteamento | tabela nova de pendências · **coluna `desfecho` no próprio cru** | **coluna no cru** | Nenhuma tabela nova; o pendente é encontrado por índice **parcial** (`WHERE desfecho = 'RETIDO'`), sem varredura ampla. É a D4 do tech-alignment instanciada |
| 5 | Granularidade do expurgo | amostrado (1 em N) · **a cada notícia tratada** | **a cada tratamento** | Determinístico e diretamente testável; o volume é irrisório e o índice por `recebido_em` o torna barato. Amostragem introduziria aleatoriedade num caminho que a suíte precisa afirmar |
| 6 | O expurgo alcança o `RETIDO` vencido? | preservar o retido · **expurgar tudo** | **expurgar tudo** | RN-11 e CA-12 são incondicionais; preservar criaria retenção **sem prazo** de dado pessoal exatamente no caso que a regra fecha. Rede: a conferência diária (R7) |
| 7 | Compartilhar a leitura do certificado entre as rebuscas de um carnê | alterar `BoletoService.entregar` · **não alterar** | **não alterar** | O que se repete é um `SELECT` indexado, irrelevante diante da chamada de rede que ele precede; e o cache de credencial (300 s) já evita a repetição cara. Alterar reabriria caminho fechado da fatia (ii) sem ganho medido |
| 8 | Largura máxima do recorte do carnê | ilimitada · **12 competências** | **12** | Transforma o pior caso de *ilimitado* em *declarável* (§12.1). O carnê é, por natureza, o caderno de um ano — o próprio PRD fala em doze parcelas |
| 9 | Como a CA-17 é afirmada | igualdade **byte a byte** · **igualdade de conteúdo e ordem** | **conteúdo e ordem** | É literalmente o que a CA-17 pede (*"o mesmo conteúdo, na mesma ordem"*). Byte a byte obrigaria a fabricar um instante fixo nos metadados do PDF — mentira gravada no documento em troca de uma propriedade que ninguém pediu |
| 10 | Caminho da rota da notícia | sob `integracoes-bancarias` (área de tela) · **caminho próprio `/v1/notificacoes-bancarias`** | **caminho próprio** | O prefixo `integracoes-bancarias` deriva da lista fechada de **áreas de tela**, e esta rota não tem área. É o precedente da outra superfície sem sessão (confirmação de e-mail), que tem caminho e módulo próprios |

### 21.2 A entrada da notícia e a rule do contrato publicado — leitura de alcance, não divergência

`.claude/rules/contrato-publicado.md` fixa *"entrada é fechada: esquema de entrada usa
`z.strictObject`"*. Ela **não alcança** o corpo da notícia, e a razão é o sujeito dela: a rule governa
o **esquema do pacote de contratos**, que *"é importado pelo frontend"*, e justifica a estritude
porque *"campo desconhecido na entrada é erro do cliente"*.

Aqui não há nem uma coisa nem outra: o provedor **não é cliente nosso** — ele não pode corrigir o
payload —, e o corpo da notícia **não tem esquema em `@sysloc/contracts`**. O que existe é uma
leitura tolerante, interna à tarefa, de um **fato de terceiro**; e a RN-02/CA-03 **obrigam** a guardar
e confirmar o que não se entende. Recusar por chave desconhecida seria perder a notícia — o defeito
que a fatia existe para não ter.

O único esquema de **entrada publicado** desta fatia é `esquemaDoRecorteDoCarne`, e ele é
`z.strictObject`, com as duas recusas provadas na forma que a rule exige (`code`/`keys` para chave
excedente, `path` para valor inválido).

### 21.3 Achados de medição — coisas que a spec fecha porque as mediu

1. **A restrição de fuso do PRD é resolvida por refutação da premissa.** O PRD delegou *"as datas do
   recebido vêm em fuso universal e precisam ser lidas no fuso da operação"*. A medição desta spec é
   que **nenhuma data do recebido entra no domínio**: pela RN-07 o aviso não decide, e a única data
   que se grava é a `pagoEm` que a **consulta** devolve — caminho já fechado pela fatia (ii). Não há
   conversão a implementar, e nenhuma quarta declaração executável do fuso nasce aqui (os débitos
   D14 · F3/T5 e D25 · F4/T7 **não** são agravados).
2. ⚠️ **A conferência do identificador do cliente não pode ser feita nesta fatia, e o PRD supõe que
   pode.** A RN-05 e a CA-08 mandam conferir *"o número do título no provedor **e** o identificador do
   cliente"* contra o que está gravado. O **D36 · F4/T10** mediu, em 2026-08-15 e de novo em
   2026-08-17, que o produto **não modela a identidade da empresa perante o provedor** — o
   identificador da aplicação, o endereço de autorização e os dados da conta (inclusive o número do
   cliente) *"hoje sem origem em lugar nenhum"*. **Não há valor gravado contra o qual comparar.**
   - **O que esta fatia entrega**: a conferência do **número do título no provedor**, que existe e é
     gravado, com o desfecho `DIVERGENTE` e o evento `NOTICIA_RECUSADA`.
   - **O que fica**: a segunda metade da CA-08, registrada como débito com gatilho amarrado ao D36 —
     fecha quando o produto modelar aquela identidade.
   - **Por que não agora**: trazer o número do cliente exige campo novo em `esquemaDoCertificadoNovo`,
     isto é, **superfície publicada**, às vésperas do congelamento — o que o próprio D36 mede como
     pior que adiar.
3. ⚠️ **O D34 NÃO fecha aqui, e o gatilho dele precisa ser emendado.** Ele declara como gatilho *"a
   fatia que trouxer a notícia recebida do provedor (a (iii))"*. Medido: a notícia **não** fornece a
   chave de correlação que falta. O órfão do D34 é um título emitido cujo `identificadorNoProvedor`
   **nunca foi persistido**; a notícia traz esse identificador, mas não há nada gravado com que
   casá-lo — ela cai, corretamente, em `SEM_CORRESPONDENCIA`. O que fecharia o D34 é **persistir o
   identificador antes de chamar o provedor**, que é mudança em `emissao-em-lote.ts`, arquivo da
   fatia (ii), fora do escopo declarado desta.
   - **O que esta fatia entrega ao D34**: **observabilidade**. O órfão deixa de ser invisível — ele
     aparece como linha `SEM_CORRESPONDENCIA` na tabela crua, com o identificador que o provedor
     devolveu, o que permite medir se ele existe e quantos são.
   - **Recomendação**: emendar o `QUANDO FECHA` do D34 para *"a fatia que persistir o identificador
     perante o provedor antes da chamada de emissão"*, preservando o texto original (molde das
     emendas das ADRs 0001, 0017, 0021 e 0024). É o precedente do projeto — *prescrição envelhece;
     meça a premissa antes de registrá-la*.
4. **Os três débitos da F1 continuam sem eixo** — §11.5, confirmado por leitura dos três marcadores.
5. **A segunda direção da igualdade do roster de `plataforma` ganha conteúdo próprio nesta fatia**, e
   o cabeçalho de `catalogo-de-plataforma.ts` já a agendava para *"a fatia que puser a PRIMEIRA
   tabela no roster"*: a partir daqui, uma tabela **declarada e ausente do banco** (renomeada, ainda
   não migrada, dropada) deixa de ser impossível. Ela nasce com motivo próprio (`AUSENTE_DO_BANCO`) e
   caso próprio, no mesmo commit em que ganha o que a exercite.

6. ⚠️ **A reativação passa a retomar trabalho, e o docblock de `reativar` diz o contrário — a emenda
   dele é parte da mudança, não zelo.** O método hoje declara *"**Ela limpa a marca e nada mais**
   (RN-05). Não há restauração de sessão porque não há o que restaurar: a suspensão apagou os
   registros, e devolvê-los exigiria tê-los guardado — que é **precisamente a diferença entre
   'reativar o acesso' e 'retomar o que estava em curso'**"*.
   - **A frase era verdadeira, e continua sendo, sobre sessão.** O que ela nomeia como impossível é
     restaurar o que **não foi guardado**. A notícia retida é o oposto: ela **está** guardada, com
     prazo declarado, justamente porque a empresa estava suspensa quando chegou. Retomá-la não é
     restaurar sessão — é aplicar um fato recebido que a suspensão mandou **reter**, e a CA-10 exige.
   - **Por que continua morando em `reativar`**: o gatilho da CA-10 é o **ato de reativar**, e não há
     segundo ponto por onde ele passe. Instalar o reenfileiramento noutro lugar criaria um segundo
     caminho para o mesmo ato — a topologia que a `.claude/rules/nao-regressao.md` §5 manda evitar.
   - **O que a T que tocar o arquivo DEVE fazer**: emendar o docblock no molde das emendas de ADR —
     texto original preservado, bloco `> **Emenda de 2026-08-…**` declarando o alcance real (*sessão
     não se restaura; trabalho retido se retoma*) e nomeando a CA-10. Reescrever a frase, apagá-la ou
     "corrigi-la" é **R3**, e a §6 do protocolo manda o Gate 2 tratar como `architecture`.
   - **Alternativas descartadas no challenge**: ouvinte próprio fora do `EmpresaService` (mecanismo de
     evento de domínio que o produto não tem, às vésperas do congelamento) e varredura oportunista
     sem gatilho na reativação (deixaria a CA-10 sem gatilho — o retido só andaria quando chegasse
     notícia nova, e pode nunca chegar).

7. ⚠️ **A conferência tem um terceiro ramo, e ele é alcançável por decisão da fatia (ii).**
   `revogarBoleto` (`packages/db/src/boleto-da-cobranca.ts`) zera `nosso_numero` e **preserva**
   `identificador_no_provedor`, e o docblock diz por quê com todas as letras: *"ele é a chave de
   correlação por onde **uma notícia atrasada do provedor ainda se liga a esta cobrança**, e ele não
   se recompõe"*. Logo o par *identificador preenchido × número do título nulo* **existe de
   propósito**, e foi preservado ali **para esta fatia**.
   - **O defeito que isto fecha**: comparar contra `NULL` faria toda notícia atrasada de boleto
     revogado morrer como `DIVERGENTE` + `NOTICIA_RECUSADA` — anomalia registrada na trilha para um
     caso que não é anomalia nenhuma, e exatamente o oposto do que a chave foi preservada para
     permitir.
   - **O ramo**: gravado nulo **não confere e não recusa** — segue para B.8, e o provedor informa se
     aquilo foi revogado, liquidado ou nada. Nenhum valor novo de enum nasce: `revogarBoleto` já
     devolve `NAO_HAVIA_BOLETO`, que a §5.1 B.8 mapeia para `CONFERIDO_SEM_EFEITO`.
   - **A rede**: caso próprio na suíte da tarefa (cobrança com boleto revogado + notícia com o
     identificador vivo), afirmando `CONFERIDO_SEM_EFEITO`, **uma** consulta ao provedor e **zero**
     eventos `NOTICIA_RECUSADA`. Ele reprova com o ramo de duas pernas e passa com o de três — é a
     asserção que discrimina (P4 do Protocolo Antirregressão, natureza **comportamental**).
   - **Alternativas descartadas no challenge**: décimo valor de enum (`TITULO_JA_REVOGADO`) sem
     consultar — deixaria sem efeito a liquidação que corra com a revogação, com a conferência diária
     como única rede; e manter `DIVERGENTE` declarando o caso — contradiz o docblock da fatia (ii)
     sem confrontá-lo.

### 21.4 Débitos com gatilho — os que disparam, os que nascem e os que não disparam

**Disparam e são fechados nesta fatia** (o marcador sai no mesmo commit, e a linha sai do `CLAUDE.md`):

| Débito | Onde | Por quê dispara aqui |
|---|---|---|
| **D5 · F3/T7** | `apps/api/test/documento-do-contrato.e2e.spec.ts` | O gatilho é literal: *"o TERCEIRO consumidor de extração de texto de PDF — o **carnê da F4**"*. `extrairTextoDePdf` desce para `apps/api/test/documento.ts` e as duas suítes o importam |
| **D14 · F4/T6** | `packages/db/src/esquema/negocio.ts` | O gatilho é *"a fatia (iii) ao consumir a coluna"*, e ela é consumida na conferência. O `RENAME COLUMN` sai de graça na migração desta fatia, junto da recriação da visão |
| **D38 · F4/T10** | `packages/cobranca-bancaria/src/adaptador-sicoob.ts` | ⚠️ **GATILHO VENCIDO** — a T11 passou sem cumprir, e o marcador declara a fatia (iii) como **dono natural**. Fechar custa três casos sem fronteira de rede sobre `criarAdaptadorSicoob` |
| **D63 · F4/fechamento** | `apps/api/test/certificado-do-provedor.e2e.spec.ts` | O gatilho é *"a próxima suíte E2E que precisar destes acessórios"*, e esta fatia traz **duas**. `pedir`, `entrar`, `conceder` e `credencialDeSessao` descem para `apps/api/test/acessorios-de-borda.ts` |

**Disparam e são apenas anotados** (a decisão consciente é registrar, não fechar):

| Débito | Onde | Conduta |
|---|---|---|
| **D58 · F4/T16** | `apps/worker/src/tarefas/emissao-em-lote.ts` | A tarefa nova é o **terceiro consumidor** do discriminador de reentrância. Fechá-lo é restringir o parâmetro de tipo — mudança em arquivo da fatia (ii) que os dois gates já aprovaram. Recomendação: fechar numa intervenção dirigida, com os três consumidores no mesmo diff |
| **D52 · F4/T16** | `apps/worker/test/varredura-de-segredo.ts` | A suíte da tarefa nova é o **terceiro consumidor** do molde de varredura. A casa compartilhada continua sendo `apps/worker/test/` — os três consumidores vivem lá, então o Limiar de Três **não** manda subir de pacote; o marcador é atualizado, não removido |

**Nascem nesta fatia** (marcador novo, linha nova no `CLAUDE.md`, §2 do `run-report.md` da fatia):

| Débito | Onde | Dispara quando |
|---|---|---|
| **novo** — conferência do identificador do cliente ausente | `apps/worker/src/tarefas/notificacao-bancaria.ts`, junto da conferência | quando o produto modelar a identidade da empresa perante o provedor — **o mesmo gatilho do D36 · F4/T10** |
| **novo** — notícia parada em `RECEBIDO` não tem quem a reprocesse | `apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts`, junto do `catch` do enfileiramento | a **F5**, que traz o agendamento, ou o primeiro caso real de fila indisponível na recepção |
| **novo** — o vhost publica um caminho e não há limitador de abuso nele | `deploy/nginx/sysloc-notificacao-bancaria.conf` | a **publicação da API inteira na F7**, quando o eixo de origem passa a existir para os D23/D24/D27 |

**NÃO dispara** (medido, e registrado para que a próxima fatia não o redescubra):

- **D34 · F4/T11** — §21.3 (3): a notícia não fornece a chave de correlação; o gatilho precisa ser
  emendado.
- **D26 · F4/T9** (expurgo dos boletos guardados) — fora do escopo por decisão de 2026-08-18; o
  gatilho continua na F5.
- **D12 · F3/T10** (terceira mensagem de e-mail) — esta fatia não envia e-mail algum.
- **D23**, **D24**, **D27** (F1) — §11.5.

> ⚠️ **A numeração dos débitos novos sai da §2 do `run-report.md` DESTA fatia**, não da sucessão dos
> marcadores existentes, e o identificador é o par `Dnn · F4/{origem}` mais o caminho do `ÍNDICE`
> (`.claude/rules/nao-regressao.md` §3-B). Confundir o conjunto dos marcadores com o conjunto dos
> débitos foi a causa das três colisões de numeração da F1.

### 21.5 ADRs Aplicáveis nesta Feature

**Inventário declarativo com conformidade literal** — para cada ADR `APLICÁVEL`/`PARCIAL` que
restringe artefato concreto, a `Decision` foi **aberta e confrontada** contra a decisão desta spec.
Onde a conformidade é literal, o trecho está citado.

| ADR | Classificação | Onde toca · conformidade confrontada |
|---|---|---|
| **0035** | **APLICÁVEL** — é a razão da fatia | Todas as sete cláusulas da `Decision`, uma a uma: *"persiste o recebido cru antes de interpretá-lo"* → §5.1 A.2.1; *"responde de imediato, sem que o processamento componha a resposta"* → `204` sem corpo, §21.1(3); *"roteia por uma chave que o próprio produto emitiu e que fez o trajeto de ida e volta"* → §5.1 B.4; *"deriva a empresa do registro encontrado (ADR-0024)"* → a função sem parâmetro de empresa; *"todo o resto do recebido como conferência, cuja divergência é registrada e recusada"* → §5.1 B.7; *"descarta o que não casa sem consultar o terceiro"* → §5.1 B.4; *"é idempotente pelo identificador do fato"* → §9.2; *"é declarada `publicas`, de modo que `semDeclaracao` permanece vazio"* → §4.1 |
| **0024** (+ emenda 2026-08-13) | **APLICÁVEL com CONFLITO declarado** — o eixo técnico; ver o bloco logo abaixo da tabela | A emenda nomeia este caso: *"o retorno de integração externa que o `Context` acima nomeia é o webhook bancário da F4"*. As cinco exigências dela, literalmente: função `SECURITY DEFINER` (§7.3) · papel `NOLOGIN` de propósito único, que não conecta e **não é dono de tabela alguma** (`sysloc_roteamento` é dono só da função) · política própria endereçada a esse papel · `GRANT` mínimo (`USAGE` no schema e `SELECT` sobre **a única tabela alcançada**, `negocio.cobranca`) · `EXECUTE` revogado de `PUBLIC` e concedido nominalmente · **função sem parâmetro de empresa**. E *"travessia por privilégio de dono segue rejeitada"* — nada aqui a reabre. ⚠️ **A `Decision` e o `Neutros` dela exigem `empresaId` na carga da fila, e esta fatia não o carrega** — conflito declarado, com conduta fechada, no bloco abaixo da tabela |
| **0031** | **APLICÁVEL** | *"Tabela que não é dado de negócio de nenhuma empresa vive fora do schema de negócio, num terceiro schema — `plataforma` —, e não carrega `empresa_id`"* → §7.2; *"o roster de tabelas de `plataforma` é enumerado, de modo que uma tabela nova ali só entra por alteração explícita e revisada"* → a entrada em `ROSTER_DE_PLATAFORMA`; *"a admissão é conferida no catálogo do sistema, nas duas pontas"* → §21.3(5) |
| **0034** | **APLICÁVEL** | *"registra o efeito — mudança de estado do fato de negócio **ou desfecho anômalo, como divergência e recusa** —, nunca a tentativa que nada mudou"*: `NOTICIA_RECUSADA` é anomalia (mesma classe de `DIVERGENCIA_DE_VALOR`); `CONFERIDO_SEM_EFEITO` **não** gera evento; o órfão **não** gera evento; a rebusca do carnê **não** gera evento. E *"a decisão não alcança o registro operacional de diagnóstico"* → o `desfecho` na tabela crua é justamente esse registro |
| **0029** | **APLICÁVEL nas duas direções** | *"Todo efeito externo cujo resultado não compõe a resposta do pedido é enfileirado pela borda"* → a fila `notificacao-bancaria`; *"chamada síncrona a terceiro cujo retorno o solicitante espera na própria resposta permanece em linha, e não é exceção: está fora do que ela alcança"* → o carnê, cujos bytes **são** a resposta |
| **0030** | **APLICÁVEL** | *"composto no instante do pedido e nunca armazenado: não existe caminho de escrita dele"* → o carnê; *"fato recebido de terceiro — boleto emitido pelo provedor — não é artefato derivado... guardá-lo é o único caminho"* → os bytes do boleto continuam guardados, e a mesclagem **não os re-renderiza** |
| **0028** | **APLICÁVEL** | *"declara três coisas: o tipo de mídia, o nome sugerido do arquivo e o mesmo envelope de erro"* → §4.1.1; *"não declara forma do corpo de sucesso"* → `format: 'binary'`, no molde já registrado das rotas do documento do contrato e do boleto |
| **0011** | **APLICÁVEL** | *"a rota que não declara nada é recusada"* e *"nenhuma rota sem declaração"* → `semDeclaracao` vazio; a notícia é exceção **explícita** por `@RotaPublica()`, e o carnê herda a exigência da classe |
| **0018** | **APLICÁVEL** | *"nenhum manipulador exige menos do que a classe dele exige"* → o carnê **não declara nada no método**, e portanto não substitui a exigência da classe. Declarar `@ExigeChave` ali seria pior que redundante |
| **0017** | **APLICÁVEL** | *"a chave exposta é o código textual legível quando a entidade tem uma série declarada"* → o carnê é endereçado por `CTR-…`; e o envelope de erro `{ codigo, mensagem, campo?, detalhes? }` com `codigo` de enum fechado → §10.1. ⚠️ A `Decision` remete o contador à ADR-0015: **leia `ADR-0033`** (emenda de 2026-08-16) |
| **0033** | **APLICÁVEL** | *"o identificador perante o provedor declara **o SaaS**, e pedi-lo em nome de uma empresa é irrepresentável"* → **é a premissa de que o roteamento inteiro depende**: se o contador fosse por empresa, duas empresas colidiriam na chave e a CA-06 cairia. ⚠️ Não "corrija" o contador para ser por empresa |
| **0008** | **APLICÁVEL** | *"a camada de aplicação não implementa filtro por empresa equivalente: não há dois caminhos para o dado"* → nenhum `WHERE empresa_id` novo; o `404` do carnê de outra empresa é **indistinguível** do inexistente |
| **0009** | **APLICÁVEL** | *"identidade, sem noção de tenant"* → a leitura de `suspensa_em` vive lá, e é por isso que ela não precisa de contexto |
| **0026** | **APLICÁVEL** | *"toda leitura de tempo que decide comportamento de negócio vem do banco"* → `recebido_em` por `now()` do banco, expurgo por `now() - interval`; nenhuma leitura do relógio do processo |
| **0025** | **APLICÁVEL** | *"o pacote de domínio declara o tipo do dado que atravessa e a interface da porta; o adaptador importa dele"* → `PortaDeMesclagem` em `@sysloc/documentos`, satisfeita por `mesclador-pdf.ts`; *"as portas chegam ao domínio por parâmetro, nunca por import"* → token de injeção na composição raiz |
| **0032** | **APLICÁVEL** | *"não retorna por superfície alguma... e a ausência de vazamento é afirmada por medição da saída real, nunca por leitura do código"* → §11.6. O envelope **não** é alargado por esta fatia |
| **0023** | **APLICÁVEL** | *"vive no banco quando ela participa de seleção — filtro, ordenação ou paginação"* → o recorte do carnê filtra por competência e ordena por vencimento **no banco** |
| **0016** | **PARCIAL** | Alcança `esquemaDoRecorteDoCarne` e os enums da trilha, que derivam. **Não alcança** o corpo da notícia (§21.2) nem o corpo de sucesso da rota de bytes (ADR-0028 é quem governa) |
| **0022** | **PARCIAL** | Alcança o que `liquidarPeloProvedor` grava — inalterado. O `desfecho` da notícia **não é fato financeiro**: é registro operacional do ato, amarrado a `tratado_em` por `check` |
| **0021** | **PARCIAL** | Nenhuma **transição de estado por rota** nasce aqui: o carnê é leitura, e a liquidação continua governada como a fatia (ii) fixou. É por isso que o carnê não exige chave de ação |
| **0013** | **PARCIAL** | *"a garantia é uma propriedade da sessão"* do Master: `EmpresaService.reativar` lê **apenas identificadores** das notícias retidas (`id`, para ordenar e enfileirar) e **nunca** o corpo recebido nem qualquer dado de `negocio`. O tratamento corre no processo de trabalho, sob contexto descoberto — não sob a sessão do Master |
| **0006** | **PARCIAL** | A suíte continua em instâncias efêmeras. O verificador de borda **lê** a configuração que atende a operação para afirmar que ela não foi tocada, e **não escreve** nada nela |
| **0005** | **APLICÁVEL** | *"toda rotina operacional... vive no repositório e é posicionada no sistema por um procedimento de instalação idempotente"* → o vhost, o instalador e o verificador; *"nenhum entra no repositório carregando credencial"* → o vhost não guarda segredo algum |
| **0001** (+ emendas 2026-08-15 e 2026-08-17) | **APLICÁVEL** | *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"* → a tradução do dialeto vive na tarefa e no adaptador; **a porta não ganha operação nenhuma** — o carnê reusa `consultarSituacao` com o sinalizador de documento que já existe, criado justamente para evitar uma quinta operação. ⚠️ A porta tem **quatro** operações; não "corrija" para cinco |
| **0027** | **NÃO ALCANÇA — e a distinção é conteúdo** | As três cláusulas dela (titular do dado · portador de segredo de uso único · tenant vindo do registro que o portador resolve) **não se aplicam**: o provedor não é titular de nada, não há portador, e a notícia é repetível. É exatamente por isso que a **0035** existe, e a 0027 permanece intacta governando a confirmação de e-mail |
| 0010, 0014, 0020 | **N/A** | Efetivo de permissão, exclusão lógica de cadastro e emissão de série — nenhuma delas é tocada |
| 0002, 0003, 0004 | **N/A** | `deprecated` — nomeiam primitivas do Frappe |
| 0007, 0012, 0015, 0019 | **N/A** | `superseded` — não se citam |

**Conflitos ADR × ADR: nenhum** — o único par que poderia se tensionar (0029 × 0030 no carnê) se
resolve pela própria cláusula de alcance da 0029, citada acima.

#### ⚠️ Conflito spec × ADR-0024 — UM, e ele é pré-condição da T1

> Levantado pelo challenge de 2026-08-18, ao abrir a `Decision` em vez de citar a emenda. A versão
> anterior desta seção afirmava *"Conflitos spec × ADR: nenhum"* — a afirmação era falsa, e nasceu de
> confrontar **só** a emenda de 2026-08-13, que é onde o mecanismo desta fatia está descrito.

**O texto literal, nas duas pontas.** A `Decision` da ADR-0024 abre com *"toda execução que ocorre
fora de uma requisição estabelece o contexto de tenant a partir da **carga do próprio trabalho**, uma
única vez, na borda que a recebe"*, e o `Consequences → Neutros` fecha com *"não altera a forma da
carga de nenhuma fila: apenas declara que **o identificador de empresa é campo obrigatório dela**, e
de onde ele veio"*.

**O que esta spec faz.** `CargaDaNotificacaoBancaria` é `{ notificacaoId }` e **nada mais** (§4.3), e
o contexto vem do **registro resolvido** pela travessia nominal, não da carga.

**Por que a divergência é a decisão certa, e não um descuido.** Pôr `empresaId` nessa carga é
irrepresentável sem violar a própria ADR-0024: a borda HTTP **não sabe** de que empresa a notícia é —
descobrir é o trabalho da tarefa —, de modo que o único valor disponível ali viria do **recebido**, e
aceitar a empresa declarada pelo terceiro é literalmente a terceira *Alternativa rejeitada* da
ADR-0035 e o que a cláusula de procedência da 0024 existe para impedir. A emenda de 2026-08-13 já
antecipa o caso — *"o retorno de integração externa que o `Context` acima nomeia é o webhook bancário
da F4, e quem decidir de onde vem o contexto dele precisa do critério, não de um número"* — e fecha o
item 2 dizendo, com todas as letras, *"para que o contexto continue vindo do **registro resolvido**"*.
O que a emenda **não** fez foi alcançar as duas cláusulas acima, escritas quando a única execução sem
requisição era o trabalho enfileirado por quem já detinha o direito ao identificador.

**Conduta — decidida no challenge, e é pré-condição da execução.** A ADR-0024 recebe uma **terceira
emenda**, com o texto original preservado byte a byte, no molde das emendas das ADRs 0001, 0017, 0021
e da própria 0024. Ela declara que a cláusula da carga alcança o trabalho **enfileirado por quem já
detinha o direito ao identificador**, e que a **entrada de fato de terceiro** (ADR-0035) estabelece o
contexto pelo registro resolvido — caso em que a carga **não** carrega empresa, porque carregá-la
reconstituiria o recebido como origem do tenant.

- **Por que emendar, e não registrar exceção**: é a mesma classe que a emenda de 2026-08-13 nomeia
  como o custo que ela veio pagar — *"um gate futuro leria violação onde houve decisão"*. Sem a
  emenda, o Gate 2 desta fatia abre a `Decision`, lê `{ notificacaoId }` e reprova por
  `adr_compliance`, que é achado de severidade **mínima `ALTO`** e bloqueia sem convergência.
- **Por que não conformar a spec**: ver o parágrafo acima — a conformação é impossível sem violar a
  cláusula de procedência da mesma ADR.
- **Quando**: **antes da T1**. Rode `/agent-spec-adr-supersede 0024` (ou a edição de emenda no molde
  do repositório) e acrescente esta fatia ao `Applied in` da 0024 e da 0035, cujo campo hoje diz
  *"Nenhuma feature adotou ainda"*.

### 21.6 Candidatos a ADR — os 5 critérios canônicos

Aplicados os critérios de `.claude/rules/agent-spec-adr-workflow-rules.md` (C1 transversal ·
C2 tag-alvo · C3 custo de reversão alto · C4 surpreendente sem contexto · C5 trade-off real):

**Nenhum candidato confirmado (5/5).** As decisões transversais desta fase já estão canonizadas —
**0031** (tabela sem dono-empresa), **0034** (trilha registra efeito) e **0035** (critério da entrada
de terceiro) —, e a **0024** já carrega, por emenda, o mecanismo da travessia nominal. Os pontos
desta spec são **instanciações** delas, de alcance restrito à fatia. Registrar ADR para qualquer um
seria churn — e a própria ADR-0035 declara que *"o código de resposta concreto, a forma da tabela do
cru e o nome da chave são da tech spec da fatia"*.

✅ **Reavaliado no challenge de 2026-08-18, e o veredito não muda.** As três decisões que a sessão
fechou — o discriminador de reentrância por desfecho (§9.2), o terceiro ramo da conferência
(§21.3 (7)) e a emenda do docblock de `reativar` (§21.3 (6)) — falham todas em **C1**: têm **um**
consumidor cada e alcance restrito a esta fatia. A única ação de ADR que a sessão produziu é uma
**emenda à ADR-0024 existente** (§21.5), que não é candidatura a ADR nova.

**Candidatos parciais**, registrados para que não se percam:

| Candidato | Critérios que passam | Critérios que falham | Conduta |
|---|---|---|---|
| *"Recorte de leitura em lote declara largura máxima na borda"* (o limite de 12 competências) | C2 (`http`), C3, C5 | **C1** — hoje há **um** consumidor; **C4** — é limite de entrada, forma comum | Decisão da fatia (§21.1 (8)). Vira candidato real quando um segundo recorte em lote nascer |
| *"Retenção de dado pessoal de terceiro é expurgada por trabalho oportunista, não por agendador"* | C2 (`data`), C4, C5 | **C1** — um consumidor; **C3** — reverter é pendurar um timer, custo baixo | Decisão da fatia (D3 do tech-alignment). Reavaliar na **F5**, quando o agendamento chegar e houver um segundo dado com prazo |

### 21.7 Termos canonizados

✅ **Canonizados no challenge de 2026-08-18**, todos os quatro no glossário **GLOBAL**
(`docs/specs/domain-glossary.md`), com definição, aliases a evitar e entrada em *Relacionamentos*. O
nível é global e não de feature porque são **entidades do domínio**, não regras operacionais desta
fatia: os dois irmãos do terceiro (*Identificador perante o provedor* e *Número do título no
provedor*) já vivem lá, e a ADR-0035 declara que *"a próxima entrada de terceiro herda o critério"* —
separá-los faria o vocabulário divergir na primeira integração seguinte.

Duas ambiguidades foram resolvidas junto: *"notificação"* nomeava tanto o que **chega** do provedor
quanto o **Aviso** que **sai** para o locatário; e *"baixa"* tinha um terceiro uso, no identificador
devolvido. E a entrada que declarava a coluna `nosso_numero` *"com o nome antigo por débito
declarado"* foi atualizada — esta fatia a renomeia e fecha o D14.

A tabela abaixo é o que a spec usa, e agora bate com o glossário:

| Termo usado aqui | O que é | A evitar |
|---|---|---|
| **Notícia do provedor** | O aviso que o provedor envia por iniciativa dele quando um boleto é pago | webhook, callback, notificação, aviso de baixa |
| **Recebido cru** | O corpo da notícia, gravado exatamente como chegou, antes de qualquer interpretação | payload, body, evento bruto |
| **Identificador da liquidação** | O identificador que **o provedor** atribui à baixa, e pelo qual o efeito é único | número identificador da baixa, id da baixa |
| **Carnê** | O documento único que reúne os boletos das cobranças de um contrato num intervalo de competências | carnê de boletos, bloco de boletos, livro de pagamento |

Os três primeiros termos já canonizados que esta fatia consome — **Identificador perante o provedor**,
**Número do título no provedor** e **Liquidação** — são usados com o sentido exato do glossário, e a
distinção entre os dois primeiros (*"o identificador que vem no sentido contrário"*) é **precisamente**
o que separa roteamento de conferência nesta fatia.

---

## 22. Checklist Final

- [x] Variante registrada (**backend**) na seção 1
- [x] Stack identificada — e a **medida**, não a planejada (`pdf-lib` entra; `ts-rest`, `undici`, `tsup` e OpenTelemetry continuam ausentes)
- [x] TECH_SPEC cobre todo o PRD — as 18 US mapeadas na §17 e na §5.3, sem órfã
- [x] Resumo técnico claro e objetivo (§2)
- [x] Arquitetura definida com componentes, camadas e fronteiras (§3)
- [x] Contratos de API com payloads, status codes e schemas (§4), mais a **dupla medição** da superfície
- [x] Fluxos de negócio descritos, principal e alternativos (§5)
- [x] Regras de processamento, validações e as 18 RN rastreadas (§6)
- [x] Persistência: tabela, enum, índices, migrações, transação e retenção (§7)
- [x] Integrações externas mapeadas, nas duas direções (§8)
- [x] Sincronização: fila, garantia e as **três camadas** de idempotência (§9)
- [x] Gerenciamento de erros, resiliência e logging (§10)
- [x] Segurança: autenticação, autorização, cifra, sanitização, anti-abuso e segredos (§11)
- [x] Performance: metas, estratégias e o **pior caso declarado** (§12)
- [x] Logs e observabilidade — com a ausência de coletor **declarada e justificada** (§13)
- [x] Feature flags — **nenhuma**, com a razão (§14)
- [x] Versionamento de API definido (§15)
- [x] Deploy e infraestrutura: vhost, instalação idempotente, verificação por medição, rollout e rollback (§16)
- [x] Dependências externas listadas, com a hipótese do `pdf-lib` **agendada para medição antes do uso** (§18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada, com rastreabilidade CA→CT (§19)
- [x] Riscos técnicos identificados, incluindo os **dois datados** (§20)
- [x] Observações técnicas: decisões A1, achados de medição, débitos e **inventário literal de ADRs** (§21)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (§3.4–3.7)
- [x] Cada CT aparece em **no máximo uma** task na rastreabilidade
- [x] Instruções internas do template **removidas** do arquivo final
- [ ] Pronto para geração do TASK PLAN — **após aprovação do usuário**
