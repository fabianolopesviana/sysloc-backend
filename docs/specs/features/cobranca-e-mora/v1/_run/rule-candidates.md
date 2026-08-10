# Rule candidates — cobranca-e-mora/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Fixture de módulo por recurso publicado

**Regra que isto sugere:** todo recurso publicado ganha uma constante de módulo no `.spec.ts` (`CORPO_DE_X` para entrada, `X_PUBLICADA` para saída) que os casos remendam com spread, em vez de literais por caso.

**O que ela faria (simples):** os casos novos da cobrança reusam duas fixtures de módulo em cinco `describe` diferentes, e é isso que faz um campo novo do contrato aparecer em todos os casos de uma vez; sem a convenção escrita, o próximo implementador escreve literais por caso e o remendo de um campo passa a divergir entre eles.

- Evidência: `CORPO_DE_COBRANCA` e `COBRANCA_PUBLICADA` remendados por spread em CT-540 a CT-544 — `packages/contracts/test/esquemas.spec.ts:308` — T2 / contrato de tipos da cobrança
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T02:10:00Z

---

## [repeated_assertion_shape] Recusa de esquema afirma success e path do campo

**Regra que isto sugere:** toda recusa de esquema é afirmada pelo par `success === false` + `issues[0].path === [campo]` (ou `issues[0].code`), nunca só por `success === false`.

**O que ela faria (simples):** a mesma dupla de asserções aparece em quatro casos desta task, e é ela que impede uma recusa de chegar ao cliente sem nome de campo — o que a §6.1 do tech spec exige como `422 CAMPO_INVALIDO`; escrita como regra, ela deixa de depender de o autor do próximo esquema lembrar de copiar o formato.

- Evidência: `expect(resultado.success).toBe(false)` seguido de `expect(resultado.error?.issues[0]?.path).toEqual([campo])` em quatro describes — `packages/contracts/test/esquemas.spec.ts:1453` — T2 / contrato de tipos da cobrança
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T02:10:00Z

---

## [convention_drift] Listas-espelho de objetos do schema de negócio

**Regra que isto sugere:** toda criação de tabela ou função em `negocio` atualiza, no mesmo commit, as quatro listas exatas que espelham o schema, e o ponto único que as nomeia vive no cabeçalho do arquivo de esquema.

**O que ela faria (simples):** quatro listas exatas em três frentes precisam crescer junto com o schema, mas nenhuma é descobrível a partir das outras — cada fatia que cria tabela as reencontra por lista vermelha depois do fato, e a da frente shell só é conferida por quem consegue rodar `sudo`. A regra faria o autor da task já declarar os quatro arquivos como impactados.

- Evidência: `TABELAS_LEGITIMAS`, `TABELAS_DE_NEGOCIO_ESPERADAS` (TypeScript e shell) e `SIMBOLOS_ESPERADOS` — duas ausentes da §5.2 da task e alcançadas por reprovação da suíte, repetindo o padrão das migrações `0005` e `0007` — `packages/db/test/catalogo.spec.ts:198` — T3 / schema e migrações da cobrança
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T04:30:00Z

---

## [repeated_fixture] Subida de instância efêmera e acesso ao banco

**Regra que isto sugere:** padronizar num acessório único o par `bancoEfemero()` + `abrirAcessoAoBanco({ maximoDeConexoes })` que toda suíte de `packages/db/test/` repete na abertura.

**O que ela faria (simples):** a mesma abertura de instância efêmera mais reserva de conexão é reescrita à mão em cada bloco de suíte, inclusive duas vezes no mesmo arquivo quando um caso precisa de instância dedicada para mutantes; uma regra apontando o acessório canônico evita que cada suíte escolha um número de conexões e um limite de subida diferentes.

- Evidência: `bancoEfemero()` + `abrirAcessoAoBanco({ maximoDeConexoes: RESERVA_DE_UMA })` repetido na instância principal e na dedicada aos mutantes — `packages/db/test/cobranca.spec.ts:348` — T4 / porta de dados da cobrança
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T05:10:00Z

---

## [repeated_assertion_shape] Leitura crua da visão comparada por objeto inteiro

**Regra que isto sugere:** afirmar os derivados monetários da visão pelo objeto inteiro em cadeia `numeric`, e nunca campo a campo nem por número convertido.

**O que ela faria (simples):** a mesma forma de asserção — ler os cinco derivados como texto e comparar o objeto completo por igualdade — aparece em seis pontos de três casos, sempre pela mesma razão (a cadeia é o que preserva a escala do `numeric(15,2)`, que o número em JavaScript perde); escrita como regra, deixa de depender de cada autor redescobrir o motivo.

- Evidência: `expect(await lerDerivadaCrua(...)).toEqual({ status, dias_atraso, valor_multa, valor_juros, valor_total })` em seis pontos — `packages/db/test/cobranca.spec.ts:497` — T4 / CT-513, CT-524 e CT-526
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T05:10:00Z

---

## [repeated_assertion_shape] Companheiro negativo por interseção vazia

**Regra que isto sugere:** todo caso de isolamento afirma o conjunto próprio por igualdade E a interseção com o conjunto da outra empresa como lista vazia.

**O que ela faria (simples):** o par — igualdade do conjunto próprio, seguida de interseção igual a `[]` — repete-se em quatro pontos e já era o molde do CT-107; escrever a convenção evita que um caso de isolamento futuro afirme só o conjunto próprio, que fica verde mesmo quando a linha alheia atravessa junto.

- Evidência: `expect(intersecao(<lidos>, <ids da outra empresa>)).toEqual([])` nos casos novos de isolamento — `packages/db/test/isolamento.spec.ts:3418` — T3 / visão `negocio.cobranca_derivada`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T04:00:00Z

---

## [convention_drift] Lista fechada publicada exige asserção de congelamento

**Regra que isto sugere:** toda constante de lista fechada exportada por `@sysloc/contracts` tem, no CT que a cobre, igualdade contra lista escrita por extenso no teste e asserção de `Object.isFrozen`.

**O que ela faria (simples):** o CT-540 já aplica esse par a `NATUREZAS_DE_COBRANCA` e `ESTADOS_DA_COBRANCA`, mas a convenção não está escrita em rule nem em ADR — só existe como precedente no próprio arquivo de teste. Por isso `ESTADOS_EM_ABERTO`, publicada pelo mesmo módulo e pela mesma razão, entrou congelada e sem ninguém afirmando que está congelada. Com a regra escrita, um `push` de consumidor deixaria de atravessar a suíte em silêncio.

- Evidência: `ESTADOS_EM_ABERTO` publicada sem nenhuma asserção em `packages/contracts/test/`, enquanto os dois irmãos do mesmo módulo têm igualdade por extenso e `Object.isFrozen` no CT-540 — `packages/contracts/src/cobranca.ts:158` — T4 / porta de dados da cobrança
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:00:00Z

---

## [repeated_fixture] Acessório HTTP e de concessão das suítes E2E

**Regra que isto sugere:** centralizar o acessório de requisição HTTP, entrada de sessão e concessão de chaves num utilitário compartilhado das suítes E2E de `apps/api/test/`, em vez de recopiá-lo por arquivo.

**O que ela faria (simples):** toda suíte E2E nova recopia o mesmo trio — `pedir` (requisição com `Origin` e leitura de cookie), `entrar` (login pela rota real) e `conceder` (ajuste de chaves pela camada de dados) — mais a lista `VARIAVEIS_MONTADAS` de restauração de ambiente. Hoje são 12 cópias de `pedir`, 6 de `conceder` e 18 de `VARIAVEIS_MONTADAS`, e a T6 acrescentou uma de cada. A regra evitaria que a próxima suíte copie de novo e que as cópias divirjam em silêncio quando a barreira de admissão ou o cabeçalho conferido mudar.

- Evidência: acessórios `pedir`/`entrar`/`conceder` replicados literalmente entre suítes E2E de `apps/api/test/` — `apps/api/test/mora.e2e.spec.ts:584` — T6 / duas rotas de `/v1/multa-e-juros`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T08:20:00Z

---

## [convention_drift] Constante de módulo devolvida por porta

**Regra que isto sugere:** constante de módulo que uma porta devolve como valor da ausência nasce sob `Object.freeze`.

**O que ela faria (simples):** quatro portas de `packages/db/src` congelam o objeto que devolvem quando não há linha, com o docblock *"Congelado — é compartilhado por toda leitura"*, e a quinta nasceu sem congelar porque a convenção só existe no código. O `readonly` do tipo não substitui o congelamento: ele se perde quando o serviço alarga o tipo na borda, e aí um consumidor pode mutar o objeto do processo inteiro.

- Evidência: `POLITICA_AUSENTE` devolvida por referência sem `Object.freeze`, contra 4 precedentes congelados no mesmo pacote (`SEM_FIADORES`, `SEM_COMODOS`, `SEM_IMOVEIS`, `EFEITOS_DA_ATIVACAO`) — `packages/db/src/configuracao-de-mora.ts:119` — T6 / porta da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---

## [convention_drift] Esquema de saída aberto, entrada fechada

**Regra que isto sugere:** esquema de **ENTRADA** é `strictObject` e esquema de **SAÍDA** publicado é `z.object` — a assimetria é a regra, não a exceção.

**O que ela faria (simples):** o pacote de contratos aplica essa divisão em 13 de 13 esquemas, mas ela não está escrita em rule nem em ADR — só é inferível por imitação do arquivo vizinho, e o `DECISÃO FECHADA` que existe cobre a restrição de *escala*, não o fechamento do objeto. O sétimo esquema de saída nasceu fechado, e como nenhuma varredura da suíte olha esquema de saída, a divergência viaja para o documento OpenAPI publicado como `additionalProperties: false`.

- Evidência: `esquemaDaConfiguracaoDeMora` é `strictObject`; os 6 esquemas de saída anteriores do pacote são todos `z.object` — `packages/contracts/src/configuracao-de-mora.ts:117` — T6 / contrato publicado da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---

## [convention_drift] Tipo de escrita separado do de leitura

**Regra que isto sugere:** porta de escrita recebe um tipo `DadosDeX` próprio, nunca o `XPersistido` que a leitura devolve.

**O que ela faria (simples):** as sete portas de escrita do pacote declaram um tipo de entrada dedicado, e a oitava reusou o de saída porque as duas formas coincidem hoje. A separação é o que impede o primeiro campo somente-de-leitura de virar campo exigido no corpo da escrita — foi entrada e saída partilhadas que produziram o furo do `status_locacao` em `alterarImovel`.

- Evidência: `gravarConfiguracaoDeMora(tx, dados: ConfiguracaoDeMoraPersistida)` contra `DadosDaCobranca`, `DadosDoContrato`, `DadosDoImovel`, `DadosDaAlteracaoDoImovel`, `DadosDoConjunto`, `DadosDoComodo` — `packages/db/src/configuracao-de-mora.ts:192` — T6 / porta da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---

## [executor_askquestion] Escalada do executor não alcança o usuário

**Regra que isto sugere:** o executor que atinge um gatilho de parada declara a escalada no sumário de retorno, num campo próprio, em vez de tentar `AskUserQuestion`.

**O que ela faria (simples):** o executor da T7 atingiu o gatilho legítimo *"implementar exige alterar arquivo fora da lista declarada"* e tentou parar para perguntar — mas `AskUserQuestion` não opera em subagente, então a tentativa se perdeu e a decisão foi tomada sozinha, aparecendo só como prosa avulsa depois do bloco de retorno. Com a regra, a escalada chegaria ao orquestrador num campo que ele lê sempre, em vez de depender de o executor escrever um parágrafo extra que o formato de saída não prevê.

- Evidência: *"Tentei escalar por `AskUserQuestion`; a ferramenta não existe em subagente"* — emenda de `packages/db/migracoes/0010_seguranca_cobranca.sql` fora da §5.2 — T7 / duas transições da cobrança
- Sinal: `executor_askquestion` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-10T09:40:00Z

---

## [repeated_assertion_shape] Envelope de erro da ADR-0017 afirmado literal

**Regra que isto sugere:** o envelope de erro esperado num teste de rota vem de um construtor único, e não de um literal reescrito em cada caso.

**O que ela faria (simples):** o mesmo objeto `{ codigo, mensagem, campo, detalhes }` é redigitado nove vezes no mesmo arquivo de rota — seis delas acrescentadas pela T7. Cada cópia é um lugar onde a forma do envelope pode divergir do que a ADR-0017 fixa, e uma mudança de contrato obriga a editar as nove. Um construtor de envelope esperado mantém a asserção por **igualdade de objeto inteiro** — que é o que discrimina — sem multiplicar a redação.

- Evidência: envelope afirmado por igualdade em 9 pontos do mesmo arquivo — `apps/api/test/cobrancas.e2e.spec.ts:805` — T7 / as duas transições da cobrança
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T10:05:00Z

---

## [repeated_fixture] Acessórios `pagar`/`cancelar` duplicados por camada

**Regra que isto sugere:** o acessório de arranjo que monta estado terminal chama a camada de produção mais baixa alcançável pela suíte, e o nome dele é o mesmo nas duas frentes.

**O que ela faria (simples):** a T7 criou o par `pagar`/`cancelar` duas vezes, com o mesmo nome e o mesmo papel — na suíte de rota ele fala HTTP, na de dados ele fala pela porta. A convenção funcionou e vale escrever, porque foi a **ausência** dela que produziu os dois acessórios crus que a T7 teve de substituir: eles escreviam o desfecho por `UPDATE` à mão e sobreviveram um gate inteiro. A regra evita que a próxima fatia repita o `UPDATE` cru e evita a divergência de nome entre as duas suítes.

- Evidência: acessórios homônimos definidos independentemente nas duas suítes da mesma entidade, um pela rota e outro pela porta — `packages/db/test/cobranca.spec.ts:2057` — T7 / as duas transições da cobrança
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T10:05:00Z

---

## [scope_deviation] Migração não aplicada é emendável, aplicada não

**Regra que isto sugere:** arquivo de migração é emendável enquanto nenhum banco durável o aplicou, e a janela fecha com `DÉBITO COM GATILHO` no próprio arquivo.

**O que ela faria (simples):** a T7 precisou corrigir um defeito latente da visão criada três tasks antes, e a alternativa correta (migração nova) invalidaria dois mutantes que leem o `CREATE VIEW` do arquivo original — então emendar era o caminho certo, mas **nada no repositório diz quando ele deixa de ser**. A regra faria o executor declarar o arquivo no escopo e registrar que a emenda expira na primeira aplicação durável, que é quando a guarda de `sha256sum` do instalador passa a abortar.

- Evidência: emenda de `packages/db/migracoes/0010_seguranca_cobranca.sql` fora da §5.2, em arquivo protegido por guarda de soma em `deploy/scripts/instalacao/migrar-banco.sh:519` — T7 / duas transições da cobrança
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-10T10:30:00Z

---

## [convention_drift] Âncora de conjunto exato por superfície publicada

**Regra que isto sugere:** toda superfície publicada — colunas de tabela **e de visão derivada**, inventário de rotas, símbolos exportados — tem âncora de **igualdade de conjunto**, nunca de contenção.

**O que ela faria (simples):** o repositório aplica essa âncora com rigor em quatro lugares (colunas da tabela, contagem e conjunto de rotas, símbolos publicados do pacote de dados), mas a prática **não está escrita** em rule nem em ADR. O resultado é que a visão que esta fatia declara *fonte única do estado* ganhou duas colunas sem nada forçando revisão, enquanto a tabela que ela deriva tem a sua âncora.

- Evidência: `CT-510 (b)` afirma a lista ordenada inteira de `negocio.cobranca`; `negocio.cobranca_derivada` só tem conferência de **tipo** de uma coluna e recebeu duas colunas novas — `packages/db/test/fonte-unica-do-estado.spec.ts:299` — T7
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T10:30:00Z

---

## [convention_drift] Emenda de ADR aceita sem convenção

**Regra que isto sugere:** forma única para emendar ADR `accepted` cujo **registro** estava impreciso e cuja **decisão não mudou** — bloco datado na seção emendada, com a redação original, o que mudou, por que a decisão não mudou e a origem, mais `amended:` no frontmatter do template.

**O que ela faria (simples):** o domínio ADR do framework cobre criar, supersedar, depreciar e reindexar, mas **não** cobre *"a decisão está certa e o texto que a registra está impreciso"* — que foi exatamente o caso aqui, e cuja saída o usuário escolheu entre três. Sem regra escrita, a próxima emenda inventa outra forma, e a partir da terceira não há como distinguir por varredura o que é redação original do que é redação emendada.

- Evidência: primeira emenda in loco de ADR `accepted` do repositório (`grep -rn "Emenda de" docs/adr/*.md` casa só neste arquivo); sweep por `emenda|emendar|amend` em `.claude/rules/` e nas skills `agent-spec-adr-*` voltou vazio; o template canônico não tem campo de emenda e o frontmatter segue `date: 2026-08-09` com corpo editado em 2026-08-10 — `docs/adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md:43` — T7
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T11:00:00Z

---

## [repeated_fixture] Corpo de contrato válido para teste

**Regra que isto sugere:** um único construtor compartilhado do corpo de contrato válido, consumido por qualquer suíte que precise dele.

**O que ela faria (simples):** a mesma fixture `CORPO_DE_CONTRATO`, com os mesmos nove campos, foi recriada em **dois pacotes** diferentes e com valores distintos. Uma regra apontando o construtor único evitaria que uma mudança no esquema do contrato deixasse uma das cópias inválida **em silêncio**.

- Evidência: `CORPO_DE_CONTRATO` com os mesmos 9 campos em dois pacotes — `packages/db/test/derivacao-de-cobranca.spec.ts:585` e `packages/contracts/test/esquemas.spec.ts:275` — T8
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T12:15:00Z

---

## [repeated_assertion_shape] Afirmar campo constante em toda a lista

**Regra que isto sugere:** padronizar a forma de afirmar que um campo é o mesmo em **toda** a coleção, em vez de repetir a projeção mais `Array.from` de comprimento.

**O que ela faria (simples):** a construção `expect(lista.map(projecao), rotulo).toEqual(Array.from({ length: n }, () => valor))` aparece três vezes no mesmo caso. Uma forma nomeada tornaria a intenção explícita e a falha mais legível do que uma diferença entre dois arranjos de treze elementos iguais.

- Evidência: projeção + `Array.from` em 3 asserções do `CT-507` — `packages/db/test/derivacao-de-cobranca.spec.ts:615` — T8
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T12:15:00Z

---

## [convention_drift] Consequência obrigatória fora da §5.2

**Regra que isto sugere:** a §5.2 de uma task inclui os arquivos que a **publicação de símbolo em índice auditado por igualdade** e a **emissão de marcador de débito** tornam consequência obrigatória.

**O que ela faria (simples):** publicar símbolo no índice de `@sysloc/db` **reprova o `CT-012`** até que o inventário de superfície seja atualizado, e emitir um `DÉBITO COM GATILHO` obriga por rule a fechar as duas pontas do índice (`CLAUDE.md` e a §2 do run-report). Mas a §5.2 das tasks não lista nenhum desses arquivos — então o executor os toca por necessidade e os declara como pendência, e os **dois** gates gastam uma passagem decidindo se foi alargamento de escopo. Na **nona** ocorrência, a regra pouparia o julgamento repetido ao tornar a consequência previsível na spec.

- Evidência: a §5.2 da T8 declara só `packages/db/src/index.ts`, mas a execução tocou por obrigação mecânica `packages/db/test/unidade-de-trabalho.spec.ts` (inventário do `CT-012` por igualdade exata), `CLAUDE.md` e o `_run/run-report.md` da fatia — `docs/specs/features/cobranca-e-mora/v1/tasks/T8.md:94` — T8
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T13:00:00Z

---

## [repeated_assertion_shape] Ativação de contrato afirmada inline nos cenários

**Regra que isto sugere:** cenário que só precisa do contrato `ATIVO` usa um auxiliar que **levanta** em status inesperado, em vez de repetir a asserção de `200` da rota de ativação.

**O que ela faria (simples):** a mesma linha `expect((await transitar(cookie, X.codigo, 'ativacao')).status).toBe(200)` aparece **seis** vezes no arquivo, três delas escritas pela T10 — e ali ela é **montagem de cenário**, não o invariante do caso. O arquivo já tem a forma boa (`lancarCobranca`, `pagarCobranca` levantam com o status e o corpo na mensagem), o que dá diagnóstico melhor quando a montagem falha e deixa claro qual asserção é a prova do caso.

- Evidência: a mesma asserção de ativação em 6 pontos do mesmo arquivo, 3 acrescentados pela T10 — `apps/api/test/contratos.e2e.spec.ts:2981` — T10
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T18:00:00Z

---

## [repeated_fixture] Auxiliar de rota que levanta em status inesperado

**Regra que isto sugere:** montagem de cenário por rota de produção passa por um **auxiliar único** que recebe o status esperado e levanta com alvo, status e corpo na mensagem.

**O que ela faria (simples):** a T10 criou **quatro** auxiliares com a mesma estrutura, copiada — chama `pedir`, compara o status com um literal e levanta uma mensagem montada à mão. Já havia dois iguais no arquivo (`criarPor`, `transitar`). A repetição não quebra nada hoje, mas cada cópia é uma chance de alguém **esquecer a checagem** e o cenário seguir em silêncio com dado errado.

- Evidência: `lancarCobranca`, `pagarCobranca`, `cancelarCobranca` e `publicacaoDaCarteira` repetem a estrutura já presente em `criarPor` — `apps/api/test/contratos.e2e.spec.ts:4180` — T10
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T18:00:00Z

---
