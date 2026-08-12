---
id: 0027
title: Critério para uma rota de negócio dispensar sessão, e o que ela carrega em troca
status: accepted
date: 2026-08-12
tags: [auth, security, http]
---

# 0027 - Critério para uma rota de negócio dispensar sessão, e o que ela carrega em troca

## Context

Toda rota de negócio deste backend exige sessão, com autorização declarada por rota e default que
nega (ADR-0011, ADR-0018). A confirmação do endereço de e-mail do locatário quebra a premissa: quem
clica no link não é usuário do sistema e nunca terá sessão. O mecanismo de declaração já existe —
`@RotaPublica()`, hoje usado só pelo encaminhador da autenticação —, mas faltava o critério para um
ato de **negócio** dispensar sessão. O legado resolvia com token forjável: o identificador do
locatário somado ao timestamp, em claro, num campo chamado `email_token_hash`.

## Decision

Uma rota de negócio dispensa sessão apenas quando o ato é exercido pelo **titular do dado que ele
afeta** e esse titular não é usuário do sistema nem terá sessão algum dia. Em troca, a rota exige um
**portador de segredo** — aleatório com entropia declarada, guardado como hash, com expiração e de
uso único — que resolve **um ato sobre um objeto**; o contexto de tenant vem do registro que o
portador resolve, nunca da requisição; e a rota é declarada `publicas`, de modo que o conjunto
`semDeclaracao` permanece vazio.

## Consequences

**Pros:**
- Um critério governa todo ato de parte externa — entregar o contrato ao locatário cabe depois sem
  emendar a ADR.
- A garantia que o `semDeclaracao` vazio publica continua verdadeira: rota pública é declarada,
  nunca omitida.
- O isolamento por empresa sobrevive à ausência de sessão — o tenant sai do registro que o portador
  resolve (ADR-0024).

**Cons:**
- Cada ato público carrega maquinaria própria: geração, hash, expiração e consumo do portador.
- Enquanto a borda não der eixo de origem confiável (D27, F7), a mitigação de força bruta depende só
  de expiração e uso único.
- Uso único obriga reemissão: reenviar invalida o link anterior, e isso precisa ser visível para quem
  opera.

**Neutros:**
- A rota entra na partição `publicas` e conta na superfície publicada.
- A página que recebe o link vive fora deste repositório (F6) — o formato do link vira item de
  handoff.

## Alternatives considered

- **Identificador opaco sem portador** — confiar em que ninguém adivinha o link, como o legado faz.
  Motivo da rejeição: medido — o token é o identificador do locatário somado ao timestamp, e quem
  recebeu um link conhece os dois.
- **Dar sessão ao locatário** — cadastrá-lo como usuário para que a rota continue exigindo sessão.
  Motivo da rejeição: criaria identidade, senha, permissão e ciclo de vida para quem exerce um ato
  uma vez na vida.
- **Limitador de taxa como garantia principal** — portador simples, protegido por limitação de
  tentativas. Motivo da rejeição: não há eixo de origem confiável antes da publicação atrás do
  servidor de borda (F7), de modo que a garantia dependeria do que ainda não existe.

## Applied in

- `documentos-e-confirmacao (v1)` — docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md
