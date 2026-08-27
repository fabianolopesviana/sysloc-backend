# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário, ou **medido** — quando medido, está dito).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

> ⚠️ **Autonomia do run (`.claude/rules/autonomia-do-run.md` §A1).** Esta skill manda pausar na Fase 1
> e usar `AskUserQuestion` em cada convergência. A rule, de escopo universal, manda **não pausar**:
> formular a decisão, adotar a recomendada e registrar. Foi o que se fez — cada convergência da
> seção 4 traz a recomendação, a razão e a marca `(A1)`. As decisões continuam abertas a ajuste: é o
> artefato que se corrige, não o run que se bloqueia.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `publicacao-e-backup`
- **Fonte da ideia**: `docs/specs/features/publicacao-e-backup/v1/insumo-do-pre-refinamento.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-25
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**: `docs/plano-backend-novo/plano-execucao.md` §F7 · `CLAUDE.md` (marco de entrega) · **ADR-0037** (criada hoje, antes deste documento) · ADR-0005 · ADR-0006 · ADR-0035

---

## 2. Ideia Resumida (uma frase)

Tornar o backend novo **alcançável** pelo app do Sysloc e **recuperável** de um incidente de disco —
religando a borda pública do hostname do cliente e entregando backup com restauração provada —, sem
que nenhuma rota nasça, mude ou saia.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Backup: o que se preserva, por quanto tempo, e como a restauração se prova | explorar |
| B | Alcance: como o `/v1` do Sysloc deixa de devolver HTML | explorar |
| C | Exposição: o que protege a superfície no instante em que ela é publicada | explorar |
| D | Convergência host ↔ repositório: o que está entregue no código e não está no servidor | **adicionado** (não estava no insumo — nasceu de medição) |
| E | Prova: como se sabe que funcionou, dado que ninguém executa as baterias | explorar |

**Decisão da Fase 1 (A1)**: explorar os cinco. O ramo **D** foi acrescentado por mim e é o único que
o insumo não previa — a razão está na seção 4 e ela é medida, não inferida. Alternativa considerada:
manter os quatro do insumo e tratar D como intervenção dirigida depois. Recomendada e adotada:
**incluir D na fatia**, porque publicar o app sem ele entrega um sistema que atende e **não cobra**.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Backup: o que se preserva, por quanto tempo, e como se prova

O desenho está travado pelo `plano-execucao.md` §F7 item 1 e **não se rediscute**: `pg_dump -Fc` +
tar dos segredos, `.pgpass` 0600, timer das 02:30, `pg_restore --list` como verificação. O que
**não** está decidido é a retenção e o que conta como prova.

**Direções candidatas:**

- **A1 — Retenção por contagem (N cópias diárias)**: guarda-se um número fixo de dumps e o mais antigo cai.
  - _Exemplo:_ 14 dumps diários; o de 12/08 sai quando o de 26/08 entra.
  - _Viabilidade:_ é o que o backup do Frappe já faz neste host — **medido**: `/opt/backups/frappe/daily` tem **18 entradas**, a última escrita **hoje às 02:30**.
- **A2 — Retenção por idade (N dias), com expurgo por data**: cai o que passou da idade, independentemente de quantos existam.
  - _Exemplo:_ tudo com mais de 30 dias sai; uma semana sem gerar dump não apaga os antigos.
  - _Viabilidade:_ **reusa padrão do repositório** — o expurgo por idade já existe e é provado: `CT-1087 (f)` (fatia `automacoes-agendadas`) prova que o reconhecimento decide **por idade, nunca por nome**.
- **A3 — Sem expurgo automático nesta fatia**: acumula, e a limpeza é operacional.
  - _Exemplo:_ o disco cresce até alguém olhar.
  - _Viabilidade:_ barata de entregar, cara de operar. **A premissa que a sustentava caiu** (ver abaixo).

**Direção escolhida (A1 da rule)**: **A2 — retenção por idade**, com a janela concreta a definir na
spec. Razão: o repositório já tem o molde provado de expurgo por idade e o `D26 · F4/T9` foi fechado
exatamente sobre essa propriedade; escolher A1 criaria uma segunda forma de decidir o que expira.

**Podadas / adiadas**:
- **A1** — podada: contagem esconde a falha silenciosa. Se o timer parar de rodar, N cópias permanecem e o conjunto **parece** saudável enquanto envelhece.
- **A3** — podada: era defensável sob a premissa do insumo de que *"o disco está em 79%"*. ⚠️ **Premissa REFUTADA por medição hoje**: `/` está em **20%** (24G de 128G, 99G livres) e `/boot` em 11%. Não há urgência de espaço — e é justamente por isso que A3 é pior: ninguém vai olhar.

⚠️ **Achado que muda o desenho, e não estava no insumo.** O insumo afirma que backup *"não existe"*.
Isso é verdade **do repositório** (não há `deploy/scripts/backup/` nem `pg_dump` em script versionado)
e **falso do host**: existe backup diário do Frappe rodando, na **mesma janela das 02:30** que o plano
reserva para o Sysloc, escrevendo no **diretório irmão** do destino planejado. Os dois vão coexistir
até a desinstalação. `[DÚVIDA 1]` e `[DÚVIDA 2]` tratam disso.

### Ramo B — Alcance: como o `/v1` do Sysloc deixa de devolver HTML

⚠️ **Medido por mim hoje, e o modo de falhar é o pior possível — `200`:**

| Alvo | Resultado medido |
|---|---|
| `https://sysloc.systera.com.br/v1/sessao` | **`200 text/html`** — o `try_files` do SPA engole `/v1/*` |
| `https://syslocadmin.systera.com.br/v1/sessao` | `401 application/json` — **pronto e funcionando** |
| `http://127.0.0.1:3000/v1/sessao` | `401 application/json` |

O app chama, recebe `200 OK`, roda `.json()` e estoura `Unexpected token '<'` — o que parece bug do
frontend, não do servidor.

**Direções candidatas:**

- **B1 — Espelhar o vhost do Master**: rede do host, `listen 127.0.0.1:8400`, `proxy_pass http://127.0.0.1:3000`, `location /v1/` **antes** do `try_files`.
  - _Exemplo:_ copiar `/opt/web/syslocadmin/nginx/default.conf` trocando porta e raiz.
  - _Viabilidade:_ **reusa desenho provado em produção** — é o único dos dois vhosts que hoje devolve JSON.
- **B2 — Manter o container em bridge e apontar `host.docker.internal:3000`**: mexe menos na topologia.
  - _Exemplo:_ trocar só o alvo do `proxy_pass` na allowlist da TC-001 que hoje aponta para `:8200`.
  - _Viabilidade:_ menor diff, mas **preserva duas topologias diferentes** para dois apps do mesmo produto.
- **B3 — Servir o app do Sysloc pela mesma unidade do Master**: um vhost só, dois caminhos.
  - _Viabilidade:_ **`[fora do escopo do projeto]`** — o `CLAUDE.md` fixa que o Painel Master é **aplicativo separado, com build próprio**, e o handoff dele é autossuficiente.

**Direção escolhida (A1)**: **B1 — espelhar o Master**. Razão: convergir as duas topologias custa
uma vez e elimina a classe inteira de defeito "funciona num hostname e não no outro"; e o modelo já
está provado contra o mesmo backend. **Recusar B2** é a decisão cara aqui, e a razão é o precedente
do repositório: **duas cópias que divergem** é a origem de metade dos débitos do índice.

**Podadas / adiadas**: **B2** — podada pela razão acima. **B3** — fora do escopo do projeto.

### Ramo C — Exposição: o que protege a superfície no instante em que ela é publicada

**A decisão transversal deste ramo já saiu — hoje, e antes deste documento**: **ADR-0037, Política de
limitação de abuso na borda pública** (`docs/adr/0037-politica-de-limitacao-de-abuso-na-borda-publica.md`).
Ela decide que a borda fornece o **eixo de origem** e não a política; que o teto é decidido na
aplicação, **por classe de rota**; e que a entrada de fato de terceiro (ADR-0035) **não** se limita
por taxa. Este ramo, portanto, não redecide nada — ele **executa** a ADR e fecha os débitos.

**Direções candidatas (o que a fatia faz com os quatro débitos de borda):**

- **C1 — Fechar os quatro no mesmo bloco**: `D23 · F1/T8` (origem confiável), `D24 · F1/T5` (`/docs*`), `D27 · F1/T6` (eixo de origem) e `D27 · F4/T11` (limitador no vhost do webhook).
  - _Exemplo:_ declarar `advanced.ipAddress` com o salto do vhost novo, e no mesmo diff rever o `CT-236 (c)`, que hoje **fixa por asserção** o estado compartilhado.
  - _Viabilidade:_ os quatro têm o **mesmo gatilho** e o mesmo fato faltante — qual é o salto confiável. Fechá-los separados significa declarar o mesmo salto duas vezes.
- **C2 — Fechar só o eixo de origem, adiar os demais**: entrega o mínimo.
  - _Viabilidade:_ deixa o `D24` aberto sobre uma premissa que **já mudou** — e a §3 do insumo mostra que ele está fechado *de fato* pela topologia (`/docs` devolve o `index.html` do app nos dois hostnames, e o proxy é escopado a `/v1/`).
- **C3 — Reconferir cada premissa antes de virar trabalho**: medir os quatro, e só então dimensionar.
  - _Exemplo:_ o `D23` prevê *"o serviço inteiro inacessível a navegador"*, e o insumo mediu três pontos que mostram a validação **ativa e discriminando** — a premissa envelheceu.
  - _Viabilidade:_ é o **precedente de método** do `CLAUDE.md`, reafirmado seis vezes: *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica — meça a premissa antes de registrá-la."*

**Direção escolhida (A1)**: **C1 + C3 compostos** — reconferir as quatro premissas **primeiro** (C3),
e fechar no mesmo bloco o que sobreviver à medição (C1). Razão: as duas não competem; C3 é a entrada
de C1. Três `curl` não são a prova que o `D23` pede, e presumir o `D24` fechado é a mesma classe de
erro que ele cometeria ao contrário.

**Podadas / adiadas**: **C2** — podada: adia débito cuja premissa já se sabe vencida, e o custo
marginal de fechá-lo na mesma janela é quase nulo (o próprio marcador do `D24` diz isso).

### Ramo D — Convergência host ↔ repositório *(acrescentado — nasceu de medição)*

⚠️ **Este ramo não está no insumo, e é o achado mais sério deste pré-refinamento.** Medido por mim
hoje, no host:

| O que o repositório entrega | O que está instalado em `/etc/systemd/system` |
|---|---|
| **6 timers** de rotina (`aviso-de-cobranca`, `conferencia-de-liquidacao`, `encerramento-de-contratos`, `manutencao`, `retomada-de-noticias`, `vigilancia-das-rotinas`) | **ZERO.** `systemctl list-timers` não lista um único `sysloc-rotina-*` |
| `sysloc-api.service`, `sysloc-worker.service`, 6 `.service` de rotina, `sysloc-alerta-de-rotina@.service` | **3 arquivos**, datados de **31/07 e 01/08** |
| `sysloc-worker.service` com `After=…postgresql.service…` / `Wants=postgresql.service…` | a unidade instalada **não declara `postgresql.service`** em nenhum dos dois |

**A F5 fechou em 2026-08-23 entregando as automações agendadas. Elas não rodam neste servidor.**
Publicar o app sem fechar isto entrega um sistema que atende requisição e **não cobra ninguém**: sem
os timers, não há aviso de cobrança, conferência de liquidação, encerramento de contrato, manutenção,
retomada de notícia parada nem vigilância das rotinas.

É a **mesma classe** do achado que o commit `513e9da` registra — *"o `CT-647` estava quebrado havia
três fatias, e o banco durável estava cinco migrações atrás do repositório. Nenhum dos dois constava
de débito algum"* — e a lição de lá se aplica literal: **entrega que ninguém instalou não é entrega,
é a aparência de uma.**

**Direções candidatas:**

- **D1 — Instalar o roster completo e afirmar a cobertura**: rodar `instalar-unidades.sh`, que já declara `UNIDADES` (roster completo) e `UNIDADES_DO_ARRANQUE` (o que se ativa), com o `CT-1060` afirmando a cobertura **nos dois sentidos**.
  - _Exemplo:_ um `.timer` versionado fora da lista seria um relógio que ninguém dá corda — e o caso já reprova isso.
  - _Viabilidade:_ **o instalador existe e está pronto**; o que falta é executá-lo com privilégio.
- **D2 — Instalar só os timers, deixando as unidades atuais como estão**: menor intervenção.
  - _Viabilidade:_ deixaria o `worker` sem a dependência de `postgresql.service` — que morde exatamente no **reboot**, o invariante 7.
- **D3 — Tratar como intervenção dirigida fora da fatia**: não entra no task plan.
  - _Viabilidade:_ possível, mas **desfaz a razão de as duas metades estarem na mesma fatia** (seção 7 do insumo): num task plan único, a ordem é explícita e o pipeline a respeita.

**Direção escolhida (A1)**: **D1 — roster completo, com o instalador que já existe**, dentro da
fatia. Razão: a intervenção parcial (D2) deixa aberto justamente o que só aparece no reboot, e o
reboot é critério de aceitação da F0 que esta fatia não pode regredir.

**Podadas / adiadas**: **D2** — podada (deixa o invariante 7 em aberto). **D3** — podada (perde a
ordem imposta pelo task plan).

### Ramo E — Prova: como se sabe que funcionou

**Direções candidatas:**

- **E1 — Duas janelas assistidas, moldura da fatia**: uma no início (baseline, P1) e uma no fim (comparação caso a caso, P5).
  - _Exemplo:_ `sudo bash deploy/scripts/verificacao/rodar-baterias.sh` — o agregador existe (247 linhas, 2026-08-23) e roda **cada bateria com o privilégio certo**, porque rodar tudo como root quebra o que sobe instância efêmera de Postgres.
  - _Viabilidade:_ **trabalho a executar, não a criar**. E é necessário: `sudo -n` neste host **falha** (medido) — o `sudo` pede senha interativa, então nenhum agente as executa sozinho.
- **E2 — Confiar na suíte Vitest (1943 casos) e dispensar a janela**: mais barato.
  - _Viabilidade:_ **não alcança o objeto desta fatia.** A suíte não mede vhost, timer, `.pgpass` nem restauração em banco vazio. O ramo D é a prova de que ela não pega esta classe.
- **E3 — Criar o verificador do backup e rodá-lo isolado**: o `D9 · F0/T2` **dispara aqui** — o gatilho é *"a próxima fatia que escrever um `verificar-*.sh`"*, e provar a restauração exige um.
  - _Viabilidade:_ são **11 cópias** do esqueleto (medido: `find deploy/scripts -name 'verificar-*.sh'` devolve 11) e o marcador manda fechar **com janela assistida** — a mesma de E1.

**Direção escolhida (A1)**: **E1 + E3** — as duas janelas como moldura, e o `D9` fechado dentro
delas. Razão: são a mesma janela; separá-las pediria três interrupções do usuário em vez de duas.

**Podadas / adiadas**: **E2** — podada, com a frase do insumo que a resume: *"bateria que ninguém
executa não é rede — é a aparência de uma."*

⚠️ **Divergência de número a resolver antes do task plan.** O insumo §0.2 afirma *"8 dos 11
verificadores exigem privilégio administrativo"*. Aplicando o **critério exato do agregador**
(`grep -qE 'exigir_privilegio|EUID.*-ne 0'`), medi **3**: `verificar-fundacao.sh`,
`verificar-migracao.sh` e `verificar-provisionamento.sh` — e o próprio agregador diz, na mensagem de
erro, *"rode como root — três baterias exigem privilégio"*. O `CLAUDE.md` diz outra coisa ainda
(*"são 10 cópias… só 2 rodam sem privilégio"*). Ver `[DÚVIDA 3]`.

---

## 5. Problema

- **Qual é a dor real hoje?** O backend está **completo e inalcançável**, e o banco onde os dados do cliente vão nascer **não tem backup**. Somam-se duas coisas que o insumo não previa: as **automações da F5 não estão instaladas** no servidor, e o **backup do Frappe já ocupa** a janela e o diretório-pai planejados.
- **Como o problema aparece no dia a dia?** O app chama `sysloc.systera.com.br/v1/sessao`, recebe `200 text/html` e estoura `Unexpected token '<'` — parece bug do frontend. E se o disco falhar hoje, não há de onde voltar: o plano **eliminou a janela de rollback por tempo**, e a rede de segurança passou a ser um dump que não existe.
- **Quem sente o impacto?** O cliente (não consegue usar o produto que espera), o operador (não tem de onde restaurar), e o dev (perseguindo no frontend um defeito que é do servidor).
- **Por que resolver agora?** Porque a premissa mudou: **o Frappe não está em uso** (decisão do usuário, 2026-08-25), o cliente espera o app novo, e os cadastros vão **nascer** pela tela do backend novo. É isso que move a religação da borda do item 3 da F7 para dentro do marco.

---

## 6. Objetivo Principal

- **Resultado esperado**: o app do Sysloc alcança o backend novo pelo hostname do cliente com `content-type` de JSON; o banco tem backup diário com **restauração provada em banco vazio**; e o que o repositório entrega está **de fato instalado e rodando** no servidor.
- **Mudança de estado**: sai-se de *"pronto no repositório"* para *"pronto no servidor e recuperável"* — sem que nenhuma rota nasça, mude ou saia.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: o **operador do SaaS** (o próprio usuário) — quem executa a janela assistida, quem restaura, quem opera a virada depois.
- **Persona secundária**: o **desenvolvedor do frontend** (outro agente, na máquina local) — é ele quem consome a borda religada; hoje ela lhe devolve HTML.
- **Persona indireta**: o **cliente final**, que não interage com esta fatia, mas cujo primeiro cadastro nasce logo depois dela.
- **Contexto de uso**: servidor Linux único, sem Docker para o backend novo, com `/opt/frappe` de pé e CloudPanel à frente. Duas janelas com o usuário presente, por causa do `sudo` interativo.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **A2** — Backup `pg_dump -Fc` + tar dos segredos, `.pgpass` 0600, timer das 02:30, **retenção por idade** com expurgo por data
- [ ] **A** — **Restauração provada em banco vazio** (é a prova; o dump não é)
- [ ] **B1** — Religação da borda do Sysloc **espelhando o vhost do Master**, com `location /v1/` antes do `try_files`
- [ ] **C3 → C1** — Reconferir as premissas dos quatro débitos de borda e fechar no mesmo bloco o que sobreviver, sob a **ADR-0037**
- [ ] **D1** — Instalar o **roster completo** de unidades systemd (os 6 timers + a dependência de `postgresql.service` no worker)
- [ ] **E3** — `verificar-*.sh` do backup, fechando o **`D9 · F0/T2`** (que dispara aqui)
- [ ] **E1** — Duas janelas assistidas como **moldura** da fatia (P1 e P5 do Protocolo Antirregressão)

---

## 9. Fora do Escopo (podado / adiado)

- **B3 — servir o Sysloc pelo vhost do Master** — `[fora do escopo do projeto]`: o Painel Master é aplicativo separado com build próprio, por decisão registrada no `CLAUDE.md`.
- **A1 — retenção por contagem** — podada: esconde a falha silenciosa do timer.
- **A3 — sem expurgo** — podada: a premissa do disco cheio foi **refutada por medição** (20%, não 79%).
- **B2 — bridge com `host.docker.internal:3000`** — podada: preserva duas topologias para o mesmo produto.
- **C2 — fechar só o eixo de origem** — podada: adia débito de premissa já vencida.
- **Publicar o `@sysloc/contracts`** — adiado: é item 3 do marco, e não há o que um Gate de QA morda em publicar um pacote — **intervenção dirigida**.
- **Prova do caminho do dia 1, `virada.md` e adendos aos handoffs** — adiados pela mesma razão.
- **Execução da virada e desinstalação do `/opt/frappe`** — fora: sessão operacional futura, e o primeiro critério da F7 exige o frontend já funcionando.
- **Qualquer código de frontend** — `[fora do escopo do projeto]`: a **Fronteira** do `CLAUDE.md` é gatilho de parada.
- **Retirar o `sysloc-react-1` do caminho** — `[DÚVIDA 4]`, não escopo: decidir antes do task plan.

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação, backend Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo o Frappe/ERPNext de `/opt/frappe`. **F0–F5 concluídas**, 147 tasks nos dois gates, **superfície congelada em 106 rotas / 91 manipuladores**, suíte em **1943 casos** / 9 pacotes.
- **PRDs / specs existentes consultados** (`/docs/specs/**` — 22 fatias — e `/docs/prds/features/**` — 13):
  - `fundacao-stack-nativa/v1` (F0) — **o precedente direto**: única fatia que rodou **miniSpec**; Node, Postgres, Redis, systemd, verificadores. Mesma natureza desta.
  - `webhook-e-carne/v1` — **adjacente**: dona do único vhost versionado e do `D27 · F4/T11` que esta fatia fecha.
  - `autorizacao-e-ciclo-de-acesso/v1` — **adjacente**: dona dos `D23`, `D24` e `D27` da F1, os três com gatilho na F7.
  - `integracao-bancaria-autonoma/v1`, `automacoes-agendadas/v1` (F5) — **entregam o que o ramo D descobriu não instalado**.
  - **Nenhuma fatia cobre backup ou publicação** — sem duplicação, sem conflito.
- **Capacidades reutilizáveis** (só para viabilidade):
  - **Persistência**: PostgreSQL 18 com RLS; banco durável **em dia** (28 migrações, `118 OK / 0 FALHA` desde 2026-08-23); `migrar-banco.sh`, `provisionar-base.sh`, `apurar-versao-banco.sh` prontos.
  - **Autenticação / autorização**: better-auth com limitador por classe de rota já dimensionado (`TETO_DE_ENTRADAS_POR_JANELA`, `JANELA_DO_LIMITADOR_EM_SEGUNDOS`), ancorado no `CT-236`.
  - **Outros módulos internos**: `instalar-unidades.sh` com roster declarado e cobertura afirmada pelo `CT-1060`; `rodar-baterias.sh` (agregador, 2026-08-23); vhost do Master provado em produção; dois scripts de deploy do frontend já ajustados, com checagem de `content-type` em `/v1/sessao`.
- **Conflitos / sobreposições detectados**: **um**, e é operacional, não de spec — o backup do Frappe ocupa a **janela das 02:30** e o **diretório-pai** `/opt/backups/`. Ver `[DÚVIDA 1]` e `[DÚVIDA 2]`.

---

## 11. Premissas e Decisões já tomadas

**Premissas:**

- `[HIPÓTESE]` A janela das 02:30 comporta os dois backups (Frappe e Sysloc) sem contenção de I/O — o dump do Sysloc é pequeno hoje, e o do Frappe já cabe na janela. _Justificativa: `/opt/backups` inteiro ocupa **112K** medidos; o volume real do Frappe não é legível sem privilégio._
- `[HIPÓTESE]` Espelhar a topologia do Master no Sysloc não quebra o servimento do bundle React — os dois publicam SPA + `/v1/`, e o do Master está provado. _Justificativa: a diferença medida hoje é de rede (host vs. bridge) e de alvo do `proxy_pass`._
- `[HIPÓTESE]` Instalar os 6 timers ausentes não produz efeito retroativo indesejado na primeira execução — as rotinas são idempotentes por construção (`CT-1085 (b)`/`(c)` provam a repetição da tarefa e a apuração concorrente). _Justificativa: nenhum contrato ativo existe ainda em produção; o efeito prático da primeira passada deve ser vazio, mas isso **não foi medido**._

**Decisões já tomadas (fora de negociação):**

- *"O cliente não usa o sistema antigo, está esperando o app novo, e os cadastros vão nascer pela tela do backend novo"* — decisão do usuário, 2026-08-25. **É a premissa que autoriza a fatia; se deixar de valer, a fatia PARA e escala.**
- O desenho do backup está fixado no `plano-execucao.md` §F7 item 1 e não se rediscute.
- **A prova é a restauração**, não o dump.
- **Sem janela de rollback por tempo** (revisão 2 do plano) — a rede é o dump preservado.
- **A superfície da API está congelada**: as âncoras `106 / 91 / 20` saem intactas.
- **`/opt/frappe` intacto e de pé** ao fim do marco.
- **Português brasileiro em tudo; exclusivamente Opus**, sessão principal e todo subagente.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: publicar e o app continuar quebrado por um detalhe de `content-type`. → _Mitigação:_ **toda aceitação assere `content-type`, nunca só o status** — o modo de falhar medido é `200`, não 404 nem 502.
- **Risco de escopo**: a fatia cresceu — o ramo D acrescentou a instalação do roster, e o `D9` obriga um `verificar-*.sh` novo. → _Mitigação:_ D usa instalador **que já existe**; o escopo é executá-lo, não escrevê-lo. Estimativa revista: **~12–14 tasks** (o insumo dizia ~12).
- **Risco técnico ou operacional**: **inverter a ordem** — expor à internet o banco onde os dados do cliente vão nascer **antes** de haver dump preservado. É a sequência irrecuperável. → _Mitigação:_ backup **antes** da religação, num task plan único que impõe a ordem. É a razão de as duas metades ficarem na mesma fatia.
- **Risco técnico (2)**: `trustedProxies` declarado errado transforma cabeçalho forjado em origem aceita — falha com **aparência de correção**, nomeada no `D27 · F1/T6` e nos `Cons` da ADR-0037. → _Mitigação:_ declarar o salto **só depois** que o vhost exista e o endereço seja medido, nunca suposto.
- **Risco de privacidade / segurança**: a credencial de API do ERPNext segue **exposta em texto claro** no bundle da porta 8300 enquanto ele existir. → _Mitigação:_ tirar o `sysloc-react-1` do caminho fecha isso — mas é `[DÚVIDA 4]`, não decisão tomada.
- **Risco de regressão**: religar a borda muda a infraestrutura que as baterias medem. → _Mitigação:_ P1 e P5 com as duas janelas assistidas; **as 11 baterias e os 1943 casos comparados caso a caso**, nos dois extremos.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **O backup do Frappe e o do Sysloc coexistem na mesma janela das 02:30?** Medido: `/opt/backups/frappe/daily` foi escrito **hoje às 02:30**, com 18 entradas. Não é timer systemd nem `cron.d` legível sem privilégio — **qual mecanismo o dispara**, e há contenção? *(bloqueante para o desenho do timer)*
2. `[DÚVIDA]` **Qual a retenção em dias?** O plano fixa janela e destino, não a idade. A premissa que empurrava para retenção curta caiu: o disco está em **20%**, não 79%. *(bloqueante para a spec de A2)*
3. `[DÚVIDA]` **Quantos verificadores exigem privilégio — 3, 8 ou 10?** Três fontes discordam: o agregador diz **3** (e o critério estático confirma 3 de 11), o insumo diz **8 de 11**, o `CLAUDE.md` diz **10 cópias, só 2 sem privilégio**. Dimensiona a janela assistida e o fecho do `D9`. *(não bloqueante — mede-se na primeira janela)*
4. `[DÚVIDA]` **O `sysloc-react-1` sai ou fica?** Tirá-lo fecha a credencial ERPNext exposta na 8300; mantê-lo preserva um caminho de consulta ao legado que ninguém usa. *(bloqueante para o desenho do vhost)*
5. `[DÚVIDA]` **Onde o build do Sysloc cai, e com que posse?** Hoje `/opt/react/sysloc/html` é `777 root:root` — permissão de contorno. O Master já usa `sysloc:sysloc`. *(não bloqueante)*
6. `[DÚVIDA]` **O dump final da base antiga entra aqui?** O gate de desinstalação o exige, mas ele é pré-requisito da **virada**, não da religação — embora o mecanismo seja o mesmo que esta fatia constrói. *(não bloqueante)*
7. `[DÚVIDA]` **Instalar os 6 timers produz efeito na primeira passada?** Não medido — ver a terceira `[HIPÓTESE]` da seção 11. *(bloqueante para a ordem das tasks do ramo D)*

> **Quatro dúvidas bloqueantes.** A regra da skill manda, acima de três, recomendar *"voltar ao
> pré-refinamento após respondê-las"*. **Divirjo, e declaro (A1):** as quatro se resolvem **por
> medição na primeira janela assistida**, que já é a moldura obrigatória da fatia — nenhuma delas
> pede decisão de produto que o discovery precise reabrir. Recomendada e adotada: **seguir para o
> framework**, com as quatro escritas como **entrada da janela de baseline**, não como bloqueio de
> pipeline. Alternativa considerada: parar aqui e reabrir depois — recusada porque criaria uma
> terceira interrupção do usuário para obter o que a primeira janela já produz.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial**: A2 (retenção por idade) + a restauração provada · B1 (espelhar o Master) · C3→C1 (reconferir e fechar os quatro débitos sob a ADR-0037) · D1 (roster completo de unidades) · E1+E3 (duas janelas e o `verificar-*.sh` do backup, fechando o `D9`).
- **Descartado com justificativa**: A1 (contagem esconde falha silenciosa) · A3 (premissa do disco refutada) · B2 (preserva duas topologias) · B3 (fora do escopo — Master é app separado) · C2 (adia débito de premissa vencida) · D2 (deixa o invariante 7 aberto) · D3 (perde a ordem do task plan) · E2 (a suíte não alcança vhost, timer nem restauração).
- **Adiado para depois da fatia**: publicação do `@sysloc/contracts`, prova do caminho do dia 1, `virada.md`, adendos aos handoffs — todos como **intervenção dirigida**; execução da virada e desinstalação do Frappe, para a sessão operacional futura.
- **Provocações que mudaram o rumo** — três, e todas vieram de **medir em vez de herdar**:
  1. *"Se o app subisse hoje, ele cobraria alguém?"* → **Não.** Zero timers de rotina instalados; a F5 fechou há dois dias e não roda no servidor. **Nasceu o ramo D**, que o insumo não tinha.
  2. *"Backup mesmo não existe, ou só não existe no repositório?"* → Existe **backup diário do Frappe**, na mesma janela das 02:30, no diretório irmão. Mudou o desenho da retenção e criou duas dúvidas bloqueantes.
  3. *"O disco está mesmo em 79%?"* → **20%.** A premissa que sustentava a urgência de expurgo caiu — e, invertida, virou o argumento **contra** A3: com folga de disco, ninguém vai olhar.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos que sobreviveram | **4** (backup+restauração · borda · exposição · convergência host↔repo) — a moldura de prova (E) não é rumo, é o P1/P5 | inferido |
| Personas | **dev+1** — operador do SaaS (primária) e dev de frontend (secundária); o cliente final não interage com a fatia | inferido |
| Novidade | **incremento** sobre infraestrutura existente, com o vhost do Master e o `instalar-unidades.sh` como modelos prontos | confirmado |
| Decisão arquitetural transversal nova? | **não — já resolvida.** Era **uma**, e saiu hoje como **ADR-0037**, antes deste documento (Passo 3.5 da skill) | confirmado |

### 15.2 Framework Recomendado

**Escolhido**: `miniSpec`

**Justificativa**: as duas dimensões decisivas são **Personas = dev+1** e **Novidade = incremento** —
nenhum dos quatro sinais que puxam para SDD está presente: não há múltiplas personas, não é
greenfield, não há regra de domínio, e a única decisão arquitetural nova **já foi extraída para a
ADR-0037 antes do framework**, que é exatamente o que o Passo 3.5 prescreve. O precedente do
repositório confirma pela mesma linha de corte: das 14 fatias com spec, **13 rodaram SDD e todas as
13 são código de negócio**; a única miniSpec é a `fundacao-stack-nativa/v1` (F0) — Node, Postgres,
Redis, systemd, verificadores. Esta fatia é a mesma natureza: `pg_dump`, timer, nginx, unidades
systemd, **zero regra de negócio e zero rota nova** (a superfície está congelada).

⚠️ **Declaro a tensão em vez de escondê-la**: a amplitude ficou em **4 rumos**, e a leitura literal
da tabela põe `4+` como sinal de SDD. Duas razões sustentam a recomendação mesmo assim, e as duas são
regra escrita da própria skill: o **princípio anti-viés 1** (*"NÃO recomende SDD por default — só
quando personas/novidade/arquitetura justifiquem"*) e o **2** (*"em empate, desça"*). O quarto rumo é
o **D**, que eu mesmo acrescentei, e ele é **execução de um instalador que já existe e já tem
cobertura afirmada pelo `CT-1060`** — não é rumo de produto, é trabalho de infraestrutura com molde
pronto. Contá-lo como se abrisse espaço de solução inflaria a amplitude artificialmente.

### 15.3 Alternativas Consideradas

**Por que NÃO SDD** (vizinho mais próximo, obrigatório): o SDD acrescenta **PRD + Tech Spec**, e o
PRD é o artefato de **persona e história de usuário**. Aqui não há persona de produto a descobrir —
quem opera é o próprio usuário, quem consome é outro agente, e o cliente final não toca esta fatia.
O PRD seria preenchimento de formulário sobre um escopo já travado pelo `plano-execucao.md` §F7 item
1 (*"não se rediscute"*). E o único gatilho legítimo de SDD nesta fatia — decisão arquitetural nova —
**foi consumido antes**: a ADR-0037 existe, está `accepted` e indexada. Rodar SDD aqui é o desperdício
que o princípio do próprio framework nomeia.

**Por que NÃO TaskCard** (vizinho mais distante): TaskCard pressupõe `0-1` rumo, `só dev` e ajuste
pontual sem decisão de desenho. Esta fatia tem **4 rumos**, **~12–14 tasks**, uma **ordem entre elas
que é questão de segurança** (backup antes da religação, sob pena de sequência irrecuperável), e pelo
menos duas decisões de desenho reais (topologia do vhost, retenção do backup). TaskCard perderia a
rastreabilidade e, pior, **perderia a ordem** — que é a razão de as duas metades viverem na mesma
fatia.

### 15.4 Próximo Passo

```bash
# A decisão arquitetural transversal desta fatia JÁ FOI registrada, hoje, antes deste documento:
#   docs/adr/0037-politica-de-limitacao-de-abuso-na-borda-publica.md  (accepted, indexada)
# Não repita o /agent-spec-adr-create — o Passo 3.5 já está cumprido.

/agent-spec-minispec-generate-intent "publicacao-e-backup"
```

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade para SDD** se durante a execução emergir: (1) a necessidade de **alterar, acrescentar ou remover rota** — a superfície está congelada e isso reabriria o item 2 do marco; (2) uma **segunda decisão arquitetural transversal** não prevista, por exemplo se a `[DÚVIDA 1]` revelar que os dois backups **não** coexistem e o desenho de preservação precisar mudar; (3) o ramo D revelar que instalar os 6 timers **produz efeito retroativo** (`[DÚVIDA 7]`), o que traria regra de negócio para dentro de uma fatia que hoje não tem nenhuma.
- **Downgrade para TaskCard** se: (1) as `[DÚVIDA 1]`/`[DÚVIDA 4]` fecharem o desenho do vhost e do backup a ponto de restar só execução mecânica; ou (2) o usuário decidir tirar o ramo D da fatia — o que reduziria a amplitude a 3 e o trabalho a dois blocos independentes.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, com a decisão da Fase 1 registrada sob A1
- [x] **Árvore de rumos (seção 4)**: cada ramo com 2-3 direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]` (B3)
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs/PRDs e capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; 7 dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado + as 3 provocações que mudaram o rumo
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas, com a tensão da amplitude declarada
- [x] **Alternativas (15.3)** explicam por que NÃO SDD e por que NÃO TaskCard
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o INTENT do miniSpec
