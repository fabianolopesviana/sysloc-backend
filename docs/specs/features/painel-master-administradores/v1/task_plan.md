# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Painel Master — ciclo de vida de Empresas e Admin Empresa
- **Responsável (Tech Lead)**: —
- **Data**: 2026-09-01
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/painel-master-administradores/v1/tech_spec.md`
- **PRD**: `docs/prds/features/painel-master-administradores/v1/prd.md`

---

## 2. Objetivo do Task Plan

Dar ao Sysloc Master o ciclo de vida completo da Empresa e do Admin Empresa — listar, corrigir,
suspender, reativar e **excluir em definitivo** quando não houver registro algum.

**7 rotas novas** sob `/v1/master`, **nenhuma tabela e nenhuma migração**. O critério de exclusão é a
**integridade referencial do banco** (ADR-0038), nunca uma contagem — porque a contagem sobre
`negocio` a partir do Master devolve **zero para uma empresa cheia**, e a falha seria **silenciosa**.

⚠️ **As 7 rotas ficam FORA do congelamento da superfície** (ADR-0039): ele alcança a superfície que o
`@syslocbr/contracts` entrega à imobiliária, e o operador do SaaS não é aquele cliente. As âncoras
executáveis, porém, contam **as duas** superfícies — daí o 106 → 113 da T7.

---

## 3. Macro-Fases (alto nível)

> **Recorte técnico, não o do PRD §11.** O roadmap do PRD (*Enxergar / Corrigir / Remover*) é recorte
> de **valor de produto**, e as três fases dele compartilham os **mesmos arquivos**:
> `administrador-do-master.ts` e `administrador.controller.ts` nasceriam e seriam reabertos três
> vezes. Isso viola as Regras 3 e 7 da decomposição — nenhum commit seria atômico. O valor incremental
> do PRD está preservado na **rastreabilidade** (§5), não na ordem dos arquivos.

- **Fase 1 – Camada de acesso (`@sysloc/db`)**
  - Objetivo: entregar todo o acesso que as 7 operações consomem, o vocabulário fechado de
    impedimentos, e as **duas guardas** que impedem o critério de exclusão de envelhecer em silêncio.
  - Tasks: T1, T2
- **Fase 2 – Borda (`apps/api`)**
  - Objetivo: publicar as 7 rotas, depois de fechar o débito do acessório que a suíte nova
    duplicaria pela sétima vez.
  - Tasks: T3, T4, T5, T6
- **Fase 3 – Âncoras e escrituração**
  - Objetivo: mover a superfície publicada para 113/98/20 **no mesmo diff** da prosa que a afirma, e
    fechar os dois documentos que a publicação torna falsos.
  - Tasks: T7, T8

---

## 4. Lista de Tasks (visão macro)

| ID  | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T1  | Camada de acesso do Master — módulo novo, extensões em `empresa.ts` e o vocabulário de impedimentos | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2  | Guardas de catálogo — vocabulário e **cobertura** do critério de exclusão | [T2](tasks/T2.md) | 1 | T1 | Não | Concluído |
| T3  | Fecho do `D32 · F5/T7` — subir `entrarComSegundoFatorCumprido` para a casa compartilhada | [T3](tasks/T3.md) | 2 | — | Não | Concluído |
| T4  | R1–R3 — controlador e serviço do Admin Empresa: listagem, suspensão e reativação | [T4](tasks/T4.md) | 2 | T1, T3 | Não | Concluído |
| T5  | R4–R5 — edição e **exclusão definitiva** do Admin Empresa | [T5](tasks/T5.md) | 2 | T4 | Não | Concluído |
| T6  | R6–R7 — edição e **exclusão definitiva** da Empresa, e `exclusao` na listagem existente | [T6](tasks/T6.md) | 2 | T1, T5 | Não | Concluído |
| T7  | Âncoras de superfície, cobertura de autorização e as 4 ocorrências normativas do `CLAUDE.md` | [T7](tasks/T7.md) | 3 | T4, T5, T6 | **Sim** | Concluído |
| T8  | Escrituração — emenda à ADR-0014 e handoff do Painel Master | [T8](tasks/T8.md) | 3 | T4, T5, T6 | **Sim** | Concluído |

### 4.0 Por que só a Fase 3 paralelisa (derivação da Regra 10d)

O flag é **computado**, não autorado. O que barrou cada par:

| Par | Condição violada | Evidência |
|---|---|---|
| T1 × T2 | disjunção de símbolo | T2 consome `IMPEDIMENTOS_DE_EXCLUSAO`, criado por T1 |
| T3 × T4 | disjunção de símbolo | T4 consome `entrarComSegundoFatorCumprido`, promovido por T3 |
| T4 × T5 | paths | os mesmos `administrador.controller.ts` / `.service.ts` |
| T4/T5 × T6 | paths | os três escrevem em `apps/api/test/master-administradores.e2e.spec.ts` |
| **T7 × T8** | **nenhuma** | DAG independentes, símbolos disjuntos, paths disjuntos (T7: suíte de cobertura + `CLAUDE.md` + `protocolo-antirregressao.spec.ts`; T8: ADR-0014 + handoff), nenhum arquivo de alta contenção em comum ⇒ **Sim** |

⚠️ **T1 e T3 não dependem uma da outra**, mas estão em **fases diferentes** (1 e 2), e o invariante
opera **dentro** da fase. Quem quiser antecipar T3 para a Fase 1 pode — ela não consome nada.

### 4.1 Ordem de Execução (grafo)

```
T1 -> T2
T1 -> T4 -> T5 -> T6 -> T7
T3 -> T4
T6 -> T8
```

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
| --- | --- | --- | --- |
| US-01 — ver quem administra cada Empresa | R1 · `listarAdministradoresDaEmpresa` | T1, T4 | A Fazer |
| US-02 — reemitir Senha provisória pela linha | R1 fornece o `usuarioId`; a reemissão existente o consome **sem mudança** | T4 | A Fazer |
| US-03 — suspender um Admin Empresa | R2 · `definirAtivoDoAdministrador` + `encerrarSessoesDoAdministrador` | T1, T4 | A Fazer |
| US-04 — reativar um Admin Empresa suspenso | R3 · `definirAtivoDoAdministrador` | T1, T4 | A Fazer |
| US-05 — corrigir dados da Empresa | R6 · `alterarEmpresa` | T1, T6 | A Fazer |
| US-06 — corrigir dados do Admin Empresa | R4 · `alterarAdministrador` | T1, T5 | A Fazer |
| US-07 — saber de antemão se pode excluir | `exclusao` por item · `elegibilidadeDeExclusao*` | T1, T5, T6 | A Fazer |
| US-08 — excluir em definitivo um Admin Empresa | R5 · `excluirAdministrador` | T1, T5 | A Fazer |
| US-09 — excluir em definitivo uma Empresa | R7 · `excluirEmpresa` | T1, T6 | A Fazer |
| US-10 — entender a recusa e a alternativa | `IMPEDIMENTOS_DE_EXCLUSAO` + tradução da recusa | T1, T2, T5, T6 | A Fazer |

**10/10 US cobertas.** Máximo de tasks por US: **3** (US-07) — dentro da Regra 5.

⚠️ **T3, T7 e T8 não mapeiam US**: são, respectivamente, fecho de débito declarado, invariante de
superfície do repositório e escrituração de documento. Não são US órfãs — são trabalho que a
publicação torna obrigatório.

---

## 6. Dependências Gerais

- **Entre tasks**: o grafo da §4.1. A Fase 2 inteira depende da T1; a Fase 3 depende das 7 rotas
  estarem publicadas.
- **Externas**: nenhuma. Nenhuma dependência nova de pacote, nenhuma variável de ambiente nova,
  nenhuma unidade `systemd` nova, **nenhuma migração**.
- **Pré-requisitos do time**:
  - ⚠️ **Meça sempre pelo script do pacote** (`pnpm --filter @sysloc/<p> test`). `vitest run` avulso é
    **inválido** aqui — lê o `dist/` anterior e **inverte** a conclusão de qualquer prova de
    falsificação. `turbo run test` aborta os pacotes irmãos e a saída agregada não é confiável.
  - **Baseline P1 antes da primeira edição** e **P5 depois**, comparadas **caso a caso** — é o que o
    Protocolo Antirregressão exige, e é a única prova da T3.

---

## 7. Critérios de Conclusão da Feature

> **Verificados por MEDIÇÃO em 2026-09-02, no fecho do run.** Cada linha traz como foi medida — o
> que não se mediu não se marca.

- [x] Todas as 8 tasks concluídas e aprovadas nos gates declarados — T1–T6 na sessão anterior,
      **T7 e T8** nesta. A T7 fechou em **1 rodada** (os dois gates aprovando de primeira); a T8 em
      **2** (um `ALTO/logic` real na rodada 1)
- [x] As **7 rotas** publicadas e a superfície em **113 / 98 / 20**, pelos dois eixos independentes —
      `ROTAS_PUBLICADAS_EM_PRODUCAO = 113` (L2628), `MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 98`
      (L3013), `PARES_PUBLICOS_DA_SUPERFICIE = 20` (L3366) em
      `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`. ⚠️ Uma **quarta** âncora se moveu, fora
      da §3.2 da T7: `ROTAS_PUBLICADAS_NO_MUTANTE` 100 → **107**, sem a qual o `CT-213 (b)` seguiria
      vermelho. Divergência declarada e sustentada pelos dois gates
- [x] **20/20 CAs** verificados; **10/10 US** cobertas — os CAs pelos gates task a task; as US pela
      §5 deste plano, sem US órfã
- [x] Os CTs implementados e verdes — ⚠️ **são 46, não 40**: `CT-1204` a `CT-1249`, contados por
      `grep` sobre `apps/api/test`, `packages/db/test` e `packages/shared/test`. Os **6** além do
      previsto nasceram de rodadas de gate (`CT-1244`/`CT-1245` na T4, `CT-1246` na T5,
      `CT-1247`/`CT-1248`/`CT-1249` na T6). O `CT-1196` também foi **estendido** na T7, de 3 para 10
      pares, e isso não cria CT novo
- [x] Baseline dos **9 pacotes** comparada caso a caso — nenhum caso verde ficou vermelho, nenhuma
      contagem caiu. **P1 2070 → P5 2093**: `contracts` 455 · `api` 455 · `shared` 309 · `db` 296 ·
      `worker` 180 · `documentos` 159 · `auth` 95 · `cobranca-bancaria` 114 · `regua` 30, os nove
      verdes, `skipped`/`todo` em **zero**. ⚠️ Os **14 vermelhos por desenho** de
      `cobertura-de-autorizacao.e2e.spec.ts` **fecharam na T7**, sem virar casos novos
- [x] Marcadores `DECISÃO FECHADA` escritos — ⚠️ **são 12 linhas acrescentadas** em `apps` e
      `packages` ao longo da fatia, não os 2 que este plano previa. O previsto era o **mínimo**
      (pontos de escrita do fato de acesso; critério de elegibilidade), e os demais nasceram de
      fechos de gate, que é exatamente o gatilho que a §3 da `nao-regressao.md` nomeia
- [ ] ⚠️ **O débito `D32 · F5/T7` NÃO foi fechado, e não deveria ter sido — este critério estava
      errado ao ser escrito.** A T3 pagou **uma das três** metades (subiu
      `entrarComSegundoFatorCumprido` de 6 cópias privadas para `apps/api/test/acessorios-de-borda.ts`).
      As outras duas — `envelhecerOVigente` e `montarEmpresaComAdmin` — seguem abertas no mesmo bloco,
      com o Limiar de Três **ainda por disparar**. Medido no fecho: o marcador segue vivo em
      `acessorios-de-borda.ts`, `rotinas-agendadas.e2e.spec.ts`, `percurso-do-cliente-novo.e2e.spec.ts`
      e `entrega-da-noticia.e2e.spec.ts`. **Fechar pelo número levaria as outras duas junto**, que é
      precisamente o que a §3-B da `nao-regressao.md` adverte. A linha do índice **permanece**, agora
      qualificada
- [x] As **4** ocorrências normativas do `CLAUDE.md` atualizadas **no mesmo diff** da constante; a
      **histórica** não reescrita — o Tech Review rodou os **10 moldes do `CT-1196` contra o
      `CLAUDE.md` real** e os dez casaram em 113/98/20. A auditoria de drift de **2026-08-24** segue
      dizendo `91 manipuladores` e ganhou a marca de que é medição daquela data
- [x] ADR-0014 emendada com o texto original preservado **byte a byte** — **22 inserções, ZERO
      remoções ou alterações**, conferido por diff dirigido contra o `base_sha`
- [x] `handoff-master-frontend.md` com **13** rotas (§4.1 a §4.13), §7 sem os 3 marcadores falsos —
      mais o aviso *"Guarde o `usuarioId`"* e as duas cópias dele — e §8 sem o condicionamento ao
      `D23 · F1/T8`
- [x] **Nenhuma migração criada** — `git status packages/db/migracoes/` vazio: nenhuma criada,
      nenhuma alterada

## 8. Riscos & Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Implementar a elegibilidade por **contagem** | **Crítico** — habilitaria apagar empresa cheia, e a falha é silenciosa | CT-1204 com o par contagem/sonda (T1) + marcador `DECISÃO FECHADA` no critério |
| Tabela futura em `negocio` **sem caminho bloqueante** até `identidade.empresa` | **Crítico** — empresa cheia vira excluível, deixando órfãos que a RLS torna invisíveis | CT-1242 + CT-1243 (T2), com prova de falsificação |
| "Unificar" a suspensão com `pessoa.ts` | **Alto** — devolve suspensão silenciosamente inócua | CT-1206 e CT-1207 (T1) + marcador nos **dois** pontos de escrita |
| Esquecer o `savepoint` na prévia | **Alto** — a prévia removeria a empresa elegível | CT-1209 (T1) — o caminho em que o `DELETE` teria **sucesso** |
| `detail` do driver escapar na resposta | **Alto** — carrega valores de chave | CT-1239 (T6) com controle positivo |
| Copiar a forma do `empresa.controller.ts` no controlador **novo** | **Médio** — propaga a divergência com a ADR-0016 para código que ainda não existe | §3.2 da T4 é explícita; o Tech Review audita o diff |
| Classificar **uma só** das duas restrições da `acesso_usuario_app` | **Médio** — metade das recusas degrada para erro genérico | CT-1210 com as **8** em `it.each`; CT-1215 por `constraint_name` |
| Crescer `paresDoMaster()` | **Médio** — reprova o `CT-318` sobre superfície legítima | partição nomeada nova (T7) |
| Esquecer a emenda do `CLAUDE.md` | **Médio** — `CT-1196` fica vermelho e o P5 lê como regressão | as 4 ocorrências e a constante no **mesmo diff** (T7) |
| Sonda por item retém bloqueios no teto de página | **Médio** — latência não medida vira decisão no escuro na próxima fatia | medição única na T5, registrada no `_run/run-report.md` |

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas — 8 tasks, 3 fases
- [x] Dependências validadas e reconciliadas (Regra 10a — símbolos criados/consumidos preenchidos nas 8)
- [x] Flag de paralelismo **derivado** do DAG + símbolos + paths (Regra 10d) — justificado na §4.0
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — 10/10, sem US órfã
- [x] Seção 6 preenchida nas 8 tasks (redistribuição de `_run/test-cases.json`, sem reinvocar o generator)
- [x] `_run/test-cases.json` atualizado com `task_id` nos 40 casos
- [x] `model`, `risk`, `gates` declarados nas 8
- [x] Pronto para execução
