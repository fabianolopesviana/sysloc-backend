/**
 * As portas de **dados** da régua — declaradas aqui, satisfeitas lá fora (ADR-0025).
 *
 * ===========================================================================
 * A seta é `db → regua`, e ela INVERTE a leitura ingênua do grafo de pacotes
 * ===========================================================================
 *
 * Quem declara {@link CandidataAoAviso}, {@link PortaDeCandidatas} e {@link PortaDeRegistro} é o
 * **domínio**; é `@sysloc/db` que importa estes tipos para dizer que os satisfaz. Parece engano para
 * quem lê o grafo de pacotes — o pacote de infraestrutura passando a depender do de domínio —, e a
 * ADR-0025 nasceu exatamente porque a spec precisou escrever *"não corrija a direção"*.
 *
 * **Não a "corrija" para `regua → db`.** A alternativa (o tipo nascendo em `@sysloc/db`) preserva o
 * desenho ingênuo ao custo de:
 *
 * 1. este pacote passar a falar o vocabulário da camada de dados, e a frase que o justifica —
 *    *"a régua não conhece banco"* — virar meia-verdade (*"não importa valor, só tipo"*);
 * 2. o domínio ganhar um **segundo caminho** para o dado, já que quem importa o pacote de dados
 *    alcança as funções dele sem que nada acuse;
 * 3. um ciclo, medido neste repositório, no instante em que a verificação do domínio quisesse banco:
 *    `Cyclic dependency detected: @sysloc/db#build, @sysloc/regua#build` — o Turborepo aborta antes
 *    de compilar qualquer coisa.
 *
 * ===========================================================================
 * As portas chegam por PARÂMETRO, como funções — nunca por import
 * ===========================================================================
 *
 * Uma porta que o domínio **construísse** (ou importasse de um módulo concreto) seria a mesma
 * dependência com outro nome. Declaradas como tipos de função e recebidas por parâmetro, elas
 * tornam o domínio exercitável sem subir processo: a verificação injeta o que quiser, e não há
 * segundo caminho para o dado dentro do pacote.
 *
 * {@link PortaDeCandidatas} não recebe argumento algum de propósito. Tudo o que a seleção precisa —
 * o executor da transação, a política e o recorte de dias — é do **adaptador**, e fechá-lo lá é o
 * que impede o vocabulário da camada de dados de subir por um parâmetro. O efeito colateral é
 * desejável: a régua só pergunta pelas candidatas **depois** de decidir que vai agir (política
 * ligada e dentro da janela), e a consulta nem chega a acontecer quando não vai agir.
 */

import type { EnvioDeCobranca, EstadoDaCobranca } from '@sysloc/contracts';

/**
 * A projeção que sobe da camada de dados para o domínio — os **oito** campos da §5.1-B′.
 *
 * ---------------------------------------------------------------------------
 * Por que oito, e não os campos da view
 * ---------------------------------------------------------------------------
 *
 * `negocio.cobranca_derivada` é a fonte única do estado publicado (ADR-0022), e ela **não carrega**
 * nome do locatário, endereço de contato nem dado algum do imóvel — os três são exigidos pela RD-16
 * e pelo molde do oráculo (*"Prezado(a) {nome}"*, *"Dados do imovel: {imóvel} ({conjunto})"*). O
 * predicado, portanto, projeta a **junção**, e é essa projeção que este tipo descreve. Ele não é um
 * recorte da view: é o contrato do que o domínio precisa para compor e registrar um aviso.
 *
 * ---------------------------------------------------------------------------
 * `status` vem do contrato, e o domínio NUNCA o recalcula
 * ---------------------------------------------------------------------------
 *
 * O estado é derivado dos fatos gravados, num lugar só — a view (ADR-0022). Aqui ele apenas
 * **chega**, com o tipo que `@sysloc/contracts` publica. Uma segunda derivação escrita na régua
 * coincidiria com a da view na quase totalidade dos casos e atravessaria a suíte comportamental sem
 * uma recusa; é o defeito de origem do legado, em que `core.py` e `emailer.py` decidem o mesmo fato
 * e discordam.
 *
 * ---------------------------------------------------------------------------
 * `destinatario` pode ser cadeia VAZIA, e isso é o contrato (RD-11)
 * ---------------------------------------------------------------------------
 *
 * `negocio.locatario.email` é `NOT NULL`, mas nada impede a cadeia vazia. A candidata sem endereço
 * **entra** no conjunto: a exclusão não acontece no predicado, senão o registro `SEM_DESTINATARIO`
 * nunca nasceria. Tipar este campo como um endereço garantido faria o domínio confiar em algo que o
 * cadastro não garante, e o caso que a fatia existe para registrar deixaria de ser representável.
 *
 * `valorTotal` é **texto**, e não número: ele chega já formatado pelo banco (`numeric(15,2)`), e a
 * régua não faz aritmética de dinheiro (ADR-0023). Convertê-lo para `number` aqui reintroduziria o
 * ponto flutuante no único lugar do produto onde ele nunca esteve.
 */
export interface CandidataAoAviso {
  /** O código legível da cobrança — a chave exposta (ADR-0017). */
  readonly codigo: string;
  /** O vencimento como data de calendário, `AAAA-MM-DD` — nunca um instante com fuso. */
  readonly dataVencimento: string;
  /** O estado publicado, lido da view. O domínio o consome; jamais o deriva. */
  readonly status: EstadoDaCobranca;
  /** O valor a cobrar, em texto, como o banco o projeta. */
  readonly valorTotal: string;
  /** O endereço de contato do locatário. **Pode ser cadeia vazia** (RD-11). */
  readonly destinatario: string;
  /** O nome do locatário, para a saudação nominal do aviso. */
  readonly nomeDoLocatario: string;
  /** O identificador municipal do imóvel, como o aviso o imprime. */
  readonly imovel: string;
  /** O nome do conjunto a que o imóvel pertence. */
  readonly conjunto: string;
}

/**
 * A porta que entrega as candidatas ao aviso de uma empresa, na ordem em que serão percorridas.
 *
 * A **ordem é conteúdo, não estética** (RD-17): o adaptador entrega por vencimento e depois por
 * código, e é isso que faz a equivalência com o oráculo não depender de sorte. O domínio percorre o
 * que recebe, sem reordenar — reordenar aqui criaria uma segunda regra de ordem, livre para divergir
 * da que o `ORDER BY` do predicado já fixa.
 */
export type PortaDeCandidatas = () => Promise<readonly CandidataAoAviso[]>;

/**
 * O fato que o domínio manda gravar depois de cada tentativa — bem-sucedida ou não.
 *
 * **Toda** tentativa deixa registro (RD-08), e é justamente o registro que entrega a idempotência da
 * repetição do job: a cobrança já avisada cai fora do predicado na passagem seguinte, sem estado
 * novo a reconciliar. Um desfecho que não fosse registrado reabriria o envio duplicado.
 *
 * `caminho` e `desfecho` são derivados de `EnvioDeCobranca`, o recurso que `@sysloc/contracts`
 * publica, e não redigitados: é a forma que aquele pacote declara no próprio cabeçalho para quem
 * precisa do tipo de um rótulo, e redigitar os literais aqui criaria a segunda fonte do mesmo fato
 * que a ADR-0016 elimina.
 *
 * `causa` é `null` quando a mensagem saiu e preenchida quando não saiu — o mesmo pareamento que o
 * `CHECK` do banco impõe a toda escrita. Ele é anulável, e não opcional, porque *"não houve causa"* é
 * um fato a gravar, não um campo a omitir.
 */
export interface TentativaDeEnvio {
  /** O código legível da cobrança avisada. */
  readonly cobrancaCodigo: string;
  /** Como a tentativa nasceu — pela passagem da régua ou pelo disparo de uma pessoa. */
  readonly caminho: EnvioDeCobranca['caminho'];
  /** O que aconteceu: a mensagem saiu, falhou, ou não havia para onde mandar. */
  readonly desfecho: EnvioDeCobranca['desfecho'];
  /** O endereço tentado — cadeia vazia quando o locatário não tem contato. */
  readonly destinatario: string;
  /** O diagnóstico da falha; `null` quando a mensagem saiu. */
  readonly causa: string | null;
}

/**
 * A porta que grava a tentativa e devolve a linha como o produto a publica.
 *
 * Ela **devolve** o registro, em vez de `void`, porque o disparo manual responde com a linha do
 * registro (§4.1) — inclusive quando o desfecho é `FALHOU`, já que o operador precisa saber que não
 * saiu. Uma porta que devolvesse `void` obrigaria a borda a reler o que acabou de gravar, e a
 * releitura é uma segunda leitura livre para discordar da escrita.
 *
 * O adaptador abre **uma unidade de trabalho por tentativa**: uma unidade para o job inteiro faria a
 * falha da décima cobrança desfazer o registro das nove anteriores — e é o registro que impede o
 * reenvio na repetição do job.
 */
export type PortaDeRegistro = (tentativa: TentativaDeEnvio) => Promise<EnvioDeCobranca>;
