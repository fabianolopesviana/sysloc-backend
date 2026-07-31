# Relatório do Run — contencao-credencial-exposta/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, escolha de executor) vive em `_run/workflow-report.md`.
>
> ✅ **TaskCard encerrada: 15/15 ACs fechados.** Fase A em 2026-07-27 (aprovada pelos dois gates), Fase B (destrutiva) em 2026-07-28 mediante confirmação humana explícita, AC-14 validado no navegador na mesma data. Detalhe na §4.

## 1. Resumo do Run

Status: 1/1 task concluída (Fase A + Fase B) · **169 testes verdes** (`bench --site frontend run-tests --app locacao_automation`, reexecutados após a Fase B) · 2 tentativas

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| TC-001 | Contenção da credencial exposta (Fase A + B) | opus | 5 criados, 2 mod (repo) + 2 mod (produção) | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

**Ciclo:** executor → QA (aprovado) → Tech Review (**PARCIAL**: 1 ALTO + 2 MÉDIOS) → correção → QA (aprovado) → Tech Review (aprovado).

### Estado REAL de produção após a Fase B (2026-07-28)

| Componente | Estado | Reversão |
|---|---|---|
| `/opt/react/sysloc/nginx/default.conf` | Allowlist ativa + cabeçalho de proveniência + `location ~ \.map$ { return 404; }` | `cp reference/backups-tc001/default.conf.bak-tc001` + `docker restart sysloc-react-1` |
| `/opt/react/sysloc/html/static/js/main.3fb69968.js` | Servindo credencial do usuário de serviço | `cp reference/backups-tc001/main.3fb69968.js.bak-tc001` |
| Papel `Servico App` + 9 Custom DocPerm | Criados por patch versionado, aplicados por `bench migrate` | Exige patch inverso |
| Usuário `servico-app@dominio.com` | Ativo, `System User`, papel único `Servico App`, `api_key=31925d7e0cec526` | Segredo em `/opt/frappe/secrets/servico-app-credenciais.txt` (chmod 600) |
| `Administrator` / `api@dominio.com` | ✅ **REVOGADAS** — `api_key = NULL`, `api_secret` fora do `__Auth`. 401 pelo proxy e direto no backend | Irreversível por desenho. Se preciso, gerar par novo pelo Desk |
| 3 arquivos `.map` | ✅ **FORA DO AR** — movidos para `reference/backups-tc001/*.bak-tc001` (`chmod 600`); nginx responde 404 a qualquer `*.map` | `mv` de volta + remover o `location ~ \.map$` (não recomendado) |
| 6 dumps na raiz de `/opt/frappe` | ✅ **RAIZ LIMPA** — 5 arquivados em `/opt/backups/frappe/dumps-iniciais-2026-03-06/` (`chmod 600`, dir `700`); o `db-data.tar.gz` foi perdido num incidente (ver §4) | `mv` de volta do diretório de arquivo |
| `developer_mode` | ✅ **0** — `frappe.conf.developer_mode == 0` confirmado no processo | `bench --site frontend set-config -p developer_mode 1` + restart |
| `SHA256SUMS` | Reduzido à linha do `docker-compose.yaml`; `sha256sum -c` passa | Histórico Git preserva os hashes originais dos 6 dumps |

### Critérios de aceite

**Atendidos e verificados:** AC-02 (403 do nginx, distinguido por header/corpo HTML) · AC-03 (`get_list` barrado no nginx, `submit` negado pelo Frappe) · AC-04 (`grep` de api_key **e** api_secret → 0) · AC-06 (papel único, sem `System Manager`/`Administrator`) · AC-07 (permissão efetiva provada no motor do Frappe) · AC-08 (RN-11 intacta, `PermissionError` nos 3 métodos) · AC-09 (`migrate` 2× → 1 Role + 9 DocPerm) · AC-13 (`diff` vazio, `md5sum` idêntico em repo/host/container) · **AC-15** (novo — sombreamento observável com controle positivo).

**Fechados na Fase B (2026-07-28):** AC-01 (401 pelo proxy e direto no backend) · AC-05 (404 nos 3 `.map` e em qualquer `*.map`) · AC-10 (`developer_mode: 0` efetivo no processo) · AC-11 (`api_key = NULL`, 0 linhas em `__Auth`; o único `api_key` vivo no site é o do usuário de serviço) · AC-12 (`sha256sum -c` passa, raiz sem dumps).

**AC-14 / CT-021** (smoke E2E no navegador): validado pelo usuário em 2026-07-28, após o primeiro deploy pós-TC-001 (bundle `main.7154a9e7.js`). Verificação manual, sem evidência automatizada. **15 de 15 ACs fechados.**

## 2. Débitos Técnicos Não Resolvidos

> Todos de severidade **baixa** — não bloquearam a conclusão. Resolva de uma vez com `/agent-spec-debt-resolution docs/specs/features/contencao-credencial-exposta/v1/`.

### D1 · baixo · security · TC-001 · Tech Review (P4)
- **Onde:** `deploy/nginx/react-default.conf:44`
- **Problema:** endpoints `allow_guest` (`auth_locacao_imoveis`, `usuario_app.service.verificar_senha_usuario_app`) seguem sem `limit_req` — força bruta de senha sem atrito no proxy.
- **Impacto:** enumeração de credenciais do app sem custo, limitada só pela capacidade do backend. Contido porque a superfície já está fechada pela allowlist e a sessão real é reprojetada em F3.
- **O que fazer:** registrar como entrada formal de F3, ou aplicar `limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m` + `limit_req zone=auth burst=5 nodelay` em location dedicado, seguido de `nginx -t`, `docker restart sysloc-react-1` e nova cópia para o repositório (AC-13).

### D2 · baixo · code_quality · TC-001 · Tech Review (P5)
- **Onde:** `deploy/nginx/react-default.conf:44`
- **Problema:** regex da allowlist em linha única de ~890 caracteres, 4 níveis de aninhamento.
- **Impacto:** legibilidade apenas — o comportamento foi auditado contra 22 vetores de bypass nas duas rodadas e todos bloqueiam corretamente. O risco é adicionar um endpoint em F3 com erro de escape que passe despercebido.
- **O que fazer:** quando a allowlist for revisitada em F3, migrar para `map $uri $api_permitido { ... }` com uma entrada por linha; manter a paridade de AC-13 na mesma operação.

### D3 · baixo · security · TC-001 · Tech Review (P8) + QA (BAIXO-002) — ✓ em cleanup (v2-debits)
- **Onde:** `app-sync/locacao_automation/locacao_automation/patches/v1_0/criar_papel_servico_app.py:126`
- **Problema:** a convergência (correção do P2) reescreve os flags da linha declarada, mas não remove `Custom DocPerm` **estranho** do papel `Servico App` — uma linha em `permlevel > 0`, ou para um DocType fora dos 9, sobrevive a todo `bench migrate`.
- **Impacto:** baixo e contido — exige ação administrativa deliberada no Desk ("adicionar permissão para o papel X no DocType Y"), diferente do `export=1` marcado por acidente numa grade já existente. O docstring **não** promete esse comportamento, então não há divergência entre documentação e código.
- **O que fazer:** ao final de `execute()`, `frappe.db.delete("Custom DocPerm", {"role": NOME_PAPEL, "name": ["not in", nomes_declarados]})` + `frappe.clear_cache(doctype=...)` nos DocTypes afetados; acrescentar CT que semeie uma linha em `permlevel=1` antes do 2º `execute()` e verifique a contagem de volta a 9.

### D4 · baixo · code_quality · TC-001 · Tech Review (P9)
- **Onde:** `deploy/nginx/react-default.conf:26` e §6.1/§7.2 da TaskCard
- **Problema:** o comentário declara "15 entradas em `method/`", número que não bate com nenhuma contagem do regex — são 14 entradas ou 22 endpoints, dependendo de como o grupo `integracao_bancaria_api.service.(...)` (9 sufixos) é contado. **A imprecisão é herdada da §6.1 da TaskCard**, não introduzida pelo executor.
- **Impacto:** nenhum em comportamento. Quem auditar o regex contra o guardrail "não ampliar além dos 15 métodos" vai contar 22 e suspeitar de ampliação indevida.
- **O que fazer:** corrigir o número no cabeçalho do `.conf` (nos dois arquivos, preservando AC-13) e na §6.1/§7.2 da TaskCard, explicitando "14 entradas / 22 endpoints (o grupo de `integracao_bancaria_api.service` cobre 9 sufixos)".

### D5 · baixo · tests · TC-001 · QA (BAIXO-001) — ✓ em cleanup (v2-debits)
- **Onde:** `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py:422`
- **Problema:** `self.assertNotEqual(user.name, "Administrator")` compara o `name` de um `User` que o próprio teste acabou de inserir com um literal fixo — não existe estado do SUT em que falhe. Mesmo padrão que o gate classificou como `BAIXO-002` na attempt 1; reapareceu porque o card CT-022 pede literalmente esse passo.
- **Impacto:** ruído de leitura. As asserções discriminantes do CT-060 (leitura antes/depois nos 9 DocTypes + controle positivo) estão corretas e falsificáveis, então o valor do teste não está comprometido.
- **O que fazer:** remover a linha e manter apenas `self.assertIn("System Manager", frappe.get_roles(user.name))`, que é falsificável; ou trocar por `self.assertNotEqual(frappe.session.user, "Administrator")` no ponto da medição, que pode falhar de verdade. Ajustar também o passo do card CT-022 na §10.

### D6 · baixo · tests · TC-001 · QA (D7 da §11)
- **Onde:** `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py:98`
- **Problema:** o `setUp` de `_BasePapelServicoApp` apaga papel e `Custom DocPerm` no site `frontend`, que é **produção** (não há bench local nem site de teste dedicado). O `frappe.clear_cache()` é global e não transacional.
- **Impacto:** residual, não efetivo — o rollback do `FrappeTestCase` protege o estado e a verificação pós-suíte confirmou 1 Role + 9 DocPerm intactos. Mas é o `setUp` de maior blast radius do repositório.
- **O que fazer:** manter até F2 criar site de teste dedicado (recomendação explícita do QA — o hermetismo é o que dá valor ao CT-049). Então mover a suíte para um site `test_*` próprio, ou proteger o `setUp` com guard que aborte se `frappe.local.site` for produção.

### D7 · baixo · tests · TC-001 · QA (rule mining)
- **Onde:** 8 pontos da suíte (4 em `tests/test_patch_criar_papel_servico_app.py`, mais `test_integracao_bancaria_api.py:463`, `test_boletos_abertos.py:234` e `:295`, `test_certificado_api.py:1019`)
- **Problema:** helper de criação de `User` de teste com papéis replicado, com assinaturas já divergentes (um recebe booleano `com_system_manager`, outro recebe tupla de papéis).
- **Impacto:** correções de isolamento precisam ser aplicadas em N lugares.
- **O que fazer:** centralizar num helper compartilhado da suíte. Registrado também em `_run/rule-candidates.md` como candidato a regra de projeto.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

### A Fase B foi executada em 2026-07-28 — a exposição está fechada

A credencial `bc237221b65b5ed`, publicamente conhecida, **está morta**: 401 pelo proxy e direto no backend. Os 5 itens que faltavam:

1. ✅ `api_key`/`api_secret` do `Administrator` e do `api@dominio.com` revogados (AC-01, AC-11)
2. ✅ 3 `.map` fora da árvore servida, mais barreira `location ~ \.map$ { return 404; }` (AC-05)
3. ✅ `developer_mode: 0` no `site_config.json`, backend reiniciado (AC-10)
4. ✅ 5 dumps arquivados fora da raiz e `SHA256SUMS` ajustado (AC-12) — ver o incidente abaixo
5. ✅ Smoke E2E manual no navegador (AC-14 / CT-021) — validado pelo usuário em 2026-07-28

**Ordem seguida**: os guardrails da §7.1 foram respeitados — a credencial do usuário de serviço foi confirmada 200 **antes** da revogação, e nenhum script, cron ou `run-*.sh` a consumia (todos chamam `bench` direto no container). Após a Fase B: **169 testes verdes**, `Role = 1 | Custom DocPerm = 9` intactos, os 9 DocTypes respondendo 200 com a credencial de serviço, catch-all ainda em 403.

**Duas descobertas do caminho**, ambas incorporadas à §8 da TaskCard:

- **A remoção dos `.map` não bastava para o AC-05.** Sem barreira, o `try_files` do `location /` respondia **200 com o `index.html`** para `*.map` — não 404. O bloco `location ~ \.map$` fecha o AC literalmente e, de quebra, impede que um `deploy.sh` futuro reabra a exposição em silêncio.
- **`api_key` é `UNIQUE` em `tabUser`.** Gravar `""` em dois usuários violaria a constraint; a revogação usou `NULL`.

### 🔴 Incidente — perda do `db-data.tar.gz`

Um comando de arquivamento entregue como **one-liner para colar no terminal** quebrou em linhas ao ser colado, e o bash executou `mv /opt/frappe/mariadb_all.sql /opt/frappe/db-data.tar.gz` isoladamente — sobrescrevendo o `db-data.tar.gz` original (`a98238ee…`, 23 MB, snapshot físico do datadir de 06/03/2026). Não havia outra cópia no host.

O conteúdo do `mariadb_all.sql` sobreviveu intacto (hash `3615f1ad…` conferido) e teve o nome restaurado. Como o SQL é o **dump lógico completo da mesma data**, ele cobre o que o snapshot físico continha; o backup diário do cron cobre o estado atual. Os hashes originais dos 6 dumps continuam no histórico Git do `SHA256SUMS`.

**Lição operacional**: operação destrutiva multi-passo vai em **script** (`set -euo pipefail`, `mv -n`, guarda contra destino ocupado), nunca em one-liner colável. A retomada usou esse formato e correu limpa.

### Pipeline de deploy — ajustado e exercitado em 2026-07-28

O `deploy.sh` sobrescrevia `html/` com o build da máquina local, cujo `.env.local` ainda carregava o par revogado do `Administrator`. Com as chaves mortas, esse deploy **não reintroduziria uma exposição — derrubaria o app** (401 em tudo). Corrigido antes do primeiro deploy pós-TC-001:

- **`.env.local`** passou a usar o par do `servico-app` e ganhou `GENERATE_SOURCEMAP=false`. (Não existe nem deve existir um `.env` no projeto: no CRA o `.env.local` vence o `.env`, e manter os dois convida à divergência silenciosa.)
- **`deploy.sh`** ganhou quatro ajustes: (1) guarda pré-`rsync` que aborta se o build contiver qualquer credencial revogada — a rede que impede publicar um app morto; (2) `check_ping` substituído por validação **autenticada real**, que extrai a credencial do bundle publicado e faz `GET /api/resource/Imovel` — o antigo `GET /api/method/ping` era 403 garantido desde a Fase A, porque `ping` não está na allowlist, e teria abortado todo deploy **depois** do rsync; (3) guarda equivalente no `--rollback`, já que todos os backups anteriores a 2026-07-28 carregam a credencial revogada; (4) checks de que a allowlist e o bloqueio de `.map` continuam de pé.

**Resultado do deploy (2026-07-28 22:24)**: bundle `main.7154a9e7.js` publicado com a credencial do serviço, **zero** ocorrências das chaves revogadas, **zero** source maps em disco, `*.map` em 404, API autenticada em 200, catch-all em 403, `rsync --delete` sem deixar órfãos e paridade de md5 do nginx entre repo, host e container.

### Decisão arquitetural registrada neste run

O sombreamento de `Custom DecPerm` virou a **ADR-0003** (`docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md`), aceita pelo Tech Review como satisfazendo os 5 critérios canônicos. Consequência que **impacta o planejamento de `saas-multi-empresa` v2**: os 9 DocTypes de negócio passam a ser regidos exclusivamente por `Custom DocPerm`, e todo papel novo precisa declarar o seu explicitamente — inclusive `Sysloc Master`, `Admin Empresa` e `Usuario Empresa`.

### Qualidade da validação

O QA da 2ª rodada validou a correção do P2 por **teste de mutação**: trocou `papel.save()` por `frappe.db.set_value` no patch e confirmou que `test_ct062` falha com `'Website User' != 'System User'`, restaurando o arquivo em seguida (md5 conferido). Isso prova que o teste é discriminante para o detalhe fino — só `Role.on_update` repromove a `System User` quem foi rebaixado — e não decorativo.

### Achado que aponta erro na própria TaskCard

O Tech Review encontrou (P9 / D4) que o número "15 métodos" na §6.1 e no guardrail §7.2 não bate com o regex: são 14 entradas ou 22 endpoints. A imprecisão foi introduzida na **geração** da TaskCard, não pelo executor. Vale corrigir antes que alguém audite a allowlist contra um número errado.

### Executor

Não há agente de stack em `.claude/agents/` (só os três dos gates). As duas rodadas usaram o subagente genérico com `model: opus`, escolhido interativamente.
