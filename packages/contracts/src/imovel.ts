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
 */

import { z } from 'zod';
import { esquemaDoComodo } from './comodo.js';
import {
  camposDeEndereco,
  ESQUEMA_DO_IDENTIFICADOR,
  MAIOR_TEXTO_CURTO,
  MAIOR_TEXTO_LIVRE,
} from './comum.js';

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
 * Corpo fechado da criação e da alteração de imóvel (§4.1.1).
 *
 * Completo e sem campo opcional implícito: as duas rotas carregam os mesmos treze campos, porque
 * **não há atualização parcial nesta fatia**. Campo ausente é recusa por campo obrigatório, nunca
 * "preserve o valor atual".
 *
 * `conjuntoId` é canonizado pelo {@link ESQUEMA_DO_IDENTIFICADOR} — ele vira chave estrangeira
 * composta e é comparado com valor lido do banco, que é exatamente o cenário em que as duas pontas
 * concordam sobre a identidade e discordam sobre a grafia. Trocar o conjunto pelo `PUT` é operação
 * legítima de cadastro (§5.2), e o destino passa pela mesma conferência de alcance da criação.
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

/** O corpo aceito na criação e na alteração de imóvel. */
export type ImovelNovo = z.infer<typeof esquemaDeImovelNovo>;

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
  retiradoEm: z.iso.datetime().nullable(),
});

/** O imóvel como a API o devolve. */
export type Imovel = z.infer<typeof esquemaDoImovel>;
