---
id: 0032
title: Segredo operável é cifrado, nunca retorna e se prova por medição
status: accepted
date: 2026-08-14
tags: [security, data]
---

# 0032 - Segredo operável é cifrado, nunca retorna e se prova por medição

## Context

Todo segredo que este produto guardou até aqui é **verificável e irreversível** — senha de acesso e
portador de confirmação vão ao banco como resumo criptográfico, e nada os recupera. A integração
bancária introduz a classe oposta: o material que identifica a empresa perante o provedor precisa
voltar **em claro**, dentro do processo, a cada aperto de mão mútuo. Guardá-lo como os outros é
impossível, e a segunda forma óbvia — arquivo restrito no servidor, como o produto guarda os segredos
do próprio sistema — espalha a fonte de verdade e sai do alcance do resguardo do banco. Some-se que a
fase anterior **mediu** um segredo em claro alcançando o diário do sistema por um caminho que a
redação não cobria e que revisão de código nenhuma teria visto.

## Decision

Segredo de terceiro que o produto precisa **usar**, e não apenas conferir, é guardado cifrado de forma
reversível, com a chave vivendo fora da árvore versionada e fora do mesmo pacote em que o material
cifrado é salvaguardado. Ele não retorna por superfície alguma do produto — consulta, erro ou
diagnóstico —, e a ausência de vazamento é afirmada por **medição da saída real**, nunca por leitura
do código.

## Consequences

**Pros:**
- O discriminador passa a ser a natureza do **uso**, e não o hábito: quem chega depois não "corrige" a cifra reversível em nome da coerência com as senhas resumidas.
- A prova alcança a classe de vazamento que a revisão de código não vê, e o precedente que a motiva é medido, não hipotético.
- Segredo operável ganha ponto único de passagem — que é onde a contenção estrutural se impõe de uma vez, em lugar de caminho a caminho.

**Cons:**
- Cifra reversível é legível por quem alcançar material **e** chave: a proteção passa a ser a separação dos dois, que é cláusula de operação (resguardo, runbook), não propriedade do código.
- Rotacionar a chave obriga a recifrar todo o material guardado.
- Medir é mais caro que revisar: cada superfície de saída nova cobra um caso que a observe de fato.

**Neutros:**
- Não altera o tratamento do segredo verificável: senha e portador seguem resumidos e irrecuperáveis.
- Onde o material mora e qual o algoritmo o cifra é da fatia que o implementa — esta decisão fixa a classe.
- Não alcança o segredo do próprio sistema entregue por ambiente, que segue no arquivo restrito de sempre.

## Alternatives considered

- **Arquivo restrito no sistema de arquivos, com referência no banco** — é como o produto já guarda os segredos do próprio sistema. Motivo da rejeição: cria uma segunda fonte que só vale restaurada junto à primeira, sobre um provisionamento cuja lacuna já está registrada; e arquivo ausente com registro presente é defeito **sem recurso**, porque ninguém recompõe material vindo de terceiro.
- **Cofre externo de chaves** — separaria chave e material por infraestrutura, e não por convenção. Motivo da rejeição: não existe neste servidor, num projeto declaradamente nativo, e acrescentaria uma dependência de disponibilidade no caminho de cobrar.
- **Confiar apenas na redação do registrador estruturado** — ela já existe, tem entrada única de despacho e já nomeia esta classe de segredo por escrito. Motivo da rejeição: **medida** insuficiente — um segredo alcançou o diário por caminho que ela não cobre. Permanece como segunda barreira, nunca como a garantia.

## Applied in

- `fundacao-bancaria (v1)` — docs/specs/features/fundacao-bancaria/v1/tech-alignment.md
