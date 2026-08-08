---
id: 0016
title: O esquema é a fonte única do contrato — validação e documento derivam dele
status: accepted
date: 2026-08-05
tags: [http, architecture]
---

# 0016 - O esquema é a fonte única do contrato — validação e documento derivam dele

## Context

A API descreve hoje o mesmo contrato **duas vezes**: o esquema que confere a entrada e a descrição
publicada da saída, escrita à mão ao lado dele. São duas escritas do mesmo fato, livres para divergir
sem que nada acuse — o documento pode prometer um campo que a rota não devolve, e nenhum teste
reprova, porque nenhum dos dois é derivado do outro. A fase de domínio cria o pacote de contratos que
o frontend importará no marco de entrega, e é o momento em que se decide se o contrato tem uma fonte
ou várias — depois dele, cada fase acrescenta rotas sobre a resposta que estiver valendo.

## Decision

O **esquema declarado no pacote de contratos é a fonte única**: a conferência de entrada, o tipo da
resposta e o documento publicado derivam dele. Nenhuma descrição de contrato é escrita à mão em
paralelo ao esquema. Uma camada de contrato adicional é permitida desde que **derive** do esquema —
nunca que o duplique.

## Consequences

**Pros:**
- O documento publicado não pode prometer o que a rota não entrega: os dois saem da mesma declaração.
- O pacote que o frontend importará nasce já com os tipos, sem etapa de tradução no meio.
- Adotar depois uma camada de contrato tipado fica barato — ela deriva do que já existe, em vez de
  reescrever a superfície.

**Cons:**
- As rotas publicadas **antes** desta decisão descrevem a saída à mão e ficam em desacordo com ela
  até serem convertidas. Convertê-las junto seria refactor fora do escopo da fatia que adota a
  decisão; a conversão é **débito com gatilho**, e o gatilho é a próxima vez que cada rota for aberta
  por outra razão.
- O consumidor não recebe cliente pronto: monta as chamadas a partir dos tipos publicados.
- O esquema passa a servir a três propósitos, e mexer nele alcança conferência, tipo e documento de
  uma vez — que é exatamente o ponto, e também o risco de uma mudança descuidada.

**Neutros:**
- Não decide **qual** biblioteca produz o contrato; decide **de onde ele nasce**. A escolha registrada
  em `decisao-e-stack.md` §4 permanece adotável, desde que derivada.
- Não altera a **ADR-0012**, que fixa a *forma* do contrato — envelope de erro e chave exposta por
  classe de entidade. Esta fixa a *fonte*; as duas se compõem.

## Alternatives considered

- **Adotar agora a biblioteca de contrato declarada na stack** — entregaria cliente tipado de ponta a
  ponta. Motivo da rejeição: deixaria as rotas já publicadas numa forma e as novas noutra, e o ganho
  só se realiza quando a superfície congelar, depois da última fase de domínio; converter as
  existentes no mesmo ato é refactor fora do escopo, vedado pelo Protocolo Antirregressão.
- **Manter as duas escritas e vigiá-las por verificação** — um caso que compare o documento com o
  esquema. Motivo da rejeição: preserva a duplicação e acrescenta um terceiro artefato para
  fiscalizá-la; a divergência deixa de ser silenciosa, mas continua possível, e a verificação vira
  mais uma coisa que alguém precisa lembrar de atualizar.
- **Adiar o pacote de contratos** para o marco de entrega. Motivo da rejeição: contraria a entrega
  declarada da fase, e empurra para o fim — quando há dezenas de rotas — a decisão que custa menos
  tomada no começo, quando há poucas.

## Applied in

- `cadastro-de-imoveis-e-pessoas (v1)` — `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech-alignment.md`
