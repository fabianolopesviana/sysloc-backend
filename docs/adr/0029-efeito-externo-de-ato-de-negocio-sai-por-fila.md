---
id: 0029
title: Efeito externo de ato de negócio sai por fila, nunca em linha na borda
status: accepted
date: 2026-08-12
tags: [architecture, cross-cutting]
---

# 0029 - Efeito externo de ato de negócio sai por fila, nunca em linha na borda

## Context

Atos de negócio deste backend alcançam o mundo fora do banco: aviso de cobrança por e-mail,
confirmação de endereço do locatário, e adiante emissão bancária e rotinas agendadas. A forma
intuitiva — a borda que atende gravar e, logo depois, entregar — coloca latência e falha de terceiro
dentro do ato do operador, e obriga cada processo que dispara efeito a montar por conta própria a
barreira de saída (transporte, credencial, recusa que falha fechado). A régua da F3 já resolveu isso
por fila sem que a escolha estivesse registrada em lugar nenhum além do código.

## Decision

Todo efeito externo cujo resultado **não compõe a resposta do pedido** — envio de mensagem,
notificação, entrega — é **enfileirado** pela borda e executado pelo processo de trabalho, com o
contexto de tenant viajando na carga (ADR-0024). Chamada síncrona a terceiro cujo retorno o
solicitante espera na própria resposta permanece em linha, e não é exceção a esta decisão: está
fora do que ela alcança.

## Consequences

**Pros:**
- A barreira de saída — transporte, credencial, recusa que falha fechado — existe num processo só,
  em vez de nascer de novo a cada borda que precisa alcançar o mundo.
- Repetição com recuo passa a ser propriedade do mecanismo, não código de cada chamador.
- O ato do operador não espera terceiro, e falha de entrega deixa de derrubar a gravação.

**Cons:**
- O disparo passa a depender do servidor de fila estar de pé, e o produtor precisa da biblioteca de
  fila em cada processo que enfileira.
- Sem registro transacional da intenção, uma tarefa perdida entre o commit e o enfileiramento é
  perda silenciosa — o que a torna aceitável hoje é existir saída de produto (reenvio manual).
- O efeito deixa de ser observável no mesmo lugar do ato; diagnosticar exige olhar dois processos.

**Neutros:**
- A fronteira é "o resultado compõe a resposta?", e não "é lento?" — velocidade não classifica.
- Quem consome continua livre para escolher o adaptador; a decisão é sobre onde o efeito corre.

## Alternatives considered

- **Efeito em linha, logo após o commit** — a borda entrega antes de responder. Motivo da rejeição:
  põe latência e falha de terceiro no caminho do ato, e obriga cada processo que atende a duplicar a
  barreira de saída, que é a peça mais delicada de reproduzir.
- **Efeito dentro da própria transação** — alcançar o mundo antes do commit. Motivo da rejeição:
  mensagem entregue não volta, e um `ROLLBACK` posterior deixaria o mundo à frente do banco.
- **Registro transacional da intenção drenado por consumidor (outbox)** — grava a intenção junto com
  o ato e um consumidor a drena. Motivo da rejeição: **adiada, não descartada** — é tecnicamente
  superior e entra por cima desta decisão sem contradizê-la no dia em que existir efeito cuja perda
  não tenha saída de produto; hoje acrescentaria tabela, consumidor e política de drenagem para
  efeitos que o reenvio manual já cobre.

## Applied in

- `regua-de-cobranca (v1)` — docs/specs/features/regua-de-cobranca/v1/tech_spec.md
- `documentos-e-confirmacao (v1)` — docs/specs/features/documentos-e-confirmacao/v1/tech-alignment.md
