# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Integração bancária configurável pelo frontend (backend — Fase 1 do roadmap)
- **Responsável (Tech Lead)**: neuberagil@icloud.com
- **Data**: 2026-07-20
- **Status**: Concluído (execução: 2026-07-21 — 13/13 tasks, 114 testes verdes; pendência: docs de referência)
- **TECH_SPEC**: `docs/specs/features/integracao-bancaria-configuravel/v1/tech_spec.md`
- **PRD**: `docs/prds/features/integracao-bancaria-configuravel/v1/prd.md`

---

## 2. Objetivo do Task Plan

Entregar o backend que torna a configuração da integração bancária operável por tela: a camada canônica de cobrança (ADR-0001), o adaptador Sicoob, a configuração persistida e versionada (ADR-0002), o porte das cinco operações por estrangulamento e os serviços de API que a tela (Fase 2, fora deste plano) irá consumir. As assinaturas e chaves de resposta atuais são contrato imutável.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Fundação canônica**
  - Objetivo: domínio agnóstico de provedor (modelo, porta, registry) e gestão de certificado — testável sem banco.
  - Tasks: T1, T2
- **Fase 2 – Persistência e adaptador**
  - Objetivo: DocTypes versionadas, resolução unificada de configuração com fallback legado, adaptador Sicoob.
  - Tasks: T3, T4, T5
- **Fase 3 – Estrangulamento das operações**
  - Objetivo: migrar as cinco operações uma a uma (consulta → confirmação/baixa → sincronização → emissão), com Patch 1 no início e Patch 2 + contador acoplados à emissão.
  - Tasks: T6, T7, T8, T9, T10
- **Fase 4 – Serviços de configuração**
  - Objetivo: endpoints da API (config, certificado, boletos em aberto + consolidado) e auditoria.
  - Tasks: T11, T12, T13

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|-------------------------------------|--------|
| T1 | Modelo canônico, porta e registry | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | Metadados e materialização do certificado | [T2](tasks/T2.md) | 1 | T1 | Não | Concluído |
| T3 | DocTypes canônicas versionadas | [T3](tasks/T3.md) | 2 | — | Não | Concluído |
| T4 | Resolução unificada de configuração + fallback | [T4](tasks/T4.md) | 2 | T1, T2, T3 | Não | Concluído |
| T5 | Adaptador Sicoob (HTTP mTLS, auth, mapeamento) | [T5](tasks/T5.md) | 2 | T1, T2, T4 | Não | Concluído |
| T6 | Patch 1 — migração da configuração legada | [T6](tasks/T6.md) | 3 | T3, T4 | **Sim** (par com T7) | Concluído |
| T7 | Portar consulta (1ª operação) | [T7](tasks/T7.md) | 3 | T5, T4 | **Sim** (par com T6) | Concluído |
| T8 | Portar baixa e confirmação de baixa | [T8](tasks/T8.md) | 3 | T7 | Não | Concluído |
| T9 | Portar sincronização de pagamento | [T9](tasks/T9.md) | 3 | T8 | Não | Concluído |
| T10 | Portar emissão + sequencial + Patch 2 (corte) | [T10](tasks/T10.md) | 3 | T9, T6 | Não | Concluído |
| T11 | Serviços de config — obter, salvar, testar | [T11](tasks/T11.md) | 4 | T4, T5 | Não | Concluído |
| T12 | Serviços de certificado + auditoria | [T12](tasks/T12.md) | 4 | T2, T3, T11 | Não | Concluído |
| T13 | Boletos em aberto e PDF consolidado | [T13](tasks/T13.md) | 4 | T11 | Não | Concluído |

> **Nota de paralelismo (derivado, Regra 10d)**: o único par paralelo-seguro é **T6 ∥ T7** — DAG-independentes, símbolos e paths disjuntos, nenhum arquivo de alta contenção em comum (T6 toca `patches.txt`, T7 toca `consulta.py`). Em Fase 4, T12 e T13 são DAG-independentes mas **compartilham `integracao_bancaria_api/service.py`** (alta contenção) → sequenciais. Todo o resto é cadeia de dependência. Default em qualquer incerteza: Não.

### 4.1 Ordem de Execução (grafo)

```
Fase 1:  T1 ──▶ T2
Fase 2:  (T1,T2) ──▶ T3 ──▶ T4 ──▶ T5
Fase 3:  (T3,T4) ──▶ T6 ┐
         (T5,T4) ──▶ T7 ─┼──▶ T8 ──▶ T9 ──▶ T10 ◀── T6
                         (T6 ∥ T7 no início da fase; T10 fecha, depende de T9 e T6)
Fase 4:  (T4,T5) ──▶ T11 ──▶ T12
                     T11 ──▶ T13
```

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|------------------|--------------------------|--------------------|--------|
| US-01 | Leitura sanitizada da config + bloco certificado | T3, T4, T11 | A Fazer |
| US-02 | Envio de certificado (File privado + metadados) | T12 | A Fazer |
| US-03 | Extração PKCS#12 apresentada antes de confirmar | T2, T12 | A Fazer |
| US-04 | Atualização parcial dos dados da conta | T11 | A Fazer |
| US-05 | Teste de conexão pela porta | T5, T11 | A Fazer |
| US-06 | Aviso de boletos em aberto | T11, T13 | A Fazer |
| US-07 | PDF consolidado dos boletos em aberto | T13 | A Fazer |
| US-08 | Dias para o vencimento do certificado | T2, T11 | A Fazer |
| US-09 | Remoção do certificado | T12 | A Fazer |
| US-10 | Endereços e ambiente editáveis | T3, T11 | A Fazer |
| US-11 | Auditoria das trocas | T3, T12 | A Fazer |
| US-12 | Emissão recusada com certificado vencido | T10 | A Fazer |
| US-13 | Continuidade via fallback legado | T4, T6 | A Fazer |
| US-14 | Cobrança independente do formato do provedor | T1, T5, T7, T8, T9, T10 | A Fazer |

---

## 6. Dependências Gerais

- **Ordem do estrangulamento (produção)**: as operações migram em deploys sucessivos, na ordem T7 → T8 → T9 → T10. Encodada como dependência de task para preservar o cutover da §7.3/§19 do tech_spec.
- **Corte do contador**: T10 depende de T6 (Patch 1 já aplicado) e é o único ponto onde o Patch 2 desativa a configuração legada — nunca antes, sob pena de quebrar as operações não portadas (CA-16).
- **Testes de estado final**: CT-028 e CT-030 (em T10) só passam com as cinco operações no canônico — escritos desde T7 como esperados-a-falhar.
- **Nenhuma dependência externa nova**: `cryptography`, `requests-pkcs12`, `pypdf` já no venv.
- **Operação**: após cada task que altera código, restart de `backend`, `scheduler`, `queue-short`, `queue-long` pelos serviços do compose.

---

## 7. Critérios de Conclusão da Feature

A feature (backend) será considerada concluída quando:
- [x] Todas as 13 tasks estiverem concluídas e com testes verdes — **114 testes OK** na suíte completa (2026-07-21)
- [x] `bench --site frontend migrate` aplica as DocTypes e os dois patches sem erro — migrate idempotente limpo; corte aplicado (legada ativo=0, canônica ativo=1 contador 000000000031)
- [x] As cinco operações produzem resultado equivalente ao anterior (CT-030) e o erro de config é uniforme (CT-028) — T10 CT-028/030 verdes
- [x] O contador nunca reinicia nem duplica (CT-014, CT-015, CT-027) — T10 (FOR UPDATE) + T11 (carry-forward na ativação)
- [x] Senha e bytes do certificado nunca aparecem em retorno, log ou auditoria (CT-009) — T12 sigilo estrutural (RN-06)
- [x] Fallback legado mantém a operação antes do primeiro upload (CT-025) — T4
- [x] Todas as 14 User Stories cobertas (tabela seção 5) — 14/14
- [ ] `reference/contexto_backend.md` e `reference/runbook_frappe.md` atualizados — **PENDENTE**: nenhuma task cobriu a atualização desses docs de referência; requer trabalho de documentação à parte (arquivos root-owned). Ver Relatório do Run.
