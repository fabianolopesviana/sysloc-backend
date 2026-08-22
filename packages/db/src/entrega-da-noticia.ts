/**
 * O **estado da entrega da notícia do provedor** — leitura e escrita, por empresa.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE É
 * ---------------------------------------------------------------------------
 *
 * A entrega da notícia é o canal pelo qual o provedor bancário avisa o produto de que algo aconteceu
 * com um título. Habilitá-la é ato de configuração da empresa, e o desfecho da última tentativa —
 * habilitada, ou recusada com motivo — é o que a tela do Admin exibe.
 *
 * A verdade sobre a entrega mora no provedor; esta linha é a **cópia durável** do que a última
 * verificação apurou. Consultar o provedor ao vivo a cada leitura foi podado no discovery, e a razão
 * é a que sustenta este módulo inteiro: **a recusa precisa sobreviver à requisição**. Sem a cópia,
 * o Admin que fechasse a tela perderia o motivo pelo qual a habilitação falhou.
 *
 * ---------------------------------------------------------------------------
 * SUBSTITUI, NÃO ACUMULA (RN-04) — e é o BANCO que garante isso
 * ---------------------------------------------------------------------------
 *
 * {@link gravarDesfechoDaEntrega} é `INSERT … ON CONFLICT … DO UPDATE` sobre
 * `entrega_da_noticia_empresa_key`, a restrição única de `empresa_id`. Uma instrução só, e não um
 * `SELECT` seguido de `INSERT` ou `UPDATE`: entre a leitura que não achou e a gravação, outra
 * transação grava — é a corrida disfarçada que o `CLAUDE.md` nomeia, e a unicidade por empresa é o
 * que a torna impossível em vez de improvável.
 *
 * ⚠️ **Não há histórico**, e a ausência é a decisão (D7): a tabela de tentativas foi rejeitada
 * porque a RN-04 pede o oposto da retenção. A trilha bancária também não serve de vaso — ela é
 * ancorada em **cobrança**, com lista fechada de rótulos, e a habilitação não é sobre cobrança
 * alguma.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA COMPARAÇÃO DE EMPRESA — a ADR-0008 aplicada à letra
 * ---------------------------------------------------------------------------
 *
 * Nenhuma função deste módulo recebe `empresaId`, e nenhuma consulta leva `WHERE empresa_id`. Quem
 * recorta é a política de isolamento da `0024`, com RLS **forçada**. Repetir o recorte aqui seria a
 * "defesa em profundidade" que a `Decision` da ADR-0008 rejeita por escrito: dois caminhos para o
 * mesmo dado divergem com o tempo, e o filtro redundante ensina a confiar nele.
 *
 * O único lugar onde a empresa do contexto aparece é a cláusula de **valores** do `INSERT`, por
 * {@link empresaDoContexto} — e ali ela não duplica caminho nenhum: `empresa_id` é `NOT NULL` e sem
 * padrão, de modo que a instrução precisa *propor* um valor, e o único legítimo é o que a própria
 * política leria.
 *
 * ---------------------------------------------------------------------------
 * O RELÓGIO É O DO BANCO (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * O instante da verificação é `pg_catalog.now()`, avaliado pelo servidor dentro da mesma instrução
 * que grava. **Ele não é parâmetro**, e {@link DadosDoDesfechoDaEntrega} deliberadamente não tem
 * campo para ele: um instante recebido de fora faria o carimbo depender de qual máquina atendeu a
 * requisição, e um `new Date()` aqui faria o mesmo. Não há leitura de relógio do processo neste
 * caminho.
 *
 * ---------------------------------------------------------------------------
 * O TETO ANTI-ABUSO DO DIAGNÓSTICO VIGORA AQUI, e não no contrato publicado
 * ---------------------------------------------------------------------------
 *
 * O `diagnostico` vem de terceiro, e *"o que se guarda vem de terceiro e não se pode bounded por
 * confiança"* (§3.3 da T5). Quem aplica o teto é {@link limitarDiagnostico}, chamada por
 * {@link gravarDesfechoDaEntrega} — **este módulo, e nenhum outro**.
 *
 * ⚠️ **A alternativa idiomática foi medida e descartada**: os dois `.refine()` de
 * `esquemaDoMotivoDaRecusa`, em `@sysloc/contracts`, expressam o mesmo teto num esquema de **saída**
 * — e esquema de saída **nunca é `parse`ado em execução** nesta base (o único `parse` da borda é o de
 * entrada, em `apps/api/src/comum/validacao.ts`), nem sobrevive ao `z.toJSONSchema` que publica o
 * documento. Declarado só ali, o teto ficava inoperante enquanto **parecia** uma guarda, e a coluna
 * `motivo_diagnostico jsonb` da `0023` não tem teto próprio.
 *
 * **Por que ESTE ponto fecha a classe**: `packages/db` é o único lugar onde existe instrução SQL
 * (topologia do `CLAUDE.md`), e {@link gravarDesfechoDaEntrega} é a **única** que escreve
 * `motivo_diagnostico`. Não há segundo caminho para gravar — nem para o adaptador, nem para a borda,
 * nem para o processo de trabalho —, de modo que esquecer de limitar deixa de ser possível.
 */

import { MAIOR_DIAGNOSTICO_EM_CARACTERES, MAIOR_DIAGNOSTICO_EM_CHAVES } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * Por que o provedor recusou, **verbatim** — os três campos vêm dele e não são reescritos.
 *
 * O `diagnostico` é portador **sem esquema** por decisão: os campos que ele carrega variam por
 * código de recusa, e projetá-los em colunas obrigaria a recusar o que ainda não se entende. Ele é
 * anulável mesmo com motivo presente — variar inclui não haver nenhum.
 *
 * ⚠️ **O que se grava é o que {@link limitarDiagnostico} deixa passar**, e não necessariamente o que
 * chega neste campo: o teto anti-abuso vigora no ponto da escrita. Ver a seção do cabeçalho.
 */
export interface MotivoDaRecusaDoProvedor {
  readonly codigo: string;
  readonly mensagem: string;
  readonly diagnostico: Record<string, unknown> | null;
}

/**
 * O que uma tentativa apurou — o que se grava.
 *
 * ⚠️ **Não há campo de instante**, e a ausência é a ADR-0026: ver o cabeçalho.
 *
 * A coerência entre `habilitada` e `motivo` não é conferida aqui, e a omissão é deliberada: quem a
 * garante é a `CHECK` `entrega_da_noticia_coerencia_chk`, de modo que o estado meio preenchido é
 * **irrepresentável** em vez de apenas não produzido. Uma segunda conferência nesta camada seria a
 * segunda declaração da mesma regra, livre para divergir da que o banco impõe.
 */
/**
 * Os três estados da entrega junto ao provedor — o vocabulário do PRODUTO, e nunca o do provedor.
 *
 * ⚠️ **É lista fechada e congelada**, e a âncora que a afirma vive no contrato publicado: o terceiro
 * estado não pode nascer sem que este símbolo mude.
 */
export const SITUACOES_DA_ENTREGA = Object.freeze([
  'HABILITADA',
  'EM_VALIDACAO',
  'DESABILITADA',
] as const);

/** A situação da entrega, como o produto a nomeia. */
export type SituacaoDaEntrega = (typeof SITUACOES_DA_ENTREGA)[number];

export interface DadosDoDesfechoDaEntrega {
  /**
   * O estado da entrega junto ao provedor — **três** valores desde a `0025`.
   *
   * ⚠️ **`habilitada` é DERIVADA daqui**, e quem grava não a informa: a `CHECK`
   * `entrega_da_noticia_situacao_chk` amarra as duas no banco, e derivá-la num lugar só é o que
   * impede o produto de ter duas fontes de verdade para o mesmo fato.
   */
  readonly situacao: SituacaoDaEntrega;
  /** Presente **só** quando a tentativa recusou. `null` quando a entrega ficou habilitada. */
  readonly motivo: MotivoDaRecusaDoProvedor | null;
  /**
   * Quem tentou. `null` quando não há usuário à frente — é o caso da reconferência enfileirada,
   * que corre no processo de trabalho.
   */
  readonly verificadaPor: string | null;
  /**
   * A referência **opaca** ao cadastro junto ao provedor, quando o produto sabe que ele é seu.
   *
   * Nada aqui a interpreta. Ela responde uma pergunta só, na tentativa seguinte — *"a vaga é ocupada
   * por um cadastro que eu criei?"* —, e é essa resposta que autoriza corrigir o endereço dele sem
   * tocar cadastro de terceiro. `null` quando não há o que referenciar.
   */
  readonly referenciaNoProvedor: string | null;
}

/**
 * O estado como ele está gravado.
 *
 * `verificadaEm` nulo é *"nunca houve tentativa"* (CA-19), e é por isso que ele nunca é preenchido
 * com um instante de conveniência: o nulo é conteúdo, e não ausência de dado.
 */
export interface EstadoDaEntregaGravado {
  readonly id: string;
  readonly habilitada: boolean;
  /** O ternário; `habilitada` acima é a projeção booleana dele, amarrada pela `CHECK`. */
  readonly situacao: SituacaoDaEntrega;
  readonly verificadaEm: Date | null;
  readonly motivo: MotivoDaRecusaDoProvedor | null;
  readonly verificadaPor: string | null;
  /** A referência opaca ao cadastro — é ela que a consulta seguinte usa para provar propriedade. */
  readonly referenciaNoProvedor: string | null;
}

/** A linha como o banco a devolve — colunas planas, antes de o motivo virar objeto. */
interface LinhaDoEstado {
  readonly id: string;
  readonly habilitada: boolean;
  readonly situacao: SituacaoDaEntrega;
  readonly referenciaNoProvedor: string | null;
  readonly verificadaEm: Date | null;
  readonly motivoCodigo: string | null;
  readonly motivoMensagem: string | null;
  readonly motivoDiagnostico: Record<string, unknown> | null;
  readonly verificadaPor: string | null;
}

/**
 * A projeção, escrita num lugar só para as duas consultas.
 *
 * ⚠️ **Fragmento do próprio `tx`, e não `tx.unsafe(<cadeia>)`** — mesma forma, e mesma razão medida,
 * de `identidade-no-provedor.ts`: interpolar cadeia crua num template de `postgres.js` produz
 * consulta malformada, e o sintoma é um `500` na borda em vez de erro de compilação.
 */
function colunasDoEstado(tx: TransactionSql) {
  return tx`
    id,
    habilitada,
    situacao,
    referencia_no_provedor AS "referenciaNoProvedor",
    verificada_em       AS "verificadaEm",
    motivo_codigo       AS "motivoCodigo",
    motivo_mensagem     AS "motivoMensagem",
    motivo_diagnostico  AS "motivoDiagnostico",
    verificada_por      AS "verificadaPor"
  `;
}

/**
 * Compõe o motivo a partir das colunas planas.
 *
 * O discriminador é `motivo_codigo`, e a **mensagem é conferida junto**: a `CHECK` de coerência
 * amarra os dois, de modo que um sem o outro é irrepresentável — mas conferir custa uma linha e
 * transforma o impossível em **ausência declarada**, em vez de num `''` de conveniência que
 * chegaria à tela do Admin como uma recusa sem explicação. Mesmo cuidado, e mesma razão, da
 * conferência entre as duas leituras de `identidade-no-provedor.ts`.
 */
function comporEstado(linha: LinhaDoEstado): EstadoDaEntregaGravado {
  const comum = {
    id: linha.id,
    habilitada: linha.habilitada,
    situacao: linha.situacao,
    referenciaNoProvedor: linha.referenciaNoProvedor,
    verificadaEm: linha.verificadaEm,
    verificadaPor: linha.verificadaPor,
  } as const;

  if (linha.motivoCodigo === null) {
    return { ...comum, motivo: null };
  }

  if (linha.motivoMensagem === null) {
    throw new Error(
      'o motivo da recusa da entrega da notícia tem código sem mensagem — estado que a `CHECK` de coerência torna irrepresentável',
    );
  }

  return {
    ...comum,
    motivo: {
      codigo: linha.motivoCodigo,
      mensagem: linha.motivoMensagem,
      diagnostico: linha.motivoDiagnostico,
    },
  };
}

/**
 * O estado da empresa do contexto. `undefined` quando ela nunca foi configurada.
 *
 * `undefined` é estado legítimo, e não falha: a empresa que nunca abriu a tela não tem linha. Quem
 * chama decide o que publicar — e a borda publica o estado *desabilitado e sem verificação*, que é
 * o mesmo que a linha da empresa que tentou e não conseguiu registrar nada diria.
 *
 * ⚠️ **Sem `WHERE empresa_id`** — ver o cabeçalho. Sob o contexto de outra empresa esta consulta
 * devolve vazio porque a política a recorta, e não porque a aplicação a filtrou.
 */
export async function lerEstadoDaEntrega(
  tx: TransactionSql,
): Promise<EstadoDaEntregaGravado | undefined> {
  const [linha] = await tx<LinhaDoEstado[]>`
    SELECT ${colunasDoEstado(tx)}
      FROM negocio.entrega_da_noticia
  `;

  return linha === undefined ? undefined : comporEstado(linha);
}

/**
 * Aplica o teto anti-abuso ao diagnóstico — **trunca, e não recusa**.
 *
 * ---------------------------------------------------------------------------
 * A assimetria decide o verbo: perder parte do diagnóstico é barato; perder a recusa, não
 * ---------------------------------------------------------------------------
 *
 * É o mesmo argumento que o docblock de `MAIOR_DIAGNOSTICO_EM_CHAVES` já faz em `@sysloc/contracts`,
 * levado à sua consequência. Recusar a gravação por excesso de diagnóstico apagaria **o fato inteiro**
 * — `codigo` e `mensagem` junto —, e o Admin ficaria sem saber por que a entrega não subiu, que é
 * exatamente o que a RN-02 manda preservar. Truncar perde o excedente e mantém a recusa.
 *
 * O descarte é **por chave inteira, na ordem em que o provedor as devolveu** (`Object.keys` preserva
 * a ordem de inserção), e **para na primeira que não couber** em vez de continuar catando as menores:
 * *"as chaves que couberam, na ordem em que chegaram"* é regra que se lê no dado gravado, enquanto
 * *"as que couberam por acaso"* produziria um recorte que ninguém consegue explicar depois. Nenhum
 * **valor** é reescrito — o que sobrevive sobrevive verbatim, e é isso que mantém verdadeira a
 * promessa dos três campos.
 *
 * ⚠️ **Os dois eixos são conferidos, e o de tamanho é medido sobre a serialização acumulada** —
 * que é a forma exata em que a coluna `jsonb` recebe o valor. Trinta e duas chaves comportam um
 * megabyte se uma delas carregar um texto imenso; por isso o teto de chaves sozinho não fecha.
 *
 * ⚠️ **Registro vazio NÃO é o mesmo que ausência.** `null` continua sendo *"o provedor recusou e não
 * mandou campo variável nenhum"*, e o truncamento **nunca** o produz: ele só devolve `null` para
 * `null`. O caso extremo — a primeira chave já estourando o teto sozinha — sai como `{}`, que é o
 * registro esvaziado, e a ambiguidade com *"o provedor mandou objeto vazio"* é inócua porque **nenhum
 * ramo do produto lê dentro do diagnóstico**.
 */
function limitarDiagnostico(
  diagnostico: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (diagnostico === null) {
    return null;
  }

  // DECISÃO FECHADA — T5 / Gate 2 rodada 2 · 2026-08-22
  // O QUÊ: o registro truncado é composto por `Object.fromEntries` sobre as entradas aceitas — e
  //        NUNCA por atribuição indexada (`limitado[chave] = …`) num acumulador mutável.
  // POR QUÊ: a forma idiomática usava duas primitivas para o mesmo registro — media com spread
  //          (DefineProperty, propriedade própria) e gravava com atribuição (Set, que invoca setter
  //          herdado). As duas divergem em `__proto__`, que é chave PRÓPRIA quando o objeto vem de
  //          `JSON.parse` — que é exatamente como a resposta do provedor entra: a chave cabia nos
  //          dois eixos e sumia em silêncio, o objeto medido deixava de ser o gravado, e o
  //          `[[Prototype]]` do acumulador era trocado no meio da montagem.
  // REVERTER EXIGE: provar que medição e escrita continuam usando a MESMA primitiva de criação de
  //                 propriedade, para toda chave que o provedor possa devolver — tratar `__proto__`
  //                 como caso especial não satisfaz este campo, porque fecha a ocorrência e deixa a
  //                 divergência de primitiva de pé.
  const aceitas: [string, unknown][] = [];

  for (const chave of Object.keys(diagnostico).slice(0, MAIOR_DIAGNOSTICO_EM_CHAVES)) {
    const entrada: [string, unknown] = [chave, diagnostico[chave]];
    const candidato = Object.fromEntries([...aceitas, entrada]);
    if (JSON.stringify(candidato).length > MAIOR_DIAGNOSTICO_EM_CARACTERES) {
      break;
    }
    aceitas.push(entrada);
  }

  return Object.fromEntries(aceitas);
}

/**
 * Grava o desfecho de uma tentativa, **substituindo** o anterior (RN-04).
 *
 * Uma instrução só, com `ON CONFLICT (empresa_id) DO UPDATE`. Ver o cabeçalho para por que não é um
 * `SELECT` seguido de escrita, e por que o instante nasce do banco.
 *
 * ⚠️ **A reconsulta que nada muda não gera registro novo** (RN-15) por construção: a linha é a
 * mesma, e o que a tentativa faz é reescrevê-la. Não há o que acumular.
 */
export async function gravarDesfechoDaEntrega(
  tx: TransactionSql,
  dados: DadosDoDesfechoDaEntrega,
): Promise<EstadoDaEntregaGravado> {
  // ⚠️ **`::text::jsonb`, e não `::jsonb` nem parâmetro sem cast.** A razão está medida e registrada
  // em `notificacao-bancaria.ts`: o driver infere o tipo do parâmetro pelo destino e, vendo `jsonb`,
  // aplica o serializador de JSON à cadeia que já é JSON — o que fica no banco é a *string* do
  // objeto, e o defeito só aparece na leitura. O `::text` fixa o parâmetro em texto, e o segundo
  // cast é o servidor interpretando esse texto como JSON. `null` atravessa os dois casts como nulo.
  //
  // ⚠️ **O teto anti-abuso é aplicado AQUI, antes de serializar** — ver {@link limitarDiagnostico} e
  // a seção do cabeçalho. Este é o ponto que *guarda*, e é por isso que ele é o ponto que limita.
  const diagnostico = limitarDiagnostico(dados.motivo?.diagnostico ?? null);
  const diagnosticoSerializado = diagnostico === null ? null : JSON.stringify(diagnostico);

  const [linha] = await tx<LinhaDoEstado[]>`
    INSERT INTO negocio.entrega_da_noticia
                (empresa_id, habilitada, situacao, referencia_no_provedor, verificada_em,
                 motivo_codigo, motivo_mensagem, motivo_diagnostico, verificada_por)
    VALUES (${empresaDoContexto(tx)}, ${dados.situacao === 'HABILITADA'}, ${dados.situacao},
            ${dados.referenciaNoProvedor}, pg_catalog.now(),
            ${dados.motivo?.codigo ?? null}, ${dados.motivo?.mensagem ?? null},
            ${diagnosticoSerializado}::text::jsonb, ${dados.verificadaPor})
    ON CONFLICT ON CONSTRAINT entrega_da_noticia_empresa_key DO UPDATE
       SET habilitada             = EXCLUDED.habilitada,
           situacao               = EXCLUDED.situacao,
           referencia_no_provedor = EXCLUDED.referencia_no_provedor,
           verificada_em          = EXCLUDED.verificada_em,
           motivo_codigo          = EXCLUDED.motivo_codigo,
           motivo_mensagem        = EXCLUDED.motivo_mensagem,
           motivo_diagnostico     = EXCLUDED.motivo_diagnostico,
           verificada_por         = EXCLUDED.verificada_por
    RETURNING ${colunasDoEstado(tx)}
  `;

  if (linha === undefined) {
    throw new Error('a gravação do desfecho da entrega da notícia não devolveu linha');
  }

  return comporEstado(linha);
}
