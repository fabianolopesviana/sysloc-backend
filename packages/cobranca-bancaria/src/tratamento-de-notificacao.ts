/**
 * As **duas decisões puras** do tratamento da notícia do provedor — a camada mais baixa em que cada
 * invariante da fatia `webhook-e-carne` pode viver.
 *
 * ---------------------------------------------------------------------------
 * Por que elas moram no DOMÍNIO, e não na borda da fila que as consome
 * ---------------------------------------------------------------------------
 *
 * Nenhuma das duas toca banco, fila, rede ou relógio: uma decide **o que o recebido é**, a outra
 * decide **se ele já produziu efeito**. Postas na tarefa, cada regra ficaria sob uma fronteira real —
 * e prová-las exigiria instância efêmera, migração aplicada e provedor de mentira para exercer uma
 * comparação de cadeias. Aqui elas são exercidas por chamada direta, sem arranjo algum, que é o que
 * a ADR-0025 quer dizer com *"o domínio declara o que atravessa"*.
 *
 * ⚠️ **E elas são as ÚNICAS que podem descer até aqui.** Roteamento é banco, conferência lê o
 * gravado, e o efeito nasce da resposta do provedor: extrair mais do que estas duas produziria
 * abstração sem consumidor, que é o oposto do que este pacote é.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA É TOLERANTE, e isso é divergência declarada — não descuido
 * ---------------------------------------------------------------------------
 *
 * `.claude/rules/contrato-publicado.md` manda *"entrada fechada"*, e ela **não alcança** o corpo da
 * notícia. O sujeito daquela regra é o esquema publicado por `@sysloc/contracts`, e a justificativa
 * dela é *"chave desconhecida na entrada é erro do cliente"*. Aqui não há nem uma coisa nem outra: o
 * provedor **não é cliente nosso** — ele não pode corrigir o payload —, e este corpo não tem esquema
 * publicado (tech spec §21.2). Recusar por chave desconhecida seria **perder a notícia**, que é
 * exatamente o defeito que a fatia existe para não ter (RN-02/CA-03).
 *
 * Por isso a leitura olha **só** o que precisa e ignora o resto: campo novo do provedor não
 * desclassifica um aviso legítimo.
 *
 * ---------------------------------------------------------------------------
 * A TRADUÇÃO DO DIALETO acontece aqui, e morre aqui (ADR-0001 · RN-18 · CA-21)
 * ---------------------------------------------------------------------------
 *
 * Três nomes do provedor entram e nenhum sai:
 *
 * | O que o provedor escreve | O nome do produto |
 * |---|---|
 * | `seuNumero` | *Identificador perante o provedor* — `identificadorPeranteOProvedor` |
 * | `nossoNumero` | *Número do título no provedor* — `numeroDoTituloNoProvedor` |
 * | `numeroIdentificadorBaixa` | *Identificador da liquidação* — `identificadorDaLiquidacao` |
 *
 * Eles aparecem **uma vez cada**, como acesso de propriedade sobre o corpo recebido, e em nenhum
 * tipo, nome de símbolo, valor de cadeia, coluna, registro estruturado ou trilha. É essa contenção
 * que o CT-991 mede sobre o texto deste arquivo.
 *
 * ⚠️ **O `nossoNumero` do dialeto NÃO é o `nossoNumero` que a coluna do produto tinha.** Aquele era
 * nome de coluna e deixou de existir (renomeada para `numero_do_titulo_no_provedor`); este é
 * vocabulário do provedor no corpo que chega, e continua existindo porque é ele que o provedor
 * escreve. Confundi-los é o erro que esta fronteira existe para tornar impossível.
 *
 * ---------------------------------------------------------------------------
 * O que este módulo NÃO lê do recebido — e por quê
 * ---------------------------------------------------------------------------
 *
 * - **Data nenhuma.** Pela RN-07 o aviso não decide coisa alguma: a única data que entra no domínio é
 *   a que a **consulta** ao provedor devolve. As datas do recebido ficam no `jsonb` cru, como
 *   diagnóstico. Consequência prática, e deliberada: nada aqui lê relógio nem declara fuso, de modo
 *   que os débitos `D14 · F3/T5` e `D25 · F4/T7` **não** ganham uma quarta declaração executável do
 *   fuso da operação (ADR-0026).
 * - **Valor nenhum.** O que se grava vem de `SituacaoConsultada`, e não do que o aviso afirma — é a
 *   CA-04: um aviso forjado não liquida.
 * - **`tipoMovimento` e `idWebhook`.** São classificação do provedor, e lê-los faria vocabulário dele
 *   virar regra do produto (RN-18). O que decide é a forma do que veio, não o rótulo que ele deu.
 *
 *   ⚠️ **E o mesmo conceito tem DOIS nomes, conforme o lado da conversa** (`W5`, 2026-08-22): no
 *   cadastro e na consulta o campo se chama **`codigoTipoMovimento`**; no corpo **recebido** ele se
 *   chama **`tipoMovimento`**. Hoje isso é inócuo, justamente porque nenhum dos dois é lido — mas
 *   quem um dia for ler o tipo do movimento vai procurar o nome errado se conhecer só um dos lados.
 *   A nota fica aqui, e não vira débito, porque não há o que fazer enquanto a decisão de não os ler
 *   valer.
 *
 * ---------------------------------------------------------------------------
 * Por que a coerção para cadeia é assimétrica entre os três campos
 * ---------------------------------------------------------------------------
 *
 * O *Número do título no provedor* **chega inteiro** no JSON (medição §13-A.4 do discovery) e é
 * coagido para cadeia aqui, na fronteira — é o único dos três que se coage.
 *
 * Os outros dois **não se coagem**, e a razão é aritmética, não estilística: o *Identificador perante
 * o provedor* tem 18 posições e o *Identificador da liquidação* tem 19, e ambos passam de
 * `Number.MAX_SAFE_INTEGER` (16 casas). Um número dessa ordem já chega **corrompido** de
 * `JSON.parse`, e coagi-lo produziria uma cadeia plausível e errada: no primeiro, roteamento para a
 * cobrança errada ou para nenhuma; no segundo — que é a chave da idempotência —, dois efeitos
 * distintos colidindo, ou o mesmo efeito aplicado duas vezes. Recusar (`ILEGIVEL`) preserva o cru e
 * deixa a conferência diária descobrir a liquidação por outro caminho; coagir grava o dano.
 *
 * ---------------------------------------------------------------------------
 * Por que a forma reconhecida exige os TRÊS campos
 * ---------------------------------------------------------------------------
 *
 * Um aviso sem o número do título não tem o que conferir (RN-05) e um aviso sem o identificador da
 * liquidação não tem chave de efeito único (RN-08) — as duas regras que o tratamento existe para
 * cumprir. Deixá-los opcionais empurraria para os consumidores ramos de ausência que a spec não
 * descreve, e o pior deles seria um efeito aplicado **sem** chave de idempotência.
 *
 * `ILEGIVEL` não perde nada: o cru continua guardado pelos 90 dias e a conferência diária da fatia
 * anterior alcança a liquidação de qualquer maneira. O que se perde é a *origem* na trilha, não o
 * recebimento — é o mesmo raciocínio com que a spec justifica o expurgo do retido (§7.5).
 *
 * ---------------------------------------------------------------------------
 * Zod entra por `@sysloc/contracts`, e o pacote segue com ZERO dependência externa
 * ---------------------------------------------------------------------------
 *
 * A forma do identificador é conferida por {@link ESQUEMA_DO_IDENTIFICADOR_BANCARIO}, que é a **fonte
 * única** das 18 posições (ADR-0016) e chega pronto do pacote de contratos — como
 * `ESQUEMA_DO_CODIGO_DE_COBRANCA` já chega em `guarda-de-boletos.ts`. Redigitar a expressão aqui
 * criaria a segunda definição do mesmo fato, e importar `zod` neste pacote acrescentaria a primeira
 * dependência externa dele, que o manifesto declara não ter. O resto da leitura é feito à mão, com
 * guardas de tipo, porque é pouco e porque nada além da forma do identificador é contrato.
 */

import { ESQUEMA_DO_IDENTIFICADOR_BANCARIO } from '@sysloc/contracts';

/**
 * As três categorias em que todo corpo recebido cai — **exaustivas e mutuamente exclusivas**.
 *
 * A união é discriminada por `classificacao`, e é isso que impede ler os campos traduzidos de uma
 * notícia que não é aviso: o compilador estreita o tipo no `switch`, sem que nada precise ser
 * lembrado por quem escreve. Uma quarta categoria obrigaria todo consumidor a decidir o que fazer com
 * ela, que é precisamente o efeito desejado — por isso a união é fechada, e não um enum aberto com
 * ramo padrão.
 *
 * ⚠️ **`VALIDACAO_DE_ENDERECO` não é uma variedade de aviso, e `ILEGIVEL` não é erro.** A primeira é
 * o pedido que o provedor faz ao cadastrar o endereço (RN-10/CA-11): responde-se, e **nada** é
 * procurado. A segunda é um **desfecho** do tratamento, nunca uma recusa ao provedor — quem recebeu
 * já confirmou `204` muito antes de alguém tentar interpretar.
 */
export type NotificacaoBancariaClassificada =
  | {
      readonly classificacao: 'AVISO_DE_RECEBIMENTO';
      /** A chave de correlação que o **produto** compôs e enviou — 18 dígitos, e o que roteia. */
      readonly identificadorPeranteOProvedor: string;
      /** O número que o **provedor** atribuiu ao título — o que a conferência compara (RN-05). */
      readonly numeroDoTituloNoProvedor: string;
      /** O identificador que o **provedor** deu à baixa — a chave do efeito único (RN-08). */
      readonly identificadorDaLiquidacao: string;
      /**
       * O número do cliente que o **provedor** informou — a segunda metade da conferência da RN-05.
       *
       * `undefined` quando o corpo não o traz, e a distinção é conteúdo: **ausência não é
       * divergência**. Um provedor que deixe de enviar o campo faria toda notícia legítima virar
       * anomalia se o ausente fosse tratado como diferente.
       *
       * ⚠️ Ele serve para **detectar divergência**, e nunca para decidir efeito — o efeito vem da
       * consulta à API (o corpo do webhook é gatilho, não fonte da verdade). Conferi-lo é o que
       * acusa uma notícia que chegou para a conta errada.
       */
      readonly numeroDoClienteNoProvedor: number | undefined;
    }
  | { readonly classificacao: 'VALIDACAO_DE_ENDERECO' }
  | { readonly classificacao: 'ILEGIVEL' };

/**
 * Os nove desfechos que uma notícia pode ter, na ordem em que o enum do banco os declara.
 *
 * ⚠️ **É a segunda declaração do mesmo conjunto, e a duplicação é deliberada** — a primeira é o enum
 * `plataforma.desfecho_da_notificacao`, que vive na camada de dados. O domínio **não pode** importar
 * de `@sysloc/db` (ADR-0025, e o CT-809 (d) o reprova por varredura), e é exatamente o molde que
 * `DesfechoDaLiquidacao` já pratica em `conferencia.ts` contra o homônimo de
 * `packages/db/src/boleto-da-cobranca.ts`.
 *
 * A duplicação **não é silenciosa**: quem chama {@link ehReentregaDeEfeitoAplicado} passa o valor que
 * leu do banco, e um desfecho que exista lá e não aqui deixa de ser atribuível — o compilador reprova
 * no ponto de consumo. É a mesma amarra dos outros desfechos do pacote.
 *
 * Ela **não é publicada** pelo barril: ninguém precisa escrever este nome para chamar o predicado, e
 * publicá-la convidaria um segundo lugar a declarar o mesmo conjunto.
 */
export type DesfechoDaNotificacaoBancaria =
  | 'RECEBIDO'
  | 'VALIDACAO_DE_ENDERECO'
  | 'ILEGIVEL'
  | 'SEM_CORRESPONDENCIA'
  | 'DIVERGENTE'
  | 'RETIDO'
  | 'REENTREGA'
  | 'CONFERIDO_SEM_EFEITO'
  | 'APLICADO';

/**
 * O **único** desfecho que registra efeito produzido — nomeado para que o predicado se leia como a
 * regra, e anotado com o tipo para que renomear o membro da união reprove aqui.
 *
 * ⚠️ **`CONFERIDO_SEM_EFEITO` não entra, e a separação É a idempotência.** Uma primeira notícia que
 * encontrou o título ainda em aberto — corrida entre o aviso e a baixa no provedor — precisa poder
 * ser **reprocessada** pela reentrega seguinte. Fundir os dois transformaria uma corrida benigna em
 * recebimento perdido.
 */
const DESFECHO_COM_EFEITO_APLICADO: DesfechoDaNotificacaoBancaria = 'APLICADO';

/** A classificação de tudo que não se reconhece — instância única, congelada, sem ramo especial. */
const ILEGIVEL: NotificacaoBancariaClassificada = Object.freeze({ classificacao: 'ILEGIVEL' });

/** O pedido de validação do endereço, que não roteia e não procura cobrança alguma (RN-10). */
const VALIDACAO_DE_ENDERECO: NotificacaoBancariaClassificada = Object.freeze({
  classificacao: 'VALIDACAO_DE_ENDERECO',
});

/**
 * Verdadeiro quando o valor é um objeto JSON navegável por chave.
 *
 * Arranjo fica de fora de propósito: ele é `typeof 'object'` e passaria por uma guarda ingênua, e um
 * arranjo com propriedades numéricas não é o corpo que o provedor envia. `null` idem — o clássico.
 */
function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * A cadeia não vazia que o valor é, ou `null` quando ele não é uma.
 *
 * Não há `trim` nem canonização de caixa, pela mesma razão que
 * {@link ESQUEMA_DO_IDENTIFICADOR_BANCARIO} escreve por extenso: estes valores são compostos por
 * máquina, nunca digitados, e espaço em volta não é distração — é sinal de que o que chegou não é o
 * que se supõe. Engoli-lo esconderia o defeito em vez de tolerá-lo.
 */
function comoCadeiaNaoVazia(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

/**
 * O número que chega **inteiro** no JSON, coagido para cadeia — ou `null` quando não é nem uma coisa
 * nem outra.
 *
 * A coerção é estreita de propósito: `String(valor)` sobre `unknown` aceitaria `null`, `true` e
 * objeto, e produziria `'null'`, `'true'` e `'[object Object]'` — cadeias plausíveis para um campo que
 * seria comparado com o gravado na cobrança. Só passam a cadeia não vazia e o **inteiro seguro não
 * negativo**; qualquer número fora dessa faixa já chegou corrompido de `JSON.parse` e é recusado.
 */
function comoCadeiaDeInteiro(valor: unknown): string | null {
  if (typeof valor === 'number') {
    return Number.isSafeInteger(valor) && valor >= 0 ? String(valor) : null;
  }
  return comoCadeiaNaoVazia(valor);
}

/**
 * Classifica o corpo recebido do provedor em uma das três categorias — **função pura e total**.
 *
 * Nenhuma entrada a faz levantar: corpo que não é objeto, campo faltando, tipo trocado e objeto vazio
 * saem todos como `ILEGIVEL`. É requisito, e não robustez decorativa — a tarefa que a chama já
 * respondeu `204` ao provedor e já gravou o cru, de modo que uma exceção aqui só produziria reentrega
 * da fila sobre um corpo que nunca vai ser interpretado.
 *
 * ⚠️ **A ordem dos ramos é conteúdo.** O pedido de validação do endereço decide **antes** de qualquer
 * outra consideração (CA-11): um corpo que traga `validacaoWebhook: true` é respondido como o que é,
 * ainda que carregue lixo em todo o resto — é assim que o cadastro do endereço junto ao provedor se
 * conclui.
 *
 * @param recebido O corpo como chegou, sem interpretação prévia — daí `unknown`.
 */
export function classificarNotificacaoBancaria(recebido: unknown): NotificacaoBancariaClassificada {
  if (!ehObjeto(recebido)) {
    return ILEGIVEL;
  }

  // DECISÃO FECHADA — T4 / fatia `webhook-e-carne` · 2026-08-18
  // O QUÊ: a leitura abaixo é TOLERANTE — olha só as chaves de que precisa e ignora todas as
  //        outras. Nada aqui é `z.strictObject`, e nenhuma chave desconhecida desclassifica.
  // POR QUÊ: `.claude/rules/contrato-publicado.md` manda entrada fechada, e não alcança este corpo:
  //          ela governa o esquema publicado por `@sysloc/contracts` e se justifica por "chave
  //          desconhecida na entrada é erro do cliente". O provedor não é cliente nosso e não pode
  //          corrigir o payload; fechar a leitura faria toda notícia com campo novo dele virar
  //          `ILEGIVEL`, que é perder a notícia — o defeito que esta fatia existe para não ter
  //          (RN-02/CA-03, tech spec §21.2).
  // REVERTER EXIGE: provar que o provedor deixou de acrescentar campos ao corpo sem aviso, ou que
  //                 existe caminho pelo qual a notícia recusada por forma ainda produza o efeito.
  if (recebido.validacaoWebhook === true) {
    return VALIDACAO_DE_ENDERECO;
  }

  const dados: unknown = recebido.dados;
  if (!ehObjeto(dados)) {
    return ILEGIVEL;
  }

  // A forma do identificador vem da fonte única (ADR-0016): 18 posições, todas dígitos. Ausente,
  // vazio, com 17 ou com 19 posições cai igual — a largura é fechada dos dois lados lá.
  const identificador = ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(dados.seuNumero);
  if (!identificador.success) {
    return ILEGIVEL;
  }

  const numeroDoTitulo = comoCadeiaDeInteiro(dados.nossoNumero);
  const identificadorDaLiquidacao = comoCadeiaNaoVazia(dados.numeroIdentificadorBaixa);
  if (numeroDoTitulo === null || identificadorDaLiquidacao === null) {
    return ILEGIVEL;
  }

  return {
    classificacao: 'AVISO_DE_RECEBIMENTO',
    identificadorPeranteOProvedor: identificador.data,
    numeroDoTituloNoProvedor: numeroDoTitulo,
    numeroDoClienteNoProvedor:
      typeof dados.numeroCliente === 'number' ? dados.numeroCliente : undefined,
    identificadorDaLiquidacao,
  };
}

/**
 * Se o desfecho anterior de uma notícia com o **mesmo identificador da liquidação** é evidência de
 * efeito já produzido — e portanto de que a que chegou agora é reentrega (RN-08/CA-09).
 *
 * Só `APLICADO` conta. `DIVERGENTE`, `RETIDO`, `CONFERIDO_SEM_EFEITO`, `REENTREGA`,
 * `SEM_CORRESPONDENCIA`, `ILEGIVEL`, `VALIDACAO_DE_ENDERECO` e `RECEBIDO` **não** são reentrega, e
 * tratá-los como tal faria um `DIVERGENTE` ou um `RETIDO` **nunca** ser retratado: a notícia seguinte
 * sairia sem efeito exatamente no caso em que a retomada é o comportamento exigido.
 *
 * A ausência de notícia anterior — `null` da coluna, `undefined` de uma consulta que não achou linha
 * — é `false`, e as duas formas são aceitas porque as duas ocorrem no monorepo. Fazer o predicado
 * total aqui evita que cada chamador escreva a sua própria conversão, que é a segunda regra para o
 * mesmo fato.
 *
 * ⚠️ **Ele é a camada barata da idempotência, e não a garantia.** A garantia é o `WHERE` do `UPDATE`
 * que grava o efeito, que não tem prazo; esta some junto com o cru dos 90 dias, e isso é aceito.
 */
export function ehReentregaDeEfeitoAplicado(
  desfechoAnterior: DesfechoDaNotificacaoBancaria | null | undefined,
): boolean {
  return desfechoAnterior === DESFECHO_COM_EFEITO_APLICADO;
}
