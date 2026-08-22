# Rule candidates — integracao-bancaria-autonoma/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] URL única de webhook para todos os tenants

**Regra que isto sugere:** entrada de fato de terceiro publica **uma** URL para todo o SaaS; a empresa é derivada do dado encontrado, nunca do endereço.

**O que ela faria (simples):** impede que alguém proponha subdomínio, vhost ou rota por cliente numa fatia futura — o roteamento por identificador próprio já está em produção e mudá-lo quebraria o cadastro existente.

- Evidência: "Uma URL para todos os tenants. Roteamento por identificador próprio; empresa derivada do dado encontrado." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [pre_refinement_decision] Degradação é primeira classe, não exceção

**Regra que isto sugere:** todo caminho externo opcional declara e **testa** a operação sem ele; a ausência do canal rápido degrada, nunca interrompe.

**O que ela faria (simples):** obriga a fatia que introduz um canal externo a provar que o produto opera sem ele, em vez de assumir que a indisponibilidade é caso de erro.

- Evidência: "Sem webhook, a conferência por consulta liquida e estorna. Já implementado; a fatia declara e testa, não constrói." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [pre_refinement_decision] Vocabulário do provedor não cruza a porta

**Regra que isto sugere:** termos de família nova do provedor entram na lista varrida **antes** de a porta existir, para que nasçam impedidos e não contornados.

**O que ela faria (simples):** hoje a varredura é acrescentada depois que o adaptador já existe, e a ordem inversa deixa uma janela em que o termo vaza para símbolo publicado sem nada reprovar.

- Evidência: "Os termos da família de webhook já foram acrescentados à lista varrida antes de existir a porta." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [pre_refinement_decision] Cadastro de terceiro em recurso compartilhado é intocável

**Regra que isto sugere:** operação de configuração em recurso do provedor só altera o que o próprio produto criou; cadastro de terceiro nunca é substituído, desativado ou sobrescrito.

**O que ela faria (simples):** sem a regra, "habilitar" naturalmente vira "tomar a vaga", e o cliente que usa a mesma vaga com outro fornecedor perde o serviço sem aviso.

- Evidência: "O webhook de terceiro de um cliente específico é intocável." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [pre_refinement_decision] Segredo de terceiro provado por medição da saída real

**Regra que isto sugere:** ausência de vazamento de segredo operável é afirmada **executando** e varrendo a saída real, nunca por leitura de código, e sempre com controle positivo.

**O que ela faria (simples):** leitura de código aprova o caminho que o autor lembrou; a varredura da saída pega o caminho que ninguém previu — e o controle positivo prova que a varredura sabe reprovar.

- Evidência: "Segredo de terceiro é cifrado e não retorna por superfície alguma — provado por medição da saída real, nunca por leitura de código." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [pre_refinement_decision] Tabela nova nasce multi-tenant pelo banco

**Regra que isto sugere:** toda tabela de negócio nova nasce com dono-empresa, isolamento forçado e chave composta — sem exceção e sem retrofit.

**O que ela faria (simples):** já é invariante do repositório; registrar como decisão fora de negociação impede que uma fatia "só de configuração" argumente que o isolamento não se aplica a ela.

- Evidência: "Multi-tenancy é do banco: tabela nova nasce com dono-empresa, isolamento forçado e chave composta. Sem exceção." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-21T20:00:00Z

---

## [repeated_fixture] Arranjo de material de certificado em cifra legada

**Regra que isto sugere:** o arranjo do material legado — autoridade descartável, emissão das duas embalagens e extração da legada — vive num construtor da casa compartilhada de material de teste, e nunca como guarda local por suíte.

**O que ela faria (simples):** os três casos novos repetem a mesma sequência de três passos para obter material em cifra legada, e o guarda que extrai a embalagem legada nasceu local a esta suíte; a próxima suíte que precisar de material legado vai copiá-lo da vizinha, e as cópias ficam livres para divergir — que é o modo de falha que o Limiar de Três deste projeto existe para evitar.

- Evidência: `gerarAutoridadeDeTeste` → `gerarMaterialComLegado` → `exigirEmbalagemLegada` repetidos em três casos, com `exigirEmbalagemLegada` declarado local à suíte (linha 1714) em vez de morar em `packages/cobranca-bancaria/test/material-de-teste.ts`, junto de `gerarMaterialComLegado` — `T2 / borda de registro do certificado do provedor`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T02:20:00Z

---

## [repeated_fixture] Acessórios de inspeção de erro SQL nas suítes de `packages/db`

**Regra que isto sugere:** os acessórios de inspeção de erro do driver — `Resultado<T>`, `tentar`, `sqlstate`, `mensagemDo`, `restricaoViolada` — vivem numa casa compartilhada de `packages/db/test/` e se importam, nunca se redeclaram na suíte nova.

**O que ela faria (simples):** o mesmo par `tentar`/`sqlstate` está redeclarado byte a byte em cerca de doze suítes de `packages/db/test/`, e a suíte desta task acrescentou mais uma cópia — o diretório **já tem** casas compartilhadas (`banco-efemero.ts`, `conjuntos.ts`, `varredura-de-fontes.ts`), então o lugar existe e não foi usado. É exatamente o modo de falha que a convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md` descreve: quem escreve suíte nova copia de UMA vizinha, para ele é a segunda cópia e nunca a enésima, de modo que o Limiar de Três **nunca dispara**; endurecer uma cópia (por exemplo, passar a distinguir `constraint_name` de `table_name`) deixaria as outras onze para trás em silêncio.

- Evidência: `async function tentar<T>` e `function sqlstate` redeclarados idênticos em ~12 arquivos `*.spec.ts` de `packages/db/test/`; a suíte criada pela T4 é mais uma cópia — `T4 / camada de dados e migrações do estado da entrega da notícia (@sysloc/db)`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T02:55:00Z

---

## [repeated_fixture] Lista de termos do dialeto do provedor

**Regra que isto sugere:** o vocabulário proibido do provedor tem uma declaração canônica em casa de acessório, e as suítes que o varrem a importam em vez de reescrevê-la.

**O que ela faria (simples):** a lista de termos do provedor já existe em três declarações independentes em código de teste, com **recortes diferentes** (16 termos, 9+7 e um subconjunto de 4) — e listas que divergem em recorte são exatamente o modo como uma varredura passa a olhar menos do que a irmã sem que ninguém perceba. Uma regra dizendo onde a lista canônica mora evitaria que a quarta cópia nascesse com mais um recorte próprio.

- Evidência: três declarações da lista de vocabulário do provedor em código de teste, com recortes divergentes — `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:255`, `packages/contracts/test/esquemas.spec.ts:2618` e `:4941` — `T5 / contrato publicado e porta de entrega da notícia`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T03:20:00Z

---

## [repeated_assertion_shape] Varredura de vocabulário com controle positivo

**Regra que isto sugere:** toda varredura que afirma ausência traz o controle positivo ao lado, e o par (controle por igualdade + ausência por `toEqual([])`) tem uma forma única no repositório.

**O que ela faria (simples):** o mesmo par de asserções — o controle que prova que a varredura acha as agulhas, seguido da varredura real que afirma lista vazia — aparece em três blocos, com implementações independentes do mesmo `ocorrenciasDeTermos`. A forma **já é convenção de fato** neste repositório e funciona; escrevê-la evitaria que a próxima suíte de varredura nascesse **sem** o controle, que é a rejeição repetida registrada nas duas fatias anteriores.

- Evidência: o par controle-positivo-por-igualdade + varredura-`toEqual([])` em três blocos de dois pacotes, com duas implementações do mesmo helper — `vocabulario-canonico.spec.ts:1577` e `:1696`, `esquemas.spec.ts:5076` — `T5 / CT-991, CT-1032 e CT-1044`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-22T03:20:00Z

---

## [convention_drift] Refinamento só vigora em esquema de entrada

**Regra que isto sugere:** restrição expressa por `.refine()` vale apenas em esquema de **entrada**; em esquema de **saída** ela é inerte, porque saída só deriva o documento publicado.

**O que ela faria (simples):** nesta base, esquema de saída **nunca é parseado em runtime** — ele só alimenta `z.toJSONSchema` para o OpenAPI, e refinamento **não tem representação em JSON Schema**. Um `.refine()` posto num esquema de saída **passa no teste** (que chama `safeParse` direto) e **não protege nada em produção**; a regra faria a restrição nascer onde ela de fato executa.

- Evidência: os dois tetos anti-abuso do `diagnostico` são os **primeiros** `.refine()` de esquema de saída do pacote — os outros nove estão todos em esquema de entrada — e não aparecem no JSON Schema derivado nem executam em produção — `packages/contracts/src/integracao-bancaria.ts:653` e `:656`, contra `apps/api/src/comum/esquema-publicado.ts:48` e `apps/api/src/comum/validacao.ts:51` — `T5 / contrato publicado da entrega da notícia`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-22T03:45:00Z

---

## [convention_drift] Número narrativo ao lado de constante asserida

**Regra que isto sugere:** todo número escrito em prosa que descreve uma constante asserida (nome de caso, docblock, mensagem de erro, contagem em comentário) sobe **no mesmo diff** que a constante — ou é substituído por referência à própria constante, que não envelhece.

**O que ela faria (simples):** neste run, **nove dos vinte e oito débitos** são prosa que ficou para trás de um número que mudou — nome de caso dizendo *"as cinco capacidades"* com a âncora já em sete, docblock afirmando *"quatro importadores"* onde há nove, texto do `it` dizendo *"seis"* onde a constante tem nove, `AT-10` registrando `contracts` em 423 quando são 424, baseline `93` onde são 104. A `ancoras-de-superficie.md` **já exige** isso para a contagem em prosa que acompanha a publicação; o que falta é a regra alcançar **toda** prosa que cita número asserido, não só a da §5.2 — e o custo de não a ter é medido: um desses números **induziu o orquestrador a construir um alerta errado** para a T7, desfeito só por medição da constante.

- Evidência: `D5` (data ambígua), `D12` (contagem de verificadores 10 × 11), `D15` (*"quatro"*/*"seis"* importadores × 9), `D20` (`Object.keys` e ordem), `D21` (AT-8/AT-10 defasados), `D22` (ponteiro para passo 7 onde é 6), `D23` (*"cinco capacidades"* × 7), `D27` (docblock contradiz o corpo), `D28` (quatro ponteiros para marcador removido) — `integracao-bancaria-autonoma/v1, tasks T1–T6`
- Sinal: `convention_drift` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-22T05:50:00Z

---

## [process_gap] Teste que falta pode ser sintoma de garantia que falta

**Regra que isto sugere:** ao classificar achado de cobertura ausente, pergunte primeiro **o que aquele caso provaria**. Se a resposta for *"uma garantia que o código de produção não tem"*, a categoria é `security`/`architecture`, não `tests` — e a severidade é a da garantia ausente, não a da lacuna de prova.

**O que ela faria (simples):** na T6 os dois gates olharam **o mesmo eixo** e discordaram por dois níveis de severidade. O Gate 1 registrou *"falta companheiro negativo no passo 11"* como `baixo`/`tests` (`happy_path_only`) — classificação correta pela forma do achado, e que **não bloqueia**. O Gate 2 olhou o mesmo ponto e abriu `ALTO`/`security`: o companheiro negativo faltava porque **não havia o que ele provasse** — o único ponto de redação do arquivo não era chamado naquele caminho para o segredo que o caminho de fato carregava. Mapeado ponta a ponta, o segredo operável saía do ramo de recusa da concessão, atravessava a porta, era gravado em `negocio.entrega_da_noticia.motivo_*` e chegava à tela do Admin. Sob a partição de severidade vigente, a classificação do Gate 1 **teria fechado a task com o vazamento em produção** — o que separou os dois desfechos foi o Gate 2 ter perguntado o que o teste ausente provaria. A regra é barata (uma pergunta no crivo de categoria) e o custo de não a ter é medido: **uma rodada inteira de correção**, aberta pelo gate seguinte, sobre achado que o anterior já tinha visto e classificado como anotável.

⚠️ **O corolário importa tanto quanto a regra**: isto **não** manda elevar toda lacuna de teste. As outras duas lacunas `happy_path_only` da mesma task (`D24`, `D25`) foram examinadas pelo mesmo crivo e **continuaram `baixo`/`tests`** — o que elas provariam existe no código. O discriminador é a **existência da garantia**, nunca o desconforto com a lacuna.

- Evidência: `QA-BAIXO-003` (`baixo`/`tests`, `happy_path_only`) e `TR-P1` (`ALTO`/`security`) são **o mesmo eixo** — o eco do identificador da aplicação no passo 11 do `CT-1043` —, e a discordância custou a rodada 2 da T6 — `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts::CT-1043-passo-11` e `src/adaptador-sicoob.ts::obterCredencial-ramo-de-recusa` — `T6 / rodadas 1 e 2`
- Sinal: `process_gap` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-22T06:40:00Z

---

## [repeated_fixture] Acessório de sessão nasce na casa compartilhada, nunca privado de um `.spec.ts`

**Regra que isto sugere:** acessório de arranjo de sessão (entrada, segundo fator, montagem de empresa) nasce em `apps/api/test/acessorios-de-borda.ts` — a casa compartilhada do diretório —, e **nunca** como função privada de um arquivo `.spec.ts`.

**O que ela faria (simples):** `entrarComSegundoFatorCumprido` existe **seis vezes**, cada cópia privada de uma suíte e livre para divergir. A causa é estrutural e mecânica, não desleixo: **ninguém pode importá-la de onde ela está**, porque importar de um `.spec.ts` executa o módulo dele e registra os casos daquela suíte dentro da importadora. O `CLAUDE.md` já nomeia o efeito — *"quem duplica copia de UMA vizinha, para ele é a segunda cópia, nunca a enésima, e o gatilho nunca dispara"* — e o Limiar de Três **não é exequível** enquanto a casa compartilhada não for o ponto de nascimento. A convenção existente diz *"procure a casa do diretório; se não existir, crie-a"*; o que falta é a regra alcançar o **momento de escrever**, e não só o de duplicar.

⚠️ **O custo de não a ter foi medido nesta própria task**: o executor precisou das três funções, não pôde importá-las, criou a sétima cópia de uma delas — e emitiu um `DÉBITO COM GATILHO` que declarava *"duas vezes cada"*, porque contou as vizinhas que conhecia. O gatilho já tinha disparado havia muito, e ninguém tinha como saber.

- Evidência: `entrarComSegundoFatorCumprido` declarada em `entrega-da-noticia.e2e.spec.ts:1346`, `recusa-indistinguivel.e2e.spec.ts:1159`, `cobertura-de-autorizacao.e2e.spec.ts:6866`, `contexto.e2e.spec.ts:1974`, `ciclo-de-acesso.e2e.spec.ts:1389` e `administracao-de-pessoas.e2e.spec.ts:1784`; `montarEmpresaComAdmin` e `envelhecerOVigente` duas vezes cada — `T7 / borda da entrega da notícia`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T09:10:00Z

---

## [repeated_fixture] Semeadura de certificado e identidade no processo de trabalho

**Regra que isto sugere:** centralizar a semeadura de *certificado vigente + identidade no provedor* num acessório compartilhado de `apps/worker/test/`, em vez de uma cópia por suíte de borda de tarefa.

**O que ela faria (simples):** quatro suítes do processo de trabalho repetem o mesmo arranjo (`registrarCertificado` seguido de `registrarIdentidadeNoProvedor` sob contexto de tenant), cada uma com a própria função. Endurecer uma — trocar a derivação da validade, acrescentar campo obrigatório — **deixa as outras três para trás**, que é exatamente o gatilho do Limiar de Três. A desta task é a **quarta** cópia.

- Evidência: `apps/worker/test/{reconferencia-da-entrega,conferencia-bancaria,emissao-em-lote,notificacao-bancaria}.spec.ts` — `T8 / borda da tarefa de reconferência`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T14:20:00Z

---

## [repeated_assertion_shape] Espera por estado terminal de tarefa da fila

**Regra que isto sugere:** publicar um acessório **único** de espera por estado terminal (`completed | failed`) nas casas compartilhadas de teste, em vez de redeclarar o predicado em cada suíte que executa job pela fila real.

**O que ela faria (simples):** o mesmo predicado `estado === 'completed' || estado === 'failed'` está escrito à mão em **nove** suítes dos dois aplicativos, cada uma com o próprio limite de tempo. Quando o conjunto de estados terminais do servidor de fila mudar — ou quando a espera precisar registrar diagnóstico —, serão **nove edições**, e as que ficarem para trás passarão a **esperar pelo estado errado sem que nada acuse**. É a forma mais silenciosa desta classe: o teste não falha, ele expira.

- Evidência: predicado replicado em 9 suítes de `apps/worker/test/` e `apps/api/test/` — a desta task é a nona — `T8 / execução da tarefa pela fila real`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-22T14:20:00Z

---

## [repeated_fixture] Porta de entrega é sempre o adaptador de produção apontado ao par do caso

**Regra que isto sugere:** o dublê da porta de entrega da notícia é **sempre** o adaptador de produção (`criarAdaptadorSicoob`) apontado ao par TLS do caso, e o molde mora em `apps/api/test/par-do-provedor.ts`.

**O que ela faria (simples):** o mesmo molde já existe em **duas** suítes, e a segunda cópia nasceu pela causa mecânica de sempre — importar um `.spec.ts` registraria os casos dele na importadora. A regra fixa o que importa e que o docblock hoje só diz numa cópia: **o que se substitui é o DESTINO, nunca a TRADUÇÃO**. Um dublê que devolvesse o motivo já montado plantaria no teste exatamente o objeto cuja posição o caso existe para afirmar.

- Evidência: `entrega-da-noticia.e2e.spec.ts:294` e `vocabulario-na-saida-real.e2e.spec.ts:633` — `T9 / varreduras da saída real`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T18:40:00Z

---

## [repeated_fixture] Montagem do ambiente de processo numa suíte E2E

**Regra que isto sugere:** a montagem e a restauração das variáveis de processo de uma suíte E2E do `api` vêm de um **acessório compartilhado**, nunca redeclaradas por arquivo.

**O que ela faria (simples):** o bloco `VARIAVEIS_MONTADAS` + `beforeAll` que escreve `process.env` + `afterAll` que restaura variável a variável está replicado em **trinta** suítes de `apps/api/test/`, e a suíte nova desta task nasceu como a **30ª cópia**. ⚠️ **É o maior número desta classe medido no repositório**, e a causa é a mesma que o `CLAUDE.md` já nomeia: *"quem duplica copia de UMA vizinha — para ele é sempre a segunda cópia, e o gatilho nunca dispara"*. O custo concreto é as cópias **divergirem no conjunto de variáveis restauradas**, o que produz vazamento de ambiente entre suítes sem que nada acuse.

- Evidência: `VARIAVEIS_MONTADAS` + montagem/restauração de `process.env` em **30** arquivos de `apps/api/test/` — `T10 / percurso do cliente novo`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-22T18:40:00Z

---
