---
id: 0007
title: Forma canônica do contrato da API do backend novo
status: accepted
date: 2026-07-30
tags: [http, architecture, error-handling]
---

# 0007 - Forma canônica do contrato da API do backend novo

## Context

A API do Frappe vazou sua forma para dentro do frontend: `name` é chave **e** rótulo exibido em 11 interfaces, `docstatus` é fonte de status em 4 telas, o envelope `{data}`/`{message}` e o `_server_messages` (JSON dentro de JSON dentro de string) exigem parser próprio, e ~36 mapeadores traduzem snake_case para camelCase. O erro é classificado pelo prefixo do texto da mensagem e o campo inválido é extraído por regex sobre `"O campo 'X'"`. Cada decisão de forma redefine quais dos 126 arquivos de produção do React mudam, e revertê-la depois que N recursos já foram publicados em `@sysloc/contracts` custa refazer todos eles, o pacote e a religação do cliente.

## Decision

Todo recurso da API obedece a cinco regras de forma: a chave exposta é o código textual legível (`CTR-2026-0001`), único por empresa, com o UUID como PK interna que não trafega; o corpo fala o modelo de domínio em camelCase; `status` é calculado no servidor, nunca derivado no cliente; a resposta de sucesso vai no root, e lista retorna `{ itens, total, limite, deslocamento }`; o erro é status HTTP semântico mais `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de um enum fechado.

## Consequences

**Pros:**
- Os ~36 mapeadores snake_case/camelCase deixam de existir — a API já entrega o modelo que o cliente consome.
- As telas que exibem `name` como título de contrato, label de select e campo "Identificador" continuam funcionando sem campo de exibição novo.
- `codigo` de enum fechado elimina a classificação de erro por prefixo de texto e a extração de campo por regex.
- `status` com fonte única acaba com a divergência entre o valor do servidor e o derivado no cliente.
- Resposta no root elimina o desembrulho de envelope e o parser de `_server_messages`.
- Fixada antes da primeira entidade, a decisão é aplicada uma vez em vez de retrofitada recurso a recurso.

**Cons:**
- O código legível exposto exige geração de sequência única por empresa, com a contenção que isso implica na escrita concorrente.
- O enum de `codigo` é superfície versionada: acrescentar valor é retrocompatível, renomear ou remover não é.
- Duas identidades por entidade (UUID interno e código exposto) obrigam disciplina para o UUID nunca vazar em contrato.

**Neutros:**
- `limite`/`deslocamento` é adequado ao volume atual e pode conviver com cursor depois, num recurso específico, sem invalidar esta decisão.
- O enum de `codigo` em pt-BR mantém continuidade com os símbolos que o cliente já trata (`sem_certificado_proprio`, `requer_decisao`, `sem_config_ativa`).

## Alternatives considered

- **Imitar a API do Frappe byte a byte** — o cliente não mudaria nada. Motivo da rejeição: carregaria a forma do Frappe para sempre — joins N+1, `docstatus` como regra de ciclo de vida, transações multi-passo na UI e os 36 mapeadores. Trocaria o motor preservando o defeito.
- **API nova sem preservar o que o usuário vê** — chave exposta em UUID, cliente se adapta livremente. Motivo da rejeição: as telas exibem a chave ao usuário em 11 interfaces; com UUID todas precisariam de um campo de exibição novo, o que transforma religação mecânica em redesenho.
- **RFC 9457 (Problem Details) para erros** — `type`, `title`, `status`, `detail`, `instance` mais extensões. Motivo da rejeição: manter URIs de tipo não paga numa API privada de consumidor único, e o cliente precisaria mapear `type` para os símbolos que já trata.
- **Paginação por cursor opaco** — estável sob inserção concorrente. Motivo da rejeição: nenhuma tela tem scroll infinito, `total` exigiria consulta extra, e a base tem 15 cobranças — abstração paga antes do benefício.
- **Envelope `{ data }` em toda resposta** — parsing uniforme no cliente. Motivo da rejeição: adiciona um nível de indireção em toda resposta, que é exatamente o que o cliente isolou em `apiResponse.ts` para conviver com o Frappe.

## Applied in

- `backend-nativo-sysloc (v1)` — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` (decisão originada; adoção pendente)
