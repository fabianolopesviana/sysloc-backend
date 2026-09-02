# Retomada do run — `painel-master-administradores/v1`

> **Pausa controlada, a pedido do usuário, em 2026-09-02.** Este arquivo existe para que a sessão
> seguinte retome sem reconstruir contexto. **O run NÃO terminou** — faltam **2 de 8** tasks.

## Como retomar, em uma linha

```
/agent-spec-sdd-run-tasks @docs/specs/features/painel-master-administradores/v1/task_plan.md sysloc-backend-implementer
```

A skill relê o `task_plan.md`, encontra T1–T6 em `Concluído`, e as tasks prontas são **T7 e T8**.

## Estado exato na pausa

| | |
|---|---|
| **Tasks concluídas** | **6 de 8** — T1, T2, T3, T4, T5, T6 |
| **Fases fechadas** | **Fase 1** (T1, T2) e **Fase 2** (T3, T4, T5, T6) |
| **Falta** | **Fase 3**: o lote **paralelo** T7 ∥ T8 |
| **`base_sha` do run** | `1fcb33c01eb9c4f1898e0950a22217af9ae86d94` — **HEAD não se moveu**; nada foi commitado |
| **Memória lazy** | `_run/tmp/` **vazio** — nenhuma task em ciclo de correção |
| **Guarda de continuidade** | **desarmada** para a pausa. **Rearme ao retomar** (a skill o faz na Inicialização) |
| **Stage** | 46 caminhos staged, **sem commit** — o usuário decide quando agrupar |

## ⚠️ A suíte do `api` está VERMELHA em 14 casos, e isso é DESENHO — não conserte

As três constantes executáveis de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` seguem em
**106 / 91 / 20** enquanto a superfície medida chegou ao valor **final** de **113 / 98**. Elas sobem
**de uma vez na T7**, por decisão da **§4.0 do `task_plan.md`**, **aprovada pelo Gate 2 na T4**.

Os 14, todos naquele arquivo e de **causa única**, verificados em **todas** as rodadas de T4, T5 e T6:
`CT-213`, `CT-213 (b)`, `CT-318`, `CT-355`, `CT-427`, `CT-533`, `CT-635`, `CT-732`, `CT-836`,
`CT-937`, `CT-972`, `CT-1004`, `CT-1038`, `CT-1095`.

⚠️ **A T7 é quem os fecha.** Qualquer vermelho **fora** daquele arquivo, ou **dentro** dele por outra
causa, é regressão e é `CRITICO`.

## Contagem na pausa

**Suíte: 2070 casos**, 9 pacotes — `contracts` 455 · **`api` 446** (432 verdes + 14) · `shared` 295 ·
**`db` 296** · `worker` 180 · `documentos` 159 · `auth` 95 · `cobranca-bancaria` 114 · `regua` 30.

Índice de débito do `CLAUDE.md`: **42** linhas, prosa *"São **42**"*, e
`LINHAS_DO_INDICE_NO_FECHO_DA_FATIA = 42` — **as três pontas concordam**, e o `shared` verde é a prova.

## O que a T7 e a T8 herdam, e que a sessão nova precisa saber

### T7 — âncoras, cobertura e as 4 ocorrências normativas do `CLAUDE.md`

- Move as três constantes para **113 / 98 / 20** e as **4 ocorrências normativas** do `CLAUDE.md`
  **no mesmo diff**. A **quinta** (L405) é **histórica** e **não** se reescreve.
- ⚠️ **Recomendação do Gate 2, dada na T4 e reafirmada na T6**: afirmar os três eixos contra a
  **medição**, **nunca** contra a aritmética `106+7`.
- O `CT-1196` (em `packages/shared/test/protocolo-antirregressao.spec.ts`) **lê** os números do
  `CLAUDE.md` e as três constantes e afirma a igualdade eixo a eixo — a divergência fica **vermelha**.
- ⚠️ A `paresDoMaster()` tem **6 pares** hoje; crescê-la reprovaria o `CT-318` sobre superfície
  legítima. A §4 da T7 manda **partição nomeada nova**.

### T8 — emenda à ADR-0014 e handoff do Painel Master

- ⚠️ **O `D21` desta fatia recomenda uma emenda ao `Cons` da ADR-0038**, com o texto original
  preservado byte a byte. **É decisão do usuário** — gate não emenda ADR. Se ela for feita, o **`D13`
  fecha no mesmo passo** (é a outra ponta da mesma frase).
- O `handoff-master-frontend.md` vai de **6 para 13 rotas**.

### Débitos vivos que T7/T8 podem disparar

- **`D9`** — `contarSessoesDaPessoa` com duas cópias; gatilho na terceira.
- **`D12 · F7/T4`** — ⚠️ **já anotado como `JÁ DISPAROU (F7/T6)`** nas duas pontas.
- **`D22 · F7/T6`** — os 6 esquemas à mão de `empresa.controller.ts`; gatilho é *a primeira task
  autorizada a abrir aquele arquivo para reformar a publicação do contrato*.

## Três lições de spec que esta fatia produziu, e que a T7/T8 devem honrar

Foram **quatro** lacunas da mesma família, e cada uma custou uma rodada de gate:

1. **§6.4 sem coluna `CT`** — cenário de erro declarado sem CT fica **sem prova**, e a rastreabilidade
   não acusa. Produziu o `CT-1220 (b)` (T4) e o `CT-1246` (T5). **Fechada nas specs da T5 e da T6.**
2. **§6.5 apontando para caso que não exercita o verbo** — a rastreabilidade confere `CT → caso`,
   nunca `caso → verbo`. Produziu o `CT-1248` (T6). **Fechada na §6.5 da T6.**
3. **Resposta declarada no contrato (`@ApiNotFoundResponse`) sem CT em lugar nenhum da §6** —
   é cenário **do contrato**, não do domínio. Produziu o `CT-1249` (T6). **Fechada na §6.4 da T6.**

⚠️ **A T7 e a T8 não têm as três colunas.** Vale conferir antes de despachá-las.

## Onde está cada coisa

| Artefato | Caminho |
|---|---|
| Relatório humano (4 seções, **24 débitos** anotados) | `_run/run-report.md` |
| Telemetria do pipeline (todas as rodadas, vereditos, medições) | `_run/workflow-report.md` |
| Candidatos a regra (**11** sinais) | `_run/rule-candidates.md` |
| Estado | `_run/sdd_state.yaml` — `execution: in_progress`, `tasks_completed: 6` |
