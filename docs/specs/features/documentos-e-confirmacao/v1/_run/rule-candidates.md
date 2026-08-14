# Rule candidates — documentos-e-confirmacao/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] Marca de cancelamento por composição, nunca sobre bytes

**Regra que isto sugere:** artefato derivado marca estado na composição, e o ato de negócio apenas grava o estado.

**O que ela faria (simples):** impede que alguém volte a mesclar um carimbo sobre um PDF já gerado — o cancelamento grava o fato e a marca aparece porque a composição a recebe como parâmetro.

- Evidência: "O carimbo 'CANCELADO' vira composição na renderização; o cancelamento apenas grava estado." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-12T00:00:00Z

---

## [pre_refinement_decision] Defeito herdado se fecha no porte, nunca se replica

**Regra que isto sugere:** defeito medido no sistema legado não é portado — o porte implementa a forma correta e registra a divergência.

**O que ela faria (simples):** evita que a equivalência com o oráculo seja lida como "copie o legado inclusive onde ele erra"; o token de confirmação do legado não é hash nem aleatório, e o porte não repete isso.

- Evidência: "O defeito do token de confirmação se fecha no porte — decisão do usuário." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-12T00:00:00Z

---

## [pre_refinement_decision] Fronteira de repositório: nenhuma linha de frontend

**Regra que isto sugere:** task que peça implementação de frontend é gatilho de parada, sem exceção — inclusive páginas que o backend referencia por link.

**O que ela faria (simples):** a página que recebe o link de confirmação NÃO nasce aqui; o executor para e escala em vez de "adiantar" um HTML.

- Evidência: "Nenhuma linha de React, inclusive a página `validacao-email`. Task que peça frontend é gatilho de parada." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-12T00:00:00Z

---

## [pre_refinement_decision] Canal de aviso restrito a e-mail — WhatsApp é recusa de validação

**Regra que isto sugere:** os valores `whatsapp` e `ambos` são recusados na validação de entrada, não implementados parcialmente.

**O que ela faria (simples):** evita que um enum "preparado para o futuro" aceite um canal que ninguém entrega, gerando aviso silenciosamente perdido.

- Evidência: "WhatsApp não é implementado — `whatsapp`/`ambos` são recusados na validação." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-12T00:00:00Z

---

## [pre_refinement_decision] Baseline medida é contrato do run, não estimativa

**Regra que isto sugere:** todo run declara a baseline exata que herda (suíte por pacote e superfície publicada) e compara contra ela no fim.

**O que ela faria (simples):** queda de contagem vira regressão detectável em vez de "acho que estava por aí"; aqui a baseline é 1004 casos por pacote e 86 rotas / 71 manipuladores.

- Evidência: "Baseline medida a respeitar: suíte 1004 casos, medida por pacote; superfície 86 rotas / 71 manipuladores com `semDeclaracao` vazio." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-12T00:00:00Z

---

## [repeated_assertion_shape] Recusa por chave desconhecida em esquema Zod

**Regra que isto sugere:** asserção de chave desconhecida em esquema estrito verifica sempre a tripla `success === false` + `issues[0].code === 'unrecognized_keys'` + `issues[0]` casando `{ keys: [<chave>] }`.

**O que ela faria (simples):** o mesmo bloco de três asserções aparece em nove pontos do arquivo de esquemas, escrito à mão a cada vez; um deles pode acabar afirmando só o `success === false` e deixar de distinguir recusa por chave desconhecida de recusa por tipo. Uma regra (ou um auxiliar nomeado) fixaria a forma completa e faria a divergência aparecer.

- Evidência: tripla `success`/`unrecognized_keys`/`keys` repetida em 9 asserções — `packages/contracts/test/esquemas.spec.ts:931,949,1266,1714,2014,2604,2781,2947,3025`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-13T00:00:00Z

---

## [convention_drift] Estritude de esquema por direção do contrato

**Regra que isto sugere:** esquema de ENTRADA é sempre fechado e esquema de SAÍDA é sempre aberto, com a exceção — quando o conjunto fechado de chaves é o próprio conteúdo do contrato — registrada num ponto único e nomeado.

**O que ela faria (simples):** a regra "entrada fechada, saída aberta" governa todo esquema publicado do produto, mas não existe em rule nem em ADR nenhuma — vive só em dois docblocks de `src/`, copiados um do outro, e um deles ainda prescreve por escrito onde qualquer exceção teria de ser registrada. O resultado foi previsível: a primeira exceção do pacote nasceu num terceiro arquivo e as duas cópias passaram a afirmar "sem exceção" sobre um pacote que já tinha duas. Uma regra escrita faria o executor da próxima fatia encontrar o critério antes de decidir.

- Evidência: convenção declarada em duas cópias de docblock e em nenhuma rule/ADR — `packages/contracts/src/configuracao-de-mora.ts:117`, `packages/contracts/src/automacao-de-cobranca.ts:239`; exceções novas em `packages/contracts/src/confirmacao-de-email.ts:100,117`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-13T00:00:00Z

---

## [convention_drift] Fiação de teste de pacote novo

**Regra que isto sugere:** todo pacote novo do workspace nasce com o próprio `vitest.config.ts`, e a §5.1 da task que o cria o declara junto dos três arquivos de fiação.

**O que ela faria (simples):** o `vitest.config.ts` da raiz descobre suíte pelo padrão `packages/*/vitest.config.ts`, então um pacote sem o seu simplesmente não é executado pela raiz — sem erro, sem aviso, só some da contagem. A T4 listou os outros três arquivos de fiação e esqueceu este; o executor teve de entregá-lo fora do declarado para cumprir o critério de aceite.

- Evidência: `packages/documentos/vitest.config.ts` entregue fora da §5.1 — `docs/specs/features/documentos-e-confirmacao/v1/tasks/T4.md:155`; a única menção em rules é `.claude/rules/testing-stack.md:72` ("Config: vitest.config.ts na raiz do monorepo"), que descreve só metade do arranjo
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-13T00:00:00Z

---

## [repeated_assertion_shape] Lado esperado da normalização sempre literal

**Regra que isto sugere:** teste de função de normalização/serialização afirma o resultado contra literal escrito à mão, nunca contra outra chamada do próprio SUT.

**O que ela faria (simples):** comparar duas chamadas do SUT entre si passaria mesmo com a função devolvendo string vazia. A forma literal é o que impede a asserção de ficar infalível — e foi ela que fez o mutante de colapso derrubar os 12 casos.

- Evidência: `expect(normalizarParaComparacao(x)).toBe(<literal escrito à mão>)` em 6 pontos — `packages/documentos/test/normalizacao.spec.ts:225,235,236,243,272,273`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-13T00:00:00Z

---

## [repeated_fixture] Acessórios de arranjo das suítes E2E

**Regra que isto sugere:** reunir num acessório compartilhado de `apps/api/test` os montadores de arranjo que toda suíte E2E recopia — `pedir`, `entrar`, `conceder`, `criarPor`, `corpoDePessoa`, `corpoDeImovel`, `corpoDeContrato`, `montarPartes`, `criarContratoPor`, `pessoaOperandoComSenhaTrocada`.

**O que ela faria (simples):** o arquivo E2E novo desta task recopiou onze acessórios de arranjo do arquivo E2E vizinho, com o mesmo corpo e o mesmo propósito. Sem convenção escrita, cada suíte nova repete o bloco e as cópias divergem em silêncio — uma passa a montar o cenário por um caminho ligeiramente diferente do que o caso afirma montar.

- Evidência: onze acessórios com corpo equivalente em dois arquivos E2E — `apps/api/test/documento-do-contrato.e2e.spec.ts:652` × `apps/api/test/contratos.e2e.spec.ts:3641` — T7 / rota do documento do contrato
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-13T12:00:00Z

---

## [repeated_fixture] Extração de texto de PDF na verificação

**Regra que isto sugere:** um único acessório de extração de texto de PDF, com a fonte (arquivo em disco ou bytes de resposta) entrando por parâmetro.

**O que ela faria (simples):** existem hoje duas leituras de PDF na verificação, com o mesmo miolo (`getDocument` mais o percurso dos `TextItem`) e opções que precisam concordar (`useSystemFonts: false`, o diretório de fontes padrão). Se uma mudar de opção sem a outra, as duas passam a extrair coisas diferentes e o caso deixa de afirmar o que diz afirmar. Já coberto pelo `DÉBITO COM GATILHO — D5`, com gatilho no carnê da F4.

- Evidência: `extrairTextoDePdf` (`apps/api/test/documento-do-contrato.e2e.spec.ts:349`) × `extrairTextoDoPdf` (`packages/documentos/test/renderizador-pdf.spec.ts`) — mesmo miolo e mesmas opções
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-13T12:00:00Z

---

## [repeated_fixture] Arranjo de sessão real nos E2E da API

**Regra que isto sugere:** centralizar o arranjo de sessão dos testes E2E da API — cookie, rota de entrada, variáveis montadas e a função `entrar()` — num acessório compartilhado.

**O que ela faria (simples):** todo E2E da API que precisa de sessão redeclara as mesmas quatro peças (`SUFIXO_DO_COOKIE_DE_SESSAO`, `ROTA_DE_ENTRADA`, `VARIAVEIS_MONTADAS`, `entrar()`), e a T9 acrescentou a **oitava** cópia. Uma regra apontando o acessório evita que endurecer a entrada num arquivo deixe os outros sete para trás.

- Evidência: arranjo replicado em 8 arquivos E2E — `apps/api/test/confirmacao-de-email.e2e.spec.ts:116` × `automacao-de-cobranca.e2e.spec.ts:211` × `carteira.e2e.spec.ts:305` × mais cinco — T9 / o disparo da confirmação
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-13T20:00:00Z

---

## [repeated_assertion_shape] Molde da barreira de partida de variável

**Regra que isto sugere:** declarar o molde único de prova de variável exigida na partida — recusa nomeando a variável, sem devolver ambiente parcial e sem a credencial na mensagem.

**O que ela faria (simples):** cada variável nova de ambiente ganha um bloco novo repetindo as mesmas três asserções em vez de entrar numa tabela só. A T9 acrescentou o **terceiro** bloco; sem regra, a quarta variável repete o padrão outra vez e a disciplina da mensagem fica livre para divergir entre eles.

- Evidência: `falhaDe(fonte)` → `toContain('<VAR>: ausente')` → `not.toContain(SENHA_NA_CADEIA)` repetido em três blocos de `apps/api/test/ambiente.spec.ts` (linhas 190, 443, 503)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-13T20:00:00Z

---

## [repeated_fixture] Construtor de DadosDaPessoa em suítes

**Regra que isto sugere:** um construtor compartilhado de `DadosDaPessoa` para as suítes, em vez de o literal de 13 campos ser redigitado por arquivo.

**O que ela faria (simples):** cada suíte que precisa de uma pessoa redigita o mesmo objeto de 13 campos com um contador de documento próprio; hoje isso está em 27 arquivos de teste, e a T10 acrescentou o 28º. Um construtor único evitaria que um campo novo obrigatório do cadastro quebrasse dezenas de arquivos de uma vez, e que as cópias divirjam em qual campo cada uma preenche.

- Evidência: o literal `DadosDaPessoa` com `tipoPessoa: 'PESSOA_FISICA'` aparece em 27 arquivos de teste do monorepo, incluindo o criado pela T10 — `apps/worker/test/confirmacao-de-email.spec.ts:410` — T10 / borda da entrega da confirmação no worker
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-13T20:00:00Z

---

## [repeated_assertion_shape] Asserção de linha inteira em corpo de e-mail

**Regra que isto sugere:** asserção sobre corpo de mensagem compara a **linha inteira** (`corpo.split('\n')` + `toContain`), nunca `corpo.toContain(<trecho>)`.

**O que ela faria (simples):** os dois arquivos de teste da T10 repetem o mesmo molde para provar que um link está no corpo, e a razão está escrita em comentário nos dois: `toContain` do endereço passaria verde com uma linha que trouxesse o link colado a prefixo ou sufixo, e o link chegaria quebrado à caixa de quem recebe. Escrever isso como convenção pouparia o próximo autor de redescobrir o argumento — ou de não descobri-lo.

- Evidência: o molde `expect(<msg>.corpo.split('\n')).toContain(<linha esperada>)` aparece 4 vezes, em 2 arquivos da task — `packages/documentos/test/mensagem-de-confirmacao.spec.ts:89` — T10 / mensagem de confirmação e borda do worker
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-13T20:00:00Z

---

## [repeated_assertion_shape] Catálogo fechado reafirmado por fatia

**Regra que isto sugere:** a asserção de que o catálogo 10×7 não foi aberto tem um **único** ponto por arquivo de cobertura, e cada fatia afirma só o **delta** dela.

**O que ela faria (simples):** a mesma asserção literal sobre as áreas de tela do catálogo aparece **três vezes** no mesmo arquivo, uma por fatia que fechou a superfície; a quarta fatia vai copiá-la de novo, e o dia em que o catálogo mudar de forma serão três (ou quatro) pontos a editar em vez de um.

- Evidência: `expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO)` repetida em 3 casos distintos do mesmo arquivo — `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts:2991`, `:3127`, `:3323` — T12 / cobertura de autorização
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-13T23:30:00Z

---
