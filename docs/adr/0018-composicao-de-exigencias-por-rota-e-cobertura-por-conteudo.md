---
id: 0018
title: Uma rota compõe exigências, e a cobertura de autorização confere conteúdo — não só existência
status: accepted
date: 2026-08-06
tags: [auth, security, architecture]
---

# 0018 - Uma rota compõe exigências, e a cobertura de autorização confere conteúdo — não só existência

## Context

A ADR-0011 fixou que toda rota declara o que exige e que a rota sem declaração é recusada, com a
cobertura consultada sobre a superfície publicada. Duas coisas que ela não previu apareceram juntas
no domínio de locação, e a segunda foi descoberta por um defeito explorável.

A primeira é que existem rotas cuja exigência é **composta**: retirar um cadastro de circulação pede
a área de tela **e** a ação sensível. O mecanismo de declaração carregava uma exigência de cada vez,
e o leitor de metadado do arcabouço resolve a precedência por **override** — a declaração do método
**substitui** a da classe. Escrever a ação no método, contando com a área da classe, apagava a área
em silêncio.

A segunda é que o predicado de cobertura da 0011 — *"nenhuma rota sem declaração"* — é **satisfeito
por uma rota que declara menos do que deveria**. Uma rota assim segue declarando *alguma coisa*, a
verificação segue verde, e a exigência que sumiu não aparece em lugar nenhum. A lacuna foi medida:
`POST /v1/conjuntos/:id/retirada` exigia apenas `ACAO:excluir_cadastro`, e quem recebia o efetivo
coerente `{TELA:cadastros, ACAO:excluir_cadastro}` — o de quem administra locador, locatário e fiador
— era recusado para **listar** conjuntos e aceito para **retirá-los**.

## Decision

Uma rota pode declarar uma **conjunção** de exigências, e a recusa nomeia a **primeira ausente na
ordem declarada**. A cobertura de autorização passa a conferir também o **conteúdo** da declaração:
nenhum manipulador exige menos do que a classe dele exige.

## Consequences

**Pros:**
- A exigência composta é exprimível na declaração da rota, em vez de depender de o autor conhecer a semântica de precedência do leitor de metadado.
- O modo de falha fica nomeado: *"declaração de método substitui a da classe"* passa a ser uma frase que existe, em vez de uma armadilha que cada autor descobre sozinho.
- A cobertura deixa de ser falsificável por declaração incompleta — o predicado passa a ter as duas metades, existência e conteúdo.
- A ordem da conjunção é conteúdo do contrato: a recusa nomeia a chave que de fato falta, que é o que a RN-14 pede.
- A conjunção vazia recusa, de modo que a marca de "não exige" continua sendo a **única** abertura deliberada.

**Cons:**
- A ordem das partes de uma conjunção vira decisão com efeito observável no corpo da recusa, e uma ordem trocada é defeito silencioso — nenhuma requisição falha, só o `exigido` fica errado.
- A verificação de conteúdo compara conjuntos de exigências, o que a torna sensível a como cada dimensão é representada — uma dimensão nova precisa entrar nessa representação.
- Uma rota que legitimamente queira exigir **menos** que a classe passa a reprovar a cobertura, e a saída é remover a declaração da classe em vez de contrariá-la no método.

**Neutros:**
- A decisão é **aditiva** sobre a ADR-0011 — o default que nega, as duas dimensões e a marca de "não exige" seguem inteiros. A 0011 permanece `accepted`.
- Composições entre dimensões diferentes (perfil e chave, por exemplo) ficam exprimíveis, sem que exista hoje rota que as declare.

## Alternatives considered

- **O leitor de metadado passa a MESCLAR as declarações** (em vez de sobrepor). Motivo da rejeição: o mecanismo de mesclagem do arcabouço combina objetos planos e produziria **um** objeto com o valor do método — o mesmo defeito, agora escondido atrás de um nome que promete união. É pior que o override, que ao menos é honesto sobre o que faz.
- **O leitor coleta TODAS as declarações e a cobertura vira conjunção implícita.** Motivo da rejeição: mudaria a semântica de toda a superfície publicada de uma vez, e transformaria a marca de "não exige", declarada num método, numa exigência herdada da classe — o oposto do que ela significa.
- **A recusa devolve TODAS as exigências ausentes.** Motivo da rejeição: o envelope de erro da ADR-0017 publica um valor único em `detalhes.exigido`, e é contrato publicado; mudá-lo por causa da forma da declaração inverteria a dependência.
- **Confiar na coerência do catálogo de permissões** — a ação sensível só é concedida junto da área que a comporta, logo quem tem a ação tem uma área. Motivo da rejeição: a área que o catálogo garante é a que **comporta a ação**, que não é necessariamente a que a rota exige; foi exatamente essa premissa que produziu o defeito. Além disso, seria trocar uma exigência declarada por validação de aplicação — a classe de garantia que a ADR-0008 rejeita por escrito.
- **Um caso de teste por rota composta**, em vez da verificação de conteúdo sobre a superfície. Motivo da rejeição: dependeria de cada autor futuro lembrar de escrever o caso, que é a dependência que a ADR-0011 existe para eliminar — e foi um esquecimento desse tipo que produziu o defeito.

## Applied in

- `cadastro-de-imoveis-e-pessoas (v1)` — `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech_spec.md` (§11.2)
