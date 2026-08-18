---
id: 0034
title: Trilha de integração com terceiro registra efeito, não tentativa
status: accepted
date: 2026-08-16
tags: [architecture, data, cross-cutting]
---

# 0034 - Trilha de integração com terceiro registra efeito, não tentativa

## Context

Integração com terceiro conversa muito e muda pouco. Medido no sistema antigo: `1.837` dos `1.864`
eventos gravados da integração bancária — **98,6%** — são consultas de situação que não alteraram
nada; sobram `22` emissões e `5` pedidos de baixa. Essa trilha é publicada por rota para que a
operação entenda *por que uma cobrança está assim*, e enterrar os fatos que respondem a pergunta sob
a varredura que não respondeu nada reproduz na leitura a mesma distorção que a troca de varredura por
notificação existe para corrigir. A pressão para gravar todo contato é real e aparece como zelo:
quem grava tudo acredita estar preservando evidência.

## Decision

A trilha que o produto **publica** sobre a conversa com um terceiro registra o **efeito** — mudança
de estado do fato de negócio ou desfecho anômalo, como divergência e recusa —, nunca a tentativa que
nada mudou. A decisão **não alcança** o registro operacional de diagnóstico, que permanece livre para
registrar todo contato: a fronteira é entre o que o produto publica como trilha e o que ele guarda
para depurar, e nenhuma leitura desta ADR autoriza apagar o segundo.

## Consequences

**Pros:**
- A trilha publicada responde a pergunta que motiva sua existência, sem exigir filtragem de quem lê.
- O crescimento passa a ser proporcional ao que aconteceu, não à frequência com que se pergunta.
- A conferência periódica pode ficar mais frequente sem inflar o que a operação lê.

**Cons:**
- A trilha deixa de provar, por si só, que a conferência rodou e encontrou tudo como estava.
- Exige julgar o que é efeito ao gravar, em vez de gravar tudo e decidir depois.

**Neutros:**
- O que o terceiro informou continua preservado como diagnóstico no evento que houve — inclusive
  quando o produto não reconhece o que ele disse.
- Cada integração declara quais desfechos são anômalos para ela; a ADR fixa o critério, não a lista.

## Alternatives considered

- **Registrar todo contato com o terceiro** — um evento por chamada, efeito ou não. Motivo da
  rejeição: é o comportamento medido do sistema antigo, e produziria 98,6% de ruído na superfície
  que a operação lê para diagnosticar.
- **Registrar tudo e filtrar na leitura** — grava todo contato e a rota publica só o que teve efeito.
  Motivo da rejeição: paga o custo de escrita e de crescimento sem o benefício, e filtro de leitura é
  decisão que se perde na primeira consulta nova, devolvendo o ruído sem que ninguém perceba.
- **Restringir a decisão à integração bancária** — valer só onde a medição foi feita. Motivo da
  rejeição: a fatia seguinte enfrenta a mesma pergunta para a notificação recebida, e decidiria do
  zero sem saber que houve decisão.

## Applied in

- `emissao-e-conciliacao (v1)` — `docs/specs/features/emissao-e-conciliacao/v1/tech-alignment.md` (D4)
