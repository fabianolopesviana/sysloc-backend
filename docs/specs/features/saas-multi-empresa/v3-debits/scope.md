# SCOPE — Cleanup de Débitos · saas-multi-empresa · v3-debits

## 1. Identificação

> **Variante**: backend (herdada de v1 → v2-debits)

- **Feature**: saas-multi-empresa
- **Versão**: v3-debits
- **Versão pai**: v2-debits
- **Intent**: `docs/specs/features/saas-multi-empresa/v3-debits/intent.md`
- **Origem**: `/agent-spec-debt-resolution` sobre `v2-debits/_run/run-report.md` §2

---

## 2. Fora do escopo (registro de auditoria)

Quatro dos seis débitos coletados **não** foram selecionados nesta rodada. Motivo em todos: **não selecionado nesta rodada** — custo/risco de mexer em prosa nestes arquivos desproporcional ao ganho, conforme a classificação do especialista e a evidência de custo da `v2-debits`.

| ID | Categoria | Onde | Custo est. | Risco | Por que ficou fora |
|---|---|---|---|---|---|
| D-001 | `documentation` | `v1/tasks/T8.md` | ~5min | nenhum | **Meta-débito**: o detalhe de um achado baixo foi perdido no log do orquestrador (falha de instrumentação). Fechar significa **aceitar a perda** em vez de reler o arquivo atrás de algo que, por definição, já não bloqueou nada |
| D-002 | `code_quality` | `deploy/scripts/veredito_suite.sh:101,125,132` + §6 de `v2-debits/tasks/T2.md` | ~50min | baixo | Ponteiros em prosa em vez de âncora estável. Risco real, mas de rastreabilidade entre humanos — não flipa veredito nem quebra teste. Reescrever 3 blocos-fonte + 3 ponteiros num arquivo onde prosa custou rodadas de gate |
| D-004 | `documentation` | `deploy/scripts/portao_orfaos.py:171` | ~25min | baixo | Citação funde `:78`/`:79` e omite o `_()`. O conteúdo semântico já foi validado por dois gates; resta imprecisão cosmética de citação |
| D-005 | `documentation` | `deploy/scripts/portao_orfaos.py:167` | ~25min | **médio** | Parágrafo de 15 linhas dentro de item de receita. **Único com risco médio**: mover um texto que levou 3 rodadas de gate para ficar preciso expõe cada afirmação a nova reauditoria, com risco de introduzir imprecisão nova — que é literalmente o que aconteceu 5 vezes na `v2-debits` |

> **Nota sobre o D-004 e o D-005**: os dois estão no **mesmo arquivo** que esta versão vai editar, num bloco diferente (167-201, a receita REMOVER). O especialista sugeriu avaliá-los oportunisticamente na mesma janela de edição; o usuário optou por **não** incluí-los. A task desta versão **proíbe explicitamente** tocá-los — ver `tasks/T1.md` §4.5.

---

## 3. Escopo desta versão

### 3.1 Débitos incluídos

| ID | Severidade | Categoria | Arquivo | Linha | Correção esperada |
|---|---|---|---|---|---|
| **D-003** | BAIXO | `error_handling` | `deploy/scripts/portao_orfaos.py` | 388 | O `finally: frappe.destroy()` não pode fazer o script sair **1** sem veredito quando `destroy()` levanta |
| **D-006** | BAIXO | `error_handling` | `deploy/scripts/portao_orfaos.py` | 383 | O `except Exception` do corpo passa a registrar **onde** a exceção ocorreu, não só tipo e mensagem truncada |

Ambos no mesmo bloco (`except`/`finally` de `main()`), agrupados numa **única task** por decisão do usuário.

### 3.2 Arquivos impactados (consolidado)

| Arquivo | Task | Débitos | Categorias |
|---|---|---|---|
| `deploy/scripts/portao_orfaos.py` | T1 | D-003, D-006 | `error_handling` |

**Um único arquivo, uma única task.** Não há paralelismo a derivar.

### 3.3 Gates — desvio deliberado do default

O default de cleanup é `gates: [qa]`. Esta versão usa **`gates: [qa, tech_review]`**, pelo mesmo motivo registrado na `v2-debits` §3.2 e agora com evidência a favor:

- o arquivo é um gate que **bloqueia `bench migrate` em produção**, onde o código de saída tem significado contratual;
- a mudança é no **caminho de erro** desse gate, não em código acessório;
- na `v2-debits`, o Tech Review sobre estes mesmos dois arquivos produziu achados reais nas duas tasks em que rodou (`architecture` na T2, `best_practices` na T3) — não foi desperdício.

`risk: medium`, `model: sonnet`.

### 3.4 Oráculo obrigatório

**Alterar um gate sem provar que ele ainda falha quando deve é o defeito que a v1 levou oito rodadas para fechar.** A prova é entregável, não formalidade.

Os **4 estados** do portão têm de continuar valendo, rodados **por redirecionamento de stdin** (sem cópia para o contentor), contra o site `verificacao`:

| # | Estado | Exit esperado |
|---|--------|---------------|
| 1 | saudável | **0** (739 alvos na stack nova, piso 700) |
| 2 | órfão sintético plantado | **1** |
| 3 | contrato divergente (`PORTAO_SITE` ausente, piso acima da amostra, ou `PORTAO_ESPERADO_PULADOS` errado) | **2** |
| 4 | exceção inesperada no corpo | **2** |

E **dois casos novos**, que são o alvo desta versão:

| # | Estado | Exit esperado |
|---|--------|---------------|
| **5** | **`frappe.destroy()` levanta no `finally`**, sobre um fluxo cujo veredito já estava determinado | o **veredito original**, com a falha de teardown **visível** — nunca 1 sem veredito |
| **6** | **exceção no corpo com localização no diagnóstico** — a mensagem de `RODADA_INVALIDA` nomeia onde | **2**, com linha identificável |

O caso 5 é o que falsifica o D-003: hoje ele produz exit 1 sem `PORTAO_VEREDITO`.

### 3.5 Regressão

- **Suíte do app**: placar **idêntico** ao registrado — `Ran 169 tests · FAILED (failures=9, errors=161, skipped=1)`. Vermelho **pré-existente**, por ausência dos 14 DocTypes que a T2 da v1 vai versionar. Desvio = regressão.
- **Prosa intocada**: o docstring do arquivo tem ~200 linhas conquistadas em 6 rodadas de gate na `v2-debits`. Provar que nenhuma linha de prosa mudou é mais barato que reauditá-la — ver `tasks/T1.md` §4.4.

### 3.6 Pré-requisito de ambiente

O oráculo exige a stack nova de pé:

```
docker compose -f deploy/compose/docker-compose.stack-nova.yaml -p frappe-stack-nova up -d
```

Estado no momento da geração desta versão: 4 contêineres `running`, site `verificacao` provisionado, portão **VERDE** com 739 alvos, **resíduo zero** nas 14 fontes.

**ADR-0006 é vinculante**: qualquer medição roda contra `verificacao`, **nunca** contra `frontend`, que é produção.

---

## 4. ADRs Aplicáveis nesta Feature

- **ADR-0006 — Ambiente de verificação separado do ambiente que atende a operação** (`docs/adr/0006-*.md`) — **vinculante**. Toda medição do oráculo, e qualquer plantio/remoção de artefato, acontece exclusivamente no site `verificacao`.

As ADRs 0001–0005 não se aplicam: esta versão altera o tratamento de erro de um script de `deploy/`, sem tocar cobrança bancária, estrutura de dados do app, permissões de DocType, nomes de endpoint herdados nem rotinas agendadas.

---

## 5. Critérios de Conclusão

- [ ] D-003 corrigido: nenhum caminho de exceção do arquivo produz **exit 1 sem `PORTAO_VEREDITO`**.
- [ ] D-006 corrigido: o diagnóstico do `except` do corpo nomeia **onde** a exceção ocorreu.
- [ ] `portao_orfaos.py` provado nos **6 casos** da §3.4, com saída colada — incluindo os dois novos.
- [ ] Suíte com placar **idêntico** (ou não-execução justificada).
- [ ] **Nenhuma linha de prosa do docstring alterada**, provado por comparação, não afirmado.
- [ ] Nenhum diff fora de `deploy/scripts/portao_orfaos.py`.
- [ ] Ambiente devolvido limpo (portão VERDE, resíduo zero se algo foi plantado, varredura como última ação).
- [ ] §2 do `_run/run-report.md` da `v2-debits` marca D-003 e D-006 como em cleanup.
- [ ] `_run/minispec_state.yaml` desta versão marca `execution: completed`.
