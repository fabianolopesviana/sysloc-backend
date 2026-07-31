# Intent — Cleanup dos débitos da v5

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v6-debits
- **Variante**: backend
- **Parent**: v5
- **Source**: agent-spec-debt-resolution

---

## 2. Objetivo

Limpar os **2 débitos técnicos** anotados na `v5` — a versão que fechou RN-08 (decisão explícita na troca com boletos em aberto) e RN-09 (lista de ausentes chegando ao cliente).

Origem: [`../v5/_run/run-report.md`](../v5/_run/run-report.md) §2.

---

## 3. Débitos selecionados

| ID | Categoria | Título | Classificação | Custo | Risco |
|----|-----------|--------|---------------|-------|-------|
| D-001 | best_practices | `**_ignorados` continua mudo para outros parâmetros do payload | recomendado_corrigir | ~20min | baixo |
| D-002 | tests | Asserção depende de `frappe.local.response` limpo por outro arquivo | **perfumaria** | ~10min | nenhum |

Total estimado: **~30min**.

> **D-002 foi incluído por decisão explícita do usuário**, ciente de que o especialista o classificou como perfumaria — o próprio débito registra que "não é falha atual; a suíte roda verde e o caminho isolado também".

---

## 4. Por que D-001 importa mais do que a severidade sugere

O `**_ignorados` em `salvar_configuracao` descarta silenciosamente qualquer chave desconhecida do payload. **Foi exatamente esse silêncio que produziu a falha que a v5 corrigiu**: o cliente enviava `decisao`, recebia `success: True`, e nada acontecia.

A v5 resolveu o caso de `decisao` (virou parâmetro nomeado, com valor inválido recusado). Mas o catch-all segue mudo para qualquer outro nome — `decisao_troca`, `decisão` com acento, ou um typo em `numero_conta_corrente` produzem o mesmo "sucesso sem efeito".

Esse modo de falha atravessou **13 gates** sem ser detectado, e só apareceu quando alguém foi consumir o contrato de fora, na auditoria do handoff frontend. Converter o silêncio em log observável é barato e ataca a causa de um incidente real deste projeto.

---

## 5. Risco levantado pelo especialista — leia antes de implementar

A correção sugerida pelo Tech Review era `if _ignorados: frappe.logger().warning(...)`. O especialista da stack **elevou o risco de `nenhum` para `baixo`** com um motivo concreto:

> Não existe no repo nenhuma lista pronta de chaves de framework (`cmd`, `csrf_token`, etc.) para filtrar.

Sem essa filtragem, o `warning` dispararia em **toda requisição legítima** — o `form_dict` do Frappe sempre injeta chaves próprias. O trabalho real não é escrever o log; é levantar com precisão o que ignorar, para não poluir o log de produção com falso-positivo.

---

## 6. Critério de sucesso

Os 2 débitos resolvidos, suíte de **136 testes** verde sem regressão, e nenhuma alteração no comportamento de RN-08/RN-09 validado na v5.
