---
id: 0004
title: Endpoints herdados de Server Script preservam o nome curto
status: accepted
date: 2026-07-29
tags: [architecture, http, security]
---

# 0004 - Endpoints herdados de Server Script preservam o nome curto

## Context

Os quatro Server Scripts ativos de tipo API expõem `api_method` sem namespace — `auth_locacao_imoveis`, `all_imoveis`, `atualizar_comodo` e `automacao_cobranca_config_api` — e o SPA React chama exatamente esses paths (`method/all_imoveis`, verificado no bundle publicado). Os mesmos quatro nomes estão inscritos na allowlist em regex do nginx criada pela TaskCard TC-001, que é a única barreira de rede entre a internet e a API.

A fase F1 do refactory `saas-multi-empresa` migra esses scripts para código Python do app. Um `@frappe.whitelist()` responde em `/api/method/locacao_automation.<modulo>.<funcao>`, path estruturalmente diferente do nome curto: adotá-lo quebraria o SPA e obrigaria a reescrever a allowlist, numa fase cujo objetivo é versionar estrutura, não alterar contrato.

## Decision

Os quatro endpoints herdados de Server Script preservam seus nomes curtos após a migração para código, por meio de aliases explícitos registrados no app. A lista de aliases é **fechada nesses quatro**: todo endpoint criado a partir desta decisão nasce com o path completo do módulo.

## Consequences

**Pros:**
- O SPA e a allowlist do nginx permanecem intactos; os critérios AC-02, AC-03 e AC-13 da TC-001 seguem válidos sem restart do proxy nem revalidação.
- A F1 deixa de exigir handoff de frontend e de coordenar uma janela única entre backend, SPA e proxy.
- Como endpoints novos nascem com namespace, a exceção não se propaga com o crescimento do app.

**Cons:**
- Quatro endpoints permanecem sem namespace, divergindo do padrão dos demais.
- O mapa de aliases é indireção: quem lê o path não localiza o código por convenção de nome.
- Enquanto os aliases existirem, renomear ou mover a função de destino quebra o SPA sem erro em tempo de build.

**Neutros:**
- A superfície exposta na allowlist não muda de tamanho.
- Migrar para o namespace continua possível depois, como decisão própria e com handoff.

## Alternatives considered

- **Migrar para o path com namespace** — os endpoints passariam a responder no path completo do módulo. Motivo da rejeição: exigiria alterar e redeployar o SPA, reescrever a allowlist, reiniciar o container do proxy e revalidar AC-02/AC-03/AC-13, tudo numa janela coordenada entre três sistemas, para ganhar consistência de nomes numa fase que não se propôs a mudar contrato.
- **Convivência com depreciação** — os dois paths ativos por um prazo, com o SPA migrando quando pudesse. Motivo da rejeição: dobra a superfície exposta na allowlist durante o período e, sem data de remoção acordada, o alias vira permanente com o custo de manter os dois modelos.

## Applied in

- `saas-multi-empresa (v1)` — seção 12.1.A do pré-refinamento daquela feature. **A feature foi excluída do repositório em 2026-08-01** (plano Frappe abandonado — ver `docs/plano-backend-novo/decisao-e-stack.md` §9); o registro de aplicação fica, o caminho não existe mais.
- `contencao-credencial-exposta (v1)` — docs/specs/features/contencao-credencial-exposta/v1/tasks/task-01-contencao-credencial-exposta.md (allowlist do nginx cujos paths esta decisão preserva)
