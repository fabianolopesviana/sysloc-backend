/**
 * O certificado do provedor — a regra de aplicação das **três** rotas de
 * `/v1/integracoes-bancarias`: registrar (ou renovar) o material da empresa, consultar o vigente e
 * **verificar a identidade** contra o provedor.
 *
 * ===========================================================================
 * A VERIFICAÇÃO É PARTIDA EM DUAS, e o corte é onde a transação FECHA (T12)
 * ===========================================================================
 *
 * {@link CertificadoDoProvedorService.lerIdentidadeGuardada} corre **dentro** da unidade de trabalho
 * e faz uma coisa só: ler o vigente da empresa do contexto. Ela é a metade curta, e é ela que
 * responde a RN-01 — a empresa sem certificado é recusada **ali**, com `404`, e nada acontece depois.
 *
 * {@link CertificadoDoProvedorService.verificarIdentidade} corre **fora** de transação alguma, e é
 * onde o segredo é decifrado e o aperto de mão mútuo acontece. A separação não é estética: o ato é
 * chamada de rede a **terceiro**, com teto de dez segundos, e mantê-lo dentro de `sql.begin`
 * reservaria uma conexão física da reserva que atende todo o produto durante a espera. É o achado da
 * T7 da fatia `documentos-e-confirmacao` — *"o que se protege não é o tempo de resposta, e sim a
 * conexão física, que é o recurso escasso"* —, agora sobre uma espera uma ordem de grandeza maior que
 * a renderização de ~0,5 s que o produziu.
 *
 * ⚠️ **Não existe caminho de reserva, e a ausência é o mecanismo** (RN-01). O único parâmetro que
 * alimenta o ato externo é o que a leitura acima devolveu, e aquela leitura não recebe empresa: quem
 * recorta é a política do banco (ADR-0008). Não há, em lugar nenhum deste arquivo, um segundo modo de
 * obter material — nem constante, nem variável de ambiente, nem cache entre atos, nem
 * `?? materialPadrao`. É a diferença entre remover o *default* e remover a *possibilidade*, e é o
 * defeito central que a fatia existe para fechar: no sistema antigo *"existe um caminho de reserva que
 * atende qualquer empresa que não tenha a própria"*.
 *
 * ⚠️ **Nada é gravado pela verificação**, e nada é enfileirado. A ADR-0029 manda para a fila o efeito
 * externo *"cujo resultado não compõe a resposta do pedido"*; aqui o solicitante espera o retorno na
 * própria resposta, e a `Decision` diz que essa classe *"permanece em linha, e não é exceção"*. O ganho
 * de desenho merece registro: o vetor do achado crítico da fase anterior — o segredo em claro
 * alcançando o journal por `err.command.args`, porque a fila empurra a carga como argumento de comando
 * — **não existe nesta fatia por construção**, já que não há carga de tarefa.
 *
 * ⚠️ **A fatia (ii) chegou, e o desfecho foi MEDIDO** — era o `D58 · F4/T13`, fechado pela T15. Ela
 * trouxe as duas filas do produto, e a carga de cada uma leva **apenas identificadores**: o processo
 * de trabalho resolve o certificado pelo banco, sob o contexto de tenant, e o decifra com a chave do
 * próprio ambiente. A propriedade acima, portanto, **não foi herdada — foi reconstruída por outro
 * mecanismo**, e a diferença importa: aqui ela vem de não haver fila, ali de não haver o que
 * carregar. Quem a mede é o `CT-935` de `apps/api/test/segredo-nao-escapa.e2e.spec.ts`, varrendo a
 * carga real e o objeto de erro **cru** da biblioteca de fila — nunca lendo o código (ADR-0032).
 *
 * ===========================================================================
 * A ORDEM DOS ATOS NÃO É LIVRE, e o que decide é ONDE a transação abre
 * ===========================================================================
 *
 * O registro tem duas metades, e elas correm em lugares diferentes de propósito:
 *
 *   1. **fora** da unidade de trabalho — {@link CertificadoDoProvedorService.prepararMaterial}, que
 *      converte o cofre PKCS#12 quando preciso e o abre por aperto de mão em laço local. É I/O — e,
 *      desde a F5, I/O que pode incluir um subprocesso —, e segurar conexão física do banco durante
 *      ele repetiria o achado da T7 da fatia `documentos-e-confirmacao` (renderização de ~0,5 s
 *      dentro do `sql.begin`), agora sobre uma reserva de conexões que atende todo o produto;
 *   2. **dentro** — {@link CertificadoDoProvedorService.registrar}, que cifra e grava. A cifra é
 *      trabalho de CPU de microssegundos, e mantê-la aqui é o que garante que o envelope gravado e a
 *      substituição do anterior sejam o **mesmo** commit.
 *
 * É por isso que o material **preparado** atravessa de um método para o outro como parâmetro, e não
 * é relido: reler dentro da transação desfaria a metade (1) — e, no caminho convertido, releria o
 * recebido em vez do que se vai guardar.
 *
 * ⚠️ **A conferência de vigência acontece na PRIMEIRA instrução da transação, e não antes dela** —
 * divergência declarada em relação à §3.4 da task, que a descreve como passo prévio. A razão é o
 * marcador `DECISÃO FECHADA — T7 / Gates 1 e 2` de `packages/db/src/certificado-do-provedor.ts`, que
 * fixa a ordem **conferir → anular → inserir** dentro de `registrarCertificado`: conferir também aqui
 * seria a **segunda** avaliação do mesmo fato, livre para divergir da primeira, e conferir **só** aqui
 * exigiria mover código sob marcador. O que a §3.4 protege — *"recusado na entrada, sem que nada seja
 * escrito"* — continua verdadeiro byte a byte: a conferência é a primeira instrução da transação,
 * nenhuma escrita a precede, e o `422` sai com a data em que a validade terminou.
 *
 * ===========================================================================
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ===========================================================================
 *
 * `registrar` e `consultar` tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. A
 * **ausência de `AcessoAoBanco` no construtor** é o mecanismo, e não uma promessa de docblock: o
 * acesso não é injetado aqui porque injetá-lo daria a este serviço exatamente a capacidade que ele
 * não pode ter. Mesma decisão, e mesma razão, de {@link ../automacao/automacao.service.js} e de
 * {@link ../mora/mora.service.js}. **A decisão fechada de `packages/db/src/unidade-de-trabalho.ts`
 * não é tocada.**
 *
 * ===========================================================================
 * TRÊS CAUSAS, TRÊS CÓDIGOS — e a distinção é construída AQUI (F5, D4)
 * ===========================================================================
 *
 * ⚠️ **Esta seção SUBSTITUI a que dizia *"DUAS CAUSAS, UMA RESPOSTA — e a indistinguibilidade é
 * construída AQUI"*, e a substituição é a decisão, não um efeito colateral dela.** Docblock que
 * sobrevive à decisão que ele explica é o vetor da regressão de decisão: a próxima rodada leria a
 * distinção como defeito e a desfaria por "conformidade".
 *
 * **Por que a premissa envelheceu.** A doutrina da recusa indistinguível deste repositório existe
 * contra **oráculo de existência** — é o caso de `CREDENCIAL_INVALIDA`, quatro causas num código só,
 * porque distinguir *"confirmaria ao atacante que a conta existe"*. **Aqui não há atacante a
 * informar**: quem pede está autenticado, detém `ACAO:configurar_integracao` e apresentou **as duas
 * metades** — o arquivo e a senha. Dizer-lhe qual das duas não serve não revela nada que ele já não
 * tenha. O custo do silêncio é medido: em 2026-08-20 o operador caçou uma senha errada que não
 * existia, porque a única recusa possível descrevia as duas causas ao mesmo tempo. Era o `D64`.
 *
 * As três causas chegam **por tipo** e saem com **código próprio** (ADR-0017):
 *
 * | Causa | Chega como | Sai como |
 * |---|---|---|
 * | formato/embalagem que não se abre nem se converte | `ErroDeFormatoDoMaterial` | `MATERIAL_EM_FORMATO_NAO_SUPORTADO` |
 * | senha que não abre o material | `ErroDeSenhaQueNaoAbre` | `SENHA_DO_MATERIAL_NAO_ABRE` |
 * | validade já encerrada | `ErroDeCertificadoVencido` | `CERTIFICADO_COM_VALIDADE_ENCERRADA` |
 *
 * ⚠️ **A classificação é pelo TIPO da exceção, jamais por texto de mensagem.** É o que impede a
 * distinção de se perder de novo por caminho novo: apagar um ramo `instanceof` aparece no diff,
 * enquanto uma redação que deixa de casar degrada em silêncio.
 *
 * ⚠️ **O `campo` permanece `'corpo'` nas TRÊS.** Nomear `material` ou `senha` diria **qual metade**
 * do corpo falhou por uma via que o `codigo` já cobre — e o `campo` é o que o cliente usa para
 * destacar entrada, não para diagnosticar. A distinção que a fatia acrescenta é a do **código**, e
 * só dela.
 *
 * ⚠️ **Nenhuma das três mensagens interpola valor vindo do corpo**, e elas têm **uma** declaração —
 * `MENSAGEM_POR_CODIGO`, em `comum/filtro-excecao.ts`. Segredo interpolado em texto sobrevive em
 * `mensagem` e `pilha` do evento, onde a redação do registrador não o alcança.
 *
 * ===========================================================================
 * O MATERIAL É PREPARADO ANTES DE SER LIDO — e o que se guarda é o CONVERTIDO
 * ===========================================================================
 *
 * A Autoridade Certificadora entrega o cofre em cifra que o runtime não abre (medido em duas
 * emissões consecutivas), e o produto recusava exatamente o arquivo que o Admin recebeu. Desde a F5
 * a borda chama {@link converterMaterialSeNecessario} em vez de `lerMaterial` direto: material
 * moderno atravessa **byte a byte** e nenhum processo externo chega a ser criado; material legado é
 * convertido, e o que se cifra e se guarda é o **convertido** (ADR-0036).
 *
 * Este serviço **orquestra e não converte**: ele não cria processo, não escreve arquivo e não conhece
 * o binário. A tolerância à cifra fraca vive confinada no subprocesso de vida curta de
 * `@sysloc/cobranca-bancaria`, e não no processo que decifra todo segredo operável do produto
 * (ADR-0032).
 *
 * ===========================================================================
 * O ESTADO É DERIVADO, e o relógio é o do BANCO (ADR-0022, ADR-0023, ADR-0026)
 * ===========================================================================
 *
 * `estado` e `diasParaVencer` não existem em coluna nenhuma: são compostos a cada leitura por
 * {@link derivarEstadoDaVigencia}, que é **pura** — não lê relógio, não consulta banco e não conhece
 * fuso. As duas datas que ela compara chegam **por parâmetro**, já resolvidas pelo banco
 * (`lerVigenciaObservada`), que é o que a ADR-0026 exige por escrito. Gravar o estado criaria uma
 * segunda fonte do mesmo fato, que a passagem do tempo faria divergir sozinha.
 *
 * ===========================================================================
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ===========================================================================
 *
 * Toda instrução sobre `negocio.certificado_do_provedor` vive em
 * `packages/db/src/certificado-do-provedor.ts`, publicada como função de domínio. E não existe, em
 * lugar algum deste arquivo, uma comparação de empresa: o `empresa_id` sai do contexto que a guarda
 * publicou a partir da sessão, e a política do banco é quem recorta (ADR-0008).
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  converterMaterialSeNecessario,
  ErroDeFormatoDoMaterial,
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
  type MaterialLido,
  type MaterialPreparado,
  type PortaDeIdentidadeBancaria,
} from '@sysloc/cobranca-bancaria';
import {
  type CertificadoGravado,
  ErroDeCertificadoVencido,
  lerCertificadoVigente,
  lerVigenciaObservada,
  obterEnvelopeCifradoDoVigente,
  registrarCertificado,
  type VigenciaObservada,
} from '@sysloc/db';
import {
  type CargaDaReconferenciaDaEntrega,
  CodigoErro,
  cifrarSegredo,
  criarSegredoOperavel,
  decifrarSegredo,
  ErroDeAplicacao,
  type Logger,
  type SegredoOperavel,
} from '@sysloc/shared';
import {
  type Certificado,
  type EstadoDoCertificado,
  LIMIAR_DE_VENCIMENTO_EM_DIAS,
  type ResultadoDaVerificacao,
} from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../comum/produtor-de-fila.js';
import {
  type Ambiente,
  TOKEN_AMBIENTE,
  TOKEN_LOGGER,
  TOKEN_PORTA_DE_IDENTIDADE_BANCARIA,
} from '../configuracao/ambiente.js';

/**
 * O campo que a recusa do material nomeia — o **corpo**, e nunca `material` ou `senha`.
 *
 * Constante nomeada porque é contrato publicado: ela sai em `campo` no envelope da ADR-0017, e é
 * comparada por igualdade de corpo inteiro pela suíte. A escolha do valor está no cabeçalho.
 */
const CAMPO_DO_CORPO = 'corpo';

/**
 * O motivo interno da recusa por vencimento — para o journal, **nunca** para o corpo da resposta.
 *
 * Ele é escrito aqui porque a exceção que o produz vem da camada de dados e não carrega motivo,
 * diferente das duas do domínio do material — que trazem o próprio (`SENHA_NAO_ABRE` e
 * `FORMATO_NAO_SUPORTADO`) e são repassadas sem tradução. Os três nomes ocupam o **mesmo campo**, de
 * modo que o operador filtra as três recusas do registro por um só.
 */
const MOTIVO_DO_VENCIDO = 'JA_VENCIDO';

/** A frase que o journal carrega quando a recusa do material acontece — uma para as duas causas. */
const TRILHA_DO_MATERIAL_RECUSADO = 'material de certificado recusado no registro';

/**
 * A frase que o journal carrega quando a reconferência não pôde ser enfileirada.
 *
 * Constante nomeada porque é o que o operador filtra para achar as empresas cuja entrega da notícia
 * ficou descrevendo o certificado anterior — e um literal no meio do `catch` diverge da consulta que
 * alguém salvou.
 */
const TRILHA_DA_RECONFERENCIA_NAO_ENFILEIRADA =
  'o certificado foi registrado e a reconferência da entrega não pôde ser enfileirada';

/**
 * A frase da trilha da conversão (§13 da tech spec) — `info`, e sem nada do que chegou no corpo.
 *
 * O único fato registrado é **que houve conversão**; nem tamanho, nem nome, nem bytes, nem a saída
 * do processo externo, que a ADR-0036 mantém fora do diário.
 */
const TRILHA_DO_MATERIAL_CONVERTIDO = 'material de certificado convertido antes do registro';

/**
 * A mensagem do `404` da RN-01 — nomeia a empresa da sessão e a ausência, sem identificador.
 *
 * ⚠️ **Exportada a partir da T7 da fatia `integracao-bancaria-autonoma`**, e a exportação é o que
 * impede a TERCEIRA cópia: a mesma frase já vive em `../cobrancas/boleto.service.ts`, que a publica
 * como recusa de **pré-condição** do ato externo, e a ativação da entrega da notícia precisava dela
 * pelo mesmo motivo. Ao terceiro consumidor o símbolo duplicado sobe para casa compartilhada em vez
 * de ganhar mais uma cópia (Limiar de Três do `CLAUDE.md`), e esta é a casa: o certificado é desta
 * área. O valor é **contrato publicado** — o cliente lê a frase —, e três literais soltos ficariam
 * livres para divergir.
 */
export const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';

/**
 * O nome do discriminador que a recusa por vencimento publica dentro de `detalhes`.
 *
 * Exportado pela mesma razão da mensagem acima, e com o mesmo alcance: ele é o nome que o cliente
 * procura em `detalhes` para saber que o que terminou foi a **validade**, e é o mesmo nas três
 * recusas que o publicam.
 */
export const DISCRIMINADOR_DA_VALIDADE = 'validoAte';

/** A entidade nomeada na linha de trilha do registro (§13.1). */
const ENTIDADE_DA_TRILHA = 'certificado_do_provedor';

/** Quantos milissegundos tem um dia de calendário — no eixo em que nenhum deles tem 23 ou 25 horas. */
const MILISSEGUNDOS_POR_DIA = 86_400_000;

/** A forma do dia de calendário que o banco entrega, e a única que esta derivação aceita. */
const FORMA_DO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * O que a leitura curta entrega ao ato externo — o vigente da empresa do contexto, e nada mais.
 *
 * ⚠️ **O envelope viaja CIFRADO daqui até a decifra**, que acontece dentro de `@sysloc/shared`
 * (ADR-0032). Este tipo é o que atravessa a borda entre a metade transacional e a metade externa, e
 * carregar aqui um {@link SegredoOperavel} já aberto estenderia a janela de residência do claro para
 * além do ato — exatamente o que a D6-a foi rejeitada por fazer.
 *
 * O `certificadoId` acompanha porque a linha de trilha do ato o nomeia (§13.1): sem ele, o operador
 * lê no journal que *uma* identidade foi verificada, e não **qual**.
 */
export interface IdentidadeGuardada {
  readonly certificadoId: string;
  readonly envelopeCifrado: string;
}

/**
 * O que a preparação do material entrega ao registro — os três fatos que o ato precisa, e nada mais.
 *
 * `segredo` é o invólucro do que se vai **cifrar e guardar**: o convertido quando houve conversão
 * (ADR-0036), e o invólucro que chegou, sem cópia nova, quando não houve. `lido` é a identidade que
 * a projeção publica, aberta do **mesmo** material que será gravado — nunca do recebido, que num
 * registro convertido é outro conjunto de bytes. `convertido` é o desfecho do ato, e é o único dos
 * três que atravessa até a resposta.
 */
export interface MaterialDoRegistro {
  readonly lido: MaterialLido;
  readonly segredo: SegredoOperavel;
  readonly convertido: boolean;
}

/** O que a derivação do estado responde — os dois campos que a projeção publica. */
export interface VigenciaDerivada {
  readonly estado: EstadoDoCertificado;
  readonly diasParaVencer: number;
}

/**
 * Deriva a faixa e os dias restantes da validade contra a data corrente da operação (RN-04, §6.2).
 *
 * ===========================================================================
 * ELA É PURA, e a pureza é exigida por ADR — não é preferência de estilo
 * ===========================================================================
 *
 * A `Decision` da ADR-0026 diz que *"a aplicação recebe o instante já resolvido, **por parâmetro**, e
 * a decisão que o consome é **pura**"*. Portanto: nenhum `new Date()`, nenhum `Date.now()`, nenhuma
 * consulta ao banco e nenhum nome de fuso dentro desta função. Quem resolve as duas datas é o banco,
 * uma vez por requisição, por `lerVigenciaObservada`.
 *
 * ===========================================================================
 * OS DOIS PARÂMETROS SÃO DIAS DE CALENDÁRIO, e é isso que torna a conta exata
 * ===========================================================================
 *
 * Eles chegam em `AAAA-MM-DD`, já reduzidos **no fuso da operação** pelo banco. Subtrair dias de
 * calendário é aritmética fechada: `Date.UTC` os põe na mesma origem, e em UTC nenhum dia tem 23 ou
 * 25 horas, de modo que a divisão por {@link MILISSEGUNDOS_POR_DIA} é inteira por construção — sem
 * arredondamento, sem horário de verão e sem depender de onde o processo roda.
 *
 * Receber **instantes** aqui seria a forma idiomática e está descartada por razão medida: reduzir um
 * `timestamptz` a dia exige nomear o fuso da operação, e nomeá-lo deste lado da fronteira criaria um
 * eixo a mais — o que ele faria divergir é a coerência entre a recusa do registro (RN-03, no banco) e
 * o estado publicado na consulta, sobre o mesmo certificado e no mesmo dia.
 *
 * O limiar vem de {@link LIMIAR_DE_VENCIMENTO_EM_DIAS}, importado de `@syslocbr/contracts` e **nunca**
 * redigitado: ele governa as três respostas do produto sobre vencimento, e uma segunda declaração
 * ficaria livre para divergir sem que nada acusasse.
 *
 * @param validoAte     O dia em que a validade termina, no eixo da operação.
 * @param dataCorrente  O dia corrente da operação.
 */
export function derivarEstadoDaVigencia(validoAte: string, dataCorrente: string): VigenciaDerivada {
  const diasParaVencer = (emDias(validoAte) - emDias(dataCorrente)) / MILISSEGUNDOS_POR_DIA;

  return { estado: faixaDe(diasParaVencer), diasParaVencer };
}

/**
 * A faixa correspondente aos dias restantes — **fechada do lado `VENCENDO`**.
 *
 * A ordem dos ramos é conteúdo: `VENCIDO` primeiro, porque dia negativo também satisfaz o `<=` do
 * limiar. E o limiar é `<=`, não `<`: faltando exatamente {@link LIMIAR_DE_VENCIMENTO_EM_DIAS} dias o
 * certificado **já** está vencendo, e faltando um a mais ainda está vigente — é o par que o CT-825
 * prende do outro lado, e o deslize de um dia reprova sozinho.
 */
function faixaDe(diasParaVencer: number): EstadoDoCertificado {
  if (diasParaVencer < 0) {
    return 'VENCIDO';
  }

  return diasParaVencer <= LIMIAR_DE_VENCIMENTO_EM_DIAS ? 'VENCENDO' : 'VIGENTE';
}

/**
 * Converte o dia de calendário na origem comum — meia-noite UTC daquele dia.
 *
 * UTC não é o fuso da operação, e não precisa ser: os dois dias já vieram reduzidos naquele fuso, e
 * o que se faz aqui é apenas contar a distância entre eles. Escolher UTC é escolher a única linha do
 * tempo sem salto de hora, que é o que faz a subtração ser exata.
 *
 * Dia fora de forma **levanta** em vez de virar `NaN` seguindo adiante: um `NaN` produziria
 * `diasParaVencer: null` no corpo publicado, e a rota mentiria sobre um certificado que existe.
 */
function emDias(dia: string): number {
  const partes = FORMA_DO_DIA.exec(dia);

  if (partes === null) {
    throw new Error('o eixo de data da operação não veio na forma AAAA-MM-DD');
  }

  return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

@Injectable()
export class CertificadoDoProvedorService {
  constructor(
    // O ambiente **já validado** na partida. É dele que sai a chave de cifra, e ele é a única fonte:
    // um `process.env` lido aqui escaparia da conferência que recusa a chave de comprimento errado.
    @Inject(TOKEN_AMBIENTE) private readonly ambiente: Ambiente,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
    // A porta chega **por injeção**, e este arquivo não conhece provedor algum (ADR-0025): quem
    // escolhe o adaptador é a composição (`integracoes-bancarias.module.ts`), e é ela que sabe de
    // endereço. Importar `criarAdaptadorSicoob` aqui daria a este serviço um segundo caminho para
    // decidir o destino da conexão, que é o que a escolha estrutural existe para impedir.
    @Inject(TOKEN_PORTA_DE_IDENTIDADE_BANCARIA)
    private readonly identidadeBancaria: PortaDeIdentidadeBancaria,
    // O produtor de fila chega pelo token que `../comum/fila.module.js` provê — e o módulo desta
    // área o alcança importando aquele módulo, nunca abrindo conexão própria. É a via que o
    // cabeçalho de `comum/fila.module.ts` manda usar, e `apps/api/test/alcance-da-fila.spec.ts`
    // afirma por igualdade de conjunto quem a usa.
    @Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila,
  ) {}

  /**
   * Prepara o material e lê dele o que o produto publica — **fora de qualquer transação** (§7.4).
   *
   * ===========================================================================
   * ELE ORQUESTRA A CONVERSÃO, e não ganha a capacidade de executá-la (ADR-0036)
   * ===========================================================================
   *
   * A única porta é {@link converterMaterialSeNecessario}: material que o runtime já abre atravessa
   * **byte a byte**, sem que processo externo algum chegue a ser criado; material em cifra legada é
   * convertido no subprocesso de vida curta daquele módulo. Este arquivo não cria processo, não
   * escreve arquivo e não conhece o binário — a tolerância à cifra fraca fica confinada onde a
   * ADR-0036 a pôs, e não no processo que decifra todo segredo operável do produto.
   *
   * O parâmetro é o invólucro opaco da ADR-0032. Quando houve conversão, o que segue para a cifra é
   * um invólucro **novo**, montado com os bytes convertidos e a **mesma** senha — um segundo segredo
   * daria ao produto duas metades livres para divergir na renovação. Quando não houve, o que segue é
   * o invólucro que chegou, sem cópia nova: cópia do claro na heap é exatamente a superfície que a
   * ADR-0032 existe para encurtar.
   *
   * ⚠️ **A leitura acontece sobre o material PREPARADO, e nunca sobre o recebido.** Num registro
   * convertido os dois são conjuntos de bytes diferentes, e publicar a identidade lida do recebido
   * descreveria um certificado que não é o que ficou guardado. (A conversão já conferiu que os dois
   * são o mesmo certificado; ler o preparado é o que torna essa igualdade irrelevante para a
   * correção desta borda em vez de pressuposto dela.)
   *
   * ===========================================================================
   * O TETO DESTA ROTA é o da conversão, e a decisão é NÃO acrescentar um segundo
   * ===========================================================================
   *
   * O pior caso é **limitado e conhecido**: 5 s da leitura direta, mais 30 s da decodificação, mais
   * 5 s da leitura do convertido dentro da conversão, mais 30 s da reexportação, mais 5 s da leitura
   * daqui — **75 s**, todos impostos por teto próprio de quem os gasta, e o processo externo é morto
   * por sinal quando estoura. Fica abaixo do teto de requisição do runtime, de modo que nenhuma
   * requisição fica pendurada e nenhuma é ceifada no meio da conversão.
   *
   * Um segundo teto **nesta borda** foi considerado e recusado: ele abortaria a requisição sem
   * cancelar o subprocesso — que continuaria correndo, com o intermediário em claro vivo — e o Admin
   * receberia uma recusa sobre um ato que ainda está acontecendo. O teto que governa é o de quem
   * pode encerrar o que criou.
   *
   * ===========================================================================
   * AS DUAS CAUSAS SÃO DISTINGUIDAS PELO TIPO, e cada uma tem código próprio
   * ===========================================================================
   *
   * O registro é `warn`, e não `error`: entrada recusada é ato normal do Admin, e classificá-la como
   * erro do serviço encheria o journal de alarme para o que é conversa de cadastro. Nenhum campo do
   * corpo entra na linha — nem o tamanho do material, que já seria um oráculo sobre o arquivo
   * enviado —, e o motivo interno é o que a própria exceção carrega, sem tradução.
   *
   * Toda outra falha atravessa intacta: traduzir em bloco atribuiria à entrada do cliente uma recusa
   * que ele não causou.
   */
  async prepararMaterial(segredo: SegredoOperavel): Promise<MaterialDoRegistro> {
    const preparado = await this.converter(segredo);

    // O invólucro do recebido é reaproveitado quando nada foi convertido — e é só na conversão que
    // o claro precisa ser reembalado, porque só ali os bytes são outros. `abrir()` é chamado dentro
    // da expressão: o par em claro não ganha nome próprio no escopo, que é o que um registro de
    // diagnóstico futuro acharia à mão.
    const paraGuardar = preparado.convertido
      ? criarSegredoOperavel({ material: preparado.material, senha: segredo.abrir().senha })
      : segredo;

    if (preparado.convertido) {
      this.logger.info({ entidade: ENTIDADE_DA_TRILHA }, TRILHA_DO_MATERIAL_CONVERTIDO);
    }

    return {
      lido: await this.ler(paraGuardar),
      segredo: paraGuardar,
      convertido: preparado.convertido,
    };
  }

  /**
   * Cifra o segredo e registra o certificado da empresa do contexto, **substituindo** o vigente.
   *
   * A cifra acontece aqui, e não na camada de dados: aquele pacote trata `segredo_cifrado` como texto
   * opaco e não importa nada que saiba abri-lo (ADR-0032) — pôr a cifra lá poria o material em claro
   * dentro do pacote que monta consulta, que é o vetor pelo qual o cliente de banco anexa parâmetros
   * ao erro. Aqui o invólucro entra e uma cadeia base64 sai; **as cadeias cruas do corpo nunca são
   * tocadas de novo** desde a borda.
   *
   * A recusa por vencimento é reconhecida pelo **tipo**, nunca por texto de mensagem, e publica em
   * `detalhes` a data em que a validade terminou — que é o que a CA-06 exige, e o único jeito de o
   * Admin saber que o arquivo é velho em vez de errado.
   */
  async registrar(
    tx: TransactionSql,
    material: MaterialLido,
    segredo: SegredoOperavel,
    registradoPor: string,
  ): Promise<Certificado> {
    // O `try` cobre **só a escrita**, e o recorte é conteúdo: a projeção publicada corre fora dele,
    // de modo que nenhuma falha da leitura da vigência possa ser confundida com a recusa de validade
    // que este ramo traduz. Capturar em bloco é como uma recusa vira mensagem errada ao Admin.
    let gravado: CertificadoGravado;

    try {
      gravado = await registrarCertificado(tx, {
        titular: material.titular,
        validoDe: material.validoDe,
        validoAte: material.validoAte,
        impressaoDigital: material.impressaoDigital,
        segredoCifrado: cifrarSegredo(segredo, this.ambiente.chaveDeCifraDoCertificado),
        registradoPor,
      });
    } catch (erro) {
      if (!(erro instanceof ErroDeCertificadoVencido)) {
        throw erro;
      }

      this.logger.warn(
        { entidade: ENTIDADE_DA_TRILHA, motivo: MOTIVO_DO_VENCIDO },
        TRILHA_DO_MATERIAL_RECUSADO,
      );

      throw new ErroDeAplicacao(
        CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA,
        MENSAGEM_POR_CODIGO[CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA],
        {
          campo: CAMPO_DO_CORPO,
          detalhes: { [DISCRIMINADOR_DA_VALIDADE]: erro.validoAte.toISOString() },
        },
      );
    }

    return await this.publicar(tx, gravado);
  }

  /**
   * Enfileira a **reconferência** da entrega da notícia — **fora** da unidade de trabalho, e em
   * melhor-esforço.
   *
   * ===========================================================================
   * Ele NÃO recebe `tx`, e não pode receber
   * ===========================================================================
   *
   * A ordem é gravar e **só então** enfileirar, e o precedente está escrito por extenso em
   * `../cobranca-bancaria/conferencia-bancaria.service.ts` e em
   * `../notificacoes-bancarias/notificacao-bancaria.service.ts`: inverter enfileiraria um trabalho
   * sobre um certificado que a transação ainda pode desfazer, e a tarefa correria contra uma linha
   * que não existe. A falha oposta — enfileirar e o commit desfazer — é impossível por construção, e
   * é o que dispensa uma tabela de *outbox*. **Um parâmetro `tx` aqui destruiria essa propriedade**,
   * porque só se tem `tx` dentro da unidade.
   *
   * ===========================================================================
   * MELHOR-ESFORÇO: a falha é registrada e NÃO propaga (RN-12)
   * ===========================================================================
   *
   * ⚠️ **Engolir aqui é a decisão certa, e ela é o oposto do que a emissão em lote faz.** Propagar
   * devolveria `503` a um Admin cujo pedido — *"registre este certificado"* — **já foi atendido e
   * commitado**, e o efeito prático seria pior que o problema: ele reenviaria o material, criando um
   * segundo registro do mesmo certificado, com a fila ainda fora do ar. A reconferência é efeito
   * secundário cujo resultado não compõe a resposta (ADR-0029); o que não podia se perder já está
   * gravado.
   *
   * O preço é declarado: a linha do estado da entrega continua descrevendo o certificado anterior até
   * que alguém reative a entrega pela rota manual. É por isso que a linha do diário carrega a
   * **empresa** e o **certificado**, que é o par com que o operador reconhece o que ficou para trás.
   *
   * O `erro` que chega já é **da aplicação** — construído pelo produtor, com a causa reduzida a texto
   * (`DECISÃO FECHADA — T9 / Gate 2` de `../comum/produtor-de-fila.js`). Nenhum objeto de exceção da
   * biblioteca de fila atravessa aquela fronteira, e é isso que permite registrá-lo aqui.
   */
  async enfileirarReconferencia(
    carga: CargaDaReconferenciaDaEntrega,
    certificadoId: string,
  ): Promise<void> {
    try {
      await this.produtor.enfileirarReconferenciaDaEntrega(carga);
    } catch (erro) {
      // `warn`, e não `error`: o ato do Admin foi concluído e a resposta dele não muda. O que o
      // operador precisa é do par (empresa, certificado) para reconferir a entrega à mão.
      this.logger.warn(
        {
          erro,
          empresaId: carga.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          certificadoId,
        },
        TRILHA_DA_RECONFERENCIA_NAO_ENFILEIRADA,
      );
    }
  }

  /**
   * O certificado vigente da empresa do contexto, com a vigência derivada no instante da leitura.
   *
   * A ausência é **fato do domínio** e vira `404` nomeando a empresa e o que falta (RN-01): não há
   * identidade de reserva, e um corpo genérico faria o Admin procurar defeito onde há configuração
   * pendente. Um certificado **vencido continua sendo o vigente** e é devolvido com `200` — é o que a
   * empresa tem, e escondê-lo tiraria dela justamente o aviso de que precisa renovar.
   */
  async consultar(tx: TransactionSql): Promise<Certificado> {
    const vigente = await lerCertificadoVigente(tx);

    if (vigente === undefined) {
      throw new ErroDeAplicacao(CodigoErro.RECURSO_NAO_ENCONTRADO, MENSAGEM_SEM_CERTIFICADO);
    }

    return await this.publicar(tx, vigente);
  }

  /**
   * Lê o material guardado do vigente — a metade **transacional** e **curta** da verificação (§3.3).
   *
   * Ela faz duas leituras e nenhuma escrita, e é a última coisa que corre dentro da unidade de
   * trabalho: quem chama fecha a transação com o que ela devolveu, e só então constrói o cliente
   * mTLS. Nada aqui decifra: o que sai é o envelope como a coluna o guarda.
   *
   * ⚠️ **A ausência recusa AQUI, antes de qualquer tentativa** (RN-01). O `404` é levantado nesta
   * função, com a **mesma** mensagem da consulta — a empresa sem certificado ouve a mesma frase nas
   * duas rotas, porque o fato é o mesmo — e o ato externo não chega a ser alcançado. Não existe ramo
   * de reserva: uma empresa sem identidade própria não tem identidade alguma.
   *
   * As duas leituras correm na **mesma** transação de propósito: pedir o identificador numa e o
   * envelope noutra abriria a janela em que a renovação de outra sessão acontece entre elas, e a
   * trilha nomearia um certificado que não é o que foi apresentado.
   */
  async lerIdentidadeGuardada(tx: TransactionSql): Promise<IdentidadeGuardada> {
    const vigente = await lerCertificadoVigente(tx);

    if (vigente === undefined) {
      throw new ErroDeAplicacao(CodigoErro.RECURSO_NAO_ENCONTRADO, MENSAGEM_SEM_CERTIFICADO);
    }

    const envelopeCifrado = await obterEnvelopeCifradoDoVigente(tx);

    if (envelopeCifrado === undefined) {
      // Estado que a `CHECK` da RN-13 torna irrepresentável — vigente sem segredo não existe no
      // banco. A recusa é a **mesma** da ausência, e não um `500`: um erro de servidor aqui diria ao
      // cliente que existe uma linha em estado esquisito, que é informação sobre o dado guardado.
      throw new ErroDeAplicacao(CodigoErro.RECURSO_NAO_ENCONTRADO, MENSAGEM_SEM_CERTIFICADO);
    }

    return { certificadoId: vigente.id, envelopeCifrado };
  }

  /**
   * Verifica a identidade guardada contra o provedor — **fora de qualquer transação** (§3.3).
   *
   * A decifra acontece **dentro** da expressão que invoca a porta, e o claro não ganha nome próprio
   * no escopo: uma variável com o `SegredoOperavel` aberto é exatamente o que um registro de
   * diagnóstico futuro acharia à mão, e a ADR-0032 é sobre não haver o que redigir. Quem abre o
   * invólucro é o adaptador, dentro da chamada, e a janela de residência do material é a duração do
   * ato.
   *
   * **Nenhum desfecho é traduzido em erro**, e a ausência de `try` é a decisão: a porta resolve em
   * todos os cinco desfechos (`packages/cobranca-bancaria/src/porta-de-identidade.ts`), de modo que
   * recusa pelo par, indisponibilidade e tempo esgotado chegam aqui como resposta — e viram `200` com
   * `aceito: false`. Capturar em bloco converteria a recusa do provedor em falha do produto, que é a
   * leitura oposta à do Admin (RN-06).
   *
   * A projeção é montada campo a campo, e **não** por repasse do objeto da porta: os dois tipos
   * coincidem hoje e a coincidência é contingente — a `DECISÃO FECHADA` de
   * `packages/cobranca-bancaria/src/modelo-canonico.ts` registra por que um é do domínio e o outro é
   * do contrato, e é aqui, num ponto só, que eles se aproximam.
   */
  async verificarIdentidade(guardada: IdentidadeGuardada): Promise<ResultadoDaVerificacao> {
    const desfecho = await this.identidadeBancaria.verificarIdentidade({
      segredo: decifrarSegredo(guardada.envelopeCifrado, this.ambiente.chaveDeCifraDoCertificado),
    });

    return {
      aceito: desfecho.aceito,
      verificadoEm: desfecho.verificadoEm,
      detalhe: desfecho.detalhe,
    };
  }

  /**
   * Corre a conversão condicional, traduzindo as recusas do domínio em recusas do contrato.
   *
   * O `try` cobre **só** a chamada da conversão, e o recorte é conteúdo: nenhuma outra falha do ato
   * pode ser confundida com a recusa da entrada que este ramo traduz.
   */
  private async converter(segredo: SegredoOperavel): Promise<MaterialPreparado> {
    try {
      return await converterMaterialSeNecessario(segredo);
    } catch (erro) {
      throw this.recusarOMaterial(erro);
    }
  }

  /**
   * Abre o material **já preparado** — pelas mesmas duas causas, e pelos mesmos códigos.
   *
   * Uma recusa aqui é praticamente inalcançável: quem chegou a esta linha ou abriu na leitura direta
   * da conversão, ou foi reaberto por ela na conferência de identidade. O ramo existe assim mesmo
   * porque `lerMaterial` declara as duas recusas, e deixá-las escapar faria um defeito de **entrada
   * do cliente** sair como falha do servidor.
   */
  private async ler(segredo: SegredoOperavel): Promise<MaterialLido> {
    try {
      return await lerMaterial(segredo);
    } catch (erro) {
      throw this.recusarOMaterial(erro);
    }
  }

  /**
   * O **ponto único** em que uma recusa do material vira recusa do contrato — três tipos, dois
   * códigos.
   *
   * A classificação é pelo **tipo** da exceção, jamais por texto: apagar um dos ramos aparece no
   * diff, enquanto uma redação que deixa de casar degradaria em silêncio — que é o `D64` invertido.
   * O motivo interno é o que a própria exceção carrega, e vai **só** para o journal.
   *
   * Toda outra falha **atravessa intacta**: traduzi-la aqui atribuiria à entrada do cliente uma
   * recusa que ele não causou. Por isso o retorno é o erro a levantar, e quem chama escreve
   * `throw` — a função nunca decide sozinha engolir o que não reconhece.
   *
   * O motivo é lido **dentro** de cada ramo, e não depois deles, para que o estreitamento de tipo
   * faça o trabalho: uma conversão escrita à mão aqui aceitaria em silêncio uma exceção futura sem
   * `motivo`, e o journal registraria a recusa sem o campo que o operador filtra.
   */
  private recusarOMaterial(erro: unknown): unknown {
    if (erro instanceof ErroDeSenhaQueNaoAbre) {
      return this.recusaDoMaterial(CodigoErro.SENHA_DO_MATERIAL_NAO_ABRE, erro.motivo);
    }

    // As duas viram o **mesmo** código porque descrevem o mesmo desfecho para o Admin — o arquivo
    // não se deixa ler. O que as separa é o motivo interno (`FORMATO_NAO_SUPORTADO` contra
    // `MATERIAL_ILEGIVEL`), que é o que o operador filtra no journal.
    if (erro instanceof ErroDeFormatoDoMaterial || erro instanceof ErroDeMaterialIlegivel) {
      return this.recusaDoMaterial(CodigoErro.MATERIAL_EM_FORMATO_NAO_SUPORTADO, erro.motivo);
    }

    return erro;
  }

  /**
   * Registra a recusa e compõe o envelope — `warn`, e com a mensagem da **fonte única** do código.
   *
   * O registro é `warn`, e não `error`: entrada recusada é ato normal do Admin, e classificá-la como
   * erro do serviço encheria o journal de alarme para o que é conversa de cadastro. Nenhum campo do
   * corpo entra na linha — nem o tamanho do material, que já seria um oráculo sobre o arquivo
   * enviado.
   */
  private recusaDoMaterial(codigo: CodigoErro, motivo: string): ErroDeAplicacao {
    this.logger.warn({ entidade: ENTIDADE_DA_TRILHA, motivo }, TRILHA_DO_MATERIAL_RECUSADO);

    return new ErroDeAplicacao(codigo, MENSAGEM_POR_CODIGO[codigo], { campo: CAMPO_DO_CORPO });
  }

  /**
   * Monta a projeção publicada **a partir das colunas**, nunca do que chegou no corpo (§5.1, passo 7).
   *
   * As três datas saem em ISO-8601 com `toISOString()`: as colunas são `timestamptz`, isto é,
   * instantes absolutos, e a serialização deles é determinística onde quer que aconteça — a
   * conversão por molde que `cobranca.ts` aplica às colunas `date` não tem cabimento aqui.
   *
   * O eixo de data é lido **uma vez por requisição**, e é o mesmo par que a derivação consome: pedir
   * a data corrente duas vezes na mesma resposta abriria a janela em que a virada do dia acontece
   * entre as duas leituras.
   */
  private async publicar(tx: TransactionSql, gravado: CertificadoGravado): Promise<Certificado> {
    const observada: VigenciaObservada = await lerVigenciaObservada(tx, gravado.validoAte);
    const vigencia = derivarEstadoDaVigencia(observada.fimDaValidade, observada.dataCorrente);

    return {
      id: gravado.id,
      titular: gravado.titular,
      validoDe: gravado.validoDe.toISOString(),
      validoAte: gravado.validoAte.toISOString(),
      impressaoDigital: gravado.impressaoDigital,
      estado: vigencia.estado,
      diasParaVencer: vigencia.diasParaVencer,
      registradoPor: { id: gravado.registradoPor.id, nome: gravado.registradoPor.nome },
      registradoEm: gravado.registradoEm.toISOString(),
    };
  }
}
