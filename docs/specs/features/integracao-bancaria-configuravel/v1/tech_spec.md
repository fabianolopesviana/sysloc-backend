# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: Integração bancária configurável pelo frontend
- **Variante**: backend
- **Stack**: Python 3.10+ / Frappe Framework v15 (ERPNext), app custom `locacao_automation`
- **Autor**: neuberagil@icloud.com
- **Data**: 2026-07-20
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/integracao-bancaria-configuravel/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/integracao-bancaria-configuravel/v1/tech-alignment.md`

---

## 2. Resumo Técnico da Solução

Introduz a camada `cobranca_bancaria` — modelo canônico agnóstico de provedor, porta `AdaptadorCobrancaBancaria` e adaptador Sicoob — sobre a qual os cinco módulos de operação existentes passam a operar, conforme ADR-0001. A configuração (credenciais, endereços, certificado) migra de constante-em-código e arquivo montado no host para a DocType `Configuracao Integracao Bancaria`, **versionada em arquivo** no módulo `Locacao Automation` (ADR-0002), com o certificado guardado como File privado do Frappe e materializado em arquivo temporário `0600` apenas durante cada operação.

O corte é por **estrangulamento**: o adaptador nasce e as operações migram uma a uma na ordem `consultar → confirmar_baixa → solicitar_baixa → sincronizar → emitir`, preservando integralmente as assinaturas `@frappe.whitelist()` e as chaves de resposta hoje consumidas pelo cliente. A configuração legada permanece como fallback de leitura indefinidamente; o contador sequencial é a única exceção — migra em corte atômico com origem única, porque duas origens vivas produziriam `nosso_numero` duplicado.

Cinco novos métodos whitelisted expõem a configuração ao frontend (obter, salvar, enviar certificado, testar conexão, remover certificado), no shape `{success, message, …}` já dominante na família Sicoob, com auditoria dedicada e sanitizada das trocas.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                    ┌──────────────────────────────────────┐
   Frontend  ──────▶│ integracao_bancaria_api/service.py   │  (5 métodos whitelisted)
   (Fase 2)         └──────────────┬───────────────────────┘
                                   │
   Frontend  ──────▶┌──────────────▼───────────────────────┐
   (existente)      │ cobranca_sicoob/*.py                  │  assinaturas e respostas PRESERVADAS
                    │ emissao · consulta · baixa            │  (validação de negócio + persistência)
                    │ confirmacao_baixa · sincronizacao     │
                    └──────────────┬───────────────────────┘
                                   │ apenas tipos canônicos
                    ┌──────────────▼───────────────────────┐
                    │ cobranca_bancaria/                    │
                    │  modelo.py · porta.py · registry.py   │
                    │  configuracao.py · certificado.py     │
                    └──────────────┬───────────────────────┘
                                   │ AdaptadorCobrancaBancaria
                    ┌──────────────▼───────────────────────┐
                    │ adaptadores/sicoob/                   │
                    │  http · auth · mapeamento · adapter   │  ← único ponto que fala Sicoob
                    └──────────────┬───────────────────────┘
                                   │ mTLS (requests_pkcs12)
                                   ▼
                          API do provedor bancário
```

Fontes de dados: `Configuracao Integracao Bancaria` (canônica, versionada) com fallback de leitura para `Configuracao Integracao Sicoob` (legada); `Cobranca` (não alterada); `Cobranca Integracao Sicoob` (eventos, não alterada); `Auditoria Configuracao Bancaria` (nova).

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `cobranca_bancaria/modelo.py` | Dataclasses canônicas e enum `SituacaoBoleto` | Domínio |
| `cobranca_bancaria/porta.py` | Interface `AdaptadorCobrancaBancaria` (5 métodos) | Domínio (porta) |
| `cobranca_bancaria/registry.py` | Resolve `provedor` → classe de adaptador | Domínio |
| `cobranca_bancaria/configuracao.py` | Fonte única de resolução da config ativa + fallback legado | Aplicação |
| `cobranca_bancaria/certificado.py` | Metadados PKCS#12 e materialização temporária `0600` | Aplicação |
| `cobranca_bancaria/adaptadores/sicoob/http.py` | POST/GET mTLS, URL da config, headers, timeout | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/auth.py` | Token `client_credentials` | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/mapeamento.py` | Tradução bidirecional canônico ↔ Sicoob | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/adapter.py` | Implementa a porta | Infraestrutura |
| `integracao_bancaria_api/service.py` | 5 métodos whitelisted de configuração | Apresentação |
| `integracao_bancaria_api/auditoria.py` | Registro sanitizado de trocas | Aplicação |
| `integracao_bancaria_api/boletos_abertos.py` | Apuração (RN-02) e PDF consolidado | Aplicação |
| `cobranca_sicoob/*.py` | Validação de negócio e persistência (HTTP removido) | Aplicação |

### 3.3 Camadas e Fronteiras

**Hexagonal (ports & adapters)** aplicado à integração bancária, dentro de um app Frappe convencional.

- Direção das dependências: `cobranca_sicoob` → `cobranca_bancaria` (domínio) ← `adaptadores/sicoob` (infra). O domínio não importa nada de `adaptadores/`; a resolução é por `registry`.
- **Fronteira dura (ADR-0001)**: nenhum campo, URL ou vocabulário do provedor cruza a porta. Campos sem equivalente canônico trafegam em `parametros_provedor` (escape explícito), nunca como atributo do núcleo.
- `frappe.*` é permitido em `configuracao.py`, `certificado.py`, `integracao_bancaria_api/*` e `cobranca_sicoob/*`; **proibido** em `modelo.py`, `porta.py` e `mapeamento.py` (mantém o domínio e a tradução testáveis sem site).

### 3.4 Visão em Árvore

```
app-sync/locacao_automation/locacao_automation/
├── cobranca_bancaria/                                          [N]
│   ├── __init__.py                                             [N]
│   ├── modelo.py                                               [N]
│   ├── porta.py                                                [N]
│   ├── registry.py                                             [N]
│   ├── configuracao.py                                         [N]
│   ├── certificado.py                                          [N]
│   └── adaptadores/                                            [N]
│       ├── __init__.py                                         [N]
│       └── sicoob/                                             [N]
│           ├── __init__.py                                     [N]
│           ├── http.py                                         [N]
│           ├── auth.py                                         [N]
│           ├── mapeamento.py                                   [N]
│           └── adapter.py                                      [N]
├── integracao_bancaria_api/                                    [N]
│   ├── __init__.py                                             [N]
│   ├── service.py                                              [N]
│   ├── auditoria.py                                            [N]
│   └── boletos_abertos.py                                      [N]
├── locacao_automation/                                         [M]
│   └── doctype/                                                [N]
│       ├── configuracao_integracao_bancaria/                   [N]
│       │   ├── __init__.py                                     [N]
│       │   ├── configuracao_integracao_bancaria.json           [N]
│       │   └── configuracao_integracao_bancaria.py             [N]
│       └── auditoria_configuracao_bancaria/                    [N]
│           ├── __init__.py                                     [N]
│           ├── auditoria_configuracao_bancaria.json            [N]
│           └── auditoria_configuracao_bancaria.py              [N]
├── patches/                                                    [N]
│   ├── __init__.py                                             [N]
│   └── v1_0/                                                   [N]
│       ├── __init__.py                                         [N]
│       └── migrar_configuracao_integracao_bancaria.py          [N]
├── cobranca_sicoob/
│   ├── auth.py                                                 [M]
│   ├── emissao.py                                              [M]
│   ├── consulta.py                                             [M]
│   ├── baixa.py                                                [M]
│   ├── confirmacao_baixa.py                                    [M]
│   ├── sincronizacao.py                                        [M]
│   ├── sequencial.py                                           [M]
│   └── rotina_pagamentos.py                                    [R]
├── pdf_arquivo/service.py                                      [R]
├── cobranca_boleto/service.py                                  [R]
├── contrato_cancelamento/pdf_utils.py                          [R]
├── contrato_ativacao/service.py                                [R]
├── patches.txt                                                 [M]
└── tests/                                                      [N]
    ├── __init__.py                                             [N]
    ├── fixtures_certificado.py                                 [N]
    ├── test_modelo_canonico.py                                 [N]
    ├── test_certificado.py                                     [N]
    ├── test_configuracao.py                                    [N]
    ├── test_sequencial.py                                      [N]
    ├── test_integracao_bancaria_api.py                         [N]
    ├── test_boletos_abertos.py                                 [N]
    └── test_equivalencia_contrato.py                           [N]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `cobranca_bancaria/modelo.py` | `CredenciaisIntegracao`, `CertificadoDigital`, `ContaBancaria`, `Pagador`, `BoletoCanonico`, `ResultadoEmissao`, `ResultadoBaixa`, `ResultadoConsulta`, `ResultadoToken`, enum `SituacaoBoleto` | Domínio |
| `cobranca_bancaria/porta.py` | `AdaptadorCobrancaBancaria` (ABC) com `obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar` | Domínio |
| `cobranca_bancaria/registry.py` | `obter_adaptador(credenciais)`; erro explícito nomeando provedor desconhecido | Domínio |
| `cobranca_bancaria/configuracao.py` | `resolver_credenciais()` — canônica com fallback legado; validação de "exatamente uma ativa"; erro estruturado único | Aplicação |
| `cobranca_bancaria/certificado.py` | `ler_metadados_pfx(bytes, senha)`; `materializar_certificado(credenciais)` (context manager `0600`, remoção no `finally`) | Aplicação |
| `cobranca_bancaria/adaptadores/sicoob/http.py` | `post`/`get` via `requests_pkcs12`, URL de `api_base_url`, headers e timeout centralizados | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/auth.py` | Token `client_credentials` com `auth_url` da config | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/mapeamento.py` | `BoletoCanonico`→payload Sicoob; resposta Sicoob→resultados canônicos; mapa de situação; normalização de UF/documento | Infraestrutura |
| `cobranca_bancaria/adaptadores/sicoob/adapter.py` | `AdaptadorSicoob(AdaptadorCobrancaBancaria)` | Infraestrutura |
| `integracao_bancaria_api/service.py` | `obter_configuracao`, `salvar_configuracao`, `enviar_certificado`, `testar_conexao`, `remover_certificado`, `baixar_consolidado_boletos_abertos` | Apresentação |
| `integracao_bancaria_api/auditoria.py` | `registrar_alteracao(...)` sanitizado | Aplicação |
| `integracao_bancaria_api/boletos_abertos.py` | `listar_boletos_abertos()`, `montar_pdf_consolidado()` | Aplicação |
| `locacao_automation/doctype/configuracao_integracao_bancaria/*` | DocType canônica versionada (JSON + controller + `__init__`) | Persistência |
| `locacao_automation/doctype/auditoria_configuracao_bancaria/*` | DocType de auditoria versionada | Persistência |
| `patches/v1_0/migrar_configuracao_integracao_bancaria.py` | Patch idempotente: copia config legada + corte atômico do contador | Migração |
| `tests/*` | Suíte inicial do projeto (`FrappeTestCase`) — ver seção 19 | Testes |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `cobranca_sicoob/auth.py` | `obter_token_sicoob` delega ao adaptador; remove `_obter_configuracao_ativa` e `_obter_configuracao_token` | Fonte única de config; token via porta |
| `cobranca_sicoob/consulta.py` | Remove `SICOOB_BOLETOS_URL`, `pkcs12_get`, `_obter_configuracao_ativa`, extratores de JSON cru; consome `ResultadoConsulta` | 1ª operação do estrangulamento |
| `cobranca_sicoob/confirmacao_baixa.py` | Idem, via `confirmar_baixa` | 2ª operação |
| `cobranca_sicoob/baixa.py` | Idem, via `solicitar_baixa` | 3ª operação |
| `cobranca_sicoob/sincronizacao.py` | `_montar_updates` passa a operar sobre `ResultadoConsulta` canônico | 4ª operação |
| `cobranca_sicoob/emissao.py` | Remove montagem inline de payload e `pkcs12_post`; mantém `_validar_cobranca_e_locatario` e `salvar_pdf_privado` | 5ª e última operação |
| `cobranca_sicoob/sequencial.py` | `SELECT … FOR UPDATE` aponta para a DocType canônica | RN-03, corte atômico (D3) |
| `patches.txt` | Registra o patch em `[post_model_sync]` | Ordem: DocType sincronizada antes do patch |
| `locacao_automation/locacao_automation/` | Passa a hospedar `doctype/` | Módulo do app (ADR-0002) |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `pdf_arquivo/service.py` | Padrão de File privado (`salvar_pdf_privado` substitui anteriores; `obter_pdf_privado_bytes`) |
| `cobranca_boleto/service.py` | Padrão de entrega de PDF por `frappe.local.response` (`abrir_boleto`) |
| `contrato_cancelamento/pdf_utils.py` | Uso de `pypdf` (`PdfReader`/`PdfWriter`) para composição |
| `cobranca_sicoob/rotina_pagamentos.py` | Filtro canônico de boleto em aberto (RN-02) já em produção |
| `contrato_ativacao/service.py`, `contrato_cancelamento/service.py` | Consumidores externos de `emitir_boleto_sicoob` — imports não mudam |
| `docker-compose.override.yml` | Montagem `:ro` do certificado legado nos 4 serviços |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Frappe expõe métodos whitelisted por RPC em `/api/method/<dotted.path>`. Autenticação por sessão/cookie do Frappe; autorização por role.

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Obter configuração | GET | `/api/method/locacao_automation.integracao_bancaria_api.service.obter_configuracao` | — | `{success, message, configuracao{...}, certificado{...}}` | 200, 403, 417 | System Manager |
| Salvar configuração | POST | `…service.salvar_configuracao` | `{provedor, ambiente, auth_url, api_base_url, client_id, scope, numero_cliente, numero_conta_corrente, codigo_modalidade, parametros_provedor?, certificado_senha?}` | `{success, message, configuracao{...}}` | 200, 403, 417 | System Manager |
| Enviar certificado | POST | `…service.enviar_certificado` | `{arquivo_base64, nome_arquivo, senha}` | `{success, message, certificado{...}}` | 200, 403, 417 | System Manager |
| Testar conexão | POST | `…service.testar_conexao` | `{}` (usa config salva) | `{success, message, detalhes, expires_in, scope}` | 200, 403, 417 | System Manager |
| Remover certificado | POST | `…service.remover_certificado` | `{}` | `{success, message, certificado{presente: false}}` | 200, 403, 417 | System Manager |
| Baixar consolidado | GET | `…service.baixar_consolidado_boletos_abertos` | — | **stream PDF** (`frappe.local.response`) | 200, 403, 417 | System Manager |

> `baixar_consolidado_boletos_abertos` é o **único** método que entrega arquivo em vez de JSON. Streaming via `frappe.local.response` substitui a resposta estruturada (padrão de `cobranca_boleto/service.py:52-55`, que não possui `return`) — por isso não pode ser fundido a `salvar_configuracao`. Diferente de `abrir_boleto`, **não** é `allow_guest`: exige System Manager, porque expõe todos os boletos em aberto da carteira de uma vez.

**Preservados sem alteração** (contrato imutável, CA-17): `emitir_boleto_sicoob`, `consultar_boleto_sicoob`, `solicitar_baixa_boleto_sicoob`, `confirmar_baixa_boleto_sicoob`, `sincronizar_status_pagamento_sicoob`, `sincronizar_cobrancas_pendentes_vencidas_sicoob`, `abrir_boleto`.

### 4.1.1 Exemplo de Payload por Endpoint

`salvar_configuracao` é **atualização parcial** — campos ausentes permanecem inalterados.

```
POST /api/method/locacao_automation.integracao_bancaria_api.service.salvar_configuracao

Caso A — altera só a conta corrente:
  {"numero_conta_corrente": 222}

Caso B — altera só o endereço de comunicação (área avançada):
  {"api_base_url": "https://sandbox.sicoob.com.br/cobranca-bancaria/v3/boletos"}

Caso C — troca a senha do certificado sem reenviar o arquivo:
  {"certificado_senha": "nova-senha"}

Regra: campos não enviados permanecem inalterados. `certificado_senha` só é gravada
quando enviada NÃO-VAZIA — string vazia/ausente NUNCA apaga a senha existente.
Nenhum campo é obrigatório no corpo; a configuração ativa é resolvida pelo servidor.
```

`enviar_certificado` é **substituição total** — os três campos são obrigatórios; ausência de qualquer um recusa a operação.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `CredenciaisIntegracao` | `modelo.py` (dataclass) | `provedor`, `ambiente`, `auth_url`, `api_base_url`, `client_id`, `scope`, `certificado`, `conta`, `parametros_provedor` | v1 |
| `CertificadoDigital` | `modelo.py` | `conteudo`, `senha`, `titular_nome`, `titular_documento`, `validade_inicio`, `validade_fim`, `emissor`, `impressao_digital`, `origem` | v1 |
| `ContaBancaria` | `modelo.py` | `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade`, `extras` | v1 |
| `BoletoCanonico` | `modelo.py` | `valor`, `vencimento`, `seu_numero`, `instrucoes`, `pagador`, `parcela`, `aceite`, `juros`, `multa`, `protesto`, `negativacao`, `pix` | v1 |
| `ResultadoEmissao` | `modelo.py` | `nosso_numero`, `codigo_barras`, `linha_digitavel`, `qr_code_pix`, `pdf_base64`, `situacao`, `bruto` | v1 |
| `ResultadoConsulta` | `modelo.py` | `situacao`, `situacao_bruta`, `data_liquidacao`, `valor_pago`, `historico`, `bruto` | v1 |
| `ResultadoBaixa` / `ResultadoToken` | `modelo.py` | `aceita`/`access_token`, `expires_in`, `scope` | v1 |
| Bloco `certificado` (API) | `service.py` | `presente`, `titular_nome`, `titular_documento`, `emissor`, `valido_de`, `valido_ate`, `dias_para_vencer`, `origem` | v1 |

Não há OpenAPI/proto no projeto — o contrato é o dict Python retornado pelo método whitelisted.

### 4.3 Eventos Publicados / Consumidos

N/A — o projeto não usa mensageria. Rotinas periódicas são acionadas por cron no host via `bench execute`.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Envio de certificado** (`enviar_certificado`)
1. `service.enviar_certificado` valida role System Manager e presença dos três campos.
2. Decodifica `arquivo_base64`; valida faixa de tamanho.
3. `certificado.ler_metadados_pfx(bytes, senha)` → titular, documento, validade, emissor, impressão digital. Falha ⇒ erro de negócio, **nenhuma escrita**.
4. Grava File privado (`is_private=1`) anexado ao **registro pendente** (nunca ao ativo), substituindo o anterior do mesmo registro (padrão de `salvar_pdf_privado`). O certificado em vigor só é trocado na ativação.
5. Persiste os campos read-only derivados e a senha (campo `Password`).
6. `auditoria.registrar_alteracao` grava autor, data, ação e impressões digitais anterior/nova.
7. Retorna `{success: True, certificado: {...}}` — sem senha, sem bytes.

**Operação de cobrança** (padrão das cinco, ex.: `consultar_boleto_sicoob`)
1. Módulo de `cobranca_sicoob` valida a `Cobranca` (regras de negócio inalteradas).
2. `configuracao.resolver_credenciais()` → `CredenciaisIntegracao` (canônica ou legada).
3. Se `credenciais.certificado.validade_fim < hoje` ⇒ recusa (RN-07) **antes** de qualquer HTTP.
4. `registry.obter_adaptador(credenciais)` → `AdaptadorSicoob`.
5. `with certificado.materializar_certificado(credenciais) as caminho:` — arquivo `0600`.
6. `adaptador.obter_token()` e em seguida a operação (`consultar`, `emitir`, …). O `finally` remove o arquivo.
7. `mapeamento` converte a resposta em resultado canônico.
8. O módulo persiste a partir do canônico, registra o evento e devolve o dict no shape atual.

**Troca de configuração com boletos em aberto** (`salvar_configuracao`)
1. Valida campos; monta a configuração pendente.
2. `boletos_abertos.listar_boletos_abertos()` (RN-02) → contagem.
3. Contagem > 0 e sem `decisao` no payload ⇒ retorna `{success: False, requer_decisao: True, total_abertos, opcoes: [...]}`.
4. Com `decisao`: `aceitar` prossegue; `nao_aceitar` cancela sem escrita. Para `aceitar_com_consolidado`, o cliente **primeiro** aciona `baixar_consolidado_boletos_abertos` (recebe o PDF por streaming) e **em seguida** chama `salvar_configuracao` com `decisao=aceitar` — a ordem garante que o gestor tenha os boletos em mãos antes de qualquer alteração.
5. `testar_conexao` precisa ter passado (RN-04) para a configuração ser ativada.
6. Auditoria registra a troca.

### 5.2 Fluxos Alternativos

- **Senha incorreta / PKCS#12 inválido / tamanho fora da faixa** ⇒ `{success: False, message}`; configuração intacta (CA-03).
- **Teste de conexão falha** ⇒ configuração nova não é ativada; a anterior segue em vigor (CA-07, RN-04).
- **Nenhum certificado enviado** ⇒ `resolver_credenciais` usa `pfx_path` legado montado em `/run/secrets/sicoob` (CA-16, RN-10).
- **Arquivo legado ausente e sem certificado enviado** ⇒ erro de negócio explícito, sem stacktrace.
- **Certificado vencido** ⇒ emissão recusada antes do HTTP (CA-15, RN-07).
- **Boletos em aberto sem PDF** ⇒ consolidado com os disponíveis + lista dos ausentes (CA-10, RN-09).
- **Nenhum boleto em aberto** ⇒ etapa de decisão dispensada.
- **Provedor desconhecido no registry** ⇒ erro explícito nomeando o provedor.
- **Zero ou mais de uma configuração ativa** ⇒ erro estruturado idêntico nos cinco pontos de consumo (RN-01).

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | `obter_configuracao` | `service`, `configuracao`, `certificado` |
| US-02 | `enviar_certificado` | `service`, `certificado`, File privado, `auditoria` |
| US-03 | `enviar_certificado` (resposta) | `certificado.ler_metadados_pfx` |
| US-04 | `salvar_configuracao` | `service`, DocType canônica |
| US-05 | `testar_conexao` | `service`, `registry`, `adapter.obter_token` |
| US-06 | `salvar_configuracao` (etapa de decisão) | `boletos_abertos.listar_boletos_abertos` |
| US-07 | `baixar_consolidado_boletos_abertos` (streaming), seguido de `salvar_configuracao` com `decisao=aceitar` | `boletos_abertos.montar_pdf_consolidado`, `frappe.local.response` |
| US-08 | `obter_configuracao` (bloco `certificado`) | `certificado`, cálculo de `dias_para_vencer` |
| US-09 | `remover_certificado` | `service`, File privado, `auditoria` |
| US-10 | `salvar_configuracao` (área avançada) | `service`, DocType canônica |
| US-11 | Efeito colateral de toda troca | `auditoria`, DocType de auditoria |
| US-12 | `emitir_boleto_sicoob` (guarda de validade) | `configuracao`, `emissao` |
| US-13 | Todas as operações durante a transição | `configuracao` (fallback legado) |
| US-14 | Todas as operações pós-refactor | `porta`, `registry`, `adaptadores/sicoob` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| Role System Manager | Todos os 5 métodos de configuração | `frappe.PermissionError` → 403, nenhum dado retornado |
| `arquivo_base64`, `nome_arquivo`, `senha` presentes | `enviar_certificado` | `{success: False, message}` |
| Conteúdo é PKCS#12 válido e abre com a senha | `certificado.ler_metadados_pfx` | `{success: False, message}`, nenhuma escrita |
| Tamanho do arquivo dentro da faixa | `enviar_certificado` | `{success: False, message}` |
| `auth_url` / `api_base_url` são URL absoluta `https` | `salvar_configuracao` | `{success: False, message}`, valor anterior preservado |
| `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade` inteiros positivos | `salvar_configuracao` | `{success: False, message}` |
| `parametros_provedor` é JSON válido | `salvar_configuracao` | `{success: False, message}` |
| `certificado_senha` só grava se não-vazia | `salvar_configuracao` | Campo ignorado (não apaga a existente) |
| Exatamente uma configuração ativa por provedor | `configuracao.resolver_credenciais` | Erro estruturado único (RN-01) |
| Certificado não vencido | Antes de qualquer operação de cobrança | `{success: False, message}` sem chamar o provedor |

### 6.2 Transformações de Dados

- **DocType → canônico**: `resolver_credenciais` lê a DocType, obtém a senha via `get_password`, resolve o certificado (File privado ou caminho legado) e devolve `CredenciaisIntegracao`. `origem` marca `upload` ou `legado`.
- **Canônico → Sicoob**: `mapeamento` traduz `BoletoCanonico` para `numeroCliente`, `codigoModalidade`, `numeroContaCorrente`, `codigoEspecieDocumento`, `identificacaoEmissaoBoleto`, `mensagensInstrucao`, `pagador{}`. Chaves de `parametros_provedor` são mescladas no payload sem passar pelo núcleo.
- **Sicoob → canônico**: `nossoNumero`, `linhaDigitavel`, `codigoBarras`, `qrCode`, `pdfBoleto` → `ResultadoEmissao`; `situacaoBoleto`/`situacao`/`statusBoleto` normalizado (NFKD, minúsculas) → `SituacaoBoleto`, com o texto cru preservado em `situacao_bruta`.
- **Normalização** de UF (2 letras maiúsculas) e documento (apenas dígitos) permanece no adaptador.
- **Certificado → metadados**: CN do titular; documento pelo padrão ICP-Brasil (`CN = "NOME:CPFCNPJ"` e/ou `otherName` OIDs `2.16.76.1.3.1` / `2.16.76.1.3.4`); `not_valid_before`/`not_valid_after`; emissor; impressão digital SHA-256.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RN-01 | RN-01 | No máximo uma configuração ativa por provedor; operação exige exatamente uma | `CONFIGURACAO_AUSENTE` / `CONFIGURACAO_DUPLICADA` |
| RN-02 | RN-02 | Boleto em aberto = `status_cobranca in ("Pendente","Vencida")` + `boleto_gerado=1` + `nosso_numero` preenchido | — |
| RN-03 | RN-03 | Contador único e contínuo; nunca reinicia na troca de conta; origem única após o corte | `SEQUENCIAL_LIMITE_EXCEDIDO` |
| RN-04 | RN-04 | Configuração só entra em vigor após teste de conexão bem-sucedido | `TESTE_CONEXAO_NAO_REALIZADO` |
| RN-05 | RN-05 | Certificado só aceito se abrir com a senha, for PKCS#12 e estiver na faixa de tamanho | `CERTIFICADO_INVALIDO` |
| RN-06 | RN-06 | Senha e conteúdo do certificado nunca em retorno, log ou registro | — (invariante de sanitização) |
| RN-07 | RN-07 | Certificado vencido recusa a emissão antes de qualquer comunicação | `CERTIFICADO_VENCIDO` |
| RN-08 | RN-08 | Troca com boletos em aberto exige decisão explícita entre três opções | `DECISAO_REQUERIDA` |
| RN-09 | RN-09 | Consolidado reúne os disponíveis e lista os ausentes | — |
| RN-10 | RN-10 | Sem certificado enviado, a credencial legada continua em uso | `CERTIFICADO_LEGADO_INDISPONIVEL` |
| RN-11 | RN-11 | Acesso restrito a perfil administrativo | `frappe.PermissionError` |
| RN-12 | RN-12 | Toda alteração registra autor, data e impressões digitais | — |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

MariaDB, acessado exclusivamente pela ORM/DB API do Frappe (`frappe.get_doc`, `frappe.get_all`, `frappe.db.*`). Site `frontend`, banco `_5e5899d8398b5f7b`.

### 7.2 Tabelas / Coleções

**`tabConfiguracao Integracao Bancaria`** (nova, DocType versionada em arquivo — ADR-0002)

| Campo | Tipo Frappe | Constraints | Observação |
|-------|-------------|-------------|------------|
| `provedor` | Select (`Sicoob`) | obrigatório | extensível |
| `ativo` | Check | — | unicidade por provedor validada no controller |
| `ambiente` | Select (`Producao`/`Homologacao`) | obrigatório | default `Producao` |
| `auth_url`, `api_base_url` | Data | obrigatórios | seed com os valores atuais |
| `client_id` | Data | obrigatório | mascarado na leitura pela API |
| `scope` | Small Text | — | |
| `certificado_arquivo` | Attach | — | File `is_private=1` |
| `certificado_senha` | Password | — | via `get_password` |
| `certificado_titular_nome` / `_documento` / `_emissor` / `_impressao_digital` | Data (read-only) | — | preenchidos no upload |
| `certificado_valido_de` / `_ate` | Date (read-only) | — | idem |
| `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade` | Int | > 0 | |
| `parametros_provedor` | Long Text | JSON válido | escape para provedores futuros |
| `ultimo_sequencial_seu_numero` | Data | 12 dígitos | migra do legado (Patch 2) |
| `pfx_path_legado` | Data (read-only) | — | fallback (RN-10) |
| `conexao_testada_em` | Datetime (read-only) | — | carimbo de aprovação (RN-04) |
| `conexao_testada_hash` | Data (read-only) | — | impressão dos campos no momento do teste |

Índices: `ativo` + `provedor` (busca da configuração ativa); `name` (PK do Frappe).

**Ciclo de vida e estado pendente (RN-04)** — resolvido no challenge; a versão anterior mencionava "configuração pendente" sem defini-la estruturalmente:

1. `salvar_configuracao` grava num registro **separado com `ativo=0`** (cria na primeira edição, atualiza nas seguintes) e **limpa** `conexao_testada_em`/`conexao_testada_hash`. A configuração em vigor permanece intocada.
2. `testar_conexao` opera sobre o registro pendente. Em caso de sucesso, grava `conexao_testada_em` e `conexao_testada_hash` (impressão dos campos que compõem a conexão: `auth_url`, `api_base_url`, `client_id`, `scope`, conta e impressão digital do certificado).
3. A ativação só ocorre se `conexao_testada_em` estiver preenchido **e** `conexao_testada_hash` corresponder ao estado atual dos campos — qualquer edição posterior invalida o carimbo e exige novo teste. Isso torna RN-04 uma trava estrutural, não uma convenção.
4. Na ativação: `ativo=1` no pendente e `ativo=0` no anterior, na mesma transação (preserva RN-01).

Decorrências que valem explicitar:

- **Criação do pendente**: nasce como cópia integral do registro ativo (incluindo `pfx_path_legado` e o vínculo do certificado atual). Assim, editar apenas a conta não perde a credencial em vigor, e o fallback legado (RN-10) continua resolvendo durante o teste.
- **`obter_configuracao`** devolve o registro **ativo** e, quando existe pendente, um bloco `pendente` com os campos divergentes e o estado do carimbo (`testado`/`nao_testado`) — para a tela distinguir "em vigor" de "em edição".
- **`remover_certificado`** atua sobre o pendente; remover o certificado em vigor exige ativar um pendente sem certificado, sujeito ao mesmo teste de conexão.
- **Descarte**: um pendente sem carimbo pode ser sobrescrito livremente por nova edição; não há acúmulo de rascunhos (no máximo um pendente por provedor).

**`tabAuditoria Configuracao Bancaria`** (nova)

| Campo | Tipo | Observação |
|-------|------|------------|
| `configuracao` | Link → Configuracao Integracao Bancaria | |
| `acao` | Select (`certificado_enviado`, `certificado_removido`, `configuracao_alterada`, `conexao_testada`, `configuracao_ativada`) | |
| `autor` | Data | `frappe.session.user` |
| `data_hora` | Datetime | |
| `impressao_digital_anterior` / `_nova` | Data | nunca senha, nunca bytes |
| `campos_alterados` | Long Text | lista de nomes de campo, **sem valores** |
| `resultado` | Select (`sucesso`, `falha`) | |
| `mensagem` | Small Text | mensagem de negócio sanitizada |

Índices: `configuracao` + `data_hora` (consulta cronológica).

**Não alteradas**: `tabCobranca`, `tabCobranca Integracao Sicoob`, `tabConfiguracao Integracao Sicoob` (preservada como fallback).

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| v1.0 | `locacao_automation/doctype/configuracao_integracao_bancaria/*.json` | up — DocType criada por `bench migrate` (sincronização de modelo) |
| v1.0 | `locacao_automation/doctype/auditoria_configuracao_bancaria/*.json` | up — idem |
| v1.0 | `patches/v1_0/migrar_configuracao_integracao_bancaria.py` | up — `[post_model_sync]`, idempotente |
| v1.1 | `patches/v1_0/cortar_contador_sequencial.py` | up — `[post_model_sync]`, idempotente, **acoplado ao deploy da emissão** |

**Patch 1 — cópia da configuração** (executa no primeiro deploy, junto da migração de `consultar`):
1. Se já existe configuração canônica ativa para `Sicoob`, encerra sem escrita.
2. Lê a configuração legada ativa; copia `client_id`, `token_url`→`auth_url`, `scope`, `numero_cliente_sicoob`→`numero_cliente`, `codigo_modalidade_sicoob`→`codigo_modalidade`, `numero_conta_corrente_sicoob`→`numero_conta_corrente`, `pfx_path`→`pfx_path_legado`, senha via `get_password`.
3. `api_base_url` recebe o valor da constante removida do código.
4. **NÃO copia o contador e NÃO desativa a configuração legada.**
5. Registra a migração na auditoria.

**Patch 2 — corte atômico do contador** (executa apenas no deploy em que `emissao.py` migra):
1. Se `ultimo_sequencial_seu_numero` da canônica já está preenchido, encerra sem escrita (idempotência).
2. Na mesma transação: copia `ultimo_sequencial_seu_numero` da legada para a canônica **e** marca a configuração legada como inativa — origem única a partir daquele instante.
3. Registra o corte na auditoria.

> **Por que dois patches e não um** (resolvido no challenge): desativar a legada no primeiro deploy quebraria as quatro operações ainda não migradas — cada uma resolve a configuração pela própria cópia de `_obter_configuracao_ativa`, que filtra `ativo=1` sobre a DocType legada (`cobranca_sicoob/emissao.py:189` e equivalentes). Zero configurações ativas ⇒ falha imediata em produção, violando CA-16. O contador só é consumido por `emissao.py`, então acoplar o corte ao deploy dela elimina a janela sem abrir mão de D2 nem de D3.

Ordem obrigatória: ambos em `[post_model_sync]`, para que as DocTypes existam antes dos patches. O Patch 2 só é registrado em `patches.txt` no commit que migra a emissão.

### 7.4 Estratégia de Transação e Consistência

- **Contador sequencial**: `SELECT … FOR UPDATE` sobre `tabConfiguracao Integracao Bancaria`, lock de linha mantido até o commit da emissão — comportamento idêntico ao atual, apenas com a tabela trocada. Isolamento `REPEATABLE READ` (default do MariaDB/InnoDB). Duas emissões concorrentes serializam; nenhuma repete valor (CT-014).
- **Corte do contador**: cópia + desativação do legado na mesma transação do patch. Não há fallback de leitura para o contador — exceção explícita ao fallback geral (D3).
- **Idempotência de escrita**: `enviar_certificado` substitui o File anterior; reenvio do mesmo arquivo é seguro.
- **Ativação de configuração**: `ativo=1` da nova e `ativo=0` da anterior na mesma transação, preservando RN-01.

### 7.5 Política de Retenção / Archival

- Certificados: apenas o vigente é mantido; o File anterior é deletado no upload novo (padrão `salvar_pdf_privado`). Sem janela de rollback nesta versão (adiado no PRD).
- Auditoria: retenção indefinida, sem expurgo — volume desprezível (evento raro).
- PDF consolidado: **não persistido**; montado em memória e descartado após o streaming (D6).

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| Provedor Sicoob — token | REST (POST form) | mTLS (PKCS#12) + `client_credentials` | 30s | Nenhum (comportamento atual preservado) |
| Provedor Sicoob — boletos | REST (GET/POST JSON) | mTLS + `Bearer` + header `client_id` | 60s | Nenhum |

Cliente HTTP: `requests_pkcs12` (`post`/`get`), centralizado em `adaptadores/sicoob/http.py`. URL montada a partir de `api_base_url` da configuração — a constante `SICOOB_BOLETOS_URL` é removida dos quatro arquivos.

**Sem circuit breaker e sem cache de token** — escopo por operação (D4); o token é obtido uma vez por operação, como hoje. Fallback em indisponibilidade: erro de negócio propagado ao chamador no shape `{success: False, message, details, status_code}`; nenhuma operação parcial é persistida.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

N/A — sem mensageria. As rotinas periódicas (`sincronizar_cobrancas_pendentes_vencidas_sicoob`, atrasos, vencidas) são disparadas por cron no host via `bench execute`; `hooks.py` não declara `scheduler_events` e esta feature não introduz nenhum.

### 9.2 Idempotência

Preservada como está: `Cobranca Integracao Sicoob` continua recebendo eventos com as mesmas chaves (`boleto_criado:{cobranca}:{seu_numero}`, `boleto_consultado:{cobranca}:{identificador}`, `boleto_baixa_solicitada:{cobranca}:{nosso_numero}`, `boleto_baixa_confirmada:{cobranca}:{nosso_numero}`). O patch de migração é idempotente por verificação de existência prévia (CT-026).

### 9.3 Outbox / Saga

N/A — não há consistência distribuída; todas as escritas ocorrem no mesmo banco, na transação da request.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

Frappe traduz exceções em status; erros de negócio retornam **200 com `success: False`** (padrão da família Sicoob), não status HTTP de erro.

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Sem configuração ativa | `CONFIGURACAO_AUSENTE` | "Nenhuma configuração bancária ativa foi encontrada." | `configuracao.py` |
| Mais de uma ativa | `CONFIGURACAO_DUPLICADA` | "Existe mais de uma configuração bancária ativa." | `configuracao.py` |
| Certificado inválido/senha errada | `CERTIFICADO_INVALIDO` | "Não foi possível abrir o certificado com a senha informada." | `certificado.py` |
| Certificado vencido | `CERTIFICADO_VENCIDO` | "O certificado digital venceu em {data}. Envie um certificado válido." | `configuracao.py` |
| Credencial legada indisponível | `CERTIFICADO_LEGADO_INDISPONIVEL` | "Nenhum certificado disponível para a integração." | `configuracao.py` |
| Provedor desconhecido | `PROVEDOR_DESCONHECIDO` | "Provedor '{nome}' não possui adaptador registrado." | `registry.py` |
| Teste de conexão pendente | `TESTE_CONEXAO_NAO_REALIZADO` | "Teste a conexão antes de ativar a configuração." | `service.py` |
| Decisão requerida | `DECISAO_REQUERIDA` | "Existem {n} boletos em aberto emitidos pela conta atual." | `service.py` |
| Limite do sequencial | `SEQUENCIAL_LIMITE_EXCEDIDO` | "Limite do contador sequencial excedido." | `sequencial.py` |
| Sem permissão | `frappe.PermissionError` → 403 | mensagem padrão do framework | Frappe |

### 10.2 Resiliência

Sem retry automático, circuit breaker ou bulkhead — decisão deliberada de preservar o comportamento atual (nenhum existe hoje). Timeouts explícitos (30s token, 60s operações). Degradação: falha de comunicação não deixa estado parcial — a persistência só ocorre após resultado canônico válido. O fallback de credencial legada (RN-10) é a única forma de degradação graciosa prevista.

### 10.3 Estratégia de Logging de Erros

`frappe.log_error(title, message)` para falhas inesperadas; erros de negócio **não** vão para log — retornam ao chamador. Sanitização obrigatória antes de qualquer escrita (RN-06): `certificado_senha`, `arquivo_base64` e o conteúdo binário do certificado são removidos de qualquer estrutura serializada, incluindo `payload_recebido`/`payload_processado` dos registros de evento (CT-009). Nunca registrar stacktrace de `cryptography` em erro de senha — converter em erro de negócio.

---

## 11. Segurança

### 11.1 Autenticação

Sessão/cookie do Frappe para os métodos whitelisted (nenhum `allow_guest`). Para o provedor: **mTLS** com certificado PKCS#12 + OAuth2 `client_credentials`, validados a cada operação.

### 11.2 Autorização

RBAC do Frappe. As DocTypes `Configuracao Integracao Bancaria` e `Auditoria Configuracao Bancaria` concedem `read/write/create` apenas a **System Manager** (mesmo perfil da configuração legada). Verificação explícita no início de cada método de `service.py` — não confiar apenas na permissão de DocType, já que métodos whitelisted não a aplicam automaticamente (CT-029). Auditoria é somente-leitura no Desk (sem `delete`).

### 11.3 Criptografia

- `certificado_senha` em campo `Password` — criptografado pelo Frappe com a chave do site; lido apenas por `get_password`.
- Certificado como File privado (`is_private=1`), servido apenas com sessão autorizada; entra no backup do site.
- TLS/mTLS na comunicação com o provedor; `verify` no default `True` do `requests_pkcs12`.
- Arquivo temporário do mTLS: `tempfile.NamedTemporaryFile(delete=False)` + `os.chmod(0o600)` **antes** de escrever o conteúdo, removido no `finally` inclusive em exceção (CT-013).

### 11.4 Sanitização e Validação

Sem SQL cru exceto o `SELECT … FOR UPDATE` do sequencial, que é parametrizado e sem entrada de usuário. `auth_url`/`api_base_url` validadas como URL absoluta `https` — mitiga SSRF via configuração. `arquivo_base64` decodificado com `validate=True` e verificado como PKCS#12 antes de qualquer uso. `parametros_provedor` validado como JSON e nunca interpolado em código.

### 11.5 Rate Limiting / Anti-abuse

N/A — operações administrativas de baixíssima frequência, restritas a System Manager. O rate limit padrão do Frappe permanece.

### 11.6 Secrets Management

Migração de secret-em-arquivo-no-host para **secret-no-banco**: senha em campo `Password` criptografado, certificado em File privado. O ponto de montagem `:ro` de `/run/secrets/sicoob` nos quatro serviços é **mantido indefinidamente** como rede de segurança do fallback (RN-10) — não é removido do `docker-compose.override.yml`.

---

## 12. Performance

### 12.1 Metas

- Latência p95: dominada pela API do provedor; meta interna de **overhead adicionado < 50 ms** por operação (materialização do certificado + resolução de configuração).
- Latência p99: idem; sem meta absoluta — não há SLA definido nem instrumentação de latência no projeto.
- Throughput esperado: dezenas de operações por dia (emissões mensais por contrato). Operações de configuração: unidades por ano.

### 12.2 Estratégias

- Índice composto `ativo` + `provedor` para a resolução da configuração.
- Certificado materializado **uma vez por operação**, não por chamada HTTP (D4) — preserva o número de handshakes atual.
- Filtro de boletos em aberto usa índices existentes de `status_cobranca` e `boleto_gerado`.
- PDF consolidado montado em streaming de páginas com `pypdf`, sem carregar todos os documentos simultaneamente além do necessário.
- **Sem cache** de token ou de configuração — deliberado (D4).

### 12.3 Limites Conhecidos

- Cada operação faz dois handshakes mTLS (token + chamada), como hoje.
- PDF consolidado cresce linearmente com o número de boletos em aberto; com centenas, o consumo de memória pode ser relevante — mitigável por paginação se surgir necessidade real.
- O lock do sequencial serializa emissões concorrentes — comportamento herdado e desejado.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

O projeto não possui logging estruturado; usa `frappe.log_error` (Error Log) e os logs de cron em `/opt/frappe/run-*.log`. Esta feature **não introduz** biblioteca de logging — a rastreabilidade das operações de configuração é feita pela DocType de auditoria, que é consultável e sanitizada por construção.

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| Falha inesperada em operação de cobrança | error | `cobranca_id`, `error_code`, `message` | sem senha, sem bytes |
| Falha ao materializar/remover certificado | error | `configuracao`, `error_code` | apenas caminho, nunca conteúdo |
| Troca de configuração | auditoria (DocType) | `autor`, `acao`, `data_hora`, impressões digitais | **nunca** senha, bytes ou valores de campo |
| Teste de conexão | auditoria (DocType) | `autor`, `resultado`, `mensagem` | mensagem sanitizada |

### 13.2 Métricas

N/A — não há Prometheus, OTel ou Datadog no ambiente. Introduzir instrumentação está fora do escopo desta feature.

### 13.3 Tracing

N/A — sem tracing distribuído; a aplicação é um monólito Frappe de processo único por request.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| Certificado próximo do vencimento | `dias_para_vencer <= 30` | informativo | Badge na tela (Fase 2) — sem canal externo nesta versão |
| Certificado vencido | `dias_para_vencer < 0` | crítico | Erro de negócio na emissão (RN-07) + destaque na tela |

Notificação ativa por e-mail está explicitamente fora do escopo (PRD 4.2).

---

## 14. Feature Flags

### 14.1 Solução

N/A — o projeto não possui solução de feature flags.

### 14.2 Flags Envolvidas

Nenhuma. O rollout é controlado pela **ordem do estrangulamento** (D2): cada operação migra num deploy próprio, e o campo `certificado_arquivo` vazio funciona como chave natural do fallback legado (RN-10) — sem necessidade de flag artificial.

---

## 15. Versionamento de API

### 15.1 Estratégia

Métodos whitelisted do Frappe são endereçados por caminho pontilhado (`/api/method/<módulo>.<função>`); não há versionamento por URL, header ou content-type no projeto. A estratégia adotada é **evolução aditiva**: novas chaves podem ser acrescentadas às respostas; chaves existentes não são removidas nem têm o tipo alterado.

### 15.2 Compatibilidade

As assinaturas e o conjunto de chaves das seis operações existentes são **contrato imutável** nesta feature (CA-17, verificado por CT-030). Qualquer remoção de chave é breaking change e exigiria coordenação com o frontend. Não há janela de descontinuação definida — não há consumidor externo além do próprio aplicativo.

### 15.3 Schemas / Contratos

Sem registry de schemas. O contrato é validado por teste de equivalência (CT-030), que atua como verificação automatizada em CI local (`bench run-tests`).

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD. Deploy é manual: sincronizar o código em `/opt/frappe/app-sync/locacao_automation` (bind mount), executar `bench --site frontend migrate`, reiniciar os serviços. Gate humano: execução da suíte (`bench --site frontend run-tests --app locacao_automation`) antes do restart.

### 16.2 Empacotamento

Imagem `locacao-erpnext:v15.4.0-pdf` (custom, com `pypdf`, `reportlab`, `cryptography`, `requests-pkcs12` em `requirements-extra.txt`). O app é **bind-mount**, não empacotado na imagem — alterações de código não exigem rebuild, apenas restart. Nenhuma dependência nova é introduzida.

### 16.3 Infraestrutura como Código

Docker Compose (`docker-compose.yaml` + `docker-compose.override.yml`). Nenhum recurso novo provisionado. O volume `:ro` do certificado legado nos quatro serviços é **preservado**.

### 16.4 Estratégia de Rollout

Rolling manual, alinhado ao estrangulamento (D2): um deploy por operação migrada, na ordem `consultar → confirmar_baixa → solicitar_baixa → sincronizar → emitir`. Após cada deploy, validar a operação migrada em produção antes de seguir para a próxima.

**Restart obrigatório** dos quatro serviços que carregam o app, pelos serviços do compose — nunca `pkill`:
```
docker compose restart backend scheduler queue-short queue-long
```

### 16.5 Escalabilidade

Vertical apenas; instância única por serviço. Sem autoscaling. O volume da feature não justifica escala horizontal.

### 16.6 Rollback

Reverter o commit do app e reiniciar os quatro serviços — o bind mount torna a reversão de código imediata. **A DocType canônica e o patch não são revertidos**: como o fallback legado permanece e o patch é idempotente, a configuração canônica pode coexistir sem uso. Exceção: o corte do contador (D3) é ponto de não-retorno — se for necessário reverter após a migração da emissão, o valor do contador canônico deve ser copiado de volta manualmente antes de reativar a configuração legada.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | Leitura sanitizada da configuração ativa + bloco `certificado` derivado | `service.obter_configuracao`, `configuracao.py`, DocType canônica |
| US-02 | File privado + campos `Password`/read-only; substituição do anterior | `service.enviar_certificado`, `certificado.py`, `pdf_arquivo` (padrão) |
| US-03 | Extração PKCS#12 via `cryptography` (CN, OIDs ICP-Brasil, validade, emissor, SHA-256) | `certificado.ler_metadados_pfx` |
| US-04 | Atualização parcial dos campos de conta na DocType canônica | `service.salvar_configuracao`, DocType canônica |
| US-05 | Chamada real de token pela porta, com a configuração salva | `service.testar_conexao`, `registry`, `adapter.obter_token` |
| US-06 | Filtro RN-02 sobre `Cobranca` + retorno `requer_decisao` | `boletos_abertos.listar_boletos_abertos` |
| US-07 | Composição `pypdf` em memória + `frappe.local.response` | `boletos_abertos.montar_pdf_consolidado`, `cobranca_boleto` (padrão) |
| US-08 | `dias_para_vencer` calculado sobre `certificado_valido_ate` | `service.obter_configuracao`, `certificado.py` |
| US-09 | Exclusão do File privado + limpeza dos campos derivados | `service.remover_certificado`, `auditoria.py` |
| US-10 | Campos `auth_url`, `api_base_url`, `ambiente` editáveis e validados | `service.salvar_configuracao`, DocType canônica |
| US-11 | DocType de auditoria com autor, data, ação e impressões digitais | `auditoria.registrar_alteracao`, DocType de auditoria |
| US-12 | Guarda de validade antes da resolução do adaptador | `configuracao.py`, `emissao.py` |
| US-13 | Fallback de leitura para `pfx_path_legado` enquanto `certificado_arquivo` vazio | `configuracao.resolver_credenciais` |
| US-14 | Porta `AdaptadorCobrancaBancaria` + `registry` + adaptador isolado | `porta.py`, `registry.py`, `adaptadores/sicoob/*` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | Frappe / ERPNext | v15 (imagem `v15.4.0-pdf`) | Base do app; ORM, DocType, File, permissões |
| Runtime | Python | >= 3.10 | Declarado em `pyproject.toml` |
| Cliente HTTP | `requests-pkcs12` | já instalado | mTLS com certificado PKCS#12 |
| Criptografia | `cryptography` | 47.0.0 (já instalado) | Leitura de metadados PKCS#12 |
| PDF | `pypdf` | 5.9.0 (`>=5.4.0,<6.0.0`) | Composição do documento consolidado |
| PDF | `reportlab` | 4.4.10 | Já usado no app (não alterado por esta feature) |
| Banco | MariaDB | do stack Frappe | Persistência |
| Testes | `FrappeTestCase` (unittest nativo) | do framework | Suíte inicial — **nenhuma dependência nova** |

**Nenhuma dependência nova é adicionada** — `requirements-extra.txt` e `pyproject.toml` permanecem inalterados.

---

## 19. Estratégia de Testes

> **Resumo**: 30 casos de teste | Unitários: 10 | Integração: 18 | E2E: 1 | Segurança: 1
> **Padrão**: `FrappeTestCase` (unittest nativo do Frappe v15). Comando: `bench --site <site> run-tests --app locacao_automation [--module locacao_automation.tests.test_<arquivo>]`. Mocks por `unittest.mock.patch` na fronteira HTTP (`requests_pkcs12`). Fixtures de certificado geradas em tempo de teste com `cryptography` — nenhum certificado real no repositório.
>
> **Contexto**: o projeto tem **zero testes** hoje. Esta suíte é a primeira. `FrappeTestCase` foi escolhido por ser nativo e não exigir dependência nova; pytest exigiria adicionar pytest + plugin de integração Frappe e wiring de conftest/fixtures de site.
>
> **Sequenciamento sob o estrangulamento (D2)** — identificado no challenge: dois casos só podem passar depois que **todas** as cinco operações migrarem, porque medem propriedades do estado final. **CT-028** (erro estruturado idêntico nos cinco pontos) falha enquanto as operações não migradas ainda usarem as próprias cópias de `_obter_configuracao_ativa`; **CT-030** (equivalência do contrato observável) só é conclusivo com as cinco no caminho canônico. Ambos devem ser escritos desde o início e marcados como esperados-a-falhar até o último deploy, em vez de adiados — assim a regressão fica visível a cada passo.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | Tela apresenta conta e certificado sem expor segredos | CT-009, CT-011, CT-029 |
| CA-02 | Certificado válido com senha correta é aceito | CT-016 |
| CA-03 | Senha incorreta recusa e nada é gravado | CT-005, CT-006, CT-012 |
| CA-04 | Metadados extraídos apresentados antes de confirmar | CT-004, CT-016 |
| CA-05 | Alteração da conta vale para as próximas cobranças | CT-011, CT-017 |
| CA-06 | Teste de conexão bem-sucedido habilita a configuração | CT-018 |
| CA-07 | Teste falho mantém a configuração anterior | CT-018 |
| CA-08 | Aviso de boletos em aberto com três opções | CT-019 |
| CA-09 | Documento consolidado é gerado e apresentado | CT-020 |
| CA-10 | Consolidado parcial lista os ausentes | CT-020 |
| CA-11 | Indicação de dias para o vencimento | CT-004, CT-007 |
| CA-12 | Remoção apaga credencial e derivados | CT-021 |
| CA-13 | Endereços/ambiente valem sem nova publicação | CT-022 |
| CA-14 | Registro de autor, data e certificados | CT-009, CT-023 |
| CA-15 | Certificado vencido recusa antes de chamar o banco | CT-007, CT-024 |
| CA-16 | Operação contínua com credencial pré-existente | CT-013, CT-025, CT-026 |
| CA-17 | Equivalência observável das cinco operações | CT-001, CT-002, CT-003, CT-008, CT-010, CT-014, CT-015, CT-027, CT-028, CT-030 |

---

### 19.1 Testes Unitários

#### Domínio canônico (`tests/test_modelo_canonico.py`)

Mock: nenhum — código puro, sem `frappe`.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-001 | `test_situacao_canonica_preserva_texto_cru` | CA-17 | Garantir que todo texto de situação do provedor mapeia para exatamente um dos 6 valores do enum e preserva o original ao lado, inclusive para texto não reconhecido | Tabela de textos crus do provedor | `enum_canonico` esperado por linha e `texto_cru` idêntico à entrada | — | — |
| CT-002 | `test_registry_resolve_provedor_conhecido` | CA-17 | Verificar que o registry devolve instância que implementa integralmente a porta | `provedor="sicoob"` | Instância com `obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar` | — | — |
| CT-003 | `test_registry_recusa_provedor_desconhecido` | CA-17 | Verificar que provedor não cadastrado nunca devolve adaptador parcial ou `None` silencioso | `provedor="banco_inexistente_xyz"` | Erro explícito citando o nome; nenhum objeto construído | — | — |
| CT-010 | `test_mapeamento_nao_vaza_vocabulario_provedor` | CA-17 | Garantir (ADR-0001) que campo sem equivalente canônico chega ao payload via escape, não hardcoded no núcleo | Boleto canônico com 1 campo core + 1 em `parametros_provedor` | `payload["valor"]` traduzido do canônico e `payload["codigoNegativacao"]` originado do escape | — | — |

#### Certificado digital (`tests/test_certificado.py`)

Mock: nenhum. Fixtures PKCS#12 geradas em `setUp` com `cryptography`.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-004 | `test_extrai_metadados_pkcs12_valido` | CA-04, CA-11 | Verificar extração de titular, documento ICP-Brasil, validade, emissor e impressão digital | PKCS#12 gerado + senha correta | Titular igual ao CN; validade igual à gerada; impressão digital igual ao SHA-256 do DER | — | — |
| CT-005 | `test_metadados_falha_certificado_corrompido` | CA-03 | Garantir que bytes não-PKCS#12 nunca produzem metadados parciais | PDF renomeado; arquivo truncado | Erro de negócio (não exceção crua de `cryptography`); nenhum metadado retornado | — | — |
| CT-006 | `test_certificado_recusado_por_violacao_rn05` | CA-03 | Cobrir as três violações de RN-05 numa tabela | Senha incorreta; formato inválido; tamanho fora da faixa | Recusa com mensagem de negócio por causa; nenhuma persistência | — | — |
| CT-007 | `test_dias_para_vencer_nas_fronteiras` | CA-11, CA-15 | Verificar consistência do cálculo nas bordas (vencido, vence hoje, futuro) | Tabela de validades vs. data de referência fixa `2026-07-20` | `dias_restantes` e `vencido` conforme a tabela | — | Relógio injetado como parâmetro `data_referencia` — sem `freeze_time`, sem monkeypatch de `datetime` |

#### Sequencial e sanitização (`tests/test_sequencial.py`, `tests/test_configuracao.py`)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-008 | `test_formato_sequencial_e_overflow` | CA-17 | Garantir formato `AAAAMM` + 12 dígitos e recusa explícita no estouro | Tabela de valores anteriores, incluindo `999999999999` | 18 caracteres nos casos normais; erro de limite no estouro | — | — |
| CT-009 | `test_serializacao_auditoria_nao_vaza_segredo` | CA-01, CA-14 | Garantir RN-06: senha e bytes do certificado nunca aparecem no JSON serializado | Dict de configuração com campos sensíveis | Nenhuma substring sensível no JSON; campos não-sensíveis preservados | — | — |

### 19.2 Testes de Integração

Setup comum: site de teste do Frappe, transação revertida por `FrappeTestCase`; configuração canônica e legada criadas via ORM; mock em `requests_pkcs12` na fronteira HTTP.

#### Resolução de configuração e certificado (`tests/test_configuracao.py`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-011 | `test_rn01_exatamente_uma_configuracao_ativa` | CA-01, CA-05 | Verificar RN-01 nos três cenários de contagem | 0 ativas / 1 ativa / 2 ativas → resolver | 1 ativa retorna a config; 0 e 2 retornam erro estruturado com o mesmo shape | — |
| CT-012 | `test_senha_incorreta_nao_grava_nada` | CA-03 | Garantir que recusa por senha deixa a configuração byte-a-byte inalterada | Snapshot → enviar com senha errada → recarregar | `{success: False}` e config campo-a-campo idêntica ao snapshot | — |
| CT-013 | `test_arquivo_temporario_removido_no_finally` | CA-16 | Garantir remoção do material materializado inclusive quando a chamada lança | Operação com sucesso; operação com exceção | `os.path.exists(temp) is False` nos dois casos; permissão `0600` durante a existência | Captura do caminho via `patch` no ponto de chamada do cliente HTTP — sem expor símbolo de produção só para teste |
| CT-025 | `test_fallback_legado_mantem_operacao` | CA-16 | Verificar RN-10 com arquivo legado presente e ausente | Sem certificado enviado → resolver | Presente: resolve pelo caminho legado; ausente: erro de negócio explícito, sem stacktrace | — |
| CT-026 | `test_patch_migracao_idempotente` | CA-16 | Garantir que reexecutar o patch não duplica nem corrompe | Executar o patch duas vezes | Contagem e campos idênticos entre os snapshots | — |
| CT-028 | `test_erro_estruturado_identico_nos_cinco_pontos` | CA-17 | Garantir shape único de erro onde hoje há 1 dict + 4 strings | Config ausente → chamar as 5 operações | Mesmo conjunto de chaves top-level nos 5 retornos | — |

#### Contador sequencial (`tests/test_sequencial.py`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-014 | `test_sequencial_sob_concorrencia_nao_duplica` | CA-17 | Garantir RN-03 sob disputa real do lock de linha | Duas execuções concorrentes de geração na mesma configuração | Os dois valores diferem; o contador final reflete exatamente duas incrementações | Conexões de banco independentes para exercer o `FOR UPDATE` real — sem simular o lock |
| CT-015 | `test_sequencial_nunca_reinicia_na_troca_de_conta` | CA-17 | Garantir RN-03 na troca de conta | Gerar em A → desativar A e ativar B → gerar | Segundo valor estritamente maior que o primeiro | — |
| CT-027 | `test_corte_atomico_sem_fallback_do_contador` | CA-17 | Provar que após o corte não há leitura da origem legada (D3) | Alterar o sequencial legado após o corte → gerar | Valor continua a partir do canônico, nunca do legado alterado | — |

#### Serviços de configuração (`tests/test_integracao_bancaria_api.py`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-016 | `test_envio_certificado_valido_aceito` | CA-02, CA-04 | Verificar aceitação e apresentação da nova credencial | Enviar PKCS#12 válido com senha correta | `{success: True}`; impressão digital, titular e validade batendo com o enviado | — |
| CT-017 | `test_alteracao_conta_valida_e_invalida` | CA-05 | Verificar atualização parcial e recusa de dado inválido | Alterar conta com valor válido; depois com vazio | Válido persiste; inválido recusa e preserva o anterior | — |
| CT-018 | `test_configuracao_so_ativa_apos_teste_conexao` | CA-06, CA-07 | Verificar RN-04 nos dois desfechos | Teste mockado com sucesso; depois com falha | Sucesso ativa a nova e desativa a anterior; falha mantém a anterior ativa | — |
| CT-021 | `test_remocao_certificado_limpa_derivados` | CA-12 | Verificar limpeza completa e recusa quando não há certificado próprio | Remover com certificado; remover só com fallback | Campos derivados vazios e File inexistente; segundo caso recusa com erro de negócio | — |
| CT-022 | `test_alteracao_endereco_vale_sem_republicacao` | CA-13 | Verificar efeito imediato e recusa de URL malformada | Alterar para URL válida; depois malformada | Nova URL na próxima resolução, no mesmo processo; malformada recusada | — |
| CT-023 | `test_auditoria_registra_autor_data_e_impressoes` | CA-14 | Verificar RN-12 | Trocar o certificado A → B | Exatamente 1 registro com autor, data e as duas impressões digitais | Usuário de teste real criado via ORM e sessão trocada pelo mecanismo nativo do framework |
| CT-024 | `test_certificado_vencido_bloqueia_antes_do_http` | CA-15 | Verificar RN-07 sem tocar a rede | Emitir com certificado vencido | `{success: False}` com mensagem de negócio; contador de chamadas HTTP igual a zero | — |
| CT-029 | `test_acesso_restrito_a_perfil_administrativo` | CA-01 | Verificar RN-11 nos dois contextos de usuário | Chamar o método com e sem role administrativa | Sem role: erro de permissão, nenhum dado; com role: sucesso | Dois usuários reais criados via ORM e alternância de sessão pelo mecanismo nativo do `FrappeTestCase` |

#### Boletos em aberto e consolidado (`tests/test_boletos_abertos.py`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-019 | `test_tres_opcoes_de_decisao_na_troca` | CA-08 | Verificar RN-08 nos três caminhos | Troca pendente com boletos em aberto → `aceitar`, `nao_aceitar`, `aceitar_com_consolidado` | Aceitar ativa a nova; não aceitar preserva tudo; consolidado gera o documento e prossegue | — |
| CT-020 | `test_consolidado_reune_disponiveis_e_lista_ausentes` | CA-09, CA-10 | Verificar RN-09 com PDF real | 3 boletos em aberto, 2 com PDF de 1 página | Consolidado com exatamente 2 páginas; lista de ausentes com o identificador do terceiro | PDFs reais de 1 página gerados em `setUp` com `reportlab` |

### 19.3 Testes End-to-End (E2E)

#### Fluxo: Equivalência do contrato observável das cinco operações (CT-030)

- **Framework**: chamada black-box aos métodos whitelisted, via `frappe.call`, contra o site de teste.
- **CA**: CA-17
- **Objetivo**: provar que o refactor canônico não alterou o conjunto de chaves nem os tipos que o cliente já consome.
- **Pré-condições**: `Cobranca` de teste com boleto emitido; configuração ativa; cliente HTTP mockado devolvendo respostas representativas do provedor.
- **Passos**:
  1. Invocar `emitir_boleto_sicoob`, `consultar_boleto_sicoob`, `solicitar_baixa_boleto_sicoob`, `confirmar_baixa_boleto_sicoob` e `sincronizar_status_pagamento_sicoob`.
  2. Para cada retorno, extrair o conjunto de chaves top-level e os tipos.
  3. Comparar contra o contrato imutável declarado.
- **Validações**: nenhuma chave do contrato ausente; tipos preservados (`str`/`bool`/`float`/`None`); `success` presente em todos.

### 19.4 Cenários de Erro

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---------|----|----------|---------|------------------------|
| Senha do certificado incorreta | CA-03 | Recusa sem persistência | Envio com senha errada | `{success: False, message}`; config intacta; sem stacktrace de `cryptography` |
| Certificado corrompido / não-PKCS#12 | CA-03 | Recusa sem metadados parciais | PDF renomeado | `{success: False, message}` |
| Teste de conexão falha | CA-07 | Configuração não entra em vigor | Provedor responde erro | `{success: False}`; anterior segue ativa |
| Certificado vencido | CA-15 | Bloqueio antes da rede | Validade no passado | `{success: False}`; zero chamadas HTTP |
| Zero ou duas configurações ativas | CA-01 | Erro estruturado uniforme | Estado inválido no banco | Mesmo shape nos 5 pontos de consumo |
| Credencial legada ausente | CA-16 | Erro de negócio legível | Sem upload e sem arquivo montado | `{success: False, message}` explícita |
| Exceção durante a chamada ao provedor | CA-16 | Arquivo temporário removido | Cliente HTTP lança | `os.path.exists(temp) is False` |
| Provedor desconhecido | CA-17 | Falha explícita no registry | `provedor` inválido | Erro nomeando o provedor |
| Estouro do contador sequencial | CA-17 | Recusa explícita | Valor `999999999999` | Erro de limite; contador não avança |

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Contador sequencial com duas origens vivas gera `nosso_numero` duplicado | Baixa | **Crítico** | Corte atômico na mesma transação (D3); sem fallback de leitura; CT-014, CT-015, CT-027 |
| Regressão silenciosa no mapeamento canônico altera comportamento de cobrança | Média | Alto | Estrangulamento começando por leitura (D2); CT-030 de equivalência; validação em produção entre deploys |
| Vazamento de senha/certificado nos registros de evento que hoje serializam payload inteiro | Média | **Crítico** | Sanitização obrigatória antes de qualquer serialização (RN-06); CT-009 |
| Arquivo temporário do certificado persistir em disco após erro | Baixa | Alto | Context manager com remoção no `finally`; `0600`; CT-013 |
| Deriva entre a DocType versionada em arquivo e o banco | Média | Médio | Consequência aceita em ADR-0002; mitigação é processo (commitar alteração feita pelo Desk) |
| Patch de migração executado parcialmente deixa configuração incompleta | Baixa | Alto | Idempotência por verificação prévia; CT-026; fallback legado cobre o intervalo |
| Suíte de testes inaugural sem cultura estabelecida ser abandonada | Média | Médio | 30 CTs focados em invariantes de alto valor; comando único de execução documentado no runbook |
| `verify=True` do `requests_pkcs12` falhar em ambiente de homologação com CA própria | Baixa | Médio | Homologação ainda não validada (ponto em aberto); tratar quando as credenciais existirem |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

- **ADR-0001 — Modelo canônico de cobrança bancária com adaptador por provedor** — **APLICÁVEL**. A `Decision` nomeia literalmente a porta `AdaptadorCobrancaBancaria` e os métodos `obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`; a seção 3.2 desta spec usa exatamente esses identificadores, e a seção 3.3 implementa a cláusula "nenhum campo, URL ou vocabulário específico de provedor cruza a porta" via `parametros_provedor` como escape explícito (verificado por CT-010). A preservação do texto cru ao lado do enum (seção 6.2) satisfaz a cláusula "com o texto cru do provedor preservado ao lado" da mesma ADR.
- **ADR-0002 — Versionar estrutura de dados do app em arquivo** — **APLICÁVEL**. A `Decision` determina que "toda estrutura de dados criada a partir desta decisão nasce descrita em arquivo no repositório e é aplicada pelo processo de migração do framework". As duas DocTypes novas (seção 7.2) são descritas em JSON versionado sob o módulo `Locacao Automation` (seção 3.4) e criadas por `bench migrate` (seção 7.3), com o patch registrado em `[post_model_sync]` para respeitar a ordenação. A segunda cláusula — "as estruturas já existentes permanecem como estão" — é respeitada: `Cobranca`, `Configuracao Integracao Sicoob` e `Cobranca Integracao Sicoob` não são convertidas.

> **Conflito resolvido durante esta spec**: o módulo `Locação de imóveis`, onde vivem todas as DocTypes atuais, pertence ao app `erpnext` — tornaria ADR-0002 inexequível, já que o Frappe só versiona em arquivo DocTypes de módulos do próprio app. Resolvido com o usuário: as DocTypes novas nascem no módulo `Locacao Automation`, declarado em `modules.txt` do app. Sem esse ajuste, a spec teria de superseder ADR-0002.

### Candidatos a ADR

- **Sanitização obrigatória de material criptográfico antes de qualquer serialização** — *Candidato a ADR parcial*. C1 (transversal — vale para qualquer secret do projeto): passa. C2 (`security`): passa. C3 (custo de reversão): passa parcialmente — hoje só há um ponto de serialização. C4 (surpreendente): **falha** — a prática é esperada, não surpreendente. C5 (trade-off real): **falha** — não há alternativa legítima a não vazar segredo. Registrado como invariante da seção 11, não como ADR.
- Nenhum candidato 5/5 confirmado nesta spec.

### Glossário de domínio

Canonizado na sessão de challenge (2026-07-20). Ambos os arquivos foram criados por esta feature — o projeto não possuía glossário.

- **Global** (`docs/specs/domain-glossary.md`): *Boleto em aberto*, *Provedor*, *Contador sequencial*.
- **Feature** (`docs/specs/features/integracao-bancaria-configuravel/domain-glossary.md`): *Configuração ativa*, *Configuração pendente*, *Credencial*, *Situação canônica*.

A terminologia desta spec segue os termos canônicos. Duas ambiguidades foram resolvidas e registradas: "seu número" (contador vs. identificador composto) e "certificado" (arquivo vs. conjunto arquivo+senha, agora **Credencial**).

### Achados do challenge (2026-07-20)

Três furos encontrados e corrigidos inline:

1. **Corte do contador incompatível com o estrangulamento** — o patch único desativava a configuração legada no primeiro deploy, o que quebraria as quatro operações ainda não migradas (cada uma filtra `ativo=1` na DocType legada; `cobranca_sicoob/emissao.py:189`). Violação direta de CA-16. **Corrigido**: dois patches, com o corte acoplado ao deploy da emissão (§7.3).
2. **Streaming e resposta JSON no mesmo método** — `salvar_configuracao` não pode entregar o PDF consolidado e retornar `{success}`; `frappe.local.response` substitui a resposta (padrão de `cobranca_boleto/service.py:52-55`, sem `return`). **Corrigido**: endpoint próprio `baixar_consolidado_boletos_abertos`, acionado antes da troca, restrito a System Manager (§4.1, §5.1).
3. **Estado pendente sem existência estrutural** — RN-04 exigia teste bem-sucedido antes da vigência, mas a DocType só tinha `ativo` e `testar_conexao` operava "sobre a config salva". **Corrigido**: registro pendente com `ativo=0` mais carimbo `conexao_testada_em`/`conexao_testada_hash`, que invalida ao editar (§7.2).

Consequência registrada em §19: **CT-028** e **CT-030** só passam após a migração das cinco operações — devem ser escritos desde o início e marcados como esperados-a-falhar, não adiados.

### Candidato a ADR — parcial

**Configuração validada antes de entrar em vigor (registro pendente + carimbo invalidável)** — C2 (`architecture`), C3 (custo de reversão) e C5 (alternativas reais rejeitadas) passam. **C1 falha**: existe uma única configuração desse tipo no projeto, então o padrão não é transversal hoje. **C4 falha parcialmente**: o mecanismo é autoexplicativo na própria spec. Promover a ADR se um segundo domínio de configuração adotar o mesmo padrão.

### Decisões herdadas do tech-alignment

D1 (versionamento em arquivo), D2 (estrangulamento por operação, consulta primeiro), D3 (patch + fallback, contador em corte atômico), D4 (escopo por operação, sem cache), D5 (canônico e cru convivendo), D6 (consolidado em memória), D7 (shape `success`, conteúdo codificado em JSON) — todas incorporadas sem divergência.

### Pontos em aberto herdados

- Faixa aceitável de tamanho do certificado (afeta CT-006, hoje com faixa-placeholder).
- Disponibilidade de credenciais de homologação (afeta a utilidade prática do campo `ambiente`).
- Comportamento do provedor na baixa de boleto emitido sob outra conta — altera apenas a redação do aviso na Fase 2.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada (Python 3.10+ / Frappe v15)
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-14 mapeadas em 17)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6)
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8)
- [x] Sincronização: eventos, idempotência (seção 9)
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13)
- [x] Feature flags listadas (seção 14 — N/A justificado)
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura: pipeline, empacotamento, IaC, rollout (seção 16)
- [x] Dependências externas listadas (seção 18 — nenhuma nova)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19, rastreabilidade CA→CT completa 17/17)
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21, com inventário literal de ADRs)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4-3.7)
- [x] Pronto para geração das TASKS
