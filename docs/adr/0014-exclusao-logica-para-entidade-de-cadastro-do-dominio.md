---
id: 0014
title: Entidade de cadastro do domínio nunca é apagada — a exclusão é lógica
status: accepted
date: 2026-08-05
tags: [data, architecture]
---

# 0014 - Entidade de cadastro do domínio nunca é apagada — a exclusão é lógica

## Context

O domínio de locação nasce na F2 e é referenciado por todas as fases seguintes: cobrança aponta
para contrato, contrato aponta para imóvel e para pessoas. A ação sensível `ACAO:excluir_cadastro`
já existe no catálogo fechado da F1, mas a funcionalidade que ela governa **não é portada** — não há
`DELETE` de cadastro de negócio entre os 35 endpoints do backend legado. Ou seja: a semântica de
"excluir" está sendo decidida do zero, sem precedente a preservar, num modelo em que a remoção
física de uma linha tornaria ilegível todo registro histórico que a referencia.

## Decision

Entidade de **cadastro do domínio** — a que o usuário cria, nomeia e **referencia de outro registro**
(conjunto, imóvel, locador, locatário, fiador, contrato, cobrança e as que vierem) — **nunca é
removida fisicamente**: excluir significa retirar de circulação, e o registro permanece legível por
quem já o referencia.

Duas classes ficam **fora** do alcance, por razões distintas:

- **Vínculo ou concessão** (`acesso_usuario_app`, `acesso_usuario_permissao`): a linha representa
  estado de relacionamento, e removê-la é o mecanismo legítimo — é o que o ajuste bidirecional da
  matriz de permissões da F1 já faz.
- **Detalhe de composição** — parte que não tem vida própria, não é referenciada por registro
  nenhum, e cujo ciclo de vida é o do agregado que a contém (o cômodo de um imóvel é o caso
  conhecido). Corrigir a composição é remover a parte; não há leitura do passado a preservar,
  porque nada aponta para ela.

O discriminador é **ser referenciável**, não ser cadastrável: o que outro registro pode apontar não
some; o que só existe dentro do seu agregado, sim.

## Consequences

**Pros:**
- Contrato histórico continua legível: o locatário de 2024 não vira referência órfã.
- A recusa por vínculo deixa de existir como caso de borda — não há "não posso excluir porque há
  contrato", que é o erro que o usuário mais encontraria.
- A FK composta `(id, empresa_id)` da ADR-0008 nunca precisa de `ON DELETE` com semântica de
  domínio; a integridade referencial fica com uma preocupação a menos.

**Cons:**
- Dado pessoal (CPF/CNPJ, RG, endereço, contato) é retido indefinidamente, sem política de retenção
  ou anonimização declarada no projeto. Fica como dívida explícita, a resolver quando houver política.
- Toda consulta de listagem e todo seletor passa a carregar o predicado de circulação; esquecê-lo é
  um defeito silencioso, que mostra registro retirado como se estivesse ativo.
- Unicidade por empresa (`identificadorMunicipal`, código legível) passa a colidir com registro
  retirado de circulação, que continua ocupando o valor.

**Neutros:**
- Como a marcação se chama, se aparece na API, e se há reativação pelo usuário são decisões de cada
  fatia — esta ADR fixa só o invariante.
- Não altera a ADR-0008: o isolamento segue garantido pelo banco, e a RLS continua sendo o único
  caminho.

## Alternatives considered

- **Exclusão física com recusa por vínculo** — apaga de verdade quando nada aponta para o registro,
  recusa quando há contrato. Motivo da rejeição: a fronteira "tem vínculo / não tem" muda com o
  tempo, então a mesma ação dá resultados diferentes em momentos diferentes sem que o usuário
  entenda por quê; e o registro sem vínculo hoje pode ser exatamente o que uma fase futura passa a
  referenciar.
- **Híbrido por classe de entidade** — pessoas e conjunto lógicos, imóvel sem contrato apagável.
  Motivo da rejeição: duas semânticas para a mesma ação sensível, sem que o usuário tenha como saber
  qual delas vale na tela em que está.
- **Remoção física com cascata** — apagar o cadastro e o que depende dele. Motivo da rejeição:
  destrói o histórico financeiro e contratual, e confunde exclusão com o cancelamento em cascata,
  que é regra de negócio distinta e tem chave própria (`ACAO:cancelar_contrato`).

## Applied in

- `dominio-locacao (v1)` — `docs/specs/features/dominio-locacao/v1/pre-refinement.md`
