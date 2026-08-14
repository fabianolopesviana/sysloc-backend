/**
 * Os esquemas de `@sysloc/contracts` — CT-334 a CT-338, CT-340, CT-341, mais CT-424 e CT-428, que a
 * fatia `contratos-de-locacao` acrescenta, CT-537 mais CT-540 a CT-545, que a fatia
 * `cobranca-e-mora` acrescenta, CT-604 e CT-605, que a fatia `regua-de-cobranca` acrescenta, e
 * CT-713 e CT-731, que a sub-fatia `documentos-e-confirmacao` acrescenta. O **CT-537 substitui o
 * CT-429** daquela fatia: ver o parágrafo dedicado abaixo, e a linha `SUT_IS_CORRECT_BECAUSE:` no
 * ponto do caso.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-02    | CT-334 | O esquema de ENTRADA de imóvel aprova `DISPONIVEL` e `INDISPONIVEL` em
 * |          |        | `statusLocacao`, devolvendo o valor **verbatim** e um corpo profundamente
 * |          |        | igual ao enviado — nenhum campo acrescentado nem removido. |
 * | CA-02    | CT-335 | `LOCADO` é recusado na ENTRADA com `issues[0].path === ['statusLocacao']`,
 * |          |        | e aprovado na SAÍDA — a restrição é do esquema de entrada, não do enum. |
 * | CA-16    | CT-336 | TODO esquema de entrada publicado recusa chave desconhecida com
 * |          |        | `unrecognized_keys`, e aprova o mesmo corpo sem ela. |
 * | CA-14    | CT-337 | `empresaId` não é declarado no `shape` de nenhum esquema de entrada, e
 * |          |        | enviá-lo recusa nomeando a chave. |
 * | CA-15    | CT-338 | A janela aprova `limite` igual ao teto devolvendo-o verbatim e RECUSA
 * |          |        | `teto + 1` — pedido acima do teto nunca é truncado em silêncio. |
 * | CA-16    | CT-340 | `metragem` espelha as DUAS metades de `numeric(10,2)`: aprova o teto e
 * |          |        | `25.55` verbatim, e RECUSA `teto + 1` e `25.555` nomeando o campo — nenhum
 * |          |        | valor aprovado pelo contrato estoura o `INSERT` (500) nem é gravado com
 * |          |        | valor diferente do enviado (arredondamento silencioso). |
 * | CA-16    | CT-341 | O endereço é canonizado num ponto único: `estado` volta em maiúsculas e
 * |          |        | `cep` volta sem máscara, iguais em imóvel e em pessoa. |
 * | CA-19    | CT-424 | `esquemaDoContrato.status` é união fechada de exatamente
 * |          |        | `{RASCUNHO, ATIVO, CANCELADO, ENCERRADO}` — qualquer outro valor, inclusive
 * |          |        | o `RESCINDIDO` do sistema antigo, é recusado nomeando `status`. E o recurso
 * |          |        | publicado **não** expõe o UUID interno. |
 * | CA-19    | CT-424 | O corpo da montagem é `strictObject` completo: os CINCO campos que o
 * |          | (b)    | servidor decide (`codigo`, `status`, `dataFimLocacao`, `valorTotalContrato`,
 * |          |        | `empresaId`) são recusados como chave desconhecida, e cada campo do corpo
 * |          |        | tem a sua fronteira — inclusive `fiadoresIds` sem repetição. |
 * | CA-04    | CT-428 | O código é canonizado num ponto único (`trim` + maiúsculas) e a largura do
 * |          |        | sequencial é de CINCO dígitos: quatro é recusado, seis é recusado, e todo
 * |          |        | código que `formatarCodigoDeContrato` emite dentro da largura é aceito. |
 * | CA-01    | CT-428 | `valorMensal` e `prazoMeses` espelham as capacidades das colunas
 * |          | (b)    | (`numeric(15,2)` e `integer`), o PRODUTO delas também cabe, e a restrição de
 * |          |        | escala vale na ENTRADA e **não** na SAÍDA. |
 * | CA-06    | CT-537 | A resposta da ativação exige `efeitos.cobrancasGeradas` **inteiro não
 * | CA-02    |        | negativo**: `0`, `3` e `13` são aceitos com o valor sobrevivendo à análise, e
 * |          |        | `false`, `-1` e `2.5` são recusados nomeando `['efeitos','cobrancasGeradas']`.
 * |          |        | O bloco continua fechado — campo extra é recusado nomeando
 * |          |        | `efeitos.boletosEmitidos` — e os dois enums da cobrança seguem com exatamente
 * |          |        | cinco e quatro membros, na ordem publicada. (Substitui o CT-429.) |
 * | §4.1     | CT-540 | `NATUREZAS_DE_COBRANCA` publica exatamente
 * |          |        | `['ALUGUEL','AGUA','CONDOMINIO','ENERGIA','OUTRO']` e `ESTADOS_DA_COBRANCA`
 * |          |        | exatamente `['A_VENCER','VENCIDA','PAGA','CANCELADA']`, nesta ordem e
 * |          |        | congelados; `esquemaDaCobranca` aprova os nove rótulos devolvendo o recurso
 * |          |        | verbatim e recusa qualquer outro nomeando `natureza` ou `status`. |
 * | §4.1     | CT-540 | `ESTADOS_EM_ABERTO` publica exatamente `['A_VENCER','VENCIDA']`, nesta
 * |          | (b)    | ordem, e está **congelada em execução** — a partição que
 * |          |        | `predicadoDaCarteira` consulta para alcançar o índice parcial não pode
 * |          |        | crescer por um `push` de consumidor. (D9 · F3/T4) |
 * | §4.2     | CT-541 | `PREFIXO_DO_CODIGO_DE_COBRANCA === 'COB'` e
 * | §4.3     |        | `LARGURA_DO_SEQUENCIAL_DE_COBRANCA === 7`; o esquema aplica `trim` →
 * | §4.4     |        | maiúsculas e aceita exatamente `COB-\d{4}-\d{7}`, recusando as larguras 5, 6
 * |          |        | e 8; e todo código que o formatador emite dentro da largura é aceito. |
 * | §4.5     | CT-542 | `esquemaDeCobrancaNova` declara exatamente seis campos, nenhum opcional, e
 * |          |        | recusa `codigo`, `status`, `locatarioId`, `valorMulta`, `pagoEm` e
 * |          |        | `empresaId` com `unrecognized_keys` nomeando a chave enviada. |
 * | §4.6     | CT-543 | `competencia` só é aceita no primeiro dia do mês; `valorOriginal` só é aceito
 * | §4.7     |        | positivo, no teto e na escala de `numeric(15,2)`; `referencia` só é aceita
 * |          |        | não vazia e dentro de `MAIOR_TEXTO_CURTO` — e toda recusa reporta o `path` do
 * |          |        | próprio campo, nunca da raiz do objeto. |
 * | §4.9     | CT-544 | `esquemaDaCobranca` declara exatamente os 18 campos publicados, não declara
 * |          |        | `id` e descarta o `id` que chegue de fora; e as grandezas monetárias de saída
 * |          |        | não carregam escala, aprovando o resíduo de ponto flutuante que a escala
 * |          |        | de entrada RECUSA. |
 * | §4.10    | CT-545 | Em `packages/contracts/src/` existe exatamente uma declaração exportada de
 * |          |        | `MAIOR_VALOR_MONETARIO` e uma de `ESCALA_MONETARIA`, ambas em `contrato.ts`;
 * |          |        | `cobranca.ts` as obtém por `import … from './contrato.js'` e não redeclara
 * |          |        | nenhuma das duas, sob `export` ou sem ele. |
 * | CA-15    | CT-604 | `esquemaDaPoliticaDeAvisoNova` declara exatamente os SEIS campos publicados e
 * |          |        | aprova o corpo completo e as bordas fechadas de cada faixa —
 * |          |        | `diasAntesDoVencimento` 0 e 90, `intervaloMinimoDias` 1 e 90, `00:00`/`23:59`
 * |          |        | e a janela de instante único —, devolvendo objeto ESTRITAMENTE igual ao de
 * |          |        | entrada, sem coerção nem descarte. |
 * | CA-15    | CT-604 | A linha do registro de envio publica `id` **UUID** e `cobrancaCodigo` pelo
 * | CA-11    | (b)    | `ESQUEMA_DO_CODIGO_DE_COBRANCA` importado (que canoniza a caixa); aceita
 * |          |        | `destinatario` **vazio** com causa preenchida (RD-11) e recusa `null`; os dois
 * |          |        | enums do registro publicam exatamente `['AUTOMATICO','MANUAL']` e
 * |          |        | `['ENVIADA','FALHOU','SEM_DESTINATARIO']`, congelados; e os dois esquemas de
 * |          |        | SAÍDA são ABERTOS enquanto o de ENTRADA recusa a mesma chave. |
 * | CA-15    | CT-605 | Todo corpo que viole o conjunto fechado do canal, a completude do
 * |          |        | `strictObject`, a faixa de cada inteiro, o molde `HH:MM` ou a ordem da janela é
 * |          |        | recusado com **exatamente uma** questão, cujo `path` é o do campo ofensor e
 * |          |        | cujo `code` é o da cláusula violada; chave desconhecida — inclusive
 * |          |        | `empresaId` — é recusada por `unrecognized_keys` nomeando a chave em `keys`. |
 * | CA-16    | CT-731 | `esquemaDoLocatario` publica os 15 campos de `esquemaDaPessoa` **mais**
 * |          |        | `emailConfirmadoEm`, anulável e ISO-8601; e `esquemaDaPessoa` segue com
 * |          |        | exatamente os 15 de sempre — o mesmo objeto com o campo extra, analisado por
 * |          |        | ele, **não** o expõe. Os dois lados por igualdade de CONJUNTO de chaves. |
 * | CA-11    | CT-731 | O corpo da apresentação do portador aprova o segredo de 43 caracteres do
 * | CA-15    | (b)    | alfabeto base64url devolvendo-o verbatim, e recusa nomeando `segredo` toda
 * |          |        | forma vizinha — 42, 44, o digest hexadecimal de 64, o alfabeto do base64
 * |          |        | clássico e o mesmo segredo com espaço em volta; chave desconhecida —
 * |          |        | inclusive `empresaId` — é recusada por `unrecognized_keys`. |
 * | CA-13    | CT-731 | `esquemaDaConfirmacao` admite **só** `{ confirmado: true }`, recusando `false`;
 * | CA-12    | (c)    | e `esquemaDoReenvioDeConfirmacao` declara exatamente `reenviadoEm` e
 * |          |        | `expiraEm`, sem chave alguma de desfecho de e-mail. |
 * | CA-07    | CT-713 | `esquemaDeContratoNovo` RECUSA o corpo que traga `pdfContratoArquivo`, com
 * |          |        | **exatamente uma** questão de código `unrecognized_keys` nomeando a chave em
 * |          |        | `keys`, enquanto o MESMO corpo sem ela é aprovado verbatim; e
 * |          |        | `esquemaDoContrato` declara exatamente as CATORZE chaves que restaram, por
 * |          |        | igualdade de conjunto — nunca por ausência isolada. |
 *
 * Rastreabilidade: `CA-02 → CT-334, CT-335 (RN-10)` · `CA-14 → CT-337 (RN-01)` ·
 * `CA-15 → CT-338 (RN-06)` · `CA-16 → CT-336, CT-340, CT-341 (RN-11)` ·
 * `CA-19 → CT-424, CT-424 (b) (RN-02, RN-03)` · `CA-04 → CT-428 (RN-04)` ·
 * `CA-01 → CT-428 (b) (RN-08)` · `CA-06 → CT-537 (RN-12)` · `CA-02 → CT-537 (RN-06)` ·
 * `CA-§4.1 → CT-540 (RD-03, RD-04)` ·
 * `CA-§4.2/§4.3/§4.4 → CT-541 (RD-02)` · `CA-§4.5 → CT-542 (RD-01)` ·
 * `CA-§4.6/§4.7 → CT-543 (RD-03, RD-16)` · `CA-§4.9 → CT-544 (RD-04, RD-09)` ·
 * `CA-§4.10 → CT-545 (RD-16)` · `CA-15 → CT-604, CT-605 (RN-13)` ·
 * `CA-15, CA-11 → CT-604 (b) (RD-08, RD-11)` · `CA-16 → CT-731 (RD-06, RD-07)` ·
 * `CA-11, CA-15 → CT-731 (b) (RD-11, RD-12)` · `CA-12, CA-13 → CT-731 (c) (RD-10)` ·
 * `CA-07 → CT-713 (RN-01)`.
 *
 * ---------------------------------------------------------------------------
 * Por que os casos vêm em pares, e por que nenhum deles sozinho serve
 * ---------------------------------------------------------------------------
 *
 * **CT-334 × CT-335.** Só o positivo deixaria verde um esquema que aceitasse o enum inteiro; só o
 * negativo deixaria verde um esquema que recusasse tudo. E a segunda metade do CT-335 — a SAÍDA
 * aprovando `LOCADO` — é o que impede a "correção" mais tentadora e mais errada: apagar `LOCADO` do
 * enum do domínio faria a entrada recusá-lo e deixaria a fatia de contratos sem como devolver o
 * valor que ela mesma produz.
 *
 * **CT-338.** A fronteira do teto é `<= MAIOR_PAGINA`. Provar só o lado aceito deixaria verde um
 * teto maior; provar só o recusado deixaria verde um teto menor. É o mesmo desenho do par
 * CT-013/CT-014 de `packages/auth/test/senha.spec.ts`, e o teto é **lido da constante exportada** —
 * redigitar `200` aqui faria o caso sobreviver a um teto alargado na constante, que é justamente o
 * mutante que ele precisa detectar.
 *
 * **CT-336 e CT-337** afirmam a contagem exata de esquemas examinados. Sem ela, *"nenhum esquema
 * violou"* seria indistinguível de *"nenhum esquema foi olhado"* — e a tabela é montada a partir dos
 * símbolos EXPORTADOS pelo pacote, não de uma lista redigitada, para que um esquema de entrada novo
 * entre nas duas varreduras sozinho (ou reprove por não ter corpo válido declarado).
 *
 * **CT-428** é a **rede** que o P4 do Protocolo Antirregressão exige do marcador `DECISÃO FECHADA`
 * da largura, e por isso ela prende a largura pelos **dois** lados. Só o lado de baixo (quatro
 * dígitos recusados) deixaria verde um esquema aberto em `\d{5,}`, e a largura seguiria sem asserção
 * por cima — o `CLAUDE.md` e o `plano-execucao.md` escrevem QUATRO, e a "correção" para quatro
 * passaria pela suíte se a rede fosse frouxa de um dos lados. A amarra `formatador × esquema` é a
 * terceira ponta: sem ela, os dois poderiam divergir e a emissão produziria código que a leitura
 * recusa.
 *
 * **CT-428 (b)** repete o desenho do CT-340 para o dinheiro, com um par a mais. Os tetos são escritos
 * **por extenso** pela mesma razão registrada lá: derivá-los das constantes deixaria as duas pontas
 * andando juntas e o caso verde num teto alargado. E o par que discrimina a restrição CONJUNTA usa
 * dois fatores **ambos dentro dos seus tetos** cujo produto não cabe — nenhum teto de campo isolado
 * o pega.
 *
 * **CT-537 substitui o CT-429**, e a substituição é o **preço declarado** do débito que ela fecha. O
 * CT-429 afirmava o literal `false` no esquema, e não o comportamento na rota: era o que obrigava a F3
 * a tocar `contrato.ts` para gerar cobrança, em vez de o significado da resposta mudar por omissão. O
 * gatilho chegou, e o par que agora discrimina é outro — **o `false` do lado RECUSADO**. Os três aceitos
 * sozinhos deixariam verde um `z.number()` sem `int()` e sem `nonnegative()`; os três recusados sozinhos
 * deixariam verde um esquema que recusasse tudo; e sem o `false` explicitamente entre os recusados, um
 * `z.union([z.literal(false), z.number()])` — a "correção compatível", que é a tentação óbvia de quem
 * quiser não quebrar consumidor — passaria pela suíte inteira. O passo do campo extra é a quarta ponta:
 * ele afirma que o `strictObject` **não** foi afrouxado junto com o campo.
 *
 * **MUTANTE EXECUTADO — MT-T9-A (2026-08-10).** Aplicado ao fonte de produção
 * (`packages/contracts/src/contrato.ts`) e invocado pelo **script do pacote**
 * (`pnpm --filter @sysloc/contracts test`), nunca por `vitest run` avulso. O mutante é justamente a
 * "correção compatível" descrita acima — `z.number().int().nonnegative()` trocado por
 * `z.union([z.literal(false), z.number()])` —, e o resultado é `3 failed | 224 passed`: reprovam os
 * três casos do eixo RECUSADO (`expected true to be false`), um por cláusula perdida — o `false` que a
 * união readmite, o `-1` que `nonnegative()` barrava e o `2.5` que `int()` barrava. Os três aceitos
 * seguem verdes, que é exatamente o que torna o par necessário. Reversão conferida por `sha256sum`
 * idêntico ao estado pré-mutante, com o controle de volta a `227 passed`.
 *
 * **CT-541** é a **rede** que o P4 do Protocolo Antirregressão exige do marcador `DECISÃO FECHADA`
 * da largura 7, em `cobranca.ts`, e ela prende a largura pelos **dois** lados pela mesma razão do
 * CT-428 — com um agravante: aqui a largura DIVERGE da série irmã, e "harmonizar" as duas para cinco
 * dígitos é a tentação de quem lê os dois arquivos lado a lado. Sem os cinco dígitos recusados e sem
 * os oito, essa harmonização passaria pela suíte inteira.
 *
 * **CT-544** carrega a rede da assimetria entrada × saída, e ela vem em **par**: um caso aprova o
 * resíduo de ponto flutuante da derivação, e o seguinte afirma que `multipleOf(ESCALA_MONETARIA)`
 * **recusa** os mesmos dois números. Sozinho, o primeiro seria infalível (AP-29) — os números que o
 * card sugeria (`6.2399999999999995`, `193.66999999999996`) são aprovados pela tolerância do zod,
 * medido, e um caso construído sobre eles seguiria verde com a escala replicada na saída. Os que
 * ficaram foram MEDIDOS contra a aritmética da RD-07 e são recusados; é o par que detecta.
 *
 * **CT-604 × CT-605.** O par é o que discrimina, e nenhum dos dois serve sozinho: a tabela de 22
 * recusas do CT-605 seria satisfeita, byte a byte, por um esquema que recusasse **todo** corpo — é
 * exatamente o modo de falha que uma tabela de recusas não pega —, e as três linhas aceitas do CT-604
 * seriam satisfeitas por um esquema sem faixa, sem enum e sem molde de hora. As bordas do CT-604 são
 * **fechadas dos dois lados** pelo companheiro: `diasAntesDoVencimento` 0 aceito contra `-1` recusado,
 * 90 aceito contra `91` recusado, `intervaloMinimoDias` 1 aceito contra `0` recusado. E a janela de
 * instante único (`janelaFim === janelaInicio`) é a borda que pega a troca de `>=` por `>`, que
 * nenhuma linha de recusa alcança.
 *
 * **CT-604 (b)** carrega as duas propriedades do registro que nenhum outro caso do pacote alcança. A
 * primeira é a **cadeia vazia em `destinatario`**: sem ela, um `z.email()` ou um `min(1)` passaria
 * pela suíte e tornaria a linha da RD-11 impublicável justamente no caso que ela existe para
 * registrar. A segunda é o **consumo** de `ESQUEMA_DO_CODIGO_DE_COBRANCA` em vez de um molde
 * redigitado, e ela vem em par: a largura 5 recusada (a harmonização tentadora com a série do
 * contrato) e a caixa canonizada — um `z.string()` no lugar do esquema importado passaria no primeiro
 * eixo se ele fosse só "recusa algo", e é a canonização que o discrimina.
 *
 * **TRÊS MUTANTES EXECUTADOS — MT-T2-A/B/C (2026-08-11).** As asserções destes três casos são
 * **comportamentais** e por isso não exigiriam a prova (`.claude/rules/testing-stack.md`); os
 * mutantes foram medidos assim mesmo, porque cada um deles é uma decisão registrada por extenso no
 * cabeçalho de `src/automacao-de-cobranca.ts`, e decisão sem rede é o que a rodada seguinte reabre.
 * Os três rodaram pelo **script do pacote** (`pnpm --filter @sysloc/contracts test`), nunca por
 * `vitest run` avulso, e os três foram revertidos com `sha256sum` idêntico ao estado pré-mutante,
 * com o controle de volta a `267 passed`.
 *
 * - **MT-T2-A — a solidão do enum**: `CANAIS_DE_AVISO` passa a `['EMAIL', 'SMS']`. Resultado:
 *   `2 failed | 265 passed` — reprovam a amarra literal e a linha que recusa `SMS`. É o par que
 *   prova que a lista literal do caso não deriva da constante: derivada, as duas pontas andariam
 *   juntas e o canal inventado passaria.
 * - **MT-T2-B — a borda da janela**: `janelaFim >= janelaInicio` vira `janelaFim > janelaInicio`.
 *   Resultado: `1 failed | 266 passed` — reprova exatamente a linha da **janela de instante único**,
 *   e nenhuma das 22 recusas do CT-605 a pega. É a medida de por que a borda aceita precisa existir.
 * - **MT-T2-C — o destinatário ausente**: `destinatario: z.string()` vira `z.email()`. Resultado:
 *   `1 failed | 266 passed` — reprova só a linha da RD-11, que é a única cadeia vazia do arquivo.
 *
 * **CT-731 é o par CRESCIMENTO × INTOCABILIDADE, e nenhuma das duas metades serve sozinha.** A
 * primeira afirma que `esquemaDoLocatario` publica `emailConfirmadoEm`; sozinha, ela ficaria verde
 * com o campo acrescentado diretamente a `esquemaDaPessoa` — que é a forma **errada** de entregar o
 * mesmo requisito, porque publicaria o campo também em locador e fiador, dois recursos que não têm
 * confirmação alguma a afirmar. A segunda metade é o companheiro negativo (`ct_id: self`): o
 * **mesmo** objeto, com o campo presente na entrada, analisado por `esquemaDaPessoa`, não o expõe na
 * saída.
 *
 * As duas são por **igualdade de conjunto de chaves**, e não por `toContain`. A troca de igualdade
 * por presença é o furo herdado que a F2 fechou quando `esquemaDoImovel` ganhou `contratoVigente`:
 * *"inclui pelo menos"* seguiria verde com um campo a mais em qualquer dos dois lados, que é
 * exatamente a regressão de forma que este caso existe para pegar.
 *
 * **CT-731 (b)** prende o molde do segredo pelos dois lados, e as recusas são as **vizinhas**, não
 * as fáceis: 42 e 44 caracteres cercam o comprimento exato (um `{43,}` ou um `{42,44}` reprova), o
 * digest hexadecimal de 64 é o valor que o banco guarda e que a rota pública **não** pode aceitar no
 * lugar do original, o alfabeto do base64 clássico (`+`/`/`) discrimina o alfabeto declarado, e o
 * segredo com espaço em volta é o que pega a expressão sem âncora. Um caso que recusasse só `'abc'`
 * ficaria verde com `z.string().min(1)`.
 *
 * **CT-731 (c)** carrega a única propriedade desta task que **nenhuma camada acima alcança**:
 * `confirmado: z.literal(true)` e `confirmado: z.boolean()` produzem a MESMA resposta HTTP no
 * caminho feliz, de modo que a prova por rota (CT-721, T11) é cega para a diferença. Só o eixo
 * recusado — `{ confirmado: false }` — a discrimina, e é por isso que ele mora aqui, na camada mais
 * baixa que falha quando a invariante quebra.
 *
 * **QUATRO MUTANTES EXECUTADOS — MT-T2b-A/B/C/D (2026-08-13).** As asserções destes três casos são
 * **comportamentais** e por isso não exigiriam a prova (`.claude/rules/testing-stack.md`); os
 * mutantes foram medidos assim mesmo, porque cada um deles é uma decisão registrada por extenso nos
 * cabeçalhos de `src/confirmacao-de-email.ts` e de `src/pessoa.ts`, e decisão sem rede é o que a
 * rodada seguinte reabre. Os quatro rodaram pelo **script do pacote**
 * (`pnpm --filter @sysloc/contracts test`), nunca por `vitest run` avulso, e os quatro foram
 * revertidos com `sha256sum` idêntico ao estado pré-mutante, com o controle de volta a `293 passed`.
 *
 * - **MT-T2b-A — a entrega pela forma errada**: `emailConfirmadoEm` acrescentado diretamente a
 *   `esquemaDaPessoa`. Resultado: `2 failed | 291 passed` — reprovam a declaração dos quinze campos
 *   e o companheiro negativo. As três asserções positivas do locatário seguem **verdes**, que é
 *   exatamente o motivo de o par existir: sozinhas, elas aprovariam a forma que publica o campo em
 *   locador e fiador.
 * - **MT-T2b-B — o booleano no lugar do fato**: `confirmado: z.literal(true)` vira `z.boolean()`.
 *   Resultado: `1 failed | 292 passed` — reprova só o eixo recusado, e nenhuma outra asserção do
 *   pacote a alcança. É a medida de que a prova por rota seria cega para este mutante.
 * - **MT-T2b-C — o comprimento vira piso**: `{43}` vira `{43,}` na expressão do segredo. Resultado:
 *   `2 failed | 291 passed` — reprovam os 44 caracteres e o digest hexadecimal de 64. As demais
 *   recusas seguem verdes, e é o cerco pelas vizinhas que detecta.
 * - **MT-T2b-D — a resposta aberta**: `esquemaDoReenvioDeConfirmacao` vira `z.object`. Resultado:
 *   `1 failed | 292 passed` — reprova a chave `desfecho`, que é a única que o `202` não pode
 *   afirmar.
 *
 * Sem colaborador algum: os esquemas são funções puras. Fronteira real de execução: **nenhuma** —
 * salvo no CT-545, que é `filesystem`. As demais asserções são comportamentais — exercitam o esquema
 * e observam o desfecho —, e por isso não exigem prova de falsificação.
 *
 * ---------------------------------------------------------------------------
 * CT-545 é ESTÁTICO — a prova de falsificação, medida
 * ---------------------------------------------------------------------------
 *
 * Ele inspeciona o **texto** do fonte, e por isso a prova é OBRIGATÓRIA
 * (`.claude/rules/testing-stack.md`). Os dois mutantes foram aplicados ao fonte, medidos e
 * revertidos, e os dois rodaram pelo SCRIPT do pacote — `pnpm --filter @sysloc/contracts test` —, e
 * não por `vitest run` avulso.
 *
 * - **Mutante 1 — a segunda definição do mesmo fato**: `export const ESCALA_MONETARIA = 0.01;`
 *   acrescentado a `src/comum.ts`, que é exatamente a forma do débito **D3** já aberto no projeto.
 *   Resultado: `1 failed | 218 passed`, com `arquivosQueDeclaram` igual a
 *   `['src/comum.ts', 'src/contrato.ts']` — a falha **nomeia** o arquivo culpado. O caso do import
 *   seguiu **verde**, que é o que prova a contagem ser carregada e não redundante.
 *   ⚠️ O mutante é o do card **corrigido para compilar**: acrescentá-lo a `src/cobranca.ts`, como
 *   ele pede à letra, colide com o `import` do mesmo nome e reprova no `tsc --build` **antes** de
 *   qualquer asserção correr — seria "reprovou sem provar nada", o modo de falha que o CT-339
 *   registra. Um terceiro arquivo é a forma fiel, e é a que a própria Obs do card nomeia.
 * - **Mutante 2 — a redeclaração local, sem `export`**: em `src/cobranca.ts`, os dois nomes saem do
 *   `import … from './contrato.js'` e entram como `const` local. Resultado: `1 failed | 218 passed`,
 *   com `simbolosImportados` igual a `['ESQUEMA_DO_CODIGO_DE_CONTRATO']`. Os dois casos da contagem
 *   seguiram **verdes** — sem `export`, a redeclaração não aparece na varredura do primeiro caso —,
 *   e é isso que prova a metade do import ser carregada.
 *
 * Revertidos os dois, o controle voltou a `219 passed`.
 *
 * ---------------------------------------------------------------------------
 * CT-541 é a rede do `DECISÃO FECHADA` da largura 7 — e ela foi medida
 * ---------------------------------------------------------------------------
 *
 * O P4 do Protocolo Antirregressão exige que o marcador tenha prova que reprove se o defeito voltar.
 * Mutante aplicado a `src/cobranca.ts`: `LARGURA_DO_SEQUENCIAL_DE_COBRANCA` de `7` para `5` — a
 * "harmonização" com a série do contrato de locação, que é a tentação registrada no marcador.
 * Resultado: `28 failed | 191 passed`, entre elas o caso que recusa `COB-2026-00058`. Revertido, o
 * controle voltou a `219 passed`. A asserção é comportamental, e o par de literais do primeiro caso
 * é o que pega o mutante que derivar-das-constantes não pegaria — alargar a constante moveria as
 * duas pontas juntas.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. Aqui ele repete, byte a byte, o que
//        `folha.spec.ts` já faz neste mesmo pacote: o acessório de varredura é **reusado**, e não
//        recopiado, porque cópia de varredor diverge em silêncio e passa a provar coisa diferente
//        da que o caso afirma provar. Nenhum símbolo NOVO é pedido ao acessório — os três já
//        existiam —, de modo que o débito ganha um consumidor e não ganha superfície.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`. Para ESTE pacote, só a segunda saída serve: a primeira
//        criaria a aresta `@sysloc/contracts` → `@sysloc/db` que o CT-339 proíbe.
// POR QUE NÃO AGORA: extrair o pacote de acessórios é trabalho de todos os consumidores, alheio a
//        esta task, e o Protocolo Antirregressão veda refactor fora do escopo.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  listarFontesTs,
  semComentarios,
  varrerArquivos,
} from '../../db/test/varredura-de-fontes.ts';
// `MAIOR_TEXTO_CURTO` não é publicado pelo índice do pacote — ele é composição interna do contrato,
// e publicá-lo só para o teste vê-lo alargaria a superfície de produção (Iron Law #6). O teste o lê
// do ponto único onde ele vive, que é o mesmo que `cobranca.ts` importa.
import { MAIOR_TEXTO_CURTO } from '../src/comum.ts';
import * as contratos from '../src/index.ts';
import {
  CAMINHOS_DO_AVISO,
  CANAIS_DE_AVISO,
  DESFECHOS_DO_AVISO,
  ESCALA_DA_METRAGEM,
  ESCALA_MONETARIA,
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  ESTADOS_DA_COBRANCA,
  ESTADOS_DO_CONTRATO,
  ESTADOS_EM_ABERTO,
  esquemaDaApresentacaoDoPortador,
  esquemaDaAtivacaoDeContrato,
  esquemaDaCobranca,
  esquemaDaConfirmacao,
  esquemaDaJanela,
  esquemaDaPessoa,
  esquemaDaPoliticaDeAviso,
  esquemaDaPoliticaDeAvisoNova,
  esquemaDeCobrancaNova,
  esquemaDeComodoNovo,
  esquemaDeContratoNovo,
  esquemaDeImovelNovo,
  esquemaDePessoaNova,
  esquemaDoContrato,
  esquemaDoEnvioDeCobranca,
  esquemaDoImovel,
  esquemaDoLocatario,
  esquemaDoReenvioDeConfirmacao,
  formatarCodigoDeCobranca,
  formatarCodigoDeContrato,
  LARGURA_DO_SEQUENCIAL_DE_COBRANCA,
  LARGURA_DO_SEQUENCIAL_DE_CONTRATO,
  MAIOR_METRAGEM,
  MAIOR_PAGINA,
  MAIOR_PRAZO_EM_MESES,
  MAIOR_VALOR_MONETARIO,
  NATUREZAS_DE_COBRANCA,
  PAGINA_PADRAO,
  PREFIXO_DO_CODIGO_DE_COBRANCA,
  PREFIXO_DO_CODIGO_DE_CONTRATO,
  SITUACOES_INFORMAVEIS,
} from '../src/index.ts';

/** O corpo canônico de `POST /v1/imoveis` (tech spec §4.1.1), sem `statusLocacao`. */
const CORPO_DE_IMOVEL = {
  conjuntoId: '9f1c0000-0000-4000-8000-000000000001',
  nomeImovel: 'Ap 101',
  identificadorMunicipal: '12345.678.9012-3',
  tipoImovel: 'RESIDENCIAL',
  logradouro: 'Rua X',
  numero: '100',
  complemento: null,
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01000000',
  observacoes: null,
} as const;

/** Um cadastro de pessoa completo e válido — o corpo de `POST /v1/locadores`. */
const CORPO_DE_PESSOA = {
  nome: 'Ana Alves',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '12345678909',
  rg: null,
  email: 'ana@exemplo.com.br',
  telefone: '11999990000',
  logradouro: 'Rua Y',
  numero: '20',
  complemento: null,
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01000000',
} as const;

/**
 * O cadastro de pessoa como a API o devolve — o corpo de entrada mais o que o servidor decide.
 *
 * Ele é montado **sobre** {@link CORPO_DE_PESSOA}, e não redigitado: uma segunda lista dos treze
 * campos comuns ficaria livre para divergir da primeira na próxima emenda do cadastro.
 */
const PESSOA_PUBLICADA = {
  id: '5d2f0000-0000-4000-8000-000000000003',
  ...CORPO_DE_PESSOA,
  retiradoEm: null,
} as const;

/**
 * As chaves que `esquemaDaPessoa` publica — as **quinze**, na ordem em que o arquivo as declara.
 *
 * A lista é literal de propósito: derivá-la de `Object.keys(esquemaDaPessoa.shape)` faria as duas
 * pontas andarem juntas, e o campo acrescentado ao esquema entraria também na expectativa — a
 * asserção infalível (AP-29) que o CT-731 existe justamente para não ser.
 */
const CHAVES_DA_PESSOA = [
  'id',
  'nome',
  'tipoPessoa',
  'documentoPrincipal',
  'rg',
  'email',
  'telefone',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'retiradoEm',
] as const;

/** O campo que **só** o locatário publica. */
const CHAVE_DA_CONFIRMACAO = 'emailConfirmadoEm';

/** O instante da confirmação usado pelo CT-731 — o do card do caso. */
const INSTANTE_DA_CONFIRMACAO = '2026-08-12T10:00:00.000Z';

/**
 * Um segredo de portador bem formado — 43 caracteres do alfabeto base64url.
 *
 * Os 43 são os dez dígitos, as 26 minúsculas, os dois caracteres que distinguem o base64url (`-` e
 * `_`) e cinco maiúsculas: o alfabeto inteiro aparece, de modo que um molde que esquecesse qualquer
 * uma das quatro classes reprovaria aqui. É a forma exata que `randomBytes(32).toString('base64url')`
 * produz — 32 bytes, sem enchimento.
 */
const SEGREDO_DO_PORTADOR = '0123456789abcdefghijklmnopqrstuvwxyz-_ABCDE';

/** O identificador do fiador do contrato — o único item de `fiadoresIds`. */
const FIADOR = '3c4d5e6f-7081-4920-a3b4-c5d6e7f80912';

/** O corpo canônico de `POST /v1/contratos` (tech spec §4.1.1), completo e sem campo opcional. */
const CORPO_DE_CONTRATO = {
  imovelId: '6f1b0f5a-2c3d-4e5f-8a9b-0c1d2e3f4a5b',
  locadorId: '1a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5061',
  locatarioId: '9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a',
  fiadoresIds: [FIADOR],
  dataInicioLocacao: '2026-01-31',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
} as const;

/**
 * O contrato como a API o devolve, recém-montado (tech spec §4.1.1).
 *
 * `dataFimLocacao` e `valorTotalContrato` vêm nulos porque são derivados **na ativação** — é o
 * estado em que o recurso nasce, e o que o `201` do exemplo publica.
 */
const CONTRATO_PUBLICADO = {
  codigo: 'CTR-2026-00001',
  status: 'RASCUNHO',
  imovelId: CORPO_DE_CONTRATO.imovelId,
  locadorId: CORPO_DE_CONTRATO.locadorId,
  locatarioId: CORPO_DE_CONTRATO.locatarioId,
  fiadores: [{ id: FIADOR, nome: 'Carlos Fiador' }],
  dataInicioLocacao: CORPO_DE_CONTRATO.dataInicioLocacao,
  prazoMeses: CORPO_DE_CONTRATO.prazoMeses,
  valorMensal: CORPO_DE_CONTRATO.valorMensal,
  diaVencimento: CORPO_DE_CONTRATO.diaVencimento,
  dataFimLocacao: null,
  valorTotalContrato: null,
  gerarCobrancasAutomaticamente: true,
  retiradoEm: null,
} as const;

/** O corpo canônico de `POST /v1/cobrancas` (tech spec §4.1.1), completo e sem campo opcional. */
const CORPO_DE_COBRANCA = {
  contratoCodigo: 'CTR-2026-00007',
  natureza: 'AGUA',
  referencia: 'Conta de água — 03/2026',
  competencia: '2026-03-01',
  dataVencimento: '2026-03-10',
  valorOriginal: 187.42,
} as const;

/**
 * O locatário da cobrança — **UUID**, e não código.
 *
 * A ADR-0017 dá a chave exposta pela existência de série declarada: contrato tem, logo `CTR-…`;
 * locatário não tem, logo UUID. As duas classes convivem no mesmo recurso de propósito.
 */
const LOCATARIO_DA_COBRANCA = '8f1c0000-0000-4000-8000-000000000007';

/**
 * A cobrança como a API a devolve, recém-lançada (tech spec §4.1.1).
 *
 * Os cinco anuláveis vêm nulos porque são o **desfecho**, e a cobrança nasce aberta; `status`,
 * `diasAtraso` e as três grandezas de mora vêm derivados, e é o estado que o `201` do exemplo
 * publica.
 */
const COBRANCA_PUBLICADA = {
  codigo: 'COB-2026-0000059',
  contratoCodigo: CORPO_DE_COBRANCA.contratoCodigo,
  locatarioId: LOCATARIO_DA_COBRANCA,
  natureza: CORPO_DE_COBRANCA.natureza,
  referencia: CORPO_DE_COBRANCA.referencia,
  competencia: CORPO_DE_COBRANCA.competencia,
  dataVencimento: CORPO_DE_COBRANCA.dataVencimento,
  valorOriginal: CORPO_DE_COBRANCA.valorOriginal,
  status: 'A_VENCER',
  diasAtraso: 0,
  valorMulta: 0,
  valorJuros: 0,
  valorTotal: CORPO_DE_COBRANCA.valorOriginal,
  pagoEm: null,
  valorPago: null,
  canceladoEm: null,
  multaPercentualAplicado: null,
  jurosPercentualAplicado: null,
} as const;

/**
 * O corpo canônico de `PUT /v1/automacao-de-cobranca` (tech spec §4.1.1), completo e sem opcional.
 *
 * Os **seis** campos vão declarados por extenso: nenhum deles é opcional, e um corpo que omitisse
 * qualquer um seria recusado antes de a varredura do CT-336/CT-337 medir o que ela existe para medir.
 * É também o corpo típico do CT-604 — o mesmo objeto alimenta a varredura e o controle positivo, e
 * não duas listas de campos livres para divergir.
 */
const CORPO_DA_POLITICA_DE_AVISO = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 2,
  janelaInicio: '09:00',
  janelaFim: '18:00',
  canal: 'EMAIL',
} as const;

/** Identificador de outra empresa — o valor que a metade comportamental do CT-337 tenta enfiar. */
const EMPRESA_ALHEIA = 'b0000000-0000-4000-8000-000000000002';

/** A chave inventada do CT-336. */
const CHAVE_EXTRA = 'campoInventado';

describe('CT-334 — a ENTRADA de imóvel aceita as duas situações que o usuário informa', () => {
  /**
   * Os dois valores estão escritos por extenso de propósito — o card do caso os fixa. A asserção
   * seguinte prende a lista literal ao que o pacote publica: se `SITUACOES_INFORMAVEIS` mudar, é
   * aqui que se descobre, e não numa rota três tasks adiante.
   */
  const ACEITOS = ['DISPONIVEL', 'INDISPONIVEL'] as const;

  it('a lista exercitada é exatamente a que o pacote declara informável', () => {
    expect([...SITUACOES_INFORMAVEIS]).toEqual([...ACEITOS]);
  });

  for (const situacao of ACEITOS) {
    it(`aprova ${situacao} e devolve o corpo verbatim`, () => {
      const corpo = { ...CORPO_DE_IMOVEL, statusLocacao: situacao };

      const resultado = esquemaDeImovelNovo.safeParse(corpo);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.statusLocacao).toBe(situacao);
      // Profundamente igual ao enviado: o esquema não acrescenta nem remove campo. É o que impede
      // um `.default()` ou um `.omit()` distraído de mudar o corpo por baixo do controlador.
      expect(resultado.data).toEqual(corpo);
    });
  }
});

describe('CT-335 — LOCADO é recusado na ENTRADA e aceito na SAÍDA', () => {
  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    { rotulo: 'o valor que só a ativação de contrato produz', valor: 'LOCADO' },
    { rotulo: 'a mesma situação em minúsculas', valor: 'disponivel' },
    { rotulo: 'a mesma situação em caixa mista', valor: 'Indisponivel' },
    { rotulo: 'uma situação que não existe no enum', valor: 'ALUGADO' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${valor}) nomeando o campo`, () => {
      const resultado = esquemaDeImovelNovo.safeParse({
        ...CORPO_DE_IMOVEL,
        statusLocacao: valor,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['statusLocacao']);
    });
  }

  it('a SAÍDA aprova LOCADO — a restrição é do esquema de entrada, não do enum', () => {
    const imovel = {
      id: '9f1c0000-0000-4000-8000-000000000009',
      conjuntoId: CORPO_DE_IMOVEL.conjuntoId,
      nomeImovel: CORPO_DE_IMOVEL.nomeImovel,
      identificadorMunicipal: CORPO_DE_IMOVEL.identificadorMunicipal,
      tipoImovel: CORPO_DE_IMOVEL.tipoImovel,
      logradouro: CORPO_DE_IMOVEL.logradouro,
      numero: CORPO_DE_IMOVEL.numero,
      complemento: CORPO_DE_IMOVEL.complemento,
      bairro: CORPO_DE_IMOVEL.bairro,
      cidade: CORPO_DE_IMOVEL.cidade,
      estado: CORPO_DE_IMOVEL.estado,
      cep: CORPO_DE_IMOVEL.cep,
      statusLocacao: 'LOCADO',
      observacoes: CORPO_DE_IMOVEL.observacoes,
      comodos: [
        {
          id: '9f1c0000-0000-4000-8000-00000000000a',
          nomeComodo: 'Sala',
          metragem: 25.5,
          posicao: 1,
          observacoes: null,
        },
      ],
      metragemTotal: 25.5,
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este corpo que descrevia o
      // imóvel **antes** da T9. `esquemaDoImovel` ganhou `contratoVigente` por decisão declarada
      // (ADR-0016 — um esquema só de imóvel), e o campo é preenchido **de propósito** aqui: o eixo
      // deste caso é o `LOCADO` da saída, e `LOCADO` é justamente o estado que a ativação de contrato
      // produz. Um `null` compilaria e passaria, e deixaria a forma nova sem exercício algum. Nenhuma
      // asserção foi alterada, afrouxada ou removida.
      contratoVigente: {
        codigo: 'CTR-2026-00001',
        locatario: { id: '9f1c0000-0000-4000-8000-00000000000b', nome: 'Bruno Locatário' },
      },
      retiradoEm: null,
    };

    const resultado = esquemaDoImovel.safeParse(imovel);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.statusLocacao).toBe('LOCADO');
    // E o par que a ADR-0017 impõe atravessa intacto: o código legível do contrato (série declarada)
    // e o UUID do locatário (sem série). Sem esta linha, o campo novo entraria no corpo sem que nada
    // afirmasse o que ele carrega.
    expect(resultado.data?.contratoVigente).toEqual(imovel.contratoVigente);
  });
});

/**
 * Um esquema de entrada sob teste, com o corpo válido que o exercita.
 *
 * O `rotulo` é o nome exportado — é ele que aparece na mensagem de falha e diz QUAL esquema violou.
 */
interface EntradaSobTeste {
  readonly rotulo: string;
  readonly esquema: z.ZodObject;
  readonly corpoValido: Record<string, unknown>;
}

/**
 * Todo esquema de ENTRADA de entidade nasce com este prefixo — `esquemaDeConjuntoNovo`,
 * `esquemaDeImovelNovo`, `esquemaDeComodoNovo`, `esquemaDePessoaNova`. Os de SAÍDA usam
 * `esquemaDo`/`esquemaDa`, e por isso não caem aqui.
 */
const PREFIXO_DE_ENTRADA_DE_ENTIDADE = 'esquemaDe';

/**
 * As entradas cujo nome **não** começa pelo prefixo de entidade: as três janelas de listagem e o
 * corpo da rota de situação de locação.
 *
 * SUT_IS_CORRECT_BECAUSE: a constante chamava-se `NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO` e o nome descrevia
 * o conjunto de ontem, não o critério. O critério sempre foi *"esquema de entrada que escaparia às
 * varreduras por não começar com `esquemaDe`"* — é o que os parágrafos abaixo já diziam —, e a T10
 * publicou o primeiro que não é janela: `esquemaDaSituacaoDeLocacao`. Manter o nome antigo faria a
 * lista parecer fechada em listagens e convidaria a próxima entrada fora do prefixo a ficar de fora.
 * **Nenhum alvo saiu**, e as duas varreduras alcançam estritamente mais do que antes.
 *
 * SUT_IS_CORRECT_BECAUSE: era uma constante de nome único, e a T8 publicou um segundo esquema de
 * entrada fora do prefixo de entidade — `esquemaDaJanelaComCirculacao`, a promoção da extensão
 * `incluirRetirados` que vivia copiada em dois controladores (débito D7). Com o nome único, ele
 * **escaparia** às duas varreduras, e as afirmações que elas fazem — *todo* esquema de entrada é
 * `strictObject`, `empresaId` não é declarado em *nenhum* — passariam a ser verdadeiras por
 * omissão. Nenhum alvo sai daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 publicou um terceiro esquema de entrada fora do prefixo de entidade
 * — `esquemaDaJanelaDaCarteira`, a janela de `/v1/conjuntos` estendida com `expandir`, que a
 * ADR-0016 obriga a nascer no esquema em vez de numa conferência escrita no controlador. Pelo mesmo
 * motivo do parágrafo acima, com o nome único ele **escaparia** às duas varreduras. Nenhum alvo sai
 * daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da fatia `contratos-de-locacao` publicou `esquemaDaSituacaoDeLocacao`
 * — o corpo de um campo só de `POST /v1/imoveis/:id/situacao-de-locacao`. Pelo mesmo motivo dos
 * parágrafos acima ele escaparia às duas varreduras, e é justamente o esquema em que "`empresaId`
 * não é declarado" e "o corpo é fechado" mais importam: ele é a única porta de requisição que escreve
 * a situação de locação. Nenhum alvo sai daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T2 da fatia `cobranca-e-mora` publicou **dois** esquemas de entrada fora
 * do prefixo de entidade — `esquemaDoPagamentoDeCobranca`, o corpo do ato que liquida a cobrança, e
 * `esquemaDaJanelaDeCobrancas`, a janela da carteira estendida com os três filtros. Pelo mesmo motivo
 * dos parágrafos acima, sem esta lista os dois escapariam às duas varreduras — e o primeiro é o corpo
 * pelo qual multa e juros seriam escritos pelo cliente se o esquema fosse aberto. Nenhum alvo sai
 * daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia publicou `esquemaDaConfiguracaoDeMoraNova` — o corpo do
 * `PUT` que define a política de multa e juros da empresa. Pelo mesmo motivo dos parágrafos acima ele
 * escaparia às duas varreduras, por começar com `esquemaDa` e não com `esquemaDe`; e ele é
 * **exatamente** o esquema em que as duas afirmações mais importam, porque é a única porta de
 * requisição que escreve os percentuais que a carteira inteira cobra — um corpo aberto aceitaria
 * `empresaId` e escreveria a política de outra empresa. Nenhum alvo sai daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T2 da fatia `regua-de-cobranca` publicou `esquemaDaPoliticaDeAvisoNova` —
 * o corpo do `PUT` que define a política de aviso da empresa. Pelo mesmo motivo dos parágrafos acima
 * ele escaparia às duas varreduras, por começar com `esquemaDa` e não com `esquemaDe`; e ele é o corpo
 * pelo qual a régua inteira é ligada, de modo que um corpo aberto aceitaria `empresaId` e ligaria a
 * régua de outra empresa. Nenhum alvo sai daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T2 da sub-fatia `documentos-e-confirmacao` publicou
 * `esquemaDaApresentacaoDoPortador` — o corpo pelo qual o portador de confirmação é apresentado.
 * Pelo mesmo motivo dos parágrafos acima ele escaparia às duas varreduras, por começar com
 * `esquemaDa` e não com `esquemaDe`; e ele é o esquema em que as duas afirmações mais importam de
 * todo o pacote, porque é o corpo da **única rota sem sessão** do produto (ADR-0027): um corpo aberto
 * ali aceitaria `empresaId` vindo do mundo, e o contexto de tenant tem de sair do registro que o
 * portador resolve, nunca do pedido. Nenhum alvo sai daqui; o conjunto só cresce.
 */
const NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO = [
  'esquemaDaApresentacaoDoPortador',
  'esquemaDaConfiguracaoDeMoraNova',
  'esquemaDaJanela',
  'esquemaDaJanelaComCirculacao',
  'esquemaDaJanelaDaCarteira',
  'esquemaDaJanelaDeCobrancas',
  'esquemaDaPoliticaDeAvisoNova',
  'esquemaDaSituacaoDeLocacao',
  'esquemaDoPagamentoDeCobranca',
] as const;

/**
 * Quantos esquemas de entrada o pacote publica hoje — quatro entidades mais as duas janelas.
 *
 * O valor é **exato** de propósito: sem ele, "nenhum esquema violou" seria indistinguível de
 * "nenhum esquema foi olhado", que é a forma clássica de uma varredura passar provando nada.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 5 para 6 porque a T8 publicou `esquemaDaJanelaComCirculacao`
 * por decisão declarada (fonte única do contrato, ADR-0016 — ver o débito D7). A âncora de
 * igualdade **sobe**, nunca afrouxa: continua sendo comparação exata, e um esquema de entrada que
 * suma daqui segue reprovando.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 6 para 7 porque a T10 publicou `esquemaDaJanelaDaCarteira` pela
 * mesma decisão — o parâmetro `expandir` da carteira nasce no esquema, e não numa conferência
 * escrita no controlador (ADR-0016). A âncora segue exata, e nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 7 para 8 porque a T2 da fatia `contratos-de-locacao` publicou
 * `esquemaDeContratoNovo` — o corpo da montagem do contrato, que nasce nesta fonte única pela mesma
 * ADR-0016. Ele entra nas duas varreduras **sozinho**, pelo prefixo de entrada de entidade; o que
 * esta linha faz é subir a âncora para que a entrada nova seja contada, e não tolerada. A âncora
 * segue exata, e nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 8 para 10 porque a T10 da mesma fatia publicou **dois** esquemas
 * de entrada — `esquemaDeImovelAlterado`, o corpo do `PUT` de imóvel derivado por `omit` do da
 * criação, e `esquemaDaSituacaoDeLocacao`, o corpo da rota que passa a ser a única porta de
 * requisição para a situação de locação. O primeiro entra pelo prefixo de entidade; o segundo, pela
 * lista acima. A âncora segue exata, e nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 10 para 13 porque a T2 da fatia `cobranca-e-mora` publicou **três**
 * esquemas de entrada — `esquemaDeCobrancaNova` (o lançamento avulso, que entra sozinho pelo prefixo
 * de entidade), `esquemaDoPagamentoDeCobranca` e `esquemaDaJanelaDeCobrancas` (os dois pela lista
 * acima). O literal é o que impede *"nenhum esquema violou"* de ser indistinguível de *"nenhum
 * esquema foi olhado"*: trocá-lo por `ESQUEMAS_DE_ENTRADA.length` seria a asserção tautológica que
 * esta linha existe para evitar. A âncora **sobe** e segue exata; nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 13 para 14 porque a T6 da mesma fatia publicou
 * `esquemaDaConfiguracaoDeMoraNova` — o corpo do `PUT` da política de multa e juros, que nasce nesta
 * fonte única pela mesma ADR-0016. Ele entra pela lista de nomes fora do prefixo, logo acima. Vale
 * aqui, palavra por palavra, o parágrafo anterior: o literal é o que impede *"nenhum esquema
 * violou"* de ser indistinguível de *"nenhum esquema foi olhado"*, a âncora **sobe** e segue exata, e
 * nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 14 para 15 porque a T2 da fatia `regua-de-cobranca` publicou
 * `esquemaDaPoliticaDeAvisoNova` — o corpo do `PUT` da política de aviso, que nasce nesta fonte única
 * pela mesma ADR-0016. Ele entra pela lista de nomes fora do prefixo, logo acima. Vale aqui, palavra
 * por palavra, o parágrafo anterior: o literal é o que impede *"nenhum esquema violou"* de ser
 * indistinguível de *"nenhum esquema foi olhado"*, a âncora **sobe** e segue exata, e nenhum alvo
 * saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 15 para 16 porque a T2 da sub-fatia `documentos-e-confirmacao`
 * publicou `esquemaDaApresentacaoDoPortador` — o corpo da apresentação do portador, que nasce nesta
 * fonte única pela mesma ADR-0016. Ele entra pela lista de nomes fora do prefixo, logo acima. Vale
 * aqui, palavra por palavra, o parágrafo anterior: o literal é o que impede *"nenhum esquema
 * violou"* de ser indistinguível de *"nenhum esquema foi olhado"*, a âncora **sobe** e segue exata, e
 * nenhum alvo saiu.
 */
const QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA = 16;

/** Um corpo válido por esquema de entrada, indexado pelo nome exportado. */
const CORPOS_VALIDOS = new Map<string, Record<string, unknown>>([
  // O segredo vai declarado por extenso porque é o único campo deste esquema: um corpo que o
  // omitisse seria recusado antes de a varredura medir o que ela existe para medir.
  ['esquemaDaApresentacaoDoPortador', { segredo: SEGREDO_DO_PORTADOR }],
  // Os dois percentuais vão declarados **por extenso**, e com valores distintos entre si: são os
  // únicos campos que este esquema tem, nenhum deles é opcional, e um corpo que omitisse qualquer um
  // seria recusado antes de a varredura medir o que ela existe para medir. Valores diferentes em cada
  // campo é o que impede uma troca acidental entre eles de passar despercebida.
  ['esquemaDaConfiguracaoDeMoraNova', { multaPercentual: 2, jurosPercentual: 1 }],
  // Os seis campos vêm do corpo canônico declarado acima, e não de uma segunda lista: é o mesmo
  // objeto que o CT-604 exercita como controle positivo.
  ['esquemaDaPoliticaDeAvisoNova', { ...CORPO_DA_POLITICA_DE_AVISO }],
  ['esquemaDeConjuntoNovo', { nome: 'Edifício Aurora' }],
  ['esquemaDeImovelNovo', { ...CORPO_DE_IMOVEL, statusLocacao: 'DISPONIVEL' }],
  // O corpo da alteração é o da criação **sem** `statusLocacao`, que é exatamente o que o `omit`
  // produz. Ele é o mesmo objeto que alimenta a linha acima, sem o acréscimo — e não uma segunda
  // lista de campos, que ficaria livre para divergir dela.
  ['esquemaDeImovelAlterado', { ...CORPO_DE_IMOVEL }],
  ['esquemaDaSituacaoDeLocacao', { statusLocacao: 'INDISPONIVEL' }],
  ['esquemaDeComodoNovo', { nomeComodo: 'Sala', metragem: 25.5, observacoes: null }],
  ['esquemaDePessoaNova', { ...CORPO_DE_PESSOA }],
  ['esquemaDeContratoNovo', { ...CORPO_DE_CONTRATO }],
  ['esquemaDaJanela', { limite: 10, deslocamento: 0 }],
  // O corpo declara `incluirRetirados` **por extenso**, e não o omite deixando o padrão agir: é o
  // parâmetro que este esquema acrescenta, e um corpo que não o exercitasse deixaria a varredura
  // provando apenas o que a janela-base já prova.
  ['esquemaDaJanelaComCirculacao', { limite: 10, deslocamento: 0, incluirRetirados: 'false' }],
  // O corpo declara `expandir` **por extenso**, pela mesma razão da linha acima: é o parâmetro que
  // este esquema acrescenta, e um corpo que o omitisse deixaria a varredura provando apenas o que a
  // janela com circulação já prova.
  [
    'esquemaDaJanelaDaCarteira',
    { limite: 10, deslocamento: 0, incluirRetirados: 'false', expandir: 'imoveis' },
  ],
  ['esquemaDeCobrancaNova', { ...CORPO_DE_COBRANCA }],
  ['esquemaDoPagamentoDeCobranca', { pagoEm: '2026-03-25', valorPago: 191.3 }],
  // Os três filtros vão declarados **por extenso**, pela mesma razão das duas linhas acima: são o
  // que este esquema acrescenta à janela comum, e um corpo que os omitisse deixaria a varredura
  // provando apenas o que `esquemaDaJanela` já prova.
  [
    'esquemaDaJanelaDeCobrancas',
    {
      limite: 10,
      deslocamento: 0,
      contrato: CORPO_DE_COBRANCA.contratoCodigo,
      status: 'A_VENCER',
      natureza: 'AGUA',
    },
  ],
]);

/**
 * A tabela dos esquemas de entrada, descoberta a partir dos símbolos EXPORTADOS pelo pacote.
 *
 * Não é uma lista redigitada: um esquema de entrada novo entra sozinho nas varreduras do CT-336 e
 * do CT-337. Se ele chegar sem corpo válido declarado acima, a construção **levanta** — a suíte não
 * o examina em silêncio nem o pula.
 */
const ESQUEMAS_DE_ENTRADA: readonly EntradaSobTeste[] = (
  Object.entries(contratos) as readonly (readonly [string, unknown])[]
)
  .filter(
    (entrada): entrada is readonly [string, z.ZodObject] =>
      (entrada[0].startsWith(PREFIXO_DE_ENTRADA_DE_ENTIDADE) ||
        NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO.includes(
          entrada[0] as (typeof NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO)[number],
        )) &&
      entrada[1] instanceof z.ZodObject,
  )
  .map(([rotulo, esquema]) => {
    const corpoValido = CORPOS_VALIDOS.get(rotulo);
    if (corpoValido === undefined) {
      throw new Error(
        `o esquema de entrada '${rotulo}' não tem corpo válido declarado em CORPOS_VALIDOS`,
      );
    }
    return { rotulo, esquema, corpoValido };
  });

/**
 * A precondição COMPARTILHADA pelo CT-336 e pelo CT-337 — e por isso afirmada uma vez só.
 *
 * Os dois casos varrem a MESMA tabela, montada uma vez no escopo do módulo. Duas asserções idênticas
 * sobre a mesma constante não acrescentam poder de detecção: a segunda só pode falhar se a primeira
 * já tiver falhado. Ela é a guarda de ambos — sem ela, *"nenhum esquema violou"* seria
 * indistinguível de *"nenhum esquema foi olhado"* nos dois casos de uma vez.
 *
 * Rastreabilidade preservada: `CA-14, CA-16 → CT-336, CT-337`.
 */
describe('CT-336 / CT-337 — a tabela de esquemas de entrada é a superfície inteira', () => {
  it(`examina exatamente ${QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA} esquemas de entrada`, () => {
    expect(ESQUEMAS_DE_ENTRADA).toHaveLength(QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA);
  });
});

describe('CT-336 — todo esquema de entrada é strictObject', () => {
  for (const { rotulo, esquema, corpoValido } of ESQUEMAS_DE_ENTRADA) {
    it(`${rotulo} aprova o corpo válido e recusa a chave desconhecida`, () => {
      expect(esquema.safeParse(corpoValido).success).toBe(true);

      const comChaveExtra = esquema.safeParse({ ...corpoValido, [CHAVE_EXTRA]: 'x' });

      expect(comChaveExtra.success).toBe(false);
      expect(comChaveExtra.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(comChaveExtra.error?.issues[0]).toMatchObject({ keys: [CHAVE_EXTRA] });
    });
  }
});

describe('CT-337 — empresaId não é declarado em nenhum esquema de entrada', () => {
  for (const { rotulo, esquema, corpoValido } of ESQUEMAS_DE_ENTRADA) {
    it(`${rotulo} não declara empresaId e recusa quem o envia`, () => {
      // Metade declarativa: o campo não existe no contrato. Sozinha, ela não distingue
      // "não declarado" de "declarado e opcional".
      expect(Object.keys(esquema.shape)).not.toContain('empresaId');

      // Metade comportamental: enviá-lo recusa nomeando a chave. Sozinha, ela não distingue
      // "recusado por chave desconhecida" de "recusado por tipo".
      const comEmpresa = esquema.safeParse({ ...corpoValido, empresaId: EMPRESA_ALHEIA });

      expect(comEmpresa.success).toBe(false);
      expect(comEmpresa.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(comEmpresa.error?.issues[0]).toMatchObject({ keys: ['empresaId'] });
    });
  }
});

describe('CT-338 — a janela RECUSA limite acima do teto, em vez de truncar', () => {
  /**
   * A política da janela, escrita **por extenso** — e a única coisa deste caso que é literal.
   *
   * As janelas exercitadas abaixo derivam da constante exportada (é o que o card exige, e é o que
   * pega o teto alargado **no esquema**: `.max(MAIOR_PAGINA * 5)` deixaria `MAIOR_PAGINA + 1`
   * passar). Só isso, porém, não pega o teto alargado **na própria constante**: as duas pontas
   * andariam juntas e o caso seguiria verde — mutante medido, `MAIOR_PAGINA = 500` sobrevivia às
   * trinta asserções. Estes dois números são o que torna o teto uma **decisão**, e não um valor que
   * o teste descobre a cada rodada. Mesmo desenho de `TETO_DECLARADO_DA_PAGINA` no `CT-226 (b)` da
   * F1, e pela mesma razão escrita lá.
   */
  const TETO_DECLARADO_DA_PAGINA = 200;
  const PADRAO_DECLARADO_DA_PAGINA = 50;

  it('a política da janela está amarrada ao que o pacote publica', () => {
    expect([PAGINA_PADRAO, MAIOR_PAGINA]).toEqual([
      PADRAO_DECLARADO_DA_PAGINA,
      TETO_DECLARADO_DA_PAGINA,
    ]);
  });

  const ACEITAS: readonly {
    readonly rotulo: string;
    readonly janela: Record<string, unknown>;
    readonly limite: number;
    readonly deslocamento: number;
  }[] = [
    {
      rotulo: 'a menor janela',
      janela: { limite: 1, deslocamento: 0 },
      limite: 1,
      deslocamento: 0,
    },
    {
      rotulo: 'exatamente o teto',
      janela: { limite: MAIOR_PAGINA, deslocamento: 0 },
      limite: MAIOR_PAGINA,
      deslocamento: 0,
    },
    {
      rotulo: 'limite ausente',
      janela: { deslocamento: 7 },
      limite: PAGINA_PADRAO,
      deslocamento: 7,
    },
    { rotulo: 'janela vazia', janela: {}, limite: PAGINA_PADRAO, deslocamento: 0 },
  ];

  const RECUSADAS: readonly {
    readonly rotulo: string;
    readonly janela: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    { rotulo: 'um a mais que o teto', janela: { limite: MAIOR_PAGINA + 1 }, campo: 'limite' },
    { rotulo: 'limite zero', janela: { limite: 0 }, campo: 'limite' },
    { rotulo: 'limite fracionário', janela: { limite: 1.5 }, campo: 'limite' },
    { rotulo: 'deslocamento negativo', janela: { deslocamento: -1 }, campo: 'deslocamento' },
  ];

  for (const { rotulo, janela, limite, deslocamento } of ACEITAS) {
    it(`aprova ${rotulo} devolvendo o valor verbatim`, () => {
      const resultado = esquemaDaJanela.safeParse(janela);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.limite).toBe(limite);
      expect(resultado.data?.deslocamento).toBe(deslocamento);
    });
  }

  for (const { rotulo, janela, campo } of RECUSADAS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDaJanela.safeParse(janela);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-340 — a metragem espelha a precisão E a escala de numeric(10,2)', () => {
  /**
   * O teto da metragem, escrito **por extenso** — pela mesma razão do CT-338, e com um agravante.
   *
   * Aqui o número não é política de produto: é a **capacidade** de `numeric(10,2)` (§7.2), que são
   * dez dígitos com dois decimais. Escrevê-lo aqui é o que prende o contrato à coluna: se alguém
   * alargar `MAIOR_METRAGEM` sem alargar a coluna, este caso reprova — e é exatamente a divergência
   * que reabriria o defeito, porque o contrato voltaria a aprovar valor que o `INSERT` recusa.
   * Derivar o literal da constante deixaria as duas pontas andando juntas e o caso verde.
   */
  const TETO_DECLARADO_DA_METRAGEM = 99_999_999.99;

  /**
   * A escala declarada — o `2` de `numeric(10,2)`, pela mesma razão do teto acima.
   *
   * `numeric(10,2)` tem duas metades, e provar só o teto deixaria a outra aberta: `25.555` cabia na
   * coluna e **mudava de valor** ao entrar nela, voltando ao cliente como `25.56`.
   */
  const ESCALA_DECLARADA_DA_METRAGEM = 0.01;

  it('o teto e a escala do contrato são a precisão e a escala da coluna numeric(10,2)', () => {
    expect([MAIOR_METRAGEM, ESCALA_DA_METRAGEM]).toEqual([
      TETO_DECLARADO_DA_METRAGEM,
      ESCALA_DECLARADA_DA_METRAGEM,
    ]);
  });

  const ACEITAS: readonly {
    readonly rotulo: string;
    readonly corpo: Record<string, unknown>;
    readonly metragem: number;
  }[] = [
    { rotulo: 'o piso', corpo: { nomeComodo: 'Sala', metragem: 0 }, metragem: 0 },
    { rotulo: 'uma metragem comum', corpo: { nomeComodo: 'Sala', metragem: 25.5 }, metragem: 25.5 },
    {
      rotulo: 'exatamente a escala da coluna',
      corpo: { nomeComodo: 'Sala', metragem: 25.55 },
      metragem: 25.55,
    },
    // A dízima do binário é o risco óbvio de `multipleOf`: `0.29` e `8.11` não são exatos em ponto
    // flutuante, e um resto ingênuo os recusaria. Sem estas duas linhas, a restrição de escala
    // passaria a reprovar metragem legítima e ninguém saberia até a primeira rota.
    {
      rotulo: 'uma dízima do binário',
      corpo: { nomeComodo: 'Sala', metragem: 0.29 },
      metragem: 0.29,
    },
    {
      rotulo: 'outra dízima do binário',
      corpo: { nomeComodo: 'Sala', metragem: 8.11 },
      metragem: 8.11,
    },
    {
      rotulo: 'exatamente o teto',
      corpo: { nomeComodo: 'Sala', metragem: MAIOR_METRAGEM },
      metragem: MAIOR_METRAGEM,
    },
    { rotulo: 'metragem ausente (RN-02)', corpo: { nomeComodo: 'Sala' }, metragem: 0 },
  ];

  const RECUSADAS: readonly { readonly rotulo: string; readonly metragem: unknown }[] = [
    { rotulo: 'um a mais que o teto', metragem: MAIOR_METRAGEM + 1 },
    { rotulo: 'a ordem de grandeza que o gate mediu', metragem: 1e30 },
    { rotulo: 'abaixo do piso', metragem: -0.01 },
    // Uma casa decimal além da escala. É o par de `25.55` acima: só o lado aceito deixaria verde uma
    // escala mais fina; só o recusado, uma escala mais grossa.
    { rotulo: 'uma casa decimal além da escala', metragem: 25.555 },
    { rotulo: 'muito abaixo da escala', metragem: 0.001 },
    { rotulo: 'nulo explícito', metragem: null },
  ];

  for (const { rotulo, corpo, metragem } of ACEITAS) {
    it(`aprova ${rotulo} devolvendo o valor verbatim`, () => {
      const resultado = esquemaDeComodoNovo.safeParse(corpo);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.metragem).toBe(metragem);
    });
  }

  for (const { rotulo, metragem } of RECUSADAS) {
    it(`recusa ${rotulo} nomeando metragem`, () => {
      const resultado = esquemaDeComodoNovo.safeParse({ nomeComodo: 'Sala', metragem });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['metragem']);
    });
  }
});

describe('CT-341 — o endereço é canonizado num ponto único, igual nas duas entidades', () => {
  /**
   * As duas entidades que compõem `camposDeEndereco()`. A varredura é sobre as DUAS de propósito:
   * o ponto único só é ponto único se as duas o consumirem, e canonizar numa e esquecer na outra é
   * exatamente a divergência que a composição existe para impedir.
   */
  const PORTADORAS_DE_ENDERECO: readonly {
    readonly rotulo: string;
    readonly esquema: z.ZodObject;
    readonly corpoValido: Record<string, unknown>;
  }[] = [
    {
      rotulo: 'esquemaDeImovelNovo',
      esquema: esquemaDeImovelNovo,
      corpoValido: { ...CORPO_DE_IMOVEL, statusLocacao: 'DISPONIVEL' },
    },
    { rotulo: 'esquemaDePessoaNova', esquema: esquemaDePessoaNova, corpoValido: CORPO_DE_PESSOA },
  ];

  for (const { rotulo, esquema, corpoValido } of PORTADORAS_DE_ENDERECO) {
    it(`${rotulo} devolve estado em MAIÚSCULAS e cep sem máscara`, () => {
      const resultado = esquema.safeParse({ ...corpoValido, estado: ' sp ', cep: '01001-000' });

      expect(resultado.success).toBe(true);
      // Valor exato, não "está definido": é a forma canônica que o banco guarda e que toda
      // comparação de igualdade a jusante vai usar.
      expect(resultado.data).toMatchObject({ estado: 'SP', cep: '01001000' });
    });

    it(`${rotulo} recusa estado fora de duas letras e cep que não tem oito dígitos`, () => {
      const estadoLongo = esquema.safeParse({ ...corpoValido, estado: 'sao' });

      expect(estadoLongo.success).toBe(false);
      expect(estadoLongo.error?.issues[0]?.path).toEqual(['estado']);

      // Sete dígitos: a máscara sai, e o que sobra continua não sendo um CEP. Sem esta metade,
      // "remove a máscara" seria indistinguível de "aceita qualquer coisa".
      const cepCurto = esquema.safeParse({ ...corpoValido, cep: '0100-100' });

      expect(cepCurto.success).toBe(false);
      expect(cepCurto.error?.issues[0]?.path).toEqual(['cep']);
    });
  }
});

describe('CT-424 — o estado do contrato é união fechada de exatamente quatro valores', () => {
  /**
   * Os quatro estados escritos **por extenso**, e na ordem — o card do caso os fixa.
   *
   * A ordem é conteúdo: a T3 deriva `negocio.status_contrato` deste arranjo, e um enum do PostgreSQL
   * guarda a ordem dos rótulos. Derivar esta lista da constante exportada deixaria as duas pontas
   * andando juntas e o caso verde num quinto valor reintroduzido.
   */
  const ESTADOS_DECLARADOS = ['RASCUNHO', 'ATIVO', 'CANCELADO', 'ENCERRADO'] as const;

  it('a união publicada tem exatamente quatro valores, na ordem declarada', () => {
    expect([...ESTADOS_DO_CONTRATO]).toEqual([...ESTADOS_DECLARADOS]);
  });

  for (const estado of ESTADOS_DECLARADOS) {
    it(`aprova ${estado} e devolve o recurso verbatim`, () => {
      const contrato = { ...CONTRATO_PUBLICADO, status: estado };

      const resultado = esquemaDoContrato.safeParse(contrato);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.status).toBe(estado);
      // Profundamente igual ao enviado: o esquema não acrescenta nem remove campo.
      expect(resultado.data).toEqual(contrato);
    });
  }

  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    { rotulo: 'o quinto valor do sistema antigo, podado', valor: 'RESCINDIDO' },
    { rotulo: 'um valor arbitrário', valor: 'QUALQUER_OUTRO' },
    { rotulo: 'o mesmo estado em minúsculas', valor: 'ativo' },
    { rotulo: 'a situação de locação do imóvel, que é outro enum', valor: 'LOCADO' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${valor}) nomeando o campo status`, () => {
      const resultado = esquemaDoContrato.safeParse({ ...CONTRATO_PUBLICADO, status: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['status']);
    });
  }

  it('o recurso publicado NÃO expõe o UUID interno (ADR-0017)', () => {
    // Metade declarativa: o campo não existe no contrato. Sozinha, ela não distingue
    // "não declarado" de "declarado e ignorado na leitura".
    expect(Object.keys(esquemaDoContrato.shape)).not.toContain('id');

    // Metade comportamental: um `id` que chegue de fora não atravessa o esquema. O corpo publicado
    // é exatamente o declarado, e a chave exposta é o `codigo`.
    const comUuidInterno = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      id: '5d6e7f80-9102-4a3b-8c4d-5e6f70819203',
    });

    expect(comUuidInterno.success).toBe(true);
    expect(comUuidInterno.data).toEqual(CONTRATO_PUBLICADO);
  });
});

describe('CT-424 (b) — o corpo da montagem é fechado, e cada campo tem a sua fronteira', () => {
  /**
   * Os CINCO campos que o servidor decide (§6.1) — nenhum deles é chave do corpo.
   *
   * `status` é o que a ADR-0019 tira do recurso; `codigo` vem da série; `dataFimLocacao` e
   * `valorTotalContrato` são derivados na ativação; `empresaId` sai da sessão. A lista é escrita por
   * extenso porque é ela que a RN-03 elimina como segunda fonte de estado.
   */
  // Os quatro campos que o SERVIDOR decide e que a montagem não pode enviar. A RN-03 nomeia CINCO:
  // o quinto é `empresaId`, e ele **não** está aqui de propósito — a varredura do CT-337 já gera
  // exatamente este caso para `esquemaDeContratoNovo` (mesmo alvo, mesmo valor, as mesmas duas
  // asserções), e é estritamente mais forte, porque acrescenta a metade declarativa
  // `shape` não contém `empresaId`. Repeti-lo aqui não acrescentava poder de detecção.
  //
  // A cobertura não depende de lembrar: `ESQUEMAS_DE_ENTRADA` é descoberta a partir dos símbolos
  // exportados, e `esquemaDeContratoNovo` entra nela pelo prefixo `esquemaDe`, como todo esquema de
  // entrada futuro. Medido: um esquema que passasse a declarar `empresaId` reprova no CT-337.
  const DECIDIDOS_PELO_SERVIDOR: readonly { readonly chave: string; readonly valor: unknown }[] = [
    { chave: 'status', valor: 'ATIVO' },
    { chave: 'codigo', valor: 'CTR-2026-00002' },
    { chave: 'dataFimLocacao', valor: '2027-01-30' },
    { chave: 'valorTotalContrato', valor: 30_000 },
  ];

  it('o corpo aprova a montagem completa, verbatim', () => {
    const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CORPO_DE_CONTRATO });
  });

  for (const { chave, valor } of DECIDIDOS_PELO_SERVIDOR) {
    it(`recusa ${chave} como chave desconhecida`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, [chave]: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }

  it('aplica o padrão true a gerarCobrancasAutomaticamente quando ele é omitido', () => {
    const { gerarCobrancasAutomaticamente: _omitido, ...semOPadrao } = CORPO_DE_CONTRATO;

    const resultado = esquemaDeContratoNovo.safeParse(semOPadrao);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.gerarCobrancasAutomaticamente).toBe(true);
  });

  it('aceita a coleção de fiadores VAZIA — zero ou mais, sem teto (RD-06)', () => {
    const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, fiadoresIds: [] });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.fiadoresIds).toEqual([]);
  });

  it('recusa o mesmo fiador duas vezes, inclusive em grafias de caixa diferentes', () => {
    // A conferência corre sobre os valores já CANONIZADOS — é a mesma repetição que a restrição
    // `unique (contrato_id, fiador_id)` enxergaria, e recusá-la aqui é o que dá nome ao campo.
    const repetido = esquemaDeContratoNovo.safeParse({
      ...CORPO_DE_CONTRATO,
      fiadoresIds: [FIADOR, FIADOR.toUpperCase()],
    });

    expect(repetido.success).toBe(false);
    expect(repetido.error?.issues[0]?.path).toEqual(['fiadoresIds']);
  });

  it('canoniza os identificadores em minúsculas, no corpo inteiro', () => {
    const resultado = esquemaDeContratoNovo.safeParse({
      ...CORPO_DE_CONTRATO,
      imovelId: CORPO_DE_CONTRATO.imovelId.toUpperCase(),
      fiadoresIds: [FIADOR.toUpperCase()],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toMatchObject({
      imovelId: CORPO_DE_CONTRATO.imovelId,
      fiadoresIds: [FIADOR],
    });
  });

  const CAMPOS_RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'dia de vencimento acima de 28 (RD-08)',
      remendo: { diaVencimento: 29 },
      campo: 'diaVencimento',
    },
    { rotulo: 'dia de vencimento zero', remendo: { diaVencimento: 0 }, campo: 'diaVencimento' },
    {
      rotulo: 'data de início que o calendário não tem',
      remendo: { dataInicioLocacao: '2026-02-30' },
      campo: 'dataInicioLocacao',
    },
    {
      rotulo: 'data de início com hora — a coluna é date, não timestamp',
      remendo: { dataInicioLocacao: '2026-01-31T00:00:00Z' },
      campo: 'dataInicioLocacao',
    },
    {
      rotulo: 'identificador que não é UUID',
      remendo: { locatarioId: 'nao-e-uuid' },
      campo: 'locatarioId',
    },
  ];

  for (const { rotulo, remendo, campo } of CAMPOS_RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  const DIAS_DE_VENCIMENTO_ACEITOS = [1, 28] as const;

  for (const dia of DIAS_DE_VENCIMENTO_ACEITOS) {
    it(`aprova o dia de vencimento ${dia}, que é fronteira`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({
        ...CORPO_DE_CONTRATO,
        diaVencimento: dia,
      });

      expect(resultado.success).toBe(true);
      expect(resultado.data?.diaVencimento).toBe(dia);
    });
  }
});

describe('CT-428 — o código é canonizado num ponto único, e a largura é de cinco dígitos', () => {
  /**
   * O formato declarado, escrito **por extenso** — pela mesma razão do CT-338 e do CT-340.
   *
   * É a decisão que o marcador `DECISÃO FECHADA` de `contrato.ts` protege, e o valor foi MEDIDO no
   * sistema antigo (`autoname` = `CTR-.YYYY.-.#####`). Derivá-lo das constantes deixaria as duas
   * pontas andando juntas: uma largura "corrigida" para quatro — como o `CLAUDE.md` e o
   * `plano-execucao.md` escrevem — passaria pela suíte inteira sem uma recusa sequer.
   */
  const PREFIXO_DECLARADO = 'CTR';
  const LARGURA_DECLARADA_DO_SEQUENCIAL = 5;

  it('o formato publicado é exatamente o que as constantes declaram', () => {
    expect([PREFIXO_DO_CODIGO_DE_CONTRATO, LARGURA_DO_SEQUENCIAL_DE_CONTRATO]).toEqual([
      PREFIXO_DECLARADO,
      LARGURA_DECLARADA_DO_SEQUENCIAL,
    ]);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly entrada: string;
    readonly canonizado: string;
  }[] = [
    {
      rotulo: 'a forma canônica, que permanece igual',
      entrada: 'CTR-2026-00001',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'o mesmo código em minúsculas',
      entrada: 'ctr-2026-00001',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'o mesmo código cercado de espaços',
      entrada: '  CTR-2026-00001  ',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'caixa mista e espaços de uma vez',
      entrada: ' Ctr-2026-00042 ',
      canonizado: 'CTR-2026-00042',
    },
  ];

  for (const { rotulo, entrada, canonizado } of ACEITOS) {
    it(`aprova ${rotulo} devolvendo ${canonizado}`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(entrada);

      expect(resultado.success).toBe(true);
      // Valor exato, e não "está definido": é a forma que o banco guarda e que toda comparação de
      // igualdade a jusante vai usar.
      expect(resultado.data).toBe(canonizado);
    });
  }

  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    {
      rotulo: 'quatro dígitos — a largura que o CLAUDE.md e o plano escrevem por engano',
      valor: 'CTR-2026-0001',
    },
    { rotulo: 'seis dígitos', valor: 'CTR-2026-000001' },
    { rotulo: 'ano de dois dígitos', valor: 'CTR-26-00001' },
    { rotulo: 'o prefixo de outra série', valor: 'COB-2026-00001' },
    { rotulo: 'o código sem os separadores', valor: 'CTR202600001' },
    { rotulo: 'sequencial não numérico', valor: 'CTR-2026-0000A' },
    { rotulo: 'texto vazio', valor: '   ' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${JSON.stringify(valor)})`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(valor);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
    });
  }

  it('dentro do recurso publicado, a recusa nomeia o campo codigo', () => {
    // O esquema do código é escalar, e escalar não tem caminho a reportar: quando ele chega pelo
    // parâmetro da rota, o nome do campo é aposto pela borda (`validar(esquema, valor, 'codigo')`).
    // Dentro do recurso o campo se nomeia sozinho, e é esta metade que prova o `campo: 'codigo'`
    // que a §6.1 exige.
    const resultado = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      codigo: 'CTR-2026-0001',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['codigo']);
  });

  /**
   * A amarra entre a EMISSÃO e a LEITURA — a terceira ponta da rede.
   *
   * Formatador e esquema saem das mesmas constantes; sem esta asserção os dois poderiam divergir e a
   * emissão produziria um código que a rota de leitura recusa, em silêncio, até o primeiro `GET`.
   */
  const SEQUENCIAIS_DENTRO_DA_LARGURA = [1, 20, 99_999] as const;

  for (const sequencial of SEQUENCIAIS_DENTRO_DA_LARGURA) {
    it(`o código emitido para o sequencial ${sequencial} é aceito pelo esquema`, () => {
      const codigo = formatarCodigoDeContrato(2026, sequencial);

      expect(ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(codigo).data).toBe(codigo);
    });
  }

  it('o formatador preenche com zeros até a largura declarada', () => {
    expect(formatarCodigoDeContrato(2026, 1)).toBe('CTR-2026-00001');
    expect(formatarCodigoDeContrato(2026, 20)).toBe('CTR-2026-00020');
    expect(formatarCodigoDeContrato(2026, 99_999)).toBe('CTR-2026-99999');
  });

  it('o formatador NÃO trunca o sequencial que passa da largura — truncar seria colisão', () => {
    expect(formatarCodigoDeContrato(2026, 123_456)).toBe('CTR-2026-123456');
  });
});

describe('CT-428 (b) — os tetos do dinheiro e do prazo são a capacidade das colunas', () => {
  /**
   * O teto e a escala de `numeric(15,2)` e o teto de `integer`, escritos **por extenso**.
   *
   * Não são política de produto: são a **capacidade** das colunas (§7.2). Escrevê-los aqui é o que
   * prende o contrato ao banco — alargar a constante sem alargar a coluna reprova este caso, que é
   * exatamente a divergência que reabriria o defeito do `500` por `numeric field overflow`.
   */
  const TETO_DECLARADO_MONETARIO = 9_999_999_999_999.99;
  const ESCALA_DECLARADA_MONETARIA = 0.01;
  const TETO_DECLARADO_DO_PRAZO = 2_147_483_647;

  it('o teto e a escala do dinheiro são a precisão e a escala de numeric(15,2)', () => {
    expect([MAIOR_VALOR_MONETARIO, ESCALA_MONETARIA]).toEqual([
      TETO_DECLARADO_MONETARIO,
      ESCALA_DECLARADA_MONETARIA,
    ]);
  });

  it('o teto do prazo é a MENOR das duas capacidades a jusante — a coluna integer', () => {
    expect(MAIOR_PRAZO_EM_MESES).toBe(TETO_DECLARADO_DO_PRAZO);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
  }[] = [
    { rotulo: 'um valor mensal comum', remendo: { valorMensal: 2500 } },
    { rotulo: 'exatamente a escala da coluna', remendo: { valorMensal: 2500.55 } },
    { rotulo: 'o menor valor representável', remendo: { valorMensal: 0.01 } },
    // Dízimas do binário: `0.29` e `8.11` não são exatos em ponto flutuante, e um resto ingênuo os
    // recusaria. Sem elas, a restrição de escala passaria a reprovar aluguel legítimo.
    { rotulo: 'uma dízima do binário', remendo: { valorMensal: 1200.29 } },
    { rotulo: 'outra dízima do binário', remendo: { valorMensal: 8.11 } },
    {
      rotulo: 'o teto monetário com o prazo mínimo — o produto ainda cabe',
      remendo: { valorMensal: MAIOR_VALOR_MONETARIO, prazoMeses: 1 },
    },
    { rotulo: 'o menor prazo', remendo: { valorMensal: 0.01, prazoMeses: 1 } },
    {
      rotulo: 'exatamente o teto do prazo, com o menor valor mensal',
      remendo: { valorMensal: 0.01, prazoMeses: MAIOR_PRAZO_EM_MESES },
    },
  ];

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'uma casa decimal além da escala — o arredondamento silencioso',
      remendo: { valorMensal: 2500.555 },
      campo: 'valorMensal',
    },
    { rotulo: 'muito abaixo da escala', remendo: { valorMensal: 0.001 }, campo: 'valorMensal' },
    { rotulo: 'acima do teto da coluna', remendo: { valorMensal: 1e14 }, campo: 'valorMensal' },
    // A FRONTEIRA IMEDIATA do teto — um centavo acima, e não uma ordem de grandeza acima. As outras
    // três grandezas do arquivo têm o par de fronteira; o dinheiro era a única sem, e a ausência
    // deixava sobreviver um mutante medido: `.max(MAIOR_VALOR_MONETARIO * 2)` mantinha a suíte
    // verde, porque `1e14` fica acima do teto dobrado e continuava recusado. O que se perdia não era
    // a recusa — a conferência conjunta `.refine` recusa de qualquer forma —, era a ATRIBUIÇÃO DE
    // CAMPO: na faixa `(teto, 2 × teto]` o erro passaria a acusar `prazoMeses` com o culpado sendo
    // `valorMensal`, contra o que a §6.1 declara.
    {
      rotulo: 'um centavo acima do teto da coluna',
      remendo: { valorMensal: MAIOR_VALOR_MONETARIO + ESCALA_MONETARIA },
      campo: 'valorMensal',
    },
    {
      rotulo: 'a ordem de grandeza que o gate mediu na metragem',
      remendo: { valorMensal: 1e30 },
      campo: 'valorMensal',
    },
    { rotulo: 'valor mensal zero (RD-08)', remendo: { valorMensal: 0 }, campo: 'valorMensal' },
    { rotulo: 'valor mensal negativo', remendo: { valorMensal: -0.01 }, campo: 'valorMensal' },
    { rotulo: 'valor mensal nulo', remendo: { valorMensal: null }, campo: 'valorMensal' },
    { rotulo: 'prazo zero (RD-08)', remendo: { prazoMeses: 0 }, campo: 'prazoMeses' },
    { rotulo: 'prazo fracionário', remendo: { prazoMeses: 1.5 }, campo: 'prazoMeses' },
    {
      rotulo: 'um mês a mais que o teto da coluna integer',
      remendo: { prazoMeses: MAIOR_PRAZO_EM_MESES + 1 },
      campo: 'prazoMeses',
    },
    // O par que discrimina a restrição CONJUNTA: os dois fatores estão dentro dos seus tetos, e o
    // PRODUTO não cabe. Nenhum teto de campo isolado o pega — sem esta linha, a ativação levantaria
    // `numeric field overflow` e a borda devolveria 500 por entrada malformada de cliente.
    {
      rotulo: 'dois fatores válidos cujo produto estoura numeric(15,2)',
      remendo: { valorMensal: MAIOR_VALOR_MONETARIO, prazoMeses: 2 },
      campo: 'prazoMeses',
    },
    // O segundo par conjunto, com um valor mensal de ordem de grandeza plausível: acima de
    // `9_999_999_999_999.99 / 2_147_483_647 ≈ 4656.6`, o teto do prazo deixa de bastar sozinho.
    {
      rotulo: 'um valor mensal plausível no teto do prazo — o total estoura',
      remendo: { valorMensal: 5000, prazoMeses: MAIOR_PRAZO_EM_MESES },
      campo: 'prazoMeses',
    },
  ];

  for (const { rotulo, remendo } of ACEITOS) {
    it(`aprova ${rotulo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(true);
      expect(resultado.data).toMatchObject(remendo);
    });
  }

  for (const { rotulo, remendo, campo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  it('a SAÍDA não replica a escala — restringi-la derrubaria a rota em vez de recusar', () => {
    // A metade que discrimina a assimetria deliberada (ver o marcador `DECISÃO FECHADA` de
    // `ESCALA_DA_METRAGEM`, em `comum.ts`, e o docblock de `ESCALA_MONETARIA`). Sem ela, "simetrizar
    // entrada e saída" passaria pela suíte, e a primeira divergência a montante viraria queda.
    const resultado = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      valorMensal: 2500.555,
      valorTotalContrato: 30_006.659,
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.valorMensal).toBe(2500.555);
    expect(resultado.data?.valorTotalContrato).toBe(30_006.659);
  });
});

/**
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e era o **CT-429** que descrevia uma fatia
 * que não gerava cobrança. Ele afirmava `efeitos.cobrancasGeradas` como `z.literal(false)`, e aquele
 * literal existia por decisão: era o débito **D28** da fatia `contratos-de-locacao` (F2/T7), cujo `QUANDO FECHA` nomeia
 * **esta** fatia — *"ela é obrigada a afrouxar o literal para publicar quantas cobranças nasceram, e não
 * consegue fazê-lo sem editar `esquemaDaAtivacaoDeContrato`"*. A T9 fez exatamente isso: a ativação
 * passou a derivar as parcelas do contrato e a gravá-las na mesma unidade de trabalho, de modo que o
 * efeito publicado deixou de ser *"não fiz"* e passou a ser **quantas**. Manter o CT-429 exigiria manter
 * o literal, e é ele — não o caso — que estava datado.
 *
 * **O caso não sumiu: ele foi substituído, e a substituição é mais estrita nas duas pontas que
 * importam.** O que o CT-429 provava — o campo obrigatório, o bloco fechado, a recusa nomeando o campo —
 * continua provado aqui, e o `false`, que era o único valor aceito, passa a estar afirmado **entre os
 * RECUSADOS**: é ele que impede a "correção compatível" (`z.union([z.literal(false), z.number()])`) de
 * atravessar a suíte. A contagem de casos **sobe** de quatro para cinco. Nenhuma asserção foi afrouxada:
 * toda igualdade continua sendo de valor exato e de `path` literal.
 */
describe('CT-537 — efeitos.cobrancasGeradas exige inteiro não negativo, e RECUSA o antigo false', () => {
  /** O contrato como a ativação o devolve: `ATIVO`, com as duas derivações já preenchidas. */
  const CONTRATO_ATIVADO = {
    ...CONTRATO_PUBLICADO,
    status: 'ATIVO',
    dataFimLocacao: '2027-01-30',
    valorTotalContrato: 30_000,
  } as const;

  /**
   * Os três valores aceitos, e os três não são decorativos.
   *
   * `0` é o caminho da RD-20 (`gerarCobrancasAutomaticamente: false` gera zero parcelas), e é a
   * fronteira de baixo de `nonnegative()`; `3` e `13` são os prazos dos dois cenários do golden que a
   * ativação exercita de ponta a ponta. Escritos por extenso, e não derivados de constante: derivá-los
   * faria a asserção andar junto com o que ela mede.
   */
  const ACEITOS = [0, 3, 13] as const;

  /**
   * Os três recusados, cada um fechando uma frouxidão diferente do tipo.
   *
   * `false` é o valor que o esquema **antigo** exigia, e é a ponta que discrimina o esquema novo de uma
   * união complacente com o antigo; `-1` só é recusado por `nonnegative()`; `2.5` só é recusado por
   * `int()`. Tirar qualquer um dos três deixa uma das três cláusulas sem asserção.
   */
  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: unknown }[] = [
    { rotulo: 'o antigo literal false', valor: false },
    { rotulo: 'a contagem negativa', valor: -1 },
    { rotulo: 'a contagem fracionária', valor: 2.5 },
  ];

  /** O caminho que toda recusa do campo tem de nomear — escrito uma vez, afirmado por igualdade. */
  const CAMINHO_DO_CAMPO = ['efeitos', 'cobrancasGeradas'];

  for (const aceito of ACEITOS) {
    it(`aprova ${String(aceito)} cobranças geradas e o valor sobrevive à análise`, () => {
      const resposta = { ...CONTRATO_ATIVADO, efeitos: { cobrancasGeradas: aceito } };

      const resultado = esquemaDaAtivacaoDeContrato.safeParse(resposta);

      expect(resultado.success).toBe(true);
      // Igualdade de NÚMERO, e depois do corpo inteiro: um esquema que coagisse o valor (para texto,
      // para booleano) passaria por uma asserção de presença e reprova aqui.
      expect(resultado.data?.efeitos.cobrancasGeradas).toBe(aceito);
      expect(resultado.data).toEqual(resposta);
    });
  }

  for (const recusado of RECUSADOS) {
    it(`RECUSA ${recusado.rotulo}, nomeando o campo`, () => {
      const resultado = esquemaDaAtivacaoDeContrato.safeParse({
        ...CONTRATO_ATIVADO,
        efeitos: { cobrancasGeradas: recusado.valor },
      });

      expect(resultado.success).toBe(false);
      // O `path` LITERAL, e não a existência de erro: é ele que o cliente usa para destacar o campo, e
      // uma recusa que nomeasse a raiz do objeto passaria por um `success === false` sozinho.
      expect(resultado.error?.issues[0]?.path).toEqual(CAMINHO_DO_CAMPO);
    });
  }

  it('RECUSA a resposta sem a declaração de efeito', () => {
    const resultado = esquemaDaAtivacaoDeContrato.safeParse({ ...CONTRATO_ATIVADO });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['efeitos']);
  });

  it('RECUSA efeito inventado ao lado do declarado — o strictObject NÃO foi afrouxado', () => {
    const resultado = esquemaDaAtivacaoDeContrato.safeParse({
      ...CONTRATO_ATIVADO,
      efeitos: { cobrancasGeradas: 3, boletosEmitidos: 3 },
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
    expect(resultado.error?.issues[0]?.path).toEqual(['efeitos']);
    expect(resultado.error?.issues[0]).toMatchObject({ keys: ['boletosEmitidos'] });

    // O locatário do card é `['efeitos','boletosEmitidos']`, e ele é AFIRMADO — pela composição de
    // `path` com `keys`, que é onde o Zod 4 o publica. A chave desconhecida não pertence ao esquema, de
    // modo que `path` aponta para o objeto que a recusou e `keys` diz **qual** chave sobrou; a forma foi
    // medida, não presumida. Compor as duas é o que impede a asserção de passar num esquema que
    // reportasse a raiz da resposta em vez de `efeitos`.
    const issue = resultado.error?.issues[0] as { path: unknown[]; keys: string[] } | undefined;
    expect([...(issue?.path ?? []), ...(issue?.keys ?? [])]).toEqual([
      'efeitos',
      'boletosEmitidos',
    ]);
  });

  it('CT-537 (b) — os dois enums publicados da cobrança seguem com cinco e quatro membros', () => {
    // Ela duplica parcialmente o `CT-540`, e o card manda mantê-la: aqui ela é a **âncora** que impede
    // o enum de crescer junto com a mudança do contrato de ativação. A ativação passou a gerar parcelas
    // de natureza `ALUGUEL`, e a tentação de acrescentar uma natureza — ou um estado "GERADA" — nasce
    // exatamente nesta fatia. As listas são escritas por extenso e comparadas por igualdade ORDENADA: a
    // T3 deriva os dois enums do PostgreSQL destes arranjos, e um enum guarda a ordem dos rótulos.
    expect([...NATUREZAS_DE_COBRANCA]).toEqual([
      'ALUGUEL',
      'AGUA',
      'CONDOMINIO',
      'ENERGIA',
      'OUTRO',
    ]);
    expect([...ESTADOS_DA_COBRANCA]).toEqual(['A_VENCER', 'VENCIDA', 'PAGA', 'CANCELADA']);
  });
});

describe('CT-540 — natureza e estado da cobrança são uniões fechadas de cinco e quatro valores', () => {
  /**
   * As duas listas escritas **por extenso**, e na ordem — o card do caso as fixa.
   *
   * A ordem é conteúdo: a T3 deriva `negocio.natureza_cobranca` e `negocio.status_cobranca` destes
   * arranjos, e um enum do PostgreSQL guarda a ordem dos rótulos. Derivá-las das constantes
   * exportadas deixaria as duas pontas andando juntas, e um sexto valor acrescentado passaria pela
   * suíte sem uma recusa sequer.
   */
  const NATUREZAS_DECLARADAS = ['ALUGUEL', 'AGUA', 'CONDOMINIO', 'ENERGIA', 'OUTRO'] as const;
  const ESTADOS_DECLARADOS = ['A_VENCER', 'VENCIDA', 'PAGA', 'CANCELADA'] as const;

  /**
   * A **partição** dos estados em aberto, escrita por extenso — o sujeito do `CT-540 (b)`.
   *
   * Escrita aqui, e não derivada de `ESTADOS_DECLARADOS`: derivá-la faria as duas pontas andarem
   * juntas, e um rótulo liquidado que entrasse na partição passaria pela suíte sem uma recusa. É a
   * mesma razão que já governa as duas listas acima.
   */
  const EM_ABERTO_DECLARADOS = ['A_VENCER', 'VENCIDA'] as const;

  it('as duas uniões publicadas têm exatamente os valores declarados, na ordem', () => {
    expect([...NATUREZAS_DE_COBRANCA]).toEqual([...NATUREZAS_DECLARADAS]);
    expect([...ESTADOS_DA_COBRANCA]).toEqual([...ESTADOS_DECLARADOS]);
  });

  it('os dois arranjos estão congelados em execução', () => {
    // `as const` fecha a união em compilação e não sobrevive ao build; sem `Object.freeze`, um
    // consumidor com um `push` mal colocado alargaria o enum de todo mundo, porque o módulo tem
    // instância única no processo.
    expect([Object.isFrozen(NATUREZAS_DE_COBRANCA), Object.isFrozen(ESTADOS_DA_COBRANCA)]).toEqual([
      true,
      true,
    ]);
  });

  it('CT-540 (b) — ESTADOS_EM_ABERTO é a partição declarada, na ordem, e está congelada', () => {
    // A **terceira** lista do módulo ganha o mesmo par de asserções dos dois irmãos, e a razão de ela
    // precisar dele é própria: `predicadoDaCarteira`, em `packages/db/src/cobranca.ts`, consulta esta
    // partição para decidir quando anexar `AND pago_em IS NULL AND cancelado_em IS NULL` ao recorte —
    // o par que alcança o índice parcial `cobranca_aberta_idx`. Um `push` de consumidor que
    // acrescentasse um estado **liquidado** faria o predicado anexar o par ao recorte daquele estado,
    // e a carteira passaria a **descartar linhas em silêncio**: as pagas e as canceladas têm um dos
    // dois carimbos preenchido por construção.
    //
    // Sem esta asserção, a única rede era indireta: um rótulo acrescentado em tempo de módulo faria o
    // `CT-524 (b)` reprovar por conjunto vazio, mas a **mutação após a carga** — que é o que
    // `Object.freeze` impede — atravessava a suíte inteira sem uma recusa. É o débito **D9 (F3/T4)**,
    // fechado aqui.
    expect([...ESTADOS_EM_ABERTO]).toEqual([...EM_ABERTO_DECLARADOS]);
    expect(Object.isFrozen(ESTADOS_EM_ABERTO)).toBe(true);
  });

  for (const natureza of NATUREZAS_DECLARADAS) {
    it(`aprova a natureza ${natureza} e devolve o recurso verbatim`, () => {
      const cobranca = { ...COBRANCA_PUBLICADA, natureza };

      const resultado = esquemaDaCobranca.safeParse(cobranca);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.natureza).toBe(natureza);
      // Profundamente igual ao enviado: o esquema não acrescenta nem remove campo.
      expect(resultado.data).toEqual(cobranca);
    });
  }

  for (const status of ESTADOS_DECLARADOS) {
    it(`aprova o estado ${status} e devolve o recurso verbatim`, () => {
      const cobranca = { ...COBRANCA_PUBLICADA, status };

      const resultado = esquemaDaCobranca.safeParse(cobranca);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.status).toBe(status);
      expect(resultado.data).toEqual(cobranca);
    });
  }

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly campo: string;
    readonly valor: string;
  }[] = [
    { rotulo: 'uma natureza plausível e não declarada', campo: 'natureza', valor: 'IPTU' },
    { rotulo: 'a mesma natureza em minúsculas', campo: 'natureza', valor: 'agua' },
    { rotulo: 'o estado do contrato, que é outro enum', campo: 'status', valor: 'ATIVO' },
    { rotulo: 'um rótulo arbitrário de estado', campo: 'status', valor: 'EM_ABERTO' },
  ];

  for (const { rotulo, campo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${valor}) nomeando o campo ${campo}`, () => {
      const resultado = esquemaDaCobranca.safeParse({ ...COBRANCA_PUBLICADA, [campo]: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-541 — o código da cobrança é canonizado num ponto único, e a largura é de SETE dígitos', () => {
  /**
   * O formato declarado, escrito **por extenso** — pela mesma razão do CT-428, e com o agravante de
   * que aqui a largura DIVERGE da série irmã.
   *
   * É a decisão que o marcador `DECISÃO FECHADA` de `cobranca.ts` protege, e o valor foi MEDIDO no
   * sistema antigo (`autoname` = `COB-.YYYY.-.#######`, série viva em `COB-2026-0000058`). Derivá-lo
   * das constantes deixaria as duas pontas andando juntas: uma largura "harmonizada" para os cinco
   * dígitos do contrato de locação — que é a tentação óbvia de quem lê os dois arquivos lado a lado
   * — passaria pela suíte inteira sem uma recusa sequer.
   */
  const PREFIXO_DECLARADO = 'COB';
  const LARGURA_DECLARADA_DO_SEQUENCIAL = 7;

  it('o formato publicado é exatamente o que as constantes declaram', () => {
    expect([PREFIXO_DO_CODIGO_DE_COBRANCA, LARGURA_DO_SEQUENCIAL_DE_COBRANCA]).toEqual([
      PREFIXO_DECLARADO,
      LARGURA_DECLARADA_DO_SEQUENCIAL,
    ]);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly entrada: string;
    readonly canonizado: string;
  }[] = [
    {
      rotulo: 'a forma canônica, que permanece igual',
      entrada: 'COB-2026-0000058',
      canonizado: 'COB-2026-0000058',
    },
    {
      rotulo: 'o mesmo código em minúsculas',
      entrada: 'cob-2026-0000058',
      canonizado: 'COB-2026-0000058',
    },
    {
      rotulo: 'o mesmo código cercado de espaços',
      entrada: '  COB-2026-0000058  ',
      canonizado: 'COB-2026-0000058',
    },
    {
      rotulo: 'caixa mista e espaços de uma vez',
      entrada: ' Cob-2026-0000001 ',
      canonizado: 'COB-2026-0000001',
    },
  ];

  for (const { rotulo, entrada, canonizado } of ACEITOS) {
    it(`aprova ${rotulo} devolvendo ${canonizado}`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_COBRANCA.safeParse(entrada);

      expect(resultado.success).toBe(true);
      // Valor exato, e não "está definido": é a forma que o banco guarda e que toda comparação de
      // igualdade a jusante vai usar.
      expect(resultado.data).toBe(canonizado);
    });
  }

  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    {
      rotulo: 'cinco dígitos — a largura do contrato de locação, que é a harmonização tentadora',
      valor: 'COB-2026-00058',
    },
    { rotulo: 'seis dígitos', valor: 'COB-2026-000058' },
    { rotulo: 'oito dígitos', valor: 'COB-2026-000000058' },
    { rotulo: 'o prefixo da outra série', valor: 'CTR-2026-0000058' },
    { rotulo: 'ano de dois dígitos', valor: 'COB-26-0000058' },
    { rotulo: 'sequencial não numérico', valor: 'COB-2026-000005A' },
    { rotulo: 'texto vazio', valor: '   ' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${JSON.stringify(valor)})`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_COBRANCA.safeParse(valor);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
    });
  }

  it('dentro do recurso publicado, a recusa nomeia o campo codigo', () => {
    // O esquema do código é escalar, e escalar não tem caminho a reportar: quando ele chega pelo
    // parâmetro da rota, o nome do campo é aposto pela borda. Dentro do recurso o campo se nomeia
    // sozinho, e é esta metade que prova o `campo: 'codigo'` que a §6.1 exige.
    const resultado = esquemaDaCobranca.safeParse({
      ...COBRANCA_PUBLICADA,
      codigo: 'COB-2026-00058',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['codigo']);
  });

  /**
   * A amarra entre a EMISSÃO e a LEITURA — a terceira ponta da rede.
   *
   * Formatador e esquema saem das mesmas constantes; sem esta asserção os dois poderiam divergir e a
   * emissão produziria um código que a rota de leitura recusa, em silêncio, até o primeiro `GET`.
   */
  const SEQUENCIAIS_DENTRO_DA_LARGURA = [1, 58, 9_999_999] as const;

  for (const sequencial of SEQUENCIAIS_DENTRO_DA_LARGURA) {
    it(`o código emitido para o sequencial ${sequencial} é aceito pelo esquema`, () => {
      const codigo = formatarCodigoDeCobranca(2026, sequencial);

      expect(ESQUEMA_DO_CODIGO_DE_COBRANCA.safeParse(codigo).data).toBe(codigo);
    });
  }

  it('o formatador preenche com zeros até a largura declarada', () => {
    expect(formatarCodigoDeCobranca(2026, 1)).toBe('COB-2026-0000001');
    expect(formatarCodigoDeCobranca(2026, 58)).toBe('COB-2026-0000058');
    expect(formatarCodigoDeCobranca(2026, 9_999_999)).toBe('COB-2026-9999999');
  });

  it('o formatador NÃO trunca o sequencial que passa da largura — truncar seria colisão', () => {
    expect(formatarCodigoDeCobranca(2026, 12_345_678)).toBe('COB-2026-12345678');
  });
});

describe('CT-542 — o corpo da cobrança nova é fechado em seis campos e recusa tudo que o servidor decide', () => {
  /** Os seis campos do corpo, na ordem declarada — a forma que o `strictObject` publica. */
  const CAMPOS_DECLARADOS = [
    'contratoCodigo',
    'natureza',
    'referencia',
    'competencia',
    'dataVencimento',
    'valorOriginal',
  ] as const;

  /**
   * As seis chaves que o SERVIDOR decide (§6.1) — nenhuma delas é chave do corpo.
   *
   * `codigo` vem da série; `status` é derivado (ADR-0021 e ADR-0022, que o tiram do recurso);
   * `locatarioId` sai da junção com o contrato; `valorMulta` é derivado enquanto a cobrança está
   * aberta e carimbado quando ela é liquidada; `pagoEm` é o ato de liquidação; e `empresaId` sai da
   * sessão. A de `empresaId` é herdada de graça pela varredura do CT-337, e fica **também** aqui,
   * explícita, porque é a chave cujo vazamento cruzaria empresa.
   */
  const DECIDIDOS_PELO_SERVIDOR: readonly { readonly chave: string; readonly valor: unknown }[] = [
    { chave: 'codigo', valor: 'COB-2026-0000060' },
    { chave: 'status', valor: 'PAGA' },
    { chave: 'locatarioId', valor: LOCATARIO_DA_COBRANCA },
    { chave: 'valorMulta', valor: 3.75 },
    { chave: 'pagoEm', valor: '2026-03-25' },
    { chave: 'empresaId', valor: EMPRESA_ALHEIA },
  ];

  it('o corpo declara exatamente os seis campos, na ordem', () => {
    expect(Object.keys(esquemaDeCobrancaNova.shape)).toEqual([...CAMPOS_DECLARADOS]);
  });

  it('o corpo aprova o lançamento completo, verbatim', () => {
    const resultado = esquemaDeCobrancaNova.safeParse({ ...CORPO_DE_COBRANCA });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CORPO_DE_COBRANCA });
    expect(resultado.data?.valorOriginal).toBe(187.42);
    expect(resultado.data?.contratoCodigo).toBe('CTR-2026-00007');
  });

  for (const { chave, valor } of DECIDIDOS_PELO_SERVIDOR) {
    it(`recusa ${chave} como chave desconhecida`, () => {
      const resultado = esquemaDeCobrancaNova.safeParse({ ...CORPO_DE_COBRANCA, [chave]: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }

  for (const campo of CAMPOS_DECLARADOS) {
    it(`recusa o corpo sem ${campo}, nomeando o campo omitido`, () => {
      // É o que distingue "fechado e obrigatório" de "fechado e opcional": nenhum campo desta
      // superfície admite ausência, porque não há atualização parcial nela.
      const semOCampo = Object.fromEntries(
        Object.entries(CORPO_DE_COBRANCA).filter(([nome]) => nome !== campo),
      );

      const resultado = esquemaDeCobrancaNova.safeParse(semOCampo);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-543 — cada campo do corpo da cobrança recusa fora da fronteira nomeando o próprio campo', () => {
  /**
   * O teto e a escala de `numeric(15,2)` e o teto do texto curto, escritos **por extenso**.
   *
   * Não são política de produto: são a **capacidade** das colunas (§7.2). Escrevê-los aqui é o que
   * prende o contrato ao banco — alargar a constante sem alargar a coluna reprova este caso, que é
   * exatamente a divergência que reabriria o defeito do `500` por `numeric field overflow`.
   */
  const TETO_DECLARADO_MONETARIO = 9_999_999_999_999.99;
  const ESCALA_DECLARADA_MONETARIA = 0.01;
  const TETO_DECLARADO_DO_TEXTO_CURTO = 200;

  it('o teto e a escala do dinheiro são a precisão e a escala de numeric(15,2)', () => {
    expect([MAIOR_VALOR_MONETARIO, ESCALA_MONETARIA]).toEqual([
      TETO_DECLARADO_MONETARIO,
      ESCALA_DECLARADA_MONETARIA,
    ]);
  });

  it('o teto da referência é o do texto curto do pacote', () => {
    expect(MAIOR_TEXTO_CURTO).toBe(TETO_DECLARADO_DO_TEXTO_CURTO);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly campo: 'competencia' | 'valorOriginal' | 'referencia';
    readonly valor: string | number;
  }[] = [
    { rotulo: 'o primeiro dia de março', campo: 'competencia', valor: '2026-03-01' },
    { rotulo: 'o primeiro dia de um mês curto', campo: 'competencia', valor: '2026-02-01' },
    { rotulo: 'o primeiro dia do ano seguinte', campo: 'competencia', valor: '2027-01-01' },
    { rotulo: 'o menor valor representável', campo: 'valorOriginal', valor: 0.01 },
    { rotulo: 'um valor comum', campo: 'valorOriginal', valor: 187.42 },
    // As dízimas do binário não são enfeite: `1200.29` e `8.11` não são exatos em ponto flutuante, e
    // um resto de escala ingênuo os recusaria — e recusar cobrança legítima é o defeito pior.
    { rotulo: 'uma dízima do binário', campo: 'valorOriginal', valor: 1200.29 },
    { rotulo: 'outra dízima do binário', campo: 'valorOriginal', valor: 8.11 },
    {
      rotulo: 'exatamente o teto da coluna',
      campo: 'valorOriginal',
      valor: TETO_DECLARADO_MONETARIO,
    },
    { rotulo: 'a menor referência não vazia', campo: 'referencia', valor: 'A' },
    {
      rotulo: 'exatamente o teto do texto curto',
      campo: 'referencia',
      valor: 'x'.repeat(TETO_DECLARADO_DO_TEXTO_CURTO),
    },
  ];

  for (const { rotulo, campo, valor } of ACEITOS) {
    it(`aprova ${rotulo} em ${campo}, devolvendo o valor exato`, () => {
      const resultado = esquemaDeCobrancaNova.safeParse({ ...CORPO_DE_COBRANCA, [campo]: valor });

      expect(resultado.success).toBe(true);
      expect(resultado.data?.[campo]).toBe(valor);
    });
  }

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'o segundo dia do mês',
      remendo: { competencia: '2026-03-02' },
      campo: 'competencia',
    },
    {
      rotulo: 'o último dia do mês',
      remendo: { competencia: '2026-03-31' },
      campo: 'competencia',
    },
    // `2026-02-30` prende o `z.iso.date()` por um lado e `…T00:00:00Z` pelo outro: são as duas
    // coisas que um `regex` ingênuo de competência deixaria passar.
    {
      rotulo: 'uma data que o calendário não tem',
      remendo: { competencia: '2026-02-30' },
      campo: 'competencia',
    },
    {
      rotulo: 'a competência com hora — a coluna é date, não timestamp',
      remendo: { competencia: '2026-03-01T00:00:00Z' },
      campo: 'competencia',
    },
    { rotulo: 'valor zero', remendo: { valorOriginal: 0 }, campo: 'valorOriginal' },
    { rotulo: 'valor negativo', remendo: { valorOriginal: -187.42 }, campo: 'valorOriginal' },
    // A ordem de grandeza que motivou `MAIOR_VALOR_MONETARIO`: `z.number().gt(0)` a aprova, o driver
    // levanta `numeric field overflow` (22003) e a borda devolveria **500** por entrada malformada
    // de cliente, quando a §6.1 manda `422 CAMPO_INVALIDO` nomeando o campo.
    {
      rotulo: 'a ordem de grandeza que estoura a coluna',
      remendo: { valorOriginal: 1e30 },
      campo: 'valorOriginal',
    },
    {
      rotulo: 'uma casa decimal além da escala — o arredondamento silencioso',
      remendo: { valorOriginal: 187.425 },
      campo: 'valorOriginal',
    },
    { rotulo: 'referência só de espaços', remendo: { referencia: '   ' }, campo: 'referencia' },
    {
      rotulo: 'um caractere além do teto do texto curto',
      remendo: { referencia: 'x'.repeat(TETO_DECLARADO_DO_TEXTO_CURTO + 1) },
      campo: 'referencia',
    },
    {
      rotulo: 'um vencimento que o calendário não tem',
      remendo: { dataVencimento: '2026-02-30' },
      campo: 'dataVencimento',
    },
  ];

  for (const { rotulo, remendo, campo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDeCobrancaNova.safeParse({ ...CORPO_DE_COBRANCA, ...remendo });

      expect(resultado.success).toBe(false);
      // O `path` do PRÓPRIO campo, nunca a raiz do objeto: a conferência da competência é do objeto,
      // e sem o `path` explícito do `refine` a recusa chegaria ao cliente sem nome de campo.
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-544 — o recurso publicado da cobrança tem forma fechada, sem UUID e sem escala na saída', () => {
  /** Os dezoito campos publicados, na ordem declarada (tech spec §4.1.1). */
  const CAMPOS_PUBLICADOS = [
    'codigo',
    'contratoCodigo',
    'locatarioId',
    'natureza',
    'referencia',
    'competencia',
    'dataVencimento',
    'valorOriginal',
    'status',
    'diasAtraso',
    'valorMulta',
    'valorJuros',
    'valorTotal',
    'pagoEm',
    'valorPago',
    'canceladoEm',
    'multaPercentualAplicado',
    'jurosPercentualAplicado',
  ] as const;

  /**
   * O resíduo de ponto flutuante da derivação, **MEDIDO** contra a aritmética da RD-07 — não
   * estimado pela aparência.
   *
   * O cenário é uma cobrança de `R$ 257,50` com 12 dias de atraso, multa de 2% e juros de 1% ao mês,
   * e os três números saem da RD-07 corrida em ponto flutuante:
   *
   * ```
   * multa = round(257.50 × 2/100, 2)              = 5.15
   * juros = 257.50 × (1/100) / 30 × 12            = 1.0300000000000002
   * total = 257.50 + 5.15 + 1.0300000000000002    = 263.67999999999995
   * ```
   *
   * **A medição não é cerimônia — ela trocou os dois números.** Os que o card sugeria
   * (`6.2399999999999995` e `193.66999999999996`) são **aprovados** por `multipleOf(0.01)`, medido
   * com o zod deste pacote: um caso construído sobre eles seguiria verde mesmo com a escala
   * replicada na saída, e não provaria nada sobre a assimetria. É exatamente o que o
   * `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM` adverte — *a aparência do número não diz de que lado
   * da tolerância ele cai*. Estes dois são **recusados**, e o caso logo abaixo o afirma.
   */
  const COBRANCA_COM_RESIDUO = {
    ...COBRANCA_PUBLICADA,
    valorOriginal: 257.5,
    status: 'VENCIDA',
    diasAtraso: 12,
    valorMulta: 5.15,
    valorJuros: 1.0300000000000002,
    valorTotal: 263.67999999999995,
  };

  /** A cobrança liquidada — os cinco anuláveis preenchidos, que é o outro estado possível deles. */
  const COBRANCA_LIQUIDADA = {
    ...COBRANCA_PUBLICADA,
    status: 'PAGA',
    pagoEm: '2026-03-25',
    valorPago: 191.3,
    multaPercentualAplicado: 2,
    jurosPercentualAplicado: 1,
  };

  it('o recurso declara exatamente os dezoito campos, na ordem', () => {
    expect(Object.keys(esquemaDaCobranca.shape)).toEqual([...CAMPOS_PUBLICADOS]);
  });

  it('o recurso publicado NÃO expõe o UUID interno (ADR-0017)', () => {
    // Metade declarativa: o campo não existe no contrato. Sozinha, ela não distingue
    // "não declarado" de "declarado e ignorado na leitura".
    expect(Object.keys(esquemaDaCobranca.shape)).not.toContain('id');

    // Metade comportamental: um `id` que chegue de fora não atravessa o esquema. Sozinha, ela não
    // distingue "descartado" de "nunca chegou".
    const comUuidInterno = esquemaDaCobranca.safeParse({
      ...COBRANCA_PUBLICADA,
      id: '5d6e7f80-9102-4a3b-8c4d-5e6f70819203',
    });

    expect(comUuidInterno.success).toBe(true);
    expect(comUuidInterno.data).toEqual(COBRANCA_PUBLICADA);
  });

  it('os cinco campos do desfecho aceitam null e os devolvem', () => {
    const resultado = esquemaDaCobranca.safeParse(COBRANCA_PUBLICADA);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(COBRANCA_PUBLICADA);
  });

  it('os cinco campos do desfecho aceitam o carimbo do pagamento e o devolvem', () => {
    const resultado = esquemaDaCobranca.safeParse(COBRANCA_LIQUIDADA);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(COBRANCA_LIQUIDADA);
  });

  it('APROVA o resíduo de ponto flutuante da derivação e devolve os dois valores intactos', () => {
    const resultado = esquemaDaCobranca.safeParse(COBRANCA_COM_RESIDUO);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.valorJuros).toBe(1.0300000000000002);
    expect(resultado.data?.valorTotal).toBe(263.67999999999995);
    expect(resultado.data).toEqual(COBRANCA_COM_RESIDUO);
  });

  it('os dois resíduos SÃO recusados pela escala — é isso que dá poder ao caso acima', () => {
    // Sem esta linha o caso anterior seria infalível (AP-29): se `multipleOf(ESCALA_MONETARIA)`
    // aprovasse os dois números, "simetrizar entrada e saída" passaria pela suíte, e a primeira
    // divergência a montante viraria queda de rota em vez de `422`. Ver a razão (1) do
    // `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`, em `comum.ts`.
    const comEscalaDeSaida = z.number().multipleOf(ESCALA_MONETARIA);

    expect([
      comEscalaDeSaida.safeParse(1.0300000000000002).success,
      comEscalaDeSaida.safeParse(263.67999999999995).success,
    ]).toEqual([false, false]);
  });

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly recurso: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'o código nulo',
      recurso: { ...COBRANCA_PUBLICADA, codigo: null },
      campo: 'codigo',
    },
    {
      rotulo: 'o estado com espaço à direita',
      recurso: { ...COBRANCA_PUBLICADA, status: 'A_VENCER ' },
      campo: 'status',
    },
    {
      rotulo: 'o recurso sem o total derivado',
      recurso: Object.fromEntries(
        Object.entries(COBRANCA_PUBLICADA).filter(([nome]) => nome !== 'valorTotal'),
      ),
      campo: 'valorTotal',
    },
  ];

  for (const { rotulo, recurso, campo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDaCobranca.safeParse(recurso);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-545 — as constantes monetárias têm definição única no pacote', () => {
  /** A raiz deste pacote, derivada da posição deste arquivo — o mesmo cálculo de `folha.spec.ts`. */
  const RAIZ_DO_PACOTE = dirname(import.meta.dirname);

  /** O arquivo que DEVE ser o dono das duas constantes, e o que DEVE consumi-las por importação. */
  const DONO_DAS_CONSTANTES = 'src/contrato.ts';
  const CONSUMIDOR = 'src/cobranca.ts';

  /** Os dois nomes cujo fato do contrato não pode ter uma segunda definição. */
  const CONSTANTES_MONETARIAS = ['MAIOR_VALOR_MONETARIO', 'ESCALA_MONETARIA'] as const;

  /**
   * Casa a **declaração exportada** de uma das duas constantes.
   *
   * A varredura já entrega o fonte sem comentários, de modo que o próprio marcador
   * `DÉBITO COM GATILHO` de `cobranca.ts` — que cita os dois nomes em prosa — não é contado. É o
   * defeito literal registrado em `.claude/rules/testing-stack.md`: asserção que casa o alvo dentro
   * de um comentário reprova o código correto.
   */
  const declaracaoExportada = (nome: string): ((linha: string) => boolean) => {
    const padrao = new RegExp(`^export const ${nome}\\b`);
    return (linha) => padrao.test(linha);
  };

  /** Casa QUALQUER ligação do nome, exportada ou não — é o que pega a redeclaração local. */
  const qualquerDeclaracao = (nome: string): ((linha: string) => boolean) => {
    const padrao = new RegExp(`\\b(const|let|var)\\s+${nome}\\b`);
    return (linha) => padrao.test(linha);
  };

  for (const nome of CONSTANTES_MONETARIAS) {
    it(`${nome} tem exatamente UMA declaração exportada em todo o src/, e ela está em ${DONO_DAS_CONSTANTES}`, async () => {
      // Diretório ausente LEVANTA (é o desenho de `listarFontesTs`): um `src/` renomeado reduziria a
      // varredura a zero arquivos, e o caso seguiria verde provando nada.
      const fontes = await listarFontesTs(join(RAIZ_DO_PACOTE, 'src'));

      const varredura = await varrerArquivos(fontes, declaracaoExportada(nome));
      const arquivosQueDeclaram = varredura.ocorrencias.map((ocorrencia) =>
        relative(RAIZ_DO_PACOTE, ocorrencia.replace(/:\d+$/, '')),
      );

      // Lista exata: a contagem e o dono numa asserção só. Uma segunda definição em qualquer
      // arquivo — a forma do débito D3 já aberto no projeto — acrescenta um elemento e reprova
      // nomeando o arquivo culpado.
      expect(arquivosQueDeclaram).toEqual([DONO_DAS_CONSTANTES]);
      // O zero nunca é escondido: sem esta linha, uma varredura que não leu arquivo algum passaria.
      expect(varredura.arquivos).toBeGreaterThan(0);
    });
  }

  it(`${CONSUMIDOR} obtém as duas por importação de './contrato.js', e não redeclara nenhuma`, async () => {
    const fonte = semComentarios(await readFile(join(RAIZ_DO_PACOTE, CONSUMIDOR), 'utf8'));

    const importacao = /import\s*\{([^}]*)\}\s*from\s*'\.\/contrato\.js'/.exec(fonte);
    const simbolosImportados = (importacao?.[1] ?? '')
      .split(',')
      .map((simbolo) => simbolo.trim())
      .filter((simbolo) => simbolo.length > 0)
      .sort();

    // O arquivo entra na asserção para que a falha nomeie o culpado — trocar o import por
    // redeclaração local esvazia esta lista.
    expect({ arquivo: CONSUMIDOR, simbolosImportados }).toEqual({
      arquivo: CONSUMIDOR,
      simbolosImportados: [
        'ESCALA_MONETARIA',
        'ESQUEMA_DO_CODIGO_DE_CONTRATO',
        'MAIOR_VALOR_MONETARIO',
      ],
    });

    // A metade que a contagem acima não alcança: uma redeclaração **sem `export`** não é declaração
    // exportada, e passaria pela varredura anterior sem uma ocorrência sequer.
    const redeclaracoes = CONSTANTES_MONETARIAS.filter((nome) =>
      fonte.split('\n').some((linha) => qualquerDeclaracao(nome)(linha)),
    );

    expect(redeclaracoes).toEqual([]);
  });

  it('o valor que o pacote publica é a precisão e a escala de numeric(15,2)', () => {
    // A amarra de VALOR, a partir do símbolo importado: sem ela, "uma definição só" seria compatível
    // com uma definição só e errada.
    expect([MAIOR_VALOR_MONETARIO, ESCALA_MONETARIA]).toEqual([9_999_999_999_999.99, 0.01]);
  });
});

/**
 * Os seis campos da política, na ordem em que o esquema os declara.
 *
 * A lista é escrita **por extenso** e amarrada ao `shape` no primeiro caso do CT-604: é ela que
 * governa as seis linhas de campo ausente do CT-605, e derivá-la do próprio esquema faria as duas
 * pontas andarem juntas — um campo que virasse `.optional()` sairia da varredura junto com a
 * asserção que deveria pegá-lo.
 */
const CAMPOS_DA_POLITICA_DE_AVISO = [
  'ativo',
  'diasAntesDoVencimento',
  'intervaloMinimoDias',
  'janelaInicio',
  'janelaFim',
  'canal',
] as const;

/** O corpo canônico da política **sem** um dos campos — a entrada das seis linhas de ausência. */
function corpoDaPoliticaSemOCampo(campo: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(CORPO_DA_POLITICA_DE_AVISO).filter(([nome]) => nome !== campo),
  );
}

describe('CT-604 — o esquema da política aceita o corpo completo e as bordas exatas de cada faixa', () => {
  it('declara exatamente os seis campos publicados, na ordem do contrato', () => {
    expect(Object.keys(esquemaDaPoliticaDeAvisoNova.shape)).toEqual([
      ...CAMPOS_DA_POLITICA_DE_AVISO,
    ]);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly corpo: Record<string, unknown>;
  }[] = [
    // O piso de cada faixa numa linha só: `diasAntesDoVencimento` em 0 (avisar no próprio dia do
    // vencimento) e `intervaloMinimoDias` em 1 (o menor intervalo que ainda é trava). Sem esta linha,
    // um piso mais alto no esquema — `min(1)` nos dias — passaria pela suíte inteira.
    {
      rotulo: 'o piso de cada faixa e a janela do dia inteiro',
      corpo: {
        ativo: false,
        diasAntesDoVencimento: 0,
        intervaloMinimoDias: 1,
        janelaInicio: '00:00',
        janelaFim: '23:59',
        canal: 'EMAIL',
      },
    },
    // O teto de cada faixa, e a janela de instante único (`janelaFim === janelaInicio`), que é a
    // borda ACEITA da comparação: um `refine` escrito com `>` em vez de `>=` recusaria este corpo.
    {
      rotulo: 'o teto de cada faixa e a janela de instante único',
      corpo: {
        ativo: true,
        diasAntesDoVencimento: 90,
        intervaloMinimoDias: 90,
        janelaInicio: '23:59',
        janelaFim: '23:59',
        canal: 'EMAIL',
      },
    },
    { rotulo: 'o corpo típico do contrato', corpo: { ...CORPO_DA_POLITICA_DE_AVISO } },
  ];

  for (const { rotulo, corpo } of ACEITOS) {
    it(`aprova ${rotulo} devolvendo o corpo verbatim`, () => {
      const resultado = esquemaDaPoliticaDeAvisoNova.safeParse(corpo);

      expect(resultado.success).toBe(true);
      // Estritamente igual ao enviado: o esquema não acrescenta, não remove e não coage. É o que
      // impede um `.default()` distraído de ligar a régua de quem não a ligou.
      expect(resultado.data).toStrictEqual(corpo);
    });
  }
});

describe('CT-604 (b) — a linha do registro de envio publica UUID, código de cobrança e destinatário vazio', () => {
  /** Os dois enums do registro, escritos por extenso — a ordem é a que o enum do banco guarda. */
  const CAMINHOS_DECLARADOS = ['AUTOMATICO', 'MANUAL'] as const;
  const DESFECHOS_DECLARADOS = ['ENVIADA', 'FALHOU', 'SEM_DESTINATARIO'] as const;

  /** Uma tentativa entregue, como a rota do histórico a devolve (tech spec §4.1.1). */
  const ENVIO_PUBLICADO = {
    id: '7c9e0000-0000-4000-8000-000000000042',
    cobrancaCodigo: 'COB-2026-0000059',
    criadoEm: '2026-03-10T11:05:00.000Z',
    caminho: 'AUTOMATICO',
    desfecho: 'ENVIADA',
    destinatario: 'ana@exemplo.com.br',
    causa: null,
  } as const;

  it('os dois enums do registro publicam exatamente os rótulos declarados, e estão congelados', () => {
    expect([[...CAMINHOS_DO_AVISO], [...DESFECHOS_DO_AVISO]]).toEqual([
      [...CAMINHOS_DECLARADOS],
      [...DESFECHOS_DECLARADOS],
    ]);
    // Congelados em EXECUÇÃO: os dois arranjos são exportados por referência, e um `push` de
    // consumidor alargaria a união para o processo inteiro — inclusive para o enum que a T3 deriva.
    expect([Object.isFrozen(CAMINHOS_DO_AVISO), Object.isFrozen(DESFECHOS_DO_AVISO)]).toEqual([
      true,
      true,
    ]);
  });

  it('aprova a tentativa entregue devolvendo o recurso verbatim', () => {
    const resultado = esquemaDoEnvioDeCobranca.safeParse(ENVIO_PUBLICADO);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toStrictEqual({ ...ENVIO_PUBLICADO });
  });

  it('aprova a tentativa SEM destinatário — cadeia vazia com causa preenchida (RD-11)', () => {
    const semDestinatario = {
      ...ENVIO_PUBLICADO,
      desfecho: 'SEM_DESTINATARIO',
      destinatario: '',
      causa: 'o locatário não tem endereço de e-mail cadastrado',
    };

    const resultado = esquemaDoEnvioDeCobranca.safeParse(semDestinatario);

    // Sem esta linha o esquema poderia exigir `z.email()` ou `min(1)`, e a linha do registro seria
    // impublicável justamente no caso que ela existe para registrar: a rota do histórico levantaria
    // na serialização por causa de um cadastro incompleto.
    expect(resultado.success).toBe(true);
    expect(resultado.data).toStrictEqual(semDestinatario);
  });

  it('canoniza a caixa do código — a prova de que o esquema importado é quem confere', () => {
    const resultado = esquemaDoEnvioDeCobranca.safeParse({
      ...ENVIO_PUBLICADO,
      cobrancaCodigo: '  cob-2026-0000059  ',
    });

    // `trim` + maiúsculas só existem em `ESQUEMA_DO_CODIGO_DE_COBRANCA`. Um `z.string()` redigitado
    // aqui devolveria o valor cru, e a comparação com o que o banco guarda responderia `false` sobre
    // a mesma cobrança.
    expect(resultado.success).toBe(true);
    expect(resultado.data?.cobrancaCodigo).toBe('COB-2026-0000059');
  });

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    { rotulo: 'um id que não é UUID', remendo: { id: 'COB-2026-0000059' }, campo: 'id' },
    // Cinco dígitos é a largura da série do CONTRATO, e é a harmonização tentadora de quem lê os dois
    // arquivos lado a lado. Ela precisa ser recusada aqui também: sem esta linha, `cobrancaCodigo`
    // poderia ter virado `z.string()` sem que nada acusasse.
    {
      rotulo: 'um código na largura da série do contrato',
      remendo: { cobrancaCodigo: 'COB-2026-00059' },
      campo: 'cobrancaCodigo',
    },
    {
      rotulo: 'um instante que não é ISO',
      remendo: { criadoEm: '2026-03-10 11:05:00' },
      campo: 'criadoEm',
    },
    { rotulo: 'um caminho fora da união', remendo: { caminho: 'AGENDADO' }, campo: 'caminho' },
    { rotulo: 'um desfecho fora da união', remendo: { desfecho: 'PENDENTE' }, campo: 'desfecho' },
    {
      rotulo: 'um destinatário nulo — a ausência é cadeia vazia, nunca null',
      remendo: { destinatario: null },
      campo: 'destinatario',
    },
  ];

  for (const { rotulo, remendo, campo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDoEnvioDeCobranca.safeParse({ ...ENVIO_PUBLICADO, ...remendo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  it('os dois esquemas de SAÍDA são abertos, e o de ENTRADA é fechado', () => {
    // A assimetria da ADR-0016: `strictObject` emitiria `additionalProperties: false` no documento
    // publicado, e um cliente gerado passaria a recusar campo acrescentado no futuro NESTAS rotas,
    // enquanto tolera o mesmo acréscimo em todas as outras.
    const politica = esquemaDaPoliticaDeAviso.safeParse({
      ...CORPO_DA_POLITICA_DE_AVISO,
      [CHAVE_EXTRA]: 'x',
    });
    const envio = esquemaDoEnvioDeCobranca.safeParse({ ...ENVIO_PUBLICADO, [CHAVE_EXTRA]: 'x' });

    expect([politica.success, envio.success]).toEqual([true, true]);
    // O campo desconhecido é descartado, e não ecoado: a saída publica o que o contrato declara.
    expect(politica.data).toStrictEqual({ ...CORPO_DA_POLITICA_DE_AVISO });
    expect(envio.data).toStrictEqual({ ...ENVIO_PUBLICADO });

    // A outra metade da assimetria, sem a qual "aberto" seria indistinguível de "aberto em tudo": a
    // MESMA chave, no esquema de ENTRADA, é recusada.
    const entrada = esquemaDaPoliticaDeAvisoNova.safeParse({
      ...CORPO_DA_POLITICA_DE_AVISO,
      [CHAVE_EXTRA]: 'x',
    });

    expect(entrada.success).toBe(false);
    expect(entrada.error?.issues[0]?.code).toBe('unrecognized_keys');
  });
});

describe('CT-605 — o esquema recusa canal não implementado, campo ausente, faixa estourada e chave extra', () => {
  /**
   * O conjunto de canais, escrito **por extenso** — e a única coisa deste caso que é literal.
   *
   * Os corpos recusados abaixo não derivam da constante, de propósito: um canal acrescentado a
   * `CANAIS_DE_AVISO` faria as duas pontas andarem juntas e o caso seguiria verde. Este literal é o
   * que torna a solidão do enum uma **decisão**, e não um valor que o teste descobre a cada rodada.
   * Mesmo desenho de `TETO_DECLARADO_DA_PAGINA` no CT-338, e pela mesma razão escrita lá.
   */
  const CANAIS_DECLARADOS = ['EMAIL'] as const;

  it('o canal publicado tem exatamente um valor, e ele está congelado', () => {
    expect([...CANAIS_DE_AVISO]).toEqual([...CANAIS_DECLARADOS]);
    expect(Object.isFrozen(CANAIS_DE_AVISO)).toBe(true);
  });

  /**
   * As recusas que nomeiam um campo — canal, ausência, faixa, formato de hora e janela invertida.
   *
   * A tabela do card trazia 14 linhas; ela **cresceu** para 20, e nenhuma saiu: os cinco moldes de
   * hora que o aceite técnico §4 enumera (`8:00`, `08:0`, `24:00`, `08:60`, `08:00:00`), a janela
   * invertida e o inteiro fracionário entraram porque cada um deles é uma cláusula do esquema que,
   * sem a linha correspondente, poderia sumir sem que nada acusasse.
   *
   * O `codigo` de cada linha é asserido junto com o `path` porque os dois discriminam coisas
   * diferentes: o `path` diz **qual campo** foi recusado, e o `codigo` diz **por qual cláusula** — sem
   * ele, trocar `.max(90)` por `.max(9)` continuaria produzindo `too_big` no mesmo campo, mas trocar
   * a faixa inteira por `z.number()` cru também "recusaria" `-1` por outra razão qualquer.
   */
  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly corpo: Record<string, unknown>;
    readonly campo: string;
    readonly codigo: string;
  }[] = [
    {
      rotulo: 'o canal de um provedor que o produto não implementa',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, canal: 'SMS' },
      campo: 'canal',
      codigo: 'invalid_value',
    },
    {
      rotulo: 'outro canal que o produto não implementa',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, canal: 'WHATSAPP' },
      campo: 'canal',
      codigo: 'invalid_value',
    },
    {
      rotulo: 'o canal certo em minúsculas — o enum não canoniza caixa',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, canal: 'email' },
      campo: 'canal',
      codigo: 'invalid_value',
    },
    ...CAMPOS_DA_POLITICA_DE_AVISO.map((campo) => ({
      rotulo: `o corpo sem ${campo} — nunca "preserve o valor atual"`,
      corpo: corpoDaPoliticaSemOCampo(campo),
      campo,
      // O código do campo ausente é `invalid_type` em cinco dos seis, e `invalid_value` em `canal`:
      // medido no zod deste pacote, a união fechada reporta a AUSÊNCIA como valor fora do conjunto,
      // porque `undefined` não é um dos rótulos. O código continua asserido por igualdade — o que
      // muda é qual igualdade, não a força da asserção.
      codigo: campo === 'canal' ? 'invalid_value' : 'invalid_type',
    })),
    {
      rotulo: 'um dia abaixo do piso',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, diasAntesDoVencimento: -1 },
      campo: 'diasAntesDoVencimento',
      codigo: 'too_small',
    },
    {
      rotulo: 'um dia acima do teto',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, diasAntesDoVencimento: 91 },
      campo: 'diasAntesDoVencimento',
      codigo: 'too_big',
    },
    {
      rotulo: 'um dia fracionário — a coluna é integer',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, diasAntesDoVencimento: 10.5 },
      campo: 'diasAntesDoVencimento',
      codigo: 'invalid_type',
    },
    // Zero desligaria a trava que protege a caixa do locatário, e desligar a régua se faz por
    // `ativo`. Sem esta linha, o piso poderia cair para 0 sem que nada acusasse.
    {
      rotulo: 'o intervalo zerado — desligar a trava se faz por `ativo`',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, intervaloMinimoDias: 0 },
      campo: 'intervaloMinimoDias',
      codigo: 'too_small',
    },
    {
      rotulo: 'um intervalo acima do teto',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, intervaloMinimoDias: 91 },
      campo: 'intervaloMinimoDias',
      codigo: 'too_big',
    },
    {
      rotulo: 'a hora vinte e quatro — o dia acaba em 23:59',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaInicio: '24:00' },
      campo: 'janelaInicio',
      codigo: 'invalid_format',
    },
    {
      rotulo: 'a hora sem preenchimento',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaInicio: '8:00' },
      campo: 'janelaInicio',
      codigo: 'invalid_format',
    },
    {
      rotulo: 'o minuto sessenta',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaInicio: '08:60' },
      campo: 'janelaInicio',
      codigo: 'invalid_format',
    },
    {
      rotulo: 'o minuto incompleto',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaFim: '08:0' },
      campo: 'janelaFim',
      codigo: 'invalid_format',
    },
    // A forma que `z.iso.time()` aprovaria, e que o driver devolveria se a projeção do banco não
    // fosse `to_char(coluna, 'HH24:MI')`. É a linha que prende a decisão de NÃO usar `z.iso.time()`.
    {
      rotulo: 'a hora com segundos',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaFim: '08:00:00' },
      campo: 'janelaFim',
      codigo: 'invalid_format',
    },
    // Janela invertida não é "a noite inteira": é engano do cliente, e adivinhar seria pior. A recusa
    // nomeia `janelaFim` porque é o campo que o `refine` aponta.
    {
      rotulo: 'a janela invertida',
      corpo: { ...CORPO_DA_POLITICA_DE_AVISO, janelaInicio: '18:00', janelaFim: '09:00' },
      campo: 'janelaFim',
      codigo: 'custom',
    },
  ];

  for (const { rotulo, corpo, campo, codigo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDaPoliticaDeAvisoNova.safeParse(corpo);

      expect(resultado.success).toBe(false);
      // UMA questão, e uma só. Um horário malformado que produzisse duas — o formato e a comparação
      // da janela — faria a borda reportar o campo da PRIMEIRA, e o cliente ouviria o nome errado.
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
      expect(resultado.error?.issues[0]?.code).toBe(codigo);
    });
  }

  /**
   * As duas recusas por chave desconhecida.
   *
   * Elas ficam fora da tabela acima porque o `path` de `unrecognized_keys` é a **raiz do objeto** —
   * medido no zod deste pacote —, e o nome da chave culpada viaja em `keys`. Asserir os dois é o que
   * distingue "recusado por chave desconhecida" de "recusado por qualquer outra razão".
   */
  const CHAVES_DESCONHECIDAS: readonly { readonly rotulo: string; readonly chave: string }[] = [
    { rotulo: 'um campo inventado pelo cliente', chave: 'remetente' },
    // `empresaId` é recusado pelo `strictObject`, sem uma linha de verificação escrita à mão: a
    // empresa sai da sessão (ADR-0008), e a ausência do campo é o mecanismo.
    { rotulo: 'a empresa proposta pelo corpo', chave: 'empresaId' },
  ];

  for (const { rotulo, chave } of CHAVES_DESCONHECIDAS) {
    it(`recusa ${rotulo} (${chave}) por chave desconhecida`, () => {
      const resultado = esquemaDaPoliticaDeAvisoNova.safeParse({
        ...CORPO_DA_POLITICA_DE_AVISO,
        [chave]: chave === 'empresaId' ? EMPRESA_ALHEIA : 'x',
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]?.path).toEqual([]);
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }
});

describe('CT-731 — o locatário cresce com emailConfirmadoEm, e a pessoa fica intacta', () => {
  /** O locatário como as seis rotas de `/v1/locatarios` o devolvem. */
  const LOCATARIO_PUBLICADO = {
    ...PESSOA_PUBLICADA,
    [CHAVE_DA_CONFIRMACAO]: INSTANTE_DA_CONFIRMACAO,
  };

  it('esquemaDaPessoa declara exatamente os quinze campos de sempre', () => {
    expect(Object.keys(esquemaDaPessoa.shape)).toEqual([...CHAVES_DA_PESSOA]);
  });

  it('esquemaDoLocatario declara os mesmos quinze MAIS emailConfirmadoEm', () => {
    expect(Object.keys(esquemaDoLocatario.shape)).toEqual([
      ...CHAVES_DA_PESSOA,
      CHAVE_DA_CONFIRMACAO,
    ]);
  });

  it('o locatário confirmado publica o instante, e o conjunto de chaves é o dos dezesseis', () => {
    const resultado = esquemaDoLocatario.parse(LOCATARIO_PUBLICADO);

    // Igualdade de CONJUNTO, nos dois lados — nunca "inclui pelo menos". Uma asserção de presença
    // seguiria verde com um campo a mais, que é justamente a regressão de forma que este caso pega.
    expect(Object.keys(resultado).sort()).toEqual(
      [...CHAVES_DA_PESSOA, CHAVE_DA_CONFIRMACAO].sort(),
    );
    expect(resultado.emailConfirmadoEm).toBe(INSTANTE_DA_CONFIRMACAO);
    // Verbatim: o esquema não acrescenta, não remove e não transforma nenhum dos dezesseis.
    expect(resultado).toEqual(LOCATARIO_PUBLICADO);
  });

  it('o locatário ainda não confirmado publica null, e não a AUSÊNCIA do campo', () => {
    const naoConfirmado = { ...PESSOA_PUBLICADA, [CHAVE_DA_CONFIRMACAO]: null };

    const resultado = esquemaDoLocatario.parse(naoConfirmado);

    expect(Object.keys(resultado).sort()).toEqual(
      [...CHAVES_DA_PESSOA, CHAVE_DA_CONFIRMACAO].sort(),
    );
    expect(resultado.emailConfirmadoEm).toBeNull();
  });

  /**
   * O companheiro NEGATIVO do caso (`ct_id: self`), e a metade que o card fixa por extenso.
   *
   * O objeto é o **mesmo** do locatário — o campo vem presente na ENTRADA —, e o esquema da pessoa
   * não o expõe na SAÍDA. É o que impede a entrega do requisito pela forma errada: acrescentar
   * `emailConfirmadoEm` a `esquemaDaPessoa` satisfaria as três asserções positivas acima e
   * publicaria o campo em locador e fiador, que não têm confirmação alguma a afirmar.
   */
  it('o MESMO objeto analisado por esquemaDaPessoa não expõe emailConfirmadoEm', () => {
    const resultado = esquemaDaPessoa.parse(LOCATARIO_PUBLICADO);

    expect(Object.keys(resultado).sort()).toEqual([...CHAVES_DA_PESSOA].sort());
    expect(Object.keys(resultado)).not.toContain(CHAVE_DA_CONFIRMACAO);
    expect(resultado).toEqual(PESSOA_PUBLICADA);
  });

  it('recusa instante malformado nomeando o próprio campo', () => {
    const resultado = esquemaDoLocatario.safeParse({
      ...PESSOA_PUBLICADA,
      [CHAVE_DA_CONFIRMACAO]: '12/08/2026',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);
    expect(resultado.error?.issues[0]?.path).toEqual([CHAVE_DA_CONFIRMACAO]);
    expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
  });
});

describe('CT-731 (b) — o corpo da apresentação do portador fecha o molde do segredo', () => {
  /**
   * O digest do segredo, nas duas grafias — é o que o banco guarda, e é a forma que a rota pública
   * **não** pode confundir com o original.
   *
   * Ele é derivado de verdade, e não escrito à mão, porque o par que discrimina é o comprimento:
   * em hexadecimal são 64 caracteres e o esquema recusa; o **mesmo** digest em base64url são 43 e o
   * esquema aprova, indo morrer na busca do banco. Um molde com piso (`{43,}`) aprovaria os dois.
   */
  const DIGEST_EM_HEXADECIMAL = createHash('sha256')
    .update(SEGREDO_DO_PORTADOR, 'utf8')
    .digest('hex');
  const DIGEST_EM_BASE64URL = createHash('sha256')
    .update(SEGREDO_DO_PORTADOR, 'utf8')
    .digest('base64url');

  it('aprova o segredo bem formado e o devolve verbatim', () => {
    const corpo = { segredo: SEGREDO_DO_PORTADOR };

    const resultado = esquemaDaApresentacaoDoPortador.safeParse(corpo);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(corpo);
  });

  it('aprova a forma de 43 caracteres do digest em base64url — a recusa dele é da busca, não do molde', () => {
    const resultado = esquemaDaApresentacaoDoPortador.safeParse({ segredo: DIGEST_EM_BASE64URL });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ segredo: DIGEST_EM_BASE64URL });
  });

  /**
   * As formas RECUSADAS, todas **vizinhas** da aceita.
   *
   * Um caso que recusasse só `'abc'` ficaria verde com `z.string().min(1)`. O que discrimina o molde
   * declarado é o cerco: 42 e 44 cercam o comprimento exato, o hexadecimal de 64 é o derivado, `+` e
   * `/` são o alfabeto do base64 clássico que o base64url substitui, e o segredo com espaço ou quebra
   * de linha em volta é o que pega a expressão sem âncora.
   */
  const SEGREDOS_RECUSADOS: readonly { readonly rotulo: string; readonly segredo: string }[] = [
    { rotulo: 'a cadeia vazia', segredo: '' },
    { rotulo: 'três caracteres', segredo: 'abc' },
    { rotulo: 'quarenta e dois caracteres', segredo: SEGREDO_DO_PORTADOR.slice(1) },
    { rotulo: 'quarenta e quatro caracteres', segredo: `${SEGREDO_DO_PORTADOR}A` },
    { rotulo: 'o digest em hexadecimal (64)', segredo: DIGEST_EM_HEXADECIMAL },
    {
      rotulo: 'o alfabeto do base64 clássico',
      segredo: `${SEGREDO_DO_PORTADOR.slice(0, 41)}+/`,
    },
    { rotulo: 'o segredo com espaço em volta', segredo: ` ${SEGREDO_DO_PORTADOR} ` },
    { rotulo: 'o segredo com quebra de linha ao fim', segredo: `${SEGREDO_DO_PORTADOR}\n` },
  ];

  for (const { rotulo, segredo } of SEGREDOS_RECUSADOS) {
    it(`recusa ${rotulo} nomeando segredo`, () => {
      const resultado = esquemaDaApresentacaoDoPortador.safeParse({ segredo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.path).toEqual(['segredo']);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
    });
  }

  /**
   * As duas recusas por chave desconhecida, com o segredo VÁLIDO ao lado.
   *
   * O CT-337 já varre `empresaId` sobre a tabela inteira dos esquemas de entrada — este esquema
   * inclusive, desde que entrou nela. O caso permanece aqui porque nomeia a rota em que a propriedade
   * decide o isolamento: é a única sem sessão do produto, e o contexto de empresa tem de sair do
   * registro que o portador resolve (ADR-0027), nunca do corpo. A varredura prova a regra geral; esta
   * é a linha que reprova nomeando o ponto onde ela custa caro.
   */
  const CHAVES_RECUSADAS: readonly { readonly chave: string; readonly valor: string }[] = [
    { chave: CHAVE_EXTRA, valor: 'x' },
    { chave: 'empresaId', valor: EMPRESA_ALHEIA },
  ];

  for (const { chave, valor } of CHAVES_RECUSADAS) {
    it(`recusa ${chave} por chave desconhecida, mesmo com o segredo válido`, () => {
      const resultado = esquemaDaApresentacaoDoPortador.safeParse({
        segredo: SEGREDO_DO_PORTADOR,
        [chave]: valor,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]?.path).toEqual([]);
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }
});

describe('CT-731 (c) — as duas respostas da confirmação afirmam só o que já aconteceu', () => {
  /** O corpo do `202` do reenvio — os dois instantes, e nada mais. */
  const REENVIO_PUBLICADO = {
    reenviadoEm: INSTANTE_DA_CONFIRMACAO,
    expiraEm: '2026-08-15T10:00:00.000Z',
  } as const;

  it('a confirmação aprova { confirmado: true } e o devolve verbatim', () => {
    const resultado = esquemaDaConfirmacao.safeParse({ confirmado: true });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ confirmado: true });
  });

  /**
   * O eixo que **nenhuma camada acima alcança**: `z.literal(true)` e `z.boolean()` produzem a mesma
   * resposta no caminho feliz, e a prova por rota (CT-721, T11) é cega para a diferença. Não existe
   * `{ confirmado: false }` nesta superfície — quem não confirma recebe o `404` indistinguível.
   */
  it('a confirmação RECUSA { confirmado: false } — a rota não publica esse estado', () => {
    const resultado = esquemaDaConfirmacao.safeParse({ confirmado: false });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);
    expect(resultado.error?.issues[0]?.path).toEqual(['confirmado']);
    expect(resultado.error?.issues[0]?.code).toBe('invalid_value');
    expect(resultado.error?.issues[0]).toMatchObject({ values: [true] });
  });

  it('o reenvio declara EXATAMENTE reenviadoEm e expiraEm, e nenhuma chave de desfecho', () => {
    expect(Object.keys(esquemaDoReenvioDeConfirmacao.shape)).toEqual(['reenviadoEm', 'expiraEm']);
  });

  it('o reenvio aprova os dois instantes e os devolve verbatim', () => {
    const resultado = esquemaDoReenvioDeConfirmacao.safeParse(REENVIO_PUBLICADO);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(REENVIO_PUBLICADO);
  });

  /**
   * A estritude das duas respostas é a decisão, e não a convenção do pacote — ver o cabeçalho de
   * `src/confirmacao-de-email.ts`. `desfecho` é a chave que a borda **não** pode afirmar: a entrega
   * corre fora da requisição (ADR-0029), e publicá-la seria o `202` mentindo sobre o que sabe.
   */
  const RESPOSTAS_FECHADAS: readonly {
    readonly rotulo: string;
    readonly esquema: z.ZodObject;
    readonly corpo: Record<string, unknown>;
    readonly chave: string;
  }[] = [
    {
      rotulo: 'a confirmação',
      esquema: esquemaDaConfirmacao,
      corpo: { confirmado: true },
      chave: CHAVE_EXTRA,
    },
    {
      rotulo: 'o reenvio',
      esquema: esquemaDoReenvioDeConfirmacao,
      corpo: { ...REENVIO_PUBLICADO },
      chave: 'desfecho',
    },
  ];

  for (const { rotulo, esquema, corpo, chave } of RESPOSTAS_FECHADAS) {
    it(`${rotulo} recusa a chave ${chave} por chave desconhecida`, () => {
      const resultado = esquema.safeParse({ ...corpo, [chave]: 'ENVIADA' });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }
});

// ===========================================================================
// CT-713 — a chave removida: `pdfContratoArquivo` sai da ENTRADA e da SAÍDA
// ===========================================================================
//
// Este caso é a ponta de CONTRATO PUBLICADO da única mudança incompatível deliberada do produto
// (CA-07, ADR-0030). Ele tem dois irmãos, e os três não se substituem porque medem superfícies
// diferentes: o `CT-712` mede o **catálogo do banco** por introspecção, o `CT-714` (T7) mede a
// **resposta real da rota** por `Object.keys`, e este mede o **esquema**, que é a fonte de que os
// dois documentos publicados derivam (ADR-0016).
//
// As duas metades abaixo são o par CRESCIMENTO × RECUSA, e nenhuma serve sozinha:
//
//   * a metade da ENTRADA é comportamental — o corpo que traz a chave é RECUSADO, com o código
//     `unrecognized_keys` NOMEANDO o campo. Sem ela, um esquema que voltasse a aceitar a chave e a
//     ignorasse em silêncio passaria, e o cliente que ainda envia o campo continuaria achando que
//     ele foi gravado;
//   * a metade da SAÍDA é declarativa — a chave não está no `shape`. Sem ela, a saída poderia voltar
//     a declarar um campo que nenhuma coluna alimenta, e a asserção de entrada nada diria.
//
// A entrada canônica **não é remendada** aqui: `CORPO_DE_CONTRATO` já perdeu a chave, de modo que o
// caso positivo do CT-424 (b) e este negativo leem a mesma fonte. Se alguém reintroduzir o campo no
// esquema de entrada, a primeira metade fica vermelha; se reintroduzir só na saída, a segunda.
describe('CT-713 — o contrato publicado não aceita nem devolve pdfContratoArquivo', () => {
  /**
   * O valor com que o legado povoava a coluna — o caminho de um arquivo no `/opt/frappe`.
   *
   * Ele é o valor do card do caso, e não um texto qualquer: o corpo que um cliente do sistema antigo
   * ainda enviaria é exatamente este, e é ele que precisa ser recusado com o campo nomeado.
   */
  const CAMINHO_DO_LEGADO = '/frappe/private/files/contrato.pdf';

  it('a ENTRADA recusa a chave, nomeando-a como desconhecida', () => {
    const resultado = esquemaDeContratoNovo.safeParse({
      ...CORPO_DE_CONTRATO,
      pdfContratoArquivo: CAMINHO_DO_LEGADO,
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);
    expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
    expect(resultado.error?.issues[0]).toMatchObject({ keys: ['pdfContratoArquivo'] });
  });

  it('o companheiro POSITIVO: o MESMO corpo, sem a chave, é aprovado verbatim', () => {
    // Sem esta metade, a recusa acima ficaria verde também sobre um esquema que recusasse tudo — e
    // o caso deixaria de discriminar a chave removida de um corpo simplesmente inválido.
    const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CORPO_DE_CONTRATO });
  });

  it('a SAÍDA não declara a chave, e continua declarando as catorze que restaram', () => {
    // Igualdade de conjunto, e não `not.toContain`: a segunda ficaria verde sobre um esquema que
    // tivesse perdido metade dos campos junto. É o mesmo desenho das listas por igualdade do
    // `catalogo.spec.ts`.
    expect(Object.keys(esquemaDoContrato.shape).sort()).toEqual([
      'codigo',
      'dataFimLocacao',
      'dataInicioLocacao',
      'diaVencimento',
      'fiadores',
      'gerarCobrancasAutomaticamente',
      'imovelId',
      'locadorId',
      'locatarioId',
      'prazoMeses',
      'retiradoEm',
      'status',
      'valorMensal',
      'valorTotalContrato',
    ]);
  });

  it('a SAÍDA aprova o contrato publicado sem a chave, devolvendo-o verbatim', () => {
    const resultado = esquemaDoContrato.safeParse({ ...CONTRATO_PUBLICADO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CONTRATO_PUBLICADO });
  });
});
