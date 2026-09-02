/**
 * Acesso do **operador do SaaS** à pessoa e ao ciclo de vida dela — direto em `identidade`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO NÃO IMPORTA NEM REUSA `pessoa.ts` (decisão D3-b)
 * ---------------------------------------------------------------------------
 *
 * A economia aparente é óbvia: {@link ./pessoa.ts} já tem `definirAtivoDaPessoa`,
 * `encerrarSessoesDaPessoa` e `listarPessoasDaEmpresa`, e um leitor apressado leria este arquivo
 * como duplicação. **Ele não é.** As funções de lá alcançam a pessoa **pelo vínculo**
 * (`negocio.acesso_usuario_app`), que está sob política de isolamento forçada, ou pela variável de
 * sessão que a política lê. Para o **Sysloc Master** as duas vias são vazias por construção:
 *
 *   1. a sessão dele corre com `empresaId: null` (ADR-0008 — a origem do contexto **nunca** é o
 *      caminho da requisição), de modo que `current_setting('app.empresa_id', true)` é vazio e
 *      **nenhuma política casa**;
 *   2. o Admin Empresa admitido por `POST /v1/master/empresas/:id/admin` nasce **sem vínculo** —
 *      ver o cabeçalho de `pessoa.ts` —, então nem sequer há linha pela qual chegar.
 *
 * E o modo de falha é **silencioso**: `encerrarSessoesDaPessoa` devolveria `0` e
 * `definirAtivoDaPessoa` devolveria `undefined`, **sem erro algum**. Uma suspensão feita pelo Painel
 * Master por aquele caminho seria silenciosamente inócua — a pessoa continuaria entrando, e o
 * operador teria visto `200`. É a armadilha **A2** da fatia, e a prova permanente dela são os
 * `CT-1206` e `CT-1207`, que medem as duas funções **sobre a mesma pessoa, no mesmo contexto**, e
 * afirmam os quatro números um a um.
 *
 * A saída rejeitada foi a **parametrização do alcance** (D4-b: uma função só, com o alcance vindo
 * por argumento): o parâmetro que a tornaria correta aqui é justamente o que dispensa o isolamento,
 * e um valor padrão errado devolve a suspensão inócua acima — aprovada por qualquer asserção que só
 * verifique a marcação. Duas cópias **de alcance** (a regra gravada é idêntica) em troca de um modo
 * de falha ruidoso.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O SQL MORA AQUI, E NÃO NO SERVIÇO QUE CHAMA
 * ---------------------------------------------------------------------------
 *
 * Mesma razão que {@link ./empresa.ts} registra por extenso: a contenção que impede `apps/api` de
 * conhecer o schema é de **tipo**, e não alcança texto de SQL. Toda instrução que o ciclo de vida do
 * Admin Empresa precisa vive aqui, publicada como função de domínio.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. Nenhuma delas
 * escreve contexto de tenant: o identificador que chega é **argumento de consulta parametrizada**,
 * nunca fonte de contexto.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO AQUI É A CHAVE, NÃO A POLÍTICA — e o perfil é predicado do SQL (RN-01, RN-06)
 * ---------------------------------------------------------------------------
 *
 * `identidade` não tem política a aplicar (ADR-0009). O que recorta cada operação é o **predicado da
 * própria instrução**, e `perfil = 'ADMIN_EMPRESA'` entra em toda consulta e em todo `UPDATE`/
 * `DELETE` que alcança pessoa. A razão está escrita em `listarEmpresasAtivas`: *"a enumeração **é**
 * o filtro — a diferença é entre impossível e evitado"*. Um filtro escrito na borda deixaria a
 * instrução alcançando o Sysloc Master e o Usuário Empresa, e a recusa passaria a depender de
 * ninguém esquecer de conferir.
 *
 * A barreira é **dupla** de propósito (RN-06): {@link lerAdministrador} lê o alvo antes do ato — é
 * ela que dá à borda o perfil para recusar com `422` nomeando `perfilDoAlvo` —, e a escrita repete o
 * predicado. Confiar só na leitura deixaria a janela entre ler e escrever; confiar só na escrita
 * daria `404` onde o contrato promete `422`.
 *
 * ---------------------------------------------------------------------------
 * O CRITÉRIO DE EXCLUSÃO É A INTEGRIDADE REFERENCIAL — nunca uma contagem (ADR-0038)
 * ---------------------------------------------------------------------------
 *
 * Ver o marcador `DECISÃO FECHADA` em {@link IMPEDIMENTOS_DE_EXCLUSAO}. Em uma linha: sob a política
 * `FORCE` e sem empresa no contexto, `count(*)` sobre `negocio` devolve **zero para uma empresa
 * cheia** — e uma elegibilidade escrita como contagem habilitaria apagar tudo. O que decide é o
 * próprio `DELETE`, e a prévia é ele mesmo, em ensaio desfeito.
 */

import type { Fragment, TransactionSql } from 'postgres';
// A ORIGEM do tipo, e não a reexportação de `./permissao.js` — mesmo critério que `empresa.ts`
// adota desde o D35 da T7: o perfil é vocabulário do domínio de identidade.
import type { PerfilDaPessoa } from './esquema/identidade.js';

// ===========================================================================
// Tipos publicados
// ===========================================================================

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDeAdministradores {
  readonly limite: number;
  readonly deslocamento: number;
}

/** Um Admin Empresa, na projeção que a listagem do Painel Master publica. */
export interface AdministradorPersistido {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly ativo: boolean;
  readonly criadoEm: Date;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeAdministradoresPersistidos {
  readonly administradores: readonly AdministradorPersistido[];
  readonly total: number;
}

/**
 * O alvo de uma operação do Master, **de qualquer perfil**.
 *
 * O tipo é distinto de {@link AdministradorPersistido} de propósito: aquele descreve uma linha que
 * **já** é Admin Empresa, este descreve o que a leitura prévia encontrou — que pode ser o Sysloc
 * Master ou um Usuário Empresa. Fundi-los faria a recusa por perfil (`422` com `perfilDoAlvo`)
 * depender de um campo que o tipo do sucesso não deveria ter.
 */
export interface AlvoDoMaster {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: PerfilDaPessoa;
  readonly ativo: boolean;
  /** Nulo apenas para o Sysloc Master, que não pertence a empresa alguma. */
  readonly empresaId: string | null;
  readonly criadoEm: Date;
}

/** Os campos que a correção cadastral do Admin Empresa grava (RN-08). */
export interface DadosDoAdministradorAlterado {
  readonly nome: string;
  readonly email: string;
}

/**
 * O desfecho de uma correção cadastral — união fechada, e não um `undefined` sobrecarregado.
 *
 * São **três** desfechos legítimos e a borda responde diferente a cada um (`200`, `404`, `422`
 * nomeando `email`). Devolver `undefined` para dois deles obrigaria uma segunda leitura só para
 * descobrir qual aconteceu — e as duas leituras poderiam observar estados diferentes.
 *
 * ⚠️ **A assimetria com {@link ./empresa.ts}.`alterarEmpresa`, que levanta
 * `ErroDeDocumentoDeEmpresaEmUso`, é deliberada e não se "uniformiza" sem custo**: lá a colisão é o
 * **único** desfecho excepcional (a empresa inexistente já é `undefined`), e a classe publicada é
 * consumida pela borda daquela rota; aqui há três, e uma exceção para um deles deixaria os outros
 * dois indistinguíveis pelo mesmo `undefined`.
 */
export type DesfechoDaAlteracaoDoAdministrador =
  | { readonly desfecho: 'ALTERADO'; readonly administrador: AdministradorPersistido }
  | { readonly desfecho: 'NAO_ALCANCADO' }
  | { readonly desfecho: 'EMAIL_EM_USO' };

/**
 * As classes de impedimento que a recusa de exclusão publica — vocabulário **fechado** (RN-15).
 *
 * A recusa nomeia a **classe**, nunca a entidade nem a quantidade: a ADR-0013 restringe o alcance
 * desta persona ao que é dela, e *"existem 42 cobranças"* já é dado de negócio. `alternativa` e
 * `motivo` são compostos na borda a partir daqui.
 */
export type ClasseDeImpedimento =
  | 'REGISTROS_DE_NEGOCIO'
  | 'ADMINISTRADORES_NAO_ELEGIVEIS'
  | 'TENTATIVA_DE_ENTRADA'
  | 'VINCULO_DE_ACESSO'
  | 'AUTORIA_EM_REGISTRO';

/**
 * A prévia de elegibilidade — artefato **derivado**, composto sob demanda (ADR-0030).
 *
 * Não há caminho de escrita: ela não é coluna, não é cache e não é recalculada por gatilho. O valor
 * vale para o instante em que foi lido, e é isso que a nota de fronteira do D2 chama de TOCTOU não
 * eliminável — o que o desenho garante é que **o ato é auto-verificado**, e o pior caso é uma recusa
 * que nomeia o motivo (CA-19).
 */
export interface ElegibilidadeDeExclusao {
  readonly elegivel: boolean;
  readonly impedimentos: readonly ClasseDeImpedimento[];
}

/**
 * O desfecho de uma exclusão definitiva.
 *
 * `IMPEDIDO` é **valor devolvido, e não exceção**, e a escolha tem consequência observável: a
 * unidade de trabalho de quem chama continua utilizável e pode **comitar** sem ter gravado nada — é
 * o que o `CT-1213` mede, medindo depois numa unidade nova. A recusa já foi desfeita pelo ponto de
 * salvamento de {@link semDeixarEfeitoNaRecusa}; não há efeito parcial a limpar.
 */
export type DesfechoDaExclusao =
  | { readonly desfecho: 'REMOVIDO' }
  | { readonly desfecho: 'NAO_ALCANCADO' }
  | { readonly desfecho: 'IMPEDIDO'; readonly impedimentos: readonly ClasseDeImpedimento[] };

// ===========================================================================
// O vocabulário fechado de impedimentos
// ===========================================================================

/** `foreign_key_violation` — o `SQLSTATE` com que o servidor recusa a remoção referenciada. */
const VIOLACAO_DE_INTEGRIDADE = '23503';

/** `unique_violation` — o `SQLSTATE` da colisão de e-mail na correção cadastral. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * A restrição que impõe a unicidade do endereço de e-mail, como o servidor a reporta.
 *
 * Ela é o **discriminante**: `identidade.usuario` tem duas restrições únicas, e a outra
 * (`usuario_id_empresa_key`) é o alvo das chaves estrangeiras compostas de `negocio`. Traduzir toda
 * violação `23505` como colisão de e-mail atribuiria à entrada do operador uma colisão que ele não
 * causou — e a esconderia atrás de um `422` plausível.
 */
const RESTRICAO_DO_EMAIL = 'usuario_email_unique';

/**
 * O mapa **fechado** de `constraint_name` → classe de impedimento.
 *
 * DECISÃO FECHADA — T1 / fatia `painel-master-administradores` · 2026-09-01
 * O QUÊ: a elegibilidade de exclusão é decidida pela **integridade referencial** do banco — o
 *        próprio `DELETE`, executado em ensaio —, e este mapa apenas **traduz** a recusa que o
 *        servidor já deu. Nenhuma contagem sobre `negocio` participa da decisão, em ponto algum.
 * POR QUÊ: a sessão do Sysloc Master corre com `empresaId: null`; as políticas de
 *          `migracoes/0001_seguranca.sql` são `FORCE` e casam
 *          `empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`. Sob esse
 *          contexto, `SELECT count(*) FROM negocio.<qualquer> WHERE empresa_id = <A>` devolve
 *          **zero para uma empresa cheia** — e uma elegibilidade por contagem declararia excluível
 *          uma empresa inteira em produção, **sem erro nenhum**. A saída que tornaria a contagem
 *          correta (derivar o contexto do `:id` do caminho) é literalmente o que a ADR-0008 proíbe;
 *          a outra (função privilegiada que atravessa o isolamento) precisaria de parâmetro de
 *          empresa e cai no discriminador da emenda de 2026-08-13 da ADR-0024.
 * REVERTER EXIGE: demonstrar que uma contagem sobre `negocio` feita a partir do Master enxerga
 *                 **linha alguma** — isto é, que a política deixou de esconder a linha da empresa
 *                 alheia sob contexto vazio. Rede: `CT-1204` (a empresa cheia recusada **enquanto**
 *                 a contagem devolve `0`, na mesma unidade) e `CT-1205` (o mesmo zero com desfecho
 *                 oposto).
 *
 * ---------------------------------------------------------------------------
 * CHAVEADO POR `constraint_name`, e não por tabela — a `acesso_usuario_app` é o caso que decide
 * ---------------------------------------------------------------------------
 *
 * O `23503` entrega o nome da restrição no campo `constraint`, de modo que a classificação não custa
 * consulta extra. E `negocio.acesso_usuario_app` referencia `identidade.usuario` por **DUAS**
 * restrições — a simples (`acesso_usuario_app_usuario_id_usuario_id_fk`) e a composta
 * (`acesso_usuario_app_usuario_empresa_fkey`) —, e o PostgreSQL **não garante qual dispara
 * primeiro**. Um mapa chaveado por tabela esconderia isso; classificar só uma faria metade das
 * recusas degradar para erro genérico, contra a RN-15. As duas recebem a mesma classe.
 *
 * ---------------------------------------------------------------------------
 * ELE É FECHADO, E A COMPLETUDE É GUARDA EXECUTÁVEL (D5-b)
 * ---------------------------------------------------------------------------
 *
 * São as **25** restrições `ON DELETE no action` que alcançam `identidade.usuario` (8) e
 * `identidade.empresa` (17), medidas contra o catálogo em 2026-09-01. Uma dependência acrescentada
 * numa fatia futura **sem entrada aqui** faria a recusa degradar para erro genérico em produção,
 * em silêncio — e é por isso que a completude é **guarda executável**, e não hipótese: o `CT-1215`
 * compara este conjunto de chaves com `pg_constraint` por igualdade de conjunto, com controle
 * antivácuo, e o `CT-1216` prova que a comparação reprova, criando na instância efêmera uma
 * dependência sem classe e vendo-a aparecer em `excedentes`. Os dois vivem em
 * {@link ../test/catalogo.spec.ts}, e a leitura do catálogo é por **modo de remoção** — as que
 * recusam (`no action` e `restrict`), nunca as que cascateiam.
 *
 * ⚠️ **O vocabulário é apenas metade da completude, e a outra tem guarda própria.** Um schema pode
 * ter toda restrição classificada **e** uma tabela de `negocio` que não oponha nada à remoção da
 * empresa — o que tornaria uma empresa cheia excluível, deixando órfãos que a política de isolamento
 * torna invisíveis. Quem afirma que isso não acontece são o `CT-1242` e o `CT-1243`, no mesmo
 * arquivo: para toda tabela de `negocio` existe caminho de chave estrangeira até `identidade.empresa`
 * por colunas de ligação **não nulas**.
 *
 * A anotação é `Record<string, ClasseDeImpedimento>`, e não um `as const` de chaves literais, porque
 * o nome consultado vem do **servidor** em tempo de execução: com `noUncheckedIndexedAccess`, a
 * consulta devolve `ClasseDeImpedimento | undefined`, e é esse `undefined` que faz a classificação
 * **falhar fechada** em vez de inventar uma classe.
 */
export const IMPEDIMENTOS_DE_EXCLUSAO: Readonly<Record<string, ClasseDeImpedimento>> =
  Object.freeze({
    // ---------------------------------------------------------------------
    // As 16 chaves de `negocio` que apontam para `identidade.empresa`.
    // ---------------------------------------------------------------------
    acesso_usuario_app_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    certificado_do_provedor_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    conferencia_bancaria_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    configuracao_de_mora_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    conjunto_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    emissao_em_lote_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    entrega_da_noticia_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    envio_de_cobranca_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    evento_bancario_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    execucao_de_rotina_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    fiador_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    identidade_no_provedor_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    locador_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    locatario_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    politica_de_aviso_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    portador_de_confirmacao_empresa_id_empresa_id_fk: 'REGISTROS_DE_NEGOCIO',
    // ---------------------------------------------------------------------
    // A 17ª de `identidade.empresa`: a própria pessoa. Ela só pode disparar se alguém sobreviveu à
    // remoção das pessoas da empresa — o que o passo (a) de `excluirEmpresa` torna impossível na
    // prática. A entrada existe porque o mapa é **fechado**: a completude não é hipótese.
    // ---------------------------------------------------------------------
    usuario_empresa_id_empresa_id_fk: 'ADMINISTRADORES_NAO_ELEGIVEIS',
    // ---------------------------------------------------------------------
    // As 8 de `identidade.usuario`. A trilha primeiro: a ADR-0013 a declara a mitigação do poder
    // desta persona (*"sem isso, ela não existe"*), e por isso ela é IMPEDIMENTO, nunca colateral.
    // ---------------------------------------------------------------------
    tentativa_login_usuario_id_usuario_id_fk: 'TENTATIVA_DE_ENTRADA',
    // As DUAS da `acesso_usuario_app` — ver o bloco acima; a ordem de disparo não é garantida.
    acesso_usuario_app_usuario_id_usuario_id_fk: 'VINCULO_DE_ACESSO',
    acesso_usuario_app_usuario_empresa_fkey: 'VINCULO_DE_ACESSO',
    // As 5 colunas de autoria em `negocio` — quem registrou o certificado, a identidade no provedor,
    // o lote, a conferência e a verificação da entrega.
    certificado_do_provedor_usuario_empresa_fkey: 'AUTORIA_EM_REGISTRO',
    conferencia_bancaria_usuario_empresa_fkey: 'AUTORIA_EM_REGISTRO',
    emissao_em_lote_usuario_empresa_fkey: 'AUTORIA_EM_REGISTRO',
    entrega_da_noticia_usuario_empresa_fkey: 'AUTORIA_EM_REGISTRO',
    identidade_no_provedor_usuario_empresa_fkey: 'AUTORIA_EM_REGISTRO',
  });

// ===========================================================================
// A maquinaria compartilhada com `empresa.ts` — interna ao pacote
// ===========================================================================

/**
 * A recusa **já classificada**, levantada por um passo da exclusão para o envoltório que a traduz.
 *
 * Ela é interna ao pacote de propósito — não é reexportada pelo índice —, porque a fronteira que o
 * produto conhece é o {@link DesfechoDaExclusao}, e publicar a exceção convidaria a borda a
 * `catch`á-la em vez de ler o desfecho. Ela existe apenas porque `excluirEmpresa` executa **dois**
 * passos e a classe publicada depende de qual deles recusou (ver lá).
 */
export class RecusaDeExclusao extends Error {
  override readonly name: string = 'RecusaDeExclusao';

  readonly impedimentos: readonly ClasseDeImpedimento[];

  constructor(impedimentos: readonly ClasseDeImpedimento[]) {
    // A mensagem **não** carrega identificador, nome de tabela nem valor de chave: ela chega ao
    // registro estruturado, e o `detail` do driver — que carrega os valores da chave recusada —
    // fica de fora por construção, porque nada dele é copiado para cá (RN-15).
    super('a exclusão foi recusada pela integridade referencial');
    this.impedimentos = impedimentos;
  }
}

/**
 * A classe de impedimento que o erro do servidor nomeia, ou `undefined` quando ele não é uma recusa
 * de integridade **reconhecida**.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver,
 * e o par (`code`, `constraint_name`) é o contrato do protocolo — os mesmos dois campos que
 * `imovel.ts`, `isolamento.spec.ts` e `permissao.spec.ts` já leem. Casar pelo texto da mensagem
 * amarraria a tradução ao idioma configurado no servidor.
 *
 * `undefined` para restrição **não classificada** é o que faz a exclusão **falhar fechada**: quem
 * chama repassa o erro intacto, e a operação vira falha, nunca `{ elegivel: true }`.
 */
export function classeDoImpedimento(erro: unknown): ClasseDeImpedimento | undefined {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  if (falha?.code !== VIOLACAO_DE_INTEGRIDADE || typeof falha.constraint_name !== 'string') {
    return undefined;
  }

  return IMPEDIMENTOS_DE_EXCLUSAO[falha.constraint_name];
}

/**
 * Executa a exclusão dentro de um **ponto de salvamento**, e traduz a recusa de integridade.
 *
 * O ponto de salvamento é o que permite a recusa ser **valor devolvido**: a violação `23503` aborta
 * a transação, e sem o retorno ao ponto qualquer instrução seguinte falharia com `25P02` — a unidade
 * de quem chama ficaria inutilizável, e a recusa teria de ser exceção. É a mesma mecânica, e a mesma
 * razão, de `gravarSobRestricaoDeUnicidade` em {@link ./imovel.ts}.
 *
 * O desfazimento alcança **só** o que este envoltório executou: o que a unidade gravou antes dele
 * permanece, e é isso que faz a tradução caber dentro de uma composição maior.
 *
 * Toda falha que **não** seja recusa de integridade reconhecida é **repassada intacta** — inclusive
 * um `23503` de restrição sem classe no mapa. Traduzir `23503` em bloco atribuiria à operação um
 * impedimento inventado e o esconderia atrás de um `422` plausível, que é a pior forma de perder um
 * defeito.
 */
export async function semDeixarEfeitoNaRecusa(
  tx: TransactionSql,
  excluir: (escrita: TransactionSql) => Promise<DesfechoDaExclusao>,
): Promise<DesfechoDaExclusao> {
  try {
    return await tx.savepoint(async (escrita) => await excluir(escrita));
  } catch (erro) {
    if (erro instanceof RecusaDeExclusao) {
      return { desfecho: 'IMPEDIDO', impedimentos: erro.impedimentos };
    }

    const classe = classeDoImpedimento(erro);
    if (classe === undefined) {
      throw erro;
    }

    return { desfecho: 'IMPEDIDO', impedimentos: [classe] };
  }
}

/** Sentinela do ensaio — ver {@link ensaiarExclusao}. Uma instância por chamada. */
class EnsaioConcluido extends Error {
  override readonly name: string = 'EnsaioConcluido';
}

/**
 * A prévia de elegibilidade: executa **o próprio ato** e retorna ao ponto de salvamento **sempre**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE É O ATO, E NÃO UM PREDICADO ESCRITO À PARTE (decisão D2-b, RN-13)
 * ---------------------------------------------------------------------------
 *
 * Um predicado próprio seria uma **segunda definição** do mesmo critério, livre para divergir da
 * primeira no primeiro crescimento do modelo — a classe de defeito que a §5 do Protocolo
 * Antirregressão persegue por escrito. Aqui não existe segundo critério: a prévia **é** o ato.
 *
 * ---------------------------------------------------------------------------
 * O DESFAZIMENTO É INCONDICIONAL — inclusive no caminho de SUCESSO
 * ---------------------------------------------------------------------------
 *
 * O ponto de salvamento do driver é **liberado** quando a função interna retorna normalmente, e
 * liberar significa **manter** o que foi feito. É por isso que a sentinela é levantada depois de o
 * ato ter sido executado: é ela que força o `ROLLBACK TO SAVEPOINT` no único caminho em que o
 * `DELETE` de fato removeria linhas. Sem ela, sondar uma entidade **elegível** a apagaria — e é
 * exatamente esse caminho que o `CT-1209` percorre; o `CT-1208`, sozinho, não o pegaria.
 *
 * A sentinela é uma **instância por chamada**, comparada por identidade (`!==`), e não uma classe
 * comparada por `instanceof`: duas sondas concorrentes na mesma cadeia não podem confundir uma
 * sentinela com a outra, e nada que venha do driver pode se fazer passar por ela.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ `ROLLBACK TO SAVEPOINT` **não libera os bloqueios de RELAÇÃO; os de LINHA são liberados**
 * ---------------------------------------------------------------------------
 *
 * Os bloqueios de **relação** que o ensaio tomou permanecem até o fim da **transação** de leitura,
 * não até o retorno ao ponto. Os de **linha** — `FOR KEY SHARE` nas referenciadas, e o exclusivo nas
 * visitadas — **são liberados** pelo retorno, porque morrem com a subtransação que os tomou.
 *
 * ⚠️ **A distinção foi MEDIDA, e é ela que dimensiona o custo real.** Rodada 2 da T4 desta fatia,
 * instância efêmera migrada, 200 Admin Empresa elegíveis, com a unidade da listagem **ainda aberta**
 * e **203** bloqueios de relação retidos: a entrada de um administrador da própria página — `INSERT`
 * em `identidade.sessao`, que toma exatamente `FOR KEY SHARE` na linha — **atravessou em 8 ms**. O
 * controle positivo é o que torna esse número conclusivo em vez de janela quieta por acaso: contra
 * um `DELETE` **vivo** na mesma linha, o mesmo `INSERT` esperou o teto inteiro e foi recusado com
 * `55P03` após **5 014 ms**.
 *
 * **Não reponha a frase larga** (*"`ROLLBACK TO SAVEPOINT` não libera bloqueios"*): ela é anterior à
 * medição, foi ela que sustentou o impacto declarado no `P2` do Tech Review da T4 — refutado —, e a
 * **ADR-0038** teve o 2º `Cons` emendado em 2026-09-02 pela mesma razão. As duas pontas foram
 * precisadas no mesmo passo; corrigir uma e deixar a outra é o vão que o débito registrou.
 *
 * Consequência operacional, declarada e não escondida e **inalterada por esta precisão**: uma
 * listagem que sonda item a item sob o teto de página (`MAIOR_PAGINA_DE_EMPRESAS` = 200) segura os
 * bloqueios de **relação** durante a composição inteira da página. É aceitável na escala declarada
 * da persona (operador único, dezenas a poucas centenas de empresas), e a alternativa — não publicar
 * a prévia — é o que a ADR-0014 rejeitou ao recusar a *"recusa muda"*.
 */
export async function ensaiarExclusao(
  tx: TransactionSql,
  excluir: (ensaio: TransactionSql) => Promise<DesfechoDaExclusao>,
): Promise<ElegibilidadeDeExclusao> {
  const sentinela = new EnsaioConcluido();
  let desfecho: DesfechoDaExclusao | undefined;

  try {
    await tx.savepoint(async (ensaio) => {
      desfecho = await excluir(ensaio);
      throw sentinela;
    });
  } catch (erro) {
    if (erro !== sentinela) {
      throw erro;
    }
  }

  if (desfecho === undefined) {
    // Estado impossível: o ponto de salvamento retornou sem que a sentinela tivesse sido levantada
    // e sem que erro algum tivesse escapado. Levanta com nome, em vez de devolver "elegível" por
    // omissão — que seria a resposta insegura escolhida por acaso.
    throw new Error('o ensaio de exclusão terminou sem desfecho');
  }

  return desfecho.desfecho === 'IMPEDIDO'
    ? { elegivel: false, impedimentos: desfecho.impedimentos }
    : // `NAO_ALCANCADO` responde **elegível**, e a fusão é deliberada: quem sonda já leu a entidade
      // (a borda responde `404` antes de chegar aqui), e um terceiro estado obrigaria a decidir de
      // novo o que a leitura já decidiu. O que a prévia afirma é *"nada impede"*, e nada impede.
      { elegivel: true, impedimentos: [] };
}

// ===========================================================================
// As sete funções de acesso
// ===========================================================================

/**
 * A projeção publicada da listagem, escrita **uma vez**.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora. O `SELECT *` não aparece de propósito — com ele,
 * uma coluna acrescentada a `identidade.usuario` numa fatia futura passaria a viajar na resposta sem
 * que ninguém decidisse publicá-la, e `senha_derivada` não está longe dali.
 */
function colunasDoAdministrador(tx: TransactionSql): Fragment {
  return tx`id,
            nome,
            email,
            ativo,
            criado_em AS "criadoEm"`;
}

/**
 * Lê uma página dos **Admin Empresa** da empresa e o total do conjunto, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos — mesma razão de `listarEmpresas`, em {@link ./empresa.ts}.
 *
 * `perfil = 'ADMIN_EMPRESA'` é predicado **desta consulta** (RN-01): o Usuário Empresa e o Sysloc
 * Master não são alcançados, em vez de serem alcançados e descartados. A diferença é entre
 * impossível e evitado, e ela é medida pelo `CT-1217`, cujo arranjo carrega os dois controles.
 *
 * A ordem é `nome, id`, e o desempate importa: `nome` sozinho empata entre homônimos, e um empate
 * faz a mesma linha aparecer em duas páginas — ou em nenhuma.
 */
export async function listarAdministradoresDaEmpresa(
  tx: TransactionSql,
  empresaId: string,
  janela: JanelaDeAdministradores,
): Promise<PaginaDeAdministradoresPersistidos> {
  const administradores = await tx<AdministradorPersistido[]>`
    SELECT ${colunasDoAdministrador(tx)}
      FROM identidade.usuario
     WHERE empresa_id = ${empresaId}
       AND perfil = 'ADMIN_EMPRESA'
     ORDER BY nome, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM identidade.usuario
     WHERE empresa_id = ${empresaId}
       AND perfil = 'ADMIN_EMPRESA'
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return { administradores, total: Number(contagem?.total ?? 0) };
}

/**
 * Lê o alvo de uma operação do Master. `undefined` quando a pessoa não existe.
 *
 * **Ela NÃO recorta por perfil**, e a ausência do predicado é o ponto: é justamente o perfil do alvo
 * que a borda precisa para recusar com `422` nomeando `perfilDoAlvo` (RN-06). Um recorte aqui
 * transformaria a recusa por perfil num `404` indistinguível de "não existe", e o operador não
 * saberia que errou de pessoa.
 *
 * `perfil::text` na projeção, e não a coluna crua: o driver entrega o enum como texto, e a conversão
 * explícita é o que mantém o valor comparável ao literal do domínio.
 */
// DÉBITO COM GATILHO — D1 · F7/T1 · registrado 2026-09-01
// O QUÊ: esta função e `lerAlvoDeReemissao` (`./empresa.ts`) leem a MESMA linha de
//        `identidade.usuario` pela MESMA chave, em duas projeções diferentes — duas cópias da
//        mesma leitura, livres para divergir no dia em que a coluna mudar de nome.
// QUANDO FECHA: o TERCEIRO leitor da linha da pessoa em `identidade` — aí a leitura sobe para casa
//               única, com cada chamador declarando os campos de que precisa.
// POR QUE NÃO AGORA: são DUAS cópias, e o Limiar de Três do `CLAUDE.md` NÃO disparou. Unificá-las
//                    hoje obrigaria `lerAlvoDeReemissao` a publicar `id`, `ativo`, `empresaId` e
//                    `criadoEm`, que a rota de reemissão de senha não usa — alargar a projeção de
//                    uma rota já publicada para poupar seis linhas custa mais que a duplicação.
// ÍNDICE: docs/specs/features/painel-master-administradores/v1/_run/run-report.md §2, D1
export async function lerAdministrador(
  tx: TransactionSql,
  usuarioId: string,
): Promise<AlvoDoMaster | undefined> {
  const [alvo] = await tx<AlvoDoMaster[]>`
    SELECT id,
           nome,
           email,
           perfil::text AS perfil,
           ativo,
           empresa_id AS "empresaId",
           criado_em AS "criadoEm"
      FROM identidade.usuario
     WHERE id = ${usuarioId}
  `;

  return alvo;
}

/**
 * Liga ou desliga o acesso do Admin Empresa, e devolve o estado novo. `undefined` quando não
 * alcançado — a pessoa não existe, ou não é `ADMIN_EMPRESA`.
 *
 * DECISÃO FECHADA — T1 / fatia `painel-master-administradores` · 2026-09-01
 * O QUÊ: a marcação alcança a pessoa **direto em `identidade.usuario`, pela chave**, e NÃO através
 *        de `negocio.acesso_usuario_app` como faz `definirAtivoDaPessoa` em {@link ./pessoa.ts}.
 *        As duas convivem; a fusão está proibida.
 * POR QUÊ: a sessão do Sysloc Master corre com `empresaId: null`, e o vínculo está sob política
 *          `FORCE` — a escrita de `pessoa.ts` alcança **zero linhas** e devolve `undefined`
 *          **sem erro**. Pior: o Admin Empresa admitido pela rota do Master nasce sem vínculo, de
 *          modo que o alvo mais comum desta feature seria invisível mesmo com contexto. A suspensão
 *          seria silenciosamente inócua, e o operador teria visto `200`.
 * REVERTER EXIGE: demonstrar que a função equivalente de `pessoa.ts` alcança a pessoa **sem vínculo
 *                 e sem contexto de empresa** — isto é, que ela deixou de depender de
 *                 `negocio.acesso_usuario_app`. Rede: `CT-1207` (as duas escritas sobre a mesma
 *                 pessoa, com **duas leituras cruas** da coluna como prova) e `CT-1206`.
 *
 * Ela **liga e desliga a mesma coluna**, em vez de duas funções, porque desativar e reativar são o
 * mesmo fato com valores opostos: duas instruções ficariam livres para divergir no alcance — e é
 * precisamente o alcance que carrega a fronteira desta persona.
 *
 * **Ela marca e nada mais**: quem encerra é {@link encerrarSessoesDoAdministrador}, chamada na mesma
 * transação por quem abriu a unidade. Fundir as duas esconderia da borda o número que o contrato
 * publica como prova do encerramento (`sessoesEncerradas`), e faria a reativação carregar um
 * encerramento que a RN-05 não pede.
 *
 * O predicado de perfil é a **segunda barreira** da RN-06: a leitura prévia já recusou o alvo de
 * outro perfil com `422`, e repeti-lo aqui fecha a janela entre ler e escrever.
 */
export async function definirAtivoDoAdministrador(
  tx: TransactionSql,
  usuarioId: string,
  ativo: boolean,
): Promise<boolean | undefined> {
  const [linha] = await tx<{ ativo: boolean }[]>`
    UPDATE identidade.usuario
       SET ativo = ${ativo}
     WHERE id = ${usuarioId}
       AND perfil = 'ADMIN_EMPRESA'
    RETURNING ativo
  `;

  return linha?.ativo;
}

/**
 * Apaga os registros de sessão **de uma pessoa**, e devolve quantos foram.
 *
 * DECISÃO FECHADA — T1 / fatia `painel-master-administradores` · 2026-09-01
 * O QUÊ: o encerramento alcança as sessões **pela chave da pessoa, recortada por perfil em
 *        `identidade.usuario`**, e NÃO através de `negocio.acesso_usuario_app` como faz
 *        `encerrarSessoesDaPessoa` em {@link ./pessoa.ts}. O `USING` desta função é o do **schema
 *        de identidade** — ele não é o vínculo de negócio, e não põe política alguma no caminho.
 *        As duas convivem; a fusão está proibida.
 * POR QUÊ: sob `empresaId: null`, o `USING negocio.acesso_usuario_app` daquela função não casa
 *          política alguma e o `DELETE` apaga **zero linhas, sem erro**. A suspensão feita pelo
 *          Painel Master reportaria `sessoesEncerradas: 0` como se a pessoa não tivesse sessão —
 *          e ela continuaria operando com o cookie que já tinha.
 * REVERTER EXIGE: demonstrar que a função equivalente de `pessoa.ts` alcança a pessoa **sem vínculo
 *                 e sem contexto de empresa**. Rede: `CT-1206` (as duas funções sobre a mesma
 *                 pessoa, no mesmo contexto, com os **quatro** números afirmados um a um).
 *
 * **Por pessoa, e não por empresa** — mesma razão do `CT-228`: o evento é a suspensão de **uma**
 * pessoa, e a colega da mesma empresa continua operando no mesmo instante. Uma implementação que
 * encerrasse por empresa passaria em todas as asserções sobre a suspensa e reprovaria ali.
 *
 * Devolve a **contagem das linhas efetivamente apagadas**, e não uma estimativa: é ela que distingue
 * *"encerrada"* de *"marcada"*, e sem ela o caso passaria com uma implementação que apenas marca.
 *
 * O predicado de perfil é a **segunda barreira** da RN-06, igual à de {@link
 * definirAtivoDoAdministrador}: a leitura prévia já recusou o alvo de outro perfil com `422`, e
 * repeti-lo **na instrução** fecha a janela entre ler e escrever. A §3.1 da task prescreve
 * `DELETE identidade.sessao WHERE usuario_id = $1`, sem recorte, e a divergência é deliberada — a
 * justificativa daquela forma era um **contrato do chamador** (*"quem chama já recusou o alvo na
 * barreira anterior"*), e essa barreira vive numa borda que ainda não existe. Este símbolo é
 * publicado no barril: com o predicado só no chamador, uma chamada com o `id` do Sysloc Master
 * encerraria as sessões do próprio operador do SaaS, e o nome prometeria um alcance que o SQL não
 * tem. Divergência registrada no `run-report.md` da fatia (Gate 2, rodada 1, `P1`).
 *
 * O recorte vem por `USING identidade.usuario`, o mesmo molde de junção de
 * `encerrarSessoesDaPessoa` — **imitado, nunca importado**: `identidade.sessao` não tem a coluna de
 * perfil, e a alternativa (subconsulta no `WHERE`) diria a mesma coisa numa forma que o pacote não
 * usa em lugar nenhum.
 */
export async function encerrarSessoesDoAdministrador(
  tx: TransactionSql,
  usuarioId: string,
): Promise<number> {
  const apagadas = await tx<{ id: string }[]>`
    DELETE FROM identidade.sessao AS s
     USING identidade.usuario AS u
     WHERE u.id = s.usuario_id
       AND u.id = ${usuarioId}
       AND u.perfil = 'ADMIN_EMPRESA'
    RETURNING s.id AS id
  `;

  return apagadas.length;
}

/**
 * Corrige nome e e-mail do Admin Empresa (RN-08).
 *
 * **É `UPDATE` puro, e nada de `@sysloc/auth` é chamado**: a credencial local ancora no
 * `usuarioId` — `identidade.conta` guarda `conta_id` igual ao identificador da pessoa, e **não**
 * guarda endereço —, de modo que corrigir o e-mail não invalida a senha já recebida. A medição pela
 * borda é da **Fase 2**: o `CT-1228` entrará de verdade com o endereço novo, e ele ainda não existe.
 *
 * Os dois campos são gravados **na mesma instrução**, e o `CT-1218` existe para reprovar a
 * alternativa: uma implementação que gravasse campo a campo deixaria o `nome` novo persistido
 * quando o e-mail colidisse.
 *
 * A colisão é decidida **pelo banco**, e não por uma leitura prévia: entre o `SELECT` que não achou
 * e o `UPDATE`, outra transação grava — e só uma falharia, com um erro de driver que ninguém
 * traduziu. O ponto de salvamento é o que permite devolver o desfecho sem abortar a unidade de quem
 * chama; o discriminante é a restrição **nomeada** (ver {@link RESTRICAO_DO_EMAIL}).
 */
export async function alterarAdministrador(
  tx: TransactionSql,
  usuarioId: string,
  dados: DadosDoAdministradorAlterado,
): Promise<DesfechoDaAlteracaoDoAdministrador> {
  try {
    return await tx.savepoint(async (escrita) => {
      const [alterado] = await escrita<AdministradorPersistido[]>`
        UPDATE identidade.usuario
           SET nome = ${dados.nome},
               email = ${dados.email}
         WHERE id = ${usuarioId}
           AND perfil = 'ADMIN_EMPRESA'
        RETURNING ${colunasDoAdministrador(escrita)}
      `;

      return alterado === undefined
        ? ({ desfecho: 'NAO_ALCANCADO' } as const)
        : ({ desfecho: 'ALTERADO', administrador: alterado } as const);
    });
  } catch (erro) {
    if (!ehColisaoDeEmail(erro)) {
      throw erro;
    }

    return { desfecho: 'EMAIL_EM_USO' };
  }
}

/** Reconhece a recusa da restrição de unicidade do e-mail — por forma, nunca por texto. */
function ehColisaoDeEmail(erro: unknown): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return falha?.code === VIOLACAO_DE_UNICIDADE && falha.constraint_name === RESTRICAO_DO_EMAIL;
}

/**
 * Remove o Admin Empresa em definitivo (ADR-0038).
 *
 * A remoção é **física**, e é a exceção que a ADR-0038 declara ao alcance da exclusão lógica da
 * ADR-0014: `identidade.usuario` não tem `retirado_em` e não participa de listagem de circulação —
 * o que o operador precisa é que a pessoa **deixe de existir**, e a alternativa quando isso não é
 * possível é a suspensão, que a recusa anuncia.
 *
 * `conta`, `dois_fatores` e `sessao` somem por `ON DELETE cascade` declarado no schema — esta função
 * **não as apaga**, e a diferença é observável: um `DELETE` escrito aqui para cada uma delas seria
 * uma segunda definição da cascata, livre para esquecer a quarta tabela que uma fatia futura
 * acrescentar. É o que o `CT-1211` mede.
 *
 * Tudo o mais que aponta para a pessoa **impede** a remoção, e é assim por decisão: a trilha de
 * tentativas de entrada é a mitigação declarada da ADR-0013 (RN-16), e nenhuma operação desta feature
 * pode consumi-la como custo.
 */
export async function excluirAdministrador(
  tx: TransactionSql,
  usuarioId: string,
): Promise<DesfechoDaExclusao> {
  return await semDeixarEfeitoNaRecusa(tx, async (escrita) => {
    const [removido] = await escrita<{ id: string }[]>`
      DELETE FROM identidade.usuario
       WHERE id = ${usuarioId}
         AND perfil = 'ADMIN_EMPRESA'
      RETURNING id
    `;

    return removido === undefined ? { desfecho: 'NAO_ALCANCADO' } : { desfecho: 'REMOVIDO' };
  });
}

/**
 * A prévia de elegibilidade da remoção do Admin Empresa — o próprio ato, em ensaio desfeito.
 *
 * Ver {@link ensaiarExclusao} para o mecanismo, a razão de o desfazimento ser incondicional e a
 * retenção de bloqueios que ele **não** libera.
 */
export async function elegibilidadeDeExclusaoDoAdministrador(
  tx: TransactionSql,
  usuarioId: string,
): Promise<ElegibilidadeDeExclusao> {
  return await ensaiarExclusao(tx, async (ensaio) => await excluirAdministrador(ensaio, usuarioId));
}
