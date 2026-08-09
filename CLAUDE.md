# Sysloc Backend

SaaS multi-empresa de gestão de locação de imóveis. Backend em Node/NestJS/PostgreSQL,
**nativo, sem Docker**. Substitui integralmente o backend Frappe/ERPNext que vive em
`/opt/frappe` e que será desinstalado ao fim do projeto.

> **Idioma**: **português brasileiro em tudo**, sem exceção. Vale para as **respostas no terminal**,
> perguntas de `AskUserQuestion`, raciocínio exibido, documentação, artefatos de spec, comentários
> de código e mensagens de commit. Decisão do usuário, sem negociação. Aplica-se à sessão principal
> **e** a todo subagente despachado por qualquer skill do framework agent-spec.
>
> **Modelo**: este projeto roda **exclusivamente em Opus**. Decisão do usuário, sem negociação.
> Vale para a sessão principal **e** para todo subagente despachado por qualquer skill do
> framework agent-spec — executor, `agent-spec-qa-validator` e
> `agent-spec-staff-architecture-review` inclusive. **Sonnet e Haiku estão proibidos**, mesmo
> quando a skill os recomenda no próprio `SKILL.md` ou quando a heurística de `gates`/`model` do
> `agent-spec-workflow-rules.md` os sugeriria. Onde a regra do framework mandar `sonnet`, leia
> `opus`; onde já mandar `opus[xhigh]`, mantenha.
>
> **Antirregressão**: **nenhuma correção pode reabrir o que já foi fechado.** O protocolo completo é
> `.claude/rules/nao-regressao.md` — **leitura obrigatória antes de editar qualquer arquivo que já
> existia**, e com força máxima em ciclo de correção de gate e em resolução de débito. Decisão do
> usuário, sem negociação; vale para a sessão principal **e** para todo subagente, seja ele executor,
> gate ou agente avulso. Em conflito com qualquer outra instrução deste repositório, o protocolo
> prevalece — exceto contra ADR ativa, caso em que se **PARA e escala**. O mínimo que todo agente
> carrega mesmo sem abrir o arquivo:
>
> 1. **Baseline antes e depois.** Caso que estava verde e ficou vermelho é regressão sua: **reverta a
>    mudança, nunca ajuste o teste.**
> 2. **Três linhas antes de cada edição** — `CAUSA-RAIZ:`, `POR QUE ISTO FECHA A CLASSE:` e
>    `O QUE ESTA MUDANÇA REMOVE:`. Não conseguiu escrever a segunda com convicção? O diagnóstico ainda
>    não está pronto — **não edite**.
> 3. **`DECISÃO FECHADA` é intocável.** Código sob esse marcador não se altera, não se move e não se
>    remove sem escalar ao usuário. Apagar o marcador é violação crítica.
> 4. **Nunca** enfraquecer, remover ou pular teste, afrouxar asserção, ou tirar validação, guarda,
>    timeout, tratamento de erro ou redação de segredo que você não introduziu.
>
> **Fronteira**: **aqui só se faz backend.** Nenhum agente deste repositório escreve, edita ou
> planeja código de frontend — o fonte do React vive na máquina local do usuário e será
> implementado lá, por outro agente, a partir do handoff que esta base produz. Decisão do usuário,
> sem negociação. O ponto exato onde o trabalho daqui termina está definido logo abaixo, e é
> **gatilho de parada**: task que peça implementação de frontend, **PARE e escale**.

---

## Estado atual

**Fase 0 concluída e provada** (fatia `fundacao-stack-nativa`, v1) — as 7 tasks fechadas e
commitadas, incluindo a **T7**, cuja recuperação foi provada por **reinício real** da máquina.
A fatia `caracterizacao-regras-legadas` (v1) também está **concluída**: os 6 artefatos golden
estão versionados e são o oráculo das regras legadas para a F3 e a F5.

**Fase 2 em andamento — a fatia 1 de 2 fechou em 2026-08-08.**
**`cadastro-de-imoveis-e-pessoas` (v1) — CONCLUÍDA, staged e não commitada.** As **11 tasks**
aprovadas nos dois gates, nenhuma bloqueada. Suíte de **274 → 541 casos**; `pnpm build`, `pnpm lint`
e `pnpm test` verdes. Entrega as 6 entidades de negócio em `negocio` (conjunto, imóvel, cômodo,
locador, locatário, fiador), as **33 rotas** sob `/v1` — `rotasEnumeradas` = **66**, `semDeclaracao`
vazio —, a metragem derivada provada contra o golden, exclusão lógica em tudo menos cômodo, e o
pacote **`@sysloc/contracts`** como fonte única do contrato. Fechou os débitos **D38** (na T4) e
**D11**. Nasceram dela as ADRs **0014**, **0015**, **0016**, **0017** e **0018**.
**Deixou 13 débitos abertos** na §2 do `_run/run-report.md` (14 blocos, um já fechado) — um deles
com marcador e gatilho (**D3**). Resolve-se tudo de uma vez com
`/agent-spec-debt-resolution docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/`.
Falta a fatia **`contratos-de-locacao`** para a fase fechar.

**`contratos-de-locacao` (v1) — ESPECIFICADA, pronta para execução; nenhuma linha de código escrita.**
O pipeline SDD fechou em 2026-08-08: pré-refinamento, tech-alignment, PRD (16 US, 20 CA, 18 RN),
tech spec, challenge e task plan. Entrega planejada: **`negocio.contrato` e `negocio.contrato_fiador`**
(este último **vínculo puro, sem `retirado_em`** — a ausência é a decisão), a primeira **série
declarada** do produto (`CTR-{ano}-{5 dígitos}`, sequência por `(empresa, ano)` atrás de duas funções
`SECURITY DEFINER`) e o primeiro **ciclo de vida governado**. **9 rotas novas** — 8 sob
`/v1/contratos` e a de situação de locação sobre `/v1/imoveis`; superfície **66 → 77** rotas e
**51 → 60** manipuladores. Nasceram dela as ADRs **0019** e **0020**.
**São 10 tasks em 3 fases**, sem par paralelizável (derivado, não autorado — a §4.2 do
`task_plan.md` registra a condição que falha em cada par), e **34 casos de teste** distribuídos, um
CT por task. Executa-se com
`/agent-spec-sdd-run-tasks docs/specs/features/contratos-de-locacao/v1/task_plan.md sysloc-backend-implementer`
— a assinatura da skill é `<task_plan_path> [agent_name]`, e o primeiro argumento é o **arquivo**
`task_plan.md`, não o diretório da fatia. Omitir o segundo argumento não é erro: a skill lista os
agentes de `.claude/agents/`, filtra os três reservados aos gates e pergunta qual usar.

> **A T1 é a primeira por uma razão que expira**: ela captura do `/opt/frappe` o oráculo de ativação
> e cancelamento, e essa janela fecha na F7. Ela exige `sudo` e o site efêmero de pé — **nenhum
> subagente a executa**; a execução é conduzida junto ao operador e o gate audita a saída preservada.
>
> **Dois furos herdados que esta fatia fecha, e que valem saber antes de tocar o código de imóveis**:
> (1) `alterarImovel` escreve `status_locacao` incondicionalmente e a entrada não aceita `LOCADO`, de
> modo que **toda** alteração de um imóvel locado apagaria o `LOCADO` em silêncio — a T10 tira o campo
> do corpo do `PUT` e lhe dá rota própria; (2) `esquemaDoImovel` ganha `contratoVigente`, o que alcança
> **três** superfícies publicadas de uma vez e obriga quatro suítes da fatia 1 a crescer — **crescimento
> de esquema, nunca troca de igualdade por asserção de presença**.

**Fase 1 CONCLUÍDA — as duas fatias fechadas.** A F1 foi **desdobrada em duas fatias**, cortando
*depois* da autenticação (o corte isolamento × identidade foi rebatido: ele atravessa a camada 5, e
a fonte legítima do `empresa_id` é a sessão). Em **2026-08-05** a segunda fechou, e com ela a fase.
**Nenhuma das duas foi commitada ainda** — o pipeline nunca commita; o trabalho está *staged*,
aguardando a decisão do usuário.

1. **`fundacao-multitenancy-identidade` (v1) — CONCLUÍDA e commitada.** As 11 tasks aprovadas nos
   dois gates. Dá para logar, e o isolamento entre empresas está provado: `empresa_id`, RLS
   forçada e FK composta em toda tabela de negócio; contexto por `AsyncLocalStorage` mais
   `SET LOCAL`; guarda de cobertura sobre o catálogo; `better-auth` com barreira única de admissão
   de sessão. Depois do run, uma **intervenção dirigida de fechamento** (fora do pipeline) resolveu
   **22 dos 37 débitos** anotados, mais o **D38**, achado durante a própria revisão. Suíte em
   **274 casos**.
2. **`autorizacao-e-ciclo-de-acesso` (v1) — CONCLUÍDA em 2026-08-05, staged e não commitada.**
   As **9 tasks** aprovadas nos dois gates, nenhuma bloqueada. Suíte de **274 → 350 casos**;
   `pnpm build`, `pnpm lint` e `pnpm test` verdes. Entrega a matriz 10×7 com **ajuste bidirecional**
   por usuário (conceder **e** retirar), sessão com `versaoPermissoes` **por pessoa** relido quando
   diverge, invalidação de sessão **na origem do evento**, onboarding por **senha provisória**
   (termo canônico do glossário — não "temporária") e as rotas do Master e do Admin. Fechou os
   débitos **D7**, **D21**, **D5**, **P-T6-1** e a metade acionável do **P-T6-2**; a outra metade
   virou o **item 5 da §F7** do plano de execução. Nasceram dela as ADRs **0010**, **0011**,
   **0012** e **0013**, e ela **aposentou a 0007**. (Registro histórico: a **0012 foi, depois,
   substituída pela 0017** — não a cite como vigente.)
   **Deixou 41 débitos anotados** na §2 do `_run/run-report.md` — quatro deles com marcador e
   gatilho (**D27**, **D37**, **D38**, **D40**). Resolve-se tudo de uma vez com
   `/agent-spec-debt-resolution docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/`.
   **A superfície da API está completa e pronta para congelar**: 15 rotas, mais a de troca de senha
   do produto; a nativa de `/v1/auth/change-password` deixou de ser publicada, e o inventário de
   `/v1/auth` caiu de 6 para 5.

**O que a PRIMEIRA FATIA deixou aberto, e que a próxima sessão precisa saber** — os caminhos abaixo
são relativos a `docs/specs/features/fundacao-multitenancy-identidade/v1/`:

- ✅ **A fatia está PROVADA DE PONTA A PONTA no cluster real** (2026-08-03): bateria agregada em
  `7/7 casos aprovados, 0 falhas` e **`CT-006` aprovado por reinício real da máquina** — a fundação
  inteira reverificada num sistema recém-iniciado, com tarefa enfileirada ANTES do boot consumida
  depois dele. Chegou lá em cinco rodadas, de 14 falhas a zero; o diagnóstico das **6 causas-raiz**
  está na §4 do `_run/run-report.md`. Duas eram estado operacional (a variável de ambiente nova e a
  migração não aplicada) e **quatro eram defeito de verificador**, todos corrigidos e commitados.
  Reexecução: `sudo bash deploy/scripts/instalacao/verificar-fundacao.sh` (com `pnpm build` antes);
  o `CT-006` sai de fora dela por consumir janela de indisponibilidade — ⚠️ o reinício derruba
  **também o `/opt/frappe`**, que atende a operação.
- **`P-T6-1` e `P-T6-2`** (`tasks/T8.md` §7) — **ganharam dono em 2026-08-04**, na especificação da
  fatia 2. Ficaram abertos e sem dono por um tempo porque o dono declarado era a "task de fechamento
  da F1" — expressão que os artefatos da fatia usam para dizer *fechamento desta fatia*, e não da
  fase —, e a intervenção não os cobriu. Onde estão agora: o **P-T6-1** (valor novo no enum
  `desfecho_tentativa`) é a migração **`0004`** da fatia 2, provado pelo `CT-208`; o **P-T6-2** foi
  **partido em dois** — ligar o limitador de taxa entra na fatia 2 (`CT-236`), e a retenção de
  `identidade.tentativa_login` virou o **item 5 da §F7** do plano de execução.
- **As seis rotas de `/v1/auth` fora do documento OpenAPI** — dono precisado no código: a
  publicação do `@sysloc/contracts`, não uma task genérica.
- **15 débitos abertos** na §2 do `_run/run-report.md` da fatia, cada um com razão registrada.

**Higienização da dívida técnica — 2026-08-08.** Os **101 débitos** abertos das cinco fatias foram
auditados **contra o código**, um a um. Resultado: **7 já estavam pagos** e continuavam listados
(fechados fora do pipeline, sem anotação na época), e **4 haviam crescido** desde o registro — o
**D28 (F0/T5)** dez vezes, de "3 imports num arquivo" para ~35 em ~20 arquivos, o que o tirou da
classe de cleanup barato. Os 11 estão marcados na §2 da fatia de origem, com evidência. Na mesma
passagem, uma **intervenção dirigida** fechou **D1** (caracterização), **D12**, **D18** e **D21**, e
fechou **em parte** o **D22** — cada um com mutante medido e revertido, e todos aprovados por
validação independente. Restam **~85 débitos abertos**, quase todos `BAIXO` de higiene local.
**O parecer registrado é NÃO rodar `/agent-spec-debt-resolution` em massa**: o custo é de 2 a 4 runs
do tamanho de uma fatia, contra ganho marginal, com F2.2 a F5 ainda entre aqui e o marco de entrega.

> Mantenha este bloco atualizado — ele é lido por todo subagente, e um estado errado aqui chega a
> todos eles antes de qualquer arquivo do repositório. **É índice, não relatório**: o detalhe vive
> nos artefatos apontados.

---

## O ponto exato onde o trabalho deste repositório termina

**MARCO DE ENTREGA DO BACKEND.** Alcançado o marco, gera-se o handoff e **encerra-se a construção
aqui**. É a materialização da **Fronteira** declarada no topo, e a lista abaixo é a definição
operacional dela — não uma meta aproximada.

O marco está alcançado quando **todos** os sete itens forem verdadeiros:

- [ ] **F1 a F5 concluídas** — todas as tasks aprovadas nos dois gates, suíte verde, critérios de
      aceitação de cada fatia verificados · **F1 fechada em 2026-08-05; faltam F2 a F5**
- [ ] **Superfície da API congelada** — nenhuma fatia posterior acrescenta, remove ou altera rota;
      o congelamento é o que torna o handoff confiável
- [ ] **`@sysloc/contracts` publicado** no GitHub privado e versionado — é o artefato que o React
      importa para trocar tipos e cliente ts-rest
- [ ] **`handoff-frontend.md` gerado** por `/agent-spec-backend-contract-handoff`, carregando o
      modelo de domínio camelCase, o envelope de erro da **ADR-0017**, a autenticação por sessão, o
      objeto de sessão gorda com `versao_permissoes`, e o **mapa endpoint-a-endpoint** ligando cada
      um dos 35 caminhos ERPNext antigos (`levantamento-frontend.md`) à rota nova
- [ ] **Backup e restauração entregues e provados** — item 1 da F7: `pg_dump -Fc`, segredos em tar,
      `.pgpass` 0600, timer das 02:30, e **restauração conferida num banco vazio**
- [ ] **`deploy/scripts/virada.md` escrito**, com o gate de desinstalação de 5 itens
- [ ] **`/opt/frappe` intacto e de pé** — a virada não acontece neste marco

### O que **não** se faz aqui, em nenhuma hipótese

Nenhum código React. Nenhum arquivo na máquina local do usuário. Nenhum dos ~100 arquivos de
religação, vazamento, fluxo ou teste que a F6 dimensiona. Os 4 specs Playwright **rodam na máquina
local**, não aqui. Roteiro por arquivo do fonte React também não: **este servidor não tem o fonte**,
e escrever sobre código que não se pode ler é adivinhação com aparência de spec.

### O que fica para depois do marco

A **execução** da virada e a **desinstalação** do Frappe. As duas só podem acontecer neste servidor
— é onde o `/opt/frappe` e o CloudPanel existem —, e as duas exigem o frontend já funcionando, pois
o primeiro critério de aceitação da F7 é *"app funcionando integralmente contra o backend novo"*.

Serão uma **sessão operacional futura** neste servidor, conduzida pelo runbook, nos moldes da janela
de reinício da F0: horas, não dias; operação, não construção. **Isso não reabre a construção do
backend** — defeito encontrado na virada se corrige como correção, não como fatia nova.

---

## ⚠️ Leitura obrigatória antes de qualquer implementação

Nesta ordem. **Nenhum destes é dispensável** — o plano de execução referencia decisões apenas
pelo número, e sem os dois arquivos de `.claude/plans/` essas referências ficam sem conteúdo.

| # | Arquivo | O que carrega |
|---|---|---|
| 1 | `docs/plano-backend-novo/decisao-e-stack.md` | A decisão, a **stack completa** com justificativas, o layout do monorepo, a estratégia de compatibilidade com o frontend, o inventário do que porta e do que morre, o destino das ADRs |
| 2 | `docs/plano-backend-novo/plano-execucao.md` | As **8 fases** (F0–F7), entregas e critérios de aceitação executáveis |
| 2b | `docs/plano-backend-novo/roadmap.md` | **Onde estamos** — o que cada fase é, em que fatias ela se parte e o estado de cada uma. O painel é **gerado** por `deploy/scripts/roadmap/atualizar-roadmap.sh` e um gancho `PostToolUse` o roda sozinho quando um `_run/*state.yaml` muda; **não edite o que está entre marcadores** |
| 3 | `.claude/plans/plano-saas-decisoes.md` | As **40 decisões fechadas** — o plano de execução as cita por número |
| 4 | `.claude/plans/plano-saas.md` | Arquitetura-alvo, os 3 perfis, as **10 telas × 7 ações sensíveis**, a especificação do webhook Sicoob |
| 5 | `docs/plano-backend-novo/levantamento-frontend.md` | O frontend React: inventário dos **35 endpoints**, o **modelo de domínio que a API deve falar**, os acoplamentos a remover |
| 6 | `docs/adr/` | ADRs. **20 registradas, 15 `accepted`**: 0001, 0005, 0006, 0008, 0009, 0010, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0019 e 0020. **Vinculantes para a F2**: 0006, 0008, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0019 e 0020. As **0002, 0003 e 0004** morreram com o Frappe — `deprecated` desde 2026-08-04, porque nomeiam primitivas dele (DocType, fixture, `Custom DocPerm`, Server Script). A forma canônica do contrato da API tem **cadeia de três**: **0007 → 0012 → 0017**; as duas primeiras estão `superseded` e **não se citam** — a vigente é a **0017** (três classes de chave exposta: código legível quando há série declarada, UUID quando não há). ⚠️ **Citar ADR exige abrir a `Decision`** — esta linha e o `INDEX.md` são paráfrases, e já divergiram do texto real |

Por fase: a **F4** exige `docs/specs/features/integracao-bancaria-configuravel/`; a **F6** exige
o levantamento do frontend (item 5).

**O critério que separa a ADR que morre da que sobrevive é o substrato.** A 0002, a 0003 e a 0004
nomeiam primitivas do Frappe — DocType, fixture, `Custom DocPerm`, `Server Script` — e vão junto com
elas. A 0004 entrou nesse conjunto em 2026-08-04, por aplicação do mesmo critério: a `Decision` dela
preserva nomes curtos de endpoints herdados de Server Script por aliases registrados no app, e nada
disso existe fora do Frappe. A 0006 não nomeia
mecanismo nenhum: a decisão é *"a suíte de verificação nunca executa contra o ambiente que atende a
operação; qual ambiente concreto cumpre o papel varia ao longo do tempo — o invariante é a separação,
não um servidor específico"*, e uma das alternativas que ela rejeita **antecipa literalmente esta
migração**. Ela é o que a **T4 da F0 materializa** (instâncias efêmeras próprias, `embedded-postgres`)
e o que impede a suíte de tocar o banco que opera enquanto `/opt/frappe` seguir de pé. Não superseder:
uma ADR nova com a mesma decisão seria churn.

---

## Stack

Detalhe e justificativa em `decisao-e-stack.md` §4. Resumo:

**Node 24 LTS · TypeScript strict · NestJS + Fastify · Drizzle + drizzle-kit + postgres.js ·
PostgreSQL 18 · Zod · ts-rest · better-auth · BullMQ + ioredis + Redis 7 · nodemailer ·
Pino + OpenTelemetry · Vitest + embedded-postgres · pnpm + Turborepo + Biome + mise + mprocs +
tsup + tsx**

Específicos deste domínio: **undici** (mTLS do Sicoob), **`node:crypto` `X509Certificate`**
(leitura de `.pfx`), **@react-pdf/renderer** + **pdf-lib** (contrato e carnê), **systemd timers**
(agendamento).

---

## Invariantes — não negociáveis

> **Invariante 0 — nada regride.** O Protocolo Antirregressão (`.claude/rules/nao-regressao.md`) é
> pré-condição de toda edição e vale para todo agente e subagente. Os oito invariantes abaixo dizem
> *o que* o sistema tem de ser; o invariante 0 diz que **nenhum deles pode ser desfeito por uma
> correção posterior** — inclusive os que já custaram rodadas de gate para serem estabelecidos.

1. **Multi-tenancy é fundação, não retrofit.** Toda tabela de negócio nasce com `empresa_id`,
   **RLS habilitada** (`USING` e `WITH CHECK`) e **FK composta `(id, empresa_id)`**. Referência
   cross-tenant é impossível pelo banco, não impedida por validação de aplicação.
2. **O contexto de tenant nunca é lido do request.** `AsyncLocalStorage` + `SET LOCAL
   app.empresa_id` por transação.
3. **Nenhum segredo versionado.** Certificado `.pfx`, senha de banco e chave de cifra vivem fora
   do repositório (`EnvironmentFile` 0600). O `.gitignore` barra `.env`, `*.pfx`, `secrets/`.
4. **Dinheiro em `numeric(15,2)`**, nunca float.
5. **IDs textuais legíveis** (`CTR-2026-00001` — **cinco** dígitos) preservados — o frontend os exibe
   como título de contrato, label de select e campo "Identificador". Chave interna é UUID; o código
   legível é coluna própria, única por empresa.
   > **A largura é cinco, e este texto já disse quatro.** O valor é **medido** no sistema antigo
   > (`autoname` = `CTR-.YYYY.-.#####`, série viva em 20), e a divergência foi descoberta ao ler o
   > dado em vez de estimar. O `plano-execucao.md` §F2 **ainda escreve quatro** — corrigi-lo não
   > pertence a nenhuma fatia aberta, e a proteção local é o marcador `DECISÃO FECHADA` no ponto do
   > código que fixa o formato (`packages/contracts/src/contrato.ts`, a partir da T2 da fatia
   > `contratos-de-locacao`). Não "corrija" para quatro.
6. **A API fala o modelo de domínio camelCase** que o frontend já usa internamente
   (`levantamento-frontend.md` §6) — não o formato do Frappe.
7. **Tudo sobe sozinho após reboot.** Unit systemd por serviço, `Restart=always`,
   `Persistent=true` nos timers. É critério de aceitação da F0, testado com `reboot` real.
8. **Redis com AOF ligado** — ele guarda a fila do BullMQ, não só cache.

---

## Convenções

- **Testes**: Vitest com `embedded-postgres` (Postgres real e efêmero). A convenção de
  rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de INVARIANTES por arquivo vem do backend
  antigo e **deve ser mantida**. A stack de teste completa — as duas frentes (shell e Vitest),
  fronteiras de execução real e a **prova de falsificação obrigatória** — está em
  `.claude/rules/testing-stack.md`.
- **Antirregressão**: `.claude/rules/nao-regressao.md`. Ao fechar um defeito que já tinha voltado,
  ou que um gate rejeitou duas vezes, deixe no ponto do código o marcador **`DECISÃO FECHADA`** com
  os campos `O QUÊ` / `POR QUÊ` / `REVERTER EXIGE`. É o que impede a rodada seguinte de reabrir o
  que você acabou de fechar. O marcador **irmão e oposto** é o **`DÉBITO COM GATILHO`** (§3-B da
  mesma rule): não protege, **agenda** — ver o bloco abaixo.
- **Lint/format**: Biome. Sem ESLint, sem Prettier.
- **Commits**: Conventional Commits em pt-BR — ver a skill `agent-spec-semantic-commit`.
- **Specs**: o framework agent-spec está em `.claude/` (37 skills, 8 rules, 4 agents). Features
  novas seguem o pipeline SDD/miniSpec/TaskCard com os gates de QA e Tech Review.

---

## Débitos com gatilho ativo

> **Bloco derivado e transitório** — espelha os marcadores `DÉBITO COM GATILHO` que existem hoje no
> código (`.claude/rules/nao-regressao.md` §3-B). Fechou um débito? Remova o marcador **e** a linha
> daqui. Removeu o último marcador? **Apague este bloco inteiro.** A condição é verificável:
>
> ```bash
> # vazio ⇒ este bloco não deve mais existir (o `dist/` é build e espelharia o fonte)
> grep -rl --exclude-dir=dist "DÉBITO COM GATILHO" apps packages deploy
> ```

Onze débitos têm gatilho que dispara fora da fatia que os criou: **D28** e **D32** vêm da F0;
**D23**, **D39**, **D24**, **D27** e **D37** nasceram na F1 — os três últimos na fatia
`autorizacao-e-ciclo-de-acesso` —; e quatro nasceram na F2, o **D3** na fatia
`cadastro-de-imoveis-e-pessoas` e o **D28**, o **D36** e o **D43** na fatia `contratos-de-locacao`.
O **D27** partilha com o D23 o gatilho e o fato que falta: qual é o salto confiável da borda; e o
**D36** partilha com o D28 da mesma fatia o gatilho — a F3. O **D43** é o único cujo gatilho é o
**congelamento da superfície da API**, e por isso ele vence os demais em prazo.
⚠️ **Os dois `D28` são débitos DIFERENTES** — `F0/T5` e `F2/T7` —, e a coexistência é legítima: a
sequência corre dentro da §2 da fatia que registrou cada um (§3-B da `nao-regressao.md`).
**Um já disparou e segue aberto** — o D28, na F1/T2.
Seis saíram daqui por terem sido fechados — **este índice lista só débito vivo**: o D6 da F1/T5,
no fechamento da F1
(`verificar-migracao.sh` entrou em `VERIFICADORES_DA_FATIA`); o D7 da F1/T6, na T6 da fatia
`autorizacao-e-ciclo-de-acesso`, que declarou `perfil` e `empresa_id` como campos adicionais com a
escrita pelo corpo fechada; o D32 da F1/T7 daquela mesma fatia, na T8, quando as rotas do Admin
passaram a criar o vínculo de acesso sob o contexto que a guarda publica da sessão; e o D21 da
F1/T7, na T9 daquela fatia, quando a rota nativa de troca de senha deixou de ser publicada e a
troca do produto passou a conferir a admissão antes de qualquer escrita; o **D40** da F1/T9, na
intervenção dirigida de limpeza de 2026-08-05, quando `esquemaDoErro` ganhou definição única em
`apps/api/src/comum/esquema-de-erro.ts`; e o D38 daquela mesma T9, na T4 da fatia
`cadastro-de-imoveis-e-pessoas`, quando `validar()` ganhou definição única em
`apps/api/src/comum/validacao.ts` e os três controladores passaram a importá-la.

> **Esta tabela é um ÍNDICE, não um relatório.** Cada linha é um **ponteiro curto**; o detalhe —
> impacto medido, o que fazer, prova exigida — vive **só** na §2 do `run-report.md` da fatia que
> registrou o débito, para onde o `ÍNDICE` do marcador aponta: a F0 em
> `docs/specs/features/fundacao-stack-nativa/v1/_run/`, a F1 em
> `docs/specs/features/fundacao-multitenancy-identidade/v1/_run/`, e a fatia de contratos em
> `docs/specs/features/contratos-de-locacao/v1/_run/`. É o que a §3-B manda
> (*"marcador que copia o relatório inteiro apodrece — o relatório é corrigido e a cópia não"*), e
> o motivo é medido: este arquivo entra no contexto da sessão principal **e de todo subagente**, em
> toda task. **Linha que passar de ~150 caracteres deve ter o excedente movido para a §2.**

> **Como um débito é identificado** (o número sozinho não basta — `D6` da F1 e `D6` da F0 são
> débitos diferentes): a regra está na §3-B da `.claude/rules/nao-regressao.md`, que é permanente.
> Ela **não** mora aqui, justamente porque este bloco é transitório e some quando o último marcador
> sair.

| Débito | Onde | Dispara quando |
|---|---|---|
| **D28** (F0/T5) | `grep -rln --exclude-dir=dist "D28 · F0/T5" apps packages deploy` — a contagem sai do comando, que não envelhece | **JÁ DISPAROU (F1/T2)** — consumidor novo de `packages/shared/test/` por caminho relativo profundo |
| **D32** (F0/T6) | `apps/worker/src/fila.ts` | a primeira fatia que **enfileirar tarefa de negócio** |
| **D23** (F1/T8) | `apps/api/src/autenticacao/autenticacao.module.ts` | a **publicação atrás do servidor de borda na F7** — origem confiável derivada do endereço de retorno |
| **D39** (F1/fechamento) | `deploy/scripts/instalacao/provisionar-base.sh` | a **próxima instalação do zero** — o provisionamento não gera `BETTER_AUTH_SECRET` e a API não sobe |
| **D24** (F1/T5, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/main.ts` | a **publicação atrás do servidor de borda na F7** — `/docs*` atende sem sessão por decisão registrada, que vale só enquanto a API é local |
| **D27** (F1/T6, fatia `autorizacao-e-ciclo-de-acesso`) | `packages/auth/src/autenticacao.ts` | a **publicação atrás do servidor de borda na F7** — sem ela o limitador não tem eixo de origem |
| **D37** (F1/T8, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/master/empresa.controller.ts` | a **primeira comparação do `:id` do Master com identidade da sessão** — o esquema de lá não canoniza a caixa do UUID |
| **D3** (F2/T1, fatia `cadastro-de-imoveis-e-pessoas`) | `packages/contracts/src/comum.ts` | a **primeira task que abrir `usuario.controller.ts` por outra razão** — `ESQUEMA_DO_IDENTIFICADOR` tem duas definições |
| **D28** (F2/T7, fatia `contratos-de-locacao`) | `apps/api/src/contratos/contrato.service.ts` | a **F3** — a ativação não gera cobranças, e a fatia de cobrança é obrigada a afrouxar o literal `cobrancasGeradas: false` |
| **D36** (F2/T8, fatia `contratos-de-locacao`) | `apps/api/src/contratos/contrato.service.ts` (`cancelar`) | a **F3** — a pré-condição legada "sem PDF, não cancela" não é portada, e é lá que se decide se o carimbo é pré-condição ou efeito |
| **D43** (F2/T10, fatia `contratos-de-locacao`) | `apps/api/src/imoveis/imovel.controller.ts` | o **congelamento da superfície da API** — transição de estado sem chave de ação; emenda a ADR-0019 por supersede |

---

## Comandos

Existem a partir da T1. `mprocs` chega na T7.

```bash
mise install                              # fixa Node 24 e ferramentas
pnpm install
pnpm build                                # Turborepo
pnpm lint                                 # Biome + turbo run lint
pnpm test                                 # Vitest + instâncias efêmeras (turbo run test)
pnpm --filter @sysloc/<pacote> test       # subset de um pacote só
bash deploy/scripts/<área>/verificar-<alvo>.sh   # verificadores de infraestrutura (shell)
```

**Rode `pnpm test` antes e depois de qualquer edição** — é a baseline que o Protocolo Antirregressão
exige (`.claude/rules/nao-regressao.md`, P1 e P5).

---

## Contexto do backend antigo

`/opt/frappe` ainda está **de pé e operando** — só é desligado na F7. Consultá-lo é legítimo
(`docker compose exec -T backend bench --site frontend ...`), mas:

- O site `frontend` é **produção**. Nada destrutivo.
- A **caracterização das regras de negócio** (em
  `docs/specs/features/caracterizacao-regras-legadas/v1/tasks/task-01-capturar-caracterizacao-regras-legadas.md`)
  precisa rodar contra ele **antes da F3** — é a prova de equivalência do gerador de contrato de
  752 linhas.
- A credencial de API do ERPNext segue **exposta em texto claro** no bundle público da porta
  8300 enquanto ele existir. Pendência aberta.
