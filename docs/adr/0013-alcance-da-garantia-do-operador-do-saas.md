---
id: 0013
title: O alcance da garantia do operador do SaaS — vale para a sessão dele, não para credencial que ele emite
status: accepted
date: 2026-08-04
tags: [security, auth]
---

# 0013 - O alcance da garantia do operador do SaaS — vale para a sessão dele, não para credencial que ele emite

## Context

O produto tem um perfil de operador do SaaS que administra empresas e **não alcança dado de negócio
de nenhuma delas** — garantia estabelecida na fundação e provada por teste.

O onboarding, porém, é por **senha provisória entregue fora de banda**: quem cria uma conta recebe a
credencial dela em texto, uma vez. Quem emite pode usar. As duas afirmações são verdadeiras e, lidas
juntas sem contexto, parecem contradizer-se.

Isso não é hipótese: a revisão da fatia de autorização expôs exatamente essa leitura, com uma rota
de reemissão ao lado da afirmação de que o operador nada alcança. **Sem registro do alcance exato,
cada revisão futura reencontra a aparente contradição, e um gate de segurança pode reprovar por
violação de um invariante que está intacto.**

## Decision

A garantia de que o operador do SaaS não alcança dado de negócio é uma propriedade **da sessão
dele**: nenhuma requisição autenticada como operador devolve dado de negócio de empresa alguma. Ela
**não se estende a credencial que ele emite** — emitir credencial é poder distinto, deliberadamente
concedido para o onboarding e para o socorro de empresa sem administrador, **restrito ao perfil
administrativo** e **auditado pelo registro de autoria da emissão**.

## Consequences

**Pros:**
- A aparente contradição vira limite declarado — revisão futura não a reabre, e o gate sabe o que é e o que não é violação.
- O invariante fica preciso e verificável: é sobre a sessão, e é assim que o teste o prova.
- O poder de emitir credencial ganha fronteira própria em vez de ser ilimitado por omissão.
- A trilha de auditoria passa a ter função nomeada — é a mitigação, não ornamento.

**Cons:**
- O operador pode, deliberadamente, obter uma sessão administrativa de uma empresa. Nenhum controle técnico o impede; a contenção é organizacional e a detecção é **posterior**.
- A mitigação depende de a trilha registrar autoria da emissão e a entrada subsequente — sem isso, ela não existe.

**Neutros:**
- A propriedade é inerente a **qualquer** modelo em que um ator emite credencial para outro; trocar o mecanismo a desloca, não a elimina.
- Restringir o alvo da emissão encurta o caminho, sem alterar a natureza da propriedade.

## Alternatives considered

- **Deixar o limite implícito** — enunciar a garantia sem fronteira. Motivo da rejeição: foi o estado até uma revisão confrontar as duas afirmações; enquanto durou, a contradição aparente esteve disponível para ser lida como defeito, e cada leitura futura a reencontraria.
- **Emissão sem restrição de alvo** — o operador reemite credencial de qualquer pessoa. Motivo da rejeição: dá caminho direto do operador a uma sessão de usuário comum, encurtando ao máximo a distância entre administrar empresas e alcançar dado de negócio.
- **Convite com senha definida pelo destinatário** — o emissor nunca vê a credencial. Motivo da rejeição: contraria as decisões de produto que fixam senha provisória com troca obrigatória, depende de canal de mensagem que só nasce em fase posterior, e quem emite o convite continua podendo interceptá-lo.
- **Impedir tecnicamente a entrada com credencial emitida** — por exemplo, vinculando a sessão à origem da emissão. Motivo da rejeição: nenhum mecanismo distingue "o titular legítimo entrou com a senha que recebeu" de "quem a emitiu entrou com ela" — a credencial é a mesma, e a entrega é fora de banda por decisão.

## Applied in

- `fundacao-multitenancy-identidade (v1)` — docs/specs/features/fundacao-multitenancy-identidade/v1/tech_spec.md (estabelece e prova a metade positiva: a sessão do operador não alcança dado de negócio)
- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech_spec.md §11.2 (declara o limite; restringe o alvo da reemissão ao perfil administrativo)
