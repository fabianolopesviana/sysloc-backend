/**
 * A composição da **mensagem de confirmação de endereço de e-mail** do locatário — pura, e sem
 * conhecer processo algum.
 *
 * ===========================================================================
 * A base do link chega POR PARÂMETRO — o domínio não lê ambiente (ADR-0025)
 * ===========================================================================
 *
 * `urlBase` é argumento, e não `process.env.URL_BASE_DA_CONFIRMACAO` lido aqui dentro. A diferença
 * não é estilística: uma leitura de ambiente neste módulo daria à mesma configuração **duas** fontes
 * — a que a partida do processo confere e a que a composição consulta —, e a segunda escaparia da
 * conferência de partida. Quem lê o ambiente é `lerAmbiente`, no ponto de entrada; quem escolhe o
 * que passar é a composição raiz. É a mesma disciplina que faz `criarAdaptadorSmtp` receber
 * `urlDoTransporte` em vez de lê-la.
 *
 * A consequência prática é que esta função é exercitável sem processo, sem rede e sem ambiente:
 * trocar a base troca o link, e nada mais.
 *
 * ===========================================================================
 * O segredo vai no FRAGMENTO do endereço, e a escolha é conteúdo
 * ===========================================================================
 *
 * O link é `<base>/confirmar-email#<segredo>`, e o `#` é deliberado. O fragmento **não é
 * transmitido ao servidor**: ele não entra na trilha do servidor de borda que a F7 introduz, não
 * viaja no cabeçalho `Referer` para terceiros e não aparece no registro de acesso. A alternativa
 * idiomática — `?segredo=…` na cadeia de consulta, que é o que o sistema antigo fazia
 * (`/validacao-email?locatario=X&token=…`) — foi descartada exatamente por isso, e o argumento não é
 * novo nesta base: `packages/contracts/src/confirmacao-de-email.ts` já o registra ao explicar por que
 * o segredo viaja no **corpo** da rota pública — *"caminho e consulta entram na trilha do servidor de
 * borda e no histórico do navegador, e um segredo de uso único que vaza para o registro deixa de ser
 * de uso único"*. O que vale para a rota vale para o link que a alimenta.
 *
 * ⚠️ **A página que recebe este link NÃO existe neste repositório.** Ela é da **F6**, vive fora
 * daqui, e o que esta entrega lhe deve é o registro explícito no handoff: quem a implementar lê o
 * segredo de `location.hash` e o apresenta no **corpo** de `POST /v1/confirmacoes-de-email`.
 *
 * ===========================================================================
 * O texto é acentuado — e isso NÃO contradiz o aviso de cobrança
 * ===========================================================================
 *
 * `packages/regua/src/mensagem.ts` compõe sem acentuação, e o cabeçalho dele diz por quê: é o que o
 * oráculo mediu no sistema antigo, e é o que o locatário reconhece na caixa dele desde antes desta
 * migração. Aqui **não há oráculo** — a confirmação do produto novo fecha um defeito do legado em vez
 * de portá-lo (o token de lá não era aleatório nem guardado como derivado) —, de modo que a
 * acentuação correta é a escolha, e não uma divergência a explicar. Não "uniformize" um dos dois com
 * o outro: a diferença tem razão registrada dos dois lados.
 *
 * ===========================================================================
 * O prazo NÃO é escrito por extenso aqui
 * ===========================================================================
 *
 * O texto diz que o link é de uso único e tem prazo, e **não** repete o número de horas. O prazo é
 * declarado uma vez, em `packages/db/src/portador-de-confirmacao.ts` (`PRAZO_DE_VALIDADE`), e é o
 * banco que o aplica; escrevê-lo também aqui criaria uma segunda declaração do mesmo fato, livre para
 * divergir na primeira emenda daquela — e a divergência apareceria como uma mensagem que promete um
 * prazo que o portador não tem. Esta assinatura não recebe o instante de expiração, e a ausência é o
 * mecanismo: não há como escrever o número certo sem recebê-lo.
 */

// DÉBITO COM GATILHO — D12 · F3/T10 · registrado 2026-08-13
// O QUÊ: `MensagemDeEmail { assunto, corpo }` e a porta de envio são a SEGUNDA declaração
//        estrutural do mesmo fato — a primeira é `MensagemDeAviso` e `PortaDeEnvioDeEmail`,
//        em `packages/regua/src/`. Elas são estruturalmente compatíveis, e é por isso que o
//        adaptador SMTP satisfaz as duas sem uma linha de conversão.
// QUANDO FECHA: a TERCEIRA mensagem de e-mail do produto (a F4, com o boleto emitido) — ali
//        `MensagemDeEmail` e `PortaDeEnvioDeEmail` sobem para `@sysloc/shared` e os dois
//        pacotes de domínio passam a importá-las.
// POR QUE NÃO AGORA: promover exigiria editar `@sysloc/regua`, e o PRD põe fora de escopo
//        qualquer alteração no que a sub-fatia irmã entregou e provou.
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D12
/**
 * Uma mensagem pronta para ser entregue — assunto e corpo, e nada mais.
 *
 * Destinatário **não** entra: ele é do envio, não da mensagem. É a mesma forma de `MensagemDeAviso`,
 * e a coincidência é o débito acima — não uma conversão a escrever.
 */
export interface MensagemDeEmail {
  /** A linha de assunto. Nunca carrega segredo, nome nem endereço — ver {@link ASSUNTO}. */
  readonly assunto: string;
  /** O corpo em texto puro, com quebras de linha reais. */
  readonly corpo: string;
}

/** O que a composição precisa saber para escrever a mensagem. */
export interface DadosDaConfirmacao {
  /** Como o locatário se chama no cadastro — entra na saudação, e em lugar nenhum além dela. */
  readonly nome: string;
  /** O segredo em claro do portador recém-emitido. Aparece **uma vez**, dentro do link. */
  readonly segredo: string;
  /** O endereço público do aplicativo, sem o caminho da página. Vem do ambiente do processo. */
  readonly urlBase: string;
}

/**
 * O assunto, **fixo e sem dado nenhum interpolado**.
 *
 * Assunto viaja em claro por toda a cadeia de entrega e aparece na lista da caixa de quem recebe,
 * inclusive em pré-visualização de tela bloqueada. Ele não carrega o segredo — que abriria a
 * confirmação para quem apenas espia a lista — e não carrega o nome nem o endereço do titular. É
 * constante nomeada, e não literal no ponto da composição, porque é conferido por asserção.
 */
const ASSUNTO = 'Confirmação do seu endereço de e-mail';

/** O caminho da página que recebe o link. Ela é da **F6** e não existe neste repositório. */
const CAMINHO_DA_PAGINA = '/confirmar-email';

/**
 * As barras finais da base recebida — removidas antes de compor o endereço.
 *
 * `https://app.exemplo/` e `https://app.exemplo` descrevem o mesmo endereço, e um operador digita as
 * duas formas no arquivo de ambiente. Sem esta normalização a primeira produziria `//confirmar-email`,
 * que alguns servidores tratam como outro caminho — o link chegaria quebrado à caixa do locatário, e
 * nada no processo acusaria.
 */
const BARRAS_FINAIS = /\/+$/;

/**
 * As duas primeiras linhas, e a linha em branco que as separa da saudação.
 *
 * O aviso de que a conta não é monitorada existe pela mesma razão do aviso de cobrança: a caixa que
 * assina estas mensagens não tem quem leia resposta, e quem responde a uma delas fica sem retorno
 * sem saber por quê.
 */
const ABERTURA: readonly string[] = [
  'Mensagem automática do Sistema de Locação de Imóveis.',
  'NÃO RESPONDA ESSA MENSAGEM! CONTA DE E-MAIL NÃO MONITORADA.',
  '',
];

/** O fecho, comum a toda mensagem desta composição. */
const FECHO: readonly string[] = [
  'Se você não reconhece este cadastro, ignore esta mensagem.',
  '',
  'Atenciosamente,',
  'Equipe de Cadastro',
];

/**
 * Compõe a mensagem de confirmação do endereço de e-mail do locatário.
 *
 * Função **pura**: mesma entrada, mesma saída, sem relógio, sem ambiente e sem consulta. O link é
 * montado a partir da base recebida — ver o cabeçalho para por que o segredo vai no fragmento.
 *
 * ⚠️ **Nada é escapado aqui, e não precisa ser**: o corpo é entregue como texto puro pelo adaptador
 * (`text`, nunca `html`), e em texto puro `<script>` é a cadeia `<script>`. O nome do locatário entra
 * como veio do cadastro. **Se algum dia este corpo virar HTML, este é o ponto em que a escapada passa
 * a ser obrigatória** — é o mesmo aviso, com a mesma condição, do cabeçalho de
 * `packages/regua/src/mensagem.ts`.
 */
export function comporMensagemDeConfirmacao(dados: DadosDaConfirmacao): MensagemDeEmail {
  const link = `${dados.urlBase.replace(BARRAS_FINAIS, '')}${CAMINHO_DA_PAGINA}#${dados.segredo}`;

  return {
    assunto: ASSUNTO,
    corpo: [
      ...ABERTURA,
      `Prezado(a) ${dados.nome},`,
      'Recebemos este endereço de e-mail no seu cadastro. Para confirmá-lo, abra o endereço abaixo:',
      link,
      'O link é de uso único e tem prazo de validade. Depois de usá-lo, nada mais precisa ser feito.',
      ...FECHO,
    ].join('\n'),
  };
}
