---
id: 0033
title: Cada série declara o próprio escopo, com furo aceito e número nunca reusado
status: accepted
date: 2026-08-14
tags: [data, architecture]
---

# 0033 - Cada série declara o próprio escopo, com furo aceito e número nunca reusado

## Context

A ADR-0015 fixou que **todo** contador sequencial do produto é único por empresa. A premissa era
verdadeira enquanto toda série servia a um código legível **interno** — contrato e cobrança —, em que
a empresa é o universo de unicidade. A integração bancária traz a primeira série cuja unicidade é
exigida por um **terceiro**: o identificador que o provedor recebe não pode se repetir entre
imobiliárias diferentes, porque o provedor não conhece a fronteira de empresa. Um contador por
empresa faz duas imobiliárias emitirem o mesmo número no mesmo mês — o defeito que o sistema antigo
já tinha, pela razão oposta. O quantificador universal da 0015 ficou falso.

## Decision

Toda série sequencial deste produto **declara o próprio escopo**, e o escopo é parte da definição da
série — não uma variação dentro de um padrão por empresa. Contrato e cobrança declaram
`(empresa, ano)`; o identificador perante o provedor declara **o SaaS**, e pedi-lo em nome de uma
empresa é irrepresentável. Dentro do escopo declarado, criações concorrentes **não esperam umas pelas
outras** — **furo na sequência é aceito** — e o número **nunca é reusado**, nem por registro
excluído, nem por criação abortada.

## Consequences

**Pros:**
- Série cuja unicidade é exigida por um terceiro deixa de ser exceção a uma regra: passa a ser uma
  instância declarada dela, como as demais.
- O escopo vira campo obrigatório da definição de cada série. Esquecê-lo deixa de ser omissão
  silenciosa e passa a ser lacuna visível na especificação.
- As duas cláusulas que a 0015 acertou — furo aceito e número nunca reusado — seguem intactas e
  continuam valendo para toda série, qualquer que seja o escopo.

**Cons:**
- Série de escopo SaaS é ponto de contenção entre empresas que não têm relação nenhuma — exatamente
  o custo que a 0015 rejeitava. Aqui ele é imposto de fora, e o preço passa a ser aceito.
- Ler um número não diz mais qual é o escopo dele: duas séries visualmente parecidas podem ter
  universos de unicidade diferentes, e só a definição da série responde.
- O isolamento de uma série de escopo SaaS não pode vir de RLS — vem de privilégio e de assinatura
  sem parâmetro de empresa, que é mecanismo distinto do resto do produto.

**Neutros:**
- Nenhuma série existente muda de escopo: contrato e cobrança continuam em `(empresa, ano)`, e esta
  decisão governa como o escopo se declara, não qual escopo cada série tem.
- O **mecanismo** do contador continua sendo a ADR-0020 (contador do próprio banco, cujo avanço não
  participa do desfazimento). Esta decisão fixa o **escopo**; aquela, o instrumento.
- Quais entidades expõem código legível segue sendo aplicação da ADR-0017.
- Combina com a ADR-0014 como a 0015 combinava: registro retirado de circulação continua ocupando o
  número.

## Alternatives considered

- **Manter a 0015 e tratar o contador bancário como exceção documentada** — nenhuma ADR nova, a
  divergência registrada na spec da fatia. Motivo da rejeição: uma ADR ativa cujo texto a
  implementação falsifica é pior que nenhuma — o Protocolo Antirregressão manda parar e escalar em
  conflito com ADR ativa, de modo que a exceção cobraria uma escalada por fatia, para sempre.
- **Emendar a 0015 no lugar de superseder** — trocar a primeira oração da `Decision`, no molde das
  emendas da 0021 e da 0024. Motivo da rejeição: naqueles dois casos a decisão de fundo não havia
  mudado, apenas o registro dela. Aqui a extensão é real — o universo de unicidade deixa de ser um
  só —, e reescrever o texto apagaria a razão pela qual a regra antiga era correta quando foi
  tomada.
- **Contador por empresa com a empresa embutida no identificador enviado** — preservaria a 0015
  literalmente, distinguindo as empresas por prefixo. Motivo da rejeição: o formato das 18 posições é
  imposto pelo provedor e não tem campo para isso; usar posições do contador como discriminador
  reduziria o espaço numérico e faria o teto chegar antes.
- **Sequência densa, sem furo** e **reusar o número de registro excluído** — as duas alternativas que
  a 0015 já havia rejeitado. Motivo da rejeição: inalterado. Serializar criação por uma propriedade
  estética, e destruir a estabilidade da referência citada fora do sistema.

## Applied in

- `fundacao-bancaria (v1)` — `docs/specs/features/fundacao-bancaria/v1/tech_spec.md`
