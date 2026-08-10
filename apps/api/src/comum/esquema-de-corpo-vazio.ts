/**
 * O corpo **vazio e fechado** das rotas que não aceitam campo algum — **ponto único da borda**.
 *
 * ## Por que existe, e por que num módulo só
 *
 * Várias rotas desta superfície são atos cujo efeito é decidido inteiramente pelo servidor: as
 * quatro de circulação (`/v1/conjuntos`, `/v1/imoveis`, `/v1/contratos`) recebem a marca de retirada
 * do relógio do banco, e o cancelamento de cobrança recebe dali o instante. Nenhuma delas tem o que
 * aceitar do cliente, e aceitar qualquer coisa daria a ele o poder de datar o próprio ato.
 *
 * O esquema que materializa isso é o objeto estrito vazio, e ele nasceu **copiado**: cada borda
 * partiu da anterior, e a definição chegou a **quatro** cópias byte a byte —
 * `imoveis/conjunto.controller.ts`, `imoveis/imovel.controller.ts`,
 * `contratos/contrato.controller.ts` e `cobrancas/cobranca.controller.ts`. As quatro concordavam, e
 * um objeto estrito vazio não tem variação de comportamento possível, de modo que **não havia
 * defeito ativo** — o custo era de superfície: a **F4** publica mais rotas de transição e de rotina,
 * e a quinta cópia era previsível.
 *
 * É o débito **D23**, e este módulo é o fecho dele. É a terceira vez que o repositório paga esta
 * classe e a fecha do mesmo jeito — por definição única em `apps/api/src/comum/`: antes foram o
 * **D40** com `esquemaDoErro` ({@link ./esquema-de-erro.js}) e o **D38** com `validar()`
 * ({@link ./validacao.js}). A rede que impede a quinta cópia é o `CT-357` de
 * `apps/api/test/validacao.spec.ts`, que afirma por igualdade de conjunto que há **uma** definição e
 * **quatro** importadores.
 *
 * ## Por que `strictObject` aqui, quando o esquema de SAÍDA do pacote de contratos é aberto
 *
 * Não é a mesma pergunta. Este é esquema de **entrada**, e entrada fechada é a convenção sem
 * exceção do produto: é o `strictObject` que transforma um corpo com qualquer chave em `422`
 * nomeando o corpo. O Zod reporta chave desconhecida de um `strictObject` com **caminho vazio**, e é
 * por isso que a recusa cai no campo padrão do ponto de chamada, e não num campo inventado.
 */
import { z } from 'zod';

/**
 * O objeto estrito vazio — nenhum campo aceito, qualquer chave recusada.
 *
 * Constante, e não uma fábrica: `z.strictObject({})` não tem parâmetro nem estado, e uma instância
 * por ponto de chamada só multiplicaria o que este módulo existe para unificar.
 */
export const ESQUEMA_DO_CORPO_VAZIO = z.strictObject({});
