---
id: 0015
title: Contador sequencial por empresa, com furo aceito e número nunca reusado
status: superseded-by:0033
date: 2026-08-05
tags: [data, architecture]
---

# 0015 - Contador sequencial por empresa, com furo aceito e número nunca reusado

## Context

Entidades que expõem código legível (`CTR-2026-00020` no contrato, `COB-…` na cobrança, e o
`seu_numero` que a integração bancária exigirá) precisam de um número sequencial gerado pelo
servidor. O mecanismo herdado do Frappe é um contador **global do site**: num SaaS multi-empresa
ele faria duas imobiliárias competirem pela mesma sequência, e o plano de execução já registra que
isso quebraria no primeiro dia. Falta decidir o escopo de unicidade e, sobretudo, o que acontece
quando duas criações concorrem — a escolha entre não deixar furo e não fazer uma criação esperar
pela outra é excludente, e ela se propaga a toda série futura.

## Decision

Todo contador sequencial deste produto é **único por empresa**, e cada série declara o próprio
escopo (o contrato inclui o ano no escopo; uma série sem ano é igualmente válida). Dentro do escopo
declarado, criações concorrentes **não esperam umas pelas outras** — **furo na sequência é aceito** —
e o número **nunca é reusado**, nem por registro excluído, nem por criação abortada.

## Consequences

**Pros:**
- Duas empresas nunca competem pela mesma sequência, e o código legível de uma nunca depende do
  volume de operação da outra.
- Criar registro não serializa dentro da empresa: a criação concorrente não vira fila.
- Número nunca reusado torna o código legível uma referência estável — o `CTR-2026-00020` citado num
  e-mail de 2026 jamais aponta para outro contrato depois.

**Cons:**
- A sequência tem furos, e o usuário os vê: entre `CTR-2026-00019` e `CTR-2026-00021` pode não haver
  nada. Quem espera numeração contígua vai perguntar se um contrato sumiu.
- Não há como derivar contagem a partir do último número emitido — quem quiser saber quantos
  contratos existem tem de contar, não subtrair.
- O escopo por série precisa ser declarado explicitamente em cada uma; esquecer é criar uma série com
  escopo diferente do pretendido, e a correção depois exige renumerar.

**Neutros:**
- Quais entidades expõem código legível não é decidido aqui — é aplicação da **ADR-0012** (a chave
  exposta varia por classe de entidade).
- O formato textual de cada série (prefixo, largura do sequencial) é decisão de cada fatia.
- Combina com a **ADR-0014**: registro retirado de circulação continua ocupando o número, o que é
  consistente com o não-reuso.

> Superseded by 0033 - Cada série declara o próprio escopo, com furo aceito e número nunca reusado em 2026-08-14.

## Alternatives considered

- **Sequência densa, sem furo** — contador com trava por empresa, garantindo numeração contígua.
  Motivo da rejeição: serializa toda criação de contrato dentro da empresa, e paga esse preço
  permanente por uma propriedade que nenhuma regra de negócio exige — numeração contígua é estética,
  não requisito.
- **Reusar o número de registro excluído** — devolver o número à sequência para fechar o furo.
  Motivo da rejeição: destrói a estabilidade da referência; o mesmo código passaria a designar dois
  registros diferentes em momentos diferentes, e o código legível existe justamente para ser citado
  fora do sistema.
- **Contador global do SaaS, com a empresa embutida no texto** — uma sequência só, prefixada por
  empresa na exibição. Motivo da rejeição: mantém o ponto de contenção único que o mecanismo do
  Frappe já tem, agora entre empresas que não têm relação nenhuma entre si.
- **Derivar o código de um identificador aleatório** (hash, ULID) — dispensa contador.
  Motivo da rejeição: perde a legibilidade, que é a única razão de o código existir; o UUID já
  cumpre o papel de chave e é o que as demais entidades expõem.

## Applied in

- `dominio-locacao (v1)` — `docs/specs/features/dominio-locacao/v1/pre-refinement.md`
