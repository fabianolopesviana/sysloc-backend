/**
 * A porta da emissão em lote — o **predicado do conjunto** e a recusa do lote concorrente pelo banco.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-01    | CT-911 | A seleção de cobranças de um lote devolve exatamente as cobranças da empresa,
 * |          |        | da competência informada, com `pago_em IS NULL`, `cancelado_em IS NULL` e
 * |          |        | `numero_do_titulo_no_provedor IS NULL` — nem uma a mais, nem uma a menos, medido por igualdade
 * |          |        | de conjunto contra a lista montada no arranjo, com controle antivácuo. A
 * |          |        | mesma chamada, sob o contexto de OUTRA empresa, devolve `[]` — sem que
 * |          |        | assinatura alguma receba `empresaId` (ADR-0008). |
 * | CA-04    | CT-916 | Com um lote em curso (`concluido_em IS NULL AND interrompido_em IS NULL`) da
 * |          |        | empresa A, a tentativa de inserir um segundo lote da empresa A é recusada
 * |          |        | PELO BANCO com `23505` nomeando `emissao_em_lote_em_andamento_uidx`, e a
 * |          |        | porta traduz a recusa em `ErroDeLoteEmCurso` carregando o `id` do lote em
 * |          |        | curso. O lote da empresa B é aceito. Concluído o lote 1 de A, um novo lote
 * |          |        | de A passa a ser aceito — o índice é PARCIAL, e não total. |
 * | CA-02    | CT-916 | A prestação de contas é agregação sobre os itens: `emitidas` e `recusadas`
 * | CA-03    | (b)    | contam os desfechos gravados, `itens` os nomeia pelo CÓDIGO da cobrança, e o
 * |          |        | lote INTERROMPIDO é devolvido com `motivoDaInterrupcao` e os itens que
 * |          |        | chegaram a existir. `RECUSADO` sem motivo e o segundo desfecho sobre o mesmo
 * |          |        | lote são recusados PELO BANCO (`23514`), nunca pela aplicação. |
 * | CA-04    | CT-916 | Uma conclusão que NÃO alcança a linha levanta com nome, em vez de resolver em
 * |          | (c)    | silêncio: sob o contexto de OUTRA empresa a política esconde o lote, a escrita
 * |          |        | não tem efeito, e ela é recusada com a mensagem literal da porta — com o lote
 * |          |        | permanecendo EM_ANDAMENTO. A mesma chamada, sob o contexto certo, conclui
 * |          |        | (controle positivo), e a REPETIÇÃO da conclusão é recusada do mesmo modo —
 * |          |        | caso que `emissao_em_lote_desfecho_unico_chk` NÃO cobre. |
 * | CA-03    | CT-916 | Interromper um lote JÁ interrompido não alcança a linha e levanta com nome: o
 * |          | (d)    | motivo original e o carimbo do primeiro desfecho sobrevivem byte a byte, e o
 * |          |        | segundo motivo não aparece em lugar nenhum. As duas `CHECK` aprovariam esta
 * |          |        | escrita — quem a fecha é o predicado do estado na própria instrução. |
 * | CA-04    | CT-916 | A recusa de não-alcance é CLASSE nomeada (`ErroDeLoteNaoAlcancado`) carregando o
 * |          | (e)    | lote, e não um `Error` de texto: o REENVIO da tarefa sobre um lote já concluído
 * |          |        | — percurso que a entrega *at-least-once* torna alcançável — a levanta com o
 * |          |        | MESMO retrato do contexto de tenant errado, e o desfecho gravado sobrevive
 * |          |        | com o carimbo original. Ela DISCRIMINA: a abertura concorrente recusa com
 * |          |        | `ErroDeLoteEmCurso`, e a interrupção de um lote concluído — em que a linha É
 * |          |        | alcançada — recusa pelo BANCO (`23514`), nenhuma das duas com a classe nova. |
 *
 * Rastreabilidade: `CA-01 → CT-911 (RN-01)` · `CA-04 → CT-916 (RN-03)` ·
 * `CA-02, CA-03 → CT-916 (b) (RN-02)` · `CA-04 → CT-916 (c) (RN-02)` ·
 * `CA-03 → CT-916 (d) (RN-02)` · `CA-04 → CT-916 (e) (RN-02)`.
 *
 * ⚠️ **O `CT-916 (b)` é acréscimo do executor**, e a razão é a cobertura: a §6 da task pede dois
 * casos, e eles alcançam duas das seis operações publicadas. Sem ele, `registrarItemDoLote`,
 * `interromperLote` e `lerLote` — que carregam a prestação de contas da CA-02 e o desfecho da CA-03 —
 * entrariam na árvore sem nenhuma asserção sobre o que devolvem, e as duas `CHECK` que a T2 criou
 * ficariam sem prova de que quem recusa é o banco.
 *
 * ⚠️ **O `CT-916 (c)` e o `CT-916 (d)` são a REDE do P4** (`.claude/rules/nao-regressao.md`) para os
 * dois defeitos que o Gate 2 nomeou na rodada 2, e cada um falha com o código anterior: a escrita que
 * não alcançava linha resolvia **em silêncio**, e a repetição do mesmo desfecho **reescrevia fato já
 * gravado** — apagando o motivo da interrupção, que a porta declara não recuperável. Nenhum dos dois
 * reprovava a suíte anterior, e é exatamente por isso que eles existem.
 *
 * ⚠️ **O `CT-916 (e)` é a REDE do defeito da rodada 3**, que não era de comportamento e sim de
 * **premissa**: o docblock afirmava que o `loteId` *"não vem de fora"* e que zero linhas era *"estado
 * impossível"*, quando a fatia declara o contrário — o identificador viaja na carga da tarefa
 * (`{ empresaId, loteId }`) e a entrega é *at-least-once* com três tentativas. O reenvio é, portanto,
 * **alcançável e benigno**, e a recusa precisa ser reconhecível pelo TIPO para que a borda não o trate
 * como falha. Ele falha com o código anterior — `throw new Error(…)` — pelo campo `classe` do retrato,
 * e as duas pernas de controle o impedem de aprovar uma porta que levantasse a classe nova para
 * qualquer insucesso.
 *
 * ===========================================================================
 * A PRECONDIÇÃO PRIVILEGIADA: o contexto vem da UNIDADE DE TRABALHO real
 * ===========================================================================
 *
 * As linhas do arranjo precisam existir sob o contexto de tenant da empresa, que a produção não expõe
 * por parâmetro de consulta — e **não pode expor**: acrescentar `empresaId` a uma assinatura seria
 * escrever em código a comparação que a política já faz (ADR-0008), que é a Lei do seam somada à
 * `Decision` daquela ADR.
 *
 * Por isso todo estado é montado pelo par que a operação usa — `contextoDeTenant.executarCom` mais
 * `acesso.emUnidadeDeTrabalho` —, exatamente como `isolamento.spec.ts`, `cobranca.spec.ts` e
 * `evento-bancario.spec.ts` já fazem. As duas empresas são as da **semente real** (`EMPRESA_A`,
 * `EMPRESA_B`), e o usuário que dispara cada lote é **derivado da carga** (ver
 * {@link exigirUsuarioDa}), nunca um literal reescrito aqui: o par `(usuario, empresa)` que a chave
 * estrangeira composta cobra é o mesmo que `semente.ts` gravou.
 *
 * ===========================================================================
 * Por que o segundo lote é tentado DUAS vezes, por caminhos diferentes
 * ===========================================================================
 *
 * A porta traduz a violação em {@link ErroDeLoteEmCurso}, e uma asserção só sobre ela **não
 * distinguiria** a recusa do banco de um `if` escrito na aplicação — que é exatamente o defeito que a
 * §3.1 da task proíbe (*"nunca `SELECT` antes de `INSERT`"*). Por isso o caso tem as duas pernas:
 *
 *   * pela **porta**, o desfecho é `ErroDeLoteEmCurso` com o `id` do lote em curso — o que a borda
 *     precisa para compor `422` com `detalhes: { loteEmCurso: '…' }`;
 *   * pela **instrução crua** — a mesma que a porta emite, sem a tradução —, o desfecho é `23505`
 *     nomeando `emissao_em_lote_em_andamento_uidx`. Essa perna prova que quem recusa é o índice, e a
 *     recusa vale para **todo** caminho de escrita, inclusive os que ainda não existem.
 *
 * O nome do índice é asserido junto do SQLSTATE, e não o SQLSTATE sozinho: as duas tabelas desta fatia
 * têm outras restrições únicas (`emissao_em_lote_id_empresa_key`,
 * `item_da_emissao_em_lote_lote_cobranca_key`), e um `23505` sozinho não diz qual delas falou.
 *
 * ===========================================================================
 * O QUARTO PASSO é o que discrimina índice PARCIAL de índice TOTAL
 * ===========================================================================
 *
 * Sem ele, um `unique(empresa_id)` sem a cláusula `WHERE` passaria nos três primeiros passos — e a
 * empresa poderia emitir **uma vez só, para sempre**, com o defeito aparecendo apenas na segunda
 * competência, em operação. É a armadilha que o cabeçalho de `emissaoEmLote`, em
 * `../src/esquema/negocio.ts`, nomeia por escrito.
 *
 * ===========================================================================
 * Cada caso deixa o banco SEM lote em andamento — e isso é prova, não higiene
 * ===========================================================================
 *
 * O índice é por empresa e atravessa os casos, de modo que um lote deixado aberto por um caso faria o
 * seguinte reprovar por ordem de execução. Os desfechos que fecham cada caso não são limpeza
 * incidental: são a própria afirmação de que `concluirLote` e `interromperLote` liberam o índice, que
 * é a segunda metade da CA-04.
 *
 * Justamente **por serem asserção**, eles não são rede: o caso que reprove ANTES de alcançá-los deixa
 * um lote aberto, e o seguinte reprova na abertura do lote dele — por herança, e não pelo próprio
 * defeito. A rede é {@link liberarLotesEmAndamento}, que roda em `beforeEach` e garante o estado de
 * **entrada** por instrução crua; ela **não substitui** os fechos, e numa execução íntegra não
 * encontra lote nenhum.
 *
 * ===========================================================================
 * Os instantes entram na igualdade REDUZIDOS À FORMA
 * ===========================================================================
 *
 * `criadoEm`, `concluidoEm` e `interrompidoEm` nascem do relógio do banco (ADR-0026), e nenhum caso
 * pode saber o valor deles. Compará-los contra si mesmos seria tautologia (AP-29); deixá-los fora da
 * igualdade deixaria sem prova justamente o campo que a derivação do estado consome. {@link retrato}
 * resolve os dois: o nulo atravessa intacto — e é ele que distingue *"ainda em andamento"* —, e o
 * instante presente vira a marca da forma, de modo que um carimbo fora do molde ISO-8601 UTC aparece
 * **nomeado** na igualdade.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-16)
 * ===========================================================================
 *
 * As asserções deste arquivo são **comportamentais** — exercitam a porta contra banco real —, e por
 * isso a `.claude/rules/testing-stack.md` não lhes cobra prova de falsificação. Os seis mutantes
 * abaixo foram medidos assim mesmo: os dois primeiros porque as invariantes que este arquivo existe
 * para fixar são *ausências* (um termo do predicado, uma cláusula do índice), e ausência é o que passa
 * despercebido; os quatro últimos porque o **P4** do Protocolo Antirregressão exige a rede de todo
 * defeito corrigido — o controle antivácuo do `CT-911`, os dois defeitos de desenho de porta que o
 * Gate 2 nomeou na rodada 2, e a recusa sem tipo que ele nomeou na rodada 3. Todos com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso.
 *
 * ⚠️ **A árvore de controle mudou de tamanho entre as medições, e a contagem tem de ser lida com a
 * data**: `MT-T4-A` e `MT-T4-B` foram medidos sobre a árvore de **200 casos** (28 arquivos), anterior
 * ao `CT-916 (c)` e ao `CT-916 (d)`; o `MT-T4-C` foi **reexecutado** e os `MT-T4-D`/`MT-T4-E` nasceram
 * sobre a de **202 casos**; o `MT-T4-F` nasceu sobre a de **203 casos** (28 arquivos), que é o controle
 * de hoje.
 *
 * ⚠️ **Mutante que ABORTA o caso não falsifica o caso inteiro.** O Vitest para na primeira asserção
 * que reprova, de modo que tudo o que vem depois dela **não é executado** — e um registro que não
 * declare onde a execução parou sugere alcance maior do que teve. Onde isso acontece, a ressalva está
 * escrita junto do mutante, com o mutante que discriminaria o resto **nomeado**.
 *
 *   * **MT-T4-A · o predicado sem `AND numero_do_titulo_no_provedor IS NULL`** — a cobrança que já tem boleto voltando
 *     ao conjunto, isto é, a idempotência da reexecução desfeita. `1 failed | 199 passed`, e o
 *     `CT-911` reprova **nomeando a intrusa**: `excedentes: ['COB-2026-9110006']`;
 *   * **MT-T4-B · o índice único sem a cláusula `WHERE`** — o defeito reintroduzido na `migracoes/
 *     0017_dominio_emissao_e_conciliacao.sql`, que é a fonte executável do índice, tornando-o TOTAL.
 *     `3 failed | 197 passed`: o `CT-916` reprova no **quarto passo** (o lote novo de A recusado
 *     depois de o primeiro ter sido concluído), o `CT-916 (b)` na abertura do lote dele, e o `CT-940`
 *     de `isolamento-bancario.spec.ts` — alheio a esta task — reprova comparando a definição do índice
 *     no catálogo. É a segunda metade da CA-04 medida: sem o passo 4, este mutante passaria.
 *   * **MT-T4-C · o ARRANJO encolhido** (`ELEGIVEIS` com duas entradas) — o defeito que o controle
 *     antivácuo existe para pegar. Ele é a prova de falsificação da correção do próprio controle, e
 *     por isso vem em **par**, ambos os braços sob `pnpm --filter @sysloc/db test -- -t "CT-911"`:
 *     com a asserção **corrigida** (âncora literal), a saída é `Test Files 1 failed | 27 passed (28)`
 *     e `Tests 1 failed | 201 passed (202)`, com o `CT-911` reprovando em `expected [ … ] to have a
 *     length of 3 but got 2` na linha de `TOTAL_DE_ELEGIVEIS`; com a asserção **anterior**
 *     (`toHaveLength(ELEGIVEIS.length)`, e sem a constante literal), o MESMO mutante sai
 *     `Test Files 28 passed (28)` e `Tests 202 passed (202)` — as duas pontas encolhiam juntas, e a
 *     perna não podia falhar. É o par, e não a execução isolada, que mostra que a âncora literal é o
 *     que fecha.
 *     ⚠️ **O mutante tem uma segunda linha, e ela é andaime declarado**: `TERCEIRA_ELEGIVEL` passa a
 *     `exigirElegivel(1)`. Sem ela, `exigirElegivel(2)` levanta **durante o carregamento do módulo** e
 *     o arquivo inteiro reprova em `0 test`, sem que a perna sob prova chegue a rodar — desfecho
 *     vermelho que **não** discriminaria nada.
 *     ⚠️ **Duas coisas foram MEDIDAS aqui e contrariam o que se supunha, e por isso ficam escritas.**
 *     (i) O sufixo `-- -t "CT-911"` **não filtra nada** neste repositório: o script resolve para
 *     `vitest run -- -t CT-911`, e as duas execuções acima rodaram as **28** suítes e os **202** casos.
 *     Logo o número transcrito é o da **suíte inteira**, e não há caso `skipped` algum — quem repetir a
 *     medição deve esperar exatamente essa forma. (ii) Sob o andaime, o `CT-916 (b)` **continua verde**,
 *     e o terceiro `registrarItemDoLote` **não** cai na `UNIQUE (lote_id, cobranca_id)`: ele é
 *     `RECUSADO` **sem motivo**, e o servidor avalia a `CHECK` da tupla antes de inserir no índice, de
 *     modo que o desfecho segue sendo `23514 · item_da_emissao_em_lote_motivo_chk` — que é justamente o
 *     que o caso afirma. A reprovação em cadeia que se previa para o `CT-916 (b)` **não acontece**.
 *   * **MT-T4-D · a conclusão sem a conferência da linha alcançada** — o corpo de {@link concluirLote}
 *     de volta à forma que descartava o resultado do `UPDATE` — a instrução aguardada sem que
 *     `resultado.count` fosse observado —, que é o defeito `TR-P1`. `Test Files 1 failed | 27 passed (28)`, `Tests 1 failed | 201 passed
 *     (202)`: o `CT-916 (c)` reprova em `expected 'ACEITO' to be 'o lote foi concluído e não foi
 *     alcançado'` — a escrita sob o contexto da empresa B alcançava zero linhas e **resolvia em
 *     silêncio**, que é exatamente o modo de falha que a rede existe para pegar.
 *   * **MT-T4-E · a interrupção sem `AND interrompido_em IS NULL`** — a cláusula de
 *     {@link interromperLote} de volta ao `WHERE id = …` sozinho, que é o defeito `TR-P2`.
 *     `Test Files 1 failed | 27 passed (28)`, `Tests 1 failed | 201 passed (202)`: o `CT-916 (d)`
 *     reprova em `expected 'ACEITO' to be 'o lote foi interrompido e não foi alcançado'` — a segunda
 *     interrupção alcançava a linha e **reescrevia o motivo já gravado**, sem que `CHECK` alguma
 *     acusasse.
 *     ⚠️ **O ALCANCE desta medição para no passo 2, e a ressalva é obrigatória.** O Vitest **aborta o
 *     caso** na asserção de `RECUSA_DA_INTERRUPCAO` (passo 2), de modo que as **três** asserções que
 *     provam a sobrevivência do fato — o corpo inteiro, o motivo por valor literal e o carimbo por
 *     valor, no passo 3 — **não chegam a executar** sob este mutante. Ele falsifica a asserção da
 *     recusa, e **não** o `CT-916 (d)` inteiro: quem tomar este registro por prova de que as três do
 *     passo 3 são falsificáveis conclui mais do que foi medido, e a rodada seguinte pode julgá-las
 *     redundantes com a do passo 2 e removê-las — que é a **R2** do Protocolo Antirregressão. O
 *     mutante que as discriminaria é **outro**, e fica nomeado: uma porta que **gravasse** a segunda
 *     interrupção (cláusula sem o segundo termo) **e levantasse a recusa assim mesmo** — com ela o
 *     passo 2 passa, e só o passo 3 acusa o motivo apagado. Medi-lo é **opcional**: as asserções deste
 *     arquivo são comportamentais, e a `.claude/rules/testing-stack.md` não lhes cobra prova de
 *     falsificação — os mutantes daqui são medição voluntária acima do exigido.
 *   * **MT-T4-F · a recusa de não-alcance de volta a `Error` genérico** — `concluirLote` levantando
 *     `new Error('o lote foi concluído e não foi alcançado')` no lugar de {@link ErroDeLoteNaoAlcancado},
 *     que é a forma da rodada 2. Medido sobre a árvore de **203 casos** (28 arquivos), que é o controle
 *     de hoje: `Test Files 1 failed | 27 passed (28)`, `Tests 1 failed | 202 passed (203)`, com o
 *     `CT-916 (e)` reprovando em `expected { classe: 'OUTRA RECUSA', …(2) } to deeply equal { …(3) }`,
 *     `- "classe": "ErroDeLoteNaoAlcancado"` / `+ "classe": "OUTRA RECUSA"`.
 *     ⚠️ **O `CT-916 (c)` e o `CT-916 (d)` seguem VERDES sob ele** — a mensagem não mudou, e é só ela
 *     que aqueles dois observam. É essa assimetria que mostra que a rede do tipo é o `CT-916 (e)`, e
 *     não um segundo caso escrevendo o que os anteriores já escreviam.
 *
 * ⚠️ **O `MT-T4-A` mudou a ordem das asserções do `CT-911`, e o registro é deliberado.** Na primeira
 * execução ele reprovava na **contagem** (`expected length 3, got 4`), que vinha antes da igualdade de
 * conjunto e a tornava inalcançável — o diagnóstico não dizia *qual* cobrança vazou. A ordem foi
 * corrigida para a canônica de `coerencia-de-migracoes.spec.ts` (a divergência nomeada primeiro), e o
 * mutante foi **reexecutado** sobre ela: é dessa segunda execução que sai o `excedentes` acima.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada e semeada, descartada ao fim. Nenhuma coordenada de
 * conexão é lida do ambiente — a suíte nunca toca o banco que atende a operação.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  abrirEmissaoEmLote,
  type CobrancaSemBoleto,
  concluirLote,
  ErroDeLoteEmCurso,
  ErroDeLoteNaoAlcancado,
  interromperLote,
  type LinhaDoLote,
  lerLote,
  registrarItemDoLote,
  selecionarCobrancasSemBoleto,
} from '../src/emissao-em-lote.ts';
import { EMPRESA_A, EMPRESA_B, USUARIOS, type UsuarioSemeado } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { diferencasDeConjunto } from './conjuntos.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Os casos semeiam poucas linhas e fazem uma dezena de idas ao banco; o teto é folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física. */
const RESERVA_DE_UMA = 1;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

// ---------------------------------------------------------------------------
// Os atores da carga inicial — derivados dela, nunca redigitados
// ---------------------------------------------------------------------------

/**
 * O usuário que dispara o lote de cada empresa.
 *
 * Ele é **derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que
 * `emissao_em_lote_usuario_empresa_fkey` cobra é o mesmo que `semente.ts` gravou, e copiar o
 * identificador criaria uma segunda declaração livre para divergir da carga que a instância efêmera
 * aplica. Mesma forma de `certificado-do-provedor.spec.ts`.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);
  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }
  return usuario;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);
const USUARIO_DE_B = exigirUsuarioDa(EMPRESA_B.id);

// ---------------------------------------------------------------------------
// As duas competências, e as sete cobranças do arranjo
// ---------------------------------------------------------------------------

/** A competência que o lote cobre — primeiro dia do mês, como o `check` do banco exige. */
const COMPETENCIA = '2026-08-01';

/** A competência VIZINHA: a cobrança dela é elegível em tudo, menos no mês. */
const COMPETENCIA_VIZINHA = '2026-07-01';

/**
 * Uma cobrança do arranjo — o que ela é, e o que a torna (ou não) elegível.
 *
 * A forma declarativa é o que permite semear as sete pela MESMA instrução, variando só o que
 * discrimina: um arranjo com sete `INSERT` diferentes faria a lista esperada depender de qual deles o
 * autor lembrou de manter em dia.
 */
interface CobrancaDoArranjo {
  readonly id: string;
  readonly codigo: string;
  readonly competencia: string;
  /** Preenchido ⇒ paga; e o `check` de carimbo coerente cobra os quatro carimbos junto. */
  readonly pagoEm: string | null;
  readonly canceladoEm: string | null;
  /** Preenchido ⇒ já tem boleto, e é este campo que dá a idempotência da reexecução. */
  readonly numeroDoTituloNoProvedor: string | null;
}

function cobranca(
  posicao: number,
  parte: Omit<CobrancaDoArranjo, 'id' | 'codigo'>,
): CobrancaDoArranjo {
  return {
    id: `aaaaaaaa-9110-4000-8000-00000000000${posicao}`,
    codigo: `COB-2026-911000${posicao}`,
    ...parte,
  };
}

const EM_ABERTO_SEM_BOLETO = {
  pagoEm: null,
  canceladoEm: null,
  numeroDoTituloNoProvedor: null,
} as const;

/**
 * As **três** elegíveis: competência do lote, em aberto, sem boleto.
 *
 * São três, e não uma: uma só faria a igualdade de conjunto passar por qualquer consulta que
 * devolvesse a primeira linha que encontrasse.
 */
const ELEGIVEIS: readonly CobrancaDoArranjo[] = [
  cobranca(1, { competencia: COMPETENCIA, ...EM_ABERTO_SEM_BOLETO }),
  cobranca(2, { competencia: COMPETENCIA, ...EM_ABERTO_SEM_BOLETO }),
  cobranca(3, { competencia: COMPETENCIA, ...EM_ABERTO_SEM_BOLETO }),
];

/**
 * Quantas elegíveis o arranjo declara — o **literal** que o card do CT-911 fixa (`elegiveis: 3`).
 *
 * Ele é literal de propósito, e a escolha corrige um defeito medido: escrito como
 * `toHaveLength(ELEGIVEIS.length)`, o controle antivácuo comparava duas derivações do **mesmo**
 * arranjo — `ESPERADAS` e `CODIGOS_ESPERADOS` nascem de `map`, que preserva comprimento —, e era
 * verdadeiro por construção para qualquer valor de `ELEGIVEIS`, **inclusive o arranjo vazio**. Com
 * ele vazio, o CT-911 inteiro passava comparando nada com nada, que é exatamente a vacuidade contra
 * a qual a `.claude/rules/ancoras-de-superficie.md` exige o controle.
 *
 * O literal é o **segundo eixo** que o arranjo não alcança: qualquer encolhimento das listas passa a
 * divergir dele, em vez de encolher junto com a asserção que deveria acusá-lo.
 */
const TOTAL_DE_ELEGIVEIS = 3;

/**
 * As **quatro** intrusas — uma por termo do predicado, e cada uma falha por um motivo só.
 *
 * Três estão na MESMA competência e na MESMA empresa das elegíveis, e diferem apenas no campo que as
 * exclui; a quarta é elegível em tudo, menos no mês. É o que faz a igualdade de conjunto discriminar
 * qual termo do predicado sumiu: um predicado que perdesse `numero_do_titulo_no_provedor IS NULL` traria a terceira, e
 * um que comparasse a competência por ano traria a quarta.
 */
const INTRUSAS: readonly CobrancaDoArranjo[] = [
  cobranca(4, {
    competencia: COMPETENCIA,
    pagoEm: '2026-08-05',
    canceladoEm: null,
    numeroDoTituloNoProvedor: null,
  }),
  cobranca(5, {
    competencia: COMPETENCIA,
    pagoEm: null,
    canceladoEm: '2026-08-06T12:00:00Z',
    numeroDoTituloNoProvedor: null,
  }),
  cobranca(6, {
    competencia: COMPETENCIA,
    pagoEm: null,
    canceladoEm: null,
    numeroDoTituloNoProvedor: '000000000000000001',
  }),
  cobranca(7, { competencia: COMPETENCIA_VIZINHA, ...EM_ABERTO_SEM_BOLETO }),
];

const COBRANCAS_DO_ARRANJO: readonly CobrancaDoArranjo[] = [...ELEGIVEIS, ...INTRUSAS];

/** As duas chaves de cada elegível, na ordem que a consulta declara (por código). */
const ESPERADAS: readonly CobrancaSemBoleto[] = ELEGIVEIS.map(({ id, codigo }) => ({ id, codigo }));

const CODIGOS_ESPERADOS = ESPERADAS.map(({ codigo }) => codigo);

/** As três elegíveis nomeadas — a indexação crua devolveria `undefined` sob `noUncheckedIndexedAccess`. */
function exigirElegivel(posicao: number): CobrancaDoArranjo {
  const escolhida = ELEGIVEIS[posicao];
  if (escolhida === undefined) {
    throw new Error(`o arranjo precisa da elegível na posição ${posicao}`);
  }
  return escolhida;
}

const PRIMEIRA_ELEGIVEL = exigirElegivel(0);
const SEGUNDA_ELEGIVEL = exigirElegivel(1);
const TERCEIRA_ELEGIVEL = exigirElegivel(2);

// ---------------------------------------------------------------------------
// Identificadores descartáveis do cadastro de apoio
// ---------------------------------------------------------------------------
//
// A cadeia inteira é necessária, e não é zelo: `cobranca.contrato_id` tem chave estrangeira COMPOSTA
// para `contrato(id, empresa_id)`, o contrato exige imóvel, locador e locatário, e o imóvel exige
// conjunto — todas as chaves são `NOT NULL`. Mesmo arranjo, e mesma razão, de `semearApoio` em
// `evento-bancario.spec.ts` e em `isolamento-bancario.spec.ts`.

const CONJUNTO_DE_A = 'aaaaaaaa-9111-4000-8000-000000000001';
const IMOVEL_DE_A = 'aaaaaaaa-9111-4000-8000-000000000002';
const LOCADOR_DE_A = 'aaaaaaaa-9111-4000-8000-000000000003';
const LOCATARIO_DE_A = 'aaaaaaaa-9111-4000-8000-000000000004';
const CONTRATO_DE_A = 'aaaaaaaa-9111-4000-8000-000000000005';

// ---------------------------------------------------------------------------
// Moldes e acessórios de coleta
// ---------------------------------------------------------------------------

/** O molde do instante que a projeção publica: ISO-8601 em UTC, com milissegundos e `Z` literal. */
const INSTANTE_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** O molde do UUID que o banco gera — é o que impede a asserção de passar sobre cadeia vazia. */
const IDENTIFICADOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A marca com que um instante bem-formado entra na igualdade de corpo inteiro. */
const CARIMBO_DO_BANCO = 'INSTANTE ISO-8601 UTC';

/** `unique_violation` — o SQLSTATE do índice único parcial recusando o lote concorrente. */
const VIOLACAO_DE_UNICIDADE = '23505';

/** `check_violation` — o SQLSTATE das `CHECK` que a T2 criou sobre estas tabelas. */
const VIOLACAO_DE_CHECK = '23514';

/** O índice que recusa o segundo lote em andamento — nomeado, e não um `23505` qualquer. */
const INDICE_DO_LOTE_EM_ANDAMENTO = 'emissao_em_lote_em_andamento_uidx';

/** As duas `CHECK` exercitadas, nomeadas: um `23514` sozinho não diz qual delas falou. */
const CHECK_DO_MOTIVO = 'item_da_emissao_em_lote_motivo_chk';
const CHECK_DO_DESFECHO_UNICO = 'emissao_em_lote_desfecho_unico_chk';

/**
 * As duas recusas que as portas de desfecho levantam quando **não alcançam a linha**.
 *
 * São literais nomeados aqui, e não texto solto no meio do caso: a asserção é sobre a mensagem exata, e
 * um literal repetido nos dois pontos ficaria livre para divergir do que a porta escreve.
 */
const RECUSA_DA_CONCLUSAO = 'o lote foi concluído e não foi alcançado';
const RECUSA_DA_INTERRUPCAO = 'o lote foi interrompido e não foi alcançado';

/** A mensagem com que a porta recusa o lote concorrente — o par negativo das duas acima. */
const RECUSA_DO_LOTE_EM_CURSO = 'a empresa já tem uma emissão em lote em andamento';

/**
 * Os nomes das **classes** de recusa que o `CT-916 (e)` distingue, e o rótulo de tudo o mais.
 *
 * Eles são nomeados aqui porque a asserção é sobre a classe **reconhecida por `instanceof`**, e não
 * sobre a propriedade `name` — que qualquer `Error` pode carregar. O rótulo genérico existe para que a
 * reprovação **nomeie o que veio no lugar** em vez de dizer só que os objetos diferem.
 */
const CLASSE_NAO_ALCANCADO = 'ErroDeLoteNaoAlcancado';
const CLASSE_LOTE_EM_CURSO = 'ErroDeLoteEmCurso';
const OUTRA_RECUSA = 'OUTRA RECUSA';

type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: unknown };

async function tentar<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await acao() };
  } catch (erro) {
    return { ok: false, erro };
  }
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/** A restrição que o servidor nomeou, ou `undefined` quando o erro não veio dele. */
function restricaoDe(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/**
 * O desfecho de uma tentativa, como texto comparável — `<sqlstate> · <restrição>` ou `ACEITO`.
 *
 * Ele existe para que a recusa entre numa igualdade **que nomeia o que aconteceu**, em vez de um
 * booleano de insucesso: o ramo `ACEITO` é o que faz a asserção reprovar quando a escrita ilegítima
 * passa, e o par `(sqlstate, restrição)` é o que a faz reprovar quando quem recusou foi outra
 * restrição. Mesma forma de `desfechoDaTentativa` em `evento-bancario.spec.ts`.
 */
function desfechoDaTentativa(tentativa: Resultado<unknown>): string {
  if (tentativa.ok) {
    return 'ACEITO';
  }

  const codigo = sqlstate(tentativa.erro) ?? 'sem sqlstate';
  const restricao = restricaoDe(tentativa.erro) ?? 'sem restrição';

  return `${codigo} · ${restricao}`;
}

/**
 * A mensagem com que a porta recusou, ou `ACEITO` — o desfecho como texto comparável.
 *
 * Mesma forma, e mesma razão, de {@link desfechoDaTentativa}, para a recusa que **não** vem do
 * servidor: o ramo `ACEITO` é o que faz a asserção reprovar quando a escrita que não alcançou linha
 * alguma passa **em silêncio**, e a mensagem literal é o que a faz reprovar quando quem levantou foi
 * outra coisa — o driver, uma `CHECK`, ou a política.
 */
function mensagemDaTentativa(tentativa: Resultado<unknown>): string {
  if (tentativa.ok) {
    return 'ACEITO';
  }

  return tentativa.erro instanceof Error
    ? tentativa.erro.message
    : `SEM MENSAGEM: ${String(tentativa.erro)}`;
}

/**
 * A recusa como corpo comparável — **classe**, o que ela diz de si, e o lote que ela carrega.
 *
 * Ela existe para o `CT-916 (e)`, e o eixo dela é a **classe**: a porta precisa recusar com um tipo que
 * o chamador reconheça em runtime, porque zero linhas tem duas causas (o reenvio benigno da tarefa e o
 * alvo errado) que a camada de dados não separa — quem decide é quem sabe se está reentrando. Uma
 * asserção só sobre a mensagem passaria com um `Error` genérico, que é exatamente a forma que o Gate 2
 * julgou insuficiente na rodada 3.
 *
 * `dito` carrega a mensagem quando a recusa é de **domínio** e o par `<sqlstate> · <restrição>` quando
 * ela é **do servidor**: nos dois casos, o que a recusa diz sobre si mesma, num campo só, sem que o
 * nome de uma classe do driver entre na igualdade e a torne frágil.
 *
 * O ramo `ACEITO` é o que faz a asserção reprovar quando a escrita que não deveria alcançar linha
 * alguma passa em silêncio — a mesma razão de {@link desfechoDaTentativa} e de {@link mensagemDaTentativa}.
 */
function retratoDaRecusa(tentativa: Resultado<unknown>): {
  classe: string;
  dito: string;
  lote: string | null;
} {
  if (tentativa.ok) {
    return { classe: 'ACEITO', dito: 'ACEITO', lote: null };
  }

  if (tentativa.erro instanceof ErroDeLoteNaoAlcancado) {
    return {
      classe: CLASSE_NAO_ALCANCADO,
      dito: tentativa.erro.message,
      lote: tentativa.erro.loteId,
    };
  }

  if (tentativa.erro instanceof ErroDeLoteEmCurso) {
    return {
      classe: CLASSE_LOTE_EM_CURSO,
      dito: tentativa.erro.message,
      lote: tentativa.erro.loteEmCurso,
    };
  }

  return { classe: OUTRA_RECUSA, dito: desfechoDaTentativa(tentativa), lote: null };
}

/** O instante reduzido à FORMA — o carimbo bem-formado vira a marca, e o torto entra nomeado. */
function marcaDoInstante(valor: string): string {
  return INSTANTE_ISO_UTC.test(valor) ? CARIMBO_DO_BANCO : `FORA DO MOLDE: ${valor}`;
}

/** O mesmo, para os dois carimbos ANULÁVEIS: o nulo atravessa intacto e é ele que diz "sem desfecho". */
function marcaDoInstanteOpcional(valor: string | null): string | null {
  return valor === null ? null : marcaDoInstante(valor);
}

/**
 * O lote como a igualdade de corpo inteiro o compara — tudo, menos o `id` e o valor dos instantes.
 *
 * O `id` sai porque é sorteado pelo banco e nenhum caso o conhece: ele é asserido por forma e por
 * diferença entre lotes, onde a comparação diz alguma coisa. Os três instantes entram **reduzidos à
 * forma** — ver o cabeçalho.
 */
function retrato(lote: LinhaDoLote): Omit<LinhaDoLote, 'id'> {
  return {
    competencia: lote.competencia,
    estado: lote.estado,
    criadoEm: marcaDoInstante(lote.criadoEm),
    concluidoEm: marcaDoInstanteOpcional(lote.concluidoEm),
    interrompidoEm: marcaDoInstanteOpcional(lote.interrompidoEm),
    motivoDaInterrupcao: lote.motivoDaInterrupcao,
    emitidas: lote.emitidas,
    recusadas: lote.recusadas,
    itens: lote.itens,
  };
}

/** O lote que a leitura precisa ter alcançado — `undefined` aqui é defeito, não desfecho do caso. */
function exigirLote(lote: LinhaDoLote | undefined, rotulo: string): LinhaDoLote {
  if (lote === undefined) {
    throw new Error(`o lote ${rotulo} não foi alcançado pela leitura`);
  }
  return lote;
}

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

/** Corre uma unidade de trabalho sob o contexto da empresa — o par que a operação usa. */
async function sobContextoDe<T>(
  contexto: { readonly empresaId: string },
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => trabalho(tx)),
  );
}

/**
 * Semeia, sob o contexto da empresa A, o cadastro de apoio e as sete cobranças do arranjo.
 *
 * Tudo numa unidade só, na ordem pai → filho: as chaves estrangeiras compostas exigem que o conjunto
 * exista antes do imóvel, e o imóvel, o locador e o locatário antes do contrato. As instruções são
 * cruas porque o objeto deste arquivo é o lote, e não o cadastro — montar o apoio pelas portas
 * daqueles agregados faria estes casos reprovarem por defeito alheio.
 *
 * Nenhuma instrução compara `empresa_id` com coisa alguma: a empresa é **proposta** e a política a
 * aceita ou recusa (ADR-0008).
 */
async function semearApoio(): Promise<void> {
  await sobContextoDe(CONTEXTO_DE_A, async (tx) => {
    await tx`
      INSERT INTO negocio.conjunto (id, empresa_id, nome)
      VALUES (${CONJUNTO_DE_A}, ${EMPRESA_A.id}, ${'Conjunto do lote'})
    `;
    await tx`
      INSERT INTO negocio.imovel
                  (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                   logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
      VALUES (${IMOVEL_DE_A}, ${EMPRESA_A.id}, ${CONJUNTO_DE_A}, ${'Imóvel do lote'},
              ${'IM-LOTE'}, ${'RESIDENCIAL'}::negocio.tipo_imovel,
              ${'Rua das Acácias'}, ${'300'}, ${null}, ${'Centro'}, ${'Teresina'}, ${'PI'},
              ${'64000000'}, ${'DISPONIVEL'}::negocio.status_locacao)
    `;
    for (const pessoa of [
      { relacao: 'negocio.locador', id: LOCADOR_DE_A, marca: 'locador' },
      { relacao: 'negocio.locatario', id: LOCATARIO_DE_A, marca: 'locatario' },
    ]) {
      await tx.unsafe(
        `INSERT INTO ${pessoa.relacao}
                (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                 logradouro, numero, complemento, bairro, cidade, estado, cep)
         VALUES ($1, $2, $3, 'PESSOA_FISICA', $4, NULL, $5, '8699990000',
                 'Rua das Acácias', '300', NULL, 'Centro', 'Teresina', 'PI', '64000000')`,
        [
          pessoa.id,
          EMPRESA_A.id,
          `Cadastro ${pessoa.marca} do lote`,
          `DOC-LOTE-${pessoa.marca}`,
          `lote.${pessoa.marca}@exemplo.com.br`,
        ],
      );
    }
    // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`, e o
    // que este arquivo mede não é a vigência única.
    await tx`
      INSERT INTO negocio.contrato
                  (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                   data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
      VALUES (${CONTRATO_DE_A}, ${EMPRESA_A.id}, ${'CTR-2026-91101'}, ${IMOVEL_DE_A},
              ${LOCADOR_DE_A}, ${LOCATARIO_DE_A}, ${'RASCUNHO'}::negocio.status_contrato,
              ${'2026-01-10'}::date, ${12}, ${'1500.00'}, ${10})
    `;

    for (const linha of COBRANCAS_DO_ARRANJO) {
      // Os quatro carimbos andam com `pago_em` pela bicondicional `cobranca_carimbo_coerente_chk`:
      // pagamento sem carimbo é recusado pelo banco, e é essa recusa que torna a intrusa paga um
      // registro legítimo em vez de uma linha inventada para o caso.
      const carimbo = linha.pagoEm === null ? null : '0.00';
      const valorPago = linha.pagoEm === null ? null : '2000.00';

      await tx`
        INSERT INTO negocio.cobranca
                    (id, empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                     data_vencimento, valor_original, pago_em, valor_pago, cancelado_em,
                     multa_aplicada, juros_aplicados, multa_percentual_aplicado,
                     juros_percentual_aplicado, numero_do_titulo_no_provedor)
        VALUES (${linha.id}, ${EMPRESA_A.id}, ${linha.codigo}, ${CONTRATO_DE_A},
                ${'ALUGUEL'}::negocio.natureza_cobranca, ${'01/08/2026 à 31/08/2026'},
                ${linha.competencia}::date, ${'2026-08-10'}::date, ${'2000.00'},
                ${linha.pagoEm}::date, ${valorPago}, ${linha.canceladoEm}::timestamptz,
                ${carimbo}, ${carimbo}, ${carimbo}, ${carimbo},
                ${linha.numeroDoTituloNoProvedor})
      `;
    }
  });
}

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
  // O apoio é semeado UMA vez: as chaves são fixas, e uma segunda semeadura reprovaria por `23505`
  // antes de qualquer asserção — o que esconderia o que os casos medem.
  await semearApoio();
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/** O motivo com que a REDE interrompe o lote herdado — nomeado, para não se confundir com os do caso. */
const MOTIVO_DA_HIGIENE = 'lote herdado de um caso que não chegou ao fecho — liberado pelo arranjo';

/**
 * Devolve as duas empresas ao estado SEM lote em andamento — a rede que impede herança entre casos.
 *
 * O índice único parcial é por empresa e **atravessa os casos**: um caso que reprove ANTES do fecho
 * que ele mesmo escreve deixa um lote aberto, e o caso seguinte reprova **na abertura do lote dele**,
 * por herança, em vez de pelo próprio defeito. Não é hipótese — foi o modo de falha observado sob o
 * mutante `MT-T4-B`, em que o `CT-916 (b)` reprovou na abertura, e não pelo defeito injetado.
 *
 * Ela roda em `beforeEach`, e não em `afterEach`, porque o que precisa ser garantido é o estado de
 * **entrada**: o caso anterior pode ter terminado por reprovação, por expiração de tempo ou por
 * lançamento, e nenhuma dessas saídas garante que o fecho dele correu.
 *
 * A instrução é **crua**, e não `interromperLote`: a rede não pode depender do SUT que os casos
 * medem — uma porta defeituosa faria a limpeza falhar junto, e o defeito apareceria como erro de
 * arranjo. E ela **não substitui** os fechos escritos no corpo dos casos, que são asserção de
 * comportamento (`concluirLote` e `interromperLote` liberam o índice, que é a segunda metade da
 * CA-04) e permanecem exatamente onde estão: numa execução íntegra ela não encontra lote nenhum.
 *
 * Nenhuma comparação de empresa aqui: a política recorta o `UPDATE` sob cada contexto (ADR-0008).
 */
async function liberarLotesEmAndamento(): Promise<void> {
  for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
    await sobContextoDe(contexto, async (tx) => {
      await tx`
        UPDATE negocio.emissao_em_lote
           SET interrompido_em = pg_catalog.now(),
               motivo_da_interrupcao = ${MOTIVO_DA_HIGIENE}
         WHERE concluido_em IS NULL
           AND interrompido_em IS NULL
      `;
    });
  }
}

beforeEach(liberarLotesEmAndamento, LIMITE_DO_CASO_MS);

describe('CT-911 — a seleção do lote é exatamente a competência em aberto e sem boleto', () => {
  it(
    'CT-911 — três elegíveis, quatro intrusas ausentes, e outra empresa não alcança nenhuma',
    async () => {
      const selecionadas = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        selecionarCobrancasSemBoleto(tx, COMPETENCIA),
      );

      const codigos = selecionadas.map(({ codigo }) => codigo);

      // --- 1. Metade do controle antivácuo: a lista DECLARADA não é vazia --------------------
      //
      // Esta perna não observa o SUT — ela protege a igualdade abaixo de comparar nada com nada
      // (`.claude/rules/ancoras-de-superficie.md`). Ela vem primeiro porque não pode reprovar por
      // defeito da porta: se reprovar, quem encolheu foi o arranjo.
      //
      // A contagem é conferida contra o LITERAL de {@link TOTAL_DE_ELEGIVEIS}, e **nunca** contra
      // `ELEGIVEIS.length`: as duas listas descendem do mesmo arranjo por `map`, que preserva
      // comprimento, de modo que uma compará-la com a outra é verdade por construção — inclusive com
      // o arranjo vazio, e aí o caso inteiro passaria por vacuidade. As DUAS pontas são ancoradas
      // porque só uma delas pode encolher: o arranjo, ou a derivação que entra na igualdade abaixo.
      expect(ELEGIVEIS).toHaveLength(TOTAL_DE_ELEGIVEIS);
      expect(CODIGOS_ESPERADOS).toHaveLength(TOTAL_DE_ELEGIVEIS);

      // --- 2. A igualdade de CONJUNTO, nos dois sentidos --------------------------------------
      //
      // Nunca `toContain`: ele aprovaria tanto a elegível que sumiu quanto a intrusa que apareceu. A
      // reprovação nomeia a cobrança culpada — o código dela entra em `excedentes` quando o predicado
      // perde um termo, e em `ausentes` quando ele ganha um a mais.
      //
      // Ela vem ANTES das contagens de propósito, e a ordem é conteúdo: a contagem reprova primeiro
      // em toda divergência de tamanho, e postada antes deixaria esta asserção inalcançável — o
      // diagnóstico viraria "esperava 3, veio 4" em vez de nomear a cobrança que vazou. É a ordem
      // canônica de `coerencia-de-migracoes.spec.ts`, e foi o modo de falha medido no `MT-T4-A`.
      expect(diferencasDeConjunto(codigos, CODIGOS_ESPERADOS)).toEqual({
        excedentes: [],
        ausentes: [],
      });

      // --- 3. As quatro intrusas, NOMEADAS ----------------------------------------------------
      //
      // A perna negativa dita por extenso: a paga, a cancelada, a que já tem boleto e a da competência
      // vizinha estão fora. Ela é implicada pela igualdade acima, e existe pela mesma razão de ordem —
      // ela aponta qual termo do predicado sumiu.
      const intrusasQueVazaram = INTRUSAS.map(({ codigo }) => codigo).filter((codigo) =>
        codigos.includes(codigo),
      );

      expect(intrusasQueVazaram).toEqual([]);

      // --- 4. A outra metade do antivácuo: as três foram LIDAS --------------------------------
      //
      // A igualdade de conjunto é cega a repetição — três linhas iguais e três distintas produzem o
      // mesmo conjunto —, e é a contagem do observado que fecha essa fresta.
      expect(selecionadas).toHaveLength(ESPERADAS.length);

      // --- 5. As DUAS chaves, na ordem declarada pela consulta --------------------------------
      //
      // A igualdade do corpo inteiro, e não só dos códigos: o `id` é o UUID que o percurso guarda na
      // chave estrangeira composta do item e do evento, e uma projeção que o deixasse de fora passaria
      // por qualquer asserção feita só sobre o código. A ordem é a do `ORDER BY codigo`, que é o
      // determinismo de que a retomada depende.
      expect([...selecionadas]).toEqual([...ESPERADAS]);

      // --- 6. O recorte é da POLÍTICA, não do parâmetro (ADR-0008) ----------------------------
      //
      // A MESMA chamada, com a MESMA competência, sob o contexto da empresa B: vazio. Nenhuma
      // assinatura recebeu `empresaId`, e nada na porta comparou empresa com coisa alguma — quem
      // recorta é a política forçada da tabela.
      const sobOutraEmpresa = await sobContextoDe(CONTEXTO_DE_B, async (tx) =>
        selecionarCobrancasSemBoleto(tx, COMPETENCIA),
      );

      expect(sobOutraEmpresa).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-916 — o índice único parcial impede dois lotes concorrentes na mesma empresa', () => {
  it(
    'CT-916 — o segundo lote de A é recusado pelo banco, o de B é aceito, e concluir libera o índice',
    async () => {
      // --- 1. O lote 1 da empresa A, com os dois instantes de desfecho nulos ------------------
      const lote1 = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      expect(lote1.id).toMatch(IDENTIFICADOR_UUID);
      expect(retrato(lote1)).toEqual({
        competencia: COMPETENCIA,
        // Derivado dos dois instantes, nunca de coluna (ADR-0022).
        estado: 'EM_ANDAMENTO',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: null,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      // --- 2a. O segundo lote de A pela PORTA: a recusa traduzida -----------------------------
      //
      // O tipo é asserido, e não "algum erro": é `ErroDeLoteEmCurso` que a borda reconhece para compor
      // `422` com `detalhes: { loteEmCurso: '…' }`, e o discriminante é o `id` EXATO do lote que já
      // está em curso — sem ele, o Admin ficaria sabendo que há um lote e não qual.
      const pelaPorta = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) =>
          abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
        ),
      );

      // `undefined` no ramo aceito é o que faz a asserção de tipo reprovar quando o segundo lote
      // passa: sem o ramo, um `catch` vazio deixaria a asserção sem o que observar.
      const recusa = pelaPorta.ok ? undefined : pelaPorta.erro;
      expect(recusa).toBeInstanceOf(ErroDeLoteEmCurso);

      if (!(recusa instanceof ErroDeLoteEmCurso)) {
        throw new Error('o segundo lote da empresa A não foi recusado com erro de domínio');
      }

      expect(recusa.loteEmCurso).toBe(lote1.id);

      // --- 2b. O mesmo segundo lote pela instrução CRUA: a recusa é DO BANCO ------------------
      //
      // A mesma instrução que a porta emite, sem a tradução. Ela prova que quem recusa é o índice, e
      // não um `if` escrito na aplicação — a distinção que uma asserção só sobre o erro de domínio não
      // faria. O nome do índice viaja junto do SQLSTATE porque estas tabelas têm outras restrições
      // únicas, e um `23505` sozinho não diz qual delas falou.
      const peloBanco = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => {
          await tx`
            INSERT INTO negocio.emissao_em_lote (empresa_id, competencia, solicitado_por)
            VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                    ${COMPETENCIA}::date,
                    ${USUARIO_DE_A.id})
          `;
        }),
      );

      expect(desfechoDaTentativa(peloBanco)).toBe(
        `${VIOLACAO_DE_UNICIDADE} · ${INDICE_DO_LOTE_EM_ANDAMENTO}`,
      );

      // --- 3. O lote da empresa B é aceito ----------------------------------------------------
      //
      // O índice é por empresa: a B abre o dela enquanto a A tem um em curso. Sem esta perna, um
      // índice único GLOBAL sobre a condição passaria nos passos anteriores.
      const loteDeB = await sobContextoDe(CONTEXTO_DE_B, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_B.id }),
      );

      expect(loteDeB.id).toMatch(IDENTIFICADOR_UUID);
      expect(loteDeB.id).not.toBe(lote1.id);
      expect(loteDeB.estado).toBe('EM_ANDAMENTO');

      // O lote de A não é alcançável sob o contexto de B, e a ausência é indistinguível da do lote
      // inexistente: quem a traduz em `404` é a borda, num ponto único (ADR-0008).
      const loteDeAsobB = await sobContextoDe(CONTEXTO_DE_B, async (tx) => lerLote(tx, lote1.id));
      expect(loteDeAsobB).toBeUndefined();

      // --- 4. Concluído o lote 1, um novo lote de A é aceito — o índice é PARCIAL -------------
      //
      // É este passo que discrimina índice parcial de índice total: sem ele, um `unique(empresa_id)`
      // sem cláusula `WHERE` passaria em tudo acima — e a empresa emitiria uma vez só, para sempre.
      await sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote1.id));

      const concluido = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote1.id)),
        'concluído',
      );

      expect(concluido.id).toBe(lote1.id);
      expect(retrato(concluido)).toEqual({
        competencia: COMPETENCIA,
        estado: 'CONCLUIDA',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: CARIMBO_DO_BANCO,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      const lote2 = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      expect(lote2.id).toMatch(IDENTIFICADOR_UUID);
      expect(lote2.id).not.toBe(lote1.id);
      expect(lote2.estado).toBe('EM_ANDAMENTO');

      // Os dois lotes abertos aqui são fechados: o índice é por empresa e atravessa os casos, e o
      // fecho é a própria afirmação de que `concluirLote` o libera (ver o cabeçalho).
      await sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote2.id));
      await sobContextoDe(CONTEXTO_DE_B, async (tx) => concluirLote(tx, loteDeB.id));
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-916 (b) — a prestação de contas agrega os itens, e o lote interrompido volta com o motivo',
    async () => {
      const MOTIVO_DA_RECUSA = 'motivo que o produto não reconhece';
      const MOTIVO_DA_PARADA = 'o provedor recusou a identidade da empresa';

      const lote = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      // Um item por cobrança tentada, pela porta — o `EMITIDO` sem motivo e o `RECUSADO` com o texto
      // do provedor **tal como respondido** (RN-15).
      await sobContextoDe(CONTEXTO_DE_A, async (tx) => {
        await registrarItemDoLote(tx, {
          loteId: lote.id,
          cobrancaId: PRIMEIRA_ELEGIVEL.id,
          desfecho: 'EMITIDO',
        });
        await registrarItemDoLote(tx, {
          loteId: lote.id,
          cobrancaId: SEGUNDA_ELEGIVEL.id,
          desfecho: 'RECUSADO',
          motivo: MOTIVO_DA_RECUSA,
        });
      });

      // --- 1. `RECUSADO` sem motivo é recusado PELO BANCO -------------------------------------
      //
      // A bicondicional `item_da_emissao_em_lote_motivo_chk` vale para todo caminho de escrita,
      // inclusive os que ainda não existem — é o oposto de uma verificação escrita na porta, que
      // valeria só para ela. A TERCEIRA elegível é usada aqui para não disputar a
      // `UNIQUE (lote_id, cobranca_id)` com os itens acima, o que faria a recusa vir da restrição
      // errada.
      const semMotivo = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) =>
          registrarItemDoLote(tx, {
            loteId: lote.id,
            cobrancaId: TERCEIRA_ELEGIVEL.id,
            desfecho: 'RECUSADO',
          }),
        ),
      );

      expect(desfechoDaTentativa(semMotivo)).toBe(`${VIOLACAO_DE_CHECK} · ${CHECK_DO_MOTIVO}`);

      // --- 2. A prestação de contas: contagens agregadas e itens pelo CÓDIGO ------------------
      //
      // As contagens saem dos itens, e não de coluna contadora: `emitidas + recusadas` é o tamanho da
      // lista publicada ao lado delas. Os itens nomeiam a cobrança pelo **código** (ADR-0017), com a
      // junção fazendo a tradução dentro da instrução — o UUID interno não sai daqui.
      const emAndamento = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'em andamento',
      );

      expect(retrato(emAndamento)).toEqual({
        competencia: COMPETENCIA,
        estado: 'EM_ANDAMENTO',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: null,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 1,
        recusadas: 1,
        itens: [
          { cobrancaCodigo: PRIMEIRA_ELEGIVEL.codigo, desfecho: 'EMITIDO', motivo: null },
          {
            cobrancaCodigo: SEGUNDA_ELEGIVEL.codigo,
            desfecho: 'RECUSADO',
            motivo: MOTIVO_DA_RECUSA,
          },
        ],
      });

      // --- 3. A interrupção devolve o lote COM o motivo e COM o que já saiu (CA-03) -----------
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        interromperLote(tx, lote.id, MOTIVO_DA_PARADA),
      );

      const interrompido = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'interrompido',
      );

      expect(retrato(interrompido)).toEqual({
        competencia: COMPETENCIA,
        estado: 'INTERROMPIDA',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: null,
        interrompidoEm: CARIMBO_DO_BANCO,
        motivoDaInterrupcao: MOTIVO_DA_PARADA,
        // O que já saiu PERMANECE: a interrupção não desfaz os itens gravados.
        emitidas: 1,
        recusadas: 1,
        itens: [
          { cobrancaCodigo: PRIMEIRA_ELEGIVEL.codigo, desfecho: 'EMITIDO', motivo: null },
          {
            cobrancaCodigo: SEGUNDA_ELEGIVEL.codigo,
            desfecho: 'RECUSADO',
            motivo: MOTIVO_DA_RECUSA,
          },
        ],
      });

      // --- 4. O segundo desfecho sobre o mesmo lote é recusado PELO BANCO ---------------------
      //
      // `emissao_em_lote_desfecho_unico_chk` é o que torna os dois desfechos mutuamente exclusivos — e
      // é por isso que a porta não escreve leitura prévia nenhuma para decidir se pode gravar.
      const dobroDesfecho = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote.id)),
      );

      expect(desfechoDaTentativa(dobroDesfecho)).toBe(
        `${VIOLACAO_DE_CHECK} · ${CHECK_DO_DESFECHO_UNICO}`,
      );

      // --- 5. E o índice já está livre: a interrupção também é desfecho -----------------------
      //
      // Sem esta perna, um índice parcial que só olhasse `concluido_em` passaria em tudo acima — e a
      // empresa cujo lote foi interrompido nunca mais emitiria.
      const depoisDaInterrupcao = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      expect(depoisDaInterrupcao.id).not.toBe(lote.id);
      expect(depoisDaInterrupcao.estado).toBe('EM_ANDAMENTO');

      await sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, depoisDaInterrupcao.id));
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-916 (c)/(d)/(e) — os desfechos conferem a linha alcançada e não reescrevem fato gravado', () => {
  it(
    'CT-916 (c) — concluir sob o contexto de OUTRA empresa não alcança a linha e levanta com nome',
    async () => {
      const lote = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      // --- 1. A conclusão sob o contexto de B levanta com NOME ---------------------------------
      //
      // A política esconde a linha de A sob o contexto de B (ADR-0008), de modo que o `UPDATE` alcança
      // zero linhas. Sem a conferência da linha alcançada, essa chamada resolveria em silêncio e quem
      // percorre seguiria acreditando que fechou — o desfecho que o ramo `ACEITO` de
      // {@link mensagemDaTentativa} existe para reprovar. A mensagem é asserida por igualdade literal,
      // e não por "algum erro": um `23514`, um erro de driver ou uma recusa da política diriam outra
      // coisa, e passariam por uma asserção frouxa.
      const sobOutraEmpresa = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_B, async (tx) => concluirLote(tx, lote.id)),
      );

      expect(mensagemDaTentativa(sobOutraEmpresa)).toBe(RECUSA_DA_CONCLUSAO);

      // --- 2. E o lote de A permanece EM ANDAMENTO --------------------------------------------
      //
      // A recusa não é só uma mensagem: a escrita de fato não teve efeito, e é isto que impede a
      // asserção acima de ser satisfeita por uma porta que levantasse **depois** de gravar.
      const intacto = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'de A depois da tentativa sob B',
      );

      expect(retrato(intacto)).toEqual({
        competencia: COMPETENCIA,
        estado: 'EM_ANDAMENTO',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: null,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      // --- 3. O CONTROLE POSITIVO: a mesma chamada, sob o contexto certo, conclui ---------------
      //
      // Sem ele, uma porta que levantasse **sempre** — quebrando a conclusão legítima do produto —
      // passaria nos dois passos acima. É o par que discrimina, não a asserção negativa isolada.
      await sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote.id));

      const concluido = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'concluído sob o contexto de A',
      );

      expect(retrato(concluido)).toEqual({
        competencia: COMPETENCIA,
        estado: 'CONCLUIDA',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: CARIMBO_DO_BANCO,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      // --- 4. E a REPETIÇÃO da conclusão também não alcança a linha ----------------------------
      //
      // `emissao_em_lote_desfecho_unico_chk` não cobre este caso: `interrompido_em` segue nulo, e a
      // linha continua coerente consigo mesma. Quem o fecha é `concluido_em IS NULL` na cláusula.
      const repeticao = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote.id)),
      );

      expect(mensagemDaTentativa(repeticao)).toBe(RECUSA_DA_CONCLUSAO);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-916 (d) — a segunda interrupção não alcança a linha, e o motivo original sobrevive',
    async () => {
      // O primeiro motivo é o fato que precisa sobreviver; o segundo é o intruso que jamais pode
      // substituí-lo. Eles são diferentes de propósito: com dois textos iguais, a asserção passaria
      // mesmo com a sobrescrita acontecendo.
      const MOTIVO_ORIGINAL = 'o provedor recusou a identidade da empresa';
      const MOTIVO_INTRUSO = 'motivo que jamais pode substituir o primeiro';

      const lote = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      // --- 1. A interrupção legítima grava o motivo — o controle positivo ----------------------
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        interromperLote(tx, lote.id, MOTIVO_ORIGINAL),
      );

      const primeiro = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'interrompido pela primeira vez',
      );

      expect(retrato(primeiro)).toEqual({
        competencia: COMPETENCIA,
        estado: 'INTERROMPIDA',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: null,
        interrompidoEm: CARIMBO_DO_BANCO,
        motivoDaInterrupcao: MOTIVO_ORIGINAL,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      // --- 2. A SEGUNDA interrupção, com outro motivo, não alcança a linha ---------------------
      //
      // As duas `CHECK` aprovariam esta escrita: `concluido_em` segue nulo, e `interrompido_em` e
      // `motivo_da_interrupcao` continuariam coerentes **entre si**. O que ela reescreveria é o fato já
      // gravado — e o motivo, que o cabeçalho da porta declara não recuperável, sumiria sem rastro.
      const repeticao = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => interromperLote(tx, lote.id, MOTIVO_INTRUSO)),
      );

      expect(mensagemDaTentativa(repeticao)).toBe(RECUSA_DA_INTERRUPCAO);

      // --- 3. O MOTIVO ORIGINAL sobreviveu, e o carimbo também ---------------------------------
      //
      // O corpo inteiro é comparado de novo, e o instante entra aqui por **valor literal** — e não
      // reduzido à forma, como {@link retrato} o entrega: um `interrompido_em` reescrito por
      // `pg_catalog.now()` continuaria bem-formado, e a marca da forma não o distinguiria. É a
      // comparação com a leitura anterior que prova que a linha não foi tocada.
      const depois = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'interrompido depois da repetição',
      );

      expect(retrato(depois)).toEqual(retrato(primeiro));
      expect(depois.motivoDaInterrupcao).toBe(MOTIVO_ORIGINAL);
      expect(depois.interrompidoEm).toBe(primeiro.interrompidoEm);

      // O caso termina com o lote INTERROMPIDO, que é desfecho: o índice parcial já está livre. Que a
      // interrupção o libere é asserção do `CT-916 (b)`, e repeti-la aqui seria o mesmo caso escrito
      // duas vezes.
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-916 (e) — o REENVIO da tarefa recusa com a CLASSE nomeada, e o desfecho gravado sobrevive',
    async () => {
      const lote = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
      );

      // --- 1. O CONTROLE que discrimina: nem toda recusa desta porta é a classe nova -----------
      //
      // A abertura concorrente é recusada, e com erro de domínio — mas com OUTRA classe, e carregando
      // outro fato. Sem esta perna, `ErroDeLoteNaoAlcancado` poderia ser o que a porta levanta para
      // qualquer insucesso, e as asserções seguintes não distinguiriam nada.
      const aberturaConcorrente = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) =>
          abrirEmissaoEmLote(tx, { competencia: COMPETENCIA, solicitadoPor: USUARIO_DE_A.id }),
        ),
      );

      expect(retratoDaRecusa(aberturaConcorrente)).toEqual({
        classe: CLASSE_LOTE_EM_CURSO,
        dito: RECUSA_DO_LOTE_EM_CURSO,
        lote: lote.id,
      });

      // --- 2. A causa GRAVE — o contexto de tenant errado — levanta a classe nomeada -----------
      //
      // É o percurso que o `CT-916 (c)` já mede pela mensagem; aqui o que se afirma é o TIPO, que é o
      // que a borda do processo de trabalho tem em mãos para decidir.
      const sobOutraEmpresa = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_B, async (tx) => concluirLote(tx, lote.id)),
      );

      expect(retratoDaRecusa(sobOutraEmpresa)).toEqual({
        classe: CLASSE_NAO_ALCANCADO,
        dito: RECUSA_DA_CONCLUSAO,
        lote: lote.id,
      });

      // --- 3. A conclusão legítima — a tentativa que COMITOU antes de o processo cair ----------
      await sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote.id));

      const apos = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'concluído pela tentativa que comitou',
      );

      // --- 4. O REENVIO BENIGNO: a mesma tarefa, o MESMO `loteId`, sob o contexto CERTO --------
      //
      // É o percurso que a entrega *at-least-once* torna alcançável: o desfecho já está gravado, a
      // seleção devolveria o complemento vazio, e a conclusão não encontra a linha. O retrato é
      // **idêntico** ao do passo 2, e a coincidência é o conteúdo: a camada de dados NÃO separa a causa
      // benigna da grave, e não deve tentar — quem decide é o chamador, que sabe se está reentrando. O
      // que a classe entrega é a distinção que importa aqui: "não alcancei a linha" contra qualquer
      // outra falha.
      const reenvio = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => concluirLote(tx, lote.id)),
      );

      expect(retratoDaRecusa(reenvio)).toEqual({
        classe: CLASSE_NAO_ALCANCADO,
        dito: RECUSA_DA_CONCLUSAO,
        lote: lote.id,
      });

      // --- 5. E o fato gravado sobreviveu ao reenvio -------------------------------------------
      //
      // O carimbo entra por **valor literal**, e não reduzido à forma: um `concluido_em` reescrito por
      // `pg_catalog.now()` continuaria bem-formado, e a marca da forma não o distinguiria.
      const depoisDoReenvio = exigirLote(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerLote(tx, lote.id)),
        'depois do reenvio da tarefa',
      );

      expect(retrato(depoisDoReenvio)).toEqual({
        competencia: COMPETENCIA,
        estado: 'CONCLUIDA',
        criadoEm: CARIMBO_DO_BANCO,
        concluidoEm: CARIMBO_DO_BANCO,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      expect(depoisDoReenvio.concluidoEm).toBe(apos.concluidoEm);

      // --- 6. O segundo CONTROLE: recusa em que a linha É alcançada não é a classe nova --------
      //
      // Interromper um lote já concluído alcança a linha (`interrompido_em` segue nulo) e é o BANCO que
      // recusa, por `emissao_em_lote_desfecho_unico_chk`. Sem esta perna, uma porta que traduzisse
      // qualquer insucesso de desfecho na classe nova passaria — e a classe deixaria de significar "a
      // linha não foi alcançada", que é o único fato que ela pode afirmar.
      const interrupcaoDoConcluido = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) =>
          interromperLote(tx, lote.id, 'motivo que jamais chega a ser gravado'),
        ),
      );

      expect(retratoDaRecusa(interrupcaoDoConcluido)).toEqual({
        classe: OUTRA_RECUSA,
        dito: `${VIOLACAO_DE_CHECK} · ${CHECK_DO_DESFECHO_UNICO}`,
        lote: null,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});
