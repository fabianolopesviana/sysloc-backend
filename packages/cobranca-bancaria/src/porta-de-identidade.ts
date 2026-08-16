/**
 * A porta de **identidade bancária** — declarada pelo domínio, satisfeita pelo adaptador.
 *
 * ===========================================================================
 * A direção da dependência parece invertida, e é ela que está certa (ADR-0025)
 * ===========================================================================
 *
 * Quem declara a interface e o tipo do dado que a atravessa é este pacote; é o adaptador do provedor
 * (`adaptador-sicoob.ts`, T10) que **importa daqui** para dizer que a satisfaz, e é a borda que
 * escolhe qual implementação injetar. A porta chega a quem a usa **por parâmetro**, nunca por
 * import. É o que torna literalmente verdadeira a frase *"o domínio não conhece o provedor"*, em vez
 * de meia-verdade, e o que faz trocar de banco não tocar uma linha deste arquivo.
 *
 * ===========================================================================
 * UMA operação, e a ausência das outras quatro é REGISTRO — não omissão
 * ===========================================================================
 *
 * A ADR-0001 nomeia cinco operações da porta bancária — `obter_token`, `emitir`, `solicitar_baixa`,
 * `confirmar_baixa` e `consultar` — e esta fatia exerce **nenhuma delas**. Ela exerce a verificação
 * de identidade, que não está na lista. Três fatos sustentam que isso não diverge da ADR, e os três
 * estão registrados por escrito na §21.3 do tech spec da fatia:
 *
 * 1. A cláusula que a 0001 existe para garantir — *"nenhum campo, URL ou vocabulário específico de
 *    provedor cruza a porta"* — vale igual para uma operação e para cinco, e esta porta está sujeita
 *    a ela na íntegra. Ser porta irmã não a isenta; isenta-a apenas do roster de cinco.
 * 2. A cláusula do **"apenas"** (*"o núcleo conversa apenas com a porta `AdaptadorCobrancaBancaria`"*)
 *    tem por sujeito a **operação de cobrança bancária**. Verificar identidade não é operação de
 *    cobrança: não emite, não baixa, não consulta título e não toca cobrança alguma. É ato de
 *    **configuração**, cujo consumidor é o Admin na área de integrações.
 * 3. Declarar as outras quatro agora seria escolher quatro assinaturas **sem quem as chame**, e a
 *    fatia (ii) as reescreveria contra a API real.
 *
 * ⚠️ **O nome `AdaptadorCobrancaBancaria` fica RESERVADO.** A porta das cinco operações se chamará
 * assim — o nome literal da ADR-0001 — e nasce na fatia (ii). Nada neste pacote usa esse nome para
 * outra coisa, para que aquela fatia não precise inventá-lo nem renomear o que esta deixou; o
 * CT-834 varre o nome sobre os símbolos declarados aqui e reprova nomeando o ofensor.
 */

import type {
  IdentidadeParaVerificar,
  ResultadoDaVerificacaoDeIdentidade,
} from './modelo-canonico.js';

/**
 * A porta de identidade — a única forma de o domínio perguntar ao provedor *"esta identidade serve?"*.
 *
 * `verificarIdentidade` **resolve** em todos os desfechos e nunca rejeita: recusa pelo par,
 * indisponibilidade e tempo esgotado são respostas à pergunta do Admin, e cada uma chega distinguida
 * pelo `detalhe`. Levantar seria a alternativa idiomática e foi descartada por uma razão concreta: a
 * borda traduziria a exceção em `500`, e o Admin leria *"o sistema falhou"* onde o fato é *"a
 * identidade não foi aceita"* — dois desfechos operacionais opostos (RN-06).
 *
 * Nada de transporte atravessa esta assinatura: nem endereço, nem teto de tempo, nem cabeçalho, nem
 * credencial de habilitação. Endereço e teto são propriedade de quem constrói o adaptador; o segredo
 * chega opaco, e só o adaptador o abre.
 */
export interface PortaDeIdentidadeBancaria {
  verificarIdentidade(
    identidade: IdentidadeParaVerificar,
  ): Promise<ResultadoDaVerificacaoDeIdentidade>;
}
