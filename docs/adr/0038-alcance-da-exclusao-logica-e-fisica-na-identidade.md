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

> **Emenda de 2026-09-02.** O segundo `Cons` acima permanece como foi escrito, e a **espécie** de
> bloqueio que ele deixou implícita foi **medida** depois — na T4 da fatia
> `painel-master-administradores`, a mesma que aplica esta ADR. Lido ao pé da letra, ele diz que
> **nenhum** bloqueio é liberado antes do fim da transação, e nessa leitura *overstates* o custo da
> sonda: quem abrir este campo para decidir se replica a sonda-em-savepoint noutra superfície
> concluiria que a disponibilidade de acesso do cliente final fica retida enquanto a unidade viver.
> **A decisão não mudou** — mudou o que se sabe sobre o custo dela:
>
> - **O bloqueio de LINHA é liberado pelo retorno ao ponto de salvamento.** Com a unidade da listagem
>   **aberta** e 203 bloqueios de relação retidos, a entrada de um administrador da própria página —
>   `INSERT` em `identidade.sessao`, que toma `FOR KEY SHARE` na linha — **atravessou em 8 ms**.
> - **O que fica até o commit são os de RELAÇÃO**, e eles **não conflitam com DML**.
> - **O controle positivo discrimina**, e é ele que torna os 8 ms conclusivos em vez de janela quieta
>   por acaso: contra um `DELETE` **vivo** na mesma linha, o mesmo `INSERT` esperou o teto inteiro e
>   foi recusado com `55P03` após **5 014 ms**.
>
> Leia, portanto, o segundo `Cons` como *"toma bloqueios de **relação** que o retorno ao ponto de
> salvamento não libera antes do fim da transação"*. O código de produção já não propaga a frase
> larga: `apps/api/src/master/administrador.service.ts` registra a medição no ponto de uso, e o
> docblock de `ensaiarExclusao` (`packages/db/src/administrador-do-master.ts`) foi precisado no mesmo
> passo desta emenda — as duas pontas da mesma frase, fechadas juntas.
>
> **Por que a emenda foi necessária, se a medição já estava no código**: estava — em dois docblocks,
> que é onde quem **implementa** passa. A convenção deste repositório é que **citar ADR exige abrir a
> `Decision`**, e quem chega por citação abre esta ADR, não `administrador.service.ts`. É o mesmo vão
> que a emenda de 2026-08-15 da **ADR-0001** e a de 2026-08-16 da **ADR-0017** fecharam: lá a
> justificativa morava no tech spec e num docblock; aqui, numa medição que nunca subiu ao registro.

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
