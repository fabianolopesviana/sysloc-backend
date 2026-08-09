# Rule candidates — contratos-de-locacao/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Contagem asserida derivada da lista canônica

**Regra que isto sugere:** em verificador shell, asserção de contagem de artefatos deriva o número do tamanho da lista canônica (`${#ARRAY[@]}`), nunca de literal escrito à mão.

**O que ela faria (simples):** enquanto o número era literal, acrescentar um artefato exigia lembrar de dois ou três lugares, e esquecer um deixava a asserção de número passando com o conjunto errado. A T1 aplicou o padrão em cinco pontos de dois verificadores, sempre com a mesma justificativa escrita à mão no comentário — sinal de que é convenção do projeto e não decisão local.

- Evidência: contagem derivada de `${#ARRAY[@]}` em 5 pontos de 2 verificadores, com a mesma justificativa repetida em comentário — `T1 / caracterização das regras legadas — frente shell` (`deploy/scripts/caracterizacao/verificar-golden.sh:128`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T01:20:00Z

---

## [repeated_fixture] Leitor da tabela de máscaras do PROCEDENCIA.md

**Regra que isto sugere:** o parse da seção `## 2. Máscaras aplicadas` do manifesto tem um leitor único, e os casos que dependem dele o consomem em vez de reescrevê-lo.

**O que ela faria (simples):** o mesmo bloco — regex da seção, split das colunas do markdown por posição, extração dos marcadores `<[A-Z_]+>` — está escrito duas vezes no mesmo arquivo, com tratamentos divergentes para a linha malformada (um acusa erro, o outro pula em silêncio). Uma regra apontando o leitor único evitaria que as duas cópias derivassem quando o formato do manifesto mudar.

- Evidência: parse da seção `## 2. Máscaras aplicadas` reescrito em CT-014 e em CT-433, com tratamento divergente para `len(colunas) < 4` — `T1 / caracterização das regras legadas — verificar-golden.sh` (`deploy/scripts/caracterizacao/verificar-golden.sh:567` e `:910`)
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-09T01:20:00Z

---

## [repeated_assertion_shape] Teto de coluna amarrado por literal no teste

**Regra que isto sugere:** todo teto/escala derivado de capacidade de coluna é escrito por extenso no teste e amarrado à constante exportada por igualdade exata, nunca derivado dela.

**O que ela faria (simples):** o mesmo formato de asserção já aparece em quatro lugares deste arquivo, sempre com o mesmo comentário explicando por quê: se o teste derivasse o valor da constante, as duas pontas andariam juntas e alargar a constante passaria verde — o mutante que o par existe para pegar. Uma regra escrita evitaria que a próxima fatia com coluna nova redescubra isso por tentativa, ou o esqueça e deixe a rede frouxa.

- Evidência: padrão `const TETO_DECLARADO_* = <literal>` + `expect([CONSTANTE_EXPORTADA]).toEqual([DECLARADO])` repetido em 4 blocos (janela, metragem, código do contrato, dinheiro e prazo) — `T2 / contrato de tipos do contrato de locação` (`packages/contracts/test/esquemas.spec.ts:458`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T02:40:00Z

---

## [repeated_fixture] Acessório de leitura de sequências do schema

**Regra que isto sugere:** acessório de introspecção de catálogo compartilhado por toda a suíte de `@sysloc/db`, em vez de recriado por arquivo de teste.

**O que ela faria (simples):** a mesma consulta a `pg_class` por `relkind = 'S'` foi escrita duas vezes na mesma task, em dois arquivos, e com projeções diferentes (nome qualificado num, nome nu no outro); o mesmo aconteceu com o bloco que fixa o contexto e chama `garantir_contador_de_contrato`. Uma regra apontando o lugar único evita que uma das cópias fique para trás quando a forma do nome do contador mudar.

- Evidência: `sequenciasDeNegocio` duplicada em dois specs, com projeções divergentes; `criarContadorPeloCaminhoDaAplicacao` e `emitirNumero` compartilham o mesmo par de instruções — `T3 / schema e migrações do contrato` (`packages/db/test/catalogo.spec.ts:555` e `packages/db/test/papel-de-conexao.spec.ts:456`)
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-09T04:10:00Z

---

## [repeated_assertion_shape] Retrato completo da guarda de cobertura

**Regra que isto sugere:** afirmar a guarda de cobertura sempre pelas DUAS listas numa igualdade só (`excecoes` vazia e `tabelasExaminadas` por extenso), nunca por uma das metades.

**O que ela faria (simples):** a mesma forma `toEqual({ excecoes: [], tabelasExaminadas: TABELAS_LEGITIMAS })` aparece dez vezes no arquivo, sempre pelo mesmo motivo escrito por extenso em cada ponto: sozinha, "nenhuma exceção" ficaria verde sobre um banco em que a consulta não alcançou tabela nenhuma. Escrever isso como regra evita que o próximo caso afirme só metade e reintroduza o falso verde que a forma existe para fechar.

- Evidência: `toEqual({ excecoes: [], tabelasExaminadas: TABELAS_LEGITIMAS })` em 10 pontos — `T3 / guarda de cobertura de isolamento` (`packages/db/test/catalogo.spec.ts:667`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T04:10:00Z

---

## [repeated_fixture] Leitura de artefato golden por caminho relativo profundo

**Regra que isto sugere:** centralizar a resolução dos artefatos golden num acessório compartilhado de `packages/db/test/`, em vez de repetir o `fileURLToPath(new URL('../../../docs/specs/...'))` em cada suíte.

**O que ela faria (simples):** a mesma constante `CAMINHO_DO_GOLDEN`, com a mesma subida de três níveis, já existe em duas suítes e nasce uma terceira a cada fatia que capture um oráculo; qualquer reorganização do diretório de specs teria de ser aplicada em N arquivos e falharia só em tempo de execução. É a mesma classe do débito D28 (consumo por caminho relativo profundo) registrado na F0/T5.

- Evidência: `CAMINHO_DO_GOLDEN` com `fileURLToPath(new URL('../../../docs/specs/.../golden/*.json'))` em duas suítes — `T4 / derivações puras do contrato` (`packages/db/test/metragem.spec.ts:234` e `packages/db/test/derivacao-de-contrato.spec.ts:138`)
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-09T07:30:00Z

---

## [repeated_assertion_shape] Contador de laço como âncora de varredura

**Regra que isto sugere:** padronizar a âncora de "o laço percorreu tudo" numa forma única — contagem prévia do conjunto asserida antes do laço —, em vez do par `let exercitados` + `expect(exercitados).toBe(TOTAL)` repetido por caso.

**O que ela faria (simples):** o mesmo par de linhas aparece três vezes no arquivo e é o idioma que a fatia vem usando para provar que uma varredura não parou cedo; escrever a convenção evita que cada suíte nova invente a sua e deixa claro qual asserção efetivamente ancora a contagem (a do conjunto, lida do disco) e qual é invariante de laço.

- Evidência: `let exercitados = 0` seguido de `expect(exercitados).toBe(...)` em três casos do mesmo arquivo — `T4 / derivações puras do contrato` (`packages/db/test/derivacao-de-contrato.spec.ts:323`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T07:30:00Z

---

## [repeated_assertion_shape] Leitura de SQLSTATE e nome de restrição em teste

**Regra que isto sugere:** centralizar num acessório compartilhado a leitura de `code` e `constraint_name` do erro do driver nas suítes de integração.

**O que ela faria (simples):** o mesmo par de funções que extrai o SQLSTATE e o nome da restrição do erro do postgres.js foi redigitado, com corpo praticamente idêntico, em pelo menos quatro arquivos de teste do pacote `db` — e numa quinta variante em `metragem.spec.ts`. Uma regra apontando um acessório único evita que cada suíte nova recopie a coerção `as { code?: unknown; constraint_name?: unknown }` e que as versões divirjam quando o driver mudar o nome do campo.

- Evidência: helper `nomeDaRestricao`/leitura de `constraint_name` replicado em 4 spec files do pacote db, mais uma variante inline — `T5 / porta de dados do contrato` (`packages/db/test/contrato.spec.ts:886`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T09:40:00Z

---

## [repeated_fixture] Arranjo de cadastro nasce pelas rotas reais

**Regra que isto sugere:** em suíte E2E, os cadastros de precondição nascem pelas rotas publicadas, e só o estado sem rota é escrito pela porta sob contexto de tenant.

**O que ela faria (simples):** o mesmo arranjo — conjunto, imóvel, locador, locatário e fiadores criados por POST nas rotas reais, com a empresa saindo da sessão — foi remontado do zero em cada suíte E2E da fatia; uma regra apontando o padrão evita que a próxima suíte grave precondição por conexão privilegiada e perca justamente a prova de isolamento entre empresas.

- Evidência: helper `montarPartes`/`criarPor` reconstruído no arquivo novo, no molde de `cadastro-de-imoveis.e2e.spec.ts` e `carteira.e2e.spec.ts` — `T6 / superfície de cadastro de contrato` (`apps/api/test/contratos.e2e.spec.ts:1209`)
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-09T13:10:00Z

---

## [repeated_assertion_shape] Recusa afirmada por igualdade de corpo inteiro

**Regra que isto sugere:** toda recusa de rota é afirmada por igualdade do corpo INTEIRO contra o envelope da ADR-0017, nunca por presença de campo.

**O que ela faria (simples):** o mesmo formato de asserção — `toEqual({ codigo, mensagem, campo, detalhes })` sobre a resposta completa — se repete em oito pontos desta suíte e nas suítes das fatias anteriores; escrita como regra, ela impede que uma asserção de presença deixe passar um campo novo vazando a entrada recusada, que foi exatamente o vetor que a fatia anterior mediu.

- Evidência: `toEqual` sobre o corpo completo da recusa em CT-409, CT-410, CT-411, CT-411 (b), CT-417 e CT-418 — `T6 / recusas das seis rotas` (`apps/api/test/contratos.e2e.spec.ts:578`)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-09T13:10:00Z

---

## [convention_drift] Âncoras de igualdade na §5.2 da task

**Regra que isto sugere:** declaração obrigatória, na §5.2 da task, dos arquivos-âncora de igualdade de conjunto que a publicação de símbolo ou de rota faz crescer.

**O que ela faria (simples):** três tasks deste run tocaram arquivos de âncora que a task não declarava, e cada uma custou aos dois gates uma análise de escopo para reconfirmar a mesma decisão. A regra faria o autor da spec listar `contexto.e2e.spec.ts` e `unidade-de-trabalho.spec.ts` junto com os demais arquivos derivados, e o executor saberia **pela task** — não pela suíte vermelha — que a âncora sobe em vez de virar contenção.

- Evidência: arquivos que afirmam conjunto por igualdade exata crescem obrigatoriamente quando a task publica símbolo ou rota, e nenhuma §5.2 os declara — enquanto `cobertura-de-autorizacao.e2e.spec.ts` e `contrato-publicado.e2e.spec.ts`, de natureza idêntica, são sempre declarados — `T6 / 3ª ocorrência do run, após T3 e T4` (`docs/specs/features/contratos-de-locacao/v1/tasks/T6.md:106`)
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-09T15:30:00Z

---

## [convention_drift] Contagem narrativa acompanha a âncora

**Regra que isto sugere:** toda contagem escrita em docblock ou título de `describe` sobe no mesmo diff da âncora executável que ela descreve.

**O que ela faria (simples):** as âncoras de superfície deste projeto são inventários escritos à mão, e o número aparece duas vezes: na constante que o teste afirma e na prosa que o humano revisa. A T7 subiu as cinco constantes com `SUT_IS_CORRECT_BECAUSE` e deixou três números na prosa para trás — e o docblock vizinho já adverte que um número desatualizado **convida a próxima task a "corrigir" a âncora para o valor errado**. A regra amarra as duas metades no mesmo diff.

- Evidência: âncoras subiram (`ROTAS_DESCRITAS` 39→40, `ROTAS_DE_CONTRATO` 6→7, `MANIPULADORES` 57→58) enquanto três contagens narrativas dos mesmos inventários ficaram no valor anterior — `T7 / ativação do contrato` (`apps/api/test/contrato-publicado.e2e.spec.ts:592`)
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-09T19:00:00Z

---
