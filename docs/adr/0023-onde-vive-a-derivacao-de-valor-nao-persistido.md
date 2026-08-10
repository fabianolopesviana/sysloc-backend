---
id: 0023
title: Onde vive a derivação de valor não persistido
status: accepted
date: 2026-08-09
tags: [architecture, data]
---

# 0023 - Onde vive a derivação de valor não persistido

## Context

O produto publica valores que não são colunas. Até aqui todos eles serviam apenas à **apresentação de
um registro já selecionado**, e por isso viviam na camada de dados da aplicação sem consequência. O
agregado de cobrança introduz derivações de outra natureza: elas **participam da seleção** (listar as
vencidas, ordenar por estado, paginar) e **compõem aritmética monetária**. Avaliá-las na aplicação
obrigaria a trazer o conjunto inteiro para a memória antes de filtrar, e devolveria o dinheiro ao
ponto flutuante. Sem uma regra, o produto passaria a ter dois padrões de derivação sem critério que os
separasse — e o defeito que a cobrança existe para fechar nasceu exatamente de avaliações divergentes
do mesmo valor.

## Decision

A derivação de um valor não persistido vive **no banco** quando ela participa de seleção — filtro,
ordenação ou paginação — ou quando compõe aritmética monetária. Vive **na aplicação** quando serve
apenas à apresentação do registro já selecionado.

Derivação que vive no banco preserva o isolamento por empresa: objeto derivado com direitos próprios
não é admitido.

## Consequences

**Pros:**
- Há uma regra, e não dois padrões: as derivações que já existem e as novas passam a ser casos da
  mesma escolha.
- Derivação que participa de seleção pode ser filtrada, ordenada e paginada pelo banco.
- Aritmética monetária derivada corre em decimal exato — o resíduo binário deixa de existir em vez de
  ser contornado.
- A unicidade da fonte vira propriedade do lugar, não disciplina de quem lê.

**Cons:**
- Passa a haver dois lugares possíveis para regra de domínio, e classificar errado custa migração.
- O que vive no banco fica fora do alcance das ferramentas da linguagem de aplicação, e exercitá-lo
  exige banco.
- Objeto derivado no banco exige atenção explícita a direitos, sob pena de furar o isolamento da
  ADR-0008.

**Neutros:**
- A fronteira é o critério, não a tecnologia: um valor muda de lado se passar a participar de seleção.
- Não obriga a mover derivação existente que não mudou de papel.
- Complementa a ADR-0022, que decide **o que** se grava e **o que** se deriva; esta decide **onde** a
  derivação é avaliada.

## Alternatives considered

- **Derivar sempre na aplicação** — manter o padrão único já existente. Motivo da rejeição: a
  unicidade passaria a depender de todo caminho de leitura chamar a mesma função, que é exatamente a
  disciplina cuja quebra produziu o defeito de origem; e seleção sobre valor derivado obrigaria a
  carregar o conjunto inteiro para a memória.
- **Derivar sempre no banco** — padrão único no outro extremo. Motivo da rejeição: levaria para SQL
  derivações puramente de apresentação que funcionam bem na aplicação, sem ganho algum e com perda de
  expressividade e de ferramental de teste.
- **Materializar por rotina** — gravar o valor derivado periodicamente. Motivo da rejeição: já
  rejeitado pela ADR-0022 para fato financeiro; nos demais casos, cria dado que diverge da fonte
  enquanto a rotina não roda.

## Applied in

- cobranca-e-mora (v1) — docs/specs/features/cobranca-e-mora/v1/tech-alignment.md
