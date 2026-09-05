/**
 * Os **recortes das três carteiras** na porta de leitura — CT-1260 a CT-1264. Intervenção dirigida
 * de 2026-09-05, pedida pela equipe de frontend.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | ADR-0039 | CT-1260 | `listarContratos` com `status` devolve **exatamente** os contratos daquele
 * |          |         | estado — igualdade de conjunto sobre os códigos, nas duas direções —, e
 * |          |         | `total` é a contagem **do recorte**, e não a da carteira. O controle sem
 * |          |         | filtro traz os três, o que impede o par de passar por vacuidade. |
 * | ADR-0039 | CT-1261 | A janela `fimDe`/`fimAte` é **inclusiva nas duas pontas** (a janela de um
 * |          |         | dia alcança o contrato que termina naquele dia), cada ponta vale sozinha, e
 * |          |         | o contrato em RASCUNHO — cujo `data_fim_locacao` é nulo — **não entra em
 * |          |         | janela alguma**, nem na mais larga possível. |
 * | ADR-0039 | CT-1262 | Os três nomes vêm do **cadastro corrente**: eles são iguais ao que a
 * |          |         | gravação semeou, mudam quando o cadastro é renomeado, e **continuam
 * |          |         | nomeando** o contrato depois de o imóvel ser retirado de circulação
 * |          |         | (ADR-0014). |
 * | ADR-0039 | CT-1263 | `listarImoveis` com `statusLocacao` devolve exatamente os daquela situação,
 * |          |         | alcança `LOCADO` (que a entrada não escreve), e o recorte é **ortogonal** ao
 * |          |         | de circulação: o imóvel retirado só aparece sob `incluirRetirados`. |
 * | ADR-0039 | CT-1264 | `listarCobrancas` com `vencimentoDe`/`vencimentoAte` é inclusiva nas duas
 * |          |         | pontas, cada ponta vale sozinha, e a janela **compõe** com o filtro por
 * |          |         | estado em vez de o substituir. |
 *
 * Rastreabilidade: `ADR-0039 §Decision → CT-1260` · `ADR-0039 §Decision → CT-1261` ·
 * `ADR-0039 §Decision → CT-1262` · `ADR-0039 §Decision → CT-1263` · `ADR-0039 §Decision → CT-1264`.
 *
 * ⚠️ **O par NÃO leva `(RN-xx)`, e a ausência é decisão.** A numeração `RN-xx` deste repositório é
 * escopada por fatia — cada `tech_spec.md` declara a sua —, e esta intervenção **não tem fatia**:
 * um `RN-13` escrito aqui resolveria para *"uma execução por vez por (empresa, rotina)"* na fatia
 * `automacoes-agendadas` e para *"a exigência do PDF para cancelar não é portada"* na
 * `contratos-de-locacao`, nenhuma das duas com relação alguma com recorte de listagem. Referência
 * que aponta para o lugar errado é pior que referência ausente. O que governa esta intervenção é a
 * `Decision` da ADR-0039, e é ela que o par nomeia.
 *
 * ===========================================================================
 * O QUE ESTES CASOS PROVAM QUE A BORDA NÃO PROVA
 * ===========================================================================
 *
 * A suíte de esquemas (`packages/contracts/test/esquemas.spec.ts`, CT-1256 a CT-1259) prova que o
 * recorte é **aceito ou recusado** na forma certa; a de borda, que ele **atravessa a rota**. Nenhuma
 * das duas prova que ele vira **predicado SQL** — e é justamente aí que mora o defeito silencioso
 * que este arquivo persegue: um filtro aplicado em memória depois de `LIMIT` devolveria a página
 * certa nos cenários pequenos e mentiria em produção, com `total` descrevendo outro conjunto.
 *
 * Por isso **todo caso afirma o `total` ao lado da lista**, e nunca só a lista: é o par que
 * discrimina *"recortou na consulta"* de *"recortou depois de ler"*.
 *
 * ===========================================================================
 * A PRECONDIÇÃO — montada pelas PORTAS DE PRODUÇÃO, nunca por `INSERT` cru
 * ===========================================================================
 *
 * A cadeia (conjunto, imóvel, locador, locatário, contrato numerado pela série e cobrança numerada
 * pela série) vem de {@link semearCobrancaDoZero}, a casa compartilhada de `./cenario-de-cobranca.ts`
 * — importada, nunca copiada, que é a convenção do `CLAUDE.md` e o que o `D21 · F4/T9` registra. As
 * transições de estado (ativação, cancelamento, situação de locação, circulação) saem das portas que
 * a operação usa, e as datas de término entram pelas **derivações da ativação**, que é o parâmetro
 * que aquela porta declara.
 *
 * ⚠️ **Cada caso semeia a própria cadeia**, e nenhum depende do arranjo de outro: a empresa é a
 * mesma (`EMPRESA_A`), e um caso que contasse com o estado deixado por outro reprovaria ao rodar
 * isolado — o defeito que a T10 da fatia `automacoes-agendadas` pagou com uma rodada de gate. Onde a
 * contagem da carteira inteira importa, ela é **medida antes**, e a asserção é sobre a diferença.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  lerAnoDaSerieDeCobranca,
  listarCobrancas,
} from '../src/cobranca.ts';
import { ativarContrato, cancelarContrato, listarContratos } from '../src/contrato.ts';
import {
  alterarImovel,
  definirCirculacaoDoImovel,
  definirSituacaoDeLocacaoDoImovel,
  listarImoveis,
  localizarImovel,
} from '../src/imovel.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { type CobrancaSemeada, semearCobrancaDoZero } from './cenario-de-cobranca.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { type Contexto, emUnidadeSobContexto } from './unidade-sob-contexto.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso semeia até três cadeias inteiras pelas portas de produção; o teto é folgado. */
const LIMITE_DO_CASO_MS = 120_000;

/** Reserva de UMA conexão: as unidades de trabalho do caso correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A: Contexto = { empresaId: EMPRESA_A.id };

/**
 * A segunda empresa — usada pelo `CT-1261`, e a razão é de **isolamento entre casos**, não de tenancy.
 *
 * A janela de término é o único recorte deste arquivo cujas asserções de conjunto são sensíveis ao
 * que os outros casos semeiam: o `CT-1260` ativa dois contratos, e qualquer data que ele escolha cai
 * de um dos lados de alguma janela do `CT-1261`. Rodar aquele caso sob outra empresa dá a ele um
 * conjunto próprio **pelo mesmo mecanismo que a operação usa** (a política de RLS), em vez de por um
 * filtro escrito no teste — e sem que nenhum caso dependa da ordem de execução.
 */
const CONTEXTO_DE_B: Contexto = { empresaId: EMPRESA_B.id };

/** A janela larga: o recorte observado é o do predicado, e só dele. */
const JANELA_LARGA = { limite: 200, deslocamento: 0 } as const;

/** Ler **inclui** os retirados — o parâmetro explícito e nomeado da porta. */
const COM_RETIRADOS = { incluirRetirados: true } as const;

/** O padrão da porta, escrito por extenso quando o caso precisa passar filtros depois dele. */
const SO_EM_CIRCULACAO = { incluirRetirados: false } as const;

/** As datas de término das três ativações — distintas, ordenadas e longe entre si. */
const TERMINO_ANTERIOR = '2026-05-31';
const TERMINO_DO_MEIO = '2026-06-30';
const TERMINO_POSTERIOR = '2026-07-31';

/** O valor total que a ativação grava — irrelevante para todo recorte deste arquivo. */
const VALOR_TOTAL_DA_ATIVACAO = 12_000;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ---------------------------------------------------------------------------
// Acessórios do arranjo — cada um abre a própria unidade, como a operação faz
// ---------------------------------------------------------------------------

/** Semeia uma cadeia inteira, com a marca que distingue o cenário do caso. */
async function semear(marca: string, contexto: Contexto = CONTEXTO_DE_A): Promise<CobrancaSemeada> {
  return await semearCobrancaDoZero(acesso, contexto, marca);
}

/** Ativa o contrato com o término declarado — a derivação chega pronta, como manda a porta. */
async function ativar(
  codigo: string,
  dataFimLocacao: string,
  contexto: Contexto = CONTEXTO_DE_A,
): Promise<void> {
  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    await ativarContrato(tx, codigo, {
      dataFimLocacao,
      valorTotalContrato: VALOR_TOTAL_DA_ATIVACAO,
    });
  });
}

/** Lê a carteira de contratos sob os recortes pedidos. */
async function carteiraDeContratos(
  filtros: Parameters<typeof listarContratos>[3] = {},
  opcoes: Parameters<typeof listarContratos>[2] = SO_EM_CIRCULACAO,
  contexto: Contexto = CONTEXTO_DE_A,
): Promise<{ readonly codigos: readonly string[]; readonly total: number }> {
  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const pagina = await listarContratos(tx, JANELA_LARGA, opcoes, filtros);

    return { codigos: pagina.contratos.map((contrato) => contrato.codigo), total: pagina.total };
  });
}

/** Lê a carteira de imóveis sob os recortes pedidos. */
async function carteiraDeImoveis(
  filtros: Parameters<typeof listarImoveis>[3] = {},
  opcoes: Parameters<typeof listarImoveis>[2] = SO_EM_CIRCULACAO,
): Promise<{ readonly identificadores: readonly string[]; readonly total: number }> {
  return await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
    const pagina = await listarImoveis(tx, JANELA_LARGA, opcoes, filtros);

    return { identificadores: pagina.imoveis.map((imovel) => imovel.id), total: pagina.total };
  });
}

/** Lê a carteira de cobranças sob os recortes pedidos. */
async function carteiraDeCobrancas(
  filtros: Parameters<typeof listarCobrancas>[2] = {},
): Promise<{ readonly codigos: readonly string[]; readonly total: number }> {
  return await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
    const pagina = await listarCobrancas(tx, JANELA_LARGA, filtros);

    return { codigos: pagina.cobrancas.map((cobranca) => cobranca.codigo), total: pagina.total };
  });
}

/** Lança uma cobrança avulsa no contrato semeado, com o vencimento declarado. */
async function lancarCobranca(
  contratoId: string,
  dataVencimento: string,
  referencia: string,
): Promise<string> {
  const ano = await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, lerAnoDaSerieDeCobranca);

  await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx: TransactionSql) => {
    await garantirContadorDeCobranca(tx, ano);
  });

  return await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);
    const cobranca = await criarCobranca(
      tx,
      {
        contratoId,
        natureza: 'ALUGUEL',
        referencia,
        competencia: '2026-01-01',
        dataVencimento,
        valorOriginal: 1000,
      },
      { ano, numero },
    );

    return cobranca.codigo;
  });
}

/**
 * A data corrente da operação deslocada em `dias` — lida do **relógio do banco**, nunca do processo.
 *
 * É o mesmo eixo que a visão `cobranca_derivada` consulta para classificar a linha (ADR-0026), e é
 * por isso que o `CT-1264` pode afirmar a composição da janela com o estado sem depender do fuso de
 * quem executa a suíte.
 */
// ⚠️ Esta é mais uma cópia privada de `dataDeslocada` na suíte — o Gate 1 mediu **19** delas, em
// quatro assinaturas incompatíveis entre si (`(dias)`, `(tx, dias)`, `(contexto, dias)`,
// `(empresaId, dias)`), que é exatamente o efeito que o Limiar de Três do `CLAUDE.md` descreve. Ela
// **não** é promovida aqui por escopo: mover o símbolo tocaria 19 arquivos, e a regra 2 do
// `CLAUDE.md` manda resolver só o pedido. A casa certa, quando a passada dedicada acontecer, é a
// compartilhada de cada frente — `packages/db/test/` e `apps/api/test/acessorios-de-borda.ts`.
async function dataDeslocada(dias: number): Promise<string> {
  return await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

describe('CT-1260 — o recorte por estado é predicado SQL, e o total acompanha o recorte', () => {
  it(
    'devolve exatamente os contratos do estado pedido, com o total do recorte',
    async () => {
      // --- Passo 1: três cadeias, cada uma levada a um estado diferente PELAS PORTAS ------------
      const rascunho = await semear('estado-rascunho');
      const ativo = await semear('estado-ativo');
      const cancelado = await semear('estado-cancelado');

      await ativar(ativo.contratoCodigo, TERMINO_DO_MEIO);
      await ativar(cancelado.contratoCodigo, TERMINO_DO_MEIO);
      await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        await cancelarContrato(tx, cancelado.contratoCodigo);
      });

      // --- Passo 2: o controle SEM filtro — é ele que impede o par de passar por vacuidade ------
      const carteiraInteira = await carteiraDeContratos();
      expect(carteiraInteira.codigos.length).toBe(carteiraInteira.total);
      for (const codigo of [rascunho, ativo, cancelado].map((c) => c.contratoCodigo)) {
        expect(carteiraInteira.codigos).toContain(codigo);
      }

      // --- Passo 3: cada estado devolve EXATAMENTE o seu -----------------------------------------
      //
      // Igualdade de conjunto, e não contenção: `toContain` aprovaria tanto o que sumiu quanto o que
      // apareceu. E o `total` entra junto — sem ele, um filtro aplicado depois do `LIMIT` passaria.
      const doRascunho = await carteiraDeContratos({ status: 'RASCUNHO' });
      expect(doRascunho.codigos).toContain(rascunho.contratoCodigo);
      expect(doRascunho.codigos).not.toContain(ativo.contratoCodigo);
      expect(doRascunho.codigos).not.toContain(cancelado.contratoCodigo);
      expect(doRascunho.total).toBe(doRascunho.codigos.length);

      const dosAtivos = await carteiraDeContratos({ status: 'ATIVO' });
      expect(diferencasDeConjunto([...dosAtivos.codigos], [ativo.contratoCodigo])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(dosAtivos.total).toBe(1);

      const dosCancelados = await carteiraDeContratos({ status: 'CANCELADO' });
      expect(diferencasDeConjunto([...dosCancelados.codigos], [cancelado.contratoCodigo])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(dosCancelados.total).toBe(1);

      // --- Passo 4: o estado SEM produtor nesta cadeia devolve o conjunto vazio -----------------
      //
      // `ENCERRADO` é escrito pela rotina agendada da F5, que este arranjo não executa. O caso não o
      // fabrica: o que ele afirma é que o predicado **discrimina** — e o passo 3 é o controle
      // positivo que impede "vazio" de ser o resultado de um filtro que nunca casa nada.
      const dosEncerrados = await carteiraDeContratos({ status: 'ENCERRADO' });
      expect(dosEncerrados.codigos).toEqual([]);
      expect(dosEncerrados.total).toBe(0);

      // --- Passo 5: a soma dos quatro recortes é a carteira inteira ------------------------------
      //
      // É a asserção que fecha a classe: um predicado que perdesse linha em algum estado — ou que as
      // contasse duas vezes — quebraria aqui mesmo que cada recorte isolado parecesse certo.
      const soma = doRascunho.total + dosAtivos.total + dosCancelados.total + dosEncerrados.total;
      expect(soma).toBe(carteiraInteira.total);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-1261 — a janela de término é inclusiva nas duas pontas, e o rascunho fica fora', () => {
  it(
    'alcança o contrato que termina na ponta, cada ponta vale sozinha, e o nulo nunca entra',
    async () => {
      // --- Passo 1: três ativados com términos distintos, mais um que fica em RASCUNHO ----------
      const anterior = await semear('janela-anterior', CONTEXTO_DE_B);
      const meio = await semear('janela-meio', CONTEXTO_DE_B);
      const posterior = await semear('janela-posterior', CONTEXTO_DE_B);
      const semTermino = await semear('janela-sem-termino', CONTEXTO_DE_B);

      await ativar(anterior.contratoCodigo, TERMINO_ANTERIOR, CONTEXTO_DE_B);
      await ativar(meio.contratoCodigo, TERMINO_DO_MEIO, CONTEXTO_DE_B);
      await ativar(posterior.contratoCodigo, TERMINO_POSTERIOR, CONTEXTO_DE_B);

      // --- Passo 2: a janela de UM DIA sobre a ponta do meio -------------------------------------
      //
      // É a fronteira que discrimina inclusivo de estrito: com `>` e `<` no predicado, este conjunto
      // seria vazio. E é o caso de uso real — "termina hoje".
      const deUmDia = await carteiraDeContratos(
        { fimDe: TERMINO_DO_MEIO, fimAte: TERMINO_DO_MEIO },
        SO_EM_CIRCULACAO,
        CONTEXTO_DE_B,
      );
      expect(diferencasDeConjunto([...deUmDia.codigos], [meio.contratoCodigo])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(deUmDia.total).toBe(1);

      // --- Passo 3: a janela que abrange as três pontas, com as DUAS bordas exatas ---------------
      const daFaixa = await carteiraDeContratos(
        { fimDe: TERMINO_ANTERIOR, fimAte: TERMINO_POSTERIOR },
        SO_EM_CIRCULACAO,
        CONTEXTO_DE_B,
      );
      expect(
        diferencasDeConjunto(
          [...daFaixa.codigos],
          [anterior.contratoCodigo, meio.contratoCodigo, posterior.contratoCodigo],
        ),
      ).toEqual({ excedentes: [], ausentes: [] });
      expect(daFaixa.total).toBe(3);

      // --- Passo 4: cada ponta SOZINHA ----------------------------------------------------------
      const daquiParaFrente = await carteiraDeContratos(
        { fimDe: TERMINO_DO_MEIO },
        SO_EM_CIRCULACAO,
        CONTEXTO_DE_B,
      );
      expect(
        diferencasDeConjunto(
          [...daquiParaFrente.codigos],
          [meio.contratoCodigo, posterior.contratoCodigo],
        ),
      ).toEqual({ excedentes: [], ausentes: [] });
      expect(daquiParaFrente.total).toBe(2);

      const ateAqui = await carteiraDeContratos(
        { fimAte: TERMINO_DO_MEIO },
        SO_EM_CIRCULACAO,
        CONTEXTO_DE_B,
      );
      expect(
        diferencasDeConjunto([...ateAqui.codigos], [anterior.contratoCodigo, meio.contratoCodigo]),
      ).toEqual({ excedentes: [], ausentes: [] });
      expect(ateAqui.total).toBe(2);

      // --- Passo 5: o RASCUNHO não entra em janela alguma ----------------------------------------
      //
      // `data_fim_locacao` é nulo enquanto o contrato não foi ativado, e comparação com nulo não é
      // verdadeira: o rascunho fica fora **pelo SQL**, sem cláusula escrita para isso. O par com o
      // controle é o que discrimina — ele existe na carteira sem filtro, e some sob qualquer janela.
      const semFiltro = await carteiraDeContratos({}, SO_EM_CIRCULACAO, CONTEXTO_DE_B);
      expect(semFiltro.codigos).toContain(semTermino.contratoCodigo);

      const janelaMaisLarga = await carteiraDeContratos(
        { fimDe: '1900-01-01', fimAte: '2999-12-31' },
        SO_EM_CIRCULACAO,
        CONTEXTO_DE_B,
      );
      expect(janelaMaisLarga.codigos).not.toContain(semTermino.contratoCodigo);
      expect(janelaMaisLarga.codigos).toContain(meio.contratoCodigo);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-1262 — os três nomes vêm do cadastro CORRENTE, e sobrevivem à retirada dele', () => {
  it(
    'publica os nomes semeados, acompanha o renome e continua nomeando o cadastro retirado',
    async () => {
      // --- Passo 1: o item da carteira traz os três nomes que a gravação semeou ------------------
      const semeado = await semear('nomes-das-partes');

      const item = await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        const pagina = await listarContratos(tx, JANELA_LARGA, SO_EM_CIRCULACAO);

        return pagina.contratos.find((contrato) => contrato.codigo === semeado.contratoCodigo);
      });

      expect(item).toBeDefined();
      expect({
        nomeImovel: item?.nomeImovel,
        nomeLocador: item?.nomeLocador,
        nomeLocatario: item?.nomeLocatario,
      }).toEqual({
        nomeImovel: semeado.nomeImovel,
        nomeLocador: semeado.nomeLocador,
        nomeLocatario: semeado.nomeLocatario,
      });

      // --- Passo 2: renomeado o imóvel, a carteira passa a exibir o nome NOVO --------------------
      //
      // É o que distingue "lido do cadastro corrente" de "cópia gravada no contrato": com uma cópia,
      // este passo continuaria devolvendo o nome antigo, e nada mais acusaria.
      const NOME_CORRIGIDO = 'Apartamento 101 — nome corrigido';

      const atual = await emUnidadeSobContexto(
        acesso,
        CONTEXTO_DE_A,
        async (tx) => await localizarImovel(tx, semeado.imovelId),
      );
      expect(atual?.nomeImovel).toBe(semeado.nomeImovel);

      await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        await alterarImovel(tx, semeado.imovelId, {
          conjuntoId: atual?.conjuntoId ?? '',
          nomeImovel: NOME_CORRIGIDO,
          identificadorMunicipal: atual?.identificadorMunicipal ?? '',
          tipoImovel: 'RESIDENCIAL',
          logradouro: 'Rua das Acácias',
          numero: '100',
          complemento: null,
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01000000',
          observacoes: null,
        });
      });

      const depoisDoRenome = await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        const pagina = await listarContratos(tx, JANELA_LARGA, SO_EM_CIRCULACAO);

        return pagina.contratos.find((contrato) => contrato.codigo === semeado.contratoCodigo);
      });

      expect(depoisDoRenome?.nomeImovel).toBe(NOME_CORRIGIDO);

      // --- Passo 3: retirado o imóvel de circulação, o contrato CONTINUA sendo nomeado -----------
      //
      // A retirada é ato de visibilidade da carteira daquela entidade (ADR-0014), e não apagamento:
      // um predicado de circulação nas junções faria o contrato perder o nome no instante em que
      // alguém arquivasse o cadastro — o defeito silencioso que a ADR nomeia entre os próprios Cons.
      await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        await definirCirculacaoDoImovel(tx, semeado.imovelId, false);
      });

      const comImovelRetirado = await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        const pagina = await listarContratos(tx, JANELA_LARGA, SO_EM_CIRCULACAO);

        return pagina.contratos.find((contrato) => contrato.codigo === semeado.contratoCodigo);
      });

      expect(comImovelRetirado).toBeDefined();
      expect(comImovelRetirado?.nomeImovel).toBe(NOME_CORRIGIDO);
      expect(comImovelRetirado?.nomeLocatario).toBe(semeado.nomeLocatario);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-1263 — o recorte por situação alcança LOCADO e é ortogonal ao de circulação', () => {
  it(
    'devolve exatamente os imóveis da situação pedida, com o total do recorte',
    async () => {
      // --- Passo 1: três imóveis, cada um levado a uma situação PELAS PORTAS ---------------------
      const disponivel = await semear('situacao-disponivel');
      const locado = await semear('situacao-locado');
      const indisponivel = await semear('situacao-indisponivel');

      await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        await definirSituacaoDeLocacaoDoImovel(tx, locado.imovelId, 'LOCADO');
        await definirSituacaoDeLocacaoDoImovel(tx, indisponivel.imovelId, 'INDISPONIVEL');
      });

      // --- Passo 2: o controle sem filtro ------------------------------------------------------
      const carteiraInteira = await carteiraDeImoveis();
      for (const identificador of [disponivel, locado, indisponivel].map((c) => c.imovelId)) {
        expect(carteiraInteira.identificadores).toContain(identificador);
      }

      // --- Passo 3: cada situação devolve o seu, e `LOCADO` é alcançável -------------------------
      //
      // `LOCADO` é o valor que o esquema de ENTRADA de imóvel recusa (ele é produzido pela fatia de
      // contratos): se o filtro lesse `SITUACOES_INFORMAVEIS`, o único estado que a tela quer contar
      // seria inalcançável por recorte.
      const dosLocados = await carteiraDeImoveis({ statusLocacao: 'LOCADO' });
      expect(dosLocados.identificadores).toContain(locado.imovelId);
      expect(dosLocados.identificadores).not.toContain(disponivel.imovelId);
      expect(dosLocados.identificadores).not.toContain(indisponivel.imovelId);
      expect(dosLocados.total).toBe(dosLocados.identificadores.length);

      const dosDisponiveis = await carteiraDeImoveis({ statusLocacao: 'DISPONIVEL' });
      expect(dosDisponiveis.identificadores).toContain(disponivel.imovelId);
      expect(dosDisponiveis.identificadores).not.toContain(locado.imovelId);

      const dosIndisponiveis = await carteiraDeImoveis({ statusLocacao: 'INDISPONIVEL' });
      expect(dosIndisponiveis.identificadores).toContain(indisponivel.imovelId);
      expect(dosIndisponiveis.identificadores).not.toContain(locado.imovelId);

      // --- Passo 4: a soma dos três recortes é a carteira inteira --------------------------------
      const soma = dosDisponiveis.total + dosLocados.total + dosIndisponiveis.total;
      expect(soma).toBe(carteiraInteira.total);

      // --- Passo 5: os DOIS eixos são ortogonais ------------------------------------------------
      //
      // Retirado de circulação, o imóvel some do recorte por situação **sem** o parâmetro de
      // inclusão, e volta com ele — mantendo a situação. Só a primeira metade seria satisfeita por
      // uma porta que perdesse a linha; só a segunda, por uma que ignorasse a circulação.
      await emUnidadeSobContexto(acesso, CONTEXTO_DE_A, async (tx) => {
        await definirCirculacaoDoImovel(tx, indisponivel.imovelId, false);
      });

      const semRetirados = await carteiraDeImoveis({ statusLocacao: 'INDISPONIVEL' });
      expect(semRetirados.identificadores).not.toContain(indisponivel.imovelId);
      expect(semRetirados.total).toBe(dosIndisponiveis.total - 1);

      const comRetirados = await carteiraDeImoveis(
        { statusLocacao: 'INDISPONIVEL' },
        COM_RETIRADOS,
      );
      expect(comRetirados.identificadores).toContain(indisponivel.imovelId);
      expect(comRetirados.total).toBe(dosIndisponiveis.total);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-1264 — a janela de vencimento é inclusiva e COMPÕE com o filtro por estado', () => {
  it(
    'alcança a cobrança que vence na ponta, cada ponta vale sozinha, e o estado continua valendo',
    async () => {
      // --- Passo 1: três cobranças no mesmo contrato, com vencimentos ordenados ------------------
      //
      // As datas saem do **relógio do banco**, que é o mesmo eixo com que a visão classifica o
      // estado (ADR-0026): é o que permite o passo 4 afirmar a composição sem depender do fuso de
      // quem executa a suíte.
      const semeado = await semear('janela-de-vencimento');

      const ontem = await dataDeslocada(-1);
      const hoje = await dataDeslocada(0);
      const amanha = await dataDeslocada(1);

      const vencida = await lancarCobranca(semeado.contratoId, ontem, 'Parcela vencida ontem');
      const deHoje = await lancarCobranca(semeado.contratoId, hoje, 'Parcela que vence hoje');
      const futura = await lancarCobranca(semeado.contratoId, amanha, 'Parcela que vence amanhã');

      // ⚠️ Todas as leituras deste caso recortam **pelo contrato do cenário**, e o recorte é parte
      // da prova, não conveniência de arranjo: a carteira da empresa carrega as cobranças que os
      // outros casos semearam, e um conjunto esperado que as ignorasse mediria o acaso da ordem de
      // execução. Ele também exercita a **composição** dos filtros, que é o que a rota publica.
      //
      // A cobrança que o próprio arranjo semeia (vencimento a 30 dias) entra nos conjuntos que a
      // alcançam, declarada por nome — {@link CobrancaSemeada.cobrancaCodigo} —, em vez de ser
      // subtraída por contagem.

      // --- Passo 2: a janela de UM DIA sobre hoje ------------------------------------------------
      //
      // É o indicador "vencem hoje" que motivou o pedido, e a fronteira que discrimina inclusivo de
      // estrito: com `>` e `<`, este conjunto seria vazio.
      const deUmDia = await carteiraDeCobrancas({
        contratoCodigo: semeado.contratoCodigo,
        vencimentoDe: hoje,
        vencimentoAte: hoje,
      });
      expect(diferencasDeConjunto([...deUmDia.codigos], [deHoje])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(deUmDia.total).toBe(1);

      // --- Passo 3: cada ponta sozinha ----------------------------------------------------------
      const daquiParaFrente = await carteiraDeCobrancas({
        contratoCodigo: semeado.contratoCodigo,
        vencimentoDe: hoje,
      });
      expect(
        diferencasDeConjunto(
          [...daquiParaFrente.codigos],
          [deHoje, futura, semeado.cobrancaCodigo],
        ),
      ).toEqual({ excedentes: [], ausentes: [] });
      expect(daquiParaFrente.total).toBe(3);

      const ateAqui = await carteiraDeCobrancas({
        contratoCodigo: semeado.contratoCodigo,
        vencimentoAte: hoje,
      });
      expect(diferencasDeConjunto([...ateAqui.codigos], [vencida, deHoje])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(ateAqui.total).toBe(2);

      // --- Passo 4: a janela COMPÕE com o estado, e não o substitui ------------------------------
      //
      // ⚠️ A cobrança que vence **hoje** é `A_VENCER` (a visão compara `data_vencimento <` a data
      // corrente), e é isso que torna os dois eixos irredutíveis um ao outro. As duas asserções
      // abaixo são o par: a primeira mostra que a janela de hoje **não** é o mesmo que `VENCIDA`; a
      // segunda, que os dois recortes se compõem por conjunção.
      const vencidasAteHoje = await carteiraDeCobrancas({
        contratoCodigo: semeado.contratoCodigo,
        status: 'VENCIDA',
        vencimentoAte: hoje,
      });
      expect(diferencasDeConjunto([...vencidasAteHoje.codigos], [vencida])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(vencidasAteHoje.total).toBe(1);

      const aVencerAteHoje = await carteiraDeCobrancas({
        contratoCodigo: semeado.contratoCodigo,
        status: 'A_VENCER',
        vencimentoAte: hoje,
      });
      expect(diferencasDeConjunto([...aVencerAteHoje.codigos], [deHoje])).toEqual({
        excedentes: [],
        ausentes: [],
      });
      expect(aVencerAteHoje.total).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});
