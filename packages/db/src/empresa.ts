/**
 * Ciclo de vida da empresa e encerramento de sessões — a camada de dados do operador do SaaS.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * A §11.2 da tech spec da fatia anterior contém `apps/api` a *"não conhecer `esquemaIdentidade` nem
 * o construtor de consulta do ORM"*, e o cabeçalho de {@link ../acesso-identidade.ts} declara, no
 * item 3, que essa restrição **é de tipo e não alcança texto de SQL**. As duas coisas juntas deixam
 * um caminho aberto: um serviço de aplicação que receba o executor da unidade de trabalho pode
 * escrever `identidade.usuario` numa cadeia de texto sem importar nada de proibido — e o alcance às
 * sete tabelas deixa de ser enumerável, que é a propriedade que a contenção existe para dar.
 *
 * É o que este módulo fecha, no molde de {@link ./permissao.ts}: **toda** instrução sobre
 * `identidade.empresa`, `identidade.usuario` e `identidade.sessao` que o ciclo de vida da empresa
 * precisa vive aqui, publicada como função de domínio. O nome físico de tabela e de coluna passa a
 * existir num lugar só — este pacote —, que é o mesmo lugar onde a migração que os renomeia mora.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * `identidade` NÃO tem RLS — o escopo aqui é a chave, não a política
 * ---------------------------------------------------------------------------
 *
 * Diferente de `permissao.ts`, cujas escritas alcançam a pessoa **pelo vínculo** sob a política, o
 * schema `identidade` não tem política a aplicar (ADR-0009): ele existe para operar antes de haver
 * empresa no contexto. O sujeito destas operações é o **Sysloc Master**, que não pertence a empresa
 * alguma e cuja requisição corre com `empresaId: null`.
 *
 * Consequência que precisa estar escrita: o identificador da empresa **vem do caminho da
 * requisição**, e é por isso que nenhuma destas funções escreve contexto de tenant. Derivar o
 * contexto de RLS do pedido é literalmente o mutante que o `CT-014` de
 * `test/unidade-de-trabalho.spec.ts` reprova, e o que a ADR-0008 proíbe por escrito (*"sua origem
 * nunca é o request"*). Aqui o identificador é **argumento de uma consulta parametrizada**, e não
 * fonte de contexto — a distinção é o que separa esta camada daquela.
 *
 * ---------------------------------------------------------------------------
 * O que estas funções NÃO decidem
 * ---------------------------------------------------------------------------
 *
 * Nenhuma delas levanta erro de aplicação. A empresa que não existe volta `undefined`, o documento
 * repetido volta `undefined`, o alvo de reemissão que não existe volta `undefined` — e é a borda
 * que traduz cada ausência no código e no status que o contrato manda. Este pacote não depende de
 * `@sysloc/shared` em produção, e emprestar-lhe a decisão de HTTP criaria a segunda definição de
 * recusa que o resto da fatia recusa por escrito.
 */

import type { Fragment, TransactionSql } from 'postgres';
// A ORIGEM do tipo, e não a reexportação de `./permissao.js` — ver o D35 da T7: o perfil é
// vocabulário do domínio de identidade, e este módulo o consome para `lerAlvoDeReemissao`, que não
// tem relação alguma com ajuste de permissão.
import type { PerfilDaPessoa } from './esquema/identidade.js';

/**
 * Uma linha de `identidade.empresa`, como as consultas deste módulo a devolvem.
 *
 * `suspensaEm` é o **fato gravado**; o estado publicado (`ATIVA`/`SUSPENSA`) é derivado dele na
 * borda, num ponto único, por decisão da ADR-0012 — duas fontes para o mesmo fato divergem.
 */
export interface EmpresaPersistida {
  readonly id: string;
  readonly nome: string;
  readonly documento: string;
  readonly suspensaEm: Date | null;
  readonly criadaEm: Date;
}

/** Os campos que a admissão de empresa grava. */
export interface EmpresaNova {
  readonly nome: string;
  readonly documento: string;
}

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDeEmpresas {
  readonly limite: number;
  readonly deslocamento: number;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeEmpresasPersistidas {
  readonly empresas: readonly EmpresaPersistida[];
  readonly total: number;
}

/** O que a marcação de suspensão devolve. */
export interface MarcaDeSuspensao {
  readonly id: string;
  /** Instante da suspensão. **Preservado** na repetição — ver {@link suspenderEmpresa}. */
  readonly suspensaEm: Date;
}

/** O alvo de uma reemissão de Senha provisória, com o perfil que decide se ela é permitida. */
export interface AlvoDeReemissao {
  readonly nome: string;
  readonly email: string;
  readonly perfil: PerfilDaPessoa;
}

/**
 * A projeção das cinco colunas que o contrato publica, com os nomes já no vocabulário do domínio.
 *
 * Escrita uma vez e reusada pelas duas consultas que devolvem empresa: duas projeções livres para
 * divergir fariam a listagem e a criação publicarem conjuntos diferentes de campos. O `SELECT *`
 * não aparece de propósito — com ele, uma coluna acrescentada a `identidade.empresa` numa fatia
 * futura passaria a viajar na resposta sem que ninguém decidisse publicá-la.
 *
 * É um **fragmento** do driver (`tx`...``), e não uma cadeia interpolada: o fragmento é montado pelo
 * mesmo mecanismo da consulta que o hospeda, de modo que nenhum texto entra na instrução por
 * concatenação. Ele não executa nada — consulta do `postgres.js` só corre quando aguardada.
 */
function colunasDaEmpresa(tx: TransactionSql): Fragment {
  return tx`id,
            nome,
            documento,
            suspensa_em AS "suspensaEm",
            criada_em AS "criadaEm"`;
}

/**
 * Registra uma empresa nova, ativa.
 *
 * Devolve `undefined` quando o documento já está registrado. A duplicidade é decidida **pelo
 * banco**, e não por uma leitura prévia: uma leitura antes da escrita abriria a janela em que duas
 * requisições concorrentes leem *"não existe"* e ambas inserem — e só uma falharia, com um erro de
 * driver que ninguém traduziu.
 *
 * O `ON CONFLICT` **nomeia a restrição**, e isso é o que torna a ausência de linha atribuível ao
 * documento. Sem alvo, ele absorveria em silêncio qualquer restrição de unicidade acrescentada a
 * `identidade.empresa` no futuro, e a borda reportaria *"documento já registrado"* para uma colisão
 * que não é de documento — uma recusa que mente sobre a própria causa.
 */
export async function admitirEmpresa(
  tx: TransactionSql,
  entrada: EmpresaNova,
): Promise<EmpresaPersistida | undefined> {
  const [criada] = await tx<EmpresaPersistida[]>`
    INSERT INTO identidade.empresa (nome, documento)
    VALUES (${entrada.nome}, ${entrada.documento})
    ON CONFLICT ON CONSTRAINT empresa_documento_unique DO NOTHING
    RETURNING ${colunasDaEmpresa(tx)}
  `;

  return criada;
}

/**
 * Lê uma página de empresas e o total do conjunto, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos.
 *
 * A ordem é `criada_em, id`, e o desempate importa: `criada_em` sozinha empata entre empresas
 * criadas no mesmo instante, e um empate faz a mesma linha aparecer em duas páginas — ou em nenhuma.
 */
export async function listarEmpresas(
  tx: TransactionSql,
  janela: JanelaDeEmpresas,
): Promise<PaginaDeEmpresasPersistidas> {
  const empresas = await tx<EmpresaPersistida[]>`
    SELECT ${colunasDaEmpresa(tx)}
      FROM identidade.empresa
     ORDER BY criada_em, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total FROM identidade.empresa
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return { empresas, total: Number(contagem?.total ?? 0) };
}

/**
 * Localiza a empresa pelo identificador, e devolve apenas o identificador dela.
 *
 * A projeção mínima é deliberada: quem chama precisa saber **se ela existe**, e devolver a linha
 * inteira convidaria a borda a publicar campo que ninguém decidiu publicar.
 */
export async function localizarEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<string | undefined> {
  const [empresa] = await tx<{ id: string }[]>`
    SELECT id FROM identidade.empresa WHERE id = ${empresaId}
  `;

  return empresa?.id;
}

/**
 * Localiza a pessoa pelo endereço de e-mail, e devolve apenas o identificador dela.
 *
 * O endereço chega **já normalizado para minúsculas** pela borda, que é onde a normalização tem
 * ponto único: a coluna guarda minúsculas, e normalizar em dois lugares deixaria os dois livres
 * para divergir.
 */
export async function localizarPessoaPorEmail(
  tx: TransactionSql,
  email: string,
): Promise<string | undefined> {
  const [pessoa] = await tx<{ id: string }[]>`
    SELECT id FROM identidade.usuario WHERE email = ${email}
  `;

  return pessoa?.id;
}

/**
 * Marca a empresa como suspensa e devolve o instante da marca. `undefined` quando ela não existe.
 *
 * `coalesce(suspensa_em, now())` é o que torna a repetição idempotente **sem um ramo condicional**:
 * a empresa já suspensa conserva o instante original, de modo que a segunda chamada devolve o mesmo
 * corpo (§9.2). Um `WHERE suspensa_em IS NULL` devolveria zero linhas na repetição e obrigaria uma
 * segunda leitura para distinguir *"já suspensa"* de *"não existe"* — dois caminhos para o mesmo
 * fato.
 *
 * Ela **marca e nada mais**: quem encerra é {@link encerrarSessoesDaEmpresa}, chamada na mesma
 * transação por quem abriu a unidade. Fundir as duas aqui dentro esconderia da borda o número que o
 * contrato publica como prova do encerramento.
 */
export async function suspenderEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<MarcaDeSuspensao | undefined> {
  const [marcada] = await tx<MarcaDeSuspensao[]>`
    UPDATE identidade.empresa
       SET suspensa_em = coalesce(suspensa_em, now())
     WHERE id = ${empresaId}
    RETURNING id, suspensa_em AS "suspensaEm"
  `;

  return marcada;
}

/**
 * Limpa a marca de suspensão e devolve o identificador. `undefined` quando a empresa não existe.
 *
 * **Ela limpa a marca e nada mais** (RN-05). Não há restauração de sessão porque não há o que
 * restaurar: a suspensão apagou os registros, e devolvê-los exigiria tê-los guardado — que é
 * precisamente a diferença entre *"reativar o acesso"* e *"retomar o que estava em curso"*.
 */
export async function reativarEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<string | undefined> {
  const [reativada] = await tx<{ id: string }[]>`
    UPDATE identidade.empresa
       SET suspensa_em = NULL
     WHERE id = ${empresaId}
    RETURNING id
  `;

  return reativada?.id;
}

/**
 * Enumera as empresas **ativas** — a leitura legítima **#1** da ADR-0024, e a origem de todo
 * `empresaId` que viaja em carga de rotina agendada.
 *
 * ---------------------------------------------------------------------------
 * ELA CORRE SEM CONTEXTO DE TENANT, e a ausência é o mecanismo (ADR-0009 · ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * `identidade` **não tem política a aplicar** — ele existe para operar antes de haver empresa no
 * contexto —, e é isso que torna esta leitura possível a partir de um processo que não atende
 * requisição nenhuma. A ADR-0024 a declara nominalmente entre as duas leituras legítimas sem
 * contexto, e o identificador que ela produz é o que a emenda de 2026-08-18 chama de *"produzido por
 * quem já detinha direito a ele"*.
 *
 * ⚠️ **Nenhuma terceira travessia nominal nasce daqui.** A alternativa que responderia *"quais
 * empresas têm candidata"* — uma função que atravessasse de `identidade` para `negocio` — foi
 * **medida e rejeitada** (decisão D2 do tech-alignment da fatia `automacoes-agendadas`): seria um
 * furo permanente no isolamento para poupar trabalho barato. Passagens sem trabalho **existem, e são
 * o custo declarado** de não furar o isolamento.
 *
 * ---------------------------------------------------------------------------
 * A ENUMERAÇÃO **É** O FILTRO — e a diferença é entre impossível e evitado (RN-09)
 * ---------------------------------------------------------------------------
 *
 * `suspensa_em IS NULL` é predicado **desta consulta**, e não uma conferência que quem chama faça
 * depois. A distinção é observável: um despachante que enumerasse todas e descartasse a suspensa
 * dentro da tarefa enfileiraria trabalho para ela — e a tarefa correria sob o contexto de uma empresa
 * cujo acesso está suspenso. Aqui ela **não é alcançada**, e o total enfileirado é o das ativas.
 *
 * ---------------------------------------------------------------------------
 * A PROJEÇÃO É O IDENTIFICADOR, e nada além dele
 * ---------------------------------------------------------------------------
 *
 * Mesma escassez de {@link localizarEmpresa}, e pela mesma razão: quem chama precisa de **para quem
 * enfileirar**, e devolver a linha inteira convidaria o despachante a levar nome, documento ou
 * instante de admissão na carga da tarefa — dado de empresa atravessando um servidor de fila que não
 * tem política nenhuma a aplicar sobre ele.
 *
 * A ordem é `criada_em, id`, e o desempate importa pela razão de {@link listarEmpresas}: `criada_em`
 * sozinha empata entre empresas admitidas no mesmo instante, e o empate faria a ordem do despacho
 * depender do planejador.
 */
export async function listarEmpresasAtivas(tx: TransactionSql): Promise<readonly string[]> {
  const linhas = await tx<{ id: string }[]>`
    SELECT id
      FROM identidade.empresa
     WHERE suspensa_em IS NULL
     ORDER BY criada_em, id
  `;

  return linhas.map((linha) => linha.id);
}

/**
 * A empresa está **suspensa**? — a leitura que o tratamento da notícia bancária consulta (RN-09).
 *
 * Ela existe para o passo B.6 da borda do processo de trabalho: a notícia cuja cobrança pertence a
 * uma empresa suspensa é **retida sem efeito**, e a retenção acontece antes de qualquer conferência
 * e de qualquer ida ao provedor. É por isso que a pergunta é feita aqui, e não derivada de uma
 * leitura mais larga: quem chama precisa de um predicado, não de uma linha.
 *
 * **Sem contexto de tenant, e a ausência é o mecanismo.** `identidade` não tem política a aplicar
 * (ADR-0009) — ele existe justamente para operar antes de haver empresa no contexto —, e é isso que
 * torna esta leitura alcançável pela tarefa **antes** de ela abrir o contexto que o roteamento
 * resolveu. O identificador é **argumento de consulta parametrizada**, e nunca fonte de contexto: a
 * distinção é a mesma que o cabeçalho deste módulo declara.
 *
 * ⚠️ **A empresa que não existe responde `false`, e a fusão é deliberada.** O `empresaId` que chega
 * aqui é o que a travessia nominal do roteamento **acabou de devolver** a partir de
 * `negocio.cobranca`, de modo que a empresa existe por construção. Um terceiro estado
 * (`undefined`) obrigaria a borda a decidir de novo o que o roteamento já decidiu, e o único ramo
 * que ela poderia escrever seria *"trate como não suspensa"* — que é o que esta assinatura já diz.
 *
 * A projeção é o **predicado**, e não a coluna: devolver `suspensa_em` daria a quem chama um
 * instante de que ele não precisa e faria a decisão de *o que conta como suspensa* ganhar uma
 * segunda casa, livre para divergir da derivação que a borda do Master já publica.
 */
export async function empresaSuspensa(tx: TransactionSql, empresaId: string): Promise<boolean> {
  const [linha] = await tx<{ suspensa: boolean }[]>`
    SELECT suspensa_em IS NOT NULL AS suspensa
      FROM identidade.empresa
     WHERE id = ${empresaId}
  `;

  return linha?.suspensa ?? false;
}

/**
 * Apaga os registros de sessão de **todas** as pessoas da empresa, e devolve quantos foram.
 *
 * Recebe o executor da transação em vez de abrir unidade própria — é a forma que o docblock de
 * `ErroDeUnidadeAninhada` (`./unidade-de-trabalho.ts`) chama de *"unidade na borda"* e declara
 * preferida, e é o que faz a marcação e o encerramento serem **um commit só**. Abrir unidade aqui
 * dentro levantaria `ErroDeUnidadeAninhada` e, pior, perderia a atomicidade que a RN-04 exige.
 *
 * As sessões são alcançadas **pela pessoa**, e não por uma coluna de empresa no registro de sessão
 * — ela não existe, e inventá-la duplicaria em `identidade.sessao` um fato que já mora em
 * `identidade.usuario`, livre para divergir dele na primeira troca de empresa.
 *
 * Devolve a **contagem das linhas efetivamente apagadas**, e não uma estimativa: é ela que o
 * `CT-224` usa para distinguir *"encerrada"* de *"marcada"*, e sem ela o caso passaria com uma
 * implementação que apenas marca.
 */
export async function encerrarSessoesDaEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<number> {
  const apagadas = await tx<{ id: string }[]>`
    DELETE FROM identidade.sessao AS s
     USING identidade.usuario AS u
     WHERE u.id = s.usuario_id
       AND u.empresa_id = ${empresaId}
    RETURNING s.id AS id
  `;

  return apagadas.length;
}

/**
 * Lê o alvo de uma reemissão de Senha provisória. `undefined` quando a pessoa não existe.
 *
 * O **perfil vem junto** porque é ele que decide se a reemissão é permitida: a ADR-0013 restringe o
 * alcance do Master a `ADMIN_EMPRESA`, e a decisão é da borda. Uma leitura que omitisse o perfil
 * obrigaria a uma segunda ida ao banco só para conferi-lo, e as duas poderiam observar estados
 * diferentes.
 *
 * `perfil::text` na projeção, e não a coluna crua: o driver entrega o enum como texto, e a conversão
 * explícita é o que mantém o valor comparável ao literal do domínio.
 */
export async function lerAlvoDeReemissao(
  tx: TransactionSql,
  usuarioId: string,
): Promise<AlvoDeReemissao | undefined> {
  const [pessoa] = await tx<AlvoDeReemissao[]>`
    SELECT nome, email, perfil::text AS perfil
      FROM identidade.usuario
     WHERE id = ${usuarioId}
  `;

  return pessoa;
}
