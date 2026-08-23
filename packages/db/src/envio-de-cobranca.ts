/**
 * Envio de cobrança — o **predicado de elegibilidade**, o relógio da operação, o registro de toda
 * tentativa e o histórico dela.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./contrato.ts} e {@link ./configuracao-de-mora.ts} já
 * registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.envio_de_cobranca` numa
 * cadeia sem importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * A ELEGIBILIDADE É APURADA NO BANCO, NUMA CONSULTA SÓ (ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * A ADR-0023 é literal: a derivação que **participa de seleção** vive no banco. A elegibilidade
 * participa — ela decide **quais** cobranças voltam —, e por isso {@link selecionarCandidatasAoAviso}
 * é um predicado SQL ancorado em `negocio.cobranca_derivada`, a fonte única do estado publicado
 * (ADR-0022). A alternativa teria os dois preços que aquela ADR nomeia: trazer a carteira inteira
 * para a memória antes de filtrar, e reavaliar o estado fora da visão — que é o defeito de origem
 * medido no legado, em que `core.py` e `emailer.py` decidem o mesmo fato e discordam.
 *
 * **Nenhum objeto novo com direitos próprios nasce aqui**: não há visão nem função `SECURITY
 * DEFINER` da régua (`migracoes/0012_seguranca_regua.sql` declara essa ausência por escrito). O
 * predicado é uma consulta comum, avaliada com os direitos de quem consulta.
 *
 * A **janela de horário fica de fora do predicado**, e a ausência é a decisão D4 da fatia: ela não
 * participa de seleção — não discrimina uma cobrança de outra —, é propriedade do job. Quem a confere
 * é `dentroDaJanela`, de `@sysloc/regua`, **antes** de a consulta acontecer.
 *
 * ---------------------------------------------------------------------------
 * ESTE ARQUIVO SATISFAZ PORTAS QUE O DOMÍNIO DECLAROU (ADR-0025)
 * ---------------------------------------------------------------------------
 *
 * `CandidataAoAviso` e `TentativaDeEnvio` são **importados de `@sysloc/regua`**, e a seta é
 * `db → regua`. Parece engano para quem lê o grafo de pacotes — a infraestrutura dependendo do
 * domínio —, e a ADR-0025 nasceu porque a spec precisou escrever *"não corrija a direção"*. As três
 * consequências da inversão (o domínio passando a falar o vocabulário da camada de dados, o segundo
 * caminho para o dado dentro do domínio, e o ciclo medido que o Turborepo aborta) estão por extenso
 * no cabeçalho de `packages/regua/src/porta-de-dados.ts`, **referenciadas daqui e não recopiadas**.
 *
 * As assinaturas são as das portas: {@link selecionarCandidatasAoAviso} aplicada à transação e à
 * política é uma `PortaDeCandidatas`; {@link registrarEnvioDeCobranca} aplicada à transação é uma
 * `PortaDeRegistro`. Quem faz a aplicação parcial — abrindo a unidade de trabalho por tentativa — é o
 * adaptador da borda, e não este arquivo.
 *
 * ---------------------------------------------------------------------------
 * NENHUM LITERAL DE ESTADO DA COBRANÇA EXISTE AQUI (ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * O recorte de estado sai de `ESTADOS_EM_ABERTO`, publicado por `@sysloc/contracts` ao lado do enum
 * que o governa. Esta camada consome o **nome** e não conhece os rótulos, pela mesma razão que
 * {@link ./cobranca.ts} registra: é o que impede um literal de `negocio.status_cobranca` de existir
 * em posição executável num fonte deste pacote — o que o `CT-510` afirma por varredura, com a lista
 * de arquivos autorizados fechada por **igualdade** — e o que faz um estado novo em aberto alcançar
 * o recorte pelo contrato, e não por uma segunda lista livre para divergir.
 *
 * ---------------------------------------------------------------------------
 * O RELÓGIO É O DO BANCO, E SÓ ELE (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * Não há `new Date()` neste arquivo, e não pode haver. O eixo de **data** é
 * `negocio.data_corrente_da_operacao()` — o mesmo que a visão consulta para classificar a linha, com
 * fuso do **objeto** e não da sessão —, e o eixo de **instante** é `now()`, do servidor.
 * {@link lerHoraCorrenteDaOperacao} é a única fonte de hora do dia da fatia inteira: um segundo
 * relógio faria a janela do job e a classificação da cobrança discordarem nas horas de virada, e o
 * defeito seria raro e mudo.
 *
 * ---------------------------------------------------------------------------
 * O REGISTRO NUNCA É ALTERADO NEM APAGADO
 * ---------------------------------------------------------------------------
 *
 * Não há `UPDATE` nem `DELETE` sobre `negocio.envio_de_cobranca` neste arquivo — nem em lugar nenhum
 * do produto. Ela é registro de **fato**, e a ADR-0014 não a alcança: o discriminador dela é *"ser
 * referenciável"*, e o registro não é. É esse registro que sustenta, ao mesmo tempo, a trava do
 * intervalo, a idempotência da repetição do job e a auditoria do operador.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação — nem dentro das junções.** As cinco relações que o predicado
 * toca (`cobranca_derivada`, `locatario`, `contrato`, `imovel`, `conjunto`) estão sob RLS **forçada**,
 * e a visão é `security_invoker`, de modo que a política é avaliada com os direitos de quem consulta.
 * Escrever `AND l.empresa_id = …` numa junção seria o **segundo caminho para o dado** que a
 * `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é `NOT NULL`
 * e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal das políticas
 * avaliada dentro da própria instrução. E o registro que apontasse para cobrança de **outra** empresa
 * é impossível sem que nada aqui o confira: a chave estrangeira composta
 * `envio_de_cobranca_cobranca_empresa_fkey` recusa o par que não existe.
 */

// `ESTADOS_EM_ABERTO` é importado pela mesma razão de `./cobranca.ts`: a classificação *"quais
// estados estão em aberto"* é fato do contrato, e tem lar único ao lado do enum que o declara.
// `EnvioDeCobranca` é o recurso publicado, e dele se derivam os tipos dos dois rótulos — a forma que
// `@sysloc/contracts` declara no próprio cabeçalho para quem precisa do tipo de um rótulo.
import type { EnvioDeCobranca, PoliticaDeAviso } from '@sysloc/contracts';
import { ESTADOS_EM_ABERTO } from '@sysloc/contracts';
// A seta `db → regua` é a ADR-0025 — ver o cabeçalho deste arquivo. O que se importa é o **tipo**:
// `@sysloc/regua` é domínio puro, não conhece banco, e nada de valor atravessa esta fronteira.
import type { CandidataAoAviso, TentativaDeEnvio } from '@sysloc/regua';
import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** sobre relação alguma — nenhuma leitura deste arquivo o aplica, porque elas já têm política
// e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a
// **escrita**, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O fuso da operação tem **casa única** em `./fuso-da-operacao.ts` desde o fecho do `D25 · F4/T7`,
// pela mesma razão e no mesmo molde dos dois imports vizinhos: a declaração local que vivia aqui era
// uma das TRÊS cópias executáveis do literal no pacote, e o gatilho do débito — o quarto consumidor
// — chegou com a derivação de `proximaEsperada` em `./execucao-de-rotina.ts`. Ele não entra em
// `./index.ts`; ver o cabeçalho de lá.
import { FUSO_DA_OPERACAO } from './fuso-da-operacao.js';
// Os DOIS moldes têm **casa única** em `./moldes-de-formatacao.ts`, pela mesma razão e no mesmo
// molde. O do instante desceu na T3 da fatia `emissao-e-conciliacao`: o `criadoEm` daqui, o
// `canceladoEm` de `./cobranca.ts` e o `ocorridoEm` de `./evento-bancario.ts` são o MESMO carimbo, e
// a declaração local que vivia aqui era a segunda cópia que o limiar de três manda extinguir. O da
// DATA desceu no fecho do débito `D7 · F4/T3`: o `dataVencimento` daqui é a MESMA data de calendário
// das três colunas de `./cobranca.ts` e das duas de `./contrato.ts`, e o driver a entregaria como
// `Date` no fuso do processo — reserializá-la desloca a data em um dia para metade dos fusos, que é
// o defeito que `CandidataAoAviso.dataVencimento` declara impossível ao se dizer *"data de
// calendário, nunca um instante com fuso"*. Nenhum dos dois entra em `./index.ts` — ver o cabeçalho
// de lá.
import { FORMATO_ISO_DA_DATA, FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * A janela pedida do histórico de uma cobrança, já validada na borda por `esquemaDaJanela`.
 *
 * Mesmo par de {@link ./cobranca.ts} e das portas irmãs: o teto que **recusa em vez de truncar** é do
 * contrato, e esta camada apenas aplica o que recebeu.
 */
export interface JanelaDeEnvios {
  readonly limite: number;
  readonly deslocamento: number;
}

/** O molde `HH:MM` da hora do dia, o mesmo que a política publica — ver {@link ./politica-de-aviso.ts}. */
const FORMATO_DA_HORA_DO_DIA = 'HH24:MI';

// DECISÃO FECHADA — T5 / fatia `regua-de-cobranca` · 2026-08-11
// O QUÊ: a trava do intervalo mínimo conta APENAS a tentativa com desfecho `ENVIADA`. `FALHOU` e
//        `SEM_DESTINATARIO` NÃO travam — a cobrança cuja última tentativa falhou permanece
//        candidata na passagem seguinte, ainda dentro do intervalo.
// POR QUÊ: a RN-06 do PRD manda o contrário ("qualquer tentativa recente bloqueia"), e a contradição
//          foi MEDIDA contra o oráculo, não arbitrada: o golden
//          `docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json` traz,
//          em `retorno.intervalo`, o caso `envio_com_erro_nao_bloqueia` com `saida: true`, e o REG-01
//          — com envio `Erro` em −1 dia — recebe 1 mensagem no automático. Aplicar a RN-06 ao pé da
//          letra produziria uma SEGUNDA divergência contra o legado (a CA-09 declara uma só) e
//          tornaria a CA-10 INEXEQUÍVEL: a repetição do job pularia justamente a cobrança que falhou,
//          e a retentativa deixaria de existir. O argumento que decide não é de custo, é de
//          finalidade — o intervalo existe para proteger a CAIXA do locatário, e a tentativa que
//          falhou não pôs nada nela.
// REVERTER EXIGE: recapturar o oráculo e demonstrar que aquele golden deixou de trazer
//                 `envio_com_erro_nao_bloqueia` com `saida: true` em `retorno.intervalo`, e que o
//                 REG-01 passou a receber 0 mensagens no automático — e reescrever o CT-611
//                 (`test/envio-de-cobranca.spec.ts`), que é a rede desta decisão e prova que o
//                 desfecho é o ÚNICO discriminador entre travar e não travar.
/**
 * O único desfecho que trava o intervalo mínimo — ver o marcador acima.
 *
 * Constante nomeada, e não um literal na consulta, por duas razões que se somam: ela é o **ponto
 * exato** que uma rodada de correção posterior tentaria alterar ao ler a RN-06, e ter nome é o que
 * põe o marcador ao lado da linha em vez de num relatório; e o tipo é derivado de
 * `EnvioDeCobranca['desfecho']`, de modo que um rótulo que deixasse de existir no contrato **não
 * compila** aqui, em vez de virar um predicado que nunca casa.
 *
 * O mesmo valor é a condição do índice parcial `envio_de_cobranca_trava_idx`, declarado em
 * `./esquema/negocio.ts` — ele cobre exatamente o conjunto que esta trava consulta.
 */
const DESFECHO_QUE_TRAVA: EnvioDeCobranca['desfecho'] = 'ENVIADA';

/**
 * O que a consulta do predicado de fato lê.
 *
 * É estruturalmente igual a {@link CandidataAoAviso}, e a igualdade é o ponto: **não há conversão
 * nenhuma na saída**. `valorTotal` é `numeric(15,2)` e chega do driver **em texto**, e é assim que
 * ele viaja até o aviso — a régua não faz aritmética de dinheiro (ADR-0023), e um `Number(…)` aqui
 * reintroduziria o ponto flutuante no único lugar do produto onde ele nunca esteve.
 */
type LinhaBrutaDaCandidata = CandidataAoAviso;

/**
 * O que a consulta do registro de fato lê — estruturalmente igual a {@link EnvioDeCobranca}.
 *
 * Também sem conversão: `criadoEm` já sai formatado pelo servidor e `causa` atravessa o nulo intacto.
 */
type LinhaBrutaDoEnvio = EnvioDeCobranca;

/**
 * A candidata copiada campo a campo — **o ponto único** da tradução da consulta em contrato.
 *
 * Os oito campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer
 * coluna que a projeção venha a ganhar, e a projeção lê de uma visão que expande `c.*` — o que
 * incluiria `empresa_id`. Mesma decisão de `cobrancaPublicada` em {@link ./cobranca.ts}.
 *
 * A cópia tem um segundo efeito, e ele é medido: o objeto que o driver devolve carrega protótipo
 * próprio, montado a partir da descrição das colunas, e devolvê-lo direto faria a comparação estrita
 * da suíte reprovar por **classe** do objeto em vez de por valor.
 */
function candidataPublicada(linha: LinhaBrutaDaCandidata): CandidataAoAviso {
  return {
    codigo: linha.codigo,
    dataVencimento: linha.dataVencimento,
    status: linha.status,
    valorTotal: linha.valorTotal,
    destinatario: linha.destinatario,
    nomeDoLocatario: linha.nomeDoLocatario,
    imovel: linha.imovel,
    conjunto: linha.conjunto,
  };
}

/** O registro copiado campo a campo, pelo mesmo critério de {@link candidataPublicada}. */
function envioPublicado(linha: LinhaBrutaDoEnvio): EnvioDeCobranca {
  return {
    id: linha.id,
    cobrancaCodigo: linha.cobrancaCodigo,
    criadoEm: linha.criadoEm,
    caminho: linha.caminho,
    desfecho: linha.desfecho,
    destinatario: linha.destinatario,
    causa: linha.causa,
  };
}

/**
 * As oito colunas da candidata, **escritas uma vez** — a projeção que os dois caminhos consomem.
 *
 * Ela é fragmento compartilhado pela mesma razão de `colunasDaCobranca` em {@link ./cobranca.ts}: o
 * predicado da passagem automática e a leitura do disparo manual precisam entregar a **mesma**
 * candidata, e duas listas de projeção escritas em paralelo ficariam livres para divergir — uma
 * ganharia coluna que a outra não tem, ou o mesmo `AS` apontaria para expressões diferentes. A régua
 * decide igual nos dois caminhos porque recebe o mesmo objeto, e é aqui que essa igualdade é
 * estrutural em vez de coincidência.
 */
function colunasDaCandidata(tx: TransactionSql): Fragment {
  return tx`
    cd.codigo,
    to_char(cd.data_vencimento, ${FORMATO_ISO_DA_DATA}) AS "dataVencimento",
    cd.status,
    cd.valor_total AS "valorTotal",
    l.email AS "destinatario",
    l.nome AS "nomeDoLocatario",
    i.identificador_municipal AS "imovel",
    cj.nome AS "conjunto"
  `;
}

/**
 * Localiza pelo **código** a cobrança que o disparo manual vai avisar — a candidata, ou `undefined`.
 *
 * ---------------------------------------------------------------------------
 * ELA NÃO APLICA NENHUM DOS TRÊS EIXOS DE OPORTUNIDADE, E ISSO É A REGRA
 * ---------------------------------------------------------------------------
 *
 * Não há aqui recorte de dias, trava de intervalo nem janela: o disparo manual dispensa os três
 * (RD-07), e a dispensa é **parâmetro** da admissão de `@sysloc/regua`, nunca uma segunda consulta.
 * Escrever o predicado do automático nesta leitura faria a cobrança recém-avisada responder `404` —
 * *"não existe"* — quando o que se quer dizer é *"existe, e vai ser avisada agora mesmo"*.
 *
 * **Também não há recorte de ESTADO**, e a ausência é a decisão que sustenta a divergência por
 * vitória contra o legado (REG-08): a cobrança paga ou cancelada **chega** ao domínio, e é
 * `comporAvisoDeCobranca` — o lar único do discriminador de estado — quem a recusa, com o estado
 * nomeado. Filtrá-la aqui a transformaria em `404`, e o operador ouviria *"essa cobrança não
 * existe"* onde a resposta certa é *"ela está cancelada"*. É a mesma fonte que o automático lê
 * (`negocio.cobranca_derivada`, RD-01), com a mesma projeção — ver {@link colunasDaCandidata}.
 *
 * `undefined` tem as duas causas deliberadamente **indistinguíveis** — a cobrança não existe, ou é
 * de outra empresa e a política a esconde —, e a borda traduz as duas no mesmo `404` que
 * `localizarCobranca` já produz (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * A ORIGEM É ESCRITA AQUI, e a duplicação das quatro junções é DELIBERADA
 * ---------------------------------------------------------------------------
 *
 * O `FROM negocio.cobranca_derivada` e as quatro junções `INNER` aparecem **também** em
 * {@link selecionarCandidatasAoAviso}, e extraí-los para um fragmento comum foi tentado e
 * **revertido**: o `CT-612 (c)` de `test/fonte-unica-do-estado.spec.ts` recorta o **corpo** daquela
 * função e afirma que ele cita a visão e não cita a tabela crua — a extração tirava a citação do
 * corpo e deixava a asserção cega, que é regressão de prova (R2) mesmo com o SQL correto. A rede que
 * impede a segunda avaliação do estado vale mais do que quatro linhas repetidas, e este caso é
 * ampliado para cobrir as duas funções.
 *
 * O que **não** se repete é a projeção: as oito colunas saem de {@link colunasDaCandidata}, num lugar
 * só. É ela que produz a `CandidataAoAviso`, e é a igualdade dela que faz os dois caminhos entregarem
 * ao domínio objetos indistinguíveis — uma junção divergente derrubaria a consulta de imediato, com
 * coluna inexistente, enquanto uma projeção divergente atravessaria calada.
 */
export async function localizarCandidataAoAviso(
  tx: TransactionSql,
  codigo: string,
): Promise<CandidataAoAviso | undefined> {
  const [linha] = await tx<LinhaBrutaDaCandidata[]>`
    SELECT ${colunasDaCandidata(tx)}
      FROM negocio.cobranca_derivada cd
      JOIN negocio.locatario l ON l.id = cd.locatario_id
      JOIN negocio.contrato ct ON ct.id = cd.contrato_id
      JOIN negocio.imovel i ON i.id = ct.imovel_id
      JOIN negocio.conjunto cj ON cj.id = i.conjunto_id
     WHERE cd.codigo = ${codigo}
  `;

  return linha === undefined ? undefined : candidataPublicada(linha);
}

/**
 * Seleciona, **no banco**, as cobranças candidatas ao aviso da empresa do contexto.
 *
 * É o coração da fatia, e é **uma** consulta: o estado, o recorte de dias e a trava do intervalo são
 * apurados juntos, sobre a mesma fotografia.
 *
 * ---------------------------------------------------------------------------
 * A JUNÇÃO É QUÁDRUPLA E TODA `INNER` — nenhuma pode faltar, e nenhuma pode ser externa
 * ---------------------------------------------------------------------------
 *
 * `negocio.cobranca_derivada` **não carrega** nome do locatário, endereço de contato nem dado algum
 * do imóvel, e os três são exigidos pelo molde do aviso (*"Prezado(a) {nome}"*, *"Dados do imovel:
 * {imóvel} ({conjunto})"*). As quatro chaves percorridas — `cd.locatario_id`, `cd.contrato_id`,
 * `ct.imovel_id`, `i.conjunto_id` — são `NOT NULL` com chave estrangeira composta, de modo que
 * **nenhuma junção pode vir vazia**. Escrevê-las como `LEFT JOIN` seria pior do que inútil: mudaria o
 * modo de falha de *"impossível"* para *"a candidata some em silêncio"*, e cobrança que deixa de ser
 * avisada sem nada acusar é o pior desfecho possível para esta fatia.
 *
 * **Nenhuma junção reintroduz filtro de empresa.** As cinco relações estão sob a mesma política de
 * linha; `AND l.empresa_id = …` seria o segundo caminho para o dado que a ADR-0008 rejeita.
 *
 * ---------------------------------------------------------------------------
 * O RECORTE DE DIAS É UM SÓ, e ele cobre as duas metades da RD-04
 * ---------------------------------------------------------------------------
 *
 * A regra tem duas metades — `A_VENCER` entra quando faltam **≤ `diasAntesDoVencimento`** dias, e
 * `VENCIDA` entra **enquanto estiver em aberto, sem teto** —, e as duas cabem numa desigualdade só:
 * `data_vencimento <= data_corrente_da_operacao() + dias`. Para a vencida a condição é verdadeira por
 * construção (o vencimento já passou, e `dias` nunca é negativo — a faixa do contrato é `0..90`), e
 * para a que ainda vai vencer ela é exatamente a antecedência pedida.
 *
 * A forma alternativa — `(status = 'A_VENCER' AND …) OR status = 'VENCIDA'` — seria **duas** regras
 * onde há uma, e só se escreve nomeando os rótulos, o que é justamente o que este pacote não faz. O
 * eixo é `negocio.data_corrente_da_operacao()`, que é `STABLE`, inlinável e o **mesmo** que a visão
 * consulta para classificar a linha: comparar por um eixo e classificar por outro faria a fronteira
 * do vencimento discordar de si mesma nas horas em torno da virada.
 *
 * ---------------------------------------------------------------------------
 * O par de `IS NULL` é redundante para a SEMÂNTICA e decisivo para o PLANEJADOR
 * ---------------------------------------------------------------------------
 *
 * `pago_em IS NULL AND cancelado_em IS NULL` não muda conjunto algum: a precedência da visão só
 * publica um estado em aberto quando os dois carimbos são nulos. O que ele muda é o **plano** —
 * `cobranca_aberta_idx` é índice PARCIAL sobre exatamente essa condição, e o provador de implicação
 * do PostgreSQL não decompõe o `CASE` que produz `status`. A medição com `EXPLAIN (ANALYZE, BUFFERS)`
 * sobre 60.000 cobranças está registrada no comentário homônimo de `migracoes/0009_dominio_cobranca.sql`
 * e no de `predicadoDaCarteira` ({@link ./cobranca.ts}), **referenciada daqui e não recopiada**:
 * cópia de justificativa apodrece.
 *
 * ---------------------------------------------------------------------------
 * O `destinatario` VAZIO ENTRA no conjunto (RD-11)
 * ---------------------------------------------------------------------------
 *
 * `negocio.locatario.email` é `NOT NULL`, mas nada impede a cadeia vazia, e **não há aqui um
 * `AND l.email <> ''`**. A ausência é o mecanismo: excluída no predicado, a tentativa
 * `SEM_DESTINATARIO` nunca nasceria, e o cadastro incompleto deixaria de ser um fato registrado para
 * virar um silêncio. Quem decide o que fazer com o endereço vazio é o domínio, depois.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É CONTEÚDO
 * ---------------------------------------------------------------------------
 *
 * `data_vencimento, codigo` — a mesma da carteira, e pela mesma razão: dezenas de parcelas
 * compartilham o vencimento, e o `codigo` é único por empresa, de modo que ele desempata sempre. Aqui
 * há um segundo consumidor da propriedade: é ela que faz a equivalência com o oráculo não depender de
 * sorte, e é sobre ela que a `PortaDeCandidatas` promete *"a ordem em que serão percorridas"*.
 *
 * A política chega recortada a **dois** campos por `Pick`, e o recorte é a decisão D4 escrita no
 * tipo: `ativo` e a janela de horário não participam de seleção, e não teriam como entrar aqui sem
 * que a assinatura mudasse.
 */
export async function selecionarCandidatasAoAviso(
  tx: TransactionSql,
  politica: Pick<PoliticaDeAviso, 'diasAntesDoVencimento' | 'intervaloMinimoDias'>,
): Promise<readonly CandidataAoAviso[]> {
  const linhas = await tx<LinhaBrutaDaCandidata[]>`
    SELECT ${colunasDaCandidata(tx)}
      FROM negocio.cobranca_derivada cd
      JOIN negocio.locatario l ON l.id = cd.locatario_id
      JOIN negocio.contrato ct ON ct.id = cd.contrato_id
      JOIN negocio.imovel i ON i.id = ct.imovel_id
      JOIN negocio.conjunto cj ON cj.id = i.conjunto_id
     WHERE cd.status = ANY(${[...ESTADOS_EM_ABERTO]}::negocio.status_cobranca[])
       AND cd.pago_em IS NULL
       AND cd.cancelado_em IS NULL
       AND cd.data_vencimento
             <= negocio.data_corrente_da_operacao() + ${politica.diasAntesDoVencimento}::integer
       AND NOT EXISTS (
             SELECT 1
               FROM negocio.envio_de_cobranca ec
              WHERE ec.cobranca_id = cd.id
                AND ec.desfecho = ${DESFECHO_QUE_TRAVA}::negocio.desfecho_do_aviso
                AND ec.criado_em
                      > now() - make_interval(days => ${politica.intervaloMinimoDias}::integer)
           )
     ORDER BY cd.data_vencimento, cd.codigo
  `;

  return linhas.map(candidataPublicada);
}

/**
 * A hora corrente da operação, no molde `HH:MM` — **a única fonte de hora da fatia** (ADR-0026).
 *
 * Ela existe porque a janela de horário é comparada como texto `HH:MM`, e as duas pontas da
 * comparação precisam vir do mesmo relógio: `dentroDaJanela` (em `@sysloc/regua`) recebe a hora já
 * resolvida e não a lê de lugar nenhum, justamente para que o domínio seja exercitável sem relógio.
 *
 * O fuso é o da **operação**, aplicado ao valor e não à sessão: dois processos com `TZ` diferentes
 * leem a mesma hora, e quem consulta não pode movê-la. É a mesma propriedade que
 * `negocio.data_corrente_da_operacao()` tem para a data, e a coincidência entre os dois eixos é
 * obrigatória — a janela decide **se** a régua passa hoje, e a data decide **quem** é candidata.
 *
 * Ter o eixo com nome é o que torna verificável a afirmação de que não há segundo relógio: um
 * `new Date()` apareceria como um segundo caminho, e o `CT-612` o varre estaticamente.
 */
export async function lerHoraCorrenteDaOperacao(tx: TransactionSql): Promise<string> {
  const [linha] = await tx<{ hora: string }[]>`
    SELECT to_char(now() AT TIME ZONE ${FUSO_DA_OPERACAO}, ${FORMATO_DA_HORA_DO_DIA}) AS hora
  `;

  if (linha === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado. O ramo existe porque o tipo do driver
    // admite o arranjo vazio, e um `as` no lugar dele deixaria um `undefined` virar hora corrente —
    // que a comparação da janela aceitaria como texto, decidindo o envio pelo nada.
    throw new Error('o relógio do banco não devolveu a hora corrente da operação');
  }

  return linha.hora;
}

/**
 * Grava **uma** tentativa de envio e devolve a linha como o produto a publica.
 *
 * ---------------------------------------------------------------------------
 * O INSTANTE É DO BANCO, e não há parâmetro por onde propô-lo
 * ---------------------------------------------------------------------------
 *
 * `criado_em` não aparece na lista de colunas: ele nasce do `DEFAULT now()` da tabela (ADR-0026).
 * Abrir um parâmetro de instante nesta porta daria a quem chama — e a quem verifica — o poder de
 * escolher quando a tentativa aconteceu, e é justamente por esse instante que a trava conta o
 * intervalo. É por isso que a suíte semeia tentativas no passado por **instrução própria**, e não por
 * um parâmetro desta função.
 *
 * ---------------------------------------------------------------------------
 * A COBRANÇA É ALCANÇADA PELO CÓDIGO, e o UUID nunca sai daqui
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem série declarada, então a chave exposta é o **código legível** (ADR-0017), e é ele
 * que `TentativaDeEnvio` carrega. A tradução para o `uuid` da coluna acontece **dentro da mesma
 * instrução**, na expressão de tabela `alvo`: fazê-la numa consulta anterior abriria uma janela em
 * que a cobrança lida e a cobrança escrita poderiam ser retratos diferentes, e devolveria à borda um
 * identificador interno que rota nenhuma aceita.
 *
 * O `RETURNING` da inserção é reunido a `alvo` para que o **código publicado venha do banco**, e não
 * do argumento recebido: devolver o que a aplicação passou faria a resposta concordar consigo mesma
 * mesmo que a linha tivesse ido para outro lugar.
 *
 * Alcance vazio **levanta**, e não devolve `undefined`: a `PortaDeRegistro` que o domínio declarou
 * promete a linha gravada, e o único caminho para o vazio aqui é a cobrança não existir ou ser de
 * outra empresa — o que a borda já resolveu antes, com o `404` indistinguível de `localizarCobranca`.
 * Um `undefined` atravessando daqui viraria uma tentativa que ninguém registrou, e é o registro que
 * impede o reenvio na passagem seguinte.
 *
 * **A coerência entre `desfecho` e `causa` não é conferida aqui**, e a ausência é a decisão: quem a
 * impõe é `envio_de_cobranca_causa_chk`, bicondicional, que recusa tanto o sucesso com causa quanto a
 * falha sem causa. Uma segunda conferência escrita nesta camada seria livre para divergir da do banco
 * — e a do banco é a que vale para **toda** escrita, inclusive as que ainda não existem.
 */
export async function registrarEnvioDeCobranca(
  tx: TransactionSql,
  tentativa: TentativaDeEnvio,
): Promise<EnvioDeCobranca> {
  const [linha] = await tx<LinhaBrutaDoEnvio[]>`
    WITH alvo AS (
      SELECT id, codigo
        FROM negocio.cobranca
       WHERE codigo = ${tentativa.cobrancaCodigo}
    ),
    gravado AS (
      INSERT INTO negocio.envio_de_cobranca (
        empresa_id, cobranca_id, caminho, desfecho, destinatario, causa
      )
      SELECT ${empresaDoContexto(tx)},
             alvo.id,
             ${tentativa.caminho}::negocio.caminho_do_aviso,
             ${tentativa.desfecho}::negocio.desfecho_do_aviso,
             ${tentativa.destinatario},
             ${tentativa.causa}
        FROM alvo
      RETURNING id, cobranca_id, criado_em, caminho, desfecho, destinatario, causa
    )
    SELECT gravado.id,
           alvo.codigo AS "cobrancaCodigo",
           to_char(gravado.criado_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "criadoEm",
           gravado.caminho,
           gravado.desfecho,
           gravado.destinatario,
           gravado.causa
      FROM gravado
      JOIN alvo ON alvo.id = gravado.cobranca_id
  `;

  if (linha === undefined) {
    // Alcançável só por arranjo incoerente: a cobrança não existe, ou é de outra empresa e a política
    // a esconde. Levantar com nome é o que impede a tentativa não registrada de atravessar como se
    // tivesse sido gravada — o código NÃO entra na mensagem, que pode alcançar o registro estruturado.
    throw new Error('a tentativa de envio não foi gravada: o contexto não alcança a cobrança');
  }

  return envioPublicado(linha);
}

/**
 * Lê uma página do histórico de tentativas de uma cobrança, **da mais recente para a mais antiga**.
 *
 * A ordem é `criado_em DESC`, que é o que as duas leituras da tabela querem (o índice
 * `envio_de_cobranca_historico_idx` a materializa) — e o desempate por `id DESC` não é ornamento:
 * `now()` é o instante do **início da transação**, de modo que duas tentativas gravadas na mesma
 * unidade de trabalho carregam carimbos idênticos. Sem desempate, a mesma linha apareceria em duas
 * páginas — ou em nenhuma —, que é o defeito que o `ORDER BY data_vencimento, codigo` da carteira
 * fecha pelo mesmo mecanismo.
 *
 * A cobrança é alcançada pelo **código** (ADR-0017), com a junção fazendo a tradução; a página vazia
 * é resultado legítimo, e cobre tanto a cobrança sem histórico quanto a que o contexto não alcança —
 * as duas ausências são deliberadamente **indistinguíveis** (ADR-0008), e a borda traduz a segunda no
 * `404` que `localizarCobranca` já produz.
 *
 * Não há `empresa_id` na instrução: quem recorta as duas pontas é a política forçada.
 */
export async function lerEnviosDaCobranca(
  tx: TransactionSql,
  codigo: string,
  janela: JanelaDeEnvios,
): Promise<readonly EnvioDeCobranca[]> {
  const linhas = await tx<LinhaBrutaDoEnvio[]>`
    SELECT ec.id,
           c.codigo AS "cobrancaCodigo",
           to_char(ec.criado_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "criadoEm",
           ec.caminho,
           ec.desfecho,
           ec.destinatario,
           ec.causa
      FROM negocio.envio_de_cobranca ec
      JOIN negocio.cobranca c ON c.id = ec.cobranca_id
     WHERE c.codigo = ${codigo}
     ORDER BY ec.criado_em DESC, ec.id DESC
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  return linhas.map(envioPublicado);
}

/**
 * Conta **todas** as tentativas de uma cobrança — nunca as da página.
 *
 * É o `total` do envelope `{ itens, total, limite, deslocamento }` da ADR-0017, e o que ele descreve é
 * o conjunto inteiro sob o mesmo recorte que {@link lerEnviosDaCobranca} lê. Ela é chamada na **mesma
 * unidade de trabalho** que a página, pela razão que `listarCobrancas` registra: lidos em transações
 * diferentes, o total poderia descrever um conjunto do qual a página já não faz parte, e o cliente
 * pagina sobre dois retratos.
 *
 * O recorte é escrito **uma vez em cada função e é o mesmo**: a junção pelo código, sem cláusula de
 * empresa. Não há aqui o fragmento compartilhado de `predicadoDaCarteira` porque não há filtro
 * opcional a compor — a chave é única e obrigatória, e um fragmento para uma condição só acrescentaria
 * indireção sem fechar divergência nenhuma.
 */
export async function contarEnviosDaCobranca(tx: TransactionSql, codigo: string): Promise<number> {
  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.envio_de_cobranca ec
      JOIN negocio.cobranca c ON c.id = ec.cobranca_id
     WHERE c.codigo = ${codigo}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return Number(contagem?.total ?? 0);
}
