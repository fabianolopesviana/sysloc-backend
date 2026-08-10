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
