/**
 * A **execução** da régua contra banco real e portas reais — CT-615 a CT-620, da T6 da fatia
 * `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-04    | CT-615 | Dentro da janela e com política ativa, `executarReguaDaEmpresa` entrega à
 * | CA-17    |        | porta **uma** mensagem por candidata elegível, com destinatário igual ao
 * |          |        | `email` do locatário de cada uma, e grava para cada uma **um** registro
 * |          |        | `ENVIADA` com `caminho: 'AUTOMATICO'` e `causa: null`. As duas não elegíveis
 * |          |        | não produzem captura nem registro. O resultado devolvido é comparado
 * |          |        | **inteiro**, por `toStrictEqual`. |
 * | CA-08    | CT-615 | O disparo **manual** entra na MESMA admissão: estado terminal levanta
 * | CA-13    | (b)    | `ErroDeEstadoNaoAvisavel` nomeando o estado, **sem mensagem e sem linha**; e a
 * |          |        | cobrança que o automático **não** avisa (travada pelo intervalo) é avisada
 * |          |        | pelo manual, com `caminho: 'MANUAL'` — a diferença entre os dois desfechos é
 * |          |        | **apenas** o parâmetro `dispensas`. |
 * | CA-05    | CT-616 | Com o instante FORA da janela, zero capturas e contagem crua `0`; com o
 * |          |        | instante na borda `09:00`, sobre o **mesmo** estado de banco, três capturas e
 * |          |        | contagem crua `3`. O controle positivo é obrigatório. |
 * | CA-03    | CT-617 | Empresa **sem linha** de política e empresa com `ativo: false` terminam com
 * |          |        | zero capturas, contagem crua `0` e **nenhuma exceção**; a contagem crua de
 * |          |        | `politica_de_aviso` permanece `0` no primeiro arranjo — a régua **não cria** a
 * |          |        | linha. Ligada a política, a MESMA empresa avisa as três. |
 * | CA-10    | CT-618 | Quando a porta recusa a entrega, grava-se `FALHOU` com `causa` igual à cadeia
 * | RN-09    |        | recusada, as outras duas cobranças são `ENVIADA` — **o laço não para** —, e os
 * |          |        | **cinco** valores de `negocio.cobranca_derivada` (`status`, `diasAtraso`,
 * |          |        | `valorMulta`, `valorJuros`, `valorTotal`) são idênticos antes e depois, valor a
 * |          |        | valor. A mora do alvo é **não nula**, senão a igualdade seria vazia. |
 * | CA-16    | CT-619 | Locatário sem endereço gera `SEM_DESTINATARIO` com `destinatario` vazio e
 * | RN-11    |        | `causa` exata, **sem mensagem**, sem interromper as demais; e a segunda
 * |          |        | execução gera um **segundo** `SEM_DESTINATARIO` (total `4`) sem captura nova —
 * |          |        | o desfecho **não trava** o intervalo, e as duas `ENVIADA` travam. |
 * | CA-02    | CT-620 | Duas empresas com políticas divergentes avisam conjuntos **diferentes**: A
 * | CA-12    |        | avisa **2** e B avisa **0**, com as contagens cruas `3` e `1` sob cada
 * |          |        | contexto. Os códigos capturados são afirmados por igualdade de lista ordenada. |
 * | CA-16    | CT-730 | ⚠️ **Da T8 da fatia `documentos-e-confirmacao`, e é prova REGRESSIVA**: o
 * | (2b)     |        | estado de confirmação de e-mail do locatário **não** participa do predicado de
 * |          |        | elegibilidade. Com dois locatários com cobrança elegível, o conjunto que
 * |          |        | `selecionarCandidatasAoAviso` devolve é o **mesmo**, por igualdade de lista
 * |          |        | ordenada, antes e depois de um deles confirmar o endereço pelo caminho real. |
 *
 * Rastreabilidade: `CA-04 → CT-615 (RD-16)` · `CA-17 → CT-615 (RD-15)` · `CA-08 → CT-615 (b)
 * (RD-02)` · `CA-13 → CT-615 (b) (RD-07)` · `CA-05 → CT-616 (RD-06)` · `CA-03 → CT-617 (RD-03)` ·
 * `CA-10 → CT-618 (RD-09)` · `CA-16 → CT-619 (RD-11)` · `CA-02 → CT-620 (RD-10)` ·
 * `CA-16 (2b) → CT-730 (RD-06)`.
 *
 * ⚠️ **O CT-730 não altera asserção alguma dos seis casos anteriores**, e a ausência de alteração é
 * o conteúdo dele: a sub-fatia irmã (a régua) **não é tocada** por esta feature, e este caso é a
 * rede que o afirma na ponta mais sensível — o predicado. `packages/db/src/envio-de-cobranca.ts`
 * não foi tocado pela T8.
 *
 * ===========================================================================
 * POR QUE ESTES CASOS MORAM EM `packages/db/test/`, e não no pacote da régua
 * ===========================================================================
 *
 * Eles precisam de banco migrado e das **portas reais** — o predicado, o registro e a leitura da
 * política —, e `@sysloc/regua` **não pode** declarar `@sysloc/db` nem em `devDependencies`: a aresta
 * de volta fecha o ciclo `@sysloc/db#build ↔ @sysloc/regua#build`, que o Turborepo aborta antes de
 * compilar qualquer coisa (medido na T4). Aqui o domínio e a infraestrutura se encontram na direção
 * que a ADR-0025 fixa — `db → regua` —, e o acessório de banco efêmero já vive ao lado.
 *
 * O SUT é importado pela **fronteira do pacote** (`@sysloc/regua`), que é o caminho da operação, e é
 * também o que faz um mutante no fonte da régua alcançar esta suíte quando ela roda pelo script do
 * pacote (`pnpm --filter @sysloc/db test`, que compila antes) — nunca por `vitest run` avulso.
 *
 * ===========================================================================
 * O CAPTURADOR NÃO É MOCK — e a distinção decide a leitura destes casos
 * ===========================================================================
 *
 * `criarCapturadorDeEmail` é **implementação** da `PortaDeEnvioDeEmail` que o domínio declarou, com a
 * mesma assinatura pela qual o adaptador de produção é exercitado. O que ele substitui é o **destino
 * da mensagem**, nunca a lógica sob prova: a régua não sabe qual das duas recebeu.
 *
 * É a única forma de provar entrega **sem entregar** (D5), e a barreira que a torna suficiente é
 * estrutural: nenhum arquivo desta suíte tem caminho para construir o adaptador de produção, e o
 * CT-626 (`barreira-de-envio.spec.ts`) afirma isso por varredura sobre os quatro diretórios de teste.
 *
 * ===========================================================================
 * O RELÓGIO NUNCA É FALSEADO — o cenário é posicionado pelo DADO
 * ===========================================================================
 *
 * Todo vencimento é derivado de `negocio.data_corrente_da_operacao() ± INTERVAL 'N days'`, e o
 * instante da janela entra como **parâmetro** de `executarReguaDaEmpresa` — nunca por relógio falso
 * global. As tentativas no passado são semeadas por instrução própria, com `criado_em` derivado do
 * `now()` do servidor: a porta de produção **não tem** por onde receber um instante, e é justamente
 * por ele que a trava conta (Iron Law #6).
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

import {
  type CandidataAoAviso,
  type CapturadorDeEmail,
  criarCapturadorDeEmail,
  DISPENSAS_DO_DISPARO_MANUAL,
  ErroDeEstadoNaoAvisavel,
  enviarAvisoDeCobranca,
  executarReguaDaEmpresa,
  type PortaDeCandidatas,
  type PortaDeRegistro,
  type ResultadoDaRegua,
} from '@sysloc/regua';
import type { EnvioDeCobranca, PoliticaDeAviso, PoliticaDeAvisoNova } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa, localizarPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  cancelarCobranca,
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
} from '../src/cobranca.ts';
import { gravarConfiguracaoDeMora } from '../src/configuracao-de-mora.ts';
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
  lerEnviosDaCobranca,
  registrarEnvioDeCobranca,
  selecionarCandidatasAoAviso,
} from '../src/envio-de-cobranca.ts';
import { criarImovel } from '../src/imovel.ts';
import { gravarPoliticaDeAviso, lerPoliticaDeAviso } from '../src/politica-de-aviso.ts';
import { consumirPortador } from '../src/portador-de-confirmacao.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import {
  type BancoMigrado,
  bancoEfemero,
  semearLocatarioSemContato,
  semearPoliticaDeAviso,
  semearPortadorDeConfirmacao,
} from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso monta até três contratos e cinco cobranças, cada uma em unidades sequenciais. */
const LIMITE_DO_CASO_MS = 180_000;

/** Reserva de UMA conexão: unidade de trabalho que vazasse reserva trava o caso seguinte. */
const RESERVA_DE_UMA = 1;

/** O contexto da empresa da carga inicial — usado só para admitir as empresas dos cenários. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

// ---------------------------------------------------------------------------
// As políticas sob prova
// ---------------------------------------------------------------------------

/** Dez dias de antecedência — o que separa a cobrança a `+5` da que vence em `+40`. */
const DIAS_DE_ANTECEDENCIA = 10;

/** Dois dias de intervalo mínimo — o que separa a tentativa de `−1` da de `−10`. */
const INTERVALO_MINIMO_EM_DIAS = 2;

/** A janela do CT-615 e do CT-616 — a borda `09:00` é conteúdo, e o CT-616 a exercita. */
const ABERTURA_DA_JANELA = '09:00';
const FECHAMENTO_DA_JANELA = '18:00';

/** O instante do trabalho, dentro da janela — entra por **parâmetro**, nunca por relógio falso. */
const AGORA_DENTRO_DA_JANELA = '13:00';

/** Um minuto antes da abertura: o instante que não permite a passagem. */
const AGORA_FORA_DA_JANELA = '08:59';

/** A política ligada, com a janela recortada — a do CT-615 e do CT-616. */
const POLITICA_COM_JANELA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: DIAS_DE_ANTECEDENCIA,
  intervaloMinimoDias: INTERVALO_MINIMO_EM_DIAS,
  janelaInicio: ABERTURA_DA_JANELA,
  janelaFim: FECHAMENTO_DA_JANELA,
  canal: 'EMAIL',
};

/** A política ligada com a janela que nunca fecha — usada onde o eixo sob prova não é o horário. */
const POLITICA_LIGADA: PoliticaDeAvisoNova = {
  ...POLITICA_COM_JANELA,
  janelaInicio: '00:00',
  janelaFim: '23:59',
};

/** A mesma política, **desligada** — o segundo arranjo do CT-617. */
const POLITICA_DESLIGADA: PoliticaDeAvisoNova = { ...POLITICA_LIGADA, ativo: false };

/** A política de A no CT-620: dez dias de antecedência e trava curta. */
const POLITICA_DA_EMPRESA_A: PoliticaDeAvisoNova = POLITICA_LIGADA;

/**
 * A política de B no CT-620: **nenhum** dia de antecedência e trava de trinta dias.
 *
 * Os dois eixos são escolhidos para produzir conjunto DIFERENTE do de A sobre carteiras idênticas —
 * conjuntos iguais não distinguiriam *"cada uma pela sua"* de *"uma política única para todas"*.
 */
const POLITICA_DA_EMPRESA_B: PoliticaDeAvisoNova = {
  ...POLITICA_LIGADA,
  diasAntesDoVencimento: 0,
  intervaloMinimoDias: 30,
};

// ---------------------------------------------------------------------------
// Os deslocamentos do arranjo — o veredito declarado ANTES da execução
// ---------------------------------------------------------------------------

/** `A_VENCER` dentro dos dias — ELEGÍVEL. */
const A_VENCER_DENTRO_DOS_DIAS = 5;

/** `A_VENCER` fora dos dias — não elegível. */
const A_VENCER_FORA_DOS_DIAS = 40;

/** `VENCIDA` recente — ELEGÍVEL. */
const VENCIDA_RECENTE = -12;

/** `VENCIDA` antiga, com mora acumulada — ELEGÍVEL, e o alvo da recusa no CT-618. */
const VENCIDA_ANTIGA = -30;

/** `VENCIDA` que será CANCELADA — não elegível. É o caso que discrimina o defeito do legado. */
const VENCIDA_CANCELADA = -25;

/** O vencimento das duas carteiras do CT-620 — o mesmo nas duas empresas, por construção. */
const VENCIDA_DA_CARTEIRA = -20;

/** O envio que TRAVA o intervalo de dois dias. */
const ENVIO_RECENTE_DIAS_ATRAS = 1;

/** O envio que NÃO trava o intervalo de dois dias, e trava o de trinta. */
const ENVIO_ANTIGO_DIAS_ATRAS = 10;

/** Valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

// ---------------------------------------------------------------------------
// Os textos que a suíte compara por igualdade
// ---------------------------------------------------------------------------

/** O diagnóstico com que a porta recusa a entrega no CT-618 — cadeia EXATA. */
const CAUSA_DA_FALHA = 'conexão recusada pelo transporte';

/** O que a régua grava quando o locatário não tem endereço — cadeia EXATA (RD-11). */
const CAUSA_SEM_DESTINATARIO = 'locatário sem endereço de contato';

/** A multa e os juros da empresa do CT-618 — é o que faz a mora do alvo ser **não nula**. */
const MULTA_PERCENTUAL = 2;
const JUROS_PERCENTUAL = 1;

/** O molde do código de cobrança dentro do assunto do aviso — como ligar captura a cobrança. */
const CODIGO_NO_ASSUNTO = /COB-\d{4}-\d{7}/;

/** Janela folgada do histórico: nenhum caso deste arquivo passa de quatro linhas por cobrança. */
const JANELA_INTEIRA = { limite: 50, deslocamento: 0 } as const;

/** Os termos do contrato de todo cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
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
// CT-615 — a régua envia pelo capturador e grava `ENVIADA` com o destinatário do locatário
// ===========================================================================

describe('CT-615 — a passagem automática entrega e registra o que entregou', () => {
  it(
    'CT-615 — três elegíveis viram três capturas e três registros `ENVIADA`; as duas outras, nada',
    async () => {
      const contexto = await admitirEmpresaNova('envio');
      const primeiro = await semearCenario('envio-a', contexto);
      const segundo = await semearCenario('envio-b', contexto);
      const terceiro = await semearCenario('envio-c', contexto);

      await gravar(contexto, POLITICA_COM_JANELA);

      // As três elegíveis, uma por locatário — é o que faz a asserção sobre destinatários
      // discriminar. Fossem do mesmo contrato, `['x','x','x']` passaria com a régua mandando tudo
      // para o mesmo lugar.
      const aVencer = await lancar(primeiro, A_VENCER_DENTRO_DOS_DIAS);
      const vencida = await lancar(segundo, VENCIDA_RECENTE);
      const antiga = await lancar(terceiro, VENCIDA_ANTIGA);

      // As duas que NÃO entram: uma por estar fora do recorte de dias, outra por estar cancelada.
      const foraDosDias = await lancar(primeiro, A_VENCER_FORA_DOS_DIAS);
      const cancelada = await lancar(primeiro, VENCIDA_CANCELADA);
      await cancelar(contexto, cancelada.codigo);

      const capturador = criarCapturadorDeEmail();
      const resultado = await passar(contexto, capturador, AGORA_DENTRO_DA_JANELA);

      // O resultado INTEIRO, por igualdade estrita: contagens erradas passariam por uma asserção de
      // presença, e é a contagem que a borda do job consome para decidir se levanta.
      expect(resultado).toStrictEqual({
        candidatas: 3,
        enviadas: 3,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);

      // O que SAIU: uma mensagem por candidata, na ordem do predicado (`data_vencimento`, `codigo`),
      // cada uma para o endereço do SEU locatário.
      expect(capturador.capturas.map((captura) => captura.destinatario)).toStrictEqual([
        terceiro.destinatario,
        segundo.destinatario,
        primeiro.destinatario,
      ]);
      expect(codigosCapturados(capturador)).toStrictEqual([
        antiga.codigo,
        vencida.codigo,
        aVencer.codigo,
      ]);

      // O que foi GRAVADO: contagem crua da tabela, sem recorte escrito aqui.
      expect(await contarLinhasDeEnvio(contexto)).toBe(3);

      for (const cobranca of [aVencer, vencida, antiga]) {
        const historico = await lerHistorico(contexto, cobranca.codigo);

        expect(historico).toHaveLength(1);
        expect(
          historico.map(({ cobrancaCodigo, caminho, desfecho, causa }) => ({
            cobrancaCodigo,
            caminho,
            desfecho,
            causa,
          })),
        ).toStrictEqual([
          {
            cobrancaCodigo: cobranca.codigo,
            caminho: 'AUTOMATICO',
            desfecho: 'ENVIADA',
            causa: null,
          },
        ]);
      }

      // O destinatário gravado é o mesmo que foi capturado — os dois lados do mesmo fato.
      expect(await destinatarioRegistrado(contexto, aVencer.codigo)).toBe(primeiro.destinatario);

      // E as duas não elegíveis não produziram captura nem linha.
      expect(await lerHistorico(contexto, foraDosDias.codigo)).toStrictEqual([]);
      expect(await lerHistorico(contexto, cancelada.codigo)).toStrictEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-615 (b) — o disparo manual entra na MESMA admissão, e só o parâmetro `dispensas` difere',
    async () => {
      const contexto = await admitirEmpresaNova('manual');
      const cenario = await semearCenario('manual', contexto);

      await gravar(contexto, POLITICA_LIGADA);

      // Uma cobrança TERMINAL e uma cobrança que o automático não avisa por estar TRAVADA pelo
      // intervalo. As duas juntas separam o que a admissão recusa (estado) do que ela dispensa.
      const terminal = await lancar(cenario, VENCIDA_CANCELADA);
      await cancelar(contexto, terminal.codigo);

      const travada = await lancar(cenario, VENCIDA_RECENTE);
      await semearTentativaEm(contexto, travada.codigo, ENVIO_RECENTE_DIAS_ATRAS, 'ENVIADA');

      const linhasAntes = await contarLinhasDeEnvio(contexto);
      const capturador = criarCapturadorDeEmail();

      // --- O automático não avisa nenhuma das duas: uma pelo estado, outra pela trava -------------
      expect(await passar(contexto, capturador, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 0,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(capturador.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(linhasAntes);

      // --- O manual sobre a TERMINAL: recusa nomeando o estado, sem mensagem e sem linha ----------
      await expect(
        disparar(contexto, capturador, await candidataDe(contexto, cenario, terminal)),
      ).rejects.toThrowError(ErroDeEstadoNaoAvisavel);

      const recusa = await recusaDoDisparo(
        contexto,
        capturador,
        await candidataDe(contexto, cenario, terminal),
      );

      expect(recusa.estado).toBe('CANCELADA');
      expect(recusa.message).toBe('estado não avisável: CANCELADA');
      expect(capturador.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(linhasAntes);

      // --- O manual sobre a TRAVADA: a dispensa é o ÚNICO eixo que mudou, e ela envia -------------
      const registro = await disparar(
        contexto,
        capturador,
        await candidataDe(contexto, cenario, travada),
      );

      expect({
        cobrancaCodigo: registro.cobrancaCodigo,
        caminho: registro.caminho,
        desfecho: registro.desfecho,
        destinatario: registro.destinatario,
        causa: registro.causa,
      }).toStrictEqual({
        cobrancaCodigo: travada.codigo,
        caminho: 'MANUAL',
        desfecho: 'ENVIADA',
        destinatario: cenario.destinatario,
        causa: null,
      });
      expect(capturador.capturas.map((captura) => captura.destinatario)).toStrictEqual([
        cenario.destinatario,
      ]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(linhasAntes + 1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-616 — fora da janela nada sai e nada é registrado, com o controle positivo dentro dela
// ===========================================================================

describe('CT-616 — a janela é conferida uma vez, para o job inteiro', () => {
  it(
    'CT-616 — `08:59` não envia nem registra; `09:00`, sobre o MESMO estado, envia as três',
    async () => {
      const contexto = await admitirEmpresaNova('janela');
      const primeiro = await semearCenario('janela-a', contexto);
      const segundo = await semearCenario('janela-b', contexto);
      const terceiro = await semearCenario('janela-c', contexto);

      await gravar(contexto, POLITICA_COM_JANELA);
      await lancar(primeiro, A_VENCER_DENTRO_DOS_DIAS);
      await lancar(segundo, VENCIDA_RECENTE);
      await lancar(terceiro, VENCIDA_ANTIGA);

      // --- Fora da janela: zero e zero ------------------------------------------------------------
      const fora = criarCapturadorDeEmail();

      expect(await passar(contexto, fora, AGORA_FORA_DA_JANELA)).toStrictEqual({
        candidatas: 0,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(fora.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(0);

      // --- CONTROLE POSITIVO, na BORDA da janela, sobre o MESMO estado de banco -------------------
      //
      // Sem ele, o caso seria satisfeito por uma régua que nunca envia — o modo de falha mais fácil
      // de passar despercebido aqui. E a borda `09:00` é conteúdo: um `>` no lugar do `>=` em
      // `dentroDaJanela` faria a empresa perder o minuto de abertura, e este passo reprova.
      const dentro = criarCapturadorDeEmail();

      expect(await passar(contexto, dentro, ABERTURA_DA_JANELA)).toStrictEqual({
        candidatas: 3,
        enviadas: 3,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(dentro.capturas).toHaveLength(3);
      expect(await contarLinhasDeEnvio(contexto)).toBe(3);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-617 — a régua nasce DESLIGADA, e desligada não é quebrada
// ===========================================================================

describe('CT-617 — política ausente ou desligada não avisa e não registra falha alguma', () => {
  it(
    'CT-617 — sem linha e com `ativo: false`: zero e zero, sem exceção e sem criar a política',
    async () => {
      const contexto = await admitirEmpresaNova('desligada');
      const primeiro = await semearCenario('desligada-a', contexto);
      const segundo = await semearCenario('desligada-b', contexto);
      const terceiro = await semearCenario('desligada-c', contexto);

      // As três SERIAM elegíveis se houvesse política — sem isso o caso não discrimina.
      await lancar(primeiro, A_VENCER_DENTRO_DOS_DIAS);
      await lancar(segundo, VENCIDA_RECENTE);
      await lancar(terceiro, VENCIDA_ANTIGA);

      // --- Arranjo 1: a empresa NUNCA configurou --------------------------------------------------
      const semPolitica = criarCapturadorDeEmail();

      expect(await passar(contexto, semPolitica, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 0,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(semPolitica.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(0);

      // A régua NÃO cria a linha: é a contagem crua que separa esta forma de um `upsert` escondido
      // na leitura, e é o que faz o `GET` da política continuar seguro de repetir.
      expect(await contarLinhasDePolitica(contexto)).toBe(0);

      // --- Arranjo 2: a empresa configurou e DESLIGOU ---------------------------------------------
      await gravar(contexto, POLITICA_DESLIGADA);

      const desligada = criarCapturadorDeEmail();

      expect(await passar(contexto, desligada, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 0,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(desligada.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(0);

      // --- CONTROLE POSITIVO: a MESMA empresa, com a política ligada, avisa as três ---------------
      //
      // É ele que separa "desligada" de "quebrada". Sem ele, uma régua que nunca envia passaria nos
      // dois arranjos acima.
      await gravar(contexto, POLITICA_LIGADA);

      const ligada = criarCapturadorDeEmail();

      expect(await passar(contexto, ligada, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 3,
        enviadas: 3,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(ligada.capturas).toHaveLength(3);
      expect(await contarLinhasDeEnvio(contexto)).toBe(3);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-618 — a falha registra a causa e NÃO toca o financeiro
// ===========================================================================

describe('CT-618 — a falha de entrega não escreve em `negocio.cobranca`', () => {
  it(
    'CT-618 — `FALHOU` com causa, as outras duas `ENVIADA`, e os cinco valores da view idênticos',
    async () => {
      const contexto = await admitirEmpresaNova('falha');
      const comuns = await semearCenario('falha-comuns', contexto);
      const doAlvo = await semearCenario('falha-alvo', contexto);

      // A mora é da EMPRESA, e é o que faz o alvo ter multa e juros não nulos — sem isso a igualdade
      // dos cinco valores seria satisfeita por três zeros e não afirmaria nada.
      await emUnidade(contexto, async (tx) => {
        await gravarConfiguracaoDeMora(tx, {
          multaPercentual: MULTA_PERCENTUAL,
          jurosPercentual: JUROS_PERCENTUAL,
        });
      });
      await gravar(contexto, POLITICA_LIGADA);

      const primeira = await lancar(comuns, VENCIDA_RECENTE);
      const segunda = await lancar(comuns, VENCIDA_CANCELADA);
      const alvo = await lancar(doAlvo, VENCIDA_ANTIGA);

      // Os cinco valores ANTES — lidos por fora do SUT, direto da visão.
      const antes = await lerDerivadaCrua(contexto, alvo.codigo);

      // Precondição declarada: a mora do alvo é não nula. É ela que dá conteúdo à igualdade.
      expect(antes.valorMulta).not.toBe('0.00');
      expect(antes.valorJuros).not.toBe('0.00');

      const capturador = criarCapturadorDeEmail();

      // A recusa entra pela MESMA interface da produção, e o domínio não sabe que foi provocada.
      // Nenhum ramo de falha é acrescentado ao adaptador de produção, e nenhuma bandeira de ambiente.
      capturador.recusar(doAlvo.destinatario, CAUSA_DA_FALHA);

      const resultado = await passar(contexto, capturador, AGORA_DENTRO_DA_JANELA);

      // O laço NÃO parou: três candidatas, duas entregues, uma falha — e o sinal para a borda.
      expect(resultado).toStrictEqual({
        candidatas: 3,
        enviadas: 2,
        falhas: 1,
        semDestinatario: 0,
        houveFalha: true,
      } satisfies ResultadoDaRegua);

      // Os cinco valores DEPOIS, um a um, por igualdade estrita — nunca asserção de presença.
      const depois = await lerDerivadaCrua(contexto, alvo.codigo);

      expect(depois.status).toBe(antes.status);
      expect(depois.diasAtraso).toBe(antes.diasAtraso);
      expect(depois.valorMulta).toBe(antes.valorMulta);
      expect(depois.valorJuros).toBe(antes.valorJuros);
      expect(depois.valorTotal).toBe(antes.valorTotal);
      expect(depois).toStrictEqual(antes);

      // O registro do alvo: `FALHOU`, com a causa exata e o endereço tentado.
      const historicoDoAlvo = await lerHistorico(contexto, alvo.codigo);

      expect(historicoDoAlvo).toHaveLength(1);
      expect(
        historicoDoAlvo.map(({ desfecho, destinatario, causa }) => ({
          desfecho,
          destinatario,
          causa,
        })),
      ).toStrictEqual([
        { desfecho: 'FALHOU', destinatario: doAlvo.destinatario, causa: CAUSA_DA_FALHA },
      ]);

      // E as outras duas seguiram — é isto que "o laço não para" significa em fatos gravados.
      for (const cobranca of [primeira, segunda]) {
        expect((await lerHistorico(contexto, cobranca.codigo)).map((linha) => linha.desfecho)) //
          .toStrictEqual(['ENVIADA']);
      }

      // A mensagem recusada NÃO saiu: as duas capturas são das outras duas cobranças.
      expect(capturador.capturas.map((captura) => captura.destinatario)).toStrictEqual([
        comuns.destinatario,
        comuns.destinatario,
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-619 — locatário sem endereço não trava e não interrompe
// ===========================================================================

describe('CT-619 — o cadastro sem contato vira fato registrado, e não silêncio', () => {
  it(
    'CT-619 — `SEM_DESTINATARIO` sem mensagem, sem interromper, e um SEGUNDO na execução seguinte',
    async () => {
      const contexto = await admitirEmpresaNova('sem-contato');
      const comContato = await semearCenario('sem-contato-a', contexto);
      const outroComContato = await semearCenario('sem-contato-b', contexto);
      const semContato = await semearCenario('sem-contato-c', contexto, {
        locatarioSemContato: true,
      });

      await gravar(contexto, POLITICA_LIGADA);

      const primeira = await lancar(comContato, VENCIDA_ANTIGA);
      const segunda = await lancar(outroComContato, VENCIDA_RECENTE);
      const orfa = await lancar(semContato, A_VENCER_DENTRO_DOS_DIAS);

      const capturador = criarCapturadorDeEmail();

      expect(await passar(contexto, capturador, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 3,
        enviadas: 2,
        falhas: 0,
        semDestinatario: 1,
        houveFalha: false,
      } satisfies ResultadoDaRegua);

      // Duas mensagens, e o conjunto de destinatários NÃO contém a cadeia vazia: um adaptador que
      // "enviasse para ninguém" apareceria aqui.
      expect(capturador.capturas.map((captura) => captura.destinatario)).toStrictEqual([
        comContato.destinatario,
        outroComContato.destinatario,
      ]);

      // Três linhas: duas `ENVIADA` e uma `SEM_DESTINATARIO` com endereço vazio e causa exata.
      expect(await contarLinhasDeEnvio(contexto)).toBe(3);
      expect(
        (await lerHistorico(contexto, orfa.codigo)).map(({ desfecho, destinatario, causa }) => ({
          desfecho,
          destinatario,
          causa,
        })),
      ).toStrictEqual([
        { desfecho: 'SEM_DESTINATARIO', destinatario: '', causa: CAUSA_SEM_DESTINATARIO },
      ]);

      for (const cobranca of [primeira, segunda]) {
        expect((await lerHistorico(contexto, cobranca.codigo)).map((linha) => linha.desfecho)) //
          .toStrictEqual(['ENVIADA']);
      }

      // --- A SEGUNDA execução: o `SEM_DESTINATARIO` não travou -------------------------------------
      //
      // As duas `ENVIADA` travam o intervalo e caem fora; a órfã volta e é tentada de novo. É o par
      // que prova a RD-11: o desfecho não trava, e a repetição do job não duplica aviso algum.
      const segundaPassagem = criarCapturadorDeEmail();

      expect(await passar(contexto, segundaPassagem, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 1,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 1,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(segundaPassagem.capturas).toStrictEqual([]);
      expect(await contarLinhasDeEnvio(contexto)).toBe(4);
      expect((await lerHistorico(contexto, orfa.codigo)).map((linha) => linha.desfecho)) //
        .toStrictEqual(['SEM_DESTINATARIO', 'SEM_DESTINATARIO']);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-620 — cada empresa avisa segundo a PRÓPRIA política
// ===========================================================================

describe('CT-620 — duas empresas, duas políticas, dois conjuntos diferentes', () => {
  it(
    'CT-620 — A avisa duas e B nenhuma, sobre carteiras idênticas, e um registro não vaza no outro',
    async () => {
      const contextoDeA = await admitirEmpresaNova('politica-a');
      const contextoDeB = await admitirEmpresaNova('politica-b');
      const cenarioA = await semearCenario('carteira-a', contextoDeA);
      const cenarioB = await semearCenario('carteira-b', contextoDeB);

      await gravar(contextoDeA, POLITICA_DA_EMPRESA_A);
      await gravar(contextoDeB, POLITICA_DA_EMPRESA_B);

      // Carteiras IDÊNTICAS: o que diferencia o desfecho é só a política de cada empresa.
      const aVencerDeA = await lancar(cenarioA, A_VENCER_DENTRO_DOS_DIAS);
      const vencidaDeA = await lancar(cenarioA, VENCIDA_DA_CARTEIRA);
      await semearTentativaEm(contextoDeA, vencidaDeA.codigo, ENVIO_ANTIGO_DIAS_ATRAS, 'ENVIADA');

      await lancar(cenarioB, A_VENCER_DENTRO_DOS_DIAS);
      const vencidaDeB = await lancar(cenarioB, VENCIDA_DA_CARTEIRA);
      await semearTentativaEm(contextoDeB, vencidaDeB.codigo, ENVIO_ANTIGO_DIAS_ATRAS, 'ENVIADA');

      // --- A: dez dias de antecedência e trava de dois dias ⇒ as duas entram ----------------------
      const capturadorDeA = criarCapturadorDeEmail();

      expect(await passar(contextoDeA, capturadorDeA, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 2,
        enviadas: 2,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(codigosCapturados(capturadorDeA)).toStrictEqual([
        vencidaDeA.codigo,
        aVencerDeA.codigo,
      ]);

      // --- B: nenhum dia de antecedência e trava de trinta dias ⇒ nenhuma entra -------------------
      const capturadorDeB = criarCapturadorDeEmail();

      expect(await passar(contextoDeB, capturadorDeB, AGORA_DENTRO_DA_JANELA)).toStrictEqual({
        candidatas: 0,
        enviadas: 0,
        falhas: 0,
        semDestinatario: 0,
        houveFalha: false,
      } satisfies ResultadoDaRegua);
      expect(capturadorDeB.capturas).toStrictEqual([]);

      // As contagens cruas sob CADA contexto: a de A cresceu pelas duas tentativas, a de B não.
      // Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política de linha.
      expect(await contarLinhasDeEnvio(contextoDeA)).toBe(3);
      expect(await contarLinhasDeEnvio(contextoDeB)).toBe(1);

      // E o destinatário de B não aparece entre os que A avisou.
      expect(capturadorDeA.capturas.map((captura) => captura.destinatario)).not.toContain(
        cenarioB.destinatario,
      );
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-730 — a confirmação de e-mail NÃO entra no predicado de elegibilidade
// ===========================================================================

describe('CT-730 — a régua continua avisando os dois locatários, confirmado e não confirmado', () => {
  it(
    'CT-730 — o conjunto de candidatas é o MESMO com e sem a coluna de confirmação populada',
    async () => {
      const contexto = await admitirEmpresaNova('confirmacao');
      const doConfirmado = await semearCenario('confirmacao-sim', contexto);
      const doNaoConfirmado = await semearCenario('confirmacao-nao', contexto);

      // A política entra como **precondição**, e não como objeto: quem prova a porta de escrita é o
      // CT-606. É por isso que o arranjo usa `semearPoliticaDeAviso` — e é este consumo que fechou o
      // **D13 (F3/T5)**, cujo gatilho escrito era literalmente *"a primeira suíte que precisar da
      // política como precondição sem ser objeto"*.
      await emUnidade(contexto, async (tx) => {
        await semearPoliticaDeAviso(tx, POLITICA_LIGADA);
      });

      const doConfirmadoVencida = await lancar(doConfirmado, VENCIDA_ANTIGA);
      const doNaoConfirmadoVencida = await lancar(doNaoConfirmado, VENCIDA_RECENTE);

      // O veredito ESCRITO ANTES da execução: as duas entram, na ordem do predicado
      // (`data_vencimento`, `codigo`) — a mais antiga primeiro.
      const esperadas = [doConfirmadoVencida.codigo, doNaoConfirmadoVencida.codigo];

      // --- Medição 1: os DOIS locatários ainda não confirmados ---------------------------------
      //
      // Ela é a linha de base do caso. Sem ela, a medição 2 sozinha não distinguiria "a confirmação
      // não muda o conjunto" de "o conjunto sempre foi esse por outro motivo".
      expect(await confirmacaoDe(contexto, doConfirmado.locatarioId)).toBeNull();
      expect(await confirmacaoDe(contexto, doNaoConfirmado.locatarioId)).toBeNull();
      expect(await codigosCandidatos(contexto)).toStrictEqual(esperadas);

      // --- O eixo que muda, e é o ÚNICO: um dos dois confirma o endereço ------------------------
      //
      // Pelo caminho real — portador emitido e consumido pelas portas de produção —, e não por
      // `UPDATE` no carimbo: é o consumo que grava `email_confirmado_em`, e montar o estado por fora
      // faria o caso provar a coluna em vez do fato.
      const consumo = await emUnidade(contexto, async (tx) => {
        const portador = await semearPortadorDeConfirmacao(tx, doConfirmado.locatarioId);
        return await consumirPortador(tx, portador.derivado);
      });

      if (consumo === undefined) {
        throw new Error('o arranjo não conseguiu confirmar o endereço do locatário');
      }

      // A precondição da medição 2, afirmada: um confirmado e outro não. Sem estas duas linhas, uma
      // confirmação que não tivesse acontecido faria a igualdade abaixo ser trivialmente verdadeira.
      expect(await confirmacaoDe(contexto, doConfirmado.locatarioId)).toEqual(consumo.confirmadoEm);
      expect(await confirmacaoDe(contexto, doNaoConfirmado.locatarioId)).toBeNull();

      // A política é **reafirmada** entre as duas medições, para que o único eixo diferente entre
      // elas seja o estado de confirmação. É esta segunda gravação que exercita o `ON CONFLICT` do
      // auxiliar — o caminho que o D13 registrava como nunca executado.
      await emUnidade(contexto, async (tx) => {
        await semearPoliticaDeAviso(tx, POLITICA_LIGADA);
      });

      // --- Medição 2: o MESMO conjunto, por igualdade de lista ordenada -------------------------
      //
      // Igualdade, nunca "pelo menos uma": é ela que reprova **as duas** direções do defeito — o
      // predicado que passasse a exigir a confirmação (perderia a segunda) e o que passasse a
      // excluir o confirmado (perderia a primeira). Uma asserção de contenção sobreviveria às duas.
      expect(await codigosCandidatos(contexto)).toStrictEqual(esperadas);
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

/** Um cenário montado: o contrato ativo, o contato do locatário e os textos que a junção projeta. */
interface Cenario {
  readonly contexto: Contexto;
  readonly contratoId: string;
  /**
   * O locatário do contrato — publicado pelo cenário a partir do **CT-730**, que precisa confirmar
   * o endereço de um deles pelo caminho real para provar que a confirmação não move o predicado.
   */
  readonly locatarioId: string;
  readonly nomeDoLocatario: string;
  readonly destinatario: string;
  readonly imovel: string;
  readonly conjunto: string;
}

/** Os cinco valores que `negocio.cobranca_derivada` publica e que a régua **não** pode mover. */
interface EstadoPublicado {
  readonly status: CandidataAoAviso['status'];
  readonly diasAtraso: number;
  readonly valorMulta: string;
  readonly valorJuros: string;
  readonly valorTotal: string;
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

/**
 * A porta de candidatas — o predicado real, sob o contexto da empresa.
 *
 * A aplicação parcial acontece **aqui**, e não no pacote de dados: é a borda que decide sob que
 * contexto e em que unidade de trabalho a consulta corre, e é exatamente o que a T8 fará no job.
 */
function portaDeCandidatas(contexto: Contexto, politica: PoliticaDeAviso): PortaDeCandidatas {
  return async () =>
    await emUnidade(contexto, async (tx) => await selecionarCandidatasAoAviso(tx, politica));
}

/**
 * A porta de registro — **uma unidade de trabalho por tentativa**.
 *
 * A unidade por chamada é o desenho, e não detalhe de arranjo: uma unidade para o job inteiro faria a
 * falha da décima cobrança desfazer o registro das nove anteriores, e é o registro que impede o
 * reenvio na repetição. O CT-618 é quem observa isso — a falha da terceira não apaga as duas
 * primeiras.
 */
function portaDeRegistro(contexto: Contexto): PortaDeRegistro {
  return async (tentativa) =>
    await emUnidade(contexto, async (tx) => await registrarEnvioDeCobranca(tx, tentativa));
}

/**
 * Uma passagem da régua, pelo caminho **da borda**: lê a política pela porta real e injeta as três.
 *
 * A política é lida com `lerPoliticaDeAviso` — que devolve a régua desligada quando a empresa nunca
 * configurou —, e não montada em memória: é assim que o job da T8 a obtém, e é o que faz o CT-617
 * provar a tradução da ausência em vez de uma constante escrita no teste.
 */
async function passar(
  contexto: Contexto,
  email: CapturadorDeEmail,
  agora: string,
): Promise<ResultadoDaRegua> {
  const politica = await emUnidade(contexto, lerPoliticaDeAviso);

  return await executarReguaDaEmpresa({
    politica,
    agora,
    candidatas: portaDeCandidatas(contexto, politica),
    registrar: portaDeRegistro(contexto),
    email,
  });
}

/** Um disparo manual, com as dispensas que o produto publica para esse caminho. */
async function disparar(
  contexto: Contexto,
  email: CapturadorDeEmail,
  candidata: CandidataAoAviso,
): Promise<EnvioDeCobranca> {
  return await enviarAvisoDeCobranca({
    candidata,
    dispensas: DISPENSAS_DO_DISPARO_MANUAL,
    registrar: portaDeRegistro(contexto),
    email,
  });
}

/**
 * A recusa levantada pelo disparo manual, com o tipo já estreitado — ou uma falha nomeada.
 *
 * Existe para que a asserção sobre o campo `estado` não precise de `as` nem de `!`: `catch` entrega
 * `unknown`. O disparo que **não** levantasse é reprovado aqui, e não passaria por omissão.
 */
async function recusaDoDisparo(
  contexto: Contexto,
  email: CapturadorDeEmail,
  candidata: CandidataAoAviso,
): Promise<ErroDeEstadoNaoAvisavel> {
  try {
    await disparar(contexto, email, candidata);
  } catch (erro) {
    if (erro instanceof ErroDeEstadoNaoAvisavel) {
      return erro;
    }

    throw erro;
  }

  throw new Error(`o disparo manual admitiu a cobrança ${candidata.codigo}`);
}

/**
 * Projeta a candidata de uma cobrança como a **borda do disparo manual** a projetará (T10).
 *
 * O estado e o valor saem da **visão** — a fonte única (ADR-0022) —, e os textos saem do cenário. Ela
 * não passa pelo predicado de propósito: é justamente a ausência dele que torna a dispensa da trava e
 * do recorte de dias um fato estrutural do caminho manual, e não uma escolha que alguém possa
 * esquecer.
 */
async function candidataDe(
  contexto: Contexto,
  cenario: Cenario,
  cobranca: LinhaDeCobranca,
): Promise<CandidataAoAviso> {
  const publicado = await lerDerivadaCrua(contexto, cobranca.codigo);

  return {
    codigo: cobranca.codigo,
    dataVencimento: cobranca.dataVencimento,
    status: publicado.status,
    valorTotal: publicado.valorTotal,
    destinatario: cenario.destinatario,
    nomeDoLocatario: cenario.nomeDoLocatario,
    imovel: cenario.imovel,
    conjunto: cenario.conjunto,
  };
}

/**
 * Os códigos que o **predicado real** seleciona sob o contexto, na ordem em que ele os devolve.
 *
 * A política é lida pela porta (`lerPoliticaDeAviso`), como o job a lê — montá-la em memória faria o
 * caso medir uma política que a operação não produz. E a seleção é a mesma
 * `selecionarCandidatasAoAviso` que `portaDeCandidatas` injeta na régua: o que muda é só o ponto de
 * observação, porque o CT-730 mede o **conjunto**, e não o efeito do envio.
 */
async function codigosCandidatos(contexto: Contexto): Promise<string[]> {
  const politica = await emUnidade(contexto, lerPoliticaDeAviso);
  const candidatas = await emUnidade(
    contexto,
    async (tx) => await selecionarCandidatasAoAviso(tx, politica),
  );

  return candidatas.map((candidata) => candidata.codigo);
}

/**
 * O instante de confirmação do locatário, pela **porta pública** de leitura do cadastro.
 *
 * Ela lê por `localizarPessoa`, e não crua, porque o que interessa é o que a porta publica — que é o
 * mesmo valor que as seis rotas de locatário devolvem. O ramo impossível levanta em vez de virar
 * `null`, que é justamente um dos valores esperados.
 */
async function confirmacaoDe(contexto: Contexto, locatarioId: string): Promise<Date | null> {
  return await emUnidade(contexto, async (tx) => {
    const locatario = await localizarPessoa(tx, 'locatario', locatarioId);

    if (locatario === undefined) {
      throw new Error(`o arranjo não alcançou o locatário ${locatarioId}`);
    }

    return locatario.emailConfirmadoEm;
  });
}

/** Grava a política pela porta de produção — o mesmo caminho que a rota da T9 usa por dentro. */
async function gravar(contexto: Contexto, politica: PoliticaDeAvisoNova): Promise<void> {
  await emUnidade(contexto, async (tx) => await gravarPoliticaDeAviso(tx, politica));
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Cria os cadastros e um contrato **ATIVO** na empresa informada, pelas portas públicas.
 *
 * O contrato é ativado pelo protocolo das **duas unidades sequenciais** que a borda usa: a primeira
 * garante o contador e commita, a segunda emite o número e grava. Mesmo desenho de `semearCenario` em
 * `envio-de-cobranca.spec.ts`.
 *
 * Cada cenário tem locatário próprio, com endereço de contato próprio: é o que faz a asserção sobre
 * destinatários discriminar quem recebeu o quê. `locatarioSemContato` troca a porta que cria o
 * locatário por {@link semearLocatarioSemContato} — também porta de produção, com o endereço vazio
 * que a RD-11 admite.
 */
async function semearCenario(
  marcaBase: string,
  contexto: Contexto,
  opcoes: { readonly locatarioSemContato?: boolean } = {},
): Promise<Cenario> {
  sequenciaDoCenario += 1;
  const marca = `${marcaBase}-${String(sequenciaDoCenario)}`;
  const nomeDoLocatario = `Locatário ${marca}`;
  const imovel = `IPTU-${marca}`;
  const conjunto = `Conjunto ${marca}`;
  const contato = `locatario-${marca}@exemplo.invalid`;

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

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`, contato));
    const dadosDoLocatario = pessoaDe(nomeDoLocatario, contato);
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

  return {
    contexto,
    contratoId: contrato.id,
    locatarioId: cadastros.locatarioId,
    nomeDoLocatario,
    destinatario: opcoes.locatarioSemContato === true ? '' : contato,
    imovel,
    conjunto,
  };
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 40_000_000_000;

function pessoaDe(nome: string, email: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email,
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
async function admitirEmpresaNova(marcaBase: string): Promise<Contexto> {
  sequenciaDoCenario += 1;

  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marcaBase}-${String(sequenciaDoCenario)}`,
        documento: `${String(Date.now()).slice(-8)}${String(sequenciaDoCenario).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marcaBase}`);
  }

  return { empresaId: criada.id };
}

/**
 * Lança uma cobrança pelo protocolo das **duas unidades sequenciais** da série (ADR-0015).
 *
 * O vencimento é derivado de `negocio.data_corrente_da_operacao()` por deslocamento — **nunca** de um
 * `new Date()` do processo.
 */
async function lancar(cenario: Cenario, diasAteVencimento: number): Promise<LinhaDeCobranca> {
  const ano = await emUnidade(cenario.contexto, lerAnoDaSerieDeCobranca);
  const dataVencimento = await dataDeslocada(cenario.contexto, diasAteVencimento);

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
 * predicado compara.
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
 * instante — que é exatamente o instante pelo qual a trava conta. Mesmo desenho de
 * `envio-de-cobranca.spec.ts`.
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
             'semeado@exemplo.invalid',
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
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008). O `-1` do ramo
 * impossível existe para que uma contagem que não voltasse reprovasse em vez de virar zero, que é
 * justamente um dos valores esperados.
 */
async function contarLinhasDeEnvio(contexto: Contexto): Promise<number> {
  return await contar(contexto, 'envio_de_cobranca');
}

/** Quantas linhas de `negocio.politica_de_aviso` o contexto corrente alcança — o zero do CT-617. */
async function contarLinhasDePolitica(contexto: Contexto): Promise<number> {
  return await contar(contexto, 'politica_de_aviso');
}

/**
 * A contagem crua de uma das duas tabelas da régua.
 *
 * O nome da tabela é escolhido por um `switch` sobre uma união fechada, e não interpolado numa
 * cadeia: identificador não é parâmetro no driver, e um acessório que montasse SQL por concatenação
 * abriria, dentro da suíte, exatamente o caminho que o produto não tem.
 */
async function contar(
  contexto: Contexto,
  tabela: 'envio_de_cobranca' | 'politica_de_aviso',
): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const linhas =
      tabela === 'envio_de_cobranca'
        ? await tx<{ total: string }[]>`SELECT count(*) AS total FROM negocio.envio_de_cobranca`
        : await tx<{ total: string }[]>`SELECT count(*) AS total FROM negocio.politica_de_aviso`;

    return Number(linhas[0]?.total ?? -1);
  });
}

/** O histórico de uma cobrança, pela porta de produção, do mais recente para o mais antigo. */
async function lerHistorico(
  contexto: Contexto,
  codigo: string,
): Promise<readonly EnvioDeCobranca[]> {
  return await emUnidade(
    contexto,
    async (tx) => await lerEnviosDaCobranca(tx, codigo, JANELA_INTEIRA),
  );
}

/** O endereço gravado na única tentativa de uma cobrança — ou uma falha nomeada. */
async function destinatarioRegistrado(contexto: Contexto, codigo: string): Promise<string> {
  const [linha] = await lerHistorico(contexto, codigo);

  if (linha === undefined) {
    throw new Error(`a cobrança ${codigo} não tem tentativa registrada`);
  }

  return linha.destinatario;
}

/**
 * Os cinco valores que a visão publica para um código — lidos **por fora do SUT**.
 *
 * Eles são o oráculo do CT-618: o que a régua não pode mover. Lê-los por `localizarCobranca` não
 * serviria — aquela porta converte `numeric` em `number`, e o que se compara aqui é o texto que o
 * banco projeta, casa a casa.
 */
async function lerDerivadaCrua(contexto: Contexto, codigo: string): Promise<EstadoPublicado> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<EstadoPublicado[]>`
      SELECT status,
             dias_atraso AS "diasAtraso",
             valor_multa AS "valorMulta",
             valor_juros AS "valorJuros",
             valor_total AS "valorTotal"
        FROM negocio.cobranca_derivada
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a visão derivada não devolveu a cobrança ${codigo}`);
    }

    return {
      status: linha.status,
      diasAtraso: linha.diasAtraso,
      valorMulta: linha.valorMulta,
      valorJuros: linha.valorJuros,
      valorTotal: linha.valorTotal,
    };
  });
}

/**
 * Os códigos das cobranças **capturadas**, na ordem em que a régua mandou entregar.
 *
 * O código é lido do **assunto da mensagem que saiu**, e não de uma lista mantida pelo teste: é o que
 * liga a captura à cobrança pelo conteúdo entregue, e é o que faria uma régua que compõe o aviso de
 * uma cobrança e o manda para o endereço de outra reprovar.
 */
function codigosCapturados(capturador: CapturadorDeEmail): string[] {
  return capturador.capturas.map((captura) => {
    const achado = CODIGO_NO_ASSUNTO.exec(captura.mensagem.assunto);

    if (achado === null) {
      throw new Error(
        `o assunto capturado não traz código de cobrança: ${captura.mensagem.assunto}`,
      );
    }

    return achado[0];
  });
}
