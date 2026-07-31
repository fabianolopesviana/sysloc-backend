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

> Gerada por `agent-spec-testing-stack-bootstrap` em 2026-07-31. Atualize via a mesma skill.
> Fonte de verdade de stack para os agentes de QA — eles não carregam idiomas de linguagem nenhuma; tudo que é específico deste projeto vive aqui.

## Identificação

- **Linguagens**: TypeScript 7.0.2 (código de aplicação) · Bash (infraestrutura e instalação)
- **Runtime**: Node 24.18.1, fixado em `.mise.toml`
- **Gerenciador de pacotes**: pnpm 11.18.0 (monorepo com Turborepo 2.10.7)
- **Frente**: backend. Sem UI, sem mobile.

## As duas frentes de teste — leia antes de decidir onde um teste mora

Este projeto testa em **duas linguagens, com propósitos disjuntos**. Confundi-las é erro de placement:

| Frente | Objeto sob teste | Runner |
|---|---|---|
| **Shell** | O que só existe fora do processo Node: pacotes instalados no SO, unidades systemd, portas, permissão de arquivo, idempotência de script, higiene de segredo na árvore versionada | `bash`, sem framework |
| **TypeScript** | Código de aplicação: regra de domínio, rota HTTP, processador de fila, contrato de erro | Vitest (chega em T4 da F0) |

**Critério**: se o invariante só é observável inspecionando o sistema operacional, o git ou o filesystem, é shell. Se é observável chamando código, é Vitest. Um teste de shell que poderia ser Vitest está no lugar errado — e o contrário também.

> **Estado em 2026-07-31**: a frente shell existe e tem 4 verificadores versionados. A frente TypeScript está **declarada e ainda não instalada** — `pnpm test` resolve para `turbo run test` e nenhum pacote declara a tarefa `test` porque `apps/` e `packages/` estão vazios. Isso é esperado até T4, não defeito. **O QA não deve reportar `discovery_needed` por causa disso**: a stack está decidida, só não materializada.

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

- **Contrato de saída**: `exit 0` só com `falhas_totais == 0`; senão `exit 1` com o resumo em `stderr`
- **Degradação**: ferramenta ausente no host **nunca** faz o caso passar em silêncio — emita `aviso` explícito nomeando o que foi pulado

## Rastreabilidade — convenção herdada, obrigatória

`CA-xx → CT-xxx (RN-xx)`, com seção de **INVARIANTES** por arquivo de teste. Vem do backend Frappe e **sobrevive à migração** (`CLAUDE.md`). Vale nas duas frentes: no shell, o ID entra literalmente no `caso "CT-NNN …"`; em Vitest, no nome do `describe`/`it`.

## Fronteira de execução real

- **Banco**: `embedded-postgres` — instância efêmera **própria** por execução, descartada sem deixar diretório de dados nem processo órfão
- **Fila**: instância efêmera própria, com `parar()`/`religar()` **preservando o diretório de dados** (requisito de CA-10)
- **HTTP**: servidor real em porta dinâmica
- **Shell**: SO, filesystem e git reais, sempre em sandbox descartável (clone efêmero, `tmpfs`, diretório temporário) — **nunca** na árvore de trabalho quando houver sandbox equivalente disponível

**Camadas que DEVEM atravessar fronteira real**: repositório, rota HTTP, processador de fila, e todo verificador de infraestrutura.

**Mock**: evitado por decisão. Nesta fatia mock não prova recuperação, persistência nem idempotência — as três coisas que a F0 existe para provar. Quando um dublê for inevitável, asserte argumentos e número de chamadas, nunca apenas "foi chamado".

## ADRs de teste grep-detectáveis

- **ADR-0006** (a suíte nunca executa contra o ambiente que atende a operação): o helper de banco efêmero **ignora `process.env.DATABASE_URL` por construção**. Grep: `process\.env\.DATABASE_URL` em `packages/*/test/**` e `apps/*/test/**` — qualquer ocorrência num helper de fixture é violação. A prova positiva é um caso que exporte `DATABASE_URL` apontando para destino impossível e demonstre que a suíte subiu a instância efêmera assim mesmo.
- **ADR-0006** (imposição em shell): verificador que reinicie serviço ou reexecute provisionamento consulta `recusar_bateria_em_producao` antes do primeiro caso. Grep: presença do guarda no `main` de `deploy/scripts/instalacao/verificar-*.sh`.
- **ADR-0005** (nenhum script carrega credencial): grep `set[[:space:]]+-x` = 0 e `(--password[= ]|--dbpassword[= ]|PGPASSWORD=)` = 0 em `deploy/scripts/**/*.sh`. Segredo trafega por **entrada padrão** ou arquivo 0600 (`PGPASSFILE`) — **nunca** por `argv`, nunca por variável exportada.
- **ADR-0007** (forma canônica do contrato da API): o corpo de erro asserido nos testes de rota corresponde **literalmente** ao envelope da ADR — asserte o objeto inteiro, não a presença de campos.

## Política de qualidade

### Cobertura — **não é sinal neste projeto**

Não medimos nem bloqueamos. O gate julga por **rastreabilidade `CA → CT`** e **qualidade de asserção** — que é o que os gates efetivamente usaram para reprovar cinco vezes na F0. Cobertura mede quantidade; 80% com asserção fraca passa, e foi asserção fraca que produziu todos os defeitos reais deste projeto até aqui.

### Prova de falsificação — **obrigatória para asserção estática**

Toda asserção que inspeciona o **texto** do código sob teste — `grep`/`awk` sobre o SUT, auditoria de fonte, contagem de ocorrências — exige **prova de falsificação** antes de ser aceita:

> Gere uma cópia do arquivo sob teste com o defeito **reintroduzido**, aplique a asserção **commitada** a ela, e demonstre que ela **reprova**. Um controle (arquivo íntegro) deve passar limpo no mesmo harness.

**Por que é regra e não recomendação**: três das cinco rodadas de T2 caíram exatamente por isso — asserção que não podia falhar pelo defeito que perseguia. Os casos concretos, para reconhecer o padrão:

- Asserção que casava `ALTER ROLE` em **comentário e mensagem de erro**, permanecendo verde num script sem guarda algum.
- Tabela que exercitava a reimplementação do leitor **no próprio verificador**, aprovando 5/5 um SUT com o defeito de volta.
- Guarda cuja asserção provava o predicado, a posição e o texto — mas **não que a recusa abortava**; trocar `exit 1` por `return 0` passava.

O padrão que liga os três: **provou-se o que era fácil provar** (o predicado, a posição, o texto) **e deixou-se sem asserção o que era difícil** (a combinação de entradas que discrimina, e o efeito terminal). Quando a asserção carrega **companheiro positivo e negativo**, a falsificação costuma ser trivial de obter — e é o par que detecta, não a asserção isolada.

Asserção **comportamental** (exercita o SUT e observa resultado) não exige a prova: ela falha naturalmente quando o SUT quebra.

### Mutation testing — sem ferramenta, com método

Não adotamos Stryker nem equivalente: não alcançaria os verificadores em shell, que são metade da suíte. O **método** de mutante manual descrito acima é a forma canônica, e cobre as duas frentes.

### Flaky — sem retry, correção imediata

**Nenhum mecanismo de retry automático**, em nenhuma das frentes. Teste instável é defeito: para a fila até ser corrigido ou removido com justificativa registrada.

- Espera por estado observável é feita por **sondagem com limite de tempo declarado**, nunca por `sleep` fixo.
- Todo limite de tempo é constante nomeada no topo do arquivo, não número mágico no meio do caso.
- Dependência de rede externa é aceitável **apenas** quando a fronteira real do SUT é a rede (ex.: um provisionador que instala pacote). Declare-a como pré-condição do caso.

## Decisões de stack (árvore — auditável)

| Eixo | Escolha | Alternativas consideradas | Origem |
|---|---|---|---|
| 1 · Base de execução | Node 24.18.1 + pnpm 11.18.0 + TS 7.0.2; bash para infraestrutura | fixar só o runtime sem o gerenciador; usar `npm`/`yarn` | `[derivado]` — `.mise.toml`, `package.json` |
| 2 · Frameworks por camada | Vitest + `embedded-postgres` (declarado, chega em T4); shell com convenção própria (existe) | Jest; Node test runner nativo | `[derivado]` — `CLAUDE.md`, `decisao-e-stack.md` §4, 4 verificadores versionados |
| 3 · Comando & convenções | `pnpm test` → `turbo run test`; `test/` por pacote, `*.spec.ts`; `verificar-*.sh` com um bloco por `CT-NNN` | co-localizar testes com `src/`; `__tests__/` | `[derivado]` — `package.json`, specs de T4/T5/T6, precedentes em `deploy/scripts/` |
| 4 · Fronteira de execução real | Instância efêmera própria (banco e fila) + HTTP real + sandbox descartável no shell | in-memory/sqlite; real só no gate final | `[derivado]` — ADR-0006, scope §3.6 |
| 5 · Política de qualidade | Sem cobertura · falsificação obrigatória para asserção estática · sem retry em flaky · mutação por método manual | cobertura bloqueante com mínimo; quarentena com SLA; Stryker bloqueante | `[usuário]` |
