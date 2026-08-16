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
 * — **não existe nesta fatia por construção**, já que não há carga de tarefa. A fatia (ii), que terá
 * fila e levará o mesmo material a ela, **não herda essa propriedade**.
 *
 * ===========================================================================
 * A ORDEM DOS ATOS NÃO É LIVRE, e o que decide é ONDE a transação abre
 * ===========================================================================
 *
 * O registro tem duas metades, e elas correm em lugares diferentes de propósito:
 *
 *   1. **fora** da unidade de trabalho — {@link CertificadoDoProvedorService.lerMaterial}, que abre
 *      o cofre PKCS#12 por aperto de mão em laço local. É I/O, e segurar conexão física do banco
 *      durante ele repetiria o achado da T7 da fatia `documentos-e-confirmacao` (renderização de
 *      ~0,5 s dentro do `sql.begin`), agora sobre uma reserva de conexões que atende todo o produto;
 *   2. **dentro** — {@link CertificadoDoProvedorService.registrar}, que cifra e grava. A cifra é
 *      trabalho de CPU de microssegundos, e mantê-la aqui é o que garante que o envelope gravado e a
 *      substituição do anterior sejam o **mesmo** commit.
 *
 * É por isso que o material lido **atravessa** de um método para o outro como parâmetro, e não é
 * relido: reler dentro da transação desfaria a metade (1).
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
 * DUAS CAUSAS, UMA RESPOSTA — e a indistinguibilidade é construída AQUI
 * ===========================================================================
 *
 * `ErroDeSenhaQueNaoAbre` e `ErroDeMaterialIlegivel` chegam **distintos** do adaptador, e é essa
 * distinção que o registro estruturado guarda (`motivo`, campo interno). O que sai para o Admin é
 * **uma** recusa: mesmo código, mesma mensagem, mesmo campo, mesmo corpo byte a byte. A distinção
 * nasce no adaptador e morre nesta linha.
 *
 * O campo nomeado é o do **corpo**, e não `material` nem `senha`: nomear qualquer um dos dois seria
 * dizer ao cliente **qual metade** falhou, que é precisamente a informação que a
 * indistinguibilidade existe para não dar. É a mesma razão pela qual a mensagem é única — quem
 * separa as duas causas é o operador, lendo o journal, e não quem envia o corpo.
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
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
  type MaterialLido,
  type PortaDeIdentidadeBancaria,
} from '@sysloc/cobranca-bancaria';
import {
  type Certificado,
  type EstadoDoCertificado,
  LIMIAR_DE_VENCIMENTO_EM_DIAS,
  type ResultadoDaVerificacao,
} from '@sysloc/contracts';
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
  CodigoErro,
  cifrarSegredo,
  decifrarSegredo,
  ErroDeAplicacao,
  type Logger,
  type SegredoOperavel,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
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
 * A mensagem **única** das duas causas de recusa do material (CA-05, PRD §7.2).
 *
 * Ela descreve o desfecho e não nomeia a metade culpada: *"não abriu com a senha apresentada"* é
 * verdade tanto para a senha errada quanto para os bytes que não são um PKCS#12. Nenhum valor
 * recebido entra aqui — a mensagem alcança o journal, e o corpo carrega material e senha.
 *
 * Ela **não** vem de `MENSAGEM_POR_CODIGO` (`comum/filtro-excecao.ts`): aquela tabela publica
 * *"requisição inválida"* para toda recusa de campo, e este é o único ponto do produto em que a
 * mensagem precisa dizer ao Admin o que conferir sem dizer qual das duas coisas está errada.
 */
const MENSAGEM_DO_MATERIAL_RECUSADO =
  'o certificado não pôde ser lido com a senha apresentada — confira o arquivo e a senha';

/**
 * A mensagem da recusa por validade encerrada (RN-03/CA-06).
 *
 * Ela é **distinta** da mensagem acima de propósito: aqui o arquivo abriu, o titular é legível e o
 * produto sabe exatamente o que há de errado — dizer *"confira o arquivo e a senha"* mandaria o
 * Admin procurar defeito onde não há. O valor recebido não entra na mensagem; a data em que a
 * validade terminou vai em `detalhes`, que é campo estruturado do envelope.
 */
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';

/**
 * O motivo interno da recusa por vencimento — para o journal, **nunca** para o corpo da resposta.
 *
 * Ele é escrito aqui porque a exceção que o produz vem da camada de dados e não carrega motivo,
 * diferente das duas do adaptador de material. O vocabulário é o mesmo (`SENHA_NAO_ABRE`,
 * `MATERIAL_ILEGIVEL`, `JA_VENCIDO`), de modo que o operador filtra as três recusas do registro por
 * um campo só.
 */
const MOTIVO_DO_VENCIDO = 'JA_VENCIDO';

/** A mensagem do `404` da RN-01 — nomeia a empresa da sessão e a ausência, sem identificador. */
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';

/** O nome do discriminador que a recusa por vencimento publica dentro de `detalhes`. */
const DISCRIMINADOR_DA_VALIDADE = 'validoAte';

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
 * O limiar vem de {@link LIMIAR_DE_VENCIMENTO_EM_DIAS}, importado de `@sysloc/contracts` e **nunca**
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
  ) {}

  /**
   * Lê do material o que o produto publica — **fora de qualquer transação** (§7.4).
   *
   * O parâmetro é o invólucro opaco da ADR-0032, e ele atravessa este método sem ser aberto: quem o
   * abre é o adaptador, dentro da chamada, e o claro não existe fora dela.
   *
   * As duas causas de recusa são traduzidas na **mesma** resposta e registradas com motivos
   * **distintos**. O registro é `warn`, e não `error`: entrada recusada é ato normal do Admin, e
   * classificá-la como erro do serviço encheria o journal de alarme para o que é conversa de
   * cadastro. Nenhum campo do corpo entra na linha — nem o tamanho do material, que já seria um
   * oráculo sobre o arquivo enviado.
   *
   * Toda outra falha atravessa intacta: traduzir em bloco atribuiria à entrada do cliente uma recusa
   * que ele não causou.
   */
  async lerMaterial(segredo: SegredoOperavel): Promise<MaterialLido> {
    try {
      return await lerMaterial(segredo);
    } catch (erro) {
      if (erro instanceof ErroDeSenhaQueNaoAbre || erro instanceof ErroDeMaterialIlegivel) {
        this.logger.warn(
          { entidade: ENTIDADE_DA_TRILHA, motivo: erro.motivo },
          'material de certificado recusado no registro',
        );

        throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_DO_MATERIAL_RECUSADO, {
          campo: CAMPO_DO_CORPO,
        });
      }

      throw erro;
    }
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
        'material de certificado recusado no registro',
      );

      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_DO_CERTIFICADO_VENCIDO, {
        campo: CAMPO_DO_CORPO,
        detalhes: { [DISCRIMINADOR_DA_VALIDADE]: erro.validoAte.toISOString() },
      });
    }

    return await this.publicar(tx, gravado);
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

  // DÉBITO COM GATILHO — D58 · F4/T13 · registrado 2026-08-15
  // (Ele AGENDA — não é uma `DECISÃO FECHADA`, que protegeria. Editar o método abaixo é normal; o que
  //  não se pode é editá-lo sem ler o que ainda falta.)
  // O QUÊ: a superfície `fila × segredo operável` não existe nesta fatia — nenhuma das três rotas
  //        enfileira nada — e **por isso não é medida** pela T13, cuja enumeração de caminhos de saída
  //        (`apps/api/test/segredo-nao-escapa.e2e.spec.ts`) a nomeia como o item 14, não medido.
  // QUANDO FECHA: a primeira carga de tarefa que transportar o segredo operável — a **fatia (ii)**, que
  //        terá fila e levará o mesmo material a ela. Ali a superfície `fila` entra na enumeração da
  //        ADR-0032 e **cobra caso que a meça**, pelo vetor exato do achado crítico da fase anterior:
  //        o `bullmq` empurra `job.data` como argumento de comando Redis, o `ioredis` o anexa ao erro,
  //        e a redação não alcança.
  // POR QUE NÃO AGORA: não há carga de tarefa nesta fatia; medir o que não existe seria asserção vácua
  //        — e asserção vácua numa fatia de segurança é pior que asserção ausente, porque consta como
  //        feita.
  // ÍNDICE: docs/specs/features/fundacao-bancaria/v1/_run/run-report.md §2, D58
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
