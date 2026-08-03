# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação

- **Feature/Projeto**: `fundacao-multitenancy-identidade` (v1) — fatia 1 da F1
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-01
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/fundacao-multitenancy-identidade/v1/tech_spec.md`
- **PRD**: `docs/prds/features/fundacao-multitenancy-identidade/v1/prd.md`

---

## 2. Objetivo do Task Plan

Entregar a fundação SaaS do backend nativo: isolamento entre empresas **garantido pelo banco** — provado com a camada de aplicação contornada — e identidade por sessão com entrada, segundo fator, bloqueio por tentativas e trilha de auditoria. Ao fim das 11 tasks é possível entrar no sistema com identidade própria, e a empresa A não alcança dado da empresa B nem quando a aplicação é retirada do caminho.

Fecha também o débito **D25** da F0, cujo gatilho é justamente a entrada da autenticação.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Fundação de dados e isolamento**
  - Objetivo: o isolamento existe, é imposto pelo banco e está provado — inclusive contra o próprio conjunto de provas, que precisa reprovar quando o isolamento é removido.
  - Tasks: T1, T2, T3, T4, T5
- **Fase 2 – Identidade**
  - Objetivo: credencial, sessão e as três capacidades que o arcabouço não oferece, com uma barreira única por onde toda emissão de sessão passa.
  - Tasks: T6, T7
- **Fase 3 – Superfície HTTP**
  - Objetivo: a primeira superfície versionada do produto, com contexto de tenant vindo exclusivamente da sessão e default fechado na guarda.
  - Tasks: T8, T9, T10, T11

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|---|---|---|---|---|---|---|
| T1 | Redação de segredo em cadeia de consulta (fecha o D25) | [T1](tasks/T1.md) | 1 | — | Sim | Concluído |
| T2 | Pacote `@sysloc/db`: schemas, migrações e instância efêmera com dois papéis | [T2](tasks/T2.md) | 1 | — | Sim | Concluído |
| T3 | Contexto de tenant, unidade de trabalho e suíte de isolamento | [T3](tasks/T3.md) | 1 | T2 | Não | Concluído |
| T4 | Guarda de cobertura de isolamento no catálogo | [T4](tasks/T4.md) | 1 | T2 | Sim | Concluído |
| T5 | Provisionamento, script de migração e verificação no cluster real | [T5](tasks/T5.md) | 1 | T2 | Sim | Concluído |
| T6 | Pacote `@sysloc/auth`: arcabouço, política de senha, bloqueio e trilha | [T6](tasks/T6.md) | 2 | T2, T3 | Não | Concluído |
| T7 | Barreira única de admissão de sessão | [T7](tasks/T7.md) | 2 | T6 | Não | Concluído |
| T8 | Códigos de erro, prefixo de versão e rotas de autenticação | [T8](tasks/T8.md) | 3 | T7 | Não | Concluído |
| T9 | Guarda de contexto, rotas públicas e rota de sessão | [T9](tasks/T9.md) | 3 | T8 | Não | Concluído |
| T10 | Sessão restrita: troca de senha provisória e segundo fator do Master | [T10](tasks/T10.md) | 3 | T8, T9 | Não | Concluído |
| T11 | Recusas indistinguíveis: bloqueio, desativação e suspensão | [T11](tasks/T11.md) | 3 | T8, T9 | Não | Concluído |

**Derivação do flag** (Regra 10d + Invariante de Paralelismo):

- **T1 ‖ T2** — DAG independente (nenhuma dependência), símbolos disjuntos, paths disjuntos (`packages/shared` + `CLAUDE.md` × `packages/db`), nenhum arquivo de alta contenção em comum.
- **T4 ‖ T5** — ambas dependem só de T2, não entre si; paths disjuntos (`packages/db/src/catalogo.ts` × `deploy/scripts/`); T5 consome as migrações como **arquivo**, não como símbolo de T4.
- **T3 = Não** — colide com T4 em `packages/db/src/index.ts`, que é barrel (arquivo de alta contenção). Roda sozinha.
- **Fase 2 = Não** — T7 depende de T6; task que depende de outra da mesma fase nunca sai `Sim`.
- **Fase 3 = Não** — cadeia T8 → T9 → {T10, T11}; T10 e T11, embora independentes no DAG, ambas modificam `packages/auth/src/admissao.ts`.

### 4.1 Ordem de Execução (grafo)

```
T1
T2 -> T3 -> T6 -> T7 -> T8 -> T9 -> T10
T2 -> T4                          \-> T11
T2 -> T5
```

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| US-01 | Políticas RLS em `negocio` com contexto por transação (§7.2-7.4) | T2, T3, T9 | A Fazer |
| US-02 | `FORCE ROW LEVEL SECURITY` + papel da aplicação não dono (§7.3, §11.2) | T2, T3, T5 | A Fazer |
| US-03 | FK composta `(id, empresa_id)` entre entidades tenantizadas (§7.2) | T3 | A Fazer |
| US-04 | Contexto sem empresa não casa política; sem ramo de aplicação para o Master (§5.2) | T3, T9 | A Fazer |
| US-05 | Credencial e sessão pelo arcabouço, com adaptador Drizzle (§11.1) | T6, T7, T8 | A Fazer |
| US-06 | Política de senha própria e bloqueio persistido (§6.3 RN-05/RN-06) | T6, T11 | A Fazer |
| US-07 | Plugin de segundo fator e predicado de exigência por perfil (§11.1) | T7, T10 | A Fazer |
| US-08 | Marca de senha provisória e sessão restrita (§5.2, RN-09) | T7, T10 | A Fazer |
| US-09 | Encerramento de sessão e expiração de 8 h (RN-07) | T8 | A Fazer |
| US-10 | Predicados de pessoa desativada e empresa suspensa (RN-10) | T7, T11 | A Fazer |
| US-11 | Trilha de tentativas com desfecho, gravada nos dois caminhos (§7.2) | T6 | A Fazer |
| US-12 | Terceiro eixo de redação na entrada única de despacho (§10.3) | T1, T9 | A Fazer |
| US-13 | Guarda de catálogo sobre `pg_class`/`pg_policies`/`pg_constraint` (§7.3) | T2, T4, T5 | A Fazer |

Todas as 13 User Stories têm ao menos uma task. Nenhuma US aparece em mais de 3 tasks — o teto operacional da Regra 5.

---

## 6. Dependências Gerais

- **Fase 0 concluída** — monorepo, PostgreSQL 18, Redis, Vitest com instância efêmera e units systemd. Pré-requisito satisfeito.
- **T2 é o gargalo da Fase 1**: quatro tasks dependem dela. É também a task que o gerador de casos apontou como de maior alavancagem — é ela que separa a conexão da aplicação da conexão privilegiada.
- **Privilégio de execução**: os verificadores de `deploy/scripts/instalacao/` exigem `sudo`, que neste host pede senha interativa. Nenhum subagente os executa — a execução da T5 é conduzida pelo operador junto ao orquestrador, e o gate audita a saída preservada, reportando `executou_testes: false`.
- **Nenhuma dependência externa** — não há integração de terceiro, e a verificação de força de senha foi decidida **sem rede** justamente para não colocar terceiro no caminho da entrada.
- **Bloqueio de escopo**: `packages/shared/test/postgres-efemero.ts` é somente leitura (tech spec §3.7). O helper da T2 o envolve; alterá-lo exigiria demonstrar que a propriedade auditada pela ADR-0006 continua valendo.

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:

- [x] Todas as 11 tasks estiverem concluídas e aprovadas nos dois gates
- [x] `pnpm test` verde, com a contagem de casos **maior** que a baseline da F0 (nenhum caso desapareceu) — **260 contra 115**
- [x] Os 32 CTs implementados, cada um em exatamente uma task — **33 IDs distintos no terreno** (`CT-001`…`CT-033`), mais `CT-101`/`CT-102` da intervenção dirigida no TOCTOU de `reservarPorta()`
- [x] O conjunto de provas de isolamento **reprova** quando o isolamento é removido de propósito (CT-007) e quando a conexão é privilegiada (CT-002)
- [ ] `verificar-fundacao.sh` continua verde, sem nenhuma asserção alterada — ⚠️ **NÃO VERIFICADO**: a bateria exige `sudo` interativo e nenhum subagente a executa (`.claude/rules/testing-stack.md`, Privilégio). `git diff -- deploy/` está **vazio** em todas as 11 tasks, logo **nenhuma asserção foi alterada**; o que falta é a **execução pelo operador**. O substituto versionado é o `CT-018 (b)` da T8, que extrai os endereços do próprio verificador e prova comportamentalmente que os quatro seguem respondendo
- [x] Débito D25 fechado: marcador removido de `log.ts` e linha removida do `CLAUDE.md` — **conferido: `grep -n "D25"` em ambos devolve vazio**
- [x] Todas as 13 User Stories cobertas (tabela da seção 5)
- [x] Marcador `DECISÃO FECHADA` registrado sobre a barreira de admissão (T7) — `packages/auth/src/autenticacao.ts:418`

---

## 8. Riscos & Mitigações

- **Suíte verde que não prova nada** (conexão privilegiada) → CT-001 afirma as quatro condições sob as quais o PostgreSQL ignoraria a RLS; CT-002 prova que a bateria reprova sobre o papel dono.
- **Prefixo `/v1` derrubando as provas da F0** → exclusão declarada de `saude` e do contrato, com `verificar-fundacao.sh` rodado antes e depois da T8. Este é o ponto de maior risco de regressão da fatia.
- **Caminho paralelo de emissão de sessão no arcabouço** → CT-026 enumera os caminhos do pacote instalado; é obrigação de prova assumida pela decisão D6, não suposição.
- **Regressão em `log.ts` ao fechar o D25** → baseline antes e depois, prova de falsificação, e nenhuma alteração no que os eixos existentes já redigem.
- **`embedded-postgres` em versão beta divergindo do cluster real** → a T5 confere papéis, propriedade e cobertura no cluster real, além da suíte.
- **T2 como gargalo** → é a primeira task da fase e não tem dependências; T1 roda em paralelo com ela para não deixar a fase ociosa.

---

## 9. Checklist Final

- [x] Task Plan completo
- [x] Tasks mapeadas (11 arquivos em `tasks/`)
- [x] Dependências validadas — nenhuma task consome símbolo nascido em task posterior (Regra 10a)
- [x] Flag de paralelismo **derivado** do DAG + símbolos + paths (Regra 10d), com a justificativa registrada na seção 4
- [x] Rastreabilidade User Stories → Tasks preenchida (13/13)
- [x] Cada CT em exatamente uma task (32/32 distribuídos, nenhum duplicado)
- [x] `model`, `risk` e `gates` preenchidos em todas as tasks
- [x] Pronto para execução
