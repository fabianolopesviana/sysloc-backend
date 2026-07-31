# Relatório do Run — contencao-credencial-exposta/v2-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, escalonamento) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **2/2 tasks concluídas** · **168 testes verdes** (`bench --site frontend run-tests --app locacao_automation`)

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Convergência do conjunto de Custom DocPerm (D-003) | sonnet → opus (escalado) | 0 criados, 4 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Remover asserção infalível em CT-060 (D-005) | sonnet | 0 criados, 1 mod | ✅ APROVADO | — (gates=[qa]) |

**T1 exigiu 3 tentativas** (o máximo). **T2 aprovada na primeira.** Execução sequencial — o guard de paths disjuntos falhou porque ambas tocam `tests/test_patch_criar_papel_servico_app.py`.

### O que este run entregou além do cleanup pedido

O Tech Review da T1 descobriu, lendo a fonte do Frappe instalado, que **o patch `criar_papel_servico_app` nunca reexecutava** — está no `Patch Log` de produção desde 2026-07-27 16:24:44 e `patch_handler.py:75` só roda `if patch not in executed`. Isso significava que:

- a correção que a T1 acabava de escrever seria **código inalcançável**;
- a convergência de flags aprovada na `v1` (correção do P2, CT-061) **também** só havia rodado uma vez;
- a evidência "migrate 2×, exit 0, 1 Role + 9 DocPerm" era **não-discriminante** — é exatamente o que se observa com o patch sendo pulado.

Na 2ª rodada o revisor foi além: `frappe/installer.py:307-308` chama `set_all_patches_as_completed`, que **insere a linha no `Patch Log` sem executar o patch**. Logo o patch é pulado **até em site novo** — a afirmação "bootstrap de site novo", que havíamos gravado na ADR-0003, era falsa.

Resultado: `after_migrate` registrado em `hooks.py` como veículo **único** de criação e reimposição, com a ADR-0003 corrigida para descrever a realidade. Isso conserta um bug latente que ninguém tinha visto: **antes desta task, um site novo nunca ganharia o papel `Servico App`**.

### Verificação em produção

Ambos os gates provaram empiricamente, de forma independente, que a reconvergência agora ocorre. A prova do QA foi a mais forte: semeou **dois** `Custom DocPerm` residuais (`permlevel=1` em `Locatario`) mais `export=1` no DocPerm de `Atraso`, commitou, rodou `bench migrate` e conferiu que o estado voltou a 9 registros com os **mesmos `name`** do baseline, `export` de volta a 0, e o **`Patch Log` inalterado** — o que só é compatível com "o `after_migrate` rodou", e incompatível com "nada rodou".

## 2. Débitos Técnicos Não Resolvidos

> Todos de severidade **baixa**. Nenhum bloqueou a conclusão.

### D1 · baixo · tests · T1 · QA — ✅ RESOLVIDO (v3-debits/T1)
- **Onde:** `app-sync/locacao_automation/locacao_automation/hooks.py:16`
- **Problema:** o registro do `after_migrate` não tem rede regressiva na suíte. Apagar essa lista deixaria os 168 testes verdes, embora a garantia de runtime da ADR-0003 deixasse de existir.
- **Impacto:** três modos de falha silenciosos ficam descobertos — hook removido, typo no dotted path, e função resolvida que deixou de convergir. Hoje só apareceriam num `bench migrate` de produção.
- **O que fazer:** em task futura (a §4.3 desta task proibia adicionar testes além do CT exigido), acrescentar um teste que resolva o dotted path pelo mesmo mecanismo do framework — `frappe.get_hooks("after_migrate")` + `frappe.get_attr`, como em `frappe/migrate.py:145-147` — semeie um resíduo e chame a **função resolvida**, não o import direto. Falsificável contra remoção do hook, typo no path e regressão de convergência.

### D2 · baixo · architecture · T1 · Tech Review (P3)
- **Onde:** `app-sync/locacao_automation/locacao_automation/hooks.py:14` → `locacao_automation.patches.v1_0.criar_papel_servico_app.execute`
- **Problema:** invariante de segurança **permanente** ancorada num módulo de `patches/v1_0/`, diretório cuja convenção é ser artefato histórico descartável. O docstring ainda se apresenta como "Patch 3".
- **Impacto:** faxina rotineira de patches antigos quebraria o `frappe.get_attr` do hook em runtime, sem erro em tempo de escrita. A variante perigosa: o mantenedor então remove a linha do `after_migrate` para "destravar o migrate", eliminando em silêncio o único controle que impede permissão residual de sobreviver no papel de credencial pública.
- **O que fazer:** extrair `execute()` e auxiliares para módulo permanente (ex.: `locacao_automation/permissoes/servico_app.py::convergir()`), com o patch delegando a ele e o `after_migrate` + a citação da ADR-0003 reapontados. Não foi feito aqui porque exigiria **criar** arquivo, e a §3.1 da task declara "nenhum arquivo a criar".

### D3 · baixo · adr_compliance · T1 · Tech Review (P4) — ✅ RESOLVIDO (v3-debits/T2)
- **Onde:** `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md:37`
- **Problema:** a subseção nova afirma corretamente o que o `patches.txt` **não** faz, mas não delimita o que ele **continua** fazendo — um patch novo, num site já existente, não está no `Patch Log` e roda normalmente no `bench migrate` seguinte.
- **Impacto:** a subseção é hoje o registro mais recente e assertivo do projeto sobre patches. Sua leitura natural ("patches.txt é vestigial") tensiona a premissa da ADR-0002 e pode levar um autor futuro a mover uma migração de dados one-shot e **não-idempotente** para o `after_migrate`, onde reexecutaria a cada migração — o inverso exato do erro que este run corrigiu.
- **O que fazer:** uma frase no fim do segundo bullet, no mesmo parágrafo: "O mecanismo de patch segue válido no caso para o qual existe (ADR-0002) — um patch novo, num site já existente, não está no `Patch Log` e roda no `bench migrate` seguinte; o que o `install_app` inutiliza é apenas o patch já presente no repositório no momento em que o site é criado."

> Os cinco débitos da `v1` **não selecionados** nesta rodada (D-001, D-002, D-004, D-006, D-007) continuam registrados em `scope.md §2`, com endereço natural declarado (F2, F3 ou curadoria de regra).

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

### Decisões suas neste run

1. **Commit da TC-001 para resetar o baseline.** A feature anterior estava `git add`-ada sem commit, e como T1/T2 tocam os mesmos arquivos, os gates receberiam o diff da criação misturado ao do cleanup. Dois commits: `ac7c788` (contenção) e `4dc6c83` (specs e relatórios).
2. **`after_migrate` em vez de novo módulo de patch** (P1 da T1), com a consequência de trazer `hooks.py` e a ADR-0003 para dentro do escopo declarado — ampliação registrada na §3.2 da task.
3. **Corrigir o P2 junto** (consulta única fail-safe no DELETE).

### Ponto que merece sua atenção

**A T1 mudou o comportamento de todo `bench migrate` do app.** Uma exceção em `execute()` durante o `after_migrate` agora **aborta o migrate** — escolha deliberada do executor por falha ruidosa, avaliada e aceita pelos dois gates. O Tech Review mediu o colateral: `post_schema_updates` é `@atomic`, então um erro descarta `sync_jobs`, `sync_fixtures`, `sync_customizations`, `sync_dashboards`, `sync_languages`, `flush_deferred_inserts` e `remove_orphan_doctypes` — mas `run_schema_updates` tem `@atomic` próprio e já commitou, todas as etapas descartadas são idempotentes, e o próximo migrate as refaz. Estado parcial autocurável, sem site irrecuperável.

### Achado operacional relevante

Durante a 2ª rodada o QA observou um `Custom DocPerm` inesperado em produção e, em vez de aceitar, tentou reproduzir **três vezes** com estado limpo (CT isolado, módulo completo, suíte completa) — sempre com resultado limpo. Concluiu ser artefato de uma sessão `bench console` concorrente. Isso **só é possível porque a suíte roda contra o site de produção** (débito D-006 da `v1`, adiado para F2) e reforça: não rodar a suíte em paralelo com outra sessão no site.

### Fase B da TC-001 continua retida

Nada neste run tocou produção além da reconvergência verificada. A credencial `bc237221b65b5ed` do `Administrator` **segue válida**, os 3 `.map` seguem publicados, `developer_mode` segue em 1 e os 6 dumps seguem na raiz.
