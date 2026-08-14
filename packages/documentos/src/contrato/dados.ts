/**
 * A **entrada** da composição do documento do contrato — o agregado já resolvido.
 *
 * ===========================================================================
 * Por que o tipo nasce AQUI, e não na camada que o produz
 * ===========================================================================
 *
 * É a ADR-0025 aplicada à fronteira de **dados**: quem exige o dado declara a forma dele, e o
 * adaptador importa daqui para dizer que a satisfaz. A composição nunca recebe linha de banco — é a
 * camada de dados (T7) que traduz o resultado da consulta neste agregado. A alternativa idiomática
 * (o tipo nascer em `@sysloc/db`, junto da consulta que o produz) foi descartada porque fecharia o
 * ciclo `@sysloc/db ↔ @sysloc/documentos`, e o Turborepo **aborta o build inteiro** antes de compilar
 * qualquer coisa — ver o cabeçalho de `../../tsconfig.json`.
 *
 * ===========================================================================
 * Os campos DERIVAM do contrato publicado, e não são redigitados
 * ===========================================================================
 *
 * ADR-0016: o esquema de `@sysloc/contracts` é a fonte única. Cada bloco abaixo é um `Pick` sobre o
 * tipo publicado, de modo que renomear um campo lá **quebra a compilação aqui** — que é exatamente o
 * efeito desejado. Redigitar `{ nome: string; cep: string; … }` produziria uma segunda declaração do
 * mesmo fato, livre para divergir na primeira emenda (foi a causa dos débitos D38 e D40).
 *
 * O que se colhe é o **subconjunto que o documento imprime**, e a estreiteza é conteúdo: o documento
 * não fala de `id`, de `retiradoEm`, de `metragemTotal` nem de `status`. Em particular, **`status`
 * não entra** — a marca de cancelamento chega por parâmetro da composição, e é essa ignorância que
 * impede a marca de virar consequência de outra coisa (RN-02).
 *
 * ===========================================================================
 * O instante do fecho chega RESOLVIDO, e nunca é lido do relógio do processo
 * ===========================================================================
 *
 * ADR-0026: o relógio da operação mora no banco. {@link DadosDoContratoParaDocumento.dataDeEmissao}
 * é a data corrente da operação, já apurada por quem abriu a unidade de trabalho, e chega como
 * `AAAA-MM-DD`. Um `new Date()` aqui leria o relógio do processo e o fuso do host — o mesmo defeito
 * que `packages/regua/src/mensagem.ts` documenta —, e faria a composição deixar de ser função pura
 * da entrada, que é a propriedade que a T5 existe para instalar.
 */

import type { Contrato, Imovel, Pessoa } from '@sysloc/contracts';

/**
 * Uma parte do contrato — locador, locatário ou fiador — como o documento a qualifica.
 *
 * Os três papéis compartilham a **forma**, e é por isso que há um tipo só: o que os separa é a
 * posição no documento, não os campos. É a mesma razão registrada em
 * `packages/contracts/src/pessoa.ts` para haver um `esquemaDaPessoa` único.
 *
 * `documentoPrincipal` chega **em dígitos**, como o banco o guarda; a máscara (`111.222.333-44`) é
 * apresentação e é decidida na qualificação. `rg` é `null` quando a parte não tem cédula de
 * identidade civil a declarar, e a ausência **omite o trecho inteiro** — nunca emite vazio.
 */
export type ParteDoContrato = Pick<
  Pessoa,
  | 'nome'
  | 'tipoPessoa'
  | 'documentoPrincipal'
  | 'rg'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'estado'
  | 'cep'
>;

/**
 * O imóvel como o documento o identifica — o nome e o endereço, e nada além.
 *
 * A cidade e o estado daqui têm **dois** usos no documento: o endereço da cláusula primeira e a
 * praça do fecho, que o legado escreve uma segunda vez antes da data. Os dois saem do mesmo campo,
 * e é essa a razão de o fecho não receber praça própria.
 */
export type ImovelDoContrato = Pick<
  Imovel,
  'nomeImovel' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'estado' | 'cep'
>;

/**
 * Os termos econômicos e temporais que o documento imprime.
 *
 * ⚠️ **`valorTotalContrato` chega RESOLVIDO por parâmetro, e nunca nulo** — é o mesmo desenho que
 * {@link DadosDoContratoParaDocumento.dataDeEmissao} já exerce por ADR-0026, e aqui a razão é a
 * **ADR-0023**: *"a derivação de um valor não persistido vive no banco … quando compõe aritmética
 * monetária"*. No contrato publicado o campo é anulável, porque quem o deriva é a ativação e o
 * contrato nasce `RASCUNHO` com ele nulo (RD-10). Derivá-lo aqui — `valorMensal × prazoMeses` — seria
 * pôr aritmética monetária sobre valor não persistido dentro da aplicação, e faria o mesmo contrato
 * ser avaliado em dois lugares: a rota publicaria `valorTotalContrato: null` enquanto o documento
 * imprimiria `R$ 30.000,00`. É textualmente o defeito que o `Context` da ADR-0023 nomeia como origem
 * dela.
 *
 * **Quem resolve é a consulta da T7**, por `COALESCE(valor_total_contrato, valor_mensal *
 * prazo_meses)` em `numeric` — decimal exato, num lugar só. Este pacote não tem como refazê-la: o
 * `null` não passa pelo tipo, e é essa impossibilidade que substitui a disciplina.
 *
 * A sobreposição sobre o `Pick<>` de `@sysloc/contracts` **não redigita** o tipo do campo: ele
 * continua derivado do publicado por `NonNullable<…>`, de modo que trocar `number` por outra coisa
 * lá quebra a compilação aqui (ADR-0016). O que a sobreposição retira é a nulidade, e só ela.
 */
export type TermosDoContrato = Pick<Contrato, 'prazoMeses' | 'valorMensal' | 'diaVencimento'> & {
  readonly valorTotalContrato: NonNullable<Contrato['valorTotalContrato']>;
};

/**
 * O agregado já resolvido que a composição do documento consome.
 *
 * `fiadores` vazio é o contrato **sem** fiador, e o bloco correspondente simplesmente não existe no
 * documento — não é um bloco vazio, e não é um bloco com traço. A distinção é o que o CT-703 mede.
 */
export interface DadosDoContratoParaDocumento {
  readonly contrato: TermosDoContrato;
  readonly locador: ParteDoContrato;
  readonly locatario: ParteDoContrato;
  readonly imovel: ImovelDoContrato;
  readonly fiadores: readonly ParteDoContrato[];
  /** A data corrente da operação, `AAAA-MM-DD`, apurada pelo banco (ADR-0026). */
  readonly dataDeEmissao: string;
}

/**
 * As opções da composição — hoje uma só, e a estreiteza é deliberada.
 *
 * `cancelado` é **derivado pela borda** de `contrato.status === 'CANCELADO'` (§5.1-A passo 4). A
 * composição não conhece `status`, e por isso a marca não pode virar consequência de outra coisa:
 * não existe, aqui dentro, um segundo caminho que a ligue.
 */
export interface OpcoesDoDocumentoDoContrato {
  readonly cancelado: boolean;
}
