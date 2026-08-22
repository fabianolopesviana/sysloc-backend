# Tech Spec — `integracao-bancaria-autonoma` (v1)

## 1. Identificação

- **Feature/Projeto**: `integracao-bancaria-autonoma` — F5, fatia (i): autonomia do Admin na integração bancária
- **Variante**: **backend**
- **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js · PostgreSQL 18 · Zod 4 · BullMQ + ioredis · Vitest + embedded-postgres. Estilo arquitetural: **portas e adaptadores** sobre camadas (domínio declara a porta, adaptador a satisfaz — ADR-0025)
- **Autor**: sysloc · tech spec conduzida por `/agent-spec-sdd-generate-tech-spec`
- **Data**: 2026-08-21
- **Versão**: v1
- **Status**: Aprovado (pelo usuário em 2026-08-21)
- **PRD Relacionado**: `docs/prds/features/integracao-bancaria-autonoma/v1/prd.md` (12 US · 21 CA · 15 RN)
- **Tech Alignment**: `docs/specs/features/integracao-bancaria-autonoma/v1/tech-alignment.md` (D1–D7 · M1–M12)

---

## 2. Resumo Técnico da Solução

Duas frentes com causa comum e substratos disjuntos, herdando as sete decisões do tech-alignment.

**Frente B — aceitar o material como a AC o entrega.** Um módulo novo no domínio da cobrança
bancária, irmão de `leitura-do-material.ts` (**D1**), converte material que o runtime não abre,
invocando processo externo de vida curta (**ADR-0036**). Um **único** artefato em claro toca
armazenamento — o intermediário, em memória compartilhada (**D2**, medido em M5–M7). A causa da
recusa se discrimina por **sinal de conteúdo** na saída do conversor, descartada em seguida (**D3**),
e as três causas passam a ser distinguíveis **pelo código** do envelope (**D4**). Fecha o `D64`.

**Frente A — habilitar a entrega da notícia do provedor.** Uma **porta irmã de
configuração** com duas operações — cadastrar e consultar —, conforme às três condições cumulativas
da emenda de 2026-08-15 da ADR-0001. O ciclo de ativação corre **em linha** (ADR-0029, cláusula do
retorno esperado); o estado vive em tabela nova com dono-empresa e RLS forçada (**D7**); o motivo
íntegro do provedor atravessa como **diagnóstico**, em campo de nome do produto, e **não decide nada**
(**D5**); e a credencial de acesso passa a ser indexada por **empresa e família de escopo** (**D6**).
A reconferência disparada pelo registro do certificado é **enfileirada** (ADR-0029).

**Superfície**: +2 rotas, +2 manipuladores, `publicas` inalterado — as três âncoras executáveis vão
de **103 / 88 / 20** para **105 / 90 / 20**. É a **última fatia que acrescenta rota** antes do
congelamento.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

Cinco pacotes tocados, nenhuma tecnologia nova no manifesto. O único recurso novo é **externo ao
processo**: o binário de criptografia do host, invocado sem interpretador de comandos.

```
   Admin ──HTTP──▶ apps/api (borda)
                    │  ├── controlador: declara exigências (ADR-0011/0018), abre a unidade de trabalho
                    │  └── serviço: orquestra; nunca escreve consulta, nunca compara empresa
                    │
                    ├──▶ @sysloc/contracts ......... esquema é a fonte única (ADR-0016)
                    │
                    ├──▶ @sysloc/cobranca-bancaria . domínio + portas + adaptador
                    │      ├── conversão do material ──▶ ⟦processo externo, vida curta⟧
                    │      ├── porta de entrega da notícia (nova, 2 operações)
                    │      └── adaptador do provedor ──▶ ⟦API do provedor, mTLS⟧
                    │
                    └──▶ @sysloc/db ................ RLS forçada; recorte é do banco (ADR-0008)
                             │
   apps/worker ──────────────┘  tarefa nova: reconferência do estado (enfileirada, ADR-0029)
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| Conversão do material | Converter material que o runtime não abre, preservando a identidade; classificar a causa da falha | Domínio (`@sysloc/cobranca-bancaria`) |
| Porta de entrega da notícia | Declarar as duas operações de configuração da entrega — cadastrar e consultar | Domínio (porta, ADR-0025) |
| Adaptador do provedor (estendido) | Satisfazer a porta nova; escopo **por família de operação**; traduzir o dialeto na fronteira | Adaptador |
| Cache de credenciais (estendido) | Reter credencial viva por **empresa e família de escopo** | Adaptador |
| Estado da entrega | Ler e gravar o estado por empresa, com o desfecho da última tentativa | Dados (`@sysloc/db`) |
| Serviço da entrega | Orquestrar o ciclo cadastrar→confirmar; compor a projeção publicada | Aplicação (`apps/api`) |
| Controlador da entrega | Declarar exigências, abrir a unidade de trabalho, expor as duas rotas | Borda (`apps/api`) |
| Serviço do certificado (estendido) | Converter quando necessário; distinguir as três causas; enfileirar a reconferência | Aplicação (`apps/api`) |
| Tarefa de reconferência | Reconsultar o estado fora da requisição, sob contexto de tenant da carga | Processo de trabalho (`apps/worker`) |
| Verificador do provisionamento (estendido) | Afirmar a pré-condição de ambiente que a conversão exige | Infraestrutura (shell) |

### 3.3 Camadas e Fronteiras

- **A porta chega ao domínio por parâmetro, nunca por import** (ADR-0025). O adaptador importa o
  domínio para declarar que o satisfaz; a composição raiz escolhe a implementação.
- **Nenhum fonte do domínio alcança a camada de dados** — invariante já varrido pelo caso irmão do
  `CT-809 (d)`, que a porta nova herda.
- **A fronteira de tradução do dialeto do provedor é o adaptador**, e só ele. Os termos da família de
  entrega já estão na lista varrida desde 2026-08-21, **antes** de existir a porta — antecipação
  deliberada, para que não nasçam contornados.
- **O segredo entra opaco e é aberto só dentro da chamada** (ADR-0032). Vale igualmente para o
  processo externo: a senha viaja por **descritor de arquivo**, nunca em `argv`, nunca em ambiente.
- **A conversão é do domínio, não da borda** (D1): `apps/api` não ganha capacidade de executar
  processo externo.

### 3.4 Visão em Árvore

```
packages/
├── contracts/src/
│   └── integracao-bancaria.ts ............................ MODIFICAR  (esquemas da entrega + códigos)
├── cobranca-bancaria/
│   ├── src/
│   │   ├── conversao-do-material.ts ..................... CRIAR      (D1, D2, D3)
│   │   ├── porta-de-entrega-da-noticia.ts ............... CRIAR      (porta irmã, 2 operações)
│   │   ├── modelo-canonico.ts ........................... MODIFICAR  (tipos que atravessam a porta)
│   │   ├── adaptador-sicoob.ts .......................... MODIFICAR  (D6 + satisfaz a porta nova)
│   │   ├── credencial-de-acesso.ts ...................... MODIFICAR  (D6: chave do cache)
│   │   └── index.ts ..................................... MODIFICAR  (barril, símbolo a símbolo)
│   └── test/ ............................................ CRIAR/MODIFICAR
├── db/
│   ├── migracoes/
│   │   ├── 0023_dominio_entrega_da_noticia.sql .......... CRIAR
│   │   └── 0024_seguranca_entrega_da_noticia.sql ........ CRIAR
│   └── src/
│       ├── entrega-da-noticia.ts ........................ CRIAR      (D7)
│       ├── esquema/negocio.ts ........................... MODIFICAR
│       └── index.ts ..................................... MODIFICAR
├── shared/src/erros.ts ................................... MODIFICAR  (D4: três códigos)
apps/
├── api/src/integracoes-bancarias/
│   ├── entrega-da-noticia.controller.ts ................. CRIAR
│   ├── entrega-da-noticia.service.ts .................... CRIAR
│   ├── certificado.service.ts ........................... MODIFICAR  (D3, D4 — remove o marcador D64)
│   └── integracoes-bancarias.module.ts .................. MODIFICAR
└── worker/src/tarefas/
    └── reconferencia-da-entrega.ts ...................... CRIAR      (ADR-0029)
deploy/scripts/instalacao/
└── verificar-provisionamento.sh .......................... MODIFICAR  (CA-21)
```

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/cobranca-bancaria/src/conversao-do-material.ts` | Conversão por processo externo; guarda de execução; classificação da causa | Domínio |
| `packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts` | A porta irmã — `cadastrarEntrega` e `consultarEntrega` | Domínio (porta) |
| `packages/db/migracoes/0023_dominio_entrega_da_noticia.sql` | Tabela do estado, no schema de negócio | Dados |
| `packages/db/migracoes/0024_seguranca_entrega_da_noticia.sql` | RLS forçada, política nominal, `GRANT` mínimo | Dados |
| `packages/db/src/entrega-da-noticia.ts` | Leitura e escrita do estado; nenhuma comparação de empresa | Dados |
| `apps/api/src/integracoes-bancarias/entrega-da-noticia.controller.ts` | As duas rotas, com a conjunção de exigências | Borda |
| `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` | Ciclo cadastrar→confirmar; projeção publicada | Aplicação |
| `apps/worker/src/tarefas/reconferencia-da-entrega.ts` | Reconferência enfileirada, melhor-esforço | Trabalho |
| Suítes correspondentes em `test/` de cada pacote | Ver §19 | Teste |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/contracts/src/integracao-bancaria.ts` | Esquemas do estado da entrega e do motivo; **esquema próprio do desfecho do registro** (§4.4); tetos anti-abuso do portador opaco | D5; ADR-0016 |
| `packages/shared/src/erros.ts` | Três códigos novos no enum fechado | D4; ADR-0017 |
| `packages/cobranca-bancaria/src/credencial-de-acesso.ts` | Chave do cache passa a `(empresa, família de escopo)` | **D6** |
| `packages/cobranca-bancaria/src/adaptador-sicoob.ts` | Escopo por família; implementação da porta nova | Entrega 2 do plano |
| `packages/cobranca-bancaria/src/modelo-canonico.ts` | Tipos canônicos que atravessam a porta nova | ADR-0001 (c) |
| `packages/cobranca-bancaria/src/index.ts` | Publicação **símbolo a símbolo** dos novos | `CT-809 (c)` |
| `packages/db/src/esquema/negocio.ts` | Declaração da tabela nova | ADR-0008/0031 |
| `apps/api/src/integracoes-bancarias/certificado.service.ts` | Conversão na borda de registro; três causas; enfileira a reconferência; **remove o marcador `DÉBITO COM GATILHO — D64`** | D3, D4, RN-12 |
| `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts` | Compõe a porta nova e o controlador novo | Composição raiz |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | **103→105**, **88→90**, `publicas` **20→20** | `.claude/rules/ancoras-de-superficie.md` |
| `apps/api/test/certificado-do-provedor.e2e.spec.ts` | Caso da mensagem única **reescrito, nunca apagado** | D4; P4/P5 do Protocolo Antirregressão |
| `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` | Varredura estendida à porta nova, no molde do `CT-809 (b)`/`CT-991` | ADR-0001 (c) |
| `deploy/scripts/instalacao/verificar-provisionamento.sh` | Afirma a pré-condição de ambiente | **CA-21** |
| `CLAUDE.md` | Índice de débito: remove a linha do `D64`; atualiza superfície (105/90/20), suíte e a contagem de ADRs (**36 registradas / 29 `accepted`** — o texto diz 35/28, medido antes da ADR-0036) | §3-B da rule; §21.1 |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `packages/cobranca-bancaria/src/leitura-do-material.ts` | O contrato *"o claro só existe dentro da chamada"*; o molde de classificação por sinal e descarte |
| `packages/cobranca-bancaria/src/porta-de-identidade.ts` | **O precedente** de porta irmã — e o registro de por que a ausência de operações é decisão |
| `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` | O roteiro provado da conversão, com as duas `DECISÃO FECHADA` |
| `deploy/scripts/cobranca-bancaria/verificar-preparacao-do-material.sh` | O molde de verificador shell com prova de falsificação (CT-1011–CT-1013) |
| `packages/db/src/identidade-no-provedor.ts` | O número do cliente que a ativação endereça — **reuso, não campo novo** |
| `packages/db/migracoes/0021_*.sql` e `0022_*.sql` | O par domínio/segurança é o padrão da casa |
| `apps/api/test/segredo-nao-escapa.e2e.spec.ts` | O molde de medição da saída real (ADR-0032) |
| `apps/api/src/integracoes-bancarias/certificado.controller.ts` | O marcador `DECISÃO FECHADA — T12` que proíbe apoiar a autorização na ADR-0021 |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

| Método | Caminho | Ato | Exigências | Sucesso |
|---|---|---|---|---|
| `POST` | `/v1/integracoes-bancarias/entrega-da-noticia/ativacao` | Cadastra no provedor e confirma por consulta | `AREA_DAS_INTEGRACOES_BANCARIAS` **+** `ACAO_DE_CONFIGURACAO` | `200` com o estado resultante |
| `GET` | `/v1/integracoes-bancarias/entrega-da-noticia` | Lê o estado persistido da empresa | idem | `200` com o estado |

**`200` na ativação, e não `201`** — o ato é **idempotente** (RN-05) e não cria recurso endereçável:
repetir não produz um segundo objeto. Mesmo precedente e mesma razão do `@HttpCode(200)` já aplicado
à verificação de identidade.

**A rota de estado não fala com o provedor** — lê a linha persistida. A consulta ao vivo foi podada no
discovery (C2): a recusa precisa **sobreviver à requisição**.

### 4.2 Forma do corpo

**Entrada da ativação: corpo vazio.** A empresa vem do contexto de sessão, e o que se cadastra é
determinado pela identidade já registrada — não há nada que o cliente escolha. Entrada que aceitasse
campo abriria caminho para o cliente influenciar o destino da chamada ao provedor.

**Saída — o estado da entrega** (`z.object`, **aberta**, conforme `.claude/rules/contrato-publicado.md`):

| Campo | Tipo | Observação |
|---|---|---|
| `habilitada` | booleano | Verdadeiro **só** com os dois positivos (RN-01) |
| `verificadaEm` | instante ISO-8601, anulável | `null` quando nunca houve tentativa (CA-19) |
| `motivo` | objeto, anulável | Presente **só** quando `habilitada` é falso **e** houve tentativa |

**O motivo** — três campos de **nome do produto**, carregando valores do provedor verbatim:

| Campo | Tipo | Observação |
|---|---|---|
| `codigo` | texto | O que o provedor devolveu, íntegro |
| `mensagem` | texto | Idem |
| `diagnostico` | registro **sem esquema** | Os campos que variam por código de recusa |

⚠️ **Por que a saída desta feature é `z.object` e a do certificado é `z.strictObject`.** Aquele
esquema é estrito por uma razão escrita e específica — *"o campo a mais que pode aparecer naquela
projeção é o segredo do provedor entrando na resposta"*, e ali a queda da rota é preferível ao
vazamento. **Aqui a classe é outra**: a projeção não deriva de linha que contenha segredo, e o
`diagnostico` é **aberto por natureza** (D5) — a premissa do PRD é que os campos variam por código.
O objeto que o contém permanece fechado, de modo que só o portador é aberto, e a abertura é local.

**Tetos anti-abuso do `diagnostico`** — número máximo de chaves e tamanho total, no espírito de
`MAIOR_MATERIAL_CODIFICADO`. O que se guarda vem de terceiro e não se pode bounded por confiança.

### 4.4 O desfecho do registro do certificado — esquema PRÓPRIO, e não um campo a mais

O registro passa a devolver **o certificado publicado mais o desfecho do ato**: a projeção que
`esquemaDoCertificado` já define, acompanhada da declaração de que o material **precisou ser
convertido**.

⚠️ **O campo NÃO entra em `esquemaDoCertificado`, e a razão é de categoria.** Aquela projeção
descreve **o certificado** — titular, validade, impressão digital, autoria. *"Foi convertido"* não é
propriedade do certificado: é propriedade do **ato de registrá-lo**. Pô-la ali teria dois custos, e
os dois são concretos:

1. A **consulta** (`GET`) devolve a mesma projeção, e passaria a publicar um campo que, ali, ou é
   mentira ou exige coluna nova numa tabela existente — migração que esta fatia não carrega, para um
   fato que o PRD **não pede** na consulta (CA-13 e CA-14 falam **só** da resposta do registro).
2. `esquemaDoCertificado` é `z.strictObject` **de propósito**, como salvaguarda contra campo
   inesperado na projeção do certificado. Alargá-lo por conveniência gasta exatamente a salvaguarda.

**Alternativa considerada e rejeitada — persistir a conversão no certificado.** Seria defensável
(*"o material guardado de fato foi convertido"*, e a razão da US-08 é durável), mas custa coluna nova
em tabela existente e mais uma migração, para responder a uma pergunta que o PRD só faz no instante
do registro. Fica registrada: se a consulta vier a precisar do fato, é este o caminho, e ele **não**
é reabrir esta decisão.

### 4.3 Erro

Envelope da ADR-0017 — `{ codigo, mensagem, campo?, detalhes? }`, `codigo` de enum fechado. **Três
códigos novos** para as três causas de recusa do registro do certificado (**D4**), acrescentados ao
enum pelo mesmo caminho que a F1 já usou para os três de identidade.

| Causa | Discriminada por | Campo do envelope |
|---|---|---|
| Formato/embalagem que não se abre nem se converte | conversão falhou **sem** casar o radical de senha | `campo: 'corpo'` |
| Senha que não abre o material | radical `mac verify` na saída do conversor, **ou** o sinal da biblioteca na leitura direta (D3) | `campo: 'corpo'` |
| Validade já encerrada | tipo da exceção da camada de dados | `campo: 'corpo'`, `detalhes: { validoAte }` |

⚠️ **O `campo` permanece `'corpo'` nas três.** Nomear `material` ou `senha` diria **qual metade** do
corpo falhou por uma via que o `codigo` já cobre — e o `campo` é o que o cliente usa para destacar
entrada, não para diagnosticar. A distinção que a fatia acrescenta é a do **código**, e só dela.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal — ativação da entrega

1. **Controlador** declara a conjunção de exigências e abre a unidade de trabalho sob o contexto da
   sessão.
2. **Dentro da transação, e curto** — lê **as duas** pré-condições do ato externo, que são distintas:
   o **envelope cifrado do certificado vigente** (é ele que faz o aperto de mão mútuo) e a
   **identidade pronta para uso** (é dela que saem o identificador da aplicação e o número do
   cliente que a entrega endereça). Ausência de qualquer uma → recusa **ali**, antes de qualquer
   chamada externa; não há caminho de reserva.
   ⚠️ **São TRÊS recusas distintas, e a forma delas já está fixada pelo precedente** de
   `exigirCertificadoVigente`/`exigirIdentidadeVigente` em `apps/api/src/cobrancas/boleto.service.ts`
   — o outro ato do produto que usa o provedor: certificado ausente, **certificado com validade
   encerrada** e identidade ausente, cada uma com o próprio discriminador em `detalhes`.
3. **Fora de transação** — o ato externo, com a credencial da família de entrega (**D6**):
   1. **cadastrar** junto ao provedor;
   2. **consultar** para confirmar.
4. **Habilitada** só com os dois positivos (RN-01). Se o cadastro recusar por vaga já ocupada, a
   consulta ainda corre — é ela que decide (RN-05).
5. **Numa segunda transação**: grava o estado da empresa, substituindo o desfecho anterior (RN-04).
6. Compõe a projeção **a partir das colunas**, nunca do que veio do provedor.

> A partição em duas transações com o ato externo no meio é o padrão já estabelecido pela verificação
> de identidade, e a razão é a mesma: manter chamada de rede a terceiro dentro de `sql.begin`
> reservaria conexão física da reserva que atende todo o produto durante a espera.

### 5.2 Fluxos Alternativos

- **Registro do certificado com material que o runtime não abre** → conversão (§6.1); em caso de
  sucesso a resposta informa que houve conversão; o material **convertido** é o que se cifra e guarda
  (ADR-0036).
- **Conversão falha** → uma das duas recusas de §4.3, discriminada por §6.2.
- **Registro bem-sucedido** → **enfileira** a reconferência (ADR-0029). Falha ao enfileirar **não**
  faz o registro falhar; o motivo é registrado (RN-12).
- **Empresa que nunca tentou** → `habilitada: false`, `verificadaEm: null`, `motivo: null` (CA-19).
- **Provedor indisponível na ativação** → estado permanece o anterior; a recusa é devolvida como
  desfecho, não como falha do produto.
- **Sem a permissão** → recusa nomeando a **primeira ausente na ordem declarada** (ADR-0018).
- **Sem certificado, com certificado vencido, ou sem identidade** → três recusas **distintas**, na
  forma do precedente da emissão de boleto. ⚠️ **Não é `404`**: o `404` daquela superfície pertence às
  rotas em que o certificado **é o recurso pedido**; aqui ele é **pré-condição de um ato**, e o
  precedente recusa com código de campo mais `detalhes` discriminante, **sem nomear `campo`** — a
  razão está escrita no ponto: *"as duas recusas desta função não têm culpado no pedido"*.

### 5.3 Mapeamento de User Stories → Fluxos

| User Story | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | `POST …/entrega-da-noticia/ativacao` (§5.1) | Controlador, serviço, porta, adaptador, estado |
| US-02 | `GET …/entrega-da-noticia` | Controlador, serviço, estado |
| US-03 | `GET …/entrega-da-noticia` (campo `motivo`) | Estado, contrato |
| US-04 | `POST …/ativacao` repetido (§5.2) | Ciclo inteiro, sem estado preso |
| US-05 | Conferência periódica já existente (declarada e testada) | Conferência, estado |
| US-06 | `POST …/certificados` com conversão (§6.1) | Conversão, serviço do certificado |
| US-07 | Recusa do registro (§4.3) | Conversão, serviço do certificado, envelope |
| US-08 | `POST …/certificados` — desfecho do registro (§4.4) | Serviço do certificado, contrato |
| US-09 | Ausência de etapa de servidor nos dois fluxos | Todos |
| US-10 | Contrato publicado das duas rotas | `@sysloc/contracts` |
| US-11 | Reconferência enfileirada após o registro (§5.2) | Serviço do certificado, tarefa, estado |
| US-12 | Gravação do desfecho na linha de estado (**D7**) | Estado, diário operacional |

---

## 6. Regras de Processamento

### 6.1 Conversão do material (RN-09)

1. Tenta abrir o material como está. **Abriu** → nada a converter (CA-14).
2. **Não abriu por cifra não suportada** → converte:
   1. decodifica o recebido lendo de **entrada padrão** (medido, M5);
   2. o intermediário em claro vai para **memória compartilhada**, com permissão restrita;
   3. reexporta lendo o intermediário **de arquivo** — exigência *seekable*, medida (M7) — e
      escrevendo em **saída padrão** (M6), com **a mesma senha**, para não criar um segundo segredo;
   4. remove o intermediário em **todo** desfecho, inclusive erro e sinal.
3. Abre o convertido e **confere a identidade**: titular, número de série e validade **idênticos** aos
   do recebido. Divergência é recusa, **não** aviso.
4. O que se cifra e guarda é o **convertido** (ADR-0036).

> ⚠️ **A idempotência se afirma sobre a pergunta certa.** O roteiro de servidor errou exatamente aqui
> em 2026-08-21: perguntava *"o runtime o abre?"* onde devia perguntar *"é o mesmo certificado?"*.
> Dentro do produto a armadilha some por construção — o material conferido é o que **acabou de
> chegar**, e a comparação não depende de nome de arquivo.

### 6.2 Classificação da causa (RN-10, **D3**)

| Sinal observado | Causa |
|---|---|
| Leitura direta falha com o sinal da **biblioteca** | senha |
| Conversão falha e a saída casa o radical `mac verify` | senha |
| Conversão falha sem casar o radical | formato |
| Material abre, mas a validade terminou | validade encerrada |

⚠️ **São dois produtores com redações diferentes** (medido, M10): o executável diz
`Mac verify error: invalid password?`, a biblioteca diz `mac verify failure`. O radical comum é
`mac verify`. **Importar a constante existente para o conversor faria o ramo da senha nunca
disparar**, e o desfecho degradaria em silêncio para "formato" — que é o `D64` invertido.

**Degradação declarada**: sinal que deixe de casar cai no desfecho **mais genérico** (formato). Perde
precisão de diagnóstico, nunca contenção — mesma regra já aceita em `leitura-do-material.ts`.

### 6.3 Estado da entrega (RN-01, RN-04, RN-05, RN-06, RN-14)

- **Habilitada** ⟺ cadastro positivo **e** consulta confirmando. Um só não basta.
- **A consulta prevalece** sobre o desfecho do cadastro: cadastro que recusa por já existir, com
  consulta positiva, é **habilitada**.
- **Uma linha por empresa**, substituída a cada tentativa. Não há histórico — a RN-04 decide isso.
- **Não existe desabilitar**: a operação não existe no provedor. O produto não a modela.
- **Nada altera cadastro de terceiro** — o produto cadastra o **seu** e lê; não remove, não substitui.

### 6.4 Reconferência (RN-12)

Enfileirada pela borda após o registro do certificado, executada pelo processo de trabalho, com o
identificador de empresa **na carga** — legítimo porque **quem enfileirou já detinha direito a ele**
(ADR-0024, emenda de 2026-08-18). Melhor-esforço: falha não propaga ao registro; o motivo é registrado.

### 6.5 Escopo por família (**D6**)

A família é **vocabulário do produto** e vive fora do adaptador; os escopos concretos que ela resolve
são dialeto do provedor e vivem **dentro** dele. A chave do cache passa a compor empresa e família:
sem isso, credencial de uma família seria apresentada em chamada da outra, e a recusa apareceria como
falha intermitente e dependente de ordem.

---

## 7. Persistência de Dados

**Uma tabela nova, no schema de negócio.** A contrapositiva da ADR-0031 decide: ela **é** dado de uma
empresa, logo não vai para o schema de plataforma, cujo roster enumerado permanece intocado.

Colunas, em vocabulário do produto: dono-empresa · se está habilitada · instante da última
verificação · código, mensagem e diagnóstico da recusa (anuláveis) · autoria da última tentativa.

**Invariantes impostas pelo banco** (ADR-0008, Invariante 1):

- `empresa_id` **NOT NULL**, RLS **habilitada e forçada**, com `USING` **e** `WITH CHECK`;
- **FK composta `(id, empresa_id)`** onde houver referência a entidade tenantizada;
- **unicidade por empresa** — uma linha por empresa, que é o que torna a substituição da RN-04
  representável sem corrida;
- **`CHECK` de coerência**: habilitada verdadeira ⟹ ausência de motivo; habilitada falsa **com**
  verificação ⟹ motivo presente. Torna irrepresentável o estado meio preenchido — mesma classe do
  `D13 · F4/T6` e do `D44 · F2/T10`, e desta vez **fechada no banco**, não adiada.

**O relógio é o do banco** (ADR-0026): o instante da verificação nasce do próprio banco; não há
`new Date()` no caminho.

**Par domínio/segurança**: `0023_dominio_*` e `0024_seguranca_*`, como as quatro migrações anteriores.
Migração aplicada é **imutável** — nada nela se reescreve depois.

---

## 8. Integração com APIs Externas

**Provedor bancário**, por mTLS com o cliente nativo — `undici` foi avaliado e recusado, e a razão
está no docblock do adaptador. **Duas famílias de operação**, com escopos distintos (medido: os
escopos de uma obtêm token mas o gateway recusa a outra com `401`).

**Processo externo de conversão** — superfície **nova** no produto. Guarda de execução, toda ela
herdada do roteiro provado e exigida pela ADR-0036: caminho absoluto · **sem interpretador de
comandos** · senha por **descritor de arquivo** · teto de tempo · saída **fora do diário** · artefato
intermediário em memória compartilhada, removido em todo desfecho.

---

## 9. Sincronização de Dados

**Não há sincronização periódica nesta fatia.** O estado é atualizado por dois gatilhos, ambos
pontuais: a ativação pelo Admin e a reconferência disparada pelo registro do certificado.

⚠️ **A reconferência automática e periódica está declaradamente adiada** para a fatia
`automacoes-agendadas/v1`, que traz o agendamento e já publica rota de saúde por tenant. O gancho
fica registrado aqui para que aquela fatia não o redescubra. Urgência baixa: a degradação é primeira
classe — sem a entrega da notícia, a conferência periódica continua liquidando e estornando.

---

## 10. Gerenciamento de Erros

| Situação | Desfecho | Onde nasce |
|---|---|---|
| Material não abre nem converte | recusa de **formato** | conversão |
| Senha não abre | recusa de **senha** | conversão ou leitura direta |
| Validade encerrada | recusa de **validade** | camada de dados |
| Identidade divergente após conversão | recusa de **formato** | conversão |
| Empresa **sem certificado** | recusa de campo com `detalhes` nomeando o certificado ausente — **sem `campo`** | serviço |
| Empresa com **certificado vencido** | recusa de campo com `detalhes` nomeando a validade | serviço |
| Empresa **sem identidade** no provedor | recusa de campo com `detalhes` nomeando a identidade ausente | serviço |
| Provedor recusa o cadastro | **não é erro** — vira estado com motivo | serviço |
| Provedor indisponível / tempo esgotado | **não é erro** — vira estado com motivo | serviço |
| Falha ao enfileirar a reconferência | registrada, **não propaga** | serviço do certificado |

⚠️ **A recusa do provedor não vira exceção**, e é a decisão central de §10. Convertê-la em falha faria
o Admin ler *"o sistema falhou"* onde o fato é *"a vaga está ocupada"* — dois desfechos operacionais
opostos. É o mesmo desenho, e a mesma razão, da porta de identidade, cuja operação **resolve em todos
os desfechos e nunca rejeita**.

**Nenhuma mensagem interpola valor vindo do corpo** — as mensagens nomeiam o **desfecho**, jamais
conteúdo. Medido na fatia anterior: segredo interpolado em texto sobrevive em `mensagem` e `pilha` do
evento, onde a redação do registrador **não o alcança**.

---

## 11. Segurança

- **ADR-0032 na íntegra.** Material, senha e identificador da aplicação entram cifrados e **não
  retornam por superfície alguma** — consulta, erro ou diagnóstico. A ausência de vazamento é afirmada
  por **medição da saída real**, e a superfície nova a medir inclui a **saída e o objeto de erro do
  processo externo**.
- **A senha nunca aparece em `argv` nem em ambiente** — descritor de arquivo, como o roteiro provado.
  `argv` é legível por qualquer processo da máquina.
- **Um único artefato em claro**, em memória compartilhada, com permissão restrita, removido em todo
  desfecho. ⚠️ A garantia é *"não escreve em armazenamento persistente"*, **não** impossibilidade
  física: memória compartilhada pode ser paginada para área de troca. A ADR-0036 já a declara assim.
- **Autorização**: conjunção de área e ação do catálogo **fechado** (ADR-0011/0018). **Nenhuma chave
  nova.**
- ⚠️ **A justificativa da autorização apoia-se em ADR-0011 + ADR-0018**, e a ADR-0021 entra **apenas
  como analogia de critério**, com a negação de governança na mesma oração. É o que o marcador
  `DECISÃO FECHADA — T12 / Gate 2 rodada 1 + Gate 1 rodada 2` fixa, e cujo `REVERTER EXIGE` é uma
  **emenda da ADR-0021** — escalada ao usuário, nunca decisão de executor ou de gate. O achado já
  voltou por caminho novo uma vez; as rotas novas são o próximo caminho.
- **O isolamento é do banco.** Não há comparação de empresa em aplicação — nem no serviço, nem no
  controlador, nem na tarefa.
- **Nenhum material de certificado na árvore versionada** (Invariante 3).

---

## 12. Performance

- **Ato raro e de alta consequência**: ativação uma vez por cliente, renovação uma vez por ano.
  Não há caminho quente nesta fatia, e otimizar por antecipação seria complexidade especulativa.
- **A conexão física é o recurso escasso**, não o tempo de resposta: chamada externa **fora** de
  `sql.begin`, sempre. É o achado da fatia `documentos-e-confirmacao`, agora sobre esperas uma ordem
  de grandeza maiores.
- **O processo externo tem teto de tempo** — sem ele, uma requisição do Admin poderia ficar pendurada
  por um processo que não termina.
- **A conversão é condicional**: só corre quando o runtime não abre o material. Material moderno não
  paga nada.

---

## 13. Logs e Observabilidade

Registro estruturado (Pino), com a redação já instalada. Acrescentam-se:

| Evento | Nível | Campos |
|---|---|---|
| Material convertido no registro | `info` | entidade, que houve conversão — **nunca** tamanho, nome ou bytes |
| Material recusado no registro | `warn` | entidade, motivo interno das três causas |
| Ativação — desfecho | `info` | entidade, se habilitou, e o motivo interno quando não |
| Reconferência — falha ao enfileirar | `warn` | entidade, motivo |
| Processo externo — término anômalo | `warn` | **desfecho**, jamais a saída bruta |

**Recusa é `warn`, não `error`** — entrada recusada é ato normal do Admin, e classificá-la como erro
encheria o diário de alarme para o que é conversa de cadastro.

⚠️ **A saída do processo externo não vai para o diário** (ADR-0036). Ela é lida para classificar
(§6.2) e **descartada** — não vira causa, não vira propriedade, não entra em texto nenhum.

**A trilha publicada** segue o critério da ADR-0034 — efeito e desfecho anômalo, nunca a tentativa que
nada mudou. Nesta fatia o vaso é a **própria linha de estado** (**D7**), e a RN-15 fica satisfeita por
construção: uma linha por empresa, sem registro novo quando nada muda.

---

## 14. Feature Flags

**N/A** — o produto não tem mecanismo de bandeira, e esta fatia não introduz um. A entrega da notícia
não é uma bandeira: é **estado observável por empresa**, publicado pela rota de consulta. Modelá-la
como bandeira criaria uma segunda fonte do mesmo fato, que a passagem do tempo faria divergir.

---

## 15. Versionamento de API

Prefixo `/v1` no caminho, como toda a superfície. **Nenhuma quebra**: as duas rotas são
**acréscimo**, e a alteração no registro do certificado é **ampliação compatível** — a resposta do
registro passa a ser um esquema **próprio** (§4.4) e a recusa ganha códigos novos onde antes havia um
só.

⚠️ **Não diga que a resposta do certificado é "saída aberta" — ela não é.** `esquemaDoCertificado` é
`z.strictObject` por razão escrita e específica: *"o campo a mais que pode aparecer nesta projeção…
é o segredo do provedor entrando na resposta"*, e ali a queda da rota é o desfecho preferível ao
vazamento. A estritude dela **não se afrouxa** por esta fatia.

⚠️ **Cliente que ramificava sobre a mensagem única de recusa passa a ver códigos distintos.** Não há
cliente publicado hoje — o frontend ainda não foi implementado —, de modo que a mudança é **compatível
na prática**, e é justamente por isso que ela cabe **agora**: depois do congelamento, não caberia.

---

## 16. Deploy e Infraestrutura

Nativo, sem contêiner. Unidades systemd por serviço, `Restart=always`. **Nenhuma unidade nova, nenhum
timer novo** — o agendamento pertence à fatia (ii).

**Duas migrações** aplicadas pelo caminho já existente, na ordem domínio → segurança.

⚠️ **Pré-condição de ambiente nova**: o binário de criptografia do host. Medido em 2026-08-21 —
presente, versão 3.x, com o provider legado disponível —, e **não afirmado** pelo provisionamento.
A verificação passa a afirmá-lo (**CA-21**), por acréscimo a um verificador **existente**: não cria
arquivo novo, logo **não toca o `D9 · F0/T2`**.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| US-01 | §5.1, §6.3 — ciclo cadastrar→confirmar; RN-01 imposta pelo serviço | Controlador, serviço, porta, adaptador, cache (D6), estado |
| US-02 | §4.2, §7 — projeção do estado a partir das colunas | Controlador, serviço, estado, contrato |
| US-03 | §4.2, **D5** — motivo em campo de nome do produto, valores verbatim | Contrato, modelo canônico, adaptador, estado |
| US-04 | §6.3 — substituição do desfecho; sem estado preso | Serviço, estado |
| US-05 | §9, §13 — degradação declarada e testada; estado publicado | Conferência (existente), estado |
| US-06 | §6.1 — conversão com identidade conferida (**D1**, **D2**) | Conversão, serviço do certificado |
| US-07 | §4.3, §6.2 — três códigos, discriminação por sinal (**D3**, **D4**) | Conversão, serviço do certificado, enum de erros |
| US-08 | §4.4 — esquema próprio do desfecho do registro | Serviço do certificado, contrato |
| US-09 | §16, **CA-21** — nenhuma etapa de servidor; pré-condição afirmada | Verificador shell, todos |
| US-10 | §4 inteira — contrato completo antes do congelamento | `@sysloc/contracts` |
| US-11 | §6.4 — reconferência enfileirada (ADR-0029, ADR-0024) | Serviço do certificado, tarefa, estado |
| US-12 | §13, **D7** — a linha de estado é o registro do efeito | Estado, diário |

---

## 18. Dependências Externas

| Dependência | Natureza | Já existe? | Observação |
|---|---|---|---|
| API do provedor bancário | serviço de terceiro | sim | Família de operação nova, escopos próprios |
| Binário de criptografia do host | **binário do sistema** | sim (presença de fato) | **Passa a ser afirmado** — CA-21 |
| Memória compartilhada do host | recurso do sistema | sim | Onde vive o único artefato em claro |
| Fila (BullMQ + Redis) | infraestrutura | sim | Uma tarefa nova; nenhuma fila nova |
| PostgreSQL 18 | infraestrutura | sim | Duas migrações |

**Nenhum pacote novo no manifesto.** A alternativa que traria um — biblioteca de PKCS#12 em
JavaScript — foi rejeitada pela ADR-0036 e permanece adiada.

---

## 19. Estratégia de Testes

Gerada por delegação ao `agent-spec-qa-test-generator` (frente `backend`), com os **7 gates**
aplicados — Invariant First, Owning Layer, Real Execution, Failure→Fix Production, No Snapshot Without
Contract, No Self-Set Mock, Negative Companion. **34 casos**, `CT-1014` a `CT-1047` — a numeração
começa em 1014 porque `CT-1013` é o maior em uso (`verificar-preparacao-do-material.sh`).

⚠️ **Correção de fecho (T10, 2026-08-22): eram 33 casos, e são 34.** O acréscimo é o **`CT-1047`**,
que prova as **três recusas de pré-condição do ato externo** — comportamento que a **§5.1**, a **§5.2**
e a **§10** já declaravam normativo, cuja forma o **challenge Q2 de 2026-08-21** corrigiu contra o
código real (esta spec dizia `404`), e que **nenhum caso do mapa cobria**. A divergência está
declarada por escrito na **§9.1 do `task_plan.md`** desde a geração do plano; o que a T10 faz é
escriturá-la aqui. ⚠️ **A cobertura CA→CT permanece 21/21** — o `CT-1047` ancora-se em **CA-01** e não
cria CA novo. **Isto não é reabrir a spec**: é correção de fato medido, pelo mesmo precedente da
§21.4.

| Tipo | Casos |
|---|---|
| Unitário | 2 |
| Integração | 11 |
| E2E | 16 |
| Segurança | 5 |
| **Total** | **34** |

**Quatro arquivos de suíte novos**; os outros 20 casos **estendem suítes canônicas existentes**.
Acessórios de arranjo — cliente HTTP, entrada de sessão, geração de material, banco efêmero,
comparação de conjuntos — são **importados da casa compartilhada, nunca redeclarados**.

### 19.1 Unitários

| CT | Invariante | Camada | CA |
|---|---|---|---|
| **CT-1032** | Nenhum termo do dialeto do provedor em **posição de símbolo publicado** nos módulos novos; a porta declara **exatamente duas** operações; a varredura, aplicada a um fonte de controle com os termos plantados, os encontra todos | domínio | CA-18 |
| **CT-1044** | Entrada **fechada** recusa chave desconhecida, saída **aberta** a aceita; enum de estados congelado e ordenado; o portador do motivo é **opaco** e não nomeia chave alguma do provedor | contrato | CA-18 |

⚠️ **As duas são asserções ESTÁTICAS e exigem prova de falsificação** (P4 do Protocolo
Antirregressão). Ela roda pelo **script `test` do pacote**, nunca por invocação avulsa do executor de
testes: sete dos nove pacotes resolvem `.` para a saída de build, e o mutante no fonte **não
alcançaria o que executa** — verde lido como *"a asserção não pega"* quando o mutante nunca correu.

### 19.2 Integração

| CT | Invariante | Camada | CA |
|---|---|---|---|
| **CT-1014** | A conversão preserva a identidade: a tripla é idêntica à do **mesmo** certificado em cifra moderna, com a impressão digital como discriminador | conversão | CA-09 |
| **CT-1015** | Senha e formato produzem `motivo` **distintos**; nada da saída do conversor atravessa a fronteira | conversão | CA-10, CA-11, CA-16 |
| **CT-1016** | O único artefato em claro é removido em **todo** desfecho — sucesso e os **dois** caminhos de erro | conversão | CA-16 |
| **CT-1017** | O artefato nasce com permissão restrita, **mesmo com a máscara do processo aberta** | conversão | CA-16 |
| **CT-1018** | A conversão só corre quando o runtime não abre; o desfecho declara qual caminho correu | conversão | CA-13, CA-14 |
| **CT-1027** | A relação nova tem RLS **forçada**, política única, restrição única e FK **composta**; o `SELECT` cruzado devolve zero e o `INSERT` cruzado sai `42501` | persistência | CA-02 |
| **CT-1038** | As três âncoras da superfície vão a **105 / 90 / 20**, por igualdade de conjunto e duas medições independentes | borda | CA-18 |
| **CT-1040** | A reconferência atualiza a linha; **quando falha, a linha permanece idêntica campo a campo** | trabalho | CA-15 |
| **CT-1042** | Com a entrega **desabilitada**, a conferência liquida e estorna igual — as duas execuções são idênticas | trabalho | CA-06 |
| **CT-1043** | Duas famílias de escopo obtêm **duas** credenciais; duas operações da **mesma** família obtêm **uma** | adaptador | CA-01 |
| **CT-1045** | A verificação de provisionamento **reprova nomeando o recurso ausente**; controle e mutante com desfechos opostos | shell | CA-21 |

### 19.3 E2E

| CT | Invariante | Camada | CA |
|---|---|---|---|
| **CT-1020** | A **rota** aceita material em cifra legada gerado em execução, e a identidade registrada é idêntica — **o caso que fecha o `D64`** | borda | CA-09, CA-20 |
| **CT-1021** | As **três** causas produzem três códigos distintos — `Set` de tamanho 3, mais os três envelopes por igualdade | borda | CA-10, CA-11, CA-12 |
| **CT-1022** | Senha errada sobre material **legado** nomeia a senha, não o formato — o eixo do **D3** na borda | borda | CA-10, CA-11 |
| **CT-1023** | A resposta declara a conversão como booleano fechado nos **dois** sentidos | borda | CA-13, CA-14 |
| **CT-1025** | Habilitada **só** com os dois positivos; e **com o par derrubado a consulta ainda responde** — prova que ela não fala com o provedor | borda | CA-01, CA-03 |
| **CT-1026** | Um positivo só não basta; na recusa do cadastro a confirmação **não chega a ser alcançada** (contador por igualdade) | borda | CA-01, CA-03, CA-04 |
| **CT-1029** | A consulta responde nos **três** estados, com o discriminador de *"nunca houve tentativa"* | borda | CA-03, CA-19 |
| **CT-1030** | O motivo é **igual por igualdade profunda** ao corpo que o provedor devolveu; conjunto de chaves coincide | borda | CA-04 |
| **CT-1031** | Quatro motivos **degenerados** produzem status, estado e forma de corpo idênticos — **o motivo não decide nada** | borda | CA-04 |
| **CT-1034** | O desfecho novo **substitui** o anterior; o motivo antigo some do corpo, por varredura com controle | borda | CA-05 |
| **CT-1035** | Cadastro recusado por **já existir** + consulta positiva ⟹ **habilitada** (RN-05) | borda | CA-05 |
| **CT-1036** | Vaga de **terceiro**: recusa informada, e **zero** chamadas mutantes ao par | borda | CA-07 |
| **CT-1039** | O registro **enfileira** e degrada; e o provedor recebe **zero** chamadas durante a requisição | borda | CA-15 |
| **CT-1041** | Cinco reconsultas deixam a linha **idêntica, inclusive o instante**; nenhuma linha nova em vaso algum | borda | CA-17 |
| **CT-1046** | O percurso do cliente novo se conclui **inteiramente pela tela** | percurso | CA-20, CA-09, CA-01 |
| **CT-1047** | As **três** recusas de pré-condição do ato externo — certificado ausente, validade encerrada e identidade ausente — são **distintas**, com `detalhes` discriminante, **sem `campo`**, **não `404`**, e com **zero** conexões ao provedor | borda | CA-01 |

### 19.4 Cenários de Erro e Segurança

| CT | Invariante | Camada | CA |
|---|---|---|---|
| **CT-1019** | A superfície **nova** do processo externo não carrega material nem senha — inclusive `spawnargs` e o objeto de erro **cru** | conversão | CA-16 |
| **CT-1024** | Nenhum dos **seis** desfechos das rotas tocadas carrega segredo — corpo, cabeçalho, diário e documento publicado | borda | CA-16, CA-18 |
| **CT-1028** | Duas empresas ativam independentemente; o motivo de uma **não aparece** em resposta alguma da outra | borda | CA-02, CA-04 |
| **CT-1033** | Na **saída real**, o dialeto do provedor aparece **exclusivamente** dentro do portador — varrido com e sem ele | borda | CA-04, CA-18 |
| **CT-1037** | As duas rotas exigem a permissão **que já existe**; sem ela, envelope de recusa e **zero** efeito; catálogo **inalterado** | borda | CA-08 |

**Todo caso de varredura tem controle positivo obrigatório** — o mesmo objeto de função aplicado ao
alvo e a um controle com as agulhas plantadas canal a canal, com a lista afirmada por **igualdade**.
Uma varredura que nunca acha nada aprovaria um produto vazando tudo, e é a causa de rejeição repetida
das duas fatias anteriores.

### 19.5 Rastreabilidade CA → CT

| CA | CT | CA | CT |
|---|---|---|---|
| CA-01 | CT-1025, CT-1026, CT-1043, CT-1046, CT-1047 | CA-12 | CT-1021 |
| CA-02 | CT-1027, CT-1028 | CA-13 | CT-1018, CT-1023 |
| CA-03 | CT-1025, CT-1026, CT-1029 | CA-14 | CT-1018, CT-1023 |
| CA-04 | CT-1026, CT-1028, CT-1030, CT-1031, CT-1033 | CA-15 | CT-1039, CT-1040 |
| CA-05 | CT-1034, CT-1035 | CA-16 | CT-1015, CT-1016, CT-1017, CT-1019, CT-1024 |
| CA-06 | CT-1042 | CA-17 | CT-1041 |
| CA-07 | CT-1036 | CA-18 | CT-1024, CT-1032, CT-1033, CT-1038, CT-1044 |
| CA-08 | CT-1037 | CA-19 | CT-1029 |
| CA-09 | CT-1014, CT-1020, CT-1046 | CA-20 | CT-1020, CT-1046 |
| CA-10 | CT-1015, CT-1021, CT-1022 | CA-21 | CT-1045 |
| CA-11 | CT-1015, CT-1021, CT-1022 | | |

**Cobertura: 21/21 CA.** Nenhum CA sem caso; nenhum caso órfão.

### 19.6 Obrigações de antirregressão que a suíte carrega

1. ⚠️ **O `CT-1021` é a REESCRITA do caso que hoje afirma a mensagem única — nunca um caso novo ao
   lado dele.** O bloco permanece no lugar, com título e corpo reescritos; a contagem do pacote `api`
   **não cai** (P5). Apagar e recriar seria regressão de prova (R2) mesmo com a contagem constante. O
   que autoriza a reescrita é a **mudança de requisito aprovada no PRD** (D4), declarada na linha
   `O QUE ESTA MUDANÇA REMOVE`, nomeando a indistinguibilidade removida.
2. **O docblock que declara a fusão das duas causas é SUBSTITUÍDO**, não apagado nem mantido —
   docblock que sobrevive à decisão que ele explica é o vetor da R3.
3. **O marcador do `D64` sai no mesmo commit da correção**, junto com a linha dele no índice do
   `CLAUDE.md` — as **duas** pontas (§3-B).
4. **Baseline por pacote** (P1/P5), medida em 2026-08-20: `api` 354 · `contracts` 399 · `db` 233 ·
   `worker` 126 · `cobranca-bancaria` 93. ⚠️ Meça **por pacote** — a saída agregada não é confiável.
5. **Nenhum material de certificado na árvore versionada**: tudo gerado em execução, em diretório
   temporário próprio, apagado ao fim. O disco deste host é apertado, e material que sobra vira falta
   de espaço disfarçada de teste vermelho.

### 19.7 Atritos e cenários declaradamente não cobertos

| # | O quê | Conduta |
|---|---|---|
| A1 | ⚠️ **CORRIGIDO na T10 (2026-08-22), por medição — a redação anterior dizia que o `CT-1045` exige privilégio e prescrevia execução assistida com o operador.** **Medido em 2026-08-21 (T3 §3.3 e `task_plan.md` §9.4): o caso NÃO exige privilégio.** Ele não executa o `main` do verificador; extrai a função sob prova por `sed`+`eval` dentro de um subshell — **o mesmo mecanismo que o `ct_647` já usa** naquele mesmo arquivo —, com controle e mutantes montados em `mktemp -d` e `PATH` recortado. **Zero privilégio, zero interação, task desassistida** | **Nada a conduzir com o operador.** ⚠️ **A bateria completa também NÃO está barrada pela ADR-0006**, e esta é a segunda metade da correção: o guarda `recusar_bateria_em_producao` **libera** — medido com privilégio, `/etc/sysloc/` contém apenas `backend.env`, `backend.env.bak-20260820-215114` e `migracao.env`, e o marcador `producao` **não existe** (ele é armado só na F7, e o backend novo ainda não atende ninguém). O que de fato impede a bateria de dizer algo sobre esta fatia é outra coisa: **ela roda e sai `1` por 5 falhas pré-existentes alheias** (`MEMBROS_DO_WORKSPACE` e `PACOTES_POR_DIRETORIO` defasados, `LIMITE_PNPM_TEST=120` contra os ~428 s reais, e `pnpm lint` cobrado em zero diagnósticos contra 4 `infos`). **Não se concede `NOPASSWD` nem se estica `timestamp_timeout`** — seria alterar a segurança do host em troca de nada, e a decisão foi registrada com o usuário em 2026-08-21. A alternativa do verificador irmão fica **arquivada, não descartada**; e continua valendo, em qualquer cenário: ⚠️ **não se admite criar um 12º `verificar-*.sh`** (agravaria o `D9`) nem deixar a pré-condição sem afirmação |
| A2 | **`CT-1017` pode ser instável** — a janela de observação é a duração do processo externo | Se a sondagem não for determinística, **registrar como débito com gatilho** e manter o `CT-1016`, que é determinístico. ⚠️ **Proibido** afrouxar a asserção, aceitar a não-observação como verde, ou expor o caminho do artefato ao teste por símbolo de produção |
| N1 | **O estouro do teto de tempo** do processo externo não tem prova | Não há arranjo sem introduzir símbolo *test-only* na produção. A remoção do artefato no caminho de erro **está** coberta (`CT-1016`). Registrar como débito com gatilho no módulo |
| N2 | **A metade documental do CA-18** — o handoff **gerado** | Pertence a outra skill, depois desta fatia. O **contrato** que ele consome está coberto (`CT-1044`, `CT-1024`, `CT-1038`) |
| N3 | **O agendamento** da reconferência periódica | Fora do escopo por decisão do PRD; a **tarefa** está coberta (`CT-1040`), falta só o gatilho, que nasce na fatia (ii) |
| N4 | **Corrida entre duas ativações simultâneas** da mesma empresa | Fora da política de teste; o ato é **raro por construção**. A última gravação vence — que é o que a RN-04 já decide |

---

## 20. Riscos Técnicos

| # | Risco | Probabilidade | Mitigação |
|---|---|---|---|
| R1 | **Reversão da indistinguibilidade lida como regressão.** O serviço hoje funde duas causas de propósito | alta | Verificado: **não há `DECISÃO FECHADA`** sobre o trecho. A reversão declara `O QUE ESTA MUDANÇA REMOVE`, o caso é **reescrito e não apagado**, e o docblock que explica a fusão é **substituído** — docblock que sobrevive à decisão que ele explica é o vetor da R3 |
| R2 | **Sinal do conversor reusado da biblioteca** — o ramo da senha nunca dispararia | alta | §6.2 fixa o radical comum; medido nas duas pontas (M10, M11); o caso da senha reprova se o ramo não disparar |
| R3 | **Processo externo é superfície nova** para vazamento de segredo | média | Guarda completa de §8; medição da saída **real**, incluindo o objeto de erro do processo, com controle positivo |
| R4 | **Credencial da família errada** apresentada ao provedor | média | **D6**; sem a chave composta o defeito é intermitente e dependente de ordem — a pior classe para depurar |
| R5 | **Binário do host ausente ou sem o provider legado** em outra máquina | baixa hoje | CA-21 move a descoberta da renovação do Admin para a instalação |
| R6 | **Vaga ocupada por sistema de terceiro** lida como produto quebrado | média | Motivo íntegro + degradação declarada. O cliente da vaga ocupada é o **teste vivo** do desenho |
| R7 | **Redação do binário muda entre versões** e a classificação degrada | baixa | Degradação **para o desfecho genérico**, declarada em §6.2 — perde diagnóstico, nunca contenção |
| R8 | **Congelamento**: contrato incompleto no handoff | média | §4 completa; os cinco gatilhos do handoff estão escritos no plano de execução |

---

## 21. Observações Técnicas

### 21.1 ADRs Aplicáveis nesta Feature

Classificação sobre as **29 ADRs `accepted`**, com a `Decision` **aberta** para cada
`APLICÁVEL`/`PARCIAL` que restringe artefato concreto.

> ⚠️ **São 29, e não 28.** O `CLAUDE.md` diz *"35 registradas, 28 `accepted`"*, medido em 2026-08-19
> — **antes** da ADR-0036, criada em 2026-08-21 para esta fatia. Medido agora: **36 registradas, 29
> `accepted`**, 3 `deprecated` e 4 `superseded`. A correção do índice entra no fecho da fatia.

| ADR | Classe | Conformidade — contra o texto real da `Decision` |
|---|---|---|
| **0001** (+2 emendas) | APLICÁVEL | §3.3, §4.2. A porta nova é **irmã de configuração**, conforme às três condições cumulativas da emenda de 2026-08-15: (a) não exerce nenhuma das cinco capacidades; (b) consumidor nomeado fora do núcleo — o Admin; (c) sujeita **na íntegra** à cláusula *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"*, exigível por varredura. O nome reservado `AdaptadorCobrancaBancaria` **não** é usado |
| **0008** | APLICÁVEL | §7. Tabela com `empresa_id`, RLS `USING`+`WITH CHECK`, FK composta. *"A camada de aplicação não implementa filtro por empresa equivalente"* — §3.3 e §11 |
| **0011** | APLICÁVEL | §4.1, §11. Duas dimensões declaradas por rota; `semDeclaracao` permanece vazio; a cobertura é **consultada sobre a superfície publicada**, e as três âncoras vão a 105/90/20 |
| **0016** | APLICÁVEL | §4.2. O esquema do pacote de contratos é a **fonte única**; a conferência de entrada e o documento derivam dele |
| **0017** (+emenda) | APLICÁVEL | §4.2, §4.3. Chave exposta é **UUID** — a entrega não tem série declarada; corpo em camelCase; envelope `{ codigo, mensagem, campo?, detalhes? }` com `codigo` de **enum fechado**, ao qual se acrescentam três |
| **0018** | APLICÁVEL | §4.1, §5.2. **Conjunção** de exigências; a recusa nomeia a **primeira ausente na ordem declarada** |
| **0024** (+2 emendas) | APLICÁVEL | §6.4. A carga leva o identificador de empresa porque **quem enfileirou já detinha direito a ele** — a sessão do Admin. É exatamente a cláusula da emenda de 2026-08-18, e **não** o caso da entrada de terceiro, em que o campo não existe |
| **0025** | APLICÁVEL | §3.3. O **domínio declara** a porta e o tipo que a atravessa; o adaptador **importa dele**; a porta chega **por parâmetro** |
| **0026** | APLICÁVEL | §7. O instante da verificação vem do **banco**; nenhuma leitura do relógio do processo decide comportamento |
| **0029** | APLICÁVEL | §5.1, §6.4. A ativação **permanece em linha** — *"chamada síncrona a terceiro cujo retorno o solicitante espera na própria resposta permanece em linha, e não é exceção"*. A reconferência é **enfileirada** — seu resultado *"não compõe a resposta do pedido"* |
| **0031** | APLICÁVEL (contrapositiva) | §7. A tabela **é** dado de empresa, logo **não** vai para `plataforma`, cujo roster enumerado permanece intocado |
| **0032** | APLICÁVEL | §8, §11. Cifra reversível, chave fora da árvore e fora do pacote que guarda; *"não retorna por superfície alguma — consulta, erro ou diagnóstico"*; ausência de vazamento **por medição da saída real**, agora estendida ao processo externo |
| **0034** | APLICÁVEL | §13. *"registra o **efeito** … nunca a tentativa que nada mudou"* — a recusa **é** desfecho anômalo e entra; a reconsulta que nada muda não gera registro. O `Neutros` — *"o que o terceiro informou continua preservado como **diagnóstico**"* — é a âncora do **D5** |
| **0036** | APLICÁVEL | §6.1, §8, §11. Conversão **na borda de registro**, processo externo de vida curta, identidade conferida por **titular, série e validade**, tolerância confinada ao subprocesso, e *"o que se cifra e guarda é sempre o material convertido"* |
| **0021** | **PARCIAL — só como analogia** | §11. A metade da **forma** é satisfeita: a ativação é **rota própria**, nunca campo de atualização parcial. A metade da **governança** não se invoca: o marcador `DECISÃO FECHADA — T12` fixa que estas rotas se apoiam em 0011+0018, e que reapoiá-las na 0021 reabre um achado que já voltou por caminho novo. A rota exige a **chave de ação**, que é mais restritivo que qualquer leitura da 0021 |
| **0030** | **PARCIAL — pela cláusula de exclusão** | §6.1. O material convertido **poderia** ser lido como artefato derivado que *"nunca é armazenado"*. Não é: a própria `Decision` exclui *"fato recebido de terceiro … é dado de entrada, ninguém o recompõe, e guardá-lo é o único caminho"*, e a ADR-0036 decide explicitamente que **o que se guarda é o convertido**. Converter a cada uso rodaria processo externo em toda chamada ao provedor |
| **0022** | **N/A — com razão registrada** | O sujeito é o **fato financeiro**, e a cláusula do estado derivado o acompanha. O estado da entrega **não é derivável dos fatos gravados**: a verdade dele vive no provedor, e a alternativa de derivá-lo consultando ao vivo foi **podada no discovery** porque a recusa precisa sobreviver à requisição |
| 0005, 0006, 0009, 0010, 0013, 0014, 0020, 0023, 0027, 0028, 0033, 0035 | N/A | Nenhuma rota sem sessão (0027, 0035); nenhuma rota de bytes (0028); nenhuma série nova (0020, 0033); nenhuma derivação que participe de seleção (0023); as demais não tocam a área |

**Nenhum conflito spec×ADR e nenhum conflito ADR×ADR detectado.** As duas tensões candidatas — 0030
contra 0036, e 0001(c) contra a RN-02 do PRD — resolvem-se **pelo texto das próprias ADRs**: a
cláusula de exclusão da 0030 e o `Neutros` da 0034 somado ao fato de a cláusula da 0001 ser
propriedade **do vocabulário**, isto é, de nome, não de valor.

### 21.2 Candidatos a ADR (FASE 4B — 5 critérios canônicos)

**Nenhum candidato confirmado.** A decisão transversal desta fatia — *"o produto executa processo
externo para converter material criptográfico"* — **já foi registrada** como **ADR-0036**, antes do
PRD, e é por isso que o discovery a exigiu primeiro.

| Decisão | Critérios | Classe |
|---|---|---|
| Motivo de terceiro como **diagnóstico** em campo de nome do produto (**D5**) | C1 ✅ · C2 ✅ (`architecture`) · C3 ⚠️ · C4 ⚠️ · **C5 ✅** | **Parcial — não registrar.** Falha C3 e C4: a composição 0001(c) + 0034(`Neutros`) **já responde**, e ADR nova com a mesma decisão seria churn — o critério que o `CLAUDE.md` aplica à ADR-0006 |
| Credencial por **empresa e família de escopo** (**D6**) | C1 ⚠️ · C2 ✅ · C3 ⚠️ · C4 ❌ · C5 ✅ | **Parcial.** É consequência mecânica de o provedor exigir escopos disjuntos — não surpreende quem lê |
| Registro do efeito na **linha de estado** e não na trilha (**D7**) | C1 ⚠️ · C2 ✅ · C3 ❌ · C4 ⚠️ · C5 ✅ | **Parcial.** Escopo de feature; a ADR-0034 já fixa o critério e declara que *"cada integração declara quais desfechos são anômalos para ela"* |

### 21.3 Vocabulário — canonizado no challenge de 2026-08-21

O termo é **Entrega da notícia do provedor**, registrado no glossário **global**, com os estados
`HABILITADA` e `DESABILITADA`. ⚠️ **O adjetivo "imediata" caiu, e a queda é medida, não estética:**

1. **`reentrega` já ancora o substantivo.** `tratamento-de-notificacao.ts` publica
   `ehReentregaDeEfeitoAplicado` — *"entrega"* já é, neste código, o ato de o provedor entregar a
   notícia, e *reentrega* a repetição dele. O termo novo herda vocabulário em vez de inventar.
2. **"Imediata" não discrimina nada.** Medido: a conferência periódica **não produz notícia** — ela
   liquida direto, e nenhum caminho dela escreve na relação da notícia. A **Notícia do provedor
   existe apenas por este canal**, de modo que não há entrega *não* imediata da qual distingui-la. O
   adjetivo sugeria uma segunda modalidade que não existe.
3. **O PRD delegou esta decisão a esta etapa**, por escrito, na nota de vocabulário da §1 dele — de
   modo que a divergência de redação em relação ao PRD é **prevista**, não conflito.

"Habilitar webhook" permanece **apenas** como rótulo do botão, que é frontend e não cruza a porta.

### 21.4 Sessão de challenge — 2026-08-21

Quatro achados, todos confirmados **contra o código real**, todos resolvidos **inline** — nenhum ficou
como observação, que é o modo de falha registrado no caso `arquitetura-projeto`. **Nenhum candidato a
ADR novo** surgiu.

| # | Achado | Verificado por | Resolução |
|---|---|---|---|
| Q1 | **Terminologia** — "entrega imediata" era provisório, e a spec o usava na prosa enquanto os símbolos já diziam "entrega da notícia": inconsistência interna | `reentrega` no domínio; medição de que a conferência **não** produz notícia | Canonizados **Entrega da notícia do provedor** e **Motivo da recusa do provedor** no glossário **global**. §21.3 |
| Q2 | **Pré-condições do ato externo fundidas e com a forma errada** — a spec dizia *"sem certificado ou sem identidade → recurso não encontrado"* | `exigirCertificadoVigente` e `exigirIdentidadeVigente` de `boleto.service.ts`, o outro ato que usa o provedor | São **três** recusas distintas — certificado ausente, **validade encerrada** e identidade ausente —, com código de campo e `detalhes` discriminante, **sem `campo`**, e **não** `404`. §5.1, §5.2, §10 |
| Q3 | **A spec chamava de "saída aberta" a resposta do certificado**, que é `z.strictObject` por razão escrita | docblock de `esquemaDoCertificado` | Corrigido na §15, com a advertência de que aquela estritude **não se afrouxa** nesta fatia |
| Q4 | **Onde vive *"o material foi convertido"*** — a spec o tratava como campo a mais na projeção do certificado | `esquemaDoCertificado` é compartilhado por **registrar e consultar** | §4.4 nova: **esquema próprio do desfecho do registro**. Propriedade do **ato** não vai na projeção do **certificado**, e alargar aquele esquema gastaria a salvaguarda que ele existe para dar |

⚠️ **Correção que alcança a §19**: a pré-condição original do `CT-1023`, escrita pelo gerador de
casos, supunha o campo dentro de `esquemaDoCertificado`. A **§4.4 prevalece** — o caso continua
válido e as asserções não mudam; o que muda é **onde** o campo é declarado.

**Achados NÃO encontrados, e vale registrar que foram procurados**: nenhum arquivo citado como
existente falta (15 conferidos, 15 presentes); nenhum símbolo importado da casa compartilhada
inexiste; nenhuma colisão de rota; a numeração das migrações é a próxima livre; e o caso que o
`CT-1021` reescreve existe e é exatamente o que a §19.6 descreve.

### 21.5 Débito fechado

**`D64 · F4/fechamento`** (fatia `fundacao-bancaria`) é **pago** por esta fatia. Ao fechá-lo: o
marcador sai de `certificado.service.ts` **no mesmo commit da correção**, a linha sai do índice do
`CLAUDE.md`, e a §2 do `run-report.md` daquela fatia recebe a marca de fecho. As **duas pontas** são
conferidas, como manda a §3-B.

⚠️ **A prova que o mantinha aberto está disponível.** Ela exigia *"material legado gerado em
execução"*, tido como caro; medido em 2026-08-21: **duas invocações** do binário, sem material
versionado e sem depender do arquivo real da AC.

---

## 22. Checklist Final

- [x] Variante decidida (**backend**) e registrada na §1
- [x] Template da variante backend preenchido — 22 seções, N/A justificado onde não se aplica (§14)
- [x] Tech spec cobre todo o PRD — **12 US** mapeadas nas §5.3 e §17, com semânticas distintas
- [x] Arquitetura com componentes, fronteiras e visão em árvore
- [x] Arquivos envolvidos listados — **9 a criar**, **14 a modificar**, **8 de referência**
- [x] Seções de backend preenchidas: contratos, persistência, integrações, logs, versionamento, deploy
- [x] Dependências técnicas listadas — **nenhum pacote novo no manifesto**
- [x] Riscos técnicos com mitigação — **8**, com R1 e R2 nomeando os modos de falha medidos
- [x] Inventário de ADRs com conformidade **literal** contra a `Decision` aberta; zero conflitos
- [x] Candidatos a ADR avaliados pelos 5 critérios — **nenhum confirmado**, com a razão de cada parcial
- [x] Estratégia de testes delegada ao `agent-spec-qa-test-generator` e integrada — **33 casos**, rastreabilidade **21/21 CA**, zero órfãos
- [x] Comentários de template removidos
