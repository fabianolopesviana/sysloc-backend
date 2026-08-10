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
> **O protocolo tem barreira executável desde 2026-08-09**, e ela **inclui este arquivo**:
> `packages/shared/test/protocolo-antirregressao.spec.ts` (CT-501 a CT-510) prova por `fs` o
> substrato de que o protocolo depende — o escopo universal da rule, o núcleo íntegro com **contagem
> exata** (5 passos, 3 formas de regressão, 7 proibições), o resumo acima com **os 4 itens**, os
> critérios instalados nos dois gates, a igualdade das 3 cópias do bloco do executor, e o índice de
> débito abaixo **nas duas pontas**. Resumir uma dessas listas, apagar um item ou dessincronizar o
> índice **fica vermelho na suíte** — não é mais questão de boa-fé. Os 15 mutantes que provam que
> cada asserção pode falhar estão registrados no commit `c0453d2`.
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

**Fase 2 CONCLUÍDA — as duas fatias fecharam, e as duas estão commitadas.** A fase entrega o domínio
de locação inteiro em **21 tasks**, todas aprovadas nos dois gates, nenhuma bloqueada.

1. **`cadastro-de-imoveis-e-pessoas` (v1) — CONCLUÍDA em 2026-08-08 e commitada.** As **11 tasks**
   aprovadas. Suíte de **274 → 541 casos**. Entrega as 6 entidades de negócio em `negocio`
   (conjunto, imóvel, cômodo, locador, locatário, fiador), as **33 rotas** sob `/v1`, a metragem
   derivada provada contra o golden, exclusão lógica em tudo menos cômodo, e o pacote
   **`@sysloc/contracts`** como fonte única do contrato. Fechou os débitos **D38** (na T4) e **D11**.
   Nasceram dela as ADRs **0014**, **0015**, **0016**, **0017** e **0018**. Deixou **13 débitos
   abertos** — um com marcador e gatilho (**D3**).
2. **`contratos-de-locacao` (v1) — CONCLUÍDA em 2026-08-09 e commitada.** As **10 tasks** aprovadas,
   em 16 rodadas de gate; só a **T3** precisou de duas rejeições. Suíte de **541 → 664 casos**, com
   crescimento monotônico — nenhum pacote encolheu em nenhuma rodada. Entrega
   **`negocio.contrato` e `negocio.contrato_fiador`** (este último vínculo puro, sem `retirado_em` —
   a ausência é a decisão), a primeira **série declarada** do produto (`CTR-{ano}-{5 dígitos}`,
   sequência por `(empresa, ano)` atrás de duas funções `SECURITY DEFINER`) e o primeiro **ciclo de
   vida governado**. **9 rotas novas** — 8 sob `/v1/contratos` e a de situação de locação sobre
   `/v1/imoveis`. Nasceram dela as ADRs **0019** e **0020**; a **0019 já foi superseded pela 0021**.
   Deixou **47 débitos** anotados, dos quais **14 já escriturados** (ver a intervenção abaixo).

**A superfície da API está pronta para congelar, e não tem mais condição pendente.** São **75 rotas**
e **60 manipuladores**, `semDeclaracao` vazio, 42 rotas do domínio com esquema derivado de
`@sysloc/contracts`. ⚠️ **É 75, e não 77** — o `77` que circulou no `tech_spec.md` vinha de uma
premissa que a medição refutou (*"cada `GET` entra em dobro por causa do `HEAD`"*), e o módulo
`cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado. Não "corrija" para 77.

**Intervenção dirigida de 2026-08-09** (fora do pipeline, no molde do commit `11c33ad`). Precedida de
auditoria dos 47 débitos **contra o código**. Resultado: **quatro já estavam pagos** um dia depois do
run (**D23**, **D24**, **D29**, **D34**), e **dez foram fechados** — **D1** e **D2** (os vãos de
detecção do `verificar-golden.sh`, os dois com mutante), **D21** (o remapeamento de século em
`Date.UTC`, único defeito funcional da lista), **D7**, **D9**, **D10**, **D31**, **D32**, **D44** e
**D45**. Suíte **664 → 665**. O parecer registrado na **§5 do `_run/run-report.md`** é **NÃO rodar
`/agent-spec-debt-resolution`** nesta fatia: os ~26 restantes são prosa em artefato de fatia fechada,
três são débito com gatilho que a skill coletaria e não deve resolver, e o default `gates: [qa]` dela
desliga justamente o Gate 2, que é quem detecta violação de `DECISÃO FECHADA`.

**Endurecimento do Protocolo Antirregressão — 2026-08-09**, também fora do pipeline. A §6 do
protocolo atribui obrigações aos dois gates e ao orquestrador, e **nenhuma delas estava escrita nos
contratos**: herdar a doutrina pelo system-prompt não é o mesmo que ter o critério na superfície pela
qual o agente decide. Quatro lacunas fechadas — o Gate 2 passou a reprovar regressão de decisão e
garantia removida do código de produção; o Gate 1 passou a enxergar **teste deletado**, que não falha,
desaparece (contagem por unidade comparada entre rodadas); o executor genérico recebeu a ordem de
precedência dentro do bloco injetado; e a escrituração de débito ficou fixada em `BAIXO` na fonte
única de severidade. **Suíte 665 → 687**, e os 22 casos novos são a **barreira executável** descrita
logo abaixo. Os dois roteiros portáteis do trabalho estão em `docs/melhoria-agent-spec-gate2-antirregressao.md`
e `docs/dar-dentes-ao-protocolo-antirregressao.md`.

> **Dois furos herdados que a F2 fechou, e que valem saber antes de tocar o código de imóveis**:
> (1) `alterarImovel` escrevia `status_locacao` incondicionalmente e a entrada não aceitava `LOCADO`,
> de modo que **toda** alteração de um imóvel locado apagava o `LOCADO` em silêncio — a T10 tirou o
> campo do corpo do `PUT` e lhe deu rota própria, hoje governada pela **ADR-0021**; (2)
> `esquemaDoImovel` ganhou `contratoVigente`, o que alcança **três** superfícies publicadas de uma vez
> — **crescimento de esquema, nunca troca de igualdade por asserção de presença**.
>
> **O oráculo do sistema antigo já foi capturado, e a janela que expirava fechou bem.** A T1 da fatia
> de contratos capturou do `/opt/frappe` a ativação e o cancelamento antes da F7; os **8 artefatos
> golden** estão versionados e o determinismo foi provado por recaptura contra site restaurado do
> zero. Não há mais captura pendente.

**Fase 1 CONCLUÍDA — as duas fatias fechadas e commitadas.** A F1 foi **desdobrada em duas fatias**,
cortando *depois* da autenticação (o corte isolamento × identidade foi rebatido: ele atravessa a
camada 5, e a fonte legítima do `empresa_id` é a sessão). Em **2026-08-05** a segunda fechou, e com
ela a fase.

1. **`fundacao-multitenancy-identidade` (v1) — CONCLUÍDA e commitada.** As 11 tasks aprovadas nos
   dois gates. Dá para logar, e o isolamento entre empresas está provado: `empresa_id`, RLS
   forçada e FK composta em toda tabela de negócio; contexto por `AsyncLocalStorage` mais
   `SET LOCAL`; guarda de cobertura sobre o catálogo; `better-auth` com barreira única de admissão
   de sessão. Depois do run, uma **intervenção dirigida de fechamento** (fora do pipeline) resolveu
   **22 dos 37 débitos** anotados, mais o **D38**, achado durante a própria revisão. Suíte em
   **274 casos**.
2. **`autorizacao-e-ciclo-de-acesso` (v1) — CONCLUÍDA em 2026-08-05 e commitada.**
   As **9 tasks** aprovadas nos dois gates, nenhuma bloqueada. Suíte de **274 → 350 casos**;
   `pnpm build`, `pnpm lint` e `pnpm test` verdes. Entrega a matriz 10×7 com **ajuste bidirecional**
   por usuário (conceder **e** retirar), sessão com `versaoPermissoes` **por pessoa** relido quando
   diverge, invalidação de sessão **na origem do evento**, onboarding por **senha provisória**
   (termo canônico do glossário — não "temporária") e as rotas do Master e do Admin. Fechou os
   débitos **D7**, **D21**, **D5**, **P-T6-1** e a metade acionável do **P-T6-2**; a outra metade
   virou o **item 5 da §F7** do plano de execução. Nasceram dela as ADRs **0010**, **0011**,
   **0012** e **0013**, e ela **aposentou a 0007**. (Registro histórico: a **0012 foi, depois,
   substituída pela 0017** — não a cite como vigente.)
   **Deixou 41 débitos anotados** na §2 do `_run/run-report.md` — hoje **dois** deles ainda têm
   marcador vivo (**D27** e **D37**); o **D38** e o **D40**, que também tinham, foram fechados.
   **A superfície de autenticação e autorização fechou aqui**: 15 rotas ao fim desta fatia, mais a
   de troca de senha do produto; a nativa de `/v1/auth/change-password` deixou de ser publicada, e o
   inventário de `/v1/auth` caiu de 6 para 5. (O total do produto **não** parou em 15 — a F2
   acrescentou 60 e a superfície hoje é de **75 rotas**.)

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
validação independente. Restaram **~85 débitos abertos** naquelas cinco fatias, quase todos `BAIXO`
de higiene local.
**O parecer registrado é NÃO rodar `/agent-spec-debt-resolution` em massa**: o custo é de 2 a 4 runs
do tamanho de uma fatia, contra ganho marginal, com F3 a F5 ainda entre aqui e o marco de entrega.

> **O parecer foi reafirmado em 2026-08-09**, sobre os 47 débitos da fatia de contratos, e agora com
> razões medidas contra a mecânica da própria skill — não só de custo. As seis estão na **§5.1** do
> `_run/run-report.md` daquela fatia; a mais forte é que o default `gates: [qa]` **desliga o Gate 2**,
> que é quem a `.claude/rules/nao-regressao.md` §6 encarrega de detectar violação de
> `DECISÃO FECHADA` — e mais da metade daqueles débitos é edição de prosa que **registra decisão**,
> em arquivos com 2 a 7 marcadores. Somando as seis fatias, são **~118 débitos abertos**.
> O caminho que se mostrou barato e seguro é a **intervenção dirigida**: escolher os poucos com
> prazo ou poder de detecção, fechar cada um com mutante medido, e escriturar o resto.

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
      aceitação de cada fatia verificados · **F1 fechada em 2026-08-05, F2 em 2026-08-09; faltam
      F3, F4 e F5**
- [ ] **Superfície da API congelada** — nenhuma fatia posterior acrescenta, remove ou altera rota;
      o congelamento é o que torna o handoff confiável · **hoje em 75 rotas / 60 manipuladores, e
      sem condição pendente** desde que a ADR-0021 fechou o D43 · ⚠️ mas **F3 a F5 ainda publicam
      rota** (cobrança, webhook Sicoob, rotinas), então o congelamento é o *depois* delas
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
| 6 | `docs/adr/` | ADRs. **21 registradas, 15 `accepted`**: 0001, 0005, 0006, 0008, 0009, 0010, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0020 e 0021. **Vinculantes para a F2**: 0006, 0008, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0020 e 0021. As **0002, 0003 e 0004** morreram com o Frappe — `deprecated` desde 2026-08-04, porque nomeiam primitivas dele (DocType, fixture, `Custom DocPerm`, Server Script). Há **duas cadeias de supersede**, e nas duas só a última se cita: a forma canônica do contrato da API é **0007 → 0012 → 0017**, vigente a **0017** (três classes de chave exposta: código legível quando há série declarada, UUID quando não há); e a transição de estado é **0019 → 0021**, vigente a **0021** (rota própria sempre; a chave de ação só quando o ato é sensível — atributo operacional do cadastro exige apenas a área). ⚠️ **Citar ADR exige abrir a `Decision`** — esta linha e o `INDEX.md` são paráfrases, e já divergiram do texto real |

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

Doze débitos têm gatilho que dispara fora da fatia que os criou: **D28** e **D32** vêm da F0;
**D23**, **D39**, **D24**, **D27** e **D37** nasceram na F1 — os três últimos na fatia
`autorizacao-e-ciclo-de-acesso` —; quatro nasceram na F2, o **D3** na fatia
`cadastro-de-imoveis-e-pessoas` e o **D28**, o **D36** e o **D44** na fatia `contratos-de-locacao`;
e um nasceu na F3, o **D1**, na fatia `cobranca-e-mora`.
O **D27** partilha com o D23 o gatilho e o fato que falta: qual é o salto confiável da borda; e o
**D36** partilha com o D28 da mesma fatia o gatilho — a F3. O **D44** é o mais novo: o marcador dele
foi emitido na intervenção dirigida de 2026-08-09, e não no run — o débito existia desde a T10 e
chegava ao futuro só por um parágrafo de docblock.
**Nenhum tem por gatilho o congelamento da superfície da API** — o único que tinha era o D43, e ele
foi fechado em 2026-08-09 pela ADR-0021, que supersede a 0019 e recorta a governança da transição
pela natureza do ato.
⚠️ **Os dois `D28` são débitos DIFERENTES** — `F0/T5` e `F2/T7` —, e a coexistência é legítima: a
sequência corre dentro da §2 da fatia que registrou cada um (§3-B da `nao-regressao.md`).
**Um já disparou e segue aberto** — o **D28 (F0/T5)**, na F1/T2.
Sete saíram daqui por terem sido fechados — **este índice lista só débito vivo**: o D7 da F3/T4, na
T5 daquela mesma fatia, quando `lerAnoDaSerieDeCobranca` nasceu em `packages/db/src/cobranca.ts` e a
borda de lançamento passou a ler o ano do mesmo `negocio.data_corrente_da_operacao()` que a visão
consulta; o D6 da F1/T5,
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
| **D44** (F2/T10, fatia `contratos-de-locacao`) | `apps/api/src/imoveis/imovel.service.ts` (`definirSituacaoDeLocacao`) | a fatia que criar no banco a **restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao`** — hoje nada fecha a janela da guarda |
| **D1** (F3/T2, fatia `cobranca-e-mora`) | `packages/contracts/src/cobranca.ts` (ponto do import) | o **terceiro consumidor monetário do pacote** — `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` sobem para `comum.ts` |

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
