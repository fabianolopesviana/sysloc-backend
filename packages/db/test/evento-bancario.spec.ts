/**
 * Os dois enums da trilha bancária, e a porta que grava efeito nela.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-13    | CT-939 | O enum `negocio.tipo_de_evento_bancario` tem EXATAMENTE os sete rótulos
 * |          |        | declarados, nesta ordem, e `negocio.origem_do_evento_bancario` exatamente
 * |          |        | as TRÊS de {@link ORIGENS_DECLARADAS} — `['ATO_DO_ADMIN','CONFERENCIA',
 * |          |        | 'NOTICIA_DO_PROVEDOR']`, a terceira acrescentada pela `0019` —, lidos do
 * |          |        | catálogo do PostgreSQL, nunca
 * |          |        | do fonte TypeScript. O `INSERT` com `tipo='CONFERENCIA'` e o com
 * |          |        | `origem='PROVEDOR'` são recusados **pelo banco**, com `code === '22P02'` e
 * |          |        | a mensagem nomeando o tipo enumerado e o rótulo, enquanto o `INSERT` com
 * |          |        | `tipo='BOLETO_EMITIDO'` e `origem='ATO_DO_ADMIN'` — a MESMA instrução,
 * |          |        | variando só os dois rótulos — é aceito e devolve `id` não-nulo. |
 * | CA-20    | CT-939 | Nenhum dos dez literais carrega termo do provedor: a varredura contra
 * |          | (b)    | `TERMOS_DO_PROVEDOR` devolve `[]`, e a MESMA varredura aplicada a um objeto
 * |          |        | de controle — uma chave por termo — devolve a lista inteira. |
 * | CA-13    | CT-939 | `registrarEventoBancario` grava as SEIS classes de evento sem receber
 * |          | (c)    | `empresaId`, e `lerTrilhaDaCobranca`, chamada pelo **código** da cobrança
 * |          |        | (ADR-0017), devolve as seis do mais recente para o mais antigo, com
 * |          |        | `diagnostico` intacto, `valorInformado` em **número** e o carimbo em
 * |          |        | ISO-8601 UTC. Sob o contexto de OUTRA empresa a mesma leitura, com o MESMO
 * |          |        | código, devolve `[]` — sem erro e sem recusa nomeada (ADR-0008). |
 *
 * ===========================================================================
 * A PRECONDIÇÃO PRIVILEGIADA: os rótulos vêm do CATÁLOGO, nunca do fonte
 * ===========================================================================
 *
 * As duas listas contra as quais o caso compara estão **escritas por extenso** abaixo, e o observado
 * sai de `pg_enum`/`pg_type` na instância efêmera — a fonte executável. Derivá-lo de
 * `TIPOS_DE_EVENTO_BANCARIO` poria o artefato sob prova nos **dois lados da igualdade**: o enum do
 * banco deriva daquele arranjo (ADR-0016), e um sétimo rótulo acrescentado ao contrato apareceria dos
 * dois lados de uma vez, com a asserção verde. É o mesmo desenho de `coerencia-de-migracoes.spec.ts`
 * e de `catalogo.spec.ts`, e a razão de a lista ser redigitada aqui — o que em qualquer outro
 * contexto seria duplicação.
 *
 * ===========================================================================
 * Por que os TRÊS `INSERT` são crus, e por que isso é o oposto de contornar a porta
 * ===========================================================================
 *
 * A porta (`registrarEventoBancario`) é **tipada** nas uniões do contrato: `tipo: 'CONFERENCIA'` não
 * compila, e por isso ela não consegue exercer a recusa que este caso persegue. O que se prova aqui é
 * que a recusa é do **banco**, e não do compilador — a segunda vale para todo caminho de escrita,
 * inclusive os que ainda não existem, e é a única que sobrevive a um `unsafe` escrito por engano numa
 * fatia futura.
 *
 * Por isso os três `INSERT` são a **mesma instrução**, variando apenas os dois rótulos: é o que torna
 * os desfechos comparáveis. O terceiro é o **controle antivácuo** — sem ele, uma tabela quebrada
 * (coluna renomeada, chave estrangeira insatisfeita, política recusando) faria as duas recusas
 * passarem pelo motivo errado, e o caso aprovaria um banco em que nada grava.
 *
 * O desfecho comparado é `<sqlstate> · <tipo enumerado citado> · <rótulo citado>`, e não a frase
 * inteira do servidor: o que a CA-13 cobra é o código e o tipo NOMEADO, e amarrar a asserção ao texto
 * corrido a faria reprovar por mudança de redação do PostgreSQL, que não é o defeito perseguido.
 *
 * O que corre pela porta real é o `CT-939 (c)`, e ali a asserção é comportamental: as seis classes
 * gravadas e lidas de volta, sobre uma cobrança **própria** — as duas cobranças do arranjo existem
 * para que os dois casos não dependam da ordem em que o runner os executa.
 *
 * ===========================================================================
 * A ausência do tipo `CONFERENCIA` é CONTEÚDO da ADR-0034
 * ===========================================================================
 *
 * A conferência aparece na trilha como **origem**, nunca como tipo: ela é quem descobriu o efeito, e
 * um evento próprio para ela seria registrar a **tentativa** que nada mudou — os `1.837` de `1.864`
 * eventos que a ADR mediu no legado. O `INSERT` que a tenta é o que torna essa decisão **executável
 * em vez de documental**.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-16)
 * ===========================================================================
 *
 * Os passos 1 e 2 observam CATÁLOGO (estrutura), e não comportamento de domínio ⇒ prova de
 * falsificação, pelo precedente que o CT-608 instalou (`.claude/rules/testing-stack.md`) e que o
 * CT-940 seguiu. O defeito foi reintroduzido no artefato REAL — a migração `0017`, que é a única
 * fonte executável dos dois enums — e medido com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso:
 *
 *   * **controle** — árvore íntegra: `197 passed`, 27 arquivos;
 *   * **MT-T3-A · `'CONFERENCIA'` acrescentado ao `CREATE TYPE "negocio"."tipo_de_evento_bancario"`**
 *     — o sétimo tipo que a ADR-0034 proíbe. `1 failed | 196 passed`, e o `CT-939` reprova nomeando
 *     o rótulo excedente: `+ "CONFERENCIA"` na lista de sete;
 *   * **MT-T3-B · `'PROVEDOR'` acrescentado ao `CREATE TYPE "negocio"."origem_do_evento_bancario"`**
 *     — a origem que faria a trilha registrar quem respondeu em vez de quem descobriu.
 *     `1 failed | 196 passed`, com `+ "PROVEDOR"`.
 *
 * ⚠️ **Os dois reprovam na PRIMEIRA perna, e não nas duas**: a igualdade dos rótulos aborta o caso
 * antes de os três `INSERT` correrem. O registro disso é deliberado — declarar que "as duas pernas
 * reprovaram" seria afirmar o que a medição não mostrou. Quem falsifica a perna dos `INSERT`
 * isoladamente é o próprio arranjo dela: as três tentativas correm pela MESMA função, e a terceira
 * (`GRAVOU com id`) é o controle que reprova quando nada grava.
 *
 * Em ambos os mutantes o `CT-939 (b)` continuou verde, e é isso que ele deve fazer: `CONFERENCIA` e
 * `PROVEDOR` não são termos do provedor, e a varredura da CA-20 não é quem os pega. Prova que
 * reprova por tudo não discrimina nada.
 *
 * ---------------------------------------------------------------------------
 * A REDE DOS DOIS DEFEITOS FECHADOS NA RODADA 2 (P4 do Protocolo Antirregressão)
 * ---------------------------------------------------------------------------
 *
 * O `CT-939 (c)` é asserção **comportamental** e reprovaria sozinho, mas os dois defeitos fechados
 * pela rodada 2 ganharam a medição que o P4 exige — mesma invocação pelo script do pacote:
 *
 *   * **MT-T3-C · a chave antiga de volta** — `lerTrilhaDaCobranca` voltando a filtrar
 *     `ev.cobranca_id = ${…}` sem a junção, isto é, chaveada pelo UUID interno que **nenhum símbolo
 *     publicado do pacote entrega**. `1 failed | 196 passed`, e o caso reprova nomeando a causa:
 *     `PostgresError: invalid input syntax for type uuid: "COB-2026-9390002"`;
 *   * **MT-T3-D · o nulo convertido** — `Number(linha.valorInformado)` sem o ramo do nulo.
 *     `1 failed | 196 passed`, com `- null / + 0` em **quatro** das seis linhas: o efeito que não
 *     carrega valor passaria a declarar que o provedor informou zero;
 *   * **MT-T3-E · a conversão ausente** — `valorInformado: linha.valorInformado` (a cadeia crua
 *     atravessando a porta). Reprova **antes da suíte**, no `tsc --build`:
 *     `error TS2322: Type 'string | null' is not assignable to type 'number | null'` — o tipo de
 *     linha **é** o do contrato, e é o compilador quem barra a divergência.
 *
 * O controle é a árvore íntegra: `197 passed`, 27 arquivos — a mesma contagem da rodada 1.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  type EventoBancarioNovo,
  type LinhaDeEventoBancario,
  lerTrilhaDaCobranca,
  registrarEventoBancario,
} from '../src/evento-bancario.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Os casos semeiam poucas linhas e fazem uma dezena de idas ao banco; o teto é folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física. */
const RESERVA_DE_UMA = 1;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

// ---------------------------------------------------------------------------
// Listas escritas POR EXTENSO — nunca derivadas do artefato sob prova
// ---------------------------------------------------------------------------

/**
 * Os **sete** tipos de evento, na ordem em que o enum do banco os declara.
 *
 * Escritos à mão, e jamais importados de `@syslocbr/contracts`: o enum do banco **deriva** daquele
 * arranjo (ADR-0016), e comparar um contra o outro seria pôr o artefato sob prova nos dois lados da
 * igualdade — um rótulo novo mudaria as duas pontas ao mesmo tempo. Ver o cabeçalho.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha SEIS até a migração `0019`, que acrescentou
 * `NOTICIA_RECUSADA` ao fim do enum por decisão da fatia `webhook-e-carne` — a notícia do provedor
 * cujo número de título diverge do gravado é **desfecho anômalo**, que é a segunda metade literal da
 * `Decision` da ADR-0034 (*"o efeito **ou o desfecho anômalo**"*), e não tentativa. A lista à mão
 * segue à mão, e continua sendo a contra-cópia que impede o enum e o contrato de se conferirem um
 * contra o outro; o que mudou foi o conteúdo que ela descreve.
 *
 * ⚠️ **`CONFERENCIA` continua PROIBIDO como tipo** — ver {@link TIPO_RECUSADO} e o cabeçalho do
 * módulo de contrato. O acréscimo de `NOTICIA_RECUSADA` não abre a porta para ele.
 */
const TIPOS_DECLARADOS = [
  'BOLETO_EMITIDO',
  'BOLETO_REVOGADO',
  'EMISSAO_RECUSADA',
  'COBRANCA_LIQUIDADA',
  'LIQUIDACAO_ESTORNADA',
  'DIVERGENCIA_DE_VALOR',
  'NOTICIA_RECUSADA',
] as const;

/**
 * As **três** origens, na ordem em que o enum do banco as declara. Mesma razão da lista acima.
 *
 * SUT_IS_CORRECT_BECAUSE: eram DUAS até a `0019`, que acrescentou `NOTICIA_DO_PROVEDOR` ao fim. Ela
 * é o terceiro **produtor** de efeito — o provedor que veio contar sem que ninguém perguntasse —, e
 * não se funde com `CONFERENCIA`, que é varredura nossa com cota e horário.
 */
const ORIGENS_DECLARADAS = ['ATO_DO_ADMIN', 'CONFERENCIA', 'NOTICIA_DO_PROVEDOR'] as const;

/** O par legítimo do controle antivácuo — os dois primeiros rótulos de cada lista. */
const TIPO_LEGITIMO = TIPOS_DECLARADOS[0];
const ORIGEM_LEGITIMA = ORIGENS_DECLARADAS[0];

/** O tipo que a ADR-0034 proíbe — registrar a conferência seria registrar tentativa. */
const TIPO_RECUSADO = 'CONFERENCIA';

/** A terceira origem que não existe — quem respondeu não é quem descobriu. */
const ORIGEM_RECUSADA = 'PROVEDOR';

/** `invalid_text_representation` — o `SQLSTATE` do valor fora do domínio de um tipo enumerado. */
const VALOR_FORA_DO_ENUM = '22P02';

/** Os nomes que a recusa do banco precisa citar — é o "nomeando o tipo enumerado" da CA-13. */
const TIPO_ENUMERADO_DO_TIPO = 'negocio.tipo_de_evento_bancario';
const TIPO_ENUMERADO_DA_ORIGEM = 'negocio.origem_do_evento_bancario';

/**
 * Os termos que não podem aparecer no vocabulário publicado (CA-20).
 *
 * Escritos por extenso, e não importados de
 * `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`, que é a lista canônica de dez: um
 * arquivo de teste não é superfície de import de outro pacote, e derivar a agulha do artefato que ela
 * persegue é o defeito que este arquivo evita em toda parte. É o mesmo precedente de
 * `packages/contracts/test/esquemas.spec.ts`, que redigita o subconjunto das quatro chaves.
 *
 * Os oito são: o nome do provedor em duas grafias, os quatro campos que o oráculo do legado usa e os
 * dois parâmetros do fluxo de credencial de acesso.
 */
const TERMOS_DO_PROVEDOR = [
  'sicoob',
  'bancoob',
  'nossoNumero',
  'seuNumero',
  'numeroContrato',
  'codigoBeneficiario',
  'client_id',
  'scope',
] as const;

/** O molde do instante que a projeção publica: ISO-8601 em UTC, com milissegundos e `Z` literal. */
const INSTANTE_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---------------------------------------------------------------------------
// Identificadores descartáveis do arranjo
// ---------------------------------------------------------------------------
//
// A cadeia inteira é necessária, e não é zelo: `evento_bancario.cobranca_id` tem chave estrangeira
// COMPOSTA para `cobranca(id, empresa_id)`, a cobrança exige contrato, o contrato exige imóvel,
// locador e locatário, e o imóvel exige conjunto — todas as chaves são `NOT NULL`.
//
// É a **segunda** montagem desta cadeia em `packages/db/test/` (a primeira é `semearApoio`, local de
// `isolamento-bancario.spec.ts`). Ela fica local pelo mesmo critério que aquele arquivo aplicou: são
// arranjos diferentes — lá quatro relações e duas cobranças, aqui duas cobranças e a trilha —, e o
// limiar de três do `CLAUDE.md` só manda subir para casa comum (`banco-efemero.ts`) na terceira.

const CONJUNTO_DE_A = 'aaaaaaaa-9391-4000-8000-000000000001';
const IMOVEL_DE_A = 'aaaaaaaa-9391-4000-8000-000000000002';
const LOCADOR_DE_A = 'aaaaaaaa-9391-4000-8000-000000000003';
const LOCATARIO_DE_A = 'aaaaaaaa-9391-4000-8000-000000000004';
const CONTRATO_DE_A = 'aaaaaaaa-9391-4000-8000-000000000005';

/**
 * DUAS cobranças, e não uma.
 *
 * A primeira recebe os três `INSERT` crus do caso principal; a segunda, os seis efeitos gravados pela
 * porta. Separá-las é o que torna a igualdade da trilha do `CT-939 (c)` independente da ordem em que
 * o runner executa os casos — com uma cobrança só, o evento legítimo do controle antivácuo entraria
 * na trilha lida adiante e a igualdade passaria a depender da ordem de execução.
 */
const COBRANCA_DOS_INSERTS = 'aaaaaaaa-9391-4000-8000-000000000006';
const COBRANCA_DA_TRILHA = 'aaaaaaaa-9391-4000-8000-000000000007';

/**
 * As **duas chaves** da segunda cobrança, e o arranjo precisa das duas.
 *
 * O UUID é o que a **escrita** guarda — `evento_bancario.cobranca_id` tem chave estrangeira composta
 * para `cobranca(id, empresa_id)` —, e o código é o que a **leitura** recebe, porque é a chave exposta
 * que a rota nomeia (ADR-0017). O caso exercita as duas pontas exatamente como a operação as usa: o
 * UUID entra em `registrarEventoBancario`, o código entra em `lerTrilhaDaCobranca`, e é a junção
 * dentro da instrução que liga uma à outra.
 *
 * Ele é constante nomeada, e não literal repetido: o mesmo código aparece na semeadura e na leitura, e
 * duas grafias fariam o caso reprovar por erro de digitação em vez de por defeito da porta.
 */
const CODIGO_DOS_INSERTS = 'COB-2026-9390001';
const CODIGO_DA_TRILHA = 'COB-2026-9390002';

// ---------------------------------------------------------------------------
// Utilidades de coleta — as mesmas formas de `isolamento-bancario.spec.ts`
// ---------------------------------------------------------------------------

type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: unknown };

async function tentar<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await acao() };
  } catch (erro) {
    return { ok: false, erro };
  }
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

function mensagemDo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * O desfecho de uma tentativa de gravação, como texto comparável.
 *
 * Ele existe para que as três tentativas sejam UMA igualdade que nomeia a que divergiu, em vez de
 * três asserções soltas que parariam na primeira. O ramo de sucesso distingue `id` presente de `id`
 * ausente: sem isso, uma projeção que devolvesse nada passaria por gravação.
 *
 * O ramo de falha reúne o SQLSTATE e as **marcas** que a mensagem cita — o tipo enumerado e o rótulo
 * —, e não a frase inteira: é o que a CA-13 cobra, sem amarrar a asserção à redação do servidor.
 */
function desfechoDaTentativa(tentativa: Resultado<string | undefined>): string {
  if (tentativa.ok) {
    return tentativa.valor === undefined ? 'GRAVOU sem id' : 'GRAVOU com id';
  }

  const marcas = [
    TIPO_ENUMERADO_DO_TIPO,
    TIPO_ENUMERADO_DA_ORIGEM,
    TIPO_RECUSADO,
    ORIGEM_RECUSADA,
  ].filter((marca) => mensagemDo(tentativa.erro).includes(marca));

  return [sqlstate(tentativa.erro) ?? 'sem sqlstate', ...marcas].join(' · ');
}

/**
 * As ocorrências de cada termo nos nomes informados, no formato `<termo> em <nome>`.
 *
 * É a MESMA função para a varredura de veredito e para o controle positivo — é o par que detecta, e
 * não a asserção isolada. Mesma forma de `ocorrenciasDeTermos` em `vocabulario-canonico.spec.ts`.
 */
function ocorrenciasDeTermos(nomes: readonly string[], termos: readonly string[]): string[] {
  const ocorrencias: string[] = [];
  for (const termo of termos) {
    const agulha = termo.toLowerCase();
    for (const nome of nomes) {
      if (nome.toLowerCase().includes(agulha)) {
        ocorrencias.push(`${termo} em ${nome}`);
      }
    }
  }
  return ocorrencias;
}

/** A linha sem o carimbo do banco — o que a igualdade de corpo inteiro compara. */
function semOInstante(evento: LinhaDeEventoBancario): Omit<LinhaDeEventoBancario, 'ocorridoEm'> {
  return {
    tipo: evento.tipo,
    origem: evento.origem,
    diagnostico: evento.diagnostico,
    valorInformado: evento.valorInformado,
  };
}

/**
 * Semeia, sob o contexto da empresa A, o cadastro de apoio e as duas cobranças.
 *
 * Tudo numa unidade só, na ordem pai → filho: a chave estrangeira composta exige que o conjunto
 * exista antes do imóvel, e o imóvel, o locador e o locatário antes do contrato. As instruções são
 * cruas porque o objeto deste arquivo é a trilha, e não o cadastro — montar o apoio pelas portas
 * daqueles agregados faria estes casos reprovarem por defeito alheio.
 *
 * Nenhuma instrução compara `empresa_id` com coisa alguma: a empresa é **proposta** e a política a
 * aceita ou recusa (ADR-0008). Mesmo desenho de `semearApoio` em `isolamento-bancario.spec.ts`.
 */
async function semearApoio(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.conjunto (id, empresa_id, nome)
        VALUES (${CONJUNTO_DE_A}, ${EMPRESA_A.id}, ${'Conjunto da trilha'})
      `;
      await tx`
        INSERT INTO negocio.imovel
                    (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                     logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
        VALUES (${IMOVEL_DE_A}, ${EMPRESA_A.id}, ${CONJUNTO_DE_A}, ${'Imóvel da trilha'},
                ${'IM-TRILHA'}, ${'RESIDENCIAL'}::negocio.tipo_imovel,
                ${'Rua das Laranjeiras'}, ${'200'}, ${null}, ${'Centro'}, ${'Teresina'}, ${'PI'},
                ${'64000000'}, ${'DISPONIVEL'}::negocio.status_locacao)
      `;
      for (const pessoa of [
        { relacao: 'negocio.locador', id: LOCADOR_DE_A, marca: 'locador' },
        { relacao: 'negocio.locatario', id: LOCATARIO_DE_A, marca: 'locatario' },
      ]) {
        await tx.unsafe(
          `INSERT INTO ${pessoa.relacao}
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
           VALUES ($1, $2, $3, 'PESSOA_FISICA', $4, NULL, $5, '8699990000',
                   'Rua das Laranjeiras', '200', NULL, 'Centro', 'Teresina', 'PI', '64000000')`,
          [
            pessoa.id,
            EMPRESA_A.id,
            `Cadastro ${pessoa.marca} da trilha`,
            `DOC-TRILHA-${pessoa.marca}`,
            `trilha.${pessoa.marca}@exemplo.com.br`,
          ],
        );
      }
      // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`,
      // e o que este arquivo mede não é a vigência única.
      await tx`
        INSERT INTO negocio.contrato
                    (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                     data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
        VALUES (${CONTRATO_DE_A}, ${EMPRESA_A.id}, ${'CTR-2026-93901'}, ${IMOVEL_DE_A},
                ${LOCADOR_DE_A}, ${LOCATARIO_DE_A}, ${'RASCUNHO'}::negocio.status_contrato,
                ${'2026-01-10'}::date, ${12}, ${'1500.00'}, ${10})
      `;
      for (const cobranca of [
        { id: COBRANCA_DOS_INSERTS, codigo: CODIGO_DOS_INSERTS },
        { id: COBRANCA_DA_TRILHA, codigo: CODIGO_DA_TRILHA },
      ]) {
        await tx`
          INSERT INTO negocio.cobranca
                      (id, empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                       data_vencimento, valor_original)
          VALUES (${cobranca.id}, ${EMPRESA_A.id}, ${cobranca.codigo}, ${CONTRATO_DE_A},
                  ${'ALUGUEL'}::negocio.natureza_cobranca, ${'01/01/2026 à 31/01/2026'},
                  ${'2026-01-01'}::date, ${'2026-01-10'}::date, ${'2000.00'})
        `;
      }
    });
  });
}

/**
 * A MESMA instrução para os três pares de rótulos — o que varia entre as tentativas são só eles.
 *
 * Ela corre sob o contexto da empresa A, com o papel da aplicação, e **não compara `empresa_id` com
 * coisa alguma**: a empresa sai da expressão que as próprias políticas avaliam, e o `WITH CHECK` é
 * quem aceita ou recusa a linha (ADR-0008). `RETURNING id` é o que torna o sucesso observável — o
 * controle antivácuo do caso.
 */
async function tentarGravar(
  acesso: AcessoAoBanco,
  tipo: string,
  origem: string,
): Promise<Resultado<string | undefined>> {
  return tentar(async () =>
    contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ id: string }[]>`
          INSERT INTO negocio.evento_bancario (empresa_id, cobranca_id, tipo, origem)
          VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                  ${COBRANCA_DOS_INSERTS},
                  ${tipo}::negocio.tipo_de_evento_bancario,
                  ${origem}::negocio.origem_do_evento_bancario)
          RETURNING id
        `;
        return linha?.id;
      }),
    ),
  );
}

describe('CT-939 — os enums da trilha são fechados e o banco recusa valor fora deles', () => {
  let banco: BancoMigrado;
  let acesso: AcessoAoBanco;

  beforeAll(async () => {
    banco = await bancoEfemero();
    acesso = abrirAcessoAoBanco({
      cadeiaDeConexao: banco.cadeiaConexao,
      maximoDeConexoes: RESERVA_DE_UMA,
    });
    // O apoio é semeado UMA vez: as chaves são fixas, e uma segunda semeadura reprovaria por
    // `23505` antes de qualquer asserção — o que esconderia o que os casos medem.
    await semearApoio(acesso);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await acesso?.encerrar();
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-939 — sete tipos e três origens no catálogo, e os dois valores de fora recusados com 22P02',
    async () => {
      const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });

      try {
        // --- 1 e 2. Os rótulos do CATÁLOGO, por igualdade de lista ORDENADA -----------------
        //
        // A ordem é conteúdo: um enum do PostgreSQL a guarda, e é ela que governa comparação e
        // ordenação do tipo. `enumsortorder` é a ordem DECLARADA, e não a alfabética.
        const enums = await sql<{ tipo: string; rotulos: string[] }[]>`
          SELECT t.typname AS tipo,
                 array_agg(e.enumlabel ORDER BY e.enumsortorder) AS rotulos
            FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
           WHERE n.nspname = 'negocio'
             AND t.typname IN ('tipo_de_evento_bancario', 'origem_do_evento_bancario')
           GROUP BY t.typname
           ORDER BY t.typname
        `;

        expect(enums.map((linha) => ({ tipo: linha.tipo, rotulos: linha.rotulos }))).toEqual([
          { tipo: 'origem_do_evento_bancario', rotulos: [...ORIGENS_DECLARADAS] },
          { tipo: 'tipo_de_evento_bancario', rotulos: [...TIPOS_DECLARADOS] },
        ]);

        // --- 3, 4 e o controle antivácuo. A MESMA instrução, três pares de rótulos ----------
        //
        // As três numa igualdade só, nesta ordem: as duas recusas nomeadas pelo SQLSTATE e pelo tipo
        // enumerado, e o par legítimo GRAVANDO com `id`. Sem a terceira perna, uma tabela quebrada
        // faria as duas recusas passarem por motivo errado — e o caso aprovaria um banco em que nada
        // grava.
        const oTipoDeFora = await tentarGravar(acesso, TIPO_RECUSADO, ORIGEM_LEGITIMA);
        const aOrigemDeFora = await tentarGravar(acesso, TIPO_LEGITIMO, ORIGEM_RECUSADA);
        const oParLegitimo = await tentarGravar(acesso, TIPO_LEGITIMO, ORIGEM_LEGITIMA);

        expect([
          desfechoDaTentativa(oTipoDeFora),
          desfechoDaTentativa(aOrigemDeFora),
          desfechoDaTentativa(oParLegitimo),
        ]).toEqual([
          `${VALOR_FORA_DO_ENUM} · ${TIPO_ENUMERADO_DO_TIPO} · ${TIPO_RECUSADO}`,
          `${VALOR_FORA_DO_ENUM} · ${TIPO_ENUMERADO_DA_ORIGEM} · ${ORIGEM_RECUSADA}`,
          'GRAVOU com id',
        ]);

        // O `code` isolado, sobre o valor EXATO — é o que a §4 da task cobra literalmente
        // (`code === '22P02'`), e não "algum erro". A forma de lista nomeia qual das duas divergiu.
        expect(
          [oTipoDeFora, aOrigemDeFora].map((tentativa) =>
            tentativa.ok ? 'GRAVOU' : sqlstate(tentativa.erro),
          ),
        ).toEqual([VALOR_FORA_DO_ENUM, VALOR_FORA_DO_ENUM]);
      } finally {
        await sql.end();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-939 (b) — nenhum dos dez literais carrega termo do provedor, e a varredura acha os que carregam', () => {
    // SUT_IS_CORRECT_BECAUSE: eram OITO até a `0019`. Os dois rótulos que ela acrescentou —
    // `NOTICIA_RECUSADA` e `NOTICIA_DO_PROVEDOR` — entram no conjunto varrido, e a CA-20 continua
    // sendo cobrada deles como dos oito anteriores: nenhum dos dois fala o vocabulário do provedor.
    const dezLiterais = [...TIPOS_DECLARADOS, ...ORIGENS_DECLARADAS];

    // Âncora antivácuo do conjunto varrido: são dez, e uma lista encolhida reprova aqui antes de a
    // varredura decidir qualquer coisa.
    expect(dezLiterais).toHaveLength(10);

    // Controle positivo (AP-29): a MESMA função, aplicada a um objeto cuja chave é cada termo,
    // devolve a lista inteira. Sem ele, um detector que nunca acha nada aprovaria um vocabulário
    // vazando tudo — e a varredura de veredito abaixo passaria por não ter olhado.
    const objetoDeControle = Object.fromEntries(TERMOS_DO_PROVEDOR.map((termo) => [termo, true]));

    expect(ocorrenciasDeTermos(Object.keys(objetoDeControle), TERMOS_DO_PROVEDOR)).toEqual(
      TERMOS_DO_PROVEDOR.map((termo) => `${termo} em ${termo}`),
    );

    // O veredito: nenhum dos dez rótulos publicados carrega vocabulário do provedor (CA-20).
    expect(ocorrenciasDeTermos(dezLiterais, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it(
    'CT-939 (c) — a porta grava as seis classes, a trilha volta do mais recente ao mais antigo, e outra empresa lê vazio',
    async () => {
      // Uma unidade de trabalho por efeito, como a operação faz: `ocorrido_em` nasce do
      // `DEFAULT now()`, que é o instante do INÍCIO da transação — gravar os seis numa unidade só
      // daria seis carimbos idênticos, e a ordem deixaria de ser observável.
      const efeitos: readonly EventoBancarioNovo[] = [
        { cobrancaId: COBRANCA_DA_TRILHA, tipo: 'BOLETO_EMITIDO', origem: 'ATO_DO_ADMIN' },
        { cobrancaId: COBRANCA_DA_TRILHA, tipo: 'BOLETO_REVOGADO', origem: 'ATO_DO_ADMIN' },
        {
          cobrancaId: COBRANCA_DA_TRILHA,
          tipo: 'EMISSAO_RECUSADA',
          origem: 'ATO_DO_ADMIN',
          // Texto do provedor **tal como respondido** (RN-15): entra opaco, e nada o lê para
          // decidir. É o campo que a ADR-0001 mantém fora de toda regra do produto.
          diagnostico: 'motivo que o produto não reconhece',
        },
        {
          cobrancaId: COBRANCA_DA_TRILHA,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
          valorInformado: '2000.00',
        },
        { cobrancaId: COBRANCA_DA_TRILHA, tipo: 'LIQUIDACAO_ESTORNADA', origem: 'CONFERENCIA' },
        {
          cobrancaId: COBRANCA_DA_TRILHA,
          tipo: 'DIVERGENCIA_DE_VALOR',
          origem: 'CONFERENCIA',
          diagnostico: 'valor creditado diverge do esperado',
          valorInformado: '1234.56',
        },
      ];

      for (const efeito of efeitos) {
        await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
          acesso.emUnidadeDeTrabalho(async (tx) => registrarEventoBancario(tx, efeito)),
        );
      }

      // A leitura é pela chave EXPOSTA — o código —, que é a única que a borda tem em mãos: nenhum
      // símbolo publicado de `@sysloc/db` entrega o UUID interno de uma cobrança. A tradução é da
      // junção, dentro da instrução, como em `lerEnviosDaCobranca`.
      const trilha = await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => lerTrilhaDaCobranca(tx, CODIGO_DA_TRILHA)),
      );

      // A igualdade do corpo INTEIRO, campo a campo, na ordem de leitura — o inverso da ordem de
      // gravação, porque a trilha é publicada do mais recente para o mais antigo. `ocorridoEm` sai
      // daqui porque é o relógio do banco, e é asserido logo abaixo pela forma e pela ordem.
      //
      // `valorInformado` sai em **número**, e a diferença entre o que entrou (`'1234.56'`) e o que
      // sai (`1234.56`) é conteúdo: a conversão de `numeric` acontece no ponto único da tradução
      // (`eventoPublicado`), como em `cobrancaPublicada` — sem ela o JSON publicaria a cadeia entre
      // aspas contra um esquema que declara `z.number()`. `'2000.00'` volta como `2000` pelo mesmo
      // caminho, e o nulo atravessa intacto (`Number(null)` seria `0`, isto é, "o provedor informou
      // zero" no lugar de "não informou").
      expect(trilha.map(semOInstante)).toEqual([
        {
          tipo: 'DIVERGENCIA_DE_VALOR',
          origem: 'CONFERENCIA',
          diagnostico: 'valor creditado diverge do esperado',
          valorInformado: 1234.56,
        },
        {
          tipo: 'LIQUIDACAO_ESTORNADA',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: null,
        },
        {
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: 2000,
        },
        {
          tipo: 'EMISSAO_RECUSADA',
          origem: 'ATO_DO_ADMIN',
          diagnostico: 'motivo que o produto não reconhece',
          valorInformado: null,
        },
        {
          tipo: 'BOLETO_REVOGADO',
          origem: 'ATO_DO_ADMIN',
          diagnostico: null,
          valorInformado: null,
        },
        {
          tipo: 'BOLETO_EMITIDO',
          origem: 'ATO_DO_ADMIN',
          diagnostico: null,
          valorInformado: null,
        },
      ]);

      // O carimbo é cadeia ISO-8601 em UTC — nunca um `Date` do driver, que sairia no fuso do
      // processo e faria dois hosts lerem instantes diferentes do mesmo fato.
      const instantes = trilha.map((evento) => evento.ocorridoEm);
      expect(instantes.filter((instante) => !INSTANTE_ISO_UTC.test(instante))).toEqual([]);

      // E a ordem é ESTRITAMENTE decrescente: sem esta asserção, uma projeção que devolvesse a lista
      // em qualquer ordem passaria pela igualdade acima assim que os rótulos coincidissem. Os seis
      // instantes são distintos porque cada efeito foi gravado em sua própria unidade de trabalho.
      const foraDeOrdem = instantes.filter(
        (instante, posicao) => posicao > 0 && instante >= (instantes[posicao - 1] ?? ''),
      );
      expect(foraDeOrdem).toEqual([]);
      expect(new Set(instantes).size).toBe(efeitos.length);

      // O recorte é da POLÍTICA, e não de um `WHERE` escrito na aplicação (ADR-0008): sob o contexto
      // da empresa B a MESMA leitura, com o MESMO código, devolve vazio — sem erro e sem recusa
      // nomeada. A junção não alcança a cobrança porque a política a esconde, e não porque algo aqui
      // comparou empresa. A ausência é indistinguível da cobrança sem trilha, e quem a traduz em
      // `404` é a borda, num ponto único.
      const sobOutraEmpresa = await contextoDeTenant.executarCom(CONTEXTO_DE_B, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => lerTrilhaDaCobranca(tx, CODIGO_DA_TRILHA)),
      );

      expect(sobOutraEmpresa).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});
