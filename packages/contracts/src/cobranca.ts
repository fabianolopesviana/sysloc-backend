/**
 * O contrato da **cobrança** — o fato financeiro do produto, e a **segunda** entidade com série
 * declarada.
 *
 * ===========================================================================
 * Por que os dois enums nascem aqui, e não em `packages/db`
 * ===========================================================================
 *
 * `negocio.natureza_cobranca` e `negocio.status_cobranca` são enums do banco, e é justamente por
 * isso que a direção importa. Declarados lá, este pacote precisaria importar `@sysloc/db` para falar
 * de natureza e de estado, e o contrato deixaria de ser folha: o frontend, ao importar os tipos no
 * marco de entrega, arrastaria a camada de dados junto. Declarados aqui, `packages/db` os consome na
 * direção inversa, que não custa nada — o servidor já depende de tudo. É a mesma forma, e a mesma
 * razão, de `ESTADOS_DO_CONTRATO` em `contrato.ts` e de `TIPOS_DE_IMOVEL` em `imovel.ts`: `as const`
 * fecha a união em **compilação**, `Object.freeze` fecha o arranjo em **execução**.
 *
 * É também o que fixa a ordem T2 → T3: a T3 deriva os enums do banco destes literais e, se a ordem
 * se invertesse, os redigitaria — a segunda fonte do mesmo fato que a ADR-0016 elimina. **A ordem
 * dos rótulos é conteúdo, não estética**: um enum do PostgreSQL guarda a ordem, e é ela que governa
 * comparação e ordenação do tipo.
 *
 * ===========================================================================
 * A chave exposta é o CÓDIGO, e o UUID interno não trafega
 * ===========================================================================
 *
 * A ADR-0017 é literal: a chave exposta é o código textual legível **quando a entidade tem série
 * declarada** — e ela nomeia contrato **e cobrança**. Por isso {@link esquemaDaCobranca} **não tem
 * `id`**: o UUID permanece chave interna, e publicá-lo daria ao consumidor dois identificadores para
 * a mesma coisa, um dos quais nenhuma rota aceita.
 *
 * ===========================================================================
 * O que se GRAVA e o que se DERIVA — a ADR-0022 em forma de esquema
 * ===========================================================================
 *
 * O recurso publicado tem vinte e três campos e o corpo de entrada tem **seis**. A diferença não é
 * omissão: `status`, `diasAtraso`, `valorMulta`, `valorJuros` e `valorTotal` são **derivados** na
 * view enquanto a cobrança está aberta; `pagoEm`, `valorPago`, `canceladoEm`,
 * `multaPercentualAplicado` e `jurosPercentualAplicado` são **carimbados** pelo ato que liquida; e
 * `codigo` e `locatarioId` são decididos pelo servidor (a série e a junção com o contrato). Nenhum
 * deles é aceito no corpo, e a **ausência é o mecanismo** — o `strictObject` converte a tentativa em
 * recusa por chave desconhecida, sem uma linha de verificação escrita à mão.
 *
 * `status` merece a menção separada porque tem ADR própria: a ADR-0021 fixa que toda transição de
 * estado é **rota própria**, nunca campo gravado por atualização do recurso. Aqui isso também não é
 * uma verificação: é a ausência de `status` em {@link esquemaDeCobrancaNova}.
 *
 * As seis colunas de conciliação bancária nasceram nulas e sem esquema que as publicasse, e o texto
 * daqui dizia que *"só a F4 as publica — é o que obriga aquela fatia a **tocar este contrato** em vez
 * de mudar o significado da resposta por omissão"*. **A F4 chegou**: a fatia `emissao-e-conciliacao`
 * publica **cinco** delas em {@link esquemaDaCobranca}, com nomes do produto e não do provedor, e
 * deixa de fora `boleto_arquivo`, que são bytes entregues por rota própria (ADR-0028). A obrigação
 * foi cumprida como escrita — o contrato foi tocado, e o significado da resposta não mudou por
 * omissão. Ver o docblock daquele esquema para o que cada um carrega e por que a chave é
 * `numeroDoTituloNoProvedor`.
 *
 * ===========================================================================
 * A restrição de escala vale na ENTRADA e NÃO na SAÍDA
 * ===========================================================================
 *
 * `valorOriginal` e `valorPago` restringem escala; `valorMulta`, `valorJuros` e `valorTotal`, não. A
 * assimetria é deliberada e já está registrada pelo marcador `DECISÃO FECHADA` de
 * `ESCALA_DA_METRAGEM`, em `comum.ts` — **leia-o antes de qualquer tentativa de simetrizar**. A razão
 * (1) de lá é a que governa aqui: esquema de saída que recusa **não produz `422`**, ele levanta na
 * serialização e **derruba a rota**. E os três da saída são exatamente os derivados por soma, que é
 * o caso em que o resíduo de ponto flutuante aparece.
 */

import { z } from 'zod';
import {
  ESCALA_MONETARIA,
  esquemaDaJanela,
  MAIOR_TEXTO_CURTO,
  MAIOR_VALOR_MONETARIO,
} from './comum.js';
import { ESQUEMA_DO_CODIGO_DE_CONTRATO } from './contrato.js';

/**
 * As cinco naturezas de cobrança (RD-03), na ordem em que o enum do banco as declara.
 *
 * ---------------------------------------------------------------------------
 * Elas são criação do produto, e não porte — o dado antigo não tem o que confirmar
 * ---------------------------------------------------------------------------
 *
 * Medido: o DocType `Cobranca` do legado tem 48 campos e **nenhum de natureza**. Lá, "novo título"
 * se distingue apenas pelo texto de `referencia`, que é rótulo livre. Não há, portanto, lista real a
 * conferir contra o oráculo, e a enumeração acima é decisão desta fatia — o que a congela é a
 * asserção literal do CT-540, não uma medição.
 *
 * `natureza` e `referencia` são campos **distintos** de propósito: o primeiro classifica e é
 * filtrável; o segundo descreve e é livre. Fundi-los reproduziria o defeito do legado, em que
 * filtrar por tipo de título exigia casar texto.
 */
export const NATUREZAS_DE_COBRANCA = Object.freeze([
  'ALUGUEL',
  'AGUA',
  'CONDOMINIO',
  'ENERGIA',
  'OUTRO',
] as const);

/** União fechada das naturezas de cobrança. */
export type NaturezaDeCobranca = (typeof NATUREZAS_DE_COBRANCA)[number];

/**
 * Os quatro estados da cobrança (RD-04), na ordem em que o enum do banco os declara.
 *
 * O estado é **derivado dos fatos gravados**, nunca coluna movida por rotina (ADR-0022): `CANCELADA`
 * se há cancelamento, senão `PAGA` se há pagamento, senão `VENCIDA` se o vencimento já passou, senão
 * `A_VENCER`. A avaliação corre num lugar só — a view —, e é essa unicidade que fecha o defeito de
 * três derivações divergentes do mesmo estado que o legado carrega.
 */
export const ESTADOS_DA_COBRANCA = Object.freeze([
  'A_VENCER',
  'VENCIDA',
  'PAGA',
  'CANCELADA',
] as const);

/** União fechada dos estados da cobrança. */
export type EstadoDaCobranca = (typeof ESTADOS_DA_COBRANCA)[number];

/**
 * O subconjunto dos estados em que a cobrança está **em aberto** — nenhum desfecho gravado.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora AQUI, e não em quem a consome
 * ---------------------------------------------------------------------------
 *
 * *"Quais estados estão em aberto"* é a mesma classe de fato que {@link ESTADOS_DA_COBRANCA}: uma
 * partição da união fechada, decidida pela precedência que a view aplica. Declará-la no consumidor
 * obrigaria a **redigitar os rótulos** lá, e um rótulo redigitado é a segunda fonte do mesmo fato
 * que a ADR-0016 elimina — com um agravante próprio desta fatia: `packages/db/src/**` não pode ter
 * literal de `negocio.status_cobranca` em posição executável, porque é justamente a ausência dele
 * que torna verificável a decisão de haver **uma só** derivação do estado, no banco. Publicada
 * aqui, o consumidor consome um **nome**.
 *
 * A anotação `readonly EstadoDaCobranca[]` não é ornamento: ela é o que faz um rótulo inventado
 * **não compilar**, e é o que permite ao consumidor perguntar `includes(estado)` com um valor da
 * união inteira.
 *
 * ---------------------------------------------------------------------------
 * Ela NÃO é um segundo lugar onde o estado se decide
 * ---------------------------------------------------------------------------
 *
 * Nada aqui deriva estado: quem classifica uma cobrança concreta continua sendo, e só, a view
 * (ADR-0022). Esta lista responde a pergunta inversa — *dado um estado já publicado, ele é de
 * cobrança aberta?* —, que é a pergunta que o recorte da carteira faz para alcançar o índice
 * parcial `cobranca_aberta_idx`.
 */
export const ESTADOS_EM_ABERTO: readonly EstadoDaCobranca[] = Object.freeze([
  'A_VENCER',
  'VENCIDA',
]);

/** O prefixo da série da cobrança — o `COB` de `COB-2026-0000059` (RD-02). */
export const PREFIXO_DO_CODIGO_DE_COBRANCA = 'COB';

/**
 * Quantos dígitos o ano ocupa no código.
 *
 * Não é exportada, e é declarada aqui em vez de importada de `contrato.ts` pela razão que o docblock
 * da homônima de lá registra: o ano de quatro dígitos é o mesmo em toda série concebível, e não é
 * decisão que o consumidor precise conhecer. Ela existe para que o formatador e a expressão abaixo
 * saiam da **mesma** declaração — redigitar `\d{4}` na expressão deixaria as duas livres para
 * divergir, que é exatamente o defeito que a fonte única existe para fechar.
 */
const LARGURA_DO_ANO_NO_CODIGO = 4;

// DECISÃO FECHADA — F3/fatia 1 · 2026-08-09
// O QUÊ: a largura do sequencial da cobrança é SETE dígitos (`COB-2026-0000058`).
// POR QUÊ: é o valor MEDIDO no sistema antigo (`autoname` = `COB-.YYYY.-.#######`, série viva em
//          `COB-2026-0000058`, com 16 registros para 58 números emitidos). Ela DIVERGE da largura 5
//          do contrato de locação, e a divergência é deliberada: "harmonizar" as duas produziria um
//          código fora do formato que o usuário reconhece nas telas do Financeiro.
// REVERTER EXIGE: medir de novo o `autoname` da `Cobranca` no sistema antigo (ou, depois da virada,
//                 provar que nenhum código de sete dígitos foi emitido nem citado fora do sistema).
export const LARGURA_DO_SEQUENCIAL_DE_COBRANCA = 7;

/**
 * A forma do código, construída a partir das constantes acima — **nunca redigitada**.
 *
 * Não é exportada: quem precisa conferir um código usa {@link ESQUEMA_DO_CODIGO_DE_COBRANCA}, que é
 * o ponto único de canonização. Publicar a expressão crua convidaria a uma segunda conferência sem
 * o `trim`/`toUpperCase`, e é a repetição — não a expressão — que reabriria a divergência de caixa.
 */
const EXPRESSAO_DO_CODIGO_DE_COBRANCA = new RegExp(
  `^${PREFIXO_DO_CODIGO_DE_COBRANCA}-\\d{${LARGURA_DO_ANO_NO_CODIGO}}-\\d{${LARGURA_DO_SEQUENCIAL_DE_COBRANCA}}$`,
);

/**
 * Monta o código legível a partir do ano e do número emitido pela série (ADR-0015, RD-02).
 *
 * Formatador e esquema saem das **mesmas** constantes, e isso é o que impede a divergência muda em
 * que a emissão produz um código que a rota de leitura recusa.
 *
 * ---------------------------------------------------------------------------
 * O formatador PREENCHE até a largura, e não TRUNCA além dela — a assimetria é deliberada
 * ---------------------------------------------------------------------------
 *
 * `padStart` completa com zeros até sete dígitos e **deixa crescer** quando o sequencial passa de
 * `9 999 999`: `formatarCodigoDeCobranca(2026, 12345678)` devolve `COB-2026-12345678`. Truncar
 * produziria **colisão** — duas cobranças com o mesmo código —, e a restrição
 * `unique (empresa_id, codigo)` recusaria a segunda gravação sobre um número que a série já consumiu
 * e **nunca reusa** (ADR-0015).
 *
 * {@link ESQUEMA_DO_CODIGO_DE_COBRANCA}, por outro lado, aceita **exatamente** a largura declarada:
 * é o formato publicado, e é ele que a rede do marcador acima precisa prender pelos dois lados —
 * cinco dígitos recusados (a harmonização tentadora com a série do contrato) **e** oito recusados,
 * porque um esquema aberto em `\d{7,}` deixaria a largura sem asserção pelo lado de cima.
 */
export function formatarCodigoDeCobranca(ano: number, sequencial: number): string {
  const anoEmTexto = String(ano).padStart(LARGURA_DO_ANO_NO_CODIGO, '0');
  const sequencialEmTexto = String(sequencial).padStart(LARGURA_DO_SEQUENCIAL_DE_COBRANCA, '0');

  return `${PREFIXO_DO_CODIGO_DE_COBRANCA}-${anoEmTexto}-${sequencialEmTexto}`;
}

/**
 * O código da cobrança, **na forma canônica** — o ponto único de normalização (RD-02).
 *
 * `trim` → `toUpperCase` → forma. A caixa é imposta **aqui** pela mesma razão já medida na fatia
 * anterior: o código é a chave exposta, viaja no caminho da URL e é comparado com o valor gravado.
 * Um `cob-2026-0000059` citado em minúsculas produziria `404` sobre um registro que existe, e o
 * defeito seria mudo.
 *
 * A validação é de **forma** e não diz nada sobre existência: um código bem formado que não
 * corresponda a cobrança alcançável segue produzindo `404`. Quando ele chega pelo caminho da rota, o
 * nome do campo (`codigo`) é aposto pela borda — `validar(esquema, valor, 'codigo')` —, porque o
 * esquema é escalar e o Zod não tem caminho a reportar; dentro de {@link esquemaDaCobranca} o campo
 * já se nomeia sozinho.
 */
export const ESQUEMA_DO_CODIGO_DE_COBRANCA = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(EXPRESSAO_DO_CODIGO_DE_COBRANCA));

/** O código da cobrança, já canonizado. */
export type CodigoDeCobranca = z.infer<typeof ESQUEMA_DO_CODIGO_DE_COBRANCA>;

/**
 * Casa a competência que é o **primeiro dia do mês**.
 *
 * A conferência corre sobre o texto, e não sobre um `Date`, porque a competência viaja como
 * `YYYY-MM-DD` da consulta ao JSON e nunca passa por `Date` com fuso (§6.2): construir um `Date`
 * aqui reintroduziria exatamente o deslocamento de dia que a projeção por `to_char` existe para
 * evitar. `z.iso.date()` já garante a forma e a validade de calendário antes desta expressão correr,
 * de modo que os dois últimos dígitos **são** o dia.
 *
 * ---------------------------------------------------------------------------
 * Ela é EXPORTADA para o módulo irmão, e não publicada pelo barril
 * ---------------------------------------------------------------------------
 *
 * `esquemaDaCompetencia`, em `cobranca-bancaria.ts`, exige a **mesma** propriedade sobre o mesmo
 * fato: a competência que o Admin informa ao abrir a emissão em lote é a mesma que a cobrança
 * carrega. Redigitar `/-01$/` lá criaria a segunda fonte do mesmo fato que a ADR-0016 elimina — duas
 * expressões livres para divergir no dia em que a regra mudar, sem nada que acuse.
 *
 * Ela **não** entra em `index.ts`: é composição interna do contrato, como `camposDeEndereco` em
 * `comum.ts`, e publicá-la daria ao consumidor de fora uma expressão crua para conferir por conta
 * própria o que os dois esquemas já conferem.
 */
export const COMPETENCIA_NO_PRIMEIRO_DIA = /-01$/;

/**
 * Corpo fechado do lançamento de cobrança avulsa (§4.1.1) — **seis** campos.
 *
 * Completo e sem campo opcional, porque **não há atualização parcial nesta superfície**. Campo
 * ausente é recusa por campo obrigatório, nunca "preserve o valor atual" — é a mesma decisão da
 * fatia de contratos, e é ela que impede o defeito do `PUT` parcial que copia `required` do `POST`.
 *
 * `contratoCodigo` passa pelo {@link ESQUEMA_DO_CODIGO_DE_CONTRATO} **importado**: é a chave exposta
 * do contrato (ADR-0017), e redigitar a forma aqui criaria a segunda fonte do mesmo fato. O
 * `locatarioId` **não** aparece — ele é derivado da junção com o contrato, e é essa derivação que
 * torna estruturalmente impossível a incoerência que a dupla chave estrangeira do legado permite.
 *
 * A conferência da competência é **do objeto**, com `path` explícito, e não do campo: é a mesma
 * forma de `esquemaDeContratoNovo`, e o `path` é o que impede a recusa de chegar ao cliente sem nome
 * de campo — a §6.1 manda `422 CAMPO_INVALIDO` nomeando `competencia`.
 */
export const esquemaDeCobrancaNova = z
  .strictObject({
    contratoCodigo: ESQUEMA_DO_CODIGO_DE_CONTRATO,
    natureza: z.enum(NATUREZAS_DE_COBRANCA),
    referencia: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
    // Data de calendário, e não instante: a coluna é `date` e o valor viaja como `YYYY-MM-DD`
    // (§6.2). `z.iso.date()` recusa `2026-02-30` e recusa a forma com hora — as duas coisas que um
    // `regex` ingênuo deixaria passar.
    competencia: z.iso.date(),
    dataVencimento: z.iso.date(),
    valorOriginal: z.number().gt(0).max(MAIOR_VALOR_MONETARIO).multipleOf(ESCALA_MONETARIA),
  })
  .refine(({ competencia }) => COMPETENCIA_NO_PRIMEIRO_DIA.test(competencia), {
    path: ['competencia'],
    message: 'a competência precisa ser o primeiro dia do mês',
  });

/** O corpo aceito no lançamento de cobrança avulsa. */
export type CobrancaNova = z.infer<typeof esquemaDeCobrancaNova>;

/**
 * Corpo fechado de `POST /v1/cobrancas/:codigo/pagamento` — **dois** campos.
 *
 * `valorPago` repete as três restrições de `valorOriginal`, e não uma versão frouxa delas: é o mesmo
 * `numeric(15,2)`, e um teto menor aqui deixaria o `INSERT` estourar por um caminho que o outro já
 * fecha. Multa e juros **não entram no corpo**: são carimbados pelo servidor a partir da
 * configuração vigente no instante do ato (ADR-0022), e aceitá-los daria ao cliente o poder de
 * escrever o próprio recibo.
 */
export const esquemaDoPagamentoDeCobranca = z.strictObject({
  pagoEm: z.iso.date(),
  valorPago: z.number().gt(0).max(MAIOR_VALOR_MONETARIO).multipleOf(ESCALA_MONETARIA),
});

/** O corpo aceito ao acusar o pagamento de uma cobrança. */
export type PagamentoDeCobranca = z.infer<typeof esquemaDoPagamentoDeCobranca>;

/**
 * A janela de `GET /v1/cobrancas` — a janela comum **mais** os três filtros da carteira.
 *
 * Ela é derivada de {@link esquemaDaJanela} e nunca redigitada (ADR-0016): o teto que recusa em vez
 * de truncar, e o padrão da página, são fatos do contrato que existem num lugar só. Os três filtros
 * nascem **no esquema**, e não numa conferência escrita no controlador, pela mesma ADR — é o que faz
 * `status` e `natureza` fora da união fechada serem `422` na borda, e não uma consulta que devolve
 * lista vazia sobre um rótulo que não existe.
 *
 * Os três são opcionais porque a carteira inteira é a leitura padrão; ausência é *sem filtro*, e não
 * um valor implícito.
 */
export const esquemaDaJanelaDeCobrancas = esquemaDaJanela.extend({
  contrato: ESQUEMA_DO_CODIGO_DE_CONTRATO.optional(),
  status: z.enum(ESTADOS_DA_COBRANCA).optional(),
  natureza: z.enum(NATUREZAS_DE_COBRANCA).optional(),
});

/** A janela da carteira de cobranças, com os padrões já aplicados. */
export type JanelaDeCobrancas = z.infer<typeof esquemaDaJanelaDeCobrancas>;

/**
 * A cobrança como a API a devolve (§4.1.1) — **vinte e três** campos.
 *
 * **Não tem `id`**, e a ausência é a decisão: a chave exposta é o `codigo`, porque a cobrança tem
 * série declarada (ADR-0017). O UUID interno não trafega.
 *
 * `contratoCodigo` e `locatarioId` convivem com classes de chave **diferentes**, e a assimetria é a
 * mesma da ADR-0017 já aplicada em `esquemaDoContratoVigente`: contrato tem série, logo código;
 * locatário não tem, logo UUID. Uniformizá-las publicaria, para uma das duas, um identificador que
 * nenhuma rota aceita.
 *
 * Os cinco anuláveis são os do **desfecho**: `pagoEm`, `valorPago`, `multaPercentualAplicado` e
 * `jurosPercentualAplicado` andam juntos (o `check` do banco os pareia com o pagamento), e
 * `canceladoEm` é o outro desfecho, mutuamente exclusivo. `null` neles quer dizer *cobrança ainda
 * aberta*.
 *
 * As grandezas monetárias saem **sem restrição de escala**, de propósito — ver o cabeçalho deste
 * arquivo e o marcador `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`, em `comum.ts`.
 *
 * ---------------------------------------------------------------------------
 * Os CINCO últimos são a conciliação bancária, e nenhum deles fala o vocabulário do provedor
 * ---------------------------------------------------------------------------
 *
 * O cabeçalho deste arquivo dizia que *"os seis campos de conciliação bancária não aparecem em
 * esquema nenhum: eles nascem como colunas nulas e só a F4 os publica"* — e a fatia
 * `emissao-e-conciliacao` é exatamente aquela F4. **Cinco** deles chegam agora
 * (`numeroDoTituloNoProvedor`, `linhaDigitavel`, `codigoDeBarras`, `dataDoCredito`,
 * `valorCreditado`); o sexto, `boletoArquivo`, **não é publicado** — são bytes, e a rota que os
 * entrega declara mídia em vez de campo (ADR-0028).
 *
 * A chave publicada é **`numeroDoTituloNoProvedor`, jamais `nossoNumero`**, e a diferença não é
 * estética: *nosso número* é vocabulário **do provedor**, a ADR-0001 fixa que nenhum dele cruza o que
 * o produto publica, e o glossário global o lista entre os termos a evitar. Publicar o nome do
 * provedor faria a varredura de vocabulário canônico reprovar a própria fatia que o campo entrega.
 *
 * ⚠️ **A coluna física TAMBÉM já se chama `numero_do_titulo_no_provedor`.** Este parágrafo dizia que
 * ela *"continua `nosso_numero`"*, porque renomeá-la estaria fora do escopo do PRD daquela fatia —
 * texto verdadeiro até a `0019` (T2 da fatia `webhook-e-carne`), que fechou o `D14 · F4/T6` com o
 * `RENAME COLUMN` na tabela e na visão `negocio.cobranca_derivada`. Hoje o nome é o mesmo dos dois
 * lados, e a tradução que o mapeamento do Drizzle faz é só a de caixa (snake_case → camelCase).
 *
 * **`identificadorNoProvedor` não existe aqui, e a ausência é a decisão.** São dois identificadores
 * de sentidos opostos: o *Identificador perante o provedor* (18 posições) é **composto pelo produto**,
 * vive na coluna `identificador_no_provedor` e é a chave de correlação interna da fatia do carnê; o
 * `numeroDoTituloNoProvedor` é **atribuído pelo provedor** e é o único dos dois que se publica.
 *
 * Os cinco são **anuláveis, e não opcionais**: `null` quer dizer *cobrança sem boleto emitido* (ou,
 * nos dois últimos, *emitido e ainda não creditado*), que é estado legítimo e frequente. Eles também
 * **não são pareados por `check` no banco** — `dataDoCredito` e `valorCreditado` nascem depois dos
 * três primeiros, de modo que um bicondicional recusaria o estado *emitido e ainda não pago*.
 */
export const esquemaDaCobranca = z.object({
  codigo: ESQUEMA_DO_CODIGO_DE_COBRANCA,
  contratoCodigo: ESQUEMA_DO_CODIGO_DE_CONTRATO,
  locatarioId: z.uuid(),
  natureza: z.enum(NATUREZAS_DE_COBRANCA),
  referencia: z.string(),
  competencia: z.iso.date(),
  dataVencimento: z.iso.date(),
  valorOriginal: z.number(),
  status: z.enum(ESTADOS_DA_COBRANCA),
  diasAtraso: z.number().int(),
  valorMulta: z.number(),
  valorJuros: z.number(),
  valorTotal: z.number(),
  pagoEm: z.iso.date().nullable(),
  valorPago: z.number().nullable(),
  canceladoEm: z.iso.datetime().nullable(),
  multaPercentualAplicado: z.number().nullable(),
  jurosPercentualAplicado: z.number().nullable(),
  // O identificador que o PROVEDOR atribui ao boleto e devolve — não o que o produto compõe e envia.
  // Chega como inteiro no dialeto do provedor e é coagido para cadeia na fronteira do adaptador, de
  // modo que aqui ele já é texto.
  numeroDoTituloNoProvedor: z.string().nullable(),
  linhaDigitavel: z.string().nullable(),
  codigoDeBarras: z.string().nullable(),
  // Data de calendário, e não instante: a coluna é `date` e o valor viaja como `YYYY-MM-DD` (§6.2),
  // exatamente como `competencia` e `dataVencimento` acima.
  dataDoCredito: z.iso.date().nullable(),
  // Sem escala, como as demais grandezas monetárias desta SAÍDA — ver o parágrafo do docblock e o
  // marcador `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`, em `comum.ts`.
  valorCreditado: z.number().nullable(),
});

/** A cobrança como a API a devolve. */
export type Cobranca = z.infer<typeof esquemaDaCobranca>;
