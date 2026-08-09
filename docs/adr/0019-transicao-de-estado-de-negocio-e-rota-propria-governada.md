---
id: 0019
title: Transição de estado de negócio é rota própria governada por ação sensível
status: accepted
date: 2026-08-08
tags: [state-management, architecture]
---

# 0019 - Transição de estado de negócio é rota própria governada por ação sensível

## Context

O contrato é a primeira entidade do produto com ciclo de vida governado, e a cobrança (F3) é a
próxima. No legado o estado tem **duas fontes** — o `docstatus` do Frappe (0/1/2) e um `Select`
paralelo `status_contrato` —, e o cliente decide qual vale, contrariando a ADR-0017. Ao mesmo tempo,
o catálogo fechado da F1 já separa **alcançar a tela** de **executar a ação**: `ACAO:ativar_contrato`
e `ACAO:cancelar_contrato` existem como chaves distintas de `TELA:contratos`. Sem uma forma fixa,
cada fatia redecide se transitar estado é rota ou campo, e a separação de poderes se perde na
primeira que escolher campo.

## Decision

Toda transição de estado de entidade de negócio é uma **rota própria**, governada pela chave de ação
sensível correspondente do catálogo fechado — **nunca** um campo gravado por atualização parcial do
recurso. O contrato instancia a regra com quatro estados: `RASCUNHO` (nasce na criação e já consome
número da série), `ATIVO` (`ACAO:ativar_contrato`), `CANCELADO` (`ACAO:cancelar_contrato`) e
`ENCERRADO` (rotina agendada da F5, sem ator humano). A **retirada de circulação** da ADR-0014 é
ortogonal ao estado: não transita nada e não libera o imóvel.

## Consequences

**Pros:**
- A separação entre quem cadastra e quem ativa sobrevive: exigir a chave na rota de criação
  impediria de cadastrar quem só não pode ativar.
- Fonte única de estado — o `docstatus` e o `contratoStatusFromDocstatus()` do cliente morrem, e a
  ADR-0017 (`status` calculado no servidor) passa a valer sem exceção.
- Cada transição tem lugar próprio para as validações que só ela exige; a criação não é obrigada a
  satisfazê-las, o que preserva o rascunho como trabalho em andamento.
- A F3 herda a forma pronta para a cobrança (emitir boleto, solicitar baixa, cancelar) em vez de
  redecidir.

**Cons:**
- Criar e ativar custam duas requisições, não uma. É menos que as três de hoje, mas mais que um
  `POST` único.
- Rascunho abandonado deixa furo permanente na série (ADR-0015 aceita furo; o legado já tem 19).
- Toda transição nova exige chave no catálogo fechado, que não cresce sem decisão explícita.

**Neutros:**
- Quais estados cada entidade tem é decisão da fatia dela; esta ADR fixa a **forma** da transição.
- `RESCINDIDO` não entra no enum do contrato: zero caminhos de escrita no app legado.
- O nome e o formato das rotas de transição são decisão da spec, não desta ADR.

## Alternatives considered

- **Estado como campo em atualização parcial do recurso** (`PATCH /contratos/{id}` com `status`) —
  a forma mais idiomática. Motivo da rejeição: a exigência passa a valer para a rota inteira, então
  quem pode editar valor mensal passaria a poder ativar; e a alternativa de exigir por campo cria uma
  segunda mecânica de autorização fora da ADR-0011, que declara exigência por rota.
- **Contrato nasce ativo, sem rascunho** — criar e ativar num passo. Motivo da rejeição: obrigaria a
  rota de criação a exigir `ACAO:ativar_contrato`, e quem pode cadastrar sem poder ativar ficaria sem
  conseguir cadastrar — desfaz a separação que a matriz 10×7 da F1 estabeleceu.
- **Estado derivado de datas, sem coluna** — "ativo" é estar entre início e fim. Motivo da rejeição:
  cancelamento é decisão, não data, e não teria onde ser gravado.
- **Reaproveitar `ACAO:excluir_cadastro` para cancelar** — uma ação só para tirar o contrato de
  cena. Motivo da rejeição: são efeitos diferentes — cancelar libera o imóvel e transita estado;
  retirar de circulação só deixa de oferecer, e a ADR-0014 preserva o registro legível.

## Applied in

- `contratos-de-locacao (v1)` — `docs/specs/features/contratos-de-locacao/v1/pre-refinement.md`
