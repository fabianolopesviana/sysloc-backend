---
id: 0031
title: Tabela sem dono-empresa vive em schema próprio da plataforma, sem empresa_id
status: accepted
date: 2026-08-14
tags: [architecture, data, security]
---

# 0031 - Tabela sem dono-empresa vive em schema próprio da plataforma, sem empresa_id

## Context

A ADR-0008 fixa que toda tabela de negócio nasce com `empresa_id` e RLS forçada, e a ADR-0009 parte
as tabelas em **dois** schemas: identidade, sem noção de tenant, e negócio, onde tudo tem dono.

Aparecem agora tabelas que não são nenhum dos dois: um contador de série com escopo do SaaS inteiro
e o registro cru do que um provedor externo notifica **antes** do roteamento — que, por decisão, é
registrado mesmo quando não casa com cobrança alguma e, portanto, **não tem empresa derivável**.

Sem lugar declarado, elas caem em negócio com coluna de empresa nula — o que falsifica o predicado
de catálogo da ADR-0009 — ou ficam parecendo violação do invariante de multi-tenancy, e a primeira
pessoa que passar por ali as "corrige" em nome dele.

## Decision

Tabela que não é dado de negócio de nenhuma empresa vive **fora do schema de negócio**, num terceiro
schema — `plataforma` —, e **não carrega `empresa_id`**. A admissão é conferida no catálogo do
sistema, nas duas pontas: nenhuma tabela do schema de negócio sem RLS forçada, e nenhuma tabela de
`plataforma` com coluna de empresa; o roster de tabelas de `plataforma` é **enumerado**, de modo que
uma tabela nova ali só entra por alteração explícita e revisada.

## Consequences

**Pros:**
- O predicado da ADR-0009 continua verdadeiro **sem exceção**: nenhuma tabela de negócio escapa da RLS.
- A natureza da tabela passa a ser declarada pelo **lugar**, não pela ausência de uma coluna — deixa de parecer omissão e passa a ser leitura óbvia para quem chega depois.
- Coluna de empresa em `plataforma` vira erro que uma consulta acha, não que uma revisão precisa lembrar de procurar.
- O roster enumerado transforma "estacionar uma tabela tenantizada fora do alcance da RLS" em alteração visível no diff.

**Cons:**
- Mais uma fronteira a qualificar em consulta que cruze as classes, e mais uma regra a manter na verificação de catálogo.
- A guarda pega a tabela que carrega **coluna de empresa**; a que discrimina tenant por outro nome ainda passa — a classificação equivocada segue sendo erro humano, como a ADR-0009 já admite do seu lado.
- Em `plataforma` não há política de linha a impor: a proteção do que mora ali é papel de conexão e privilégio, não RLS.

**Neutros:**
- O schema de identidade **não** é alcançado por esta decisão, inclusive onde ele já referencia empresa — a guarda de coluna vale só para `plataforma`.
- Nenhuma tabela existente muda de schema: a decisão governa o que nasce daqui em diante.

## Alternatives considered

- **Reusar o schema de identidade** — ele já é, pela ADR-0009, o schema sem noção de tenant, e as tabelas caberiam na letra. Motivo da rejeição: identidade é o schema de **quem entra no sistema**; acumular ali a infraestrutura do SaaS faz o nome deixar de dizer a natureza, e a fronteira por schema só presta serviço enquanto o nome classifica.
- **Ficar no schema de negócio com `empresa_id` nulo** — nenhum schema novo, a coluna presente e nula até haver dono. Motivo da rejeição: falsifica o predicado de catálogo — a linha sem tenant fica invisível a todos ou visível a todos —, e o nulo vira a exceção que toda consulta futura precisa lembrar de tratar.
- **Empresa sintética dona do que é global** — uma linha representando o próprio SaaS, preservando coluna e RLS. Motivo da rejeição: cria um tenant que não é cliente; listagem, cobrança e relatório passam todos a precisar excluí-lo, e esquecer disso vaza registro de plataforma para dentro do produto.

## Applied in

- `integracao-bancaria-sicoob (v1)` — docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md (§E-2, direção I1; §C-1, direção D1)
