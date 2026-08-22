---
id: 0036
title: Material criptográfico legado é convertido por processo externo na borda de registro
status: accepted
date: 2026-08-21
tags: [security, architecture]
---

# 0036 - Material criptográfico legado é convertido por processo externo na borda de registro

## Context

A Autoridade Certificadora entrega o material do certificado embalado em cifra legada
(`RC2-40-CBC`) — duas emissões consecutivas medidas, de modo que é o padrão dela, não exceção. O
runtime recusa essa cifra por padrão, e a rota que registra o certificado rejeita justamente o
arquivo que o Admin recebeu. O contorno existente é ferramenta de servidor, que o Admin de uma
imobiliária não tem nem deve ter; num produto multiempresa, toda renovação vira chamado para quem
opera a máquina. Aceitar o material obriga a escolher **onde** a tolerância à cifra fraca vive — e a
escolha é transversal, porque o mesmo processo decifra todo segredo operável do produto (ADR-0032).

## Decision

Material criptográfico de terceiro que o runtime não abre é convertido **na borda de registro**, por
invocação de processo externo de vida curta, preservando o par certificado/chave — identidade
conferida por **titular, número de série e validade**, nunca presumida. A tolerância à cifra legada
fica confinada a esse subprocesso: o processo do produto jamais a habilita, e o que se cifra e
guarda é sempre o material convertido.

## Consequences

**Pros:**
- A cifra fraca vive num processo descartável, e não naquele que manipula todo segredo operável.
- A renovação deixa de exigir acesso ao servidor — é o que torna a operação viável com N clientes.
- A preservação do certificado é afirmada por medição da identidade, não pela ausência de erro.

**Cons:**
- O produto passa a depender de binário do host: presença, versão e caminho viram pré-condição de operação, e precisam ser afirmados pelo provisionamento.
- Exige guarda de execução própria — caminho absoluto, ausência de interpretador de comandos, senha por descritor de arquivo, teto de tempo e saída fora do diário.
- O intermediário em claro vive em memória compartilhada, que pode ser paginada para área de troca: a garantia é *"não escreve em armazenamento persistente"*, não impossibilidade física.

**Neutros:**
- A conversão é idempotente e só ocorre quando o runtime não abre o material recebido.
- É ato de configuração, não de cobrança: não exerce nenhuma das operações reservadas pela ADR-0001.
- Complementa a ADR-0032 sem concorrer com ela — aquela fixa como o segredo é guardado; esta, como ele é aceito.

## Alternatives considered

- **Habilitar o provider legado no runtime** (uma opção na unidade de serviço) — a mais barata. Motivo da rejeição: habilita cifra fraca no processo inteiro, que é o mesmo que decifra todo segredo operável; compra conveniência com superfície muito além do necessário.
- **Biblioteca de PKCS#12 de terceiro, em JavaScript** — dispensa processo externo e provider global. Motivo da rejeição: traz criptografia de terceiro para o caminho do segredo e acrescenta dependência ao manifesto; há precedente registrado de preferir o cliente nativo pela mesma razão.
- **Manter a conversão fora do produto**, como ferramenta de servidor — é o estado anterior. Motivo da rejeição: exige acesso à máquina, que o Admin não tem, e o custo cresce com o número de clientes.
- **Encadear os dois processos por pipe**, sem intermediário em arquivo — preservaria a forma anterior do contorno. Motivo da rejeição: **medido e impossível** — a exportação PKCS#12 exige entrada seekable e falha lendo de entrada padrão ou de descritor.

## Applied in

- `integracao-bancaria-autonoma (v1)` — docs/specs/features/integracao-bancaria-autonoma/v1/pre-refinement.md
