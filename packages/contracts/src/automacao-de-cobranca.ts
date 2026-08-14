/**
 * O contrato da **automação de cobrança** — a política de aviso que a régua obedece e a linha do
 * registro de toda tentativa de envio.
 *
 * ===========================================================================
 * Por que os três enums nascem aqui, e não em `packages/db`
 * ===========================================================================
 *
 * `negocio.canal_de_aviso`, `negocio.caminho_do_aviso` e `negocio.desfecho_do_aviso` são enums do
 * banco, e é justamente por isso que a direção importa. Declarados lá, este pacote precisaria
 * importar `@sysloc/db` para falar de canal, de caminho e de desfecho, e o contrato deixaria de ser
 * folha: o frontend, ao importar os tipos no marco de entrega, arrastaria a camada de dados junto.
 * Declarados aqui, `packages/db` os consome na direção inversa, que não custa nada — o servidor já
 * depende de tudo. É a mesma forma, e a mesma razão, de `NATUREZAS_DE_COBRANCA` em `cobranca.ts` e
 * de `ESTADOS_DO_CONTRATO` em `contrato.ts`: `as const` fecha a união em **compilação**,
 * `Object.freeze` fecha o arranjo em **execução**.
 *
 * É também o que fixa a ordem T2 → T3: a T3 deriva os enums do banco destes literais e, se a ordem
 * se invertesse, os redigitaria — a segunda fonte do mesmo fato que a ADR-0016 elimina. **A ordem dos
 * rótulos é conteúdo, não estética**: um enum do PostgreSQL guarda a ordem, e é ela que governa
 * comparação e ordenação do tipo.
 *
 * As três uniões **não** são publicadas como tipo próprio, e a ausência é decisão: quem precisar do
 * tipo de um rótulo o obtém do recurso publicado — `EnvioDeCobranca['caminho']`,
 * `EnvioDeCobranca['desfecho']`, `PoliticaDeAviso['canal']` —, que é **derivação** do mesmo esquema e
 * não uma segunda declaração livre para divergir. Publicar um alias por enum acrescentaria três
 * símbolos à superfície do pacote sem acrescentar um fato sequer.
 *
 * ===========================================================================
 * O canal é enum de UM valor, e a solidão é a decisão
 * ===========================================================================
 *
 * A RN-13 manda **recusar na entrada** o canal que o produto não implementa. Um enum de um elemento
 * faz a recusa ser do **esquema** — `422 CAMPO_INVALIDO` nomeando `canal` —, sem uma linha de
 * verificação escrita à mão, e faz o documento publicado (ADR-0016) dizer a verdade sobre o que
 * existe. Um campo livre conferido por texto aceitaria `sms` em silêncio, que é exatamente o que a
 * regra proíbe; e um enum com valores que o produto não entrega faria o documento prometer canal que
 * rota nenhuma cumpre.
 *
 * ===========================================================================
 * O corpo é COMPLETO, e campo ausente é RECUSA — nunca "preserve o valor atual"
 * ===========================================================================
 *
 * {@link esquemaDaPoliticaDeAvisoNova} é `strictObject` de **seis campos, nenhum opcional**, e é essa
 * ausência de opcionalidade que define o `PUT` desta superfície. A razão está por extenso no
 * cabeçalho de `./configuracao-de-mora.ts` e vale igual aqui: o `PUT` parcial que copia o `required`
 * do `POST` faz o cliente que envia só `ativo` acreditar que zerou o resto, enquanto o servidor
 * preserva o anterior sem que nada acuse. Aqui o corpo incompleto é `422` nomeando o campo que falta,
 * e a intenção do cliente nunca precisa ser adivinhada.
 *
 * A ausência de campo opcional é também o que faz a rota ser **idempotente por construção**: o mesmo
 * corpo aplicado duas vezes descreve o mesmo estado final, independentemente do que havia antes.
 *
 * ===========================================================================
 * Os horários são `HH:MM` por expressão ancorada — e NÃO `z.iso.time()`
 * ===========================================================================
 *
 * `z.iso.time()` aceita segundos e fração, e a política não tem resolução de segundo: aprovar
 * `08:00:30.500` seria aprovar um valor que a comparação da janela nunca discrimina, e que a coluna
 * `time` guardaria com uma precisão que o produto não publica de volta (a projeção é
 * `to_char(coluna, 'HH24:MI')`). A âncora `^…$` é o que impede `08:00:00` de passar por casamento
 * parcial — sem ela, a expressão aceitaria qualquer texto que **contivesse** um horário.
 *
 * ===========================================================================
 * A restrição de faixa vale na ENTRADA e NÃO é replicada na SAÍDA
 * ===========================================================================
 *
 * {@link esquemaDaPoliticaDeAviso} declara os dois inteiros como `z.number().int()` puro, sem faixa,
 * e não repete o `refine` da janela. A assimetria é deliberada: é a mesma que o marcador
 * `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM` registra em `./comum.ts` — **leia-o antes de qualquer
 * tentativa de simetrizar**. A razão (1) de lá é a que governa aqui: esquema de saída que recusa
 * **não produz `422`**, ele levanta na serialização e **derruba a rota**. Quem impede o valor fora da
 * faixa de existir é a entrada, mais os dois `CHECK` do banco — dois pontos que produzem recusa
 * legível; a saída apenas descreve o que já está gravado.
 *
 * O **formato** do horário, por outro lado, permanece na saída, e a diferença não é descuido: ele não
 * é faixa de domínio, é a **forma publicada** do campo — a mesma classe de `z.iso.date()` e de
 * `ESQUEMA_DO_CODIGO_DE_COBRANCA`, que `esquemaDaCobranca` também mantém na saída. É dele que o
 * documento da ADR-0016 tira a promessa de que o campo tem cinco caracteres, e afrouxá-lo para
 * `z.string()` faria o contrato deixar de descrever o que ele entrega.
 *
 * ===========================================================================
 * `empresaId` não é campo, e a ausência é o mecanismo (ADR-0008)
 * ===========================================================================
 *
 * A empresa sai do contexto da sessão, e o `strictObject` converte a tentativa de propô-la pelo corpo
 * em recusa por chave desconhecida — sem uma linha de verificação escrita à mão. É o mesmo desenho de
 * toda entrada deste pacote, e é o que a varredura de `packages/contracts/test/esquemas.spec.ts`
 * afirma sobre **todos** eles de uma vez.
 *
 * ===========================================================================
 * Nenhum esquema de paginação nasce aqui
 * ===========================================================================
 *
 * A janela do histórico é `esquemaDaJanela` e a lista é `envelopeDeLista(esquemaDoEnvioDeCobranca)`,
 * ambos de `./comum.ts`. Reescrevê-los por recurso é exatamente o que aquele arquivo existe para
 * impedir: o teto que recusa em vez de truncar, e a forma `{ itens, total, limite, deslocamento }` da
 * ADR-0017, são fatos do contrato que existem num lugar só.
 */

import { z } from 'zod';
import { ESQUEMA_DO_CODIGO_DE_COBRANCA } from './cobranca.js';

/**
 * O único canal de aviso que o produto implementa (RN-13).
 *
 * **Um valor não é lista pela metade**: é a enumeração completa do que existe hoje. Acrescentar um
 * rótulo aqui é decisão de produto com efeito no documento publicado e no enum do banco, nunca
 * conveniência de implementação.
 */
export const CANAIS_DE_AVISO = Object.freeze(['EMAIL'] as const);

/**
 * Como a tentativa nasceu — pela passagem da régua ou pelo disparo de uma pessoa autorizada.
 *
 * O caminho é atributo do **registro**, e é publicado no histórico: é ele que responde *"quem mandou
 * este aviso"* meses depois. O gatilho de tempo que aciona a régua **não** existe nesta fatia
 * (RN-14), e por isso `AUTOMATICO` nomeia a origem da tentativa, jamais o agendamento.
 */
export const CAMINHOS_DO_AVISO = Object.freeze(['AUTOMATICO', 'MANUAL'] as const);

/**
 * As três naturezas de uma tentativa de envio (RD-08).
 *
 * `SEM_DESTINATARIO` é rótulo próprio, e não um caso de `FALHOU`, porque as duas coisas se decidem
 * diferente: a falha é do transporte e pede diagnóstico, a ausência de endereço é do cadastro e pede
 * correção do locatário. Fundi-las tornaria a métrica de saúde do envio ilegível — e é exatamente a
 * distinção que a RD-11 precisa registrar sem travar o laço.
 */
export const DESFECHOS_DO_AVISO = Object.freeze(['ENVIADA', 'FALHOU', 'SEM_DESTINATARIO'] as const);

/**
 * A faixa **fechada** dos dias de antecedência e a do intervalo mínimo (§6.1).
 *
 * Não são exportadas: o que os consumidores precisam é do esquema, que é o ponto único da
 * conferência. Publicar os limites crus convidaria a uma segunda conferência escrita à mão em algum
 * controlador, e é a repetição — não o número — que reabriria a divergência.
 *
 * O piso do intervalo é **1**, e não 0: zero desligaria a trava que protege a caixa do locatário, e
 * desligar a régua se faz por `ativo`, nunca por valor de borda de um campo que significa outra
 * coisa. O piso dos dias é **0**, e ali o zero tem significado legítimo — avisar no próprio dia do
 * vencimento.
 */
const MENOR_DIA_DE_ANTECEDENCIA = 0;
const MAIOR_DIA_DE_ANTECEDENCIA = 90;
const MENOR_INTERVALO_EM_DIAS = 1;
const MAIOR_INTERVALO_EM_DIAS = 90;

/**
 * O molde `HH:MM` de vinte e quatro horas, **ancorado nas duas pontas**.
 *
 * `([01]\d|2[0-3])` fecha a hora em `00..23` e `[0-5]\d` fecha o minuto em `00..59`, de modo que
 * `24:00` e `08:60` são recusados pela própria forma — e não por uma conferência posterior que
 * alguém precisaria lembrar de escrever. A âncora recusa `8:00` (hora sem preenchimento), `08:0`
 * (minuto incompleto) e `08:00:00` (a forma que o driver devolveria se a projeção do banco não fosse
 * `to_char(coluna, 'HH24:MI')`).
 *
 * Ela é declarada uma vez e consumida pelos dois campos, nos dois esquemas: quatro escritas do mesmo
 * molde ficariam livres para divergir, que é o defeito que a fonte única existe para fechar.
 */
const EXPRESSAO_DA_HORA_DO_DIA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A hora do dia como ela viaja no contrato — texto `HH:MM`, comparável por ordem lexicográfica.
 *
 * É **função**, e não uma constante compartilhada, pelo mesmo motivo de `camposDeEndereco()` em
 * `./comum.ts`: o objeto de esquema do Zod é consumido por composição, e uma única instância
 * partilhada entre entrada e saída as deixaria acopladas a qualquer emenda futura de uma delas.
 */
function esquemaDaHoraDoDia() {
  return z.string().regex(EXPRESSAO_DA_HORA_DO_DIA);
}

/**
 * Responde se o texto já está no molde `HH:MM` — a guarda da comparação da janela, logo abaixo.
 *
 * Existe porque a comparação só tem sentido entre dois horários **bem formados**: `'24:00'` é uma
 * cadeia que o operador `>=` compara alegremente, produzindo um veredito sobre um valor que não é
 * horário. Sem esta guarda, um corpo com `janelaInicio: '24:00'` seria recusado com **duas** questões
 * — o formato e a comparação —, e a segunda nomearia `janelaFim`, que está correto. A borda reporta o
 * campo da **primeira** questão (`comum/validacao.ts`), de modo que o cliente ouviria o nome do campo
 * errado.
 */
function ehHoraDoDia(valor: string): boolean {
  return EXPRESSAO_DA_HORA_DO_DIA.test(valor);
}

/**
 * Corpo fechado de `PUT /v1/automacao-de-cobranca` (§4.1.1) — **seis** campos, nenhum opcional.
 *
 * A conferência da janela é **do objeto**, com `path` explícito, e não de um campo: é a mesma forma
 * de `esquemaDeCobrancaNova` em `./cobranca.ts`, e o `path` é o que impede a recusa de chegar ao
 * cliente sem nome de campo — a §6.1 manda `422 CAMPO_INVALIDO` nomeando `janelaFim`.
 *
 * **Janela invertida é recusada, e não reinterpretada.** `18:00`–`09:00` poderia ser lido como *"a
 * noite inteira"*, e adivinhar seria pior do que recusar: o cliente que trocou os dois campos de
 * lugar receberia uma régua enviando de madrugada, sem nada que acusasse o engano. A mesma regra é
 * `politica_de_aviso_janela_chk` no banco, que é a **rede** — nunca a primeira linha de defesa.
 */
export const esquemaDaPoliticaDeAvisoNova = z
  .strictObject({
    ativo: z.boolean(),
    diasAntesDoVencimento: z
      .number()
      .int()
      .min(MENOR_DIA_DE_ANTECEDENCIA)
      .max(MAIOR_DIA_DE_ANTECEDENCIA),
    intervaloMinimoDias: z.number().int().min(MENOR_INTERVALO_EM_DIAS).max(MAIOR_INTERVALO_EM_DIAS),
    janelaInicio: esquemaDaHoraDoDia(),
    janelaFim: esquemaDaHoraDoDia(),
    canal: z.enum(CANAIS_DE_AVISO),
  })
  .refine(
    ({ janelaInicio, janelaFim }) =>
      // A guarda vem antes da comparação de propósito — ver {@link ehHoraDoDia}. Horário malformado
      // já é recusado pelo próprio campo, e comparar o que não é horário só acrescentaria uma segunda
      // questão nomeando o campo errado.
      !ehHoraDoDia(janelaInicio) || !ehHoraDoDia(janelaFim) || janelaFim >= janelaInicio,
    {
      path: ['janelaFim'],
      message: 'a janela precisa terminar em hora igual ou posterior à de início',
    },
  );

/** O corpo aceito ao definir a política de aviso da empresa. */
export type PoliticaDeAvisoNova = z.infer<typeof esquemaDaPoliticaDeAvisoNova>;

/**
 * A política de aviso como a API a publica — os **mesmos seis campos**.
 *
 * **Não há `id`, e não há `empresaId`.** O recurso é singular por empresa (uma linha, imposta por
 * `politica_de_aviso_empresa_key`), de modo que não existe o que identificar: a chave é a própria
 * sessão. Publicar o UUID daria ao consumidor um identificador que rota nenhuma aceita.
 *
 * A empresa que **nunca configurou** lê este mesmo recurso com a política desligada (`ativo: false`),
 * e não um `404`: a ausência de linha e a régua explicitamente desligada são a mesma coisa publicada
 * (RD-03). É o que faz a leitura concordar com o que a passagem da régua faz — nada.
 *
 * **Ele é `z.object`, e o irmão de entrada é `strictObject` — a assimetria é a convenção, não
 * descuido.** Todo esquema de SAÍDA deste pacote é aberto e todo esquema de ENTRADA é fechado, com
 * **uma única exceção registrada** — as duas respostas de `./confirmacao-de-email.ts`, onde o
 * conjunto fechado de chaves **é** o conteúdo do contrato. A razão da convenção está por extenso no
 * cabeçalho de `./configuracao-de-mora.ts`, e o discriminador da exceção também — é lá que se
 * confere se um esquema de saída novo pode fechar, **antes** de fechá-lo: pela **ADR-0016** o
 * documento OpenAPI **deriva** daqui, e um `strictObject` emite `additionalProperties: false` — um
 * cliente gerado passaria a recusar campo acrescentado no futuro nestas rotas, enquanto tolera o
 * mesmo acréscimo em todas as outras.
 */
export const esquemaDaPoliticaDeAviso = z.object({
  ativo: z.boolean(),
  diasAntesDoVencimento: z.number().int(),
  intervaloMinimoDias: z.number().int(),
  janelaInicio: esquemaDaHoraDoDia(),
  janelaFim: esquemaDaHoraDoDia(),
  canal: z.enum(CANAIS_DE_AVISO),
});

/** A política de aviso vigente na empresa da sessão. */
export type PoliticaDeAviso = z.infer<typeof esquemaDaPoliticaDeAviso>;

/**
 * Uma tentativa de envio como a API a devolve — a linha do histórico e o corpo do disparo manual.
 *
 * **A chave exposta é o `id`, e ele é UUID** (ADR-0017): a tentativa não tem série declarada, e
 * inventar uma daria ao consumidor um código que nenhuma rota aceita. `cobrancaCodigo`, ao lado, é o
 * **código legível** — a cobrança tem série —, e as duas classes convivem no mesmo recurso de
 * propósito, exatamente como `contratoCodigo` e `locatarioId` em `esquemaDaCobranca`. Ele passa pelo
 * {@link ESQUEMA_DO_CODIGO_DE_COBRANCA} **importado**, e não por um molde redigitado: redigitar
 * criaria a segunda fonte do mesmo fato que a ADR-0016 elimina, e a cópia nasceria sem o `trim` e o
 * `toUpperCase` que canonizam a caixa.
 *
 * **`destinatario` aceita cadeia vazia, e isso é o contrato.** É o caso `SEM_DESTINATARIO` da RD-11:
 * o locatário não tinha endereço, a tentativa não travou o laço e **foi registrada assim mesmo**. Se
 * o esquema exigisse `z.email()`, a linha do registro seria impublicável justamente no caso que ela
 * existe para registrar — e a rota de histórico levantaria na serialização, derrubando a leitura de
 * uma cobrança por causa de um cadastro incompleto.
 *
 * **`causa` é anulável e o banco a pareia com o desfecho** (`envio_de_cobranca_causa_chk`): nula
 * quando a mensagem saiu, preenchida quando não saiu. O pareamento é do banco porque é lá que ele é
 * verdade para toda escrita; o esquema apenas publica o que foi gravado.
 *
 * `criadoEm` é `z.iso.datetime()` — instante, e não data de calendário: é o relógio **do banco**
 * (ADR-0026) que o carimba, e é por ele que o histórico ordena e a trava conta o intervalo.
 */
export const esquemaDoEnvioDeCobranca = z.object({
  id: z.uuid(),
  cobrancaCodigo: ESQUEMA_DO_CODIGO_DE_COBRANCA,
  criadoEm: z.iso.datetime(),
  caminho: z.enum(CAMINHOS_DO_AVISO),
  desfecho: z.enum(DESFECHOS_DO_AVISO),
  destinatario: z.string(),
  causa: z.string().nullable(),
});

/** Uma tentativa de envio como a API a devolve. */
export type EnvioDeCobranca = z.infer<typeof esquemaDoEnvioDeCobranca>;
