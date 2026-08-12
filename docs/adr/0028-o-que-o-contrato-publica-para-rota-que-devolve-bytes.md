---
id: 0028
title: O que o contrato publica para uma rota que devolve bytes
status: accepted
date: 2026-08-12
tags: [http, architecture]
---

# 0028 - O que o contrato publica para uma rota que devolve bytes

## Context

Todo corpo de resposta deste backend é JSON derivado de esquema, e a ADR-0016 faz do esquema a fonte
única do contrato — validação e documento saem dele. Um documento em PDF quebra a premissa: bytes não
têm forma a validar, e nenhum esquema os descreve sem mentir. Sem decisão escrita, cada rota binária
inventaria a sua convenção, ou sairia do contrato em silêncio — e o handoff, que é como o frontend
consome esta API, herdaria uma rota invisível.

## Decision

A rota que devolve bytes **permanece no contrato** e declara três coisas: o **tipo de mídia**, o
**nome sugerido do arquivo** e o **mesmo envelope de erro** de todas as demais rotas (ADR-0017). Ela
**não** declara forma do corpo de sucesso — bytes são opacos por natureza —, e onde o arcabouço
vigente não souber exprimir corpo binário a exceção é declarada **num ponto único** e provada por
caso que reprova se a rota desaparecer do documento publicado.

## Consequences

**Pros:**
- O contrato segue sendo a superfície única — nenhuma rota do produto vive fora dele, e o handoff não
  precisa de lista paralela.
- O erro de uma rota binária é o erro de todas as outras (ADR-0017): quem consome trata um envelope
  só.
- A F4 herda a forma pronta — boleto e carnê em PDF entram sem decidir de novo.

**Cons:**
- O corpo de sucesso não é validável por esquema: a prova de contrato passa a ser sobre cabeçalho e
  presença, não sobre forma.
- Onde o arcabouço não exprime corpo binário, existe exceção — e exceção declarada sem prova própria
  apodrece.

**Neutros:**
- A rota conta na superfície publicada como qualquer outra.
- O nome sugerido do arquivo é parte do contrato, não detalhe de implementação — muda o que o cliente
  exibe ao salvar.

## Alternatives considered

- **Rota fora do contrato, só no handoff** — publicar apenas o que tem forma validável. Motivo da
  rejeição: criaria superfície paralela, e o handoff é derivado do contrato, não fonte dele.
- **Bytes em base64 dentro de JSON** — manter uma forma só no produto, com o documento como campo do
  envelope. Motivo da rejeição: infla o corpo em cerca de um terço e devolve a decodificação ao
  cliente, que é o acoplamento que esta migração está removendo.
- **Esquema fictício para o binário** — declarar um esquema permissivo só para a rota caber no molde.
  Motivo da rejeição: mentiria sobre validação e faria do esquema um adorno, contra a ADR-0016, que o
  define como fonte da validação.

## Applied in

- `documentos-e-confirmacao (v1)` — docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md
