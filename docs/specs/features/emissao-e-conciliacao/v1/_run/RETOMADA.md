# RETOMADA — `emissao-e-conciliacao/v1`

> ✅ **ARQUIVO EXAURIDO EM 2026-08-18 — a fatia FECHOU (17/17 tasks).** A pausa que este arquivo servia acabou; a
> T16 fechou (Gate 2 rodada 2 `APROVADO_COM_OBSERVACOES`) e a **T17 também** (Gate 1 `APROVADO` na rodada 2, Gate 2
> `APROVADO_COM_OBSERVACOES` na rodada 1). **Nada aqui é mais instrução — é registro histórico.** As §§1, 2, 5 e 6
> descrevem um estado que não existe mais.
>
> **O que sobreviveu, e onde ler**: o estado corrente está no `_run/run-report.md` §1 (17/17, **1596 casos**,
> superfície **99/84**) e no `CLAUDE.md`, já reconciliado. As convenções operacionais da **§7** seguem valendo e
> foram confirmadas de novo neste fecho. A baseline da §3 está **vencida** — hoje o `api` é **317** e o total
> **1596**. O `HEAD` continua em `eef3861`, sem commit: **quem commita é o usuário.**

---

## §1. Onde o run parou — a frase que decide

**A T16 está aprovada no Gate 1 e pendente APENAS do Gate 2 (rodada 2).**

**Não reexecute a T16. Não redespache executor.** O código está pronto, a suíte está verde, e as três rodadas de
correção estão fechadas. **O próximo ato é uma única invocação do `agent-spec-staff-architecture-review`.**

| | |
|---|---|
| **Tasks concluídas** | **15/17** (T1–T15) |
| **T16** | **Em Progresso** — Gate 1 rodada 3 `APROVADO_COM_OBSERVACOES`; **falta o Gate 2 rodada 2** |
| **T17** | `A Fazer` — depende de T13, T14, T15, T16 |
| **Suíte** | **1591 casos verdes**, 9 pacotes, medidos **pacote a pacote** |
| **`HEAD`** | `eef3861b89fb52cf390a2044a2d739586ff14582` — ⚠️ **não avançou, e é assim de propósito** |
| **Stage** | **136 arquivos staged**. O pipeline **nunca commita**; **quem commita é o usuário** |

---

## §2. O PRIMEIRO ATO DA RETOMADA — instruções operacionais

Despache **`agent-spec-staff-architecture-review`** em **`opus`** (o modelo escala por `critical_path` + `risk ALTO`
+ `qa_security_flags` que a rodada anterior levantou), com:

- **`scan_scope = DELTA`**, e o diff contra **`4825aee9beaf9eb7f55bad4c6c9bcadf764ae401`** — é o estado que o Gate 2
  já revisou na rodada 1. Comando: `git diff 4825aee9beaf9eb7f55bad4c6c9bcadf764ae401 -- apps packages`
- **`delta_arquivos`** (3, **exclusivamente `apps/worker`**):
  - `apps/worker/src/tarefas/emissao-em-lote.ts` (+70/−…) — **a única mudança de produção**
  - `apps/worker/test/emissao-em-lote.spec.ts` (+73) — o `CT-944 (f)`
  - `apps/worker/test/ambiente.spec.ts` (12 linhas) — **pura movimentação** (`P4`)
- **Sumário do Gate 1 (rodada 3)**: `veredito: APROVADO_COM_OBSERVACOES` · `security_flags: []` ·
  `executou_testes: true` · `escopo_testes: SUITE_COMPLETA` (**1591/1591, 9 pacotes**) · `tocou_area_critica: true` ·
  `escopo_declarado: completo`

### O que o Gate 2 precisa julgar, e só isso

1. **O `P1` dele está sanado?** O percurso *sem certificado* passou a atravessar `comReentranciaBenigna`.
2. ⚠️ **A forma que ele próprio ofereceu foi REFUTADA por medição, e o Gate 1 confirmou a refutação.** O executor
   **não replicou o `ehReentrada`** da borda irmã: generalizou `comReentranciaBenigna` para genérica e deu **entrada
   única** aos dois percursos de desfecho. **As três razões estão na §4 abaixo** — e a segunda é a que decide.
3. **Os `P2`, `P3` e `P5` foram fechados pelo ORQUESTRADOR** (escrituração — a §2 do `run-report.md` e o aviso de
   colisão do `CLAUDE.md` são artefatos dele). **Não são desta rodada.** O `P5` virou o débito **`D53`**.
4. **O `P4` está fechado** — o Gate 1 confirmou **pura movimentação**, −6/+6, nenhuma asserção tocada.

### O que NÃO se reabre — os dois gates já mediram

A **ADR-0032 cumprida nas duas cláusulas** (*"o ponto mais forte da task"*, palavras do Gate 2) · o **contexto de
tenant que discrimina** · a **reentrância medida no fonte do `bullmq@5.81.3`** · a **decisão do `D12`** (índice
`(empresa_id) WHERE concluida_em IS NULL` conferido na migração `0017:157`) · `carga-da-tarefa.ts` e
`varredura-de-segredo.ts` **não são `scope_deviation`** · o **índice de débito** (sentido 2 fecha: **30 ↔ 30**) ·
**AP-24: nada** · **nenhum marcador `DECISÃO FECHADA` tocado** · ADR-0024/0029/0008/0025/0034 ·
**`speculative_complexity` verificada e não encontrada**.

### Depois que o Gate 2 aprovar

1. Registrar o veredito no `_run/workflow-report.md` e a **métrica do Ledger** (`[T16] ledger: …`) **antes** de
   apagar a memória lazy.
2. **Escriturar na §2 do `run-report.md`** os débitos que a T16 deixou e que ainda **não** estão lá — ver §6.
3. `_run/tmp/T16.md` → **apagar**. `task_plan.md`: T16 → `Concluído`, T17 → `Em Progresso`.
4. `run-report.md` §1: **16/17 tasks · 1591 casos**.
5. `git add`, **sem commit**.
6. **Despachar a T17 na mesma resposta** (§A3 da `autonomia-do-run.md`).

---

## §3. Baseline por pacote — a única contagem confiável

⚠️ **Meça por pacote.** `turbo run test` **aborta os pacotes irmãos** e a saída agregada **não é confiável**.
O `turbo.json` declara `"cache": false` na tarefa `test`, então a medição é real, não replay.

| Pacote | Casos |
|---|---|
| `@sysloc/contracts` | **398** |
| `@sysloc/api` | **312** |
| `@sysloc/shared` | **236** |
| `@sysloc/db` | **215** |
| `@sysloc/documentos` | **151** |
| `@sysloc/worker` | **99** |
| `@sysloc/auth` | **89** |
| `@sysloc/cobranca-bancaria` | **61** |
| `@sysloc/regua` | **30** |
| **TOTAL** | **1591** |

⚠️ **Flake conhecido, registrado desde a T2**: `apps/api/test/saude.e2e.spec.ts` produz `Unhandled Rejection` do
`ioredis` (`RedisConnection.init → getRedisVersionAndType`, *"Stream isn't writeable and enableOfflineQueue options
is false"*) e a suíte sai com **exit 1 e todos os casos verdes**. **Identifique pelo nome e re-rode** — não é falha
do SUT. É caminho de **construção** de fila; o diff da T16 só altera o **fecho**.

⚠️ **Nota operacional apurada pelo Gate 1**: `pnpm --filter <pkg> test -- -t "<nome>"` **NÃO filtra** — o `--`
repassa o argumento para *depois* do `vitest run` e ele é ignorado. O caminho que funciona é
`pnpm exec vitest run -t "<trecho SEM parênteses>"` a partir do diretório do pacote (os parênteses são grupo de
regex e casam zero casos).

---

## §4. O que a rodada 3 da T16 fez, e por que a forma escolhida é superior

**O achado (`TR-P1`, `MEDIO/architecture`)**: `interromperSemCertificado` chamava `interromperLote` **fora** do
discriminador de reentrância, alcançado por um `return` antecipado **antes** de `comReentranciaBenigna`. O percurso:
tentativa 1 interrompe e comita → o processo cai antes do reconhecimento → a tarefa volta por *stall* → o
`WHERE … AND interrompido_em IS NULL` já não alcança a linha → **as três tentativas queimam e a tarefa termina
`failed` sobre um lote corretamente `INTERROMPIDA`**.

**A correção**: `comReentranciaBenigna` generalizada, e **os dois (e únicos) percursos de desfecho** passam por ela.

**As três razões para não replicar o `ehReentrada` da borda irmã** — todas medidas:

1. *"A leitura **existe nesta borda e não existe na irmã**. Usar o critério fraco onde o forte está disponível seria
   **rebaixar a discriminação de graça**."*
2. ⚠️ **A razão que decide, confirmada no fonte pelo Gate 1**: `ehReentrada` é `attemptsMade > 0 ||
   attemptsStarted > 1`, isto é, **aprova como benigna QUALQUER recusa numa reativação** — *"aplicado à borda da
   emissão, ele aprovaria **exatamente o caso GRAVE que a segunda perna do `CT-944 (d)` fixa** — o lote apagado, que
   não existe mais —, **engolindo o erro e terminando `completed` sobre um lote sem desfecho**"*.
   **A alternativa que o Gate 2 ofereceu era a pior das duas.**
3. *"Dois critérios na mesma borda **seriam a assimetria de novo, com outro nome**. A correção que fecha a classe é
   dar-lhe **entrada única**, não um segundo discriminador ao lado."* — **é a §5 do Protocolo ao pé da letra**:
   *ataque a topologia, não a ocorrência*.

**A generalização não enfraqueceu nada, e a prova é textual**: o corpo da função é **byte a byte o mesmo**; só a
assinatura mudou. **Entrada única medida**: os três pontos de escrita de desfecho estão **todos** dentro de lambdas
passadas ao discriminador.

**A âncora do `CT-944 (f)` tem duas metades, e a segunda é a fina**: `interrompidoEm` **idêntico ao carimbo da
primeira passada**, comparando **duas leituras reais do banco** pela porta de produção — *"reprova a 'correção' por
**sobrescrita idempotente**, em que a tarefa **também terminaria `completed`** mas o instante original teria sido
reescrito sem rastro"*. A vacuidade `undefined === undefined` está fechada pelo `toBeTypeOf('string')` que a precede.

---

## §5. O que a T17 herda — leia antes de despachá-la

A T17 é o **fecho da fatia**: superfície, vocabulário, autorização e reconciliação do `CLAUDE.md`.

- ⚠️ **As três âncoras de superfície já estão em `99 / 84 / 93`** (`ROTAS_PUBLICADAS_EM_PRODUCAO`,
  `MANIPULADORES_EXAMINADOS_EM_PRODUCAO`, `ROTAS_PUBLICADAS_NO_MUTANTE`), subidas pela T15 **com as duas somas
  conferidas de forma independente por dois gates**: `1+1+1+4+6+6+7+3+9+1+9+3+6+7+3+6+2+2+7 = 84` e
  `(84−1)+7+9 = 99`. **Bate com o `99/84` que a spec da T17 declara — não force o número.**
- **Correções de prosa acumuladas que a T17 absorve**: o `D44` (contagem "cinco esquemas de saída" em
  `packages/contracts/test/esquemas.spec.ts:497`, contra a `:88` que já diz seis) · o `D47` (a prosa de
  `alcance-da-fila.spec.ts` promete alcance maior que os três eixos provam) · o tech spec §5.2 *"cinco campos"*
  (são quatro) · a faixa de CT que transbordou.
- ⚠️ **O `CLAUDE.md` diz "92 rotas / 77 manipuladores"** na seção *Estado atual* — **ficou para trás**; o valor
  medido é **99 / 84**. E a linha *"F4 em andamento… faltam a (ii), a (iii) e a F5"* precisa refletir que a **(ii)
  fechou**.
- **`.env.example` e `provisionar-base.sh` já contemplam as nove variáveis** — medido na T16, com o `CT-643` verde.
  **Não acrescente linha; o que envelheceu foi a prosa.**

---

## §6. Débitos — estado e o que falta escriturar

**Índice do `CLAUDE.md`: 30 linhas.** Conferência das duas pontas feita pelo Gate 2 na T16 — **o sentido 2 fecha**:
31 pares `Dnn · F{n}/{origem}` distintos no código, menos o literal de exemplo `D99 · F7/T3` de
`packages/shared/test/protocolo-antirregressao.spec.ts:531`, dão **30** contra **30** linhas.
⚠️ O `D28 · F0/T5` aparece **42 vezes** no código para **uma** linha — **e isso é correto: ele é marcador por
consumidor**, e a linha do índice apura por `grep -rln`, que não envelhece.

**A §2 do `run-report.md` tem 52 blocos (`D1`…`D53`).** ⚠️ **Ainda falta escriturar**, no fecho da T16:

| Débito | Onde | O quê |
|---|---|---|
| **`D52`** | `apps/worker/test/varredura-de-segredo.ts` | **já escriturado** pelo executor — molde de varredura com controle positivo em 2 cópias |
| **`QA-MED-002` / `QA-MED-003`** | `emissao-em-lote.spec.ts` e `conferencia-bancaria.spec.ts` | a metade *"REGISTROU"* dos casos `(e)` não discrimina **qual** caso registrou (`vague_existence_assertion`). ⚠️ **Não é tautológica** — com o diário vazio ambas reprovam. Correção: `linhas.slice(linhasAntes)` ou o `loteId`/`conferenciaId` como discriminante |
| **`QA-BAIXO-002`** | `conferencia-bancaria.spec.ts` (`CT-948 (c)`) | limpeza no fim do corpo do caso; se uma asserção acima reprovar, **a conferência aberta segura o índice único** e o caso seguinte falha por precondição. Correção: `onTestFinished`, **já importado** |
| **`QA-BAIXO-003`** | `emissao-em-lote.spec.ts:677` | o comentário diz *"as **três** asserções seguintes"* onde seguem **quatro** |

---

## §7. Convenções deste run que a próxima sessão precisa carregar

- ⚠️ **O `HEAD` não avança.** `git add` sim, **commit nunca** — é do usuário. Confira sempre
  `git rev-parse HEAD == eef3861…` antes e depois.
- ⚠️ **Como isolar o delta de uma task**: o `git diff <base_sha>` traz **a fatia inteira**. **O `index` guarda o
  estado da task anterior**, então **`git diff -- apps packages` (SEM sha) é o delta da task corrente**. Foi assim
  que os dois gates isolaram desde a T14.
- ⚠️ **Todo `cat >> … <<` usa delimitador CITADO** (`<<'WF'`). Duas vezes neste run o delimitador não citado fez o
  shell executar as crases do texto — na segunda, nada foi gravado; na primeira, o bloco precisou ser removido e
  reescrito.
- ⚠️ **Prova**: asserção **estática** (inspeciona o **texto** do SUT) **exige** falsificação por execução; asserção
  **comportamental NÃO se executa** — o P4 proíbe, e **mutation testing está fora da stack** por decisão registrada
  em 2026-08-16. **O controle positivo de uma varredura NÃO é mutante** — é parte da asserção, e a
  `testing-stack.md` o torna **obrigatório**.
- ⚠️ **Oito AP-29 nesta fatia** (T9, T10, T11, T12/T14, T14, T15, T16), e **o padrão é sempre o mesmo**: *uma
  asserção escrita depois de outra que a implica, com a prosa creditando a prova à asserção errada*. O quinto
  **nasceu dentro da âncora criada para corrigir o quarto**; o sétimo era **o "controle antivácuo" que citava o
  AP-29 pelo nome**. **Antes de cada asserção nova, rode a pergunta-gate**: *existe estado do SUT em que esta linha é
  a **primeira** a reprovar?*
- ⚠️ **O precedente de método, agora confirmado 22 vezes**: *prescrição de gate é hipótese, não ordem* — o executor
  que divergiu **declarando e medindo** teve razão em todas. **Quatro vezes a parte refutada foi um gate**, e uma
  delas foi **um gate corrigindo o outro num ponto de segurança**.
- **Escalada de `DECISÃO FECHADA` sob a `autonomia-do-run.md` §3**: apresenta-se o texto literal contra o estado
  medido, formulam-se as alternativas, **adota-se a conservadora** (preservar byte a byte) e **registra-se** — *"a
  autorização é para **não esperar**, nunca para **contrariar**"*. Foi assim com o `D46`.

---

## §8. O que ficou fora do stage, e é de propósito

12 arquivos de `.claude/` (agentes, rules e skills do framework) seguem modificados **e não staged**. ⚠️ **Eles são
modificações PRÉ-EXISTENTES a este run** — estavam assim no `git status` de abertura da sessão, e **nenhuma task
desta fatia os tocou**. Deixe a decisão sobre eles com o usuário.
