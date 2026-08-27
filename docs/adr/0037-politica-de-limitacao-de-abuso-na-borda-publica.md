---
id: 0037
title: Política de limitação de abuso na borda pública
status: accepted
date: 2026-08-25
tags: [security, http, architecture]
---

# 0037 - Política de limitação de abuso na borda pública

## Context

Publicar a API expõe uma superfície que hoje só é alcançável do próprio hospedeiro, e as duas
camadas existentes estão incompletas: o limitador do arcabouço de autenticação cobre apenas
`/v1/auth/*` e `POST /v1/sessao/senha`, e está degradado a um balde único por caminho para o produto
inteiro porque nenhum salto confiável está declarado (`D27 · F1/T6`); o vhost que já publica a
entrada de fato de terceiro não tem limitador algum (`D27 · F4/T11`). A tensão registrada ali é real
nos dois sentidos: sem teto, quem descobrir o hostname grava linhas na tabela do recebido cru; com
teto **por endereço de origem**, uma rajada legítima do provedor bancário — que chega de um endereço
só — seria descartada, e perder notícia de baixa é pior que o abuso que se quis evitar. Sem critério
transversal, cada vhost e cada rota nova redecide isso do zero.

## Decision

A borda pública fornece o **eixo de origem** e não a política: ela declara o salto confiável e
repassa o endereço real, enquanto o **teto é decidido na aplicação, por classe de rota** — estreito
onde o pedido custa verificação de credencial, largo onde a autorização declarada por rota já é a
defesa primária, e **ausente por origem** na entrada de fato de terceiro (ADR-0035), que se protege
por tamanho de corpo, concorrência e expurgo do cru não reconhecido, nunca por taxa.

## Consequences

**Pros:**
- A política fica onde a suíte a alcança e o versionamento a acompanha, em vez de virar regra de vhost que nenhum caso mede.
- O teto por origem passa a valer de fato: com o salto declarado, a chave deixa de ser uma só por caminho para o produto inteiro.
- A rajada legítima do provedor não é descartada, e o abuso na mesma rota continua barrado pelo que de fato o limita: corpo pequeno, concorrência e o descarte sem consulta ao terceiro.
- A próxima integração de terceiro herda o critério em vez de escolher entre proteger e perder fato.

**Cons:**
- Declarar salto confiável cria uma dependência de configuração correta: `trustedProxies` errado transforma cabeçalho forjado em origem aceita, com aparência de correção.
- A entrada de terceiro fica sem teto de taxa, de modo que uma inundação forjada ainda custa escritas pequenas no cru até o expurgo alcançá-las.
- A política deixa de ser legível num arquivo só: quem audita precisa ler a borda e a aplicação juntas.

**Neutros:**
- Não fixa números de teto nem janela — são da fatia que publica, e cada constante já carrega a própria razão.
- Não altera o envelope de erro: o estouro continua saindo como `429 REQUISICAO_RECUSADA` (ADR-0017).
- Não decide quem é o salto confiável concreto; decide que ele tem de ser declarado antes de a política valer.

## Alternatives considered

- **Teto único de taxa por origem no nginx, para toda a superfície** — a proteção mais barata de instalar. Motivo da rejeição: o eixo de origem do provedor bancário é um endereço só, então o mesmo teto que barra o abuso descarta a rajada legítima; e perder notícia de baixa é o dano que a fatia do webhook existe para não ter.
- **Manter a política inteira na borda (`limit_req`/`limit_conn`)** — concentraria tudo num arquivo. Motivo da rejeição: tiraria a política do alcance da suíte, que hoje a ancora por asserção; regra de vhost não reprova caso nenhum e diverge sem que nada acuse.
- **Manter a política só na aplicação, sem declarar salto confiável** — é o estado de hoje. Motivo da rejeição: refutado por medição — sem salto declarado o endereço não é apurado, a chave vira uma só por caminho e o teto passa a ser o do produto inteiro naquele caminho.
- **Limitar a entrada de terceiro por origem, com lista de exceção do provedor** — preservaria a rajada legítima. Motivo da rejeição: a lista de endereços do provedor não é publicada nem estável, e uma exceção desatualizada é indistinguível de não haver limitador — troca uma garantia por uma aparência.

## Applied in

- `publicacao-e-backup (v1)` — docs/specs/features/publicacao-e-backup/v1/insumo-do-pre-refinamento.md (§0.1 — primeira adoção prevista; a fatia ainda não tem tech spec, e é ela que fecha os débitos `D23`/`D24`/`D27` da F1 e o `D27 · F4/T11`)
