/**
 * A porta de dados da cobrança contra banco real, e a mora contra o oráculo — CT-512, CT-513,
 * CT-524, CT-525, CT-526, CT-528 e CT-536 (T4), mais CT-517, CT-527 e CT-532 (T7) e CT-521 (T10) da
 * fatia `cobranca-e-mora`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-05    | CT-512 | Uma cobrança com vencimento no passado, sem pagamento e sem cancelamento, é
 * |          |        | publicada `VENCIDA` com `diasAtraso 30` já na PRIMEIRA leitura, e a linha
 * |          |        | física **não sofre escrita alguma**: o `xmin` da tupla é idêntico nas três
 * |          |        | medições. `negocio.cobranca` **não tem** `status`, `pagamento_confirmado`,
 * |          |        | `data_inicio_atraso` nem `data_ultima_atualizacao_atraso` — as quatro que as
 * |          |        | rotinas noturnas do legado escreviam. |
 * | CA-05    | CT-512 | E não há gatilho a rodar: o repositório declara **duas** unidades `systemd`,
 * |          | (b)    | as duas `.service` e nenhum `.timer`, e **uma** fila BullMQ (`eco`, da F0) —
 * |          |        | nenhuma de negócio. A mesma asserção reprova sobre cópias com um timer novo
 * |          |        | e com uma fila nova. |
 * | CA-05    | CT-513 | A fronteira do vencimento é **estrita**: vencer ontem publica `VENCIDA` com
 * |          |        | `diasAtraso 1`, `20.00`/`0.33`/`1020.33`; vencer hoje e amanhã publicam
 * |          |        | `A_VENCER` com `diasAtraso 0` e `0.00`/`0.00`/`1000.00`. E
 * |          |        | `data_corrente_da_operacao()` devolve o MESMO valor sob `UTC` e sob
 * |          |        | `Pacific/Kiritimati` — o fuso é do objeto, não da sessão. |
 * | CA-05    | CT-513 | **Falsificação**: recriada a visão com `<=` no lugar de `<`, o vencimento de
 * |          | (falsif.) | HOJE passa a `VENCIDA` com multa integral por zero dia de atraso;
 * |          |        | restaurada a íntegra, volta a `A_VENCER`. A substituição é ela mesma
 * |          |        | afirmada (exatamente uma ocorrência trocada). |
 * | CA-11    | CT-524 | Empresa **sem** linha em `configuracao_de_mora` apura `0.00`/`0.00` sobre
 * |          |        | cobrança `VENCIDA` há 60 dias, o total é o valor original, e a linha
 * |          |        | **CONSTA** na carteira (`total === 1`) — é o `LEFT JOIN` com `COALESCE`, e
 * |          |        | não um `INNER JOIN` que a faria desaparecer. Registrada a política 2%/0%, a
 * |          |        | mesma linha passa a `30.00`/`0.00`/`1530.00`. |
 * | CA-11    | CT-524 | E a implicação de que o par `pago_em IS NULL AND cancelado_em IS NULL` do
 * |          | (b)    | recorte em aberto depende é exercitada com DADO: TRÊS cobranças com o mesmo
 * |          |        | vencimento, vencidas há 60 dias — todas `VENCIDA` antes do carimbo —, das
 * |          |        | quais uma é paga e outra cancelada, passam a ser publicadas `PAGA` e
 * |          |        | `CANCELADA` pela precedência da visão; e os três recortes por `status`
 * |          |        | trazem cada um **exatamente** a sua, particionando a carteira
 * |          |        | (`total === 3`). |
 * | CA-12    | CT-525 | Para cada uma das **10 invocações** dos **6 casos** de `calcular-mora.json`, a
 * |          |        | visão publica `valorMulta`, `valorJuros` e `valorTotal` iguais aos do golden
 * |          |        | — igualdade **exata**, jamais tolerância —, com `diasAtraso` igual ao da
 * |          |        | entrada. E os juros **não incidem sobre a multa**: com multa 2% e com 50%, o
 * |          |        | `valorJuros` é o mesmo. |
 * | CA-12    | CT-526 | `1234.56` a 17 dias publica `24.69`/`7.00`/`1266.25` e a 5 dias
 * |          |        | `24.69`/`2.06`/`1261.31` — a multa é idêntica nos dois, porque não depende
 * |          |        | dos dias. A migração `0010` **não contém** `float8`, `double precision`,
 * |          |        | `::real` nem `::float` em posição executável. |
 * | CA-12    | CT-526 | **Falsificação**: a asserção estática reprova nomeando o cast sobre uma cópia
 * |          | (falsif.) | da `0010` cuja expressão de juros passa por `double precision`, e passa
 * |          |        | limpa sobre a cópia íntegra. E a **posição** do único `round` é provada
 * |          |        | comportamentalmente: arredondada a taxa diária antes de multiplicar pelos
 * |          |        | dias, a leitura de 17 dias devolve `6.97` no lugar de `7.00`. |
 * | CA-13    | CT-528 | Os juros são **simples**: 60 dias valem exatamente o **dobro** de 30 —
 * |          |        | afirmado como relação, e não só pelos dois valores —, e a multa é idêntica
 * |          |        | nas duas. O par distante (5 e 500 dias) exercita a mesma propriedade com a
 * |          |        | mesma multa. E 30 dias valem exatamente 1% do valor original. |
 * | CA-02    | CT-536 | O código nasce `COB-{ano}-{7 dígitos}` — afirmado pelo **valor literal** —, a
 * | CA-09    |        | série corre por `(empresa, ano)`, a unidade abortada **queima** o número (a
 * |          |        | seguinte recebe `N+2`, nunca `N+1`), duas empresas emitem
 * |          |        | `COB-2027-0000001` cada uma no mesmo ano, e o código duplicado na mesma
 * |          |        | empresa levanta `23505` nomeando `cobranca_empresa_codigo_key` — que a porta
 * |          |        | traduz em `ErroDeCodigoDeCobrancaEmUso`. |
 * | CA-07    | CT-517 | O banco recusa estado impossível, e a impossibilidade é **dele**: linha com
 * | CA-10    |        | `pago_em` e `cancelado_em` ambos preenchidos levanta `23514` nomeando
 * |          |        | `cobranca_desfecho_unico_chk`; carimbo com `pago_em` nulo levanta `23514`
 * |          |        | nomeando `cobranca_carimbo_coerente_chk` — afirmado **duas** vezes, por um
 * |          |        | valor e por um percentual. A escrita LEGÍTIMA dos cinco campos juntos é
 * |          |        | **aceita** (controle positivo, sem o qual um `CHECK` que recusasse tudo
 * |          |        | passaria as três negativas). |
 * | CA-12    | CT-527 | A mora só é APURADA quando `VENCIDA`, e a precedência
 * | CA-04    |        | `CANCELADA → PAGA → VENCIDA → A_VENCER` é o que impede o produto de
 * |          |        | reproduzir a divergência do legado: A_VENCER (`+10`) publica
 * |          |        | `0.00`/`0.00`/`2000.00`; CANCELADA **vencida há 60 dias** publica
 * |          |        | `CANCELADA` — nunca `VENCIDA` — com `0.00`/`0.00`/`2000.00`; VENCIDA há 60
 * |          |        | publica `40.00`/`40.00`/`2080.00` (controle positivo); e a PAGA publica os
 * |          |        | **carimbos** `40.00`/`34.67`/`2074.67`, com `dias_atraso 0` no lugar dos 52
 * |          |        | que continuariam crescendo. |
 * | CA-16    | CT-532 | Com os **seis** campos de conciliação bancária preenchidos, acusar o
 * |          |        | pagamento preserva os seis com os MESMOS valores — afirmados **um a um**, e
 * |          |        | não por comparação de objeto que mascararia um campo esquecido —, e grava
 * |          |        | os quatro carimbos de mora no mesmo ato. E `negocio.cobranca` **não tem**
 * |          |        | coluna `pagamento_confirmado`: a lista de colunas é comparada por igualdade.
 * | CA-10    | CT-521 | **Nenhuma** das três operações destrutivas plausíveis apaga cobrança: sobre uma
 * |          |        | carteira de quatro, acusar pagamento, cancelar cobrança e **cancelar em
 * |          |        | cascata** preservam a contagem — `4` nas **quatro** medições —, e cada uma é
 * |          |        | acompanhada da prova de que fez efeito (`PAGA`, `CANCELADA`, e a cascata
 * |          |        | devolvendo **2**: as duas em aberto, nenhuma das terminais). A lista ordenada
 * |          |        | de colunas de `negocio.cobranca` é igual à declarada na `0009` — sem
 * |          |        | `retirado_em` e sem `status` —, e os métodos declarados pelo controlador que
 * |          |        | serve `/v1/cobrancas` são exatamente `['GET','POST']`: **não existe `DELETE`**.
 * | CA-10    | CT-521 | **Falsificação**: acrescentado um `@Delete(':codigo')` a uma cópia em memória do
 * |          | (falsif.) | fonte do controlador, a varredura passa a devolver `['DELETE','GET','POST']`
 * |          |        | e reprova a igualdade; a cópia íntegra passa limpa. A substituição é ela
 * |          |        | mesma afirmada (exatamente uma ocorrência trocada).
 *
 * Rastreabilidade: `CA-05 → CT-512 (RN-05)` · `CA-05 → CT-512 (b) (RN-05)` ·
 * `CA-05 → CT-513 (RN-05)` · `CA-11 → CT-524, CT-524 (b) (RN-08)` · `CA-12 → CT-525 (RN-07)` ·
 * `CA-12 → CT-526 (RN-16)` · `CA-13 → CT-528 (RN-07)` · `CA-02 → CT-536 (RN-02)` ·
 * `CA-09 → CT-536 (RN-02)` · `CA-07 → CT-517 (RN-09)` · `CA-10 → CT-517 (RN-12)` ·
 * `CA-12 → CT-527 (RN-08)` · `CA-04 → CT-527 (RN-04)` · `CA-16 → CT-532 (RN-15)` ·
 * `CA-10 → CT-521 (RN-13)`.
 *
 * ===========================================================================
 * DUAS DIVERGÊNCIAS DECLARADAS CONTRA OS CARDS DA T7
 * ===========================================================================
 *
 * **O CT-517 nomeia as duas restrições como "declaradas na migração `0010`", e elas estão na `0009`.**
 * As duas são `CHECK` de tabela, emitidas pelo gerador a partir de `src/esquema/negocio.ts`; a `0010`
 * é a autoral, que traz `FORCE`, políticas, funções e visão. Os casos afirmam o **nome real** de cada
 * restrição, que é o que discrimina — `negocio.cobranca` tem quatro `CHECK`, e um `23514` sozinho não
 * diz qual falou.
 *
 * **O CT-532 manda acusar o pagamento por `POST /v1/cobrancas/:codigo/pagamento`, e esta suíte não
 * tem HTTP.** Ela é a da camada de dados: não há aplicação montada nem porta escutando aqui, e montar
 * uma faria este arquivo atravessar uma fronteira que o pacote não tem. O ato é exercitado pela porta
 * de produção que a rota chama por dentro — `acusarPagamentoDeCobranca` —, que é o caminho legítimo
 * alcançável desta camada; a **rota** é exercitada pelo CT-516 e pelo CT-518, em
 * `apps/api/test/cobrancas.e2e.spec.ts`.
 *
 * ===========================================================================
 * A MESMA DIVERGÊNCIA, DUAS VEZES, NO CARD DA T10
 * ===========================================================================
 *
 * **O CT-521 manda montar os estados "pelas rotas de produção" e consultar "a cobertura de
 * autorização", e esta suíte não tem HTTP nem alcança `apps/api`.** As duas metades caem na mesma
 * divergência do CT-532, e por razões de arquitetura, não de conveniência:
 *
 *   * o **cenário e as três operações** correm pelas portas de produção que as rotas chamam por dentro
 *     — `criarCobranca`, `acusarPagamentoDeCobranca`, `cancelarCobranca` e
 *     `cancelarCobrancasDoContrato` —, que é o caminho legítimo alcançável desta camada;
 *   * a **cobertura de autorização** é módulo de `apps/api/src`, e `packages/db` não importa `apps` —
 *     a direção do grafo de pacotes é `api → db`, e invertê-la para um caso de teste seria defeito de
 *     arquitetura. O que este caso lê é o **texto versionado** do controlador que declara o segmento,
 *     pelo mesmo critério do CT-512 (b), que enumera unidades `systemd` e filas do repositório. A
 *     asserção é estática, e por isso vem com prova de falsificação.
 *
 * ===========================================================================
 * O GOLDEN É O ORÁCULO — lido do arquivo versionado, NUNCA redigitado
 * ===========================================================================
 *
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/calcular-mora.json` é o registro
 * capturado do sistema antigo. **Se a visão divergir dele, o errado é a visão.** Redigitar os valores
 * aqui faria a asserção concordar com quem a escreveu, e o valor de equivalência com o legado
 * desapareceria em silêncio no primeiro erro de transcrição — mesma disciplina do cabeçalho de
 * `derivacao-de-contrato.spec.ts`.
 *
 * A contagem é ela mesma afirmada, **nos dois eixos**: `6` casos e `10` invocações lidos do arquivo, e
 * `10` invocações efetivamente comparadas. Sem isso, um golden truncado ou um laço que parasse cedo
 * deixariam o caso verde tendo provado um punhado de cenários. **O número é `10`** — ver a seção
 * seguinte e {@link INVOCACOES_DO_GOLDEN}; nenhum ponto deste arquivo redigita o nove do card.
 *
 * ===========================================================================
 * O RELÓGIO NUNCA É FALSEADO — o cenário é posicionado pelo DADO
 * ===========================================================================
 *
 * Todo atraso deste arquivo é montado por `negocio.data_corrente_da_operacao() ± INTERVAL 'N days'`,
 * lido do banco e entregue à porta como cadeia `YYYY-MM-DD` — ver {@link dataDeslocada}. **Nenhum
 * parâmetro de data foi acrescentado à produção, nenhum relógio foi substituído, e nenhum caso força
 * a virada do dia por `SET timezone`.** É a convenção que os goldens das rotinas já adotam (offset em
 * dias relativo ao dia da captura) e a que o D2 do tech alignment fixa; o único caso que toca o fuso
 * da sessão é o CT-513, e ele o faz para **afirmar** que a função é imune a ele.
 *
 * ===========================================================================
 * O GOLDEN TEM DEZ INVOCAÇÕES, E NÃO NOVE — divergência medida contra o card
 * ===========================================================================
 *
 * O card do CT-525 e a §3.3 da task escrevem *"6 casos, 9 invocações"* e *"27 asserções"*. **Lido do
 * disco**, `calcular-mora.json` tem `1 + 2 + 2 + 2 + 2 + 1 = 10` invocações, e portanto **30**
 * asserções de valor. O número do card foi redigitado; o deste arquivo veio do artefato — que é
 * exatamente a razão de o oráculo ser lido em vez de transcrito. Ver {@link INVOCACOES_DO_GOLDEN}.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os cinco reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` pedem demonstrar que a
 * prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * `packages/db/src/cobranca.ts` e a suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `14 arquivos, 99 casos, 0 falhas`;
 *   * **MT-1 · a tradução de `23505` deixa de reconhecer a restrição** (`ehViolacaoDe` compara o nome
 *     com um sufixo a mais): `1 failed | 98 passed` — o `CT-536` reprova em
 *     `expected PostgresError: duplicate key value violat… to be an instance of
 *     ErroDeCodigoDeCobrancaEmUso`: a colisão passa a chegar ao cliente como erro de driver em `500`;
 *   * **MT-2 · a criação RELÊ o ano** (`criarCobranca` compõe o código com `new Date().getFullYear()`
 *     em vez do ano recebido junto do número): `1 failed | 98 passed` — o `CT-536` reprova em
 *     `expected 'COB-2026-0000001' to be 'COB-2027-0000001'`. É a virada do ano entre as duas
 *     unidades sequenciais tornada visível;
 *   * **MT-3 · a projeção perde o `to_char`** (`competencia` sai como coluna crua): `1 failed | 98
 *     passed` — o `CT-513` reprova em
 *     `expected 2026-01-01T00:00:00.000Z to be '2026-01-01'`, exibindo literalmente o objeto `Date`
 *     no fuso do processo que a projeção existe para não produzir;
 *   * **MT-4 · a conversão de `numeric` some** (`cobrancaPublicada` devolve `valorTotal` em texto):
 *     `2 failed | 97 passed` — o `CT-525` reprova em `expected '2074.67' to be 2074.67` e a
 *     falsificação comportamental do `CT-526` em `expected '1266.22' to be 1266.22`. É a medida de
 *     que o JSON sairia com o dinheiro entre aspas e nada acusaria;
 *   * **MT-5 · o filtro de natureza é ignorado** (`predicadoDaCarteira` deixa de compor o recorte):
 *     `1 failed | 98 passed` — o `CT-524` reprova em `expected 1 to be +0`, no companheiro negativo
 *     `natureza: 'AGUA'`. Sem o passo 6 daquele caso, `listarCobrancas` teria os três filtros sem
 *     asserção nenhuma;
 *   * **reversão** — em cada mutante o arquivo foi restaurado de cópia e conferido idêntico por
 *     `diff -q`, e o controle voltou a `99 passed`.
 *
 * Os mutantes das **migrações** não estão nesta lista porque são pernas PERMANENTES da suíte, e não
 * medições avulsas: o `<=` do CT-513 e as duas posições de `round` do CT-526 são aplicados a cada
 * execução, numa instância dedicada, a partir do texto real da `0010`.
 *
 * **MT-7 · a visão volta a publicar mora ZERO para a cobrança liquidada** é o mutante da **T7**, e
 * mede a mudança que ela fez na `0010`: removidos os dois `COALESCE` do carimbo — o estado em que a T3
 * deixou a visão —, a suíte deste pacote fica em `1 failed | 106 passed`, e o único caso vermelho é o
 * `CT-527`, na igualdade da PAGA. Do outro lado da fronteira, `@sysloc/api` fica em
 * `3 failed | 166 passed` (`CT-516`, `CT-518` e `CT-511`). É a medição de que o carimbo, apesar de
 * gravado, era **inalcançável** pelas dezoito colunas publicadas: `multa_aplicada` e `juros_aplicados`
 * não estão entre elas, e `valor_multa`/`valor_juros` eram o único caminho. Revertido por cópia e
 * conferido por `diff -q`.
 *
 * **MT-6 · a precedência do `CASE` da visão** é a exceção, e por isso está aqui: medição avulsa sobre
 * o texto da `0010`, com `'PAGA'` movido para DEPOIS de `'VENCIDA'` — que é a forma pela qual a
 * implicação de que `predicadoDaCarteira` depende (*estado em aberto ⇒ os dois carimbos são nulos*)
 * deixaria de valer. Resultado: `1 failed | 99 passed`, e o único caso vermelho é o `CT-524 (b)`, em
 * `expected 'VENCIDA' to be 'PAGA'`. **Os outros 99 seguiram verdes**, o que é a medida de que a
 * propriedade não tinha rede alguma antes deste sub-caso — o passo 6 do `CT-524` a afirmava por
 * vacuidade, sobre um cenário de uma linha só. Revertido por cópia e conferido por `diff -q`.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * As duas tabelas da cobrança nascem sob RLS **forçada** (`migracoes/0010_seguranca_cobranca.sql`), a
 * visão é `security_invoker`, e as duas funções da série levantam sem contexto: ler e escrever exige
 * contexto de tenant fixado. O contexto vem **exclusivamente** da API pública do pacote —
 * `contextoDeTenant.executarCom` mais `abrirAcessoAoBanco` —, que é o mesmo caminho da operação.
 *
 * **Nenhum símbolo foi acrescentado a `packages/db/src/**` para que estas provas existam** (Iron Law
 * #6), e nenhuma consulta compara `empresa_id` (ADR-0008). Conjunto, imóvel, locador, locatário e
 * contrato nascem pelas portas públicas do pacote, e o contrato é ativado pelo protocolo das duas
 * unidades sequenciais que a borda usa.
 *
 * **A política de mora é gravada por instrução crua**, e isso é declarado em vez de escondido: a porta
 * que a escreve nasce em **T6**, junto da rota `PUT /v1/multa-e-juros`, e criá-la aqui seria uma
 * função de produção sem chamador por duas tasks — o que o Gate 2 classifica como
 * `speculative_complexity`. A instrução corre **sob a política**, com o papel `sysloc_app`, pelo mesmo
 * caminho que a porta usará: ela não contorna nada, ela apenas ainda não tem nome.
 *
 * **O desfecho, por outro lado, DEIXOU de ser instrução crua na T7.** Os dois acessórios que
 * carimbavam pagamento e cancelamento por `UPDATE` existiam com prazo declarado — *"a porta que
 * liquida nasce em T7"* —, e a T7 os publicou: {@link pagar} e {@link cancelar} chamam
 * `acusarPagamentoDeCobranca` e `cancelarCobranca`, que são o caminho que a rota usa por dentro.
 * Manter a escrita crua ao lado da porta publicada deixaria **duas** formas de liquidar no mesmo
 * arquivo, e a mais frouxa das duas montaria os cenários que a outra existe para provar. A troca
 * **fortalece** o `CT-524 (b)`, que passa a posicionar os terminais pelo caminho de produção, e não
 * muda nada do que ele afirma: com a política 2%/0% sobre `1500.00` aos 60 dias, os carimbos que a
 * porta deriva da visão são exatamente os `30.00`/`0.00` que o acessório antigo escrevia à mão.
 *
 * A escrita crua sobrevive em **três** lugares, todos declarados: as três violações de `CHECK` do
 * CT-517 (que existem para exercitar a recusa do banco), os seis campos de conciliação do CT-532 (que
 * **não têm rota nesta fatia** — a emissão de boleto é da F4) e a política de mora acima.
 *
 * A conexão de **migração** é usada num lugar só — {@link comVisaoMutada} —, e ali é inevitável:
 * recriar a visão é ato de dono, e é o que as duas provas de falsificação exigem. Ela corre numa
 * instância **dedicada**, que nenhum outro caso deste arquivo alcança.
 *
 * ===========================================================================
 * O CONTRAFACTUAL DO `7,02` NÃO SE REPRODUZ — e é por isso que o mutante é OUTRO
 * ===========================================================================
 *
 * O card do CT-526 pede a prova comportamental sobre uma cópia que arredonde
 * `valor_original * juros_percentual / 100` **antes** de dividir por 30, afirmando que a leitura de
 * 17 dias devolveria `7,02`. **Medido nesta task, ela devolve `7.00`** — o mesmo centavo da forma
 * íntegra —, e o mesmo vale aos 5 dias (`2.06` nos dois). É a mesma medição que a T3 já havia feito
 * ao remover o contrafactual do comentário da `0010` em 2026-08-10, com a razão escrita lá:
 * *"justificativa que não se reproduz é pior que justificativa ausente"*.
 *
 * O invariante que o card quer provar — **a posição do único `round` é conteúdo** — continua sendo
 * provado, e por um mutante que **discrimina de fato**: arredondar a **taxa diária** antes de
 * multiplicar pelos dias devolve `6.97` aos 17 dias e `2.05` aos 5. O caso aplica os **dois**: o do
 * card, para registrar a refutação de forma executável (e impedir que uma rodada futura o reintroduza
 * como se provasse algo), e o que discrimina, que é a prova.
 */

import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatarCodigoDeCobranca } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  acusarPagamentoDeCobranca,
  cancelarCobranca,
  cancelarCobrancasDoContrato,
  criarCobranca,
  type DadosDaCobranca,
  type DesfechoDoPagamento,
  ErroDeCodigoDeCobrancaEmUso,
  emitirNumeroDeCobranca,
  type FiltrosDaCarteira,
  garantirContadorDeCobranca,
  type LinhaDeCobranca,
  listarCobrancas,
  localizarCobranca,
} from '../src/cobranca.ts';
import { abrirConexao } from '../src/conexao.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  ativarContrato,
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import { derivarTerminoDaLocacao, derivarValorTotal } from '../src/derivacao-de-contrato.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import { criarImovel } from '../src/imovel.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso escreve poucas dezenas de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 120_000;

/** Reserva de UMA conexão: as unidades de trabalho dos casos correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// Os artefatos do repositório que os casos observam
// ---------------------------------------------------------------------------

/** A raiz do monorepo, resolvida a partir deste módulo — `packages/db/test/` menos três níveis. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** O oráculo da mora, capturado do sistema antigo pela fatia de caracterização. */
const CAMINHO_DO_GOLDEN = join(
  RAIZ_DO_REPOSITORIO,
  'docs/specs/features/caracterizacao-regras-legadas/v1/golden/calcular-mora.json',
);

/** A migração autoral que cria a visão e as funções — alvo da asserção estática do CT-526. */
const CAMINHO_DA_MIGRACAO = join(
  RAIZ_DO_REPOSITORIO,
  'packages/db/migracoes/0010_seguranca_cobranca.sql',
);

/** Onde vivem as unidades `systemd` do repositório — o CT-512 (b) as enumera. */
const DIRETORIO_DE_UNIDADES = join(RAIZ_DO_REPOSITORIO, 'deploy/systemd');

/**
 * O módulo que declara as filas — o CT-512 (b) as enumera.
 *
 * Era `apps/worker/src/fila.ts`; passou a ser o contrato compartilhado quando a T7 da fatia
 * `regua-de-cobranca` fechou o **D32 (F0/T6)** e desceu nome, opções e cargas para
 * `@sysloc/shared`. Apontar para o lugar antigo deixaria o leitor **cego** — devolvendo lista
 * vazia, que é o pior desfecho de uma asserção estática.
 */
const CAMINHO_DA_FILA = join(RAIZ_DO_REPOSITORIO, 'packages/shared/src/fila.ts');

/**
 * O controlador que **declara o segmento** `/v1/cobrancas` — o fonte que o CT-521 varre.
 *
 * A varredura é estática e mora nesta suíte pelo mesmo critério do CT-512 (b), que enumera as unidades
 * `systemd` e as filas do repositório: o invariante é sobre o **texto versionado**, e não sobre
 * comportamento observável por chamada. Montar uma aplicação Nest aqui faria este pacote atravessar
 * uma fronteira que ele não tem — a mesma divergência declarada do CT-532.
 */
const CAMINHO_DO_CONTROLADOR_DE_COBRANCAS = join(
  RAIZ_DO_REPOSITORIO,
  'apps/api/src/cobrancas/cobranca.controller.ts',
);

/**
 * As duas âncoras que ligam o fonte varrido ao caminho `/v1/cobrancas`, escritas por extenso.
 *
 * Sem elas, o caso provaria os métodos de *um arquivo*, e não os da **rota**: um `@Controller` movido
 * para outro segmento deixaria a asserção verde sobre uma superfície que já não é a da cobrança. As
 * duas são afirmadas juntas porque uma sozinha não basta — a primeira fixa o segmento, a segunda fixa
 * que é este arquivo que o serve.
 */
const DECLARACAO_DO_SEGMENTO_DAS_COBRANCAS = "export const CAMINHO_DAS_COBRANCAS = 'cobrancas';";
const DONO_DO_SEGMENTO_DAS_COBRANCAS = '@Controller(CAMINHO_DAS_COBRANCAS)';

/**
 * Os métodos HTTP que o controlador de cobrança declara — **`GET` e `POST`, e nada mais**.
 *
 * Escritos por extenso e em ordem alfabética, que é a ordem em que {@link metodosDeclarados} os
 * devolve. **Não existe `DELETE`**, e a ausência é contrato: a cobrança não tem ato de exclusão a
 * traduzir (ADR-0014, §21 do tech spec) — ela **transita de estado**, e o registro permanece legível.
 * Igualdade da lista, e não um `not.toContain('DELETE')`: a igualdade também pega o `PUT` que
 * reintroduzisse estado editável e o `PATCH` que reintroduzisse desfecho por corpo de requisição.
 */
const METODOS_SOB_COBRANCAS: readonly string[] = Object.freeze(['GET', 'POST']);

/**
 * Como um manipulador declara o método HTTP no Nest — o padrão que {@link metodosDeclarados} lê.
 *
 * Âncora de **início de linha** (com tolerância a indentação), e não busca livre: um `@Delete` citado
 * em prosa de docblock começa a linha com ` * ` e não casa. É o mesmo defeito que a F0 mediu, em que
 * uma asserção casava `ALTER ROLE` dentro de um comentário e ficava verde sobre um script sem guarda.
 */
const DECLARACAO_DE_METODO = /^[ \t]*@(All|Delete|Get|Head|Options|Patch|Post|Put)\s*\(/gm;

/** O método que a falsificação do CT-521 acrescenta à cópia — nunca à árvore versionada. */
const METODO_DE_EXCLUSAO = 'DELETE';

/** Quantas cobranças a carteira do CT-521 tem — e continua tendo depois das três operações. */
const QUATRO_COBRANCAS = 4;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * A forma publicada do código, escrita **por extenso** — a única coisa deste arquivo que a redigita.
 *
 * Ela é a **decisão**, e não um valor que o caso descubra do próprio SUT: derivá-la de
 * `ESQUEMA_DO_CODIGO_DE_COBRANCA` faria o caso concordar com qualquer largura que o contrato viesse a
 * declarar — inclusive cinco, que o marcador `DECISÃO FECHADA` de `packages/contracts/src/cobranca.ts`
 * existe para impedir. Mesmo desenho de `FORMA_DO_CODIGO` em `contrato.spec.ts`.
 */
const FORMA_DO_CODIGO = /^COB-\d{4}-\d{7}$/;

/**
 * O ano da série que o CT-536 usa — **fixo, e nenhum outro caso o toca**.
 *
 * Ele existe porque aquele caso afirma a **posição** do contador de duas empresas (o número `1` para
 * cada uma, o furo em `2` e a coincidência entre elas). No ano corrente, que a suíte inteira
 * compartilha, isso só seria verdade enquanto ele fosse o primeiro `describe` do arquivo. Com escopo
 * exclusivo, os absolutos passam a ser verdade **por construção**. A faixa que
 * `negocio.garantir_contador_de_cobranca` guarda é 2000–2999.
 */
const ANO_DEDICADO_AO_CT536 = 2027;

/** A competência que todo lançamento deste arquivo usa — primeiro dia do mês, como o `check` exige. */
const COMPETENCIA = '2026-01-01';

/** Os termos do contrato do arranjo — nenhum caso afirma coisa alguma sobre eles. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-15',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
  pdfContratoArquivo: null,
} as const;

/**
 * As unidades `systemd` que o repositório declara — **duas**, as duas `.service`, nenhum `.timer`.
 *
 * A ausência de `.timer` é a asserção: a ADR-0022 recusa estado publicado movido por rotina, e um
 * agendamento novo seria a forma de reintroduzi-lo. Ver o CT-512 (b).
 */
const UNIDADES_DECLARADAS: readonly string[] = Object.freeze([
  'sysloc-api.service',
  'sysloc-worker.service',
]);

/**
 * As filas BullMQ que o repositório declara — **duas**, e nenhuma delas move estado publicado.
 *
 * O card pede *"a fila tem `0` tarefas enfileiradas"*. Contra uma fila real isso exigiria subir Redis
 * dentro da suíte da camada de dados, o que atravessaria uma fronteira que este pacote não tem; e a
 * asserção seria **mais fraca**, porque uma fila vazia num instante não diz nada sobre a fatia. A
 * forma abaixo é mais forte: ela enumera, por igualdade, **toda** fila que existe.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista era `['eco']` e citava o gatilho do `D32 · F0/T6` — *"a primeira
 * fatia que enfileirar tarefa de negócio"* — como razão de não haver fila de negócio nenhuma. Esse
 * gatilho **chegou**: a fatia `regua-de-cobranca` declara `regua-de-cobranca`, e o código de
 * produção está certo. O que a ADR-0022 proíbe é estado publicado **movido por rotina**, e a régua
 * lê `negocio.cobranca_derivada` e grava apenas `negocio.envio_de_cobranca` — não existe coluna de
 * estado para ela mover, o que o Passo 4 deste mesmo caso continua provando. A asserção **não
 * afrouxa**: segue por igualdade sobre a lista inteira, de modo que uma terceira fila — uma
 * `cobranca-vencida`, que é a forma exata do defeito — reprova o caso nomeando-a.
 */
const FILAS_DECLARADAS: readonly string[] = Object.freeze(['eco', 'regua-de-cobranca']);

/** O agendamento que a falsificação do CT-512 (b) acrescenta à cópia — nunca à árvore versionada. */
const TIMER_FALSIFICADO = 'sysloc-cobranca-vencida.timer';

/** Como o contrato compartilhado nomeia cada fila — o padrão que {@link lerFilasDeclaradas} lê. */
const DECLARACAO_DE_FILA = /FILA_[A-Z_]+ = '([^']+)'/g;

/**
 * As quatro colunas que as rotinas noturnas do legado escreviam, **nomeadas por extenso**.
 *
 * Duas vêm de `marcar-cobrancas-vencidas.json` (`status_cobranca`, `pagamento_confirmado`) e duas de
 * `atualizar-atrasos-cobrancas.json` (`data_inicio_atraso`, `data_ultima_atualizacao_atraso`). A
 * ausência delas em `negocio.cobranca` é o que torna a rotina **irrepresentável**: não há onde
 * escrever.
 */
const COLUNAS_DO_LEGADO: readonly string[] = Object.freeze([
  'status',
  'pagamento_confirmado',
  'data_inicio_atraso',
  'data_ultima_atualizacao_atraso',
]);

/** Os tipos de ponto flutuante que a aritmética da `0010` não pode tocar (RN-16). */
const MARCAS_DE_PONTO_FLUTUANTE: readonly string[] = Object.freeze([
  'float8',
  'double precision',
  '::real',
  '::float',
]);

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-512 — VENCIDA sem que nenhuma rotina tenha rodado
// ===========================================================================

describe('CT-512 — a cobrança consta VENCIDA sem escrita alguma na linha física', () => {
  it(
    'a PRIMEIRA leitura já publica VENCIDA/30, o `xmin` não muda, e as colunas do legado não existem',
    async () => {
      const cenario = await cenarioDaPolitica(2, 1);

      // --- Passo 1: a cobrança vencida há 30 dias, posicionada pelo DADO -------------------------
      const cobranca = await lancar(cenario, { diasAteVencimento: -30, valorOriginal: 1000 });

      const xminInicial = await lerXmin(cenario.contexto, cobranca.codigo);

      // --- Passo 2: a PRIMEIRA leitura da visão --------------------------------------------------
      //
      // `criarCobranca` já leu a visão uma vez para devolver a linha publicada; esta é a leitura
      // independente, e as duas afirmam o mesmo. Nenhuma rotina correu entre a gravação e aqui — não
      // há rotina no produto, que é o que o sub-caso (b) afirma sobre o repositório inteiro.
      const primeira = await localizar(cenario.contexto, cobranca.codigo);

      expect(primeira?.status).toBe('VENCIDA');
      expect(primeira?.diasAtraso).toBe(30);
      // O valor que `criarCobranca` devolveu é o MESMO que a leitura independente devolve: a porta
      // não compôs o estado por conta própria antes de gravar.
      expect(cobranca.status).toBe('VENCIDA');
      expect(cobranca.diasAtraso).toBe(30);

      // --- Passo 3: o `xmin` não mudou ------------------------------------------------------------
      //
      // É o que separa *"a leitura devolveu VENCIDA"* de *"a leitura devolveu VENCIDA sem ter
      // escrito"*: uma implementação que movesse a coluna ao ler produziria uma versão nova da tupla,
      // e o `xmin` — o identificador da transação que a inseriu — mudaria.
      const xminDepoisDaLeitura = await lerXmin(cenario.contexto, cobranca.codigo);

      expect(xminDepoisDaLeitura).toBe(xminInicial);

      // --- Passo 4: as quatro colunas do legado NÃO EXISTEM ---------------------------------------
      //
      // A ausência é o mecanismo: sem coluna, a rotina noturna não tem onde escrever. Nomeadas por
      // extenso, e não por contagem, para que a reprovação diga QUAL delas voltou.
      const colunas = await lerColunasDaCobranca(cenario.contexto);

      // A âncora de não-vacuidade: o leitor achou a tabela. Sem ela, um `information_schema` que
      // devolvesse lista vazia satisfaria as quatro asserções seguintes por vacuidade.
      expect(colunas).toContain('codigo');
      expect(colunas).toContain('data_vencimento');
      for (const coluna of COLUNAS_DO_LEGADO) {
        expect(colunas, `coluna do legado ressuscitada: ${coluna}`).not.toContain(coluna);
      }

      // --- Passo 5: a SEGUNDA leitura, e o `xmin` de novo -----------------------------------------
      const segunda = await localizar(cenario.contexto, cobranca.codigo);

      expect(segunda?.status).toBe('VENCIDA');
      expect(await lerXmin(cenario.contexto, cobranca.codigo)).toBe(xminInicial);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-512 (b) — não há gatilho a rodar: nenhum timer no repositório e nenhuma fila de negócio',
    async () => {
      const raizTemporaria = await mkdtemp(join(tmpdir(), 'sysloc-gatilhos-'));

      try {
        // --- As duas listas reais, por igualdade --------------------------------------------------
        expect(await lerUnidades(DIRETORIO_DE_UNIDADES)).toEqual([...UNIDADES_DECLARADAS]);
        expect(await lerFilasDeclaradas(CAMINHO_DA_FILA)).toEqual([...FILAS_DECLARADAS]);

        // --- Controle: a cópia ÍNTEGRA passa limpa ------------------------------------------------
        //
        // Sem esta perna, um leitor quebrado — que reprovasse qualquer diretório — daria as duas
        // reprovações abaixo sem provar nada.
        const copiaIntegra = await copiarUnidades(raizTemporaria, []);

        expect(await lerUnidades(copiaIntegra)).toEqual([...UNIDADES_DECLARADAS]);

        // --- Falsificação 1: um `.timer` acrescentado ---------------------------------------------
        //
        // É a forma exata do defeito: a fatia que reintroduzisse a rotina noturna do legado
        // acrescentaria um agendamento aqui, e a ADR-0022 o recusa por escrito.
        const comTimer = await copiarUnidades(raizTemporaria, [TIMER_FALSIFICADO]);

        expect(await lerUnidades(comTimer)).not.toEqual([...UNIDADES_DECLARADAS]);
        // O esperado é ORDENADO porque o leitor ordena: comparar contra a concatenação crua faria a
        // asserção depender de o nome do timer cair depois dos dois `.service`, que é acidente.
        expect(await lerUnidades(comTimer)).toEqual(
          [...UNIDADES_DECLARADAS, TIMER_FALSIFICADO].sort(),
        );

        // --- Falsificação 2: uma fila de negócio acrescentada -------------------------------------
        const filaMutada = join(raizTemporaria, 'fila-mutada.ts');
        await writeFile(
          filaMutada,
          `${await readFile(CAMINHO_DA_FILA, 'utf8')}\nexport const FILA_DA_COBRANCA = 'cobranca';\n`,
          'utf8',
        );

        // Ordenado pela mesma razão do timer acima: o leitor ordena, e comparar contra a
        // concatenação crua faria a asserção depender da posição em que o nome novo cai.
        expect(await lerFilasDeclaradas(filaMutada)).toEqual(
          [...FILAS_DECLARADAS, 'cobranca'].sort(),
        );
      } finally {
        await rm(raizTemporaria, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-513 — a fronteira do vencimento é ESTRITA
// ===========================================================================

describe('CT-513 — vencer HOJE é A_VENCER; só ontem é VENCIDA', () => {
  it(
    'as três posições de fronteira, os valores de cada uma, e o fuso fixado no OBJETO',
    async () => {
      const cenario = await cenarioDaPolitica(2, 1);

      // --- Passo 1: as três cobranças, posicionadas pelo DADO ------------------------------------
      const ontem = await lancar(cenario, { diasAteVencimento: -1, valorOriginal: 1000 });
      const hoje = await lancar(cenario, { diasAteVencimento: 0, valorOriginal: 1000 });
      const amanha = await lancar(cenario, { diasAteVencimento: 1, valorOriginal: 1000 });

      // --- Passo 2: os três estados --------------------------------------------------------------
      expect([ontem.status, hoje.status, amanha.status]).toEqual([
        'VENCIDA',
        'A_VENCER',
        'A_VENCER',
      ]);
      expect([ontem.diasAtraso, hoje.diasAtraso, amanha.diasAtraso]).toEqual([1, 0, 0]);

      // --- Passo 3: os valores, por igualdade de cadeia `numeric` ---------------------------------
      //
      // A leitura crua da visão preserva a ESCALA: `'20.00'` e `'20.0'` são o mesmo número em
      // JavaScript, e só a cadeia distingue o `numeric(15,2)` de uma conversão que perdeu a escala
      // no caminho.
      expect(await lerDerivadaCrua(cenario.contexto, ontem.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: 1,
        valor_multa: '20.00',
        valor_juros: '0.33',
        valor_total: '1020.33',
      });
      for (const emDia of [hoje, amanha]) {
        expect(
          await lerDerivadaCrua(cenario.contexto, emDia.codigo),
          `cobrança em dia: ${emDia.codigo}`,
        ).toEqual({
          status: 'A_VENCER',
          dias_atraso: 0,
          valor_multa: '0.00',
          valor_juros: '0.00',
          valor_total: '1000.00',
        });
      }

      // --- Passo 3-B: as três datas viajam como CADEIA, e não como `Date` -------------------------
      //
      // É o item 5 do aceite técnico. A projeção sai por `to_char(…, 'YYYY-MM-DD')` justamente porque
      // o driver entregaria uma coluna `date` como objeto `Date` no fuso do processo, e reserializá-lo
      // desloca a data em um dia para metade dos fusos (§6.2). A competência é a asserção mais direta:
      // ela é comparada com a **constante literal** que o lançamento gravou, e um `Date` no lugar da
      // cadeia reprova aqui — não numa serialização silenciosa três camadas adiante.
      for (const cobranca of [ontem, hoje, amanha]) {
        expect(cobranca.competencia, cobranca.codigo).toBe(COMPETENCIA);
        expect(typeof cobranca.dataVencimento, cobranca.codigo).toBe('string');
        expect(cobranca.dataVencimento, cobranca.codigo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      // E a ordem das três é a das posições de fronteira: a comparação textual de datas ISO é
      // equivalente à cronológica, e ela afirma que o deslocamento relativo de fato as separou.
      expect(ontem.dataVencimento < hoje.dataVencimento).toBe(true);
      expect(hoje.dataVencimento < amanha.dataVencimento).toBe(true);

      // --- Passo 4: a data corrente é a MESMA sob dois fusos de sessão ----------------------------
      //
      // É o invariante nascido do D2 do tech alignment: sem `AT TIME ZONE 'America/Sao_Paulo'` fixado
      // na função, a virada do dia dependeria de com que fuso a conexão abriu, e a mesma cobrança
      // apareceria vencida para um cliente e em dia para outro. Kiritimati é UTC+14 — o fuso mais
      // adiantado do planeta, e portanto o que mais frequentemente já virou o dia.
      const [sobUtc, sobKiritimati] = [
        await lerDataCorrenteSobFuso(cenario.contexto, 'UTC'),
        await lerDataCorrenteSobFuso(cenario.contexto, 'Pacific/Kiritimati'),
      ];

      expect(sobUtc).toBe(sobKiritimati);
      // A âncora de não-vacuidade: o leitor devolveu uma data, e não duas cadeias vazias iguais.
      expect(sobUtc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-524 — empresa sem configuração apura mora ZERO, e a linha NÃO SOME
// ===========================================================================

describe('CT-524 — a ausência de política apura zero, e a cobrança continua na carteira', () => {
  it(
    'sem configuração a mora é zero e a linha consta; registrada a política, a mesma linha apura',
    async () => {
      const cenario = await cenarioSemPolitica();

      // --- Passo 1: não há política nenhuma para esta empresa ------------------------------------
      expect(await contarPoliticas(cenario.contexto)).toBe(0);

      const cobranca = await lancar(cenario, { diasAteVencimento: -60, valorOriginal: 1500 });

      // --- Passo 2: a linha CONSTA na carteira ---------------------------------------------------
      //
      // É o que distingue `LEFT JOIN` de `INNER JOIN`. Uma cobrança que sumisse da carteira por falta
      // de política é falha pior do que mora errada — e silenciosa, porque nada acusa a linha que não
      // veio.
      const carteira = await listar(cenario.contexto);

      expect(carteira.total).toBe(1);
      expect(carteira.cobrancas.map((linha) => linha.codigo)).toEqual([cobranca.codigo]);

      // --- Passo 3: o estado e o atraso são apurados normalmente ---------------------------------
      expect(cobranca.status).toBe('VENCIDA');
      expect(cobranca.diasAtraso).toBe(60);

      // --- Passo 4: a mora é zero, e o total é o valor original -----------------------------------
      expect(await lerDerivadaCrua(cenario.contexto, cobranca.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: 60,
        valor_multa: '0.00',
        valor_juros: '0.00',
        valor_total: '1500.00',
      });

      // --- Passo 5: CONTROLE POSITIVO — registrada a política, a MESMA linha apura ----------------
      //
      // Sem ele, o caso ficaria verde sobre uma visão que devolvesse zero sempre, e a metade que
      // importa — *a ausência apura zero, a presença apura* — não teria sido afirmada.
      await registrarPolitica(cenario.contexto, 2, 0);

      expect(await lerDerivadaCrua(cenario.contexto, cobranca.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: 60,
        valor_multa: '30.00',
        valor_juros: '0.00',
        valor_total: '1530.00',
      });
      // E a linha continua na carteira depois da política — o `LEFT JOIN` não trocou de lado.
      expect((await listar(cenario.contexto)).total).toBe(1);

      // --- Passo 6: os três filtros da carteira recortam pelo que a VISÃO publica -----------------
      //
      // O filtro por `status` é predicado SQL sobre a coluna DERIVADA — é exatamente essa
      // possibilidade que justifica a ADR-0023. Ele afirma que os três recortes se aplicam e se
      // compõem, sobre um cenário de UMA linha.
      //
      // ⚠️ Ele **não** prova que o par `AND pago_em IS NULL AND cancelado_em IS NULL` do recorte em
      // aberto não muda conjunto algum: aqui `PAGA` e `CANCELADA` devolvem zero por **ausência de
      // linha**, e uma asserção sobre estado que o cenário não pode produzir é vazia. Quem fecha a
      // implicação com dado é o **CT-524 (b)**, abaixo, em cenário próprio — as linhas liquidadas
      // que ele grava mudariam as contagens por contrato que o passo 7 afirma.
      expect((await listar(cenario.contexto, { status: 'VENCIDA' })).total).toBe(1);
      expect((await listar(cenario.contexto, { status: 'A_VENCER' })).total).toBe(0);
      expect((await listar(cenario.contexto, { status: 'PAGA' })).total).toBe(0);
      expect((await listar(cenario.contexto, { status: 'CANCELADA' })).total).toBe(0);
      expect((await listar(cenario.contexto, { natureza: 'ALUGUEL' })).total).toBe(1);
      expect((await listar(cenario.contexto, { natureza: 'AGUA' })).total).toBe(0);
      // E os filtros se COMPÕEM: o recorte que casa nos dois eixos traz a linha, e trocar um só deles
      // já a exclui — é o que separa "os filtros são aplicados" de "algum filtro é aplicado".
      expect(
        (await listar(cenario.contexto, { status: 'VENCIDA', natureza: 'ALUGUEL' })).cobrancas.map(
          (linha) => linha.codigo,
        ),
      ).toEqual([cobranca.codigo]);
      expect(
        (await listar(cenario.contexto, { status: 'VENCIDA', natureza: 'ENERGIA' })).total,
      ).toBe(0);

      // --- Passo 7: o contrato e o locatário chegam pela JUNÇÃO, e não de coluna gravada ----------
      //
      // `locatario_id` **não existe** em `negocio.cobranca` — a incoerência que a dupla ponta do
      // legado admite é estruturalmente impossível aqui. Os dois vêm da junção da visão com o
      // contrato, e cada um com a classe de chave que a ADR-0017 lhe dá: código para o contrato, que
      // tem série declarada; UUID para o locatário, que não tem.
      expect(cobranca.contratoCodigo).toMatch(/^CTR-\d{4}-\d{5}$/);
      expect(cobranca.locatarioId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(
        (await listar(cenario.contexto, { contratoCodigo: cobranca.contratoCodigo })).total,
      ).toBe(1);
      expect((await listar(cenario.contexto, { contratoCodigo: CONTRATO_INEXISTENTE })).total).toBe(
        0,
      );
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-524 (b) — a precedência classifica o desfecho, e o recorte em aberto traz só a linha aberta',
    async () => {
      // ---------------------------------------------------------------------------------------
      // Por que este caso existe, e por que ele não cabia no anterior
      // ---------------------------------------------------------------------------------------
      //
      // `predicadoDaCarteira` acrescenta `AND pago_em IS NULL AND cancelado_em IS NULL` ao recorte
      // em aberto para alcançar o índice parcial `cobranca_aberta_idx`, e a correção disso repousa
      // inteiramente numa implicação: *estado em aberto ⇒ os dois carimbos são nulos*. Ela vale pela
      // precedência do `CASE` da visão, que põe `CANCELADA` e `PAGA` **antes** de `VENCIDA`.
      //
      // O passo 6 do caso anterior não a prova: o cenário de lá tem UMA linha, com os dois carimbos
      // nulos, de modo que `PAGA → 0` e `CANCELADA → 0` são satisfeitos por **vacuidade**. Nenhuma
      // suíte deste repositório gravava `pago_em` ou `cancelado_em` — a precedência nunca havia sido
      // exercitada. O dia em que ela deixar de valer (um estado novo em aberto, ou um pagamento em
      // atraso que siga publicando `VENCIDA`), `listarCobrancas` passa a **descartar linhas da
      // carteira em silêncio**, e a suíte seguiria verde.
      //
      // O cenário é PRÓPRIO, e não o do caso anterior: as linhas liquidadas mudariam as contagens
      // por contrato que o passo 7 de lá afirma. Empresa nova, contrato novo, carteira só deste
      // caso.
      const cenario = await semearContrato(
        await admitirEmpresaNova('Precedência'),
        'precedencia-do-desfecho',
      );

      // --- Passo 1: TRÊS cobranças com o MESMO vencimento, todas vencidas há 60 dias -------------
      //
      // O vencimento idêntico é o que torna o caso discriminante: sem desfecho, as três seriam
      // publicadas `VENCIDA`, e a única razão de duas delas não serem é o carimbo gravado. Um
      // cenário em que as liquidadas vencessem no futuro provaria a data, não a precedência.
      const aberta = await lancar(cenario, { diasAteVencimento: -60, valorOriginal: 1500 });
      const paga = await lancar(cenario, { diasAteVencimento: -60, valorOriginal: 1500 });
      const cancelada = await lancar(cenario, { diasAteVencimento: -60, valorOriginal: 1500 });

      // A âncora de não-vacuidade: antes do carimbo, as três são VENCIDA. É o controle que separa
      // *"a precedência classificou"* de *"a linha nunca esteve vencida"*.
      expect([aberta.status, paga.status, cancelada.status]).toEqual([
        'VENCIDA',
        'VENCIDA',
        'VENCIDA',
      ]);

      // --- Passo 2: o desfecho, PELAS PORTAS DE PRODUÇÃO ---------------------------------------
      //
      // Elas nasceram na **T7**, junto das rotas que as publicam, e substituíram os dois acessórios
      // que carimbavam por `UPDATE` cru — a razão da troca está no cabeçalho deste arquivo. O que
      // este caso afirma não mudou: a política 2%/0% sobre `1500.00` aos 60 dias apura exatamente os
      // `30.00`/`0.00` que o acessório antigo escrevia à mão, e agora eles vêm da visão, no mesmo ato
      // que grava o pagamento.
      await pagar(cenario.contexto, paga.codigo, {
        pagoEm: await dataDeslocada(cenario.contexto, -1),
        valorPago: 1530,
      });
      await cancelar(cenario.contexto, cancelada.codigo);

      // --- Passo 3: a PRECEDÊNCIA, sobre linhas que ela pode classificar errado ------------------
      //
      // É esta asserção que reprova se a implicação deixar de valer — e é a que faltava.
      expect((await lerDerivadaCrua(cenario.contexto, aberta.codigo)).status).toBe('VENCIDA');
      expect((await lerDerivadaCrua(cenario.contexto, paga.codigo)).status).toBe('PAGA');
      expect((await lerDerivadaCrua(cenario.contexto, cancelada.codigo)).status).toBe('CANCELADA');

      // --- Passo 4: e o recorte em aberto traz EXATAMENTE a linha aberta -------------------------
      //
      // Os dois recortes que o caso anterior encontrou vazios agora acham cada um a sua: as mesmas
      // contagens deixaram de poder passar por ausência de linha. E o recorte `VENCIDA` — o único
      // que carrega o par redundante — não perdeu nem ganhou ninguém.
      expect(
        (await listar(cenario.contexto, { status: 'VENCIDA' })).cobrancas.map(
          (linha) => linha.codigo,
        ),
      ).toEqual([aberta.codigo]);
      expect(
        (await listar(cenario.contexto, { status: 'PAGA' })).cobrancas.map((linha) => linha.codigo),
      ).toEqual([paga.codigo]);
      expect(
        (await listar(cenario.contexto, { status: 'CANCELADA' })).cobrancas.map(
          (linha) => linha.codigo,
        ),
      ).toEqual([cancelada.codigo]);
      // A âncora do próprio passo: os três recortes PARTICIONAM a carteira — não há quarta linha
      // fora deles, e nenhuma das três ficou fora da carteira sem recorte algum.
      expect((await listar(cenario.contexto)).total).toBe(3);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-525 — a visão reproduz o golden, centavo a centavo
// ===========================================================================

describe('CT-525 — a mora reproduz as 10 invocações de `calcular-mora.json` por igualdade exata', () => {
  it(
    'os 6 casos e as 10 invocações do oráculo, com `diasAtraso` publicado e os juros fora da multa',
    async () => {
      const golden = await lerGolden();

      // --- Passo 1: as ÂNCORAS do oráculo, antes de qualquer asserção sobre valores --------------
      //
      // Sem elas, um golden truncado deixaria o caso verde tendo provado meia dúzia de cenários.
      expect(golden.casos).toHaveLength(CASOS_DO_GOLDEN);
      expect(golden.casos.reduce((soma, caso) => soma + caso.invocacoes.length, 0)).toBe(
        INVOCACOES_DO_GOLDEN,
      );

      let comparadas = 0;
      /** Os valores publicados de cada caso, na ordem das invocações dele. */
      const publicadoPorCaso = new Map<string, { juros: number[]; multas: number[] }>();

      for (const caso of golden.casos) {
        for (const [posicao, invocacao] of caso.invocacoes.entries()) {
          const rotulo = `${caso.id}[${String(posicao)}]`;
          const { entrada, saida } = invocacao;

          // Empresas DISTINTAS quando a política diverge: `configuracao_de_mora` é
          // `unique(empresa_id)`, de modo que a mesma empresa não pode carregar 2% e 50% ao mesmo
          // tempo. O cenário é criado sob demanda e reusado entre invocações de mesma política.
          const cenario = await cenarioDaPolitica(
            entrada.multa_percentual,
            entrada.juros_percentual,
          );

          const cobranca = await lancar(cenario, {
            diasAteVencimento: -entrada.dias_atraso,
            valorOriginal: entrada.valor_original,
          });

          // --- Passo 2: o atraso publicado é o da entrada ---------------------------------------
          expect(cobranca.diasAtraso, rotulo).toBe(entrada.dias_atraso);
          expect(cobranca.status, rotulo).toBe('VENCIDA');

          // --- Passo 3: os TRÊS valores, por igualdade EXATA contra o oráculo -------------------
          //
          // `toBe`, e nunca `toBeCloseTo`: tolerância deixaria passar exatamente o resíduo que o
          // `numeric` existe para eliminar, e é ele que viajaria no JSON como `valorTotal`.
          expect(cobranca.valorMulta, rotulo).toBe(saida.valor_multa);
          expect(cobranca.valorJuros, rotulo).toBe(saida.valor_juros);
          expect(cobranca.valorTotal, rotulo).toBe(saida.valor_total);

          const doCaso = publicadoPorCaso.get(caso.id) ?? { juros: [], multas: [] };
          doCaso.juros.push(cobranca.valorJuros);
          doCaso.multas.push(cobranca.valorMulta);
          publicadoPorCaso.set(caso.id, doCaso);

          comparadas += 1;
        }
      }

      // --- Passo 4: a contagem do que foi EFETIVAMENTE comparado ---------------------------------
      //
      // A segunda metade da âncora: o laço percorreu as dez, e não saiu na primeira volta.
      expect(comparadas).toBe(INVOCACOES_DO_GOLDEN);

      // --- Passo 5: os juros NÃO incidem sobre a multa -------------------------------------------
      //
      // As duas invocações de `juros_nao_incidem_sobre_a_multa` têm o mesmo valor, o mesmo atraso e
      // multas de 2% e 50%. Se a base dos juros fosse `valor_original + multa`, os dois divergiriam.
      // A comparação é sobre **aquele caso**, e não sobre a última invocação de cada percentual: um
      // acumulador por percentual guardaria o valor de outro caso do golden e a asserção mediria
      // outra coisa.
      const semIncidencia = publicadoPorCaso.get(CASO_SEM_INCIDENCIA_DA_MULTA);

      expect(semIncidencia?.juros).toEqual([JUROS_DE_52_DIAS, JUROS_DE_52_DIAS]);
      // E as multas DIVERGEM — é o que torna a igualdade acima discriminante em vez de trivial: as
      // duas invocações diferem exatamente no percentual da multa.
      expect(semIncidencia?.multas).toEqual([MULTA_DOS_JUROS, MULTA_DE_CINQUENTA_PORCENTO]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-526 — o arredondamento, e a ausência de ponto flutuante
// ===========================================================================

describe('CT-526 — `1234.56` a 17 e a 5 dias, e a aritmética sem ponto flutuante', () => {
  it(
    'os dois atrasos publicam os centavos do oráculo, e a multa é idêntica nos dois',
    async () => {
      const cenario = await cenarioDaPolitica(2, 1);

      const deDezessete = await lancar(cenario, {
        diasAteVencimento: -17,
        valorOriginal: VALOR_DO_ARREDONDAMENTO,
      });
      const deCinco = await lancar(cenario, {
        diasAteVencimento: -5,
        valorOriginal: VALOR_DO_ARREDONDAMENTO,
      });

      // --- Passo 1: os 17 dias — os três valores do golden ---------------------------------------
      expect(await lerDerivadaCrua(cenario.contexto, deDezessete.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: 17,
        valor_multa: '24.69',
        valor_juros: '7.00',
        valor_total: '1266.25',
      });

      // --- Passo 2: os 5 dias — DERIVADOS da mesma fórmula declarada no golden --------------------
      //
      // `2.06` não é escolhido pelo caso: é `arredondar(1234.56 × (1/100) ÷ 30 × 5)` pela fórmula que
      // o bloco `formula` do próprio oráculo declara, com `ROUND_HALF_UP` a duas casas.
      expect(await lerDerivadaCrua(cenario.contexto, deCinco.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: 5,
        valor_multa: '24.69',
        valor_juros: '2.06',
        valor_total: '1261.31',
      });

      // --- Passo 3: a multa é a MESMA nos dois — ela não depende dos dias ------------------------
      expect(deDezessete.valorMulta).toBe(deCinco.valorMulta);
      expect(deDezessete.valorMulta).toBe(MULTA_DO_ARREDONDAMENTO);
      // E os juros DIFEREM: é o companheiro que impede a linha acima de passar sobre uma visão que
      // devolvesse o mesmo par para qualquer atraso.
      expect(deDezessete.valorJuros).not.toBe(deCinco.valorJuros);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-526 (falsificação estática) — a `0010` não tem ponto flutuante, e a asserção reprova quem o tem',
    async () => {
      const raizTemporaria = await mkdtemp(join(tmpdir(), 'sysloc-migracao-mutada-'));

      try {
        const integro = await readFile(CAMINHO_DA_MIGRACAO, 'utf8');

        // --- A asserção commitada, sobre o artefato REAL -------------------------------------------
        expect(marcasDePontoFlutuante(integro)).toEqual([]);
        // A âncora de não-vacuidade: o leitor de fato leu a expressão da mora, e não um arquivo
        // vazio cujo resultado seria `[]` por construção.
        expect(semComentarios(integro)).toContain('round(');

        // --- Controle: a CÓPIA íntegra passa limpa ------------------------------------------------
        const copiaIntegra = join(raizTemporaria, 'integra.sql');
        await copyFile(CAMINHO_DA_MIGRACAO, copiaIntegra);

        expect(marcasDePontoFlutuante(await readFile(copiaIntegra, 'utf8'))).toEqual([]);

        // --- Falsificação: a expressão de juros passando por `double precision` -------------------
        const mutada = join(raizTemporaria, 'mutada.sql');
        await writeFile(mutada, comJurosEmPontoFlutuante(integro), 'utf8');

        // A MESMA asserção, aplicada à cópia com o defeito reintroduzido, NOMEIA o cast.
        expect(marcasDePontoFlutuante(await readFile(mutada, 'utf8'))).toEqual([
          'double precision',
        ]);

        // --- E o comentário não confunde o leitor -------------------------------------------------
        //
        // A `0010` cita `round(double precision)` em PROSA, para dizer que o modo de arredondamento
        // dele é outro. Um leitor que não removesse comentário acusaria o arquivo íntegro — e o
        // primeiro `expect` deste caso é justamente quem o pega.
        expect(integro).toContain('round(double precision)');
      } finally {
        await rm(raizTemporaria, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-528 — juros SIMPLES: 60 dias valem o dobro de 30
// ===========================================================================

describe('CT-528 — os juros são lineares e a multa é aplicada uma vez só', () => {
  it(
    'o valor de 60 dias é exatamente o dobro do de 30, com a mesma multa; e o par 5/500 repete',
    async () => {
      const cenario = await cenarioDaPolitica(2, 1);

      const [cinco, trinta, sessenta, quinhentos] = await Promise.all(
        [5, 30, 60, 500].map(
          async (dias) =>
            await lancar(cenario, { diasAteVencimento: -dias, valorOriginal: VALOR_DOS_JUROS }),
        ),
      );

      // --- Passo 1: as âncoras de valor, contra os casos do golden -------------------------------
      expect(trinta?.valorJuros).toBe(20);
      expect(sessenta?.valorJuros).toBe(40);
      expect(cinco?.valorJuros).toBe(3.33);
      expect(quinhentos?.valorJuros).toBe(333.33);

      // --- Passo 2: a RELAÇÃO, afirmada como relação ---------------------------------------------
      //
      // É o que o CA-13 enuncia, e é mais forte que os dois valores: uma tabela de juros compostos
      // que por acaso acertasse `20.00` e `40.00` seria pega por qualquer outro par, mas a relação é
      // o que se quer provar. `× 2` sobre `20` é exato em ponto flutuante binário.
      expect(sessenta?.valorJuros).toBe((trinta?.valorJuros ?? 0) * 2);

      // E o par distante NÃO admite a mesma relação, o que é conteúdo e não ressalva: cada parcela é
      // arredondada **uma vez, no fim**, de modo que `3.33 × 100` vale `333.00` enquanto quinhentos
      // dias valem `333.33`. Escalar um valor já arredondado é justamente a posição de `round` que o
      // CT-526 falsifica; afirmar a desigualdade aqui é o que impede alguém de "corrigir" a
      // linearidade multiplicando o resultado curto.
      expect(quinhentos?.valorJuros).not.toBe((cinco?.valorJuros ?? 0) * 100);

      // --- Passo 3: a multa é IDÊNTICA nas quatro — aplicada uma vez ------------------------------
      expect([
        cinco?.valorMulta,
        trinta?.valorMulta,
        sessenta?.valorMulta,
        quinhentos?.valorMulta,
      ]).toEqual([MULTA_DOS_JUROS, MULTA_DOS_JUROS, MULTA_DOS_JUROS, MULTA_DOS_JUROS]);

      // --- Passo 4: 30 dias valem exatamente 1% do valor original --------------------------------
      //
      // A base é o mês comercial de 30 dias, e é isso que faz um mês inteiro de atraso valer a taxa
      // mensal cheia — nem mais, por causa dos 31 dias de janeiro, nem menos.
      expect(trinta?.valorJuros).toBe((VALOR_DOS_JUROS * 1) / 100);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-536 — a série `COB-{ano}-{7 dígitos}`, por empresa e ano, com furo
// ===========================================================================

describe('CT-536 — o código é por `(empresa, ano)`, admite furo e nunca reusa número', () => {
  it(
    'a primeira é `0000001`, a abortada QUEIMA o número, a seguinte é `0000003`, e B tem a sua',
    async () => {
      const ano = ANO_DEDICADO_AO_CT536;
      const cenarioDeA = await semearContrato(CONTEXTO_DE_A, 'ct536a');
      const cenarioDeB = await semearContrato(CONTEXTO_DE_B, 'ct536b');

      await emUnidade(CONTEXTO_DE_A, async (tx) => {
        await garantirContadorDeCobranca(tx, ano);
      });
      await emUnidade(CONTEXTO_DE_B, async (tx) => {
        await garantirContadorDeCobranca(tx, ano);
      });

      // --- Passo 1: a primeira cobrança de A ------------------------------------------------------
      //
      // A largura 7 é afirmada pelo VALOR LITERAL, e não só pela expressão regular: `COB-2027-00001`
      // casaria um `\d+`, e é justamente a harmonização com a largura 5 do contrato que o marcador
      // `DECISÃO FECHADA` de `packages/contracts/src/cobranca.ts` existe para impedir.
      const primeiraDeA = await lancarComAno(cenarioDeA, ano, -1);

      expect(primeiraDeA.codigo).toBe('COB-2027-0000001');

      const codigosAntes = await lerCodigosCrus(CONTEXTO_DE_A);

      // --- Passo 2: a unidade que ABORTA depois de emitir o número --------------------------------
      //
      // O aborto é produzido pelo mecanismo que a produção já usa: uma exceção levantada dentro da
      // transação, de modo que o desfazimento normal ocorra. Nenhuma rota, flag ou símbolo de teste
      // participa (Iron Law #6).
      const abortada = await tentar(
        async () =>
          await emUnidade(CONTEXTO_DE_A, async (tx) => {
            const queimado = await emitirNumeroDeCobranca(tx, ano);
            expect(queimado).toBe(2);
            throw new Error('aborto deliberado do CT-536, depois de o contador ter avançado');
          }),
      );

      expect(abortada.ok).toBe(false);

      // Nada foi gravado: a contagem crua é o que separa *"levantou"* de *"levantou e não deixou
      // linha para trás"*.
      expect(await lerCodigosCrus(CONTEXTO_DE_A)).toEqual(codigosAntes);

      // --- Passo 3: a seguinte recebe `0000003` — o `0000002` foi QUEIMADO ------------------------
      //
      // O furo é a decisão da ADR-0015, e não defeito: é o preço de duas criações concorrentes não
      // esperarem uma pela outra. Um contador em linha de tabela — o mecanismo que a ADR-0020 rejeita
      // — teria devolvido `0000002` aqui.
      const terceiraDeA = await lancarComAno(cenarioDeA, ano, -2);

      expect(terceiraDeA.codigo).toBe('COB-2027-0000003');
      // E o furo é PERMANENTE: nenhuma linha da empresa usa o número queimado.
      expect(await lerCodigosCrus(CONTEXTO_DE_A)).not.toContain('COB-2027-0000002');

      // --- Passo 4: a empresa B emite `0000001` no MESMO ano --------------------------------------
      //
      // A igualdade com o código de A é o caso: a unicidade é `(empresa_id, codigo)`, e cada empresa
      // tem contador próprio. Uma restrição global sobre `codigo` recusaria esta gravação.
      const primeiraDeB = await lancarComAno(cenarioDeB, ano, -1);

      expect(primeiraDeB.codigo).toBe('COB-2027-0000001');
      expect(primeiraDeB.codigo).toBe(primeiraDeA.codigo);

      // --- Passo 5: o código duplicado na MESMA empresa é recusado pelo BANCO ---------------------
      //
      // A escrita crua exibe quem recusou: é a restrição, e não uma conferência de aplicação. Sem
      // esta perna, *"a porta levanta a classe certa"* seria compatível com um `if` que lesse antes
      // de gravar — e leitura-antes-de-gravar é corrida disfarçada.
      const cru = await tentar(
        async () =>
          await emUnidade(CONTEXTO_DE_A, async (tx) => {
            await tx`
              INSERT INTO negocio.cobranca (
                empresa_id, codigo, contrato_id, natureza, referencia,
                competencia, data_vencimento, valor_original
              )
              VALUES (
                nullif(current_setting('app.empresa_id', true), '')::uuid,
                ${primeiraDeA.codigo}, ${cenarioDeA.contratoId}, 'ALUGUEL', 'duplicata',
                ${COMPETENCIA}, ${COMPETENCIA}, 1000
              )
            `;
          }),
      );

      expect(cru.ok).toBe(false);
      expect(sqlstate(erroDe(cru))).toBe('23505');
      expect(nomeDaRestricao(erroDe(cru))).toBe('cobranca_empresa_codigo_key');

      // --- Passo 6: e a PORTA traduz a mesma recusa numa classe nomeada ---------------------------
      //
      // Reapresentar à porta um número já consumido é a forma direta do cenário que a semeadura da
      // virada (F7) produz. Sem a tradução, a recusa chegaria ao cliente como erro de driver em
      // `500`.
      const traduzida = await tentar(
        async () =>
          await emUnidade(
            CONTEXTO_DE_A,
            async (tx) =>
              await criarCobranca(tx, dadosDaCobranca(cenarioDeA, COMPETENCIA, 1000), {
                ano,
                numero: 1,
              }),
          ),
      );

      expect(traduzida.ok).toBe(false);
      expect(erroDe(traduzida)).toBeInstanceOf(ErroDeCodigoDeCobrancaEmUso);
      // A mensagem não carrega o código recusado — o dado em disputa não entra em texto que chega ao
      // registro estruturado.
      expect(mensagemDe(traduzida)).not.toContain(primeiraDeA.codigo);
      // E o `SQLSTATE` não atravessa: o que sobe é a classe de domínio, não o erro do driver.
      expect(sqlstate(erroDe(traduzida))).toBeUndefined();

      // --- Passo 7: os quatro códigos casam a forma, e nenhum tem 5 ou 6 dígitos -----------------
      const emitidos = [
        primeiraDeA.codigo,
        terceiraDeA.codigo,
        primeiraDeB.codigo,
        formatarCodigoDeCobranca(ano, 1),
      ];

      for (const codigo of emitidos) {
        expect(codigo, codigo).toMatch(FORMA_DO_CODIGO);
        expect(codigo, codigo).not.toMatch(/^COB-\d{4}-\d{5}$/);
        expect(codigo, codigo).not.toMatch(/^COB-\d{4}-\d{6}$/);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-517 — o BANCO impede estado impossível (parte de banco; a de rota vive no e2e)
// ===========================================================================

describe('CT-517 — os dois `CHECK` recusam desfecho duplo e carimbo sem pagamento', () => {
  it(
    'as três escritas ilegítimas levantam 23514 nomeando a restrição, e a legítima é aceita',
    async () => {
      const cenario = await semearContrato(
        await admitirEmpresaNova('Estado Impossível'),
        'estado-impossivel',
      );
      await registrarPolitica(cenario.contexto, 2, 1);

      const aberta = await lancar(cenario, { diasAteVencimento: -30, valorOriginal: 1000 });
      const legitima = await lancar(cenario, { diasAteVencimento: -30, valorOriginal: 1000 });
      const pagoEm = await dataDeslocada(cenario.contexto, 0);

      // --- Passo 1-a: pago E cancelado ao mesmo tempo -------------------------------------------
      //
      // A linha vai com o carimbo COMPLETO de propósito: assim `cobranca_carimbo_coerente_chk` está
      // satisfeito, e a única restrição que pode recusar é a do desfecho único. Sem isso, as duas
      // poderiam falar, e o servidor reporta **uma** — a asserção sobre o nome viraria loteria.
      const desfechoDuplo = await tentar(
        async () =>
          await emUnidade(cenario.contexto, async (tx) => {
            await tx`
              INSERT INTO negocio.cobranca (
                empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                data_vencimento, valor_original, pago_em, valor_pago, multa_aplicada,
                juros_aplicados, multa_percentual_aplicado, juros_percentual_aplicado, cancelado_em
              )
              VALUES (
                nullif(current_setting('app.empresa_id', true), '')::uuid,
                ${CODIGO_DO_DESFECHO_DUPLO}, ${cenario.contratoId}, 'ALUGUEL', 'desfecho duplo',
                ${COMPETENCIA}, ${COMPETENCIA}, 1000, ${pagoEm}, 1000, 0, 0, 0, 0, now()
              )
            `;
          }),
      );

      expect(desfechoDuplo.ok).toBe(false);
      expect(sqlstate(erroDe(desfechoDuplo))).toBe('23514');
      expect(nomeDaRestricao(erroDe(desfechoDuplo))).toBe(RESTRICAO_DO_DESFECHO_UNICO);

      // --- Passo 1-b: um VALOR de carimbo sem pagamento -----------------------------------------
      const valorSemPagamento = await tentar(
        async () =>
          await emUnidade(cenario.contexto, async (tx) => {
            await tx`
              UPDATE negocio.cobranca
                 SET multa_aplicada = ${'10.00'}
               WHERE codigo = ${aberta.codigo}
            `;
          }),
      );

      expect(valorSemPagamento.ok).toBe(false);
      expect(sqlstate(erroDe(valorSemPagamento))).toBe('23514');
      expect(nomeDaRestricao(erroDe(valorSemPagamento))).toBe(RESTRICAO_DO_CARIMBO_COERENTE);

      // --- Passo 1-c: um PERCENTUAL de carimbo sem pagamento ------------------------------------
      //
      // A segunda metade da restrição, e não uma repetição: ela pareia `pago_em` com **cada um** dos
      // quatro carimbos, e uma redação que cobrisse só os dois valores deixaria a configuração
      // vigente escapar — que é justamente o que a ADR-0022 manda gravar junto.
      const percentualSemPagamento = await tentar(
        async () =>
          await emUnidade(cenario.contexto, async (tx) => {
            await tx`
              UPDATE negocio.cobranca
                 SET juros_percentual_aplicado = ${'1.00'}
               WHERE codigo = ${aberta.codigo}
            `;
          }),
      );

      expect(percentualSemPagamento.ok).toBe(false);
      expect(sqlstate(erroDe(percentualSemPagamento))).toBe('23514');
      expect(nomeDaRestricao(erroDe(percentualSemPagamento))).toBe(RESTRICAO_DO_CARIMBO_COERENTE);

      // --- Passo 2: CONTROLE POSITIVO — os cinco campos juntos são ACEITOS ----------------------
      //
      // Sem ele o caso ficaria verde sobre um `CHECK` escrito ao contrário, que recusasse toda
      // escrita: as três asserções negativas acima passariam do mesmo jeito. A escrita corre pelo
      // mesmo papel da aplicação e sob a mesma política das ilegítimas — o que muda é só a coerência
      // do conjunto de campos.
      const legitimaAceita = await tentar(
        async () =>
          await emUnidade(cenario.contexto, async (tx) => {
            await tx`
              UPDATE negocio.cobranca
                 SET pago_em = ${pagoEm},
                     valor_pago = ${1020},
                     multa_aplicada = ${'20.00'},
                     juros_aplicados = ${'10.00'},
                     multa_percentual_aplicado = ${'2.00'},
                     juros_percentual_aplicado = ${'1.00'}
               WHERE codigo = ${legitima.codigo}
            `;
          }),
      );

      expect(legitimaAceita.ok).toBe(true);
      // E o efeito é observável: a linha aceita passa a publicar o desfecho, e a aberta continua
      // aberta. É o que separa *"a instrução não levantou"* de *"a instrução gravou"*.
      expect((await lerDerivadaCrua(cenario.contexto, legitima.codigo)).status).toBe('PAGA');
      expect((await lerDerivadaCrua(cenario.contexto, aberta.codigo)).status).toBe('VENCIDA');
      // E a cobrança do desfecho duplo **não existe**: a recusa não deixou linha para trás.
      expect(await lerCodigosCrus(cenario.contexto)).not.toContain(CODIGO_DO_DESFECHO_DUPLO);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-527 — a mora só é APURADA quando VENCIDA, e a PAGA publica o carimbo
// ===========================================================================

describe('CT-527 — A_VENCER e CANCELADA publicam zero; PAGA publica os carimbos gravados', () => {
  it(
    'os quatro estados, com a cancelada vencida há 60 dias e a paga sem reapuração',
    async () => {
      const cenario = await semearContrato(
        await admitirEmpresaNova('Precedência da Mora'),
        'precedencia-da-mora',
      );
      await registrarPolitica(cenario.contexto, 2, 1);

      // --- Passo 1: as quatro cobranças, posicionadas pelo DADO --------------------------------
      //
      // A cancelada vence **no passado** de propósito: é o caso que uma implementação ingênua
      // trataria como vencida, e é a divergência que o `CT-503` capturou do legado — lá, a cobrança
      // cancelada e vencida continuava sendo cobrada.
      const aVencer = await lancar(cenario, {
        diasAteVencimento: 10,
        valorOriginal: VALOR_APURADO,
      });
      const vencida = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_VENCIDA,
        valorOriginal: VALOR_APURADO,
      });
      const paga = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_PAGA,
        valorOriginal: VALOR_APURADO,
      });
      const cancelada = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_VENCIDA,
        valorOriginal: VALOR_APURADO,
      });

      // A âncora de não-vacuidade: antes do desfecho, a paga e a cancelada são VENCIDA. É o controle
      // que separa *"a precedência classificou"* de *"a linha nunca esteve vencida"*.
      expect([paga.status, cancelada.status]).toEqual(['VENCIDA', 'VENCIDA']);

      await pagar(cenario.contexto, paga.codigo, {
        pagoEm: await dataDeslocada(cenario.contexto, 0),
        valorPago: VALOR_PAGO_DA_CANONICA,
      });
      await cancelar(cenario.contexto, cancelada.codigo);

      // --- Passo 2: A_VENCER apura zero -------------------------------------------------------
      expect(await lerDerivadaCrua(cenario.contexto, aVencer.codigo)).toEqual({
        status: 'A_VENCER',
        dias_atraso: 0,
        valor_multa: '0.00',
        valor_juros: '0.00',
        valor_total: '2000.00',
      });

      // --- Passo 3: CANCELADA vencida há 60 dias apura zero, e NÃO publica VENCIDA -------------
      expect(await lerDerivadaCrua(cenario.contexto, cancelada.codigo)).toEqual({
        status: 'CANCELADA',
        dias_atraso: 0,
        valor_multa: '0.00',
        valor_juros: '0.00',
        valor_total: '2000.00',
      });

      // --- Passo 4: CONTROLE POSITIVO — a VENCIDA apura -----------------------------------------
      //
      // Sem ele o caso ficaria verde sobre uma visão que zerasse tudo, e a metade que importa — *a
      // mora só é apurada quando vencida, E é apurada quando vencida* — não teria sido afirmada.
      expect(await lerDerivadaCrua(cenario.contexto, vencida.codigo)).toEqual({
        status: 'VENCIDA',
        dias_atraso: DIAS_DA_VENCIDA,
        valor_multa: MULTA_DE_DOIS_POR_CENTO,
        valor_juros: JUROS_DE_60_DIAS,
        valor_total: '2080.00',
      });

      // --- Passo 5: a PAGA publica os CARIMBOS, e não uma reapuração ---------------------------
      //
      // Os três valores são os do `CT-516`, e o `dias_atraso` publicado é `0` — e não os 52 do
      // vencimento, que continuariam crescendo a cada dia. Uma visão que reapurasse pela política
      // vigente devolveria zero nos dois primeiros (a precedência põe `PAGA` antes de `VENCIDA`), e o
      // total voltaria ao valor original: o que foi cobrado da cobrança liquidada deixaria de ser
      // legível.
      expect(await lerDerivadaCrua(cenario.contexto, paga.codigo)).toEqual({
        status: 'PAGA',
        dias_atraso: 0,
        valor_multa: MULTA_DE_DOIS_POR_CENTO,
        valor_juros: JUROS_DE_52_DIAS_EM_TEXTO,
        valor_total: '2074.67',
      });

      // --- Passo 6: a ORDEM DE PRECEDÊNCIA, afirmada diretamente ------------------------------
      //
      // A paga venceu há 52 dias: ela satisfaz o predicado de `VENCIDA` **e** o de `PAGA`, e é a
      // ordem do `CASE` que decide. Trocar as duas linhas da visão faz esta asserção reprovar.
      const pagaCrua = await lerCarimbosCrus(cenario.contexto, paga.codigo);

      // O vencimento está no passado do pagamento, e a comparação textual de datas ISO é equivalente
      // à cronológica: a linha satisfaz o predicado de vencida **e** o de paga ao mesmo tempo.
      expect(pagaCrua.data_vencimento < (pagaCrua.pago_em ?? '')).toBe(true);
      expect((await lerDerivadaCrua(cenario.contexto, paga.codigo)).status).toBe('PAGA');
      // E os quatro carimbos estão na TABELA, um a um: é o que separa *"a visão publica 40.00"* de
      // *"a visão publica o que foi gravado"*.
      expect(pagaCrua.multa_aplicada).toBe(MULTA_DE_DOIS_POR_CENTO);
      expect(pagaCrua.juros_aplicados).toBe(JUROS_DE_52_DIAS_EM_TEXTO);
      expect(pagaCrua.multa_percentual_aplicado).toBe(MULTA_PERCENTUAL_CARIMBADO);
      expect(pagaCrua.juros_percentual_aplicado).toBe(JUROS_PERCENTUAL_CARIMBADO);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-532 — o pagamento NÃO apaga a conciliação bancária
// ===========================================================================

describe('CT-532 — acusar pagamento preserva os seis campos de conciliação bancária', () => {
  it(
    'os seis idênticos um a um antes e depois, os quatro carimbos gravados, e sem `pagamento_confirmado`',
    async () => {
      const cenario = await semearContrato(
        await admitirEmpresaNova('Conciliação'),
        'conciliacao-intocada',
      );
      await registrarPolitica(cenario.contexto, 2, 1);

      const cobranca = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_PAGA,
        valorOriginal: VALOR_APURADO,
      });

      // --- Passo 1: os seis campos preenchidos, e a leitura que prova que a escrita valeu -------
      //
      // Eles nascem nulos e **não têm rota nesta fatia** — a emissão de boleto é da F4 —, de modo que
      // preenchê-los exige escrita direta. Ela corre pelo papel da APLICAÇÃO, sob o contexto de
      // empresa, e não compara `empresa_id` com coisa alguma: o `USING` é quem alcança a linha.
      // Publicar rota de conciliação aqui só para montar o cenário faria a âncora de 82 rotas
      // reprovar — que é o efeito desejado.
      const dataDeCredito = await dataDeslocada(cenario.contexto, -2);
      await escreverConciliacao(cenario.contexto, cobranca.codigo, dataDeCredito);

      expect(await lerConciliacaoCrua(cenario.contexto, cobranca.codigo)).toEqual(
        conciliacaoEsperada(dataDeCredito),
      );

      // --- Passo 2 e 3: o pagamento, pela porta de produção ------------------------------------
      await pagar(cenario.contexto, cobranca.codigo, {
        pagoEm: await dataDeslocada(cenario.contexto, 0),
        valorPago: VALOR_PAGO_DA_CANONICA,
      });

      expect((await lerDerivadaCrua(cenario.contexto, cobranca.codigo)).status).toBe('PAGA');

      // --- Passo 4: os SEIS campos, por igualdade INDIVIDUAL -----------------------------------
      //
      // Seis asserções nomeadas, e não uma comparação de objeto: um `toEqual` sobre o conjunto
      // reprovaria dizendo que "o objeto difere", e o campo esquecido ficaria escondido no meio do
      // diff. Um `UPDATE` que zerasse os seis deixa aqui seis reprovações, cada uma nomeando a coluna
      // e exibindo `null` contra o valor escrito.
      const depois = await lerConciliacaoCrua(cenario.contexto, cobranca.codigo);
      const esperada = conciliacaoEsperada(dataDeCredito);

      expect(depois.nosso_numero).toBe(esperada.nosso_numero);
      expect(depois.linha_digitavel).toBe(esperada.linha_digitavel);
      expect(depois.codigo_barras).toBe(esperada.codigo_barras);
      expect(depois.data_credito).toBe(esperada.data_credito);
      expect(depois.valor_creditado).toBe(esperada.valor_creditado);
      expect(depois.boleto_arquivo).toBe(esperada.boleto_arquivo);

      // --- Passo 5: e os quatro carimbos FORAM gravados ----------------------------------------
      //
      // A preservação da conciliação não impediu a escrita do que devia ser escrito — sem esta perna,
      // um `UPDATE` que não fizesse nada satisfaria as seis asserções acima.
      const carimbos = await lerCarimbosCrus(cenario.contexto, cobranca.codigo);

      expect(carimbos.multa_aplicada).toBe(MULTA_DE_DOIS_POR_CENTO);
      expect(carimbos.juros_aplicados).toBe(JUROS_DE_52_DIAS_EM_TEXTO);
      expect(carimbos.multa_percentual_aplicado).toBe(MULTA_PERCENTUAL_CARIMBADO);
      expect(carimbos.juros_percentual_aplicado).toBe(JUROS_PERCENTUAL_CARIMBADO);

      // --- Passo 6: a tabela NÃO tem `pagamento_confirmado` -----------------------------------
      //
      // O booleano do legado não é portado: `pago_em` responde à mesma pergunta, e o
      // `cobranca_carimbo_coerente_chk` torna o par coerente por construção. A igualdade da lista
      // inteira — e não um `not.toContain` — é o que também pega o acréscimo de qualquer outra coluna
      // de confirmação com outro nome.
      expect(await lerColunasDaCobranca(cenario.contexto)).toEqual([...COLUNAS_DA_COBRANCA]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-521 — nenhuma das TRÊS operações apaga cobrança
// ===========================================================================

describe('CT-521 — nenhuma operação apaga cobrança: contagem preservada nas três', () => {
  it(
    'contagem `N` nas quatro medições, colunas iguais às da `0009`, e sem `DELETE` publicado',
    async () => {
      // A empresa é NOVA e o contrato nasce sem parcela alguma — `ativarContrato` é a porta de estado,
      // e quem gera as parcelas é o serviço da borda. A carteira, portanto, começa vazia, e as quatro
      // contagens adiante são **absolutas**: `4` é este quatro, e não "quatro a mais que antes".
      const cenario = await semearContrato(
        await admitirEmpresaNova('Sem Exclusão'),
        'sem-exclusao',
      );
      await registrarPolitica(cenario.contexto, 2, 1);

      expect(await contarCobrancas(cenario.contexto)).toBe(0);

      // --- Passo 1: as quatro cobranças e a contagem `N` ----------------------------------------
      //
      // Os vencimentos são posicionados por deslocamento relativo ao relógio do banco (CT-512): duas
      // vencem adiante e duas venceram, de modo que a carteira parte de A_VENCER e VENCIDA — os dois
      // estados em aberto, que são exatamente os que a cascata alcança.
      const aVencer = await lancar(cenario, {
        diasAteVencimento: 10,
        valorOriginal: VALOR_APURADO,
      });
      const vencida = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_VENCIDA,
        valorOriginal: VALOR_APURADO,
      });
      const aPagar = await lancar(cenario, {
        diasAteVencimento: -DIAS_DA_PAGA,
        valorOriginal: VALOR_APURADO,
      });
      const aCancelar = await lancar(cenario, {
        diasAteVencimento: 10,
        valorOriginal: VALOR_APURADO,
      });

      const medicoes: number[] = [await contarCobrancas(cenario.contexto)];

      // --- Passo 2: as TRÊS operações destrutivas plausíveis, recontando após cada uma ----------
      //
      // Cada uma vem acompanhada da asserção de que ela **fez** o que devia: sem isso, uma operação
      // que não tocasse o banco satisfaria as quatro contagens por vacuidade — que é o modo de falha
      // óbvio de um caso que só conta linhas.
      await pagar(cenario.contexto, aPagar.codigo, {
        pagoEm: await dataDeslocada(cenario.contexto, 0),
        valorPago: VALOR_PAGO_DA_CANONICA,
      });

      expect((await localizar(cenario.contexto, aPagar.codigo))?.status).toBe('PAGA');
      medicoes.push(await contarCobrancas(cenario.contexto));

      await cancelar(cenario.contexto, aCancelar.codigo);

      expect((await localizar(cenario.contexto, aCancelar.codigo))?.status).toBe('CANCELADA');
      medicoes.push(await contarCobrancas(cenario.contexto));

      // A TERCEIRA operação — a cascata do cancelamento do contrato, que só existe a partir da T10 e
      // é a razão de este caso não poder viver antes dela. A quantidade devolvida é **dois**: as duas
      // em aberto, e nenhuma das duas terminais.
      expect(await cancelarEmCascata(cenario)).toBe(2);

      expect((await localizar(cenario.contexto, aVencer.codigo))?.status).toBe('CANCELADA');
      expect((await localizar(cenario.contexto, vencida.codigo))?.status).toBe('CANCELADA');
      medicoes.push(await contarCobrancas(cenario.contexto));

      // --- Passo 3: as QUATRO medições, por igualdade da lista ----------------------------------
      //
      // A lista inteira, e não quatro asserções soltas: é ela que mostra em qual das três operações a
      // linha desapareceu, se alguma vez desaparecer.
      expect(medicoes).toEqual([
        QUATRO_COBRANCAS,
        QUATRO_COBRANCAS,
        QUATRO_COBRANCAS,
        QUATRO_COBRANCAS,
      ]);

      // --- Passo 4: a lista ORDENADA de colunas, por igualdade ----------------------------------
      //
      // É a mesma âncora do passo 6 do CT-532, exercida aqui por outra razão: ela prova de uma vez a
      // ausência de `retirado_em` — a cobrança **transita de estado**, não circula (§21 do tech spec)
      // — e a de `status`, que é derivado pela visão (ADR-0022). E, sendo igualdade da lista inteira,
      // ela também impede **coluna nova** de entrar sem que alguém decida de novo.
      expect(await lerColunasDaCobranca(cenario.contexto)).toEqual([...COLUNAS_DA_COBRANCA]);

      // --- Passo 5: os métodos publicados sob `/v1/cobrancas` são `GET` e `POST` ----------------
      //
      // Não existe `DELETE`, e a ausência é contrato: a cobrança não tem ato de exclusão a traduzir
      // (ADR-0014, §21). A leitura é do fonte do controlador que **declara o segmento**, e as duas
      // âncoras vêm juntas — o segmento é afirmado por extenso, de modo que um `@Controller` movido
      // para outro caminho não deixaria este caso provando os métodos de rota alheia.
      const dono = await fonteDoControladorDeCobrancas();

      expect(dono).toContain(DECLARACAO_DO_SEGMENTO_DAS_COBRANCAS);
      expect(dono).toContain(DONO_DO_SEGMENTO_DAS_COBRANCAS);
      expect(metodosDeclarados(dono)).toEqual([...METODOS_SOB_COBRANCAS]);

      // --- Passo 5 (falsificação): a asserção estática REPROVA com um `DELETE` de volta ---------
      //
      // A varredura é estática, e por isso a prova de falsificação é obrigatória
      // (`.claude/rules/testing-stack.md`). O mutante é aplicado ao texto **em memória** — a árvore
      // versionada não é tocada —, e o par positivo/negativo é o que prova o predicado: sozinho, o
      // esperado seria satisfeito por um extrator que devolvesse sempre a mesma lista.
      const comExclusao = comMetodoDeExclusao(dono);

      expect(metodosDeclarados(comExclusao)).toEqual([
        METODO_DE_EXCLUSAO,
        ...METODOS_SOB_COBRANCAS,
      ]);
      expect(metodosDeclarados(comExclusao)).not.toEqual([...METODOS_SOB_COBRANCAS]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// As falsificações que exigem MUTAR A VISÃO — instância dedicada
// ===========================================================================

describe('a visão mutada — as duas provas de falsificação (CT-513, CT-526)', () => {
  /**
   * A instância **dedicada** dos mutantes.
   *
   * Ela é separada da principal porque recriar `negocio.cobranca_derivada` é ato de dono e alcança
   * **toda** leitura da instância: aplicado na principal, o mutante contaminaria os casos que
   * correm depois dele, e a suíte passaria a depender da ordem. Cada caso aqui aplica o seu mutante,
   * lê, e restaura a visão íntegra no `finally` — de modo que nenhum dos dois depende do outro.
   */
  let dedicada: BancoMigrado;
  let acessoDedicado: AcessoAoBanco;
  let cenario: CenarioDeCobranca;

  beforeAll(async () => {
    dedicada = await bancoEfemero();
    acessoDedicado = abrirAcessoAoBanco({
      cadeiaDeConexao: dedicada.cadeiaConexao,
      maximoDeConexoes: RESERVA_DE_UMA,
    });

    cenario = await semearContrato(CONTEXTO_DE_A, 'mutante', acessoDedicado);
    await registrarPolitica(cenario.contexto, 2, 1, acessoDedicado);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await acessoDedicado?.encerrar();
    await dedicada?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-513 (falsificação) — com `<=` no lugar de `<`, vencer HOJE passa a VENCIDA',
    async () => {
      const hoje = await lancar(
        cenario,
        { diasAteVencimento: 0, valorOriginal: 1000 },
        acessoDedicado,
      );

      // O controle, sobre a visão íntegra: vencer hoje está em dia.
      expect(hoje.status).toBe('A_VENCER');
      expect(hoje.diasAtraso).toBe(0);

      await comVisaoMutada(dedicada, comFronteiraFrouxa, async () => {
        const sobOMutante = await localizar(cenario.contexto, hoje.codigo, acessoDedicado);

        // A MESMA leitura, sobre a visão com o defeito reintroduzido, publica o estado errado — e a
        // multa integral incide por ZERO dia de atraso, que é o dano concreto de `<=`.
        expect(sobOMutante?.status).toBe('VENCIDA');
        expect(sobOMutante?.diasAtraso).toBe(0);
        expect(sobOMutante?.valorMulta).toBe(20);
      });

      // Restaurada a íntegra, a mesma cobrança volta a `A_VENCER`: o que mudou foi a visão, e não o
      // dado nem o relógio.
      const depois = await localizar(cenario.contexto, hoje.codigo, acessoDedicado);

      expect(depois?.status).toBe('A_VENCER');
      expect(depois?.valorMulta).toBe(0);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-526 (falsificação comportamental) — a POSIÇÃO do único `round` decide o centavo',
    async () => {
      const deDezessete = await lancar(
        cenario,
        { diasAteVencimento: -17, valorOriginal: VALOR_DO_ARREDONDAMENTO },
        acessoDedicado,
      );

      // O controle, sobre a visão íntegra: o centavo do oráculo.
      expect(deDezessete.valorJuros).toBe(7);

      // --- O mutante do CARD: arredondar ANTES de dividir por 30 --------------------------------
      //
      // Ele **não discrimina** — medido nesta task, e antes dela pela T3. A asserção existe para que
      // a refutação seja executável: uma rodada futura que reintroduza `7,02` no card encontra aqui,
      // por escrito, o valor que a forma realmente produz.
      await comVisaoMutada(dedicada, comArredondamentoAntesDaDivisao, async () => {
        expect(
          (await localizar(cenario.contexto, deDezessete.codigo, acessoDedicado))?.valorJuros,
        ).toBe(7);
      });

      // --- O mutante que DISCRIMINA: arredondar a taxa diária ------------------------------------
      //
      // Arredondada a taxa diária a duas casas antes de multiplicar pelos dias, `0.41152` vira `0.41`
      // e dezessete dias valem `6.97` no lugar de `7.00`. É a **posição** do único `round` que está
      // sob prova, e não o tipo numérico — esse é o eixo da asserção estática.
      await comVisaoMutada(dedicada, comArredondamentoDaTaxaDiaria, async () => {
        const sobOMutante = await localizar(cenario.contexto, deDezessete.codigo, acessoDedicado);

        expect(sobOMutante?.valorJuros).toBe(6.97);
        expect(sobOMutante?.valorJuros).not.toBe(7);
        // O total acompanha, porque ele é a soma das partes: é o que faz o defeito chegar ao valor
        // que o cliente paga, e não ficar restrito a um campo de diagnóstico.
        expect(sobOMutante?.valorTotal).toBe(1266.22);
      });

      // Restaurada a íntegra, o centavo do oráculo volta.
      expect(
        (await localizar(cenario.contexto, deDezessete.codigo, acessoDedicado))?.valorJuros,
      ).toBe(7);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Constantes dos casos — valores nomeados, nunca literal solto no meio da asserção
// ---------------------------------------------------------------------------------------------

/** Quantos casos o golden `calcular-mora.json` registra. */
const CASOS_DO_GOLDEN = 6;

/**
 * Quantas invocações os seis casos somam — **dez**, e não nove.
 *
 * O card do CT-525 escreve *"6 casos, 9 invocações"* e *"27 asserções"*, e a §3.3 da task repete o
 * nove. **Medido contra o artefato**, o golden tem `1 + 2 + 2 + 2 + 2 + 1 = 10` invocações, e portanto
 * **30** asserções de valor. O número do card foi redigitado; este veio do disco — que é exatamente a
 * razão de o oráculo ser lido em vez de transcrito, e a razão de esta âncora existir.
 *
 * Ela continua sendo um literal, e não `golden.casos.reduce(...)`: derivá-la do próprio arquivo faria
 * a asserção concordar com qualquer golden, inclusive um truncado.
 */
const INVOCACOES_DO_GOLDEN = 10;

/** Os juros de 52 dias sobre `2000.00` a 1%/mês — o valor que as duas multas do golden compartilham. */
const JUROS_DE_52_DIAS = 34.67;

/** O caso do golden cujas duas invocações diferem **só** no percentual da multa. */
const CASO_SEM_INCIDENCIA_DA_MULTA = 'juros_nao_incidem_sobre_a_multa';

/** A multa de 50% sobre `2000.00` — a segunda invocação daquele caso. */
const MULTA_DE_CINQUENTA_PORCENTO = 1000;

/**
 * Um código de contrato bem formado que **nenhum** cenário deste arquivo emitiu.
 *
 * Ele é o companheiro negativo do filtro por contrato: sem ele, um predicado que ignorasse o filtro
 * devolveria a mesma linha e a asserção positiva passaria sem provar que o recorte existe. O ano 2000
 * é o piso da faixa que as funções da série guardam, e nenhuma suíte emite nele.
 */
const CONTRATO_INEXISTENTE = 'CTR-2000-00001';

/** O valor do caso `total_e_soma_das_partes`, o único do golden que não é redondo. */
const VALOR_DO_ARREDONDAMENTO = 1234.56;

/** A multa de 2% sobre ele — idêntica nos dois atrasos, porque não depende dos dias. */
const MULTA_DO_ARREDONDAMENTO = 24.69;

/** O valor dos casos de linearidade do golden. */
const VALOR_DOS_JUROS = 2000;

/** A multa de 2% sobre ele. */
const MULTA_DOS_JUROS = 40;

/**
 * O valor original das quatro cobranças do CT-527 e da do CT-532 — o mesmo `2000.00` do golden.
 *
 * Ele é o valor do caso canônico `exemplo_canonico_2074_67`, e é o que faz os centavos esperados
 * adiante serem os do oráculo em vez de números escolhidos pelo caso.
 */
const VALOR_APURADO = 2000;

/** Os dias de atraso da VENCIDA do CT-527 — o mesmo `-60` que o card declara para a cancelada. */
const DIAS_DA_VENCIDA = 60;

/** Os dias de atraso da PAGA — os 52 do caso canônico do golden. */
const DIAS_DA_PAGA = 52;

/** O total do caso canônico: `2000.00` + `40.00` de multa + `34.67` de juros. */
const VALOR_PAGO_DA_CANONICA = 2074.67;

/**
 * Os três valores esperados **em cadeia**, com a escala do `numeric(15,2)` preservada.
 *
 * Literais, e não derivados de `MULTA_DOS_JUROS`/`JUROS_DE_52_DIAS`: `40` e `'40.00'` são o mesmo
 * número em JavaScript, e é só a cadeia que distingue o `numeric(15,2)` de uma conversão que perdeu a
 * escala no caminho — a mesma razão pela qual {@link lerDerivadaCrua} existe. Os centavos são os do
 * golden, e o `CT-525` os compara contra o arquivo versionado por outro caminho.
 */
const MULTA_DE_DOIS_POR_CENTO = '40.00';
const JUROS_DE_60_DIAS = '40.00';
const JUROS_DE_52_DIAS_EM_TEXTO = '34.67';

/** Os dois percentuais da política dos casos da T7, em cadeia — o carimbo os grava em `numeric(5,2)`. */
const MULTA_PERCENTUAL_CARIMBADO = '2.00';
const JUROS_PERCENTUAL_CARIMBADO = '1.00';

/** As duas restrições que o CT-517 exercita, nomeadas — um `23514` sozinho não diz qual falou. */
const RESTRICAO_DO_DESFECHO_UNICO = 'cobranca_desfecho_unico_chk';
const RESTRICAO_DO_CARIMBO_COERENTE = 'cobranca_carimbo_coerente_chk';

/**
 * O código da linha que o CT-517 tenta inserir com desfecho duplo.
 *
 * Ele é de um ano fora da faixa que qualquer cenário deste arquivo emite, para que a recusa esperada
 * seja a do `CHECK` (`23514`) e nunca a da unicidade do código (`23505`) — que mediria outra coisa.
 */
const CODIGO_DO_DESFECHO_DUPLO = 'COB-2000-9999999';

/**
 * As colunas de `negocio.cobranca`, **em ordem alfabética** — a ordem em que
 * {@link lerColunasDaCobranca} as devolve.
 *
 * Escritas por extenso, e não derivadas de consulta alguma: é a igualdade contra esta lista que
 * transforma *"não tem `pagamento_confirmado`"* numa afirmação que também pega o **acréscimo** de
 * qualquer outra coluna de confirmação com outro nome. Um `not.toContain` passaria verde sobre uma
 * coluna `baixa_confirmada` gravada por rotina, que é o mesmo defeito com outro rótulo.
 *
 * A lista é a mesma de `COLUNAS_DA_COBRANCA` em `fonte-unica-do-estado.spec.ts`, em outra ordem, e a
 * duplicação é deliberada: aquele caso a compara na ordem do catálogo e prova a ausência de `status`;
 * este a compara na ordem alfabética e prova a ausência de `pagamento_confirmado`. Derivar uma da
 * outra faria as duas asserções compartilharem o mesmo ponto de falha.
 */
const COLUNAS_DA_COBRANCA: readonly string[] = Object.freeze([
  'boleto_arquivo',
  'cancelado_em',
  'codigo',
  'codigo_barras',
  'competencia',
  'contrato_id',
  'data_credito',
  'data_vencimento',
  'empresa_id',
  'id',
  'juros_aplicados',
  'juros_percentual_aplicado',
  'linha_digitavel',
  'multa_aplicada',
  'multa_percentual_aplicado',
  'natureza',
  'nosso_numero',
  'pago_em',
  'referencia',
  'valor_creditado',
  'valor_original',
  'valor_pago',
]);

/**
 * Os cinco valores fixos da conciliação bancária do CT-532 — distintos e reconhecíveis.
 *
 * São os do card, e a escolha importa: um zeramento tem de ser detectável **campo a campo**, e valores
 * repetidos deixariam duas colunas trocadas passarem. A `data_credito` não está aqui porque é
 * posicionada por deslocamento relativo ao relógio do banco — ver {@link conciliacaoEsperada}.
 */
const NOSSO_NUMERO = '00000000000123456789';
const LINHA_DIGITAVEL = '75690.00001 00000.000000 00000.000000 1 00000000200000';
const CODIGO_DE_BARRAS = '75691000000000200000000010000000000000000000';
const VALOR_CREDITADO = '2000.00';
const BOLETO_ARQUIVO = 'boletos/2027/COB-2027-0000001.pdf';

// ---------------------------------------------------------------------------------------------
// O oráculo — lido do disco, nunca redigitado
// ---------------------------------------------------------------------------------------------

interface EntradaDoGolden {
  readonly dias_atraso: number;
  readonly juros_percentual: number;
  readonly multa_percentual: number;
  readonly valor_original: number;
}

interface SaidaDoGolden {
  readonly valor_juros: number;
  readonly valor_multa: number;
  readonly valor_total: number;
}

interface CasoDoGolden {
  readonly id: string;
  readonly invocacoes: readonly {
    readonly entrada: EntradaDoGolden;
    readonly saida: SaidaDoGolden;
  }[];
}

interface Golden {
  readonly casos: readonly CasoDoGolden[];
}

/** O oráculo, lido do arquivo versionado. Ver o cabeçalho: ele nunca é redigitado. */
async function lerGolden(): Promise<Golden> {
  return JSON.parse(await readFile(CAMINHO_DO_GOLDEN, 'utf8')) as Golden;
}

// ---------------------------------------------------------------------------------------------
// Acessórios — todo acesso pela API pública do pacote, sob o contexto de tenant
// ---------------------------------------------------------------------------------------------

type Contexto = contextoDeTenant.ContextoDeTenant;

/** Uma empresa com contrato ATIVO e, quando houver, a política de mora dela. */
interface CenarioDeCobranca {
  readonly contexto: Contexto;
  readonly contratoId: string;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação. O `dono` é
 * parâmetro porque a suíte tem duas instâncias — a principal e a dedicada aos mutantes.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
  dono?: AcessoAoBanco,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await (dono ?? acesso).emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Cria uma empresa nova, os cadastros e um contrato **ATIVO** nela, pelas portas públicas.
 *
 * O contrato é ativado pelo protocolo das **duas unidades sequenciais** que a borda usa (tech spec
 * §7.4): a primeira garante o contador e commita, a segunda emite o número e grava. As derivações da
 * ativação saem do ponto único da RD-10, e não de uma conta escrita aqui.
 *
 * `contexto` é parâmetro porque o CT-536 corre nas duas empresas da carga inicial, enquanto os casos
 * de mora criam empresas próprias — a política de mora é `unique(empresa_id)`, de modo que duas
 * políticas diferentes exigem duas empresas.
 */
async function semearContrato(
  contexto: Contexto,
  sufixo: string,
  dono?: AcessoAoBanco,
): Promise<CenarioDeCobranca> {
  sequenciaDoCenario += 1;
  const marca = `${sufixo}-${String(sequenciaDoCenario)}`;

  const cadastros = await emUnidade(
    contexto,
    async (tx) => {
      const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });

      const imovel = await criarImovel(tx, {
        conjuntoId: conjunto.id,
        nomeImovel: `Imóvel ${marca}`,
        identificadorMunicipal: `IPTU-${marca}`,
        tipoImovel: 'RESIDENCIAL',
        logradouro: 'Rua das Acácias',
        numero: '100',
        complemento: null,
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000000',
        statusLocacao: 'DISPONIVEL',
        observacoes: null,
      });

      const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
      const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

      return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
    },
    dono,
  );

  const anoDoContrato = await emUnidade(contexto, lerAnoDaSerieDeContrato, dono);

  await emUnidade(
    contexto,
    async (tx) => {
      await garantirContadorDeContrato(tx, anoDoContrato);
    },
    dono,
  );

  const contrato = await emUnidade(
    contexto,
    async (tx) => {
      const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

      return await criarContrato(
        tx,
        {
          imovelId: cadastros.imovelId,
          locadorId: cadastros.locadorId,
          locatarioId: cadastros.locatarioId,
          fiadoresIds: [],
          ...TERMOS_DO_CONTRATO,
        },
        { ano: anoDoContrato, numero },
      );
    },
    dono,
  );

  await emUnidade(
    contexto,
    async (tx) => {
      const ativado = await ativarContrato(tx, contrato.codigo, {
        dataFimLocacao: derivarTerminoDaLocacao(
          TERMOS_DO_CONTRATO.dataInicioLocacao,
          TERMOS_DO_CONTRATO.prazoMeses,
        ),
        valorTotalContrato: derivarValorTotal(
          TERMOS_DO_CONTRATO.valorMensal,
          TERMOS_DO_CONTRATO.prazoMeses,
        ),
      });

      if (ativado === undefined) {
        throw new Error(`o arranjo não conseguiu ativar o contrato ${contrato.codigo}`);
      }
    },
    dono,
  );

  return { contexto, contratoId: contrato.id };
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 20_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: 'contato@exemplo.com.br',
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marca}`,
        documento: `${String(Date.now()).slice(-8)}${marca.replace(/\D/g, '').padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

/**
 * Os cenários de política já montados, indexados pelo par `(multa, juros)`.
 *
 * Ele é um cache **lazy** porque `configuracao_de_mora` é `unique(empresa_id)`: duas políticas
 * diferentes exigem duas empresas, e criar uma empresa por invocação do golden multiplicaria por dez
 * uma montagem que só depende do par. Cada entrada é criada na primeira vez que o par é pedido.
 */
const cenariosPorPolitica = new Map<string, CenarioDeCobranca>();

/** Um cenário com a política informada, criado sob demanda e reusado entre casos. */
async function cenarioDaPolitica(multa: number, juros: number): Promise<CenarioDeCobranca> {
  const chave = `${String(multa)}|${String(juros)}`;
  const existente = cenariosPorPolitica.get(chave);

  if (existente !== undefined) {
    return existente;
  }

  const cenario = await semearContrato(
    await admitirEmpresaNova(`Mora ${chave}`),
    `mora-${String(multa)}-${String(juros)}`,
  );
  await registrarPolitica(cenario.contexto, multa, juros);
  cenariosPorPolitica.set(chave, cenario);

  return cenario;
}

/** Um cenário numa empresa que **nunca** registrou política de mora — a ausência é o cenário. */
async function cenarioSemPolitica(): Promise<CenarioDeCobranca> {
  return await semearContrato(await admitirEmpresaNova('Sem Política'), 'sem-politica');
}

/**
 * Grava a política de mora da empresa do contexto.
 *
 * **É instrução crua, e a razão está no cabeçalho**: a porta que a escreve nasce em T6, junto da rota
 * que a publica. A instrução corre sob a política de linha, com o papel da aplicação, e não compara
 * `empresa_id` com coisa alguma — o `WITH CHECK` é quem aceita ou recusa a linha, exatamente como
 * fará com a porta.
 *
 * O `ON CONFLICT` existe porque o CT-524 registra a política **depois** de já ter lido sem ela: é o
 * mesmo `upsert` de um comando só que a `unique(empresa_id)` foi criada para ser alvo.
 */
async function registrarPolitica(
  contexto: Contexto,
  multa: number,
  juros: number,
  dono?: AcessoAoBanco,
): Promise<void> {
  await emUnidade(
    contexto,
    async (tx) => {
      await tx`
        INSERT INTO negocio.configuracao_de_mora (empresa_id, multa_percentual, juros_percentual)
        VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid, ${multa}, ${juros})
        ON CONFLICT ON CONSTRAINT configuracao_de_mora_empresa_key
        DO UPDATE SET multa_percentual = ${multa}, juros_percentual = ${juros}
      `;
    },
    dono,
  );
}

/**
 * Acusa o pagamento **pela porta de produção** — o mesmo caminho que a rota usa por dentro.
 *
 * Ela substituiu, na T7, o acessório que carimbava por `UPDATE` cru; a razão da troca está no
 * cabeçalho deste arquivo. O que ela informa são os **dois** fatos do ato, e nada mais: multa, juros e
 * os dois percentuais são copiados da visão dentro da própria instrução que grava, de modo que **este
 * arquivo não tem como propor um valor de mora** — que é exatamente a propriedade sob prova no
 * CT-527 e no CT-532.
 *
 * A ausência de retorno é deliberada: quem quiser observar o efeito lê a visão ou a tabela pelos
 * leitores deste arquivo, e não o valor que a escrita devolveu. Um `undefined` da porta significa que
 * o contexto não alcançou a linha, e aqui isso é falha de arranjo — levanta em vez de seguir, senão o
 * caso adiante provaria o estado de uma cobrança que ninguém liquidou.
 */
async function pagar(
  contexto: Contexto,
  codigo: string,
  desfecho: DesfechoDoPagamento,
  dono?: AcessoAoBanco,
): Promise<void> {
  const paga = await emUnidade(
    contexto,
    async (tx) => await acusarPagamentoDeCobranca(tx, codigo, desfecho),
    dono,
  );

  if (paga === undefined) {
    throw new Error(`o arranjo não alcançou a cobrança ${codigo} para acusar o pagamento`);
  }
}

/**
 * Cancela **pela porta de produção**, pela mesma razão de {@link pagar}.
 *
 * Só `cancelado_em` é escrito, e a assimetria em relação ao pagamento é do próprio banco: o
 * `cobranca_carimbo_coerente_chk` amarra os cinco campos ao **pagamento**, e não ao cancelamento — a
 * cobrança cancelada não carimba mora porque nada foi cobrado. O instante sai de `now()`, do relógio
 * do banco, e não de um `Date` da aplicação.
 */
async function cancelar(contexto: Contexto, codigo: string, dono?: AcessoAoBanco): Promise<void> {
  const cancelada = await emUnidade(
    contexto,
    async (tx) => await cancelarCobranca(tx, codigo),
    dono,
  );

  if (cancelada === undefined) {
    throw new Error(`o arranjo não alcançou a cobrança ${codigo} para cancelar`);
  }
}

/**
 * Cancela em cascata as cobranças canceláveis do contrato do cenário, **pela porta de produção**, e
 * devolve quantas linhas o banco alcançou.
 *
 * É o mesmo caminho que a rota de cancelamento de contrato usa por dentro — a divergência declarada é
 * a mesma do CT-532: esta suíte é a da camada de dados e não tem HTTP, de modo que o ato é exercitado
 * pela porta que a borda chama. A rota é exercitada pelo `CT-530` e pelo `CT-531`, em
 * `apps/api/test/contratos.e2e.spec.ts`.
 *
 * **A guarda de estado do contrato não participa daqui**, e a ausência é do desenho: quem recusa
 * cancelar um contrato que não é `ATIVO` é o serviço da borda, que nomeia o estado atual na resposta.
 */
async function cancelarEmCascata(cenario: CenarioDeCobranca): Promise<number> {
  return await emUnidade(
    cenario.contexto,
    async (tx) => await cancelarCobrancasDoContrato(tx, cenario.contratoId),
  );
}

/**
 * Quantas linhas de `negocio.cobranca` o contexto corrente alcança.
 *
 * A contagem é **crua** e sem recorte algum: o que o CT-521 mede é se alguma linha desapareceu, e um
 * recorte por estado ou por circulação esconderia justamente a linha que sumiu. Ela lê a **tabela**, e
 * não a visão: o que se conta são **fatos**, e a visão os publica acrescidos de derivação que não
 * interessa a uma contagem.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política (ADR-0008).
 */
async function contarCobrancas(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.cobranca
    `;

    return Number(linha?.total ?? -1);
  });
}

/** Quantas políticas o contexto corrente alcança — a âncora do passo 1 do CT-524. */
async function contarPoliticas(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.configuracao_de_mora
    `;

    return Number(linha?.total ?? -1);
  });
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que todo cenário de atraso deste arquivo é posicionado**: o relógio nunca é falseado, o
 * dado é que se move. A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que a visão
 * consulta, de modo que a fronteira do vencimento é medida contra o próprio eixo que a decide.
 */
async function dataDeslocada(
  contexto: Contexto,
  dias: number,
  dono?: AcessoAoBanco,
): Promise<string> {
  return await emUnidade(
    contexto,
    async (tx) => {
      const [linha] = await tx<{ data: string }[]>`
        SELECT to_char(
                 negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
                 'YYYY-MM-DD'
               ) AS data
      `;

      if (linha === undefined) {
        throw new Error('o relógio do banco não devolveu a data corrente da operação');
      }

      return linha.data;
    },
    dono,
  );
}

/** Os campos que todo lançamento deste arquivo compartilha, montados a partir do cenário. */
function dadosDaCobranca(
  cenario: CenarioDeCobranca,
  dataVencimento: string,
  valorOriginal: number,
): DadosDaCobranca {
  return {
    contratoId: cenario.contratoId,
    natureza: 'ALUGUEL',
    referencia: 'Aluguel de janeiro/2026',
    competencia: COMPETENCIA,
    dataVencimento,
    valorOriginal,
  };
}

/**
 * Lança uma cobrança pelo protocolo das **duas unidades sequenciais** da série (tech spec §7.4).
 *
 * A primeira unidade garante o contador e commita; a segunda emite o número e grava. Fundir as duas é
 * justamente o desenho que a ADR-0015 recusa, e um acessório que o fizesse montaria o cenário por um
 * caminho que a operação não tem.
 */
async function lancar(
  cenario: CenarioDeCobranca,
  pedido: { readonly diasAteVencimento: number; readonly valorOriginal: number },
  dono?: AcessoAoBanco,
): Promise<LinhaDeCobranca> {
  const ano = await lerAnoDaOperacao(cenario.contexto, dono);
  const dataVencimento = await dataDeslocada(cenario.contexto, pedido.diasAteVencimento, dono);

  await emUnidade(
    cenario.contexto,
    async (tx) => {
      await garantirContadorDeCobranca(tx, ano);
    },
    dono,
  );

  return await emUnidade(
    cenario.contexto,
    async (tx) => {
      const numero = await emitirNumeroDeCobranca(tx, ano);

      return await criarCobranca(
        tx,
        dadosDaCobranca(cenario, dataVencimento, pedido.valorOriginal),
        { ano, numero },
      );
    },
    dono,
  );
}

/** O mesmo lançamento, com o ano da série **declarado** — só o CT-536 precisa disso. */
async function lancarComAno(
  cenario: CenarioDeCobranca,
  ano: number,
  diasAteVencimento: number,
): Promise<LinhaDeCobranca> {
  const dataVencimento = await dataDeslocada(cenario.contexto, diasAteVencimento);

  return await emUnidade(cenario.contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);

    return await criarCobranca(tx, dadosDaCobranca(cenario, dataVencimento, 1000), { ano, numero });
  });
}

/**
 * O ano do escopo da série, **segundo o relógio do banco e o fuso do objeto**.
 *
 * Ele sai de `negocio.data_corrente_da_operacao()`, e não de `current_date`: o fuso da sessão decidiria
 * de qual ano é o contador nas horas em torno da virada, e a série é `(empresa, ano)`.
 *
 * A T5 publicou o leitor de produção com **esta mesma propriedade** — `lerAnoDaSerieDeCobranca`, em
 * `../src/cobranca.ts` —, e com ele o débito que esta nota registrava foi fechado. Este acessório
 * **continua sendo do teste, e continua escrito por extenso de propósito**: derivá-lo do símbolo que
 * o SUT usa faria a asserção concordar consigo mesma, e um leitor de produção que trocasse de eixo
 * deixaria de reprovar caso algum. O que os dois compartilham é a consulta, não a definição.
 */
async function lerAnoDaOperacao(contexto: Contexto, dono?: AcessoAoBanco): Promise<number> {
  return await emUnidade(
    contexto,
    async (tx) => {
      const [linha] = await tx<{ ano: number }[]>`
        SELECT extract(year FROM negocio.data_corrente_da_operacao())::integer AS ano
      `;

      if (linha === undefined) {
        throw new Error('o relógio do banco não devolveu o ano da série');
      }

      return linha.ano;
    },
    dono,
  );
}

/** A leitura por código, **pela porta**. */
async function localizar(
  contexto: Contexto,
  codigo: string,
  dono?: AcessoAoBanco,
): Promise<LinhaDeCobranca | undefined> {
  return await emUnidade(contexto, async (tx) => await localizarCobranca(tx, codigo), dono);
}

/** A carteira do contexto, **pela porta**, numa janela larga o bastante para contê-la inteira. */
async function listar(contexto: Contexto, filtros: FiltrosDaCarteira = {}) {
  return await emUnidade(
    contexto,
    async (tx) => await listarCobrancas(tx, { limite: 50, deslocamento: 0 }, filtros),
  );
}

/** Os cinco campos derivados, lidos **cruamente** da visão, com o `numeric` ainda em cadeia. */
interface DerivadaCrua {
  readonly status: string;
  readonly dias_atraso: number;
  readonly valor_multa: string;
  readonly valor_juros: string;
  readonly valor_total: string;
}

/**
 * Lê os cinco derivados sem passar pela conversão da porta.
 *
 * A porta converte `numeric` em número, e `20.00` e `20.0` são o **mesmo** número em JavaScript. A
 * cadeia é o que distingue a escala do `numeric(15,2)` de uma conversão que a perdeu no caminho — e é
 * a forma em que os cards escrevem os valores esperados.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política, e escrever o filtro no
 * teste provaria a aplicação em vez do banco (ADR-0008).
 */
async function lerDerivadaCrua(
  contexto: Contexto,
  codigo: string,
  dono?: AcessoAoBanco,
): Promise<DerivadaCrua> {
  return await emUnidade(
    contexto,
    async (tx) => {
      const [linha] = await tx<DerivadaCrua[]>`
        SELECT status::text AS status,
               dias_atraso,
               valor_multa::text AS valor_multa,
               valor_juros::text AS valor_juros,
               valor_total::text AS valor_total
          FROM negocio.cobranca_derivada
         WHERE codigo = ${codigo}
      `;

      if (linha === undefined) {
        throw new Error(`a visão derivada não alcançou a cobrança ${codigo}`);
      }

      return linha;
    },
    dono,
  );
}

/** O desfecho gravado, lido **cruamente da tabela** — o `numeric` ainda em cadeia. */
interface CarimbosCrus {
  readonly data_vencimento: string;
  readonly pago_em: string | null;
  readonly valor_pago: string | null;
  readonly multa_aplicada: string | null;
  readonly juros_aplicados: string | null;
  readonly multa_percentual_aplicado: string | null;
  readonly juros_percentual_aplicado: string | null;
}

/**
 * Lê o desfecho da TABELA, e não da visão.
 *
 * É observação do fato gravado, e não caminho de leitura de produto: o que se quer saber é o que está
 * **na linha**, para separar *"a visão publica `40.00`"* de *"a visão publica o que foi gravado"*. As
 * duas datas saem por `to_char` pela mesma razão da projeção da porta — o driver entregaria uma coluna
 * `date` como `Date` no fuso do processo.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política (ADR-0008).
 */
async function lerCarimbosCrus(contexto: Contexto, codigo: string): Promise<CarimbosCrus> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<CarimbosCrus[]>`
      SELECT to_char(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
             to_char(pago_em, 'YYYY-MM-DD') AS pago_em,
             valor_pago::text AS valor_pago,
             multa_aplicada::text AS multa_aplicada,
             juros_aplicados::text AS juros_aplicados,
             multa_percentual_aplicado::text AS multa_percentual_aplicado,
             juros_percentual_aplicado::text AS juros_percentual_aplicado
        FROM negocio.cobranca
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} não foi alcançada para a leitura dos carimbos`);
    }

    return linha;
  });
}

/** Os seis campos de conciliação bancária, lidos cruamente da tabela. */
interface ConciliacaoCrua {
  readonly nosso_numero: string | null;
  readonly linha_digitavel: string | null;
  readonly codigo_barras: string | null;
  readonly data_credito: string | null;
  readonly valor_creditado: string | null;
  readonly boleto_arquivo: string | null;
}

/**
 * Preenche os seis campos de conciliação bancária — **instrução crua**, e declarada.
 *
 * Eles nascem nulos e **não têm rota nesta fatia**: a emissão de boleto e o processamento do retorno
 * são da F4. Escrevê-los aqui é o único caminho para montar o cenário do CT-532, e a instrução corre
 * pelo papel da APLICAÇÃO, sob o contexto de empresa, sem comparar `empresa_id` com coisa alguma — o
 * `WITH CHECK` da política é quem aceita a linha.
 *
 * **Publicar uma rota de conciliação só para isto é o que NÃO se faz**: a superfície publicada é
 * declarada e auditada, e a oitava rota faria a âncora de 82 reprovar — que é o efeito desejado.
 *
 * O `RETURNING` não é ornamento: um `UPDATE` que não alcançasse linha alguma seria silencioso, e o
 * caso passaria a comparar seis nulos com seis nulos.
 */
async function escreverConciliacao(
  contexto: Contexto,
  codigo: string,
  dataDeCredito: string,
): Promise<void> {
  const alcancadas = await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      UPDATE negocio.cobranca
         SET nosso_numero = ${NOSSO_NUMERO},
             linha_digitavel = ${LINHA_DIGITAVEL},
             codigo_barras = ${CODIGO_DE_BARRAS},
             data_credito = ${dataDeCredito},
             valor_creditado = ${VALOR_CREDITADO},
             boleto_arquivo = ${BOLETO_ARQUIVO}
       WHERE codigo = ${codigo}
      RETURNING codigo
    `;

    return linhas.length;
  });

  if (alcancadas !== 1) {
    throw new Error(`a escrita da conciliação alcançou ${String(alcancadas)} linhas em ${codigo}`);
  }
}

/** Lê os seis campos de conciliação da TABELA — eles não são publicados por esquema nenhum. */
async function lerConciliacaoCrua(contexto: Contexto, codigo: string): Promise<ConciliacaoCrua> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<ConciliacaoCrua[]>`
      SELECT nosso_numero,
             linha_digitavel,
             codigo_barras,
             to_char(data_credito, 'YYYY-MM-DD') AS data_credito,
             valor_creditado::text AS valor_creditado,
             boleto_arquivo
        FROM negocio.cobranca
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} não foi alcançada para a leitura da conciliação`);
    }

    return linha;
  });
}

/** O que os seis campos têm de valer — a data entra por parâmetro porque é relativa ao relógio. */
function conciliacaoEsperada(dataDeCredito: string): ConciliacaoCrua {
  return {
    nosso_numero: NOSSO_NUMERO,
    linha_digitavel: LINHA_DIGITAVEL,
    codigo_barras: CODIGO_DE_BARRAS,
    data_credito: dataDeCredito,
    valor_creditado: VALOR_CREDITADO,
    boleto_arquivo: BOLETO_ARQUIVO,
  };
}

/**
 * O `xmin` da tupla — o identificador da transação que gravou a versão corrente da linha.
 *
 * É a **única** leitura deste arquivo que toca `negocio.cobranca` em vez da visão, e ela é
 * observação, não caminho de leitura de produto: o `xmin` é coluna de sistema e não existe na visão.
 * Ele muda a cada `UPDATE`, e é por isso que a igualdade entre as três medições do CT-512 prova a
 * **ausência de escrita** — e não apenas a igualdade do valor publicado.
 */
async function lerXmin(contexto: Contexto, codigo: string): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ xmin: string }[]>`
      SELECT xmin::text AS xmin FROM negocio.cobranca WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} não foi alcançada para a leitura do xmin`);
    }

    return linha.xmin;
  });
}

/** As colunas que `negocio.cobranca` de fato tem — o catálogo, e não o esquema declarado. */
async function lerColunasDaCobranca(contexto: Contexto): Promise<string[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ coluna: string }[]>`
      SELECT column_name AS coluna
        FROM information_schema.columns
       WHERE table_schema = 'negocio' AND table_name = 'cobranca'
       ORDER BY column_name
    `;

    return linhas.map((linha) => linha.coluna);
  });
}

/** Os códigos gravados, lidos **cruamente** da tabela — a contagem que separa erro de erro com rastro. */
async function lerCodigosCrus(contexto: Contexto): Promise<string[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      SELECT codigo FROM negocio.cobranca ORDER BY codigo
    `;

    return linhas.map((linha) => linha.codigo);
  });
}

/**
 * A data corrente da operação lida sob um fuso de sessão declarado.
 *
 * `SET LOCAL TIME ZONE` vale só até o fim da transação, de modo que a troca não vaza para os casos
 * seguintes. Ela **não falseia o relógio**: o instante é o mesmo, e o que muda é como a sessão o
 * interpretaria — que é exatamente a propriedade sob prova, já que a função fixa o fuso no objeto.
 */
async function lerDataCorrenteSobFuso(contexto: Contexto, fuso: string): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    await tx.unsafe(`SET LOCAL TIME ZONE '${fuso}'`);

    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(negocio.data_corrente_da_operacao(), 'YYYY-MM-DD') AS data
    `;

    if (linha === undefined) {
      throw new Error(`o relógio do banco não devolveu a data corrente sob o fuso ${fuso}`);
    }

    return linha.data;
  });
}

// ---------------------------------------------------------------------------------------------
// Os leitores dos artefatos do repositório — usados pelo CT-512 (b) e pelo CT-526
// ---------------------------------------------------------------------------------------------

/** As unidades `systemd` de um diretório, em ordem — o real no caso, a cópia na falsificação. */
async function lerUnidades(diretorio: string): Promise<string[]> {
  return (await readdir(diretorio)).sort();
}

/** Copia as unidades reais para um diretório novo, com os nomes extras que a falsificação pedir. */
async function copiarUnidades(raiz: string, extras: readonly string[]): Promise<string> {
  const destino = await mkdtemp(join(raiz, 'unidades-'));
  await mkdir(destino, { recursive: true });

  for (const nome of await lerUnidades(DIRETORIO_DE_UNIDADES)) {
    await copyFile(join(DIRETORIO_DE_UNIDADES, nome), join(destino, nome));
  }

  for (const extra of extras) {
    await writeFile(join(destino, extra), '[Unit]\nDescription=falsificação\n', 'utf8');
  }

  return destino;
}

/** O fonte do controlador que serve `/v1/cobrancas`, lido do disco — o alvo do passo 5 do CT-521. */
async function fonteDoControladorDeCobrancas(): Promise<string> {
  return await readFile(CAMINHO_DO_CONTROLADOR_DE_COBRANCAS, 'utf8');
}

/**
 * Os métodos HTTP que um fonte de controlador declara, **sem repetição e em ordem alfabética**.
 *
 * A ordenação e a deduplicação são o que fazem a comparação ser sobre o **conjunto** de verbos, e não
 * sobre a ordem em que os manipuladores aparecem no arquivo: mover um manipulador não é mudança de
 * superfície, e acrescentar um verbo é.
 *
 * Ela é **pura sobre texto** de propósito, e não uma leitura de arquivo: é isso que permite à
 * falsificação aplicar o mutante em memória, sem tocar a árvore versionada — mesma forma dos mutantes
 * da migração adiante.
 */
function metodosDeclarados(fonte: string): string[] {
  const encontrados = [...fonte.matchAll(DECLARACAO_DE_METODO)].map(([, metodo]) =>
    (metodo ?? '').toUpperCase(),
  );

  return [...new Set(encontrados)].sort();
}

/**
 * O mutante do passo 5 do CT-521: um manipulador de **exclusão** de volta na superfície.
 *
 * Ele é acrescentado imediatamente antes do manipulador de leitura por código, que é onde um `DELETE`
 * de recurso nasceria por simetria — e é a forma que o defeito teria. A troca é **de uma ocorrência
 * só**, afirmada por {@link trocarUmaVez}: se o alvo deixar de ser único, a falsificação levanta em vez
 * de provar coisa diferente da que promete.
 */
function comMetodoDeExclusao(fonte: string): string {
  return trocarUmaVez(fonte, "  @Get(':codigo')", "  @Delete(':codigo')\n  @Get(':codigo')");
}

/**
 * As filas que o contrato compartilhado declara, **ordenadas**.
 *
 * A ordenação é a mesma disciplina de {@link lerUnidades}: a lista esperada não deve depender da
 * posição em que cada declaração aparece no fonte, que é acidente de escrita.
 */
async function lerFilasDeclaradas(caminho: string): Promise<string[]> {
  const fonte = await readFile(caminho, 'utf8');

  return [...fonte.matchAll(DECLARACAO_DE_FILA)].map(([, nome]) => nome ?? '').sort();
}

/**
 * O texto de um `.sql` **sem comentários** — tudo a partir de `--` na linha é descartado.
 *
 * Sem isso, a asserção estática acusaria o arquivo íntegro: a `0010` cita `round(double precision)`
 * em prosa, justamente para registrar que o modo de arredondamento dele é outro. É o mesmo defeito
 * medido na F0, em que uma asserção casava `ALTER ROLE` em comentário e ficava verde sobre um script
 * sem guarda alguma.
 */
function semComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((linha) => {
      const inicio = linha.indexOf('--');

      return inicio === -1 ? linha : linha.slice(0, inicio);
    })
    .join('\n');
}

/** Quais marcas de ponto flutuante aparecem em posição executável — vazio no artefato íntegro. */
function marcasDePontoFlutuante(sql: string): string[] {
  const executavel = semComentarios(sql);

  return MARCAS_DE_PONTO_FLUTUANTE.filter((marca) => executavel.includes(marca));
}

// ---------------------------------------------------------------------------------------------
// Os mutantes da visão — aplicados a uma instância DEDICADA, a partir do texto REAL da migração
// ---------------------------------------------------------------------------------------------

/** O separador que a `drizzle-kit` usa entre instruções, e que o aplicador de migrações respeita. */
const SEPARADOR_DE_INSTRUCAO = '--> statement-breakpoint';

/** A expressão de juros da visão, como a `0010` a escreve — o alvo dos dois mutantes de posição. */
const EXPRESSAO_DOS_JUROS =
  'c.valor_original * (COALESCE(m.juros_percentual, 0) / 100) / 30 * t.dias_atraso';

/** A comparação estrita do vencimento, como a `0010` a escreve — o alvo do mutante do CT-513. */
const COMPARACAO_ESTRITA = 'c.data_vencimento < "negocio"."data_corrente_da_operacao"()';

/**
 * O bloco `CREATE VIEW` da migração, extraído do texto REAL.
 *
 * Ele é lido do disco, e não recomposto aqui, pela mesma razão que faz o CT-007 reler a política em
 * vez de reescrevê-la: duas redações da mesma visão são livres para divergir, e a divergência
 * apareceria como uma falsificação que prova coisa diferente do que o produto faz.
 */
async function blocoDaVisao(): Promise<string> {
  const bloco = (await readFile(CAMINHO_DA_MIGRACAO, 'utf8'))
    .split(SEPARADOR_DE_INSTRUCAO)
    .find((trecho) => trecho.includes('CREATE VIEW'));

  if (bloco === undefined) {
    throw new Error('o bloco `CREATE VIEW` não foi encontrado em `0010_seguranca_cobranca.sql`');
  }

  return bloco;
}

/** Troca **exatamente uma** ocorrência, e levanta quando o alvo não é único — a prova seria vácua. */
function trocarUmaVez(texto: string, alvo: string, substituto: string): string {
  const ocorrencias = texto.split(alvo).length - 1;

  if (ocorrencias !== 1) {
    throw new Error(
      `o mutante esperava UMA ocorrência de \`${alvo}\` no bloco da visão, e encontrou ` +
        `${String(ocorrencias)} — sem isso a falsificação não prova o que promete`,
    );
  }

  return texto.replace(alvo, substituto);
}

/**
 * O mutante da asserção ESTÁTICA do CT-526: a aritmética dos juros passando por ponto flutuante.
 *
 * Ele muta o texto **inteiro** da migração, e não só o bloco da visão, porque a asserção que ele
 * falsifica varre o arquivo inteiro. A cópia não é aplicada a banco algum — o que está sob prova é a
 * capacidade da varredura de acusar o cast, e não o comportamento de uma visão que o PostgreSQL nem
 * aceitaria (`round(double precision, integer)` não existe).
 */
function comJurosEmPontoFlutuante(migracao: string): string {
  return trocarUmaVez(
    migracao,
    EXPRESSAO_DOS_JUROS,
    'c.valor_original::double precision * (COALESCE(m.juros_percentual, 0)::double precision / 100)' +
      ' / 30 * t.dias_atraso',
  );
}

/** O mutante do CT-513: a fronteira do vencimento deixa de ser estrita. */
function comFronteiraFrouxa(bloco: string): string {
  return trocarUmaVez(
    bloco,
    COMPARACAO_ESTRITA,
    'c.data_vencimento <= "negocio"."data_corrente_da_operacao"()',
  );
}

/** O mutante do CARD: arredondar antes da divisão por 30. **Medido: não discrimina.** */
function comArredondamentoAntesDaDivisao(bloco: string): string {
  return trocarUmaVez(
    bloco,
    EXPRESSAO_DOS_JUROS,
    'round(c.valor_original * (COALESCE(m.juros_percentual, 0) / 100), 2) / 30 * t.dias_atraso',
  );
}

/** O mutante que DISCRIMINA: arredondar a taxa diária antes de multiplicar pelos dias. */
function comArredondamentoDaTaxaDiaria(bloco: string): string {
  return trocarUmaVez(
    bloco,
    EXPRESSAO_DOS_JUROS,
    'round(c.valor_original * (COALESCE(m.juros_percentual, 0) / 100) / 30, 2) * t.dias_atraso',
  );
}

/**
 * Recria a visão com o mutante aplicado, executa o trabalho e **restaura a íntegra**.
 *
 * A restauração corre no `finally` de propósito: uma asserção que falhe no meio não pode deixar a
 * instância com a visão defeituosa, ou o caso seguinte reprovaria por um motivo que não é o dele.
 *
 * A conexão é a de **migração** porque recriar visão é ato de dono — é o único ponto deste arquivo em
 * que privilégio participa, e ele existe porque a prova de falsificação exige mudar o SUT. A
 * instância é a **dedicada**, que nenhum outro caso alcança.
 */
async function comVisaoMutada(
  instancia: BancoMigrado,
  mutar: (bloco: string) => string,
  trabalho: () => Promise<void>,
): Promise<void> {
  const bloco = await blocoDaVisao();
  const sql = abrirConexao(conexaoDeMigracao(instancia));

  try {
    await sql.unsafe(`DROP VIEW "negocio"."cobranca_derivada"; ${mutar(bloco)}`).simple();

    await trabalho();
  } finally {
    await sql.unsafe(`DROP VIEW IF EXISTS "negocio"."cobranca_derivada"; ${bloco}`).simple();
    await sql.end();
  }
}

// ---------------------------------------------------------------------------------------------
// Observação de exceção — a mesma forma de `contrato.spec.ts`
// ---------------------------------------------------------------------------------------------

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

function erroDe<T>(resultado: Resultado<T>): unknown {
  return resultado.ok ? undefined : resultado.erro;
}

function mensagemDe<T>(resultado: Resultado<T>): string {
  const erro = erroDe(resultado);

  return erro instanceof Error ? erro.message : String(erro);
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;

  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição que o servidor apontou.
 *
 * Afirmá-lo — e não só o `SQLSTATE` — é o que distingue *"alguma unicidade recusou"* de *"ESTA
 * unicidade recusou"*: `negocio.cobranca` tem duas restrições únicas, e um `23505` sozinho não diz
 * qual delas falou.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;

  return typeof nome === 'string' ? nome : undefined;
}
