# Handoff — Recortes de listagem (`?status=`, janelas de data, `?statusLocacao=`) e nomes na carteira

> **Documento fechado, de escopo único.** Ele responde ao pedido da equipe de frontend de
> **2026-09-05** e cobre **só** o que essa intervenção mudou. O contrato geral da API continua em
> `handoff-frontend.md` (3755 linhas), que **não foi reescrito** — este documento é aditivo a ele, e
> nada do que aquele descreve deixou de valer.
>
> **Data:** 2026-09-05 · **Repositório:** `/opt/sysloc-backend` · **Base:** `main`
>
> **Estado:** implementado, testado, **publicado no registry e no ar em produção** desde
> 2026-09-05 15:53:57. Não há pendência do nosso lado — a §10 registra o que foi feito e como foi
> medido.

---

## 0. Resposta curta, para quem só precisa da decisão

| # | O que vocês pediram | Resposta |
|---|---|---|
| 1 | `nomeImovel` / `nomeLocador` / `nomeLocatario` em `GET /v1/contratos` | ✅ **Entregue** — só na **listagem** |
| 2 | `?status=` em `GET /v1/contratos` | ✅ **Entregue** — os quatro estados, um por requisição |
| 3 | `?fimDe=` / `?fimAte=` sobre `dataFimLocacao` | ✅ **Entregue** — pontas **inclusive**, cada uma vale sozinha |
| 4 | `?statusLocacao=` em `GET /v1/imoveis` | ✅ **Entregue** — as **três** situações, inclusive `LOCADO` |
| 5 | Janela de vencimento **ou** `?competencia=` em `GET /v1/cobrancas` | ✅ **Entregue a janela** (`?vencimentoDe=` / `?vencimentoAte=`). `?competencia=` **não** entrou — razão na §8.1 |
| — | `limite=0` é aceito? | ❌ **Não.** Responde `422`. Sigam com `limite=1` — detalhe e razão na §2 |
| — | Endpoint de resumo/KPI, busca textual, ordenação, `?imovelId=`, `?locatarioId=` | Não pedidos, **não feitos** |

**Nenhuma rota foi criada, removida ou renomeada.** Os cinco itens são **parâmetros novos em rotas
que já existiam** e **três campos novos** no item de uma listagem. Nada do que vocês já consomem
mudou de forma, de nome ou de significado.

### Sobre a errata de vocês

Recebida e sem consequência: o pedido não dependia daquela evidência. A justificativa que vale — e
que conferimos deste lado — é a que vocês mesmos escreveram: **hoje ninguém filtra por estado porque
o parâmetro não existe**. Medimos a superfície antes de implementar e confirmamos: `GET /v1/contratos`
aceitava exatamente `limite`, `deslocamento` e `incluirRetirados`, e nada mais.

---

## 1. O que existia ANTES desta intervenção — medido, não lembrado

Esta seção é o "de onde partimos", para que vocês possam conferir cada linha do diff sem depender da
nossa palavra.

### 1.1 `GET /v1/contratos`

| Parâmetro | Antes |
|---|---|
| `limite` | ✅ inteiro, `1..200`, padrão `50` |
| `deslocamento` | ✅ inteiro, `>= 0`, padrão `0` |
| `incluirRetirados` | ✅ `"true"` \| `"false"`, padrão `"false"` |
| `status`, `fimDe`, `fimAte` | ❌ **não existiam** — enviados, respondiam `422` como chave desconhecida |

Item da listagem: **catorze campos**, com `imovelId`, `locadorId` e `locatarioId` como **UUIDs**, sem
nome nenhum. Para montar o cartão, o cliente teria de pedir três recursos por linha da página.

### 1.2 `GET /v1/imoveis`

Mesmos três parâmetros acima. `statusLocacao` **já viajava no item** (é campo do imóvel, com os três
valores), mas **não era filtrável** — exatamente o diagnóstico de vocês.

### 1.3 `GET /v1/cobrancas`

| Parâmetro | Antes |
|---|---|
| `limite`, `deslocamento` | ✅ |
| `contrato` | ✅ código legível do contrato (`CTR-2026-00001`) |
| `status` | ✅ `A_VENCER` \| `VENCIDA` \| `PAGA` \| `CANCELADA` |
| `natureza` | ✅ `ALUGUEL` \| `AGUA` \| `CONDOMINIO` \| `ENERGIA` \| `OUTRO` |
| `vencimentoDe`, `vencimentoAte` | ❌ **não existiam** |

⚠️ Esta rota **não tem** `incluirRetirados`: cobrança não tem exclusão lógica (ADR-0014). Ela também
**nunca teve** `competencia` como filtro de leitura — `competencia` é campo do item e parâmetro de
**escrita**, e continua sendo só isso.

---

## 2. `limite=0` — a resposta é NÃO, e ela vale para todas as listagens

`limite=0` responde **`422`**, com este corpo exato:

```json
{ "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "limite" }
```

**Sigam com `limite=1`.** O teto inferior é `1` e o superior é `200`; `201` também é `422`, e o teto
**recusa em vez de truncar** — pedido acima do limite nunca devolve 200 registros dizendo que devolveu
200 de um total maior.

A recusa não é acidental: ela é a mesma decisão que faz `limite=201` reprovar. Uma página de tamanho
zero seria um envelope que descreve uma janela que ninguém pode paginar, e o `total` continuaria
sendo o número que vocês querem — de modo que o ganho seria **uma linha de tráfego** contra um valor
de janela sem leitura. Se o custo de `limite=1` incomodar de fato, digam: aceitar `0` é mudança
pequena, mas é **decisão de contrato**, e não a tomamos por conta própria.

---

## 3. `GET /v1/contratos` — o que mudou

### 3.1 Três campos novos no item da **listagem**

O item da carteira passa a ser o contrato inteiro **mais**:

```jsonc
{
  "codigo": "CTR-2026-00001",
  "status": "ATIVO",
  "imovelId": "…uuid…",
  "locadorId": "…uuid…",
  "locatarioId": "…uuid…",
  "fiadores": [{ "id": "…uuid…", "nome": "Fulano" }],
  "dataInicioLocacao": "2026-01-10",
  "prazoMeses": 30,
  "valorMensal": 1500,
  "diaVencimento": 10,
  "dataFimLocacao": "2028-07-09",
  "valorTotalContrato": 45000,
  "gerarCobrancasAutomaticamente": false,
  "retiradoEm": null,

  // ── novos ──
  "nomeImovel": "Ap 101",
  "nomeLocador": "Alice Locadora",
  "nomeLocatario": "Bruno Locatário"
}
```

Quatro coisas que vocês precisam saber, e nenhuma delas é dedutível do JSON:

1. **Os identificadores continuam no corpo.** O nome é para **exibir**; o `imovelId` é para
   **navegar** (é ele que as rotas aceitam). Não trocamos um pelo outro.
2. **Os nomes vêm do cadastro CORRENTE**, lidos no instante da consulta — não são cópia gravada no
   contrato. Renomeado o imóvel, **toda** a carteira passa a exibir o nome novo, inclusive nos
   contratos cancelados e encerrados. Se em algum momento vocês precisarem do nome *como estava na
   época*, isso é outra decisão e não existe hoje.
3. **Cadastro retirado de circulação continua nomeando o contrato.** Arquivar um imóvel não deixa o
   contrato com o cartão em branco.
4. **Os três campos existem SÓ na listagem.** `GET /v1/contratos/:codigo` e as respostas dos atos
   (`POST`, `PUT`, ativação, cancelamento, retirada, recirculação) devolvem o contrato **sem** eles.
   A tela que lê um contrato por vez já tem os identificadores. Se a tela de detalhe também precisar
   dos nomes, peçam — é acréscimo, não conserto.

**Custo:** a página inteira custa **uma** consulta a mais, qualquer que seja o tamanho dela. Não há
N+1: a página de 200 custa o mesmo que a de 1.

### 3.2 `?status=`

```
GET /v1/contratos?status=ATIVO
```

- Valores: `RASCUNHO` · `ATIVO` · `CANCELADO` · `ENCERRADO`.
- **Um valor por requisição.** `?status=ATIVO&status=RASCUNHO` é `422` — lista múltipla é outro
  contrato (separador, duplicata, conjunto vazio), e ninguém pediu.
- Rótulo fora da lista (`?status=VIGENTE`) é **`422` nomeando `status`**, e **não** uma página vazia.
  Isto é deliberado: página vazia seria lida por vocês como *"não há contrato ativo"*.
- **`total` é a contagem sob o recorte**, e não a da carteira. É dele que sai o número do cartão.

### 3.3 `?fimDe=` / `?fimAte=` sobre `dataFimLocacao`

```
GET /v1/contratos?fimDe=2026-09-05&fimAte=2026-10-05
```

- Formato `YYYY-MM-DD`. Data que não existe no calendário (`2026-02-30`) é `422` nomeando a ponta.
- **As duas pontas são inclusivas.** A janela de um dia (`fimDe == fimAte`) alcança quem termina
  naquele dia.
- **Cada ponta vale sozinha**: só `fimDe` é *"daqui para a frente"*; só `fimAte` é *"até esta data"*.
- **Janela invertida** (`fimDe > fimAte`) é `422` nomeando **`fimDe`** — não devolvemos página vazia,
  porque ela seria indistinguível de *"não há contrato nesse intervalo"*.
- ⚠️ **Contrato em `RASCUNHO` nunca entra em janela alguma**, nem na mais larga possível:
  `dataFimLocacao` é **derivada na ativação** e é `null` enquanto o contrato é rascunho.
- O recorte é **ortogonal ao estado**: cancelar um contrato **não apaga** `dataFimLocacao` (ela
  descreve o que o contrato foi enquanto valeu). Para *"contratos ativos que vencem em 30 dias"*,
  combinem os dois — `?status=ATIVO&fimDe=…&fimAte=…`.

---

## 4. `GET /v1/imoveis?statusLocacao=` — o que mudou

```
GET /v1/imoveis?statusLocacao=DISPONIVEL
```

- Valores: `DISPONIVEL` · `LOCADO` · `INDISPONIVEL` — os **três**, um por requisição.
- ⚠️ **`LOCADO` é filtrável**, embora a **criação** de imóvel não o aceite: `LOCADO` é escrito pela
  ativação de contrato. Filtrar não é escrever, e o estado que a tela mais quer contar não podia
  ficar inalcançável por recorte.
- Situação fora da lista (`?statusLocacao=VAGO`) é `422` nomeando `statusLocacao`.
- **`total` é a contagem sob o recorte** — é dele que sai *"quantos estão vagos"*.
- O recorte é **ortogonal** ao `incluirRetirados`: `?statusLocacao=DISPONIVEL` continua sem devolver
  imóvel retirado de circulação, e `&incluirRetirados=true` alcança os dois. São dois eixos.

---

## 5. `GET /v1/cobrancas?vencimentoDe=&vencimentoAte=` — o que mudou

```
GET /v1/cobrancas?vencimentoDe=2026-09-05&vencimentoAte=2026-09-05
```

- Formato `YYYY-MM-DD`, mesmas regras da janela de contratos: **pontas inclusive**, cada uma vale
  sozinha, invertida é `422` nomeando `vencimentoDe`, data inexistente é `422` nomeando a ponta.
- **`total` é a contagem sob o recorte.**
- Os quatro filtros anteriores (`contrato`, `status`, `natureza`) continuam e **compõem por
  conjunção** com a janela.

### 5.1 ⚠️ A armadilha que vocês precisam conhecer: `VENCIDA` ≠ "vence hoje"

O estado da cobrança é **derivado**, e a definição é literal:

> `VENCIDA` ⇔ `dataVencimento < data corrente` **e** a cobrança está em aberto.

Logo **a cobrança que vence HOJE é `A_VENCER`, não `VENCIDA`**. Isso tem consequência direta nos
indicadores que vocês descreveram:

| Indicador | Consulta correta |
|---|---|
| **Vencem hoje** | `?vencimentoDe=<hoje>&vencimentoAte=<hoje>` — ⚠️ **não** `?status=VENCIDA` |
| **A vencer nos próximos 7 dias** | `?status=A_VENCER&vencimentoDe=<hoje>&vencimentoAte=<hoje+7>` |
| **Em atraso** (o que vocês já têm) | `?status=VENCIDA` |

A data corrente é a do **servidor** (fuso da operação), não a do navegador. Se a diferença importar
para vocês em alguma borda de meia-noite, digam — hoje não publicamos essa data em rota alguma.

---

## 6. Erros — o envelope não mudou

Todas as recusas novas são `422` com o envelope da ADR-0017, **sem código de erro novo**:

```json
{ "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "<parâmetro>" }
```

| Situação | `campo` |
|---|---|
| `?status=VIGENTE` (rótulo inexistente) | `"status"` |
| `?fimDe=2026-12-31&fimAte=2026-01-01` (invertida) | `"fimDe"` |
| `?fimAte=2026-02-30` (data inexistente) | `"fimAte"` |
| `?statusLocacao=VAGO` | `"statusLocacao"` |
| `?vencimentoDe=2026-12-31&vencimentoAte=2026-01-01` | `"vencimentoDe"` |
| `?vencimentoDe=2026-02-30` | `"vencimentoDe"` |
| `limite=0` ou `limite=201` | `"limite"` |
| **parâmetro desconhecido** (`?statusDoContrato=ATIVO`) | `"statusDoContrato"` — a própria chave |

✅ **A última linha foi CORRIGIDA em 2026-09-05**, depois de vocês apontarem. Ela dizia `"limite"`, e
o defeito era nosso: `campo: "limite"` para um parâmetro inventado é **indistinguível** da recusa de
um `limite` de fato inválido, de modo que classificar pelo par `campo` + `detalhes` — que é o que
vocês fazem — produzia o diagnóstico errado, sem nenhuma forma de perceber.

Não foi favor nem mudança de contrato: era o **contrato publicado** que estava sendo descumprido. A
§6.2 do `handoff-frontend.md` promete, desde 2026-08-24, que *"`limite=50&ordenar=nome` é `422`, com
`campo: "ordenar"`"*, a §6.1 diz o mesmo do corpo, e a fixture `listar-contratos/parametro-desconhecido`
da §20.2 publica `campo: "ordenar"`. O servidor respondia o **padrão do ponto de chamada**. Vocês
codificaram contra o documento; o documento estava certo.

O que mudou, exatamente:

- **A chave recusada é nomeada** em `campo`, na cadeia de consulta de **todas** as listagens — as
  três desta entrega, as seis de cadastro, a de cobranças, a de automação e as duas do Painel Master.
  Nomeia-se a **primeira** chave desconhecida, como o `detalhes.exigido` da guarda já nomeia a
  primeira permissão ausente: corrijam uma e voltem.
- **Nada mais mudou.** `limite=0`, `limite=201` e `deslocamento=-1` continuam nomeando `limite` e
  `deslocamento` — a recusa real do `limite` é exatamente a que vocês precisavam distinguir, e ela
  não se mexeu.
- **O corpo (`POST`/`PUT`) NÃO mudou nesta correção**: chave desconhecida no corpo continua trazendo
  `campo: "corpo"`. ⚠️ Isso **também** diverge da §6.1, que promete o nome da chave ali. Está medido
  e registrado do nosso lado; não o corrigimos junto porque vocês não o pediram e a mudança alcança
  19 asserções de outras telas. **Se a mesma classificação valer para os formulários de vocês,
  digam** — é o mesmo conserto, no mesmo ponto único.
- **Um valor por requisição continua sendo a regra.** O `campo` traz uma chave, não uma lista.

---

## 7. Receitas dos indicadores do Resumo

Todas leem **só o `total`** do envelope, com `limite=1`. Duas requisições continuam bastando para
abrir a tela; as demais são atalhos que vocês disparam sob demanda.

| Indicador | Requisição |
|---|---|
| Total de imóveis | `GET /v1/imoveis?limite=1` |
| **Imóveis vagos** | `GET /v1/imoveis?statusLocacao=DISPONIVEL&limite=1` |
| Imóveis locados | `GET /v1/imoveis?statusLocacao=LOCADO&limite=1` |
| **Contratos ativos** | `GET /v1/contratos?status=ATIVO&limite=1` |
| **Vencem em 30 dias** (renovação) | `GET /v1/contratos?status=ATIVO&fimDe=<hoje>&fimAte=<hoje+30>&limite=1` |
| Cobranças em atraso | `GET /v1/cobrancas?status=VENCIDA&limite=1` |
| **Vencem hoje** | `GET /v1/cobrancas?vencimentoDe=<hoje>&vencimentoAte=<hoje>&limite=1` |
| **A vencer (7 dias)** | `GET /v1/cobrancas?status=A_VENCER&vencimentoDe=<hoje>&vencimentoAte=<hoje+7>&limite=1` |
| **Adimplência do mês** | numerador `?status=PAGA&vencimentoDe=<1º>&vencimentoAte=<último>&limite=1`; denominador o mesmo **sem** `status` |

⚠️ Sobre a adimplência: o denominador *sem* `status` inclui a cobrança **cancelada**. Se vocês
quiserem a razão sobre cobranças vivas, ela precisa de duas requisições a mais (`PAGA`, `VENCIDA`,
`A_VENCER`) — não há como excluir um estado com um parâmetro só, porque o filtro é de igualdade e
aceita um valor. Se essa razão virar indicador fixo, digam: negação de estado é decisão de contrato.

---

## 8. O que NÃO foi feito, e por quê

### 8.1 `?competencia=` em `GET /v1/cobrancas` — **não entrou**

Vocês ofereceram a alternativa e pediram a mais barata. As duas custavam praticamente o mesmo, então
o critério não foi custo, e sim **evitar dois eixos de tempo na mesma listagem**: `competencia` (o
mês a que a cobrança se refere) e `dataVencimento` (o dia em que ela vence) são coisas diferentes, e
publicá-los juntos obrigaria vocês a escolher entre os dois a cada chamada. O eixo desta carteira é o
vencimento — é por ele que a rota **ordena**, e é ele que responde aos indicadores que vocês
listaram.

**Se o corte mensal por competência for necessário** (e ele é uma pergunta legítima — *"o que foi
faturado em março"* não é o mesmo que *"o que vence em março"*), peçam: entra como parâmetro
adicional, sem tirar nada.

### 8.2 Os nomes nas outras sete rotas de contrato — **não entrou**

Só a listagem os traz. Levá-los à leitura por código e aos cinco atos de escrita faria **toda**
escrita pagar a junção com três tabelas, e nenhuma tela pediu.

### 8.3 `limite=0` — **não aceito** (§2)

### 8.4 Endpoint de resumo, busca textual, ordenação declarável, `?imovelId=`, `?locatarioId=`

Não pedidos. Não feitos. Concordamos com o raciocínio de vocês em todos.

---

## 9. Como consumir os tipos

Os tipos estão em `@syslocbr/contracts`, e os símbolos novos são:

```ts
import {
  // o item da listagem de contratos — o contrato MAIS os três nomes
  esquemaDoContratoNaCarteira,
  type ContratoNaCarteira,

  // as janelas de consulta, se vocês quiserem validar a URL antes de montá-la
  esquemaDaJanelaDeContratos,  type JanelaDeContratos,
  esquemaDaJanelaDeImoveis,    type JanelaDeImoveis,
  esquemaDaJanelaDeCobrancas,  type JanelaDeCobrancas,
} from '@syslocbr/contracts';
```

- `Contrato` (o tipo antigo) **continua existindo e não mudou** — ele é o que as outras sete rotas
  devolvem. `ContratoNaCarteira` é `Contrato` mais três `string`.
- `JanelaDeCobrancas` **ganhou dois campos opcionais** e não perdeu nenhum.

✅ **Disponível na `@syslocbr/contracts@1.1.0`**, publicada em 2026-09-05 (privada, na org
`syslocbr`). A `1.0.0` continua no registry; a `1.1.0` é **aditiva** — nenhum símbolo foi renomeado
ou removido, e nada do que vocês já importam mudou de forma.

---

## 10. Publicação — feito, e como foi medido

Os três passos foram executados em **2026-09-05**, nesta ordem:

1. **`@syslocbr/contracts@1.1.0` publicado** no GitHub Packages, privado. Conferido por `npm view`
   (`1.1.0`) e pela API do GitHub (`"name": "contracts"`, `"visibility": "private"`, com `1.1.0` e
   `1.0.0` listadas). O ensaio `pnpm publish --dry-run` foi rodado antes, e o destino impresso era
   `https://npm.pkg.github.com/` — a conferência existe porque publicar no registry errado tornaria
   público o contrato inteiro da API.
2. **API reconstruída e reiniciada** — `pnpm build` (9 pacotes) e `systemctl restart sysloc-api` às
   **15:53:57**, com `Result=success` e `NRestarts=0`.
3. **Verificado.** `deploy/scripts/publicacao/verificar-rotas-publicadas.sh`: **5 casos, 5
   aprovados, zero falhas, zero degradações**.

### Por que o passo 2 não é formalidade, e a medição que prova

Antes do reinício, o processo em memória era de **2026-09-03 10:45:16** enquanto o `dist/` no disco
era de **2026-09-05 15:52:20**: exatamente o descompasso que produziu o incidente
`PROD-2026-09-03-01`, quando sete rotas responderam `404` em produção estando na árvore, compiladas
e verdes na suíte.

O par abaixo é a prova de que o código novo está **no ar**, e não só no disco — medido no documento
que o próprio processo serve, antes e depois:

| Medição no processo em execução | Antes | Depois |
|---|---|---|
| Campos do item de `GET /v1/contratos` | 14 | **17** |
| `nomeImovel` / `nomeLocador` / `nomeLocatario` | ausentes | **presentes** |
| `?status=`, `?fimDe=`, `?fimAte=` descritos | não | **sim** |
| `?statusLocacao=` descrito | não | **sim** |
| `?vencimentoDe=`, `?vencimentoAte=` descritos | não | **sim** |
| **Controle:** campos de `GET /v1/contratos/:codigo` | 14 | **14** (a assimetria continua de pé) |
| **Controle:** caminhos publicados | 75 | **75** (nenhuma rota nasceu) |

As duas últimas linhas são o que impede a leitura otimista: sem elas, "o item cresceu" seria
compatível com uma mudança que também vazasse os nomes para as outras sete rotas, ou que publicasse
rota nova sem ninguém decidir.

---

## 11. Evidência — o que foi medido

Suíte por pacote, antes e depois, no mesmo host:

| Pacote | Antes | Depois | Delta |
|---|---|---|---|
| `contracts` | 455 | **487** | +32 — `CT-1256` a `CT-1259` (forma dos recortes e do item da carteira) |
| `db` | 296 | **301** | +5 — `CT-1260` a `CT-1264` (o recorte vira predicado SQL, e `total` acompanha) |
| `api` | 456 | **463** | +7 — `CT-1265` a `CT-1271` (a fiação ponta a ponta, as recusas e o isolamento) |
| os outros seis | — | **sem alteração** | remedidos um a um |

O que cada camada prova, e por que são três e não uma:

- **`contracts`** — que o recorte é aceito ou recusado na forma certa (união fechada, pontas
  inclusivas, janela invertida recusada nomeando a ponta).
- **`db`** — que o recorte vira **predicado SQL**, e que `total` é contado sob o **mesmo** predicado
  da página. É o que impede o defeito silencioso de filtrar em memória depois de paginar: a página
  pareceria certa e o `total` descreveria outro conjunto.
- **`api`** — que o parâmetro **atravessa** a borda e chega à porta. Pega o defeito que as outras
  duas não pegariam: um controlador que valide o parâmetro e não o repasse — o filtro pareceria
  aplicado e a carteira viria inteira.

Um caso merece menção porque é o que vocês veriam primeiro se estivesse errado: o **`CT-1271`**
verifica que, com os recortes ligados, a sessão de outra empresa recebe `200` com `itens: []` e
`total: 0` nos mesmos pedidos em que a primeira recebe conjunto não vazio. Filtro novo é superfície
nova, e superfície nova é onde vazamento entre empresas costuma nascer.

**As âncoras de superfície não se moveram** — continuam **113 rotas / 98 manipuladores / 20
públicas**. É a confirmação executável de que nada foi publicado, removido ou renomeado.
