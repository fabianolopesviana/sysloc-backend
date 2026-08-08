---
id: 0017
title: Forma canônica do contrato da API, com três classes de chave exposta
status: accepted
date: 2026-08-05
tags: [http, architecture, error-handling]
---

# 0017 - Forma canônica do contrato da API, com três classes de chave exposta

## Context

A ADR-0012 partiu as entidades em duas classes e fixou que **toda** entidade de negócio tenantizada
expõe o código textual legível, com o UUID como chave interna que não trafega. A partição foi escrita
antes de alguém consultar o sistema antigo entidade por entidade, e o dado desmente a premissa: das
oito entidades do domínio de locação, **só contrato e cobrança têm código legível** (`CTR-2026-00020`,
`COB-…`); conjunto, imóvel, cômodo, locador, locatário e fiador sempre foram identificados por um
hash opaco de dez caracteres. Obedecer a 0012 ao pé da letra significaria **inventar** código legível
para seis entidades que nunca o tiveram — e dar ao imóvel um segundo identificador ao lado do
identificador municipal, que já é obrigatório e único. A partição em duas classes não comporta o caso.

## Decision

Todo recurso da API obedece a **cinco regras de forma**, das quais a primeira passa a ter **três**
classes: a chave exposta é o **código textual legível quando a entidade tem uma série declarada para
ela** — hoje contrato e cobrança —; é o **UUID quando não há série**, valha isso para entidade de
negócio ou de identidade. Declarar série nova para uma entidade é decisão registrada, e o contador que
a produz é governado pela ADR-0015. As outras quatro regras sobrevivem inteiras da ADR-0012: o corpo
fala o modelo de domínio em camelCase; `status` é calculado no servidor, nunca derivado no cliente; a
resposta de sucesso vai no root, e lista retorna `{ itens, total, limite, deslocamento }`; o erro é
status HTTP semântico mais `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` de enum fechado.

## Consequences

**Pros:**
- A regra passa a caber no domínio real, em vez de obrigar a inventar identificador para seis
  entidades que o produto nunca identificou por código.
- O critério é **verificável sem julgamento**: existe série declarada para a entidade, ou não existe.
  Duas pessoas chegam à mesma resposta.
- Entidade criada no futuro cai na regra sem emenda — nasce sem série e expõe UUID até que alguém
  decida, explicitamente, declarar uma.

**Cons:**
- A superfície fica heterogênea: o cliente vê contrato por código e imóvel por UUID, e precisa saber
  qual é qual. É o preço de refletir um domínio que já era heterogêneo.
- Passar uma entidade a expor código legível depois vira mudança de contrato — declarar série não é
  ato interno, alcança o consumidor.
- As features que citam a ADR-0012 seguem apontando para ela até serem tocadas; a migração é manual,
  por feature, como manda a convenção de supersede.

**Neutros:**
- Não altera a **ADR-0015**, que governa o contador (único por empresa, furo aceito, número nunca
  reusado). Esta diz *quem* expõe código; aquela diz *como* o número nasce.
- Não altera a **ADR-0016**, que fixa o esquema como fonte única do contrato. Esta decide a forma;
  aquela, de onde a forma nasce.
- O envelope de erro e o de lista permanecem exatamente como a 0012 os fixou.

## Alternatives considered

- **Dar código legível às oito entidades**, conformando o domínio à ADR-0012 em vez do contrário.
  Motivo da rejeição: inventaria dado que nenhum usuário pediu, criaria oito contadores por empresa
  no lugar de um, e daria ao imóvel um segundo identificador competindo com o municipal — que é
  obrigatório, único e é o que o usuário efetivamente usa para falar do imóvel.
- **Expor UUID em tudo**, eliminando a heterogeneidade pela outra ponta. Motivo da rejeição: o código
  do contrato é exibido como título de tela, rótulo de seleção e campo "Identificador" no frontend, e
  é citado fora do sistema — trocá-lo por UUID quebraria a interface que a migração existe para
  preservar.
- **Manter a ADR-0012 e registrar a divergência como exceção** no artefato da feature. Motivo da
  rejeição: a exceção alcança seis das oito entidades da primeira fase de domínio — quando a exceção é
  maioria, a regra é que está errada. E deixaria a próxima fatia reabrindo o mesmo debate por achar
  que a divergência foi descuido.

## Applied in

- `cadastro-de-imoveis-e-pessoas (v1)` — `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech-alignment.md`
