---
id: 0012
title: Forma canônica do contrato da API, com a chave exposta variando por classe de entidade
status: superseded-by:0017
date: 2026-08-04
tags: [http, architecture, error-handling]
---

# 0012 - Forma canônica do contrato da API, com a chave exposta variando por classe de entidade

## Context

A API do Frappe vazou sua forma para dentro do frontend: `name` é chave **e** rótulo exibido em 11 interfaces, `docstatus` é fonte de status em 4 telas, o envelope `{data}`/`{message}` exige parser próprio, e ~36 mapeadores traduzem snake_case para camelCase. O erro é classificado pelo prefixo do texto da mensagem. Reverter a forma depois que N recursos já foram publicados custa refazer o pacote de contratos e a religação do cliente.

A ADR-0007 fixou cinco regras de forma para resolver isso, mas enunciou a primeira — a da chave exposta — como valendo para *"todo recurso"*, sem distinguir classes de entidade. **A lacuna foi medida**: a fatia `fundacao-multitenancy-identidade` publicou pessoa e empresa por UUID, passou pelos dois gates e está em produção, sem que ninguém confrontasse a regra. O próprio texto da 0007 já continha o sinal do seu alcance — *"único por empresa"* só faz sentido para entidade tenantizada —, mas deixá-lo implícito produziu conformidade aparente onde havia divergência.

## Decision

Todo recurso da API obedece a cinco regras de forma. **A chave exposta depende da classe da entidade**: entidade de negócio tenantizada expõe o código textual legível (`CTR-2026-0001`), único por empresa, com o UUID como chave interna que não trafega; entidade de identidade — pessoa e empresa — expõe o próprio UUID, porque não há código legível a preservar e a interface as identifica pelo nome. As outras quatro valem sem distinção: o corpo fala o modelo de domínio em camelCase; `status` é calculado no servidor, nunca derivado no cliente; a resposta de sucesso vai no root, e lista retorna `{ itens, total, limite, deslocamento }`; o erro é status HTTP semântico mais `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de um enum fechado.

## Consequences

**Pros:**
- Os ~36 mapeadores snake_case/camelCase deixam de existir — a API entrega o modelo que o cliente consome.
- As telas que exibem `name` como título de contrato, label de select e campo "Identificador" continuam funcionando sem campo novo.
- `codigo` de enum fechado elimina a classificação de erro por prefixo de texto e a extração de campo por regex.
- Resposta no root elimina o desembrulho de envelope e o parser de `_server_messages`.
- **A fronteira por classe torna a conformidade verificável**: um recurso de identidade que exponha UUID deixa de ser divergência silenciosa e passa a ser conformidade declarada.
- **Identidade não paga por geração de sequência** que não teria consumidor: nenhuma tela exibe código de pessoa ou de empresa.

**Cons:**
- O código legível exposto exige geração de sequência única por empresa, com a contenção que isso implica na escrita concorrente.
- O enum de `codigo` é superfície versionada: acrescentar valor é retrocompatível, renomear ou remover não é.
- **Duas classes significam uma pergunta a mais** por recurso novo — de que lado da fronteira ele está —, e classificar errado só aparece na revisão.

**Neutros:**
- A fronteira coincide com a da ADR-0009 (identidade × negócio por schema), mas é decidida independentemente: uma entidade de negócio não tenantizada, se existir, expõe código legível pela primeira regra.
- `limite`/`deslocamento` é adequado ao volume atual e pode conviver com cursor depois, sem invalidar esta decisão.

> Superseded by 0017 - Forma canônica do contrato da API, com três classes de chave exposta em 2026-08-05.

## Alternatives considered

- **Manter a regra da chave como "todo recurso"** (o texto da ADR-0007) — sem fronteira explícita. Motivo da rejeição: produziu divergência silenciosa que sobreviveu a dois gates e chegou a produção; deixá-la assim faz o próximo leitor reencontrar a mesma dúvida.
- **Conformar identidade à regra do código legível** — pessoa e empresa ganhariam código próprio. Motivo da rejeição: paga geração de sequência e coluna nova em cada uma para um código que nenhuma tela exibe, e obriga a alterar contrato já provado em produção.
- **Imitar a API do Frappe byte a byte** — o cliente não mudaria nada. Motivo da rejeição: carregaria a forma do Frappe para sempre, incluindo `docstatus` como regra de ciclo de vida e os 36 mapeadores.
- **API nova sem preservar o que o usuário vê** — chave exposta em UUID para tudo. Motivo da rejeição: as telas exibem a chave de negócio ao usuário em 11 interfaces; com UUID todas precisariam de campo de exibição novo.
- **RFC 9457 (Problem Details) para erros** — `type`, `title`, `status`, `detail`, `instance`. Motivo da rejeição: manter URIs de tipo não paga numa API privada de consumidor único.
- **Paginação por cursor opaco** — estável sob inserção concorrente. Motivo da rejeição: nenhuma tela tem scroll infinito e `total` exigiria consulta extra.
- **Envelope `{ data }` em toda resposta** — parsing uniforme no cliente. Motivo da rejeição: adiciona indireção em toda resposta, que é o que o cliente isolou para conviver com o Frappe.

## Applied in

- `fundacao-multitenancy-identidade (v1)` — docs/specs/features/fundacao-multitenancy-identidade/v1/tech_spec.md (envelope de erro e identidade por UUID, em produção)
- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech-alignment.md (adoção em especificação)
