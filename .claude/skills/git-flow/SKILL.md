---
name: git-flow
description: >-
  Orquestra TODO o trabalho de git de ponta a ponta com um único comando,
  mantendo a branch main sempre atualizada no local E no remoto (o "porto
  seguro"). Detecta o contexto automaticamente: se você está na main, commita
  (mensagem semântica pt-BR), sincroniza e faz push; se está numa feature
  branch, integra na main por rebase linear, faz push e deleta a branch. Faz
  também a limpeza de branches já integradas (local e remoto) e o prune de
  refs órfãs. É autônoma, mas com salvaguardas invioláveis: NUNCA faz
  force-push na main, NUNCA deleta trabalho não integrado e PARA em conflito
  para você decidir. Use sempre que o usuário disser "sobe isso", "atualiza a
  main", "sincroniza o git", "commita e faz push", "limpa as branches",
  "integra minha branch", "manda pro remoto", "/git-flow" ou simplesmente
  quiser deixar o repositório e a main em dia sem pensar nos comandos. Na
  primeira execução num projeto, roda uma varredura de configuração do git
  (local e remoto — identidade, remoto, autenticação, upstream, proteção de
  branch) e conduz a correção passo a passo antes de liberar o fluxo.
---

# git-flow — Git profissional de ponta a ponta

Um único ponto de entrada para todo o ciclo de git. O usuário chama a skill; ela
diagnostica o estado do repositório, escolhe o fluxo certo pelo contexto e
executa cada passo profissional na ordem correta, deixando a **main atualizada e
idêntica no local e no remoto** ao final. Trabalho sujo commitado, branches
integradas por rebase (histórico linear), branches concluídas deletadas, refs
órfãs limpas.

> **Fronteira com `agent-spec-semantic-commit`:** aquela skill só redige/executa
> UM commit local e por regra **não faz `git add` nem push**. Esta skill
> **orquestra o ciclo inteiro** — faz staging, gera o commit reusando as mesmas
> convenções de mensagem (Conventional Commits pt-BR), sincroniza, faz push,
> integra e limpa. Quando precisar só de uma mensagem de commit isolada, use
> `agent-spec-semantic-commit`; quando quiser "deixar tudo em dia", use esta.

---

## Fase C — Configuração (roda UMA vez por projeto)

Antes de qualquer outra coisa, a skill garante que o repositório — **local e
remoto** — está apto a sustentar TODO o fluxo (commit → rebase → push →
integração → limpeza). Sem isso, a automação quebra no meio e deixa o
repositório num estado ambíguo.

> As **Salvaguardas invioláveis** (seção seguinte) valem integralmente durante a
> configuração. Leia-as antes de executar qualquer passo daqui.

### C.0 — Gate de entrada (primeira coisa de todo run)

```bash
CONFIG_FILE=.claude/git-flow.local.json     # marcador por clone (NÃO versionado)
CONFIG_VERSION=1                            # versão do checklist desta skill
cat "$CONFIG_FILE" 2>/dev/null
```

- Arquivo existe **e** `config_version` >= `CONFIG_VERSION` **e**
  `remote_url` bate com o `origin` atual → **configuração já validada**: pule
  direto para a Fase 0 e siga o fluxo normal. Não mencione a Fase C no relatório.
- Arquivo ausente, `config_version` menor (o checklist evoluiu), `remote_url`
  divergente, ou o usuário pediu explicitamente (`/git-flow --reconfigurar`) →
  execute a Fase C completa **antes** da Fase 0.

### C.1 — Varredura (diagnóstico, tudo somente leitura)

Rode em bloco e monte o laudo. Nada é corrigido nesta etapa.

```bash
# --- LOCAL ---
git --version                                          # L1
git rev-parse --is-inside-work-tree                    # L2
git rev-parse HEAD 2>/dev/null                         # L2b (HEAD nascido?)
git config user.name; git config user.email            # L3
git symbolic-ref --short HEAD                          # L4 (nome da branch atual)
git config pull.rebase; git config rebase.autoStash    # L5
git config fetch.prune                                 # L6
git config push.default; git config push.autoSetupRemote  # L7
ls .gitignore && git ls-files | grep -iE '(^|/)\.env|\.pem$|\.key$|id_rsa|credentials|secret'  # L8
cat .gitattributes 2>/dev/null                         # L9
git config core.autocrlf                               # L10
ls .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null  # L11

# --- REMOTO ---
git remote -v                                          # R1, R2
git config --get-all remote.origin.fetch               # R11
git ls-remote --heads origin | head                    # R3 (leitura/auth) + R5 (repo vazio?)
git push --dry-run origin HEAD 2>&1 | tail -3          # R4 (escrita/permissão)
git rev-parse --abbrev-ref origin/HEAD 2>&1            # R6
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>&1  # R7
command -v gh && gh auth status                        # R10
git remote get-url origin | sed -E 's@^(https://[^/]+/|git@[^:]+:)@@; s@\.git$@@'  # R9 (OWNER/REPO)
# R9: consultar a proteção da default por uma das vias de C.2.1 — nunca deduzir do dry-run
```

### C.2 — Checklist completo

Legenda: **[B]** = bloqueante (sem isso a skill NÃO roda o fluxo) ·
**[R]** = recomendado (pode ser dispensado pelo usuário, fica registrado).

#### Local

| ID | Verifica | OK quando | Correção |
|----|----------|-----------|----------|
| L1 [B] | Versão do git | `>= 2.23` (`git switch`/`restore`). Ideal `>= 2.37` (`push.autoSetupRemote`) | Atualizar o git. Abaixo de 2.37, usar sempre `git push -u origin <branch>` na primeira publicação |
| L2 [B] | Repositório e HEAD | `--is-inside-work-tree` = true **e** existe ao menos 1 commit | `git init -b main` e um commit inicial (`git commit --allow-empty -m "chore: commit inicial"`) |
| L3 [B] | Identidade | `user.name` e `user.email` definidos **e o e-mail vincula à conta do host** (domínio real, e-mail verificado ou noreply do host) | Ver **C.2.1 — Passo L3**. Rejeitar placeholders (`codex@local`, `you@example.com`, `root@localhost`, qualquer coisa sem ponto no domínio) |
| L4 [B] | Nome da branch principal | Igual ao default do remoto (`main` ou `master`) | `git branch -m <atual> main` (confirmar antes). Definir `git config --global init.defaultBranch main` para os próximos repos |
| L5 [R] | Rebase no pull | `pull.rebase=true` (+ `rebase.autoStash=true`) | `git config pull.rebase true` · `git config rebase.autoStash true`. Dispensável: o fluxo já passa `--rebase` explícito |
| L6 [R] | Prune no fetch | `fetch.prune=true` | `git config fetch.prune true`. Dispensável: a Fase 0 já usa `--prune` explícito |
| L7 [R] | Comportamento do push | `push.default=simple` e `push.autoSetupRemote=true` | `git config push.default simple` · `git config push.autoSetupRemote true` |
| L8 [B] | Segredos e lixo | `.gitignore` existe e cobre `.env*`, `*.pem`, `*.key`, `credentials*`, `secret*`, caches/logs — **e nenhum desses já está rastreado** | Acrescentar os padrões (mostrar o diff antes). Se já rastreado → **PARE**: `git rm --cached` só com confirmação explícita, e alerte que o segredo continua no histórico (rotacionar a credencial) |
| L9 [R] | Normalização de EOL | `.gitattributes` com `* text=auto eol=lf` | Criar/acrescentar a linha. Sem isso a Fase 2.2 vira ruído recorrente |
| L10 [R] | `core.autocrlf` | `input` em Linux/macOS, `true` em Windows | `git config core.autocrlf input` (ou `true` no Windows) |
| L11 [B] | Estado limpo p/ configurar | Sem rebase/merge/cherry-pick em curso e sem detached HEAD | Concluir ou abortar a operação pendente antes de seguir (perguntar ao usuário) |
| L12 [R] | Assinatura de commits | Só exigido se o remoto exigir commits assinados (ver R9) | `git config commit.gpgsign true` + chave GPG/SSH configurada e publicada no host |

#### Remoto (a parte que mais quebra — cheque item a item)

| ID | Verifica | OK quando | Correção |
|----|----------|-----------|----------|
| R1 [B] | Remoto único chamado `origin` | Exatamente um remoto, nome `origin` (salvaguarda 7) | `git remote add origin <url>`. Múltiplos remotos → **PARE** e pergunte qual é o alvo |
| R2 [B] | URL e protocolo | URL válida e protocolo consciente: SSH (`git@host:org/repo.git`) ou HTTPS (`https://host/org/repo.git`) | Definir com o usuário e aplicar `git remote set-url origin <url>`. **NUNCA** embutir token na URL (vaza em `.git/config`, logs e `git remote -v`) |
| R3 [B] | Autenticação de **leitura** | `git ls-remote --heads origin` responde sem pedir senha nem falhar | **SSH:** chave existe (`ls ~/.ssh/id_ed25519.pub`), senão `ssh-keygen -t ed25519 -C "email"`; carregar no agente (`eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519`); publicar a **pública** no host (`gh ssh-key add ~/.ssh/id_ed25519.pub` ou colar em Settings → SSH keys); validar com `ssh -T git@github.com`. **HTTPS:** `gh auth login` ou credential helper (`git config --global credential.helper store\|manager\|cache`) com PAT de escopo `repo` |
| R4 [B] | Autenticação de **escrita** | `git push --dry-run origin <default>` retorna `Everything up-to-date` / `would push` (sem `403`) | `403`/`permission denied` → a credencial não tem permissão de escrita: revisar escopo do PAT / acesso de colaborador no repositório |
| R5 [B] | Repositório remoto existe e não está vazio | `git ls-remote --heads origin` lista ao menos a branch default | Remoto vazio → publicar a base: `git push -u origin main`. Repositório inexistente → criar no host (`gh repo create <org>/<nome> --private --source=. --remote=origin`) |
| R6 [B] | `origin/HEAD` definido | `git rev-parse --abbrev-ref origin/HEAD` devolve `origin/<default>` | `git remote set-head origin -a`. **A Fase 0 depende disso** para descobrir a branch default |
| R7 [B] | Upstream da branch principal | `@{u}` da default local = `origin/<default>` | `git fetch origin && git branch --set-upstream-to=origin/<default> <default>` |
| R8 [B] | Nomes coerentes | Nome da default local == nome da default remota | Renomear a local (L4) ou alinhar a default no host |
| R9 [B] | Proteção de branch | Estado da default **conhecido**: push direto permitido (`flow_mode: "direct"`) ou modo PR ativado (`flow_mode: "pr"`) | Ver **C.2.1 — Passo R9**. Nunca deduza do `push --dry-run`: com `Everything up-to-date` nenhum ref é atualizado, então o hook de proteção **não é exercitado** |
| R10 [R] | `gh` CLI | Instalado e autenticado (`gh auth status`) | `gh auth login`. Obrigatório **apenas** para a Variante PR. Para checar R9 há alternativas sem `gh` (C.2.1). Ausente + branch protegida (R9) → vira bloqueante |
| R11 [R] | Refspec de fetch íntegra | `remote.origin.fetch` = `+refs/heads/*:refs/remotes/origin/*` | `git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'`. Refspec parcial quebra `--prune` e a Fase 3 |

### C.2.1 — Os dois passos que sempre exigem condução ativa

L3 e R9 quase nunca se resolvem com um comando único: um depende de dado que só
o host tem, o outro decide **qual fluxo** a skill vai executar. Conduza os dois
com o roteiro abaixo.

#### Passo L3 — Identidade que vincula à conta do host

**Por que importa:** um e-mail placeholder (`codex@local`, `you@example.com`)
produz commits órfãos — não aparecem no perfil do autor no host, não contam
contribuição e não dá para rastrear autoria de verdade. Pior: só se descobre
depois de dezenas de commits, e corrigir exige reescrever histórico — proibido
pela salvaguarda 2.

1. Descubra o e-mail **noreply** do host (opção recomendada: vincula à conta sem
   expor o e-mail pessoal no histórico público):
   ```bash
   # com gh:
   gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"'
   # sem gh, com PAT em HTTPS:
   curl -s -H "Authorization: Bearer $GITHUB_PAT" https://api.github.com/user \
     | grep -E '"(id|login)"'
   # sem nenhum dos dois: GitHub → Settings → Emails → "Keep my email addresses private"
   ```
   O formato é `ID+login@users.noreply.github.com`.
2. **Pergunte ao usuário** as duas decisões — nunca escolha por ele:
   - qual identidade assina (nome exibido + noreply **ou** e-mail real
     verificado na conta do host);
   - qual escopo: **só este repositório** (padrão) ou `--global`.
3. Aplique e revalide:
   ```bash
   git config user.name "Nome Sobrenome"
   git config user.email "ID+login@users.noreply.github.com"
   git config user.name && git config user.email
   ```
4. Avise que **commits antigos mantêm a identidade anterior** — isso é esperado
   e **não** deve ser corrigido com `rebase`/`filter-branch` (salvaguarda 2).

#### Passo R9 — Proteção da branch default

**Por que importa:** se a default for protegida, o Fluxo A e o passo 4 do Fluxo
B só falham **no push final** — com o trabalho já commitado e rebaseado, no pior
momento possível. Descobrir isso na configuração é o que separa um run limpo de
um repositório travado no meio.

1. Extraia `OWNER/REPO` da URL do `origin`:
   ```bash
   git remote get-url origin | sed -E 's@^(https://[^/]+/|git@[^:]+:)@@; s@\.git$@@'
   ```
2. Consulte o estado, na primeira via disponível:
   ```bash
   # (a) com gh — mais completo (exige permissão de admin no repo):
   gh api "repos/OWNER/REPO/branches/BRANCH/protection"
   #     200 = protegida (leia required_pull_request_reviews, required_status_checks,
   #     required_signatures, enforce_admins) · 404 "Branch not protected" = livre

   # (b) sem gh, com PAT — o campo booleano `protected` não exige admin:
   curl -s -H "Authorization: Bearer $GITHUB_PAT" \
     "https://api.github.com/repos/OWNER/REPO/branches" | grep -E '"(name|protected)"'
   ```
   - **(c)** Se a sessão tiver um servidor MCP do GitHub, `list_branches` devolve
     o mesmo campo `protected` sem precisar de PAT na mão.
   - **(d)** Host que não seja GitHub (GitLab, Bitbucket, self-hosted): use a API
     equivalente do host. Não conseguindo checar por nenhuma via,
     **pergunte ao usuário** — não presuma `direct`.
3. Decida e registre:
   - **Não protegida** → `flow_mode: "direct"`, fluxo normal.
   - **Protegida** → `flow_mode: "pr"`: a skill passa a integrar pela Variante PR
     e o `gh` (R10) vira **bloqueante**. Se a proteção exigir commits assinados,
     L12 também vira bloqueante.
4. **Nunca** teste a proteção fazendo push de trabalho real para ver se passa.

### C.3 — Condução: um passo por vez

Nunca despeje a lista inteira nem execute correções em lote. Para **cada** item
reprovado, na ordem da tabela (Local antes de Remoto, bloqueantes antes de
recomendados):

1. Diga o que está errado e **por que importa para o fluxo** (qual fase quebra).
2. Mostre o **comando exato** da correção.
3. **Pergunte** e aguarde o OK. Um passo por vez — não antecipe o próximo.
4. Execute e mostre a **evidência** (saída do comando + a re-checagem daquele item).
5. Marque ✅ e só então avance para o próximo.

Regras da condução:

- `git config` **sem `--global`** por padrão (escopo do repositório). Alterar
  config global só com autorização explícita, item a item.
- Criar/alterar `.gitignore` e `.gitattributes` sempre mostrando o diff antes.
- Passos que exigem ação **fora do terminal** (colar chave SSH no GitHub, criar
  PAT, ajustar proteção de branch) são instruídos com o passo a passo e a skill
  **espera** o usuário confirmar que fez, então revalida.
- Item **[B]** recusado pelo usuário → a configuração não conclui: a skill
  **não grava o marcador** e **não executa** o fluxo normal; relata o que falta.
- Item **[R]** recusado → registrado em `dispensados` no marcador e o fluxo segue.

### C.4 — Revalidação e selagem

Concluídos os passos, rode a varredura da **C.1 inteira de novo** (não confie no
resultado dos passos isolados). Com todos os **[B]** aprovados e os **[R]**
aplicados ou dispensados, grave o marcador:

```json
{
  "config_version": 1,
  "configured_at": "AAAA-MM-DD",
  "default_branch": "main",
  "remote_url": "https://github.com/org/repo.git",
  "auth": "https-pat | ssh",
  "flow_mode": "direct | pr",
  "checks_ok": ["L1","L2","L3","L4","L8","L11","R1","R2","R3","R4","R5","R6","R7","R8","R9"],
  "dispensados": []
}
```

Grave em `.claude/git-flow.local.json` e garanta que ele está no `.gitignore`
(é estado **por clone** — credenciais e identidade não são do projeto, são da
máquina). Reporte "Configuração concluída" com a evidência dos itens e siga para
a Fase 0 no mesmo run.

A partir daí, todo run futuro cai no gate C.0 e vai direto ao fluxo normal —
até que o `config_version` da skill suba, o `origin` mude ou o usuário peça
`--reconfigurar`.

---

## Salvaguardas invioláveis (nunca viole, mesmo em modo autônomo)

Estas regras têm prioridade sobre qualquer automação. A main é o porto seguro —
protegê-la vem antes de qualquer conveniência.

1. **NUNCA `push --force` / `--force-with-lease` na main** (nem em qualquer
   branch já publicada e compartilhada). Se um push na main for rejeitado
   (non-fast-forward), a resposta é `pull --rebase` e repetir — nunca forçar.
2. **NUNCA reescreva histórico já publicado na main.** Rebase só é permitido
   sobre commits locais que ainda não foram enviados ao remoto, ou dentro de uma
   feature branch pessoal.
3. **NUNCA delete uma branch com trabalho não integrado na main.** Use sempre
   `git branch -d` (minúsculo, seguro — recusa branch não mergeada). Só use
   `-D` (maiúsculo) após confirmação explícita do usuário.
4. **NUNCA descarte trabalho não commitado.** Nada de `git reset --hard`,
   `git checkout -- .` ou `git clean` sem confirmação explícita. Para proteger
   mudanças no meio de uma operação, use `git stash` (recuperável), nunca delete.
5. **PARE em conflito.** Qualquer conflito de merge/rebase interrompe o fluxo. A
   skill mostra o estado, lista os arquivos em conflito e as opções (resolver ou
   abortar) e **pergunta**. Nunca resolva conflito automaticamente.
6. **NUNCA commite segredos.** Antes de qualquer commit, verifique se algum
   arquivo staged casa com padrões sensíveis (`.env`, `.env.local`, `*.pem`,
   `id_rsa`, `*.key`, `credentials*`, `secret*`). Se casar e não estiver no
   `.gitignore`, PARE e avise — não commite.
7. **Só opere com um único remoto `origin`.** Se houver múltiplos remotos ou o
   `origin` não existir, PARE e pergunte o alvo.

Ao PARAR por qualquer salvaguarda, deixe o repositório num estado consistente e
explique ao usuário exatamente o que aconteceu e quais são as opções.

---

## Fase 0 — Pré-voo (diagnóstico, sempre)

Rode em bloco e leia o estado antes de agir:

```bash
git rev-parse --is-inside-work-tree                 # é repo git? senão, aborte
git remote -v                                        # existe origin? é único?
DEFAULT_BRANCH=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's@^origin/@@')
# fallback: se origin/HEAD não estiver definido, assuma 'main'
CUR=$(git symbolic-ref --short HEAD 2>/dev/null)     # branch atual (vazio = detached HEAD)
git fetch --all --prune                              # traz refs remotas + remove refs de branches deletadas no remoto
git status --short --branch                          # sujo/limpo + ahead/behind
```

Interprete e decida:

- **Detached HEAD** (`CUR` vazio) → PARE e avise; peça em qual branch trabalhar.
- **Sem `origin`** → salvaguarda 7: PARE e pergunte.
- **`DEFAULT_BRANCH`** é o nome da main (normalmente `main`; pode ser `master`).
  Use essa variável em todo o fluxo — nunca hardcode `main`.
- Anote `ahead`/`behind` vs upstream para o relatório final.

---

## Fase 1 — Detectar contexto e rotear

```
CUR == DEFAULT_BRANCH  → Fluxo A (Estou na main)
CUR != DEFAULT_BRANCH  → Fluxo B (Estou numa feature branch)
```

---

## Fase 2 — Curadoria de staging (OBRIGATÓRIA antes de qualquer commit)

**NUNCA faça `git add -A` cego.** Staging cego varre lixo de runtime e churn de
fim de linha para dentro do histórico — o oposto de trabalho impecável. Antes de
commitar (nos dois fluxos), execute esta curadoria em três passos.

### 2.1 — Curar arquivos NÃO rastreados (`??`)

```bash
git status --short | grep '^??'                    # lista os untracked
```

Classifique cada untracked:

- **Versionável** (código, docs, config de projeto, scripts) → segue para o
  staging.
- **Lixo de runtime / local** (diretórios de ferramentas, logs de sessão,
  caches, settings locais — ex.: `.codex-runtime/`, `.playwright-mcp/`,
  `.claude/settings.local.json`, `*.log`, `dist/` efêmero) → **NÃO commite**.
  Proponha adicioná-lo ao `.gitignore` e só prossiga após o `.gitignore` cobrir.
- **Suspeito de segredo** (`.env*`, `*.pem`, `*.key`, `credentials*`,
  `secret*`) → salvaguarda 6: PARE e avise.

Nunca versione um untracked de dúvida sem o usuário confirmar. Em caso de muitos
untracked heterogêneos, mostre a lista classificada e confirme antes de seguir.

### 2.2 — Detectar e barrar churn de fim de linha (EOL) e espaço

Arquivos que aparecem modificados mas cujo diff é **só CRLF↔LF ou espaço** geram
ruído gigante (blame quebrado, diff ilegível) sem mudar nada. Detecte antes:

```bash
# Para cada arquivo rastreado modificado, veja se há conteúdo REAL:
for f in $(git diff --name-only); do
  git diff --numstat -- "$f" | grep -q '^-' && { echo "[BIN ] $f"; continue; }  # binário
  [ -z "$(git diff --ignore-all-space --stat -- "$f")" ] \
    && echo "[EOL ] $f  <- só fim de linha/espaço, ZERO conteúdo real" \
    || echo "[REAL] $f"
done
```

Para os marcados `[EOL]`: **não os commite como estão.** Confirme com o usuário e,
autorizado, **restaure-os** (`git restore -- <arquivo>`) para voltarem ao estado
do HEAD. Para impedir recorrência, garanta um `.gitattributes` com
`* text=auto eol=lf` (proponha criar se não existir). Só os `[REAL]` e `[BIN]`
com mudança intencional seguem para o staging.

### 2.3 — Checagem de segredos (salvaguarda 6)

Sobre o conjunto que será staged, verifique padrões sensíveis em nomes de
arquivo E conteúdo (`grep -inE '(password|secret|token|api[_-]?key|senha)'` em
configs/scripts). Qualquer suspeita não coberta por `.gitignore` → PARE e avise.

> Saída desta fase: um conjunto **curado** de mudanças reais, sem lixo, sem
> churn de EOL, sem segredos — pronto para virar um ou mais commits semânticos.

---

## Fluxo A — Estou na main

Objetivo: registrar o trabalho pendente, sincronizar com o remoto e deixar a
main idêntica nos dois lados.

1. **Commitar pendências (se houver).** Se `git status` mostra mudanças
   (staged, unstaged ou untracked relevantes):
   - Rode a **Fase 2 — Curadoria de staging** (untracked + EOL + segredos).
     **Nunca `git add -A` cego.**
   - Faça o staging apenas do conjunto curado (`git add <caminhos>` ou
     `git add -p`). Reporte quais arquivos entraram.
   - Gere a mensagem no padrão **Conventional Commits pt-BR** (ver
     "Convenção de mensagem" abaixo). Se o diff mistura responsabilidades
     claramente distintas (ex.: uma feature + um fix em módulo não relacionado),
     **prefira dividir em commits separados** por caminho.
   - `git commit -m "tipo(escopo): descrição"` (heredoc se houver corpo).
   - Se não há nada para commitar, siga direto para o passo 2.
2. **Sincronizar com o remoto (rebase, histórico linear):**
   ```bash
   git pull --rebase origin "$DEFAULT_BRANCH"
   ```
   - Conflito → salvaguarda 5: PARE e pergunte.
3. **Publicar:**
   ```bash
   git push origin "$DEFAULT_BRANCH"
   ```
   - Se rejeitado (non-fast-forward): significa que o remoto andou. Volte ao
     passo 2 (`pull --rebase`) e tente de novo. **Nunca force** (salvaguarda 1).
4. **Limpeza** (Fase 3 comum).
5. **Relatório** (Fase 4).

---

## Fluxo B — Estou numa feature branch

Objetivo: integrar a branch na main por rebase (linear), publicar e remover a
branch já concluída.

1. **Commitar pendências na branch (se houver)** — igual ao passo 1 do Fluxo A,
   mas na branch atual.
2. **Rebasear a branch sobre a main remota atualizada:**
   ```bash
   git fetch origin
   git rebase "origin/$DEFAULT_BRANCH"
   ```
   - Conflito → salvaguarda 5: PARE e pergunte (opções: resolver e
     `git rebase --continue`, ou `git rebase --abort`).
3. **Integrar na main por fast-forward** (mantém linearidade, sem merge commit):
   ```bash
   git switch "$DEFAULT_BRANCH"
   git pull --rebase origin "$DEFAULT_BRANCH"     # garante main local == remoto
   git merge --ff-only "$CUR"                      # fast-forward puro
   ```
   - Se o `--ff-only` falhar, a main avançou desde o fetch: volte a
     `git switch "$CUR"`, refaça o passo 2 e tente de novo. Nunca crie merge
     commit nem force.
4. **Publicar a main:**
   ```bash
   git push origin "$DEFAULT_BRANCH"
   ```
5. **Deletar a branch integrada** (local e remoto):
   ```bash
   git branch -d "$CUR"                            # -d recusa se não mergeada (salvaguarda 3)
   git push origin --delete "$CUR"                 # só se a branch existia no remoto
   ```
   - Se `git branch -d` recusar (branch não totalmente mergeada), NÃO force com
     `-D`: avise que há commits não integrados e pergunte.
6. **Limpeza** (Fase 3 comum) e **Relatório** (Fase 4).

> **Variante PR (opcional).** Se o usuário pedir explicitamente integração via
> Pull Request — ou se o marcador da Fase C trouxer `flow_mode: "pr"` (branch
> default protegida, R9): exige `gh` instalado (`command -v gh`). Se faltar, avise e
> ofereça o fluxo por rebase acima. Com `gh`: `git push -u origin "$CUR"` →
> `gh pr create --fill --base "$DEFAULT_BRANCH"` → após o merge do PR,
> `git switch "$DEFAULT_BRANCH" && git pull --rebase` e limpe a branch.

---

## Fase 3 — Limpeza de branches (comum aos dois fluxos)

Mantém o repositório enxuto sem risco de perder trabalho.

1. **Refs remotas órfãs** já foram podadas pelo `git fetch --all --prune` da
   Fase 0. Reforce se necessário: `git remote prune origin`.
2. **Branches locais já integradas na main** (exceto a main e a atual) são
   deletadas com segurança:
   ```bash
   git branch --merged "$DEFAULT_BRANCH" \
     | grep -vE "(^\*|^\+|\s${DEFAULT_BRANCH}$)" \
     | xargs -r -n1 git branch -d
   ```
3. **Branches NÃO integradas** nunca são tocadas — apenas **listadas** no
   relatório como aviso, para o usuário decidir:
   ```bash
   git branch --no-merged "$DEFAULT_BRANCH"
   ```
4. **Branches locais cujo upstream sumiu** (remoto deletado, marcadas `[gone]`)
   são candidatas a remoção, mas só se já mergeadas — o passo 2 já cobre isso.
   Liste as `[gone]` não mergeadas como aviso.

---

## Fase 4 — Relatório final (sempre)

Ao concluir (ou ao PARAR por salvaguarda), entregue um resumo claro:

- **Fluxo executado:** A (na main) ou B (integração de branch) — e por quê.
- **Commits criados:** hash curto + linha de assunto de cada um.
- **Sincronização:** `main` local e `origin/main` no mesmo SHA? Confirme com
  evidência (`git rev-parse HEAD origin/$DEFAULT_BRANCH` iguais).
- **Branches deletadas:** local e/ou remoto.
- **Avisos:** branches não integradas preservadas, segredos bloqueados,
  conflitos pendentes, qualquer passo pulado.
- Se PAROU: o estado atual e as opções concretas para retomar.

Nunca diga "está tudo sincronizado" sem mostrar a evidência de que os SHAs de
`main` local e `origin/main` batem (regra "funciona só com evidência").

---

## Convenção de mensagem de commit

Reusa integralmente as convenções de `agent-spec-semantic-commit`:

- Formato `tipo(escopo): descrição curta` — assunto em **minúsculas**, **≤ 72
  caracteres**, **sem ponto final**, verbo no **imperativo presente pt-BR**
  ("adiciona", "corrige", "atualiza", "remove").
- Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`,
  `ci`, `build`, `revert`. Na dúvida entre dois, prefira o mais específico
  (`fix` > `refactor` quando corrige bug).
- Corpo (opcional, separado por linha em branco) explica o **porquê**, não o
  como. Rodapé para `BREAKING CHANGE:` e `Closes #N`.
- Breaking change: `!` após tipo/escopo **e** `BREAKING CHANGE:` no rodapé.
- **NUNCA** inclua `Co-Authored-By: Claude` nem qualquer atribuição de autoria
  por IA — o commit sai como autoria exclusiva do usuário (alinhado à regra de
  `agent-spec-semantic-commit`).

Para exemplos por tipo, consulte
`.claude/skills/agent-spec-semantic-commit/references/exemplos.md`.

---

## Invariante de sucesso

Ao final de um run bem-sucedido, TODAS estas condições valem:

1. Não há trabalho pendente perdido — tudo relevante está commitado ou
   explicitamente preservado (stash/branch).
2. `main` local e `origin/main` apontam para o **mesmo commit**.
3. Nenhuma branch com trabalho não integrado foi deletada.
4. O histórico da main permanece **linear** (sem merge commits introduzidos por
   esta skill).
5. Nenhum lixo de runtime nem churn de fim de linha (EOL) entrou no histórico —
   a Fase 2 (Curadoria de staging) rodou e só mudanças reais foram commitadas.
6. O usuário recebeu um relatório com evidência dos SHAs.
