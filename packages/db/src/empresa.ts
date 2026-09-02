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
// A maquinaria da exclusão definitiva mora em `./administrador-do-master.js`, e o sentido da
// importação é deliberado: `IMPEDIMENTOS_DE_EXCLUSAO` é o vocabulário do impedimento, e ele nasce
// junto do módulo cujo alcance o produziu. Uma terceira casa só para hospedá-lo criaria um módulo
// sem sujeito; duplicar a mecânica do ponto de salvamento daria duas definições do mesmo critério —
// exatamente o que a decisão D2-b existe para impedir. `administrador-do-master.ts` não importa
// nada daqui, de modo que o grafo continua acíclico.
//
// `RecusaDeExclusao`, `classeDoImpedimento`, `ensaiarExclusao` e `semDeixarEfeitoNaRecusa` são
// internos ao pacote — o índice não os reexporta, e a fronteira que o produto conhece segue sendo
// o `DesfechoDaExclusao`.
import {
  classeDoImpedimento,
  type DesfechoDaExclusao,
  type ElegibilidadeDeExclusao,
  ensaiarExclusao,
  RecusaDeExclusao,
  semDeixarEfeitoNaRecusa,
} from './administrador-do-master.js';
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

// ===========================================================================
// Correção cadastral e remoção definitiva — a fatia `painel-master-administradores`
// ===========================================================================

/**
 * O documento já pertence a **outra** empresa.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de
 * API. Quem o traduz no envelope da ADR-0017 — `422 CAMPO_INVALIDO` com `campo: 'documento'` — é
 * `apps/api/src/master/empresa.service.ts`, num ponto único.
 *
 * **A mensagem não carrega o documento recusado**, e a omissão é a decisão — mesma razão registrada
 * em `ErroDeIdentificadorMunicipalEmUso` ({@link ./imovel.ts}) e em `ErroDeDocumentoEmUso`
 * ({@link ./cadastro-de-pessoa.ts}): ela chega ao registro estruturado, e a recusa é a resposta a um
 * pedido que ainda não provou nada. O que o operador precisa saber — qual campo — viaja em campo
 * nomeado.
 *
 * Ela **não** carrega discriminante de conflito, diferente das duas irmãs: `identidade.empresa` não
 * tem exclusão lógica (ADR-0038), de modo que a linha em conflito só pode estar em circulação — não
 * existe o segundo estado que lá precisava ser informado.
 */
export class ErroDeDocumentoDeEmpresaEmUso extends Error {
  override readonly name: string = 'ErroDeDocumentoDeEmpresaEmUso';

  constructor() {
    super('o documento já pertence a outra empresa');
  }
}

/**
 * A restrição que impõe a unicidade do documento, como o servidor a reporta.
 *
 * É a **mesma** que {@link admitirEmpresa} nomeia no `ON CONFLICT`, e nomeá-la aqui é o que torna a
 * recusa atribuível ao documento: sem alvo, um `catch` genérico de `23505` absorveria qualquer
 * unicidade acrescentada a `identidade.empresa` no futuro, e a borda reportaria *"documento já
 * registrado"* para uma colisão que não é de documento — uma recusa que mente sobre a própria causa.
 */
const RESTRICAO_DO_DOCUMENTO_DA_EMPRESA = 'empresa_documento_unique';

/** `unique_violation` — o `SQLSTATE` com que o servidor recusa a restrição acima. */
const VIOLACAO_DE_UNICIDADE_DA_EMPRESA = '23505';

/**
 * Corrige nome e documento da empresa, e devolve a linha nova. `undefined` quando ela não existe.
 *
 * **Ela escreve só as duas colunas cadastrais.** `suspensa_em` e `criada_em` ficam de fora, e a
 * ausência é o mecanismo da CA-09: corrigir o cadastro de uma empresa suspensa **não** a reativa, e
 * o instante da suspensão continua sendo exatamente o mesmo — não um instante novo que por acaso
 * também é não nulo. Quem move `suspensa_em` são {@link suspenderEmpresa} e {@link reativarEmpresa},
 * que são rota própria (ADR-0021): estado não é campo de edição cadastral.
 *
 * Os dois campos são gravados **na mesma instrução**: uma implementação que gravasse campo a campo
 * deixaria o nome novo persistido quando o documento colidisse.
 *
 * A duplicidade é decidida **pelo banco**, e não por uma leitura prévia — mesma razão de
 * {@link admitirEmpresa}: entre o `SELECT` que não achou e o `UPDATE`, outra transação grava.
 *
 * A escrita corre dentro de um **ponto de salvamento** porque a violação `23505` aborta a transação,
 * e sem o retorno ao ponto a unidade de quem chama ficaria inutilizável (`25P02`) — é a mecânica de
 * `gravarSobRestricaoDeUnicidade`, em {@link ./imovel.ts}. Toda violação que **não** seja a da
 * restrição nomeada é repassada intacta.
 */
export async function alterarEmpresa(
  tx: TransactionSql,
  empresaId: string,
  dados: EmpresaNova,
): Promise<EmpresaPersistida | undefined> {
  try {
    return await tx.savepoint(async (escrita) => {
      const [alterada] = await escrita<EmpresaPersistida[]>`
        UPDATE identidade.empresa
           SET nome = ${dados.nome},
               documento = ${dados.documento}
         WHERE id = ${empresaId}
        RETURNING ${colunasDaEmpresa(escrita)}
      `;

      return alterada;
    });
  } catch (erro) {
    if (!ehColisaoDeDocumentoDaEmpresa(erro)) {
      throw erro;
    }

    throw new ErroDeDocumentoDeEmpresaEmUso();
  }
}

/** Reconhece a recusa da restrição de unicidade do documento — por forma, nunca por texto. */
function ehColisaoDeDocumentoDaEmpresa(erro: unknown): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return (
    falha?.code === VIOLACAO_DE_UNICIDADE_DA_EMPRESA &&
    falha.constraint_name === RESTRICAO_DO_DOCUMENTO_DA_EMPRESA
  );
}

/**
 * Remove a empresa em definitivo — as **duas** instruções, num único commit (RN-12, ADR-0038).
 *
 * ---------------------------------------------------------------------------
 * POR QUE DUAS INSTRUÇÕES, E POR QUE NA MESMA UNIDADE
 * ---------------------------------------------------------------------------
 *
 * (a) remove as pessoas da empresa — é o que o requisito chama de *"além do próprio cadastro feito
 * no Master"* — e (b) remove a empresa. Elas são **uma** operação: entre um commit e outro existiria
 * um estado em que a empresa perdeu as pessoas e continuou de pé, e uma falha em (b) o deixaria
 * gravado. Aqui, recusa em qualquer das duas desfaz tudo, e é o `CT-1213` que o mede — a
 * sobrevivência do administrador **elegível** é a asserção que reprova uma remoção em laço.
 *
 * ---------------------------------------------------------------------------
 * A CLASSE PUBLICADA DEPENDE DE QUAL PASSO RECUSOU — e a distinção é da RN-15
 * ---------------------------------------------------------------------------
 *
 * O passo (a) só pode ser recusado por uma dependência **da pessoa** (trilha, vínculo, autoria), e a
 * classe fina dessas dependências descreve o impedimento *do administrador*, não o *da empresa*. O
 * que a empresa publica é `ADMINISTRADORES_NAO_ELEGIVEIS`, e o operador desce ao detalhe pela
 * listagem de administradores, onde cada item traz a própria prévia. Publicar `TENTATIVA_DE_ENTRADA`
 * na recusa da **empresa** atribuiria a ela um fato que é de uma pessoa — e a RN-15 manda a recusa
 * nomear a classe, nunca a entidade.
 *
 * ⚠️ **A restrição continua sendo classificada antes**, e a substituição não afrouxa nada: uma
 * restrição `23503` que o mapa não conheça segue **falhando fechada** (o erro é repassado intacto),
 * em vez de virar `ADMINISTRADORES_NAO_ELEGIVEIS` por omissão.
 *
 * O passo (b) é classificado pelo mapa direto: as 16 chaves de `negocio` dão
 * `REGISTROS_DE_NEGOCIO`, e `usuario_empresa_id_empresa_id_fk` dá `ADMINISTRADORES_NAO_ELEGIVEIS`.
 *
 * `conta`, `dois_fatores` e `sessao` de cada pessoa somem por `ON DELETE cascade` do schema — esta
 * função não as apaga.
 */
export async function excluirEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<DesfechoDaExclusao> {
  return await semDeixarEfeitoNaRecusa(tx, async (escrita) => {
    await removerPessoasDaEmpresa(escrita, empresaId);

    const [removida] = await escrita<{ id: string }[]>`
      DELETE FROM identidade.empresa
       WHERE id = ${empresaId}
      RETURNING id
    `;

    return removida === undefined ? { desfecho: 'NAO_ALCANCADO' } : { desfecho: 'REMOVIDO' };
  });
}

/**
 * O passo (a) de {@link excluirEmpresa} — as pessoas da empresa, de qualquer perfil.
 *
 * Sem recorte por perfil, e é deliberado: o que se remove é **a empresa inteira**, e um Usuário
 * Empresa deixado para trás faria o passo (b) recusar por `usuario_empresa_id_empresa_id_fk` com a
 * mesma classe — pelo caminho mais longo e com um estado intermediário a mais.
 *
 * A tradução da recusa acontece **aqui**, e não no envoltório, porque é aqui que se sabe que a
 * dependência é de uma pessoa. A `RecusaDeExclusao` levantada é interna ao pacote; quem a converte
 * em desfecho é {@link semDeixarEfeitoNaRecusa}, que também desfaz o que este passo escreveu.
 */
async function removerPessoasDaEmpresa(escrita: TransactionSql, empresaId: string): Promise<void> {
  try {
    await escrita`
      DELETE FROM identidade.usuario
       WHERE empresa_id = ${empresaId}
    `;
  } catch (erro) {
    // Classifica **antes** de substituir: restrição desconhecida sobe intacta (falha fechada), em
    // vez de virar uma classe plausível que ninguém apurou.
    if (classeDoImpedimento(erro) === undefined) {
      throw erro;
    }

    throw new RecusaDeExclusao(['ADMINISTRADORES_NAO_ELEGIVEIS']);
  }
}

/**
 * A prévia de elegibilidade da remoção da empresa — o próprio ato, em ensaio desfeito.
 *
 * Ver {@link ./administrador-do-master.ts}.`ensaiarExclusao` para o mecanismo, a razão de o
 * desfazimento ser incondicional e a retenção de bloqueios que o retorno ao ponto **não** libera.
 *
 * ⚠️ **Ela executa `DELETE`, e é isso que a torna correta.** Uma leitura que contasse registros de
 * `negocio` a partir desta persona devolveria **zero para uma empresa cheia** — ver o marcador
 * `DECISÃO FECHADA` de `IMPEDIMENTOS_DE_EXCLUSAO`, em {@link ./administrador-do-master.ts}, e a
 * rede que o guarda (`CT-1204` mede a contagem e a sonda **na mesma unidade de trabalho**).
 */
export async function elegibilidadeDeExclusaoDaEmpresa(
  tx: TransactionSql,
  empresaId: string,
): Promise<ElegibilidadeDeExclusao> {
  return await ensaiarExclusao(tx, async (ensaio) => await excluirEmpresa(ensaio, empresaId));
}
