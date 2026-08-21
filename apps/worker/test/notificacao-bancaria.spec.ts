/**
 * A **borda do tratamento da notícia bancária** — o job entra pela fila real, a empresa nasce do
 * registro que o roteamento resolve, e a **consulta ao provedor** decide o efeito. T7 da fatia
 * `webhook-e-carne`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-05    | CT-974  | Cinco notícias com identificadores que não casam com cobrança alguma
 * |          |         | terminam **todas** `SEM_CORRESPONDENCIA`, com a tarefa `completed`, e o
 * |          |         | contador de `consultarSituacao` da porta fica em **zero** — mesmo havendo
 * |          |         | cobrança real com boleto vivo no banco. O que não casa morre **antes** de
 * |          |         | qualquer consulta (RN-06), e é isso que impede uma remessa forjada de
 * |          |         | consumir cota da integração. |
 * | CA-05    | CT-974  | A carga com campo a mais é recusada por `strictObject` **antes de qualquer
 * |          | (b)     | leitura**: a tarefa termina `failed`, a razão nomeia `empresaId` e **não**
 * |          |         | ecoa o valor dele, e a linha crua permanece `RECEBIDO` com `tratado_em`
 * |          |         | nulo. É o campo que a ADR-0024 proíbe nesta carga. |
 * | CA-08    | CT-975  | Aviso com o identificador **correto** e o número do título com um dígito
 * |          |         | trocado termina `DIVERGENTE`, com **um** evento `NOTICIA_RECUSADA` de
 * |          |         | `origem: 'NOTICIA_DO_PROVEDOR'` na trilha, **zero** consultas, e a linha da
 * |          |         | cobrança **idêntica** antes e depois por igualdade profunda de `to_jsonb`.
 * |          |         | A linha de `warn` nomeia `campoDivergente` — o nome do **produto** — e
 * |          |         | nenhum evento do journal carrega o valor recebido (§13.1). |
 * | CA-08    | CT-975  | **Reentrada.** A MESMA notícia tratada uma segunda vez: a trilha continua
 * |          | (b)     | com **um** `NOTICIA_RECUSADA`, o desfecho continua `DIVERGENTE` com o
 * |          |         | `tratado_em` da PRIMEIRA passada, e o contador da porta continua em zero.
 * |          |         | `negocio.evento_bancario` não tem chave única sobre
 * |          |         | `(cobranca_id, tipo, origem)` — nada abaixo da borda impede o item
 * |          |         | duplicado, e é a lista ordenada desta trilha que o `CT-983` publica. |
 * | CA-06    | CT-976  | Duas empresas na mesma conta do provedor, tratadas na mesma execução: cada
 * |          |         | efeito cai na cobrança certa, e sob o contexto de **A** a cobrança de **B**
 * |          |         | é **vazio** — não erro, vazio, que é como a política responde (ADR-0008). |
 * | CA-07    | CT-977  | Aviso da empresa **A** acrescido de um campo que nomeia a empresa **B**: o
 * |          |         | efeito é gravado sob o contexto de **A**, a cobrança de B não se move, e o
 * |          |         | campo extra sobrevive **apenas** no `recebido` cru. Uma origem externa
 * |          |         | jamais escolhe o isolamento (ADR-0035). |
 * | CA-04    | CT-978  | Aviso **válido** alegando recebimento, com a porta respondendo `EM_ABERTO`:
 * |          |         | `pago_em` e `valor_pago` permanecem nulos, **nenhum** evento
 * |          |         | `COBRANCA_LIQUIDADA` nasce, o desfecho é `CONFERIDO_SEM_EFEITO` — e a
 * |          |         | consulta **aconteceu** (contador em 1), que é o que prova o ramo. |
 * | —        | CT-978  | Provedor indisponível: a tarefa termina `failed`, o desfecho **não** é
 * |          | (b)     | gravado (a linha segue `RECEBIDO`, `tratado_em` nulo), a razão nomeia o
 * |          |         | `notificacaoId` e **nada** do material do certificado aparece nela. |
 * | —        | CT-978  | Empresa **sem certificado vigente** (admitida pela porta de produção e sem
 * |          | (c)     | `registrarCertificado` algum): a tarefa termina `failed`, a razão nomeia o
 * |          |         | `notificacaoId`, o desfecho **não** é gravado, e o contador da porta fica
 * |          |         | em **zero** — o único observável que separa este ramo do `CT-978 (b)`,
 * |          |         | em que a porta **é** alcançada e recusa. |
 * | CA-01    | CT-979  | Mesmo aviso, porta respondendo `LIQUIDADO` com data e valor **diferentes dos
 * | CA-13    |         | que o aviso alega**: `pago_em`/`valor_pago` gravados são os **da consulta**,
 * |          |         | o evento `COBRANCA_LIQUIDADA` traz `origem: 'NOTICIA_DO_PROVEDOR'`, e o
 * |          |         | desfecho é `APLICADO`. É o par simétrico do CT-978 — junto com ele,
 * |          |         | discrimina *"o aviso decidiu"* de *"a consulta decidiu"*. |
 * | CA-01    | CT-979  | Valor informado diferente do esperado: a baixa acontece **assim mesmo**, e a
 * |          | (b)     | trilha ganha `DIVERGENCIA_DE_VALOR` **além** de `COBRANCA_LIQUIDADA`, com o
 * |          |         | valor informado publicado. Desfecho `APLICADO`. |
 * | CA-13    | CT-979  | Os outros dois efeitos que a consulta pode causar: `ESTORNADO` produz
 * |          | (c)     | `LIQUIDACAO_ESTORNADA` e devolve a cobrança ao aberto; `REVOGADO` produz
 * |          |         | `BOLETO_REVOGADO` com o motivo **intacto**, zera o título e **apaga os bytes
 * |          |         | do disco**. Os dois com `origem: 'NOTICIA_DO_PROVEDOR'` e desfecho
 * |          |         | `APLICADO`. |
 * | CA-01    | CT-979  | **Reentrada.** A MESMA notícia já `APLICADO` tratada uma segunda vez: o
 * |          | (d)     | desfecho **continua** `APLICADO` com o `tratado_em` da primeira passada, o
 * |          |         | contador da porta **não avança** (segue em 1), e a cobrança e a trilha
 * |          |         | ficam idênticas. Sem a guarda de estado da borda, a segunda passada
 * |          |         | reconsulta e reescreve `APLICADO` com `CONFERIDO_SEM_EFEITO` — apagando
 * |          |         | justamente o registro que a camada 1 da idempotência lê. |
 * | CA-21    | CT-993  | Motivo arbitrário e inventado no campo que diverge: a coluna de diagnóstico
 * |          |         | da linha crua **e** o diagnóstico do evento contêm a cadeia **exata**,
 * |          |         | caractere a caractere, sem substituição por rótulo do produto e sem
 * |          |         | truncamento. |
 * | CA-04    | CT-1006 | Cobrança com boleto **revogado pela via legítima** (título nulo,
 * | CA-08    |         | identificador vivo) e notícia com esse identificador: desfecho
 * |          |         | `CONFERIDO_SEM_EFEITO`, **uma** consulta ao provedor e **zero** eventos
 * |          |         | `NOTICIA_RECUSADA`, com a cobrança inalterada. |
 *
 * | CA-09    | CT-980  | Segundo aviso com o **mesmo** identificador da liquidação, depois de um
 * |          |         | `APLICADO`: desfecho `REENTREGA`, o contador da porta **não sobe**, a
 * |          |         | cobrança fica idêntica por `to_jsonb` e a trilha por igualdade da lista.
 * |          |         | É a **camada 1** — barata, e a que some com o expurgo dos 90 dias. |
 * | CA-09    | CT-981  | `liquidarPeloProvedor` chamado **direto** sobre cobrança já paga devolve
 * |          |         | `NAO_ESTAVA_EM_ABERTO`, e nem a linha nem a trilha se movem. É a
 * |          |         | **camada 2** — estrutural e sem prazo. O par com o CT-980 é o que prova
 * |          |         | que **as duas** existem e que nenhuma delas é a única. |
 * | CA-12    | CT-988  | Cru de **91** dias, envelhecido pelo relógio do **banco**, deixa de existir
 * |          |         | no expurgo que uma notícia recente dispara — e o evento que ele produziu
 * |          |         | continua **íntegro** na trilha. A linha de `info` publica a contagem. |
 * | CA-12    | CT-989  | Cru de **89** dias permanece **intacto**, linha inteira por igualdade. O par
 * |          |         | com o CT-988 fixa o corte exato: *"1 e 100"* passaria em qualquer corte
 * |          |         | entre os dois, e **89 × 91** não. |
 * | CA-12    | CT-988  | Com o papel da aplicação **sem privilégio de remoção** sobre a tabela crua,
 * |          | (b)     | o expurgo falha com `42501`, a tarefa termina **`completed`**, o desfecho
 * |          |         | `APLICADO` permanece gravado e a falha sai em `warn` com o **código** da
 * |          |         | recusa — nunca a mensagem do driver. |
 * | CA-09    | CT-988  | Depois de o cru ser expurgado, a reentrega do mesmo identificador **consulta**
 * |          | (c)     | o provedor (a camada 1 não tem mais o que ler) e termina
 * |          |         | `CONFERIDO_SEM_EFEITO`, sem evento novo: é a **camada 2** assumindo. |
 * | CA-01    | CT-990  | Tratamento completo mais uma falha com o claro em escopo: **zero** ocorrências
 * | CA-04    |         | do material, da senha, da chave de cifra e do corpo recebido nos **quatro**
 * |          |         | canais (§11.6) — argumentos da porta sem o portador, carga da fila
 * |          |         | serializada, journal linha a linha e `failedReason` —, com **controle
 * |          |         | positivo canal a canal** afirmado por igualdade antes de qualquer ausência. |
 *
 * | CA-10    | CT-984  | Aviso de cobrança de empresa **suspensa pelas portas do Master**: desfecho
 * |          |         | `RETIDO`, contador da porta em **zero**, cobrança **idêntica** à
 * |          |         | fotografia por `to_jsonb`, pagamento nulo e trilha vazia. E `tratado_em`
 * |          |         | **preenchido** — a bicondicional do `check` o exige de todo desfecho que
 * |          |         | não é `RECEBIDO` —, o que torna o campo inservível como discriminador de
 * |          |         | reentrância. |
 * | CA-10    | CT-984  | **A retenção não é conclusão.** Reativada a empresa, a MESMA linha crua —
 * |          |         | com o mesmo `tratado_em` já gravado — é tratada de novo pela fila real e
 * |          |         | chega a `APLICADO`, com **uma** consulta e o evento `COBRANCA_LIQUIDADA`
 * |          |         | na trilha. É o par que barra o curto-circuito por `tratado_em IS NOT NULL`. |
 *
 * Rastreabilidade: `CA-05 → CT-974 (RN-06)` · `CA-08 → CT-975, CT-1006 (RN-05)` ·
 * `CA-06 → CT-976 (RN-04)` · `CA-07 → CT-977 (RN-04)` · `CA-04 → CT-978, CT-1006 (RN-07)` ·
 * `CA-01 → CT-979, CT-990 (RN-07)` · `CA-13 → CT-979 (RN-13)` · `CA-21 → CT-993 (RN-18)` ·
 * `CA-09 → CT-980, CT-981, CT-988 (c) (RN-08)` · `CA-12 → CT-988, CT-989, CT-988 (b) (RN-11)` ·
 * `CA-04 → CT-990 (ADR-0032)` · `CA-10 → CT-984 (RN-09)`.
 *
 * ⚠️ **Os sufixos `(b)` e `(c)` não são estilo, e sim a única forma disponível**: a faixa
 * `CT-967`…`CT-1006` está inteiramente reservada pelos cards desta fatia, e reusar um identificador
 * produziria duas coisas diferentes com o mesmo nome. É a mesma escolha, e a mesma razão, de
 * `CT-948 (b)` em `./conferencia-bancaria.spec.ts`.
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO EXISTE PARA DISCRIMINAR
 * ===========================================================================
 *
 * Duas coisas, e as duas só se provam em **par**:
 *
 *   1. **quem decide o efeito.** O CT-978 e o CT-979 mandam o **mesmo** aviso e mudam apenas o que a
 *      porta responde. Se o aviso decidisse, os dois gravariam a baixa; se a consulta decide, só o
 *      segundo grava — e com **os valores dela**, que o arranjo faz **diferentes** dos que o aviso
 *      alega, para que a fonte do dado seja observável e não presumida;
 *   2. **quem escolhe a empresa.** O CT-976 e o CT-977 são a outra metade: o primeiro prova que dois
 *      avisos de empresas diferentes caem cada um na sua carteira; o segundo acrescenta ao aviso um
 *      campo que **nomeia a outra empresa** e prova que ele não move nada. Sozinho, cada um passaria
 *      num produto que lesse empresa do payload — o par não passa.
 *
 * E o contador da porta em **zero** (CT-974, CT-975) só significa alguma coisa porque o CT-979 e o
 * CT-1006 provam, no mesmo arquivo e com a mesma porta, que ela **é** chamada quando deve ser: sem
 * eles, um produto que nunca consultasse o provedor satisfaria os dois primeiros.
 *
 * A terceira, acrescentada depois e provada também em par:
 *
 *   3. **o que a segunda passada faz.** O `CT-979 (d)` e o `CT-975 (b)` executam a **mesma** tarefa
 *      duas vezes sobre a **mesma** `notificacaoId` — que é, do ponto de vista da borda,
 *      indistinguível da reentrega da fila. O primeiro afirma que o desfecho `APLICADO` **não
 *      regride** e que a cota do provedor não avança; o segundo, que a anomalia **não** é
 *      republicada na trilha. Os dois afirmam, junto, que o `tratado_em` continua sendo o da passada
 *      que concluiu — e é esse instante que separa *"não mudou de valor"* de *"não correu de novo"*.
 *
 * A quarta, da T8, e o **par** é de novo o que dá conteúdo a cada metade:
 *
 *   4. **quem impede a repetição.** São três camadas, e cada caso mede **uma** delas com as outras
 *      fora do caminho. O `CT-980` mede a camada 1 pelo contador que **não sobe**; o `CT-981` mede a
 *      camada 2 chamando a porta **direto**, sem tarefa nenhuma; e o `CT-988 (c)` mede as duas em
 *      composição, expurgando o cru para que a camada 1 **não possa** responder e afirmando que a
 *      consulta aconteceu assim mesmo. Sozinho, o `CT-980` passaria num produto cuja única defesa
 *      fosse a camada 1 — que some com o expurgo; sozinho, o `CT-981` não diria nada sobre cota.
 *
 * ⚠️ **A camada 3 já está medida, e não ganha caso novo nesta task.** O discriminador de reentrância
 * é a guarda de estado da borda, instalada na T7, e o `CT-979 (d)` e o `CT-975 (b)` a exercitam:
 * a mesma tarefa, sobre a mesma linha crua, sem regredir o desfecho, sem gastar cota e sem
 * republicar a anomalia. Escrever um terceiro caso sobre o mesmo caminho seria duplicação semântica
 * (AP-26), e não cobertura nova. O ramo que **falta** é a reexecução sobre `RETIDO` — e ele não é
 * alcançável hoje: nada grava aquele desfecho até a **T9**, que é quem acrescenta o estado à tupla
 * de pendentes e traz os `CT-985`/`CT-986`.
 *
 * > **Emenda da T9 (2026-08-18).** O parágrafo acima é preservado, e o que ele declarava inalcançável
 * > passou a ser alcançável: o passo B.6 grava `RETIDO`, e a segunda metade do `CT-984` exercita
 * > exatamente a **reexecução sobre `RETIDO`** que faltava — a mesma linha crua, com `tratado_em` já
 * > gravado, tratada de novo e chegando ao efeito. É a quinta coisa que este arquivo discrimina, e
 * > ela também se prova em par: sozinha, a primeira metade (`RETIDO`, zero consultas) passaria num
 * > produto que descartasse a notícia da empresa suspensa; sozinha, a segunda não diria nada sobre
 * > efeito retido. O **gatilho** da retomada — o ato de reativar — não é exercitável daqui, porque
 * > `EmpresaService` vive sobre o arcabouço que este pacote não declara; quem o exercita é
 * > `apps/api/test/retomada-de-retidas.spec.ts`, com os `CT-985`/`CT-986`.
 *
 * ===========================================================================
 * NENHUM ESTADO É FORJADO — as duas precondições privilegiadas têm caminho legítimo
 * ===========================================================================
 *
 *   * **o contexto de tenant** nunca é fixado por este arquivo em torno do job: ele nasce dentro da
 *     borda, do `empresaId` que a função de roteamento devolveu. O `contextoDeTenant.executarCom`
 *     que aparece aqui é do **arranjo** e da **leitura**, e nunca do caminho sob prova;
 *   * **o par *identificador vivo × título nulo*** do CT-1006 é montado por `revogarBoleto`, a porta
 *     de produção, e **nunca** por `UPDATE` direto: é a revogação legítima que produz o estado que o
 *     caso exercita, e é o docblock dela que declara por que o identificador sobrevive.
 *
 * A T8 acrescenta **duas**, e as duas são declaradas no ponto de uso:
 *
 *   * **o `recebido_em` antigo** do `CT-988`/`CT-989` — a linha nasce por `registrarNotificacaoBancaria`
 *     e quem a **move** é o banco (`now()` menos o intervalo). O instante nunca vem do processo, que
 *     é o segundo eixo de relógio que a ADR-0026 fecha;
 *   * **a falha do expurgo** do `CT-988 (b)` — o privilégio de remoção é retirado do papel da
 *     aplicação, e a recusa é a do **servidor**. Nada é dublado, e o `catch` da borda é exercitado
 *     pela mesma instrução que corre em operação.
 *
 * A porta do provedor é uma **implementação de verificação** da `AdaptadorCobrancaBancaria`
 * (ADR-0025), instrumentada para **contar chamadas e guardar os argumentos** — contagem de chamada é
 * efeito observável do SUT, e não valor que o próprio caso plantou. Não há mock de banco nem de HTTP.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import {
  type AdaptadorCobrancaBancaria,
  type ConsultaDeSituacao,
  criarGuardaDeBoletos,
  type DesfechoDaOperacao,
  type GuardaDeBoletos,
  type SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  admitirEmpresa,
  contextoDeTenant,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  EMPRESA_B,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  encerrarSessoesDaEmpresa,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarBoletoDaCobranca,
  type LinhaDeEventoBancario,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerNotificacaoBancaria,
  lerTrilhaDaCobranca,
  liquidarPeloProvedor,
  type NotificacaoBancariaPersistida,
  reativarEmpresa,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  registrarNotificacaoBancaria,
  revogarBoleto,
  suspenderEmpresa,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import {
  type CargaDaNotificacaoBancaria,
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  FILA_DA_NOTIFICACAO_BANCARIA,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/db` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` daqueles manifestos.
// QUANDO FECHA: declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`,
//        ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type BancoMigrado,
  bancoEfemero,
  conexaoSuperusuaria,
} from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaNotificacaoBancaria } from '../src/fila.ts';
import { processarNotificacaoBancaria } from '../src/tarefas/notificacao-bancaria.ts';
import {
  agulhasDoSegredo,
  controleComAsAgulhas,
  ocorrenciasDe,
  rotulosDoControle,
  type Superficie,
  superficiesDoDiario,
} from './varredura-de-segredo.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso monta cadastros, cobranças com boleto e executa a tarefa pela fila real. */
const LIMITE_DO_CASO_MS = 180_000;

/** Limite para a tarefa alcançar estado terminal, folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo enquanto o job corre. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** O valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** Quantos dias à frente as cobranças vencem — folga que mantém a mora em zero. */
const DIAS_ATE_O_VENCIMENTO = 30;

/** O que o arranjo antepõe aos bytes do boleto, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** Quantos órfãos a remessa forjada do `CT-974` carrega. */
const ORFAOS_DA_REMESSA = 5;

/** O nome do campo que a recusa da carga tem de nomear (ADR-0024). Cadeia EXATA. */
const CAMPO_PROIBIDO_NA_CARGA = 'empresaId';

/** O valor do campo proibido — sentinela: nenhuma razão de falha pode contê-lo. */
const VALOR_DO_CAMPO_PROIBIDO = 'empresa-que-nao-pode-decidir-o-tenant';

/** Tentativas de uma tarefa que os cenários de falha reduzem — nas opções do ENFILEIRAMENTO. */
const UMA_TENTATIVA = 1;

/** O nome do campo do PRODUTO que a linha de recusa por divergência tem de nomear (§13.1). */
const CAMPO_DIVERGENTE_ESPERADO = 'numeroDoTituloNoProvedor';

/**
 * O número do cliente que a identidade do arranjo declara — o valor contra o qual a segunda metade
 * da RN-05 compara. Fixo, e igual ao que `registrarIdentidadeNoProvedor` semeia.
 */
const NUMERO_DO_CLIENTE_DO_ARRANJO = 33065;

/** O rótulo do nível de alerta, tal como `criarLogger` o emite — escrito à mão, nunca lido do SUT. */
const NIVEL_DE_AVISO = 'warn';

/**
 * O motivo **arbitrário e inventado** do `CT-993` — não existe em enum nenhum do produto.
 *
 * Ele viaja no campo que a conferência compara, que é o único do aviso cujo valor o produto lê. A
 * asserção é que ele chega **intacto** ao diagnóstico: nada o traduz, encurta ou substitui.
 */
const MOTIVO_INVENTADO_DO_PROVEDOR = 'BX-9911/motivo-que-o-produto-nao-conhece#ÇÃO';

/** O motivo com que o provedor informa a revogação no `CT-979 (c)` — opaco, e nada o lê. */
const MOTIVO_DA_REVOGACAO = 'titulo baixado por solicitacao do beneficiario';

// ---------------------------------------------------------------------------
// T8 — os vereditos do expurgo, da idempotência e da varredura de segredo
// ---------------------------------------------------------------------------

/**
 * A idade do cru que o `CT-988` espera ver descartado — **91**, um dia além do prazo de guarda.
 *
 * ⚠️ O par com {@link DIAS_DENTRO_DA_RETENCAO} é escolhido a **dois dias de distância**, e não como
 * *"1 e 100"*: é a proximidade que torna os dois casos capazes de reprovar um corte deslocado de um
 * dia, que é o mutante realista do predicado de expurgo.
 */
const DIAS_ALEM_DA_RETENCAO = 91;

/** A idade do cru que o `CT-989` espera ver intacto — **89**, um dia aquém do prazo de guarda. */
const DIAS_DENTRO_DA_RETENCAO = 89;

/** O papel com que a aplicação atende — é dele que o `CT-988 (b)` retira o privilégio de remoção. */
const PAPEL_DA_APLICACAO = 'sysloc_app';

/** O `SQLSTATE` com que o PostgreSQL recusa a instrução sem privilégio — cadeia EXATA. */
const CODIGO_DE_PRIVILEGIO_NEGADO = '42501';

/** O rótulo do nível informativo, tal como `criarLogger` o emite — escrito à mão, nunca lido do SUT. */
const NIVEL_DE_INFORMACAO = 'info';

/** A mensagem com que a borda publica o descarte do cru vencido — cadeia EXATA. */
const MENSAGEM_DO_EXPURGO = 'notícias bancárias cruas vencidas foram descartadas';

/** A mensagem com que a borda publica a **falha** do expurgo, sem derrubar o desfecho. */
const MENSAGEM_DA_FALHA_DO_EXPURGO =
  'o expurgo do recebido cru vencido falhou, e o desfecho já gravado permanece';

/** A mensagem que `fila.ts` emite ao registrar o objeto de exceção CRU de uma tarefa que falhou. */
const REGISTRO_DA_TAREFA_EM_FALHA = 'tarefa terminou em falha';

/** A exceção que a porta do `CT-990` levanta — nenhum segredo nela, de propósito. */
const FALHA_CRUA_DA_PORTA = 'o par remoto abortou a conexão durante a leitura da resposta';

/** O nome da agulha do corpo recebido — o dado pessoal que o journal não pode guardar (§13.1). */
const AGULHA_DO_RECEBIDO = 'nome do pagador no corpo recebido';

/**
 * Quantas agulhas o `CT-990` varre: **9**.
 *
 * Três por certificado (senha, material em base64 e recorte hexadecimal) vezes os **dois**
 * certificados que circularam, mais as duas da chave de cifra, mais a do corpo recebido. A contagem
 * é afirmada por igualdade: uma agulha que deixasse de ser montada faria a varredura olhar por menos
 * do que circulou, e a ausência resultante passaria por vacuidade.
 */
const AGULHAS_DO_CT990 = 9;

/** A recusa com que a porta responde no `CT-978 (b)` — indisponibilidade do lado do provedor. */
const RECUSA_DO_PROVEDOR = 'o par remoto encerrou o aperto de mão antes da resposta';

/** Os termos do contrato de apoio — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let diretorioDosBoletos: string;

/** O registrador de todos os consumidores deste arquivo — as linhas ficam observáveis em memória. */
let registrador: Logger;

/** As linhas que o registrador emitiu, na ordem — o journal do processo, como texto. */
const linhasDoJournal: string[] = [];

/** A chave que a composição raiz entrega à borda — 32 bytes sorteados por execução, nunca literal. */
const CHAVE_DE_CIFRA = randomBytes(32);

/** O contador que mantém documentos, códigos, títulos e identificadores distintos entre os cenários. */
let sequencia = 0;

/** A data que o provedor informa como a do pagamento — derivada do relógio do BANCO na subida. */
let DATA_DO_PAGAMENTO: string;

/** Uma data de pagamento **diferente** da anterior — o `CT-979` precisa das duas para discriminar. */
let DATA_ALTERNATIVA_DE_PAGAMENTO: string;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-boletos-t7-'));

  // `trace` é o nível mais baixo do vocabulário do projeto: nenhuma linha é filtrada, e a asserção
  // de ausência do recebido alcança o registro INTEIRO, não só o que passaria por `warn`.
  registrador = criarLogger({
    nivel: 'trace',
    destino: {
      write(linha: string): void {
        linhasDoJournal.push(linha);
      },
    },
  });

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

  // As duas datas saem do relógio do BANCO (ADR-0026) — nunca de `new Date()` do processo.
  DATA_DO_PAGAMENTO = await dataDeslocada(EMPRESA_A.id, -5);
  DATA_ALTERNATIVA_DE_PAGAMENTO = await dataDeslocada(EMPRESA_A.id, -9);

  // Âncora do arranjo: se as duas coincidissem, o `CT-979` deixaria de discriminar a fonte da data.
  expect(DATA_ALTERNATIVA_DE_PAGAMENTO).not.toBe(DATA_DO_PAGAMENTO);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-974 — a remessa de órfãos morre antes de qualquer consulta
// ===========================================================================

describe('CT-974 — o que não casa morre antes de qualquer consulta ao provedor', () => {
  it(
    'CT-974 — cinco identificadores sem correspondência terminam SEM_CORRESPONDENCIA, com zero consultas',
    async () => {
      // A cobrança real existe, e com boleto vivo: sem ela, "não achou" seria vacuidade — não
      // haveria o que achar em banco nenhum.
      const real = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      const forjadas: string[] = [];
      const identificadoresForjados: string[] = [];
      for (let indice = 0; indice < ORFAOS_DA_REMESSA; indice += 1) {
        const identificador = identificadorInexistente();

        identificadoresForjados.push(identificador);
        forjadas.push(await gravarCru(avisoDe(identificador, numeroDeTitulo())));
      }

      const desfechos: string[] = [];
      const identificadoresGravados: (string | null)[] = [];
      for (const notificacaoId of forjadas) {
        const tarefa = await executarTarefa(fila, { notificacaoId });

        // Desfecho de NEGÓCIO não é erro: a tarefa conclui. Uma que falhasse aqui reentregaria para
        // sempre sobre um corpo que nunca vai casar.
        expect(await tarefa.getState()).toBe('completed');

        const cru = await lerCru(notificacaoId);
        desfechos.push(cru.desfecho);
        identificadoresGravados.push(cru.identificadorPeranteOProvedor);
      }

      expect(desfechos).toEqual(
        Array.from({ length: ORFAOS_DA_REMESSA }, () => 'SEM_CORRESPONDENCIA'),
      );

      // ⚠️ A asserção central: **zero** consultas. É ela que diz que uma remessa forjada em massa não
      // consome cota da integração (RN-06). Ela só tem conteúdo porque o CT-979 e o CT-1006 provam,
      // com a MESMA porta, que ela é chamada quando deve ser.
      expect(adaptador.consultas).toEqual([]);

      // E o identificador que não casou fica GRAVADO na linha crua: é a observabilidade que esta
      // fatia entrega ao D34 · F4/T11 — o órfão deixa de ser invisível.
      //
      // ⚠️ Os **cinco**, por igualdade de LISTA contra os cinco forjados: valor, cardinalidade e
      // ordem de uma vez. Afirmar só o tipo do primeiro aprovaria cadeia vazia, rótulo fixo do
      // produto, e o identificador de **outra** notícia da mesma remessa — que é justamente a troca
      // que faria o operador atribuir o órfão à notícia errada.
      expect(identificadoresGravados).toEqual(identificadoresForjados);

      // A cobrança real não foi tocada por nenhuma das cinco.
      expect(await pagamentoDe(real)).toEqual({ pagoEm: null, valorPago: null });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-974 (b) — a carga com campo a mais é recusada nomeando o campo, e nada é tratado',
    async () => {
      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada por uma carga recusada');
      });
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(avisoDe(identificadorInexistente(), numeroDeTitulo()));

      const tarefa = await executarTarefa(
        fila,
        {
          notificacaoId,
          [CAMPO_PROIBIDO_NA_CARGA]: VALOR_DO_CAMPO_PROIBIDO,
        } as unknown as CargaDaNotificacaoBancaria,
        UMA_TENTATIVA,
      );

      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toBeTypeOf('string');
      // A razão nomeia a CHAVE excedente — é o que a `.claude/rules/contrato-publicado.md` cobra —,
      // e o campo é `empresaId` de propósito: é exatamente o que alguém acrescentaria "para a tarefa
      // não precisar rotear", e é o que a ADR-0024 proíbe.
      expect(tarefa.failedReason).toContain(CAMPO_PROIBIDO_NA_CARGA);
      // E NUNCA o valor: a razão fica gravada no servidor de fila e alcança o journal.
      expect(tarefa.failedReason).not.toContain(VALOR_DO_CAMPO_PROIBIDO);

      // A recusa aconteceu ANTES de qualquer leitura: a linha crua segue como nasceu.
      const cru = await lerCru(notificacaoId);
      expect({ desfecho: cru.desfecho, tratadoEm: cru.tratadoEm }).toEqual({
        desfecho: 'RECEBIDO',
        tratadoEm: null,
      });
      expect(adaptador.consultas).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-975 / CT-993 — a divergência recusa, registra e não toca a cobrança
// ===========================================================================

describe('CT-975 — a divergência do número do título recusa sem tocar a cobrança', () => {
  it(
    'CT-975 — o desfecho é DIVERGENTE, a trilha ganha NOTICIA_RECUSADA e a cobrança fica idêntica',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const antes = await retratoDaCobranca(cobranca);
      const linhasAntes = linhasDoJournal.length;

      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada por uma notícia divergente');
      });
      const fila = montarConsumidor(adaptador.porta);

      // Um dígito trocado no número do título — e o identificador **correto**, para que o roteamento
      // ache a cobrança e a divergência seja o único desvio.
      const informado = comUmDigitoTrocado(cobranca.numeroDoTitulo);
      expect(informado).not.toBe(cobranca.numeroDoTitulo);

      const notificacaoId = await gravarCru(avisoDe(cobranca.identificador, informado));
      const tarefa = await executarTarefa(fila, { notificacaoId });

      expect(await tarefa.getState()).toBe('completed');
      expect((await lerCru(notificacaoId)).desfecho).toBe('DIVERGENTE');

      // ⚠️ Zero consultas: a recusa acontece ANTES da rede. Uma implementação que consultasse e só
      // depois comparasse gastaria cota com uma notícia que já se sabia recusada.
      expect(adaptador.consultas).toEqual([]);

      // A cobrança INTEIRA, por igualdade profunda da linha: é ela que separa "recusou" de "recusou
      // e mexeu em alguma coluna". `to_jsonb` alcança toda coluna, inclusive as que ninguém pensou.
      expect(await retratoDaCobranca(cobranca)).toEqual(antes);

      // A trilha: **um** evento, e a anomalia é do tipo e da origem novos (ADR-0034).
      const trilha = await lerTrilha(cobranca);
      const recusas = trilha.filter((evento) => evento.tipo === 'NOTICIA_RECUSADA');
      expect(recusas.length).toBe(1);
      expect(recusas[0]?.origem).toBe('NOTICIA_DO_PROVEDOR');

      // ---------------------------------------------------------------------------------------
      // O JOURNAL: o nome do campo do PRODUTO, e NADA do valor recebido (§13.1)
      // ---------------------------------------------------------------------------------------
      const emitidas = linhasDoJournal
        .slice(linhasAntes)
        .map((linha) => JSON.parse(linha) as Record<string, unknown>);

      // Âncora antivácuo: sem linha alguma, a asserção de ausência abaixo passaria por vacuidade.
      expect(emitidas.length).toBeGreaterThan(0);

      const avisos = emitidas.filter((evento) => evento.nivel === NIVEL_DE_AVISO);
      expect(avisos.length).toBe(1);
      expect(avisos[0]?.campoDivergente).toBe(CAMPO_DIVERGENTE_ESPERADO);

      for (const evento of emitidas) {
        expect(JSON.stringify(evento)).not.toContain(informado);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-975 (b) — a segunda passada sobre a MESMA notícia não republica a anomalia na trilha',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada por uma notícia divergente');
      });
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, comUmDigitoTrocado(cobranca.numeroDoTitulo)),
      );

      // --- A primeira passada, que é o CT-975 e conclui normalmente -------------------------
      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      const depoisDaPrimeira = await lerCru(notificacaoId);
      expect(depoisDaPrimeira.desfecho).toBe('DIVERGENTE');
      expect(
        (await lerTrilha(cobranca)).filter((evento) => evento.tipo === 'NOTICIA_RECUSADA').length,
      ).toBe(1);

      // --- A SEGUNDA passada, com a mesma carga: é a reentrega da fila, do ponto de vista da
      //     borda. Ela não pode ser distinguida por nada que o arranjo faça — é a mesma tarefa,
      //     sobre a mesma linha crua, e o único discriminador legítimo é o estado gravado.
      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      // ⚠️ **UM** `NOTICIA_RECUSADA`, e não dois. `negocio.evento_bancario` não tem chave única sobre
      // `(cobranca_id, tipo, origem)`, de modo que nada abaixo desta borda impede o item duplicado —
      // e é a lista ordenada exata desta trilha que o `CT-983` publica.
      expect(
        (await lerTrilha(cobranca)).filter((evento) => evento.tipo === 'NOTICIA_RECUSADA').length,
      ).toBe(1);

      // O carimbo é o da PRIMEIRA passada, instante inclusive: `marcarDesfecho` grava `now()` sem
      // predicado de estado, então um `tratado_em` que avançou é a assinatura de a segunda passada
      // ter corrido o caminho inteiro.
      const depoisDaSegunda = await lerCru(notificacaoId);
      expect({
        desfecho: depoisDaSegunda.desfecho,
        tratadoEm: depoisDaSegunda.tratadoEm?.toISOString(),
      }).toEqual({
        desfecho: 'DIVERGENTE',
        tratadoEm: depoisDaPrimeira.tratadoEm?.toISOString(),
      });

      // E nenhuma das duas passadas gastou cota do provedor.
      expect(adaptador.consultas).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-993 — o motivo que o produto não reconhece chega intacto ao diagnóstico',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada por uma notícia divergente');
      });
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, MOTIVO_INVENTADO_DO_PROVEDOR),
      );
      const tarefa = await executarTarefa(fila, { notificacaoId });

      expect(await tarefa.getState()).toBe('completed');

      const cru = await lerCru(notificacaoId);
      expect(cru.desfecho).toBe('DIVERGENTE');

      // ⚠️ A cadeia EXATA, caractere a caractere: nada a traduziu para um rótulo do produto, nada a
      // encurtou e nada a normalizou. É o mutante que mapearia motivo desconhecido para 'OUTRO'.
      expect(cru.diagnostico).toBeTypeOf('string');
      expect(cru.diagnostico ?? '').toContain(MOTIVO_INVENTADO_DO_PROVEDOR);

      // E o mesmo texto atravessa até a trilha publicada — os dois pontos, porque são duas colunas.
      const recusa = (await lerTrilha(cobranca)).find(
        (evento) => evento.tipo === 'NOTICIA_RECUSADA',
      );
      expect(recusa?.diagnostico ?? '').toContain(MOTIVO_INVENTADO_DO_PROVEDOR);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-976 / CT-977 — a conta compartilhada não mistura carteiras
// ===========================================================================

describe('CT-976 — duas empresas na mesma conta do provedor', () => {
  it(
    'CT-976 — cada efeito cai na cobrança certa, e sob o contexto de A a cobrança de B é vazio',
    async () => {
      const deA = await semearCobranca(EMPRESA_A.id);
      const deB = await semearCobranca(EMPRESA_B.id);

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      // Um aviso de cada empresa, na MESMA execução — o cenário que a conta compartilhada produz.
      const daA = await gravarCru(avisoDe(deA.identificador, deA.numeroDoTitulo));
      const daB = await gravarCru(avisoDe(deB.identificador, deB.numeroDoTitulo));

      expect(await (await executarTarefa(fila, { notificacaoId: daA })).getState()).toBe(
        'completed',
      );
      expect(await (await executarTarefa(fila, { notificacaoId: daB })).getState()).toBe(
        'completed',
      );

      expect((await lerCru(daA)).desfecho).toBe('APLICADO');
      expect((await lerCru(daB)).desfecho).toBe('APLICADO');

      // Cada efeito na sua carteira, lido sob o contexto da própria empresa.
      expect(await pagamentoDe(deA)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });
      expect(await pagamentoDe(deB)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });

      // ⚠️ E a asserção que discrimina: sob o contexto de **A**, a cobrança de **B** é **vazio** — não
      // erro, vazio, que é como a política forçada responde (ADR-0008). Sem ela, um produto que
      // corresse sem contexto nenhum satisfaria as duas leituras acima.
      expect(await retratoDaCobrancaSob(EMPRESA_A.id, deB.identificador)).toBeUndefined();
      expect(await retratoDaCobrancaSob(EMPRESA_B.id, deA.identificador)).toBeUndefined();

      // A empresa que a borda apresentou ao provedor é a do ROTEAMENTO, em toda chamada — e são duas
      // empresas distintas, o que reprova um produto que fixasse uma delas.
      expect(
        [...new Set(adaptador.consultas.map((consulta) => consulta.empresaId))].sort(),
      ).toEqual([EMPRESA_A.id, EMPRESA_B.id].sort());
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-977 — o campo do recebido que sugere outra empresa não move nada',
    async () => {
      const deA = await semearCobranca(EMPRESA_A.id);
      const deB = await semearCobranca(EMPRESA_B.id);
      const antesDeB = await retratoDaCobranca(deB);

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      // O aviso é da cobrança de **A**, e traz um campo que **nomeia a empresa B**. É a forma mais
      // curta de uma origem externa tentar escolher o tenant (ADR-0035, alternativa rejeitada nº 3).
      const aviso = {
        ...avisoDe(deA.identificador, deA.numeroDoTitulo),
        empresaId: EMPRESA_B.id,
        empresa: EMPRESA_B.id,
      };
      const notificacaoId = await gravarCru(aviso);

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');
      expect((await lerCru(notificacaoId)).desfecho).toBe('APLICADO');

      // O efeito caiu em **A**, e **B** não se moveu — por igualdade profunda da linha inteira.
      expect(await pagamentoDe(deA)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });
      expect(await retratoDaCobranca(deB)).toEqual(antesDeB);

      // A consulta foi feita em nome de **A**, e de mais ninguém.
      expect(adaptador.consultas.map((consulta) => consulta.empresaId)).toEqual([EMPRESA_A.id]);

      // E o campo extra sobrevive **apenas** no cru, como diagnóstico: guardar o que não se entende é
      // a RN-02, e nada disso influenciou coisa alguma.
      expect(await recebidoDe(notificacaoId)).toEqual(aviso);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-978 / CT-979 — quem decide é a consulta, e não o aviso
// ===========================================================================

describe('CT-978 — o aviso forjado não move dinheiro', () => {
  it(
    'CT-978 — com a porta respondendo EM_ABERTO, nada é pago e o desfecho é CONFERIDO_SEM_EFEITO',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'EM_ABERTO',
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      // O aviso ALEGA recebimento — os campos que o provedor manda numa baixa —, e a consulta o
      // contradiz. Vale a consulta, sempre (RN-07 / CA-04).
      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');
      expect((await lerCru(notificacaoId)).desfecho).toBe('CONFERIDO_SEM_EFEITO');

      // O dinheiro NÃO se moveu.
      expect(await pagamentoDe(cobranca)).toEqual({ pagoEm: null, valorPago: null });

      // E **nenhum** evento de liquidação nasceu — o par com a linha acima separa "não pagou" de
      // "não pagou e anunciou que pagou".
      expect((await lerTrilha(cobranca)).map((evento) => evento.tipo)).not.toContain(
        'COBRANCA_LIQUIDADA',
      );

      // ⚠️ A consulta ACONTECEU: é o que prova que o caso passou pelo ramo certo, e não que a tarefa
      // desistiu antes. Sem esta linha, um produto que nunca consultasse satisfaria as anteriores.
      expect(adaptador.consultas.length).toBe(1);
      expect(adaptador.consultas[0]?.incluirDocumento).toBe(false);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-978 (b) — com o provedor indisponível a tarefa FALHA e o desfecho não é gravado',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueRecusa();
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );
      const tarefa = await executarTarefa(fila, { notificacaoId }, UMA_TENTATIVA);

      // ⚠️ Aqui — e SÓ aqui — falhar é o certo: nada foi decidido, e a fila é quem tenta de novo.
      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toContain(notificacaoId);

      // O desfecho NÃO foi gravado: a linha segue esperando um tratamento que ainda vai acontecer.
      const cru = await lerCru(notificacaoId);
      expect({ desfecho: cru.desfecho, tratadoEm: cru.tratadoEm }).toEqual({
        desfecho: 'RECEBIDO',
        tratadoEm: null,
      });

      // A cobrança não se moveu, e o segredo do certificado não escapou pela razão da falha.
      expect(await pagamentoDe(cobranca)).toEqual({ pagoEm: null, valorPago: null });
      expect(tarefa.failedReason ?? '').not.toContain(cobranca.senhaDoCertificado);
      expect(tarefa.failedReason ?? '').not.toContain(
        cobranca.materialDoCertificado.toString('base64'),
      );

      // Âncora antivácuo do último par: a senha ESTEVE em escopo, porque a porta a recebeu.
      expect(adaptador.recebeuOSegredo).toBe(true);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-978 (c) — sem certificado vigente a tarefa FALHA sem sequer alcançar a porta',
    async () => {
      // Uma empresa **própria**, que nunca registrou certificado: a ausência é estado de empresa, e
      // não de cobrança. O cenário real não é *"a empresa não configurou a integração"* — esse não é
      // alcançável, porque o roteamento casa por `identificador_no_provedor`, que só existe em
      // cobrança cujo boleto foi emitido, e emitir exige certificado. É o certificado **vencido
      // depois da emissão**: transitório, e por isso a tarefa reentrega em vez de concluir.
      const empresaSemCertificado = await admitirEmpresaNova(`t7-sem-cert-${String(proximo())}`);
      const cobranca = await semearCobrancaSemCertificado(empresaSemCertificado);

      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada sem certificado vigente da empresa');
      });
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );
      const tarefa = await executarTarefa(fila, { notificacaoId }, UMA_TENTATIVA);

      // Falhar é o certo, e pela mesma razão do `CT-978 (b)`: nada foi decidido, e a decisão é da
      // consulta — que não tem como acontecer. Carimbar `CONFERIDO_SEM_EFEITO` diria que se conferiu.
      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toContain(notificacaoId);

      // O desfecho NÃO foi gravado: a linha segue esperando o tratamento.
      const cru = await lerCru(notificacaoId);
      expect({ desfecho: cru.desfecho, tratadoEm: cru.tratadoEm }).toEqual({
        desfecho: 'RECEBIDO',
        tratadoEm: null,
      });

      // ⚠️ **A asserção que separa este ramo do `CT-978 (b)`**: lá a porta **é** alcançada e recusa;
      // aqui a borda para antes dela, porque não há segredo a apresentar. O contador em zero é o
      // único observável que discrimina os dois — os outros três são idênticos nos dois casos.
      expect(adaptador.consultas).toEqual([]);

      // E a cobrança não se moveu.
      expect(await pagamentoDe(cobranca)).toEqual({ pagoEm: null, valorPago: null });
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-979 — a consulta confirma, e o que se grava é o que ela informou', () => {
  it(
    'CT-979 — pago_em e valor_pago são os da CONSULTA, e o evento traz a origem nova',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      // A consulta responde data e valor CONHECIDOS e **diferentes** dos que o aviso alega — é isso,
      // e só isso, que discrimina a fonte do dado gravado.
      const valorDaConsulta = VALOR_DA_COBRANCA;
      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_ALTERNATIVA_DE_PAGAMENTO,
        valorPago: valorDaConsulta,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      const aviso = {
        ...avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
        dados: {
          ...avisoDe(cobranca.identificador, cobranca.numeroDoTitulo).dados,
          // O que o AVISO alega — e que não pode aparecer em coluna nenhuma.
          valorPagamento: VALOR_ALEGADO_PELO_AVISO,
          dataHoraSituacaoBaixa: `${DATA_DO_PAGAMENTO}T14:03:11Z`,
        },
      };
      const notificacaoId = await gravarCru(aviso);

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');
      expect((await lerCru(notificacaoId)).desfecho).toBe('APLICADO');

      // ⚠️ O que ficou gravado é o da CONSULTA — e é diferente do que o aviso alega, nas duas pontas.
      const pagamento = await pagamentoDe(cobranca);
      expect(pagamento).toEqual({
        pagoEm: DATA_ALTERNATIVA_DE_PAGAMENTO,
        valorPago: valorDaConsulta.toFixed(2),
      });
      expect(pagamento.pagoEm).not.toBe(DATA_DO_PAGAMENTO);
      expect(pagamento.valorPago).not.toBe(VALOR_ALEGADO_PELO_AVISO.toFixed(2));

      // A trilha: a liquidação com a ORIGEM nova, e nenhuma divergência de valor (a consulta trouxe
      // exatamente o esperado).
      const trilha = await lerTrilha(cobranca);
      expect(trilha.map((evento) => ({ tipo: evento.tipo, origem: evento.origem }))).toEqual([
        { tipo: 'COBRANCA_LIQUIDADA', origem: 'NOTICIA_DO_PROVEDOR' },
      ]);

      expect(adaptador.consultas.length).toBe(1);
      expect(adaptador.consultas[0]?.numeroDoTituloNoProvedor).toBe(cobranca.numeroDoTitulo);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-979 (b) — valor divergente não impede a baixa, e a trilha ganha DIVERGENCIA_DE_VALOR',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const valorDivergente = VALOR_DA_COBRANCA - 100;

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: valorDivergente,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');
      // O dinheiro entrou: a baixa acontece **assim mesmo** (CA-11).
      expect((await lerCru(notificacaoId)).desfecho).toBe('APLICADO');
      expect(await pagamentoDe(cobranca)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: valorDivergente.toFixed(2),
      });

      // Os DOIS eventos, e a divergência publica o valor informado.
      const trilha = await lerTrilha(cobranca);
      expect(
        trilha
          .map((evento) => ({ tipo: evento.tipo, origem: evento.origem }))
          .sort((a, b) => a.tipo.localeCompare(b.tipo)),
      ).toEqual([
        { tipo: 'COBRANCA_LIQUIDADA', origem: 'NOTICIA_DO_PROVEDOR' },
        { tipo: 'DIVERGENCIA_DE_VALOR', origem: 'NOTICIA_DO_PROVEDOR' },
      ]);
      expect(trilha.find((evento) => evento.tipo === 'DIVERGENCIA_DE_VALOR')?.valorInformado).toBe(
        valorDivergente,
      );
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-979 (d) — a segunda passada não regride o APLICADO nem gasta cota do provedor',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );

      // --- A primeira passada: o caminho feliz do CT-979, que aplica e carimba ---------------
      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      const depoisDaPrimeira = await lerCru(notificacaoId);
      expect(depoisDaPrimeira.desfecho).toBe('APLICADO');
      expect(adaptador.consultas.length).toBe(1);

      const retratoAposAPrimeira = await retratoDaCobranca(cobranca);
      const trilhaAposAPrimeira = (await lerTrilha(cobranca)).map((evento) => ({
        tipo: evento.tipo,
        origem: evento.origem,
      }));

      // --- A SEGUNDA passada, com a mesma carga ---------------------------------------------
      // ⚠️ Ela é alcançável **sem defeito nenhum** em produção: no ramo `REVOGADO` a unidade comita e
      // só depois corre `guarda.apagar`, que engole `ENOENT` e levanta o resto — a tarefa falha com
      // o fato já gravado, e a fila reentrega. A reentrega de tarefa travada alcança igualmente
      // `LIQUIDADO` e `ESTORNADO`.
      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      // ⚠️ **A asserção que discrimina.** Sem a guarda de estado na borda, a segunda passada
      // reconsultaria (o contador iria a 2), `liquidarPeloProvedor` recusaria pelo predicado
      // `pago_em IS NULL`, e `marcarDesfecho` — que é `UPDATE … WHERE id = $1`, **sem predicado de
      // estado** — reescreveria `APLICADO` com `CONFERIDO_SEM_EFEITO`. Esse é exatamente o registro
      // que a camada 1 da idempotência lê (`identificador_da_liquidacao = $1 AND desfecho =
      // 'APLICADO'`), e apagá-lo em silêncio faria a reentrega seguinte reaplicar.
      const depoisDaSegunda = await lerCru(notificacaoId);
      expect({
        desfecho: depoisDaSegunda.desfecho,
        // O carimbo é o da PRIMEIRA passada, instante inclusive: um `tratado_em` que avançou é a
        // assinatura de a segunda passada ter corrido o caminho até o fim.
        tratadoEm: depoisDaSegunda.tratadoEm?.toISOString(),
      }).toEqual({
        desfecho: 'APLICADO',
        tratadoEm: depoisDaPrimeira.tratadoEm?.toISOString(),
      });

      // A cota do provedor **não avançou** — é a mesma cota que a RN-06 protege no CT-974.
      expect(adaptador.consultas.length).toBe(1);

      // E nada mais se moveu: a cobrança por igualdade profunda da linha, e a trilha por igualdade
      // de lista — sem evento a mais.
      expect(await retratoDaCobranca(cobranca)).toEqual(retratoAposAPrimeira);
      expect(
        (await lerTrilha(cobranca)).map((evento) => ({
          tipo: evento.tipo,
          origem: evento.origem,
        })),
      ).toEqual(trilhaAposAPrimeira);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-979 (c) — o estorno e a revogação também nascem da consulta, com a mesma origem',
    async () => {
      // ⚠️ **UM consumidor só, e a situação muda por variável.** Três `montarConsumidor` sobre a
      // mesma fila deixariam três consumidores VIVOS ao mesmo tempo, e o servidor de fila entrega
      // cada tarefa a qualquer um deles: o caso mediria qual consumidor ganhou a corrida, não o que
      // a borda faz. Foi o defeito medido na primeira execução deste arquivo, e a razão de a
      // resposta da porta ser lida a cada chamada em vez de fixada na construção.
      let situacaoDoProvedor: SituacaoConsultada = {
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      };
      const adaptador = adaptadorQueResponde(() => situacaoDoProvedor);
      const fila = montarConsumidor(adaptador.porta);

      // --- ESTORNO: a cobrança já paga volta ao aberto ---------------------------------------
      const paga = await semearCobranca(EMPRESA_A.id);
      const baixa = await gravarCru(avisoDe(paga.identificador, paga.numeroDoTitulo));

      expect(await (await executarTarefa(fila, { notificacaoId: baixa })).getState()).toBe(
        'completed',
      );
      expect(await pagamentoDe(paga)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });

      situacaoDoProvedor = { situacao: 'ESTORNADO', documento: null };
      const estorno = await gravarCru(avisoDe(paga.identificador, paga.numeroDoTitulo));

      expect(await (await executarTarefa(fila, { notificacaoId: estorno })).getState()).toBe(
        'completed',
      );
      expect((await lerCru(estorno)).desfecho).toBe('APLICADO');
      expect(await pagamentoDe(paga)).toEqual({ pagoEm: null, valorPago: null });
      expect(
        (await lerTrilha(paga))
          .filter((evento) => evento.tipo === 'LIQUIDACAO_ESTORNADA')
          .map((evento) => evento.origem),
      ).toEqual(['NOTICIA_DO_PROVEDOR']);

      // --- REVOGAÇÃO: o título some, o motivo fica intacto e os BYTES saem do disco -----------
      const revogavel = await semearCobranca(EMPRESA_A.id);
      expect(await arquivoDoBoletoExiste(revogavel)).toBe(true);

      situacaoDoProvedor = {
        situacao: 'REVOGADO',
        motivo: MOTIVO_DA_REVOGACAO,
        documento: null,
      };
      const revogacao = await gravarCru(avisoDe(revogavel.identificador, revogavel.numeroDoTitulo));

      expect(await (await executarTarefa(fila, { notificacaoId: revogacao })).getState()).toBe(
        'completed',
      );
      expect((await lerCru(revogacao)).desfecho).toBe('APLICADO');

      const evento = (await lerTrilha(revogavel)).find((linha) => linha.tipo === 'BOLETO_REVOGADO');
      expect({ origem: evento?.origem, diagnostico: evento?.diagnostico }).toEqual({
        origem: 'NOTICIA_DO_PROVEDOR',
        diagnostico: MOTIVO_DA_REVOGACAO,
      });

      // O elo com o provedor se desfez, e a cobrança **permanece em aberto** (RN-09/RN-10).
      const depois = await retratoDaCobranca(revogavel);
      expect({
        titulo: depois?.numero_do_titulo_no_provedor,
        cancelada: depois?.cancelado_em,
        // ⚠️ E o identificador SOBREVIVE: é a chave por onde uma notícia atrasada ainda se liga a
        // esta cobrança — a decisão da fatia (ii) que o `CT-1006` exercita logo abaixo.
        identificador: depois?.identificador_no_provedor,
      }).toEqual({
        titulo: null,
        cancelada: null,
        identificador: revogavel.identificador,
      });

      // E os bytes saíram do disco — o efeito que nenhum outro caso deste arquivo alcança.
      expect(await arquivoDoBoletoExiste(revogavel)).toBe(false);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1006 — o terceiro ramo da conferência: ausência não é divergência
// ===========================================================================

describe('CT-1006 — título gravado NULO não é divergência', () => {
  it(
    'CT-1006 — a notícia atrasada de boleto revogado segue para a consulta, e não recusa',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);

      // ⚠️ A revogação é feita pela **via legítima** — `revogarBoleto`, a porta de produção —, e nunca
      // por `UPDATE` direto: é ela que produz o par *identificador vivo × título nulo* que o caso
      // exercita, e é o docblock dela que declara por que o identificador sobrevive.
      await emUnidade(EMPRESA_A.id, async (tx) => {
        const aplicada = await revogarBoleto(tx, cobranca.codigo);

        expect(aplicada.desfecho).toBe('REVOGADO');
      });

      // A precondição, AFIRMADA e não suposta: sem ela o caso mediria o ramo do título igual.
      const revogada = await retratoDaCobranca(cobranca);
      expect({
        titulo: revogada?.numero_do_titulo_no_provedor,
        identificador: revogada?.identificador_no_provedor,
      }).toEqual({ titulo: null, identificador: cobranca.identificador });

      const antes = await retratoDaCobranca(cobranca);

      const adaptador = adaptadorQueResponde(() => ({ situacao: 'EM_ABERTO', documento: null }));
      const fila = montarConsumidor(adaptador.porta);

      // A notícia chega **atrasada**, com o número de título que o provedor tinha atribuído.
      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      // ⚠️ A asserção que discrimina é a COMBINAÇÃO: **uma** consulta × **zero** `NOTICIA_RECUSADA`.
      // O mutante de duas pernas — comparar contra `NULL` e recusar — produz exatamente o oposto:
      // *(zero consultas) × (um `NOTICIA_RECUSADA`)*.
      expect(adaptador.consultas.length).toBe(1);
      expect((await lerTrilha(cobranca)).filter((e) => e.tipo === 'NOTICIA_RECUSADA')).toEqual([]);

      expect((await lerCru(notificacaoId)).desfecho).toBe('CONFERIDO_SEM_EFEITO');
      expect(await retratoDaCobranca(cobranca)).toEqual(antes);

      // E o número que foi ao provedor é o **recebido**, porque não havia gravado — é o único caso em
      // que a notícia é a única fonte da chave do provedor.
      expect(adaptador.consultas[0]?.numeroDoTituloNoProvedor).toBe(cobranca.numeroDoTitulo);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-980 / CT-981 — as duas primeiras camadas da idempotência, e nenhuma é a única
// ===========================================================================

describe('CT-980 — a reentrega da mesma liquidação não consulta o provedor de novo', () => {
  it(
    'CT-980 — o segundo aviso com o mesmo identificador da liquidação termina REENTREGA, sem consulta e sem tocar nada',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      // ⚠️ O `APLICADO` anterior é produzido pelo **caminho normal da tarefa**, e nunca por escrita
      // direta do desfecho: é a primeira notícia que de fato aplica a baixa, e é o registro dela que
      // a camada 1 vai consultar depois.
      const daLiquidacao = liquidacaoNova();
      const primeira = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo, daLiquidacao),
      );

      expect(await (await executarTarefa(fila, { notificacaoId: primeira })).getState()).toBe(
        'completed',
      );
      expect((await lerCru(primeira)).desfecho).toBe('APLICADO');
      expect(adaptador.consultas.length).toBe(1);

      // A fotografia, DEPOIS da primeira passada: é contra ela que a segunda é comparada.
      const retratoAntes = await retratoDaCobranca(cobranca);
      const trilhaAntes = await lerTrilha(cobranca);

      // --- A REENTREGA: outra linha crua, com o MESMO identificador da liquidação ---------------
      const segunda = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo, daLiquidacao),
      );
      expect(segunda).not.toBe(primeira);

      expect(await (await executarTarefa(fila, { notificacaoId: segunda })).getState()).toBe(
        'completed',
      );

      const cru = await lerCru(segunda);
      expect(cru.desfecho).toBe('REENTREGA');
      // Os dois identificadores ficam gravados na linha reentregue: é o que a liga ao fato original
      // para quem for auditar, e o que a mantém alcançável pelo mesmo índice parcial.
      expect({
        peranteOProvedor: cru.identificadorPeranteOProvedor,
        daLiquidacao: cru.identificadorDaLiquidacao,
      }).toEqual({ peranteOProvedor: cobranca.identificador, daLiquidacao });

      // ⚠️ **A asserção central**: o contador da porta NÃO subiu. É ela que diz que a reentrega não
      // consome cota da integração — e ela só tem conteúdo porque a passada anterior, com a mesma
      // porta, o fez subir para 1.
      expect(adaptador.consultas.length).toBe(1);

      // E nada se moveu: a cobrança por igualdade profunda da linha, e a trilha por igualdade da
      // lista inteira — nem um evento a mais.
      expect(await retratoDaCobranca(cobranca)).toEqual(retratoAntes);
      expect(await lerTrilha(cobranca)).toEqual(trilhaAntes);

      // A linha original permanece `APLICADO`: a reentrega não regride quem produziu o efeito.
      expect((await lerCru(primeira)).desfecho).toBe('APLICADO');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-981 — liquidarPeloProvedor recusa a segunda liquidação e não publica evento algum',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      // A cobrança fica paga pelo **caminho legítimo** — a tarefa inteira, com a consulta decidindo.
      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );

      expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

      const pagamentoAntes = await pagamentoDe(cobranca);
      expect(pagamentoAntes).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });

      const retratoAntes = await retratoDaCobranca(cobranca);
      const trilhaAntes = await lerTrilha(cobranca);

      // --- A SEGUNDA liquidação, direto na porta: é a camada 2, e ela é ESTRUTURAL --------------
      // ⚠️ A chamada é direta de propósito. A camada 1 e a camada 3 ficam fora do caminho, e o que se
      // mede é o `UPDATE … WHERE pago_em IS NULL` sozinho — a garantia que **não tem prazo** e que
      // continua valendo depois de o cru dos 90 dias ter sido expurgado.
      const desfecho = await emUnidade(
        cobranca.empresaId,
        async (tx) =>
          await liquidarPeloProvedor(tx, cobranca.codigo, {
            // Valores DIFERENTES dos gravados: se a porta aplicasse, a diferença apareceria.
            pagoEm: DATA_ALTERNATIVA_DE_PAGAMENTO,
            valorPago: VALOR_ALEGADO_PELO_AVISO.toFixed(2),
            dataDoCredito: DATA_ALTERNATIVA_DE_PAGAMENTO,
            valorCreditado: VALOR_ALEGADO_PELO_AVISO.toFixed(2),
          }),
      );

      // ⚠️ O desfecho ESPECÍFICO, e não "não liquidou": a ausência de retorno do `UPDATE` **é** o
      // resultado, e não um erro — a porta o devolve como valor, e é por isso que nenhum evento nasce.
      expect(desfecho).toBe('NAO_ESTAVA_EM_ABERTO');

      // Nada mudou: pagamento, linha inteira e trilha inteira, por igualdade.
      expect(await pagamentoDe(cobranca)).toEqual(pagamentoAntes);
      expect(await retratoDaCobranca(cobranca)).toEqual(retratoAntes);
      expect(await lerTrilha(cobranca)).toEqual(trilhaAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-988 / CT-989 — o expurgo oportunista dos 90 dias, e o corte exato
// ===========================================================================

describe('CT-988 — o cru vencido é descartado a cada tratamento, e o efeito dele permanece', () => {
  it(
    'CT-988 — o cru de 91 dias deixa de existir, e o evento que ele produziu continua íntegro na trilha',
    async () => {
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const vencida = await semearCobranca(EMPRESA_A.id);
      const doVencido = await tratarAviso(fila, vencida);

      expect((await lerCru(doVencido)).desfecho).toBe('APLICADO');
      const trilhaAntes = await lerTrilha(vencida);
      expect(trilhaAntes.length).toBeGreaterThan(0);

      // ⚠️ **Precondição privilegiada, declarada.** A linha nasce pela porta de produção
      // (`registrarNotificacaoBancaria`) e quem a envelhece é o **banco** — `now()` do servidor menos
      // o intervalo. Fabricar o instante no processo decidiria o resultado do caso fora do SUT, e
      // seria o segundo eixo de relógio que a ADR-0026 fecha.
      await envelhecerCru(doVencido, DIAS_ALEM_DA_RETENCAO);

      // A precondição, AFIRMADA e não suposta: sem ela o caso mediria o sumiço de uma linha que
      // talvez já não existisse.
      expect(await lerCruOuNada(doVencido)).toBeDefined();

      const linhasAntes = linhasDoJournal.length;

      // O GATILHO: uma notícia **recente**, de outra cobrança, tratada pelo caminho normal. É ela
      // que dispara o expurgo — que é oportunista, e não agendado.
      const recente = await semearCobranca(EMPRESA_A.id);
      const doRecente = await tratarAviso(fila, recente);

      // ⚠️ A asserção central: o cru vencido **não existe mais**.
      expect(await lerCruOuNada(doVencido)).toBeUndefined();

      // E o EFEITO sobrevive ao descarte da origem: a trilha inteira, por igualdade da lista. É o par
      // que separa *"apagou o cru"* de *"apagou o cru e levou o histórico junto"* (ADR-0034).
      expect(await lerTrilha(vencida)).toEqual(trilhaAntes);

      // A linha recente NÃO foi apagada junto — o expurgo alcança o vencido, e só ele.
      expect(await lerCruOuNada(doRecente)).toBeDefined();

      // O expurgo é observável de fora do processo, com a contagem: sem a linha, a retenção correria
      // em silêncio e nada diria a quem opera que ela corre.
      const doExpurgo = eventosDoJournalDesde(linhasAntes).filter(
        (evento) => evento.mensagem === MENSAGEM_DO_EXPURGO,
      );
      expect(doExpurgo.length).toBe(1);
      expect({ nivel: doExpurgo[0]?.nivel, apagadas: doExpurgo[0]?.apagadas }).toEqual({
        nivel: NIVEL_DE_INFORMACAO,
        apagadas: 1,
      });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-989 — o cru de 89 dias permanece intacto, campo a campo',
    async () => {
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const dentroDaJanela = await semearCobranca(EMPRESA_A.id);
      const doDentro = await tratarAviso(fila, dentroDaJanela);

      await envelhecerCru(doDentro, DIAS_DENTRO_DA_RETENCAO);
      const antes = await lerCru(doDentro);

      // O mesmo gatilho do `CT-988`: uma notícia recente, tratada, que faz o expurgo correr.
      const recente = await semearCobranca(EMPRESA_A.id);
      await tratarAviso(fila, recente);

      // ⚠️ **A fronteira exata.** Este caso e o `CT-988` distam **dois dias**, e é essa distância que
      // faz o par reprovar um corte deslocado de um dia — *"1 e 100"* passaria em qualquer corte
      // entre os dois. A comparação é da linha INTEIRA, e não da existência: um expurgo que "quase"
      // apagasse — zerando o corpo, movendo o carimbo — passaria por uma asserção de presença.
      expect(await lerCruOuNada(doDentro)).toEqual(antes);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-988 (b) — a falha do expurgo não derruba o desfecho já gravado',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const notificacaoId = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
      );
      const linhasAntes = linhasDoJournal.length;

      // ⚠️ A falha é **real e do banco**: o papel da aplicação perde o privilégio de remoção sobre a
      // tabela, e o `DELETE` do expurgo passa a ser recusado com `42501`. Nada é dublado — o que se
      // exercita é a mesma instrução, contra o mesmo servidor, sem o privilégio.
      const tarefa = await semPrivilegioDeRemocaoDoCru(
        async () => await executarTarefa(fila, { notificacaoId }, UMA_TENTATIVA),
      );

      // ⚠️ **A asserção que discrimina**: a tarefa CONCLUI. Um expurgo dentro da unidade do efeito,
      // ou sem o `catch`, faria a tarefa terminar `failed` sobre uma baixa que valeu — e a fila
      // reentregaria uma notícia já tratada.
      expect(await tarefa.getState()).toBe('completed');

      // O desfecho e o efeito permanecem gravados.
      expect((await lerCru(notificacaoId)).desfecho).toBe('APLICADO');
      expect(await pagamentoDe(cobranca)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });

      // E a falha NÃO some: ela vai para o journal em `warn`, com o **código** da recusa — nunca a
      // mensagem do driver, que carrega fragmento de instrução (ADR-0032).
      const avisos = eventosDoJournalDesde(linhasAntes).filter(
        (evento) => evento.mensagem === MENSAGEM_DA_FALHA_DO_EXPURGO,
      );
      expect(avisos.length).toBe(1);
      expect({ nivel: avisos[0]?.nivel, motivo: avisos[0]?.motivo }).toEqual({
        nivel: NIVEL_DE_AVISO,
        motivo: CODIGO_DE_PRIVILEGIO_NEGADO,
      });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-988 (c) — depois de o cru ser expurgado, a camada 2 é quem recusa a segunda liquidação',
    async () => {
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const cobranca = await semearCobranca(EMPRESA_A.id);
      const daLiquidacao = liquidacaoNova();
      const original = await tratarAviso(fila, cobranca, daLiquidacao);

      expect((await lerCru(original)).desfecho).toBe('APLICADO');
      const trilhaAntes = await lerTrilha(cobranca);
      const retratoAntes = await retratoDaCobranca(cobranca);

      await envelhecerCru(original, DIAS_ALEM_DA_RETENCAO);
      const gatilho = await semearCobranca(EMPRESA_A.id);
      await tratarAviso(fila, gatilho);

      // A precondição deste caso: a camada 1 **não tem mais o que consultar**. É o que torna a
      // asserção seguinte uma prova da camada 2, e não uma repetição do `CT-980`.
      expect(await lerCruOuNada(original)).toBeUndefined();

      const consultasAntes = adaptador.consultas.length;

      // --- A reentrega chega DEPOIS do expurgo, com o mesmo identificador da liquidação ---------
      const reentregue = await gravarCru(
        avisoDe(cobranca.identificador, cobranca.numeroDoTitulo, daLiquidacao),
      );

      expect(await (await executarTarefa(fila, { notificacaoId: reentregue })).getState()).toBe(
        'completed',
      );

      // ⚠️ A camada 1 **não pôde pular** esta notícia — o cru sumiu —, então a tarefa consultou o
      // provedor. A consulta a mais é a âncora de que o caminho longo foi de fato percorrido.
      expect(adaptador.consultas.length).toBe(consultasAntes + 1);

      // E o desfecho é `CONFERIDO_SEM_EFEITO`, porque `liquidarPeloProvedor` devolveu
      // `NAO_ESTAVA_EM_ABERTO`: nada mudou, e nenhum evento nasceu (ADR-0034).
      expect((await lerCru(reentregue)).desfecho).toBe('CONFERIDO_SEM_EFEITO');
      expect(await lerTrilha(cobranca)).toEqual(trilhaAntes);
      expect(await retratoDaCobranca(cobranca)).toEqual(retratoAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-990 — ADR-0032: a medição dos QUATRO canais de saída da tarefa
// ===========================================================================

describe('CT-990 — nada do segredo nem do recebido escapa pela saída real', () => {
  it(
    'CT-990 — argumentos, carga da fila, journal e razão da falha ficam sem uma ocorrência sequer',
    async () => {
      // Duas cobranças e dois certificados: o vigente é o do último registro, e as agulhas cobrem
      // **os dois** — olhar por menos do que circulou mediria menos do que a ADR-0032 cobra.
      const doSucesso = await semearCobranca(EMPRESA_A.id);
      const daFalha = await semearCobranca(EMPRESA_A.id);
      const doPagador = sentinelaDoPagador();

      const agulhas = {
        ...agulhasDoSegredo('certificado do sucesso', {
          material: doSucesso.materialDoCertificado,
          senha: doSucesso.senhaDoCertificado,
        }),
        ...agulhasDoSegredo('certificado da falha', {
          material: daFalha.materialDoCertificado,
          senha: daFalha.senhaDoCertificado,
        }),
        ...agulhasDaChaveDeCifra(),
        // O recebido cru carrega **dado pessoal do pagador**, e o journal não tem prazo de guarda
        // (§13.1). Esta agulha é um campo que **nenhum ramo do produto lê** — o que ela mede é o
        // vazamento do corpo, e não o trânsito legítimo de um identificador.
        [AGULHA_DO_RECEBIDO]: doPagador,
      };

      // ⚠️ **O CONTROLE POSITIVO, canal a canal, ANTES de qualquer afirmação de ausência.** Sem ele,
      // uma varredura apontada para o canal errado devolveria lista vazia e este caso aprovaria um
      // processo vazando tudo — é o AP-29, e é a causa de rejeição repetida das fatias anteriores.
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );
      // E a âncora do próprio conjunto: um mapa vazio faria toda ausência passar por vacuidade.
      expect(Object.keys(agulhas).length).toBe(AGULHAS_DO_CT990);

      const linhasAntes = linhasDoJournal.length;

      // ⚠️ **UM consumidor só, e o comportamento da porta muda por variável.** Dois `montarConsumidor`
      // sobre a mesma fila deixariam dois consumidores vivos, e o servidor entrega a tarefa a
      // qualquer um deles: o caso mediria qual ganhou a corrida. É a mesma razão registrada no
      // `CT-979 (c)`.
      let aPortaLevanta = false;
      const adaptador = adaptadorQueResponde(() => {
        if (aPortaLevanta) {
          // O erro sobe CRU, **depois** de a porta ter recebido o invólucro: é o vetor que originou a
          // ADR-0032 — `fila.ts` registra `on('failed', … { erro })` com o objeto de exceção inteiro,
          // e a biblioteca grava a mensagem dele no servidor de fila.
          throw new Error(FALHA_CRUA_DA_PORTA);
        }

        return {
          situacao: 'LIQUIDADO',
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA,
          documento: null,
        };
      });
      const fila = montarConsumidor(adaptador.porta);

      // --- ATO 1 · o tratamento COMPLETO, que percorre o caminho do segredo até a porta ---------
      const doAto1 = await gravarCru(
        comOSentinelaDoPagador(
          avisoDe(doSucesso.identificador, doSucesso.numeroDoTitulo),
          doPagador,
        ),
      );
      const concluida = await executarTarefa(fila, { notificacaoId: doAto1 });

      expect(await concluida.getState()).toBe('completed');
      expect((await lerCru(doAto1)).desfecho).toBe('APLICADO');

      // A ÂNCORA do canal de argumentos: o claro **esteve** lá. Sem ela, varrer os argumentos sem o
      // portador afirmaria ausência num caminho que talvez não tenha decifrado nada.
      expect(adaptador.consultas.length).toBe(1);
      expect(adaptador.consultas[0]?.segredo).toBeDefined();

      // --- ATO 2 · a porta LEVANTA com o claro em escopo, e o erro sobe até a fila --------------
      aPortaLevanta = true;
      const doAto2 = await gravarCru(
        comOSentinelaDoPagador(avisoDe(daFalha.identificador, daFalha.numeroDoTitulo), doPagador),
      );
      const falhada = await executarTarefa(fila, { notificacaoId: doAto2 }, UMA_TENTATIVA);

      expect(await falhada.getState()).toBe('failed');
      expect(falhada.failedReason).toBeTypeOf('string');
      expect(falhada.failedReason).toContain(FALHA_CRUA_DA_PORTA);
      // A âncora do segundo caminho: a porta foi alcançada, e com o invólucro em mãos.
      expect(adaptador.consultas.length).toBe(2);
      expect(adaptador.consultas[1]?.segredo).toBeDefined();

      // A linha do consumidor sobre a tarefa em falha chega DEPOIS do estado terminal: espera-se por
      // ela pelo estado observável, com limite nomeado — nunca por espera fixa.
      await sondarAte(
        'o consumidor registrar a tarefa em falha no journal',
        async () =>
          eventosDoJournalDesde(linhasAntes).some(
            (evento) => evento.mensagem === REGISTRO_DA_TAREFA_EM_FALHA,
          ),
        LIMITE_ESTADO_TERMINAL_MS,
      );

      // --- A MEDIÇÃO: os QUATRO canais que a §11.6 nomeia ---------------------------------------
      const emitidas = linhasDoJournal.slice(linhasAntes);
      // Âncora antivácuo do canal do journal: sem linha alguma, a ausência passaria por vacuidade.
      expect(emitidas.length).toBeGreaterThan(0);

      const superficies = [
        // 1 · ARGUMENTOS — tudo o que a borda entregou à porta, **menos o portador**. O campo
        //     `segredo` é o destino legítimo do claro, e varrê-lo seria reprovar a própria entrega;
        //     o que se mede é se o segredo escapou por **algum outro** campo do argumento.
        ...adaptador.consultas.map(argumentosSemOPortador),
        // 2 · CARGA DA FILA SERIALIZADA — o que a borda enfileirou e o servidor de fila guardou.
        { rotulo: 'carga da tarefa concluída (json)', texto: JSON.stringify(concluida.data) },
        { rotulo: 'carga da tarefa em falha (json)', texto: JSON.stringify(falhada.data) },
        {
          rotulo: 'tarefa concluída gravada (inspeção)',
          texto: inspect(concluida.toJSON(), { depth: null }),
        },
        {
          rotulo: 'tarefa em falha gravada (inspeção)',
          texto: inspect(falhada.toJSON(), { depth: null }),
        },
        // 3 · LOG ESTRUTURADO — linha a linha, para que a reprovação diga **em qual** o segredo saiu.
        ...superficiesDoDiario(emitidas),
        // 4 · MENSAGEM DE FALHA — o que fica gravado no servidor de fila e alcança quem opera.
        { rotulo: 'failedReason (texto cru)', texto: String(falhada.failedReason) },
        { rotulo: 'failedReason (json)', texto: JSON.stringify(falhada.failedReason ?? null) },
      ];

      // A igualdade com lista vazia, e não `toHaveLength(0)`: é ela que faz a reprovação **nomear** o
      // canal e a agulha ofensora.
      expect(ocorrenciasDe(superficies, agulhas)).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-984 — a empresa suspensa retém o fato recebido, sem efeito e sem consulta
// ===========================================================================

describe('CT-984 — a suspensão retém a notícia em vez de descartá-la', () => {
  it(
    'CT-984 — o aviso de empresa suspensa termina RETIDO, sem consulta e sem tocar a cobrança',
    async () => {
      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      // A cobrança é da EMPRESA_B, e a suspensão é desfeita ao final deste caso: a empresa é
      // recurso compartilhado do arquivo, e deixá-la suspensa mudaria o arranjo de quem viesse
      // depois. A cobrança é real, com boleto vivo e certificado vigente — sem isso, "não
      // consultou" seria verdade vazia sobre um caminho que não teria como consultar.
      const cobranca = await semearCobranca(EMPRESA_B.id);
      const fotografia = await retratoDaCobranca(cobranca);
      expect(fotografia).toBeDefined();

      // --- A suspensão, pelas portas de produção que o Master percorre --------------------------
      //
      // São as MESMAS duas instruções, na MESMA unidade, que `EmpresaService.suspender` emite: a
      // marca e o encerramento das sessões. Nada aqui escreve `UPDATE identidade.empresa`.
      await suspenderPelasPortasDoMaster(EMPRESA_B.id);

      try {
        const notificacaoId = await gravarCru(
          avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
        );

        expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

        // --- O eixo do caso: retido, sem efeito e sem cota gasta -------------------------------
        const retida = await lerCru(notificacaoId);
        expect(retida.desfecho).toBe('RETIDO');

        // Zero consultas: o passo B.6 corre ANTES da ida à rede, e é isso que impede a empresa
        // suspensa de consumir cota da integração (RN-06).
        expect(adaptador.consultas).toEqual([]);

        // A cobrança **inteira**, por igualdade profunda: `to_jsonb` alcança toda coluna, inclusive
        // as que ninguém pensou em nomear.
        expect(await retratoDaCobranca(cobranca)).toEqual(fotografia);
        expect(await pagamentoDe(cobranca)).toEqual({ pagoEm: null, valorPago: null });
        expect(await lerTrilha(cobranca)).toEqual([]);

        // ⚠️ `tratado_em` **está preenchido** — a bicondicional do
        // `notificacao_bancaria_tratamento_chk` o exige de todo desfecho que não é `RECEBIDO` —, e
        // é justamente por isso que o discriminador de reentrância não pode ser esse campo.
        expect(retida.tratadoEm).not.toBeNull();

        // --- E, ainda assim, ela continua REPROCESSÁVEL ----------------------------------------
        //
        // Este é o passo que dá conteúdo ao anterior: reativada a empresa, a MESMA linha crua —
        // com o mesmo `tratado_em` já gravado — é tratada de novo e chega ao efeito. Um
        // curto-circuito por `tratado_em IS NOT NULL` a faria sair como reentrada benigna aqui, e é
        // exatamente esse mutante que este par barra.
        await reativarPelaPortaDoMaster(EMPRESA_B.id);

        expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

        expect((await lerCru(notificacaoId)).desfecho).toBe('APLICADO');
        expect(adaptador.consultas).toHaveLength(1);
        expect(await pagamentoDe(cobranca)).toEqual({
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA.toFixed(2),
        });
        expect(
          (await lerTrilha(cobranca)).map((evento) => ({
            tipo: evento.tipo,
            origem: evento.origem,
          })),
        ).toEqual([{ tipo: 'COBRANCA_LIQUIDADA', origem: 'NOTICIA_DO_PROVEDOR' }]);
      } finally {
        // A reativação corre de novo mesmo no caminho de falha: uma empresa deixada suspensa
        // contaminaria todo caso que rodasse depois deste arquivo crescer.
        await reativarPelaPortaDoMaster(EMPRESA_B.id);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a porta de verificação, o arranjo e as leituras
// ---------------------------------------------------------------------------

/** O valor que o AVISO alega ter recebido — nunca gravado em coluna nenhuma (CA-04). */
const VALOR_ALEGADO_PELO_AVISO = 4321.99;

/** A porta instrumentada: conta as chamadas e guarda os argumentos que o SUT lhe entregou. */
interface PortaInstrumentada {
  readonly porta: AdaptadorCobrancaBancaria;
  /** Toda consulta que chegou, na ordem — argumentos, e não apenas "foi chamado". */
  readonly consultas: readonly ConsultaDeSituacao[];
}

/** A porta que recusa, com a marca de que o invólucro do segredo chegou até ela. */
interface PortaQueRecusa extends PortaInstrumentada {
  /** `true` depois de a consulta ter chegado **com** o invólucro — a âncora do `CT-978 (b)`. */
  readonly recebeuOSegredo: boolean;
}

/** Uma implementação da porta que responde o que o caso mandar, contando as chamadas. */
function adaptadorQueResponde(situacaoDe: () => SituacaoConsultada): PortaInstrumentada {
  const consultas: ConsultaDeSituacao[] = [];

  return {
    consultas,
    porta: {
      consultarSituacao: async (consulta) => {
        consultas.push(consulta);

        return { aceito: true, valor: situacaoDe() };
      },
      emitir: operacaoNaoEsperada('emitir'),
      solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
      confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    },
  };
}

/**
 * Uma implementação da porta que **recusa** — o provedor indisponível do `CT-978 (b)`.
 *
 * ⚠️ **A recusa NÃO carrega nada do segredo**, e a ausência é deliberada: plantá-lo nela mediria o
 * dublê, não o produto. O que o caso mede é se **a borda** deixa escapar o que passou por ela.
 */
function adaptadorQueRecusa(): PortaQueRecusa {
  const consultas: ConsultaDeSituacao[] = [];
  const marca = { recebeuOSegredo: false };

  return {
    consultas,
    get recebeuOSegredo(): boolean {
      return marca.recebeuOSegredo;
    },
    porta: {
      consultarSituacao: async (consulta): Promise<DesfechoDaOperacao<SituacaoConsultada>> => {
        consultas.push(consulta);
        // A marca é a prova de que o claro ESTAVA em escopo quando a falha subiu: o invólucro chegou
        // à porta, o que só acontece depois de `decifrarSegredo` ter corrido na borda.
        marca.recebeuOSegredo = consulta.segredo !== undefined;

        return { aceito: false, classe: 'DA_EMPRESA', motivo: RECUSA_DO_PROVEDOR };
      },
      emitir: operacaoNaoEsperada('emitir'),
      solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
      confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    },
  };
}

/** Uma operação da porta que **nenhum** caso deste arquivo exercita — chamá-la é defeito. */
function operacaoNaoEsperada(nome: string): () => never {
  return () => {
    throw new Error(`a suíte do tratamento da notícia não esperava a operação ${nome}`);
  };
}

/**
 * Conecta a fila real e registra o consumidor da notícia com o adaptador informado.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.notificacaoBancaria, …)`, com a borda recebendo o acesso ao banco, o adaptador, a
 * guarda e a chave de cifra por parâmetro. **Nenhum contexto de tenant é fixado por fora** — ele
 * nasce lá dentro, do registro que o roteamento resolver.
 */
function montarConsumidor(adaptador: AdaptadorCobrancaBancaria): Fila {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.notificacaoBancaria,
    async (tarefa, logger) =>
      await processarNotificacaoBancaria(tarefa, logger, {
        banco: acesso,
        adaptador,
        guarda: guardaDeProducao(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  return fila;
}

/** A guarda de produção, apontada para o diretório efêmero deste arquivo. */
function guardaDeProducao(): GuardaDeBoletos {
  return criarGuardaDeBoletos(diretorioDosBoletos);
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` **não** encerram a
 * espera, e é essa distinção que faz o caso observar o desfecho depois de eventual repetição.
 */
async function executarTarefa(
  fila: Fila,
  carga: CargaDaNotificacaoBancaria,
  tentativas?: number,
): Promise<TarefaDaNotificacaoBancaria> {
  const enfileirada = await fila.notificacaoBancaria.add(
    FILA_DA_NOTIFICACAO_BANCARIA,
    carga,
    tentativas === undefined ? {} : { attempts: tentativas },
  );
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.notificacaoBancaria.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.notificacaoBancaria.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança `negocio`. Ele monta e lê estado;
 * **nunca** o contexto da tarefa, que nasce na borda a partir do registro roteado.
 */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Grava o cru pela porta de produção, **sem contexto de tenant** (ADR-0031). */
async function gravarCru(recebido: unknown): Promise<string> {
  return await acesso.emUnidadeDeTrabalho(
    async (tx) => await registrarNotificacaoBancaria(tx, { recebido }),
  );
}

/** Lê a linha crua pela porta de produção, sem contexto. */
async function lerCru(notificacaoId: string): Promise<NotificacaoBancariaPersistida> {
  const linha = await acesso.emUnidadeDeTrabalho(
    async (tx) => await lerNotificacaoBancaria(tx, notificacaoId),
  );

  if (linha === undefined) {
    throw new Error(`a notificação ${notificacaoId} não foi encontrada no banco`);
  }

  return linha;
}

/** O `recebido` gravado, como o banco o devolve. */
async function recebidoDe(notificacaoId: string): Promise<unknown> {
  return (await lerCru(notificacaoId)).recebido;
}

/** A trilha publicada de uma cobrança, sob o contexto da empresa dela. */
async function lerTrilha(cobranca: CobrancaSemeada): Promise<readonly LinhaDeEventoBancario[]> {
  return await emUnidade(
    cobranca.empresaId,
    async (tx) => await lerTrilhaDaCobranca(tx, cobranca.codigo),
  );
}

/** Os dois campos do pagamento, crus — o que separa "pagou" de "não pagou". */
async function pagamentoDe(
  cobranca: CobrancaSemeada,
): Promise<{ pagoEm: string | null; valorPago: string | null }> {
  return await emUnidade(cobranca.empresaId, async (tx) => {
    const [linha] = await tx<{ pagoEm: string | null; valorPago: string | null }[]>`
      SELECT to_char(pago_em, 'YYYY-MM-DD') AS "pagoEm",
             valor_pago::text               AS "valorPago"
        FROM negocio.cobranca
       WHERE codigo = ${cobranca.codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${cobranca.codigo} não foi alcançada sob o contexto dela`);
    }

    return { pagoEm: linha.pagoEm, valorPago: linha.valorPago };
  });
}

/**
 * A linha **inteira** da cobrança, como objeto — a fotografia que as igualdades profundas comparam.
 *
 * `to_jsonb` alcança **toda** coluna, inclusive as que ninguém pensou em nomear: é isso que separa
 * *"não mexeu nas colunas que eu lembrei"* de *"não mexeu"*.
 */
async function retratoDaCobranca(
  cobranca: CobrancaSemeada,
): Promise<Record<string, unknown> | undefined> {
  return await retratoDaCobrancaSob(cobranca.empresaId, cobranca.identificador);
}

/**
 * A mesma fotografia, sob o contexto que se mandar — é o que torna a RLS observável.
 *
 * ⚠️ **A chave é o `identificador_no_provedor`, e NUNCA o código da cobrança.** O código é único
 * **por empresa** (ADR-0033), de modo que a primeira cobrança de A e a primeira de B têm o **mesmo**
 * código: uma leitura por código sob o contexto de A acharia a cobrança **de A**, e a asserção
 * *"a cobrança de B é vazio"* passaria por coincidência sobre a linha errada. Foi o defeito medido no
 * arranjo do `CT-976`. O identificador é único no SaaS inteiro — é justamente por isso que ele é a
 * chave de roteamento —, e sobrevive à revogação, que é o que o `CT-1006` precisa.
 */
async function retratoDaCobrancaSob(
  empresaId: string,
  identificador: string,
): Promise<Record<string, unknown> | undefined> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ retrato: Record<string, unknown> }[]>`
      SELECT to_jsonb(c) AS retrato
        FROM negocio.cobranca c
       WHERE identificador_no_provedor = ${identificador}
    `;

    return linha?.retrato;
  });
}

/** Os bytes do boleto ainda estão no disco? — a única forma de observar `guarda.apagar`. */
async function arquivoDoBoletoExiste(cobranca: CobrancaSemeada): Promise<boolean> {
  const nomes = await readdir(diretorioDosBoletos);

  return nomes.includes(cobranca.nomeDoArquivo);
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data deste arranjo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca
 * de `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha.
 */
async function dataDeslocada(empresaId: string, dias: number): Promise<string> {
  return await emUnidade(empresaId, async (tx) => {
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
 * O corpo do aviso, no vocabulário do PROVEDOR — copiado do Caso A da §4.1.1 do tech spec.
 *
 * O identificador da liquidação é sorteado por chamada, e só se informa quando o caso precisa que
 * **duas** notícias carreguem o mesmo — que é exatamente a reentrega que o `CT-980` exercita.
 */
function avisoDe(
  identificador: string,
  numeroDoTitulo: string,
  identificadorDaLiquidacao: string = liquidacaoNova(),
  numeroCliente: number = NUMERO_DO_CLIENTE_DO_ARRANJO,
): {
  readonly idWebhook: number;
  readonly tipoMovimento: number;
  readonly dados: Record<string, unknown>;
} {
  return {
    idWebhook: 990,
    tipoMovimento: 7,
    dados: {
      seuNumero: identificador,
      nossoNumero: numeroDoTitulo,
      numeroIdentificadorBaixa: identificadorDaLiquidacao,
      numeroCliente,
      valorPagamento: VALOR_ALEGADO_PELO_AVISO,
      dataHoraSituacaoBaixa: '2026-08-18T14:03:11Z',
    },
  };
}

/** O contador que mantém todo identificador do arranjo distinto. */
function proximo(): number {
  sequencia += 1;

  return sequencia;
}

/** Um identificador de 18 posições que **nenhuma** cobrança tem — o órfão do `CT-974`. */
function identificadorInexistente(): string {
  return `7777${String(proximo()).padStart(14, '0')}`;
}

/** Um número de título do provedor, distinto a cada chamada. */
function numeroDeTitulo(): string {
  return String(1_000_000_000 + proximo());
}

/** O mesmo número com **um dígito trocado** — a divergência mínima que a RN-05 tem de pegar. */
function comUmDigitoTrocado(numeroDoTitulo: string): string {
  const ultimo = numeroDoTitulo.slice(-1);
  const trocado = ultimo === '9' ? '8' : String(Number(ultimo) + 1);

  return `${numeroDoTitulo.slice(0, -1)}${trocado}`;
}

/** Uma cobrança semeada: o que os casos precisam saber dela. */
interface CobrancaSemeada {
  readonly empresaId: string;
  readonly codigo: string;
  readonly identificador: string;
  readonly numeroDoTitulo: string;
  readonly nomeDoArquivo: string;
}

/**
 * A mesma cobrança, mais o par em claro que o arranjo cifrou no certificado da empresa dela.
 *
 * Os dois campos vivem **aqui**, e não em {@link CobrancaSemeada}, porque nem toda cobrança do
 * arranjo tem certificado: o `CT-978 (c)` semeia numa empresa que nunca registrou nenhum, e é
 * justamente a ausência que ele exercita. Separar os tipos é o que impede aquele caso de prometer,
 * pelo tipo, um segredo que não existe.
 */
interface CobrancaComCertificado extends CobrancaSemeada {
  readonly senhaDoCertificado: string;
  readonly materialDoCertificado: Buffer;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 80_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: `${nome.toLowerCase().replaceAll(' ', '-')}@exemplo.invalid`,
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

/** O usuário que registra o certificado de uma empresa — derivado da carga inicial. */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }

  return usuario;
}

/**
 * Semeia uma cobrança **com boleto vivo** na empresa informada, e garante o certificado vigente dela.
 *
 * Tudo pelas portas de produção: os cadastros, o contrato, a cobrança e o boleto — inclusive os bytes
 * do documento, gravados pela mesma guarda que a borda usa. É `gravarBoletoDaCobranca` que põe o
 * `identificador_no_provedor` vivo, e é ele a chave pela qual o roteamento da tarefa encontra a
 * cobrança.
 */
async function semearCobranca(empresaId: string): Promise<CobrancaComCertificado> {
  const certificado = await garantirCertificadoVigente(empresaId);
  const cobranca = await semearCobrancaSemCertificado(empresaId);

  return {
    ...cobranca,
    senhaDoCertificado: certificado.senha,
    materialDoCertificado: certificado.material,
  };
}

/**
 * A mesma semeadura, **sem tocar no certificado da empresa** — o arranjo do `CT-978 (c)`.
 *
 * Ela existe porque a ausência de certificado vigente é um estado de **empresa**, e não de cobrança:
 * uma vez registrado para a `EMPRESA_A`, ele vale para toda cobrança dela. O caso que exercita a
 * ausência, portanto, precisa de uma empresa própria — admitida por {@link admitirEmpresaNova}, a
 * porta de produção — e desta semeadura, que não chama `registrarCertificado` em momento algum.
 */
async function semearCobrancaSemCertificado(empresaId: string): Promise<CobrancaSemeada> {
  const marca = `t7-not-${String(proximo())}`;

  const cadastros = await emUnidade(empresaId, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });
    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
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
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidade(empresaId, lerAnoDaSerieDeContrato);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });
  const contrato = await emUnidade(empresaId, async (tx) => {
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

  const anoDaCobranca = await emUnidade(empresaId, lerAnoDaSerieDeCobranca);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  // O vencimento fica à frente do dia corrente para que a mora seja zero — sem isso o `valorTotal`
  // derivado divergiria do valor informado e todo caso de liquidação ganharia um evento a mais.
  const vencimento = await dataDeslocada(empresaId, DIAS_ATE_O_VENCIMENTO);
  const cobranca = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel ${marca}`,
        competencia: `${vencimento.slice(0, 7)}-01`,
        dataVencimento: vencimento,
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  const identificador = `2026${String(proximo()).padStart(14, '0')}`;
  const numeroDoTitulo = numeroDeTitulo();
  const nomeDoArquivo = await guardaDeProducao().gravar(
    cobranca.codigo,
    Buffer.from(`${PREFIXO_DO_DOCUMENTO}${marca}`),
  );

  await emUnidade(empresaId, async (tx) => {
    await gravarBoletoDaCobranca(tx, cobranca.codigo, {
      numeroDoTituloNoProvedor: numeroDoTitulo,
      linhaDigitavel: `L-${marca}`,
      codigoDeBarras: `B-${marca}`,
      identificadorNoProvedor: identificador,
      caminhoDoArquivo: nomeDoArquivo,
    });
  });

  return { empresaId, codigo: cobranca.codigo, identificador, numeroDoTitulo, nomeDoArquivo };
}

/**
 * Admite uma empresa nova pela porta de produção e devolve o identificador dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido — é a mesma forma, e a mesma razão, de `./regua.spec.ts`.
 */
async function admitirEmpresaNova(marca: string): Promise<string> {
  const criada = await emUnidade(
    EMPRESA_A.id,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marca}`,
        documento: `${String(Date.now()).slice(-8)}${String(proximo()).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return criada.id;
}

/** O par em claro que o arranjo cifrou — as agulhas que o `CT-978 (b)` procura na razão da falha. */
interface SegredoDoArranjo {
  readonly material: Buffer;
  readonly senha: string;
}

/**
 * Grava um certificado **vigente** da empresa, com o envelope cifrado pela mesma chave da composição.
 *
 * O material é opaco para o banco (ADR-0032) e nada neste arquivo o abre. O que importa é que a borda
 * **o resolve pelo banco** e o decifra com a chave que recebeu — sem que nada de segredo tenha
 * atravessado a fila.
 */
async function garantirCertificadoVigente(empresaId: string): Promise<SegredoDoArranjo> {
  const segredo: SegredoDoArranjo = {
    material: Buffer.concat([Buffer.from(`material-${randomUUID()}-`), randomBytes(64)]),
    senha: `senha-${randomUUID()}`,
  };
  const envelopeCifrado = cifrarSegredo(criarSegredoOperavel(segredo), CHAVE_DE_CIFRA);

  const validade = await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ de: Date; ate: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
             (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
    }

    return linha;
  });

  await emUnidade(empresaId, async (tx) => {
    await registrarCertificado(tx, {
      titular: `Empresa ${empresaId.slice(0, 8)}`,
      validoDe: validade.de,
      validoAte: validade.ate,
      impressaoDigital: randomUUID(),
      segredoCifrado: envelopeCifrado,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });

    // A identidade da empresa perante o provedor é pré-condição do MESMO tipo que o certificado
    // (`D36 · F4/T10`, fechado em 2026-08-20): sem ela as tarefas interrompem antes de tentar. Ela
    // nasce aqui, na mesma unidade, para que o arranjo continue produzindo uma empresa que consegue
    // operar — e não uma que passa a interromper por configuração faltante.
    await registrarIdentidadeNoProvedor(tx, {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        `identificador-${empresaId.slice(0, 8)}`,
        CHAVE_DE_CIFRA,
      ),
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });
  });

  return segredo;
}

// ---------------------------------------------------------------------------
// Acessórios da T8 — o expurgo, a idempotência e a varredura de segredo
// ---------------------------------------------------------------------------

/** A porta que responde `LIQUIDADO` com os valores padrão do arranjo — o caminho que aplica. */
function adaptadorQueLiquida(): PortaInstrumentada {
  return adaptadorQueResponde(() => ({
    situacao: 'LIQUIDADO',
    pagoEm: DATA_DO_PAGAMENTO,
    valorPago: VALOR_DA_COBRANCA,
    documento: null,
  }));
}

/**
 * Grava o aviso de uma cobrança e trata a notícia pelo caminho normal, afirmando que ela concluiu.
 *
 * A afirmação de `completed` mora **aqui** de propósito: quem chama usa esta função como **arranjo**,
 * e um arranjo que falhou em silêncio faria o caso medir o estado errado dizendo outra coisa.
 */
async function tratarAviso(
  fila: Fila,
  cobranca: CobrancaSemeada,
  daLiquidacao?: string,
): Promise<string> {
  const notificacaoId = await gravarCru(
    avisoDe(cobranca.identificador, cobranca.numeroDoTitulo, daLiquidacao),
  );

  expect(await (await executarTarefa(fila, { notificacaoId })).getState()).toBe('completed');

  return notificacaoId;
}

/**
 * Recua o `recebido_em` da linha crua em `dias`, **pelo relógio do banco**.
 *
 * ⚠️ **Precondição privilegiada, e a forma é o que a torna legítima.** A linha nasce pela porta de
 * produção; o que este acessório faz é **mover o dado**, e o instante sai de `now()` do servidor —
 * nunca de `new Date()` do processo, que é o segundo eixo de relógio que a ADR-0026 fecha. Fabricar
 * o instante aqui decidiria o resultado do `CT-988`/`CT-989` fora do SUT.
 *
 * Sem contexto de tenant: a tabela vive em `plataforma` e não tem dono-empresa (ADR-0031).
 */
async function envelhecerCru(notificacaoId: string, dias: number): Promise<void> {
  await acesso.emUnidadeDeTrabalho(async (tx) => {
    const resultado = await tx`
      UPDATE plataforma.notificacao_bancaria
         SET recebido_em = now() - make_interval(days => ${dias}::integer)
       WHERE id = ${notificacaoId}::uuid
    `;

    if (resultado.count !== 1) {
      throw new Error(`o arranjo não alcançou a notificação ${notificacaoId} para envelhecê-la`);
    }
  });
}

/** A linha crua, ou `undefined` quando ela já não existe — a leitura que o expurgo torna necessária. */
async function lerCruOuNada(
  notificacaoId: string,
): Promise<NotificacaoBancariaPersistida | undefined> {
  return await acesso.emUnidadeDeTrabalho(
    async (tx) => await lerNotificacaoBancaria(tx, notificacaoId),
  );
}

/**
 * Corre o trabalho com o papel da aplicação **sem** o privilégio de remoção sobre a tabela crua.
 *
 * É a falha **real** do expurgo: nada é dublado, e o que se exercita é a mesma instrução, contra o
 * mesmo servidor, recusada com `42501`. A reconcessão vai num `finally` próprio — deixar o papel sem
 * o privilégio contaminaria todo caso seguinte deste arquivo.
 */
async function semPrivilegioDeRemocaoDoCru<T>(trabalho: () => Promise<T>): Promise<T> {
  const privilegiado = abrirAcessoAoBanco({
    cadeiaDeConexao: conexaoSuperusuaria(banco),
    maximoDeConexoes: 1,
  });

  try {
    await privilegiado.emUnidadeDeTrabalho(async (tx) => {
      await tx`REVOKE DELETE ON plataforma.notificacao_bancaria FROM ${tx(PAPEL_DA_APLICACAO)}`;
    });

    try {
      return await trabalho();
    } finally {
      await privilegiado.emUnidadeDeTrabalho(async (tx) => {
        await tx`GRANT DELETE ON plataforma.notificacao_bancaria TO ${tx(PAPEL_DA_APLICACAO)}`;
      });
    }
  } finally {
    await privilegiado.encerrar();
  }
}

/** Os eventos que o registrador emitiu a partir de `inicio`, já interpretados como objeto. */
function eventosDoJournalDesde(inicio: number): Record<string, unknown>[] {
  return linhasDoJournal.slice(inicio).map((linha) => JSON.parse(linha) as Record<string, unknown>);
}

/** Um identificador de liquidação novo — a chave do efeito único (RN-08). */
function liquidacaoNova(): string {
  return `16001${String(proximo()).padStart(14, '0')}`;
}

/**
 * O sentinela que faz as vezes de **dado pessoal do pagador** no corpo recebido.
 *
 * Ele é um valor que **nenhum ramo do produto lê**: não é o identificador, não é o número do título e
 * não é o da liquidação. É essa irrelevância que o torna capaz de medir vazamento do **corpo** em vez
 * de flagrar o trânsito legítimo de um identificador.
 */
function sentinelaDoPagador(): string {
  return `pagador-${randomUUID()}`;
}

/** O mesmo aviso, com o sentinela do pagador plantado no corpo — nada do produto o interpreta. */
function comOSentinelaDoPagador(
  aviso: ReturnType<typeof avisoDe>,
  sentinela: string,
): Record<string, unknown> {
  return { ...aviso, dados: { ...aviso.dados, nomeDoPagador: sentinela } };
}

/**
 * As duas agulhas da **chave de cifra** — a que abre o envelope do certificado.
 *
 * Ela não passa por {@link agulhasDoSegredo} porque não é um par *material × senha*: é uma chave
 * nua, e inventar uma senha para ela produziria uma agulha que nunca circulou.
 */
function agulhasDaChaveDeCifra(): Record<string, string> {
  return {
    'chave de cifra em base64': CHAVE_DE_CIFRA.toString('base64'),
    'chave de cifra em hexadecimal': CHAVE_DE_CIFRA.toString('hex'),
  };
}

/**
 * Os argumentos de uma consulta como superfície varrida, **sem o portador do segredo**.
 *
 * ⚠️ **A exclusão do campo `segredo` é deliberada, e a âncora que a acompanha é o que a torna
 * honesta**: aquele campo é o **destino legítimo** do claro — a porta não tem como consultar o
 * provedor sem ele —, e varrê-lo reprovaria a própria entrega. O que esta superfície mede é se o
 * segredo escapou por **algum outro** campo do argumento, que é onde o vazamento aconteceria sem que
 * ninguém decidisse. Quem usa afirma antes que `segredo` **esteve** presente.
 */
function argumentosSemOPortador(consulta: ConsultaDeSituacao, posicao: number): Superficie {
  const { segredo: _portador, ...semOPortador } = consulta;

  return {
    rotulo: `argumentos da consulta ${String(posicao + 1)} (sem o portador)`,
    texto: inspect(semOPortador, { depth: null }),
  };
}

// ---------------------------------------------------------------------------
// Acessórios da T9 — a suspensão e a reativação pelas portas do Master
// ---------------------------------------------------------------------------

/**
 * Suspende a empresa pelas **portas de produção** que o Master percorre, e afirma o desfecho.
 *
 * ⚠️ **Precondição privilegiada, e a via é o que a torna legítima.** São as mesmas duas funções de
 * `@sysloc/db`, na mesma unidade de trabalho, que `EmpresaService.suspender` emite — a marca e o
 * encerramento das sessões (RN-04). Nenhum `UPDATE` em `identidade.empresa` é escrito aqui.
 *
 * O serviço do Master **não** é importável deste processo: ele vive em `apps/api`, sobre o arcabouço
 * que este pacote não declara. Quem exercita o serviço inteiro — e o reenfileiramento que a
 * reativação dispara — é `apps/api/test/retomada-de-retidas.spec.ts`, na única direção em que os
 * dois processos se encontram.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a escrita corre sob qualquer
 * contexto válido — é a mesma forma, e a mesma razão, de {@link admitirEmpresaNova}.
 */
async function suspenderPelasPortasDoMaster(empresaId: string): Promise<void> {
  const marcada = await emUnidade(empresaId, async (tx) => {
    const marca = await suspenderEmpresa(tx, empresaId);

    if (marca === undefined) {
      return undefined;
    }

    await encerrarSessoesDaEmpresa(tx, empresaId);

    return marca;
  });

  if (marcada === undefined) {
    throw new Error(`o arranjo não alcançou a empresa ${empresaId} para suspendê-la`);
  }
}

/** Reativa a empresa pela porta de produção, e afirma o desfecho. Ver {@link suspenderPelasPortasDoMaster}. */
async function reativarPelaPortaDoMaster(empresaId: string): Promise<void> {
  const reativada = await emUnidade(empresaId, async (tx) => await reativarEmpresa(tx, empresaId));

  if (reativada !== empresaId) {
    throw new Error(`o arranjo não alcançou a empresa ${empresaId} para reativá-la`);
  }
}

// ===========================================================================
// CA-08 → CT-1010 (RN-05) — a SEGUNDA metade da conferência, fechamento do `D17 · F4/T7`
//
// INVARIANTES
// - número do cliente divergente recusa como o título divergente: `DIVERGENTE`, sem tocar a
//   cobrança e **sem falar com o provedor**;
// - ausência do campo NÃO é divergência — é o caso que impede que um provedor que deixe de enviá-lo
//   transforme toda notícia legítima em anomalia.
// ===========================================================================
describe('CT-1010 — a divergência do número do cliente recusa sem tocar a cobrança', () => {
  it(
    'CT-1010 — cliente divergente termina DIVERGENTE, e a porta não é alcançada',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const antes = await retratoDaCobranca(cobranca);

      const adaptador = adaptadorQueResponde(() => {
        throw new Error('a porta não pode ser alcançada por uma notícia de outra conta');
      });
      const fila = montarConsumidor(adaptador.porta);

      // O título CONFERE; só o cliente diverge — é o que discrimina esta metade da outra.
      const notificacaoId = await gravarCru(
        avisoDe(
          cobranca.identificador,
          cobranca.numeroDoTitulo,
          liquidacaoNova(),
          NUMERO_DO_CLIENTE_DO_ARRANJO + 1,
        ),
      );
      const tarefa = await executarTarefa(fila, { notificacaoId });

      expect(await tarefa.getState()).toBe('completed');
      expect((await lerCru(notificacaoId)).desfecho).toBe('DIVERGENTE');
      expect(adaptador.consultas).toEqual([]);
      expect(await retratoDaCobranca(cobranca)).toEqual(antes);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1010 (b) — AUSÊNCIA do número do cliente não é divergência: a notícia segue',
    async () => {
      const cobranca = await semearCobranca(EMPRESA_A.id);
      const adaptador = adaptadorQueResponde(() => ({
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      }));
      const fila = montarConsumidor(adaptador.porta);

      const aviso = avisoDe(cobranca.identificador, cobranca.numeroDoTitulo);
      const semCliente = {
        ...aviso,
        dados: Object.fromEntries(
          Object.entries(aviso.dados).filter(([chave]) => chave !== 'numeroCliente'),
        ),
      };

      const notificacaoId = await gravarCru(semCliente);
      const tarefa = await executarTarefa(fila, { notificacaoId });

      expect(await tarefa.getState()).toBe('completed');
      // Sem o campo, a notícia atravessa e o efeito acontece — o oposto do caso acima.
      expect((await lerCru(notificacaoId)).desfecho).not.toBe('DIVERGENTE');
      expect(adaptador.consultas.length).toBeGreaterThan(0);
    },
    LIMITE_DO_CASO_MS,
  );
});
