/**
 * A **qualificação de uma parte** — onde os eixos condicionais do documento se decidem, **uma vez**.
 *
 * ===========================================================================
 * O ponto desta função é resolver UMA vez o que vinte e uma cláusulas consomem
 * ===========================================================================
 *
 * Os eixos foram **medidos** no `contrato-pdf-fonte.py` (o Server Script `PDF contrato`, 759 linhas)
 * e são três:
 *
 * | Eixo | Como se resolve |
 * |---|---|
 * | pessoa física × jurídica | o rótulo e a máscara do documento — `CPF` com onze dígitos, `CNPJ` com quatorze |
 * | com × sem cédula de identidade | com RG, emite `cédula de identidade civil número <RG>`; **sem RG, omite o trecho inteiro** |
 * | com × sem fiador | o bloco de fiadores existe **se e somente se** há fiador (decidido em `./composicao.ts`) |
 *
 * As cláusulas consomem o **resultado**, e nenhuma delas reabre a condição. Reabrir é o que faz um
 * caminho divergir dos outros vinte em silêncio: bastaria uma cláusula perguntar de novo `if (rg)`
 * com a negação trocada para o documento afirmar, no mesmo papel, duas coisas incompatíveis.
 *
 * ===========================================================================
 * ⚠️ Tipo de pessoa fora da união fechada é RECUSADO, e a recusa é o mecanismo
 * ===========================================================================
 *
 * Na prática o Zod barra antes — `esquemaDePessoaNova` declara `z.enum(TIPOS_DE_PESSOA)`. O
 * compositor **não confia cegamente nisso**, e a razão é concreta: um valor migrado do sistema
 * antigo não passa por esquema nenhum, e o legado decidia por busca de subcadeia
 * (`if "jur" in tipo … elif "fís" in tipo …`), com um ramo final que **adivinhava pelo comprimento
 * do documento**. Adivinhar produz documento parcial silencioso; recusar produz um erro que alguém
 * lê. Ver {@link ErroDeTipoDePessoaDesconhecido}.
 *
 * ===========================================================================
 * Duas divergências deliberadas com o legado, nos caminhos que o oráculo NÃO cobre
 * ===========================================================================
 *
 * 1. **Pessoa jurídica nunca emite o trecho de identidade civil**, mesmo que o campo `rg` venha
 *    preenchido. No legado os dois eixos são independentes, e uma empresa com `rg` sujo sairia
 *    "portadora de cédula de identidade civil". O golden de pessoa jurídica
 *    (`contrato-pdf-pessoa-juridica.txt`) tem `rg` ausente e **não discrimina** o caso, de modo que
 *    não há oráculo a contrariar; o que existe é a §3.2 da task, que manda qualificar a pessoa
 *    jurídica *"por CNPJ e razão social — **nunca** pelo molde de RG"*. Cédula de identidade civil é,
 *    por definição, de pessoa natural.
 * 2. **O fiador usa o MESMO molde das demais partes.** A decisão saiu deste parágrafo e está sob o
 *    marcador `DECISÃO FECHADA` na linha de {@link qualificarParte}, com o `REVERTER EXIGE` escrito —
 *    porque prosa de cabeçalho não segura um agente que confere a qualificação contra a linha 350 do
 *    fonte capturado e conclui, com a melhor das intenções, que falta fidelidade ali.
 */

import { TIPOS_DE_PESSOA } from '@syslocbr/contracts';
import type { ImovelDoContrato, ParteDoContrato } from './dados.js';

/** Quantos dígitos tem um CPF. */
const DIGITOS_DO_CPF = 11;

/** Quantos dígitos tem um CNPJ. */
const DIGITOS_DO_CNPJ = 14;

/** Quantos dígitos tem um CEP. */
const DIGITOS_DO_CEP = 8;

/** O rótulo do documento de pessoa física, como o documento o escreve. */
const ROTULO_DO_CPF = 'CPF';

/** O rótulo do documento de pessoa jurídica, como o documento o escreve. */
const ROTULO_DO_CNPJ = 'CNPJ';

/**
 * O trecho da cédula de identidade civil — a **constante nomeada** do eixo "com × sem RG".
 *
 * Ele é literal em três lugares que precisam coincidir: aqui, na asserção positiva do CT-704 e na
 * asserção de ausência do mesmo caso. Um literal repetido nos três estaria livre para divergir na
 * primeira emenda, e a asserção de ausência continuaria verde procurando um texto que ninguém mais
 * emite — o modo de falha mais silencioso que este eixo tem.
 */
export const TRECHO_DA_IDENTIDADE_CIVIL = 'cédula de identidade civil número';

/** Tudo que não é dígito — o que sai do documento e do CEP antes de a máscara ser aplicada. */
const NAO_DIGITO = /\D/gu;

/**
 * O que o documento escreve no lugar de um campo vazio.
 *
 * É o que o legado imprime, e mantê-lo é deliberado: um nome em branco no meio da frase leria como
 * se a parte não existisse, e o traço deixa a falta **visível**. A constante é exportada porque o
 * mesmo traço aparece nas linhas de assinatura, montadas em `./composicao.ts` — duas grafias do
 * mesmo fato ficariam livres para divergir.
 */
export const RESERVA_DE_CAMPO_VAZIO = '-';

/**
 * A recusa de um tipo de pessoa fora da união fechada de `@syslocbr/contracts`.
 *
 * O valor recusado viaja em **campo**, e não recortado da mensagem: quem trata a recusa precisa do
 * mesmo valor que ela viu, e extraí-lo da cadeia é análise sintática que falha em silêncio. É o
 * desenho de `ErroDeEstadoNaoAvisavel` em `packages/regua/src/mensagem.ts`.
 */
export class ErroDeTipoDePessoaDesconhecido extends Error {
  /** O nome do campo que carregava o valor recusado — o que a borda publicaria em `campo`. */
  readonly campo = 'tipoPessoa';

  /** O valor recusado, exatamente como chegou. */
  readonly valor: string;

  constructor(valor: string) {
    super(`tipoPessoa fora da união fechada: ${valor}`);
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe.
    this.name = 'ErroDeTipoDePessoaDesconhecido';
    this.valor = valor;
  }
}

/** Só os dígitos da cadeia — o documento chega assim do banco, e o CEP nem sempre. */
function somenteDigitos(valor: string): string {
  return valor.replace(NAO_DIGITO, '');
}

/**
 * Aplica a máscara do documento conforme o tipo da pessoa.
 *
 * Quando a contagem de dígitos não bate com a do tipo, o valor sai **como chegou** — é o
 * comportamento do legado, e mantê-lo é o certo: mascarar à força produziria um número que não
 * existe, e recusar impediria de emitir o documento de um cadastro migrado com dado incompleto. O
 * documento imprime o que o cadastro tem.
 */
function formatarDocumento(digitos: string, ehPessoaJuridica: boolean): string {
  if (ehPessoaJuridica) {
    if (digitos.length !== DIGITOS_DO_CNPJ) {
      return digitos;
    }

    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
  }

  if (digitos.length !== DIGITOS_DO_CPF) {
    return digitos;
  }

  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

/** Aplica a máscara do CEP; fora dos oito dígitos, devolve o que chegou — como o legado. */
function formatarCep(cep: string): string {
  const digitos = somenteDigitos(cep);

  if (digitos.length !== DIGITOS_DO_CEP) {
    return cep;
  }

  return `${digitos.slice(0, 5)}-${digitos.slice(5, 8)}`;
}

/** O que basta para compor um endereço — a parte e o imóvel o satisfazem igualmente. */
type EnderecoPostal = Pick<
  ParteDoContrato,
  'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'estado' | 'cep'
>;

/**
 * Compõe o endereço na ordem e na pontuação do legado.
 *
 * `Avenida Central, 1000, Centro, Caratinga - MG, CEP 35300-001` — logradouro e número colados por
 * vírgula, complemento e bairro quando existem, cidade e unidade federativa unidas por travessão
 * curto, e o CEP por último com o próprio rótulo.
 *
 * Cada campo entra **só quando tem conteúdo**, e a alternativa — emitir separadores vazios — produz
 * `Rua B, , , Caratinga - MG`, que é como um endereço incompleto vira um endereço errado. O
 * contrato publicado garante conteúdo em todos menos `complemento`, e a guarda vale para os demais
 * porque o agregado pode vir de dado migrado.
 */
export function comporEndereco(endereco: EnderecoPostal): string {
  const partes: string[] = [];
  const logradouro = endereco.logradouro.trim();
  const numero = endereco.numero.trim();

  if (logradouro !== '' && numero !== '') {
    partes.push(`${logradouro}, ${numero}`);
  } else if (logradouro !== '') {
    partes.push(logradouro);
  } else if (numero !== '') {
    partes.push(numero);
  }

  const complemento = endereco.complemento?.trim() ?? '';
  if (complemento !== '') {
    partes.push(complemento);
  }

  const bairro = endereco.bairro.trim();
  if (bairro !== '') {
    partes.push(bairro);
  }

  partes.push(comporPraca(endereco));

  const cep = formatarCep(endereco.cep.trim());
  if (cep !== '') {
    partes.push(`CEP ${cep}`);
  }

  return partes.filter((parte) => parte !== '').join(', ');
}

/**
 * A praça — cidade e unidade federativa unidas.
 *
 * Ela aparece **duas** vezes no documento: dentro do endereço de cada parte e do imóvel, e sozinha
 * na linha do fecho, antes da data. É por isso que ela é função própria, e não um trecho escrito
 * dentro de {@link comporEndereco}: o legado escreve a praça do fecho por um caminho separado, e
 * duas escritas do mesmo fato divergem na primeira emenda.
 */
export function comporPraca(local: Pick<EnderecoPostal, 'cidade' | 'estado'>): string {
  const cidade = local.cidade.trim();
  const estado = local.estado.trim();

  if (cidade !== '' && estado !== '') {
    return `${cidade} - ${estado}`;
  }

  return cidade !== '' ? cidade : estado;
}

/**
 * Qualifica uma parte do contrato — o trecho que identifica quem contrata, **sem** pontuação final.
 *
 * A pontuação fica com quem compõe, e a razão é o eixo do fiador: locador e locatário fecham o
 * parágrafo com ponto, enquanto os fiadores são unidos por `; ` dentro de uma frase que continua.
 * Devolver o ponto daqui obrigaria o chamador a recortá-lo, e recortar pontuação de uma cadeia é o
 * tipo de manipulação que falha calada no primeiro texto que não termine como se esperava.
 *
 * O tipo de pessoa é resolvido **uma vez**, no topo, e o resultado governa rótulo, máscara e a
 * presença do trecho de identidade civil.
 */
// DECISÃO FECHADA — T5 / Gate 2 rodada 2 · 2026-08-13
// O QUÊ: os TRÊS papéis — locador, locatário e fiador — são qualificados por ESTE molde único, e o
//        ramo sem RG escreve `portador(a) do <rótulo> número`. O legado escreve `portador(a) CPF
//        número`, **sem o `do`**, quando a parte é fiador (linha 350 de `contrato-pdf-fonte.py`,
//        contra as linhas 133 e 228 das outras duas). A divergência é deliberada e permanece.
// POR QUÊ: é lapso de digitação, não regra — as três frases dizem a mesma coisa. Reproduzi-lo exige
//        um SEGUNDO molde escolhido por papel, e o segundo molde é precisamente o "reabrir a
//        condição" que esta função existe para impedir: basta um deles ganhar uma emenda que o outro
//        não recebe para o mesmo documento afirmar duas coisas no mesmo papel. A regra vizinha de
//        `./clausulas.ts` — fidelidade literal ao legado, **inclusive nos erros** — vale para o TEXTO
//        FIXO das cláusulas, que o golden confere byte a byte; ela não alcança este ramo, que
//        oráculo nenhum cobre.
// REVERTER EXIGE: demonstrar que o segundo molde não reabre a condição que esta função existe para
//        fechar, e exibir o golden com fiador que hoje não existe — a T1 registrou a ausência dele
//        como **ausência medida**, e é ela que torna este eixo indecidível por oráculo.
export function qualificarParte(parte: ParteDoContrato): string {
  const ehPessoaJuridica = resolverPessoaJuridica(parte.tipoPessoa);

  const nome = parte.nome.trim();
  const documento = formatarDocumento(somenteDigitos(parte.documentoPrincipal), ehPessoaJuridica);
  const rotulo = ehPessoaJuridica ? ROTULO_DO_CNPJ : ROTULO_DO_CPF;
  const rg = ehPessoaJuridica ? '' : (parte.rg?.trim() ?? '');
  const endereco = comporEndereco(parte);

  let trecho = nome !== '' ? nome : RESERVA_DE_CAMPO_VAZIO;

  if (rg !== '') {
    trecho += `, portador(a) da ${TRECHO_DA_IDENTIDADE_CIVIL} ${rg}`;
    trecho += `, e do ${rotulo} número ${documento}`;
  } else if (documento !== '') {
    trecho += `, portador(a) do ${rotulo} número ${documento}`;
  }

  trecho += `, residente e domiciliado em ${endereco !== '' ? endereco : RESERVA_DE_CAMPO_VAZIO}`;

  return trecho;
}

/**
 * Traduz o tipo publicado no eixo que o documento usa, **recusando** o que não está na união.
 *
 * A comparação é contra {@link TIPOS_DE_PESSOA}, importado de `@syslocbr/contracts` (ADR-0016): a
 * lista dos dois valores não é redigitada aqui, de modo que um terceiro tipo criado lá chega a este
 * ponto pela compilação, e não por acaso.
 */
function resolverPessoaJuridica(tipoPessoa: ParteDoContrato['tipoPessoa']): boolean {
  const [pessoaFisica, pessoaJuridica] = TIPOS_DE_PESSOA;

  if (tipoPessoa === pessoaJuridica) {
    return true;
  }

  if (tipoPessoa === pessoaFisica) {
    return false;
  }

  // O `never` do TypeScript já cobriria a união fechada; o que chega aqui é dado que não passou por
  // esquema — migração, consulta crua, `JSON.parse`. A conversão é para poder NOMEAR o valor.
  throw new ErroDeTipoDePessoaDesconhecido(String(tipoPessoa));
}

/** O nome do imóvel como o documento o identifica, com o mesmo traço de reserva das partes. */
export function identificarImovel(imovel: ImovelDoContrato): string {
  const nome = imovel.nomeImovel.trim();

  return nome !== '' ? nome : RESERVA_DE_CAMPO_VAZIO;
}
