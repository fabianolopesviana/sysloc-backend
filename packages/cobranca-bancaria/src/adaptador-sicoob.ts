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
 * ⚠️ **`client_credentials` NÃO é exercitado**, e a ausência é decisão registrada — ver o
 * `DÉBITO COM GATILHO` logo abaixo.
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
 */

import type { ClientRequest } from 'node:http';
import { Agent, request } from 'node:https';
import type {
  IdentidadeParaVerificar,
  ResultadoDaVerificacaoDeIdentidade,
} from './modelo-canonico.js';
import type { PortaDeIdentidadeBancaria } from './porta-de-identidade.js';

/**
 * Teto do ato inteiro — conectar, apertar a mão e receber a primeira resposta.
 *
 * Ele é **exportado**, e a exportação é conteúdo, não conveniência: enquanto o limite ficava privado
 * no adaptador de e-mail, a verificação só podia reescrevê-lo como literal, e a asserção passava a
 * medir o teste em vez do artefato — foi assim que três limites declarados no fonte, lidos pelo
 * compilador e **sem efeito algum** sobre o transporte, sobreviveram a cinco rodadas de gate
 * (`packages/regua/src/coordenadas-do-transporte.ts`). Aqui o CT-842 importa esta constante e mede o
 * **efeito** dela contra um par que aceita o TCP e nunca responde.
 *
 * Sem teto, a requisição do Admin ficaria pendurada enquanto o par não fechasse a conexão, segurando
 * a resposta HTTP e o material decifrado na memória do processo por tempo indefinido.
 */
export const TETO_DO_APERTO_DE_MAO_MS = 10_000;

/**
 * O alcance do desfecho positivo — e a ressalva é a parte que importa.
 *
 * ⚠️ Nenhum destes cinco textos nomeia a instituição, cita campo do provedor ou carrega detrito do
 * runtime de transporte. É o que mantém verdadeira a cláusula de vocabulário da ADR-0001 no único
 * campo por onde texto atravessa a porta.
 */
export const DETALHE_ACEITE =
  'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Isto confirma a identidade da empresa perante ela; não confirma que a emissão de cobrança já ' +
  'está habilitada, o que depende das credenciais de habilitação';

/** O par completou a conexão e **não** aceitou o certificado apresentado. */
export const DETALHE_RECUSA_PELO_PAR =
  'a instituição não aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Confira se o certificado é o que ela emitiu para esta empresa e se continua válido perante ela';

/** Não houve conexão: o destino não respondeu ao pedido de ligação, e nada foi apresentado. */
export const DETALHE_INDISPONIVEL =
  'não foi possível alcançar a instituição no endereço configurado, e o certificado desta empresa ' +
  'não chegou a ser apresentado. Tente novamente em alguns minutos';

/** A conexão abriu e o par não concluiu dentro do teto — desfecho distinto dos outros quatro. */
export const DETALHE_TEMPO_ESGOTADO =
  'a instituição não concluiu a conferência do certificado dentro do tempo previsto, e por isso ' +
  'esta tentativa não confirma nem recusa a identidade da empresa. Tente novamente';

/**
 * O ato **não chegou a começar**: a apresentação do certificado falhou antes de qualquer conexão.
 *
 * O texto afirma só o que é verdade em **todo** caminho que produz este desfecho — nada foi
 * apresentado e nada foi tentado — e aponta a ação certa para a causa dominante e medida (material ou
 * senha que não abrem) sem **declarar** essa causa, que o adaptador não tem como distinguir sem ler o
 * erro do runtime. Ler o erro é justamente o que a ADR-0001 mantém fora da porta.
 */
export const DETALHE_NAO_INICIADO =
  'a verificação não chegou a começar: o certificado desta empresa não foi apresentado e nenhuma ' +
  'conexão com a instituição foi tentada. Confira o certificado e a senha registrados para esta ' +
  'empresa e tente novamente';

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

/** Os cinco desfechos do aperto de mão — fechados por enumeração. */
type DesfechoDoAperto =
  | 'ACEITE'
  | 'INDISPONIVEL'
  | 'NAO_INICIADO'
  | 'RECUSA_PELO_PAR'
  | 'TEMPO_ESGOTADO';

/**
 * O texto de cada desfecho — `Record` **fechado**, e não um `switch` com ramo padrão.
 *
 * Desfecho novo sem texto **não compila**, que é a mesma disciplina de `STATUS_POR_CODIGO` na borda:
 * o compilador cobra o par, em vez de a ausência aparecer como `undefined` na tela do Admin. Foi
 * exatamente este `Record` que cobrou o texto do quinto desfecho quando ele nasceu.
 */
const DETALHE_POR_DESFECHO: Record<DesfechoDoAperto, string> = {
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
 * Ele recebe **valor**, e não lê `process.env`: ver o cabeçalho. Nenhum teto, nenhum cabeçalho e
 * nenhuma credencial entram aqui — teto é decisão deste módulo, e credencial de habilitação é da
 * fatia (ii).
 */
export interface ConfiguracaoDoProvedorBancario {
  /** O endereço da instituição, tal como `ENDERECO_DO_PROVEDOR_BANCARIO` o declara. */
  readonly enderecoDoProvedor: string;
}

/** A recusa por forma — nomeia a variável e encerra a construção. */
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

/**
 * Completa o aperto de mão mútuo contra o destino, e devolve **qual** dos cinco desfechos ocorreu.
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
function apertarMao(
  destino: DestinoDoProvedor,
  material: Buffer,
  senha: string,
): Promise<DesfechoDoAperto> {
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

    const decidir = (desfecho: DesfechoDoAperto): void => {
      if (decidido) {
        return;
      }
      decidido = true;
      clearTimeout(expiracao);
      requisicao?.destroy();
      despachante.destroy();
      resolver(desfecho);
    };

    const expiracao = setTimeout(() => decidir('TEMPO_ESGOTADO'), TETO_DO_APERTO_DE_MAO_MS);

    try {
      requisicao = request({
        protocol: ESQUEMA_SEGURO,
        hostname: destino.hospedeiro,
        port: destino.porta,
        method: METODO_DA_SONDA,
        path: CAMINHO_DA_SONDA,
        // O material e a senha entram nas opções da requisição — é o caminho que a M3 mediu, e o
        // único que o cliente nativo oferece para TLS mútuo.
        pfx: material,
        passphrase: senha,
        agent: despachante,
        // O teto vai TAMBÉM ao transporte, e não só ao relógio do ato: é o par de garantias que
        // faltava ao adaptador de e-mail, onde o limite existia no fonte e não alcançava o socket. O
        // relógio acima cobre o que este não cobre (resolução de nome pendurada); este cobre o
        // socket ocioso mesmo que o relógio venha a ser adiado por um laço de eventos ocupado.
        timeout: TETO_DO_APERTO_DE_MAO_MS,
      });
    } catch {
      // A FALHA NÃO É LIDA — nem aqui, nem em lugar nenhum deste arquivo. O que se sabe é
      // estrutural e basta: a requisição não chegou a existir, logo nada foi apresentado e nada foi
      // tentado. Repassá-la traria `mac verify failure` / `not enough data` para dentro do desfecho,
      // que é o oposto do que a ADR-0001 governa; deixá-la subir rejeitaria a promessa, que é o
      // oposto do que a porta promete. O desfecho sai pelo MESMO ponto único, de modo que o
      // temporizador e o despachante são liberados aqui como em qualquer outro caminho.
      decidir('NAO_INICIADO');
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

    requisicao.on('timeout', () => decidir('TEMPO_ESGOTADO'));

    requisicao.on('response', (resposta) => {
      // O CÓDIGO NÃO É LIDO, de propósito — ver o cabeçalho. A resposta é descartada sem consumo:
      // com `HEAD` não há corpo, e o que interessa já aconteceu.
      resposta.destroy();
      decidir('ACEITE');
    });

    requisicao.on('error', () => decidir(ligou ? 'RECUSA_PELO_PAR' : 'INDISPONIVEL'));

    // Sem `end()`, o cliente nativo não conclui o pedido e o par nunca responde. Nenhum corpo é
    // escrito antes dele: o que sai é a linha de pedido e o cabeçalho `Host`, e nada mais.
    requisicao.end();
  });
}

/**
 * Cria o adaptador de produção da porta de identidade sobre o cliente nativo.
 *
 * **Recusa a construção** com endereço que não serve — ver {@link resolverDestino}. O destino é
 * resolvido **uma vez**, aqui, e não a cada verificação: é o que impede que uma alteração do
 * ambiente em execução mude o destino de um processo já de pé.
 *
 * DÉBITO COM GATILHO — D36 · F4/T10 · registrado 2026-08-15
 * O QUÊ: a sonda de identidade é aperto de mão mútuo, e não obtenção de credencial de acesso —
 *        ela não exercita `client_id` nem `scope`, que esta fatia não modela.
 * QUANDO FECHA: a fatia (ii) (`emissao-e-conciliacao`), ao trazer `client_id` e `scope` para o
 *        envelope cifrado. A sonda sobe para o `client_credentials` do oráculo e passa a responder
 *        a pergunta inteira; o `detalhe` do desfecho positivo perde a ressalva de alcance.
 * POR QUE NÃO AGORA: as credenciais de habilitação são dependência declarada da fatia (ii)
 *        (PRD §9). Modelá-las aqui traria a fatia seguinte para dentro desta.
 * ÍNDICE: docs/specs/features/fundacao-bancaria/v1/_run/run-report.md §2, D36
 */
export function criarAdaptadorSicoob(
  config: ConfiguracaoDoProvedorBancario,
): PortaDeIdentidadeBancaria {
  const destino = resolverDestino(config.enderecoDoProvedor);

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
  };
}
