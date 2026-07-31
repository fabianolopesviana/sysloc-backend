# Rule candidates — caracterizacao-regras-legadas/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] Modelo único do projeto

**Regra que isto sugere:** Este projeto roda **exclusivamente em Opus**

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "Este projeto roda **exclusivamente em Opus** — vale para a sessão principal e para **todo subagente** despachado por qualquer skill do agent-spec, incluindo executor, `agent-spec-qa-validator` e `agent-spec-staff-architecture-review`. **Sonnet e Haiku estão proibidos**, mesmo onde o `SKILL.md` os re" — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Idioma de toda interação

**Regra que isto sugere:** **Todas as respostas e interações em português brasileiro**

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Todas as respostas e interações em português brasileiro** — não só documentação e mensagens de commit." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Decisões de produto vinculantes

**Regra que isto sugere:** As **40 decisões** de `.claude/plans/plano-saas-decisoes.md`

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "As **40 decisões** de `.claude/plans/plano-saas-decisoes.md`." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Stack aprovada é vinculante

**Regra que isto sugere:** A **stack inteira** de `docs/plano-backend-novo/decisao-e-stack.md` §4

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "A **stack inteira** de `docs/plano-backend-novo/decisao-e-stack.md` §4." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Serviços nativos sob systemd

**Regra que isto sugere:** **Sem Docker**; serviços nativos sob systemd

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Sem Docker**; serviços nativos sob systemd." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Multi-tenancy como fundação

**Regra que isto sugere:** **Multi-tenancy é fundação, não retrofit**: RLS e FK composta antes da primeira entidade de negócio

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Multi-tenancy é fundação, não retrofit**: RLS e FK composta antes da primeira entidade de negócio." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] IDs legíveis preservados no contrato

**Regra que isto sugere:** **IDs textuais legíveis preservados**

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**IDs textuais legíveis preservados** — o frontend os exibe ao usuário como título de contrato, label de select e campo "Identificador"." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] WhatsApp modelado sem implementação

**Regra que isto sugere:** **Canal WhatsApp fica só modelado, sem implementação**

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Canal WhatsApp fica só modelado, sem implementação** — os campos permanecem no modelo de domínio; `whatsapp`/`ambos` recusados na validação Zod." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Ciclo de vida do backend legado

**Regra que isto sugere:** **O Frappe é desinstalado ao final**; até lá fica de pé

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**O Frappe é desinstalado ao final**; até lá fica de pé." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Virada direta sem ensaio

**Regra que isto sugere:** **Decisão 40 respeitada**: virada direta, sem fase de ensaio dedicada

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Decisão 40 respeitada**: virada direta, sem fase de ensaio dedicada — não re-litigada neste brainstorm." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Gate de desinstalação sem espera

**Regra que isto sugere:** **Não há janela de rollback por tempo** (decidido nesta sessão, ramo E

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "**Não há janela de rollback por tempo** (decidido nesta sessão, ramo E — **revisa o `plano-execucao.md` F7 item 3**, que previa a stack antiga "desligada e intacta por semanas"). Justificativa do usuário: *"não faz sentido o Frappe ficar por semanas, já que ele não é backend SaaS — é inútil de todo " — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [pre_refinement_decision] Specs legadas são histórico, não estado

**Regra que isto sugere:** As specs em `docs/specs/features/` são do backend Frappe antigo: contexto histórico e fonte de conhecimento de domínio, **nunca** estado atual nem base de versionamento. Este proje

**O que ela faria (simples):** decisão fechada no pré-refinamento do programa; sem ela registrada, cada fatia re-litigaria o ponto e o executor pararia para perguntar.

- Evidência: "As specs em `docs/specs/features/` são do backend Frappe antigo: contexto histórico e fonte de conhecimento de domínio, **nunca** estado atual nem base de versionamento. Este projeto começa em `v1`, com nome de feature próprio." — `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-taskcard-run` · 2026-07-30T23:05:05-03:00

---

## [repeated_fixture] Leitura da credencial do docker-compose

**Regra que isto sugere:** centralizar a leitura de `MYSQL_ROOT_PASSWORD` do `docker-compose.yaml` num helper único compartilhado pelos scripts de operação

**O que ela faria (simples):** o mesmo bloco `awk` que extrai a credencial do serviço `db` foi copiado literalmente em três scripts; qualquer mudança no formato do compose (aspas, indentação, ordem dos serviços) precisa ser corrigida em três lugares e o drift silencioso faria um deles ler credencial vazia sem ninguém perceber.

- Evidência: bloco awk de extração de MYSQL_ROOT_PASSWORD idêntico em 3 scripts — `deploy/scripts/caracterizacao/preparar-site-efemero.sh:59`, `verificar-golden.sh:293`, `verificar-captura.sh:115` — `TC-001 / scripts de caracterização`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-31T00:41:20-03:00

---

## [repeated_assertion_shape] Harness de asserção em Bash dos scripts de verificação

**Regra que isto sugere:** extrair o harness de asserção (`caso`, `ok`, `falhar`, `afirmar_igual`, `fechar_caso`) para um arquivo sourceável único

**O que ela faria (simples):** os dois scripts de verificação definem o mesmo conjunto de funções de asserção com corpo idêntico, e o contador de falhas foi reimplementado nos dois; uma correção no formato de saída ou na contabilização de falhas aplicada em só um deles faria os dois relatórios divergirem sem sinal.

- Evidência: funções caso/ok/falhar/afirmar_igual/fechar_caso duplicadas verbatim — `deploy/scripts/caracterizacao/verificar-golden.sh:35`, `verificar-captura.sh:60` — `TC-001 / scripts de caracterização`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31T00:41:20-03:00

---

## [repeated_assertion_shape] Correlação bidirecional entre golden e manifesto

**Regra que isto sugere:** padronizar a forma da asserção de correlação golden↔manifesto — nomear a chave e os dois números, e exigir os dois sentidos

**O que ela faria (simples):** o cálculo de divergência de metragem e a exigência de correlação nos dois sentidos aparecem idênticos no produtor e nos dois verificadores; sem uma forma escrita, a próxima correlação desse tipo tende a nascer só num sentido, que foi exatamente o defeito corrigido nesta rodada (ALTO-002).

- Evidência: cálculo de divergência + correlação DIVERGENCIA-METRAGEM replicado em 3 arquivos — `deploy/scripts/caracterizacao/capturar.py:850`, `verificar-captura.sh:335`, `verificar-golden.sh:541`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31T01:25:05-03:00

---
