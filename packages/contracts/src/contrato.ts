/**
 * O contrato do **contrato de locação** — a primeira entidade do produto com **série declarada** e
 * com **ciclo de vida governado**.
 *
 * ===========================================================================
 * Por que o enum de estado nasce aqui, e não em `packages/db`
 * ===========================================================================
 *
 * `negocio.status_contrato` é enum do banco, e é justamente por isso que a direção importa.
 * Declarado lá, este pacote precisaria importar `@sysloc/db` para falar de estado, e o contrato
 * deixaria de ser folha: o frontend, ao importar os tipos no marco de entrega, arrastaria a camada
 * de dados junto. Declarado aqui, `packages/db` o consome na direção inversa, que não custa nada —
 * o servidor já depende de tudo. É a mesma razão, e a mesma forma, de `TIPOS_DE_IMOVEL` em
 * `imovel.ts`: `as const` fecha a união em **compilação**, `Object.freeze` fecha o arranjo em
 * **execução**.
 *
 * É também o que fixa a ordem T2 → T3: a T3 deriva o enum do banco destes literais e, se a ordem se
 * invertesse, redigitaria os quatro — a segunda fonte do mesmo fato que a ADR-0016 elimina.
 *
 * ===========================================================================
 * A chave exposta é o CÓDIGO, e o UUID interno não trafega
 * ===========================================================================
 *
 * A ADR-0017 é literal: a chave exposta é o código textual legível **quando a entidade tem série
 * declarada** — hoje contrato e cobrança. Por isso {@link esquemaDoContrato} **não tem `id`**: o
 * UUID permanece chave interna, e publicá-lo daria ao consumidor dois identificadores para a mesma
 * coisa, um dos quais nenhuma rota aceita.
 *
 * ===========================================================================
 * `status` não é campo de atualização — e a ausência é o mecanismo
 * ===========================================================================
 *
 * A ADR-0021 fixa que toda transição de estado é **rota própria**, nunca campo gravado por
 * atualização do recurso. Aqui isso não é uma verificação: é a **ausência** de `status` no
 * {@link esquemaDeContratoNovo}, que o `strictObject` transforma em recusa por chave desconhecida.
 * O mesmo vale para `codigo`, `dataFimLocacao`, `valorTotalContrato` e `empresaId` — os cinco são
 * decididos pelo servidor, e aceitá-los seria a segunda fonte de estado que a RN-03 elimina.
 *
 * `ENCERRADO` fica no enum **sem produtor nesta fatia** (a rotina agendada é da F5), no mesmo padrão
 * com que a fatia anterior reservou `LOCADO`. E `RESCINDIDO`, que existe no sistema antigo, é
 * **podado**: zero caminhos de escrita no app legado inteiro.
 */

import { z } from 'zod';
// `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` nasceram neste arquivo e subiram para `comum.ts` na
// fatia `emissao-e-conciliacao`, ao chegar o terceiro consumidor monetário do pacote — é o gatilho
// que o débito `D1 · F3/T2` escrevera, e o limiar de três do `CLAUDE.md`. A definição segue **única**
// (CT-545 a afirma por igualdade de lista); o que mudou foi o arquivo, e quem as quer as importa.
import {
  ESCALA_MONETARIA,
  ESQUEMA_DO_IDENTIFICADOR,
  esquemaDaJanelaComCirculacao,
  MAIOR_VALOR_MONETARIO,
} from './comum.js';

/**
 * Os quatro estados do contrato (RD-02), na ordem em que o enum do banco os declara.
 *
 * A ordem é conteúdo, e não estética: a T3 deriva `negocio.status_contrato` deste arranjo, e um enum
 * do PostgreSQL guarda a ordem dos rótulos (é ela que governa comparação e ordenação do tipo).
 */
export const ESTADOS_DO_CONTRATO = Object.freeze([
  'RASCUNHO',
  'ATIVO',
  'CANCELADO',
  'ENCERRADO',
] as const);

/** União fechada dos estados do contrato. */
export type EstadoDoContrato = (typeof ESTADOS_DO_CONTRATO)[number];

/** O prefixo da série do contrato — o `CTR` de `CTR-2026-00001` (RN-04). */
export const PREFIXO_DO_CODIGO_DE_CONTRATO = 'CTR';

/**
 * Quantos dígitos o ano ocupa no código.
 *
 * Não é exportada porque não é decisão que o consumidor precise conhecer — o ano de quatro dígitos é
 * o mesmo em toda série concebível. Ela existe para que o formatador e a expressão abaixo saiam da
 * **mesma** declaração: redigitar `\d{4}` na expressão deixaria as duas livres para divergir, que é
 * exatamente o defeito que a fonte única existe para fechar.
 */
const LARGURA_DO_ANO_NO_CODIGO = 4;

// DECISÃO FECHADA — F2/fatia 2 · 2026-08-08
// O QUÊ: a largura do sequencial é CINCO dígitos (`CTR-2026-00001`).
// POR QUÊ: é o valor MEDIDO no sistema antigo (`autoname` = `CTR-.YYYY.-.#####`, série viva em 20).
//          O `plano-execucao.md` §F2, o `CLAUDE.md` e o briefing da fase escrevem QUATRO; a
//          divergência é conhecida e a correção daqueles textos não pertence a esta fatia. O código
//          legível é o TÍTULO do contrato nas telas e o rótulo dos seletores do Financeiro — mudar a
//          largura muda o que o usuário reconhece.
// REVERTER EXIGE: medir de novo o `autoname` no sistema antigo (ou, depois da virada, provar que
//                 nenhum código de cinco dígitos foi emitido nem citado fora do sistema).
export const LARGURA_DO_SEQUENCIAL_DE_CONTRATO = 5;

/**
 * A forma do código, construída a partir das constantes acima — **nunca redigitada**.
 *
 * Não é exportada: quem precisa conferir um código usa {@link ESQUEMA_DO_CODIGO_DE_CONTRATO}, que é
 * o ponto único de canonização. Publicar a expressão crua convidaria a uma segunda conferência sem
 * o `trim`/`toUpperCase`, e é a repetição — não a expressão — que reabriria a divergência de caixa.
 */
const EXPRESSAO_DO_CODIGO_DE_CONTRATO = new RegExp(
  `^${PREFIXO_DO_CODIGO_DE_CONTRATO}-\\d{${LARGURA_DO_ANO_NO_CODIGO}}-\\d{${LARGURA_DO_SEQUENCIAL_DE_CONTRATO}}$`,
);

/**
 * Monta o código legível a partir do ano e do número emitido pela série (ADR-0015, ADR-0020).
 *
 * Formatador e esquema saem das **mesmas** constantes, e isso é o que impede a divergência muda em
 * que a emissão produz um código que a rota de leitura recusa.
 *
 * ---------------------------------------------------------------------------
 * O formatador PREENCHE até a largura, e não TRUNCA além dela — a assimetria é deliberada
 * ---------------------------------------------------------------------------
 *
 * `padStart` completa com zeros até cinco dígitos e **deixa crescer** quando o sequencial passa de
 * `99 999`: `formatarCodigoDeContrato(2026, 123456)` devolve `CTR-2026-123456`. Truncar produziria
 * **colisão** — dois contratos com o mesmo código —, e a restrição `unique (empresa_id, codigo)`
 * recusaria a segunda gravação sobre um número que a série já consumiu e nunca reusa.
 *
 * {@link ESQUEMA_DO_CODIGO_DE_CONTRATO}, por outro lado, aceita **exatamente** a largura declarada:
 * é o formato publicado, e é ele que a rede do marcador acima precisa prender pelos dois lados —
 * quatro dígitos recusados **e** seis recusados, porque um esquema aberto em `\d{5,}` deixaria a
 * largura sem asserção pelo lado de cima.
 *
 * A consequência conhecida: acima de `99 999` contratos **da mesma empresa no mesmo ano**, a emissão
 * produziria um código que a leitura recusa. A série viva do sistema antigo está em 20, e o escopo
 * do contador é `(empresa, ano)` — a condição é inalcançável na operação, e o furo, se um dia
 * chegar, aparece como recusa ruidosa em vez de colisão silenciosa. Ver Pendências da T2.
 */
export function formatarCodigoDeContrato(ano: number, sequencial: number): string {
  const anoEmTexto = String(ano).padStart(LARGURA_DO_ANO_NO_CODIGO, '0');
  const sequencialEmTexto = String(sequencial).padStart(LARGURA_DO_SEQUENCIAL_DE_CONTRATO, '0');

  return `${PREFIXO_DO_CODIGO_DE_CONTRATO}-${anoEmTexto}-${sequencialEmTexto}`;
}

/**
 * O código do contrato, **na forma canônica** — o ponto único de normalização (RN-04).
 *
 * `trim` → `toUpperCase` → forma. A caixa é imposta **aqui** pela mesma razão medida que produziu a
 * canonização do UUID em `comum.ts`: o código é a chave exposta, viaja no caminho da URL e é
 * comparado com o valor gravado. Um `ctr-2026-00001` citado em minúsculas responderia `false` sobre
 * o mesmo contrato, e o defeito seria mudo — `404` sobre um registro que existe.
 *
 * A validação é de **forma** e não diz nada sobre existência: um código bem formado que não
 * corresponda a contrato alcançável segue produzindo `404`. Quando ele chega pelo caminho da rota, o
 * nome do campo (`codigo`) é aposto pela borda — `validar(esquema, valor, 'codigo')` —, porque o
 * esquema é escalar e o Zod não tem caminho a reportar; dentro de {@link esquemaDoContrato} o campo
 * já se nomeia sozinho.
 */
export const ESQUEMA_DO_CODIGO_DE_CONTRATO = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(EXPRESSAO_DO_CODIGO_DE_CONTRATO));

/** O código do contrato, já canonizado. */
export type CodigoDeContrato = z.infer<typeof ESQUEMA_DO_CODIGO_DE_CONTRATO>;

/** Quantos centavos há numa unidade monetária — o fator da aritmética exata abaixo. */
const CENTAVOS_POR_UNIDADE = 100;

/** O valor em centavos inteiros, sem resíduo binário. */
function emCentavos(valor: number): number {
  return Math.round(valor * CENTAVOS_POR_UNIDADE);
}

/**
 * Maior valor que a coluna `integer` do PostgreSQL representa — `2^31 − 1`.
 *
 * `prazo_meses` é `integer` (§7.2), e não `numeric`: o prazo tem, portanto, **dois** limites a
 * jusante, e o teto do contrato é o menor deles.
 */
const MAIOR_INTEIRO_DE_QUATRO_BYTES = 2_147_483_647;

/**
 * Maior prazo aceito, em meses — **derivado**, nunca escolhido.
 *
 * O prazo é fator de `valorTotalContrato = valorMensal × prazoMeses`, que a ativação grava em
 * `numeric(15,2)`. Ele é limitado por duas capacidades de coluna, e o teto é o **mínimo** das duas:
 *
 * 1. a da própria coluna `prazo_meses`, que é `integer`;
 * 2. a do produto: acima de `MAIOR_VALOR_MONETARIO / ESCALA_MONETARIA` meses, **nenhum** valor
 *    mensal representável produz um total que caiba na coluna — o domínio esvazia, e aceitar o
 *    prazo seria aprovar um contrato que nenhuma ativação conseguiria derivar.
 *
 * Escrevê-lo como número mágico separaria as duas grandezas e deixaria a garantia dependendo de
 * aritmética mental. A divisão corre em **centavos inteiros** pelo mesmo motivo de
 * `derivarValorTotal` (§6.2): dividir em ponto flutuante perto do teto da coluna rende resíduo.
 *
 * O teto do campo, sozinho, **não** garante que o produto caiba — para isso é preciso olhar o par, e
 * é o que a conferência conjunta de {@link esquemaDeContratoNovo} faz.
 */
export const MAIOR_PRAZO_EM_MESES = Math.min(
  MAIOR_INTEIRO_DE_QUATRO_BYTES,
  Math.floor(emCentavos(MAIOR_VALOR_MONETARIO) / emCentavos(ESCALA_MONETARIA)),
);

/** Menor e maior dia de vencimento aceitos (RD-08), replicados no `check` do banco pela T3. */
const MENOR_DIA_DE_VENCIMENTO = 1;
const MAIOR_DIA_DE_VENCIMENTO = 28;

/** Menor prazo aceito — o `prazo_meses > 0` que a RD-08 impõe também no `check` do banco. */
const MENOR_PRAZO_EM_MESES = 1;

/**
 * Corpo fechado da montagem e da alteração do contrato (§4.1.1).
 *
 * Completo e sem campo opcional: as duas rotas carregam os **mesmos dez campos**, porque **não há
 * atualização parcial nesta superfície**. Campo ausente é recusa por campo obrigatório, nunca
 * "preserve o valor atual" — e isso vale para os fiadores também: a coleção é substituída por
 * inteiro.
 *
 * Os três identificadores e cada item de `fiadoresIds` passam pelo `ESQUEMA_DO_IDENTIFICADOR`
 * **importado** de `comum.ts`: eles viram chave estrangeira composta e são comparados com valor lido
 * do banco, que é exatamente o cenário em que as duas pontas concordam sobre a identidade e
 * discordam sobre a grafia. Redigitar a canonização aqui criaria a terceira definição do mesmo fato.
 *
 * `fiadoresIds` **recusa repetição na borda**, além da restrição `unique (contrato_id, fiador_id)`
 * que a T3 cria: a restrição recusaria de qualquer jeito, mas a recusa do banco chegaria **sem nome
 * de campo**, e o cliente não saberia qual dos dez corrigir. A conferência corre sobre os valores já
 * canonizados, de modo que o mesmo fiador citado em duas grafias de caixa é uma repetição — que é o
 * que a restrição do banco também enxergará.
 *
 * `empresaId`, `codigo`, `status`, `dataFimLocacao` e `valorTotalContrato` **não aparecem**. Ver o
 * cabeçalho deste arquivo: a ausência é o mecanismo, e o `strictObject` a converte em recusa.
 */
export const esquemaDeContratoNovo = z
  .strictObject({
    imovelId: ESQUEMA_DO_IDENTIFICADOR,
    locadorId: ESQUEMA_DO_IDENTIFICADOR,
    locatarioId: ESQUEMA_DO_IDENTIFICADOR,
    fiadoresIds: z
      .array(ESQUEMA_DO_IDENTIFICADOR)
      .refine((identificadores) => new Set(identificadores).size === identificadores.length, {
        message: 'o mesmo fiador não pode ser informado duas vezes',
      }),
    // Data de calendário, e não instante: a coluna é `date` e o valor viaja como `YYYY-MM-DD` da
    // consulta até o JSON, sem passar por `Date` com fuso (§6.2). `z.iso.date()` recusa `2026-02-30`
    // e recusa a forma com hora — as duas coisas que um `regex` ingênuo deixaria passar.
    dataInicioLocacao: z.iso.date(),
    prazoMeses: z.number().int().min(MENOR_PRAZO_EM_MESES).max(MAIOR_PRAZO_EM_MESES),
    valorMensal: z.number().gt(0).max(MAIOR_VALOR_MONETARIO).multipleOf(ESCALA_MONETARIA),
    diaVencimento: z.number().int().min(MENOR_DIA_DE_VENCIMENTO).max(MAIOR_DIA_DE_VENCIMENTO),
    gerarCobrancasAutomaticamente: z.boolean().default(true),
    // `pdfContratoArquivo` SAIU daqui, e a ausência é o mecanismo: o `strictObject` acima converte
    // a chave removida em recusa `unrecognized_keys`, de modo que o cliente que ainda a enviar
    // recebe `422` nomeando o campo — nunca um aceite silencioso que grave em lugar nenhum. Ver o
    // cabeçalho de `esquemaDoContrato` para a razão (ADR-0030), e o `CT-713` para a prova.
  })
  // A conferência é CONJUNTA porque a restrição é conjunta: `MAIOR_VALOR_MONETARIO` e
  // `MAIOR_PRAZO_EM_MESES` limitam cada fator, e nenhum teto de campo isolado impede que o PRODUTO
  // estoure a coluna — `9_999_999_999_999.99 × 12` cabe nos dois tetos e não cabe em `numeric(15,2)`.
  // Sem ela, a ativação levantaria `numeric field overflow` (22003) e a borda devolveria **500** por
  // entrada malformada de cliente, que é exatamente o defeito que `MAIOR_METRAGEM` fechou na fatia
  // anterior. O campo nomeado é `prazoMeses`: `valorMensal` é o termo do negócio e o prazo é o que o
  // cliente encurta para caber.
  .refine(
    ({ valorMensal, prazoMeses }) =>
      emCentavos(valorMensal) * prazoMeses <= emCentavos(MAIOR_VALOR_MONETARIO),
    {
      path: ['prazoMeses'],
      message: 'o valor total do contrato excede o máximo representável',
    },
  );

/** O corpo aceito na montagem e na alteração do contrato. */
export type ContratoNovo = z.infer<typeof esquemaDeContratoNovo>;

/**
 * O contrato como a API o devolve (§4.1.1).
 *
 * **Não tem `id`**, e a ausência é a decisão: a chave exposta é o `codigo`, porque o contrato tem
 * série declarada (ADR-0017). O UUID interno não trafega.
 *
 * `dataFimLocacao` e `valorTotalContrato` são **anuláveis** porque são derivados na ativação (RD-10):
 * o contrato nasce `RASCUNHO` com os dois nulos, e declará-los obrigatórios obrigaria a criação a
 * inventar valores que só a ativação decide.
 *
 * `fiadores` publica o par `{ id, nome }` — e não os identificadores crus de `fiadoresIds` —, porque
 * é o nome que a tela exibe; devolver só o UUID obrigaria o cliente a uma segunda chamada por
 * fiador. Aqui o UUID trafega legitimamente: fiador é entidade **sem** série declarada, e a ADR-0017
 * lhe dá o UUID como chave exposta.
 *
 * As grandezas monetárias saem **sem restrição de escala**, de propósito — ver
 * {@link ESCALA_MONETARIA}.
 *
 * ---------------------------------------------------------------------------
 * `pdfContratoArquivo` SAIU das duas superfícies, e é mudança incompatível deliberada
 * ---------------------------------------------------------------------------
 *
 * Ele deixou de ser aceito na entrada e de ser devolvido na saída, junto com a coluna
 * `negocio.contrato.pdf_contrato_arquivo` que a migração `0013` removeu. A razão é a **ADR-0030**: o
 * documento do contrato é composto no instante do pedido e nunca armazenado, de modo que não existe
 * caminho de escrita dele — e um campo que publicasse o caminho de um arquivo que não é gravado
 * mentiria sobre o que o produto guarda.
 *
 * É a **única mudança incompatível deliberada** do produto até aqui, e ela é declarada nas três
 * pontas: a coluna (medida por introspecção no `CT-712`), a entrada (recusa `unrecognized_keys` no
 * `CT-713`) e a resposta real da rota (`CT-714`). Reintroduzi-lo aqui "por compatibilidade" faria o
 * contrato publicar um campo que nenhuma coluna alimenta.
 */
export const esquemaDoContrato = z.object({
  codigo: ESQUEMA_DO_CODIGO_DE_CONTRATO,
  status: z.enum(ESTADOS_DO_CONTRATO),
  imovelId: z.uuid(),
  locadorId: z.uuid(),
  locatarioId: z.uuid(),
  fiadores: z.array(z.object({ id: z.uuid(), nome: z.string() })),
  dataInicioLocacao: z.iso.date(),
  prazoMeses: z.number().int(),
  valorMensal: z.number(),
  diaVencimento: z.number().int(),
  dataFimLocacao: z.iso.date().nullable(),
  valorTotalContrato: z.number().nullable(),
  gerarCobrancasAutomaticamente: z.boolean(),
  retiradoEm: z.iso.datetime().nullable(),
});

/** O contrato como a API o devolve. */
export type Contrato = z.infer<typeof esquemaDoContrato>;

/**
 * O contrato **como a carteira o lista** — o recurso inteiro mais os **três nomes de exibição**.
 *
 * ---------------------------------------------------------------------------
 * Por que ele ESTENDE {@link esquemaDoContrato}, em vez de ser um segundo esquema
 * ---------------------------------------------------------------------------
 *
 * Os catorze campos do contrato existem **num lugar só** (ADR-0016): esta forma é a de cima mais
 * três, e não uma segunda escrita da mesma coisa. Redigitá-los criaria duas fontes livres para
 * divergir no dia em que o contrato ganhar um campo — e a que divergiria primeiro é justamente a
 * lista de campos que o cliente vê. Mesmo desenho, e mesma razão, de `esquemaDoConjuntoComImoveis`
 * em {@link ./conjunto.js} e de {@link esquemaDaAtivacaoDeContrato} logo abaixo.
 *
 * ---------------------------------------------------------------------------
 * Por que os três nomes existem, e por que eles NÃO substituem os identificadores
 * ---------------------------------------------------------------------------
 *
 * O item da carteira é um **cartão**: quem lê a lista precisa do nome do imóvel e das duas partes
 * para reconhecer o contrato, e sem eles o cliente teria de pedir três recursos por linha da
 * página — o padrão N+1 do lado de fora, que a paginação existe para impedir.
 *
 * `imovelId`, `locadorId` e `locatarioId` **continuam** no corpo, e a coexistência é a decisão: o
 * identificador é o que se usa para **navegar** (é ele que as rotas aceitam), e o nome é o que se
 * usa para **exibir**. Trocar um pelo outro faria o cartão deixar de ter para onde clicar.
 *
 * ---------------------------------------------------------------------------
 * Os nomes são do CADASTRO CORRENTE, e não uma cópia gravada no contrato
 * ---------------------------------------------------------------------------
 *
 * Eles são lidos das três tabelas de cadastro no instante da consulta, e não gravados na linha do
 * contrato. A consequência é conteúdo e o consumidor precisa dela: renomeado o imóvel, **toda** a
 * carteira passa a exibir o nome novo, inclusive nos contratos encerrados. Guardar o nome de então
 * seria outra decisão — a de registrar o cadastro *como estava* —, que ninguém tomou e que a
 * ADR-0014 não pede: o cadastro retirado de circulação continua alcançável e continua nomeando o
 * contrato que o cita.
 *
 * ⚠️ **Eles vivem SÓ na listagem.** `GET /v1/contratos/:codigo` e as respostas dos atos
 * (`POST`, `PUT`, ativação, cancelamento, circulação) devolvem {@link esquemaDoContrato}, sem os
 * três — a tela que lê um contrato por vez já tem os identificadores e pode pedir os cadastros que
 * for exibir. Levá-los às outras sete rotas é acréscimo (permitido pela ADR-0039), não correção:
 * quem o fizer paga a junção em **todo** ato de escrita, e nenhuma tela pediu isso.
 */
export const esquemaDoContratoNaCarteira = esquemaDoContrato.extend({
  /** O nome do imóvel locado, de `negocio.imovel.nome_imovel`. */
  nomeImovel: z.string(),
  /** O nome do locador, de `negocio.locador.nome`. */
  nomeLocador: z.string(),
  /** O nome do locatário, de `negocio.locatario.nome`. */
  nomeLocatario: z.string(),
});

/** O contrato como a **listagem** o devolve — o recurso mais os três nomes de exibição. */
export type ContratoNaCarteira = z.infer<typeof esquemaDoContratoNaCarteira>;

/**
 * A janela de `GET /v1/contratos` — a de circulação **mais** os recortes da carteira.
 *
 * Ela estende {@link esquemaDaJanelaComCirculacao} em vez de redeclarar os três parâmetros, de modo
 * que o teto que recusa, o padrão da página e a união fechada de `incluirRetirados` continuam tendo
 * **um** lugar (ADR-0016). Mesma forma, e mesma razão, de `esquemaDaJanelaDaCarteira` em
 * {@link ./conjunto.js}.
 *
 * ---------------------------------------------------------------------------
 * `status` é a união fechada dos QUATRO estados — um valor por requisição
 * ---------------------------------------------------------------------------
 *
 * O filtro nasce **no esquema**, e não numa conferência escrita no controlador: é o que faz
 * `?status=VIGENTE` (rótulo que não existe) responder `422` **nomeando o parâmetro**, em vez de
 * devolver a página vazia de um estado inventado — resposta que o cliente leria como *"não há
 * contrato ativo"*.
 *
 * Ele aceita **um** valor, e não uma lista: `?status=ATIVO&status=RASCUNHO` chega ao Zod como
 * arranjo e é recusado pela união. Lista múltipla é outro contrato — a forma de separador, a
 * duplicata e o conjunto vazio teriam de ser decididos —, e nenhuma tela pediu.
 *
 * ---------------------------------------------------------------------------
 * `fimDe` / `fimAte` recortam `dataFimLocacao`, e as duas pontas são INCLUSIVAS
 * ---------------------------------------------------------------------------
 *
 * O consumidor é *"quais contratos vencem nos próximos 30 dias"* — a pergunta da renovação. O eixo
 * é `data_fim_locacao`, que é **derivada na ativação** (RD-10) e **nula** enquanto o contrato é
 * rascunho: por isso o rascunho **não entra** em janela alguma, e a ausência não é omissão do
 * filtro, é a ausência do fato. Cada ponta vale sozinha, como na carteira de cobranças.
 *
 * A ordem é conferida aqui, e não no banco, pela razão que {@link ./cobranca.js} registra por
 * extenso: a janela invertida devolveria página vazia, indistinguível de *"não há contrato nesse
 * intervalo"*.
 *
 * ⚠️ **`JanelaDeContratos` é homônimo de um tipo de `@sysloc/db`**, que é a janela **da porta** —
 * limite e deslocamento, sem filtro nenhum. Os dois convivem como `JanelaDaCarteira` já convive
 * (`./conjunto.js` e a porta dos conjuntos), e nunca se encontram no mesmo `import`: a borda traduz
 * um no outro, e é ela a única que conhece os dois.
 */
export const esquemaDaJanelaDeContratos = esquemaDaJanelaComCirculacao
  .extend({
    status: z.enum(ESTADOS_DO_CONTRATO).optional(),
    fimDe: z.iso.date().optional(),
    fimAte: z.iso.date().optional(),
  })
  // Lexicográfica sobre o texto, e correta por construção: `YYYY-MM-DD` com largura fixa e zeros à
  // esquerda ordena como a data ordena.
  .refine(({ fimDe, fimAte }) => fimDe === undefined || fimAte === undefined || fimDe <= fimAte, {
    path: ['fimDe'],
    message: 'o início da janela de término não pode ser posterior ao fim',
  });

/** A janela da carteira de contratos, com os padrões já aplicados. */
export type JanelaDeContratos = z.infer<typeof esquemaDaJanelaDeContratos>;

/**
 * A resposta de `POST /v1/contratos/:codigo/ativacao` — o contrato **mais** a declaração de efeito.
 *
 * ---------------------------------------------------------------------------
 * `cobrancasGeradas` DEIXOU DE SER `z.literal(false)`, e o gatilho era esta fatia
 * ---------------------------------------------------------------------------
 *
 * Até a fatia `contratos-de-locacao` o campo era `z.literal(false)`: a ativação **não** gerava
 * cobrança (RD-12), e declarar o literal em vez de deixar o fato implícito obrigava a F3 a **tocar
 * este arquivo** para afrouxá-lo — a mudança aparece no diff, em vez de acontecer por omissão, que é
 * como um consumidor descobriria em produção que o significado da resposta mudou. Era o
 * débito **D28** da fatia `contratos-de-locacao` (F2/T7), e a T9 desta fatia é o gatilho dele: a ativação
 * passou a derivar as parcelas do contrato e a gravá-las **na mesma unidade de trabalho**, de modo
 * que o efeito a publicar deixou de ser *"não fiz"* e passou a ser **quantas** nasceram.
 *
 * O tipo é inteiro **não negativo** porque os dois extremos são resultado legítimo: `0` quando o
 * contrato declara `gerarCobrancasAutomaticamente: false` (RD-20), e `prazoMeses` nos demais casos.
 * Negativo e fracionário não têm leitura — uma contagem de linhas gravadas é sempre um inteiro ≥ 0 —,
 * e recusá-los aqui é o que impede a resposta de anunciar um efeito que o banco não pode ter
 * produzido.
 *
 * **O afrouxamento é só do tipo do campo.** `efeitos` continua `strictObject`, pela razão de sempre:
 * efeito inventado é erro de quem publica, e ignorá-lo faria a resposta descrever um efeito que
 * ninguém produziu.
 */
export const esquemaDaAtivacaoDeContrato = esquemaDoContrato.extend({
  efeitos: z.strictObject({ cobrancasGeradas: z.number().int().nonnegative() }),
});

/** A resposta da ativação do contrato. */
export type AtivacaoDeContrato = z.infer<typeof esquemaDaAtivacaoDeContrato>;
