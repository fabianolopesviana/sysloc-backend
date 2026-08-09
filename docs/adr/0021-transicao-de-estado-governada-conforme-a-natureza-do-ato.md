---
id: 0021
title: Transição de estado de negócio é rota própria, governada conforme a natureza do ato
status: accepted
date: 2026-08-09
tags: [state-management, architecture]
---

# 0021 - Transição de estado de negócio é rota própria, governada conforme a natureza do ato

## Context

A ADR-0019 fixou que toda transição de estado é rota própria governada pela chave de ação sensível
correspondente, e as duas metades da frase têm alcances diferentes que ela não separou. A fatia
`contratos-de-locacao` encontrou o caso na `POST /v1/imoveis/{id}/situacao-de-locacao`: alternar um
imóvel entre `DISPONIVEL` e `INDISPONIVEL` é transição de estado, mas **não existe ação sensível
correspondente** — o catálogo é fechado nas sete chaves da ADR-0011, que não cresce sem decisão
explícita, e a própria 0019 registra isso entre os *Cons*. Cumprir a 0019 ao pé da letra exigiria
criar uma chave contra a ADR-0011, ou reusar `ACAO:excluir_cadastro`, que a 0019 rejeita
nominalmente. A rota foi publicada com a exigência de área apenas, e a divergência ficou aberta
como débito com prazo até o congelamento da superfície da API.

## Decision

Toda transição de estado de entidade de negócio é uma **rota própria** — nunca um campo gravado por
atualização parcial do recurso —, e a governança segue a **natureza do ato**: quando ele é um ato
sensível, a rota exige a chave de ação correspondente do catálogo fechado; quando é **atributo
operacional do cadastro**, que não transfere direito nem move dinheiro nem altera o que outra
entidade pode fazer, a rota exige apenas a área. A situação de locação do imóvel é a instância
declarada da segunda classe; ativação, cancelamento e retirada de circulação são da primeira.

## Consequences

**Pros:**
- A metade que sempre importou — rota própria, nunca campo em atualização — vale sem exceção, e
  segue impedindo que quem edita o recurso transite o estado dele por tabela.
- A rota de situação de locação deixa de ser divergência declarada e passa a ser conformidade, o que
  destrava o congelamento da superfície para o handoff.
- O catálogo fechado da ADR-0011 continua fechado: nenhuma chave nasce para acomodar atributo
  operacional, e a matriz 10×7 não incha a cada estado novo.

**Cons:**
- Introduz um julgamento onde a 0019 tinha uma regra mecânica: a fatia precisa classificar o ato
  antes de escolher a exigência, e classificar errado para menos afrouxa a autorização.
- Um ato que hoje pareça operacional e amanhã seja sensível exige chave nova **e** mudança da rota
  publicada, que é custo de contrato depois do congelamento.

**Neutros:**
- Quais estados cada entidade tem continua sendo decisão da fatia dela; esta ADR fixa a forma da
  transição e o critério da exigência.
- O teste da natureza do ato é o efeito, não o verbo: `INDISPONIVEL` significa *"não ofereça nas
  buscas"*, e não *"proibido de locar"* — a recusa de alterar imóvel com contrato vigente é o que
  protege o invariante, e ela é de domínio, não de autorização.

## Alternatives considered

- **Criar `ACAO:definir_situacao_de_locacao`** — a leitura literal da 0019. Motivo da rejeição:
  contraria a ADR-0011, que declara o catálogo fechado nas sete chaves, e não poderia ser tomada sem
  supersedê-la também; abriria o precedente de o catálogo crescer por conveniência de cada fatia.
- **Reusar `ACAO:excluir_cadastro`** — aproveitar chave existente de efeito próximo. Motivo da
  rejeição: a 0019 já a rejeita nas Alternativas por serem efeitos diferentes, e quem marca um imóvel
  em reforma passaria a precisar da concessão de excluir cadastro.
- **Manter a 0019 intacta e conviver com a divergência declarada** — deixar a leitura só no docblock
  do controlador. Motivo da rejeição: depois do congelamento o documento entregue ao frontend cita a
  superfície publicada, e a divergência entre ela e o texto da ADR deixa de ser corrigível sem custo
  de contrato; um gate futuro leria violação onde houve decisão.
- **Voltar a situação de locação para o corpo do `PUT`** — se não é ato sensível, seria campo comum.
  Motivo da rejeição: reabriria o defeito que a fatia fechou — a escrita incondicional apagava o
  `LOCADO` em silêncio a cada alteração —, e é justamente a metade da 0019 que sobrevive intacta.

## Applied in

- `contratos-de-locacao (v1)` — `docs/specs/features/contratos-de-locacao/v1/tech_spec.md`
