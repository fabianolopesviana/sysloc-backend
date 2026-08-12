/**
 * O adaptador de **produção** da porta de e-mail — e a barreira que falha fechado (RD-15/CA-17).
 *
 * ===========================================================================
 * AQUI O MODO PERIGOSO É O INVERSO DO HABITUAL
 * ===========================================================================
 *
 * Em quase toda barreira o risco é recusar demais. Nesta, *"tentar mesmo assim"* é o que alcança a
 * caixa de uma pessoa real, e o erro **não é reversível**: mensagem entregue não volta. Por isso
 * este arquivo **nunca** degrada em silêncio, **nunca** constrói transporte nulo que aceite mensagem
 * e **nunca** tem um ramo `if (ehTeste)`.
 *
 * A barreira da CA-17 é **estrutural, e não configuração**: quem monta o processo escolhe o
 * adaptador, e a verificação injeta o **capturador** (`./porta-de-email.ts`) pela mesma interface.
 * Nenhum arquivo de teste do repositório importa este módulo — o CT-626 varre os quatro diretórios de
 * teste e afirma a lista vazia por igualdade. Uma bandeira de ambiente no lugar disso faria a
 * separação depender de uma variável herdada do host, que é o caminho descartado no alinhamento
 * técnico (D5).
 *
 * Desde a **T10** a barreira tem a **âncora simétrica** que lhe faltava: `CT-626 (f)` afirma, também
 * por igualdade, que composição de produção nenhuma liga o **capturador** — o modo de falha inverso,
 * que é pior de detectar porque engoliria todo aviso em silêncio, gravando `ENVIADA` sem que mensagem
 * alguma saísse. Era o débito **D19**.
 *
 * ===========================================================================
 * AS COORDENADAS DO TRANSPORTE E A GUARDA DE VARIÁVEL MORAM AO LADO — o motivo é PROVABILIDADE
 * ===========================================================================
 *
 * Os três limites de tempo e a recusa da `SMTP_URL` que não serve estão em
 * `./coordenadas-do-transporte.ts`, e a guarda que recusa a variável **não declarada** está em
 * `./exigencia-de-variavel.ts` desde a T10 — as duas fora daqui, pela mesma razão. A razão é a contrapartida honesta da barreira acima:
 * como nenhum arquivo de teste pode nomear **este** módulo, nada que viva dentro dele é exercitável
 * — e foi exatamente ali que o defeito se escondeu por cinco rodadas, com os três limites declarados
 * no fonte, lidos pelo compilador e **sem efeito algum** sobre o transporte. Extraída a parte pura,
 * a verificação prova por igualdade que o objeto de opções carrega os limites, sem construir
 * transporte nenhum e sem tocar a barreira. O que resta aqui é o que só existe com transporte de
 * verdade: a entrega e a tradução da falha.
 *
 * ===========================================================================
 * A `SMTP_URL` CARREGA CREDENCIAL — ela não é registrada, nem ecoada em erro
 * ===========================================================================
 *
 * A cadeia de conexão traz usuário e senha. Ela **não** aparece em registro estruturado, em `argv`
 * nem em mensagem de erro: a recusa de partida nomeia a **variável**, e a falha de entrega nomeia o
 * **código** do transporte (`ECONNREFUSED`, `EAUTH`, `ETIMEDOUT`), nunca o valor. É a mesma
 * disciplina que `apps/worker/src/fila.ts` já aplica à cadeia da fila.
 *
 * A mensagem crua da biblioteca **não** é repassada, e a decisão é deliberada: ela é composta a
 * partir das opções do transporte e do que o servidor respondeu, e servidor que ecoa a credencial
 * numa recusa de autenticação existe. O que se perderia em detalhe se ganha em não ter um caminho de
 * vazamento por onde o segredo chega à coluna `causa`, que é publicada pela rota do histórico.
 *
 * ⚠️ **Quem mantém a cadeia fora da saída padrão é o PADRÃO da biblioteca, e não uma opção daqui.**
 * O `nodemailer` registra a configuração de conexão quando há registrador, e sem registrador
 * declarado o `shared.getLogger` devolve um mudo (`if (!options.logger)`, `lib/shared/index.js:423`).
 * As opções `logger: false` e `debug: false` que este arquivo declarava afirmavam ser elas a
 * proteção — e não eram: no caminho antigo, com a chave `url` presente, o `createTransport` as
 * descartava junto com todo o resto do objeto (ver `./coordenadas-do-transporte.ts`). Saíram por
 * serem redundantes com o padrão, e a afirmação foi corrigida para dizer de onde a mudez vem.
 *
 * ===========================================================================
 * NENHUMA REPETIÇÃO MORA AQUI (D6)
 * ===========================================================================
 *
 * Quem repete é o **job**, com a política de repetição da fila. Um adaptador que tentasse de novo por
 * conta própria multiplicaria as tentativas em silêncio e faria o registro do histórico mentir sobre
 * quantas vezes se tentou entregar — e o histórico é o que sustenta a trava do intervalo. Também não
 * há disjuntor nem segunda via de entrega: não existe para onde desviar (§8 do tech spec).
 */

import { createTransport } from 'nodemailer';
import { coordenadasDoTransporte, VARIAVEL_DO_TRANSPORTE } from './coordenadas-do-transporte.js';
import { exigirDeclarada } from './exigencia-de-variavel.js';
import type { MensagemDeAviso } from './mensagem.js';
import type { PortaDeEnvioDeEmail } from './porta-de-email.js';

/** O nome da variável que declara o remetente. */
const VARIAVEL_DO_REMETENTE = 'EMAIL_REMETENTE';

/** O que a falha de entrega grava como causa, com o código do transporte acrescentado ao fim. */
const MOTIVO_DE_FALHA_DE_ENTREGA = 'o transporte de e-mail recusou a entrega';

/** O que se diz quando a biblioteca falhou sem código — melhor que ecoar o objeto do erro. */
const CODIGO_AUSENTE = 'sem código';

/** O que se diz quando o servidor aceitou a conexão e recusou o destinatário, sem levantar. */
const DESTINATARIO_RECUSADO = 'destinatário recusado pelo servidor';

/**
 * O que o adaptador de produção precisa para existir — as duas variáveis, já lidas pelo ambiente.
 *
 * Ele recebe **valores**, e não lê `process.env`: quem lê o ambiente é `lerAmbiente`, nos dois pontos
 * de entrada, e é lá que a partida é recusada quando a variável falta. Um adaptador que lesse o
 * ambiente por si teria duas fontes para a mesma configuração, e a segunda escaparia da conferência
 * de partida.
 */
export interface ConfiguracaoDeSmtp {
  /** A cadeia de conexão do servidor — **carrega credencial**, e nunca é registrada. */
  readonly urlDoTransporte: string;
  /** O endereço que assina o aviso. */
  readonly remetente: string;
}

/**
 * O código do erro do transporte, **sem** a mensagem crua da biblioteca.
 *
 * O `code` do `nodemailer` é um rótulo curto e fechado (`ECONNREFUSED`, `EAUTH`, `ETIMEDOUT`,
 * `EMESSAGE`), e é o que o operador precisa para saber se o problema é rede, credencial ou conteúdo.
 * Ele não carrega endereço, credencial nem corpo de mensagem — ver o cabeçalho.
 */
function codigoDaFalha(erro: unknown): string {
  if (erro instanceof Error && 'code' in erro && typeof erro.code === 'string') {
    return erro.code;
  }

  return CODIGO_AUSENTE;
}

/**
 * Cria o adaptador de produção sobre o `nodemailer`.
 *
 * **Recusa a construção** sem as duas variáveis declaradas: o processo não sobe com um enviador
 * meio-pronto, e a falha é ruidosa e imediata em vez de silenciosa na primeira passagem da régua.
 *
 * O corpo é entregue como **texto puro** (`text`), e nunca como `html`. A escolha é conteúdo, e não
 * preferência: `comporAvisoDeCobranca` não escapa nome de locatário, identificador de imóvel nem
 * nome de conjunto — e não precisa, porque em texto puro `<script>` é a cadeia `<script>`. Publicar o
 * mesmo corpo como HTML transformaria a ausência de escapada em injeção de marcação na caixa de quem
 * recebe. O ponto em que essa decisão se inverte está registrado no cabeçalho de `./mensagem.ts`.
 *
 * Não há `close()` na porta, e a ausência é deliberada: sem `pool`, o `nodemailer` abre e fecha a
 * conexão por mensagem, de modo que não há recurso de longa duração a liberar — e alargar a porta
 * com um método de encerramento a faria deixar de ser *"entregue esta mensagem a este endereço"*.
 */
export function criarAdaptadorSmtp(config: ConfiguracaoDeSmtp): PortaDeEnvioDeEmail {
  exigirDeclarada(config.urlDoTransporte, VARIAVEL_DO_TRANSPORTE);
  exigirDeclarada(config.remetente, VARIAVEL_DO_REMETENTE);

  // O argumento é a chamada INTEIRA, e nunca um literal de objeto: é `coordenadasDoTransporte` quem
  // devolve as opções completas — com os três limites —, e é a ausência da chave `url` que faz o
  // `createTransport` entregar esse objeto ao transporte em vez de substituí-lo. Acrescentar aqui
  // qualquer chave ao lado dela reabre a classe de defeito descrita naquele módulo, e o
  // `CT-641 (c)` reprova por isso.
  const transporte = createTransport(coordenadasDoTransporte(config.urlDoTransporte));

  return {
    async enviar(destinatario: string, mensagem: MensagemDeAviso): Promise<void> {
      let recusados: readonly unknown[];

      try {
        const entrega = await transporte.sendMail({
          from: config.remetente,
          to: destinatario,
          subject: mensagem.assunto,
          text: mensagem.corpo,
        });

        recusados = entrega.rejected;
      } catch (erro) {
        throw new Error(`${MOTIVO_DE_FALHA_DE_ENTREGA}: ${codigoDaFalha(erro)}`);
      }

      // O `sendMail` **resolve** quando o servidor aceita a conexão e recusa o destinatário, e a
      // recusa viaja em `rejected`. Sem esta conferência, a tentativa seria gravada como `ENVIADA` e
      // a cobrança ficaria travada pelo intervalo sem que mensagem alguma tivesse chegado.
      if (recusados.length > 0) {
        throw new Error(`${MOTIVO_DE_FALHA_DE_ENTREGA}: ${DESTINATARIO_RECUSADO}`);
      }
    },
  };
}
