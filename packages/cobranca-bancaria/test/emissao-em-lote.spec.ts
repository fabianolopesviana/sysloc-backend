/**
 * O **percurso da emissão em lote** — a prestação de contas, as duas classes de falha e a
 * idempotência da reexecução. T10 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-02    | CT-912 | Ao término de um lote em que k cobranças falharam por causa própria, existe
 * |          |        | EXATAMENTE um `item_da_emissao_em_lote` por cobrança tentada, com desfecho
 * |          |        | `EMITIDO` ou `RECUSADO`; todo `RECUSADO` carrega `motivo` não-nulo, igual
 * |          |        | BYTE A BYTE ao texto que o adaptador informou, e o `cobranca_id` da que
 * |          |        | falhou — por igualdade de conjunto. O lote termina com `concluido_em`
 * |          |        | não-nulo e `interrompido_em IS NULL`. E o `identificador_no_provedor`
 * |          |        | gravado é EXATAMENTE o que o produto compôs e ENVIOU no pedido. |
 * | CA-02    | CT-913 | Falha atribuível a uma cobrança marca APENAS aquela — item `RECUSADO` mais
 * |          |        | EXATAMENTE um evento `{EMISSAO_RECUSADA, ATO_DO_ADMIN}` com `diagnostico`
 * |          |        | igual ao texto informado — e NÃO interrompe: as cobranças POSTERIORES à
 * |          |        | falha são tentadas e emitidas, e o lote fica com `interrompido_em IS NULL`
 * |          |        | e `motivo_da_interrupcao IS NULL`. |
 * | CA-03    | CT-914 | Falha atribuível à empresa grava `interrompido_em` e `motivo_da_interrupcao`
 * |          |        | e CESSA o percurso: são EXATAMENTE 2 itens, ambos `EMITIDO`, das posições
 * |          |        | 1 e 2; a do ponto de falha e as três posteriores ficam SEM item e com
 * |          |        | `nosso_numero IS NULL`; `concluido_em IS NULL`; e o adaptador recebeu
 * |          |        | EXATAMENTE 3 pedidos — nenhum depois do ponto. |
 * | CA-04    | CT-915 | Um segundo lote da mesma competência seleciona exatamente o COMPLEMENTO do
 * |          |        | primeiro: grava EXATAMENTE 2 itens, as 4 já emitidas mantêm `nosso_numero`
 * |          |        | idêntico ao retrato anterior, as 2 recusadas passam a tê-lo, nenhuma
 * |          |        | cobrança recebe segunda emissão, e os 6 `identificador_no_provedor` têm 18
 * |          |        | posições e são DISTINTOS entre si — o contador nunca reusa (ADR-0020/0033). |
 *
 * Rastreabilidade: `CA-02 → CT-912 (RN-02)` · `CA-02 → CT-913 (RN-02)` ·
 * `CA-03 → CT-914 (RN-02)` · `CA-04 → CT-915 (RN-03)`.
 *
 * ===========================================================================
 * Qual asserção DISCRIMINA cada defeito (prova do P4 — aqui é de RACIOCÍNIO)
 * ===========================================================================
 *
 * As quatro asserções deste arquivo são **comportamentais**: exercitam `executarEmissaoEmLote`
 * contra banco real e observam o estado em repouso. A `.claude/rules/testing-stack.md` não lhes cobra
 * prova de falsificação por execução, e o **P4 do Protocolo Antirregressão a PROÍBE** para elas
 * (2026-08-17) — reintroduzir defeito comportamental "para conferir" é campanha de mutantes com
 * outro nome, e mutation testing está fora da stack deste projeto. O que se declara é qual asserção
 * discrimina:
 *
 *   * **"o lote seguiu" vs "o lote parou"** — as posições **3, 4 e 5** do CT-913 com `nosso_numero`
 *     não-nulo. Sem elas, um percurso que interrompesse na primeira recusa passaria: a cobrança 2
 *     continuaria sem boleto e o item `RECUSADO` continuaria lá.
 *   * **"interrompeu" vs "tentou todas e recusou 4"** — a **contagem exata** de itens (`=== 2`) do
 *     CT-914, somada às posições 3 a 6 **sem item**. Uma asserção por presença de `interrompido_em`
 *     passaria nos dois percursos, porque um percurso que tentasse todas e depois interrompesse
 *     também grava o carimbo.
 *   * **"a idempotência existe" vs "o segundo lote reemitiu tudo"** — a comparação do CT-915 contra o
 *     **retrato anterior**, cobrança a cobrança. Sem ela, um percurso que reemitisse as seis passaria:
 *     ao final, as seis teriam `nosso_numero` não-nulo do mesmo jeito.
 *   * **"o motivo é preservado" vs "o motivo é resumido/traduzido"** — a igualdade byte a byte do
 *     CT-912 contra os dois textos distintos, lidos do **banco** e não do dublê.
 *
 * ===========================================================================
 * O DUBLÊ é IMPLEMENTAÇÃO da porta — nunca `vi.mock`
 * ===========================================================================
 *
 * {@link adaptadorQueRecusaNasPosicoes} satisfaz `AdaptadorCobrancaBancaria` com a mesma assinatura
 * pela qual a produção é exercitada, no molde do CT-809 e do CT-933 de
 * `./vocabulario-canonico.spec.ts`. O que ele substitui é a **fronteira externa** — o HTTP do
 * provedor —, que é exatamente o que a porta da ADR-0001 existe para permitir trocar. Nenhuma
 * bandeira, ramo ou parâmetro de teste foi acrescentado ao adaptador de produção, e este arquivo não
 * tem caminho para construí-lo.
 *
 * Ele decide **por posição de chamada**, e não por conteúdo do pedido: o `PedidoDeEmissao` não
 * carrega o código da cobrança — e não deve carregar —, de modo que a posição é o único eixo pelo
 * qual o dublê pode escolher. O conjunto chega ordenado por código (`ORDER BY codigo` no predicado),
 * então posição e cobrança se correspondem, e o arranjo declara essa correspondência por extenso.
 *
 * ⚠️ **As três operações que o percurso não usa LEVANTAM.** Não é zelo: é asserção. Um percurso que
 * consultasse a situação ou pedisse revogação durante a emissão derrubaria o caso, em vez de passar
 * despercebido.
 *
 * ⚠️ **A GUARDA é a de produção**, sobre um diretório descartável do sistema. Ela não é fronteira
 * externa a substituir — é filesystem real, e é o que faz `caminhoDoArquivo` ser um fato observável
 * em vez de um valor combinado entre teste e teste.
 *
 * ===========================================================================
 * As PORTAS DE DADOS são satisfeitas pelas funções REAIS de `@sysloc/db`
 * ===========================================================================
 *
 * `identificador`, `dados`, `gravarEmissao`, `gravarRecusa`, `concluir` e `interromper` são
 * satisfeitas exatamente como a borda da tarefa (T16) as satisfará: por **aplicação parcial**, cada
 * uma abrindo a própria unidade de trabalho sob o contexto de tenant, no molde literal de
 * `apps/worker/src/tarefas/regua.ts`. É o que faz este arquivo provar o **caminho**, e não apenas a
 * função — e é o que torna o estado asserido um **side-effect em repouso no banco**, e não um valor
 * que o dublê devolveu.
 *
 * ⚠️ **A precondição privilegiada — o contexto de tenant — vem da unidade de trabalho REAL**
 * (`contextoDeTenant.executarCom` mais `acesso.emUnidadeDeTrabalho`), como em
 * `packages/db/test/emissao-em-lote.spec.ts` e `apps/worker/test/regua.spec.ts`. Nenhuma assinatura
 * de produção recebeu `empresaId`, e **nenhuma consulta deste arquivo escreve `WHERE empresa_id`**:
 * quem recorta é a política (ADR-0008).
 *
 * ===========================================================================
 * Por que este arquivo mora AQUI, e o que isso custou ao manifesto
 * ===========================================================================
 *
 * O SUT é o percurso, que vive em `../src/emissao-em-lote.ts`; a tech spec §19.2 declara esta suíte
 * neste diretório, com instância efêmera de PostgreSQL. Para isso, `@sysloc/db` entrou em
 * `devDependencies` — e **só nelas**. O `src/` deste pacote continua sem conhecer a camada de dados
 * (ADR-0025), a dependência não atravessa o `exports` e não aparece em `.d.ts` algum. A nota do
 * manifesto que dizia que essa aresta "fecha ciclo" foi **medida e emendada** na T10; a medição e a
 * condição que a tornaria verdadeira estão escritas lá e em `../tsconfig.json`.
 *
 * ===========================================================================
 * De onde vêm o banco e o diretório (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera **própria**, migrada e semeada, descartada ao fim, e de um diretório
 * temporário do sistema, removido no fecho. Nenhuma coordenada de conexão é lida do ambiente — a
 * suíte nunca toca o banco que atende a operação.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirEmissaoEmLote,
  concluirLote,
  contextoDeTenant,
  EMPRESA_A,
  gravarBoletoDaCobranca,
  interromperLote,
  localizarCobranca,
  localizarPessoa,
  proximoIdentificadorBancario,
  registrarEventoBancario,
  registrarItemDoLote,
  selecionarCobrancasSemBoleto,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import { criarSegredoOperavel } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada — em
//        `devDependencies`, ver o `"//"` do `package.json` —, então não há dependência oculta; o que
//        não existe é FRONTEIRA para os diretórios `test/`, e este é o PRIMEIRO consumidor do padrão
//        dentro de `packages/cobranca-bancaria/test/`.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`. É também a alternativa que devolveria `rootDir` a `"."`
//        neste pacote, hoje `"../.."` por causa desta travessia.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { type BancoMigrado, bancoEfemero } from '../../db/test/banco-efemero.ts';
import {
  type CobrancaDoLote,
  type DesfechoDoLote,
  executarEmissaoEmLote,
  type TrabalhoDoLote,
} from '../src/emissao-em-lote.ts';
import { criarGuardaDeBoletos } from '../src/guarda-de-boletos.ts';
// Os dois tipos vêm do vocabulário canônico, e não de recortes reescritos aqui: a lista de pedidos
// capturados carrega o tipo REAL que atravessa a porta, e a classe da falha é a união fechada — um
// literal escrito à mão aceitaria uma classe que o domínio não conhece.
import type { ClasseDaFalha, PedidoDeEmissao } from '../src/modelo-canonico.ts';
import type { AdaptadorCobrancaBancaria } from '../src/porta-de-cobranca.ts';
import { diferencasDeConjunto } from './conjuntos.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 150_000;

/** Cada caso percorre até seis cobranças, e cada uma abre quatro unidades de trabalho. */
const LIMITE_DO_CASO_MS = 120_000;

/** Reserva de conexões: o arranjo e o percurso tocam o banco em unidades sequenciais. */
const RESERVA_DE_CONEXOES = 2;

// ---------------------------------------------------------------------------
// Os atores da carga inicial — derivados dela, nunca redigitados
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/**
 * O usuário que dispara os lotes.
 *
 * **Derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que
 * `emissao_em_lote_usuario_empresa_fkey` cobra é o mesmo que `semente.ts` gravou, e copiar o
 * identificador criaria uma segunda declaração livre para divergir. Mesma forma de
 * `packages/db/test/emissao-em-lote.spec.ts`.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);
  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }
  return usuario;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);

// ---------------------------------------------------------------------------
// O arranjo — uma competência por caso, para que os conjuntos não se cruzem
// ---------------------------------------------------------------------------

/**
 * A competência de cada caso — **primeiro dia do mês**, como o `check` do banco exige.
 *
 * Uma por caso, e não uma para o arquivo: o conjunto do lote é definido pelo predicado
 * `competencia = …`, de modo que competências distintas dão a cada caso um conjunto próprio sem que
 * nada precise apagar linhas entre eles. Apagar seria pior — esconderia o efeito do caso anterior,
 * que em dois deles é justamente o que se quer observar.
 */
const COMPETENCIA_DO_CT912 = '2026-01-01';
const COMPETENCIA_DO_CT913 = '2026-02-01';
const COMPETENCIA_DO_CT914 = '2026-03-01';
const COMPETENCIA_DO_CT915 = '2026-04-01';

/** O vencimento das cobranças do arranjo — não participa de recorte nenhum. */
const VENCIMENTO = '2026-06-10';

/** O valor de cada cobrança, em `numeric(15,2)` — texto, como a coluna o guarda. */
const VALOR_ORIGINAL = '1500.00';

/** O valor que o pedido de emissão carrega, já em número — o que a view deriva sem mora. */
const VALOR_ESPERADO_NO_PEDIDO = 1500;

/** Os cadastros de apoio, semeados uma vez: a cadeia inteira é `NOT NULL` até a cobrança. */
const CONJUNTO_DE_A = 'aaaaaaaa-9120-4000-8000-000000000001';
const IMOVEL_DE_A = 'aaaaaaaa-9120-4000-8000-000000000002';
const LOCADOR_DE_A = 'aaaaaaaa-9120-4000-8000-000000000003';
const LOCATARIO_DE_A = 'aaaaaaaa-9120-4000-8000-000000000004';
const CONTRATO_DE_A = 'aaaaaaaa-9120-4000-8000-000000000005';

/** O cadastro do locatário, escrito por extenso: é ele que o pedido de emissão carrega. */
const LOCATARIO_SEMEADO = {
  nome: 'Locatário do lote',
  documento: '12345678901',
  logradouro: 'Rua das Acácias',
  numero: '300',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Teresina',
  estado: 'PI',
  cep: '64000000',
} as const;

/** Quantas posições o identificador perante o provedor tem — o literal que o CT-915 fixa. */
const POSICOES_DO_IDENTIFICADOR = 18;

/** Os dois textos de recusa do CT-912 — **distintos**, para que a igualdade não confunda um com o outro. */
const RECUSA_DE_CADASTRO = 'cadastro do sacado incompleto: bairro ausente';
const RECUSA_DE_VALOR = 'valor do titulo abaixo do minimo aceito';

/** O texto de recusa do CT-913 — o que o `diagnostico` do evento tem de carregar byte a byte. */
const RECUSA_DO_CT913 = 'cadastro incompleto: documento do sacado invalido';

/** O texto da falha da empresa no CT-914 — o que o `motivo_da_interrupcao` tem de carregar. */
const FALHA_DA_EMPRESA = 'certificado da empresa inservivel para o ambiente do provedor';

/** As duas recusas do primeiro lote do CT-915. */
const RECUSA_DO_CT915_A = 'recusa da terceira cobranca do lote';
const RECUSA_DO_CT915_B = 'recusa da quinta cobranca do lote';

/** Os rótulos do enum de desfecho do item — presos ao vocabulário do banco. */
const DESFECHO_EMITIDO = 'EMITIDO';
const DESFECHO_RECUSADO = 'RECUSADO';

/** O que o dublê antepõe aos bytes do documento, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let diretorioDosBoletos: string;

/** Contador que mantém códigos e identificadores das cobranças distintos entre os casos. */
let sequenciaDaCobranca = 0;

// ---------------------------------------------------------------------------
// Acessórios de arranjo — todo estado nasce pelo caminho legítimo
// ---------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto da empresa A, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par da operação. Nenhum `SET app.empresa_id` é escrito à mão, e
 * nenhuma consulta compara empresa com coisa alguma.
 */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    CONTEXTO_DE_A,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Semeia a cadeia de cadastros que a cobrança exige — conjunto, imóvel, as duas pessoas, contrato. */
async function semearApoio(): Promise<void> {
  await emUnidade(async (tx) => {
    await tx`
      INSERT INTO negocio.conjunto (id, empresa_id, nome)
      VALUES (${CONJUNTO_DE_A}, ${EMPRESA_A.id}, ${'Conjunto do percurso'})
    `;
    await tx`
      INSERT INTO negocio.imovel
                  (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                   logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
      VALUES (${IMOVEL_DE_A}, ${EMPRESA_A.id}, ${CONJUNTO_DE_A}, ${'Imóvel do percurso'},
              ${'IM-PERCURSO'}, ${'RESIDENCIAL'}::negocio.tipo_imovel,
              ${LOCATARIO_SEMEADO.logradouro}, ${LOCATARIO_SEMEADO.numero}, ${null},
              ${LOCATARIO_SEMEADO.bairro}, ${LOCATARIO_SEMEADO.cidade}, ${LOCATARIO_SEMEADO.estado},
              ${LOCATARIO_SEMEADO.cep}, ${'DISPONIVEL'}::negocio.status_locacao)
    `;
    await tx`
      INSERT INTO negocio.locador
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (${LOCADOR_DE_A}, ${EMPRESA_A.id}, ${'Locador do percurso'},
              ${'PESSOA_FISICA'}::negocio.tipo_pessoa, ${'98765432100'}, ${null},
              ${'locador.percurso@exemplo.com.br'}, ${'8699990000'},
              ${LOCATARIO_SEMEADO.logradouro}, ${LOCATARIO_SEMEADO.numero}, ${null},
              ${LOCATARIO_SEMEADO.bairro}, ${LOCATARIO_SEMEADO.cidade}, ${LOCATARIO_SEMEADO.estado},
              ${LOCATARIO_SEMEADO.cep})
    `;
    await tx`
      INSERT INTO negocio.locatario
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (${LOCATARIO_DE_A}, ${EMPRESA_A.id}, ${LOCATARIO_SEMEADO.nome},
              ${'PESSOA_FISICA'}::negocio.tipo_pessoa, ${LOCATARIO_SEMEADO.documento}, ${null},
              ${'locatario.percurso@exemplo.com.br'}, ${'8699990001'},
              ${LOCATARIO_SEMEADO.logradouro}, ${LOCATARIO_SEMEADO.numero},
              ${LOCATARIO_SEMEADO.complemento}, ${LOCATARIO_SEMEADO.bairro},
              ${LOCATARIO_SEMEADO.cidade}, ${LOCATARIO_SEMEADO.estado}, ${LOCATARIO_SEMEADO.cep})
    `;
    // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`, e
    // o que este arquivo mede não é a vigência única.
    await tx`
      INSERT INTO negocio.contrato
                  (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                   data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
      VALUES (${CONTRATO_DE_A}, ${EMPRESA_A.id}, ${'CTR-2026-91201'}, ${IMOVEL_DE_A},
              ${LOCADOR_DE_A}, ${LOCATARIO_DE_A}, ${'RASCUNHO'}::negocio.status_contrato,
              ${'2026-01-10'}::date, ${12}, ${VALOR_ORIGINAL}, ${10})
    `;
  });
}

/**
 * Semeia `quantidade` cobranças em aberto e sem boleto na competência informada.
 *
 * Devolve os **códigos na ordem em que o predicado os entregará** (`ORDER BY codigo`), que é a ordem
 * do percurso — é ela que dá sentido a *"a segunda cobrança"* nos cards. A sequência é global ao
 * arquivo, de modo que os códigos crescem monotonicamente e a ordem por código coincide com a de
 * criação.
 */
async function semearCobrancas(competencia: string, quantidade: number): Promise<string[]> {
  const codigos: string[] = [];

  await emUnidade(async (tx) => {
    for (let indice = 0; indice < quantidade; indice += 1) {
      sequenciaDaCobranca += 1;
      const codigo = `COB-2026-${String(sequenciaDaCobranca).padStart(7, '0')}`;
      codigos.push(codigo);

      await tx`
        INSERT INTO negocio.cobranca
                    (empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                     data_vencimento, valor_original)
        VALUES (${EMPRESA_A.id}, ${codigo}, ${CONTRATO_DE_A},
                ${'ALUGUEL'}::negocio.natureza_cobranca, ${'Aluguel do percurso'},
                ${competencia}::date, ${VENCIMENTO}::date, ${VALOR_ORIGINAL})
      `;
    }
  });

  return codigos;
}

// ---------------------------------------------------------------------------
// O dublê — IMPLEMENTAÇÃO da porta, que decide por posição de chamada
// ---------------------------------------------------------------------------

/** O que o adaptador de teste responde numa posição declarada. */
interface RecusaDeclarada {
  readonly classe: ClasseDaFalha;
  readonly motivo: string;
}

/** O adaptador de teste, com os pedidos que chegaram a ele — a lista é o que prova o que NÃO foi tentado. */
interface AdaptadorDeTeste {
  readonly porta: AdaptadorCobrancaBancaria;
  readonly pedidos: readonly PedidoDeEmissao[];
}

/**
 * A operação que o percurso **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: um percurso que consultasse a situação ou pedisse revogação durante a
 * emissão derrubaria o caso no ponto, em vez de passar despercebido por ninguém ter olhado.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`o percurso do lote chamou uma operação que ele não deve chamar: ${nome}`);
  };
}

/**
 * Uma implementação de `AdaptadorCobrancaBancaria` que recusa nas posições declaradas.
 *
 * A posição é **1-indexada** e conta as chamadas a `emitir`, na ordem do percurso. O boleto aceito é
 * derivado do `identificadorNoProvedor` **recebido no pedido**, e não de um valor combinado: é isso
 * que permite ao caso afirmar que o identificador gravado é o que foi ENVIADO.
 */
function adaptadorQueRecusaNasPosicoes(
  recusas: ReadonlyMap<number, RecusaDeclarada>,
): AdaptadorDeTeste {
  const pedidos: PedidoDeEmissao[] = [];

  const porta: AdaptadorCobrancaBancaria = {
    emitir: async (pedido) => {
      pedidos.push(pedido);
      const recusa = recusas.get(pedidos.length);

      if (recusa !== undefined) {
        return { aceito: false, classe: recusa.classe, motivo: recusa.motivo };
      }

      return {
        aceito: true,
        valor: {
          numeroDoTituloNoProvedor: `T-${pedido.identificadorNoProvedor}`,
          linhaDigitavel: `L-${pedido.identificadorNoProvedor}`,
          codigoDeBarras: `B-${pedido.identificadorNoProvedor}`,
          documento: Buffer.from(`${PREFIXO_DO_DOCUMENTO}${pedido.identificadorNoProvedor}`),
        },
      };
    },
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    consultarSituacao: operacaoNaoEsperada('consultarSituacao'),
  };

  return { porta, pedidos };
}

// ---------------------------------------------------------------------------
// A fiação — as portas de dados satisfeitas como a borda da tarefa (T16) as satisfará
// ---------------------------------------------------------------------------

/**
 * O segredo que atravessa a porta, opaco (ADR-0032).
 *
 * Ele é construído pelo caminho público de `@sysloc/shared`, e nada neste arquivo o abre: quem o
 * abriria é o adaptador de produção, que este arquivo não constrói. O conteúdo é irrelevante para o
 * percurso — o que importa é que o invólucro atravessa até o pedido sem ser tocado.
 */
const SEGREDO_DA_EMPRESA = criarSegredoOperavel({
  material: Buffer.from('material-de-verificacao'),
  senha: 'senha-de-verificacao',
});

/**
 * Abre um lote para a competência e devolve o `TrabalhoDoLote` inteiro, pronto para percorrer.
 *
 * As seis portas são fechadas por **aplicação parcial** sobre o `loteId` e sobre o contexto — é a
 * borda que decide sob que contexto e em que unidade de trabalho cada consulta corre, exatamente
 * como `apps/worker/src/tarefas/regua.ts` faz. É por isso que `TrabalhoDoLote` não tem `loteId`: não
 * há por onde o percurso alcançar outro lote.
 */
async function montarTrabalho(
  competencia: string,
  adaptador: AdaptadorCobrancaBancaria,
): Promise<{ trabalho: TrabalhoDoLote; loteId: string }> {
  const lote = await emUnidade(
    async (tx) => await abrirEmissaoEmLote(tx, { competencia, solicitadoPor: USUARIO_DE_A.id }),
  );

  const cobrancas = await emUnidade(
    async (tx) => await selecionarCobrancasSemBoleto(tx, competencia),
  );

  const loteId = lote.id;

  return {
    loteId,
    trabalho: {
      empresaId: EMPRESA_A.id,
      segredo: SEGREDO_DA_EMPRESA,
      cobrancas: cobrancas.map(({ id, codigo }) => ({ id, codigo })),
      adaptador,
      guarda: criarGuardaDeBoletos(diretorioDosBoletos),
      // Unidade PRÓPRIA, e a razão está na ADR-0020: o avanço do contador não participa do
      // desfazimento da unidade que grava.
      identificador: async () => await emUnidade(proximoIdentificadorBancario),
      dados: async (cobranca: CobrancaDoLote) =>
        await emUnidade(async (tx) => {
          const linha = await localizarCobranca(tx, cobranca.codigo);
          if (linha === undefined) {
            throw new Error(`o arranjo não encontrou a cobrança ${cobranca.codigo}`);
          }

          const locatario = await localizarPessoa(tx, 'locatario', linha.locatarioId);
          if (locatario === undefined) {
            throw new Error(`o arranjo não encontrou o locatário de ${cobranca.codigo}`);
          }

          return {
            // `valorTotal` é o valor DERIVADO pela view (ADR-0022) — original mais mora vigente —, e
            // é ele que se cobra. Nada aqui calcula: a derivação é do banco.
            valor: linha.valorTotal,
            vencimento: linha.dataVencimento,
            locatario: {
              nome: locatario.nome,
              documento: locatario.documentoPrincipal,
              logradouro: locatario.logradouro,
              numero: locatario.numero,
              complemento: locatario.complemento,
              bairro: locatario.bairro,
              cidade: locatario.cidade,
              estado: locatario.estado,
              cep: locatario.cep,
            },
          };
        }),
      // UMA unidade de trabalho, TRÊS escritas: os campos de conciliação, o item do lote e o evento.
      gravarEmissao: async (cobranca, boleto) =>
        await emUnidade(async (tx) => {
          await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
          await registrarItemDoLote(tx, {
            loteId,
            cobrancaId: cobranca.id,
            desfecho: 'EMITIDO',
          });
          await registrarEventoBancario(tx, {
            cobrancaId: cobranca.id,
            tipo: 'BOLETO_EMITIDO',
            origem: 'ATO_DO_ADMIN',
          });
        }),
      gravarRecusa: async (cobranca, motivo) =>
        await emUnidade(async (tx) => {
          await registrarItemDoLote(tx, {
            loteId,
            cobrancaId: cobranca.id,
            desfecho: 'RECUSADO',
            motivo,
          });
          await registrarEventoBancario(tx, {
            cobrancaId: cobranca.id,
            tipo: 'EMISSAO_RECUSADA',
            origem: 'ATO_DO_ADMIN',
            diagnostico: motivo,
          });
        }),
      concluir: async () => {
        await emUnidade(async (tx) => {
          await concluirLote(tx, loteId);
        });
      },
      interromper: async (motivo) => {
        await emUnidade(async (tx) => {
          await interromperLote(tx, loteId, motivo);
        });
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Coleta — o estado em repouso, lido do banco SEM cláusula de empresa (ADR-0008)
// ---------------------------------------------------------------------------

/** Um item da prestação de contas, como a tabela o guarda. */
interface ItemLido {
  readonly codigo: string;
  readonly desfecho: string;
  readonly motivo: string | null;
}

/** Os itens de um lote, na ordem em que foram registrados, com o CÓDIGO da cobrança que cada um nomeia. */
async function itensDoLote(loteId: string): Promise<ItemLido[]> {
  return await emUnidade(async (tx) => {
    const linhas = await tx<ItemLido[]>`
      SELECT c.codigo AS codigo, i.desfecho::text AS desfecho, i.motivo AS motivo
        FROM negocio.item_da_emissao_em_lote i
        JOIN negocio.cobranca c ON c.id = i.cobranca_id
       WHERE i.lote_id = ${loteId}
       ORDER BY i.registrado_em, c.codigo
    `;

    return linhas.map((linha) => ({
      codigo: linha.codigo,
      desfecho: linha.desfecho,
      motivo: linha.motivo,
    }));
  });
}

/** Os dois carimbos de desfecho do lote e o motivo — o fato cru, sem derivação. */
interface DesfechoGravado {
  readonly concluido: boolean;
  readonly interrompido: boolean;
  readonly motivoDaInterrupcao: string | null;
}

async function desfechoGravadoDoLote(loteId: string): Promise<DesfechoGravado> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<
      { concluidoEm: Date | null; interrompidoEm: Date | null; motivo: string | null }[]
    >`
      SELECT concluido_em AS "concluidoEm",
             interrompido_em AS "interrompidoEm",
             motivo_da_interrupcao AS motivo
        FROM negocio.emissao_em_lote
       WHERE id = ${loteId}
    `;

    if (linha === undefined) {
      throw new Error(`o lote ${loteId} não foi encontrado sob o contexto do arranjo`);
    }

    return {
      concluido: linha.concluidoEm !== null,
      interrompido: linha.interrompidoEm !== null,
      motivoDaInterrupcao: linha.motivo,
    };
  });
}

/** O que a emissão gravou numa cobrança — `null` nos dois campos quando ela nunca foi emitida. */
interface ConciliacaoLida {
  readonly codigo: string;
  readonly numeroDoTituloNoProvedor: string | null;
  readonly identificadorNoProvedor: string | null;
}

/**
 * Os campos de conciliação das cobranças informadas, na ordem em que os códigos chegaram.
 *
 * A coluna física do número atribuído pelo provedor conserva o nome herdado; o que sai daqui usa o
 * nome do **produto** (ADR-0001), e a tradução morre nesta projeção.
 */
async function conciliacaoDe(codigos: readonly string[]): Promise<ConciliacaoLida[]> {
  const linhas = await emUnidade(async (tx) => {
    return await tx<ConciliacaoLida[]>`
      SELECT codigo,
             nosso_numero AS "numeroDoTituloNoProvedor",
             identificador_no_provedor AS "identificadorNoProvedor"
        FROM negocio.cobranca
       WHERE codigo = ANY(${[...codigos]})
    `;
  });

  const porCodigo = new Map(linhas.map((linha) => [linha.codigo, linha]));

  return codigos.map((codigo) => {
    const linha = porCodigo.get(codigo);
    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} sumiu do banco entre o arranjo e a leitura`);
    }
    return linha;
  });
}

/** Um evento da trilha bancária, como a tabela o guarda. */
interface EventoLido {
  readonly codigo: string;
  readonly tipo: string;
  readonly origem: string;
  readonly diagnostico: string | null;
}

/** Os eventos das cobranças informadas, na ordem em que ocorreram. */
async function eventosDe(codigos: readonly string[]): Promise<EventoLido[]> {
  return await emUnidade(async (tx) => {
    const linhas = await tx<EventoLido[]>`
      SELECT c.codigo AS codigo,
             e.tipo::text AS tipo,
             e.origem::text AS origem,
             e.diagnostico AS diagnostico
        FROM negocio.evento_bancario e
        JOIN negocio.cobranca c ON c.id = e.cobranca_id
       WHERE c.codigo = ANY(${[...codigos]})
       ORDER BY e.ocorrido_em, c.codigo
    `;

    return linhas.map((linha) => ({
      codigo: linha.codigo,
      tipo: linha.tipo,
      origem: linha.origem,
      diagnostico: linha.diagnostico,
    }));
  });
}

/** A posição `indice` (1-indexada) da lista de códigos — a indexação crua devolveria `undefined`. */
function posicao(codigos: readonly string[], indice: number): string {
  const codigo = codigos[indice - 1];
  if (codigo === undefined) {
    throw new Error(`o arranjo precisa da cobrança na posição ${String(indice)}`);
  }
  return codigo;
}

// ---------------------------------------------------------------------------
// Subida e descida
// ---------------------------------------------------------------------------

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  diretorioDosBoletos = await mkdtemp(join(tmpdir(), 'sysloc-boletos-lote-'));

  await semearApoio();
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  if (diretorioDosBoletos !== undefined) {
    await rm(diretorioDosBoletos, { recursive: true, force: true });
  }
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-912 — a prestação de contas nomeia cada cobrança e a razão de cada recusa
// ===========================================================================

describe('CT-912 — o lote presta contas nomeando cada cobrança recusada e a razão', () => {
  it(
    'CT-912 — cinco itens, três emitidos sem motivo e dois recusados com o motivo byte a byte',
    async () => {
      const codigos = await semearCobrancas(COMPETENCIA_DO_CT912, 5);
      const adaptador = adaptadorQueRecusaNasPosicoes(
        new Map([
          [2, { classe: 'DA_COBRANCA', motivo: RECUSA_DE_CADASTRO }],
          [4, { classe: 'DA_COBRANCA', motivo: RECUSA_DE_VALOR }],
        ]),
      );

      const { trabalho, loteId } = await montarTrabalho(COMPETENCIA_DO_CT912, adaptador.porta);

      // Controle antivácuo: o conjunto tem de ser exatamente as cinco semeadas, na ordem do
      // predicado. Sem ele, um percurso sobre conjunto vazio concluiria o lote e as igualdades
      // abaixo comparariam listas vazias.
      expect(trabalho.cobrancas.map(({ codigo }) => codigo)).toEqual(codigos);

      const desfecho: DesfechoDoLote = await executarEmissaoEmLote(trabalho);

      expect(desfecho).toEqual({
        cobrancas: 5,
        emitidas: 3,
        recusadas: 2,
        interrompido: false,
        motivoDaInterrupcao: null,
      });

      // Um item por cobrança TENTADA — e todas as cinco foram tentadas.
      const itens = await itensDoLote(loteId);
      expect(itens).toHaveLength(5);

      const emitidos = itens.filter((item) => item.desfecho === DESFECHO_EMITIDO);
      const recusados = itens.filter((item) => item.desfecho === DESFECHO_RECUSADO);

      expect(emitidos).toHaveLength(3);
      expect(recusados).toHaveLength(2);

      // Todo `EMITIDO` tem `motivo IS NULL` — a outra direção do `check` bicondicional do banco.
      expect(emitidos.map((item) => item.motivo)).toEqual([null, null, null]);

      // Os dois textos, BYTE A BYTE, lidos do banco — e ligados à cobrança certa. A igualdade é de
      // corpo inteiro, e não de presença: um percurso que trocasse os motivos entre as duas
      // cobranças reprova aqui.
      expect(recusados).toEqual([
        { codigo: posicao(codigos, 2), desfecho: DESFECHO_RECUSADO, motivo: RECUSA_DE_CADASTRO },
        { codigo: posicao(codigos, 4), desfecho: DESFECHO_RECUSADO, motivo: RECUSA_DE_VALOR },
      ]);

      // E por igualdade de CONJUNTO, como o card pede — reprova nas duas direções, nomeando a
      // cobrança que sobra e a que falta.
      expect(
        diferencasDeConjunto(
          recusados.map((item) => item.codigo),
          [posicao(codigos, 2), posicao(codigos, 4)],
        ),
      ).toEqual({ excedentes: [], ausentes: [] });

      const gravado = await desfechoGravadoDoLote(loteId);
      expect(gravado).toEqual({
        concluido: true,
        interrompido: false,
        motivoDaInterrupcao: null,
      });

      // O identificador GRAVADO é o que o produto compôs e ENVIOU — não um que o provedor devolveu.
      // É a afirmação da §3.1 passo 3 da task, e o que a fatia do carnê depende para correlacionar.
      const enviados = adaptador.pedidos.map((pedido) => pedido.identificadorNoProvedor);
      expect(enviados).toHaveLength(5);

      const emitidas = [1, 3, 5].map((indice) => posicao(codigos, indice));
      const conciliacao = await conciliacaoDe(emitidas);
      expect(conciliacao.map((linha) => linha.identificadorNoProvedor)).toEqual([
        enviados[0],
        enviados[2],
        enviados[4],
      ]);

      // O pedido carregou o que a cobrança e o cadastro dizem — e nada além.
      expect(adaptador.pedidos[0]).toEqual({
        empresaId: EMPRESA_A.id,
        segredo: SEGREDO_DA_EMPRESA,
        identificadorNoProvedor: enviados[0],
        valor: VALOR_ESPERADO_NO_PEDIDO,
        vencimento: VENCIMENTO,
        locatario: LOCATARIO_SEMEADO,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-913 — a recusa de uma cobrança não interrompe o lote
// ===========================================================================

describe('CT-913 — recusa de cobrança gera evento e o lote segue até o fim', () => {
  it(
    'CT-913 — as posições posteriores à falha são emitidas, e a trilha registra só a recusada',
    async () => {
      const codigos = await semearCobrancas(COMPETENCIA_DO_CT913, 5);
      const adaptador = adaptadorQueRecusaNasPosicoes(
        new Map([[2, { classe: 'DA_COBRANCA', motivo: RECUSA_DO_CT913 }]]),
      );

      const { trabalho, loteId } = await montarTrabalho(COMPETENCIA_DO_CT913, adaptador.porta);
      expect(trabalho.cobrancas.map(({ codigo }) => codigo)).toEqual(codigos);

      const desfecho = await executarEmissaoEmLote(trabalho);
      expect(desfecho).toEqual({
        cobrancas: 5,
        emitidas: 4,
        recusadas: 1,
        interrompido: false,
        motivoDaInterrupcao: null,
      });

      // ⚠️ ESTA é a asserção que discrimina "o lote seguiu" de "o lote parou": as posições 3, 4 e 5
      // vêm DEPOIS da falha, e um percurso que interrompesse na recusa as deixaria sem boleto.
      const conciliacao = await conciliacaoDe(codigos);
      expect(
        conciliacao.map((linha) => ({
          codigo: linha.codigo,
          temBoleto: linha.numeroDoTituloNoProvedor !== null,
        })),
      ).toEqual([
        { codigo: posicao(codigos, 1), temBoleto: true },
        { codigo: posicao(codigos, 2), temBoleto: false },
        { codigo: posicao(codigos, 3), temBoleto: true },
        { codigo: posicao(codigos, 4), temBoleto: true },
        { codigo: posicao(codigos, 5), temBoleto: true },
      ]);

      // EXATAMENTE um evento de recusa, na cobrança certa, com o diagnóstico byte a byte.
      const eventos = await eventosDe(codigos);
      const recusas = eventos.filter((evento) => evento.tipo === 'EMISSAO_RECUSADA');
      expect(recusas).toEqual([
        {
          codigo: posicao(codigos, 2),
          tipo: 'EMISSAO_RECUSADA',
          origem: 'ATO_DO_ADMIN',
          diagnostico: RECUSA_DO_CT913,
        },
      ]);

      // E a cobrança recusada NÃO ganhou evento de emissão — a trilha registra o efeito, e não a
      // tentativa (ADR-0034).
      expect(
        eventos
          .filter((evento) => evento.tipo === 'BOLETO_EMITIDO')
          .map((evento) => evento.codigo)
          .sort(),
      ).toEqual([1, 3, 4, 5].map((indice) => posicao(codigos, indice)).sort());

      const gravado = await desfechoGravadoDoLote(loteId);
      expect(gravado).toEqual({
        concluido: true,
        interrompido: false,
        motivoDaInterrupcao: null,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-914 — a falha da empresa interrompe NO PONTO
// ===========================================================================

describe('CT-914 — falha da empresa interrompe o lote no ponto e preserva o emitido', () => {
  it(
    'CT-914 — exatamente dois itens emitidos, e nada depois do ponto de falha foi tentado',
    async () => {
      const codigos = await semearCobrancas(COMPETENCIA_DO_CT914, 6);
      const adaptador = adaptadorQueRecusaNasPosicoes(
        new Map([[3, { classe: 'DA_EMPRESA', motivo: FALHA_DA_EMPRESA }]]),
      );

      const { trabalho, loteId } = await montarTrabalho(COMPETENCIA_DO_CT914, adaptador.porta);
      expect(trabalho.cobrancas.map(({ codigo }) => codigo)).toEqual(codigos);

      const desfecho = await executarEmissaoEmLote(trabalho);
      expect(desfecho).toEqual({
        cobrancas: 6,
        emitidas: 2,
        recusadas: 0,
        interrompido: true,
        motivoDaInterrupcao: FALHA_DA_EMPRESA,
      });

      // ⚠️ A CONTAGEM EXATA é o que separa "interrompeu" de "tentou todas e recusou quatro": um
      // percurso que seguisse gravaria seis itens e ainda assim carimbaria `interrompido_em`.
      const itens = await itensDoLote(loteId);
      expect(itens).toHaveLength(2);
      expect(itens).toEqual([
        { codigo: posicao(codigos, 1), desfecho: DESFECHO_EMITIDO, motivo: null },
        { codigo: posicao(codigos, 2), desfecho: DESFECHO_EMITIDO, motivo: null },
      ]);

      // O que já saiu PERMANECE, e o que vem depois do ponto NÃO foi tentado — sem item e sem
      // boleto. A posição 3 é o ponto: ela foi tentada e não ganha item, porque a falha é do lote.
      const conciliacao = await conciliacaoDe(codigos);
      expect(
        conciliacao.map((linha) => ({
          codigo: linha.codigo,
          temBoleto: linha.numeroDoTituloNoProvedor !== null,
        })),
      ).toEqual([
        { codigo: posicao(codigos, 1), temBoleto: true },
        { codigo: posicao(codigos, 2), temBoleto: true },
        { codigo: posicao(codigos, 3), temBoleto: false },
        { codigo: posicao(codigos, 4), temBoleto: false },
        { codigo: posicao(codigos, 5), temBoleto: false },
        { codigo: posicao(codigos, 6), temBoleto: false },
      ]);

      // O adaptador recebeu EXATAMENTE três pedidos — o percurso cessou no ponto, e não depois de
      // perguntar ao provedor pelas outras três. É a asserção sobre número de chamadas que a
      // disciplina de dublê exige.
      expect(adaptador.pedidos).toHaveLength(3);

      const gravado = await desfechoGravadoDoLote(loteId);
      expect(gravado).toEqual({
        concluido: false,
        interrompido: true,
        motivoDaInterrupcao: FALHA_DA_EMPRESA,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-915 — reexecutar tenta apenas quem não tem boleto
// ===========================================================================

describe('CT-915 — reexecutar a mesma competência tenta apenas quem não tem boleto', () => {
  it(
    'CT-915 — o segundo lote grava dois itens, e as quatro já emitidas mantêm o número idêntico',
    async () => {
      const codigos = await semearCobrancas(COMPETENCIA_DO_CT915, 6);

      // --- Primeiro lote: emite quatro, recusa a 3ª e a 5ª -----------------------------------
      const primeiro = adaptadorQueRecusaNasPosicoes(
        new Map([
          [3, { classe: 'DA_COBRANCA', motivo: RECUSA_DO_CT915_A }],
          [5, { classe: 'DA_COBRANCA', motivo: RECUSA_DO_CT915_B }],
        ]),
      );

      const lote1 = await montarTrabalho(COMPETENCIA_DO_CT915, primeiro.porta);
      expect(lote1.trabalho.cobrancas.map(({ codigo }) => codigo)).toEqual(codigos);

      expect(await executarEmissaoEmLote(lote1.trabalho)).toEqual({
        cobrancas: 6,
        emitidas: 4,
        recusadas: 2,
        interrompido: false,
        motivoDaInterrupcao: null,
      });

      // O RETRATO — o estado das seis depois do primeiro lote. É contra ele, e não contra uma
      // expectativa reescrita, que a idempotência é medida.
      const retrato = await conciliacaoDe(codigos);
      const recusadasNoPrimeiro = [posicao(codigos, 3), posicao(codigos, 5)];

      expect(
        retrato
          .filter((linha) => linha.numeroDoTituloNoProvedor === null)
          .map((linha) => linha.codigo),
      ).toEqual(recusadasNoPrimeiro);

      // --- Segundo lote: adaptador que aceita TUDO ---------------------------------------------
      const segundo = adaptadorQueRecusaNasPosicoes(new Map());
      const lote2 = await montarTrabalho(COMPETENCIA_DO_CT915, segundo.porta);

      // O conjunto do segundo lote é o COMPLEMENTO do primeiro — decidido pelo predicado, e por
      // nenhuma guarda escrita no percurso.
      expect(lote2.trabalho.cobrancas.map(({ codigo }) => codigo)).toEqual(recusadasNoPrimeiro);

      expect(await executarEmissaoEmLote(lote2.trabalho)).toEqual({
        cobrancas: 2,
        emitidas: 2,
        recusadas: 0,
        interrompido: false,
        motivoDaInterrupcao: null,
      });

      // EXATAMENTE dois itens no segundo lote.
      const itensDoSegundo = await itensDoLote(lote2.loteId);
      expect(itensDoSegundo).toEqual([
        { codigo: posicao(codigos, 3), desfecho: DESFECHO_EMITIDO, motivo: null },
        { codigo: posicao(codigos, 5), desfecho: DESFECHO_EMITIDO, motivo: null },
      ]);

      // E o adaptador do segundo lote foi perguntado DUAS vezes — as quatro já emitidas nem
      // chegaram a ser tentadas.
      expect(segundo.pedidos).toHaveLength(2);

      // ⚠️ A COMPARAÇÃO CONTRA O RETRATO é o que prova a idempotência: sem ela, um percurso que
      // reemitisse as seis passaria, porque ao final todas teriam número não-nulo.
      const depois = await conciliacaoDe(codigos);
      const jaEmitidas = [1, 2, 4, 6];

      for (const indice of jaEmitidas) {
        const antes = retrato[indice - 1];
        const agora = depois[indice - 1];
        expect(agora).toEqual(antes);
      }

      // As duas recusadas passaram a ter boleto.
      for (const indice of [3, 5]) {
        const agora = depois[indice - 1];
        expect(agora?.numeroDoTituloNoProvedor).not.toBeNull();
        expect(agora?.identificadorNoProvedor).not.toBeNull();
      }

      // Nenhuma cobrança recebeu SEGUNDA emissão: exatamente um evento `BOLETO_EMITIDO` por
      // cobrança. É o que responde "nenhuma cobrança termina com dois identificadores vivos".
      const emissoes = (await eventosDe(codigos))
        .filter((evento) => evento.tipo === 'BOLETO_EMITIDO')
        .map((evento) => evento.codigo);
      expect(emissoes).toHaveLength(6);
      expect(diferencasDeConjunto(emissoes, codigos)).toEqual({ excedentes: [], ausentes: [] });

      // Os seis identificadores têm 18 posições e são DISTINTOS entre si — o contador nunca reusa
      // (ADR-0020/0033). DUAS asserções sustentam a distinção, e nenhuma delas é dispensável:
      //  · a lista das posições cujo valor JÁ apareceu antes preserva a multiplicidade, então só sai
      //    vazia quando não há repetição — e ao reprovar ela NOMEIA o identificador reusado;
      //  · a cardinalidade do conjunto fixa o total em seis, que é a mesma invariante afirmada por
      //    outro caminho — redundância deliberada, não cópia da primeira.
      // ⚠️ Comparar a lista com a versão dela sem repetidos NÃO serve aqui: `diferencasDeConjunto`
      // aplica `new Set` aos dois lados, e a comparação vira um conjunto contra ele mesmo — verde
      // para qualquer entrada, inclusive uma em que o contador tivesse reusado um identificador.
      const identificadores = depois.map((linha) => linha.identificadorNoProvedor ?? '');
      expect(identificadores.map((valor) => valor.length)).toEqual([
        POSICOES_DO_IDENTIFICADOR,
        POSICOES_DO_IDENTIFICADOR,
        POSICOES_DO_IDENTIFICADOR,
        POSICOES_DO_IDENTIFICADOR,
        POSICOES_DO_IDENTIFICADOR,
        POSICOES_DO_IDENTIFICADOR,
      ]);
      expect(
        identificadores.filter((valor, indice) => identificadores.indexOf(valor) !== indice),
      ).toEqual([]);
      expect(new Set(identificadores).size).toBe(6);
    },
    LIMITE_DO_CASO_MS,
  );
});
