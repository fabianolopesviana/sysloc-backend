/**
 * O fato bancário da cobrança — a liquidação vinda do provedor, a divergência de valor e o estorno.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-10    | CT-922 | A baixa vinda da conferência grava `pago_em` e `valor_pago` **exatamente**
 * | CA-19    |        | como o provedor informou, e os **quatro** carimbos de mora são idênticos,
 * |          |        | campo a campo, aos que a baixa manual produz sobre a cobrança gêmea, sob a
 * |          |        | mesma política — mesma expressão da visão, sem exceção por caminho de
 * |          |        | entrada (RN-07). A cobrança liquidada **publica** `dataDoCredito` e
 * |          |        | `valorCreditado`, a linha publicada tem exatamente as **23** chaves do
 * |          |        | contrato — sem `identificadorNoProvedor`, que é interno e foi gravado no
 * |          |        | mesmo ato da emissão — e `esquemaDaCobranca` a aprova. A trilha da liquidada
 * |          |        | pela conferência tem **1** evento `COBRANCA_LIQUIDADA` com origem
 * |          |        | `CONFERENCIA`; a da manual tem **zero**. |
 * | CA-11    | CT-923 | Valor informado diferente do esperado **não impede** a baixa: `pago_em` fica
 * |          |        | não-nulo, `valor_pago` é o do provedor, e a trilha ganha **dois** eventos —
 * |          |        | `COBRANCA_LIQUIDADA` e `DIVERGENCIA_DE_VALOR` —, o segundo com
 * |          |        | `valor_informado` igual ao do provedor e origem `CONFERENCIA`. |
 * | CA-12    | CT-924 | O estorno apaga, numa instrução só, os **oito** campos que a liquidação
 * |          |        | escreveu (`pago_em`, `valor_pago`, os quatro carimbos, `data_credito` e
 * |          |        | `valor_creditado`), e o estado publicado volta a **derivar** da visão:
 * |          |        | `VENCIDA` para a de vencimento passado e `A_VENCER` para a outra, no mesmo
 * |          |        | caso. Os **três campos de emissão permanecem** não-nulos — estorno não é
 * |          |        | revogação — e `cancelado_em` continua nulo nas duas. Cada uma tem
 * |          |        | exatamente **1** evento `LIQUIDACAO_ESTORNADA` com origem `CONFERENCIA`. |
 * | CA-17    | CT-924 | `revogarBoleto` zera os três campos de emissão e o arquivo, devolve o
 * | CA-18    | (b)    | caminho a apagar, e **não escreve `cancelado_em`**: sobre uma cobrança
 * |          |        | cancelada com boleto vivo, o instante do cancelamento sobrevive **idêntico**
 * |          |        | (RN-09, RN-10). A ausência é afirmada também por **leitura da instrução**,
 * |          |        | com o controle que prova que a extração enxerga a coluna quando ela está lá. |
 * | CA-10    | CT-922 | A repetição da liquidação **informa** `NAO_ESTAVA_EM_ABERTO` e o fato da
 * |          | (b)    | primeira baixa sobrevive: os **nove** campos continuam os dela — em especial
 * |          |        | `pago_em`, `valor_pago`, `data_credito` e `valor_creditado`, que a repetição
 * |          |        | reescreveria pelos seus próprios; os quatro carimbos de mora sobrevivem
 * |          |        | sozinhos, por serem ponto fixo do `COALESCE` da visão (medido no MT-T6-D,
 * |          |        | abaixo) —, e a trilha tem **1** evento, porque ela registra efeito e nunca
 * |          |        | tentativa (ADR-0034). |
 * | CA-05    | CT-922 | A segunda emissão sobre a mesma cobrança **não** escreve por cima de um
 * |          | (c)    | boleto vivo: os **cinco** campos gravados continuam os da primeira emissão, e
 * |          |        | a recusa é `ErroDeCobrancaNaoAlcancada` com `ato === 'EMISSAO'`. Revogado o
 * |          |        | boleto, a mesma emissão **passa** — a guarda é sobre o estado, não sobre o
 * |          |        | histórico (é o percurso da reemissão da T11). |
 * | CA-10    | CT-922 | A liquidação de uma cobrança **cancelada com boleto vivo** informa
 * |          | (d)    | `NAO_ESTAVA_EM_ABERTO` — desfecho **dentro** da união `DesfechoDaLiquidacao`
 * |          |        | —, em vez de abortar a unidade com a violação de
 * |          |        | `cobranca_desfecho_unico_chk`. Os **oito** campos de desfecho e conciliação
 * |          |        | continuam nulos, o `cancelado_em` sobrevive instante a instante, e a
 * |          |        | cobrança **em aberto** do mesmo cenário é liquidada normalmente. *Em aberto*
 * |          |        | são as **duas** condições que `selecionarCobrancasAConferir` já escreve. |
 * | CA-12    | CT-924 | O estorno de cobrança **em aberto** informa `NAO_ESTAVA_PAGA` e **não
 * |          | (c)    | reescreve a tupla**: o `xmin` é idêntico ao de antes da chamada — a distinção
 * |          |        | entre *não alterou* e *reescreveu com o mesmo valor*, que nenhuma comparação
 * |          |        | de valores alcança. Liquidada, a mesma cobrança **é** estornada. |
 * | CA-10    | CT-924 | A escrita que a política **não alcança** (a cobrança da empresa vizinha)
 * | CA-12    | (d)    | levanta `ErroDeCobrancaNaoAlcancada` com `codigo` e `ato`, nos **três** atos
 * | CA-17    |        | `LIQUIDACAO`, `ESTORNO` e `REVOGACAO` — mensagens distintas, o que prova que
 * |          |        | o mapa escolhe pela chave. O fato da dona fica **intacto**, e a mesma
 * |          |        | revogação, sob o contexto dela, alcança. |
 *
 * Rastreabilidade: `CA-10 → CT-922 (RN-07)` · `CA-19 → CT-922 (RN-07)` · `CA-11 → CT-923 (RN-07)` ·
 * `CA-12 → CT-924 (RN-08)` · `CA-17, CA-18 → CT-924 (b) (RN-09, RN-10)` ·
 * `CA-10 → CT-922 (b) (RN-07)` · `CA-05 → CT-922 (c) (RN-07)` · `CA-10 → CT-922 (d) (RN-07)` ·
 * `CA-12 → CT-924 (c) (RN-08)` · `CA-10, CA-12, CA-17 → CT-924 (d) (RN-07, RN-08)`.
 *
 * ===========================================================================
 * OS QUATRO CASOS DE SUFIXO SÃO ACRÉSCIMO DA RODADA 2, POR ACHADO DO GATE 1
 * ===========================================================================
 *
 * O `CT-922 (b)`, o `CT-922 (c)`, o `CT-924 (c)` e o `CT-924 (d)` nasceram dos achados **ALTO-001** e
 * **ALTO-002** da rodada 1 do QA, e o diagnóstico deles é o mesmo: os quatro casos originais só
 * exercitam a transição **feliz** de cada porta, e por isso o predicado de estado que cada `UPDATE`
 * carrega nunca era avaliado com o estado que ele existe para recusar. No caminho de sucesso a cláusula
 * é indistinguível da sua ausência — `WHERE codigo = X AND <predicado verdadeiro>` alcança a mesma
 * linha que `WHERE codigo = X` —, de modo que apagar qualquer uma das três deixava a suíte verde.
 *
 * O que a rede acrescenta **não é o desfecho**, que é a metade fácil: é o **estado que a guarda
 * preserva**, afirmado **antes** dele. Essa ordem foi medida na T5 desta mesma fatia (o `MT-T5-F` do
 * `CT-929 (c)`): o Vitest aborta o caso na primeira asserção que reprova, e com o desfecho primeiro o
 * mutante acusaria a ausência da recusa em vez do dano — o fato original apagado pela tentativa que não
 * deveria ter corrido.
 *
 * Cada um traz o **companheiro positivo** no mesmo caso (a baixa que corre, a reemissão depois da
 * revogação, o estorno da cobrança de fato paga, a revogação sob o contexto da dona), porque uma porta
 * que passasse a recusar **sempre** satisfaria todas as asserções negativas isoladas.
 *
 * ===========================================================================
 * O ORÁCULO DA MORA É A BAIXA MANUAL — nunca uma conta refeita aqui
 * ===========================================================================
 *
 * O `CT-922` compara os quatro carimbos da cobrança liquidada **pela conferência** com os da gêmea
 * liquidada por `acusarPagamentoDeCobranca`, que é a baixa manual já em produção desde a F3. Re-derivar
 * a mora neste arquivo seria reimplementar o SUT: um produto com a conta errada passaria contra a
 * própria conta errada, que é o antipadrão `tautological_assertion` (AP-29).
 *
 * Os quatro literais do golden (`40.00`, `34.67`, `2.00`, `1.00` sobre `2000.00` vencidos há 52 dias,
 * com política de `2%`/`1%`) entram como **controle antivácuo**, e não como oráculo: sem eles, duas
 * cobranças com os quatro carimbos nulos — o que aconteceria se a liquidação não carimbasse nada —
 * satisfariam a igualdade entre si. Eles são os mesmos do `calcular-mora.json`, caso
 * `exemplo_canonico_2074_67`, já afirmados pelo `CT-516` e pelo `CT-527`.
 *
 * ===========================================================================
 * O ARRANJO É O PERCURSO REAL, e o UUID da cobrança vem de onde a produção o obtém
 * ===========================================================================
 *
 * `registrarEventoBancario` guarda a chave estrangeira **composta** `(cobranca_id, empresa_id)` e por
 * isso exige o UUID interno — que `LinhaDeCobranca` deliberadamente **não** publica. Este arquivo o
 * obtém pelo mesmo caminho do processo de trabalho: emite o boleto por `gravarBoletoDaCobranca` e
 * então lê o conjunto por `selecionarCobrancasAConferir`, que entrega `{ id, codigo,
 * numeroDoTituloNoProvedor }` (T5). Nenhum símbolo de produção nasceu para o teste enxergar algo, e
 * nenhuma consulta de tradução avulsa foi escrita — a Lei do seam (Iron Law #6) é respeitada pelo
 * caminho legítimo, não contornada.
 *
 * O cadastro de apoio é montado **pelas portas públicas** (conjunto, imóvel, pessoas, contrato,
 * cobrança), no molde de `semearContrato` em `cobranca.spec.ts`, e **não** pelas instruções cruas de
 * `evento-bancario.spec.ts` e irmãos. A escolha é medida e tem duas razões: o que estes casos provam é
 * o carimbo apurado pela visão, que depende de um contrato **ativo** e de uma política vigente — o que
 * as portas montam sem que este arquivo redigite regra alguma —; e o `INSERT` cru daquela cadeia já
 * tem **quatro** cópias em `packages/db/test/` (`isolamento-bancario`, `emissao-em-lote`,
 * `evento-bancario`, `conferencia-bancaria`), de modo que uma quinta agravaria uma dívida que esta
 * task não criou. A conta se refaz em uma linha:
 *
 * ```bash
 * grep -rln "INSERT INTO negocio.conjunto" packages/db/test/
 * ```
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO IMITA DO PERCURSO DA T12, e por que isso não é encenação
 * ===========================================================================
 *
 * A conferência (T12) ainda não existe. O que estes casos fazem é **compor as portas de produção na
 * ordem em que ela as chamará** — liquidar e registrar o efeito; estornar e registrar o efeito —, e
 * cada peça é a de produção, sem dublê. O que se prova, portanto, é o que as portas fazem, e a ordem
 * da composição é a que a §3.1 da T12 declara por escrito.
 *
 * O evento **não** é gravado por dentro das portas, e isso é conteúdo: a liquidação e o estorno
 * devolvem *o que fizeram* (`LIQUIDADA`/`NAO_ESTAVA_EM_ABERTO`, `ESTORNADA`/`NAO_ESTAVA_PAGA`), e é o
 * chamador que decide registrar — porque a ADR-0034 manda **não** registrar quando nada mudou.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-17)
 * ===========================================================================
 *
 * O `CT-924 (b)` tem uma perna **estática** (inspeciona o texto do `SET` de `revogarBoleto`), e a
 * `.claude/rules/testing-stack.md` a obriga à prova. Ela foi feita no artefato real, com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso:
 *
 *   * **controle** — árvore íntegra: `@sysloc/db` `210 passed`, 30 arquivos;
 *   * **MT-T6-A · `cancelado_em = NULL` acrescentado ao `SET` de `revogarBoleto`** — exatamente o
 *     defeito que a RN-09 proíbe, na forma mais plausível: a atribuição explícita que "parece
 *     equivalente" à ausência. `1 failed | 209 passed`, e o `CT-924 (b)` reprova em
 *     `expected null to be '2026-08-17T09:27:14.278Z'` — o instante do cancelamento apagado pela
 *     revogação de um boleto.
 *     ⚠️ **Ele reprova na perna COMPORTAMENTAL, e não nas duas**: a igualdade do `canceladoEm` aborta
 *     o caso antes de a leitura da instrução correr. O registro disso é deliberado — declarar que "as
 *     duas pernas reprovaram" seria afirmar o que a medição não mostrou. Quem falsifica a perna
 *     estática isoladamente é o **controle interno** dela: a mesma função de extração aplicada a
 *     {@link REVOGACAO_COM_O_CANCELAMENTO}, que devolve a coluna proibida e é afirmada por igualdade
 *     no mesmo caso. Mesma observação, e mesma razão, do `CT-939` em `evento-bancario.spec.ts`;
 *   * **MT-T6-B · a SEGUNDA regra de mora** — um `UPDATE` acrescentado a `liquidarPeloProvedor`,
 *     **depois** da chamada da porta da F3, recarimbando multa e juros por conta própria
 *     (`round(valor_original * 0.01, 2)` para os juros). É o defeito que a RN-07 existe para fechar, e
 *     ele é plausível: a conta "concorda" com a política em multa e diverge só nos juros.
 *     `2 failed | 208 passed`, e o `CT-922` reprova **exatamente na comparação com a gêmea** —
 *     `expected '20.00' to be '34.67'` —, que é a asserção-oráculo do caso; o `CT-924` reprova junto,
 *     no retrato dos oito campos. ⚠️ O mutante **óbvio** — apagar a chamada de
 *     `acusarPagamentoDeCobranca` e escrever o carimbo à mão — **não serve**: o import fica sem uso,
 *     `noUnusedLocals` derruba o `tsc --build` e a suíte não corre, o que é "reprovou sem provar
 *     nada". Medido antes de ser descartado;
 *   * **reversão** — em cada mutante o arquivo foi restaurado de cópia e conferido idêntico por
 *     `diff -q`, e o controle voltou a `210 passed`.
 *
 * ===========================================================================
 * MUTANTES DA RODADA 2 (2026-08-17) — um por guarda de estado, mais a classe
 * ===========================================================================
 *
 * Os quatro casos novos são a rede dos achados **ALTO-001** e **ALTO-002**, e o **P4** do
 * `.claude/rules/nao-regressao.md` exige que cada um reprove com o defeito de volta. Todos foram
 * medidos no artefato real, com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — `packages/db` resolve `"."` para
 * `dist/`, e ali o defeito reintroduzido no fonte não chegaria a executar.
 *
 *   * **controle** — árvore íntegra: `214 passed`, 30 arquivos (a baseline da rodada 1 era `210`);
 *   * **MT-T6-C · `AND numero_do_titulo_no_provedor IS NULL` apagado de `gravarBoletoDaCobranca`** — a guarda que
 *     impede a emissão de escrever por cima de um boleto vivo. `1 failed | 213 passed`, e o
 *     `CT-922 (c)` reprova **no retrato dos campos gravados**, nomeando o dano em vez da ausência da
 *     recusa: os quatro campos do boleto `7` substituídos pelos do `8`;
 *   * **MT-T6-D · `AND pago_em IS NULL` apagado de `liquidarPeloProvedor`** — a guarda *"cobrança já
 *     paga não é repaga"*. `1 failed | 213 passed`, e o `CT-922 (b)` reprova no retrato dos nove
 *     campos, com `pago_em`, `valor_pago`, `data_credito` e `valor_creditado` reescritos pelos da
 *     repetição.
 *     ⚠️ **Medição contra a hipótese**: o docblock da porta prevê que a repetição *"recarimbaria uma
 *     cobrança já paga com a mora que a visão publica depois do pagamento, isto é, zero"*, e **não foi
 *     o que se observou** — os quatro carimbos chegaram **preservados** (`40.00`, `34.67`, `2.00`,
 *     `1.00`), e quem matou o mutante foram os **quatro campos de fato e crédito**. É por isso que a
 *     repetição informa data **e** valor distintos ({@link DATA_DA_REPETICAO}, {@link VALOR_DA_REPETICAO}):
 *     repetir os mesmos valores deixaria este mutante **vivo**;
 *   * **MT-T6-E · `AND pago_em IS NOT NULL` apagado de `estornarLiquidacao`** — a guarda que impede a
 *     reescrita da tupla. `1 failed | 213 passed`, e o `CT-924 (c)` reprova **na versão da tupla**
 *     (`expected '907' to be '906'`), que é o único observável do dano: o `UPDATE` grava `NULL` sobre
 *     `NULL` nos oito campos, e nenhuma comparação de **valores** o enxergaria;
 *   * **MT-T6-F · os três `throw new ErroDeCobrancaNaoAlcancada(...)` trocados por `throw new Error(…)`**,
 *     preservando a mensagem (`RECUSA_POR_ATO[ato]`) — que é a forma exata que o achado descreve, e a
 *     mais plausível: o texto continua certo e só o **tipo** se perde. `2 failed | 212 passed`, com o
 *     `CT-922 (c)` e o `CT-924 (d)` reprovando em `classe: 'OUTRA RECUSA'` e `ato: null`, **enquanto o
 *     campo `dito` permanece idêntico** — a demonstração literal de que o que estes casos provam é o
 *     tipo reconhecível em runtime, e não a mensagem;
 *   * **reversão** — em cada mutante o arquivo de produção foi restaurado de cópia e conferido idêntico
 *     por `diff -q`, e o controle voltou a `214 passed`.
 *
 * ===========================================================================
 * O `CT-922 (d)` É A REDE DO ACHADO P1 DO GATE 2 — e ela NÃO ganha mutante
 * ===========================================================================
 *
 * O achado: o predicado do crédito de `liquidarPeloProvedor` era só `AND pago_em IS NULL`, enquanto o
 * desfecho benigno que ele produz se chama `NAO_ESTAVA_EM_ABERTO` — e *em aberto*, nesta fatia, tem
 * **duas** condições, escritas em `selecionarCobrancasAConferir`
 * (`pago_em IS NULL AND cancelado_em IS NULL`). A cobrança **cancelada** tem `pago_em` nulo: passava o
 * predicado, o crédito gravava, e `acusarPagamentoDeCobranca` — que não condiciona por estado —
 * escrevia `pago_em` sobre uma linha com `cancelado_em` preenchido, violando
 * `cobranca_desfecho_unico_chk` (`migracoes/0009_dominio_cobranca.sql`). O chamador recebia `23514`
 * cru, fora da união `DesfechoDaLiquidacao`.
 *
 * ⚠️ **Nenhum mutante foi executado para este caso, e a ausência é a regra sendo cumprida.** A
 * asserção é **comportamental** — ela exercita a porta e compara o valor devolvido —, e o **P4** de
 * `.claude/rules/nao-regressao.md` é literal: asserção comportamental **não** se demonstra por
 * execução de mutante, porque ela já reprova naturalmente com o código antigo; o que se exige é a
 * declaração de **qual asserção discrimina**. Mutation testing está fora da stack deste projeto
 * (`.claude/rules/testing-stack.md`, 2026-08-16), e os blocos `MT-*` acima são registro histórico, não
 * convenção a reproduzir.
 *
 * **A asserção que discrimina é o Passo 2** — `expect(desfecho).toBe('NAO_ESTAVA_EM_ABERTO')`. Com o
 * predicado antigo, a chamada sobre a cancelada aborta a unidade com o `check`, {@link
 * desfechoDaLiquidacao} devolve `RECUSA FORA DA UNIÃO: … cobranca_desfecho_unico_chk …`, e a igualdade
 * reprova **nomeando a taxonomia perdida**. Os Passos 1 e 3 não a substituem, e é deliberado: o Passo
 * 1 continuaria verde com o defeito de volta (a unidade desfaz inteira, e o estado de fato sobrevive),
 * e o Passo 3 mede a porta no caminho feliz. É o Passo 2, sozinho, que separa *o banco recusou a
 * escrita* de *a porta informou o desfecho que ela promete*.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esquemaDaCobranca } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BoletoEmitido,
  ErroDeCobrancaNaoAlcancada,
  estornarLiquidacao,
  gravarBoletoDaCobranca,
  type LiquidacaoInformada,
  lerBoletoDaCobranca,
  liquidarPeloProvedor,
  revogarBoleto,
} from '../src/boleto-da-cobranca.ts';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  acusarPagamentoDeCobranca,
  cancelarCobranca,
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
  localizarCobranca,
} from '../src/cobranca.ts';
import { selecionarCobrancasAConferir } from '../src/conferencia-bancaria.ts';
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
import { lerTrilhaDaCobranca, registrarEventoBancario } from '../src/evento-bancario.ts';
import { criarImovel } from '../src/imovel.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso monta uma empresa, um contrato ativo e até três cobranças; o teto é folgado. */
const LIMITE_DO_CASO_MS = 90_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física. */
const RESERVA_DE_UMA = 1;

/** O contexto da carga inicial — usado só para admitir as empresas dos cenários. */
const CONTEXTO_DA_SEMENTE = { empresaId: EMPRESA_A.id } as const;

// ---------------------------------------------------------------------------
// O cenário canônico da mora — os números do golden `calcular-mora.json`
// ---------------------------------------------------------------------------

/** `2000.00` vencidos há 52 dias sob `2%`/`1%` — o `exemplo_canonico_2074_67`. */
const VALOR_ORIGINAL = 2000;
const DIAS_DE_ATRASO = 52;
const MULTA_PERCENTUAL = 2;
const JUROS_PERCENTUAL = 1;

/**
 * Os quatro carimbos que a política acima produz — **controle antivácuo**, nunca oráculo.
 *
 * O oráculo é a baixa manual, e a comparação entre as duas cobranças é quem prova a RN-07. Estes
 * literais existem para que duas cobranças com carimbo **nulo** não satisfaçam aquela igualdade por
 * vacuidade — e são os mesmos que o `CT-516` e o `CT-527` já afirmam.
 */
const MULTA_CARIMBADA = '40.00';
const JUROS_CARIMBADOS = '34.67';
const MULTA_PERCENTUAL_CARIMBADO = '2.00';
const JUROS_PERCENTUAL_CARIMBADO = '1.00';

/** O total que a visão publica sobre o cenário canônico — `2000.00 + 40.00 + 34.67`, do mesmo golden. */
const TOTAL_COM_MORA = 2074.67;

/** A mora da cobrança que ainda **não** venceu: zero nos dois valores, apurada pela mesma visão. */
const SEM_MULTA = '0.00';
const SEM_JUROS = '0.00';

// ---------------------------------------------------------------------------
// O que o provedor informa — os valores do card, escritos por extenso
// ---------------------------------------------------------------------------

/** A data e o valor que o provedor devolveu no `CT-922` (§6.6, dados de entrada). */
const DATA_DO_CREDITO = '2026-08-16';
const VALOR_INFORMADO = '1234.56';

/** O valor divergente do `CT-923`: o provedor credita menos do que a cobrança pedia. */
const VALOR_DIVERGENTE = '1000.00';

/**
 * O que o provedor informa na **repetição** do `CT-922 (b)` — distinto em data **e** em valor.
 *
 * A distinção é o mecanismo do caso, e não decoração: repetir a mesma data e o mesmo valor faria o
 * retrato da segunda baixa coincidir com o da primeira em quatro dos nove campos, e a guarda
 * `pago_em IS NULL` poderia sumir sem que a igualdade acusasse tudo o que ela impede. Com valores
 * distintos, **cada** campo que a repetição escreveria diverge do fato original.
 */
const DATA_DA_REPETICAO = '2026-08-17';
const VALOR_DA_REPETICAO = '999.99';

// ---------------------------------------------------------------------------
// A recusa nomeada — o que o `CT-922 (c)` e o `CT-924 (d)` afirmam por igualdade
// ---------------------------------------------------------------------------

/**
 * O nome da **classe** de recusa que as quatro portas de escrita levantam, e o rótulo de tudo o mais.
 *
 * Ele é nomeado aqui porque a asserção é sobre a classe **reconhecida por `instanceof`**, e não sobre
 * a propriedade `name` — que qualquer `Error` pode carregar. O rótulo genérico existe para que a
 * reprovação **nomeie o que veio no lugar** em vez de dizer só que os objetos diferem. Mesma forma, e
 * mesma razão, de `CLASSE_NAO_ALCANCADO` em `emissao-em-lote.spec.ts` e de `CLASSE_NAO_ALCANCADA` em
 * `conferencia-bancaria.spec.ts` — as duas portas irmãs desta fatia.
 */
const CLASSE_NAO_ALCANCADA = 'ErroDeCobrancaNaoAlcancada';
const OUTRA_RECUSA = 'OUTRA RECUSA';

/** O rótulo do desfecho que **não** houve recusa — o ramo que reprova a escrita passando em silêncio. */
const SEM_RECUSA = 'ACEITO';

/**
 * O rótulo do que a liquidação devolveu quando **não** foi um dos dois valores de
 * `DesfechoDaLiquidacao`.
 *
 * Ele existe para que o `CT-922 (d)` reprove **nomeando a taxonomia perdida** — a reprovação exibe
 * `RECUSA FORA DA UNIÃO: … cobranca_desfecho_unico_chk …` contra `NAO_ESTAVA_EM_ABERTO`, que é
 * exatamente o defeito — em vez de o caso simplesmente estourar com um erro de driver não capturado,
 * que não é asserção nenhuma.
 */
const RECUSA_FORA_DA_UNIAO = 'RECUSA FORA DA UNIÃO';

/**
 * As **quatro** mensagens de `RECUSA_POR_ATO`, escritas por extenso e uma vez cada.
 *
 * Elas são literais nomeados aqui, e não texto solto no meio dos casos: a asserção é sobre a mensagem
 * exata, e um literal repetido nos pontos de uso ficaria livre para divergir do que a porta escreve.
 *
 * As quatro entram em igualdades **do mesmo formato**, em atos diferentes, e é essa combinação que
 * prova o que uma mensagem sozinha não provaria: que o mapa escolhe pela chave, em vez de devolver
 * sempre o mesmo texto. `EMISSAO` é medida pelo `CT-922 (c)`; as outras três, pelo `CT-924 (d)`.
 */
const RECUSA_DA_EMISSAO = 'a emissão não alcançou uma cobrança sem boleto';
const RECUSA_DA_LIQUIDACAO = 'a liquidação não alcançou a cobrança';
const RECUSA_DO_ESTORNO = 'o estorno não alcançou a cobrança';
const RECUSA_DA_REVOGACAO = 'a revogação não alcançou a cobrança';

/**
 * Os campos do boleto emitido, distintos e reconhecíveis campo a campo.
 *
 * Valores repetidos deixariam duas colunas trocadas passarem, que é o mesmo critério do `CT-532`. O
 * identificador tem as **18 posições** que `comporIdentificadorBancario` produz (`AAAAMM` mais o
 * contador de doze), e é ele que o `CT-922` procura na tabela e **não** na leitura publicada.
 */
function boletoDe(marca: string): BoletoEmitido {
  return {
    numeroDoTituloNoProvedor: `0000000000012345${marca}`,
    linhaDigitavel: `75690.00001 00000.0000${marca}0 00000.000000 1 00000000200000`,
    codigoDeBarras: `7569100000000020000000001000000000000000000${marca}`,
    identificadorNoProvedor: `20260800000000000${marca}`,
    caminhoDoArquivo: `boletos/2026/COB-BOLETO-${marca}.pdf`,
  };
}

/**
 * As **23** chaves que `esquemaDaCobranca` publica, em ordem alfabética.
 *
 * Escritas por extenso, e **não** derivadas de `Object.keys(esquemaDaCobranca.shape)`: derivá-las do
 * artefato que elas conferem faria a asserção concordar consigo mesma — um campo interno que vazasse
 * para os dois lados de uma vez passaria verde. É o mesmo critério que `COLUNAS_DA_COBRANCA` aplica em
 * `cobranca.spec.ts`.
 *
 * ⚠️ `identificadorNoProvedor` **não está aqui**, e a ausência é o que o `CT-922` mede: a coluna é
 * interna (ADR-0033), é gravada na emissão e não pode chegar ao recurso publicado — que é composto por
 * espalhamento da linha na borda.
 */
const CHAVES_PUBLICADAS: readonly string[] = Object.freeze([
  'canceladoEm',
  'codigo',
  'codigoDeBarras',
  'competencia',
  'contratoCodigo',
  'dataDoCredito',
  'dataVencimento',
  'diasAtraso',
  'jurosPercentualAplicado',
  'linhaDigitavel',
  'locatarioId',
  'multaPercentualAplicado',
  'natureza',
  'numeroDoTituloNoProvedor',
  'pagoEm',
  'referencia',
  'status',
  'valorCreditado',
  'valorJuros',
  'valorMulta',
  'valorOriginal',
  'valorPago',
  'valorTotal',
]);

// ---------------------------------------------------------------------------
// A asserção estática do `CT-924 (b)` — o `SET` de `revogarBoleto`
// ---------------------------------------------------------------------------

/** O fonte da porta, lido como TEXTO pelo `CT-924 (b)`. */
const FONTE_DA_PORTA = fileURLToPath(new URL('../src/boleto-da-cobranca.ts', import.meta.url));

/** Onde a instrução da revogação começa. Literal, para que renomear a função reprove em vez de passar. */
const ASSINATURA_DA_REVOGACAO = 'export async function revogarBoleto(';

/** As quatro colunas que a revogação escreve — e a ausência de `cancelado_em` entre elas é a RN-09. */
const COLUNAS_ZERADAS_PELA_REVOGACAO: readonly string[] = Object.freeze([
  'numero_do_titulo_no_provedor',
  'linha_digitavel',
  'codigo_barras',
  'boleto_arquivo',
]);

/** A coluna que a revogação **não** pode nomear — o alvo da varredura. */
const COLUNA_DO_CANCELAMENTO = 'cancelado_em';

/**
 * O CONTROLE do `CT-924 (b)`: a mesma instrução **com** o defeito, escrita à mão.
 *
 * Ele é o que separa *"a extração enxerga as colunas do `SET`"* de *"a extração sempre devolve a lista
 * certa"* — sem ele, um extrator que ignorasse `cancelado_em` (ou que devolvesse a própria constante)
 * aprovaria um SUT com o defeito de volta, que é o AP-29 (`tautological_assertion`).
 */
const REVOGACAO_COM_O_CANCELAMENTO = `${ASSINATURA_DA_REVOGACAO}
  const [linha] = await tx\`
    UPDATE negocio.cobranca AS alvo
       SET numero_do_titulo_no_provedor = NULL,
           linha_digitavel = NULL,
           codigo_barras = NULL,
           boleto_arquivo = NULL,
           cancelado_em = NULL
      FROM negocio.cobranca AS antes
     WHERE antes.id = alvo.id
  \`;
`;

/**
 * As colunas nomeadas no `SET` da instrução que começa em `marcador`, na ordem em que aparecem.
 *
 * Ela recebe o TEXTO em vez de ler o arquivo por conta própria, e é isso que torna o controle
 * possível: a mesma função é aplicada ao fonte real e a uma instrução sintética com a coluna proibida,
 * e as duas saídas são afirmadas por igualdade.
 *
 * A ausência do marcador ou do recorte **levanta**, em vez de devolver lista vazia: um recorte que não
 * achasse a instrução devolveria `[]`, e `[]` comparado com a lista esperada reprovaria por acidente —
 * apontando para o lugar errado —, enquanto uma asserção de contenção passaria por vacuidade.
 */
function colunasDoSet(fonte: string, marcador: string): readonly string[] {
  const inicio = fonte.indexOf(marcador);

  if (inicio === -1) {
    throw new Error(`instrução não encontrada no fonte: ${marcador}`);
  }

  const depois = fonte.slice(inicio);
  const abertura = depois.indexOf('SET ');
  const fechamento = depois.indexOf('FROM ', abertura);

  if (abertura === -1 || fechamento === -1) {
    throw new Error('o `SET` da instrução de revogação não foi delimitado no fonte');
  }

  return [...depois.slice(abertura, fechamento).matchAll(/([a-z_]+)\s*=/g)]
    .map((achado) => achado[1])
    .filter((coluna): coluna is string => coluna !== undefined);
}

// ---------------------------------------------------------------------------
// Fronteira real — instância efêmera própria (ADR-0006)
// ---------------------------------------------------------------------------

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

describe('CT-922 — a liquidação pelo provedor carimba a mesma mora que a baixa manual', () => {
  it(
    'os quatro carimbos idênticos à gêmea, o crédito publicado, e o identificador só na tabela',
    async () => {
      const cenario = await cenarioComPolitica('mora-igual');

      // --- Passo 1: duas cobranças IDÊNTICAS, sob a mesma política ------------------------------
      //
      // Mesmo valor e mesmo vencimento, posicionado por deslocamento contra
      // `negocio.data_corrente_da_operacao()` — nunca `new Date()` do processo, que é o que o CT-506
      // já prova não participar da derivação.
      const pelaConferencia = await lancar(cenario, -DIAS_DE_ATRASO);
      const pelaBaixaManual = await lancar(cenario, -DIAS_DE_ATRASO);

      // O boleto é emitido na primeira porque é ele que a põe no conjunto a conferir — e é de lá que
      // sai o UUID interno que a trilha exige. A segunda fica sem boleto de propósito: a baixa manual
      // não passa pelo provedor.
      const boleto = boletoDe('1');
      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, pelaConferencia.codigo, boleto);
      });

      const aConferir = await emUnidade(cenario, selecionarCobrancasAConferir);

      expect(aConferir.map((linha) => linha.codigo)).toEqual([pelaConferencia.codigo]);

      // --- Passo 2: a liquidação pelo caminho da conferência ------------------------------------
      const alvo = aConferir[0];

      if (alvo === undefined) {
        throw new Error('o arranjo não colocou a cobrança emitida no conjunto a conferir');
      }

      const desfecho = await emUnidade(cenario, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, alvo.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_INFORMADO,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_INFORMADO,
        });

        // O evento é do CHAMADOR, e só quando houve efeito (ADR-0034) — é a ordem que a §3.1 da T12
        // declara, imitada aqui pelas portas de produção.
        if (aplicado === 'LIQUIDADA') {
          await registrarEventoBancario(tx, {
            cobrancaId: alvo.id,
            tipo: 'COBRANCA_LIQUIDADA',
            origem: 'CONFERENCIA',
          });
        }

        return aplicado;
      });

      expect(desfecho).toBe('LIQUIDADA');

      // --- Passo 3: a MESMA data e o MESMO valor, pela baixa manual ------------------------------
      await emUnidade(cenario, async (tx) => {
        const paga = await acusarPagamentoDeCobranca(tx, pelaBaixaManual.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: Number(VALOR_INFORMADO),
        });

        if (paga === undefined) {
          throw new Error(`o arranjo não alcançou a cobrança ${pelaBaixaManual.codigo}`);
        }
      });

      // --- Passo 4: os quatro carimbos, campo a campo ------------------------------------------
      //
      // A comparação entre as duas vem PRIMEIRO porque é ela que discrimina o defeito perseguido: uma
      // segunda regra de mora escrita na liquidação passaria pelo controle antivácuo abaixo (os
      // valores continuariam plausíveis) e reprovaria aqui, nomeando o campo que divergiu.
      const carimbadaPelaConferencia = await lerCarimbosCrus(cenario, pelaConferencia.codigo);
      const carimbadaPelaBaixaManual = await lerCarimbosCrus(cenario, pelaBaixaManual.codigo);

      expect(carimbadaPelaConferencia.multa_aplicada).toBe(carimbadaPelaBaixaManual.multa_aplicada);
      expect(carimbadaPelaConferencia.juros_aplicados).toBe(
        carimbadaPelaBaixaManual.juros_aplicados,
      );
      expect(carimbadaPelaConferencia.multa_percentual_aplicado).toBe(
        carimbadaPelaBaixaManual.multa_percentual_aplicado,
      );
      expect(carimbadaPelaConferencia.juros_percentual_aplicado).toBe(
        carimbadaPelaBaixaManual.juros_percentual_aplicado,
      );

      // O CONTROLE ANTIVÁCUO: os quatro são os do golden, e não nulos. Sem ele, duas cobranças sem
      // carimbo algum satisfariam a igualdade acima — e é exatamente esse o estado que uma liquidação
      // que não carimbasse nada produziria.
      expect(carimbadaPelaConferencia).toEqual({
        pago_em: DATA_DO_CREDITO,
        valor_pago: VALOR_INFORMADO,
        multa_aplicada: MULTA_CARIMBADA,
        juros_aplicados: JUROS_CARIMBADOS,
        multa_percentual_aplicado: MULTA_PERCENTUAL_CARIMBADO,
        juros_percentual_aplicado: JUROS_PERCENTUAL_CARIMBADO,
        data_credito: DATA_DO_CREDITO,
        valor_creditado: VALOR_INFORMADO,
        identificador_no_provedor: boleto.identificadorNoProvedor,
      });

      // --- Passo 5: o que a cobrança PUBLICA ---------------------------------------------------
      //
      // A leitura é a de produção, pela visão, e é ela que a borda espalha no recurso. `dataDoCredito`
      // e `valorCreditado` chegam preenchidos — o que nenhuma composição de `null` fixo na borda
      // sobreviveria —, e o `numeric` chega convertido em **número**, contra o texto do driver.
      const publicada = await localizar(cenario, pelaConferencia.codigo);

      expect(publicada?.dataDoCredito).toBe(DATA_DO_CREDITO);
      expect(publicada?.valorCreditado).toBe(Number(VALOR_INFORMADO));
      expect(publicada?.numeroDoTituloNoProvedor).toBe(boleto.numeroDoTituloNoProvedor);
      expect(publicada?.linhaDigitavel).toBe(boleto.linhaDigitavel);
      expect(publicada?.codigoDeBarras).toBe(boleto.codigoDeBarras);

      // As 23 chaves por IGUALDADE DE CONJUNTO, e não por contenção: é o que reprova tanto o campo que
      // some quanto o que aparece — em especial `identificadorNoProvedor`, que a linha acima mostra
      // estar gravado na TABELA e que não pode chegar ao recurso publicado.
      expect(Object.keys(publicada ?? {}).sort()).toEqual([...CHAVES_PUBLICADAS]);

      // E o contrato aprova a linha inteira, sem campo órfão: é `esquemaDaCobranca`, o mesmo que a
      // borda publica, aplicado ao que a camada de dados devolve.
      expect(esquemaDaCobranca.safeParse(publicada).success).toBe(true);

      // --- Passo 6: a trilha, e a gêmea que NÃO tem trilha --------------------------------------
      //
      // A segunda metade é o discriminante: sem ela, um produto que gravasse evento em toda baixa —
      // inclusive na manual, que não passou pelo provedor — passaria na primeira.
      expect(await lerTrilha(cenario, pelaConferencia.codigo)).toEqual([
        { tipo: 'COBRANCA_LIQUIDADA', origem: 'CONFERENCIA', valorInformado: null },
      ]);
      expect(await lerTrilha(cenario, pelaBaixaManual.codigo)).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-922 (b) — a liquidação repetida informa, e o fato da primeira baixa sobrevive', () => {
  it(
    'o segundo desfecho é NAO_ESTAVA_EM_ABERTO, os nove campos são os da PRIMEIRA e a trilha tem 1',
    async () => {
      const cenario = await cenarioComPolitica('repeticao-da-baixa');
      const cobranca = await lancar(cenario, -DIAS_DE_ATRASO);
      const boleto = boletoDe('6');

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
      });

      // O UUID sai do conjunto a conferir **antes** da baixa, que é de onde o percurso da T12 o tem em
      // mãos: depois de liquidada, a cobrança deixa aquele conjunto.
      const alvo = (await emUnidade(cenario, selecionarCobrancasAConferir))[0];

      if (alvo === undefined) {
        throw new Error('o arranjo não colocou a cobrança emitida no conjunto a conferir');
      }

      // --- Passo 1: a baixa que de fato corre — o CONTROLE POSITIVO do caso --------------------
      //
      // Sem ele, uma porta que recusasse **sempre** — devolvendo o desfecho benigno a toda liquidação —
      // passaria em tudo o que vem abaixo. É o par que discrimina, não a repetição isolada.
      const primeira = await emUnidade(cenario, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, cobranca.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_INFORMADO,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_INFORMADO,
        });

        if (aplicado === 'LIQUIDADA') {
          await registrarEventoBancario(tx, {
            cobrancaId: alvo.id,
            tipo: 'COBRANCA_LIQUIDADA',
            origem: 'CONFERENCIA',
          });
        }

        return aplicado;
      });

      expect(primeira).toBe('LIQUIDADA');

      // --- Passo 2: o provedor reporta paga a MESMA cobrança, com outra data e outro valor ------
      //
      // É o reenvio benigno que a entrega *at-least-once* produz, e a composição é a da §3.1 da T12: o
      // evento é do chamador, e ele **não** o grava quando nada mudou (ADR-0034).
      const repeticao = await emUnidade(cenario, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, cobranca.codigo, {
          pagoEm: DATA_DA_REPETICAO,
          valorPago: VALOR_DA_REPETICAO,
          dataDoCredito: DATA_DA_REPETICAO,
          valorCreditado: VALOR_DA_REPETICAO,
        });

        if (aplicado === 'LIQUIDADA') {
          await registrarEventoBancario(tx, {
            cobrancaId: alvo.id,
            tipo: 'COBRANCA_LIQUIDADA',
            origem: 'CONFERENCIA',
          });
        }

        return aplicado;
      });

      // --- Passo 3: o RETRATO dos nove campos, que é a metade que discrimina --------------------
      //
      // Ele vem **antes** do desfecho por medição, e a razão está escrita no docblock da porta: sem a
      // cláusula `AND pago_em IS NULL`, a repetição reescreveria `pago_em`, `valor_pago`,
      // `data_credito` e `valor_creditado` pelos da tentativa que não deveria ter corrido. Os quatro
      // carimbos de mora **sobrevivem sozinhos** — o `COALESCE` de `cobranca_derivada` devolve o
      // carimbo já gravado, e o recarimbo é ponto fixo (MT-T6-D, no cabeçalho) —, e é por isso que a
      // repetição informa data e valor **distintos**: sem eles o mutante ficaria vivo. Nesta ordem, o
      // mutante acusa o **dano** (o fato original perdido, campo a campo); na ordem inversa, ele
      // acusaria apenas a ausência da recusa, que é a metade fácil.
      expect(await lerCarimbosCrus(cenario, cobranca.codigo)).toEqual({
        pago_em: DATA_DO_CREDITO,
        valor_pago: VALOR_INFORMADO,
        multa_aplicada: MULTA_CARIMBADA,
        juros_aplicados: JUROS_CARIMBADOS,
        multa_percentual_aplicado: MULTA_PERCENTUAL_CARIMBADO,
        juros_percentual_aplicado: JUROS_PERCENTUAL_CARIMBADO,
        data_credito: DATA_DO_CREDITO,
        valor_creditado: VALOR_INFORMADO,
        identificador_no_provedor: boleto.identificadorNoProvedor,
      });

      // --- Passo 4: e o desfecho que permite ao percurso NÃO contar efeito ----------------------
      expect(repeticao).toBe('NAO_ESTAVA_EM_ABERTO');

      // --- Passo 5: exatamente UM evento — o da baixa que aconteceu ----------------------------
      //
      // É a consequência que a ADR-0034 cobra: a trilha registra **efeito**, nunca tentativa. Dois
      // eventos aqui significariam uma conferência contando duas vezes o mesmo pagamento.
      expect(await lerTrilha(cenario, cobranca.codigo)).toEqual([
        { tipo: 'COBRANCA_LIQUIDADA', origem: 'CONFERENCIA', valorInformado: null },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-922 (c) — a segunda emissão não escreve por cima de um boleto vivo', () => {
  it(
    'a recusa nomeia o ato EMISSAO, o título da PRIMEIRA sobrevive, e a revogação reabre o caminho',
    async () => {
      const cenario = await cenarioComPolitica('emissao-dupla');
      const cobranca = await lancar(cenario, -DIAS_DE_ATRASO);
      const primeiro = boletoDe('7');
      const segundo = boletoDe('8');

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, primeiro);
      });

      // --- Passo 1: a segunda emissão, sobre a MESMA cobrança ----------------------------------
      //
      // É o invariante financeiro da fatia: sem `AND numero_do_titulo_no_provedor IS NULL`, esta chamada substituiria em
      // silêncio o título registrado no banco, e o boleto anterior continuaria pagável no mundo — a
      // CA-05 (*"em nenhum instante os dois são pagáveis"*) desfeita no ponto onde a escrita acontece.
      const recusa = await recusaDe(
        async () =>
          await emUnidade(cenario, async (tx) => {
            await gravarBoletoDaCobranca(tx, cobranca.codigo, segundo);
          }),
      );

      // --- Passo 2: os CINCO campos gravados continuam os da PRIMEIRA emissão -------------------
      //
      // Esta é a discriminante, e por isso vem antes da recusa: ela separa *"recusou"* de *"recusou
      // depois de gravar"*, e é a única que reprova nas duas formas de perder a guarda — a cláusula
      // apagada (que não recusa) e a leitura prévia (que grava e recusa fora de hora).
      expect(await lerBoleto(cenario, cobranca.codigo)).toEqual({
        numeroDoTituloNoProvedor: primeiro.numeroDoTituloNoProvedor,
        linhaDigitavel: primeiro.linhaDigitavel,
        codigoDeBarras: primeiro.codigoDeBarras,
        caminhoDoArquivo: primeiro.caminhoDoArquivo,
      });

      // O quinto campo é interno e só é observável na tabela — e ele é o que **não se recompõe**: o
      // contador do SaaS já avançou, e uma segunda emissão que o sobrescrevesse queimaria a chave de
      // correlação da primeira sem deixar rastro.
      expect((await lerCarimbosCrus(cenario, cobranca.codigo)).identificador_no_provedor).toBe(
        primeiro.identificadorNoProvedor,
      );

      // --- Passo 3: a recusa é a CLASSE nomeada, com o código e o ato ---------------------------
      //
      // A igualdade é sobre o corpo inteiro: a classe reconhecida por `instanceof` (um `Error` genérico
      // cai no rótulo `OUTRA RECUSA` e reprova nomeando o que veio no lugar), a mensagem que o mapa
      // escolheu pelo ato, e os dois fatos que a porta carrega.
      expect(recusa).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DA_EMISSAO,
        codigo: cobranca.codigo,
        ato: 'EMISSAO',
      });

      // --- Passo 4: o CONTROLE POSITIVO — revogar devolve a cobrança ao alcance da emissão ------
      //
      // Sem ele, uma porta que recusasse **toda** emissão sobre cobrança já vista passaria nos passos
      // acima. É também o percurso da reemissão (T11), que revoga antes de emitir: a guarda é sobre o
      // **estado**, e não sobre o histórico.
      expect(
        await emUnidade(cenario, async (tx) => await revogarBoleto(tx, cobranca.codigo)),
      ).toEqual({ desfecho: 'REVOGADO', caminhoDoArquivo: primeiro.caminhoDoArquivo });

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, segundo);
      });

      expect(await lerBoleto(cenario, cobranca.codigo)).toEqual({
        numeroDoTituloNoProvedor: segundo.numeroDoTituloNoProvedor,
        linhaDigitavel: segundo.linhaDigitavel,
        codigoDeBarras: segundo.codigoDeBarras,
        caminhoDoArquivo: segundo.caminhoDoArquivo,
      });

      // O identificador da PRIMEIRA emissão foi substituído pelo da segunda, e isto é conteúdo: a
      // revogação não o zera (ele é a chave por onde uma notícia atrasada ainda se liga à cobrança), e
      // a emissão seguinte grava o seu no mesmo ato dos demais.
      expect((await lerCarimbosCrus(cenario, cobranca.codigo)).identificador_no_provedor).toBe(
        segundo.identificadorNoProvedor,
      );
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-922 (d) — a liquidação de cobrança CANCELADA informa, em vez de abortar a unidade', () => {
  it(
    'o desfecho é NAO_ESTAVA_EM_ABERTO, nada é gravado, e a cobrança em aberto continua liquidando',
    async () => {
      const cenario = await cenarioComPolitica('liquidacao-de-cancelada');
      const cancelada = await lancar(cenario, -DIAS_DE_ATRASO);
      const emAberto = await lancar(cenario, -DIAS_DE_ATRASO);
      const boletoDaCancelada = boletoDe('b');
      const boletoDaEmAberto = boletoDe('c');

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cancelada.codigo, boletoDaCancelada);
        await gravarBoletoDaCobranca(tx, emAberto.codigo, boletoDaEmAberto);
      });

      // O cancelamento **não** revoga o boleto (`cancelarCobranca`, da F3, só escreve `cancelado_em`),
      // de modo que a cobrança cancelada conserva `numero_do_titulo_no_provedor` — e é isso que torna a janela
      // alcançável: o percurso a selecionou enquanto estava em aberto, e o Admin cancelou antes de a
      // notícia do provedor chegar.
      await emUnidade(cenario, async (tx) => {
        if ((await cancelarCobranca(tx, cancelada.codigo)) === undefined) {
          throw new Error(`o arranjo não alcançou a cobrança ${cancelada.codigo} para cancelar`);
        }
      });

      const antes = await localizar(cenario, cancelada.codigo);

      expect(antes?.canceladoEm).toEqual(expect.any(String));
      expect(antes?.status).toBe('CANCELADA');

      // --- A liquidação que o provedor reporta sobre a cobrança já cancelada -------------------
      const desfecho = await desfechoDaLiquidacao(cenario, cancelada.codigo, {
        pagoEm: DATA_DA_REPETICAO,
        valorPago: VALOR_DA_REPETICAO,
        dataDoCredito: DATA_DA_REPETICAO,
        valorCreditado: VALOR_DA_REPETICAO,
      });

      // --- Passo 1: o estado preservado, na ordem que a T5 mediu -------------------------------
      //
      // Os oito campos de desfecho e conciliação continuam nulos, e o `identificador_no_provedor` da
      // emissão continua lá. É a metade que nomeia o **dano** caso a porta passe a escrever.
      expect(await lerCarimbosCrus(cenario, cancelada.codigo)).toEqual({
        pago_em: null,
        valor_pago: null,
        multa_aplicada: null,
        juros_aplicados: null,
        multa_percentual_aplicado: null,
        juros_percentual_aplicado: null,
        data_credito: null,
        valor_creditado: null,
        identificador_no_provedor: boletoDaCancelada.identificadorNoProvedor,
      });

      // O cancelamento sobrevive **idêntico**, instante a instante: a liquidação não o desfaz nem o
      // recarimba, e o estado publicado continua sendo o derivado dele.
      const depois = await localizar(cenario, cancelada.codigo);

      expect(depois?.canceladoEm).toBe(antes?.canceladoEm);
      expect(depois?.status).toBe('CANCELADA');

      // --- Passo 2: o desfecho DENTRO da união — a asserção que discrimina o defeito -----------
      //
      // Com o predicado do crédito reduzido a `AND pago_em IS NULL`, a cancelada o satisfazia (o
      // `pago_em` dela é nulo), `acusarPagamentoDeCobranca` gravava `pago_em` sobre `cancelado_em` e o
      // `cobranca_desfecho_unico_chk` recusava — a unidade abortava e o chamador recebia `23514` cru,
      // indistinguível de falha transitória. O rótulo {@link RECUSA_FORA_DA_UNIAO} é o que faz essa
      // perda de taxonomia aparecer **nomeada** aqui, em vez de o caso estourar sem asserção.
      expect(desfecho).toBe('NAO_ESTAVA_EM_ABERTO');

      // --- Passo 3: o COMPANHEIRO POSITIVO ----------------------------------------------------
      //
      // Sem ele, uma porta que recusasse **sempre** — devolvendo o desfecho benigno a toda liquidação —
      // satisfaria tudo o que está acima. É o par que discrimina, não a cancelada isolada.
      expect(
        await desfechoDaLiquidacao(cenario, emAberto.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_INFORMADO,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_INFORMADO,
        }),
      ).toBe('LIQUIDADA');

      // E a cobrança em aberto de fato ficou paga, com o que o provedor informou — a prova de que o
      // desfecho positivo não é só um rótulo devolvido.
      expect(await lerCarimbosCrus(cenario, emAberto.codigo)).toEqual({
        pago_em: DATA_DO_CREDITO,
        valor_pago: VALOR_INFORMADO,
        multa_aplicada: MULTA_CARIMBADA,
        juros_aplicados: JUROS_CARIMBADOS,
        multa_percentual_aplicado: MULTA_PERCENTUAL_CARIMBADO,
        juros_percentual_aplicado: JUROS_PERCENTUAL_CARIMBADO,
        data_credito: DATA_DO_CREDITO,
        valor_creditado: VALOR_INFORMADO,
        identificador_no_provedor: boletoDaEmAberto.identificadorNoProvedor,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-923 — valor divergente não impede a baixa e vira um segundo evento', () => {
  it(
    'a cobrança fica paga com o valor do provedor, e a trilha tem os DOIS eventos',
    async () => {
      const cenario = await cenarioComPolitica('divergencia');
      const cobranca = await lancar(cenario, -DIAS_DE_ATRASO);

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, boletoDe('2'));
      });

      const alvo = (await emUnidade(cenario, selecionarCobrancasAConferir))[0];

      if (alvo === undefined) {
        throw new Error('o arranjo não colocou a cobrança emitida no conjunto a conferir');
      }

      // O valor **esperado** sai da visão, e não de um literal escrito aqui: é o `valor_total` que a
      // cobrança publicava um instante antes da baixa, apurado pela política vigente.
      const esperado = await localizar(cenario, cobranca.codigo);

      expect(esperado?.valorTotal).toBe(TOTAL_COM_MORA);
      expect(esperado?.valorTotal).not.toBe(Number(VALOR_DIVERGENTE));

      // --- A conferência aplica o que o provedor informou, e registra a divergência -------------
      //
      // A composição é a da §3.1 da T12: a baixa **não é impedida**, e a divergência entra como um
      // SEGUNDO evento, com o valor tal como informado.
      await emUnidade(cenario, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, alvo.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_DIVERGENTE,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_DIVERGENTE,
        });

        if (aplicado !== 'LIQUIDADA') {
          throw new Error(`a liquidação da cobrança ${alvo.codigo} não aconteceu: ${aplicado}`);
        }

        await registrarEventoBancario(tx, {
          cobrancaId: alvo.id,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
        });

        await registrarEventoBancario(tx, {
          cobrancaId: alvo.id,
          tipo: 'DIVERGENCIA_DE_VALOR',
          origem: 'CONFERENCIA',
          valorInformado: VALOR_DIVERGENTE,
        });
      });

      // --- A baixa aconteceu ASSIM MESMO --------------------------------------------------------
      //
      // `pago_em` não-nulo vem PRIMEIRO, e é o que discrimina *baixou assim mesmo* de *recusou a baixa
      // e só registrou o evento*: sem ele, um SUT que bloqueasse a baixa passaria por ter gravado a
      // divergência.
      const crua = await lerCarimbosCrus(cenario, cobranca.codigo);

      expect(crua.pago_em).toBe(DATA_DO_CREDITO);
      expect(crua.valor_pago).toBe(VALOR_DIVERGENTE);
      expect(crua.valor_creditado).toBe(VALOR_DIVERGENTE);

      // --- Os DOIS eventos, por igualdade de conjunto de tipos ----------------------------------
      const trilha = await lerTrilha(cenario, cobranca.codigo);

      expect([...trilha].map((evento) => evento.tipo).sort()).toEqual([
        'COBRANCA_LIQUIDADA',
        'DIVERGENCIA_DE_VALOR',
      ]);

      const divergencia = trilha.find((evento) => evento.tipo === 'DIVERGENCIA_DE_VALOR');

      expect(divergencia).toEqual({
        tipo: 'DIVERGENCIA_DE_VALOR',
        origem: 'CONFERENCIA',
        valorInformado: Number(VALOR_DIVERGENTE),
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-924 — o estorno apaga o fato do pagamento e o estado volta a ser derivado', () => {
  it(
    'os oito campos em NULL, os três de emissão intactos, e o estado derivado dos DOIS lados',
    async () => {
      const cenario = await cenarioComPolitica('estorno');

      // Os dois lados do vencimento no MESMO caso: é o par que detecta uma implementação que gravasse
      // estado fixo em vez de derivar — ela acertaria um lado e erraria o outro.
      const vencida = await lancar(cenario, -DIAS_DE_ATRASO);
      const aVencer = await lancar(cenario, DIAS_DE_ATRASO);

      // Cada alvo carrega os carimbos que a política produz **sobre ele**: a vencida leva os do
      // golden, a que ainda não venceu leva os dois zeros que a mesma visão apura. Escrevê-los por
      // alvo — em vez de aceitar "qualquer texto" — é o que faz o retrato do passo 1 ser controle
      // antivácuo de verdade: uma liquidação que carimbasse a mora errada reprovaria aqui.
      const alvos: {
        readonly codigo: string;
        readonly boleto: BoletoEmitido;
        readonly multa: string;
        readonly juros: string;
      }[] = [
        {
          codigo: vencida.codigo,
          boleto: boletoDe('3'),
          multa: MULTA_CARIMBADA,
          juros: JUROS_CARIMBADOS,
        },
        { codigo: aVencer.codigo, boleto: boletoDe('4'), multa: SEM_MULTA, juros: SEM_JUROS },
      ];

      for (const alvo of alvos) {
        await emUnidade(cenario, async (tx) => {
          await gravarBoletoDaCobranca(tx, alvo.codigo, alvo.boleto);
        });
      }

      // --- Passo 1: liquidar as duas, e o RETRATO dos oito campos preenchidos -------------------
      //
      // O retrato é o controle antivácuo do caso: sem ele, um estorno que não fizesse nada passaria,
      // porque os campos já nasceram nulos.
      const idPorCodigo = new Map(
        (await emUnidade(cenario, selecionarCobrancasAConferir)).map((linha) => [
          linha.codigo,
          linha.id,
        ]),
      );

      for (const alvo of alvos) {
        const cobrancaId = idPorCodigo.get(alvo.codigo);

        if (cobrancaId === undefined) {
          throw new Error(`a cobrança ${alvo.codigo} não entrou no conjunto a conferir`);
        }

        await emUnidade(cenario, async (tx) => {
          const aplicado = await liquidarPeloProvedor(tx, alvo.codigo, {
            pagoEm: DATA_DO_CREDITO,
            valorPago: VALOR_INFORMADO,
            dataDoCredito: DATA_DO_CREDITO,
            valorCreditado: VALOR_INFORMADO,
          });

          if (aplicado !== 'LIQUIDADA') {
            throw new Error(`a liquidação de ${alvo.codigo} não aconteceu: ${aplicado}`);
          }
        });

        expect(await lerCarimbosCrus(cenario, alvo.codigo)).toEqual({
          pago_em: DATA_DO_CREDITO,
          valor_pago: VALOR_INFORMADO,
          multa_aplicada: alvo.multa,
          juros_aplicados: alvo.juros,
          multa_percentual_aplicado: MULTA_PERCENTUAL_CARIMBADO,
          juros_percentual_aplicado: JUROS_PERCENTUAL_CARIMBADO,
          data_credito: DATA_DO_CREDITO,
          valor_creditado: VALOR_INFORMADO,
          identificador_no_provedor: alvo.boleto.identificadorNoProvedor,
        });

        // --- Passo 2: o estorno, pelo caminho da conferência ------------------------------------
        await emUnidade(cenario, async (tx) => {
          const desfeito = await estornarLiquidacao(tx, alvo.codigo);

          if (desfeito !== 'ESTORNADA') {
            throw new Error(`o estorno de ${alvo.codigo} não aconteceu: ${desfeito}`);
          }

          await registrarEventoBancario(tx, {
            cobrancaId,
            tipo: 'LIQUIDACAO_ESTORNADA',
            origem: 'CONFERENCIA',
          });
        });
      }

      // --- Passo 3: os OITO campos em NULL, e os TRÊS de emissão intactos ----------------------
      for (const alvo of alvos) {
        expect(await lerCarimbosCrus(cenario, alvo.codigo)).toEqual({
          pago_em: null,
          valor_pago: null,
          multa_aplicada: null,
          juros_aplicados: null,
          multa_percentual_aplicado: null,
          juros_percentual_aplicado: null,
          data_credito: null,
          valor_creditado: null,
          identificador_no_provedor: alvo.boleto.identificadorNoProvedor,
        });

        // O controle que separa **estorno** de **revogação**: os três campos de emissão continuam lá,
        // e o `cancelado_em` continua nulo — nenhum caminho desta fatia escreve o cancelamento (RN-10).
        expect(await lerBoleto(cenario, alvo.codigo)).toEqual({
          numeroDoTituloNoProvedor: alvo.boleto.numeroDoTituloNoProvedor,
          linhaDigitavel: alvo.boleto.linhaDigitavel,
          codigoDeBarras: alvo.boleto.codigoDeBarras,
          caminhoDoArquivo: alvo.boleto.caminhoDoArquivo,
        });

        expect((await localizar(cenario, alvo.codigo))?.canceladoEm).toBeNull();

        // Exatamente UM evento de estorno por cobrança.
        expect(await lerTrilha(cenario, alvo.codigo)).toEqual([
          { tipo: 'LIQUIDACAO_ESTORNADA', origem: 'CONFERENCIA', valorInformado: null },
        ]);
      }

      // --- Passo 4: o estado voltou a DERIVAR, e os dois lados discordam entre si ---------------
      expect((await localizar(cenario, vencida.codigo))?.status).toBe('VENCIDA');
      expect((await localizar(cenario, aVencer.codigo))?.status).toBe('A_VENCER');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-924 (b) — a revogação zera a emissão, devolve o arquivo e NÃO escreve `cancelado_em`',
    async () => {
      const cenario = await cenarioComPolitica('revogacao');
      const cobranca = await lancar(cenario, -DIAS_DE_ATRASO);
      const boleto = boletoDe('5');

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
      });

      // A cobrança é CANCELADA de propósito, com o boleto vivo: é o único arranjo em que apagar
      // `cancelado_em` é observável. Sobre uma cobrança em aberto, a coluna já é nula, e um `SET` que
      // a nomeasse passaria despercebido.
      await emUnidade(cenario, async (tx) => {
        const cancelada = await cancelarCobranca(tx, cobranca.codigo);

        if (cancelada === undefined) {
          throw new Error(`o arranjo não alcançou a cobrança ${cobranca.codigo} para cancelar`);
        }
      });

      const antes = await localizar(cenario, cobranca.codigo);

      expect(antes?.canceladoEm).toEqual(expect.any(String));
      expect(antes?.status).toBe('CANCELADA');

      // --- A revogação --------------------------------------------------------------------------
      const revogacao = await emUnidade(
        cenario,
        async (tx) => await revogarBoleto(tx, cobranca.codigo),
      );

      // O caminho volta **preenchido**, apesar de a coluna já estar nula: é a auto-junção lendo a
      // fotografia anterior à escrita. Sem ele, os bytes ficariam órfãos no disco.
      expect(revogacao).toEqual({
        desfecho: 'REVOGADO',
        caminhoDoArquivo: boleto.caminhoDoArquivo,
      });

      // Os quatro campos zerados...
      expect(await lerBoleto(cenario, cobranca.codigo)).toEqual({
        numeroDoTituloNoProvedor: null,
        linhaDigitavel: null,
        codigoDeBarras: null,
        caminhoDoArquivo: null,
      });

      // ... e o cancelamento **idêntico**, instante a instante. Esta é a asserção que a RN-09 cobra, e
      // ela vem antes da estática porque é a comportamental que reprova qualquer forma do defeito,
      // inclusive as que a varredura de texto não anteciparia.
      const depois = await localizar(cenario, cobranca.codigo);

      expect(depois?.canceladoEm).toBe(antes?.canceladoEm);
      expect(depois?.status).toBe('CANCELADA');

      // A repetição **informa** em vez de reescrever a tupla: não havia mais boleto a revogar.
      expect(
        await emUnidade(cenario, async (tx) => await revogarBoleto(tx, cobranca.codigo)),
      ).toEqual({ desfecho: 'NAO_HAVIA_BOLETO', caminhoDoArquivo: null });

      // --- A leitura da INSTRUÇÃO, que é o que o aceite técnico pede ----------------------------
      //
      // Igualdade de lista, nunca contenção: ela reprova tanto a coluna que aparece quanto a que some.
      expect(colunasDoSet(readFileSync(FONTE_DA_PORTA, 'utf8'), ASSINATURA_DA_REVOGACAO)).toEqual([
        ...COLUNAS_ZERADAS_PELA_REVOGACAO,
      ]);

      // O CONTROLE: a mesma extração, sobre a instrução com o defeito, **enxerga** a coluna proibida.
      // Sem ele, um extrator cego a `cancelado_em` aprovaria o defeito de volta.
      expect(colunasDoSet(REVOGACAO_COM_O_CANCELAMENTO, ASSINATURA_DA_REVOGACAO)).toEqual([
        ...COLUNAS_ZERADAS_PELA_REVOGACAO,
        COLUNA_DO_CANCELAMENTO,
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-924 (c) — o estorno de cobrança em aberto informa e não reescreve a tupla', () => {
  it(
    'NAO_ESTAVA_PAGA, a versão da tupla idêntica, e o estorno legítimo continua acontecendo',
    async () => {
      const cenario = await cenarioComPolitica('estorno-em-aberto');
      const cobranca = await lancar(cenario, -DIAS_DE_ATRASO);
      const boleto = boletoDe('9');

      await emUnidade(cenario, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
      });

      const alvo = (await emUnidade(cenario, selecionarCobrancasAConferir))[0];

      if (alvo === undefined) {
        throw new Error('o arranjo não colocou a cobrança emitida no conjunto a conferir');
      }

      // --- Passo 1: o estorno de algo que nunca foi pago ----------------------------------------
      //
      // É o reenvio benigno da conferência: o provedor informa o estorno de um crédito que já fora
      // estornado, e nada há a desfazer.
      const versaoAntes = await lerVersaoDaTupla(cenario, cobranca.codigo);

      const desfeito = await emUnidade(
        cenario,
        async (tx) => await estornarLiquidacao(tx, cobranca.codigo),
      );

      // --- Passo 2: a TUPLA não foi reescrita — a metade que discrimina -------------------------
      //
      // Ela vem antes do desfecho, e é a única asserção que enxerga o dano que a cláusula
      // `AND pago_em IS NOT NULL` impede: sem ela, o `UPDATE` grava `NULL` sobre `NULL` nos oito campos,
      // o que passa em **qualquer** comparação de valores e ainda assim reescreve a linha. É a distinção
      // entre *não alterou* e *reescreveu com o mesmo valor* que o docblock da porta nomeia, e que só o
      // `xmin` separa.
      expect(await lerVersaoDaTupla(cenario, cobranca.codigo)).toBe(versaoAntes);

      // --- Passo 3: e o desfecho que permite ao percurso NÃO contar efeito ----------------------
      expect(desfeito).toBe('NAO_ESTAVA_PAGA');

      // Nada mudou em campo nenhum: os oito seguem nulos, o identificador da emissão segue lá, e o
      // estado continua derivando do vencimento (ADR-0022).
      expect(await lerCarimbosCrus(cenario, cobranca.codigo)).toEqual({
        pago_em: null,
        valor_pago: null,
        multa_aplicada: null,
        juros_aplicados: null,
        multa_percentual_aplicado: null,
        juros_percentual_aplicado: null,
        data_credito: null,
        valor_creditado: null,
        identificador_no_provedor: boleto.identificadorNoProvedor,
      });

      expect((await localizar(cenario, cobranca.codigo))?.status).toBe('VENCIDA');

      // --- Passo 4: o CONTROLE POSITIVO — liquidada, ela É estornada ----------------------------
      //
      // Sem ele, uma porta que recusasse **todo** estorno passaria nos três passos acima, e a cobrança
      // paga por engano ficaria paga para sempre.
      await emUnidade(cenario, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, cobranca.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_INFORMADO,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_INFORMADO,
        });

        if (aplicado !== 'LIQUIDADA') {
          throw new Error(`o controle positivo não liquidou ${cobranca.codigo}: ${aplicado}`);
        }
      });

      expect(
        await emUnidade(cenario, async (tx) => await estornarLiquidacao(tx, cobranca.codigo)),
      ).toBe('ESTORNADA');

      expect((await lerCarimbosCrus(cenario, cobranca.codigo)).pago_em).toBeNull();
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-924 (d) — a escrita que a política não alcança recusa com a CLASSE nomeada', () => {
  it(
    'os três atos sob a empresa vizinha levantam com `codigo` e `ato`, e o fato da dona fica intacto',
    async () => {
      const dona = await cenarioComPolitica('nao-alcance-dona');
      const vizinha = await cenarioComPolitica('nao-alcance-vizinha');

      const cobranca = await lancar(dona, -DIAS_DE_ATRASO);
      const boleto = boletoDe('a');

      await emUnidade(dona, async (tx) => {
        await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
      });

      await emUnidade(dona, async (tx) => {
        const aplicado = await liquidarPeloProvedor(tx, cobranca.codigo, {
          pagoEm: DATA_DO_CREDITO,
          valorPago: VALOR_INFORMADO,
          dataDoCredito: DATA_DO_CREDITO,
          valorCreditado: VALOR_INFORMADO,
        });

        if (aplicado !== 'LIQUIDADA') {
          throw new Error(`o arranjo não liquidou ${cobranca.codigo}: ${aplicado}`);
        }
      });

      // --- Passo 1: os TRÊS atos, sob o contexto da empresa vizinha -----------------------------
      //
      // A política esconde a linha da dona sob o contexto da vizinha (ADR-0008), de modo que as três
      // escritas alcançam zero linhas. Zero linhas tem duas causas — o estado que não admitia o ato e o
      // não-alcance —, e só a segunda é **grave**: repetir a tarefa não muda nada, e quem percorre
      // precisa reconhecê-la **em runtime** para não queimar as três tentativas da fila terminando por
      // dizer ao operador o oposto da verdade.
      //
      // Os três retratos têm o mesmo formato e mensagens **diferentes**, e é essa combinação que prova o
      // que um ato sozinho não provaria: o mapa escolhe pela chave, em vez de devolver sempre o mesmo
      // texto. Com o `EMISSAO` do `CT-922 (c)`, a união `AtoSobreOBoleto` fica coberta inteira.
      expect(
        await recusaDe(
          async () =>
            await emUnidade(vizinha, async (tx) => {
              await liquidarPeloProvedor(tx, cobranca.codigo, {
                pagoEm: DATA_DA_REPETICAO,
                valorPago: VALOR_DA_REPETICAO,
                dataDoCredito: DATA_DA_REPETICAO,
                valorCreditado: VALOR_DA_REPETICAO,
              });
            }),
        ),
      ).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DA_LIQUIDACAO,
        codigo: cobranca.codigo,
        ato: 'LIQUIDACAO',
      });

      expect(
        await recusaDe(
          async () =>
            await emUnidade(vizinha, async (tx) => {
              await estornarLiquidacao(tx, cobranca.codigo);
            }),
        ),
      ).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DO_ESTORNO,
        codigo: cobranca.codigo,
        ato: 'ESTORNO',
      });

      expect(
        await recusaDe(
          async () =>
            await emUnidade(vizinha, async (tx) => {
              await revogarBoleto(tx, cobranca.codigo);
            }),
        ),
      ).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DA_REVOGACAO,
        codigo: cobranca.codigo,
        ato: 'REVOGACAO',
      });

      // --- Passo 2: e o fato da dona está INTACTO ----------------------------------------------
      //
      // A recusa não é só uma mensagem: as três escritas de fato não tiveram efeito, e é isto que impede
      // as igualdades acima de serem satisfeitas por portas que levantassem **depois** de gravar.
      expect(await lerCarimbosCrus(dona, cobranca.codigo)).toEqual({
        pago_em: DATA_DO_CREDITO,
        valor_pago: VALOR_INFORMADO,
        multa_aplicada: MULTA_CARIMBADA,
        juros_aplicados: JUROS_CARIMBADOS,
        multa_percentual_aplicado: MULTA_PERCENTUAL_CARIMBADO,
        juros_percentual_aplicado: JUROS_PERCENTUAL_CARIMBADO,
        data_credito: DATA_DO_CREDITO,
        valor_creditado: VALOR_INFORMADO,
        identificador_no_provedor: boleto.identificadorNoProvedor,
      });

      expect(await lerBoleto(dona, cobranca.codigo)).toEqual({
        numeroDoTituloNoProvedor: boleto.numeroDoTituloNoProvedor,
        linhaDigitavel: boleto.linhaDigitavel,
        codigoDeBarras: boleto.codigoDeBarras,
        caminhoDoArquivo: boleto.caminhoDoArquivo,
      });

      // --- Passo 3: o CONTROLE POSITIVO — sob a DONA, a mesma chamada alcança -------------------
      //
      // Sem ele, uma porta que levantasse **sempre** — quebrando a revogação legítima do produto —
      // passaria nos dois passos acima. É o par que discrimina, não a asserção negativa isolada.
      expect(await emUnidade(dona, async (tx) => await revogarBoleto(tx, cobranca.codigo))).toEqual(
        { desfecho: 'REVOGADO', caminhoDoArquivo: boleto.caminhoDoArquivo },
      );
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — tudo pelas portas públicas, salvo a leitura crua das colunas
// ---------------------------------------------------------------------------

interface Cenario {
  readonly empresaId: string;
  readonly contratoId: string;
}

/** O contexto de tenant e a unidade de trabalho, na única forma que este arquivo usa. */
async function emUnidade<T>(
  cenario: { readonly empresaId: string },
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: cenario.empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Uma empresa nova, com cadastros, contrato **ATIVO** e política de mora vigente — tudo pelas portas.
 *
 * A empresa é própria de cada caso porque `configuracao_de_mora` é `unique(empresa_id)`: duas
 * políticas diferentes exigiriam duas empresas, e casos que compartilhassem a mesma ficariam
 * acoplados pela ordem de execução.
 */
async function cenarioComPolitica(marca: string): Promise<Cenario> {
  sequenciaDoCenario += 1;
  const sufixo = `${marca}-${String(sequenciaDoCenario)}`;

  const empresa = await contextoDeTenant.executarCom(
    CONTEXTO_DA_SEMENTE,
    async () =>
      await acesso.emUnidadeDeTrabalho(
        async (tx) =>
          await admitirEmpresa(tx, {
            nome: `Imobiliária ${sufixo}`,
            documento: `${String(Date.now()).slice(-8)}${String(sequenciaDoCenario).padStart(6, '0')}`,
          }),
      ),
  );

  if (empresa === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${sufixo}`);
  }

  const contexto = { empresaId: empresa.id };

  const cadastros = await emUnidade(contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${sufixo}` });

    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${sufixo}`,
      identificadorMunicipal: `IPTU-${sufixo}`,
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

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${sufixo}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${sufixo}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  // As duas unidades sequenciais da série (tech spec §7.4): a primeira garante o contador e commita, a
  // segunda emite o número e grava. Fundi-las é o desenho que a ADR-0020 recusa.
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
        dataInicioLocacao: '2026-01-15',
        prazoMeses: 12,
        valorMensal: VALOR_ORIGINAL,
        diaVencimento: 10,
        gerarCobrancasAutomaticamente: false,
      },
      { ano: anoDoContrato, numero },
    );
  });

  await emUnidade(contexto, async (tx) => {
    const ativado = await ativarContrato(tx, contrato.codigo, {
      dataFimLocacao: derivarTerminoDaLocacao('2026-01-15', 12),
      valorTotalContrato: derivarValorTotal(VALOR_ORIGINAL, 12),
    });

    if (ativado === undefined) {
      throw new Error(`o arranjo não conseguiu ativar o contrato ${contrato.codigo}`);
    }
  });

  // A política vigente, pela porta que a borda usa — e não por instrução crua.
  await emUnidade(contexto, async (tx) => {
    await gravarConfiguracaoDeMora(tx, {
      multaPercentual: MULTA_PERCENTUAL,
      jurosPercentual: JUROS_PERCENTUAL,
    });
  });

  return { empresaId: empresa.id, contratoId: contrato.id };
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
    email: 'contato@exemplo.com.br',
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
 * Lança uma cobrança com o vencimento deslocado em `dias` contra o relógio **do banco**.
 *
 * O relógio nunca é falseado; o dado é que se move. A leitura sai do mesmo
 * `negocio.data_corrente_da_operacao()` que a visão consulta, de modo que a fronteira do vencimento é
 * medida contra o próprio eixo que a decide — é o que o `CT-506` já prova não passar pelo processo.
 */
async function lancar(cenario: Cenario, diasAteVencimento: number): Promise<LinhaDeCobranca> {
  const ano = await emUnidade(cenario, lerAnoDaSerieDeCobranca);
  const dataVencimento = await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${diasAteVencimento}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data do vencimento');
    }

    return linha.data;
  });

  await emUnidade(cenario, async (tx) => {
    await garantirContadorDeCobranca(tx, ano);
  });

  return await emUnidade(cenario, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);

    return await criarCobranca(
      tx,
      {
        contratoId: cenario.contratoId,
        natureza: 'ALUGUEL',
        referencia: 'Aluguel de janeiro/2026',
        competencia: '2026-01-01',
        dataVencimento,
        valorOriginal: VALOR_ORIGINAL,
      },
      { ano, numero },
    );
  });
}

/** A leitura publicada, **pela porta** — a mesma que a borda espalha no recurso. */
async function localizar(cenario: Cenario, codigo: string): Promise<LinhaDeCobranca | undefined> {
  return await emUnidade(cenario, async (tx) => await localizarCobranca(tx, codigo));
}

/** O boleto, **pela porta** que a entrega de bytes (T14) vai consumir. */
async function lerBoleto(cenario: Cenario, codigo: string) {
  return await emUnidade(cenario, async (tx) => await lerBoletoDaCobranca(tx, codigo));
}

/** A trilha publicada, **pela porta**, sem o carimbo que o banco escolhe. */
async function lerTrilha(cenario: Cenario, codigo: string) {
  const eventos = await emUnidade(cenario, async (tx) => await lerTrilhaDaCobranca(tx, codigo));

  // `ocorridoEm` sai da comparação porque é instante do banco, e não fato do caso — o que se afirma é
  // tipo, origem e valor. `diagnostico` também: nenhum destes eventos carrega texto do provedor.
  return eventos.map((evento) => ({
    tipo: evento.tipo,
    origem: evento.origem,
    valorInformado: evento.valorInformado,
  }));
}

/** Os campos do desfecho e da conciliação, lidos **cruamente** da tabela. */
interface CarimbosCrus {
  readonly pago_em: string | null;
  readonly valor_pago: string | null;
  readonly multa_aplicada: string | null;
  readonly juros_aplicados: string | null;
  readonly multa_percentual_aplicado: string | null;
  readonly juros_percentual_aplicado: string | null;
  readonly data_credito: string | null;
  readonly valor_creditado: string | null;
  readonly identificador_no_provedor: string | null;
}

/**
 * Lê os nove campos sem passar pela conversão da porta.
 *
 * A porta converte `numeric` em número, e `40.00` e `40.0` são o **mesmo** número em JavaScript. A
 * cadeia é o que distingue a escala do `numeric(15,2)` de uma conversão que a perdeu no caminho — e é
 * a forma em que os cards escrevem os valores esperados.
 *
 * `identificador_no_provedor` só é observável aqui: ele é interno, e nenhuma leitura publicada o
 * entrega. É essa assimetria — gravado na tabela, ausente do recurso — que o `CT-922` afirma.
 *
 * Não há `WHERE empresa_id`, e não pode haver: quem recorta é a política (ADR-0008).
 */
async function lerCarimbosCrus(cenario: Cenario, codigo: string): Promise<CarimbosCrus> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<CarimbosCrus[]>`
      SELECT to_char(pago_em, 'YYYY-MM-DD') AS pago_em,
             valor_pago::text AS valor_pago,
             multa_aplicada::text AS multa_aplicada,
             juros_aplicados::text AS juros_aplicados,
             multa_percentual_aplicado::text AS multa_percentual_aplicado,
             juros_percentual_aplicado::text AS juros_percentual_aplicado,
             to_char(data_credito, 'YYYY-MM-DD') AS data_credito,
             valor_creditado::text AS valor_creditado,
             identificador_no_provedor
        FROM negocio.cobranca
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`o arranjo não alcançou a cobrança ${codigo} para ler os carimbos`);
    }

    return linha;
  });
}

/**
 * A versão da tupla (`xmin`) — o identificador da transação que gravou a linha como ela está agora.
 *
 * É o que separa *não alterou* de *reescreveu com o mesmo valor*, e o `CT-924 (c)` existe por causa
 * dessa distinção: um estorno sem a cláusula `AND pago_em IS NOT NULL` grava `NULL` sobre `NULL` nos
 * oito campos — o que passa em qualquer comparação de valores — e ainda assim reescreve a linha.
 *
 * ⚠️ **Ela é observação, não caminho de leitura de produto**: `xmin` é coluna de sistema e não aparece
 * em `negocio.cobranca_derivada`. Mesma forma, e mesma razão, de `lerXmin` em `cobranca.spec.ts` —
 * declarada aqui, e não importada, porque cada uma é uma consulta de uma linha sobre a relação que o
 * seu arquivo observa; o que se repete é a coluna de sistema, não um símbolo com contrato a endurecer.
 *
 * Não há `WHERE empresa_id`, e não pode haver: quem recorta é a política (ADR-0008).
 */
async function lerVersaoDaTupla(cenario: Cenario, codigo: string): Promise<string> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<{ versao: string }[]>`
      SELECT xmin::text AS versao FROM negocio.cobranca WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`o arranjo não alcançou a cobrança ${codigo} para ler a versão da tupla`);
    }

    return linha.versao;
  });
}

/**
 * Corre a liquidação e devolve **o desfecho declarado** — ou o rótulo do que veio no lugar dele.
 *
 * O eixo aqui não é a classe da recusa (isso é de {@link recusaDe}), é a **fronteira da união**:
 * `liquidarPeloProvedor` promete devolver `LIQUIDADA` ou `NAO_ESTAVA_EM_ABERTO`, e o defeito que o
 * `CT-922 (d)` fecha é justamente a entrada que escapava dos dois — a cobrança **cancelada** passava o
 * predicado do crédito, a baixa seguinte violava `cobranca_desfecho_unico_chk`, e o chamador recebia
 * `23514` cru.
 *
 * O `try`/`catch` mora **fora** de `emUnidade` de propósito: a violação do `check` aborta a transação,
 * e capturá-la por dentro só levaria a falha para o `COMMIT`. Aqui a unidade desfaz inteira — que é o
 * comportamento real — e o que se compara é o rótulo.
 */
async function desfechoDaLiquidacao(
  cenario: Cenario,
  codigo: string,
  liquidacao: LiquidacaoInformada,
): Promise<string> {
  try {
    return await emUnidade(
      cenario,
      async (tx) => await liquidarPeloProvedor(tx, codigo, liquidacao),
    );
  } catch (erro) {
    return `${RECUSA_FORA_DA_UNIAO}: ${erro instanceof Error ? erro.message : String(erro)}`;
  }
}

/** A recusa como corpo comparável — **classe**, o que ela diz de si, a cobrança e o ato. */
interface RetratoDaRecusa {
  readonly classe: string;
  readonly dito: string;
  readonly codigo: string | null;
  readonly ato: string | null;
}

/**
 * Corre a escrita e devolve o **retrato** da recusa — ou o rótulo de que ela não houve.
 *
 * O eixo é a **classe**: a porta precisa recusar com um tipo que o chamador reconheça em runtime,
 * porque a recusa por não-alcance é definitiva (repetir a tarefa não muda nada) enquanto a falha de
 * driver é transitória e a fila deve mesmo repeti-la. Uma asserção só sobre a mensagem passaria com um
 * `Error` genérico, que é exatamente a forma que o Gate 2 julgou insuficiente nas duas portas irmãs
 * desta fatia (`ErroDeLoteNaoAlcancado`, `ErroDeConferenciaNaoAlcancada`).
 *
 * O ramo {@link SEM_RECUSA} é o que faz a asserção reprovar quando a escrita que não deveria alcançar
 * linha alguma passa **em silêncio**, e o ramo {@link OUTRA_RECUSA} é o que a faz reprovar **nomeando o
 * que veio no lugar** em vez de dizer só que os objetos diferem.
 *
 * ⚠️ **Ela devolve o retrato composto, e não um `Resultado<T>` genérico**, e a escolha é deliberada:
 * `tentar` já tem **dez** cópias em `packages/db/test/` — medido, não estimado, por
 * `grep -rln 'async function tentar<T>' packages/db/test/ | wc -l`, e entre elas estão
 * `emissao-em-lote.spec.ts` e `conferencia-bancaria.spec.ts`. O **limiar de três** do `CLAUDE.md`,
 * portanto, disparou há muito, e escrever aqui a décima-primeira cópia só agravaria a divergência que
 * ele existe para evitar; fechá-lo de verdade é subir o símbolo para casa compartilhada, o que
 * alteraria dez suítes já aprovadas, todas fora da lista de arquivos desta rodada. O que fica aqui é um
 * `try`/`catch`, que é construção da linguagem, e não um símbolo duplicado a endurecer.
 */
async function recusaDe(escrita: () => Promise<unknown>): Promise<RetratoDaRecusa> {
  try {
    await escrita();

    return { classe: SEM_RECUSA, dito: SEM_RECUSA, codigo: null, ato: null };
  } catch (erro) {
    if (erro instanceof ErroDeCobrancaNaoAlcancada) {
      return {
        classe: CLASSE_NAO_ALCANCADA,
        dito: erro.message,
        codigo: erro.codigo,
        ato: erro.ato,
      };
    }

    return {
      classe: OUTRA_RECUSA,
      dito: erro instanceof Error ? erro.message : `SEM MENSAGEM: ${String(erro)}`,
      codigo: null,
      ato: null,
    };
  }
}
