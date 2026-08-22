# Prompt de correção — conformidade do adaptador Sicoob com a documentação oficial do provedor

> **Estado deste arquivo: EM CONSTRUÇÃO.** Ele é escrito **um endpoint por vez**, à medida que o
> usuário cola a documentação oficial de cada um. Hoje está completo apenas o **§5 — `GET /webhooks`**.
> Os endpoints seguintes entram como `§6`, `§7`, … com a **mesma estrutura interna**.
> **Não execute o trabalho enquanto o §9 (Critério de pronto) declarar endpoints pendentes**, a menos
> que o usuário autorize expressamente uma execução parcial.

---

## 0. Quem é você e o que este arquivo é

Você é o agente encarregado de **corrigir a implementação do adaptador do provedor bancário (Sicoob)
onde ela diverge da documentação oficial dele**. Este arquivo é a sua ordem de serviço completa: ele
carrega a documentação oficial verbatim, a implementação atual verbatim, a análise de conformidade já
feita, os defeitos já qualificados e as provas exigidas. **Você não precisa refazer a análise** — ela
foi feita em sessão anterior, contra o código real, e está registrada aqui com caminho e linha.

**Este arquivo não é uma spec de fatia e não passa pelo pipeline agent-spec.** É uma **intervenção
dirigida** — o caminho que o `CLAUDE.md` registra como o que de fato funciona nesta base (responde
por 45 dos 127 débitos fechados, contra 20 da skill de resolução de débito). Não invoque
`/agent-spec-*-run-tasks` nem `/agent-spec-debt-resolution` por causa dele.

### 0.1 Restrição de superfície — DECLARADA PELO USUÁRIO em 2026-08-22, vinculante

> *"Minha aplicação Sysloc no frontend terá somente a funcionalidade de **habilitar webhook**, que
> utiliza somente o `POST` e o `GET` (cadastro e consulta)."*

O que isso fixa, e que você **não** pode contrariar:

1. **A tela tem UM ato: habilitar.** Nenhum botão de atualizar, desabilitar, remover ou reativar.
2. **Nenhuma rota nova na API.** A superfície é **105 rotas / 90 manipuladores** e congela logo após a
   F5; a rota de ativação (`POST /v1/…/entrega-da-noticia/ativacao`) e a de leitura
   (`GET /v1/…/entrega-da-noticia`) **já existem** e bastam.
3. **O `handoff-frontend.md` não muda por causa deste trabalho.** Se a sua correção obrigaria a mudar
   o contrato que o React consome, **pare e escale** — você saiu do escopo.

⚠️ **Isto NÃO significa que o adaptador só pode falar `POST` e `GET` com o provedor.** As duas coisas
são camadas diferentes: *"a tela tem um ato"* é superfície do produto; *"quantas chamadas esse ato faz
ao provedor"* é mecanismo. O `§7` demonstra que **habilitar**, para ser cumprido de fato, precisa de um
`PATCH` **interno** quando o endereço divergiu — invisível ao frontend, dentro da rota que já existe.
Confundir as duas camadas leva a entregar um botão que não consegue habilitar.

**Idioma: português brasileiro em tudo** — código, comentários, testes, commits e as suas respostas
no terminal. **Modelo: exclusivamente Opus.** As duas coisas são decisão do usuário, sem negociação
(`CLAUDE.md`).

---

## 1. Por que este trabalho existe — a origem, sem eufemismo

O adaptador `packages/cobranca-bancaria/src/adaptador-sicoob.ts` foi construído **sem a documentação
oficial do provedor em mão**. As fontes reais foram três, e o `run-report` das fatias registra isso:

1. **Fragmentos passados pelo usuário** em `.claude/plans/plano-saas.md` §F6 — o payload de validação
   literal, os nomes dos campos que importam, a regra dos códigos aceitos (200/201/204, redirect
   reprova) e a lista de endpoints de gestão.
2. **Engenharia reversa do backend legado** em `/opt/frappe/app-sync/locacao_automation/locacao_automation/cobranca_sicoob/`
   — que cobre o lado **API de boletos** e **nada** do webhook: o legado nunca teve webhook (a medição
   M4 do discovery achou `origem_evento = api` em 100% dos 1.864 eventos, e
   `grep -rln "idWebhook\|validacaoWebhook" /opt/frappe/app-sync/` volta **vazio**).
3. **Sonda de leitura real contra a conta de produção**, 2026-08-16 (§13-A do discovery da fatia
   `integracao-bancaria-sicoob`) — que mediu o envelope `resultado`, a expiração do token em 300 s, o
   `nossoNumero` como inteiro e a integridade do `seuNumero` em 18 posições.

Tudo que veio de **medição** bate exato com a documentação. Tudo que foi **inferido** diverge. O
padrão é nítido e vale para os próximos endpoints: **desconfie de todo campo, parâmetro ou semântica
que não tenha origem em (1), (2) ou (3).**

A própria §13-A.1 do discovery declara o limite por escrito: *"Isto prova o caminho de consulta. Não
prova o payload do webhook (…) e permanece inauditável."* O `CA-20` — cadastrar o webhook no portal do
provedor — **nunca foi executado**. Nenhum byte real do provedor jamais atravessou o caminho da
entrega da notícia.

---

## 2. Regras vinculantes — leitura obrigatória ANTES de editar qualquer arquivo

Estas não são recomendações. São o contrato desta base, e os gates as tratam como tal.

| Ordem | Arquivo | Por que importa aqui |
|---|---|---|
| 1 | `.claude/rules/nao-regressao.md` | **Toda edição deste trabalho é edição de arquivo que já existia.** O protocolo se aplica com força máxima. |
| 2 | `CLAUDE.md` | Invariantes, convenções, o bloco de Débitos com gatilho ativo, o índice de ADRs. |
| 3 | `.claude/rules/autonomia-do-run.md` | Você **não pausa** para perguntar. Decide pela opção recomendada, registra a decisão e a razão, e segue. |
| 4 | `.claude/rules/testing-stack.md` | A fronteira entre asserção estática (exige prova de falsificação por execução) e comportamental (não se executa mutante). |
| 5 | `docs/adr/0001-*.md` (**e as DUAS emendas**), `0025`, `0032`, `0034`, `0035` | São as ADRs que este adaptador instancia. Ver o §4.3 abaixo, que trata da tensão aparente com a 0001. |

### 2.1 O que o Protocolo Antirregressão exige de você, em concreto

- **P1 — baseline ANTES.** Rode e **registre o número exato** de casos verdes, por pacote, antes da
  primeira edição. Os valores esperados hoje estão no §3.
- **P2 — arqueologia.** Antes de tocar num trecho: procure `DECISÃO FECHADA` e `DÉBITO COM GATILHO`
  ao redor, leia o `git log -L` da região, e grepe o tema nos `_run/` das fatias
  `emissao-e-conciliacao`, `webhook-e-carne` e `integracao-bancaria-autonoma`.
- **P3 — as três linhas, por mudança, ANTES de editar.** `CAUSA-RAIZ:`,
  `POR QUE ISTO FECHA A CLASSE:` e `O QUE ESTA MUDANÇA REMOVE:`. Não conseguiu escrever a segunda com
  convicção? O diagnóstico não está pronto — não edite.
- **P4 — rede.** Todo defeito corrigido deixa um caso que **falharia com o código antigo**. Ver o §5.7.
- **P5 — baseline DEPOIS, caso a caso.** Caso que estava verde e ficou vermelho é regressão sua:
  **reverta a sua mudança, nunca ajuste o teste.**

### 2.2 As proibições que mais provavelmente vão te tentar neste trabalho

1. **Não afrouxe nenhuma asserção existente** do `CT-1043` para acomodar a sua mudança. Se um passo
   dele quebrar, o certo é quase sempre que a **fixture** dele precisa migrar para a forma real
   documentada — o que é fortalecimento, não afrouxamento. Justifique por escrito.
2. **Não remova** a redação de segredo, o `MENOR_CODIGO_DE_RECUSA`, a preservação verbatim do motivo,
   nem o `diagnostico` íntegro. Você não os introduziu, e cada um fechou um defeito real.
3. **Não "aproveite que está aqui"** para refatorar o adaptador. Ele tem ~2.000 linhas e cinco famílias
   de operação; o seu escopo são os endpoints listados neste arquivo, e nada mais.
4. **Não altere, mova ou remova nenhum marcador `DECISÃO FECHADA`.** Se a correção exigir contrariar
   um, a conduta é a do §3 da rule de autonomia: nomeie o conflito, adote a **conservadora**
   (preservar o marcador e resolver por outro caminho), registre, e siga sem esperar.

---

## 3. Baseline — os números a bater antes e depois

Medidos em 2026-08-22, na **intervenção dirigida** posterior ao fecho da fatia
`integracao-bancaria-autonoma`. ⚠️ **Confira contra o `CLAUDE.md` antes de começar** — ele é a fonte, e
esta tabela é cópia; se divergirem, o `CLAUDE.md` vence e esta linha está vencida.

```bash
pnpm --filter @sysloc/cobranca-bancaria test   # 106 casos
pnpm --filter @sysloc/api test                 # 374 casos
pnpm --filter @sysloc/worker test              # 133 casos
pnpm --filter @sysloc/contracts test           # 425 casos
pnpm --filter @sysloc/db test                  # 235 casos
```

⚠️ **Meça por pacote.** O `turbo run test` aborta os pacotes irmãos e a saída agregada não é
confiável — está escrito no `CLAUDE.md` e já custou uma medição errada.

Total atual da suíte: **1814 casos** em 9 pacotes. Se o seu trabalho acrescentar casos, o total sobe
**no mesmo diff** que os acrescenta, no `CLAUDE.md` — número narrativo que fica para trás convida a
próxima task a "corrigir" a contagem para o valor errado.

---

## 4. Método — como a análise foi feita, e como replicá-la nos próximos endpoints

### 4.1 O procedimento, em quatro passos

1. **Ler a documentação oficial colada pelo usuário**, sem interpretar: parâmetros (nome exato, tipo,
   se é query/path/body), códigos de resposta **todos**, e o corpo de cada um.
2. **Localizar a implementação correspondente** no adaptador e seguir a cadeia completa até o
   consumidor final — porta → serviço da API ou tarefa do worker → efeito gravado ou mostrado.
3. **Confrontar item a item**, separando três categorias: (a) confere; (b) diverge na **forma** (nome
   de campo, envelope, código); (c) diverge na **semântica** — a pergunta que o código faz não é a
   pergunta que o endpoint responde. **A categoria (c) é a cara**: nenhum ajuste de mapeamento a
   conserta, e ela não aparece em teste com fixture escrita pelo próprio autor.
4. **Qualificar o modo de falha** de cada divergência: falso positivo, falso negativo, erro duro, ou
   inócuo. Falso positivo em confirmação de estado é sempre o mais grave, porque o produto afirma
   saúde onde há defeito.

### 4.2 O erro de análise a evitar — registrado porque já aconteceu

Na primeira leitura, a divergência do `GET /webhooks` foi qualificada como **falso negativo**
("conservador, no máximo deixa de confirmar algo que está de pé"). A documentação oficial mostrou que
o modo de falha real é **falso positivo** — o oposto, e o pior dos dois. A causa do erro: julgou-se o
modo de falha **sem conhecer o espaço de estados que o endpoint pode devolver**. Enquanto a
documentação de um endpoint não estiver em mão, **não afirme o modo de falha dele.**

### 4.3 A tensão com a ADR-0001, e por que ela é aparente — leia antes de recuar

A ADR-0001 e a cláusula de fecho dela proíbem **vocabulário do provedor atravessar para fora do
adaptador**: nenhum código de recusa, nenhum nome de recurso da instituição, nenhum `switch` sobre
taxonomia dele no domínio, no serviço ou na tela.

**Ela não proíbe o adaptador LER esses campos.** Ler o dialeto e traduzi-lo é exatamente o que o
adaptador é — `packages/cobranca-bancaria/src/adaptador-sicoob.ts` já lê `nossoNumero`,
`linhaDigitavel`, `situacaoBoleto`, `pdfBoleto` e o envelope `mensagens[]`, e nenhum deles sai de lá.

Portanto: **ler `codigoSituacao` e `dataHoraInativacao` dentro do adaptador é conforme**, desde que o
que saia pela porta continue sendo apenas vocabulário do produto (`aceito`, `motivo`, e — se você
criar — o terceiro desfecho canônico do §5.5.5). O que seria violação é o serviço da API ou a tarefa
do worker comparando `codigoSituacao === 3`. Isso **não** deve acontecer, e o cabeçalho de
`apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` já declara a proibição por escrito.

---

## 5. ENDPOINT 1 — `GET /cobranca-bancaria/v3/webhooks` (consultar webhook cadastrado)

### 5.1 Documentação oficial do provedor — verbatim, como o usuário a forneceu

> Serviço para consultar os detalhes dos webhooks cadastrados.
>
> **Parameters**
>
> | Name | Description |
> |---|---|
> | `idWebhook` — `integer($int64)` *(query)* | Identificador único do webhook. |
> | `codigoTipoMovimento` — `integer($int32)` *(query)* | Código do tipo de movimento do webhook. `7 - Pagamento (Baixa operacional)` |
>
> **Responses** — content type `application/json`
>
> `200` — Consulta realizada com sucesso.
>
> ```json
> {
>   "resultado": [
>     {
>       "idWebhook": 4,
>       "url": "https://webhook.com",
>       "email": "webhook@email.com",
>       "codigoTipoMovimento": 7,
>       "descricaoTipoMovimento": "Pagamento (Baixa operacional)",
>       "codigoPeriodoMovimento": 1,
>       "descricaoPeriodoMovimento": "Movimento atual (D0)",
>       "codigoSituacao": 3,
>       "descricaoSituacao": "Validado com sucesso",
>       "dataHoraCadastro": "2024-09-03T00:27:18.483Z",
>       "dataHoraUltimaAlteracao": "2024-09-06T12:24:11.296Z",
>       "dataHoraInativacao": "2024-09-05T18:50:55.099Z",
>       "descricaoMotivoInativacao": "Erro ao enviar notificação"
>     }
>   ]
> }
> ```
>
> `204` — A consulta foi realizada com sucesso e não retornou registros.
>
> `400` — Erro de negócio · `406` — Possíveis erros de inconsistência nos dados passados ·
> `500` — Erro interno — os três com o mesmo corpo:
>
> ```json
> { "mensagens": [ { "mensagem": "string", "codigo": "string" } ] }
> ```

### 5.2 Implementação atual — verbatim, com localização

**Constantes** — `packages/cobranca-bancaria/src/adaptador-sicoob.ts`:

```ts
const METODO_DE_LEITURA = 'GET';                                   // :376
const RECURSO_DAS_ENTREGAS = '/cobranca-bancaria/v3/webhooks';     // :400
const TIPO_DE_MOVIMENTO_DA_ENTREGA = 7;                            // :439
const PERIODO_DE_MOVIMENTO_DA_ENTREGA = 1;                         // :440
const CHAVE_DAS_RECUSAS = 'mensagens';                             // :464
const CHAVES_DO_CODIGO_DA_RECUSA = ['codigo', 'error'] as const;   // :465
const CHAVES_DA_MENSAGEM_DA_RECUSA = ['mensagem', 'error_description'] as const; // :466
const CHAVE_DO_ENVELOPE = 'resultado';                             // :443
const MENOR_CODIGO_DE_RECUSA = 400;                                // :514
```

**Montagem da requisição** — `:1433`:

```ts
function caminhoDaConsultaDaEntrega(numeroDoCliente: number): string {
  const parametros = new URLSearchParams({
    numeroCliente: String(numeroDoCliente),
    codigoTipoMovimento: String(TIPO_DE_MOVIMENTO_DA_ENTREGA),
  });
  return `${RECURSO_DAS_ENTREGAS}?${parametros.toString()}`;
}
```

**Interpretação da resposta** — `:2046`:

```ts
consultarEntrega(entrega: EntregaParaCadastrar): Promise<ResultadoDaOperacaoDeEntrega> {
  return executarEntrega(
    entrega,
    () => ({
      metodo: METODO_DE_LEITURA,
      caminho: caminhoDaConsultaDaEntrega(entrega.identidade.numeroDoCliente),
    }),
    (texto) =>
      corpoUtil(texto) === null ? { aceito: false, motivo: null } : { aceito: true },
  );
}
```

**Despacho por código HTTP** — `executarEntrega`, `:1928`:

```ts
return desfecho.codigo >= MENOR_CODIGO_DE_RECUSA
  ? { aceito: false, motivo: lerMotivoDaRecusa(desfecho.texto, segredosDoAto) }
  : confirmar(desfecho.texto);
```

**Desenvelopamento** — `corpoUtil`, `:1027`:

```ts
function corpoUtil(texto: string): Record<string, unknown> | null {
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return null; }

  const raiz = objetoDe(bruto);
  if (raiz === null) return Array.isArray(bruto) ? objetoDe(bruto[0]) : null;

  const envelopado = raiz[CHAVE_DO_ENVELOPE];
  if (Array.isArray(envelopado)) return objetoDe(envelopado[0]);
  return objetoDe(envelopado) ?? raiz;
}
```

**Cadeia de consumo — para onde o desfecho vai:**

| Consumidor | Arquivo | O que faz com `aceito` |
|---|---|---|
| Porta | `packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts:75` | Declara que a consulta **é quem confirma, e é ela que prevalece** (RN-05) |
| Serviço da API | `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts:347-353` | `aceito → { habilitada: true, motivo: null }` — é o que o Admin vê na tela |
| Tarefa do worker | `apps/worker/src/tarefas/reconferencia-da-entrega.ts:206` | Reconferência periódica; `{aceito:false, motivo:null}` **levanta** e a tarefa repete, de propósito (não desabilita por ausência) |

### 5.3 O que CONFERE — e que você **não deve tocar**

| Item da documentação | Implementação | Origem do acerto |
|---|---|---|
| `codigoTipoMovimento = 7` | `TIPO_DE_MOVIMENTO_DA_ENTREGA = 7`, nome do parâmetro idêntico | Fragmento do plano + inferência confirmada |
| Envelope `"resultado": [ … ]` como **array** | `corpoUtil`: `Array.isArray(envelopado) → objetoDe(envelopado[0])` | Sonda real, §13-A.4 |
| `204` = sucesso sem registros | `204 < 400` → `confirmar('')` → `JSON.parse('')` lança → `null` → `aceito:false` | Defesa genérica; funciona, mas ver o **D6** |
| Erro `{"mensagens":[{"mensagem","codigo"}]}` | `CHAVE_DAS_RECUSAS='mensagens'`, `mensagens[0]`, lê `codigo` e `mensagem` | Sonda real — **bate campo a campo** |
| Corpo de erro nunca vira confirmação | `MENOR_CODIGO_DE_RECUSA = 400` desvia **antes** do `corpoUtil` | Decisão de desenho, e ela salva o caso |
| `codigoPeriodoMovimento = 1` (D0) | `PERIODO_DE_MOVIMENTO_DA_ENTREGA = 1` | Confirmado pela doc |

⚠️ O quinto item merece atenção especial: **sem `MENOR_CODIGO_DE_RECUSA`, o corpo de erro
`{"mensagens":[…]}` cairia no ramo `objetoDe(envelopado) ?? raiz` do `corpoUtil`, voltaria como objeto
não-nulo e produziria `aceito: true` num `500`.** Essa guarda é o que impede um erro interno do
provedor de ser lido como "webhook cadastrado e ativo". **Não a remova, não a mova e não a
contorne** — ela não é redundância.

### 5.4 Os defeitos, qualificados

#### **D1 — CRÍTICO · falso positivo · semântica errada**

A confirmação decide por **presença de objeto**. A documentação revela que um webhook pode existir e
estar **inativo**: `codigoSituacao` (o exemplo mostra `3 = "Validado com sucesso"`, logo há outros
valores), `dataHoraInativacao` e `descricaoMotivoInativacao` — cujo exemplo é, literalmente,
`"Erro ao enviar notificação"`.

**Modo de falha:** o provedor inativa o webhook porque as entregas estavam falhando → `GET` devolve
`200` com o registro inativado → `corpoUtil` acha o objeto → `aceito: true` → o serviço grava
`habilitada: true` → **o Admin vê "entrega ativa" exatamente no cenário em que ela está morta.** É o
pior cenário possível: o produto afirma saúde precisamente quando o alerta era necessário.

**A pergunta que o código faz** é *"existe registro?"*. **A pergunta correta** é *"existe registro
**ativo**, do tipo de movimento certo, apontando para a **minha** URL?"*.

#### **D2 — ALTO · falso positivo**

O campo `url` da resposta **não é comparado** com o endereço que o produto cadastra
(`enderecoDaEntrega`, o mesmo valor que `comporCadastroDaEntrega` envia no `POST`). Um cadastro
apontando para outro host — hostname trocado, cadastro antigo, ambiente de teste — conta como "a minha
entrega está de pé".

#### **D3 — ALTO · parâmetro inexistente no contrato**

O código envia `numeroCliente` na query string. **A documentação não lista esse parâmetro** — só
`idWebhook` e `codigoTipoMovimento`. É inferência, provavelmente arrastada do corpo do `POST`, onde
`numeroCliente` de fato existe.

Dois desfechos possíveis, e **nenhum dos dois é bom**: ou o gateway ignora o parâmetro (e a consulta
funciona **por acidente**, filtrando apenas por tipo de movimento dentro do escopo do token), ou ele
responde **`406 — inconsistência nos dados passados`**, e a confirmação **nunca** é positiva.

⚠️ Note o encadeamento com o D1: se o `406` acontecer, `executarEntrega` produz
`{aceito:false, motivo:{…}}`, o serviço grava `habilitada: false`, e a tela do Admin passa a mentir na
direção contrária. **Os dois defeitos juntos fazem o indicador de saúde da entrega ser ruído.**

#### **D4 — MÉDIO · informação descartada**

`idWebhook` — o identificador único que o provedor atribui — **não é lido, não é retido e não é
gravado** em lugar nenhum. Consequências: a consulta não pode ser filtrada por ele (que é o filtro
canônico da documentação), e nenhuma operação dirigida futura (`PATCH`, `DELETE`, `/reativar`) tem
como endereçar o cadastro.

Registre a decisão que tomar aqui **explicitamente**: retê-lo tem custo (coluna nova, migração) e
pode não pertencer a este trabalho. **A recomendação é retê-lo apenas se a correção do D1/D2 já exigir
tocar o modelo canônico** — caso contrário, registre-o como débito com gatilho, na forma da §3-B.

#### **D5 — MÉDIO · regressão de prova latente**

A fixture do `CT-1043` — `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:2412` — responde à
consulta com:

```ts
{ codigo: 200, corpo: { resultado: { idWebhook: IDENTIFICADOR_DA_ENTREGA_NO_PAR } } }
```

Isto é `resultado` como **objeto**. A documentação oficial mostra **array**. O `corpoUtil` trata as
duas formas, então o caso passa — mas **a suíte hoje não prova a forma que o provedor de fato usa**, e
nenhum caso existente exercita um registro com `codigoSituacao` / `dataHoraInativacao` / `url`.

Migrar a fixture para a forma documentada é **fortalecimento de prova**, e é exigido.

⚠️ **Leia o `P6` do §6.4 antes de migrar.** O envelope tem forma **diferente** em cada operação —
array no `GET`, objeto no `POST` —, e hoje uma única fixture serve as duas. Migrar as duas para array
troca um erro por outro, e a suíte continua verde porque o `corpoUtil` aceita ambas.

#### **D6 — BAIXO · acerto sem prova**

O `204` funciona pelo caminho indireto de `JSON.parse('')` lançar. Está correto, mas é **acidental**:
nenhum caso o exercita, e uma refatoração inocente do `corpoUtil` (por exemplo, tratar corpo vazio como
`{}`) o quebraria em silêncio. Merece caso próprio e explícito.

### 5.5 A correção pedida

> Você **não** é obrigado a seguir o desenho abaixo. Ele é a leitura recomendada; se a sua análise
> divergir, **declare a divergência e meça** — *prescrição de gate é hipótese, não ordem* é precedente
> de método desta base, confirmado cinco vezes. O que **não** é negociável são os defeitos D1, D2 e D3
> deixarem de existir, e as provas do §5.7.

#### 5.5.1 A confirmação passa a exigir registro **ativo** (fecha D1)

> 🛑 **EMENDADO pelo §7.4/A3 — leia-o ANTES de implementar este item.** Duas coisas mudaram: (a) a
> documentação nomeia **dois** valores de `codigoSituacao`, não um (`1 - Aguardando validação` e
> `3 - Validado com sucesso`); e (b) aplicar este item **como está escrito abaixo**, sem o terceiro
> desfecho do §5.5.5, faria **toda ativação nova** terminar em `habilitada: false` — porque o cadastro
> recém-criado nasce em `1`, e a validação do endereço é assíncrona por construção. O texto abaixo é
> preservado como registro do que se sabia antes do `PATCH`; **o §7.4/A3 prevalece onde os dois
> divergirem.**

Dentro do adaptador — e **só** dentro dele —, a leitura do registro devolvido passa a exigir, em
conjunto:

- o registro existe (é objeto, dentro de `resultado`, que é **array**);
- **está ativo** — o discriminador é `dataHoraInativacao` ausente/nula **e** `codigoSituacao` igual ao
  valor de operação normal. Escreva o valor esperado como **constante nomeada, por extenso**, no molde
  de `TIPO_DE_MOVIMENTO_DA_ENTREGA`, com docblock dizendo que é dialeto do provedor e de onde saiu.

⚠️ **`codigoSituacao: 3` é o único valor que a documentação nomeia** (`"Validado com sucesso"`). Ela
**não** enumera os demais. Portanto: trate como ativo **apenas** o valor conhecido, e qualquer outro
como não-ativo. É a leitura conservadora, e é a única que não inventa taxonomia. **Registre isso como
débito com gatilho** — a tabela completa de `codigoSituacao` é pergunta aberta com o provedor, e o
gatilho é a primeira resposta dele ou a primeira ocorrência real de um valor fora do conhecido.

#### 5.5.2 A confirmação passa a comparar a `url` (fecha D2)

O registro só confirma se a `url` dele for o endereço que **este produto** cadastra. Compare de forma
robusta a diferenças que não são de identidade (barra final, caixa do host), e **não** compare de
forma que aceite um host diferente. O endereço já está em mão no adaptador — é o mesmo
`enderecoDaEntrega` que `executarEntrega` injeta no montador do pedido.

⚠️ Como `resultado` é **array**, e o filtro do `GET` pode devolver mais de um registro, a leitura
correta é **procurar no array o registro que casa com a nossa URL**, e não olhar apenas o primeiro
elemento. O `corpoUtil` atual pega `envelopado[0]` — ele serve para as outras operações e **não deve
ser alterado**; a consulta da entrega precisa da sua própria leitura sobre a lista inteira.

#### 5.5.3 O parâmetro `numeroCliente` (fecha D3)

Remova-o da query string: ele não existe no contrato do endpoint, e o escopo do token mais o mTLS já
limitam a resposta à conta autenticada. Mantenha `codigoTipoMovimento`.

Se você julgar que a remoção precisa de confirmação empírica, **não pare para perguntar** (rule de
autonomia A1): remova, registre a decisão e a razão, e deixe anotado que a confirmação definitiva vem
do `CA-20`, que segue pendente.

#### 5.5.4 A fixture e os casos (fecha D5 e D6)

Ver o §5.7.

#### 5.5.5 O `D35 · F5/T7` DISPARA com este trabalho — e deve ser fechado junto

Leia o marcador em
`apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts:360-378`. O gatilho dele é, literalmente:

> **QUANDO FECHA:** a primeira task autorizada a abrir `packages/cobranca-bancaria/src/modelo-canonico.ts`
> ou `packages/cobranca-bancaria/src/adaptador-sicoob.ts` por outra razão.

**Esta correção é essa razão.** O débito é exatamente o irmão do D1: hoje
`{ aceito: false, motivo: null }` carrega **dois significados operacionalmente opostos** na consulta —
*"o provedor não respondeu"* e *"o provedor respondeu e não há cadastro nosso"* —, e a informação que
os separa existe no adaptador mas **não atravessa a porta**.

Com o D1 corrigido surge ainda um **terceiro** significado: *"respondeu, há cadastro, mas ele está
inativo/aponta para outro lugar"* — que é operacionalmente distinto dos dois e o **mais acionável de
todos**, porque tem causa conhecida e conduta óbvia (recadastrar).

Portanto: **acrescente o terceiro desfecho na porta** (`packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts`
e `modelo-canonico.ts`), no vocabulário do produto, e propague-o aos dois consumidores:

- `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` — o `apurarDesfecho` deixa de
  gravar `habilitada: false` sobre uma entrega que pode estar de pé só porque o provedor não respondeu;
- `apps/worker/src/tarefas/reconferencia-da-entrega.ts` — o ramo que hoje **levanta** na
  indisponibilidade (`:58-73`) ganha o discriminador que ele mesmo antecipa por escrito: *"Quando o
  `D35` fechar, é este ramo que ganha o terceiro desfecho."*

**Ao fechar: remova o marcador no mesmo commit e remova a linha do `D35` do bloco de débitos do
`CLAUDE.md`.** As duas pontas, como manda a §3-B.

⚠️ **Não confunda com o `D31`, o `D32`, o `D37` e o `D38`**, que também vivem nesses arquivos e **não**
disparam com este trabalho. Deixe-os intactos, marcadores inclusive.

### 5.6 O que **NÃO** fazer

1. **Não leve `codigoSituacao`, `dataHoraInativacao`, `url` ou `idWebhook` para fora do adaptador**
   como vocabulário. Nenhum `switch` sobre eles no serviço, na tarefa, no contrato ou na tela
   (ADR-0001). O que sai da porta é desfecho canônico do produto.
2. **Não altere `corpoUtil`.** Ele serve emissão, revogação, consulta de título e cadastro de entrega.
   Mexer nele para atender a consulta da entrega é mudar cinco caminhos para corrigir um — e é
   superfície de regressão de graça (proibição 5 do protocolo).
3. **Não altere `objetoDaRecusa`, `lerMotivoDaRecusa`, `MENOR_CODIGO_DE_RECUSA` nem a redação de
   segredos.** Todos conferem com a documentação e nenhum é seu.
4. **Não toque nas famílias de cobrança** (emissão, revogação, consulta de título) — elas não estão
   neste arquivo ainda.
5. **Não invente valores de `codigoSituacao`** além do que a documentação nomeia. Ver o aviso do
   §5.5.1.
6. **Não faça o `CA-20`** (cadastrar o webhook no portal do provedor). Ele é ato de operação, exige
   decisão do usuário sobre o hostname (`[DÚVIDA] 4`, aberta) e depende de um certificado A1 que
   **venceu em 2026-08-22 19:17 UTC**. Não é seu.

### 5.7 Provas exigidas (P4 do protocolo)

Casa: `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts`, na seção
`O DIALETO DA ENTREGA DA NOTÍCIA — CT-1043`. Siga a disciplina que já vive ali: **literais do provedor
escritos por extenso, jamais derivados do fonte que eles conferem** — derivar põe o artefato sob prova
nos dois lados da igualdade e a asserção passa a aprovar qualquer coisa.

Casos novos, no mínimo:

| # | Arranjo | Esperado | O que discrimina |
|---|---|---|---|
| A | `200` + `{"resultado":[{ …ativo, url = a nossa… }]}` — **forma documentada completa**, com todos os 13 campos | `{ aceito: true }` | Prova a forma real (fecha D5) |
| B | `200` + registro com `dataHoraInativacao` preenchida e `descricaoMotivoInativacao: "Erro ao enviar notificação"` | **não** confirmado | **É a asserção que discrimina o D1** — falharia com o código antigo, que devolvia `aceito: true` |
| C | `200` + registro ativo com `url` de **outro host** | **não** confirmado | Discrimina o D2 |
| D | `200` + `{"resultado":[]}` (array vazio) | **não** confirmado | Lista sem registros |
| E | `204` sem corpo | **não** confirmado | Fecha o D6 — hoje sem prova |
| F | `200` + array com **dois** registros, o segundo sendo o nosso e ativo | `{ aceito: true }` | Prova que a busca varre a lista, e não só `[0]` |
| G | `406` + `{"mensagens":[{"codigo":"…","mensagem":"…"}]}` | `aceito:false` com motivo canônico preservado verbatim | Prova que o D3 não regrediu para o caminho de erro |
| H | Requisição emitida | a query string **não** contém `numeroCliente` e **contém** `codigoTipoMovimento=7` | Prova o D3 pelo lado do que sai |

**Sobre a demonstração das provas** (rule antirregressão, P4):

- Os casos **A a G são comportamentais** — exercitam o adaptador e observam o resultado. **NÃO execute
  mutantes neles.** Declare em uma linha, por caso, qual asserção discrimina o defeito e por quê. Isso
  é a prova, e ela é de raciocínio, não de execução. Mutation testing está **fora da stack** deste
  projeto por decisão registrada, e a medição do run `emissao-e-conciliacao` contou mais de 20
  execuções desnecessárias desse tipo em 6 tasks.
- O caso **H, se você o escrever inspecionando o texto do fonte** (`grep`/`awk` sobre o adaptador), é
  **estático** e aí a **prova de falsificação por execução é obrigatória**. A forma preferida é
  escrevê-lo **comportamentalmente** — asserção sobre a URL que o provedor instrumentado recebeu —, e
  aí ele cai na regra do parágrafo anterior. **Prefira a forma comportamental.**

Se o terceiro desfecho do §5.5.5 for implementado, ele também precisa de casos nos dois consumidores
(`apps/api/test/entrega-da-noticia.e2e.spec.ts` e
`apps/worker/test/reconferencia-da-entrega.spec.ts`), provando que a indisponibilidade **não** apaga
mais uma habilitação que estava de pé.

**FECHADO em 2026-08-22** — `D3` e `D6` na primeira passada (`CT-1053` e `CT-1053 (b)`); `D1`, `D2` e
`D5` na segunda, depois de o usuário autorizar a mudança de contrato e a migração `0025`. A consulta
passou a exigir **registro nosso, validado e não inativado**, e as fixtures migraram para a forma
documentada. Provas: `CT-1055` (a-d) e as cinco formas de corpo em `par-do-provedor.ts`.

---

## 6. ENDPOINT 2 — `POST /cobranca-bancaria/v3/webhooks` (cadastrar webhook)

### 6.1 Documentação oficial do provedor — verbatim, como o usuário a forneceu

> **`POST /webhooks`** — Cadastrar um webhook para receber notificações de acordo com o tipo de
> movimento.
>
> Este serviço permite cadastrar uma URL que será notificada sempre que ocorrer um evento associado a
> um tipo de movimento. O webhook pode ser configurado para o período de movimentação atual (D0).
>
> **Parameters**
>
> | Name | Description |
> |---|---|
> | `webhook` **\*** — `object` *(body)* | Informações do webhook para o cadastro. |
>
> Parameter content type: `application/json`
>
> ```json
> {
>   "url": "https://webhook.com",
>   "codigoTipoMovimento": 7,
>   "codigoPeriodoMovimento": 1,
>   "email": "string"
> }
> ```
>
> **Responses** — content type `application/json`
>
> `201` — Webhook cadastrado com sucesso.
>
> ```json
> { "resultado": { "idWebhook": 1234 } }
> ```
>
> `400` — Erro de negócio · `406` — Possíveis erros de inconsistência nos dados passados ·
> `500` — Erro interno — os três com o mesmo corpo:
>
> ```json
> { "mensagens": [ { "mensagem": "string", "codigo": "string" } ] }
> ```

### 6.2 Implementação atual — verbatim, com localização

**Montagem do corpo** — `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1438`:

```ts
function comporCadastroDaEntrega(
  enderecoDaEntrega: string,
  numeroDoCliente: number,
): CorpoDoPedido {
  const corpo = {
    url: enderecoDaEntrega,
    numeroCliente: numeroDoCliente,
    codigoTipoMovimento: TIPO_DE_MOVIMENTO_DA_ENTREGA,
    codigoPeriodoMovimento: PERIODO_DE_MOVIMENTO_DA_ENTREGA,
  };

  return { tipoDeMidia: TIPO_DE_JSON, bytes: Buffer.from(JSON.stringify(corpo), 'utf8') };
}
```

**A operação** — `:2031`:

```ts
cadastrarEntrega(entrega: EntregaParaCadastrar): Promise<ResultadoDaOperacaoDeEntrega> {
  return executarEntrega(
    entrega,
    (enderecoDaEntrega) => ({
      metodo: METODO_DE_ENVIO,                                   // 'POST'
      caminho: RECURSO_DAS_ENTREGAS,                             // '/cobranca-bancaria/v3/webhooks'
      corpo: comporCadastroDaEntrega(enderecoDaEntrega, entrega.identidade.numeroDoCliente),
    }),
    // O provedor aceitou o pedido, e é só isso que se sabe. Quem **confirma** que a entrega está
    // de pé é `consultarEntrega`, e é ela que prevalece (RN-05) — ler qualquer coisa do corpo
    // aqui para decidir mais que isso seria escrever regra de negócio no adaptador.
    () => ({ aceito: true }),
  );
}
```

O despacho por código HTTP é o mesmo do `GET` (`executarEntrega`, `:1928`): `< 400` confirma,
`>= 400` vira motivo canônico.

### 6.3 O que CONFERE — e que você **não deve tocar**

| Item da documentação | Implementação | Observação |
|---|---|---|
| Método `POST`, recurso `/cobranca-bancaria/v3/webhooks` | `METODO_DE_ENVIO` + `RECURSO_DAS_ENTREGAS` | ✅ |
| Campo `url` | `url: enderecoDaEntrega` — nome idêntico | ✅ |
| Campo `codigoTipoMovimento: 7` | `TIPO_DE_MOVIMENTO_DA_ENTREGA` | ✅ |
| Campo `codigoPeriodoMovimento: 1` (D0) | `PERIODO_DE_MOVIMENTO_DA_ENTREGA` | ✅ **confirmado pela doc** |
| `Content-Type: application/json` | `TIPO_DE_JSON` | ✅ |
| `201` é sucesso | `201 < MENOR_CODIGO_DE_RECUSA` → confirma | ✅ funciona; ver **P5** |
| Erros `{"mensagens":[{codigo,mensagem}]}` | `objetoDaRecusa` + `lerMotivoDaRecusa` | ✅ campo a campo |

⚠️ **A decisão de `cadastrarEntrega` NÃO ler o corpo para DECIDIR está certa e deve ser preservada.**
O comentário no ponto é correto: quem confirma é a consulta (RN-05), e interpretar o corpo do cadastro
para decidir mais que *"o pedido foi aceito"* seria escrever regra de negócio no adaptador. O **P4**
abaixo é sobre **reter** um identificador, que é coisa diferente de **decidir** com ele — não confunda
as duas, e não use o P4 como pretexto para reabrir esta decisão.

### 6.4 Os defeitos, qualificados

#### **P1 — ALTO · campo inexistente no contrato**

O corpo enviado carrega **`numeroCliente`**, que **não consta** do modelo documentado. O contrato do
provedor tem exatamente quatro campos: `url`, `codigoTipoMovimento`, `codigoPeriodoMovimento` e
`email`.

É o **mesmo defeito do `D3`** do §5.4, na outra ponta — e aqui ele é **mais perigoso**, por dois
motivos: (a) é corpo JSON, onde validação estrita é muito mais provável do que em query string; e
(b) é o ato que o Admin dispara pela tela, de forma síncrona, esperando o desfecho na resposta. Um
`406` aqui significa que **o cadastro nunca conclui** — e é justamente o `CA-20`, que segue pendente.

#### **P2 — ACHADO SEMÂNTICO · o webhook é por CONTA, não por cliente — e o desenho sobrevive**

A ausência de `numeroCliente` no contrato revela algo que o produto supunha diferente: **o cadastro é
escopado ao cooperado autenticado** (mTLS + token), e não a um cliente dentro da conta. O docblock de
`comporCadastroDaEntrega` afirma hoje o contrário, por escrito:

> *"o **para quem** é do ato — o número do cliente que a entrega endereça, que chega pela identidade
> da empresa perante o provedor."*

Essa frase está **errada** à luz da documentação, e precisa ser corrigida.

⚠️ **MAS NÃO "CONSERTE" O DESENHO POR CAUSA DISTO.** Verifique antes de agir: o caso real que o
`.claude/plans/plano-saas.md:170` registra — *"duas empresas do mesmo dono podem receber na mesma
conta Sicoob"* — continua **corretamente atendido**, e por três razões que se somam:

1. a URL de entrega é **do processo**, uma só para todas as empresas (é o que o próprio docblock diz
   do *"para onde"*, e essa metade está certa);
2. cadastro recusado por vaga ocupada **+** consulta positiva ⟹ `habilitada: true` é exatamente a
   RN-05, e ela já está implementada;
3. o roteamento da notícia recebida é por **`seuNumero`** (decisão 24), que é nosso e carrega a
   empresa — não pelo cadastro do webhook.

Com a correção do `D2` do §5.5.2 (comparar a `url`), a segunda empresa na mesma conta encontra o
webhook da primeira com **a mesma URL**, confirma, e fica habilitada. **O comportamento correto sai de
graça.** O que muda é só a **explicação** — e explicação errada no docblock é o que produz a próxima
regressão de decisão (R3).

**O que fazer:** corrigir o docblock para dizer o que é verdade — o cadastro é por conta, o
`numeroCliente` sai, e a multi-empresa na mesma conta é resolvida pela consulta e pelo roteamento.

#### **P3 — MÉDIO · campo documentado que o produto não envia**

O `email` consta do modelo e o produto **não o envia**. A ausência já está declarada por escrito no
docblock de `comporCadastroDaEntrega` (*"o produto não modela em lugar nenhum (…) inventar um valor
faria o produto cadastrar, na conta do cliente, um contato que ninguém escolheu"*), e essa
justificativa **continua boa**.

⚠️ **Duas coisas novas que a documentação acrescenta, e que mudam o peso do débito:**

1. A documentação **não marca o `email` como obrigatório** — só o objeto `webhook` leva o asterisco.
   Logo, omiti-lo é provavelmente legítimo. *Provavelmente* não é *comprovadamente*: se ele for
   exigido na prática, o cadastro falha com `406`, e o sintoma seria indistinguível do **P1**.
2. A resposta do `GET` devolve `email`, e o exemplo de inativação traz
   `descricaoMotivoInativacao: "Erro ao enviar notificação"`. A leitura natural é que **é por esse
   e-mail que o provedor avisa quando desativa o webhook**. Sem ele, a inativação é **silenciosa** —
   o que é precisamente o cenário do **D1 crítico** do §5.4.

**Recomendação (conservadora, e é a que você deve adotar sem perguntar):** mantenha a ausência — não
invente contato na conta do cliente —, mas **registre débito com gatilho** na forma da §3-B, com o
gatilho sendo *"o `CA-20` (cadastro real) recusar por ausência de contato, **ou** o produto passar a
modelar um contato operacional da empresa"*. Anote a ligação com o D1 no corpo do débito: **é a
correção do D1 que substitui o aviso por e-mail que hoje não chega.**

#### **P4 — MÉDIO · a fonte do `D4` — o `idWebhook` é entregue e descartado**

O `201` devolve `{"resultado": {"idWebhook": 1234}}`. O `cadastrarEntrega` **ignora o corpo inteiro**.
É aqui que o identificador do cadastro passa pela mão do produto e é jogado fora — e é por isso que o
`D4` do §5.4 existe.

Ver a advertência do §6.3: **reter não é decidir.** Guardar o `idWebhook` não viola a decisão do
ponto, porque nada passaria a ser decidido por ele; o custo é modelo e migração.

**Recomendação:** mantenha a **mesma** decisão do `D4` — registre como débito com gatilho, e só
implemente a retenção se a correção do `D1`/`D2` já obrigar a tocar o modelo canônico. Se você
registrar os dois débitos (P3 e P4), eles são **um débito cada**, com números próprios na §2 da fatia,
e **duas linhas** no índice do `CLAUDE.md`.

#### **P5 — BAIXO/prova · a fixture responde `200` onde o provedor responde `201`**

`packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:2412` responde `{ codigo: 200, … }` a
**todas** as chamadas de entrega não invalidadas — cadastro incluído. O provedor documenta **`201`**
para o cadastro. Os dois passam pela guarda `< 400`, então o caso é verde — mas a prova não reflete a
realidade, e uma futura leitura do código de sucesso quebraria em silêncio.

#### **P6 — BAIXO/prova · o envelope tem forma DIFERENTE em cada operação — e a fixture só cobre uma**

Este é o item que exige mais cuidado ao corrigir, porque interage com o **`D5`** do §5.4:

| Operação | Forma documentada de `resultado` |
|---|---|
| `POST` (cadastro) | **objeto** — `{"resultado": {"idWebhook": 1234}}` |
| `GET` (consulta) | **array** — `{"resultado": [ { … } ]}` |

A fixture atual usa **objeto para as duas**, porque hoje uma única resposta serve todas as chamadas de
entrega. Ela casa com o `POST` e **não** casa com o `GET`.

⚠️ **Ao corrigir o `D5`, NÃO migre a resposta do cadastro para array.** Separe a fixture **por
operação** — método e/ou presença de query string —, e deixe cada uma na forma que a documentação do
seu endpoint declara. Trocar as duas por array introduziria um erro novo no lugar do antigo, e a suíte
continuaria verde porque o `corpoUtil` aceita ambas.

#### **P7 — BAIXO/escrituração · quatro referências a um marcador que não existe mais**

Descoberto durante esta análise, e alheio ao contrato do provedor — mas registrado aqui porque **vai
te atrapalhar enquanto você trabalha nestes arquivos**.

Quatro docblocks de `packages/cobranca-bancaria/src/adaptador-sicoob.ts` (linhas **44**, **204**,
**1404** e **1496**) remetem ao *"`DÉBITO COM GATILHO` de `criarAdaptadorSicoob`"*. **Esse marcador não
existe no arquivo** — `grep -n "DÉBITO COM GATILHO" packages/cobranca-bancaria/src/adaptador-sicoob.ts`
devolve apenas as quatro **referências**, e nenhuma declaração. Ele foi removido quando o débito
fechou, e as remissões ficaram.

Pior, uma delas está **factualmente vencida**: o docblock de `comporPedidoDeCredencial` (`:1400-1404`)
afirma *"Falta aqui o identificador da aplicação perante o provedor"*, e a função logo abaixo **envia**
`client_id: identificadorDaAplicacao` — com comentário no próprio corpo dizendo que isso foi o
*"fechamento do `D36 · F4/T10`, em 2026-08-20"*.

É a mesma classe de mentira que a §3-B da rule antirregressão descreve para o marcador órfão, na
direção contrária: **ponteiro para registro que não existe**.

**O que fazer:** corrija as quatro remissões — a de `comporPedidoDeCredencial` deve dizer que o
identificador **é enviado** e citar o fechamento do `D36`; as demais devem apontar para onde o assunto
delas de fato vive hoje, ou perder a remissão se o assunto já fechou. **Não invente um marcador novo
para satisfazer as remissões.** Isto é escrituração — classifique como **BAIXO**, e não deixe atrasar
o P1.

### 6.5 A correção pedida

1. **Remova `numeroCliente` do corpo do cadastro** (fecha P1). O contrato tem quatro campos; envie os
   três que o produto tem. Isso torna `comporCadastroDaEntrega` uma função de **um** parâmetro — ajuste
   a assinatura e o ponto de chamada em `cadastrarEntrega`.
2. **Corrija o docblock** de `comporCadastroDaEntrega` (fecha P2), conforme o §6.4/P2. A frase do
   *"para quem"* sai; entra a explicação correta, com a nota de que a multi-empresa na mesma conta é
   atendida pela consulta e pelo roteamento por `seuNumero`.
3. **Registre os débitos** do P3 (`email`) e do P4 (`idWebhook`), cada um com marcador na forma
   canônica da §3-B, `ÍNDICE` apontando para a §2 do `run-report` da fatia, e **uma linha cada** no
   bloco do `CLAUDE.md`.
4. **Corrija as quatro remissões** do P7.
5. **Fixtures e casos** — ver o §6.6.

⚠️ **O P1 e o `D3` do §5.5.3 são o mesmo defeito e devem cair juntos, no mesmo commit.** Corrigir só
um lado deixa o produto enviando `numeroCliente` numa ponta e não na outra, o que é pior que os dois
errados: quem ler depois vai supor que a diferença é deliberada.

### 6.6 Provas exigidas

Mesma casa e mesma disciplina do §5.7 — literais do provedor por extenso, nunca derivados do fonte.

| # | Arranjo | Esperado | O que discrimina |
|---|---|---|---|
| I | Cadastro emitido | o corpo JSON tem **exatamente** as chaves `url`, `codigoTipoMovimento`, `codigoPeriodoMovimento` — e **não** contém `numeroCliente` | **É a asserção que discrimina o P1.** Afirme por **igualdade do conjunto de chaves**, não por `not.toHaveProperty('numeroCliente')`: a igualdade também pega a chave a mais que ninguém previu |
| J | `201` + `{"resultado":{"idWebhook":1234}}` | `{ aceito: true }` | Prova o código e a forma reais do cadastro (fecha P5 e metade do P6) |
| K | `400` + `{"mensagens":[{"codigo":"…","mensagem":"…"}]}` — vaga ocupada | `aceito:false` com motivo canônico verbatim, `diagnostico` íntegro | Preserva o comportamento que o `CT-1043` já prova; garante que a mudança de corpo não afetou o caminho de recusa |
| L | Cadastro recusado **+** consulta positiva com a **nossa** `url` e registro **ativo** | o serviço grava `habilitada: true` | **É o caso que prova o P2** — a multi-empresa na mesma conta continua funcionando depois de tudo. Casa: `apps/api/test/entrega-da-noticia.e2e.spec.ts` |

Os quatro são **comportamentais**: declare em uma linha, por caso, qual asserção discrimina, e **não
execute mutantes** (rule antirregressão, P4, e `testing-stack.md`).

⚠️ **Ao separar a fixture por operação** (P6), acrescente uma asserção que prove a separação — por
exemplo, que a chamada de cadastro recebeu `201` com envelope-objeto e a de consulta recebeu `200` com
envelope-array. Sem isso, a separação é invisível e a próxima edição a desfaz.

### 6.7 O que **NÃO** fazer

1. **Não faça `cadastrarEntrega` decidir pelo corpo da resposta.** A decisão registrada no ponto está
   certa (§6.3) e não é o que o P4 pede.
2. **Não invente um valor para `email`.** Nem string vazia, nem endereço do processo, nem o do Admin.
   Registre o débito e siga.
3. **Não redesenhe a multi-empresa** por causa do P2. Leia o §6.4/P2 inteiro antes de tocar em
   qualquer coisa: o comportamento já está correto, e o que está errado é a explicação.
4. **Não migre a fixture do cadastro para array** ao corrigir o `D5` (P6).
5. **Não crie marcador novo** para satisfazer as remissões órfãs do P7.

**FECHADO em 2026-08-22** — `P1` (o `numeroCliente` do corpo), `W2`/`P3` (o `email`, agora exigido na
partida dos dois processos), `P2` (o docblock do *"para quem"*), `P5` e metade do `P6` (a fixture
separada por operação, com `201`+objeto no cadastro e `200`+array na consulta) e `P7` (as quatro
remissões órfãs). `P4` mantido como débito e **emendado** pelo `A4` → `D44`.

---

## 7. ENDPOINT 3 — `PATCH /cobranca-bancaria/v3/webhooks/{idWebhook}` (atualizar webhook)

> ⚠️ **Esta seção é a mais importante do arquivo, e não por ser a maior.** Ela contém (a) uma
> **premissa do produto que a documentação REFUTA**, escrita por extenso num docblock de porta; e
> (b) a descoberta de que **a correção prescrita no §5.5.1 está incompleta e, sozinha, produziria um
> defeito novo**. O §7.4/A3 emenda o §5. **Leia-o antes de executar qualquer coisa do §5.**

### 7.1 Documentação oficial do provedor — verbatim, como o usuário a forneceu

> **`PATCH /webhooks/{idWebhook}`** — Atualizar um webhook cadastrado.
>
> Serviço de atualização de webhook. **Ao modificar a URL, a situação do webhook será automaticamente
> alterada para '1 - Aguardando validação' e permanecerá assim até que a nova URL seja validada com
> sucesso.**
>
> **Parameters**
>
> | Name | Description |
> |---|---|
> | `idWebhook` **\*** — `integer($int64)` *(path)* | Identificador único do webhook. |
> | `webhook` **\*** — `object` *(body)* | Informações do webhook para atualização. |
>
> Parameter content type: `application/json`
>
> ```json
> { "url": "https://webhook.com", "email": "string" }
> ```
>
> **Responses**
>
> `204` — Webhook atualizado com sucesso. *(sem corpo)*
>
> `400` — Erro de negócio · `406` — Possíveis erros de inconsistência nos dados passados ·
> `500` — Erro interno — os três com `{ "mensagens": [ { "mensagem": "string", "codigo": "string" } ] }`

### 7.2 Implementação atual

**Não existe.** O produto tem duas operações de entrega — `cadastrarEntrega` e `consultarEntrega` — e
nenhuma capacidade de atualizar cadastro. Não há função, não há constante, não há caso de teste.

O que existe no lugar é uma **afirmação explícita de que essa operação não deve existir**, em
`packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts:49-52`:

```
 * ⚠️ **Não existe `desabilitarEntrega`, e a ausência é registro — não omissão.** O provedor não
 * oferece a operação, e o produto não modela o que não pode cumprir: declarar uma terceira assinatura
 * sem quem a implemente publicaria uma promessa que nenhuma chamada cumpre. Pelo mesmo critério, nada
 * aqui altera, substitui ou remove cadastro de terceiro — o produto cadastra **o seu** e o lê.
```

### 7.3 O que a documentação CONFIRMA e o que ela REFUTA

**Confirma:** a cláusula final está certa e deve ser preservada — *"nada aqui altera, substitui ou
remove cadastro de terceiro"*. Um `PATCH` sobre webhook que **não é nosso** continua proibido, e a
correção do `D2` (comparar a `url`) é justamente o que torna essa distinção verificável.

**Refuta:** *"O provedor não oferece a operação"* é **falso**. O provedor oferece `PATCH`, e — pela
lista do plano — também `DELETE`, `/reativar` e `/solicitacoes`.

### 7.4 Os defeitos, qualificados

#### **A1 — ALTO · premissa factual refutada, escrita em porta de domínio**

A frase *"O provedor não oferece a operação"* é uma afirmação sobre a API de terceiro, registrada num
docblock de porta, e ela é falsa.

⚠️ **E não é falha de informação disponível.** O `.claude/plans/plano-saas.md:345` — commit inicial,
2026-07-30 — já dizia, por extenso:

> **Gestão do webhook:** `POST/GET/PATCH/DELETE /webhooks`, `/reativar` e `/solicitacoes`.

A premissa foi escrita **contra informação que já estava no repositório**. Isto é exatamente o
corolário que o `CLAUDE.md` registra como precedente de método, e que ele diz ter custado duas fases:

> *a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela
> justifica — meça a premissa antes de registrá-la.*

**Por que é ALTO e não escrituração:** premissa falsa em docblock de porta é **regressão de decisão
(R3) latente**. Ela não quebra nada hoje; ela garante que o próximo agente que precisar de `PATCH` leia
*"o provedor não oferece"* e desista, ou pior, gaste uma rodada provando o óbvio. É o tipo de defeito
que a §1 da rule antirregressão descreve como *"o mais caro, e a razão deste arquivo existir"*.

**Corrija a frase**, preservando a cláusula que continua verdadeira (§7.3). Não apague a advertência
inteira — ela protege o cadastro de terceiro, que é real.

#### **A2 — ALTO · a correção do `D2`, sozinha, cria um IMPASSE OPERACIONAL**

Cenário, com o `D2` do §5.5.2 já corrigido e sem `PATCH`:

1. o endereço da borda muda — e isto **não é hipotético**: o hostname é a `[DÚVIDA] 4`, **ainda
   aberta**, e o `CA-20` nunca rodou. O primeiro cadastro real será feito com um hostname que o
   usuário ainda não fixou;
2. o Admin clica em ativar → `POST` → o provedor recusa: **a vaga já está ocupada** pelo cadastro
   antigo;
3. o serviço consulta → o registro existe, mas a `url` dele é **a antiga** → não confirma;
4. grava `habilitada: false`;
5. o Admin clica de novo → volta ao passo 2. **Para sempre.**

Não há, em nenhum lugar do produto, ato que altere o cadastro existente. **O único caminho de saída
seria o portal do provedor**, fora do sistema — que é precisamente o que a fatia
`integracao-bancaria-autonoma` existe para eliminar (o `CLAUDE.md` a define como *"a ativação do
webhook **por tenant** (…), a coisa que hoje **exige terminal**"*).

⚠️ **Note a inversão:** hoje, **sem** a correção do `D2`, esse cenário "funciona" — a consulta acha
qualquer registro e confirma. É um falso positivo, e ruim. Mas corrigir o `D2` **sem** dar caminho de
atualização troca um falso positivo por um **beco sem saída**, que é pior: o falso positivo pelo menos
entrega a notícia se a URL antiga ainda responder; o impasse não entrega nada e não tem conserto pela
tela.

**Consequência para o plano de trabalho: o `D2` e o `A2` são um único trabalho.** Não entregue o `D2`
sem caminho de atualização.

#### **A3 — CRÍTICO · EMENDA AO §5.5.1 — a correção do `D1`, como prescrita, quebraria TODA ativação nova**

Este é o achado que muda o desenho, e ele vem de uma frase da documentação do `PATCH`:

> *"Ao modificar a URL, a situação do webhook será automaticamente alterada para
> **'1 - Aguardando validação'** e permanecerá assim até que a nova URL seja validada com sucesso."*

Três coisas se seguem, e nenhuma delas estava no §5:

**(i) Existe uma máquina de estados, e agora conhecemos dois valores** — `1 = Aguardando validação` e
`3 = Validado com sucesso`. O §5.5.1 afirma que *"`codigoSituacao: 3` é o único valor que a
documentação nomeia"*. **Isso está superado por esta seção**: são dois. Os demais seguem
desconhecidos, e a conduta conservadora do §5.5.1 continua valendo para eles.

**(ii) O `1` não é ativo nem morto — é uma TERCEIRA condição, e ela é TRANSITÓRIA.** Um webhook em
validação não está entregando ainda, mas vai estar. Classificá-lo como ativo é falso positivo;
classificá-lo como inativo é falso negativo.

**(iii) — e é aqui que a prescrição do §5 quebra — o cadastro NOVO quase certamente nasce em `1`.**
A validação de endereço do provedor é justamente o `{"idWebhook":N,"validacaoWebhook":true}` que ele
envia **para a URL cadastrada**, e que a rota `POST /v1/notificacoes-bancarias` já responde com `204`
(classificação `VALIDACAO_DE_ENDERECO`, `packages/cobranca-bancaria/src/tratamento-de-notificacao.ts`).
Isso é assíncrono **por construção**: no instante em que o `POST /webhooks` retorna `201`, a validação
ainda não aconteceu.

**Portanto:** se você implementar o §5.5.1 exigindo `codigoSituacao === 3` na consulta que corre
**imediatamente após** o cadastro, **toda ativação nova termina em `habilitada: false`** — o Admin
clica, o cadastro é criado com sucesso no provedor, e a tela diz que falhou. Você teria trocado um
falso positivo por um **falso negativo em 100% dos casos**, que é regressão pior que o defeito
original.

⚠️ **Consequência vinculante: o `D1` NÃO pode ser corrigido sem o terceiro desfecho do `D35`
(§5.5.5).** O que era "fecha junto porque o gatilho disparou" passa a ser **pré-requisito
técnico**. A ordem de implementação é: terceiro desfecho primeiro, `D1` depois.

**E a peça que fecha o ciclo já existe:** `apps/worker/src/tarefas/reconferencia-da-entrega.ts` é uma
reconferência **periódica**. O desenho correto é: a ativação devolve *"em validação"*, e a
reconferência promove para *"habilitada"* quando a situação virar `3`. Nenhuma peça nova, nenhuma
rota nova.

#### **A4 — MÉDIO · o `idWebhook` deixa de ser conveniência e vira pré-requisito — mas NÃO precisa ser persistido**

O `PATCH` exige `idWebhook` **no path**. Sem ele não há atualização. Isso eleva o `D4` (§5.4) e o `P4`
(§6.4), que recomendavam apenas registrar débito.

⚠️ **A recomendação anterior NÃO precisa ser revertida, e a razão é concreta:** o `GET` **devolve** o
`idWebhook`, e o fluxo de atualização **já passa por uma consulta** (é ela que descobre que a `url`
divergiu). Logo:

```
consultar → achou registro nosso com url divergente → PATCH com o idWebhook que a consulta trouxe
```

**Nenhuma coluna nova, nenhuma migração, nenhum estado do provedor persistido no produto.** O
`idWebhook` vive o tempo do ato, como o material decifrado do certificado já vive (D6-b). Isto é
estritamente melhor que persistir: identificador de terceiro guardado é mais uma coisa que pode ficar
obsoleta em silêncio.

**Mantenha, portanto, o `D4`/`P4` como débito** — mas **emende o corpo deles** para registrar que o
gatilho de *"reter o identificador"* foi **examinado e recusado por desenho**, com esta razão. Débito
cuja justificativa mudou e não foi reescrita é o que a §3-B chama de índice que apodrece.

#### **A5 — forma da operação, para quem for implementá-la**

| Aspecto | Valor | Contraste |
|---|---|---|
| Sucesso | **`204`**, sem corpo | ≠ `201` com corpo do `POST` |
| Corpo enviado | **só** `url` e `email` | **não** aceita `codigoTipoMovimento` nem `codigoPeriodoMovimento` |
| `idWebhook` | **path**, não query, não corpo | ≠ `GET`, onde é query |
| Erros | `400`/`406`/`500` com `mensagens[]` | idêntico aos outros dois — reusa `lerMotivoDaRecusa` |

⚠️ O `204` sem corpo **já é tratado corretamente** por `executarEntrega` (`204 < 400` → confirma), mas
o confirmador do `PATCH` **não deve** chamar `corpoUtil`: não há corpo, e a confirmação real vem da
consulta seguinte, não desta resposta. Espelhe o que `cadastrarEntrega` já faz — `() => ({ aceito: true })`
—, pela mesma razão que o §6.3 declara.

### 7.5 A correção pedida

**Decisão de escopo, adotada sem perguntar** (rule de autonomia, A1 — registre-a no seu relatório).
⚠️ **Ela é compatível com a restrição do §0.1, e não a contraria:** o `PATCH` é **mecanismo interno da
ativação**, nunca um ato de tela. O frontend continua com **um** botão e **duas** rotas.

> **Implementar a terceira operação.** As alternativas eram (a) não implementar e reverter o `D2`, que
> reintroduz o falso positivo que motivou todo este trabalho; (b) não implementar e aceitar o impasse
> do `A2`, que quebra a autonomia que a fatia F5 existe para entregar; (c) implementar. **Adotada a
> (c)**, porque o `D2` sem ela é entrega pela metade, e porque a premissa que a proibia é falsa (`A1`).

Passos:

1. **Corrija a premissa** em `porta-de-entrega-da-noticia.ts` (fecha A1), preservando a cláusula do
   cadastro de terceiro.
2. **Declare a terceira operação na porta** — nome no vocabulário do produto (`atualizarEntrega` ou
   equivalente; **não** use termo do provedor), com o mesmo contrato absoluto das outras duas:
   **resolve sempre, nunca rejeita**.
3. **Implemente-a no adaptador**: `PATCH` no recurso com o identificador no caminho, corpo com `url`
   (e `email` só se o `P3` tiver sido resolvido), confirmador que não lê corpo.
4. **Feche o ciclo no serviço**, dentro da rota de ativação **que já existe** — `POST
   /v1/…/entrega-da-noticia/ativacao`:
   `cadastrar → (recusado) → consultar → achou o nosso com url divergente → atualizar → consultar`.
5. **Implemente o terceiro desfecho ANTES do `D1`** (A3), contemplando os três estados que agora
   conhecemos: em validação · ativo · inativo/ausente. Propague-o ao serviço e à reconferência do
   worker.
6. **Emende o corpo dos débitos `D4`/`P4`** conforme o `A4`.

⚠️ **NENHUMA ROTA NOVA.** A superfície publicada é **105 rotas / 90 manipuladores**, e o congelamento
acontece logo após a F5. A atualização entra **dentro** da ativação existente, que é semanticamente o
lugar certo: o Admin pediu *"deixe minha entrega funcionando"*, e corrigir o endereço divergente é
parte de cumprir esse pedido. Se você concluir que precisa de rota nova, **pare e escale** — isso
extrapola o escopo deste arquivo.

### 7.6 O que **NÃO** fazer

1. **Não apague a advertência inteira** do §7.2. A metade sobre cadastro de terceiro é verdadeira e é
   proteção real. Corrija a metade falsa.
2. **Não implemente `DELETE` nem `/reativar`** por conta própria. Eles não estão neste arquivo, e o
   `A1` é exatamente o erro de decidir sobre API de terceiro sem a documentação em mão.
3. **Não `PATCH`e um cadastro cuja `url` não seja a nossa.** É a cláusula preservada do §7.3, e sem a
   correção do `D2` você não tem como saber de quem é o cadastro. **`D2` antes de `A2`.**
4. **Não persista o `idWebhook`** (A4).
5. **Não exija `codigoSituacao === 3` na consulta imediata da ativação** (A3). É o defeito novo que
   esta seção existe para impedir.
6. **Não trate `1 - Aguardando validação` como falha.** É estado normal e esperado de todo cadastro
   recém-criado.

### 7.7 Provas exigidas

| # | Arranjo | Esperado | O que discrimina |
|---|---|---|---|
| M | Cadastro recusado + consulta achando registro nosso com **url divergente** | uma chamada `PATCH` é emitida, no caminho com o `idWebhook` **que a consulta devolveu**, com corpo contendo `url` | **Discrimina o A2** — hoje nenhuma chamada de atualização existe |
| N | Consulta achando registro de **outra** `url`, que **não** é a nossa | **nenhum** `PATCH` é emitido | Preserva a cláusula do cadastro de terceiro (§7.3). Afirme por **ausência de chamada**, com âncora antivácuo provando que as outras chamadas ocorreram |
| O | Cadastro `201` seguido de consulta com `codigoSituacao: 1` | desfecho **em validação** — **não** habilitada, **não** desabilitada | **É a asserção que discrimina o A3.** Falharia com qualquer implementação binária do `D1` |
| P | Reconferência periódica encontrando `codigoSituacao: 3` depois de um `1` | promove para habilitada | Fecha o ciclo assíncrono. Casa: `apps/worker/test/reconferencia-da-entrega.spec.ts` |
| Q | `PATCH` respondido com `204` sem corpo | operação aceita, e **nenhuma** tentativa de ler corpo | Prova o A5 |
| R | `PATCH` respondido com `406` + `mensagens[]` | motivo canônico verbatim, `diagnostico` íntegro | Prova que a terceira operação reusa o tratamento de recusa, sem caminho próprio |

Todos comportamentais: declare a asserção discriminante por caso e **não execute mutantes**.

⚠️ O caso **O** é o mais importante do arquivo inteiro. Se ele não existir, nada impede a próxima
rodada de "simplificar" o terceiro desfecho de volta para binário, e a regressão só apareceria na
primeira ativação real — que ainda não aconteceu nenhuma vez.

**FECHADO em 2026-08-22** — `A1` (a premissa falsa saiu, com a cláusula do cadastro de terceiro
preservada), `A2`, `A3` e `A5`: a porta declara **quatro** operações, e a correção do endereço é
mecanismo interno da ativação, sem rota nova. ⚠️ **`A4` REVERTIDO, com razão declarada**: a referência
**é** persistida. A razão que a recusava era *"nenhuma migração"*, e ela caiu com a autorização — e
sem a referência a linha 5 do quadro é inalcançável, porque não há como provar que um cadastro de
endereço vencido é nosso. Ver o `D44` na §2.

---

## 8. ENDPOINT 4 — `PATCH /cobranca-bancaria/v3/webhooks/{idWebhook}/reativar` (reativar webhook)

> ⚠️ **Esta seção fecha o ciclo de vida e contém o §8.5 — o QUADRO DE DECISÃO ÚNICO.** Ele consolida
> os quatro endpoints numa só tabela e **é a especificação executável da correção**. Se você ler uma
> coisa só deste arquivo antes de programar, leia o §8.5.

### 8.1 Documentação oficial do provedor — verbatim, como o usuário a forneceu

> **`PATCH /webhooks/{idWebhook}/reativar`** — Reativar um webhook inativo.
>
> Serviço de reativação de webhook desativado, restabelecendo o recebimento de notificações.
> **A situação do webhook será atualizada para '1 - Aguardando validação' e permanecerá assim até que
> a URL seja validada com sucesso.**
>
> **Parameters**
>
> | Name | Description |
> |---|---|
> | `idWebhook` **\*** — `integer($int64)` *(path)* | Identificador único do webhook. |
>
> *(sem corpo)*
>
> **Responses**
>
> `204` — Webhook reativado com sucesso. *(sem corpo)*
>
> `400` — Erro de negócio · `406` — Possíveis erros de inconsistência nos dados passados ·
> `500` — Erro interno — os três com `{ "mensagens": [ { "mensagem": "string", "codigo": "string" } ] }`

### 8.2 Implementação atual

**Não existe**, pela mesma razão do §7.2 — e sob a mesma premissa refutada do `A1`.

### 8.3 O que a documentação CONFIRMA

**(i) A suspeita do §7 estava certa, e o impasse era real.** Existe operação **dedicada** para
reativar. Logo, o `PATCH` de atualização **não** é o caminho de volta do estado inativo, e um produto
que só tivesse `POST` + `GET` + `PATCH` continuaria sem saída quando o provedor inativasse o webhook —
que é exatamente o cenário do `D1` crítico.

**(ii) A máquina de estados se confirma, e ela CONVERGE.** Os **três** atos corretivos levam ao mesmo
lugar:

| Ato | Situação resultante |
|---|---|
| `POST` — cadastro novo | `1 - Aguardando validação` (inferido; ver §7.4/A3) |
| `PATCH` — modificar URL | `1 - Aguardando validação` (**documentado**) |
| `PATCH …/reativar` | `1 - Aguardando validação` (**documentado**) |

Isto é uma confirmação forte do desenho do `A3`: **o desfecho *"em validação"* não é caso de borda de
um endpoint — é o estado normal de saída de TODA ação corretiva do produto.** Quem o tratar como
exceção vai reescrevê-lo três vezes.

**(iii) A validação é sempre a mesma, e o produto já a atende.** *"Permanecerá assim até que a URL
seja validada"* — a validação é o `{"idWebhook":N,"validacaoWebhook":true}` que o provedor envia à URL
cadastrada, e a rota `POST /v1/notificacoes-bancarias` já o responde com `204`
(`tratamento-de-notificacao.ts`, classificação `VALIDACAO_DE_ENDERECO`). **Nenhuma peça nova é
necessária do lado que recebe.**

### 8.4 Forma da operação

| Aspecto | Valor | Nota |
|---|---|---|
| Método | `PATCH` | mesmo verbo do §7, caminho diferente |
| Caminho | `{recurso}/{idWebhook}/reativar` | ⚠️ `reativar` é **vocabulário do provedor** — constante nomeada no adaptador, como `RECURSO_DAS_ENTREGAS`; **não** vaza pela porta |
| Corpo | **nenhum** | não monte `CorpoDoPedido` |
| Sucesso | `204`, sem corpo | o confirmador **não** chama `corpoUtil` (§7.4/A5) |
| Erros | `400`/`406`/`500` com `mensagens[]` | reusa `lerMotivoDaRecusa`, sem caminho próprio |

### 8.5 QUADRO DE DECISÃO ÚNICO — a especificação executável da correção

Tudo que os quatro endpoints exigem cabe aqui. **A consulta é sempre o primeiro passo e é sempre ela
que decide** (RN-05, e agora com muito mais razão do que quando a regra foi escrita).

| # | O que a consulta encontrou | Ato | Desfecho gravado |
|---|---|---|---|
| 1 | **nenhum** cadastro (`204`, `resultado` vazio, corpo ausente) | `POST` cadastrar | **em validação** |
| 2 | cadastro **nosso** (url casa), situação **`3`**, não inativado | *nenhum* | **habilitada** |
| 3 | cadastro **nosso** (url casa), situação **`1`** | *nenhum* — **já está no caminho** | **em validação** |
| 4 | cadastro **nosso** (url casa), **inativado** | `PATCH …/reativar` | **em validação** |
| 5 | cadastro nosso pelo `idWebhook`, mas **url divergente** | `PATCH` atualizar url | **em validação** |
| 6 | cadastro de **terceiro** (url não é nossa, e não é cadastro que este produto criou) | *nenhum* — **proibido tocar** (§7.3) | **desabilitada**, com motivo |
| 7 | o provedor **não respondeu** | *nenhum* | **indeterminado** — ⚠️ **NÃO grave `desabilitada`** (é o `D35`) |

**Três leituras que este quadro fixa, e que valem mais que o quadro:**

1. **O desfecho é ternário, não binário** — habilitada · em validação · desabilitada — mais o
   **indeterminado** do `D35`, que não é desfecho e sim ausência de leitura. Um `boolean` não comporta
   isto, e é por isso que o `D1` não pode ser corrigido antes do terceiro desfecho (§7.4/A3).
2. **Nenhuma linha grava `desabilitada` por falta de resposta.** Só a linha 6 desabilita, e ela tem
   causa conhecida e nomeável.
3. **Um ato corretivo por ativação, no máximo.** As linhas 1, 4 e 5 são mutuamente exclusivas por
   construção do quadro. Nada encadeia dois atos numa chamada.

#### 8.5.1 A ORDEM entre a linha 4 e a linha 5 — quando as duas condições valem juntas

Um cadastro pode estar **inativado E com url divergente** ao mesmo tempo. **A precedência é a linha 5:
corrija a URL primeiro.**

A razão é concreta, não estilística: reativar mantém a URL antiga, e o provedor então tentaria validar
**a URL errada** — falharia, e inativaria de novo. **Reativar com a URL errada é garantidamente
inútil**, e produz um ciclo de reativação/inativação. Corrigir a URL, ao contrário, já leva a situação
para `1` sozinho (documentado no §7.1), e pode tornar a reativação desnecessária.

⚠️ **Isto é hipótese fundamentada, não medição.** Não sabemos se o `PATCH` de atualização é aceito
sobre um webhook **inativo** — a documentação não diz. Se ele recusar com `400`, a ordem se inverte.

**Conduta:** implemente a precedência acima, e **registre débito com gatilho** nomeando a incerteza,
com o gatilho sendo *"a primeira ocorrência real de cadastro inativo com url divergente, ou o `CA-20`
medindo o comportamento do `PATCH` sobre inativo"*. Nunca escreva no docblock que o provedor aceita —
seria repetir exatamente o erro do `A1`.

#### 8.5.2 O que fecha o ciclo é a reconferência que JÁ EXISTE

Nenhum ato do quadro devolve **habilitada** imediatamente, exceto a linha 2. Isso é correto e é a
natureza do provedor: a validação é assíncrona. Quem promove *em validação → habilitada* é
`apps/worker/src/tarefas/reconferencia-da-entrega.ts`, que já roda periodicamente e já consulta.

**Não construa mecanismo de espera, sondagem ou repetição dentro da rota de ativação.** O Admin recebe
*"em validação"*, e a tela reflete o estado quando ele voltar. Sondar em linha seguraria a resposta
HTTP esperando ato de terceiro, que é o que a ADR-0029 rejeita.

### 8.6 A correção pedida (acréscimo ao §7.5)

7. **Declare a quarta operação na porta** — vocabulário do produto, contrato absoluto (resolve sempre,
   nunca rejeita), como as outras três.
8. **Implemente-a no adaptador**: `PATCH` no caminho com sufixo do provedor, **sem corpo**,
   confirmador que não lê corpo.
9. **Implemente o §8.5 como a lógica da ativação**, dentro da rota que já existe.
10. **Registre o débito da §8.5.1.**

⚠️ **A restrição do §0.1 continua intacta.** Quatro operações contra o provedor, **um** ato de tela,
**zero** rotas novas. O frontend não sabe que `PATCH` e `/reativar` existem — e não deve saber.

### 8.7 O que **NÃO** fazer

1. **Não reative cadastro de terceiro.** A linha 6 do quadro é proibição, e `/reativar` sobre webhook
   alheio é interferência na conta do cliente — pior que o `PATCH`, porque restabelece entrega para um
   endereço que não é nosso.
2. **Não reative um cadastro que já está em situação `1`.** Linha 3: ele já está no caminho. Reativar
   de novo é ruído contra o provedor e pode reiniciar a janela de validação.
3. **Não trate `204` como "nada aconteceu".** Aqui ele é **sucesso** — e é o mesmo `204` que no `GET`
   significa *"não há registros"*. **São coisas opostas no mesmo código HTTP**, distinguidas apenas
   pela operação. Cada confirmador é responsável pelo seu; não compartilhe um confirmador genérico
   entre `GET` e as operações de escrita.
4. **Não sonde dentro da rota** (§8.5.2).

### 8.8 Provas exigidas

| # | Arranjo | Esperado | O que discrimina |
|---|---|---|---|
| S | Consulta achando cadastro nosso **inativado** (url casa) | uma chamada a `…/{id}/reativar` é emitida, **sem corpo**; desfecho **em validação** | **Discrimina a linha 4.** Hoje nenhuma reativação existe |
| T | Consulta achando cadastro nosso em situação **`1`** | **nenhuma** chamada de escrita; desfecho **em validação** | Discrimina a linha 3 — prova por **ausência**, com âncora antivácuo |
| U | Consulta achando cadastro **inativado** de **outra** url | **nenhuma** chamada a `/reativar`; desfecho **desabilitada** com motivo | Discrimina a linha 6 contra a 4 — é a proteção do cadastro de terceiro |
| V | Consulta achando cadastro nosso **inativado E com url divergente** | a chamada emitida é o `PATCH` de **atualização**, não o de reativação | Discrimina a precedência do §8.5.1 |
| W | `/reativar` respondido com `400` + `mensagens[]` | motivo canônico verbatim, `diagnostico` íntegro | Reuso do tratamento de recusa |
| X | **Cobertura do quadro** — as 7 linhas do §8.5, uma a uma | o desfecho de cada linha | ⚠️ **Exigido como caso único e tabelado.** É o que impede a próxima rodada de colapsar o ternário de volta em booleano |

Todos comportamentais: asserção discriminante declarada por caso, **sem mutantes**.

⚠️ **O caso X é a rede do trabalho inteiro.** Os casos O (§7.7) e X (aqui) são os dois que fazem o
desenho ternário sobreviver a quem não leu este arquivo. Sem eles, a primeira "simplificação" bem
intencionada reabre tudo — e o defeito só apareceria na primeira ativação real, que ainda não
aconteceu nenhuma vez.

**FECHADO em 2026-08-22** — a quarta operação declarada e implementada, e o **quadro §8.5 é a lógica
da ativação**, linha a linha, dentro da rota que já existia. O `CT-1055` o cobre inteiro; o `(c)` mede
a precedência do §8.5.1, e a ressalva de que ela é **hipótese, não medição**, está escrita no ponto e
no `D42` — nada no docblock afirma que o provedor aceita `PATCH` sobre inativo.

---

## 9. O PAYLOAD DA NOTÍCIA RECEBIDA — e as EMENDAS que ele impõe

> 🛑 **Esta seção é de natureza diferente das anteriores.** As §5 a §8 tratam de endpoints que **nós
> chamamos**; esta trata do corpo que o provedor **nos entrega** — a superfície que a §13-A.1 do
> discovery declarou, por escrito, **inauditável**:
>
> > *"Isto prova o caminho de consulta. **Não** prova o payload do webhook, que é a superfície onde a
> > decisão 24 de fato roteia (…) e permanece inauditável."*
>
> **Ela deixou de ser inauditável em 2026-08-22.** E o que a documentação mostrou contém **um defeito
> CRÍTICO no caminho principal do produto** — o `W1` —, que nenhuma das análises anteriores poderia
> ter encontrado.

### 9.1 Documentação oficial — verbatim, como o usuário a forneceu

> Sempre que o Sicoob recebe a confirmação da baixa operacional de um boleto, o sistema integrado
> envia automaticamente uma notificação para uma URL configurada.
>
> **A notificação de validação da URL é enviada sempre que ocorre:** o cadastro de um novo webhook · a
> alteração da URL do webhook · **a reativação de um webhook**.
>
> ```json
> { "idWebhook": 990, "validacaoWebhook": true }
> ```
>
> `url` — **Deve ser https. Porta: 443** · `codigoTipoMovimento` 7 – Pagamento (baixa operacional) ·
> `codigoPeriodoMovimento` 1 – Movimento Atual (D0)
>
> **No cadastro** *(prosa oficial)*: *"é necessário informar o código do movimento, o código do período
> do movimento **e o e-mail**. Um `idWebhook` é gerado para consulta do webhook cadastrado."*
>
> **Códigos HTTP aceitos:** `200` · `201` · `204`. *"Respostas com outros códigos, como `202 Accepted`
> ou `302 Found` (redirecionamento), resultam em falha na validação do webhook."*
>
> **Opções de `codigoMotivoCancelamento`:** 11, 12, 13, 40, 51, 52, 53, 63, 68, 69, 71, 72, 73, 74,
> 75, 77, 82, 83, 85, 86, 87, 88.
>
> **Exemplo de webhook recebido:**
>
> ```json
> {
>   "idWebhook": 214,
>   "tipoMovimento": 7,
>   "dados": {
>     "numeroIdentificadorBaixa": "2024102000741150823",
>     "codigoBarrasBoleto": "75692868200000405001434201006355000002443003",
>     "codigoBarrasBaixa": "75692868200000405001434201006355000002443003",
>     "nossoNumero": "0000002443",
>     "seuNumero": "00-03",
>     "codigoBancoRecebedor": "756",
>     "codigoAgenciaRecebedora": 3069,
>     "numeroCliente": 63550,
>     "cpfCnpjBeneficiario": "00500754977",
>     "codigoTipoPessoaPagador": "F",
>     "nomePagador": "Amanda",
>     "cpfCnpjPagador": "09992004959",
>     "nomeFantasiaPagador": "Amanda",
>     "codigoTipoPessoaPortador": "F",
>     "nomePortador": "João",
>     "cpfCnpjPortador": "09197004979",
>     "valorBoleto": 405,
>     "valorPagamento": 407.41,
>     "codigoCanalPagamento": 3,
>     "codigoMotivoCancelamento": 2,
>     "dataEmissao": "2021-04-19",
>     "dataVencimento": "2021-07-15",
>     "dataLimitePagamento": "2022-01-10",
>     "dataHoraSituacaoBaixa": "2021-07-22T13:45:33.000Z",
>     "baixaRealizadaEmContigencia": false,
>     "cancelamentoBaixa": false
>   }
> }
> ```
>
> **Datas:** todos os campos de data e hora seguem UTC (sufixo `Z`); conversão para o fuso local é
> responsabilidade de quem consome.
>
> **Observação oficial:** *"A baixa operacional não se refere à liquidação final, mas sim do registro
> da intenção de pagamento realizada."*

### 9.2 O que a documentação CONFIRMA — cinco decisões do produto se provaram certas

Registre-as: elas custaram debate, e agora têm evidência externa. **Nenhuma delas deve ser
"simplificada" por quem vier depois.**

| Decisão do produto | O que a documentação prova |
|---|---|
| **Leitura tolerante** (`DECISÃO FECHADA — T4`, `tratamento-de-notificacao.ts:253`) | O payload real tem **~24 campos**; a tech spec da fatia previu **13**. Onze campos que ninguém imaginou — `codigoBancoRecebedor`, `codigoCanalPagamento`, `dataLimitePagamento`, `codigoTipoPessoaPortador`… Com `z.strictObject`, **toda notícia real seria `ILEGIVEL`**. A decisão não foi cautela decorativa: era a diferença entre funcionar e não funcionar |
| **Não ler `codigoMotivoCancelamento`** | A lista oficial tem 22 valores e **não inclui o `2`** — e o **próprio exemplo oficial traz `"codigoMotivoCancelamento": 2`**. A documentação se contradiz. O item 22 do seu plano (*"esclarecer com o Sicoob"*) estava certo, e o produto tratar motivo desconhecido como inócuo é a única conduta que sobrevive a isso |
| **Não ler data nenhuma do aviso** (RN-07) | Todas as datas vêm em UTC com `Z`, e a própria documentação avisa que a conversão é responsabilidade do consumidor. O produto lê datas **só da consulta**, e por isso não tem quarta declaração de fuso (ADR-0026) |
| **Não coagir `numeroIdentificadorBaixa`** | Veio `"2024102000741150823"` — **19 dígitos, como cadeia**. Acima de `MAX_SAFE_INTEGER`. Coagir teria corrompido a chave da idempotência, exatamente como o docblock previu |
| **Responder `204` sem corpo, sem redirecionar** | Confirmado literalmente: `200`/`201`/`204` aceitos, **`302` reprova**. E o risco `R3` da tech spec (*"o provedor pode exigir corpo"*) está **refutado** — só o código importa |

⚠️ **E uma confirmação para o §8:** *"a notificação de validação é enviada no cadastro, na alteração da
URL e **na reativação**"*. São exatamente as três linhas do quadro §8.5 que terminam em *em validação*.
O quadro estava certo antes de ter esta confirmação.

### 9.3 Os defeitos

#### **W1 — CRÍTICO · o `nossoNumero` do webhook tem ZEROS À ESQUERDA, e a conferência compara cadeias por igualdade estrita**

**Este é o defeito mais grave de todo o arquivo.** Ele quebra o caminho principal do produto — a
aplicação do pagamento — e nenhuma das análises anteriores poderia tê-lo encontrado.

**O fato:** o exemplo oficial do webhook traz `"nossoNumero": "0000002443"` — **cadeia, com zeros à
esquerda, 10 posições**. A §13-A.4 do discovery mediu, no **caminho de consulta** (`GET /boletos`),
que o mesmo campo chega como **inteiro** (`2443`), e por isso o produto o **coage para cadeia na
fronteira**.

**As duas medições não se contradizem — elas são de caminhos diferentes, e é isso que produz o
defeito.**

**A cadeia do dano**, com caminho e linha:

1. a emissão grava `numero_do_titulo_no_provedor` a partir da resposta do `POST /boletos`, onde o
   valor chega **inteiro** → coagido → `"2443"`;
2. a notícia chega pelo webhook com `"0000002443"`;
3. `comoCadeiaDeInteiro` (`tratamento-de-notificacao.ts:226`) recebe uma **cadeia**, não um número, e
   a devolve **intacta** — preservando os zeros: `"0000002443"`;
4. `conferirNumeroDoTitulo` (`apps/worker/src/tarefas/notificacao-bancaria.ts:552-561`) compara:

   ```ts
   if (gravado === null || gravado === aviso.numeroDoTituloNoProvedor) { return undefined; }
   return aviso.numeroDoTituloNoProvedor;
   ```

   `"2443" === "0000002443"` é **falso**;
5. o desfecho vira **`DIVERGENTE`** (`:468`), a anomalia é registrada, **e o pagamento não é
   aplicado**.

**Modo de falha: toda notícia legítima é recusada como divergente.** Não é caso de borda — é o
caminho feliz, em 100% das vezes, para todo boleto cujo número tenha qualquer zero à esquerda. E o
formato do provedor é de largura fixa: **quase todos terão**.

⚠️ **Grau de certeza, declarado com honestidade:** isto se apoia no **exemplo oficial** contra uma
**medição real** de outro caminho. Não é impossível que o exemplo esteja simplificado. Mas: (a) a
medição de 3 boletos foi só do `GET`; (b) o webhook nunca recebeu um byte real; (c) o custo de estar
errado é o caminho principal quebrado em produção, e o custo de proteger-se é uma normalização. **A
assimetria de custo decide sozinha.**

**A correção não é "coagir mais".** É **comparar por identidade numérica**, não por igualdade de
cadeia — normalizando os dois lados no ponto da comparação, e **mantendo a gravação como está**.

⚠️ **Duas amarras que você NÃO pode romper ao corrigir:**

1. **O `gravado === null` é protegido pelo `CT-1006`**, que barra o "mutante de duas pernas". *Ausência
   não é divergência* — o `null` é o que `revogarBoleto` produz de propósito. **Normalize apenas o
   ramo de comparação; não toque no ramo de ausência.**
2. **Não normalize na gravação nem no `tratamento-de-notificacao.ts`.** Aparar zeros na entrada
   destruiria o valor tal como o provedor o informou, o que a **ADR-0034** exige preservar. A
   normalização vive **no ponto da comparação**, e só ali.

#### **W2 — ALTO · EMENDA AO §6.4/P3 — o `email` é DECLARADO NECESSÁRIO**

O §6.4/P3 concluiu, do modelo do Swagger, que o `email` era *"provavelmente opcional"* porque só o
objeto `webhook` levava asterisco. **A prosa oficial desta documentação diz o contrário, e ela é mais
específica:**

> *"Para isso, **é necessário informar** o código do movimento, o código do período do movimento **e o
> e-mail**."*

**O `P3` sobe de MÉDIO para ALTO, e deixa de ser débito: vira condição de o cadastro funcionar.** Junto
com o `P1` (`numeroCliente` a mais), o corpo que o produto envia hoje tem **um campo a mais que não
existe e um campo a menos que é exigido** — as duas causas de `406` no mesmo pedido.

⚠️ **E isto NÃO se resolve inventando um endereço**, que continua proibido pelo §6.7/2. O produto
**precisa ter de onde tirá-lo**, e as opções são: (a) um contato operacional da empresa já modelado;
(b) um endereço de configuração do processo; (c) pedir ao Admin na tela da ativação.

⚠️ A opção (c) **contraria o §0.1** (a tela tem um ato só, e nenhum campo novo). **A recomendada é a
(b)** — variável de ambiente do processo, no molde de `ENDERECO_DA_ENTREGA_DA_NOTICIA`, conferida na
partida: é o mesmo endereço para todas as empresas, é operacional (recebe aviso de inativação), não
toca o frontend, e não inventa contato do cliente. **Adote a (b), registre a decisão (A1) e siga.**

Note a ligação com o `D1`: é **por esse e-mail** que o provedor avisa quando inativa o webhook. Hoje o
produto não o informa e, portanto, **nunca é avisado**.

#### **W3 — MÉDIO · o endereço da entrega não é conferido contra `https` nem contra a porta 443**

A documentação exige: *"`url` — Deve ser https. Porta: 443"*. A conferência de partida faz apenas:

```ts
// apps/api/src/configuracao/ambiente.ts:368
ENDERECO_DA_ENTREGA_DA_NOTICIA: z.string().min(1, 'deve ser declarada'),
```

Um `http://…`, uma porta `:8443` ou um caminho relativo **sobem sem reclamação**, e a falha aparece
tarde — no cadastro junto ao provedor, com mensagem dele, ou pior: aceito e nunca validado.

⚠️ **Isto contraria o padrão do próprio arquivo.** Dez linhas abaixo, o diretório dos boletos é
conferido por *"forma e capacidade, não presença"*, com a justificativa escrita de que *"o serviço
atenderia normalmente até a primeira emissão"*. É o mesmo raciocínio, e o endereço da entrega ficou de
fora.

**Correção:** conferir na partida que é URL absoluta `https:`, com servidor nomeado, e **porta 443
(explícita ou implícita)**. A recusa **nomeia a variável, jamais o valor** — precedente literal de
`resolverDestino` no adaptador (`:1400+`), pela mesma razão: o `TypeError` do `new URL` traz a cadeia
recusada em `input`.

#### **W4 — MÉDIO · NOVO FATO, não defeito de implementação: o cru guarda DADOS PESSOAIS por 90 dias**

O payload real traz, do pagador e de terceiros:

`nomePagador` · `cpfCnpjPagador` · `nomeFantasiaPagador` · `cpfCnpjBeneficiario` · `nomePortador` ·
`cpfCnpjPortador` · `codigoTipoPessoaPagador` · `codigoTipoPessoaPortador`

O produto grava o corpo **inteiro e cru** em `plataforma.notificacao_bancaria.recebido` (`jsonb`), com
retenção de **90 dias** (`DIAS_DE_RETENCAO_DO_CRU`). A tabela vive no schema de **plataforma** e, pela
ADR-0031, **não tem `empresa_id`** — logo, não há RLS por empresa sobre ela.

**A decisão de guardar o cru foi tomada supondo um payload de números e datas** — é o que a tech spec
da fatia descreve. Ninguém decidiu armazenar CPF e nome de pessoas físicas de todas as empresas numa
tabela sem isolamento de tenant; **isso é consequência de um payload que não se conhecia.**

✅ **O que reduz a gravidade, e foi verificado:** o cru **não é exposto por rota alguma** —
`grep -rn "corpoRecebido\|corpo_recebido"` em `apps/api/src` e `packages/contracts/src` volta **vazio**.
Não há vazamento cross-tenant pela API. O alcance é quem tem o papel `sysloc_app` e o banco.

⚠️ **NÃO corrija isto por conta própria, e NÃO redija o cru.** Aparar campos destruiria o valor de
diagnóstico que justifica a retenção, e esbarra na ADR-0034. Isto é **decisão de negócio e de LGPD**,
não de engenharia: **registre o achado, escale ao usuário e siga** — o §10 do seu relatório é o lugar.
Sugestão a apresentar, sem implementar: reduzir a retenção, ou cifrar o `recebido` com o mesmo
mecanismo do segredo operável (ADR-0032).

#### **W5 — BAIXO · dois nomes para o mesmo conceito, entre o cadastro e o recebido**

No cadastro e na consulta o campo é **`codigoTipoMovimento`**; no corpo recebido é **`tipoMovimento`**.
O produto **não lê nenhum dos dois** no tratamento (decisão registrada: *"são classificação do
provedor, e lê-los faria vocabulário dele virar regra do produto"* — RN-18), então hoje é inócuo.

Registre-o apenas como nota no docblock: quem um dia for ler o tipo do movimento vai procurar o nome
errado, porque o nome depende de qual lado da conversa se está.

### 9.4 Uma observação que NÃO é defeito — leia antes de "corrigir" o esquema

O exemplo oficial traz **`"seuNumero": "00-03"`** — cinco caracteres, com hífen. O produto exige **18
dígitos** (`ESQUEMA_DO_IDENTIFICADOR_BANCARIO`, fonte única, ADR-0016), e recusaria esse valor como
`ILEGIVEL`.

**Isso está certo, e o esquema não deve ser afrouxado.** O `seuNumero` é o identificador que **nós**
compomos e enviamos na emissão; o provedor apenas o devolve. O exemplo é de outro cliente, com outro
formato. A sonda de 2026-08-16 mediu igualdade **exata em 18 posições, 3 de 3**, e os 14 boletos do
legado têm largura 18 sem exceção.

A consequência real e desejada: um boleto emitido **fora do produto** (pelo portal do provedor, por
exemplo) gera notícia com `seuNumero` alheio → `ILEGIVEL` → cru guardado, nada roteado. **É o
comportamento correto** — não é cobrança nossa.

⚠️ **Não afrouxe o esquema para aceitar o formato do exemplo.** Seria abrir o roteamento para
identificadores que o produto não emitiu, e é a proibição 2 do §2.2 (afrouxar asserção).

### 9.5 A correção pedida

11. **Normalize a comparação do `W1`** — no ponto da comparação, preservando o ramo de ausência e sem
    tocar na gravação nem na leitura do cru.
12. **Resolva o `email` do `W2`** pela opção (b), e **remova o débito** que o §6.5/3 mandava registrar
    para ele — ele deixou de ser débito e virou correção. O débito do `idWebhook` (`P4`) **permanece**.
13. **Endureça a conferência de partida do `W3`**, no molde do diretório dos boletos.
14. **Registre e escale o `W4`.** Não implemente nada.
15. **Nota de docblock para o `W5`.**

⚠️ **Ordem:** o `W1` é o mais grave e o mais barato — **faça-o primeiro**, antes mesmo do `D1`. Ele é
independente de todo o resto deste arquivo: não depende do terceiro desfecho, não depende do quadro
§8.5, e não toca o adaptador.

### 9.6 Provas exigidas

| # | Arranjo | Esperado | O que discrimina |
|---|---|---|---|
| Y | Cobrança com `numero_do_titulo_no_provedor = "2443"` gravado; notícia com `"nossoNumero": "0000002443"` | **`APLICADO`** (ou o desfecho normal do fluxo) — **não** `DIVERGENTE` | **É a asserção que discrimina o `W1`.** Falha com o código atual, que devolve `DIVERGENTE`. É o caso mais importante do arquivo |
| Z | Gravado `"2443"`; notícia com `"nossoNumero": "9999"` | **`DIVERGENTE`** | ⚠️ **Antivácuo obrigatório do Y.** Sem ele, uma normalização que só devolvesse `undefined` (nunca divergir) passaria no Y e destruiria a RN-05 inteira |
| AA | Gravado `null` (boleto revogado); notícia qualquer | **não** divergente | Prova que o ramo do `CT-1006` sobreviveu à normalização |
| AB | Payload **oficial completo**, os ~24 campos do §9.1 verbatim | `AVISO_DE_RECEBIMENTO`, com os três campos traduzidos corretos | Prova a leitura tolerante contra o corpo **real**, e não contra o inventado pela spec |
| AC | `ENDERECO_DA_ENTREGA_DA_NOTICIA` = `http://…`, e = `https://host:8443/…` | partida **recusada**, mensagem nomeando a **variável** e **sem** ecoar o valor | Discrimina o `W3`. ⚠️ A não-eco é asserção própria — não a presuma |
| AD | Cadastro emitido | o corpo tem `email` e **não** tem `numeroCliente` | Fecha `W2` + `P1` na mesma asserção de igualdade de chaves (caso I do §6.6) |

Todos comportamentais — asserção discriminante declarada, **sem mutantes**. O par **Y + Z** é
indivisível: entregar um sem o outro é entregar prova que não pode falhar.

**FECHADO em 2026-08-22** — `W1` (o defeito CRÍTICO: a comparação do número do título passou a
ignorar preenchimento à esquerda, com o `CT-1051` e o par indivisível Y+Z), `W2` (o `email`), `W3` (a
forma do endereço conferida na partida, `CT-1052`) e `W5` (nota de docblock). `W4` **escalado ao
usuário** e registrado como `D45` — nada implementado, como o próprio §9.5/14 manda.

---

## 10. Escrituração — o que atualizar quando terminar

Nada disto é opcional; é o que impede o próximo agente de reabrir o que você fechou.

1. **`CLAUDE.md` — bloco "Débitos com gatilho ativo"**: remova a linha do `D35 · F5/T7` se você o
   fechou; acrescente linha para todo débito novo que você registrar. **Linha de ~150 caracteres no
   máximo** — o índice é ponteiro curto, o detalhe vive na §2 do `run-report`.
2. **`CLAUDE.md` — contagem da suíte**: atualize o total e o número do pacote alterado, **no mesmo
   diff** que acrescenta os casos.
3. **§2 do `run-report.md` da fatia de origem** de cada débito que você fechar ou registrar
   (`docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md` para o `D35`).
4. **Verificação das duas pontas** (§3-B da rule antirregressão):
   ```bash
   # 1. marcador → registro; 2. índice do CLAUDE.md → marcador vivo
   grep -rl --exclude-dir=dist "DÉBITO COM GATILHO" apps packages deploy
   ```
5. **Este arquivo**: acrescente, ao fim da seção do endpoint tratado, uma nota curta
   `**FECHADO em <data>** — <o que mudou, em duas linhas>`. Não reescreva a análise; ela é registro
   histórico.
6. **A superfície publicada não muda** com este trabalho — nenhuma rota nasce, morre ou se altera.
   Se a sua correção acrescentar rota, **pare**: isso extrapola o escopo e contraria o congelamento
   previsto para logo após a F5.
7. **Commit**: Conventional Commits em pt-BR, via a skill `agent-spec-semantic-commit`.
   **Sem rodapé `Co-Authored-By`** — a skill do projeto o proíbe, e ela vence o default do harness.

---

## 11. Como reportar o resultado

Ao terminar, entregue, nesta ordem:

1. **Baseline antes e depois**, por pacote, com os números exatos.
2. **As três linhas do P3** para cada mudança feita.
3. **A tabela defeito → correção → caso que o prova**, com o nome do CT.
4. **O que você decidiu sem perguntar**, na forma da rule de autonomia:
   `[<escopo>] decisão auto-resolvida (A1): <pergunta> → adotada a recomendada: <opção> · razão: <1 linha>`
5. **O que ficou aberto**, e por quê — nomeadamente o `CA-20` e a tabela de `codigoSituacao`.
6. **Divergências suas em relação a este arquivo**, se houver, com a medição que as sustenta.

---

## 12. Critério de pronto deste ARQUIVO (não do trabalho)

- [x] §5 — `GET /cobranca-bancaria/v3/webhooks` — **completo**, escrito em 2026-08-22
- [x] §6 — `POST /cobranca-bancaria/v3/webhooks` — **completo**, escrito em 2026-08-22
- [x] §7 — `PATCH /cobranca-bancaria/v3/webhooks/{idWebhook}` — **completo**, escrito em 2026-08-22
- [x] §8 — `PATCH /cobranca-bancaria/v3/webhooks/{idWebhook}/reativar` — **completo**, escrito em
      2026-08-22, com o **quadro de decisão único** (§8.5)
- [x] §9 — **payload da notícia recebida** (o corpo que o provedor entrega) — **completo**, escrito em
      2026-08-22. Contém o `W1` **CRÍTICO** e emenda o §6.4/P3. ⚠️ Encerra a pendência que a §13-A.1 do
      discovery declarava *"inauditável"*
- [ ] `DELETE /webhooks/{idWebhook}` — **descartado**: o produto nunca remove cadastro, a tela não o
      dispara, e a porta já proíbe remover cadastro de terceiro
- [ ] `/solicitacoes` — **adiado com gatilho**: é rede de reconciliação, não de habilitação. A
      documentação do §9.1 já revela a forma dele (`dataSolicitacao`, `pagina`,
      `codigoSolicitacaoSituacao`: `3 – Enviado com sucesso`, `6 – Erro no envio`). Candidato natural
      para **depois do `CA-20`**, quando houver tráfego real e a primeira notícia perdida aparecer
- [ ] Endpoints da família de cobrança (emissão, consulta, revogação) — não analisados; aguardando
      decisão do usuário

**As cinco seções escritas (§5 a §9) formam um trabalho ÚNICO, completo e executável.** As caixas
abertas acima são escopo que o usuário **decidiu não incluir**, com a razão registrada em cada uma —
elas **não** bloqueiam a execução. Um agente que receba este arquivo **executa §5 a §9 na ordem
declarada no aviso do topo**, sem aguardar mais nada.
