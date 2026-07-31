# TASK PLAN – MiniStack

## 1. Identificação
- **Feature**: `fundacao-stack-nativa` (v1) — fatia **F0** do programa `backend-nativo-sysloc`
- **Intent**: `docs/specs/features/fundacao-stack-nativa/v1/intent.md`
- **Scope**: `docs/specs/features/fundacao-stack-nativa/v1/scope.md`
- **Responsável**: sysloc
- **Data**: 2026-07-31
- **Status**: Rascunho

---

## 2. Objetivo Técnico

Entregar a fundação de execução do backend novo: monorepo construível, serviços de base provisionados nativamente no sistema operacional, serviço de aplicação com verificação de saúde e contrato publicado, processador de trabalho consumindo fila persistente, e verificação automatizada contra instâncias efêmeras próprias — tudo sob supervisor do sistema operacional, com recuperação automática provada por reinício real do servidor.

Zero regra de negócio, zero estrutura de dados de domínio.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Fundações independentes**
  - Objetivo: estabelecer o chão do repositório e o chão do sistema operacional. As duas frentes não se tocam e correm juntas.
  - Tasks: T1, T2
- **Fase 2 – Contratos compartilhados**
  - Objetivo: materializar em código o formato de erro fixado pela ADR-0007 e o registro estruturado que todas as fatias herdam.
  - Tasks: T3
- **Fase 3 – Capacidade de verificar**
  - Objetivo: tornar a ADR-0006 cumprível sem exceção, com instâncias efêmeras próprias; apurar a divergência de versão do banco.
  - Tasks: T4
- **Fase 4 – Serviços**
  - Objetivo: entregar o serviço de aplicação e o processador de trabalho, ambos verificados contra as instâncias efêmeras.
  - Tasks: T5, T6
- **Fase 5 – Operação e prova**
  - Objetivo: colocar os serviços sob o supervisor do sistema operacional e provar a recuperação — de queda de processo e de reinício completo.
  - Tasks: T7

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|-------------|---------|------|-------------|------------------------------------|--------|
| T1 | Fundação do monorepo — ferramental fixado e workspace construível | [T1](tasks/T1.md) | 1 | — | **Sim** (com T2) | Concluído |
| T2 | Provisionamento dos serviços de base por script idempotente | [T2](tasks/T2.md) | 1 | — | **Sim** (com T1) | Concluído |
| T3 | Pacote compartilhado — contrato de erro e registro estruturado | [T3](tasks/T3.md) | 2 | T1 | Não | A Fazer |
| T4 | Infraestrutura de verificação — instâncias efêmeras e apuração de versão | [T4](tasks/T4.md) | 3 | T1, T2, T3 | Não | A Fazer |
| T5 | Serviço de aplicação — esqueleto, saúde e contrato publicado | [T5](tasks/T5.md) | 4 | T1, T2, T3, T4 | Não | A Fazer |
| T6 | Processador de trabalho — fila persistente e tarefa de ida e volta | [T6](tasks/T6.md) | 4 | T1, T2, T3, T4 | Não | A Fazer |
| T7 | Unidades de serviço, instalação idempotente e prova de recuperação | [T7](tasks/T7.md) | 5 | T5, T6 | Não | A Fazer |

**Derivação do flag (Regra 10d):**

- **T1 ∥ T2 = Sim.** Independentes no grafo; conjuntos de símbolos disjuntos; T1 toca só a raiz do repositório e T2 só `deploy/scripts/instalacao/` mais o sistema operacional; nenhuma toca arquivo de alta contenção em comum.
- **T5 ∥ T6 = Não**, apesar de estarem na mesma fase e serem independentes no grafo. Ambas acrescentam dependências e portanto tocam o **arquivo de bloqueio do gerenciador de pacotes** — categoria "manifests/lockfiles" da lista canônica de alta contenção. Default conservador aplicado.
- Todas as demais são sequenciais por dependência direta.

---

## 5. Ordem de Execução

```
Fase 1:  T1 ─┐
             ├─> Fase 2: T3 ─> Fase 3: T4 ─> Fase 4: T5 ─> T6 ─> Fase 5: T7
Fase 2:  T2 ─┘
        (T1 e T2 em paralelo)
```

### Grafo de Dependências

| Task | Depende de | Status |
|------|------------|--------|
| T1 | — | Concluído |
| T2 | — | Concluído |
| T3 | T1 | A Fazer |
| T4 | T1, T2, T3 | A Fazer |
| T5 | T1, T2, T3, T4 | A Fazer |
| T6 | T1, T2, T3, T4 | A Fazer |
| T7 | T5, T6 | A Fazer |

---

## 6. Arquivos / Áreas Impactadas (visão consolidada)

| Área | Arquivos | Ação |
|------|----------|------|
| Raiz do workspace | `.mise.toml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.env.example` | criar |
| Raiz do workspace | `vitest.config.ts`, `mprocs.yaml` | criar |
| Raiz do workspace | `.gitignore`, `package.json` (script `dev`) | modificar |
| `packages/shared/` | `package.json`, `tsconfig.json`, `src/{index,erros,log}.ts` | criar |
| `packages/shared/test/` | `postgres-efemero.ts`, `redis-efemero.ts`, `ambiente-efemero.spec.ts` | criar |
| `apps/api/` | `package.json`, `tsconfig.json`, `src/main.ts`, `src/app.module.ts`, `src/configuracao/ambiente.ts`, `src/saude/{saude.module,saude.controller,saude.service}.ts`, `src/comum/filtro-excecao.ts`, `test/saude.e2e.spec.ts` | criar |
| `apps/worker/` | `package.json`, `tsconfig.json`, `src/main.ts`, `src/fila.ts`, `src/tarefas/eco.ts`, `test/eco.spec.ts` | criar |
| `deploy/systemd/` | `sysloc-api.service`, `sysloc-worker.service` | criar |
| `deploy/scripts/instalacao/` | `provisionar-base.sh`, `instalar-unidades.sh`, `verificar-fundacao.sh`, `apurar-versao-banco.sh` | criar |
| Registro da fatia | `docs/specs/features/fundacao-stack-nativa/v1/VERSAO-BANCO.md` | criar |

> **Legenda de Ações:** `criar` | `modificar` | `remover`

---

## 7. Critérios de Conclusão Geral

- [ ] Todas as 7 tasks concluídas
- [ ] Os 16 critérios de aceite do scope (CA-1 a CA-16) verificados
- [ ] `pnpm build` e `pnpm lint` limpos a partir do repositório recém-clonado
- [ ] `pnpm test` verde, subindo instâncias efêmeras próprias de banco e fila e descartando-as sem resíduo
- [ ] `verificar-fundacao.sh` verde
- [ ] Recuperação após encerrar o processo do serviço de aplicação, provada
- [ ] **Recuperação após reinício completo do servidor, provada — com o ambiente legado voltando sozinho junto**
- [ ] `VERSAO-BANCO.md` registrado, antes de qualquer definição de estrutura de dados
- [ ] Nenhuma credencial em arquivo versionado
- [ ] Nenhuma alteração no ambiente legado além da janela combinada

---

## 8. Notas para a LLM Executora

**Ordem que não pode ser invertida.** A prova de reinício completo (T7) consome uma **janela de indisponibilidade combinada** e não é repetível à vontade — ela derruba o ambiente que atende a operação. Deixe tudo o mais verificado antes: `verificar-fundacao.sh` verde primeiro, reinício por último.

**Precedentes aprovados nesta base de código.** A feature `caracterizacao-regras-legadas` já passou pelos dois gates com exigências equivalentes. Para idempotência e manuseio de credencial em shell, imite `deploy/scripts/caracterizacao/preparar-site-efemero.sh`. Para script de verificação com asserções e código de saída, imite `deploy/scripts/caracterizacao/verificar-golden.sh`. Não reinvente a forma.

**Três lacunas de convenção que os geradores de teste levantaram** e que o executor vai encontrar:

1. **Não existe convenção formalizada de teste para shell no projeto.** A adotada nas tasks é derivada do único precedente aprovado. As 7 fatias seguintes vão reinventá-la se ela não for formalizada — candidato a `.claude/rules/testing-stack.md`, via `/agent-spec-testing-stack-bootstrap`. Nada nesta fatia depende dessa formalização.
2. **O mecanismo de exercício HTTP nos testes de rota não está declarado** (repositório sem precedente). Os casos de T5 assumem servidor real escutando em porta dinâmica. Se a convenção adotada for injeção in-process, a fronteira deixa de ser HTTP real — decida na T5 e registre.
3. **O mínimo de espaço livre exigido pelo provisionamento não está declarado.** T2 deve medi-lo, mas o valor-limite é decisão de operação, não derivável do código. Exponha-o como configurável em vez de fixar um número arbitrário.

**Dependência entre T4 e T6 descoberta na geração de testes.** O helper `redisEfemero` precisa expor `parar()` e `religar()` **preservando o diretório de dados** — não apenas subir e derrubar. Sem isso o CT-003 de T6 (prova de CA-10, sobrevivência do trabalho enfileirado) é impossível de escrever, e a decisão de habilitar persistência em disco em T2 fica sem prova. Já incorporado à T4.

**A separação rasa × profunda da saúde (T5) é desenho, não redundância.** Fundi-las produz um de dois defeitos: o supervisor reinicia a aplicação quando o banco oscila, ou a prova do reinício aceita verde com o banco indisponível.

**Não antecipe o que pertence à fatia seguinte.** Nenhuma tabela, nenhuma migração, nenhum pacote de banco de dados, nenhum código de multi-tenancy. A fundação de isolamento entre empresas é a próxima fatia e define como toda tabela de negócio nasce — criar estrutura antes dela é o retrofit que o programa se propôs a evitar.

**Todas as 7 tasks rodam em Opus**, com ambos os gates (`[qa, tech_review]`). É decisão de projeto registrada no `CLAUDE.md` e reforçada pelo fato de a fatia tocar o sistema operacional de um servidor em produção.
