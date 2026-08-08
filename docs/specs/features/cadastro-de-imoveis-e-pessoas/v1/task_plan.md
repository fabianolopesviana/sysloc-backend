# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Cadastro de imóveis e pessoas do domínio de locação (fatia 1 de 2 da fase)
- **Responsável (Tech Lead)**: sysloc
- **Data**: 2026-08-05
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech_spec.md`
- **PRD**: `docs/prds/features/cadastro-de-imoveis-e-pessoas/v1/prd.md`

---

## 2. Objetivo do Task Plan

Introduzir as primeiras entidades de negócio no schema tenantizado — conjunto, imóvel, cômodo, locador,
locatário e fiador — junto do pacote `@sysloc/contracts`, que passa a ser a fonte única do contrato da
API. Ao final das 11 tasks: 33 rotas sob `/v1` governadas pelo catálogo fechado, metragem derivada com
equivalência provada contra o registro capturado do sistema antigo, e nada apagável.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Fundação**
  - Objetivo: entregar o que todas as demais consomem — contrato, schema, conferência de documento e o
    módulo de borda que fecha o débito D38.
  - Tasks: T1, T2, T3, T4
- **Fase 2 – Imóveis**
  - Objetivo: conjunto, imóvel e cômodos de ponta a ponta, com a metragem derivada provada contra o golden.
  - Tasks: T5, T6, T7
- **Fase 3 – Pessoas**
  - Objetivo: os três papéis sobre uma implementação parametrizada, e a prova transversal de circulação.
  - Tasks: T8, T9
- **Fase 4 – Carteira e fechamento**
  - Objetivo: a carteira numa consulta só, a cobertura de autorização das 33 rotas e o fechamento das
    suítes existentes que a fatia faz reprovar.
  - Tasks: T10, T11

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|---|---|---|---|---|---|---|
| T1 | Pacote `@sysloc/contracts` — esquemas base e enums | [T1](tasks/T1.md) | 1 | — | **Sim** | Concluído |
| T2 | Schema do domínio e migrações `0005`/`0006` | [T2](tasks/T2.md) | 1 | T1 | Não | Concluído |
| T3 | Conferência de CPF e CNPJ em `@sysloc/shared` | [T3](tasks/T3.md) | 1 | — | **Sim** | Concluído |
| T4 | Extração da tradução de validação — fecha o D38 | [T4](tasks/T4.md) | 1 | — | **Sim** | Concluído |
| T5 | Conjunto — dado, serviço e as seis rotas | [T5](tasks/T5.md) | 2 | T1, T2, T4 | Não | Concluído |
| T6 | Imóvel — unicidade, circulação e as seis rotas | [T6](tasks/T6.md) | 2 | T5 | Não | Concluído |
| T7 | Cômodos e metragem total derivada | [T7](tasks/T7.md) | 2 | T6 | Não | Concluído |
| T8 | Pessoas — dado e serviço parametrizado | [T8](tasks/T8.md) | 3 | T1, T2, T3 | Não | Concluído |
| T9 | Os três controladores e a circulação transversal | [T9](tasks/T9.md) | 3 | T8, T6 | Não | Concluído |
| T10 | Carteira expandida e janela de listagem | [T10](tasks/T10.md) | 4 | T7, T9 | Não | Concluído |
| T11 | Cobertura de autorização, contrato e fechamento | [T11](tasks/T11.md) | 4 | T10 | Não | Concluído |

**Derivação do paralelismo (Regra 10d)** — `Sim` apenas para **T1, T3 e T4**, e a razão é verificável nas
quatro condições do Invariante:

1. *DAG independente*: nenhuma das três depende da outra, direta ou transitivamente.
2. *Disjunção de símbolo*: T1 cria esquemas e enums; T3 cria a conferência de documento; T4 cria a
   tradução de validação — **nenhuma consome símbolo das outras duas**.
3. *Paths disjuntos*: `packages/contracts/**` · `packages/shared/**` · `apps/api/src/comum` + os três
   controladores.
4. *Alta contenção*: cada uma toca um arquivo de registro **diferente** (manifesto do workspace, barrel
   do `shared`, índice do `CLAUDE.md`) — nenhum em comum.

**T2 é `Não` embora esteja na fase 1**: depende de T1, que nasce na mesma fase. A dependência é real e
não pode ser movida para fase anterior — os literais dos enums nascem no pacote de contratos e o schema
os consome; a direção inversa faria `@sysloc/contracts` depender de `@sysloc/db`, e o frontend
arrastaria o servidor ao importar os tipos.

As fases 2, 3 e 4 são **cadeias**: cada task consome símbolo da anterior. Nenhuma sai `Sim`.

### 4.1 Ordem de Execução (grafo)

```
T1 ─┬─> T2 ─┬─────────────> T5 ──> T6 ──> T7 ────┐
    │       │                       │            │
    │       └──> T8 ──> T9 <────────┘            ├──> T10 ──> T11
    │            ^                               │
T3 ─┴───────────-┘                               │
                                                 │
T4 ──────────────> T5                            │
                                    (T9) ────────┘
```

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| US-01 — cadastrar conjunto | tabela `conjunto`; seis rotas de `/v1/conjuntos` (§7.2, §4.1) | T1, T2, T5, T10 | Concluída |
| US-02 — cadastrar imóvel vinculado | tabela `imovel` com FK composta; unicidade por empresa (§7.2, RN-03) | T1, T2, T6, T10 | Concluída |
| US-03 — cômodos com metragem calculada | metragem derivada com ponto único de soma (§6.2, D2) | T2, T7 | Concluída |
| US-04 — corrigir um cômodo isoladamente | rota de alteração individual; recálculo implícito (§5.2) | T7 | Concluída |
| US-05 — cadastrar as três pessoas | três tabelas; serviço parametrizado (§3.2) | T1, T2, T8, T9 | Concluída |
| US-06 — aviso de documento inválido ou repetido | conferência de DV (§6.1); unicidade do banco (RN-04) | T3, T8, T9 | Concluída |
| US-07 — retirar cadastro de circulação | marca de retirada; exigência de ação sensível (§7.2, §11.2) | T5, T6, T8, T9, T10 | Concluída |
| US-08 — encontrar retirado e devolvê-lo | porta única de leitura com inclusão explícita (D3) | T5, T6, T9 | Concluída |
| US-09 — ver a carteira numa consulta só | leitura composta por nível (§12.2) | T1, T10 | Concluída |
| US-10 — exigir área de tela e ação sensível | exigência declarada por rota (§11.2) | T4, T5, T9, T11 | Concluída |
| US-11 — isolamento entre empresas | RLS forçada e FK composta (§7.2, §7.3) | T2, T11 | Concluída |

**Cobertura: 11/11 User Stories.** Nenhuma US aparece em mais de 5 tasks; nenhuma task órfã.

---

## 6. Dependências Gerais

**Entre tasks**: a fonte única é a seção 1 de cada `tasks/TN.md`. A ordem crítica é
`T1 → T2 → T5 → T6 → T7 → T10 → T11`, com `T3 → T8 → T9` entrando antes de T10.

**Externas**: nenhuma. A fatia não integra com serviço externo, não enfileira tarefa (o débito **D32**
não dispara) e não acrescenta unidade systemd nem timer.

**Débitos com gatilho que esta fatia dispara**:
- **D38** — fecha em **T4**; o marcador e a linha do índice do `CLAUDE.md` saem no mesmo commit.
- **D28** — já disparado; as suítes novas de `apps/api/test/` serão consumidoras dos acessórios
  compartilhados por caminho relativo profundo. Ler o marcador antes de acrescentar consumidor.

**Suítes existentes que vão reprovar** (blast radius declarado, fechado em T11): `catalogo.spec.ts`,
`unidade-de-trabalho.spec.ts`, `cobertura-de-autorizacao.e2e.spec.ts`, `superficie-publica.spec.ts`,
`campos-fechados.e2e.spec.ts`. Cada atualização exige a linha `SUT_IS_CORRECT_BECAUSE:`.

---

## 7. Critérios de Conclusão da Feature

- [x] Todas as 11 tasks concluídas e aprovadas nos gates declarados
- [x] Os 53 casos de teste (CT-300 a CT-352) implementados e verdes — **e mais quatro**: as tasks
      acrescentaram `CT-353`, `CT-354`, `CT-355` e `CT-356` como redes de defeitos achados em execução,
      totalizando **57 CTs distintos** implementados
- [x] Os 16 critérios de aceite do PRD rastreados a ≥ 1 caso
- [x] Equivalência da metragem: 4 de 4 cenários do golden reproduzidos
- [x] Guarda de cobertura aprova as 8 tabelas de `negocio` sem exceção
- [x] `semDeclaracao` vazio e `rotasEnumeradas` = 66
- [x] `pnpm build`, `pnpm lint` e `pnpm test` verdes, com a contagem de casos **crescida** (274 → 541)
- [x] Débito D38 fechado: marcador e linha do índice removidos
- [x] Todas as User Stories cobertas (tabela seção 5)

---

## 8. Riscos & Mitigações

- **Tamanho da fatia** (33 rotas, 6 entidades, pacote novo — maior que qualquer run já executado) →
  4 fases com cadeia explícita; a implementação parametrizada de T8 evita triplicar os três papéis.
- **T5 estabelece o molde** das quatro entidades seguintes; divergência nela se propaga →
  a porta de leitura com predicado por padrão é critério de aceite de T5, e o CT-315 (T9) a reprova em
  todas as entidades de uma vez se o molde estiver errado.
- **Unicidade implementada por leitura prévia** em vez de restrição do banco →
  fixado em T6 §3; o par CT-310 + CT-312 detecta.
- **Consulta N+1 na carteira** — o CT-329 prova corretude, não custo →
  T10 fixa consultas por nível; a revisão confere o número de idas ao banco.
- **Suítes existentes "consertadas" por afrouxamento** →
  as cinco estão declaradas em T11 §5.2 com a exigência de `SUT_IS_CORRECT_BECAUSE:`; o gate trata
  afrouxamento como violação crítica (R2).
- **Prova de atomicidade dividida** entre CT-325 (T7) e CT-326 (T11) — nenhuma sozinha cobre →
  registrado nas duas tasks e no tech_spec §7.4, com a razão de por que não é falsificável pela rota.

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas (11 arquivos em `tasks/`)
- [x] Dependências validadas (Regra 10a — nenhuma task consome símbolo de task posterior)
- [x] Flag de paralelismo **derivado** do DAG + símbolos (Regra 10d), não autorado
- [x] Rastreabilidade User Stories → Tasks preenchida (11/11)
- [x] `model`, `risk` e `gates` preenchidos em todas as tasks
- [x] Seção 6 preenchida em todas as tasks (53 CTs distribuídos, 1 card por CT)
- [x] `_run/test-cases.json` atualizado com `task_id` por caso
- [x] Pronto para execução
