/**
 * A **composição do documento do contrato** — função pura do agregado, e nada além.
 *
 * ===========================================================================
 * Ela é PURA, e a pureza é a garantia que substitui a rotina de invalidação
 * ===========================================================================
 *
 * ADR-0030: o artefato derivado é composto no instante do pedido e **nunca armazenado**. A coerência
 * entre o documento e o cadastro não vem de alguém lembrar de invalidar uma cópia — vem de **não
 * haver cópia**. Do lado de cá, isso significa que esta função não pode guardar nada entre chamadas:
 *
 * - **sem estado de módulo** — nenhuma variável fora de `comporDocumentoDoContrato` é escrita depois
 *   da carga; tudo que este arquivo declara no topo é constante;
 * - **sem cache e sem memoização** — a mesma entrada é recomposta do zero, todas as vezes;
 * - **sem instância acumuladora** — não há classe, não há `this`, não há coletor que sobreviva à
 *   chamada.
 *
 * O CT-702 mede a primeira metade (um agregado alterado reflete a alteração imediatamente) e o
 * CT-703 mede a segunda, que é a que morde: compor **sem** fiador logo depois de compor **com**
 * fiador não deixa traço algum do fiador anterior, em bloco nenhum. Um cache introduzido aqui
 * passaria despercebido pelo CT-702 e reprovaria no CT-703 — é para isso que o par existe.
 *
 * Reaproveitamento por cache continua sendo otimização compatível com a ADR-0030 (*"ele muda o
 * custo, não o que o produto promete"*), mas ele **não mora aqui**: instalado dentro da composição,
 * o cache passa a ser a fonte, e a propriedade que estes dois casos guardam some.
 *
 * ===========================================================================
 * A marca de cancelamento é PARÂMETRO — e a composição não conhece `status`
 * ===========================================================================
 *
 * `opcoes.cancelado` é derivado pela borda de `contrato.status === 'CANCELADO'` (§5.1-A passo 4), e
 * o agregado desta função **não carrega `status`**. A ignorância é o mecanismo: não existe, aqui
 * dentro, um segundo caminho capaz de ligar a marca — nem um `retiradoEm`, nem uma data de fim, nem
 * um valor zerado podem produzi-la por engano.
 *
 * É a RN-02, e o veredito **DV-07** está escrito antes: o legado *mesclava* a marca sobre os bytes
 * de um PDF já gravado e regravava o arquivo. Aqui não existem bytes prontos para mesclar, e a
 * garantia *"nunca aplicada sobre bytes prontos"* passa a ser **estrutural** em vez de procedimento.
 * O golden é de contrato **ativo**: não há oráculo textual do carimbo, e por isso a forma da marca é
 * decisão do produto.
 *
 * ===========================================================================
 * Onde a marca entra, e por que ali
 * ===========================================================================
 *
 * Logo **abaixo do título e acima da qualificação das partes** — o primeiro lugar que alguém lê, e
 * antes de qualquer cláusula. As alternativas foram descartadas por razão concreta: no rodapé, ela
 * chega depois de o leitor ter percorrido o contrato inteiro como se valesse; ao lado do título, na
 * mesma linha, ela se confunde com o nome do documento na hora de conferir a igualdade com o
 * oráculo. Como bloco próprio, ela é também **removível e detectável** por rótulo, que é o que o
 * CT-706 exercita nos quatro estados.
 *
 * ===========================================================================
 * A composição NÃO importa a porta de renderização
 * ===========================================================================
 *
 * ADR-0025: o domínio produz a {@link RepresentacaoTextual} e para aí. Quem transforma isso em bytes
 * é o adaptador, recebido **por parâmetro** pela borda — este arquivo não sabe que existe um motor
 * de PDF, e é o que o torna exercitável sem `@react-pdf/renderer` de pé.
 *
 * ⚠️ E ele **não chama `normalizarParaComparacao`**. Aquela função existe só para a verificação;
 * aplicá-la ao texto que vai ao PDF colapsaria o layout em silêncio, e a comparação com o oráculo
 * **não acusaria**, porque normaliza os dois lados. O aviso por extenso está em `../normalizacao.ts`.
 */

import type { BlocoDoDocumento, RepresentacaoTextual } from '../porta-de-renderizacao.js';
import { interpolar, PARAGRAFOS_DO_CONTRATO } from './clausulas.js';
import type { DadosDoContratoParaDocumento, OpcoesDoDocumentoDoContrato } from './dados.js';
import { formatarValorEmReais, valorPorExtenso } from './extenso.js';
import {
  comporEndereco,
  comporPraca,
  identificarImovel,
  qualificarParte,
  RESERVA_DE_CAMPO_VAZIO,
} from './qualificacao.js';

/** O título do documento, como o legado o centraliza no topo. */
const TITULO_DO_DOCUMENTO = 'CONTRATO DE LOCAÇÃO RESIDENCIAL';

/**
 * O texto da **marca de cancelamento** — o termo canônico do glossário global.
 *
 * Ele é neutro quanto à forma: não promete tarja, faixa nem selo, e a neutralidade é conteúdo. O que
 * o documento precisa afirmar é o fato — este contrato está cancelado —, e como isso é desenhado na
 * página é decisão do adaptador de renderização (T6), não do domínio.
 */
export const MARCA_DE_CANCELAMENTO = 'CONTRATO CANCELADO';

/** O rótulo do bloco da marca — é por ele que a comparação e a renderização a identificam. */
const ROTULO_DA_MARCA_DE_CANCELAMENTO = 'marca-de-cancelamento';

/** O rótulo que abre a qualificação do locador. */
const ROTULO_DO_LOCADOR = 'LOCADOR (A):';

/** O rótulo que abre a qualificação do locatário. */
const ROTULO_DO_LOCATARIO = 'LOCATÁRIO (A) (S):';

/** A abertura do bloco de fiadores, antes da lista das partes qualificadas. */
const ABERTURA_DOS_FIADORES =
  'FIADOR (A) (S): Como fiador(es) e principal(ais) pagador(es) das mensalidades do aluguel e demais obrigações constantes deste contrato,';

/** O fecho do bloco de fiadores, depois da lista. */
const ENCERRAMENTO_DOS_FIADORES =
  ', até final satisfação das obrigações locacionais, vincendas tal como consumo de luz, água, IPTU e devolução das chaves ao(à) LOCADOR(A), renunciando expressamente ao benefício de ordem de que tratam os artigos 1.491, 1.500 e 1.503 do Código Civil Brasileiro.';

/** Como as qualificações de vários fiadores se unem dentro da mesma frase. */
const SEPARADOR_ENTRE_FIADORES = '; ';

/** Os papéis que assinam, na ordem e na grafia do legado. */
const PAPEL_DO_LOCATARIO = 'Locatário(a)';
const PAPEL_DO_LOCADOR = 'Locador(a)';
const PAPEL_DO_FIADOR = 'Fiador(a)';
const PAPEL_DA_TESTEMUNHA = 'Testemunha';

/** Quantas testemunhas o documento reserva — o texto do fecho fala em `02(duas)`. */
const TESTEMUNHAS = 2;

/** Os meses por extenso, em caixa alta, indexados de 1 a 12 como o legado os escreve. */
const MESES_POR_EXTENSO = Object.freeze([
  '',
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const);

/** A forma da data corrente da operação, como o banco a entrega (ADR-0026). */
const DATA_DE_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/u;

/**
 * A recusa de uma data de emissão **fora do formato `AAAA-MM-DD` ou com mês fora de 1..12**.
 *
 * O legado, diante de uma data malformada, imprimia **só a praça** e seguia — o documento saía com o
 * fecho pela metade e ninguém percebia. Aqui a recusa é explícita, pela mesma razão do
 * `ErroDeTipoDePessoaDesconhecido`: documento parcial silencioso é pior que erro.
 *
 * ⚠️ **O alcance é exatamente esse, e a redação acima é estreita de propósito.** O dia é capturado
 * pela expressão e **não é conferido contra o calendário**: `2026-02-31` atravessa e sai como
 * *"31 de FEVEREIRO de 2026"*. Prometer *"recusa o que não é data de calendário"* seria descrever uma
 * guarda que não existe — e prosa mais forte que a guarda é como uma verificação ausente passa por
 * verificação feita. Conferir o dia exigiria classe de entrada nova sem ganho real: por ADR-0026 a
 * entrada é `negocio.data_corrente_da_operacao()`, que só produz data que existe.
 */
export class ErroDeDataDeEmissaoInvalida extends Error {
  /** O valor recusado, exatamente como chegou. */
  readonly valor: string;

  constructor(valor: string) {
    super(`data de emissão fora do formato AAAA-MM-DD: ${valor}`);
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe.
    this.name = 'ErroDeDataDeEmissaoInvalida';
    this.valor = valor;
  }
}

/**
 * Escreve a data de emissão como o fecho a imprime — `12 de AGOSTO de 2026`.
 *
 * **Sem construir um `Date`**, e a razão é a mesma registrada em `packages/regua/src/mensagem.ts`:
 * `new Date('2026-08-12')` interpreta a cadeia como meia-noite UTC e imprime o dia anterior em
 * qualquer fuso a oeste. A data de emissão é data de calendário, já apurada pelo banco (ADR-0026), e
 * recortá-la em texto é a única leitura que não desloca o dia.
 */
function dataPorExtenso(data: string): string {
  const achado = DATA_DE_CALENDARIO.exec(data);

  if (achado === null) {
    throw new ErroDeDataDeEmissaoInvalida(data);
  }

  const [, ano = '', mes = '', dia = ''] = achado;
  const nomeDoMes = MESES_POR_EXTENSO[Number(mes)];

  if (nomeDoMes === undefined || nomeDoMes === '') {
    throw new ErroDeDataDeEmissaoInvalida(data);
  }

  return `${dia} de ${nomeDoMes} de ${ano}`;
}

/** Um inteiro do contrato como o documento o imprime — nunca negativo, como no legado. */
function inteiroDoContrato(valor: number): string {
  return String(Number.isInteger(valor) && valor > 0 ? valor : 0);
}

/** O nome de quem assina, com o mesmo traço de reserva que a qualificação usa. */
function nomeParaAssinatura(nome: string): string {
  const limpo = nome.trim();

  return limpo !== '' ? limpo : RESERVA_DE_CAMPO_VAZIO;
}

/**
 * Compõe o documento do contrato a partir do agregado já resolvido.
 *
 * A ordem dos blocos é a do legado: título → (marca de cancelamento) → partes qualificadas →
 * (fiadores) → as 21 cláusulas com as seções e as alíneas → fecho → praça e data → assinaturas. A
 * ordem é **conteúdo**, e é uma das cinco classes de divergência que a normalização da comparação
 * não pode absorver.
 *
 * Cada bloco é criado **dentro** desta chamada e nada sai dela: não há arranjo de módulo a que se
 * acrescente, e é isso que torna a pureza uma propriedade da forma, e não um cuidado a manter.
 */
export function comporDocumentoDoContrato(
  dados: DadosDoContratoParaDocumento,
  opcoes: OpcoesDoDocumentoDoContrato,
): RepresentacaoTextual {
  const blocos: BlocoDoDocumento[] = [{ rotulo: 'titulo', texto: TITULO_DO_DOCUMENTO }];

  if (opcoes.cancelado) {
    blocos.push({ rotulo: ROTULO_DA_MARCA_DE_CANCELAMENTO, texto: MARCA_DE_CANCELAMENTO });
  }

  blocos.push({
    rotulo: 'locador',
    texto: `${ROTULO_DO_LOCADOR} ${qualificarParte(dados.locador)}.`,
  });
  blocos.push({
    rotulo: 'locatario',
    texto: `${ROTULO_DO_LOCATARIO} ${qualificarParte(dados.locatario)}.`,
  });

  // O bloco existe **se e somente se** há fiador: nada de bloco vazio, nada de traço de reserva. É
  // o eixo "com × sem fiador", e a ausência total é o que o CT-703 procura.
  if (dados.fiadores.length > 0) {
    const qualificados = dados.fiadores
      .map((fiador) => qualificarParte(fiador))
      .join(SEPARADOR_ENTRE_FIADORES);

    blocos.push({
      rotulo: 'fiadores',
      texto: `${ABERTURA_DOS_FIADORES} ${qualificados}${ENCERRAMENTO_DOS_FIADORES}`,
    });
  }

  const enderecoDoImovel = comporEndereco(dados.imovel);
  // O total chega RESOLVIDO no agregado — a derivação dele é da consulta da T7, por `COALESCE` em
  // `numeric` (ADR-0023). Ver o docblock de `TermosDoContrato` em `./dados.ts`.
  const valorTotal = dados.contrato.valorTotalContrato;
  const valores: Readonly<Record<string, string>> = {
    nomeDoImovel: identificarImovel(dados.imovel),
    enderecoDoImovel: enderecoDoImovel !== '' ? enderecoDoImovel : RESERVA_DE_CAMPO_VAZIO,
    prazoEmMeses: inteiroDoContrato(dados.contrato.prazoMeses),
    diaDeVencimento: inteiroDoContrato(dados.contrato.diaVencimento),
    valorMensal: formatarValorEmReais(dados.contrato.valorMensal),
    valorMensalPorExtenso: valorPorExtenso(dados.contrato.valorMensal),
    valorTotal: formatarValorEmReais(valorTotal),
    valorTotalPorExtenso: valorPorExtenso(valorTotal),
  };

  for (const paragrafo of PARAGRAFOS_DO_CONTRATO) {
    blocos.push({ rotulo: paragrafo.rotulo, texto: interpolar(paragrafo.molde, valores) });
  }

  blocos.push({
    rotulo: 'praca-e-data',
    texto: `${comporPraca(dados.imovel)}, ${dataPorExtenso(dados.dataDeEmissao)}`,
  });

  blocos.push({
    rotulo: 'assinatura-locatario',
    texto: `${nomeParaAssinatura(dados.locatario.nome)}\n${PAPEL_DO_LOCATARIO}`,
  });
  blocos.push({
    rotulo: 'assinatura-locador',
    texto: `${nomeParaAssinatura(dados.locador.nome)}\n${PAPEL_DO_LOCADOR}`,
  });

  dados.fiadores.forEach((fiador, posicao) => {
    blocos.push({
      rotulo: `assinatura-fiador-${posicao + 1}`,
      texto: `${nomeParaAssinatura(fiador.nome)}\n${PAPEL_DO_FIADOR}`,
    });
  });

  for (let testemunha = 1; testemunha <= TESTEMUNHAS; testemunha += 1) {
    blocos.push({ rotulo: `assinatura-testemunha-${testemunha}`, texto: PAPEL_DA_TESTEMUNHA });
  }

  return { blocos };
}
