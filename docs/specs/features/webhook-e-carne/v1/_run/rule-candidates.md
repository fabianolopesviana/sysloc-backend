# Rule candidates — webhook-e-carne/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Execução privilegiada de DDL nas suítes de db

**Regra que isto sugere:** acessório de execução privilegiada de DDL em `packages/db/test/` vive em casa compartilhada do diretório, não redeclarado por suíte.

**O que ela faria (simples):** a mesma função `executarPrivilegiado` — abrir conexão pela cadeia de migração, rodar as instruções em sequência, encerrar no `finally` — está declarada com corpo idêntico em três suítes do mesmo diretório. São três cópias livres para divergir: endurecer o tratamento de erro ou o encerramento da conexão numa delas deixa as outras duas para trás, que é exatamente o gatilho do Limiar de Três já escrito no `CLAUDE.md`.

- Evidência: `executarPrivilegiado` com corpo idêntico em `packages/db/test/catalogo-de-plataforma.spec.ts:334`, `catalogo.spec.ts:572` e `isolamento.spec.ts:4350` — T2 / guarda de admissão do schema `plataforma`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Comparação de conjuntos com nomes das diferenças

**Regra que isto sugere:** `diferencasDeConjunto` é acessório de teste de pacote, importado de `test/conjuntos.ts`, nunca redeclarado dentro de um `.spec.ts`.

**O que ela faria (simples):** a mesma função existe em cinco lugares do monorepo, e três deles são declarações locais dentro de arquivos de suíte — duas delas no mesmo diretório onde a T2 acabou de criar a casa compartilhada. Cada cópia carrega um docblock que tenta contar as outras, e a contagem já nasceu errada: o arquivo novo diz ser a segunda ocorrência do diretório quando é a terceira. Uma regra apontando a casa por pacote encerra tanto a cópia quanto a contabilidade manual dela.

- Evidência: 5 declarações — `packages/db/test/conjuntos.ts:40`, `packages/db/test/emissao-em-lote.spec.ts:604`, `packages/db/test/conferencia-bancaria.spec.ts:538`, `packages/auth/test/conjuntos.ts:35`, `packages/cobranca-bancaria/test/conjuntos.ts:38` — T2 / criação de `packages/db/test/conjuntos.ts`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [convention_drift] Migração gerada não recebe instrução autoral

**Regra que isto sugere:** arquivo de migração emitido por gerador não recebe instrução escrita à mão; a instrução autoral vive em arquivo próprio, e a exceção exige marcador `DÉBITO COM GATILHO` com gatilho concreto.

**O que ela faria (simples):** a regra existe de fato no projeto — nove cabeçalhos de migração a enunciam com as mesmas palavras — mas não está escrita em rule nem em ADR, e o único detector executável só a aplica a dois arquivos nomeados. Resultado: a `0019` misturou as duas naturezas e nada acusou. Escrever a regra faria a exceção nascer já com o marcador que diz quando ela fecha.

- Evidência: `ALTER TABLE … RENAME COLUMN` escrito à mão no fim de um arquivo declarado GERADO, cujo cabeçalho enuncia a regra que ela contraria e declara a própria regeração como esperada — `packages/db/migracoes/0019_dominio_webhook_e_carne.sql:158` e `:78`; o detector `naturezasMisturadas` (`packages/db/test/coerencia-de-migracoes.spec.ts:621`) só alcança a `0017`/`0018` por nome, e seus padrões (`CREATE POLICY`, `FORCE ROW LEVEL SECURITY`) não casam um `RENAME COLUMN`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Extração de texto de PDF em suíte

**Regra que isto sugere:** centralizar o extrator de texto de PDF (`getDocument` + percurso de `TextItem`) numa casa comum importável pelas suítes, em vez de redeclará-lo por arquivo.

**O que ela faria (simples):** o mesmo miolo de extração já existia em duas suítes e nasceu numa terceira nesta task, cada uma com a sua granularidade (documento inteiro lá, página a página aqui) e as suas opções de fonte. Cópias que divergem em silêncio fazem um caso afirmar coisa diferente da que ele diz afirmar, e uma regra apontando a casa comum evitaria a quarta cópia.

- Evidência: `getDocument` + percurso de `TextItem` redeclarado em `packages/documentos/test/mesclador-pdf.spec.ts:134`, `packages/documentos/test/renderizador-pdf.spec.ts:131` e `apps/api/test/documento-do-contrato.e2e.spec.ts:521` — T5 / porta de mesclagem do pacote documentos
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Conexão avulsa por consulta nas suítes de banco

**Regra que isto sugere:** acessório compartilhado do diretório de teste para abrir, usar e encerrar uma conexão avulsa contra a instância efêmera.

**O que ela faria (simples):** o par `abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA })` dentro de um `try`/`finally` com `await sql.end()` foi reescrito **oito vezes** nos dois arquivos novos de uma única task. Cada cópia é livre para esquecer o `finally` — e uma conexão não encerrada trava o encerramento da instância efêmera. O `CLAUDE.md` já enuncia a convenção irmã (*"acessório de suíte se importa, não se copia"*) justamente porque quem escreve suíte nova copia de **uma** vizinha e nunca conta as cópias.

- Evidência: o mesmo bloco abrir/usar/encerrar em 8 pontos — `packages/db/test/notificacao-bancaria.spec.ts:130,148,164,178` e `packages/db/test/roteamento-sem-contexto.spec.ts:316,329,342,396` — T3 / migração 0020 e módulo de acesso à notícia crua
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [convention_drift] Cast explícito em parâmetro vinculado

**Regra que isto sugere:** parâmetro vinculado em expressão SQL declara o tipo por escrito (`${x}::tipo`, ou função tipada como `make_interval(days => ${x}::integer)`), nunca por inferência do servidor.

**O que ela faria (simples):** o driver `postgres.js` manda todo número JS com tipo **não especificado** — medido: `inferType` devolve `0` —, então quem decide o tipo é o resolvedor de operadores do servidor, e a escolha muda conforme o contexto da expressão. O pacote já tem duas ocorrências que declaram o tipo e uma nova que não declara, para a mesma necessidade (N dias). A regra uniformiza e tira a correção do terreno da inferência.

- Evidência: três formas de intervalo parametrizado no mesmo pacote — `packages/db/src/notificacao-bancaria.ts:415` (`${n} * interval '1 day'`, sem cast), `packages/db/src/envio-de-cobranca.ts:428` (`make_interval(days => ${n}::integer)`) e `packages/db/src/portador-de-confirmacao.ts:206` (`${prazo}::interval`) — T3 / módulo de acesso ao cru
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-19T00:00:00Z

---

## [convention_drift] Ponteiro por número de bloco envelhece

**Regra que isto sugere:** referência cruzada a bloco numerado de migração é atualizada no mesmo diff que insere, remove ou reordena bloco naquele arquivo.

**O que ela faria (simples):** este repositório se apoia fortemente em prosa que aponta para *"o bloco N da migração X"*, e inserir um bloco no meio desloca todos os números seguintes sem que compilador, suíte ou gate percebam. Aconteceu **três vezes numa única task**, inclusive num ponteiro que passou a mandar o leitor para o bloco errado justo onde o mecanismo de segurança é explicado. A regra faz a checagem virar parte do ato de inserir o bloco, em vez de depender de memória.

- Evidência: a inserção do `RENAME` como bloco 2 da `0020` deslocou a numeração e três ponteiros escritos na mesma task ficaram defasados — `packages/db/migracoes/0019_dominio_webhook_e_carne.sql:64`, `packages/db/test/banco-efemero.ts:99` e `packages/db/test/fonte-unica-do-estado.spec.ts:45`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Espera de tarefa até estado terminal

**Regra que isto sugere:** o acessório que enfileira uma tarefa e sonda até `completed`/`failed` mora numa casa compartilhada de teste, e não numa cópia por suíte.

**O que ela faria (simples):** o mesmo laço de sondagem — enfileirar, esperar estado terminal com limite nomeado, reler o job — foi reescrito em **três** suítes de uma única task, cada cópia livre para divergir no limite ou nos estados que considera terminais. Uma regra apontando a casa compartilhada evita que endurecer uma deixe as outras duas para trás — o mesmo gatilho do `D63 · F4/fechamento`.

- Evidência: `executarTarefa`, `tratar` e `desfechoDaNoticia` em `apps/worker/test/notificacao-bancaria.spec.ts:1045`, `apps/api/test/notificacao-bancaria.e2e.spec.ts:1087` e `apps/api/test/historico-bancario.e2e.spec.ts:1101` — T7 / tratamento da notícia bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Fiação do consumidor da fila em suíte

**Regra que isto sugere:** a fiação `conectarFila` + `processar(fila.<x>, …)` que espelha a composição raiz sai de um acessório único, e não de cópia por arquivo de teste.

**O que ela faria (simples):** as três suítes que exercitam a tarefa da notícia **remontam à mão** a mesma fiação de `apps/worker/src/main.ts`, cada uma declarando por comentário que é a mesma. Quando a composição raiz ganhar uma dependência, as três precisam mudar juntas — e nada força isso hoje.

- Evidência: `conectarFila` + `processar(fila.notificacaoBancaria, …)` remontado em `apps/worker/test/notificacao-bancaria.spec.ts:1020`, `apps/api/test/notificacao-bancaria.e2e.spec.ts:594` e `apps/api/test/historico-bancario.e2e.spec.ts:471` — T7
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_fixture] Semeadura de cobrança com boleto vivo

**Regra que isto sugere:** a semeadura de conjunto, imóvel, pessoas, contrato, cobrança e boleto vivo tem um construtor compartilhado, e não uma reimplementação por suíte.

**O que ela faria (simples):** montar uma cobrança com boleto vivo custa cerca de **setenta linhas** de chamadas encadeadas às portas de produção, e essa sequência está reescrita em três suítes desta task. Quem escreve a próxima suíte copia da vizinha, e o Limiar de Três **nunca dispara** — para ele é sempre a segunda cópia.

- Evidência: `semearCobranca`, `semearCobrancaComBoleto` e `contratoAtivo` + `lancar` + `emitir` montam o mesmo estado por caminhos escritos em separado — `apps/worker/test/notificacao-bancaria.spec.ts:1316`, `apps/api/test/notificacao-bancaria.e2e.spec.ts:1198`, `apps/api/test/historico-bancario.e2e.spec.ts:764` — T7
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_assertion_shape] Afirmação de conclusão da tarefa enfileirada

**Regra que isto sugere:** a afirmação de que uma tarefa de fila concluiu se escreve numa forma única, com o estado terminal esperado como argumento.

**O que ela faria (simples):** o molde `expect(await (await <espera>).getState()).toBe('completed')` aparece **onze** vezes nas duas suítes principais, sempre com o mesmo aninhamento de dois `await`. Uma forma nomeada tornaria a intenção legível e daria **um só lugar** onde afirmar também a razão quando o estado esperado for `failed`.

- Evidência: `getState()).toBe('completed')` em 8 pontos de `apps/worker/test/notificacao-bancaria.spec.ts` e 3 de `apps/api/test/notificacao-bancaria.e2e.spec.ts` — T7
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19T00:00:00Z

---

## [repeated_assertion_shape] Conclusão da tarefa afirmada no ponto de execução

**Regra que isto sugere:** a execução de uma tarefa de fila numa suíte de borda afirma o estado terminal no mesmo ponto em que a dispara, por acessório único do arquivo.

**O que ela faria (simples):** a forma `expect(await (await executarTarefa(...)).getState()).toBe('completed')` aparece doze vezes num arquivo que já tem o acessório `tratarAviso` encapsulando-a — quem escreve um caso novo copia da linha vizinha em vez de chamar o acessório, e cada cópia fica livre para esquecer a afirmação de estado terminal e medir o resultado errado em silêncio.

- Evidência: 12 ocorrências cruas convivendo com o acessório que as consolida — `apps/worker/test/notificacao-bancaria.spec.ts:648` — T8 / borda da notícia bancária no processo de trabalho
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19

---

## [repeated_assertion_shape] Prova de que nada mudou por igualdade dupla

**Regra que isto sugere:** afirmar que um caminho não teve efeito é comparar a linha inteira da entidade **E** a lista inteira da trilha contra fotografias tomadas antes, nunca só a ausência de um campo.

**O que ela faria (simples):** o par `retratoDaCobranca(...) toEqual(retratoAntes)` mais `lerTrilha(...) toEqual(trilhaAntes)` é a forma que separa "não mudou de valor" de "não correu de novo". Sem a convenção escrita, o próximo caso de não-efeito se contenta com asserção de campo único — que passaria num produto que republica evento na trilha.

- Evidência: 3 pares idênticos de igualdade dupla em CT-980, CT-981 e CT-988 (c) — `apps/worker/test/notificacao-bancaria.spec.ts:1311` — T8 / as três camadas da idempotência
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19

---

## [convention_drift] Segunda cópia nasce com marcador

**Regra que isto sugere:** duplicação deliberada de símbolo nasce com `DÉBITO COM GATILHO` na **segunda** cópia, cujo `QUANDO FECHA` é o terceiro consumidor.

**O que ela faria (simples):** o Limiar de Três diz o que fazer quando a terceira cópia chega, mas não diz que a segunda já precisa do marcador — então quem duplica registra em prosa no docblock, e o terceiro consumidor, que chega por outro arquivo, nunca a encontra pelo `grep`. A regra fecha o furo escrevendo que o registro da segunda cópia é o que faz o gatilho da terceira **poder** disparar.

- Evidência: `motivoDaFalhaAcessoria` duplicada de `boleto.service.ts` para a borda da notícia com registro apenas em prosa, enquanto sete débitos do repositório (D3·F2/T1, D5, D49, D50, D51, D52, D58) usam a forma greppável para exatamente a mesma situação — `apps/worker/src/tarefas/notificacao-bancaria.ts:877` — T8 / borda do tratamento da notícia bancária
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-19

---

## [repeated_fixture] Arranjo de cobrança com boleto vivo

**Regra que isto sugere:** o arranjo "cobrança com boleto emitido + certificado do provedor vigente" mora numa casa compartilhada alcançável por `apps/api/test` e `apps/worker/test`, e não é recopiado por suíte.

**O que ela faria (simples):** a mesma montagem — conjunto, imóvel, pessoas, contrato, cobrança, boleto e certificado — foi reescrita pela terceira vez nesta task, e o executor precisou registrar um débito (D21) porque o Limiar de Três disparou. Uma regra apontando a casa compartilhada evitaria que a quarta suíte nascesse com a quarta cópia, livre para divergir das outras três.

- Evidência: `semearCobranca` reescrita em três suítes de fronteira real, com o mesmo encadeamento de portas de produção — `apps/api/test/retomada-de-retidas.spec.ts:1019`, `apps/worker/test/notificacao-bancaria.spec.ts:2200`, `apps/api/test/notificacao-bancaria.e2e.spec.ts:1198` — T9 / retomada de retidas na reativação
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T11:20:00Z

---

## [repeated_assertion_shape] Asserção do pagamento liquidado

**Regra que isto sugere:** a prova de que uma cobrança foi liquidada se afirma por um único acessório compartilhado que compara data e valor pagos, e não por objeto literal repetido caso a caso.

**O que ela faria (simples):** o mesmo par `{ pagoEm, valorPago }` com os mesmos dois valores derivados do arranjo é montado à mão em vinte pontos das duas suítes bancárias. Uma regra que fixasse o acessório único faria uma mudança na forma do valor pago (casas decimais, tipo) reprovar num lugar só, em vez de deixar dezenove cópias livres para divergir.

- Evidência: objeto `{ pagoEm: DATA_DO_PAGAMENTO, valorPago: VALOR_DA_COBRANCA.toFixed(2) }` repetido em 20 asserções de duas suítes — `apps/api/test/retomada-de-retidas.spec.ts:370,531,554`, `apps/worker/test/notificacao-bancaria.spec.ts:501,758` — T9 / retomada de retidas na reativação
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19T11:20:00Z

---

## [repeated_fixture] Montagem de contrato ativo nas suítes de borda

**Regra que isto sugere:** a montagem de conjunto, imóvel, locador, locatário e contrato `ATIVO` pelas rotas reais vive numa casa compartilhada de `apps/api/test/`, e se **importa** em vez de se copiar.

**O que ela faria (simples):** cada suíte de borda nova redeclara os mesmos acessórios de arranjo, e as cópias já divergem no que preenchem. Uma regra apontando a casa comum faria a suíte seguinte importar o montador em vez de copiar o da vizinha — que é a convenção que o `CLAUDE.md` já enuncia para acessório de suíte, e cujo pressuposto (*quem duplica sabe contar as cópias*) falha justamente aqui.

- Evidência: `contratoAtivo` redeclarado em 7 suítes; `corpoDeImovel`/`corpoDePessoa` em 14 cada — `apps/api/test/carne-do-contrato.e2e.spec.ts:1105`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T19:40:00Z

---

## [repeated_fixture] Arranjo de certificado vigente da empresa

**Regra que isto sugere:** o registro do certificado vigente pela porta de domínio, com validade derivada do relógio do banco, vive num acessório único das suítes de borda.

**O que ela faria (simples):** sete suítes montam o mesmo certificado com o mesmo cálculo de validade e a mesma cifra de material sorteado; endurecer uma — mudar o eixo da validade, por exemplo — deixa as outras seis para trás em silêncio. É a **quarta** ocorrência do arranjo, e já existe débito aberto para ela (`D21 · F4/T9`).

- Evidência: `registrarCertificadoVigente` e equivalentes em 7 suítes de `apps/api/test/` — `apps/api/test/carne-do-contrato.e2e.spec.ts:1054`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T19:40:00Z

---

## [repeated_assertion_shape] Recusa de rota de bytes não anuncia nem carrega PDF

**Regra que isto sugere:** toda recusa de rota que devolve bytes é afirmada pelo par *"os bytes não começam por `%PDF-`"* e *"o cabeçalho de disposição não foi escrito"*, avaliado **antes** da igualdade do envelope.

**O que ela faria (simples):** o mesmo par de asserções se repete em seis pontos só nesta suíte, e outros tantos na suíte do boleto — sempre com a mesma armadilha de ordem: posto **depois** da igualdade do corpo, ele deixa de poder reprovar. Escrever a forma como regra fixa a **ordem** junto com o par, que é exatamente o defeito que esta rodada de gate pegou duas vezes.

- Evidência: `expect(textoInicialDe(...)).not.toBe(ASSINATURA_DO_PDF)` seguido de `expect(...disposicao).toBe('')` em 6 pontos — `apps/api/test/carne-do-contrato.e2e.spec.ts:671`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19T19:40:00Z

---

## [scope_deviation] Âncoras de igualdade fora da §5.2

**Regra que isto sugere:** a §5.2 declara **todas** as classes de âncora que a publicação faz crescer — rota, símbolo de barril e inventário de contexto —, e não apenas a de cobertura de autorização.

**O que ela faria (simples):** a `ancoras-de-superficie.md` só dá exemplo com `cobertura-de-autorizacao.e2e.spec.ts`, e por isso as specs vêm declarando esse arquivo e esquecendo os outros dois tipos de âncora de igualdade que existem nesta base — o inventário de rotas protegidas de `contexto.e2e.spec.ts` e o conjunto exato de símbolos do barril em `unidade-de-trabalho.spec.ts`. O executor é obrigado a tocá-los assim mesmo (sem isso a suíte fica vermelha) e o toque reaparece depois como desvio de escopo no Gate 2. O próprio código já contabiliza a repetição: o comentário acrescentado em `contexto.e2e.spec.ts` se declara a *"décima quinta anotação consecutiva"* do débito D26 (F2/T6). A regra faria a spec listar as três classes de âncora de uma vez.

- Evidência: a task declara `cobertura-de-autorizacao.e2e.spec.ts` na §5.2 e omite `contexto.e2e.spec.ts` e `unidade-de-trabalho.spec.ts`, ambos âncoras de igualdade que a publicação de rota/símbolo torna obrigatórias; o escopo de validação declarado omite o pacote `@sysloc/db` inteiro, onde a ADR-0023 obriga o SQL a nascer — `apps/api/test/contexto.e2e.spec.ts:661`, `packages/db/test/unidade-de-trabalho.spec.ts:1496`, `packages/db/src/cobranca.ts:985` — T10 / rota do carnê e seleção do recorte no banco
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-19T19:05:00-03:00

---

## [repeated_fixture] Prefixo efêmero de nginx para validação

**Regra que isto sugere:** o arranjo de prefixo efêmero do nginx (nginx.conf mínimo com os seis caminhos temporários) tem casa compartilhada e se importa, não se copia.

**O que ela faria (simples):** o mesmo bloco de configuração mínima do nginx — `worker_processes`, `events` e os seis `*_temp_path` que evitam escrita fora do prefixo — foi escrito duas vezes na mesma task, uma no instalador e outra no verificador, e as duas cópias já podem divergir sem que nada acuse. A convenção do repositório (*"acessório de suíte se importa, não se copia"*) e o Limiar de Três apontam para uma casa comum em `deploy/scripts/`, e escrevê-la agora evita que a terceira cópia nasça diferente.

- Evidência: heredoc de `nginx.conf` mínimo idêntico em dois arquivos da mesma task — `deploy/scripts/borda/instalar-borda-de-notificacao.sh:299` e `deploy/scripts/borda/verificar-notificacao-bancaria.sh:656` — T11 / borda externa da notícia bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-19T19:50:00-03:00

---

## [repeated_assertion_shape] Recusa da borda afirmada por tripla codigo|origem|location

**Regra que isto sugere:** a recusa medida na borda se afirma pela tripla `codigo|origem|location` comparada por igualdade, junto com o não-incremento da trilha do serviço.

**O que ela faria (simples):** o mesmo par de asserções — a tripla `"404||"` e a contagem da trilha inalterada — aparece em cinco lugares do verificador, e é um molde bom: prova de uma vez o status, a ausência de cabeçalho do serviço, a ausência de `Location` e o não-repasse. Escrevê-lo como convenção faz o próximo verificador de borda nascer com as quatro provas em vez de só com o status.

- Evidência: `afirmar_igual "… é recusado com 404, sem cabeçalho do serviço" "404||"` seguido do `afirmar_igual` do não-repasse, em cinco pontos — `deploy/scripts/borda/verificar-notificacao-bancaria.sh:738,745,755,762` — T11 / CT-1005 (c), medição de rede contra a borda efêmera
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-19T19:50:00-03:00

---
