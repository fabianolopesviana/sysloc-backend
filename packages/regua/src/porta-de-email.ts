/**
 * A porta de **saída** da régua e o adaptador de **captura** que a satisfaz.
 *
 * ===========================================================================
 * A porta sabe uma coisa só: *"entregue esta mensagem a este endereço"*
 * ===========================================================================
 *
 * Nada de transporte, credencial, remetente, anexo, prioridade ou nova tentativa atravessa esta
 * fronteira. É o que permite ao domínio ser exercitado sem SMTP de pé, e é o que faz a troca do
 * adaptador não tocar uma linha da régua — a porta é propriedade de quem a exige (ADR-0025).
 *
 * **Nenhuma repetição mora aqui.** A régua repete pelo job, com a política de repetição da fila; um
 * adaptador que tentasse de novo por conta própria multiplicaria as tentativas em silêncio e faria o
 * registro do histórico mentir sobre quantas vezes se tentou entregar.
 *
 * ===========================================================================
 * O capturador é IMPLEMENTAÇÃO da porta — e é por isso que ele mora aqui
 * ===========================================================================
 *
 * Ele acumula em memória o que **teria saído** e sabe recusar um destinatário escolhido. Mora ao
 * lado da interface porque é uma implementação dela, exatamente como o adaptador de produção — não
 * porque a verificação precisa dele. A distinção importa: ele **não é mock**. O que ele substitui é
 * o destino da mensagem, nunca a lógica sob prova, e a assinatura pela qual ele é exercitado é a
 * mesma da produção.
 *
 * ⚠️ **Ele jamais vira um ramo dentro do adaptador de produção, nem bandeira de ambiente.** A
 * barreira da CA-17 é **estrutural**: quem monta o processo escolhe o adaptador, e a verificação não
 * tem caminho para construir o de produção. Um `if (ehTeste)` no adaptador real desfaria isso em
 * silêncio — e aqui o modo perigoso é o inverso do habitual, porque *"tentar mesmo assim"* alcança a
 * caixa de uma pessoa real.
 */

import type { MensagemDeAviso } from './mensagem.js';

/**
 * A porta de envio — a única forma de o domínio alcançar o mundo.
 *
 * `enviar` **rejeita** quando não conseguiu entregar, e a mensagem da rejeição vira a `causa`
 * gravada no registro da tentativa. Devolver um booleano de sucesso seria a alternativa idiomática e
 * foi descartada: ela perde o diagnóstico, e é o diagnóstico que o operador lê meses depois para
 * saber por que o aviso não saiu.
 */
export interface PortaDeEnvioDeEmail {
  enviar(destinatario: string, mensagem: MensagemDeAviso): Promise<void>;
}

/** Uma entrega que o capturador reteve — o par endereço + aviso, como a produção teria enviado. */
export interface EmailCapturado {
  readonly destinatario: string;
  readonly mensagem: MensagemDeAviso;
}

/**
 * O adaptador de captura, com o que a verificação precisa **observar** e **provocar**.
 *
 * `capturas` é `readonly` na superfície e mutável por dentro: quem observa não empurra entrega
 * inventada para dentro da lista, e uma asserção sobre o que saiu continua sendo asserção sobre o
 * que o domínio fez.
 */
export interface CapturadorDeEmail extends PortaDeEnvioDeEmail {
  /** O que teria saído, na ordem em que o domínio mandou entregar. */
  readonly capturas: readonly EmailCapturado[];
  /**
   * Faz o envio para este endereço rejeitar, com esta causa, a partir de agora.
   *
   * É a única forma honesta de provar a RN-09 sem depender de um servidor real quebrar na hora
   * certa: a falha entra pela **mesma** interface da produção, e o domínio não sabe que foi
   * provocada.
   */
  recusar(destinatario: string, causa: string): void;
}

/**
 * Cria um capturador novo — sem estado partilhado entre chamadas.
 *
 * A ausência de instância única é deliberada: um capturador global faria a captura de um caso vazar
 * para o seguinte, e a contagem de mensagens — que é a asserção central da CA-04 e da CA-16 —
 * passaria a depender da ordem de execução.
 */
export function criarCapturadorDeEmail(): CapturadorDeEmail {
  const capturas: EmailCapturado[] = [];
  const recusas = new Map<string, string>();

  return {
    capturas,

    recusar(destinatario: string, causa: string): void {
      recusas.set(destinatario, causa);
    },

    async enviar(destinatario: string, mensagem: MensagemDeAviso): Promise<void> {
      const causa = recusas.get(destinatario);
      if (causa !== undefined) {
        // A entrega recusada NÃO entra em `capturas`, e a ausência é a decisão: a lista responde
        // *"o que saiu"*, e o que foi recusado não saiu. Registrá-la ali faria a contagem de
        // mensagens entregues concordar com uma execução em que nada chegou ao destinatário.
        throw new Error(causa);
      }

      capturas.push({ destinatario, mensagem });
    },
  };
}
