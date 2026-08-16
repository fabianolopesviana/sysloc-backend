# Rule candidates — fundacao-bancaria/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Superfície de esquema afirmada contra lista literal

**Regra que isto sugere:** a forma canônica de afirmar a superfície de um esquema publicado é `Object.keys(esquema.shape)` comparado por igualdade a uma lista escrita por extenso no teste, nunca derivada do próprio shape.

**O que ela faria (simples):** o mesmo molde de asserção já aparece em quatro casos do pacote, e a razão dele vive repetida em comentário em cada um — derivar a expectativa do shape faz as duas pontas andarem juntas, e um campo novo (inclusive um que carregue segredo) entra na superfície publicada sem uma recusa sequer. Uma regra escrita pouparia a repetição da justificativa e daria ao próximo autor o padrão pronto, em vez de deixá-lo redescobrir a armadilha.

- Evidência: molde `expect(Object.keys(<esquema>.shape)).toEqual([...LISTA_LITERAL])` em três pontos dos casos novos, com a mesma justificativa repetida em docblock — `packages/contracts/test/esquemas.spec.ts:3395`, `:3590`, `:3594` — T1 / contrato da integração bancária em `@sysloc/contracts`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-14T00:00:00Z

---

## [repeated_assertion_shape] Controle positivo antes de varredura por sentinela

**Regra que isto sugere:** toda asserção que afirma AUSÊNCIA de uma agulha numa saída varrida carrega, imediatamente antes, um controle positivo que planta as mesmas sentinelas nas mesmas posições e as afirma **por igualdade**.

**O que ela faria (simples):** afirmar que a agulha não está na palha não prova nada enquanto não se souber que aquela busca a acha quando ela está lá. Uma varredura quebrada, um registrador que não escreveu ou um valor truncado deixam o teste verde sem provar coisa alguma. Escrita como regra, ela pouparia cada fatia de segurança de redescobrir o AP-29 pelo mesmo caminho — que foi a única causa de rejeição repetida da fatia anterior deste projeto.

- Evidência: molde controle-positivo-antes-da-asserção-de-ausência em **4 pontos** de `packages/shared/test/segredo-operavel.spec.ts` (envelope montado sem cifra; exceção de controle com uma agulha por canal; objeto sem invólucro que carrega o claro em 4 das 6 formas; fonte de controle que lê o ambiente) — `T2 / segredo operável`
- Evidência: mesmo molde `expect(<varredura>, '<rótulo>').toEqual([...])` pareado controle/saída-real em **4 pontos** de `packages/shared/test/log.spec.ts:1115,1134,1197,1217` — `T3 / redação do registrador estruturado`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` (emitido em **duas** tasks independentes) · 2026-08-14

---

## [repeated_assertion_shape] Listas-espelho de contagem exata do catálogo

**Regra que isto sugere:** toda lista que enumera objetos do catálogo por igualdade é escrita à mão, cresce no mesmo commit da migração que a move, e **nunca** é derivada da consulta que ela confere.

**O que ela faria (simples):** o mesmo formato de asserção — uma lista literal de nomes comparada por igualdade contra o que o banco devolve — aparece em **cinco** pontos independentes e em **duas linguagens**, e toda migração que cria tabela obriga a crescer todos no mesmo commit. Quem esquece um descobre pela suíte vermelha longe da causa; quem "resolve" derivando a lista da própria consulta **apaga a prova em silêncio**. Uma regra escrita diria de uma vez onde estão as listas, que elas crescem juntas, e que trocar igualdade por contenção é proibido.

- Evidência: cinco listas-espelho de contagem exata cresceram na mesma task, cada uma com o aviso anti-`toContain` reescrito à mão no próprio docblock — `packages/db/test/papel-de-conexao.spec.ts:122`, `packages/db/test/catalogo.spec.ts:227`, `packages/db/test/unidade-de-trabalho.spec.ts:302`, `deploy/scripts/instalacao/verificar-migracao.sh:232`, `deploy/scripts/instalacao/migrar-banco.sh:301` — `T4 / migrações 0015/0016 e o raio de impacto da tabela nova`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-14

---

## [repeated_fixture] Execução privilegiada de DDL em teste

**Regra que isto sugere:** acessório único para DDL privilegiada em teste do pacote `db`, **importado** em vez de redeclarado.

**O que ela faria (simples):** a função `executarPrivilegiado(cadeia, instrucoes)` está declarada com assinatura e corpo **idênticos em três arquivos de teste do mesmo pacote**, e o cabeçalho do arquivo novo já reconhece a cópia por escrito. Uma regra apontando o lar único evitaria que endurecer a abertura da conexão num deles deixe os outros dois para trás — que é a mesma forma dos débitos **D3** e **D49** já registrados na fatia anterior.

- Evidência: `executarPrivilegiado` com assinatura e corpo idênticos em `packages/db/test/catalogo-de-plataforma.spec.ts:229`, `packages/db/test/catalogo.spec.ts:546` e `packages/db/test/isolamento.spec.ts:4350` — `T5 / guarda de admissão do schema plataforma`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-14

---

## [repeated_fixture] Abertura da instância efêmera em specs de banco

**Regra que isto sugere:** specs de `packages/db/test` que tocam banco abrem a instância efêmera por um acessório compartilhado, com os tetos de tempo declarados nele em vez de redigitados por arquivo.

**O que ela faria (simples):** cada spec de banco reescreve o mesmo bloco — as constantes `LIMITE_SUBIDA_MS`/`LIMITE_DO_CASO_MS` e o par `beforeAll(bancoEfemero + abrirAcessoAoBanco)` / `afterAll(encerrar + parar)`. Uma regra apontando o acessório único evitaria que um arquivo novo herde um teto desatualizado por cópia, que é como um caso vira flake por timeout nesta base.

- Evidência: mesmo bloco de tetos de tempo e mesmo par beforeAll/afterAll em dois specs do pacote — `packages/db/test/identificador-bancario.spec.ts:111`, `:213` e `packages/db/test/unidade-de-trabalho.spec.ts:142` — T6 / mecanismo do identificador perante o provedor
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [repeated_assertion_shape] Conferência de saída contra esquema publicado

**Regra que isto sugere:** a conferência de uma saída contra esquema de `@sysloc/contracts` usa uma forma única de asserção em vez de `expect(ESQUEMA_X.safeParse(v).success).toBe(true)` repetido.

**O que ela faria (simples):** o mesmo molde de asserção aparece cinco vezes no arquivo, e ele descarta o motivo da recusa — quando reprova, diz apenas `true !== false`. Uma forma única (um matcher ou acessório que afirme sobre o resultado do parse) daria a mensagem de erro do Zod junto e pouparia a releitura do caso para descobrir o que não casou.

- Evidência: `expect(ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(...).success).toBe(...)` em cinco pontos do mesmo arquivo — `packages/db/test/identificador-bancario.spec.ts:323`, `:336`, `:340`, `:345`, `:521` — T6 / composição das 18 posições
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [convention_drift] Sufixo de domínio em constante exportada

**Regra que isto sugere:** constante exportada de `@sysloc/contracts` carrega o domínio no nome, porque o barril é achatado e o pacote é importado pelo frontend.

**O que ela faria (simples):** o pacote de contratos reexporta tudo por nome num barril único, então dois módulos que publiquem a mesma ideia colidem — e o produto já tem três séries com contador. Hoje a convenção só existe como imitação dos dois precedentes (`LARGURA_DO_SEQUENCIAL_DE_CONTRATO` e `..._DE_COBRANCA`) e não está escrita em lugar nenhum, de modo que o par bancário foi publicado cru; a regra evitaria renomear símbolo já publicado depois do congelamento da superfície.

- Evidência: `LARGURA_DA_COMPETENCIA` e `LARGURA_DO_CONTADOR` exportados sem sufixo (`packages/contracts/src/integracao-bancaria.ts:201`, `:210`; `packages/contracts/src/index.ts:166`), contra `LARGURA_DO_SEQUENCIAL_DE_CONTRATO` (`contrato.ts:85`) e `..._DE_COBRANCA` (`cobranca.ts:185`); e `LARGURA_DO_ANO_NO_CODIGO` já duplicada em dois módulos, coexistindo só por ser privada — T6 / composição do identificador perante o provedor
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-15

---

## [repeated_fixture] Conexão privilegiada com tenant fixado em testes

**Regra que isto sugere:** o acessório que abre a conexão de migração e fixa `app.empresa_id` antes de ler cru deve ter lar único em `packages/db/test/`, em vez de ser reescrito por spec.

**O que ela faria (simples):** três specs do pacote já reescrevem o mesmo molde — abrir a conexão de migração, chamar `set_config('app.empresa_id', …, false)` com reserva de uma conexão e encerrar no `finally` —, e ele é **sutil**: sem fixar o contexto, a tabela com `FORCE ROW LEVEL SECURITY` devolve vazio mesmo para o dono, e o teste passa a medir a política em vez do que pretendia. Uma regra apontando o acessório compartilhado evita que a próxima cópia esqueça o `set_config` e meça a coisa errada **sem que nada acuse**.

- Evidência: molde `abrirConexao(conexaoDeMigracao(...)) + set_config('app.empresa_id', …, false)` reescrito em 3 specs — `packages/db/test/certificado-do-provedor.spec.ts:1036`, `packages/db/test/papel-de-conexao.spec.ts:530`, `packages/db/test/catalogo.spec.ts:1364` — T7 / camada de dados do certificado do provedor
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [repeated_assertion_shape] Fuso da operação declarado em três lugares livres

**Regra que isto sugere:** o fuso da operação deve ter uma declaração executável única, exposta por função de banco vizinha de `data_corrente_da_operacao()`, e nenhum literal de fuso deve ser escrito em código de aplicação.

**O que ela faria (simples):** o literal `America/Sao_Paulo` passou a existir em três pontos independentes do pacote — o corpo de `data_corrente_da_operacao()` na migração `0010`, a constante privada `FUSO_DA_OPERACAO` de `envio-de-cobranca.ts` (que **não é importável**) e agora a comparação de vigência do certificado —, e **nada amarra os três**. Divergir um deles muda quem é aceito e quem é recusado, **em silêncio e sem nenhum teste reprovar**. O débito `D14` já agendava dois; este é o terceiro, e a repetição deixou de ser coincidência.

- Evidência: literal do fuso da operação em 3 declarações executáveis independentes — `packages/db/src/certificado-do-provedor.ts:389`, `packages/db/src/envio-de-cobranca.ts:176`, `packages/db/migracoes/0010_seguranca_cobranca.sql:113-119` — T7 / comparação de vigência do certificado
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [repeated_assertion_shape] Ausência afirmada por lista vazia com controle positivo

**Regra que isto sugere:** toda asserção de ausência sobre varredura estática é escrita como `toEqual([])` da lista de ocorrências e vem acompanhada de um **controle positivo** que exerce a **mesma** função de varredura sobre entrada sintética.

**O que ela faria (simples):** o mesmo formato já se repete dentro e fora desta task — uma varredura devolve a lista de ocorrências, o teste afirma que ela é vazia **por igualdade** (para que a reprovação **nomeie** o ofensor, em vez de dizer só que algo deu errado) e, logo antes, submete um objeto ou fonte sintético à mesma função para provar que ela **acha o que existe**. Sem o controle, um detector quebrado devolve lista vazia e a suíte aprova qualquer coisa **para sempre** — que é o AP-29, e foi a única causa de rejeição repetida da fatia anterior. Uma regra escrita pouparia cada autor de redescobrir o par por conta própria.

- Evidência: cinco pares varredura+controle no mesmo formato — `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:469`, `:511`, `:575` — e o mesmo molde já em uso em `packages/contracts/test/esquemas.spec.ts:3880` (*"Ela é também o controle positivo da varredura: um padrão quebrado devolveria []"*) — T8 / pacote `@sysloc/cobranca-bancaria`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [repeated_fixture] Material PKCS#12 de teste vem do acessório compartilhado

**Regra que isto sugere:** todo caso que precise de material PKCS#12 o obtém de `packages/cobranca-bancaria/test/material-de-teste.ts` (autoridade + material com senha por parâmetro), **nunca** fabricado no próprio caso nem versionado.

**O que ela faria (simples):** o mesmo par `gerarAutoridadeDeTeste` + `gerarMaterialDeTeste` já é montado em dois casos desta task, e a **T10** (CT-840, CT-843, CT-844) vai precisar exatamente dele **com duas autoridades**. Sem a convenção escrita, o caso seguinte tende a fabricar material por conta própria — e é assim que um `.pfx` acaba na árvore, contrariando o **Invariante 3** do projeto.

- Evidência: `gerarAutoridadeDeTeste(...)` + `gerarMaterialDeTeste({ autoridade, senha })` montados de forma idêntica em CT-806 e CT-807 — `packages/cobranca-bancaria/test/leitura-do-material.spec.ts:294`, `:362` — T9 / leitura do material PKCS#12
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-15

---

## [convention_drift] Numeração de CT nascido fora dos cards

**Regra que isto sugere:** caso de teste criado como **rede de correção de gate** recebe identificador de uma faixa reservada **acima** da faixa dos cards, nunca reusa nem sufixa um CT existente.

**O que ela faria (simples):** quando um gate exige um caso novo no meio do run, **todos** os CTs da fatia já estão reservados pelos cards das tasks — e não há regra escrita dizendo de onde tirar o próximo número. Cada executor decide sozinho (aqui foram `CT-860`/`CT-861` na T7 e `CT-862` na T9, **por imitação**), e a declaração de faixa contígua no `task_plan` fica falsa **sem que nada acuse**. A regra daria o intervalo de antemão e diria onde registrar a saída, para o fecho da fatia não ter de decidir se é defeito ou registro vencido.

- Evidência: faixa declarada *"CT-801 a CT-853, contíguos e sem sufixo"* convivendo com `CT-860`, `CT-861` e `CT-862` emitidos como rede de gate — `docs/specs/features/fundacao-bancaria/v1/task_plan.md:269`, `tasks/T7.md:410`, `tasks/T9.md:298`. ⚠️ **Sweep de cobertura feito**: nenhuma rule em `.claude/rules/*` e nenhuma ADR cobre alocação de identificador de CT (a busca por *"faixa"*/*"contígu"* retornou só a `nao-regressao.md` §3-B, que trata de numeração de **débito**, não de CT) — T9 / leitura do material PKCS#12
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-15

---

## [repeated_fixture] Par TLS instrumentado de teste

**Regra que isto sugere:** acessório compartilhado único para o par TLS mútuo instrumentado que faz as vezes do provedor bancário.

**O que ela faria (simples):** a maquinaria que sobe um par TLS em porta dinâmica e conta conexões, apertos de mão e titulares já existe em dois arquivos de teste, e endurecer uma cópia deixa a outra para trás; uma regra apontando o acessório único evitaria que a próxima suíte escrevesse a terceira. O próprio arquivo registra que a promoção é decisão de quem tiver o terceiro consumidor.

- Evidência: `subirParDoProvedor`/`subirParMudo`/`portaSemOuvinte` montados nos cinco casos da T12, com a maquinaria irmã vivendo em `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` — `apps/api/test/certificado-do-provedor.e2e.spec.ts:933`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-15T00:00:00Z

---

## [repeated_assertion_shape] Discriminador antes da igualdade

**Regra que isto sugere:** a asserção que distingue um campo dos textos irmãos vem ANTES do `toEqual` que fixa o valor dele.

**O que ela faria (simples):** o `toEqual` aborta o caso ao falhar, então uma distinção posta depois só executa quando a igualdade já provou o valor — e aí ela compara dois literais do próprio teste, sem participação do SUT. Escrever a ordem como regra fecharia na origem a asserção infalível (AP-29) que já reprovou a T8 e a T10 desta mesma fatia.

- Evidência: o bloco `expect(x.detalhe).not.toBe(...)` seguido de `expect(x).toEqual({...})` em quatro pontos, sempre nessa ordem e sempre comentado com a razão — `apps/api/test/certificado-do-provedor.e2e.spec.ts:957`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-15T00:00:00Z

---
