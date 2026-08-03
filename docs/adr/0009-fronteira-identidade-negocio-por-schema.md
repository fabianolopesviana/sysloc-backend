---
id: 0009
title: Fronteira entre identidade e negócio por schema, com cobertura verificada no catálogo
status: accepted
date: 2026-08-01
tags: [architecture, security, data]
---

# 0009 - Fronteira entre identidade e negócio por schema, com cobertura verificada no catálogo

## Context

A ADR-0008 fixa que o isolamento é propriedade do banco e que **toda tabela de negócio** nasce com
`empresa_id` e RLS. Duas lacunas ficam abertas por ela.

A primeira é que a autenticação **precisa operar antes de existir contexto de empresa** — conferir
credencial, contar tentativa malsucedida e registrar quem tentou entrar acontecem quando ainda não
há tenant. Nem toda tabela, portanto, pode viver sob o mesmo regime.

A segunda é que *"tabela de negócio"* não tem definição que uma verificação consiga avaliar. Sem
ela, a cobertura do isolamento depende de cada autor futuro lembrar — que é exatamente a dependência
que a ADR-0008 existe para eliminar, reproduzida um nível acima.

## Decision

As tabelas ficam em **dois schemas**: identidade, sem noção de tenant; e negócio, onde toda tabela
nasce vinculada a empresa, com RLS habilitada e **forçada**. A cobertura do isolamento é uma
propriedade **consultada no catálogo do sistema** — nenhuma tabela do schema de negócio sem RLS
forçada —, nunca uma lista de exceções mantida à mão.

## Consequences

**Pros:**
- "Tabela de negócio" vira predicado avaliável: a verificação pergunta ao banco em vez de confiar em convenção.
- Uma tabela nova nasce protegida ou reprova a verificação — não há terceiro estado.
- A autenticação opera sem contexto de empresa sem precisar de via privilegiada que contorne política.
- O que carece de tenant por natureza — tentativa de entrada sem usuário identificável — tem lugar definido.

**Cons:**
- Consulta que cruze as duas classes exige qualificação explícita do schema.
- A fronteira é decidida no momento de criar a tabela, e colocá-la no schema errado é um erro que a verificação de cobertura não pega — ela cobre omissão de RLS, não classificação equivocada.

**Neutros:**
- O gerador de migração da stack declara RLS e políticas, mas não emite `FORCE ROW LEVEL SECURITY`: essa parte é SQL explícito, e a verificação de catálogo é a autoridade sobre o estado real.
- Amarra a esta capacidade um recurso de catálogo do PostgreSQL, que já é a escolha de stack.

## Alternatives considered

- **Regime único, com via privilegiada para a autenticação** — todas as tabelas sob o mesmo regime, e o fluxo de login escapando por um caminho próprio. Motivo da rejeição: cria o segundo caminho para o dado que a ADR-0008 rejeita explicitamente, e esse escape passa a ser o ponto de maior valor para qualquer defeito futuro.
- **Convenção por presença da coluna de empresa** — é de negócio quem tem a coluna. Motivo da rejeição: a verificação vira heurística e a tabela que nascer sem a coluna fica invisível para ela — o defeito e a detecção do defeito passam a ter a mesma causa.
- **Bancos separados para identidade e negócio** — separação física em vez de lógica. Motivo da rejeição: perde transação única entre as duas classes e duplica operação, backup e migração, sem ganho sobre a fronteira de schema, já que ambas seriam alcançadas pela mesma aplicação.

## Applied in

- `fundacao-multitenancy-identidade (v1)` — docs/specs/features/fundacao-multitenancy-identidade/v1/tech-alignment.md (decisão D1)
