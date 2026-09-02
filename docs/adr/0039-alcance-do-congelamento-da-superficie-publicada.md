---
id: 0039
title: Alcance do congelamento da superfície publicada
status: accepted
date: 2026-09-01
tags: [architecture, http]
---

# 0039 - Alcance do congelamento da superfície publicada

## Context

O marco de entrega declarou a superfície da API **congelada**, com o tamanho fixado por asserção
executável, e o registro geral do projeto afirma esse congelamento **sem qualificar o público**. O
produto, porém, tem **duas superfícies com públicos e ciclos distintos**: a da aplicação da
imobiliária, cujo contrato é publicado num pacote que o frontend importa, e a do operador do SaaS,
que não consome esse pacote e cujo painel seria construído depois do marco. O recorte que separa as
duas foi registrado numa tech spec de feature **já fechada** — isto é, no lugar por onde quem lê o
registro geral não passa. A consequência é reprodutível: um agente que leia apenas o registro geral
lê violação onde há decisão, e para.

## Decision

O congelamento alcança **a superfície que o pacote de contratos entrega à aplicação da imobiliária**.
A superfície do **operador do SaaS fica fora dele**: acrescentar operação ali não reabre o marco, e
não altera nenhuma garantia dada ao cliente. Dentro do congelamento, acrescentar operação ou campo é
permitido; **renomear e remover, não**.

## Consequences

**Pros:**
- Quem lê o registro geral encontra a qualificação ali, em vez de precisar descobri-la numa feature
  fechada — que é a condição em que a decisão foi lida como violação.
- Preserva o congelamento onde ele tem função: a confiabilidade do handoff que o frontend do cliente
  consome. É essa confiabilidade, e não o número em si, que o marco protege.
- Feature futura do painel do operador nasce sem conflito aparente com o marco.

**Cons:**
- As asserções que fixam o tamanho da superfície contam **todas** as operações publicadas, das duas
  superfícies. Elas se movem mesmo quando só o painel do operador cresce, e a contagem narrada em
  prosa precisa subir no mesmo passo — sob pena de a divergência ficar vermelha na verificação.
- Quem publica passa a precisar saber em **qual** das duas superfícies está, e as regras diferem.

**Neutros:**
- Não altera o que o congelamento garante à aplicação da imobiliária, nem o conteúdo do handoff dela.
- Como cada feature acomoda o próprio crescimento nas asserções é decisão dela, não desta ADR.

## Alternatives considered

- **Congelar as duas superfícies.** Motivo da rejeição: o congelamento existe para tornar o handoff
  do frontend confiável, e o painel do operador tem handoff próprio e ciclo próprio. Congelar uma
  superfície cujo cliente ainda não existia travaria a construção dela sem proteger ninguém.
- **Não congelar nada.** Motivo da rejeição: o congelamento é item do marco de entrega, e sem ele o
  handoff que o frontend consome passa a descrever uma superfície móvel — que é exatamente o
  problema que ele resolve.
- **Deixar o recorte onde já estava** (a tech spec da feature que o registrou). Motivo da rejeição:
  refutado por consequência medida — o registro geral afirma o oposto sem qualificar, e a informação
  que reconcilia os dois vive onde quem precisa dela não passa. O custo dessa escolha é uma parada e
  uma escalada por feature.

## Applied in

- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech_spec.md (onde a decisão foi tomada e registrada originalmente)
- `painel-master-administradores (v1)` — docs/specs/features/painel-master-administradores/v1/tech-alignment.md (primeira feature a exercê-la)
