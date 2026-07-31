# SCOPE — Cleanup de Débitos Técnicos · saas-multi-empresa · v2-debits

> **Variante**: backend (herdada de v1)
> **Versão**: v2-debits
> **Padrão**: agrupamento por arquivo (4 tasks para 12 débitos), a pedido explícito do usuário — ver `intent.md` §2

---

## 1. O que está incluído

Os **12** débitos abaixo serão resolvidos nesta versão, agrupados em **4 tasks por arquivo**.

### T1 — `tasks/T8.md` da v1 (3 débitos, ~10min, `gates: [qa]`)

- [x] **D-001 (documentation, BAIXO)** — Contagem de volumes anônimos incorreta na §7.9
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md`:343
  - **Origem**: task `T8` de `v1`
  - **Correção**: corrigir para "5 órfãos `erpnext_*` e 16 anônimos, dos quais 14 sem contêiner associado (2 pertencem a `frappe-create-site-1` e `frappe-configurator-1`)"; registrar que a limpeza futura deve filtrar por `docker volume ls --filter dangling=true`, nunca por "é anônimo".
  - **Custo estimado**: ~3min · **Classificação**: `recomendado_corrigir` — custo trivial, risco nulo, evita que a limpeza futura alcance dois volumes em uso.

- [x] **D-002 (documentation, BAIXO)** — Blocos declarados literais contêm reformatação e comandos elididos
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md`:99
  - **Origem**: task `T8` de `v1`
  - **Correção**: suavizar o cabeçalho da §7.A para "saídas coladas; anotações de leitura entre parênteses e elisões marcadas com `...`" — ou colar a saída crua com as anotações fora do bloco. Não elidir comandos.
  - **Custo estimado**: ~4min · **Classificação**: `recomendado_corrigir` — edição de parágrafo único; realinha a promessa do arquivo com o que o QA já verificou como correto.

- [x] **D-003 (documentation, BAIXO)** — Conferência pré-destrutiva provou existência, não conteúdo
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md`:167
  - **Origem**: task `T8` de `v1`
  - **Correção**: anexar à §7.3 a comprovação de conteúdo (`len(script)` = 21031 e a primeira linha), não apenas a existência do documento. Registrar a regra geral: em conferência pré-destrutiva, a evidência deve interrogar exatamente a propriedade cuja perda é irreversível.
  - **Custo estimado**: ~3min · **Classificação**: `recomendado_corrigir` — o QA já mediu o valor; é anexar ao texto.

### T2 — `deploy/scripts/veredito_suite.sh` (3 débitos, ~23min, `gates: [qa, tech_review]`)

- [x] **D-005 (documentation, BAIXO)** — parte-script: justificativa cita "arquivo temporário" que a implementação não usa
  - **Arquivo**: `deploy/scripts/veredito_suite.sh`:25
  - **Origem**: task `T9` de `v1`
  - **Correção**: remover "com arquivo temporario" da linha 25. (A ocorrência gêmea em `T9.md:1250` é da **T4** — ver guardrail cruzado.)
  - **Custo estimado**: ~2min · **Classificação**: `recomendado_corrigir` — evita que um leitor do script herdado procure um `mktemp` que não existe.

- [x] **D-006 (error_handling, BAIXO)** — falta `-a` no grep que monta o motivo
  - **Arquivo**: `deploy/scripts/veredito_suite.sh`:62
  - **Origem**: task `T9` de `v1`
  - **Correção**: trocar `grep -E` por `grep -aE` na linha 62, alinhando com a linha 57.
  - **Custo estimado**: ~1min · **Classificação**: `recomendado_corrigir` — padrão já provado no mesmo arquivo; corrige o diagnóstico no caso em que o humano mais precisa do motivo.

- [x] **D-007 (logic, BAIXO)** — a condição (c) ancora `FAILED`/`NO TESTS RAN` em início de linha
  - **Arquivo**: `deploy/scripts/veredito_suite.sh`:61 (+ cabeçalho linha 34)
  - **Origem**: task `T9` de `v1`
  - **Correção**: buscar o placar de falha em qualquer posição da linha, sobre o fluxo bruto e não sobre a variável já filtrada — ex.: `grep -aqE '(^|[^[:alnum:]])(FAILED \(|NO TESTS RAN)'`. Atualizar a linha 34 do cabeçalho para descrever a âncora efetivamente usada.
  - **Custo estimado**: ~20min · **Classificação**: `perfumaria` — exige reestruturar como o stdin é consumido e revalidar as três condições; o QA **tentou e não conseguiu** construir falso-verde plausível. Selecionado pelo usuário mesmo assim.
  - **Risco de regressão**: `medio` — é o item de maior risco desta versão.

### T3 — `deploy/scripts/portao_orfaos.py` (2 débitos, ~20min, `gates: [qa, tech_review]`)

- [x] **D-010 (error_handling, BAIXO)** — bootstrap protegido, corpo não: exceção não prevista sai 1 (código do VERMELHO)
  - **Arquivo**: `deploy/scripts/portao_orfaos.py` (bloco `try/finally` do corpo)
  - **Origem**: task `T9` de `v1`
  - **Correção**: acrescentar `except Exception as e: return _invalida(f'excecao inesperada no corpo ({type(e).__name__}: ...)')` ao bloco do corpo, **preservando o `finally: frappe.destroy()`**. Assim o `exit 1` passa a significar exclusivamente "órfão encontrado".
  - **Custo estimado**: ~5min · **Classificação**: `recomendado_corrigir` — replica o padrão já usado no bootstrap do mesmo arquivo; hoje uma exceção qualquer sai com o código reservado a "há DocType que o migrate apagaria", num script que bloqueia migrate de produção.
  - **Risco de regressão**: `baixo` — amplia cobertura de captura, não muda o caminho feliz.
  - **Nota**: a rodada 8 da v1 já protegeu o parse dos contratos no topo de `main()`, fechando o gatilho conhecido. O `try/finally` sem `except` do corpo permanece, então exceção de **outra** natureza ainda sairia 1.

- [x] **D-012 (documentation, BAIXO)** — parte-docstring: receita de plantio/limpeza ausente
  - **Arquivo**: `deploy/scripts/portao_orfaos.py` (docstring, seção do teste de falsificabilidade)
  - **Origem**: task `T9` de `v1`
  - **Correção**: registrar a receita completa junto ao teste de falsificabilidade — nome com sufixo único do run (para resíduo ser atribuível); `set_value custom=1` + `delete_doc(force=True)` + `DROP TABLE`; purga de `tabDeleted Document`, `tabVersion` **e `tabComment`**; varredura por nome nas 13 tabelas com FK de nome de DocType **como ÚLTIMA ação da rodada**. (As três amostras de saída em `T9.md` são da **T4** — ver guardrail cruzado.)
  - **Custo estimado**: ~15min · **Classificação**: `perfumaria` — pede uma passada dedicada, não um patch rápido. Selecionado pelo usuário: o consumidor (T2/T3 da v1) é imediato e a limpeza incompleta já falhou **duas vezes** durante a v1.

### T4 — `tasks/T9.md` da v1 (4 débitos + 3 trechos, ~37min, `gates: [qa]`)

- [x] **D-004 (documentation, MEDIO)** — §5.1 e checklist §8 listam 2 dos 3 arquivos criados
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md`:59 (e checklist na `:1302`)
  - **Origem**: task `T9` de `v1`
  - **Correção**: acrescentar linha na tabela §5.1 para `deploy/scripts/veredito_suite.sh` com a justificativa da promoção (mesma forma já usada para o `portao_orfaos.py`), e corrigir o checklist para enumerar os **três** arquivos criados.
  - **Custo estimado**: ~4min · **Classificação**: `recomendado_corrigir` — a §5.1 é o que a Camada 0 de um gate futuro lê para cruzar declarado × entregue do script herdado.

- [x] **D-008 (documentation, MEDIO)** — §7.A.20 diz "Cinco variações" numa tabela de seis, e a conclusão está superdeclarada
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md`:1239
  - **Origem**: task `T9` de `v1`
  - **Correção**: ajustar a contagem para seis, acrescentar as variações **7** (wrapper travado em `exit 1`) e **8** (wrapper com falso-verde), e reescrever a conclusão: a mudança de classe fechou **uma** superfície (o portão); as demais continuam abertas porque dependem de sincronização manual entre artefatos.
  - **Custo estimado**: ~5min · **Classificação**: `recomendado_corrigir` — é a seção que a T2 da v1 herda como "o problema foi fechado", e hoje subestima a própria contagem no parágrafo que fala em não subestimar.

- [x] **D-009 (documentation, MEDIO)** — correções de bootstrap e piso sem seção de evidência; checklist aponta para seções que não as contêm
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md`:1243
  - **Origem**: task `T9` de `v1`
  - **Correção**: abrir seção nova com as medições literais dos quatro caminhos de `RODADA_INVALIDA` — incluindo o cenário do interno renomeado, que é o que distingue "o portão não pode afirmar nada" de "achei um órfão" — e corrigir a referência do checklist.
  - **Custo estimado**: ~25min · **Classificação**: `perfumaria` — exige **reproduzir** os quatro caminhos para colar evidência literal (trabalho de infraestrutura, não edição de texto). Selecionado pelo usuário.
  - **Nota de execução**: exige o ambiente da stack nova de pé. Ver §3.5.

- [x] **D-011 (documentation, BAIXO)** — frases absolutas sobre mapa de IPs são literalmente falsas
  - **Arquivo**: `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md`:1188 (e `:613`)
  - **Origem**: task `T9` de `v1`
  - **Correção**: trocar por afirmação verificável — "nenhum mapa é publicado como estado atual; onde há saída capturada, ela está datada e vem acompanhada do comando que a deriva". Idem na nota da `:613`, reconhecendo o mapa logo abaixo como captura de rodada anterior.
  - **Custo estimado**: ~3min · **Classificação**: `recomendado_corrigir` — remove contradição literal dentro do mesmo arquivo.

**Mais os três trechos em `T9.md` cujos gêmeos estão em T2 e T3:**

- [x] **D-005 (parte-T9)** — remover "com arquivo temporario" de `T9.md:1250`.
- [x] **D-007 (parte-T9)** — se a T2 alterar a redação da condição (c), espelhar em `T9.md` onde o predicado é reenunciado (`:1248`).
- [x] **D-012 (parte-T9)** — atualizar as três amostras de saída do portão (`:571`, `:1062`, `:1101`) com o campo `piso em vigor`.

---

## 2. O que está fora do escopo (débitos NÃO selecionados nesta rodada)

_Nenhum débito ignorado — todos os 12 coletados foram selecionados para cleanup._

Para rastreabilidade do que **não** é débito e portanto não entra aqui, ver `intent.md` §6.

---

## 3. Definições Técnicas

### 3.1 Arquivos Impactados (consolidado)

| Arquivo | Débitos que tocam | Task | Ação esperada |
|---------|-------------------|------|---------------|
| `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md` | D-001, D-002, D-003 | T1 | Correção de contagem, suavização de promessa de literalidade, anexo de comprovação de conteúdo |
| `deploy/scripts/veredito_suite.sh` | D-005 (script), D-006, D-007 | T2 | Remover frase-resíduo; `-a` no grep do motivo; endurecer a âncora da condição (c) |
| `deploy/scripts/portao_orfaos.py` | D-010, D-012 (docstring) | T3 | `except Exception` no corpo; receita de plantio/limpeza no docstring |
| `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md` | D-004, D-008, D-009, D-011 + partes-T9 de D-005/D-007/D-012 | T4 | §5.1 + checklist; §7.A.20; seção de evidência nova; frases sobre mapa; 3 amostras; 2 espelhamentos |

**Os quatro arquivos são disjuntos** → as 4 tasks são paralelizáveis (`MAX_PARALLEL=4` cabe exatamente).

### 3.2 Frontmatter por task

```markdown
- model: sonnet
- risk: low | medium
- gates: [qa] | [qa, tech_review]
- source: agent-spec-debt-resolution
```

**Desvio deliberado do default, registrado**: a skill prescreve `gates: [qa]` para cleanup, com exceção apenas para Critical Paths. Nenhum destes paths bate com as categorias canônicas da rule (`deploy/scripts/` não é `**/migrations/**` nem `**/security/**`). Ainda assim, **T2 e T3 recebem `gates: [qa, tech_review]`** porque:

- **T2/D-007** tem `risco_regressao: medio` e reestrutura como o stdin é consumido num predicado de veredito.
- **T3/D-010** muda o comportamento de um gate que **bloqueia `bench migrate` em produção**, onde `exit 1` tem significado contratual.

Nenhum dos dois é "cleanup de code-review" — mudam comportamento de artefato de segurança. Rodar só QA aqui seria aplicar a regra contra a intenção dela.

### 3.3 Estratégia de testes

- Tasks de débito **NÃO criam testes novos**.
- A suíte existente **DEVE continuar passando**: `docker compose -f deploy/compose/docker-compose.stack-nova.yaml -p frappe-stack-nova exec -T backend bench --site verificacao run-tests --app locacao_automation`.
  - **Atenção**: a suíte está **vermelha por dependência da T2 da v1** (169 testes, 9 failures / 161 errors / 1 skipped — todos por DocType ausente). O oráculo de regressão é o **placar idêntico**, não o placar verde. Qualquer desvio desses números é regressão.
- **Para T2 e T3 há um oráculo adicional e obrigatório**: os dois scripts precisam continuar **falsificáveis**. Ver §3.4.

### 3.4 Oráculo específico dos scripts de gate (T2 e T3)

Alterar um gate sem provar que ele ainda falha quando deve é o defeito que a v1 levou oito rodadas para fechar. Portanto:

**T2 — `veredito_suite.sh`** deve ser provado nos casos abaixo, com placar emulado em stderr, e a saída colada:

| Caso | Exit esperado |
|---|---|
| verde legítimo (`Ran 169 tests` + `OK`) | 0 |
| `OK (skipped=1)` | 0 |
| vermelho (`FAILED`) | 1 |
| **zero testes** (`Ran 0 tests` + `OK`) | **1** |
| **linha `OK` espúria com placar `FAILED`** | **1** |
| `NO TESTS RAN` | 1 |
| fluxo sem placar | 1 |
| **`FAILED` com prefixo na linha** (o alvo do D-007) | **1** |
| **volume ≥ 64KB** — placar de falha seguido de ruído grande (vetor SIGPIPE; o SUT opera sobre ~389KB) | **1** |
| **byte não-ASCII antes do placar de falha**, medido em `LC_ALL=C` **e** `LC_ALL=C.UTF-8` | **1 nos dois locales** |
| **`FAILED` sem parênteses** em início de linha (ex.: `FAILED` sozinho, `FAILED: algo`) — cobertura que existia antes da task e que o endurecimento estreitou | **1** |

> Os casos 9 e 10 foram acrescentados pelo Gate 1 na 2ª rodada da T2: o oráculo original usava fixtures < 1KB enquanto o SUT opera sobre ~389KB, e foi essa lacuna que deixou passar uma regressão de SIGPIPE que só se manifesta acima de ~30KB. O caso 11 foi acrescentado na 4ª rodada, quando o Gate 1 comparou o predicado contra a versão do arquivo no index (`git show :deploy/scripts/veredito_suite.sh`) e descobriu que o endurecimento tinha perdido cobertura fora do contrato dos 10 casos — **o oráculo prova que os casos contratados não mudaram, não prova que nada fora do contrato mudou**. A fonte reproduzível dos 11 casos é a §5.1 da `tasks/T2.md`.

**T3 — `portao_orfaos.py`** deve ser provado nos quatro estados, **rodado como a T2 da v1 rodaria** (por redirecionamento de stdin):

| Estado | Exit esperado |
|---|---|
| saudável | 0 |
| órfão sintético plantado | 1 |
| contrato divergente | 2 |
| **exceção inesperada no corpo** (o alvo do D-010) | **2** (hoje: 1) |

### 3.5 Pré-requisito de ambiente

**T3 e o D-009 (dentro da T4) exigem a stack nova de pé.** Estado no momento da geração desta versão: projeto `frappe-stack-nova` com 4 contêineres `up`, site `verificacao` provisionado, marcador `.provisionado` presente, rede `internal=true`, portão VERDE com 739 alvos.

Se o ambiente não estiver de pé: `docker compose -f deploy/compose/docker-compose.stack-nova.yaml -p frappe-stack-nova up -d` (o `create-site` é idempotente). **Atenção**: se o marcador existir mas o site estiver meio-provisionado, o remédio é `down -v` — ver o cabeçalho do compose.

### 3.6 Guardrail cruzado T2 ↔ T4 (obrigatório)

D-005 e D-007 têm a **mesma correção textual em dois arquivos**, separados pelo agrupamento:

| Débito | Lado script (T2) | Lado prosa (T4) |
|---|---|---|
| D-005 | `veredito_suite.sh:25` | `T9.md:1250` |
| D-007 | `veredito_suite.sh:61` + cabeçalho `:34` | `T9.md:1248` (reenunciação do predicado) |

**As duas tasks devem produzir texto coerente.** Se a T2 escolher uma redação diferente da sugerida para a condição (c), a T4 precisa espelhá-la — e vice-versa.

Isto é a lição da v1 aplicada: o padrão dominante de defeito lá foi *corrigir num lugar e não varrer o vizinho*, oito vezes. O agrupamento por arquivo resolve o paralelismo e **reintroduz exatamente esse risco**. As tasks T2 e T4 apontam uma para a outra por isso, e o Gate 1 de cada uma deve conferir a coerência com a outra.

### 3.7 Paralelização

Os quatro arquivos são disjuntos e nenhum é de alta contenção → o flag derivado é `Sim` para as quatro tasks, e `MAX_PARALLEL=4` acomoda o lote inteiro.

**Guard de recursos de teste**: T2 e T3 executam verificação contra o **mesmo** site `verificacao`. T3 planta e remove um DocType; T2 só emula placares em stderr, sem tocar o banco. O orquestrador deve **serializar os QAs de T2 e T3** se ambos forem executar a suíte, e a T3 deve fazer sua varredura de limpeza **como última ação** — a v1 registrou resíduo remanescente duas vezes por confirmação intermediária.

---

## 4. Critérios de Aceite

- [ ] 4 tasks `Concluído` no `task_plan.md` desta versão.
- [ ] Suíte com placar **idêntico** ao registrado (169 / 9 failures / 161 errors / 1 skipped) — o vermelho é pré-existente e esperado.
- [ ] `veredito_suite.sh` provado nos 11 casos da §3.4, **incluindo o `FAILED` com prefixo, o volume ≥ 64KB, o byte não-ASCII nos dois locales e o `FAILED` sem parênteses**.
- [ ] `portao_orfaos.py` provado nos 4 estados da §3.4, **incluindo exceção inesperada no corpo → exit 2**.
- [ ] Coerência textual entre T2 e T4 conferida (§3.6).
- [ ] Nenhum diff em arquivos fora da §3.1.
- [ ] Ambiente devolvido limpo: marcador presente, sem resíduo de artefato plantado (varredura por nome como última ação).
- [ ] §2 do `_run/run-report.md` da `v1` marca os 12 débitos em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Observações

- **Origem**: gerada pela skill `/agent-spec-debt-resolution` em 2026-07-29.
- **Agente especialista usado**: `__default__` (orquestrador genérico — `.claude/agents/` contém apenas os 3 agentes reservados aos gates).
- **Decisão do usuário**: **12 de 12** débitos coletados aprovados para cleanup, com **agrupamento por arquivo** solicitado explicitamente.
- **Classificação do especialista**: 9 `recomendado_corrigir`, 3 `perfumaria` (D-007, D-009, D-012 — todos por **custo**, não por falta de valor). O usuário incluiu os três.
- **Não é candidato a ADR**: cleanup técnico não dispara ADR.
