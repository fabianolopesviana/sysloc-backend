# Briefing de pré-refinamento — F2 · fatia 2 · Contratos de locação

> **Entrada para `/agent-spec-pre-refinement`.** Este documento não é a spec: é o material de
> ancoragem para o brainstorm de produto. Ele reúne o que a fatia é, o terreno que encontra pronto,
> o que a fatia 1 **já fechou e não se reabre**, e — o que mais importa — **as tensões reais que o
> pré-refinamento precisa explorar e convergir com o usuário**.
>
> Feature: `contratos-de-locacao` · versão `v1` · variante `backend` · **fatia 2 de 2** da fase
> **F2** do `docs/plano-backend-novo/plano-execucao.md`.
>
> **Antecessor obrigatório:** `docs/plano-backend-novo/briefings/f2-dominio-locacao.md`, o briefing
> da fase inteira. Leia-o antes deste — sete das oito tensões que ele levantou foram fechadas pela
> fatia 1, e a §2 abaixo diz exatamente quais e como.

---

## 1. O que esta fatia é

A F2 foi **partida em duas por agregado**, e a dependência deu a ordem: `Contrato` aponta para imóvel
e para pessoas, então eles vieram antes. A fatia 1 (`cadastro-de-imoveis-e-pessoas`) fechou em
2026-08-08 com **11 tasks aprovadas nos dois gates**. Esta é a segunda e **fecha a fase**.

**As duas entidades que faltam:** `Contrato` e `ContratoFiador`.

O plano de execução (§F2) e o painel do roadmap fixam para esta fatia:

1. **Schema com RLS e FK composta**, no molde que a fatia 1 estabeleceu.
2. **O código legível `CTR-{ano}-{sequencial}`** — o contrato é uma das **duas** entidades do produto
   que têm série declarada (a outra é `Cobranca`, da F3).
3. Os **2 `Custom Field` de negócio** que pertencem a `Contrato` — `gerarCobrancasAutomaticamente` e
   `pdfContratoArquivo`. O terceiro do site pertence à `Cobranca` e é F3.
4. **O núcleo local** da ativação (`contrato_ativacao`, ~340 LOC) e do cancelamento em cascata
   (`contrato_cancelamento`, ~174 LOC), com os pontos de extensão declarados como débito com gatilho.
5. **`@sysloc/contracts`** ganha os contratos das rotas de contrato — o pacote já existe, criado pela
   fatia 1.

**Aceitação declarada da fase** (a metade que falta): criar `Contrato` da empresa A apontando
`Imovel` da B é **recusado pelo banco**, não por validação de aplicação.

---

## 2. O que a fatia 1 já fechou — não reabrir

O briefing da fase levantou oito tensões. **Sete estão resolvidas**, e reabrir qualquer uma delas é
regressão de decisão (R3, `.claude/rules/nao-regressao.md`). Esta seção existe para que o brainstorm
não gaste rodada redescobrindo o que já foi decidido.

| Tensão do briefing da fase | Estado | Onde foi fechada |
|---|---|---|
| §4.2 — a fase cabe num run? | ✅ **Fechada** | partida em 2, corte por agregado; esta é a fatia 2 |
| §4.3 — quem gera o código legível, e concorrência | ✅ **Fechada** | **ADR-0015** |
| §4.4 — quando `@sysloc/contracts` é publicado | ✅ **Fechada** | nasce **interno**; publicação é entregável do marco, depois da F5 |
| §4.5 — `status` calculado no servidor | ✅ **Fechada** | **ADR-0017**, que o fixa como regra de forma de **todo** recurso |
| §4.6 — os 3 `Custom Field` | ✅ **Fechada** | 2 são de `Contrato` (nesta fatia), 1 é da `Cobranca` (F3) |
| §4.7 — o que "excluir cadastro" faz | ✅ **Fechada** | **ADR-0014** |
| §4.1 — **ausência de golden** para ativação e cancelamento | ⚠️ **ABERTA — e agora é desta fatia** | ver §4.1 abaixo |

### 2.1 O que as ADRs decidem — texto, não paráfrase

Estas quatro governam a fatia e **são vinculantes**. Abra o texto integral antes de contrariar
qualquer uma; as linhas abaixo são resumo de leitura, não substituto.

- **ADR-0014 — exclusão lógica.** Entidade de cadastro do domínio *"a que o usuário cria, nomeia e
  **referencia de outro registro**"* — e **contrato está nomeado na lista** — **nunca é removida
  fisicamente**. Excluir é retirar de circulação, e o registro permanece legível por quem já o
  referencia. Ficam **fora** do alcance duas classes: **vínculo ou concessão**, cuja linha representa
  estado de relacionamento e cuja remoção é o mecanismo legítimo; e **detalhe de composição**, parte
  sem vida própria que ninguém referencia. *"O discriminador é **ser referenciável**, não ser
  cadastrável."* — **é essa frase que decide o que `ContratoFiador` é** (ver §4.4).

- **ADR-0015 — contador sequencial.** Todo contador é **único por empresa**, e **cada série declara o
  próprio escopo** — *"o contrato inclui o ano no escopo; uma série sem ano é igualmente válida"*.
  Dentro do escopo, criações concorrentes **não esperam umas pelas outras**, **furo na sequência é
  aceito**, e o número **nunca é reusado** — nem por registro excluído, nem por criação abortada.

- **ADR-0017 — forma canônica.** A chave exposta é o **código textual legível quando a entidade tem
  série declarada** — *"hoje contrato e cobrança"*. As outras quatro regras: corpo em camelCase;
  **`status` calculado no servidor, nunca derivado no cliente**; sucesso no root e lista como
  `{ itens, total, limite, deslocamento }`; erro com `{ codigo, mensagem, campo?, detalhes? }` de
  enum fechado.

- **ADR-0018 — composição de exigências por rota.** A declaração **no método substitui** a da classe.

### 2.2 O molde que a fatia 1 deixou pronto

Não é contexto decorativo — é o que a fatia 2 imita, e divergir dele precisa de razão:

- **6 entidades** em `negocio` com `empresa_id`, RLS forçada e FK composta, sob uma **guarda de
  cobertura** que reprova tabela de negócio que nasça sem os três elementos;
- **33 rotas** sob `/v1`, todas com exigência declarada — `rotasEnumeradas` = 66, `semDeclaracao`
  vazio, conferido por conteúdo e não por presença;
- **`@sysloc/contracts`** como fonte única do contrato: o documento publicado é **derivado** dos
  esquemas, nunca escrito à mão (ADR-0016);
- **porta de leitura com predicado de circulação por padrão** — a inclusão do retirado é explícita;
- módulos comuns de borda já extraídos: `apps/api/src/comum/validacao.ts`,
  `esquema-de-erro.ts`, `esquema-publicado.ts`, `contexto-da-sessao.ts`. **Os controladores desta
  fatia importam de lá — não copiam.**

### 2.3 A autorização já está declarada e esperando

O catálogo é fechado e **já contém as duas chaves de ação desta fatia**: `ACAO:ativar_contrato` e
`ACAO:cancelar_contrato`, mais a área `TELA:contratos`, com o `MAPA_ACAO_TELA` ligando cada ação à
área que a comporta. A fatia **não decide como autorizar** — decide **o que cada rota exige**, dentro
de um catálogo que não cresce sem decisão explícita.

---

## 3. Restrições que não se negociam

Um rumo do brainstorm que contrarie qualquer uma destas deve ser **podado com a razão registrada**,
não discutido.

| Restrição | Origem |
|---|---|
| Multi-tenancy é fundação: `empresa_id`, RLS, FK composta em **toda** tabela de negócio | Invariante 1 |
| O contexto de tenant **nunca** é lido do request | Invariante 2 · ADR-0008 |
| **Dinheiro em `numeric(15,2)`, nunca float** — e esta é a primeira fatia com dinheiro de verdade | Invariante 4 |
| IDs textuais legíveis preservados; chave interna é UUID, o código legível é coluna própria | Invariante 5 · ADR-0017 |
| A API fala o modelo de domínio **camelCase** do `levantamento-frontend.md` §6 | Invariante 6 |
| Contrato **nunca é removido fisicamente** | ADR-0014 |
| Toda rota governada declara exigência, com default que nega | ADR-0011 · ADR-0018 |
| O documento da API é **derivado** dos esquemas | ADR-0016 |
| A suíte nunca executa contra o ambiente que atende a operação | ADR-0006 |
| **Nada de frontend** — gatilho de parada do repositório inteiro | `CLAUDE.md`, Fronteira |

---

## 4. As tensões a explorar — o coração deste briefing

### 4.1 As duas regras portadas **não têm golden**, e a janela para capturá-lo está fechando

**Esta é a tensão mais importante da fatia, e ela foi herdada intacta da fase.**

Os seis artefatos de caracterização capturados do Frappe são `metragem.json`, `calcular-mora.json`,
`marcar-cobrancas-vencidas.json`, `atualizar-atrasos-cobrancas.json`,
`encerrar-contratos-vencidos.json` e `contrato-pdf.txt`. **Nenhum deles cobre ativação ou
cancelamento** — a metragem serviu à fatia 1, e os outros quatro são da F3 e da F5.

Ou seja: **as duas regras mais complexas da fase inteira, com efeito em cascata sobre outras
entidades, seriam reimplementadas sem oráculo**. E o `/opt/frappe`, que é a única fonte possível,
**só existe até a F7**.

Direções a explorar com o usuário, com custo e prazo:

- **capturar golden agora**, contra o `/opt/frappe` que ainda está de pé — é legítimo e há precedente
  medido: a fatia `caracterizacao-regras-legadas` fez exatamente isso, com `bench backup` e site
  próprio, e a TaskCard dela é o roteiro reutilizável;
- **derivar a especificação por leitura do código legado** e aceitar equivalência **declarada, não
  provada** — mais barato, e o custo aparece na virada;
- **capturar só a ativação**, que é a que tem cascata e o dobro do tamanho;
- **fatiar de novo**, deixando as regras para uma fatia 3.

A escolha muda o tamanho da fatia e o risco da F7. **Ela precisa ser feita neste pré-refinamento.**

### 4.2 Onde exatamente corta o "núcleo local"

O painel do roadmap já registra a decisão de princípio: *"ativação (340 linhas) e cancelamento (174)
**atravessam F3 e F4** — geram cobrança, emitem boleto, exigem PDF e pedem baixa bancária. A F2 porta
o **núcleo local** delas (validações, transição de status, efeito no imóvel) e declara os pontos de
extensão como débito com gatilho."*

O princípio está fechado; **a fronteira concreta não**. O brainstorm precisa convergir:

- o que é "núcleo local" de uma regra de 340 linhas — quais efeitos ficam e quais viram gatilho?
- ativar um contrato **sem gerar cobrança** é um estado coerente do produto, ou é um meio-produto que
  confunde o usuário?
- o `gerarCobrancasAutomaticamente` (um dos 2 campos de negócio desta fatia) é justamente o
  interruptor dessa geração. Ele muda a resposta da pergunta anterior?
- o cancelamento em cascata cancela **o quê**, se as cobranças ainda não existem?

### 4.3 O que substitui `draft` / `submit`

O frontend de hoje envia `docstatus` e o plano manda redesenhar: *"draft/submit → `POST /contratos`"*.
O inventário mostra o fluxo real — cria com `docstatus`, depois **lê o doc inteiro só para o submit**.

Perguntas de produto:

- o contrato **nasce rascunho** e é ativado num segundo passo, ou nasce já ativo?
- se há rascunho, ele é um `status`, ou é ausência de ativação?
- rascunho consome número da série? (a ADR-0015 diz que número **não se reusa** — então um rascunho
  abandonado deixa furo permanente)
- **ativar é rota própria** (`ACAO:ativar_contrato` existe como chave, o que sugere que sim) ou é
  atualização de campo?

### 4.4 `ContratoFiador` — vínculo ou entidade de cadastro?

**A ADR-0014 decide o destino desta tabela, e a decisão não é óbvia.** O discriminador é *"ser
referenciável"*: se `ContratoFiador` é **vínculo**, a remoção da linha é o mecanismo legítimo — como
já acontece com `acesso_usuario_permissao`; se é **entidade referenciável**, nunca some.

O frontend manda `fiadores:[{fiador}]` como child table na criação, o que sugere vínculo simples. Mas
o brainstorm precisa confirmar:

- a ligação tem **atributos próprios** (ordem, percentual de responsabilidade, data de entrada)?
- trocar o fiador de um contrato ativo é **remover e inserir**, ou é histórico que se preserva?
- um contrato pode ter **zero** fiadores? Quantos no máximo?

### 4.5 Retirar de circulação × cancelar — duas operações ou uma?

O catálogo tem **duas** ações sensíveis distintas: `ACAO:cancelar_contrato` e `ACAO:excluir_cadastro`.
A ADR-0014 diz que contrato **não some**. Então:

- **cancelar** é transição de `status` (regra portada, com cascata);
- **excluir** é retirada de circulação (o padrão que a fatia 1 implementou nas 6 entidades).

São mesmo duas coisas diferentes na cabeça do usuário? Um contrato cancelado **também** sai de
circulação? O que a tela mostra? Convergir isso evita duas rotas que fazem quase a mesma coisa.

### 4.6 O contrato aponta para entidades que podem estar fora de circulação

A fatia 1 entregou retirada de circulação para imóvel, conjunto e as três pessoas. Agora:

- pode-se criar contrato sobre um **imóvel retirado de circulação**?
- o que acontece ao **retirar** um imóvel que tem contrato ativo — recusa, permite, ou avisa?
- e um **locatário** retirado com contrato vigente?

A FK composta impede a referência **cross-tenant** pelo banco; ela **não** impede referência a
registro fora de circulação. Isso é decisão de produto, e a fatia 1 não a enfrentou porque nenhuma de
suas entidades apontava para outra que pudesse ser retirada.

---

## 5. Fora do escopo desta fatia

- **Cobrança, mora, régua, PDF e carnê** — F3, e é para lá que apontam quatro dos seis goldens.
- **Integração bancária** — F4.
- **Automações e agendamento** — F5, inclusive `encerrar_contratos_vencidos`, que tem golden próprio.
- **Publicação do `@sysloc/contracts`** — entregável do marco, depois da F5.
- **Qualquer código de frontend** — gatilho de parada do repositório inteiro.

---

## 6. Débitos com gatilho que esta fatia pode disparar

O `CLAUDE.md` mantém o índice; três são relevantes, e **o primeiro provavelmente dispara**:

- **`D3` · F2/T1** (`packages/contracts/src/comum.ts`) — `ESQUEMA_DO_IDENTIFICADOR` tem duas
  definições; dispara na **primeira task que abrir `usuario.controller.ts` por outra razão**.
- **`D32` · F0/T6** (`apps/worker/src/fila.ts`) — dispara na **primeira fatia que enfileirar tarefa
  de negócio**. Se a ativação de contrato gerar cobrança de forma assíncrona, **esta é a fatia**.
- **`D28` · F0/T5** — já disparado, e **agravado**: o import de `packages/shared/test/` por caminho
  relativo profundo está em ~35 ocorrências em ~20 arquivos. Toda suíte nova o repete.

Depois da higienização de 2026-08-08, a lista de débitos **diz a verdade** — os já pagos estão
marcados e os agravados trazem o número remedido. O parecer registrado é **não** rodar resolução em
massa; débito que a fatia tocar, ela fecha.

---

## 7. Fatos a confirmar durante o pré-refinamento

Marque como `[DÚVIDA]` no artefato o que não se resolver:

1. Ativação e cancelamento terão golden capturado? (§4.1 — **decide o tamanho da fatia**)
2. `pdfContratoArquivo` guarda **caminho, bytes ou referência**? O PDF é F3, mas o campo é daqui.
3. `ContratoFiador` tem atributos próprios? (§4.4 — decide se a ADR-0014 o alcança)
4. Existe convenção no Frappe para o código do contrato que se deva preservar além do formato
   `CTR-{ano}-{sequencial}` — por exemplo, o que acontece na virada de ano?
5. Quais campos do `CONTRATO_FIELDS` (12, no inventário do frontend) são de negócio e quais são
   metadado do Frappe que morre com ele?
6. Há entidade que os 35 endpoints usam e que **não** está nas 8 da fase?

---

## 8. Critérios de saída deste pré-refinamento

O artefato deve permitir decidir, sem reabrir a conversa:

- [ ] o que se faz sobre a **ausência de golden** para ativação e cancelamento, com custo e prazo
- [ ] **onde corta o núcleo local** das duas regras, e o que vira débito com gatilho
- [ ] se o contrato **nasce rascunho** ou nasce ativo, e se ativar é rota própria
- [ ] o que `ContratoFiador` **é**, à luz do discriminador da ADR-0014
- [ ] se **cancelar** e **retirar de circulação** são operações distintas, e o que o usuário vê
- [ ] o comportamento ao referenciar entidade **fora de circulação**
- [ ] se a fatia cabe num run ou precisa de terceira fatia
- [ ] o framework recomendado (a fatia 1 rodou **SDD** com 11 tasks; pode promover ou rebaixar)
- [ ] se alguma decisão merece **ADR nova** — candidatas: o ciclo de vida do contrato (rascunho,
      ativo, cancelado) e a referência a registro fora de circulação, ambas transversais à F3

---

## 9. Observações de método

- O `/opt/frappe` **ainda está de pé** e consultá-lo é legítimo — mas o site `frontend` é
  **produção**: nada destrutivo. A caracterização estabeleceu o padrão seguro (`bench backup` → site
  próprio), e é o mesmo que uma captura de golden usaria.
- Este projeto roda **exclusivamente em Opus**, e todo artefato é em **português brasileiro** — vale
  para a sessão principal e para todo subagente.
- O **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição.
- O pré-refinamento é brainstorm **de produto**: sem endpoints, sem schema, sem arquitetura fina.
  Onde este briefing cita estrutura, é para ancorar viabilidade — **não para ser copiado na spec**.
- Esta fatia **fecha a F2**. Ao fim dela, três das cinco fases que o marco de entrega exige estarão
  concluídas, e o que sobra entre aqui e o handoff é F3, F4 e F5.
