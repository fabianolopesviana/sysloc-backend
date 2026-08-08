/**
 * Ajustes individuais de permissão — a camada de dados da autorização.
 *
 * ---------------------------------------------------------------------------
 * A AUSÊNCIA DE FILTRO POR EMPRESA É A ENTREGA, NÃO UMA OMISSÃO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma consulta deste arquivo compara `empresa_id` com coisa alguma. Quem chegar aqui
 * procurando um `WHERE empresa_id = …` e não achar precisa ler esta seção antes de "consertar" a
 * falta: o escopo é a política do banco, fixada por `SET LOCAL app.empresa_id` na abertura da
 * unidade de trabalho, e reintroduzir o filtro é violação nominal da ADR-0008 — *"dois caminhos
 * para o mesmo dado divergem com o tempo, e o filtro redundante ensina a confiar nele"*.
 *
 * A propriedade é mais forte do que "não filtramos": **o identificador da empresa não passa pela
 * aplicação em nenhum momento**. A escrita que precisa de `empresa_id` — a linha de
 * `acesso_usuario_permissao`, cuja coluna é não nula — o toma do PRÓPRIO PAI, dentro da instrução
 * (`SELECT a.empresa_id … FROM negocio.acesso_usuario_app AS a`), e o pai é justamente a tabela que
 * a política escopa. Sem contexto, ou sob o contexto de outra empresa, o pai é invisível: a
 * instrução afeta zero linhas em vez de gravar em nome de quem não deveria.
 *
 * É também o que dá tenancy às escritas em `identidade`, que **não tem RLS** por decisão da
 * ADR-0009: o contador de versão e o perfil moram lá, e as duas instruções alcançam a pessoa
 * **através do vínculo** (`FROM negocio.acesso_usuario_app AS a WHERE a.usuario_id = u.id`). O
 * escopo continua sendo a política — aplicada ao vínculo —, e não uma comparação escrita aqui.
 * Uma escrita por `WHERE u.id = $1` sozinha alcançaria pessoa de qualquer empresa.
 *
 * O CT-209 tem asserção estática, com mutante, sobre este arquivo.
 *
 * ---------------------------------------------------------------------------
 * As duas fronteiras de schema, um commit só
 * ---------------------------------------------------------------------------
 *
 * O ajuste vive em `negocio` (sob RLS forçada) e o contador em `identidade` (sem RLS). A §7.4 da
 * tech spec exige que as duas escritas aconteçam na **mesma** transação, e é por isso que estas
 * operações recebem o executor (`tx`) em vez de abrirem unidade própria: a atomicidade sai de
 * graça da unidade que a borda abriu. Abrir unidade aqui dentro produziria `ErroDeUnidadeAninhada`
 * quando a rota já tivesse aberto a sua, e a saída "cada serviço abre a sua" foi rejeitada no
 * docblock daquele erro — *"unidade na borda: quem atende a requisição abre a unidade e passa o
 * executor adiante; é a forma preferida"*.
 *
 * ---------------------------------------------------------------------------
 * Por que a regra de domínio ENTRA POR PARÂMETRO, e não por importação
 * ---------------------------------------------------------------------------
 *
 * A coerência ação→tela (RN-02) e o catálogo fechado das 17 chaves vivem em `@sysloc/auth`, que
 * **depende deste pacote** — a §3.2 da tech spec fixa a direção `apps/api` → `@sysloc/auth` →
 * `@sysloc/db` → `@sysloc/shared`. Importá-los daqui fecharia um ciclo entre os dois pacotes, que
 * `tsc --build` recusa por construção (referência de projeto não pode ser circular).
 *
 * A saída não é duplicar a regra — duas definições da ADR-0010 livres para divergir é exatamente o
 * que o índice de `@sysloc/auth` existe para impedir. É **inverter a dependência**: quem compõe as
 * duas camadas (a rota, em `apps/api`) passa a regra adiante. Aqui dentro fica apenas *quando* ela
 * roda — dentro da transação, antes da primeira escrita, com o perfil lido do banco —, que é o que
 * a camada de dados tem como garantir e a borda não.
 *
 * ---------------------------------------------------------------------------
 * Leitura devolve vazio; escrita recusa com erro nomeado
 * ---------------------------------------------------------------------------
 *
 * A assimetria é deliberada. Ler ajuste de pessoa invisível no contexto corrente **não é erro**: é
 * invisibilidade, e o comportamento correto é o conjunto vazio — o mesmo que a política produz para
 * qualquer leitura de negócio fora do tenant (CT-005, CT-209). Já **escrever** para uma pessoa que
 * o contexto não alcança é pedido que não pode ser silenciosamente atendido em zero linhas: o
 * chamador precisa distinguir "gravei" de "não havia quem gravar" para responder à requisição, e o
 * silêncio faria a rota devolver sucesso por uma pessoa de outra empresa. Daí
 * {@link ErroDePessoaForaDoContexto}.
 */

import type { TransactionSql } from 'postgres';
import type { PerfilDaPessoa } from './esquema/identidade.js';
import { type efeitoPermissao, tipoPermissao } from './esquema/negocio.js';

/**
 * Os três perfis. **Reexportado**, e não declarado aqui: a origem é `./esquema/identidade.js`, junto
 * do enum que o produz (D35 da T7). A reexportação existe para que a superfície pública do pacote
 * não mude — o índice segue publicando `PerfilDaPessoa` a partir deste módulo.
 */
export type { PerfilDaPessoa } from './esquema/identidade.js';

/** Conceder ou retirar, derivado do enum do schema. */
export type EfeitoDoAjuste = (typeof efeitoPermissao.enumValues)[number];

/** Os dois eixos do catálogo, derivados do enum do schema. */
type TipoDeAjuste = (typeof tipoPermissao.enumValues)[number];

/** O separador entre o eixo e o nome, na forma canônica da chave (`TELA:financeiro`). */
const SEPARADOR_DE_CHAVE = ':';

/**
 * A chave do ajuste na forma que o domínio fala: o eixo no prefixo do próprio valor.
 *
 * O tipo é aberto no nome de propósito — quem fecha o conjunto nas 17 chaves é o catálogo de
 * `@sysloc/auth`, que este pacote não pode importar (ver o cabeçalho). O que se garante aqui é o
 * **eixo**, e ele basta para a decomposição nas duas colunas ser total: `ChaveDoCatalogo` é
 * atribuível a este tipo, então a borda continua sendo quem restringe.
 */
export type ChaveDeAjuste = `${TipoDeAjuste}${typeof SEPARADOR_DE_CHAVE}${string}`;

/**
 * Um ajuste como ele está gravado, com a chave já **recomposta** na forma canônica do domínio.
 *
 * A tabela guarda `tipo` e `chave` em colunas separadas — é sobre o trio `(acesso_id, tipo, chave)`
 * que a unicidade recusa concessão e negação coexistentes. O domínio fala um literal só. A
 * composição e a decomposição entre as duas formas são desta camada, e têm **ponto único**:
 * {@link comporChave} e {@link decomporChave}.
 *
 * O parâmetro de tipo existe para a leitura devolver o conjunto já estreitado pelo predicado que
 * ela recebe — ver {@link lerAjustesDaPessoa}.
 */
export interface AjustePersistido<TChave extends ChaveDeAjuste = ChaveDeAjuste> {
  readonly chave: TChave;
  readonly efeito: EfeitoDoAjuste;
}

/** O que a leitura encontrou para uma pessoa, e o que ela descartou. */
export interface AjustesDaPessoa<TChave extends ChaveDeAjuste = ChaveDeAjuste> {
  /** Os ajustes reconhecidos pelo catálogo corrente, na ordem estável da consulta. */
  readonly ajustes: readonly AjustePersistido<TChave>[];
  /**
   * As chaves gravadas que o catálogo corrente **não** reconhece, na forma canônica.
   *
   * Elas foram descartadas e não entram no efetivo — ver {@link lerAjustesDaPessoa}. Vêm aqui, e
   * não num registro escrito daqui, porque este pacote não tem registrador e a decisão sobre
   * nível e mensagem é de quem opera a borda. Descarte que ninguém consegue observar é o modo de
   * falha que uma migração incompleta produziria sem deixar rastro.
   */
  readonly chavesDesconhecidas: readonly string[];
}

/**
 * O vínculo da pessoa não é alcançável sob o contexto de tenant corrente.
 *
 * Erro com nome próprio pela mesma razão de `ErroDeContextoInvalido` e `ErroDeUnidadeAninhada`:
 * quem trata precisa distinguir "esta pessoa não é desta empresa (ou não há contexto)" de "o banco
 * recusou a operação", e as duas coisas têm resposta HTTP diferente.
 *
 * Ele **não** revela se a pessoa existe em outra empresa — a mensagem não carrega identificador
 * algum, e a condição que o levanta é a mesma para "não existe" e "existe e é de outra empresa".
 */
export class ErroDePessoaForaDoContexto extends Error {
  constructor() {
    super(
      'a pessoa não tem vínculo de acesso alcançável sob o contexto de tenant corrente: ' +
        'nenhum ajuste de permissão foi lido ou gravado',
    );
    this.name = 'ErroDePessoaForaDoContexto';
  }
}

/** Os dois eixos como conjunto, para a conferência do prefixo em tempo constante. */
const TIPOS_DE_AJUSTE: ReadonlySet<string> = new Set<string>(tipoPermissao.enumValues);

/** `('ACAO', 'emitir_boleto')` → `'ACAO:emitir_boleto'`. Ponto único da composição. */
function comporChave(tipo: TipoDeAjuste, nome: string): ChaveDeAjuste {
  return `${tipo}${SEPARADOR_DE_CHAVE}${nome}`;
}

/**
 * `'ACAO:emitir_boleto'` → `('ACAO', 'emitir_boleto')`. Ponto único da decomposição.
 *
 * Parte no **primeiro** separador, e não em todos: o nome da chave é opaco para esta camada, e um
 * `split` completo tornaria `TELA:a:b` uma chave de nome `'a'` com o resto perdido em silêncio.
 *
 * Devolve `undefined` quando o prefixo não é um dos eixos do schema. O tipo torna isso inalcançável
 * a partir de chamador tipado; a conferência existe porque o valor pode vir de JavaScript sem
 * tipos, e nesse caso a alternativa seria gravar `tipo` inválido ou descartar a linha calada.
 */
function decomporChave(chave: string): { tipo: TipoDeAjuste; nome: string } | undefined {
  const corte = chave.indexOf(SEPARADOR_DE_CHAVE);
  if (corte <= 0) {
    return undefined;
  }

  const tipo = chave.slice(0, corte);
  if (!TIPOS_DE_AJUSTE.has(tipo)) {
    return undefined;
  }

  return { tipo: tipo as TipoDeAjuste, nome: chave.slice(corte + SEPARADOR_DE_CHAVE.length) };
}

/** Uma linha de `acesso_usuario_permissao`, como a consulta a devolve. */
interface LinhaDeAjuste {
  readonly tipo: TipoDeAjuste;
  readonly chave: string;
  readonly efeito: EfeitoDoAjuste;
}

/**
 * Lê os ajustes individuais da pessoa, **descartando** o que o catálogo corrente não reconhece.
 *
 * ---------------------------------------------------------------------------
 * Por que o predicado é aplicado na LEITURA, e não só na escrita
 * ---------------------------------------------------------------------------
 *
 * A borda já recusa chave fora do catálogo antes de gravar (§6.1 da tech spec). Isso não basta: a
 * coluna `chave` é `text`, e o catálogo é código. Uma chave **órfã** — gravada quando ela existia,
 * removida do catálogo depois — continua no banco, e uma leitura crua a devolveria para o cálculo
 * do efetivo, de onde ela sairia publicada em `GET /v1/sessao`. O alcance concedido seria nulo
 * (nenhuma rota declara exigência que não esteja no catálogo), mas o vazamento na superfície
 * publicada seria real. É o risco que a Revisão Técnica da T2 registrou dirigido a esta task.
 *
 * O descarte é **silencioso no banco e visível para o chamador**: as chaves recusadas voltam em
 * {@link AjustesDaPessoa.chavesDesconhecidas}, para que a borda as registre. Apagá-las daqui seria
 * escrita não pedida numa leitura; escondê-las faria uma migração incompleta sumir sem rastro.
 *
 * Pessoa fora do contexto devolve **vazio, sem erro** — ver o cabeçalho deste arquivo.
 *
 * @param tx Executor da unidade de trabalho, com o contexto de tenant já fixado.
 * @param usuarioId Identificador da pessoa.
 * @param pertenceAoCatalogo Predicado de pertinência — `ehChaveDoCatalogo`, de `@sysloc/auth`.
 */
export async function lerAjustesDaPessoa<TChave extends ChaveDeAjuste>(
  tx: TransactionSql,
  usuarioId: string,
  pertenceAoCatalogo: (chave: string) => chave is TChave,
): Promise<AjustesDaPessoa<TChave>> {
  // Sem cláusula por empresa: o escopo é a política, aplicada ao vínculo (`a`), e a permissão só é
  // alcançável através dele. A ordem é estável para que o conjunto seja comparável entre leituras.
  const linhas = await tx<LinhaDeAjuste[]>`
    SELECT p.tipo AS tipo, p.chave AS chave, p.efeito AS efeito
      FROM negocio.acesso_usuario_permissao AS p
      JOIN negocio.acesso_usuario_app AS a ON a.id = p.acesso_id
     WHERE a.usuario_id = ${usuarioId}
     ORDER BY p.tipo::text, p.chave
  `;

  const ajustes: AjustePersistido<TChave>[] = [];
  const chavesDesconhecidas: string[] = [];

  for (const linha of linhas) {
    const chave = comporChave(linha.tipo, linha.chave);
    if (pertenceAoCatalogo(chave)) {
      ajustes.push({ chave, efeito: linha.efeito });
    } else {
      chavesDesconhecidas.push(chave);
    }
  }

  return { ajustes, chavesDesconhecidas };
}

/**
 * Incrementa o contador de versão de permissão da pessoa, e devolve o valor novo.
 *
 * É a operação que as três abaixo compõem, e a única escrita deste módulo em `identidade`. Ela não
 * é chamada em caminho que não altere o efetivo: **escrita alheia a permissão não incrementa**, e
 * incrementar por qualquer escrita transformaria toda edição de cadastro em invalidação de efetivo
 * (ADR-0010; caso de controle no CT-210).
 *
 * O alcance vem do vínculo, sob a política — ver o cabeçalho deste arquivo.
 *
 * @throws {ErroDePessoaForaDoContexto} quando o vínculo não é visível no contexto corrente.
 */
export async function incrementarVersaoPermissoes(
  tx: TransactionSql,
  usuarioId: string,
): Promise<number> {
  const [linha] = await tx<{ versaoPermissoes: number }[]>`
    UPDATE identidade.usuario AS u
       SET versao_permissoes = u.versao_permissoes + 1
      FROM negocio.acesso_usuario_app AS a
     WHERE a.usuario_id = u.id
       AND u.id = ${usuarioId}
    RETURNING u.versao_permissoes AS "versaoPermissoes"
  `;

  if (linha === undefined) {
    throw new ErroDePessoaForaDoContexto();
  }

  // O driver devolve `integer` como número; a conversão explícita é o que impede uma mudança de
  // tipo da coluna (para `bigint`, por exemplo) de fazer o contador viajar como cadeia sem alarme.
  return Number(linha.versaoPermissoes);
}

/** O que {@link escreverAjustes} recebe. */
export interface EscritaDeAjustes {
  /** A pessoa cujos ajustes serão substituídos. */
  readonly usuarioId: string;
  /** O conjunto **completo** de ajustes que passa a valer. Vazio remove todos. */
  readonly ajustes: readonly AjustePersistido[];
  /**
   * A regra de coerência do domínio — `validarCoerenciaDeAjustes`, de `@sysloc/auth`.
   *
   * Entra por parâmetro porque o pacote de domínio depende deste, e não o contrário (cabeçalho).
   * Recebe o perfil **lido do banco dentro desta transação**: lê-lo na borda deixaria a janela em
   * que uma troca de perfil concorrente valida a coerência contra um perfil que já não vale.
   *
   * Levanta para recusar. Não corrigir e seguir — a RN-02 é literal: *"recusada no momento de
   * salvar, nunca aceita e silenciosamente ignorada"*.
   */
  validarCoerencia(perfil: PerfilDaPessoa, ajustes: readonly AjustePersistido[]): void;
}

/**
 * Substitui os ajustes individuais da pessoa e incrementa o contador, **numa transação só**.
 *
 * A ordem é o mecanismo, e é ela que faz "operação recusada não deixa efeito colateral" (CT-210)
 * ser propriedade da função e não do acaso:
 *
 *   1. localiza o vínculo **sob a política** e lê o perfil corrente — sem vínculo, recusa;
 *   2. decompõe as chaves — o que não decompõe recusa **antes** de qualquer escrita;
 *   3. valida a coerência com o perfil lido no passo 1 — recusa levanta e nada foi escrito;
 *   4. remove os ajustes anteriores e grava os novos;
 *   5. incrementa o contador — **uma vez**, qualquer que seja o número de linhas gravadas.
 *
 * A recusa nos passos 1 a 3 acontece com a transação já aberta: mesmo que uma reordenação futura
 * mova uma escrita para antes da validação, o desfazimento da unidade de trabalho continua sendo a
 * rede — as duas escritas, nas duas fronteiras de schema, são o mesmo commit.
 *
 * @returns o valor novo do contador de versão da pessoa.
 * @throws {ErroDePessoaForaDoContexto} quando o vínculo não é visível no contexto corrente.
 * @throws o que `validarCoerencia` levantar — a recusa do domínio atravessa intacta.
 */
export async function escreverAjustes(
  tx: TransactionSql,
  entrada: EscritaDeAjustes,
): Promise<number> {
  const perfil = await lerPerfilDoVinculo(tx, entrada.usuarioId);

  const tipos: TipoDeAjuste[] = [];
  const nomes: string[] = [];
  const efeitos: EfeitoDoAjuste[] = [];

  for (const ajuste of entrada.ajustes) {
    const partes = decomporChave(ajuste.chave);
    if (partes === undefined) {
      throw new TypeError(
        `chave de ajuste sem eixo reconhecido: esperado prefixo ${tipoPermissao.enumValues.join(
          ' ou ',
        )} seguido de ${SEPARADOR_DE_CHAVE}`,
      );
    }
    tipos.push(partes.tipo);
    nomes.push(partes.nome);
    efeitos.push(ajuste.efeito);
  }

  entrada.validarCoerencia(perfil, entrada.ajustes);

  await removerAjustesDoVinculo(tx, entrada.usuarioId);

  // `empresa_id` e `acesso_id` saem do PRÓPRIO PAI, dentro da instrução — o identificador da
  // empresa não passa pela aplicação, e a linha só nasce se a política deixar o pai visível.
  // `unnest` casa os três arranjos posição a posição, de modo que o conjunto inteiro é uma
  // instrução só, e não uma ida ao banco por ajuste.
  await tx`
    INSERT INTO negocio.acesso_usuario_permissao (empresa_id, acesso_id, tipo, chave, efeito)
    SELECT a.empresa_id,
           a.id,
           novo.tipo::negocio.tipo_permissao,
           novo.chave,
           novo.efeito::negocio.efeito_permissao
      FROM negocio.acesso_usuario_app AS a
     CROSS JOIN unnest(${tipos}::text[], ${nomes}::text[], ${efeitos}::text[])
            AS novo(tipo, chave, efeito)
     WHERE a.usuario_id = ${entrada.usuarioId}
  `;

  return await incrementarVersaoPermissoes(tx, entrada.usuarioId);
}

/** O que {@link trocarPerfilDaPessoa} recebe. */
export interface TrocaDePerfil {
  /** A pessoa cujo perfil muda. */
  readonly usuarioId: string;
  /**
   * O perfil novo — **nunca `SYSLOC_MASTER`**.
   *
   * A exclusão é de tipo porque a escalada a Master precisa ser *irrepresentável*, e não
   * apenas recusada: com `PerfilDaPessoa` inteiro, `{ perfil: 'SYSLOC_MASTER' }` compilava e
   * a recusa vinha do `usuario_master_sem_empresa_chk` como `PostgresError` 23514 cru — que
   * a borda não classifica e devolve como `500`.
   *
   * Isto **não substitui** a garantia do banco, que continua sendo a autoridade (ADR-0008):
   * são as duas metades, no molde que `BancoDeIdentidade` já usa. O Master não é criável nem
   * alcançável pelas rotas de administração, e a borda já restringe por `PerfilAdministravel`;
   * esta é a camada que impede um chamador **novo** de reabrir o caminho sem perceber.
   */
  readonly perfil: Exclude<PerfilDaPessoa, 'SYSLOC_MASTER'>;
}

/**
 * Troca o perfil da pessoa, **descarta todos os ajustes** dela e incrementa o contador, numa
 * transação só.
 *
 * O descarte é da operação, não um efeito colateral esquecido: os ajustes são desvios sobre a
 * matriz de UM perfil, e mantê-los sobre outra matriz produziria um efetivo que ninguém desenhou.
 * A recusa por falta de intenção declarada — a rota exige que o Admin confirme que sabe o que será
 * descartado — acontece na camada de rota; aqui a operação já chega decidida.
 *
 * @returns o valor novo do contador de versão da pessoa.
 * @throws {ErroDePessoaForaDoContexto} quando o vínculo não é visível no contexto corrente.
 */
export async function trocarPerfilDaPessoa(
  tx: TransactionSql,
  entrada: TrocaDePerfil,
): Promise<number> {
  // Localiza antes de escrever: sem vínculo visível, a recusa acontece com o banco intocado.
  await lerPerfilDoVinculo(tx, entrada.usuarioId);

  await removerAjustesDoVinculo(tx, entrada.usuarioId);

  await tx`
    UPDATE identidade.usuario AS u
       SET perfil = ${entrada.perfil}::identidade.perfil_usuario
      FROM negocio.acesso_usuario_app AS a
     WHERE a.usuario_id = u.id
       AND u.id = ${entrada.usuarioId}
  `;

  return await incrementarVersaoPermissoes(tx, entrada.usuarioId);
}

/**
 * O perfil corrente da pessoa, alcançada **pelo vínculo** — isto é, sob a política.
 *
 * É também o teste de alcance das escritas: quem não tem vínculo visível não é encontrado aqui, e
 * a operação recusa antes de tocar em qualquer tabela.
 */
async function lerPerfilDoVinculo(tx: TransactionSql, usuarioId: string): Promise<PerfilDaPessoa> {
  const [linha] = await tx<{ perfil: PerfilDaPessoa }[]>`
    SELECT u.perfil AS perfil
      FROM negocio.acesso_usuario_app AS a
      JOIN identidade.usuario AS u ON u.id = a.usuario_id
     WHERE a.usuario_id = ${usuarioId}
  `;

  if (linha === undefined) {
    throw new ErroDePessoaForaDoContexto();
  }

  return linha.perfil;
}

/**
 * Remove todos os ajustes do vínculo da pessoa.
 *
 * A remoção alcança a linha **pelo pai**, e não por um identificador que a aplicação carregue: é o
 * mesmo mecanismo de escopo do resto do módulo, e a política já recusaria a linha alheia de todo
 * modo — `DELETE` sob RLS afeta zero linhas em vez de errar (CT-004).
 */
async function removerAjustesDoVinculo(tx: TransactionSql, usuarioId: string): Promise<void> {
  await tx`
    DELETE FROM negocio.acesso_usuario_permissao AS p
     USING negocio.acesso_usuario_app AS a
     WHERE a.id = p.acesso_id
       AND a.usuario_id = ${usuarioId}
  `;
}
