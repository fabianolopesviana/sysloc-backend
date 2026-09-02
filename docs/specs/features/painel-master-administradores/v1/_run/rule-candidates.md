# Rule candidates — painel-master-administradores/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Contexto de sessão sem empresa nos testes

**Regra que isto sugere:** o contexto `{ empresaId: null }` das suítes de `packages/db/test/` vive numa casa compartilhada do diretório, e não em constante local por arquivo.

**O que ela faria (simples):** o mesmo valor de contexto — o que a guarda publica para a sessão do Sysloc Master — já é declarado em dois arquivos com nomes diferentes (`CONTEXTO_SEM_EMPRESA` e `CONTEXTO_DO_MASTER`), e o próprio docblock da suíte nova reconhece a repetição. Uma regra apontando a casa compartilhada evita que a terceira cópia nasça com semântica ligeiramente diferente, que é como o produto já perdeu tempo com `CODIGO_NO_ASSUNTO`.

- Evidência: `{ empresaId: null } as const` declarado em 2 suítes de `packages/db/test/`, com nomes distintos para o mesmo valor — `packages/db/test/administrador-do-master.spec.ts:142`, `packages/db/test/isolamento.spec.ts:329` — T1 / camada de acesso do Master em @sysloc/db
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-09-01T20:05:00Z

---

## [repeated_assertion_shape] Elegibilidade afirmada por igualdade de objeto

**Regra que isto sugere:** a prévia de elegibilidade se afirma pelo objeto inteiro (`toEqual({ elegivel, impedimentos })`), nunca por `toContain` na lista nem por `length`.

**O que ela faria (simples):** o mesmo formato de asserção já aparece cinco vezes, e a razão está escrita em comentário em duas delas — contenção aprovaria uma implementação que devolvesse todas as classes de uma vez. Escrever a convenção evita que a próxima suíte da fatia (T2 em diante) afrouxe para `toContain` sem perceber que perde a detecção.

- Evidência: `expect(...).toEqual({ elegivel: ..., impedimentos: [...] })` em 5 pontos de `packages/db/test/administrador-do-master.spec.ts` (linhas 442, 463, 571, 706, 776) — T1 / camada de acesso do Master em @sysloc/db
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-09-01T20:05:00Z

---

## [convention_drift] Referência a CT de outra task

**Regra que isto sugere:** docblock que cita caso de teste ainda não entregue nomeia a task/fase que o entrega e usa tempo futuro.

**O que ela faria (simples):** o módulo afirma no presente que duas guardas executáveis existem (`CT-1215`/`CT-1216`), mas elas são entregáveis da T2 e a árvore não as tem — quem ler entre uma task e outra acredita que o mapa fechado está protegido por igualdade contra o catálogo, e nada o protege. A regra faria a referência dizer de onde vem a guarda, do mesmo jeito que os marcadores de débito já dizem.

- Evidência: docblock cita `CT-1215`, `CT-1216` e `CT-1228` como existentes; os três pertencem a tasks/fases posteriores e não estão na árvore — `packages/db/src/administrador-do-master.ts` linhas 232, 233 e 648. O sweep por `.claude/rules/` e `docs/adr/` não achou cobertura para a forma de citar caso de teste de outra task — T1 / fatia painel-master-administradores
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-09-01T20:45:00Z

---

## [repeated_assertion_shape] Estado íntegro da cobertura como constante nomeada

**Regra que isto sugere:** o estado íntegro esperado de uma guarda de catálogo se declara uma vez, em constante nomeada, e os controles antes/depois a referenciam.

**O que ela faria (simples):** o literal `{ examinadas: TABELAS_COM_LINHA_PROPRIA, excecoes: [] }` foi escrito três vezes no mesmo bloco de guardas — no caso positivo e nos dois controles do caso negativo. Uma regra apontando a constante nomeada evitaria que um dos três fosse endurecido e os outros ficassem para trás, que é o modo de falha que o Limiar de Três do `CLAUDE.md` já nomeia.

- Evidência: literal `{ examinadas: TABELAS_COM_LINHA_PROPRIA, excecoes: [] }` repetido em 3 asserções do mesmo `describe` — `packages/db/test/catalogo.spec.ts` linhas 2250, 2296, 2331 — T2 / guarda de cobertura do critério de exclusão
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-09-01T22:10:00Z

---

## [repeated_assertion_shape] Comparação limpa de vocabulário repetida por controle

**Regra que isto sugere:** a comparação de igualdade de conjunto em estado limpo se extrai como acessório que devolve a diferença, em vez de repetir o par `{ excedentes: [], ausentes: [] }` a cada controle.

**O que ela faria (simples):** o par aparece três vezes entre o caso positivo e os dois controles do caso negativo, sempre com a mesma chamada a `diferencasDeConjunto(..., Object.keys(IMPEDIMENTOS_DE_EXCLUSAO))`. Uma regra que fixasse o acessório reduziria a superfície em que a expressão do lado esquerdo pode divergir entre os controles sem que nada acuse.

- Evidência: `diferencasDeConjunto(..., Object.keys(IMPEDIMENTOS_DE_EXCLUSAO))` comparado a `{ excedentes: [], ausentes: [] }` em 3 asserções — `packages/db/test/catalogo.spec.ts` linhas 1922, 1962, 2001 — T2 / guarda de vocabulário de impedimentos
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-09-01T22:10:00Z

---

## [repeated_fixture] Abertura de unidade sob contexto de tenant nos testes de borda

**Regra que isto sugere:** o acessório que abre unidade de trabalho sob contexto de tenant mora em `apps/api/test/acessorios-de-borda.ts`, e as suítes o importam em vez de redeclará-lo.

**O que ela faria (simples):** a mesma função `emUnidade` foi reescrita à mão em nove suítes de `apps/api/test/`, já com três nomes e três assinaturas diferentes; endurecer uma delas hoje deixa as outras oito para trás, e quem escreve a décima copia da vizinha sem saber que é a décima.

- Evidência: `emUnidade`/`emUnidadeDe`/`emUnidadeDeA` declarados privadamente em 9 suítes de `apps/api/test/`, com a casa compartilhada já existindo no mesmo diretório e não exportando o símbolo — `master-administradores.e2e.spec.ts:880`, `equivalencia-com-o-oraculo.spec.ts:1172`, `boleto-da-cobranca.e2e.spec.ts:2411`, `rotinas-agendadas.e2e.spec.ts:1024`, `retomada-de-retidas.spec.ts:875`, `historico-bancario.e2e.spec.ts:1188`, `notificacao-bancaria.e2e.spec.ts:1142`, `recusa-indistinguivel.e2e.spec.ts:1576` — T4 / borda do ciclo de vida do Admin Empresa
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-09-02T03:20:00Z

---

## [repeated_fixture] Contagem crua de sessões de uma pessoa

**Regra que isto sugere:** a leitura que conta registros de `identidade.sessao` por pessoa é acessório compartilhado do diretório de teste, recebendo o acesso à identidade por parâmetro.

**O que ela faria (simples):** é a leitura que distingue *sessão encerrada* de *pessoa apenas marcada*, e ela já existe em duas suítes com o corpo idêntico linha a linha; ter duas cópias significa que corrigir a consulta numa delas deixa a outra afirmando o invariante errado em silêncio.

- Evidência: `contarSessoesDaPessoa` com corpo byte a byte idêntico em duas suítes — só o docblock difere — `master-administradores.e2e.spec.ts:868` e `administracao-de-pessoas.e2e.spec.ts:1450` — T4 / borda do ciclo de vida do Admin Empresa
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-09-02T03:20:00Z

---

## [repeated_assertion_shape] Mensagens canônicas do envelope de erro nas suítes de borda

**Regra que isto sugere:** as mensagens canônicas do envelope de erro têm uma tabela ÚNICA do lado do teste, independente da tabela que o produto usa, e as suítes a importam de lá.

**O que ela faria (simples):** onze suítes redeclaram à mão o mesmo literal de mensagem para afirmar o envelope por igualdade; a independência da tabela do produto é deliberada e correta, mas hoje ela é paga em onze cópias soltas, de modo que uma correção de texto obriga a caçar as onze e a que ficar para trás vira vermelho sem relação com o defeito.

- Evidência: o literal `'sessão inválida ou expirada'` redeclarado em 11 suítes de `apps/api/test/`, sempre no molde `expect(resposta.corpo).toEqual({codigo: CodigoErro.X, mensagem: <literal>})` — `master-administradores.e2e.spec.ts:209` e mais 10 — T4 / borda do ciclo de vida do Admin Empresa
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-09-02T03:20:00Z

---

## [convention_drift] Rota POST sem corpo fecha a entrada

**Regra que isto sugere:** rota que não recebe corpo valida `ESQUEMA_DO_CORPO_VAZIO` importado de `comum/esquema-de-corpo-vazio.ts`, nunca omite a validação.

**O que ela faria (simples):** a convenção existe de fato — nove controladores a seguem e o `CT-357` a ancora por igualdade —, mas não está escrita em rule nem em ADR: a `contrato-publicado.md` tem escopo declarado em `packages/contracts/**` e não alcança `apps/api/src/**`, e nenhum arquivo de `.claude/rules/` ou `docs/adr/` menciona corpo vazio. Sem a regra escrita, quem escreve um controlador novo copia o vizinho — e o vizinho de `/v1/master` é justamente o que não valida. Foi o que aconteceu.

- Evidência: duas rotas `POST` novas sem validação de corpo em `/v1/master` (`administrador.controller.ts:224` e `:256`), contra nove controladores que importam `ESQUEMA_DO_CORPO_VAZIO` (`comum/esquema-de-corpo-vazio.ts:41`, ancorado por `validacao.spec.ts:798`); sweep em `.claude/rules/` e `docs/adr/` não encontra o termo — T4 / borda do ciclo de vida do Admin Empresa
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-09-02T04:10:00Z

---

## [repeated_fixture] Mensagens canônicas de erro redeclaradas por suíte

**Regra que isto sugere:** as três mensagens canônicas do envelope de erro têm casa única em acessório de teste, declaradas por literal e nunca lidas de `MENSAGEM_POR_CODIGO`.

**O que ela faria (simples):** as suítes de borda comparam o corpo de erro **inteiro** por igualdade, e para isso cada uma redeclara os mesmos literais — hoje são **22** arquivos em `apps/api/test/`. A duplicação é deliberada e correta na razão (derivá-las da mesma tabela que o SUT usa faria a asserção concordar consigo mesma), mas a razão exige que os literais sejam **escritos**, não que sejam escritos 22 vezes: uma casa única em `acessorios-de-borda.ts` preserva a independência do SUT e faz uma mudança de texto reprovar em **um** lugar em vez de deixar 21 cópias para trás.

- Evidência: `const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida'` redeclarado em 22 arquivos de `apps/api/test/` — `master-administradores.e2e.spec.ts:310`, `campos-fechados.e2e.spec.ts:284`, `administracao-de-pessoas.e2e.spec.ts:357`, `carteira.e2e.spec.ts:327` e mais 18 — T5 / correção cadastral e remoção definitiva do Admin Empresa
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-09-02T07:30:00Z

---

## [scope_deviation] Âncoras de inventário fora da §5.2

**Regra que isto sugere:** task que publica, remove ou altera rota declara na §5.2 as âncoras de inventário de superfície e o índice de contagem do `CLAUDE.md`.

**O que ela faria (simples):** publicar rota obriga a tocar arquivos que a §5.2 nunca lista — as âncoras de conjunto de rotas protegidas e de tamanho da superfície, mais a contagem da suíte no `CLAUDE.md` —, e por isso toda task de rota fecha com uma divergência de escopo que o executor precisa declarar e o gate precisa reconferir. Já são **13** anotações consecutivas do mesmo débito `D26 · F2/T6`. A regra faria a §5.2 prever as âncoras, e a divergência deixaria de nascer.

- Evidência: arquivos de âncora tocados fora da §5.2 em toda task que publica rota; o próprio teste registra a ocorrência como a 13ª consecutiva — `apps/api/test/contexto.e2e.spec.ts:798` e `:775`, `CLAUDE.md:105` — T5 / rotas `PUT` e `DELETE` de `/v1/master/usuarios/:id`
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-09-02T09:40:00Z

---

## [repeated_assertion_shape] Fecho de âncora de superfície repetido por fatia

**Regra que isto sugere:** o bloco que mede os dois eixos da superfície e os compara com as três constantes vive num acessório único do arquivo de âncora, e cada CT de fatia afirma só a própria partição.

**O que ela faria (simples):** o mesmo fecho — medir manipuladores, compor o segundo eixo, afirmar a igualdade entre os eixos e comparar as quatro grandezas — está copiado palavra por palavra em 14 casos do mesmo arquivo, e cada fatia nova acrescenta a próxima cópia. Uma regra apontando o acessório evita que endurecer uma cópia deixe as outras treze para trás.

- Evidência: bloco «AS TRÊS ÂNCORAS — pelas DUAS medições independentes» idêntico em 14 casos de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` — `T7 / painel-master-administradores — âncoras de superfície`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-09-02T00:00:00Z

---

## [convention_drift] Fórmula de emenda de texto normativo

**Regra que isto sugere:** a fórmula «EMENDA de <data> … com o texto original preservado» reserva-se ao texto apensado sem editar o original; prosa viva que atualiza valor em lugar registra o valor anterior, e não invoca a fórmula.

**O que ela faria (simples):** o repositório usa essa frase com sentido estrito — nove ADRs a praticam como bloco apensado ao texto conservado, e o `CLAUDE.md` a qualifica como «byte a byte» —, mas nada disso está escrito em rule ou ADR. No mesmo diff a fórmula apareceu com dois sentidos: correta na prosa da F5 e como rótulo de uma frase de fato editada no marco de entrega. Uma regra escrita diria quando cada forma vale, e o próximo agente não precisaria inferi-la dos exemplos.

- Evidência: «com o texto original preservado» aplicado a período cujos números, preposição e duas qualificações foram alterados no mesmo diff, ao lado de uma aplicação correta da mesma fórmula 450 linhas acima — `CLAUDE.md:526` e `CLAUDE.md:77` — `T7 / painel-master-administradores`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-09-02T00:00:00Z

---
