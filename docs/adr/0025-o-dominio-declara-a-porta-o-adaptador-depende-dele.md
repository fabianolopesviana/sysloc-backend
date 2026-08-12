---
id: 0025
title: O domínio declara a porta; o adaptador depende dele, nunca o contrário
status: accepted
date: 2026-08-11
tags: [architecture]
---

# 0025 - O domínio declara a porta; o adaptador depende dele, nunca o contrário

## Context

O produto pratica camadas por fora e estilo hexagonal por dentro, mas nunca declarou de que lado
nasce o tipo que atravessa a fronteira. A leitura ingênua do grafo de pacotes diz que o domínio
importa a infraestrutura, e é essa leitura que a base vinha seguindo por omissão.

A contradição apareceu dentro de um mesmo documento: a spec da régua afirmava a seta
`domínio → dados` e, na frase seguinte, que o domínio não importa o pacote de dados. Sem critério
declarado, cada fronteira nova — dados, e-mail, gerador de documento, integração bancária — decide
sozinha onde o tipo nasce, e o pacote de domínio termina falando o vocabulário da camada que ele
existe para não conhecer.

## Decision

Em toda fronteira entre domínio e infraestrutura, o **pacote de domínio declara** o tipo do dado que
atravessa e a interface da porta; o adaptador **importa dele** para declarar que a satisfaz. A
dependência de compilação aponta do adaptador para o domínio, inclusive quando a leitura em camadas
sugeriria o contrário, e as portas chegam ao domínio **por parâmetro**, nunca por import.

## Consequences

**Pros:**
- *"O domínio não conhece banco nem SMTP"* vira literalmente verdadeiro e verificável por import, em
  vez de meia-verdade (*"não importa valor, só tipo"*).
- O domínio fica exercitável sem subir processo: a verificação injeta a porta e não precisa de banco
  nem de serviço de pé.
- Fronteiras futuras herdam o critério em vez de redecidir onde o tipo nasce.
- Trocar o adaptador não toca o domínio — a porta é propriedade de quem a exige.

**Cons:**
- A direção **parece engano** para quem lê o grafo de pacotes, e por isso exige aviso explícito no
  ponto: o pacote de infraestrutura passa a depender do de domínio, e o manifesto inverte.
- O tipo da projeção mora longe do código que a produz; acrescentar um campo passa a exigir edição
  em dois pacotes, na ordem certa.
- A ordem de build passa a depender dessa inversão — quebrá-la falha tarde, na composição.

**Neutros:**
- Não diz quem **instancia** o adaptador: a composição continua na borda que monta o processo.
- Não alcança a decisão sobre adaptador de captura e barreira que falha fechado, adiada para a F4
  por falhar o critério de trade-off real.
- A ADR-0001 já aplicava a forma ao provedor bancário sobre o substrato antigo; esta generaliza o
  critério sem depender de substrato.

## Alternatives considered

- **O tipo e a porta nascendo no adaptador** (o pacote de dados dono da projeção) — preserva o grafo
  ingênuo. Motivo da rejeição: o domínio passa a importar infraestrutura para tipo, ganha um segundo
  caminho para o dado e a frase que justifica o pacote deixa de ser verdadeira. Era a leitura
  original da spec da régua.
- **Pacote terceiro só de contratos**, do qual domínio e adaptador dependem. Motivo da rejeição: um
  pacote a mais por fronteira, sem dono; a porta vira artefato de ninguém e o domínio perde a
  liberdade de alterá-la sozinho.
- **Nenhum critério declarado — cada fronteira decide.** Motivo da rejeição: foi exatamente o que
  produziu a contradição acima, e faria cada fatia seguinte redecidir com risco de divergir.

## Applied in

- `regua-de-cobranca (v1)` — docs/specs/features/regua-de-cobranca/v1/tech_spec.md §3.3.3 (a seta
  `@sysloc/db → @sysloc/regua`; `CandidataAoAviso`, `PortaDeCandidatas` e `PortaDeRegistro`
  declarados em `packages/regua/src/porta-de-dados.ts`)
