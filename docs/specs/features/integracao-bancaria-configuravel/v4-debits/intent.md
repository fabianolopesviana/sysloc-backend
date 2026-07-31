# Intent — Cleanup dos débitos da v3

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v4-debits
- **Variante**: backend
- **Parent**: v3
- **Source**: agent-spec-debt-resolution

---

## 2. Objetivo

Limpar os **4 débitos técnicos** anotados na `v3` da feature — a versão que corrigiu a exposição pública do certificado digital.

Origem: [`../v3/_run/run-report.md`](../v3/_run/run-report.md) §2.

---

## 3. Débitos selecionados

| ID | Categoria | Título | Classificação | Custo |
|----|-----------|--------|---------------|-------|
| D-001 | architecture | Docstring promete garantia mais forte que a real + literal `"certificado_arquivo"` duplicada | recomendado_corrigir | ~20min |
| D-002 | error_handling | Garantia do `content_hash` é condicional a o ativo ter `File` próprio | recomendado_corrigir | ~10min |
| D-003 | error_handling | `_replicar_vinculo_certificado` apaga vínculos antes de validar o alvo | **perfumaria** | ~60min |
| D-004 | code_quality | `_obter_pendente` tem nome de leitura e contrato de escrita | recomendado_corrigir | ~10min |

Total estimado: **~100min**. Todos os 4 estão no mesmo arquivo (`integracao_bancaria_api/service.py`).

> **D-003 foi incluído por decisão explícita do usuário**, ciente de que o especialista o classificou como perfumaria com **risco de regressão médio** — é o único que altera lógica de runtime, na mesma função que causou o incidente de produção e custou 3 tentativas na v3.

---

## 4. Escopo reduzido por decisão do especialista

Em **D-001** e **D-002**, o especialista **discordou da correção proposta pelo Tech Review** e reduziu o escopo. As tasks seguem a versão reduzida:

- **D-001**: o TR sugeriu mover a garantia para o `on_update`/`before_save` do controller da DocType. **Descartado** — passaria a executar o helper em *todo* `save()` do sistema (migrations, patches, bulk edit), criando um caminho de disparo não coberto pelos 120 testes atuais. Fica: corrigir a redação do docstring + extrair a literal para constante de módulo.
- **D-002**: o TR sugeriu checagem de runtime antes do `delete_doc`. **Descartado** — o cenário é reconhecidamente inalcançável (o ativo sempre carrega o próprio `File` pós-correção), o que tornaria a checagem especulativa na função mais sensível do arquivo. Fica: declarar a premissa no docstring, sem tocar `_apagar_certificado_privado`.

---

## 5. Critério de sucesso

Os 4 débitos resolvidos, suíte de **120 testes** verde sem regressão, e nenhuma alteração no comportamento de segurança validado na v3 (o certificado nunca publicado, provado por mutação).
