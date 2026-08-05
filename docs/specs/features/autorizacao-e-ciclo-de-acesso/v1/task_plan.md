# TASK PLAN — Plano de Execução

> **Documento de REFERÊNCIA/ÍNDICE.** O corpo detalhado de cada task vive exclusivamente em `tasks/TN.md`.

## 1. Identificação
- **Feature/Projeto**: `autorizacao-e-ciclo-de-acesso` — segunda e última fatia da Fase 1
- **Variante**: backend
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-04
- **Versão**: v1
- **Status**: Concluído
- **Tech Spec Relacionado**: `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech_spec.md`
- **PRD Relacionado**: `docs/prds/features/autorizacao-e-ciclo-de-acesso/v1/prd.md`

---

## 2. Objetivo do Task Plan

Decompor a fatia em **9 tasks** que entregam a autorização como decisão de um ponto único: o substrato de dados, o domínio das 17 chaves, o ponto de aplicação com revalidação por versão, a verificação de cobertura, e o ciclo de vida de empresas e pessoas com onboarding por Senha provisória. Fecha cinco débitos herdados — **D7**, **D21**, **D5**, **P-T6-1** e a metade acionável do **P-T6-2**.

---

## 3. Macro-Fases (alto nível)

> As fases seguem **dependência técnica**, não o roadmap de valor do §11 do PRD. O roadmap do PRD ordena por valor entregue, e usá-lo como ordem de execução inverteria a dependência: a "Fase 1 — o que cada pessoa pode" exige que **exista uma pessoa**, e a criação de pessoas está na "Fase 3 — a primeira senha".

| Fase | Nome | Entrega |
|---|---|---|
| **1** | Fundação | Migrações `0003`/`0004` com a conciliação estrutural; catálogo, matriz e efetivo; ajustes persistidos com o contador |
| **2** | Ponto de aplicação | Decisão consultada num lugar só, exigência declarada por rota com default que nega, revalidação por versão, sessão com 11 campos, cobertura verificada sobre o roteador |
| **3** | Ciclo de vida | Campos com escrita fechada e onboarding, rotas do Master e do Admin, troca de senha na forma do produto com a nativa desligada |

---

## 4. Lista de Tasks (visão macro)

| ID | Nome | Descrição | Fase | Dependências | Paralelo (derivado) | model | risk | gates | Status |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Migrações `0003`/`0004` e schema da autorização | Coluna de efeito, unicidade do trio, contador, colunas de sessão, conciliação estrutural (D5) e valor novo do enum (P-T6-1) | 1 | — | **Sim** | opus | high | [qa, tech_review] | Concluído |
| T2 | Catálogo, matriz por perfil e cálculo do efetivo | As 17 chaves como união fechada, mapa ação→tela, `(perfil ∪ concedidas) − negadas` com a negação vencendo | 1 | — | **Sim** | opus | medium | [qa, tech_review] | Concluído |
| T3 | Ajustes de permissão com incremento do contador | Leitura sob RLS sem filtro de aplicação; escrita e contador na mesma transação | 1 | T1, T2 | Não | opus | high | [qa, tech_review] | Concluído |
| T4 | Ponto de aplicação: decisão, exigência, guarda e sessão | Decisão em `@sysloc/auth` consultada pela guarda; revalidação por versão com reescrita; sessão de 8 → 11 campos | 2 | T2, T3 | Não | opus | high | [qa, tech_review] | Concluído |
| T5 | Verificação de cobertura de autorização | Nenhuma rota governada sem declaração; inventário das públicas por igualdade | 2 | T4 | Não | opus | high | [qa, tech_review] | Concluído |
| T6 | Campos com escrita fechada, onboarding e limitador | Fecha o D7 (elevação de privilégio e fuga de tenant) e a metade acionável do P-T6-2 | 3 | T1 | Não | opus | high | [qa, tech_review] | Concluído |
| T7 | Rotas do Master: ciclo de vida da empresa | Admitir, listar, admitir administrador, reemitir senha, suspender e reativar — com encerramento na origem | 3 | T4, T6 | Não | opus | high | [qa, tech_review] | Concluído |
| T8 | Rotas do Admin: ciclo de vida das pessoas | Criar, listar, ajustar permissões, trocar perfil, desativar e reativar, sob a fronteira de tenant | 3 | T3, T4, T6 | Não | opus | high | [qa, tech_review] | Concluído |
| T9 | Troca de senha do produto e desligamento da nativa | Fecha o D21 pela topologia; recusa antes de qualquer escrita; inventário de `/v1/auth` de 6 para 5 | 3 | T4 | Não | opus | high | [qa, tech_review] | Concluído |

> **Todas em `opus`, todas com os dois gates** — a fatia inteira cruza `auth`, `security` e `db_migrations`, e o `CLAUDE.md` fixa Opus para todo subagente deste projeto. Nenhuma task se qualificou para o fast-path de `[qa]`.

### 4.1 Ordem de Execução (grafo)

```
Fase 1        T1 ─┐               (T1 ∥ T2)
              T2 ─┼──→ T3
                  │
Fase 2            └──→ T4 ──→ T5
                        │
Fase 3        T1 ──→ T6 │
                     │  │
                     ├──┴──→ T7
                     ├─────→ T8
                     └─ T4 ─→ T9
```

**Paralelismo derivado, não autorado.** Só **T1 ∥ T2** sobrevive ao invariante: independentes no DAG, símbolos e paths disjuntos, e tocam arquivos de **alta contenção diferentes** — a ledger de migrações (T1) e o barrel do pacote (T2). Na fase 3, **T7 e T8 disputam o `app.module.ts`**, o que basta para todas caírem para sequencial pelo default conservador.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| US-01 — Master admite empresa | §4.1, `EmpresaService` | T7 | Concluído |
| US-02 — Master cria o primeiro Admin | §11.4, `onboarding` | T6, T7 | Concluído |
| US-03 — Master reemite Senha provisória | §6.2, `onboarding` | T6, T7 | Concluído |
| US-04 — Master suspende empresa | §7.4, §5.1 | T7 | Concluído |
| US-05 — Master reativa empresa | RN-05 | T7 | Concluído |
| US-06 — Master lista empresas | §4.1, §4.2 | T7 | Concluído |
| US-07 — Socorro por Admin adicional | RN-13, §4.1 | T7 | Concluído |
| US-08 — Admin cria pessoa | §7.4, D6 | T6, T8 | Concluído |
| US-09 — Admin concede e retira | §6.1, §6.3, §7.2 | T2, T3, T8 | Concluído |
| US-10 — Admin troca perfil | §4.1.1, RN-11 | T2, T3, T8 | Concluído |
| US-11 — Admin desativa pessoa | §7.4, D5 | T8 | Concluído |
| US-12 — Admin reativa pessoa | RN-06 | T8 | Concluído |
| US-13 — Pessoa troca a Senha provisória | §15.2, §21 | T9 | Concluído |
| US-14 — Pessoa conhece o que alcança | §4.2, §5.1 | T2, T4 | Concluído |
| US-15 — Mudança vale na operação seguinte | §5.1 passo 4, §7.4 | T3, T4 | Concluído |
| US-16 — Recusa nomeia a permissão | §10.1, ADR-0011 | T4, T5 | Concluído |

**As 16 US cobertas.** Nenhuma aparece em mais de 3 tasks — dentro do teto da Regra 5.

---

## 6. Dependências Gerais

- **Migração antes do código que lê as colunas** (§16.4 do tech spec). A T1 precede tudo que consome `versao_permissoes`, `efeito` ou as colunas de sessão.
- **Nenhuma dependência externa nova.** Os três recursos que a fatia usa do arcabouço de identidade — campos adicionais com escrita fechada, encerramento de sessão por pessoa e limitador de taxa — já existem na versão instalada, medidos pela fatia anterior.
- **Coordenação entre T6 e T9**: os marcadores `DÉBITO COM GATILHO` do **D7** e do **D21** vivem no mesmo arquivo. Cada um sai no commit da sua correção — o do D7 na T6, o do D21 na T9 —, junto da respectiva linha no índice do `CLAUDE.md`.
- **T5 depende do T4 estar completo**, não parcial: a cobertura só é verificável quando todas as rotas do momento declaram exigência.

---

## 7. Critérios de Conclusão da Feature

- [x] As 9 tasks aprovadas nos dois gates
- [x] Os 23 CA do PRD verificados pelos 36 casos de teste
- [x] As **cinco provas de falsificação** executadas e registradas no relatório do run, cada uma com o comando literal: CT-203 (precedência da negação), CT-209 (ausência de filtro por empresa), CT-213 (cobertura de rotas), CT-216 (ponto de aplicação único), CT-235 (campos fechados)
- [x] `pnpm build`, `pnpm lint` e `pnpm test` verdes, com a contagem de casos **comparada** à baseline de entrada — 274 → **350** (+76)
- [x] Os cinco débitos fechados: **D7**, **D21**, **D5**, **P-T6-1** e a metade acionável do **P-T6-2**
- [x] Marcadores do D7 e do D21 removidos, com as linhas correspondentes fora do índice do `CLAUDE.md`
- [x] A mudança do inventário de `/v1/auth` declarada como **mudança de escopo**, com a linha `SUT_IS_CORRECT_BECAUSE:`
- [x] Nenhuma rota publicada sem declaração de exigência (CT-213)
- [x] Os dois CA da §F1 que só esta fatia satisfaz verificados: *revogação reflete na requisição seguinte* e *suspensão encerra sessões na hora*

---

## 8. Riscos & Mitigações

| Risco | Task | Mitigação |
|---|---|---|
| A precedência da negação ser burlada por um caminho de leitura | T2 | CT-203 com mutante de ordem nos 3 caminhos; a unicidade do trio (T1/CT-206) impede o dado inconsistente que exigiria arbitragem |
| Segunda avaliação de autorização nascer num manipulador | T4 | CT-216 por varredura de fontes, com mutante que planta a segunda consulta |
| Rota nova nascer sem declaração | T5 | Default fechado + CT-213 sobre o roteador montado; o esquecimento vira `403`, não abertura |
| A correção do D7 abrir escrita de `perfil`/`empresa_id` | T6 | CT-235 pelo vetor da **troca lateral**, que a restrição existente não pega |
| Desligar a rota nativa quebrar outra do encaminhador | T9 | CT-234 assere o inventário completo, não só a ausência da rota removida |
| Modificar a guarda que toda requisição atravessa | T4 | Baseline antes da primeira edição e comparação caso a caso ao fim; caso que estava verde e ficou vermelho é regressão — reverter, nunca ajustar o teste |
| Recusa que deixa efeito colateral | T9 | CT-234 assere `senha_derivada` inalterada **e** sessões preservadas — o `401` sozinho passaria com a implementação defeituosa |

---

## 9. Checklist Final

- [x] Todas as fases definidas e validadas com o usuário
- [x] Todas as tasks criadas com template completo (T1 a T9)
- [x] Dependências entre tasks mapeadas e coerentes
- [x] `Símbolos públicos criados` / `Símbolos consumidos de outras tasks` preenchidos em cada `TN.md`
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + alta contenção
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — as 16 US cobertas
- [x] Critérios de conclusão da feature definidos
- [x] Seção 6 preenchida em cada task por **redistribuição** do JSON lossless, sem reinvocar o gerador
- [x] `_run/test-cases.json` atualizado com `task_id` nos 36 casos, sem duplicata
- [x] Arquivos impactados listados em cada task (5.1, 5.2, 5.3)
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas — três fusões feitas para evitar fragmentação
- [x] Cada task salva em arquivo individual `tasks/TN.md`
- [x] `task_plan.md` contém APENAS referências
- [x] Pronto para execução
