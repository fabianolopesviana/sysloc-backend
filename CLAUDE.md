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

## Regras de comportamento (não negocie)

1. **Incerteza → leia o arquivo ou rode `grep`. Nunca chute.** Se não achou (função, campo, API, arquivo), diga que não achou.
2. **Menor delta possível.** Resolva só o pedido. Oportunidade de melhoria fora do escopo → reporte separado, não execute sem pedir.
3. **Não toque em código fora do escopo sem autorização explícita.** Viu algo errado → sinalize, não conserte por conta própria.
4. **"Funciona" só com evidência.** Ao afirmar que algo funciona, mostre o output do comando/teste. Não rodou → diga "não rodei".
5. **Ações destrutivas exigem confirmação prévia.** Migração de schema, delete em massa, mudança de CI/auth → confirme antes de executar.

---

## Estado atual

> **Índice, não relatório.** O painel fase a fase vive em `docs/plano-backend-novo/roadmap.md`, que é
> **gerado** por `deploy/scripts/roadmap/atualizar-roadmap.sh` (gancho `PostToolUse`) — não o edite à
> mão, e não duplique aqui o que ele já diz. O detalhe de cada fatia (débitos, achados, decisões) vive
> na `_run/` dela. Aqui fica **só o que morde quem não abriu nenhum dos dois.**

**F0 a F4 concluídas. Falta a F5** para o marco de entrega ficar ao alcance. ⚠️ Ela passou a ter
**duas fatias** em 2026-08-21, nesta ordem: `integracao-bancaria-autonoma/v1` — a ativação do webhook **por tenant** e a
aceitação do material do certificado como a AC o entrega, as duas coisas que hoje **exigem terminal**,
e a **última fatia que acrescenta rota** antes do congelamento — e
`automacoes-agendadas/v1`. A F4 fechou em
**2026-08-19**, com 43/43 tasks nas três fatias — (i) `fundacao-bancaria` em 2026-08-15 (14/14),
(ii) `emissao-e-conciliacao` em 2026-08-18 (17/17) e (iii) `webhook-e-carne` em 2026-08-19 (12/12).
São **126 tasks** aprovadas nos dois gates. ⚠️ **A (iii) É o carnê** — se este texto voltar a dizer
que ela falta, foi regressão de índice, não fatia reaberta.

- **Superfície: 105 rotas / 90 manipuladores**, `semDeclaracao` vazio, `publicas` em **20**. Medido
  na **T7 da fatia `integracao-bancaria-autonoma`**, em **2026-08-22**, pelo `CT-1038`, com as **duas medições independentes** cuja igualdade
  entre os eixos é afirmada à parte do valor esperado. ⚠️ **As duas rotas novas são a entrega da
  notícia** (`POST …/entrega-da-noticia/ativacao` e `GET …/entrega-da-noticia`), e as duas **exigem
  sessão** — por isso `publicas` **não** mudou. ⚠️ **Não conte à mão: os três números são
  constantes EXECUTÁVEIS** de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` —
  `ROTAS_PUBLICADAS_EM_PRODUCAO`, `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` e
  `PARES_PUBLICOS_DA_SUPERFICIE` —, de modo que a suíte é a fonte e este texto é a cópia. ⚠️ Ela
  **ainda cresce**, mas agora **só pela F5**: com a F4 fechada, é a última fase que publica rota, e o
  congelamento é logo depois dela. **O número da F2 era 75, não 77** — não "corrija" para 77, a
  premissa do `HEAD` duplicado foi refutada por medição. **E o 99/84 era o da (ii)** — não o
  reponha; **o 103/88 era o do fecho da F4** (`CT-1004`), medido em 2026-08-20, e ele também não se
  repõe.
- **Suíte: 1842 casos**, 9 pacotes — `contracts` **425** · `api` **389** · `shared` **263** · `db` **237** ·
  `documentos` 159 · `worker` **142** · `auth` 89 · `cobranca-bancaria` **108** · `regua` 30. **Remedidos
  um a um** na **segunda intervenção dirigida de 2026-08-22** (a da conformidade do adaptador com a
  documentação do provedor), pelo script `test` de cada pacote. ⚠️ **As DUAS intervenções daquele dia
  somaram 20 casos**, e é por isso que o total saltou de 1812: a primeira acrescentou o `CT-1050`
  (`cobranca-bancaria`) e uma perna do `CT-1044` (`contracts`); a segunda, o `CT-1051` (`worker`, 3
  pernas), o `CT-1052` (`api`, 10 pernas do endereço e do contato da entrega), o `CT-1053`
  (`cobranca-bancaria`, 2) e os casos que as variáveis novas fizeram nascer nas tabelas de partida dos
  dois processos. ⚠️ **E o fecho do `D42`, no mesmo dia, acrescentou mais 8**: o `CT-1054`
  (`db` 235 → 237, o terceiro estado da entrega e a amarra que o banco impõe), o `CT-1055` (`api`
  385 → 389, o quadro de decisão da ativação linha a linha) e o `CT-1056` (`worker` 138 → 140, a
  promoção que fecha o ciclo assíncrono). Vários fechos das duas rodadas acrescentaram **asserções a
  casos existentes**, e esses não movem contagem — não "corrija" nenhum pacote para cima procurando
  os casos do `D21`, do `W1`, do `D1` ou do `D2`.
  ⚠️ **O `worker` foi de 140 a 142 na correção do flaky do `CT-1056 (b)`, em 2026-08-22, e NÃO houve
  caso novo**: o caso era um `for` sobre três leituras e virou `it.each`, de modo que **um** caso
  passou a contar como **três**. As asserções são as mesmas, uma a uma. A razão da divisão está no
  docblock de `montarConsumidor` (`apps/worker/test/reconferencia-da-entrega.spec.ts`) — chamá-lo em
  laço deixa consumidores concorrentes na mesma fila. **Não reagrupe os três num laço para "voltar"
  a 140.**
  ⚠️ **A T1 da F5 levou `cobranca-bancaria` de 93 a 100, e as tasks seguintes dela a 105;
  a T7 levou `api` de 357 a 370; a T8 levou `worker` de 126 a 132 e `api` a 371; a T10 acrescentou o
  `CT-1042` (`worker` → 133) e o `CT-1046`, e a T9 os dois casos dela — juntas, `api` de 371 a 374.**
  O total acompanha **no mesmo diff**: número narrativo que fica para trás convida a próxima task a
  "corrigir" a contagem para o valor errado.
  ⚠️ **A linha anterior dizia `api` 370 e `worker` 126, e as duas estavam defasadas** — a T8 já as
  havia movido e a escrituração não acompanhou; não as "corrija" de volta. ⚠️ **O `api` da linha
  anterior a essa dizia 354, e antes dela 1744/1801 no total** — todos defasados pela mesma razão.
  ⚠️ **Meça por pacote** (`pnpm --filter @sysloc/<p> test`): o `turbo run test` aborta os pacotes
  irmãos e a saída agregada não é confiável.
- ⚠️ **ADRs emendadas — não cite a `Decision` sem ler a emenda**: a **0001** (a cláusula do *"apenas
  uma porta"* não alcança a porta de identidade) e a **0017** (o contador é a **0033**, não a 0015).
  **Não cite como vigentes**: 0007, 0012, 0015 e 0019 — todas superseded.
- ⚠️ **Precedente de método, confirmado cinco vezes**: *prescrição de gate é hipótese, não ordem* — o
  executor que divergiu **declarando e medindo** teve razão em todas. E o corolário que custou duas
  fases: *a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que
  ela justifica* — meça a premissa antes de registrá-la.
- **Dívida**: **407 débitos abertos em 14 fatias** — 544 blocos na §2, 137 já com marca de fecho.
  **Remedido na intervenção dirigida de 2026-08-22**, varrendo os 22 `run-report.md` do repositório.
  ⚠️ **O número anterior (372 em 13, sobre 499 blocos) estava defasado por uma razão só**: é anterior
  à fatia `integracao-bancaria-autonoma`, que acrescentou 41 blocos. **Não o reponha.** E ⚠️ **o
  número anterior a esse (~280 em 10) estava defasado por outra**, medida em 2026-08-19: **39
  débitos já pagos registravam o fecho só no campo `Status:` do corpo**, invisíveis a quem tria pelo
  cabeçalho — todos promovidos naquela data, e **hoje são zero**; a triagem por cabeçalho voltou a
  ser confiável, e é a que estes números usam. São ~89% `BAIXO`, mas **não** "quase todos de prosa":
  por alvo são 138 de teste, 107 de produção, 87 de doc e 78 de infra. E **~167 não são pagáveis
  hoje** (72 com gatilho que não chegou, 39 mirando spec de fatia fechada, 26 dependentes de
  F5/F6/F7, 20 que mandam NÃO agir, 11 em migração imutável).
  O parecer, reafirmado **seis vezes** e medido, é **NÃO rodar `/agent-spec-debt-resolution`** sobre
  o estoque. As razões vigentes, remedidas em 2026-08-22:
  1. **A curadoria humana da skill é desligada por construção aqui.** Ela apoia a segurança na FASE 3
     — *"o especialista classifica, o usuário decide"* —, e a `autonomia-do-run.md` §A1, de escopo
     universal, manda **não invocar `AskUserQuestion` e adotar a recomendada**. A recomendada da Onda
     1 é `Incluir TODOS os recomendados`. As duas regras estão certas isoladamente; a composição
     entrega a seleção a uma LLM sem ninguém no circuito.
  2. **O `gates: [qa]` default desliga o Gate 2 onde o código é protegido**: só **15%** das tasks
     casariam Critical Path por match textual (a rule é em inglês, a árvore é pt-BR), contra **58%**
     de área realmente sensível; e **67% dos pagáveis apontam para arquivo que contém marcador
     `DECISÃO FECHADA`** — 139 deles rodariam só com QA.
  3. **A extração da FASE 1 não tem campo para gatilho nem adiamento**, e por isso os ~167 não
     pagáveis viram task assim mesmo — incluídas 11 sobre `.sql` já aplicado, cujo `sha256sum` aborta
     a instalação.
  4. **O precedente empírico é contrário**: a T4 de `integracao-bancaria-configuravel/v4-debits`
     **introduziu** um vazamento (pendente parcial com senha commitado enquanto a API dizia *"nenhuma
     alteracao foi feita"*), o QA **não tinha como pegar**, e quem pegou foi o Tech Review — ligado
     só porque aquele path casava Critical Path em inglês.
  ⚠️ **Um argumento antigo CAIU e não deve ser reposto**: o de que a skill recolheria como abertos os
  débitos fechados só no corpo. A higienização de 2026-08-19 o resolveu, e a medição de 2026-08-22
  confirma **zero** nessa condição.
  O caminho que funciona é a **intervenção dirigida**: ela responde por **57 dos 137** fechos, contra
  **21** da skill — e esses 21 são todos do repositório Frappe antigo, com suíte de 113–169 testes.
  Detalhe na §6 do `_run/run-report.md` da `fundacao-bancaria`, na §7 do da `webhook-e-carne` e na §8
  do da `integracao-bancaria-autonoma`.

---

## O ponto exato onde o trabalho deste repositório termina

**MARCO DE ENTREGA DO BACKEND.** Alcançado o marco, gera-se o handoff e **encerra-se a construção
aqui**. É a materialização da **Fronteira** declarada no topo, e a lista abaixo é a definição
operacional dela — não uma meta aproximada.

O marco está alcançado quando **todos** os sete itens forem verdadeiros:

- [ ] **F1 a F5 concluídas** — todas as tasks aprovadas nos dois gates, suíte verde, critérios de
      aceitação verificados. Estado por fase: `docs/plano-backend-novo/roadmap.md`
- [ ] **Superfície da API congelada** — nenhuma fatia posterior acrescenta, remove ou altera rota;
      é o que torna o handoff confiável. **Sem condição pendente**, e com a F4 fechada resta **só a
      F5** publicando rota: o congelamento é logo depois dela. A F4 fechou em 101/86, e o fechamento do `D36` levou a **103 rotas / 88
      manipuladores**
- [ ] **`@sysloc/contracts` publicado** no GitHub privado e versionado — é o artefato que o React
      importa para trocar tipos (Zod; ⚠️ **não** há cliente ts-rest — ver a nota da Stack)
- [ ] **`handoff-frontend.md` gerado** por `/agent-spec-backend-contract-handoff`, carregando o
      modelo de domínio camelCase, o envelope de erro da **ADR-0017**, a autenticação por sessão, o
      objeto de sessão gorda com `versao_permissoes`, e o **mapa endpoint-a-endpoint** ligando cada
      um dos 35 caminhos ERPNext antigos (`levantamento-frontend.md`) à rota nova.
      ⚠️ **A §2 daquele arquivo NÃO basta**: ela descreve o mundo do ERPNext e foi escrita antes da
      F1. A **§8**, acrescentada em 2026-08-21, enumera as **8 áreas sem correspondente no legado**
      (Master, integrações bancárias, cobrança bancária, confirmação de e-mail, régua, mora, sessão,
      notícia) e as **10 decisões que mudam comportamento de tela** sem acrescentar rota. Handoff
      gerado só sobre a §2 nasce defasado **por construção**
- [x] **`handoff-master-frontend.md` gerado** em 2026-08-21 — o Painel Master é **aplicativo
      separado** (`syslocadmin.systera.com.br`, build próprio), o backend dele está **completo** (6
      rotas), e o handoff é autossuficiente. ⚠️ O handoff do Sysloc apenas **menciona** que ele
      existe e está pronto; não mistura as telas
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
| 6 | `docs/adr/` | ADRs. **36 registradas, 29 `accepted`** (medido em 2026-08-22, no fecho da fatia `integracao-bancaria-autonoma`; o número anterior — 35/28, de 2026-08-19 — é anterior à **0036**, que nasceu em 2026-08-21): 0001, 0005, 0006, 0008, 0009, 0010, 0011, 0013, 0014, 0016, 0017, 0018, 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, 0029, 0030, 0031, 0032, 0033, **0034** (o que o provedor informou consta como diagnóstico, e a trilha registra efeito ou anomalia com vocabulário do produto), **0035** (o critério que autoriza uma rota de entrada de fato de terceiro sem sessão) e **0036** (material legado que o runtime recusa é convertido por processo externo na borda de registro, e é isso que torna o percurso do cliente novo possível pela tela). **Vinculantes para a F2**: 0006, 0008, 0009, 0011, 0013, 0014, 0016, 0017, 0018, 0020, 0021 e 0033. **Vinculantes para a sub-fatia 2b da F3**: 0008, 0011, 0016, 0017, 0018, 0021, 0022, 0023, 0024, 0025 e 0026, mais as **quatro que nasceram dela** — a **0027** (uma rota de negócio dispensa sessão só quando o ato é do titular do dado, e sempre com portador de segredo), a **0028** (a rota que devolve bytes permanece no contrato, declarando mídia, nome do arquivo e o mesmo envelope de erro), a **0029** (efeito externo cujo resultado não compõe a resposta sai por fila, nunca em linha na borda) e a **0030** (artefato derivado de dado gravado é composto sob demanda e nunca armazenado — com **cláusula de exclusão**: fato recebido de terceiro, como o boleto do provedor, não é derivado e está fora do alcance dela). As **0002, 0003 e 0004** morreram com o Frappe — `deprecated` desde 2026-08-04, porque nomeiam primitivas dele (DocType, fixture, `Custom DocPerm`, Server Script). Há **três cadeias de supersede**, e nas três só a última se cita: a forma canônica do contrato da API é **0007 → 0012 → 0017**, vigente a **0017** (três classes de chave exposta: código legível quando há série declarada, UUID quando não há); a transição de estado é **0019 → 0021**, vigente a **0021** (rota própria sempre; a chave de ação só quando o ato é sensível — atributo operacional do cadastro exige apenas a área); e a política de série sequencial é **0015 → 0033**, vigente a **0033** desde 2026-08-14 (**cada série declara o próprio escopo** — contrato e cobrança em `(empresa, ano)`, o identificador perante o provedor pelo **SaaS** —, com furo aceito e número nunca reusado). ⚠️ **A 0033 nasceu de um conflito que o challenge da `fundacao-bancaria` pegou ao abrir a `Decision`**: a 0015 abria com *"todo contador sequencial deste produto é único por empresa"*, quantificador universal que o contador bancário falsifica. **Não cite a 0015 como vigente, e não "corrija" o contador para ser por empresa.** A **0020** segue vigente e é complementar, não concorrente: a 0033 fixa o *escopo*, a 0020 o *mecanismo*. **Vinculantes para a fatia (i) da F4** (`fundacao-bancaria`): 0001, 0005, 0006, 0008, 0009, 0011, 0013, 0016, 0017, 0018, 0025, 0026 e 0029, mais as **três que nasceram dela** — a **0031** (tabela sem dono-empresa vive em schema próprio da plataforma, sem `empresa_id`), a **0032** (segredo operável de terceiro é cifrado de forma reversível, nunca retorna por superfície alguma, e a ausência de vazamento se prova **por medição da saída real**) e a **0033**. ⚠️ **A ADR-0001 foi EMENDADA em 2026-08-15** (texto original preservado byte a byte), porque a cláusula do *"apenas"* uma porta ficara incompleta diante da porta de **identidade** — que é ato de configuração, não de cobrança; a emenda ataca o **contorno por renomeação**, e não a contagem de portas. ⚠️ **E foi EMENDADA DE NOVO em 2026-08-17**, também com o texto original preservado: a porta que ela reserva nasce com **quatro** operações, e não cinco — a obtenção da credencial de acesso é `client_credentials`, **vocabulário do provedor**, e acontece **dentro** do adaptador (decisão do usuário de 2026-08-16, §21.1(1) do tech spec da fatia `emissao-e-conciliacao`). O **roster de cinco capacidades não encolheu**; o que se conta em quatro é a superfície da interface. **Não "corrija" a porta para cinco. Não cite a `Decision` dela sem ler as DUAS emendas.** ⚠️ **A ADR-0017 foi EMENDADA em 2026-08-16**, também com o texto original preservado: a `Decision` dela remetia o contador à **ADR-0015**, morta desde 2026-08-14 — leia ali `ADR-0033`. A substituição já constava do `Consequences → Neutros` da própria 0017, e a emenda existe porque **é a `Decision` que se abre ao citar**, de modo que a correção estava no lugar onde o leitor de uma citação não passa. **Não cite a `Decision` dela sem ler a emenda.** ⚠️ **A ADR-0024 foi EMENDADA DUAS VEZES** — em 2026-08-13 e em **2026-08-18** —, as duas com o texto original preservado byte a byte, e a de 2026-08-18 é a **terceira ocorrência desta classe no repositório** (depois da ADR-0021 e da própria 0024 em 2026-08-13): a de **2026-08-13** declara as **duas** leituras legítimas sem contexto de empresa e o discriminador que separa uma delas de um contorno do isolamento (função `SECURITY DEFINER` de papel `NOLOGIN` de propósito único, política nominal, `GRANT` mínimo, `EXECUTE` revogado de `PUBLIC` e a função **sem parâmetro de empresa**); a de **2026-08-18** declara o **alcance da cláusula da carga** — ela leva o identificador de empresa quando **quem enfileirou já detinha direito a ele** (toda fila anterior a ela, e nada nelas muda), e na **entrada de fato de terceiro** (ADR-0035) a empresa é o **resultado** da travessia nominal, de modo que o campo **não existe** na carga. Pôr `empresaId` na carga da entrada de terceiro seria **violação, não conformidade**: o único valor disponível na borda viria do recebido. **Não "corrija" a carga da fila do webhook para levar empresa. Não cite a `Decision` dela sem ler as DUAS emendas.** ⚠️ **Citar ADR exige abrir a `Decision`** — esta linha e o `INDEX.md` são paráfrases, e já divergiram do texto real |

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

**Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + drizzle-kit + postgres.js ·
PostgreSQL 18 · Zod 4 · better-auth · BullMQ + ioredis + Redis 7 · nodemailer · Pino ·
Vitest + embedded-postgres · pnpm 11 + Turborepo + Biome + mise + mprocs**

Específicos deste domínio: **`node:https`** (o mTLS do Sicoob — ⚠️ o cliente é o **nativo**, e o
`undici` foi **avaliado e recusado**; a razão está no docblock de `adaptador-sicoob.ts`),
**`node:crypto` `X509Certificate`** (leitura de `.pfx`), **@react-pdf/renderer** (contrato e carnê),
**systemd timers** (agendamento).

> ⚠️ **A stack acima é a MEDIDA, e diverge da planejada.** `decisao-e-stack.md` §4 ainda lista
> **ts-rest**, **OpenTelemetry**, **tsup**, **pdf-lib** e **undici** — nenhum deles existe hoje nos
> manifests, no `.mise.toml` ou em `import` de `src/`. Não os cite como se estivessem instalados, e
> não os introduza sem decisão: o pacote de contratos é Zod puro, e o `@sysloc/contracts` que o
> frontend importa **não** publica cliente ts-rest.

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
- **Limiar de três.** Ao **terceiro** consumidor, o símbolo duplicado sobe para casa compartilhada
  em vez de ganhar a terceira cópia. Por quê: com duas cópias, endurecer uma deixa a outra para
  trás; com três, elas já divergiram — a terceira cópia de `CODIGO_NO_ASSUNTO` nasceu com a flag
  `u` diferente das anteriores. É o gatilho que os débitos deste repositório já usam de fato
  (D1, D26, D3), e escrevê-lo evita que cada fatia o redecida.
- **Acessório de suíte se importa, não se copia.** Antes de escrever num arquivo de teste um
  acessório de arranjo — cliente HTTP, entrada de sessão, montador de corpo, abertura de instância
  efêmera —, procure a casa compartilhada do diretório (os `.ts` sem `.spec` ao lado, no molde de
  `apps/api/test/documento.ts` e `base32.ts`): se existir, importe; se não existir, crie-a. Por quê:
  o Limiar de Três acima pressupõe que **quem duplica sabe contar as cópias**, e quem escreve uma
  suíte nova copia de **uma** vizinha — para ele é a segunda cópia, nunca a enésima, e o gatilho
  nunca dispara. É o que fez o cliente HTTP e a entrada de sessão nascerem em quase toda suíte de
  borda, cada cópia livre para divergir.
  ✅ `import { pedir, entrar } from './acessorios-de-borda.ts';`
  ❌ redeclarar `async function pedir(...)` no topo da suíte nova porque a vizinha também o declara
- **Superfície publicada**: `.claude/rules/ancoras-de-superficie.md` — igualdade de conjunto com
  controle antivácuo, âncora no mesmo diff da publicação, e a §5.2 declarando o que vai crescer.
- **Contrato publicado**: `.claude/rules/contrato-publicado.md` — entrada fechada
  (`z.strictObject`), saída aberta (`z.object`); a direção decide a estritude.
- **Autonomia do run**: `.claude/rules/autonomia-do-run.md` — autorização **permanente** do usuário,
  de escopo universal como o Protocolo Antirregressão. Nenhum agente pausa aguardando resposta (a
  resposta é **sempre a opção recomendada**, e quem decide registra a recomendação e a razão), o
  limite de 3 tentativas **não** bloqueia o run, e o relatório de fecho de uma task é seguido, **na
  mesma resposta**, pelo despacho da próxima. Só não revoga o *dever de escalar* de `DECISÃO
  FECHADA`/ADR: ali o que cai é a **espera**, nunca o rigor — e a recomendada é sempre a conservadora.
- **Lint/format**: Biome. Sem ESLint, sem Prettier.
- **Commits**: Conventional Commits em pt-BR — ver a skill `agent-spec-semantic-commit`.
- **Specs**: o framework agent-spec está em `.claude/` (37 skills, 10 rules, 4 agents). Features
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

São **38**, e a tabela abaixo é a lista viva — ela, e não este parágrafo, é a fonte.

⚠️ **O identificador é o par `Dnn · F{n}/{origem}`, nunca o número sozinho** — a sequência corre
dentro da §2 da fatia que registrou cada débito. Hoje convivem **dois `D3`**, **dois `D12`**, **dois
`D13`**, **dois `D26`**, **dois `D27`**, **dois `D28`**, **dois `D37`** e **dois `D49`**, todos legítimos e todos débitos diferentes.
⚠️ **Os dois `D13` repetem o par INTEIRO** (`D13 · F4/T6` nas fatias `emissao-e-conciliacao` e
`webhook-e-carne`) — é o primeiro caso do repositório, e o que os separa é só o caminho do `ÍNDICE`,
como a §3-B prevê. A regra completa está na §3-B
da `.claude/rules/nao-regressao.md`, que é permanente — este bloco é transitório e some quando o
último marcador sair.

> **Esta tabela é um ÍNDICE, não um relatório.** Cada linha é um **ponteiro curto**; impacto medido,
> o que fazer e prova exigida vivem **só** na §2 do `run-report.md` da fatia que o registrou, para
> onde o campo `ÍNDICE` do marcador aponta. É o que a §3-B manda (*"marcador que copia o relatório
> inteiro apodrece"*), e a razão é medida: este arquivo entra no contexto de **todo** agente, em toda
> task. **Linha que passar de ~150 caracteres deve ter o excedente movido para a §2.**

| Débito | Onde | Dispara quando |
|---|---|---|
| **D28** (F0/T5) | `grep -rln --exclude-dir=dist "D28 · F0/T5" apps packages deploy` — a contagem sai do comando, que não envelhece | **JÁ DISPAROU (F1/T2)** — consumidor novo de `packages/shared/test/` por caminho relativo profundo |
| **D9** (F0/T2, fatia `fundacao-stack-nativa`) | `deploy/scripts/instalacao/verificar-provisionamento.sh` (junto de `afirmar_igual`) | a **próxima fatia que escrever um `verificar-*.sh`** — são **10** cópias do esqueleto e elas são **10 formas distintas**; só 2 rodam sem privilégio, então feche COM janela assistida |
| **D23** (F0/T3, fatia `fundacao-stack-nativa`) | `packages/shared/src/log.ts` (cabeçalho) | ⚠️ **BLOQUEADO por protocolo, não por tempo** — extrair `redacao.ts` moveria código sob as duas `DECISÃO FECHADA` do arquivo; fecha só se elas caírem pelo próprio `REVERTER EXIGE`, ou por autorização expressa do usuário |
| **D23** (F1/T8) | `apps/api/src/autenticacao/autenticacao.module.ts` | a **publicação atrás do servidor de borda na F7** — origem confiável derivada do endereço de retorno |
| **D24** (F1/T5, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/main.ts` | a **publicação atrás do servidor de borda na F7** — `/docs*` atende sem sessão por decisão registrada, que vale só enquanto a API é local |
| **D27** (F1/T6, fatia `autorizacao-e-ciclo-de-acesso`) | `packages/auth/src/autenticacao.ts` | a **publicação atrás do servidor de borda na F7** — sem ela o limitador não tem eixo de origem |
| **D37** (F1/T8, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/master/empresa.controller.ts` | a **primeira comparação do `:id` do Master com identidade da sessão** — o esquema de lá não canoniza a caixa do UUID |
| **D3** (F2/T1, fatia `cadastro-de-imoveis-e-pessoas`) | `packages/contracts/src/comum.ts` | a **primeira task que abrir `usuario.controller.ts` por outra razão** — `ESQUEMA_DO_IDENTIFICADOR` tem duas definições |
| **D44** (F2/T10, fatia `contratos-de-locacao`) | `apps/api/src/imoveis/imovel.service.ts` (`definirSituacaoDeLocacao`) | a fatia que criar no banco a **restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao`** — hoje nada fecha a janela da guarda |
| **D26** (F3/T8, fatia `cobranca-e-mora`) | `packages/db/src/derivacao-de-cobranca.ts` (`ultimoDiaDoMes`) | o **terceiro consumidor de aritmética de calendário do pacote** — `ultimoDiaDoMes` e `ehBissexto` sobem para módulo próprio |
| **D20** (F3/T7, fatia `cobranca-e-mora`) | `packages/db/migracoes/0010_seguranca_cobranca.sql` (bloco da emenda) | **JÁ DISPAROU (2026-08-18)** — a `0010` foi aplicada ao banco durável; o arquivo é imutável e o marcador NÃO sai (removê-lo mudaria o `sha256sum` e abortaria a migração) |
| **D3** (F3/T1, fatia `regua-de-cobranca`) | `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh` (`consultar_o_legado`) | o **quarto consumidor** do caminho de leitura autenticada do legado, ou a **primeira alteração das garantias de transporte da credencial** — hoje são três cópias e endurecer uma deixa as outras para trás |
| **D12** (F3/T4, fatia `regua-de-cobranca`) | `packages/regua/src/mensagem.ts` (a desestruturação de `ESTADOS_DA_COBRANCA`) | a **primeira task que abrir `packages/contracts/src/cobranca.ts`** por outra razão — ali nasce `ESTADOS_AVISAVEIS` como tupla `as const` e a escolha do molde deixa de depender de posição |
| **D14** (F3/T5, fatia `regua-de-cobranca`) | `packages/db/src/envio-de-cobranca.ts` (`FUSO_DA_OPERACAO`) | a **primeira migração que redefinir `negocio.data_corrente_da_operacao()`** — o fuso tem duas declarações executáveis e nada as amarra |
| **D49** (F3/T10, fatia `regua-de-cobranca`) | `apps/worker/test/ambiente.spec.ts` (docblock do `CT-643`) | a **escalada que autorize mover o bloco sob `DECISÃO FECHADA — T8 / Gate 1 rodada 2`**, ou o **terceiro processo** que precisar da maquinaria — hoje o detector de exigência de ambiente tem duas cópias e endurecer uma deixa a outra para trás |
| **D54** (F3/T11, fatia `regua-de-cobranca`) | `apps/api/test/equivalencia-com-o-oraculo.spec.ts` (`CODIGO_NO_ASSUNTO`) | o **quarto consumidor** do molde de extração do código de cobrança, ou a **primeira alteração da forma do código** — hoje são três cópias e elas já divergem na flag `u` |
| **D12** (F3/T10, fatia `documentos-e-confirmacao`) | `packages/documentos/src/mensagem-de-confirmacao.ts` | a **terceira** mensagem de e-mail do produto (o boleto, na F4) — ali `MensagemDeEmail` e a porta de envio sobem para `@sysloc/shared` |
| **D25** (F4/T7, fatia `fundacao-bancaria`) | `packages/db/src/certificado-do-provedor.ts` (`recusarCertificadoVencido`) | a criação de `negocio.dia_da_operacao(timestamptz)`, ou o **quarto consumidor** do fuso da operação no pacote — hoje são três declarações e nada as amarra |
| **D13** (F4/T6, fatia `emissao-e-conciliacao`) | `packages/db/src/boleto-da-cobranca.ts` (junto de `ErroDeCobrancaNaoAlcancada`) | a fatia que criar no banco a **restrição pareando `linha_digitavel` com `nosso_numero`** — hoje a linha meio preenchida é representável. Mesma classe do D44 · F2/T10 |
| **D26** (F4/T9, fatia `emissao-e-conciliacao`) | `packages/cobranca-bancaria/src/guarda-de-boletos.ts` (cabeçalho) | a **F5**, que traz o agendamento, ou a **primeira medição do diretório acima de 20 GB** — não há expurgo dos boletos guardados (~1,4 GB/mês projetados) |
| **D34** (F4/T11, fatia `emissao-e-conciliacao`) | `packages/cobranca-bancaria/src/emissao-em-lote.ts` (junto de `guarda.gravar`) | ⚠️ **gatilho EMENDADO em 2026-08-19** (a metade da fatia (iii) venceu e foi refutada: dá observabilidade, não reconciliação) — vigente é **persistir o identificador enviado antes da chamada**, ou ampliar o modelo canônico |
| **D49** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/carga-da-tarefa.ts` (cabeçalho) | a **primeira task autorizada a abrir `regua.ts` ou `confirmacao-de-email.ts`** — a tradução de `ZodError` em nome de campo tem três cópias no processo |
| **D50** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/emissao-em-lote.ts` (junto de `dadosDaEmissao`) | o **terceiro consumidor** da projeção do pedido de emissão, ou a primeira alteração dos campos que ela leva ao provedor — hoje são duas cópias |
| **D51** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/main.ts` (junto de `ehChaveDeCifraAceitavel`) | ⚠️ **JÁ DISPAROU (F5/T7)** — a **primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`**, ou o terceiro processo que exigir as mesmas variáveis — as duas conferências de forma têm duas definições |
| **D52** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/test/varredura-de-segredo.ts` (cabeçalho) | o **terceiro consumidor** do molde de varredura com controle positivo fora de `apps/worker/test/`, ou a primeira alteração das formas buscadas — hoje são duas cópias |
| **D53** (F4/T16, fatia `emissao-e-conciliacao`) | `packages/shared/src/log.ts` (junto de `redigirErro`) | a **próxima superfície que decifre o segredo operável**, ou a primeira exceção do produto que anexe campo próprio fora de `RADICAIS_SENSIVEIS` — o eixo por nome de chave não a alcança |
| **D58** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/emissao-em-lote.ts` (junto da assinatura de `comReentranciaBenigna`) | o **terceiro consumidor** do discriminador, ou a primeira alteração do contrato do sentinela — `<T>` é irrestrito e a reserva de `undefined` vive só no docblock |
| **D13** (F4/T6, fatia `webhook-e-carne`) | `apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts` (junto do `catch` do enfileiramento) | a **F5**, que traz o agendamento, ou o primeiro caso real de fila indisponível na recepção — notícia parada em `RECEBIDO` não tem quem a reprocesse |
| **D21** (F4/T9, fatia `webhook-e-carne`) | `apps/api/test/retomada-de-retidas.spec.ts` (junto de `semearCobranca`) | a **primeira task autorizada a abrir as duas suítes irmãs** da notícia bancária — o arranjo da cobrança com boleto e certificado tem três cópias |
| **D27** (F4/T11, fatia `webhook-e-carne`) | `deploy/nginx/sysloc-notificacao-bancaria.conf` (cabeçalho) | a **publicação da API inteira na F7** — o vhost publica um caminho para fora e não há limitador de abuso nele |
| **D43** (F4/fechamento, fatia `webhook-e-carne`) | `deploy/scripts/borda/instalar-borda-de-notificacao.sh` (junto de `NOME_DO_VHOST`) | o produto receber notícia de um **segundo provedor bancário** — o nome do vhost é fixo e o segundo hostname sobrescreveria o primeiro |
| **D1** (F5/T1, fatia `integracao-bancaria-autonoma`) | `packages/cobranca-bancaria/src/conversao-do-material.ts` (junto de `executarOConversor`) | o módulo ganhar ponto de injeção legítimo do binário ou do teto — o estouro do teto não tem prova |
| **D31** (F5/T7, fatia `integracao-bancaria-autonoma`) | `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` (junto de `DISCRIMINADOR_DO_CERTIFICADO`) | a **primeira task autorizada a abrir `apps/api/src/cobrancas/boleto.service.ts`**, ou o terceiro consumidor — as 6 constantes de recusa de pré-condição têm duas cópias |
| **D32** (F5/T7, fatia `integracao-bancaria-autonoma`) | `apps/api/test/entrega-da-noticia.e2e.spec.ts` (junto de `EmpresaMontada`) | a primeira task autorizada a abrir uma das **seis** suítes com `entrarComSegundoFatorCumprido` — medido, o Limiar de Três já disparou para ela |
| **D37** (F5/T8, fatia `integracao-bancaria-autonoma`) | `apps/worker/src/tarefas/reconferencia-da-entrega.ts` (junto de `nadaMudou`) | `limitarDiagnostico` virar símbolo publicado de `@sysloc/db`, ou o primeiro ramo do produto que LEIA dentro do `diagnostico` — a comparação do desfecho não o alcança |
| **D38** (F5/T8, fatia `integracao-bancaria-autonoma`) | `apps/worker/src/main.ts` (junto de `criarAdaptadorSicoob` da entrega) | o **terceiro** ponto de fiação não provado de porta bancária — hoje são dois —, ou a extração da composição raiz em unidade testável |
| **D40** (F5/T9, fatia `integracao-bancaria-autonoma`) | `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (junto de `naBorda`) | a **primeira task autorizada a abrir a suíte** — ela tem duas formas de falar HTTP, e a privada convida a ser copiada |
| **D43** (F5/fechamento, fatia `integracao-bancaria-autonoma`) | `packages/cobranca-bancaria/src/adaptador-sicoob.ts` (junto de `comporCadastroDaEntrega`) | a resposta do provedor sobre a tabela de `codigoSituacao`, ou o primeiro valor fora dos **dois** documentados — ⚠️ **emendado**: o `D42` fechou e o campo passou a ser LIDO |

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
- A **caracterização das regras de negócio** já rodou, e os **10 artefatos golden** estão versionados:
  os 6 da captura original, os 2 de contrato (fatia `contratos-de-locacao`) e o
  `regua-de-cobranca.json`, capturado pela **T1 da fatia `cobranca-e-mora`** em 2026-08-10. **Não há
  mais captura pendente.**
- A credencial de API do ERPNext segue **exposta em texto claro** no bundle público da porta
  8300 enquanto ele existir. Pendência aberta.
