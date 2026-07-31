# Rule candidates — saas-multi-empresa/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [convention_drift] Fidelidade da exportação de DocType existente

**Regra que isto sugere:** conversão de DocType já existente para arquivo versionado exporta cada propriedade do valor real do banco, nunca do arquivo de referência.

**O que ela faria (simples):** o piloto copiou `autoname: hash` e `naming_rule: Random` do DocType de referência sobre um banco que tinha os dois vazios, e o contrato escrito só alerta contra omitir propriedade — não contra substituí-la. Como o `import_doc` apaga e reinsere o metadado, replicar isso em `Cobranca` ou `Contrato` destrói a série de nomeação de forma silenciosa e irreversível. A regra fixaria quais chaves têm de ser lidas do `tabDocType` de cada cadastro antes de escrever o `.json`.

- Evidência: `autoname`/`naming_rule` herdados do arquivo de referência (`hash`/`Random`) sobre um banco com `NULL`/`""`; `issingle`/`istable` ausentes do molde do piloto enquanto 4 dos 13 cadastros da T2 os exigem — `app-sync/locacao_automation/locacao_automation/locacao_automation/doctype/conjunto/conjunto.json:4` e `:27`; `docs/specs/features/saas-multi-empresa/v1/tasks/T1.md:386` — T1 / saas-multi-empresa v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-29T12:05:00Z

---

## [convention_drift] Método de exportação de DocType versionado

**Regra que isto sugere:** versionamento de DocType existente usa o exportador do framework (`export_to_files` / `bench export-doc`), nunca montagem manual do `.json`.

**O que ela faria (simples):** o contrato da T1 mandou montar o `.json` lendo uma lista de chaves escrita à mão, e a lista esqueceu `is_submittable` — o que faria `Contrato` perder o fluxo de submissão sem nenhum teste acusar. O framework já tem um exportador que serializa a definição inteira por construção; uma regra que o torne o caminho obrigatório elimina a classe do erro em vez de depender de alguém manter a lista completa.

- Evidência: §7.1 prescreve exportação como leitura enumerada de 12 chaves de `tabDocType`; `frappe/modules/export_file.py::export_to_files` e `bench export-doc` produzem o `.json` completo e não dependem de `developer_mode`; a enumeração manual omitiu `is_submittable`, única divergência material fora da lista entre os 14 cadastros — `docs/specs/features/saas-multi-empresa/v1/tasks/T1.md:356`, `:367`, `:207` — T1 / saas-multi-empresa v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-29T13:40:00Z

---

## [convention_drift] Forma canônica do .json de DocType

**Regra que isto sugere:** a saída de `export_to_files` é a forma canônica do `.json` de DocType versionado, e nenhum arquivo gerado é normalizado à mão.

**O que ela faria (simples):** o app já tem dois `.json` escritos à mão que declaram chaves falsy e terminam com quebra de linha, e o primeiro gerado pelo exportador não tem nem uma coisa nem outra; sem regra escrita, cada revisor decide se a divergência é erro ou padrão, e a tentação é normalizar o gerado — o que quebra a reprodutibilidade pelo framework. A regra fixa qual forma vale e proíbe a edição pós-exportação.

- Evidência: `conjunto.json` gerado pelo exportador omite `editable_grid`/`track_changes` e não tem newline final; os dois cadastros de referência declaram `allow_rename: 0`, `editable_grid: 0` e `index_web_pages_for_search: 0` e terminam em `}\n` — `app-sync/.../doctype/conjunto/conjunto.json:45`, `.../configuracao_integracao_bancaria.json:7`, `.../auditoria_configuracao_bancaria.json:7`, `docs/specs/features/saas-multi-empresa/v1/tasks/T1.md:482` — T1 / saas-multi-empresa v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-29T14:30:00Z

---

## [convention_drift] Compose cria o site por serviço one-shot

**Regra que isto sugere:** todo projeto Compose do repositório provisiona o site por serviço one-shot versionado, não por comando manual em comentário.

**O que ela faria (simples):** o compose de produção já cria o site por um serviço `create-site`, mas o compose novo trocou isso por quatro comandos escritos num comentário — então subir o artefato versionado não produz o ambiente, e a pegadinha do `allow_tests` só existe na evidência da task. A regra faria todo compose novo nascer com o provisionamento dentro do arquivo, mantendo o ambiente reproduzível por um comando.

- Evidência: `docker-compose.yaml` da raiz define o serviço one-shot `create-site` (linhas 40-69); `docker-compose.stack-nova.yaml` não o porta e move `new-site`/`install-app`/`migrate`/`set-config allow_tests` para um bloco de comentário de uso — `deploy/compose/docker-compose.stack-nova.yaml:50`, `:78`, `docker-compose.yaml:40` — T9 / saas-multi-empresa v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-29T17:30:00Z

---

## [convention_drift] Portão de verificação em arquivo versionado

**Regra que isto sugere:** verificação que outra task deve reexecutar vive em arquivo versionado e executável, nunca em bloco de código dentro de evidência `.md`.

**O que ela faria (simples):** o portão que a T2 herdaria foi publicado como bloco de código na evidência da T9, e o bloco publicado divergiu do que foi realmente executado: faltavam os dois imports, e o `except Exception` engolia os `NameError`, fazendo o portão reportar verde sem testar nada. Uma regra que exija arquivo versionado e executável faz o artefato verificado ser o mesmo artefato herdado, e permite que o gate seguinte rode o arquivo em vez de reimplementá-lo a partir de prosa.

- Evidência: bloco `python` da §7.A.7 sem nenhuma linha de import (varredura `grep -nE '^\s*(from|import) '` em T9.md não retorna nada); rodado verbatim: 738 `NameError` engolidos pelo `except Exception: pass`, saída `0 orfaos` idêntica à linha de base verde documentada — `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:554`, `:800` — T9 / saas-multi-empresa v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-29T20:15:00Z

---

## [repeated_fixture] Invocação canônica do portão anti-órfão

**Regra que isto sugere:** publicar a invocação do portão em um único lugar derivável (script wrapper), em vez de repeti-la em cada artefato.

**O que ela faria (simples):** o mesmo preâmbulo de execução do portão está copiado em três pontos e as cópias já divergiram — duas passam só duas variáveis de contrato e uma passa três, e é justamente a variável faltante que reabre o "verde por amostra pequena". Uma regra apontando um único invocador canônico impede que a próxima variável de contrato nasça em um lugar só.

- Evidência: preâmbulo `exec -T -e PORTAO_SITE=... backend ... < deploy/scripts/portao_orfaos.py` repetido em 3 pontos, com conjunto de variáveis divergente — `deploy/scripts/portao_orfaos.py:44`, `:55`, `deploy/compose/docker-compose.stack-nova.yaml:127` — T9 / portão herdado pela T2
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-29T22:00:00Z

---

## [repeated_assertion_shape] Casos de gate como arquivo de teste versionado

**Regra que isto sugere:** script de gate versionado (veredito por exit code) tem seus casos num arquivo de teste executável, não como bloco de saída colado na evidência da task.

**O que ela faria (simples):** a verificação do `veredito_suite.sh` é o mesmo formato de asserção repetido oito vezes na prosa da T9 (`printf '<placar emulado>' | veredito_suite.sh` + exit esperado) — ela prova o gate hoje, mas não roda amanhã, e este gate vai ser herdado por T2, T3 e CI. Uma regra apontando onde esses casos moram faria a próxima alteração do predicado quebrar um teste em vez de depender de alguém reler a evidência de uma task fechada.

- Evidência: oito asserções `printf '<placar>' | veredito_suite.sh` → exit esperado, todas em prosa de evidência, sem arquivo de teste executável correspondente — `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:1253`, `:1257`, `:1259`, `:1263`, `:1264` — T9 / gate de veredito da suíte e portão anti-órfão
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-29T23:30:00Z

---
