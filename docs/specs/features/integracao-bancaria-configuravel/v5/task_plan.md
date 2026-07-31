# Task Plan — v5: fechar RN-08 e RN-09

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v5
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Scope**: [scope.md](scope.md)
- **Status**: Concluído
- **Origem**: auditoria do handoff frontend pós-run, 2026-07-21

---

## 2. Resumo

Duas tasks **sequenciais** — T2 consome o que T1 publica, e ambas tocam `service.py`.

Não é feature nova: são dois requisitos especificados no `tech_spec.md` da v1 (RN-08/CA-08 e RN-09/CA-10) que não foram entregues. O contrato já está escrito; a implementação é que falta.

---

## 3. Tabela de Tasks

| ID | Nome | Arquivo | Requisito | Fase | Dependências | Modelo | Risco | Gates | Paralelo? | Status |
|----|------|---------|-----------|------|--------------|--------|-------|-------|-----------|--------|
| T1 | Expor apuração e resumo do consolidado | [T1](tasks/T1.md) | RN-09 / CA-10 | 1 | — | sonnet | low | [qa, tech_review] | Não (colide em `service.py`) | Concluído |
| T2 | Decisão explícita na troca com boletos em aberto | [T2](tasks/T2.md) | RN-08 / CA-08 | 1 | **T1** | opus | high | [qa, tech_review] | Não (depende de T1) | Concluído |

**T2 é `opus` / `risk: high`**: altera `salvar_configuracao`, o método mais usado da tela, em código de produção do fluxo de pagamentos — e hoje ele falha em silêncio para quem enviar `decisao`.

---

## 4. Ordem de Execução

Fase 1, sequencial: **T1 → T2**. T2 depende da apuração publicada por T1 e compartilha o arquivo.

---

## 5. Grafo de Dependências

| Task | Depende de | Pode Rodar em Paralelo? | Motivo |
|------|-----------|-------------------------|--------|
| T1 | — | Não | `service.py` compartilhado com T2 |
| T2 | T1 | Não | consome a apuração de T1 + mesmo arquivo |

---

## 6. Critérios de Conclusão Geral

- [x] T1 e T2 com Status `Concluído`.
- [x] `total`, `disponiveis` e `ausentes` acessíveis por JSON whitelisted.
- [x] Os três caminhos de decisão do RN-08 funcionam conforme `tech_spec.md:285-290`.
- [x] Recusa (decisão exigida ou negada) não escreve nada — verificado por teste.
- [x] `decisao` inválida recusada, não engolida pelo `**_ignorados`.
- [x] `baixar_consolidado_boletos_abertos` inalterado.
- [x] Suíte passa sem regressão (baseline 124 + os novos).
- [x] IDs de CT livres; colisão histórica registrada.

---

## 7. Pós-merge (fora do run)

1. **Atualizar `v1/handoff-frontend.md`**: [DÚVIDA] #1 e #6 deixam de ser bloqueantes; bloco 12 muda; fixtures do fluxo de decisão passam a existir.
2. Avaliar se a matriz de rastreabilidade da v1 (`CA-08 → CT-019`) deve ser corrigida — o ID aponta hoje para outro contrato.

---

## 8. Como executar

```
/agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v5/task_plan.md
```
