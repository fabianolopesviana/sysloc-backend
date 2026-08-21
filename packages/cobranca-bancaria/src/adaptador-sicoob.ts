/**
 * O adaptador do provedor — **TLS mútuo contra o endereço da instituição, e nada mais**.
 *
 * ===========================================================================
 * A DIREÇÃO DA DEPENDÊNCIA (ADR-0025) e o que ele traduz
 * ===========================================================================
 *
 * Quem declara a porta e o dado que a atravessa é o domínio (`./porta-de-identidade.ts`,
 * `./modelo-canonico.ts`); este arquivo **importa deles** para dizer que os satisfaz, e é a borda
 * que escolhe injetá-lo. Toda a tradução do dialeto do provedor morre aqui: para fora sai o
 * vocabulário do produto — `aceito`, `verificadoEm`, `detalhe` —, e nenhum código de erro de
 * biblioteca, nenhum texto de OpenSSL, nenhum nome de recurso da instituição (ADR-0001).
 *
 * ===========================================================================
 * A SONDA É O APERTO DE MÃO MÚTUO — e o que ele afirma é MENOS do que parece
 * ===========================================================================
 *
 * Nenhum corpo é enviado, nenhuma credencial de acesso é apresentada, nenhum recurso da instituição
 * é consultado. O que se pergunta é *"o par aceita este certificado, desta empresa?"*, e a resposta
 * cobre exatamente isso: confiável na cadeia do provedor, dentro da validade do lado de lá, não
 * revogado. Ela **não** afirma que a emissão de cobrança vai funcionar — e por isso
 * {@link DETALHE_ACEITE} carrega a ressalva **por escrito**, inclusive no desfecho positivo. É o que
 * impede a tela do Admin de prometer mais do que foi medido (tech spec §8).
 *
 * ===========================================================================
 * O ATO PRECISA CHEGAR À PRIMEIRA TROCA DE DADOS — medido, não suposto
 * ===========================================================================
 *
 * A forma que um leitor deste arquivo esperaria é *"conectou com `secureConnect`, logo o par
 * aceitou"*. Ela está **errada sob TLS 1.3**, e a medição é deste host: com material emitido por
 * autoridade que o par **não** conhece, o cliente recebe `secureConnect` **exatamente igual** ao
 * caso aceito, em ~30 ms. A razão é do protocolo — no TLS 1.3 o cliente conclui o aperto de mão
 * assim que envia o próprio `Finished`, e a validação do certificado **do cliente** acontece no
 * servidor depois disso; a recusa chega como alerta na primeira troca de dados de aplicação
 * (medido: `ECONNRESET`, *"socket hang up"*).
 *
 * Daí a forma escolhida: emite-se um `HEAD /` **sem corpo e sem cabeçalho de credencial** e
 * aguarda-se a resposta. **Qualquer** resposta serve, e o código dela é deliberadamente ignorado:
 * `200`, `403` e `404` significam todos a mesma coisa aqui — *o par completou o TLS mútuo e falou
 * comigo*. Interpretar o código seria justamente trazer o vocabulário do provedor para dentro do
 * desfecho, que é o que a ADR-0001 proíbe.
 *
 * ⚠️ **`client_credentials` NÃO é exercitado pela SONDA**, e a ausência continua sendo decisão
 * registrada — ver o `DÉBITO COM GATILHO` de {@link criarAdaptadorSicoob}, **emendado** nesta fatia
 * com o que a medição mostrou. As quatro operações de cobrança, essas sim, obtêm credencial de
 * acesso: o que a sonda não faz, e por quê, está escrito no marcador.
 *
 * ===========================================================================
 * O CLIENTE É `node:https` NATIVO, e `undici` NÃO entra
 * ===========================================================================
 *
 * Medição M3 (tech spec §21.1): `https.request({ pfx, passphrase })` completa o aperto de mão mútuo
 * e recebe resposta; o `fetch` global **não** aceita certificado de cliente sem despachante, e o
 * `undici` **não resolve** no monorepo. O que o `undici` acrescentaria sobre o nativo é o
 * **agrupamento de conexões** — exatamente o que a decisão D6-b adia, por manter o material
 * decifrado residente por tempo indefinido. Ele pertence à fatia que emitir em lote, a (ii).
 * Este pacote segue com **zero dependência externa**.
 *
 * ===========================================================================
 * CLIENTE POR CHAMADA, e nada sobrevive ao ato (D6-b)
 * ===========================================================================
 *
 * O despachante nasce dentro de {@link apertarMao} e é desfeito no mesmo ato, com
 * `keepAlive: false` e **cache de sessão zerado**. Não é ornamento: o despachante global do Node 24
 * mantém conexões vivas por padrão, e um cliente de longa duração seguraria a conexão — e, com ela,
 * a janela em que o material decifrado importa — para além do clique do Admin. Não há cache do
 * material decifrado, e a janela de residência do segredo em memória é **a duração da verificação**.
 * Guardar o certificado decifrado é precisamente o que a D6-a foi rejeitada por fazer.
 *
 * ===========================================================================
 * NENHUMA REPETIÇÃO, NENHUM DISJUNTOR, e indisponibilidade NÃO é erro do serviço
 * ===========================================================================
 *
 * O ato é explícito, sob comando do Admin. Repetir por conta própria transformaria um clique em três
 * apertos de mão com o material decifrado — quem repete é a pessoa. Também não há disjuntor: nesta
 * fatia não existe caminho automático que dependa do provedor.
 *
 * E os **cinco** desfechos **resolvem**: a operação da porta nunca rejeita. Levantar seria idiomático
 * e está descartado por razão concreta — a borda traduziria a exceção em `500`, e o Admin leria *"o
 * sistema falhou"* onde o fato é *"a identidade não foi aceita"* ou *"não alcancei a instituição"*,
 * desfechos operacionais opostos (RN-06). O `detalhe` é o que os separa, e os cinco textos são
 * **distintos entre si** de propósito: um texto genérico satisfaria *"informou o desfecho"* sem
 * informar nada.
 *
 * ===========================================================================
 * O QUINTO DESFECHO existe porque a construção da requisição LANÇA — e é medido
 * ===========================================================================
 *
 * A leitura natural deste arquivo é que `request(...)` apenas agenda trabalho e que toda falha chega
 * pelo evento `error`. **Falso, e medido neste host**: `https.request` monta o contexto seguro de
 * forma **síncrona** (`ClientRequest` → `agent.addRequest` → `tls.connect` → `createSecureContext`) e
 * **lança** quando o material não abre — `not enough data` com bytes que não são PKCS#12 (46 ms),
 * `mac verify failure` com senha que não corresponde. Sem tratamento, essa exceção sairia pelo
 * executor da `Promise` e **rejeitaria** a operação da porta, contrariando o contrato absoluto de
 * `./porta-de-identidade.ts`, levando o texto do OpenSSL para fora e deixando o temporizador e o
 * despachante sem liberação — três defeitos de uma vez, num caminho que nenhum caso alcançava.
 *
 * Daí {@link DETALHE_NAO_INICIADO}, e daí ele ser **texto próprio**. Reusar
 * {@link DETALHE_INDISPONIVEL} mentiria — nada foi alcançado, e não por culpa do destino; reusar
 * {@link DETALHE_RECUSA_PELO_PAR} mentiria pior — nenhum par decidiu coisa alguma. O preço do quinto
 * texto é o par que {@link DETALHE_POR_DESFECHO} cobra no compilador, e é o preço certo.
 *
 * ⚠️ Hoje o registro do material (T7/T9) já filtra a entrada por `lerMaterial`, que usa o **mesmo**
 * `createSecureContext` — de modo que este caminho é a rede que sobra caso um `SegredoOperavel` chegue
 * por caminho que não passe por lá. A rede existe **por isso**, e não apesar disso.
 *
 * ===========================================================================
 * O ENDEREÇO CHEGA POR PARÂMETRO — este módulo NÃO lê `process.env`
 * ===========================================================================
 *
 * Quem lê `ENDERECO_DO_PROVEDOR_BANCARIO` é a conferência de partida, num ponto só, e repassa o
 * valor — precedente literal de `criarAdaptadorSmtp` (`packages/regua/src/adaptador-smtp.ts`). Um
 * segundo leitor do ambiente teria duas fontes para a mesma configuração, e a segunda escaparia da
 * conferência de partida.
 *
 * ⚠️ **Nenhuma entrada do usuário decide para onde a verificação conecta.** O endereço não vem do
 * corpo nem da sessão, e {@link IdentidadeParaVerificar} deliberadamente não o carrega: seria a
 * forma canônica da requisição forjada do lado do servidor. A construção **recusa** o que não é
 * `https:` absoluta com servidor nomeado, e a recusa nomeia a **variável**, jamais o valor — o
 * `TypeError` do `new URL` traz a cadeia recusada em `input`, de modo que deixá-lo subir cru ecoaria
 * a entrada.
 *
 * ===========================================================================
 * AS QUATRO OPERAÇÕES DE COBRANÇA — um transporte só, e a tradução morre aqui
 * ===========================================================================
 *
 * A partir da fatia (ii) este arquivo satisfaz **duas** portas: a de identidade (uma operação) e a de
 * cobrança (quatro). Toda fala com o provedor — inclusive a obtenção da credencial de acesso — passa
 * por {@link falarComOProvedor}, e o ponto único é conteúdo: é ele que garante, para **toda**
 * chamada, despachante próprio do ato, teto no relógio **e** no transporte, ponto único de saída com
 * liberação de tudo, e nenhuma falha do runtime repassada. Operação nova não tem onde nascer com
 * transporte próprio — que é a mesma razão por que o SQL deste produto vive num pacote só.
 *
 * A sonda é o caso degenerado dela: `HEAD` na raiz, sem corpo, sem credencial, e o código da resposta
 * **deliberadamente ignorado**. As quatro operações são o caso completo: leem o código, leem o corpo,
 * e traduzem.
 *
 * ---------------------------------------------------------------------------
 * O que a tradução tem de saber, e foi MEDIDO — não suposto
 * ---------------------------------------------------------------------------
 *
 * - **O corpo útil vem envelopado em `resultado`** (§13-A.4 do discovery). O desenvelopamento morre
 *   aqui, e tolera as duas formas que o oráculo produz — objeto e arranjo de um elemento.
 * - **`nossoNumero` chega como INTEIRO** no JSON (§13-A.4), e não como cadeia. A coerção acontece na
 *   fronteira, em {@link cadeiaDo}: supor `string` quebra na primeira resposta real, e um `number`
 *   atravessando a porta viraria `numeroDoTituloNoProvedor` numérico numa coluna textual.
 * - **`identificacaoBoletoEmpresa` retornou 25 espaços** nos três casos medidos. Ele é vizinho
 *   semântico do identificador que o produto compõe e **não se confunde com ele**: quem casa com o
 *   nosso é o `seuNumero`, cuja integridade em 18 posições foi medida 3 de 3 **no caminho de
 *   consulta — e só nele**. Por isso este arquivo **não lê** aquele campo em lugar nenhum.
 * - **A credencial de acesso vale 300 s** (§13-A.4), e é isso que o cache de `./credencial-de-acesso.ts`
 *   explora: num lote de 47 boletos são **uma** obtenção em vez de 47 (D5).
 *
 * ---------------------------------------------------------------------------
 * NENHUM termo do provedor atravessa a porta, e a distinção é entre NOME e VALOR
 * ---------------------------------------------------------------------------
 *
 * Os nomes do dialeto (`seuNumero`, `nossoNumero`, `pagador`, a concessão da credencial) aparecem
 * aqui como **valor** — chave de objeto literal que se serializa para o provedor, e texto de consulta
 * —, jamais como nome de tipo, membro declarado ou símbolo publicado. É exatamente o recorte que a
 * varredura do `CT-834` percorre (§21.1(4) do tech spec), e é o que mantém a cláusula de vocabulário
 * da ADR-0001 verdadeira nos dois sentidos: para dentro, o produto fala `identificadorNoProvedor`,
 * `locatario` e `numeroDoTituloNoProvedor`; para fora, o adaptador fala o que o banco entende.
 *
 * ⚠️ **O `motivo` de uma falha é texto OPACO** (RN-15): entra como o provedor o informou e **nada o
 * interpreta** para decidir. É justamente nada interpretá-lo que torna um motivo desconhecido inócuo.
 * Ele é recortado por comprimento antes de sair — resposta de terceiro não tem tamanho garantido.
 *
 * ---------------------------------------------------------------------------
 * O que o produto AINDA NÃO MODELA, e por que isso está escrito aqui
 * ---------------------------------------------------------------------------
 *
 * Três dados que o oráculo do sistema antigo carrega **não têm origem no produto novo**, e a medição
 * é desta task (`tabConfiguracao Integracao Sicoob`, leitura sem escrita): o **identificador da
 * aplicação** perante o provedor, o **endereço de autorização** — que lá é máquina própria, distinta
 * da API — e os **dados da conta** (número do cliente, modalidade, conta corrente). O tech spec §8
 * agenda o primeiro para o envelope cifrado, e nenhuma task desta fatia alarga o envelope; os outros
 * dois não estão agendados em lugar nenhum.
 *
 * Cada um deles é composto **num ponto só** — {@link comporPedidoDeCredencial} e
 * {@link comporEmissao} —, de modo que a fatia que os trouxer edita uma função por dado. O
 * `DÉBITO COM GATILHO` de {@link criarAdaptadorSicoob} nomeia os três e o que os fecha.
 */

import type { ClientRequest, IncomingMessage } from 'node:http';
import { Agent, request } from 'node:https';
import { DETALHES_DA_VERIFICACAO } from '@sysloc/contracts';
import type { SegredoOperavel } from '@sysloc/shared';
import type { CredencialConcedida, FonteDeTempo } from './credencial-de-acesso.js';
import { criarCacheDeCredenciais } from './credencial-de-acesso.js';
import type {
  AtoSobreBoleto,
  BoletoEmitido,
  ClasseDaFalha,
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  DetalheDaVerificacao,
  IdentidadeDoProvedor,
  IdentidadeParaVerificar,
  LocatarioDaCobranca,
  PedidoDeEmissao,
  ResultadoDaVerificacaoDeIdentidade,
  SituacaoConsultada,
} from './modelo-canonico.js';
import type { AdaptadorCobrancaBancaria } from './porta-de-cobranca.js';
import type { PortaDeIdentidadeBancaria } from './porta-de-identidade.js';

/**
 * Teto de **uma chamada ao provedor** — conectar, apertar a mão, pedir e receber a resposta.
 *
 * ---------------------------------------------------------------------------
 * É UM teto, e não dois com o mesmo valor — medido nesta task
 * ---------------------------------------------------------------------------
 *
 * A task pede `TETO_DA_OPERACAO_MS = 10_000` e o arquivo já declarava
 * {@link TETO_DO_APERTO_DE_MAO_MS} com **o mesmo valor**, para **o mesmo fato**: o tempo que uma ida
 * ao provedor pode custar (tech spec §8, que declara `TETO_DA_OPERACAO_MS = 10_000` *"por chamada"*).
 * Declarar a segunda constante com o mesmo número seria a segunda cópia livre para divergir — a forma
 * exata do débito D14 da fase anterior, e o que o *limiar de três* do `CLAUDE.md` manda evitar antes
 * que a terceira apareça.
 *
 * Por isso há **uma** declaração, e o nome antigo continua publicado **derivando** dela: ele está na
 * superfície do pacote e é importado pelo `CT-842`, que mede o **efeito** do teto contra um par que
 * aceita o TCP e nunca responde. Renomeá-lo tiraria um símbolo publicado sem que nada o pedisse.
 *
 * ⚠️ **Esta declaração é PRIVADA ao módulo**, e a privacidade é conteúdo: quem o barril publica — e
 * quem a verificação importa — é {@link TETO_DO_APERTO_DE_MAO_MS}, que deriva dela. Exportar as duas
 * daria dois nomes para o mesmo teto na fronteira do módulo, e o segundo ficaria livre para ganhar
 * consumidor por engano — reabrindo, por outra porta, a duplicação que esta declaração única fechou.
 *
 * Sem teto, a requisição ficaria pendurada enquanto o par não fechasse a conexão, segurando a
 * resposta HTTP e o material decifrado na memória do processo por tempo indefinido.
 */
const TETO_DA_OPERACAO_MS = 10_000;

/**
 * O nome pelo qual a fatia (i) publicou o teto — **o mesmo teto**, derivado e não redeclarado.
 *
 * Ver {@link TETO_DA_OPERACAO_MS}: a sonda de identidade é uma das chamadas ao provedor, e não uma
 * chamada de outra natureza com limite próprio.
 *
 * Ele é **exportado**, e a exportação é conteúdo, não conveniência: enquanto o limite ficava privado
 * no adaptador de e-mail, a verificação só podia reescrevê-lo como literal, e a asserção passava a
 * medir o teste em vez do artefato — foi assim que três limites declarados no fonte, lidos pelo
 * compilador e **sem efeito algum** sobre o transporte, sobreviveram a cinco rodadas de gate
 * (`packages/regua/src/coordenadas-do-transporte.ts`). É este nome que o `CT-842` importa, e é sobre
 * ele que o efeito do teto é medido.
 */
export const TETO_DO_APERTO_DE_MAO_MS = TETO_DA_OPERACAO_MS;

/**
 * Os cinco textos de desfecho, **consumidos da fonte única** e republicados com os nomes daqui.
 *
 * ---------------------------------------------------------------------------
 * Eles eram declarados aqui, e a mudança de casa é o que fechou o D27 · F4/T8
 * ---------------------------------------------------------------------------
 *
 * A restrição *"o texto sai de um conjunto fechado"* valia por prosa enquanto os textos moravam
 * neste arquivo: o campo era `string` no domínio, e o esquema publicado, `z.string()`. Fechá-la
 * estruturalmente exige **uma** declaração alcançável pelos dois lados, e a direção da dependência
 * decide qual é o lado — o domínio não pode importar do adaptador (ADR-0025), e `@sysloc/contracts`
 * é o pacote folha que os dois alcançam. Os textos passaram para
 * {@link DETALHES_DA_VERIFICACAO}, e o que sobrou aqui são os **nomes**, com o mesmo texto byte a
 * byte, porque é por eles que a superfície deste pacote já publica os desfechos.
 *
 * ⚠️ Nenhum destes cinco textos nomeia a instituição, cita campo do provedor ou carrega detrito do
 * runtime de transporte. É o que mantém verdadeira a cláusula de vocabulário da ADR-0001 no único
 * campo por onde texto atravessa a porta — e agora o compilador o cobra, em vez da boa-fé de quem
 * escreve este arquivo.
 *
 * O alcance do desfecho positivo: a ressalva é a parte que importa, e ela **permanece** enquanto a
 * sonda for o aperto de mão mútuo (débito D36).
 */
export const DETALHE_ACEITE = DETALHES_DA_VERIFICACAO.ACEITE;

/** O par completou a conexão e **não** aceitou o certificado apresentado. */
export const DETALHE_RECUSA_PELO_PAR = DETALHES_DA_VERIFICACAO.RECUSA_PELO_PAR;

/** Não houve conexão: o destino não respondeu ao pedido de ligação, e nada foi apresentado. */
export const DETALHE_INDISPONIVEL = DETALHES_DA_VERIFICACAO.INDISPONIVEL;

/** A conexão abriu e o par não concluiu dentro do teto — desfecho distinto dos outros quatro. */
export const DETALHE_TEMPO_ESGOTADO = DETALHES_DA_VERIFICACAO.TEMPO_ESGOTADO;

/**
 * O ato **não chegou a começar**: a apresentação do certificado falhou antes de qualquer conexão.
 *
 * O texto afirma só o que é verdade em **todo** caminho que produz este desfecho — nada foi
 * apresentado e nada foi tentado — e aponta a ação certa para a causa dominante e medida (material ou
 * senha que não abrem) sem **declarar** essa causa, que o adaptador não tem como distinguir sem ler o
 * erro do runtime. Ler o erro é justamente o que a ADR-0001 mantém fora da porta.
 */
export const DETALHE_NAO_INICIADO = DETALHES_DA_VERIFICACAO.NAO_INICIADO;

/**
 * O nome da variável que declara o destino — o que a recusa de construção nomeia, no lugar do valor.
 *
 * Privada de propósito: ela é o **texto da recusa**, e publicá-la convidaria a verificação a compor
 * o esperado a partir do próprio módulo sob prova, que é o defeito que o D25 da fatia anterior
 * fechou ao despublicar a constante irmã em `coordenadas-do-transporte.ts`.
 */
const VARIAVEL_DO_ENDERECO = 'ENDERECO_DO_PROVEDOR_BANCARIO';

/**
 * O que a recusa por forma diz, com o nome da variável acrescentado ao fim.
 *
 * ⚠️ **A redação é decalcada da irmã**, `MOTIVO_DE_TRANSPORTE_INUTILIZAVEL` de
 * `packages/regua/src/coordenadas-do-transporte.ts`, e herda dela a dupla negação mais o dêitico —
 * achado `TR-P5` do Gate 2 nesta task. **Ela não se conserta de um lado só**: o texto de lá está
 * fixado por asserção em `packages/regua/test/coordenadas-do-transporte.spec.ts`, e reescrever apenas
 * este daria duas redações divergentes para a mesma recusa entre dois adaptadores que a §5.3 da task
 * declara um como precedente do outro. Quem abrir qualquer das duas pontas fecha as duas na mesma
 * passada; medido nesta task e adiado por a outra ponta estar fora da lista de arquivos.
 *
 * O que a mensagem protege continua valendo em qualquer redação, e é o que não se negocia: ela nomeia
 * a **variável**, jamais o valor recusado — o `TypeError` do `new URL` traz a cadeia recusada em
 * `input`, e deixá-lo subir cru ecoaria a entrada.
 */
const MOTIVO_DE_ENDERECO_INUTILIZAVEL =
  'o adaptador do provedor bancário não é construído com esta variável em forma que não serve de ' +
  'endereço seguro';

/** O único esquema aceito. `http:` conectaria em claro e apresentaria o certificado a quem ouvisse. */
const ESQUEMA_SEGURO = 'https:';

/** A porta assumida quando o endereço não declara uma — **escrita**, nunca deixada implícita. */
const PORTA_SEGURA_PADRAO = 443;

/**
 * O que se pede ao par, e a razão de ser tão pouco.
 *
 * `HEAD` não traz corpo de resposta, e o caminho é a **raiz** — fixo, e não o caminho que o endereço
 * porventura declare. A sonda não consulta recurso: o que ela precisa é que o par fale, qualquer
 * coisa, depois do aperto de mão. Caminho de recurso pertence às operações da fatia (ii).
 */
const METODO_DA_SONDA = 'HEAD';
const CAMINHO_DA_SONDA = '/';

/** Os dois verbos das operações — escrever no provedor e ler dele. */
const METODO_DE_ENVIO = 'POST';
const METODO_DE_LEITURA = 'GET';

// ===========================================================================
// O DIALETO DO PROVEDOR — os únicos nomes dele neste produto, e todos como VALOR
// ===========================================================================

/** O recurso dos boletos, tal como o oráculo do sistema antigo o consulta (§13-A.1 do discovery). */
const RECURSO_DOS_BOLETOS = '/cobranca-bancaria/v3/boletos';

/** O segmento que pede a revogação de um título já emitido — medido no oráculo. */
const SEGMENTO_DA_REVOGACAO = 'baixar';

/**
 * O caminho onde a credencial de acesso é concedida — **medido**, e com uma ressalva de alcance.
 *
 * ⚠️ **No oráculo o endereço de autorização é MÁQUINA PRÓPRIA**, distinta da API, e vem de
 * configuração (medido nesta task, leitura sem escrita da configuração do sistema antigo). O produto
 * novo declara **um** destino, resolvido uma vez na construção, e a restrição é deliberada — nenhuma
 * entrada do usuário decide para onde ele conecta. Enquanto os dois destinos forem um só, o caminho
 * abaixo é o que o produto pede; o marcador de {@link criarAdaptadorSicoob} carrega o que falta.
 */
const CAMINHO_DA_CREDENCIAL = '/auth/realms/cooperado/protocol/openid-connect/token';

/** A concessão pedida ao provedor de identidade, e as permissões — **medidas** no sistema antigo. */
const CONCESSAO_PEDIDA = 'client_credentials';
const PERMISSOES_PEDIDAS = 'boletos_inclusao boletos_consulta boletos_alteracao';

/** A chave sob a qual o corpo útil viaja em toda resposta do provedor (§13-A.4) — o envelope. */
const CHAVE_DO_ENVELOPE = 'resultado';

/** Onde a credencial concedida e o prazo dela aparecem na resposta do provedor de identidade. */
const CHAVE_DA_CREDENCIAL = 'access_token';
const CHAVE_DO_PRAZO = 'expires_in';

/** Os campos do dialeto que a tradução lê de volta — nomes do banco, usados como **valor**. */
const CHAVE_DO_NUMERO_DO_TITULO = 'nossoNumero';
const CHAVE_DA_LINHA_DIGITAVEL = 'linhaDigitavel';
const CHAVE_DO_CODIGO_DE_BARRAS = 'codigoBarras';
const CHAVE_DO_DOCUMENTO = 'pdfBoleto';
const CHAVE_DA_SITUACAO = 'situacaoBoleto';

/** Os nomes sob os quais o provedor informa data e valor do pagamento — a ordem é a de preferência. */
const CHAVES_DA_DATA_DO_PAGAMENTO = ['dataPagamento', 'dataLiquidacao', 'dataCredito'] as const;
const CHAVES_DO_VALOR_PAGO = ['valorPago', 'valorRecebido', 'valorLiquidado'] as const;

/** O que o provedor chama de "gere o documento" — medido no payload de emissão do oráculo. */
const PEDIDO_DO_DOCUMENTO = 'gerarPdf';

/**
 * Os valores fixos do pedido de emissão, **medidos no oráculo** — o que o sistema antigo sempre
 * enviou.
 *
 * Eles são nomeados porque são **contrato com o provedor**, e não número arbitrário: um `3` solto no
 * meio do objeto não diz que ali se declara *"não protestar"*. Nenhum deles é configuração do
 * produto — nenhum caminho os altera, e nenhuma tela os expõe.
 */
const ESPECIE_DE_DOCUMENTO = 'DM';
const EMISSAO_PELO_BENEFICIARIO = 2;
const DISTRIBUICAO_PELO_BENEFICIARIO = 2;
const SEM_DESCONTO = 0;
const SEM_MULTA = 0;
const JUROS_ISENTO = 3;
const SEM_NEGATIVACAO = 3;
const SEM_PROTESTO = 3;

/**
 * Os códigos com que o provedor diz *"esta credencial não vale"* — os dois, e nada além.
 *
 * Eles decidem **duas** coisas, e é por isso que a lista é nomeada em vez de repetida: a classe da
 * falha (`DA_EMPRESA`, porque valeria igual para a próxima cobrança) e o descarte da credencial
 * guardada. Duas listas para o mesmo fato divergiriam, e a divergência apareceria como uma cobrança
 * que para o lote sem limpar o cache — ou o contrário.
 */
const CODIGOS_DE_CREDENCIAL_MORTA: readonly number[] = [401, 403];

/** Os dois outros códigos que valem igual para a próxima cobrança: excesso e falha do lado de lá. */
const CODIGO_DE_EXCESSO_DE_CHAMADAS = 429;
const MENOR_CODIGO_DE_FALHA_DO_PROVEDOR = 500;

/** A partir daqui a resposta é recusa, e não desfecho da operação. */
const MENOR_CODIGO_DE_RECUSA = 400;

/** Os tipos de mídia que o adaptador declara. */
const TIPO_DE_JSON = 'application/json';
const TIPO_DE_FORMULARIO = 'application/x-www-form-urlencoded';

/** O prefixo do cabeçalho de autorização — o esquema de portador. */
const PREFIXO_DO_PORTADOR = 'Bearer ';

/**
 * O maior corpo de resposta que o adaptador aceita ler — **8 MiB**.
 *
 * O boleto vem embutido na resposta da emissão, em base64, e um documento de uma página fica na
 * ordem de dezenas de quilobytes; o teto é folga de duas ordens de grandeza. Ele não existe por
 * desempenho: sem ele, um par que despejasse bytes indefinidamente encheria a memória do processo —
 * e o teto de tempo não o pegaria, porque a conexão estaria **progredindo**.
 */
const MAIOR_CORPO_DE_RESPOSTA_BYTES = 8 * 1024 * 1024;

/**
 * O maior motivo que sai numa falha — o texto do provedor é recortado antes de atravessar a porta.
 *
 * O motivo é opaco e vai inteiro para a trilha (RN-15); *inteiro* aqui significa *"o que o provedor
 * disse"*, e não *"o que ele mandar, do tamanho que for"*. Resposta de terceiro não tem tamanho
 * garantido, e o campo é gravado e exibido.
 */
const MAIOR_MOTIVO_CARACTERES = 500;

/** Os cinco desfechos do aperto de mão — fechados por enumeração. */
type DesfechoDoAperto = 'ACEITE' | DesfechoSemResposta;

/**
 * Os quatro desfechos em que **não houve resposta** do provedor — o vocabulário estrutural do ato.
 *
 * Eles são os mesmos para a sonda e para as quatro operações porque descrevem o **transporte**, e
 * não o que se pediu: a ligação não abriu, o par recusou o certificado, o tempo acabou, ou o ato nem
 * chegou a começar. Nenhum deles é derivado de código de erro de biblioteca — ver {@link decidir}.
 */
type DesfechoSemResposta = 'INDISPONIVEL' | 'NAO_INICIADO' | 'RECUSA_PELO_PAR' | 'TEMPO_ESGOTADO';

/**
 * O texto de cada desfecho — `Record` **fechado**, e não um `switch` com ramo padrão.
 *
 * Desfecho novo sem texto **não compila**, que é a mesma disciplina de `STATUS_POR_CODIGO` na borda:
 * o compilador cobra o par, em vez de a ausência aparecer como `undefined` na tela do Admin. Foi
 * exatamente este `Record` que cobrou o texto do quinto desfecho quando ele nasceu.
 *
 * O tipo do **valor** é {@link DetalheDaVerificacao}, e não `string`: é ele que impede um texto de
 * fora do conjunto fechado de entrar aqui e atravessar a porta (D27 · F4/T8).
 */
const DETALHE_POR_DESFECHO: Record<DesfechoDoAperto, DetalheDaVerificacao> = {
  ACEITE: DETALHE_ACEITE,
  INDISPONIVEL: DETALHE_INDISPONIVEL,
  NAO_INICIADO: DETALHE_NAO_INICIADO,
  RECUSA_PELO_PAR: DETALHE_RECUSA_PELO_PAR,
  TEMPO_ESGOTADO: DETALHE_TEMPO_ESGOTADO,
};

/** O destino já resolvido e conferido, com as duas coordenadas escritas por extenso. */
interface DestinoDoProvedor {
  readonly hospedeiro: string;
  readonly porta: number;
}

/**
 * O que o adaptador de produção precisa para existir — o endereço, já lido do ambiente.
 *
 * Ele recebe **valor**, e não lê `process.env`: ver o cabeçalho. Nenhum teto e nenhum cabeçalho
 * entram aqui — teto é decisão deste módulo.
 */
export interface ConfiguracaoDoProvedorBancario {
  /** O endereço da instituição, tal como `ENDERECO_DO_PROVEDOR_BANCARIO` o declara. */
  readonly enderecoDoProvedor: string;
  /**
   * O endereço de AUTORIZAÇÃO — máquina distinta da API no provedor.
   *
   * ⚠️ Medido em 2026-08-20 na configuração do sistema antigo: a autorização vive em host próprio
   * (`auth.…`), e a API de cobrança em outro (`api.…`). Até então o adaptador falava com um host só,
   * e a concessão era pedida no endereço errado. É do PROVEDOR, e não da empresa — por isso mora
   * aqui, e não no ato.
   *
   * Opcional para não quebrar quem só usa a sonda de identidade, que não obtém credencial (D36):
   * ausente, a concessão é pedida no mesmo destino da API, que é o comportamento anterior.
   */
  readonly enderecoDeAutorizacao?: string;
  /**
   * O relógio do processo — **opcional**, e o padrão é o do runtime.
   *
   * A única decisão temporal deste adaptador é a validade da credencial de acesso, e ela precisa ser
   * atravessável **sem espera real**: cinco minutos de prazo não podem custar cinco minutos de
   * suíte, e o relógio falso instalado no runtime (`vi.useFakeTimers`) está fora da stack de teste
   * deste projeto — ele alcança tudo o que o processo agenda, inclusive o teto do próprio ato.
   *
   * ⚠️ Ela **não** é ponto de extensão criado para o teste: é a fronteira que a fatia declara
   * legítima, e o padrão mantém quem constrói em produção sem nada a informar. O carimbo
   * `verificadoEm` continua vindo do runtime — ele é registro do ato externo, não decisão.
   */
  readonly agora?: FonteDeTempo;
}

/**
 * A recusa por forma — nomeia a **variável**, jamais o valor recusado, e encerra a construção.
 *
 * Ela e a conferência de {@link resolverDestino} são exercidas por `CT-1008` e `CT-1009` de
 * `../test/adaptador-sicoob.spec.ts`, **sem fronteira de rede**: as três formas inutilizáveis com a
 * mensagem afirmada por igualdade literal, e os três endereços bem formados construindo o adaptador
 * — o par é que discrimina, porque a metade negativa sozinha seria satisfeita por uma guarda
 * degenerada em *recusa tudo*. Foi essa ausência de caso que o `D38 · F4/T10` registrava, e ela
 * deixou de existir na T12 da fatia `webhook-e-carne`.
 */
function recusarPorForma(): never {
  throw new Error(`${MOTIVO_DE_ENDERECO_INUTILIZAVEL}: ${VARIAVEL_DO_ENDERECO}`);
}

/**
 * Resolve o endereço declarado, **sem deixar o erro nativo subir**.
 *
 * A recusa acontece na **construção**, e não na primeira verificação: o processo não sobe com um
 * adaptador meio-pronto, e o Admin não descobre a configuração errada clicando em *"testar"*. É a
 * mesma barreira que falha fechado de `criarAdaptadorSmtp`.
 */
function resolverDestino(enderecoDoProvedor: string): DestinoDoProvedor {
  let endereco: URL;

  try {
    endereco = new URL(enderecoDoProvedor);
  } catch {
    return recusarPorForma();
  }

  if (endereco.protocol !== ESQUEMA_SEGURO || endereco.hostname === '') {
    recusarPorForma();
  }

  return {
    hospedeiro: endereco.hostname,
    porta: endereco.port === '' ? PORTA_SEGURA_PADRAO : Number(endereco.port),
  };
}

/** Um corpo a escrever no pedido, com o tipo de mídia que o descreve. */
interface CorpoDoPedido {
  readonly tipoDeMidia: string;
  readonly bytes: Buffer;
}

/**
 * O que se pede ao provedor num ato — a sonda e as quatro operações preenchem o mesmo formulário.
 *
 * `consumirCorpo` é o que separa as duas naturezas, e é conteúdo: a sonda **descarta** a resposta —
 * ela pergunta apenas se o par fala depois do aperto de mão, e o código é deliberadamente ignorado
 * (ver o cabeçalho) —, enquanto a operação lê o corpo porque é dele que a tradução vive. Quem vai
 * ler o corpo também declara o que aceita; a sonda não declara nada além da linha de pedido e do
 * `Host`, e é assim que o `CT-839` a mede no par.
 */
interface PedidoAoProvedor {
  readonly metodo: string;
  readonly caminho: string;
  readonly consumirCorpo: boolean;
  /** Ausente quando o pedido não tem corpo — `HEAD` e as consultas. */
  readonly corpo?: CorpoDoPedido;
  /** Ausente na sonda e na própria obtenção da credencial, que é quem a produz. */
  readonly credencial?: string;
}

/**
 * O que aconteceu no transporte — **responder é um desfecho; os outros quatro são a ausência dele**.
 *
 * O código da resposta entra aqui **cru**, e é a tradução de cada operação que decide o que ele
 * significa. Ele não vira classe de falha aqui dentro: quem sabe se um `404` é *"esta cobrança não
 * existe"* ou *"a revogação ainda não refletiu"* é quem perguntou.
 */
type DesfechoDoTransporte =
  | { readonly tipo: 'RESPONDEU'; readonly codigo: number; readonly texto: string }
  | { readonly tipo: DesfechoSemResposta };

/**
 * Fala com o provedor **uma vez**, e devolve o que aconteceu — o ponto único de todo ato externo.
 *
 * ---------------------------------------------------------------------------
 * O DISCRIMINADOR É ESTRUTURAL — a ligação chegou a abrir? —, e não o código do erro
 * ---------------------------------------------------------------------------
 *
 * Separar *"não alcancei a instituição"* de *"ela não aceitou o certificado"* por lista de códigos
 * (`ECONNREFUSED`, `EPROTO`, `ERR_TLS_*`) seria trazer para dentro do desfecho um vocabulário que
 * muda entre versões do runtime e que a ADR-0001 mantém fora da porta. Aqui a pergunta é outra e é
 * observável: **o TCP chegou a conectar?** Medido nos quatro cenários deste host — destino sem
 * ouvinte falha **sem** o evento `connect` (10 ms); material que o par não reconhece falha **depois**
 * dele; o par que aceita o TCP e não responde não falha, e cai no teto.
 *
 * ⚠️ **Nenhuma falha do runtime é repassada — nem a assíncrona, nem a síncrona.** Ela é lida apenas
 * para se saber que houve falha, e some em seguida: não vira `cause`, não vira propriedade, não entra
 * em texto nenhum. É a mesma decisão já tomada em `./leitura-do-material.ts`, e o que a sustenta é
 * que o desfecho aqui é escolhido por um fato **estrutural** — a ligação chegou a abrir? a requisição
 * chegou a existir? —, não pelo que a biblioteca escreveu. A menção explícita à falha **síncrona**
 * não é redundância: enquanto ela faltou, a frase acima era falsa naquele caminho, e o
 * `mac verify failure` do OpenSSL atravessava a porta como motivo de rejeição.
 *
 * ---------------------------------------------------------------------------
 * Cada saída passa por {@link decidir}, e é ela que desfaz o que o ato abriu
 * ---------------------------------------------------------------------------
 *
 * Ponto único de resolução, com temporizador limpo, requisição destruída e despachante desfeito —
 * inclusive no caminho em que o par nunca coopera. Uma segunda saída que esquecesse o despachante
 * deixaria a conexão viva para além do ato, e é exatamente isso que o CT-843 mede no par.
 */
function falarComOProvedor(
  destino: DestinoDoProvedor,
  material: Buffer,
  senha: string,
  pedido: PedidoAoProvedor,
): Promise<DesfechoDoTransporte> {
  return new Promise((resolver) => {
    // Despachante PRÓPRIO deste ato: sem conexão persistente e sem cache de sessão. O despachante
    // global do Node 24 tem `keepAlive` ligado por padrão, e usá-lo faria dois atos partilharem
    // conexão e sessão — o oposto da D6-b.
    const despachante = new Agent({ keepAlive: false, maxCachedSessions: 0 });
    let ligou = false;
    let decidido = false;
    // A requisição pode NÃO chegar a existir — ver o cabeçalho: `request(...)` lança de forma
    // síncrona quando o material não abre. `decidir` corre também nesse caminho, e é por isso que a
    // destruição dela é opcional aqui: sem o `?.`, o ponto único de saída falharia justamente no
    // desfecho que ele foi estendido para cobrir.
    let requisicao: ClientRequest | undefined;

    const decidir = (desfecho: DesfechoDoTransporte): void => {
      if (decidido) {
        return;
      }
      decidido = true;
      clearTimeout(expiracao);
      requisicao?.destroy();
      despachante.destroy();
      resolver(desfecho);
    };

    const expiracao = setTimeout(() => decidir({ tipo: 'TEMPO_ESGOTADO' }), TETO_DA_OPERACAO_MS);

    try {
      requisicao = request({
        protocol: ESQUEMA_SEGURO,
        hostname: destino.hospedeiro,
        port: destino.porta,
        method: pedido.metodo,
        path: pedido.caminho,
        headers: cabecalhosDoPedido(pedido),
        // O material e a senha entram nas opções da requisição — é o caminho que a M3 mediu, e o
        // único que o cliente nativo oferece para TLS mútuo.
        pfx: material,
        passphrase: senha,
        agent: despachante,
        // O teto vai TAMBÉM ao transporte, e não só ao relógio do ato: é o par de garantias que
        // faltava ao adaptador de e-mail, onde o limite existia no fonte e não alcançava o socket. O
        // relógio acima cobre o que este não cobre (resolução de nome pendurada); este cobre o
        // socket ocioso mesmo que o relógio venha a ser adiado por um laço de eventos ocupado.
        timeout: TETO_DA_OPERACAO_MS,
      });
    } catch {
      // A FALHA NÃO É LIDA — nem aqui, nem em lugar nenhum deste arquivo. O que se sabe é
      // estrutural e basta: a requisição não chegou a existir, logo nada foi apresentado e nada foi
      // tentado. Repassá-la traria `mac verify failure` / `not enough data` para dentro do desfecho,
      // que é o oposto do que a ADR-0001 governa; deixá-la subir rejeitaria a promessa, que é o
      // oposto do que a porta promete. O desfecho sai pelo MESMO ponto único, de modo que o
      // temporizador e o despachante são liberados aqui como em qualquer outro caminho.
      decidir({ tipo: 'NAO_INICIADO' });
      return;
    }

    requisicao.on('socket', (soquete) => {
      soquete.once('connect', () => {
        ligou = true;
      });
      // Um erro que chegue ao soquete DEPOIS de o ato ter sido decidido — o que o `destroy()` acima
      // provoca — derrubaria o processo por falta de ouvinte. O desfecho já está escolhido; o que
      // este ouvinte faz é não deixar o encerramento virar exceção não tratada.
      soquete.on('error', () => undefined);
    });

    requisicao.on('timeout', () => decidir({ tipo: 'TEMPO_ESGOTADO' }));

    requisicao.on('response', (resposta) => {
      const codigo = resposta.statusCode ?? 0;

      if (!pedido.consumirCorpo) {
        // O CÓDIGO NÃO É LIDO PELA SONDA, de propósito — ver o cabeçalho. A resposta é descartada
        // sem consumo: com `HEAD` não há corpo, e o que interessa já aconteceu.
        resposta.destroy();
        decidir({ tipo: 'RESPONDEU', codigo, texto: '' });
        return;
      }

      lerCorpo(resposta, (texto) => {
        if (texto === null) {
          // O corpo não completou — o par cortou, ou passou do teto de tamanho. Estruturalmente é o
          // mesmo fato que um erro depois de `connect`: a ligação abriu e o par falou. Não se lê o
          // que a biblioteca escreveu para decidir isto.
          decidir({ tipo: 'RECUSA_PELO_PAR' });
          return;
        }
        decidir({ tipo: 'RESPONDEU', codigo, texto });
      });
    });

    requisicao.on('error', () => decidir({ tipo: ligou ? 'RECUSA_PELO_PAR' : 'INDISPONIVEL' }));

    if (pedido.corpo !== undefined) {
      requisicao.write(pedido.corpo.bytes);
    }

    // Sem `end()`, o cliente nativo não conclui o pedido e o par nunca responde. Na sonda nenhum
    // corpo é escrito antes dele: o que sai é a linha de pedido e o cabeçalho `Host`, e nada mais.
    requisicao.end();
  });
}

/**
 * Os cabeçalhos do pedido — **derivados dele**, e nunca uma lista que quem chama monte.
 *
 * A sonda não declara nada: sem corpo, sem credencial e sem `accept`, o que sai é a linha de pedido
 * e o `Host` (é o que o `CT-839` mede no par). Quem vai **ler** o corpo declara o que aceita, e quem
 * escreve corpo declara o tipo e o comprimento dele.
 *
 * ⚠️ **A credencial entra aqui, e em nenhum outro lugar.** Ponto único: uma segunda montagem de
 * cabeçalho é uma segunda chance de a credencial de uma empresa acompanhar a chamada de outra.
 */
function cabecalhosDoPedido(pedido: PedidoAoProvedor): Record<string, string> {
  const cabecalhos: Record<string, string> = {};

  if (pedido.consumirCorpo) {
    cabecalhos.accept = TIPO_DE_JSON;
  }

  if (pedido.corpo !== undefined) {
    cabecalhos['content-type'] = pedido.corpo.tipoDeMidia;
    cabecalhos['content-length'] = String(pedido.corpo.bytes.length);
  }

  if (pedido.credencial !== undefined) {
    cabecalhos.authorization = `${PREFIXO_DO_PORTADOR}${pedido.credencial}`;
  }

  return cabecalhos;
}

/**
 * Acumula o corpo da resposta e entrega o texto — ou `null` quando ele não completou.
 *
 * O teto de tamanho é conferido **enquanto** os pedaços chegam, e não depois: um par que despejasse
 * bytes indefinidamente encheria a memória do processo antes de qualquer conferência ao final, e o
 * teto de tempo não o pegaria porque a conexão estaria progredindo.
 *
 * A falha de leitura devolve `null` **sem ser lida**, pela mesma regra do resto do arquivo: o que
 * decide o desfecho é o fato estrutural (o corpo completou?), não o que a biblioteca escreveu.
 */
function lerCorpo(resposta: IncomingMessage, pronto: (texto: string | null) => void): void {
  const pedacos: Buffer[] = [];
  let bytes = 0;

  resposta.on('data', (pedaco: Buffer) => {
    bytes += pedaco.length;
    if (bytes > MAIOR_CORPO_DE_RESPOSTA_BYTES) {
      resposta.destroy();
      pronto(null);
      return;
    }
    pedacos.push(pedaco);
  });
  resposta.on('aborted', () => pronto(null));
  resposta.on('error', () => pronto(null));
  resposta.on('end', () => pronto(Buffer.concat(pedacos).toString('utf8')));
}

/**
 * Completa o aperto de mão mútuo contra o destino, e devolve **qual** dos cinco desfechos ocorreu.
 *
 * Ela é o caso degenerado de {@link falarComOProvedor}: `HEAD` na raiz, sem corpo, sem credencial, e
 * **qualquer** resposta serve — `200`, `403` e `404` significam todos a mesma coisa aqui, que é *o
 * par completou o TLS mútuo e falou comigo*. Interpretar o código seria trazer o vocabulário do
 * provedor para dentro do desfecho, que é o que a ADR-0001 proíbe.
 */
async function apertarMao(
  destino: DestinoDoProvedor,
  material: Buffer,
  senha: string,
): Promise<DesfechoDoAperto> {
  const desfecho = await falarComOProvedor(destino, material, senha, {
    metodo: METODO_DA_SONDA,
    caminho: CAMINHO_DA_SONDA,
    consumirCorpo: false,
  });

  return desfecho.tipo === 'RESPONDEU' ? 'ACEITE' : desfecho.tipo;
}

// ===========================================================================
// A LEITURA DA RESPOSTA — entrada de terceiro entra como `unknown` e sai tipada
// ===========================================================================

/**
 * O que o produto diz quando o transporte não produziu resposta — texto **do produto**, por desfecho.
 *
 * `Record` fechado pela mesma disciplina de {@link DETALHE_POR_DESFECHO}: desfecho estrutural novo
 * sem motivo **não compila**. Nenhum deles cita a instituição, campo do provedor ou detrito do
 * runtime de transporte — eles descrevem o que aconteceu, e é isso que a trilha grava.
 */
const MOTIVO_POR_DESFECHO: Record<DesfechoSemResposta, string> = {
  INDISPONIVEL: 'não foi possível alcançar a instituição no endereço configurado',
  NAO_INICIADO: 'o certificado desta empresa não pôde ser apresentado, e nada foi tentado',
  RECUSA_PELO_PAR: 'a instituição não aceitou o certificado desta empresa na conexão segura',
  TEMPO_ESGOTADO: 'a instituição não respondeu dentro do tempo previsto',
};

/** O que se diz quando o provedor respondeu com falha e não escreveu texto algum. */
const MOTIVO_SEM_TEXTO = 'a instituição recusou a operação sem informar o motivo';

/** O que se diz quando o corpo veio, e não é o que a operação precisa para responder. */
const MOTIVO_DE_RESPOSTA_INESPERADA = 'a instituição respondeu em forma que não pôde ser lida';

/** O que se diz quando a situação informada não corresponde a nenhum estado do produto. */
const MOTIVO_DE_SITUACAO_DESCONHECIDA =
  'a instituição informou uma situação que o produto não trata';

/** O que se diz quando o provedor informa liquidação sem a data ou sem o valor. */
const MOTIVO_DE_LIQUIDACAO_INCOMPLETA =
  'a instituição informou o pagamento sem a data ou sem o valor, e ele não pode ser aplicado';

/** O que se diz quando a concessão da credencial volta sem credencial. */
const MOTIVO_DE_CREDENCIAL_AUSENTE =
  'a instituição não concedeu credencial de acesso a esta empresa';

/** O objeto que um valor de JSON é, ou `null` — arranjo e primitivo não são objeto para este fim. */
function objetoDe(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/**
 * O corpo útil de uma resposta, **desenvelopado** — e é aqui que o envelope morre.
 *
 * O corpo vem sob {@link CHAVE_DO_ENVELOPE} (medido, §13-A.4), e o oráculo mostra as duas formas
 * que o provedor produz: objeto e arranjo de um elemento. A raiz sem envelope é aceita como último
 * caso — é o que uma resposta de erro costuma ser.
 */
function corpoUtil(texto: string): Record<string, unknown> | null {
  let bruto: unknown;

  try {
    bruto = JSON.parse(texto);
  } catch {
    // Corpo que não é JSON não é diagnóstico: o motivo cru já viaja pelo texto da resposta.
    return null;
  }

  const raiz = objetoDe(bruto);

  if (raiz === null) {
    return Array.isArray(bruto) ? objetoDe(bruto[0]) : null;
  }

  const envelopado = raiz[CHAVE_DO_ENVELOPE];

  if (Array.isArray(envelopado)) {
    return objetoDe(envelopado[0]);
  }

  return objetoDe(envelopado) ?? raiz;
}

/**
 * O valor de uma chave como cadeia — **coagindo número para cadeia**, que é a fronteira do dialeto.
 *
 * ⚠️ **`nossoNumero` chega como INTEIRO** no JSON do provedor (medido, §13-A.4). Supor `string`
 * quebra na primeira resposta real, e deixar o número atravessar poria um `number` num campo que o
 * produto grava e publica como texto. A coerção acontece **aqui**, num ponto só, e vale para todo
 * campo textual do dialeto — porque o mesmo provedor que devolve um deles como inteiro pode devolver
 * outro.
 */
function cadeiaDo(corpo: Record<string, unknown>, chave: string): string {
  const valor = corpo[chave];

  if (typeof valor === 'string') {
    return valor.trim();
  }

  return typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : '';
}

/**
 * A **única** grafia de número em texto que este adaptador aceita — e a estreiteza é o mecanismo.
 *
 * ---------------------------------------------------------------------------
 * ELA ENUMERA A GRAFIA BOA, e não as ruins — porque isto aqui é DINHEIRO
 * ---------------------------------------------------------------------------
 *
 * {@link numeroDentre} é o único caminho por onde valor monetário do provedor entra no produto
 * ({@link CHAVES_DO_VALOR_PAGO} → `SituacaoConsultada.valorPago` → conferência → `numeric(15,2)`), e
 * a forma anterior — `Number(valor.replace(',', '.'))` — decidia por heurística: `replace` com cadeia
 * literal troca **só a primeira** ocorrência, de modo que `1.234,56` virava `NaN` e caía na recusa,
 * mas **`1.234` virava `1.234`**. Um pagamento de R$ 1.234,00 escrito nessa grafia era gravado como
 * R$ 1,23, **sem falha, sem motivo e sem sinal algum** — medido pelo Gate 2 e reconfirmado.
 *
 * O molde aceita, portanto, apenas o que se lê igual em qualquer convenção: dígitos sem separador de
 * milhar, com no máximo **um** separador decimal seguido de **uma ou duas** casas — que é, de quebra,
 * a precisão que a coluna representa. Fora dele ficam `1.234`, `1,234`, `1.234,56`, `1.234.567,89` e
 * a notação científica: toda grafia cuja leitura pt-BR e en-US divergem, e mais nenhuma decisão a
 * tomar. O desfecho de quem não casa é a recusa que **já existia e já era correta**
 * ({@link MOTIVO_DE_LIQUIDACAO_INCOMPLETA}, classe `DA_COBRANCA` — o lote marca e segue).
 *
 * ⚠️ **O ramo de texto não é exigido pela medição**: a §13-A.4 do discovery mediu o campo como
 * **número** no JSON. Ele é tolerância defensiva, e uma tolerância que erra em silêncio no exato
 * cenário para o qual existe é pior que a ausência dela.
 */
const NUMERO_EM_TEXTO_INEQUIVOCO = /^-?\d+(?:[.,]\d{1,2})?$/;

/**
 * O primeiro valor numérico entre as chaves dadas, ou `null`.
 *
 * Número chega como número (é o que a medição mostra); texto só é aceito na grafia inequívoca de
 * {@link NUMERO_EM_TEXTO_INEQUIVOCO}. **Um critério só**, e ele vale tanto para o valor pago quanto
 * para o prazo da credencial: dois critérios seriam duas leniências livres para divergir, e a que
 * sobrasse no dinheiro seria justamente a que este molde existe para fechar.
 */
function numeroDentre(corpo: Record<string, unknown>, chaves: readonly string[]): number | null {
  for (const chave of chaves) {
    const valor = corpo[chave];

    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return valor;
    }

    if (typeof valor === 'string') {
      const texto = valor.trim();

      if (NUMERO_EM_TEXTO_INEQUIVOCO.test(texto)) {
        const numero = Number(texto.replace(',', '.'));

        // A conferência de finitude **não** é redundante com o molde: uma cadeia de centenas de
        // dígitos casa `\d+` e `Number` a devolve como `Infinity`.
        if (Number.isFinite(numero)) {
          return numero;
        }
      }
    }
  }

  return null;
}

/** O primeiro texto não vazio entre as chaves dadas, ou `null`. */
function cadeiaDentre(corpo: Record<string, unknown>, chaves: readonly string[]): string | null {
  for (const chave of chaves) {
    const valor = cadeiaDo(corpo, chave);
    if (valor !== '') {
      return valor;
    }
  }

  return null;
}

/** A data de calendário `YYYY-MM-DD` de um texto do provedor, ou `null` quando ele não a informa. */
function dataDeCalendario(texto: string | null): string | null {
  if (texto === null) {
    return null;
  }

  const achado = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);

  return achado === null ? null : `${achado[1]}-${achado[2]}-${achado[3]}`;
}

/** O que ocupa o lugar da credencial no motivo, quando o provedor ecoa o que ela portava. */
const CREDENCIAL_REDIGIDA = '«credencial omitida»';

/**
 * O motivo que sai numa falha — texto **do provedor**, opaco, recortado por comprimento.
 *
 * ---------------------------------------------------------------------------
 * A CREDENCIAL DAQUELE ATO É REDIGIDA AQUI, e aqui é o ponto único
 * ---------------------------------------------------------------------------
 *
 * O motivo é gravado e exibido (RN-15), e nas operações de cobrança ele é o corpo cru de uma resposta
 * a uma requisição que portou `authorization: <credencial>`. Provedor que ecoe o cabeçalho recebido —
 * hábito comum em diagnóstico de erro — poria credencial **viva** numa superfície persistida e
 * apresentada. Como toda recusa respondida compõe o motivo por esta função, e apenas por ela, a
 * redação instalada aqui alcança todos os caminhos: é a mesma topologia de ponto único da montagem
 * do cabeçalho em {@link cabecalhosDoPedido}, e pela mesma razão (ADR-0032).
 *
 * ⚠️ **A redação vem ANTES do recorte**, e a ordem é conteúdo: recortar primeiro deixaria passar o
 * prefixo da credencial que coubesse nos {@link MAIOR_MOTIVO_CARACTERES} caracteres.
 *
 * `credencialDoAto` é opcional porque {@link obterCredencial} compõe motivo **antes** de haver
 * credencial alguma — ali não há o que redigir, e o parâmetro ausente diz exatamente isso.
 */
function motivoDoTexto(texto: string, credencialDoAto?: string): string {
  const semCredencial =
    credencialDoAto === undefined || credencialDoAto === ''
      ? texto
      : texto.split(credencialDoAto).join(CREDENCIAL_REDIGIDA);
  const limpo = semCredencial.trim();

  return limpo === '' ? MOTIVO_SEM_TEXTO : limpo.slice(0, MAIOR_MOTIVO_CARACTERES);
}

/**
 * A que classe pertence uma falha que o provedor **respondeu** (RN-02).
 *
 * A pergunta é *"esta falha valeria igual para a próxima cobrança?"*. Credencial recusada, acesso
 * negado, excesso de chamadas e falha do lado de lá valem — o percurso do lote **para** (`DA_EMPRESA`).
 * O resto é daquela cobrança e de nenhuma outra: o percurso marca e **segue** (`DA_COBRANCA`).
 *
 * ⚠️ **Nenhum código do provedor entra no desfecho** — ele decide a classe aqui e some. O que
 * atravessa a porta é a classe do produto mais o motivo opaco.
 */
function classeDoCodigo(codigo: number): ClasseDaFalha {
  return CODIGOS_DE_CREDENCIAL_MORTA.includes(codigo) ||
    codigo === CODIGO_DE_EXCESSO_DE_CHAMADAS ||
    codigo >= MENOR_CODIGO_DE_FALHA_DO_PROVEDOR
    ? 'DA_EMPRESA'
    : 'DA_COBRANCA';
}

/** A falha de um desfecho sem resposta — sempre `DA_EMPRESA`: nenhuma delas é daquela cobrança. */
function falhaDoTransporte(tipo: DesfechoSemResposta): DesfechoDaOperacao<never> {
  return { aceito: false, classe: 'DA_EMPRESA', motivo: MOTIVO_POR_DESFECHO[tipo] };
}

// ===========================================================================
// A COMPOSIÇÃO DO PEDIDO — o dialeto sai daqui, e de nenhum outro lugar
// ===========================================================================

/**
 * O pedido de credencial de acesso, no formulário que o provedor de identidade espera.
 *
 * ⚠️ **Falta aqui o identificador da aplicação perante o provedor**, e a ausência é medida, não
 * esquecida: o produto não o modela em lugar nenhum — nem na tabela, nem no contrato, nem no envelope
 * cifrado —, e o tech spec §8 o agenda para o **que se cifra**, sem que nenhuma task desta fatia
 * alargue o envelope. Ele entra **nesta função**, numa linha, quando o envelope o carregar. Ver o
 * `DÉBITO COM GATILHO` de {@link criarAdaptadorSicoob}.
 */
function comporPedidoDeCredencial(identificadorDaAplicacao: string): CorpoDoPedido {
  const formulario = new URLSearchParams({
    grant_type: CONCESSAO_PEDIDA,
    // ⚠️ O identificador da aplicação é OBRIGATÓRIO na concessão, e a ausência dele era o que
    // impedia o produto de obter credencial — fechamento do `D36 · F4/T10`, em 2026-08-20. O nome
    // do campo é do dialeto do provedor (`client_id`), como `nossoNumero` e `seuNumero`.
    client_id: identificadorDaAplicacao,
    scope: PERMISSOES_PEDIDAS,
  });

  return { tipoDeMidia: TIPO_DE_FORMULARIO, bytes: Buffer.from(formulario.toString(), 'utf8') };
}

/**
 * Quem paga, no dialeto do provedor — a tradução que o docblock de `LocatarioDaCobranca` promete.
 *
 * O produto guarda logradouro, número e complemento em campos próprios; o provedor quer **um**
 * endereço. A composição acontece aqui, e o cadastro continua com os três campos separados.
 */
function comporQuemPaga(locatario: LocatarioDaCobranca): Record<string, unknown> {
  const complemento = locatario.complemento === null ? '' : ` ${locatario.complemento}`;

  return {
    numeroCpfCnpj: locatario.documento,
    nome: locatario.nome,
    endereco: `${locatario.logradouro}, ${locatario.numero}${complemento}`.trim(),
    bairro: locatario.bairro,
    cidade: locatario.cidade,
    cep: locatario.cep,
    uf: locatario.estado.trim().toUpperCase(),
  };
}

/**
 * O pedido de emissão, no dialeto do provedor — os valores fixos são **medidos no oráculo**.
 *
 * Os campos técnicos (espécie do documento, forma de emissão e distribuição, tipos de desconto,
 * multa e juros, negativação e protesto) são os que o sistema antigo sempre enviou, e entram aqui
 * como os valores dele. Eles não são configuração do produto: nenhum caminho os altera, e nenhuma
 * tela os expõe.
 *
 * ⚠️ **O produto não pede registro de chave Pix**, e a ausência é decisão: o oráculo pede, e a RN-11
 * declara o meio **sem operação** nesta fatia. Pedir o registro de uma chave que nenhum caminho do
 * produto consome criaria efeito no provedor sem consumidor aqui.
 *
 * ⚠️ **Faltam os dados da conta** — número do cliente, modalidade e conta corrente —, e a ausência é
 * medida: o modelo canônico não os carrega, e nenhuma tabela do produto os guarda. Ver o
 * `DÉBITO COM GATILHO` de {@link criarAdaptadorSicoob}.
 */
function comporEmissao(pedido: PedidoDeEmissao): CorpoDoPedido {
  const corpo = {
    // Os TRÊS da conta, no dialeto do provedor. Sem eles a emissão é recusada: o provedor precisa
    // saber em qual conta e sob qual modalidade o título nasce. Fechamento do `D36 · F4/T10`.
    numeroCliente: pedido.identidade.numeroDoCliente,
    numeroContaCorrente: pedido.identidade.numeroDaContaCorrente,
    codigoModalidade: pedido.identidade.codigoDaModalidade,
    seuNumero: pedido.identificadorNoProvedor,
    dataVencimento: pedido.vencimento,
    valor: pedido.valor,
    codigoEspecieDocumento: ESPECIE_DE_DOCUMENTO,
    identificacaoEmissaoBoleto: EMISSAO_PELO_BENEFICIARIO,
    identificacaoDistribuicaoBoleto: DISTRIBUICAO_PELO_BENEFICIARIO,
    tipoDesconto: SEM_DESCONTO,
    tipoMulta: SEM_MULTA,
    tipoJurosMora: JUROS_ISENTO,
    codigoNegativacao: SEM_NEGATIVACAO,
    codigoProtesto: SEM_PROTESTO,
    [PEDIDO_DO_DOCUMENTO]: true,
    pagador: comporQuemPaga(pedido.locatario),
  };

  return { tipoDeMidia: TIPO_DE_JSON, bytes: Buffer.from(JSON.stringify(corpo), 'utf8') };
}

/** O caminho de consulta de um título, com o número que o provedor lhe atribuiu. */
function caminhoDaConsulta(numeroDoTituloNoProvedor: string, comDocumento: boolean): string {
  const parametros = new URLSearchParams({
    [CHAVE_DO_NUMERO_DO_TITULO]: numeroDoTituloNoProvedor,
  });

  if (comDocumento) {
    parametros.set(PEDIDO_DO_DOCUMENTO, 'true');
  }

  return `${RECURSO_DOS_BOLETOS}?${parametros.toString()}`;
}

/** O caminho que pede a revogação de um título já emitido. */
function caminhoDaRevogacao(numeroDoTituloNoProvedor: string): string {
  return `${RECURSO_DOS_BOLETOS}/${encodeURIComponent(numeroDoTituloNoProvedor)}/${SEGMENTO_DA_REVOGACAO}`;
}

// ===========================================================================
// A TRADUÇÃO DE VOLTA — do dialeto para o vocabulário do produto
// ===========================================================================

// DECISÃO FECHADA — T8 (fatia ii) / Gate 2 · 2026-08-17
// O QUÊ: o cotejo de situação é um `Map`, e **não** um objeto literal indexado por cadeia.
// POR QUÊ: objeto literal carrega as propriedades de `Object.prototype`, e a guarda `=== undefined`
//          é suficiente para o TIPO (com `noUncheckedIndexedAccess` o compilador a aceita) e não
//          para o RUNTIME. Medido pelo Gate 2 e reconfirmado: `situacaoBoleto: "constructor"`
//          normaliza para `"constructor"`, o acesso devolve uma **função**, a guarda não a pega e o
//          desfecho atravessava a porta com o discriminador `situacao` valendo uma função, onde o
//          tipo promete `'EM_ABERTO' | 'LIQUIDADO' | 'REVOGADO'`. As outras herdadas (`__proto__`,
//          `hasOwnProperty`, `toString`, `valueOf`) eram neutralizadas **por acidente** da
//          normalização, e acidente não é garantia.
// REVERTER EXIGE: provar que nenhuma cadeia de terceiro, depois de {@link situacaoNormalizada},
//          alcança propriedade alguma herdada de `Object.prototype` — para **toda** propriedade que
//          o protótipo tenha hoje ou venha a ter. Guarda por `Object.hasOwn` fecha o caso conhecido
//          por enumeração; o `Map` o fecha por construção, e é por isso que ele foi escolhido.
/**
 * O que o provedor chama a situação de um título, e o que cada uma significa para o produto.
 *
 * ⚠️ Ele é um `Map` **por construção, e não por gosto** — ver o marcador acima. Um `Map` não tem
 * chave que ninguém pôs nele, de modo que `get` devolve `undefined` para toda cadeia que não esteja
 * declarada aqui, sem que a lista precise antecipar o que o protótipo do runtime carrega.
 */
const SITUACAO_DO_PRODUTO = new Map<string, 'EM_ABERTO' | 'LIQUIDADO' | 'REVOGADO'>([
  ['em aberto', 'EM_ABERTO'],
  ['aberto', 'EM_ABERTO'],
  ['vencido', 'EM_ABERTO'],
  ['liquidado', 'LIQUIDADO'],
  ['baixado', 'REVOGADO'],
  ['baixa', 'REVOGADO'],
  ['cancelado', 'REVOGADO'],
  ['cancelada', 'REVOGADO'],
]);

/**
 * Normaliza o texto de situação antes do cotejo — acento, caixa, sublinhado e espaço sobrando.
 *
 * A normalização é a **medida no oráculo**, e existe porque o mesmo estado chega escrito de mais de
 * uma forma. O que não se reconhece **não vira estado do produto**: sai como falha daquela cobrança,
 * com o texto cru como motivo opaco (RN-15).
 */
function situacaoNormalizada(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * O boleto emitido, lido do corpo útil — os três identificadores e os bytes do documento.
 *
 * A ausência de qualquer um deles é falha, e não um boleto pela metade: uma cobrança com linha
 * digitável e sem número do título — ou com número e sem documento — é exatamente o estado que a
 * fronteira de dados não sabe representar, e que o débito D13 desta fatia nomeia no banco.
 */
function lerBoletoEmitido(corpo: Record<string, unknown>): BoletoEmitido | null {
  const numeroDoTituloNoProvedor = cadeiaDo(corpo, CHAVE_DO_NUMERO_DO_TITULO);
  const linhaDigitavel = cadeiaDo(corpo, CHAVE_DA_LINHA_DIGITAVEL);
  const codigoDeBarras = cadeiaDo(corpo, CHAVE_DO_CODIGO_DE_BARRAS);
  const documento = cadeiaDo(corpo, CHAVE_DO_DOCUMENTO);

  if (
    numeroDoTituloNoProvedor === '' ||
    linhaDigitavel === '' ||
    codigoDeBarras === '' ||
    documento === ''
  ) {
    return null;
  }

  return {
    numeroDoTituloNoProvedor,
    linhaDigitavel,
    codigoDeBarras,
    documento: Buffer.from(documento, 'base64'),
  };
}

/**
 * A situação do título, traduzida — ou a falha, quando o que veio não vira estado do produto.
 *
 * ⚠️ **Nenhuma situação do dialeto medido corresponde a ESTORNO.** O estorno é descoberto pela
 * conferência, ao comparar o que o produto gravou com o que o provedor informa agora — não é um
 * estado que ele anuncie. Inventar aqui um cotejo para ele seria escrever regra de negócio no
 * adaptador.
 */
function lerSituacao(
  corpo: Record<string, unknown>,
  incluirDocumento: boolean,
): DesfechoDaOperacao<SituacaoConsultada> {
  const situacaoCrua = cadeiaDo(corpo, CHAVE_DA_SITUACAO);
  // `get`, e nunca indexação: ver a `DECISÃO FECHADA` de {@link SITUACAO_DO_PRODUTO}. O que não foi
  // declarado ali sai `undefined` e vira recusa — inclusive o que o protótipo do runtime carrega.
  const situacao = SITUACAO_DO_PRODUTO.get(situacaoNormalizada(situacaoCrua));

  if (situacao === undefined) {
    return {
      aceito: false,
      classe: 'DA_COBRANCA',
      motivo: situacaoCrua === '' ? MOTIVO_DE_RESPOSTA_INESPERADA : MOTIVO_DE_SITUACAO_DESCONHECIDA,
    };
  }

  const bruto = incluirDocumento ? cadeiaDo(corpo, CHAVE_DO_DOCUMENTO) : '';
  const documento = bruto === '' ? null : Buffer.from(bruto, 'base64');

  if (situacao === 'LIQUIDADO') {
    const pagoEm = dataDeCalendario(cadeiaDentre(corpo, CHAVES_DA_DATA_DO_PAGAMENTO));
    const valorPago = numeroDentre(corpo, CHAVES_DO_VALOR_PAGO);

    if (pagoEm === null || valorPago === null) {
      return { aceito: false, classe: 'DA_COBRANCA', motivo: MOTIVO_DE_LIQUIDACAO_INCOMPLETA };
    }

    return { aceito: true, valor: { situacao, documento, pagoEm, valorPago } };
  }

  if (situacao === 'REVOGADO') {
    // O motivo é o texto CRU da situação: nada o interpreta, e é isso que torna um motivo
    // desconhecido inócuo (RN-15).
    return { aceito: true, valor: { situacao, documento, motivo: situacaoCrua } };
  }

  return { aceito: true, valor: { situacao, documento } };
}

/**
 * Cria o adaptador de produção da porta de identidade sobre o cliente nativo.
 *
 * **Recusa a construção** com endereço que não serve — ver {@link resolverDestino}. O destino é
 * resolvido **uma vez**, aqui, e não a cada verificação: é o que impede que uma alteração do
 * ambiente em execução mude o destino de um processo já de pé.
 *
 * ---------------------------------------------------------------------------
 * UM adaptador satisfaz as DUAS portas, e isso é escolha dele — não da fronteira
 * ---------------------------------------------------------------------------
 *
 * A porta de identidade responde *"esta identidade serve?"*, que é ato de configuração; a de cobrança
 * responde pelos atos de cobrança. Elas não se fundem (ver `./porta-de-cobranca.ts`), e quem as
 * satisfaz aqui é o mesmo objeto porque o transporte, o destino e o cache de credencial são os
 * mesmos. Quem recebe continua recebendo **a porta que usa**, por parâmetro.
 *
 * O cache da credencial nasce **por adaptador**, e portanto por processo: é o que faz um lote de 47
 * boletos custar uma obtenção em vez de 47 (D5), e é a chave por empresa dele que impede a credencial
 * de uma empresa de acompanhar a chamada de outra.
 *
 */
export function criarAdaptadorSicoob(
  config: ConfiguracaoDoProvedorBancario,
): PortaDeIdentidadeBancaria & AdaptadorCobrancaBancaria {
  const destino = resolverDestino(config.enderecoDoProvedor);
  // Ausente o endereço próprio, a concessão continua indo ao destino da API — o comportamento de
  // antes de 2026-08-20, preservado para quem só usa a sonda.
  const destinoDaAutorizacao =
    config.enderecoDeAutorizacao === undefined
      ? destino
      : resolverDestino(config.enderecoDeAutorizacao);
  const agora = config.agora ?? Date.now;
  const credenciais = criarCacheDeCredenciais(agora);

  /**
   * Obtém a credencial de acesso da empresa apresentando o certificado dela — o pedido do dialeto.
   *
   * Ela corre **dentro** do adaptador, e não como quinta operação da porta: credencial de acesso é
   * vocabulário do provedor, e pô-la na porta contrariaria a cláusula que a ADR-0001 declara ser
   * propriedade do vocabulário (§21.1(1) do tech spec, decidido pelo usuário em 2026-08-16).
   */
  const obterCredencial = async (
    material: Buffer,
    senha: string,
    identificadorDaAplicacao: string,
  ): Promise<DesfechoDaOperacao<CredencialConcedida>> => {
    const desfecho = await falarComOProvedor(destinoDaAutorizacao, material, senha, {
      metodo: METODO_DE_ENVIO,
      caminho: CAMINHO_DA_CREDENCIAL,
      consumirCorpo: true,
      corpo: comporPedidoDeCredencial(identificadorDaAplicacao),
    });

    if (desfecho.tipo !== 'RESPONDEU') {
      return falhaDoTransporte(desfecho.tipo);
    }

    if (desfecho.codigo >= MENOR_CODIGO_DE_RECUSA) {
      // Credencial recusada vale igual para a próxima cobrança — é sempre falha DA EMPRESA, e não
      // daquela cobrança, mesmo quando o provedor responde com código da faixa do cliente.
      return { aceito: false, classe: 'DA_EMPRESA', motivo: motivoDoTexto(desfecho.texto) };
    }

    const corpo = corpoUtil(desfecho.texto);
    const credencial = corpo === null ? '' : cadeiaDo(corpo, CHAVE_DA_CREDENCIAL);

    if (corpo === null || credencial === '') {
      return { aceito: false, classe: 'DA_EMPRESA', motivo: MOTIVO_DE_CREDENCIAL_AUSENTE };
    }

    return {
      aceito: true,
      valor: { credencial, validaPorSegundos: numeroDentre(corpo, [CHAVE_DO_PRAZO]) },
    };
  };

  /**
   * Executa uma operação de cobrança: abre o segredo, obtém a credencial e fala com o provedor.
   *
   * ⚠️ **É o único caminho das quatro operações**, e a ordem é conteúdo: sem credencial viva não há
   * chamada, e a credencial vem do cache **daquela empresa**. O claro nasce aqui e morre com a
   * chamada — não é copiado, não é mutado e não é retido (ADR-0032, D6-b).
   */
  const executar = async <T>(
    ato: {
      readonly empresaId: string;
      readonly segredo: SegredoOperavel;
      readonly identidade: IdentidadeDoProvedor;
    },
    pedido: () => Omit<PedidoAoProvedor, 'credencial' | 'consumirCorpo'>,
    traduzir: (texto: string) => DesfechoDaOperacao<T>,
  ): Promise<DesfechoDaOperacao<T>> => {
    const { material, senha } = ato.segredo.abrir();
    const credencial = await credenciais.credencialDaEmpresa(ato.empresaId, () =>
      obterCredencial(material, senha, ato.identidade.identificadorDaAplicacao),
    );

    if (!credencial.aceito) {
      return credencial;
    }

    const desfecho = await falarComOProvedor(destino, material, senha, {
      ...pedido(),
      consumirCorpo: true,
      credencial: credencial.valor,
    });

    if (desfecho.tipo !== 'RESPONDEU') {
      return falhaDoTransporte(desfecho.tipo);
    }

    if (desfecho.codigo >= MENOR_CODIGO_DE_RECUSA) {
      if (CODIGOS_DE_CREDENCIAL_MORTA.includes(desfecho.codigo)) {
        // O prazo que o provedor declarou não é promessa: ele pode invalidar a credencial antes. Sem
        // isto, a guardada seguiria sendo apresentada até o relógio local concordar, e **todas** as
        // chamadas desta empresa falhariam até lá — as repetições da fila inclusive. Nada é repetido
        // aqui: quem repete é a fila (§3.3), e o que se faz é não deixá-la achar a mesma credencial
        // morta guardada.
        credenciais.esquecerCredencialDaEmpresa(ato.empresaId);
      }

      return {
        aceito: false,
        classe: classeDoCodigo(desfecho.codigo),
        // A credencial deste ato é redigida do texto do provedor — ver {@link motivoDoTexto}. Só
        // aqui ela está em mão, e é o único caminho em que o texto recusado responde a uma
        // requisição que a portou.
        motivo: motivoDoTexto(desfecho.texto, credencial.valor),
      };
    }

    return traduzir(desfecho.texto);
  };

  return {
    async verificarIdentidade(
      identidade: IdentidadeParaVerificar,
    ): Promise<ResultadoDaVerificacaoDeIdentidade> {
      // O claro nasce aqui e morre com a chamada: não é copiado, não é mutado, não é retido, e não
      // existe cache algum entre atos (ADR-0032, e a D6-b).
      const { material, senha } = identidade.segredo.abrir();
      const desfecho = await apertarMao(destino, material, senha);

      return {
        aceito: desfecho === 'ACEITE',
        // Carimbo do ato externo, em UTC. Ele não decide comportamento de negócio — a vigência do
        // certificado é comparada com a data corrente da operação, no banco (ADR-0026).
        verificadoEm: new Date().toISOString(),
        detalhe: DETALHE_POR_DESFECHO[desfecho],
      };
    },

    emitir(pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>> {
      return executar(
        pedido,
        () => ({
          metodo: METODO_DE_ENVIO,
          caminho: RECURSO_DOS_BOLETOS,
          corpo: comporEmissao(pedido),
        }),
        (texto) => {
          const corpo = corpoUtil(texto);
          const boleto = corpo === null ? null : lerBoletoEmitido(corpo);

          return boleto === null
            ? { aceito: false, classe: 'DA_COBRANCA', motivo: MOTIVO_DE_RESPOSTA_INESPERADA }
            : { aceito: true, valor: boleto };
        },
      );
    },

    solicitarRevogacaoDeBoleto(boleto: AtoSobreBoleto): Promise<DesfechoDaOperacao<void>> {
      return executar(
        boleto,
        () => ({
          metodo: METODO_DE_ENVIO,
          caminho: caminhoDaRevogacao(boleto.numeroDoTituloNoProvedor),
          // O corpo é vazio de propósito: o número do título vai no caminho, e o que faltaria aqui
          // são os dados da conta — ver o marcador acima.
          corpo: { tipoDeMidia: TIPO_DE_JSON, bytes: Buffer.from('{}', 'utf8') },
        }),
        // O pedido foi aceito, e é só isso que se sabe: o provedor não revoga na mesma resposta, e é
        // por isso que a confirmação é operação distinta (ver `./porta-de-cobranca.ts`).
        () => ({ aceito: true, valor: undefined }),
      );
    },

    confirmarRevogacaoDeBoleto(boleto: AtoSobreBoleto): Promise<DesfechoDaOperacao<boolean>> {
      return executar(
        boleto,
        () => ({
          metodo: METODO_DE_LEITURA,
          caminho: caminhoDaConsulta(boleto.numeroDoTituloNoProvedor, false),
        }),
        (texto) => {
          const corpo = corpoUtil(texto);

          if (corpo === null) {
            return { aceito: false, classe: 'DA_COBRANCA', motivo: MOTIVO_DE_RESPOSTA_INESPERADA };
          }

          const situacao = lerSituacao(corpo, false);

          // `false` NÃO é falha: é a resposta *"ainda não"*, e é o que a sondagem da reemissão espera
          // receber até o teto dela. Modelá-la como desfecho negativo faria a espera normal parecer
          // erro, e a reemissão desistiria na primeira pergunta.
          return situacao.aceito
            ? { aceito: true, valor: situacao.valor.situacao === 'REVOGADO' }
            : situacao;
        },
      );
    },

    consultarSituacao(
      consulta: ConsultaDeSituacao,
    ): Promise<DesfechoDaOperacao<SituacaoConsultada>> {
      return executar(
        consulta,
        () => ({
          metodo: METODO_DE_LEITURA,
          caminho: caminhoDaConsulta(consulta.numeroDoTituloNoProvedor, consulta.incluirDocumento),
        }),
        (texto) => {
          const corpo = corpoUtil(texto);

          return corpo === null
            ? { aceito: false, classe: 'DA_COBRANCA', motivo: MOTIVO_DE_RESPOSTA_INESPERADA }
            : lerSituacao(corpo, consulta.incluirDocumento);
        },
      );
    },
  };
}
