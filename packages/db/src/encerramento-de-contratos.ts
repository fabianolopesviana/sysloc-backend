/**
 * Encerramento do contrato de locação vencido — a transição **pareada** contrato→imóvel, numa
 * unidade de trabalho só.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA OPERAÇÃO MORA AQUI, E NÃO NO SERVIÇO QUE A CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./contrato.ts}, {@link ./imovel.ts} e {@link ./execucao-de-rotina.ts} já
 * registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um processo com o
 * executor da unidade de trabalho em mãos escreve `negocio.contrato` numa cadeia sem importar nada
 * de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** {@link encerrarContratosVencidos} **recebe** o executor (`tx`) de quem
 * já abriu a unidade; ela não abre conexão, reserva ou transação, e não devolve executor.
 *
 * ---------------------------------------------------------------------------
 * ELA É O PRIMEIRO ATO DE ESTADO **SEM ATOR** DO PRODUTO (ADR-0021, emenda de 2026-08-22)
 * ---------------------------------------------------------------------------
 *
 * A ADR-0021 tem duas metades, e a emenda de 2026-08-22 — que nomeia esta fatia — declara o alcance
 * de cada uma quando não há requisição. A **categórica** (*rota própria, nunca campo gravado por
 * atualização parcial do recurso*) vale sem exceção e é cumprida **por construção**: não há recurso
 * sendo editado, e `status` não existe em `esquemaDeContratoNovo` nem em `esquemaDeContratoAlterado`.
 * A da **governança** (*exige a chave do catálogo, ou exige apenas a área*) **pressupõe uma sessão a
 * autorizar**, e aqui não há sujeito — só o vencimento. O que governa é a **procedência da carga**
 * (ADR-0024): a empresa vem de quem já detinha direito a ela, a enumeração do despachante.
 *
 * ⚠️ **Isto NÃO fundamenta um encerramento manual pela tela.** A mesma emenda o diz por escrito: o
 * ato equivalente **com** ator transfere direito — libera o imóvel para nova locação — e seria da
 * primeira classe, sem chave correspondente no catálogo fechado da ADR-0011. Publicá-lo exige
 * decisão nova, e ela não está tomada.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA **NÃO** MOVE, E A AUSÊNCIA É A DECISÃO (ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * Ela move `contrato.status`, que é **atributo do cadastro** e sempre foi coluna gravada — as duas
 * transições que já existiam (`ativarContrato`, `cancelarContrato`) o escrevem pela mesma tabela.
 * Ela **não** toca o estado da Cobrança nem a Mora: esses são **derivados na leitura**
 * (`negocio.cobranca_derivada`), e a `Decision` da ADR-0022 diz que *"o estado publicado de um fato
 * financeiro é derivado dos fatos gravados, nunca uma coluna movida por rotina"*. As duas rotinas do
 * sistema antigo que os moviam (`marcar_cobrancas_vencidas`, `atualizar_atrasos_cobrancas`) **não
 * têm sucessora, e isso é desenho** (RN-14/RD-14). Não confunda uma coisa com a outra.
 *
 * ---------------------------------------------------------------------------
 * O RELÓGIO É O DO BANCO, E SÓ ELE (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * O que decide se um contrato venceu é `negocio.data_corrente_da_operacao()`, avaliada **dentro da
 * consulta**. Não há `new Date(`, `Date.now(`, `getHours(` nem `getTime(` em posição executável neste
 * arquivo, e não pode haver: o fuso da operação é propriedade do **objeto**, e um relógio de processo
 * faria a mesma empresa encerrar um dia antes num host e um dia depois noutro, sem uma linha vermelha
 * em lugar nenhum. É o `CT-1061` que varre a ausência.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DAS DUAS ESCRITAS É A INVERSA DA ATIVAÇÃO — e é ela que fecha a janela
 * ---------------------------------------------------------------------------
 *
 * Primeiro o contrato (`ATIVO → ENCERRADO`), **depois** o imóvel. Encerrar **libera** a posição do
 * índice único parcial `contrato_imovel_vigente_uidx`, de modo que uma ativação concorrente sobre o
 * mesmo imóvel **ou** é recusada pelo índice — enquanto o encerramento não commitou — **ou** ocorre
 * **depois** de o imóvel já ter sido liberado. **Não há janela em que o imóvel fique `DISPONIVEL`
 * com contrato vigente por causa desta rotina**, e é o `CT-1069` que o afirma nos dois desfechos.
 *
 * Na ordem inversa (imóvel primeiro) a janela existiria: entre liberar o imóvel e encerrar o
 * contrato, um observador enxergaria `DISPONIVEL` com um `ATIVO` apontando para ele.
 *
 * ---------------------------------------------------------------------------
 * A LIBERAÇÃO PASSA PELA PORTA ESTREITA, e ela é CONDICIONAL (RD-20)
 * ---------------------------------------------------------------------------
 *
 * Quem escreve `imovel.status_locacao` é {@link definirSituacaoDeLocacaoDoImovel}, e este módulo é o
 * **quarto** chamador dela — depois da ativação de contrato, do cancelamento e da rota de situação
 * de locação. ⚠️ **Quatro CHAMADORES da porta e três ESCRITORES DO PAR não são o mesmo número**, e
 * nenhum dos dois está errado: a rota move só a situação do imóvel, e não o par contrato-vigente /
 * situação-do-imóvel de que fala o `D44 · F2/T10` — quem o move é a ativação, o cancelamento e esta
 * rotina. **Não "harmonize" as duas contagens.** Um `UPDATE negocio.imovel SET status_locacao` escrito aqui seria a
 * segunda escrita da mesma coluna, livre para divergir da porta na primeira emenda — e a porta
 * **levanta** quando não alcança exatamente uma linha, que é a rede de a escrita não ter efeito em
 * silêncio.
 *
 * ⚠️ **Só `LOCADO → DISPONIVEL`.** O imóvel `INDISPONIVEL` tem o contrato encerrado normalmente e a
 * situação **preservada**, contada em {@link ResultadoDoEncerramento.preservados}. A razão está
 * escrita por extenso em `apps/api/src/imoveis/imovel.service.ts`: *"locar um imóvel `INDISPONIVEL`
 * passa — `INDISPONIVEL` significa 'não ofereça nas buscas', e não 'proibido de locar'"*. O par
 * `INDISPONIVEL` + contrato `ATIVO` é, portanto, **estado legítimo**, e marcá-lo `DISPONIVEL`
 * apagaria uma decisão deliberada do Admin. **Nenhuma RN autoriza isso** — a implementação óbvia
 * (`DISPONIVEL` incondicional) passa em todos os outros casos e falha só no `CT-1097`.
 *
 * ---------------------------------------------------------------------------
 * A SITUAÇÃO DO IMÓVEL É LIDA NA SELEÇÃO, e o par (ler, decidir) NÃO é uma corrida
 * ---------------------------------------------------------------------------
 *
 * A cláusula acima obriga a **ler** a situação antes de decidir, o que costuma ser a
 * leitura-antes-de-gravar que este pacote recusa. Aqui ela não é, e a razão é enumerável: **todo**
 * escritor de `imovel.status_locacao` no produto é barrado pela vigência do contrato enquanto ele
 * está `ATIVO`, e este módulo segura a linha do contrato com `FOR UPDATE` e já gravou nela a
 * transição ainda não commitada.
 *
 *   * a **ativação** de outro contrato sobre o mesmo imóvel bate no `contrato_imovel_vigente_uidx`
 *     antes de alcançar o imóvel, e espera pelo desfecho desta unidade;
 *   * o **cancelamento** do próprio contrato candidato bate no `FOR UPDATE` desta unidade;
 *   * a rota `POST /v1/imoveis/:id/situacao-de-locacao` recusa por **haver contrato vigente**, e sob
 *     `READ COMMITTED` ela enxerga o contrato ainda `ATIVO` até esta unidade commitar.
 *
 * Nada resta que possa mover a coluna entre a leitura e a escrita. ⚠️ **O que fecha isso hoje é a
 * enumeração acima, e não uma restrição do banco** — é o `D44 · F2/T10`, que esta fatia **agrava**
 * (terceiro escritor do par) e **não fecha**: o gatilho literal dele é *"a fatia que criar no banco a
 * restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao`"*, e criá-la não é
 * requisito de nada que o PRD peça. O `CT-1069` é a rede possível enquanto ela não existir.
 *
 * ---------------------------------------------------------------------------
 * A CONCORRÊNCIA É DO `SKIP LOCKED` — nenhum mecanismo de trava novo (RD-13, §21.1 P4)
 * ---------------------------------------------------------------------------
 *
 * Duas passagens sobrepostas da mesma rotina para a mesma empresa: a segunda encontra **conjunto
 * vazio**, não produz efeito e — porque o predicado de efeito é de quem chama (RN-15) — não grava
 * registro. A leitura de CA-22 é *"nenhum efeito duplicado e nenhum registro"*, e não *"a segunda
 * passagem não é iniciada"*, que nenhuma alternativa entrega sem custo desproporcional. As três
 * foram consideradas e **rejeitadas**: `jobId` determinístico falha em silêncio contra a retenção por
 * contagem; `pg_advisory_lock` de sessão amarra uma conexão pela duração da tarefa; tabela de trava
 * obrigaria a gravar linha **antes** de saber se há trabalho, contra a RN-15. **Não introduza
 * mecanismo genérico de trava aqui.**
 *
 * A idempotência do dia seguinte é do **predicado**, e não de uma guarda: o `UPDATE` repete
 * `AND status = 'ATIVO'` (RD-04), de modo que contrato já encerrado não é alcançado e o imóvel dele
 * **não é tocado**.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** As duas tabelas nascem com RLS **forçada** (`0006` e `0008`):
 * a política decide o que a seleção enxerga e o que cada escrita alcança. Não há aqui um
 * `WHERE empresa_id = …` — a defesa em profundidade que a `Decision` da ADR-0008 rejeita por escrito
 * —, e a junção com `negocio.imovel` **não** carrega `AND imovel.empresa_id = contrato.empresa_id`:
 * a coerência do par é da chave estrangeira **composta** `contrato_imovel_empresa_fkey`, que torna o
 * vínculo cruzado impossível pelo banco.
 *
 * Este arquivo **não grava** o registro da passagem: quem decide se houve efeito é quem chama, com o
 * predicado declarado por rotina (RN-15/RD-15) — `candidatos > 0` no encerramento. Trazer a decisão
 * para cá é o modo mais provável de reintroduzir o registro de passagem vazia, o defeito de 12 MB
 * por empresa do sistema antigo.
 */

import type { EstadoDoContrato, SituacaoDeLocacao } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
// A porta estreita da situação de locação — **o único caminho que grava a coluna**. O docblock dela
// registra por que ela é estreita, e por que ela levanta quando não alcança exatamente uma linha.
import { definirSituacaoDeLocacaoDoImovel } from './imovel.js';

/**
 * O resumo de **uma** passagem do encerramento, em vocabulário do produto (RN-19).
 *
 * `candidatos` é o que a seleção alcançou; `encerrados`, quantos o `UPDATE` sob predicado de fato
 * transicionou; `preservados`, quantos tiveram o contrato encerrado **sem** que o imóvel fosse
 * liberado, porque ele não estava `LOCADO` (RD-20). `preservados` é subconjunto de `encerrados`, e
 * não uma quarta categoria somada a eles.
 *
 * É `type`, e não `interface`, e a escolha é conteúdo: só o tipo-alias ganha **índice implícito** em
 * TypeScript, e é ele que torna este resumo atribuível a `ResumoDaPassagem`
 * (`Record<string, number>`) sem redigitar as três chaves no ponto que grava. A redigitação seria a
 * segunda declaração do vocabulário que a RN-19 fixa, livre para divergir na primeira emenda.
 */
export type ResultadoDoEncerramento = {
  readonly candidatos: number;
  readonly encerrados: number;
  readonly preservados: number;
};

/** O que a seleção precisa saber de cada candidato — o contrato, o imóvel dele e a situação dele. */
interface CandidatoAoEncerramento {
  /** A chave exposta do contrato (ADR-0017) — é por ela que o `UPDATE` sob predicado o alcança. */
  readonly codigo: string;
  /** A chave interna do imóvel — o que a porta estreita recebe. */
  readonly imovelId: string;
  /** A situação de locação do imóvel **no instante da seleção** — o que decide a liberação (RD-20). */
  readonly situacaoDoImovel: SituacaoDeLocacao;
}

/**
 * Os três estados que esta rotina **lê ou escreve**, nomeados uma vez cada.
 *
 * A anotação é `EstadoDoContrato` de propósito: literal fora da união fechada de `@sysloc/contracts`
 * **não compila**, e é isso que impede um estado inventado de chegar ao enum do banco. Mesmo
 * mecanismo, e mesma razão, de `ESTADO_VIGENTE` em {@link ./contrato.ts}.
 */
const ESTADO_VIGENTE: EstadoDoContrato = 'ATIVO';
const ESTADO_ENCERRADO: EstadoDoContrato = 'ENCERRADO';

/**
 * As duas situações de locação que a liberação atravessa — e **só** elas.
 *
 * `INDISPONIVEL` não aparece porque esta rotina nunca a escreve nem a compara: o que ela pergunta é
 * se a situação **é** `LOCADO`, e tudo o mais é preservado por omissão. Escrever a terceira aqui
 * convidaria a próxima emenda a tratá-la como caso, e o caso dela é justamente não haver caso.
 */
const SITUACAO_LOCADO: SituacaoDeLocacao = 'LOCADO';
const SITUACAO_DISPONIVEL: SituacaoDeLocacao = 'DISPONIVEL';

/**
 * Encerra os contratos vencidos da empresa do contexto e libera os imóveis deles. Uma passagem.
 *
 * As duas escritas de cada par correm na **mesma unidade de trabalho** que recebeu o executor
 * (RN-03/RD-03): falha em qualquer uma desfaz as duas, e nenhum contrato fica `ENCERRADO` com o
 * imóvel ainda `LOCADO`. Ver o cabeçalho deste arquivo para a ordem, a condição da liberação e por
 * que a leitura da situação do imóvel não é uma corrida.
 *
 * ⚠️ **E a unidade é a PASSAGEM, não o par** — o alcance do desfazimento é maior do que a frase
 * acima, sozinha, deixaria supor. O laço inteiro corre sobre o **mesmo** `tx`, de modo que a falha
 * no terceiro candidato desfaz também o primeiro e o segundo, já encerrados: ou a passagem inteira
 * commita, ou nada dela sobrevive. **Não há progresso parcial**, e quem chamar esta função não pode
 * desenhar retentativa que o pressuponha — *"os pares já encerrados ficam gravados, retomo do que
 * faltou"* é uma leitura que o código não entrega, e o resumo devolvido não sobrevive ao
 * desfazimento (logo não há o que registrar, RN-15).
 *
 * O desfazimento total é seguro **porque a idempotência é por predicado**: os candidatos desfeitos
 * continuam `ATIVO` com a data vencida, e a passagem seguinte os reencontra pela mesma seleção
 * (RD-01/RD-04). É a repetição da passagem — e não a retomada de onde parou — que põe o dia em dia.
 *
 * ---------------------------------------------------------------------------
 * DECISÃO FECHADA — F5/T5 · fatia `automacoes-agendadas` · 2026-08-23
 * ---------------------------------------------------------------------------
 * O QUÊ: o motivo de descarte `contrato_sem_imovel` do oráculo
 *        (`golden/encerrar-contratos-vencidos.json`, caso `CTR-CARACT-ECV-02`) **não é alcançável**
 *        neste produto, e esta rotina não tem — nem ganha — ramo que o trate. `imovel_id` é
 *        `NOT NULL` em `negocio.contrato` desde a migração `0007`, e a junção com `negocio.imovel`
 *        é, por isso, total: nenhum candidato se perde nela.
 * POR QUÊ: a regra RN-02 do oráculo captura uma propriedade do **esquema do Frappe**, não uma
 *        decisão de negócio. Relaxar a coluna para "honrar" a RN-02 tornaria representável um
 *        contrato sem imóvel — estado que a F2 fechou por construção e que nenhuma outra parte do
 *        produto sabe tratar (a ativação, o cancelamento, a leitura em lote dos vigentes e a porta
 *        estreita da situação de locação pressupõem o imóvel). A RN-02 é honrada **vacuamente**, por
 *        decisão registrada na §21.2 do tech spec, e o efeito observável é **o mesmo** do oráculo:
 *        nenhum contrato sem imóvel é encerrado. É por isso, e não por lacuna, que o retorno desta
 *        rotina diverge de `total_candidatos: 2` / `total_ignorados: 1` do golden.
 * REVERTER EXIGE: uma ADR registrada que torne `negocio.contrato.imovel_id` anulável, **mais** a
 *        demonstração de que todo consumidor do imóvel do contrato trata a ausência dele. Enquanto a
 *        coluna for obrigatória, o `CT-1066` mede a recusa `23502` do banco e reprova quem a
 *        relaxar; enquanto ela não for, esta rotina não tem ramo de descarte a escrever.
 */
export async function encerrarContratosVencidos(
  tx: TransactionSql,
): Promise<ResultadoDoEncerramento> {
  const candidatos = await selecionarCandidatos(tx);

  let encerrados = 0;
  let preservados = 0;

  for (const candidato of candidatos) {
    // O predicado é REPETIDO no `UPDATE` (RD-04): a linha já foi travada e reconferida pela seleção,
    // e repeti-lo custa nada e é o que garante que um contrato que deixou de estar vigente não seja
    // alcançado — nem o imóvel dele tocado — por uma passagem que o selecionou.
    const transicionados = await encerrarContrato(tx, candidato.codigo);

    if (transicionados !== 1) {
      continue;
    }

    encerrados += 1;

    // A liberação é CONDICIONAL (RD-20). O `INDISPONIVEL` do Admin é decisão deliberada, e o
    // encerramento não a apaga — ver o cabeçalho deste arquivo.
    if (candidato.situacaoDoImovel === SITUACAO_LOCADO) {
      await definirSituacaoDeLocacaoDoImovel(tx, candidato.imovelId, SITUACAO_DISPONIVEL);
    } else {
      preservados += 1;
    }
  }

  return { candidatos: candidatos.length, encerrados, preservados };
}

/**
 * Os contratos vencidos da empresa do contexto, com a linha do contrato **travada** — RD-01.
 *
 * `data_fim_locacao` nula (o contrato ainda em rascunho) **nunca** satisfaz o predicado: em SQL,
 * `NULL < data` é desconhecido, e desconhecido não é verdadeiro. A ausência de um
 * `AND data_fim_locacao IS NOT NULL` não é esquecimento — escrevê-lo sugeriria que sem ele o
 * rascunho entraria.
 *
 * `FOR UPDATE OF contrato SKIP LOCKED` trava **só** a linha do contrato, e a escolha é conteúdo: é
 * ela que faz uma passagem concorrente encontrar conjunto vazio em vez de esperar (RD-13). Travar
 * também `negocio.imovel` faria o `SKIP LOCKED` descartar o candidato sempre que **qualquer**
 * transação segurasse a linha do imóvel — inclusive uma que fosse falhar —, trocando um candidato
 * atendido por um candidato adiado sem ganhar isolamento nenhum: quem move a situação do imóvel já é
 * barrado pela vigência do contrato, como o cabeçalho enumera.
 *
 * A ordem é o **código**, e não a data: ela é estável (o código é único por empresa) e torna
 * determinística a sequência das travas entre passagens, ao contrário de `data_fim_locacao`, que
 * empata com facilidade — duas passagens que percorressem empatadas em ordens diferentes seriam a
 * receita de espera cruzada.
 */
async function selecionarCandidatos(
  tx: TransactionSql,
): Promise<readonly CandidatoAoEncerramento[]> {
  return await tx<CandidatoAoEncerramento[]>`
    SELECT contrato.codigo,
           contrato.imovel_id AS "imovelId",
           imovel.status_locacao AS "situacaoDoImovel"
      FROM negocio.contrato AS contrato
      JOIN negocio.imovel AS imovel ON imovel.id = contrato.imovel_id
     WHERE contrato.status = ${ESTADO_VIGENTE}
       AND contrato.data_fim_locacao < negocio.data_corrente_da_operacao()
     ORDER BY contrato.codigo
       FOR UPDATE OF contrato SKIP LOCKED
  `;
}

/**
 * Grava `ENCERRADO` sobre o contrato **ainda vigente**, e devolve quantas linhas alcançou.
 *
 * A contagem sai da própria instrução, e é o que separa "mandei encerrar" de "encerrei": um
 * contrato que tenha deixado de estar vigente entre a seleção e a escrita devolve zero, e o imóvel
 * dele **não é tocado** (RD-04).
 *
 * Ela **não** é uma transição de `./contrato.ts` porque nenhuma das de lá serve: `ativarContrato` e
 * `cancelarContrato` alcançam a linha sem predicado de estado — a recusa por estado errado é do
 * serviço, num ponto único, e serviço é o que esta rotina não tem. O predicado repetido é a defesa
 * que substitui aquela recusa quando não há ator para recusar.
 */
async function encerrarContrato(tx: TransactionSql, codigo: string): Promise<number> {
  const resultado = await tx`
    UPDATE negocio.contrato
       SET status = ${ESTADO_ENCERRADO}
     WHERE codigo = ${codigo}
       AND status = ${ESTADO_VIGENTE}
  `;

  return resultado.count;
}
