---
id: 0038
title: Alcance da exclusão lógica e da exclusão física na identidade
status: accepted
date: 2026-09-01
tags: [data, architecture]
---

# 0038 - Alcance da exclusão lógica e da exclusão física na identidade

## Context

A ADR-0014 decidiu que entidade referenciável **nunca é removida fisicamente**, e foi escrita para o
domínio de locação (`Applied in: dominio-locacao (v1)`), com o discriminador *"ser referenciável"*. O
painel do operador do SaaS precisa remover **tenant e identidade** — que não são cadastro do domínio,
e que nada referencia enquanto estão vazios. Sem registro do alcance, cada revisão futura lê violação
onde há decisão: foi o que obrigou a ADR-0021 a duas emendas. E a verificação óbvia — contar os
registros antes de excluir — é **inviável nesta posição**: a sessão do operador não pertence a
empresa alguma, a política de isolamento é `FORCE`, e a contagem devolve **zero para uma empresa
cheia**. Medido.

## Decision

O alcance da ADR-0014 é o **cadastro do domínio** (schema `negocio`). `identidade.empresa` e
`identidade.usuario` admitem **exclusão física**, e o critério de admissibilidade é a **integridade
referencial do banco**, nunca uma contagem escrita na aplicação: a exclusão é tentada, e a recusa do
banco vira resposta que nomeia a **classe** do impedimento e a alternativa disponível.

A trilha de auditoria é ela própria um impedimento — onde há registro de tentativa de entrada, a
exclusão é recusada. Esta decisão **nunca destrói auditoria**, e não afrouxa a mitigação da ADR-0013.

## Consequences

**Pros:**
- Mitiga a objeção da 0014 (*"a fronteira muda sem que o usuário entenda por quê"*): a fronteira
  muda, e a superfície diz por quê — o que ela rejeitou foi a recusa **muda**.
- Não há segunda definição do critério: decidir e executar são a mesma instrução, e não podem
  divergir — a classe de defeito que a §5 de `nao-regressao.md` persegue.
- Dá ao produto o **único** mecanismo de eliminação de dado pessoal que ele possui; a 0014 registra a
  retenção indefinida como dívida em aberto.

**Cons:**
- Janela curta na vida real: um cadastro, ou uma tentativa de entrada, já a fecha.
- A verificação prévia toma bloqueios que o retorno ao ponto de salvamento não libera antes do fim da
  transação.
- O operador ganha verbo destrutivo cuja contenção é a chave estrangeira, não a autorização.

**Neutros:**
- Não altera a 0014 no domínio: lá a exclusão segue lógica, sem exceção.
- Como a recusa se apresenta é decisão de cada fatia; aqui se fixa só que ela nomeia a **classe**, e
  não a entidade nem a contagem.

## Alternatives considered

- **Estender a exclusão lógica à identidade** (terceiro estado de retirada de circulação). Motivo da
  rejeição: é o que `suspensa_em` e `ativo` já fazem, e não resolve o pedido — quer-se o registro
  fora do banco, não mais um estado na listagem.
- **Contar os registros antes de excluir**, por função privilegiada que atravesse o isolamento.
  Motivo da rejeição: contraria o discriminador da emenda de 2026-08-13 da ADR-0024, que exige função
  **sem parâmetro de empresa** — e a contagem precisaria dele; exigiria migração para obter o
  critério que a chave estrangeira já impõe.
- **Remoção física em cascata**. Motivo da rejeição: já rejeitada nominalmente pela 0014 (*"destrói o
  histórico financeiro e contratual"*), e desnecessária aqui — a exclusão só ocorre no vazio.

## Applied in

- `painel-master-administradores (v1)` — docs/specs/features/painel-master-administradores/v1/pre-refinement.md
