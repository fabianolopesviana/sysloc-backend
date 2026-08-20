/**
 * Verificação do **adaptador mTLS contra o provedor** — CT-839 a CT-844 e CT-863 da fatia
 * `fundacao-bancaria`, mais o CT-943 da fatia `emissao-e-conciliacao` e o par CT-1008/CT-1009 da
 * fatia `webhook-e-carne`.
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
 * | CA-20    | CT-943 | O adaptador obtém a credencial de acesso **uma vez por empresa** e a
 * |          |        | reaproveita enquanto viva; passado o prazo, obtém **uma nova**; e a
 * |          |        | credencial de uma empresa **nunca** é apresentada em chamada de outra. As
 * |          |        | obtenções são **`=== 3` exatas** no cenário — nunca 20, nunca 2. |
 * | CA-20    | CT-943 | O `nossoNumero` que o provedor devolve como **inteiro** atravessa a porta
 * |          | (b)    | como **cadeia**: a coerção acontece na fronteira do adaptador. |
 * | CA-20    | CT-949 | Cadeia de terceiro que normalize para propriedade de `Object.prototype`
 * |          |        | **não vira estado do produto**: as sete recusam com o motivo da situação
 * |          |        | desconhecida, e a cadeia declarada continua atravessando. |
 * | CA-20    | CT-950 | Valor pago em grafia **ambígua** é recusado com o motivo da liquidação
 * |          |        | incompleta, nunca convertido em silêncio; a grafia inequívoca atravessa
 * |          |        | como o número que o provedor informou. |
 * | RN-02    | CT-951 | A credencial do ato **não aparece** no motivo quando o provedor ecoa o
 * |          |        | cabeçalho que a portava — medido sobre a saída real, com controle
 * |          |        | positivo, e com o resto do texto do provedor preservado íntegro. |
 * | CA-20    | CT-952 | Credencial cuja validade restante é menor que a margem é **renovada antes
 * |          |        | de ser apresentada**; fora da margem ela continua sendo reaproveitada. |
 * | —        | CT-1008| A construção **recusa** endereço que não serve — sem esquema, com esquema
 * |          |        | não-HTTPS e vazio —, sempre com a MESMA mensagem, que nomeia a
 * |          |        | **variável** e jamais ecoa o valor recusado. Sem fronteira de rede. |
 * | —        | CT-1009| E o endereço **bem formado** constrói: as três formas boas devolvem um
 * |          |        | objeto com **exatamente** as cinco capacidades da porta. É o companheiro
 * |          |        | que impede uma guarda degenerada em *recusa tudo* de satisfazer o
 * |          |        | CT-1008. |
 *
 * Rastreabilidade: `CA-07 → CT-839, CT-840, CT-841, CT-863 (RN-06)` ·
 * `CA-13 → CT-840, CT-863 (RN-10)` · `RN-02 → CT-844, CT-863, CT-951` ·
 * `CA-20 → CT-943, CT-949, CT-950, CT-952 (RN-15)` · `D38 · F4/T10 → CT-1008, CT-1009`.
 *
 * ---------------------------------------------------------------------------
 * Os QUATRO casos da correção do Gate 2 — e por que eles nasceram fora da faixa
 * ---------------------------------------------------------------------------
 *
 * `CT-949`…`CT-952` são acréscimo da rodada de correção da T8 (2026-08-17). A faixa desta fatia
 * fecha em `CT-948` e está inteiramente alocada, de modo que os casos novos seguem a numeração para
 * frente — a contagem escrita em prosa sobe na **T17**, que é quem reconcilia toda a fatia.
 *
 * Eles existem porque o Gate 2 mediu **dois** defeitos que vivem exatamente nos ramos que o CT-943
 * não percorre — o cotejo de situação e o caminho da liquidação —, e cobrou a rede comportamental do
 * P4 da `nao-regressao.md` junto da correção. Os outros dois fecham os anotáveis da mesma revisão: a
 * credencial no motivo (`security`) e a margem de renovação (`error_handling`).
 *
 * ⚠️ **Nenhum deles tem mutante**, e a ausência é decisão: mutation testing está fora da stack deste
 * projeto (`.claude/rules/testing-stack.md`, 2026-08-16) e o P4 só exige demonstração por execução
 * para asserção **estática**. Os quatro são comportamentais, e a asserção que discrimina cada um
 * está nomeada em comentário no próprio caso.
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
 * ADR-0006**: a fronteira é o laço local, em porta que o próprio processo abre. Agrupamento de
 * conexões, disjuntor e repetição não existem por decisão (D6-b).
 *
 * ---------------------------------------------------------------------------
 * O CT-943 e o par instrumentado: quem identifica a empresa é o CERTIFICADO
 * ---------------------------------------------------------------------------
 *
 * O par do CT-943 fala o dialeto do provedor **de mentira e por inteiro**: concede credencial de
 * acesso a quem apresenta certificado, e responde à emissão com o envelope `resultado` e o
 * `nossoNumero` **inteiro** que a §13-A.4 do discovery mediu. Ele não recebe do produto nenhum
 * identificador de empresa — quem lhe diz de quem é o ato é o **titular do certificado apresentado no
 * aperto de mão**, que é como o provedor de verdade também sabe. É isso que torna a asserção
 * *"a credencial de B nunca acompanhou uma chamada de A"* uma medição sobre o que **saiu do produto**,
 * e não sobre o que o teste plantou.
 *
 * ⚠️ **O relógio chega pela assinatura do criador do adaptador**, e o prazo é a constante do artefato
 * (`PRAZO_PADRAO_DA_CREDENCIAL_S`). Não há `vi.useFakeTimers` — proibido pela stack de teste deste
 * projeto — e não há pausa fixa: atravessar cinco minutos de validade custa uma soma.
 *
 * ⚠️ A constante do prazo é **importada** do artefato pela mesma razão do teto no CT-842, e pela
 * mesma assimetria declarada acima: o que se mede aqui é o **efeito** dela — antes do prazo a
 * credencial é reaproveitada, depois dele é obtida de novo —, e não o texto dela. O valor declarado é
 * afirmado por igualdade, para que trocar o prazo por outro número reprove.
 */

import type { ServerResponse } from 'node:http';
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
import type { FonteDeTempo } from '../src/credencial-de-acesso.ts';
import {
  MARGEM_DE_RENOVACAO_S,
  PRAZO_PADRAO_DA_CREDENCIAL_S,
} from '../src/credencial-de-acesso.ts';
import type {
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  PedidoDeEmissao,
  ResultadoDaVerificacaoDeIdentidade,
  SituacaoConsultada,
} from '../src/modelo-canonico.ts';
import type { AdaptadorCobrancaBancaria } from '../src/porta-de-cobranca.ts';
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

/**
 * O motivo da recusa por forma, **copiado à mão** do adaptador — nunca importado dele.
 *
 * Importá-lo poria o artefato sob prova nos dois lados da igualdade: a asserção continuaria verde com
 * qualquer redação, inclusive uma que ecoasse o valor recusado. O que ela existe para fixar é
 * exatamente o contrário — a mensagem nomeia a **variável**, e jamais o endereço que o operador
 * escreveu errado (o `TypeError` do `new URL` traz a cadeia recusada em `input`, e deixá-lo subir cru
 * ecoaria a entrada).
 */
const MOTIVO_DA_RECUSA_POR_FORMA =
  'o adaptador do provedor bancário não é construído com esta variável em forma que não serve de ' +
  'endereço seguro';

/** A recusa por forma, por extenso — motivo mais a variável, e nada além disso. */
const RECUSA_POR_FORMA_POR_EXTENSO = `${MOTIVO_DA_RECUSA_POR_FORMA}: ${VARIAVEL_DO_ENDERECO}`;

/** Uma forma de endereço que a construção tem de recusar, com o nome do defeito que ela representa. */
interface FormaRecusada {
  readonly forma: string;
  readonly endereco: string;
}

/**
 * As **três** formas de endereço inutilizável, cada uma nomeando o defeito que ela representa.
 *
 * As três não são a mesma prova, e a escolha cobre os **dois** ramos da guarda: a primeira e a
 * terceira chegam pelo ramo em que `new URL` lança, e a segunda pelo ramo do esquema. A primeira é a
 * mais traiçoeira das três, e por isso está aqui: `hospedeiro:porta` **não** faz `new URL` lançar —
 * ele é aceito como um esquema inventado (`par-de-teste.sysloc:`) com hospedeiro **vazio**, de modo
 * que uma guarda que só tratasse a exceção do parser deixaria passar um destino sem hospedeiro
 * nenhum.
 */
const FORMAS_RECUSADAS: readonly FormaRecusada[] = [
  { forma: 'sem esquema', endereco: `${NOME_DO_PAR}:8443` },
  { forma: 'esquema não-HTTPS', endereco: `http://${NOME_DO_PAR}:8443` },
  { forma: 'endereço vazio', endereco: '' },
];

/**
 * Endereços **bem formados** que a construção tem de aceitar — o companheiro que impede "recusa
 * tudo" de passar.
 *
 * Os três exercitam ramos distintos de {@link resolverDestino}: a porta explícita, a porta **omitida**
 * (que cai no padrão seguro) e o caminho depois do hospedeiro, que não é destino e é descartado.
 */
const ENDERECOS_ACEITOS = [
  `https://${NOME_DO_PAR}:8443`,
  `https://${NOME_DO_PAR}`,
  `https://${NOME_DO_PAR}:8443/cobranca-bancaria/v3`,
] as const;

/**
 * As **cinco** capacidades que o adaptador construído publica — as quatro da porta de cobrança mais
 * a sonda de identidade.
 *
 * Escritas por extenso, e jamais derivadas do objeto devolvido: derivar poria o artefato sob prova
 * nos dois lados da igualdade, e a asserção passaria a não poder falhar.
 */
const CAPACIDADES_DO_ADAPTADOR = [
  'confirmarRevogacaoDeBoleto',
  'consultarSituacao',
  'emitir',
  'solicitarRevogacaoDeBoleto',
  'verificarIdentidade',
] as const;

/** A senha **real** do cofre, e a mesma que os casos usam como agulha. */
const SENHA_SENTINELA = 'senha-real-do-cofre-a7d419fe2c';

/** O titular do material da empresa — o que o par tem de ver no aperto de mão aceito. */
const TITULAR_DA_EMPRESA = {
  pais: 'BR',
  organizacao: 'Locadora Modelo SA',
  nomeComum: '11222333000181',
} as const;

/** O titular da **segunda** empresa do CT-943 — é por ele que o par instrumentado a distingue. */
const TITULAR_DA_OUTRA_EMPRESA = {
  pais: 'BR',
  organizacao: 'Locadora Vizinha SA',
  nomeComum: '44555666000199',
} as const;

/** As duas empresas do CT-943, como o produto as identifica — nunca lidas de requisição. */
const EMPRESA_A = '3f1c2a7e-9b64-4d0a-9c2e-5f8a1b7d4e60';
const EMPRESA_B = '7a9d6e13-2c85-4f7b-8d31-6b0e2a5c9f44';

/** Quantas operações cada empresa executa no CT-943, e onde o relógio cruza o prazo. */
const OPERACOES_POR_EMPRESA = 10;
const OPERACOES_ANTES_DA_RENOVACAO = 5;

/**
 * O número que o par instrumentado devolve como **inteiro** — o dialeto medido (§13-A.4).
 *
 * Ele é `number` neste arquivo de propósito: é o que o provedor real devolve, e é sobre ele que a
 * coerção do adaptador é medida. A cadeia esperada é escrita à parte, e não derivada dele, para que
 * a asserção não repita a conversão que ela existe para provar.
 */
const NUMERO_DO_TITULO_INTEIRO = 3009274;
const NUMERO_DO_TITULO_EM_CADEIA = '3009274';

/** O resto do que o par devolve na emissão — os dois meios de pagamento e os bytes do documento. */
const LINHA_DIGITAVEL_DO_PAR = '75691112233445566778899001122334455667788990';
const CODIGO_DE_BARRAS_DO_PAR = '75699890100000100005678901234567890123456789';
const DOCUMENTO_DO_PAR = Buffer.from('documento-de-boleto-do-par-de-teste');

/** O instante de partida do relógio injetado — valor fixo, para que o caso não dependa do relógio real. */
const INSTANTE_INICIAL_MS = Date.parse('2026-08-17T09:00:00.000Z');

/** Quanto o relógio avança para atravessar o prazo — **derivado da constante do artefato**. */
const MILISSEGUNDOS_POR_SEGUNDO = 1_000;
const AVANCO_ALEM_DO_PRAZO_MS = (PRAZO_PADRAO_DA_CREDENCIAL_S + 1) * MILISSEGUNDOS_POR_SEGUNDO;

/**
 * Com que folga o CT-952 se aproxima da margem — **pelos dois lados**, e derivada das constantes.
 *
 * O caso mede a fronteira, e por isso precisa de um instante **fora** dela (a credencial continua
 * sendo reaproveitada) e de um **dentro** (ela é renovada antes de ser apresentada). Sem o primeiro,
 * um cache que renovasse a cada chamada passaria no caso.
 */
const FOLGA_EM_TORNO_DA_MARGEM_S = 10;
const AVANCO_ANTES_DA_MARGEM_MS =
  (PRAZO_PADRAO_DA_CREDENCIAL_S - MARGEM_DE_RENOVACAO_S - FOLGA_EM_TORNO_DA_MARGEM_S) *
  MILISSEGUNDOS_POR_SEGUNDO;
const AVANCO_ATE_DENTRO_DA_MARGEM_MS = 2 * FOLGA_EM_TORNO_DA_MARGEM_S * MILISSEGUNDOS_POR_SEGUNDO;

/**
 * Os dois motivos da tradução de volta, **copiados** do artefato — jamais importados.
 *
 * Mesma disciplina dos cinco `detalhe` acima, e pela mesma razão: importá-los faria o caso aprovar
 * qualquer texto, inclusive um que colapsasse *"situação que o produto não trata"* em *"pagamento
 * sem data ou sem valor"*, que são exatamente os dois desfechos que o CT-949 e o CT-950 separam.
 */
const MOTIVO_DE_SITUACAO_DESCONHECIDA =
  'a instituição informou uma situação que o produto não trata';

const MOTIVO_DE_LIQUIDACAO_INCOMPLETA =
  'a instituição informou o pagamento sem a data ou sem o valor, e ele não pode ser aplicado';

/**
 * As cadeias que um objeto literal devolveria **sem ninguém as ter declarado** — o eixo do CT-949.
 *
 * `constructor` vem primeiro porque é a que **escapava**: ela já é minúscula e sem sublinhado, de
 * modo que atravessa a normalização intacta, e o acesso a um objeto literal a devolvia como
 * **função**. As demais eram neutralizadas **por acidente** — `__proto__` perde os sublinhados na
 * normalização, e as outras não casam em minúscula —, e acidente não é garantia: elas estão aqui
 * para que a recusa seja afirmada da classe inteira, e não do único caso medido.
 */
const CADEIAS_DO_PROTOTIPO = [
  'constructor',
  '__proto__',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'isPrototypeOf',
  'propertyIsEnumerable',
] as const;

/** O que o par informa como situação e data quando o caso mede o **valor** do pagamento. */
const SITUACAO_LIQUIDADA_DO_PAR = 'liquidado';
const DATA_DO_PAGAMENTO_DO_PAR = '2026-09-10';

/**
 * As grafias de valor pago que o CT-950 submete, e o que cada uma **tem de** produzir.
 *
 * ⚠️ **As quatro primeiras são as inequívocas** — leem-se igual em qualquer convenção — e atravessam
 * como número. As cinco últimas são ambíguas ou exóticas, e **todas** caem na recusa que já existia:
 * `1.234` é a que importa, porque era a única que o `Number(valor.replace(',', '.'))` aceitava **e
 * lia errado**, gravando R$ 1,23 onde o provedor informou R$ 1.234,00.
 */
const ROTULO_DO_MILHAR = 'milhar com ponto, sem centavos';

const GRAFIAS_DO_VALOR_PAGO: readonly {
  readonly rotulo: string;
  readonly bruto: unknown;
  readonly esperado: number | string;
}[] = [
  { rotulo: 'número, como o dialeto o mede', bruto: 1234.56, esperado: 1234.56 },
  { rotulo: 'texto com vírgula decimal', bruto: '1234,56', esperado: 1234.56 },
  { rotulo: 'texto com ponto decimal', bruto: '1234.56', esperado: 1234.56 },
  { rotulo: 'texto inteiro', bruto: '1234', esperado: 1234 },
  { rotulo: ROTULO_DO_MILHAR, bruto: '1.234', esperado: MOTIVO_DE_LIQUIDACAO_INCOMPLETA },
  {
    rotulo: 'milhar com ponto e centavos',
    bruto: '1.234,56',
    esperado: MOTIVO_DE_LIQUIDACAO_INCOMPLETA,
  },
  {
    rotulo: 'milhão com dois pontos',
    bruto: '1.234.567,89',
    esperado: MOTIVO_DE_LIQUIDACAO_INCOMPLETA,
  },
  { rotulo: 'milhar com vírgula', bruto: '1,234', esperado: MOTIVO_DE_LIQUIDACAO_INCOMPLETA },
  { rotulo: 'notação científica', bruto: '1e3', esperado: MOTIVO_DE_LIQUIDACAO_INCOMPLETA },
];

/** O código com que o par recusa a operação no CT-951 — falha **daquela cobrança**, não da empresa. */
const CODIGO_DE_RECUSA_DA_COBRANCA = 400;

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

/** Uma chamada de operação como o par a recebeu — quem a apresentou, e o que ela portava. */
interface ChamadaObservada {
  /** O nome comum do certificado apresentado no aperto de mão — é ele que identifica a empresa. */
  readonly titular: string;
  /** O cabeçalho de autorização, tal como saiu do produto. */
  readonly credencial: string;
  readonly caminho: string;
  readonly corpo: string;
}

/**
 * O provedor de mentira do CT-943: concede credencial a quem apresenta certificado, e responde.
 *
 * Ele não recebe identificador de empresa nenhum do produto — quem lhe diz de quem é o ato é o
 * **titular do certificado**, exatamente como o provedor de verdade sabe. Ver o cabeçalho.
 */
interface ProvedorInstrumentado {
  readonly porta: number;
  /** O titular de cada obtenção de credencial, na ordem. O comprimento é a contagem do CT-943. */
  readonly obtencoes: string[];
  readonly chamadas: ChamadaObservada[];
}

/** O que o par devolve a uma operação — o código da resposta e o corpo, no dialeto do provedor. */
interface RespostaDoPar {
  readonly codigo: number;
  readonly corpo: unknown;
}

/** Responde em JSON — o tipo de mídia que o adaptador declara aceitar nas operações. */
function responderEmJson(resposta: ServerResponse, corpo: unknown, codigo = 200): void {
  resposta.writeHead(codigo, { 'content-type': 'application/json' });
  resposta.end(JSON.stringify(corpo));
}

/** A resposta padrão do par a uma operação — o dialeto da emissão medido na §13-A.4. */
function respostaDaEmissao(): RespostaDoPar {
  return {
    codigo: 200,
    corpo: {
      resultado: {
        nossoNumero: NUMERO_DO_TITULO_INTEIRO,
        linhaDigitavel: LINHA_DIGITAVEL_DO_PAR,
        codigoBarras: CODIGO_DE_BARRAS_DO_PAR,
        pdfBoleto: DOCUMENTO_DO_PAR.toString('base64'),
      },
    },
  };
}

/**
 * Sobe o provedor instrumentado em porta dinâmica, exigindo certificado de cliente.
 *
 * O discriminador entre *"pedido de credencial"* e *"operação"* é **estrutural e é conteúdo**: o
 * pedido de credencial é o único que chega **sem** cabeçalho de autorização, porque é ele que a
 * produz. Distinguir pelo caminho faria o par conhecer um detalhe interno do adaptador; distinguir
 * pela ausência da credencial mede, de quebra, que a obtenção não apresenta credencial nenhuma.
 *
 * ⚠️ **O que o par responde às operações é do CASO, e o padrão continua sendo a emissão.** Os casos
 * da tradução de volta (CT-949, CT-950 e CT-951) precisam do par falando situações e recusas, e a
 * alternativa — um segundo par de teste — seria a terceira cópia da maquinaria TLS deste arquivo,
 * livre para divergir das duas primeiras. A função **não recebe o caminho como discriminador**, pelo
 * mesmo motivo da nota acima: quem decide é a ordem das chamadas, que o caso controla.
 */
async function subirProvedorInstrumentado(
  autoridade: AutoridadeDeTeste,
  responderOperacao: (chamada: ChamadaObservada) => RespostaDoPar = respostaDaEmissao,
): Promise<ProvedorInstrumentado> {
  const parDoServidor = await gerarParDeServidorDeTeste(autoridade, NOME_DO_PAR);
  const titularPorSoquete = new Map<Duplex, string>();
  const pendentes = new Set<Duplex>();

  const observado: ProvedorInstrumentado = { porta: 0, obtencoes: [], chamadas: [] };

  const servidor: ServidorSeguro = criarParSeguro(
    {
      key: parDoServidor.chaveEmPem,
      cert: parDoServidor.certificadoEmPem,
      ca: [autoridade.certificadoEmPem],
      requestCert: true,
      rejectUnauthorized: true,
    },
    (pedido, resposta) => {
      const pedacos: Buffer[] = [];
      pedido.on('data', (pedaco: Buffer) => {
        pedacos.push(pedaco);
      });
      pedido.on('end', () => {
        const titular = titularPorSoquete.get(pedido.socket) ?? '(sem titular)';
        const autorizacao = pedido.headers.authorization;

        if (autorizacao === undefined) {
          observado.obtencoes.push(titular);
          responderEmJson(resposta, {
            access_token: `credencial-${titular}-${observado.obtencoes.length}`,
            token_type: 'Bearer',
            expires_in: PRAZO_PADRAO_DA_CREDENCIAL_S,
          });
          return;
        }

        const chamada: ChamadaObservada = {
          titular,
          credencial: autorizacao,
          caminho: pedido.url ?? '(sem caminho)',
          corpo: Buffer.concat(pedacos).toString('utf8'),
        };
        observado.chamadas.push(chamada);

        // O padrão é o envelope `resultado` com o `nossoNumero` INTEIRO — o dialeto da §13-A.4.
        const devolvido = responderOperacao(chamada);
        responderEmJson(resposta, devolvido.corpo, devolvido.codigo);
      });
    },
  );

  servidor.on('secureConnection', (ligacao) => {
    titularPorSoquete.set(ligacao, nomeComumDe(ligacao.getPeerCertificate()?.subject?.CN));
  });
  servidor.on('connection', (soquete) => {
    pendentes.add(soquete);
    soquete.once('close', () => pendentes.delete(soquete));
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

/**
 * Constrói o adaptador com o relógio injetado — a fonte de tempo chega pela **assinatura**.
 *
 * É a única precondição privilegiada do CT-943, e ela é fronteira legítima do artefato: sem ela,
 * atravessar o prazo de validade custaria cinco minutos de suíte, e o relógio falso instalado no
 * runtime está fora da stack de teste deste projeto.
 */
function adaptadorComRelogio(
  porta: number,
  agora: FonteDeTempo,
): PortaDeIdentidadeBancaria & AdaptadorCobrancaBancaria {
  return criarAdaptadorSicoob({
    enderecoDoProvedor: apontarEnderecoDoProvedor(enderecoDoPar(porta)),
    agora,
  });
}

/** Um pedido de emissão pelo caminho legítimo — o vocabulário do produto, e nada do provedor. */
function pedidoDeEmissao(
  empresaId: string,
  material: ParDeSegredo,
  ordem: number,
): PedidoDeEmissao {
  return {
    empresaId,
    segredo: criarSegredoOperavel({ material: material.material, senha: material.senha }),
    identificadorNoProvedor: `202608${String(ordem).padStart(12, '0')}`,
    valor: 1234.56,
    vencimento: '2026-09-10',
    locatario: {
      nome: 'Locatario de Teste',
      documento: '12345678909',
      logradouro: 'Rua das Flores',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Palmas',
      estado: 'TO',
      cep: '77000000',
    },
  };
}

/** Uma consulta de situação pelo caminho legítimo da porta — o vocabulário do produto. */
function consultaDeSituacao(material: ParDeSegredo): ConsultaDeSituacao {
  return {
    empresaId: EMPRESA_A,
    segredo: criarSegredoOperavel({ material: material.material, senha: material.senha }),
    numeroDoTituloNoProvedor: NUMERO_DO_TITULO_EM_CADEIA,
    incluirDocumento: false,
  };
}

/** O corpo com que o par informa uma situação — sempre sob o envelope `resultado` do dialeto. */
function respostaDeSituacao(campos: Record<string, unknown>): RespostaDoPar {
  return { codigo: 200, corpo: { resultado: campos } };
}

/**
 * Faz o par responder as respostas declaradas **na ordem das operações** — uma por chamada.
 *
 * A ordem é determinística porque os casos que a usam consultam em sequência, uma consulta por vez.
 * Uma chamada além das declaradas devolve falha do provedor, para que o excesso apareça como
 * desfecho errado em vez de repetir a última resposta em silêncio.
 */
function respostasEmOrdem(
  respostas: readonly RespostaDoPar[],
): (chamada: ChamadaObservada) => RespostaDoPar {
  let proxima = 0;

  return () =>
    respostas[proxima++] ?? { codigo: 500, corpo: { erro: 'chamada além das declaradas' } };
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

  it('CT-943 — a credencial é reaproveitada por empresa, renovada por expiração, e nunca cruza', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    // O prazo declarado, afirmado sobre a constante IMPORTADA do artefato — mesma disciplina do
    // teto no CT-842: trocar 300 por outro número reprova aqui, e o avanço do relógio abaixo é
    // derivado dela, e não de um literal reescrito neste arquivo.
    expect(PRAZO_PADRAO_DA_CREDENCIAL_S).toBe(300);

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const materialDeA = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });
    const materialDeB = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_OUTRA_EMPRESA,
    });

    const provedor = await subirProvedorInstrumentado(autoridade);

    // O relógio é do caso, e desce ao adaptador pela assinatura. Nenhuma pausa, nenhum `sleep`.
    let instante = INSTANTE_INICIAL_MS;
    const adaptador = adaptadorComRelogio(provedor.porta, () => instante);

    const emitir = async (empresaId: string, material: ParDeSegredo, ordem: number) =>
      adaptador.emitir(pedidoDeEmissao(empresaId, material, ordem));

    // Passo 1 — cinco operações da empresa A.
    const primeiro = await emitir(EMPRESA_A, materialDeA, 1);
    for (let ordem = 2; ordem <= OPERACOES_ANTES_DA_RENOVACAO; ordem += 1) {
      expect((await emitir(EMPRESA_A, materialDeA, ordem)).aceito).toBe(true);
    }

    // A1 — a credencial foi obtida UMA vez e reaproveitada nas outras quatro. Um adaptador sem
    // cache faria cinco obtenções aqui, e o valor exato é o que discrimina: `> 0` aprovaria as
    // cinco, e `< 5` aprovaria duas.
    expect(provedor.obtencoes.length).toBe(1);

    // Passo 2 — o relógio atravessa o prazo, sem espera real.
    instante += AVANCO_ALEM_DO_PRAZO_MS;

    // Passo 3 — mais cinco operações da mesma empresa.
    for (let ordem = 6; ordem <= OPERACOES_POR_EMPRESA; ordem += 1) {
      expect((await emitir(EMPRESA_A, materialDeA, ordem)).aceito).toBe(true);
    }

    // A2 — passado o prazo, a credencial é obtida DE NOVO, e uma única vez para as cinco.
    expect(provedor.obtencoes.length).toBe(2);

    // Passo 4 — dez operações da segunda empresa, com o relógio parado.
    for (let ordem = 1; ordem <= OPERACOES_POR_EMPRESA; ordem += 1) {
      expect((await emitir(EMPRESA_B, materialDeB, ordem)).aceito).toBe(true);
    }

    // A3 — a chave do cache é a EMPRESA: a credencial viva de A não serve para B, e as dez de B
    // custam uma obtenção. O total é `=== 3` exatas — nunca 20 (cache quebrado), nunca 2
    // (renovação quebrada, ou credencial de A reaproveitada por B).
    expect(provedor.obtencoes.length).toBe(3);
    expect(provedor.obtencoes).toEqual([
      TITULAR_DA_EMPRESA.nomeComum,
      TITULAR_DA_EMPRESA.nomeComum,
      TITULAR_DA_OUTRA_EMPRESA.nomeComum,
    ]);

    // Âncora antivácuo: as vinte operações de fato chegaram ao par. Sem ela, um adaptador que
    // falhasse antes de chamar produziria as mesmas listas vazias e as contagens acima seriam
    // compatíveis com nada ter acontecido.
    expect(provedor.chamadas.length).toBe(OPERACOES_POR_EMPRESA * 2);

    const credenciaisDeA = [
      ...new Set(
        provedor.chamadas
          .filter((chamada) => chamada.titular === TITULAR_DA_EMPRESA.nomeComum)
          .map((chamada) => chamada.credencial),
      ),
    ];
    const credenciaisDeB = [
      ...new Set(
        provedor.chamadas
          .filter((chamada) => chamada.titular === TITULAR_DA_OUTRA_EMPRESA.nomeComum)
          .map((chamada) => chamada.credencial),
      ),
    ];

    // A4 — o companheiro negativo, e o eixo do caso: **nenhuma** credencial aparece nas chamadas
    // das duas empresas. A interseção é afirmada por lista vazia, e não por booleano, para que a
    // reprovação NOMEIE a credencial que cruzou.
    expect(credenciaisDeA.filter((credencial) => credenciaisDeB.includes(credencial))).toEqual([]);

    // E as duas listas são exatamente o que as obtenções produziram: A apresentou a inicial nas
    // cinco primeiras e a renovada nas cinco seguintes; B apresentou a dela nas dez.
    expect(credenciaisDeA).toEqual([
      `Bearer credencial-${TITULAR_DA_EMPRESA.nomeComum}-1`,
      `Bearer credencial-${TITULAR_DA_EMPRESA.nomeComum}-2`,
    ]);
    expect(credenciaisDeB).toEqual([`Bearer credencial-${TITULAR_DA_OUTRA_EMPRESA.nomeComum}-3`]);

    // A5 — a coerção da fronteira: o par devolveu `nossoNumero` INTEIRO, e o que atravessa a porta
    // é CADEIA.
    //
    // ⚠️ **ANTES da igualdade**, pela `DECISÃO FECHADA` deste arquivo: `numeroDoTituloNoProvedor` é
    // campo do objeto que a igualdade abaixo fixa, e posta depois esta asserção seria implicada por
    // ela — que aborta o caso ao falhar — e nunca poderia reprovar.
    expect(primeiro.aceito ? typeof primeiro.valor.numeroDoTituloNoProvedor : 'recusado').toBe(
      'string',
    );

    // A6 — o desfecho inteiro por igualdade, jamais presença de campo. O documento chega como os
    // bytes que o par entregou, decodificados do base64 do dialeto.
    expect(primeiro).toEqual({
      aceito: true,
      valor: {
        numeroDoTituloNoProvedor: NUMERO_DO_TITULO_EM_CADEIA,
        linhaDigitavel: LINHA_DIGITAVEL_DO_PAR,
        codigoDeBarras: CODIGO_DE_BARRAS_DO_PAR,
        documento: DOCUMENTO_DO_PAR,
      },
    });

    // A7 — nem a senha nem os bytes do material saem em nada que o ato produza, **também** nas
    // operações de cobrança. O controle positivo é o do CT-844, aplicado à mesma varredura.
    const agulhas = agulhasDe(materialDeA);
    expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas, 'controle')).toEqual([
      'controle/senha',
      'controle/material-base64',
      'controle/material-hex',
    ]);
    expect(ocorrenciasDe(primeiro, agulhas, 'emitido')).toEqual([]);
    expect(ocorrenciasDe(provedor.chamadas, agulhas, 'chamadas')).toEqual([]);
  });

  it('CT-949 — cadeia herdada do protótipo não vira situação do produto', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const material = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    // A última resposta é a da situação DECLARADA — a âncora antivácuo do caso: sem ela, um
    // adaptador que recusasse toda consulta passaria com as sete recusas acima.
    const provedor = await subirProvedorInstrumentado(
      autoridade,
      respostasEmOrdem([
        ...CADEIAS_DO_PROTOTIPO.map((cadeia) => respostaDeSituacao({ situacaoBoleto: cadeia })),
        respostaDeSituacao({ situacaoBoleto: 'em aberto' }),
      ]),
    );
    const adaptador = adaptadorComRelogio(provedor.porta, () => INSTANTE_INICIAL_MS);

    const herdadas: {
      readonly cadeia: string;
      readonly desfecho: DesfechoDaOperacao<SituacaoConsultada>;
    }[] = [];

    for (const cadeia of CADEIAS_DO_PROTOTIPO) {
      herdadas.push({
        cadeia,
        desfecho: await adaptador.consultarSituacao(consultaDeSituacao(material)),
      });
    }

    const declarada = await adaptador.consultarSituacao(consultaDeSituacao(material));

    // A asserção que DISCRIMINA o defeito: nenhum desfecho aceito carrega discriminador que não
    // seja um dos três estados do produto. Sob o cotejo por objeto literal, `constructor` saía
    // `constructor: function` aqui — a única das sete que a guarda `=== undefined` não pegava.
    //
    // ⚠️ **ANTES das igualdades**, pela `DECISÃO FECHADA` deste arquivo: `situacao` é campo do
    // objeto que a igualdade abaixo fixa, e posta depois esta asserção nunca poderia reprovar.
    expect(
      herdadas.map(
        ({ cadeia, desfecho }) =>
          `${cadeia}: ${desfecho.aceito ? typeof desfecho.valor.situacao : 'recusado'}`,
      ),
    ).toEqual(CADEIAS_DO_PROTOTIPO.map((cadeia) => `${cadeia}: recusado`));

    // Os desfechos inteiros por igualdade, jamais presença de campo — e o motivo é o da situação
    // desconhecida, distinto do da liquidação incompleta que o CT-950 mede.
    expect(herdadas.map(({ desfecho }) => desfecho)).toEqual(
      CADEIAS_DO_PROTOTIPO.map(() => ({
        aceito: false,
        classe: 'DA_COBRANCA',
        motivo: MOTIVO_DE_SITUACAO_DESCONHECIDA,
      })),
    );

    // Âncora antivácuo: a cadeia DECLARADA no cotejo continua atravessando. Sem ela, recusar tudo
    // — inclusive o que o produto trata — passaria neste caso.
    expect(declarada).toEqual({ aceito: true, valor: { situacao: 'EM_ABERTO', documento: null } });

    // E as oito consultas de fato chegaram ao par: nenhuma morreu antes da tradução de volta.
    expect(provedor.chamadas.length).toBe(CADEIAS_DO_PROTOTIPO.length + 1);
  });

  it('CT-950 — valor pago em grafia ambígua é recusado, nunca convertido em silêncio', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const material = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    const provedor = await subirProvedorInstrumentado(
      autoridade,
      respostasEmOrdem(
        GRAFIAS_DO_VALOR_PAGO.map((grafia) =>
          respostaDeSituacao({
            situacaoBoleto: SITUACAO_LIQUIDADA_DO_PAR,
            dataPagamento: DATA_DO_PAGAMENTO_DO_PAR,
            valorPago: grafia.bruto,
          }),
        ),
      ),
    );
    const adaptador = adaptadorComRelogio(provedor.porta, () => INSTANTE_INICIAL_MS);

    const desfechos: DesfechoDaOperacao<SituacaoConsultada>[] = [];
    const lidos: string[] = [];

    for (const grafia of GRAFIAS_DO_VALOR_PAGO) {
      const desfecho = await adaptador.consultarSituacao(consultaDeSituacao(material));
      desfechos.push(desfecho);

      if (!desfecho.aceito) {
        lidos.push(`${grafia.rotulo} → ${desfecho.motivo}`);
      } else if (desfecho.valor.situacao === 'LIQUIDADO') {
        lidos.push(`${grafia.rotulo} → ${desfecho.valor.valorPago}`);
      } else {
        lidos.push(`${grafia.rotulo} → aceito como ${desfecho.valor.situacao}`);
      }
    }

    // A asserção que DISCRIMINA o defeito, e o eixo do caso: cada grafia produz **exatamente** o
    // que a tabela declara. Sob `Number(valor.replace(',', '.'))`, a linha do milhar sem centavos
    // saía `milhar com ponto, sem centavos → 1.234` — R$ 1,23 gravados onde o provedor informou
    // R$ 1.234,00 —, e a reprovação nomeia a grafia ofensora pelo rótulo.
    expect(lidos).toEqual(
      GRAFIAS_DO_VALOR_PAGO.map((grafia) => `${grafia.rotulo} → ${grafia.esperado}`),
    );

    // O desfecho inteiro por igualdade nos dois extremos da tabela: o primeiro aceito, com a
    // liquidação completa, e a grafia que era aceita e lida errado.
    expect(desfechos[0]).toEqual({
      aceito: true,
      valor: {
        situacao: 'LIQUIDADO',
        documento: null,
        pagoEm: DATA_DO_PAGAMENTO_DO_PAR,
        valorPago: 1234.56,
      },
    });
    expect(
      desfechos[GRAFIAS_DO_VALOR_PAGO.findIndex((grafia) => grafia.rotulo === ROTULO_DO_MILHAR)],
    ).toEqual({
      aceito: false,
      classe: 'DA_COBRANCA',
      motivo: MOTIVO_DE_LIQUIDACAO_INCOMPLETA,
    });

    // Âncora antivácuo: as nove consultas chegaram ao par.
    expect(provedor.chamadas.length).toBe(GRAFIAS_DO_VALOR_PAGO.length);
  });

  it('CT-951 — a credencial do ato não sai no motivo quando o provedor a ecoa', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const material = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    // O par ecoa o cabeçalho de autorização que recebeu, que é hábito comum de diagnóstico de erro
    // — e é o único caminho estrutural pelo qual credencial viva alcança uma superfície gravada.
    const provedor = await subirProvedorInstrumentado(autoridade, (chamada) => ({
      codigo: CODIGO_DE_RECUSA_DA_COBRANCA,
      corpo: { mensagem: `esta credencial não vale: ${chamada.credencial}` },
    }));
    const adaptador = adaptadorComRelogio(provedor.porta, () => INSTANTE_INICIAL_MS);

    const credencialDoAto = `credencial-${TITULAR_DA_EMPRESA.nomeComum}-1`;
    const agulhaDaCredencial: readonly Agulha[] = [
      { rotulo: 'credencial', valor: credencialDoAto },
    ];

    const desfecho = await adaptador.consultarSituacao(consultaDeSituacao(material));

    // Controle positivo (AP-29): a MESMA varredura, sobre um objeto que contém a agulha, a devolve.
    // Sem ele, a lista vazia abaixo seria compatível com um detector cego.
    expect(
      ocorrenciasDe(controleComAsAgulhas(agulhaDaCredencial), agulhaDaCredencial, 'controle'),
    ).toEqual(['controle/credencial']);

    // A asserção que DISCRIMINA o defeito, medida sobre a SAÍDA REAL e nunca por leitura do fonte
    // (ADR-0032). Sem a redação, esta lista sai `['recusado/credencial']`.
    //
    // ⚠️ **ANTES da igualdade**, pela `DECISÃO FECHADA` deste arquivo: `motivo` é campo dela.
    expect(ocorrenciasDe(desfecho, agulhaDaCredencial, 'recusado')).toEqual([]);

    // Âncora antivácuo: a credencial de fato saiu do produto e voltou no corpo — sem isto, um ato
    // que falhasse antes da chamada varreria um desfecho onde a agulha nunca poderia estar.
    expect(provedor.chamadas.map((chamada) => chamada.credencial)).toEqual([
      `Bearer ${credencialDoAto}`,
    ]);

    // O desfecho inteiro por igualdade: o texto do provedor atravessa **íntegro** salvo pela
    // credencial. Redigir o corpo todo — ou devolver o motivo vazio — reprova aqui.
    expect(desfecho).toEqual({
      aceito: false,
      classe: 'DA_COBRANCA',
      motivo: '{"mensagem":"esta credencial não vale: Bearer «credencial omitida»"}',
    });
  });

  it('CT-952 — credencial dentro da margem é renovada antes de ser apresentada', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    // A margem declarada, afirmada sobre a constante IMPORTADA do artefato — mesma disciplina do
    // prazo no CT-943: os avanços do relógio abaixo derivam dela, e não de literais deste arquivo.
    expect(MARGEM_DE_RENOVACAO_S).toBe(30);

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Confiavel');
    confiarEm(autoridade);

    const material = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_SENTINELA,
      titular: TITULAR_DA_EMPRESA,
    });

    const provedor = await subirProvedorInstrumentado(autoridade);

    let instante = INSTANTE_INICIAL_MS;
    const adaptador = adaptadorComRelogio(provedor.porta, () => instante);
    const obtencoesPorPasso: number[] = [];

    const primeiro = await adaptador.emitir(pedidoDeEmissao(EMPRESA_A, material, 1));
    obtencoesPorPasso.push(provedor.obtencoes.length);

    // Passo 2 — FORA da margem, e com folga: a credencial guardada continua servindo.
    instante += AVANCO_ANTES_DA_MARGEM_MS;
    const segundo = await adaptador.emitir(pedidoDeEmissao(EMPRESA_A, material, 2));
    obtencoesPorPasso.push(provedor.obtencoes.length);

    // Passo 3 — DENTRO da margem, e ainda antes do prazo declarado.
    instante += AVANCO_ATE_DENTRO_DA_MARGEM_MS;
    const terceiro = await adaptador.emitir(pedidoDeEmissao(EMPRESA_A, material, 3));
    obtencoesPorPasso.push(provedor.obtencoes.length);

    // A asserção que DISCRIMINA o defeito: a terceira operação obtém credencial nova **antes** de
    // o prazo expirar. Sem a margem, a sequência sai `[1, 1, 1]` — a credencial a menos de 20 s do
    // fim é apresentada a uma chamada que pode custar até o teto de uma operação, e a recusa vira
    // falha `DA_EMPRESA`, que para o percurso do lote. O passo 2 é o companheiro negativo: um cache
    // que renovasse a cada chamada sairia `[1, 2, 3]`.
    expect(obtencoesPorPasso).toEqual([1, 1, 2]);

    // E a terceira chamada apresentou a credencial RENOVADA, não a que estava por vencer — a
    // contagem de obtenções sozinha não separa "obteve uma nova" de "obteve e seguiu com a velha".
    expect(provedor.chamadas.map((chamada) => chamada.credencial)).toEqual([
      `Bearer credencial-${TITULAR_DA_EMPRESA.nomeComum}-1`,
      `Bearer credencial-${TITULAR_DA_EMPRESA.nomeComum}-1`,
      `Bearer credencial-${TITULAR_DA_EMPRESA.nomeComum}-2`,
    ]);

    // Âncora antivácuo: as três emissões de fato aconteceram, e nenhuma falhou.
    expect([primeiro.aceito, segundo.aceito, terceiro.aceito]).toEqual([true, true, true]);
  });
});

// ===========================================================================
// CT-1008 e CT-1009 — a guarda de FORMA do endereço, que fecha o D38 · F4/T10
// ===========================================================================

/**
 * A guarda de forma do endereço — os dois casos que o `D38 · F4/T10` cobrava.
 *
 * O débito registrava, com o `smell: happy_path_only`, que `recusarPorForma` e a conferência de
 * {@link resolverDestino} eram tratadas pelo docblock do adaptador como garantia e **não tinham caso
 * algum**: nem endereço malformado, nem `http:`, nem hospedeiro vazio. Garantia sem prova é garantia
 * que a próxima refatoração remove sem que nada reprove.
 *
 * Os dois casos **não têm fronteira de rede**, e a ausência é conteúdo: a recusa acontece na
 * **construção**, antes de qualquer conexão — é essa antecipação que impede o processo de subir com
 * um adaptador meio-pronto e o Admin de descobrir a configuração errada clicando em *"testar"*. Um
 * caso que precisasse de par para observá-la estaria medindo outra coisa.
 *
 * Os IDs seguem para frente a partir do último alocado no repositório (`CT-1007`), como o próprio
 * marcador do débito previa ao registrar que fechá-lo exigia **alocar um ID novo**.
 */
describe('CT-1008 — a construção recusa endereço que não serve, nomeando a variável', () => {
  it('recusa as três formas inutilizáveis, sempre com a MESMA mensagem e sem ecoar o valor', () => {
    // Âncora antivácuo: as três formas foram de fato escritas, e são distintas entre si. Sem ela, a
    // lista truncada faria o laço abaixo passar examinando menos do que declara.
    expect(FORMAS_RECUSADAS.length).toBe(3);
    expect(new Set(FORMAS_RECUSADAS.map((caso) => caso.endereco)).size).toBe(3);

    for (const caso of FORMAS_RECUSADAS) {
      let levantado: unknown;

      try {
        criarAdaptadorSicoob({ enderecoDoProvedor: caso.endereco });
      } catch (erro) {
        levantado = erro;
      }

      // Que ALGO foi levantado, e que é `Error` — e não o `TypeError` cru do `new URL`, cuja
      // mensagem carrega a cadeia recusada em `input`. A distinção é o eixo do caso: deixar o erro
      // nativo subir seria recusar do mesmo jeito, e ecoar a entrada ao fazê-lo.
      expect(levantado, `a forma "${caso.forma}" foi ACEITA pela construção`).toBeInstanceOf(Error);
      expect((levantado as Error).constructor.name, caso.forma).toBe('Error');

      // Igualdade LITERAL da mensagem, e não `toContain`: é ela que fixa, de uma vez, o texto
      // publicado, o nome da variável e a ausência de qualquer sufixo de diagnóstico — inclusive o
      // valor recusado, que entraria por concatenação sem que uma asserção de contenção acusasse.
      expect((levantado as Error).message, caso.forma).toBe(RECUSA_POR_FORMA_POR_EXTENSO);

      // E o eixo do não-eco escrito por extenso, para a forma que tem valor a ecoar. O endereço
      // vazio fica de fora por construção: `''` está contido em qualquer cadeia, e afirmá-lo ali
      // seria uma asserção que não pode falhar (AP-29).
      if (caso.endereco !== '') {
        expect(
          (levantado as Error).message.includes(caso.endereco),
          `a mensagem ecoou o endereço recusado da forma "${caso.forma}"`,
        ).toBe(false);
      }
    }
  });
});

describe('CT-1009 — o endereço bem formado constrói o adaptador, e a guarda não recusa tudo', () => {
  it('aceita as três formas boas e devolve as cinco capacidades da porta', () => {
    // Âncora antivácuo: as três formas aceitas existem e são distintas.
    expect(ENDERECOS_ACEITOS.length).toBe(3);
    expect(new Set(ENDERECOS_ACEITOS).size).toBe(3);

    for (const endereco of ENDERECOS_ACEITOS) {
      const adaptador = criarAdaptadorSicoob({ enderecoDoProvedor: endereco });

      // Igualdade de conjunto sobre as capacidades, contra a lista escrita por extenso: é o que
      // separa "construiu" de "construiu o que a porta exige". `toBeDefined` aprovaria qualquer
      // objeto.
      expect(
        Object.keys(adaptador).sort(),
        `o adaptador construído com ${endereco} não publica as cinco capacidades`,
      ).toEqual([...CAPACIDADES_DO_ADAPTADOR]);

      expect(
        Object.values(adaptador).every((capacidade) => typeof capacidade === 'function'),
        `o adaptador construído com ${endereco} publica capacidade que não é função`,
      ).toBe(true);
    }
  });
});
