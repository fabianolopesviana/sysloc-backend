/**
 * Contrato de locação — a regra de domínio das seis rotas de cadastro de `/v1/contratos` e das
 * **duas transições de estado governadas do produto** (`/ativacao` e `/cancelamento`).
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. Nenhum deles
 * chama `emUnidadeDeTrabalho`, e é essa ausência que faz o contrato e os fiadores dele nascerem num
 * **commit só**. Se este serviço abrisse unidade própria, a composição bateria em
 * `ErroDeUnidadeAninhada`, e a saída seria fundir serviços para satisfazer o mecanismo de transação —
 * a topologia às avessas. É a mesma decisão, com a mesma razão, de {@link ../imoveis/imovel.service.js},
 * e é a saída que o próprio marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`
 * aponta como preferível. **A decisão fechada não é tocada.**
 *
 * A ausência de `AcessoAoBanco` no construtor é o mecanismo: o acesso ao banco **não** é injetado
 * aqui, porque injetá-lo daria a este serviço exatamente a capacidade que ele não pode ter. O
 * construtor que existe carrega **uma** dependência, e ela não é dado: a
 * {@link PortaDeRenderizacao} do documento, composta pelo módulo (ADR-0025). Ver o docblock dela.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.contrato` e `negocio.contrato_fiador` vive em
 * `packages/db/src/contrato.ts`, publicada como função de domínio. A razão é a enumerabilidade, e
 * está por extenso no cabeçalho daquele arquivo: a contenção da §11.2 é de **tipo** e não alcança
 * texto de SQL, de modo que o que a mantém viva é não haver **onde** escrever a instrução.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. O contrato de outra empresa
 * não é achado — a política do banco o esconde —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num
 * ponto único ({@link ContratoService.exigir}).
 *
 * ---------------------------------------------------------------------------
 * A GARANTIA DA SÉRIE mora aqui, e o controlador só ABRE a unidade dela
 * ---------------------------------------------------------------------------
 *
 * A §5.1 da tech spec descreve o fluxo como *"o controlador abre a primeira unidade e chama
 * `garantirContadorDeContrato(tx, ano)`"*. O que aquela frase fixa — e o que esta base não negocia —
 * é **onde a unidade abre**: na borda, sempre. Quem alcança a camada de dados continua sendo o
 * serviço, por {@link ContratoService.garantirSerie}, e a razão é a mesma que mantém o SQL inteiro em
 * `packages/db`: nenhum controlador desta superfície importa função de porta, e a primeira exceção
 * tornaria o alcance às tabelas do domínio deixar de ser enumerável pela lista de importações dos
 * cinco controladores de cadastro. O invariante da §3.2 da task fica intacto — são **duas unidades
 * sequenciais**, abertas pelo controlador, e a segunda começa depois de a primeira commitar.
 *
 * ---------------------------------------------------------------------------
 * A CONFERÊNCIA DOS CADASTROS REFERENCIADOS tem DUAS metades, e elas são de naturezas diferentes
 * ---------------------------------------------------------------------------
 *
 * {@link ContratoService.exigirCadastrosAlcancaveisEEmCirculacao} é o **ponto único** das duas, e
 * roda na montagem **e** na alteração — os dois carregam o corpo completo, com os mesmos quatro
 * campos de referência e a mesma exposição.
 *
 *   * **alcance** — é uma **leitura sob a política** (`localizarImovel`, `localizarPessoa`), e não
 *     uma comparação de `empresa_id` escrita aqui. Ela existe por razão de **contrato**, e não de
 *     segurança: quem impede o vínculo cruzado são as quatro chaves estrangeiras compostas, que
 *     recusariam a linha de qualquer jeito (ADR-0008, §7.2). O que ela compra é a **forma** da
 *     recusa: sem ela, o cadastro de outra empresa produziria erro de driver — `500` com o erro do
 *     banco —, e o `500` diria ao cliente que aquele identificador existe em algum lugar. Com ela,
 *     cadastro alheio e cadastro inexistente respondem o **mesmo** `404`, byte a byte, que é o que o
 *     `CT-423` mede;
 *   * **circulação** — as portas por identificador **alcançam o retirado de propósito**, para que a
 *     recirculação seja possível (ADR-0014). Nada, portanto, recusaria sozinho um contrato montado
 *     sobre um locatário que saiu de circulação, e a conferência é **deliberada e visível**:
 *     `422 CAMPO_INVALIDO` nomeando o campo, com `detalhes.circulacao` dizendo por quê. É a
 *     informação que resolve a situação — recircular o cadastro, ou apontar outro.
 *
 * A ordem das quatro é fixa (imóvel, locador, locatário, fiadores) porque a recusa nomeia **um**
 * campo: uma ordem que variasse faria o mesmo corpo recusado nomear campos diferentes entre
 * requisições.
 *
 * ---------------------------------------------------------------------------
 * A ALTERAÇÃO SÓ ENQUANTO RASCUNHO (RD-05) — e por que ela NÃO substitui a defesa da porta
 * ---------------------------------------------------------------------------
 *
 * A guarda de estado vive aqui, num ponto único, e produz `422 CAMPO_INVALIDO` com `campo: 'status'`
 * e `detalhes: { estadoAtual, transicaoPedida }` — a recusa é de **domínio** e precisa nomear o
 * estado atual na resposta, o que a camada de dados, que não conhece HTTP, não faz.
 *
 * **Ela é leitura-antes-de-gravar, e por isso não é defesa de integridade.** Entre o `SELECT` que vê
 * `RASCUNHO` e o `UPDATE` cabe uma ativação concorrente do mesmo contrato, e o `UPDATE` alcançaria
 * uma linha que já está no índice `contrato_imovel_vigente_uidx`. Quem fecha essa janela é o
 * envoltório `gravarSobIndiceDeVigencia` da porta — protegido por marcador `DECISÃO FECHADA` em
 * `packages/db/src/contrato.ts` —, e é por isso que
 * {@link ContratoService.traduzirConflitoDeGravacao} trata {@link ErroDeImovelComContratoVigente}
 * **também na alteração**, e não apenas onde a ativação da T7 o produzirá. Sem essa tradução, a
 * corrida devolveria `500` ao cliente: o defeito que a porta fechou, reaberto um andar acima.
 *
 * ---------------------------------------------------------------------------
 * A ATIVAÇÃO É UM ATO, com ORDEM FIXA e TRÊS escritas no MESMO commit
 * ---------------------------------------------------------------------------
 *
 * {@link ContratoService.ativar} é a primeira transição de estado governada do produto (ADR-0021), e
 * a ordem das dez etapas é **conteúdo**, não estilo — cada uma existe porque a anterior já decidiu
 * algo que ela precisa:
 *
 *   1. **localizar** — contrato inalcançável responde `404` antes de qualquer outra coisa, senão a
 *      recusa por estado diria que ele existe;
 *   2. **exigir `RASCUNHO`** — a máquina de estados é do servidor (ver a nota logo abaixo);
 *   3. **condições de entrada portadas** (RD-08) — o que o oráculo governa;
 *   4. **reconferir a circulação** das quatro referências, no **ponto único**
 *      {@link ContratoService.exigirCadastrosAlcancaveisEEmCirculacao} — a montagem pode ter sido há
 *      semanas, e a circulação é a **única** das seis condições capaz de mudar nesse intervalo;
 *   5. **derivar** por {@link derivarTerminoDaLocacao} e {@link derivarValorTotal} — este serviço
 *      **não recalcula nada** (ver a nota abaixo);
 *   6. **gravar** `ATIVO` com as duas derivações, com a recusa por imóvel ocupado vindo do índice
 *      único parcial e traduzida por {@link ContratoService.traduzirConflitoDeGravacao};
 *   7. **marcar o imóvel** `LOCADO` pela **porta estreita** `definirSituacaoDeLocacaoDoImovel`;
 *   8. **derivar as parcelas** por {@link derivarParcelasDoContrato} — função **pura** da porta, e a
 *      ativação não recalcula competência, vencimento nem referência (RD-18, RD-19);
 *   9. **emitir os N números** da série da cobrança por {@link emitirNumerosDeCobranca};
 *  10. **gravar as N parcelas** num `INSERT` só, por {@link criarCobrancasEmLote}.
 *
 * **As etapas 6, 7 e 10 são TRÊS escritas independentes, e nada no banco as pareia.** Nenhuma
 * restrição recusa um imóvel `DISPONIVEL` com contrato vigente — o docblock daquela porta nomeia o modo
 * de falha por extenso: *"não acusaria nada até a segunda locação ser recusada"* —, e nenhuma recusa um
 * contrato `ATIVO` sem parcela alguma. O que as mantém juntas é elas correrem na **mesma unidade de
 * trabalho**, aberta na borda: qualquer falha depois da etapa 6 desfaz também o `ATIVO`. É por isso que
 * este método **não abre unidade própria** e por isso que as etapas 7 e 10 não são requisições
 * seguintes.
 *
 * ---------------------------------------------------------------------------
 * AS PARCELAS NASCEM AQUI, e a atomicidade NÃO é mecanismo novo (fecha o D28)
 * ---------------------------------------------------------------------------
 *
 * As etapas 8 a 10 são o que a F3 acrescentou, e elas fecham o débito **D28** da fatia `contratos-de-locacao` (F2/T7)
 * exatamente onde ele foi agendado. O que a RN-06 exige — *recusa em qualquer etapa deixa o contrato
 * `RASCUNHO`, o imóvel como estava e **zero** parcelas* — sai do **commit único que já existia**: não
 * há orquestrador, não há barramento de evento e não há segunda unidade de trabalho. É a mesma
 * propriedade que já mantinha `ATIVO ⇔ LOCADO`, estendida a um terceiro efeito por ele correr no mesmo
 * `tx`.
 *
 * A ordem das três é conteúdo, e o ponto é qual delas recusa primeiro: a gravação do estado (etapa 6) é
 * a que colide no índice de vigência, e ela vem **antes** da emissão dos números. Uma ativação recusada
 * por imóvel ocupado, portanto, **não queima número da série** — e o furo que a ADR-0015 aceita por
 * escrito fica reservado às falhas posteriores à emissão, que é o mínimo possível.
 *
 * **`gerarCobrancasAutomaticamente: false` gera zero parcelas** (RD-20), e o campo não é interruptor de
 * implementação: é dado de negócio, portado do sistema antigo e decidido por contrato pelo operador.
 * Nesse caminho nenhum número é emitido — a série não avança por um contrato que não gera cobrança.
 *
 * ---------------------------------------------------------------------------
 * O CANCELAMENTO fecha a máquina de estados — e o que ele NÃO faz é a decisão
 * ---------------------------------------------------------------------------
 *
 * {@link ContratoService.cancelar} é a segunda transição governada (ADR-0021), e tem **cinco**
 * etapas, na ordem em que elas dependem umas das outras:
 *
 *   1. **localizar** — contrato inalcançável responde `404` antes de qualquer outra coisa, pela mesma
 *      razão da ativação: a recusa por estado diria que ele existe;
 *   2. **exigir `ATIVO`** — cancelar `RASCUNHO`, `CANCELADO` ou `ENCERRADO` é `422` nomeando
 *      `status`, no ponto único {@link ContratoService.exigirEstado};
 *   3. **gravar `CANCELADO`** — sem envoltório de conflito, e a ausência está explicada no docblock
 *      do método;
 *   4. **devolver o imóvel a `DISPONIVEL`** pela **mesma porta estreita** da ativação;
 *   5. **cancelar em cascata as cobranças canceláveis** do contrato, por
 *      {@link cancelarCobrancasDoContrato}.
 *
 * As etapas 3, 4 e 5 são, de novo, **três escritas independentes que nada no banco pareia** — e o que
 * as mantém juntas é a unidade de trabalho aberta na borda. O modo de falha do par quebrado aqui é o
 * espelho do da ativação, e pior de perceber: um imóvel que ficasse `LOCADO` depois de o contrato
 * dele ser cancelado ficaria **inlocável pela interface**, sem que nada acusasse.
 *
 * **Três coisas o cancelamento NÃO faz, e as três ausências são decisões desta fatia:**
 *
 *   * **não apaga e não retira de circulação.** O contrato cancelado permanece na carteira, legível e
 *     listado — é o histórico que a ADR-0014 preserva, e é o que separa *cancelar* de *retirar de
 *     circulação*. As duas derivações da ativação também ficam: elas descrevem o que o contrato foi
 *     enquanto valeu;
 *   * **não é idempotente.** Repetir o pedido é transição inválida e recebe `422` com
 *     `estadoAtual: 'CANCELADO'`, porque o segundo pedido significa que quem o fez **não sabia o
 *     estado** — e responder `200` o deixaria acreditar que acabou de cancelar algo;
 *   * **não exige o documento do contrato**, e a divergência com o oráculo é **deliberada e está
 *     decidida** — é a `DV-05`, veredito `PRODUTO_VENCE`, escrito antes da execução. No sistema
 *     antigo, `cancelar_contrato` começa por `obter_pdf_privado_bytes` e recusa quando não há PDF
 *     privado (o golden captura a recusa em `contrato_sem_pdf`); a guarda de lá protege o **carimbo**
 *     — o cancelamento existe para carimbar o arquivo —, e não o negócio. Aqui não há arquivo: o
 *     documento é composto sob demanda e **nunca armazenado** (ADR-0030), de modo que não existe
 *     artefato preexistente de que este ato possa depender. A pré-condição legada não é portada
 *     porque **não tem sobre o que incidir**, e é isso que fechou o débito D36 da fatia
 *     `contratos-de-locacao`, por construção, na T7 da fatia `documentos-e-confirmacao`. O `CT-710`
 *     afirma o `200`.
 *
 * ---------------------------------------------------------------------------
 * A CASCATA alcança as CANCELÁVEIS — e só elas — na MESMA unidade (RD-13)
 * ---------------------------------------------------------------------------
 *
 * A etapa 5 é o que a T10 acrescentou, e ela substitui a nota que este cabeçalho carregava até aqui —
 * *"a cascata cancela um conjunto vazio, e isso é correto; `negocio.cobranca` não existe nesta
 * fatia"*. As três afirmações daquela nota **deixaram de ser verdadeiras**: a tabela existe desde a
 * migração `0009`, a ativação passou a gravar N parcelas na T9, e não havia *"o mesmo caminho"* a
 * percorrer — nenhuma linha deste método tocava cobrança. Ela era descrição datada, não decisão, e por
 * isso não deixou marcador nem débito: o gatilho e o fecho caíram na mesma fatia.
 *
 * O que a cascata faz é **um `UPDATE` com predicado**, em {@link cancelarCobrancasDoContrato}, e o
 * predicado é a regra de negócio escrita em SQL sem tradução: `pago_em IS NULL AND cancelado_em IS
 * NULL`. É o dividendo de o estado ser derivado (ADR-0022) — *em aberto* e *cancelável* são o mesmo
 * conjunto —, e é a razão de a RD-13 não precisar de máquina de estados própria para a cobrança.
 *
 * **A paga e a já cancelada ficam FORA do conjunto, e não são reescritas.** A distinção é física, e não
 * de valor: `pago_em`, `valor_pago`, os quatro carimbos de mora e o `cancelado_em` original permanecem
 * na **mesma tupla**, com o `xmin` intacto. *Não alterou* e *reescreveu com o mesmo valor* são
 * indistinguíveis por comparação de campos, e é a segunda que a RN-13 proíbe.
 *
 * **Conjunto vazio não é erro**, e nenhum ramo deste arquivo o trata como tal: um contrato sem cobrança
 * alguma — `gerarCobrancasAutomaticamente: false`, ou carteira toda liquidada — é cancelado com `200` e
 * cascata de zero linhas. O que a borda publica dessa contagem é **só a linha de trilha** (§13.1): a
 * resposta continua sendo o contrato no root, sem declaração de efeito, pela razão registrada no
 * docblock do método.
 *
 * O efeito que a fatia anterior já provava — o imóvel voltar a `DISPONIVEL` — continua sendo a etapa 4,
 * e as duas correm no mesmo commit da transição.
 *
 * ---------------------------------------------------------------------------
 * A REGRA NÃO VAZA DE VOLTA — o serviço não recalcula nada
 * ---------------------------------------------------------------------------
 *
 * As duas derivações saem **inteiras** de `packages/db/src/derivacao-de-contrato.ts`, e não há neste
 * arquivo aritmética alguma de data ou de dinheiro. A proibição está escrita no cabeçalho daquele
 * módulo, e ela é a contrapartida de a RD-10 afirmar *"a derivação acontece num lugar só"*.
 *
 * ---------------------------------------------------------------------------
 * A PROVA DISTO É ESTÁTICA, e a razão está MEDIDA — leia antes de "simplificar"
 * ---------------------------------------------------------------------------
 *
 * A tentação de escrever `atual.valorMensal * atual.prazoMeses` aqui é grande, e **nenhum caso
 * comportamental desta suíte a reprova**. Isso foi medido nesta task, e a razão é do domínio, não da
 * suíte:
 *
 *   * o **golden é cego** à forma ingênua — ela acerta os 23 cenários do oráculo sem exceção;
 *   * e o **`numeric(15,2)` normaliza o resíduo antes de a resposta existir**. O valor publicado é o
 *     que volta do `RETURNING` da porta, e o produto exato de um valor de duas casas por um inteiro
 *     tem **sempre** duas casas — nunca cai na borda de arredondamento. No teto do domínio que
 *     `esquemaDeContratoNovo` admite (`MAIOR_VALOR_MONETARIO`, 9.99999999999999 × 10¹²), o erro
 *     máximo do ponto flutuante é `2^-52 ×` esse teto ≈ **0,00222** — menos da metade dos 0,005 de
 *     que a divergência precisaria. **O domínio inteiro é seguro por construção**, e não por acaso.
 *
 * Consequência prática, e é ela que importa para quem editar este arquivo: *a multiplicação ingênua
 * aqui seria hoje indistinguível pela rota*, e passaria por toda a suíte. O que a impede é a asserção
 * **estática** do `CT-413 (c)`, que varre este fonte e acusa qualquer aritmética de dinheiro, de prazo
 * ou de instante fora das duas chamadas puras. **É ela a rede desta decisão** (P4 do Protocolo
 * Antirregressão), e é por isso que ela existe apesar de haver casos E2E de sobra sobre a ativação.
 *
 * A indistinguibilidade **é de hoje, e não é garantia**: ela depende do teto atual da coluna e do
 * esquema. Um teto maior, uma escala diferente, ou um consumidor que publique o valor derivado em vez
 * do lido — e o resíduo passa a chegar ao cliente. A regra continua sendo a mesma: **a regra não vaza
 * de volta para cá.**
 *
 * ---------------------------------------------------------------------------
 * A MÁQUINA DE ESTADOS É NOSSA — a divergência do sistema antigo é DELIBERADA
 * ---------------------------------------------------------------------------
 *
 * No sistema antigo, `ativar_contrato_e_gerar_cobrancas` **não confere estado algum**: ele ativa a
 * partir de qualquer `status_contrato`, inclusive de um já cancelado. Aqui a ativação exige
 * `RASCUNHO`, e a diferença é decisão desta fatia, exigida pelo CA-10. A **ADR-0021** é explícita ao
 * deixá-la aqui: *"quais estados cada entidade tem continua sendo decisão da fatia dela; esta ADR
 * fixa a forma da transição e o critério da exigência"*. O que a ADR governa é a rota ser própria e
 * qual chave ela pede — não de que estado se pode partir.
 *
 * O oráculo (`golden/contrato-ativacao.json`) governa **três** coisas, e só três: as condições de
 * entrada (RD-08), as derivações (RD-10) e a guarda de imóvel ocupado (RD-09). **A máquina de estados
 * não está entre elas.** Sem esta nota, a rodada seguinte leria a guarda de estado como divergência
 * com o legado e a "corrigiria".
 *
 * ---------------------------------------------------------------------------
 * `INDISPONIVEL` NÃO IMPEDE A ATIVAÇÃO — e a assimetria com a T10 é o ponto
 * ---------------------------------------------------------------------------
 *
 * `ativar_imovel_contrato`, no sistema antigo, confere **apenas** `contrato_ativo`; ele **não olha**
 * `status_locacao`. Recusar a ativação de um imóvel `INDISPONIVEL` seria condição de entrada nova,
 * sem fonte no legado nem no PRD — contra a RN-08, que fixa as seis condições portadas.
 * `INDISPONIVEL` significa *"não ofereça nas buscas"*, e não *"proibido de locar"*.
 *
 * A assimetria com a rota de situação de locação da T10 — que **recusa** pôr em `INDISPONIVEL` um
 * imóvel locado — é deliberada e não é defeito: um sentido protege um invariante que existe
 * (`LOCADO` implica contrato vigente); o outro inventaria uma regra que ninguém declarou. O `CT-413`
 * mede o sub-caso.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA POR CONFLITO é traduzida AQUI, num ponto só
 * ---------------------------------------------------------------------------
 *
 * O vocabulário de erro é **fechado em sete códigos e não tem código de conflito**:
 * `STATUS_POR_CODIGO` é `Record<CodigoErro, number>`, de modo que acrescentar valor sem mapear status
 * não compila — e acrescentar código é decisão de contrato com efeito no handoff, não escolha de
 * implementação. A §10.1 da tech spec fixa, por isso, a forma das duas recusas: `422 CAMPO_INVALIDO`
 * com o campo culpado e o discriminador **`detalhes.conflito`**.
 *
 * A tradução é **uma** para as duas classes: duas ficariam livres para divergir no código, no campo
 * nomeado e no nome do discriminador — e os três são contrato publicado. É o mesmo desenho, e a mesma
 * razão, de `traduzirConflitoDeIdentificador` em {@link ../imoveis/imovel.service.js}.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type AgregadoDoDocumentoDoContrato,
  alterarContrato,
  ativarContrato,
  type ContratoPersistido,
  cancelarCobrancasDoContrato,
  cancelarContrato,
  criarCobrancasEmLote,
  criarContrato,
  type DerivacoesDaAtivacao,
  definirCirculacaoDoContrato,
  definirSituacaoDeLocacaoDoImovel,
  derivarParcelasDoContrato,
  derivarTerminoDaLocacao,
  derivarValorTotal,
  ErroDeCodigoDeCobrancaEmUso,
  ErroDeCodigoEmUso,
  ErroDeImovelComContratoVigente,
  emitirNumeroDeContrato,
  emitirNumerosDeCobranca,
  garantirContadorDeContrato,
  lerAgregadoDoContrato,
  lerAnoDaSerieDeContrato,
  listarContratos,
  localizarContrato,
  localizarImovel,
  localizarPessoa,
  localizarPessoas,
  type OpcoesDeCirculacao,
  type PapelDePessoa,
} from '@sysloc/db';
import { comporDocumentoDoContrato, type PortaDeRenderizacao } from '@sysloc/documentos';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type {
  AtivacaoDeContrato,
  Contrato,
  ContratoNovo,
  EnvelopeDeLista,
  EstadoDoContrato,
  Janela,
  SituacaoDeLocacao,
} from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_PORTA_DE_RENDERIZACAO } from '../configuracao/ambiente.js';

/** A página de contratos, na forma canônica de lista da ADR-0017. */
export type PaginaDeContratos = EnvelopeDeLista<Contrato>;

/**
 * O que o cancelamento devolve à borda: o contrato como ele ficou **e** quantas cobranças a cascata
 * alcançou.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO É TIPO PUBLICADO, e a ausência em `@syslocbr/contracts` é a decisão
 * ---------------------------------------------------------------------------
 *
 * Ele mora aqui, e **não** ao lado de `esquemaDaAtivacaoDeContrato`, porque não é contrato de API: a
 * resposta do cancelamento é o contrato no **root, sem declaração de efeito** — escolha registrada no
 * docblock de {@link ContratoService.cancelar}, e afirmada por igualdade de corpo inteiro no `CT-415`.
 * A contagem existe para a **linha de trilha** que a §13.1 declara (`cobranças canceladas em cascata`,
 * com `quantidade`), e para nada além dela.
 *
 * A separação em dois campos é o que põe o compilador atrás dessa fronteira: o manipulador continua
 * anotado `Promise<Contrato>`, de modo que devolver este objeto inteiro ao cliente **não compila**. A
 * alternativa — acrescentar `efeitos` ao corpo, como a ativação faz — publicaria contrato novo sem
 * fonte no PRD, e contrato publicado é caro de tirar depois.
 */
export interface ResultadoDoCancelamento {
  readonly contrato: Contrato;
  readonly cobrancasCanceladas: number;
}

/**
 * Os **quatro** campos que a conferência de cadastros referenciados lê — e nada além deles.
 *
 * Estrutural e nomeado, e **não** `ContratoNovo`: a conferência é declarada ponto único das escritas
 * **e** da ativação (T7), e na ativação não existe `ContratoNovo` nenhum — o que há lá é um contrato
 * já persistido, cuja coleção de fiadores é `{ id, nome }[]`. Tipar o parâmetro no corpo inteiro do
 * `POST` obrigaria o consumidor seguinte a **fabricar um objeto sintético** com dez campos para usar
 * quatro; e uma assinatura que cobra isso é precisamente o que faz um executor futuro preferir
 * escrever a própria conferência — o modo de falha que produziu os débitos D12, D38 e D40 nesta base.
 *
 * É o mesmo princípio, e a mesma razão, de {@link ContratoService.exigirEmCirculacao}, que recebe a
 * marca de retirada em vez do cadastro inteiro. Nenhum ponto de chamada atual muda: `ContratoNovo`
 * satisfaz este subconjunto estruturalmente.
 */
export interface CadastrosReferenciados {
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadoresIds: readonly string[];
}

/**
 * Os campos que a recusa nomeia, como o cliente os conhece (camelCase, ADR-0017).
 *
 * Constantes nomeadas, e não literais no ponto de cada recusa: elas são **contrato publicado** — o
 * cliente as usa para destacar o campo do formulário —, e os casos as afirmam por igualdade de corpo
 * inteiro.
 */
const CAMPO_DO_IMOVEL = 'imovelId';
const CAMPO_DO_LOCADOR = 'locadorId';
const CAMPO_DO_LOCATARIO = 'locatarioId';
const CAMPO_DOS_FIADORES = 'fiadoresIds';
const CAMPO_DO_CODIGO = 'codigo';
const CAMPO_DO_ESTADO = 'status';
const CAMPO_DA_DATA_DE_INICIO = 'dataInicioLocacao';
const CAMPO_DO_PRAZO = 'prazoMeses';
const CAMPO_DO_VALOR_MENSAL = 'valorMensal';
const CAMPO_DO_DIA_DE_VENCIMENTO = 'diaVencimento';

/**
 * O nome do discriminador de circulação dentro de `detalhes`, e o valor que ele carrega.
 *
 * Fixados pela §10.1 da tech spec **antes** da implementação, e não escolhidos aqui: a recusa por
 * cadastro fora de circulação nasce em quatro campos diferentes e voltará na ativação (T7), e um nome
 * escolhido por conveniência em cada ponto faria a comparação entre eles reprovar por divergência de
 * forma.
 */
const DISCRIMINADOR_DA_CIRCULACAO = 'circulacao';
const CADASTRO_RETIRADO = 'RETIRADO_DE_CIRCULACAO';

/**
 * O nome do discriminador de conflito dentro de `detalhes`, e os dois valores que ele carrega.
 *
 * O nome é o **mesmo** que a recusa por identificador municipal já publica em
 * {@link ../imoveis/imovel.service.js} — a §10.1 usa `detalhes.conflito` para toda colisão desta
 * superfície, e um segundo nome faria o cliente ter de aprender dois vocabulários para a mesma classe
 * de recusa.
 */
const DISCRIMINADOR_DO_CONFLITO = 'conflito';
const CONFLITO_DE_CODIGO = 'CODIGO_EM_USO';
const CONFLITO_DE_VIGENCIA = 'IMOVEL_COM_CONTRATO_VIGENTE';

/** A chave que carrega **qual** contrato ocupa o imóvel — o discriminante da RD-09. */
const CHAVE_DO_CONTRATO_VIGENTE = 'contratoVigente';

/**
 * O único estado em que o contrato aceita alteração (RD-05), o único de que ele parte para valer e o
 * único de que ele parte para ser cancelado (RD-02), mais o nome de cada ato recusado.
 *
 * **São três constantes, duas delas com o mesmo valor, e a duplicação é deliberada.** Elas
 * materializam regras diferentes — a janela de edição do rascunho e as duas origens de transição da
 * ADR-0021 —, e `ESTADO_ALTERAVEL` e `ESTADO_ATIVAVEL` coincidirem hoje é fato do domínio, não
 * identidade: aceitar alteração num estado a mais não autorizaria ativar a partir dele. Uma constante
 * só faria a segunda regra mudar junto com a primeira, em silêncio, num campo que o cliente lê.
 * `ESTADO_CANCELAVEL` é a evidência de que a coincidência era mesmo acidental — ele parte de `ATIVO`.
 * A anotação é `EstadoDoContrato` porque literal fora da união fechada de `@syslocbr/contracts` **não
 * compila**.
 *
 * O nome do ato viaja em `detalhes.transicaoPedida`, e é o que separa as recusas entre si: as quatro
 * respondem `422` nomeando `status`, e o que diz **o que** foi tentado é este valor.
 */
const ESTADO_ALTERAVEL: EstadoDoContrato = 'RASCUNHO';
const ESTADO_ATIVAVEL: EstadoDoContrato = 'RASCUNHO';
const ESTADO_CANCELAVEL: EstadoDoContrato = 'ATIVO';

/**
 * O estado que **produz a marca de cancelamento** no documento (RN-02).
 *
 * Ele é uma **quarta** constante, e não o destino de `ESTADO_CANCELAVEL`: aquele é o estado de que a
 * transição **parte** (`ATIVO`), e este é o estado em que o contrato **está** quando o documento é
 * pedido. Derivar um do outro amarraria a marca à máquina de estados — e bastaria a máquina ganhar
 * uma origem de cancelamento a mais para a marca sumir, ou aparecer, sem que nada acusasse.
 *
 * Ele existe aqui, e não em `@sysloc/documentos`, porque a composição **não conhece `status`**: a
 * marca chega a ela por parâmetro, e é essa ignorância que impede a marca de virar consequência de
 * outra coisa. O docblock de `OpcoesDoDocumentoDoContrato` registra a decisão do lado de lá.
 */
const ESTADO_COM_MARCA_DE_CANCELAMENTO: EstadoDoContrato = 'CANCELADO';
const ALTERACAO = 'ALTERACAO';
const ATIVACAO = 'ATIVACAO';
const CANCELAMENTO = 'CANCELAMENTO';

/**
 * Os atos que a guarda de estado sabe nomear — união fechada dos três literais acima.
 *
 * **Ela existe porque o irmão de `transicaoPedida` dentro do MESMO `detalhes` já tinha o compilador
 * atrás dele, e ele não tinha.** `estadoAtual` é `EstadoDoContrato`, união fechada de
 * `@syslocbr/contracts`; `transicaoPedida` era `string` solto, e os dois viajam no mesmo objeto da
 * mesma recusa, os dois publicados ao cliente. Um `'CANCELAMETO'` compilava, passava `pnpm build` e
 * `pnpm lint`, e só era pego pelo caso E2E — rede real, mas tardia, e dependente de o executor não
 * copiar o erro de digitação do produto para o teste. É o débito **D34 (F2/T7)**, fechado aqui: a
 * task que o Tech Review nomeou como devedora é justamente a que acrescenta o terceiro valor.
 *
 * `typeof <constante>` em vez de literais redigitados: a união e as constantes são o mesmo fato, e
 * redigitá-los deixaria os dois livres para divergir — que é o defeito que ela existe para fechar.
 */
type TransicaoPedida = typeof ALTERACAO | typeof ATIVACAO | typeof CANCELAMENTO;

/**
 * A situação que a ativação escreve no imóvel, pela **porta estreita** (RD-11).
 *
 * Tipada em {@link SituacaoDeLocacao} — o enum **completo** —, e não em `SituacaoInformavel`: `LOCADO`
 * é produzido por este ato e por nenhum corpo de requisição. A assimetria entre os dois tipos é
 * decisão fechada da fatia anterior, com prova dedicada, e o cabeçalho de
 * `packages/contracts/src/imovel.ts` registra a razão por extenso — **leia-o antes de qualquer
 * tentativa de simetrizar**.
 */
const SITUACAO_DO_IMOVEL_LOCADO: SituacaoDeLocacao = 'LOCADO';

/**
 * A situação que o cancelamento devolve ao imóvel, pela **mesma porta estreita** (RD-11).
 *
 * `DISPONIVEL` é o que o oráculo governa: em `golden/contrato-cancelamento.json`, o imóvel do
 * contrato cancelado sai com `status_locacao: "Disponível"`, e o do contrato que **não** foi
 * cancelado permanece `Locado`.
 *
 * **A situação anterior à locação não é preservada, e a perda é anterior a este ato.** Um imóvel que
 * estava `INDISPONIVEL` ao ser locado teve a marca sobrescrita por `LOCADO` na ativação — a coluna
 * guarda um valor só —, de modo que o cancelamento não tem de onde restaurá-la. Devolver `DISPONIVEL`
 * é o que o oráculo manda, e inventar uma memória da situação anterior seria regra sem fonte. Quem
 * quiser o imóvel fora das buscas depois do cancelamento usa a rota de situação de locação.
 *
 * Diferente de `SITUACAO_DO_IMOVEL_LOCADO`, este valor **também** pertence a `SituacaoInformavel` —
 * o cliente pode escrevê-lo pela rota própria. A tipagem aqui continua sendo o enum completo porque
 * quem escreve é a porta estreita, e não o corpo de uma requisição.
 */
const SITUACAO_DO_IMOVEL_DISPONIVEL: SituacaoDeLocacao = 'DISPONIVEL';

/**
 * A declaração de efeito que acompanha o contrato na resposta da ativação (CA-06).
 *
 * **Ela deixou de ser constante, e a mudança é o fecho do débito **D28** da fatia `contratos-de-locacao` (F2/T7).** Até a
 * F3 o valor era o literal `false` congelado — a ativação não gerava cobrança (RD-12) —, e o literal
 * existia no esquema para obrigar esta fatia a **tocar o contrato** em vez de mudar o significado da
 * resposta por omissão. O gatilho chegou: a ativação passou a gerar as parcelas, e o que se publica é
 * **quantas** nasceram.
 *
 * A anotação é `AtivacaoDeContrato['efeitos']`, e não um objeto solto: o nome do campo é contrato
 * publicado (o cliente o lê), e derivá-lo do esquema é o que põe o compilador atrás dele — um
 * `cobrancasGeradas` com erro de digitação, ou um efeito inventado ao lado, **não compila**. É a mesma
 * razão que fez o valor viver aqui quando era literal.
 *
 * O argumento é a contagem das linhas que a porta **de fato gravou**, e não `parcelas.length`: o que a
 * resposta declara é efeito ocorrido, não intenção.
 */
function efeitosDaAtivacao(cobrancasGeradas: number): AtivacaoDeContrato['efeitos'] {
  return { cobrancasGeradas };
}

/**
 * As **seis condições de entrada portadas** do sistema antigo (RD-08), na ordem em que ele as confere.
 *
 * ---------------------------------------------------------------------------
 * ELAS EXISTEM AQUI, E A CONFERÊNCIA NÃO É REDUNDANTE
 * ---------------------------------------------------------------------------
 *
 * Nesta spec as seis são **estruturalmente garantidas na criação** — três `check` no banco
 * (`contrato_dia_vencimento_chk`, `contrato_prazo_positivo_chk`,
 * `contrato_valor_mensal_positivo_chk`), três colunas `NOT NULL` e o esquema fechado da borda. Nenhum
 * corpo que a superfície aceita hoje as viola, e é por isso que nenhum caso de rota as alcança.
 *
 * A conferência existe assim mesmo, e por uma razão que não é zelo: **é ela o ponto que o oráculo
 * governa**. A RN-08 diz que quem decide as condições de fazer valer é
 * `validar_contrato_para_ativacao`, do sistema antigo — não o esquema de entrada, que é uma segunda
 * materialização do mesmo fato. Um caminho futuro que relaxe a criação (uma importação da virada, um
 * corpo parcial, uma coluna que ganhe padrão) encontraria esta tabela; sem ela, encontraria a
 * gravação.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É A DO ORÁCULO, e a recusa nomeia a PRIMEIRA insatisfeita
 * ---------------------------------------------------------------------------
 *
 * `validar_contrato_para_ativacao` confere data, prazo, valor, dia, imóvel e locatário **nessa
 * ordem**, e para na primeira. Reproduzi-la é o que faz o mesmo contrato inapto nomear sempre o mesmo
 * campo — uma ordem escolhida por conveniência faria a resposta depender de qual condição o
 * implementador escreveu primeiro.
 *
 * Os dois limites do dia de vencimento são escritos aqui, e **não** importados de
 * `@syslocbr/contracts`: eles são privados daquele módulo, e a fonte declarada desta conferência é o
 * oráculo (`dia_vencimento < 1 or dia_vencimento > 28`), não o esquema da borda. Os dois valores
 * coincidem porque **derivam do mesmo lugar**, e o `check` do banco é a terceira materialização.
 */
interface CondicaoDeEntrada {
  /** O campo que a recusa nomeia, como o cliente o conhece (camelCase, ADR-0017). */
  readonly campo: string;
  readonly satisfeita: (contrato: ContratoPersistido) => boolean;
}

const MENOR_DIA_DE_VENCIMENTO_DO_ORACULO = 1;
const MAIOR_DIA_DE_VENCIMENTO_DO_ORACULO = 28;

const CONDICOES_DE_ENTRADA_DA_ATIVACAO: readonly CondicaoDeEntrada[] = [
  { campo: CAMPO_DA_DATA_DE_INICIO, satisfeita: (c) => c.dataInicioLocacao.length > 0 },
  { campo: CAMPO_DO_PRAZO, satisfeita: (c) => c.prazoMeses > 0 },
  { campo: CAMPO_DO_VALOR_MENSAL, satisfeita: (c) => c.valorMensal > 0 },
  {
    campo: CAMPO_DO_DIA_DE_VENCIMENTO,
    satisfeita: (c) =>
      c.diaVencimento >= MENOR_DIA_DE_VENCIMENTO_DO_ORACULO &&
      c.diaVencimento <= MAIOR_DIA_DE_VENCIMENTO_DO_ORACULO,
  },
  { campo: CAMPO_DO_IMOVEL, satisfeita: (c) => c.imovelId.length > 0 },
  { campo: CAMPO_DO_LOCATARIO, satisfeita: (c) => c.locatarioId.length > 0 },
];

/** O papel de cada pessoa referenciada, nomeado uma vez — a porta de leitura é parametrizada nele. */
const PAPEL_DO_LOCADOR: PapelDePessoa = 'locador';
const PAPEL_DO_LOCATARIO: PapelDePessoa = 'locatario';
const PAPEL_DO_FIADOR: PapelDePessoa = 'fiador';

@Injectable()
export class ContratoService {
  /**
   * A **única** dependência injetada, e o que ela não é importa tanto quanto o que ela é.
   *
   * `AcessoAoBanco` **não** está aqui, e a ausência continua sendo o mecanismo da decisão D1 — ver o
   * cabeçalho deste arquivo. O que entra é a porta de **saída** do documento, e ela chega por
   * composição do módulo (ADR-0025): quem monta o processo escolhe o adaptador, e nem este serviço
   * nem a composição do documento sabem que existe um motor de PDF.
   *
   * Importar `criarRenderizadorPdf` aqui seria a saída mais curta e a errada: ela faria este arquivo
   * — que é regra de domínio — depender do motor de renderização, e daria ao processo um segundo
   * lugar onde escolher o adaptador. É a mesma decisão, e a mesma razão, de
   * {@link ../automacao/automacao.service.js} receber a porta de e-mail em vez de construir o
   * transporte de SMTP.
   */
  constructor(
    @Inject(TOKEN_PORTA_DE_RENDERIZACAO) private readonly renderizacao: PortaDeRenderizacao,
  ) {}

  /**
   * Garante o contador do escopo `(empresa da sessão, ano)` e devolve **o ano lido**.
   *
   * ---------------------------------------------------------------------------
   * ELA É A PRIMEIRA das DUAS UNIDADES SEQUENCIAIS — e a separação é a ADR-0015
   * ---------------------------------------------------------------------------
   *
   * Ela corre numa unidade de trabalho **própria, que commita antes de a segunda abrir**. Fundir as
   * duas devolveria o número `00001` no desfazimento: a criação da sequência e o `nextval` cairiam na
   * mesma transação, o desfazimento apagaria a sequência recém-criada, e o contrato seguinte a
   * recriaria e tomaria `nextval = 1` **outra vez** — o número teria sido **reusado**, contra a
   * cláusula literal da ADR-0015 (*"nunca reusado, nem por registro excluído, nem por criação
   * abortada"*). Com as duas unidades, a sequência já está commitada quando o `nextval` corre, e a
   * criação abortada queima o número para sempre, que é o furo que a ADR aceita por escrito.
   *
   * O custo é uma transação curta por criação — no caso comum um `CREATE SEQUENCE IF NOT EXISTS` que
   * só consulta o catálogo —, num volume medido de dezenas de contratos por ano.
   *
   * **As duas unidades não aninham**: a segunda começa depois de a primeira fechar, e o marcador
   * `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`, que recusa abrir uma segunda
   * unidade **de dentro** de uma aberta, não é tocado.
   *
   * **O ano é lido AQUI e viaja daqui em diante.** Ele sai do relógio do **banco**, e não do processo
   * — a razão está no docblock de `lerAnoDaSerieDeContrato` —, e é lido **uma vez**: o mesmo valor
   * alimenta o contador desta unidade, a emissão do número na seguinte e o código que a porta compõe.
   * Uma segunda leitura permitiria às duas unidades discordarem na virada do ano.
   */
  async garantirSerie(tx: TransactionSql): Promise<number> {
    const ano = await lerAnoDaSerieDeContrato(tx);

    await garantirContadorDeContrato(tx, ano);

    return ano;
  }

  /**
   * Monta o contrato e devolve o corpo que a rota publica.
   *
   * **O ano chega pronto, e esta função não o relê.** Ele foi lido uma única vez pela borda, na
   * primeira unidade de trabalho, e é o mesmo que alimentou `garantirContadorDeContrato`. Relê-lo
   * aqui permitiria à segunda unidade discordar da primeira na virada do ano — o número teria saído
   * do contador de um ano e o código anunciaria o outro. A razão está por extenso no docblock de
   * `NumeroDaSerie`, em `packages/db/src/contrato.ts`.
   *
   * As conferências vêm **antes** da emissão porque é delas que sai o `404`; a emissão do número vem
   * depois, e o número que ela consome **não volta** se a gravação abortar (ADR-0015, ADR-0020).
   */
  async criar(tx: TransactionSql, entrada: ContratoNovo, ano: number): Promise<Contrato> {
    await this.exigirCadastrosAlcancaveisEEmCirculacao(tx, entrada);

    const numero = await emitirNumeroDeContrato(tx, ano);

    return publicarContrato(
      await this.traduzirConflitoDeGravacao(
        async () => await criarContrato(tx, entrada, { ano, numero }),
      ),
    );
  }

  /**
   * Lê a página pedida.
   *
   * O envelope é montado aqui, e a janela devolvida é a que foi **de fato servida** — não um eco do
   * que o cliente pediu. `total` é a contagem na empresa inteira, e é ela que permite ao cliente saber
   * que existe uma página seguinte sem pedi-la (ADR-0017).
   *
   * As opções de circulação **atravessam** este serviço sem serem interpretadas: quem decide o que a
   * leitura enxerga é a porta, e reimplementar o predicado aqui é precisamente o defeito que a fatia
   * anterior fixou.
   */
  async listar(
    tx: TransactionSql,
    janela: Janela,
    opcoes: OpcoesDeCirculacao,
  ): Promise<PaginaDeContratos> {
    const { contratos, total } = await listarContratos(tx, janela, opcoes);

    return {
      itens: contratos.map(publicarContrato),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Lê o contrato pelo **código** (ADR-0017).
   *
   * **Ela alcança o contrato retirado de circulação**, e responde `200` com a marca preenchida — sem
   * isso a recirculação ficaria inalcançável pela interface, porque a rota que a executa é sobre o
   * mesmo `:codigo`.
   */
  async ler(tx: TransactionSql, codigo: string): Promise<Contrato> {
    return publicarContrato(this.exigir(await localizarContrato(tx, codigo)));
  }

  /**
   * Lê o agregado de que o documento é composto — **a única etapa da rota do documento que exige o
   * executor**.
   *
   * ---------------------------------------------------------------------------
   * O DOCUMENTO SAI EM DUAS METADES, e a divisão é POR EXIGÊNCIA DE EXECUTOR
   * ---------------------------------------------------------------------------
   *
   * Esta metade toca o banco; {@link ContratoService.renderizarDocumento} não toca, e por isso as
   * duas **não** podem ser um método só. A razão está por extenso no docblock daquele método, e é
   * ela que governa o ponto de chamada no controlador — leia-a antes de fundi-las de volta.
   *
   * ---------------------------------------------------------------------------
   * O AGREGADO VEM DE UMA CONSULTA, e o `404` sai do PONTO ÚNICO
   * ---------------------------------------------------------------------------
   *
   * {@link lerAgregadoDoContrato} traz contrato, locador, locatário, imóvel e fiadores de uma vez,
   * sob RLS. Contrato de outra empresa **não retorna linha** — quem decide é a política do banco, e
   * não uma comparação escrita aqui —, e a ausência atravessa {@link ContratoService.exigir}, o
   * mesmo ponto que as outras cinco rotas de `:codigo` usam. É o que faz o contrato alheio e o
   * contrato inexistente responderem o **mesmo** `404`, byte a byte.
   *
   * **A tradução da ausência fica AQUI, e não sobe para a segunda metade**: ela é a única das três
   * etapas que sabe que houve uma consulta, e é dentro da unidade de trabalho que a ausência de
   * linha significa alguma coisa. Traduzi-la depois obrigaria a segunda metade a receber
   * `AgregadoDoDocumentoDoContrato | undefined` e a ter uma **segunda** tradução da mesma ausência —
   * exatamente o que o ponto único existe para impedir.
   */
  async agregadoDoDocumento(
    tx: TransactionSql,
    codigo: string,
  ): Promise<AgregadoDoDocumentoDoContrato> {
    return this.exigir(await lerAgregadoDoContrato(tx, codigo));
  }

  /**
   * Compõe o **documento do contrato** e devolve os bytes dele — **fora da unidade de trabalho**.
   *
   * ---------------------------------------------------------------------------
   * ELA NÃO RECEBE EXECUTOR, e a ausência é o mecanismo (Gate 2 / T7, rodada 1)
   * ---------------------------------------------------------------------------
   *
   * As duas etapas daqui — a função pura da composição e a porta de renderização — **não tocam o
   * banco**, e a assinatura sem `tx` é o que torna isso verdade por construção, e não por promessa.
   * Ela existe separada de {@link ContratoService.agregadoDoDocumento} porque a renderização custa
   * **~0,5 s medidos** por pedido (5 amostras entre 417 e 785 ms, sobre o contrato mínimo), e o
   * `sobContextoDaSessao` da borda é um `sql.begin` real: mantê-la dentro da unidade reservava uma
   * conexão física do pool — que é **um só para o processo inteiro**, no tamanho padrão de
   * `postgres.js` — e deixava um `idle in transaction` de meio segundo por download, segurando o
   * horizonte de vacuum. Sob concorrência modesta o pool esgota e **toda outra rota do processo
   * passa a esperar por conexão**: a degradação aparece longe da causa, e nenhum caso desta suíte
   * mede concorrência.
   *
   * ⚠️ **Esta é a primeira rota desta borda cuja unidade de trabalho NÃO cobre o manipulador
   * inteiro, e a exceção é deliberada.** A regra da §5.1 continua valendo — a unidade abre na borda,
   * e o serviço recebe o executor; o que muda é a **extensão** dela, que passa a cobrir só o que
   * exige executor. Nada aqui contraria a decisão D1: este método não abre unidade nenhuma, e a
   * ordem dos cabeçalhos no controlador não muda, porque os bytes continuam existindo antes deles.
   * Uniformizar de volta — pôr as três etapas numa continuação só, "como as outras seis rotas" —
   * reabre o defeito de desempenho medido acima. O `CT-714 (b)` é a rede.
   *
   * **A decisão está escriturada onde a tentação acontece**, e não aqui: o marcador
   * `DECISÃO FECHADA — T7 / Gate 2` mora em `contratos/contrato.controller.ts`, imediatamente acima
   * do `sobContextoDaSessao` da rota do documento, que é o ponto em que alguém fundiria as duas
   * metades. Ele carrega o `REVERTER EXIGE`; este docblock é o detalhe por extenso, e **não** é um
   * segundo marcador — uma decisão tem um marcador só, e o outro ponto referencia.
   *
   * ---------------------------------------------------------------------------
   * NADA É GRAVADO, e a ausência de caminho de escrita É a garantia (ADR-0030)
   * ---------------------------------------------------------------------------
   *
   * As três etapas da rota são leitura, função pura e renderização em memória. Não existe, aqui nem
   * abaixo daqui, uma escrita de documento: a coerência entre o que o documento diz e o que o
   * cadastro guarda não vem de alguém lembrar de invalidar uma cópia — vem de **não haver cópia**. É
   * a decisão central da fatia, e a alternativa (guardar os bytes e invalidá-los quando o cadastro
   * mudar) é exatamente a classe de defeito que a RN-01 fecha.
   *
   * Reaproveitamento por cache continua sendo otimização compatível com a ADR-0030 — *"ele muda o
   * custo, não o que o produto promete"* —, e está **adiado por escrito** no PRD. Ele não entra aqui
   * por conta de desempenho: instalado neste ponto, o cache passa a ser a fonte, e a propriedade que
   * o `CT-714` guarda some. Se um dia houver exigência probatória de instante passado, o caminho
   * legítimo é **superseder a ADR-0030**, nunca guardar cópia por baixo dela.
   *
   * ---------------------------------------------------------------------------
   * A MARCA DE CANCELAMENTO É DERIVADA AQUI — e a composição não conhece `status`
   * ---------------------------------------------------------------------------
   *
   * `{ cancelado: status === 'CANCELADO' }` é a **única** origem da marca (RN-02), e ela é
   * parâmetro. O agregado que a composição recebe não carrega `status`, de modo que não existe, lá
   * dentro, um segundo caminho capaz de ligá-la — nem um `retiradoEm`, nem uma data de fim, nem um
   * valor zerado. O legado *mesclava* a marca sobre os bytes de um PDF já gravado e regravava o
   * arquivo (`DV-07`); aqui não há bytes prontos para mesclar, e a garantia é **estrutural**.
   *
   * A derivação acompanha a renderização, e não a leitura: é aqui que `status` deixa de existir para
   * o resto do caminho, e é aqui que ela precisa estar para que a composição continue ignorando-o.
   *
   * **A falha da renderização não é tratada aqui**, e a ausência é a decisão: a porta rejeita quando
   * não conseguiu produzir o documento, e a rejeição sobe intacta até o filtro global, virando
   * `500 ERRO_INTERNO` com a linha `error` no journal. Um tratamento próprio neste ponto teria de
   * escolher um código do vocabulário fechado para uma falha que não é do cliente — e
   * `REQUISICAO_RECUSADA` é proibido a código de negócio pelo marcador `DECISÃO FECHADA` de
   * `comum/filtro-excecao.ts`. Não há repetição e não há timeout, pela razão que o cabeçalho de
   * `porta-de-renderizacao.ts` registra: não existe processo externo a esperar. **A rejeição
   * acontecer fora da unidade não muda nada disso**: a leitura não gravou coisa alguma, e não há
   * efeito a desfazer.
   */
  async renderizarDocumento(agregado: AgregadoDoDocumentoDoContrato): Promise<Uint8Array> {
    const representacao = comporDocumentoDoContrato(agregado.dados, {
      cancelado: agregado.status === ESTADO_COM_MARCA_DE_CANCELAMENTO,
    });

    return await this.renderizacao.renderizar(representacao);
  }

  /**
   * Reescreve o contrato com o corpo completo (§4.1.1) e devolve como ele ficou.
   *
   * **O código não está no corpo e não muda** — a ausência dele na instrução da porta é o mecanismo,
   * e a ADR-0015 existe para mantê-lo estável. A coleção de fiadores é **substituída por inteiro**,
   * nunca mesclada.
   *
   * A ordem dos três passos é conteúdo: o contrato inalcançável responde `404` antes de qualquer
   * outra coisa (senão a recusa por estado diria que o contrato existe); a guarda de estado vem em
   * seguida, porque a janela de edição é do **pai**; e as conferências dos cadastros correm por
   * último, sobre um alvo que já se sabe alterável.
   */
  async alterar(tx: TransactionSql, codigo: string, entrada: ContratoNovo): Promise<Contrato> {
    const atual = this.exigir(await localizarContrato(tx, codigo));

    // A guarda da RD-05. Ela é leitura-antes-de-gravar e **não** substitui a defesa da porta contra a
    // corrida — ver o cabeçalho deste arquivo e o marcador de `traduzirConflitoDeGravacao`.
    this.exigirEstado(atual, ESTADO_ALTERAVEL, ALTERACAO);
    await this.exigirCadastrosAlcancaveisEEmCirculacao(tx, entrada);

    return publicarContrato(
      this.exigir(
        await this.traduzirConflitoDeGravacao(
          async () => await alterarContrato(tx, codigo, entrada),
        ),
      ),
    );
  }

  /**
   * Faz o contrato valer: transita `RASCUNHO → ATIVO`, deriva as duas grandezas, ocupa o imóvel,
   * **gera as parcelas de aluguel** e devolve o corpo da transição — **num commit só**.
   *
   * A ordem das dez etapas, a razão de cada uma e as notas que governam este método — a atomicidade das
   * três escritas, a proibição de recalcular e a divergência deliberada da máquina de estados — estão
   * no cabeçalho deste arquivo. Não as reproduzo aqui.
   *
   * **Ela recebe o executor e não abre unidade própria.** É isso, e nada mais, que faz as etapas 6, 7 e
   * 10 serem um commit só: falha em qualquer ponto deixa o contrato `RASCUNHO`, o imóvel exatamente
   * como estava e **zero** parcelas gravadas.
   *
   * **O ano chega pronto, e este método não o relê.** Ele foi lido uma única vez pela borda, na
   * primeira unidade de trabalho, do MESMO eixo (`lerAnoDaSerieDeCobranca`) que alimentou
   * `garantirContadorDeCobranca` — e é o eixo da cobrança, não o do contrato: os dois derivam de
   * relógios diferentes de propósito, e a razão está no docblock daquela função. Relê-lo aqui
   * permitiria à segunda unidade discordar da primeira na virada do ano, e o código anunciaria um
   * contador que não emitiu aquele número (ADR-0015, ADR-0020).
   *
   * A conferência de circulação reusa {@link ContratoService.exigirCadastrosAlcancaveisEEmCirculacao}
   * — o **ponto único** das escritas —, montada a partir do contrato persistido. É para isso que
   * {@link CadastrosReferenciados} é estrutural e de quatro campos: aqui não existe `ContratoNovo`
   * nenhum, e uma assinatura que cobrasse o corpo inteiro do `POST` obrigaria este método a fabricar
   * um objeto sintético — que é precisamente o que faria um executor futuro preferir escrever a
   * própria conferência.
   */
  async ativar(tx: TransactionSql, codigo: string, ano: number): Promise<AtivacaoDeContrato> {
    const atual = this.exigir(await localizarContrato(tx, codigo));

    this.exigirEstado(atual, ESTADO_ATIVAVEL, ATIVACAO);
    this.exigirCondicoesDeEntrada(atual);
    await this.exigirCadastrosAlcancaveisEEmCirculacao(tx, {
      imovelId: atual.imovelId,
      locadorId: atual.locadorId,
      locatarioId: atual.locatarioId,
      fiadoresIds: atual.fiadores.map((fiador) => fiador.id),
    });

    // As duas derivações vêm PRONTAS das funções puras da RD-10, e não há aritmética de data nem de
    // dinheiro neste arquivo. **Uma conta escrita aqui seria hoje indistinguível pela rota** — o
    // oráculo é cego à forma ingênua e o `numeric(15,2)` normaliza o resíduo antes de a resposta
    // existir —, e é por isso que a rede desta decisão é a asserção ESTÁTICA do `CT-413 (c)`. A
    // medição e o cálculo do limite estão no cabeçalho deste arquivo; leia-os antes de "simplificar".
    const derivacoes: DerivacoesDaAtivacao = {
      dataFimLocacao: derivarTerminoDaLocacao(atual.dataInicioLocacao, atual.prazoMeses),
      valorTotalContrato: derivarValorTotal(atual.valorMensal, atual.prazoMeses),
    };

    // A recusa por imóvel já ocupado vem do índice único parcial, e **não** de um `if` que leu antes:
    // entre o `SELECT` e o `UPDATE` cabe outra ativação, e as duas passariam. A tradução é a mesma
    // das escritas de cadastro, num ponto só.
    const ativado = this.exigir(
      await this.traduzirConflitoDeGravacao(
        async () => await ativarContrato(tx, codigo, derivacoes),
      ),
    );

    // A segunda escrita, pela PORTA ESTREITA — nunca pela porta de alteração de imóvel, que é tipada
    // no subconjunto informável justamente para que `LOCADO` não seja alcançável por corpo de
    // requisição. Ela corre depois da gravação do estado e na MESMA unidade: nada no banco pareia as
    // duas, e é o commit único que impede um imóvel `DISPONIVEL` com contrato vigente.
    await definirSituacaoDeLocacaoDoImovel(tx, ativado.imovelId, SITUACAO_DO_IMOVEL_LOCADO);

    return {
      ...publicarContrato(ativado),
      efeitos: efeitosDaAtivacao(await this.gerarParcelas(tx, ativado, ano)),
    };
  }

  /**
   * Grava as parcelas de aluguel do contrato recém-ativado e devolve **quantas o banco escreveu** —
   * a TERCEIRA escrita da ativação, na MESMA unidade de trabalho.
   *
   * ---------------------------------------------------------------------------
   * ELE NÃO DERIVA NADA, e a ausência é o que mantém a regra num lugar só
   * ---------------------------------------------------------------------------
   *
   * As N parcelas vêm **inteiras** de {@link derivarParcelasDoContrato}, a função pura da porta
   * (RD-18, RD-19), e não há neste arquivo aritmética alguma de calendário, de competência ou de
   * referência. É a mesma proibição, com a mesma razão, que já vale para as duas derivações da
   * ativação: o oráculo é o golden, a regra tem um lugar só, e ela **não vaza de volta** para cá. A
   * rede é a asserção estática do `CT-413 (c)`, que varre este fonte.
   *
   * O código também não é composto aqui: ele sai da série do banco, pelas duas funções
   * `SECURITY DEFINER` (ADR-0020), e o par `(ano, número)` viaja junto até a porta que grava.
   *
   * ---------------------------------------------------------------------------
   * A RD-20 é o PRIMEIRO ramo, e é ela que impede a série de avançar em vão
   * ---------------------------------------------------------------------------
   *
   * `gerarCobrancasAutomaticamente: false` devolve **zero** sem emitir número nenhum e sem tocar o
   * banco. A ordem importa: emitir antes de olhar o campo queimaria N números — que a ADR-0015 proíbe
   * reusar — para gravar nada. O campo é dado de negócio do contrato, não interruptor de
   * implementação; ele existe na tabela desde a F2 e este é o primeiro consumidor dele.
   *
   * ---------------------------------------------------------------------------
   * O QUE ELE DEVOLVE é a CONTAGEM DO BANCO, e não a da lista derivada
   * ---------------------------------------------------------------------------
   *
   * `criarCobrancasEmLote` devolve os códigos que o `RETURNING` trouxe, e é o comprimento **dessa**
   * lista que a resposta publica. Devolver `parcelas.length` faria o efeito declarado descrever a
   * intenção da aplicação em vez do que o banco gravou — e as duas divergirem é justamente o que um
   * `INSERT` de N linhas parcialmente recusado produziria.
   */
  private async gerarParcelas(
    tx: TransactionSql,
    contrato: ContratoPersistido,
    ano: number,
  ): Promise<number> {
    if (!contrato.gerarCobrancasAutomaticamente) {
      return 0;
    }

    const parcelas = derivarParcelasDoContrato(contrato);
    const numeros = await emitirNumerosDeCobranca(tx, ano, parcelas.length);

    // A colisão do código EMITIDO atravessa o MESMO ponto único das outras duas recusas desta
    // superfície — ver {@link ContratoService.traduzirConflitoDeGravacao}. Sem ela, uma série semeada
    // para trás na virada (F7) devolveria ao cliente o `23505` do driver em `500`, no meio de uma
    // ativação; e uma tradução escrita aqui seria a segunda forma do mesmo envelope publicado.
    const gravadas = await this.traduzirConflitoDeGravacao(
      async () => await criarCobrancasEmLote(tx, contrato.id, parcelas, numeros),
    );

    return gravadas.length;
  }

  /**
   * Faz o contrato deixar de valer: transita `ATIVO → CANCELADO`, devolve o imóvel a `DISPONIVEL` e
   * **cancela em cascata as cobranças canceláveis dele** — **num commit só**.
   *
   * A ordem das cinco etapas, a razão de cada uma, o que a cascata **não** alcança e o que **não** foi
   * portado do sistema antigo estão no cabeçalho deste arquivo. Não os reproduzo aqui.
   *
   * **Ela recebe o executor e não abre unidade própria**, pela mesma razão de
   * {@link ContratoService.ativar}: é isso, e nada mais, que faz as três escritas serem um commit só.
   * Falha em qualquer ponto deixa o contrato `ATIVO`, o imóvel `LOCADO` e **nenhuma** cobrança
   * cancelada — não existe cascata parcial, porque não existe segunda unidade de trabalho.
   *
   * **Ela devolve {@link ResultadoDoCancelamento}, e não o contrato sozinho**, porque a §13.1 declara o
   * evento `cobranças canceladas em cascata` com `quantidade`, e o logger vive na borda. A contagem
   * viaja daqui até a linha de trilha e **não** entra na resposta — ver o docblock daquele tipo.
   *
   * **A gravação NÃO passa por {@link ContratoService.traduzirConflitoDeGravacao}, e a ausência é a
   * decisão.** As duas classes que o envoltório traduz são impossíveis aqui: `cancelarContrato` não
   * escreve `codigo`, e ela **sai** do índice `contrato_imovel_vigente_uidx` em vez de disputá-lo — o
   * índice é parcial sobre `status = 'ATIVO'`, e é justamente essa saída que torna possível montar um
   * contrato novo sobre o mesmo imóvel. Envolvê-la mesmo assim anunciaria no fonte uma colisão que
   * este caminho não tem, e a primeira leitura do trecho gastaria uma rodada procurando por ela.
   *
   * **A resposta é o contrato no root, SEM declaração de efeito**, e isso é escolha registrada, não
   * esquecimento: o CA-06 fala **só** da ativação, e a RN-12 diz literalmente *"a resposta da ativação
   * declara isso explicitamente"*. Publicar `efeitos` aqui seria inventar contrato sem fonte — e um
   * contrato publicado é caro de tirar depois.
   */
  async cancelar(tx: TransactionSql, codigo: string): Promise<ResultadoDoCancelamento> {
    const atual = this.exigir(await localizarContrato(tx, codigo));

    // A guarda de estado, no MESMO ponto único que a alteração e a ativação usam — a recusa muda de
    // ato, e não de forma. Cancelar um `RASCUNHO` é recusado de propósito: rascunho abandonado se
    // **retira de circulação**, e as duas operações têm efeitos distintos (o cancelamento libera o
    // imóvel; a retirada não).
    this.exigirEstado(atual, ESTADO_CANCELAVEL, CANCELAMENTO);

    const cancelado = this.exigir(await cancelarContrato(tx, codigo));

    // A segunda escrita, pela PORTA ESTREITA e na MESMA unidade — o espelho exato da etapa 7 da
    // ativação. Nada no banco pareia as duas: um imóvel que ficasse `LOCADO` sem contrato vigente não
    // acusaria nada, e ninguém conseguiria locá-lo de novo pela interface.
    await definirSituacaoDeLocacaoDoImovel(tx, cancelado.imovelId, SITUACAO_DO_IMOVEL_DISPONIVEL);

    // A TERCEIRA escrita, na MESMA unidade: a cascata. O predicado das canceláveis vive na porta e
    // **não** é reescrito aqui — não há neste arquivo condicional sobre estado, vencimento ou carimbo
    // de cobrança, e é essa ausência que mantém a RD-13 num lugar só. Ela corre DEPOIS das duas
    // escritas do contrato, e a ordem é indiferente à atomicidade: qualquer falha desfaz as três.
    //
    // O identificador é o **UUID** do contrato, e não o código: a coluna da cobrança é `uuid`, e a
    // chave estrangeira composta é `(contrato_id, empresa_id)`. Zero linhas afetadas é resultado
    // legítimo, e nenhum ramo daqui o trata como falha.
    const cobrancasCanceladas = await cancelarCobrancasDoContrato(tx, cancelado.id);

    return { contrato: publicarContrato(cancelado), cobrancasCanceladas };
  }

  /**
   * Retira o contrato de circulação, ou o devolve a ela (ADR-0014).
   *
   * **Nada é apagado, nada transita e o imóvel não é liberado**: o que muda é a marca. Um contrato
   * ativo retirado continua vigente para o índice `contrato_imovel_vigente_uidx` — é o que impede a
   * retirada de virar porta lateral para destravar o imóvel sem cancelar o contrato (RD-15).
   *
   * A idempotência é da instrução da porta — repetir preserva o instante da primeira —, e não de um
   * ramo escrito aqui: um `if` antes da escrita teria duas idas ao banco e uma corrida entre elas.
   */
  async definirCirculacao(
    tx: TransactionSql,
    codigo: string,
    emCirculacao: boolean,
  ): Promise<Contrato> {
    return publicarContrato(
      this.exigir(await definirCirculacaoDoContrato(tx, codigo, emCirculacao)),
    );
  }

  /**
   * Recusa os cadastros que o contexto corrente não alcança, e os que estão fora de circulação —
   * **ponto único** das duas escritas que os referenciam.
   *
   * As duas metades e a razão de cada uma estão no cabeçalho deste arquivo.
   *
   * ---------------------------------------------------------------------------
   * O CUSTO NÃO DEPENDE DE QUANTOS FIADORES O CLIENTE ENVIOU
   * ---------------------------------------------------------------------------
   *
   * São **quatro** consultas, sempre: uma pelo imóvel, uma por papel de pessoa singular e **uma pelo
   * conjunto inteiro dos fiadores** ({@link localizarPessoas}). A forma anterior conferia os fiadores
   * num laço com uma leitura por item, e isso punha o **número de idas ao banco** nas mãos de quem
   * envia a requisição: a coleção não tem teto no esquema, não tem `check` no banco e a RD-06 fixa
   * *"zero ou mais fiadores, sem teto"* por escrito. Dentro de uma unidade de trabalho aberta, com
   * `SET LOCAL`, cada ida segura uma conexão de um pool **compartilhado entre empresas** — o
   * isolamento de *dado* é do banco (ADR-0008), o de **recurso** não é de ninguém.
   *
   * ---------------------------------------------------------------------------
   * A ITERAÇÃO É SOBRE A ENTRADA, e não sobre o resultado da consulta
   * ---------------------------------------------------------------------------
   *
   * `entrada.fiadoresIds` é percorrido **na ordem em que o cliente o enviou**, consultando o mapa. É
   * o que preserva a propriedade que a ordem fixa das quatro conferências existe para garantir: a
   * recusa nomeia o **PRIMEIRO** problema, e o mesmo corpo recusado produz sempre a mesma resposta.
   * Percorrer as linhas devolvidas pelo banco quebraria as duas coisas de uma vez — a ordem passaria
   * a ser a do resultado, e o identificador **ausente** ficaria invisível, porque ele justamente não
   * está lá. O `CT-411 (c)` mede as duas metades.
   */
  private async exigirCadastrosAlcancaveisEEmCirculacao(
    tx: TransactionSql,
    entrada: CadastrosReferenciados,
  ): Promise<void> {
    this.exigirEmCirculacao(CAMPO_DO_IMOVEL, await localizarImovel(tx, entrada.imovelId));
    this.exigirEmCirculacao(
      CAMPO_DO_LOCADOR,
      await localizarPessoa(tx, PAPEL_DO_LOCADOR, entrada.locadorId),
    );
    this.exigirEmCirculacao(
      CAMPO_DO_LOCATARIO,
      await localizarPessoa(tx, PAPEL_DO_LOCATARIO, entrada.locatarioId),
    );

    const fiadores = await localizarPessoas(tx, PAPEL_DO_FIADOR, entrada.fiadoresIds);

    for (const fiadorId of entrada.fiadoresIds) {
      this.exigirEmCirculacao(CAMPO_DOS_FIADORES, fiadores.get(fiadorId));
    }
  }

  /**
   * As duas recusas de um cadastro referenciado, num ponto só: `404` quando não alcançado, `422`
   * quando alcançado e fora de circulação.
   *
   * O parâmetro é a marca de retirada, e não o cadastro inteiro, porque é só ela que decide — imóvel
   * e pessoa não têm outra coisa em comum, e tipar isto no agregado de um deles obrigaria a segunda
   * conferência a nascer separada.
   *
   * A ausência é traduzida no **mesmo** `404` de contrato inexistente, sem campo nomeado: as duas
   * causas — não existe, ou existe em outra empresa e a política o esconde — são deliberadamente
   * indistinguíveis, e é isso que impede a borda de virar oráculo de existência sobre o cadastro
   * alheio (ADR-0008).
   */
  private exigirEmCirculacao(
    campo: string,
    cadastro: { readonly retiradoEm: Date | null } | undefined,
  ): void {
    if (cadastro === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    if (cadastro.retiradoEm !== null) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { campo, detalhes: { [DISCRIMINADOR_DA_CIRCULACAO]: CADASTRO_RETIRADO } },
      );
    }
  }

  /**
   * Recusa o ato quando o contrato não está no estado de que ele parte — **ponto único** da guarda de
   * estado desta superfície.
   *
   * Ela serve a três regras diferentes com a mesma forma de recusa: a janela de edição do rascunho
   * (RD-05) e as duas origens de transição da ADR-0021 (RD-02). Escrevê-las por extenso três vezes
   * deixaria livres para divergir o código, o campo nomeado e os nomes dos dois discriminadores — e
   * os três são contrato publicado, afirmado por igualdade de corpo inteiro. É a mesma razão, e o
   * mesmo desenho, de {@link ContratoService.traduzirConflitoDeGravacao}.
   *
   * O corpo da recusa nomeia `status` — o campo que o cliente **não** enviou e que decide —, e
   * carrega o estado atual mais o ato tentado. O que separa uma recusa da outra é
   * `detalhes.transicaoPedida`, e é por isso que ele é **parâmetro** em vez de derivado do estado
   * exigido: `ALTERACAO` e `ATIVACAO` partem do MESMO estado, e derivá-lo tornaria as duas
   * indistinguíveis para o cliente.
   *
   * O parâmetro é {@link TransicaoPedida}, e não `string`: os dois valores de `detalhes` são contrato
   * publicado, e agora os dois têm o compilador atrás deles. Ver o docblock daquele tipo.
   *
   * **Ela é leitura-antes-de-gravar, e por isso não é defesa de integridade.** Ver o cabeçalho deste
   * arquivo para por que ela não substitui a defesa da porta contra a corrida.
   */
  private exigirEstado(
    contrato: ContratoPersistido,
    estadoExigido: EstadoDoContrato,
    transicaoPedida: TransicaoPedida,
  ): void {
    if (contrato.status === estadoExigido) {
      return;
    }

    throw new ErroDeAplicacao(
      CodigoErro.CAMPO_INVALIDO,
      MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
      {
        campo: CAMPO_DO_ESTADO,
        detalhes: { estadoAtual: contrato.status, transicaoPedida },
      },
    );
  }

  /**
   * Recusa a ativação de um contrato que não satisfaz as **seis condições de entrada portadas**
   * (RD-08).
   *
   * A tabela, e a razão de ela existir apesar de o banco e o esquema já as garantirem, estão em
   * {@link CONDICOES_DE_ENTRADA_DA_ATIVACAO}. A recusa nomeia o campo culpado e **não carrega
   * `detalhes`** — a §10.1 da tech spec fixou a forma antes da implementação, e um discriminador
   * inventado aqui seria contrato publicado escolhido por conveniência.
   *
   * Nada do valor recusado entra na resposta: sai o campo culpado, nunca o valor.
   */
  private exigirCondicoesDeEntrada(contrato: ContratoPersistido): void {
    for (const condicao of CONDICOES_DE_ENTRADA_DA_ATIVACAO) {
      if (condicao.satisfeita(contrato)) {
        continue;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { campo: condicao.campo },
      );
    }
  }

  /**
   * Traduz as três recusas que o banco produz nas escritas desta superfície — **ponto único** delas.
   *
   * O código é `CAMPO_INVALIDO` porque o vocabulário é fechado e **não tem código de conflito**; o
   * `422` sai do próprio código, e não é escolhido aqui.
   *
   * As classes viajam pelo mesmo envoltório porque as escritas correm sob ele: um envoltório
   * por classe deixaria a segunda tradução nascer no ponto de chamada seguinte, que é exatamente como
   * os débitos D12, D38 e D40 apareceram nesta base. Qualquer outro erro sobe **intacto** — traduzir
   * em bloco atribuiria à entrada do cliente uma falha que ele não causou.
   *
   * **A colisão do código de COBRANÇA cai no mesmo ramo da colisão do código de CONTRATO**, e a
   * coincidência é deliberada: é o mesmo fato — *o código que o servidor emitiu já pertence a outra
   * linha desta empresa* —, o cliente não escolheu nenhum dos dois, e não há nada que ele possa
   * corrigir. O envelope publicado é, byte a byte, o que a superfície de `/v1/cobrancas` já devolve
   * para a mesma colisão no lançamento avulso; um segundo vocabulário para uma classe só faria o
   * cliente aprender duas formas da mesma recusa. Ela é alcançável a partir da T9, em que a ativação
   * grava as parcelas, e a origem prática é a série semeada para trás na virada (F7).
   *
   * Nada do valor recusado entra na mensagem: sai o campo culpado e o discriminador, nunca a entrada.
   * O código do contrato vigente é exceção declarada — ele é dado **do servidor**, apurado depois da
   * recusa, e é o que permite ao usuário saber o que cancelar.
   */
  private async traduzirConflitoDeGravacao<T>(gravar: () => Promise<T>): Promise<T> {
    try {
      return await gravar();
    } catch (erro) {
      if (erro instanceof ErroDeCodigoEmUso || erro instanceof ErroDeCodigoDeCobrancaEmUso) {
        throw new ErroDeAplicacao(
          CodigoErro.CAMPO_INVALIDO,
          MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
          {
            campo: CAMPO_DO_CODIGO,
            detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_DE_CODIGO },
            causa: erro,
          },
        );
      }

      // DECISÃO FECHADA — T6 / fatia `contratos-de-locacao` · 2026-08-09
      // O QUÊ: `ErroDeImovelComContratoVigente` é traduzido AQUI, e o envoltório corre também sobre
      //        `alterarContrato` — não apenas sobre a ativação, que é onde a §6.4 da task o previa.
      // POR QUÊ: o `PUT` escreve `imovel_id`, que é a CHAVE de `contrato_imovel_vigente_uidx`, e o
      //        alcance ao índice depende do `status` já gravado na linha. A recusa da RD-05
      //        (`exigirAlteravel`) fecha o caminho comum e **não** fecha a corrida: entre o `SELECT`
      //        que vê `RASCUNHO` e o `UPDATE` cabe uma ativação concorrente. Sem esta tradução, essa
      //        janela devolve `500` ao cliente — que é o MESMO defeito que a T5 já fechou uma vez na
      //        porta (marcador `DECISÃO FECHADA` de `packages/db/src/contrato.ts`), reaparecendo um
      //        andar acima, com a porta correta.
      // REVERTER EXIGE: provar que nenhuma escrita desta borda alcança o índice de vigência sem
      //        passar por aqui — o que é falso enquanto o `PUT` escrever `imovel_id`. **Não há prova
      //        comportamental deste ramo nesta suíte**, e a ausência é medida, não esquecimento: pela
      //        rota, a RD-05 torna a condição inalcançável sem concorrência real, e quem mede a
      //        tradução sob concorrência é o `CT-407 (b)`, na camada da porta. Este marcador É a rede
      //        (P4 do Protocolo Antirregressão).
      if (erro instanceof ErroDeImovelComContratoVigente) {
        throw new ErroDeAplicacao(
          CodigoErro.CAMPO_INVALIDO,
          MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
          {
            campo: CAMPO_DO_IMOVEL,
            detalhes: {
              [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_DE_VIGENCIA,
              [CHAVE_DO_CONTRATO_VIGENTE]: erro.contratoVigente,
            },
            causa: erro,
          },
        );
      }

      throw erro;
    }
  }

  /**
   * Traduz a ausência em `404` — **ponto único** das rotas de `:codigo`.
   *
   * É aqui, e em nenhum outro lugar, que a fronteira de tenant do contrato vira resposta. Traduções
   * separadas da mesma ausência ficariam livres para divergir no código e no status, e a forma do erro
   * é contrato: o contrato de outra empresa responde `404` com o corpo **idêntico** ao do contrato que
   * não existe, porque a borda não tem como distinguir os dois — e não deve ter.
   *
   * **Ela é genérica desde a T7 da fatia `documentos-e-confirmacao`, e a generalização é o que a
   * mantém única.** A rota do documento não lê `ContratoPersistido`: ela lê
   * {@link AgregadoDoDocumentoDoContrato}, que é outra projeção do mesmo contrato. Tipada na forma
   * antiga, ela obrigaria aquela rota a escrever a própria tradução — e uma segunda tradução da
   * mesma ausência é precisamente o que este ponto único existe para impedir. O parâmetro continua
   * sendo `T | undefined`, de modo que nada além da ausência é tratado aqui.
   *
   * **O limite do genérico é o ROSTER das projeções admitidas, e não `unknown`.** Sem ele, este
   * ponto traduziria a ausência de qualquer coisa em `404 RECURSO_NAO_ENCONTRADO` — inclusive de um
   * valor que não é o contrato, caso em que o status mentiria sobre o que faltou. Acrescentar uma
   * projeção à união é **decisão**, e não conveniência: ela aparece no diff, e quem a acrescenta
   * afirma que a ausência daquela leitura significa *"este contrato não é alcançável por esta
   * sessão"*.
   */
  private exigir<T extends ContratoPersistido | AgregadoDoDocumentoDoContrato>(
    contrato: T | undefined,
  ): T {
    if (contrato === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return contrato;
  }
}

/**
 * A linha persistida no corpo que o contrato publica — a **única** tradução das duas formas.
 *
 * **`id` não sai**, e a ausência é a decisão: a chave exposta é o `codigo`, porque o contrato tem
 * série declarada (ADR-0017). O UUID interno é o pai do vínculo de fiador e o alvo da porta estreita
 * de imóvel, e permanece dentro do servidor. `empresa_id` não chega sequer até aqui — a projeção da
 * porta não o lê.
 *
 * Os campos são copiados **um a um**, e não por espalhamento: o espalhamento publicaria qualquer
 * coluna que a projeção venha a ganhar, inclusive as duas acima. `retiradoEm` sai como cadeia ISO-8601
 * em UTC, que é o que `esquemaDoContrato` declara (`z.iso.datetime()`); nulo continua nulo, e é ele
 * que diz que o contrato circula.
 *
 * **Ela é exportada desde já**, e a razão é a mesma que já produziu os débitos D12, D38 e D40 nesta
 * base: a ativação (T7), o cancelamento (T8) e a leitura do imóvel com o contrato vigente (T9)
 * publicam contratos, e a segunda tradução da mesma forma nasceria lá se não houvesse de onde
 * importar. As duas divergiriam no primeiro campo que o contrato ganhar — e o que diverge primeiro
 * neste molde é justamente o formato de `retiradoEm` e a lista de campos copiados, isto é, o corpo que
 * o cliente vê.
 */
export function publicarContrato(contrato: ContratoPersistido): Contrato {
  return {
    codigo: contrato.codigo,
    status: contrato.status,
    imovelId: contrato.imovelId,
    locadorId: contrato.locadorId,
    locatarioId: contrato.locatarioId,
    fiadores: contrato.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
    dataInicioLocacao: contrato.dataInicioLocacao,
    prazoMeses: contrato.prazoMeses,
    valorMensal: contrato.valorMensal,
    diaVencimento: contrato.diaVencimento,
    dataFimLocacao: contrato.dataFimLocacao,
    valorTotalContrato: contrato.valorTotalContrato,
    gerarCobrancasAutomaticamente: contrato.gerarCobrancasAutomaticamente,
    retiradoEm: contrato.retiradoEm === null ? null : contrato.retiradoEm.toISOString(),
  };
}
