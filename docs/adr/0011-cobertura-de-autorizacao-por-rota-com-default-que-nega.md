---
id: 0011
title: Cobertura de autorização declarada por rota, com default que nega e verificação sobre a superfície publicada
status: accepted
date: 2026-08-04
tags: [auth, security, architecture]
---

# 0011 - Cobertura de autorização declarada por rota, com default que nega e verificação sobre a superfície publicada

## Context

A ADR-0010 fixa como o efetivo de permissão se forma, viaja e é revalidado. Ela não diz **como uma
rota declara o que exige**, e duas lacunas ficam abertas por isso.

A primeira é que o catálogo de permissões é **fechado** e cobre áreas de tela e ações dentro de uma
empresa. As operações do operador do SaaS não estão nele e não podem entrar sem inflá-lo até ele
deixar de ser a matriz do produto.

A segunda é que *"toda rota é autorizada"* não tem definição que uma verificação consiga avaliar.
Sem ela, a cobertura depende de cada autor futuro **lembrar** de declarar — que é exatamente a
dependência que a ADR-0008 existe para eliminar, reproduzida um nível acima.

## Decision

Toda rota declara o que exige em **duas dimensões independentes** — perfil e chave do catálogo
fechado —, e a rota que **não declara nada é recusada**. A cobertura é uma propriedade **consultada
sobre a superfície publicada**: nenhuma rota sem declaração, nunca uma lista de exceções mantida à
mão.

## Consequences

**Pros:**
- Rota nova nasce recusando ou reprova a verificação — não há terceiro estado.
- O esquecimento produz recusa, nunca superfície aberta.
- "Toda rota é autorizada" vira predicado avaliável: pergunta-se à superfície publicada em vez de confiar em convenção.
- O catálogo permanece fechado — o que não é permissão de empresa é governado pelo eixo do perfil, sem chave sintética.
- A declaração é dado da rota, não verificação espalhada pelos manipuladores.

**Cons:**
- Toda rota passa a declarar algo, inclusive a que legitimamente não exige permissão alguma.
- A marca de "não exige" é a única abertura deliberada, e por isso vira o alvo de maior valor para qualquer defeito futuro — cada uso dela pede revisão explícita.
- Duas dimensões significam duas formas de recusar, e a resposta precisa distinguir qual delas faltou.

**Neutros:**
- A verificação de cobertura depende de a superfície publicada ser enumerável pelo próprio arcabouço — recurso que a stack já oferece e que uma fatia anterior já usou para fixar outro inventário.
- Acrescentar uma terceira dimensão no futuro (por exemplo, escopo da empresa inteira) é aditivo e não invalida esta decisão.

## Alternatives considered

- **Default que permite** — a rota sem declaração passa. Motivo da rejeição: o esquecimento vira superfície aberta em vez de recusa, e a verificação perde o que verificar — não há como distinguir "decidi não exigir" de "esqueci de declarar".
- **Dimensão única, com chaves sintéticas para as operações do operador do SaaS** — um vocabulário só para tudo. Motivo da rejeição: infla um catálogo declarado fechado, que deixa de ser a matriz do produto e vira um índice de rotas.
- **Só a dimensão de permissão, com as rotas do operador fora da governança** — a matriz cobre o que cobre, e o resto se protege por conta própria. Motivo da rejeição: produz superfície publicada que nenhuma verificação alcança, que é precisamente o que esta decisão existe para impedir.
- **Lista de exceções mantida à mão** — enumerar num arquivo as rotas que não exigem permissão. Motivo da rejeição: a lista e o código divergem em silêncio, e é a mesma falha que a ADR-0009 rejeitou ao consultar o catálogo do sistema em vez de manter exceções.

## Applied in

- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech-alignment.md (decisão D2; adoção pendente)
- `cadastro-de-imoveis-e-pessoas (v1)` — `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech_spec.md` (§11.2) — **estendida pela ADR-0018**, que acrescenta a conjunção de exigências numa mesma rota e fortalece o predicado de cobertura de *existência* para *conteúdo*. Esta decisão permanece `accepted` e inteira: o default que nega, as duas dimensões e a marca de "não exige" não mudam.
