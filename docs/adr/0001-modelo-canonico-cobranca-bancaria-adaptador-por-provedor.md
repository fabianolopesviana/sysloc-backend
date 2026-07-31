---
id: 0001
title: Modelo canônico de cobrança bancária com adaptador por provedor
status: accepted
date: 2026-07-20
tags: [architecture, data, http]
---

# 0001 - Modelo canônico de cobrança bancária com adaptador por provedor

## Context

A integração de boletos foi construída acoplada ao Sicoob: os módulos de operação montam o payload do provedor inline, interpretam o JSON cru da resposta e carregam a URL da API como constante repetida em quatro arquivos. A validação de "exatamente uma configuração ativa" está duplicada em cinco. Não há fronteira entre a regra de negócio da cobrança e o dialeto do banco, então qualquer mudança de provedor — ou de versão da API do provedor atual — exige alteração de código em toda a superfície e novo deploy. O mesmo acoplamento impede tornar a configuração (credenciais, URLs, certificado) um dado operável, porque parte dela vive no código.

## Decision

Toda a operação de cobrança bancária passa a trafegar em tipos canônicos agnósticos de provedor. O núcleo conversa apenas com a porta `AdaptadorCobrancaBancaria` (`obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`); cada provedor implementa essa porta num adaptador próprio, responsável por toda a tradução de/para o formato do banco. Nenhum campo, URL ou vocabulário específico de provedor cruza a porta.

## Consequences

**Pros:**
- A regra de negócio da cobrança deixa de mudar quando o provedor ou a versão da API muda.
- Suportar um segundo banco passa a ser escrever um adaptador, não editar o fluxo de cobrança.
- Configuração (credenciais, URLs, certificado) vira dado, viabilizando operação por tela em vez de deploy.
- Elimina a constante de URL repetida em quatro arquivos e a validação de configuração ativa duplicada em cinco.
- O enum canônico de situação do boleto substitui a interpretação ad-hoc de strings do provedor espalhada pelos módulos.

**Cons:**
- Introduz uma camada de indireção com um único provedor implementado — custo de abstração pago antes do benefício.
- Exige refatoração ampla sobre código de boleto em produção, com risco de regressão em fluxo que movimenta dinheiro.
- Mapeamento canônico incompleto pode perder informação do provedor; mitigado preservando o texto cru da situação ao lado do valor canônico.

**Neutros:**
- Campos sem equivalente canônico ficam num escape de parâmetros por provedor, mantendo o núcleo agnóstico sem bloquear especificidades.
- As assinaturas expostas ao frontend e o shape das respostas permanecem inalterados — a mudança é interna.

## Alternatives considered

- **Desacoplar apenas configuração e HTTP** — unificar a fonte de configuração e mover a URL para dado, mantendo os módulos falando o JSON do provedor. Motivo da rejeição: entrega o ganho operacional visível, mas preserva o acoplamento que torna cada mudança de provedor um refactor completo; a dívida seria paga depois com o mesmo custo, sobre código já em produção.
- **Faseamento: desacoplar agora, canonizar depois** — entregar a tela primeiro e o modelo canônico numa segunda etapa. Motivo da rejeição: implica tocar os mesmos arquivos de cobrança duas vezes, dobrando a exposição a regressão no fluxo mais sensível do sistema.
- **Adaptador sem modelo canônico** (tradução direta provedor-a-provedor) — Motivo da rejeição: sem um vocabulário neutro, cada novo provedor multiplicaria as traduções em vez de somar uma; o custo cresceria de forma quadrática.

## Applied in

- `integracao-bancaria-configuravel (v1)` — `docs/specs/features/integracao-bancaria-configuravel/v1/pre-refinement.md` (adoção planejada; implementação pendente)
