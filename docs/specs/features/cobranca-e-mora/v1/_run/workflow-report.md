# Workflow report — cobranca-e-mora/v1

> Telemetria de pipeline (append-only). O relatório humano é o `run-report.md`.

## Challenge Session — 2026-08-09 (artifact: tech_spec.md)

- Questões processadas: 6
- Conflitos de terminologia resolvidos: 1 (campo `objeto` → `tabela` em `ExcecaoDeIsolamento`, CT-523)
- Contradições com o código real corrigidas: 2
  - `catalogo.ts` já cobre a espécie VIEW com `VISAO_NAO_DELEGA_ISOLAMENTO`, `ehVisao`,
    `delegaIsolamento`, `PROPRIEDADES_DA_VISAO`, `propriedadesDe()` e a extração normalizada de
    `security_invoker` — a spec mandava "estender", e a região está sob `DECISÃO FECHADA`
    (T4/Gate 2 · 2026-08-02). Corrigido em 3 pontos (§19 Recomendações, §20 mitigação, §21 ADR-0009).
  - `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` vivem em `contracts/src/contrato.ts` (L163, L193),
    e não em `comum.ts`, que era a única origem que a §3.7 declarava.
- Decisões implícitas explicitadas: 4
  - Fluxo **F** (`POST /v1/cobrancas`): as duas unidades sequenciais do contador estavam escritas
    só para a ativação; a 1ª cobrança do ano pode nascer pela rota avulsa, e
    `proximo_numero_de_cobranca` consome a sequência, nunca a cria.
  - **RD-21**: `GET /v1/multa-e-juros` de empresa sem linha responde 200 com zeros, nunca 404, e não
    cria linha. A rota declarava 200/401/403 sem dizer o que fazia no caso que a §5.2 admite.
  - Fronteira estrita de RD-04 (`<`): registrada como decisão desta fatia, não como porte — o golden
    `marcar-cobrancas-vencidas.json` não tem deslocamento `0`.
  - Origem das constantes monetárias fixada por escrito, com débito com gatilho no 3º consumidor.
- Vãos de cobertura fechados: 1 (as 2 rotas de `/v1/multa-e-juros` não tinham caso de comportamento:
  nem PUT 200, nem faixa/escala, nem `strictObject`, nem upsert, nem GET zerado) → **CT-538** e
  **CT-539**; 37 → 39 casos. Reconciliada a §3.4: 2 arquivos de teste sem CT algum removidos da
  árvore, e cada arquivo restante passou a nomear os CTs que hospeda.
- Termos canonizados no glossário: 8, todos no GLOBAL — Cobrança, Cobrança em aberto, Mora,
  Configuração de mora, Carimbo, Natureza da cobrança, Competência, Referência. Mais 7
  Relacionamentos e 4 Ambiguidades resolvidas. `Cobrança` fechou vão anterior à fatia: já era usada
  em Relacionamentos sem definição na seção Termos.
- Candidatos a ADR sinalizados: 0 novos (os 2 parciais da §21 seguem válidos e inalterados)
- ADRs sugeridos para criação: 0
- Débitos registrados para a §2 do run-report: 1 (constantes monetárias em `contrato.ts`; gatilho no
  3º consumidor monetário do pacote de contratos)

---

## Execução — run de 2026-08-09 (`/agent-spec-sdd-run-tasks`)

- `[run] executor resolvido: sysloc-backend-implementer (origem: argumento explícito)`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] modelo: opus em executor E nos dois gates — decisão do projeto no CLAUDE.md, vence a heurística sonnet do framework`
- `[run] AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO (2026-08-09): (a) nenhuma pausa por AskUserQuestion durante todo o run — toda decisão assume a opção recomendada; (b) o limite de 3 tentativas por task está SUSPENSO — a correção segue até não haver bloqueante.`
- `[run] T1 diferida para o fim do run: exige sudo com senha interativa e site efêmero do /opt/frappe de pé (task §7 e task_plan §6). Nenhum subagente a executa. Nada na fatia depende dela — T2..T11 seguem sem bloqueio.`
- `[run] ordem topológica sequencial: T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 (T1 ao fim, operador). Lote paralelo: NENHUM — as 11 tasks têm 'Pode Rodar em Paralelo? = Não' e a re-verificação dos guards confirma (§4.2 do task_plan).`
- `[run] reconciliação de dependências: task_plan × TN.md §1 concordam nas 11 tasks — nenhuma divergência, união desnecessária.`

### Baseline do run (P1 do Protocolo Antirregressão) — antes da primeira edição

- Total: **687 casos**, conferido contra a baseline declarada no task_plan §7. Contagem por unidade:
  `@sysloc/contracts` 130 · `@sysloc/shared` 212 · `@sysloc/api` 155 · `@sysloc/auth` 89 · `@sysloc/db` 85 · `@sysloc/worker` 16.
- ⚠️ **CT-907 é FLAKY sob contenção, e é PRÉ-EXISTENTE.** `packages/shared/test/protocolo-antirregressao.spec.ts`
  > `CT-907 — o índice de débito fecha nas duas pontas` expira em 5000ms quando roda dentro do
  `turbo run test` com a suíte do `@sysloc/api` em paralelo. Caracterizado: **3/3 verde** isolado
  (`pnpm --filter @sysloc/shared test`), e 1 verde / 2 vermelho em três `pnpm test` completos.
  Causa: a varredura do repositório inteiro por `readdirSync` recursivo não cabe no teto de 5s do
  caso sob disputa de CPU/IO com as instâncias efêmeras de banco. O docblock do arquivo registra que
  a memoização já foi o conserto de uma rodada anterior do mesmo sintoma — ela reduziu de 4
  varreduras para 1, e 1 ainda não cabe.
- **Decisão: registrar e NÃO corrigir nesta fatia** (P1: *"se a baseline já estiver vermelha, isso é
  informação... não os inclua no seu conserto a menos que sejam a sua causa-raiz"*). Razões: (a) o
  arquivo é a barreira executável do próprio protocolo, fora do escopo desta fatia, que não toca
  `packages/shared`; (b) o docblock **pré-rejeita** por escrito o conserto óbvio (*"alargar o teto
  seria conserto do sintoma"*); (c) tocá-lo seria a Proibição 5 (*"nunca aproveitar que estou aqui"*).
  Vai para a §2 do run-report como débito desta fatia.
- **Consequência operacional, propagada a TODO executor e a TODO gate deste run**: expiração do
  CT-907 em `pnpm test` **não é regressão da task** — reconfirmar por `pnpm --filter @sysloc/shared test`
  antes de atribuir a falha ao diff.
- `[T2] base_sha=fb9391532190d4fa90a452849e213ede32404605`
- `[T2] QA: APROVADO_COM_OBSERVACOES — 14/14 critérios, 6/6 CTs, 0 bloqueantes, 1 baixo (documentation). Suíte 687 → 776; contracts 130 → 219; nenhuma unidade caiu.`
- `[T2] antipadroes_verificados: 1/1 arquivo de teste declarado (esquemas.spec.ts) — completo.`
- `[T2] ledger: não criado — rodada 1 aprovada sem rejeição (nada a rastrear).`
- `[T2] CT-907 expirou no pnpm test completo e passou isolado: flaky pré-existente confirmado pelo gate, não é achado.`
- `[T2] ADRs injetadas no executor: ADR-0015, ADR-0016, ADR-0017, ADR-0021, ADR-0022 (fonte: task §7)`
- `[T2] TR consultou: ADR-0015, ADR-0016, ADR-0017, ADR-0021, ADR-0022, ADR-0023`
- `[T2] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 1 BAIXO (scope_deviation). Confirmou por diff que nenhum código sob marcador preexistente foi tocado e que "Garantias removidas: nenhuma" confere.`
- `[T2] observações do TR: describe/it 56 → 92, os dez describe preexistentes intactos; contrato.ts e folha.spec.ts ausentes do diff (proibições da §3.1 respeitadas); pacote permanece folha; 17 símbolos publicados um a um, sem export *.`
- `[T2] staged: packages/contracts/src/cobranca.ts, packages/contracts/src/index.ts, packages/contracts/test/esquemas.spec.ts, CLAUDE.md, _run/run-report.md, _run/rule-candidates.md, tasks/T2.md`
- `[T2] rule_candidates: 3 sinais persistidos (qa=2 repeated_fixture/repeated_assertion_shape, staff=1 scope_deviation)`
- `[T2] débitos anotados: D1 (executor, project_pattern), D2 (QA, documentation), D3 (TR, scope_deviation), D4 (orquestrador, tests — flake pré-existente do CT-907)`
- `[T3] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu — o stage da T2 não commita; o isolamento do diff da T3 vem do filtro por paths, e não há sobreposição com os paths da T2)
- `[T3] attempt_sha (rodada 1)=086d3d68aa5857516b341cf54c71a45986492d9e`

### T3 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 1 (ALTO), performance: 1 (MEDIO), project_pattern: 1 (BAIXO) }
- overrides_ativos: [tocou_area_critica: true, task_risk: high, qa_security_flags: [], diff_stat_changed: false]
- requires_qa_revalidation: **true**
- decisao: re-QA obrigatório (Gate 1 → Gate 2)
- justificativa: "P1 em `architecture` e P2 em `performance`, ambas em revalidation_required; mais dois overrides ativos que forçariam `true` sozinhos (task_risk=high, tocou_area_critica=true)"
- `[T3] QA (rodada 2): APROVADO_COM_OBSERVACOES — 14/14, contagem por unidade IDÊNTICA à rodada 1 (779), nenhum arquivo de teste no delta. 1 baixo novo (documentation).`
- `[T3] QA reproduziu a medição de EXPLAIN de forma independente e confirmou a conclusão estrutural do P2 — inclusive o passo com enable_seqscan=off, que separa inalcançabilidade de preterição por custo.`
- `[T3] TR consultou: ADR-0023 (rodada 2, escopo DELTA); rodada 1: ADR-0008, 0009, 0015, 0016, 0020, 0022, 0023`
- `[T3] Tech Review (rodada 2): APROVADO_COM_OBSERVACOES — TR-P1, TR-P2 e TR-P3 sanados; 1 BAIXO novo (P4, project_pattern).`
- `[T3] observações do TR: marcador verificado por diferença contra o attempt_sha — só cabeçalho e POR QUÊ mudaram, O QUÊ e REVERTER EXIGE como contexto puro; ausência de garantia removida PROVADA por filtragem de comentários do delta (resultado vazio); nenhum arquivo de teste no delta.`
- `[T3] ledger: 5 achados totais | 1 originado em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T3] P4 do TR pede uma linha na tasks/T4.md. NÃO editei o artefato de spec (a skill proíbe alterar spec sem pedido do usuário) — em vez disso, a instrução literal do filtro `AND pago_em IS NULL AND cancelado_em IS NULL` vai INJETADA no prompt do executor da T4, que é o destinatário real e alcança o mesmo fim sem tocar a spec.`
- `[T4] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu; isolamento por filtro de paths — sem sobreposição com T2/T3, exceto `packages/db/src/index.ts`, que a T4 declara em §5.2 e a T3 não tocou)
- `[T4] ADRs injetadas no executor: ADR-0006, ADR-0008, ADR-0015, ADR-0017, ADR-0020, ADR-0022, ADR-0023 (fonte: task §7)`
- `[T4] QA: APROVADO_COM_OBSERVACOES — 15/15 critérios, 7/7 CTs, 0 bloqueantes, 1 baixo (documentation). Suíte 779 → 790; db 88 → 99; nenhuma unidade caiu.`
- `[T4] antipadroes_verificados: 2/2 arquivos de teste declarados — completo (28 APs por arquivo).`
- `[T4] AMBIENTE: disco do host em 92-93%. A suíte cria instâncias efêmeras em /tmp/sysloc-banco-*; 111 resíduos (~1,7 GB) faziam o pnpm test falhar com "No space left on device", falha que se disfarça de teste vermelho. Orquestrador passou a limpar entre tasks.`
- `[T4] duas divergências do executor contra a letra da task, ambas CONFIRMADAS pelo QA: (a) o golden tem 10 invocações e 30 asserções, não 9/27 — a task é que estava desatualizada, e o teste afirma 10 nos dois eixos; (b) o contrafactual do 7,02 do CT-526 não se reproduz (2ª vez que este mesmo número é refutado neste run — ver D5), e o mutante substituto (arredondar a taxa diária → 6.97) DISCRIMINA, com asserção que fica vermelha.`
- `[T4] attempt_sha (rodada 1)=637f7b7be8a36ecae221c164f26ffe89fec47f10`

### T4 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 1 (ALTO), testability: 1 (MEDIO), project_pattern: 1 (BAIXO), code_quality: 2 (BAIXO) }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: true]
- requires_qa_revalidation: **true**
- decisao: re-QA obrigatório (Gate 1 → Gate 2)
- justificativa: "P1 em `architecture` e P2 em `testability`, ambas em revalidation_required"
- `[T4] QA (rodada 2): APROVADO_COM_OBSERVACOES — suíte 790 → 791; db 99 → 100; nenhuma unidade caiu. 1 baixo novo (documentation).`
- `[T4] QA reproduziu o mutante MT-6 no arquivo real (1 failed | 99 passed, único vermelho no CT-524 (b)) com reversão conferida por sha256sum, e varreu o P1 pessoalmente: lista de arquivos com literal de estado em posição executável = exatamente ['packages/contracts/src/cobranca.ts'].`
- `[T4] TR consultou: ADR-0016, ADR-0022, ADR-0023 (rodada 2, DELTA); rodada 1: ADR-0008, 0015, 0017, 0020, 0022, 0023`
- `[T4] Tech Review (rodada 2): APROVADO_COM_OBSERVACOES — TR-P1 a TR-P5 sanados; 1 BAIXO novo (P6, project_pattern).`
- `[T4] observações do TR: intocabilidade dos marcadores da T2 provada ESTRUTURALMENTE — git diff de packages/contracts/src/cobranca.ts sem uma única linha "-", acréscimo puro de 33 linhas. AP-24 conferido linha a linha: das 12 remoções em cobranca.spec.ts, todas são comentário.`
- `[T4] ledger: 7 achados totais | 2 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T5] base_sha=fb9391532190d4fa90a452849e213ede32404605`
- `[T5] attempt_sha (rodada 1)=cb90cdf6388226bdf1339a7a7365024ffbfb9be8`

### T5 — retry classification
- attempt: 2
- problemas_por_categoria: { testability: 1 (MEDIO), project_pattern: 2 (1 MEDIO anotável + 1 BAIXO), scope_deviation: 1 (BAIXO) }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: true]
- requires_qa_revalidation: **true** (P1 em `testability`)
- decisao: re-QA obrigatório (Gate 1 → Gate 2)
- `[T5] attempt_sha (rodada 2)=2c2c6e7f8596e5887fd425b6f8aa0528bdbece90`
- `[T5] P4 do TR corrigido PELO ORQUESTRADOR: os blocos \`### D7\` e \`### D9\` voltaram à §2 do run-report como uma linha cada, declarando o fecho e que o número está QUEIMADO. Sem isso, o executor da T6 tiraria D7 (primeiro vão) ou D9 (máximo+1) e colidiria com débito já registrado desta mesma fatia. O próximo número livre é D10.`
- `[T5] TR consultou: rodada 1 — ADR-0008, 0011, 0014, 0015, 0016, 0017, 0018, 0020, 0021, 0022, 0023; rodada 2 — ADR-0008, 0015, 0017`
- `[T5] Tech Review (rodada 2): APROVADO_COM_OBSERVACOES — P1, P2 e P4 sanados; P3 permanece anotado; 1 BAIXO novo (P5, testability).`
- `[T5] ledger: 6 achados totais | 4 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1 (as rodadas 2 e 3 foram do Gate 2, que só viu a task na rodada 2)`
- `[T5] ⚠️ PARA T6 E T7: o D11 avisa que `cobrancas.e2e.spec.ts` tem folga de 7 casos antes de o teto de `ateSerExclusivo` estourar. Caso novo que crie contrato ou cobrança na EMPRESA_A entra DEPOIS do CT-515 (c).`
- `[T6] base_sha=fb9391532190d4fa90a452849e213ede32404605`

---

## ⏸️ PAUSA DO RUN — 2026-08-10, a pedido do usuário

**Ponto exato de parada**: o **executor da T6 concluiu**; os **dois gates da T6 ainda NÃO rodaram**.

### Estado
- **T2, T3, T4, T5 — CONCLUÍDAS**, aprovadas nos dois gates e **staged** (`git add`, sem commit).
- **T6 — `Em Progresso`**: código escrito e no working tree (`git add -N` feito, nada perdido), **sem QA e sem Tech Review**.
- **T7, T8, T9, T10, T11 — `A Fazer`**.
- **T1 — `A Fazer`, DIFERIDA POR DECISÃO**: exige `sudo` com senha interativa e o site efêmero do
  `/opt/frappe` de pé. Nenhum subagente a executa. **Nada na fatia depende dela** — verificado nas três
  pontas (grafo, símbolos, arquivos). Fica para o fim, como execução conduzida pelo operador.

### Como retomar
Reinvoque a mesma skill com os mesmos argumentos:

```
/agent-spec-sdd-run-tasks docs/specs/features/cobranca-e-mora/v1/task_plan.md sysloc-backend-implementer
```

O Passo 4.0.1 (*Resume pós-interrupção*) vai detectar a T6 em `Em Progresso` e oferecer três
caminhos. **O correto é (a) "Retomar nos gates"** — o código da T6 está íntegro e reexecutar do zero
descartaria trabalho aprovado pelo executor. O `base_sha` da T6 é
`fb9391532190d4fa90a452849e213ede32404605`, registrado acima.

### Sumário do executor da T6, que os gates precisam receber inline
```
✅ T6 — Configuração de mora por empresa
Arquivos: 6 criados, 9 modificados
Testes: 2/2 implementados (CT-538, CT-539); a varredura ESQUEMAS_DE_ENTRADA gerou +2 casos sozinha
Garantias removidas: nenhuma
- Âncoras por varredura, sem derivar uma da outra: ROTAS 78 → 80 (duas medições concordantes:
  `cobertura.rotasEnumeradas` = 80, e a composição (65−1)+7+9 = 80) e MANIPULADORES 63 → 65
  (1+1+1+6+6+6+3+8+3+6+7+6+2+2+7). ROTAS_PUBLICADAS_NO_MUTANTE 72 → 74. A prosa de INVARIANTES e o
  título do CT-427 foram para 80/65 na mesma passagem; as de 75/60 são registro histórico e não
  foram tocadas.
- Quatro arquivos fora da §5.2, todos por âncora que reprovaria: packages/contracts/test/esquemas.spec.ts
  (QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA 13 → 14 — `esquemaDaConfiguracaoDeMoraNova` começa com `esquemaDa`
  e escaparia às duas varreduras), packages/db/test/unidade-de-trabalho.spec.ts (CT-012 por igualdade),
  apps/api/test/contexto.e2e.spec.ts (+1 caminho protegido — GET e PUT compartilham caminho) e
  apps/api/test/validacao.spec.ts (+1 importador). São o D10 desta fatia e o D26 (F2/T6).
- pnpm lint verde (biome 212 arquivos; shellcheck limpo); pnpm build verde.
- Baseline 801 → 805: contracts 220 → 222, api 160 → 162; shared 212, auth 89, db 104, worker 16.
  Nenhuma unidade caiu.
- @sysloc/db NÃO cresceu, por decisão da §6.2 da task (integração é N/A — um caso sobre o mesmo
  upsert seria duplicação cross-layer, AP-23).
- Dois mutantes medidos e revertidos: M1 (leitura que cria a linha zerada) → `1 failed | 161 passed`
  no CT-538 com `expected 1 to be +0`, e TODAS as asserções de corpo do passo 1 verdes — prova que a
  contagem `0` é quem carrega; M2 (`ON CONFLICT … DO NOTHING`) → `2 failed | 160 passed`,
  `expected 500 to be 200`. Reversão conferida por `diff -q`.
- Nenhum débito novo; catalogo-de-permissoes.ts não tocado; nenhum DECISÃO FECHADA alterado.
```

### O que a próxima sessão precisa saber, e não está em nenhum artefato de spec
1. **`CT-907` (`packages/shared/test/protocolo-antirregressao.spec.ts`) é FLAKY e PRÉ-EXISTENTE** —
   expira no teto de 5000ms dentro do `pnpm test` completo, sob disputa de CPU/IO, e passa **3/3**
   isolado. Caracterizado ANTES da primeira edição do run. **Não é regressão de task nenhuma.**
   Discriminador: falha por **timeout** é o flake; falha por **asserção** (marcador órfão) é achado.
   Está anotado como **D4** na §2 do run-report.
2. **O disco do host está em ~93%.** A suíte cria instâncias efêmeras em `/tmp/sysloc-banco-*`, e
   resíduos já fizeram o `pnpm test` falhar com `No space left on device` — falha que **se disfarça de
   teste vermelho**. Rode `rm -rf /tmp/sysloc-banco-*` entre execuções.
3. **Próximo débito livre da fatia: `D12`.** D1..D11 estão ocupados; **D7 e D9 estão FECHADOS mas com
   o número QUEIMADO** (§2 do run-report) — não os reuse.
4. **Avisos vivos para T7 em diante**: o **D11** limita a folga de `apps/api/test/cobrancas.e2e.spec.ts`
   (caso novo que crie contrato ou cobrança na EMPRESA_A entra **depois** do `CT-515 (c)`); o **D10**
   registra que a §5.2 desta fatia subdeclara sistematicamente os arquivos de âncora
   (`contexto.e2e.spec.ts`, `validacao.spec.ts`, `cobertura-de-autorizacao.e2e.spec.ts`).
5. **As âncoras de superfície sobem em três tasks**: T5 levou 75 → 78, **T6 leva 78 → 80** e T7 leva
   80 → 82 (manipuladores 60 → 63 → 65 → 67). A conferência final por dupla medição é o **CT-533**, na T11.
6. **Autorização do usuário, válida para todo o run**: sem pausas por `AskUserQuestion` (toda decisão
   assume o recomendado) e **sem teto de 3 tentativas**.

---

## Retomada do run — 2026-08-10 (`/agent-spec-sdd-run-tasks`, mesma invocação)

- `[run] resume pós-interrupção: T6 detectada em 'Em Progresso' com código íntegro no working tree e tmp/ vazio. Escolha: (a) RETOMAR NOS GATES. Origem da escolha: autorização explícita do usuário registrada no run ("nenhuma pausa por AskUserQuestion — toda decisão assume a opção recomendada"), e a seção de pausa nomeia (a) como o caminho correto. Nenhuma AskUserQuestion disparada.`
- `[run] cleanup idempotente: _run/tmp/ vazio (nenhuma memória lazy > 24h a remover). _run/tmp/ confirmado no .gitignore (linha 45, padrão docs/specs/**/_run/tmp/).`
- `[run] AMBIENTE: rm -rf /tmp/sysloc-banco-* executado antes de retomar. Disco em 93% (2,2 GB livres).`
- `[run] modelo dos gates da T6: opus nos dois (decisão do projeto no CLAUDE.md; e diff_touches_critical_path=true por api_contracts + auth/security nas rotas novas).`
- `[T6] base_sha=fb9391532190d4fa90a452849e213ede32404605` (reconfirmado da pré-execução; HEAD não se moveu)
- `[T6] git add -N reconfirmado nos 6 paths novos da §5.1 — os seis aparecem como intent-to-add e entram no git diff.`
- `[T6] marcador sintético do ESTADO AO FIM DA T5 criado para os gates: t5_sha=922bf0867c534c76a15070ca8251cbcd3069d1c7`. Por que ele existe: `base_sha` é o HEAD, e as T2–T5 estão **staged sem commit** — então `git diff <base_sha> -- <path>` devolve T2..T6 somadas em 8 arquivos compartilhados (`app.module.ts`, `index.ts` dos dois pacotes, `cobertura-de-autorizacao`, `contexto`, `validacao`, `esquemas.spec.ts`, `unidade-de-trabalho.spec.ts`). O `t5_sha` é a árvore do **índice** (= estado aprovado ao fim da T5), obtida por cópia do índice em `GIT_INDEX_FILE` + `update-index --force-remove` das entradas intent-to-add + `write-tree` + `commit-tree -p HEAD`. Working tree e índice do usuário **inalterados** (conferido por `git status --porcelain`). Delta da T6 medido: 22 arquivos, +1810/−61.
- `[T6] arquivos tocados NÃO declarados pela task (3, todos de âncora, todos declarados pelo executor no sumário): packages/db/test/unidade-de-trabalho.spec.ts, apps/api/test/contexto.e2e.spec.ts, apps/api/test/validacao.spec.ts. Vão ao TR para avaliação como candidatos a scope_deviation. (packages/contracts/test/esquemas.spec.ts NÃO entra nesta lista — está declarado na §6 "Testes Existentes a Modificar".)`
- `[T6] 7 arquivos do delta são ESCRITURAÇÃO DO ORQUESTRADOR da sessão anterior, não trabalho do executor, e por isso ficam fora da lista dos gates: CLAUDE.md (nota de pausa), docs/plano-backend-novo/roadmap.md + deploy/scripts/roadmap/atualizar-roadmap.sh (painel e mapa FATIAS_DA_FASE da F3), _run/sdd_state.yaml, _run/workflow-report.md, task_plan.md e tasks/T2.md (status). Conferido por leitura de cada diff.`
- `[T6] QA: APROVADO_COM_OBSERVACOES — 13/13 critérios, 2/2 CTs (CT-538, CT-539), 0 bloqueantes, 2 baixos (categoria tests, smells test_order_dependency e happy_path_only). Suíte 801 → 805; contracts 220 → 222, api 160 → 162; shared 212, auth 89, db 104, worker 16 — nenhuma unidade caiu.`
- `[T6] antipadroes_verificados: 6/6 arquivos de teste declarados — completo.`
- `[T6] ledger: não criado — rodada 1 aprovada sem rejeição (nada a rastrear).`
- `[T6] AP-24 AUSENTE, e era a verificação de maior risco da rodada: os cinco arquivos de teste pré-existentes crescem por ACRÉSCIMO, com bloco SUT_IS_CORRECT_BECAUSE: próprio da T6, e nenhuma igualdade virou presença. As âncoras históricas 75/60 da F2 NÃO foram tocadas.`
- `[T6] o QA mediu a contagem POR PACOTE (pnpm --filter) porque o pnpm test agregado aborta os irmãos quando um falha — com a expiração do CT-907 o turbo interrompeu @sysloc/db e @sysloc/api no meio, e a saída agregada não carregava contagem confiável dessas duas. Registro operacional útil às tasks seguintes.`
- `[T6] CT-907 expirou no pnpm test completo e passou isolado (212/212): flaky pré-existente reconfirmado pelo gate por TIMEOUT, não por asserção. e_regressao: false. Não é achado da T6.`
- `[T6] rule_candidates: 1 sinal persistido (qa=1 repeated_fixture — acessórios pedir/entrar/conceder das suítes E2E). Deduplicação conferida contra os 7 tópicos já existentes: tema distinto dos dois repeated_fixture anteriores.`
- `[T6] débitos a anotar na §2 (acumulados, escritos ao fechar a task): D12 (QA, tests, test_order_dependency) e D13 (QA, tests, happy_path_only). D12 é o próximo número livre — D7 e D9 estão FECHADOS com o número QUEIMADO.`
- `[T6] ADRs injetadas no executor: ADR-0011, ADR-0018, ADR-0008, ADR-0016, ADR-0017, ADR-0022 (fonte: task §7)`
- `[T6] TR consultou: ADR-0008, ADR-0011, ADR-0016, ADR-0017, ADR-0018, ADR-0022, ADR-0023 — a Decision de cada uma aberta, não a linha-resumo.`
- `[T6] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes; 2 MEDIO project_pattern (P1 Object.freeze ausente, P2 strictObject em esquema de saída) e 1 BAIXO project_pattern (P3 tipo de escrita reusa o de leitura). Os três são MÉDIO/BAIXO anotável pela partição → débito, sem rodada de correção. Nenhuma reclassificação de veredito necessária: o gate já devolveu APROVADO_COM_OBSERVACOES, coerente com a partição.`
- `[T6] o t5_sha funcionou: o TR gerou 12 diffs sobre o delta da T6 em vez de rerrevisar T2..T5 nos 8 arquivos compartilhados. Vale reusar o mecanismo nas tasks seguintes enquanto o usuário não commitar.`
- `[T6] DECISÃO FECHADA: nenhum alterado, movido, removido ou esvaziado — provado por varredura das linhas '-' de todo o delta (nenhuma pertence a marcador). As 3 ocorrências no delta são referências textuais em docblocks NOVOS que citam marcadores existentes sem tocá-los.`
- `[T6] Garantia removida: a declaração 'nenhuma' do executor CONFERE. As 61 linhas removidas são substituição de literal de âncora (78→80, 63→65, 72→74, 13→14), a composição de PARES_DA_FATIA_DE_COBRANCA, o título do CT-427 e prosa de docblock. O delta não remove UMA linha de apps/api/src ou packages/*/src pré-existente.`
- `[T6] os TRÊS arquivos fora da §5.2 eram MECANICAMENTE OBRIGATÓRIOS — o TR verificou a asserção de cada um e nas três é toEqual sobre inventário escrito à mão (igualdade de conjunto, não contenção): SIMBOLOS_ESPERADOS (CT-012), ROTAS_PROTEGIDAS_ACEITAS e IMPORTADORES_ESPERADOS. Sem a entrada nova as três REPROVARIAM. Nenhum scope_deviation aberto.`
- `[T6] D1 desta fatia NÃO disparado, e o TR concorda com o julgamento do executor: ESCALA_DO_PERCENTUAL é declarada localmente porque percentual vive em numeric(5,2) e dinheiro em numeric(15,2) — a coincidência de 0.01 é acidente das colunas. A task não é terceiro consumidor MONETÁRIO do pacote.`
- `[T6] DÉBITO COM GATILHO novo em apps/api/test/mora.e2e.spec.ts:154 é instância REPETIDA do D28 (F0/T5), não débito novo — quatro campos mais o ÍNDICE, e o débito já consta no índice do CLAUDE.md. Escrituração correta.`
- `[T6] rule_candidates: 3 sinais persistidos (staff=3 convention_drift: Object.freeze em constante de porta, assimetria strictObject entrada × z.object saída, tipo de escrita separado do de leitura). Total do run até aqui: 11.`
- `[T6] débitos anotados: D12 (QA, tests), D13 (QA, tests), D14 (TR, MEDIO project_pattern), D15 (TR, MEDIO project_pattern), D16 (TR, BAIXO project_pattern). Próximo livre: D17.`

### T7 — pré-execução
- `[T7] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu — T2..T6 estão staged sem commit; o isolamento do diff vem do filtro por paths e, no Gate 2, do marcador sintético do índice)
- `[T7] executor: opus (declarado no frontmatter) · gates: [qa, tech_review] (declarado) · risk: medium · diff_touches_critical_path=true (autorização declarada por rota + porta de escrita sob RLS)`
- `[T7] ADRs injetadas no executor: ADR-0021, ADR-0022, ADR-0014, ADR-0011, ADR-0018, ADR-0017, ADR-0023, ADR-0008 (fonte: task §7)`
- `[T7] ⚠️ ALERTA REPASSADO AO EXECUTOR: o D11 mede folga de exatamente 7 casos em apps/api/test/cobrancas.e2e.spec.ts antes de o teto de \`ateSerExclusivo\` estourar — e a T7 acrescenta 7 CTs nesse arquivo. A folga é consumida INTEIRA. Caso novo que crie contrato ou cobrança na EMPRESA_A entra DEPOIS do CT-515 (c).`
- `[T7] baseline repassada ao executor: 805 casos (contracts 222 · shared 212 · api 162 · auth 89 · db 104 · worker 16). Medição POR PACOTE, porque o turbo aborta os irmãos quando um falha.`
- `[T7] executor concluiu. Arquivos: 0 criados, 11 modificados (7 da §5.2 + 3 fora dela + a própria tasks/T7.md). Baseline declarada 805 → 815: api 162 → 169, db 104 → 107; contracts 222, shared 212, auth 89, worker 16 inalteradas.`
- `[T7] marcador sintético do ESTADO AO FIM DA T6 para os gates: t6_sha=3fb4c9548fbb4ed3c4df6d708d92893ccd087916 (mesma mecânica do t5_sha; índice sem entradas intent-to-add, então bastou write-tree direto). Delta da T7: 16 arquivos, +2279/−167.`
- `[T7] ⚠️ DESVIO DE ESCOPO QUE OS GATES PRECISAM JULGAR — o executor emendou packages/db/migracoes/0010_seguranca_cobranca.sql, que NÃO está na §5.2 e é o arquivo que carrega o DECISÃO FECHADA do security_invoker. A emenda envolve cada CASE de mora em COALESCE(c.multa_aplicada, …)/COALESCE(c.juros_aplicados, …) e publica multa_percentual_vigente/juros_percentual_vigente.`
- `[T7] a PREMISSA da emenda foi verificada por mim, o orquestrador, e CONFERE: esquemaDaCobranca (packages/contracts/src/cobranca.ts) publica multaPercentualAplicado e jurosPercentualAplicado, mas NÃO publica multaAplicada nem jurosAplicados — os dois valores carimbados chegam ao cliente só por valorMulta/valorJuros. Com a view publicando 0.00 fora de VENCIDA, a cobrança PAGA publicava valor_total = valor_original, e o carimbo, apesar de gravado, era inalcançável. Ou seja: o comportamento que os cards CT-511/516/518/527 exigem ("PAGA publica os carimbos, não reapura") NÃO era alcançável com a view que a T3 entregou — é defeito de T3 que nenhum teste pegou porque antes da T7 não existia linha PAGA.`
- `[T7] o executor TENTOU escalar por AskUserQuestion e não conseguiu: a ferramenta não opera em subagente. Ele então decidiu e declarou, o que é coerente com a autorização do usuário para este run ("nenhuma pausa por AskUserQuestion — toda decisão assume o recomendado"). Registrado como sinal executor_askquestion em _run/rule-candidates.md.`
- `[T7] ⚠️ RISCO ESPECÍFICO PARA O GATE 2 JULGAR, que não está no sumário do executor: a 0010 ESTÁ no meta/_journal.json do drizzle (tag 0010_seguranca_cobranca, linha 79). O drizzle guarda hash do conteúdo em __drizzle_migrations, então emendar o arquivo muda o hash. Contra instância efêmera (que nasce do zero a cada execução) isso é inócuo e a suíte fica verde; contra um banco DURÁVEL que já tenha aplicado a 0010, o próximo drizzle-kit migrate tentaria reexecutá-la e falharia. O executor afirma que "nada além de instância efêmera a executou até aqui" — é essa afirmação que precisa ser conferida, não aceita.`
- `[T7] ⚠️ SEGUNDO PONTO DE ATENÇÃO: o executor SUBSTITUIU dois acessórios de teste pré-existentes em packages/db/test/cobranca.spec.ts (carimbarPagamento/carimbarCancelamento → pagar/cancelar), e o CT-524 (b), que é da T4 e foi aprovado nos dois gates, passou a montar os terminais pelo caminho de produção. O delta tem 167 remoções. É superfície de AP-24 (weakening_test_to_pass) e exige varredura linha a linha das remoções nos arquivos de teste pré-existentes.`
- `[T7] QA: APROVADO_COM_OBSERVACOES — 16/16 critérios, 9/9 CTs, 0 bloqueantes, 2 baixos (documentation). Suíte 815 verde, medida POR PACOTE: contracts 222 · shared 212 · api 162→169 · auth 89 · db 104→107 · worker 16. Nenhuma unidade encolheu. O CT-907 PASSOU nesta rodada (shared 212/212) — a barreira do protocolo está íntegra apesar de a T7 criar um DECISÃO FECHADA novo.`
- `[T7] antipadroes_verificados: 5/5 arquivos de teste declarados — completo.`
- `[T7] ledger: não criado — rodada 1 aprovada sem rejeição (nada a rastrear).`
- `[T7] MT-7 REPRODUZIDO PELO QA: removidos os dois COALESCE do carimbo (view volta ao estado da T3) → @sysloc/db 1 failed (CT-527, 'expected 40.00 obtido 0.00') e @sysloc/api 3 failed (CT-516, CT-518, CT-511). Reversão conferida por diff -q. A emenda da 0010 NÃO é ornamento: os quatro cards que dependem de "PAGA publica os carimbos" detectam a remoção dela.`
- `[T7] a emenda NÃO afrouxou os mutantes herdados, verificado nos três eixos: EXPRESSAO_DOS_JUROS continua com UMA ocorrência exata (grep -c) e trocarUmaVez levanta se não for única; blocoDaVisao() continua extraindo o CREATE VIEW da 0010 REAL, então CT-513 e CT-526 seguem mutando o objeto do produto; CT-524 (b) e CT-526 continuam com os MESMOS valores esperados. Racional estrutural: os carimbos são não-nulos se e somente se pago_em é não-nulo (cobranca_carimbo_coerente_chk), então o COALESCE só muda o publicado da linha PAGA.`
- `[T7] AP-24: varredura COMPLETA das 167 remoções, limpa. Zero asserções removidas nos 5 arquivos de teste (grep '^-.*expect(' vazio), zero skip/only/todo introduzidos, zero toMatchObject/toBeTruthy/toBeDefined introduzidos (as duas ocorrências de toMatchObject no diff são COMENTÁRIOS proibindo-o). As remoções são os dois acessórios crus mais as duas chamadas no arranjo do CT-524 (b), cujas asserções ficaram palavra por palavra iguais.`
- `[T7] guarda dos acessórios novos: EQUIVALENTE, não mais frouxa — as portas devolvem undefined quando o UPDATE não alcança linha, e o caso "alcançou mais de uma" é impossível sob RLS de uma empresa com (empresa_id, codigo) único. A guarda nova é mais forte num ponto: só é satisfeita se a releitura pela visão também alcançar a linha.`
- `[T7] as duas divergências de card foram julgadas SÃS pelo QA: o CT-532 pela porta em vez da rota (a preservação dos seis campos é propriedade do UPDATE — o SET nomeia seis colunas e nenhuma é de conciliação; coluna não nomeada não é escrita — e o caminho HTTP está exercitado por CT-516/518/511/529/517); e o CT-517 atribuindo à 0010 dois CHECK que vivem na 0009 (os casos afirmam o NOME REAL de cada restrição, que é o que discrimina entre os quatro CHECK da tabela).`
- `[T7] ordem no cobrancas.e2e.spec.ts: o describe da T7 entrou DEPOIS do da T5 (linha 1042 vs 613), que é o que o D11 recomenda — ateSerExclusivo só é chamado no CT-515 (c), dentro do bloco da T5. Nenhuma falha pelo teto. ⚠️ PARA T10/T11: caso novo nesse arquivo entra DEPOIS do bloco da T5.`
- `[T7] AP-26: os dois pares suspeitos preservam a distinção — CT-517(rota) × CT-520 divergem em alvo, parâmetros e discriminador publicado (transicaoPedida PAGAMENTO vs CANCELAMENTO); CT-518 × CT-529 divergem no objeto sob prova (paga imóvel vs aberta móvel no mesmo ato) e nas asserções exclusivas. Nenhum par atinge 3 dos 4 campos.`
- `[T7] observação de superfície interna para o Gate 2: a visão ganhou duas colunas de saída (multa_percentual_vigente, juros_percentual_vigente) e NENHUMA âncora afirma o conjunto de colunas de negocio.cobranca_derivada por igualdade — as âncoras existentes (COLUNAS_DA_COBRANCA) são sobre a TABELA. Elas não vazam para o contrato (colunasDaCobranca seleciona lista explícita de dezoito, confirmado pelo CT-519 por igualdade de chaves), mas o crescimento da visão fica sem rede de conjunto.`
- `[T7] rule_candidates: 2 sinais persistidos (qa=2: repeated_assertion_shape do envelope da ADR-0017 redigitado 9 vezes; repeated_fixture dos acessórios pagar/cancelar homônimos por camada). Total do run: 14.`
- `[T7] débitos a anotar: D17 (QA, documentation — a classificação dos dois atos não foi escriturada na ADR-0021) e D18 (QA, documentation — docblock de registrarPolitica afirma que a porta "nasce em T6", e ela já nasceu). Próximo livre: D19.`
- `[T7] TR consultou: ADR-0021, ADR-0022, ADR-0023, ADR-0008, ADR-0011, ADR-0014, ADR-0015 (Decision integral aberta nas duas primeiras; as outras conferidas contra artefato concreto).`
- `[T7] Tech Review: PARCIAL — 1 ALTO (P1, adr_compliance), 1 MEDIO anotável (P2, project_pattern), 4 BAIXO (P3 scope_deviation, P4/P5/P6 code_quality). Nenhum CRITICO.`
- `[T7] o DESVIO DA 0010 foi JULGADO CORRETO pelo Gate 2, e ele derrubou a premissa do meu alerta sobre o drizzle — a favor: o banco da operação NÃO é migrado por drizzle-kit migrate. deploy/scripts/instalacao/migrar-banco.sh aplica os arquivos com psql --single-transaction e mantém registro próprio em identidade.migracao_aplicada com sha256sum POR ARQUIVO; em divergência de soma ele ABORTA sem alterar nada, imprimindo a remediação ("escreva a mudança como um arquivo NOVO"). __drizzle_migrations não participa de nenhum dos dois caminhos — o meta/_journal.json serve à GERAÇÃO. O risco é instalação interrompida, nunca reexecução parcial nem corrupção. Registro a correção: o alerta que emiti antes do QA superestimava o risco.`
- `[T7] e a 0010 de fato nunca foi aplicada a banco durável: está 'A' no git (nunca commitada), a T1 diferida é captura de golden e não migração, e os artefatos do run só a citam contra instância efêmera. A rejeição da alternativa 0011 também se sustenta: blocoDaVisao() extrai o CREATE VIEW do arquivo 0010 DO DISCO (o test-cases.json §1147 fixa "nunca recomposto no teste"), então uma 0011 com CREATE OR REPLACE faria CT-513 e CT-526 mutarem objeto que não é o do produto — R2, regressão de prova.`
- `[T7] MARCADORES: nenhum tocado, verificado ESTRUTURALMENTE pelo TR (varredura das linhas '-' de todo o delta por DECISÃO FECHADA/DÉBITO COM GATILHO/REVERTER EXIGE/QUANDO FECHA). Único hit: prosa de docblock reflowada em packages/db/src/cobranca.ts, com a frase reintroduzida idêntica no mesmo hunk. O marcador do security_invoker vive em 0010:263-283 e NENHUM hunk o alcança (os hunks estão em ~190-240 e ~291-330). O quarto marcador da §21 nasceu íntegro em cobranca.service.ts, com REVERTER EXIGE falsificável.`
- `[T7] Garantia removida: a declaração do executor CONFERE. As remoções em produção são prosa de docblock, um import substituído por versão mais larga, e as quatro linhas SQL CASE/END que são o próprio envolvimento em COALESCE — substituição, não remoção.`
- `[T7] ⚠️ RISCO REGISTRADO PARA T11 E PARA A F4, que a T7 não pode fechar: cobrança PAGA com atraso publica diasAtraso: 0 ao lado de valorJuros carimbado e POSITIVO — o CASE de dias_atraso não foi envolvido em COALESCE porque não existe coluna dias_atraso_aplicado com que envolvê-lo. diasAtraso É campo publicado (packages/contracts/src/cobranca.ts:363). Sob a leitura "dias em atraso AGORA", zero é correto para cobrança liquidada, e nenhum CA da T7 pediu outra coisa. Vale conferência explícita no CT-533 (T11) e no handoff, ANTES de a F4 montar carnê e segunda via sobre esse par.`
- `[T7] ⛔ RODADA DE CORREÇÃO NÃO ABERTA, e a razão é de autoridade, não de severidade. O único bloqueante (P1) tem por correção EDITAR UMA ADR ACEITA, e nenhum executor pode fazê-lo: a Iron Rule 7 diz "ADR só muda via skill própria (/agent-spec-adr-supersede), não por decisão sua na execução", e a §NÃO DEVE 7 desta skill proíbe alterar artefato de spec sem o usuário pedir. Despachar o executor queimaria uma tentativa para produzir ou nada ou uma edição proibida. Some-se que os DOIS GATES leram o MESMO texto da ADR-0021 em sentidos OPOSTOS (o QA: escrituração, BAIXO; o TR: contradição literal, ALTO) — divergência que é ela mesma sinal de que a decisão é do usuário.`
- `[T7] conferi a Decision da ADR-0021 eu mesmo, e o TR a citou com precisão: "A situação de locação do imóvel é a instância declarada da segunda classe; ativação, cancelamento e retirada de circulação são da primeira." O termo `cancelamento` está sem qualificação, e a segunda classe é definida por ROSTER de instância declarada. Os três atos enumerados casam um a um com as chaves existentes (ACAO:ativar_contrato, ACAO:cancelar_contrato, ACAO:excluir_cadastro), o que sustenta a leitura de que a frase enumera as instâncias da época no domínio de contrato/cadastro — mas ela está escrita sem qualificar, e o Applied in não cita esta fatia.`
- `[T7] T7 PERMANECE 'Em Progresso'. Nada foi staged. A escalada ao usuário é o Passo 10 antecipado por impossibilidade de correção, não por esgotamento de tentativas (o teto de 3 está suspenso por autorização do usuário, e nem foi alcançado — esta é a rodada 1).`

### T7 — intervenção dirigida do orquestrador (rodada 1 → 2), fora do pipeline
- `[T7] ESCALADO AO USUÁRIO por AskUserQuestion e RESPONDIDO em 2026-08-10: emendar a ADR-0021 agora (opção recomendada), em vez de registrar como débito com gatilho no congelamento ou de superseder a 0021 com uma ADR nova. A pergunta foi feita apesar da autorização de "sem pausas" do run, porque emendar o registro arquitetural do projeto está fora do que aquela autorização cobre — ela vale para decisão de implementação.`
- `[T7] EMENDA APLICADA em docs/adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md, três pontos, exatamente o suggested_fix do P1: (1) o roster da segunda classe passou a ser lista explícita com as três instâncias, cada uma com a fatia que a declara e o critério por extenso; (2) a primeira classe passou a nomear a ENTIDADE — "cancelamento de CONTRATO" —, com as três chaves do catálogo citadas nominalmente; (3) cobranca-e-mora (v1) entrou no Applied in, apontando para a §11.2 do tech_spec. Mais um bloco "Emenda de 2026-08-10" que registra que A DECISÃO NÃO MUDOU, só o registro dela, e por que a redação original era ambígua.`
- `[T7] a emenda NÃO alcança a suíte, verificado antes de decidir pular o Gate 1: grep -rln "docs/adr" --include=*.spec.ts packages apps devolve VAZIO — nenhum teste lê ADR. E a linha da 0021 no INDEX.md não muda, porque o resumo gerado trunca a Decision em "...nunca um campo gravado por", antes do trecho editado; nenhum reindex necessário.`
- `[T7] requires_qa_revalidation: FALSE — desvio FUNDAMENTADO do algoritmo, que devolveria true por adr_compliance estar em revalidation_required. A premissa da regra não se realiza: ela decide se UMA CORREÇÃO DE CÓDIGO mudou comportamento, e não houve correção de código. O delta da rodada é um único docs/adr/*.md; o código é byte a byte o mesmo que o Gate 1 aprovou com SUITE_COMPLETA (815 verdes). Overrides conferidos e nenhum altera a conclusão pela mesma razão: tocou_area_critica e task_risk valem sobre o diff de CÓDIGO, que é vazio nesta rodada; security_flags vazio; git diff --stat de código IDÊNTICO ao da rodada 1. Reexecutar o Gate 1 sobre código idêntico não pode produzir informação nova — só queimaria ~13 min de suíte.`
- `[T7] memória lazy criada em _run/tmp/T7.md, no formato completo e com o Ledger POPULADO (8 achados, todos rodada_origem 1). TR-P1 e QA-BAIXO-001 são o MESMO achado em severidades opostas (alto × baixo) sobre o mesmo parágrafo da ADR-0021 — a emenda fecha os dois, e os dois vão a `corrigido` na rodada 2.`
- `[T7] attempt_sha (rodada 1)=<indisponivel — não houve executor de correção>`. Não é degradação do mecanismo: o DELTA da rodada 2 é conhecido exatamente (um arquivo), então não há o que um marcador sintético acrescentaria.`
- `[T7] Gate 2 redespachado em scan_scope DELTA sobre a ADR emendada. Gate 1 PULADO pela justificativa acima.`
- `[T7] Tech Review (rodada 2, DELTA sobre a ADR emendada): APROVADO_COM_OBSERVACOES. TR-P1 SANADO — os três pontos do suggested_fix atendidos um a um, e o gate reli a frase nova procurando o caminho literal que produziu o achado: nenhuma das três instâncias da primeira classe alcança a rota de cancelamento de cobrança. Contradição FECHADA, não contornada.`
- `[T7] TR consultou (rodada 2): ADR-0021, ADR-0011, ADR-0014 — as três com a Decision integral aberta. Confirmou que a ADR-0014 lista `cobrança` NOMINALMENTE entre as entidades que nunca são removidas, o que ancora a reversibilidade alegada para o cancelamento; e que o catálogo da ADR-0011 NÃO foi aberto (as três da primeira classe têm "chave própria já existente"; as duas novas entram na classe que exige apenas a área, sem chave).`
- `[T7] o TR confirmou por MEDIÇÃO, não por confiança no input, que o código é o mesmo da rodada 1: git diff --stat <t6_sha> -- apps packages fecha em 10 arquivos, 2165 inserções, 122 remoções — os mesmos 10 paths da memória lazy. E reconferiu por conta própria que nenhum teste lê docs/adr, sustentando a decisão de não reexecutar o Gate 1.`
- `[T7] a emenda PRESERVA a decisão, verificado componente a componente pelo TR: a frase-critério da segunda classe intacta; Context, Consequences e Alternatives sem uma linha tocada; e a única frase removida foi ABSORVIDA integralmente pelo roster (primeira metade → primeiro bullet, segunda metade → parágrafo qualificado).`
- `[T7] 3 achados novos na rodada 2, todos BAIXO/project_pattern e nenhum existente na rodada 1 — os três só se tornaram observáveis quando o texto da emenda passou a existir. P7 e P8 são imprecisões factuais NO TEXTO QUE O ORQUESTRADOR ESCREVEU e foram CORRIGIDAS na mesma passagem, portanto NÃO viram débito: o P7 atribuía à Decision da ADR-0011 uma enumeração que ela não contém (conferi: a Decision da 0011 fixa as duas dimensões e o default que nega, e não enumera chave nenhuma — quem enumera é packages/auth/src/catalogo-de-permissoes.ts:107-108), e o P8 dizia "a última das Alternativas" onde a frase citada está na TERCEIRA de quatro. O P9 é do projeto e vira débito.`
- `[T7] ledger: 11 achados totais | 3 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`. Os três de rodada 2 apontam para o arquivo que a própria correção da rodada 1 criou — o fingerprint deles ESTÁ no delta da correção, logo não são incompletude da varredura anterior.
- `[T7] débitos anotados: D19 (TR, MEDIO project_pattern), D20 (TR, BAIXO scope_deviation), D21 (TR, BAIXO code_quality), D22 (TR, BAIXO code_quality), D23 (TR, BAIXO code_quality), D24 (QA, baixo documentation), D25 (TR, BAIXO project_pattern). Próximo livre: D26.`
- `[T7] rule_candidates (rodada 2): 1 sinal persistido (staff=1 convention_drift — emenda de ADR aceita sem convenção escrita). Total do run: 17.`

### T8 — pré-execução
- `[T8] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu; T2..T7 staged sem commit)
- `[T8] executor: opus (declarado) · gates: [qa, tech_review] (declarado) · risk: medium · tipo=padrao_novo (aritmética de datas escrita à mão)`
- `[T8] ADRs injetadas no executor: ADR-0006, ADR-0022 (fonte: task §7)`
- `[T8] baseline repassada: 815 casos (contracts 222 · shared 212 · api 169 · auth 89 · db 107 · worker 16). Medição POR PACOTE.`
- `[T8] a task NÃO toca cobrancas.e2e.spec.ts nem cobertura-de-autorizacao.e2e.spec.ts — o D11 e as âncoras de superfície não são alcançados. Ela também NÃO publica rota: as âncoras seguem em 82/67.`
- `[T8] QA: APROVADO_COM_OBSERVACOES — 11/11 critérios, 4/4 CTs (CT-504..507, em 7 casos), 0 bloqueantes, 1 MEDIO anotável (tests/duplicate_cross_layer) e 1 baixo (tests/magic_strings). Suíte 815 → 822; db 107 → 114; nenhuma unidade caiu.`
- `[T8] antipadroes_verificados: 2/2 arquivos de teste — completo. detectados: AP-19 (magic_strings) e AP-23 (duplicate_cross_layer), os dois anotáveis pela partição.`
- `[T8] ledger: não criado — rodada 1 aprovada sem rejeição.`
- `[T8] MT8-1 REPRODUZIDO PELO QA (o discriminador declarado do golden): 3 failed | 111 passed, e a SOBREVIVÊNCIA do cenário de dia seguro CONFIRMADA — o laço do CT-504 percorreu dia_seguro_tres_meses#0..2 e só falhou no cenário iniciado em 31. É exatamente a cegueira que os dois cenários de 2027-01-31 existem para fechar. Reversão conferida por md5sum.`
- `[T8] PROVA DE FALSIFICAÇÃO do CT-506 REPRODUZIDA PELO QA (MT8-3): formatarEmIso reescrito com Date.UTC → 2 failed | 112 passed, e a asserção ESTÁTICA COMMITADA reprova ("expected [ Array(1) ] to deeply equal []") — ela ENXERGA o defeito, não é decorativa. O par de controle do predicado (3 formas proibidas → true, 5 legítimas incluindo duas em comentário → false) roda ANTES da varredura, e expect(varredura.arquivos).toBe(1) fecha o segundo vão medido da rule (zero arquivo varrido = caso vacuamente verde).`
- `[T8] DIVERGÊNCIA DE CARD JULGADA: o executor está CERTO e NÃO ajustou o esperado para caber no obtido. O QA mediu no próprio mutante — a produção mutada emitiu literalmente "31/03/2027 à 29/04/2027", idêntico à constante do teste. A aritmética confere: abril tem 30 dias, o controle satura o início em 30/04 e a véspera é 29/04; escrever 30/04 exigiria um controle que saturasse o início e não o fim. E o DISCRIMINADOR está íntegro e MAIS FORTE que o card pediu — o índice é nomeado ([1,2,3] em 4 meses e [1..12] em 13, DOZE dos treze contra os "pelo menos 11" do card), e a divergência é medida sobre a LISTA (not.toContain), o que fecha o undefined que faria um not.toBe passar trivialmente. NÃO é AP-24.`
- `[T8] ESCRITURAÇÃO DO D26 conferida nas TRÊS PONTAS e íntegra: marcador em packages/db/src/derivacao-de-cobranca.ts:343-356 com os quatro campos mais o ÍNDICE (e uma linha extra declarando que NÃO é uma DECISÃO FECHADA — a confusão de natureza que a §3-B adverte); linha no índice do CLAUDE.md:449; bloco ### D26 na §2 do run-report:431. SEM colisão: o D26 citado na linha 176 é o D26 (F2/T6), de outra fatia e qualificado pela origem.`
- `[T8] CT-907 PASSOU (shared 212/212), sem timeout e sem falha de asserção — a barreira das duas pontas do índice de débito fechou DEPOIS das edições do executor no CLAUDE.md e no run-report.`
- `[T8] a âncora de fuso do CT-506 FUNCIONA de fato, medido pelo QA: getTimezoneOffset devolve 0, 180 e -840 para os três fusos, provando que a atribuição a process.env.TZ trocou o fuso do processo e que o caso não avaliou três vezes o MESMO fuso.`
- `[T8] o QA registrou duas linhas de AP-29 examinadas e NÃO reportadas, com a razão auditável: são reafirmações redundantes ao lado de asserções falsificáveis, e a discriminação real foi MEDIDA pelo MT8-1. Ele explicitou que não usou a alternativa proibida de rebaixar AP-29 a MÉDIO.`
- `[T8] independência de ordem MEDIDA (AP-08): os quatro CTs rodados isolados por -t passam sozinhos. O beforeAll de topo carrega o golden num readonly nunca mutado — não é AP-17.`
- `[T8] rule_candidates: 2 sinais persistidos (qa=2: repeated_fixture do CORPO_DE_CONTRATO recriado em dois pacotes; repeated_assertion_shape da projeção + Array.from). Total do run: 19.`
- `[T8] débitos a anotar: D27 (QA, MEDIO tests/duplicate_cross_layer) e D28 (QA, baixo tests/magic_strings). ⚠️ O D28 desta fatia é o TERCEIRO D28 do projeto — os outros são F0/T5 e F2/T7. A coexistência é legítima pela §3-B (a sequência corre dentro da §2 da fatia; o identificador é o par Dnn · F{n}/{origem}), mas vale o registro. Próximo livre: D29.`
- `[run] RETOMADA 2 — 2026-08-10: a sessão foi interrompida entre o QA e o Gate 2 da T8. Sinais do resume: T8 em status não-Concluído, QA já aprovado, _run/tmp/ vazio (nenhuma rejeição), delta de código intacto. Escolha: (a) RETOMAR NOS GATES, pela autorização de "sem pausas / assuma o recomendado" do run — nenhuma AskUserQuestion disparada. Nada é reexecutado: o executor e o Gate 1 da T8 já concluíram e o código é byte a byte o mesmo.`
- `[T8] t7_sha reconfirmado para o Gate 2: eb09bafa4d034c09764d048f4d5cf3ff2b631ee4`
- `[T8] TR consultou: ADR-0006, ADR-0016, ADR-0022, ADR-0023 — as quatro com a Decision integral aberta antes de citar.`
- `[T8] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 1 BAIXO (P1, project_pattern: a §5.2 não pré-declarou os três arquivos que a publicação do símbolo e a emissão do marcador obrigam a tocar). É a NONA ocorrência do padrão já escriturado como D10 desta fatia e D26 (F2/T6).`
- `[T8] o TR julgou as TRÊS edições fora da §5.2 como MECANICAMENTE OBRIGATÓRIAS, com a prova de cada uma: o CT-012 compara a superfície publicada por IGUALDADE (expect(superficie.nomes).toEqual(ordenado(SIMBOLOS_ESPERADOS)), linha 1644), então publicar o símbolo NECESSARIAMENTE reprova até o inventário incluí-lo; e a §3-B obriga as duas pontas do índice do marcador. NENHUM alargamento de escopo pelo executor — nenhum scope_deviation aberto.`
- `[T8] Garantia removida: declaração "nenhuma" CONFIRMADA e o delta a torna conclusiva — sobre packages/db é +1376/−0, ZERO linhas removidas de produção ou de teste. As 46 remoções do delta completo são todas prosa ou marcação, cada uma identificada pelo TR (CLAUDE.md −15 de parágrafo reescrito; roadmap.md −9 de painel gerado; tasks/T8.md −19 de "- [ ]" → "- [x]"; task_plan e tasks/T2 −1 de status; atualizar-roadmap.sh −1 da entrada [F3] do array de fatias).`
- `[T8] DECISÃO FECHADA: varredura das linhas '-' filtrada por DECISÃO FECHADA / DÉBITO COM GATILHO / REVERTER EXIGE retorna VAZIO — nenhum marcador alterado, movido, removido, esvaziado ou reclassificado.`
- `[T8] ContratoParaParcelas fora do índice publicado: JULGADO COERENTE e não achado. O TR verificou que o consumidor da T9 não precisa nomear o tipo — ContratoPersistido (packages/db/src/contrato.ts:268) declara os quatro campos com nome e tipo IDÊNTICOS, então derivarParcelasDoContrato(contrato) compila por subtipagem estrutural, sem excess property check por não ser literal fresco. Também não é seam da Iron Law #6: é o tipo do parâmetro de uma função pública, e o uso pelo spec é consequência, não causa.`
- `[T8] o TR confirmou que o molde de derivacao-de-contrato.ts foi IMITADO e não reinventado (mesmas constantes com os mesmos nomes, mesmo recorte por posição em vez de split, mesma contagem em meses absolutos desde o ano zero para que o transbordo de dezembro seja aritmética e não ramo, mesma organização de acessórios, mesmo estilo de docblock; a suíte reusa o helper existente ./varredura-de-fontes.ts em vez de reimplementar).`
- `[T8] e registrou que a T8 vai UM PASSO ALÉM do molde, com ganho estrutural: não existe um único Date no fonte de produção (as sete ocorrências de "Date" estão todas em comentário), enquanto o molde ainda constrói o instante por new Date(0) + setUTCFullYear. Tendo ultimoDiaDoMes em mãos, recuarUmDia se escreve sem instante — o que torna as duas proibições MEDIDAS propriedades ESTRUTURAIS em vez de disciplinares, e é a razão de o CT-506 poder afirmá-las por asserção estática.`
- `[T8] a divergência de card do CT-505 foi confirmada pelo TR por CÁLCULO independente: o terceiro período do controle começa em addMeses(2027-01-31, 2) = 2027-03-31 e termina na véspera de addMeses(2027-01-31, 3), que satura em 2027-04-30 porque abril tem 30 dias — logo 29/04/2027. O CARD estava errado; a constante é o valor medido.`
- `[T8] a duplicação de ultimoDiaDoMes/ehBissexto NÃO foi reportada como problema porque a escrituração do D26 está completa e o diferimento é o que o próprio protocolo manda: promover as duas exigiria alterar a superfície de um módulo estável FORA dos arquivos da task, que é a Proibição 5 da §4 ("nunca aproveitar que estou aqui").`
- `[T8] ADR-0023 julgada NÃO APLICÁVEL pelo TR, com razão MAIS FORTE que a do QA: além de as parcelas serem fatos que a T9 vai gravar em colunas, a função NÃO compõe aritmética monetária alguma — valorOriginal é cópia literal de valorMensal, sem multiplicação nem arredondamento, ao contrário da irmã derivarValorTotal.`
- `[T8] o TR deixou explícito um nit que decidiu NÃO reportar: lerData usa DIGITOS_DO_ANO no primeiro recorte e literais 5,7 / 8,10 nos outros dois — é cópia literal de derivarTerminoDaLocacao, aprovada nos dois gates na fatia anterior. "Reportar aqui criaria pressão para divergir do molde justamente na task cujo aceite pede imitá-lo."`
- `[T8] rule_candidates: 1 sinal persistido (staff=1 convention_drift — consequência obrigatória fora da §5.2). Total do run: 20.`
- `[T8] débitos anotados: D27 (QA, MEDIO tests/duplicate_cross_layer), D28 (QA, baixo tests/magic_strings), D29 (TR, BAIXO project_pattern). Próximo livre: D30.`
- `[T8] ledger: não criado — rodada 1 aprovada nos dois gates sem rejeição.`

### T9 — pré-execução
- `[T9] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu; T2..T8 staged sem commit)
- `[T9] executor: opus (declarado) · gates: [qa, tech_review] (declarado) · risk: HIGH — a única task de risco alto restante · diff_touches_critical_path=true (api_contracts em packages/contracts + service com marcadores)`
- `[T9] ADRs injetadas no executor: ADR-0015, ADR-0020, ADR-0016, ADR-0017, ADR-0021, ADR-0022, ADR-0008 (fonte: task §7)`
- `[T9] ⚠️ A §4 e a §3.4 da task mandam comparar contra "a baseline de 687 casos" — número STALE, do início do run. A baseline real ao começar a T9 é 822 (contracts 222 · shared 212 · api 169 · auth 89 · db 114 · worker 16). Repassado ao executor com a correção explícita, para que ele não conclua que a suíte cresceu 135 casos indevidamente.`
- `[T9] ⚠️ D29 APLICADO NO PROMPT (em vez de editar a spec, que a skill proíbe): a task publica DOIS símbolos em packages/db/src/index.ts e NÃO declara packages/db/test/unidade-de-trabalho.spec.ts na §5.2 — o CT-012 vai reprovar até o inventário crescer. É a décima ocorrência do padrão do D10/D29, e a instrução foi injetada no prompt do executor, que é o destinatário real (mesmo caminho usado para levar o P4 da T3 até a T4).`
- `[T9] ⚠️ os DOIS marcadores de contrato.service.ts têm destinos OPOSTOS nesta task, e confundi-los é o erro mais provável: o D28 (F2/T7) SAI no mesmo commit (é o débito que a task fecha, com a linha do CLAUDE.md junto); o D36 (F2/T8) PERMANECE intocado, porque quem o fecha é a fatia 2, que produz o documento. Repassado com destaque.`
- `[T9] QA: APROVADO_COM_OBSERVACOES — 12/12 critérios, 3/3 CTs (CT-508, CT-509, CT-537), 0 bloqueantes, 1 MEDIO anotável (code_quality/semantically_duplicated_test) e 2 baixos (documentation). Suíte 822 → 829; contracts 222→227, api 169→171; nenhuma unidade encolheu.`
- `[T9] antipadroes_verificados: 4/4 arquivos de teste — completo. detectados: AP-26 em esquemas.spec.ts.`
- `[T9] ledger: não criado — rodada 1 aprovada sem rejeição.`
- `[T9] MT-T9-3 REPRODUZIDO PELO QA, e é o coração da task: geração movida para unidade PRÓPRIA commitada antes da transição → 3 failed | 168 passed, e o CT-509 reprovou em contratos.e2e.spec.ts:2546 com o modo de falha LITERAL que o card previa — as TREZE parcelas do contrato recusado (COB-2026-0000104 a 0000116) sobrevivendo ao 422, contra [] esperado. Reversão por sha256sum idêntico e api de volta a 171/171.`
- `[T9] MT-T9-A também reproduzido (não era exigido): z.union([z.literal(false), z.number()]) → 3 failed | 224 passed, um por cláusula perdida do eixo RECUSADO do CT-537. É a prova de que o CT-537 barra a "correção compatível".`
- `[T9] ⚠️ AP-24 NA EDIÇÃO MAIS PERIGOSA — VEREDITO: NÃO É AP-24, e a verificação foi concreta. A troca gerarCobrancasAutomaticamente true→false no arranjo contratoAtivo de cobrancas.e2e.spec.ts é RESTAURAÇÃO de precondição: (1) nenhuma asserção daquele arquivo mudou — o CT-514 segue com igualdade de corpo INTEIRO nos dezoito campos, igualdade de LISTA de códigos e o sequencial ABSOLUTO 0000001, que é a asserção mais estrita possível e a que MAIS sofreria com afrouxamento; (2) o cenário NÃO ficou mais fácil — é a única configuração em que aquelas asserções permanecem VERDADEIRAS, porque com geração automática a ativação emitiria doze parcelas ALUGUEL antes das três que o caso lança. O caminho oposto tem prova própria e nova: o CT-508.`
- `[T9] as outras três superfícies de AP-24 também limpas: a substituição CT-429 → CT-537 é MAIS ESTRITA (o false, que era o único valor aceito, passou a estar afirmado entre os RECUSADOS com path literal); EFEITOS_ESPERADOS virou derivado de PRAZO_DE_UM_MES e os DOIS pontos de chamada seguem comparando objeto inteiro; e a mudança de tipo boolean→number NÃO virou expect.any(Number) — é toBe(3) mais toEqual({cobrancasGeradas: 3}). Grep confirmou zero toBeTruthy/toBeDefined/toBeGreaterThan(0) nos quatro arquivos.`
- `[T9] CT-907 VERDE POR ASSERÇÃO (shared 212/212), sem timeout — as duas pontas do índice fecham. E o QA verificou as menções em PROSA ao D28 fechado contra a EXPRESSÃO REAL do caso, não por confiança: PADRAO_DE_LINHA_DE_INDICE é /^\| \*\*(D\d+)\*\* \((F\d+\/[A-Za-zç]+\d*)/gm e exige a linha começando por "| **Dnn** («; as quatro menções foram escritas com texto interposto entre o negrito e o parêntese, e nenhuma casa o padrão. O D36 permanece em contrato.service.ts:799 com a linha dele na tabela.`
- `[T9] DESVIO DECLARADO DO ACEITE 3, e o QA o julgou CORRETO: a §3.3 diz que a primeira unidade garante os DOIS contadores, e a implementação garante só o da cobrança — porque a ativação NÃO emite número de contrato (o código do contrato é emitido na CRIAÇÃO), e garantir o contador dele ali seria trabalho morto. A propriedade da ADR-0015 está preservada: a unidade que cria a sequência COMMITA antes de a que a consome abrir, sem aninhamento, e o DECISÃO FECHADA de unidade-de-trabalho.ts não foi tocado.`
- `[T9] as TRÊS divergências de card julgadas legítimas, e DUAS produzem asserção MAIS FORTE que o card pedia: (1) o Zod 4 publica path:['efeitos'] + keys:['boletosEmitidos'], e o teste afirma os três por igualdade E a composição — estritamente mais forte, porque a composição sozinha passaria num esquema que reportasse a raiz; (2) a consecutividade relativa preserva o invariante e o card literalmente NÃO era satisfazível (o ano do código sai do relógio do banco: COB-2026 para competências de 2027), e o teste acrescenta um quarto eixo que o card não pedia — ano único nos três; (3) o passo 8 do CT-508 fecha o vão entre "gravou zero parcelas" e "gravou zero E queimou três números", que nenhuma contagem de linhas veria e que a ADR-0015 torna irreversível.`
- `[T9] golden conferido byte a byte pelo QA contra a tabela do teste, e o arquivo NÃO foi tocado.`
- `[T9] rule_candidates: 2 sinais persistidos (qa=2: repeated_fixture do arranjo do contrato do cenário golden; repeated_assertion_shape da contagem antes/depois). Total do run: 22.`
- `[T9] débitos a anotar: D30 (QA, MEDIO code_quality), D31 (QA, baixo documentation), D32 (QA, baixo documentation). ⚠️ O D32 desta fatia coexiste com o D32 (F0/T6) do índice do CLAUDE.md — legítimo pela §3-B. Próximo livre: D33.`
- `[T9] TR consultou: ADR-0008, ADR-0015, ADR-0016, ADR-0017, ADR-0020, ADR-0021, ADR-0022.`
- `[T9] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 2 BAIXO (P1 project_pattern, P2 code_quality). rule_candidates vazio por decisão explícita do gate.`
- `[T9] MARCADORES conferidos pelo TR nos DOIS sentidos da §3-B, e fecham: "D28 · F2/T7" em ZERO arquivos; e as 12 linhas do índice do CLAUDE.md, extraídas com a expressão REAL do CT-907, todas com marcador vivo — nenhuma órfã. A prosa acima da tabela foi corrigida para "Doze débitos" e a aritmética fecha (F0=2, F1=5, F2=3, F3=2). O D36 está em contrato.service.ts:799 e NÃO aparece em hunk algum.`
- `[T9] DECISÃO FECHADA: nenhuma tocada. unidade-de-trabalho.ts, packages/db/src/contrato.ts, derivacao-de-cobranca.ts e comum.ts têm git diff VAZIO. A DECISÃO FECHADA de packages/db/src/cobranca.ts sobreviveu com texto e código-sob-marcador inalterados — criarCobrancasEmLote foi inserida ACIMA dela, preservando a topologia do arquivo (escritas acima, leituras abaixo). E a DECISÃO FECHADA — T6 de contrato.service.ts:1038 sobreviveu à edição de traduzirConflitoDeGravacao que a ENVOLVE: o ramo que ela protege está byte a byte igual, e o que mudou foi o ramo ANTERIOR, que ela não alcança.`
- `[T9] o item 6 da declaração de garantias (o único não declarado como preço do débito) se SUSTENTA, e o TR provou por um caminho que o executor não usou: tsconfig.base.json tem noUncheckedIndexedAccess: true, então "const [gravado] = ..." é tipado string|undefined e o "if (gravado === undefined) throw" continua um ramo REAL que o compilador cobra — não virou comparação morta depois da troca por readonly string[]. Nenhum "as" introduzido.`
- `[T9] CRITÉRIO 3: o TR discordou da §3.3 e concordou com o executor, por razão PRÓPRIA — ativar não chama emitirNumeroDeContrato em ponto nenhum, então garantir ali o contador do contrato parearia uma unidade com uma série que ela NÃO consome, o que não é a propriedade que a ADR-0015 pede. A §3.3 é que estava imprecisa.`
- `[T9] ACHADO A FAVOR DA IMPLEMENTAÇÃO, que a spec não pede: a gravação do estado (a etapa que colide no índice de vigência) vem ANTES da emissão dos números, de modo que a recusa COMUM — imóvel ocupado — NÃO queima número nenhum. E gerarCobrancasAutomaticamente=false retorna 0 antes de emitirNumerosDeCobranca. O furo aceito por escrito na ADR-0015 fica no mínimo possível.`
- `[T9] FRONTEIRA ContratosModule → CobrancaService julgada CORRETA, com as alternativas pesadas: injetar o serviço evita reescrever a escolha do eixo de data, que é literalmente o débito D7 (F3/T4) fechado pela T5 — lerAnoDaSerieDeCobranca usa negocio.data_corrente_da_operacao() (o eixo da visão) contra o fuso da sessão de lerAnoDaSerieDeContrato. Chamar a porta direto do controlador, ou dar ao ContratoService garantia própria, recriaria essa escolha num segundo lugar. Segregar a interface exigiria abstração com UMA implementação = speculative_complexity.`
- `[T9] SUPERFÍCIE INALTERADA, com o mecanismo explicado: imports: [CobrancasModule] NÃO republica os controladores dele — no Nest o módulo aparece uma vez no grafo por mais de um importador e o container o instancia como singleton. cobertura-de-autorizacao e contexto verdes SEM edição é a prova empírica.`
- `[T9] os TRÊS arquivos não declarados ficaram FORA de scope_deviation, com razões distintas: cobrancas.module.ts é consequência MECÂNICA e INDIVISÍVEL da instrução da própria §5.2 (sem exports, o imports que ela manda pôr não resolve — "a spec pediu metade de um mecanismo indivisível"); unidade-de-trabalho.spec.ts é o CT-012 por igualdade de conjunto, décima ocorrência do D10/D29; cobrancas.e2e.spec.ts é restauração de precondição.`
- `[T9] RISCO ANOTADO PELO TR, sem virar achado: emitirNumerosDeCobranca faz SELECT ... FROM generate_series(1,n) SEM ORDER BY, e o docblock afirma a ordem da série. Formalmente o SQL não contrata essa ordem; na prática a varredura é determinística no PostgreSQL e o código confere length === quantidade. NENHUM requisito declarado depende do pareamento parcela↔número — o custo de uma reordenação hipotética seria um teste vermelho (a asserção de consecutividade do CT-508), nunca dado errado em produção.`
- `[T9] ⚠️ P1 É AVISO DIRETO PARA A T10, e o TR o escreveu como tal: contrato.service.ts:174-179 ainda afirma que "negocio.cobranca não existe nesta fatia (RD-12)" e que "o mesmo caminho percorre" quando a F3 chegar. O TR leu o cancelar (linhas 812-825) e NÃO existe caminho: ele faz localizarContrato, cancelarContrato e definirSituacaoDeLocacaoDoImovel, e nenhuma linha toca cobrança. A T9 abriu uma JANELA REAL — contrato cancelado deixa N parcelas vivas em cobranca_derivada, classificadas A_VENCER/VENCIDA, acumulando mora. O suggested_fix diz que, sendo a T10 a próxima a rodar, corrigir a PROSA e dispensar o marcador é aceitável (ele nasceria e morreria na mesma sessão). INJETADO no prompt do executor da T10.`
- `[T9] débitos anotados: D30 (QA, MEDIO code_quality), D31 (QA, baixo documentation), D32 (QA, baixo documentation), D33 (TR, BAIXO project_pattern), D34 (TR, BAIXO code_quality). Próximo livre: D35.`
- `[T9] ledger: não criado — rodada 1 aprovada nos dois gates sem rejeição.`

### T10 — pré-execução
- `[T10] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu; T2..T9 staged sem commit)
- `[T10] executor: opus (declarado) · gates: [qa, tech_review] (declarado) · risk: medium · diff_touches_critical_path=true`
- `[T10] ADRs injetadas no executor: ADR-0014, ADR-0021, ADR-0022, ADR-0008, ADR-0017 (fonte: task §7)`
- `[T10] baseline repassada: 829 casos (contracts 227 · shared 212 · api 171 · auth 89 · db 114 · worker 16). Medição POR PACOTE.`
- `[T10] ⚠️ D33 INJETADO NO PROMPT: o P1 do Gate 2 da T9 mostrou que contrato.service.ts:174-179 ainda afirma que "negocio.cobranca não existe nesta fatia (RD-12)" e que "o mesmo caminho percorre" — as três afirmações estão falsas, e o cancelar NÃO toca cobrança. A T10 é a task que fecha essa janela, e o suggested_fix do TR diz que corrigir a PROSA e dispensar o marcador é aceitável justamente porque a T10 é a próxima a rodar. Injetado.`
- `[T10] ⚠️ D29/D10 aplicado de novo: a task publica UM símbolo em packages/db/src/index.ts e NÃO declara packages/db/test/unidade-de-trabalho.spec.ts na §5.2 — o CT-012 vai reprovar. Décima primeira ocorrência. Injetado no prompt.`
- `[T10] ⚠️ tensão declarada repassada: o gatilho do D36 (F2/T8) É a F3, e esta É a F3 — mas o marcador PERMANECE, porque quem decide se o carimbo é pré-condição ou efeito é a fatia 2, que produz o documento. A §3.4 e a §7 da task, mais a §21 do tech spec, registram a rejeição do arquiteto à sugestão do gerador de fechá-lo aqui.`
- `[T10] QA: APROVADO_COM_OBSERVACOES — 11/11 critérios, 3/3 CTs (CT-521, CT-530, CT-531), 0 bloqueantes, 3 baixos (documentation). Suíte 829 → 832; api 171→173, db 114→115; nenhuma unidade encolheu. Superfície medida e INALTERADA em 82/67.`
- `[T10] antipadroes_verificados: 3/3 arquivos de teste — completo, nenhum antipadrão detectado.`
- `[T10] ledger: não criado — rodada 1 aprovada sem rejeição.`
- `[T10] MT-2 REPRODUZIDO PELO QA, e as TRÊS condições confirmam: (1) o número bate (1 failed | 172 passed); (2) o passo 4 PASSA INTEIRO — a igualdade de objeto da PAGA, a da já CANCELADA e o canceladoEm exatamente igual ao original passam TODAS sob o mutante, isto é, a publicação das duas terminais fica idêntica byte a byte; (3) a reprovação é EXATAMENTE na asserção de xmin, em contratos.e2e.spec.ts:3071, "expected '1904' to be '1898'" — os mesmos números do executor. A asserção de xmin NÃO é decorativa, e o valor declarado da task se sustenta. Fonte restaurado por diff -q byte a byte.`
- `[T10] o QA decidiu NÃO reexecutar o MT-1 e justificou: cobranca_desfecho_unico_chk é "pago_em IS NULL OR cancelado_em IS NULL" (0009:116), então escrever cancelado_em numa linha paga é recusado pelo banco com 23514 e qualquer asserção de status o pega. Reexecutá-lo custaria ~9 min para confirmar um mutante que não discrimina nada que o MT-2 já não discrimine melhor. Concordo com a economia.`
- `[T10] CONTROLE POSITIVO ALÉM DO CARD, e ele importa: o CT-530 afirma que o xmin das DUAS ABERTAS MUDOU (not.toBe, linhas 265-266), o que o card não pedia. Sem isso, uma implementação que não escrevesse NADA satisfaria as duas igualdades de xmin das terminais por vacuidade.`
- `[T10] D36 e CLAUDE.md conferidos de forma INDEPENDENTE pelo QA: grep -c do marcador = 1 e nenhuma linha ± do diff o toca; git diff -- CLAUDE.md VAZIO, logo a T10 não removeu linha alguma dele. A barreira CT-501..CT-510 verde nos 212 casos de @sysloc/shared.`
- `[T10] a CORREÇÃO DO D33 foi julgada VERDADEIRA: o QA verificou as DEZ afirmações substantivas do texto novo uma a uma contra o código, e todas conferem (a existência da tabela desde a 0009, as N parcelas da T9, a ausência do "mesmo caminho", as cinco etapas, o predicado literal, a tupla intacta com xmin preservado — que ele mesmo provou pelo MT-2 —, o conjunto vazio sem ramo de erro, a contagem publicada só na trilha, o evento da §13.1 verbatim, e as etapas 4 e 5 no mesmo commit). O texto NÃO trocou uma afirmação falsa por outra imprecisa.`
- `[T10] ⚠️ mas o QA achou UMA imprecisão no texto novo, e ela é fina: a oração "não deixou marcador nem débito" — marcador de fato não deixou, DÉBITO deixou (o D33 está na §2 desta fatia, e é exatamente aquele parágrafo). Um agente que grepe o §2 encontra o D33 e lê no fonte a negação de que ele exista. Vira o D37.`
- `[T10] a citação de ADR-0019 (superseded pela 0021) em 13 pontos dos dois arquivos de contrato foi julgada ESCRITURAÇÃO/documentation, NÃO adr_compliance, e o QA fundamentou: não há contradição com nenhuma Decision — ele abriu o texto vigente da 0021 com a emenda e o comportamento conforma item a item (cancelamento de CONTRATO na primeira classe, rota própria com ACAO:cancelar_contrato, cascata como efeito). O defeito é um PONTEIRO VENCIDO, não uma decisão desfeita; e corrigir as 13 dentro da T10 seria scope_deviation de manual.`
- `[T10] DIVERGÊNCIA DECLARADA no CT-521 passo 5, registrada pelo QA sem virar problema: o card manda consultar a cobertura de autorização, e a implementação varre o TEXTO do cobranca.controller.ts contando decoradores. A razão arquitetural é sólida (a direção do grafo é api → db; packages/db importar apps seria defeito), vem com prova de falsificação (um @Delete acrescentado a cópia em memória faz a lista virar ['DELETE','GET','POST'] e reprovar), e o vão que ela deixa — um DELETE publicado por OUTRO controlador — está coberto em cobertura-de-autorizacao.e2e.spec.ts, que fixa 82/67 por dupla medição. O placement cross-pacote é decisão do Gate 2. É também a origem da red flag test_breaks_on_source_text_rename.`
- `[T10] a MUDANÇA DE ASSINATURA de ContratoService.cancelar foi julgada NECESSÁRIA E MÍNIMA: a contagem nasce dentro da transação e o logger vive na borda; as alternativas eram mover o log para o serviço (que não conhece sessão nem HTTP) ou chamar a cascata do controlador (movendo a regra da transição para a borda). O tipo ResultadoDoCancelamento fica fora de @sysloc/contracts, o manipulador segue Promise<Contrato>, e o CT-415 — que afirma o corpo INTEIRO do cancelamento por igualdade e NÃO foi tocado — é o que prova que cobrancasCanceladas não vaza na resposta.`
- `[T10] AP-24: as 32 remoções conferidas UMA A UMA. cobranca.ts 2 (prosa); index.ts 0; contrato.service.ts 18 (16 prosa + 2 de código: a assinatura e o return); contrato.controller.ts 6 (5 prosa + 1 desestruturação); contratos.e2e.spec.ts 3 e cobranca.spec.ts 3, TODAS prosa de cabeçalho; unidade-de-trabalho.spec.ts 0. NENHUMA asserção removida ou afrouxada, zero skip/only/todo.`
- `[T10] rule_candidates: 2 sinais persistidos (qa=2: repeated_assertion_shape da ativação afirmada inline; repeated_fixture do auxiliar de rota que levanta). Total do run: 24.`
- `[T10] débitos a anotar: D35 (QA, baixo documentation — o "oito operações" vencido), D36 (QA, baixo documentation — as 13 citações de ADR-0019), D37 (QA, baixo documentation — a oração "não deixou débito"). ⚠️ O D36 DESTA FATIA coexiste com o D36 (F2/T8), que é marcador VIVO no arquivo que esta task editou — a coexistência é legítima pela §3-B (identificador é o par Dnn · F{n}/{origem}), mas é a mais confusa do run e precisa de aviso no bloco. Próximo livre: D38.`
- `[T10] TR consultou: ADR-0008, ADR-0014, ADR-0017, ADR-0019, ADR-0021, ADR-0022.`
- `[T10] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 2 BAIXO (P1 project_pattern das citações de ADR-0019, P2 testability do placement do CT-521 passo 5). rule_candidates vazio por decisão explícita: o P1 viola convenção que ESTÁ escrita (CLAUDE.md item 6), logo é problema de APLICAÇÃO e não de ausência de regra; e testability não pertence ao vocabulário de sinais do gate.`
- `[T10] o TR CONCORDOU com o Gate 1 na classificação das citações de ADR-0019 (documentation/project_pattern, não adr_compliance), com razão própria: abriu a Decision da 0021 emendada e não há contradição — o cancelamento de CONTRATO está nominalmente na primeira classe exigindo ACAO:cancelar_contrato, que é o que a rota declara, e a cascata é EFEITO da rota própria. O defeito é de PONTEIRO. Ele contou 14 ocorrências (o QA contou 13) e nomeou o agravante: a redação ORIGINAL da 0019, antes da emenda, punha o cancelamento de COBRANÇA na primeira classe — e "foi exatamente essa leitura ao pé da letra que consumiu uma rodada no Gate 2 da T7".`
- `[T10] MARCADORES: o D36 em contrato.service.ts:854 está BYTE A BYTE intacto, com os cinco campos inteiros e a natureza não trocada — inclusive a linha que o distingue de uma DECISÃO FECHADA. E o DECISÃO FECHADA de packages/db/src/cobranca.ts:812 (toda LEITURA atravessa a visão) está intacto e a cascata NÃO o contraria: ela é UPDATE sobre a TABELA, e o docblock novo argumenta explicitamente contra a alternativa que o violaria (selecionar status pela visão e cancelar a lista).`
- `[T10] SEGURANÇA — os quatro pontos do UPDATE em massa conferidos pelo TR contra a migração: nenhum WHERE empresa_id escrito à mão (nem na porta nem nos dois helpers de teste, que declaram a ausência como decisão), e quem recorta é a política forçada, cuja existência ele verificou linha a linha (0009:124 habilita RLS, 0010:66 força, 0010:68 cria a política); o contratoId é o UUID da linha que cancelarContrato acabou de alcançar SOB RLS, nunca identificador do cliente; a FK composta (0009:136) torna irrepresentável a cobrança de outra empresa; e a contagem NÃO PODE vazar porque o manipulador segue anotado Promise<Contrato> — publicar o objeto inteiro não compila. "A fronteira está no compilador."`
- `[T10] o PADRÃO DO UPDATE imitou o molde da T7 com uma ASSIMETRIA DELIBERADA e bem argumentada: cancelarCobranca (linha única) grava SET cancelado_em = now() SEM o predicado, porque ali repetir tem de INFORMAR via 422; a cascata usa o predicado porque ali repetir tem de ser SILENCIOSO. O docblock novo explica a assimetria em vez de a esconder.`
- `[T10] a COLOCAÇÃO de ResultadoDoCancelamento fora de @sysloc/contracts foi julgada CORRETA, e o contraste prova o critério: AtivacaoDeContrato vive no pacote porque É o corpo publicado (o esquema estende esquemaDoContrato com efeitos); ResultadoDoCancelamento não é corpo de nada — a resposta do cancelamento é o contrato no root, sem declaração de efeito, o que conforma a ADR-0017. Publicá-lo criaria contrato de API sem fonte no PRD.`
- `[T10] os DOIS arquivos fora da §5.2 NÃO são scope_deviation, e o TR foi enfático: "os dois são FORÇADOS pelo trabalho declarado, sem margem de escolha" — o controlador é o único chamador de um método cuja assinatura mudou (sem ele não compila) E é onde vive o logger que o 10º critério da §4 cobra nominalmente; o unidade-de-trabalho.spec.ts afirma o conjunto exportado por IGUALDADE. "O que houve foi lacuna da §5.2 da task, não desvio do executor."`
- `[T10] o TR verificou as duas mudanças em arranjo COMPARTILHADO e as declarou acréscimo puro: TELA:financeiro entra em CHAVES_DO_ARRANJO e NENHUM caso do arquivo afirma o conjunto de telas por igualdade — as cinco asserções sobre telas são todas toContain (linhas 1323, 1326, 2416, 2818, 2909) —, de modo que o acréscimo não pode ter afrouxado nada.`
- `[T10] ⚠️ ALARME DO TR REFUTADO POR MEDIÇÃO MINHA. Ele registrou que "o CLAUDE.md ainda lista o D28 (F2/T7)" e que seria linha de índice órfã. É FALSO POSITIVO, e cai exatamente na armadilha que o próprio CLAUDE.md adverte: a linha 441 da tabela é "| **D28** (F0/T5) |", cujo marcador existe em 24 arquivos (grep "D28 · F0/T5"); o "D28 · F2/T7" tem ZERO ocorrências (a T9 o fechou corretamente) e NÃO tem linha de tabela alguma. As duas menções a "F2/T7" no CLAUDE.md são PROSA — a linha 69 na seção de estado e a 405 no parágrafo dos fechados, que é exatamente onde a §3-B manda a nota de fecho ir, "sem a forma do índice". Nada a corrigir. Segunda vez neste run que um agente tropeça na homonímia dos dois D28 — o que valida a advertência da §3-B em vez de contrariá-la.`
- `[T10] PRÉ-EXISTENTE registrado pelo TR sem virar achado: as duas linhas de trilha do cancelamento são emitidas DENTRO do callback da unidade de trabalho, então uma falha no commit deixaria registrado evento de transação desfeita. A T10 seguiu o molde que a F2/T8 instalou na primeira linha — não é regressão dela, e mudar agora seria a Proibição 5 do protocolo.`
- `[T10] débitos anotados: D35 (QA, baixo documentation), D36 (QA+TR, baixo documentation — as citações de ADR-0019; MESMO achado pelos dois gates, um único bloco), D37 (QA, baixo documentation), D38 (TR, BAIXO testability). Próximo livre: D39.`
- `[T10] ledger: não criado — rodada 1 aprovada nos dois gates sem rejeição.`

### T11 — pré-execução
- `[T11] base_sha=fb9391532190d4fa90a452849e213ede32404605` (HEAD não se moveu; T2..T10 staged sem commit)
- `[T11] executor: opus (declarado) · gates: [qa, tech_review] (declarado) · risk: HIGH — a task audita a fronteira de autorização INTEIRA da fatia, e não escreve produção · diff_touches_critical_path=true (auth/security)`
- `[T11] ADRs injetadas no executor: ADR-0011, ADR-0018, ADR-0021, ADR-0017, ADR-0013 (fonte: task §7)`
- `[T11] baseline repassada: 832 casos (contracts 227 · shared 212 · api 173 · auth 89 · db 115 · worker 16). Medição POR PACOTE.`
- `[T11] ⚠️ o card do CT-533 diz que a âncora "sobe de 75 para 82" — linguagem do tempo de planejamento. As âncoras JÁ SUBIRAM incrementalmente (T5 75→78, T6 78→80, T7 80→82; manipuladores 60→63→65→67), e esta task CONFERE, não altera. A §3.4 é explícita: "se algo aqui precisar mexer numa âncora, é sinal de que uma das três tasks anteriores errou a contagem, e a correção pertence à causa". Repassado com a correção.`
- `[T11] ⚠️ repassado também o aviso de não "corrigir" 82 para 89: o módulo de cobertura SUPRIME o HEAD derivado, então sete rotas somam SETE pares, não catorze. O docblock de ROTAS_PUBLICADAS_EM_PRODUCAO registra por que a âncora anterior era 75 e não 77, e a razão continua valendo.`
- `[T11] executor concluiu. Arquivos: 0 criados, 3 modificados. Baseline 832 → 834 (api 173 → 175; as outras cinco idênticas). pnpm build e pnpm lint verdes.`
- `[T11] ⚠️ o executor marcou a tasks/T11.md como "Concluído"; o ORQUESTRADOR reverteu para "Em Progresso", porque os dois gates NÃO rodaram. O status é o marcador que o Passo 4.0.1 usa para detectar execução interrompida — deixá-lo em Concluído esconderia a T11 do resume.`
- `[T11] a DUPLA MEDIÇÃO CONCORDOU, e é o entregável central: peloRoteador (tabela do roteador montado) = 82; pelaComposicao (varredura dos decoradores: (67−1) manipulador @All + 7 verbos do encaminhador + 9 pares registrados direto no adaptador) = 82; manipuladores = 67. As quatro grandezas viajam numa comparação só, então divergência reprova nomeando os dois números. NENHUMA âncora foi tocada.`
- `[T11] três mutantes medidos e revertidos (diff -q e sha256sum idênticos): MT11-1 @ExigeChaves(TELA:financeiro, ACAO:emitir_boleto) no pagamento → 9 failed (CT-533 na igualdade de objeto e CT-534 no controle positivo); MT11-2 o mesmo com a expectativa "corrigida" → só a asserção de AUSÊNCIA reprova, e NOMEIA a chave ("CobrancaController.acusarPagamento exige ACAO:emitir_boleto") — é a prova de que a asserção nomeia em vez de só negar; MT11-3 exigência tirada da classe do MoraController e posta só no @Get() → 14 failed, com semDeclaracao nomeando PUT /v1/multa-e-juros.`
- `[T11] ponto de atenção declarado para o Gate 2: o único trecho PREEXISTENTE alterado é a assinatura de pessoaOperandoComSenhaTrocada em autorizacao-do-dominio.e2e.spec.ts, que ganhou parâmetro OPCIONAL de perfil com 'USUARIO_EMPRESA' como padrão (nenhum chamador anterior muda de comportamento), mais o campo perfil na interface local SessaoPublicada. catalogo-de-permissoes.ts continua NÃO TOCADO pela fatia.`
- `[T11] achado colateral legítimo registrado pelo executor: o CT-534 revelou uma consequência da RN-02 — retirar TELA:financeiro de um ADMIN_EMPRESA exige retirar junto ACAO:emitir_boleto e ACAO:solicitar_baixa_de_boleto, senão validarCoerenciaDeAjustes recusa o conjunto. É a regra de domínio funcionando, e está documentada no ponto do caso.`

---

## ⏸️ PAUSA DO RUN — 2026-08-10 (segunda pausa), a pedido do usuário

**Ponto exato de parada**: o **executor da T11 concluiu**; os **dois gates da T11 ainda NÃO rodaram**.
É o mesmo ponto de parada da primeira pausa, uma task adiante — e a primeira pausa foi retomada com
sucesso pelo caminho **(a) "Retomar nos gates"**, que é o correto aqui também.

### Estado

- **T2 a T10 — CONCLUÍDAS**, aprovadas nos dois gates e **staged** (`git add`, sem commit). São **nove**.
- **T11 — `Em Progresso`**: código escrito e no working tree, **sem QA e sem Tech Review**. Nada perdido
  (a task só **modificou** dois arquivos de teste; não há arquivo novo/untracked, logo nem `git add -N`
  é necessário).
- **T1 — `A Fazer`, DIFERIDA POR DECISÃO**: exige `sudo` com senha interativa e o site efêmero do
  `/opt/frappe` de pé. Nenhum subagente a executa, e **nada na fatia depende dela**. É execução
  conduzida pelo operador.
- **Nada foi commitado.** O HEAD segue em `fb9391532190d4fa90a452849e213ede32404605` desde o começo do run.

### Como retomar

Reinvoque a mesma skill com os mesmos argumentos:

```
/agent-spec-sdd-run-tasks docs/specs/features/cobranca-e-mora/v1/task_plan.md sysloc-backend-implementer
```

O Passo 4.0.1 (*Resume pós-interrupção*) vai detectar a **T11 em `Em Progresso`** e oferecer três
caminhos. **O correto é (a) "Retomar nos gates"** — o código está íntegro, e reexecutar do zero
descartaria trabalho bom. O `base_sha` da T11 é `fb9391532190d4fa90a452849e213ede32404605`.

### O que os gates da T11 precisam receber

**1. Sumário do executor, inline:**

```
✅ T11 — Cobertura de autorização das sete rotas novas e as âncoras finais da superfície
Arquivos: 0 criados, 3 modificados
Testes: 2/2 implementados (Vitest) — CT-533 e CT-534
Garantias removidas: nenhuma
Pendências: nenhuma
```

**2. A baseline do P1/P5: `832` casos** ao começar a T11 — `@sysloc/contracts` 227 · `@sysloc/shared`
212 · `@sysloc/api` 173 · `@sysloc/auth` 89 · `@sysloc/db` 115 · `@sysloc/worker` 16. O executor
declara **834** ao fim (api 173 → 175). **Medir POR PACOTE** — o `turbo run test` aborta os irmãos.

**3. O marcador do estado ao fim da T10**, para o Gate 2 revisar só o delta da T11 em vez de T2..T11
somadas: **`t10_sha` = `469a6a032e2d12069ee0764bd64b2797c5ff7f19`**. Delta da T11 sobre
`apps`/`packages`: **2 arquivos, +1042/−5** — e, com a escrituração desta pausa já staged, ele isola
**exatamente** os dois arquivos da T11, sem ruído nenhum. Conferido: `git diff --name-only <marcador>`
devolve **só** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` e
`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`.

> ⚠️ **O marcador é um commit solto, sem referência de branch** — o `git gc` pode podá-lo se a pausa
> for longa. Se `git cat-file -e 469a6a03…` falhar na retomada, **recrie-o**, que é barato e
> determinístico enquanto nada for commitado nem staged:
>
> ```bash
> TMP_IDX=$(mktemp); cp "$(git rev-parse --git-path index)" "$TMP_IDX"
> tree=$(GIT_INDEX_FILE="$TMP_IDX" git write-tree)
> t10_sha=$(git commit-tree "$tree" -p HEAD -m "estado ao fim da T10")
> rm -f "$TMP_IDX"
> ```
>
> O índice hoje contém exatamente T2..T10; a T11 está **só** no working tree. Se a T11 vier a ser
> staged antes da recriação, o marcador deixa de ser recuperável por este caminho — **não faça
> `git add` da T11 antes dos gates**.

**4. O que auditar com rigor**, e que o próprio executor sinalizou:
- o **único trecho preexistente alterado** é a assinatura de `pessoaOperandoComSenhaTrocada` em
  `autorizacao-do-dominio.e2e.spec.ts`, que ganhou parâmetro **opcional** de perfil com
  `'USUARIO_EMPRESA'` como padrão — verificar que **nenhum chamador anterior** muda de comportamento;
- os **dois arquivos são suítes canônicas de autorização herdadas da F1**, e provam invariantes de
  **outras** fatias: a T11 deve ter **acrescentado** casos sem reorganizar nem afrouxar asserção alheia;
- **`packages/auth/src/catalogo-de-permissoes.ts` não tocado** pela fatia inteira (critério 7 da §4);
- os **três mutantes** declarados (`MT11-1`, `MT11-2`, `MT11-3`) — o **MT11-2** é o que importa, porque
  prova que a asserção **nomeia** a chave em vez de só negar a presença dela.

### O que falta para fechar a fatia, depois dos gates da T11

1. **Gates da T11** (QA → Tech Review) e o stage dela.
2. **Critérios de Conclusão Geral (§7 do `task_plan.md`)** — validar e marcar. Atenção a três que
   exigem medição e não estão feitos: a contagem final da suíte contra a baseline de 687; a conferência
   de que os **17 critérios de aceite do PRD** têm caso rastreado; e o `verificar-golden.sh` afirmando
   **10** artefatos (que depende da **T1**, não executada).
3. **A T1**, conduzida pelo operador com `sudo` e o site efêmero do `/opt/frappe` de pé. Enquanto ela
   não rodar, a fatia fica em **10/11** e o `task_plan.md` **não** deve ir a `Concluído`.
4. **Fechamento de fatia — a checagem dos DOIS SENTIDOS da §3-B** (`.claude/rules/nao-regressao.md`):
   marcador → registro e índice → marcador. Já foi conferida pelos gates da T9 e da T10 e estava
   fechada; **refazer ao final**, porque a T11 não emite marcador mas o fecho é da fatia.
5. **Decidir o que fazer com os 38 débitos** anotados na §2. O parecer registrado nas fatias anteriores
   é **NÃO** rodar `/agent-spec-debt-resolution` em massa — o default `gates: [qa]` dela desliga o
   Gate 2, que é quem detecta violação de `DECISÃO FECHADA`. ⚠️ **Três débitos desta fatia pedem
   decisão do usuário, não cleanup**: o **D15** (o `strictObject` no esquema de saída, que alcança o
   documento OpenAPI publicado e portanto o handoff), o **D19** (a visão `cobranca_derivada` sem âncora
   de conjunto exato) e o **D20** (a janela em que a emenda da `0010` deixa de ser legítima).

---

## ▶️ RETOMADA DO RUN — 2026-08-10 (segunda retomada)

- `[run] resume: caminho (a) "Retomar nos gates" — origem: pré-decidido no bloco de pausa e no CLAUDE.md, confirmado pelo estado do working tree. Nenhum AskUserQuestion disparado (ver autorização permanente abaixo).`
- `[run] substrato conferido na retomada: t10_sha=469a6a032e2d12069ee0764bd64b2797c5ff7f19 VIVO (git cat-file -e); delta sobre ele = os DOIS arquivos de teste da T11 (+1042/−5 sobre apps/packages) mais o próprio workflow-report.md (a escrituração da pausa, que foi anexada DEPOIS da criação do marcador — é prosa de telemetria, não código); _run/tmp/ vazio (nenhuma memória lazy stale); docs/specs/**/_run/tmp/ no .gitignore (linha 45).`
- `[run] ⚠️ AUTORIZAÇÃO PERMANENTE DO USUÁRIO, declarada na retomada e válida até o fim do run (todas as tasks): (1) NENHUMA pausa para pergunta — toda escalada que normalmente iria a AskUserQuestion assume a opção RECOMENDADA e segue, sem aguardar resposta; (2) o LIMITE DE 3 TENTATIVAS por task fica SUSPENSO — o Passo 10 (Bloqueado + escalar) não se aplica, e o loop de correção prossegue quantas rodadas forem necessárias até não restar bloqueante. Isto NÃO afrouxa nenhum gate: os critérios de aprovação seguem idênticos, e o Protocolo Antirregressão continua valendo com força máxima em cada rodada de correção.`
- `[T11] base_sha=fb9391532190d4fa90a452849e213ede32404605 (reconfirmado — HEAD não se moveu; índice segue T2..T10)`
- `[T11] Gate 1 (QA) despachado na retomada: qa_model=opus (rule: diff_touches_critical_path=auth/security AND task_risk=high). Sumário do executor e baseline por pacote repassados inline; scan_scope=FULL (rodada 1 dos gates — o executor não teve rejeição).`
- `[T11] QA (Gate 1): APROVADO_COM_OBSERVACOES — 13/13 critérios, 2/2 CTs rastreados, 0 bloqueantes, 2 BAIXO (BAIXO-001 dead_code: campo contratoCodigo devolvido e nunca consumido; BAIXO-002 code_quality: três asserções do CT-534 logicamente implicadas por asserções anteriores). Ambos anotáveis pela partição → D39 e D40. Próximo livre: D41.`
- `[T11] suíte medida POR PACOTE pelo QA: contracts 227 · shared 212 · api 175 · auth 89 · db 115 · worker 16 = 834. Baseline 832 → 834, +2 no api explicados (CT-533 e CT-534). NENHUMA unidade encolheu. build e lint verdes. O flake CT-907 NÃO se manifestou (23/23 arquivos verdes no api, em DUAS execuções completas); rm -rf /tmp/sysloc-banco-* rodado antes de cada pacote e nenhum ENOSPC com disco em 93%.`
- `[T11] AP-24 auditado UMA A UMA: 1042 inserções contra apenas 5 remoções, todas classificadas pelo QA — 2 linhas de import substituídas por versões que ACRESCENTAM símbolo, a assinatura de pessoaOperandoComSenhaTrocada, o literal 'USUARIO_EMPRESA' virando variável, e 1 linha de docblock expandida em bloco maior. NENHUMA asserção removida, NENHUM caso removido, ZERO skip/only/todo, NENHUMA âncora tocada.`
- `[T11] ponto 1 da auditoria dirigida FECHADO: os TRÊS chamadores anteriores de pessoaOperandoComSenhaTrocada (linhas 589, 673, 754) seguem passando um argumento só e recebem exatamente o literal que estava lá antes — nenhum muda de comportamento. O campo perfil na interface local NÃO é decorativo: ele AFIRMA que os dois sujeitos do eixo de indistinguibilidade têm perfis distintos; sem ele o passo 7 compararia duas sessões do mesmo perfil e não provaria nada.`
- `[T11] ponto 3 FECHADO por dupla via: packages/auth/src/catalogo-de-permissoes.ts não aparece no git diff da fatia e o último commit que o tocou é 11c33ad, anterior a ela; e o CT-533 compara CHAVES_DE_TELA e MAPA_ACAO_TELA contra listas escritas à mão.`
- `[T11] ponto 4 — MT11-2 REPRODUZIDO pelo QA e conclusivo: com a expectativa "corrigida" para acomodar o mutante, a igualdade de objeto PASSA e reprova SÓ a asserção de ausência, NOMEANDO o culpado ("CobrancaController.acusarPagamento exige ACAO:emitir_boleto"). Na suíte do pacote: 9 failed | 166 passed. Restauração PROVADA por diff -q silencioso e sha256sum idênticos nos dois fontes, com reexecução verde (175/175) depois.`
- `[T11] QUALIDADE DE ASSERÇÃO destacada pelo QA: as expectativas do CT-533 são literais ESCRITOS À MÃO, não derivados das constantes que o SUT usa para declarar — sem isso a auditoria concordaria consigo mesma. E as duas medições são independentes de verdade: uma lê a tabela do roteador montado, a outra compõe (67−1) + 1×7 + 9 = 82 varrendo decoradores.`
- `[T11] ADR-0021: o QA abriu a Decision INTEGRAL do texto vigente COM a emenda da T7 e confirmou que ela nomeia "acusar pagamento de cobrança" e "cancelar cobrança" na SEGUNDA classe — a que exige só a área. As sete rotas estão em conformidade e o CT-533 congela a classificação. Envelope do CT-534 confere com a ADR-0017.`
- `[T11] antipadroes_verificados: 2/2 arquivos de teste, 17 APs por arquivo, nenhum detectado — declaração COMPLETA.`
- `[T11] ledger: não criado — rodada 1 aprovada sem rejeição.`
- `[T11] rule_candidates: 2 sinais persistidos (qa=2: repeated_assertion_shape do envelope inteiro; repeated_fixture do sujeito montado pelo caminho real). Total do run: 26.`
- `[T11] TR consultou: ADR-0011, ADR-0013, ADR-0017, ADR-0018, ADR-0021 — as cinco com a Decision integral aberta, e a 0021 no texto VIGENTE com a emenda da T7.`
- `[T11] Tech Review (Gate 2): APROVADO_COM_OBSERVACOES — 0 bloqueantes, 3 BAIXO (todos code_quality: P1 as duas linhas que dizem "pelo caminho real de administração" quando o arranjo escreve pela função de domínio que a rota do Admin usa por dentro; P2 quatro asserções do CT-533 implicadas por outras mais fortes do CT-213; P3 o nome literal "Pessoa Que Só Administra Cadastros" passou a mentir quando o perfil é ADMIN_EMPRESA). rule_candidates_emitidos vazio.`
- `[T11] MARCADORES conferidos nominalmente pelo TR: nenhum DECISÃO FECHADA alterado, movido, esvaziado ou reclassificado. Os DOIS marcadores DÉBITO COM GATILHO — D28 · F0/T5 (cobertura :277-286 e autorizacao-do-dominio :243-252) chegaram ÍNTEGROS, com os quatro campos, o ÍNDICE e a linha que declara que NÃO são DECISÃO FECHADA — natureza preservada.`
- `[T11] CRITÉRIO 12 (nenhuma âncora alterada) FECHADO: ROTAS_PUBLICADAS_EM_PRODUCAO = 82 e MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 67 aparecem SÓ como linhas de contexto no diff. O docblock acumulado com as linhas SUT_IS_CORRECT_BECAUSE: de T5/T6/T7 chegou intacto; a T11 acrescentou constantes NOVAS abaixo dele sem tocar as existentes. E a T11 não acrescentou nenhuma linha SUT_IS_CORRECT_BECAUSE:, o que é coerente com task que só ACRESCENTA casos.`
- `[T11] GARANTIA REMOVIDA: declaração "nenhuma" CONFIRMADA por apuração INDEPENDENTE do TR — exatamente 5 remoções, nenhuma retirando validação, guarda, timeout, tratamento de erro, liberação de recurso ou redação de segredo. Concordância com o Gate 1 obtida sem consultá-lo.`
- `[T11] CRITÉRIO 7 conferido pelo TR contra o base_sha (mais forte que contra o t10_sha): git diff fb93915 --stat -- packages/auth/ volta VAZIO. O pacote @sysloc/auth INTEIRO está intocado pela fatia — o catálogo fechado não foi aberto.`
- `[T11] SEAM (Iron Law #6) sem violação: CHAVES_DE_TELA e MAPA_ACAO_TELA NÃO foram exportados para servir a este teste — já eram exportados antes da fatia e têm consumidores de PRODUÇÃO (sessao.controller.ts:55,104 e usuario.controller.ts:84,293, que derivam o enum do esquema publicado deles). Nenhum símbolo de produção nasceu nesta task.`
- `[T11] item 1 (mudança de assinatura) julgado NECESSÁRIO E MÍNIMO pelo TR, com a razão que o Gate 1 não alcançou: a alternativa — acessório separado — duplicaria o fluxo de admissão de QUATRO passos, cujo terceiro é CARGA-PORTANTE (sem a troca de senha a sessão fica RESTRITA pela RN-09 e o 403 observado viria da restrição, não da autorização). Duas cópias divergiriam; o parâmetro com padrão é o risco menor.`
- `[T11] item 3b — INDEPENDÊNCIA DAS DUAS MEDIÇÕES CONFIRMADA por leitura das duas fontes: a primeira sai de printRoutes() do adaptador Fastify (cobertura-de-autorizacao.ts:241-254); a segunda de DiscoveryService/MetadataScanner sobre o ModulesContainer, mais dois inventários literais escritos à mão. NENHUM termo da composição é lido do objeto cobertura, e o fator @All é MEDIDO com METHOD_METADATA comparado a RequestMethod.ALL em vez de suposto. A capacidade que mediu 75 onde a spec anterior estimava 77 está preservada.`
- `[T11] SEGURANÇA: nenhuma sessão forjada e versao_permissoes NUNCA escrita à mão. Os quatro sujeitos nascem por POST /v1/usuarios, entram com senha provisória e cumprem a troca obrigatória; o cookie é sempre o que a borda emitiu. O ajuste passa por escreverAjustes com validarCoerenciaDeAjustes — a mesma função que a rota do Admin invoca —, com o contador de versão incrementado na mesma transação. O efetivo é AFIRMADO por GET /v1/sessao antes de qualquer conclusão, inclusive a diferença de perfil entre os dois sujeitos do eixo de indistinguibilidade.`
- `[T11] PLACEMENT julgado CORRETO nos dois casos: o CT-534 é route-integration de borda real (HTTP em porta dinâmica, Postgres efêmero, leitura crua de xmin) e mora ao lado do CT-320, que exercita o mesmo eixo; o CT-533 é asserção estática de metadado e mora no arquivo cuja finalidade declarada é exatamente essa (CT-213, CT-355, CT-427, todos estáticos), com os três mutantes invocados pelo SCRIPT DO PACOTE e não por vitest avulso, como a testing-stack.md exige.`
- `[T11] débitos anotados: D39 (QA, baixo dead_code), D40 (QA, baixo code_quality), D41 (TR, BAIXO code_quality), D42 (TR, BAIXO code_quality), D43 (TR, BAIXO code_quality). Próximo livre: D44.`
- `[T11] ledger: não criado — rodada 1 aprovada nos DOIS gates sem rejeição. Nenhuma memória lazy a apagar.`
- `[T11] staged: apps/api/test/cobertura-de-autorizacao.e2e.spec.ts, apps/api/test/autorizacao-do-dominio.e2e.spec.ts, docs/specs/features/cobranca-e-mora/v1/tasks/T11.md`

### Fechamento do run — conferências do orquestrador (2026-08-10)

- `[run] SUÍTE FINAL medida por MIM, por pacote, sobre a árvore com a T11 staged: contracts 227 · shared 212 · api 175 · auth 89 · db 115 · worker 16 = 834. Todos os 61 arquivos de teste verdes. Confirma a medição do Gate 1 de forma independente. Baseline da fatia: 687 → 834 (+147), crescimento monotônico.`
- `[run] pnpm build: 6/6 pacotes. pnpm lint: biome 214 arquivos sem correção pendente, shellcheck --severity=error limpo sobre deploy/scripts. O "No tasks were executed" do turbo run lint é ESTRUTURAL e pré-existente — nenhum dos 6 pacotes declara script lint próprio; o lint real é o biome da raiz, que rodou.`
- `[run] §3-B CHECAGEM DOS DOIS SENTIDOS — FECHA em 12 ↔ 12. Sentido 1 (marcador → índice): 12 pares distintos vivos no código, D28·F0/T5 (22 arquivos), D32·F0/T6, D23·F1/T8, D39·F1/fechamento, D24·F1/T5, D27·F1/T6, D37·F1/T8, D3·F2/T1, D36·F2/T8, D44·F2/T10, D1·F3/T2, D26·F3/T8. Sentido 2 (índice → marcador): as 12 linhas da tabela do CLAUDE.md (453-464) casam uma a uma. ⚠️ As ocorrências extras do grep ("D99 · F7/T3", "D99 sem origem", "sem identificador", a própria regex) são FIXTURES da barreira executável do protocolo em packages/shared/test/protocolo-antirregressao.spec.ts — não são marcadores. A T11 não emitiu marcador algum.`
- `[run] CRITÉRIOS DE CONCLUSÃO DA FEATURE: 10 dos 13 satisfeitos e conferidos um a um no task_plan.md §7. Os TRÊS abertos dependem EXCLUSIVAMENTE da T1 — as 11 tasks (10/11), o verificar-golden.sh afirmando 10 artefatos (afirma 9; o 10º é o regua-de-cobranca.json que a T1 produz) e o PROCEDENCIA.md declarando o nível da ordem de queda. Nenhum depende de trabalho das outras dez.`
- `[run] ⚠️ ACHADO PRÉ-EXISTENTE, NÃO REGRESSÃO: o CT-013 do verificar-golden.sh REPROVA. Provado pré-existente por execução do verificador num WORKTREE LIMPO em fb93915 (o base_sha), onde ele reprova IDÊNTICO — e com MAIS ocorrências (13 contra 7), porque o worktree limpo não tem os arquivos novos da fatia. Os três arquivos apontados (packages/auth/test/senha.spec.ts, packages/db/src/pessoa.ts, packages/db/src/semente.ts) são INTOCADOS pela fatia — git diff fb93915 sobre cada um volta vazio. Causa provável: colisão de agulha, não vazamento — o próprio script documenta que a credencial do ambiente legado é "uma palavra de dicionário de 5 caracteres", e o casamento é por token sobre a árvore versionada inteira. Registrado conforme o P1 do protocolo ("baseline vermelha é informação, não obstáculo") e NÃO incluído no conserto, por não ser causa-raiz de nada desta fatia.`
- `[run] T1 — TENTATIVA DE EXECUÇÃO AVALIADA E DESCARTADA por impossibilidade técnica, não por falta de autorização (o usuário suspendeu as pausas neste run). Três fatos: (1) sudo -n recusa com "a password is required", e senha interativa não é fornecível por agente; (2) a §7 da própria tasks/T1.md declara textualmente "A execução exige sudo e o site efêmero de pé, e nenhum subagente a conduz"; (3) RISCO AO AMBIENTE DE PRODUÇÃO — o preparar-site-efemero.sh roda "bench --site frontend backup" na PRODUÇÃO e restaura o dump num site efêmero, com o disco do host em 94% e 2,0 GB livres; um ENOSPC ali atinge o site frontend, que atende a operação. O docker É acessível sem sudo e o stack está de pé, então o bloqueio é o (1) somado ao (3).`
- `[run] rule_candidates: 26 sinais persistidos em docs/specs/features/cobranca-e-mora/v1/_run/rule-candidates.md (qa=?, staff=?, orquestrador=? — a contagem por origem está distribuída ao longo do run).`
- `[run] FIM DO RUN. Nada commitado: o HEAD segue em fb9391532190d4fa90a452849e213ede32404605 e T2..T11 estão STAGED aguardando a decisão do usuário sobre o agrupamento dos commits.`

---

## Run de 2026-08-10 (retomada) — a T1

[run] executor resolvido: sysloc-backend-implementer (origem: argumento explícito)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[run] resume: nenhum sinal de interrupção — tmp/ vazio, working tree limpo, T1 em `A Fazer`
[run] cleanup idempotente: `_run/tmp/` já vazio, nada a expirar

### T1 — premissa de bloqueio refutada antes do disparo

A §7 da T1 e o índice do `CLAUDE.md` declaravam que a task exige `sudo` com senha interativa e que
**nenhum subagente a conduz**. Medido antes de disparar:

- `grep -n sudo` nos 4 arquivos de `deploy/scripts/caracterizacao/` (4.623 linhas) → **vazio**.
  Todo acesso ao `/opt/frappe` passa por `docker compose`.
- o usuário do host pertence ao grupo `docker` (990); `bench --site caracterizacao.localhost
  list-apps` executou no container **sem elevação**, confirmando que o site efêmero não existe
  (destruído ao fim da fatia anterior, como o ciclo de vida manda).
- a exigência de `sudo` da `.claude/rules/testing-stack.md` é **verdadeira para
  `deploy/scripts/instalacao/`**, que toca o SO — foi generalizada indevidamente para esta frente.
- disco: 1,9 GB livres contra ~200 MB de custo da restauração (o dump é 8,8 MB comprimido).
  O alerta de 94% do `CLAUDE.md` é real e não aperta esta captura.

Escalado ao usuário via `AskUserQuestion` por contrariar decisão registrada em spec. Decidido:
**pipeline normal com o `sysloc-backend-implementer` pelos dois gates**, e `bench --site frontend
backup` confirmado como o previsto pela ADR-0006. A §7 da task foi corrigida no mesmo passo,
nomeando a frente em vez do host.

[T1] ADRs injetadas no executor: ADR-0006, ADR-0005 (fonte: task §7)
[T1] base_sha=63381ce6c525f09c5e6cfcce380e409437149fe1
[run] rule_candidates: 2 sinais persistidos (qa=2, staff=0, orquestrador=0)
[T1] gates: [qa, tech_review] (declarado) · executor: opus (declarado) · risk: medium · critical_path: false
[T1] QA: APROVADO_COM_OBSERVACOES — 11/11 critérios, 3/3 CTs rastreados, 0 bloqueantes, 2 baixos (tests/magic_strings, documentation)
[T1] antipadroes_verificados: 2/2 arquivos de teste declarados (verificar-golden.sh, verificar-captura.sh) — completo
[T1] TR consultou: ADR-0006, ADR-0005
[T1] Tech Review: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 1 baixo (code_quality)
[T1] ledger: memória lazy nunca nasceu (rodada única, sem rejeição) — métrica não aplicável
[T1] staged: golden/regua-de-cobranca.json, golden/PROCEDENCIA.md, capturar.py, verificar-golden.sh, verificar-captura.sh, tasks/T1.md
[T1] observações do TR: ADR-0006 conforme (nenhum caminho novo escreve no site `frontend`; as 3 referências
     ao site de produção estão todas em `preparar-site-efemero.sh`, arquivo INTOCADO); ADR-0005 conforme
     (zero `set -x`/`--password`/`PGPASSWORD=` em `caracterizacao/`); segurança do artefato versionado
     VERIFICADA e limpa (zero CPF/CNPJ/telefone/data-BR real; único e-mail é `locatario@caracterizacao.invalid`,
     sob TLD reservado pela RFC 2606; a `carteira_herdada` traz 13 registros todos com prefixo `COB-CARACT-*`,
     porque `purgar_dados_de_negocio()` roda como PRIMEIRA operação de `main()`); Protocolo Antirregressão
     conferido de forma independente — zero marcadores `DECISÃO FECHADA`/`DÉBITO COM GATILHO` no diff, as 13
     linhas removidas de `capturar.py` são todas prosa, declaração `Garantias removidas: nenhuma` CONFIRMADA;
     AP-24 nada a reportar; `afirmar_diferente` julgado restauração de conformidade, não símbolo novo
     (consta nominalmente da `testing-stack.md`); item (d) do executor julgado ruído de execução fora do
     fluxo canônico, não risco de determinismo.

[run] FIM DO RUN — 11/11 tasks concluídas, 0 bloqueadas, 3 débitos anotáveis novos (D44, D45, D46).
[run] rule_candidates: 2 sinais persistidos no total deste run (qa=2, staff=0, orquestrador=0).
