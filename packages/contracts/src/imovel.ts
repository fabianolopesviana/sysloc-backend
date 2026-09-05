/**
 * O contrato do **imóvel**, e os dois enums fechados que só ele usa.
 *
 * ===========================================================================
 * Por que os enums nascem aqui, e não em `packages/db`
 * ===========================================================================
 *
 * O tipo do imóvel e a situação de locação são enums do banco — e é justamente por isso que a
 * direção da dependência importa. Declarados lá, este pacote precisaria importar `@sysloc/db` para
 * falar deles, e o contrato deixaria de ser folha: o frontend, ao importar os tipos no marco de
 * entrega, arrastaria a camada de dados junto. Declarados aqui, `packages/db` os consome na direção
 * inversa, que não custa nada — o servidor já depende de tudo.
 *
 * A forma é a de `packages/auth/src/catalogo-de-permissoes.ts`: `as const` fecha a união em tempo de
 * **compilação**, `Object.freeze` fecha o arranjo em tempo de **execução**. Sem o segundo, um
 * consumidor com um `push` mal colocado alargaria o enum de todo mundo, porque o módulo tem
 * instância única no processo.
 *
 * ===========================================================================
 * A assimetria entrada × saída de `statusLocacao` — leia antes de "simplificar"
 * ===========================================================================
 *
 * O enum tem **três** valores e a entrada aceita **dois**. Não é descuido: `LOCADO` é produzido
 * **só** pela ativação de contrato, que é a fatia seguinte. Deixar o cliente informá-lo permitiria
 * criar um imóvel locado sem contrato algum, e a fatia de contratos herdaria um estado que ela teria
 * de reconciliar em vez de manter — a RN-10 existe para lhe entregar o invariante *"`LOCADO` implica
 * contrato ativo"* já válido.
 *
 * Por isso os dois esquemas leem enums diferentes, e por isso remover `LOCADO` do enum do domínio
 * **não** é a mesma coisa: a saída precisa devolver o valor que a própria fatia de contratos
 * produzirá. É o par CT-334/CT-335 que prende as duas pontas.
 *
 * ===========================================================================
 * A situação de locação SAI do corpo da alteração, e ganha porta própria (T10)
 * ===========================================================================
 *
 * O `POST` continua carregando `statusLocacao`; o `PUT`, não — {@link esquemaDeImovelAlterado} é
 * derivado por `omit`. A razão, o defeito que isso fecha e o que teria de ser verdade para a decisão
 * deixar de valer estão no marcador `DECISÃO FECHADA` daquele esquema, e **só lá**.
 */

import { z } from 'zod';
import { esquemaDoComodo } from './comodo.js';
import {
  camposDeEndereco,
  ESQUEMA_DO_IDENTIFICADOR,
  esquemaDaJanelaComCirculacao,
  MAIOR_TEXTO_CURTO,
  MAIOR_TEXTO_LIVRE,
} from './comum.js';
// A chave exposta do contrato é o **código** (ADR-0017), e ela tem ponto único de canonização em
// `./contrato.js`. Redigitar a forma aqui criaria a segunda fonte do mesmo fato — exatamente o que a
// ADR-0016 fecha. A aresta não fecha ciclo: `contrato.ts` importa só de `comum.ts`.
import { ESQUEMA_DO_CODIGO_DE_CONTRATO } from './contrato.js';

/** Os três tipos de imóvel (RN-11), na ordem em que o enum do banco os declara. */
export const TIPOS_DE_IMOVEL = Object.freeze(['RESIDENCIAL', 'COMERCIAL', 'MISTO'] as const);

/** União fechada dos tipos de imóvel. */
export type TipoDeImovel = (typeof TIPOS_DE_IMOVEL)[number];

/** As três situações de locação do domínio, na ordem em que o enum do banco as declara. */
export const SITUACOES_DE_LOCACAO = Object.freeze([
  'DISPONIVEL',
  'LOCADO',
  'INDISPONIVEL',
] as const);

/** União fechada das situações de locação. */
export type SituacaoDeLocacao = (typeof SITUACOES_DE_LOCACAO)[number];

/**
 * As situações que o **usuário** informa (RN-10) — o enum do domínio menos `LOCADO`.
 *
 * O `satisfies` é o que liga os dois: um valor que deixe de existir em {@link SITUACOES_DE_LOCACAO}
 * — ou que nunca tenha existido — é recusado **em compilação**, aqui, em vez de virar um esquema de
 * entrada que aceita um estado que o banco não guarda. Uma lista solta de dois literais compilaria
 * igual e perderia essa amarra.
 *
 * Não é derivada por `filter` de propósito: `filter` devolve `SituacaoDeLocacao[]`, a união dos dois
 * literais se perde, e `z.enum` passaria a aceitar os três outra vez.
 */
export const SITUACOES_INFORMAVEIS = Object.freeze([
  'DISPONIVEL',
  'INDISPONIVEL',
] as const satisfies readonly SituacaoDeLocacao[]);

/** União fechada das situações que o usuário pode informar. */
export type SituacaoInformavel = (typeof SITUACOES_INFORMAVEIS)[number];

/**
 * Corpo fechado da **criação** de imóvel (§4.1.1) — treze campos.
 *
 * Completo e sem campo opcional implícito, porque **não há atualização parcial nesta superfície**.
 * Campo ausente é recusa por campo obrigatório, nunca "preserve o valor atual".
 *
 * `conjuntoId` é canonizado pelo {@link ESQUEMA_DO_IDENTIFICADOR} — ele vira chave estrangeira
 * composta e é comparado com valor lido do banco, que é exatamente o cenário em que as duas pontas
 * concordam sobre a identidade e discordam sobre a grafia. Trocar o conjunto pelo `PUT` é operação
 * legítima de cadastro (§5.2), e o destino passa pela mesma conferência de alcance da criação.
 *
 * `statusLocacao` **fica aqui e sai do `PUT`**: é na criação que o imóvel nasce, e nascer sem
 * contrato é o único estado possível. Ver o marcador `DECISÃO FECHADA` de
 * {@link esquemaDeImovelAlterado} — ele governa **esta linha também**, e por isso não é copiado para
 * cá: marcador replicado apodrece, porque o original é corrigido e a cópia não.
 *
 * `empresaId` **não** aparece: sai da sessão, e o `strictObject` o recusa como chave desconhecida.
 */
export const esquemaDeImovelNovo = z.strictObject({
  conjuntoId: ESQUEMA_DO_IDENTIFICADOR,
  nomeImovel: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
  identificadorMunicipal: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
  tipoImovel: z.enum(TIPOS_DE_IMOVEL),
  ...camposDeEndereco(),
  statusLocacao: z.enum(SITUACOES_INFORMAVEIS),
  observacoes: z.string().trim().max(MAIOR_TEXTO_LIVRE).nullable(),
});

/** O corpo aceito na criação de imóvel. */
export type ImovelNovo = z.infer<typeof esquemaDeImovelNovo>;

/**
 * Corpo fechado da **alteração** de imóvel — o da criação **menos** a situação de locação.
 *
 * Ele é **derivado** por `omit`, e nunca redigitado (ADR-0016): uma segunda lista de doze campos
 * seria a segunda fonte do mesmo fato, e as duas divergiriam no primeiro campo que o cadastro
 * ganhasse. O que sobra continua sendo corpo **completo** — campo ausente é recusa por campo
 * obrigatório —, e a chave a mais é recusada com `422` pelo `strictObject`, o que faz a saída de
 * `statusLocacao` ser **ruidosa** em vez de silenciosa: o cliente que ainda o envia descobre na
 * resposta, e não numa divergência de estado meses depois.
 *
 * DECISÃO FECHADA — T10 / tech spec §20 · 2026-08-09
 * O QUÊ: a situação de locação **não entra em nenhum corpo de atualização de imóvel**. Esta
 *        derivação a tira do `PUT`; `alterarImovel` (`packages/db/src/imovel.ts`) não escreve mais a
 *        coluna; e o `statusLocacao` que sobra em {@link esquemaDeImovelNovo} lê
 *        {@link SITUACOES_INFORMAVEIS}, nunca {@link SITUACOES_DE_LOCACAO}. As três formam **uma**
 *        decisão: o único caminho que grava a coluna a partir de uma requisição é
 *        `POST /v1/imoveis/:id/situacao-de-locacao`, e o único que grava `LOCADO` é a ativação de
 *        contrato.
 * POR QUÊ: com o campo no `PUT` — e com a porta de alteração escrevendo a coluna incondicionalmente
 *        —, **toda** alteração de um imóvel locado apagava o `LOCADO` em silêncio, inclusive
 *        corrigir o endereço: a entrada não aceita `LOCADO`, então a resposta trazia
 *        `statusLocacao: 'DISPONIVEL'` **ao lado** de `contratoVigente` preenchido, enquanto o
 *        contrato seguia `ATIVO`. É a dor de origem do PRD §2 — *"as duas fontes podem divergir, e a
 *        tela mostra o que quiser"*. Alargar o enum "por simetria" é o outro lado do mesmo defeito:
 *        bastaria um `PUT` para um imóvel se declarar locado sem contrato algum.
 * REVERTER EXIGE: provar que o invariante *"`LOCADO` implica contrato vigente, e contrato vigente
 *        implica `LOCADO`"* continua verdadeiro por outro mecanismo — isto é, que existe no **banco**
 *        uma restrição que pareie `negocio.contrato.status = 'ATIVO'` com
 *        `negocio.imovel.status_locacao`, tornando o par divergente irrepresentável. Enquanto o que
 *        os mantém juntos for a ausência do campo na entrada e o commit único da ativação, devolver o
 *        campo ao `PUT` reabre o furo. O `CT-434` é a rede desta decisão, e a falsificação dela exige
 *        **dois** mutantes isolados — devolver o campo ao esquema, e reativar a escrita da coluna —,
 *        porque um só não distingue "o campo foi recusado" de "o campo foi aceito e ignorado".
 */
export const esquemaDeImovelAlterado = esquemaDeImovelNovo.omit({ statusLocacao: true });

/** O corpo aceito na alteração de imóvel. */
export type ImovelAlterado = z.infer<typeof esquemaDeImovelAlterado>;

/**
 * Corpo fechado da rota de situação de locação — **um** campo, e nenhum outro.
 *
 * `POST /v1/imoveis/:id/situacao-de-locacao` é a porta estreita pela qual o cliente alterna o imóvel
 * entre disponível e indisponível, e ela lê {@link SITUACOES_INFORMAVEIS}: `LOCADO` é produzido pela
 * ativação de contrato e por nada mais, de modo que informá-lo aqui é `422` por valor fora da união.
 *
 * É **uma** rota, e não duas gêmeas no molde de `retirada`/`recirculacao`: a união informável pode
 * ganhar um terceiro valor, e duas rotas por valor multiplicariam a superfície a cada crescimento do
 * enum. O corpo é fechado pela mesma razão do das rotas de circulação — chave desconhecida é `422`.
 */
export const esquemaDaSituacaoDeLocacao = z.strictObject({
  statusLocacao: z.enum(SITUACOES_INFORMAVEIS),
});

/** O corpo aceito pela rota de situação de locação. */
export type SituacaoDeLocacaoInformada = z.infer<typeof esquemaDaSituacaoDeLocacao>;

/**
 * O contrato que **ocupa** o imóvel, e o locatário dele — o par que a tela exibe ao lado da situação
 * de locação.
 *
 * ---------------------------------------------------------------------------
 * DUAS CLASSES DE CHAVE NO MESMO OBJETO, e a assimetria é a ADR-0017
 * ---------------------------------------------------------------------------
 *
 * `codigo` é a chave exposta do **contrato**, porque contrato tem série declarada — e ela reusa
 * {@link ESQUEMA_DO_CODIGO_DE_CONTRATO}, o ponto único de canonização, em vez de redigitar a forma.
 * `locatario.id` é **UUID**, porque locatário **não** tem série declarada e a ADR-0017 lhe dá o UUID
 * como chave exposta. As duas classes convivem porque descrevem entidades diferentes; uniformizá-las
 * publicaria, para uma das duas, um identificador que nenhuma rota aceita.
 *
 * O `nome` viaja junto pela mesma razão de `esquemaDoContrato.fiadores`: é o nome que a tela exibe, e
 * devolver só o identificador obrigaria o cliente a uma chamada por imóvel — que é precisamente o
 * custo que este campo existe para eliminar.
 *
 * ---------------------------------------------------------------------------
 * Ele NÃO é publicado pelo índice do pacote, e a ausência é a decisão
 * ---------------------------------------------------------------------------
 *
 * Nenhuma rota devolve este objeto sozinho: ele só existe **dentro** do imóvel. Publicá-lo ofereceria
 * ao consumidor uma segunda forma de descrever a ocupação, livre para divergir da que o imóvel
 * carrega. O que sai daqui é o **tipo** {@link ContratoVigenteDoImovel}, que é o que o servidor
 * precisa nomear para compor o agregado.
 */
const esquemaDoContratoVigente = z.object({
  codigo: ESQUEMA_DO_CODIGO_DE_CONTRATO,
  locatario: z.object({ id: z.uuid(), nome: z.string() }),
});

/** O contrato vigente do imóvel, como a API o devolve. */
export type ContratoVigenteDoImovel = z.infer<typeof esquemaDoContratoVigente>;

/**
 * O imóvel como a API o devolve — com os cômodos e a metragem total já derivada.
 *
 * `statusLocacao` lê o enum **completo**: a saída precisa devolver `LOCADO`, que a fatia de
 * contratos produz. Ver o cabeçalho deste arquivo.
 *
 * `metragemTotal` é a soma das metragens dos cômodos (RN-02), derivada na leitura num ponto único —
 * não é coluna. Declará-la no contrato é o que impede a divergência entre o agregado e as partes de
 * ser representável.
 *
 * **Ela não recebe restrição de escala, e é o campo em que isso mais importa**: sendo soma de ponto
 * flutuante, ela sai da escala em cerca de 1% dos casos, e uma restrição aqui derrubaria a rota em
 * vez de recusar. O motivo, os números medidos e o exemplo verificável estão no marcador
 * `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`, em `comum.ts` — e **só lá**, de propósito: exemplo
 * copiado para dois lugares foi o que fez um erro de ilustração virar três edições coordenadas.
 *
 * `contratoVigente` é **derivado** como a metragem, e não é coluna: ele é o contrato `ATIVO` daquele
 * imóvel, lido em lote na camada de dados. Ele nasce **aqui**, e não num esquema de imóvel próprio da
 * fatia de contratos, porque um segundo esquema seria a segunda fonte do mesmo fato (ADR-0016) — e é
 * essa unicidade que faz o campo aparecer, **por consequência**, nas três superfícies que publicam
 * imóvel: `GET /v1/imoveis/:id`, `GET /v1/imoveis` e a carteira `GET /v1/conjuntos?expandir=imoveis`,
 * esta última porque `esquemaDoConjuntoComImoveis` reusa este esquema inteiro.
 *
 * `null` quer dizer *nenhum contrato vigente* — o que inclui o imóvel que só tem rascunho e o que
 * teve o contrato cancelado. E a **retirada de circulação do contrato não o zera**: um contrato
 * `ATIVO` retirado continua vigente e continua ocupando o imóvel (RN-15, ADR-0014), porque a marca de
 * circulação é de visibilidade e é **ortogonal** ao estado.
 */
export const esquemaDoImovel = z.object({
  id: z.uuid(),
  conjuntoId: z.uuid(),
  nomeImovel: z.string(),
  identificadorMunicipal: z.string(),
  tipoImovel: z.enum(TIPOS_DE_IMOVEL),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().nullable(),
  bairro: z.string(),
  cidade: z.string(),
  estado: z.string(),
  cep: z.string(),
  statusLocacao: z.enum(SITUACOES_DE_LOCACAO),
  observacoes: z.string().nullable(),
  comodos: z.array(esquemaDoComodo),
  metragemTotal: z.number(),
  contratoVigente: esquemaDoContratoVigente.nullable(),
  retiradoEm: z.iso.datetime().nullable(),
});

/** O imóvel como a API o devolve. */
export type Imovel = z.infer<typeof esquemaDoImovel>;

/**
 * A janela de `GET /v1/imoveis` — a de circulação **mais** o recorte por situação de locação.
 *
 * Ela estende {@link esquemaDaJanelaComCirculacao} em vez de redeclarar os três parâmetros, de modo
 * que o teto que recusa, o padrão da página e a união fechada de `incluirRetirados` continuam tendo
 * **um** lugar (ADR-0016).
 *
 * ---------------------------------------------------------------------------
 * Ele lê o enum COMPLETO, e não {@link SITUACOES_INFORMAVEIS}
 * ---------------------------------------------------------------------------
 *
 * A assimetria entre entrada e saída deste arquivo é sobre **quem escreve** a situação: o usuário
 * informa `DISPONIVEL` ou `INDISPONIVEL`, e `LOCADO` é produzido pela fatia de contratos. Um
 * **filtro** não escreve nada — ele recorta o que já está gravado —, e `LOCADO` é justamente o
 * estado que a tela mais quer contar. Ler {@link SITUACOES_INFORMAVEIS} aqui tornaria inalcançável
 * por recorte o único valor que o produto deriva sozinho.
 *
 * É o mesmo critério, e a mesma direção, de `esquemaDoImovel.statusLocacao` logo acima: quem publica
 * ou recorta lê os três; quem aceita do cliente lê os dois.
 *
 * O filtro nasce **no esquema**, e não numa conferência escrita no controlador: é o que faz
 * `?statusLocacao=VAGO` (rótulo que não existe) responder `422` **nomeando o parâmetro**, em vez de
 * devolver a página vazia de uma situação inventada. Ele aceita **um** valor por requisição, e a
 * ausência é *sem filtro* — a carteira inteira.
 *
 * ⚠️ **`JanelaDeImoveis` é homônimo de um tipo de `@sysloc/db`**, que é a janela **da porta** —
 * limite e deslocamento, sem filtro nenhum. Os dois convivem como `JanelaDaCarteira` já convive, e
 * nunca se encontram no mesmo `import`: a borda traduz um no outro.
 */
export const esquemaDaJanelaDeImoveis = esquemaDaJanelaComCirculacao.extend({
  statusLocacao: z.enum(SITUACOES_DE_LOCACAO).optional(),
});

/** A janela da carteira de imóveis, com os padrões já aplicados. */
export type JanelaDeImoveis = z.infer<typeof esquemaDaJanelaDeImoveis>;
