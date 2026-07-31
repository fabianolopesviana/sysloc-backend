# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: `saas-multi-empresa` v1 — Fundação versionável e ambiente de execução
- **Variante**: backend
- **Stack**: Python (Frappe Framework v15 / ERPNext), MariaDB, Docker Compose
- **Autor**: sysloc
- **Data**: 2026-07-29
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/saas-multi-empresa/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/saas-multi-empresa/v1/tech-alignment.md`

---

## 2. Resumo Técnico da Solução

Os 19 DocTypes hoje `custom=1` no módulo `Locação de imóveis` passam a DocTypes de app (`custom=0`) no módulo `Locacao Automation`, descritos em `doctype/<snake>/<snake>.json` — o mesmo formato dos dois já versionados. A convergência do flag `custom` roda em `[pre_model_sync]`, de modo que o model sync seguinte assuma os arquivos como fonte; o descarte dos cadastros sem uso roda em `[post_model_sync]`, depois da convergência verificada.

Os 6 Server Scripts ativos migram para código do app: os 2 de DocType Event viram `doc_events` (`before_save` para metragem, `on_update` para o documento de contrato) e os 4 de API viram `@frappe.whitelist()` alocados nos módulos de domínio correspondentes. Conforme **ADR-0004**, os 4 preservam os nomes curtos via `override_whitelisted_methods` — o SPA e a allowlist do nginx da TC-001 ficam intactos.

A equivalência de cada regra migrada é comprovada por caracterização capturada **antes** da migração (RN-08): valor produzido para a regra de agregação, texto extraído do PDF para a que gera documento — nunca comparação binária, porque o artefato carrega metadados de geração variáveis.

A stack nova sobe como projeto Compose próprio, com banco vazio: a estrutura vem inteira do repositório, o que é a única forma honesta de provar o CA-01. Ela não recebe operação real nesta versão (RN-06) e passa a ser o destino da suíte (**ADR-0006**). As rotinas agendadas e os scripts que elas invocam passam a viver em `deploy/cron/` e `deploy/bin/`, instalados por script idempotente em `/etc/cron.d` (**ADR-0005**), com saída única em `/var/log` sob `logrotate`.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

Nenhuma camada nova é introduzida. A solução opera em quatro frentes sobre a estrutura existente:

1. **Definição de dados** — de estado do banco para arquivo versionado, com convergência por patch.
2. **Lógica de domínio** — de `Server Script` (linhas no banco, interpretadas em runtime) para módulos Python do app, registrados em `hooks.py`.
3. **Superfície HTTP** — mantida idêntica por aliasing, deslocando apenas onde o código vive.
4. **Ambiente e agendamento** — de configuração no servidor para artefato versionado com instalador.

```
  repositório (fonte)                          ambiente de execução
  ─────────────────────                        ─────────────────────
  doctype/<x>/<x>.json  ──[pre_model_sync]──►  tabelas + metadados
                            converge custom=0
  <modulo>/service.py   ──[hooks.doc_events]─► regra de domínio no ciclo do documento
                        ──[override_wl]──────► /api/method/<nome-curto>  (ADR-0004)
  deploy/cron/*         ──[instalador]───────► /etc/cron.d + /usr/local/bin
  deploy/bin/*
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `locacao_automation/doctype/<19 cadastros>/` | Definição versionada da estrutura de dados | Modelo |
| `patches/v1_1/converger_doctypes_do_app.py` | Zera o flag `custom` dos cadastros preservados antes do model sync | Migração |
| `patches/v1_1/descartar_cadastros_sem_uso.py` | Remove os cadastros sem uso e seus registros, e os 19 Server Scripts desativados, após convergência | Migração |
| `imovel/service.py` | `all_imoveis`, `atualizar_comodo` e a regra de metragem | Serviço de domínio |
| `contrato_pdf/service.py` (existente) | Recebe a geração do documento de contrato | Serviço de domínio |
| `usuario_app/service.py` (existente) | Recebe `auth_locacao_imoveis` | Serviço de domínio |
| `cobranca_automation/service.py` (existente) | Recebe `automacao_cobranca_config_api` | Serviço de domínio |
| `hooks.py` (existente) | Registra `doc_events` e `override_whitelisted_methods` | Composição |
| `deploy/cron/` + `deploy/bin/` + instalador | Agendamento e scripts versionados (ADR-0005) | Infraestrutura |
| `deploy/compose/` | Projeto Compose da stack nova, isolado | Infraestrutura |

### 3.3 Camadas e Fronteiras

Arquitetura **modular por domínio**, como o app já pratica: cada módulo expõe um `service.py` como fachada e concentra a regra do seu domínio. Direção das dependências: `hooks.py` (composição) → `<modulo>/service.py` (domínio) → API do framework (persistência). Patches vivem à parte, em `patches/v1_1/`, e só rodam no ciclo de migração — nunca são importados por código de domínio.

Fronteira preservada: os módulos de domínio não conhecem a superfície HTTP. O nome curto do endpoint é decisão de composição, resolvida em `hooks.py` pelo aliasing, não no módulo.

### 3.4 Visão em Árvore

```
app-sync/locacao_automation/locacao_automation/
├── hooks.py                                              [M]
├── patches.txt                                           [M]
├── patches/
│   ├── v1_0/
│   │   ├── criar_papel_servico_app.py                    [R]
│   │   └── migrar_configuracao_integracao_bancaria.py    [R]
│   └── v1_1/
│       ├── __init__.py                                   [N]
│       ├── converger_doctypes_do_app.py                  [N]
│       └── descartar_cadastros_sem_uso.py                [N]
├── locacao_automation/doctype/
│   ├── configuracao_integracao_bancaria/                 [R]
│   ├── atraso/                                           [N]
│   ├── automacao_cobranca_config/                        [N]
│   ├── cobranca/                                         [N]
│   ├── cobranca_integracao_sicoob/                       [N]
│   ├── comodo/                                           [N]
│   ├── conjunto/                                         [N]
│   ├── contrato/                                         [N]
│   ├── fiador/                                           [N]
│   ├── fiadores/                                         [N]
│   ├── imovel/                                           [N]
│   ├── locador/                                          [N]
│   ├── locatario/                                        [N]
│   ├── log_envio_cobranca/                               [N]
│   └── usuario/                                          [N]
├── imovel/
│   ├── __init__.py                                       [N]
│   └── service.py                                        [N]
├── contrato_pdf/service.py                               [M]
├── usuario_app/service.py                                [M]
├── cobranca_automation/service.py                        [M]
├── contrato_ativacao/service.py                          [R]
└── tests/
    ├── test_patch_migracao_config.py                     [R]
    ├── test_caracterizacao_metragem.py                   [N]
    ├── test_caracterizacao_documento_contrato.py         [N]
    ├── test_patch_converger_doctypes.py                  [N]
    ├── test_patch_descarte.py                            [N]
    └── test_endpoints_migrados.py                        [N]

deploy/
├── nginx/react-default.conf                              [R]
├── bin/
│   ├── backup_frappe.sh                                  [N]
│   ├── sincronizar-pagamentos-sicoob.sh                  [N]
│   └── run-*.sh (4 scripts movidos da raiz)              [N]
├── cron/locacao-automation.cron                          [N]
├── cron/logrotate-locacao.conf                           [N]
├── instalar-cron.sh                                      [N]
└── compose/docker-compose.stack-nova.yaml                [N]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `locacao_automation/doctype/<14 dirs>/{<x>.json,<x>.py,__init__.py}` | Definição versionada dos cadastros preservados | Modelo |
| `patches/v1_1/converger_doctypes_do_app.py` | Convergência do flag `custom` (pre_model_sync) | Migração |
| `patches/v1_1/descartar_cadastros_sem_uso.py` | Descarte dos 5 sem uso + os 2 órfãos `custom=0` | Migração |
| `imovel/service.py` | `all_imoveis`, `atualizar_comodo`, regra de metragem | Serviço |
| `tests/test_caracterizacao_metragem.py` | Referência de comportamento da regra de agregação | Teste |
| `tests/test_caracterizacao_documento_contrato.py` | Referência por texto extraído do PDF | Teste |
| `tests/test_patch_converger_doctypes.py` | Convergência e idempotência | Teste |
| `tests/test_patch_descarte.py` | Descarte e preservação da cadeia de fiadores | Teste |
| `tests/test_endpoints_migrados.py` | Nomes curtos resolvem para as funções migradas | Teste |
| `deploy/bin/*.sh` | Os 6 scripts das rotinas, versionados | Infra |
| `deploy/cron/locacao-automation.cron` | Definição de agendamento | Infra |
| `deploy/cron/logrotate-locacao.conf` | Política de retenção dos registros | Infra |
| `deploy/instalar-cron.sh` | Instalador idempotente (ADR-0005) | Infra |
| `deploy/compose/docker-compose.stack-nova.yaml` | Projeto Compose isolado | Infra |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `hooks.py` | Acrescenta `doc_events` das 2 regras migradas e `override_whitelisted_methods` dos 4 endpoints | Registro das regras e preservação do contrato (ADR-0004) |
| `patches.txt` | Registra os 2 patches novos, um em cada seção | Convergência antes do model sync, descarte depois |
| `contrato_pdf/service.py` | Recebe a geração do documento (hoje em Server Script) | Módulo já é o dono do domínio de documento de contrato |
| `usuario_app/service.py` | Recebe `auth_locacao_imoveis` | Módulo já concentra autenticação do app |
| `cobranca_automation/service.py` | Recebe `automacao_cobranca_config_api` | Módulo já é o dono da automação de cobrança |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `patches/v1_0/migrar_configuracao_integracao_bancaria.py` | Padrão de patch idempotente em dois passos — precedente direto |
| `tests/test_patch_migracao_config.py` | Padrão de teste de patch, incluindo o caso de idempotência |
| `locacao_automation/doctype/configuracao_integracao_bancaria/` | Formato canônico de DocType versionado do app |
| `contrato_ativacao/service.py` | Já registra `Contrato.on_submit`; a ordem com `on_update` precisa ser preservada |
| `deploy/nginx/react-default.conf` | Allowlist que os nomes curtos preservam (TC-001) |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Nenhum endpoint novo. Os 4 abaixo **mudam de implementação, não de contrato** (ADR-0004).

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Listar imóveis | GET | `/api/method/all_imoveis` | — | Lista de imóveis por conjunto | 200, 401, 403 | token do usuário de serviço |
| Autenticar usuário do app | POST | `/api/method/auth_locacao_imoveis` | JSON com credenciais | Sessão do app | 200, 401, 403, 417 | token do usuário de serviço |
| Atualizar cômodo | POST | `/api/method/atualizar_comodo` | JSON do cômodo | Confirmação | 200, 401, 403, 417 | token do usuário de serviço |
| Configuração de automação de cobrança | GET/POST | `/api/method/automacao_cobranca_config_api` | JSON de configuração | Configuração vigente | 200, 401, 403 | token do usuário de serviço |

### 4.1.1 Exemplo de Payload por Endpoint

N/A — nenhum dos 4 endpoints é atualização parcial (`PUT`/`PATCH` com campos opcionais). Os contratos de payload são idênticos aos atuais e não são redefinidos por esta versão: a migração preserva assinatura e resposta, e qualquer divergência é falha de equivalência (RN-08), não mudança de contrato.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| — | — | Os 4 endpoints trafegam dicionários do framework, sem schema declarado | — |

Nenhum schema formal é introduzido. Formalizar contratos é escopo de versão posterior, quando o handoff do frontend for regenerado.

### 4.3 Eventos Publicados / Consumidos

N/A — esta versão não introduz mensageria. As 2 regras migradas são acionadas por eventos de ciclo de vida de documento do próprio framework (`before_save`, `on_update`), não por barramento externo.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

> **PREMISSA A VALIDAR NA PRIMEIRA TASK** (levantada no challenge, 2026-07-29): o passo 1 abaixo assume que o patch de convergência é **necessário** para que o arquivo vire fonte. Essa premissa **não foi verificada**. O `import_file.py` do framework não tem tratamento especial para DocType `custom`, o que abre a possibilidade de o model sync convergir `custom=1 → 0` sozinho ao importar o `.json`, tornando o patch redundante.
>
> A primeira task DEVE validar isso empiricamente em **um** cadastro de baixo risco (sugestão: `Conjunto` — 1 campo, 3 registros, sem vínculo estrutural de entrada) antes de aplicar aos 14. Se o model sync resolver sozinho, o patch de convergência **sai do escopo** e a versão encolhe; se não resolver, o passo 1 se confirma como descrito. Validar exige ambiente destrutível — portanto ocorre no ambiente novo (ADR-0006), não no que atende a operação.

**Convergência da estrutura** (por `bench migrate`):
1. `[pre_model_sync]` → `converger_doctypes_do_app.execute()` zera `custom` dos 14 cadastros preservados e ajusta o módulo para `Locacao Automation`. Guard de idempotência: se todos já estão convergidos, encerra sem escrita.
2. O model sync do framework assume os arquivos `doctype/<x>/<x>.json` como fonte e reconcilia as tabelas.
3. `[post_model_sync]` → `descartar_cadastros_sem_uso.execute()` remove os 5 cadastros sem uso, os 2 órfãos e os **19 Server Scripts desativados**, registrando nome e tipo de cada um antes da remoção. Guard: se nada existe, encerra.
4. `after_migrate` (já registrado) → reimpõe o papel de serviço e seus `Custom DocPerm` (ADR-0003).

**Regra migrada — metragem**: `Imovel.before_save` → `imovel.service.calcular_metragem_total(doc)` → soma a metragem dos cômodos filhos e grava no campo do pai. Sem I/O, sem efeito colateral externo.

**Regra migrada — documento de contrato**: `Contrato.on_update` → `contrato_pdf.service.gerar_documento_contrato(doc)` → monta o conteúdo, renderiza o PDF, anexa ao documento e grava a referência. Não executa para documento cancelado.

**Endpoint migrado**: requisição chega em `/api/method/<nome-curto>` → nginx confere a allowlist (inalterada) → framework resolve o alias em `override_whitelisted_methods` → executa a função `@frappe.whitelist()` no módulo de domínio.

**Ordem obrigatória da migração de cada endpoint** (verificada em `frappe/handler.py:62-72`): o `execute_cmd` aplica o override **antes** de procurar Server Script, e a busca usa o `cmd` **já substituído**. Consequência: assim que o alias é registrado, o Server Script original torna-se inalcançável por aquele nome, ainda que permaneça ativo — o override tem precedência absoluta.

Portanto, a migração de cada endpoint segue esta ordem, e ela é requisito, não preferência:

1. Registrar a função Python **e** o alias no mesmo passo. A troca é atômica do ponto de vista da requisição: nenhuma requisição encontra o endpoint sem dono.
2. Comprovar a equivalência com o endpoint já servido pela função nova.
3. **Só então** desativar o Server Script original, fechando o CA-03 e a RN-01.

**Nunca desativar o Server Script antes de registrar o alias** — isso abriria uma janela em que o endpoint não responde por ninguém, com o aplicativo em produção chamando os quatro caminhos. Reversão em caso de falha de equivalência: remover o alias devolve o atendimento ao Server Script original imediatamente, sem redeploy.

### 5.2 Fluxos Alternativos

> **ORDEM OBRIGATÓRIA ENTRE TASKS** (levantada no challenge): a caracterização de cada regra tem de ser **capturada com a regra original ainda ativa**. Se a decomposição colocar a captura depois da migração, não há referência contra a qual comparar e a RN-08 vira declaração vazia. Toda task que migra uma regra **depende** da task que capturou a referência daquela regra.

- **Equivalência não comprovada**: se a caracterização falha para uma regra, o Server Script original permanece ativo e a migração daquela regra não conclui (RN-08). As demais seguem — a migração é por regra, não em bloco.
- **Cadastro candidato revela uso**: se a verificação das três ausências (RN-02) encontrar qualquer referência, o cadastro sai da lista de descarte e entra na de preservação. O patch de descarte opera sobre lista fechada e explícita, nunca sobre heurística em runtime.
- **Folga de disco insuficiente**: se a medição pós-remoção não comprovar margem para dois ambientes, a stack nova não sobe nesta versão e o CA-08 fica bloqueado, registrado como impedimento (fluxo alternativo previsto no PRD §7.2).
- **Documento de contrato cancelado**: `docstatus == 2` não dispara a geração — comportamento atual preservado.

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | Convergência da estrutura (passos 1-2) | `converger_doctypes_do_app`, `doctype/<14>/`, `patches.txt` |
| US-02 | Regras migradas (metragem e documento) | `imovel/service.py`, `contrato_pdf/service.py`, `hooks.py` |
| US-03 | Convergência (passo 3) | `descartar_cadastros_sem_uso` |
| US-04 | Endpoint migrado | `hooks.py` (`override_whitelisted_methods`), 4 módulos de domínio |
| US-05 | Remoção do ambiente obsoleto (operacional) | `deploy/compose/`, medição de disco |
| US-06 | Subida da stack nova com banco vazio | `deploy/compose/docker-compose.stack-nova.yaml` |
| US-07 | Instalação das rotinas | `deploy/cron/`, `deploy/bin/`, `deploy/instalar-cron.sh` |
| US-08 | Todos os fluxos, na vertente de não-regressão | Suíte completa + caracterizações |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| Lista de descarte é fechada e literal | `descartar_cadastros_sem_uso` | Cadastro fora da lista nunca é tocado, mesmo que pareça órfão |
| Cadastro com vínculo estrutural não é descartável | Verificação prévia ao patch (RN-02) | Aborta o descarte daquele cadastro e registra |
| Convergência só sobre os 14 declarados | `converger_doctypes_do_app` | Cadastro não declarado permanece intocado |
| Contrato cancelado não gera documento | `contrato_pdf.service` | Retorna sem efeito, preservando comportamento atual |

### 6.2 Transformações de Dados

A definição de cada cadastro é extraída do ambiente atual e curada antes de virar arquivo: remove-se ruído de instância (timestamps de modificação, contadores) preservando integralmente ordem de campos, tipos, opções e vínculos. O conteúdo dos registros **não** é transformado — a migração é de definição, não de dado. A única perda de dado é deliberada e restrita à lista de descarte (RN-03).

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RN-01 | RN-01 | Nenhuma regra ativa vive apenas no ambiente; ao fim, zero Server Scripts ativos | — (verificação, não erro de runtime) |
| RN-02 | RN-02 | Descarte exige as três ausências: código, aplicativo e vínculo estrutural | Cadastro preservado por precaução |
| RN-03 | RN-03 | Descartar cadastro sem uso descarta seus registros, deliberadamente | — |
| RN-04 | RN-04 | Os 4 nomes curtos são preservados por alias; lista fechada. Endpoint novo nasce com path completo | — |
| RN-05 | RN-05 | Reaplicar a estrutura é no-op observável: não duplica nem altera dado | Patch aborta na guard de idempotência |
| RN-06 | RN-06 | A stack nova não recebe operação real nesta versão | — |
| RN-07 | RN-07 | Instalar as rotinas duas vezes não duplica entrada | Instalador sobrescreve de forma determinística |
| RN-08 | RN-08 | Original só é desativada após equivalência comprovada; nunca as duas ativas | Migração da regra não conclui |
| RN-09 | — | Server Script desativado é código morto e sai do ambiente. Os 19 hoje inativos são removidos em bloco, com inventário (nome + tipo) registrado antes | — (regra técnica derivada da RN-01) |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

Relacional — MariaDB, acessado exclusivamente pela camada de dados do framework. Nenhum SQL cru é introduzido por esta versão.

### 7.2 Tabelas / Coleções

Nenhuma tabela nova. As tabelas dos 14 cadastros preservados **permanecem com o mesmo esquema** — muda a origem da definição (arquivo em vez de estado do banco), não a forma.

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|------|------------------|-------|-------------|---------|
| Tabelas dos 14 cadastros preservados | Inalteradas | Inalterados | Inalteradas | Inalterados |
| Tabelas dos 5 cadastros descartados | Removidas com o cadastro | — | — | — |

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| v1_1 | `patches/v1_1/converger_doctypes_do_app.py` | up — converge `custom` e módulo dos 14 (pre_model_sync) |
| v1_1 | `patches/v1_1/descartar_cadastros_sem_uso.py` | up — remove 5 sem uso + 2 órfãos e seus registros (post_model_sync) |

Sem `down`: o framework não executa patches reversos. A reversão é o backup diário verificado, registrado como pré-condição operacional (§20).

**Os dois caminhos são distintos e a spec não pode confundi-los** (verificado em `frappe/installer.py:307` → `set_all_patches_as_completed`, e documentado no `hooks.py` do app a partir da experiência da TC-001):

| Caminho | O que acontece com os patches | O que cria a estrutura |
|---|---|---|
| **Site novo** (`install-app`) | Ambos entram no `Patch Log` **sem executar** — o framework marca todo patch do app como concluído na instalação | O model sync, lendo os `.json` do app diretamente. Os patches seriam inócuos aqui de qualquer forma: não há `custom=1` para converger nem órfão para descartar |
| **Site existente** (`bench migrate`) | Ambos executam, por ainda não estarem no `Patch Log` | O patch de convergência, seguido do model sync |

Consequência para os testes: o `CT-028` (reconstrução em ambiente vazio) **não deve** afirmar que os patches executaram — deve afirmar que a estrutura existe. Escrever o caso esperando execução de patch em site novo produziria falha legítima interpretada como defeito.

**Limitação conhecida da convergência**: por viver em `patches.txt`, ela roda **uma vez**. Se um cadastro voltar a `custom=1` por edição na interface administrativa, o patch não o corrige — diferente do papel de serviço da ADR-0003, que usa `after_migrate` justamente para reimpor a cada migração. Aceito nesta versão: reverter um cadastro para `custom=1` exige ação deliberada no Desk, e a v2 traz governança de acesso que reduz quem pode fazê-lo.

### 7.4 Estratégia de Transação e Consistência

Cada patch roda dentro do ciclo transacional do `bench migrate`. **Granularidade adotada: um patch por responsabilidade** (convergência, descarte), não um por cadastro — decisão do arquiteto sobre o ponto deixado aberto no tech alignment. Razão: espelha o precedente da migração da configuração bancária, mantém o número de arquivos proporcional às decisões e não ao inventário, e concentra a guard de idempotência em dois lugares auditáveis. A rastreabilidade de falha por cadastro é preservada pelo log de cada patch, que nomeia o cadastro em processamento.

Ordem imposta e não negociável: convergência (pre) → model sync → descarte (post). Descartar antes de convergir deixaria o conjunto num estado que nenhuma reconstrução reproduz.

### 7.5 Política de Retenção / Archival

Sem TTL nem soft delete. O descarte é físico e deliberado (RN-03). Retenção dos registros de execução das rotinas: `logrotate`, definido em §13.

---

## 8. Integração com APIs Externas

N/A — esta versão não altera nenhuma integração externa. O adaptador de provedor bancário (ADR-0001) permanece intocado; `Cobranca Integracao Sicoob` está entre os cadastros **preservados** justamente por sustentar essa integração, com 643 registros vivos consumidos por três módulos.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

N/A — sem mensageria. As rotinas são disparadas pelo agendador do sistema operacional (decisão 26 do plano, mantida por ADR-0005).

### 9.2 Idempotência

Três pontos de idempotência, todos verificáveis:
- **Patches**: guard no início de cada `execute()`; reaplicação é no-op observável (CA-02, RN-05).
- **Instalador de rotinas**: escrita determinística do arquivo de agendamento; execução repetida produz o mesmo estado, sem duplicar entrada (CA-09, RN-07).
- **Rotina de maior frequência**: trava de arquivo no script impede execução sobreposta; a execução que encontra a trava ocupada é descartada, não enfileirada.

### 9.3 Outbox / Saga

N/A — não há consistência distribuída nesta versão.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

Inalterado — os 4 endpoints migrados preservam o mapeamento atual, e qualquer divergência é falha de equivalência (RN-08).

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Credencial inválida | 401 | Do framework | Autenticação |
| Endpoint fora da allowlist | 403 | Do proxy, sem chegar ao backend | Barreira de rede (TC-001) |
| Permissão negada | 403 | Do framework | Autorização |
| Falha de validação de payload | 417 | Do framework | Serviço de domínio |

### 10.2 Resiliência

Falha em patch aborta o `bench migrate` inteiro, deixando o ambiente no estado anterior — comportamento desejado: convergência parcial é pior que nenhuma. A geração do documento de contrato preserva o tratamento defensivo atual (a regra original captura exceção por etapa e não impede a gravação do documento); replicar esse comportamento é requisito de equivalência, não escolha nova.

### 10.3 Estratégia de Logging de Erros

Cada patch registra, por cadastro, o que converteu ou descartou. Falha nomeia o cadastro em processamento. Nenhum log desta versão emite conteúdo de registro — apenas identificadores de estrutura, o que elimina exposição de dado pessoal nos registros de migração.

---

## 11. Segurança

### 11.1 Autenticação

Inalterada. O usuário de serviço criado pela TC-001 continua sendo a identidade das chamadas do aplicativo. Sessão real de usuário é escopo da v2.

### 11.2 Autorização

Governada por `Custom DocPerm` sobre o papel de serviço (**ADR-0003**), reimposta a cada `bench migrate` pelo `after_migrate` já registrado. **Ponto de atenção**: os 9 DocTypes de negócio regidos pela ADR-0003 estão entre os que mudam de `custom=1` para `custom=0`. A convergência não pode invalidar os `Custom DocPerm` existentes — verificar após a convergência que o papel segue com 1 Role e 9 Custom DocPerm é requisito, não cortesia.

### 11.3 Criptografia

N/A para esta versão — nenhum dado novo em repouso, nenhum canal novo. A `encryption_key` do ambiente novo é gerada por ele e não é compartilhada com o ambiente atual.

### 11.4 Sanitização e Validação

Nenhuma entrada externa nova é processada. Os patches operam sobre lista literal declarada em código, não sobre entrada dinâmica — não há superfície de injeção introduzida.

### 11.5 Rate Limiting / Anti-abuse

Inalterado. A ausência de `limit_req` nos endpoints `allow_guest` permanece como débito registrado na TC-001 (D1), remetido a versão futura. Esta versão não o resolve nem o agrava.

### 11.6 Secrets Management

**Condição de entrada do ADR-0005**: nenhum script entra no repositório carregando credencial. O script de backup contém hoje a senha do banco em texto plano; a extração dela para configuração não versionada é pré-requisito para que ele seja versionado, não ajuste posterior. O `.gitignore` do projeto já cobre os padrões relevantes (`secrets/`, `.env*`, `*.key`).

---

## 12. Performance

### 12.1 Metas

- Latência p95 / p99: **inalteradas** — nenhuma meta nova. A migração de regra preserva comportamento, incluindo custo.
- Throughput esperado: inalterado.
- Janela de `bench migrate`: os dois patches operam sobre 21 definições e um volume de dados pequeno (dezenas de registros por cadastro). Tempo esperado desprezível.

### 12.2 Estratégias

Nenhuma otimização é introduzida — seria mudança de comportamento fora do escopo. A regra de agregação de metragem migra como está.

### 12.3 Limites Conhecidos

- **Disco**: 5,9 GB livres com 79% de uso. É o limite que condiciona a subida da stack nova, e a medição pós-remoção do ambiente obsoleto é o que libera ou bloqueia o CA-08.
- **Rotina de maior frequência**: 1440 execuções/dia. A trava resolve sobreposição, mas a cadência em si permanece — revisá-la está registrado como observação fora de escopo.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| Convergência de cadastro | info | nome do cadastro, flag anterior, flag final | sem dado de registro |
| Descarte de cadastro | warn | nome do cadastro, contagem de registros removidos | sem conteúdo de registro |
| Guard de idempotência acionada | info | patch, motivo | — |
| Falha de equivalência em regra migrada | error | regra, caso divergente | sem conteúdo de documento |

Formato: o padrão do framework (`frappe.logger`), sem introduzir biblioteca nova.

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---------|------|--------|----------|
| — | — | — | — |

N/A — o projeto não tem coletor de métricas, e introduzir um está fora do escopo desta versão.

### 13.3 Tracing

N/A — sem tracing distribuído no projeto.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| Rotina agendada falhou | Saída não-zero registrada | alto | Registro em `/var/log`, inspeção manual |

Alertas ativos são escopo de versão posterior (F7 do plano). Esta versão organiza a saída para que o alerta futuro tenha onde ler.

**Retenção (decisão desta spec)**: destino único em `/var/log`, com os scripts deixando de escrever no diretório do projeto. O redirecionamento do agendador passa a ser a única saída, e a rotação é feita pelo `logrotate` do sistema, com a política versionada em `deploy/cron/logrotate-locacao.conf`. Resolve a duplicação atual (três arquivos vazios em `/var/log` enquanto o conteúdo real cresce em outro lugar) e o crescimento sem limite.

---

## 14. Feature Flags

### 14.1 Solução

N/A — o projeto não usa feature flags, e esta versão não introduz comportamento que se beneficie de ativação gradual. A convivência entre regra original e migrada é resolvida por ordem (RN-08), não por flag.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

---

## 15. Versionamento de API

### 15.1 Estratégia

Sem versionamento de API nesta versão. Os 4 endpoints preservam nome e contrato (**ADR-0004**), o que é precisamente a decisão de **não** versionar: introduzir versão exigiria alterar o aplicativo, explicitamente fora do escopo.

### 15.2 Compatibilidade

Compatibilidade total e verificável: o aplicativo publicado hoje deve funcionar sem alteração alguma após a migração (CA-06). Qualquer quebra é falha, não breaking change planejado.

### 15.3 Schemas / Contratos

Não há registry nem validação de contrato em CI. Formalizar isso é escopo do handoff das versões seguintes.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD. O ciclo é: alteração no repositório → `bench migrate` no ambiente → suíte. Esta versão **melhora** esse ciclo ao tornar a estrutura reconstruível, mas não introduz pipeline — seria escopo novo.

### 16.2 Empacotamento

A stack nova sobe como projeto Compose próprio, com nome de projeto, portas e volumes distintos dos atuais, a partir de `deploy/compose/docker-compose.stack-nova.yaml`. Reusa as mesmas imagens em uso hoje — nenhuma imagem nova é introduzida.

### 16.3 Infraestrutura como Código

O arquivo de Compose e o instalador de rotinas são os artefatos de infraestrutura versionados. Não há Terraform/Helm no projeto, e introduzir seria over-engineering para um host único.

### 16.4 Estratégia de Rollout

**A stack nova não recebe operação real nesta versão** (RN-06). Sobe com **banco vazio**, recebendo a estrutura inteira do repositório — é o que torna o CA-01 verificável de fato. A carga de dados e a virada são escopo posterior à v2.

Isolamento obrigatório: portas próprias não expostas ao proxy do aplicativo, e o proxy da TC-001 continua apontando exclusivamente para o ambiente atual. A stack nova não deve ser alcançável pelo aplicativo publicado.

### 16.5 Escalabilidade

N/A — host único, dois ambientes coexistindo temporariamente. O limite é disco, não capacidade de processamento (12 vCPU, 31 GB RAM).

### 16.6 Rollback

- **Estrutura**: backup diário verificado antes de aplicar os patches. Não há patch reverso.
- **Regras migradas**: o Server Script original permanece registrado (apenas desativado) até a versão seguinte, permitindo reativação imediata.
- **Rotinas**: o arquivo de agendamento anterior é preservado como cópia antes da primeira instalação.
- **Stack nova**: derrubar o projeto Compose não afeta o ambiente atual — isolamento é a garantia de rollback.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | 14 definições em arquivo + convergência do flag `custom` em `[pre_model_sync]`; model sync assume o arquivo como fonte | §3.5, §5.1, §7.3 |
| US-02 | 2 regras de evento em `doc_events` + 4 funções `@frappe.whitelist()` nos módulos de domínio | §3.2, §5.1, §6.3 |
| US-03 | Patch de descarte com lista literal fechada, em `[post_model_sync]`, após convergência verificada | §6.1, §7.3, §7.4 |
| US-04 | `override_whitelisted_methods` mapeando os 4 nomes curtos para as funções migradas (ADR-0004) | §4.1, §15.1 |
| US-05 | Remoção do ambiente obsoleto com medição de disco antes e depois | §12.3, §16 |
| US-06 | Projeto Compose isolado com banco vazio e estrutura vinda do repositório | §16.2, §16.4 |
| US-07 | `deploy/cron/` + `deploy/bin/` + instalador idempotente + política de retenção (ADR-0005) | §9.2, §13, §16.3 |
| US-08 | Caracterizações como rede de regressão + suíte completa no ambiente novo (ADR-0006) | §19 |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | Frappe / ERPNext | v15 (em uso) | Base do sistema — nenhuma mudança de versão |
| ORM | Camada de dados do Frappe | — | Já em uso; nenhum acesso direto ao banco é introduzido |
| Banco | MariaDB | 10.6 (em uso) | Inalterado |
| Orquestração | Docker Compose | em uso | Stack nova reusa as imagens atuais |
| Agendamento | Agendador do sistema operacional | — | Mantido por decisão prévia; passa a ser versionado (ADR-0005) |
| Retenção de log | `logrotate` do sistema | — | Já presente no host; evita implementar rotação própria |

**Nenhuma dependência nova é introduzida.** Todo mecanismo usado já existe no projeto ou no host.

---

## 19. Estratégia de Testes

> **Resumo**: 29 casos de teste | Unitários: 5 | Integração: 19 | E2E: 2 | Segurança: 3
> **Padrão**: `FrappeTestCase` (transação com rollback por teste), executado por `bench --site <ambiente> run-tests --app locacao_automation`. Gerado pelo `agent-spec-qa-test-generator` com os 7 gates da doutrina aplicados.

### 19.1 Testes Unitários

Sem I/O — agregação pura, resolução de alias e conferência do registro de patches.

| CT | Título | Categoria | Arquivo | Fronteira real |
|----|--------|-----------|---------|----------------|
| `CT-011` | patches.txt registra convergência em pre_model_sync e descarte em post_model_sync | integridade_dados | `test_patch_converger_doctypes.py` | filesystem |
| `CT-012` | calcular_metragem_total soma corretamente a metragem dos cômodos filhos | caminho_feliz | `test_caracterizacao_metragem.py` | none |
| `CT-013` | Metragem trata Imovel sem cômodos ou com metragem nula sem quebrar | fronteira | `test_caracterizacao_metragem.py` | none |
| `CT-019` | Os 4 nomes curtos resolvem para função existente via override_whitelisted_methods | caminho_feliz | `test_endpoints_migrados.py` | none |
| `CT-020` | Alias apontando para função renomeada/inexistente é detectado, não falha silenciosamente | tratamento_erro | `test_endpoints_migrados.py` | none |

### 19.2 Testes de Integração

Fronteira real de banco. Os casos marcados como segurança verificam a invariante da **ADR-0003** durante a convergência.

| CT | Título | Categoria | Arquivo | Fronteira real |
|----|--------|-----------|---------|----------------|
| `CT-001` | Convergência zera custom e ajusta módulo dos 14 cadastros preservados | integridade_dados | `test_patch_converger_doctypes.py` | db |
| `CT-002` | Convergência reexecutada é no-op observável | integridade_dados | `test_patch_converger_doctypes.py` | db |
| `CT-003` | Convergência não altera DocType fora da lista dos 14 | fronteira | `test_patch_converger_doctypes.py` | db |
| `CT-004` | Convergência não invalida os Custom DocPerm do papel Servico App (ADR-0003) | seguranca | `test_patch_converger_doctypes.py` | db |
| `CT-005` | DocType preservado fora dos 9 de negócio não ganha Custom DocPerm por efeito da convergência | seguranca | `test_patch_converger_doctypes.py` | db |
| `CT-006` | Descarte remove os 5 cadastros sem uso e seus registros | integridade_dados | `test_patch_descarte.py` | db |
| `CT-007` | Fiadores e Fiador (vazios, vínculo estrutural) sobrevivem ao descarte | integridade_dados | `test_patch_descarte.py` | db |
| `CT-008` | Descarte remove os 2 órfãos custom=0 (INATIVO, INATIVO_2) | integridade_dados | `test_patch_descarte.py` | db |
| `CT-009` | DocType custom=0 legítimo fora da lista de órfãos não é removido | fronteira | `test_patch_descarte.py` | db |
| `CT-010` | Descarte reexecutado é no-op observável | integridade_dados | `test_patch_descarte.py` | db |
| `CT-014` | Regra de metragem migrada reproduz o valor de referência capturado antes da migração | integracao | `test_caracterizacao_metragem.py` | db |
| `CT-015` | Documento de contrato migrado reproduz o texto de referência capturado antes da migração | integracao | `test_caracterizacao_documento_contrato.py` | filesystem |
| `CT-017` | on_update (documento) e on_submit (ativação) coexistem sem conflito na submissão do contrato | integracao | `test_caracterizacao_documento_contrato.py` | db |
| `CT-021` | all_imoveis retorna lista de imóveis por conjunto no mesmo formato de resposta anterior | caminho_feliz | `test_imovel_api.py` | db |
| `CT-022` | auth_locacao_imoveis autentica credencial válida e retorna sessão | caminho_feliz | `test_usuario_app_api.py` | db |
| `CT-023` | Credencial inválida em auth_locacao_imoveis retorna 401 sem revelar existência do email | seguranca | `test_usuario_app_api.py` | db |
| `CT-024` | atualizar_comodo persiste alteração e retorna confirmação | caminho_feliz | `test_imovel_api.py` | db |
| `CT-026` | automacao_cobranca_config_api preserva leitura e escrita da configuração vigente | integracao | `test_cobranca_automation_config_api.py` | db |
| `CT-027` | Ao final, nenhum Server Script das 6 regras migradas permanece ativo | integridade_dados | `test_server_scripts_desativados.py` | db |

### 19.3 Testes E2E

Exigem ambiente destrutível — só executáveis no ambiente novo, conforme **ADR-0006**.

| CT | Título | Categoria | Arquivo | Fronteira real |
|----|--------|-----------|---------|----------------|
| `CT-028` | Ambiente novo com banco vazio reconstrói a fundação completa a partir do repositório | caminho_feliz | `test_reconstrucao_ambiente.py` | db |
| `CT-029` | Reaplicar a migração no ambiente novo já estruturado é no-op | integridade_dados | `test_reconstrucao_ambiente.py` | db |

### 19.4 Cenários de Erro e Companheiros Negativos

Cada caso positivo tem companheiro negativo declarado; os listados abaixo são os que verificam explicitamente caminho de falha.

| CT | Título | Categoria | Arquivo | Fronteira real |
|----|--------|-----------|---------|----------------|
| `CT-016` | Contrato cancelado (docstatus=2) não gera documento | tratamento_erro | `test_caracterizacao_documento_contrato.py` | db |
| `CT-018` | Falha na renderização do PDF não impede a gravação do documento pai | tratamento_erro | `test_caracterizacao_documento_contrato.py` | db |
| `CT-020` | Alias apontando para função renomeada/inexistente é detectado, não falha silenciosamente | tratamento_erro | `test_endpoints_migrados.py` | none |
| `CT-025` | atualizar_comodo com payload inválido retorna 417 | tratamento_erro | `test_imovel_api.py` | db |

### 19.5 Rastreabilidade CA → CT

| Critério de Aceite (PRD) | Casos de Teste |
|--------------------------|----------------|
| CA-01 | `CT-001`, `CT-003`, `CT-011`, `CT-028` |
| CA-02 | `CT-002`, `CT-010`, `CT-029` |
| CA-03 | `CT-004`, `CT-005`, `CT-027` |
| CA-04 | `CT-012`, `CT-013`, `CT-014`, `CT-015`, `CT-016`, `CT-017`, `CT-018`, `CT-027` |
| CA-05 | `CT-006`, `CT-007`, `CT-008`, `CT-009` |
| CA-06 | `CT-019`, `CT-020`, `CT-021`, `CT-022`, `CT-023`, `CT-024`, `CT-025`, `CT-026` |
| CA-07 | — (verificação operacional, ver 19.6) |
| CA-08 | — (verificação operacional, ver 19.6) |
| CA-09 | — (verificação operacional, ver 19.6) |
| CA-10 | — (verificação operacional, ver 19.6) |
| CA-11 | `CT-017`, `CT-024`, `CT-026` |

### 19.6 Fronteira de Automação

Nem todo critério é verificável por suíte. Os abaixo são **verificações operacionais** com evidência registrada na execução — fabricar teste automatizado para eles provaria menos do que afirmam:

- **CA-07** — Verificação operacional de infraestrutura de host, não testável por `bench run-tests`. Comando exato: medir com `df -h /` (ou `du -sh <dir-homologacao-obsoleta>`) antes de remover o ambiente, remover, medir novamente com `df -h /` e comparar a folga com o mínimo necessário para dois ambientes (tech_spec §12.3: partindo de 5,9 GB livres / 79% de uso).
- **CA-08** — Verificação operacional de isolamento de rede/portas, não testável por `bench run-tests` (que roda dentro de um dos ambientes, não entre eles). Comando exato: `docker compose -f deploy/compose/docker-compose.stack-nova.yaml ps` (portas não expostas ao proxy do aplicativo) + inspeção de `deploy/nginx/react-default.conf` confirmando que o proxy aponta exclusivamente para o ambiente atual + `curl` a partir de fora do host contra a porta da stack nova esperando falha de conexão.
- **CA-09/CA-10** — `deploy/instalar-cron.sh` e `/etc/cron.d` estão fora do escopo de `bench --site frontend run-tests --app locacao_automation` (suíte Python/FrappeTestCase, não shell). Comando exato: rodar `deploy/instalar-cron.sh` duas vezes seguidas, `diff` o conteúdo de `/etc/cron.d/locacao-automation` entre a 1ª e a 2ª execução (deve ser idêntico, sem linha duplicada), e comparar linha a linha com `deploy/cron/locacao-automation.cron` do repositório (mesmo horário e destino) via `diff /etc/cron.d/locacao-automation deploy/cron/locacao-automation.cron`.

**CA-11** (não-regressão percebida) não tem CT dedicado por decisão deliberada de não duplicar cenário entre camadas: é satisfeito pela combinação das equivalências (`CT-014`, `CT-015`) com a preservação de contrato dos endpoints (`CT-021` a `CT-026`).

**Correção aplicada sobre a saída do gerador**: o `CT-010` declarava validar `CA-09`, mas ele verifica a idempotência do **patch de descarte**, não a do **instalador de rotinas** — são idempotências de sistemas distintos, e o próprio gerador listou CA-09 entre os não cobertos na mesma resposta. O mapeamento falso foi removido: CA-09 é verificação operacional. O JSON em `_run/test-cases.json` preserva a saída original íntegra; esta seção é a canônica.

**Alerta herdado do gerador**: os casos de descarte (`CT-006` a `CT-010`) e os E2E (`CT-028`, `CT-029`) exigem remoção real de estrutura. Enquanto a suíte rodar contra o ambiente que atende a operação, eles são a maior fonte de risco do repositório — motivo pelo qual a **ADR-0006** condiciona sua execução ao ambiente novo.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| A convergência de `custom=1` para `custom=0` invalidar os `Custom DocPerm` do papel de serviço (ADR-0003), derrubando o acesso do aplicativo | Média | **Alto** — aplicativo fora do ar | Verificar 1 Role + 9 Custom DocPerm após a convergência; o `after_migrate` reimpõe, mas a verificação é requisito explícito (§11.2) |
| A definição exportada carregar ruído de instância e divergir do ambiente | Média | Médio | Curadoria antes de versionar; a prova é a reconstrução em ambiente vazio (CA-01) |
| A regra do documento de contrato não reproduzir o artefato por diferença sutil de montagem | Média | Médio | Caracterização por texto extraído, capturada antes da migração; regra original permanece ativa até a equivalência passar (RN-08) |
| O alias dos endpoints resolver para função inexistente após renomeação futura, quebrando o aplicativo sem erro de build | Média | Alto | Teste que verifica que cada nome curto resolve para função existente e chamável — risco herdado da ADR-0004, registrado lá |
| Folga de disco insuficiente para os dois ambientes | Média | Médio | Medição antes e depois; fluxo alternativo previsto bloqueia a subida em vez de forçar |
| Descartar cadastro que revele uso depois do descarte | Baixa | **Alto** — perda de dado irreversível | Lista literal fechada; verificação das três ausências (RN-02); backup verificado antes do `migrate` |
| Perda de ordem entre a regra migrada (`on_update`) e a de ativação já existente (`on_submit`) no ciclo do contrato | Média | Médio | A ordem observável atual é requisito de equivalência; caracterização cobre o cenário de submissão |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

| ADR | Classificação | Onde se aplica e como é obedecida |
|-----|---------------|-----------------------------------|
| **ADR-0001** — Modelo canônico de cobrança com adaptador por provedor | **PARCIAL** | §8 e §3.5. A decisão diz que a operação de cobrança trafega em tipos canônicos agnósticos de provedor. Esta spec **não altera** nenhum adaptador; preserva `Cobranca Integracao Sicoob` entre os cadastros versionados justamente porque sustenta o adaptador vivo, e descarta `Configuracao Integracao Sicoob`, que a ADR já superou pela configuração canônica. |
| **ADR-0002** — Versionar estrutura de dados do app em arquivo | **APLICÁVEL** | §3.5, §5.1 e §7.3. A `Decision` determina que toda estrutura de dados nasce descrita em arquivo no repositório: esta spec converte os 14 cadastros preservados para `doctype/<snake>/<snake>.json` no módulo do app, o mesmo formato dos dois já versionados, e a convergência do flag `custom` é o mecanismo que faz o arquivo virar a fonte. |
| **ADR-0003** — `Custom DocPerm` como fonte única de permissão dos DocTypes de negócio | **APLICÁVEL** | §11.2. Os 9 DocTypes de negócio regidos pela ADR estão entre os convergidos. A spec não altera a governança de permissão e trata como requisito verificar, após a convergência, que o papel de serviço permanece com 1 Role e 9 `Custom DocPerm` — a reimposição pelo `after_migrate` já registrado é o mecanismo, e a verificação é explícita para não depender dele em silêncio. |
| **ADR-0004** — Endpoints herdados preservam o nome curto | **APLICÁVEL** | §4.1, §15.1 e §3.6. A `Decision` fixa que os quatro endpoints herdados preservam os nomes curtos por aliases explícitos e que a lista é fechada nesses quatro. A spec registra os aliases em `hooks.py` via `override_whitelisted_methods`, não cria endpoint novo, e mantém a allowlist do nginx intocada — exatamente o efeito pretendido pela ADR. |
| **ADR-0005** — Rotinas operacionais versionadas com instalação idempotente | **APLICÁVEL** | §11.6, §13 e §16.3. A `Decision` exige que definição e scripts vivam no repositório, instalados por procedimento idempotente, e que **nenhum script entre carregando credencial**. A spec cria `deploy/cron/` e `deploy/bin/`, e registra a extração da credencial do script de backup como condição de entrada, não como ajuste posterior. |
| **ADR-0006** — Ambiente de verificação separado do que atende a operação | **APLICÁVEL** | §16.4 e §19. A `Decision` estabelece que a suíte nunca executa contra o ambiente que atende a operação, com o arranjo concreto variável. A spec faz a stack nova subir com banco vazio e assumir o papel de destino da suíte assim que responder. |

**Conformidade literal verificada**: nenhuma decisão desta spec diverge do texto da seção `Decision` de qualquer ADR ativa. Não há conflito spec×ADR nem ADR×ADR a escalar.

### Candidatos a ADR

**Candidato a ADR parcial** (levantado no challenge): *"Migração de regra do ambiente para código registra o alias antes de desativar a origem"*. Critérios: **C2** (tag `architecture`) ✔ · **C4** ✔ (a ordem é contraintuitiva — o instinto é desligar primeiro) · **C5** ✔ (a ordem inversa foi avaliada e rejeitada por abrir janela de indisponibilidade). **Falha C1** — restam apenas estas 6 regras a migrar, não é padrão recorrente do projeto. **Falha C3** — reverter é remover uma linha de configuração. Registrado aqui em vez de virar ADR.

Nenhum outro candidato novo confirmado. As duas decisões transversais que emergiram do tech alignment já foram registradas (ADR-0005 e ADR-0006) antes desta spec. As decisões técnicas restantes são **feature-scoped** — granularidade dos patches, alocação dos módulos de domínio, forma da caracterização — e falham no critério C1 (transversal): valem para esta migração, não para o projeto.

### Decisões do arquiteto sobre pontos deixados em aberto no tech alignment

1. **Granularidade dos patches**: um por responsabilidade, não por cadastro (§7.4).
2. **Alocação dos endpoints migrados**: cada um vai para o módulo do seu domínio, reusando três módulos existentes e criando apenas `imovel/`. Evita um módulo-guarda-chuva de API, que romperia o padrão modular do app.
3. **Forma da caracterização**: valor produzido para a regra de agregação; texto extraído do PDF para a que gera documento — nunca bytes.
4. **Ordem no ciclo do contrato**: a regra migrada entra em `on_update`, equivalente ao `After Save` do Server Script atual, preservando a coexistência com o `on_submit` já registrado.
5. **Destino e retenção dos registros de execução**: saída única em `/var/log` com `logrotate` versionado (§13).

### Terminologia

O glossário global (`docs/specs/domain-glossary.md`) define `Boleto em aberto`, `Provedor` e `Contador sequencial` — nenhum é redefinido por esta spec. Não há glossário-feature, e esta versão não introduz termo de domínio de negócio novo: os conceitos que ela manipula (cadastro, regra, rotina, ambiente) são de infraestrutura.

---

## 22. Checklist Final

- [x] Tech Spec cobre todo o PRD (US-01 a US-08 mapeadas em §5.3 e §17)
- [x] Arquitetura definida com componentes e fronteiras
- [x] Arquivos envolvidos listados (criar, modificar, referência)
- [x] Contratos de API definidos — preservados por ADR-0004
- [x] Persistência, migrações e estratégia de transação definidas
- [x] Segurança endereçada, incluindo o ponto de atenção da ADR-0003
- [x] Riscos técnicos identificados com mitigação
- [x] ADRs ativas inventariadas com conformidade literal verificada
- [x] Estratégia de testes integrada (§19 — 29 CTs delegados ao QA, com 1 mapeamento falso corrigido)
- [x] Pronto para geração do TASK PLAN
