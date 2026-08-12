/**
 * O **predicado de elegibilidade**, o registro de toda tentativa e o histórico, contra banco real —
 * CT-609, CT-610 e CT-611, da T5 da fatia `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-11    | CT-609 | `registrarEnvioDeCobranca` grava UMA linha por tentativa, para cada um dos
 * | CA-10    |        | três desfechos, com `caminho`, `destinatario` e `causa` — **não nula apenas
 * |          |        | quando houve falha** —, e `lerEnviosDaCobranca` devolve exatamente essas
 * |          |        | linhas por `criado_em` DECRESCENTE. A lista é comparada por `toStrictEqual`
 * |          |        | nos quatro campos, os três `criadoEm` decrescem **sem empate**, e
 * |          |        | `contarEnviosDaCobranca` devolve `3`. |
 * | CA-10    | CT-609 | O banco recusa a linha incoerente, e a impossibilidade é **dele**:
 * |          | (b)    | `ENVIADA` **com** causa e `FALHOU` **sem** causa levantam `23514` nomeando
 * |          |        | `envio_de_cobranca_causa_chk` — a bicondicional, afirmada nas DUAS direções —,
 * |          |        | e a contagem crua permanece intacta depois das duas recusas. |
 * | CA-16    | CT-609 | Código de cobrança **inexistente** devolve lista de comprimento `0` e total
 * |          | (c)    | `0` — nunca exceção. É a metade desta camada do `CT-632`, cuja outra metade
 * |          |        | (o `404` com o envelope inteiro) é da T10, onde há HTTP. |
 * | CA-04    | CT-610 | Para `{ diasAntesDoVencimento: 10, intervaloMinimoDias: 2 }`, o predicado
 * | CA-06    |        | devolve EXATAMENTE `[L5, L3, L1]` — igualdade de lista **ordenada** de
 * | CA-08    |        | códigos, nunca `toContain` e nunca contagem. Entram: `A_VENCER` dentro dos
 * |          |        | dias (L1, `+5`), `VENCIDA` sem histórico (L3, `−12`) e `VENCIDA` com
 * |          |        | `ENVIADA` **antiga** (L5, `−30` com envio em `−10`). Ficam fora: `A_VENCER`
 * |          |        | fora dos dias (L2, `+40`), `VENCIDA` com `ENVIADA` recente (L4, `−20` com
 * |          |        | envio em `−1`), PAGA (L6) e CANCELADA (L7). |
 * | CA-04    | CT-610 | A junção quádrupla projeta os quatro campos que a view não carrega —
 * |          | (b)    | `nomeDoLocatario`, `destinatario`, `imovel` e `conjunto` —, e `valorTotal` de
 * |          |        | cada candidata é **idêntico** ao que `negocio.cobranca_derivada` publica para
 * |          |        | o mesmo código. |
 * | CA-04    | CT-610 | O locatário **sem endereço de contato** ENTRA no conjunto (RD-11): L5 é do
 * |          | (c)    | contrato cujo locatário tem `email` vazio, e a candidata devolvida traz
 * |          |        | `destinatario: ''`. A exclusão não acontece no predicado — senão o registro
 * |          |        | `SEM_DESTINATARIO` nunca nasceria. |
 * | CA-06    | CT-611 | **A emenda da RD-05**: com `intervaloMinimoDias: 2` e três cobranças
 * | CA-09    |        | equivalentes distintas SÓ pelo desfecho da tentativa de `−1` dia, o conjunto
 * | CA-10    |        | é EXATAMENTE `[C_falhou, C_sem_destinatario]` — `C_enviada` sai. Registrada
 * |          |        | uma tentativa `ENVIADA` no MESMO instante relativo sobre `C_falhou`, o
 * |          |        | conjunto passa a `[C_sem_destinatario]`. **O desfecho é o único
 * |          |        | discriminador.** |
 *
 * Rastreabilidade: `CA-11 → CT-609 (RN-08)` · `CA-10 → CT-609 (RN-08)` · `CA-16 → CT-609 (c)` ·
 * `CA-04 → CT-610 (RD-04)` · `CA-06 → CT-610 (RD-05)` · `CA-08 → CT-610 (RD-04)` ·
 * `CA-06 → CT-611 (RD-05)` · `CA-09 → CT-611 (RD-05)` · `CA-10 → CT-611 (RD-05)`.
 *
 * ===========================================================================
 * ⚠️ O CT-611 PROVA UMA DIVERGÊNCIA DECLARADA — não o "conserte" para o texto do PRD
 * ===========================================================================
 *
 * A RN-06 do PRD manda **qualquer** tentativa recente travar o intervalo. O produto conta **apenas**
 * `ENVIADA`, e a contradição foi medida contra o oráculo: `regua-de-cobranca.json` traz, em
 * `retorno.intervalo`, o caso `envio_com_erro_nao_bloqueia` com `saida: true`. O ponto do predicado
 * (`../src/envio-de-cobranca.ts`) leva marcador **`DECISÃO FECHADA`** com os quatro campos, e este
 * caso é a **rede** que ele nomeia no próprio `REVERTER EXIGE`. Um caso que passasse a esperar
 * `[C_sem_destinatario]` na primeira chamada estaria desfazendo a decisão, não corrigindo um defeito.
 *
 * ===========================================================================
 * A IGUALDADE É DE LISTA ORDENADA, e a ordem é a do `ORDER BY` — não a da tabela do card
 * ===========================================================================
 *
 * O card do CT-610 enumera o veredito por linha (`L1`, `L3`, `L5`), que é a ordem em que o arranjo é
 * **lido**. A ordem em que o predicado **devolve** é `data_vencimento, codigo`, e por ela L5 (`−30`)
 * vem antes de L3 (`−12`), que vem antes de L1 (`+5`). Asserir a ordem do card contradiria o Aceite
 * Técnico da própria task (*"a ordem é determinística: `data_vencimento`, depois `codigo`"*), então o
 * que se afirma aqui é a ordem real — e o **conjunto** é afirmado junto, para que a divergência de
 * leitura não passe por divergência de conteúdo.
 *
 * `toContain` afirmaria que L1 está entre os devolvidos, e passaria verde com L6 e L7 na lista. A
 * igualdade exata é o que faz um predicado que esquecesse o recorte de estado reprovar **nomeando** as
 * cobranças a mais. Comprimento também não serve: trocar L4 por L5 preservaria o número.
 *
 * ===========================================================================
 * O RELÓGIO NUNCA É FALSEADO — o cenário é posicionado pelo DADO
 * ===========================================================================
 *
 * Todo vencimento é derivado de `negocio.data_corrente_da_operacao() ± INTERVAL 'N days'`, e **nunca**
 * de um `new Date()` do processo: é o mesmo eixo que a visão consulta para classificar a linha e que o
 * predicado consulta para recortar os dias, de modo que a fronteira é medida contra quem a decide.
 * Mesma disciplina de `derivacao-de-cobranca.spec.ts` e de `cobranca.spec.ts`.
 *
 * As tentativas no PASSADO são semeadas por instrução própria, com `criado_em` explícito derivado de
 * `now()` do servidor — semear coluna com padrão é caminho legítimo do banco. **Nenhum parâmetro de
 * instante nasce na porta de produção** (Iron Law #6): `registrarEnvioDeCobranca` não tem por onde
 * receber quando a tentativa aconteceu, e é justamente por esse instante que a trava conta.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada, descartada ao fim. Nenhuma coordenada de conexão é lida
 * do ambiente. O acesso é pelo papel `sysloc_app`, e o contexto é aberto pela borda
 * (`contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho`) — o mesmo par da operação. **Nenhum
 * `WHERE empresa_id` é escrito neste arquivo**, nem nas contagens cruas: quem recorta é a política
 * (ADR-0008).
 */

import type { EnvioDeCobranca, PoliticaDeAvisoNova } from '@sysloc/contracts';
import type { CandidataAoAviso } from '@sysloc/regua';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  acusarPagamentoDeCobranca,
  cancelarCobranca,
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
} from '../src/cobranca.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  ativarContrato,
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import { derivarTerminoDaLocacao, derivarValorTotal } from '../src/derivacao-de-contrato.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import {
  contarEnviosDaCobranca,
  lerEnviosDaCobranca,
  lerHoraCorrenteDaOperacao,
  registrarEnvioDeCobranca,
  selecionarCandidatasAoAviso,
} from '../src/envio-de-cobranca.ts';
import { criarImovel } from '../src/imovel.ts';
import { gravarPoliticaDeAviso } from '../src/politica-de-aviso.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, semearLocatarioSemContato } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O CT-610 monta dois contratos e sete cobranças, cada uma em duas unidades sequenciais. */
const LIMITE_DO_CASO_MS = 120_000;

/** Reserva de UMA conexão: unidade de trabalho que vazasse reserva trava o caso seguinte. */
const RESERVA_DE_UMA = 1;

/** O contexto da empresa da carga inicial — usado só para admitir as empresas dos cenários. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

// ---------------------------------------------------------------------------
// A política sob prova, e o recorte que o predicado recebe
// ---------------------------------------------------------------------------

/** Dez dias de antecedência — o que separa L1 (`+5`) de L2 (`+40`). */
const DIAS_DE_ANTECEDENCIA = 10;

/** Dois dias de intervalo mínimo — o que separa o envio de `−1` do de `−10`. */
const INTERVALO_MINIMO_EM_DIAS = 2;

/** A política dos dois casos do predicado, gravada pela porta REAL — o caminho da operação. */
const POLITICA_DA_REGUA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: DIAS_DE_ANTECEDENCIA,
  intervaloMinimoDias: INTERVALO_MINIMO_EM_DIAS,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
};

/**
 * O recorte que o predicado recebe — **dois** campos, e não a política inteira.
 *
 * É a decisão D4 escrita no tipo: `ativo` e a janela de horário não participam de seleção, e o `Pick`
 * da assinatura os deixa inalcançáveis de dentro da consulta.
 */
const RECORTE_DA_REGUA = {
  diasAntesDoVencimento: DIAS_DE_ANTECEDENCIA,
  intervaloMinimoDias: INTERVALO_MINIMO_EM_DIAS,
} as const;

// ---------------------------------------------------------------------------
// O arranjo do CT-610 — os deslocamentos, declarados com o veredito ANTES da execução
// ---------------------------------------------------------------------------

/** `A_VENCER` dentro dos dias — ELEGÍVEL. */
const L1_DIAS = 5;
/** `A_VENCER` fora dos dias — não elegível. */
const L2_DIAS = 40;
/** `VENCIDA` sem histórico — ELEGÍVEL. */
const L3_DIAS = -12;
/** `VENCIDA` com `ENVIADA` recente — não elegível. */
const L4_DIAS = -20;
/** `VENCIDA` com `ENVIADA` antiga — ELEGÍVEL, e do locatário SEM contato. */
const L5_DIAS = -30;
/** PAGA — não elegível. */
const L6_DIAS = -8;
/** CANCELADA — não elegível. É o caso que discrimina o defeito do legado. */
const L7_DIAS = -25;

/** O envio que TRAVA: dentro do intervalo mínimo de dois dias. */
const ENVIO_RECENTE_DIAS_ATRAS = 1;

/** O envio que NÃO trava: fora do intervalo mínimo. */
const ENVIO_ANTIGO_DIAS_ATRAS = 10;

/** As três cobranças do CT-611 vencem no mesmo dia — o desfecho é o que as separa. */
const CT611_DIAS = -20;

/** Valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** O que a cobrança paga liquida — igual ao original, porque a empresa não tem política de mora. */
const VALOR_PAGO = 1000;

// ---------------------------------------------------------------------------
// As três tentativas do CT-609
// ---------------------------------------------------------------------------

/** O endereço do locatário dos cenários com contato. */
const DESTINATARIO = 'locatario@exemplo.invalid';

/** O diagnóstico da tentativa que falhou — cadeia EXATA, comparada literalmente. */
const CAUSA_DA_FALHA = 'conexão recusada pelo transporte';

/** O diagnóstico da tentativa sem endereço — cadeia EXATA, comparada literalmente. */
const CAUSA_SEM_DESTINATARIO = 'locatário sem endereço de contato';

/** As três tentativas do CT-609, na ordem em que são gravadas. */
const TENTATIVAS_DO_CT609 = [
  {
    caminho: 'AUTOMATICO',
    desfecho: 'ENVIADA',
    destinatario: DESTINATARIO,
    causa: null,
  },
  {
    caminho: 'AUTOMATICO',
    desfecho: 'FALHOU',
    destinatario: DESTINATARIO,
    causa: CAUSA_DA_FALHA,
  },
  {
    caminho: 'MANUAL',
    desfecho: 'SEM_DESTINATARIO',
    destinatario: '',
    causa: CAUSA_SEM_DESTINATARIO,
  },
] as const satisfies readonly Omit<EnvioDeCobranca, 'id' | 'cobrancaCodigo' | 'criadoEm'>[];

/** Três tentativas gravadas, três linhas — a contagem crua que o CT-609 ancora. */
const TRES_TENTATIVAS = 3;

/** Nenhuma linha — o que a cobrança inexistente devolve, e o que as duas recusas preservam. */
const NENHUMA_TENTATIVA = 0;

/** Janela folgada: o histórico dos casos tem três linhas, e a paginação é provada na T10. */
const JANELA_INTEIRA = { limite: 50, deslocamento: 0 } as const;

/** `check_violation` — o `SQLSTATE` que o servidor devolve ao recusar a bicondicional. */
const VIOLACAO_DE_RESTRICAO = '23514';

/** A restrição que pareia desfecho e causa. É ela, e não outra, que precisa falar. */
const RESTRICAO_DA_CAUSA = 'envio_de_cobranca_causa_chk';

/** Um código bem formado que não pertence a cobrança alguma — a ausência, sem exceção. */
const COBRANCA_INEXISTENTE = 'COB-2000-0000001';

/** O molde `HH:MM` que `lerHoraCorrenteDaOperacao` publica — ancorado nas duas pontas. */
const MOLDE_DA_HORA_DO_DIA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Os termos do contrato de todo cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
  pdfContratoArquivo: null,
} as const;

/** A competência de todas as cobranças do arranjo — não participa do recorte. */
const COMPETENCIA = '2026-01-01';

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

// ===========================================================================
// CT-609 — toda tentativa deixa registro, e o histórico sai decrescente
// ===========================================================================

describe('CT-609 — o registro de toda tentativa e o histórico da cobrança', () => {
  it(
    'CT-609 — as três tentativas viram três linhas, `causa` só na falha, e a leitura é decrescente',
    async () => {
      const cenario = await semearCenario('registro');
      const cobranca = await lancar(cenario, { diasAteVencimento: L3_DIAS });

      // Passo 1 — as três tentativas, cada uma na SUA unidade de trabalho. Uma unidade para as três
      // faria `now()` ser o mesmo instante nas três (ele é o do INÍCIO da transação), e o `criadoEm`
      // deixaria de decrescer — que é a metade do invariante sob prova.
      for (const tentativa of TENTATIVAS_DO_CT609) {
        await emUnidade(
          cenario.contexto,
          async (tx) =>
            await registrarEnvioDeCobranca(tx, { cobrancaCodigo: cobranca.codigo, ...tentativa }),
        );
      }

      // Passo 2 — a contagem CRUA da tabela, sem recorte: três tentativas, três linhas.
      expect(await contarLinhasDeEnvio(cenario.contexto)).toBe(TRES_TENTATIVAS);
      expect(
        await emUnidade(
          cenario.contexto,
          async (tx) => await contarEnviosDaCobranca(tx, cobranca.codigo),
        ),
      ).toBe(TRES_TENTATIVAS);

      // Passo 3 — a lista INTEIRA, por igualdade estrita nos quatro campos, do mais recente para o
      // mais antigo. A ordem esperada é a inversa da de gravação.
      const historico = await emUnidade(
        cenario.contexto,
        async (tx) => await lerEnviosDaCobranca(tx, cobranca.codigo, JANELA_INTEIRA),
      );

      expect(historico).toHaveLength(TRES_TENTATIVAS);
      expect(
        historico.map(({ caminho, desfecho, destinatario, causa }) => ({
          caminho,
          desfecho,
          destinatario,
          causa,
        })),
      ).toStrictEqual([...TENTATIVAS_DO_CT609].reverse());

      // O código publicado vem do BANCO, e é o da cobrança avisada — em todas as três linhas.
      expect(historico.map((linha) => linha.cobrancaCodigo)).toStrictEqual(
        Array<string>(TRES_TENTATIVAS).fill(cobranca.codigo),
      );

      // Passo 4 — os três instantes decrescem SEM empate. A comparação é lexicográfica porque o
      // carimbo é ISO-8601 em UTC com largura fixa, e ali a ordem de texto É a ordem cronológica.
      // As duas asserções são necessárias: a primeira prova a ordenação, e a segunda que ela não é
      // vácua — três carimbos idênticos passariam por "ordenados" e fariam a ordem depender do
      // desempate por `id`, sem que a ordenação por instante estivesse correta.
      const instantes = historico.map((linha) => linha.criadoEm);

      expect([...instantes].sort().reverse()).toStrictEqual(instantes);
      expect(new Set(instantes).size).toBe(TRES_TENTATIVAS);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-609 (b) — o banco recusa `ENVIADA` com causa e `FALHOU` sem causa, e nada é gravado',
    async () => {
      const cenario = await semearCenario('coerencia');
      const cobranca = await lancar(cenario, { diasAteVencimento: L3_DIAS });

      // Sucesso COM causa: um envio que deu certo carregando o diagnóstico de uma falha.
      await expect(
        emUnidade(
          cenario.contexto,
          async (tx) =>
            await registrarEnvioDeCobranca(tx, {
              cobrancaCodigo: cobranca.codigo,
              caminho: 'AUTOMATICO',
              desfecho: 'ENVIADA',
              destinatario: DESTINATARIO,
              causa: CAUSA_DA_FALHA,
            }),
        ),
      ).rejects.toMatchObject({
        code: VIOLACAO_DE_RESTRICAO,
        constraint_name: RESTRICAO_DA_CAUSA,
      });

      // Falha SEM causa — a metade que dói, e a que uma implicação simples deixaria aberta: a
      // tentativa que não saiu sem dizer por quê não é recuperável depois.
      await expect(
        emUnidade(
          cenario.contexto,
          async (tx) =>
            await registrarEnvioDeCobranca(tx, {
              cobrancaCodigo: cobranca.codigo,
              caminho: 'AUTOMATICO',
              desfecho: 'FALHOU',
              destinatario: DESTINATARIO,
              causa: null,
            }),
        ),
      ).rejects.toMatchObject({
        code: VIOLACAO_DE_RESTRICAO,
        constraint_name: RESTRICAO_DA_CAUSA,
      });

      // Controle: as duas recusas não deixaram linha nenhuma para trás.
      expect(await contarLinhasDeEnvio(cenario.contexto)).toBe(NENHUMA_TENTATIVA);

      // Controle POSITIVO — sem ele, um `CHECK` que recusasse TUDO passaria as duas negativas acima.
      const gravada = await emUnidade(
        cenario.contexto,
        async (tx) =>
          await registrarEnvioDeCobranca(tx, {
            cobrancaCodigo: cobranca.codigo,
            caminho: 'AUTOMATICO',
            desfecho: 'ENVIADA',
            destinatario: DESTINATARIO,
            causa: null,
          }),
      );

      expect(gravada.desfecho).toBe('ENVIADA');
      expect(gravada.causa).toBeNull();
      expect(await contarLinhasDeEnvio(cenario.contexto)).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-609 (c) — código de cobrança inexistente devolve lista vazia e total zero, sem exceção',
    async () => {
      const cenario = await semearCenario('ausencia');

      const historico = await emUnidade(
        cenario.contexto,
        async (tx) => await lerEnviosDaCobranca(tx, COBRANCA_INEXISTENTE, JANELA_INTEIRA),
      );

      expect(historico).toStrictEqual([]);
      expect(
        await emUnidade(
          cenario.contexto,
          async (tx) => await contarEnviosDaCobranca(tx, COBRANCA_INEXISTENTE),
        ),
      ).toBe(NENHUMA_TENTATIVA);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-609 (d) — a hora corrente da operação vem do BANCO, no molde `HH:MM`',
    async () => {
      const hora = await emUnidade(CONTEXTO_DE_A, lerHoraCorrenteDaOperacao);

      // O molde é ancorado nas duas pontas: `'9:00'`, `'09:00:00'` e `'24:00'` reprovam. O valor
      // exato não é asserido — ele é o relógio do servidor —, mas a FORMA é contrato: é ela que a
      // comparação lexicográfica da janela exige para ser um veredito sobre horário.
      expect(hora).toMatch(MOLDE_DA_HORA_DO_DIA);

      // E ela concorda com o eixo da operação: a mesma consulta feita pelo fuso do objeto devolve o
      // mesmo valor. Sem isso, o caso provaria apenas a forma da cadeia.
      expect(hora).toBe(await lerHoraDaOperacaoCrua(CONTEXTO_DE_A));
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-610 — o predicado, com a tabela de sete estados fechada por igualdade
// ===========================================================================

describe('CT-610 — o predicado de elegibilidade apura no banco, sobre `cobranca_derivada`', () => {
  it(
    'CT-610 — a tabela de sete linhas fecha em `[L5, L3, L1]` por igualdade de lista ordenada',
    async () => {
      const cenario = await semearCenario('predicado');
      // O segundo contrato existe para que L5 pertença a um locatário SEM endereço de contato: é o
      // que faz este caso provar, junto, que a candidata sem destinatário ENTRA no conjunto (RD-11).
      const semContato = await semearCenario('predicado-sem-contato', {
        contexto: cenario.contexto,
        locatarioSemContato: true,
      });

      await emUnidade(
        cenario.contexto,
        async (tx) => await gravarPoliticaDeAviso(tx, POLITICA_DA_REGUA),
      );

      // Passo 1 — as sete cobranças, com o veredito declarado ANTES da execução (ver as constantes).
      const l1 = await lancar(cenario, { diasAteVencimento: L1_DIAS });
      const l2 = await lancar(cenario, { diasAteVencimento: L2_DIAS });
      const l3 = await lancar(cenario, { diasAteVencimento: L3_DIAS });
      const l4 = await lancar(cenario, { diasAteVencimento: L4_DIAS });
      const l5 = await lancar(semContato, { diasAteVencimento: L5_DIAS });
      const l6 = await lancar(cenario, { diasAteVencimento: L6_DIAS });
      const l7 = await lancar(cenario, { diasAteVencimento: L7_DIAS });

      await semearTentativaEm(cenario.contexto, l4.codigo, ENVIO_RECENTE_DIAS_ATRAS, 'ENVIADA');
      await semearTentativaEm(cenario.contexto, l5.codigo, ENVIO_ANTIGO_DIAS_ATRAS, 'ENVIADA');
      await pagar(cenario.contexto, l6.codigo);
      await cancelar(cenario.contexto, l7.codigo);

      // Passo 2 — o predicado, pelo caminho de produção.
      const candidatas = await emUnidade(
        cenario.contexto,
        async (tx) => await selecionarCandidatasAoAviso(tx, RECORTE_DA_REGUA),
      );

      // Passo 3 — igualdade de lista ORDENADA. A ordem é `data_vencimento, codigo`, e por ela L5
      // (`−30`) vem antes de L3 (`−12`), que vem antes de L1 (`+5`). Um predicado que esquecesse o
      // recorte de estado devolveria cinco elementos e reprovaria nomeando L6 e L7; um que esquecesse
      // a trava devolveria quatro e nomearia L4; um que esquecesse os dias devolveria quatro e
      // nomearia L2.
      expect(candidatas.map((candidata) => candidata.codigo)).toStrictEqual([
        l5.codigo,
        l3.codigo,
        l1.codigo,
      ]);

      // O conjunto, afirmado à parte da ordem: as quatro que ficam de fora ficam de fora.
      const devolvidos = new Set(candidatas.map((candidata) => candidata.codigo));

      expect(devolvidos.has(l2.codigo)).toBe(false);
      expect(devolvidos.has(l4.codigo)).toBe(false);
      expect(devolvidos.has(l6.codigo)).toBe(false);
      expect(devolvidos.has(l7.codigo)).toBe(false);

      // Passo 4 — a junção quádrupla projeta o que a view não carrega, e o dinheiro é o MESMO que a
      // view publica para o mesmo código. Um `valorTotal` recomposto na aplicação divergiria aqui.
      for (const candidata of candidatas) {
        expect(candidata.valorTotal).toBe(
          await lerValorTotalDaView(cenario.contexto, candidata.codigo),
        );
      }

      const l1Candidata = candidataPorCodigo(candidatas, l1.codigo);

      expect(l1Candidata).toStrictEqual({
        codigo: l1.codigo,
        dataVencimento: l1.dataVencimento,
        status: 'A_VENCER',
        valorTotal: l1Candidata.valorTotal,
        destinatario: DESTINATARIO,
        nomeDoLocatario: cenario.nomeDoLocatario,
        imovel: cenario.imovel,
        conjunto: cenario.conjunto,
      } satisfies CandidataAoAviso);

      // Passo 5 — o locatário SEM endereço de contato entra, com `destinatario` vazio (RD-11). A
      // exclusão não pode acontecer no predicado: sem esta candidata, o registro `SEM_DESTINATARIO`
      // nunca nasceria, e o cadastro incompleto viraria um silêncio em vez de um fato.
      const l5Candidata = candidataPorCodigo(candidatas, l5.codigo);

      expect(l5Candidata).toStrictEqual({
        codigo: l5.codigo,
        dataVencimento: l5.dataVencimento,
        status: 'VENCIDA',
        valorTotal: l5Candidata.valorTotal,
        destinatario: '',
        nomeDoLocatario: semContato.nomeDoLocatario,
        imovel: semContato.imovel,
        conjunto: semContato.conjunto,
      } satisfies CandidataAoAviso);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-611 — a emenda da RD-05: o desfecho é o único discriminador
// ===========================================================================

describe('CT-611 — a trava do intervalo conta apenas `ENVIADA`', () => {
  it(
    'CT-611 — `FALHOU` e `SEM_DESTINATARIO` não travam; a mesma cobrança com `ENVIADA` sai',
    async () => {
      const cenario = await semearCenario('trava');

      await emUnidade(
        cenario.contexto,
        async (tx) => await gravarPoliticaDeAviso(tx, POLITICA_DA_REGUA),
      );

      // Três cobranças EQUIVALENTES: mesmo vencimento, mesmo valor, mesmo contrato. A ordem de
      // criação fixa a ordem dos códigos, que é o desempate do `ORDER BY`.
      const cFalhou = await lancar(cenario, { diasAteVencimento: CT611_DIAS });
      const cSemDestinatario = await lancar(cenario, { diasAteVencimento: CT611_DIAS });
      const cEnviada = await lancar(cenario, { diasAteVencimento: CT611_DIAS });

      // Uma tentativa cada, no MESMO instante relativo, dentro do intervalo mínimo. A única coisa
      // que difere entre as três é o desfecho.
      await semearTentativaEm(cenario.contexto, cFalhou.codigo, ENVIO_RECENTE_DIAS_ATRAS, 'FALHOU');
      await semearTentativaEm(
        cenario.contexto,
        cSemDestinatario.codigo,
        ENVIO_RECENTE_DIAS_ATRAS,
        'SEM_DESTINATARIO',
      );
      await semearTentativaEm(
        cenario.contexto,
        cEnviada.codigo,
        ENVIO_RECENTE_DIAS_ATRAS,
        'ENVIADA',
      );

      const primeira = await emUnidade(
        cenario.contexto,
        async (tx) => await selecionarCandidatasAoAviso(tx, RECORTE_DA_REGUA),
      );

      // ⚠️ DIVERGÊNCIA DECLARADA contra a RN-06, medida no oráculo — ver o cabeçalho e o marcador
      // `DECISÃO FECHADA` de `../src/envio-de-cobranca.ts`. Uma trava que contasse todo desfecho
      // devolveria lista VAZIA aqui.
      expect(primeira.map((candidata) => candidata.codigo)).toStrictEqual([
        cFalhou.codigo,
        cSemDestinatario.codigo,
      ]);

      // O companheiro negativo está DENTRO do caso: a mesma cobrança, o mesmo instante relativo, e
      // apenas o desfecho trocado para `ENVIADA`.
      await semearTentativaEm(
        cenario.contexto,
        cFalhou.codigo,
        ENVIO_RECENTE_DIAS_ATRAS,
        'ENVIADA',
      );

      const segunda = await emUnidade(
        cenario.contexto,
        async (tx) => await selecionarCandidatasAoAviso(tx, RECORTE_DA_REGUA),
      );

      expect(segunda.map((candidata) => candidata.codigo)).toStrictEqual([cSemDestinatario.codigo]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Acessórios do arranjo — nenhum deles alcança o banco fora de uma unidade de trabalho
// ===========================================================================

/** O contexto de uma empresa, como a guarda o publica a partir da sessão. */
interface Contexto {
  readonly empresaId: string;
}

/** Um cenário montado: a empresa, o contrato ativo e os três textos que a junção projeta. */
interface Cenario {
  readonly contexto: Contexto;
  readonly contratoId: string;
  readonly nomeDoLocatario: string;
  readonly imovel: string;
  readonly conjunto: string;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Cria uma empresa (ou reusa a informada), os cadastros e um contrato **ATIVO**, pelas portas
 * públicas.
 *
 * O contrato é ativado pelo protocolo das **duas unidades sequenciais** que a borda usa: a primeira
 * garante o contador e commita, a segunda emite o número e grava. As derivações da ativação saem do
 * ponto único da RD-10, e não de uma conta escrita aqui. Mesmo desenho de `semearContrato` em
 * `cobranca.spec.ts`.
 *
 * `locatarioSemContato` troca a porta que cria o locatário por
 * {@link semearLocatarioSemContato} — que também é porta de produção, com o endereço vazio que a
 * RD-11 admite. É a precondição do passo 5 do CT-610.
 */
async function semearCenario(
  sufixo: string,
  opcoes: { readonly contexto?: Contexto; readonly locatarioSemContato?: boolean } = {},
): Promise<Cenario> {
  sequenciaDoCenario += 1;
  const marca = `${sufixo}-${String(sequenciaDoCenario)}`;
  const contexto = opcoes.contexto ?? (await admitirEmpresaNova(marca));
  const nomeDoLocatario = `Locatário ${marca}`;
  const imovel = `IPTU-${marca}`;
  const conjunto = `Conjunto ${marca}`;

  const cadastros = await emUnidade(contexto, async (tx) => {
    const conjuntoCriado = await criarConjunto(tx, { nome: conjunto });

    const imovelCriado = await criarImovel(tx, {
      conjuntoId: conjuntoCriado.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: imovel,
      tipoImovel: 'RESIDENCIAL',
      logradouro: 'Rua das Acácias',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000000',
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const dadosDoLocatario = pessoaDe(nomeDoLocatario);
    const locatario =
      opcoes.locatarioSemContato === true
        ? await semearLocatarioSemContato(tx, dadosDoLocatario)
        : await criarPessoa(tx, 'locatario', dadosDoLocatario);

    return { imovelId: imovelCriado.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidade(contexto, lerAnoDaSerieDeContrato);

  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });

  const contrato = await emUnidade(contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano: anoDoContrato, numero },
    );
  });

  await emUnidade(contexto, async (tx) => {
    const ativado = await ativarContrato(tx, contrato.codigo, {
      dataFimLocacao: derivarTerminoDaLocacao(
        TERMOS_DO_CONTRATO.dataInicioLocacao,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
      valorTotalContrato: derivarValorTotal(
        TERMOS_DO_CONTRATO.valorMensal,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
    });

    if (ativado === undefined) {
      throw new Error(`o arranjo não conseguiu ativar o contrato ${contrato.codigo}`);
    }
  });

  return { contexto, contratoId: contrato.id, nomeDoLocatario, imovel, conjunto };
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 30_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: DESTINATARIO,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marca}`,
        documento: `${String(Date.now()).slice(-8)}${String(sequenciaDoCenario).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

/**
 * Lança uma cobrança pelo protocolo das **duas unidades sequenciais** da série (ADR-0015).
 *
 * A primeira unidade garante o contador e commita; a segunda emite o número e grava. Fundir as duas é
 * justamente o desenho que a ADR-0015 recusa, e um acessório que o fizesse montaria o cenário por um
 * caminho que a operação não tem.
 *
 * O vencimento é derivado de `negocio.data_corrente_da_operacao()` por deslocamento — **nunca** de um
 * `new Date()` do processo.
 */
async function lancar(
  cenario: Cenario,
  pedido: { readonly diasAteVencimento: number },
): Promise<LinhaDeCobranca> {
  const ano = await emUnidade(cenario.contexto, lerAnoDaSerieDeCobranca);
  const dataVencimento = await dataDeslocada(cenario.contexto, pedido.diasAteVencimento);

  await emUnidade(cenario.contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, ano);
  });

  return await emUnidade(cenario.contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);

    return await criarCobranca(
      tx,
      {
        contratoId: cenario.contratoId,
        natureza: 'ALUGUEL',
        referencia: 'Aluguel de janeiro/2026',
        competencia: COMPETENCIA,
        dataVencimento,
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano, numero },
    );
  });
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que todo cenário deste arquivo é posicionado**: o relógio nunca é falseado, o dado é que
 * se move. A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que a visão consulta e que o
 * predicado compara, de modo que a fronteira dos dias é medida contra o próprio eixo que a decide.
 */
async function dataDeslocada(contexto: Contexto, dias: number): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/**
 * Semeia uma tentativa de envio **no passado**, com `criado_em` explícito.
 *
 * É instrução própria, e não a porta de produção, por decisão da Iron Law #6: `criado_em` nasce do
 * padrão da coluna (`now()`, do banco), e `registrarEnvioDeCobranca` **não tem** por onde receber um
 * instante. Abrir esse parâmetro na porta para servir a este arranjo daria a quem chama o poder de
 * escolher quando a tentativa aconteceu — que é exatamente o instante pelo qual a trava conta.
 *
 * A instrução corre com o papel da aplicação, sob a política de linha, e **não compara `empresa_id`
 * com coisa alguma**: a empresa sai da mesma expressão que as políticas avaliam. O deslocamento é
 * derivado de `now()` do servidor, e não de um relógio do processo.
 *
 * A `causa` é pareada com o desfecho aqui pelo mesmo critério que o banco impõe — a bicondicional de
 * `envio_de_cobranca_causa_chk` recusaria o par incoerente, e o arranjo morreria longe da causa.
 */
async function semearTentativaEm(
  contexto: Contexto,
  codigo: string,
  diasAtras: number,
  desfecho: EnvioDeCobranca['desfecho'],
): Promise<void> {
  const causa = desfecho === 'ENVIADA' ? null : CAUSA_DA_FALHA;

  const alcancadas = await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      INSERT INTO negocio.envio_de_cobranca (
        empresa_id, cobranca_id, criado_em, caminho, desfecho, destinatario, causa
      )
      SELECT nullif(current_setting('app.empresa_id', true), '')::uuid,
             c.id,
             now() - make_interval(days => ${diasAtras}::integer),
             'AUTOMATICO'::negocio.caminho_do_aviso,
             ${desfecho}::negocio.desfecho_do_aviso,
             ${DESTINATARIO},
             ${causa}
        FROM negocio.cobranca c
       WHERE c.codigo = ${codigo}
    `;

    return resultado.count;
  });

  if (alcancadas !== 1) {
    throw new Error(`o arranjo não conseguiu semear a tentativa da cobrança ${codigo}`);
  }
}

/**
 * Acusa o pagamento **pela porta de produção** — o mesmo caminho que a rota usa por dentro.
 *
 * O que ela informa são os dois fatos do ato, e nada mais: multa, juros e os dois percentuais são
 * copiados da visão dentro da própria instrução que grava, de modo que este arquivo não tem como
 * propor um valor de mora.
 */
async function pagar(contexto: Contexto, codigo: string): Promise<void> {
  const pagoEm = await dataDeslocada(contexto, 0);

  const linha = await emUnidade(
    contexto,
    async (tx) => await acusarPagamentoDeCobranca(tx, codigo, { pagoEm, valorPago: VALOR_PAGO }),
  );

  if (linha === undefined) {
    throw new Error(`o arranjo não conseguiu acusar o pagamento da cobrança ${codigo}`);
  }
}

/** Cancela a cobrança pela porta de produção — a mesma que a rota de transição chama por dentro. */
async function cancelar(contexto: Contexto, codigo: string): Promise<void> {
  const linha = await emUnidade(contexto, async (tx) => await cancelarCobranca(tx, codigo));

  if (linha === undefined) {
    throw new Error(`o arranjo não conseguiu cancelar a cobrança ${codigo}`);
  }
}

/**
 * Quantas linhas de `negocio.envio_de_cobranca` o contexto corrente alcança.
 *
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008). Ela conta a
 * TABELA — o que se conta são fatos gravados. O `-1` do ramo impossível existe para que uma contagem
 * que não voltasse reprovasse em vez de virar zero, que é justamente um dos valores esperados.
 */
async function contarLinhasDeEnvio(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.envio_de_cobranca
    `;

    return Number(linha?.total ?? -1);
  });
}

/**
 * O `valor_total` que a visão publica para um código — lido **por fora do SUT**.
 *
 * Ele é o oráculo do passo 4 do CT-610: a candidata carrega o dinheiro como a view o apura, e não uma
 * soma recomposta na aplicação. Lê-lo pela porta `localizarCobranca` não serviria — ela converte
 * `numeric` em `number`, e o que está sob prova é justamente que o predicado **não** converte.
 */
async function lerValorTotalDaView(contexto: Contexto, codigo: string): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ valorTotal: string }[]>`
      SELECT valor_total AS "valorTotal"
        FROM negocio.cobranca_derivada
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a visão derivada não devolveu a cobrança ${codigo}`);
    }

    return linha.valorTotal;
  });
}

/**
 * A hora corrente pelo fuso da operação, escrita **por extenso** e não derivada do SUT.
 *
 * Derivá-la do símbolo sob prova faria a asserção concordar consigo mesma: um leitor de produção que
 * trocasse de fuso deixaria de reprovar caso algum. O que os dois compartilham é a consulta, não a
 * definição — mesma disciplina de `lerAnoDaOperacao` em `cobranca.spec.ts`.
 */
async function lerHoraDaOperacaoCrua(contexto: Contexto): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ hora: string }[]>`
      SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS hora
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a hora corrente da operação');
    }

    return linha.hora;
  });
}

/**
 * A candidata de um código, ou uma falha nomeada.
 *
 * O acessório existe para que o passo 4 do CT-610 não use `!` nem `as`: a indexação devolveria
 * `CandidataAoAviso | undefined`, e forçar o tipo trocaria uma falha de arranjo por um `undefined`
 * atravessando a asserção.
 */
function candidataPorCodigo(
  candidatas: readonly CandidataAoAviso[],
  codigo: string,
): CandidataAoAviso {
  const encontrada = candidatas.find((candidata) => candidata.codigo === codigo);

  if (encontrada === undefined) {
    throw new Error(`o conjunto devolvido não trouxe a cobrança ${codigo}`);
  }

  return encontrada;
}
