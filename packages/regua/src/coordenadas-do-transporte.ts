/**
 * As coordenadas do transporte de e-mail — a parte **pura** do adaptador de produção.
 *
 * ===========================================================================
 * POR QUE ISTO É UM MÓDULO PRÓPRIO: a opção que NÃO alcança o transporte
 * ===========================================================================
 *
 * A forma óbvia — `createTransport({ url, connectionTimeout, greetingTimeout, socketTimeout })` —
 * **descarta em silêncio** tudo que viaja ao lado da chave `url`, e o adaptador viveu assim até o
 * Gate 2 medir: em `lib/nodemailer.js:32-37`, havendo `transporter.url` a biblioteca faz
 * `options = shared.parseConnectionUrl(url)` e **substitui integralmente** o objeto do chamador.
 * Nesta árvore, o transporte nascia com `secure`, `port`, `host` e `auth` — e nada mais. Os limites
 * efetivos eram os padrões da biblioteca (`lib/smtp-connection/index.js:14-16`): conexão **120 s**,
 * saudação **30 s** e socket **600 s**, contra os 10 s / 10 s / 20 s declarados no fonte. Um
 * servidor que aceitasse a conexão TCP e não respondesse seguraria **cada** mensagem por até dez
 * minutos; como o laço da régua é sequencial, o job ficaria preso por N × 10 min, atravessando a
 * janela de horário da imobiliária e o encerramento gracioso do worker.
 *
 * A chave `url`, portanto, não existe mais: esta função resolve o destino e devolve o objeto de
 * opções **inteiro**. Sem ela, `createTransport` cai no ramo `else { options = transporter }` e
 * entrega o objeto do chamador ao `SMTPTransport`, que faz `this.options = shared.assign(false,
 * options)` e o repassa ao `SMTPConnection` — **sem filtro em nenhum ponto**. É por isso que cada
 * uma das sete chaves chega a quem a lê: `host`, `port` e `secure` no construtor do `SMTPConnection`
 * (`this.port = Number(this.options.port) || …`), `auth` no `SMTPTransport`
 * (`if (this.options.auth) …`) e os três limites no estabelecimento da conexão. Nenhuma chave de
 * despacho (`pool`, `sendmail`, `streamTransport`, `jsonTransport`, `SES`, `service`) é passada, de
 * modo que o `createTransport` só pode escolher o `SMTPTransport`.
 *
 * **Ele é um módulo separado, e não uma função privada do adaptador, por PROVABILIDADE.** Pela
 * CA-17, o adaptador de produção é o único módulo do produto que arquivo de teste nenhum pode
 * nomear — a barreira de `barreira-de-envio.spec.ts` afirma isso por igualdade sobre a árvore
 * inteira. A contrapartida honesta desse desenho é que o defeito acima **não tinha como ser
 * provado**: o critério passou por leitura de fonte, não por efeito. Extraída a parte pura, a
 * verificação exercita o objeto de opções sem nomear o adaptador nem construir transporte algum, e
 * a igualdade contra as constantes nomeadas reprova se um limite deixar de chegar.
 *
 * ===========================================================================
 * A RECUSA É POR FORMA, e não por presença — a cadeia não-vazia que não serve
 * ===========================================================================
 *
 * A barreira anterior recusava a `SMTP_URL` **ausente ou vazia**, e parava aí. O caminho seguinte
 * (`parseConnectionUrl` sobre o `url.parse` **legado**) é tolerante e nunca levanta: medido,
 * `localhost:2525` produzia `host = '2525'` sem porta; `nonsense` e um valor com as aspas retidas
 * pelo `EnvironmentFile` produziam `host` indefinido — e o `SMTPConnection` resolvia então
 * **`localhost:587`**. Ou seja: um erro de digitação no `EnvironmentFile` não derrubava a partida;
 * o processo subia e cada aviso era tentado contra o próprio host, virando `FALHOU` com
 * `ECONNREFUSED` (que não aponta para a causa) ou saindo por um relay que ninguém configurou.
 * **É o desfecho exato que a barreira existe para não ter, alcançado por um caminho que ela não
 * fechava.**
 *
 * Aqui a resolução é `new URL`, que **levanta** para tudo que não é URL absoluta, mais dois
 * predicados que esgotam o que o `URL` aceita e não serve: esquema fora de `{smtp:, smtps:}` e
 * `hostname` vazio. Depois deles, as três chaves do destino são **escritas** por esta função —
 * nunca omissões que o `SMTPConnection` completaria com `localhost` e 587.
 *
 * ===========================================================================
 * A RECUSA NOMEIA A VARIÁVEL, NUNCA O VALOR — e o erro nativo VAZA o valor
 * ===========================================================================
 *
 * A `SMTP_URL` carrega usuário e senha. O `TypeError` que o `new URL` levanta no Node 24 traz a
 * cadeia recusada na propriedade **`input`**, de modo que deixá-lo subir cru reabriria exatamente o
 * vazamento que o adaptador fecha. Ele é capturado e **substituído** — nunca encadeado como `cause`,
 * que o carregaria junto para quem imprimisse o erro.
 */

/**
 * Quanto se espera pelo **estabelecimento** da conexão, em milissegundos.
 *
 * Sem teto, uma conexão pendurada seguraria o job até o encerramento gracioso desistir — e o
 * encerramento gracioso é justamente o que não pode ser encurtado.
 */
export const LIMITE_DE_CONEXAO_MS = 10_000;

/**
 * Quanto se espera pelo **envio**, uma vez a conexão de pé, em milissegundos.
 *
 * É maior que o da conexão porque abrange a transferência da mensagem, e não apenas o aperto de mão.
 */
export const LIMITE_DE_ENVIO_MS = 20_000;

/** O nome da variável que declara o transporte — o que a recusa nomeia, no lugar do valor. */
export const VARIAVEL_DO_TRANSPORTE = 'SMTP_URL';

/**
 * O que a recusa por **forma** diz, com o nome da variável acrescentado ao fim.
 *
 * Ele é distinto do motivo da variável **não declarada**, e a distinção é conteúdo: aqui a variável
 * existe e não serve, e um motivo que dissesse "não declarada" descreveria o eixo errado — foi o
 * achado `BAIXO-002` do Gate 1 sobre a mensagem irmã. O que os dois compartilham é o que importa
 * para o critério da credencial: publicam o **nome da variável**, jamais o valor.
 */
// D25 (F3/T6) fechado — a ausência de `export` é a decisão, e ela converte em IMPOSSIBILIDADE
// ESTRUTURAL o que a `DECISÃO FECHADA` de `test/coordenadas-do-transporte.spec.ts` só proibia em
// prosa: que o oráculo do texto publicado venha do módulo sob prova. Enquanto a constante era
// exportada, a porta que aquele marcador fecha continuava aberta no nível da linguagem — bastava um
// import para a igualdade voltar a mover as duas pontas juntas, que é o defeito que três mutantes
// medidos atravessavam em 19/19 verde. Ela nunca teve consumidor externo depois da rodada 7.
const MOTIVO_DE_TRANSPORTE_INUTILIZAVEL =
  'o adaptador de e-mail não é construído com esta variável em forma que não serve de transporte';

/** Os dois esquemas que o transporte de e-mail aceita — a lista fechada da recusa por forma. */
const ESQUEMA_SIMPLES = 'smtp:';
const ESQUEMA_SOBRE_TLS = 'smtps:';

/**
 * As portas assumidas quando a URL não declara uma.
 *
 * Elas são **escritas** no objeto de opções em vez de deixadas em aberto, e a diferença não é
 * estética: uma `port` ausente faz o `SMTPConnection` escolher sozinho, e é justamente esse
 * preenchimento implícito que transformava uma `SMTP_URL` malformada num envio contra o host local.
 * O par 465/587 é o mesmo da biblioteca — o que muda é quem o decide, e onde isso se lê.
 */
const PORTA_SOBRE_TLS = 465;
const PORTA_DE_SUBMISSAO = 587;

/**
 * A credencial do transporte, com as chaves da **biblioteca**.
 *
 * `user` e `pass` são nomes de fronteira externa — o que o `nodemailer` lê —, e por isso escapam da
 * nomenclatura em português do resto do pacote, como já escapam `connectionTimeout` e `socketTimeout`.
 */
// Privada pela mesma razão do `MOTIVO_…` acima (D25). Ela continua alcançável de fora por
// `CoordenadasDoTransporte['auth']`, que é a forma correta — o consumidor recebe o tipo pelo objeto
// que o contém, sem que o módulo publique uma segunda porta de entrada para o mesmo dado.
interface CredencialDoTransporte {
  readonly user: string;
  readonly pass: string;
}

/**
 * O objeto de opções **completo** entregue ao `createTransport` — nada é acrescentado depois dele.
 *
 * Ele é o contrato desta função com o adaptador: o que estiver aqui chega ao transporte, e o que
 * não estiver aqui não existe. A ausência de uma chave `url` é a decisão, e é a razão de o objeto
 * inteiro sobreviver ao `createTransport` — ver o cabeçalho.
 */
export interface CoordenadasDoTransporte {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth?: CredencialDoTransporte;
  readonly connectionTimeout: number;
  readonly greetingTimeout: number;
  readonly socketTimeout: number;
}

/** A recusa por forma — nomeia a variável e encerra a construção. */
function recusarPorForma(): never {
  throw new Error(`${MOTIVO_DE_TRANSPORTE_INUTILIZAVEL}: ${VARIAVEL_DO_TRANSPORTE}`);
}

/**
 * Resolve a cadeia como URL, **sem deixar o erro nativo subir** — ver o cabeçalho.
 *
 * A decodificação da credencial entra no mesmo `try` de propósito: `decodeURIComponent` levanta
 * `URIError` para escapada malformada, e uma recusa que vazasse por ali nomearia o valor.
 */
function resolverEndereco(urlDoTransporte: string): {
  readonly protocolo: string;
  readonly host: string;
  readonly porta: string;
  readonly credencial: CredencialDoTransporte | undefined;
} {
  try {
    const endereco = new URL(urlDoTransporte);
    const usuario = decodeURIComponent(endereco.username);
    const senha = decodeURIComponent(endereco.password);

    return {
      protocolo: endereco.protocol,
      host: endereco.hostname,
      porta: endereco.port,
      // A credencial é opcional: um relay interno sem autenticação é legítimo, e declarar
      // `auth: { user: '', pass: '' }` faria o `SMTPTransport` tentar autenticar com vazio.
      credencial: usuario === '' && senha === '' ? undefined : { user: usuario, pass: senha },
    };
  } catch {
    return recusarPorForma();
  }
}

/**
 * As coordenadas do transporte declarado, com os três limites — o objeto que vai ao `createTransport`.
 *
 * **Recusa** a cadeia vazia, a que não é URL absoluta, a de esquema alheio ao e-mail e a que não
 * nomeia servidor. A recusa é `Error` com o nome da variável, e o processo não sobe — a barreira
 * falha fechado, que é o modo certo para uma porta cujo erro alcança a caixa de uma pessoa real.
 */
export function coordenadasDoTransporte(urlDoTransporte: string): CoordenadasDoTransporte {
  const endereco = resolverEndereco(urlDoTransporte);

  if (endereco.protocolo !== ESQUEMA_SIMPLES && endereco.protocolo !== ESQUEMA_SOBRE_TLS) {
    recusarPorForma();
  }

  if (endereco.host === '') {
    recusarPorForma();
  }

  const sobreTls = endereco.protocolo === ESQUEMA_SOBRE_TLS;

  return {
    host: endereco.host,
    port:
      endereco.porta === ''
        ? sobreTls
          ? PORTA_SOBRE_TLS
          : PORTA_DE_SUBMISSAO
        : Number(endereco.porta),
    secure: sobreTls,
    ...(endereco.credencial === undefined ? {} : { auth: endereco.credencial }),
    connectionTimeout: LIMITE_DE_CONEXAO_MS,
    // O aperto de mão tem teto próprio: um servidor que aceita a conexão TCP e nunca cumprimenta
    // ficaria pendurado até o limite de envio, que é o dobro. É o footgun conhecido da biblioteca.
    greetingTimeout: LIMITE_DE_CONEXAO_MS,
    socketTimeout: LIMITE_DE_ENVIO_MS,
  };
}
