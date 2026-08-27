/**
 * Cadastro de imóveis pelas rotas de `/v1/conjuntos` (CT-344 e CT-345, T5) e de `/v1/imoveis`
 * (CT-310 e CT-333, T6). Fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-01 | CT-344 | `POST /v1/conjuntos` responde `201` com `{ id (UUID minúsculo), nome,
 * |       |        | retiradoEm: null }`; `GET /v1/conjuntos/:id` devolve corpo **profundamente
 * |       |        | igual** ao da criação; `PUT /v1/conjuntos/:id` responde `200` com o `nome`
 * |       |        | novo e o MESMO `id`, e a leitura seguinte reflete a alteração. |
 * | CA-01 | CT-345 | Toda entrada recusada de conjunto nomeia o campo culpado e **não grava linha
 * | CA-14 |        | alguma**: `nome` ausente ou vazio e chave desconhecida respondem
 * |       |        | `422 CAMPO_INVALIDO`, `:id` malformado responde `422` com `campo: 'id'` sem
 * |       |        | tocar o banco, e UUID bem formado e inexistente responde
 * |       |        | `404 RECURSO_NAO_ENCONTRADO`. A contagem crua de `negocio.conjunto` é idêntica
 * |       |        | antes e depois. |
 * | CA-03 | CT-310 | Um segundo imóvel com o mesmo `identificadorMunicipal` na MESMA empresa é
 * |       |        | recusado com `422 CAMPO_INVALIDO` nomeando `identificadorMunicipal` em
 * |       |        | `campo` — corpo INTEIRO afirmado, `detalhes.conflito` incluso — e **nada é
 * |       |        | gravado**: a contagem crua de `negocio.imovel` da empresa A continua 1. A
 * |       |        | MESMA cadeia, partindo da sessão de OUTRA empresa, é aceita com `201`, e o
 * |       |        | imóvel que nasce lá **não é alcançável** pela sessão de A. |
 * | CA-03 | CT-310 | A unicidade **alcança o imóvel retirado de circulação** (ADR-0014): o mesmo
 * | CA-11 | (b)    | identificador é recusado antes e depois da retirada, e o `detalhes.conflito`
 * |       |        | muda de `EM_CIRCULACAO` para `RETIRADO_DE_CIRCULACAO` — é o par que discrimina
 * |       |        | quem reativa de quem recadastra. Nenhuma das duas recusas grava linha, e a
 * |       |        | recirculação devolve o imóvel com o identificador ainda dele. |
 * | CA-14 | CT-333 | `POST /v1/imoveis` com `conjuntoId` de conjunto que existe em OUTRA empresa
 * |       |        | responde `404 RECURSO_NAO_ENCONTRADO` com corpo **profundamente igual** ao de
 * |       |        | um `conjuntoId` inexistente, e nenhuma linha é gravada em nenhuma das duas
 * |       |        | empresas. O controle com o conjunto próprio responde `201`. |
 * | CA-14 | CT-333 | Mudar o imóvel de conjunto pelo `PUT` completo funciona e a leitura seguinte
 * | CA-01 | (b)    | reflete o destino novo; **nenhuma** das duas recusas do mesmo `PUT` grava
 * | CA-03 |        | metade da alteração — o conjunto de outra empresa responde o **mesmo** `404`,
 * |       |        | e o `identificadorMunicipal` já ocupado por outro imóvel da MESMA empresa
 * |       |        | responde o **mesmo** `422 CAMPO_INVALIDO` da criação, com `detalhes.conflito`.
 * |       |        | Nos dois casos o imóvel fica **byte a byte** como estava. |
 * | CA-06 | CT-308 | `PUT /v1/imoveis/:id/comodos/:comodoId` altera **um** cômodo e a resposta já é o
 * |       |        | imóvel inteiro recalculado: `200`, `metragemTotal` de `67.75` para `77.75`, e
 * |       |        | os demais cômodos inalterados em identificador, nome, metragem e posição. A
 * |       |        | releitura seguinte devolve o mesmo, e o imóvel em si não é tocado — **nenhuma
 * |       |        | outra rota é chamada entre as duas leituras, e o imóvel não é reenviado**. |
 * | CA-16 | CT-332 | As cinco recusas da superfície de cômodo nomeiam o culpado e não gravam nada:
 * | CA-14 |        | `metragem` negativa e `metragem: null` explícita respondem `422 CAMPO_INVALIDO`
 * |       |        | com `campo: 'metragem'`, e o `:comodoId` endereçado por um imóvel de OUTRA
 * |       |        | empresa responde `404 RECURSO_NAO_ENCONTRADO` com corpo **profundamente igual**
 * |       |        | ao de um imóvel inexistente. A metragem total permanece no valor anterior. |
 * | CA-14 | CT-332 | E a **contenção do sub-recurso**, nas metades 4 e 5: o `:comodoId` endereçado
 * | CA-06 |        | por OUTRO imóvel da MESMA empresa responde o **mesmo** `404`, no `PUT` e no
 * |       |        | `DELETE`, e o cômodo fica **byte a byte** como estava. Aqui a política do
 * |       |        | banco alcança os dois imóveis: quem recusa é só o `AND imovel_id` das duas
 * |       |        | instruções. |
 *
 * Rastreabilidade: `CA-01 → CT-344 (RN-01)`, `CA-01 → CT-345 (RN-01)`, `CA-14 → CT-345 (RN-12)`,
 * `CA-03 → CT-310 (RN-03)`, `CA-11 → CT-310 (b) (RN-05)`, `CA-14 → CT-333 (RN-01)`,
 * `CA-01 → CT-333 (b) (RN-01)`, `CA-03 → CT-333 (b) (RN-03)`, `CA-06 → CT-308 (RN-07)`,
 * `CA-16 → CT-332 (RN-02)`, `CA-14 → CT-332 (RN-01)`, `CA-06 → CT-332 (RN-07)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T6 — leia antes de comparar com a §5.1 e a §6.6
 * ===========================================================================
 *
 * 1. **A §5.1 da T6 lista este arquivo como *a criar*, e os cards dizem `NO_SUITE_FOUND (criar)`.**
 *    Ele já existia: a T5 o criou. Os artefatos foram escritos antes dela, e a instrução que vale é
 *    a do Gate 2 de testes — *estender a suíte existente sempre que possível*. Estender é o certo
 *    aqui por uma razão a mais do que a economia: os dois casos da T6 precisam da **mesma** montagem
 *    (aplicação real, banco efêmero, sessão pela rota de entrada), e uma segunda montagem em outro
 *    arquivo subiria um segundo Postgres para provar a mesma superfície.
 * 2. **Os dois sub-casos com letra — `CT-310 (b)` e `CT-333 (b)` — não estão na §6.6.** Eles existem
 *    porque dois itens do **aceite técnico** da T6 (§4) não têm caso nomeado na §6.5: *"unicidade
 *    imposta pelo banco, **alcançando retirados**"* e *"mudança de conjunto pelo `PUT` funciona e
 *    passa pela mesma conferência"*. Sem eles, os dois itens ficariam sem prova alguma, e dois
 *    mutantes sobreviveriam: um discriminador **constante** em `EM_CIRCULACAO`, e um `PUT` que **não**
 *    confere o conjunto de destino. A forma com letra é a que esta base já usa para sub-caso da mesma
 *    invariante (`CT-213 (b)` e `(c)`, em `cobertura-de-autorizacao.e2e.spec.ts`).
 * 2-B. **DIVERGÊNCIAS DA T7 — a §5.2 dela declara este arquivo, e o card do `CT-308` não.** O card
 *    propõe `apps/api/test/imoveis.e2e.spec.ts`; vence a §5.2, pela mesma razão do item 1. E o
 *    **`CT-332`** entra aqui embora nomeado apenas como *negative companion* do card: sem ele, os
 *    três cenários de erro da §6.4 da task — metragem negativa, metragem nula e cômodo de imóvel
 *    alheio — ficariam sem prova pela rota, e três mutantes sobreviveriam (um esquema sem piso, um
 *    que aceitasse `null` e uma borda que traduzisse a ausência do cômodo em algo diferente de
 *    `404`). A forma segue a do item 2: sub-caso da mesma superfície, no mesmo arquivo.
 * 3. **`statusLocacao: 'LOCADO'` não é exercitado aqui**, embora seja aceite da T6. A §6.5 o atribui
 *    ao `CT-335`, que a T1 já implementou em `packages/contracts/test/esquemas.spec.ts` — no esquema,
 *    que é a camada mais baixa que detecta a falha (Iron Law #3). Repeti-lo pela rota seria
 *    duplicação cross-layer (AP-23) sem ganho de detecção: a borda usa **aquele** esquema.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-344 — o objeto INTEIRO, em cada passo.** A asserção é `toEqual` sobre o corpo completo, e não
 * a presença de campos: é ela que impede a leitura de devolver o nome antigo com um campo a mais
 * mascarando a divergência, e é o que a ADR-0017 pede de uma superfície que congela. A comparação
 * `id === id.toLowerCase()` é a perna da canonização — sem ela, a borda poderia devolver o
 * identificador em caixa mista e a comparação de identidade a jusante voltaria a ser contornável (é o
 * defeito que a `DECISÃO FECHADA` de `usuarios/usuario.controller.ts` fechou na F1).
 *
 * **CT-345 — a contagem crua antes e depois.** É ela que distingue *"respondeu 422"* de *"respondeu
 * 422 **e não gravou**"*. Sem ela o caso passaria com um controlador que gravasse antes de validar —
 * e a recusa deixaria uma linha órfã a cada tentativa malsucedida do usuário. A leitura é feita pela
 * API pública do pacote de dados, sob o contexto de tenant, e conta **todas** as linhas alcançáveis
 * naquele contexto.
 *
 * **A linha `id_malformado` é a que discrimina o argumento `campoPadrao`.** O `:id` é um escalar sem
 * caminho a nomear, e ele recusa com `campo: 'id'`; a linha `chave_extra` recusa com `campo: 'corpo'`
 * pelo mesmo mecanismo e com outro valor. Uma borda que fixasse um literal no lugar do parâmetro
 * reprovaria numa das duas.
 *
 * **CT-310 — o par "recusa na mesma empresa / aceita em outra" é o que discrimina.** Uma unicidade
 * **global** — que é literalmente o defeito que o PRD nomeia no sistema antigo, *"um dado de
 * identificação do imóvel é único no sistema inteiro"* — passaria a primeira metade do caso e
 * reprovaria só na segunda. Por isso as duas metades vivem no MESMO caso: separá-las convidaria a
 * segunda a ser esquecida, e é ela que prende a restrição ao par `(empresa_id, identificador)`. A
 * contagem crua entre elas é o que separa *"respondeu 422"* de *"respondeu 422 **e não gravou**"*, e
 * a leitura cruzada no fim é o que prova que o imóvel de B não vazou para a sessão de A — sem ela, a
 * segunda metade estaria satisfeita por uma borda que gravasse tudo numa empresa só.
 *
 * **CT-310 (b) — o par EM_CIRCULACAO / RETIRADO_DE_CIRCULACAO é a asserção que discrimina.** A recusa
 * antes da retirada e a recusa depois dela são o mesmo `422` no mesmo campo; o que muda é **um**
 * valor, e é ele que decide o que o usuário faz em seguida. Afirmar só a segunda deixaria passar um
 * discriminador constante; afirmar só a primeira deixaria passar uma unicidade **parcial**
 * (`WHERE retirado_em IS NULL`), que é o desenho que a decisão D4 do tech_spec rejeita por escrito —
 * com ele, o segundo imóvel nasceria e a **recirculação** do primeiro colidiria depois, num ponto em
 * que o usuário não teria como desfazer nada. A recirculação no fim é o que fecha o ciclo que a
 * mensagem promete.
 *
 * **CT-333 — a igualdade profunda entre os dois corpos é a prova, e o controle positivo é a outra
 * metade.** Dois `404` iguais provam que a borda não distingue "existe em outra empresa" de "não
 * existe"; sozinhos, eles seriam satisfeitos por uma borda que respondesse `404` a tudo — e é o
 * controle com o conjunto próprio, em `201`, que fecha essa saída. As contagens sob os DOIS contextos
 * são o que separa *"recusou"* de *"recusou e não gravou"*, inclusive do lado da empresa dona do
 * conjunto alheio.
 *
 * **CT-333 (b) — a igualdade do corpo inteiro depois do `PUT` recusado, nas DUAS famílias de recusa.**
 * Asserir apenas o `404` deixaria passar uma borda que gravasse metade da alteração antes de recusar
 * o destino; a releitura comparada por igualdade profunda com o estado anterior é o que prova que a
 * transação inteira desfez. E o `PUT` legítimo, com o conjunto irmão, é o controle sem o qual "o
 * `PUT` recusa" seria satisfeito por um `PUT` que recusa sempre.
 *
 * **A metade 3 é o que prende a tradução da unicidade à ALTERAÇÃO.** A porta envolve o `UPDATE` no
 * mesmo `gravarSobRestricaoDeUnicidade` da criação, e o docblock de `alterarImovel` declara por
 * escrito a razão — *"um caminho que só tratasse a criação deixaria a alteração devolver erro de
 * driver ao cliente"*. Nenhuma das outras metades exercita essa afirmação: a 1 reusa o identificador
 * do próprio imóvel, que não colide, e a 2 morre antes, na conferência do conjunto. Sem ela, um
 * envoltório removido **só** de `alterarImovel` sobreviveria à suíte inteira, e o `PUT` para um
 * identificador ocupado responderia `500` no lugar do `422` discriminado (medido em MT6-5). O
 * vizinho relido no fim é o controle: sem ele, "a recusa não gravou" ficaria verde sobre uma borda
 * que tivesse desfeito também a criação do vizinho.
 *
 * ---------------------------------------------------------------------------
 * DIVERGÊNCIA DECLARADA — `chave_extra` cai no campo padrão, e isso é MEDIDO
 * ---------------------------------------------------------------------------
 *
 * O Zod v4 reporta a chave desconhecida de um `strictObject` como `unrecognized_keys` com
 * `path: []` — o nome da chave viaja em `keys`, que `validar()` não lê. Esperar `campo: 'empresaId'`
 * aqui exigiria **mudar o comportamento** da função extraída na T4, que está sob a rede do `CT-343` e
 * cuja §3 é literal: *"esta é uma extração, não uma melhoria"*. O campo publicado é, portanto, o
 * `campoPadrao` daquele ponto de chamada (`'corpo'`). É a mesma medição que a T4 registrou em
 * `test/validacao.spec.ts` e em `test/campos-fechados.e2e.spec.ts`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os dois reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicados ao fonte de produção, com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso — este arquivo carrega `@sysloc/auth`, `@sysloc/db` e `@syslocbr/contracts` pela fronteira do
 * pacote, e um `vitest run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 102 casos, 0 falhas`;
 *   * **MA4 · a criação GRAVA antes de validar o corpo** — o controlador abre uma unidade de trabalho
 *     PRÓPRIA e grava um conjunto antes de `validar(esquemaDeConjuntoNovo, …)`. A unidade **commita**,
 *     e por isso a linha sobrevive à recusa que vem em seguida. Medido: `1 failed | 101 passed`, no
 *     **CT-345** — `expected 5 to be 2` na contagem crua. Sem a contagem, o caso passaria: os cinco
 *     `422`/`404` continuam exatamente como antes.
 *
 *     **A forma do mutante importa, e ela foi escolhida por medição.** Gravar antes de validar
 *     *dentro da mesma unidade* **não** é detectável por este caso, e é correto que não seja: o
 *     `throw` da validação desfaz a transação, nenhuma linha sobrevive, e não há defeito observável.
 *     O que a contagem discrimina é a escrita que **escapa** ao desfazimento — a que acontece numa
 *     unidade que já commitou —, que é a forma pela qual a recusa deixaria lixo no banco;
 *   * **MA5 · a alteração não persiste o nome** (`SET nome = coalesce(nome, ${dados.nome})`, que
 *     mantém `dados` em uso e compila): `1 failed | 101 passed`, no **CT-344** —
 *     `expected { nome: 'Edifício Aurora' } to deeply equal { nome: 'Edifício Aurora — Bloco A' }`.
 *     É a igualdade do objeto inteiro fazendo o trabalho: uma asserção de `status: 200` passaria;
 *   * **reversão** — os fontes foram restaurados e conferidos idênticos ao original por `diff`, e o
 *     controle voltou a `102 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T6 (2026-08-06) — os quatro reprovam
 * ---------------------------------------------------------------------------
 *
 * Mesmo protocolo, mesma invocação (`pnpm --filter @sysloc/api test`, nunca `vitest run` avulso).
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 108 casos, 0 falhas`;
 *   * **MT6-1 · o discriminador do conflito vira CONSTANTE** (`lerConflitoDoIdentificador` devolvendo
 *     sempre `'EM_CIRCULACAO'`, com o `retiradoEm` ainda em uso para compilar):
 *     `1 failed | 107 passed`, no **CT-310 (b)** — os dois corpos de recusa deixam de diferir. O
 *     `CT-310`, que só exercita o conflito com imóvel em circulação, **continua verde**: é a metade 2
 *     do caso (b) que discrimina, e é por isso que ela existe;
 *   * **MT6-2 · a criação deixa de conferir o alcance do conjunto** (a chamada a
 *     `exigirConjuntoAlcancavel` removida de `ImovelService.criar`): `1 failed | 107 passed`, no
 *     **CT-333** — `expected 500 to be 404`. É literalmente o modo de falha que a observação do card
 *     nomeia: *"a borda poderia responder `500` com o erro do banco vazando a existência do conjunto
 *     alheio — recusa correta e contrato errado"*. A chave estrangeira composta continua recusando a
 *     linha, e é essa a diferença entre segurança e contrato;
 *   * **MT6-3 · a ALTERAÇÃO deixa de conferir o alcance do conjunto** (mesma remoção em
 *     `ImovelService.alterar`): `1 failed | 107 passed`, no **CT-333 (b)**, com o mesmo
 *     `expected 500 to be 404`. Os dois mutantes são independentes — o `CT-333` fica verde neste, e o
 *     `CT-333 (b)` fica verde no anterior —, e é o par que prova que a conferência é das DUAS
 *     escritas, não de uma;
 *   * **MT6-4 · o `SAVEPOINT` da porta desaparece** (`tx.savepoint(cb)` trocado por `cb(tx)`):
 *     `2 failed | 106 passed`, no **CT-310** e no **CT-310 (b)**, os dois com
 *     `expected 500 to be 422`. Sem o ponto de retorno, a violação de unicidade aborta a transação e a
 *     leitura que descreve o conflito falha com `25P02` — a recusa continua acontecendo no banco, e o
 *     cliente recebe `500` no lugar do `422` discriminado;
 *   * **reversão** — os dois fontes foram restaurados e conferidos idênticos ao original por `diff`, e
 *     o controle voltou a `108 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA ADOÇÃO (2026-08-06) — MT6-5, e o MT6-6 que vive na outra suíte
 * ---------------------------------------------------------------------------
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 108 casos, 0 falhas`. A contagem **não muda** com
 *     a metade 3: ela estende o `CT-333 (b)`, e a razão está na §6.6 da task — a invariante é a mesma
 *     ("o `PUT` recusado não grava metade"), com uma segunda família de recusa;
 *   * **MT6-5 · o envoltório de unicidade sai SÓ da ALTERAÇÃO** (`alterarImovel` emitindo o `UPDATE`
 *     direto em `tx`, com `gravarSobRestricaoDeUnicidade` ainda em uso por `criarImovel`, o que
 *     compila e mantém a criação intacta): `1 failed | 107 passed`, no **CT-333 (b)** —
 *     `expected 500 to be 422`. É o defeito exato que o docblock de `alterarImovel` declara estar
 *     fechado (*"um caminho que só tratasse a criação deixaria a alteração devolver erro de driver ao
 *     cliente"*) e que, **antes desta metade, sobrevivia à suíte inteira**: os quatro mutantes
 *     anteriores não o alcançam, e o `CT-310` e o `CT-310 (b)` seguem verdes nele porque só exercitam
 *     a colisão na CRIAÇÃO;
 *   * **MT6-6 · o `SAVEPOINT` da porta desaparece**, aplicado contra a suíte de `@sysloc/db`:
 *     `1 failed | 45 passed`, no **CT-310 (c)** de `packages/db/test/unidade-de-trabalho.spec.ts`. Ele
 *     está registrado por extenso lá, junto do caso, porque é lá que a prova mora — a mesma mutação
 *     do MT6-4, medida contra a propriedade **de composição** em vez da forma da resposta HTTP;
 *   * **reversão** — o fonte foi restaurado e conferido idêntico ao original por `diff`, e os dois
 *     controles voltaram a `108 passed` (api) e `46 passed` (db).
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA T7 (2026-08-06) — MT7-7, e os seis que vivem na outra suíte
 * ---------------------------------------------------------------------------
 *
 * Mesmo protocolo, mesma invocação (`pnpm --filter @sysloc/api test`, nunca `vitest run` avulso).
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 110 casos, 0 falhas`. A contagem sobe de 108 para
 *     110 com o `CT-308` e o `CT-332`;
 *   * **MT7-7 · a escrita do cômodo responde SEM reler o imóvel** (`ComodoService.alterar` lendo o
 *     imóvel ANTES da gravação e devolvendo aquele retrato, o que compila e mantém a escrita
 *     intacta): `1 failed | 109 passed`, no **CT-308** — o corpo do `PUT` volta com
 *     `metragemTotal: 67.75` e o cômodo antigo. É o defeito exato que a promessa da §3 declara
 *     fechada (*"toda escrita de cômodo responde com o imóvel inteiro já recalculado, o que dispensa
 *     uma segunda ida"*), e ele é **invisível para a releitura**: o passo 4 do caso continuaria verde,
 *     porque o banco guardou o valor certo. Quem o pega é a asserção do corpo INTEIRO da resposta do
 *     `PUT`, e é por isso que ela existe além da releitura;
 *   * **os outros seis (MT7-1 a MT7-6)** vivem em `packages/db/test/metragem.spec.ts`, registrados
 *     por extenso junto dos casos que eles atingem — é lá que a prova mora, porque é lá que a soma, a
 *     ordem, a normalização e a atomicidade são propriedades observáveis;
 *   * **reversão** — o fonte foi restaurado e conferido idêntico ao original por `diff`, e os dois
 *     controles voltaram a `110 passed` (api) e `52 passed` (db).
 *
 * ---------------------------------------------------------------------------
 * MT7-8 (2026-08-06) — a contenção do sub-recurso, medida nas DUAS instruções
 * ---------------------------------------------------------------------------
 *
 * Mesmo protocolo, mesma invocação (`pnpm test`, nunca `vitest run` avulso). Ele nasceu de uma
 * **lacuna medida**: até as metades 4 e 5 existirem, o `AND imovel_id = …` de `alterarComodo` e de
 * `removerComodo` era prometido em três docblocks e **nenhuma asserção o exercitava** — apagá-lo das
 * duas instruções deixava os 505 casos verdes. A metade 3 não o cobre porque o imóvel dela é de
 * OUTRA empresa, e ali quem devolve zero linhas é a política de `negocio.comodo`.
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 110 casos, 0 falhas` (`53` em `@sysloc/db`, com o
 *     `CT-305 (b)`). A contagem da api **não muda** com as metades 4 e 5: elas estendem o `CT-332`,
 *     cuja invariante é a mesma — *a recusa responde o mesmo `404` e não grava nada* —, com um eixo
 *     a mais;
 *   * **MT7-8 · o `AND imovel_id` sai das DUAS instruções** (com `void imovelId` para o parâmetro
 *     seguir em uso e o mutante compilar): `1 failed | 109 passed`, no **CT-332**, em
 *     `expected 200 to be 404` na metade 4 — a rota do imóvel Y devolve `200` com o imóvel Y depois
 *     de ter alterado o cômodo de X;
 *   * **MT7-8 (a) · a cláusula sai SÓ de `alterarComodo`**: `1 failed | 109 passed`, no **CT-332**,
 *     na **linha da metade 4**. O `@sysloc/db` fica verde nos 53 — o `CT-309` e o `CT-317`
 *     endereçam os cômodos pelo imóvel certo, e nenhum deles discrimina a cláusula;
 *   * **MT7-8 (b) · a cláusula sai SÓ de `removerComodo`**: `1 failed | 109 passed`, no **CT-332**,
 *     na **linha da metade 5** — a metade 4 atravessa o mutante inteira. **É este par que
 *     justifica as duas metades existirem**: uma só deixaria a outra instrução sem rede, e a falha
 *     de cada variante aponta para uma linha diferente do caso;
 *   * **reversão** — `packages/db/src/comodo.ts` foi restaurado e conferido idêntico ao original por
 *     `diff -q`, e o controle voltou a `110 passed` (api) e `53 passed` (db).
 *
 * **O que NENHUM mutante de produção alcança, e é declarado em vez de escondido**: a linha
 * `id === id.toLowerCase()`. O identificador vem do `RETURNING` do banco, e o Postgres renderiza
 * `uuid` **sempre** em minúsculas — não há mudança no fonte desta fatia capaz de fazê-la reprovar.
 * Ela é **rede** (P4 do Protocolo Antirregressão), e não prova: existe para que uma borda futura que
 * passe a compor o identificador na aplicação — em vez de ecoar o do banco — seja pega aqui. A prova
 * comportamental da canonização é a do `:id` de ENTRADA, e ela é do `CT-237`, na F1.
 *
 * ===========================================================================
 * Precondição privilegiada — pelo caminho REAL, sem símbolo novo e sem cookie forjado
 * ===========================================================================
 *
 * As sessões que agem são de pessoas `USUARIO_EMPRESA` **da carga** — uma em cada empresa —, abertas
 * pela rota pública de entrada. A matriz do perfil delas é o piso (`TELA:resumo`), de modo que as
 * chaves abaixo **faltam de fato** e a concessão por `escreverAjustes` — sob o contexto de tenant da
 * empresa correspondente, dentro da unidade de trabalho e com `validarCoerenciaDeAjustes` — é
 * precondição real, e não ruído:
 *
 *   * `TELA:imoveis` — a área que a classe dos dois controladores exige;
 *   * `ACAO:excluir_cadastro` — a ação sensível que as duas rotas de circulação exigem, e sem a qual
 *     o `CT-310 (b)` não conseguiria retirar imóvel algum;
 *   * `TELA:cadastros` — **obrigatória junto da ação**, e não por escolha deste arquivo: a RN-02 do
 *     catálogo mapeia `ACAO:excluir_cadastro → TELA:cadastros`, e `validarCoerenciaDeAjustes` recusa
 *     o conjunto que deixasse a ação órfã. Conceder a ação sem a área é irrepresentável pelo caminho
 *     legítimo — é o mesmo arranjo, e a mesma ordem, de `circulacao-de-cadastro.e2e.spec.ts`.
 *
 * O efetivo é **afirmado** por `GET /v1/sessao` antes do fluxo, para as **duas** sessões: sem essa
 * linha, um `403` inesperado seria indistinguível de um defeito das rotas.
 *
 * **Nenhuma rota recebe `empresaId`** — a empresa de cada operação sai da sessão, e é exatamente isso
 * que o `CT-310` e o `CT-333` exploram. Nada é acrescentado a `apps/api/src/**` para que estas provas
 * existam (Iron Law #6), nenhuma chave é concedida por escrita direta na tabela, e a retirada do
 * `CT-310 (b)` acontece pela ROTA real — nunca por um `UPDATE` em `retirado_em`.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real** (`criarAplicacao`,
 * de `src/main.ts`). A porta é **reservada** (trava atômica), e não dinâmica, porque o arcabouço
 * confere a origem das requisições com cookie contra o endereço base, composto a partir da porta
 * CONFIGURADA.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de conjuntos — a superfície da T5. */
const CAMINHO_DA_COLECAO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`;

/** Caminho, relativo à raiz, da coleção de imóveis — a superfície da T6. */
const CAMINHO_DOS_IMOVEIS_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** A chave que abre esta superfície — a que falta ao perfil das pessoas que agem. */
const CHAVE_DA_AREA: ChaveDoCatalogo = 'TELA:imoveis';

/**
 * O arranjo concedido às duas sessões.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum. `TELA:cadastros`
 * está aqui por obrigação do catálogo, não por escolha — ver a precondição privilegiada no cabeçalho.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:imoveis',
  'TELA:cadastros',
  'ACAO:excluir_cadastro',
];

/** A ação sensível que as duas rotas de circulação exigem — afirmada no efetivo, nunca suposta. */
const ACAO_DE_CIRCULACAO: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/** Forma canônica do UUID, em minúsculas — a chave exposta destas entidades (ADR-0017). */
const PADRAO_UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Um UUID bem formado que não corresponde a conjunto algum — o controle do `404`. */
const UUID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** Um identificador que não é UUID — o controle do `422` sem tocar o banco. */
const IDENTIFICADOR_MALFORMADO = 'nao-e-uuid';

/**
 * O campo que a recusa por unicidade nomeia, como o cliente o conhece (ADR-0017).
 *
 * Literal, e **não** importado do serviço que o publica: derivá-lo da mesma fonte que o SUT usa faria
 * a asserção concordar consigo mesma, e uma renomeação silenciosa passaria nos dois lados.
 */
const CAMPO_DO_IDENTIFICADOR_MUNICIPAL = 'identificadorMunicipal';

/**
 * Os identificadores municipais dos casos da T6 — **um por caso**, e a separação é o que garante a
 * independência entre eles.
 *
 * A unicidade é por empresa e **alcança os retirados**, de modo que um valor reaproveitado entre dois
 * casos faria o segundo depender da ordem de execução do primeiro (AP-08). O do `CT-310` repete a
 * cadeia do card, com a máscara que a prefeitura emite: o produto guarda o identificador como ele é.
 */
const IDENTIFICADOR_EM_DISPUTA = '12345.678.9012-3';
const IDENTIFICADOR_DO_RETIRADO = '12345.678.9012-4';
const IDENTIFICADOR_DO_ALHEIO = '12345.678.9012-5';
const IDENTIFICADOR_DO_INEXISTENTE = '12345.678.9012-6';
const IDENTIFICADOR_DO_PROPRIO = '12345.678.9012-7';
const IDENTIFICADOR_DA_MUDANCA = '12345.678.9012-8';
/**
 * O identificador de um **segundo** imóvel da empresa A, que o `PUT` do `CT-333 (b)` tenta tomar.
 *
 * Ele existe porque a colisão da ALTERAÇÃO não é exercitável com `IDENTIFICADOR_DA_MUDANCA`: aquele
 * é o identificador do próprio imóvel alterado, e apontar para si mesmo não colide com coisa alguma.
 */
const IDENTIFICADOR_DO_VIZINHO = '12345.678.9012-9';

/** O identificador do imóvel do `CT-308` — exclusivo, pela mesma razão dos anteriores (AP-08). */
const IDENTIFICADOR_DOS_COMODOS = '12345.678.9013-0';

/**
 * O identificador do imóvel do `CT-332`, usado nas **duas** empresas.
 *
 * Repeti-lo entre A e B é deliberado e não colide: a unicidade é por empresa, e o `CT-310` já prova
 * essa metade. O que este caso precisa é de um imóvel em B para endereçar com o `:comodoId` de A.
 */
const IDENTIFICADOR_DA_RECUSA_DE_COMODO = '12345.678.9013-1';

/**
 * O identificador do **segundo** imóvel da empresa A no `CT-332` — o que endereça o cômodo do
 * primeiro nas metades 4 e 5.
 *
 * Ele é exclusivo, e não reaproveitado de `IDENTIFICADOR_DA_RECUSA_DE_COMODO`: os dois imóveis vivem
 * na MESMA empresa, e ali a unicidade recusaria o segundo (AP-08 à parte, o caso nem chegaria a
 * existir).
 */
const IDENTIFICADOR_DO_OUTRO_IMOVEL_DE_A = '12345.678.9013-2';

/**
 * Os três cômodos do cenário `varios_comodos` do golden (total `67.75`), na ordem de acréscimo.
 *
 * `posicao` **não** aparece: ela é atribuída pelo servidor, e o corpo é `strictObject` — enviá-la
 * recusaria a requisição, que é justamente a garantia. Os valores repetem os do golden de metragem
 * porque é sobre ele que a equivalência com o legado é medida em `packages/db/test/metragem.spec.ts`.
 */
const COMODOS_DO_CASO: readonly (Record<string, unknown> & { nomeComodo: string })[] = [
  { nomeComodo: 'Sala', metragem: 25.5, observacoes: null },
  { nomeComodo: 'Quarto', metragem: 30.25, observacoes: null },
  { nomeComodo: 'Cozinha', metragem: 12, observacoes: null },
];

/** UUID bem formado que não corresponde a conjunto algum — o valor do card do `CT-333`. */
const CONJUNTO_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

/**
 * A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:imoveis`, que é o que torna a concessão do
 * arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial da de A.
 *
 * Ela é a outra ponta das duas provas de isolamento da T6. Nenhuma rota recebe a empresa dela: o que
 * separa uma sessão da outra é o cookie, e é a guarda que publica o contexto a partir da sessão.
 */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  cookieDeB = await entrar(QUEM_AGE_EM_B.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE_EM_B.id, EMPRESA_B.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas
  // abaixo seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(CHAVE_DA_AREA);
    expect(sessao.acoes).toContain(ACAO_DE_CIRCULACAO);
  }
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('cadastro de imóveis pelas rotas de conjunto (T5)', () => {
  it(
    'CT-344 — o ciclo criar → ler → alterar preserva o enviado e devolve o identificador canonizado',
    async () => {
      // --- Passo 1: criar ------------------------------------------------------------------------
      const criacao = await pedir(CAMINHO_DA_COLECAO, {
        metodo: 'POST',
        cookie,
        corpo: { nome: 'Edifício Aurora' },
      });

      expect(criacao.status).toBe(201);

      const criado = criacao.corpo as ConjuntoPublicado;
      // Corpo INTEIRO por igualdade: um campo a mais — a coluna `empresa_id` vazando, por exemplo —
      // reprova aqui, e não numa asserção de presença.
      expect(criado).toEqual({
        id: criado.id,
        nome: 'Edifício Aurora',
        retiradoEm: null,
      });
      // E o `id` é de fato um UUID canônico, e não uma cadeia qualquer que a linha acima aceitaria
      // por concordar consigo mesma.
      expect(criado.id).toMatch(PADRAO_UUID_CANONICO);
      expect(criado.id).toBe(criado.id.toLowerCase());

      // --- Passo 2: ler --------------------------------------------------------------------------
      const primeiraLeitura = await pedir(`${CAMINHO_DA_COLECAO}/${criado.id}`, { cookie });
      expect(primeiraLeitura.status).toBe(200);
      // Profundamente igual ao da criação: a leitura devolve o que a escrita gravou, campo a campo.
      expect(primeiraLeitura.corpo).toEqual(criado);

      // --- Passo 3: alterar ----------------------------------------------------------------------
      const alteracao = await pedir(`${CAMINHO_DA_COLECAO}/${criado.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: { nome: 'Edifício Aurora — Bloco A' },
      });

      expect(alteracao.status).toBe(200);
      // O MESMO `id`, o nome novo, e a marca de circulação intocada — o `PUT` não move a circulação.
      expect(alteracao.corpo).toEqual({
        id: criado.id,
        nome: 'Edifício Aurora — Bloco A',
        retiradoEm: null,
      });

      // --- Passo 4: reler ------------------------------------------------------------------------
      const segundaLeitura = await pedir(`${CAMINHO_DA_COLECAO}/${criado.id}`, { cookie });
      expect(segundaLeitura.status).toBe(200);
      // A asserção do objeto inteiro é o que impede a leitura de devolver o nome ANTIGO com um campo
      // a mais mascarando a divergência (ADR-0017).
      expect(segundaLeitura.corpo).toEqual(alteracao.corpo);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-345 — as recusas nomeiam o campo culpado e nenhuma delas grava linha',
    async () => {
      // --- Passo 1: a contagem crua ANTES --------------------------------------------------------
      const antes = await contarConjuntos();

      // --- Passo 2 e 3: as cinco requisições, cada uma com o desfecho declarado por linha ---------
      for (const recusa of RECUSAS) {
        const resposta = await pedir(recusa.alvo(), {
          ...(recusa.metodo === undefined ? {} : { metodo: recusa.metodo }),
          cookie,
          ...(recusa.corpo === undefined ? {} : { corpo: recusa.corpo }),
        });

        expect(resposta.status, recusa.rotulo).toBe(recusa.status);
        // Corpo INTEIRO por igualdade. É esta linha que impede a recusa de ecoar o valor recusado
        // num campo novo — o vetor que a T4 mediu e que `detalhes` reabriria.
        expect(resposta.corpo, recusa.rotulo).toEqual(recusa.esperado);
      }

      // --- Passo 4: a contagem crua DEPOIS -------------------------------------------------------
      //
      // É ela que separa "respondeu 422" de "respondeu 422 e não gravou": sem esta comparação, o caso
      // passaria com um controlador que gravasse antes de validar.
      expect(await contarConjuntos()).toBe(antes);
    },
    LIMITE_CASO_MS,
  );
});

describe('cadastro de imóveis pelas rotas de imóvel (T6)', () => {
  it(
    'CT-310 — o identificador municipal não se repete na empresa, e se repete entre empresas',
    async () => {
      const conjuntoDeA = await criarConjuntoPor(cookie, 'Edifício Aurora — CT-310');
      const conjuntoDeB = await criarConjuntoPor(cookieDeB, 'Edifício Bela Vista — CT-310');
      const antesEmA = await contarImoveis(EMPRESA_A.id);

      // --- Passo 1: criar na empresa A -----------------------------------------------------------
      const criacao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoDeA, IDENTIFICADOR_EM_DISPUTA),
      });

      expect(criacao.status).toBe(201);

      const criado = criacao.corpo as ImovelPublicado;
      // Corpo INTEIRO por igualdade: um campo a mais — a coluna `empresa_id` vazando, por exemplo —
      // reprova aqui, e não numa asserção de presença. `comodos` e `metragemTotal` entram porque são
      // contrato publicado desde já: o imóvel sem cômodo devolve o agregado vazio, e não a ausência
      // do campo, que é o que o cliente consome.
      //
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e o corpo esperado é que descrevia o
      // imóvel **antes** da T9. `esquemaDoImovel` ganhou `contratoVigente` por decisão declarada da
      // fatia de contratos (ADR-0016 — um esquema só, e o campo aparece nas três superfícies por
      // consequência), e o imóvel recém-criado não tem contrato algum, de modo que o valor verdadeiro
      // é `null`. É **crescimento de esquema**: a asserção continua sendo igualdade de corpo INTEIRO,
      // nenhum campo saiu, nenhuma igualdade virou asserção de presença, e um campo a mais segue
      // reprovando aqui.
      expect(criado).toEqual({
        id: criado.id,
        conjuntoId: conjuntoDeA,
        nomeImovel: 'Ap 101',
        identificadorMunicipal: IDENTIFICADOR_EM_DISPUTA,
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
        comodos: [],
        metragemTotal: 0,
        contratoVigente: null,
        retiradoEm: null,
      });
      // E o `id` é de fato um UUID canônico, e não uma cadeia qualquer que a linha acima aceitaria
      // por concordar consigo mesma.
      expect(criado.id).toMatch(PADRAO_UUID_CANONICO);

      // --- Passos 2 e 3: repetir na MESMA empresa, e afirmar o corpo inteiro da recusa ------------
      //
      // O nome do imóvel muda de propósito: o que está sob prova é a unicidade do identificador
      // municipal, e não a de um corpo repetido inteiro.
      const repeticao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoDeA, IDENTIFICADOR_EM_DISPUTA, { nomeImovel: 'Ap 102' }),
      });

      expect(repeticao.status).toBe(422);
      // Corpo INTEIRO por igualdade (ADR-0017): o código, a mensagem canônica, o campo culpado e o
      // discriminador do conflito — e NADA mais. É esta linha que impede a recusa de ecoar o
      // identificador recusado num campo novo, e é ela que prende `detalhes.conflito` ao nome que a
      // §10.1 da tech spec fixou antes da implementação.
      expect(repeticao.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_IDENTIFICADOR_MUNICIPAL,
        detalhes: { conflito: 'EM_CIRCULACAO' },
      });

      // --- Passo 4: a contagem crua da empresa A -------------------------------------------------
      //
      // Um imóvel a mais, e só um: a recusa não gravou. Sem esta linha, o caso passaria com uma borda
      // que gravasse a segunda linha e recusasse depois.
      expect(await contarImoveis(EMPRESA_A.id)).toBe(antesEmA + 1);

      // --- Passo 5: a MESMA cadeia, partindo da empresa B ----------------------------------------
      //
      // É esta metade que discrimina a unicidade POR EMPRESA da unicidade global — o defeito que o
      // PRD nomeia no sistema antigo. Nenhum campo do corpo diz qual é a empresa: ela vem da sessão.
      const emB = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeImovel(conjuntoDeB, IDENTIFICADOR_EM_DISPUTA),
      });

      expect(emB.status).toBe(201);

      const criadoEmB = emB.corpo as ImovelPublicado;
      expect(criadoEmB.identificadorMunicipal).toBe(IDENTIFICADOR_EM_DISPUTA);
      expect(criadoEmB.id).not.toBe(criado.id);

      // --- Passo 6: o imóvel de B não é visível para a sessão de A -------------------------------
      const leituraCruzada = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criadoEmB.id}`, {
        cookie,
      });

      expect(leituraCruzada.status).toBe(404);
      expect(leituraCruzada.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // O controle da linha acima: a MESMA sessão alcança o imóvel dela. Sem ele, uma borda que
      // respondesse `404` a toda leitura passaria o passo 6.
      const leituraPropria = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, { cookie });
      expect(leituraPropria.status).toBe(200);
      expect(leituraPropria.corpo).toEqual(criado);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-310 (b) — a unicidade alcança o imóvel retirado, e a recusa discrimina o estado dele',
    async () => {
      const conjunto = await criarConjuntoPor(cookie, 'Edifício Aurora — CT-310 (b)');
      const antes = await contarImoveis(EMPRESA_A.id);

      const criacao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjunto, IDENTIFICADOR_DO_RETIRADO),
      });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as ImovelPublicado;

      // --- Metade 1: enquanto ele circula, o conflito é EM_CIRCULACAO ----------------------------
      const enquantoCircula = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjunto, IDENTIFICADOR_DO_RETIRADO, { nomeImovel: 'Ap 202' }),
      });

      expect(enquantoCircula.status).toBe(422);
      expect(enquantoCircula.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_IDENTIFICADOR_MUNICIPAL,
        detalhes: { conflito: 'EM_CIRCULACAO' },
      });

      // --- A retirada, pela ROTA real ------------------------------------------------------------
      const retirada = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(retirada.status).toBe(200);
      const retirado = retirada.corpo as ImovelPublicado;
      // A marca é uma data-hora de verdade, e não uma cadeia qualquer: sem esta linha, `retiradoEm`
      // poderia sair como `'sim'` e a metade seguinte continuaria passando.
      expect(retirado.retiradoEm).not.toBeNull();
      expect(Number.isNaN(Date.parse(retirado.retiradoEm ?? ''))).toBe(false);

      // --- Metade 2: retirado, o conflito muda de valor — e é ISTO que discrimina ----------------
      //
      // Um discriminador constante passaria a metade 1 e reprova aqui. Uma unicidade PARCIAL
      // (`WHERE retirado_em IS NULL`) aceitaria a criação com `201` e reprovaria no status.
      const depoisDaRetirada = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjunto, IDENTIFICADOR_DO_RETIRADO, { nomeImovel: 'Ap 303' }),
      });

      expect(depoisDaRetirada.status).toBe(422);
      expect(depoisDaRetirada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_IDENTIFICADOR_MUNICIPAL,
        detalhes: { conflito: 'RETIRADO_DE_CIRCULACAO' },
      });

      // Nenhuma das duas recusas gravou: o imóvel da empresa A é UM, o mesmo do começo do caso.
      expect(await contarImoveis(EMPRESA_A.id)).toBe(antes + 1);

      // --- A saída que a mensagem promete: recircular --------------------------------------------
      //
      // O `RETIRADO_DE_CIRCULACAO` só é útil se a reativação existir. Esta é a outra ponta dela, e é
      // o que fecha o ciclo que a ADR-0014 desenha.
      const recirculacao = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}/recirculacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(recirculacao.status).toBe(200);
      expect(recirculacao.corpo).toEqual({ ...criado, retiradoEm: null });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-333 — conjunto de outra empresa responde o MESMO 404 de conjunto inexistente',
    async () => {
      const conjuntoDeA = await criarConjuntoPor(cookie, 'Edifício Aurora — CT-333');
      const conjuntoDeB = await criarConjuntoPor(cookieDeB, 'Edifício Bela Vista — CT-333');

      // --- Passo 1: as contagens sob os DOIS contextos -------------------------------------------
      const antesEmA = await contarImoveis(EMPRESA_A.id);
      const antesEmB = await contarImoveis(EMPRESA_B.id);

      // --- Passo 2: da sessão de B, o conjunto de A ----------------------------------------------
      //
      // O identificador do conjunto alheio veio da resposta da sessão de A — lido no contexto do
      // dono, como manda o molde do CT-006. A tentativa parte de B.
      const alheio = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeImovel(conjuntoDeA, IDENTIFICADOR_DO_ALHEIO),
      });

      // --- Passo 3: da sessão de B, um conjunto que não existe em lugar nenhum -------------------
      const inexistente = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeImovel(CONJUNTO_INEXISTENTE, IDENTIFICADOR_DO_INEXISTENTE),
      });

      // --- Passo 4: os dois corpos são profundamente iguais --------------------------------------
      expect(alheio.status).toBe(404);
      expect(inexistente.status).toBe(alheio.status);
      expect(alheio.corpo).toEqual(inexistente.corpo);
      // E o corpo é o canônico — sem esta linha, dois `500` idênticos passariam a igualdade acima.
      expect(alheio.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // --- Passo 5: o controle positivo, com o conjunto próprio ---------------------------------
      const proprio = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeImovel(conjuntoDeB, IDENTIFICADOR_DO_PROPRIO),
      });

      expect(proprio.status).toBe(201);
      expect((proprio.corpo as ImovelPublicado).conjuntoId).toBe(conjuntoDeB);

      // --- Passo 6: as contagens sob os dois contextos, de novo ----------------------------------
      //
      // A da empresa A não se moveu — a tentativa recusada não gravou lá, que é onde o conjunto
      // apontado de fato existe. A de B cresceu apenas pelo controle.
      expect(await contarImoveis(EMPRESA_A.id)).toBe(antesEmA);
      expect(await contarImoveis(EMPRESA_B.id)).toBe(antesEmB + 1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-333 (b) — o PUT muda o imóvel de conjunto, e o destino alheio e o identificador ocupado recusam sem gravar nada',
    async () => {
      const conjuntoDeOrigem = await criarConjuntoPor(cookie, 'Edifício Aurora — origem');
      const conjuntoDeDestino = await criarConjuntoPor(cookie, 'Edifício Aurora — destino');
      const conjuntoDeB = await criarConjuntoPor(cookieDeB, 'Edifício Bela Vista — CT-333 (b)');

      const criacao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoDeOrigem, IDENTIFICADOR_DA_MUDANCA),
      });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as ImovelPublicado;

      // --- Metade 1: mudar de conjunto é operação legítima do `PUT` completo ---------------------
      const mudanca = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeImovelAlterado(conjuntoDeDestino, IDENTIFICADOR_DA_MUDANCA),
      });

      expect(mudanca.status).toBe(200);
      // O MESMO `id`, o conjunto novo, e nada mais mudou.
      expect(mudanca.corpo).toEqual({ ...criado, conjuntoId: conjuntoDeDestino });

      // A leitura seguinte reflete a mudança: sem ela, um `PUT` que só ecoasse o corpo passaria.
      const leitura = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, { cookie });
      expect(leitura.status).toBe(200);
      expect(leitura.corpo).toEqual(mudanca.corpo);

      // --- Metade 2: o destino de outra empresa recusa com o MESMO 404 --------------------------
      const paraOAlheio = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeImovelAlterado(conjuntoDeB, IDENTIFICADOR_DA_MUDANCA),
      });

      expect(paraOAlheio.status).toBe(404);
      expect(paraOAlheio.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // E o imóvel ficou como estava, campo por campo: a recusa do destino não gravou metade da
      // alteração. Sem esta linha, o `404` sozinho seria satisfeito por uma borda que gravasse
      // primeiro e recusasse depois.
      const releitura = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, { cookie });
      expect(releitura.status).toBe(200);
      expect(releitura.corpo).toEqual(mudanca.corpo);

      // --- Metade 3: o identificador municipal JÁ OCUPADO recusa o mesmo PUT -------------------
      //
      // A outra família de recusa da MESMA invariante — "o `PUT` recusado não grava metade" —, e a
      // única que exercita a tradução da unicidade na ALTERAÇÃO. As metades 1 e 2 não a alcançam:
      // a 1 reusa o identificador do próprio imóvel (que não colide com ninguém) e a 2 morre antes,
      // no `404` do conjunto. Um caminho que só envolvesse a CRIAÇÃO na tradução deixaria este `PUT`
      // devolver erro de driver — `500` — em vez do `422` discriminado.
      const vizinho = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoDeDestino, IDENTIFICADOR_DO_VIZINHO, { nomeImovel: 'Ap 404' }),
      });

      expect(vizinho.status).toBe(201);

      const paraOOcupado = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeImovelAlterado(conjuntoDeDestino, IDENTIFICADOR_DO_VIZINHO),
      });

      expect(paraOOcupado.status).toBe(422);
      // Corpo INTEIRO por igualdade (ADR-0017), o MESMO da recusa na criação: o código, a mensagem
      // canônica, o campo culpado e o discriminador — e nada mais. Duas traduções da mesma colisão
      // ficariam livres para divergir no código, no campo e no nome do discriminador, e os três são
      // contrato publicado; é esta linha que as prende ao mesmo corpo.
      expect(paraOOcupado.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_IDENTIFICADOR_MUNICIPAL,
        detalhes: { conflito: 'EM_CIRCULACAO' },
      });

      // E, de novo, nada foi gravado pela metade: o imóvel continua com o identificador dele.
      const depoisDoOcupado = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${criado.id}`, { cookie });
      expect(depoisDoOcupado.status).toBe(200);
      expect(depoisDoOcupado.corpo).toEqual(mudanca.corpo);

      // O controle da linha acima, sem o qual "a recusa não gravou" seria satisfeito por uma borda
      // que tivesse desfeito também a criação do vizinho: ele continua lá, com o identificador que
      // recusou o `PUT`.
      const vizinhoDepois = await pedir(
        `${CAMINHO_DOS_IMOVEIS_DA_API}/${(vizinho.corpo as ImovelPublicado).id}`,
        { cookie },
      );
      expect(vizinhoDepois.status).toBe(200);
      expect(vizinhoDepois.corpo).toEqual(vizinho.corpo);
    },
    LIMITE_CASO_MS,
  );
});

describe('cômodos pelas rotas de `/v1/imoveis/:id/comodos` (T7)', () => {
  it(
    'CT-308 — alterar um cômodo isoladamente muda a metragem total, sem reenviar o imóvel',
    async () => {
      const conjuntoId = await criarConjuntoPor(cookie, 'Edifício Aurora — CT-308');

      // --- Passo 1: o imóvel do cenário `varios_comodos`, montado PELAS ROTAS -------------------
      //
      // Os três cômodos entram um a um, pela rota de acréscimo, e as posições saem do servidor. A
      // resposta de cada acréscimo é o imóvel INTEIRO já recalculado — é o que dispensa a segunda
      // ida —, e o total é conferido no fim do passo, não suposto.
      const criacao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoId, IDENTIFICADOR_DOS_COMODOS),
      });

      expect(criacao.status).toBe(201);
      const imovelId = (criacao.corpo as ImovelPublicado).id;
      const comodos = `${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}/comodos`;

      for (const comodo of COMODOS_DO_CASO) {
        const acrescimo = await pedir(comodos, { metodo: 'POST', cookie, corpo: comodo });
        expect(acrescimo.status, comodo.nomeComodo).toBe(201);
      }

      // --- Passo 2: a leitura ANTES -------------------------------------------------------------
      //
      // Corpo INTEIRO do vetor de cômodos por igualdade, e não só o total: sem ele, uma borda que
      // somasse certo e embaralhasse, perdesse ou duplicasse cômodos passaria. O `id` de cada um é
      // capturado aqui, e é ele que a alteração endereça — nenhum identificador é forjado.
      const antes = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}`, { cookie });
      expect(antes.status).toBe(200);

      const imovelAntes = antes.corpo as ImovelPublicado;
      expect(imovelAntes.metragemTotal).toBe(67.75);
      expect(semIdentificador(imovelAntes)).toEqual([
        { nomeComodo: 'Sala', metragem: 25.5, posicao: 1, observacoes: null },
        { nomeComodo: 'Quarto', metragem: 30.25, posicao: 2, observacoes: null },
        { nomeComodo: 'Cozinha', metragem: 12, posicao: 3, observacoes: null },
      ]);

      const quartoId = (imovelAntes.comodos[1] as ComodoPublicado).id;

      // --- Passo 3: alterar SÓ o cômodo ---------------------------------------------------------
      //
      // Nenhuma outra rota é chamada entre as duas leituras — em particular, **o imóvel não é
      // reenviado**. É esse o invariante do caso: a metragem total muda por uma escrita sobre o
      // sub-recurso, e o agregado é recalculado na leitura.
      const alteracao = await pedir(`${comodos}/${quartoId}`, {
        metodo: 'PUT',
        cookie,
        corpo: { nomeComodo: 'Quarto', metragem: 40.25, observacoes: null },
      });

      expect(alteracao.status).toBe(200);
      // A escrita responde com o imóvel INTEIRO já recalculado, e a asserção é o corpo completo: é
      // ela que prova a promessa de "dispensa uma segunda ida" — e não apenas que o `PUT` respondeu.
      expect(alteracao.corpo).toEqual({
        ...imovelAntes,
        comodos: [
          imovelAntes.comodos[0],
          { id: quartoId, nomeComodo: 'Quarto', metragem: 40.25, posicao: 2, observacoes: null },
          imovelAntes.comodos[2],
        ],
        metragemTotal: 77.75,
      });

      // --- Passo 4: reler -----------------------------------------------------------------------
      //
      // A releitura é o que separa "a resposta do `PUT` calculou certo" de "o banco guarda o que a
      // resposta disse": uma borda que devolvesse o total novo sem persistir a metragem reprova aqui.
      const depois = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}`, { cookie });
      expect(depois.status).toBe(200);

      const imovelDepois = depois.corpo as ImovelPublicado;
      expect(imovelDepois.metragemTotal).toBe(77.75);
      expect(typeof imovelDepois.metragemTotal).toBe('number');

      // Os demais cômodos INTACTOS e na MESMA ordem — inclusive os identificadores, que é o que
      // prova que a alteração não os recriou. É a asserção que pega a implementação que recalcula o
      // agregado e, de quebra, embaralha ou perde os vizinhos.
      expect(imovelDepois.comodos).toEqual([
        imovelAntes.comodos[0],
        { id: quartoId, nomeComodo: 'Quarto', metragem: 40.25, posicao: 2, observacoes: null },
        imovelAntes.comodos[2],
      ]);

      // E o imóvel em si não foi tocado pela rota do cômodo: o corpo inteiro, menos as duas
      // derivadas, é byte a byte o de antes.
      expect({ ...imovelDepois, comodos: [], metragemTotal: 0 }).toEqual({
        ...imovelAntes,
        comodos: [],
        metragemTotal: 0,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-332 — metragem inválida, cômodo de empresa alheia e cômodo de outro imóvel da MESMA empresa são recusados, e o total não muda',
    async () => {
      const conjuntoId = await criarConjuntoPor(cookie, 'Edifício Aurora — CT-332');
      const criacao = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoId, IDENTIFICADOR_DA_RECUSA_DE_COMODO),
      });

      expect(criacao.status).toBe(201);
      const imovelId = (criacao.corpo as ImovelPublicado).id;
      const comodos = `${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}/comodos`;

      const acrescimo = await pedir(comodos, {
        metodo: 'POST',
        cookie,
        corpo: { nomeComodo: 'Sala', metragem: 25.5, observacoes: null },
      });
      expect(acrescimo.status).toBe(201);

      // O cômodo INTEIRO, e não só o identificador: é ele que a releitura do fim compara por
      // igualdade para provar que nenhuma das cinco recusas o tocou.
      const comodoDeA = (acrescimo.corpo as ImovelPublicado).comodos[0] as ComodoPublicado;
      const comodoId = comodoDeA.id;

      // --- Metade 1: metragem NEGATIVA recusa antes do banco -------------------------------------
      //
      // Corpo INTEIRO por igualdade: a recusa nomeia `metragem` e **não ecoa o valor recusado**.
      // O campo vem do caminho que o Zod reporta, e é ele que o formulário destaca.
      const negativa = await pedir(comodos, {
        metodo: 'POST',
        cookie,
        corpo: { nomeComodo: 'Impossível', metragem: -1, observacoes: null },
      });

      expect(negativa.status).toBe(422);
      expect(negativa.corpo).toEqual(campoInvalido('metragem'));

      // --- Metade 2: `metragem: null` EXPLÍCITO é recusado --------------------------------------
      //
      // A RN-02 diz que metragem **ausente** vale zero; `null` explícito é afirmar um valor que não
      // existe, e o contrato o recusa. Sem esta metade, um esquema que aceitasse `null` — e o
      // deixasse chegar à coluna `NOT NULL` como `500` — passaria.
      const nula = await pedir(comodos, {
        metodo: 'POST',
        cookie,
        corpo: { nomeComodo: 'Nulo', metragem: null, observacoes: null },
      });

      expect(nula.status).toBe(422);
      expect(nula.corpo).toEqual(campoInvalido('metragem'));

      // --- Metade 3: o cômodo de imóvel ALHEIO responde 404, sem revelar -------------------------
      //
      // O imóvel é de outra empresa, e o `:comodoId` é de um cômodo que existe — em A. A recusa é o
      // MESMO corpo de cômodo inexistente: a borda não distingue "é de outro" de "não existe", e é
      // essa indistinção que impede a rota de virar oráculo de existência sobre o cadastro alheio.
      const conjuntoDeB = await criarConjuntoPor(cookieDeB, 'Edifício Bela Vista — CT-332');
      const emB = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeImovel(conjuntoDeB, IDENTIFICADOR_DA_RECUSA_DE_COMODO),
      });
      expect(emB.status).toBe(201);

      const alheio = await pedir(
        `${CAMINHO_DOS_IMOVEIS_DA_API}/${(emB.corpo as ImovelPublicado).id}/comodos/${comodoId}`,
        { metodo: 'PUT', cookie: cookieDeB, corpo: { nomeComodo: 'Roubado', metragem: 1 } },
      );

      expect(alheio.status).toBe(404);
      expect(alheio.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // O controle da linha acima: o mesmo `:comodoId` num imóvel INEXISTENTE responde o mesmo corpo.
      // Sem ele, "recusou o alheio" ficaria verde sobre uma borda que respondesse `404` a tudo com
      // uma mensagem diferente para cada causa.
      const inexistente = await pedir(
        `${CAMINHO_DOS_IMOVEIS_DA_API}/${UUID_INEXISTENTE}/comodos/${comodoId}`,
        { metodo: 'PUT', cookie, corpo: { nomeComodo: 'Fantasma', metragem: 1 } },
      );

      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo).toEqual(alheio.corpo);

      // --- Metade 4: o cômodo de OUTRO imóvel da MESMA empresa responde 404 no `PUT` -------------
      //
      // **Este é o eixo que a metade 3 NÃO exercita**, e a diferença é de mecanismo. Lá o imóvel é de
      // B e quem devolve zero linhas é a **política** de `negocio.comodo`; aqui os dois imóveis são
      // de A, a sessão é a de A, e a política alcança os dois — quem recusa é **só** o
      // `AND imovel_id = …` de `alterarComodo`, a contenção do sub-recurso que o cabeçalho de
      // `packages/db/src/comodo.ts` declara fechar (*"sem ele o cômodo de um imóvel seria alterável
      // pela rota de outro imóvel da mesma empresa"*). Sem esta metade, apagar a cláusula deixa a
      // suíte inteira verde — medido em MT7-8.
      const outroDeA = await pedir(CAMINHO_DOS_IMOVEIS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjuntoId, IDENTIFICADOR_DO_OUTRO_IMOVEL_DE_A),
      });
      expect(outroDeA.status).toBe(201);

      const comodosDoOutro = `${CAMINHO_DOS_IMOVEIS_DA_API}/${(outroDeA.corpo as ImovelPublicado).id}/comodos`;

      const porOutroImovel = await pedir(`${comodosDoOutro}/${comodoId}`, {
        metodo: 'PUT',
        cookie,
        corpo: { nomeComodo: 'Sequestrado', metragem: 99, observacoes: null },
      });

      // O MESMO corpo das outras duas ausências: a borda não distingue "é de outro imóvel" de "não
      // existe", e quem confere isso é a igualdade com `alheio.corpo`, não uma segunda constante.
      expect(porOutroImovel.status).toBe(404);
      expect(porOutroImovel.corpo).toEqual(alheio.corpo);

      // --- Metade 5: e o mesmo vale para o `DELETE` ---------------------------------------------
      //
      // A cláusula está nas DUAS instruções, e uma metade só deixaria a outra sem rede: removê-la
      // apenas de `removerComodo` atravessa a metade 4 inteira sem ser vista — medido em MT7-8 (b).
      const removidoPorOutro = await pedir(`${comodosDoOutro}/${comodoId}`, {
        metodo: 'DELETE',
        cookie,
      });

      expect(removidoPorOutro.status).toBe(404);
      expect(removidoPorOutro.corpo).toEqual(alheio.corpo);

      // --- E o total do imóvel de A permanece no valor anterior ---------------------------------
      //
      // É a linha que separa "recusou" de "recusou e não gravou": nenhuma das cinco recusas deixou
      // cômodo algum para trás **nem tocou o que já estava lá**. O vetor é comparado por igualdade
      // com o cômodo tal como o acréscimo o devolveu — sem isso, "recusou" ficaria verde sobre uma
      // borda que respondesse `404` depois de ter escrito o nome novo ou removido a linha.
      const releitura = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}`, { cookie });
      expect(releitura.status).toBe(200);
      expect((releitura.corpo as ImovelPublicado).metragemTotal).toBe(25.5);
      expect((releitura.corpo as ImovelPublicado).comodos).toEqual([comodoDeA]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// As cinco recusas — tabela declarada, com o desfecho de cada linha escrito por extenso
// ---------------------------------------------------------------------------------------------

interface Recusa {
  readonly rotulo: string;
  readonly metodo?: string;
  readonly alvo: () => string;
  readonly corpo?: Record<string, unknown>;
  readonly status: number;
  readonly esperado: Record<string, unknown>;
}

/** A recusa canônica de campo, com o campo nomeado por linha. */
function campoInvalido(campo: string): Record<string, unknown> {
  return {
    codigo: CodigoErro.CAMPO_INVALIDO,
    mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
    campo,
  };
}

const RECUSAS: readonly Recusa[] = [
  {
    rotulo: 'sem_nome',
    metodo: 'POST',
    alvo: () => CAMINHO_DA_COLECAO,
    corpo: {},
    status: 422,
    esperado: campoInvalido('nome'),
  },
  {
    rotulo: 'nome_vazio',
    metodo: 'POST',
    alvo: () => CAMINHO_DA_COLECAO,
    corpo: { nome: '   ' },
    status: 422,
    esperado: campoInvalido('nome'),
  },
  {
    // O campo publicado é o `campoPadrao` deste ponto de chamada, e não `'empresaId'` — ver a
    // divergência declarada no cabeçalho. O que a linha prova é que o corpo é FECHADO: uma chave que
    // ninguém declarou recusa a requisição inteira em vez de ser ignorada em silêncio, que é o
    // caminho por onde a fuga de tenant entraria.
    rotulo: 'chave_extra',
    metodo: 'POST',
    alvo: () => CAMINHO_DA_COLECAO,
    corpo: { nome: 'Edifício Recusado', empresaId: UUID_INEXISTENTE },
    status: 422,
    esperado: campoInvalido('corpo'),
  },
  {
    rotulo: 'id_malformado',
    alvo: () => `${CAMINHO_DA_COLECAO}/${IDENTIFICADOR_MALFORMADO}`,
    status: 422,
    esperado: campoInvalido('id'),
  },
  {
    rotulo: 'id_inexistente',
    alvo: () => `${CAMINHO_DA_COLECAO}/${UUID_INEXISTENTE}`,
    status: 404,
    esperado: {
      codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
      mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Observação de estado persistido — pela API pública do pacote, sob o contexto de tenant
// ---------------------------------------------------------------------------------------------

/**
 * Quantas linhas de `negocio.conjunto` o contexto da empresa A alcança.
 *
 * A contagem é **crua** e sem recorte de circulação: o que o `CT-345` mede é se alguma linha nasceu,
 * e uma contagem que aplicasse o predicado esconderia justamente a linha gravada por engano e
 * marcada como retirada. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política
 * (ADR-0008).
 */
async function contarConjuntos(): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.conjunto
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Quantas linhas de `negocio.imovel` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte de circulação, pela mesma razão de {@link contarConjuntos}: o
 * que os casos medem é se alguma linha nasceu, e uma contagem que aplicasse o predicado esconderia
 * justamente a linha gravada por engano e marcada como retirada. Nenhum `WHERE empresa_id` é escrito
 * aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo **contexto**, que é o mesmo
 * mecanismo que a aplicação usa.
 *
 * Ela é irmã de {@link contarConjuntos} e não uma generalização dela: o nome da tabela não é
 * parâmetro vinculável, e transformá-lo em fragmento interpolado seria a única composição de SQL do
 * arranjo — num arquivo cujo assunto é justamente a fronteira entre empresas.
 */
async function contarImoveis(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.imovel
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Cria um conjunto pela ROTA real, com a sessão informada, e devolve o identificador dele.
 *
 * O imóvel exige um conjunto alcançável, e obtê-lo pela rota é o que mantém a precondição no caminho
 * legítimo: nada é gravado por conexão privilegiada, e o identificador do conjunto de cada empresa
 * sai da resposta da sessão **daquela** empresa — o molde do `CT-006`.
 *
 * A falha levanta em vez de devolver: uma precondição que falhasse em silêncio faria o caso reprovar
 * numa asserção adiante, apontando para o lugar errado.
 */
async function criarConjuntoPor(credencial: string, nome: string): Promise<string> {
  const resposta = await pedir(CAMINHO_DA_COLECAO, {
    metodo: 'POST',
    cookie: credencial,
    corpo: { nome },
  });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação do conjunto "${nome}" respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return (resposta.corpo as ConjuntoPublicado).id;
}

/**
 * O corpo completo de um imóvel, com o conjunto e o identificador municipal por parâmetro.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave. Os `ajustes` existem para o único campo que os casos variam — o nome —,
 * e mantê-los abertos evita um segundo construtor quase igual.
 */
function corpoDeImovel(
  conjuntoId: string,
  identificadorMunicipal: string,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: 'Ap 101',
    identificadorMunicipal,
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
    ...ajustes,
  };
}

/**
 * O corpo completo do `PUT` de imóvel — o da criação **menos** `statusLocacao` (T10).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o corpo do `PUT` deste arquivo que
 * carregava um campo que a rota deixou de aceitar. A T10 da fatia `contratos-de-locacao` tirou
 * `statusLocacao` do corpo da alteração — ele passou a ter rota própria —, e a recusa da chave a mais
 * é **deliberada**: `esquemaDeImovelAlterado` é `strictObject`, e um corpo que ainda a traga responde
 * `422 campo 'corpo'`. Continuar enviando-a aqui faria os três `PUT` do `CT-333 (b)` medirem a recusa
 * ruidosa em vez do que eles existem para medir. **Nenhuma asserção foi afrouxada**: o corpo continua
 * completo, e a prova de que o campo é recusado vive no `CT-434`, não aqui.
 *
 * Ele é **derivado** do corpo da criação, e não uma segunda lista de doze campos — espelhando o
 * `omit` do contrato. Duas listas divergiriam no primeiro campo que o cadastro ganhasse.
 */
function corpoDeImovelAlterado(
  conjuntoId: string,
  identificadorMunicipal: string,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  const corpo = corpoDeImovel(conjuntoId, identificadorMunicipal, ajustes);
  delete corpo.statusLocacao;

  return corpo;
}

/**
 * Concede as chaves informadas a uma pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado
 * na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/ciclo-de-acesso.e2e.spec.ts`.
 *
 * A empresa é **parâmetro** porque a T6 tem duas sessões, uma por empresa: escrever o ajuste de
 * quem é da empresa B sob o contexto da A seria recusado por `ErroDePessoaForaDoContexto`, que é o
 * comportamento certo — e o arranjo tem de respeitá-lo, não contorná-lo.
 */
async function conceder(
  usuarioId: string,
  empresaId: string,
  chaves: readonly ChaveDoCatalogo[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/**
 * Um conjunto como a API o publica.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`: o conjunto de chaves é o que os casos
 * asserem por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface ConjuntoPublicado {
  readonly id: string;
  readonly nome: string;
  readonly retiradoEm: string | null;
}

/**
 * Um imóvel como a API o publica.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`, pela mesma razão de
 * {@link ConjuntoPublicado}: o conjunto de chaves é o que o `CT-310` assere por igualdade, e derivá-lo
 * do tipo do SUT faria a asserção concordar consigo mesma. As duas derivadas — `comodos` e
 * `metragemTotal` — entram porque são contrato publicado desde já, e é a T7 que passa a povoá-las.
 *
 * A terceira derivada, `contratoVigente`, entra na T9 pela mesma razão: ela é contrato publicado, e o
 * imóvel deste arquivo não tem contrato algum, de modo que o valor verdadeiro dela é sempre `null`.
 */
interface ImovelPublicado {
  readonly id: string;
  readonly conjuntoId: string;
  readonly nomeImovel: string;
  readonly identificadorMunicipal: string;
  readonly tipoImovel: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  readonly statusLocacao: string;
  readonly observacoes: string | null;
  readonly comodos: readonly unknown[];
  readonly metragemTotal: number;
  readonly contratoVigente: unknown;
  readonly retiradoEm: string | null;
}

/**
 * Um cômodo como a API o publica — sempre embutido no imóvel.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`, pela mesma razão de
 * {@link ConjuntoPublicado}: o conjunto de chaves é o que o `CT-308` assere por igualdade, e
 * derivá-lo do tipo do SUT faria a asserção concordar consigo mesma. **Não existe `retiradoEm`**, e a
 * ausência é a ADR-0014: o cômodo é removido de fato.
 */
interface ComodoPublicado {
  readonly id: string;
  readonly nomeComodo: string;
  readonly metragem: number;
  readonly posicao: number;
  readonly observacoes: string | null;
}

/**
 * Os cômodos de um imóvel sem o identificador gerado — a forma que o `CT-308` compara no passo 2.
 *
 * O identificador é omitido ali porque é ele que o caso ainda vai capturar para endereçar a
 * alteração; nas asserções seguintes o vetor é comparado **com** os identificadores, e é isso que
 * prova que os vizinhos não foram recriados.
 */
function semIdentificador(imovel: ImovelPublicado): Record<string, unknown>[] {
  return imovel.comodos.map((bruto) => {
    const comodo = bruto as ComodoPublicado;

    return {
      nomeComodo: comodo.nomeComodo,
      metragem: comodo.metragem,
      posicao: comodo.posicao,
      observacoes: comodo.observacoes,
    };
  });
}

/** A sessão do produto, no que este arquivo observa dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}
