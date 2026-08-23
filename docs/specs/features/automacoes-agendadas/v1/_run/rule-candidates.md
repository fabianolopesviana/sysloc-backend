# Rule candidates — automacoes-agendadas/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Âncora de conjunto declarado lida do fonte

**Regra que isto sugere:** conjunto fechado espelhado num teste é lido do fonte por um `ler<X>()`, afirmado por `toEqual` contra uma lista `Object.freeze`, e acompanhado de uma cópia mutada que reprova nomeando o intruso.

**O que ela faria (simples):** a mesma forma de três partes — leitura do fonte, igualdade sobre a lista congelada e falsificação por cópia com o item plantado — já se repete em três âncoras de dois pacotes, e cada task nova a redescobre pela suíte vermelha em vez de a encontrar escrita. Uma regra apontando a forma canônica evitaria que a próxima cópia nasça sem a metade da falsificação, que é a metade que se esquece.

- Evidência: `toEqual` sobre lista `Object.freeze` lida do fonte, com falsificação por cópia mutada, em 3 âncoras — `packages/db/test/cobranca.spec.ts:707`, `packages/shared/test/fila.spec.ts:845` — T2 / contrato de fila em `@sysloc/shared` e âncora do `CT-512 (b)` em `@sysloc/db`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-22T00:00:00Z

---

## [repeated_assertion_shape] Tabela nova de negocio entra em cinco listas de conjunto exato

**Regra que isto sugere:** toda tabela nova do schema `negocio` acrescenta uma entrada às cinco âncoras de conjunto fechado do produto, e a §5.2 da task as declara antes da execução.

**O que ela faria (simples):** a mesma forma de asserção — um roster fechado de TODAS as tabelas de `negocio`, comparado por igualdade de conjunto — está repetida em cinco pontos, em três arquivos de teste e um script de shell. O executor descobriu dois deles pela suíte vermelha e teve de tocá-los fora do escopo declarado, gastando justificativa que uma regra escrita teria dispensado; uma regra apontando os cinco pontos faria a §5.2 da task já nascer completa.

- Evidência: roster fechado de tabelas de `negocio` asserido por igualdade em 5 pontos — 4 deles precisaram receber `execucao_de_rotina` nesta task — `packages/db/test/catalogo.spec.ts:284`, `packages/db/test/papel-de-conexao.spec.ts:140`, `deploy/scripts/instalacao/verificar-migracao.sh:237` — T3 / tabela `negocio.execucao_de_rotina`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-22T00:00:00Z

---

## [repeated_fixture] Abertura de unidade de trabalho nas suítes de dados

**Regra que isto sugere:** o acessório que abre contexto de tenant mais unidade de trabalho tem casa compartilhada por diretório de teste, e as suítes o importam em vez de redeclará-lo.

**O que ela faria (simples):** a função `emUnidade` (contexto + unidade de trabalho) foi redeclarada, praticamente idêntica, em 16 suítes de `packages/db/test/` — a T4 acrescentou a décima sexta. Cada cópia é livre para divergir no tamanho da reserva, no tratamento de erro e na forma de abrir o contexto, e quem escreve uma suíte nova copia da vizinha, de modo que o Limiar de Três nunca dispara. Uma regra apontando uma fábrica compartilhada (`criarEmUnidade(acesso)`) faria a próxima suíte importar em vez de copiar.

- Evidência: 16 declarações locais de `emUnidade` em `packages/db/test/**`, ao lado de quatro acessórios já compartilhados no mesmo diretório (`banco-efemero.ts`, `conjuntos.ts`, `varredura-de-fontes.ts`, `relogio-da-operacao.ts`) — `packages/db/test/execucao-de-rotina.spec.ts:249` — T4 / porta do registro de execução de rotina em `@sysloc/db`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Acesso dedicado por conexão em teste de concorrência

**Regra que isto sugere:** centralizar num acessório de `packages/db/test/` a abertura de acesso com reserva de uma conexão, em vez de repetir o literal de configuração em cada caso concorrente.

**O que ela faria (simples):** o mesmo par `{ cadeiaDeConexao, maximoDeConexoes: RESERVA_DE_UMA }` foi redigitado oito vezes na mesma suíte, uma por conexão dedicada de caso concorrente; uma regra apontando o acessório evita que uma delas ganhe reserva diferente das demais e mude silenciosamente o que o caso mede.

- Evidência: abertura de acesso com reserva de uma conexão repetida em 8 pontos do mesmo arquivo — `packages/db/test/encerramento-de-contratos.spec.ts:474` — T5 / encerramento de contratos vencidos
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_assertion_shape] Recusa do banco afirmada por SQLSTATE nomeado

**Regra que isto sugere:** afirmar toda recusa vinda do Postgres pelo `SQLSTATE` em constante nomeada, e nunca só pelo insucesso da chamada.

**O que ela faria (simples):** a mesma forma `expect(sqlstate(erroDe(...))).toBe(CONSTANTE)` aparece em três casos desta suíte, e é o que separa *"rejeitou"* de *"rejeitou pelo motivo que o caso nomeia"*; escrita como regra, ela impede que uma suíte nova se contente com `ok === false` e fique verde sobre qualquer defeito do arranjo.

- Evidência: `expect(sqlstate(erroDe(...))).toBe(TRAVA_INDISPONIVEL | VIOLACAO_DE_NAO_NULO | VIOLACAO_DE_UNICIDADE)` — `packages/db/test/encerramento-de-contratos.spec.ts:510` — T5 / CT-1064, CT-1066 e CT-1069 (b)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [scope_deviation] Publicar símbolo no barril arrasta a âncora de igualdade

**Regra que isto sugere:** task que declara `packages/db/src/index.ts` na §5.2 declara junto `packages/db/test/unidade-de-trabalho.spec.ts`, cuja igualdade de `SIMBOLOS_ESPERADOS` a exportação obriga a editar.

**O que ela faria (simples):** o `CT-012` afirma **igualdade** sobre o conjunto de símbolos do barril, então exportar um símbolo novo sem tocar essa lista deixa a suíte vermelha — a edição não é opcional, é consequência mecânica. Como a §5.2 não a declara, o executor é forçado a exceder o escopo declarado só para manter a suíte verde, e o gate precisa julgar toda vez se aquilo foi excedência ou obrigação. A regra faria o gerador emitir os dois arquivos como par, e a excedência sumiria por construção.

- Evidência: §5.2 declara `index.ts` mas omite `unidade-de-trabalho.spec.ts` — ocorreu na **T4** e se repetiu na **T5**; a T3, que não publicou símbolo, declarou o arquivo corretamente — `docs/specs/features/automacoes-agendadas/v1/tasks/T5.md:135` — T5 / camada de dados, barril de `@sysloc/db`
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Abertura de unidade sob contexto nas suítes de app

**Regra que isto sugere:** as suítes de `apps/*/test/` importam o abridor de unidade sob contexto de uma casa compartilhada **do próprio app**, nunca o declaram localmente nem o importam de `packages/db/test/`.

**O que ela faria (simples):** o acessório `emUnidade` está redeclarado em **10** suítes de `apps/worker/test/` e `apps/api/test/`, e a casa compartilhada que existe (`packages/db/test/unidade-sob-contexto.ts`) é **inutilizável dali**, porque resolve o contexto pelo **fonte** enquanto os apps resolvem `@sysloc/db` por **`dist/`** — dois `AsyncLocalStorage`, e toda escrita cai em violação de política de linha. Uma regra apontando a casa certa **por camada** evitaria que cada suíte nova nascesse com a enésima cópia e que a fronteira `dist`/fonte fosse redescoberta por tentativa a cada vez.

- Evidência: `emUnidade` declarado localmente em 10 suítes de app; `packages/db/test/unidade-sob-contexto.ts:43` importa `../src/contexto.ts` (fonte) e `packages/db/package.json` publica `exports` para `./dist/index.js` — `apps/worker/test/rotina-agendada.spec.ts:802` — T6 / borda das quatro rotinas por empresa
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Arranjo de cobrança com boleto e certificado

**Regra que isto sugere:** o cenário *"cobrança com boleto + certificado vigente + identidade no provedor"* tem uma casa compartilhada **por camada de consumo**, e a quinta cópia dele não se escreve.

**O que ela faria (simples):** o mesmo arranjo foi montado do zero pela **quarta** vez, porque a casa compartilhada existente vive em `packages/db/test/` e não é alcançável de `apps/*/test/` pela fronteira `dist`/fonte. Uma regra que fixasse onde esse cenário mora por camada evitaria que endurecer uma cópia deixasse as outras três para trás.

- Evidência: quarta cópia do arranjo, declarada no docblock de `semearCenarioBancario` e escriturada como agravamento do `D21 · F4/T9` — `apps/worker/test/rotina-agendada.spec.ts:1096` — T6 / CT-1085
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_assertion_shape] Igualdade de conjunto por excedentes e ausentes

**Regra que isto sugere:** a afirmação de igualdade de conjunto em suíte usa um acessório compartilhado que já embute o par `{ excedentes: [], ausentes: [] }`, em vez de o caso reescrever o literal.

**O que ela faria (simples):** o mesmo par literal fecha **nove** asserções só neste arquivo, e o bloco novo do `CT-1087` já sentiu o atrito ao extrair um `afirmarAcervo` local para a própria seção. Uma regra apontando o acessório evita que cada suíte reinvente o invólucro e que uma cópia **esqueça um dos dois lados** — afirmar só `excedentes` deixa de pegar o arquivo que **sumiu**, que é metade do que a asserção existe para provar.

- Evidência: o par `{ excedentes: [], ausentes: [] }` escrito por extenso em 9 asserções — `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts:603` — T7 / expurgo do acervo de boletos
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Cadeia de cadastro do worker em casa compartilhada

**Regra que isto sugere:** a cadeia `conjunto → imóvel → pessoas → contrato` de `apps/worker/test/` mora num acessório compartilhado **do diretório**, não numa cópia por suíte.

**O que ela faria (simples):** a mesma montagem foi escrita **duas vezes** em suítes irmãs do worker porque a casa de `packages/db/test/` é **inutilizável dali** — ela resolve `contextoDeTenant` pelo fonte e o worker o resolve por `dist/`, o que dá **duas instâncias de `AsyncLocalStorage`** e derruba toda escrita do arranjo na política de RLS. Uma regra que aponte a casa certa **por pacote** evita que a terceira suíte descubra isso de novo pela suíte vermelha, que é o caminho caro.

- Evidência: `semearCadeia(contexto, marcaBase)` em duas suítes de `apps/worker/test/`, com a razão da não-reutilização medida e escrita no docblock de uma delas — `apps/worker/test/despachante.spec.ts:1433` — T8 / despachante efêmero
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Lançador de subprocesso com ambiente explícito

**Regra que isto sugere:** exercitar ponto de entrada como subprocesso usa um **lançador único da casa compartilhada**, com o ambiente montado **variável a variável** e **nunca herdado**.

**O que ela faria (simples):** duas suítes já escrevem privadamente o mesmo lançador, e a parte que importa é sempre a mesma: **herdar `process.env` faria a prova de "a partida recusa sem a variável" depender do host que roda a suíte**. Escrita como convenção, ela impede que a terceira cópia nasça com o `env` herdado por descuido e **passe verde por acidente**.

- Evidência: `executarDespachante` e `executarCenario` são declarações privadas do mesmo lançador, em pacotes diferentes; um terceiro `spawn(process.execPath, …)` existe em `packages/shared/test/reserva-de-porta.spec.ts:142` mas **herda** o ambiente e serve a outro propósito — `apps/worker/test/despachante.spec.ts:985` — T8 / partida do despachante como processo separado
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T00:00:00Z

---

## [repeated_fixture] Cópia de deploy/systemd para diretório temporário

**Regra que isto sugere:** o acessório que copia `deploy/systemd/` para um diretório temporário aplicando mutações vive numa casa compartilhada e se importa, nunca se redeclara na suíte nova.

**O que ela faria (simples):** duas suítes de pacotes diferentes declaram cada uma a sua `copiarUnidades` privada para provar propriedades das mesmas unidades systemd, e a segunda nasceu copiando o molde da primeira — o docblock dela diz isso com todas as letras. Com duas cópias, endurecer uma (tratar link simbólico, preservar permissão, mutar por linha em vez de por texto) deixa a outra para trás. É a convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md` sendo contornada pela via que o Limiar de Três não alcança: para quem escreve a suíte nova é sempre a segunda cópia, nunca a enésima.

- Evidência: `copiarUnidades` declarada em duas suítes de pacotes distintos, ambas copiando `deploy/systemd/` para tmpdir com defeito plantado — `packages/db/test/cobranca.spec.ts:2912` e `packages/shared/test/unidades-agendadas.spec.ts:619`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T12:20:00Z

---

## [repeated_fixture] Varredura de vocabulário de processo em mensagem de usuário

**Regra que isto sugere:** a lista de jargão de processo proibido em texto lido pelo usuário e o filtro que a aplica vivem numa casa compartilhada, e não em constante privada de cada suíte.

**O que ela faria (simples):** a mesma lista de nove termos (`null`, `sqlstate`, `constraint`, `negocio.`, `jsonb`…) e o mesmo filtro `processoNaMensagem` foram escritos duas vezes, em pacotes diferentes, porque a primeira cópia mora dentro de um arquivo `.spec.ts` e importar de lá executaria os casos daquela suíte. Uma regra apontando a casa certa (um `.ts` sem `.spec` ao lado, no molde de `apps/api/test/documento.ts`) evita que a terceira cópia nasça já divergente da primeira — que foi exatamente como a flag `u` de `CODIGO_NO_ASSUNTO` divergiu no `D54 · F3/T11`.

- Evidência: `VOCABULARIO_DE_PROCESSO` + `processoNaMensagem` declarados integralmente em `apps/api/test/rotinas-agendadas.e2e.spec.ts:251` e `packages/db/test/execucao-de-rotina.spec.ts:449`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-23T12:35:00Z

---

## [repeated_assertion_shape] Guarda do catálogo fechado repetida caso a caso

**Regra que isto sugere:** a guarda de que o catálogo de permissões não cresceu é afirmada uma vez por suíte, e não recopiada no fecho de cada caso que publica rota.

**O que ela faria (simples):** o par `expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO)` + `expect(CHAVES_DE_TELA.length + Object.keys(MAPA_ACAO_TELA).length).toBe(TOTAL_DE_CHAVES)` já aparece sete vezes no mesmo arquivo — o CT-1095 acrescentou a sétima. É a mesma invariante global (o catálogo é fechado em 10 telas × 7 ações) reprovando em sete lugares quando mudar, sem ganho de detecção sobre a primeira. Uma regra dizendo onde essa guarda mora deixaria cada caso afirmando só o que é dele.

- Evidência: mesma dupla de asserções sobre `CHAVES_DE_TELA`/`MAPA_ACAO_TELA` no fecho de 7 casos de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` (6203, 6038, 5887, 5762, 5575, 5391)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-23T12:35:00Z

---
