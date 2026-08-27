# Insumo para o pré-refinamento — `publicacao-e-backup/v1` (F7, metade de construção)

> **Como usar.** Entrada do `/agent-spec-pre-refinement`. Carrega o problema, o que já está
> decidido, o que **mudou** desde a decisão original, e as duas coisas que precisam ser resolvidas
> **antes** de a fatia começar.
>
> ⚠️ **Esta fatia não é a virada.** Ela é a **metade de construção da F7** — o item 1 inteiro
> (backup/restore) mais a religação da borda, que o plano punha no item 3 e que uma premissa nova
> autoriza antecipar (§3). A **execução** da virada e a desinstalação do Frappe continuam fora, para
> a sessão operacional futura.
>
> ⚠️ **Modelo**: este projeto roda **exclusivamente em Opus**. Onde o `SKILL.md` recomendar Sonnet,
> leia Opus. ⚠️ **Idioma**: português brasileiro em tudo.
>
> ⚠️ **Todas as medições deste documento são de 2026-08-25**, feitas contra o servidor real. Onde
> houver número, ele foi medido, não estimado — e onde uma premissa foi refutada por medição, isso
> está dito com todas as letras.

---

## 0. ⚠️ AÇÕES PRÉVIAS — resolva ANTES de rodar o discovery

### 0.1 Uma ADR precisa nascer antes do framework

Há **uma** decisão arquitetural transversal nova no caminho desta fatia, e ela não está decidida em
lugar nenhum do repositório: **a política de limitação de abuso na borda pública.**

O `D27 · F4/T11` registra a tensão sem resolvê-la, e ela é real nos dois sentidos:

- sem limitador, a API exposta aceita abuso de quem descobrir o hostname;
- com limitador **por endereço de origem**, uma **rajada legítima do provedor bancário** seria
  descartada — e perder notícia de baixa é pior que o abuso que se quis evitar.

O `agent-spec-pre-refinement` (Passo 3, item 5) manda registrar a decisão **antes** do comando do
framework: *"a ADR captura a decisão evergreen uma vez; o framework escolhido referencia-a depois."*
Sem isso, o sinal de "decisão arquitetural nova" empurraria a fatia para SDD sem necessidade (§7).

**Comando:** `/agent-spec-adr-create "Política de limitação de abuso na borda pública"`

### 0.2 A janela assistida precisa estar combinada

**8 dos 11 verificadores deste repositório exigem privilégio administrativo**, e o `sudo` deste host
pede senha interativa. A consequência já é medida e documentada — o commit `513e9da` a resume:

> *"na prática ninguém as executava. O efeito é medido, e apareceu duas vezes no mesmo dia — o
> `CT-647` estava quebrado havia três fatias, e o banco durável estava cinco migrações atrás do
> repositório. Nenhum dos dois constava de débito algum."*

A lição registrada é literal: ***bateria que ninguém executa não é rede — é a aparência de uma.***

Esta fatia precisa de **duas janelas com o usuário presente**: uma no início (baseline, P1 do
Protocolo Antirregressão) e uma no fim (comparação caso a caso, P5). Elas **não são tasks de um
bloco** — são a moldura em volta de todos eles, porque a religação da borda muda a infraestrutura
que as baterias medem.

---

## 1. O problema, em uma frase

**O backend está completo e inalcançável, e o banco onde os dados do cliente vão nascer não tem
backup.** Publicar o app do Sysloc hoje entrega uma tela que recebe HTML onde espera JSON; e o
primeiro incidente de disco seria irrecuperável, porque o plano já eliminou a janela de rollback por
tempo e a rede de segurança passou a ser *"um dump preservado"* que não existe.

---

## 2. O que existe hoje, e o que está errado nele

Medido em 2026-08-25:

| Frente | Estado medido |
|---|---|
| `syslocadmin.systera.com.br/v1/sessao` | **`401 application/json`** — `{"codigo":"NAO_AUTENTICADO"}`. **Pronto e funcionando** |
| `sysloc.systera.com.br/v1/sessao` | **`200 text/html`** — o `try_files` do SPA engole `/v1/*` e devolve o `index.html` |
| API | escuta em **`127.0.0.1:3000`** (`ENDERECO_DE_ESCUTA`, `apps/api/src/configuracao/ambiente.ts:287`) |
| Backup | **não existe** — nem `deploy/scripts/backup/`, nem uma linha com `pg_dump` no repositório |
| Limitador de taxa | degradado a **um balde único por caminho** para o produto inteiro: sem `trustedProxies`, `getIp` devolve `null` e a chave vira `no-trusted-ip|<caminho>` (`D27 · F1/T6`) |
| Bundle da porta 8300 | carrega a **credencial de API do ERPNext em texto claro** — pendência aberta registrada no `CLAUDE.md` |

⚠️ **O modo de falhar do `/v1` no Sysloc é o pior possível: `200`.** Não é 404 nem 502. O app chama,
recebe `200 OK`, roda `.json()` e estoura `Unexpected token '<'` — o que parece bug do frontend, não
do servidor. Qualquer aceitação desta fatia tem de asserir o **`content-type`**, nunca só o status.

---

## 3. O que já está DECIDIDO — e o que MUDOU desde a decisão original

### Decidido, e não se rediscute

- **O desenho do backup** está fixado no `plano-execucao.md` §F7 item 1: `pg_dump -Fc` + tar dos
  segredos → `/opt/backups/sysloc/daily/`, autenticação por `.pgpass` 0600 (**nenhuma senha em
  script versionado** — ADR-0005), verificação com `pg_restore --list`, `restore` com `--dry-run` e
  confirmação explícita, systemd timer na janela das 02:30.
- **A prova é a restauração**, não o dump: *"backup do banco novo restaurado com sucesso num banco
  vazio"* é item do gate de desinstalação e critério de aceitação da F7.
- **Sem janela de rollback por tempo** (revisão 2 do plano). A rede de segurança é o dump preservado.

### O que MUDOU, e é o que autoriza esta fatia a existir agora

1. ⚠️ **O Frappe não está em uso.** Decisão do usuário, declarada em **2026-08-25**: o cliente não
   usa o sistema antigo, está esperando o app novo, e **os cadastros vão nascer pela tela do backend
   novo**. Isso derruba a razão pela qual `sysloc.systera.com.br` era intocável — ele serve o
   container `sysloc-react-1` (hash `md5 07251c2e…`, idêntico a `127.0.0.1:8300`), que atende
   ninguém. **Esta é a premissa que move a religação da borda do item 3 da F7 para dentro do marco.**
   Se ela deixar de valer, a fatia **para** e escala.
2. ⚠️ **O `D24 · F1/T5` está fechado DE FATO, pela topologia.** Medido: `/docs` nos dois hostnames
   devolve o `index.html` do app (728 e 477 bytes, sem a palavra "swagger"), enquanto a API local
   devolve 3130 bytes de Swagger. Como o proxy é escopado a `/v1/`, o documento **não é alcançável
   de fora**. O marcador continua no código e precisa ser reconferido, não presumido.
3. ⚠️ **O `D23 · F1/T8` NÃO bloqueia a entrada — a premissa dele envelheceu.** O marcador prevê
   *"o serviço inteiro inacessível a navegador, entrada inclusive"*. Medido em três pontos:

   | Requisição | Resultado |
   |---|---|
   | POST `/v1/auth/sign-in/email` **via vhost**, `Origin` do painel | **`422 CAMPO_INVALIDO`** — passou a conferência de origem |
   | idem, `Origin: https://malicioso.example` | **`403 ACESSO_NEGADO`** — recusado |
   | idem, **direto na API local**, `Origin` do painel | **`403 ACESSO_NEGADO`** |

   A validação está ativa e discrimina corretamente: o proxy repassa o `Host` e a checagem resolve
   same-origin dinamicamente, em vez de comparar com o `127.0.0.1` literal. **Isto NÃO declara o
   débito fechado** — três `curl` não são a prova que ele pede, e nem todas as rotas de `/v1/auth/*`
   foram medidas. Declara que **a premissa precisa ser remedida antes de virar trabalho**, que é
   exatamente o precedente que o `CLAUDE.md` registra: *"a frase que explica por que algo não pode
   ser feito envelhece mais rápido que o débito que ela justifica — meça a premissa antes de
   registrá-la."*

---

## 4. O que a fatia herda pronto (não construa de novo)

- **O vhost do Master, provado em produção**: `/opt/web/syslocadmin/nginx/default.conf`. Ele vive no
  **nginx do container** (`listen 127.0.0.1:8400`), atrás do CloudPanel — **não** na configuração do
  CloudPanel. Tem `location /v1/` antes do `try_files`, `proxy_pass_header Set-Cookie`,
  `Cache-Control: no-store`, `/assets/` imutável e `\.map$ → 404`. O equivalente do Sysloc é
  `/opt/react/sysloc/nginx/default.conf`, hoje cheio da allowlist da TC-001 apontando para
  `host.docker.internal:8200`.
- **O agregador de baterias**: `deploy/scripts/verificacao/rodar-baterias.sh` (247 linhas, criado em
  2026-08-23). Não é trabalho a criar — é trabalho a **executar**.
- **`migrar-banco.sh`** e **`criar-sysloc-master.sh`/`.mjs`** — o provisionamento inicial existe.
- **Os dois scripts de deploy do frontend**, já ajustados para o backend novo, com a checagem que
  assere `content-type` em `/v1/sessao` e a conferência de integridade do bundle publicado.
- **Suíte em 1943 casos verdes**, 9 pacotes, e o banco durável **em dia** (28 migrações, bateria
  `2/2`, `118 OK / 0 FALHA` desde 2026-08-23).

---

## 5. Perguntas a explorar no discovery

1. **A política de limitação na borda** (§0.1) — como conciliar proteção da API exposta com a rajada
   legítima do provedor? Por rota? Por origem com lista de exceção? Só nas rotas de sessão?
2. **A rede do container do Sysloc.** O do Master usa a rede do host (`listen 127.0.0.1:8400`,
   `proxy_pass http://127.0.0.1:3000`); o do Sysloc está em bridge, publica `0.0.0.0:8300->80` e
   fala `host.docker.internal:8200`. Alinhar ao modelo do Master, ou manter bridge e apontar
   `host.docker.internal:3000`?
3. **O `sysloc-react-1` sai ou fica?** Tirá-lo do caminho fecha a credencial ERPNext exposta na 8300.
   Mantê-lo preserva um caminho de consulta ao legado que ninguém usa.
4. **Onde o build do Sysloc cai.** Manter `/opt/react/sysloc/html` (hoje `777 root:root` — permissão
   de contorno) não muda o `deploy-sysloc.sh`. É a hora de dar posse real ao usuário `sysloc`, como
   já acontece no Master (`/opt/web/syslocadmin/html`, `sysloc:sysloc`)?
5. **Retenção do backup.** O plano fixa a janela das 02:30 e o destino, mas **não diz por quantos
   dias**. Decisão de produto, e o disco está em 79%.
6. **O dump final da base antiga entra aqui?** O gate de desinstalação exige *"dump final da base
   antiga e dos segredos preservado em `/opt/backups/sysloc/`"*. Ele é pré-requisito da virada, não
   da religação — mas o mecanismo é o mesmo que esta fatia constrói.

---

## 6. Restrições que a fatia herda

- **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) — P1 e P5 com as duas janelas
  assistidas (§0.2), e as três linhas antes de cada edição.
- **ADR-0006** — a suíte **nunca** executa contra o ambiente que atende a operação. Enquanto
  `/opt/frappe` estiver de pé, o guarda de `verificar-provisionamento.sh` depende de
  `/etc/sysloc/producao`, que é item do gate de desinstalação e **não** desta fatia.
- **Invariante 3** — nenhum segredo versionado. O `.pgpass` 0600 e o tar de segredos vivem fora do
  repositório.
- **Invariante 7** — tudo sobe sozinho após reboot: `Persistent=true` no timer.
- ⚠️ **O `D9 · F0/T2` DISPARA nesta fatia.** O gatilho é *"a próxima fatia que escrever um
  `verificar-*.sh`"*, e o backup precisa de um para provar a restauração em banco vazio. São **11
  cópias do esqueleto**, e o marcador manda fechar **com janela assistida** — a mesma que a §0.2 já
  exige. Isso é escopo, e precisa estar declarado desde o task plan, não descoberto no meio.
- **A superfície da API está CONGELADA.** Nenhuma rota nasce, muda ou sai nesta fatia. As âncoras de
  `cobertura-de-autorizacao.e2e.spec.ts` (`106 / 91 / 20`) devem sair intactas.

---

## 7. Framework recomendado: **miniSpec**

Aplicada a tabela de decisão do `agent-spec-pre-refinement`:

| Dimensão | Valor | Sinal |
|---|---|---|
| Rumos | 2–3 (o backup tem desenho fixado; a religação tem 2–3 caminhos reais) | miniSpec |
| Personas | dev + operador = `dev+1` | miniSpec |
| Natureza | incremento sobre infra existente, com o Master como modelo provado | miniSpec |
| Greenfield | não | miniSpec |
| Decisão arquitetural nova | **uma**, e sai por ADR **antes** (§0.1) | neutralizado |

**O precedente do repositório confirma.** Das 14 fatias com spec, **13 rodaram SDD** — e todas as 13
são código de negócio, com regra de domínio e ADR nova em quase todas. **A única que rodou miniSpec
é a `fundacao-stack-nativa/v1`, a F0**: Node, Postgres, Redis, systemd, verificadores. Infraestrutura
pura, 7 tasks. Esta fatia é a mesma natureza — `pg_dump`, timer, nginx, limitador —, com **zero regra
de negócio**.

**Por que NÃO SDD** (o vizinho acima): não há múltiplas personas, não é greenfield, não há regra de
domínio, e a única decisão arquitetural nova é extraída para ADR antes do framework, que é o que o
Passo 3.5 prescreve. Os princípios anti-viés são explícitos — *"NÃO recomende SDD por default"* e
*"em empate, desça"*.

**Por que NÃO TaskCard** (o vizinho abaixo): 2–3 rumos e ~12 tasks, não um ajuste pontual de 0–1
rumo; e dois débitos exigem decisão de desenho.

### As duas metades ficam na MESMA fatia, e a razão é de segurança

Não é economia de run. Num `task_plan.md` único, **a ordem backup → religação fica explícita e o
pipeline a respeita**. Separadas, nada impede rodar a religação primeiro — e essa é exatamente a
sequência irrecuperável: expor à internet o banco onde os dados do cliente vão nascer, sem dump
preservado. Tamanho estimado: ~12 tasks, que cabe (a `webhook-e-carne` fez 12, a
`automacoes-agendadas` 11).

### O que fica FORA desta fatia

- **Publicar o `@sysloc/contracts`** (hoje `private: true`, `version 0.0.0`) — item 3 do marco.
- **Prova do caminho do dia 1** (Master entra → cria empresa → Admin entra → primeiro cadastro),
  o **`virada.md`** e os **adendos aos dois handoffs**.
- Os dois blocos acima são **intervenção dirigida**: não há o que um Gate de QA morda em publicar um
  pacote ou escrever um documento — e o `CLAUDE.md` registra que a intervenção dirigida responde por
  **57 dos 137** fechos deste repositório, contra 21 da skill.
- **A execução da virada e a desinstalação do Frappe.** Continuam na sessão operacional futura.

---

## 8. Referências dentro do repositório

| O quê | Onde |
|---|---|
| O desenho do backup e o gate de 5 itens | `docs/plano-backend-novo/plano-execucao.md` §F7 |
| Os 8 itens do marco de entrega | `CLAUDE.md`, "O ponto exato onde o trabalho deste repositório termina" |
| O vhost provado do Master | `/opt/web/syslocadmin/nginx/default.conf` (fora do repo, no servidor) |
| O vhost a religar | `/opt/react/sysloc/nginx/default.conf` (idem) |
| O agregador de baterias | `deploy/scripts/verificacao/rodar-baterias.sh` |
| `D23 · F1/T8` | `apps/api/src/autenticacao/autenticacao.module.ts:132` |
| `D24 · F1/T5` | `apps/api/src/main.ts:111` |
| `D27 · F1/T6` | `packages/auth/src/autenticacao.ts:570` |
| `D27 · F4/T11` | `deploy/nginx/sysloc-notificacao-bancaria.conf:88` |
| `D9 · F0/T2` | `deploy/scripts/instalacao/verificar-provisionamento.sh` |
| A lição das baterias | commit `513e9da`, e `fundacao-multitenancy-identidade/v1/_run/run-report.md` |
| ADR-0005 (segredos) · ADR-0006 (separação de ambiente) | `docs/adr/` |
