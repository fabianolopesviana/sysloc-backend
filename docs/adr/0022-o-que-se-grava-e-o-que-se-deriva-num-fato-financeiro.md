---
id: 0022
title: O que se grava e o que se deriva num fato financeiro
status: accepted
date: 2026-08-09
tags: [data, architecture]
---

# 0022 - O que se grava e o que se deriva num fato financeiro

## Context

Multa e juros passam a ser configuráveis **por empresa**, e a configuração muda ao longo do tempo —
logo "qual configuração se aplicou" deixa de ter resposta única. O sistema legado grava o valor da
mora quando ela incide e deixa uma rotina noturna escrever o estado da cobrança: se a rotina não
roda, o sistema afirma por um dia o que não é. O estado publicado, por sua vez, não tem dono — hoje
existem três derivações divergentes do status da mesma cobrança, ao ponto de o envio manual poder
cobrar por uma dívida cancelada. É preciso fixar, de uma vez, o que um fato financeiro **persiste** e
o que ele **calcula**.

## Decision

Todo valor monetário derivado de configuração é **derivado** enquanto o fato financeiro está aberto,
e **gravado** no instante do ato que o liquida — junto da configuração vigente naquele instante.
Mudança posterior de configuração alcança o que está aberto e **nunca** o que já foi liquidado.

Pelo mesmo discriminador, o **estado publicado** de um fato financeiro é derivado dos fatos gravados,
nunca uma coluna movida por rotina.

## Consequences

**Pros:**
- O estado publicado não depende de uma rotina ter rodado — timer que falha não faz o sistema mentir.
- Fonte única por construção: não há segunda derivação possível a divergir da primeira.
- Recibo emitido é auditável — dá para responder por que um cobra 2% e outro 5%.
- A configuração por empresa muda sem migrar dado histórico.

**Cons:**
- Custa colunas de carimbo (o valor e a configuração vigente) em todo fato liquidado.
- Derivar na leitura tem custo por consulta em listagens grandes.
- Mudar a configuração altera visivelmente o valor de tudo que está aberto — comportamento novo, que
  o operador pode ler como erro se não for comunicado.

**Neutros:**
- A rotina agendada deixa de ser dona do estado e vira apenas gatilho de efeito (envio, notificação).
- O esquema publicado cresce com campos derivados — crescimento de esquema, nunca troca de igualdade
  por asserção de presença.

## Alternatives considered

- **Tudo gravado, movido por transição** (o modelo do legado) — o valor e o estado são colunas
  escritas por rota ou por rotina. Motivo da rejeição: acopla a verdade do sistema à execução de uma
  rotina agendada; uma noite de falha do timer faz o sistema afirmar o que não é, e transfere a
  titularidade de um estado do domínio para a fase que agenda.
- **Tudo derivado, sem carimbo** — persistem-se apenas os fatos brutos e calcula-se sempre. Motivo da
  rejeição: mudar a multa reescreveria a mora de fatos **já liquidados**, alterando recibo emitido.
  É derivação correta com consequência contábil inaceitável.
- **Versionar a configuração e resolver por data de vigência** — uma tabela temporal de configurações
  e consulta por faixa em todo cálculo. Motivo da rejeição: obtém o mesmo resultado ao custo de um
  histórico paralelo a manter e de uma junção por faixa em cada leitura; o carimbo no ato de
  liquidação alcança o mesmo com uma leitura e sem estrutura nova.

## Applied in

- cobranca-mora-e-documentos (v1) — docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md
