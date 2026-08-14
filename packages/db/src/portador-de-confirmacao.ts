/**
 * O **portador de confirmação** de endereço de e-mail do locatário — emissão, invalidação, resolução
 * e consumo, na porta única do domínio.
 *
 * ---------------------------------------------------------------------------
 * POR QUE AS QUATRO OPERAÇÕES MORAM JUNTAS
 * ---------------------------------------------------------------------------
 *
 * Elas compartilham **um** invariante, e é ele que as reúne: o segredo é sorteado, o banco guarda
 * **apenas** o SHA-256 dele, e toda busca é **pelo derivado** — segredo nunca é comparado com
 * segredo (RN-11). Separá-las em quatro módulos poria o cálculo do derivado em quatro lugares
 * livres para divergir, e a divergência não faria barulho: apareceria como um link que nunca
 * resolve, meses depois.
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./contrato.ts} e {@link ./cadastro-de-pessoa.ts} já
 * registram, o SQL mora aqui e não no serviço que chama: a contenção da §11.2 é de **tipo** e não
 * alcança **texto de SQL**. Um serviço com o executor da unidade de trabalho em mãos escreve
 * `negocio.portador_de_confirmacao` numa cadeia sem importar nada de proibido, e o alcance à tabela
 * deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As quatro funções que tocam o banco **recebem** o executor (`tx`) de
 * quem já abriu a unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 * {@link resolverPortador} não abre exceção — ela invoca, pelo executor recebido, a função
 * `SECURITY DEFINER` que a migração `0014` criou.
 *
 * ---------------------------------------------------------------------------
 * O SEGREDO EM CLARO SAI DAQUI PARA O CHAMADOR, e a janela é irredutível
 * ---------------------------------------------------------------------------
 *
 * {@link emitirPortador} devolve o claro; o banco guarda só o derivado. **Sem o claro não há link**,
 * e nem este processo consegue reconstruí-lo depois — é exatamente a impossibilidade que a RN-11
 * exige. O que fecha a janela está declarado na §11.3 da tech spec: o claro nunca é gravado, é
 * **redigido** do registro estruturado (a chave `segredo` já está na lista de radicais de
 * `packages/shared/src/log.ts`) e vive em Redis apenas pelo tempo da tarefa.
 *
 * ---------------------------------------------------------------------------
 * NÃO EXISTE COMPARAÇÃO DE SEGREDO COM SEGREDO — a propriedade é ESTRUTURAL
 * ---------------------------------------------------------------------------
 *
 * *"A verificação não revela informação pelo tempo"* (RN-11) não é alcançada aqui por uma comparação
 * de tempo constante: é alcançada porque **não há comparação em memória alguma**. A resolução é uma
 * busca por índice único sobre o derivado (`portador_de_confirmacao_derivado_key`), cujo custo não
 * depende de quão parecido o candidato é do que está guardado. Onde algum dia sobrar comparação de
 * segredo em memória, ela usa `timingSafeEqual` — não é o caso de nenhuma linha deste arquivo.
 *
 * ---------------------------------------------------------------------------
 * O RELÓGIO É O DO BANCO (ADR-0026), e NENHUM literal de fuso entra
 * ---------------------------------------------------------------------------
 *
 * `expira_em`, `invalidado_em` e `consumido_em` saem de `pg_catalog.now()`, dentro da própria
 * instrução. **Nenhum `Date.now()` decide comportamento** neste arquivo — o único `Date` que aparece
 * é o que o driver devolve na leitura, que é transporte e não decisão.
 *
 * As três colunas são `timestamptz`, de modo que toda comparação é **absoluta** e não precisa de
 * literal de fuso. É por construção que este módulo **não** cria uma terceira declaração executável
 * do fuso da operação, e portanto **não agrava o D14 (F3/T5)**.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008), com UMA exceção declarada
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** A tabela nasce com RLS **forçada**
 * (`migracoes/0014_seguranca_confirmacao.sql`): a política decide o que cada leitura enxerga e o que
 * cada escrita pode gravar. Não há aqui um `WHERE empresa_id = …` — a defesa em profundidade que a
 * `Decision` da ADR-0008 rejeita por escrito.
 *
 * A exceção é {@link resolverPortador}, e ela é o oposto de um furo aberto: quem apresenta o segredo
 * **não tem sessão** (ADR-0027), de modo que não existe contexto a fixar antes da leitura — a empresa
 * é o **resultado** da resolução, não a entrada dela (ADR-0024). A travessia é feita por um caminho
 * **nominal e auditável**, declarado na migração: a função pertence a `sysloc_resolucao`, papel
 * `NOLOGIN` de propósito único alcançado por uma política própria. Ver o bloco 2 da `0014`.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** — nenhuma leitura deste arquivo o aplica, porque a tabela já tem política e um segundo
// caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a **escrita**, onde
// `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * Quantos bytes de fonte criptográfica compõem o segredo — **256 bits**.
 *
 * O número é conteúdo, e não um padrão escolhido por conforto: com 256 bits, a enumeração por força
 * bruta é impossível e a derivação cara (scrypt, argon2) é **desnecessária** — ela existe para
 * segredo de baixa entropia escolhido por gente, e o custo dela seria pago em toda apresentação. A
 * API já paga scrypt no caminho de senha, onde ele é devido (§11.3 da tech spec, decisão D6).
 *
 * ⚠️ Ele é o **par** do `{43}` de `EXPRESSAO_DO_SEGREDO`, em
 * `packages/contracts/src/confirmacao-de-email.ts`: 32 bytes em base64url dão exatamente 43
 * caracteres, sem enchimento. Os dois pontos não são amarrados por um símbolo compartilhado — e não
 * precisam ser: a divergência é **ruidosa**, não silenciosa (qualquer outro número de bytes produz
 * outro comprimento, o esquema recusa e toda confirmação morre em `422`), e o `CT-729` a fecha por
 * prova executável, conferindo o segredo gerado contra o próprio esquema publicado.
 */
const BYTES_DO_SEGREDO = 32;

/**
 * Por quanto tempo o portador resolve, como o banco lê o intervalo — **72 horas** (RN-13).
 *
 * A cadeia é constante deste módulo e viaja como **parâmetro vinculado** (`${…}::interval`), nunca
 * concatenada no texto da consulta. Ela dá nome ao prazo em vez de deixá-lo como número solto no
 * meio do SQL, e o cálculo continua sendo o do aceite: `pg_catalog.now() + interval '72 hours'`,
 * avaliado **pelo banco** (ADR-0026).
 */
const PRAZO_DE_VALIDADE = '72 hours';

/** O portador recém-emitido — o segredo em claro **só aqui**, e os dois instantes do banco. */
export interface PortadorEmitido {
  /**
   * O segredo em claro, base64url de 43 caracteres. **Não está no banco e não pode ser reobtido.**
   * Quem chama é responsável por entregá-lo ao titular e por não o registrar.
   */
  readonly segredo: string;
  /** Quando o portador nasceu — é o `reenviadoEm` que o contrato do reenvio publica. */
  readonly criadoEm: Date;
  /** Até quando ele resolve. */
  readonly expiraEm: Date;
}

/**
 * O que a função `SECURITY DEFINER` publica — e **nada além disso**.
 *
 * Três campos, e a escassez é a decisão: uma função que atravessa a política de linha é um furo
 * declarado, e o que ela publica é o que qualquer portador de segredo alcança **sem sessão**. Não
 * sai `derivado`, não sai `expira_em`, não sai coluna alguma do locatário além do identificador.
 * `consumidoEm` sai porque a borda precisa dele para responder `200` à reapresentação (RN-10) — e
 * ele é instante, não dado pessoal. O `CT-727` afirma esse conjunto por igualdade.
 */
export interface PortadorResolvido {
  /** A empresa **descoberta** pela resolução — a entrada do contexto que a borda vai fixar. */
  readonly empresaId: string;
  readonly locatarioId: string;
  /** Nulo enquanto o portador não foi consumido. Não nulo é a reapresentação da RN-10. */
  readonly consumidoEm: Date | null;
}

/** O efeito do consumo, quando ele acontece. A **ausência** dele é o outro resultado possível. */
export interface ConsumoDoPortador {
  readonly locatarioId: string;
  /** O instante gravado nas **duas** colunas, por ser a mesma transação — ver {@link consumirPortador}. */
  readonly confirmadoEm: Date;
}

/**
 * Sorteia um segredo novo — **256 bits de `node:crypto`**, transportados em base64url.
 *
 * `randomBytes` é o gerador criptográfico do runtime. **Nunca `Math.random`**: ele é um PRNG rápido
 * e previsível, e um segredo previsível torna a confirmação de endereço uma formalidade.
 *
 * base64url (`-` e `_` no lugar de `+` e `/`, sem `=`) é o que permite ao segredo viajar num link e
 * num corpo JSON sem escapamento. O comprimento resultante é **43 caracteres**, exatos.
 */
export function gerarSegredo(): string {
  return randomBytes(BYTES_DO_SEGREDO).toString('base64url');
}

/**
 * O derivado do segredo — **o ponto único** de derivação do produto.
 *
 * SHA-256 em hexadecimal, 64 caracteres. É este valor que a coluna `derivado` guarda, sob
 * `UNIQUE`, e é por ele que a resolução busca.
 *
 * Ele é **único** de propósito: a borda nunca deriva por conta própria. Duas derivações do mesmo
 * fato ficariam livres para divergir na primeira emenda — bastaria uma delas passar a `utf8` e a
 * outra a `latin1`, ou uma a `hex` e a outra a `base64url`, para que o link deixasse de resolver sem
 * que nada acusasse. A codificação de entrada é declarada (`utf8`) em vez de deixada ao padrão,
 * pela mesma razão.
 */
export function derivarSegredo(segredo: string): string {
  return createHash('sha256').update(segredo, 'utf8').digest('hex');
}

/**
 * Emite um portador para o locatário e devolve o **segredo em claro** ao chamador.
 *
 * ⚠️ **O segredo não é persistido em lugar nenhum.** A instrução grava
 * {@link derivarSegredo}`(segredo)`, e a coluna do claro **não existe** na tabela — a ausência é a
 * decisão, e é o que a CA-14 afirma. O `CT-729` a prova pelos dois lados: lendo a coluna do disco e
 * varrendo este arquivo atrás de uma escrita do claro.
 *
 * `expira_em` é calculado **pelo banco**, na própria instrução (ADR-0026). Um prazo calculado no
 * processo compararia dois relógios: o do Node, na emissão, e o do servidor, na resolução — e a
 * diferença entre eles apareceria como link que vence cedo ou tarde demais, sem nada que acusasse.
 *
 * **Ela não invalida os anteriores**, e a separação é deliberada: quem invalida é
 * {@link invalidarPortadoresDoLocatario}, chamada **antes** desta na mesma unidade de trabalho
 * (RN-09, §6 da tech spec). Fundi-las tornaria impossível emitir sem invalidar — o que hoje é
 * sempre o certo, mas é decisão da borda, não desta porta.
 */
export async function emitirPortador(
  tx: TransactionSql,
  locatarioId: string,
): Promise<PortadorEmitido> {
  const segredo = gerarSegredo();

  const [portador] = await tx<{ criadoEm: Date; expiraEm: Date }[]>`
    INSERT INTO negocio.portador_de_confirmacao (empresa_id, locatario_id, derivado, expira_em)
    VALUES (
      ${empresaDoContexto(tx)},
      ${locatarioId},
      ${derivarSegredo(segredo)},
      pg_catalog.now() + ${PRAZO_DE_VALIDADE}::interval
    )
    RETURNING criado_em AS "criadoEm", expira_em AS "expiraEm"
  `;

  if (portador === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um portador emitido.
    throw new Error('o portador de confirmação foi gravado e a linha não voltou do INSERT');
  }

  return { segredo, criadoEm: portador.criadoEm, expiraEm: portador.expiraEm };
}

/**
 * Invalida os portadores **vivos** do locatário e devolve quantos foram alcançados (RN-09).
 *
 * *Vivo* aqui é `invalidado_em IS NULL`, e nada mais. O predicado **não** exclui o vencido nem o
 * consumido, e a inclusão não muda comportamento: o vencido já não resolve pelo prazo, e o
 * consumido, ao ser invalidado por um reenvio explícito, deixa de resolver por decisão de quem
 * reenviou — que é literalmente o que a RN-09 manda acontecer com *os anteriores*.
 *
 * A cláusula `invalidado_em IS NULL` é o que torna a operação **idempotente**: repetir o reenvio não
 * reescreve a marca do portador já invalidado, e o instante original é preservado. É a mesma escolha
 * de `coalesce(retirado_em, now())` em {@link ./cadastro-de-pessoa.ts}, pela mesma razão — só que
 * aqui a preservação vem do `WHERE`, porque a instrução alcança N linhas e não uma.
 *
 * **Não há leitura antes da escrita**: um `SELECT` para saber se há o que invalidar seria uma ida ao
 * banco a mais e uma janela de corrida entre as duas. Conjunto vazio é resultado legítimo — o
 * primeiro disparo de um locatário alcança zero linhas.
 */
export async function invalidarPortadoresDoLocatario(
  tx: TransactionSql,
  locatarioId: string,
): Promise<number> {
  const resultado = await tx`
    UPDATE negocio.portador_de_confirmacao
       SET invalidado_em = pg_catalog.now()
     WHERE locatario_id = ${locatarioId}
       AND invalidado_em IS NULL
  `;

  return resultado.count;
}

/**
 * Resolve o portador pelo derivado — a **única** leitura legítima sem contexto de empresa.
 *
 * ---------------------------------------------------------------------------
 * ELA NÃO CONSULTA A TABELA — chama a função `SECURITY DEFINER` da `0014`
 * ---------------------------------------------------------------------------
 *
 * A tabela tem RLS **forçada**, e uma leitura direta sem contexto devolveria zero linhas —
 * corretamente. Quem atravessa é a função, que pertence a `sysloc_resolucao` e é alcançada por uma
 * política nominal declarada na migração. Trocar esta chamada por um `SELECT` sobre a tabela é o
 * defeito que a §7.3 da tech spec registra por extenso, e ele **não** aparece em asserção de
 * catálogo: a função continuaria declarada, e apenas deixaria de ser usada.
 *
 * ---------------------------------------------------------------------------
 * ELA NÃO PASSA EMPRESA, e não tem como passar (ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * A assinatura da função **não tem** parâmetro de empresa: um tenant vindo de fora seria uma segunda
 * origem de contexto, exatamente o que a ADR-0024 fecha. O contexto sai do **registro que o portador
 * resolve**, e a borda o fixa depois, com o valor descoberto. O `CT-727` afirma a ausência do
 * parâmetro por introspecção do catálogo, e não só pelo comportamento.
 *
 * ---------------------------------------------------------------------------
 * O `tx` é o da unidade SEM contexto — e essa é a forma de chamá-la
 * ---------------------------------------------------------------------------
 *
 * O pacote não publica executor cru (a §3.3 faz disso um invariante de compilação), de modo que o
 * caminho legítimo é abrir a unidade de trabalho **fora** de `contextoDeTenant.executarCom`: ela
 * fixa `app.empresa_id = ''`, a política vira `empresa_id = NULL`, e é justamente esse o estado que
 * a função existe para atravessar. Descoberta a empresa, a borda abre a **segunda** unidade, essa
 * sim sob o contexto.
 *
 * ---------------------------------------------------------------------------
 * `undefined` é o resultado de TRÊS causas, e ele não as distingue
 * ---------------------------------------------------------------------------
 *
 * Derivado que nunca existiu, portador vencido e portador invalidado produzem o **mesmo** conjunto
 * vazio, e a indistinguibilidade nasce no `WHERE` da função — não num `if` da borda que alguém possa
 * reordenar ou esquecer (RN-14). O `CT-728` afirma as três por igualdade entre si.
 *
 * ⚠️ **A função NÃO filtra por `consumido_em`, e a linha que faria isso está sob `DECISÃO FECHADA`
 * na `0014`.** Pareceria endurecimento e quebraria a RN-10: a reapresentação dentro da validade
 * passaria a receber `404`, e a pré-visualização de link pelo provedor de correio queimaria a
 * confirmação antes de o locatário clicar. Uso único é o **efeito**, imposto por
 * {@link consumirPortador} — nunca a resolução.
 */
export async function resolverPortador(
  tx: TransactionSql,
  derivado: string,
): Promise<PortadorResolvido | undefined> {
  const [portador] = await tx<PortadorResolvido[]>`
    SELECT empresa_id   AS "empresaId",
           locatario_id AS "locatarioId",
           consumido_em AS "consumidoEm"
      FROM negocio.resolver_portador_de_confirmacao(${derivado})
  `;

  return portador;
}

/**
 * Consome o portador e confirma o endereço do locatário — **uma instrução, e um instante só**.
 *
 * ---------------------------------------------------------------------------
 * A AUSÊNCIA DE RETORNO É ELA PRÓPRIA O RESULTADO (RN-10)
 * ---------------------------------------------------------------------------
 *
 * `WHERE consumido_em IS NULL … RETURNING` é o mecanismo inteiro do uso único. **Não há `if` prévio
 * de leitura**: a forma intuitiva — ler o portador, decidir se já foi usado, gravar — passa em todos
 * os casos felizes e perde a corrida em que duas apresentações simultâneas do mesmo segredo leem
 * "ainda não consumido" e as duas gravam. Aqui o banco elege um vencedor e o perdedor volta sem
 * linha, sem que nada precise ser conferido.
 *
 * `undefined` significa uma coisa só para quem chama: **nada foi escrito**. Ele cobre a
 * reapresentação (o portador já estava consumido), o portador que o contexto corrente não alcança e
 * o portador que não está mais válido (invalidado ou vencido) — e a borda responde
 * `200 { confirmado: true }` no caso que ela alcança, porque a RN-10 manda responder sucesso a quem
 * chega depois. Não há aqui nada a distinguir.
 *
 * ---------------------------------------------------------------------------
 * ELA CONFERE AS TRÊS CONDIÇÕES DE VALIDADE — não confia em quem chamou
 * ---------------------------------------------------------------------------
 *
 * O `WHERE` do CTE repete os dois predicados que a função `SECURITY DEFINER` da `0014` já aplica na
 * resolução (`invalidado_em IS NULL` e `expira_em > pg_catalog.now()`) e acrescenta o terceiro, que
 * é só dele (`consumido_em IS NULL`). A repetição **não** é redundância, e a razão é a topologia das
 * transações: a resolução corre numa unidade de trabalho **separada** e necessariamente sem contexto
 * de tenant (ADR-0027), de modo que entre ela e o consumo há uma janela de commit real.
 *
 * Sob `READ COMMITTED`, uma invalidação por reenvio (RN-09) que comite **dentro dessa janela** não
 * impediria o consumo se o `UPDATE` olhasse apenas `consumido_em`: ele bloqueia na trava de linha,
 * reavalia o predicado depois do commit da outra transação, e o predicado continuaria verdadeiro. O
 * desfecho seria `email_confirmado_em` gravado para um endereço que ninguém confirmou — exatamente a
 * propriedade que a confirmação existe para estabelecer. O modo de falha é concreto: o `PUT` que
 * troca o endereço zera a confirmação, invalida os anteriores e emite um portador novo, e um consumo
 * do **antigo** ainda em voo chegaria logo depois.
 *
 * O segundo eixo é de **superfície**. Esta porta é publicada no índice do pacote, e uma borda futura
 * pode chamá-la já sob contexto sem ter resolvido antes. Com um predicado só, a segurança do consumo
 * dependeria de um protocolo de chamada implícito — *"sempre resolver antes"* — que nada no módulo
 * enunciaria e nada faria cumprir. Aqui a validade é propriedade da instrução, e não do chamador.
 *
 * ⚠️ **Isto NÃO contraria a `DECISÃO FECHADA — T3` da `0014`.** Aquele marcador governa a
 * **resolução**: ele proíbe `AND p.consumido_em IS NULL` no `WHERE` da **função**, porque a
 * reapresentação dentro da validade tem de continuar resolvendo (RN-10). O que entra aqui é
 * **validade** no **consumo**, e nenhum desfecho da reapresentação muda: o portador já consumido
 * continua devolvendo `undefined`, que a borda mapeia em `200`.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS ESCRITAS SÃO UMA INSTRUÇÃO — e é isso que impede a metade gravada
 * ---------------------------------------------------------------------------
 *
 * O consumo do portador e a confirmação do endereço são o **mesmo fato**, e viajam numa instrução
 * só, com a segunda escrita alimentada pelo `RETURNING` da primeira. Escrevê-las em dois comandos
 * abriria o estado em que o portador está consumido e o endereço não está confirmado — sem portador
 * vivo para tentar de novo, e portanto irrecuperável pela interface.
 *
 * `pg_catalog.now()` é o **instante de início da transação**, e por isso as duas colunas recebem
 * exatamente o mesmo valor, caractere a caractere. É de propósito: `clock_timestamp()` daria dois
 * instantes vizinhos e faria "quando o endereço foi confirmado" depender de qual coluna se olha.
 *
 * ---------------------------------------------------------------------------
 * A CHAVE É O DERIVADO, e não o identificador do portador
 * ---------------------------------------------------------------------------
 *
 * Quem chama nunca viu o `id` do portador — ele não é recurso exposto (ADR-0017), e
 * {@link resolverPortador} não o publica. O que a borda tem em mãos é o derivado do segredo
 * apresentado, e é por ele que a linha é alcançada, pela mesma restrição única que a resolução usa.
 *
 * ⚠️ O `UPDATE` corre **sob a política** da tabela, com o contexto já fixado a partir da empresa que
 * a resolução descobriu. Nenhum `WHERE empresa_id` é escrito aqui, e não pode haver (ADR-0008).
 */
export async function consumirPortador(
  tx: TransactionSql,
  derivado: string,
): Promise<ConsumoDoPortador | undefined> {
  const [consumo] = await tx<ConsumoDoPortador[]>`
    WITH consumido AS (
      UPDATE negocio.portador_de_confirmacao
         SET consumido_em = pg_catalog.now()
       WHERE derivado = ${derivado}
         AND consumido_em IS NULL
         AND invalidado_em IS NULL
         AND expira_em > pg_catalog.now()
      RETURNING locatario_id, consumido_em
    )
    UPDATE negocio.locatario l
       SET email_confirmado_em = consumido.consumido_em
      FROM consumido
     WHERE l.id = consumido.locatario_id
    RETURNING l.id AS "locatarioId", l.email_confirmado_em AS "confirmadoEm"
  `;

  return consumo;
}
