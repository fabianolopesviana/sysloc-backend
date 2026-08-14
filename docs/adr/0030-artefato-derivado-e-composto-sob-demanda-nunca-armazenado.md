---
id: 0030
title: Artefato derivado de dado gravado é composto sob demanda, nunca armazenado
status: accepted
date: 2026-08-12
tags: [architecture, data]
---

# 0030 - Artefato derivado de dado gravado é composto sob demanda, nunca armazenado

## Context

O sistema antigo compunha o contrato em PDF, convertia e guardava o resultado num campo do próprio
contrato. Isso cria um estado em que **artefato e cadastro discordam**, e a única defesa é uma
rotina de invalidação que precisa alcançar todo caminho de escrita — inclusive os que ainda não
existem. O custo apareceu por um caminho que ninguém previu: o legado passou a **recusar o
cancelamento de contrato sem PDF**, porque a pré-condição protegia o carimbo que ele gravaria sobre
o arquivo. Uma regra de negócio nasceu para servir ao armazenamento.

A decisão volta a se apresentar em toda entrega que produz artefato a partir de dado já gravado —
o carnê da F4 e qualquer relatório futuro —, e a forma escolhida em cada uma é difícil de desfazer
depois.

## Decision

Artefato derivado de dado gravado é **composto no instante do pedido** e **nunca armazenado**: não
existe caminho de escrita dele, e a coerência entre artefato e cadastro é obtida por **ausência de
cópia**, nunca por rotina de invalidação.

Fato recebido de terceiro — boleto emitido pelo provedor, retorno bancário, documento assinado
recebido — **não é artefato derivado**: é dado de entrada, ninguém o recompõe, e guardá-lo é o único
caminho. Não é exceção a esta decisão; está fora do que ela alcança.

## Consequences

**Pros:**
- Não existe estado em que artefato e cadastro discordem, e a garantia é estrutural — não depende de
  ninguém lembrar de invalidar.
- Nenhuma regra de negócio nasce para proteger arquivo: a pré-condição *"sem PDF, não cancela"* deixa
  de ser representável.
- Coluna, caminho de escrita e política de invalidação somem do esquema, da camada de dados e do
  contrato publicado.

**Cons:**
- Compor a cada pedido gasta CPU no processo que atende a requisição, e o custo cresce com o tamanho
  do artefato.
- **Não há como reproduzir o artefato como ele era num instante passado.** O produto responde *"o que
  o cadastro diz HOJE"*, nunca *"o que foi acordado ENTÃO"*. Se surgir exigência probatória, o
  caminho é **superseder esta ADR** — nunca guardar cópia por baixo dela.

**Neutros:**
- Reaproveitamento por cache é otimização compatível: ele muda o custo, não o que o produto promete.
  Guardar cópia **durável** como fonte de verdade, não — é a reversão da decisão.
- A composição fica sem colaborador a dublar, o que torna o domínio exercitável sem processo de pé.

## Alternatives considered

- **Armazenar o artefato e invalidá-lo quando o dado muda** — o que o legado fazia. Motivo da
  rejeição: a invalidação precisa alcançar todo caminho de escrita presente e futuro, e o defeito
  que ela deixa passar é silencioso — ninguém percebe um PDF desatualizado. O D36 é a evidência
  medida do preço.
- **Armazenar com carimbo de validade e recompor quando vencido** — meio-termo que preserva o
  reaproveitamento. Motivo da rejeição: mantém as duas fontes e acrescenta uma terceira coisa a
  acertar (o prazo), sem eliminar a janela em que as duas discordam.
- **Compor sob demanda e guardar cópia só para o cancelado** — atrativo porque o cancelado não muda
  mais. Motivo da rejeição: reintroduz o caminho de escrita inteiro para um caso, e é exatamente por
  ali que a pré-condição do legado nasceu.

## Applied in

- `documentos-e-confirmacao (v1)` — docs/specs/features/documentos-e-confirmacao/v1/tech_spec.md
