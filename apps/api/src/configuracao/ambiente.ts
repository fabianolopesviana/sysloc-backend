/**
 * Configuração do serviço de aplicação — leitura e validação das variáveis de ambiente.
 *
 * ---------------------------------------------------------------------------
 * Falhar na PARTIDA, e não no primeiro uso
 * ---------------------------------------------------------------------------
 *
 * A composição raiz chama {@link carregarAmbiente} antes de qualquer rota existir. Configuração
 * incompleta derruba o processo ali, com uma mensagem que **nomeia cada variável ausente** — e
 * não uma rodada de partida por variável faltante. Subir e quebrar no primeiro uso é exatamente
 * o comportamento que esta validação existe para impedir: o supervisor do sistema operacional
 * reporta um serviço `active` que responde erro em toda requisição, e o operador descobre o
 * motivo depurando, em vez de lendo o journal.
 *
 * ---------------------------------------------------------------------------
 * A fonte é PARÂMETRO, e a falha é EXCEÇÃO — não `process.exit`
 * ---------------------------------------------------------------------------
 *
 * A função é pura: recebe o registro de variáveis e devolve a configuração ou lança. Quem decide
 * abortar é o ponto de entrada (`main.ts`), que é quem tem o processo na mão. Abortar aqui dentro
 * tornaria a validação inverificável sem subprocesso — e é justamente ela que o critério de
 * aceitação CA-15 cobra.
 *
 * ---------------------------------------------------------------------------
 * Esquema e forma das cadeias de conexão
 * ---------------------------------------------------------------------------
 *
 * `DATABASE_URL` é exigida com o esquema `postgresql://`, e não `postgres://`. Os dois são
 * equivalentes para o driver, mas não para o resto do sistema: o leitor de credencial de
 * `deploy/scripts/instalacao/provisionar-base.sh` ancora em `^DATABASE_URL=postgresql://` e
 * **recusa** um arquivo escrito com o outro. Aceitar as duas grafias aqui deixaria de pé um
 * arquivo de ambiente que a aplicação lê e o provisionamento rejeita — divergência que já foi
 * registrada como débito (D7) e cujo endereço de reconciliação é esta task. A forma é
 * `postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO` — endereço de rede, e não socket de domínio
 * Unix: é a única que o provisionamento grava e a única que o `.env.example` documenta.
 *
 * Por isso o `URL.canParse` desta validação não é formalidade. O cliente que a aplicação usa
 * (`postgres.js`) constrói as opções de conexão com `new URL()` e só alcança socket de domínio
 * Unix pelo OBJETO de opções, nunca por cadeia de conexão — uma `DATABASE_URL` de socket que
 * passasse por aqui subiria o processo e quebraria na primeira consulta, que é exatamente o
 * comportamento que esta validação existe para impedir.
 */

import { accessSync, constants, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import {
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  NIVEIS_DE_LOG,
  type NivelDeLog,
} from '@sysloc/shared';
import { z } from 'zod';

/** Ambientes de execução aceitos em `NODE_ENV` — os mesmos que o `.env.example` documenta. */
const AMBIENTES = ['development', 'test', 'production'] as const;

/** Maior porta TCP existente. */
const MAIOR_PORTA = 65_535;

/**
 * Comprimento mínimo do segredo de assinatura de sessão.
 *
 * Trinta e dois caracteres é o tamanho que o próprio arcabouço de identidade gera quando sorteia um
 * segredo. Exigir o piso na partida é o que impede que um `EnvironmentFile` preenchido à mão com
 * meia dúzia de caracteres suba um serviço cujas sessões são assináveis por força bruta — e a
 * falha de partida é o único momento em que isso ainda é barato de descobrir.
 */
const COMPRIMENTO_MINIMO_DO_SEGREDO = 32;

/**
 * Comprimento **exato**, em bytes, da chave que cifra o segredo do certificado do provedor.
 *
 * É o que o AES-256-GCM exige, e por isso o piso e o teto são o mesmo número: uma chave de 31 ou de
 * 33 bytes não é "uma chave fraca", é uma chave que o algoritmo **não aceita**, e o processo que
 * subisse com ela falharia no primeiro registro — depois de o Admin ter entregado o material.
 *
 * ⚠️ **Ele é a segunda declaração executável deste número no monorepo**, e a duplicação é assumida
 * com rede: a primeira é `BYTES_DA_CHAVE`, privada de `packages/shared/src/segredo-operavel.ts`, que
 * é detalhe de construção da cifra e não sai do pacote por decisão registrada no índice dele. Se as
 * duas divergirem, quem recusa é a cifra — `exigirChaveDeCifra` levanta
 * `ErroDeChaveDeCifraInvalida` nas duas pontas, cifrando e decifrando —, de modo que o pior desfecho
 * da divergência é a partida aceitar uma chave que a primeira operação recusa **nomeadamente**, e
 * nunca um envelope gravado com chave de comprimento errado.
 */
const BYTES_DA_CHAVE_DE_CIFRA = 32;

/** A exigência que a recusa de partida publica — nomeia a variável e o tamanho, jamais o valor. */
const EXIGENCIA_DA_CHAVE_DE_CIFRA = `deve ser exatamente ${BYTES_DA_CHAVE_DE_CIFRA} bytes em base64`;

/**
 * A chave decodifica para **exatamente** 32 bytes, e o texto recebido é base64 canônico?
 *
 * As duas metades são uma conferência só, de propósito: `Buffer.from(valor, 'base64')` **ignora em
 * silêncio** todo caractere fora do alfabeto, de modo que uma chave copiada com um espaço no meio
 * decodificaria para outros bytes sem que nada acusasse — e o acervo cifrado com ela ficaria
 * ilegível no dia em que alguém "consertasse" o valor. A volta (`toString('base64')`) é o que torna
 * a decodificação **reversível**, e portanto o que faz o valor do arquivo de ambiente e a chave em
 * uso serem o mesmo fato. É o que `openssl rand -base64 32` produz, e é o que o `.env.example`
 * manda gerar.
 */
function ehChaveDeCifraAceitavel(valor: string): boolean {
  const bytes = Buffer.from(valor, 'base64');

  return bytes.length === BYTES_DA_CHAVE_DE_CIFRA && bytes.toString('base64') === valor;
}

/** A exigência que a recusa do diretório dos boletos publica — nomeia a forma, jamais o valor. */
const EXIGENCIA_DO_DIRETORIO_DOS_BOLETOS = 'deve ser o caminho absoluto de um diretório gravável';

/** A porta que o provedor exige do endereço de entrega — ver {@link ehEnderecoDeEntregaAceitavel}. */
const PORTA_EXIGIDA_PELO_PROVEDOR = '443';

/** O esquema que o provedor exige do endereço de entrega — cifrado, e nada mais. */
const ESQUEMA_EXIGIDO_PELO_PROVEDOR = 'https:';

const EXIGENCIA_DO_ENDERECO_DA_ENTREGA = `deve ser uma URL absoluta ${ESQUEMA_EXIGIDO_PELO_PROVEDOR}//, com servidor nomeado e na porta ${PORTA_EXIGIDA_PELO_PROVEDOR}`;

/**
 * O endereço da entrega satisfaz o que o **provedor** exige dele?
 *
 * DECISÃO FECHADA — W3 · conformidade com a documentação do provedor · 2026-08-22
 * O QUÊ: a partida confere a **forma** do endereço da entrega, e não apenas a presença dele.
 * POR QUÊ: a documentação oficial é literal — *"`url` — Deve ser https. Porta: 443"* —, e a
 *        conferência anterior era `z.string().min(1)`. Um `http://…`, uma porta `:8443` ou um caminho
 *        relativo subiam sem reclamação, e a falha aparecia **tarde**: no cadastro junto ao provedor,
 *        com a mensagem dele, ou — pior — o cadastro era aceito e o webhook **nunca validava**, que é
 *        indistinguível de indisponibilidade para quem olha a tela.
 * POR QUE ISTO FECHA A CLASSE: é a **única** barreira que existe. Diferente de
 *        `ENDERECO_DO_PROVEDOR_BANCARIO`, cujo endereço é recusado pela construção do adaptador, este
 *        valor não passa por nenhum outro ponto que o confira — ele é lido e enviado ao provedor.
 *        Conferir a forma aqui alcança as três maneiras de errar de uma vez (esquema, servidor,
 *        porta), e não apenas a medida.
 * REVERTER EXIGE: provar que o provedor passou a aceitar endereço fora desta forma — o que exige a
 *        documentação dele dizendo outra coisa, não a suposição de que a exigência afrouxou.
 *
 * É a mesma leitura do `DIRETORIO_DOS_BOLETOS` logo abaixo, e a assimetria que aquele docblock
 * descreve é a que se aplica aqui: **não há segundo lugar** onde o defeito seja pego.
 *
 * ⚠️ **A porta implícita conta.** `https://borda.exemplo.com.br/caminho` fala 443 sem escrevê-lo, e
 * `new URL` devolve `port === ''` nesse caso — recusar a forma implícita rejeitaria justamente o
 * endereço mais comum e mais correto.
 *
 * ⚠️ **A recusa nomeia a variável e a exigência, JAMAIS o valor.** É por isso que o `TypeError` do
 * `new URL` é capturado e descartado: ele carrega a cadeia recusada na propriedade `input`, e deixá-lo
 * escapar poria o endereço na mensagem de partida. Mesma disciplina de {@link ehDiretorioGravavel} e
 * o mesmo precedente de `resolverDestino`, no adaptador.
 */
const EXIGENCIA_DO_CONTATO_DA_ENTREGA =
  'deve ser um endereço de e-mail com parte local e domínio, sem espaços';

/**
 * O contato do cadastro da entrega tem forma de endereço de e-mail?
 *
 * DECISÃO FECHADA — W2 · conformidade com a documentação do provedor · 2026-08-22
 * O QUÊ: o processo exige um contato operacional para o cadastro da entrega, e confere a forma dele
 *        na partida.
 * POR QUÊ: a prosa oficial do provedor declara o contato **necessário** no cadastro — *"é necessário
 *        informar o código do movimento, o código do período do movimento **e o e-mail**"* —, e o
 *        produto não o enviava. Somado ao `numeroCliente` que ele enviava **e não existe** no
 *        contrato, o corpo tinha um campo a mais e um a menos: as duas causas de `406` no mesmo
 *        pedido. E é por este endereço que o provedor avisa quando **inativa** o webhook — sem ele, a
 *        inativação é silenciosa.
 * POR QUE DO PROCESSO, e não do cliente: as alternativas eram um contato da empresa já modelado (o
 *        produto não tem nenhum), configuração do processo, ou pedir ao Admin na tela. A última foi
 *        recusada porque a tela da ativação tem **um ato e nenhum campo**, por restrição declarada
 *        pelo usuário; a primeira, porque inventar um valor faria o produto cadastrar um contato que
 *        ninguém escolheu na conta do cliente.
 * REVERTER EXIGE: documentação do provedor declarando o contato dispensável — não a leitura do
 *        Swagger, que marca só o objeto `webhook` como obrigatório e por isso induziu ao erro.
 *
 * A conferência é **de forma, não de existência da caixa**: nada é enviado para validá-la, e não
 * poderia ser — a partida não fala com o mundo. O que ela fecha é o valor que **nunca** poderia ser
 * um endereço, que é o defeito barato de pegar aqui e caro de descobrir no cadastro real.
 *
 * ⚠️ A recusa nomeia a variável e a exigência, JAMAIS o valor — mesma disciplina de todas as demais.
 */
function ehContatoDeEntregaAceitavel(valor: string): boolean {
  const partes = valor.split('@');

  if (partes.length !== 2) {
    return false;
  }

  const [local = '', dominio = ''] = partes;

  // O domínio precisa de um ponto com rótulo dos dois lados: `a@b` é sintaticamente um endereço e
  // nunca é um contato real, e aceitá-lo faria a conferência passar exatamente onde ela deveria pegar.
  return (
    local !== '' &&
    dominio !== '' &&
    !SEPARADOR_EM_BRANCO.test(valor) &&
    DOMINIO_COM_ROTULO.test(dominio)
  );
}

/** Qualquer espaço em branco — nenhum endereço legítimo o contém. */
const SEPARADOR_EM_BRANCO = /\s/;

/** Um domínio com ao menos um ponto, e rótulo não vazio dos dois lados dele. */
const DOMINIO_COM_ROTULO = /^[^.\s@]+(?:\.[^.\s@]+)+$/;

function ehEnderecoDeEntregaAceitavel(valor: string): boolean {
  let endereco: URL;

  try {
    endereco = new URL(valor);
  } catch {
    // Caminho relativo, cadeia sem esquema, lixo — todos param aqui, e nada do valor viaja.
    return false;
  }

  return (
    endereco.protocol === ESQUEMA_EXIGIDO_PELO_PROVEDOR &&
    endereco.hostname !== '' &&
    // A vazia é a porta implícita do esquema, que para `https:` **é** a exigida.
    (endereco.port === '' || endereco.port === PORTA_EXIGIDA_PELO_PROVEDOR)
  );
}

/** O que separa uma origem da seguinte na variável — uma lista, e nunca um valor só. */
const SEPARADOR_DAS_ORIGENS_PUBLICAS = ',';

/** Os únicos esquemas que um navegador usa para falar com este serviço. */
const ESQUEMAS_DA_ORIGEM_PUBLICA: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Os caracteres que o arcabouço lê como **curinga** dentro de um padrão de origem confiável.
 *
 * Medido no pacote publicado (`dist/auth/trusted-origins.mjs`): `matchesOriginPattern` desvia para
 * `wildcardMatch` assim que `pattern.includes('*') || pattern.includes('?')` — em **qualquer**
 * posição do padrão —, e só cai na comparação literal `pattern === getOrigin(url)` quando nenhum
 * dos dois aparece. São, portanto, a lista completa do que transforma um valor conferido em padrão
 * interpretado; ver o marcador em {@link ehOrigemPublicaAceitavel}.
 */
const CURINGAS_DO_PADRAO_DE_ORIGEM: readonly string[] = ['*', '?'];

/**
 * A exigência que a recusa das origens públicas publica — nomeia a forma, jamais o valor.
 *
 * ⚠️ **O esquema é escrito por NOME (`http`, `https`), e não pela forma `http://`.** A escolha é
 * conteúdo, não estilo: a recusa afirma, por asserção, que a mensagem **não ecoa o valor recebido**,
 * e um valor curto e degenerado como `https://` — que é exatamente uma das formas que a conferência
 * existe para pegar — seria substring do próprio texto da exigência. A asserção de não-eco ficaria
 * impossível de satisfazer sem afrouxá-la, e afrouxá-la é o que abriria a porta para a mensagem
 * passar a carregar o valor. Mesma razão pela qual a lista degenerada é exercitada como `,,,`.
 */
const EXIGENCIA_DAS_ORIGENS_PUBLICAS =
  'deve ser uma lista de origens separadas por vírgula, cada uma absoluta de esquema http ou https, com servidor nomeado e sem caminho';

/**
 * Separa a lista de origens públicas, descartando espaço em volta e item vazio.
 *
 * ⚠️ **Ela é a MESMA função que confere e que transforma**, e a unicidade é conteúdo: se a
 * conferência separasse por um critério e a transformação por outro, o processo subiria tendo
 * validado um conjunto e entregado outro ao arcabouço — que é exatamente a divergência silenciosa
 * que este arquivo evita em todas as demais variáveis.
 *
 * Item vazio é **descartado**, não recusado: `a,,b` e `a, b` são o mesmo par de origens, e a linha
 * que um operador edita à mão costuma carregar espaço. O que a conferência recusa é a lista que
 * separa em **zero** itens — ver {@link saoOrigensPublicasAceitaveis}.
 */
function separarOrigensPublicas(valor: string): readonly string[] {
  return valor
    .split(SEPARADOR_DAS_ORIGENS_PUBLICAS)
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
}

/**
 * A cadeia é uma **origem** que o arcabouço poderia casar?
 *
 * ---------------------------------------------------------------------------
 * A conferência é de FORMA, e ela é a única barreira que existe
 * ---------------------------------------------------------------------------
 *
 * É a mesma leitura de {@link ehEnderecoDeEntregaAceitavel} e de {@link ehDiretorioGravavel}, e a
 * assimetria que aqueles docblocks descrevem é a que se aplica aqui: **não há segundo lugar** onde o
 * defeito seja pego. Medido no pacote publicado (`dist/auth/trusted-origins.mjs`): sem curinga, a
 * comparação é `pattern === getOrigin(url)`. Um valor com caminho, sem esquema ou com esquema
 * estranho **nunca** casa origem alguma, e o efeito é o serviço inteiro inacessível ao navegador,
 * entrada inclusive — literalmente o modo de falha que o `D23 · F1/T8` descrevia.
 *
 * Um esquema `z.string().min(1)` aceitaria `app.exemplo.com.br` e recusaria **100% do tráfego de
 * navegador** em produção, com o processo `active` no supervisor.
 *
 * A igualdade com `endereco.origin` é o que fecha as três formas de errar de uma vez: ela recusa o
 * caminho (`…/entrar`), a barra final, a consulta, a credencial embutida e o esquema que não produz
 * origem (`ftp:` devolve a cadeia `'null'`). Compará-la é mais forte que enumerar o que não pode
 * aparecer — **mas ela sozinha não basta**, e a afirmação de que *o que sobra é exatamente o que o
 * arcabouço vai comparar* só passa a ser verdadeira **depois** da recusa do curinga: `new URL`
 * aceita `*` como servidor (medido: `new URL('https://*').origin === 'https://*'`), de modo que
 * `https://*` satisfaz esquema, servidor nomeado **e** a própria igualdade — e é justamente aí que o
 * arcabouço deixa de comparar por igualdade e passa a **casar qualquer origem**. Ver o marcador
 * abaixo.
 *
 * ⚠️ **A recusa nomeia a variável e a exigência, JAMAIS o valor.** É por isso que o `TypeError` do
 * `new URL` é capturado e descartado: ele carrega a cadeia recusada na propriedade `input`. Mesma
 * disciplina de todas as demais conferências deste arquivo.
 */
function ehOrigemPublicaAceitavel(valor: string): boolean {
  // DECISÃO FECHADA — T7 / Gate 1 rodada 1 · 2026-08-26
  // O QUÊ: o valor que contém `*` ou `?` é recusado ANTES de qualquer outra conferência, em vez de
  //        se confiar na forma de URL para pegá-lo.
  // POR QUÊ: `new URL` aceita os dois como servidor — medido, `new URL('https://*').origin` devolve
  //          `'https://*'` —, de modo que `https://*` e `https://*.exemplo.com.br` satisfaziam
  //          esquema, servidor nomeado E a igualdade com `endereco.origin`. Eles entravam inteiros
  //          no conjunto confiável, e ali `matchesOriginPattern` os trata como PADRÃO: a conferência
  //          de origem passava a aceitar qualquer origem, com o processo `active` no supervisor e
  //          nada acusando — perda total e silenciosa da barreira que esta variável existe para
  //          instalar. A recusa é do CONJUNTO DE CARACTERES que produz interpretação, e não do valor
  //          `https://*`: é o único gatilho do desvio, e por isso todo valor que sobrevive a esta
  //          linha cai obrigatoriamente na comparação literal. O `?` já era recusado por ACIDENTE (o
  //          `origin` descarta a consulta, quebrando a igualdade) e passa a ser recusado por decisão
  //          — apoiar metade da classe num efeito colateral de outra conferência é deixá-la aberta
  //          na primeira vez que a outra mudar.
  // REVERTER EXIGE: provar, no pacote publicado, que `matchesOriginPattern` NÃO desvia mais para
  //                 `wildcardMatch` (hoje o desvio é `pattern.includes('*') || pattern.includes('?')`
  //                 em `dist/auth/trusted-origins.mjs`), ou decisão expressa do usuário de que este
  //                 produto passa a aceitar origem confiável declarada como PADRÃO com curinga — que
  //                 é escolha de segurança do usuário, não de forma de validação.
  if (CURINGAS_DO_PADRAO_DE_ORIGEM.some((curinga) => valor.includes(curinga))) {
    return false;
  }

  let endereco: URL;

  try {
    endereco = new URL(valor);
  } catch {
    // Cadeia sem esquema, servidor ausente, lixo — todos param aqui, e nada do valor viaja.
    return false;
  }

  return (
    ESQUEMAS_DA_ORIGEM_PUBLICA.has(endereco.protocol) &&
    endereco.hostname !== '' &&
    // Origem é esquema + servidor (+ porta) e mais NADA: qualquer resto faz o padrão nunca casar.
    valor === endereco.origin
  );
}

/**
 * A variável declara ao menos uma origem, e **todas** elas têm forma de origem?
 *
 * A lista que separa em zero itens (`,`, `  `, cadeia só de vírgulas) é recusada aqui, e não em
 * {@link selecionar}: aquela normalização trata **cadeia em branco** como ausente, e `,` não é
 * branco — sem esta linha o processo subiria com o conjunto vazio, isto é, com a origem confiável de
 * volta ao endereço de escuta e sem que nada acusasse. É o estado exato que o `D23` descrevia.
 */
function saoOrigensPublicasAceitaveis(valor: string): boolean {
  const origens = separarOrigensPublicas(valor);

  return origens.length > 0 && origens.every(ehOrigemPublicaAceitavel);
}

/**
 * O caminho é absoluto **e** aponta para um diretório em que este processo consegue escrever?
 *
 * ---------------------------------------------------------------------------
 * As duas metades são UMA conferência só, de propósito
 * ---------------------------------------------------------------------------
 *
 * É o mesmo desenho, e a mesma razão, de {@link ehChaveDeCifraAceitavel}: separá-las produziria duas
 * recusas para o mesmo defeito operacional — *o produto não tem onde gravar boleto* — e a mensagem
 * nomearia a variável duas vezes. O que o operador precisa saber é o que a exigência acima já diz.
 *
 * O caminho **relativo** é recusado antes de o disco ser tocado, e a ordem é conteúdo: um caminho
 * relativo é resolvido contra o diretório de trabalho do processo, de modo que ele passaria a
 * conferência de escrita **e** apontaria para lugares diferentes conforme quem iniciasse o serviço.
 *
 * ---------------------------------------------------------------------------
 * ESTA é a única conferência da partida que consulta o sistema de arquivos
 * ---------------------------------------------------------------------------
 *
 * A leitura é de **permissão**, não de conteúdo: nada é criado, nada é escrito e nada é listado. Ela
 * existe porque o modo de falha que ela fecha é assimétrico e caro — sem ela o processo sobe, o
 * provedor **emite o título**, e a gravação dos bytes falha depois: fica um boleto vivo no banco cujo
 * documento o produto não tem, que é justamente o estado que a CA-08 existe para rebuscar. Recusar na
 * partida põe o custo no operador, na instalação, onde ele é barato.
 *
 * Quem confere o **dono** e o **modo** do diretório na máquina que atende a operação é
 * `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`, e não há duplicação entre os
 * dois: lá se mede a higiene do host, aqui a capacidade **deste** processo de escrever.
 */
function ehDiretorioGravavel(valor: string): boolean {
  if (!isAbsolute(valor)) {
    return false;
  }

  try {
    // As duas perguntas na ordem em que o defeito aparece: *é diretório?* antes de *dá para
    // escrever?*. Um arquivo comum gravável satisfaria a segunda sozinha, e o primeiro boleto
    // falharia ao tentar criar o intermediário dentro dele.
    if (!statSync(valor).isDirectory()) {
      return false;
    }

    accessSync(valor, constants.W_OK);
  } catch {
    // A causa concreta — ausente, sem permissão, caminho quebrado — **não** viaja: a mensagem de
    // partida nomeia a variável e a exigência, e nunca o valor recebido nem o texto do sistema
    // operacional, que carregaria o caminho dentro dele.
    return false;
  }

  return true;
}

/**
 * Endereço em que o serviço escuta.
 *
 * Somente o endereço de retorno: este servidor é compartilhado com o ambiente que ainda atende a
 * operação, e escutar em toda interface publicaria o backend novo na internet antes da virada.
 * A publicação externa é da fatia de virada, e passa por servidor de borda — que alcança este
 * endereço sem que ele deixe de ser local.
 *
 * Mora aqui, e não no ponto de entrada, desde a T8: ele deixou de ter um consumidor só. Além do
 * `listen`, é a partir deste endereço que se compõe o endereço base entregue ao arcabouço de
 * identidade — que é o que ele usa para reconhecer a origem confiável das requisições com cookie.
 * Duas cópias do literal poderiam divergir, e a divergência não quebra a partida: ela recusa,
 * silenciosamente, toda requisição autenticada.
 */
export const ENDERECO_DE_ESCUTA = '127.0.0.1';

/**
 * Prefixo de versão de toda rota do produto (§15.1 da tech spec da fatia).
 *
 * Sem barra inicial porque é assim que a montagem da aplicação o consome. Quem precisa dele como
 * caminho o compõe — ver `autenticacao.module.ts`.
 */
export const PREFIXO_DE_VERSAO = 'v1';

/**
 * O esquema é a fonte única do que o processo exige. `VARIAVEIS_EXIGIDAS` deriva dele, de modo
 * que acrescentar variável aqui já a torna exigida, documentada na mensagem de falha e coberta
 * pela verificação — sem uma segunda lista para manter em dia.
 */
const ESQUEMA = z.object({
  NODE_ENV: z.enum(AMBIENTES, {
    error: `deve ser um de: ${AMBIENTES.join(', ')}`,
  }),
  PORT: z.coerce
    .number({ error: 'deve ser um número inteiro' })
    .int('deve ser um número inteiro')
    .min(1, `deve estar entre 1 e ${MAIOR_PORTA}`)
    .max(MAIOR_PORTA, `deve estar entre 1 e ${MAIOR_PORTA}`),
  LOG_LEVEL: z.enum(NIVEIS_DE_LOG, {
    error: `deve ser um de: ${NIVEIS_DE_LOG.join(', ')}`,
  }),
  DATABASE_URL: z
    .string()
    .regex(/^postgresql:\/\//, 'deve começar com postgresql://')
    .refine(URL.canParse, 'não é uma cadeia de conexão interpretável'),
  // A regra e o texto da exigência vêm do pacote compartilhado, e não de uma cópia local: o
  // processador de trabalho valida a MESMA variável, do MESMO arquivo de ambiente, e duas
  // definições independentes divergiriam em silêncio até um `EnvironmentFile` subir um processo
  // e recusar o outro.
  REDIS_URL: z.string().refine(ehCadeiaDeFilaValida, EXIGENCIA_DA_CADEIA_DE_FILA),
  // O nome é o que o arcabouço de identidade lê por convenção própria, e o `.env.example` já o
  // documenta com essa justificativa — uma segunda grafia para a mesma coisa só criaria dois
  // arquivos de ambiente incompatíveis. A mensagem de falha nomeia a variável e o piso exigido, e
  // NUNCA o valor recebido: ela vai para o journal, e este valor assina toda sessão em curso.
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      COMPRIMENTO_MINIMO_DO_SEGREDO,
      `deve ter ao menos ${COMPRIMENTO_MINIMO_DO_SEGREDO} caracteres`,
    ),
  // As DUAS variáveis do transporte de e-mail entram na T10 da fatia `regua-de-cobranca`, e não por
  // simetria com o processador de trabalho: o **disparo manual** envia de dentro deste processo, que
  // passa a ser o SEGUNDO capaz de alcançar a caixa de uma pessoa real. Aqui o modo perigoso é o
  // inverso do habitual — *"subir mesmo assim"* constrói um transporte que aponta para o `localhost`
  // que a biblioteca assume por omissão —, e por isso a partida é **recusada** nomeando a variável,
  // em vez de o processo subir e falhar no primeiro disparo. A conferência é a MESMA que
  // `apps/worker/src/main.ts` faz, e o par de casos que a prova nos dois processos é `CT-625`/`CT-639`.
  //
  // A **forma** da cadeia não é conferida aqui, e a ausência é decisão: quem recusa a `SMTP_URL` que
  // não serve como endereço é `coordenadasDoTransporte` (em `@sysloc/regua`), num lugar só. Uma
  // segunda conferência de forma escrita nesta composição ficaria livre para divergir da do outro
  // processo — e é justamente a divergência entre dois pontos que decidem o mesmo fato que esta fatia
  // existe para não ter.
  //
  // O piso de um caractere não é redundante com {@link selecionar}: ele é a barreira que sobrevive a
  // qualquer mudança futura naquela normalização, e `SMTP_URL` é a variável em que o valor vazio
  // atravessando custa uma mensagem entregue no endereço errado.
  SMTP_URL: z.string().min(1, 'deve ser declarada'),
  EMAIL_REMETENTE: z.string().min(1, 'deve ser declarada'),
  // O endereço público do aplicativo, sobre o qual o link de confirmação é composto (T9 da fatia
  // `documentos-e-confirmacao`). Ela **não é segredo** — é o endereço que qualquer pessoa digita no
  // navegador.
  //
  // ⚠️ **ESTE processo NÃO compõe link algum**, e a exigência aqui não finge o contrário: quem monta
  // o endereço da confirmação é o processador de trabalho (T10), e é lá que o valor é LIDO. O que a
  // linha abaixo cobra é **completude do arquivo de ambiente**, que é UM SÓ e é o `EnvironmentFile=`
  // das duas unidades (§16.3 da tech spec). A diferença é operacional e vale a linha: a `api` é o
  // processo que o operador acompanha na instalação e na virada, de modo que um arquivo incompleto é
  // recusado ali, nomeando a variável — em vez de as duas unidades subirem e a falta aparecer horas
  // depois, como um link que não leva a lugar nenhum na caixa de um locatário real.
  //
  // É por isso que ela **não** vira campo de {@link Ambiente}: exigir não é consumir, e publicar um
  // valor que nenhum código deste processo lê ensinaria o leitor seguinte que a `api` emite links.
  //
  // A mensagem de recusa nomeia a **variável**, nunca o valor — a disciplina é a mesma de todas as
  // demais, e vale mesmo para o que não é segredo: a regra é do formato da mensagem, e abri-la
  // "só para esta" cria a exceção que a próxima variável herda.
  //
  // A **forma** do endereço não é conferida aqui, e a ausência é decisão: quem compõe o link é o
  // processador de trabalho (T10), e uma conferência de forma escrita nesta composição ficaria livre
  // para divergir da que o outro processo fizer — a divergência entre dois pontos que decidem o
  // mesmo fato é o que esta fatia existe para não ter. O piso de um caractere é a barreira que
  // sobrevive a qualquer mudança futura em {@link selecionar}.
  URL_BASE_DA_CONFIRMACAO: z.string().min(1, 'deve ser declarada'),
  // A chave que abre o envelope do certificado do provedor (T11 da fatia `fundacao-bancaria`).
  //
  // ⚠️ **Aqui o modo perigoso é o INVERSO do habitual**, e é por isso que a partida é recusada em vez
  // de o processo subir: sem a chave, o serviço atenderia normalmente até o primeiro registro de
  // certificado — e o Admin descobriria a falta **acreditando ter entregado o material ao produto**.
  // Recusar na partida põe o custo no operador, na instalação, onde ele é barato; subir mesmo assim
  // o põe no dia em que a empresa precisa cobrar.
  //
  // A conferência é de **comprimento decodificado**, não de presença: um esquema que apenas exigisse
  // a variável deixaria subir um processo com chave de 31 bytes, que o AES-256-GCM recusa na
  // primeira operação. É a mesma forma do par que já existe para `BETTER_AUTH_SECRET`, e a razão é
  // mais forte: o segredo de sessão trocado invalida sessões; **a chave de cifra trocada torna o
  // acervo cifrado ilegível**, e material vindo de terceiro ninguém recompõe.
  //
  // A recusa nomeia a **variável e o tamanho exigido**, e JAMAIS o valor recebido — ela vai para o
  // journal, e este valor abre o envelope de todas as empresas do SaaS. A distinção entre "ausente"
  // e "inaceitável" é preservada por {@link descrever}: o operador que procura no lugar errado
  // perde a instalação inteira.
  //
  // A transformação para `Buffer` acontece **aqui**, e a posição é conteúdo: a conferência já
  // decodifica, e publicar o texto obrigaria toda borda a decodificar de novo — uma segunda
  // declaração da codificação, livre para divergir da que conferiu.
  CHAVE_DE_CIFRA_DO_CERTIFICADO: z
    .string()
    .refine(ehChaveDeCifraAceitavel, EXIGENCIA_DA_CHAVE_DE_CIFRA)
    .transform((valor) => Buffer.from(valor, 'base64')),
  // O endereço do provedor bancário, sobre o qual a verificação de identidade aperta a mão (T12).
  //
  // ⚠️ **Ele vem do ambiente, nunca do corpo nem da sessão**, e é essa origem que fecha a requisição
  // forjada do lado do servidor: nenhuma entrada de cliente decide para onde o produto conecta
  // apresentando o certificado de uma empresa. `IdentidadeParaVerificar` deliberadamente não o
  // carrega.
  //
  // A **forma** não é conferida aqui, e a ausência é decisão — o precedente literal é o de
  // `SMTP_URL`, três parágrafos acima: quem recusa o endereço que não serve é `resolverDestino`, em
  // `@sysloc/cobranca-bancaria`, num lugar só, na **construção** do adaptador. Uma segunda
  // conferência de forma escrita nesta composição ficaria livre para divergir daquela, e é
  // justamente a divergência entre dois pontos que decidem o mesmo fato que esta fatia existe para
  // não ter. O piso de um caractere é a barreira que sobrevive a qualquer mudança em
  // {@link selecionar}.
  ENDERECO_DO_PROVEDOR_BANCARIO: z.string().min(1, 'deve ser declarada'),
  /**
   * O endereço de AUTORIZAÇÃO do provedor — máquina distinta da API.
   *
   * Medido em 2026-08-20 na configuração do sistema antigo: a concessão vive em host próprio
   * (`auth.…`) e a cobrança em outro (`api.…`). Fechamento do `D36 · F4/T10`.
   *
   * ⚠️ **EXIGIDA, e não opcional.** A primeira escrita a fez opcional, e isso quebrava a propriedade
   * que {@link VARIAVEIS_EXIGIDAS} sustenta — *o esquema é a fonte única do que o processo exige* —,
   * além de falhar ABERTO: o processo subiria sem ela e só quebraria na primeira emissão, com
   * recusa do provedor em vez de recusa de partida. Aqui se falha fechado.
   */
  ENDERECO_DE_AUTORIZACAO_BANCARIA: z.string().min(1, 'deve ser declarada'),
  /**
   * Para **onde** o provedor entrega a notícia — o endereço público desta instalação.
   *
   * ---------------------------------------------------------------------------
   * Por que ela é EXIGIDA aqui, e não opcional como o campo irmão do adaptador
   * ---------------------------------------------------------------------------
   *
   * `ConfiguracaoDoProvedorBancario.enderecoDaEntregaDaNoticia` é **opcional** por um motivo que vale
   * lá e não vale aqui: quem só usa a sonda de identidade ou as operações de cobrança não cadastra
   * entrega alguma, e obrigá-lo quebraria quatro construtores que nada têm com a notícia. Mas a
   * degradação que a opcionalidade produz é assimétrica em relação à do endereço de autorização, e a
   * assimetria foi **medida** (`D29`, Gate 2 da T6): ausente o endereço de autorização, a concessão
   * degrada **com sentido** — vai ao destino da API; ausente este, as duas operações da entrega
   * resolvem `{ aceito: false, motivo: null }` **sem chamar** o provedor, e `motivo: null` é
   * exatamente o valor que a porta reserva para *"o provedor não chegou a responder"*. Erro de
   * configuração desta instalação e indisponibilidade do terceiro chegariam ao Admin com o **mesmo**
   * valor, sem que nada na porta os distinguisse — e nenhum sinal chegaria ao par TLS, de modo que
   * nem os registros do provedor nem os desta ponta mostrariam tentativa alguma.
   *
   * Exigi-la na partida é o que fecha a classe: o processo que compõe a porta de entrega **recusa
   * subir** mal configurado, em vez de recusar cada operação em silêncio. É a mesma disciplina, e a
   * mesma razão, do parágrafo *"EXIGIDA, e não opcional"* de {@link ENDERECO_DE_AUTORIZACAO_BANCARIA}:
   * aqui se falha fechado.
   *
   * A **forma** não é conferida nesta leitura, e a ausência é a mesma decisão de
   * `ENDERECO_DO_PROVEDOR_BANCARIO`: quem recusa o endereço que não serve é `resolverDestino`, em
   * `@sysloc/cobranca-bancaria`, num lugar só, na **construção** do adaptador — e a recusa de lá
   * nomeia o campo, jamais o valor. Uma segunda conferência de forma escrita nesta composição ficaria
   * livre para divergir daquela. O piso de um caractere é a barreira que sobrevive a
   * {@link selecionar}, que trata valor em branco como ausente.
   *
   * ⚠️ **Divergência de escopo declarada: este arquivo NÃO está na §5.1/§5.2 do card da T7**, nem no
   * raio de impacto que ela declara — o raio de lá é derivado das **âncoras de superfície**, e esta é
   * uma exigência de **composição do processo**, que aquela derivação não alcança. A razão de abri-lo
   * é o fecho do **`D29`** (achado `architecture` do Gate 2 da T6), cujo *"o que fazer"* nomeia este
   * arquivo por extenso: *"exigir `enderecoDaEntregaDaNoticia` na conferência de partida
   * (`apps/api/src/configuracao/ambiente.ts`) sempre que o serviço de entrega for registrado"*. A T7 é
   * a task que introduz o **primeiro consumidor** da porta, e sem esta linha uma instalação mal
   * configurada responderia para sempre `{ aceito: false, motivo: null }` — indistinguível de
   * indisponibilidade do provedor. Mesmo molde das anotações do `D26 (F2/T6)` que esta task deixou em
   * `apps/api/test/contexto.e2e.spec.ts` e `apps/api/test/validacao.spec.ts`.
   *
   * ⚠️ Abrir este arquivo **disparou o gatilho do `D51 · F4/T16`** (*"a primeira task autorizada a
   * abrir `apps/api/src/configuracao/ambiente.ts`"*): as duas conferências de forma da chave de cifra
   * seguem com duas definições, aqui e em `apps/worker/src/main.ts`. Ele fica **adiado** — fechá-lo
   * mexeria na partida do worker, que está fora desta task —, e o disparo está registrado no índice do
   * `CLAUDE.md` para que a próxima task não releia o gatilho como futuro.
   */
  ENDERECO_DA_ENTREGA_DA_NOTICIA: z
    .string()
    .refine(ehEnderecoDeEntregaAceitavel, EXIGENCIA_DO_ENDERECO_DA_ENTREGA),
  // O contato operacional que o provedor exige no cadastro da entrega, e por onde ele avisa quando
  // inativa o webhook. Ver {@link ehContatoDeEntregaAceitavel} para por que ele é do PROCESSO e por
  // que a partida confere a forma dele.
  CONTATO_DA_ENTREGA_DA_NOTICIA: z
    .string()
    .refine(ehContatoDeEntregaAceitavel, EXIGENCIA_DO_CONTATO_DA_ENTREGA),
  // O diretório onde os bytes do boleto são guardados (T13 da fatia `emissao-e-conciliacao`).
  //
  // ⚠️ **Aqui o modo perigoso é o mesmo INVERSO da chave de cifra**, e por isso a partida é recusada
  // em vez de o processo subir: sem o diretório — ou com um que este processo não consiga escrever —
  // o serviço atenderia normalmente até a primeira emissão, e a falha aconteceria **depois** de o
  // provedor ter registrado o título. O boleto existiria no banco e não existiria em disco, que é o
  // estado que a CA-08 tem de rebuscar do provedor.
  //
  // A conferência é de **forma e capacidade**, não de presença: um esquema que apenas exigisse a
  // variável deixaria subir um processo apontado para um caminho relativo — resolvido contra o
  // diretório de trabalho de quem iniciou o serviço — ou para um diretório de outro dono. A razão de
  // as duas metades serem uma conferência só está em {@link ehDiretorioGravavel}, e é a mesma de
  // `CHAVE_DE_CIFRA_DO_CERTIFICADO`.
  //
  // A recusa nomeia a **variável e a exigência**, e JAMAIS o valor recebido — a disciplina é a de
  // todas as demais, e vale mesmo para o que não é segredo: a regra é do formato da mensagem, e
  // abri-la "só para esta" cria a exceção que a próxima variável herda.
  //
  // ⚠️ **Diferente de `ENDERECO_DO_PROVEDOR_BANCARIO`, a forma é conferida AQUI**, e a assimetria tem
  // critério: lá quem recusa o endereço que não serve é a **construção do adaptador**, num lugar só,
  // e uma segunda conferência nesta leitura ficaria livre para divergir daquela. Aqui não há segundo
  // lugar — `criarGuardaDeBoletos` **resolve** o diretório-base e deliberadamente **não o cria nem o
  // confere** (ver o cabeçalho dela) —, de modo que esta é a única barreira que existe.
  DIRETORIO_DOS_BOLETOS: z.string().refine(ehDiretorioGravavel, EXIGENCIA_DO_DIRETORIO_DOS_BOLETOS),
  /**
   * As origens **públicas** de onde o navegador fala com este serviço — o fecho do `D23 · F1/T8`.
   *
   * ---------------------------------------------------------------------------
   * Por que ela é uma LISTA, e nunca um valor só
   * ---------------------------------------------------------------------------
   *
   * São **dois** aplicativos sobre a mesma API — o do cliente e o Painel Master —, cada um no seu
   * hostname. Uma origem só faria um dos dois parar de entrar, e é justamente essa forma que o
   * paliativo da borda do Master tinha: ele mapeava **uma** origem para o endereço de escuta. O
   * arcabouço já aceita o plural (`trustedOrigins.some(...)`, sobre valor tratado com
   * `Array.isArray`), de modo que o plural não custa nada e o singular custaria a segunda cópia do
   * paliativo.
   *
   * ---------------------------------------------------------------------------
   * ⚠️ Aqui o modo perigoso é o INVERSO do habitual — por isso a partida é recusada
   * ---------------------------------------------------------------------------
   *
   * Sem ela, o processo sobe e atende normalmente **até o primeiro navegador**: o arcabouço deriva a
   * origem confiável apenas do endereço em que o serviço escuta, e toda requisição com cookie — mais
   * a **própria entrada** — é recusada com `403` antes de qualquer manipulador. Não é "requisição
   * autenticada recusada": é o serviço inteiro inacessível a navegador. Recusar na partida põe o
   * custo no operador, na instalação, onde ele é barato.
   *
   * A conferência é de **forma**, e não de presença, pela mesma razão de `DIRETORIO_DOS_BOLETOS` e
   * de `ENDERECO_DA_ENTREGA_DA_NOTICIA`: **não há segundo lugar** onde o defeito seja pego — ver
   * {@link ehOrigemPublicaAceitavel}. A recusa nomeia a **variável e a exigência**, e JAMAIS o valor
   * recebido; a distinção entre "ausente" e "inaceitável" é preservada por {@link descrever}.
   *
   * A separação acontece **aqui**, e a posição é conteúdo: a conferência já separou a lista para
   * validar cada item, e publicar o texto obrigaria a composição a separá-lo de novo — uma segunda
   * declaração do separador, livre para divergir da que conferiu. Mesmo desenho de
   * `CHAVE_DE_CIFRA_DO_CERTIFICADO`, que sai já decodificada.
   */
  ORIGENS_PUBLICAS: z
    .string()
    .refine(saoOrigensPublicasAceitaveis, EXIGENCIA_DAS_ORIGENS_PUBLICAS)
    .transform(separarOrigensPublicas),
});

/**
 * Nomes das variáveis que o processo exige, na ordem em que o esquema as declara.
 *
 * É por esta lista que a leitura seleciona o que consumir: o restante do ambiente do processo
 * nunca entra na validação nem na configuração devolvida. Ela também é a lista que o `.env.example`
 * documenta.
 */
export const VARIAVEIS_EXIGIDAS = Object.keys(
  ESQUEMA.shape,
) as readonly (keyof typeof ESQUEMA.shape)[];

/** Registro de variáveis de ambiente, na forma em que o runtime as entrega. */
export type FonteDeVariaveis = Readonly<Record<string, string | undefined>>;

/** Configuração validada do serviço de aplicação, já com os tipos convertidos. */
export interface Ambiente {
  /** Ambiente de execução, de `NODE_ENV`. */
  readonly ambiente: (typeof AMBIENTES)[number];
  /** Porta TCP em que o serviço escuta, de `PORT`. Número, nunca texto. */
  readonly porta: number;
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão do banco de dados, de `DATABASE_URL`. */
  readonly cadeiaConexaoBanco: string;
  /** Cadeia de conexão da fila, de `REDIS_URL`. */
  readonly cadeiaConexaoFila: string;
  /**
   * Segredo de assinatura de sessão, de `BETTER_AUTH_SECRET`.
   *
   * Trocá-lo invalida toda sessão em curso — é a alavanca de emergência para suspeita de
   * vazamento, e é por isso que ele vive em `EnvironmentFile` 0600 fora da árvore (§11.6).
   */
  readonly segredoDeSessao: string;
  /**
   * Cadeia de conexão do servidor de e-mail, de `SMTP_URL`. **Carrega credencial.**
   *
   * Ela não é registrada, não viaja em `argv` e não é ecoada em mensagem de erro: a recusa de partida
   * nomeia a **variável**, e a falha de entrega nomeia o **código** do transporte. Mesma disciplina, e
   * mesmos nomes de campo, de `apps/worker/src/main.ts`.
   */
  readonly urlDoTransporte: string;
  /** Endereço que assina o aviso, de `EMAIL_REMETENTE`. */
  readonly remetenteDoAviso: string;
  /**
   * A chave que cifra e decifra o segredo do certificado do provedor, de
   * `CHAVE_DE_CIFRA_DO_CERTIFICADO`. **É o segredo mais forte deste processo.**
   *
   * Ela chega **já decodificada**, porque é assim que a cifra a consome e porque a conferência de
   * partida precisou decodificá-la para medir os 32 bytes — uma segunda decodificação na borda seria
   * uma segunda declaração da codificação.
   *
   * Ela não é registrada, não viaja em `argv` e não é ecoada em mensagem de erro: a recusa de partida
   * nomeia a **variável e o tamanho exigido**. Trocá-la **não** invalida sessões — torna ilegível
   * todo envelope já gravado —, e é por isso que ela vive em `EnvironmentFile` 0600 fora da árvore.
   */
  readonly chaveDeCifraDoCertificado: Buffer;
  /**
   * O endereço do provedor bancário, de `ENDERECO_DO_PROVEDOR_BANCARIO`.
   *
   * Ele **não é segredo** — é o endereço público de uma instituição —, e mora aqui porque é a
   * composição que constrói o adaptador a partir dele (T12). A forma é conferida lá, na construção,
   * e não nesta leitura: ver a razão junto da linha que o exige.
   */
  readonly enderecoDoProvedorBancario: string;
  /** O endereço de autorização do provedor, de `ENDERECO_DE_AUTORIZACAO_BANCARIA`. */
  readonly enderecoDeAutorizacaoBancaria: string;
  /**
   * O endereço público **desta instalação** que o provedor passa a chamar, de
   * `ENDERECO_DA_ENTREGA_DA_NOTICIA`.
   *
   * ⚠️ Ele é propriedade de **quem constrói o adaptador**, e jamais do ato: aceitá-lo por operação
   * faria uma entrada de usuário decidir o destino do que se cadastra no provedor, que é a forma
   * canônica da requisição forjada do lado do servidor. É uma URL só para todos os clientes — o
   * roteamento da notícia recebida é pelo identificador que o próprio produto emitiu.
   */
  readonly enderecoDaEntregaDaNoticia: string;
  /** O contato operacional que acompanha o cadastro da entrega — a outra metade do endereço acima. */
  readonly contatoDaEntregaDaNoticia: string;
  /**
   * O diretório onde os bytes do boleto são guardados, de `DIRETORIO_DOS_BOLETOS`.
   *
   * Ele **não é segredo** — é um caminho de sistema de arquivos —, e tem campo aqui (diferente de
   * `URL_BASE_DA_CONFIRMACAO`) porque **este** processo o consome: é a composição da superfície de
   * cobranças que constrói a guarda de boletos a partir dele (ADR-0025 — o pacote de domínio não lê
   * `process.env`).
   *
   * Ele chega **como veio**, sem resolução: quem o resolve, uma vez, é `criarGuardaDeBoletos`. Uma
   * segunda resolução aqui daria ao produto dois caminhos-base para o mesmo diretório, livres para
   * divergir na primeira mudança de convenção de caminho.
   */
  readonly diretorioDosBoletos: string;
  /**
   * As origens públicas de onde o navegador fala com este serviço, de `ORIGENS_PUBLICAS`.
   *
   * Elas **não são segredo** — são o que qualquer pessoa digita no navegador —, e têm campo aqui
   * (diferente de `URL_BASE_DA_CONFIRMACAO`) porque **este** processo as consome: é o módulo de
   * identidade que as entrega ao arcabouço como origem confiável.
   *
   * Chegam **já separadas**, porque a conferência de partida precisou separá-las para validar cada
   * item — uma segunda separação na composição seria uma segunda declaração do separador.
   *
   * ⚠️ Elas **acrescentam**, e não substituem: o arcabouço empilha sempre a origem derivada do
   * endereço de escuta antes destas. Ver `autenticacao.module.ts`.
   */
  readonly origensPublicas: readonly string[];
  // ⚠️ `URL_BASE_DA_CONFIRMACAO` é EXIGIDA na partida e **não** tem campo aqui. A ausência é a
  // decisão, e a razão está no esquema, junto da linha que a exige: este processo confere a
  // completude do arquivo de ambiente compartilhado e NÃO compõe link nenhum — quem lê o valor é o
  // processador de trabalho. Publicar um campo que ninguém deste processo consome ensinaria o
  // contrário a quem chegasse depois.
}

/**
 * Token de injeção da configuração. Símbolo em vez de cadeia de caracteres: colisão com um token
 * de outro módulo deixa de ser possível.
 */
export const TOKEN_AMBIENTE = Symbol('Ambiente');

/**
 * Token de injeção do registrador estruturado do processo.
 *
 * Mora aqui, ao lado do token da configuração, porque é a configuração que o alimenta (`LOG_LEVEL`)
 * e porque os dois são publicados pela mesma composição raiz. Declará-lo no módulo raiz criaria
 * importação circular com o filtro de exceção, que o consome.
 */
export const TOKEN_LOGGER = Symbol('Logger');

/**
 * Token de injeção da instância do arcabouço de identidade (T8).
 *
 * Mora aqui pela MESMA razão do token acima, e o precedente é o daquele comentário: declará-lo no
 * módulo que o provê criaria importação circular com o controlador que o consome — o módulo declara
 * o controlador, o controlador pede o token no decorador, e o decorador é avaliado enquanto o
 * módulo ainda está sendo carregado. O símbolo não tem dependência alguma; este arquivo é o único
 * do serviço que nenhum outro consome de volta.
 */
export const TOKEN_AUTENTICACAO = Symbol('Autenticacao');

/**
 * Token de injeção do acesso restrito ao schema `identidade` (T9).
 *
 * Nasceu privado em `autenticacao/autenticacao.module.ts` (T8) e mudou para cá quando ganhou o
 * segundo consumidor: a guarda de contexto, que precisa dele para resolver a empresa da sessão —
 * `perfil` e `empresa_id` são colunas do produto e não campos do modelo do arcabouço, como o débito
 * **D7** registra — o marcador dele vive em `packages/auth/src/autenticacao.ts`.
 *
 * Declará-lo no módulo que o provê reproduziria a importação circular que os dois tokens acima já
 * descrevem — o módulo declara a guarda, a guarda pede o token no construtor, e o construtor é
 * avaliado enquanto o módulo ainda está sendo carregado. Mover para cá **não** o publica a outros
 * módulos: ele continua fora do `exports` de `AutenticacaoModule`, e quem precisa de dado de
 * identidade continua passando pelo arcabouço ou pela sessão.
 */
export const TOKEN_ACESSO_A_IDENTIDADE = Symbol('AcessoAIdentidade');

/**
 * Token de injeção do acesso a dado de **negócio** — a unidade de trabalho (T4 da fatia
 * `autorizacao-e-ciclo-de-acesso`).
 *
 * Mora aqui pela MESMA razão dos três tokens acima, e pelo mesmo mecanismo: declará-lo no módulo que
 * o provê criaria importação circular com a guarda, que o pede no construtor enquanto o módulo ainda
 * está sendo carregado.
 *
 * **Por que a guarda precisa dele**: a revalidação por versão da ADR-0010 relê os ajustes individuais
 * da pessoa quando o retrato da sessão fica velho, e eles vivem em `negocio.acesso_usuario_permissao`
 * — sob RLS forçada. A unidade de trabalho é a única porta para lá (ADR-0008), e é ela que emite o
 * `SET LOCAL app.empresa_id` que dá escopo à leitura. Nenhum filtro por empresa é escrito na
 * aplicação.
 *
 * Ele fica **fora do `exports`** de quem o provê, exatamente como `TOKEN_ACESSO_A_IDENTIDADE`:
 * nenhum módulo de fora recebe o acesso, e a porta única para dado de negócio não vira duas por
 * conveniência de injeção.
 */
export const TOKEN_ACESSO_AO_NEGOCIO = Symbol('AcessoAoBanco');

/**
 * Token de injeção da **porta de saída de e-mail** (T10 da fatia `regua-de-cobranca`).
 *
 * Mora aqui, ao lado dos quatro tokens acima, pelo mesmo motivo deles — e não porque a verificação
 * precise dele. O que ele publica é a `PortaDeEnvioDeEmail` que `@sysloc/regua` declara: a operação
 * recebe o adaptador de SMTP, e a verificação substitui o provedor pelo **capturador**, pela mesma
 * interface e pelo mesmo mecanismo do arcabouço de teste (`overrideProvider`) que
 * `contexto.e2e.spec.ts` e `saude.e2e.spec.ts` já usam para o registrador.
 *
 * ⚠️ **`criarAplicacao()` NÃO ganha parâmetro por causa disto**, e a ausência é a decisão: uma opção
 * de composição que só a suíte passasse seria símbolo de produção a serviço do teste — o seam que a
 * disciplina do executor proíbe —, e ela seria também um segundo caminho para escolher o adaptador,
 * exatamente o `if (ehTeste)` que o cabeçalho de `packages/regua/src/adaptador-smtp.ts` recusa. A
 * barreira da CA-17 é **estrutural**: quem monta o processo escolhe, e o que a suíte faz é trocar o
 * provedor de fora, sem que exista bandeira, ambiente ou ramo no meio.
 */
export const TOKEN_PORTA_DE_EMAIL = Symbol('PortaDeEnvioDeEmail');

/**
 * Token de injeção da **porta de renderização do documento** (T7 da fatia
 * `documentos-e-confirmacao`).
 *
 * Mora aqui, ao lado dos cinco tokens acima, pelo mesmo motivo deles — e há um a mais, que é
 * estrutural: declará-lo em `contratos/contratos.module.ts` fecharia importação circular, porque o
 * módulo importa o controlador, o controlador importa o serviço, e é o **serviço** quem precisa do
 * token. O que ele publica é a `PortaDeRenderizacao` que `@sysloc/documentos` declara (ADR-0025):
 * quem monta o processo escolhe o adaptador, e a composição do documento continua sem saber que
 * existe um motor de PDF.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o motor.** O único ponto do repositório que
 * conhece `@react-pdf/renderer` continua sendo `packages/documentos/src/renderizador-pdf.ts`, e o
 * único que decide qual adaptador entra em produção é `ContratosModule` — não há bandeira, não há
 * variável de ambiente e não há ramo `if (ehTeste)` no meio. A verificação exercita o adaptador
 * **real**: os bytes do documento são a coisa sob prova, e dublar o renderizador seria dublar
 * exatamente o que se quer medir.
 */
export const TOKEN_PORTA_DE_RENDERIZACAO = Symbol('PortaDeRenderizacao');

/**
 * Token de injeção da **porta de identidade bancária** (fatia `fundacao-bancaria`).
 *
 * Mora aqui, ao lado dos seis tokens acima, pelo mesmo motivo deles, e com o mesmo agravante
 * estrutural do anterior: declará-lo em `integracoes-bancarias/integracoes-bancarias.module.ts`
 * fecharia importação circular, porque o módulo importa o controlador, o controlador importa o
 * serviço, e é o **serviço** quem pede o token no construtor — avaliado enquanto o módulo ainda está
 * sendo carregado. O que ele publica é a `PortaDeIdentidadeBancaria` que `@sysloc/cobranca-bancaria`
 * declara (ADR-0025): quem monta o processo escolhe o adaptador, e o domínio segue sem saber que
 * existe um provedor com endereço.
 *
 * ⚠️ **Ele nasce nesta task e o provedor que o satisfaz é registrado na seguinte**, que é quem
 * publica a rota de verificação e constrói o adaptador a partir de
 * {@link Ambiente.enderecoDoProvedorBancario}. A antecipação é deliberada, e o que ela compra é
 * nome: o token é a identidade da porta, e declará-lo junto dos seis irmãos — na mesma task que
 * publica a área e a variável de ambiente que o alimenta — é o que impede a task seguinte de abrir um
 * segundo nome, ou de declará-lo dentro do módulo e reabrir a importação circular descrita acima.
 * Registrar aqui um provedor sem consumidor seria pior: ele construiria o cliente do provedor na
 * montagem de **toda** aplicação, inclusive nas que não verificam identidade nenhuma.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o adaptador**: não há bandeira de ambiente, não
 * há `if (ehTeste)` e `criarAplicacao()` não ganha parâmetro — as três alternativas estão recusadas
 * por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de
 * {@link TOKEN_PORTA_DE_EMAIL}. A verificação troca o **provedor inteiro** de fora, pela mesma
 * interface e pelo mesmo mecanismo (`overrideProvider`).
 */
export const TOKEN_PORTA_DE_IDENTIDADE_BANCARIA = Symbol('PortaDeIdentidadeBancaria');

/**
 * Token de injeção da **porta de cobrança bancária** (T13 da fatia `emissao-e-conciliacao`).
 *
 * Mora aqui, ao lado dos sete tokens acima, pelo mesmo motivo deles e com o mesmo agravante
 * estrutural dos dois últimos: declará-lo em `cobrancas/cobrancas.module.ts` fecharia importação
 * circular, porque o módulo importa o controlador, o controlador importa o serviço, e é o **serviço**
 * quem pede o token no construtor — avaliado enquanto o módulo ainda está sendo carregado. O que ele
 * publica é a `AdaptadorCobrancaBancaria` que `@sysloc/cobranca-bancaria` declara (ADR-0025): quem
 * monta o processo escolhe o adaptador, e o domínio segue sem saber que existe um provedor com
 * endereço.
 *
 * ⚠️ **Ele é IRMÃO, e não substituto, de {@link TOKEN_PORTA_DE_IDENTIDADE_BANCARIA}.** As duas portas
 * não se fundem por decisão registrada no cabeçalho de `packages/cobranca-bancaria/src/
 * porta-de-cobranca.ts`: uma responde *"esta identidade serve?"*, que é ato de configuração, e a
 * outra pelos atos de **cobrança**. Que o mesmo adaptador satisfaça as duas é escolha dele, não da
 * fronteira — e é por isso que cada área injeta a **sua**, sem que a superfície do certificado ganhe
 * acesso à emissão ou vice-versa.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o adaptador**: não há bandeira de ambiente, não
 * há `if (ehTeste)` e `criarAplicacao()` não ganha parâmetro — as três alternativas estão recusadas
 * por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de
 * {@link TOKEN_PORTA_DE_EMAIL}. A verificação troca o **provedor inteiro** de fora, pela mesma
 * interface e pelo mesmo mecanismo (`overrideProvider`).
 */
export const TOKEN_PORTA_DE_COBRANCA_BANCARIA = Symbol('AdaptadorCobrancaBancaria');

/**
 * Token de injeção da **guarda de bytes do boleto** (T13 da fatia `emissao-e-conciliacao`).
 *
 * Mora aqui pelo mesmo motivo do token acima, e o que ele publica é a `GuardaDeBoletos` que
 * `@sysloc/cobranca-bancaria` declara. O diretório-base chega a ela **por parâmetro**, da composição
 * (ADR-0025): aquele pacote não lê `process.env`, e é {@link Ambiente.diretorioDosBoletos} — já
 * conferido na partida — que alimenta a construção.
 *
 * ⚠️ **A verificação NÃO troca a guarda por um dublê**, e a ausência é a decisão: os bytes gravados
 * em disco são a coisa sob prova (CA-08), e dublar a guarda seria dublar exatamente o que se quer
 * medir. O que a suíte troca é o **diretório**, semeando `DIRETORIO_DOS_BOLETOS` para um caminho
 * descartável — o mesmo mecanismo, e a mesma razão, do renderizador de PDF em
 * {@link TOKEN_PORTA_DE_RENDERIZACAO}.
 */
export const TOKEN_GUARDA_DE_BOLETOS = Symbol('GuardaDeBoletos');

/**
 * Token de injeção da **porta de mesclagem de documentos** (T10 da fatia `webhook-e-carne`).
 *
 * Mora aqui pelo mesmo motivo dos dois tokens acima, e com o mesmo agravante estrutural: declará-lo
 * em `cobrancas/cobrancas.module.ts` fecharia importação circular, porque o módulo importa o
 * controlador, o controlador importa o serviço, e é o **serviço** quem pede o token no construtor —
 * avaliado enquanto o módulo ainda está sendo carregado. O que ele publica é a `PortaDeMesclagem`
 * que `@sysloc/documentos` declara (ADR-0025): quem monta o processo escolhe o adaptador
 * (`criarMescladorPdf`), e o domínio segue sem saber que existe um `pdf-lib`.
 *
 * ⚠️ **Ele não carrega opção nenhuma, e a ausência é a ADR-0030.** A porta recebe bytes prontos e
 * devolve bytes; página, margem, cabeçalho, numeração e marca d'água **não** atravessam esta
 * fronteira, porque o que passa por ela é o boleto que o provedor emitiu — fato recebido de
 * terceiro, que ninguém recompõe. Ver o cabeçalho de
 * `packages/documentos/src/porta-de-mesclagem.ts`.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o adaptador**: não há bandeira de ambiente, não
 * há `if (ehTeste)` e `criarAplicacao()` não ganha parâmetro — as três alternativas estão recusadas
 * por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de
 * {@link TOKEN_PORTA_DE_EMAIL}. E **nenhuma variável de ambiente nasce com ele**: o mesclador não tem
 * endereço, diretório nem credencial — a composição do carnê acontece em memória e nada é armazenado
 * (ADR-0030), de modo que não há o que conferir na partida.
 */
export const TOKEN_PORTA_DE_MESCLAGEM = Symbol('PortaDeMesclagem');

/**
 * Token de injeção da **porta de entrega da notícia** (T7 da fatia `integracao-bancaria-autonoma`).
 *
 * Mora aqui, ao lado dos tokens irmãos, pelo mesmo motivo deles e com o mesmo agravante estrutural:
 * declará-lo em `integracoes-bancarias/integracoes-bancarias.module.ts` fecharia importação circular,
 * porque o módulo importa o controlador, o controlador importa o serviço, e é o **serviço** quem pede
 * o token no construtor — avaliado enquanto o módulo ainda está sendo carregado. O que ele publica é
 * a `PortaDeEntregaDaNoticia` que `@sysloc/cobranca-bancaria` declara (ADR-0025): quem monta o
 * processo escolhe o adaptador, e o domínio segue sem saber que existe um provedor com endereço.
 *
 * ⚠️ **Ele é IRMÃO, e não substituto, de {@link TOKEN_PORTA_DE_IDENTIDADE_BANCARIA} nem de
 * {@link TOKEN_PORTA_DE_COBRANCA_BANCARIA}.** As três portas não se fundem por decisão registrada no
 * cabeçalho de `packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts`: uma responde *"esta
 * identidade serve?"*, outra pelos atos de **cobrança**, e esta **configura o canal** por onde a
 * notícia chega. Que o mesmo adaptador satisfaça as três é escolha dele, não da fronteira.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o adaptador**: não há bandeira de ambiente, não
 * há `if (ehTeste)` e `criarAplicacao()` não ganha parâmetro — as três alternativas estão recusadas
 * por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de
 * {@link TOKEN_PORTA_DE_EMAIL}. A verificação troca o **provedor inteiro** de fora, pela mesma
 * interface e pelo mesmo mecanismo (`overrideProvider`).
 */
export const TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA = Symbol('PortaDeEntregaDaNoticia');

/**
 * Lê e valida as variáveis de ambiente exigidas.
 *
 * @param fonte Registro de variáveis — `process.env` na partida, objeto montado na verificação.
 * @returns A configuração com cada valor já convertido para o tipo declarado no esquema.
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia
 * **todas** as variáveis com problema, uma por vez que ocorra, e nunca ecoa o valor recebido —
 * `DATABASE_URL` carrega a senha do banco, e a mensagem de falha vai para o journal.
 */
export function carregarAmbiente(fonte: FonteDeVariaveis): Ambiente {
  const resultado = ESQUEMA.safeParse(selecionar(fonte));

  if (!resultado.success) {
    throw new Error(
      'configuração inválida na partida: ' +
        `${resultado.error.issues.map((problema) => descrever(problema, fonte)).join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  const validado = resultado.data;
  return {
    ambiente: validado.NODE_ENV,
    porta: validado.PORT,
    nivelDeLog: validado.LOG_LEVEL,
    cadeiaConexaoBanco: validado.DATABASE_URL,
    cadeiaConexaoFila: validado.REDIS_URL,
    segredoDeSessao: validado.BETTER_AUTH_SECRET,
    urlDoTransporte: validado.SMTP_URL,
    remetenteDoAviso: validado.EMAIL_REMETENTE,
    chaveDeCifraDoCertificado: validado.CHAVE_DE_CIFRA_DO_CERTIFICADO,
    enderecoDoProvedorBancario: validado.ENDERECO_DO_PROVEDOR_BANCARIO,
    enderecoDeAutorizacaoBancaria: validado.ENDERECO_DE_AUTORIZACAO_BANCARIA,
    enderecoDaEntregaDaNoticia: validado.ENDERECO_DA_ENTREGA_DA_NOTICIA,
    contatoDaEntregaDaNoticia: validado.CONTATO_DA_ENTREGA_DA_NOTICIA,
    diretorioDosBoletos: validado.DIRETORIO_DOS_BOLETOS,
    origensPublicas: validado.ORIGENS_PUBLICAS,
  };
}

/**
 * Copia do ambiente apenas as variáveis exigidas, tratando valor em branco como **ausente**.
 *
 * O `.env.example` versionado declara toda variável sem valor (`PORT=`), e um arquivo copiado dele
 * sem preenchimento entrega cadeias vazias. Sem esta normalização a falha viria como "deve ser um
 * número" onde o problema real é "não foi preenchida" — e o diagnóstico erra o alvo justamente no
 * caso mais provável de uma máquina recém-configurada.
 */
function selecionar(fonte: FonteDeVariaveis): Record<string, string | undefined> {
  const selecionadas: Record<string, string | undefined> = {};
  for (const nome of VARIAVEIS_EXIGIDAS) {
    const valor = fonte[nome]?.trim();
    if (valor !== undefined && valor !== '') {
      selecionadas[nome] = valor;
    }
  }
  return selecionadas;
}

/** Descreve um problema de validação nomeando a variável — e nunca o valor recebido. */
function descrever(problema: z.core.$ZodIssue, fonte: FonteDeVariaveis): string {
  const nome = String(problema.path[0] ?? '(variável não identificada)');
  const ausente = (fonte[nome]?.trim() ?? '') === '';
  return `${nome}: ${ausente ? 'ausente' : problema.message}`;
}
