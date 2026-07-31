# Rule candidates — integracao-bancaria-configuravel/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Builder base de Configuracao Integracao Bancaria

**Regra que isto sugere:** centralizar a fixture `_dados_base` da config bancária num helper compartilhado entre classes de teste.

**O que ela faria (simples):** o mesmo dicionário de campos mínimos válidos foi duplicado quase idêntico em duas classes de teste; um builder único evita drift entre as cópias quando o schema da DocType evoluir.

- Evidência: `_dados_base` duplicado em TestUnicidadeConfiguracaoAtiva e TestCarimboConexao — `app-sync/locacao_automation/locacao_automation/tests/test_doctype_configuracao.py:66` e `:124`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [repeated_fixture] Builder de config/certificado de teste na suíte de cobrança bancária

**Regra que isto sugere:** padronizar `fixtures_certificado.gerar_pfx` e um builder único da DocType `Configuracao Integracao Bancaria` de teste como fábricas canônicas da suíte.

**O que ela faria (simples):** a geração do PKCS#12 de teste e a construção da config canônica reaparecem duplicadas em classes distintas (T3, T4); fábricas canônicas evitam drift de campos quando o schema evoluir.

- Evidência: `gerar_pfx` e `_criar_canonica`/`_criar_canonica_upload` reusados — `app-sync/locacao_automation/locacao_automation/tests/test_configuracao.py:92` e `:297`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [repeated_fixture] Object-mothers dos tipos canônicos em testes de adaptador

**Regra que isto sugere:** centralizar os builders dos tipos canônicos (CredenciaisIntegracao, BoletoCanonico, Pagador, resposta HTTP fake) num módulo de test-support compartilhado entre adaptadores.

**O que ela faria (simples):** os helpers `_credenciais/_boleto/_pagador/_resposta_fake` já são reusados em várias classes; quando entrar um 2º adaptador de provedor cada suíte vai recriar as mesmas fixtures e divergir.

- Evidência: helpers reusados — `app-sync/locacao_automation/locacao_automation/tests/test_adaptador_sicoob.py:42`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [repeated_fixture] Patch de token+GET do transporte Sicoob nos testes de operação

**Regra que isto sugere:** extrair um helper/context manager que aplica os patches de `requests_pkcs12.post` (token) e `requests_pkcs12.get` (operação) para os testes de integração das operações Sicoob.

**O que ela faria (simples):** o mesmo duplo patch (token ok + get/post da operação) se repete em ~7 testes de consulta; um helper reduz cópia e evita drift no nome/nível do patch quando o boundary mTLS mudar. Vai reaparecer em T8/T9/T10.

- Evidência: duplo patch repetido — `app-sync/locacao_automation/locacao_automation/tests/test_consulta_sicoob.py:160`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [repeated_assertion_shape] Validação do contrato de resposta por set de chaves

**Regra que isto sugere:** testes de endpoints `@frappe.whitelist()` validam o shape da resposta comparando `set(resultado.keys())` contra uma constante canônica de chaves, não só campos individuais.

**O que ela faria (simples):** trava o conjunto EXATO de chaves da resposta e pega chave adicionada/removida silenciosamente — foi assim que a remoção de `status_code` (T8) foi detectável. Padronizar isso em toda a suíte de endpoints evita quebras de equivalência despercebidas.

- Evidência: `set(resultado.keys()) == CHAVES_SOLICITAR/CHAVES_CONFIRMAR` — `app-sync/locacao_automation/locacao_automation/tests/test_baixa_sicoob.py:156`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [repeated_fixture] Base de isolamento para testes de integração Sicoob

**Regra que isto sugere:** padronizar uma FrappeTestCase base compartilhada que neutralize `frappe.db.commit` e desative as configs Sicoob ativas persistidas no `setUp`.

**O que ela faria (simples):** o mesmo setup de isolamento (desativar a Configuracao ativa persistida antes de cada teste, para não colidir com unicidade/resolução) reaparece em vários módulos — inline em uns, via classe base em outros. Uma base única evita a cópia e o drift. Foi a causa de duas correções de isolamento durante o run (test_configuracao, test_doctype_configuracao) após o Patch 1/2 deixarem uma canônica ativa persistida.

- Evidência: `_BaseEmissaoTest._desativar_configs_ativas` + isolamento inline em `test_doctype_configuracao` — `app-sync/locacao_automation/locacao_automation/tests/test_emissao_sequencial.py:109`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T00:00:00Z

---

## [convention_drift] Filtro de boleto em aberto (RN-02) sem fonte única

**Regra que isto sugere:** regras de negócio de apuração (ex.: o filtro RN-02 de "boleto em aberto") devem ter fonte única importável, não cópia por módulo.

**O que ela faria (simples):** o critério que define "boleto em aberto" está escrito igual em dois módulos (apuração nova e rotina de pagamentos de produção); se um mudar sem o outro, a contagem financeira diverge e só um teste de equivalência captura.

- Evidência: `FILTROS_BOLETO_ABERTO` (boletos_abertos.py:31) é cópia literal de `filtros_elegiveis` (rotina_pagamentos.py:34)
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-21T00:00:00Z

---

## [speculative_complexity] Retorno de dados sem consumidor em função de apuração

**Regra que isto sugere:** funções de leitura retornam apenas os campos/chaves declarados no aceite e efetivamente consumidos, sem payload "para quem precisar".

**O que ela faria (simples):** a função de apuração devolve registros crus e busca colunas extras que nenhum chamador usa — over-return especulativo. A regra manteria o contrato enxuto até haver consumidor real.

- Evidência: `listar_boletos_abertos` retorna chave `boletos` + campos status_cobranca/nosso_numero sem consumidor — `boletos_abertos.py:48`
- Sinal: `speculative_complexity` · Origem: `staff-review` · 2026-07-21T00:00:00Z

---
