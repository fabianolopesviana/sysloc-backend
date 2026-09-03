---
id: 0040
title: O erro do roteador não fala o vocabulário de negócio
status: accepted
date: 2026-09-03
tags: [http, error-handling, architecture]
---

# 0040 - O erro do roteador não fala o vocabulário de negócio

## Context

A ADR-0017 fixa que todo erro sai como status HTTP semântico mais `{ codigo, mensagem, campo?,
detalhes? }`, com `codigo` de enum fechado — e o tratador global cumpre isso classificando a recusa
alheia por **status**. Para o `404`, a tabela dá `RECURSO_NAO_ENCONTRADO`.

O status `404`, porém, tem **duas origens que o status não separa**: o **roteador**, quando nenhuma
rota casa com o caminho ou com o método, e um **componente montado sob uma rota que existe**. As
duas saíam com o mesmo código — e esse código afirma, no contrato, um fato de negócio: *"a entidade
que você pediu não existe"*. Os corpos eram **idênticos byte a byte**, de modo que nenhum cliente
tinha como decidir entre as duas.

O custo foi medido no incidente `PROD-2026-09-03-01`, em 2026-09-03. As 7 rotas do ciclo de vida do
Painel Master estavam na árvore e verdes na suíte, mas o processo em execução era anterior ao
`dist/` do disco: elas respondiam o `404` do roteador. O painel do operador, classificando
**corretamente** pelo código recebido, exibiu *"Esta empresa não existe mais. Ela pode ter sido
removida por outro operador."* — sobre uma empresa que existe e estava aberta na tela. Um erro de
**implantação** chegou ao operador como uma **afirmação falsa sobre o negócio**, e o cliente não
tinha eixo algum por onde discordar.

## Decision

**O direito de usar o vocabulário de recusa de negócio é do domínio, nunca do roteador.** Quando
nenhuma rota casa, a resposta preserva o status de origem e sai com `REQUISICAO_RECUSADA` — o código
de fecho que já significa *"isto é recusa, e este vocabulário não nomeia a causa"* —, e não com
`RECURSO_NAO_ENCONTRADO`.

O discriminador é a **ausência de rota casada** na requisição, propriedade estrutural do despacho do
adaptador HTTP: quem não casou rota não tem padrão de rota. Não é o texto da exceção, não é uma lista
de caminhos conhecidos e não é a ausência de produtor.

O envelope **não muda**: o corpo continua sendo o da ADR-0017, com a chave `codigo` presente e vinda
do mesmo enum fechado. Nenhum código é acrescentado ao vocabulário.

## Consequences

**Pros:**
- O cliente passa a distinguir as duas causas pelo eixo que ele já usa para decidir — o `codigo` —,
  sem precisar de heurística sobre a mensagem nem de conhecimento sobre quais caminhos existem.
- A afirmação falsa some na origem: o consumidor que roteia `REQUISICAO_RECUSADA` para a faixa de
  indisponibilidade passa a dizer *"não consegui falar com o servidor"*, que é verdade, em vez de
  *"a entidade foi removida"*, que não era.
- Fecha por **propriedade**, não por enumeração: caminho novo, verbo novo ou rota futura caem do
  lado certo sozinhos, sem ninguém acrescentar entrada em tabela alguma.
- Erro de implantação volta a **parecer** erro de implantação, que é a condição para ser
  diagnosticado como tal — o incidente consumiu um relatório inteiro para reestabelecer isso.

**Cons:**
- Um consumidor que hoje trate `404` genericamente por `RECURSO_NAO_ENCONTRADO`, sem distinguir a
  origem, passa a ver um código diferente em caminho errado. É mudança de contrato, e é deliberada:
  o valor anterior afirmava um fato que o servidor não tinha como conhecer.
- O `404` de um componente que **casou** rota — o encaminhador de `/v1/auth`, por exemplo — continua
  saindo como `RECURSO_NAO_ENCONTRADO`. A fronteira é *casou rota*, não *é do domínio*, e quem
  publicar componente novo sob rota curinga precisa saber disso.

**Neutros:**
- Não altera a ADR-0017: o envelope, o enum fechado e as cinco regras de forma seguem inteiros.
  Esta diz **quem** pode usar cada código; aquela diz qual é a forma.
- Não altera o status da resposta, que continua `404` — ele é a informação precisa, e vem de quem
  recusou.
- Não altera o `404` de negócio, que nasce de `ErroDeAplicacao` e sequer atravessa o ramo tocado.

## Alternatives considered

- **Responder um corpo sem a chave `codigo`** — a forma prescrita pelo §7.3 do relatório do
  incidente. Motivo da rejeição: contraria a `Decision` da ADR-0017, que fixa `{ codigo, mensagem,
  … }` como a forma de **todo** erro; o tipo do corpo a impõe e a suíte a confere. O efeito que a
  prescrição buscava é alcançado inteiro por esta decisão — o próprio §6 do relatório declara que o
  painel já roteia `REQUISICAO_RECUSADA` para a faixa de indisponibilidade, que é a mesma superfície
  que a forma prescrita produziria. Mesma tela, sem contrariar ADR ativa. A divergência foi
  declarada e medida, no precedente de método do repositório: *prescrição é hipótese, não ordem*.
- **Acrescentar um código novo ao vocabulário** (`ROTA_NAO_PUBLICADA` ou similar). Motivo da
  rejeição: o vocabulário fechado é contrato com todo consumidor, e ampliá-lo obriga cada um a
  aprender um valor novo para expressar algo que o código de fecho já expressa com precisão. O
  próprio relatório o exclui.
- **Remover a linha `404` da tabela de código por status.** Motivo da rejeição: fecha o caminho
  apontado e deixa a classe aberta. Ela funcionaria só enquanto nenhum ponto do produto levantasse
  uma exceção `404` do arcabouço dentro de uma rota — hoje verdade, medida —, e o primeiro que o
  fizesse reabriria o defeito em silêncio. É a forma que a decisão fechada de 2026-08-02 no mesmo
  arquivo já rejeitou uma vez, pela mesma razão.
- **Discriminar pelo texto da exceção** (`Cannot GET …`). Motivo da rejeição: depende de literal do
  arcabouço, muda com a versão dele, e é enumeração disfarçada.
- **Não mudar nada, e corrigir só a implantação.** Motivo da rejeição: a implantação foi corrigida,
  e a ambiguidade não é dela. Enquanto os dois corpos forem idênticos, a próxima falha de qualquer
  natureza que produza um `404` de roteador voltará a chegar ao usuário como afirmação sobre o
  negócio.

## Applied in

- `apps/api/src/comum/filtro-excecao.ts` — o discriminador `nenhumaRotaCasou`, sob marcador `DECISÃO FECHADA`
- `apps/api/test/saude.e2e.spec.ts` — `CT-1250` (o par na mesma aplicação, com os corpos afirmados diferentes) e `CT-005`
- `deploy/scripts/publicacao/verificar-rotas-publicadas.sh` — `CT-1255`, a mesma propriedade medida contra o processo que atende
