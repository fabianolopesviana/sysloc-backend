/**
 * O **par TLS mútuo instrumentado do provedor** — casa única do servidor de verificação que responde
 * às operações bancárias e conta as chamadas **por rota e por método**.
 *
 * ---------------------------------------------------------------------------
 * Por que ele nasce como casa compartilhada, e não como cópia numa suíte
 * ---------------------------------------------------------------------------
 *
 * O `CLAUDE.md` fixa que *acessório de suíte se importa, não se copia*, e que quando a casa
 * compartilhada do diretório não existe **ela é criada uma vez**. O molde vivo é `subirParDoProvedor`
 * de `./certificado-do-provedor.e2e.spec.ts`, e ele **não pode ser importado**: ele é privado daquela
 * suíte, e importá-lo registraria os ~30 casos dela dentro do arquivo importador — `describe`/`it`
 * executam na importação do módulo. Converter aquela suíte para importar daqui é conversão de suíte
 * existente, que a T7 declara **somente leitura**; ela acontece pelo caminho normal, quando a próxima
 * task tiver razão para abri-la.
 *
 * ⚠️ E ele **não é** aquele molde com outro nome: aquele responde `404` a tudo e conta apenas
 * conexões, apertos de mão e titulares. Este **roteia** — credencial, cadastro e consulta —, tem
 * respostas programáveis por operação, e conta **por rota e por método**. Um contador único faria os
 * casos que separam *"a confirmação foi alcançada"* de *"não foi"* degenerarem em `toBeGreaterThan`,
 * que é exatamente a asserção que não discrimina.
 *
 * ---------------------------------------------------------------------------
 * O que ele substitui é o DESTINO, nunca a lógica sob prova
 * ---------------------------------------------------------------------------
 *
 * O TLS mútuo é **real**, o cliente é o de produção e o teto é o de produção: o que a suíte troca é
 * para onde o adaptador conecta. Nada da lógica sob prova é dublado — se fosse, o `habilitada: true`
 * das suítes que o consomem não significaria nada.
 *
 * ---------------------------------------------------------------------------
 * O DIALETO do provedor mora aqui, e a duplicação com o adaptador é DELIBERADA
 * ---------------------------------------------------------------------------
 *
 * Os caminhos e as chaves abaixo são os do provedor, escritos **à mão**, e **não** importados de
 * `@sysloc/cobranca-bancaria` — que, aliás, não os publica. Derivá-los da mesma fonte que o SUT faria
 * o par concordar com o adaptador por construção, e um caminho que mudasse dos dois lados ao mesmo
 * tempo passaria despercebido. Escritos à mão, uma divergência aparece como rota não atendida, que é
 * o que se quer que aconteça.
 */

import type { Server as ServidorSeguro } from 'node:https';
import { createServer as criarParSeguro } from 'node:https';
import type { Server as ServidorTcp } from 'node:net';
import type { Duplex } from 'node:stream';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { expect, onTestFinished } from 'vitest';
import {
  type AutoridadeDeTeste,
  gerarParDeServidorDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';

/** O endereço de escuta do par — sempre o laço local (ADR-0006). */
const LACO_LOCAL = '127.0.0.1';

/** O nome comum do certificado do par, o mesmo do molde de `certificado-do-provedor.e2e.spec.ts`. */
const NOME_DO_PAR = 'par-de-teste.sysloc';

/** O caminho que o provedor usa para conceder credencial de acesso — dialeto, escrito à mão. */
/** O sufixo do recurso de reativação — vocabulário do provedor, escrito por extenso no par. */
const SUFIXO_DA_REATIVACAO = 'reativar';

const CAMINHO_DA_CREDENCIAL = '/auth/realms/cooperado/protocol/openid-connect/token';

/** O recurso das entregas no provedor — dialeto, escrito à mão. */
const RECURSO_DAS_ENTREGAS = '/cobranca-bancaria/v3/webhooks';

/** O status de sucesso com que o par responde quando aceita. */
const STATUS_ACEITO = 200;

/** Por quantos segundos a credencial concedida vale — folgado o bastante para o caso inteiro. */
const VALIDADE_DA_CREDENCIAL_EM_SEGUNDOS = 300;

/** A credencial que o par concede. Ela não protege nada: o par vive e morre dentro do caso. */
const CREDENCIAL_CONCEDIDA = 'credencial-do-par-de-verificacao';

/**
 * O status que faz o par **não responder**: a chamada é contada e o soquete é desfeito.
 *
 * Ele existe porque *"o provedor não chegou a responder"* é um desfecho de primeira classe da porta —
 * `motivo: null` —, e ele **não** é alcançável programando um status: um par que responda `5xx`
 * responde. Derrubar o par inteiro também não serve, porque a concessão da credencial cairia junto e
 * a chamada nem chegaria a ser contada, que é justamente a grandeza sob prova.
 */
export const STATUS_MUDO = 0;

/**
 * Uma resposta programada do par — status e corpo.
 *
 * O corpo é `string`, e não objeto, de propósito: há cenários cujo objeto de prova é **um corpo que
 * não é JSON**, e um campo tipado como objeto os tornaria inexprimíveis. Quem quer JSON serializa.
 */
export interface RespostaProgramada {
  readonly status: number;
  readonly corpo: string;
}

/**
 * Os contadores do par — **por rota e por método**.
 *
 * ⚠️ Os três mutantes (`put`, `patch`, `remocao`) e a `substituicao` são contados **separadamente**,
 * e não somados: a asserção que prova a não-intervenção compara o **mapa inteiro** por igualdade, de
 * modo que a falha nomeia **qual** método foi chamado. Um total agregado diria apenas que houve
 * chamada mutante.
 */
export interface ChamadasAoPar {
  /** `POST` no recurso das entregas — o cadastro. */
  cadastro: number;
  /** `GET` no recurso das entregas — a confirmação. */
  consulta: number;
  /** `POST` no recurso de concessão — a credencial de acesso. */
  credencial: number;
  put: number;
  patch: number;
  remocao: number;
  /** Qualquer chamada a um caminho **sob** o recurso das entregas — a forma de substituir uma. */
  substituicao: number;
  /** `PATCH` no caminho de UM cadastro — a correção do endereço. */
  atualizacao: number;
  /** `PATCH` no caminho de UM cadastro com o sufixo do provedor — a reativação. */
  reativacao: number;
  /** Qualquer coisa que não caiu em nenhum balde acima. */
  desconhecida: number;
}

/** O par instrumentado, como as suítes o manipulam. */
export interface ParInstrumentado {
  readonly porta: number;
  /** O endereço seguro do par, na forma que o adaptador recebe. */
  readonly endereco: string;
  /** Quantas ligações TCP chegaram — a grandeza que prova *"não falou com o provedor"*. */
  conexoes: number;
  readonly chamadas: ChamadasAoPar;
  /** Programa o que o par responde ao **cadastro**. */
  responderAoCadastro(resposta: RespostaProgramada): void;
  /** Programa o que o par responde à **consulta**. */
  responderAConsulta(resposta: RespostaProgramada): void;
  /** Programa o que o par responde à **correção do endereço**. */
  responderAAtualizacao(resposta: RespostaProgramada): void;
  /** Programa o que o par responde à **reativação**. */
  responderAReativacao(resposta: RespostaProgramada): void;
  /**
   * O cadastro que um **sistema de terceiro** já mantém nesta conta, no provedor.
   *
   * Ele é estado do par, e não do produto: o que ele mede é o **EFEITO**, e não a chamada. Qualquer
   * método mutante ou qualquer caminho sob o recurso das entregas o altera de verdade — é isso que
   * dá ao caso da vaga ocupada por terceiro uma asserção que sobrevive a uma implementação que
   * alcance o cadastro alheio por um caminho que o contador não enumere.
   */
  readonly cadastroDeTerceiro: Record<string, unknown>;
  /** Zera conexões e chamadas — usado quando o mesmo par serve a dois trechos do mesmo caso. */
  zerar(): void;
  /** Derruba o par, desfazendo as pendentes. Depois disto nada mais é atendido. */
  derrubar(): Promise<void>;
}

/**
 * A referência que o par atribui aos cadastros — opaca, e escrita por extenso.
 *
 * Um valor só para todos os corpos deste módulo: o que os casos medem é a **leitura** que cada corpo
 * produz, e variar o identificador acrescentaria um eixo que nenhum deles exercita.
 */
export const REFERENCIA_DO_CADASTRO_NO_PAR = 4;

/** A situação que o provedor nomeia como **validada com sucesso** — a única que confirma. */
export const SITUACAO_VALIDADA_NO_PAR = 3;

/** A situação que o provedor nomeia como **aguardando validação** — o estado transitório. */
export const SITUACAO_AGUARDANDO_VALIDACAO_NO_PAR = 1;

/**
 * O corpo JSON de uma consulta que encontrou o **nosso cadastro, validado e ativo**.
 *
 * ⚠️ **A forma é a DOCUMENTADA, e os campos não são decoração.** Desde a correção do `D1` e do `D2`,
 * a consulta só confirma quando o registro (a) aponta para o **nosso** endereço, (b) está na
 * situação validada e (c) não foi inativado. Um corpo que omitisse `url` ou `codigoSituacao` — como
 * este fazia antes — cai noutra leitura, e o caso mediria outra coisa.
 */
export function corpoDeCadastroEncontrado(url: string): string {
  return JSON.stringify({
    resultado: [
      {
        idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR,
        url,
        codigoTipoMovimento: 7,
        codigoSituacao: SITUACAO_VALIDADA_NO_PAR,
      },
    ],
  });
}

/** O corpo JSON de uma consulta que **não encontrou** o nosso cadastro — lista vazia. */
export function corpoDeCadastroNaoEncontrado(): string {
  return JSON.stringify({ resultado: [] });
}

/**
 * O corpo de um cadastro nosso **aguardando a validação do endereço** — o estado que todo cadastro
 * novo tem no instante seguinte ao `201`.
 */
export function corpoDeCadastroEmValidacao(url: string): string {
  return JSON.stringify({
    resultado: [
      {
        idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR,
        url,
        codigoTipoMovimento: 7,
        codigoSituacao: SITUACAO_AGUARDANDO_VALIDACAO_NO_PAR,
      },
    ],
  });
}

/**
 * O corpo de um cadastro nosso que o provedor **INATIVOU** — o cenário do `D1` crítico.
 *
 * A descrição da causa é a do exemplo oficial, e é ela que o produto preserva verbatim ao desabilitar.
 */
export function corpoDeCadastroInativado(url: string): string {
  return JSON.stringify({
    resultado: [
      {
        idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR,
        url,
        codigoTipoMovimento: 7,
        codigoSituacao: SITUACAO_VALIDADA_NO_PAR,
        dataHoraInativacao: '2026-08-20T18:50:55.099Z',
        descricaoMotivoInativacao: 'Erro ao enviar notificação',
      },
    ],
  });
}

/**
 * O corpo de um cadastro **cujo endereço não é o nosso** — a vaga ocupada por outro sistema.
 *
 * Sem a referência guardada, o produto não tem como provar que ele é seu, e a conduta é **não
 * tocar**. Com ela, o mesmo corpo produz a leitura de endereço divergente, que autoriza a correção —
 * é a mesma resposta do par, e o que muda é o que o produto sabe.
 */
export function corpoDeCadastroDeOutroEndereco(): string {
  return JSON.stringify({
    resultado: [
      {
        idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR,
        url: 'https://outro-sistema.exemplo.invalid/webhooks/sicoob',
        codigoTipoMovimento: 7,
        codigoSituacao: SITUACAO_VALIDADA_NO_PAR,
      },
    ],
  });
}

/**
 * Sobe o par TLS mútuo instrumentado em porta dinâmica, confiando **apenas** na autoridade dada.
 *
 * O encerramento é registrado em `onTestFinished`, e por isso ele só pode ser chamado de dentro de um
 * caso — a mesma restrição, e a mesma razão, do molde de `certificado-do-provedor.e2e.spec.ts`.
 *
 * Por padrão o par **aceita** o cadastro e responde consulta positiva para o destino informado: o
 * caminho feliz não precisa programar nada, e quem quer outro desfecho o declara no caso.
 */
export async function subirParInstrumentado(
  autoridade: AutoridadeDeTeste,
  enderecoDaEntrega: string,
): Promise<ParInstrumentado> {
  const parDoServidor = await gerarParDeServidorDeTeste(autoridade, NOME_DO_PAR);

  let respostaDoCadastro: RespostaProgramada = { status: STATUS_ACEITO, corpo: '{}' };
  let respostaDaConsulta: RespostaProgramada = {
    status: STATUS_ACEITO,
    corpo: corpoDeCadastroEncontrado(enderecoDaEntrega),
  };
  // As duas correções aceitam por padrão, e **sem corpo** — é o `204` que o contrato delas documenta.
  let respostaDaAtualizacao: RespostaProgramada = { status: STATUS_ACEITO, corpo: '' };
  let respostaDaReativacao: RespostaProgramada = { status: STATUS_ACEITO, corpo: '' };

  // O cadastro alheio que já ocupa a vaga desta conta. Ele começa idêntico em todo caso, e só muda
  // se o produto **agir** sobre ele — que é precisamente o que nada aqui pode fazer (RN-07).
  const cadastroDeTerceiro: Record<string, unknown> = {
    url: 'https://sistema-de-terceiro.exemplo.invalid/aviso',
    codigoTipoMovimento: 7,
    codigoPeriodoMovimento: 1,
  };

  const chamadas: ChamadasAoPar = {
    cadastro: 0,
    consulta: 0,
    atualizacao: 0,
    reativacao: 0,
    credencial: 0,
    put: 0,
    patch: 0,
    remocao: 0,
    substituicao: 0,
    desconhecida: 0,
  };

  const observado = {
    porta: 0,
    endereco: '',
    conexoes: 0,
    chamadas,
    cadastroDeTerceiro,
    responderAoCadastro(resposta: RespostaProgramada): void {
      respostaDoCadastro = resposta;
    },
    responderAConsulta(resposta: RespostaProgramada): void {
      respostaDaConsulta = resposta;
    },
    responderAAtualizacao(resposta: RespostaProgramada): void {
      respostaDaAtualizacao = resposta;
    },
    responderAReativacao(resposta: RespostaProgramada): void {
      respostaDaReativacao = resposta;
    },
    zerar(): void {
      observado.conexoes = 0;
      for (const chave of Object.keys(chamadas) as (keyof ChamadasAoPar)[]) {
        chamadas[chave] = 0;
      }
    },
    async derrubar(): Promise<void> {
      await encerrar(servidor, pendentes);
    },
  };

  const servidor: ServidorSeguro = criarParSeguro(
    {
      key: parDoServidor.chaveEmPem,
      cert: parDoServidor.certificadoEmPem,
      ca: [autoridade.certificadoEmPem],
      requestCert: true,
      rejectUnauthorized: true,
    },
    (pedido, resposta) => {
      // O caminho chega com a consulta anexada (`?numeroCliente=…`), e o roteamento é pelo **caminho
      // puro**: casar a cadeia inteira faria a rota depender da ordem dos parâmetros.
      const caminho = (pedido.url ?? '').split('?')[0] ?? '';
      const metodo = pedido.method ?? '';
      const programada = classificar(
        metodo,
        caminho,
        chamadas,
        cadastroDeTerceiro,
        respostaDoCadastro,
        respostaDaConsulta,
        respostaDaAtualizacao,
        respostaDaReativacao,
      );

      // A chamada JÁ foi contada acima; o que muda aqui é só se ela é respondida. Derrubar o soquete
      // é a única forma de produzir *"o provedor não chegou a responder"* com a chamada contada.
      if (programada.status === STATUS_MUDO) {
        resposta.destroy();
        return;
      }

      resposta.writeHead(programada.status, { 'content-type': 'application/json' });
      resposta.end(programada.corpo);
    },
  );

  const pendentes = new Set<Duplex>();

  servidor.on('connection', (soquete) => {
    observado.conexoes += 1;
    pendentes.add(soquete);
    soquete.once('close', () => pendentes.delete(soquete));
  });

  const porta = await escutarEmPortaDinamica(servidor);
  onTestFinished(() => encerrar(servidor, pendentes));

  observado.porta = porta;
  observado.endereco = `https://${LACO_LOCAL}:${String(porta)}`;

  return observado;
}

/**
 * Classifica a chamada, **incrementa o contador dela** e devolve o que responder.
 *
 * A ordem dos ramos é conteúdo: a **substituição** — qualquer caminho *sob* o recurso das entregas —
 * é examinada antes do cadastro e da consulta, para que uma chamada a `/webhooks/{id}` não seja
 * contada como uma das duas legítimas. É esse ramo que dá ao caso da vaga de terceiro uma asserção
 * capaz de nomear o método ofensor.
 */
function classificar(
  metodo: string,
  caminho: string,
  chamadas: ChamadasAoPar,
  cadastroDeTerceiro: Record<string, unknown>,
  respostaDoCadastro: RespostaProgramada,
  respostaDaConsulta: RespostaProgramada,
  respostaDaAtualizacao: RespostaProgramada,
  respostaDaReativacao: RespostaProgramada,
): RespostaProgramada {
  if (metodo === 'PUT') {
    chamadas.put += 1;
    alterarCadastroDeTerceiro(cadastroDeTerceiro);
  } else if (metodo === 'PATCH') {
    chamadas.patch += 1;
    alterarCadastroDeTerceiro(cadastroDeTerceiro);
  } else if (metodo === 'DELETE') {
    chamadas.remocao += 1;
    alterarCadastroDeTerceiro(cadastroDeTerceiro);
  }

  if (caminho === CAMINHO_DA_CREDENCIAL && metodo === 'POST') {
    chamadas.credencial += 1;
    return {
      status: STATUS_ACEITO,
      corpo: JSON.stringify({
        access_token: CREDENCIAL_CONCEDIDA,
        expires_in: VALIDADE_DA_CREDENCIAL_EM_SEGUNDOS,
      }),
    };
  }

  if (caminho.startsWith(`${RECURSO_DAS_ENTREGAS}/`)) {
    chamadas.substituicao += 1;
    alterarCadastroDeTerceiro(cadastroDeTerceiro);

    // ⚠️ Os dois atos de correção são contados **separadamente**, e a distinção é o que torna as
    // asserções do quadro discrimináveis: corrigir o endereço e reativar têm o mesmo verbo e o mesmo
    // desfecho, e só o caminho os separa. Um caso que medisse apenas `substituicao` aprovaria uma
    // implementação que reativasse onde devia corrigir a URL — que é precisamente o ciclo de
    // reativação/inativação que a precedência do quadro existe para impedir.
    if (caminho.endsWith(`/${SUFIXO_DA_REATIVACAO}`)) {
      chamadas.reativacao += 1;

      return respostaDaReativacao;
    }

    chamadas.atualizacao += 1;

    return respostaDaAtualizacao;
  }

  if (caminho === RECURSO_DAS_ENTREGAS && metodo === 'POST') {
    chamadas.cadastro += 1;
    return respostaDoCadastro;
  }

  if (caminho === RECURSO_DAS_ENTREGAS && metodo === 'GET') {
    chamadas.consulta += 1;
    return respostaDaConsulta;
  }

  chamadas.desconhecida += 1;
  return { status: 404, corpo: '{}' };
}

/**
 * Aplica ao cadastro alheio o **efeito** que um método mutante teria.
 *
 * Ela existe para que a asserção de não-intervenção meça o efeito, e não só a chamada: um par que
 * apenas contasse aprovaria uma implementação que alcançasse o cadastro de terceiro por um caminho
 * que o contador não enumera. O que ela grava é irrelevante; o que importa é que o objeto **deixe de
 * ser igual** ao capturado antes.
 */
function alterarCadastroDeTerceiro(cadastroDeTerceiro: Record<string, unknown>): void {
  cadastroDeTerceiro.url = 'https://alterado-pelo-produto.exemplo.invalid/aviso';
}

/**
 * Instala a autoridade do caso nas raízes do processo, e desfaz a instalação ao fim dele.
 *
 * A restauração é **conferida** por igualdade de conjunto: instrumentação que sobrevivesse ao caso
 * mudaria a confiança dos vizinhos, e o vermelho apareceria longe da causa. A âncora antivácuo está no
 * próprio ato de instalar — a lista tem de crescer em exatamente uma raiz, senão um `aceito` poderia
 * vir de o par de teste já ser confiável por outro motivo.
 */
export function confiarEm(autoridade: AutoridadeDeTeste): void {
  const originais = getCACertificates('default');

  setDefaultCACertificates([...originais, autoridade.certificadoEmPem]);
  expect(getCACertificates('default').length).toBe(originais.length + 1);

  onTestFinished(() => {
    setDefaultCACertificates(originais);
    expect(raizesComoConjunto(getCACertificates('default'))).toEqual(raizesComoConjunto(originais));
  });
}

/** Normaliza os PEM para comparação de conjunto, ignorando diferença de espaço em branco. */
function raizesComoConjunto(pems: readonly string[]): string[] {
  return pems.map((pem) => pem.replace(/\s+/g, '')).sort();
}

/** Abre a porta sorteada pelo núcleo no laço local e devolve o número dela. */
function escutarEmPortaDinamica(servidor: ServidorTcp): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    servidor.listen(0, LACO_LOCAL, () => {
      const endereco = servidor.address();

      if (endereco === null || typeof endereco === 'string') {
        rejeitar(new Error('o par de verificação não expôs porta numérica'));
        return;
      }

      resolver(endereco.port);
    });
    servidor.once('error', rejeitar);
  });
}

/** Encerra o servidor **desfazendo as pendentes** — sem isso o fecho espera o teto do soquete. */
function encerrar(servidor: ServidorTcp, pendentes: ReadonlySet<Duplex>): Promise<void> {
  for (const soquete of pendentes) {
    soquete.destroy();
  }

  return new Promise((resolver) => {
    servidor.close(() => resolver());
  });
}
