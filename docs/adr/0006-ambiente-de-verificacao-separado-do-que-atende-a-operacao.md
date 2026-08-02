---
id: 0006
title: Ambiente de verificação separado do ambiente que atende a operação
status: accepted
date: 2026-07-29
tags: [testing, architecture]
---

# 0006 - Ambiente de verificação separado do ambiente que atende a operação

## Context

A suíte de verificação executa contra o mesmo ambiente que atende a operação, porque nunca existiu um ambiente dedicado. Parte dela remove e reconstrói estrutura de permissão antes de cada execução, e as limpezas de cache envolvidas são globais e não transacionais — é o maior raio de dano do repositório, registrado como débito durante a contenção de credencial. O isolamento por transação do arcabouço de testes tem protegido o estado até aqui, mas isso é proteção circunstancial: depende de cada teste respeitar o mecanismo, e um preparo que escreva fora da transação escapa dele.

Há ainda uma classe de verificação que esse arranjo torna impossível. Confirmar que a fundação se reconstrói a partir do repositório exige um ambiente que possa ser destruído e recriado. Contra o ambiente que atende a operação, essa verificação nunca é honesta — o que se conclui dela é sempre mais fraco do que a afirmação que se quer sustentar.

## Decision

A suíte de verificação nunca executa contra o ambiente que atende a operação. Qual ambiente concreto cumpre o papel de verificação varia ao longo do tempo — o invariante é a **separação**, não um servidor específico.

## Consequences

**Pros:**
- Elimina o maior raio de dano do repositório: nenhuma verificação alcança o estado de quem opera.
- Torna verificável a reconstrução a partir do repositório, que exige um ambiente destrutível.
- Verificações passam a poder ser destrutivas por desenho, ampliando o que é possível afirmar com prova.

**Cons:**
- Exige manter um ambiente além do que atende a operação, com custo de disco e de manutenção.
- Divergência entre os ambientes pode mascarar defeito que só se manifesta em operação.
- A adoção é gradual: enquanto não houver ambiente separado disponível, a regra fica sem cumprimento.

**Neutros:**
- O arranjo concreto muda a cada rearranjo de ambientes; a decisão não fixa qual servidor cumpre o papel.
- Não altera o conteúdo da suíte — apenas onde ela executa.

## Alternatives considered

- **Manter a suíte no ambiente que atende a operação, confiando no isolamento transacional** — o arcabouço de testes desfaz as escritas ao final de cada caso. Motivo da rejeição: é proteção circunstancial, não estrutural; depende de cada teste respeitar o mecanismo, e preparo que escreva fora da transação escapa. Além disso, não resolve a impossibilidade de verificar reconstrução do zero.
- **Fixar o ambiente novo como o de verificação** — nomear concretamente qual ambiente cumpre o papel. Motivo da rejeição: esse ambiente passa a atender a operação após a virada, o que faria a regra se autodestruir e devolver a suíte exatamente para onde ela não deve estar.
- **Manter um terceiro ambiente dedicado permanente** — um ambiente que exista só para verificação, independente do ciclo de virada. Motivo da rejeição: não cabe no disco atual, e o ganho sobre o arranjo variável não justifica o custo permanente.

## Applied in

- `saas-multi-empresa (v1)` — decisão D5 do tech-alignment daquela feature. **A feature foi excluída do repositório em 2026-08-01** (plano Frappe abandonado — ver `docs/plano-backend-novo/decisao-e-stack.md` §9); o registro de aplicação fica, o caminho não existe mais. **A decisão desta ADR segue ativa e inalterada.**
- `fundacao-stack-nativa (v1)` — docs/specs/features/fundacao-stack-nativa/v1/tasks/T2.md (guarda `recusar_bateria_em_producao` + marcador `/etc/sysloc/producao`; a criação do marcador é item do gate de desinstalação da §F7 do plano de execução)
- `fundacao-stack-nativa (v1)` — docs/specs/features/fundacao-stack-nativa/v1/tasks/T4.md (materialização: instâncias efêmeras próprias de banco e fila, `embedded-postgres`)
