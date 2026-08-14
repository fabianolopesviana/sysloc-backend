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

**Fase 3 CONCLUÍDA em 2026-08-13 — as três fatias fecharam.** A fase foi **partida em duas fatias** no
pré-refinamento (`docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md`), pelo corte
**por efeito colateral**: a fatia 1 não toca nada fora do banco, a fatia 2 é toda ação sobre o mundo.

1. **`cobranca-e-mora` (v1) — CONCLUÍDA em 2026-08-10. As 11 tasks aprovadas nos dois gates.** `negocio.cobranca` e
   `negocio.configuracao_de_mora`, a view `cobranca_derivada` com `security_invoker` como **fonte
   única do estado e da mora**, a série `COB-{ano}-{7 dígitos}` atrás de duas funções
   `SECURITY DEFINER`, e as **7 rotas novas** (superfície em **82/67**). **Fechou o D28 (F2/T7)** na T9,
   com o marcador e a linha do índice saindo no mesmo commit. Deixou o **D1**, o **D26** e — pela
   intervenção dirigida abaixo — o **D20** com marcador e gatilho (índice abaixo). Suíte **687 → 835**. A **T1** fechou por último e
   capturou o **oráculo da régua de cobrança** — o 10º artefato golden —, alcançando o **nível 1 da
   ordem de queda** (o melhor: despachante substituído no processo, `invocacoes_do_despachante_real = 0`).
   Ela registra a **divergência automático × manual** que motivou a fatia: para a cobrança cancelada e
   vencida, `core.py` resolve `Fechada` e `emailer.py` resolve `Vencida`, com 1 mensagem no manual
   contra 0 no automático — é o defeito que a **fatia 2 NÃO deve portar**.
2. **`regua-e-documentos` (v1) — PRÉ-REFINADA em 2026-08-11, e ela PARTIU EM DUAS.** O
   pré-refinamento é `docs/specs/features/regua-e-documentos/v1/pre-refinement.md`, e é a **entrada
   dos dois runs**; ele permanece sob este nome, como o da fase permaneceu sob
   `cobranca-mora-e-documentos/`. O corte é **objeto × natureza de prova**, que coincidem:
   **2a `regua-de-cobranca`** (o que age; oráculo executável de 51 KB) e
   **2b `documentos-e-confirmacao`** (o que sai; oráculo textual, ou nenhum). A **2a vem primeiro**,
   porque carrega a **task de prazo** que extrai o fonte do PDF — o precedente é a T1 da fatia 1.
   O **D32 (F0/T6)** fechou na 2a (T7); o débito D36 da fatia `contratos-de-locacao` **fechou na 2b
   (T7)**, e **por construção**: com o PDF derivado sob demanda não existe arquivo preexistente de que
   o cancelamento possa depender.

   ✅ **2a `regua-de-cobranca` (v1) — CONCLUÍDA em 2026-08-12. As 12 tasks aprovadas nos dois gates,
   nenhuma bloqueada, e os 18 Critérios de Conclusão da Feature conferidos um a um na §7 do
   `task_plan.md`.** Entrega `negocio.politica_de_aviso` e `negocio.envio_de_cobranca` sob RLS
   forçada (migrações `0011`/`0012`, 3 enums), o **predicado de elegibilidade no banco** sobre
   `cobranca_derivada`, o pacote **`@sysloc/regua`** (pacotes 4 → 5), o **contrato da fila em
   `@sysloc/shared`** — que **fechou o D32 (F0/T6)** nas duas pontas na T7 —, e as **4 rotas novas**
   sob `/v1/automacao-de-cobranca`, levando a superfície de **82/67 a 86/71**, conferida por **dupla
   medição independente** com a igualdade entre os dois eixos afirmada (CT-635). Suíte **835 → 1004**,
   por pacote e monotônica. A **equivalência com o oráculo** fecha com **uma única** divergência —
   `('REG-08','manual')`, por vitória —, com os dez vereditos escritos **antes** da execução e o lado
   do oráculo **lido do golden**. A T1 extraiu o fonte do Server Script `PDF contrato` (o **11º**
   artefato golden) antes do desligamento. Deixou **quatro** débitos com gatilho novos (**D3**,
   **D12**, **D13**, **D14**) mais o **D49**, o **D54** e o **D57**; desses, o D13 já fechou — na T8
   da sub-fatia 2b —, e os outros seis seguem vivos, no índice abaixo. Duas
   rejeições no run inteiro, e as duas sobre o **mesmo antipadrão**: o AP-29 na T11 (Gate 1) e na T12
   (Gate 2, que **elevou** o `BAIXO` que o Gate 1 lhe delegou — a rubrica do catálogo é mecânica, e
   *"o que se perde não é cobertura, e sim a garantia NOMEADA"*).
   ⚠️ **O carnê NÃO é desta fatia** — foi para a **F4** em 2026-08-10, porque a fonte de cada página
   é o boleto emitido. O dimensionamento medido continua valendo: a régua tem **837 LOC** (não
   ~700); o gerador do PDF é o **Server Script `PDF contrato`**, 752 linhas de fonte **existindo só
   no banco** (o golden tem 174 linhas — é a saída, não o fonte); e a quinta peça ativa é o
   `Automacao cobranca config api` (154 linhas, a configuração **Single** da régua).
   **A 2b nasceu com QUATRO ADRs, todas de 2026-08-12**: a **0027** (critério para uma rota de negócio
   dispensar sessão) e a **0028** (o que o contrato publica para uma rota que devolve bytes), as duas
   pré-requisito; a **0029** (efeito externo sai por fila), promovida da decisão D8 do tech-alignment;
   e a **0030** (artefato derivado é composto sob demanda, nunca armazenado), confirmada no challenge
   como candidato 5/5. Uma quinta candidata (granularidade da fila) foi **recusada** por repetir o que
   o RLS e a F5 já forçam.

   ✅ **2b `documentos-e-confirmacao` (v1) — CONCLUÍDA em 2026-08-13, e com ela a FASE 3. As 12 tasks
   aprovadas nos dois gates, nenhuma bloqueada**, e os Critérios de Conclusão da Feature conferidos um a
   um na §7 do `task_plan.md`. Entrega o pacote **`@sysloc/documentos`** (pacotes 5 → 6, composição pura
   mais a porta de renderização), `negocio.portador_de_confirmacao` sob RLS forçada, a coluna
   `email_confirmado_em`, a **saída** de `pdf_contrato_arquivo` (raio de 22 arquivos), as migrações
   `0013`/`0014` e as **3 rotas novas**, levando a superfície de **86/71 a 89/74** por dupla medição
   independente **com a igualdade entre os eixos afirmada** (CT-732). Suíte **1004 → 1248** casos, por
   pacote e monotônica. **Fechou o D36 (F2/T8) na T7 por construção** e o **D13 (F3/T5) na T8**, os dois
   nas duas pontas; **emitiu o D12 (F3/T10)**, também nas duas pontas; e **conferiu o D49 e o D57** — este
   com o gatilho declarado **JÁ DISPARADO**. Deixou **19 débitos** anotados na §2 do `_run/run-report.md`.
   ⚠️ **Três achados de segurança pegos por MEDIÇÃO e nenhum por leitura, os três pelo Gate 2**: o
   **segredo do portador em claro alcançando o journal por `err.command.args`** (T9, **CRÍTICO** — o
   `bullmq` empurra `job.data` como argumento de comando Redis, o `ioredis` o anexa ao erro, e a redação
   não alcança); a **renderização de ~0,5 s segurando conexão física dentro do `sql.begin`** (T7); e o
   **consumo do portador sem reconferir validade** (T8), que o Gate 1 havia aprovado. ⚠️ **A ADR-0024 foi
   EMENDADA (não superseded) na T11**, por escalada do Gate 2 e decisão do usuário: a cláusula de
   exclusividade ficara **falsa** — *"a decisão não mudou: mudou o registro dela"*. ⚠️ **Precedente de
   método que a fatia estabeleceu, e que vale para a F4**: **prescrição de gate é hipótese, não ordem** —
   por três vezes o executor divergiu **declarando e medindo**, e nas três o gate lhe deu razão; numa
   delas o Gate 1 **se retratou por escrito** depois de reproduzir o experimento.

   ⚠️ **O challenge derrubou a afirmação de que não havia
   conflito spec × ADR**: a 0028 e a 0027 exigiram **leitura conjunta registrada por escrito** na
   §21.3 do `tech_spec.md` — e a nota da 0027 **proíbe** filtrar `consumido_em` na função
   `SECURITY DEFINER`, porque o endurecimento aparente quebraria a RN-10. Achou também que o
   `DROP COLUMN` de `pdf_contrato_arquivo` alcança **22 arquivos** contra os 10 declarados (§3.6.1) e
   que a coluna a sair é a `colunaLivre` do teste de RLS do contrato. ⚠️ **Cinco premissas do briefing
   foram refutadas por medição em 2026-08-11** — entre elas, que o `email_token_hash` do legado
   **não é hash e o token não é aleatório** (é o ID do locatário mais o timestamp, guardado em
   claro), e que a divergência automático × manual tem **três naturezas, não uma** (só REG-08 é
   defeito; REG-02, REG-04 e REG-10 são o manual ignorando janela e trava, e **preservam-se**). O
   detalhe está na §3-B do pré-refinamento — não o reproduza aqui.

> ✅ **O run da fatia 1 TERMINOU em 2026-08-10, e ela está FECHADA** — as **11 tasks** concluídas e
> staged, e os **13 Critérios de Conclusão da Feature** satisfeitos e conferidos um a um na §7 do
> `task_plan.md`. A T11 fechou pelo caminho **"Retomar nos gates"** da segunda pausa; a T1, por
> último, em rodada única (`APROVADO_COM_OBSERVACOES` nos dois gates, 0 bloqueantes).
>
> ⚠️ **A T1 esteve diferida por uma premissa FALSA, e vale saber por quê — o padrão se repete.** Três
> artefatos (a §7 da task, o `task_plan.md` e este arquivo) afirmavam que a captura **exige `sudo` com
> senha interativa** e que **nenhum subagente a conduz**. Refutado por quatro comandos: `grep -n sudo`
> nos quatro arquivos de `deploy/scripts/caracterizacao/` (4.623 linhas) retorna **vazio**, o acesso ao
> `/opt/frappe` é todo por `docker compose`, e o usuário do host está no grupo `docker`. A exigência de
> `sudo` que a `.claude/rules/testing-stack.md` registra é **verdadeira para
> `deploy/scripts/instalacao/`**, que toca o SO — a T1 herdou a frase da fatia anterior e trocou o
> sujeito. **A distinção é por FRENTE, não por host.** O segundo obstáculo registrado (disco em 94%)
> era real e não apertava: o dump tem 8,8 MB e a restauração custa ~200 MB contra 1,9 GB livres. Custo
> do erro: a task de **prazo** da fatia — a única cuja janela fecha e não reabre — ficou parada por uma
> premissa que quatro comandos derrubariam. **Premissa que bloqueia trabalho com prazo merece ser
> medida antes de ser registrada.**
>
> ⚠️ **Achado PRÉ-EXISTENTE que o fechamento encontrou**: o `verificar-golden.sh` termina REPROVADO no
> **`CT-013`** (*"a credencial aparece na árvore versionada"*, apontando `senha.spec.ts`, `pessoa.ts` e
> `semente.ts`). **Não é regressão da fatia** — provado por execução do verificador num worktree limpo
> em `fb93915`, onde reprova idêntico e com mais ocorrências, e os três arquivos são intocados pela
> fatia. Causa **provável** (não confirmada): colisão de agulha, já que a credencial do ambiente legado
> é uma palavra de dicionário de 5 caracteres e o casamento é por token sobre a árvore inteira. Quem
> for fechar precisa abrir os pontos e decidir se é colisão ou vazamento real. Detalhe na §4 do
> `_run/run-report.md`.
>
> ✅ **A fatia FOI COMMITADA em 2026-08-10**, em **quatro commits** sobre `fb93915` — `256e53c`
> (T2..T5, o domínio, a visão e a carteira), `5451847` (T6, a mora), `3341d19` (T7..T10, as transições
> e a ligação com o contrato) e `056a1ca` (T11 e o fecho). Os 59 arquivos e os `+21.629/−453` batem
> com o índice que estava staged. O agrupamento saiu dos marcadores sintéticos `t5_sha`, `t6_sha` e
> `t10_sha`, que sobreviveram ao run. A **ADR-0021 foi emendada** durante a T7, por decisão do usuário
> escalada pelo Gate 2: a `Decision` ganhou o roster explícito das instâncias da segunda classe, e o
> pagamento e o cancelamento de **cobrança** estão nele por nome.
>
> Dois fatos operacionais que não estão em artefato de spec e mordem quem rodar a suíte:
> ✅ o **`CT-907` DEIXOU de ser flaky em 2026-08-14** — não o leia mais como flake conhecido. Ele
> expirava no teto de 5000 ms sob disputa de CPU porque a **caminhada da árvore versionada era paga
> dentro do primeiro `it` que a consumia** (medido: 6.064 ms para 28 casos, dos quais **5.464 ms num
> único caso**). A intervenção dirigida a moveu para um `beforeAll` — que roda sob o `hookTimeout` de
> 90 s que `packages/shared/vitest.config.ts` já declarava —, e o teto de **caso** ficou intocado, de
> propósito. ⚠️ **Consequência que vale saber**: o caso agora só pode falhar **por asserção**, e falha
> em ~15 ms; se ele reprovar, é achado — não há mais o desfecho "timeout" para descartar;
> e o **disco do host está em ~96%**, com resíduos de `/tmp/sysloc-banco-*` já tendo produzido
> `No space left on device`, que **se disfarça de teste vermelho**. Rode `rm -rf /tmp/sysloc-banco-*`
> entre execuções. E **meça a suíte POR PACOTE** (`pnpm --filter @sysloc/<pacote> test`): o
> `turbo run test` **aborta os pacotes irmãos** quando um falha, e a saída agregada não carrega
> contagem confiável dos interrompidos.

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

**A superfície da API não tem condição pendente para congelar, mas voltou a crescer na F3.** Ela
fechou a F2 em **75 rotas / 60 manipuladores**, `semDeclaracao` vazio, 42 rotas do domínio com
esquema derivado de `@sysloc/contracts`. Na fatia `cobranca-e-mora` ela sobe em **três tasks**:
a **T5** levou a **78/63**, a **T6** a **80/65** e a **T7** a **82/67** — as três aprovadas nos dois
gates. A conferência final por **dupla medição independente** foi o **CT-533**, na T11 daquela fatia:
**82 pelo roteador e 82 pela composição**, com **67** manipuladores, aprovada nos dois gates.
Na sub-fatia `regua-de-cobranca` ela sobe de novo em **duas tasks** — a **T9** levou a **84/69** e a
**T10** a **86/71** —, e o **CT-635**, na T12, fechou o número por **dupla medição independente com a
igualdade entre os dois eixos afirmada explicitamente**, mais três mutantes: o disparo declarando só
a ação, uma rota de área sem declaração e uma rota acrescentada fora da contagem — **cada um reprova
nomeando o item ofensor**. Na sub-fatia `documentos-e-confirmacao` ela sobe pela última vez da F3, em
**três tasks** — a **T7** levou a **87/72** (a rota de bytes do documento), a **T9** a **88/73** (o
reenvio da confirmação, o **primeiro `202` do produto**) e a **T11** a **89/74** (a **única rota de
negócio sem sessão**, sob `@RotaPublica()`) —, e o **CT-732**, na T12, fechou o número pela mesma dupla
medição, com a igualdade entre os eixos afirmada e o mutante da rota sem declaração **nomeando
`{ metodo, caminho, controlador }`** da ofensora. **A superfície de hoje é 89 rotas / 74 manipuladores**,
`semDeclaracao` vazio e `publicas` com **exatamente uma** entrada nova.
⚠️ **O número da F2 era 75, e não 77** — o `77` que
circulou no `tech_spec.md` vinha de uma premissa que a medição refutou (*"cada `GET` entra em dobro
por causa do `HEAD`"*), e o módulo `cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado. Não
"corrija" para 77, nem propague a premissa para as contagens novas.

**Intervenção dirigida de 2026-08-09** (fora do pipeline, no molde do commit `11c33ad`). Precedida de
auditoria dos 47 débitos **contra o código**. Resultado: **quatro já estavam pagos** um dia depois do
run (**D23**, **D24**, **D29**, **D34**), e **dez foram fechados** — **D1** e **D2** (os vãos de
detecção do `verificar-golden.sh`, os dois com mutante), **D21** (o remapeamento de século em
`Date.UTC`, único defeito funcional da lista), **D7**, **D9**, **D10**, **D31**, **D32**, **D44** e
**D45**. Suíte **664 → 665**. O parecer registrado na **§5 do `_run/run-report.md`** é **NÃO rodar
`/agent-spec-debt-resolution`** nesta fatia: os ~26 restantes são prosa em artefato de fatia fechada,
três são débito com gatilho que a skill coletaria e não deve resolver, e o default `gates: [qa]` dela
desliga justamente o Gate 2, que é quem detecta violação de `DECISÃO FECHADA`.

**Intervenção dirigida de 2026-08-10**, sobre os **39 débitos da fatia `cobranca-e-mora`**, depois de
a fatia ser commitada. Precedida de auditoria **contra o código**, um a um. **Oito fechados** —
**D15** (o `strictObject` no esquema de saída, o único que alcançava o `@sysloc/contracts` publicado),
**D14** (`Object.freeze` na política ausente), **D36** (as citações da ADR-0019 superseded), **D23**
(a definição única de `ESQUEMA_DO_CORPO_VAZIO`, com o `CT-357` e dois mutantes), **D34**, **D20** (o
marcador da janela da `0010`), **D5** e **D33** (que já estava pago). Suíte **834 → 835**. A auditoria
corrigiu três fatos que a §2 registrava errado: o **D23 tinha cinco cópias, não duas**; o **D36
alcançava 20 citações, não 14**; e o **D33 já estava fechado desde a T10**. Duas citações de ADR-0019
**permanecem por decisão** — uma é narrativa histórica correta, a outra está dentro do `REVERTER
EXIGE:` de uma `DECISÃO FECHADA`. O parecer está na **§5 do `_run/run-report.md`** da fatia, e
**reafirma o NÃO** a `/agent-spec-debt-resolution`, agora com uma razão nova e medida: a coleta da
skill **descarta os campos `Gatilho:` e `Por que não agora:`**, que é justamente o que desautoriza
resolver o D1 e o D26.

**Intervenção dirigida de 2026-08-12**, sobre os **57 débitos da fatia `regua-de-cobranca`**, depois de
a fatia ser commitada — e precedida de auditoria **contra o código**, com parecer registrado na
**§4.0.3 do `_run/run-report.md`** daquela fatia. O parecer **reafirma o NÃO** a
`/agent-spec-debt-resolution`, agora com custo **medido pela telemetria do próprio run** (a T12 custou
73 min; o piso por débito é 10-15 min, logo 10-14 h para os 57) e com a razão mais forte de todas: o
default `gates: [qa]` desliga o Gate 2 **exatamente onde os débitos vizinhos de marcador moram** —
`packages/regua/src`, `packages/db/test`, `apps/worker/test` e `deploy/scripts` não casam com
Critical Paths. ⚠️ E **corrige uma razão do parecer anterior**: a alegação de que a coleta *"descarta os
campos `Gatilho:` e `Por que não agora:`"* **não vale para a §2 daquela fatia**, onde os avisos moram
dentro do campo *O que fazer* e viajam inteiros no `correcao_sugerida`; o que a skill não lê é o
**marcador no código**. **Sete débitos fechados** — D4, D5, D16, D19, D25, D31 e D40 —, cada um com
mutante medido e revertido, em ~3 h. Dois achados que só a auditoria contra o código daria: o **D19 já
estava pago** desde a T10 e continuava listado; e o **D4 mordeu durante a própria auditoria** — o
`verificar-golden.sh` gravou `__pycache__/*.pyc` na árvore versionada, o arquivo foi **commitado por
engano** em `3a596fc` e derrubou a âncora de segurança `CT-626 (d)`, que audita as classes de arquivo
da árvore por igualdade. Saiu do git, e a gravação foi fechada **na origem**
(`sys.dont_write_bytecode`), com o `.gitignore` como segunda barreira. Suíte **1002 → 1004**.

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
      aceitação de cada fatia verificados · **F1 fechada em 2026-08-05, F2 em 2026-08-09 e a F3 em
      2026-08-13** (fatia 1 `cobranca-e-mora`, 11/11 tasks; sub-fatia **2a `regua-de-cobranca`**,
      12/12; sub-fatia **2b `documentos-e-confirmacao`**, 12/12) — **faltam F4 e F5**
- [ ] **Superfície da API congelada** — nenhuma fatia posterior acrescenta, remove ou altera rota;
      o congelamento é o que torna o handoff confiável · **sem condição pendente** desde que a
      ADR-0021 fechou o D43 · ⚠️ mas **F4 e F5 ainda publicam rota** (webhook Sicoob,
      rotinas) — a F3 já levou de 75 a **89** —, então o congelamento é o *depois* delas
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
| 6 | `docs/adr/` | ADRs. **30 registradas, 24 `accepted`**: 0001, 0005, 0006, 0008, 0009, 0010, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, 0029 e 0030. **Vinculantes para a F2**: 0006, 0008, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0020 e 0021. **Vinculantes para a sub-fatia 2b da F3**: 0008, 0011, 0016, 0017, 0018, 0021, 0022, 0023, 0024, 0025 e 0026, mais as **quatro que nasceram dela** — a **0027** (uma rota de negócio dispensa sessão só quando o ato é do titular do dado, e sempre com portador de segredo), a **0028** (a rota que devolve bytes permanece no contrato, declarando mídia, nome do arquivo e o mesmo envelope de erro), a **0029** (efeito externo cujo resultado não compõe a resposta sai por fila, nunca em linha na borda) e a **0030** (artefato derivado de dado gravado é composto sob demanda e nunca armazenado — com **cláusula de exclusão**: fato recebido de terceiro, como o boleto do provedor, não é derivado e está fora do alcance dela). As **0002, 0003 e 0004** morreram com o Frappe — `deprecated` desde 2026-08-04, porque nomeiam primitivas dele (DocType, fixture, `Custom DocPerm`, Server Script). Há **duas cadeias de supersede**, e nas duas só a última se cita: a forma canônica do contrato da API é **0007 → 0012 → 0017**, vigente a **0017** (três classes de chave exposta: código legível quando há série declarada, UUID quando não há); e a transição de estado é **0019 → 0021**, vigente a **0021** (rota própria sempre; a chave de ação só quando o ato é sensível — atributo operacional do cadastro exige apenas a área). ⚠️ **Citar ADR exige abrir a `Decision`** — esta linha e o `INDEX.md` são paráfrases, e já divergiram do texto real |

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

Dezenove débitos têm gatilho que dispara fora da fatia que os criou: **D28** vem da F0;
**D23**, **D39**, **D24**, **D27** e **D37** nasceram na F1 — os três últimos na fatia
`autorizacao-e-ciclo-de-acesso` —; dois nasceram na F2, o **D3** na fatia
`cadastro-de-imoveis-e-pessoas` e o **D44** na fatia `contratos-de-locacao`;
e onze nasceram na F3 — o **D1**, o **D26** e o **D20** na fatia `cobranca-e-mora`, o **D3**,
o **D12**, o **D14**, o **D49**, o **D54** e o **D57** na fatia `regua-de-cobranca`, e o
**D5** e o **D12** na fatia `documentos-e-confirmacao`.
⚠️ **Os dois `D3` são débitos DIFERENTES** e a coincidência é legítima: a sequência corre dentro da
§2 da fatia que registrou cada um, de modo que o identificador é o par — `D3 · F2/T1` é a definição
dupla de `ESQUEMA_DO_IDENTIFICADOR`, e `D3 · F3/T1` é a terceira cópia do caminho de leitura
autenticada do legado. **O mesmo vale para os dois `D12`**, e pela mesma razão: `D12 · F3/T4` é a
escolha do molde do aviso pela ordem de `ESTADOS_DA_COBRANCA`, e `D12 · F3/T10` é a segunda
declaração estrutural da mensagem de e-mail.
O **D27** partilha com o D23 o gatilho e o fato que falta: qual é o salto confiável da borda. O
**D26** e o **D1** têm a mesma forma: os dois agendam a **promoção de um símbolo duplicado** para
quando o terceiro consumidor chegar. O **D44** foi emitido na intervenção dirigida de 2026-08-09, e
não num run — o débito existia desde a T10 e chegava ao futuro só por um parágrafo de docblock.
O **D20** é o mais novo, emitido na **intervenção dirigida de 2026-08-10** sobre um débito da T7 que
o run havia registrado só na §2: ele é o único do índice cujo gatilho **fecha em silêncio** — a
janela em que emendar a `0010` é legítimo termina na primeira aplicação dela a banco durável, e
nada acusaria isso sem o marcador.
**Nenhum tem por gatilho o congelamento da superfície da API** — o único que tinha era o D43, e ele
foi fechado em 2026-08-09 pela ADR-0021, que supersede a 0019 e recorta a governança da transição
pela natureza do ato.
⚠️ **O `D28` que resta é o da F0/T5**, e ele não é o mesmo que a fatia `contratos-de-locacao`
registrou: a sequência corre dentro da §2 da fatia que registrou cada um (§3-B da
`nao-regressao.md`), de modo que dois `Dnn` homônimos são débitos diferentes.
**Ele já disparou e segue aberto** — na F1/T2.
Doze saíram daqui por terem sido fechados — **este índice lista só débito vivo**: o D13 da F3/T5, na
T8 da fatia `documentos-e-confirmacao`, quando o `CT-730` passou a usar `semearPoliticaDeAviso` como
**precondição sem ser objeto** — que era o gatilho escrito — e a chamá-la duas vezes entre as duas
medições, de modo que o `ON CONFLICT (empresa_id)` que nunca tinha executado passou a executar, com a
cláusula alinhada à da produção; o D36 da F2/T8, na
T7 da fatia `documentos-e-confirmacao`, **por construção** — sem documento armazenado (ADR-0030) não
existe arquivo preexistente de que o cancelamento possa depender, de modo que a pré-condição legada
*"sem PDF, não cancela"* não tem sobre o que incidir; é a divergência `DV-05`, veredito
`PRODUTO_VENCE`, e o `CT-710` afirma o `200`; o D34 da F3/T8, na
T10 daquela mesma fatia, quando `exigirDeclarada` desceu para `packages/regua/src/exigencia-de-variavel.ts`
— módulo cujo nome não é `adaptador-smtp` — e passou a ser exercitada pelo `CT-640`, fechando o `AP-28`
que a mantinha inalcançável; o D32 da F0/T6, na
T7 da fatia `regua-de-cobranca`, quando nome, opções de repetição e tipos de carga desceram para
`packages/shared/src/fila.ts` e o `worker` passou a importá-los em vez de defini-los; o D28 da F2/T7, na
T9 da fatia `cobranca-e-mora`, quando a ativação do contrato passou a derivar as parcelas e a
gravá-las na mesma unidade de trabalho, e `esquemaDaAtivacaoDeContrato.efeitos.cobrancasGeradas`
deixou de ser o literal `false` para publicar quantas nasceram; o D7 da F3/T4, na
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
| **D23** (F1/T8) | `apps/api/src/autenticacao/autenticacao.module.ts` | a **publicação atrás do servidor de borda na F7** — origem confiável derivada do endereço de retorno |
| **D39** (F1/fechamento) | `deploy/scripts/instalacao/provisionar-base.sh` | a **próxima instalação do zero** — o provisionamento não gera `BETTER_AUTH_SECRET` e a API não sobe |
| **D24** (F1/T5, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/main.ts` | a **publicação atrás do servidor de borda na F7** — `/docs*` atende sem sessão por decisão registrada, que vale só enquanto a API é local |
| **D27** (F1/T6, fatia `autorizacao-e-ciclo-de-acesso`) | `packages/auth/src/autenticacao.ts` | a **publicação atrás do servidor de borda na F7** — sem ela o limitador não tem eixo de origem |
| **D37** (F1/T8, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/master/empresa.controller.ts` | a **primeira comparação do `:id` do Master com identidade da sessão** — o esquema de lá não canoniza a caixa do UUID |
| **D3** (F2/T1, fatia `cadastro-de-imoveis-e-pessoas`) | `packages/contracts/src/comum.ts` | a **primeira task que abrir `usuario.controller.ts` por outra razão** — `ESQUEMA_DO_IDENTIFICADOR` tem duas definições |
| **D44** (F2/T10, fatia `contratos-de-locacao`) | `apps/api/src/imoveis/imovel.service.ts` (`definirSituacaoDeLocacao`) | a fatia que criar no banco a **restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao`** — hoje nada fecha a janela da guarda |
| **D1** (F3/T2, fatia `cobranca-e-mora`) | `packages/contracts/src/cobranca.ts` (ponto do import) | o **terceiro consumidor monetário do pacote** — `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` sobem para `comum.ts` |
| **D26** (F3/T8, fatia `cobranca-e-mora`) | `packages/db/src/derivacao-de-cobranca.ts` (`ultimoDiaDoMes`) | o **terceiro consumidor de aritmética de calendário do pacote** — `ultimoDiaDoMes` e `ehBissexto` sobem para módulo próprio |
| **D20** (F3/T7, fatia `cobranca-e-mora`) | `packages/db/migracoes/0010_seguranca_cobranca.sql` (bloco da emenda) | a **primeira aplicação da `0010` a banco durável** — a partir dela o arquivo é imutável e o `sha256sum` do `migrar-banco.sh` aborta a instalação |
| **D3** (F3/T1, fatia `regua-de-cobranca`) | `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh` (`consultar_o_legado`) | o **quarto consumidor** do caminho de leitura autenticada do legado, ou a **primeira alteração das garantias de transporte da credencial** — hoje são três cópias e endurecer uma deixa as outras para trás |
| **D12** (F3/T4, fatia `regua-de-cobranca`) | `packages/regua/src/mensagem.ts` (a desestruturação de `ESTADOS_DA_COBRANCA`) | a **primeira task que abrir `packages/contracts/src/cobranca.ts`** por outra razão — ali nasce `ESTADOS_AVISAVEIS` como tupla `as const` e a escolha do molde deixa de depender de posição |
| **D14** (F3/T5, fatia `regua-de-cobranca`) | `packages/db/src/envio-de-cobranca.ts` (`FUSO_DA_OPERACAO`) | a **primeira migração que redefinir `negocio.data_corrente_da_operacao()`** — o fuso tem duas declarações executáveis e nada as amarra |
| **D49** (F3/T10, fatia `regua-de-cobranca`) | `apps/worker/test/ambiente.spec.ts` (docblock do `CT-643`) | a **escalada que autorize mover o bloco sob `DECISÃO FECHADA — T8 / Gate 1 rodada 2`**, ou o **terceiro processo** que precisar da maquinaria — hoje o detector de exigência de ambiente tem duas cópias e endurecer uma deixa a outra para trás |
| **D54** (F3/T11, fatia `regua-de-cobranca`) | `apps/api/test/equivalencia-com-o-oraculo.spec.ts` (`CODIGO_NO_ASSUNTO`) | o **quarto consumidor** do molde de extração do código de cobrança, ou a **primeira alteração da forma do código** — hoje são três cópias e elas já divergem na flag `u` |
| **D57** (F3/T12, fatia `regua-de-cobranca`) | `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` (a montagem instrumentada) | **JÁ DISPAROU** — a terceira suíte instrumentada já existe (`equivalencia-com-o-oraculo.spec.ts`); segue valendo o segundo gatilho, `criarAplicacao()` registrar um global fora do `AppModule` |
| **D5** (F3/T7, fatia `documentos-e-confirmacao`) | `apps/api/test/documento-do-contrato.e2e.spec.ts` (`extrairTextoDePdf`) | o **terceiro consumidor** de extração de texto de PDF (o carnê da F4), ou a **primeira alteração das opções do extrator** — hoje são duas cópias e endurecer uma deixa a outra para trás |
| **D12** (F3/T10, fatia `documentos-e-confirmacao`) | `packages/documentos/src/mensagem-de-confirmacao.ts` | a **terceira** mensagem de e-mail do produto (o boleto, na F4) — ali `MensagemDeEmail` e a porta de envio sobem para `@sysloc/shared` |

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
