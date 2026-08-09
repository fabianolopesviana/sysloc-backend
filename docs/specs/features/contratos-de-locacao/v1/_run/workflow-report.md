# Workflow report — contratos-de-locacao/v1

> Telemetria de pipeline, append-only. O relatório humano é o `_run/run-report.md`.

## Challenge Session — 2026-08-08 (artifact: tech_spec.md)

- Questões processadas: 6 (5 com decisão do usuário, 1 resolvida por leitura do código)
- Conflitos de terminologia resolvidos: 2
  - `Contador sequencial` — o glossário canoniza o contador do boleto, que **nunca reinicia**; a fatia introduz o contador da série do contrato, que **reinicia a cada ano**. Dois conceitos incompatíveis sob o mesmo nome canônico.
  - `Carteira` — dois sentidos já em uso (a árvore conjunto→imóvel em `lerCarteira`/`carteira.e2e.spec.ts`; a lista de contratos no PRD), nenhum canonizado.
- Contradições com código real: 1 (**alta**)
  - `alterarImovel` (`packages/db/src/imovel.ts:624`) escreve `status_locacao` incondicionalmente, e o corpo de entrada não aceita `LOCADO` — toda alteração de imóvel locado apagaria o `LOCADO` em silêncio, produzindo `statusLocacao: 'DISPONIVEL'` ao lado de `contratoVigente` preenchido na mesma resposta.
- Divergências spec × ADR resolvidas: 1
  - A correção acima exige rota própria (ADR-0019), mas **não há ação sensível** para ela no catálogo fechado. Resolvido por decisão do usuário: a rota exige só `TELA:imoveis` e a **leitura fica declarada** em §4.1.2 como interpretação, não como conformidade literal. A saída rigorosa (emendar a `Decision` da ADR-0019) fica nomeada.
- Decisões implícitas explicitadas: 2
  - `INDISPONIVEL` **não** impede a ativação — o sistema antigo não confere `status_locacao` em `ativar_imovel_contrato`, e acrescentar a recusa seria condição de entrada nova, contra a RN-08. A assimetria com a rota de situação é intencional e ficou escrita.
  - A rota de §4.1.2 **não se mapeia a nenhuma US** — é trabalho de invariante, não de escopo novo. Declarado na §17 para não ser lido como overengineering.
- Inconsistências internas corrigidas: 2
  - §3.4 listava quatro arquivos de teste E2E que a §19 não conhece; reconciliado para `apps/api/test/contratos.e2e.spec.ts` mais as suítes estendidas.
  - §3.4 listava `contador-de-contrato.spec.ts`, que a §19 não usa (os casos do contador vivem em `contrato.spec.ts`); removido, e `papel-de-conexao.spec.ts` acrescentado como `[M]` por causa do CT-431.
- Termos canonizados no glossário: 7, todos no **global** (21 → 28 termos)
  - `Contrato de locação`, `Rascunho`, `Ativação de contrato`, `Cancelamento de contrato`, `Contrato vigente`, `Série declarada`, `Carteira`
  - `Contador sequencial` teve a definição **restringida** ao caso bancário
  - 5 ambiguidades acrescentadas; 7 relacionamentos acrescentados
  - Glossário-feature **não criado** — nasceria vazio, os sete termos são cross-feature
- Candidatos a ADR sinalizados: 1
  - *"Estado de negócio nunca é escrito por atualização do recurso — nem quando não há ação sensível para ele"* — **5/5 critérios**, registrado na §21 como **confirmado e adiado por decisão do usuário**. A saída certa não é ADR nova: é emendar a `Decision` da ADR-0019.
- ADRs sugeridos para criação: 0 (a emenda da 0019 foi oferecida e adiada)

### Impacto no artefato

- Ajustes inline: 17, em 11 seções (§3.4, §3.6, §4.1, §4.1.1, §4.1.2 nova, §4.2, §6.3, §11.2, §17, §19, §20, §21)
- Superfície publicada revisada: **9 rotas novas** (era 8) · manipuladores 51 → **60** · `rotasEnumeradas` 66 → **77**
- Casos de teste: 33 → **34** (CT-434, acréscimo do challenge)

### Divergência conhecida a reconciliar no task-plan

`_run/test-cases.json` tem **33** casos e a §19 do `tech_spec.md` tem **34** — o CT-434 nasceu nesta sessão e a skill de challenge **não pode escrever** naquele arquivo (guardrail: só o artefato, os dois glossários, este relatório e `steps.validation` do estado). O `agent-spec-sdd-generate-task-plan` deve tomar a **§19 do tech_spec como canônica** e acrescentar o CT-434 ao distribuir, ou re-disparar o gerador.

---

## Run de execução — 2026-08-08

- `[run] executor resolvido: sysloc-backend-implementer (origem: argumento explícito)`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] autorização do usuário (mensagem mid-turn): sem pausas — toda AskUserQuestion assume a opção recomendada; e SEM teto de 3 tentativas — o loop de correção prossegue até não haver bloqueante.`
- `[run] git verificado; _run/tmp/ já em .gitignore (linha 45); cleanup idempotente: nenhum arquivo stale.`
- `[run] resume pós-interrupção: nenhum sinal (todas as tasks 'A Fazer', sem _run/tmp/, working tree só com CLAUDE.md modificado).`
- `[run] T1: os scripts de deploy/scripts/caracterizacao/ NÃO usam sudo (grep = 0). A premissa da §7 da T1 e da §6 do task_plan ("exige sudo, nenhum subagente executa") é herdada da F0. Mesmo assim, a captura contra /opt/frappe (produção) é conduzida pelo ORQUESTRADOR, não por subagente — o executor recebe apenas a extensão de código.
[T1] base_sha=2347148479811037e6b728149693f1c9643566bd
[T1] ADRs injetadas no executor: ADR-0006, ADR-0005 (fonte: task §7)
[T1] scope_deviation revertido: deploy/scripts/roadmap/gancho-roadmap.sh (comentário sobre disponibilidade de jq — arquivo fora da §5.1/§5.2 da T1; Iron Rule #3)
[T1] precondição do CT-004 satisfeita: os 3 caminhos de golden/ (2 novos + PROCEDENCIA.md regerado) foram levados ao índice ANTES da reexecução do verificar-captura.sh. A asserção 'nenhum artefato aparece modificado em relação ao índice do git' é pré-existente e prova que a captura reproduz o que está versionado — untracked a fazia reprovar por ausência de precondição, não por defeito. Asserção NÃO afrouxada.
- `[T1] QA: APROVADO_COM_OBSERVACOES` — 2 médios (`tests`/`vague_existence_assertion` → anotáveis pela partição) + 3 baixos. **Zero bloqueantes; nenhuma rodada de correção aberta.**
- `[T1] antipadroes_verificados: 2/2 arquivos de teste declarados (verificar-golden.sh, verificar-captura.sh) — completo.`
- `[T1] Tech Review: APROVADO_COM_OBSERVACOES` — 3 baixos (`code_quality` ×2, `testability` ×1), todos anotáveis.
- `[T1] TR consultou: ADR-0005, ADR-0006`
- `[T1] ledger: memória lazy nunca criada (task aprovada na rodada 1, sem rejeição) — métrica não se aplica.`
- `[T1] observações do TR registradas: ADR-0006 aplicada inclusive como razão da NÃO-cobertura do ramo Sicoob; AP-24 varrido, nenhuma asserção removida ou afrouxada; PROCEDENCIA.md é GERADO do docstring do capturar.py (a duplicação aparente no diff é fonte+saída, não duas cópias).`
- `[T1] staged: capturar.py, verificar-captura.sh, verificar-golden.sh, golden/{PROCEDENCIA.md,contrato-ativacao.json,contrato-cancelamento.json}, tasks/T1.md`
- `[T1] a captura exigiu 3 rodadas do fluxo contra o /opt/frappe: (1) canônica, verde exceto CT-004 por precondição de índice; (2) sequência quebrada pelo orquestrador (verificar-captura.sh sem capturar.py antes) — 5 falhas, descartada; (3) canônica com índice satisfeito — 10/10, EXIT=0.`
- `[T2] base_sha=2347148479811037e6b728149693f1c9643566bd` (HEAD não se moveu — o stage da T1 não commita; o isolamento vem do filtro por paths)
- `[T2] ADRs injetadas no executor: ADR-0016, ADR-0017, ADR-0015, ADR-0019 (fonte: task §7)`
- `[T2] executor: opus (declarado) · gates: [qa, tech_review] · diff_touches_critical_path=true (api_contracts)`
- `[T2] QA: APROVADO_COM_OBSERVACOES` — 11/11 critérios; 1 médio (`code_quality`/`semantically_duplicated_test` → anotável) + 3 baixos. **Zero bloqueantes.** Suíte 541 → 615 (contracts 52 → 126; demais inalterados).
- `[T2] antipadroes_verificados: 1/1 arquivo de teste (esquemas.spec.ts) — completo.`
- `[T2] adjudicações do QA: (A) formato \d{5} exato CORRETO — a leitura do tech_spec (\d{5,}) é incompatível com o passo 5 do CT-428, que é exigência bloqueante; (B) MAIOR_PRAZO_EM_MESES pelo mínimo de duas capacidades PROCEDE — prazo_meses é integer; (C) .refine preserva ZodObject/shape, confirmado por execução — CT-336/CT-337 seguem alcançando o esquema (âncora subiu de 7 para 8 com SUT_IS_CORRECT_BECAUSE).`
- `[T2] Tech Review: APROVADO_COM_OBSERVACOES` — 3 baixos (`technical_requirement` ×2, `code_quality` ×1).
- `[T2] TR consultou: ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0019, ADR-0020`
- `[T2] observações do TR: concorda com o RESULTADO da adjudicação (A) mas FALSIFICOU a justificativa escrita no docblock — a largura seguiria presa por expect(formatarCodigoDeContrato(2026,1)).toBe('CTR-2026-00001'), independente do regex; razão falsa em docblock protetor é a matéria-prima da R3 que já derrubou o marcador de ESCALA_DA_METRAGEM neste mesmo pacote. Verificou no zod 4.4.3: .extend() PRESERVA o .refine conjunto e .omit() LANÇA em tempo de carga — a armadilha de derivação silenciosa em T5/T7 não existe.`
- `[T2] ledger: memória lazy nunca criada (aprovada na rodada 1) — métrica não se aplica.`
- `[T2] staged: packages/contracts/src/contrato.ts, src/index.ts, test/esquemas.spec.ts, tasks/T2.md`
- `[T3] base_sha=2347148479811037e6b728149693f1c9643566bd` (HEAD segue parado; isolamento por filtro de paths)
- `[T3] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0014, ADR-0015, ADR-0016, ADR-0020 (fonte: task §7)`
- `[T3] executor: opus (declarado) · risk=high · gates: [qa, tech_review] · diff_touches_critical_path=true (db_migrations + security)`
- `[T3] QA: APROVADO_COM_OBSERVACOES` — 10/10 critérios; 0 médios, 4 baixos. **Zero bloqueantes.** Suíte 615 → 619 (db 64 → 68).
- `[T3] antipadroes_verificados: 4/4 arquivos de teste — completo.`
- `[T3] dois arquivos fora da §5.2 avaliados e ACEITOS pelo QA: verificar-migracao.sh (obrigação declarada nas linhas 165-175 do próprio script) e unidade-de-trabalho.spec.ts (CT-012 é inventário EXATO; a igualdade toEqual NÃO foi afrouxada — só três entradas acrescentadas a SIMBOLOS_ESPERADOS). Ambos = "limpar a própria bagunça" (Iron Rule #3), não scope_deviation.`
- `[T3] AP-08 verificado empiricamente pelo QA: os 4 CTs rodados isolados por --testNamePattern saem 1 passed | 67 skipped; a pré-condição do CT-431 é montada DENTRO do caso e os anos são distintos (2026 vs 2027).`
- `[T3] migrações 0000-0006: git diff <base_sha> VAZIO — imutabilidade preservada. Expressão das políticas conferida CARACTERE A CARACTERE contra a 0006: idêntica.`
[T3] attempt_sha (rodada 1)=41e2d2319629d0c356db6297796e1874b4938dd2

### T3 — retry classification
- attempt: 1
- problemas_por_categoria: { project_pattern: 2, security: 1, technical_requirement: 1 }
- bloqueantes: P1 (ALTO/project_pattern), P2 (MEDIO/security — categoria bloqueante)
- overrides_ativos: [tocou_area_critica: true, task_risk: high, qa_security_flags: [], diff_stat_changed: true]
- requires_qa_revalidation: true
- decisao: RE-QA (Gate 1) e depois Gate 2
- justificativa: "P2 é `security`, categoria em revalidation_required; os overrides tocou_area_critica e task_risk=high forçariam true de qualquer forma"
- `[T3] QA rodada 2 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES` — TR-P1 e TR-P2 declarados SANADOS, ambos reproduzidos por mutante pelo próprio gate (mutante 1: guarda retirada de garantir_ → CT-406 reprova nomeando `contrato__11111111111141118111111111111111`; mutante 2: guarda retirada de proximo_ → CT-406 reprova por 42P01). 1 baixo novo (`error_handling`, anotável). Suíte 619 → 619, zero falhas.
- `[T3] a divergência do executor contra o revisor PROCEDE (verificada pelo QA): os snapshots NÃO são cópia byte a byte — diferem exatamente em {id, prevId}, e a cópia literal produziria dois snapshots com o mesmo prevId, colisão que validateWithReport aborta.`
- `[T3] attempt_sha (rodada 2)=519ad7bd40c6a3a2a321cac97e940428a550eb9b`
- `[T3] Tech Review rodada 2: PARCIAL` — 1 bloqueante (MEDIO/`testability`): TR-P1 fechou o CASO e não a CLASSE — nenhuma rede reprova a próxima migração autoral que ficar fora do `_journal.json`. TR-P2, TR-P3, TR-P4 e QA-B4 confirmados sanados.
- `[T3] o Tech Review RECONHECEU o próprio erro da rodada 1: a "cópia byte a byte" do snapshot que ele sugeriu era inferência a partir do tamanho igual; a cópia literal seria ATIVAMENTE DESTRUTIVA (bin.cjs:8221 aborta por colisão de prevId). Conduta do executor de falsificar a premissa do revisor antes de aplicar declarada exemplar, sem penalidade.`

### T3 — retry classification
- attempt: 2
- problemas_por_categoria: { testability: 1 }
- bloqueantes: P1 (MEDIO/testability — categoria bloqueante)
- overrides_ativos: [tocou_area_critica: true, task_risk: high]
- requires_qa_revalidation: true
- decisao: RE-QA (Gate 1) e depois Gate 2
- justificativa: "`testability` está em revalidation_required; a correção acrescenta caso de teste novo, que a Camada 7 precisa executar"
- `[T3] QA rodada 3 (DELTA): APROVADO_COM_OBSERVACOES` — TR-R2-P1 sanado, provado com 4 mutantes sobre o `_journal.json` real (dois deles autorais do QA). Suíte 619 → 621.
- `[T3] Tech Review rodada 3 (DELTA): APROVADO_COM_OBSERVACOES` — 1 baixo (`code_quality`). TR-R2-P1 declarado sanado **como classe**: a rede deriva `(idx, tag)` dos nomes do disco, então toda migração futura entra sozinha na cobertura.
- `[T3] TR consultou: ADR-0006` (as demais têm diff de 0 linhas no delta e já foram julgadas nas rodadas 1 e 2)
- `[T3] identificador RG-T3-01 ACEITO pelo Tech Review, com a decisão deferida pelo QA: a letra da testing-stack.md governa caso PLANEJADO (CA → CT); este caso parte de veredito de gate, não de CA. Precedente medido: 20 ocorrências de it('CT-… e um conjunto grande de casos auxiliares SEM identificador, inclusive pernas de falsificação. Um CT-4xx inventado seria estritamente pior.`
- `[T3] ledger: 12 achados totais | 4 originados em rodada >1 | 1 suspeito de incompletude da rodada 1 (TR-R2-P1 — a exigência de rede, cujo fingerprint aponta arquivo que não estava no delta da correção anterior)`
- `[T3] risco remanescente registrado pelo TR, sem achado: a rede guarda a coerência diretório ↔ _journal.json e NÃO alcança meta/{idx}_snapshot.json; e ela é hoje a ÚNICA guarda de uma convenção que nenhuma rule escreve — apagar o arquivo não quebra build, lint nem outro caso.`
- `[T3] staged: 0007_dominio_contrato.sql, 0008_seguranca_contrato.sql, meta/{0007,0008}_snapshot.json, meta/_journal.json, src/esquema/negocio.ts, test/{catalogo,isolamento,papel-de-conexao,unidade-de-trabalho,coerencia-de-migracoes}.spec.ts, deploy/scripts/instalacao/verificar-migracao.sh, tasks/T3.md`
- `[T4] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T4] ADRs injetadas no executor: ADR-0006 (fonte: task §7)`
- `[T4] executor: opus (declarado) · gates: [qa, tech_review]`
[T4] DEFEITO DO ORQUESTRADOR corrigido: o one-liner python 'open(p,"w").write(open(p).read()...)' TRUNCA o arquivo — open(...,'w') é avaliado antes do read(). Truncou tasks/T4.md a 0 bytes; o executor detectou e restaurou por git checkout. Padrão de duas etapas (ler em variável, depois escrever) adotado para o resto do run.
- `[T4] QA: APROVADO` — 9/9 critérios, ZERO problemas em qualquer severidade. Suíte 621 → 627 (db 70 → 76).
- `[T4] antipadroes_verificados: 2/2 arquivos de teste — completo.`
- `[T4] o QA reconstruiu a varredura do golden por script próprio e confirmou os 23 cenários (18 derivacao + 3 validacao + 2 fluxo); os dois blocos não varridos (retorno.fluxo, retorno.cobrancas) não carregam oráculo de derivação. A âncora é por contagem de bloco, não lista nominal — não envelhece.`
- `[T4] cegueira do golden MEDIDA e confirmada pelo QA: a multiplicação ingênua acerta os 23 cenários sem exceção. Os pares que fecham a lacuna vieram de busca; o par sugerido pela §6.6 (1350.50 × 12) é EXATO em ponto flutuante e não discriminaria mutante nenhum.`
- `[T4] Tech Review: APROVADO_COM_OBSERVACOES` — 1 baixo (`code_quality`). TR varreu a aritmética contra implementação de referência independente em **498.555 pares** (início, prazo) entre 2020 e 2110: ZERO divergências — bissexto secular, regra dos 400, virada de ano e travessia de dezembro corretos.
- `[T4] TR consultou: ADR-0006, ADR-0016`
- `[T4] unidade-de-trabalho.spec.ts NÃO é scope_deviation (TR, com razão mais forte que a do QA): o arquivo está MM porque o bloco da T3 já estava staged; o delta real da T4 traz EXCLUSIVAMENTE linhas +. A lacuna é da §5.2 da task, não do diff.`
- `[T4] ⚠️ ALERTA CARREGADO PARA A T7 (registrado pelo TR): o CT-012 audita a superfície PUBLICADA, não os consumidores, e o CT-402 mede que a multiplicação ingênua acerta os 23 cenários do golden. Se a T7 inlinar valorMensal * prazoMeses no serviço, NENHUM teste construído sobre o oráculo reprova. O gate da T7 deve exigir um par com resíduo (500.03 × 13) atravessando a rota.`
- `[T4] ledger: memória lazy nunca criada (aprovada na rodada 1) — métrica não se aplica.`
- `[T4] staged: src/derivacao-de-contrato.ts, test/derivacao-de-contrato.spec.ts, src/index.ts, test/unidade-de-trabalho.spec.ts, tasks/T4.md`
- `[T5] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T5] ADRs injetadas no executor: ADR-0008, ADR-0014, ADR-0015, ADR-0017, ADR-0020 (fonte: task §7)`
- `[T5] executor: opus (declarado) · risk=high · gates: [qa, tech_review] · diff_touches_critical_path=true (db)`
- `[T5] QA: APROVADO_COM_OBSERVACOES` — 11/11 critérios; 0 médios, 2 baixos. Zero bloqueantes. Suíte 627 → 632 (db 76 → 81).
- `[T5] antipadroes_verificados: 2/2 arquivos de teste — completo.`
- `[T5] concorrência confirmada REAL pelo QA: CT-405 usa três conexões físicas distintas e um PORTÃO que mantém as duas transações abertas — sob o mecanismo de fila que a ADR-0020 rejeita, a segunda emissão nunca anunciaria e o limite nomeado reprova. CT-407 VERIFICA a sobreposição por sondagem de pg_stat_activity (wait_event_type='Lock'), com limite nomeado, nunca espera fixa.`
- `[T5] o QA deixou uma ressalva explícita para o gate da T7: `alterarContrato` escreve `imovel_id`, que é coluna do índice parcial. A frase do docblock só é verdadeira SOB a precondição `status = 'RASCUNHO'` — se a T7 falhar em impor a guarda, um PUT sobre contrato ATIVO sobe 23505 cru e vira 500.`
- `[T5] attempt_sha (rodada 1)=0eda5f89a5624fd7a7fb9c08d565b64bf9d76b68`
- `[T5] Tech Review rodada 1: PARCIAL` — 1 bloqueante (ALTO/architecture): `alterarContrato` escreve `imovel_id`, chave do índice de vigência, sem tradução, e o docblock que a dispensa AFIRMA O QUE É FALSO. O TR ainda mediu que o conserto óbvio estaria errado: `lerCodigoDoContratoVigente` resolvia o imóvel ANTIGO (lido depois do rollback do SAVEPOINT).

### T5 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 2 }
- bloqueantes: P1 (ALTO/architecture)
- overrides_ativos: [tocou_area_critica: true, task_risk: high]
- requires_qa_revalidation: true
- decisao: RE-QA (Gate 1) e depois Gate 2
- justificativa: "`architecture` está em revalidation_required; a correção mudou assinatura pública e acrescentou casos"
- `[T5] QA rodada 2 (DELTA): APROVADO_COM_OBSERVACOES` — TR-P1 SANADO COMO CLASSE: o QA enumerou os SEIS caminhos de escrita da porta contra a definição real do índice e provou que só `status` (ativação) e `imovel_id` (alteração) o alcançam, ambos sob `gravarSobIndiceDeVigencia`. M5 e M6 reproduzidos pelo próprio gate. 1 baixo novo (`documentation`). Suíte 632 → 634.
- `[T5] o executor FALSIFICOU a correção sugerida pelo QA para o QA-B1: relativizar as asserções NÃO fechava a classe, porque `primeiroDeB.codigo === primeiroDeA.codigo` também presume ser o primeiro describe. Fechou pela raiz (ano de contador exclusivo, 2001 — dentro da guarda 2000–2999 da 0008). O QA reproduziu movendo o describe para o FIM do arquivo: 83 casos, 0 falhas.`
- `[T5] Tech Review rodada 2 (DELTA): APROVADO_COM_OBSERVACOES` — 2 baixos (`architecture`, `error_handling`). TR-P1 SANADO como classe; o TR reproduziu a enumeração das seis escritas por conta própria.
- `[T5] TR consultou: ADR-0008, ADR-0015, ADR-0017, ADR-0020`
- `[T5] o Tech Review RECONHECEU que a própria preferência da rodada 1 estava errada no mérito: "eu otimizei tamanho de diff em cima de fechamento de classe". Três razões que aceitou do executor: (a) a corrida é real — entre o SELECT da guarda RD-05 e o UPDATE cabe a ativação concorrente; (b) docblock honesto não fecha classe nenhuma; (c) leitura-antes-de-gravar é recusada por escrito em três lugares desta base, e o mínimo teria criado exceção à doutrina da casa DENTRO do arquivo que a enuncia.`
- `[T5] ⚠️ CARREGADO PARA A T6: com o envoltório instalado, `alterarContrato` virou SEGUNDA origem de `ErroDeImovelComContratoVigente`. A §1 da T6 não a declara entre os símbolos consumidos e a §6.4 dela não tem entrada para conflito de vigência — se a T6 não mapear, a janela de corrida devolve 500 e o defeito da rodada 1 reaparece um andar acima, com a porta correta.`
- `[T5] ⚠️ CARREGADO PARA A T6: a §3.2 da tasks/T5.md ainda escreve `criarContrato(tx, dados, numero)`. A assinatura entregue é `criarContrato(tx, dados, serie: NumeroDaSerie)`; a borda passa `{ano, numero}` com o MESMO ano nas duas unidades sequenciais.`
- `[T5] ledger: 7 achados totais | 3 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1 (os três da rodada 2 são consequência da própria correção — assinatura nova e origem nova de erro)`
[T5] staged.
- `[T6] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T6] ADRs injetadas no executor: ADR-0011, ADR-0018, ADR-0016, ADR-0017, ADR-0014, ADR-0015, ADR-0008, ADR-0013 (fonte: task §7)`
- `[T6] executor: opus (declarado) · gates: [qa, tech_review] · diff_touches_critical_path=true (api_contracts + auth)`
- `[T6] QA: APROVADO` — 12/12 critérios, ZERO problemas. Suíte 634 → 642 (api 130 → 138).
- `[T6] antipadroes_verificados: 5/5 arquivos de teste — completo.`
- `[T6] o QA reconferiu as âncoras por VARREDURA INDEPENDENTE (contou 57 decoradores de rota em apps/api/src) em vez de aceitar o número declarado. Nenhuma igualdade virou contenção: a partição do CT-318 é EXAUSTIVA nos dois lados, e a âncora do documento publicado foi PARTIDA em duas (33 + 6) — o total sozinho não distinguiria "seis entraram" de "seis entraram e seis saíram".`
- `[T6] o QA julgou que o marcador DECISÃO FECHADA satisfaz o P4 para o ramo sem prova comportamental de ErroDeImovelComContratoVigente (o protocolo prevê o marcador como "a rede possível" quando o defeito não é testável na stack), mas sinalizou o eixo `testability` ao Tech Review.`
- `[T6] attempt_sha (rodada 1)=5fdba2e6d3f0ec5dc2ab56a609d61598eefd991a`
- `[T6] Tech Review rodada 1: PARCIAL` — 1 bloqueante (ALTO/performance): uma consulta por fiador em laço sequencial, sobre coleção que a RD-06 declara SEM TETO. ~26 mil UUIDs cabem no bodyLimit padrão; o pool de conexões é COMPARTILHADO ENTRE TENANTS. A tech spec §861 avaliou o custo de coleção sem teto pelo eixo da ESCRITA (que é em lote); o eixo das N LEITURAS nasce nesta task e não foi avaliado por artefato nenhum.

### T6 — retry classification
- attempt: 1
- problemas_por_categoria: { performance: 1, best_practices: 1, code_quality: 1 }
- bloqueantes: P1 (ALTO/performance)
- overrides_ativos: [tocou_area_critica: true]
- requires_qa_revalidation: true
- decisao: RE-QA (Gate 1) e depois Gate 2
- justificativa: "`performance` está em revalidation_required; a correção acrescentou símbolo público em @sysloc/db e caso novo"
- `[T6] QA rodada 2 (DELTA): APROVADO` — TR-P1 SANADO COMO CLASSE: quatro consultas fixas, independentes de N; o QA confirmou que NENHUM outro laço do caminho faz consulta por item. MT6C-6 e MT6C-7 reproduzidos pelo próprio gate. Os três achados fechados. Suíte 642 → 643.
- `[T6] a prova de ORDEM não é por asserção de campo (todos os fiadores nomeiam `fiadoresIds`, o campo não discrimina ordem) e sim por PAR DE ORDENS TROCADAS: a mesma dupla de identificadores em posições invertidas recebe respostas de FORMA diferente (422 com detalhes.circulacao × 404 sem campo). O QA validou o argumento e reproduziu o mutante que o sustenta.`
- `[T6] Tech Review rodada 2 (DELTA): APROVADO_COM_OBSERVACOES` — 2 baixos (`project_pattern`, `code_quality`). TR-P1, TR-P2 e TR-P3 confirmados sanados, o P1 **como classe** (varredura independente de laços com `await`: nenhum).
- `[T6] TR consultou: ADR-0008, ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018`
- `[T6] ⚠️ CARREGADO PARA T7, T8 e T10: as três publicam CAMINHO NOVO sob /v1 e portanto farão `apps/api/test/contexto.e2e.spec.ts` REPROVAR — nenhuma o declara na §5.2. A T9 já se antecipou corretamente (declara `lerContratosVigentesDeImoveis` como NÃO publicada pelo índice, e por isso não toca o inventário).`
- `[T6] ⚠️ CARREGADO PARA T7/T8: `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` ainda diz "33 rotas" na prosa. As duas já o declaram na §5.2 — é ali que a prosa se acerta, junto com os casos das ações sensíveis.`
- `[T6] ledger: 5 achados totais | 2 originados em rodada >1 | 1 suspeito de incompletude da rodada 1 (o padrão da §5.2, que já era verdade na rodada 1 e só virou achado na 2)`
- `[T7] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T7] ADRs injetadas no executor: ADR-0019, ADR-0018, ADR-0011, ADR-0017, ADR-0014, ADR-0006 (fonte: task §7)`
- `[T7] executor: opus (declarado) · risk=high · gates: [qa, tech_review] · diff_touches_critical_path=true (auth + api_contracts)`
- `[T7] três alertas herdados injetados no prompt: (1) da T4 — o golden é CEGO à multiplicação ingênua; (2) da T5 — o par ATIVO ⇔ LOCADO não tem pareamento estrutural (D24), exigir CT dos DOIS sentidos + negativo; (3) da T6 — a §5.2 não declara contexto.e2e.spec.ts, que VAI reprovar porque a T7 publica caminho novo.`
- `[T7] QA: APROVADO_COM_OBSERVACOES` — 13/13 critérios, 5 baixos, zero bloqueantes. Suíte 643 → 650 (api 139 → 146).
- `[T7] Tech Review: APROVADO_COM_OBSERVACOES` — 3 baixos. `TR consultou: ADR-0006, 0008, 0011, 0014, 0015, 0016, 0017, 0018, 0019`.
- `[T7] O ALERTA QUE O PRÓPRIO TECH REVIEW DEIXOU NA T4 ERA FALSO, e os três — executor, QA e TR — o mediram: numeric(15,2) normaliza o resíduo no RETURNING, e o erro do float no teto do domínio (0,00222) é menor que meio centavo. O QA confirmou com 400 mil sorteios (erro máx 9,5e-7, zero divergências). A rede correta é asserção ESTÁTICA (CT-413 (c)), sancionada pela testing-stack.md mediante prova de falsificação — entregue e reproduzida.`
- `[T7] MT7-3 (trocar as etapas 6 e 7) SOBREVIVEU, e o verde É a propriedade: o guarda de aninhamento é AsyncLocalStorage de MÓDULO em unidade-de-trabalho.ts:78, sob DECISÃO FECHADA — de dentro da unidade do controlador, emUnidadeDeTrabalho levanta com QUALQUER objeto de acesso. A separação é irrepresentável no serviço.`
- `[T7] ⚠️ CARREGADO PARA A T8 (o que mais importa): `ErroDeTransicaoInvalida` NÃO existe e a ausência está CERTA — `exigirEstado(contrato, estadoExigido, transicaoPedida)` já é o ponto único parametrizado que o cancelamento consome. A §1 da T8 declara consumi-lo; se a T8 criar a classe para "cumprir" a §1, nasce uma SEGUNDA guarda com uma segunda forma de recusa sobre um `detalhes` que é contrato publicado — o padrão exato dos débitos D12/D38/D40.`
- `[T7] ⚠️ CARREGADO PARA A T8: a ativação sobrescreve INDISPONIVEL com LOCADO sem preservar a situação anterior, de modo que o cancelamento devolverá DISPONIVEL a um imóvel que o operador havia marcado indisponível. É FIEL AO ORÁCULO (o golden de cancelamento mostra 'Disponível') e é o que a §5 da T8 manda — decisão de spec, não achado. A informação foi perdida na T7, não na T8.`
- `[T8] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T8] ADRs injetadas no executor: ADR-0019, ADR-0018, ADR-0011, ADR-0014, ADR-0008, ADR-0017 (fonte: task §7)`
- `[T8] executor: opus (declarado) · gates: [qa, tech_review] · diff_touches_critical_path=true (auth + api_contracts)`
- `[T8] quatro alertas injetados: (1) NÃO criar ErroDeTransicaoInvalida — reusar exigirEstado (D29, com o TR enfático); (2) contexto.e2e.spec.ts VAI reprovar e não está na §5.2 (D26); (3) as contagens narrativas envelhecidas (D33) e o transicaoPedida como string solto (D34) estão nos arquivos que a T8 abre; (4) a informação de INDISPONIVEL foi perdida na T7, não na T8 — o cancelamento devolver DISPONIVEL é fiel ao oráculo.`
- `[T8] QA: APROVADO_COM_OBSERVACOES` — 12/12, 1 baixo. Suíte 650 → 655 (api 146 → 151). MT8-2, MT8-4 e MT8-6 reproduzidos pelo gate; o MT8-4 confirmado reprovando DE DUAS FORMAS DIFERENTES (escalada no CT-320 (c), forma da recusa no CT-426).
- `[T8] Tech Review: APROVADO_COM_OBSERVACOES` — 1 baixo (`project_pattern`). `TR consultou: ADR-0008, 0011, 0014, 0017, 0018, 0019`.
- `[T8] D34 (aberto pelo TR na T7) FECHADO nas duas pontas: TransicaoPedida montada com `typeof <constante>` em produção, e o teste tipa em uniões fechadas com literais ESCRITOS, não importados do SUT — o que impede a asserção de concordar consigo mesma.`
- `[T8] o executor CORRIGIU a §1 da task (nomear `exigirEstado` em vez de `ErroDeTransicaoInvalida`) e os dois gates julgaram LEGÍTIMO: é o que o "O que fazer" do D29 prescreve por escrito, com rastro e dono, sem tocar código de produção.`
- `[T8] o TR julgou CERTA a decisão de NÃO mexer em `cancelarContrato`: o reparo não é de uma linha — `AND status = 'ATIVO'` muda o significado de `undefined` de "não alcançado" para "não alcançado OU não ativo", e sem ensinar o serviço a distinguir, uma repetição legítima receberia 404 em vez do 422 publicado. É mudança de desenho, pertence a quem fechar o D35.`
- `[T8] ⚠️ CARREGADO PARA A T10: o cancelamento escreve DISPONIVEL pela porta estreita, tipada no enum COMPLETO. A T10 NÃO pode alargar `alterarImovel` para o enum completo "por simetria" — a assimetria é decisão fechada da fatia anterior com prova dedicada (CT-334/CT-335), e alargá-la desfaria em silêncio o invariante "LOCADO implica contrato vigente".`
- `[T8] ⚠️ CARREGADO PARA A T9 (verificado e benigno): o CT-416 afirma igualdade de corpo INTEIRO sobre o imóvel. Quando a T9 acrescentar `contratoVigente` a esquemaDoImovel, os dois lados o carregam e ambos são lidos com o contrato ATIVO — a igualdade sobrevive. O docblock de ImovelPublicado já registra a previsão.`
- `[T9] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T9] ADRs injetadas no executor: ADR-0016, ADR-0017, ADR-0008, ADR-0014 (fonte: task §7)`
- `[T9] executor: opus (declarado) · gates: [qa, tech_review] · tipo=refactor_cross_module (contracts + db + api) · altera contrato publicado da fatia anterior`
- `[T9] QA: APROVADO_COM_OBSERVACOES` — 9/9, 2 baixos. **O eixo R2 está limpo**: varredura mecânica do diff devolveu VAZIO nas três buscas (asserção forte removida / asserção fraca introduzida / skip-only-todo). Suíte 655 → 658.
- `[T9] Tech Review: APROVADO_COM_OBSERVACOES` — 1 médio (`project_pattern`, anotável) + 1 baixo (`security`). `TR consultou: ADR-0008, 0014, 0016, 0017`.
- `[T9] MT9-1 e MT9-2 reproduzidos pelo QA. O Proxy do CT-420 DELEGA ao executor verdadeiro (Reflect.apply) — instrumentação sobre fronteira real, não mock. Os dois cenários carregam contrato ATIVO de fato, e codigosVigentes() afirma OS CÓDIGOS, não uma contagem — o que impede a medição de correr sobre lote que não casa imóvel algum.`
- `[T9] ⚠️ CARREGADO PARA A T10 (o TR pediu injeção explícita): NÃO HÁ marcador DECISÃO FECHADA sobre SITUACOES_INFORMAVEIS nem sobre esquemaDeImovelNovo.statusLocacao. O `satisfies` impede valor inexistente, mas NÃO impede trocar z.enum(SITUACOES_INFORMAVEIS) por z.enum(SITUACOES_DE_LOCACAO) — isso COMPILA. A §20 do tech_spec (linha 1264) atribui o marcador explicitamente à T10, junto do CT-434, e é ele que protege o invariante "LOCADO implica contrato vigente" das rodadas seguintes.`
- `[T10] base_sha=2347148479811037e6b728149693f1c9643566bd`
- `[T10] ADRs injetadas no executor: ADR-0019, ADR-0016, ADR-0011, ADR-0018, ADR-0017 (fonte: task §7)`
- `[T10] executor: opus (declarado) · gates: [qa, tech_review] · tipo=padrao_novo + api_contracts · ÚLTIMA task da fatia`
[T10] DEFEITO DO ORQUESTRADOR corrigido (achado pelo Tech Review, P3): o task_plan mantinha a T4 como 'Em Progresso' porque o replace de fechamento buscava 'A Fazer', e a T4 já estava em 'Em Progresso'. Os três livros (task_plan, sdd_state, workflow-report) agora concordam.
