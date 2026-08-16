/**
 * Verificação do **adaptador mTLS contra o provedor** — CT-839 a CT-844 e CT-863 da fatia
 * `fundacao-bancaria`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-07    | CT-839 | Contra par que exige certificado de cliente e confia na autoridade que
 * |          |        | emitiu o material da empresa, a operação **resolve** com `aceito: true`,
 * |          |        | `verificadoEm` dentro da janela do ato e `detalhe` igual ao texto de
 * |          |        | alcance — e o par registra **um** aperto de mão apresentando o titular
 * |          |        | daquela empresa, com pedido sem corpo e sem credencial de acesso. |
 * | CA-07,13 | CT-840 | Material emitido por autoridade que o par **não** conhece resolve com
 * |          |        | `aceito: false` e `detalhe` de recusa pelo par — **nunca** lança —, e nada
 * |          |        | do desfecho carrega termo do provedor nem detrito do runtime de transporte. |
 * | CA-07    | CT-841 | Endereço sem ouvinte degrada para recusa **nomeada e distinta** da anterior,
 * |          |        | em menos de 2 s, e nunca para exceção que a borda traduza em `500`. |
 * | —        | CT-842 | O teto declarado **governa por efeito**: contra par que aceita o TCP e nunca
 * |          |        | responde, o ato termina dentro da janela do teto, com desfecho próprio. |
 * | —        | CT-843 | Três atos na **mesma instância** produzem três apertos de mão, sem reuso de
 * |          |        | sessão, sem conexão sobrevivente, e o desfecho de cada um é decidido pelo
 * |          |        | material daquele ato — o `true` dos anteriores não é herdado. |
 * | RN-02    | CT-844 | Em cada desfecho, nem a senha nem os bytes do material aparecem em nada que
 * |          |        | o ato produza — medido sobre a saída real, nunca por leitura do fonte. |
 * | CA-07,13 | CT-863 | Material que **não abre** faz `https.request` lançar de forma SÍNCRONA; ainda
 * |          |        | assim a operação **resolve**, com desfecho de texto próprio, sem detrito do
 * |          |        | OpenSSL em superfície alguma, e sem deixar temporizador vivo nem despachante
 * |          |        | por desfazer. |
 *
 * Rastreabilidade: `CA-07 → CT-839, CT-840, CT-841, CT-863 (RN-06)` ·
 * `CA-13 → CT-840, CT-863 (RN-10)` · `RN-02 → CT-844, CT-863`.
 *
 * ---------------------------------------------------------------------------
 * QUATRO DIVERGÊNCIAS DECLARADAS DOS CARDS DA §6.6, e as quatro são MEDIDAS
 * ---------------------------------------------------------------------------
 *
 * **1. O par é `https.createServer`, e não `tls.createServer` puro.** O card do CT-839 escreve
 * `tls.createServer({ key, cert, ca, requestCert, rejectUnauthorized })`, e com ele **nenhum** caso
 * desta suíte poderia passar. A razão é o TLS 1.3, medida neste host:
 *
 * - com material **confiável**, um par TLS puro que não escreve nada deixa o ato correr até o teto —
 *   `4004 ms` sob teto de 4 s, com o servidor contando `handshakes: 1` e a conexão ainda aberta;
 * - com material **alheio**, o cliente recebe `secureConnect` **exatamente igual** ao caso aceito
 *   (~30 ms), porque no TLS 1.3 quem valida o certificado do cliente é o servidor, **depois** de o
 *   cliente concluir o próprio lado. A recusa só aparece na primeira troca de dados de aplicação.
 *
 * Ou seja: `secureConnect` **não discrimina nada** aqui, e um par que nunca fala torna aceite e
 * recusa indistinguíveis. O `https.Server` **é** um `tls.Server` (herda dele), de modo que as opções
 * do card valem inteiras e a instrumentação de `secureConnection`, `tlsClientError` e `connection`
 * continua sendo a do par — o que ele acrescenta é a resposta que fecha o ato.
 *
 * **2. As autoridades de teste entram nas raízes do processo por `tls.setDefaultCACertificates`.**
 * O adaptador confere o certificado **do par** com as raízes do sistema, como deve; sem essa
 * instalação, todo caso reprovaria por o par de teste ser desconhecido — e a alternativa seria pedir
 * ao adaptador uma âncora de confiança configurável, que é seam de produção criado para teste e a
 * lei do seam proíbe. A API é **pública e do runtime** (Node 22.15+), a mesma classe de fronteira que
 * o CT-862 já instrumenta na T9, e a restauração é conferida em `onTestFinished`.
 *
 * ⚠️ **O que NÃO se fez, e por quê**: baixar `rejectUnauthorized` no adaptador tornaria o `aceito:
 * true` uma afirmação falsa — qualquer intermediário se passaria pelo provedor e a sonda diria que a
 * identidade serve.
 *
 * **3. O CT-843 faz TRÊS atos, e não dois — o card, ao pé da letra, produz uma asserção que não pode
 * falhar.** Ele manda ato 1 com material confiável e ato 2 com material alheio, e afirmar
 * `sessoesReusadas === 0` sobre esse par. Medido: **sobre esse par a asserção é vácua**, porque
 * material diferente é configuração TLS diferente e o cache de sessão jamais reusaria — o mutante que
 * troca o despachante por um **global e persistente** (`keepAlive: true, maxCachedSessions: 100`, sem
 * desfazê-lo no fim do ato) passou **21/21** contra a forma do card. Com dois atos do **mesmo**
 * material, o mesmo mutante faz o par contabilizar `sessoesReusadas: 1`, enquanto o adaptador de
 * produção mantém `0`.
 *
 * Daí a forma entregue: ato 1 e ato 2 com o material **confiável** — o par que expõe o agrupamento —
 * e ato 3 com o **alheio**, que é o que o card queria provar (o desfecho não é herdado). A cobertura
 * do card é preservada inteira, e ganha a asserção que ele pedia sem poder cumprir.
 *
 * ⚠️ **`abertas === 0` é conferência de higiene, não o discriminador do agrupamento.** Medido: o par
 * de teste fecha a conexão ao fim da resposta, de modo que ela zera mesmo sob o mutante. Quem
 * discrimina é `sessoesReusadas`, e é por isso que a asserção dele fecha o caso.
 *
 * **4. Existe um QUINTO desfecho, e com ele o CT-863 — nenhum dos seis cards o previa.** O achado é
 * do Gate 2 na rodada 2 e foi **reproduzido aqui**: `https.request` monta o contexto seguro de forma
 * **síncrona** e **lança** quando o material não abre (medido neste host: `not enough data` em 46 ms
 * com bytes que não são PKCS#12). Na forma anterior, a exceção saía pelo executor da `Promise` e
 * produzia três defeitos de uma vez — a operação **rejeitava**, contrariando o contrato absoluto de
 * `porta-de-identidade.ts`; o texto do OpenSSL atravessava a porta; e o temporizador de 10 s mais o
 * despachante ficavam sem liberação, porque `decidir` nunca corria.
 *
 * ⚠️ **O desfecho novo tem texto PRÓPRIO, e a escolha foi entre três**: reusar `DETALHE_INDISPONIVEL`
 * mentiria (nada foi alcançado, e não por culpa do destino), reusar `DETALHE_RECUSA_PELO_PAR`
 * mentiria pior (nenhum par decidiu), e o quinto texto cobra o par no `Record<DesfechoDoAperto,
 * string>` — que é exatamente o preço que aquele `Record` existe para cobrar. A propriedade A3
 * continua valendo, agora sobre **cinco** textos distintos entre si.
 *
 * ---------------------------------------------------------------------------
 * OS CINCO TEXTOS SÃO COPIADOS, e o TETO é IMPORTADO — a assimetria é deliberada
 * ---------------------------------------------------------------------------
 *
 * Os `detalhe` entram aqui como **literais**, jamais importados do artefato: importá-los faria o caso
 * aprovar qualquer texto, inclusive um que colapsasse dois desfechos num só. É o precedente da
 * `DECISÃO FECHADA` do CT-642 em `packages/regua/test/coordenadas-do-transporte.spec.ts`.
 *
 * O **teto** é a exceção, e a razão é inversa: o que o CT-842 mede não é o texto da constante, é o
 * **efeito** dela sobre o transporte. Reescrevê-lo como `10_000` literal faria a asserção medir o
 * teste em vez do artefato — a classe de defeito que sobreviveu a cinco rodadas em
 * `packages/regua/src/adaptador-smtp.ts`.
 *
 * ---------------------------------------------------------------------------
 * ORDEM DAS ASSERÇÕES: o que discrimina um campo vem ANTES da igualdade que o fixa
 * ---------------------------------------------------------------------------
 *
 * Regra deste arquivo, e ela vale para **toda** asserção sobre um campo que um `toEqual` posterior
 * governa — a varredura de `TERMOS_PROIBIDOS` e as oito distinções entre os `detalhe`. A razão é
 * mecânica: o `toEqual` **aborta o caso ao falhar**, de modo que uma asserção posta depois dele só
 * executa quando a igualdade já provou o valor do campo — e aí ela compara dois literais escritos
 * neste arquivo, sem participação alguma do SUT. Não há estado do adaptador em que reprove (AP-29).
 *
 * O que se perde na ordem errada não é detecção — a combinação dos quatro `toEqual` entre casos já
 * pega o colapso —, é a **garantia nomeada** e a mensagem que a identifica. Medido no mutante que
 * colapsa `DETALHE_RECUSA_PELO_PAR` no texto de `DETALHE_ACEITE`: na ordem certa a reprovação diz
 * *"expected 'a instituição aceitou…' not to be 'a instituição aceitou…'"*; na inversa, dizia
 * *"expected { aceito: false, …(2) } to deeply equal { aceito: false, …(2) }"*, e a linha da
 * distinção **nunca executava**. É a forma do achado do Gate 1 na T9, e foi o achado do Gate 1
 * nesta task.
 *
 * ⚠️ **A saída NÃO é importar os textos do artefato** para compor a distinção: isso faria o caso
 * aprovar qualquer texto (ver a seção acima, e a `DECISÃO FECHADA` do CT-642). A saída é a **ordem**.
 *
 * ---------------------------------------------------------------------------
 * A varredura de ausência tem CONTROLE POSITIVO, e sem ele não provaria nada
 * ---------------------------------------------------------------------------
 *
 * O CT-840 e o CT-844 afirmam **ausências**, e ausência é exatamente o que um detector quebrado
 * também devolve. Por isso a **mesma** função de varredura é aplicada, no mesmo caso, a um objeto de
 * controle que **contém** as agulhas — e tem de devolvê-las todas (**AP-29**). As ausências são
 * afirmadas por **igualdade com lista vazia**, nunca por booleano, para que a reprovação **nomeie** o
 * desfecho e a agulha ofensora.
 *
 * As agulhas são derivadas dos bytes **reais** que circularam, e a senha varrida é a senha **real**
 * do cofre — procurar uma cadeia que nunca entrou no ato é a variante oca desta prova (ADR-0032, que
 * proíbe expressamente a prova por leitura de código).
 *
 * ⚠️ **Parentesco com `leitura-do-material.spec.ts`**: aquele arquivo varre as **superfícies de um
 * erro levantado**; aqui o objeto medido é o **desfecho resolvido**, e o espólio é o que a §6.6 da
 * task fixa. As duas varreduras têm forma parecida e alcance diferente. Promover a maquinaria a
 * acessório comum é decisão de quem tiver o **terceiro** consumidor — hoje seriam duas, e mover a de
 * lá está fora da lista de arquivos desta task.
 *
 * ---------------------------------------------------------------------------
 * Os NOVE mutantes que provam que estes casos PODEM falhar
 * ---------------------------------------------------------------------------
 *
 * Medidos pelo script do pacote (`pnpm --filter @sysloc/cobranca-bancaria test`, nunca `vitest run`
 * avulso), um a um, e revertidos:
 *
 * 1. **O teto é declarado e NÃO aplicado ao transporte** — a constante continua valendo `10_000`, e
 *    o que governa o ato é outro número. É o defeito literal de `adaptador-smtp.ts`, que sobreviveu
 *    a cinco rodadas. Reprova no **CT-842**: *"expected 3001 to be greater than or equal to 9500"* —
 *    e note que a igualdade `toBe(10_000)` passa verde sob ele, que é a razão de a janela existir.
 * 2. **Os quatro `detalhe` colapsam num texto genérico.** Reprova no **CT-841** e no **CT-842**.
 * 3. **O discriminador é invertido** (`ligou ? 'INDISPONIVEL' : 'RECUSA_PELO_PAR'`) — indisponível e
 *    recusado trocam de lugar. Reprova no **CT-840**, no **CT-841** e no **CT-843**.
 * 4. **O despachante vira global e persistente** (`keepAlive: true`, cache de sessão cheio, sem
 *    desfazê-lo). Reprova no **CT-843**: *"expected 1 to be +0"* em `sessoesReusadas`.
 *    ⚠️ **Este mutante SOBREVIVEU à primeira forma do caso**, a do card, com 21/21 verde — foi ele
 *    que obrigou o terceiro ato descrito acima. É o AP-29 pego por medição, e não por leitura.
 * 5. **O adaptador devolve `aceito: true` sem apresentar certificado algum** (nem conecta). O objeto
 *    devolvido fica **idêntico** ao do caminho feliz; reprova no **CT-839** pela única asserção que
 *    o discrimina — *"expected +0 to be 1"* em `handshakes`, no par.
 * 6. **A senha é interpolada no `detalhe`**, como um diagnóstico ingênuo faria. Reprova no
 *    **CT-844**, **nomeando** o que vazou e por qual desfecho: `['aceito/senha', 'recusado/senha',
 *    'indisponivel/senha']` em vez de `[]`.
 * 7. **O código cru do transporte é anexado ao `detalhe`.** Reprova no **CT-840** nomeando
 *    `['econnreset']` — e só nomeia porque a varredura de A8 corre **antes** da igualdade do objeto.
 * 8. **A construção da requisição volta a ficar FORA do `try`** — o código exato da rodada 2, e o
 *    defeito que o Gate 2 mediu. Reprova no **CT-863**, e a mensagem nomeia o que atravessou:
 *    `['rejeitou/not-enough-data']` em vez de `[]`.
 * 9. **O `catch` engole a falha sem limpar o temporizador** (`resolver('NAO_INICIADO')` direto, sem
 *    passar por `decidir`). O desfecho fica **certo** e o caso ainda reprova, no **CT-863**, pela
 *    contagem de temporizadores vivos — é o mutante que separa *"respondeu o desfecho certo"* de
 *    *"respondeu o desfecho certo e não deixou detrito"*.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo NÃO prova, e onde a propriedade vizinha mora
 * ---------------------------------------------------------------------------
 *
 * O desfecho **na borda** (`200`, recusa informada, `404` sem certificado) é CT-826/827/828, na T12;
 * repetir aqui seria `duplicate_cross_layer` (AP-23). Senha que não abre, bytes ilegíveis,
 * certificado vencido, titular e impressão digital são CT-806/807/808/821 — o adaptador recebe o
 * segredo e não o interpreta. Contato com a API real ou de homologação do provedor é **proibido pela
 * ADR-0006**: a fronteira é o laço local, em porta que o próprio processo abre. `client_credentials`
 * não existe nesta fatia (ver o `DÉBITO COM GATILHO` do adaptador). Revogação, agrupamento de
 * conexões, disjuntor e repetição não existem por decisão (D6-b).
 */

import type { Server as ServidorSeguro } from 'node:https';
import { Agent, createServer as criarParSeguro } from 'node:https';
import type { Server as ServidorTcp } from 'node:net';
import { createServer as criarParTcp } from 'node:net';
import type { Duplex } from 'node:stream';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { inspect } from 'node:util';
import { criarSegredoOperavel } from '@sysloc/shared';
import { describe, expect, it, onTestFinished } from 'vitest';
import { criarAdaptadorSicoob, TETO_DO_APERTO_DE_MAO_MS } from '../src/adaptador-sicoob.ts';
import type { ResultadoDaVerificacaoDeIdentidade } from '../src/modelo-canonico.ts';
import type { PortaDeIdentidadeBancaria } from '../src/porta-de-identidade.ts';
import type { AutoridadeDeTeste } from './material-de-teste.ts';
import {
  gerarAutoridadeDeTeste,
  gerarMaterialDeTeste,
  gerarParDeServidorDeTeste,
} from './material-de-teste.ts';

/**
 * Teto de um caso inteiro: gerar as chaves RSA das autoridades, emitir os materiais e completar os
 * apertos de mão. A geração é o trecho lento, e o teto é folgado por causa dela.
 */
const LIMITE_DO_CASO_MS = 90_000;

/**
 * Teto do CT-842 — o caso mais caro do arquivo, e o único que **espera o teto do artefato**.
 *
 * Ele é `TETO + 20_000` de propósito: precisa sobrar folga sobre o teto para o caso reprovar por
 * asserção, e não por estouro do próprio limite, se o teto do adaptador deixar de governar.
 */
const LIMITE_DO_CASO_DO_TETO_MS = TETO_DO_APERTO_DE_MAO_MS + 20_000;

/** Quanto se espera pela liberação das conexões antes de reprovar — sondagem, nunca `sleep` fixo. */
const LIMITE_DA_LIBERACAO_MS = 2_000;

/** Intervalo entre sondagens da liberação. */
const INTERVALO_DA_SONDAGEM_MS = 10;

/**
 * O teto do CT-841 — o que separa *"desistiu porque o destino recusou"* de *"esperou o teto"*.
 *
 * Ele é **muito** menor que o teto do adaptador de propósito: um adaptador que tratasse a
 * indisponibilidade esperando o relógio expirar reprovaria aqui, mesmo devolvendo o texto certo.
 */
const TETO_DA_INDISPONIBILIDADE_MS = 2_000;

/** A janela em que o desfecho do CT-842 é aceito, em torno do teto declarado pelo artefato. */
const FOLGA_ABAIXO_DO_TETO_MS = 500;
const FOLGA_ACIMA_DO_TETO_MS = 5_000;

/**
 * O nome da variável que declara o destino — **copiado**, e é ele o eixo que este arquivo afirma.
 *
 * O endereço da verificação vem do ambiente e **nunca** do corpo ou da sessão: nenhuma entrada do
 * usuário decide para onde a conexão vai. Os casos escrevem a variável, leem dela e passam o valor
 * ao construtor — que é o precedente de `criarAdaptadorSmtp`, o qual deliberadamente não lê
 * `process.env`.
 */
const VARIAVEL_DO_ENDERECO = 'ENDERECO_DO_PROVEDOR_BANCARIO';

/** O endereço do laço local — o par é sempre o próprio processo (ADR-0006). */
const LACO_LOCAL = '127.0.0.1';

/** O nome comum do par de teste; o nome alternativo do certificado cobre o laço local. */
const NOME_DO_PAR = 'par-de-teste.sysloc';

/** A senha **real** do cofre, e a mesma que os casos usam como agulha. */
const SENHA_SENTINELA = 'senha-real-do-cofre-a7d419fe2c';

/** O titular do material da empresa — o que o par tem de ver no aperto de mão aceito. */
const TITULAR_DA_EMPRESA = {
  pais: 'BR',
  organizacao: 'Locadora Modelo SA',
  nomeComum: '11222333000181',
} as const;

/** Os quatro textos, **copiados** do artefato — jamais importados. Ver o cabeçalho. */
const DETALHE_ACEITE =
  'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Isto confirma a identidade da empresa perante ela; não confirma que a emissão de cobrança já ' +
  'está habilitada, o que depende das credenciais de habilitação';

const DETALHE_RECUSA_PELO_PAR =
  'a instituição não aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Confira se o certificado é o que ela emitiu para esta empresa e se continua válido perante ela';

const DETALHE_INDISPONIVEL =
  'não foi possível alcançar a instituição no endereço configurado, e o certificado desta empresa ' +
  'não chegou a ser apresentado. Tente novamente em alguns minutos';

const DETALHE_TEMPO_ESGOTADO =
  'a instituição não concluiu a conferência do certificado dentro do tempo previsto, e por isso ' +
  'esta tentativa não confirma nem recusa a identidade da empresa. Tente novamente';

const DETALHE_NAO_INICIADO =
  'a verificação não chegou a começar: o certificado desta empresa não foi apresentado e nenhuma ' +
  'conexão com a instituição foi tentada. Confira o certificado e a senha registrados para esta ' +
  'empresa e tente novamente';

/**
 * Bytes que **não** são PKCS#12 — a entrada que faz `https.request` lançar de forma síncrona.
 *
 * A cadeia é longa e improvável de propósito: ela vira as agulhas `material-base64` e `material-hex`
 * do CT-863, e uma cadeia curta poderia casar por acaso com algum trecho do espólio.
 */
const MATERIAL_QUE_NAO_ABRE = Buffer.from('estes-bytes-nao-sao-um-pkcs12-8f3c1d97b2');

/**
 * O detrito do OpenSSL que o CT-863 procura — os dois textos **medidos** neste host.
 *
 * Eles não entram em {@link TERMOS_PROIBIDOS} de propósito: aquela lista é o vocabulário que a
 * ADR-0001 mantém fora da porta, e estes dois são a superfície específica do caminho síncrono. Somar
 * um ao outro faria a lista dizer duas coisas, e a reprovação do CT-840 deixaria de nomear a classe.
 */
const AGULHAS_DO_RUNTIME_DE_MATERIAL: readonly Agulha[] = [
  { rotulo: 'mac-verify-failure', valor: 'mac verify failure' },
  { rotulo: 'not-enough-data', valor: 'not enough data' },
];

/** Como `process.getActiveResourcesInfo()` nomeia um `setTimeout` ainda vivo — medido. */
const RECURSO_DE_TEMPORIZADOR = 'Timeout';

/**
 * O que **não** pode atravessar a porta (CA-13, ADR-0001) — nome do provedor, campo do material,
 * credencial da fatia seguinte e detrito do runtime de transporte.
 *
 * A lista é escrita por extenso e conferida por comprimento **antes** do uso: uma lista que
 * encolhesse em silêncio faria a varredura passar sem examinar nada.
 */
const TERMOS_PROIBIDOS = [
  'sicoob',
  'bancoob',
  'pfx',
  'passphrase',
  'client_id',
  'scope',
  'unknown ca',
  'err_tls',
  'eproto',
  'econnreset',
  'ssl routines',
  'certificate verify failed',
] as const;

/** O mínimo de termos que a varredura do CT-840 examina — abaixo disso ela não prova o bastante. */
const MINIMO_DE_TERMOS_PROIBIDOS = 8;

/** Os cabeçalhos por onde uma credencial de acesso chegaria — nenhum deles sai da sonda. */
const CABECALHOS_DE_CREDENCIAL = ['authorization', 'proxy-authorization', 'cookie', 'x-api-key'];

/** Um pedido tal como o par o recebeu — é sobre ele que o A2 é afirmado. */
interface PedidoObservado {
  readonly metodo: string;
  readonly caminho: string;
  readonly cabecalhosDeCredencial: readonly string[];
  readonly bytesDeCorpo: number;
}

/** O que o par instrumentado contabiliza. Instrumenta-se o **par**, nunca o adaptador. */
interface ParInstrumentado {
  readonly porta: number;
  handshakes: number;
  errosDeCliente: number;
  sessoesReusadas: number;
  abertas: number;
  readonly titularesApresentados: string[];
  readonly pedidos: PedidoObservado[];
}

/** Uma agulha e o rótulo pelo qual a reprovação a nomeia. */
interface Agulha {
  readonly rotulo: string;
  readonly valor: string;
}

/**
 * O par que basta para invocar a porta e para derivar as agulhas do segredo.
 *
 * `MaterialDeTeste` o satisfaz, e o CT-863 também — ele precisa de bytes que **não** são um PKCS#12
 * válido, e portanto de um par que o acessório de geração não tem como produzir. Descrever o mínimo é
 * o que evita uma segunda função de invocação só para esse caso.
 */
interface ParDeSegredo {
  readonly material: Buffer;
  readonly senha: string;
}

/**
 * As raízes como **conjunto**, sem depender de ordem nem de formatação.
 *
 * ⚠️ Medido: `setDefaultCACertificates` **reescreve** a lista que devolve depois — a ordem muda e as
 * linhas do PEM saem quebradas em outro comprimento (64 contra 74 colunas). A igualdade crua entre o
 * antes e o depois, portanto, reprovaria uma restauração **correta**. O que importa ao invariante é
 * o conjunto, e é ele que se compara: a raiz de teste a mais continua reprovando, que é o modo de
 * falha que esta conferência existe para pegar.
 */
function raizesComoConjunto(pems: readonly string[]): string[] {
  return pems.map((pem) => pem.replace(/\s+/g, '')).sort();
}

/**
 * Instala a autoridade de teste nas raízes do processo, e desfaz a instalação ao fim do caso.
 *
 * A restauração é **conferida** por igualdade de conjunto: instrumentação que sobrevivesse ao caso
 * mudaria a confiança dos casos vizinhos, e o vermelho apareceria longe da causa. A âncora antivácuo
 * está no próprio ato de instalar — a lista tem de crescer em exatamente uma raiz, senão o `aceito:
 * true` do CT-839 viria de o par de teste já ser confiável por outro motivo.
 */
function confiarEm(autoridade: AutoridadeDeTeste): void {
  const originais = getCACertificates('default');
  setDefaultCACertificates([...originais, autoridade.certificadoEmPem]);
  expect(getCACertificates('default').length).toBe(originais.length + 1);

  onTestFinished(() => {
    setDefaultCACertificates(originais);
    expect(raizesComoConjunto(getCACertificates('default'))).toEqual(raizesComoConjunto(originais));
  });
}

/**
 * Aponta a variável de ambiente para o destino e devolve o valor **lido dela**.
 *
 * O valor anterior é guardado e restaurado (ou removido) em `onTestFinished` — o idioma de
 * `apps/api/test/ambiente.spec.ts`. O caso lê da variável em vez de repassar a cadeia que acabou de
 * compor: é assim que ele afirma que o eixo do endereço é o **ambiente**.
 */
function apontarEnderecoDoProvedor(destino: string): string {
  const anterior = process.env[VARIAVEL_DO_ENDERECO];
  process.env[VARIAVEL_DO_ENDERECO] = destino;

  onTestFinished(() => {
    if (anterior === undefined) {
      delete process.env[VARIAVEL_DO_ENDERECO];
    } else {
      process.env[VARIAVEL_DO_ENDERECO] = anterior;
    }
  });

  return process.env[VARIAVEL_DO_ENDERECO] ?? '';
}

/**
 * Sobe o par TLS mútuo instrumentado em porta dinâmica, confiando **apenas** na autoridade dada.
 *
 * `requestCert` mais `rejectUnauthorized` é o que faz a recusa nascer da **decisão do par**, e não de
 * bytes divergentes. O par é encerrado em `onTestFinished`, com as conexões pendentes desfeitas — sem
 * isso o processo do Vitest não terminaria.
 */
async function subirParSeguro(
  autoridadeDoServidor: AutoridadeDeTeste,
  autoridadeConfiavel: AutoridadeDeTeste,
): Promise<ParInstrumentado> {
  const parDoServidor = await gerarParDeServidorDeTeste(autoridadeDoServidor, NOME_DO_PAR);

  const servidor: ServidorSeguro = criarParSeguro(
    {
      key: parDoServidor.chaveEmPem,
      cert: parDoServidor.certificadoEmPem,
      ca: [autoridadeConfiavel.certificadoEmPem],
      requestCert: true,
      rejectUnauthorized: true,
    },
    (pedido, resposta) => {
      let bytesDeCorpo = 0;
      pedido.on('data', (pedaco: Buffer) => {
        bytesDeCorpo += pedaco.length;
      });
      pedido.on('end', () => {
        observado.pedidos.push({
          metodo: pedido.method ?? '(sem método)',
          caminho: pedido.url ?? '(sem caminho)',
          cabecalhosDeCredencial: Object.keys(pedido.headers).filter((nome) =>
            CABECALHOS_DE_CREDENCIAL.includes(nome.toLowerCase()),
          ),
          bytesDeCorpo,
        });
        resposta.writeHead(404);
        resposta.end();
      });
    },
  );

  const observado: ParInstrumentado = {
    porta: 0,
    handshakes: 0,
    errosDeCliente: 0,
    sessoesReusadas: 0,
    abertas: 0,
    titularesApresentados: [],
    pedidos: [],
  };

  const pendentes = new Set<Duplex>();

  servidor.on('secureConnection', (ligacao) => {
    observado.handshakes += 1;
    observado.titularesApresentados.push(nomeComumDe(ligacao.getPeerCertificate()?.subject?.CN));
    if (ligacao.isSessionReused()) {
      observado.sessoesReusadas += 1;
    }
  });
  servidor.on('connection', (soquete) => {
    observado.abertas += 1;
    pendentes.add(soquete);
    soquete.once('close', () => {
      observado.abertas -= 1;
      pendentes.delete(soquete);
    });
  });
  servidor.on('tlsClientError', () => {
    observado.errosDeCliente += 1;
  });

  const porta = await escutarEmPortaDinamica(servidor);
  onTestFinished(() => encerrar(servidor, pendentes));

  return Object.assign(observado, { porta });
}

/**
 * Sobe um par **mudo**: aceita o TCP e nunca escreve nada, de modo que o aperto de mão nunca começa.
 *
 * TCP cru, sem TLS — basta para o `ClientHello` nunca ser respondido, que é o cenário do CT-842.
 */
async function subirParMudo(): Promise<number> {
  const pendentes = new Set<Duplex>();
  const servidor = criarParTcp((soquete) => {
    pendentes.add(soquete);
    soquete.once('close', () => pendentes.delete(soquete));
  });

  const porta = await escutarEmPortaDinamica(servidor);
  onTestFinished(() => encerrar(servidor, pendentes));

  return porta;
}

/**
 * Devolve uma porta **sabidamente sem ouvinte**: obtida por `listen(0)` e liberada antes do ato.
 *
 * Escolher um número *"que deve estar livre"* reintroduz a classe de corrida que
 * `packages/shared/test/reserva-de-porta.spec.ts` (CT-101/CT-102) existe para fechar.
 */
async function portaSemOuvinte(): Promise<number> {
  const servidor = criarParTcp();
  const porta = await escutarEmPortaDinamica(servidor);
  await new Promise<void>((resolver) => servidor.close(() => resolver()));

  return porta;
}

/**
 * Abre a porta sorteada pelo núcleo no laço local e devolve o número dela.
 *
 * O parâmetro é `net.Server` porque **os dois pares deste arquivo o são**: `https.Server` estende
 * `tls.Server`, que estende `net.Server`. Tipar pela base é o que dispensa uma segunda função para o
 * par mudo — e é mais estrito que descrever a forma à mão.
 */
function escutarEmPortaDinamica(servidor: ServidorTcp): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    servidor.listen(0, LACO_LOCAL, () => {
      const endereco = servidor.address();
      if (endereco === null || typeof endereco === 'string') {
        rejeitar(new Error('o par de teste não abriu porta de rede'));
        return;
      }
      resolver(endereco.port);
    });
  });
}

/**
 * O nome comum do par, tal como o runtime o entrega.
 *
 * O tipo admite **arranjo** para atributo repetido, e reduzi-lo a `String(valor)` produziria
 * `[object Object]` — a normalização é escrita para que a reprovação nomeie um titular legível.
 */
function nomeComumDe(nomeComum: string | readonly string[] | undefined): string {
  if (typeof nomeComum === 'string') {
    return nomeComum;
  }

  return Array.isArray(nomeComum) ? nomeComum.join(', ') : '(sem CN)';
}

/** Encerra o par e desfaz as conexões pendentes — `close()` sozinho esperaria a última terminar. */
function encerrar(servidor: ServidorTcp, pendentes: ReadonlySet<Duplex>): Promise<void> {
  for (const soquete of pendentes) {
    soquete.destroy();
  }

  return new Promise((resolver) => {
    servidor.close(() => resolver());
  });
}

/** O endereço seguro do par, na forma que a variável de ambiente carrega. */
function enderecoDoPar(porta: number): string {
  return `https://${LACO_LOCAL}:${porta}`;
}

/** Constrói o adaptador com o endereço **lido do ambiente** — nunca com a cadeia composta em linha. */
function adaptadorApontadoPara(porta: number): PortaDeIdentidadeBancaria {
  return criarAdaptadorSicoob({
    enderecoDoProvedor: apontarEnderecoDoProvedor(enderecoDoPar(porta)),
  });
}

/** Invoca a única operação da porta com o material dado, pelo caminho legítimo. */
function verificar(
  adaptador: PortaDeIdentidadeBancaria,
  material: ParDeSegredo,
): Promise<ResultadoDaVerificacaoDeIdentidade> {
  return adaptador.verificarIdentidade({
    segredo: criarSegredoOperavel({ material: material.material, senha: material.senha }),
  });
}

/** Sonda até o par não ter conexão aberta, com limite declarado — jamais `sleep` fixo. */
async function aguardarConexoesEncerradas(par: ParInstrumentado): Promise<void> {
  const prazo = Date.now() + LIMITE_DA_LIBERACAO_MS;
  while (par.abertas > 0 && Date.now() < prazo) {
    await new Promise((resolver) => setTimeout(resolver, INTERVALO_DA_SONDAGEM_MS));
  }
}

/**
 * Todas as superfícies do desfecho por onde um segredo ou um termo do provedor poderia sair.
 *
 * O espólio é o que a §6.6 fixa: inspeção profunda e serialização do valor devolvido, mais —
 * quando o ato lança, o que aqui nunca deve acontecer — mensagem, pilha, inspeção do erro e cada
 * propriedade própria dele.
 */
function espolioDe(alvo: unknown): string[] {
  const espolio: string[] = [
    inspect(alvo, {
      depth: null,
      showHidden: true,
      maxStringLength: null,
      maxArrayLength: null,
      breakLength: Number.POSITIVE_INFINITY,
    }),
  ];

  try {
    espolio.push(JSON.stringify(alvo) ?? '');
  } catch {
    // Ciclo na estrutura: a inspeção profunda acima já percorreu o objeto inteiro.
  }

  if (alvo instanceof Error) {
    espolio.push(alvo.message, alvo.stack ?? '');
  }

  if (typeof alvo === 'object' && alvo !== null) {
    for (const nome of Object.getOwnPropertyNames(alvo)) {
      espolio.push(nome, inspect(Reflect.get(alvo, nome), { depth: null, maxStringLength: null }));
    }
  }

  return espolio;
}

/**
 * Os rótulos das agulhas que aparecem em alguma superfície do alvo — **lista**, nunca booleano.
 *
 * Devolver a lista é o que faz a reprovação dizer *qual* agulha vazou e por qual desfecho; um
 * booleano diria apenas que a asserção caiu.
 */
function ocorrenciasDe(alvo: unknown, agulhas: readonly Agulha[], cenario: string): string[] {
  const espolio = espolioDe(alvo).map((superficie) => superficie.toLowerCase());

  return agulhas
    .filter((agulha) =>
      espolio.some((superficie) => superficie.includes(agulha.valor.toLowerCase())),
    )
    .map((agulha) => `${cenario}/${agulha.rotulo}`);
}

/** As três agulhas de um material: a senha real, o material inteiro em base64 e um recorte em hexa. */
function agulhasDe(material: ParDeSegredo): Agulha[] {
  return [
    { rotulo: 'senha', valor: material.senha },
    { rotulo: 'material-base64', valor: material.material.toString('base64') },
    { rotulo: 'material-hex', valor: material.material.subarray(0, 32).toString('hex') },
  ];
}

/**
 * Um objeto que **contém** todas as agulhas, cada uma numa superfície diferente.
 *
 * É o controle positivo exigido pelo AP-29. As agulhas são distribuídas de propósito entre mensagem,
 * pilha e objeto aninhado — se a varredura deixasse de percorrer qualquer uma dessas superfícies, o
 * controle reprovaria antes da asserção de ausência.
 */
function controleComAsAgulhas(agulhas: readonly Agulha[]): Error {
  const [primeira, segunda, terceira] = agulhas;
  const controle = new Error(`vazamento simulado: ${primeira?.valor ?? ''}`);
  controle.stack = `${controle.stack ?? ''}\n    em rotina falsa (${segunda?.valor ?? ''})`;

  return Object.assign(controle, {
    contexto: { certificado: { material: terceira?.valor ?? '' } },
  });
}

/** Um objeto de controle que carrega **todos** os termos proibidos, cada um numa superfície. */
function controleComOsTermos(): Error {
  const controle = new Error(`recusa crua: ${TERMOS_PROIBIDOS.slice(0, 4).join(' ')}`);
  controle.stack = `${controle.stack ?? ''}\n    em ${TERMOS_PROIBIDOS.slice(4, 8).join(' ')}`;

  return Object.assign(controle, {
    detalheCru: TERMOS_PROIBIDOS.slice(8).join(' '),
  });
}

/** Os termos proibidos presentes no desfecho serializado — lista, para a reprovação nomear. */
function termosProibidosEm(alvo: unknown): string[] {
  const espolio = espolioDe(alvo).map((superficie) => superficie.toLowerCase());

  return TERMOS_PROIBIDOS.filter((termo) =>
    espolio.some((superficie) => superficie.includes(termo)),
  );
}

/**
 * Quantos temporizadores estão vivos **neste instante** no processo.
 *
 * `process.getActiveResourcesInfo()` é API pública do runtime, e é o que torna o vazamento do
 * temporizador **observável** em vez de inferido: medido isoladamente, um `setTimeout` pendente sobe
 * a contagem em 1 e o `clearTimeout` a devolve. O CT-863 compara antes e depois do ato, de modo que
 * temporizadores alheios (o teto do próprio caso, por exemplo) entram nos dois lados e se cancelam.
 */
function temporizadoresVivos(): number {
  const vivos = process.getActiveResourcesInfo();

  return vivos.filter((recurso) => recurso === RECURSO_DE_TEMPORIZADOR).length;
}

/**
 * Conta quantas vezes um despachante foi desfeito durante o caso, e restaura o runtime ao fim.
 *
 * O despachante do adaptador nasce e morre **dentro** de `apertarMao` — não há referência a ele do
 * lado de fora, e no caminho síncrono nenhum socket chega a abrir, de modo que nenhuma conexão
 * pendente denunciaria a falta do desfazimento. Instrumentar o `prototype` do runtime é o que torna
 * essa liberação observável sem pedir ao adaptador um ponto de extensão que só o teste usaria — a lei
 * do seam proíbe o segundo caminho, e a fronteira do runtime é a mesma classe já instrumentada por
 * `tls.setDefaultCACertificates` neste arquivo e pelo CT-862 na T9.
 */
function contarDesfazimentosDoDespachante(): { total: number } {
  const original = Agent.prototype.destroy;
  const contagem = { total: 0 };

  Agent.prototype.destroy = function desfazerContando(this: Agent): void {
    contagem.total += 1;
    original.call(this);
  };

  onTestFinished(() => {
    Agent.prototype.destroy = original;
  });

  return contagem;
}

// DECISÃO FECHADA — T10 / Gate 1 · 2026-08-15
// O QUÊ: neste arquivo, a asserção que DISTINGUE um campo vem sempre ANTES do `toEqual` que fixa
//        esse campo — vale para as distinções entre os cinco `detalhe` e para a varredura de
//        `TERMOS_PROIBIDOS` e de detrito do runtime.
// POR QUÊ: o `toEqual` aborta o caso ao falhar, de modo que a distinção posta depois só executa
//        quando a igualdade já provou o valor do campo — e aí ela compara dois literais deste
//        arquivo, sem participação alguma do SUT, sem estado em que possa reprovar (AP-29). Foi
//        achado do Gate 1 na rodada 1 desta task, e da T9 antes dela; medido no mutante que colapsa
//        `DETALHE_RECUSA_PELO_PAR` no texto de `DETALHE_ACEITE`, que na ordem certa reprova
//        nomeando os dois textos e na inversa dizia apenas que dois objetos diferem.
// REVERTER EXIGE: provar que, com a distinção movida para DEPOIS da igualdade, ela ainda reprova
//        sob aquele mesmo mutante do colapso — execução medida pelo script do pacote
//        (`pnpm --filter @sysloc/cobranca-bancaria test`), nunca por `vitest run` avulso.
// ⚠️ A SAÍDA NÃO É IMPORTAR OS TEXTOS DO ARTEFATO para compor a distinção: isso faria o caso aprovar
//        qualquer texto, inclusive um que colapsasse dois desfechos num só (precedente da `DECISÃO
//        FECHADA` do CT-642 em `packages/regua/test/coordenadas-do-transporte.spec.ts`). A saída é
//        a ORDEM, e só ela.

describe('adaptador do provedor por TLS mútuo', () => {
  it('CT-839 — aperto de mão aceito, e o par recebeu o certificado daquela empresa', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const material = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });
    const par = await subirParSeguro(autoridade, autoridade);
    const adaptador = adaptadorApontadoPara(par.porta);

    const antes = Date.now();
    const desfecho = await verificar(adaptador, material);
    const depois = Date.now();

    // A1 — a promessa RESOLVE, e o objeto é igual por inteiro. Nunca presença de campo.
    expect(desfecho).toEqual({
      aceito: true,
      verificadoEm: desfecho.verificadoEm,
      detalhe: DETALHE_ACEITE,
    });

    // O carimbo é instante válido DENTRO da janela do ato — sem isto, `verificadoEm` acima seria
    // comparado consigo mesmo e qualquer cadeia serviria.
    const carimbo = Date.parse(desfecho.verificadoEm);
    expect(Number.isNaN(carimbo)).toBe(false);
    expect(carimbo).toBeGreaterThanOrEqual(antes);
    expect(carimbo).toBeLessThanOrEqual(depois);

    // A2 — a asserção que impede o caso de aprovar um adaptador que devolvesse `aceito: true` sem
    // apresentar certificado algum: o PAR contabilizou um aperto de mão, com o titular daquela
    // empresa.
    expect(par.handshakes).toBe(1);
    expect(par.titularesApresentados).toEqual([TITULAR_DA_EMPRESA.nomeComum]);
    expect(par.errosDeCliente).toBe(0);

    // A2 — nenhum corpo, nenhuma credencial de acesso, nenhum recurso consultado: o que chegou ao
    // par foi um pedido sem corpo, sem cabeçalho de credencial, na raiz.
    expect(par.pedidos).toEqual([
      { metodo: 'HEAD', caminho: '/', cabecalhosDeCredencial: [], bytesDeCorpo: 0 },
    ]);

    // A5 — nada sobrevive ao ato.
    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);
  });

  it('CT-840 — aperto de mão recusado pelo par, em vocabulário do produto', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    // A lista é conferida ANTES do uso: uma lista encolhida faria a varredura passar sem examinar
    // o bastante, e a ausência abaixo não significaria nada.
    expect(TERMOS_PROIBIDOS.length).toBeGreaterThanOrEqual(MINIMO_DE_TERMOS_PROIBIDOS);

    const acConfiavel = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    const acAlheia = await gerarAutoridadeDeTeste('Sysloc Alheia');
    confiarEm(acConfiavel);

    // A recusa nasce da DECISÃO DO PAR — material íntegro, emitido por autoridade que o par não
    // lista em `ca[]`. Bytes truncados seriam o CT-808, que é outra propriedade.
    const materialAlheio = await gerarMaterialDeTeste({
      autoridade: acAlheia,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });
    const par = await subirParSeguro(acConfiavel, acConfiavel);
    const adaptador = adaptadorApontadoPara(par.porta);

    const desfecho = await verificar(adaptador, materialAlheio);

    // Controle positivo (AP-29): a MESMA varredura, sobre um objeto que contém todos os termos,
    // devolve a lista inteira. Sem isto, a lista vazia abaixo seria compatível com um detector cego.
    expect(termosProibidosEm(controleComOsTermos())).toEqual([...TERMOS_PROIBIDOS]);

    // A8 — nada do desfecho carrega termo do provedor nem detrito do runtime de transporte.
    //
    // ⚠️ **A ORDEM É O CONTEÚDO, e não estilo.** Esta asserção vem ANTES da igualdade do objeto de
    // propósito: o único campo por onde termo proibido atravessa a porta é o `detalhe`, de modo
    // que, posta depois, ela seria implicada pela igualdade — que aborta o caso ao falhar — e
    // **nunca poderia reprovar**. É a forma do achado do Gate 1 na T9. Medido no mutante que anexa
    // o código cru do transporte ao detalhe: aqui a reprovação **nomeia** `econnreset`; na ordem
    // inversa, dizia apenas que dois objetos diferem.
    expect(termosProibidosEm(desfecho)).toEqual([]);

    // A3 — os desfechos são distinguíveis entre si. Uma implementação que colapsasse todos num
    // texto único reprova aqui, **nomeando** os dois textos que se confundiram.
    //
    // ⚠️ **A ORDEM É O CONTEÚDO**, pela mesma razão escrita doze linhas acima: `detalhe` é campo da
    // igualdade abaixo, de modo que, posta depois, esta asserção seria implicada por ela — que
    // aborta o caso ao falhar — e **nunca poderia reprovar**. Medido no mutante que colapsa
    // `DETALHE_RECUSA_PELO_PAR` no texto de `DETALHE_ACEITE`: aqui a reprovação nomeia a garantia
    // (*"expected 'a instituição aceitou…' not to be 'a instituição aceitou…'"*); na ordem inversa,
    // dizia apenas que dois objetos diferem, e esta linha nem executava.
    expect(desfecho.detalhe).not.toBe(DETALHE_ACEITE);
    expect(desfecho.detalhe).not.toBe(DETALHE_INDISPONIVEL);
    expect(desfecho.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

    // A1 — recusa é DESFECHO, nunca exceção.
    expect(desfecho).toEqual({
      aceito: false,
      verificadoEm: desfecho.verificadoEm,
      detalhe: DETALHE_RECUSA_PELO_PAR,
    });

    // O par de fato viu a conexão morrer no aperto de mão — a âncora antivácuo do cenário: sem
    // ela, um adaptador que nem tentasse conectar produziria a mesma recusa.
    expect(par.errosDeCliente).toBe(1);
    expect(par.handshakes).toBe(0);

    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);
  });

  it('CT-841 — provedor indisponível degrada para recusa nomeada, sem consumir o teto', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    const material = await gerarMaterialDeTeste({ autoridade, senha: SENHA_SENTINELA });

    const porta = await portaSemOuvinte();
    const adaptador = adaptadorApontadoPara(porta);

    const antes = Date.now();
    const desfecho = await verificar(adaptador, material);
    const decorrido = Date.now() - antes;

    // A3 — os dois desfechos negativos são DISTINGUÍVEIS: "não alcancei" e "não aceitou" pedem
    // ações opostas do Admin.
    //
    // ⚠️ **ANTES da igualdade**, e a ordem é o conteúdo: `detalhe` é campo dela, e posta depois esta
    // asserção seria implicada pela igualdade — que aborta o caso ao falhar — e nunca reprovaria.
    // Aqui a reprovação **nomeia** os dois textos colapsados; lá, dizia só que dois objetos diferem.
    expect(desfecho.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);
    expect(desfecho.detalhe).not.toBe(DETALHE_ACEITE);
    expect(desfecho.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

    // A1 e A6 — degrada para desfecho recusado, jamais para exceção que a borda traduza em `500`.
    expect(desfecho).toEqual({
      aceito: false,
      verificadoEm: desfecho.verificadoEm,
      detalhe: DETALHE_INDISPONIVEL,
    });

    // Separa "desistiu porque o destino recusou" de "esperou o teto".
    expect(decorrido).toBeLessThan(TETO_DA_INDISPONIBILIDADE_MS);
  });

  it('CT-842 — o teto de tempo governa por efeito', {
    timeout: LIMITE_DO_CASO_DO_TETO_MS,
  }, async () => {
    // O valor declarado, afirmado sobre a constante IMPORTADA do artefato — ver o cabeçalho.
    expect(TETO_DO_APERTO_DE_MAO_MS).toBe(10_000);

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    const material = await gerarMaterialDeTeste({ autoridade, senha: SENHA_SENTINELA });

    const porta = await subirParMudo();
    const adaptador = adaptadorApontadoPara(porta);

    const antes = Date.now();
    const desfecho = await verificar(adaptador, material);
    const decorrido = Date.now() - antes;

    // A3 — o texto do teto não se confunde com o dos outros dois desfechos negativos.
    //
    // ⚠️ **ANTES da igualdade**, e a ordem é o conteúdo: `detalhe` é campo dela, e posta depois esta
    // asserção seria implicada pela igualdade — que aborta o caso ao falhar — e nunca reprovaria.
    // Aqui a reprovação **nomeia** os dois textos colapsados; lá, dizia só que dois objetos diferem.
    expect(desfecho.detalhe).not.toBe(DETALHE_INDISPONIVEL);
    expect(desfecho.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);

    // A6 — o tempo esgotado é desfecho, e tem texto próprio.
    expect(desfecho).toEqual({
      aceito: false,
      verificadoEm: desfecho.verificadoEm,
      detalhe: DETALHE_TEMPO_ESGOTADO,
    });

    // A4 — os três lados que fecham a classe: teto ausente estoura o limite do próprio caso; teto
    // declarado e NÃO aplicado ao transporte, idem; teto trocado por outro número reprova pela
    // janela abaixo.
    expect(decorrido).toBeGreaterThanOrEqual(TETO_DO_APERTO_DE_MAO_MS - FOLGA_ABAIXO_DO_TETO_MS);
    expect(decorrido).toBeLessThan(TETO_DO_APERTO_DE_MAO_MS + FOLGA_ACIMA_DO_TETO_MS);
  });

  it('CT-843 — cliente por chamada: três atos, três apertos de mão, nada sobrevive', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const acConfiavel = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    const acAlheia = await gerarAutoridadeDeTeste('Sysloc Alheia');
    confiarEm(acConfiavel);

    const materialConfiavel = await gerarMaterialDeTeste({
      autoridade: acConfiavel,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });
    const materialAlheio = await gerarMaterialDeTeste({
      autoridade: acAlheia,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    const par = await subirParSeguro(acConfiavel, acConfiavel);
    // UMA ÚNICA instância para os TRÊS atos — é o que faz o caso medir o ciclo de vida do cliente,
    // e não o de três construções independentes.
    const adaptador = adaptadorApontadoPara(par.porta);

    const primeiro = await verificar(adaptador, materialConfiavel);
    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);

    // O SEGUNDO ato repete o material do primeiro **de propósito** — ver o cabeçalho: é o par de
    // atos idênticos que faz `sessoesReusadas` poder valer 1, e sem ele a asserção abaixo não
    // discrimina nada (medido: o mutante do despachante persistente sobrevivia).
    const segundo = await verificar(adaptador, materialConfiavel);
    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);

    const terceiro = await verificar(adaptador, materialAlheio);
    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);

    // O terceiro desfecho é decidido pelo material da TERCEIRA chamada: o `true` dos atos
    // anteriores não é herdado, e não há cache do material decifrado.
    expect(primeiro).toEqual({
      aceito: true,
      verificadoEm: primeiro.verificadoEm,
      detalhe: DETALHE_ACEITE,
    });
    expect(segundo).toEqual({
      aceito: true,
      verificadoEm: segundo.verificadoEm,
      detalhe: DETALHE_ACEITE,
    });
    expect(terceiro).toEqual({
      aceito: false,
      verificadoEm: terceiro.verificadoEm,
      detalhe: DETALHE_RECUSA_PELO_PAR,
    });

    // A5 — três atos, três conexões. A soma cobre a recusa que morre em `tlsClientError`.
    expect(par.handshakes + par.errosDeCliente).toBe(3);
    expect(par.handshakes).toBe(2);
    expect(par.errosDeCliente).toBe(1);

    // A asserção que discrimina o agrupamento de conexões: com despachante partilhado entre atos,
    // o par contabiliza `1` aqui — medido, e é o mutante que a forma anterior deste caso deixava
    // passar.
    expect(par.sessoesReusadas).toBe(0);
  });

  it('CT-844 — o segredo não escapa por nada que o adaptador devolva ou lance', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const acConfiavel = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    const acAlheia = await gerarAutoridadeDeTeste('Sysloc Alheia');
    confiarEm(acConfiavel);

    const materialConfiavel = await gerarMaterialDeTeste({
      autoridade: acConfiavel,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });
    const materialAlheio = await gerarMaterialDeTeste({
      autoridade: acAlheia,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    const par = await subirParSeguro(acConfiavel, acConfiavel);
    const portaMorta = await portaSemOuvinte();

    const cenarios = [
      { nome: 'aceito', porta: par.porta, material: materialConfiavel },
      { nome: 'recusado', porta: par.porta, material: materialAlheio },
      { nome: 'indisponivel', porta: portaMorta, material: materialConfiavel },
    ] as const;

    const ocorrencias: string[] = [];
    const erros: string[] = [];
    const aceitos: boolean[] = [];

    for (const cenario of cenarios) {
      const adaptador = criarAdaptadorSicoob({
        enderecoDoProvedor: enderecoDoPar(cenario.porta),
      });
      const agulhas = agulhasDe(cenario.material);

      try {
        const desfecho = await verificar(adaptador, cenario.material);
        aceitos.push(desfecho.aceito);
        ocorrencias.push(...ocorrenciasDe(desfecho, agulhas, cenario.nome));
      } catch (falha) {
        erros.push(cenario.nome);
        ocorrencias.push(...ocorrenciasDe(falha, agulhas, cenario.nome));
      }
    }

    // Controle positivo (AP-29): a MESMA varredura, sobre um objeto que contém as três agulhas em
    // superfícies diferentes, devolve as três — provando que ela acha o que existe.
    expect(
      ocorrenciasDe(
        controleComAsAgulhas(agulhasDe(materialConfiavel)),
        agulhasDe(materialConfiavel),
        'controle',
      ),
    ).toEqual(['controle/senha', 'controle/material-base64', 'controle/material-hex']);

    // A7 — medido sobre a SAÍDA REAL, nos três desfechos, e nunca por leitura do fonte (ADR-0032).
    expect(ocorrencias).toEqual([]);

    // Nenhum cenário lançou — A1 medido de novo, por outro caminho.
    expect(erros).toEqual([]);

    // Âncora antivácuo: os três cenários de fato percorreram desfechos distintos. Sem ela, três
    // atos que falhassem na construção varreriam objetos vazios e a lista acima seria vazia por
    // não ter havido ato nenhum.
    expect(aceitos).toEqual([true, false, false]);

    await aguardarConexoesEncerradas(par);
    expect(par.abertas).toBe(0);
  });

  it('CT-863 — material que não abre resolve com desfecho próprio, sem detrito e sem sobra', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    // O destino é bem formado e sabidamente sem ouvinte: se a construção da requisição NÃO lançasse,
    // o ato iria à rede e o desfecho seria `DETALHE_INDISPONIVEL`. É o que faz a igualdade lá embaixo
    // discriminar de fato, em vez de aprovar qualquer negativa.
    const porta = await portaSemOuvinte();
    const adaptador = adaptadorApontadoPara(porta);
    const segredo: ParDeSegredo = { material: MATERIAL_QUE_NAO_ABRE, senha: SENHA_SENTINELA };

    const desfazimentos = contarDesfazimentosDoDespachante();
    const temporizadoresAntes = temporizadoresVivos();

    let desfecho: ResultadoDaVerificacaoDeIdentidade | undefined;
    const vazadoPelaRejeicao: string[] = [];

    const antes = Date.now();
    try {
      desfecho = await verificar(adaptador, segredo);
    } catch (falha) {
      // A rejeição é O defeito que este caso existe para fechar, e capturá-la — em vez de deixar o
      // caso morrer nela — é o que faz a reprovação NOMEAR o que atravessou a porta. Sob o código
      // anterior a esta correção, esta lista sai `['rejeitou/not-enough-data']`.
      vazadoPelaRejeicao.push(...ocorrenciasDe(falha, AGULHAS_DO_RUNTIME_DE_MATERIAL, 'rejeitou'));
    }
    const decorrido = Date.now() - antes;

    // A1 — a operação da porta RESOLVE em todos os desfechos e **nunca rejeita** (contrato absoluto
    // de `porta-de-identidade.ts`). Uma rejeição aqui a borda traduziria em `500`, e o Admin leria
    // "o sistema falhou" onde o fato é "o certificado não pôde ser apresentado" — a inversão da
    // RN-06 que este adaptador existe para evitar.
    expect(vazadoPelaRejeicao).toEqual([]);

    // Controle positivo (AP-29): a MESMA varredura, sobre um objeto que carrega os dois detritos em
    // superfícies diferentes, devolve os dois. Sem isto, a lista vazia abaixo seria compatível com
    // um detector cego — que é exatamente o que uma prova de ausência arrisca ser.
    expect(
      ocorrenciasDe(
        controleComAsAgulhas(AGULHAS_DO_RUNTIME_DE_MATERIAL),
        AGULHAS_DO_RUNTIME_DE_MATERIAL,
        'controle',
      ),
    ).toEqual(['controle/mac-verify-failure', 'controle/not-enough-data']);

    // A8 — o texto cru do OpenSSL não atravessa a porta por caminho nenhum. ⚠️ ANTES da igualdade,
    // pela `DECISÃO FECHADA` acima: `detalhe` é campo dela, e posta depois esta asserção não teria
    // estado em que reprovar.
    expect(ocorrenciasDe(desfecho, AGULHAS_DO_RUNTIME_DE_MATERIAL, 'nao-iniciado')).toEqual([]);
    expect(termosProibidosEm(desfecho)).toEqual([]);

    // A7 — nem a senha nem os bytes do material saem no desfecho, como nos outros três cenários.
    expect(ocorrenciasDe(desfecho, agulhasDe(segredo), 'nao-iniciado')).toEqual([]);

    // A3 — o quinto texto é distinto dos outros quatro. Reusar qualquer um deles seria mentir sobre
    // o que aconteceu, e a reprovação aqui **nomeia** os dois textos que se confundiram.
    expect(desfecho?.detalhe).not.toBe(DETALHE_ACEITE);
    expect(desfecho?.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);
    expect(desfecho?.detalhe).not.toBe(DETALHE_INDISPONIVEL);
    expect(desfecho?.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

    // A1 — o objeto inteiro por igualdade, jamais presença de campo.
    expect(desfecho).toEqual({
      aceito: false,
      verificadoEm: desfecho?.verificadoEm,
      detalhe: DETALHE_NAO_INICIADO,
    });

    // A falha é da construção, e ela é imediata: nada de esperar o teto para responder o que já se
    // sabia. Separa "recusou de pronto" de "pendurou o Admin por 10 s".
    expect(decorrido).toBeLessThan(TETO_DA_INDISPONIBILIDADE_MS);

    // A5 — nada sobrevive ao ato, **também** neste caminho: o temporizador de 10 s foi limpo e o
    // despachante foi desfeito exatamente uma vez, pelo mesmo ponto único de saída dos outros
    // quatro desfechos. É o que discrimina "respondeu certo" de "respondeu certo e não deixou
    // detrito" — a diferença entre engolir a exceção e tratá-la.
    expect(temporizadoresVivos()).toBe(temporizadoresAntes);
    expect(desfazimentos.total).toBe(1);
  });
});
