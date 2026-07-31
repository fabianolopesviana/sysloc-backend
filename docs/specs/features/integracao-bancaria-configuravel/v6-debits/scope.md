# Scope — Cleanup dos débitos da v5

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v6-debits
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Parent**: v5

---

## 2. Inclui

| Débito | Arquivo | Correção esperada |
|---|---|---|
| D-001 | `integracao_bancaria_api/service.py:790` (assinatura de `salvar_configuracao`) | Manter o `**_ignorados`, mas **logar** as chaves recebidas e não reconhecidas — filtrando antes as chaves de framework que o `form_dict` sempre injeta |
| D-002 | `tests/test_integracao_bancaria_api.py:636` | Tornar `test_ct039_decisao_aceitar_com_consolidado_grava_e_nao_produz_pdf` auto-contido quanto a `frappe.local.response` |

**Nenhum débito ficou fora do escopo** — o usuário selecionou os 2 coletados.

---

## 3. Restrições

- **NÃO remover o `**_ignorados`.** Removê-lo é quebra de contrato: chamadas whitelisted carregam chaves extras do `form_dict`. A decisão de mantê-lo foi tomada na v5 (T2) e está registrada na docstring do método.
- **Não gerar falso-positivo em produção.** O log só pode disparar para chaves genuinamente inesperadas. Ver §4.
- **Não alterar o comportamento de RN-08** (o fluxo de decisão entregue na v5) nem o de RN-09.
- **Preservar a recusa de zero escrita** de `salvar_configuracao` — a apuração e os retornos de recusa continuam antes de `_preparar_pendente`. Um log novo não pode ser inserido de forma que altere essa ordem.
- **RN-06** (nenhum segredo em log): o payload contém `certificado_senha`. O log deve registrar **apenas nomes de chave**, jamais valores.
- Site `frontend` é **produção**: só a suíte, sem `bench migrate`.
- Baseline: **136 testes**.

---

## 4. A parte não-trivial de D-001

O `form_dict` do Frappe injeta chaves próprias em toda requisição whitelisted (`cmd`, `csrf_token` e outras, dependendo do caminho). Se o log não as filtrar, dispara em **100% das chamadas legítimas** — e um log que sempre grita é um log que ninguém lê.

O executor precisa **levantar empiricamente** quais chaves chegam numa chamada real, não assumir uma lista de memória. Sem essa verificação, a correção troca um problema silencioso por um ruidoso.

Se a filtragem confiável se mostrar inviável, **é legítimo reportar isso em vez de entregar um log ruidoso** — registre em Pendências e explique.

---

## 5. Ordem de execução e colisão

Os débitos estão em **arquivos disjuntos** (`service.py` vs `tests/test_integracao_bancaria_api.py`), portanto **paralelizáveis** pelo critério de path. O orquestrador re-verifica com seus guards.

---

## 6. Gates

- **T1 (D-001)**: `[qa, tech_review]` — o path bate em Critical Path (`payments`) e toca `salvar_configuracao`, código de produção do fluxo de cobrança.
- **T2 (D-002)**: `[qa]` — altera **apenas** arquivo de teste, sem código de produção. É o caso em que o default de cleanup (`code_review_only`) se aplica literalmente.

---

## 7. ADRs aplicáveis

- **ADR-0001** — modelo canônico e adaptador por provedor. Não é contrariada: a mudança vive na camada de API/observabilidade.
