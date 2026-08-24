---
description: Stack de teste do projeto Sysloc — as duas frentes (shell para infraestrutura, Vitest para código de aplicação), frameworks por camada, comando canônico, convenções de arquivo, fronteiras de execução real e política de qualidade. Fonte de verdade consumida por agent-spec-qa-validator (Gate 1) e agent-spec-qa-test-generator. Gerada por agent-spec-testing-stack-bootstrap.
paths:
  - "apps/**"
  - "packages/**"
  - "deploy/scripts/**"
  - ".claude/skills/agent-spec-*-run*/**"
  - ".claude/skills/agent-spec-minispec-generate-tasks/**"
  - ".claude/skills/agent-spec-sdd-generate-tech-spec/**"
  - ".claude/skills/agent-spec-taskcard-generate/**"
  - ".claude/skills/agent-spec-testing-best-practices/**"
---

# Stack de Teste do Projeto

> Gerada por `agent-spec-testing-stack-bootstrap` em 2026-07-31, **enriquecida em 2026-08-16**.
> Atualize via a mesma skill.
> Fonte de verdade de stack para os agentes de QA — eles não carregam idiomas de linguagem nenhuma; tudo que é específico deste projeto vive aqui.

## Identificação

- **Linguagens**: TypeScript 7.0.2 (código de aplicação) · Bash (infraestrutura e instalação)
- **Runtime**: Node 24.18.1, fixado em `.mise.toml`
- **Gerenciador de pacotes**: pnpm 11.18.0 (monorepo com Turborepo 2.10.7)
- **Runner**: Vitest 4.1.10 — declarado na raiz; cada pacote traz o próprio `vitest.config.ts`, e a raiz só declara quem participa
- **Frente**: backend. Sem UI, sem mobile.

## As duas frentes de teste — leia antes de decidir onde um teste mora

Este projeto testa em **duas linguagens, com propósitos disjuntos**. Confundi-las é erro de placement:

| Frente | Objeto sob teste | Runner |
|---|---|---|
| **Shell** | O que só existe fora do processo Node: pacotes instalados no SO, unidades systemd, portas, permissão de arquivo, idempotência de script, higiene de segredo na árvore versionada | `bash`, sem framework |
| **TypeScript** | Código de aplicação: regra de domínio, rota HTTP, processador de fila, contrato de erro | Vitest |

**Critério**: se o invariante só é observável inspecionando o sistema operacional, o git ou o filesystem, é shell. Se é observável chamando código, é Vitest. Um teste de shell que poderia ser Vitest está no lugar errado — e o contrário também.

> **As duas frentes estão materializadas.** Todo pacote do workspace declara a tarefa `test`, e os
> verificadores de shell vivem em `deploy/scripts/<área>/verificar-<alvo>.sh`. **Não presuma
> contagem**: o número de casos e de verificadores muda a cada fatia, e um total escrito aqui
> apodrece na seguinte. Meça quando precisar — `pnpm --filter @sysloc/<pacote> test` por pacote (o
> `turbo run test` **aborta os pacotes irmãos** quando um falha, e a saída agregada não carrega
> contagem confiável dos interrompidos), e `ls deploy/scripts/*/verificar-*.sh` para a frente shell.

## Frameworks de teste por camada

| Camada | Framework | Libs de assert/mock |
|---|---|---|
| Unit (TS) | Vitest | asserção nativa do Vitest; mock só quando inevitável (ver "Fronteira de execução real") |
| Integração (TS) | Vitest + `embedded-postgres` (instância efêmera própria) | — |
| E2E (TS) | Vitest exercitando HTTP real contra servidor em porta dinâmica | — |
| Infraestrutura | Bash, convenção própria (abaixo) | — |

## Comando de teste

- **Suíte TypeScript completa**: `pnpm test` (→ `turbo run test`)
- **Subset**: `pnpm --filter @sysloc/<pacote> test`
- **Um teste**: `pnpm --filter @sysloc/<pacote> test -- -t "<nome>"`
- **Verificador shell**: `bash deploy/scripts/<área>/verificar-<alvo>.sh`
- **TODAS as baterias de shell de uma vez**: `sudo bash deploy/scripts/verificacao/rodar-baterias.sh`
  (aceita filtro por nome — `… rodar-baterias.sh isolamento` roda uma só). Executa cada bateria com o
  privilégio que ela exige, e distingue **pré-condição de ambiente** de reprovação (saída 2 contra 1).
  ⚠️ **Existe porque metade das baterias exige `sudo` e por isso ninguém as executava**: a primeira
  varredura, em 2026-08-23, encontrou o `CT-647` quebrado havia três fatias e o banco durável cinco
  migrações atrás do repositório — **nenhum dos dois constava de débito algum**.
- **Análise estática da frente shell**: `pnpm lint:shell` (encadeado dentro de `pnpm lint`). É
  `shellcheck --severity=error` sobre `deploy/scripts/**/*.sh`, com o binário fixado em `.mise.toml`.
  **Existe porque `biome check` não processa shell e `turbo run lint` resolve para 0 tarefas ali** —
  a frente shell passou de 2.700 linhas sem análise estática nenhuma (débito D16 da F1).
  **Severidade `error` é o piso, não o teto**: foi escolhida por passar limpa hoje (0 achados),
  enquanto `warning` tem 7, `info` 48 e `style` 51. Subir o degrau é trabalho declarado, e os 7
  `warning` são o próximo — nenhum deles é defeito de comportamento (dois `SC2034` de constante
  consumida por `nameref`, um `SC2155`, um `SC2043` de laço sobre lista de um elemento, um `SC2115`
  sob `set -u`, um `SC2010`).
- **Bateria agregada da fatia**: `bash deploy/scripts/instalacao/verificar-fundacao.sh` (nasce em T7; agrega os verificadores da F0 **em ordem**, sem paralelizar)

**Privilégio**: os verificadores de `deploy/scripts/instalacao/` que tocam o SO exigem `sudo`, e **`sudo` neste host pede senha interativa**. Nenhum subagente consegue executá-los. Quando um gate precisar deles, a execução é conduzida pelo orquestrador junto ao operador, e o gate audita a saída preservada. Nessa situação o QA reporta `executou_testes: false` — isso reflete o papel dele, **não** suíte pulada, e deve ser declarado como tal.

## Convenções de arquivo

**TypeScript**
- **Nomenclatura**: `*.spec.ts`; E2E usa `*.e2e.spec.ts`
- **Localização**: `test/` dentro de cada pacote, espelhando `src/` — não co-localizado
- **Config**: `vitest.config.ts` na raiz do monorepo

**Shell**
- **Nomenclatura**: `verificar-<alvo>.sh`, em `deploy/scripts/<área>/`
- **Estrutura obrigatória**: `#!/usr/bin/env bash` + `set -euo pipefail` + `trap limpar EXIT` (mais `INT`/`TERM`/`HUP` quando o script cria recurso que precise de limpeza)
- **Vocabulário de asserção** — derivado de `verificar-golden.sh`, replicado em 4 scripts:

  | Função | Papel |
  |---|---|
  | `caso "CT-NNN — descrição"` | abre um caso; o ID literal preserva a rastreabilidade auditada pelo gate |
  | `ok "rótulo"` | asserção verde |
  | `falhar "rótulo"` | incrementa `falhas_totais` |
  | `afirmar_igual "rótulo" "esperado" "obtido"` | comparação literal |
  | `afirmar_diferente "rótulo" "não esperado" "obtido"` | negativa |
  | `fechar_caso` | fecha e contabiliza |
  | `aviso` / `nota` | degradação declarada e diagnóstico — nunca contam como falha |

- **Contrato de saída** — **o invariante primeiro, os códigos depois**. `exit 0` **se e somente se**
  `falhas_totais == 0`; qualquer código **não-zero é reprovação**, sempre com o resumo em `stderr`.
  Sobre esse invariante, os códigos em uso:

  | Código | Significa |
  |---|---|
  | `0` | zero falhas — e **nenhum outro caminho** produz verde |
  | `1` | reprovou **o que o verificador existe para provar** |
  | `2` | o que o verificador prova está **íntegro**, e o único vermelho é a **saúde da suíte daquele host** — com o pacote e a contagem **nomeados** na linha de fecho |

  O `2` nasceu em `deploy/scripts/documentos/verificar-isolamento-de-verificacao.sh` (T12 da fatia
  `documentos-e-confirmacao`), **por prescrição do Gate 2**, e a razão é medida: fundir as duas
  naturezas num código só faz o verificador **nunca sair verde** num host com flake conhecido — e a
  primeira reação a um vermelho recorrente é deixar de lê-lo, levando junto o dia em que a asserção
  de verdade reprovar. Um verificador **não é obrigado** a usar o `2`; quem usar, documenta os
  códigos no próprio cabeçalho.
  ⚠️ **Verificador que agrega outros compara com `0`, nunca com `1`.** É o que mantém qualquer código
  novo lido como reprovação sem emendar o agregador — `verificar-fundacao.sh` já faz assim
  (`afirmar_igual "${nome} sai 0" "0" "${codigo}"`), e é por isso que o `2` não abriu buraco nele.
- **Degradação**: ferramenta ausente no host **nunca** faz o caso passar em silêncio — emita `aviso` explícito nomeando o que foi pulado

## Rastreabilidade — convenção herdada, obrigatória

`CA-xx → CT-xxx (RN-xx)`, com seção de **INVARIANTES** por arquivo de teste. Vem do backend Frappe e **sobrevive à migração** (`CLAUDE.md`). Vale nas duas frentes: no shell, o ID entra literalmente no `caso "CT-NNN …"`; em Vitest, no nome do `describe`/`it`.

## Fronteira de execução real

- **Banco**: `embedded-postgres` — instância efêmera **própria** por execução, descartada sem deixar diretório de dados nem processo órfão
- **Fila**: instância efêmera própria, com `parar()`/`religar()` **preservando o diretório de dados** (requisito de CA-10)
- **HTTP**: servidor real em porta dinâmica
- **Shell**: SO, filesystem e git reais, sempre em sandbox descartável (clone efêmero, `tmpfs`, diretório temporário) — **nunca** na árvore de trabalho quando houver sandbox equivalente disponível

**Camadas que DEVEM atravessar fronteira real**: repositório, rota HTTP, processador de fila, e todo verificador de infraestrutura.

**Mock**: evitado por decisão, e a medição mostra que a decisão pegou — o dublê existe em **um** arquivo de suíte. Não presuma esse número: a conta se refaz em uma linha.

```bash
grep -rlnE --include='*.spec.ts' --exclude-dir=dist 'vi\.(mock|fn|spyOn|useFakeTimers|setSystemTime)' apps packages
```

A razão original vale além da F0, que é onde ela foi escrita: mock não prova recuperação, persistência nem idempotência — justamente as propriedades que as camadas de fronteira real existem para provar. Quando um dublê for inevitável, asserte argumentos e número de chamadas, nunca apenas "foi chamado".

## ADRs de teste grep-detectáveis

- **ADR-0006** (a suíte nunca executa contra o ambiente que atende a operação): o helper de banco efêmero **ignora `process.env.DATABASE_URL` por construção**. Grep: `process\.env\.DATABASE_URL` em `packages/*/test/**` e `apps/*/test/**` — qualquer ocorrência num helper de fixture é violação. A prova positiva é um caso que exporte `DATABASE_URL` apontando para destino impossível e demonstre que a suíte subiu a instância efêmera assim mesmo.
- **ADR-0006** (imposição em shell): verificador que reinicie serviço ou reexecute provisionamento consulta `recusar_bateria_em_producao` antes do primeiro caso. Grep: presença do guarda no `main` de `deploy/scripts/instalacao/verificar-*.sh`.
- **ADR-0005** (nenhum script carrega credencial): grep `set[[:space:]]+-x` = 0 e `(--password[= ]|--dbpassword[= ]|PGPASSWORD=)` = 0 em `deploy/scripts/**/*.sh`. Segredo trafega por **entrada padrão** ou arquivo 0600 (`PGPASSFILE`) — **nunca** por `argv`, nunca por variável exportada.
- **ADR-0017** (forma canônica do contrato, três classes de chave): o corpo de erro asserido nos testes de rota corresponde **literalmente** ao envelope da ADR — `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` de enum fechado, sobre status HTTP semântico. Asserte o **objeto inteiro**, nunca a presença de campos. A forma vai reproduzida aqui de propósito: a ADR da forma do contrato já foi substituída duas vezes, e um ponteiro sozinho passa a apontar para texto morto a cada elo da cadeia — sem que quem lê a rule descubra que precisa resolvê-la.
- **ADR-0032** (segredo operável de terceiro não retorna por superfície alguma): a `Decision` é literal quanto ao **método**, e não apenas quanto ao fato — a ausência de vazamento é afirmada por **medição da saída real**, nunca por leitura do código. Não há grep que a prove; o que se grepa é a **violação do método**: asserção de não-vazamento que inspecione o fonte em vez de varrer o que saiu. A forma canônica está em `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (corpo de resposta, corpo de erro, arquivo de diário do processo, documento publicado e estado em repouso no banco) e em `packages/shared/test/segredo-operavel.spec.ts` (as três serializações do invólucro). ⚠️ **Toda varredura carrega controle positivo** — a mesma função aplicada a um objeto onde as agulhas foram plantadas canal a canal, com a lista de achados afirmada por igualdade. Sem ele, a varredura que nunca acha nada aprovaria um produto vazando tudo, que é o **AP-29** (`tautological_assertion`).

## Rules irmãs que o QA carrega junto

Duas rules do host alcançam diretamente como um teste afirma, e não se duplicam aqui:

- `.claude/rules/ancoras-de-superficie.md` — superfície publicada se afirma por **igualdade de conjunto** com controle antivácuo, nunca por contenção; a âncora nasce no **mesmo diff** da publicação, e a §5.2 da task declara os arquivos-âncora que vão crescer.
- `.claude/rules/contrato-publicado.md` — entrada fechada (`z.strictObject`), saída aberta (`z.object`); a direção decide a estritude.

Ponteiro, e não cópia: as duas são rules vivas deste repositório, sem cadeia de supersede — diferente do envelope da ADR-0017 acima, reproduzido de propósito porque a ADR dele já foi substituída duas vezes.

## Política de qualidade

### Cobertura — **medida, sem bloquear** (decisão de 2026-08-16)

**Instrumentada desde 2026-08-16**: `@vitest/coverage-v8` na raiz, configuração em `vitest.config.ts` (chave `test.coverage`), medição por **`pnpm coverage`** — que é `vitest run --coverage` na raiz e cobre os nove projetos de uma vez.

⚠️ **Ela não entra no `pnpm test`, de propósito.** `pnpm test` é a baseline que o P1/P5 do `.claude/rules/nao-regressao.md` mandam comparar antes e depois de cada edição; pendurar a instrumentação nela mudaria o custo e o comportamento do comando que existe justamente para não mudar. Quem quer o número o pede por nome.

A cobertura é **informativa e nunca bloqueia**: **não há `thresholds` na configuração**, e a ausência é a decisão, não esquecimento — um piso ali reintroduziria pela configuração o critério que esta rule recusou por medição. Nenhum piso reprova task, e **o Gate 1 não deve cobrar cobertura nem tratá-la como achado**.

Duas leituras que a configuração já barra, e que quem ler o número precisa saber: ela roda com **`all: true`**, para que o arquivo que nenhum caso importa entre na conta com 0% em vez de ficar fora dela — sem isso o número sobe por causa do que **não** é testado; e ela mede só `apps/*/src` e `packages/*/src`, com `dist/`, `test/` e configuração excluídos. A razão de não bloquear é medida e não mudou com esta decisão — o gate julga por **rastreabilidade `CA → CT`** e **qualidade de asserção**, que é o que os gates efetivamente usaram para reprovar cinco vezes na F0. Cobertura mede quantidade; 80% com asserção fraca passa, e foi asserção fraca que produziu todos os defeitos reais deste projeto até aqui.

E ela **não alcança a frente shell**, que é metade da suíte: um número alto segue compatível com verificador de infraestrutura sem asserção nenhuma. Ler cobertura como saúde da verificação, aqui, mede metade e conclui sobre o todo.

### Prova de falsificação — **obrigatória para asserção estática**

Toda asserção que inspeciona o **texto** do código sob teste — `grep`/`awk` sobre o SUT, auditoria de fonte, contagem de ocorrências — exige **prova de falsificação** antes de ser aceita:

> Gere uma cópia do arquivo sob teste com o defeito **reintroduzido**, aplique a asserção **commitada** a ela, e demonstre que ela **reprova**. Um controle (arquivo íntegro) deve passar limpo no mesmo harness.

**Por que é regra e não recomendação**: três das cinco rodadas de T2 caíram exatamente por isso — asserção que não podia falhar pelo defeito que perseguia. Os casos concretos, para reconhecer o padrão:

- Asserção que casava `ALTER ROLE` em **comentário e mensagem de erro**, permanecendo verde num script sem guarda algum.
- Tabela que exercitava a reimplementação do leitor **no próprio verificador**, aprovando 5/5 um SUT com o defeito de volta.
- Guarda cuja asserção provava o predicado, a posição e o texto — mas **não que a recusa abortava**; trocar `exit 1` por `return 0` passava.

O padrão que liga os três: **provou-se o que era fácil provar** (o predicado, a posição, o texto) **e deixou-se sem asserção o que era difícil** (a combinação de entradas que discrimina, e o efeito terminal). Quando a asserção carrega **companheiro positivo e negativo**, a falsificação costuma ser trivial de obter — e é o par que detecta, não a asserção isolada.

Asserção **comportamental** (exercita o SUT e observa resultado) não exige a prova: ela falha naturalmente quando o SUT quebra.

#### Como invocar a suíte durante a prova — **a escolha do comando decide a validade**

> **Toda prova de falsificação sobre fonte de `packages/*` roda pelo script `test` do pacote
> consumidor:** `pnpm --filter @sysloc/<pacote> test` (que é
> `tsc --build && tsc -p tsconfig.test.json && vitest run`), ou `pnpm test` para a suíte inteira.
> **`vitest run` avulso é INVÁLIDO para concluir qualquer coisa sobre uma prova de falsificação.**

A razão é o modo de falha, que é silencioso e **inverte a conclusão**: verde lido como *"a asserção
não pega o defeito"* quando o defeito reintroduzido nunca chegou a ser executado.

**Sete dos nove pacotes** resolvem `"."` por `exports` para `./dist/index.js` — todos os de
`packages/` (`auth`, `cobranca-bancaria`, `contracts`, `db`, `documentos`, `regua`, `shared`); só
`apps/api` e `apps/worker` não publicam `exports`. Uma suíte que carregue o SUT **pela fronteira do
pacote** (`from '@sysloc/auth'`) continua lendo o `dist/` da compilação anterior quando invocada por
`vitest run` avulso — o defeito fica no fonte e não alcança o que executa.

**O discriminador é COMO a suíte carrega o SUT, não onde o defeito foi reintroduzido** — e por isso
a regra é "sempre pelo script", em vez de um julgamento caso a caso. As duas medições que a fixam,
ambas feitas neste repositório:

| Defeito reintroduzido | Como a suíte carrega | `vitest run` avulso | Script `test` do pacote |
|---|---|---|---|
| `RESTRICOES_DE_SESSAO` invertida (`packages/auth/src/admissao.ts`) | `apps/api/test/sessao-restrita.spec.ts` lê `@sysloc/auth` | **10 passed — falso negativo** | reprova em `CT-105` |
| `COMPRIMENTO_MINIMO_DE_SENHA` 10→3 (`packages/auth/src/senha.ts`) | `packages/auth/test/senha.spec.ts` lê `../src/senha.ts` | reprova (2 casos) | reprova (2 casos) |

A segunda linha é o contraexemplo que impede a leitura errada da primeira: quando a suíte importa o
fonte por caminho relativo, o defeito reintroduzido alcança mesmo sem build. **Não conte com isso**,
por duas razões medidas:

- **A forma de carregar não se lê no arquivo de teste.** `packages/auth/test/recusa-nao-credencial.spec.ts`
  importa apenas `@sysloc/db` diretamente, e ainda assim alcança o fonte de `@sysloc/auth` — porque o
  acessório `identidade-efemera.ts` importa `../src/autenticacao.ts`. Um defeito reintroduzido em
  `packages/auth/src/autenticacao.ts` reprova ali nos dois caminhos. **Apurar isso exige seguir a
  cadeia de acessórios**, e é trabalho que a regra "sempre pelo script" torna desnecessário.
- **A exposição é por DIREÇÃO, não por arquivo.** O que atravessa `dist/` é o consumo
  *cross-package*, e ele hoje alcança **oito dos nove** pacotes — só `packages/regua/test/**` não
  importa irmão algum pela fronteira. Inclusive `packages/shared/test/**` consome `@sysloc/shared`,
  isto é, **um pacote alcança o próprio fonte por `dist/`**. Nessas direções, defeito reintroduzido
  sem build não chega. **Não presuma a matriz** — ela muda a cada fatia, e se refaz em uma linha:

```bash
for d in apps/*/test packages/*/test; do
  echo "$d -> $(grep -rho "from '@sysloc/[a-z-]*'" --include='*.ts' --exclude-dir=dist "$d" | sort -u | tr '\n' ' ')"
done
```

Numa fatia cujo eixo é segurança, **prova inconclusiva é pior que prova ausente — ela consta como
feita.**

### Mutation testing — **fora da stack** (decisão de 2026-08-16)

Não faz parte da stack de teste deste projeto: sem ferramenta, sem score, e **não se pede campanha
de mutantes** em task nem em gate. A linha existe para dizê-lo explicitamente, porque a doutrina do
framework (`agent-spec-testing-best-practices`, padrão nº 11) lista mutation score como padrão —
aqui ele **não se aplica**, e o Gate 1 não deve cobrá-lo.

⚠️ **Isto não alcança a prova de falsificação acima**, que segue **obrigatória** — e o recorte dela é
**exatamente** o desta seção: ela é escopada a **asserção estática**, e só a ela. O que sai é o
*score* e a *campanha*; o que fica é a prova que fecha um defeito.

**O P4 de `.claude/rules/nao-regressao.md` não reabre a campanha, e a redação dele diz isso desde
2026-08-17.** O que o P4 estende a *todo* defeito corrigido é a **rede** — o caso que reprova se o
defeito voltar. A **demonstração por execução** (reintroduzir o defeito, rodar, reverter) permanece
escopada à asserção **estática**; para asserção **comportamental** o P4 manda declarar por escrito
qual asserção discrimina, e **proíbe** executar o mutante. Reintroduzir defeito em asserção
comportamental "para conferir" é campanha de mutantes com outro nome, e custa um `build` mais uma
suíte inteira por vez.

> **A leitura antiga desta linha era a que vazava.** Ela dizia que o P4 exigia a prova de "todo
> defeito corrigido" e que o protocolo prevalece — o que, lido de fora, transformava a decisão
> *"mutation testing fora da stack"* em letra morta pela nota de rodapé dela mesma. Medição do run
> `emissao-e-conciliacao/v1`: mais de **20 mutantes executados em 6 tasks** (`MT-M1..M3`,
> `MT-T4-A..F`, `MT-T5-A..G`, `MT-T6-C..F`), **nenhum** exigido por nenhuma das duas rules.

Registros históricos de mutantes — commits `c0453d2` e `79d17f2`, e os relatórios de `_run/` — são
registro e **não se reescrevem**.

### Espera e determinismo — **convenções vinculantes**

> **Sem política formal de flaky/quarentena** (decisão de 2026-08-16). Não há disposição sobre retry
> automático, SLA de quarentena ou dono nomeado: o tratamento de um caso instável é decidido caso a
> caso por quem o encontra.

As três convenções abaixo **continuam vinculantes**. Elas não são política de flaky — são exigências
de determinismo, e o código as cita pelo nome (`apps/api/src/comum/produtor-de-fila.ts`,
`apps/worker/test/eco.spec.ts`):

- Espera por estado observável é feita por **sondagem com limite de tempo declarado**, nunca por `sleep` fixo.
- Todo limite de tempo é constante nomeada no topo do arquivo, não número mágico no meio do caso.
- Dependência de rede externa é aceitável **apenas** quando a fronteira real do SUT é a rede (ex.: um provisionador que instala pacote). Declare-a como pré-condição do caso.

## Decisões de stack (árvore — auditável)

| Eixo | Escolha | Alternativas consideradas | Origem |
|---|---|---|---|
| 1 · Base de execução | Node 24.18.1 + pnpm 11.18.0 + TS 7.0.2; bash para infraestrutura | fixar só o runtime sem o gerenciador; usar `npm`/`yarn` | `[derivado]` — `.mise.toml`, `package.json` |
| 2 · Frameworks por camada | Vitest 4.1.10 + `embedded-postgres`; shell com convenção própria | Jest; Node test runner nativo | `[derivado]` — `CLAUDE.md`, `decisao-e-stack.md` §4; **materializado** nos 9 pacotes e em `deploy/scripts/*/verificar-*.sh` |
| 3 · Comando & convenções | `pnpm test` → `turbo run test`; `test/` por pacote, `*.spec.ts`; `verificar-*.sh` com um bloco por `CT-NNN` | co-localizar testes com `src/`; `__tests__/` | `[derivado]` — `package.json`, specs de T4/T5/T6, precedentes em `deploy/scripts/` |
| 4 · Fronteira de execução real | Instância efêmera própria (banco e fila) + HTTP real + sandbox descartável no shell | in-memory/sqlite; real só no gate final | `[derivado]` — ADR-0006, scope §3.6 |
| 5 · Política de qualidade | Cobertura medida sem bloquear · falsificação obrigatória para asserção estática · sem política formal de flaky · **mutation testing fora da stack** | cobertura bloqueante com mínimo; quarentena com SLA e dono; Stryker informativo ou bloqueante | `[usuário]` — revisto em 2026-08-16 |

### Enriquecimentos posteriores

> Acrescenta, não substitui: a tabela acima guarda a escolha de cada eixo; esta guarda o que mudou
> depois e por quê. Estados conforme a Fase E da skill (`vazio` · `stale` · `novo sinal` · `coerente`).

| Data | Campo | Estado | O que mudou |
|---|---|---|---|
| 2026-08-16 | Eixo 2 · auditoria | `stale` | *"declarado, chega em T4"* e *"4 verificadores"* eram a foto de 2026-07-31; hoje são 9 pacotes com tarefa `test` e 8 verificadores |
| 2026-08-16 | Eixo 4 · pacotes com `exports` | `stale` | **quatro → sete**; a exposição por direção deixou de ser enumerada e passou a ter comando que a remede |
| 2026-08-16 | Eixo 4 · mock | `stale` | *"nesta fatia … a F0"* substituído pela razão permanente mais o comando de medição |
| 2026-08-16 | Eixo 5 · cobertura | `[usuário]` | *não é sinal* → **medida sem bloquear**; registrada a ausência de instrumentação |
| 2026-08-16 | Eixo 5 · cobertura | `[usuário]` | **instrumentada**: `@vitest/coverage-v8` na raiz, `pnpm coverage`, `all: true`, sem `thresholds` e fora do `pnpm test` |
| 2026-08-16 | Eixo 5 · mutation testing | `[usuário]` | método manual → **fora da stack**, com a ressalva de que não alcança a prova de falsificação (P4) |
| 2026-08-16 | Eixo 5 · flaky | `[usuário]` | sai a disposição de retry/quarentena; ficam as três convenções de determinismo que o código cita |
| 2026-08-16 | ADRs grep-detectáveis | `novo sinal` | entra a **ADR-0032** — método de medição da saída real e controle positivo obrigatório |
| 2026-08-16 | Rules irmãs | `novo sinal` | ponteiro para `ancoras-de-superficie.md` e `contrato-publicado.md` |
| 2026-08-16 | `paths` | `coerente` | matcher já era código + testes do host + skills de QA; intocado |
