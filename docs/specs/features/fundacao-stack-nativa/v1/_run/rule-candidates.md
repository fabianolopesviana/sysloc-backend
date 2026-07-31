# Rule candidates — fundacao-stack-nativa/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Asserção de contagem por grep em script de verificação

**Regra que isto sugere:** padronizar as asserções de "nenhuma ocorrência do padrão X no arquivo Y" num par de helpers do preâmbulo (ex.: `afirmar_sem_ocorrencia` e `afirmar_contem`), em vez de repetir a composição `grep -c ... || true` em cada chamada.

**O que ela faria (simples):** a mesma forma de asserção — embrulhar um `grep -c` (ou `grep -q && echo 1 || echo 0`) dentro de `afirmar_igual` com o `|| true` para não derrubar o `set -e` — foi reescrita à mão oito vezes num único script. Cada repetição é uma chance de esquecer o `|| true` (o que faria o script morrer em vez de reprovar o caso) ou de trocar `-c` por `-q` sem ajustar o valor esperado. Uma regra apontando os helpers evita que as sete fatias seguintes do programa reinventem a forma com variações sutis.

- Evidência: composição `afirmar_igual <rotulo> "0" "$(grep -c... || true)"` e sua variante `"$(grep -q... && echo 1 || echo 0)"` repetidas em 8 pontos do mesmo arquivo — `deploy/scripts/instalacao/verificar-workspace.sh:227` (e 271, 309, 382, 405, 469, 478, 482) — T1 / bateria de verificação do workspace em shell
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [repeated_assertion_shape] Contagem de membros do workspace pnpm

**Regra que isto sugere:** padronizar a asserção de composição do workspace num helper único que conte entradas de `pnpm -r list --depth -1` por expressão regular de linha `nome@versao /caminho`.

**O que ela faria (simples):** a mesma forma de asserção — contar linhas `nome@versao<espaços>/caminho` na saída de `pnpm -r list --depth -1` — foi reescrita quatro vezes no mesmo arquivo, cada uma com a sua cópia da expressão regular. Um helper único evita que uma das cópias envelheça quando o formato de saída do pnpm mudar e passe a contar errado em silêncio — o modo de falha mais perigoso aqui, porque a asserção continuaria verde contando 0 de 0.

- Evidência: expressão `^[^[:space:]]+@[^[:space:]]+[[:space:]]+/` (e a variante ancorada em `@sysloc/...`) replicada em 4 asserções — `deploy/scripts/instalacao/verificar-workspace.sh:378` (e 382, 479, 541) — T1 / bateria de verificação da fundação do monorepo
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [convention_drift] Narrativa de revisão em arquivo de produção

**Regra que isto sugere:** racional de decisão vive no arquivo que o aplica; narrativa retrospectiva de revisão (blocos `CAUSA-RAIZ`, identificadores de finding) vive na task — exceto em scripts de verificação, onde a doutrina de testes a exige.

**O que ela faria (simples):** o padrão `CAUSA-RAIZ` nasceu nos scripts de verificação, onde é bom e obrigatório — o racional de um teste impede que alguém o "conserte" enfraquecendo-o. Agora ele vazou para o `turbo.json`, um arquivo de configuração de produção, trazendo junto os identificadores de finding do gate (P1, P3) e o relato do que a tentativa anterior deixou passar. Sem regra que separe as duas coisas, cada rodada de gate deposita uma camada de arqueologia nos arquivos de configuração das 8 fatias do programa, e a informação duplica a task em vez de complementá-la. A regra manteria o "por que esta linha é assim" no arquivo e mandaria o "o que o revisor pegou" para a task.

- Evidência: blocos `CAUSA-RAIZ (P3)` e `CAUSA-RAIZ (P1)` com IDs de finding do gate dentro de `turbo.json:5` e `turbo.json:14`; padrão até então restrito a `verificar-golden.sh`, `verificar-captura.sh` e `verificar-workspace.sh` (scripts de verificação). Sweep confirmou ausência de cobertura em `.claude/rules/` e `docs/adr/` — T1 / raiz do monorepo
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-31

---

## [repeated_assertion_shape] Biblioteca de asserções dos verificadores de shell

**Regra que isto sugere:** extrair o bloco de asserções de shell (`caso`/`ok`/`falhar`/`afirmar_igual`/`afirmar_diferente`/`fechar_caso`, com contador de falhas e código de saída) para um arquivo compartilhado, e apontá-lo como a convenção de teste em shell do projeto.

**O que ela faria (simples):** o mesmo conjunto de funções de asserção já foi copiado, palavra por palavra, para três scripts verificadores diferentes, e cada cópia foi ganhando variações próprias — a mais nova acrescentou `aviso` e `nota`, que as anteriores não têm. Uma regra apontando um arquivo único evita que os relatórios de teste divirjam de formato entre si e poupa o próximo executor de reinventar a forma lendo um exemplar.

- Evidência: bloco `caso`/`ok`/`falhar`/`afirmar_igual`/`fechar_caso` replicado verbatim em três verificadores — `deploy/scripts/caracterizacao/verificar-golden.sh:41`, `deploy/scripts/instalacao/verificar-workspace.sh:68`, `deploy/scripts/instalacao/verificar-provisionamento.sh:135` — T2 / bateria de verificação do provisionamento
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [repeated_assertion_shape] Auditoria estática do script sob teste

**Regra que isto sugere:** padronizar um auxiliar único para asserção estática sobre o script sob teste, com **exigência de prova de falsificação** — aplicar a asserção a uma cópia com o guarda removido e exigir que ela reprove.

**O que ela faria (simples):** cinco asserções da bateria têm a mesma forma — contar ocorrências de uma expressão no texto do script e comparar com um literal — e foi justamente nessa forma que nasceu uma asserção que **não detecta o defeito que persegue**: ela permanecia verde mesmo com o guarda de segurança removido do arquivo, porque casava o texto `ALTER ROLE` que aparece em comentários e mensagens de erro. Uma regra que exigisse auxiliar comum e prova de falsificação teria pego isso antes do gate.

- Evidência: `grep -c` sobre `SCRIPT_PROVISIONAR` comparado a literal, em 5 pontos — `deploy/scripts/instalacao/verificar-provisionamento.sh:599` (e 608, 719, 751, 753) — T2 / bateria de verificação do provisionamento
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [repeated_fixture] Arquivo de ambiente sintético para sondar leitores

**Regra que isto sugere:** centralizar a construção do arquivo de ambiente sintético num auxiliar único, parametrizado pela credencial.

**O que ela faria (simples):** o mesmo arquivo de ambiente sintético é montado duas vezes por `printf`, com a cadeia de conexão repetida por extenso. Se o formato do `DATABASE_URL` mudar, as duas cópias precisam mudar juntas e nada avisa se uma ficar para trás — a sonda passaria a testar um formato que a produção não usa mais.

- Evidência: `printf 'DATABASE_URL=postgresql://...'` duplicado nas sondas (i) e (j) do CT-003 — `deploy/scripts/instalacao/verificar-provisionamento.sh:694` e `:708` — T2 / CT-003
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [repeated_fixture] Retrato de estado do sistema como fixture compartilhada

**Regra que isto sugere:** padronizar o retrato de estado (`${DIR_EVIDENCIA}/retrato-{pre,pos1,pos2}`) como a fixture única de qualquer bateria que prove idempotência ou não-degradação de ambiente.

**O que ela faria (simples):** o mesmo conjunto de retratos, capturado por um subcomando, é lido por três casos diferentes, cada um recompondo os caminhos à mão. Uma regra apontando a fixture e o seu contrato evitaria que um caso novo capturasse o próprio retrato e divergisse do que os outros comparam — foi o que quase aconteceu com o `retrato-pre`, que deliberadamente **não** pode ser recapturado sem destruir a prova de não-degradação do ambiente legado.

- Evidência: retratos `retrato-pre`/`retrato-pos1`/`retrato-pos2` recompostos manualmente em CT-001, CT-002 e CT-005 — `deploy/scripts/instalacao/verificar-provisionamento.sh:555` (e 556, 1014, 1015) — T2 / bateria de verificação do provisionamento
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [convention_drift] Segredo em script de shell trafega por stdin

**Regra que isto sugere:** em script de shell, segredo transita para processo filho apenas por entrada padrão ou arquivo 0600 (`PGPASSFILE`), nunca por argumento nem por variável de ambiente exportada.

**O que ela faria (simples):** a convenção existe e é seguida com rigor — o provisionador manda todo SQL com credencial por stdin e usa `PGPASSFILE`, e os dois auxiliares de varredura do verificador recebem a agulha por stdin — mas ela só está escrita em comentários dentro dos próprios arquivos, não em rule nenhuma. Resultado: o terceiro ponto de uso do mesmo verificador saiu do padrão e pôs a credencial viva no `argv` de um `grep`, legível em `/proc` por qualquer usuário local. Com a regra escrita, o executor não precisa reconstruir a razão a partir de comentários espalhados a cada novo ponto de uso.

- Evidência: `grep -cF "${credencial}"` no argv, contra o padrão stdin dos dois auxiliares irmãos do mesmo arquivo — `deploy/scripts/instalacao/verificar-provisionamento.sh:797` versus `:403` e `:431`, e o exemplar `preparar-site-efemero.sh` — T2 / provisionamento dos serviços de base
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-31

---

## [convention_drift] Constante espelhada exige asserção de espelho

**Regra que isto sugere:** todo verificador que espelha constante do artefato sob verificação prende **cada uma delas** por asserção contra o arquivo real — não apenas as que já tinham caso.

**O que ela faria (simples):** o verificador redeclara as constantes do script que ele verifica e carrega funções reais por `eval`, mas só 2 de 6 constantes têm asserção provando que o script real ainda declara o mesmo valor. As outras 4 tornam a tabela de coordenadas e a checagem de colisão de portas **herméticas** — testam o verificador contra si mesmo e não enxergam mudança no lado real. A regra tornaria executável a convenção que este arquivo já declara em comentário, evitando que os verificadores das 7 fatias seguintes envelheçam em silêncio.

- Evidência: o cabeçalho declara "cada caso que usa uma delas confere, como asserção, que o provisionamento continua declarando o mesmo valor"; cumprido para `PORTA_FILA` e `DIR_FILA_DADOS`, ausente para `PAPEL_DB`, `BANCO_DB`, `PORTA_SMTP_CAPTURADOR`, `PORTA_HTTP_CAPTURADOR`, `DIR_SOCKET_PG` e `ARQ_AMBIENTE` — `deploy/scripts/instalacao/verificar-provisionamento.sh:91` (e 105, 113, 1077) — T2 / bateria de verificação do provisionamento
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-31

---

## [repeated_assertion_shape] Tabela de coordenadas do ambiente sem helper

**Regra que isto sugere:** asserções em tabela sobre um mesmo SUT passam por um helper nomeado, como já ocorre com `sondar_os_dois_leitores`.

**O que ela faria (simples):** as sete entradas do bloco `(l)` repetem literalmente a mesma forma — monta o arquivo sintético, chama a sonda, compara o rótulo — enquanto o bloco `(i)`/`(j)`/`(k)` logo acima já consolidou esse mesmo padrão num helper. Um helper canônico evitaria que a próxima entrada da tabela nascesse por cópia e que uma delas divergisse em silêncio.

- Evidência: `afirmar_igual "<rótulo>" "<esperado>" "$(sonda_coordenadas_do_provisionador ...)"` repetido 7 vezes — `deploy/scripts/instalacao/verificar-provisionamento.sh:993` (e 997, 1001, 1005, 1009, 1013, 1034) — T2 / CT-003
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31

---

## [repeated_fixture] Preparo de logger com destino em arquivo temporário

**Regra que isto sugere:** centralizar o preparo do logger de teste com destino em arquivo num helper compartilhado da suíte.

**O que ela faria (simples):** o mesmo par de linhas que monta o caminho do arquivo e cria o logger foi reescrito em quatro casos; uma regra apontando o helper evita que cada caso novo escolha um nome de arquivo ou um nível diferente por conta própria, e concentra num lugar só a mudança quando a fábrica ganhar parâmetro.

- Evidência: setup `join(diretorio, 'eventos.log')` + `criarLogger({ nivel, destino })` repetido em 4 casos — `packages/shared/test/log.spec.ts:61` (também 87, 117, 211) — T3 / pacote compartilhado — registro estruturado
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-31T18:33:00Z

---

## [repeated_assertion_shape] Leitura e parse das linhas do destino de log

**Regra que isto sugere:** padronizar a leitura do destino de log como um helper que devolve os eventos já parseados.

**O que ela faria (simples):** ler o arquivo, filtrar linhas vazias, contar e parsear a primeira aparece com a mesma forma em quatro asserções; uma regra fixando o helper faz a mensagem de falha nascer uniforme e impede que um caso futuro esqueça de checar a contagem de linhas antes de parsear.

- Evidência: `linhasNaoVazias(await readFile(destino,'utf8'))` + `expect(linhas).toHaveLength(N)` + `JSON.parse(linhas[0])` em 4 asserções — `packages/shared/test/log.spec.ts:72` (também 97, 124, 223) — T3 / pacote compartilhado — registro estruturado
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-31T18:33:00Z

---

## [convention_drift] Dependência de ferramenta declarada por pacote

**Regra que isto sugere:** toda ferramenta invocada pelos scripts de um pacote do workspace é declarada nas devDependencies desse pacote, na versão exata da raiz.

**O que ela faria (simples):** o pacote roda `tsc` no `build` e no `test` e ainda resolve `typescript` em código, mas só a raiz declara a dependência — funciona por hoistagem, não por contrato. A regra evita que T4, T5 e T6 copiem o mesmo manifesto e herdem a dependência implícita.

- Evidência: scripts `build`/`test` executam `tsc` e `preparar-artefato.ts` resolve `typescript/package.json`, ausente das devDependencies do pacote e do importer no lockfile — `packages/shared/package.json:24` — T3 / primeiro pacote do monorepo
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-31T19:40:00Z

---

## [convention_drift] Lint é invocação única da raiz

**Regra que isto sugere:** lint no monorepo é uma única passada de Biome na raiz; pacotes não declaram script lint próprio.

**O que ela faria (simples):** o `turbo.json` declara uma tarefa `lint` que nenhum pacote implementa, então cada autor de pacote novo precisa adivinhar se deve criar o script. Escrever a decisão evita N invocações redundantes do mesmo binário e a divergência de flags que viria junto.

- Evidência: `turbo run lint` executa 0 tarefas; a cobertura real vem do `biome check .` da raiz, cujo includes já alcança `packages/**` — `turbo.json:55` — T3 / pacote compartilhado (molde para T4/T5/T6)
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-07-31T19:40:00Z

---
