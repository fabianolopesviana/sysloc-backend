---
id: 0035
title: Critério para uma rota de entrada de fato de terceiro sem sessão, e o que ela carrega em troca
status: accepted
date: 2026-08-18
tags: [security, http, architecture]
---

# 0035 - Critério para uma rota de entrada de fato de terceiro sem sessão, e o que ela carrega em troca

## Context

O retorno da integração bancária chega por uma **URL única**, sem sessão e sem portador de segredo: o
provedor não é usuário do produto, e não há como desativar o webhook de uma empresa isolada. A
ADR-0027 governa a rota sem sessão do **titular do dado**, e nenhuma das três cláusulas dela alcança
este caso — quem age é um terceiro, não há portador, e o tenant não sai do registro que um portador
resolve. A ADR-0024 já fixa **de onde** o contexto vem, e a emenda dela nomeia este webhook como o
herdeiro do critério. Falta decidir **quando** uma rota dessas é legítima e o que ela exige em troca,
sob pena de a próxima integração redecidir do zero.

## Decision

Uma rota de entrada dispensa sessão apenas quando recebe um **fato produzido por um terceiro** que não
é usuário do sistema nem terá sessão algum dia, e cujo ato **não é exercido pelo titular do dado**. Em
troca, ela persiste o recebido **cru** antes de interpretá-lo e responde de imediato, sem que o
processamento componha a resposta; roteia o fato por uma **chave que o próprio produto emitiu** e que
fez o trajeto de ida e volta, nunca por identificador escolhido pelo terceiro; deriva a empresa do
**registro encontrado** (ADR-0024), tratando todo o resto do recebido como **conferência**, cuja
divergência é registrada e recusada em vez de aplicada; descarta o que não casa **sem consultar o
terceiro**; é idempotente pelo identificador do fato; e é declarada `publicas`, de modo que o conjunto
`semDeclaracao` permanece vazio (ADR-0011).

## Consequences

**Pros:**
- O recebido deixa de ser fonte de autoridade: nada que o terceiro escolhe decide empresa, estado ou efeito.
- Notificação forjada em massa não consome cota do provedor — o que não casa morre antes de qualquer consulta.
- N empresas compartilham a mesma conta no provedor sem colisão, porque a chave de roteamento é nossa.
- A próxima entrada de terceiro herda o critério em vez de redecidi-lo.

**Cons:**
- A chave de roteamento vira dependência de ida e volta: se o terceiro truncá-la ou não a devolver, o critério cai e o roteamento inteiro precisa ser redesenhado.
- Guardar o cru significa guardar dado de terceiro sem dono-empresa, o que exige schema próprio (ADR-0031) e política de expurgo própria.
- Responder antes de processar implica que a recusa por divergência não chega ao terceiro pela resposta — ela existe apenas na trilha.

**Neutros:**
- Não altera de onde vem o contexto de tenant: isso é da ADR-0024, que esta decisão invoca em vez de reproduzir.
- Não define o que a trilha publica — a fronteira entre efeito e tentativa é da ADR-0034.
- O código de resposta concreto, a forma da tabela do cru e o nome da chave são da tech spec da fatia.

## Alternatives considered

- **URL por empresa, com segredo no caminho** — daria autenticação e desativação individual. Motivo da rejeição: o provedor cadastra uma URL única e não permite desativar o webhook de uma empresa isolada, então a garantia seria falsa e o bloqueio por empresa tem de ser lógico.
- **Rotear pelo identificador do cliente no provedor** — era o desenho original. Motivo da rejeição: refutado por caso real, duas empresas do mesmo dono recebem na mesma conta, logo o identificador não é único por empresa.
- **Aceitar a empresa declarada no recebido** — o caminho mais curto. Motivo da rejeição: faz uma origem externa escolher o tenant, exatamente o que a ADR-0024 proíbe.
- **Processar em linha e responder o desfecho ao terceiro** — devolveria a recusa na própria resposta. Motivo da rejeição: efeito externo cujo resultado não compõe a resposta sai por fila (ADR-0029), e o terceiro reenvia sob timeout, quebrando a idempotência.

## Applied in

- `webhook-e-carne (v1)` — docs/specs/features/webhook-e-carne/v1/tech_spec.md (§21.5 — a primeira
  adoção: `POST /v1/notificacoes-bancarias`, que persiste o recebido cru em
  `plataforma.notificacao_bancaria`, responde `204` sem corpo, roteia pelo *Identificador perante o
  provedor* e deriva a empresa do registro encontrado)
