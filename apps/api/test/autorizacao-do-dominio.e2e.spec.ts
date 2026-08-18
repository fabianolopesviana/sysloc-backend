/**
 * As três provas de SEGURANÇA sobre as **33 rotas do domínio de locação da fatia
 * `cadastro-de-imoveis-e-pessoas`** (T11), mais as duas provas de que as **três ações sensíveis da
 * superfície de contrato são independentes entre si** (T7 e T8 da fatia `contratos-de-locacao`).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era a prosa deste arquivo que dizia "as
 * 33 rotas do domínio" como se fossem a superfície inteira. Elas são as **da fatia anterior**, e a
 * tabela {@link rotasDoDominio} continua descrevendo exatamente essas 33 — `ROTAS_DA_FATIA` **não
 * muda**, nenhuma asserção foi afrouxada e nenhum caso saiu. O que a T7 acrescenta é o `CT-320 (b)`,
 * sobre uma superfície que aquela tabela nunca cobriu: `/v1/contratos`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 acrescenta o `CT-320 (c)`, sobre a MESMA superfície e pela mesma
 * razão — e o `describe` perde o numeral "três provas", que já estava vencido com quatro casos
 * dentro (débito **D33 · F2/T7**). O número vive nas âncoras logo abaixo, que são executáveis;
 * repeti-lo na prosa só criava um segundo lugar para envelhecer. `ROTAS_DA_FATIA` **não muda**,
 * nenhuma asserção foi afrouxada e nenhum caso saiu.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-12 | CT-319 | Para **cada uma** das 33 rotas novas, uma sessão válida **sem** a chave da área
 * |       |        | correspondente recebe `403 ACESSO_NEGADO` com `detalhes.exigido` igual **àquela**
 * |       |        | chave — `TELA:imoveis` nas 15 de imóveis, `TELA:cadastros` nas 18 de pessoas —,
 * |       |        | nunca uma genérica; e a sessão que **tem** a chave recebe, nas MESMAS 33 rotas,
 * |       |        | resposta diferente de `403`. (ADR-0011) |
 * | CA-13 | CT-320 | Nas **10** rotas de circulação, a sessão que tem a ÁREA e **não** tem
 * |       |        | `ACAO:excluir_cadastro` recebe `403` nomeando **a ação** — e não a área, que ela
 * |       |        | possui —, e o cadastro permanece em circulação (`retiradoEm` nulo) na leitura
 * |       |        | seguinte. Concedida a ação à MESMA pessoa, a retirada responde `200` e a marca
 * |       |        | passa a preenchida. (ADR-0011, ADR-0018) |
 * | CA-14 | CT-321 | Nas rotas de `:id` das cinco entidades circuláveis, o cadastro de OUTRA empresa é
 * | CA-12 |        | indistinguível de inexistente: `404` com corpos **profundamente iguais**, e o
 * |       |        | estado do cadastro alheio é idêntico, campo a campo, depois das tentativas. A
 * |       |        | mesma sessão alcança o cadastro PRÓPRIO com `200`. (ADR-0008, ADR-0017) |
 *
 * | CA-16 | CT-320 | Na rota de **ativação** de contrato, a sessão que tem a área **e a outra ação
 * |       | (b)    | sensível da mesma superfície** (`ACAO:excluir_cadastro`) — provada por retirar e
 * |       |        | recircular o contrato com `200` — recebe `403` nomeando `ACAO:ativar_contrato`
 * |       |        | ao tentar ativar; o contrato segue `RASCUNHO` e o imóvel `DISPONIVEL`. As duas
 * |       |        | ações são **independentes**: ter uma não substitui a outra. (ADR-0018,
 * |       |        | ADR-0019) |
 * | CA-17 | CT-320 | Na rota de **cancelamento**, a sessão que tem a área **e as DUAS outras ações
 * |       | (c)    | sensíveis** da mesma superfície (`ACAO:excluir_cadastro` e
 * |       |        | `ACAO:ativar_contrato`) — provadas por ativar, retirar e recircular com `200` —
 * |       |        | recebe `403` nomeando `ACAO:cancelar_contrato`; o contrato segue `ATIVO` e o
 * |       |        | imóvel `LOCADO`. As três ações são independentes duas a duas, e reaproveitar
 * |       |        | `ACAO:excluir_cadastro` para cancelar é o que a ADR-0019 rejeita
 * |       |        | **nominalmente**. (ADR-0018, ADR-0019) |
 *
 * | CA-17 | CT-534 | Nas **sete rotas da fatia `cobranca-e-mora`**, a sessão a quem a área exigida foi
 * |       |        | **RETIRADA** pelo caminho real de administração recebe `403` com o envelope da
 * |       |        | ADR-0017 e `detalhes.exigido` igual à chave **daquela** área — `TELA:financeiro`
 * |       |        | nas cinco de cobrança, `TELA:multa_e_juros` nas duas de mora —, e as sete recusas
 * |       |        | são idênticas entre si **byte a byte** dentro de cada área e **indistinguíveis
 * |       |        | entre perfis** (Admin e Usuário recebem o mesmo corpo). **Nada muda**: o `xmin`
 * |       |        | das duas cobranças alvo, o `xmin` e os percentuais gravados da política, e a
 * |       |        | contagem crua de `negocio.cobranca` são idênticos antes e depois. A sessão que tem
 * |       |        | **as duas áreas** alcança as MESMAS sete com `2xx`. (ADR-0011, ADR-0017, ADR-0021)
 *
 * | CA-14 | CT-633 | Nas **quatro rotas da fatia `regua-de-cobranca`**, a sessão de `USUARIO_EMPRESA`
 * |       |        | com a **matriz padrão** — só `TELA:resumo`, sem ajuste algum escrito — recebe
 * |       |        | `403` com o envelope INTEIRO da ADR-0017 e `detalhes.exigido` igual a
 * |       |        | `TELA:automacao_de_cobranca` nas quatro; **nenhuma responde `404`**, e as quatro
 * |       |        | recusas são idênticas entre si **byte a byte**. **Nada muda**: a política de
 * |       |        | aviso relida é estritamente igual, as contagens cruas de
 * |       |        | `negocio.politica_de_aviso` e de `negocio.envio_de_cobranca` são as mesmas, e
 * |       |        | nenhuma mensagem sai. (ADR-0011, ADR-0017) |
 * | CA-13 | CT-634 | Com `TELA:automacao_de_cobranca` e **sem** `ACAO:enviar_cobranca_manual`, as três
 * |       |        | rotas de área respondem `200` e **só** o disparo manual recebe `403`, nomeando a
 * |       |        | **AÇÃO** — a primeira ausente da conjunção —, sem que mensagem alguma saia nem
 * |       |        | linha alguma nasça. Concedida a ação à MESMA pessoa, o efetivo publicado cresce
 * |       |        | de **exatamente uma** chave nos dois sentidos, e o disparo passa a responder
 * |       |        | `200` com **+1** captura para o endereço do locatário e **+1** linha crua.
 * |       |        | (ADR-0011, ADR-0018) |
 *
 * | CA-15 | CT-941 | Nas **sete rotas da fatia `emissao-e-conciliacao`** — as quatro de
 * |       |        | `/v1/cobrancas` e as três de `/v1/cobranca-bancaria` —, a requisição **sem
 * |       |        | sessão** recebe `401 NAO_AUTENTICADO` com o envelope INTEIRO e **sem
 * |       |        | `detalhes`**, e as sete recusas são idênticas **byte a byte**: nenhuma delas é
 * |       |        | pública. A sessão de `USUARIO_EMPRESA` com a **matriz padrão** recebe `403` nas
 * |       |        | sete, nomeando a **ÁREA** — a primeira ausente da conjunção (ADR-0018) —, e
 * |       |        | nenhuma responde `404`. Com `TELA:financeiro` e **sem** as ações, **só os três
 * |       |        | atos** recusam, nomeando cada um a **AÇÃO** própria, e as quatro leituras
 * |       |        | deixam de recusar. E, com o perfil COMPLETO, nenhuma das sete responde `401`
 * |       |        | nem `403` — o controle antivácuo sem o qual uma rota quebrada que recusasse
 * |       |        | todo mundo passaria nos três passos anteriores. (ADR-0011, ADR-0017, ADR-0018,
 * |       |        | ADR-0021) |
 *
 * Rastreabilidade: `CA-12 → CT-319 (RN-14)`, `CA-13 → CT-320 (RN-14)`, `CA-14 → CT-321 (RN-01)`,
 * `CA-16 → CT-320 (b) (RN-13)`, `CA-17 → CT-320 (c) (RN-07)`.
 * Acrescida pela T11 da fatia `cobranca-e-mora`: `CA-17 → CT-534 (RN-14)`.
 * Acrescida pela T12 da fatia `regua-de-cobranca`: `CA-14 → CT-633 (RN-14)`,
 * `CA-13 → CT-634 (RN-12)`.
 * Acrescida pela T17 da fatia `emissao-e-conciliacao`: `CA-15 → CT-941 (RN-14)`.
 *
 * ===========================================================================
 * O CT-941 mede o COMPORTAMENTO das sete; quem audita a declaração é o CT-937
 * ===========================================================================
 *
 * A divisão é a mesma dos pares `CT-534` × `CT-533` e `CT-633` × `CT-635`, e pela mesma razão: o
 * `CT-937`, em `test/cobertura-de-autorizacao.e2e.spec.ts`, lê o **metadado** das sete rotas e afirma
 * o retrato devido — e ficaria verde numa aplicação cuja guarda não fosse consultada, porque
 * declaração escrita não é decisão aplicada. Este caso **sonda a borda**, nos três eixos que a
 * declaração não alcança: o `401` de quem não se identificou, o `403` de quem não alcança a área, e a
 * distinção entre os **três atos** e as **quatro leituras** quando a área já está presente.
 *
 * ⚠️ **Os alvos são recursos que NÃO existem, e é isso que torna o caso independente de arranjo**: a
 * guarda corre antes do manipulador, de modo que o `401` e o `403` não dependem do estado do banco.
 * A consequência que importa é a do quarto passo — com o perfil completo, nenhuma das sete grava
 * linha nem enfileira tarefa, porque as que o fariam recebem o corpo recusado de propósito (ver
 * {@link CHAVE_QUE_NINGUEM_DECLAROU}).
 *
 * ===========================================================================
 * O CT-633 e o CT-634 medem o COMPORTAMENTO; quem audita a declaração é o CT-635
 * ===========================================================================
 *
 * A divisão é a mesma do par `CT-534` × `CT-533`, e pela mesma razão: o `CT-635`, em
 * `test/cobertura-de-autorizacao.e2e.spec.ts`, lê o **metadado** das quatro rotas e afirma o retrato
 * devido — e ficaria verde numa aplicação cuja guarda não fosse consultada, porque declaração escrita
 * não é decisão aplicada. Estes dois **sondam a borda**.
 *
 * Entre eles, a divisão é por **eixo da exigência**: o `CT-633` mede a ausência da **área**, que
 * derruba as quatro; o `CT-634` mede a ausência da **ação**, que derruba **uma**. Nenhum implica o
 * outro, e é o par que discrimina: uma guarda que exigisse apenas a área nas quatro passaria pelo
 * primeiro inteiro, e uma que exigisse a ação nas quatro passaria pelo eixo negativo do segundo.
 *
 * A metade de estado é o que separa *recusou* de *recusou depois de gravar*, e ela tem três formas
 * porque as quatro rotas tocam três coisas distintas: a **linha da política** (que o `PUT`
 * reescreveria), a **contagem crua de tentativas** (que o disparo faria nascer) e a **lista de
 * capturas** (a mensagem que teria saído para o mundo). Nenhuma das três implica as outras — um
 * disparo que gravasse a linha sem falar com a porta, ou o contrário, é exatamente a distinção entre
 * *não enviar* e *não registrar*.
 *
 * ===========================================================================
 * O CT-534 mede o COMPORTAMENTO; quem audita a declaração é o CT-533
 * ===========================================================================
 *
 * Os dois cobrem a mesma superfície por eixos que não se implicam. O `CT-533`, em
 * `test/cobertura-de-autorizacao.e2e.spec.ts`, lê o **metadado** das sete rotas e afirma que cada uma
 * exige exatamente a área devida e nenhuma chave de ação — e ficaria verde numa aplicação cuja guarda
 * não fosse consultada, porque declaração escrita não é decisão aplicada. Este caso **sonda a borda**:
 * ele mostra que quem não alcança a área é de fato recusado, com o corpo que o contrato publica, e que
 * a recusa acontece **antes** de qualquer escrita.
 *
 * A metade de estado é o que separa *recusou* de *recusou depois de gravar*, e ela tem três formas
 * porque as sete rotas tocam três coisas distintas: as **duas tuplas de cobrança** (o `xmin` acusa o
 * `UPDATE` das transições), a **linha da política** (o `xmin` acusa até um `PUT` que reescrevesse os
 * mesmos percentuais — a única forma de escrita idempotente desta superfície) e a **contagem crua**
 * (que é o que o `xmin` não alcança, porque o `POST` da coleção criaria uma linha nova em vez de tocar
 * as observadas).
 *
 * ===========================================================================
 * POR QUE O CT-320 (b) E O (c) NÃO SÃO O CT-425 E O CT-426 OUTRA VEZ
 * ===========================================================================
 *
 * O `CT-425` e o `CT-426`, em `test/contratos.e2e.spec.ts`, medem sessões que **não têm** a ação da
 * rota que tentam — e o que eles prendem é a **forma** da recusa. Estes dois medem sessões que **têm
 * as outras ações da mesma superfície**, e o que eles prendem é outra coisa: que **ter uma ação da
 * superfície não dá as demais**. É a diferença entre acusar um corpo de erro errado e mostrar a
 * **escalada**.
 *
 * A distinção não é acadêmica, e nomeia o erro mais provável deste controlador: as **quatro** rotas
 * que declaram no método são adjacentes no fonte, e duas delas exigem `ACAO:excluir_cadastro`. Uma
 * ativação que copiasse a linha de cima exigiria a ação errada — e a sessão do `(b)`, que **tem** a
 * de circulação, seria admitida a ativar. O cancelamento tem **duas** vizinhas de onde copiar, e é
 * por isso que a sessão do `(c)` carrega as duas: com qualquer uma delas exigida por engano, a rota
 * responderia `200`, e nenhum dos casos de `contratos.e2e.spec.ts` mostraria isso. O eixo positivo
 * de cada um — as rotas que a MESMA sessão alcança com `200` — é o que torna o `403` atribuível à
 * ação que falta, e não à que ela tem.
 *
 * No `(c)` o eixo positivo tem uma segunda função, e ela é necessária: a ativação **precisa** vir
 * antes, senão o contrato seria um rascunho e a recusa do cancelamento poderia ser a `422` da guarda
 * de **estado** em vez da `403` da guarda de autorização.
 *
 * ===========================================================================
 * A tabela das 33 rotas é DERIVADA, e não redigitada
 * ===========================================================================
 *
 * {@link rotasDoDominio} é composta a partir dos donos de segmento (`CAMINHO_DOS_CONJUNTOS`,
 * `CAMINHO_DOS_IMOVEIS`, `CAMINHO_DOS_COMODOS` e os três de cadastro de pessoa), do mesmo modo que o
 * inventário do `CT-318`. A razão é a que a §6.6 da task registra: *"uma rota nova que ninguém
 * acrescentasse à tabela ficaria sem prova comportamental, enquanto o CT-318 (declarativo) a
 * pegaria"*. Os dois se cobrem — um lê o metadado da superfície publicada, o outro **sonda o
 * comportamento** —, e a contagem de 33 é afirmada nos dois, porque tabela truncada em silêncio é o
 * modo de falha desta classe de caso.
 *
 * ===========================================================================
 * O EIXO POSITIVO é obrigatório nos três casos
 * ===========================================================================
 *
 * Uma guarda que recusasse **tudo** passaria os três eixos negativos inteiros. É a lição literal do
 * `VALORES_INVALIDOS` do `CT-011`, repetida em cada task desta fatia. Por isso:
 *
 *   * o `CT-319` percorre as MESMAS 33 rotas com a sessão que **tem** a área, e afirma que nenhuma
 *     responde `403`;
 *   * o `CT-320` concede a ação à mesma pessoa e afirma que a retirada passa a responder `200` com a
 *     marca preenchida — a mudança de comportamento é atribuível à chave, e a nada mais;
 *   * o `CT-321` faz a sessão da empresa B alcançar um cadastro **próprio** com `200`, o que separa
 *     "esta sessão não alcança o alheio" de "esta sessão está quebrada".
 *
 * ===========================================================================
 * Por que as duas FAMÍLIAS de área entram no CT-320
 * ===========================================================================
 *
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é `TELA:cadastros`. Nas rotas de pessoa, portanto, a área
 * da classe **coincide** com a tela que o catálogo associa à ação — e uma recusa que nomeasse a área
 * pareceria certa por acidente. Nas rotas de imóvel a área é `TELA:imoveis`, e ali a coincidência não
 * existe: uma recusa que nomeasse a área diria `TELA:imoveis` onde o contrato exige
 * `ACAO:excluir_cadastro`, e reprovaria. Por isso o caso usa **as duas famílias**, e não uma.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — MT11-4 e MT11-5 (2026-08-06)
 * ===========================================================================
 *
 * Os dois foram aplicados ao MESMO ponto — a declaração de exigência de `POST /v1/imoveis/:id/
 * retirada`, em `apps/api/src/imoveis/imovel.controller.ts` — e cada um reprova um caso diferente. A
 * suíte foi invocada com a compilação do pacote antes do `vitest` (`tsc --build`), nunca por
 * `vitest run` sobre um `dist/` velho. **Nenhum deles tocou o código sob o marcador `DECISÃO
 * FECHADA` de `conjunto.controller.ts`** — a medição corre no gêmeo, que declara a mesma conjunção
 * por referência àquele marcador.
 *
 *   * **controle** — árvore íntegra: `3 passed` neste arquivo;
 *   * **MT11-4 · a ação sensível desaparece da rota** (`@ExigeChaves(AREA, ACAO)` → `@ExigeChave
 *     (AREA)`): `1 failed`, no **`CT-320`**, com a mensagem *"POST /v1/imoveis/<id>/retirada
 *     respondeu 200: expected 200 to be 403"*. É o defeito de quem confia só na área: a sessão que
 *     tem a área e não tem a ação passa a retirar cadastro;
 *   * **MT11-5 · a declaração do MÉTODO SUBSTITUI a da classe** (`@ExigeChaves(AREA, ACAO)` →
 *     `@ExigeChave(ACAO)`) — o defeito literal que a **ADR-0018** nasceu para impedir: `1 failed`,
 *     no **`CT-319`**, com a mensagem *"a recusa de POST /v1/imoveis/:id/retirada mudou de forma:
 *     `exigido` `TELA:imoveis` → `ACAO:excluir_cadastro`"*. Note que o `CT-320` **sobreviveria** a
 *     este segundo mutante (a sessão dele continua sem a ação, e a recusa continua nomeando a ação),
 *     e o `CT-355` o pegaria por estrutura: são três redes sobre o mesmo defeito, por três caminhos,
 *     e é isso que torna a ADR-0018 verificável em vez de prometida;
 *   * **reversão** — o fonte foi restaurado e conferido por `git diff` vazio, e o controle voltou a
 *     `3 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T8 — MT8-3 e MT8-4 (2026-08-09), o par que mede a ESCALADA
 * ---------------------------------------------------------------------------
 *
 * Os dois foram aplicados ao MESMO ponto — a constante `ACAO_DE_CANCELAMENTO` de
 * `apps/api/src/contratos/contrato.controller.ts`, que é o que a rota de cancelamento exige além da
 * área —, e cada um troca a ação por **uma das duas vizinhas** dela no fonte. A suíte foi invocada
 * pelo script do pacote (`pnpm --filter @sysloc/api test`). **Controle**: `151 passed`.
 *
 *   * **MT8-3 · a ação vira a da vizinha de CIMA** (`ACAO:cancelar_contrato` →
 *     `ACAO:ativar_contrato`): `2 failed | 149 passed`, no **`CT-320 (c)`** — `expected 200 to be
 *     403`, isto é, **quem pode ativar passaria a cancelar** — e no `CT-426` de
 *     `test/contratos.e2e.spec.ts`, na mesma forma;
 *   * **MT8-4 · a ação vira a da vizinha de BAIXO** (`ACAO:cancelar_contrato` →
 *     `ACAO:excluir_cadastro`): `2 failed | 149 passed`, e os dois falham de formas **diferentes** —
 *     o `CT-320 (c)` com `expected 200 to be 403` (quem administra a circulação passaria a destravar
 *     imóveis, que é o efeito que a ADR-0019 rejeita **nominalmente**) e o `CT-426` na **igualdade
 *     do corpo** da recusa, porque a sessão dele não tem aquela ação. É a divisão de trabalho entre
 *     os dois casos, medida: um acusa a **forma** da recusa, o outro mostra a **escalada**;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * A âncora destes registros é **simbólica** — a constante `ACAO_DE_CANCELAMENTO` do controlador de
 * contrato —, e nunca número de linha.
 *
 * As âncoras destes registros são **simbólicas** — o `@ExigeChaves` do manipulador de retirada de
 * `imovel.controller.ts` —, e nunca número de linha.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T12 — MT12-1 e MT12-2 (2026-08-12), medidos sobre o controlador da automação
 * ---------------------------------------------------------------------------
 *
 * Os dois foram aplicados a `apps/api/src/automacao/automacao.controller.ts` para falsificar o
 * `CT-635` (o registro por extenso está no cabeçalho de `test/cobertura-de-autorizacao.e2e.spec.ts`),
 * e **estes dois casos reprovaram junto** — que é o que prova que eles discriminam na borda o mesmo
 * defeito que aquele acusa por estrutura. A suíte foi invocada pelo script do pacote
 * (`pnpm --filter @sysloc/api test`). **Controle**: `203 passed`.
 *
 *   * **MT12-1 · o disparo declarando SÓ a ação** (`@ExigeChaves(AREA, ACAO)` → `@ExigeChave(ACAO)`,
 *     o defeito literal que a ADR-0018 nasceu para impedir): o **`CT-633`** reprova com *"a recusa de
 *     POST /v1/automacao-de-cobranca/cobrancas/:codigo/avisos mudou de forma"*, e o corpo mostra
 *     `exigido` indo de `TELA:automacao_de_cobranca` para `ACAO:enviar_cobranca_manual`. ⚠️ O
 *     **`CT-634` SOBREVIVE** a este mutante, e a assimetria é conteúdo: a sessão dele **tem** a área e
 *     **não** tem a ação, de modo que a recusa continua nomeando a ação e o eixo positivo continua
 *     passando com as duas chaves. É por isso que os dois casos existem, e é por isso que nenhum deles
 *     substitui o `CT-635`;
 *   * **MT12-2 · a exigência sai da CLASSE e vai para UM só manipulador**: os **dois** reprovam — o
 *     `CT-633` porque duas das quatro rotas passaram a atender sem decisão alguma (o `403` esperado
 *     vira `200`), e o `CT-634` pelo mesmo motivo no eixo que ele mede;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `diff -q` e `sha256sum`
 *     idênticos ao original, e o controle voltou a `203 passed`.
 *
 * ===========================================================================
 * Precondição privilegiada — tudo pelo caminho REAL
 * ===========================================================================
 *
 * Nenhum estado é forjado e nenhum símbolo foi acrescentado a `apps/api/src/**` para estes casos
 * existirem (Iron Law #6):
 *
 *   * **sessão** — pela rota pública de entrada (`entrar`), com a senha da carga; a pessoa exclusiva
 *     do `CT-320` nasce por `POST /v1/usuarios` (a rota real do Admin) e cumpre a troca obrigatória
 *     por `POST /v1/sessao/senha`, como em `circulacao-de-cadastro.e2e.spec.ts`;
 *   * **permissão** — por `escreverAjustes` sob `contextoDeTenant.executarCom` da empresa da pessoa,
 *     com `validarCoerenciaDeAjustes` (a regra de domínio de verdade), e o efetivo resultante é
 *     **AFIRMADO por `GET /v1/sessao`** antes de cada fluxo, nunca presumido. A sessão sem área
 *     recebe a **NEGAÇÃO explícita** das duas chaves: o efetivo é `(matriz do perfil ∪ concedidas) −
 *     negadas`, e sem a negação o piso do perfil poderia já conceder a área;
 *   * **cadastro** — criado e retirado **pelas rotas**, nunca por conexão privilegiada. Nenhuma
 *     cláusula deste arquivo compara `empresa_id`: o isolamento é observado pela resposta da borda,
 *     que é o que a ADR-0008 autoriza;
 *   * **o destino da mensagem** (T12) — por `overrideProvider` sobre o token que a composição já
 *     publica, e **nada mais**: a aplicação continua sendo a de produção montada por inteiro (ver
 *     {@link aplicacaoComCaptura}). O `CT-633` **não escreve ajuste algum** — a ausência da área é a
 *     precondição dele, e é afirmada pela igualdade do efetivo com a matriz padrão do perfil.
 *
 * Cada caso arranja o **próprio sujeito**: a pessoa cujo efetivo o `CT-320` altera não é usada por
 * nenhum outro caso, e nenhuma sessão é compartilhada entre casos que escrevem permissão.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta é **reservada** (trava atômica), e
 * não dinâmica, pela razão que a T8 da fatia anterior registrou: o arcabouço confere a origem das
 * requisições com cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { type CapturadorDeEmail, criarCapturadorDeEmail } from '@sysloc/regua';
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
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DA_AUTOMACAO_DE_COBRANCA } from '../src/automacao/automacao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import {
  CAMINHO_DA_COBRANCA_BANCARIA,
  SEGMENTO_DAS_CONFERENCIAS,
  SEGMENTO_DAS_EMISSOES,
} from '../src/cobranca-bancaria/cobranca-bancaria.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_EMAIL,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_COMODOS } from '../src/imoveis/comodo.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DE_MULTA_E_JUROS } from '../src/mora/mora.controller.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente, fila, aplicação e o arranjo das quatro sessões. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota pública de entrada do arcabouço de identidade. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A rota de troca de senha **do produto** — a que baixa a marca de senha provisória (RN-09). */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A rota que publica o efetivo da sessão corrente — onde toda precondição é AFIRMADA. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** A rota do Admin por onde a pessoa exclusiva do CT-320 nasce. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/** A senha definitiva com que a pessoa criada pelo Admin passa a operar. */
const SENHA_TROCADA = 'brisa9Verde!';

/** As duas áreas de tela que governam a superfície nova (§4.1, §11.2). */
const AREA_DOS_IMOVEIS: ChaveDoCatalogo = 'TELA:imoveis';
const AREA_DOS_CADASTROS: ChaveDoCatalogo = 'TELA:cadastros';

/** A ação sensível que as 10 rotas de circulação exigem **além** da área (ADR-0011, ADR-0018). */
const ACAO_SENSIVEL: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/**
 * A área e as **duas** ações sensíveis próprias da superfície de contrato — o eixo do `CT-320 (b)` e
 * do `CT-320 (c)` (ADR-0019).
 *
 * As duas ações são **independentes**, e é a independência que os dois casos medem por ângulos
 * opostos: o `(b)` prova que ter a de circulação não dá a de ativar; o `(c)`, que ter as de circulação
 * **e** de ativar não dá a de cancelar. A ADR-0019 rejeita **nominalmente** reaproveitar
 * `ACAO:excluir_cadastro` para cancelar, e a razão é de efeito — retirar de circulação não libera o
 * imóvel, cancelar libera.
 */
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';
const ACAO_DE_ATIVAR_CONTRATO: ChaveDoCatalogo = 'ACAO:ativar_contrato';
const ACAO_DE_CANCELAR_CONTRATO: ChaveDoCatalogo = 'ACAO:cancelar_contrato';

/** A coleção de contratos, sob o prefixo de versão — a superfície que o `CT-320 (b)` sonda. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/**
 * As duas áreas de tela que governam a superfície da fatia `cobranca-e-mora` — o eixo do `CT-534`
 * (§3.1 da T11).
 *
 * Nenhuma das sete rotas exige chave de **ação**, e a ausência é decisão escalada e confirmada antes
 * da spec: a `Decision` da **ADR-0021** nomeia *"acusar pagamento de cobrança"* e *"cancelar
 * cobrança"* entre as instâncias da classe que exige apenas a área, e o catálogo fechado não tem ação
 * alguma para lançar, ler, pagar ou cancelar cobrança — nem qualquer ação dentro de
 * `TELA:multa_e_juros`. Quem audita isso por **estrutura** é o `CT-533`; este caso mede o
 * **comportamento**, e é por isso que a chave que ele espera em `detalhes.exigido` é sempre a da
 * área.
 */
const AREA_DO_FINANCEIRO: ChaveDoCatalogo = 'TELA:financeiro';
const AREA_DE_MULTA_E_JUROS: ChaveDoCatalogo = 'TELA:multa_e_juros';

/**
 * As **duas** ações sensíveis que o catálogo fechado enumera dentro de `TELA:financeiro` — as que
 * falam com o banco, e nenhuma delas de cobrança.
 *
 * Elas entram neste arquivo por **obrigação da regra de domínio**, e não porque alguma das sete rotas
 * as exija: a matriz do `ADMIN_EMPRESA` é o catálogo inteiro, e retirar dele a área sem retirar as duas
 * ações deixaria ação sensível sem a tela que a comporta — o que a RN-02 recusa no momento de salvar.
 */
const ACAO_DE_EMITIR_BOLETO: ChaveDoCatalogo = 'ACAO:emitir_boleto';
const ACAO_DE_SOLICITAR_BAIXA: ChaveDoCatalogo = 'ACAO:solicitar_baixa_de_boleto';

/** A coleção de cobranças, sob o prefixo de versão — cinco das sete rotas do `CT-534`. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

/**
 * O recurso **singular** da política de mora, sob o prefixo de versão — as outras duas.
 *
 * Singular, e por isso sem `:id`: a política é uma por empresa, e a chave é a própria sessão. Os dois
 * pares desta superfície compartilham o mesmo caminho e diferem só pelo verbo.
 */
const RECURSO_DE_MULTA_E_JUROS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DE_MULTA_E_JUROS}`;

/** Quantas rotas a fatia `cobranca-e-mora` publica — cinco de cobrança e duas de mora. */
const ROTAS_DA_FATIA_DE_COBRANCA = 7;

/**
 * A área de tela e a ação sensível que governam a superfície da fatia `regua-de-cobranca` — o eixo
 * do `CT-633` e do `CT-634` (§4.1, §11.2 da tech spec).
 *
 * Literais escritos à mão, e **não** importados de `automacao.controller.ts`: as duas constantes de
 * lá são privadas de propósito, e derivá-las da mesma fonte que o SUT usa para declarar faria a
 * asserção concordar com ele — trocar a exigência do controlador deixaria de reprovar caso algum.
 * Elas são o valor que o cliente lê em `detalhes.exigido`, e por isso a expectativa é escrita.
 *
 * **Três das quatro rotas exigem só a área; o disparo manual exige a CONJUNÇÃO**, e é essa
 * assimetria que os dois casos medem por ângulos opostos: o `CT-633` mostra que sem a área **as
 * quatro** recusam, e o `CT-634` mostra que com a área e sem a ação **só o disparo** recusa. Quem
 * audita isso por **estrutura** é o `CT-635`.
 */
const AREA_DA_AUTOMACAO_DE_COBRANCA: ChaveDoCatalogo = 'TELA:automacao_de_cobranca';
const ACAO_DE_ENVIO_MANUAL: ChaveDoCatalogo = 'ACAO:enviar_cobranca_manual';

/**
 * A única área que a matriz padrão de `USUARIO_EMPRESA` concede — o **piso** do perfil (ADR-0010).
 *
 * Ela é a precondição do `CT-633` escrita por extenso: o sujeito daquele caso não recebe ajuste
 * algum, e é este conjunto que `GET /v1/sessao` tem de publicar para que a recusa seja atribuível à
 * ausência da área, e não a uma sessão quebrada. Literal, e não derivada de `MATRIZ_POR_PERFIL`, pela
 * mesma razão das duas chaves acima.
 */
const AREA_DO_PISO_DO_USUARIO: ChaveDoCatalogo = 'TELA:resumo';

/** O recurso **singular** da política de aviso, sob o prefixo de versão — duas das quatro rotas. */
const RECURSO_DA_AUTOMACAO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_AUTOMACAO_DE_COBRANCA}`;

// ---------------------------------------------------------------------------------------------
// O eixo do CT-941 — as SETE rotas da fatia `emissao-e-conciliacao` (T17)
// ---------------------------------------------------------------------------------------------

/** A coleção de `/v1/cobranca-bancaria`, sob o prefixo de versão — três das sete rotas. */
const COLECAO_DA_COBRANCA_BANCARIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_COBRANCA_BANCARIA}`;

/** Quantas rotas a fatia `emissao-e-conciliacao` publica — quatro de cobrança e três próprias. */
const ROTAS_DA_FATIA_DE_EMISSAO = 7;

/** Quantas das sete exigem, **além** da área, uma chave de ação — os três atos que movem dinheiro. */
const ATOS_DA_FATIA_DE_EMISSAO = 3;

/**
 * A mensagem canônica do `401`, escrita por extenso.
 *
 * Literal, e **não** importada de `MENSAGEM_POR_CODIGO`: comparar a resposta com a constante que a
 * produziu faria a âncora concordar consigo mesma. Ela é contrato — é o que o cliente lê.
 */
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';

/**
 * Um código de cobrança **bem formado** que não existe em empresa alguma — o alvo das quatro rotas
 * de `/v1/cobrancas` no `CT-941`.
 *
 * O ano é 2099 de propósito: ele passa pela validação de forma da borda, de modo que a recusa que o
 * caso mede é a da **guarda**, e não a do esquema. É a mesma escolha, e a mesma razão, de
 * `historico-bancario.e2e.spec.ts` e de `boleto-da-cobranca.e2e.spec.ts`.
 */
const COBRANCA_INEXISTENTE = 'COB-2099-0000001';

/** Um identificador bem-formado que não corresponde a lote algum — o alvo do `GET` de emissão. */
const LOTE_INEXISTENTE = '11111111-1111-4111-8111-111111111111';

/**
 * Uma chave que **nenhum** esquema de entrada desta fatia declara.
 *
 * Ela é o que faz o eixo POSITIVO do `CT-941` parar em `422` sem produzir efeito: com o perfil
 * completo, a abertura de lote e o disparo da conferência **enfileirariam tarefa** e gravariam
 * linha se o corpo fosse válido, e o que o caso mede é a autorização — não o percurso. Recusada a
 * entrada, a guarda já decidiu (ela corre antes do manipulador), e o `422` prova que a decisão foi
 * *passar*.
 */
const CHAVE_QUE_NINGUEM_DECLAROU = 'campoQueNinguemDeclarou';

/** A coleção de avisos de uma cobrança — as outras duas. Composta, nunca escrita à mão. */
function rotaDosAvisos(codigo: string): string {
  return `${RECURSO_DA_AUTOMACAO}/cobrancas/${codigo}/avisos`;
}

/** Quantas rotas a fatia `regua-de-cobranca` publica — duas de política e duas de aviso. */
const ROTAS_DA_FATIA_DA_REGUA = 4;

/**
 * O corpo completo da política de aviso do cenário — os seis campos, nenhum opcional.
 *
 * Ele é gravado pela sessão **privilegiada** antes dos casos, e é ele que o `CT-633` relê depois das
 * quatro recusas: sem uma política já gravada, *"nada muda"* seria afirmado sobre a ausência, que é
 * o estado que uma escrita indevida também produziria se falhasse.
 */
const POLITICA_DE_AVISO_DO_CENARIO = {
  ativo: true,
  diasAntesDoVencimento: 5,
  intervaloMinimoDias: 3,
  janelaInicio: '08:00',
  janelaFim: '17:00',
  canal: 'EMAIL',
} as const;

/**
 * Os dois arranjos do `CT-634`, sobre a MESMA pessoa — e eles diferem por **exatamente uma** chave.
 *
 * O segundo é **derivado** do primeiro, e não uma segunda lista: escrever os dois à mão deixaria a
 * diferença livre para virar duas, e é a diferença de uma chave só que prende a exigência do disparo
 * à AÇÃO em vez de à área. A diferença é afirmada no caso, sobre o efetivo publicado, e não presumida
 * daqui.
 */
const ARRANJO_SO_COM_A_AREA: readonly ChaveDoCatalogo[] = [AREA_DA_AUTOMACAO_DE_COBRANCA];
const ARRANJO_COM_A_ACAO: readonly ChaveDoCatalogo[] = [
  ...ARRANJO_SO_COM_A_AREA,
  ACAO_DE_ENVIO_MANUAL,
];

/**
 * A distância, em dias, entre o relógio do banco e o vencimento da cobrança do cenário da régua —
 * **negativa**, e é ela que a torna `VENCIDA`.
 *
 * O disparo manual ignora a janela, a trava e o recorte de antecedência, mas **não** ignora o estado:
 * `PAGA` e `CANCELADA` são recusadas com `422`. Uma cobrança vencida é, portanto, o que faz o efeito
 * ser possível — e sem efeito possível o eixo positivo do `CT-634` mediria a guarda de estado em vez
 * da de autorização.
 */
const DIAS_DESDE_O_VENCIMENTO = -20;

/** O estado que a cobrança do cenário da régua publica — afirmado, nunca presumido do deslocamento. */
const ESTADO_VENCIDO = 'VENCIDA';

/**
 * A política de mora do cenário do `CT-534` — multa de 2% e juros de 1% ao mês.
 *
 * Os dois são **diferentes entre si** de propósito: uma leitura que trocasse os dois campos de lugar
 * passaria despercebida sob valores iguais, e é o corpo inteiro da política que o caso compara antes e
 * depois das recusas.
 */
const MULTA_DO_CENARIO = 2;
const JUROS_DO_CENARIO = 1;

/**
 * Os mesmos dois percentuais **como o banco os guarda** — `numeric(5,2)`, portanto com as duas casas.
 *
 * A leitura crua entra ao lado da leitura pela rota porque as duas dizem coisas diferentes: a rota
 * publica `number`, e uma escrita que gravasse `2` em vez de `2.00`, ou que reescrevesse a linha com o
 * mesmo valor, seria invisível ali. É a forma literal que a §6.6 da T11 pede.
 */
const MULTA_GRAVADA = '2.00';
const JUROS_GRAVADO = '1.00';

/**
 * A distância, em dias, entre o relógio do banco e o vencimento das cobranças do cenário.
 *
 * Positiva, e é ela que torna `A_VENCER` consequência do **cenário** em vez do calendário — a mesma
 * convenção, e o mesmo eixo (`negocio.data_corrente_da_operacao()`), de `cobrancas.e2e.spec.ts`.
 * Trinta dias é folga larga o bastante para que a virada do dia durante a execução não mova nada.
 */
const DIAS_ATE_O_VENCIMENTO = 30;

/** O estado que as duas cobranças do cenário publicam antes e depois das sete recusas. */
const ESTADO_EM_ABERTO = 'A_VENCER';

/** A natureza e a referência das cobranças do cenário — valores quaisquer, dentro do contrato. */
const NATUREZA_DO_CENARIO = 'ALUGUEL';
const REFERENCIA_DO_CENARIO = 'Competência do período — parcela';

/**
 * O valor original de cada cobrança do cenário.
 *
 * Ele **não** é derivado do valor mensal do contrato: a cobrança avulsa não o herda, e amarrá-los faria
 * este arranjo depender de uma regra que não existe.
 */
const VALOR_DA_COBRANCA = 2500;

/** A mensagem canônica da recusa de autorização — literal, e não importada da guarda. */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** A mensagem canônica do recurso não encontrado. */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** Um identificador bem formado que não existe em empresa alguma — o controle do `CT-321`. */
const UUID_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

/** Quantas rotas a fatia publica — a âncora contra tabela truncada em silêncio. */
const ROTAS_DA_FATIA = 33;

/** Quantas delas exigem a ação sensível: cinco entidades circuláveis × duas transições. */
const ROTAS_DE_CIRCULACAO = 10;

/** A pessoa cujo efetivo o `CT-319` NEGA — `USUARIO_EMPRESA` da empresa A, da carga. */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

/** O Admin da empresa A: a matriz do perfil dele é o catálogo inteiro (as 17 chaves). */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/** O Admin da empresa B — a outra ponta do `CT-321`, com a mesma matriz plena na empresa dele. */
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

/** A sessão plena da empresa A — cria os recursos e é o eixo positivo do `CT-319`. */
let cookiePleno: string;

/** A sessão da empresa A a quem as DUAS áreas foram explicitamente negadas. */
let cookieSemArea: string;

/** A sessão plena da empresa B — a outra ponta do `CT-321`. */
let cookieDeB: string;

/** Os recursos da empresa A que a tabela das 33 rotas endereça. */
let alvos: AlvosDoDominio;

/**
 * A aplicação **instrumentada** dos casos da régua, e o capturador que ela recebe no lugar do SMTP.
 *
 * ⚠️ **Ela é a aplicação de produção montada POR INTEIRO**, e não uma montagem reduzida: a mesma
 * composição raiz, o mesmo roteador, as mesmas guardas e o mesmo prefixo global. A substituição é
 * feita pelo **arcabouço de teste** (`overrideProvider` sobre o token que a composição já publica) e
 * alcança **só o destino da mensagem**: `criarAplicacao()` não ganhou parâmetro, nada em
 * `apps/api/src` ganhou bandeira ou ramo, e o capturador implementa a MESMA `PortaDeEnvioDeEmail` do
 * adaptador de produção — de dentro, a régua não sabe qual dos dois recebeu (Iron Law #6).
 *
 * Ela existe porque *"nada muda"* e *"+1 captura"* são metade do que o `CT-633` e o `CT-634` medem, e
 * a lista de capturas é a única forma de observar o que **saiu para o mundo** sem falar com um SMTP
 * de verdade. É o mesmo mecanismo, sobre o mesmo token, de `automacao-de-cobranca.e2e.spec.ts`.
 *
 * Ela divide a instância efêmera de banco com a aplicação acima — as sessões são estado do banco —, e
 * tem porta reservada própria, porque o arcabouço de identidade confere a origem das requisições com
 * cookie contra o endereço base.
 */
let aplicacaoComCaptura: NestFastifyApplication;
let baseComCaptura: string;
let capturador: CapturadorDeEmail;

/** A sessão plena da empresa A **na aplicação instrumentada** — quem grava a precondição dos casos. */
let cookiePlenoComCaptura: string;

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

  cookiePleno = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(ADMIN_DE_B.email, SENHA_DA_CARGA);

  // A NEGAÇÃO explícita das duas áreas — ver o cabeçalho: sem ela, um piso de perfil que já
  // concedesse a área faria o eixo negativo do `CT-319` provar outra coisa.
  cookieSemArea = await entrar(QUEM_NAO_ALCANCA.email, SENHA_DA_CARGA);
  await ajustar(QUEM_NAO_ALCANCA.id, EMPRESA_A.id, [
    { chave: AREA_DOS_IMOVEIS, efeito: 'NEGADA' },
    { chave: AREA_DOS_CADASTROS, efeito: 'NEGADA' },
  ]);

  alvos = await criarAlvosDoDominio(cookiePleno);

  // -------------------------------------------------------------------------------------------
  // A aplicação INSTRUMENTADA dos casos da régua — a porta de e-mail trocada de fora (T12)
  // -------------------------------------------------------------------------------------------
  capturador = criarCapturadorDeEmail();

  const portaComCaptura = await reservarPorta();
  baseComCaptura = `http://${ENDERECO_DE_ESCUTA}:${String(portaComCaptura)}`;
  process.env.PORT = String(portaComCaptura);

  // DÉBITO COM GATILHO — D57 · F3/T12 · registrado 2026-08-12
  // (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o bloco abaixo.)
  // O QUÊ: esta é uma de QUATRO cópias literais da montagem instrumentada — as outras três estão em
  //        `apps/api/test/automacao-de-cobranca.e2e.spec.ts`,
  //        `apps/api/test/equivalencia-com-o-oraculo.spec.ts` e
  //        `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts` (esta última nasceu na T17 da fatia
  //        `emissao-e-conciliacao`, que DEFERIU o fecho — ver o `QUANDO FECHA`). Ela não deriva de
  //        `criarAplicacao()`
  //        e por isso omite `logger: false`, `abortOnError: false`, o `exclude` do prefixo,
  //        `publicarContrato()` e `enableShutdownHooks()`. NENHUMA delas alcança o que os casos
  //        medem — guarda, filtro de erro e interceptador de contexto são registrados por
  //        `APP_GUARD`/`APP_FILTER`/`APP_INTERCEPTOR` DENTRO do `AppModule`.
  // QUANDO FECHA: ⚠️ **O GATILHO JÁ DISPAROU DUAS VEZES, e as duas donas deferiram.** A terceira
  //        suíte instrumentada existe desde ANTES da sub-fatia `documentos-e-confirmacao` (a T12
  //        dela apenas MEDIU o fato). A QUARTA nasceu na T17 da fatia `emissao-e-conciliacao`, que
  //        também deferiu, invocando a proibição 5 do Protocolo — e o Gate 2 dela registrou que o
  //        argumento procede para o FECHO INTEGRAL, mas não para a decisão de acrescentar mais uma
  //        cópia: havia caminho intermediário que não toca arquivo algum fora do escopo, que é
  //        fazer nascer o acessório e consumi-lo SÓ do arquivo novo. ⚠️ **É esse o caminho para o
  //        próximo dono** — quem abrir a PRÓXIMA suíte que precisar da montagem instrumentada, ou a
  //        primeira edição de qualquer uma das QUATRO por outra razão: a casa compartilhada nasce,
  //        o consumidor novo a usa, e os anteriores migram quando forem abertos por outra razão.
  //        Segue valendo, como segundo gatilho, a primeira vez que `criarAplicacao()` registrar um
  //        global FORA do `AppModule`. A divergência entre a montagem que atende e as instrumentadas
  //        não reprova caso algum: a asserção que a acusaria não existe — e agora ela deixaria
  //        TRÊS para trás, não duas.
  // POR QUE NÃO AGORA: a convenção deste repositório agenda a promoção de símbolo duplicado no
  //        TERCEIRO consumidor (é a forma do D1 · F3/T2 e do D26 · F3/T8) — o terceiro chegou, o
  //        quarto também, e o que adia o fecho hoje é escopo de task, não a contagem.
  // ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D57
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_PORTA_DE_EMAIL)
    .useValue(capturador)
    .compile();

  aplicacaoComCaptura = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso desta aplicação toca as rotas de
  // saúde nem o contrato publicado, e reproduzir a lista aqui criaria uma segunda cópia dela livre
  // para divergir. O que importa é que `/v1/auth` e as quatro rotas da área atendam sob o prefixo.
  aplicacaoComCaptura.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacaoComCaptura.listen({ port: portaComCaptura, host: ENDERECO_DE_ESCUTA });

  cookiePlenoComCaptura = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA, baseComCaptura);

  // A precondição da sessão privilegiada é AFIRMADA, e não presumida da matriz do perfil: é ela que
  // grava a política e o histórico dos dois casos, e um `403` aqui os faria medir outra coisa.
  const efetivoPleno = await efetivoDe(cookiePlenoComCaptura, baseComCaptura);
  expect(efetivoPleno.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
  expect(efetivoPleno.acoes).toContain(ACAO_DE_ENVIO_MANUAL);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoComCaptura?.close();
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

describe('as provas de segurança sobre as rotas do domínio (T11) e sobre as ações do contrato', () => {
  it(
    'CT-319 — quem não alcança a área é recusado nas 33 rotas, com a chave DAQUELA área nomeada',
    async () => {
      const tabela = rotasDoDominio(alvos);

      // A tabela cobre a superfície inteira — afirmado sobre ela ANTES de percorrê-la. Tabela
      // truncada é o modo de falha silencioso desta classe de caso.
      expect(tabela.length).toBe(ROTAS_DA_FATIA);
      expect(tabela.filter((rota) => rota.area === AREA_DOS_IMOVEIS).length).toBe(15);
      expect(tabela.filter((rota) => rota.area === AREA_DOS_CADASTROS).length).toBe(18);

      // Precondição AFIRMADA: o efetivo publicado NÃO tem nenhuma das duas áreas.
      const semArea = await efetivoDe(cookieSemArea);
      expect(semArea.telas).not.toContain(AREA_DOS_IMOVEIS);
      expect(semArea.telas).not.toContain(AREA_DOS_CADASTROS);

      // E o da sessão plena TEM as duas, mais a ação — é o que dá sentido ao eixo positivo.
      const pleno = await efetivoDe(cookiePleno);
      expect(pleno.telas).toContain(AREA_DOS_IMOVEIS);
      expect(pleno.telas).toContain(AREA_DOS_CADASTROS);
      expect(pleno.acoes).toContain(ACAO_SENSIVEL);

      // --- Eixo NEGATIVO: as 33 rotas recusam, nomeando a chave DAQUELA área -------------------
      const recusadas: string[] = [];
      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookieSemArea,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(resposta.status, `${rota.rotulo} respondeu ${String(resposta.status)}`).toBe(403);
        // Corpo INTEIRO por igualdade: `detalhes.exigido` é a chave da área **daquela** rota, e não
        // uma genérica. Uma recusa que nomeasse sempre a mesma chave reprova em metade da tabela.
        expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: rota.area },
        });
        recusadas.push(rota.rotulo);
      }
      expect(recusadas.length).toBe(ROTAS_DA_FATIA);

      // --- Eixo POSITIVO: nenhuma das 33 responde 403 a quem TEM a chave -----------------------
      // Sem ele, uma guarda que recusasse tudo passaria o eixo inteiro acima. A leva é NOVA: o eixo
      // positivo escreve de verdade — cria, altera, retira, recircula e remove o cômodo —, e reusar
      // os alvos do eixo negativo deixaria o `CT-320` observando o que este caso mexeu.
      //
      // A asserção é de SUCESSO (`2xx`), e não de "diferente de 403": as 33 requisições são
      // bem-formadas e endereçam recursos que existem, de modo que qualquer outra recusa — `404` de
      // alcance, `422` de esquema — também seria defeito. Um "diferente de 403" aceitaria a
      // superfície inteira respondendo `422`, que é o eixo positivo vazio.
      const alcancadas: string[] = [];
      for (const rota of rotasDoDominio(await criarAlvosDoDominio(cookiePleno))) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookiePleno,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(
          { rotulo: rota.rotulo, sucesso: resposta.status >= 200 && resposta.status < 300 },
          `${rota.rotulo} respondeu ${String(resposta.status)} a quem TEM a chave: ${resposta.texto}`,
        ).toEqual({ rotulo: rota.rotulo, sucesso: true });
        alcancadas.push(rota.rotulo);
      }
      expect(alcancadas).toEqual(recusadas);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 — retirar exige a ação sensível: a recusa nomeia a AÇÃO, e o cadastro segue em circulação',
    async () => {
      // Sujeito EXCLUSIVO deste caso: é o efetivo dele que o caso altera no passo positivo, e
      // compartilhá-lo faria os demais casos observarem uma permissão que este concedeu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.administra');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação: é ela que torna o `403` atribuível à ação, e não ao piso.
        { chave: ACAO_SENSIVEL, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA: TEM as duas áreas, NÃO tem a ação. É o que discrimina — uma
      // implementação que exigisse só a área passaria o `403` de quem não tem nada e falharia aqui.
      const antes = await efetivoDe(sujeito.cookie);
      expect(antes.telas).toContain(AREA_DOS_IMOVEIS);
      expect(antes.telas).toContain(AREA_DOS_CADASTROS);
      expect(antes.acoes).not.toContain(ACAO_SENSIVEL);

      const circulaveis = entidadesCirculaveis(alvos);
      expect(circulaveis.length).toBe(5);
      // As DUAS famílias de área — ver o cabeçalho: nas de pessoa a área coincide com
      // `MAPA_ACAO_TELA[ACAO]`, e só nas de imóvel a coincidência não existe.
      expect(new Set(circulaveis.map((entidade) => entidade.area)).size).toBe(2);

      // --- Eixo NEGATIVO: as 10 rotas recusam nomeando a AÇÃO, e nada muda ---------------------
      const recusadas: string[] = [];
      for (const entidade of circulaveis) {
        for (const transicao of ['retirada', 'recirculacao'] as const) {
          const rotulo = `POST ${entidade.item}/${transicao}`;
          const resposta = await pedir(`${entidade.item}/${transicao}`, {
            metodo: 'POST',
            cookie: sujeito.cookie,
            corpo: {},
          });

          expect(resposta.status, `${rotulo} respondeu ${String(resposta.status)}`).toBe(403);
          // A chave nomeada é a AÇÃO — e **não** a área, que a sessão possui. Nomear a área seria a
          // recusa genérica que a ADR-0011 rejeita.
          expect(resposta.corpo, `a recusa de ${rotulo} mudou de forma`).toEqual({
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: ACAO_SENSIVEL },
          });

          // O ESTADO depois da recusa — é o que separa "recusou" de "recusou depois de gravar".
          expect(
            await marcaDeRetirada(entidade.item, sujeito.cookie),
            `${rotulo} recusou, mas mexeu na marca de circulação`,
          ).toBeNull();

          recusadas.push(rotulo);
        }
      }
      expect(recusadas.length).toBe(ROTAS_DE_CIRCULACAO);

      // --- Eixo POSITIVO: concedida a AÇÃO, a MESMA rota passa a responder 200 -----------------
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
      ]);

      const depois = await efetivoDe(sujeito.cookie);
      expect(depois.acoes).toContain(ACAO_SENSIVEL);

      for (const entidade of circulaveis) {
        const retirada = await pedir(`${entidade.item}/retirada`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(
          retirada.status,
          `a retirada de ${entidade.item} respondeu ${String(retirada.status)}: ${retirada.texto}`,
        ).toBe(200);
        expect(await marcaDeRetirada(entidade.item, sujeito.cookie)).not.toBeNull();
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 (b) — ter a ação de circulação não dá a de ativar: a recusa nomeia ACAO:ativar_contrato',
    async () => {
      // Sujeito EXCLUSIVO deste caso, pela mesma razão do `CT-320`: o efetivo dele é o que está sob
      // prova, e compartilhá-lo faria os demais casos observarem uma permissão que este escreveu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.circula.contrato');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_CONTRATOS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação de ativar: é ela que torna o `403` atribuível a essa ação, e
        // não ao piso do perfil.
        { chave: ACAO_DE_ATIVAR_CONTRATO, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA nas TRÊS pontas, e as três importam: ela alcança a área da classe, TEM
      // a outra ação sensível da MESMA superfície, e NÃO tem a que está sob prova.
      const efetivo = await efetivoDe(sujeito.cookie);
      expect(efetivo.telas).toContain(AREA_DOS_CONTRATOS);
      expect(efetivo.acoes).toContain(ACAO_SENSIVEL);
      expect(efetivo.acoes).not.toContain(ACAO_DE_ATIVAR_CONTRATO);

      // --- Arranjo: um rascunho montado pela PRÓPRIA sessão -------------------------------------
      const partes = await criarAlvosDoDominio(sujeito.cookie);
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: corpoDeContrato(partes),
      });
      expect(criacao.status, criacao.texto).toBe(201);
      const codigo = (criacao.corpo as { codigo: string }).codigo;

      // --- Eixo POSITIVO da ação que ela TEM: retirar e recircular respondem 200 ---------------
      //
      // Ele vem ANTES do eixo negativo de propósito: sem ele, o `403` da ativação seria compatível
      // com uma sessão que não alcança nada da superfície, e o caso não diria nada sobre a
      // independência entre as duas ações.
      for (const transicao of ['retirada', 'recirculacao'] as const) {
        const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/${transicao}`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(aceita.status, `${transicao}: ${aceita.texto}`).toBe(200);
      }

      // --- Eixo NEGATIVO: ativar recusa, nomeando a ação que FALTA -----------------------------
      const recusada = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(recusada.status).toBe(403);
      // Corpo INTEIRO por igualdade, e `exigido` nomeando **`ACAO:ativar_contrato`**. É esta linha
      // que acusa a rota que declarasse a ação errada por cópia da vizinha: com a sessão possuindo
      // `ACAO:excluir_cadastro`, uma exigência copiada responderia `200` aqui.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_ATIVAR_CONTRATO },
      });

      // --- E NADA transitou --------------------------------------------------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma implementação que gravasse e só então
      // recusasse passaria em tudo acima e reprovaria aqui.
      const contrato = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}`, { cookie: sujeito.cookie });
      expect(contrato.status).toBe(200);
      expect((contrato.corpo as { status: string }).status).toBe('RASCUNHO');

      const imovel = await pedir(`${colecao(CAMINHO_DOS_IMOVEIS)}/${partes.imovelId}`, {
        cookie: sujeito.cookie,
      });
      expect(imovel.status).toBe(200);
      expect((imovel.corpo as { statusLocacao: string }).statusLocacao).toBe('DISPONIVEL');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 (c) — ter a ação de ativar não dá a de cancelar: a recusa nomeia ACAO:cancelar_contrato',
    async () => {
      // Sujeito EXCLUSIVO deste caso, pela mesma razão do `CT-320 (b)`.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.ativa.contrato');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_CONTRATOS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        // As DUAS outras ações sensíveis que a superfície de contrato conhece. É o efetivo mais
        // generoso que ainda **não** deve poder cancelar — e é exatamente ele que discrimina.
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
        { chave: ACAO_DE_ATIVAR_CONTRATO, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação sob prova: é ela que torna o `403` atribuível a essa ação, e
        // não ao piso do perfil.
        { chave: ACAO_DE_CANCELAR_CONTRATO, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA nas QUATRO pontas: ela alcança a área da classe, TEM as duas outras
      // ações sensíveis da MESMA superfície, e NÃO tem a que está sob prova.
      const efetivo = await efetivoDe(sujeito.cookie);
      expect(efetivo.telas).toContain(AREA_DOS_CONTRATOS);
      expect(efetivo.acoes).toContain(ACAO_SENSIVEL);
      expect(efetivo.acoes).toContain(ACAO_DE_ATIVAR_CONTRATO);
      expect(efetivo.acoes).not.toContain(ACAO_DE_CANCELAR_CONTRATO);

      // --- Arranjo: um contrato VIGENTE, montado e ativado pela PRÓPRIA sessão ------------------
      const partes = await criarAlvosDoDominio(sujeito.cookie);
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: corpoDeContrato(partes),
      });
      expect(criacao.status, criacao.texto).toBe(201);
      const codigo = (criacao.corpo as { codigo: string }).codigo;

      // --- Eixo POSITIVO das ações que ela TEM: ativar e circular respondem 200 ----------------
      //
      // Ele vem ANTES do eixo negativo de propósito. Sem a ativação aqui, o contrato seria um
      // rascunho e a recusa do cancelamento poderia ser a `422` da guarda de ESTADO em vez da `403`
      // da guarda de autorização — o caso mediria outra coisa. E sem a retirada, o `403` seria
      // compatível com uma sessão que não alcança ação alguma da superfície.
      const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });
      expect(ativacao.status, `ativacao: ${ativacao.texto}`).toBe(200);

      for (const transicao of ['retirada', 'recirculacao'] as const) {
        const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/${transicao}`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(aceita.status, `${transicao}: ${aceita.texto}`).toBe(200);
      }

      // --- Eixo NEGATIVO: cancelar recusa, nomeando a ação que FALTA ---------------------------
      const recusada = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/cancelamento`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(recusada.status).toBe(403);
      // Corpo INTEIRO por igualdade, e `exigido` nomeando **`ACAO:cancelar_contrato`**. É esta linha
      // que acusa a rota que declarasse a ação de uma das vizinhas — as quatro rotas que declaram no
      // método são adjacentes no controlador —, porque a sessão **tem** as duas outras: uma exigência
      // copiada responderia `200` aqui, e o `403` do `CT-426` não mostraria a escalada.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_CANCELAR_CONTRATO },
      });

      // --- E NADA transitou --------------------------------------------------------------------
      //
      // As DUAS metades: uma implementação que cancelasse e só então recusasse passaria em tudo
      // acima e reprova aqui, e a segunda escrita do ato — a liberação do imóvel — também não pode
      // ter acontecido.
      const contrato = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}`, { cookie: sujeito.cookie });
      expect(contrato.status).toBe(200);
      expect((contrato.corpo as { status: string }).status).toBe('ATIVO');

      const imovel = await pedir(`${colecao(CAMINHO_DOS_IMOVEIS)}/${partes.imovelId}`, {
        cookie: sujeito.cookie,
      });
      expect(imovel.status).toBe(200);
      expect((imovel.corpo as { statusLocacao: string }).statusLocacao).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-321 — cadastro de outra empresa é indistinguível de inexistente nas rotas de `:id`',
    async () => {
      // Precondição AFIRMADA: a sessão de B tem a área e a ação — a recusa precisa vir do
      // não-alcance, e não de permissão que lhe falte.
      const deB = await efetivoDe(cookieDeB);
      expect(deB.telas).toContain(AREA_DOS_IMOVEIS);
      expect(deB.telas).toContain(AREA_DOS_CADASTROS);
      expect(deB.acoes).toContain(ACAO_SENSIVEL);

      // Os cadastros de A são criados PELA SESSÃO DE A, e o identificador que B usa é o que aquela
      // criação devolveu: o caso prova o outro lado — conhecer o identificador alheio não basta.
      const deA = entidadesCirculaveis(await criarAlvosDoDominio(cookiePleno));
      const proprios = entidadesCirculaveis(await criarAlvosDoDominio(cookieDeB));
      expect(deA.length).toBe(5);
      expect(proprios.length).toBe(5);

      // O estado inicial de cada cadastro de A, serializado pela sessão de A.
      const estadoInicial = await Promise.all(
        deA.map(async (e) => await lerPor(e.item, cookiePleno)),
      );

      const conferidas: string[] = [];
      for (const [indice, entidade] of deA.entries()) {
        const inexistente = entidade.item.replace(/[^/]+$/u, UUID_INEXISTENTE);

        for (const rota of ROTAS_DE_IDENTIFICADOR) {
          const alheio = await pedir(rota.alvo(entidade.item), {
            metodo: rota.metodo,
            cookie: cookieDeB,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo(entidade) }),
          });
          const nenhum = await pedir(rota.alvo(inexistente), {
            metodo: rota.metodo,
            cookie: cookieDeB,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo(entidade) }),
          });

          const rotulo = `${rota.metodo} ${entidade.nome}${rota.sufixo}`;
          expect(alheio.status, `${rotulo} (alheio) respondeu ${String(alheio.status)}`).toBe(404);
          expect(nenhum.status, `${rotulo} (inexistente) respondeu ${String(nenhum.status)}`).toBe(
            404,
          );
          // Corpos PROFUNDAMENTE iguais, e ambos iguais ao envelope canônico: um `404` que trouxesse
          // `campo` ou `detalhes` só no caso alheio revelaria a existência do recurso da outra
          // empresa, que é exatamente o que o caso existe para impedir.
          expect(alheio.corpo, `${rotulo}: o alheio é distinguível do inexistente`).toEqual(
            nenhum.corpo,
          );
          expect(alheio.corpo).toEqual({
            codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
            mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
          });

          conferidas.push(rotulo);
        }

        // Eixo POSITIVO: a MESMA sessão de B alcança o cadastro PRÓPRIO da mesma entidade.
        const proprio = proprios[indice];
        if (proprio === undefined) {
          throw new Error(`sem cadastro próprio de B para ${entidade.nome}`);
        }
        const alcance = await pedir(proprio.item, { cookie: cookieDeB });
        expect(alcance.status, `B não alcança o próprio ${proprio.nome}: ${alcance.texto}`).toBe(
          200,
        );
      }

      expect(conferidas.length).toBe(deA.length * ROTAS_DE_IDENTIFICADOR.length);

      // O estado de A é o MESMO depois das vinte tentativas — nenhuma delas gravou nada.
      const estadoFinal = await Promise.all(
        deA.map(async (e) => await lerPor(e.item, cookiePleno)),
      );
      expect(estadoFinal).toEqual(estadoInicial);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-534 — sem a área exigida, as sete rotas da fatia de cobrança recusam com 403 e nada muda',
    async () => {
      // ---------------------------------------------------------------------------------------
      // Os sujeitos: a área é concedida E RETIRADA pelo caminho real de administração
      // ---------------------------------------------------------------------------------------
      //
      // Cada um é EXCLUSIVO deste caso, pela mesma razão do `CT-320`: é o efetivo deles que está sob
      // prova. A matriz admite ajuste bidirecional, e as duas direções são usadas — cada sujeito
      // recebe uma das áreas por CONCESSÃO e perde a outra por NEGAÇÃO explícita. A negação não é
      // zelo: o efetivo é `(matriz do perfil ∪ concedidas) − negadas`, e sem ela o piso do perfil
      // poderia já conceder a área — o que é literalmente o caso do `ADMIN_EMPRESA`, cuja matriz é o
      // catálogo inteiro.
      const semFinanceiro = await pessoaOperandoComSenhaTrocada('so.multa.e.juros');
      await ajustar(semFinanceiro.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DE_MULTA_E_JUROS, efeito: 'CONCEDIDA' },
        { chave: AREA_DO_FINANCEIRO, efeito: 'NEGADA' },
      ]);

      const semMultaEJuros = await pessoaOperandoComSenhaTrocada('so.financeiro');
      await ajustar(semMultaEJuros.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DO_FINANCEIRO, efeito: 'CONCEDIDA' },
        { chave: AREA_DE_MULTA_E_JUROS, efeito: 'NEGADA' },
      ]);

      const comAsDuas = await pessoaOperandoComSenhaTrocada('alcanca.as.duas');
      await ajustar(comAsDuas.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DO_FINANCEIRO, efeito: 'CONCEDIDA' },
        { chave: AREA_DE_MULTA_E_JUROS, efeito: 'CONCEDIDA' },
      ]);

      // O quarto sujeito é de PERFIL DIFERENTE, e existe só para o eixo de indistinguibilidade: a
      // matriz do `ADMIN_EMPRESA` concede as 17 chaves, de modo que aqui a **retirada** é o único
      // ajuste — é ela que produz um Admin sem alcance ao financeiro.
      //
      // As duas ações sensíveis da área saem **junto**, e não por zelo: a RN-02 recusa o conjunto que
      // deixasse uma ação concedida sem a tela que a comporta, e `validarCoerenciaDeAjustes` examina o
      // efetivo RESULTANTE — retirar só a área deixaria `ACAO:emitir_boleto` e
      // `ACAO:solicitar_baixa_de_boleto` órfãs, e a escrita seria recusada. É a regra de domínio
      // funcionando, e é ela que fixa **quais** são as duas ações daquela área: as mesmas que o
      // `CT-533` enumera ao afirmar que o catálogo não tem ação para pagar nem para cancelar cobrança.
      const adminSemFinanceiro = await pessoaOperandoComSenhaTrocada(
        'admin.sem.financeiro',
        'ADMIN_EMPRESA',
      );
      await ajustar(adminSemFinanceiro.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DO_FINANCEIRO, efeito: 'NEGADA' },
        { chave: ACAO_DE_EMITIR_BOLETO, efeito: 'NEGADA' },
        { chave: ACAO_DE_SOLICITAR_BAIXA, efeito: 'NEGADA' },
      ]);

      // Precondições AFIRMADAS pelo caminho real (`GET /v1/sessao`), nunca supostas: sem elas, um
      // `403` seria indistinguível de sessão quebrada, e o controle positivo, de sessão privilegiada.
      const efetivoSemFinanceiro = await efetivoDe(semFinanceiro.cookie);
      expect(efetivoSemFinanceiro.telas).not.toContain(AREA_DO_FINANCEIRO);
      expect(efetivoSemFinanceiro.telas).toContain(AREA_DE_MULTA_E_JUROS);

      const efetivoSemMulta = await efetivoDe(semMultaEJuros.cookie);
      expect(efetivoSemMulta.telas).toContain(AREA_DO_FINANCEIRO);
      expect(efetivoSemMulta.telas).not.toContain(AREA_DE_MULTA_E_JUROS);

      const efetivoComAsDuas = await efetivoDe(comAsDuas.cookie);
      expect(efetivoComAsDuas.telas).toContain(AREA_DO_FINANCEIRO);
      expect(efetivoComAsDuas.telas).toContain(AREA_DE_MULTA_E_JUROS);

      const efetivoDoAdmin = await efetivoDe(adminSemFinanceiro.cookie);
      expect(efetivoDoAdmin.telas).not.toContain(AREA_DO_FINANCEIRO);
      // Os PERFIS são diferentes — é o que dá sentido a "indistinguível entre perfis". Sem esta
      // linha, o eixo final compararia duas sessões do mesmo perfil e não provaria nada.
      expect(efetivoDoAdmin.perfil).not.toBe(efetivoSemFinanceiro.perfil);

      // ---------------------------------------------------------------------------------------
      // O cenário: duas cobranças A_VENCER e a política de mora, tudo pelas rotas reais
      // ---------------------------------------------------------------------------------------
      const cenario = await montarCenarioDeCobranca(cookiePleno);
      const tabela = rotasDaFatiaDeCobranca(cenario);

      // A tabela cobre a superfície inteira da fatia — afirmado sobre ela ANTES de percorrê-la.
      expect(tabela.length).toBe(ROTAS_DA_FATIA_DE_COBRANCA);
      expect(tabela.filter((rota) => rota.area === AREA_DO_FINANCEIRO).length).toBe(5);
      expect(tabela.filter((rota) => rota.area === AREA_DE_MULTA_E_JUROS).length).toBe(2);

      // --- Passo 1: o estado ANTES, nas três formas que as sete rotas podem tocar --------------
      const xminAntes = {
        paraPagar: await xminDaCobranca(cenario.paraPagar.codigo),
        paraCancelar: await xminDaCobranca(cenario.paraCancelar.codigo),
      };
      const politicaAntes = await linhaDaPolitica();
      const politicaPublicadaAntes = await lerPolitica(cookiePleno);
      const cobrancasAntes = await contarCobrancas(EMPRESA_A.id);

      // --- Passos 2 e 3: as sete recusam, cada uma nomeando a área DAQUELA rota ----------------
      //
      // A credencial é escolhida pela área da rota: quem exercita as cinco de cobrança é a sessão a
      // quem `TELA:financeiro` foi retirada, e quem exercita as duas de mora é a sessão a quem
      // `TELA:multa_e_juros` foi retirada. As duas TÊM a outra área, e é isso que torna o `403`
      // atribuível à área que falta — uma sessão sem nenhuma das duas seria recusada nas sete mesmo
      // que as rotas exigissem a área trocada.
      const credencialSemAArea = new Map<ChaveDoCatalogo, string>([
        [AREA_DO_FINANCEIRO, semFinanceiro.cookie],
        [AREA_DE_MULTA_E_JUROS, semMultaEJuros.cookie],
      ]);

      const recusadas: string[] = [];
      const corposDaRecusa = new Map<string, unknown>();

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: credencialSemAArea.get(rota.area) ?? '',
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(resposta.status, `${rota.rotulo} respondeu ${String(resposta.status)}`).toBe(403);
        // O envelope INTEIRO por igualdade (ADR-0017): `detalhes.exigido` é a chave da área
        // **daquela** rota, e não uma genérica — e não há `campo`, porque a recusa não é de entrada.
        // Uma recusa que nomeasse sempre a mesma chave reprova em duas das sete.
        expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: rota.area },
        });

        recusadas.push(rota.rotulo);
        corposDaRecusa.set(rota.rotulo, resposta.corpo);
      }
      expect(recusadas.length).toBe(ROTAS_DA_FATIA_DE_COBRANCA);

      // As sete recusas são idênticas ENTRE SI dentro de cada área, **byte a byte** — há exatamente
      // duas formas distintas na serialização, uma por área. A igualdade do laço acima é profunda e
      // não alcança a ordem das chaves; esta linha alcança, e é ela que impede a recusa de virar
      // oráculo por diferença de forma entre duas rotas da mesma área.
      expect(
        new Set([...corposDaRecusa.values()].map((corpo) => JSON.stringify(corpo))).size,
        'as recusas das sete rotas não são idênticas byte a byte dentro de cada área',
      ).toBe(2);

      // --- Passo 4: a cobrança alvo está intacta — `status` e `xmin` -----------------------------
      //
      // O `xmin` é o identificador da transação que gravou a versão corrente da linha, e ele muda a
      // cada `UPDATE`: é o que separa *recusado* de *recusado depois de gravar*. O `status` sozinho
      // não bastaria — uma escrita que gravasse os mesmos valores o preservaria.
      expect(await lerCobranca(cookiePleno, cenario.paraPagar.codigo)).toMatchObject({
        codigo: cenario.paraPagar.codigo,
        status: ESTADO_EM_ABERTO,
        pagoEm: null,
        canceladoEm: null,
      });
      expect(await lerCobranca(cookiePleno, cenario.paraCancelar.codigo)).toMatchObject({
        codigo: cenario.paraCancelar.codigo,
        status: ESTADO_EM_ABERTO,
        pagoEm: null,
        canceladoEm: null,
      });
      expect({
        paraPagar: await xminDaCobranca(cenario.paraPagar.codigo),
        paraCancelar: await xminDaCobranca(cenario.paraCancelar.codigo),
      }).toEqual(xminAntes);

      // E nenhuma linha NOVA nasceu: é o que o `xmin` não alcança, porque o `POST` da coleção não
      // toca as duas tuplas observadas — ele criaria uma terceira.
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(cobrancasAntes);

      // --- Passo 5: a política de mora está intacta, na rota e na linha -------------------------
      //
      // As duas leituras dizem coisas diferentes: a rota publica os percentuais como números, e a
      // linha crua carrega a escala gravada mais o `xmin` — que é o que acusa um `PUT` que
      // reescrevesse a mesma política. Sem o `xmin`, a única rota de escrita desta superfície teria
      // uma escrita idempotente invisível.
      expect(politicaPublicadaAntes).toEqual({
        multaPercentual: MULTA_DO_CENARIO,
        jurosPercentual: JUROS_DO_CENARIO,
      });
      expect(await lerPolitica(cookiePleno)).toEqual(politicaPublicadaAntes);
      expect(politicaAntes.multaPercentual).toBe(MULTA_GRAVADA);
      expect(politicaAntes.jurosPercentual).toBe(JUROS_GRAVADO);
      expect(await linhaDaPolitica()).toEqual(politicaAntes);

      // --- Passo 6: CONTROLE POSITIVO — a permissão certa passa nas SETE ------------------------
      //
      // Ele é obrigatório, e é a lição registrada da F0: uma guarda que recusasse **tudo** passaria o
      // eixo negativo inteiro acima. São as MESMAS sete chamadas, com os mesmos corpos, sobre os
      // mesmos recursos — o que muda é só a sessão, e é isso que torna a diferença atribuível à
      // permissão.
      //
      // A asserção é de SUCESSO (`2xx`), e não de "diferente de 403": as sete requisições são
      // bem-formadas e endereçam recursos que existem, de modo que qualquer outra recusa — `404` de
      // alcance, `422` de esquema — também seria defeito. Um "diferente de 403" aceitaria a
      // superfície inteira respondendo `422`, que é o controle positivo vazio.
      const alcancadas: string[] = [];
      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: comAsDuas.cookie,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(
          { rotulo: rota.rotulo, sucesso: resposta.status >= 200 && resposta.status < 300 },
          `${rota.rotulo} respondeu ${String(resposta.status)} a quem TEM a área: ${resposta.texto}`,
        ).toEqual({ rotulo: rota.rotulo, sucesso: true });
        alcancadas.push(rota.rotulo);
      }
      expect(alcancadas).toEqual(recusadas);

      // --- Passo 7: o corpo da recusa é INDISTINGUÍVEL entre perfis -----------------------------
      //
      // O Admin sem alcance ao financeiro e o Usuário sem alcance ao financeiro recebem o MESMO corpo,
      // byte a byte, nas cinco rotas de cobrança. É o invariante de `recusa-indistinguivel.e2e.spec.ts`
      // aplicado à autorização: um corpo que variasse com o perfil — uma mensagem mais específica para
      // quem "quase" alcança — transformaria a recusa em oráculo sobre o perfil de quem pergunta.
      const conferidas: string[] = [];
      for (const rota of tabela.filter((candidata) => candidata.area === AREA_DO_FINANCEIRO)) {
        const doAdmin = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: adminSemFinanceiro.cookie,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(doAdmin.status, `${rota.rotulo} (Admin) respondeu ${String(doAdmin.status)}`).toBe(
          403,
        );
        expect(
          doAdmin.corpo,
          `${rota.rotulo}: a recusa do Admin é distinguível da do Usuário`,
        ).toEqual(corposDaRecusa.get(rota.rotulo));
        conferidas.push(rota.rotulo);
      }
      expect(conferidas.length).toBe(5);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-633 — sem a área da automação, as quatro rotas da régua recusam com 403 e NADA muda',
    async () => {
      // ---------------------------------------------------------------------------------------
      // O cenário e a PRECONDIÇÃO com conteúdo: política e histórico gravados por OUTRA pessoa
      // ---------------------------------------------------------------------------------------
      //
      // Sem uma política já gravada e um aviso já registrado, *"nada muda"* seria afirmado sobre a
      // ausência — e a ausência é justamente o que uma escrita indevida que falhasse também
      // produziria. Os dois nascem pela mão da sessão privilegiada, e pelas rotas reais.
      const cenario = await cenarioDoDisparoManual();

      await definirPoliticaDeAviso(cookiePlenoComCaptura);

      const primeiroAviso = await pedir(rotaDosAvisos(cenario.codigo), {
        metodo: 'POST',
        cookie: cookiePlenoComCaptura,
        corpo: {},
        base: baseComCaptura,
      });

      expect(primeiroAviso.status, `o aviso da precondição respondeu ${primeiroAviso.texto}`).toBe(
        200,
      );

      // ---------------------------------------------------------------------------------------
      // O sujeito: `USUARIO_EMPRESA` com a MATRIZ PADRÃO — nenhum ajuste é escrito
      // ---------------------------------------------------------------------------------------
      //
      // A ausência da área **é** a precondição, e por isso ela não se escreve: escrever a negação
      // produziria o mesmo efetivo por um caminho que o caso não mede. Ela é AFIRMADA por
      // `GET /v1/sessao` antes das quatro chamadas — sem isso, um `403` seria indistinguível de
      // sessão quebrada, e as quatro recusas provariam apenas que a sessão não serve para nada.
      //
      // A igualdade de arranjo, e não um `not.toContain`, é o que prende o piso do perfil: a matriz
      // de `USUARIO_EMPRESA` é **só** `TELA:resumo` (ADR-0010), e um piso que crescesse em silêncio
      // faria este caso deixar de medir a ausência que ele exercita.
      const semAArea = await pessoaOperandoComSenhaTrocada(
        'sem.automacao',
        'USUARIO_EMPRESA',
        baseComCaptura,
      );
      const efetivo = await efetivoDe(semAArea.cookie, baseComCaptura);

      expect(efetivo.telas).toEqual([AREA_DO_PISO_DO_USUARIO]);
      expect(efetivo.acoes).toEqual([]);
      expect(efetivo.telas).not.toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);

      const tabela = rotasDaFatiaDaRegua(cenario.codigo);

      // A tabela cobre a superfície inteira da fatia — afirmado sobre ela ANTES de percorrê-la.
      // Tabela truncada é o modo de falha silencioso desta classe de caso.
      expect(tabela.length).toBe(ROTAS_DA_FATIA_DA_REGUA);
      expect(tabela.filter((rota) => rota.exigeAAcao).length).toBe(1);

      // --- Passo 2: as três medições ANTES ------------------------------------------------------
      const politicaAntes = await lerPoliticaDeAviso(cookiePlenoComCaptura);
      const politicasAntes = await contarPoliticasDeAviso();
      const enviosAntes = await contarEnviosDeCobranca();
      const capturasAntes = capturador.capturas.length;

      // A precondição tem conteúdo, e isso é afirmado: há política e há histórico.
      expect(politicasAntes).toBe(1);
      expect(enviosAntes).toBeGreaterThan(0);

      // --- Passo 3: as quatro recusam, e NENHUMA responde `404` ---------------------------------
      const recusadas: string[] = [];
      const corposDaRecusa: string[] = [];

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: semAArea.cookie,
          base: baseComCaptura,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        // `403`, e **nunca** `404`: a recusa diz *"você não alcança"*, e um `404` diria *"isto não
        // existe"* — a diferença entre as duas respostas é informação sobre o que existe, e as duas
        // rotas de aviso endereçam uma cobrança que **existe** de propósito, para que a distinção
        // tenha o que revelar.
        //
        // DECISÃO FECHADA — T12 / Gate 2 (P1) · 2026-08-12
        // O QUÊ: a negativa `not.toBe(404)` vem ANTES da igualdade `toBe(403)`, e não depois.
        // POR QUÊ: na ordem idiomática (igualdade primeiro) a negativa é INFALÍVEL — o `expect`
        //          lança ao reprovar, de modo que ela só chega a ser avaliada quando o status já
        //          é `403`, estado em que ela passa por necessidade. Não existiria estado do SUT,
        //          nem o `404` que o caso persegue, em que a mensagem nomeada fosse exibida
        //          (AP-29, `tautological_assertion`). Invertidas, a negativa é avaliada sobre o
        //          status cru e é ELA que reprova no vazamento de existência; a igualdade não
        //          perde nada, porque `not.toBe(404)` não implica `toBe(403)`. A mesma ordem já
        //          é praticada em `autenticacao.e2e.spec.ts` (CT-018 (d), l. 621-622).
        // REVERTER EXIGE: demonstrar que a negativa, na posição posterior, reprova em algum
        //                 estado do SUT — o que exigiria que a igualdade anterior não abortasse.
        expect(resposta.status, `${rota.rotulo} vazou a existência do recurso`).not.toBe(404);
        expect(resposta.status, `${rota.rotulo} respondeu ${String(resposta.status)}`).toBe(403);

        // O envelope INTEIRO por igualdade (ADR-0017): `detalhes.exigido` é a **área**, inclusive no
        // disparo, porque a recusa nomeia a PRIMEIRA chave ausente da conjunção e a área vem antes.
        // Não há `campo`, porque a recusa não é de entrada.
        expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: AREA_DA_AUTOMACAO_DE_COBRANCA },
        });

        recusadas.push(rota.rotulo);
        corposDaRecusa.push(JSON.stringify(resposta.corpo));
      }
      expect(recusadas.length).toBe(ROTAS_DA_FATIA_DA_REGUA);

      // As quatro recusas são idênticas entre si **byte a byte** — uma única forma na serialização.
      // A igualdade do laço acima é profunda e não alcança a ordem das chaves; esta linha alcança, e
      // é ela que impede a recusa de virar oráculo por diferença de forma entre duas das quatro.
      expect(
        new Set(corposDaRecusa).size,
        'as recusas das quatro rotas não são idênticas byte a byte',
      ).toBe(1);

      // --- Passos 4 e 5: NADA mudou -------------------------------------------------------------
      //
      // A política relida é estritamente igual — o que pega o `PUT` que tivesse gravado —, as duas
      // contagens cruas são as mesmas — o que pega a linha que tivesse nascido —, e o comprimento
      // das capturas é o mesmo — o que pega a mensagem que tivesse saído para o mundo. As três medem
      // coisas distintas e nenhuma implica as outras.
      expect(await lerPoliticaDeAviso(cookiePlenoComCaptura)).toEqual(politicaAntes);
      expect(await contarPoliticasDeAviso()).toBe(politicasAntes);
      expect(await contarEnviosDeCobranca()).toBe(enviosAntes);
      expect(capturador.capturas.length).toBe(capturasAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-634 — com a área e sem a ação, SÓ o disparo é recusado; concedida a ação, ele passa',
    async () => {
      const cenario = await cenarioDoDisparoManual();
      const tabela = rotasDaFatiaDaRegua(cenario.codigo);

      expect(tabela.length).toBe(ROTAS_DA_FATIA_DA_REGUA);

      // A política precisa existir para que o `GET` da régua e o `PUT` do eixo positivo respondam
      // sobre um estado conhecido — e ela é gravada por quem administra, não pelo sujeito do caso.
      await definirPoliticaDeAviso(cookiePlenoComCaptura);

      // ---------------------------------------------------------------------------------------
      // Arranjo 1 — a MESMA pessoa, com a área e SEM a ação
      // ---------------------------------------------------------------------------------------
      //
      // O sujeito é exclusivo deste caso, pela mesma razão do `CT-320`: é o efetivo dele que está sob
      // prova, e nenhuma sessão é compartilhada entre casos que escrevem permissão.
      const sujeito = await pessoaOperandoComSenhaTrocada(
        'so.a.area.da.automacao',
        'USUARIO_EMPRESA',
        baseComCaptura,
      );

      await ajustar(
        sujeito.usuarioId,
        EMPRESA_A.id,
        ARRANJO_SO_COM_A_AREA.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
      );

      const primeiroEfetivo = await efetivoDe(sujeito.cookie, baseComCaptura);

      expect(primeiroEfetivo.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
      expect(primeiroEfetivo.acoes).not.toContain(ACAO_DE_ENVIO_MANUAL);

      // --- Passo 2: as TRÊS rotas de área respondem `200` ---------------------------------------
      //
      // A asserção é de sucesso EXATO, e não de "diferente de 403": as três requisições são
      // bem-formadas e endereçam recursos que existem, de modo que qualquer outra recusa — `404` de
      // alcance, `422` de esquema — também seria defeito. Sem este eixo, tudo abaixo seria satisfeito
      // por uma guarda que recusasse a área inteira.
      const alcancadas: string[] = [];
      for (const rota of tabela.filter((candidata) => !candidata.exigeAAcao)) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: sujeito.cookie,
          base: baseComCaptura,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(
          resposta.status,
          `${rota.rotulo} respondeu ${String(resposta.status)} a quem TEM a área: ${resposta.texto}`,
        ).toBe(200);
        alcancadas.push(rota.rotulo);
      }
      expect(alcancadas.length).toBe(ROTAS_DA_FATIA_DA_REGUA - 1);

      // --- Passo 3: o disparo é recusado nomeando a AÇÃO, e nada acontece ------------------------
      const capturasAntes = capturador.capturas.length;
      const enviosAntes = await contarEnviosDeCobranca();

      const disparo = tabela.find((rota) => rota.exigeAAcao);
      if (disparo === undefined) {
        throw new Error('a tabela da fatia não tem a rota de disparo');
      }

      const recusa = await pedir(disparo.alvo, {
        metodo: disparo.metodo,
        cookie: sujeito.cookie,
        base: baseComCaptura,
        ...(disparo.corpo === undefined ? {} : { corpo: disparo.corpo }),
      });

      expect(recusa.status, `${disparo.rotulo} respondeu ${String(recusa.status)}`).toBe(403);
      // `detalhes.exigido` é a **AÇÃO**, e não a área que a sessão já possui: a conjunção é declarada
      // com a área primeiro, e a recusa nomeia a PRIMEIRA ausente (ADR-0018). Uma declaração que
      // trocasse a ordem, ou que exigisse só a área, reprova nesta linha.
      expect(recusa.corpo, `a recusa de ${disparo.rotulo} mudou de forma`).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_ENVIO_MANUAL },
      });

      // A recusa acontece ANTES de qualquer efeito: nenhuma mensagem saiu, e nenhuma linha nasceu.
      expect(capturador.capturas.length).toBe(capturasAntes);
      expect(await contarEnviosDeCobranca()).toBe(enviosAntes);

      // ---------------------------------------------------------------------------------------
      // Arranjo 2 — a MESMA pessoa, e a diferença é de EXATAMENTE UMA chave
      // ---------------------------------------------------------------------------------------
      //
      // O efetivo é reafirmado por `GET /v1/sessao` **após o ajuste**: a sessão relê a versão de
      // permissões quando ela diverge, e sem esta leitura o segundo arranjo poderia não ter alcançado
      // a sessão — o `200` de baixo passaria a ser sobre outra coisa.
      await ajustar(
        sujeito.usuarioId,
        EMPRESA_A.id,
        ARRANJO_COM_A_ACAO.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
      );

      const segundoEfetivo = await efetivoDe(sujeito.cookie, baseComCaptura);

      expect(segundoEfetivo.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
      expect(segundoEfetivo.acoes).toContain(ACAO_DE_ENVIO_MANUAL);

      // A diferença é medida sobre o EFETIVO PUBLICADO, nos dois sentidos, e não sobre os arranjos
      // escritos: é o que o cliente da rota enxerga, e é isso que prende a mudança de comportamento
      // à ação — e a nada mais. Nada saiu, e entrou uma chave só.
      const antesDoAjuste = [...primeiroEfetivo.telas, ...primeiroEfetivo.acoes];
      const depoisDoAjuste = [...segundoEfetivo.telas, ...segundoEfetivo.acoes];

      expect(depoisDoAjuste.filter((chave) => !antesDoAjuste.includes(chave))).toEqual([
        ACAO_DE_ENVIO_MANUAL,
      ]);
      expect(antesDoAjuste.filter((chave) => !depoisDoAjuste.includes(chave))).toEqual([]);

      // --- Passo 5: o disparo passa, e o efeito é de EXATAMENTE uma mensagem e uma linha ---------
      const aceito = await pedir(disparo.alvo, {
        metodo: disparo.metodo,
        cookie: sujeito.cookie,
        base: baseComCaptura,
        ...(disparo.corpo === undefined ? {} : { corpo: disparo.corpo }),
      });

      expect(
        aceito.status,
        `${disparo.rotulo} respondeu ${String(aceito.status)}: ${aceito.texto}`,
      ).toBe(200);
      expect(aceito.corpo).toMatchObject({
        cobrancaCodigo: cenario.codigo,
        caminho: 'MANUAL',
        desfecho: 'ENVIADA',
        destinatario: cenario.emailDoLocatario,
        causa: null,
      });

      // O comprimento é o discriminador: sem ele, uma implementação que entregasse duas vezes — ou
      // nenhuma, gravando `ENVIADA` sem falar com a porta — passaria em tudo acima.
      expect(capturador.capturas.length).toBe(capturasAntes + 1);
      expect(capturador.capturas.at(-1)?.destinatario).toBe(cenario.emailDoLocatario);
      expect(await contarEnviosDeCobranca()).toBe(enviosAntes + 1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-941 — as 7 rotas da fatia de emissão exigem sessão e a autorização declarada; nenhuma é pública, e o perfil completo passa',
    async () => {
      const tabela = rotasDaFatiaDeEmissao();

      // ---------------------------------------------------------------------------------------
      // A tabela cobre a superfície inteira da fatia — afirmado ANTES de percorrê-la
      // ---------------------------------------------------------------------------------------
      //
      // Tabela truncada é o modo de falha silencioso desta classe de caso: as três varreduras
      // abaixo passariam sobre menos rotas do que a fatia publica, e nada acusaria.
      expect(tabela.length).toBe(ROTAS_DA_FATIA_DE_EMISSAO);
      expect(tabela.filter((rota) => rota.acao !== undefined).length).toBe(
        ATOS_DA_FATIA_DE_EMISSAO,
      );

      // ---------------------------------------------------------------------------------------
      // (a) SEM SESSÃO — `401` nas sete, com o envelope INTEIRO e sem `detalhes`
      // ---------------------------------------------------------------------------------------
      //
      // Nenhuma delas é pública: rota nova nasce protegida, e a marca `@RotaPublica()` é a única
      // abertura deliberada (ADR-0011). Um `200` aqui seria a superfície aberta, e um `403` seria a
      // rota respondendo *"você não alcança"* a quem não se identificou — as duas reprovam.
      const corposSemSessao: string[] = [];

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(
          resposta.status,
          `${rota.rotulo} respondeu ${String(resposta.status)} sem sessão`,
        ).toBe(401);
        // O envelope INTEIRO por igualdade (ADR-0017), e **sem** `detalhes`: não há exigência a
        // nomear para quem não se identificou, e nomear uma diria ao anônimo qual chave o liberaria.
        expect(resposta.corpo, `a recusa sem sessão de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });

        corposSemSessao.push(JSON.stringify(resposta.corpo));
      }

      // As sete recusas são idênticas entre si **byte a byte** — uma única forma na serialização. A
      // igualdade do laço é profunda e não alcança a ordem das chaves; esta linha alcança, e é ela
      // que impede a recusa de virar oráculo por diferença de forma entre duas das sete.
      expect(
        new Set(corposSemSessao).size,
        'as recusas sem sessão das sete rotas não são idênticas byte a byte',
      ).toBe(1);

      // ---------------------------------------------------------------------------------------
      // O sujeito SEM A ÁREA: `USUARIO_EMPRESA` com a MATRIZ PADRÃO — nenhum ajuste é escrito
      // ---------------------------------------------------------------------------------------
      //
      // A ausência da área **é** a precondição, e por isso ela não se escreve: escrever a negação
      // produziria o mesmo efetivo por um caminho que o caso não mede. A igualdade de arranjo, e não
      // um `not.toContain`, é o que prende o piso do perfil — um piso que crescesse em silêncio
      // faria este caso deixar de medir a ausência que ele exercita.
      //
      // ⚠️ **É a sessão que o `CT-319` já usa, e reusá-la é deliberado.** Este caso não escreve
      // ajuste algum para ela — só lê o efetivo dela —, de modo que a regra do arquivo (*"nenhuma
      // sessão é compartilhada entre casos que escrevem permissão"*) continua valendo. A razão de
      // não criar mais uma pessoa é medida e está registrada no `DÉBITO COM GATILHO — D27 · F1/T6`
      // de `packages/auth/src/autenticacao.ts`: enquanto a chave do limitador for
      // `no-trusted-ip|/change-password`, a **décima primeira** troca de senha do mesmo minuto
      // recebe `429` — e este arquivo já gasta nove trocas antes de chegar aqui.
      const efetivoSemAArea = await efetivoDe(cookieSemArea);

      expect(efetivoSemAArea.telas).toEqual([AREA_DO_PISO_DO_USUARIO]);
      expect(efetivoSemAArea.acoes).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // (b) COM SESSÃO E SEM A ÁREA — `403` nas sete, nomeando a ÁREA
      // ---------------------------------------------------------------------------------------
      //
      // `detalhes.exigido` é a **área** nas sete, inclusive nos três atos: a recusa nomeia a PRIMEIRA
      // chave ausente da conjunção, e a área vem antes (ADR-0018). Se um ato nomeasse a ação aqui, a
      // conjunção dele estaria declarada na ordem trocada — o defeito que esta linha pega.
      const corposSemArea: string[] = [];

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookieSemArea,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        // A negativa vem ANTES da igualdade, e a ordem é a da `DECISÃO FECHADA — T12 / Gate 2 (P1)`
        // registrada no `CT-633`: na ordem idiomática ela seria infalível, porque o `expect` aborta o
        // caso ao reprovar e ela só chegaria a ser avaliada com o status já em `403`.
        expect(resposta.status, `${rota.rotulo} vazou a existência do recurso`).not.toBe(404);
        expect(resposta.status, `${rota.rotulo} respondeu ${String(resposta.status)}`).toBe(403);
        expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: AREA_DO_FINANCEIRO },
        });

        corposSemArea.push(JSON.stringify(resposta.corpo));
      }

      expect(
        new Set(corposSemArea).size,
        'as recusas por ausência da área não são idênticas byte a byte',
      ).toBe(1);

      // ---------------------------------------------------------------------------------------
      // O sujeito COM A ÁREA E SEM AS AÇÕES — sujeito próprio, porque o efetivo dele é escrito
      // ---------------------------------------------------------------------------------------
      //
      // Ele é exclusivo deste caso, pela mesma razão do `CT-320` e do `CT-634`: é o efetivo dele que
      // está sob prova, e nenhuma sessão é compartilhada entre casos que escrevem permissão.
      const semAsAcoes = await pessoaOperandoComSenhaTrocada('so.a.area.do.financeiro');

      await ajustar(semAsAcoes.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DO_FINANCEIRO, efeito: 'CONCEDIDA' },
      ]);

      const efetivoSemAsAcoes = await efetivoDe(semAsAcoes.cookie);

      // A precondição é AFIRMADA nos dois eixos, e não presumida: **tem** a área, e **não tem**
      // nenhuma das duas ações. Sem a segunda metade, o `403` do laço abaixo seria indistinguível do
      // que o sujeito anterior já recebia.
      expect(efetivoSemAsAcoes.telas).toContain(AREA_DO_FINANCEIRO);
      expect(efetivoSemAsAcoes.acoes).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // (c) COM A ÁREA E SEM A AÇÃO — SÓ os três atos recusam, e a recusa nomeia a AÇÃO
      // ---------------------------------------------------------------------------------------
      //
      // As duas metades são direções diferentes, e nenhuma implica a outra: os **três atos** recusam
      // nomeando a ação — a primeira ausente agora que a área está presente —, e as **quatro
      // leituras** deixam de recusar. Sem a segunda, uma guarda que exigisse a ação nas sete passaria
      // pela primeira inteira.
      const recusadasComAArea: Record<string, string> = {};

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: semAsAcoes.cookie,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        if (resposta.status === 403) {
          recusadasComAArea[rota.rotulo] = (resposta.corpo as { detalhes?: { exigido?: string } })
            .detalhes?.exigido as string;
          expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: rota.acao },
          });
        }
      }

      // O retrato inteiro numa comparação só, e não um contador: ele afirma as DUAS direções ao
      // mesmo tempo — **quais** rotas recusaram (uma leitura que passasse a exigir ação apareceria
      // como excedente, e um ato que deixasse de exigi-la como ausente) **e** qual chave cada uma
      // nomeou. Um `atosRecusados.length === 3` seria implicado pela contagem afirmada no topo, e
      // não haveria estado do SUT em que ele fosse o primeiro a reprovar (AP-29).
      expect(
        recusadasComAArea,
        'o conjunto de rotas recusadas por falta de AÇÃO deixou de ser o dos três atos',
      ).toEqual(
        Object.fromEntries(
          tabela
            .filter((rota) => rota.acao !== undefined)
            .map((rota) => [rota.rotulo, rota.acao as string]),
        ),
      );

      // ---------------------------------------------------------------------------------------
      // (d) O CONTROLE ANTIVÁCUO — com o perfil COMPLETO, nenhuma responde `401` nem `403`
      // ---------------------------------------------------------------------------------------
      //
      // Sem esta perna, uma rota quebrada que respondesse `403` a **todo mundo** passaria nas três
      // anteriores inteiras — é ela que prova que o `403` vinha da permissão, e não de defeito de
      // montagem. O sujeito é o Admin da empresa A, cuja matriz de perfil é o catálogo inteiro.
      //
      // ⚠️ O desfecho de cada uma é `404` (recurso que não existe) ou `422` (entrada recusada), e as
      // duas escolhas são deliberadas: com o perfil completo e um corpo válido, a abertura de lote e o
      // disparo da conferência **gravariam linha e enfileirariam tarefa**, e o que este caso mede é a
      // autorização — não o percurso.
      const comOPerfilCompleto: Record<string, number> = {};

      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookiePleno,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        // As duas negativas vêm ANTES da igualdade de baixo, e a ordem é a da
        // `DECISÃO FECHADA — T12 / Gate 2 (P1)` do `CT-633`: elas são o invariante literal do card, e
        // na posição posterior seriam infalíveis — a igualdade abortaria o caso antes.
        expect(
          resposta.status,
          `${rota.rotulo} recusou o perfil COMPLETO com ${String(resposta.status)}: ${resposta.texto}`,
        ).not.toBe(401);
        expect(
          resposta.status,
          `${rota.rotulo} recusou o perfil COMPLETO com ${String(resposta.status)}: ${resposta.texto}`,
        ).not.toBe(403);

        comOPerfilCompleto[rota.rotulo] = resposta.status;
      }

      // E o retrato dos sete status, por igualdade de OBJETO. Ele é o que as duas negativas não
      // alcançam: um `500` do arcabouço — a rota que atravessa a guarda e **quebra** — satisfaria as
      // duas e diria que a autorização está certa sobre uma rota que não atende. A falha nomeia a
      // rota e o número lado a lado.
      expect(
        comOPerfilCompleto,
        'o perfil completo deixou de alcançar as sete rotas pelo desfecho esperado',
      ).toEqual(
        Object.fromEntries(tabela.map((rota) => [rota.rotulo, rota.statusComOPerfilCompleto])),
      );
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// A tabela das SETE rotas da fatia `emissao-e-conciliacao` — o eixo do CT-941 (T17)
// ---------------------------------------------------------------------------------------------

/** Uma rota da fatia de emissão, no que o `CT-941` precisa saber dela. */
interface RotaDaFatiaDeEmissao {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo?: Record<string, unknown>;
  /**
   * A chave de **ação** que a rota exige além da área — ausente nas quatro que valem só pela classe.
   *
   * É ela que parte a tabela nos dois grupos que o passo (c) mede por direções opostas, e o valor é
   * o que a recusa tem de nomear em `detalhes.exigido` quando a sessão já alcança a área.
   */
  readonly acao?: ChaveDoCatalogo;
  /**
   * O status que a rota devolve ao **perfil completo** — o esperado do controle antivácuo.
   *
   * Ele é `404` onde o alvo não existe e `422` onde o corpo é recusado de propósito, e as duas
   * escolhas são conteúdo: com corpo válido, a abertura de lote e o disparo da conferência
   * **gravariam linha e enfileirariam tarefa**. Escrevê-lo por extenso é o que faz o controle
   * distinguir *"a guarda deixou passar"* de *"a rota quebrou depois da guarda"* — um `500`
   * satisfaria as duas negativas sozinho.
   */
  readonly statusComOPerfilCompleto: number;
}

/**
 * As **sete** rotas que a fatia `emissao-e-conciliacao` publica, com a exigência devida de cada uma.
 *
 * Os caminhos são **compostos dos donos dos segmentos** — `CAMINHO_DAS_COBRANCAS`,
 * `CAMINHO_DA_COBRANCA_BANCARIA`, `SEGMENTO_DAS_EMISSOES` e `SEGMENTO_DAS_CONFERENCIAS` —, e nunca
 * escritos como cadeia crua: um segmento que mudasse no controlador sem passar por aqui faria o caso
 * bater numa rota que não existe e receber `404` da ausência de manipulador, que passaria nos passos
 * (a) e (b) pelo motivo errado.
 *
 * ⚠️ **As chaves de ação são literais escritos à mão**, e não importadas dos controladores: as
 * constantes de lá são privadas de propósito, e derivá-las da mesma fonte que o SUT usa para declarar
 * faria a asserção concordar com ele — trocar a exigência do controlador deixaria de reprovar caso
 * algum. Elas são o valor que o cliente lê em `detalhes.exigido`.
 *
 * Os alvos são recursos **que não existem**, e a escolha é conteúdo: a guarda corre **antes** do
 * manipulador, de modo que o `401` e o `403` que os três primeiros passos medem independem do estado
 * do banco — e o passo (d) fica livre para observar *"não é 401 nem 403"* sem produzir efeito algum.
 */
function rotasDaFatiaDeEmissao(): readonly RotaDaFatiaDeEmissao[] {
  const cobranca = `${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}`;
  const emissoes = `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}`;

  return [
    {
      rotulo: 'POST /v1/cobrancas/:codigo/emissao-de-boleto',
      metodo: 'POST',
      alvo: `${cobranca}/emissao-de-boleto`,
      corpo: {},
      acao: ACAO_DE_EMITIR_BOLETO,
      statusComOPerfilCompleto: 404,
    },
    {
      rotulo: 'POST /v1/cobrancas/:codigo/revogacao-de-boleto',
      metodo: 'POST',
      alvo: `${cobranca}/revogacao-de-boleto`,
      corpo: {},
      acao: ACAO_DE_SOLICITAR_BAIXA,
      statusComOPerfilCompleto: 404,
    },
    {
      rotulo: 'GET /v1/cobrancas/:codigo/boleto',
      metodo: 'GET',
      alvo: `${cobranca}/boleto`,
      statusComOPerfilCompleto: 404,
    },
    {
      rotulo: 'GET /v1/cobrancas/:codigo/historico-bancario',
      metodo: 'GET',
      alvo: `${cobranca}/historico-bancario`,
      statusComOPerfilCompleto: 404,
    },
    {
      rotulo: 'POST /v1/cobranca-bancaria/emissoes',
      metodo: 'POST',
      alvo: emissoes,
      // Corpo deliberadamente recusável — ver {@link CHAVE_QUE_NINGUEM_DECLAROU}: com o perfil
      // completo e uma competência válida, esta rota gravaria o lote e enfileiraria a tarefa.
      corpo: { [CHAVE_QUE_NINGUEM_DECLAROU]: true },
      acao: ACAO_DE_EMITIR_BOLETO,
      statusComOPerfilCompleto: 422,
    },
    {
      rotulo: 'GET /v1/cobranca-bancaria/emissoes/:id',
      metodo: 'GET',
      alvo: `${emissoes}/${LOTE_INEXISTENTE}`,
      statusComOPerfilCompleto: 404,
    },
    {
      rotulo: 'POST /v1/cobranca-bancaria/conferencias',
      metodo: 'POST',
      alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_CONFERENCIAS}`,
      // Pela mesma razão da abertura de lote: o corpo válido é o objeto **vazio**, e com ele o perfil
      // completo abriria conferência e enfileiraria tarefa.
      corpo: { [CHAVE_QUE_NINGUEM_DECLAROU]: true },
      statusComOPerfilCompleto: 422,
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// A tabela das 33 rotas — DERIVADA dos donos de segmento, nunca redigitada
// ---------------------------------------------------------------------------------------------

/** Uma rota do domínio, no que estes casos precisam saber dela. */
interface RotaDoDominio {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo?: Record<string, unknown>;
  /** A chave de área que a rota exige — o valor que a recusa tem de nomear. */
  readonly area: ChaveDoCatalogo;
}

/** Os recursos da empresa que a tabela endereça — todos criados pelas rotas reais. */
interface AlvosDoDominio {
  readonly conjuntoId: string;
  readonly imovelId: string;
  readonly comodoId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadorId: string;
  /** Rótulo desta leva — entra no nome do conjunto, para que a falha diga de qual leva ela veio. */
  readonly marca: string;
}

/** A coleção de cada entidade, sob o prefixo de versão. */
function colecao(caminho: string): string {
  return `/${PREFIXO_DE_VERSAO}/${caminho}`;
}

/**
 * As **seis** rotas que uma entidade de cadastro publica, com corpo válido onde há corpo.
 *
 * O corpo do `POST` e o do `PUT` são **distintos**, e a distinção não é estilo: o `POST` cria um
 * registro NOVO e o `PUT` reescreve o que a tabela endereça. Com o mesmo corpo nos dois, o `PUT` de
 * imóvel e o de pessoa tentariam gravar um identificador municipal — ou um documento — que o `POST`
 * acabou de tomar, e a resposta seria `422` de unicidade em vez do `200` que o eixo positivo mede.
 */
function rotasDeUmCadastro(
  caminho: string,
  id: string,
  area: ChaveDoCatalogo,
  corpoDoPost: Record<string, unknown>,
  corpoDoPut: Record<string, unknown>,
): readonly RotaDoDominio[] {
  const raiz = colecao(caminho);
  const item = `${raiz}/${id}`;

  return [
    { rotulo: `POST ${raiz}`, metodo: 'POST', alvo: raiz, corpo: corpoDoPost, area },
    { rotulo: `GET ${raiz}`, metodo: 'GET', alvo: raiz, area },
    { rotulo: `GET ${raiz}/:id`, metodo: 'GET', alvo: item, area },
    { rotulo: `PUT ${raiz}/:id`, metodo: 'PUT', alvo: item, corpo: corpoDoPut, area },
    {
      rotulo: `POST ${raiz}/:id/retirada`,
      metodo: 'POST',
      alvo: `${item}/retirada`,
      corpo: {},
      area,
    },
    {
      rotulo: `POST ${raiz}/:id/recirculacao`,
      metodo: 'POST',
      alvo: `${item}/recirculacao`,
      corpo: {},
      area,
    },
  ];
}

/**
 * As **33** rotas, compostas a partir dos donos de segmento.
 *
 * A ordem importa no eixo positivo: cada entidade é criada, lida, alterada, retirada e recirculada
 * nesta sequência, de modo que o cadastro termina em circulação — e o `POST` da coleção cria um
 * registro NOVO, sem tocar o que a tabela endereça.
 */
function rotasDoDominio(recursos: AlvosDoDominio): readonly RotaDoDominio[] {
  const comodos = colecao(CAMINHO_DOS_COMODOS).replace(':id', recursos.imovelId);
  const doComodo = `${comodos}/${recursos.comodoId}`;

  return [
    ...rotasDeUmCadastro(
      CAMINHO_DOS_CONJUNTOS,
      recursos.conjuntoId,
      AREA_DOS_IMOVEIS,
      { nome: `Edifício ${recursos.marca} novo` },
      { nome: `Edifício ${recursos.marca}` },
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_IMOVEIS,
      recursos.imovelId,
      AREA_DOS_IMOVEIS,
      // O `POST` cria um imóvel NOVO, com identificador próprio; o `PUT` reescreve o imóvel que a
      // tabela endereça, devolvendo a ele o MESMO identificador com que nasceu — que é o único
      // valor que a restrição de unicidade aceita da própria linha.
      corpoDeImovel(recursos.conjuntoId, identificadorMunicipal()),
      corpoDeImovelAlterado(recursos.conjuntoId, identificadorMunicipal()),
    ),
    // O cômodo não tem rota de leitura: ele chega e volta dentro do imóvel, que é o agregado dele
    // (§4.1). São três escritas, e a ausência da quarta é contrato.
    {
      rotulo: `POST ${CAMINHO_DOS_COMODOS}`,
      metodo: 'POST',
      alvo: comodos,
      corpo: { nomeComodo: 'Sala', metragem: 12.5, observacoes: null },
      area: AREA_DOS_IMOVEIS,
    },
    {
      rotulo: `PUT ${CAMINHO_DOS_COMODOS}/:comodoId`,
      metodo: 'PUT',
      alvo: doComodo,
      corpo: { nomeComodo: 'Sala ampliada', metragem: 14, observacoes: null },
      area: AREA_DOS_IMOVEIS,
    },
    {
      rotulo: `DELETE ${CAMINHO_DOS_COMODOS}/:comodoId`,
      metodo: 'DELETE',
      alvo: doComodo,
      area: AREA_DOS_IMOVEIS,
    },
    // Nos três papéis, o corpo do `POST` e o do `PUT` são construídos por chamadas distintas de
    // {@link corpoDePessoa}, e cada uma sorteia documento e endereço próprios — pela mesma razão do
    // imóvel logo acima.
    ...rotasDeUmCadastro(
      CAMINHO_DOS_LOCADORES,
      recursos.locadorId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_LOCATARIOS,
      recursos.locatarioId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_FIADORES,
      recursos.fiadorId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
  ];
}

/** Uma entidade circulável, no que os `CT-320` e `CT-321` observam dela. */
interface EntidadeCirculavel {
  readonly nome: string;
  /** O endereço do item, já com o identificador. */
  readonly item: string;
  readonly area: ChaveDoCatalogo;
  /**
   * Um corpo **válido** para o `PUT` daquela entidade.
   *
   * Válido é obrigatório, e a razão é a ordem do manipulador: ele valida o corpo **antes** de
   * procurar o registro, de modo que um corpo malformado responderia `422` e o `404` que o `CT-321`
   * mede nunca aconteceria. Os campos únicos saem de um sorteio próprio a cada chamada — se a
   * gravação chegasse a acontecer, ela não poderia colidir com nada e o defeito apareceria como
   * mudança de estado, e não como recusa de unicidade que o mascararia.
   */
  readonly corpoDoPut: () => Record<string, unknown>;
}

/** As **cinco** entidades que saem e voltam à circulação — o cômodo não é uma delas (ADR-0014). */
function entidadesCirculaveis(recursos: AlvosDoDominio): readonly EntidadeCirculavel[] {
  return [
    {
      nome: CAMINHO_DOS_CONJUNTOS,
      item: `${colecao(CAMINHO_DOS_CONJUNTOS)}/${recursos.conjuntoId}`,
      area: AREA_DOS_IMOVEIS,
      corpoDoPut: () => ({ nome: `Edifício ${String(proximo())}` }),
    },
    {
      nome: CAMINHO_DOS_IMOVEIS,
      item: `${colecao(CAMINHO_DOS_IMOVEIS)}/${recursos.imovelId}`,
      area: AREA_DOS_IMOVEIS,
      corpoDoPut: () => corpoDeImovelAlterado(recursos.conjuntoId, identificadorMunicipal()),
    },
    {
      nome: CAMINHO_DOS_LOCADORES,
      item: `${colecao(CAMINHO_DOS_LOCADORES)}/${recursos.locadorId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
    {
      nome: CAMINHO_DOS_LOCATARIOS,
      item: `${colecao(CAMINHO_DOS_LOCATARIOS)}/${recursos.locatarioId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
    {
      nome: CAMINHO_DOS_FIADORES,
      item: `${colecao(CAMINHO_DOS_FIADORES)}/${recursos.fiadorId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
  ];
}

/** Uma das quatro rotas de `:id` que o `CT-321` percorre, endereçada por um item já composto. */
interface RotaDeIdentificador {
  readonly metodo: string;
  readonly sufixo: string;
  readonly alvo: (item: string) => string;
  readonly corpo?: (entidade: EntidadeCirculavel) => Record<string, unknown>;
}

/**
 * As **quatro** rotas de `:id` comuns às cinco entidades circuláveis.
 *
 * O `PUT` carrega o corpo válido da entidade — ver {@link EntidadeCirculavel.corpoDoPut} —, e as
 * duas transições de circulação carregam o objeto **vazio e fechado**, que é o corpo que elas
 * aceitam.
 */
const ROTAS_DE_IDENTIFICADOR: readonly RotaDeIdentificador[] = [
  { metodo: 'GET', sufixo: '/:id', alvo: (item) => item },
  {
    metodo: 'PUT',
    sufixo: '/:id',
    alvo: (item) => item,
    corpo: (entidade) => entidade.corpoDoPut(),
  },
  {
    metodo: 'POST',
    sufixo: '/:id/retirada',
    alvo: (item) => `${item}/retirada`,
    corpo: () => ({}),
  },
  {
    metodo: 'POST',
    sufixo: '/:id/recirculacao',
    alvo: (item) => `${item}/recirculacao`,
    corpo: () => ({}),
  },
];

// ---------------------------------------------------------------------------------------------
// A tabela das SETE rotas da fatia `cobranca-e-mora` — o eixo do CT-534
// ---------------------------------------------------------------------------------------------

/** Uma das sete rotas da fatia, no que o `CT-534` precisa saber dela. */
interface RotaDaFatiaDeCobranca {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo?: Record<string, unknown>;
  /** A chave de área que a rota exige — o valor que a recusa tem de nomear. */
  readonly area: ChaveDoCatalogo;
}

/** Uma cobrança como a API a publica, no que este arquivo observa dela. */
interface CobrancaPublicada {
  readonly codigo: string;
  readonly status: string;
  readonly dataVencimento: string;
  readonly valorTotal: number;
}

/** O cenário que o `CT-534` exercita: duas cobranças em aberto e o corpo de um lançamento válido. */
interface CenarioDeCobranca {
  readonly contratoCodigo: string;
  readonly paraPagar: CobrancaPublicada;
  readonly paraCancelar: CobrancaPublicada;
  readonly corpoDeLancamento: Record<string, unknown>;
}

/**
 * As **sete** rotas da fatia, compostas a partir dos donos de segmento — nunca redigitadas.
 *
 * Cada uma carrega um corpo **válido** onde há corpo, e a validade é obrigatória por causa do controle
 * positivo: é a MESMA chamada que roda com a sessão que alcança a área, e um corpo malformado
 * responderia `422` ali, esvaziando o controle. No eixo negativo o corpo não muda nada — a guarda
 * decide antes de o manipulador ler a requisição —, e é justamente essa ordem que o `xmin` inalterado
 * da política mede do outro lado.
 *
 * As duas transições apontam para cobranças **diferentes**: acusar o pagamento e cancelar são
 * mutuamente exclusivos, de modo que o controle positivo não conseguiria fazer as duas sobre a mesma
 * linha — a segunda receberia `422` da guarda de estado, e o controle diria que a rota recusou quando
 * a permissão estava certa.
 */
function rotasDaFatiaDeCobranca(cenario: CenarioDeCobranca): readonly RotaDaFatiaDeCobranca[] {
  const paraPagar = `${COLECAO_DE_COBRANCAS}/${cenario.paraPagar.codigo}`;
  const paraCancelar = `${COLECAO_DE_COBRANCAS}/${cenario.paraCancelar.codigo}`;

  return [
    {
      rotulo: `POST ${COLECAO_DE_COBRANCAS}`,
      metodo: 'POST',
      alvo: COLECAO_DE_COBRANCAS,
      corpo: cenario.corpoDeLancamento,
      area: AREA_DO_FINANCEIRO,
    },
    {
      rotulo: `GET ${COLECAO_DE_COBRANCAS}`,
      metodo: 'GET',
      alvo: COLECAO_DE_COBRANCAS,
      area: AREA_DO_FINANCEIRO,
    },
    {
      rotulo: `GET ${COLECAO_DE_COBRANCAS}/:codigo`,
      metodo: 'GET',
      alvo: paraPagar,
      area: AREA_DO_FINANCEIRO,
    },
    {
      rotulo: `POST ${COLECAO_DE_COBRANCAS}/:codigo/pagamento`,
      metodo: 'POST',
      alvo: `${paraPagar}/pagamento`,
      // O `pagoEm` é o vencimento da própria cobrança, e o valor é o total que a leitura publicou —
      // a mesma convenção de `cobrancas.e2e.spec.ts`, e nenhuma data absoluta de calendário.
      corpo: {
        pagoEm: cenario.paraPagar.dataVencimento,
        valorPago: cenario.paraPagar.valorTotal,
      },
      area: AREA_DO_FINANCEIRO,
    },
    {
      rotulo: `POST ${COLECAO_DE_COBRANCAS}/:codigo/cancelamento`,
      metodo: 'POST',
      alvo: `${paraCancelar}/cancelamento`,
      // Corpo **vazio e fechado**: o instante do cancelamento é decidido pelo servidor.
      corpo: {},
      area: AREA_DO_FINANCEIRO,
    },
    {
      rotulo: `GET ${RECURSO_DE_MULTA_E_JUROS}`,
      metodo: 'GET',
      alvo: RECURSO_DE_MULTA_E_JUROS,
      area: AREA_DE_MULTA_E_JUROS,
    },
    {
      rotulo: `PUT ${RECURSO_DE_MULTA_E_JUROS}`,
      metodo: 'PUT',
      alvo: RECURSO_DE_MULTA_E_JUROS,
      // Os MESMOS percentuais que o cenário já gravou: a rota é idempotente por construção, e assim o
      // controle positivo exercita a escrita **sem** invalidar o que os passos 4 e 5 afirmaram.
      corpo: { multaPercentual: MULTA_DO_CENARIO, jurosPercentual: JUROS_DO_CENARIO },
      area: AREA_DE_MULTA_E_JUROS,
    },
  ];
}

/**
 * Monta o cenário do `CT-534` **pelas rotas reais**: contrato, política de mora e duas cobranças.
 *
 * O contrato nasce com `gerarCobrancasAutomaticamente: false` e **não é ativado**: o lançamento avulso
 * exige apenas que o contrato exista e esteja em circulação, e ativá-lo faria nascer as parcelas de
 * aluguel do prazo inteiro — cobranças com vencimento no passado, que mudariam a contagem crua que
 * este caso compara e nada acrescentariam ao que ele mede.
 *
 * As duas cobranças vencem **adiante** do relógio do banco, e por isso publicam `A_VENCER`: é o estado
 * em que as duas transições são admitidas, o que faz o controle positivo poder existir.
 */
async function montarCenarioDeCobranca(credencial: string): Promise<CenarioDeCobranca> {
  const partes = await criarAlvosDoDominio(credencial);
  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: credencial,
    corpo: { ...corpoDeContrato(partes), gerarCobrancasAutomaticamente: false },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const contratoCodigo = (montagem.corpo as { codigo: string }).codigo;

  const politica = await pedir(RECURSO_DE_MULTA_E_JUROS, {
    metodo: 'PUT',
    cookie: credencial,
    corpo: { multaPercentual: MULTA_DO_CENARIO, jurosPercentual: JUROS_DO_CENARIO },
  });

  if (politica.status !== 200) {
    throw new Error(
      `a definição da política respondeu ${String(politica.status)}: ${politica.texto}`,
    );
  }

  const corpoDeLancamento = await corpoDeCobranca(contratoCodigo);
  const paraPagar = await lancarCobranca(credencial, corpoDeLancamento);
  const paraCancelar = await lancarCobranca(credencial, corpoDeLancamento);

  // Precondição AFIRMADA: as duas nascem em aberto. Sem esta conferência, uma cobrança já vencida
  // faria o controle positivo medir a guarda de ESTADO em vez da de autorização.
  for (const cobranca of [paraPagar, paraCancelar]) {
    if (cobranca.status !== ESTADO_EM_ABERTO) {
      throw new Error(`a cobrança ${cobranca.codigo} nasceu ${cobranca.status}`);
    }
  }

  return { contratoCodigo, paraPagar, paraCancelar, corpoDeLancamento };
}

/** Lança uma cobrança pela rota real e devolve o corpo publicado. A falha levanta. */
async function lancarCobranca(
  credencial: string,
  corpo: Record<string, unknown>,
): Promise<CobrancaPublicada> {
  const resposta = await pedir(COLECAO_DE_COBRANCAS, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as CobrancaPublicada;
}

/** Lê uma cobrança pela rota real, com a sessão informada. A falha levanta. */
async function lerCobranca(credencial: string, codigo: string): Promise<unknown> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

/** Lê a política de mora pela rota real, com a sessão informada. A falha levanta. */
async function lerPolitica(credencial: string): Promise<unknown> {
  const resposta = await pedir(RECURSO_DE_MULTA_E_JUROS, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

/**
 * O corpo de um lançamento válido sobre o contrato informado, com as datas **lidas do relógio do
 * banco**.
 *
 * A competência é o primeiro dia do mês do vencimento — forma que o `refine` do contrato e o
 * `cobranca_competencia_no_primeiro_dia_chk` do banco exigem. A projeção é feita por `to_char` no
 * banco, e não por `Date` em JavaScript: as duas viajam como `YYYY-MM-DD`, e construir um `Date` aqui
 * reintroduziria o deslocamento de dia por fuso que a coluna `date` existe para evitar.
 *
 * O **deslocamento é parâmetro**, com o do `CT-534` por padrão — o valor que o chamador anterior
 * usava, de modo que ele não muda de comportamento. Ele existe porque o cenário da régua precisa do
 * sinal oposto: lá a cobrança tem de estar **vencida** para que o disparo tenha efeito possível
 * ({@link DIAS_DESDE_O_VENCIMENTO}), enquanto o `CT-534` precisa dela **em aberto** para que as duas
 * transições sejam admitidas.
 */
async function corpoDeCobranca(
  contratoCodigo: string,
  dias: number = DIAS_ATE_O_VENCIMENTO,
): Promise<Record<string, unknown>> {
  const datas = await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ competencia: string; vencimento: string }[]>`
          SELECT to_char(
                   date_trunc(
                     'month',
                     negocio.data_corrente_da_operacao() + make_interval(days => ${dias})
                   ),
                   'YYYY-MM-DD'
                 ) AS competencia,
                 to_char(
                   negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
                   'YYYY-MM-DD'
                 ) AS vencimento
        `;

        if (linha === undefined) {
          throw new Error('o relógio do banco não devolveu as datas do cenário');
        }

        return linha;
      }),
  );

  return {
    contratoCodigo,
    natureza: NATUREZA_DO_CENARIO,
    referencia: REFERENCIA_DO_CENARIO,
    competencia: datas.competencia,
    dataVencimento: datas.vencimento,
    valorOriginal: VALOR_DA_COBRANCA,
  };
}

/**
 * O `xmin` da tupla da cobrança — o identificador da transação que gravou a versão corrente da linha.
 *
 * É a única leitura deste arquivo que observa coluna de sistema, e ela é **observação**, não caminho de
 * leitura de produto: o `xmin` muda a cada `UPDATE`, e é por isso que a igualdade entre duas medições
 * separa *recusado* de *aceito sem efeito visível*. A empresa entra pelo **contexto**, e nenhum
 * `WHERE empresa_id` é escrito — quem recorta é a política (ADR-0008).
 */
async function xminDaCobranca(codigo: string): Promise<string> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ xmin: string }[]>`
          SELECT xmin::text AS xmin FROM negocio.cobranca WHERE codigo = ${codigo}
        `;

        if (linha === undefined) {
          throw new Error(`a cobrança ${codigo} não foi alcançada para a leitura do xmin`);
        }

        return linha.xmin;
      }),
  );
}

/** A linha crua da política de mora da empresa A: os percentuais **gravados** e o `xmin` dela. */
async function linhaDaPolitica(): Promise<{
  multaPercentual: string;
  jurosPercentual: string;
  xmin: string;
}> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<
          { multaPercentual: string; jurosPercentual: string; xmin: string }[]
        >`
          SELECT multa_percentual::text AS "multaPercentual",
                 juros_percentual::text AS "jurosPercentual",
                 xmin::text AS xmin
            FROM negocio.configuracao_de_mora
        `;

        if (linha === undefined) {
          throw new Error('a política de mora da empresa A não foi alcançada');
        }

        return linha;
      }),
  );
}

/**
 * Quantas linhas de `negocio.cobranca` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que o `CT-534` mede é se alguma linha nasceu. Nenhum
 * `WHERE empresa_id` é escrito — quem recorta é a política (ADR-0008) —, e ela lê a **tabela**, não a
 * visão: o que se quer saber é se a linha física existe.
 */
async function contarCobrancas(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.cobranca
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// A tabela das QUATRO rotas da fatia `regua-de-cobranca` — o eixo do CT-633 e do CT-634
// ---------------------------------------------------------------------------------------------

/** Uma das quatro rotas da fatia, no que o `CT-633` e o `CT-634` precisam saber dela. */
interface RotaDaFatiaDaRegua {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo?: Record<string, unknown>;
  /**
   * `true` só no disparo manual — a única das quatro que exige a AÇÃO além da área.
   *
   * É por este campo que o `CT-634` parte a tabela em três mais uma, e é ele que dá conteúdo à
   * afirmação *"só o disparo é recusado"*: sem ele, o caso teria de repetir o caminho da rota, e a
   * partição passaria a depender de uma cadeia escrita duas vezes.
   */
  readonly exigeAAcao: boolean;
}

/**
 * As **quatro** rotas da fatia, compostas a partir do dono do segmento — nunca redigitadas.
 *
 * Cada uma carrega um corpo **válido** onde há corpo, e a validade é obrigatória por causa do eixo
 * positivo do `CT-634`: é a MESMA chamada que roda com a sessão que alcança a área, e um corpo
 * malformado responderia `422` ali, esvaziando o controle. No eixo negativo o corpo não muda nada — a
 * guarda decide antes de o manipulador ler a requisição —, e é justamente essa ordem que a contagem
 * crua inalterada mede do outro lado.
 *
 * O corpo do `PUT` é o **mesmo** que o cenário já gravou: a rota é idempotente por construção (corpo
 * completo, sem campo opcional), de modo que o eixo positivo exercita a escrita **sem** invalidar o
 * que o `CT-633` afirmou sobre a política.
 */
function rotasDaFatiaDaRegua(codigo: string): readonly RotaDaFatiaDaRegua[] {
  const avisos = rotaDosAvisos(codigo);

  return [
    {
      rotulo: `GET ${RECURSO_DA_AUTOMACAO}`,
      metodo: 'GET',
      alvo: RECURSO_DA_AUTOMACAO,
      exigeAAcao: false,
    },
    {
      rotulo: `PUT ${RECURSO_DA_AUTOMACAO}`,
      metodo: 'PUT',
      alvo: RECURSO_DA_AUTOMACAO,
      corpo: { ...POLITICA_DE_AVISO_DO_CENARIO },
      exigeAAcao: false,
    },
    {
      rotulo: `GET ${RECURSO_DA_AUTOMACAO}/cobrancas/:codigo/avisos`,
      metodo: 'GET',
      alvo: avisos,
      exigeAAcao: false,
    },
    {
      rotulo: `POST ${RECURSO_DA_AUTOMACAO}/cobrancas/:codigo/avisos`,
      metodo: 'POST',
      alvo: avisos,
      // Corpo **vazio e fechado**: não há o que parametrizar num ato cujo conteúdo inteiro é
      // derivado do estado já publicado.
      corpo: {},
      exigeAAcao: true,
    },
  ];
}

/** O cenário dos dois casos da régua: a cobrança avisável e o endereço para onde o aviso iria. */
interface CenarioDaRegua {
  readonly codigo: string;
  readonly emailDoLocatario: string;
}

/**
 * Monta, **pelas rotas reais**, uma cobrança `VENCIDA` cujo locatário tem endereço de contato.
 *
 * O contrato nasce com `gerarCobrancasAutomaticamente: false` e **não é ativado**: o lançamento
 * avulso exige apenas que o contrato exista, e a visão que decide o estado publicado junta cobrança e
 * contrato sem olhar o `status` dele. Ativá-lo faria nascer as parcelas do prazo inteiro, e as
 * contagens cruas que os dois casos comparam passariam a depender do calendário.
 *
 * O endereço do locatário é lido **pela rota**, e não montado a partir do corpo que o criou: é ele que
 * o `CT-634` compara com o destinatário da captura, e lê-lo de volta é o que torna a comparação uma
 * afirmação sobre o que o produto guardou.
 *
 * O estado é **AFIRMADO**, e não presumido do deslocamento: sem essa conferência, uma cobrança em
 * aberto faria o eixo positivo do `CT-634` medir a guarda de estado em vez da de autorização.
 */
async function cenarioDoDisparoManual(): Promise<CenarioDaRegua> {
  const partes = await criarAlvosDoDominio(cookiePleno);
  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: cookiePleno,
    corpo: { ...corpoDeContrato(partes), gerarCobrancasAutomaticamente: false },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const contratoCodigo = (montagem.corpo as { codigo: string }).codigo;
  const cobranca = await lancarCobranca(
    cookiePleno,
    await corpoDeCobranca(contratoCodigo, DIAS_DESDE_O_VENCIMENTO),
  );

  if (cobranca.status !== ESTADO_VENCIDO) {
    throw new Error(`a cobrança ${cobranca.codigo} nasceu ${cobranca.status}`);
  }

  const locatario = (await lerPor(
    `${colecao(CAMINHO_DOS_LOCATARIOS)}/${partes.locatarioId}`,
    cookiePleno,
  )) as { email: string };

  return { codigo: cobranca.codigo, emailDoLocatario: locatario.email };
}

/** Define a política de aviso pela rota real, na aplicação instrumentada. A falha levanta. */
async function definirPoliticaDeAviso(credencial: string): Promise<void> {
  const resposta = await pedir(RECURSO_DA_AUTOMACAO, {
    metodo: 'PUT',
    cookie: credencial,
    corpo: { ...POLITICA_DE_AVISO_DO_CENARIO },
    base: baseComCaptura,
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a definição da política de aviso respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Lê a política de aviso pela rota real, na aplicação instrumentada. A falha levanta. */
async function lerPoliticaDeAviso(credencial: string): Promise<unknown> {
  const resposta = await pedir(RECURSO_DA_AUTOMACAO, {
    cookie: credencial,
    base: baseComCaptura,
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da política de aviso respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

/**
 * Quantas linhas de `negocio.politica_de_aviso` o contexto da empresa A alcança.
 *
 * A contagem é **crua** e sem recorte: o que o `CT-633` mede é se alguma linha nasceu ou sumiu.
 * Nenhum `WHERE empresa_id` é escrito — quem recorta é a política (ADR-0008) —, e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarPoliticasDeAviso(): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.politica_de_aviso
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Quantas tentativas de envio existem na empresa A — contagem **crua**, sem recorte.
 *
 * É a medição que separa *recusado* de *recusado depois de registrar*, e ela é da **tabela** inteira,
 * não de uma cobrança: um disparo que nascesse sobre outra linha continuaria sendo uma linha que não
 * devia existir. Vale aqui, palavra por palavra, o parágrafo de {@link contarPoliticasDeAviso} sobre a
 * ausência de filtro por empresa.
 */
async function contarEnviosDeCobranca(): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.envio_de_cobranca
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Arranjo — tudo pelo caminho real
// ---------------------------------------------------------------------------------------------

/**
 * O sequencial que dá unicidade a tudo o que este arquivo cria.
 *
 * Ele é monotônico e de processo, e não sorteado: os três campos únicos desta superfície —
 * identificador municipal, documento e endereço de e-mail — vivem sob restrições que **alcançam os
 * cadastros retirados** (ADR-0014), de modo que um valor repetido entre casos produziria `422` de
 * unicidade onde o caso mede outra coisa. Determinístico também torna a falha reproduzível.
 */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;
  return sequencial;
}

/** O identificador municipal — único por empresa, e a unicidade alcança os retirados. */
function identificadorMunicipal(): string {
  return `IM-${String(proximo()).padStart(6, '0')}`;
}

/** O corpo completo de um imóvel. **`empresaId` não aparece**, e a ausência é o ponto (ADR-0008). */
function corpoDeImovel(conjuntoId: string, identificador: string): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: 'Ap 101',
    identificadorMunicipal: identificador,
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
  };
}

/**
 * O corpo completo do `PUT` de imóvel — o da criação **menos** `statusLocacao` (T10).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o corpo do `PUT` deste arquivo que
 * carregava um campo que a rota deixou de aceitar. A T10 da fatia `contratos-de-locacao` tirou
 * `statusLocacao` do corpo da alteração — ele passou a ter rota própria —, e `esquemaDeImovelAlterado`
 * é `strictObject`: um corpo que ainda o traga responde `422`. Aqui isso importa duplamente, porque o
 * docblock de {@link EntidadeCirculavel} registra por que o corpo do `PUT` **tem** de ser válido — a
 * borda valida o corpo **antes** de procurar o registro, de modo que um corpo recusado devolveria
 * `422` e o `404` que o `CT-321` mede nunca aconteceria. **Nenhuma asserção foi afrouxada**; o corpo
 * continua completo, e a recusa da chave a mais tem prova própria no `CT-434`.
 *
 * Ele é **derivado** do corpo da criação, espelhando o `omit` do contrato — nunca uma segunda lista.
 */
function corpoDeImovelAlterado(conjuntoId: string, identificador: string): Record<string, unknown> {
  const corpo = corpoDeImovel(conjuntoId, identificador);
  delete corpo.statusLocacao;

  return corpo;
}

/** O corpo completo de um cadastro de pessoa, com documento e endereço **únicos a cada chamada**. */
function corpoDePessoa(): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    nome: `Pessoa ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(proximo()),
    rg: null,
    email: `pessoa.${marca}@exemplo.com.br`,
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
 * Cria, **pelas rotas reais**, um exemplar de cada entidade da empresa da sessão informada.
 *
 * Cada chamada gera uma leva nova, com marca própria: o `CT-319` precisa de um conjunto de alvos
 * intocado para o eixo positivo (que retira, recircula e remove), e o `CT-321` precisa de exemplares
 * exclusivos em cada empresa. Reaproveitar a mesma leva criaria dependência de ordem entre casos.
 */
async function criarAlvosDoDominio(credencial: string): Promise<AlvosDoDominio> {
  const marca = String(proximo()).padStart(6, '0');

  const conjuntoId = await criarPelaRota(credencial, colecao(CAMINHO_DOS_CONJUNTOS), {
    nome: `Edifício ${marca}`,
  });
  const imovelId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_IMOVEIS),
    corpoDeImovel(conjuntoId, identificadorMunicipal()),
  );

  const comodos = colecao(CAMINHO_DOS_COMODOS).replace(':id', imovelId);
  const comComodo = await pedir(comodos, {
    metodo: 'POST',
    cookie: credencial,
    corpo: { nomeComodo: 'Quarto', metragem: 10, observacoes: null },
  });
  if (comComodo.status !== 201) {
    throw new Error(
      `a criação do cômodo respondeu ${String(comComodo.status)}: ${comComodo.texto}`,
    );
  }
  const comodoId = (comComodo.corpo as { comodos: readonly { id: string }[] }).comodos[0]?.id;
  if (comodoId === undefined) {
    throw new Error('a criação do cômodo não devolveu o imóvel com o cômodo dentro');
  }

  const locadorId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_LOCADORES),
    corpoDePessoa(),
  );
  const locatarioId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_LOCATARIOS),
    corpoDePessoa(),
  );
  const fiadorId = await criarPelaRota(credencial, colecao(CAMINHO_DOS_FIADORES), corpoDePessoa());

  return { conjuntoId, imovelId, comodoId, locadorId, locatarioId, fiadorId, marca };
}

/**
 * O corpo completo de um contrato sobre os alvos de uma leva — o arranjo do `CT-320 (b)`.
 *
 * Os termos são fixos e irrelevantes para o que o caso mede: o eixo aqui é a **autorização**, e não a
 * derivação nem as condições de entrada. `empresaId` não aparece — ela sai da sessão, e o
 * `strictObject` do contrato recusaria a chave.
 */
function corpoDeContrato(alvos: AlvosDoDominio): Record<string, unknown> {
  return {
    imovelId: alvos.imovelId,
    locadorId: alvos.locadorId,
    locatarioId: alvos.locatarioId,
    fiadoresIds: [alvos.fiadorId],
    dataInicioLocacao: '2026-01-15',
    prazoMeses: 12,
    valorMensal: 2500,
    diaVencimento: 10,
    gerarCobrancasAutomaticamente: true,
  };
}

/**
 * Cria um registro pela rota real e devolve o identificador da resposta.
 *
 * A falha levanta em vez de devolver: uma precondição que falhasse em silêncio faria o caso reprovar
 * numa asserção adiante, apontando para o lugar errado.
 */
async function criarPelaRota(
  credencial: string,
  colecaoDaEntidade: string,
  corpo: Record<string, unknown>,
): Promise<string> {
  const resposta = await pedir(colecaoDaEntidade, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação em ${colecaoDaEntidade} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return (resposta.corpo as { id: string }).id;
}

/** A marca de retirada do cadastro, lida **pela rota** com a sessão informada. */
async function marcaDeRetirada(item: string, credencial: string): Promise<string | null> {
  const resposta = await pedir(item, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${item} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return (resposta.corpo as { retiradoEm: string | null }).retiradoEm;
}

/** O corpo inteiro do cadastro, lido pela rota — o retrato que o `CT-321` compara antes e depois. */
async function lerPor(item: string, credencial: string): Promise<unknown> {
  const resposta = await pedir(item, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${item} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/** O efetivo publicado da sessão — toda precondição de permissão é AFIRMADA por aqui. */
async function efetivoDe(credencial: string, endereco: string = base): Promise<SessaoPublicada> {
  const resposta = await pedir(CAMINHO_DA_SESSAO_CORRENTE, {
    cookie: credencial,
    base: endereco,
  });

  if (resposta.status !== 200) {
    throw new Error(`a sessão respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as SessaoPublicada;
}

/** Um ajuste individual de permissão, na forma que a camada de dados persiste. */
interface AjusteDoCaso {
  readonly chave: ChaveDoCatalogo;
  readonly efeito: 'CONCEDIDA' | 'NEGADA';
}

/**
 * Escreve os ajustes individuais de uma pessoa pelo caminho REAL da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador de versão
 * incrementado na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro.
 *
 * A escrita é o conjunto INTEIRO de ajustes da pessoa, e não um acréscimo: é assim que
 * `escreverAjustes` funciona, e é por isso que o passo positivo do `CT-320` repete as duas áreas ao
 * conceder a ação.
 */
async function ajustar(
  usuarioId: string,
  empresaId: string,
  ajustes: readonly AjusteDoCaso[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: ajustes.map((ajuste) => ({ chave: ajuste.chave, efeito: ajuste.efeito })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

/**
 * Cria uma pessoa `USUARIO_EMPRESA` da empresa A pela ROTA REAL do Admin e devolve a sessão dela,
 * já **plena**.
 *
 * Tudo pelas rotas reais: a pessoa nasce por `POST /v1/usuarios`, entra pela rota pública com a
 * Senha provisória que a criação devolveu, e cumpre a troca obrigatória por `POST /v1/sessao/senha`.
 * A troca não é conveniência: sem ela a sessão fica RESTRITA (RN-09), e o `403` que ela produz viria
 * da restrição — não da autorização, que é o eixo do caso. É o mesmo arranjo, pelas mesmas rotas, de
 * `circulacao-de-cadastro.e2e.spec.ts`.
 *
 * O **perfil é parâmetro**, com `USUARIO_EMPRESA` por padrão — o valor que todos os chamadores
 * anteriores usavam, de modo que nenhum deles muda de comportamento. Ele existe porque o eixo de
 * indistinguibilidade do `CT-534` precisa de duas sessões de **perfis diferentes** recusadas pela mesma
 * rota, e os dois perfis administráveis pela rota do Admin são exatamente estes dois.
 *
 * O **endereço também é parâmetro**, com a aplicação real por padrão, e ele alcança só a *entrada* e a
 * *troca*: a pessoa nasce pela rota do Admin na aplicação real, e o banco é o mesmo nas duas montagens
 * — o que precisa acontecer contra a instrumentada é a sessão, porque o arcabouço de identidade
 * confere a origem da requisição com cookie contra o endereço base daquela aplicação. É a T12 que o
 * usa, para os sujeitos do `CT-633` e do `CT-634`.
 */
async function pessoaOperandoComSenhaTrocada(
  prefixo: string,
  perfil: 'ADMIN_EMPRESA' | 'USUARIO_EMPRESA' = 'USUARIO_EMPRESA',
  endereco: string = base,
): Promise<PessoaEmOperacao> {
  const criada = await pedir(CAMINHO_DAS_PESSOAS, {
    metodo: 'POST',
    cookie: cookiePleno,
    corpo: {
      nome: 'Pessoa Que Só Administra Cadastros',
      email: `${prefixo}.${randomUUID()}@exemplo.com.br`,
      perfil,
    },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const { usuarioId, email, senhaProvisoria } = criada.corpo as {
    usuarioId: string;
    email: string;
    senhaProvisoria: string;
  };

  const restrita = await entrar(email, senhaProvisoria, endereco);
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie: restrita,
    corpo: { senhaAtual: senhaProvisoria, senhaNova: SENHA_TROCADA },
    base: endereco,
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
  // importa é o cookie que passa a valer, e não por qual das duas ele chegou.
  return { usuarioId, cookie: credencialDe(troca.cookies) ?? restrita };
}

/** Uma pessoa da empresa já operando com sessão plena. */
interface PessoaEmOperacao {
  readonly usuarioId: string;
  readonly cookie: string;
}

/**
 * A sessão do produto, no que este arquivo observa dela.
 *
 * `perfil` entra com o `CT-534`: é ele que torna *"indistinguível entre perfis"* uma afirmação
 * verificável, em vez de uma suposição sobre como as duas pessoas foram criadas.
 */
interface SessaoPublicada {
  readonly perfil: string;
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
  /**
   * Contra qual das duas aplicações a requisição corre — a real, por omissão.
   *
   * O parâmetro nasceu na T12, quando o `CT-633` e o `CT-634` passaram a exercitar a aplicação
   * **instrumentada** (a que recebeu o capturador por `overrideProvider`). Ele é opcional de
   * propósito: os casos anteriores continuam batendo na aplicação real, sem uma linha alterada. É a
   * mesma forma, e a mesma razão, do parâmetro homônimo de `automacao-de-cobranca.e2e.spec.ts`.
   */
  readonly base?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const endereco = opcoes.base ?? base;
  const cabecalhos: Record<string, string> = { connection: 'close', origin: endereco };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, endereco), {
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

/** O cookie de sessão de uma lista de `Set-Cookie`, quando houver. */
function credencialDe(cookies: readonly string[]): string | undefined {
  const bruto = cookies.find((valor) =>
    (valor.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  return bruto?.split(';')[0];
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string, endereco: string = base): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
    base: endereco,
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = credencialDe(entrada.cookies);
  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial;
}
