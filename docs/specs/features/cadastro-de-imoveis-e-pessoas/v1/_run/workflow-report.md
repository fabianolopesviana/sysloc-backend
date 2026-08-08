## Challenge Session — 2026-08-05 (artifact: tech_spec.md)

- Questões processadas: 5 (4 com decisão do usuário, 1 corrigida inline sem pergunta)
- Conflitos de terminologia resolvidos: 1 (`excluir cadastro` × `retirada de circulação` — a chave do catálogo preserva o nome histórico; o termo do domínio é `retirada de circulação`)
- Decisões implícitas explicitadas: 4 (prova de atomicidade dividida entre CT-325 e CT-326; mudança de conjunto pelo PUT completo; `statusLocacao` restrito a DISPONIVEL/INDISPONIVEL na entrada; posição do cômodo por `max(posicao)+1` na transação)
- Erros factuais corrigidos: 1 (CT-300/CT-301 afirmavam 9 tabelas examinadas e 7 novas; são 8 e 6 — corrigido no tech_spec e no `_run/test-cases.json`)
- Termos canonizados no glossário GLOBAL: 9 (Conjunto, Imóvel, Cômodo, Locador, Locatário, Fiador, Metragem total, Identificador municipal, Retirada de circulação) + 4 ambiguidades resolvidas
- Termos canonizados no glossário FEATURE: 0 (nenhum termo ficou restrito à feature)
- Candidatos a ADR sinalizados: 1 parcial (4/5 — "a entrada aceita apenas o subconjunto do enum que o usuário controla"; falha em C3, custo de reversão baixo)
- ADRs sugeridos para criação: 0

---

## Run de execução — 2026-08-05

- `[run] executor resolvido: general-purpose (default) — .claude/agents/ só contém os três agentes de gate, nenhum candidato a executor; origem: descoberta interativa dispensada por autorização explícita do usuário ("a resposta é sempre o recomendado")`
- `[run] modelo: opus em executor e nos dois gates, em toda task — CLAUDE.md sobrepõe o frontmatter (`sonnet` declarado nas tasks) e a heurística de gates; Sonnet e Haiku proibidos neste repositório`
- `[run] limite de tentativas: SUSPENSO por autorização explícita do usuário — o teto de 3 não se aplica neste run; a task só é declarada Bloqueada se esgotar as possibilidades de correção`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] baseline P1 (Protocolo Antirregressão) capturada em HEAD=621489e antes da primeira edição`

### Fase 1 — decisão de paralelismo

`[Fase 1] paralelismo descartado: T1 toca manifesto (`pnpm-workspace.yaml` + `packages/contracts/package.json`) e T3 toca barrel (`packages/shared/src/index.ts`) — o guard de arquivos de alta contenção da rule "Execução Paralela de Tasks" é literal (`ti.toca_alta_contencao and tj.toca_alta_contencao` ⇒ remove ambas), independente de os arquivos serem distintos. O task_plan derivou `Sim` sob a leitura "nenhum em comum"; a re-verificação do orquestrador aplica o pseudocódigo canônico e o default conservador.`
`[Fase 1] fallback: sequencial T1 → T2 → T3 → T4`
`[run] baseline P1: pnpm test VERDE — 8/8 tarefas turbo, 0 falhas (shared 126 casos, api 86; auth e db em cache)`

### T1
`[T1] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1`
`[T1] executor: opus (CLAUDE.md sobrepõe o `sonnet` do frontmatter) · gates: [qa, tech_review] (declarado)`
`[T1] ADRs injetadas no executor: ADR-0016, ADR-0017 (fonte: task §7)`
`[T1] QA rodada 1: APROVADO_COM_OBSERVACOES — 8/8 critérios, 6/6 CTs rastreados, suíte completa verde (9/9 tarefas, +31 casos); 1 médio anotável (code_quality/AP-26)`
`[T1] antipadroes_verificados: 2/2 arquivos de teste declarados — completo`
`[T1] TR consultou: ADR-0008, ADR-0014, ADR-0016, ADR-0017`
`[T1] Tech Review rodada 1: PARCIAL — 1 bloqueante (P1 MEDIO/error_handling), 3 anotáveis (P2 MEDIO/project_pattern, P3 BAIXO/project_pattern, P4 BAIXO/architecture)`

### T1 — retry classification
- attempt: 1
- problemas_por_categoria: { error_handling: 1, project_pattern: 2, architecture: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: false]
- requires_qa_revalidation: true
- decisao: RE-QA (rodada 2 passa por Gate 1 antes do Gate 2)
- justificativa: "o único bloqueante (P1) está em `error_handling`, categoria de `revalidation_required`; o override `tocou_area_critica` também forçaria `true` isoladamente"

`[T1] attempt_sha (rodada 1)=a7043148da1ca90b000498ae795ad9ec20cf6321`
`[T1] observações do TR registradas: propriedade folha verificada nos três eixos (manifesto, tsconfig, fonte); substituição de tsup.config.ts confirmada legítima com evidência própria; marcador D28 conferido nas duas pontas da §3-B, nenhuma emenda devida ao CLAUDE.md; nota para T5–T11 sobre compor a janela por .extend() em vez de alargar o esquema compartilhado`
`[T1] QA rodada 2 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES — 8/8 critérios, 8/8 CTs (CT-334 a CT-341), suíte completa verde 9/9 sem queda em nenhum pacote; contracts 31→43 casos; 1 baixo novo (data_handling, escala decimal da metragem)`
`[T1] antipadroes_verificados rodada 2: 2/2 arquivos declarados (folha.spec.ts herdado_da_rodada=1, fora do delta)`
`[T1] ledger rodada 2: TR-P1 corrigido (verificado por mutante, não por leitura) · QA-MED-001 corrigido · TR-P2 corrigido · TR-P3 corrigido (escriturado como D3) · TR-P4 segue aceito_como_debito · QA-BAIXO-001 novo, aceito_como_debito`
`[T1] Tech Review rodada 2 despachado em scan_scope=DELTA, attempt_sha_anterior=a7043148`
`[T1] Tech Review rodada 2 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES — TR-P1 fechado na CLASSE (o gate varreu todo campo de entrada do pacote atrás da mesma forma de defeito e examinou `deslocamento`, o único candidato não coberto: `.int()` do zod para em MAX_SAFE_INTEGER, dentro do bigint do PG); TR-P2 e TR-P3 sanados; 1 baixo novo (P5, project_pattern — texto do registro D3 vencido)`
`[T1] TR rodada 2 consultou: ADR-0008, ADR-0014, ADR-0016, ADR-0017`
`[T1] Protocolo Antirregressão conferido pelo Gate 2: `usuario.controller.ts` fora do delta (git diff zero linhas naquele path), `DECISÃO FECHADA` íntegro; correções acrescentam garantias e não removem validação preexistente`
`[T1] raio de impacto do DELTA determinado com confiança (sem queda para FULL): nenhum consumidor de código de @sysloc/contracts existe no repositório — as 9 ocorrências em apps/api são prosa em comentário`
`[T1] attempt_sha (rodada 2)=a9b0c0844c647bf0f9d80ac6f1b0d39872de9955`

### T1 — decisão de coordenação (rodada 3)
- Os dois achados não-bloqueantes remanescentes foram **adotados**, não adiados, por autorização explícita do usuário de resolver toda pausa pelo recomendado.
- `P5` (texto do registro D3 vencido) — corrigido pelo orquestrador na §2 do run-report; é artefato de coordenação, não de código.
- `QA-BAIXO-001` (escala decimal da metragem) — despachado ao executor. O Gate 2 concordou com a severidade BAIXA e **discordou de adiar**, com o argumento de que `numeric(10,2)` declara precisão *e* escala: o teto fechou a precisão e a escala ficou aberta, de modo que a justificativa escrita para a constante ainda não é verdadeira para `25.555`.
- Consequência do alinhamento do `cep`, registrada pelo TR sem achado associado: `'CEP 01001-000'` também é aprovado e canonizado para `'01001000'`, porque a máscara é removida antes da conferência — herança do padrão de `documentoPrincipal`, deliberada, e o CT-341 prende a metade dos sete dígitos e não esta.
`[T1] QA rodada 3 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES — 9/9 critérios (a §4 ganhou item próprio para a escala), 8/8 CTs, contracts 43→48 casos, nenhuma queda; QA-BAIXO-001 SANADO e verificado por mutante nas duas direções; 1 baixo novo (documentation — tabela §6.1 e títulos descrevem só o teto)`
`[T1] QA rodada 3 — verificação de mérito registrada: em vez de confiar nas pernas do teste, o gate varreu as 20.001 metragens de duas casas entre 0.00 e 200.00 mais 8 valores dirigidos e obteve zero reprovações legítimas e zero aceitações indevidas; a aresta de ponto flutuante do multipleOf não existe neste zod`
`[T1] QA rodada 3 — anti-gaming conferido item a item: as 4 pernas ACEITAS e as 4 RECUSADAS preexistentes do CT-340 preservadas; o par de fronteira do teto (que fechou o P1) sobreviveu à mudança de forma da asserção de política, medido nas duas direções (teto alargado na constante → 3 failed; escala afrouxada na constante → 3 failed)`
`[T1] rodada 4 despachada: correção somente de documentação (tabela §6.1 e dois títulos), sem mudança de comportamento — o Gate 2 final revisa o estado definitivo`
`[T1] Tech Review rodada 3 (final, scan_scope=DELTA): APROVADO_COM_OBSERVACOES — mudança de forma da asserção de política confirmada como NÃO afrouxamento (toEqual sobre arranjo de primitivos é exato; poder de detecção subiu de 1 para 2 dimensões; é a forma que o CT-338 já usava); extensão do CT-340 conferida perna a perna, nenhuma garantia deslocada; TR-P5 sanado; 1 baixo novo (P6, code_quality)`
`[T1] TR rodada 3 — verificação de mérito: o gate foi ALÉM do intervalo que o QA cobriu (0.00–200.00), varrendo 0.00–2000.00 (200.001 valores) e atacando a faixa alta da coluna; foi essa segunda medição que produziu o P6`
`[T1] P6 — a justificativa escrita para excluir os esquemas de saída da escala é empiricamente FALSA (200.001 valores de numeric(10,2) contra multipleOf(0.01) → zero recusas) e nomeia a razão errada para metragemTotal (que não é coluna, e sim soma derivada: 1,11% das somas de duas casas cairiam fora da escala). A decisão está certa; o motivo registrado, não. Classificado como material de R3 — o comentário é o portador da decisão neste repositório.`
`[T1] resíduo documentado de propósito pelo TR, para não ser "consertado": o floatSafeRemainder do zod aceita 0.30000000000000004 (diferença de 4e-17); é a MESMA tolerância que faz 0.29 e 8.11 passarem, e apertá-la recusaria metragem legítima — visto, medido, mantido`
`[T1] lacuna de escrituração apontada pelo próprio TR e sanada: o Ledger não tinha linha para o TR-P5; corrigida, junto com TR-P6, QA-BAIXO-003 e a transição de QA-BAIXO-001 para corrigido`
`[T1] rodada 5 despachada: somente comentário (justificativa do P6), com avaliação de emitir DECISÃO FECHADA no lugar — contagem de 48 casos é o critério de que nada além de texto mudou`
`[T1] Tech Review rodada 4 (confirmação do marcador): APROVADO_COM_OBSERVACOES — forma canônica do DECISÃO FECHADA conferida (quatro campos, cabeçalho no exemplar da §3); nada além de comentário mudou, verificado mecanicamente (13 símbolos exportados com os mesmos valores, linha de metragem, dois esquemas de saída, 16 campos de esquemaDoImovel); 1 médio anotável (P7, code_quality)`
`[T1] P7 — o exemplo canônico dentro do marcador NÃO reproduz: multipleOf(0.01) ACEITA 8.469999999999999, que cai do lado tolerado do floatSafeRemainder (os recusados têm 13-14 casas, este tem 15). A taxa de ~1,11% está certa (reconfirmada em amostra nova: 3.475/300.000). O próprio Gate 2 assumiu a autoria do erro — ele propôs o exemplo no suggested_fix do P6 tendo medido na mesma rodada que ele passava. Substituto mínimo por busca exaustiva: 0.01 + 2.01 = 2.0199999999999996, recusado.`
`[T1] TR rodada 4 — vereditos sobre as três escolhas do executor: (a) ponteiro de comodo.ts APROVADO como ponteiro puro, imovel.ts REPROVADO por copiar substância — invariante fixado: número medido e exemplo verificável moram só no marcador; (b) registro da rodada 5 na §7 aprovado; (c) marcador fora do índice do CLAUDE.md CONFIRMADO e verificado — o comando grepa DÉBITO COM GATILHO, o inventário segue em 21 arquivos, e pôr um DECISÃO FECHADA ali faria o índice afirmar "isto está agendado para mudar" sobre código que não pode mudar`
`[T1] rodada 6 despachada: troca do exemplo nos três pontos de propagação + imovel.ts reduzido a ponteiro. Pré-aprovada pelo Gate 2 ("corrigido o exemplo nos três lugares, a T1 fecha sem ressalva pela minha parte")`
`[T1] rodada 6: exemplo corrigido com medição prévia (0.01 + 2.01 = 2.0199999999999996 RECUSADO; 128.42+97.05+11.76+122.33+39.69+72.05+46.31 = 517.6099999999999 RECUSADO); o exemplo antigo migrou para o parágrafo do resíduo como ACEITO, com a lição registrada — "a aparência do número não diz de que lado ele cai"; imovel.ts reduzido a ponteiro puro`
`[T1] ledger: 10 achados totais | 5 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T1] leitura da métrica: nenhum dos 5 achados de rodada >1 aponta para arquivo/símbolo fora do delta da correção anterior — todos nasceram do próprio código que a rodada anterior escreveu (a escala veio do teto, o P6 do comentário da escala, o P7 do marcador do P6). A varredura da rodada 1 não deixou passar nada que as rodadas seguintes tivessem de recuperar: o crescimento do ledger é consequência do trabalho novo, não de incompletude.`
`[T1] baseline P5 final: pnpm test VERDE 9/9 tarefas turbo — api 86, shared 126, auth 82, db 40, worker 16, contracts 48; suíte do repositório 350 → 398 casos`
`[T1] staged: CLAUDE.md, packages/contracts/** (12 arquivos), pnpm-lock.yaml, tasks/T1.md`
`[T1] memória lazy removida após o registro da métrica do ledger`
`[T1] CONCLUÍDA em 6 rodadas — 1 por bloqueio de gate (P1), 5 por adoção de recomendação não-bloqueante (decisão de coordenação sob a autorização do usuário)`

### T2
`[T2] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1 (o stage da T1 não move o HEAD; o isolamento do diff da T2 vem do filtro por paths, subtraindo os 15 arquivos staged pela T1)`
`[T2] executor: opus (declarado no frontmatter, e o CLAUDE.md o confirma) · gates: [qa, tech_review] (declarado) · risk: high · área crítica: db_migrations`
`[T2] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0014, ADR-0015, ADR-0006 (fonte: task §7)`
`[T2] QA rodada 1: APROVADO_COM_OBSERVACOES — 7/7 critérios, 5/5 CTs (CT-300 a CT-304), suíte completa verde 10/10 tarefas; db 40→44, nenhum pacote caiu; 1 baixo (documentation — cabeçalho de negocio.ts aponta só a 0001 como sede do FORCE)`
`[T2] antipadroes_verificados: 4/4 arquivos de teste tocados, sweep integral em cada um`
`[T2] Camada 0 — os SEIS excedentes da §5.2 verificados um a um e todos procedem: as duas suítes extras eram blast radius mecanicamente forçado (igualdade de conjunto), o verificador shell exige a atualização no próprio comentário (linhas 167-168), e a aresta db→contracts é a permitida (a inversa NÃO nasceu — contracts declara só zod e não tem references)`
`[T2] antirregressão conferida pelo QA: isolamento.spec.ts é adição PURA (875 inserções, ZERO deleções — por isso a ausência de SUT_IS_CORRECT_BECAUSE ali é correta); as 19 deleções de catalogo.spec.ts são só a troca do conjunto de 2 para 8; nenhuma igualdade virou toContain`
`[T2] CT-302 — divergência interna do card (Passos dizem "seis", Resultado esperado diz "sete") julgada pelo QA: a leitura do executor procede, o número sete não corresponde a conjunto coerente algum; correção do card fica para o fechamento da fatia`
`[T2] TR consultou: ADR-0006, ADR-0008, ADR-0009, ADR-0014, ADR-0015, ADR-0016`
`[T2] Tech Review rodada 1: APROVADO_COM_OBSERVACOES — nenhum bloqueante; 3 baixos (P1 project_pattern, P2 code_quality, P3 adr_compliance)`
`[T2] isolamento conferido exaustivamente pelo Gate 2: seis políticas com expressão byte a byte idêntica à da 0001 e idêntica entre USING e WITH CHECK; FK composta nas duas referências tenantizadas; unicidades totais; referências simples a identidade.empresa corretas (alvo não tenantizado); imovel/comodo sem FK direta a empresa corretos (existência implicada pela composta)`
`[T2] concessões verificadas pelo Gate 2 por conta própria: o ALTER DEFAULT PRIVILEGES da 0001 cobre ON TABLES e ON TYPES, por isso a 0006 corretamente não repete GRANT e os três enums novos nascem concedidos; a USAGE nos tipos é exercitada de verdade pelos CT-302/303, que gravam com cast ::negocio.tipo_imovel`
`[T2] anti-gaming (numstat + inspeção linha a linha das 23 deleções): isolamento.spec.ts 875/0, unidade-de-trabalho 22/0, papel-de-conexao 39/4, catalogo 183/15 — nenhuma asserção afrouxada, toEqual preservado em todos os pontos`
`[T2] scope_deviation NÃO emitido pelo Gate 2, com razão registrada: o executor usou a válvula prevista pela Regra 10b (declarar e justificar cada excedente); é aplicação incompleta da §5.2 no card, não ausência de regra`
`[T2] attempt_sha (rodada 1)=559d00485aefe350b27a98c752abc6a722e4905c`
`[T2] rodada 2 despachada: os 4 baixos (1 do QA + 3 do TR) fechados de uma vez — todos escrituração, sem mudança de comportamento; 44 casos é o critério de que nada além de texto mudou`
`[T2] risco herdado registrado pelo TR sem virar problema: o índice comodo_empresa_imovel_posicao_idx é praticamente redundante com a unicidade (imovel_id, posicao), mas CONFORMA à tech_spec §7.2 — rever exigiria emendar a spec primeiro; DROP INDEX é aditivo e não exige janela`
`[T2] rodada 2: P1, P2, P3 e o BAIXO-001 do QA fechados; delta verificado mecanicamente pelo Gate 2 como comentário puro (filtradas as linhas de comentário, o resto do diff veio VAZIO nas três paths)`
`[T2] Tech Review rodada 2: APROVADO_COM_OBSERVACOES — 1 baixo novo (P4), gerado pela generalização que o executor acrescentou por conta própria`
`[T2] P4 — a regra "cada migração gerada ganha a sua parceira autoral" foi FALSIFICADA pela história do repositório: 0002 e 0003 declaram-se GERADAS e não têm parceira; 0004 declara-se ESCRITA À MÃO e não é parceira de ninguém. O gatilho real é CRIAR TABELA em negocio, porque é só aí que falta FORCE e política. Prova aritmética do gate: TABELAS_LEGITIMAS era exatamente as duas herdadas até a 0005, afirmado por igualdade pelo CT-008, que estava verde.`
`[T2] risco concreto do P4, e a razão de dobrá-lo em vez de anotá-lo: o texto mora no cabeçalho que ENSINA a acrescentar tabela — quem gerar uma 0007 que só acrescente coluna escreveria uma 0008 autoral vazia`
`[T2] a outra metade da generalização foi endossada pelo Gate 2 e preservada: nunca emendar a 0001 nem a 0006, porque descrevem schemas já aplicados — migração aplicada é imutável`
`[T2] rodada 3 despachada: troca da oração universal pela condicional, com as três migrações que a falsificam citadas — o que torna a regra verificável contra o diretório em vez de enunciada`
`[T2] rodada 3: oração trocada pela condicional, com a regra CONFERIDA CONTRA O DIRETÓRIO antes de reescrita — só a 0000 (2 CREATE TABLE em negocio) e a 0005 (6) criam tabela, e são exatamente as duas com parceira autoral; 0002 e 0003 criam zero e não têm; 0004 é autoral avulsa`
`[T2] baseline P5 final: pnpm test VERDE 10/10 tarefas — db 44, shared 126, api 86, auth 82, worker 16, contracts 48; suíte do repositório 398 → 402`
`[T2] staged: packages/db/** (13 arquivos), deploy/scripts/instalacao/verificar-migracao.sh, tasks/T2.md`
`[T2] memória lazy NUNCA criada — a task não teve rejeição bloqueante em rodada nenhuma; sem rejeição não há achado a rastrear, e os anotáveis foram todos fechados. Logo não há métrica de ledger a registrar.`
`[T2] CONCLUÍDA em 3 rodadas, todas por adoção de recomendação não-bloqueante — ZERO débitos anotados`

### T3
`[T3] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1 (o stage das T1/T2 não move o HEAD; o isolamento vem do filtro por paths)`
`[T3] executor: opus (CLAUDE.md sobrepõe o `sonnet` do frontmatter) · gates: [qa] (declarado — tipo=service_simples, função pura sem integração externa nem área crítica) · risk: low`
`[T3] FAST-PATH: Tech Review PULADO por declaração do frontmatter — a task fecha com a aprovação do Gate 1`
`[T3] ADRs injetadas no executor: nenhuma (a task declara "Nenhuma. A conferência de documento é função pura de domínio")`
`[T3] QA rodada 1 (único gate — TR pulado por fast-path): APROVADO_COM_OBSERVACOES — 6/6 critérios, 1/1 CT, suíte 10/10 verde; shared 126→192; 1 médio anotável (AP-26) e 1 baixo, ambos code_quality`
`[T3] antipadroes_verificados: 2/2 arquivos de teste tocados`
`[T3] o QA conferiu ARITMETICAMENTE os 10 documentos declarados válidos, com implementação independente do módulo 11 (sem reaproveitar o SUT): todos conferem, e os rótulos "por resto 0"/"por resto 1" batem nas 8 entradas que os usam. Era o ponto de maior risco da task — um "válido" que fosse inválido tornaria o controle positivo ruído e a suíte ficaria verde do mesmo jeito, porque o esperado é escrito junto com o valor.`
`[T3] o QA reverificou 6 dos 9 mutantes do executor em script isolado (sem mutar o repositório) e as contagens coincidiram — o relato de falsificação é reproduzível, não ornamental`
`[T3] ERRO DE SPEC confirmado pelos dois: a §5.2 da T3.md e a linha 186 do tech_spec afirmam "igualdade de conjunto" em superficie-publica.spec.ts, que na verdade afirma por PRESENÇA desde a F0. O executor diagnosticou, recusou-se a converter (seria R3) e não escreveu SUT_IS_CORRECT_BECAUSE (nada reprovou) — as três decisões endossadas pelo QA, que verificou pelo git diff que o comentário da decisão não aparece no delta, provando ser preexistente.`
`[T3] guarda de forma validada por medição do QA, não por leitura: com FORMA_ACEITA inerte, 5299822472A5 e 1122233300018A1 passam a ser APROVADOS porque normalizam para documentos válidos — a guarda antes da normalização é obrigatória, porque a normalização é destrutiva e apaga a informação que discrimina`
`[T3] sinalizações do QA por ser o ÚNICO gate: conformidade arquitetural conferida (colocação, barrel em ordem alfabética, idioma, ausência de dependência nova provada por ausência no diff); ReDoS analisado nas três expressões regulares (todas lineares; 1 MB de dígitos atravessa sem DoS); e o risco de duplicação da regra em T8/T9 sob a ADR-0016`
`[T3] rodada 2 despachada: MED-001 + BAIXO-001 + correção da spec errada (§5.2 da task e linha 186 do tech_spec). Contagem de shared deve CAIR de 192 para 190 — queda esperada, é o conserto do AP-26, não regressão.`
`[T3] QA rodada 2 (final): APROVADO — zero problemas em todas as severidades. Os dois débitos da rodada 1 fechados, as três preservações intactas, a spec corrigida sem enfraquecer a regra onde é devida.`
`[T3] a queda 192→190 foi reconciliada POR COMPOSIÇÃO pelo QA (3×10 válidos + 16 inválidos + 14 de âncoras + 4 normalizações = 64, contra 66), fechando em -2 sem resíduo — e, mais forte, ele REEXECUTOU os 6 mutantes contra a tabela reduzida e obteve contagens de reprovação IDÊNTICAS. Contagem igual não prova detecção igual; ele mediu em vez de inferir.`
`[T3] ponto cego da fonte única investigado em 8 direções (o executor mediu 1): nenhuma sobrevive. A razão é estrutural — as âncoras preservadas são INDEPENDENTES da constante e cruzam a tabela consigo mesma; as duas direções que a asserção de aprovação não pega são pegas pelas âncoras. O QA registrou que a derivação só é segura porque as âncoras existem.`
`[T3] o QA reportou erro PRÓPRIO numa das 8 direções (literal digitado errado no script dele, que transformou a direção acidentalmente em duplicata de outra), refez com o valor conferido e corrigiu a conclusão — a direção correta NÃO reprova, e isso está certo: um teste que reprovasse a troca por outro CPF válido de DV não-zero estaria provando o literal, não a invariante`
`[T3] exceção da tech_spec verificada por grep de TODAS as menções, não pela nota isolada: as linhas 183/184 preservam igualdade exata para unidade-de-trabalho e cobertura-de-autorizacao; a linha 736 (CT-300) e a 824 (matriz de risco) mantêm a exigência inteira. A exceção não vazou.`
`[T3] baseline P5 final: 10/10 tarefas — shared 190, db 44, api 86, auth 82, worker 16, contracts 48. A única contagem que mudou é a que deveria mudar, no valor que deveria mudar.`
`[T3] staged: packages/shared/** (4 arquivos), tasks/T3.md, tech_spec.md`
`[T3] memória lazy nunca criada (sem rejeição bloqueante) — sem métrica de ledger`
`[T3] CONCLUÍDA em 2 rodadas, ambas por adoção de recomendação não-bloqueante — ZERO débitos anotados`

### T4
`[T4] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1`
`[T4] executor: opus (CLAUDE.md sobrepõe o `sonnet` do frontmatter) · gates: [qa, tech_review] (declarado — tipo=refactor_cross_module) · risk: medium`
`[T4] ADRs injetadas no executor: ADR-0017 (fonte: task §7)`
`[T4] esta task FECHA o débito D38 — o marcador sai de apps/api/src/autenticacao/senha.controller.ts e a linha sai do índice do CLAUDE.md no mesmo commit`
`[T4] QA rodada 1: APROVADO_COM_OBSERVACOES — 6/6 critérios, 4/4 CTs, suíte 10/10 verde, api 86→97 (+11 inventariado caso a caso); 3 baixos (documentation×2, code_quality)`
`[T4] o QA verificou o ORÁCULO em vez do card: extraiu as três cópias de 621489e e confirmou que são BYTE A BYTE idênticas entre si e à função extraída — comportamento preservado, não aproximado`
`[T4] card do CT-340/CT-342 estava ERRADO e o executor certo: medido em zod@4.4.3, unrecognized_keys vem com path: [] e o nome da chave viaja em keys, que validar() não lê nem nunca leu. Afirmar 'empresaId' exigiria MUDAR a função, vedado pela §3 da task.`
`[T4] TR consultou: ADR-0016, ADR-0017`
`[T4] Tech Review rodada 1: APROVADO_COM_OBSERVACOES — "a T4 é uma extração fiel; nenhuma mudança de comportamento, nenhum desvio de escopo, nenhum enfraquecimento de prova, nenhuma violação de ADR". 3 baixos (P1 project_pattern, P2 testability, P3 code_quality)`
`[T4] ADR-0017 verificada pela CADEIA INTEIRA pelo Gate 2: a causa vira Error.cause em packages/shared/src/erros.ts e paraCorpo() constrói o objeto campo a campo em vez de serializar a exceção — o ZodError, e com ele o valor recusado, é inalcançável pelo cliente POR CONSTRUÇÃO`
`[T4] ADR-0016 conferida quanto ao risco não óbvio: validar() recebe o ZodType de fora e é agnóstica quanto à procedência — é o braço de APLICAÇÃO da 0016, não um competidor. T5–T11 podem passar esquemas de @sysloc/contracts sem tocar no módulo.`
`[T4] ciclo de vida da §3-B cumprido nas duas pontas, com a aritmética da prosa conferida pelo Gate 2: tabela com 8 linhas, texto "Oito débitos", "Um já disparou e segue aberto — o D28", "Seis saíram daqui por terem sido fechados" (D6, D7, D32, D21, D40, D38). Sentido 2 conferido: os 8 têm marcador vivo no código.`

### T4 — escalada resolvida pela autorização permanente do usuário
- O **P1** (`DECISÃO FECHADA` de `senha.controller.ts:252` com referência vencida ao marcador do D38) é, pela §3.3 da `.claude/rules/nao-regressao.md`, **caso de PARAR e escalar ao usuário** — o executor acertou em não editar sozinho, e os dois gates confirmaram o alcance da proibição da §3.2.
- A escalada foi resolvida pela **autorização explícita e permanente** que o usuário deu na abertura deste run: toda pausa por decisão se resolve pela opção recomendada. A recomendação dos dois gates é corrigir a frase.
- Escopo autorizado: **uma linha de comentário** — trocar a ilustração por contraste por formulação que não dependa de vizinho vivo. Cabeçalho, **Alcance** e os campos `O QUÊ`/`POR QUÊ`/`REVERTER EXIGE` permanecem intactos, e nenhuma linha de código sob o marcador é tocada.

`[T4] P2 — achado de maior valor da rodada: a rede do CT-343 fecha o CAMINHO, não a CLASSE. A regex só reconhece definição no escopo do módulo; uma quarta cópia como MÉTODO privado de controlador não casa, e a ponta dos importadores também não a pega (o controlador com cópia local justamente não importa) — o caso ficaria VERDE com o D38 reaberto. O mutante do executor usou a forma coberta, então o buraco não foi exercitado. Correção: terceira igualdade de conjunto sobre safeParse, que nenhuma forma sintática contorna.`
`[T4] P3 (credencialDeSessao duplicado) — o Gate 2 mandou EXPLICITAMENTE não fechar agora: reescrever entrarCom seria o "aproveitar que estou aqui" vedado pela proibição 5 da §4. Anotado como débito com dono declarado.`
`[T4] rodada 2 despachada: P1 (autorizado) + P2 (com prova de falsificação própria, mutante na forma de MÉTODO). api deve ir de 97 para 98.`
`[T4] Tech Review rodada 2 (final): APROVADO_COM_OBSERVACOES — marcador conferido LINHA A LINHA no diff (3 por 3, todas dentro do parêntese; os quatro campos aparecem como LINHAS DE CONTEXTO, o que é prova de identidade byte a byte); Alcance com redação idêntica; código sob o marcador intocado, verificado por leitura direta do arquivo`
`[T4] o Gate 2 registrou que o texto novo é ESTRITAMENTE SUPERIOR ao original: ao trocar a referência posicional por genérica, o contraste deixou de depender de vizinho vivo e não pode envelhecer de novo pela mesma causa — resolve a classe, não a ocorrência`
`[T4] rede nova validada: o par de execuções é o que dá valor — com só as duas pontas, 97 passed VERDE com uma quarta cópia viva (buraco MEDIDO); com a terceira igualdade, 1 failed | 97 passed, e o caso das duas pontas permaneceu verde, provando que ele não detecta e que a asserção nova não é redundante`
`[T4] custo de manutenção da lista nova julgado aceitável e ESTRUTURALMENTE diferente do da outra: IMPORTADORES_ESPERADOS cresce a cada controlador (comportamento desejado); ANALISADORES_ESPERADOS NÃO cresce, porque sob a ADR-0016 o caminho pretendido é chamar validar() — controlador novo acrescenta zero safeParse. Terceiro analisador só aparece se for cópia (defeito pego) ou decisão nova (que merece revisão).`
`[T4] risco residual registrado e deliberadamente NÃO perseguido pelo Gate 2: uma cópia que usasse esquema.parse() em try/catch escaparia das três igualdades — remoto (não seria cópia de validar(), cuja forma inteira é construída sobre safeParse) e persegui-lo seria a regressão infinita que a §5 adverte`
`[T4] baseline P5 final: api 98, shared 190, db 44, auth 82, worker 16, contracts 48 — 10/10 tarefas verdes; suíte do repositório 350 → 414 casos`
`[T4] staged: apps/api/** (6 arquivos), CLAUDE.md, tasks/T4.md`
`[T4] memória lazy nunca criada (sem rejeição bloqueante) — sem métrica de ledger`
`[T4] CONCLUÍDA em 2 rodadas · FASE 1 (FUNDAÇÃO) COMPLETA — 4/4 tasks`

### T5
`[T5] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1`
`[T5] executor: opus · gates: [qa, tech_review] · dependências satisfeitas: T1, T2, T4 (todas concluídas e staged)`
`[T5] esta task ESTABELECE O MOLDE das quatro entidades seguintes — divergência nela se propaga a T6, T7, T8 e T9 (risco declarado na §8 do task_plan)`
`[T5] gates ESCALADOS de [qa] para [qa, tech_review] por decisão de coordenação — o frontmatter declara [qa] (tipo=crud_handler sobre pattern existente), mas a §8 do task_plan declara a T5 como O MOLDE das quatro entidades seguintes: "divergência nela se propaga". A mitigação declarada (CT-315, em T9) só pega o defeito DEPOIS de ele ter sido copiado quatro vezes. A rule "Gates inference rules" manda o default conservador — "pular Tech Review indevidamente em área crítica é mais caro do que rodá-lo num CRUD trivial" — e o molde não é CRUD trivial.`
`[T5] ADRs injetadas no executor: ADR-0008, ADR-0011, ADR-0014, ADR-0017 (fonte: task §7)`
`[T5] divergência de spec detectada na abertura, análoga à da T4: a §5.1 declara as suítes como apps/api/test/conjunto.e2e.spec.ts e packages/db/test/circulacao.spec.ts, mas os cards da §6.6 apontam para cadastro-de-imoveis.e2e.spec.ts, circulacao-de-cadastro.e2e.spec.ts e circulacao.spec.ts — as três declaradas [N] na §3.4 do tech_spec. Instrução dada ao executor: seguir os CARDS (que nomeiam suítes canônicas do tech_spec) e registrar a divergência, em vez de criar arquivo que a §3.4 não prevê.`
`[T5] QA rodada 1: REJEITADO — 6/7 critérios (CA-12 FALHOU), 5/5 CTs implementados, suíte verde 10/10 (api 98→102, db 44→45); 1 CRÍTICO/security, 1 ALTO/tests, 1 médio e 1 baixo anotáveis`
`[T5] security_flags: broken_access_control, missing_authorization_check — PRIMEIRO REJEITADO do run`
`[T5] CRIT-001 medido com SONDA (Reflector do Nest sobre o controlador compilado, mesmo par que contexto.guard.ts:445 usa), não inferido: criar/listar/ler/alterar → TELA:imoveis; retirar/recircular → ACAO:excluir_cadastro E SÓ. O "além disso" da §3 virou "em vez disso".`
`[T5] a mitigação escrita pelo executor no controlador é FALSA, e o dado que a refuta está duas linhas acima dela no próprio comentário: MAPA_ACAO_TELA['ACAO:excluir_cadastro'] === 'TELA:cadastros'. A coerência garante TELA:cadastros, nunca TELA:imoveis.`
`[T5] caminho de exploração é o USO NORMAL do produto: Admin concede {TELA:cadastros, ACAO:excluir_cadastro} a quem administra pessoas — conjunto coerente que validarCoerenciaDeAjustes aceita. Essa pessoa recebe 403 em GET /v1/conjuntos e 200 em POST /v1/conjuntos/:id/retirada.`
`[T5] a prova da lacuna estava no PRÓPRIO teste da task: circulacao-de-cadastro.e2e.spec.ts:192-196 precisou conceder TRÊS chaves, e TELA:cadastros só está ali porque a coerência a exige junto da ação`
`[T5] por que o oráculo não alertou: usuario.controller.ts declara ExigeChave só na CLASSE, e nenhum dos sete manipuladores declara no método — conjunto.controller.ts é o PRIMEIRO ponto da base em que declaração de método coexiste com a de classe`
`[T5] ALTO-001 — a bateria de 9 mutantes do executor não tem UM ÚNICO mutante sobre autorização: todos atacam a porta de dados e a borda. A §7 anunciava a bateria como cobrindo o que ela não cobre, que é o que a testing-stack.md chama de pior que prova ausente, porque consta como feita.`
`[T5] attempt_sha (rodada 1)=0d906cf777fd0c020b62080eab62b28481e4009b`

### T5 — retry classification
- attempt: 1
- problemas_por_categoria: { security: 1, tests: 1, code_quality: 1, documentation: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: low (frontmatter) mas gates escalados, qa_security_flags: [broken_access_control, missing_authorization_check], diff_stat_changed: true]
- requires_qa_revalidation: true
- decisao: RE-QA (rodada 2 passa por Gate 1 antes do Gate 2)
- justificativa: "CRIT-001 em `security`, categoria de revalidation_required; os overrides de área crítica e de security_flags não vazia forçariam `true` isoladamente"

### T5 — segunda escalada resolvida pela autorização permanente do usuário
- A correção do CRIT-001 **atravessa `packages/auth/src/autorizacao.ts` e `apps/api/src/autenticacao/contexto.guard.ts`**, fora dos arquivos declarados na §5 da T5 — gatilho de PARADA pela Regra 1 da Disciplina do Executor.
- Resolvida pela autorização explícita e permanente dada na abertura do run. Caminho autorizado: variante de conjunção em `Exigencia`, com o ramo no `Record` fechado de `decidirAcesso` (que não compila até ganhar decisão) e `decisao.exigido` devolvendo a PRIMEIRA chave ausente — o que preserva literalmente o CT-320 e fecha a direção oposta.
- **Alternativa rejeitada e registrada**: trocar a chave da classe para `TELA:cadastros` contraria a §11.2 do tech_spec.
`[T5] rodada 2 despachada com rede obrigatória: caso E2E com sessão SEM TELA:imoveis afirmando 403 nas duas rotas, mutante novo sobre a declaração de exigência, e DECISÃO FECHADA no ponto`
`[T5] QA rodada 2 (DELTA): APROVADO_COM_OBSERVACOES — 7/7 critérios, 8/8 CTs, CRIT-001 FECHADO e remedido com a mesma sonda; api 104, auth 89, db 45; 1 médio novo (MED-002, vague_existence_assertion)`
`[T5] TR consultou: ADR-0008, ADR-0011, ADR-0014, ADR-0017`
`[T5] Tech Review rodada 1: PARCIAL — 2 bloqueantes (P1 adr_compliance, P2 security) e 2 baixos anotáveis`
`[T5] o Gate 2 ENDOSSOU o desenho e refutou a alternativa que a coordenação levantou: getAllAndMerge faria spread de dois objetos planos e produziria UM objeto com a chave do método — "o mesmo defeito, escondido atrás de um nome que promete união"; e getAll + conjunção implícita mudaria a semântica das 39 rotas, transformando @NaoExigePermissao() numa exigência herdada`
`[T5] P2 — achado de maior valor da revisão: o REVERTER EXIGE do marcador do controlador é SATISFAZÍVEL nas rotas de pessoas da T9 (área da classe = TELA:cadastros = exatamente a que MAPA_ACAO_TELA associa à ação). Copiado o texto, o marcador AUTORIZA a forma que o CT-355 acusa — marcador que discorda da rede empurra quem o segue a "consertar" a rede.`
`[T5] P1 — a ADR-0011 não registra: a composição; o override do getAllAndOverride como modo de falha; e a propriedade de cobertura FORTALECIDA (o predicado "nenhuma rota sem declaração" foi provado insuficiente por exploit). Os Cons dela ainda chamam NENHUMA de "única abertura deliberada", e o defeito exibiu uma segunda.`
`[T5] decisão de coordenação: adotada a recomendação do Gate 2 de ADR NOVA (0018) em vez de emenda — a convenção do repositório para decisão que evolui é a cadeia de supersede (0007→0012→0017), e ela preserva o histórico`
`[T5] MED-002: o QA classificou como débito e o Gate 2 DISCORDOU do adiamento — T6/T7/T9 já tocarão o arquivo para subir ROTAS_PUBLICADAS_EM_PRODUCAO, então a âncora exata custa zero incremental. Coordenação seguiu o Gate 2.`
`[T5] attempt_sha (rodada 2)=fad3d6baac9d8b0b6b6cf8b07deff5f11bc1df15`
`[T5] rodada 3 despachada: P1 (ADR-0018 + reindex + Applied in), P2 (REVERTER EXIGE que não dependa de coincidência de catálogo), P4 (§11.2 do tech_spec), MED-002 (âncora exata) e P3 (nota no docblock, SEM remover a recursão)`
`[T5] QA rodada 3: REJEITADO — mas os 7/7 critérios passam, as três correções estão certas e o delta é INERTE (comentário puro em produção). O REJEITADO recai EXCLUSIVAMENTE sobre instabilidade da suíte (ALTO-002), não atribuível ao executor nem a esta task.`
`[T5] instabilidade observada pelo QA em 3 execuções: (1) pnpm test agregado → @sysloc/api 1 failed | 103 passed, turbo 9/10; (2) pnpm --filter @sysloc/api test isolado → 104/104; (3) pnpm test --force agregado → 10/10 com as seis contagens exatas. Mesma árvore, sem edição entre elas.`
`[T5] o QA declarou erro PRÓPRIO: invocou `pnpm test | tail -40` e perdeu a identidade do caso, porque o nome ficou acima do corte. Assumiu explicitamente que o erro é dele, não do executor.`
`[T5] razão do bloqueio, e ela é da rule: .claude/rules/testing-stack.md §180-182 é literal — "nenhum mecanismo de retry automático; teste instável é defeito: para a fila até ser corrigido ou removido com justificativa registrada". Aprovar respondendo a um vermelho com um verde seria retry_as_fix (AP-22, CRÍTICO) feito à mão em vez de por configuração.`
`[T5] custo concreto além do princípio: o P1/P5 do Protocolo Antirregressão manda comparar a baseline CASO A CASO. Uma suíte que reprova 1 em cada 3 execuções torna "estava verde e ficou vermelho" INDECIDÍVEL — e a T5 é o molde de quatro tasks que farão exatamente essa comparação.`
`[T5] âncora = 24 VERIFICADA POR CONTAGEM INDEPENDENTE do QA (grep dos decoradores de rota em apps/api/src), com decomposição idêntica à soma enumerada. A reconciliação com os 39 pares fecha: 30 pares dos manipuladores (o @All('*') expande 1→7) + 9 do contrato publicado. Um 24 derivado de 39 teria errado por 15.`
`[T5] ADR-0018 julgada PARCIALMENTE grep-detectável pelo QA, com as duas metades sintáticas e a terceira (estrutural) já coberta pelo CT-355. Instruções para os gates de T6–T11 registradas no JSON, com destaque para a armadilha da T9: lá a área da classe COINCIDE com MAPA_ACAO_TELA['ACAO:excluir_cadastro'], e a coincidência torna o defeito invisível por comportamento.`
`[T5] MED-002 FECHADO; P2 do Gate 2 fechado e a reescrita do REVERTER EXIGE julgada boa pelo QA ("sobrevive a quem não estava na conversa, que é o teste do §3")`
`[T5] AÇÃO DA COORDENAÇÃO: 5 execuções de pnpm test --force com log ÍNTEGRO (nunca tail), para nomear o caso instável antes de decidir entre corrigir e registrar com justificativa — as duas saídas que a rule admite`
`[T5] MEDIÇÃO DO FLAKE (coordenação): 12 execuções com log ÍNTEGRO — 5× pnpm test --force e 7× pnpm test (condições exatas da falha) — TODAS 10/10. Total da série: 16 execuções, 1 falha, taxa ≈6,25%, sem reprodução em 13.`
`[T5] teto de recurso medido: 12 CPUs, load average 3.80/14.24/13.94 (saturação sustentada de ~118%), 22 GB livres de 31 (memória não é gargalo), NENHUM limite de concorrência declarado em vitest.config.ts algum, 12 arquivos E2E em apps/api/test cada um subindo Postgres + Redis + Nest`
`[T5] QA rodada 4: APROVADO_COM_OBSERVACOES — ALTO-002 REBAIXADO a BAIXO-002 (débito anotado com gatilho). A T5 aprova pelo Gate 1.`
`[T5] CORREÇÃO DE ÊNFASE DO QA, que a coordenação registra por ser metodologicamente importante: a não-reprodução em 12 execuções é a evidência MAIS FRACA do conjunto — com taxa real de 6,25%, a probabilidade de 13 execuções limpas seguidas é ≈43%, então ela sozinha não prova nada. O que carrega a conclusão é a FALSIFICAÇÃO da hipótese interna: o modo --force executa MAIS trabalho concorrente (10 tarefas contra 6) e falhou MENOS — a única falha ocorreu no modo mais leve, que é a predição da hipótese de contenção interna INVERTIDA.`
`[T5] o QA RECOMENDOU NÃO limitar a concorrência da suíte, com razão mais forte que a da coordenação: capar maxWorkers DESTRÓI SINAL — hoje uma contenção interna genuína apareceria como flake (ruído informativo); capada, viraria lentidão silenciosa. É a mesma família de afrouxar teto de timeout, que ele mesmo proibiu na rodada 3.`
`[T5] BAIXO-002 registrado SEM marcador no código, por decisão do QA: não há ponto de código onde a tensão viva, e marcador sem lugar é o ruído que a §3-B adverte que desarma os marcadores que importam. Gatilho: a SEGUNDA ocorrência, OU a primeira que venha nomeada com log íntegro.`

### Duas correções de PROCESSO que o Gate 1 dirigiu à coordenação — ambas adotadas
1. **Nunca truncar log de suíte com `tail`.** Foi um `tail -40` do próprio QA na rodada 3 que perdeu a identidade do caso instável e que tornaria o gatilho do BAIXO-002 inútil na próxima ocorrência. Regra adotada para o resto do run: redirecionar para arquivo (`> log 2>&1`) e filtrar depois com `grep`.
2. **Serializar as execuções de suíte entre subagentes — não eliminá-las.** Executor, QA e Tech Review rodam suítes completas com sobreposição de processos de fundo; três suítes concorrentes em 12 núcleos é o que produz o `load` 14. A Camada 7 do QA roda integralmente por decisão consciente e NÃO deve ser otimizada; a saída é não rodar ao mesmo tempo. Adotado para T6–T11.
`[T5] Tech Review rodada 2 (final): APROVADO — problems: [] . Os dois bloqueantes fecharam, os dois baixos fecharam, e o Gate 2 registrou que a ADR-0018 entrega MAIS do que ele pediu.`
`[T5] o Gate 2 conferiu o 24 por contagem INDEPENDENTE (7 usuarios + 6 master + 6 conjunto + 2 saude + 1 sessao + 1 senha + 1 encaminhador) e a reconciliação 24−1+7+9 = 39 fecha — segunda verificação independente do mesmo número, por gates diferentes`
`[T5] o Gate 2 destacou o ramo (b) do REVERTER EXIGE novo e por que ele é seguro, o que não era óbvio: se a classe parar de declarar, as outras quatro rotas ficam SEM metadado algum e a guarda as recusa com 403 para todo mundo — falha alta e imediata, nunca silenciosa`
`[T5] o Gate 2 apontou que a ADR-0018 registrou uma QUINTA alternativa rejeitada que ele não havia pedido — "confiar na coerência do catálogo" — e que ela é a melhor da lista: eleva o achado P2 de marcador de código a decisão registrada, que é onde ele dura mais`
`[T5] ausência de superseded-by na 0011 julgada CORRETA e não omissão: os Neutros da própria 0011 declaram extensão aditiva como não invalidante, então supersede seria churn e apagaria a distinção entre ESTENDER e SUBSTITUIR`
`[T5] inventário corrigido pelo Gate 2: apps/api/src/autenticacao/exigencia.decorator.ts também está no delta (uma palavra em docblock, ADR-0011 → ADR-0018) e não constava da lista que a coordenação passou — atribuição correta, registrada para exatidão do inventário`
`[T5] ledger: 8 achados totais | 5 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T5] leitura da métrica: os 5 achados de rodada >1 nasceram do próprio trabalho das rodadas seguintes (a correção do crítico gerou P1–P4; a âncora gerou MED-002; a suíte gerou BAIXO-002). Nenhum aponta para arquivo/símbolo que a rodada 1 tivesse deixado sem varrer.`
`[T5] CONCLUÍDA em 4 rodadas — 2 por bloqueio de gate (CRÍTICO de segurança na rodada 1; dois MÉDIOS bloqueantes do Gate 2 na rodada 3) e 2 por adoção de recomendação. 3 débitos anotados.`

### T6
`[T6] base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1 · executor: opus · dependência satisfeita: T5 (concluída e staged)`
`[T6] a T6 herda os SETE itens do molde da T5 (§4 do run-report), com destaque para a quarta âncora, que sobe por MANIPULADOR e não por par de rota`
`[T6] processo ajustado a partir da T5: logs de suíte capturados em arquivo (nunca `tail`), e execuções de suíte SERIALIZADAS entre subagentes`

## ⏸️ PAUSA CONTROLADA — autorizada pelo usuário em 2026-08-06

**Ponto exato de parada**: a **T6 teve o executor concluído** e **NENHUM gate rodou ainda**. O código está escrito e a suíte está verde, mas a task **não passou por QA nem por Tech Review**.

### Como retomar (opção (a) do resume da FASE 0 — "Retomar nos gates")

O código parcial já existe e está íntegro. **Não reexecutar o executor.** A retomada correta é despachar o **Gate 1 (QA)** direto, com:

- `base_sha` = `621489e38b08f5f280bf2ae09799de4aa3ad4fa1` (o mesmo de todo o run — nenhum commit foi feito)
- **Arquivos tocados pela T6** (já apurados, com `git add -N` aplicado): `packages/db/src/imovel.ts`, `packages/db/src/index.ts`, `packages/db/test/unidade-de-trabalho.spec.ts`, `apps/api/src/imoveis/imovel.controller.ts`, `apps/api/src/imoveis/imovel.service.ts`, `apps/api/src/imoveis/imoveis.module.ts`, `apps/api/src/app.module.ts`, `apps/api/src/autenticacao/exigencia.decorator.ts`, `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`, `apps/api/test/contexto.e2e.spec.ts`, `apps/api/test/validacao.spec.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`
- `gates: [qa, tech_review]` (declarado no frontmatter)
- Executor ainda vivo para correções: agente `ac060997de77ba140`

### Baseline no momento da pausa
`pnpm test` VERDE, exit 0, **10/10 tarefas turbo** — `@sysloc/api` **108** (era 104), `@sysloc/auth` 89, `@sysloc/db` 45, `@sysloc/shared` 190, `@sysloc/worker` 16, `@sysloc/contracts` 48. Log íntegro em `scratchpad/t6-baseline.log`.

### Três pontos que o QA precisa julgar quando a T6 for retomada

1. **A unicidade foi implementada com `tx.savepoint`**, e a razão é um achado técnico do executor: a violação `23505` **aborta a transação**, então a leitura que enriquece a mensagem seria impossível na mesma unidade. A escrita corre atrás de um savepoint e, só depois do `rollback to`, a porta lê o estado do registro em conflito. **Não é leitura-antes-de-gravar** — o mecanismo continua sendo a restrição do banco. O executor afirma que o `savepoint` é o aninhamento que o próprio `REVERTER EXIGE` do marcador de `unidade-de-trabalho.ts` nomeia como correto, e que a decisão fechada não foi tocada. **Verificar as duas coisas.**
2. **Dois sub-casos fora da §6.6** — `CT-310 (b)` e `CT-333 (b)` — foram acrescentados porque dois itens do aceite técnico §4 (*unicidade alcançando retirados*, *mudança de conjunto pelo `PUT`*) **não tinham caso na §6.5**; sem eles, dois dos quatro mutantes sobreviveriam. Julgar se a extensão é legítima.
3. **`SIMBOLOS_ESPERADOS` do CT-012 foi atualizado sem estar declarado na §5.2** (+6: as cinco funções e a classe de erro) — blast radius não previsto, análogo aos das tasks anteriores.

### Estado geral do run na pausa
- **T1–T5 concluídas e staged** (69 arquivos no índice, nada commitado — o pipeline nunca commita)
- **T6**: executor concluído, gates pendentes
- **T7–T11**: não iniciadas
- **9 débitos anotados** na §2 do `run-report.md` (D3, D4, D5, D6, D7, D8, D9)
- **ADR-0018 criada** na T5 e indexada

## ▶️ RETOMADA — 2026-08-06

`[run] resume: opção (a) "Retomar nos gates" — escolhida sem pausa por autorização explícita do usuário ("minha resposta SEMPRE será o recomendado")`
`[run] autorização registrada: teto de 3 tentativas DISPENSADO para todo este run — "PODE exceder o quanto for necessário até não ter mais bloqueios"`
`[run] executor resolvido: __default__ (agente genérico) — .claude/agents/ contém apenas os três agentes reservados aos gates`
`[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
`[T6] retomada nos gates: executor NÃO reexecutado; código parcial íntegro; base_sha=621489e38b08f5f280bf2ae09799de4aa3ad4fa1`
`[T6] delta apurado por 'git diff --name-only' (não-staged), que isola a T6 do resíduo staged de T1–T5: 10 arquivos de código/teste`
`[T6] fora do delta de código, 4 arquivos não-declarados aparecem não-staged e NÃO são da T6: deploy/scripts/roadmap/atualizar-roadmap.sh e docs/plano-backend-novo/roadmap.md (gerados pelo gancho PostToolUse do roadmap), docs/specs/domain-glossary.md e tasks/T1.md (fase de spec). Passados ao Gate 2 como candidatos a scope_deviation.`
`[T6] gates: [qa, tech_review] (declarado no frontmatter) · risk: medium · diff_touches_critical_path=true (cobertura-de-autorizacao.e2e.spec.ts → categoria security/authorization) · qa_model=opus · tech_model=opus`
`[T6] ADRs injetadas no executor: ADR-0008, ADR-0011, ADR-0014, ADR-0017 (fonte: task §7) — injetadas na execução original, antes da pausa`
`[T6] QA rodada 1: APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 1 médio anotável (code_quality), 2 baixos (tests). Nenhum bloqueante pela partição.`
`[T6] baseline comparada CASO A CASO pelo QA e ela BATE: api 108, auth 89, db 45, shared 190, worker 16, contracts 48 — idênticos ao registrado na pausa. Sem R2. Log íntegro (sem tail), execução única, D9 não disparou.`
`[T6] ponto 1 (savepoint) JULGADO: as DUAS afirmações do executor são verdadeiras. (a) não é leitura-antes-de-gravar — nenhum SELECT antecede INSERT/UPDATE em caminho algum; a restrição é TOTAL (0005_dominio_locacao.sql:116, UNIQUE sem WHERE), logo alcança retirados como a decisão D4 exige. (b) unidade-de-trabalho.ts NÃO está no diff; a guarda protegida mira `sql.begin` (conexão nova), e `tx.savepoint` é literalmente o aninhamento que o REVERTER EXIGE nomeia como correto.`
`[T6] ponto 2 (CT-310 (b) e CT-333 (b)) JULGADO LEGÍTIMO e obrigatório: os itens 2 e 5 do aceite §4 não tinham caso algum na §6.5; sem eles o aceite ficaria sem prova. Necessidade medida, não argumentada — CT-310 sozinho só exercita imóvel EM circulação (MT6-1 passa); CT-333 sozinho só exercita a criação (MT6-3 passa).`
`[T6] ponto 3 (âncoras) JULGADO: NENHUM AP-24. As quatro âncoras de cobertura-de-autorizacao, mais ROTAS_PROTEGIDAS_ACEITAS, IMPORTADORES_ESPERADOS e SIMBOLOS_ESPERADOS, seguem afirmando por IGUALDADE EXATA, nenhuma entrada anterior saiu, nenhum valor afrouxado — as âncoras foram SUBIDAS, que é o modo correto.`
`[T6] MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 30 conferido por CONTAGEM INDEPENDENTE do QA (grep dos decoradores em apps/api/src): 1 sessao + 1 senha + 1 encaminhador + 2 saude + 6 master + 7 usuarios + 6 conjunto + 6 imovel. Terceira verificação independente desta âncora no run.`
`[T6] D7 NÃO FECHOU E CRESCEU — verificado por grep: `empresaDoContexto` agora em pessoa.ts:140, conjunto.ts:143 e imovel.ts:255 (TERCEIRA cópia, exatamente o que a instrução do D7 mandava evitar); `incluirRetirados` em conjunto.controller.ts:188 e imovel.controller.ts:162 sem promoção a @sysloc/contracts. O docblock reconhece e REAGENDA o débito para "a task que publicar a terceira" — transparente, mas move o gatilho em vez de fechá-lo.`
`[T6] QA levantou e DESCARTOU sozinho a suspeita de cobertura de `listarImoveis`: o CT da §6.6 da T9 cobre por tabela de cinco entidades × duas listagens, e a T10 acrescenta CT-329/CT-330. Agendado e nominado, não esquecido.`
`[T6] antipadroes_verificados: 5/5 arquivos de teste declarados (sweep completo, não amostragem). Dois AP-16 detectados e julgados aceitáveis no contexto.`
`[T6] Tech Review rodada 1: APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 0 bloqueantes. P1 MEDIO/project_pattern (anotável), P2/P3/P4 BAIXO. adrs_consultadas: 0008, 0011, 0014, 0016, 0017, 0018.`
`[T6] o Gate 2 foi ALÉM do Gate 1 no ponto do savepoint: não só a DECISÃO FECHADA não foi tocada como o REVERTER EXIGE dela está SATISFEITO — ele pede "caso que prove que o desfazimento do ramo interno não deixa efeito gravado", e o CT-310/CT-310 (b) afirmam a contagem crua após cada recusa, com o mutante MT6-4 reprovando os dois. Condição cumprida, não contornada.`
`[T6] o Gate 2 RECLASSIFICOU o D7 de code_quality para project_pattern, e a razão tem valor de longo prazo: a causa-raiz não é código feio, é a prática oposta já estabelecida TRÊS vezes nesta base (esquema-publicado.ts, validacao.ts que fechou o D38, esquema-de-erro.ts que fechou o D40) e não escrita em rule nenhuma. Foi essa reclassificação que destravou o sinal RC-001.`
`[T6] o Gate 2 RECUSOU elevar o D7 a adr_compliance, com razão lida na Decision integral da ADR-0016: ela proíbe descrição de contrato escrita à mão EM PARALELO ao esquema; ESQUEMA_DA_CONSULTA é um esquema e a conferência deriva dele. É drift (esquema no pacote errado para efeito de handoff), não contradição literal do Decision.`
`[T6] o Gate 2 mediu por que o D7 NÃO é risco de tenant: a política de negocio.imovel é FORCE RLS com USING E WITH CHECK de expressão idêntica (0006_seguranca_dominio.sql:82-86), então divergência entre as três cópias produziria escrita RECUSADA pelo banco, nunca escrita cruzada. É o que sustenta a decisão de adiar.`
`[T6] o Gate 2 CORRIGIU a atribuição da coordenação sobre um arquivo não declarado: deploy/scripts/roadmap/atualizar-roadmap.sh NÃO é produto do gancho PostToolUse — o gancho executa o script, não o edita. A linha alterada troca o mapeamento da F2 de dominio-locacao/v1 para cadastro-de-imoveis-e-pessoas/v1;contratos-de-locacao/v1, que é edição de coordenação da fase de spec. Conclusão prática inalterada; atribuição corrigida.`
`[T6] DECISÃO DA COORDENAÇÃO sobre os 6 achados não-bloqueantes — 3 adotados (QA-BAIXO-001, QA-BAIXO-002, TR-P4), 1 adotado pela própria coordenação (TR-P2, escrituração da §2), 2 anotados como débito seguindo recomendação EXPLÍCITA do Gate 2 de não corrigir na T6 (D7/TR-P1 → "próxima task que abrir a superfície"; TR-P3 → "Não corrigir dentro da T6", é transversal e alcança a T5).`
`[T6] attempt_sha (rodada 1)=44a7550787aec25bfc4ae44b50a60366d75be6a6 — rodada 2 roda em scan_scope DELTA`
`[T6] rodada 2 (adoção) concluída: 4 arquivos tocados. CT-333 (b) ganhou terceira metade (unicidade na ALTERAÇÃO), CT-310 (c) nasceu em packages/db/test (alcance do SAVEPOINT), marcador DÉBITO COM GATILHO D11 sobre comAgregadoDeComodos. db 45 → 46; api 108 → 108 por decisão (mesma invariante, +8 asserções). MT6-5 e MT6-6 aplicados, reprovaram, revertidos.`
`[T6] QA rodada 2: APROVADO — problemas: [] em todas as severidades. Baseline caso a caso contra o log íntegro da PRÓPRIA rodada 1 (não contra o sumário do executor): api 108→108, auth 89→89, db 45→46, shared 190→190, worker 16→16, contracts 48→48. Total 496→497.`
`[T6] os três achados abertos do Ledger SANADOS e verificados um a um: QA-BAIXO-001 (a metade 3 é INCAPAZ de passar com o MT6-5 — toBe(422) contra o 500 do mutante), QA-BAIXO-002 (CT-310 (c) monta tudo por função pública da porta; imovel.ts conferido byte a byte idêntico à cópia de controle ⇒ Iron Law #6 satisfeita), TR-P4 (marcador com os quatro campos + ÍNDICE).`
`[T6] o QA provou a complementaridade do CT-310 (c) ao MT6-4 em vez de afirmá-la: o MT6-4 mede a FORMA da resposta HTTP e ficaria verde sobre uma implementação que traduzisse a recusa e perdesse tudo o que a unidade gravou antes — porque pela rota cada requisição abre a sua unidade. O CT-310 (c) usa UMA unidade que COMMITA, e é isso que torna observável 'desfez só a instrução' contra 'desfez tudo'.`
`[T6] AP-26 descartado com prova aritmética, não por impressão: CT-310 (c) × CT-210 coincidem em 0/4 da tupla (alvos disjuntos, resultados OPOSTOS por construção); CT-333 (b) metade 3 × CT-310 coincidem em 1/4 (só o resultado). AP-23 descartado pelo par de mutantes, que separa as camadas — MT6-4 mata os casos de apps/api e não alcança o de packages/db; MT6-6 mata só o de packages/db.`
`[T6] Tech Review rodada 2: APROVADO — problems: []. Raio de impacto determinado com CONFIANÇA e DELTA mantido, sem fallback para FULL: imovel.ts é o único arquivo de produção do delta e teve ZERO linhas removidas, logo o raio por símbolo é vazio POR CONSTRUÇÃO; os outros três são folhas.`
`[T6] o Gate 2 verificou a ausência de regressão nas QUATRO pontas pedidas: (a) imovel.ts com 16 linhas + e nenhuma -, corpo de comAgregadoDeComodos como linha de CONTEXTO; (b) SIMBOLOS_ESPERADOS vive em 285-380 e não há hunk nessa região; (c) unidade-de-trabalho.ts sequer entra no delta, as DUAS DECISÃO FECHADA (201 e 238) intocadas; (d) as ÚNICAS remoções do delta inteiro são docblock substituído por docblock mais longo.`
`[T6] o Gate 2 confirmou o gatilho do D11 contra a T7.md e não contra a afirmação do executor: a T7 declara criar packages/db/src/comodo.ts (acrescentarComodo/alterarComodo/removerComodo) e somarMetragem, e consome db/imovel.ts da T6 — ela É o primeiro escritor de negocio.comodo.`
`[T6] o Gate 2 verificou o CT-014 e ele NÃO foi violado pelo CT-310 (c) chamar contextoDeTenant.executarCom: AREAS_DE_PRODUCAO só desce para o subdiretório src de cada pacote, e o próprio fonte declara que testes escrevem contexto por ofício. CHAMADORES_LEGITIMOS intocado.`
`[T6] o Gate 2 levantou uma FRAGILIDADE DE PROCESSO que a coordenação adota para o resto do run: o marcador D11 foi escrito reivindicando um número que a §2 ainda não tinha (ela terminava em D9). Fechou certo porque exatamente um débito (D10) foi registrado antes — mas dois ou nenhum fariam o número colidir ou furar. REGRA ADOTADA: reservar o número na §2 ANTES de mandar o executor escrever o marcador.`
`[T6] ledger: 7 achados totais | 0 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T6] leitura da métrica: a rodada 2 devolveu ZERO achados novos nos dois gates. Os 7 nasceram todos na rodada 1, e a varredura dela não deixou nada para trás — é o melhor resultado possível desta métrica, e o primeiro do run.`
`[T6] CONCLUÍDA em 2 rodadas, NENHUMA por bloqueio de gate. Rodada 1 aprovou nos dois; rodada 2 foi adoção de 3 das 6 recomendações não-bloqueantes e fechou com APROVADO limpo. 3 débitos anotados (D7 com dono corrigido, D10 e D11 novos).`
`[T6] staged: packages/db/src/imovel.ts, packages/db/src/index.ts, packages/db/test/unidade-de-trabalho.spec.ts, apps/api/src/imoveis/{imovel.service.ts,imovel.controller.ts,imoveis.module.ts}, apps/api/test/{cadastro-de-imoveis,cobertura-de-autorizacao,contexto}.e2e.spec.ts, apps/api/test/validacao.spec.ts, docs/specs/features/cadastro-de-imoveis-e-pessoas/**, CLAUDE.md. Índice em 86 arquivos.`
`[T6] o primeiro 'git add' ABORTOU inteiro por um pathspec inexistente (apps/api/src/imoveis/imovel.ts, que nunca existiu — são imovel.service.ts e imovel.controller.ts) e não staged NADA. git add é tudo-ou-nada em pathspec inválido; conferir 'git diff --name-only' depois do stage é o que pegou.`
`[T6] TRÊS arquivos seguem não-staged de propósito, e não são da T6: deploy/scripts/roadmap/atualizar-roadmap.sh e docs/specs/domain-glossary.md (fase de spec, mtime 2026-08-05) e docs/plano-backend-novo/roadmap.md (regenerado pelo gancho PostToolUse a cada mudança de _run/*state.yaml).`

### T7
`[T7] dependência satisfeita: T6 (concluída e staged). base_sha permanece 621489e38b08f5f280bf2ae09799de4aa3ad4fa1 — o pipeline não commita.`
`[T7] a T7 HERDA DOIS DÉBITOS com dono nela: o D11 (remover o marcador de comAgregadoDeComodos, a linha do índice do CLAUDE.md e o bloco da §2, no MESMO commit da correção) e a metade 'empresaDoContexto' do D7 (lar único em packages/db/src/, antes que a quarta cópia nasça).`
`[T7] executor: opus (frontmatter declara sonnet, mas o CLAUDE.md do projeto proíbe sonnet/haiku sem negociação — onde a regra do framework mandar sonnet, leia opus) · gates: [qa, tech_review] (declarado) · risk: medium · diff_touches_critical_path=true (cobertura-de-autorizacao.e2e.spec.ts) · qa_model=opus · tech_model=opus`
`[T7] ADRs injetadas no executor: ADR-0008, ADR-0011, ADR-0014, ADR-0017 (fonte: task §7)`
`[T7] âncoras vigentes conferidas ANTES do despacho, para o executor não as descobrir errado: ROTAS_PUBLICADAS_EM_PRODUCAO=45, MANIPULADORES_EXAMINADOS_EM_PRODUCAO=30, ROTAS_PUBLICADAS_NO_MUTANTE=39. As três sobem 3 nesta task por acidente da forma destas rotas — o executor foi avisado de que derivar uma da outra é erro.`
`[T7] TRÊS divergências entre a §5 e a §6.6 da task passadas ao executor ANTES da implementação, em vez de descobertas por gate: os cards da §6.6 propõem imovel.spec.ts / imoveis.e2e.spec.ts / unidade-na-borda.spec.ts, enquanto a §5 declara metragem.spec.ts e a extensão de cadastro-de-imoveis.e2e.spec.ts. A §5 vence, e a razão é a mesma da divergência 1 da T6.`
`[T7] QA rodada 1: REJEITADO — 1 ALTO (tests/non_deterministic_input). O BLOQUEANTE NÃO É DA T7: é o D9, em apps/api/test/saude.e2e.spec.ts (F0/T5), fora do escopo da task.`
`[T7] a T7 passou em tudo que lhe cabia: 7/7 critérios, 7 CTs verdes, Camada 0 completa, zero violação de ADR, zero mock, zero antipadrão nos 6 arquivos de teste, baseline 497 → 505 sem queda em pacote algum.`
`[T7] o QA REFEZ a prova de falsificação do CT-309 em vez de aceitar a alegação: aplicou o MT7-3 (removeu ORDER BY de comodo.ts:215), invocou pelo script do pacote (nunca vitest avulso) e mediu 1 failed | 51 passed reprovando exatamente no CT-309; reverteu e conferiu por diff.`
`[T7] as três perguntas sobre o desenho do CT-309 vieram FAVORÁVEIS: (a) mata o mutante, medido; (b) o SET LOCAL ajusta o PLANO, não o produto — a consulta é a mesma que localizarImovel emite; (c) a inserção embaralhada do card é IRREPRESENTÁVEL, porque DadosDoComodo não tem campo posicao e ela sai de max+1 dentro do próprio INSERT.`
`[T7] a substituição do terceiro caminho do CT-307 (carteira expandida → definirCirculacaoDoImovel) foi julgada PRESERVADORA do poder discriminante: a carteira não existe nesta fatia e afirmá-la seria asserção vazia; o substituto tem RETURNING próprio e é genuinamente um terceiro produtor independente de metragemTotal.`
`[T7] GATILHO DO D9 DISPARADO NAS DUAS CONDIÇÕES que a §2 declarava — segunda ocorrência E primeira nomeada com log íntegro. Caso: CT-001 de saude.e2e.spec.ts, AssertionError: expected 528.3241669999989 to be less than 500, linha 490.`
`[T7] o diagnóstico dirigido do D9 estava escrito NO PRÓPRIO ARQUIVO desde a F0/T5 (linhas 470-477): "conexão recusada custa milissegundos, então a latência sozinha não distingue os dois — medido, e não suposto". O autor original já sabia que o teto não discriminava; ele sobrou como custo sem benefício.`
`[T7] D9 FECHADO na rodada 2, e a prova é o que separa isto de afrouxamento: o mutante MT-D9 (rota rasa passa a consultar o banco) reprova o CT-001 pelo SENTINELA (expected 498 to be +0) e o CT-001 (b) pelo ESPIÃO (expected 1 to be +0) — NUNCA pelo tempo. A asserção removida era incapaz de pegar o defeito que ela aparentava guardar.`
`[T7] o executor foi além do pedido e a coordenação registra: depois da remoção NENHUMA asserção de saude.e2e.spec.ts lê relógio de parede, então o que fechou foi a CLASSE e não o caso. Ele também corrigiu o parágrafo do cabeçalho que declarava o teto como "segundo discriminador da fila" — a medição registrada ali (~1s para DEZ consultas) implica ~100ms para uma, abaixo do teto de 500.`
`[T7] órfãos removidos e conferidos por grep: inicio, decorrido, LIMITE_DA_RASA_MS, performance.now(). LIMITE_CASO_MS e LIMITE_DE_CONEXAO_MS PERMANECEM — são teto de ESPERA (timeout de caso e de socket), não asserção de correção. Os dois DECISÃO FECHADA do arquivo seguem íntegros.`
`[T7] 3 execuções integrais pós-correção, todas exit 0 e 505 casos idênticos pacote a pacote — o defeito é intermitente por natureza e uma execução verde não provaria nada.`
`[T7] attempt_sha (rodada 1)=4d83c112b4b4bd40878daf9575aac0c99e294809 — rodada 2 roda em scan_scope DELTA`
`[T7] escrituração da coordenação: bloco D9 REMOVIDO da §2 (resolvido), com o fecho registrado no cabeçalho da seção; bloco D12 ABERTO para sobContextoDaSessao. O QA sugeriu reciclar o número D11, livre desde que a T7 o fechou — RECUSADO, porque o cabeçalho da §2 declara que números consumidos não se reciclam.`
`[T7] QA rodada 2: APROVADO — problemas: [] em todas as severidades. D9 SANADO. 3 execuções (2 integrais + 1 dirigida ao @sysloc/api, onde o defeito vivia), 505 casos idênticos pacote a pacote.`
`[T7] o QA reforçou a prova do MT-D9 com um argumento que o executor não invocou e que é mais forte: a reprovação que ABRIU o D9 mediu 528ms numa execução SEM consulta alguma — o teto já estava abaixo do piso de ruído da máquina. Um teto que nem passa confiavelmente com o código certo nem reprova confiavelmente com o mutante não é discriminador.`
`[T7] o QA mostrou a independência dos dois eixos, que o executor também não invocou: no CT-001 (b) o SaudeService inteiro é substituído por overrideProvider, então o sentinela do banco NÃO participa — logo um mutante mais estreito, que fizesse a rasa consultar APENAS a fila, também seria apanhado. O eixo que o teto justificava está coberto por asserção determinística.`
`[T7] o QA CONCORDOU com a recusa da coordenação em reciclar o número D11 e declarou o próprio apontamento da rodada 1 errado.`
`[T7] ACHADO FORA DE ESCOPO do QA, virou o D13: a classe do D9 foi fechada NO ARQUIVO, não no repositório — apps/worker/test/eco.spec.ts:629 e :725 mantêm duas asserções de relógio de parede da mesma forma. O gate explicitamente NÃO bloqueou por isso (é dívida da F0/T6).`
`[T7] Tech Review rodada 1: PARCIAL — 0 críticos, 0 altos, 2 MÉDIOS de categoria testability (BLOQUEANTE pela partição) e 2 baixos. adrs_consultadas: 0008, 0009, 0011, 0014, 0016, 0017, 0018.`
`[T7] os SEIS pontos que a coordenação pediu para julgar passaram TODOS, três com folga: (1) empresaDoContexto conferido CARACTERE A CARACTERE contra as políticas de 0006 E de 0001 — as duas migrações usam a mesma expressão, e o símbolo NÃO é publicado pelo índice do pacote, o que impede a borda de compor instrução; (5) o DELETE sem ACAO:excluir_cadastro confirmado em três fontes independentes; (6) a remoção do teto de tempo tem a prova que a separa de AP-24.`
`[T7] o Gate 2 julgou o CT-309 desenho ACEITÁVEL com um argumento que fecha a questão: a dependência da física de armazenamento é NECESSÁRIA, não escolha entre alternativas — divergência entre ordem lógica e ordem de retorno SÓ é observável se a ordem física divergir, e a posição é monotônica com a inserção. A alternativa seria asserção estática sobre o texto da consulta, estritamente pior sob a testing-stack.`
`[T7] o Gate 2 apontou um ponto de atenção para a T10 que não é defeito hoje: montarImovel, comAgregado e comAgregadoEmLote são PRIVADOS de imovel.ts, então uma carteira que more em outro módulo reconstrói o agregado à mão e só o CT-307 a alcança SE ela for acrescentada aos produtores comparados.`
`[T7] os dois bloqueantes (P1 e P2) têm a MESMA razão estrutural, e ela é a §7 do Protocolo Antirregressão em estado puro: o código documenta longamente uma guarda e NADA a mantém no lugar. P1 — o AND imovel_id de alterarComodo/removerComodo é prometido em TRÊS docblocks e o CT-332 metade 3, que parece cobri-lo, é CROSS-TENANT (quem barra ali é a RLS, não a cláusula). P2 — somarMetragem soma em centésimos e o próprio docblock admite que os quatro cenários do golden não pegariam o defeito; ela só aparece em teste numa LISTA DE NOMES.`
`[T7] classificação de retry: requires_qa_revalidation=TRUE — os dois bloqueantes são categoria testability, que está em revalidation_required (implica mudar/criar testes, e o QA precisa reexecutar a suíte).`
`[T7] attempt_sha (rodada 2)=d2c5f76afbcde714fac776009b35ea7f4981f276 — rodada 3 roda em scan_scope DELTA`
`[T7] rodada 3 (correção 2): P1 e P2 fechados, P3 e P4 (baixos, correção de texto nos mesmos arquivos) adotados. 505 → 506; db 52→53, api 110→110.`
`[T7] o executor DESMONTOU o exemplo que o próprio Gate 2 sugeriu, e a correção é dele: o par 0.29 + 0.07 NÃO diverge — dá exatamente 0.36 (0.35999999999999998668). Um caso construído sobre ele teria ficado VERDE sobre o MT7-9, isto é, seria uma prova oca provando a coisa certa pelo motivo errado. Trocou por pares MEDIDOS (10.06+10.07→20.13; 18.21+12.13+9.07→39.41) com controle negativo primeiro (expect(10.06 + 10.07).not.toBe(20.13)), que é o que demonstra que discriminam.`
`[T7] o exemplo numérico FALSO que estava no docblock de somarMetragem foi trocado pelos pares medidos — a aritmética não foi tocada. O docblock afirmava um exemplo que não sustentava a própria tese.`
`[T7] o MT7-8 foi partido em TRÊS pelo executor, e o par (a)/(b) é o que justifica as duas metades: com o mutante combinado o caso aborta na metade 4 e NUNCA exercita o DELETE; só separando alterarComodo de removerComodo se vê que a metade 4 atravessa o mutante de removerComodo inteira. Uma metade só teria deixado a outra instrução sem rede.`
`[T7] QA rodada 3: APROVADO — problemas: [] . TR-P1 e TR-P2 SANADOS. 505 → 506 (db 52→53), nenhum pacote caiu.`
`[T7] o QA conferiu a aritmética POR MEDIÇÃO INDEPENDENTE nos dois sentidos e confirmou o executor contra o Gate 2: 0.29+0.07 === 0.36 é TRUE, logo a sugestão do Gate 2 produziria caso verde sobre o próprio mutante; os pares escolhidos divergem de fato (20.130000000000003 e 39.410000000000004).`
`[T7] o QA corroborou a honestidade das medições do executor por ARITMÉTICA DE DESLOCAMENTO: as linhas :1218/:1230 reportadas batem com as atuais 1246/1258 deslocadas de exatamente 28 — o tamanho do bloco de cabeçalho escrito DEPOIS da medição. As medições são internamente consistentes e não redigitadas.`
`[T7] o QA julgou o controle negativo do CT-305 (b) LEGÍTIMO e não AP-29, com a distinção que vale registrar: asserção tautológica SUBSTITUI a prova do SUT; esta ACOMPANHA a prova do SUT e a mantém honesta — ela protege a PREMISSA do caso, não a plataforma.`
`[T7] Tech Review rodada 2: APROVADO_COM_OBSERVACOES — 1 BAIXO (code_quality). O Gate 2 verificou a montagem das metades 4 e 5 de forma INDEPENDENTE do QA e confirmou same-tenant: cookieDeB só aparece na metade 3; com a cláusula fora a rota responde 200, resultado IMPOSSÍVEL se a RLS estivesse recusando.`
`[T7] o Gate 2 ADMITIU O PRÓPRIO ERRO por medição: "a contradição do executor à minha sugestão está CERTA: eu é que estava errado". Mediu em Node e reproduziu nos dois sentidos, independentemente do QA.`
`[T7] o Gate 2 deu um teto para a forma de it agrupado, que vale para as tasks seguintes: 140 linhas e cinco metades é o teto confortável; uma SEXTA metade justificaria partir por eixo (recusa de validação × recusa de contenção), e aí a montagem compartilhada viraria um helper.`
`[T7] o Gate 2 conferiu o P4 por LEITURA e não por grep, e a distinção importa: confirmou que ErroDeIdentificadorMunicipalEmUso e VIOLACAO_DE_UNICIDADE existem em imovel.ts e são traduzidos em imovel.service.ts, enquanto comodo.ts não tem ocorrência alguma de 23505 — logo o erro cru cai na faixa de falha do serviço de traduzir().`
`[T7] correção 3 (ponteiro de linha): os dois números foram REMOVIDOS em vez de atualizados, seguindo a preferência do Gate 2 e a mesma razão que a rule do Ledger usa para proibir linha em fingerprint — a âncora nominal desloca-se junto com o código que nomeia, então o modo de falha deixa de EXISTIR em vez de ser corrigido pontualmente.`
`[T7] a correção 3 trouxe um achado de método: 'git diff' NÃO serve como prova de escopo em arquivo com estado AM no índice — ele devolve a task inteira, não o incremento. O executor demonstrou por reconstrução do estado pré-edição; a coordenação conferiu por grep que nenhum ponteiro numérico remanesce em apps/**/test e packages/**/test.`
`[T7] 506 casos mantidos na correção 3, pacote a pacote; pnpm lint verde em 169 arquivos.`
`[T7] ledger: 7 achados totais | 5 originados em rodada >1 | 4 suspeitos de incompletude da rodada 1`
`[T7] leitura HONESTA da métrica, porque o número cru engana aqui: os 4 são TR-P1..TR-P4, e o Gate 2 só teve a PRIMEIRA passada na rodada 2 — não é varredura incompleta dele, é o Gate 2 achando o que o Gate 1 não achou na rodada 1. O quinto (o ponteiro de linha) foi INTRODUZIDO pela correção 2, então não é incompletude de varredura nenhuma. O sinal real e acionável: os dois bloqueantes eram guardas documentadas sem rede, e a Camada 5 do QA não as pegou na rodada 1 embora os arquivos estivessem no delta dela.`
`[T7] staged: packages/db/src/{comodo,contexto-de-escrita,imovel,conjunto,pessoa,index}.ts, packages/db/test/{metragem,unidade-de-trabalho}.spec.ts, apps/api/src/imoveis/{comodo.service,comodo.controller,imoveis.module}.ts, apps/api/test/{cadastro-de-imoveis,cobertura-de-autorizacao,contexto,saude}.e2e.spec.ts, apps/api/test/validacao.spec.ts, docs/specs/features/cadastro-de-imoveis-e-pessoas/**, CLAUDE.md. Índice em 93 arquivos.`
`[T7] conferência de fecho, sentido MARCADOR → ÍNDICE: packages/db/src/imovel.ts NÃO aparece mais em 'grep -rl DÉBITO COM GATILHO' — o marcador do D11 saiu. Sentido ÍNDICE → MARCADOR: a tabela do CLAUDE.md voltou a oito linhas e a frase-cabeçalho diz "Oito débitos", batendo.`
`[T7] CONCLUÍDA em 4 rodadas — 1 por bloqueio do QA (o D9, defeito de OUTRA fatia), 1 por bloqueio do Gate 2 (dois MÉDIOS de testability) e 2 de correção fina. 3 débitos abertos na task (D12, D13) mais o D7 seguindo pela metade; 3 débitos FECHADOS (D9, D11, e a metade empresaDoContexto do D7).`

### T8
`[T8] dependências satisfeitas: T1, T2, T3 (todas concluídas e staged). base_sha permanece 621489e38b08f5f280bf2ae09799de4aa3ad4fa1.`
`[T8] a T8 HERDA a metade 'incluirRetirados' do D7, com PRAZO DURO: a T9 publica os três controladores de pessoa e faria nascer as cópias TRÊS, QUATRO e CINCO de uma vez.`
`[T8] executor: opus · gates: [qa, tech_review] (declarado) · risk: medium · qa_model=opus · tech_model=opus`
`[T8] ADRs injetadas no executor: ADR-0008, ADR-0014, ADR-0016, ADR-0017 (fonte: task §7 + o D7)`
`[T8] D7 FECHADO INTEIRO: a extensão virou esquemaDaJanelaComCirculacao em @sysloc/contracts e as duas definições locais foram apagadas. Conferência das duas pontas antes de fechar: 'esquemaDaJanela.extend' tem 1 ocorrência (o próprio comum.ts) e 'function empresaDoContexto' tem 1. §2 foi de 9 para 8 débitos.`
`[T8] achado de acoplamento do executor: somenteDigitos roda NA PORTA, não só no contrato, porque o invariante é da COLUNA — isso obrigou @sysloc/shared a sair de devDependencies para dependencies em packages/db/package.json mais referência de projeto no tsconfig. Sem ciclo (shared é folha).`
`[T8] decisão de fronteira que o executor registrou e que a T9 precisa saber: a porta NÃO traduz o 23505 — é o que CT-349/CT-352 exigem (erro.code e nome da restrição). A tradução em 422 + detalhes.conflito é da T9, e ela vai precisar de SAVEPOINT + leitura do conflito NA PORTA, no molde de gravarSobRestricaoDeUnicidade da T6.`
`[T8] QA rodada 1: APROVADO — problemas: [] . 506 → 514 (db +6, contracts +2), nenhum pacote caiu.`
`[T8] o QA confirmou ZERO superfície de injeção na parametrização por tabela: tabelaDoPapel é o único produtor de nome, as 6 ocorrências de FROM/INTO/UPDATE interpolado chamam todas ela, e TABELA_POR_PAPEL não sai no índice do pacote.`
`[T8] o QA registrou uma DEPENDÊNCIA DURA para a T9: enquanto a tradução do 23505 não chegar, ele sobe cru ao filtro-excecao.ts e vira 500. Inalcançável hoje (sem rota), mas o CT-312 precisa fechá-la ANTES de qualquer rota de criação/alteração ir ao ar.`
`[T8] o QA percorreu o AP-29 no segundo it do CT-351 e o JULGOU NÃO-PRESENTE com raciocínio registrado: a asserção real é o par de @ts-expect-error (o mutante MT8-4 demonstra que o it PODE falhar), e as duas linhas de execução são exigência do noUnusedLocals, não prova.`
`[T8] Tech Review rodada 1: PARCIAL — 0 críticos, 0 altos, 2 MÉDIOS de categoria testability (BLOQUEANTE). adrs_consultadas: 0008, 0014, 0016, 0017.`
`[T8] os CINCO pontos pedidos passaram TODOS, e o Gate 2 acrescentou duas camadas que o QA não tinha visto na análise de injeção: packages/db/package.json publica apenas o subcaminho "." (apps/api não consegue importar o módulo mesmo querendo), e unidade-de-trabalho.spec.ts fixa o conjunto do índice por igualdade exata.`
`[T8] o Gate 2 RECUSOU registrar o resíduo do 23505 como débito na §2, com razão da rule: o CT-312 já existe declarado em T9.md:163-182 com o corpo de recusa afirmado por extenso, e a T9 não passa nos gates sem ele — rede MAIS FORTE que uma linha na §2. E um DÉBITO COM GATILHO seria ativamente errado: a §3-B reserva o marcador para débito que dispara DEPOIS do fecho da fatia, e advertir para a task imediatamente seguinte é o ruído que desarma os marcadores que importam.`
`[T8] os DOIS bloqueantes nasceram de conferir O OUTRO LADO de afirmações que o Gate 1 aceitou. P1: o Gate 2 foi LER o CT-313 em T9.md:183-201 e os quatro passos declarados são todos de CRIAÇÃO; varreu T9 e T10 inteiras e nenhum caso exercita PUT com DV inválido. P2: foi conferir a analogia do docblock e mediu que somarMetragem TEM consumidor de produção (imovel.ts:293) e TABELA_POR_PAPEL não tem nenhum.`
`[T8] o Gate 2 mostrou que o export do P2 é REDUNDANTE usando o registro de mutantes do próprio executor: o MT8-1 (dois papéis para a mesma tabela) reprovou em QUATRO casos, não só no CT-351 — a cardinalidade já é afirmada comportamentalmente pelas três contagens do CT-350, e a totalidade das chaves é garantida pelo compilador via Record<PapelDePessoa, string>.`
`[T8] nota lateral do Gate 2, registrada para não ser redescoberta: a normalização tem hoje DUAS implementações — somenteDigitos em shared e um .transform(replace(/\D/g)) embutido em contracts/src/pessoa.ts:52. A segunda é ANTERIOR à T8 e estruturalmente forçada (contracts é folha por decisão; importar shared arrastaria pino para o pacote que o frontend importa). A divergência na direção que importa é pega pelo CT-352, que lê a coluna crua.`
`[T8] classificação de retry: requires_qa_revalidation=TRUE — os dois bloqueantes são testability, que está em revalidation_required.`
`[T8] QA rodada 2: APROVADO_COM_OBSERVACOES — 1 MÉDIO/documentation (anotável). O gate REFEZ o MT8-1 e mediu 3 failed | 56 passed exatamente nos casos declarados; reverteu, conferiu por diff -q e RODOU pnpm build antes da suíte final, porque o tsc --build do script compila o mutante para o dist/ que apps/api consome.`
`[T8] o QA foi ALÉM DO TEXTO para julgar a emenda do CT-313, e a checagem é a que decide: um card só no papel não fecharia nada se o ESQUEMA DE ENTRADA já recusasse o DV antes de o serviço ser alcançado. Ele foi ler contracts/src/pessoa.ts:49-53 — o esquema só remove não-dígitos e exige min(1), e o docblock declara que a conferência de DV NÃO acontece ali. Logo o mutante atravessa o esquema e o CT-313 emendado o pega.`
`[T8] o QA registrou também que o card é PRECISO ao restringir a entrada ao "CPF e CNPJ de DV errado, no mínimo": cadeia vazia e cadeia com letras morrem no min(1) do esquema e provariam a camada errada.`
`[T8] o achado MÉDIO do QA era pior que cosmético: o registro do MT8-1 descrevia ERRADO qual asserção mata o CT-350 — ele morre na iteração do LOCADOR, na leitura por identificador, e as três contagens PASSAM ali. A frase errada era REAPROVEITADA no SUT_IS_CORRECT_BECAUSE: que justifica a remoção de asserções da rodada anterior.`
`[T8] Tech Review rodada 2: APROVADO_COM_OBSERVACOES — 1 BAIXO (ponteiro de linha off-by-14 no registro RECÉM-CORRIGIDO). O Gate 2 derivou a ordem de disparo DO CÓDIGO, sem reexecutar, e confirmou o texto novo como auditável.`
`[T8] o Gate 2 julgou a remoção das três asserções do CT-351 e concordou item a item, com um argumento que vale registrar: a totalidade das chaves passa a ser propriedade do COMPILADOR, e isso é detecção MAIS FORTE e não mais fraca — impede o defeito de existir em vez de observá-lo depois.`
`[T8] resíduo teórico que o Gate 2 registrou sem alterar o veredito: a distinção das tabelas migrou de oráculo UNITÁRIO para oráculo de INTEGRAÇÃO (CT-350/CT-350 (b), que exigem banco). Num ambiente que só rodasse a metade unitária a propriedade ficaria sem observação — inofensivo aqui, porque a convenção é suíte completa com embedded-postgres.`
`[T8] o Gate 2 julgou a QUESTÃO 5 e ABSOLVEU a frase do CT-350: ela é contrafactual sobre um caso hipotético de papel único, verdadeira sob a leitura existencial, e difere em natureza do achado do Gate 1 — que era afirmação sobre execução real e mensurável. Nota de precisão sem defeito: a leitura UNIVERSAL de "num dos três ramos" seria falsa quando o ramo defeituoso é o próprio locador.`
`[T8] TERCEIRA OCORRÊNCIA do padrão "ponteiro de linha em comentário de teste" no run (duas na T7, uma na T8), e nas três o número foi escrito NA MESMA EDIÇÃO QUE O INVALIDOU. Emitido convention_drift em _run/rule-candidates.md.`
`[T8] correção 3: o ponteiro virou âncora simbólica; varredura confirma ZERO ponteiro numérico restante no arquivo. 514 casos idênticos pacote a pacote.`
`[T8] LAPSO DA COORDENAÇÃO registrado: a memória lazy da T8 não foi criada quando o Gate 2 reprovou na rodada 1 — o Passo 9 da skill a exige nesse caminho ("QA aprovou → TR reprovou"). O Gate 1 da rodada 2 sentiu a falta, registrou em observacoes e seguiu sem ela. Consequência real: os achados do Gate 2 não puderam ser cruzados por fingerprint naquela rodada. Criada em atraso; não repetir na T9.`
`[T8] ledger: 3 achados totais | 1 originado em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T8] leitura da métrica: o único achado de rodada >1 (o registro errado do MT8-1) foi INTRODUZIDO pela correção da própria rodada 2 — não é varredura incompleta. Os dois da rodada 1 nasceram do Gate 2 conferindo O OUTRO LADO de afirmações que o Gate 1 tinha aceitado, que é o valor de ter dois gates com contratos diferentes.`
`[T8] staged: packages/db/src/cadastro-de-pessoa.ts + contexto/index, packages/db/test/cadastro-de-pessoa.spec.ts, apps/api/src/cadastros/**, packages/contracts/src/{comum,index}.ts, packages/contracts/test/esquemas.spec.ts, os dois controladores de imóveis, packages/db/{package.json,tsconfig.json}, pnpm-lock.yaml, docs/**. Índice em 97 arquivos.`
`[T8] CONCLUÍDA em 3 rodadas — 1 por bloqueio do Gate 2 (dois MÉDIOS de testability) e 2 de correção fina de texto. D7 fechado inteiro.`

### T9
`[T9] dependências satisfeitas: T8 e T6 (concluídas e staged). base_sha permanece 621489e38b08f5f280bf2ae09799de4aa3ad4fa1.`
`[T9] DESVIO DELIBERADO DO FRONTMATTER, com razão registrada: a task declara gates: [qa] justificando "tipo=crud_handler sobre pattern existente". A coordenação roda os DOIS gates. Três fatos mudaram o tipo dela depois que o frontmatter foi escrito: (1) o Gate 1 da T8 registrou que a tradução do 23505 em 422 + detalhes.conflito é trabalho da T9 e vai exigir SAVEPOINT + leitura do conflito na porta, no molde da T6 — isso é service_complexo, não crud_handler; (2) ela toca apps/api/test/cobertura-de-autorizacao.e2e.spec.ts, que é a guarda de cobertura de autorização (categoria security nos critical paths); (3) ela publica 18 rotas declarando exigência, com SEIS delas carregando ação sensível. A rule é explícita no default: "na dúvida entre [qa] e [qa, tech_review], escolha [qa, tech_review] — pular Tech Review indevidamente em área crítica é mais caro do que rodá-lo num CRUD trivial".`
`[T9] executor: opus · gates: [qa, tech_review] (ESCALADO pela coordenação, ver acima) · risk: low no frontmatter, tratado como medium pelo critical path · qa_model=opus · tech_model=opus`
`[T9] ADRs injetadas no executor: ADR-0008, ADR-0011, ADR-0014, ADR-0017 (fonte: task §7) + ADR-0018 (composição de exigências, criada na T5 e aplicável a toda rota nova)`
`[T9] PENDÊNCIA DIRIGIDA herdada da T8, assumida pela coordenação e injetada no prompt: o item 2b da §6.5 (variante de ALTERAÇÃO do CT-313) é o ponto único que precisa sobreviver — o ramo de exigirDocumentoValido em alterar() existe hoje em código SEM PROVA EM CAMADA ALGUMA, e a única rede entre o fecho da T8 e a implementação da T9 é textual.`
`[T9] a T9 HERDA o débito D12: sobContextoDaSessao está na terceira cópia, e a T9 faria nascer a quarta, quinta e sexta de uma vez.`
`[T9] QA rodada 1: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 2 baixos. O gate REPRODUZIU o MT9-1 (removeu exigirDocumentoValido de alterar() mantendo em criar()) e mediu 1 failed | 115 passed com "expected 200 to be 422" na variante de ALTERAÇÃO: a pendência dirigida da T8 fechou com rede medida.`
`[T9] o QA contou os 51 manipuladores DO ZERO por grep e bateu com a âncora; registrou que superficie-de-cadastro.ts NÃO entra na contagem por não ter decorador de rota, que é o que faz o crescimento ser dezoito e não seis.`
`[T9] Tech Review rodada 1: PARCIAL — 1 bloqueante MEDIO/architecture, 2 MÉDIOS anotáveis e 1 BAIXO. Os SEIS pontos pedidos confirmaram-se a favor do executor.`
`[T9] o Gate 2 LEU O DRIVER (postgres@3.4.9/src/index.js:283-289) para provar que tx.savepoint chama scope() com a MESMA conexão, emitindo savepoint sN e rollback to sN — nunca begin. E conferiu os três nomes de RESTRICAO_DO_DOCUMENTO contra a migração 0005.`
`[T9] o bloqueante do Gate 2 tem uma forma que vale registrar: a inversão de topologia foi ABSOLVIDA (traduzir por dentro apagaria os CT-349/CT-352 da T8), e o que ele reprovou foi o que ficou de fora — a invariante declarada em TRÊS docblocks e que nada impunha, num repositório que TEM o idioma pronto e o aplicou NO MESMO DIFF a uma invariante menor.`
`[T9] o Gate 2 achou um agravante que o Gate 1 não mediu: existem DUAS funções criarPessoa no monorepo (@sysloc/auth, onboarding de identidade; e @sysloc/db, cadastro do domínio) — importar do pacote errado é erro plausível e silencioso.`
`[T9] o P2 do Gate 2 é o QUARTO comentário verificável e falso deste run, e o pior deles: os três anteriores erravam sobre ONDE uma asserção dispara; este afirmava uma PROPRIEDADE DE EXPOSIÇÃO DE INFORMAÇÃO ("nunca chega ao cliente") e, nas palavras do gate, "licencia exatamente o defeito que ele parece prevenir".`
`[T9] o P3 é o TERCEIRO veredito de gate sobre "export sem consumidor externo" (MENSAGEM_POR_CODIGO na T8, TABELA_POR_PAPEL na T8, agora quatro constantes na T9). Emitido convention_drift em _run/rule-candidates.md.`
`[T9] o Gate 2 ABSOLVEU a quarta variante de sobContextoDaSessao (UsuarioService) com a razão que decide: ela executa garantirVinculoDeAcesso dentro da unidade, que é o fecho do D32 — unificar imporia esse vínculo às rotas de imóvel e cadastro (mudança de comportamento sem requisito) ou pediria gancho opcional (speculative_complexity).`
`[T9] LIMITE RESIDUAL do CT-355 que os dois gates registraram e que NÃO é defeito da T9: um controlador que não declarasse NADA na classe e só a ação no método passaria no CT-355 (conjunto da classe vazio ⇒ contenção vacuamente verdadeira). O predicado da ADR-0018 é "nenhum manipulador exige menos do que a classe dele exige" — fechar esse flanco seria decisão de ADR, não de gate.`
`[T9] attempt_sha (rodada 1)=5e280f6a646efc5a25c155756186262ce33f550a`
`[T9] QA rodada 2: APROVADO_COM_OBSERVACOES — TR-P1/P2/P3 sanados. O gate REFEZ o MT9-8 e foi ALÉM: removeu SÓ a linha "void criarPessoa;" e mediu TS6133, provando que o artifício é NECESSÁRIO (sem ele o tsc aborta e o mutante seria inexecutável) e que NÃO contamina (a asserção lê a declaração de importação; o void mora no corpo de um método).`
`[T9] o QA julgou o AP-29 do CT-356 e mediu que a guarda contra vacuidade é DUPLA: a âncora de não-vacuidade fecha o primeiro padrão, e a igualdade sobre os homônimos de @sysloc/auth fecha o segundo — sem ela, um especificador quebrado (casando nada) seria INDISTINGUÍVEL de um que discrimina.`
`[T9] Tech Review rodada 2: APROVADO_COM_OBSERVACOES — 1 BAIXO (coesão de validacao.spec.ts). O gate REFEZ a medição do limite residual por conta própria e foi além do Gate 1: mediu ZERO namespace imports em TODO apps/api/src (não só dos dois pacotes), zero importação dinâmica, e conferiu um terceiro caminho que ninguém tinha medido — re-exportação (export ... from '@sysloc/db'), também zero.`
`[T9] o Gate 2 julgou o mutante MT9-8 "o mais conservador dos dois": a asserção é sobre ALCANCE, não sobre chamada, e importação-sem-chamada é a violação MÍNIMA — uma chamada real seria superconjunto (exigiria a mesma importação).`
`[T9] o Gate 2 deixou adrs_consultadas VAZIO DELIBERADAMENTE e explicou: o delta não altera comportamento algum, nenhuma Decision foi engajada, e "listar ADR cujo texto integral eu não abri seria a citação por paráfrase que este repositório já viu divergir do texto real".`
`[T9] DUAS imprecisões menores que o Gate 2 registrou sem promover a problems[]: o docblock diz que o especificador fica "dez linhas abaixo" e são NOVE (a afirmação operante — importação multilinha — é verdadeira); e o docblock de superficie-de-cadastro cita como precedente a despublicação de MENSAGEM_POR_CODIGO, que hoje está PÚBLICO de novo por DECISÃO FECHADA da T9/Gate 2 quando contexto.guard.ts virou consumidor vivo. O critério citado segue exato.`
`[T9] ledger: 8 achados totais | 2 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T9] leitura da métrica: os DOIS de rodada >1 foram INTRODUZIDOS pelas próprias correções — a escrituração ausente do CT-356 e a coesão do arquivo onde ele foi morar. Nenhum aponta para varredura incompleta da rodada 1.`
`[T9] CONCLUÍDA em 3 rodadas — 1 por bloqueio do Gate 2 (MEDIO/architecture) e 2 de correção fina. Fechou a tradução do 23505, o D12 e a pendência dirigida da T8. 3 débitos novos (D14, D15, D16).`
`[T9] staged: apps/api/src/cadastros/**, apps/api/src/comum/contexto-da-sessao.ts, os três controladores de imóveis, packages/db/src/{cadastro-de-pessoa,index}.ts, as seis suítes, docs/**. Índice em 103 arquivos.`

### T10
`[T10] dependências satisfeitas: T7 e T9. base_sha permanece 621489e38b08f5f280bf2ae09799de4aa3ad4fa1.`
`[T10] SEGUNDO DESVIO DELIBERADO DO FRONTMATTER, mesmo critério da T9: a task declara gates: [qa] com tipo=crud_handler, e a coordenação roda os DOIS. A razão está no texto da PRÓPRIA task, §3: "montar a árvore com uma consulta por conjunto e outra por imóvel é o padrão N+1, e o risco está registrado. O CT-329 prova a corretude do resultado, NÃO o custo — a revisão deve olhar o número de idas ao banco". Contagem de consultas é performance/architecture, que é matéria do Gate 2, e o §8 do task_plan registra o N+1 como risco nomeado da fatia.`
`[T10] executor: opus · gates: [qa, tech_review] (ESCALADO) · qa_model=opus · tech_model=opus`
`[T10] QA rodada 1: REJEITADO — 2 ALTO/tests, os dois com smell test_order_dependency (AP-08). 6/6 critérios aprovados, zero violação de ADR, zero AP-24, 530 casos verdes.`
`[T10] o QA julgou o Proxy do CT-329 (b) SEAM LEGÍTIMO e não dublê: ele envolve o tx real com armadilha apply que incrementa e delega por Reflect.apply — toda consulta corre contra o banco de verdade, nada é plantado. A asserção é sobre grandeza DERIVADA pelo SUT (quantas vezes lerCarteira invoca o executor), nunca sobre valor injetado. Nem AP-10 nem AP-14.`
`[T10] o QA confirmou a aritmética da âncora de custo: 3 (página) + 2 (total) + 3 (imóveis) + 2 (cômodos) = 10, e o MT10-1 fecha com 5 + 2×5 e 5 + 5×5.`
`[T10] o QA CONFIRMOU a medição do executor sobre o CT-330: ela procede, e o CT-330 (b) NÃO é redundante. A asserção do CT-330 é de CONJUNTO (união, cardinalidade, ausência de repetição) e é INSENSÍVEL À ORDEM, que é exatamente o que ORDER BY nome sem id perde quando os cinco nomes são iguais.`
`[T10] ALTO-001 VERIFICADO EMPIRICAMENTE pelo gate: rodou o CT-330 (b) isolado e mediu "expected [] to have a length of 5 but got +0". Gravidade: o CT-330 (b) é a ÚNICA prova do desempate, e a rede do aceite 5 estava pendurada numa ordem de execução que nada declarava nem verificava.`
`[T10] ALTO-002: os dois describe de carteira.e2e.spec.ts compartilham a empresa A, e o CT-331 cria "Ap 1201" com metragemTotal 0 — executado ANTES do CT-329, acrescentaria um sexto elemento à lista FECHADA de metragens do passo 5.`
`[T10] o QA anotou, sem bloquear, que a âncora INVOCACOES_DA_CARTEIRA=10 conta TODA invocação do executor (inclui as cinco que só constroem fragmento), o que é medida mais severa que contar consultas — trade-off consciente e documentado. Efeito colateral: refatoração puramente interna da forma dos fragmentos faz o caso reprovar.`
`[T10] attempt_sha (rodada 1)=5a5c19699ad2c5be064dba397560bdc7d61ba32b`
`[T10] rodada 2 (correção) concluída: ALTO-001 fechado movendo a gravação para beforeAll (zero asserção tocada); ALTO-002 fechado pela saída (a), filtrando carteira.itens pelos dois identificadores do arranjo, com âncora nova toHaveLength(2). 530 → 530.`
`[T10] o executor fez PROVA DE ORDEM INVERTIDA (P4) em vez de só afirmar o fecho: cópia descartável com os dois describe TROCADOS passa corrigida (4 passed), e a MESMA cópia com o passo 5 revertido à carteira inteira reprova com "expected [ +0, +0, 20.13, ... ]" — o segundo +0 é o "Ap 1201" do CT-331.`
`[T10] MT10-2, MT10-3 e MT10-5 RECONFIRMADOS após a correção, com os mesmos modos de falha do original — a correção não enfraqueceu prova nenhuma.`
`[T10] dois achados de método que o executor registrou e valem para o resto do run: (1) o filtro -t do Vitest é tratado como REGEX, então "CT-329 (b)" sem escapar os parênteses casa ZERO testes e o Vitest sai com exit 0 SILENCIOSAMENTE — medição isolada de sub-caso exige \(b\); (2) o MT10-5 na forma literal não compila, porque deixa EXPANSAO_DE_IMOVEIS sem leitor (TS6133).`

## ⏸️ PAUSA CONTROLADA — autorizada pelo usuário em 2026-08-06 (segunda desta fatia)

> O usuário pediu a pausa **com a premissa do run preservada**: ao retornar, seguem valendo
> **não pausar aguardando resposta** (a resposta é sempre o recomendado) e **sem teto de tentativas**.

**Ponto exato de parada**: a **T10 teve o executor concluído E a rodada de correção concluída**.
O **QA rodada 2 NÃO foi despachado**. O Tech Review da T10 **nunca rodou**.

### Como retomar — em uma frase
Despachar o **Gate 1 (QA) da T10 em `scan_scope: DELTA`**, com `attempt_sha_anterior = 5a5c19699ad2c5be064dba397560bdc7d61ba32b`, para revalidar o fecho dos dois `ALTO` de dependência de ordem. Depois o **Gate 2**. Depois a **T11**, que é a última.

### O que o QA rodada 2 precisa verificar
- `delta_arquivos`: `packages/db/test/janela.spec.ts`, `apps/api/test/carteira.e2e.spec.ts`, `tasks/T10.md` (§6.7 nova). **Nenhum arquivo de produção foi tocado** — o gate foi explícito: *"o SUT está correto; o defeito é da prova"*.
- **ALTO-001**: a gravação dos cinco homônimos saiu do corpo do `it` e virou `beforeAll` do `describe`, com `criados` no escopo. **Zero asserção tocada.** Isolados agora: `CT-330` → `1 passed`, `CT-330 (b)` → `1 passed` (era `1 failed`), `CT-329 (b)` → `1 passed`.
- **ALTO-002**: saída **(a)** — o passo 5 do `CT-329` filtra `carteira.itens` por `[auroraId, borealId]` antes de derivar `metragens`; `METRAGENS_ESPERADAS` continua **igualdade sobre lista fechada**, o quinto cenário `20.13` intacto, mais âncora nova `toHaveLength(2)` sobre o recorte. **Confirmar que isso NÃO virou contenção** — se a filtragem transformou a asserção em *"os que eu conheço estão lá"*, é **AP-24**.
- **A prova de ordem invertida** que o executor fez (cópia com os `describe` trocados) — julgar se ela sustenta o fecho da **classe**, e não só dos dois casos.
- **Mutantes reconfirmados**: `MT10-2` (`1 failed | 61 passed`, no `CT-330 (b)`), `MT10-3` (`1 failed | 120 passed`, no `CT-329`), `MT10-5` (`3 failed | 118 passed`, em `CT-329`, `CT-329 (b)` e `CT-331`).

### Baseline no momento da pausa
`pnpm test` **VERDE**, exit 0, 10/10 tarefas turbo, **530 casos** — `api` **121**, `auth` **89**, `db` **62**, `shared` **190**, `worker` **16**, `contracts` **52**. `pnpm build` e `pnpm lint` verdes.

### Estado geral do run
- **T1–T9 concluídas e staged** (103 arquivos no índice, **nada commitado** — o pipeline nunca commita)
- **T10**: executor + correção concluídos; **QA rodada 2 e Tech Review pendentes**; o delta dela está **não-staged**
- **T11**: não iniciada — é a última, e fecha cobertura de autorização, contrato e as suítes existentes
- **13 débitos abertos** na §2 do `run-report.md` (D3, D4, D5, D6, D8, D10, D12, D14, D15, D16 — mais os fechados registrados no cabeçalho da seção)
- **Débitos FECHADOS nesta fatia**: D7 (inteiro), D9, D11, D12, D38 (da F1)
- **Dois desvios deliberados de `gates`** registrados acima: T9 e T10 declaravam `[qa]` e a coordenação rodou os dois gates
- **Três arquivos seguem não-staged de propósito** e não são de task alguma: `deploy/scripts/roadmap/atualizar-roadmap.sh`, `docs/plano-backend-novo/roadmap.md` e `docs/specs/domain-glossary.md`

## ▶️ RETOMADA DA PAUSA — 2026-08-06 (T10 nos gates)

`[run] resume: retomada nos gates da T10, conforme o ponto de pausa. Premissa preservada por autorização explícita do usuário: sem pausa aguardando resposta (a resposta é sempre o recomendado) e sem teto de tentativas.`
`[T10] LAPSO DA COORDENAÇÃO registrado: a memória lazy da T10 não foi criada na rejeição do QA da rodada 1 — SEGUNDA ocorrência do mesmo lapso no run (a primeira foi a T8). O attempt_sha foi capturado e logado, mas o Ledger não. Criada no resume, antes da revalidação. Padrão a corrigir na T11: criar a memória lazy no MESMO passo em que se captura o attempt_sha.`
`[T10] attempt_sha (rodada 2)=40c8fb0a9664a21113d4cb34259dfa462b12740e`
`[T10] RENOMEAÇÃO REGISTRADA (P2 do Gate 2, rodada 2): o sub-caso do CUSTO em packages/db/test/janela.spec.ts foi renomeado de CT-329 (b) para CT-329 (d) na rodada 2 de correção. TODAS as menções anteriores a "CT-329 (b)" NESTE LOG, no contexto da suíte db/janela, referem-se a ele; as do contexto de apps/api referem-se ao caso da E2E, que SEGUE com a letra (b) e está correto. A colisão existia porque dois arquivos escolheram a próxima letra contra o arquivo corrente em vez de contra a fatia — emitido convention_drift pelo Gate 2.`
`[T10] QA rodada 2: APROVADO — problemas: []. Os dois ALTO de dependência de ordem SANADOS. O gate REFEZ o MT10-2 (1 failed | 61 passed, no CT-330 (b)) e mediu os casos ISOLADOS: CT-330, CT-330 (b) e CT-329 (b) agora passam sozinhos, onde antes o (b) dava "expected [] to have a length of 5".`
`[T10] o QA julgou o fecho da CLASSE e a leitura vale registro: o ALTO-001 fecha por TOPOLOGIA (arranjo no beforeAll ⇒ nenhum it volta a ser fonte de arranjo para outro, em qualquer ordem) e o ALTO-002 por IDENTIDADE (a medição deixou de depender do ESTADO DA EMPRESA — superfície ilimitada — e passou a depender dos DOIS CONJUNTOS DO PRÓPRIO ARRANJO — superfície de dono único). "Não é só adiar: é a redução de 'qualquer escrita no tenant' para 'escrita dentro da própria fixture'."`
`[T10] ACHADO DE MÉTODO do QA, que vale para todo o run e para a T11: a forma documentada em .claude/rules/testing-stack.md — `pnpm --filter <pkg> test -- -t "<nome>"` — tem um `--` EXTRA que torna o filtro INERTE. Ele mediu: com o duplo hífen, `vitest run -- -t 'CT-330 \(b\)'` executou os 62 casos do pacote e saiu VERDE, o que lido como medição isolada seria falso positivo. A forma que funciona é SEM o duplo hífen. Somado ao achado do executor (o -t é REGEX, e parênteses não escapados casam zero testes com exit 0 silencioso), são DUAS formas de falso verde na mesma linha de comando.`
`[T10] Tech Review rodada 1: APROVADO_COM_OBSERVACOES — 0 bloqueantes, 5 anotáveis (2 MÉDIOS de categoria anotável, 3 baixos). adrs_consultadas: 0008, 0011, 0014, 0016, 0017, 0018.`
`[T10] o Gate 2 LEU A IMPLEMENTAÇÃO em vez de confiar no teste, e confirmou o critério 4: lerCarteira chama listarConjuntos uma vez (2 consultas), lerImoveisDeConjuntos uma vez com a LISTA da página (WHERE conjunto_id = ANY), que termina em comAgregadoEmLote → lerComodosDeImoveis com a LISTA de imóveis. Quatro idas ao banco, constantes em N; os dois map do arquivo são de memória. As guardas de lista vazia evitam a quinta ida sem informação.`
`[T10] o Gate 2 conferiu os ÍNDICES por inspeção estática: imovel_empresa_conjunto_idx cobre o conjunto_id = ANY sob RLS, e comodo_empresa_imovel_posicao_idx cobre a consulta de cômodos e o ORDER BY no prefixo. E registrou que lerImoveisDeConjuntos é SEMPRE chamada com a lista de uma PÁGINA, nunca com o tenant inteiro — que é por isso que ela não sai pelo índice do pacote.`
`[T10] o Gate 2 julgou a âncora de 10 TRADE-OFF ACEITÁVEL e explicou por que a alternativa é pior: discriminar Query de Fragment pelo retorno do driver acoplaria a prova a internals do postgres.js para ganhar robustez contra um cenário que já falha de forma legível.`
`[T10] o Gate 2 registrou uma verificação que evita reabertura futura: ExpansaoDaCarteira e JanelaDaCarteira saem de @sysloc/contracts SEM consumidor no repositório, e isso é DELIBERADO — o cabeçalho do índice declara que "o que sai daqui é contrato com o consumidor, inclusive um consumidor fora deste repositório", e a ADR-0016 registra em Consequences que "o consumidor não recebe cliente pronto: monta as chamadas a partir dos tipos publicados". Precedente: JanelaComCirculacao, de task anterior, também não tem consumidor interno.`
`[T10] rodada 2 (correção): quatro anotáveis adotados. P1 (CT-329 (b) → CT-329 (d), 13 pontos em 4 arquivos), P2 (decomposição de 3 para 6 fragmentos + 4 consultas), P4 (constante nomeada publicada, arranjo derivado dela) e P5 (seta invertida). P3 escriturado: §5.2 de 3 para 10 arquivos.`
`[T10] o executor PRODUZIU A REDE QUE NÃO EXISTIA para o P4, e a medição é o ponto alto da rodada: o defeito era ESTRUTURALMENTE INVISÍVEL (com um elemento só, indexar e nomear são indistinguíveis, e nenhum caso reprova na forma antiga). Ele aplicou o mutante — expansão acrescentada ANTES de 'imoveis' — às DUAS formas: a derivada do valor passa limpa (121 passed), a derivada da posição reprova em 3 failed | 118 passed, COM O MESMO MODO DE FALHA DO MT10-5. Isso confirma literalmente o diagnóstico do Gate 2: a suíte acusaria o SINTOMA, e quem depurasse iria para a expansão em vez da ordem do arranjo.`
`[T10] o executor CORRIGIU O PRÓPRIO GATE 2 no P2, e os dois gates seguintes confirmaram: lerComodosDeImoveis NÃO aplica predicado de circulação. As três projeções são de três tabelas, mas o predicado entra em três lugares dos quais NENHUM é o de cômodos. Circularam TRÊS contagens neste run — "três" (executor, rodada 1), "cinco" (telemetria) e "seis" (verificada por dois gates).`
`[T10] QA rodada 3: APROVADO — problemas: []. O gate REFEZ a medição do P4 de forma independente e obteve o mesmo; confirmou que a não-subida de âncora é CORRETA (o filtro de esquemas.spec.ts exige instanceof z.ZodObject EM CONJUNÇÃO com prefixo/pertinência, e a constante é cadeia); e confirmou que o pacote continua FOLHA (CT-339 verde nas duas metades).`
`[T10] o QA rodada 3 corrigiu a lista de delta_arquivos que a coordenação passou: ela OMITIA packages/contracts/src/index.ts, que ele incluiu por raio de impacto. Sem impacto no veredito.`
`[T10] Tech Review rodada 2: APROVADO_COM_OBSERVACOES — 3 BAIXO, zero bloqueantes. adrs_consultadas: 0014, 0016 (as duas com texto integral aberto; o gate registrou que NÃO abriu 0017 nem 0008 porque o delta não as engaja, e que citar Decision não aberta seria a paráfrase que esta base já viu divergir).`
`[T10] o Gate 2 FECHOU o flanco de exaustão que o Gate 1 declarou aberto: grepou apps e packages pelos 11 símbolos e identificadores de caso da T10 e obteve exatamente 11 arquivos, TODOS dentro dos 12 declarados. Reconciliou também a aritmética — "2 criados, 11 modificados" contra 10 na §5.2: o 11º é o próprio tasks/T10.md.`
`[T10] PROPRIEDADE SISTEMÁTICA que o Gate 2 registrou e que vale para a T11: enquanto houver trabalho não-staged deliberado na árvore (os três arquivos de roadmap/glossário), TODO gate em scan_scope DELTA vai recebê-los no diff — o attempt_sha é construído sobre uma CÓPIA DO ÍNDICE, então mudança não-staged anterior à rodada nunca entra na árvore do snapshot e reaparece como se fosse do delta. O RISCO RECÍPROCO é o que importa: habituar-se a descartá-los como ruído conhecido pode fazer passar uma mudança não-staged genuinamente nova.`
`[T10] rodada 3 (correção): P1 do Gate 2 fechado com o marcador DECISÃO FECHADA canônico sobre EXPANSAO_DE_IMOVEIS (quatro campos, cabeçalho greppável), e P3 fechado citando a cláusula literal da Decision da ADR-0014 — "Detalhe de composição — parte que não tem vida própria, não é referenciada por registro nenhum, e cujo ciclo de vida é o do agregado que a contém (o cômodo de um imóvel é o caso conhecido)". 530 → 530.`
`[T10] o REVERTER EXIGE do marcador é o ponto fino e o executor acertou: exige DUAS provas — que o arranjo tenha um só elemento E que nenhuma expansão possa ser inserida antes de 'imoveis'. Não "nenhuma foi inserida ainda", que seria estado e não contrato.`
`[T10] ledger: 10 achados totais | 8 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
`[T10] leitura HONESTA da métrica, porque o 8 engana: os cinco do Gate 2 nasceram na PRIMEIRA passada dele (que é a rodada 2 do orquestrador, porque a rodada 1 parou no QA) — não é varredura incompleta, é o Gate 2 vendo o que o Gate 1 não vê por contrato. Os três seguintes foram INTRODUZIDOS pelas próprias correções. Nenhum dos oito aponta para algo que a rodada 1 tivesse deixado sem varrer.`
`[T10] CONCLUÍDA em 3 rodadas de correção — 1 por bloqueio do QA (dois ALTO de dependência de ordem) e 2 de adoção de anotáveis. Zero bloqueio do Gate 2 em toda a task.`
`[T10] staged: packages/{contracts,db}/**, apps/api/src/imoveis/**, apps/api/test/carteira.e2e.spec.ts, packages/db/test/janela.spec.ts, docs/**. Índice em 105 arquivos.`
`[T10] CONCLUÍDA. Fases 1, 2 e 3 completas; Fase 4 em curso.`

### T11
`[T11] dependência satisfeita: T10. base_sha permanece 621489e38b08f5f280bf2ae09799de4aa3ad4fa1. É a ÚLTIMA task da fatia.`
`[T11] executor: opus (declarado) · gates: [qa, tech_review] (declarado) · risk: medium · diff_touches_critical_path=true (autorização) · qa_model=opus · tech_model=opus`
`[T11] ADRs injetadas no executor: ADR-0008, ADR-0011, ADR-0014, ADR-0016, ADR-0017, ADR-0018`
`[T11] CONFERÊNCIA DE ESCOPO ANTES DO DESPACHO, e ela muda o trabalho real da task: o card da T11 foi escrito ANTES do run e manda "fechar as quatro suítes existentes que a fatia faz reprovar". Medi o estado real e as quatro JÁ FORAM fechadas INCREMENTALMENTE, cada uma pela task que publicou a superfície — cobertura-de-autorizacao (ROTAS_PUBLICADAS_EM_PRODUCAO já em 66, MANIPULADORES em 51, NO_MUTANTE em 60), catalogo.spec.ts (na T2), superficie-publica.spec.ts (na T3) e unidade-de-trabalho.spec.ts (SIMBOLOS_ESPERADOS crescido em T6, T7, T8, T9 e T10).`
`[T11] o que RESTA de fato: as duas suítes E2E novas (contrato-publicado, autorizacao-do-dominio), o CT-326 (que NÃO existe — grep devolve 0 em unidade-de-trabalho.spec.ts), e a conferência de que campos-fechados alcança as rotas novas. Passado ao executor por escrito, para não gastar rodada tentando mudar 33→66 numa âncora que já está em 66.`
`[run] RETOMADA 2026-08-06 (segunda): a sessão anterior foi cortada pelo LIMITE SEMANAL DE API no meio do QA da T11 — o gate não emitiu veredito. Estado conferido no resume: executor da T11 concluído, as duas suítes novas presentes (autorizacao-do-dominio 50KB, contrato-publicado 47KB), 105 arquivos staged, NENHUMA memória lazy. Sem veredito ⇒ a rodada do QA é REFEITA como rodada 1, em scan_scope FULL. Premissa do run preservada por autorização explícita: sem pausa aguardando resposta, sem teto de tentativas.`

### T11 — Gate 1 (QA), rodada 1

- `attempt_sha (rodada 1)=ad2571698c962fcbd587875759f797e59752bf3d`
- `scan_scope: FULL` · modelo: `opus` (rule: `diff_touches_critical_path` — `**/security/**` via
  `cobertura-de-autorizacao`; e a fatia toca `api_contracts`)
- **Veredito: REJEITADO** — 1 ALTO, 0 CRÍTICO, 0 MÉDIO, 2 BAIXO. Critérios: 10/10. CTs: 10/10 rastreados.
- Bloqueante único: `ALTO-001` · `categoria: tests` · `smell: tautological_assertion` —
  `packages/db/test/unidade-de-trabalho.spec.ts`, laço do `CT-326` comparando cada linha com o mesmo
  predicado que já a selecionou. Achado **confirmado pelo orquestrador** por leitura de
  `packages/db/test/varredura-de-fontes.ts` antes de abrir a rodada de correção.
- Os dois BAIXO viram débito na §2 do `run-report.md` (política de bloqueio seletivo: baixo nunca bloqueia).
- **Economia aplicada**: a suíte foi medida pelo orquestrador (`pnpm test`, exit 0, 541 casos) e entregue
  apurada ao gate, que auditou o log íntegro por `grep` em vez de reexecutar. As duas invocações
  anteriores deste gate morreram por limite de API sem emitir veredito; esta concluiu em 241k tokens.
- **Perna sem prova nesta rodada**: `pnpm lint` não foi reexecutado nem consta do log auditado. Registrado
  pelo gate em `observacoes`; o orquestrador fecha essa perna antes de encerrar a task.

### T11 — retry classification

- attempt: 1
- gate de origem: **QA (Gate 1)** — o algoritmo de `requires_qa_revalidation` **não se aplica**: rejeição
  do Gate 1 sempre re-passa pelo Gate 1.
- problemas_por_categoria: `{ tests: 1 (ALTO) + 1 (BAIXO), code_quality: 1 (BAIXO) }`
- requires_qa_revalidation: **true** (por regra do gate de origem)
- decisao: rodada 2 = executor de correção → Gate 1 → Gate 2

### T11 — escalonamento automático

- Tentativa 1: `opus`, rejeitado (motivo: asserção tautológica no `CT-326`, `ALTO`)
- Tentativa 2: escalado para `opus[xhigh]` (rule: `last_severity ∈ {ALTO, CRITICO}`)

### T11 — Gate 1 (QA), rodada 2

- `attempt_sha (rodada 2)=be4b01ddc19fcfe13789bc7b359cb8c6c26f89b3`
- `scan_scope: DELTA` · `delta_arquivos=[packages/db/test/unidade-de-trabalho.spec.ts]` ·
  `delta_simbolos=[DECLARACAO_DE_UNIDADE, CT-326]` · raio de impacto = o próprio arquivo
  (`varredura-de-fontes.ts` sem diff, confirmado pelo orquestrador)
- **Veredito: APROVADO** — 0 crítico, 0 alto, 0 médio, 0 baixo novo.
- `QA-ALTO-001` **sanado**: a independência dos dois predicados foi confirmada **contra o fonte de
  produção**, não só pela leitura do teste — `packages/db/src/unidade-de-trabalho.ts:177` e `:200`
  declaram `emUnidadeDeTrabalho<T>(…)`, que o predicado de seleção não casa, e nenhuma das 9 chamadas
  reais contém `emUnidadeDeTrabalho<`.
- `MT11-6b` julgado **discriminante**: sob o predicado afrouxado para `[<(]`, a asserção da rodada 1
  passaria por construção e a nova reprova nomeando `unidade-de-trabalho.ts:177`.
- A **reordenação** do eixo positivo foi julgada **necessária, não estética**: atrás da igualdade de
  conjunto o piso seria implicado por `ausentes: []` e viraria infalível naquela posição.
- Custo da rodada DELTA: 137k tokens (contra 241k da FULL). O escopo incremental funcionou.

### T11 — Gate 2 (Tech Review), rodada 1

- modelo: `opus` (rule: `diff_touches_critical_path`) · diff por `git diff -- <path>` (worktree vs índice),
  **nunca** `git diff <base_sha>`, que é cumulativo neste run
- **Veredito: APROVADO_COM_OBSERVACOES** — 0 crítico, 0 alto, 1 médio **anotável** (`code_quality`),
  1 baixo. **Nenhum bloqueante** pela partição de severidade MÉDIA por categoria.
- ADRs com a `Decision` aberta e lida: **0011, 0014, 0016, 0017, 0018**.
- Marcadores `DECISÃO FECHADA` intactos — verificado por busca de linhas **removidas** contendo
  `DECISÃO FECHADA` / `DÉBITO COM GATILHO` / `REVERTER EXIGE` / `SUT_IS_CORRECT_BECAUSE`: nenhuma.
- Anti-gaming (AP-24) limpo: nenhum `it`/`describe` removido, nenhum `.skip`/`.only`/`.todo` acrescentado,
  nenhuma asserção afrouxada, âncoras 66/51/60 ausentes dos dois lados do diff.
- **Concordou com as três divergências** da §6.6, e reforçou a primeira com razão mais forte que a
  registrada: `/v1/conjuntos/` não é "resposta de roteamento" — é a rota da **coleção**, e responderia
  `200`, de modo que o vetor original teria entrado como **falso negativo**.
- **Subiu** o achado de duplicação de BAIXO (QA) para MEDIO (`code_quality`), com discriminador nomeado:
  `digitoDeControle` não tem precedente no monorepo, nasceu em duas cópias na mesma task, e é regra de
  domínio — não transporte. Vinculado ao **D28** como condição habilitante.
- Nota lateral que o TR registrou sem emitir como problema (dimensão do Gate 1):
  `autorizacao-do-dominio.e2e.spec.ts:369`, `expect(alcancadas).toEqual(recusadas)` é fecho redundante —
  os dois arrays acumulam o mesmo `rota.rotulo`. Não é enfraquecimento: o eixo positivo real é a asserção
  de `2xx` no laço, que é forte e falseável.

### T11 — fechamento

- `[T11] ledger: 3 achados totais | 0 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
  — a varredura FULL da rodada 1 foi **completa**: a rodada 2 não descobriu nada novo.
- `[T11] staged: 5 arquivos de teste + T11.md + artefatos de _run/`
- `[run] rule_candidates: 3 sinais persistidos em _run/rule-candidates.md nesta task (qa=2, staff=1)`
- Memória lazy `_run/tmp/T11.md` deletada após aprovação nos dois gates.
