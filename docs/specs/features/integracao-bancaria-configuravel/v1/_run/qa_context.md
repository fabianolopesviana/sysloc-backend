# QA Context — integracao-bancaria-configuravel v1 (backend)

## Stack
Python 3.10+ / Frappe v15 (ERPNext), app `locacao_automation`. MariaDB via ORM Frappe. Runner: `FrappeTestCase` (`bench --site <site> run-tests --app locacao_automation`). **Zero testes hoje** — suíte inaugural. Mock HTTP via `unittest.mock.patch` em `requests_pkcs12`. Fixtures de certificado geradas com `cryptography` em `setUp`.

## Componentes → arquivos
- Domínio: `cobranca_bancaria/{modelo,porta,registry}.py`
- Certificado: `cobranca_bancaria/certificado.py`
- Configuração: `cobranca_bancaria/configuracao.py`
- Adaptador: `cobranca_bancaria/adaptadores/sicoob/{http,auth,mapeamento,adapter}.py`
- Persistência: DocTypes `Configuracao Integracao Bancaria`, `Auditoria Configuracao Bancaria` (versionadas em `locacao_automation/locacao_automation/doctype/`)
- API: `integracao_bancaria_api/{service,auditoria,boletos_abertos}.py`
- Operações (portadas): `cobranca_sicoob/{consulta,confirmacao_baixa,baixa,sincronizacao,emissao,sequencial}.py`
- Migração: `patches/v1_0/{migrar_configuracao_integracao_bancaria,cortar_contador_sequencial}.py`

## Invariantes de maior risco
- **RN-03**: contador único, nunca reinicia, origem única após corte (CT-014, CT-015, CT-027).
- **RN-06**: senha/bytes do certificado nunca em retorno/log/evento (CT-009).
- **CA-16**: fallback legado mantém operação; arquivo temp `0600` removido no finally inclusive em erro (CT-013, CT-025).
- **CA-17**: equivalência observável das 5 operações; erro estruturado único (CT-028, CT-030) — só passam após todas migrarem.
- **RN-04**: config só em vigor após teste bem-sucedido; carimbo invalidável (CT-018).

## Mapa CA → CT (da §19 do tech_spec)
CA-01: CT-009,011,029 · CA-02: CT-016 · CA-03: CT-005,006,012 · CA-04: CT-004,016 · CA-05: CT-011,017 · CA-06/07: CT-018 · CA-08: CT-019 · CA-09/10: CT-020 · CA-11: CT-004,007 · CA-12: CT-021 · CA-13: CT-022 · CA-14: CT-009,023 · CA-15: CT-007,024 · CA-16: CT-013,025,026 · CA-17: CT-001,002,003,008,010,014,015,027,028,030

## Distribuição CT → task
T1: CT-001,002,003 · T2: CT-004,005,006,007,013 · T4: CT-011,025 · T5: CT-010 · T6: CT-026 · T10: CT-008,014,015,024,027,028,030 · T11: CT-017,018,022,029 · T12: CT-009,012,016,021,023 · T13: CT-019,020
Lacunas (QA generator): T3 (controller unicidade/carimbo), T7/T8/T9 (regressão por operação portada).
