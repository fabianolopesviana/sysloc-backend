/**
 * Os esquemas de `@sysloc/contracts` — CT-334 a CT-338, CT-340, CT-341, mais CT-424 e CT-428, que a
 * fatia `contratos-de-locacao` acrescenta, CT-537 mais CT-540 a CT-545, que a fatia
 * `cobranca-e-mora` acrescenta, CT-604 e CT-605, que a fatia `regua-de-cobranca` acrescenta, e
 * CT-713 e CT-731, que a sub-fatia `documentos-e-confirmacao` acrescenta, CT-845 a CT-850, que a
 * fatia `fundacao-bancaria` acrescenta, e CT-942 e CT-953, que a fatia `emissao-e-conciliacao`
 * acrescenta. O
 * **CT-537 substitui o CT-429** daquela fatia: ver o parágrafo dedicado abaixo, e a linha
 * `SUT_IS_CORRECT_BECAUSE:` no ponto do caso.
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
 * | §4.9     | CT-544 | `esquemaDaCobranca` declara exatamente os **23** campos publicados, na ordem,
 * |          |        | não declara `id` e descarta o `id` que chegue de fora; nenhuma chave dele fala
 * |          |        | o vocabulário do provedor (`nossoNumero` e os três irmãos), e
 * |          |        | `identificadorNoProvedor` permanece interno; os cinco campos de conciliação
 * |          |        | aceitam o boleto emitido devolvendo os valores intactos e RECUSAM as formas
 * |          |        | vizinhas (instante em `dataDoCredito`, texto em `valorCreditado`); e as
 * |          |        | grandezas monetárias de saída não carregam escala, aprovando o resíduo de
 * |          |        | ponto flutuante que a escala de entrada RECUSA. |
 * | §4.10    | CT-545 | Em `packages/contracts/src/` existe exatamente uma declaração exportada de
 * |          |        | `MAIOR_VALOR_MONETARIO` e uma de `ESCALA_MONETARIA`, ambas em **`comum.ts`**;
 * |          |        | `cobranca.ts` **e** `contrato.ts` as obtêm por `import … from './comum.js'` e
 * |          |        | não redeclaram nenhuma das duas, sob `export` ou sem ele. |
 * | CA-15    | CT-942 | A **direção** decide a estritude: `esquemaDaCompetencia` é `strictObject` e
 * |          |        | recusa `empresaId` com `code === 'unrecognized_keys'` e `keys` igual a
 * |          |        | `['empresaId']`, enquanto os SEIS esquemas de SAÍDA da fatia aceitam a MESMA
 * |          |        | chave e a **descartam**. A competência só é aceita no primeiro dia do mês, de
 * |          |        | qualquer mês, e toda forma vizinha é recusada nomeando `competencia`; e o item
 * |          |        | do lote nomeia a cobrança pelo `ESQUEMA_DO_CODIGO_DE_COBRANCA` importado, que
 * |          |        | canoniza a caixa e mantém a largura de sete dígitos. |
 * | CA-15    | CT-942 | Os quatro enums da fatia publicam exatamente 6, 2, 3 e 2 rótulos, **nesta
 * |          | (b)    | ordem**, e nenhum consumidor os alarga em execução — a mutação lança
 * |          |        | `TypeError` e o conteúdo permanece idêntico. **Não existe tipo de evento
 * |          |        | `CONFERENCIA`**: o rótulo é recusado em `tipo` nomeando o campo e aceito em
 * |          |        | `origem` (ADR-0034 · §21.1(2)). O lote publica o estado derivado ao lado dos
 * |          |        | dois instantes de desfecho e recusa contagem fracionária ou negativa; a
 * |          |        | conferência publica `iniciadaAgora: false` com os dois contadores distintos. |
 * | CA-13    | CT-953 | O envelope do histórico bancário tem **uma** declaração, e ela vive no
 * |          |        | pacote: `esquemaDaTrilhaDaCobranca.shape` publica exatamente `['itens']` —
 * |          |        | nem `total`, nem `limite`, nem `deslocamento` —, e o item dele **é**
 * |          |        | `esquemaDoEventoBancario` por identidade, nunca uma cópia dos cinco campos. |
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
 * | CA-14    | CT-845 | `MEIOS_DE_RECEBIMENTO` é exatamente `['BOLETO','PIX']` e
 * | CA-04    |        | `ESTADOS_DO_CERTIFICADO` exatamente `['VIGENTE','VENCENDO','VENCIDO']`, nesta
 * |          |        | ordem, e **nenhum consumidor consegue alargar qualquer um dos dois em
 * |          |        | execução** — a mutação lança `TypeError` e o conteúdo permanece idêntico. Os
 * |          |        | três estados declarados são aprovados pela projeção devolvendo o recurso
 * |          |        | verbatim, e os quatro vizinhos recusados nomeiam `estado`. |
 * | §4.1.1   | CT-846 | `esquemaDoCertificadoNovo` declara exatamente `['material','senha']`, aprova o
 * |          |        | corpo completo devolvendo-o verbatim, e ausência de campo **nunca** significa
 * |          |        | "preserve o valor atual" — o campo omitido é NOMEADO na recusa, e cada uma
 * |          |        | das seis chaves decididas pelo servidor (`empresaId` entre elas) reprova com
 * |          |        | `unrecognized_keys` nomeando a chave ofensora. |
 * | CA-02    | CT-847 | O teto declarado é aprovado e o teto + 1 é recusado nomeando o próprio campo,
 * | CA-12    |        | para `material` (`too_big` sobre cadeia base64 LEGAL de teto+4) e para `senha`;
 * |          |        | as constantes valem 32768 e 128; e **nenhuma recusa carrega o valor
 * |          |        | recebido** — medido sobre o erro inteiro serializado. |
 * | CA-02    | CT-848 | `esquemaDoCertificado` declara exatamente os NOVE campos publicados na ordem
 * | CA-12    |        | da §4.1.1 e `esquemaDoResultadoDaVerificacao` exatamente
 * |          |        | `['aceito','verificadoEm','detalhe']`, com `detalhe` **anulável** nos dois
 * |          |        | desfechos; nenhuma das duas — **nem `registradoPor`** — declara chave de
 * |          |        | segredo, e o objeto que traga uma é recusado nomeando-a, sem ecoar o valor. |
 * | CA-12    | CT-848 | `detalhe` é **união fechada** sobre os CINCO desfechos de
 * |          | (b)    | `DETALHES_DA_VERIFICACAO`, congelada em execução: texto fora do conjunto —
 * |          |        | detrito de runtime, termo do provedor, redação plausível, ou o texto
 * |          |        | canônico com espaço à direita — é recusado com `invalid_value` nomeando o
 * |          |        | campo. É o fecho estrutural do débito **D27 · F4/T8** no lado publicado. |
 * | CA-10    | CT-849 | `ESQUEMA_DO_IDENTIFICADOR_BANCARIO` aprova exatamente as cadeias de 18
 * |          |        | caracteres, todas dígitos, devolvendo a cadeia idêntica, e recusa 17, 19,
 * |          |        | não-dígito, espaço em volta e vazio com `invalid_format` — a largura é
 * |          |        | fechada dos DOIS lados, e as larguras **publicadas** valem 6 e 12 por
 * |          |        | igualdade campo a campo, além de somarem 18. A igualdade campo a campo é o
 * |          |        | que discrimina: `4 + 14` também soma 18 e passaria pela expressão inteira,
 * |          |        | e é o consumidor de `@sysloc/db` que preencheria à esquerda errado. |
 * | §4.2     | CT-850 | Existe **exatamente uma** declaração exportada de
 * | CA-04    |        | `LIMIAR_DE_VENCIMENTO_EM_DIAS` em todo o código de produção varrido, ela mora
 * |          |        | em `packages/contracts/src/integracao-bancaria.ts` e vale **30**; nenhum
 * |          |        | outro arquivo LIGA o nome, nem sem `export`; e nenhum diretório varrido está
 * |          |        | ausente fora da lista declarada de inexistentes. |
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
 * `CA-07 → CT-713 (RN-01)` · `CA-14, CA-04 → CT-845 (RN-04, RN-11)` ·
 * `CA-§4.1.1 → CT-846 (RN-02, RN-03)` · `CA-02, CA-12 → CT-847, CT-848 (RN-02)` ·
 * `CA-10 → CT-849 (RN-07)` · `CA-04, CA-§4.2 → CT-850 (RN-04)` ·
 * `CA-15 → CT-942, CT-942 (b) (RN-13, RN-14, RN-15)` · `CA-13 → CT-953`.
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
 * salvo no CT-545 e no CT-850, que são `filesystem`. As demais asserções são comportamentais —
 * exercitam o esquema e observam o desfecho —, e por isso não exigem prova de falsificação.
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
 * **A prova foi REFEITA em 2026-08-16**, porque a T1 da fatia `emissao-e-conciliacao` mudou a forma
 * do caso: o dono das duas constantes passou a ser `src/comum.ts`, e os consumidores passaram a ser
 * **dois** (`cobranca.ts` e `contrato.ts`), importando de `'./comum.js'`. Uma asserção estática que
 * muda de forma precisa de prova nova — a antiga provava o alvo antigo. Os dois mutantes rodaram pelo
 * SCRIPT do pacote (`pnpm --filter @sysloc/contracts test`), e a reversão foi conferida por
 * `sha256sum` idêntico ao estado pré-mutante, com o controle de volta a `389 passed`.
 *
 * - **Mutante 1' — a segunda definição exportada**: `export const ESCALA_MONETARIA = 0.01;`
 *   acrescentado a `src/cobranca-bancaria.ts`, que é um **terceiro** arquivo e a forma exata do débito
 *   que a promoção fechou. Resultado: `1 failed | 388 passed`, com `arquivosQueDeclaram` igual a
 *   `['src/cobranca-bancaria.ts', 'src/comum.ts']` — a falha **nomeia o arquivo culpado**. O caso de
 *   `MAIOR_VALOR_MONETARIO` seguiu verde, que é o que prova a varredura ser por nome e não por
 *   coincidência.
 *   ⚠️ Note que o mutante do parágrafo anterior (2026-08-11) usava `src/comum.ts` como terceiro
 *   arquivo. Ele **deixou de servir**: `comum.ts` é agora o dono, e acrescentar a declaração lá seria
 *   escrevê-la onde ela já está. É por isso que a prova precisou de alvo novo.
 * - **Mutante 2' — a redeclaração LOCAL, sem `export`**: em `src/cobranca.ts`, os dois nomes saem do
 *   `import … from './comum.js'` e entram como `const` local. Resultado: `1 failed | 388 passed`, com
 *   `monetariasImportadas` vazio e `redeclaracoes` com os dois nomes, numa asserção só. Os dois casos
 *   da declaração exportada seguiram **verdes** — sem `export`, a redeclaração não aparece na
 *   varredura deles —, e é isso que prova as duas metades serem carregadas, e não redundantes.
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
 *
 * ---------------------------------------------------------------------------
 * CT-845 a CT-850 — por que cada um vem em par, e nenhuma metade serve sozinha
 * ---------------------------------------------------------------------------
 *
 * **CT-845.** `MEIOS_DE_RECEBIMENTO` **não entra em esquema nenhum** desta fatia — o pix é declarado
 * sem operação (RN-11) —, de modo que o eixo comportamental dela é o **congelamento em execução**, e
 * não uma recusa de parse. É a metade que sobrevive ao build: o `as const` fecha a união em
 * compilação e o consumidor do pacote compilado recebe um arranjo comum. A reafirmação do conteúdo
 * **depois** do `push` recusado é a terceira ponta — "lançou" e "não alterou" são propriedades
 * diferentes. Este caso **não substitui o CT-835** (T8), que prova a lista de operações sobre `PIX`
 * vazia: ali a pergunta é o que o **domínio** faz; aqui, o que o **contrato declara**.
 *
 * **CT-846.** A tabela de **ausência** é o que distingue *"fechado e obrigatório"* de *"fechado e
 * opcional"*: um `.optional()` acrescentado a qualquer dos dois campos passaria por **toda a suíte da
 * borda** — o serviço simplesmente receberia `undefined` — sem uma recusa sequer. `empresaId` entra
 * na lista dos recusados porque é a chave cujo vazamento **cruzaria empresa**.
 *
 * **CT-847.** O excesso do material é **um bloco** (teto+4), e não teto+1, de propósito: base64 canônico tem
 * comprimento múltiplo de quatro, e 8193 seria recusado tanto pelo teto **quanto pela forma** — a
 * recusa passaria com um esquema que não tivesse teto nenhum. **O `code === 'too_big'` é o
 * discriminador.** Os dois tetos são escritos por extenso pela razão do CT-543: derivá-los das
 * constantes faria as duas pontas andarem juntas. Este caso não substitui o CT-830 (T13), que mede o
 * mesmo não-eco na **saída HTTP real**.
 *
 * **CT-848.** As duas metades são **indivisíveis**, e é o par que detecta: a declarativa não
 * distingue *"não declarado"* de *"declarado e ignorado na leitura"*; a comportamental não distingue
 * *"recusado"* de *"nunca chegou"*. E o `detalhe: null` é o **único eixo do produto que nenhuma outra
 * camada exercita** — a borda preenche `detalhe` nos dois desfechos hoje, e sem esta linha o
 * `nullable()` poderia cair sem uma recusa, com a fatia (ii) descobrindo isso em produção.
 *
 * **CT-849.** O 17 e o 19 são as duas pontas exatas porque o defeito plausível é o preenchimento à
 * esquerda errado **por uma posição** — um `{18,}` ou um `{17,19}` na expressão passaria por qualquer
 * asserção que só aprovasse a forma canônica. `'000000000000000000'` entra de propósito entre os
 * aceitos: o esquema **não** valida a semântica do mês, e escrever esse aceito impede que alguém
 * aperte o esquema com uma validação que a spec não pede. Ele complementa o **CT-804** (T6) sem
 * duplicá-lo: lá o SUT é a **composição** em `packages/db`; aqui é o **reconhecimento** no contrato.
 *
 * ---------------------------------------------------------------------------
 * CT-850 é ESTÁTICO — a prova de falsificação, medida (2026-08-14)
 * ---------------------------------------------------------------------------
 *
 * Ele inspeciona o **texto** do fonte, e por isso a prova é OBRIGATÓRIA
 * (`.claude/rules/testing-stack.md`). Os dois mutantes foram aplicados ao fonte de produção, medidos
 * e revertidos, e os dois rodaram pelo SCRIPT do pacote — `pnpm --filter @sysloc/contracts test` —, e
 * não por `vitest run` avulso. O controle antes e depois é `356 passed`, e a reversão foi conferida
 * por `sha256sum` idêntico ao estado pré-mutante.
 *
 * - **Mutante 1 — a segunda definição exportada do mesmo fato**:
 *   `export const LIMIAR_DE_VENCIMENTO_EM_DIAS = 30;` acrescentado a
 *   `packages/db/src/derivacao-de-cobranca.ts` — um **terceiro** arquivo, que é a forma exata do
 *   débito **D14**. Resultado: `2 failed | 354 passed`, e as duas falhas **nomeiam o arquivo
 *   culpado** (`+ "packages/db/src/derivacao-de-cobranca.ts"`).
 * - **Mutante 2 — a redeclaração LOCAL, sem `export`**: o mesmo nome ligado por `const` sem `export`
 *   no mesmo arquivo. Resultado: `1 failed | 355 passed` — reprova **só** a metade que varre qualquer
 *   ligação, e o caso da declaração exportada segue **verde**. É exatamente isso que prova as duas
 *   metades serem carregadas, e não redundantes. ⚠️ O card manda aplicá-lo *"no arquivo que deriva o
 *   estado"*, que só nasce na **T2**; a forma fiel disponível hoje é a redeclaração local em qualquer
 *   arquivo de produção varrido, e é a que foi medida.
 *
 * A varredura sai do fonte **sem comentários**, o que impede o modo de falha literal da rule —
 * asserção que casa o alvo dentro de um comentário reprova código correto — e permite que um futuro
 * marcador de débito cite o nome em prosa sem derrubar o caso.
 *
 * ---------------------------------------------------------------------------
 * QUATRO MUTANTES COMPORTAMENTAIS — MT-T1-A/B/C/D (2026-08-14)
 * ---------------------------------------------------------------------------
 *
 * As asserções de CT-845 a CT-849 são **comportamentais** e por isso não exigiriam a prova; os
 * mutantes foram medidos assim mesmo, porque cada um deles é uma decisão registrada por extenso no
 * cabeçalho de `src/integracao-bancaria.ts`, e decisão sem rede é o que a rodada seguinte reabre. Os
 * quatro rodaram pelo **script do pacote** e foram revertidos com `sha256sum` idêntico ao estado
 * pré-mutante, com o controle de volta a `356 passed`.
 *
 * - **MT-T1-A — o congelamento que só existe em compilação**: `Object.freeze` sai de
 *   `MEIOS_DE_RECEBIMENTO`. Resultado: `1 failed | 355 passed` — reprova só a linha do congelamento,
 *   e as asserções de igualdade e ordem seguem verdes. É a medida de que o `as const` sozinho não
 *   fecha o alargamento em execução.
 * - **MT-T1-B — o teto que some**: `z.base64().max(MAIOR_MATERIAL_CODIFICADO)` vira `z.base64()`.
 *   Resultado: `2 failed | 354 passed` — reprovam a recusa por `too_big` e a varredura de não-eco
 *   daquela linha. O material fora do alfabeto segue recusado, que é o que torna o par necessário.
 * - **MT-T1-C — a saída que readmite o segredo**: `esquemaDoCertificado` vira `z.object`. Resultado:
 *   `2 failed | 354 passed` — reprovam as duas variantes que trazem `material` e `senha` de volta.
 * - **MT-T1-D — o detalhe que deixa de ser anulável**: `z.string().nullable()` vira `z.string()`.
 *   Resultado: `2 failed | 354 passed` — reprovam os dois desfechos com `detalhe: null`, e nenhuma
 *   outra asserção do pacote os alcança.
 *
 * ---------------------------------------------------------------------------
 * CT-942 — por que ele vem em par, e por que nenhuma metade serve sozinha
 * ---------------------------------------------------------------------------
 *
 * **O eixo é a DIREÇÃO, e por isso as duas metades usam a MESMA chave.** `empresaId` é recusado por
 * `esquemaDaCompetencia` e **aceito e descartado** por **todos** os esquemas de saída da fatia — os
 * que {@link SAIDAS_DA_FATIA} enumera, e a tabela é a fonte. Uma metade
 * sozinha não prova nada sobre a direção: só a recusa ficaria verde num pacote inteiramente estrito —
 * o que derrubaria a rota no primeiro campo novo que a view acrescentasse (razão (1) do
 * `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`) —, e só a aceitação ficaria verde num pacote inteiramente
 * aberto, em que `empresaId` entraria pelo corpo do cliente sem uma recusa sequer. A asserção da
 * recusa é por `code` **e** por `keys`, como a `.claude/rules/contrato-publicado.md` exige
 * literalmente: o booleano sozinho aprovaria qualquer falha de esquema.
 *
 * A linha `expect(resultado.data).toEqual(recurso)` do lado da saída é a terceira ponta: *aceitar* e
 * *não ecoar* são propriedades diferentes, e um `z.looseObject` satisfaz a primeira publicando ao
 * consumidor o `empresaId` que acabou de chegar de fora.
 *
 * **A metade de ENTRADA se sobrepõe ao CT-337 de propósito, e a justificativa é esta** (AP-26,
 * `semantically_duplicated_test`, apontado pelo Gate 1 na rodada 1): `esquemaDaCompetencia` entrou em
 * `ESQUEMAS_DE_ENTRADA` — a âncora de contagem subiu de 16 para 17, com o corpo válido em
 * `CORPOS_VALIDOS` —, de modo que o CT-337 **já gera por tabela** a recusa de `empresaId` nomeando a
 * chave para este mesmo esquema. O que ele **não** alcança é o eixo deste caso: o CT-337 varre um lado
 * só, e *direção* é uma comparação entre dois lados. Sem a metade de entrada aqui, sobraria a
 * afirmação de que as cinco saídas são abertas — compatível com um pacote inteiramente aberto, que é
 * exatamente a leitura que o par existe para excluir. **A metade não se remove**: ela é o outro braço
 * da comparação, e o card §6.6 a exige nominalmente. O que a distingue da cópia inútil é que ela é
 * lida **junto** da metade de saída, no mesmo caso e com a mesma chave.
 *
 * **As competências recusadas são as VIZINHAS**, não as fáceis: o dia 2 e o último dia do mês cercam o
 * primeiro, o dia 10 é o vencimento típico do produto, e o primeiro dia **com hora** é a forma que um
 * `regex` sobre o sufixo aceitaria. O companheiro positivo — o primeiro dia de janeiro, fevereiro e
 * dezembro — é o que impede a "correção" que recusaria tudo.
 *
 * **CINCO MUTANTES EXECUTADOS — MT-T1ii-A/B/C/D/E (2026-08-16).** Dois deles (A e B) são a prova
 * estática obrigatória do CT-545 e estão registrados na seção dele, acima. Os outros três (C, D e E,
 * enumerados logo abaixo) são **comportamentais** e não exigiriam prova; foram medidos assim mesmo,
 * porque cada um protege uma decisão registrada por extenso — a da ADR-0034 foi **escalada ao
 * usuário**. Os cinco rodaram pelo
 * **script do pacote**, nunca por `vitest run` avulso, e foram revertidos com `sha256sum` idêntico ao
 * estado pré-mutante, com o controle de volta a `389 passed`.
 *
 * - **MT-T1ii-C — o sétimo tipo**: `'CONFERENCIA'` acrescentado a `TIPOS_DE_EVENTO_BANCARIO`, que é
 *   exatamente o que a §21.1(2) do tech spec decidiu **não** fazer. Resultado: `3 failed | 386 passed`
 *   — reprovam a igualdade literal do enum, a reafirmação do conteúdo depois do `push` recusado, e o
 *   caso comportamental que exige a recusa do rótulo em `tipo`. É a rede que o P4 do Protocolo
 *   Antirregressão pede de uma decisão escalada.
 * - **MT-T1ii-D — a saída que fecha**: `esquemaDaEmissaoEmLote` vira `z.strictObject`. Resultado:
 *   `1 failed | 388 passed` — reprova **só** a linha da saída aberta daquele esquema, e as quatro
 *   irmãs seguem verdes. É a medida de que a tabela examina um a um, e não o conjunto por amostragem.
 * - **MT-T1ii-E — o refino frouxo**: a conferência do primeiro dia passa a aceitar *qualquer data de
 *   dez caracteres*. Resultado: `3 failed | 386 passed` — reprovam o dia 2, o último dia do mês e o
 *   dia do vencimento. As recusas de **forma** (a data que o calendário não tem, o instante, o mês sem
 *   dia, a cadeia vazia) seguem verdes, porque quem as pega é o `z.iso.date()` — e é justamente essa
 *   separação que torna os três dias necessários.
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  DESFECHOS_DO_ITEM_DO_LOTE,
  DETALHES_DA_VERIFICACAO,
  ESCALA_DA_METRAGEM,
  ESCALA_MONETARIA,
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  ESQUEMA_DO_IDENTIFICADOR_BANCARIO,
  ESTADOS_DA_COBRANCA,
  ESTADOS_DA_EMISSAO_EM_LOTE,
  ESTADOS_DO_CERTIFICADO,
  ESTADOS_DO_CONTRATO,
  ESTADOS_EM_ABERTO,
  esquemaDaApresentacaoDoPortador,
  esquemaDaAtivacaoDeContrato,
  esquemaDaCobranca,
  esquemaDaCompetencia,
  esquemaDaConferenciaBancaria,
  esquemaDaConfirmacao,
  esquemaDaEmissaoEmLote,
  esquemaDaJanela,
  esquemaDaPessoa,
  esquemaDaPoliticaDeAviso,
  esquemaDaPoliticaDeAvisoNova,
  esquemaDaTrilhaDaCobranca,
  esquemaDeCobrancaNova,
  esquemaDeComodoNovo,
  esquemaDeContratoNovo,
  esquemaDeImovelNovo,
  esquemaDePessoaNova,
  esquemaDoCertificado,
  esquemaDoCertificadoNovo,
  esquemaDoContrato,
  esquemaDoEnvioDeCobranca,
  esquemaDoEventoBancario,
  esquemaDoImovel,
  esquemaDoItemDoLote,
  esquemaDoLocatario,
  esquemaDoReenvioDeConfirmacao,
  esquemaDoResultadoDaVerificacao,
  formatarCodigoDeCobranca,
  formatarCodigoDeContrato,
  LARGURA_DA_COMPETENCIA,
  LARGURA_DO_CONTADOR,
  LARGURA_DO_SEQUENCIAL_DE_COBRANCA,
  LARGURA_DO_SEQUENCIAL_DE_CONTRATO,
  LIMIAR_DE_VENCIMENTO_EM_DIAS,
  MAIOR_MATERIAL_CODIFICADO,
  MAIOR_MATERIAL_REAL_OBSERVADO,
  MAIOR_METRAGEM,
  MAIOR_PAGINA,
  MAIOR_PRAZO_EM_MESES,
  MAIOR_SENHA_DO_MATERIAL,
  MAIOR_VALOR_MONETARIO,
  MEIOS_DE_RECEBIMENTO,
  NATUREZAS_DE_COBRANCA,
  ORIGENS_DO_EVENTO_BANCARIO,
  PAGINA_PADRAO,
  PREFIXO_DO_CODIGO_DE_COBRANCA,
  PREFIXO_DO_CODIGO_DE_CONTRATO,
  SITUACOES_INFORMAVEIS,
  TIPOS_DE_EVENTO_BANCARIO,
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
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este objeto que descrevia a cobrança
 * **antes** da T1 da fatia `emissao-e-conciliacao`. `esquemaDaCobranca` passou a publicar os **cinco**
 * campos de conciliação bancária por decisão declarada (§4.2 do tech spec: 18 → 23 campos), e eles
 * entram aqui **nulos** porque a cobrança recém-lançada não tem boleto emitido — que é o mesmo motivo
 * pelo qual os cinco do desfecho já vinham nulos. Nenhuma asserção foi alterada, afrouxada ou
 * removida: o objeto continua sendo o controle positivo que os casos comparam por igualdade inteira, e
 * a variante com boleto emitido vive em {@link COBRANCA_COM_BOLETO}, no CT-544.
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
  numeroDoTituloNoProvedor: null,
  linhaDigitavel: null,
  codigoDeBarras: null,
  dataDoCredito: null,
  valorCreditado: null,
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
 *
 * SUT_IS_CORRECT_BECAUSE: a T1 da fatia `emissao-e-conciliacao` publicou `esquemaDaCompetencia` — o
 * corpo com que o Admin abre a emissão em lote, e o **único** corpo de escrita daquela fatia com
 * campo (as outras três rotas de ato usam o `ESQUEMA_DO_CORPO_VAZIO` da borda). Pelo mesmo motivo dos
 * parágrafos acima ele escaparia às duas varreduras, por começar com `esquemaDa` e não com
 * `esquemaDe`; e ele é o corpo que decide **quais cobranças de qual mês** vão ao provedor, de modo que
 * um corpo aberto ali aceitaria `empresaId` e mandaria emitir boleto da empresa alheia. Nenhum alvo
 * sai daqui; o conjunto só cresce.
 */
const NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO = [
  'esquemaDaApresentacaoDoPortador',
  'esquemaDaCompetencia',
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
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 16 para 17 porque a T1 da fatia `emissao-e-conciliacao` publicou
 * `esquemaDaCompetencia` — o corpo de abertura da emissão em lote, que nasce nesta fonte única pela
 * mesma ADR-0016. Ele entra pela lista de nomes fora do prefixo, logo acima. Vale aqui, palavra por
 * palavra, o parágrafo anterior: o literal é o que impede *"nenhum esquema violou"* de ser
 * indistinguível de *"nenhum esquema foi olhado"*, a âncora **sobe** e segue exata, e nenhum alvo
 * saiu.
 */
const QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA = 17;

/** Um corpo válido por esquema de entrada, indexado pelo nome exportado. */
const CORPOS_VALIDOS = new Map<string, Record<string, unknown>>([
  // O segredo vai declarado por extenso porque é o único campo deste esquema: um corpo que o
  // omitisse seria recusado antes de a varredura medir o que ela existe para medir.
  ['esquemaDaApresentacaoDoPortador', { segredo: SEGREDO_DO_PORTADOR }],
  // A competência vai declarada por extenso e **no primeiro dia do mês**: é o único campo deste
  // esquema, e um corpo que a omitisse — ou que trouxesse outro dia — seria recusado antes de a
  // varredura medir o que ela existe para medir. O mês é o seguinte ao da cobrança canônica de
  // propósito: emitir boleto de competência ainda por vencer é o caso corrente da CA-01.
  ['esquemaDaCompetencia', { competencia: '2026-04-01' }],
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
  /**
   * Os **vinte e três** campos publicados, na ordem declarada (tech spec §4.1.1).
   *
   * SUT_IS_CORRECT_BECAUSE: subiu de 18 para 23 porque a T1 da fatia `emissao-e-conciliacao` publicou
   * os cinco campos de conciliação bancária, por decisão declarada na §4.2 do tech spec — o cabeçalho
   * de `src/cobranca.ts` já registrava que *"só a F4 os publica"*, e esta é aquela F4. A âncora
   * **sobe** e segue exata: continua igualdade de lista com ordem, e um campo que suma daqui reprova
   * como sempre reprovou. Nenhum alvo saiu.
   *
   * A lista é escrita **por extenso**, e não derivada do `shape`: derivá-la poria o artefato sob prova
   * nos dois lados da igualdade, e um campo acrescentado sem decisão passaria despercebido.
   */
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
    'numeroDoTituloNoProvedor',
    'linhaDigitavel',
    'codigoDeBarras',
    'dataDoCredito',
    'valorCreditado',
  ] as const;

  /**
   * A cobrança com **boleto emitido e já creditado** — o outro estado dos cinco campos novos.
   *
   * Sem ela, os cinco entrariam na suíte só como `null`, e um esquema que os declarasse
   * `z.null()` — ou com o tipo errado (`valorCreditado: z.string()`, `dataDoCredito:
   * `z.iso.datetime()`) — atravessaria todos os casos deste arquivo sem uma recusa sequer. É o par que
   * discrimina: o `null` prova a anulabilidade, este prova o **tipo do valor**.
   *
   * Os três textos são os do exemplo da §4.1.1, e `dataDoCredito` é data de calendário (`YYYY-MM-DD`),
   * não instante — trocá-la por ISO-8601 com hora reprova aqui.
   */
  const COBRANCA_COM_BOLETO = {
    ...COBRANCA_PUBLICADA,
    numeroDoTituloNoProvedor: '17000000012',
    linhaDigitavel: '75691.11223 34455.667788 99001.122334 5 99230000012345',
    codigoDeBarras: '75691992300000123451112233445566778899001122',
    dataDoCredito: '2026-03-12',
    valorCreditado: 187.42,
  };

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

  it('o recurso declara exatamente os vinte e três campos, na ordem', () => {
    expect(Object.keys(esquemaDaCobranca.shape)).toEqual([...CAMPOS_PUBLICADOS]);
  });

  it('a chave do identificador do provedor é a do PRODUTO, e nenhuma do provedor entra (ADR-0001)', () => {
    // A lista dos proibidos é escrita por extenso e vem de `TERMOS_DO_PROVEDOR`
    // (`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`): publicar qualquer um deles
    // faria aquela varredura reprovar a própria fatia que a CA-19 mandou entregar. Sem esta linha, um
    // `nossoNumero` no lugar de `numeroDoTituloNoProvedor` passaria por toda a suíte deste pacote — a
    // contagem continuaria 23 e a igualdade acima continuaria verde com a lista "corrigida" junto.
    const CHAVES_DO_PROVEDOR = ['nossoNumero', 'seuNumero', 'numeroContrato', 'codigoBeneficiario'];
    const publicadas = Object.keys(esquemaDaCobranca.shape);

    expect(publicadas.filter((chave) => CHAVES_DO_PROVEDOR.includes(chave))).toEqual([]);
    expect(publicadas).toContain('numeroDoTituloNoProvedor');

    // E o identificador que o PRODUTO compõe permanece interno (§7.2 e §21.1(3) do tech spec): são
    // dois identificadores de sentidos opostos, e publicar o segundo levaria o recurso a 24 campos.
    expect(publicadas).not.toContain('identificadorNoProvedor');
  });

  it('os cinco campos da conciliação aceitam o boleto emitido e devolvem os valores intactos', () => {
    const resultado = esquemaDaCobranca.safeParse(COBRANCA_COM_BOLETO);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(COBRANCA_COM_BOLETO);
  });

  it('a data do crédito é de CALENDÁRIO, e o valor creditado é número — não texto', () => {
    // O par que o caso acima não alcança: ele prova que a forma certa passa, e este prova que as
    // formas vizinhas **não** passam. Sem ele, `dataDoCredito: z.string()` e
    // `valorCreditado: z.string()` — a forma em que o `numeric` chega do driver — seguiriam verdes.
    const comInstante = esquemaDaCobranca.safeParse({
      ...COBRANCA_COM_BOLETO,
      dataDoCredito: '2026-03-12T00:00:00.000Z',
    });
    const comValorEmTexto = esquemaDaCobranca.safeParse({
      ...COBRANCA_COM_BOLETO,
      valorCreditado: '187.42',
    });

    expect(comInstante.success).toBe(false);
    expect(comInstante.error?.issues[0]?.path).toEqual(['dataDoCredito']);
    expect(comValorEmTexto.success).toBe(false);
    expect(comValorEmTexto.error?.issues[0]?.path).toEqual(['valorCreditado']);
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

  /**
   * O arquivo que DEVE ser o dono das duas constantes, e os que DEVEM consumi-las por importação.
   *
   * SUT_IS_CORRECT_BECAUSE: o dono era `src/contrato.ts` e passou a ser `src/comum.ts` porque a T1 da
   * fatia `emissao-e-conciliacao` **promoveu** as duas, fechando o débito `D1 · F3/T2` no gatilho que
   * ele mesmo escrevera — *no terceiro consumidor monetário do pacote*, que é o limiar de três do
   * `CLAUDE.md`. O que este caso prova **não mudou**: continua sendo *existe uma só declaração, e ela
   * está no lugar declarado*. O que mudou é o lugar, e ele é afirmado por igualdade como antes.
   *
   * A troca tem **duas direções**, e as duas se declaram aqui porque só a primeira é ganho:
   *
   *   * **alargou** — a lista de consumidores cresceu de um para dois: `contrato.ts` deixou de ser o
   *     dono e passou a ser consumidor, ao lado de `cobranca.ts`, de modo que a redeclaração local
   *     passou a ser varrida também no arquivo onde as duas nasceram — que é justamente de onde uma
   *     "restauração" as traria de volta;
   *   * **estreitou** — a asserção do import deixou de comparar o **conjunto completo** dos símbolos
   *     vindos de `'./contrato.js'` e passou a comparar um **filtro** sobre as duas monetárias vindas
   *     de `'./comum.js'`. A consequência concreta: a origem de `ESQUEMA_DO_CODIGO_DE_CONTRATO`
   *     **deixou de ser amarrada por igualdade** neste caso. Ela está fora do invariante declarado no
   *     título — que é *as duas constantes monetárias têm definição única* —, e o estreitamento é
   *     deliberado (ver o comentário do filtro, abaixo): amarrar o import inteiro faria um símbolo
   *     vizinho acrescentado a `comum.ts` reprovar um caso que nada tem com ele.
   */
  const DONO_DAS_CONSTANTES = 'src/comum.ts';
  const CONSUMIDORES = ['src/cobranca.ts', 'src/contrato.ts'] as const;

  /** De onde os consumidores DEVEM importá-las, agora que o dono é o módulo comum. */
  const MODULO_DO_DONO = './comum.js';

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

  for (const consumidor of CONSUMIDORES) {
    it(`${consumidor} obtém as duas por importação de '${MODULO_DO_DONO}', e não redeclara nenhuma`, async () => {
      const fonte = semComentarios(await readFile(join(RAIZ_DO_PACOTE, consumidor), 'utf8'));

      const importacao = /import\s*\{([^}]*)\}\s*from\s*'\.\/comum\.js'/.exec(fonte);
      const simbolosImportados = (importacao?.[1] ?? '')
        .split(',')
        .map((simbolo) => simbolo.trim())
        .filter((simbolo) => simbolo.length > 0);

      // Só as duas monetárias entram na igualdade, e não o import inteiro: o que este caso prova é
      // *de onde vêm as duas*, e amarrar a lista completa faria um símbolo vizinho acrescentado a
      // `comum.ts` reprovar um caso que nada tem com ele. O arquivo entra no objeto asserido para que
      // a falha **nomeie o culpado** — trocar o import por redeclaração local esvazia esta lista.
      const monetariasImportadas = CONSTANTES_MONETARIAS.filter((nome) =>
        simbolosImportados.includes(nome),
      );

      // A segunda metade é a que a varredura de declaração exportada não alcança: uma redeclaração
      // **sem `export`** não é declaração exportada, e passaria por ela sem uma ocorrência sequer.
      const redeclaracoes = CONSTANTES_MONETARIAS.filter((nome) =>
        fonte.split('\n').some((linha) => qualquerDeclaracao(nome)(linha)),
      );

      expect({ arquivo: consumidor, monetariasImportadas, redeclaracoes }).toEqual({
        arquivo: consumidor,
        monetariasImportadas: ['MAIOR_VALOR_MONETARIO', 'ESCALA_MONETARIA'],
        redeclaracoes: [],
      });
    });
  }

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

// ---------------------------------------------------------------------------
// CT-845 a CT-850 — o contrato da integração bancária (fatia `fundacao-bancaria`)
// ---------------------------------------------------------------------------

/**
 * A sentinela do material — improvável de propósito, e **base64 legal** de propósito.
 *
 * Improvável porque ela é o que a varredura de não-eco procura no erro serializado: um valor comum
 * ("abc", "senha") casaria por acaso dentro de uma mensagem do zod e a varredura passaria a reprovar
 * por coincidência, ou — pior — a não reprovar porque ninguém confiaria nela. Base64 legal porque o
 * corpo canônico precisa ser **aprovado**: uma sentinela ilegal faria todo positivo destes casos
 * reprovar pela forma, e não pelo que eles existem para provar.
 *
 * O comprimento é múltiplo de quatro (36 caracteres), que é a forma canônica do base64 sem
 * preenchimento.
 */
const SENTINELA_DO_MATERIAL = 'MIIsentinelaDoMaterialQueNaoEcoaXYZW';

/** A sentinela da senha — mesma razão, e nenhuma restrição de alfabeto a respeitar. */
const SENTINELA_DA_SENHA = 'senha-sentinela-que-nunca-pode-ecoar';

/** O corpo canônico de `POST /v1/integracoes-bancarias/certificados` (tech spec §4.1.1). */
const CORPO_DO_CERTIFICADO = {
  material: SENTINELA_DO_MATERIAL,
  senha: SENTINELA_DA_SENHA,
} as const;

/** O certificado como a API o devolve (tech spec §4.1.1) — o recurso canônico da saída. */
const CERTIFICADO_PUBLICADO = {
  id: '0f7c1c4e-6a4e-4f0e-9f9a-2f9b1f0a9c31',
  titular: 'IMOBILIARIA EXEMPLO LTDA:12345678000199',
  validoDe: '2026-01-10T12:00:00.000Z',
  validoAte: '2027-01-10T12:00:00.000Z',
  impressaoDigital: '3A:F0:C4:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:B6',
  estado: 'VIGENTE',
  diasParaVencer: 149,
  registradoPor: { id: '5d2f0000-0000-4000-8000-000000000003', nome: 'Fulana de Tal' },
  registradoEm: '2026-08-14T13:00:00.000Z',
} as const;

/**
 * As chaves que **nenhuma** projeção publicada pode declarar (RN-02).
 *
 * A lista é literal e nomeia as seis grafias plausíveis do mesmo segredo — as duas do corpo de
 * entrada (`material`, `senha`), as duas do vocabulário da biblioteca (`passphrase`, `pfx`) e as duas
 * do vocabulário da persistência (`segredoCifrado`, `materialDoCertificado`). Uma projeção montada a
 * partir da linha do banco erraria por qualquer uma delas, e o nome que ela usaria é justamente o que
 * quem escreveu o erro tem na cabeça no momento.
 */
const CHAVES_PROIBIDAS = [
  'material',
  'senha',
  'passphrase',
  'pfx',
  'segredoCifrado',
  'materialDoCertificado',
] as const;

/** O erro inteiro em texto — o eixo em que "a recusa não ecoa o valor recebido" é medido. */
function erroSerializado(resultado: z.ZodSafeParseResult<unknown>): string {
  return JSON.stringify(resultado.error);
}

describe('CT-845 — os dois enums são fechados, ordenados e congelados em execução', () => {
  /**
   * As duas listas escritas **por extenso** — nunca derivadas das constantes exportadas.
   *
   * A razão é a registrada no CT-540: derivá-las faz as duas pontas andarem juntas, e um terceiro
   * meio de recebimento (ou um quarto estado) atravessaria a suíte **sem uma recusa sequer**.
   */
  const MEIOS_DECLARADOS = ['BOLETO', 'PIX'] as const;
  const ESTADOS_DECLARADOS = ['VIGENTE', 'VENCENDO', 'VENCIDO'] as const;

  /**
   * Os quatro valores de `estado` fora da união.
   *
   * Nenhum deles é aleatório: `'EXPIRADO'` é o sinônimo tentador, `'vigente'` é a divergência de
   * caixa, `'ATIVO'` é o estado da **outra** máquina do produto (o contrato) e `'VIGENTE '` é o
   * espaço à direita que uma expressão sem âncora deixaria passar.
   */
  const ESTADOS_RECUSADOS = ['EXPIRADO', 'vigente', 'ATIVO', 'VIGENTE '] as const;

  it('as duas listas são exatamente as declaradas, na ordem publicada', () => {
    expect([...MEIOS_DE_RECEBIMENTO]).toEqual([...MEIOS_DECLARADOS]);
    expect([...ESTADOS_DO_CERTIFICADO]).toEqual([...ESTADOS_DECLARADOS]);
  });

  it('os dois arranjos estão congelados, e a mutação LANÇA sem alterar o conteúdo', () => {
    // O `as const` fecha a união em COMPILAÇÃO e não sobrevive ao build: o consumidor que importa o
    // pacote compilado recebe um arranjo comum. Só `Object.freeze` fecha o alargamento em EXECUÇÃO,
    // e é por isso que o eixo comportamental de `MEIOS_DE_RECEBIMENTO` é este — ela não entra em
    // esquema nenhum desta fatia (o pix é declarado sem operação, RN-11).
    expect([
      Object.isFrozen(MEIOS_DE_RECEBIMENTO),
      Object.isFrozen(ESTADOS_DO_CERTIFICADO),
    ]).toEqual([true, true]);

    expect(() => (MEIOS_DE_RECEBIMENTO as unknown as string[]).push('TED')).toThrow(TypeError);
    expect(() => (ESTADOS_DO_CERTIFICADO as unknown as string[]).push('SUSPENSO')).toThrow(
      TypeError,
    );

    // Reafirmar DEPOIS da tentativa: "lançou" e "não alterou" são propriedades diferentes, e um
    // arranjo que lançasse na cópia e mutasse o original passaria pela asserção anterior.
    expect([...MEIOS_DE_RECEBIMENTO]).toEqual([...MEIOS_DECLARADOS]);
    expect([...ESTADOS_DO_CERTIFICADO]).toEqual([...ESTADOS_DECLARADOS]);
  });

  for (const estado of ESTADOS_DECLARADOS) {
    it(`a projeção publicada aprova o estado ${estado} e devolve o recurso verbatim`, () => {
      const recurso = { ...CERTIFICADO_PUBLICADO, estado };
      const resultado = esquemaDoCertificado.safeParse(recurso);

      expect(resultado.success).toBe(true);
      expect(resultado.data).toEqual(recurso);
    });
  }

  for (const estado of ESTADOS_RECUSADOS) {
    it(`a projeção publicada recusa o estado ${JSON.stringify(estado)} nomeando o campo`, () => {
      const resultado = esquemaDoCertificado.safeParse({ ...CERTIFICADO_PUBLICADO, estado });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['estado']);
    });
  }
});

describe('CT-846 — o corpo do registro é fechado em dois campos, nenhum opcional', () => {
  /**
   * Os dois campos declarados, na ordem da §4.2 — jamais derivados de `Object.keys(shape)` nos dois
   * lados da asserção, que é a asserção infalível (AP-29) que o CT-731 existe para não ser.
   */
  const CAMPOS_DECLARADOS = ['material', 'senha'] as const;

  /**
   * As seis chaves **decididas pelo servidor**.
   *
   * `empresaId` está na lista porque é a única cujo vazamento **cruzaria empresa**: o contexto de
   * tenant vem da sessão, nunca do corpo (ADR-0008/0009).
   */
  const CHAVES_DO_SERVIDOR = [
    'id',
    'titular',
    'validoAte',
    'estado',
    'impressaoDigital',
    'empresaId',
  ] as const;

  it('declara exatamente material e senha, na ordem', () => {
    expect(Object.keys(esquemaDoCertificadoNovo.shape)).toEqual([...CAMPOS_DECLARADOS]);
  });

  it('aprova o corpo completo e o devolve verbatim', () => {
    const resultado = esquemaDoCertificadoNovo.safeParse({ ...CORPO_DO_CERTIFICADO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CORPO_DO_CERTIFICADO });
  });

  for (const campo of CAMPOS_DECLARADOS) {
    it(`recusa o corpo sem ${campo}, nomeando o campo ausente`, () => {
      // A tabela de AUSÊNCIA é o que distingue "fechado e obrigatório" de "fechado e opcional": um
      // `.optional()` em qualquer dos dois atravessaria toda a suíte da borda — o serviço apenas
      // receberia `undefined` — sem uma recusa sequer.
      const corpo = Object.fromEntries(
        Object.entries(CORPO_DO_CERTIFICADO).filter(([nome]) => nome !== campo),
      );
      const resultado = esquemaDoCertificadoNovo.safeParse(corpo);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  for (const chave of CHAVES_DO_SERVIDOR) {
    it(`recusa a chave ${chave} como desconhecida, nomeando-a`, () => {
      const resultado = esquemaDoCertificadoNovo.safeParse({
        ...CORPO_DO_CERTIFICADO,
        [chave]: 'decidido-pelo-servidor',
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }
});

describe('CT-847 — as duas pontas de cada limite declarado, e a recusa que não ecoa', () => {
  /**
   * Os dois tetos escritos **por extenso**, no molde do CT-543 e do CT-428 (b).
   *
   * Derivá-los das constantes exportadas deixaria as duas pontas andando juntas, e alargar a
   * constante passaria pela suíte — que é exatamente o mutante que estes casos precisam detectar.
   */
  const TETO_DECLARADO_DO_MATERIAL = 32768;
  const LARGURA_DECLARADA_DA_SENHA = 128;

  /** Um bloco de base64 canônico — quatro caracteres. */
  const BLOCO_BASE64 = 4;

  /** Base64 legal de comprimento exato — a sentinela completada com um caractere do alfabeto. */
  const materialDe = (comprimento: number): string =>
    SENTINELA_DO_MATERIAL.padEnd(comprimento, 'A');

  /** Senha de comprimento exato que **carrega a sentinela** — é ela que o não-eco procura. */
  const senhaDe = (comprimento: number): string => SENTINELA_DA_SENHA.padEnd(comprimento, 'x');

  it('as constantes publicadas valem o que a spec declara', () => {
    // Sem esta amarra, "uma definição só" seria compatível com **uma definição só e errada**.
    expect([MAIOR_MATERIAL_CODIFICADO, MAIOR_SENHA_DO_MATERIAL]).toEqual([
      TETO_DECLARADO_DO_MATERIAL,
      LARGURA_DECLARADA_DA_SENHA,
    ]);
  });

  // A rede do defeito de 2026-08-20: o teto foi dimensionado sobre uma medição que NÃO era a do
  // material real do provedor (declarava 2,6 KB; o real tem 8,7 KB), e o registro de produção
  // reprovava com 422 no campo `material`. A asserção acima fixa o teto contra um literal, e por
  // isso não pega a classe: ela aprovaria qualquer número, inclusive um pequeno demais de novo.
  //
  // Esta compara o teto com a MEDIÇÃO REAL, e é ela que discrimina — com o valor antigo (8192) o
  // caso reprova, porque 8192 < 12898.
  it('CT-851 — o teto do material guarda folga declarada sobre o maior material REAL observado', () => {
    expect(MAIOR_MATERIAL_REAL_OBSERVADO).toBeGreaterThan(0);
    expect(MAIOR_MATERIAL_CODIFICADO).toBeGreaterThanOrEqual(MAIOR_MATERIAL_REAL_OBSERVADO);
    // Folga de duas vezes — o critério que o docblock do teto declara, agora verificável.
    expect(MAIOR_MATERIAL_CODIFICADO).toBeGreaterThanOrEqual(MAIOR_MATERIAL_REAL_OBSERVADO * 2);
  });

  const APROVADOS: readonly {
    readonly rotulo: string;
    readonly corpo: { readonly material: string; readonly senha: string };
  }[] = [
    {
      rotulo: 'o material exatamente no teto',
      corpo: { material: materialDe(TETO_DECLARADO_DO_MATERIAL), senha: SENTINELA_DA_SENHA },
    },
    {
      rotulo: 'a senha de um único caractere',
      corpo: { material: SENTINELA_DO_MATERIAL, senha: 'x' },
    },
    {
      rotulo: 'a senha exatamente na largura declarada',
      corpo: { material: SENTINELA_DO_MATERIAL, senha: senhaDe(LARGURA_DECLARADA_DA_SENHA) },
    },
  ];

  for (const { rotulo, corpo } of APROVADOS) {
    it(`aprova ${rotulo} e o devolve verbatim`, () => {
      const resultado = esquemaDoCertificadoNovo.safeParse(corpo);

      expect(resultado.success).toBe(true);
      expect(resultado.data).toEqual(corpo);
    });
  }

  /**
   * O excesso do material é **um BLOCO** acima do teto, e não um caractere — a escolha é deliberada.
   *
   * Base64 canônico tem comprimento múltiplo de quatro, de modo que `teto + 1` seria recusado tanto
   * pelo teto **quanto pela forma**: a recusa passaria com um esquema que não tivesse teto nenhum. O
   * `code === 'too_big'` é o discriminador, e ele só é alcançável com uma cadeia legal.
   *
   * ⚠️ O valor é DERIVADO do teto desde 2026-08-20. Escrito como literal (era `8196`), ele
   * envelhecia junto com a constante e reprovava este caso quando o teto mudasse — foi o que
   * aconteceu ao corrigir o teto que recusava o material real do provedor.
   */
  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly corpo: Record<string, unknown>;
    readonly campo: string;
    readonly codigo: string;
  }[] = [
    {
      rotulo: 'o material um bloco acima do teto',
      corpo: {
        material: materialDe(TETO_DECLARADO_DO_MATERIAL + BLOCO_BASE64),
        senha: SENTINELA_DA_SENHA,
      },
      campo: 'material',
      codigo: 'too_big',
    },
    {
      rotulo: 'o material fora do alfabeto base64',
      corpo: { material: 'MII$$$naoEhBase64', senha: SENTINELA_DA_SENHA },
      campo: 'material',
      codigo: 'invalid_format',
    },
    {
      rotulo: 'a senha vazia',
      corpo: { material: SENTINELA_DO_MATERIAL, senha: '' },
      campo: 'senha',
      codigo: 'too_small',
    },
    {
      rotulo: 'a senha um caractere acima da largura',
      corpo: {
        material: SENTINELA_DO_MATERIAL,
        senha: senhaDe(LARGURA_DECLARADA_DA_SENHA + 1),
      },
      campo: 'senha',
      codigo: 'too_big',
    },
  ];

  for (const { rotulo, corpo, campo, codigo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo} com ${codigo}`, () => {
      const resultado = esquemaDoCertificadoNovo.safeParse(corpo);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
      expect(resultado.error?.issues[0]?.code).toBe(codigo);
    });

    it(`a recusa de ${rotulo} não ecoa nenhuma das duas sentinelas`, () => {
      // O erro INTEIRO é serializado — mensagem, caminho e todo campo do issue —, e não apenas a
      // mensagem: o eco por um campo auxiliar do issue seria tão vazamento quanto o eco pelo texto.
      const resultado = esquemaDoCertificadoNovo.safeParse(corpo);

      // A recusa é pré-condição do que se mede aqui: sem esta linha, um esquema que APROVASSE a
      // entrada faria o caso falhar por serializar `undefined`, e a falha nomearia a coisa errada.
      expect(resultado.success).toBe(false);

      const serializado = erroSerializado(resultado);

      expect(serializado).not.toContain(SENTINELA_DO_MATERIAL);
      expect(serializado).not.toContain(SENTINELA_DA_SENHA);
    });
  }
});

describe('CT-848 — as duas projeções publicadas têm forma fechada, e nenhuma declara segredo', () => {
  /**
   * Os nove campos publicados, na ordem da §4.1.1 — escritos **por extenso**.
   *
   * Derivá-los do próprio `shape` seria a asserção infalível (AP-29): o campo acrescentado ao esquema
   * entraria também na expectativa, e a publicação de um segredo novo passaria despercebida.
   */
  const CAMPOS_PUBLICADOS = [
    'id',
    'titular',
    'validoDe',
    'validoAte',
    'impressaoDigital',
    'estado',
    'diasParaVencer',
    'registradoPor',
    'registradoEm',
  ] as const;

  /** Os três campos do desfecho da verificação, na ordem da §4.1.1. */
  const CAMPOS_DA_VERIFICACAO = ['aceito', 'verificadoEm', 'detalhe'] as const;

  /**
   * Os cinco desfechos que o `detalhe` pode nomear, na ordem declarada — escritos **por extenso**.
   *
   * São **cinco**, e não quatro: o quinto (`NAO_INICIADO`) nasceu do caminho medido em que a
   * construção da requisição segura **lança** antes de qualquer conexão, e reusar qualquer um dos
   * outros mentiria sobre o que aconteceu. Derivá-los de `Object.keys` poria as duas pontas sob
   * autoria do caso, e um desfecho novo entraria na expectativa junto com o esquema (AP-29).
   */
  const DESFECHOS_DECLARADOS = [
    'ACEITE',
    'RECUSA_PELO_PAR',
    'INDISPONIVEL',
    'TEMPO_ESGOTADO',
    'NAO_INICIADO',
  ] as const;

  /**
   * Os dois desfechos canônicos, com o `detalhe` **copiado como literal** da fonte única.
   *
   * SUT_IS_CORRECT_BECAUSE: os dois traziam texto inventado (*"o provedor aceitou este certificado
   * no aperto de mão"*), e ele era aceito porque `detalhe` era `z.string()`. O campo passou a ser a
   * união fechada de {@link DETALHES_DA_VERIFICACAO} — é o fecho estrutural do débito **D27 · F4/T8**
   * —, e texto fora do conjunto agora é **recusa**, que é exatamente o comportamento pretendido. O
   * código de produção está certo; o que estava errado era o dado do caso, que afirmava um desfecho
   * que o produto nunca produziu.
   *
   * ⚠️ **Copiados como literal, e não importados de `DETALHES_DA_VERIFICACAO`**, de propósito e pelo
   * precedente literal de `apps/api/test/certificado-do-provedor.e2e.spec.ts`: importá-los faria o
   * caso aprovar qualquer texto, inclusive um que colapsasse dois desfechos num só.
   */
  const VERIFICACAO_ACEITA = {
    aceito: true,
    verificadoEm: '2026-08-14T13:05:00.000Z',
    detalhe:
      'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
      'Isto confirma a identidade da empresa perante ela; não confirma que a emissão de cobrança já ' +
      'está habilitada, o que depende das credenciais de habilitação',
  } as const;

  const VERIFICACAO_RECUSADA = {
    aceito: false,
    verificadoEm: '2026-08-14T13:05:00.000Z',
    detalhe:
      'a instituição não aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
      'Confira se o certificado é o que ela emitiu para esta empresa e se continua válido perante ela',
  } as const;

  /**
   * Os textos que o desfecho **não** pode carregar — a rede do fecho do D27.
   *
   * Nenhum é aleatório: o primeiro é detrito do runtime de transporte (o caminho exato que o débito
   * descrevia), o segundo é texto do dialeto do provedor, o terceiro é a redação plausível que um
   * adaptador futuro escreveria de próprio punho, e o quarto é o texto canônico com um espaço à
   * direita — a divergência que uma comparação frouxa deixaria passar.
   */
  const DETALHES_RECUSADOS = [
    'Error: unable to verify the first certificate',
    'nossoNumero inválido para o beneficiário',
    'o provedor aceitou este certificado no aperto de mão',
    'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ',
  ] as const;

  it('o certificado declara exatamente os nove campos publicados, na ordem', () => {
    expect(Object.keys(esquemaDoCertificado.shape)).toEqual([...CAMPOS_PUBLICADOS]);
  });

  it('o desfecho da verificação declara exatamente os três campos, na ordem', () => {
    expect(Object.keys(esquemaDoResultadoDaVerificacao.shape)).toEqual([...CAMPOS_DA_VERIFICACAO]);
  });

  it('o conjunto de detalhes é fechado nos cinco desfechos, e congelado em execução', () => {
    // Igualdade de conjunto sobre a lista escrita por extenso — jamais derivada do próprio objeto,
    // que poria as duas pontas sob autoria do caso. Um sexto desfecho entra aqui antes de entrar na
    // união publicada; um desfecho que suma reprova pela mesma asserção.
    expect(Object.keys(DETALHES_DA_VERIFICACAO)).toEqual([...DESFECHOS_DECLARADOS]);

    // O `as const` fecha a união em COMPILAÇÃO e não sobrevive ao build; só `Object.freeze` fecha o
    // alargamento em EXECUÇÃO — é a mesma razão registrada no CT-845 para os dois arranjos.
    expect(Object.isFrozen(DETALHES_DA_VERIFICACAO)).toBe(true);
    expect(() => {
      (DETALHES_DA_VERIFICACAO as unknown as Record<string, string>).INVENTADO = 'texto novo';
    }).toThrow(TypeError);

    // Reafirmar DEPOIS da tentativa: "lançou" e "não alterou" são propriedades diferentes.
    expect(Object.keys(DETALHES_DA_VERIFICACAO)).toEqual([...DESFECHOS_DECLARADOS]);
  });

  it('nenhuma das duas projeções declara chave de segredo — nem UM NÍVEL ABAIXO', () => {
    // Metade DECLARATIVA. A asserção devolve a **lista das culpadas**, e não um booleano, para que a
    // falha nomeie a chave publicada por engano. Sozinha, ela não distingue "não declarado" de
    // "declarado e ignorado na leitura" — é a metade seguinte que fecha essa diferença.
    const declaradas = (chaves: readonly string[]): string[] =>
      CHAVES_PROIBIDAS.filter((proibida) => chaves.includes(proibida));

    expect(declaradas(Object.keys(esquemaDoCertificado.shape))).toEqual([]);
    expect(declaradas(Object.keys(esquemaDoCertificado.shape.registradoPor.shape))).toEqual([]);
    expect(declaradas(Object.keys(esquemaDoResultadoDaVerificacao.shape))).toEqual([]);
  });

  it('o certificado canônico é aprovado e devolvido verbatim', () => {
    const resultado = esquemaDoCertificado.safeParse({ ...CERTIFICADO_PUBLICADO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CERTIFICADO_PUBLICADO });
  });

  for (const desfecho of [VERIFICACAO_ACEITA, VERIFICACAO_RECUSADA]) {
    it(`o desfecho com aceito: ${desfecho.aceito} é aprovado e devolvido verbatim`, () => {
      const resultado = esquemaDoResultadoDaVerificacao.safeParse({ ...desfecho });

      expect(resultado.success).toBe(true);
      expect(resultado.data).toEqual({ ...desfecho });
    });

    it(`o desfecho com aceito: ${desfecho.aceito} aceita detalhe NULO e o devolve nulo`, () => {
      // Este é o único eixo do produto que NENHUMA outra camada exercita: a borda preenche `detalhe`
      // nos dois desfechos hoje, e é a fatia (ii) que o zerará no positivo. Sem esta linha, o
      // `nullable()` poderia cair sem uma recusa, e aquela fatia descobriria isso em produção —
      // precisando mudar o contrato publicado para fazer o que já está decidido.
      const resultado = esquemaDoResultadoDaVerificacao.safeParse({ ...desfecho, detalhe: null });

      expect(resultado.success).toBe(true);
      expect(resultado.data?.detalhe).toBeNull();
      expect(resultado.data).toEqual({ ...desfecho, detalhe: null });
    });
  }

  for (const detalhe of DETALHES_RECUSADOS) {
    it(`o desfecho recusa o detalhe ${JSON.stringify(detalhe.slice(0, 24))}… nomeando o campo`, () => {
      // A rede do fecho do **D27 · F4/T8**: enquanto `detalhe` era `z.string().nullable()`, cada um
      // destes quatro atravessava o contrato publicado e chegava à tela do Admin. A recusa é
      // afirmada por `code` E por `path` — só o booleano de insucesso não distinguiria a recusa do
      // texto de uma recusa de outro campo qualquer.
      const resultado = esquemaDoResultadoDaVerificacao.safeParse({
        ...VERIFICACAO_ACEITA,
        detalhe,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_value');
      expect(resultado.error?.issues[0]?.path).toEqual(['detalhe']);
    });
  }

  const VARIANTES_COM_SEGREDO: readonly {
    readonly rotulo: string;
    readonly recurso: Record<string, unknown>;
    readonly caminho: readonly string[];
    readonly chave: string;
  }[] = [
    {
      rotulo: 'o certificado com o material de volta',
      recurso: { ...CERTIFICADO_PUBLICADO, material: SENTINELA_DO_MATERIAL },
      caminho: [],
      chave: 'material',
    },
    {
      rotulo: 'o certificado com a senha de volta',
      recurso: { ...CERTIFICADO_PUBLICADO, senha: SENTINELA_DA_SENHA },
      caminho: [],
      chave: 'senha',
    },
    {
      rotulo: 'a autoria carregando a passphrase — um nível abaixo',
      recurso: {
        ...CERTIFICADO_PUBLICADO,
        registradoPor: { ...CERTIFICADO_PUBLICADO.registradoPor, passphrase: SENTINELA_DA_SENHA },
      },
      caminho: ['registradoPor'],
      chave: 'passphrase',
    },
    {
      rotulo: 'o desfecho da verificação carregando o envelope cifrado',
      recurso: { ...VERIFICACAO_ACEITA, segredoCifrado: SENTINELA_DO_MATERIAL },
      caminho: [],
      chave: 'segredoCifrado',
    },
  ];

  for (const { rotulo, recurso, caminho, chave } of VARIANTES_COM_SEGREDO) {
    it(`recusa ${rotulo}, nomeando ${chave} e sem ecoar o valor`, () => {
      // Metade COMPORTAMENTAL. Sozinha, ela não distingue "recusado" de "nunca chegou" — é o PAR com
      // a metade declarativa que detecta.
      const esquema =
        chave === 'segredoCifrado' ? esquemaDoResultadoDaVerificacao : esquemaDoCertificado;
      const resultado = esquema.safeParse(recurso);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toHaveLength(1);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]?.path).toEqual([...caminho]);
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });

      const serializado = erroSerializado(resultado);
      expect(serializado).not.toContain(SENTINELA_DO_MATERIAL);
      expect(serializado).not.toContain(SENTINELA_DA_SENHA);
    });
  }
});

describe('CT-849 — o identificador bancário é aceito a 18 dígitos e recusado a 17 e a 19', () => {
  /** As três larguras da RN-07, escritas por extenso — a decomposição como FATO, não comentário. */
  const LARGURA_DECLARADA_DO_IDENTIFICADOR = 18;
  const LARGURA_DA_COMPETENCIA_POR_EXTENSO = 6;
  const LARGURA_DO_CONTADOR_POR_EXTENSO = 12;

  /**
   * `'000000000000000000'` entra de propósito entre os aceitos.
   *
   * O esquema **não** valida a semântica do mês — a §4.2 declara `/^[0-9]{18}$/` —, e escrever este
   * aceito impede que alguém "aperte" o esquema com uma validação que a spec não pede, o que faria o
   * contrato recusar um identificador que o provedor aceitaria.
   */
  const ACEITOS = [
    '202608000000000001',
    '202608000000000042',
    '202608999999999999',
    '000000000000000000',
  ] as const;

  /**
   * As sete formas ilegais. O 17 e o 19 são as duas pontas **exatas**: o defeito plausível é o
   * preenchimento à esquerda errado **por uma posição**, e um `{18,}` ou um `{17,19}` na expressão
   * passaria por qualquer tabela que só aprovasse a forma canônica.
   */
  const RECUSADOS = [
    '20260800000000001',
    '2026080000000000010',
    '20260800000000000A',
    ' 202608000000000001',
    '202608000000000001 ',
    '+02608000000000001',
    '',
  ] as const;

  it('a decomposição das 18 posições fecha: 6 de competência mais 12 de contador', () => {
    // As larguras PUBLICADAS, por igualdade contra o valor por extenso — e não a soma de dois
    // literais locais, que seria verdadeira sozinha e não poderia falhar (AP-29). Elas deixaram de
    // ser privadas na rodada 2 da T6, e é esta asserção que dá a este pacote como proteger, do lado
    // dele, o fato que ele passou a publicar: um contrato que declarasse `4 + 14` manteria o total
    // em 18 e a expressão continuaria aceitando 18 dígitos, de modo que só a igualdade **campo a
    // campo** acusa a troca — que produziria preenchimento à esquerda errado em `@sysloc/db`.
    expect([LARGURA_DA_COMPETENCIA, LARGURA_DO_CONTADOR]).toEqual([
      LARGURA_DA_COMPETENCIA_POR_EXTENSO,
      LARGURA_DO_CONTADOR_POR_EXTENSO,
    ]);

    expect(LARGURA_DA_COMPETENCIA + LARGURA_DO_CONTADOR).toBe(LARGURA_DECLARADA_DO_IDENTIFICADOR);
  });

  for (const identificador of ACEITOS) {
    it(`aprova ${identificador} e devolve a cadeia exata`, () => {
      const resultado = ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(identificador);

      // Valor igual, e não "está definido": é a forma que o banco guarda e que toda comparação a
      // jusante usa.
      expect(resultado.success).toBe(true);
      expect(resultado.data).toBe(identificador);
      // Amarra a tabela ao invariante: um aceito de outra largura seria defeito do próprio caso.
      expect(identificador).toHaveLength(LARGURA_DECLARADA_DO_IDENTIFICADOR);
    });
  }

  for (const identificador of RECUSADOS) {
    it(`recusa ${JSON.stringify(identificador)} por forma inválida`, () => {
      const resultado = ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(identificador);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
    });
  }
});

describe('CT-850 — LIMIAR_DE_VENCIMENTO_EM_DIAS tem definição única em todo o monorepo', () => {
  /** A raiz do repositório, derivada da posição deste arquivo. */
  const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

  /**
   * Os quatro lugares onde uma segunda definição do limiar é plausível.
   *
   * A varredura vai **além deste pacote de propósito**: o débito `D14` da fase anterior é exatamente
   * o caso do mesmo fato com uma segunda declaração executável **do outro lado da fronteira do
   * pacote**, e uma varredura restrita a `packages/contracts/src` seria cega para ele. Quem deriva o
   * estado (`packages/db/src`), quem monta a resposta (`apps/api/src`) e quem fala com o provedor
   * (`packages/cobranca-bancaria/src`) são os três candidatos naturais a redeclará-lo.
   */
  const DIRETORIOS_VARRIDOS = [
    'packages/contracts/src',
    'packages/cobranca-bancaria/src',
    'packages/db/src',
    'apps/api/src',
  ] as const;

  /**
   * Os diretórios declarados que **ainda não nasceram** — hoje, **nenhum**.
   *
   * A ausência é **afirmada**, e não engolida: `listarFontesTs` levanta em diretório inexistente
   * justamente para que um `src/` renomeado não reduza a varredura a zero arquivos em silêncio, e
   * repetir aqui um `.catch(() => [])` reabriria esse buraco. A asserção abaixo é na direção que
   * preserva o invariante — **nenhum diretório fora desta lista pode estar ausente** —, de modo que
   * renomear qualquer um dos quatro reprova nomeando o culpado.
   *
   * ⚠️ **A lista vazia é o estado forte, e ela não deve voltar a crescer para acomodar um diretório
   * que sumiu.** Cada entrada aqui é uma isenção viva: enquanto `packages/cobranca-bancaria/src`
   * esteve nela — e ele permaneceu por toda a fatia que o CRIOU —, apagar aquele `src/` seria
   * tolerado em silêncio e a varredura cairia de quatro diretórios para três sem nada acusar, que é
   * exatamente o buraco que este desenho existe para fechar. Entrada só se justifica para diretório
   * que ainda **não nasceu**, e sai no mesmo passo em que ele nascer.
   */
  // SUT_IS_CORRECT_BECAUSE: a entrada saiu na intervenção dirigida de 2026-08-16, e o motivo é que
  // ela já era FALSA — `packages/cobranca-bancaria/src` foi criado pela T8 desta mesma fatia, e a
  // isenção sobreviveu ao fato que a justificava (é o débito `D29`, categoria `dead_code`). Nenhuma
  // cobertura sai com ela: a varredura opera sobre `diretoriosPresentes()`, derivado do filesystem,
  // de modo que o pacote bancário já vinha sendo varrido. O que sai é a tolerância morta, e a
  // asserção fica ESTRITAMENTE mais forte.
  const DIRETORIOS_AINDA_INEXISTENTES = [] as const;

  /** O único arquivo de produção que pode declarar o limiar. */
  const DONO_DO_LIMIAR = 'packages/contracts/src/integracao-bancaria.ts';

  /** O nome cujo fato do contrato não pode ter uma segunda definição. */
  const NOME_DO_LIMIAR = 'LIMIAR_DE_VENCIMENTO_EM_DIAS';

  /** Casa a **declaração exportada** — a forma exata do débito D14. */
  const declaracaoExportada = (linha: string): boolean =>
    new RegExp(`^export const ${NOME_DO_LIMIAR}\\b`).test(linha);

  /** Casa QUALQUER ligação do nome, exportada ou não — é o que pega a redeclaração local. */
  const qualquerDeclaracao = (linha: string): boolean =>
    new RegExp(`\\b(const|let|var)\\s+${NOME_DO_LIMIAR}\\b`).test(linha);

  /**
   * Só `ENOENT` vira "não existe" — qualquer outra falha do sistema de arquivos **sobe**.
   *
   * Uma tolerância larga aqui (um `catch` que engolisse tudo) transformaria permissão negada em
   * "diretório ausente" e devolveria a varredura ao vácuo silencioso que este desenho evita.
   */
  async function existe(caminho: string): Promise<boolean> {
    try {
      await stat(caminho);
      return true;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw erro;
    }
  }

  /** Os diretórios declarados que existem hoje, na ordem declarada. */
  async function diretoriosPresentes(): Promise<string[]> {
    const presentes: string[] = [];
    for (const diretorio of DIRETORIOS_VARRIDOS) {
      if (await existe(join(RAIZ_DO_REPOSITORIO, diretorio))) {
        presentes.push(diretorio);
      }
    }
    return presentes;
  }

  it('nenhum diretório varrido está ausente fora da lista declarada de inexistentes', async () => {
    const presentes = await diretoriosPresentes();
    const ausentes = DIRETORIOS_VARRIDOS.filter((diretorio) => !presentes.includes(diretorio));

    // Lista das culpadas, e não um booleano: a falha nomeia o diretório que sumiu.
    expect(
      ausentes.filter(
        (diretorio) => !(DIRETORIOS_AINDA_INEXISTENTES as readonly string[]).includes(diretorio),
      ),
    ).toEqual([]);
  });

  it(`${NOME_DO_LIMIAR} é declarado por exatamente um arquivo de produção, e ele é o dono`, async () => {
    const presentes = await diretoriosPresentes();

    const arquivosQueDeclaram: string[] = [];
    const contagemPorDiretorio: { diretorio: string; arquivos: number }[] = [];

    for (const diretorio of presentes) {
      // Diretório presente e ilegível LEVANTA (é o desenho de `listarFontesTs`).
      const fontes = await listarFontesTs(join(RAIZ_DO_REPOSITORIO, diretorio));
      const varredura = await varrerArquivos(fontes, declaracaoExportada);

      contagemPorDiretorio.push({ diretorio, arquivos: varredura.arquivos });
      arquivosQueDeclaram.push(
        ...varredura.ocorrencias.map((ocorrencia) =>
          relative(RAIZ_DO_REPOSITORIO, ocorrencia.replace(/:\d+$/, '')),
        ),
      );
    }

    // Lista exata: contagem e dono numa asserção só. Uma segunda definição em qualquer dos quatro
    // diretórios — a forma exata do D14 — acrescenta um elemento e reprova NOMEANDO o culpado.
    // Ela é também o **controle positivo** da varredura: um padrão quebrado devolveria `[]`.
    expect(arquivosQueDeclaram).toEqual([DONO_DO_LIMIAR]);

    // Âncora antivácuo, por diretório: zero arquivo lido em qualquer um deles faria a asserção acima
    // passar por não ter olhado, e não por não haver o que achar.
    expect(contagemPorDiretorio.filter(({ arquivos }) => arquivos === 0)).toEqual([]);
  });

  it('nenhum outro arquivo de produção LIGA o nome, nem sem export', async () => {
    const presentes = await diretoriosPresentes();

    const arquivosQueLigam: string[] = [];
    for (const diretorio of presentes) {
      const fontes = await listarFontesTs(join(RAIZ_DO_REPOSITORIO, diretorio));
      const varredura = await varrerArquivos(fontes, qualquerDeclaracao);

      arquivosQueLigam.push(
        ...varredura.ocorrencias.map((ocorrencia) =>
          relative(RAIZ_DO_REPOSITORIO, ocorrencia.replace(/:\d+$/, '')),
        ),
      );
    }

    // O CONTROLE POSITIVO desta metade: o predicado casa a declaração do dono, e casa uma só vez. Sem
    // ele, um padrão quebrado devolveria a lista vazia esperada logo abaixo e o caso passaria verde
    // provando nada — o AP-29 na forma mais barata de cometer.
    expect(arquivosQueLigam).toEqual([DONO_DO_LIMIAR]);

    // A metade que a varredura anterior não alcança: uma redeclaração **sem `export`** não é
    // declaração exportada e passaria por ela sem uma ocorrência sequer.
    expect(arquivosQueLigam.filter((arquivo) => arquivo !== DONO_DO_LIMIAR)).toEqual([]);
  });

  it('o valor publicado é 30', () => {
    // A amarra de VALOR: sem ela, "uma definição só" seria compatível com uma definição só e errada.
    expect(LIMIAR_DE_VENCIMENTO_EM_DIAS).toBe(30);
  });
});

/**
 * O corpo canônico de `POST /v1/cobranca-bancaria/emissoes` (tech spec §4.1.1) — um campo só.
 *
 * A competência é o **primeiro dia** do mês, que é a única forma que o esquema aceita.
 */
const CORPO_DA_COMPETENCIA = { competencia: '2026-09-01' } as const;

/** Uma linha da prestação de contas do lote, no desfecho que carrega motivo. */
const ITEM_DO_LOTE_PUBLICADO = {
  cobrancaCodigo: 'COB-2026-0000059',
  desfecho: 'RECUSADO',
  motivo: 'titulo ja registrado no provedor',
} as const;

/** A emissão em lote como a API a devolve, recém-aberta (tech spec §4.1.1). */
const LOTE_PUBLICADO = {
  id: '7a1c0000-0000-4000-8000-000000000001',
  competencia: CORPO_DA_COMPETENCIA.competencia,
  estado: 'EM_ANDAMENTO',
  criadoEm: '2026-09-01T12:00:00.000Z',
  concluidoEm: null,
  interrompidoEm: null,
  motivoDaInterrupcao: null,
  emitidas: 0,
  recusadas: 0,
  itens: [],
} as const;

/** A conferência como a API a devolve quando ela é a que acabou de começar (CA-15). */
const CONFERENCIA_PUBLICADA = {
  id: '7a1c0000-0000-4000-8000-000000000002',
  iniciadaEm: '2026-09-01T12:00:00.000Z',
  concluidaEm: null,
  iniciadaAgora: true,
  cobrancasConferidas: 0,
  efeitos: 0,
} as const;

/** Uma linha da trilha bancária — o efeito que a conferência descobriu (ADR-0034). */
const EVENTO_PUBLICADO = {
  tipo: 'COBRANCA_LIQUIDADA',
  origem: 'CONFERENCIA',
  ocorridoEm: '2026-09-02T09:30:00.000Z',
  diagnostico: null,
  valorInformado: null,
} as const;

/**
 * O histórico bancário como a rota o devolve — o envelope de `itens` com um efeito dentro.
 *
 * Ele carrega **um** item, e não zero: o envelope vazio é forma legítima da rota, mas não exercitaria
 * o item, e a saída aberta do envelope diria pouco se a lista que ela carrega nunca fosse conferida.
 */
const TRILHA_PUBLICADA = { itens: [EVENTO_PUBLICADO] } as const;

/**
 * Os esquemas de SAÍDA que esta fatia publica, mais o da cobrança, que ela estende.
 *
 * A tabela é escrita por extenso, e não descoberta por prefixo: o que este caso prova é a **direção**
 * — que estes, e não outros, são de saída —, e derivá-la de uma convenção de nome faria a asserção
 * concordar com a convenção em vez de com a decisão.
 */
const SAIDAS_DA_FATIA: readonly {
  readonly rotulo: string;
  readonly esquema: z.ZodObject;
  readonly recurso: Record<string, unknown>;
}[] = [
  { rotulo: 'esquemaDaEmissaoEmLote', esquema: esquemaDaEmissaoEmLote, recurso: LOTE_PUBLICADO },
  { rotulo: 'esquemaDoItemDoLote', esquema: esquemaDoItemDoLote, recurso: ITEM_DO_LOTE_PUBLICADO },
  {
    rotulo: 'esquemaDaConferenciaBancaria',
    esquema: esquemaDaConferenciaBancaria,
    recurso: CONFERENCIA_PUBLICADA,
  },
  {
    rotulo: 'esquemaDoEventoBancario',
    esquema: esquemaDoEventoBancario,
    recurso: EVENTO_PUBLICADO,
  },
  {
    rotulo: 'esquemaDaTrilhaDaCobranca',
    esquema: esquemaDaTrilhaDaCobranca,
    recurso: TRILHA_PUBLICADA,
  },
  { rotulo: 'esquemaDaCobranca', esquema: esquemaDaCobranca, recurso: COBRANCA_PUBLICADA },
];

describe('CT-942 — a direção decide a estritude: entrada recusa a chave desconhecida, saída a aceita', () => {
  it('a entrada aprova o corpo válido e o devolve verbatim', () => {
    const resultado = esquemaDaCompetencia.safeParse(CORPO_DA_COMPETENCIA);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(CORPO_DA_COMPETENCIA);
  });

  // A sobreposição com o CT-337 — que já gera esta mesma recusa por tabela, desde que
  // `esquemaDaCompetencia` entrou em `ESQUEMAS_DE_ENTRADA` — é deliberada, e a razão está por extenso
  // na seção «CT-942 — por que ele vem em par» do cabeçalho deste arquivo. **Não remova esta metade**:
  // ela é o braço de entrada da comparação de DIREÇÃO, que o CT-337 não alcança porque varre um lado só.
  it('a entrada RECUSA empresaId nomeando a chave — jamais só um booleano de insucesso', () => {
    const resultado = esquemaDaCompetencia.safeParse({
      ...CORPO_DA_COMPETENCIA,
      empresaId: EMPRESA_ALHEIA,
    });

    // As duas linhas juntas são o que a `.claude/rules/contrato-publicado.md` exige, literalmente: o
    // booleano sozinho aprovaria **qualquer** falha de esquema — inclusive uma que nada tem a ver com
    // a chave excedente —, e é a lista `keys` que diz QUAL chave foi recusada.
    expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
    expect(resultado.error?.issues[0]).toMatchObject({ keys: ['empresaId'] });
  });

  for (const { rotulo, esquema, recurso } of SAIDAS_DA_FATIA) {
    it(`${rotulo} é ABERTO: aceita o campo novo e o descarta, sem recusar`, () => {
      // A MESMA chave que a entrada recusa acima. É o par que discrimina a direção: sem ele, os dois
      // lados poderiam ser estritos (o que derrubaria a rota ao primeiro campo novo da view) ou os
      // dois abertos (o que deixaria `empresaId` entrar em silêncio pelo corpo do cliente).
      const resultado = esquema.safeParse({ ...recurso, empresaId: EMPRESA_ALHEIA });

      expect(resultado.success).toBe(true);
      // E o campo extra **não atravessa**: a saída aberta descarta o que não declarou, em vez de
      // ecoá-lo ao consumidor. Sem esta linha, um `z.looseObject` passaria — e ele publicaria o
      // `empresaId` que acabou de chegar de fora.
      expect(resultado.data).toEqual(recurso);
    });
  }

  /** As formas vizinhas da competência, todas recusadas nomeando o próprio campo. */
  const COMPETENCIAS_RECUSADAS: readonly { readonly rotulo: string; readonly valor: unknown }[] = [
    { rotulo: 'o segundo dia do mês', valor: '2026-09-02' },
    { rotulo: 'o último dia do mês', valor: '2026-09-30' },
    // O dia 10 é o vencimento típico do produto, e é a grafia em que a troca de `/-01$/` por um
    // molde frouxo mais provavelmente passaria despercebida.
    { rotulo: 'o dia do vencimento', valor: '2026-09-10' },
    { rotulo: 'a data que o calendário não tem', valor: '2026-02-30' },
    { rotulo: 'o primeiro dia COM hora', valor: '2026-09-01T00:00:00.000Z' },
    { rotulo: 'o mês sem dia', valor: '2026-09' },
    { rotulo: 'a competência vazia', valor: '' },
  ];

  for (const { rotulo, valor } of COMPETENCIAS_RECUSADAS) {
    it(`a entrada recusa ${rotulo} nomeando competencia`, () => {
      const resultado = esquemaDaCompetencia.safeParse({ competencia: valor });

      expect(resultado.success).toBe(false);
      // O `path` é do CAMPO, e não da raiz do objeto: a §6.1 manda `422 CAMPO_INVALIDO` nomeando
      // `competencia`, e um refino sem `path` explícito reporta a raiz — a recusa chegaria ao cliente
      // sem dizer que campo corrigir.
      expect(resultado.error?.issues[0]?.path).toEqual(['competencia']);
    });
  }

  it('aprova o primeiro dia de QUALQUER mês — a regra é o dia, não o mês', () => {
    const primeirosDias = ['2026-01-01', '2026-02-01', '2026-12-01'];

    expect(
      primeirosDias.map((competencia) => esquemaDaCompetencia.safeParse({ competencia }).success),
    ).toEqual([true, true, true]);
  });

  it('o item do lote nomeia a cobrança pelo CÓDIGO, canonizando a caixa (ADR-0017)', () => {
    // A prova de que o esquema **importado** de `cobranca.ts` é quem confere, e não um molde
    // redigitado aqui: um `z.string()` aprovaria a cadeia em minúsculas e a devolveria como veio.
    const resultado = esquemaDoItemDoLote.safeParse({
      ...ITEM_DO_LOTE_PUBLICADO,
      cobrancaCodigo: '  cob-2026-0000059  ',
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.cobrancaCodigo).toBe('COB-2026-0000059');

    // E a largura da série da cobrança continua sendo a de SETE dígitos: a do contrato, com cinco,
    // é a harmonização tentadora que o `DECISÃO FECHADA` de `cobranca.ts` proíbe.
    const comLarguraDoContrato = esquemaDoItemDoLote.safeParse({
      ...ITEM_DO_LOTE_PUBLICADO,
      cobrancaCodigo: 'COB-2026-00059',
    });

    expect(comLarguraDoContrato.success).toBe(false);
    expect(comLarguraDoContrato.error?.issues[0]?.path).toEqual(['cobrancaCodigo']);
  });
});

describe('CT-942 (b) — os quatro enums da fatia publicam exatamente os rótulos declarados, congelados', () => {
  /**
   * Os quatro conjuntos, escritos **por extenso** — nunca derivados das constantes sob prova.
   *
   * Derivá-las faria as duas pontas andarem juntas: um rótulo acrescentado à constante entraria na
   * lista esperada no mesmo instante, e a asserção não poderia falhar (AP-29). É a mesma razão, e o
   * mesmo desenho, do CT-540 e do CT-845.
   *
   * ⚠️ **Não existe um tipo `CONFERENCIA`**, e a ausência é decisão escalada ao usuário e registrada
   * na §21.1(2) do tech spec da fatia `emissao-e-conciliacao`: a conferência entra como **origem**,
   * nunca como tipo, senão a trilha registraria *tentativa* — que é o que a `Decision` da ADR-0034
   * proíbe. Esta lista é a rede daquela decisão: acrescentar o tipo reprova aqui.
   *
   * SUT_IS_CORRECT_BECAUSE: as duas primeiras listas cresceram na fatia `webhook-e-carne`, por
   * decisão declarada na §1 da T2 dela. `NOTICIA_RECUSADA` é **desfecho anômalo** — a notícia cujo
   * número de título diverge do gravado, com nada consultado e nada mudado —, que é a segunda metade
   * literal da `Decision` da ADR-0034 (*"o efeito **ou o desfecho anômalo**"*); e
   * `NOTICIA_DO_PROVEDOR` é **origem**, o terceiro produtor de efeito, entrando pela mesma porta por
   * onde `CONFERENCIA` entrou e pela mesma razão. As duas entram no FIM da lista porque é ali que
   * `ALTER TYPE … ADD VALUE` as põe no enum do banco, e a igualdade entre as pontas é posicional.
   * **Nenhum rótulo saiu, nenhuma posição anterior mudou, e a asserção continua por igualdade.**
   */
  const ENUMS_PUBLICADOS: readonly {
    readonly rotulo: string;
    readonly publicado: readonly string[];
    readonly declarado: readonly string[];
  }[] = [
    {
      rotulo: 'TIPOS_DE_EVENTO_BANCARIO',
      publicado: TIPOS_DE_EVENTO_BANCARIO,
      declarado: [
        'BOLETO_EMITIDO',
        'BOLETO_REVOGADO',
        'EMISSAO_RECUSADA',
        'COBRANCA_LIQUIDADA',
        'LIQUIDACAO_ESTORNADA',
        'DIVERGENCIA_DE_VALOR',
        'NOTICIA_RECUSADA',
      ],
    },
    {
      rotulo: 'ORIGENS_DO_EVENTO_BANCARIO',
      publicado: ORIGENS_DO_EVENTO_BANCARIO,
      declarado: ['ATO_DO_ADMIN', 'CONFERENCIA', 'NOTICIA_DO_PROVEDOR'],
    },
    {
      rotulo: 'ESTADOS_DA_EMISSAO_EM_LOTE',
      publicado: ESTADOS_DA_EMISSAO_EM_LOTE,
      declarado: ['EM_ANDAMENTO', 'CONCLUIDA', 'INTERROMPIDA'],
    },
    {
      rotulo: 'DESFECHOS_DO_ITEM_DO_LOTE',
      publicado: DESFECHOS_DO_ITEM_DO_LOTE,
      declarado: ['EMITIDO', 'RECUSADO'],
    },
  ];

  for (const { rotulo, publicado, declarado } of ENUMS_PUBLICADOS) {
    it(`${rotulo} publica exatamente os rótulos declarados, nesta ordem`, () => {
      // A ordem é CONTEÚDO: é dela que o enum do PostgreSQL da T2 deriva, e é ela que governa
      // comparação e ordenação do tipo lá dentro (ADR-0016).
      expect([...publicado]).toEqual(declarado);
    });

    it(`${rotulo} está congelado em execução — nenhum consumidor o alarga`, () => {
      // O `as const` fecha a união em COMPILAÇÃO e some no build; quem chega ao consumidor do pacote
      // compilado é um arranjo comum. Sem `Object.freeze`, um `push` alargaria o vocabulário do
      // produto em execução, e o banco recusaria o rótulo que o contrato passou a admitir.
      expect(() => (publicado as string[]).push('INVENTADO')).toThrow(TypeError);
      // "Lançou" e "não alterou" são propriedades diferentes — esta é a segunda.
      expect([...publicado]).toEqual(declarado);
    });
  }

  it('o evento RECUSA um tipo CONFERENCIA — a trilha registra efeito, nunca tentativa (ADR-0034)', () => {
    // A metade comportamental da decisão da §21.1(2): a lista literal acima pega o acréscimo ao enum,
    // e esta linha pega o esquema que aceitasse o rótulo por fora dele (um `z.string()` em `tipo`).
    const resultado = esquemaDoEventoBancario.safeParse({
      ...EVENTO_PUBLICADO,
      tipo: 'CONFERENCIA',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['tipo']);

    // E o mesmo rótulo é legítimo em `origem`, que é onde a conferência aparece na trilha. Sem esta
    // segunda metade, "recusa CONFERENCIA" seria satisfeito por um esquema que o recusasse nos dois
    // campos — e a CA-13 ficaria sem como dizer quem descobriu o efeito.
    const comOrigemDaConferencia = esquemaDoEventoBancario.safeParse({
      ...EVENTO_PUBLICADO,
      origem: 'CONFERENCIA',
    });

    expect(comOrigemDaConferencia.success).toBe(true);
    expect(comOrigemDaConferencia.data?.origem).toBe('CONFERENCIA');
  });

  it('o lote publica o estado DERIVADO ao lado dos dois instantes de desfecho (ADR-0022)', () => {
    const interrompido = esquemaDaEmissaoEmLote.safeParse({
      ...LOTE_PUBLICADO,
      estado: 'INTERROMPIDA',
      interrompidoEm: '2026-09-01T12:05:00.000Z',
      motivoDaInterrupcao: 'certificado do provedor vencido',
      emitidas: 3,
      recusadas: 1,
      itens: [ITEM_DO_LOTE_PUBLICADO],
    });

    expect(interrompido.success).toBe(true);
    expect(interrompido.data?.itens).toEqual([ITEM_DO_LOTE_PUBLICADO]);

    // Os contadores são inteiros não negativos: a contagem fracionária ou negativa é defeito de quem
    // publica, e o esquema o recusa nomeando o campo. Sem estas duas linhas, `z.number()` passaria.
    const comContagemQuebrada = esquemaDaEmissaoEmLote.safeParse({
      ...LOTE_PUBLICADO,
      emitidas: 2.5,
    });
    const comContagemNegativa = esquemaDaEmissaoEmLote.safeParse({
      ...LOTE_PUBLICADO,
      recusadas: -1,
    });

    expect([comContagemQuebrada.success, comContagemNegativa.success]).toEqual([false, false]);
    expect(comContagemQuebrada.error?.issues[0]?.path).toEqual(['emitidas']);
    expect(comContagemNegativa.error?.issues[0]?.path).toEqual(['recusadas']);
  });

  it('a conferência publica iniciadaAgora — o disparo repetido informa, e não é erro (CA-15)', () => {
    // O outro desfecho do mesmo `200`: uma execução já estava em curso, e o corpo diz **qual** e
    // **desde quando**. Sem esta linha, `iniciadaAgora: z.literal(true)` passaria por toda a suíte, e
    // a rota ficaria sem como informar o caso que a CA-15 existe para cobrir.
    const jaEmCurso = esquemaDaConferenciaBancaria.safeParse({
      ...CONFERENCIA_PUBLICADA,
      iniciadaEm: '2026-09-01T11:59:12.000Z',
      iniciadaAgora: false,
    });

    expect(jaEmCurso.success).toBe(true);
    expect(jaEmCurso.data?.iniciadaAgora).toBe(false);

    // E os dois contadores são distintos de propósito: conferiu trinta e nada mudou é `30` e `0`.
    const semEfeito = esquemaDaConferenciaBancaria.safeParse({
      ...CONFERENCIA_PUBLICADA,
      concluidaEm: '2026-09-01T12:02:00.000Z',
      cobrancasConferidas: 30,
      efeitos: 0,
    });

    expect(semEfeito.success).toBe(true);
    expect(semEfeito.data?.cobrancasConferidas).toBe(30);
    expect(semEfeito.data?.efeitos).toBe(0);
  });
});

/**
 * CT-953 — a âncora do envelope do histórico bancário, e a razão de ela ser ÚNICA.
 *
 * ---------------------------------------------------------------------------
 * Por que a âncora fica AQUI, e não sobre o corpo observado no E2E
 * ---------------------------------------------------------------------------
 *
 * Depois que a forma do envelope passou a viver em `@sysloc/contracts`, ela tem **uma** declaração, e
 * dela derivam as duas pontas: o documento OpenAPI, por `esquemaPublicado(...)`, e o tipo de retorno
 * do manipulador, por `z.infer`. Uma segunda âncora — sobre `Object.keys(corpo)` no E2E da rota —
 * seria a segunda cópia da mesma lista de chaves, livre para divergir desta: exatamente o defeito que
 * a mudança que trouxe o envelope para cá existe para fechar.
 *
 * E ela basta sozinha porque as duas direções ficam cobertas por caminhos diferentes:
 *
 * - **chave a mais no CORPO, sem passar pelo esquema** — `BoletoService.historico` devolve
 *   `TrilhaDaCobranca`, e o objeto literal do `return` com chave excedente **não compila**
 *   (`excess property check`, com `strict` do `tsconfig.base.json`). O `pnpm build` reprova antes de
 *   qualquer suíte;
 * - **chave a mais no ESQUEMA** — inclusive a opcional, que o compilador aceitaria e que faria o
 *   documento anunciar um campo que o corpo nunca traz — reprova **aqui**, na igualdade de conjunto
 *   abaixo. É a direção que a `.claude/rules/ancoras-de-superficie.md` cobra e que nada mais alcança.
 *
 * A lista esperada é escrita à mão e **não** derivada do esquema: derivá-la faria a asserção
 * concordar consigo mesma. O controle antivácuo é a própria comparação por igualdade contra uma lista
 * literal não-vazia — dois conjuntos vazios não têm como passar aqui.
 *
 * Rastreabilidade: `CA-13 → CT-953`.
 */
describe('CT-953 — o envelope do histórico bancário publica itens, e só ele', () => {
  /**
   * A chave única do envelope, escrita por extenso.
   *
   * `total`, `limite` e `deslocamento` — as três da janela — ficam de fora por decisão: não usar
   * `envelopeDeLista` é o que impede a rota de prometer uma paginação que ela não oferece (ADR-0034).
   */
  const CHAVES_DO_ENVELOPE: readonly string[] = ['itens'];

  it('declara exatamente itens — jamais o total, o limite e o deslocamento de uma janela', () => {
    const publicadas = Object.keys(esquemaDaTrilhaDaCobranca.shape);

    // Igualdade de CONJUNTO, e não contenção: `toContain('itens')` aprovaria tanto a chave que sumiu
    // quanto a que apareceu sem ninguém decidir, e é a segunda direção que o P2 do Gate 2 cobra. O
    // controle antivácuo é a própria comparação contra literal NÃO-VAZIO.
    //
    // Ela sozinha já reprova as três da janela: `total`, `limite` ou `deslocamento` no esquema — o que
    // a próxima rodada faria ao "uniformizar" a rota com `envelopeDeLista` — quebra esta igualdade e
    // nomeia a chave excedente na saída do Vitest. Uma segunda asserção filtrando por essas três seria
    // implicada por esta (passou a igualdade ⇒ o filtro é vazio) e não teria estado em que disparasse.
    expect(publicadas).toEqual([...CHAVES_DO_ENVELOPE]);
  });

  it('carrega o esquema do evento por IDENTIDADE — nunca uma cópia dos cinco campos', () => {
    // É a asserção que discrimina a redigitação: um `z.object({ tipo, origem, ... })` escrito à mão
    // aqui satisfaria o `safeParse` do envelope e passaria em toda a suíte, enquanto divergiria do
    // item no dia em que o evento ganhasse campo. A identidade referencial é o que a ADR-0016 quer
    // dizer com *"derive do esquema — nunca o duplique"*.
    expect(esquemaDaTrilhaDaCobranca.shape.itens.element).toBe(esquemaDoEventoBancario);
  });

  it('aprova a trilha vazia — cobrança sem efeito bancário é 200, e não 404', () => {
    // A lista vazia é forma legítima do envelope, e o esquema não pode exigir item: a rota responde
    // `200` com `itens: []` para a cobrança que existe e ainda não teve efeito algum. Sem esta linha,
    // um `z.array(...).min(1)` passaria por toda a suíte e derrubaria justamente esse caso.
    const vazia = esquemaDaTrilhaDaCobranca.safeParse({ itens: [] });

    expect(vazia.success).toBe(true);
    expect(vazia.data).toEqual({ itens: [] });

    // E o item é conferido de fato: um evento com `tipo` fora do enum é recusado nomeando o CAMINHO
    // dentro da lista. Sem esta metade, `z.array(z.unknown())` satisfaria as duas linhas acima.
    const comTipoInventado = esquemaDaTrilhaDaCobranca.safeParse({
      itens: [{ ...EVENTO_PUBLICADO, tipo: 'CONFERENCIA' }],
    });

    expect(comTipoInventado.success).toBe(false);
    expect(comTipoInventado.error?.issues[0]?.path).toEqual(['itens', 0, 'tipo']);
  });
});
