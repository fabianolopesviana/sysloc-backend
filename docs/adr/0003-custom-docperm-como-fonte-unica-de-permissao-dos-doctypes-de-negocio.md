---
id: 0003
title: Custom DocPerm como fonte única de permissão dos DocTypes de negócio
status: deprecated
date: 2026-07-28
tags: [security, architecture, data]
---

# 0003 - Custom DocPerm como fonte única de permissão dos DocTypes de negócio

## Context

A contenção da credencial exposta criou um papel de serviço (`Servico App`) com permissão restrita nos nove DocTypes que o SPA consome. A permissão nasce em patch versionado (ADR-0002), na forma de registros `Custom DocPerm`.

O framework, porém, não trata `Custom DocPerm` como acréscimo: ele o trata como substituição. Verificado no Frappe 15.4.0 instalado, `frappe/permissions.py:400-417` (`get_valid_perms`) monta `custom_perms` a partir de `Custom DocPerm` e só reincorpora um `DocPerm` padrão quando `p.parent not in get_doctypes_with_custom_docperms()` — e essa lista vem de `frappe.get_all("Custom DocPerm", pluck="parent", distinct=True)`, ou seja, é global **por DocType** e independe do papel que está sendo avaliado. `frappe/model/meta.py:521-530` reforça o mesmo comportamento ("Reset `permissions` with Custom DocPerm if exists").

O efeito é uma mudança de alcance de privilégio que ninguém declarou: todos os `DocPerm` padrão dos nove DocTypes pertenciam exclusivamente a `System Manager`, e passam a ser ignorados assim que o primeiro `Custom DocPerm` é inserido. Sem registro com autoridade arquitetural, a próxima feature que criar papéis (`saas-multi-empresa` v2) herda a consequência sem saber que ela existe, e o próximo patch que inserir um `Custom DocPerm` em outro DocType repete o descarte sem perceber.

## Decision

Os nove DocTypes de negócio — `Atraso`, `Cobranca`, `Conjunto`, `Contrato`, `Fiador`, `Imovel`, `Locador`, `Locatario` e `Usuario` — passam a ser regidos **exclusivamente** por `Custom DocPerm`. Todo papel que precise acessá-los declara o seu `Custom DocPerm` explicitamente, em patch versionado; nenhum acesso a esses DocTypes decorre mais de `DocPerm` padrão.

## Consequences

**Pros:**
- O acesso aos DocTypes de negócio deixa de ser implícito: quem pode ler cada um está escrito em arquivo, revisável no diff, e não depende de um default do framework.
- A credencial do papel de serviço, pública por desenho, fica limitada ao que foi declarado — nenhum papel administrativo vaza acesso por herança.
- O alcance vira testável: um critério de aceite pode medir o que um papel enxerga, o que antes era efeito colateral não observável.

**Cons:**
- Um usuário com papel `System Manager` que não seja o `Administrator` perde acesso aos nove DocTypes (o `Administrator` curto-circuita a checagem de permissão e não é afetado). Restaurar esse acesso exige declarar `Custom DocPerm` para `System Manager` — não há caminho automático.
- Toda feature futura que criar papéis para esses DocTypes precisa declarar as permissões explicitamente; esquecer produz um papel silenciosamente cego, não um erro.
- Precedente que se propaga: todo patch que inserir `Custom DocPerm` num DocType descarta os `DocPerm` padrão daquele DocType, e a decisão de fazê-lo passa a exigir o mesmo cuidado.

**Veículo de imposição:**
- A exclusividade decidida acima só é efetiva porque a declaração é **reimposta a cada `bench migrate`**: `locacao_automation` registra `after_migrate` apontando para `patches.v1_0.criar_papel_servico_app.execute`, que converge o conjunto de `Custom DocPerm` do papel (cria o que falta, reescreve os flags declarados e remove o que estiver fora do conjunto).
- O `patches.txt` **não** é o veículo de bootstrap, ao contrário do que a intuição sugere: `install_app` marca **todos** os patches do app como concluídos sem executá-los (`frappe/installer.py:307-308` chama `set_all_patches_as_completed`, que insere uma linha em `Patch Log` por patch), e a CLI nunca desliga esse comportamento (`frappe/commands/site.py:462` não passa `set_as_patched`). Como o `patch_handler` pula todo módulo já gravado no `Patch Log`, o patch é pulado **até num site novo** criado com `bench new-site` + `bench install-app`. A linha em `patches.txt` é retida apenas como rede para o restore via `--source_sql` (`frappe/installer.py:112`, único caminho que passa `set_as_patched=False`). O mecanismo de patch em si segue íntegro para o caso ao qual se destina (ADR-0002): um patch novo, acrescentado ao `patches.txt` depois que o site já existe, não tem linha no `Patch Log` e roda normalmente no `bench migrate` seguinte — o que `install_app` inutiliza é apenas o patch que já estava no repositório no instante em que o site foi criado.
- O `after_migrate` é, portanto, o veículo **único**: cria o papel e os `Custom DocPerm` na primeira migração e os reimpõe nas seguintes. Sem ele, a decisão não valeria em site nenhum instalado pela via normal, e qualquer desvio posterior (Role Permissions Manager do Desk, edição direta na tabela) sobreviveria indefinidamente. Toda feature futura que declarar `Custom DocPerm` para um papel deve prever o mesmo veículo de reimposição contínua, não só o patch de criação.

**Neutros:**
- `Configuracao Integracao Bancaria` está fora dos nove e não tem `Custom DocPerm`: continua regido pelo `DocPerm` padrão de `System Manager`. O fluxo de configuração da integração pelo Desk, adotado como contorno até a sessão real chegar, segue funcionando.
- O escopo do sombreamento é por DocType, não global: DocTypes sem nenhum `Custom DocPerm` mantêm o comportamento padrão do framework.

> Deprecated em 2026-08-04. Motivo: o substrato morreu — a decisão rege nove DocTypes por `Custom DocPerm`, primitivas do Frappe. A autorização do backend nativo é governada pelas ADR-0010 (efetivo do perfil com overrides) e ADR-0011 (cobertura declarada por rota).

## Alternatives considered

- **Materializar os DocPerm padrão junto com os do papel de serviço** (`frappe.permissions.setup_custom_perms` + `add_permission`, que copia os `DocPerm` existentes para `Custom DocPerm` antes de acrescentar os novos) — preservaria o acesso de `System Manager`. Motivo da rejeição: produziria 18 registros onde o contrato da task declara 9, contrariando as asserções de contagem exata dos casos de teste que guardam contra escalonamento silencioso, e não é necessário à contenção — o acesso administrativo real é exercido pelo `Administrator`, que ignora a checagem.
- **Conceder o acesso do SPA por papel administrativo existente**, sem `Custom DocPerm` novo — evitaria o sombreamento por completo. Motivo da rejeição: a credencial do papel de serviço é pública por desenho; atrelá-la a um papel administrativo reproduz o problema original que a contenção existe para fechar.
- **Deixar a consequência registrada apenas no docstring do patch** — custo zero. Motivo da rejeição: docstring não é contrato do projeto; a próxima feature que criar papéis não o lê, e o alcance de privilégio voltaria a mudar sem registro nem medição.

## Applied in

- `contencao-credencial-exposta (v1)` — `docs/specs/features/contencao-credencial-exposta/v1/tasks/task-01-contencao-credencial-exposta.md`
