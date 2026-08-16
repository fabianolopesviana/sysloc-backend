---
id: 0020
title: Número de série declarada é emitido por contador do banco fora do desfazimento
status: accepted
date: 2026-08-08
tags: [data, architecture]
---

# 0020 - Número de série declarada é emitido por contador do banco fora do desfazimento

## Context

A ADR-0033 fixa a **política** de toda série — escopo declarado pela própria série, furo aceito,
número nunca reusado nem por criação abortada — e deliberadamente não diz **como** o número nasce.
(Quando esta ADR foi escrita, a política vigente era a **ADR-0015**, que declarava o escopo fixo em
`empresa`; a 0033 a superseded em 2026-08-14 ao admitir série de escopo SaaS. **O mecanismo abaixo
não mudou** — ele é indiferente ao escopo, e é justamente essa indiferença que o deixou valer para as
três séries do produto.) O contrato é a primeira entidade a precisar de um, e a cobrança da F3 e o `seu_numero` da
integração bancária vêm logo atrás. As duas cláusulas daquela política se excluem sob o mecanismo mais
óbvio: uma linha de contador incrementada na mesma transação da criação trava a linha até o commit
(criações concorrentes esperam) e **devolve o número no desfazimento** (o próximo registro o reusa).
Sem uma forma fixa, cada fatia redecide, e a primeira que escolher a tabela quebra a estabilidade da
referência que o código legível existe para dar.

## Decision

Todo número de série declarada deste produto é emitido por **contador do próprio banco**, um por
escopo declarado da série, cujo avanço **não participa do desfazimento** da transação que o consome.
O contrato instancia a regra com escopo `(empresa, ano)`.

## Consequences

**Pros:**
- As duas cláusulas da ADR-0015 passam a ser propriedade do mecanismo, e não promessa que alguém
  mantém: o furo é consequência, e o não-reuso é impossível de violar por descuido.
- Criação concorrente dentro da mesma empresa não vira fila.
- A F3 e a F4 herdam a forma pronta em vez de redecidir — declarar série nova é escolher o escopo.

**Cons:**
- O contador é objeto por escopo, e escopo que inclui o ano nasce em tempo de execução: exige ponto
  de criação idempotente e concessão de uso ao papel da aplicação, que hoje só alcança leitura e
  escrita de tabela.
- O contador fica fora do alcance da política de isolamento por linha; o escopo é preservado pela
  identidade do objeto, não por `empresa_id` comparada pelo banco.
- Semear valor inicial passa a ser operação sobre objeto de banco, não escrita em tabela.

**Neutros:**
- Não altera a política da série — hoje a **ADR-0033**, antes a ADR-0015: aquela decide escopo, furo
  e não-reuso; esta decide o mecanismo. As citações à 0015 no restante deste documento são
  **históricas** — registram contra o que as alternativas foram rejeitadas em 2026-08-08.
- Quais entidades expõem código legível é da ADR-0017; o formato textual de cada série é da fatia dela.
- Alargar o privilégio do papel da aplicação para criar o objeto **não** é o caminho: ele passaria a
  poder criar tabela no schema de negócio, contornando a guarda de cobertura da ADR-0008.

## Alternatives considered

- **Linha de contador em tabela, incrementada na transação da criação** — o mecanismo mais simples, e
  o que reusaria o molde de tabela de negócio inteiro. Motivo da rejeição: o desfazimento devolve o
  número, e o registro seguinte o reusa — contraria a cláusula da ADR-0015 que existe justamente para
  manter estável a referência citada fora do sistema. A contenção que ela também introduz é a
  alternativa "sequência densa" que aquela ADR já rejeitara.
- **Um contador por empresa, sem o ano no escopo** — objeto único por empresa, criado quando a empresa
  é admitida, sem criação em tempo de execução nem privilégio novo. Motivo da rejeição: a numeração
  deixaria de reiniciar a cada ano, contra o escopo que a ADR-0015 declara para a série do contrato e
  contra o comportamento medido no sistema antigo.
- **Derivar o número de valor aleatório ou do relógio**, dispensando contador. Motivo da rejeição:
  perde a legibilidade sequencial, que é a única razão de o código existir — já rejeitada na ADR-0015
  e repetida aqui porque o mecanismo é o que a tornaria tentadora de novo.

## Applied in

- `contratos-de-locacao (v1)` — `docs/specs/features/contratos-de-locacao/v1/tech-alignment.md`
