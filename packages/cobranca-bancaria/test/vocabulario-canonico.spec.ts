/**
 * Verificação do **vocabulário canônico** publicado pelo domínio da cobrança bancária — CT-809,
 * CT-834 e CT-835 da fatia `fundacao-bancaria`, mais o CT-933 da fatia `emissao-e-conciliacao` e o
 * CT-991 da fatia `webhook-e-carne`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-13    | CT-809 | `PortaDeIdentidadeBancaria` declara **exatamente uma** operação —
 * |          |        | `verificarIdentidade` —, e a implementação de referência que a satisfaz tem
 * |          |        | exatamente essa chave. A porta não nasce com assinaturas sem quem as chame. |
 * | CA-13    | CT-809 | Nem o parâmetro nem o retorno da operação carregam nome de campo, código ou
 * |          | (b)    | termo do provedor — a cláusula de vocabulário da ADR-0001 vale para esta
 * |          |        | porta na íntegra, ainda que ela não esteja no roster de cinco operações. |
 * | CA-13    | CT-809 | `src/index.ts` publica **símbolo a símbolo**: nenhuma linha `export *`, e a
 * |          | (c)    | superfície é **exatamente** o inventário declarado — igualdade de conjunto
 * |          |        | com contagem, mais a ausência dos que o barril declara não publicar. |
 * | CA-13    | CT-809 | Nenhum fonte de `src/` alcança a camada de dados — nem por `@sysloc/db` (ou
 * |          | (d)    | subpath dele), nem por caminho relativo que resolva dentro de
 * |          |        | `packages/db` —, e os pacotes do monorepo que o domínio importa são
 * |          |        | **exatamente** `@sysloc/contracts` e `@sysloc/shared` (ADR-0025). |
 * | CA-13    | CT-834 | Nenhum termo do provedor entra no vocabulário publicado — nem nas chaves dos
 * |          |        | tipos declarados por este pacote, nem nas chaves dos esquemas de
 * |          |        | `packages/contracts/src/integracao-bancaria.ts`, nem nos literais dos dois
 * |          |        | enums que ele publica. |
 * | CA-13    | CT-834 | O nome `AdaptadorCobrancaBancaria` — o que a ADR-0001 reserva — nomeia
 * |          | (b)    | **exatamente um** símbolo deste pacote, a porta de cobrança, declarada em
 * |          |        | `porta-de-cobranca.ts` e publicada pelo barril. |
 * | CA-20    | CT-933 | `AdaptadorCobrancaBancaria` declara **exatamente quatro** operações —
 * |          |        | `emitir`, `solicitarRevogacaoDeBoleto`, `confirmarRevogacaoDeBoleto` e
 * |          |        | `consultarSituacao` —, uma implementação de referência anotada com o tipo
 * |          |        | tem exatamente essas chaves, e nenhum nome de tipo, membro ou literal de
 * |          |        | união que atravessa a porta contém termo do provedor. |
 * | CA-14    | CT-835 | `MEIOS_DE_RECEBIMENTO` publica exatamente `['BOLETO','PIX']`, nesta ordem, e
 * |          |        | é **importado** de `@sysloc/contracts` — nunca redeclarado aqui, o que é
 * |          |        | provado por varredura de **ligação local** sobre o texto de `src/`. |
 * | CA-14    | CT-835 | O conjunto de operações sobre `PIX` é **vazio**: nenhum símbolo declarado ou
 * |          | (b)    | publicado por este pacote opera sobre ele. Pix é declarado, não
 * |          |        | implementado — e a lista vazia é o que separa *"declarado sem operação"* de
 * |          |        | *"bandeira desligada escondendo código pronto"*. |
 * | CA-21    | CT-991 | Nenhum termo do dialeto do provedor — os nove da fatia (i) mais os quatro
 * |          |        | que a notícia acrescentou — aparece em **posição de símbolo publicado**
 * |          |        | (nome de tipo, membro de tipo, nome de símbolo declarado ou literal de
 * |          |        | cadeia) nos **três módulos** que a fatia `webhook-e-carne` criou. E a
 * |          |        | varredura **não** alcança o acesso de propriedade sobre o corpo recebido,
 * |          |        | que é a fronteira de tradução — as duas metades são afirmadas por
 * |          |        | igualdade sobre um fonte de controle. (ADR-0001, ADR-0034) |
 *
 * Rastreabilidade: `CA-13 → CT-809, CT-834 (RN-10)` · `CA-14 → CT-835 (RN-11)` ·
 * `CA-20 → CT-933 (RN-15)` · `CA-21 → CT-991 (RN-18)`.
 *
 * ---------------------------------------------------------------------------
 * Estes casos são ESTÁTICOS, e a razão é que interface não existe em execução
 * ---------------------------------------------------------------------------
 *
 * O que se prova aqui é a forma da **superfície declarada**, e tipo de TypeScript some na emissão:
 * `Object.keys` do módulo compilado devolveria vazio hoje, e devolveria só os valores da T9 e da T10
 * amanhã. Por isso a enumeração é feita sobre o **texto** dos fontes de `src/`, com o extrator
 * exercido por controle positivo em todo caso onde ele decide o veredito — sem o controle, um
 * extrator que nunca acha nada aprovaria qualquer coisa (**AP-29**), que foi a única causa de
 * rejeição repetida da fatia anterior.
 *
 * A ligação com o **tipo real** não é abandonada: o CT-809 declara uma implementação de referência
 * anotada como `PortaDeIdentidadeBancaria`, de modo que a classe de defeito fica fechada dos dois
 * lados — uma operação nova **obrigatória** quebra a verificação de tipos da suíte nomeando o membro
 * ausente, e uma operação nova **opcional**, que a verificação de tipos aceitaria, reprova na
 * asserção sobre o texto nomeando o excedente.
 *
 * ⚠️ **A implementação de referência não é asserida contra si mesma**, e a distinção decide se o
 * caso prova alguma coisa. Comparar `Object.keys(portaDeReferencia)` com a lista escrita por extenso
 * poria as **duas** pontas sob autoria do teste: `Object.keys` de um literal fixo devolve o mesmo
 * arranjo em qualquer estado do código de produção, e a asserção não poderia falhar (**AP-29**). Por
 * isso o lado direito é `porta?.membros` — **lido do texto do fonte** —, o que costura a ponta de
 * tipo à ponta de texto: ela reprova sempre que o que o fonte declara divergir do que a anotação de
 * tipo aceita, inclusive quando alguém acrescenta a operação nova a `OPERACOES_DA_PORTA` para calar
 * a asserção vizinha, porque o literal está sob a anotação e não acompanha.
 *
 * ---------------------------------------------------------------------------
 * A barreira da ADR-0025 MIGROU: era resolução de módulo, hoje é o CT-809 (d)
 * ---------------------------------------------------------------------------
 *
 * Até a T9 da fatia (ii), *"o `src/` deste pacote não conhece a camada de dados"* era imposto por
 * **construção**: `@sysloc/db` não constava do manifesto, logo não havia vínculo em
 * `node_modules/`, e `import … from '@sysloc/db'` num fonte de `src/` sequer compilava. A T10
 * declarou `@sysloc/db` em `devDependencies` — a suíte do percurso do lote é provada contra **banco
 * real**, como a tech spec §19.2 exige — e **o pnpm não distingue `dependencies` de
 * `devDependencies` na resolução de módulo**: o vínculo passou a existir para o pacote inteiro, e
 * com ele o `src/` passou a resolver a camada de dados. Medido pelo Gate 2 com controle: a sonda
 * plantada aqui sai `exit 0` no `tsc`, e a **mesma** sonda em `packages/regua/src/` — pacote de
 * domínio que não declara `@sysloc/db` — sai `exit 1` com `TS2307`.
 *
 * ⚠️ **A exclusão de `../db` das `references` do `tsconfig.json` NÃO repõe a barreira** — a sonda
 * passou com ela no lugar. Quem impõe a propriedade a partir da T10 é o **CT-809 (d)**, e é por isso
 * que ele é asserção **estática**: a aresta que ele proíbe não existe em execução, ela existe no
 * texto do fonte. O que a ADR-0025 rejeita por extenso é o *"segundo caminho para o dado"* dentro do
 * domínio, e é exatamente esse caminho que a varredura nomeia se alguém o abrir.
 *
 * A varredura alcança as três formas de alcançar um módulo em ESM — `from '…'`, `import '…'` nu e
 * `import('…')` dinâmico —, e as duas maneiras de nomear a camada de dados: o **especificador de
 * pacote** (`@sysloc/db` e qualquer subpath) e o **caminho relativo** que resolva dentro de
 * `packages/db`, que é a forma pela qual os diretórios `test/` deste monorepo já se alcançam
 * (débito **D28 · F0/T5**). Ela vem acompanhada da **igualdade de conjunto** dos especificadores
 * `@sysloc/*` que `src/` importa: uma dependência de pacote nova reprova ali mesmo que a varredura
 * específica não a nomeasse.
 *
 * ---------------------------------------------------------------------------
 * O que a varredura de termos alcança, e o que ela deliberadamente NÃO alcança
 * ---------------------------------------------------------------------------
 *
 * Ela alcança o **vocabulário executável**: chaves de tipo, literais de enum e nomes de símbolo. Não
 * alcança prosa de comentário, e a exclusão é deliberada — o docblock de `porta-de-identidade.ts`
 * precisa citar `AdaptadorCobrancaBancaria` por escrito para registrar que o nome está reservado, e
 * uma varredura sobre texto corrido transformaria esse registro em reprovação.
 *
 * ⚠️ **Ela alcança NOMES, e nunca VALORES em execução.** Chave de tipo, literal de união e nome de
 * símbolo são o que ela examina; o **conteúdo** que um campo do tipo `string` venha a carregar em
 * execução está fora do alcance de qualquer asserção deste arquivo.
 *
 * O campo por onde texto arbitrário atravessava a porta — `ResultadoDaVerificacaoDeIdentidade.detalhe`
 * — **deixou de ser `string`**: ele é a união fechada `DetalheDaVerificacao`, derivada da declaração
 * única de `@sysloc/contracts`, e quem cobra a restrição é o compilador, não mais a prosa. Era o
 * débito **D27 · F4/T8**, fechado nesta fatia. O que continua fora de alcance, e por
 * decisão, é o `motivo` que o provedor informa: ele é **texto opaco** por exigência da RN-15, e nada
 * o interpreta — é justamente isso que torna um motivo desconhecido inócuo.
 *
 * Ela também **não** varre nome de símbolo contra os termos do provedor, e sim contra o nome
 * reservado. A distinção é da própria ADR-0001, que exige *"um adaptador por provedor"*: o adaptador
 * da T10 se chamará `criarAdaptadorSicoob` porque é ele que conhece o provedor. O que não pode
 * carregar o dialeto do banco é o que **atravessa** a porta — e é exatamente isso que o conjunto
 * varrido contra `TERMOS_DO_PROVEDOR` reúne.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESTADOS_DO_CERTIFICADO,
  esquemaDoCertificado,
  esquemaDoCertificadoNovo,
  esquemaDoResultadoDaVerificacao,
  MEIOS_DE_RECEBIMENTO,
} from '@sysloc/contracts';
import { describe, expect, it } from 'vitest';
import type { AdaptadorCobrancaBancaria } from '../src/porta-de-cobranca.ts';
import type { PortaDeIdentidadeBancaria } from '../src/porta-de-identidade.ts';
// A comparação de conjuntos subiu para a casa única do diretório com a T10 — ver o cabeçalho de
// `./conjuntos.ts` para o limiar de três que a fez sair daqui (débito **D29**).
import { diferencasDeConjunto } from './conjuntos.ts';

// ===========================================================================
// Listas escritas POR EXTENSO — nunca derivadas do artefato sob prova
// ===========================================================================

/**
 * A única operação que esta fatia exerce.
 *
 * Escrita à mão, e jamais derivada da própria interface: derivar poria o artefato sob prova nos dois
 * lados da igualdade, e a asserção passaria a não poder falhar.
 */
const OPERACOES_DA_PORTA = ['verificarIdentidade'] as const;

/**
 * As **quatro** operações da porta de cobrança, na ordem em que a interface as declara.
 *
 * Escritas à mão, e jamais derivadas da própria interface — derivar poria o artefato sob prova nos
 * dois lados da igualdade, e a asserção passaria a não poder falhar.
 *
 * ⚠️ **São quatro, e a `Decision` da ADR-0001 lista cinco.** A quinta — a obtenção da credencial de
 * acesso — acontece **dentro** do adaptador, por decisão escalada ao usuário em 2026-08-16 e
 * registrada na §21.1(1) do tech spec desta fatia e no cabeçalho de `porta-de-cobranca.ts`. Não
 * "corrija" esta lista para cinco: acrescentar a quinta aqui é reabrir um debate fechado, e a
 * igualdade de lista abaixo é justamente o que impede que ela apareça sem que ninguém decida.
 */
const OPERACOES_DA_PORTA_DE_COBRANCA = [
  'emitir',
  'solicitarRevogacaoDeBoleto',
  'confirmarRevogacaoDeBoleto',
  'consultarSituacao',
] as const;

/**
 * Os literais que as uniões fechadas do modelo canônico declaram, na ordem em que aparecem.
 *
 * Ela é a **âncora antivácuo** do extrator de literais: sem ela, *"nenhum literal carrega termo do
 * provedor"* seria satisfeito por um extrator que devolvesse `[]` — que é a forma clássica de uma
 * varredura aprovar tudo por não ter olhado (AP-29). Escrita por extenso pela mesma razão da lista
 * de operações acima.
 */
const LITERAIS_DO_MODELO = [
  'DA_COBRANCA',
  'DA_EMPRESA',
  'EM_ABERTO',
  'LIQUIDADO',
  'REVOGADO',
  'ESTORNADO',
] as const;

/** Os meios de recebimento que o produto declara (RN-11), na ordem publicada. */
const MEIOS_DECLARADOS = ['BOLETO', 'PIX'] as const;

/**
 * O nome do enum que este pacote **consome e não redeclara** (ADR-0016).
 *
 * A igualdade do enum contra `MEIOS_DECLARADOS` prova o **conteúdo**, e ela não alcança a metade que
 * importa aqui: ela assere o objeto **importado** de `@sysloc/contracts` e, por construção, ficaria
 * verde ao lado de uma redeclaração local que sombreasse o símbolo em `src/`. Quem prova a segunda
 * metade é a varredura de ligação local sobre o texto dos fontes — a única das duas que **só este
 * pacote** pode fazer.
 */
const NOME_DO_ENUM_IMPORTADO = 'MEIOS_DE_RECEBIMENTO';

/**
 * Os termos que não podem cruzar a porta — **nove**, e o piso exigido é oito.
 *
 * Os nove são vocabulário do provedor: o nome dele em duas grafias, os campos que o oráculo do
 * sistema antigo usa (`nossoNumero`, `seuNumero`, `numeroContrato`, `codigoBeneficiario`), os dois
 * parâmetros do fluxo de credencial de acesso (`client_id`, `scope`) e o `pagador` do payload de
 * emissão.
 *
 * ⚠️ **`AdaptadorCobrancaBancaria` SAIU da lista, e a saída é a condição que o próprio docblock de
 * `porta-de-identidade.ts` escreveu.** Ele nunca foi termo do provedor: era o **nome reservado** pela
 * ADR-0001 para a porta das operações de cobrança, que a fatia (i) protegeu para que esta o criasse.
 * Esta fatia o **usa** (`porta-de-cobranca.ts`), e quem o protege agora é o CT-933, que afirma **qual**
 * símbolo o carrega — proteção mais forte que a anterior, e não mais fraca: a de antes só reprovava o
 * uso, esta reprova também o nome inventado no lugar dele.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista encolheu de dez para nove porque o código de produção passou a
 * usar legitimamente o décimo item, que a fatia anterior escreveu como **reservado até esta fatia**.
 * Nenhum termo do provedor saiu, e o piso de oito continua exato — a asserção de conjunto do CT-933
 * substitui a que se tornou impossível, sem afrouxá-la.
 *
 * ⚠️ **A contagem foi MEDIDA, e a prosa anterior errava por um**: ela dizia *"O nono é
 * `AdaptadorCobrancaBancaria`"* enquanto ele era o **décimo** — oito termos do provedor mais
 * `pagador` dão nove, e o nome reservado vinha depois. A §21.1(4) do tech spec desta fatia e a §3.4
 * da task dizem *décimo*, e é o que a contagem confirma.
 *
 * ⚠️ `BOLETO` **não** entra nesta lista, e a ausência é deliberada: ele é vocabulário do produto
 * (RN-11), publicado por `@sysloc/contracts`, e incluí-lo faria a varredura reprovar o próprio
 * vocabulário canônico que ela existe para proteger.
 */
const TERMOS_DO_PROVEDOR = [
  'sicoob',
  'bancoob',
  'nossoNumero',
  'seuNumero',
  'numeroContrato',
  'codigoBeneficiario',
  'client_id',
  'scope',
  'pagador',
] as const;

/**
 * Os **quatro** nomes que a notícia do provedor acrescenta ao dialeto (fatia `webhook-e-carne`).
 *
 * Os três primeiros são campos do corpo que chega — o identificador da baixa, o pedido de validação
 * do endereço e o identificador que o provedor dá ao próprio aviso —, e o quarto é a **classificação
 * dele**, que a RN-18 proíbe de virar regra do produto. Escritos por extenso, e jamais derivados do
 * fonte que eles varrem.
 *
 * ⚠️ **`webhook` sozinho NÃO entra**, e a ausência é deliberada: é o nome da própria fatia
 * (`webhook-e-carne`), citado em dezenas de docblocks e no nome da migração. Incluí-lo faria a
 * varredura reprovar a documentação que a decisão exige — o mesmo erro que `semComentarios` existe
 * para não cometer, só que por outra porta.
 */
const TERMOS_DO_DIALETO_DA_NOTICIA = [
  'numeroIdentificadorBaixa',
  'validacaoWebhook',
  'idWebhook',
  'tipoMovimento',
  // Os três da família `/webhooks`, medidos contra a API real em 2026-08-21. Entram ANTES da fatia
  // que os vai encontrar (`ativacao-do-webhook/v1`), e a antecipação é deliberada: a lista é o que
  // a varredura procura, e um termo que só entra junto com o código que o usa nunca chega a provar
  // nada — ele nasce já contornado. Aqui eles vigiam a superfície desde antes de existir porta.
  'codigoTipoMovimento',
  'codigoPeriodoMovimento',
  'codigoSituacao',
] as const;

/** O dialeto inteiro — os nove da fatia (i) mais os quatro da notícia. */
const TERMOS_DO_DIALETO = [...TERMOS_DO_PROVEDOR, ...TERMOS_DO_DIALETO_DA_NOTICIA] as const;

/**
 * Os três termos do dialeto que o módulo do tratamento **lê** do corpo recebido — a fronteira de
 * tradução, que é exatamente onde eles TÊM de viver.
 *
 * Eles aparecem no fonte como **acesso de propriedade** sobre o recebido, e em nenhuma outra posição.
 * A varredura do CT-991 alcança **símbolo publicado** — nome de tipo, membro de tipo, nome de símbolo
 * declarado e literal de cadeia —, e nenhuma dessas quatro posições contém acesso de propriedade. É
 * a discriminação que separa *"o dialeto morreu na fronteira"* de *"a varredura não olhou"*, e ela é
 * afirmada por extenso no controle abaixo.
 */
const TERMOS_NA_FRONTEIRA_DE_TRADUCAO = ['nossoNumero', 'seuNumero', 'tipoMovimento'] as const;

/**
 * Os **três módulos** que a fatia `webhook-e-carne` acrescentou, e sobre cujo TEXTO o CT-991 incide.
 *
 * Dois deles vivem em pacotes irmãos, e são alcançados por **leitura de arquivo** — nunca por
 * `import`. A distinção importa: ler o texto não cria dependência de módulo alguma, e por isso este
 * caso não abre a fronteira que o `CT-809 (d)` fecha logo acima.
 *
 * Cada entrada traz, escritos à mão, **três símbolos do produto** que aquele módulo publica. Eles são
 * a âncora antivácuo do caso: *"nenhum termo do dialeto"* seria satisfeito por um extrator que
 * devolvesse `[]`, e é essa a forma clássica de uma varredura aprovar tudo por não ter olhado
 * (AP-29). Uma contagem mínima não bastaria — ela não diz de QUAL arquivo o vocabulário veio.
 */
const MODULOS_DA_FATIA = [
  {
    caminho: '../../contracts/src/cobranca-bancaria.ts',
    publica: ['TIPOS_DE_EVENTO_BANCARIO', 'ORIGENS_DO_EVENTO_BANCARIO', 'esquemaDoEventoBancario'],
  },
  {
    caminho: '../../db/src/notificacao-bancaria.ts',
    publica: [
      'registrarNotificacaoBancaria',
      'rotearNotificacaoBancaria',
      'NotificacaoBancariaPersistida',
    ],
  },
  {
    caminho: '../src/tratamento-de-notificacao.ts',
    publica: [
      'classificarNotificacaoBancaria',
      'ehReentregaDeEfeitoAplicado',
      'NotificacaoBancariaClassificada',
    ],
  },
] as const;

/**
 * Um fonte sintético com o dialeto plantado nas **quatro posições de símbolo publicado** — e, junto,
 * nas três posições que NÃO são publicação.
 *
 * As quatro plantadas são o controle positivo: nome de tipo (`AvisoSicoob`), membro de tipo
 * (`numeroIdentificadorBaixa`), nome de símbolo declarado (`idWebhook`) e literal de cadeia
 * (`'validacaoWebhook'`). As três não-plantadas são o eixo **negativo**, e sem elas o caso não
 * discriminaria a fronteira de tradução legítima do vazamento: o caminho de módulo, o comentário e o
 * **acesso de propriedade** sobre o corpo recebido.
 */
const FONTE_DE_CONTROLE_COM_DIALETO_PUBLICADO = `
import { algo } from './seuNumero.js';
/** Um comentário que cita nossoNumero e tipoMovimento sem publicar coisa alguma. */
export interface AvisoSicoob {
  readonly numeroIdentificadorBaixa: string;
}
export const idWebhook = 990;
export type Classificacao = 'validacaoWebhook';
export function lerCorpo(dados: Record<string, unknown>): unknown {
  return dados.nossoNumero ?? dados.seuNumero;
}
`;

/** O nome que a ADR-0001 reserva para a porta de cobrança — e que esta fatia finalmente usa. */
const NOME_RESERVADO = 'AdaptadorCobrancaBancaria';

/** O meio declarado sem operação — o que o CT-835 exige que nenhum símbolo consuma. */
const MEIO_SEM_OPERACAO = 'PIX';

/** O pacote da camada de dados — o que o `src/` deste domínio não pode alcançar (ADR-0025). */
const CAMADA_DE_DADOS = '@sysloc/db';

/**
 * O diretório do pacote da camada de dados, na forma como aparece num caminho resolvido.
 *
 * É o que faz a varredura alcançar a segunda maneira de chegar lá: o caminho **relativo**
 * (`../../db/src/…`), que não cita o nome do pacote e que a resolução do TypeScript aceita.
 */
const DIRETORIO_DA_CAMADA_DE_DADOS = '/packages/db/';

/**
 * Os pacotes do monorepo que o domínio importa — **exatamente** estes dois.
 *
 * Escritos por extenso, e jamais derivados dos fontes: derivar poria o artefato sob prova nos dois
 * lados da igualdade. É a metade **positiva** da barreira que a T10 precisou repor — a varredura
 * abaixo nomeia a camada de dados quando ela aparece, e esta lista reprova **qualquer** pacote novo,
 * inclusive um que alcance o dado por outro nome.
 */
const PACOTES_DO_DOMINIO = ['@sysloc/contracts', '@sysloc/shared'] as const;

/**
 * Um fonte sintético que alcança a camada de dados pelas duas maneiras — o defeito que o CT-809 (d)
 * proíbe.
 *
 * Ele carrega junto o que uma varredura ingênua confundiria: o import legítimo de um pacote
 * permitido, a citação do nome em **comentário** (que não é alcance), e um import relativo **dentro**
 * do próprio pacote. O que reprova é o especificador de módulo, não a menção ao nome.
 */
const FONTE_DE_CONTROLE_COM_ALCANCE_AOS_DADOS = `
import { esquemaDoCertificado } from '@sysloc/contracts';
/** Um comentário que cita @sysloc/db e ../../db/src/cobranca.js sem importar nada. */
import type { TrabalhoDoLote } from './emissao-em-lote.js';
import { abrirEmissaoEmLote } from '@sysloc/db';
import { bancoEfemero } from '../../db/test/banco-efemero.ts';
import '@sysloc/db/dist/cobranca.js';
const carregar = async () => import('@sysloc/db');
`;

/**
 * O inventário **completo** da superfície publicada por `src/index.ts` — os 44 símbolos, escritos
 * por extenso e jamais derivados do barril.
 *
 * ⚠️ **Eram 26 até a T9 da fatia (ii)**, que publicou a guarda de boletos: `criarGuardaDeBoletos` e
 * `GuardaDeBoletos`; **28 até a T10**, que publicou o percurso do lote — `executarEmissaoEmLote`,
 * `DesfechoDoLote` e `TrabalhoDoLote`; **31 até a T11**, que publicou o ato de reemissão —
 * `reemitirBoleto`, `TrabalhoDaReemissao`, `DesfechoDaReemissao`, `ErroDeReemissaoIncompleta` e os
 * **dois limites** da sondagem; e **37 até a T12**, que publicou a apuração da conferência —
 * `conferirCobrancas`, `TrabalhoDaConferencia`, `DesfechoDaConferencia` e `EfeitoDaConferencia`; e
 * **41 até a T4 da fatia (iii)**, que publicou o tratamento da notícia —
 * `classificarNotificacaoBancaria`, `ehReentregaDeEfeitoAplicado` e
 * `NotificacaoBancariaClassificada`. A contagem em prosa sobe **no mesmo diff** da constante, como
 * a `.claude/rules/ancoras-de-superficie.md` exige — número narrativo que fica para trás convida a
 * próxima task a "corrigir" a âncora executável para o valor errado.
 *
 * ⚠️ **Ela deixou de ser "os símbolos desta task", e a mudança é de natureza, não de tamanho.** A
 * forma anterior afirmava apenas que os quatro símbolos da fatia (i) *estavam* na superfície, o que
 * a `.claude/rules/ancoras-de-superficie.md` nomeia como **contenção**: aprova qualquer
 * superconjunto, e portanto aprova tanto o símbolo que nasce sem ninguém decidir quanto os dez que
 * esta fatia acrescentou sem que nada os fixasse. A asserção do CT-809 (c) passou a ser **igualdade
 * de conjunto**, e é ela que obriga esta lista a valer pelo barril inteiro: símbolo novo sobe aqui
 * no **mesmo diff** que o publica, e símbolo que sai reprova por ausência.
 *
 * A ordem é a de leitura — a de `index.ts`, arquivo a arquivo —, e não a de comparação: quem compara
 * é `diferencasDeConjunto`, que nomeia excedentes e ausentes sem depender de ordenação.
 */
const SIMBOLOS_PUBLICADOS = [
  // adaptador-sicoob.ts
  'ConfiguracaoDoProvedorBancario',
  'criarAdaptadorSicoob',
  'DETALHE_ACEITE',
  'DETALHE_INDISPONIVEL',
  'DETALHE_NAO_INICIADO',
  'DETALHE_RECUSA_PELO_PAR',
  'DETALHE_TEMPO_ESGOTADO',
  'TETO_DO_APERTO_DE_MAO_MS',
  // conferencia.ts
  'DesfechoDaConferencia',
  'EfeitoDaConferencia',
  'TrabalhoDaConferencia',
  'conferirCobrancas',
  // emissao-em-lote.ts
  'DesfechoDoLote',
  'TrabalhoDoLote',
  'executarEmissaoEmLote',
  // guarda-de-boletos.ts
  'GuardaDeBoletos',
  'criarGuardaDeBoletos',
  // leitura-do-material.ts
  'MaterialLido',
  'ErroDeMaterialIlegivel',
  'ErroDeSenhaQueNaoAbre',
  'lerMaterial',
  // modelo-canonico.ts
  'AtoSobreBoleto',
  'BoletoEmitido',
  'ClasseDaFalha',
  'ConsultaDeSituacao',
  'DesfechoDaOperacao',
  'DetalheDaVerificacao',
  'IdentidadeDoProvedor',
  'IdentidadeParaVerificar',
  'LocatarioDaCobranca',
  'MeioDeRecebimento',
  'PedidoDeEmissao',
  'ResultadoDaVerificacaoDeIdentidade',
  'SituacaoConsultada',
  // as duas portas
  'AdaptadorCobrancaBancaria',
  'PortaDeIdentidadeBancaria',
  // reemissao.ts
  'DesfechoDaReemissao',
  'TrabalhoDaReemissao',
  'ErroDeReemissaoIncompleta',
  'INTERVALO_ENTRE_SONDAS_MS',
  'reemitirBoleto',
  'TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS',
  // tratamento-de-notificacao.ts
  'NotificacaoBancariaClassificada',
  'classificarNotificacaoBancaria',
  'ehReentregaDeEfeitoAplicado',
] as const;

/**
 * O que o pacote declara e **deliberadamente não publica** — a assimetria que o docblock do barril
 * escreve por extenso.
 *
 * São os quatro ramos de `SituacaoConsultada`, que quem consulta estreita pelo discriminador
 * `situacao` sem precisar nomeá-los, mais as duas bases de composição do modelo. A igualdade de
 * conjunto acima já reprovaria a publicação de qualquer um deles; esta lista existe para que a
 * reprovação **nomeie** o intruso — mesma disciplina, e mesmo molde, de `CHAVES_NAO_PUBLICADAS` em
 * `leitura-do-material.spec.ts`.
 *
 * ⚠️ **`ErroDeBoletoForaDaGuarda` entrou na lista com a T9 da fatia (ii)**, e a assimetria com as
 * duas classes de erro que a leitura do material **publica** é a que o barril escreve por extenso:
 * aquelas são desfechos de negócio que a borda distingue pelo tipo, esta é recusa de um código que
 * chega à guarda já validado — defeito de programação, que ninguém trata.
 *
 * ⚠️ **As seis portas do percurso do lote e os três tipos que elas carregam entraram com a T10**,
 * e o critério é o mesmo: quem as satisfaz é a borda da tarefa, montando um objeto literal que o
 * compilador confere **estruturalmente** contra `TrabalhoDoLote` — nenhum consumidor precisa
 * escrever os nomes delas. É a assimetria deliberada com `PortaDeCandidatas`/`PortaDeRegistro` no
 * barril de `@sysloc/regua`, onde quem satisfaz é `@sysloc/db` e **importa os tipos** para dizê-lo.
 *
 * ⚠️ **As quatro portas do ato de reemissão, os dois tipos que elas carregam e o TETO DURO entraram
 * com a T11.** As portas e os tipos, pelo critério acima. `TETO_DA_REEMISSAO_MS` entra por outra
 * razão, e ela é a que o barril escreve por extenso: os **dois** limites da sondagem são publicados
 * para que quem verifica meça o efeito deles sem reescrever o número, e o teto do ato composto **não
 * é** — publicá-lo convidaria quem chama a escolher outro, que é a segunda regra para o mesmo fato.
 * É a assimetria de `TETO_DA_OPERACAO_MS`/`TETO_DO_APERTO_DE_MAO_MS` no adaptador.
 *
 * ⚠️ **As cinco portas da apuração e os seis tipos que elas carregam entraram com a T12**, pelo
 * mesmo critério das anteriores: quem as satisfaz é a borda da tarefa, montando um objeto literal que
 * o compilador confere **estruturalmente** contra `TrabalhoDaConferencia`.
 *
 * ⚠️ **`DesfechoDaNotificacaoBancaria` entrou com a T4 da fatia (iii)**, e o critério dela é o
 * terceiro desta lista: ela é a união dos nove desfechos que o enum do banco declara, e existe no
 * domínio só para dar tipo ao parâmetro de `ehReentregaDeEfeitoAplicado`. Quem chama passa o valor
 * lido da camada de dados, sem escrever o nome — publicá-la daria um segundo lugar de onde declarar
 * o mesmo conjunto, que é o oposto do que a duplicação deliberada com o enum resolve.
 *
 * ⚠️ **`PortaDaRevogacaoGravada` aparece UMA vez nesta lista e é declarada por DOIS módulos** — o ato
 * de reemissão (T11) e a apuração da conferência (T12) —, com assinaturas diferentes. A lista é de
 * **nomes que não podem sair pelo barril**, e o nome é um só: repeti-lo faria a comparação por
 * conjunto ignorar a segunda cópia e a por lista reprovar sem defeito. A homonímia é deliberada e
 * está registrada no docblock de `../src/index.ts`.
 */
const SIMBOLOS_NAO_PUBLICADOS = [
  'AtoNoProvedor',
  'ComDocumento',
  'SituacaoEmAberto',
  'SituacaoLiquidada',
  'SituacaoRevogada',
  'SituacaoEstornada',
  'ErroDeBoletoForaDaGuarda',
  'BoletoParaConciliar',
  'CobrancaDoLote',
  'DadosDaCobrancaAEmitir',
  'PortaDaConclusaoDoLote',
  'PortaDaEmissaoGravada',
  'PortaDaInterrupcaoDoLote',
  'PortaDaRecusaGravada',
  'PortaDoIdentificador',
  'PortaDosDadosDaCobranca',
  'CobrancaAReemitir',
  'DetalhesDaReemissaoIncompleta',
  'PortaDaRevogacaoGravada',
  'PortaDeEspera',
  'PortaDoBoletoGravado',
  'PortaDosDadosDaEmissao',
  'TETO_DA_REEMISSAO_MS',
  'CobrancaAConferir',
  'ContagensDaConferencia',
  'DesfechoDaLiquidacao',
  'DesfechoDaRevogacao',
  'DesfechoDoEstorno',
  'LiquidacaoConsultada',
  'PortaDaConclusaoDaConferencia',
  'PortaDaLiquidacaoGravada',
  'PortaDoEstornoGravado',
  'PortaDoValorEsperado',
  'DesfechoDaNotificacaoBancaria',
] as const;

/**
 * As chaves de `esquemaDoCertificado`, na ordem em que a projeção as declara — inclusive as duas do
 * bloco aninhado de autoria.
 *
 * Ela é o **controle positivo** da coleta de chaves de esquema: uma coleta quebrada devolveria lista
 * vazia, e a varredura de termos aprovaria qualquer coisa por não ter olhado.
 */
const CHAVES_DO_CERTIFICADO_PUBLICADO = [
  'id',
  'titular',
  'validoDe',
  'validoAte',
  'impressaoDigital',
  'estado',
  'diasParaVencer',
  'registradoPor',
  'id',
  'nome',
  'registradoEm',
] as const;

/**
 * Um fonte sintético para exercer o extrator de tipos declarados.
 *
 * Ele carrega o que os fontes reais carregam e que uma implementação ingênua erraria: docblock entre
 * membros, membro `readonly`, membro opcional, assinatura de método quebrada em várias linhas com
 * nome de propriedade no meio da lista de parâmetros — que é a armadilha exata, porque
 * `identidade: X` numa linha solta parece um membro e não é — e um tipo vizinho declarado depois.
 */
const FONTE_DE_CONTROLE = `
/** Um comentário com a palavra interface e uma chave { falsa. */
export interface BlocoDeControle {
  /** Doc de membro. */
  readonly primeiro: string;
  segundo?: number;
  terceiro(
    parametro: AlgumTipo,
    outro: OutroTipo,
  ): Promise<void>;
}

export interface SegundoBlocoDeControle {
  unico: string;
}
`;

/**
 * Um fonte sintético para exercer o extrator de literais de união.
 *
 * Ele carrega o que os fontes reais carregam e que uma implementação ingênua confundiria: o caminho
 * de um `import`, que é literal e **não** é vocabulário; um literal em comentário; e a união em duas
 * linhas, que é como o modelo a escreve.
 */
const FONTE_DE_CONTROLE_COM_LITERAIS = `
import type { Coisa } from './modulo-de-controle.js';
/** Um comentário que cita 'LITERAL_DE_COMENTARIO' sem declarar nada. */
export type UniaoDeControle =
  | 'PRIMEIRO'
  | 'SEGUNDO';
export interface BlocoComLiteral {
  readonly marca: 'TERCEIRO';
}
`;

/** Um fonte sintético para exercer o detector de reexportação em massa. */
const FONTE_DE_CONTROLE_COM_ESTRELA = `
export * from './um.js';
export type { Coisa } from './dois.js';
export * as tres from './tres.js';
`;

/**
 * Um fonte sintético que **redeclara localmente** o enum importado — o defeito que o A5 proíbe.
 *
 * Ele carrega junto o import legítimo e uma menção em comentário, que é o que uma varredura ingênua
 * confundiria com a redeclaração: o que reprova é a **ligação**, não a citação do nome.
 */
const FONTE_DE_CONTROLE_COM_REDECLARACAO = `
import { MEIOS_DE_RECEBIMENTO } from '@sysloc/contracts';
/** Um comentário que cita const MEIOS_DE_RECEBIMENTO sem declarar nada. */
const MEIOS_DE_RECEBIMENTO = ['BOLETO', 'PIX', 'DINHEIRO'] as const;
`;

// ===========================================================================
// Extratores — cada um exercido por controle positivo antes de decidir veredito
// ===========================================================================

/** Um tipo declarado num fonte: o nome e os membros que ele expõe. */
interface TipoDeclarado {
  readonly nome: string;
  readonly membros: readonly string[];
}

/** Um fonte lido de `src/`, com o caminho relativo para que a reprovação nomeie o arquivo. */
interface FonteDoPacote {
  readonly arquivo: string;
  readonly texto: string;
}

/**
 * O diretório dos fontes, nas duas formas de que a varredura precisa.
 *
 * A forma de **URL** não é conveniência: é o que permite resolver um especificador relativo contra o
 * arquivo que o escreveu, e é assim que o CT-809 (d) enxerga a travessia por caminho — que não cita
 * o nome do pacote alcançado e escaparia de qualquer comparação por texto.
 */
const URL_DOS_FONTES = new URL('../src/', import.meta.url);
const DIRETORIO_DOS_FONTES = fileURLToPath(URL_DOS_FONTES);

/**
 * Remove comentários de bloco e de linha.
 *
 * É o que mantém a varredura sobre o **vocabulário executável**: o registro escrito em prosa — que o
 * cabeçalho de `porta-de-identidade.ts` precisa carregar — não é vocabulário, e reprová-lo puniria
 * exatamente a documentação que a decisão exige.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Substitui cada lista de parâmetros por `()`, preservando a natureza de método.
 *
 * Sem isso, `identidade: IdentidadeParaVerificar,` — uma linha de **parâmetro** — seria contada como
 * membro da interface, e o CT-809 acusaria uma operação a mais que não existe.
 */
function semListasDeParametros(texto: string): string {
  let saida = '';
  let profundidade = 0;
  for (const caractere of texto) {
    if (caractere === '(') {
      if (profundidade === 0) {
        saida += '()';
      }
      profundidade += 1;
    } else if (caractere === ')') {
      profundidade -= 1;
    } else if (profundidade === 0) {
      saida += caractere;
    }
  }
  return saida;
}

/** Os nomes de membro de um corpo de tipo, na ordem em que aparecem. */
function membrosDoCorpo(corpo: string): string[] {
  const membros: string[] = [];
  for (const linha of semListasDeParametros(corpo).split('\n')) {
    const achado = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*[(:<]/.exec(linha);
    const nome = achado?.[1];
    if (nome !== undefined) {
      membros.push(nome);
    }
  }
  return membros;
}

/**
 * Os tipos declarados num fonte, com os membros de cada um.
 *
 * O fim do bloco é achado por **contagem de chaves**, e não pela primeira `}`: um membro com tipo
 * objeto embutido fecharia o bloco cedo demais e esconderia todo o resto da declaração.
 */
function tiposDeclarados(fonteBruto: string): TipoDeclarado[] {
  const fonte = semComentarios(fonteBruto);
  const cabecalho = /\b(?:interface|type)\s+([A-Za-z_$][\w$]*)[^{;]*\{/g;
  const tipos: TipoDeclarado[] = [];

  let achado = cabecalho.exec(fonte);
  while (achado !== null) {
    const nome = achado[1];
    const inicio = achado.index + achado[0].length;
    let profundidade = 1;
    let posicao = inicio;
    while (posicao < fonte.length && profundidade > 0) {
      const caractere = fonte[posicao];
      if (caractere === '{') {
        profundidade += 1;
      } else if (caractere === '}') {
        profundidade -= 1;
      }
      posicao += 1;
    }

    if (nome !== undefined) {
      tipos.push({ nome, membros: membrosDoCorpo(fonte.slice(inicio, posicao - 1)) });
    }
    cabecalho.lastIndex = posicao;
    achado = cabecalho.exec(fonte);
  }

  return tipos;
}

/**
 * Os nomes de símbolo que um fonte declara ou reexporta.
 *
 * Alcança as duas formas que este monorepo usa: a declaração com `export` na frente e o bloco
 * `export { … } from`, com ou sem `type`. Num apelido (`X as Y`), o que vale é o nome **publicado**.
 *
 * ⚠️ **`async` entrou no molde na T12 da fatia `webhook-e-carne`, e a ausência era um buraco.** Sem
 * ele, `export async function <nome>` — que é a forma de **toda** função de domínio de
 * `packages/db/src/` — não era reconhecida como declaração, e um símbolo batizado com nome do
 * provedor atravessaria a varredura do CT-991 sem que nada acusasse. A lacuna foi medida ao escrever
 * a âncora antivácuo daquele caso: os três símbolos escritos à mão para
 * `notificacao-bancaria.ts` não eram alcançados. Acrescentá-lo **alarga** o que a varredura enxerga,
 * e por isso não afrouxa nenhum caso que já dependia desta função.
 */
function simbolosDeclarados(fonteBruto: string): string[] {
  const fonte = semComentarios(fonteBruto);
  const nomes: string[] = [];

  const declaracao =
    /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const achado of fonte.matchAll(declaracao)) {
    const nome = achado[1];
    if (nome !== undefined) {
      nomes.push(nome);
    }
  }

  const bloco = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
  for (const achado of fonte.matchAll(bloco)) {
    const corpo = achado[1] ?? '';
    for (const parte of corpo.split(',')) {
      const pedacos = parte.trim().split(/\s+as\s+/);
      const nome = pedacos[pedacos.length - 1]?.trim();
      if (nome !== undefined && /^[A-Za-z_$][\w$]*$/.test(nome)) {
        nomes.push(nome);
      }
    }
  }

  return nomes;
}

/**
 * Os literais de cadeia que um fonte **declara** — o vocabulário fechado das uniões.
 *
 * Ele completa a varredura de nomes numa direção que ela nunca alcançou: `ocorrenciasDeTermos` sobre
 * chaves e símbolos não vê o valor de uma união discriminada, e um estado batizado com sigla do
 * provedor entraria por ali sem que nada acusasse.
 *
 * Duas exclusões, ambas deliberadas: o **comentário**, pela mesma razão de `semComentarios` — o
 * cabeçalho da porta precisa citar o roster da ADR-0001 por escrito —, e a linha de `import`/reexport,
 * cujo literal é **caminho de módulo**, e não vocabulário.
 */
function literaisDeclarados(fonteBruto: string): string[] {
  return semComentarios(fonteBruto)
    .split('\n')
    .filter((linha) => !/\bfrom\s*'/.test(linha))
    .flatMap((linha) => [...linha.matchAll(/'([^']*)'/g)].map((achado) => achado[1] ?? ''));
}

/** As linhas de reexportação em massa de um fonte — o que a convenção proíbe. */
function reexportacoesEmMassa(fonteBruto: string): string[] {
  return semComentarios(fonteBruto)
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => /^export\s+\*/.test(linha));
}

/**
 * As **ligações locais** de um nome nos fontes dados, na forma `<nome> em <arquivo>`.
 *
 * Alcança as oito formas de ligação que declaram um nome de módulo — `const`, `let`, `var`,
 * `function`, `class`, `interface`, `type` e `enum` — e **não** alcança o `import`, que é justamente
 * o que o A5 exige que exista. Devolve **lista**, e não booleano: a reprovação nomeia o arquivo
 * ofensor em vez de dizer apenas que algo está errado.
 */
function ligacoesLocaisDe(nome: string, fontes: readonly FonteDoPacote[]): string[] {
  const ligacao = new RegExp(
    String.raw`\b(?:const|let|var|function|class|interface|type|enum)\s+${nome}\b`,
  );
  return fontes
    .filter((fonte) => ligacao.test(semComentarios(fonte.texto)))
    .map((fonte) => `${nome} em ${fonte.arquivo}`);
}

/**
 * Os **especificadores de módulo** que um fonte carrega, na ordem em que aparecem.
 *
 * Alcança as três formas com que ESM nomeia um módulo, e todas as três resolvem de verdade: o
 * `from '…'` (que cobre `import`, `import type` e o reexport), o `import '…'` nu — cujo efeito é o
 * módulo ser carregado sem ligar nome nenhum — e o `import('…')` dinâmico, que a verificação de
 * tipos aceita e nenhuma varredura por `from` enxergaria. Comentário não conta, pela mesma razão de
 * `semComentarios`: citar o nome de um pacote em prosa não o alcança.
 */
function especificadoresDeModulo(fonteBruto: string): string[] {
  const molde = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  return [...semComentarios(fonteBruto).matchAll(molde)].map((achado) => achado[1] ?? '');
}

/**
 * Se um especificador escrito em `<arquivo>` alcança a camada de dados.
 *
 * Duas maneiras, e a segunda é a que uma comparação por texto perderia: o **especificador de
 * pacote** — `@sysloc/db` e qualquer subpath dele, e nunca um pacote cujo nome apenas comece igual,
 * que é o que a barra separa da igualdade exata — e o **caminho relativo**, resolvido contra o
 * arquivo que o escreveu e conferido contra o diretório do pacote alcançado. É por caminho
 * relativo que os diretórios `test/` deste monorepo atravessam fronteira hoje (débito D28 · F0/T5),
 * de modo que a forma existe, é praticada e resolveria daqui também.
 */
function alcancaACamadaDeDados(especificador: string, arquivo: string): boolean {
  if (especificador === CAMADA_DE_DADOS || especificador.startsWith(`${CAMADA_DE_DADOS}/`)) {
    return true;
  }
  if (!especificador.startsWith('.')) {
    return false;
  }
  return new URL(especificador, new URL(arquivo, URL_DOS_FONTES)).pathname.includes(
    DIRETORIO_DA_CAMADA_DE_DADOS,
  );
}

/**
 * Os alcances à camada de dados nos fontes dados, na forma `<especificador> em <arquivo>`.
 *
 * Devolve **lista**, e não booleano, pela mesma disciplina de `ocorrenciasDeTermos`: a asserção é
 * `toEqual([])`, e a reprovação nomeia o especificador e o arquivo ofensor.
 */
function alcancesDaCamadaDeDados(fontes: readonly FonteDoPacote[]): string[] {
  return fontes.flatMap((fonte) =>
    especificadoresDeModulo(fonte.texto)
      .filter((especificador) => alcancaACamadaDeDados(especificador, fonte.arquivo))
      .map((especificador) => `${especificador} em ${fonte.arquivo}`),
  );
}

/** Os pacotes do monorepo que os fontes dados importam, sem repetição e em ordem determinística. */
function pacotesDoMonorepoImportados(fontes: readonly FonteDoPacote[]): string[] {
  const especificadores = fontes.flatMap((fonte) => especificadoresDeModulo(fonte.texto));
  const pacotes = especificadores
    .filter((especificador) => especificador.startsWith('@sysloc/'))
    .map((especificador) => especificador.split('/').slice(0, 2).join('/'));
  return [...new Set(pacotes)].sort();
}

/** Os fontes que citam um nome no vocabulário executável — o que separa ausência de cegueira. */
function citacoesDe(nome: string, fontes: readonly FonteDoPacote[]): string[] {
  return fontes
    .filter((fonte) => semComentarios(fonte.texto).includes(nome))
    .map((fonte) => fonte.arquivo);
}

/** As chaves de um esquema do contrato, incluindo as dos blocos aninhados, na ordem declarada. */
function chavesDoEsquema(esquema: unknown): string[] {
  const forma = (esquema as { shape?: Record<string, unknown> }).shape;
  if (forma === undefined) {
    return [];
  }

  const chaves: string[] = [];
  for (const [chave, valor] of Object.entries(forma)) {
    chaves.push(chave, ...chavesDoEsquema(valor));
  }
  return chaves;
}

/**
 * As ocorrências de cada termo dentro de cada nome, na forma `<termo> em <nome>`.
 *
 * Devolve **lista**, e não booleano, de propósito: a asserção é `toEqual([])`, e a reprovação nomeia
 * o termo e a chave ofensora em vez de dizer apenas que algo está errado.
 */
function ocorrenciasDeTermos(nomes: readonly string[], termos: readonly string[]): string[] {
  const ocorrencias: string[] = [];
  for (const termo of termos) {
    const agulha = termo.toLowerCase();
    for (const nome of nomes) {
      if (nome.toLowerCase().includes(agulha)) {
        ocorrencias.push(`${termo} em ${nome}`);
      }
    }
  }
  return ocorrencias;
}

/** Os fontes de `src/`, em ordem determinística de caminho. */
async function fontesDoPacote(): Promise<FonteDoPacote[]> {
  const entradas = await readdir(DIRETORIO_DOS_FONTES, { withFileTypes: true, recursive: true });
  const caminhos = entradas
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.ts'))
    .map((entrada) => join(entrada.parentPath, entrada.name))
    .sort();

  return Promise.all(
    caminhos.map(async (caminho) => ({
      arquivo: caminho.slice(DIRETORIO_DOS_FONTES.length),
      texto: await readFile(caminho, 'utf8'),
    })),
  );
}

/** O fonte da superfície publicada. */
async function fonteDoIndice(): Promise<string> {
  return readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
}

/** O fonte que declara a porta. */
async function fonteDaPorta(): Promise<string> {
  return readFile(new URL('../src/porta-de-identidade.ts', import.meta.url), 'utf8');
}

/** O fonte que declara a porta de cobrança — a das quatro operações. */
async function fonteDaPortaDeCobranca(): Promise<string> {
  return readFile(new URL('../src/porta-de-cobranca.ts', import.meta.url), 'utf8');
}

/**
 * O **vocabulário publicado** de um fonte: as quatro posições em que um nome do provedor viraria
 * símbolo do produto.
 *
 * Nome de tipo, membro de tipo, nome de símbolo declarado e literal de cadeia — e nada além disso. O
 * que fica **deliberadamente de fora** é o acesso de propriedade sobre o valor recebido, que é a
 * fronteira de tradução: é ali, e só ali, que o dialeto tem de aparecer.
 */
function vocabularioPublicadoDe(fonte: string): string[] {
  const tipos = tiposDeclarados(fonte);

  return [
    ...tipos.map((tipo) => tipo.nome),
    ...tipos.flatMap((tipo) => tipo.membros),
    ...simbolosDeclarados(fonte),
    ...literaisDeclarados(fonte),
  ];
}

/** O texto de um dos módulos da fatia, lido por caminho relativo a `test/`. */
async function fonteDoModuloDaFatia(caminho: string): Promise<string> {
  return readFile(new URL(caminho, import.meta.url), 'utf8');
}

/** O fonte do vocabulário canônico — o que atravessa as duas portas. */
async function fonteDoModelo(): Promise<string> {
  return readFile(new URL('../src/modelo-canonico.ts', import.meta.url), 'utf8');
}

// ===========================================================================
// CT-809 — a porta declara exatamente uma operação
// ===========================================================================

describe('CT-809 — a porta de identidade declara exatamente uma operação', () => {
  /**
   * A implementação de referência da porta.
   *
   * Ela existe para amarrar a asserção ao **tipo real**, e não apenas ao texto: se a interface ganhar
   * uma operação obrigatória, este literal deixa de satisfazê-la e a verificação de tipos da suíte
   * (`tsc -p tsconfig.test.json`, que o script `test` roda antes do Vitest) reprova nomeando o membro
   * ausente. A operação opcional — que a verificação de tipos aceitaria — é pega pela asserção sobre
   * o texto, logo abaixo.
   *
   * As chaves deste literal **só são asseridas contra o que o fonte declara**, nunca contra a lista
   * escrita por extenso: as duas pontas seriam autoradas aqui, e a igualdade não poderia falhar.
   */
  const portaDeReferencia: PortaDeIdentidadeBancaria = {
    verificarIdentidade: async () => ({
      aceito: true,
      verificadoEm: '2026-08-15T00:00:00.000Z',
      detalhe: null,
    }),
  };

  it('o extrator de membros acha o que existe num fonte de controle', () => {
    const tipos = tiposDeclarados(FONTE_DE_CONTROLE);

    // Controle positivo (AP-29): sem esta asserção, um extrator que devolvesse sempre `[]` faria
    // todas as asserções de ausência deste arquivo passarem por não terem olhado.
    expect(tipos.map((tipo) => tipo.nome)).toEqual(['BlocoDeControle', 'SegundoBlocoDeControle']);
    expect(tipos[0]?.membros).toEqual(['primeiro', 'segundo', 'terceiro']);
    expect(tipos[1]?.membros).toEqual(['unico']);
  });

  it('a interface declara exatamente as operações escritas por extenso', async () => {
    const porta = tiposDeclarados(await fonteDaPorta()).find(
      (tipo) => tipo.nome === 'PortaDeIdentidadeBancaria',
    );

    // Igualdade de lista: uma segunda operação reprova NOMEANDO o excedente, e uma operação
    // renomeada reprova nomeando as duas pontas.
    expect(porta?.membros).toEqual([...OPERACOES_DA_PORTA]);

    // Costura entre a ponta de TIPO e a ponta de TEXTO: o lado esquerdo é o que a anotação
    // `: PortaDeIdentidadeBancaria` obriga o literal a ter, e o lado direito é o que o fonte
    // declara. Divergir os dois é o único jeito de a interface mudar sem que alguma das duas
    // metades acuse — inclusive quando `OPERACOES_DA_PORTA` é afrouxada para calar a asserção
    // acima, porque o literal está sob a anotação de tipo e não acompanha o afrouxamento.
    expect(Object.keys(portaDeReferencia)).toEqual(porta?.membros);
  });

  it('nem o parâmetro nem o retorno da operação carregam termo do provedor', async () => {
    const fontes = await fontesDoPacote();
    const modelo = fontes.find((fonte) => fonte.arquivo === 'modelo-canonico.ts');
    const tiposQueAtravessam = tiposDeclarados(modelo?.texto ?? '').filter((tipo) =>
      ['IdentidadeParaVerificar', 'ResultadoDaVerificacaoDeIdentidade'].includes(tipo.nome),
    );

    // Âncora antivácuo: os dois tipos que atravessam a porta existem e foram lidos.
    expect(tiposQueAtravessam.map((tipo) => tipo.nome)).toEqual([
      'IdentidadeParaVerificar',
      'ResultadoDaVerificacaoDeIdentidade',
    ]);

    const nomesDaAssinatura = [
      ...OPERACOES_DA_PORTA,
      ...tiposQueAtravessam.map((tipo) => tipo.nome),
      ...tiposQueAtravessam.flatMap((tipo) => tipo.membros),
    ];

    expect(ocorrenciasDeTermos(nomesDaAssinatura, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it('a superfície é publicada símbolo a símbolo, sem reexportação em massa', async () => {
    // Controle positivo: o detector acha as duas formas de reexportação em massa.
    expect(reexportacoesEmMassa(FONTE_DE_CONTROLE_COM_ESTRELA)).toEqual([
      "export * from './um.js';",
      "export * as tres from './tres.js';",
    ]);

    // Controle antivácuo do COLETOR de símbolos — o que o detector de `export *` acima não cobre. A
    // igualdade de conjunto abaixo compara duas listas; se o coletor devolvesse `[]`, ela reprovaria
    // nomeando o inventário inteiro como ausente, mas um coletor que colhesse *só a primeira forma*
    // passaria despercebido. Por isso o controle exercita as DUAS que o barril usa: a declaração com
    // `export` na frente (o fonte de controle) e o bloco `export type { … } from` — que é como
    // `index.ts` publica quase tudo, e cujo vizinho `export *` não contribui nome algum.
    // ⚠️ A contagem NÃO se escreve aqui: `SIMBOLOS_PUBLICADOS` é a única declaração dela, e um
    // número repetido em prosa fica para trás na publicação seguinte — foi o que aconteceu na T12.
    expect(simbolosDeclarados(FONTE_DE_CONTROLE)).toEqual([
      'BlocoDeControle',
      'SegundoBlocoDeControle',
    ]);
    expect(simbolosDeclarados(FONTE_DE_CONTROLE_COM_ESTRELA)).toEqual(['Coisa']);

    const indice = await fonteDoIndice();
    expect(reexportacoesEmMassa(indice)).toEqual([]);

    const publicados = simbolosDeclarados(indice);

    // Igualdade de CONJUNTO contra o inventário escrito por extenso, e não contenção: reprova nas
    // DUAS direções — o símbolo que aparece sem ninguém decidir (`excedentes`) e o que some da
    // superfície (`ausentes`). A contagem vem junto porque conjunto não vê o nome publicado duas
    // vezes, que é mudança de superfície tanto quanto as outras duas.
    expect(publicados.length).toBe(SIMBOLOS_PUBLICADOS.length);
    expect(diferencasDeConjunto(publicados, SIMBOLOS_PUBLICADOS)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // A assimetria que o docblock do barril declara: os quatro ramos de `SituacaoConsultada` e as
    // duas bases de composição do modelo NÃO saem. A igualdade acima já os reprovaria como
    // excedentes; esta asserção é a que faz a reprovação nomeá-los.
    expect(SIMBOLOS_NAO_PUBLICADOS.filter((simbolo) => publicados.includes(simbolo))).toEqual([]);
  });

  /**
   * CT-809 (d) — a barreira que migrou.
   *
   * Ela **não** é redundante com a resolução de módulo: a resolução deixou de barrar coisa alguma
   * quando `@sysloc/db` entrou em `devDependencies` (ver a seção do cabeçalho). Este caso é a rede
   * que o P4 do Protocolo Antirregressão exige quando uma garantia muda de forma — sem ele, a
   * propriedade central da ADR-0025 para este pacote passaria a depender de disciplina de quem
   * escreve, que é precisamente o que aquela ADR rejeita ao recusar *"um segundo caminho para o
   * dado"* dentro do domínio.
   */
  it('nenhum fonte de src/ alcança a camada de dados', async () => {
    // Controle positivo (AP-29): a MESMA varredura, sobre um fonte que alcança a camada de dados
    // pelas duas maneiras e nas três formas de ESM, devolve os quatro alcances — item a item, e na
    // ordem em que aparecem. Sem ele, a lista vazia abaixo seria indistinguível de uma varredura
    // que não olhou para nada. As três iscas do fonte de controle ficam de fora: o pacote
    // permitido, o import relativo interno e a citação do nome em comentário.
    expect(
      alcancesDaCamadaDeDados([
        { arquivo: 'controle.ts', texto: FONTE_DE_CONTROLE_COM_ALCANCE_AOS_DADOS },
      ]),
    ).toEqual([
      `${CAMADA_DE_DADOS} em controle.ts`,
      '../../db/test/banco-efemero.ts em controle.ts',
      `${CAMADA_DE_DADOS}/dist/cobranca.js em controle.ts`,
      `${CAMADA_DE_DADOS} em controle.ts`,
    ]);

    const fontes = await fontesDoPacote();

    // Âncora antivácuo: os fontes existem e declaram especificadores de módulo — sem ela, um
    // diretório vazio ou um extrator quebrado satisfaria as duas asserções abaixo por não ter
    // olhado.
    expect(fontes.length).toBeGreaterThanOrEqual(3);
    expect(fontes.flatMap((fonte) => especificadoresDeModulo(fonte.texto)).length).toBeGreaterThan(
      fontes.length,
    );

    // A asserção que NOMEIA o ofensor, e por isso vem primeiro: o alcance à camada de dados, seja
    // pelo especificador de pacote, seja por caminho relativo que resolva dentro de `packages/db`.
    // A ordem é diagnóstico — a igualdade abaixo também reprovaria, mas dizendo apenas que um
    // conjunto ganhou um item, sem o arquivo nem a forma do alcance.
    expect(alcancesDaCamadaDeDados(fontes)).toEqual([]);

    // A metade POSITIVA da barreira: igualdade de conjunto sobre os pacotes do monorepo que o
    // domínio importa. Reprova nas duas direções, e alcança até a dependência nova que chegasse ao
    // dado por outro nome — o que a varredura específica, por definição, não veria.
    expect(pacotesDoMonorepoImportados(fontes)).toEqual([...PACOTES_DO_DOMINIO]);
  });
});

// ===========================================================================
// CT-834 — nenhum termo do provedor no vocabulário publicado
// ===========================================================================

describe('CT-834 — nenhum termo do provedor entra no vocabulário publicado', () => {
  it('a lista de termos tem o piso declarado e a varredura acha cada um deles', () => {
    expect(TERMOS_DO_PROVEDOR.length).toBeGreaterThanOrEqual(8);

    // Controle positivo (AP-29): um objeto sintético cuja chave é cada termo, submetido à MESMA
    // função de varredura, devolve a lista inteira. Sem ele, um detector que nunca acha nada
    // aprovaria qualquer vocabulário.
    const objetoDeControle = Object.fromEntries(TERMOS_DO_PROVEDOR.map((termo) => [termo, true]));

    expect(ocorrenciasDeTermos(Object.keys(objetoDeControle), TERMOS_DO_PROVEDOR)).toEqual(
      TERMOS_DO_PROVEDOR.map((termo) => `${termo} em ${termo}`),
    );
  });

  it('as chaves dos esquemas do contrato não carregam termo do provedor', () => {
    const chavesDoCertificado = chavesDoEsquema(esquemaDoCertificado);

    // Controle positivo da coleta de chaves: ela devolve as chaves reais da projeção publicada,
    // inclusive as do bloco aninhado de autoria. Coleta quebrada devolveria `[]`.
    expect(chavesDoCertificado).toEqual([...CHAVES_DO_CERTIFICADO_PUBLICADO]);

    const vocabularioDoContrato = [
      ...chavesDoEsquema(esquemaDoCertificadoNovo),
      ...chavesDoCertificado,
      ...chavesDoEsquema(esquemaDoResultadoDaVerificacao),
      ...MEIOS_DE_RECEBIMENTO,
      ...ESTADOS_DO_CERTIFICADO,
    ];

    expect(ocorrenciasDeTermos(vocabularioDoContrato, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it('as chaves dos tipos declarados por este pacote não carregam termo do provedor', async () => {
    const fontes = await fontesDoPacote();

    // Âncora antivácuo: o pacote tem fontes, e eles declaram tipos.
    expect(fontes.length).toBeGreaterThanOrEqual(3);

    const tipos = fontes.flatMap((fonte) => tiposDeclarados(fonte.texto));
    expect(tipos.length).toBeGreaterThanOrEqual(2);

    const vocabularioDoPacote = [
      ...tipos.map((tipo) => tipo.nome),
      ...tipos.flatMap((tipo) => tipo.membros),
    ];

    expect(ocorrenciasDeTermos(vocabularioDoPacote, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  /**
   * SUT_IS_CORRECT_BECAUSE: o caso anterior afirmava que **nenhum** símbolo deste pacote usava o
   * nome reservado, e ele era certo enquanto a porta de cobrança não existia — o docblock de
   * `porta-de-identidade.ts` declarava, por escrito, que o nome ficava reservado *"para a fatia
   * (ii)"*, que é esta. Cumprida a condição de saída, a asserção de ausência tornou-se impossível de
   * satisfazer sem contrariar a decisão. Ela **não foi removida nem afrouxada**: virou igualdade de
   * lista sobre **qual** símbolo o carrega, o que reprova as duas direções — o nome usado por um
   * segundo símbolo, e o nome trocado por outro na porta que a ADR-0001 nomeia.
   */
  it('o nome que a ADR-0001 reserva nomeia exatamente a porta de cobrança', async () => {
    const fontes = await fontesDoPacote();
    const simbolos = fontes.flatMap((fonte) => simbolosDeclarados(fonte.texto));

    // Âncora antivácuo: a superfície publicada foi efetivamente lida dos fontes.
    expect(SIMBOLOS_PUBLICADOS.filter((simbolo) => !simbolos.includes(simbolo))).toEqual([]);

    // Igualdade de lista sobre os nomes DISTINTOS que carregam o termo: exatamente um, e é o
    // próprio nome reservado. Um segundo portador — `AdaptadorCobrancaBancariaSicoob`, por exemplo —
    // reprova nomeando o excedente, e o nome trocado na porta reprova por ausência.
    //
    // O `Set` é o que separa *quantos símbolos o carregam* de *quantas vezes ele é exportado*:
    // `simbolosDeclarados` colhe as duas formas de exportação, e o mesmo nome aparece na declaração
    // da porta e no bloco do barril. O que se afirma aqui é o primeiro, e só ele.
    expect([...new Set(ocorrenciasDeTermos(simbolos, [NOME_RESERVADO]))]).toEqual([
      `${NOME_RESERVADO} em ${NOME_RESERVADO}`,
    ]);

    // E ele é declarado onde a ADR o quer: no fonte da porta, publicado pelo barril e **consumido
    // pelo adaptador**, que é quem diz satisfazê-la (ADR-0025 — a dependência aponta do adaptador
    // para o domínio, e não o contrário). A citação em comentário do cabeçalho de
    // `porta-de-identidade.ts` não conta — é a ligação que vale.
    //
    // SUT_IS_CORRECT_BECAUSE: a lista de dois arquivos era certa enquanto nenhuma implementação
    // satisfazia a porta de cobrança — a fatia (i) a declarou sem adaptador, por decisão escrita.
    // A T8 da fatia (ii) entrega a implementação, e satisfazer uma porta em TypeScript é importar o
    // tipo dela para anotar o que se devolve: sem a citação em `adaptador-sicoob.ts`, as quatro
    // operações não estariam anotadas com o tipo da porta, que é o que o §4 da task exige e o que
    // faz o compilador cobrar assinatura, retorno e membro ausente. A asserção **não foi afrouxada**:
    // continua igualdade de lista, e reprova nas duas direções — um arquivo a mais citando o nome
    // reprova como excedente, e o adaptador deixando de citá-lo reprova por ausência.
    //
    // SUT_IS_CORRECT_BECAUSE: a lista de três arquivos era certa enquanto nenhum percurso de domínio
    // **consumia** a porta. A T10 entrega o primeiro — `executarEmissaoEmLote` a recebe por
    // parâmetro, dentro de `TrabalhoDoLote`, que é exatamente o que a ADR-0025 manda (*"a porta chega
    // a quem a usa por parâmetro, nunca por import"* de módulo concreto). Anotar o campo com o tipo da
    // porta é a forma de dizê-lo em TypeScript: sem a citação, o percurso aceitaria qualquer objeto e
    // o compilador deixaria de cobrar as quatro operações. A asserção continua igualdade de lista.
    //
    // SUT_IS_CORRECT_BECAUSE: a lista de quatro arquivos era certa enquanto o percurso do lote era o
    // único consumidor da porta no domínio. A T11 entrega o segundo — `reemitirBoleto` recebe a porta
    // por parâmetro, dentro de `TrabalhoDaReemissao`, e é ela que compõe as **três** operações do ato
    // (pedir a revogação, confirmá-la e emitir). Anotar o campo com o tipo da porta é o que faz o
    // compilador cobrar a assinatura de cada uma; sem a citação, o ato aceitaria qualquer objeto. A
    // asserção **não foi afrouxada**: continua igualdade de lista, e reprova nas duas direções — um
    // arquivo a mais citando o nome reprova como excedente, e a reemissão deixando de citá-lo reprova
    // por ausência.
    //
    // SUT_IS_CORRECT_BECAUSE: a lista de cinco arquivos era certa enquanto o lote e a reemissão eram
    // os únicos percursos de domínio a consumir a porta. A T12 entrega o terceiro —
    // `conferirCobrancas` recebe a porta por parâmetro, dentro de `TrabalhoDaConferencia`, e é ela
    // que exerce `consultarSituacao`, a quarta operação, que nenhum dos dois anteriores chama.
    // Anotar o campo com o tipo da porta é o que faz o compilador cobrar a assinatura; sem a citação,
    // a apuração aceitaria qualquer objeto. A asserção **não foi afrouxada**: continua igualdade de
    // lista, e reprova nas duas direções — um arquivo a mais citando o nome reprova como excedente, e
    // a conferência deixando de citá-lo reprova por ausência.
    expect(citacoesDe(NOME_RESERVADO, fontes)).toEqual([
      'adaptador-sicoob.ts',
      'conferencia.ts',
      'emissao-em-lote.ts',
      'index.ts',
      'porta-de-cobranca.ts',
      'reemissao.ts',
    ]);
  });
});

// ===========================================================================
// CT-933 — a porta de cobrança declara exatamente as quatro operações
// ===========================================================================

describe('CT-933 — a porta de cobrança declara quatro operações, e nenhuma carrega termo do provedor', () => {
  /** O motivo que a implementação de referência devolve — texto do teste, e de mais nada. */
  const MOTIVO_DE_REFERENCIA = 'implementação de referência';

  /**
   * A implementação de referência da porta de cobrança.
   *
   * Ela existe pela mesma razão do literal do CT-809, e com a mesma disciplina: amarra a asserção ao
   * **tipo real**, e não apenas ao texto. Uma quinta operação **obrigatória** faz este literal deixar
   * de satisfazer a anotação, e a verificação de tipos da suíte (`tsc -p tsconfig.test.json`, que o
   * script `test` roda antes do Vitest) reprova nomeando o membro ausente; uma quinta operação
   * **opcional**, que a verificação de tipos aceitaria, reprova na asserção sobre o texto.
   *
   * ⚠️ As chaves deste literal **só são asseridas contra o que o fonte declara**, nunca contra a
   * lista escrita por extenso: as duas pontas seriam autoradas aqui, e a igualdade não poderia
   * falhar (AP-29).
   */
  const portaDeCobrancaDeReferencia: AdaptadorCobrancaBancaria = {
    emitir: async () => ({ aceito: false, classe: 'DA_COBRANCA', motivo: MOTIVO_DE_REFERENCIA }),
    solicitarRevogacaoDeBoleto: async () => ({
      aceito: false,
      classe: 'DA_COBRANCA',
      motivo: MOTIVO_DE_REFERENCIA,
    }),
    confirmarRevogacaoDeBoleto: async () => ({ aceito: true, valor: false }),
    consultarSituacao: async () => ({
      aceito: true,
      valor: { situacao: 'EM_ABERTO', documento: null },
    }),
  };

  it('o extrator de membros acha o que existe num fonte de controle', () => {
    const tipos = tiposDeclarados(FONTE_DE_CONTROLE);

    // Controle positivo (AP-29): o extrator que decide o veredito abaixo é exercido contra um fonte
    // cujo conteúdo é conhecido. Sem esta asserção, um extrator que devolvesse sempre `[]` faria a
    // igualdade de lista da porta reprovar por engano — ou, pior, aprovar uma porta vazia.
    expect(tipos.map((tipo) => tipo.nome)).toEqual(['BlocoDeControle', 'SegundoBlocoDeControle']);
    expect(tipos[0]?.membros).toEqual(['primeiro', 'segundo', 'terceiro']);
    expect(tipos[1]?.membros).toEqual(['unico']);
  });

  it('a interface declara exatamente as quatro operações escritas por extenso', async () => {
    const porta = tiposDeclarados(await fonteDaPortaDeCobranca()).find(
      (tipo) => tipo.nome === NOME_RESERVADO,
    );

    // Igualdade de lista: a quinta operação — `obterToken`, que a ADR-0001 lista e esta porta
    // deliberadamente não declara — reprova NOMEANDO o excedente; uma operação renomeada reprova
    // nomeando as duas pontas; e a ordem é conteúdo, porque é a que a interface publica.
    expect(porta?.membros).toEqual([...OPERACOES_DA_PORTA_DE_COBRANCA]);

    // Costura entre a ponta de TIPO e a ponta de TEXTO: o lado esquerdo é o que a anotação
    // `: AdaptadorCobrancaBancaria` obriga o literal a ter, e o lado direito é o que o fonte
    // declara. Divergir os dois é o único jeito de a interface mudar sem que alguma das duas
    // metades acuse — inclusive quando `OPERACOES_DA_PORTA_DE_COBRANCA` é afrouxada para calar a
    // asserção acima, porque o literal está sob a anotação de tipo e não acompanha o afrouxamento.
    expect(Object.keys(portaDeCobrancaDeReferencia)).toEqual(porta?.membros);
  });

  it('nenhum nome, membro ou literal que atravessa a porta carrega termo do provedor', async () => {
    const modelo = await fonteDoModelo();
    const porta = await fonteDaPortaDeCobranca();

    // Controle positivo (AP-29) do extrator de literais: a MESMA função, sobre um fonte cujos
    // literais são conhecidos, devolve os três — e deixa de fora o caminho do `import` e o literal
    // que só existe em comentário.
    expect(literaisDeclarados(FONTE_DE_CONTROLE_COM_LITERAIS)).toEqual([
      'PRIMEIRO',
      'SEGUNDO',
      'TERCEIRO',
    ]);

    // Âncora antivácuo: os literais das uniões fechadas foram efetivamente lidos, e são exatamente
    // os declarados por extenso. Um estado novo entra aqui antes de entrar na varredura.
    expect(literaisDeclarados(modelo)).toEqual([...LITERAIS_DO_MODELO]);

    const tiposQueAtravessam = [...tiposDeclarados(modelo), ...tiposDeclarados(porta)];

    // Âncora antivácuo: a porta e o vocabulário dela existem e foram lidos.
    expect(tiposQueAtravessam.map((tipo) => tipo.nome)).toContain(NOME_RESERVADO);
    expect(tiposQueAtravessam.length).toBeGreaterThanOrEqual(OPERACOES_DA_PORTA_DE_COBRANCA.length);

    const nomesDaAssinatura = [
      ...OPERACOES_DA_PORTA_DE_COBRANCA,
      ...tiposQueAtravessam.map((tipo) => tipo.nome),
      ...tiposQueAtravessam.flatMap((tipo) => tipo.membros),
      ...literaisDeclarados(modelo),
      ...literaisDeclarados(porta),
    ];

    // Controle positivo (AP-29), o companheiro negativo deste caso: um objeto sintético cuja chave é
    // cada termo, submetido à MESMA função de varredura, devolve a lista inteira, item a item. Sem
    // ele, a lista vazia abaixo seria indistinguível de uma varredura que não olhou para nada.
    const objetoDeControle = Object.fromEntries(TERMOS_DO_PROVEDOR.map((termo) => [termo, true]));

    expect(ocorrenciasDeTermos(Object.keys(objetoDeControle), TERMOS_DO_PROVEDOR)).toEqual(
      TERMOS_DO_PROVEDOR.map((termo) => `${termo} em ${termo}`),
    );

    expect(ocorrenciasDeTermos(nomesDaAssinatura, TERMOS_DO_PROVEDOR)).toEqual([]);
  });
});

// ===========================================================================
// CT-835 — meio de recebimento: boleto e pix, e pix sem operação
// ===========================================================================

describe('CT-835 — o meio de recebimento é declarado, e o pix não tem operação', () => {
  it('o enum publica exatamente os meios declarados, na ordem publicada', () => {
    // Igualdade de conjunto E de ordem, contra a lista escrita por extenso: o enum é importado de
    // `@sysloc/contracts`, que é a fonte única (ADR-0016), e nunca redeclarado neste pacote.
    expect([...MEIOS_DE_RECEBIMENTO]).toEqual([...MEIOS_DECLARADOS]);
  });

  it('o enum vem do contrato, e nenhum fonte deste pacote o redeclara', async () => {
    const fontes = await fontesDoPacote();

    // Controle positivo (AP-29): a MESMA função, sobre um fonte que redeclara o nome, acha a
    // ligação e nomeia o arquivo. O fonte de controle cita o nome também no `import` e num
    // comentário, e nenhum dos dois conta — é a ligação que reprova, não a citação.
    expect(
      ligacoesLocaisDe(NOME_DO_ENUM_IMPORTADO, [
        { arquivo: 'controle.ts', texto: FONTE_DE_CONTROLE_COM_REDECLARACAO },
      ]),
    ).toEqual([`${NOME_DO_ENUM_IMPORTADO} em controle.ts`]);

    // Âncora antivácuo: o pacote de fato CONSOME o nome. Sem ela, "nenhuma ligação local" seria
    // satisfeito por um pacote que simplesmente não usa o enum, e a metade `importado` do A5
    // ficaria sem prova.
    expect(citacoesDe(NOME_DO_ENUM_IMPORTADO, fontes)).toEqual(['modelo-canonico.ts']);

    // A metade que a igualdade acima NÃO alcança: ela assere o objeto importado, e ficaria verde
    // ao lado de uma redeclaração local que sombreasse o símbolo em `src/`.
    expect(ligacoesLocaisDe(NOME_DO_ENUM_IMPORTADO, fontes)).toEqual([]);
  });

  it('nenhum símbolo declarado ou publicado por este pacote opera sobre o pix', async () => {
    const fontes = await fontesDoPacote();
    const simbolos = [
      ...fontes.flatMap((fonte) => simbolosDeclarados(fonte.texto)),
      ...fontes.flatMap((fonte) => tiposDeclarados(fonte.texto).flatMap((tipo) => tipo.membros)),
    ];

    // Âncora antivácuo: há símbolos a examinar.
    expect(simbolos.length).toBeGreaterThanOrEqual(4);

    // Controle positivo (AP-29): a MESMA varredura, sobre nomes sintéticos que operam sobre o pix,
    // devolve os três — o que prova que a lista vazia abaixo é ausência, e não cegueira.
    expect(
      ocorrenciasDeTermos(['emitirPix', 'PortaDePix', 'chaveDoPixDaEmpresa'], [MEIO_SEM_OPERACAO]),
    ).toEqual([
      `${MEIO_SEM_OPERACAO} em emitirPix`,
      `${MEIO_SEM_OPERACAO} em PortaDePix`,
      `${MEIO_SEM_OPERACAO} em chaveDoPixDaEmpresa`,
    ]);

    expect(ocorrenciasDeTermos(simbolos, [MEIO_SEM_OPERACAO])).toEqual([]);
  });
});

// ===========================================================================
// CT-991 — o dialeto do provedor não vira símbolo publicado dos módulos novos
// ===========================================================================

/**
 * A varredura **estática** do texto-fonte dos três módulos que a fatia `webhook-e-carne` acrescentou
 * (CA-21 · RN-18 · ADR-0001 · ADR-0034).
 *
 * O invariante é *"trocar de provedor não obriga a reescrever o domínio"*: nenhum nome, código ou
 * desfecho do provedor vira símbolo publicado do produto. O dialeto entra por uma fronteira, é
 * traduzido ali, e morre ali.
 *
 * ⚠️ **Este caso é a metade ESTÁTICA da CA-21**, e a outra é o `CT-992` de
 * `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts`, que mede a **saída real**. Nenhum dos dois
 * implica o outro, pela mesma razão já registrada no par `CT-933`/`CT-934`: um valor publicado pode
 * carregar o termo sem que nome de símbolo algum o carregue, e um símbolo do dialeto pode existir em
 * `src/` sem chegar a corpo nenhum.
 *
 * ⚠️ **Asserção estática exige prova de falsificação por execução** (`.claude/rules/testing-stack.md`,
 * e o P4 do Protocolo Antirregressão). Ela foi executada na T12, pelo script `test` do pacote:
 * reintroduzido `nossoNumero` como **membro** de `NotificacaoRecebida` em
 * `packages/db/src/notificacao-bancaria.ts`, o caso abaixo reprovou nomeando o termo e o módulo; o
 * defeito foi revertido em seguida, e o controle deste bloco continua passando limpo no mesmo
 * harness.
 */
describe('CT-991 — nenhum símbolo publicado dos módulos novos usa vocabulário do provedor', () => {
  it('a varredura acha o dialeto nas quatro posições publicadas, e ignora a fronteira de tradução', () => {
    // Âncora da lista: os treze termos são distintos, e os quatro da notícia de fato entraram.
    expect(new Set(TERMOS_DO_DIALETO).size).toBe(TERMOS_DO_DIALETO.length);
    expect(TERMOS_DO_DIALETO.length).toBe(
      TERMOS_DO_PROVEDOR.length + TERMOS_DO_DIALETO_DA_NOTICIA.length,
    );

    // Âncora do eixo NEGATIVO: os três termos que o controle planta fora de posição publicada estão
    // mesmo escritos nele. Sem esta linha, "a varredura não os achou" seria indistinguível de "eles
    // nunca estiveram lá", e o eixo negativo passaria por vacuidade.
    for (const termo of TERMOS_NA_FRONTEIRA_DE_TRADUCAO) {
      expect(FONTE_DE_CONTROLE_COM_DIALETO_PUBLICADO).toContain(termo);
    }

    const achados = [
      ...new Set(
        ocorrenciasDeTermos(
          vocabularioPublicadoDe(FONTE_DE_CONTROLE_COM_DIALETO_PUBLICADO),
          TERMOS_DO_DIALETO,
        ),
      ),
    ].sort();

    // Controle POSITIVO (AP-29), por igualdade: os quatro plantados em posição publicada, e apenas
    // eles. Um extrator cego a qualquer das quatro posições reprova nomeando o que faltou; um
    // extrator que sobre-case reprova nomeando o excedente.
    expect(achados).toEqual([
      'idWebhook em idWebhook',
      'numeroIdentificadorBaixa em numeroIdentificadorBaixa',
      'sicoob em AvisoSicoob',
      'validacaoWebhook em validacaoWebhook',
    ]);

    // E o eixo NEGATIVO por extenso: nenhum dos três termos da fronteira de tradução foi acusado,
    // embora os três estejam escritos no controle. É esta linha que impede o caso de reprovar o
    // `dados.nossoNumero` de `tratamento-de-notificacao.ts`, que é onde o dialeto deve viver.
    expect(
      achados.filter((achado) =>
        TERMOS_NA_FRONTEIRA_DE_TRADUCAO.some((termo) => achado.startsWith(`${termo} em `)),
      ),
    ).toEqual([]);
  });

  it('os três módulos publicam vocabulário do produto, e nenhum termo do dialeto', async () => {
    for (const modulo of MODULOS_DA_FATIA) {
      const fonte = await fonteDoModuloDaFatia(modulo.caminho);

      // Âncora antivácuo, arquivo a arquivo: ele existe, tem conteúdo, e o extrator alcançou nele os
      // três símbolos do produto escritos à mão. Um arquivo vazio, um caminho errado ou um extrator
      // quebrado reprovam AQUI, nomeando o módulo — e não passam por vacuidade na varredura abaixo.
      expect(fonte.length, modulo.caminho).toBeGreaterThan(0);

      const vocabulario = vocabularioPublicadoDe(fonte);

      expect(
        modulo.publica.filter((simbolo) => !vocabulario.includes(simbolo)),
        `${modulo.caminho}: o extrator não alcançou símbolos que o módulo publica`,
      ).toEqual([]);

      // A varredura, módulo a módulo: a reprovação nomeia o termo, o portador e o arquivo.
      expect(
        ocorrenciasDeTermos(vocabulario, TERMOS_DO_DIALETO),
        `${modulo.caminho} publica vocabulário do provedor`,
      ).toEqual([]);
    }
  });
});
