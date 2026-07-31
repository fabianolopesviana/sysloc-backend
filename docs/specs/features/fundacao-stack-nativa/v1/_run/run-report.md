# Relatório do Run — fundacao-stack-nativa/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: 2/7 tasks concluídas · T1 verde em 62 asserções · T2 verde em 5/5 casos e 69 asserções, provada por 5 execuções assistidas no servidor real

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Fundação do monorepo — ferramental fixado e workspace construível | opus | 11 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Provisionamento dos serviços de base por script idempotente | opus | 2 criados, 2 mod | ✅ APROVADO | ⚠️ PARCIAL (P9 aceito como débito por decisão do usuário) |

**T3 a T7 pendentes.** Nenhuma bloqueada.

**Sobre o custo de T2**: cinco tentativas, com o limite de 3 estendido duas vezes por decisão do usuário. O Gate 1 rejeitou três vezes e o Gate 2, duas. Nenhuma rejeição foi trivial — as duas primeiras pegaram defeitos de segurança que teriam chegado a T7 (a senha do banco sendo rebaixada silenciosamente, e a credencial viva no `argv` de um processo filho), e as três últimas pegaram testes que não podiam falhar pelo defeito que perseguiam. T2 é a única task da fatia que altera o sistema operacional de um servidor que atende a operação hoje, e roda com `risk: high`.

**Modo de execução adaptado (T2)**: `sudo` neste host exige senha interativa e nenhum subagente consegue respondê-la. Por decisão do usuário, o executor escreveu os artefatos versionados e a execução privilegiada foi conduzida pelo orquestrador junto ao operador em sessão SSH própria, um comando por vez com validação. Os gates reportam `executou_testes: false` — isso reflete o papel deles, **não** suíte pulada. A bateria foi executada cinco vezes, com saídas literais preservadas.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado e por três decisões explícitas do usuário. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/fundacao-stack-nativa/v1/`.

### D1 · médio · project_pattern · T2 · Tech Review — **tem gatilho identificado; leia antes de T6/T7**
- **Onde:** `deploy/scripts/instalacao/verificar-provisionamento.sh:91` (e `:105`, `:113`, `:1077`)
- **Problema:** o verificador espelha 6 constantes de `provisionar-base.sh`, mas só 2 têm asserção provando que o script real ainda declara o mesmo valor. Faltam `PAPEL_DB`, `BANCO_DB`, `PORTA_SMTP_CAPTURADOR`, `PORTA_HTTP_CAPTURADOR`, `DIR_SOCKET_PG` e `ARQ_AMBIENTE`.
- **Impacto:** era inofensivo até a rodada 3, quando essas constantes só nomeavam alvos de inspeção do sistema real. A rodada 4 mudou a natureza delas: `carregar_funcoes_do_provisionador` faz `eval` apenas do **corpo das funções**, nunca das constantes — então a tabela `(l)` executa a função real com as constantes **do verificador**, contra um arquivo sintético montado a partir das **mesmas** constantes. Ficou hermética dos dois lados. A consequência mais cara está no `PORTAS_NOVAS=(6380 1025 8025)`, que alimenta o CT-005: a 6380 tem espelho, **1025 e 8025 são literais soltos**. Se T6/T7 mudarem `PORTA_SMTP_CAPTURADOR` para 1026 só no provisionador, a tabela `(l)` segue 7/7 verde e o CT-005 passa a provar ausência de colisão **na porta errada** — e o CT-005 é o caso que protege o guardrail mais caro da fatia, o servidor compartilhado com o sistema que atende a operação.
- **O que fazer:** acrescentar asserções de espelho na forma **já existente** nas linhas 1077/1079 — `afirmar_igual "(l) o provisionamento declara o mesmo papel" "1" "$(grep -cxF "readonly PAPEL_DB=\"${PAPEL_DB}\"" "${SCRIPT_PROVISIONAR}" || true)"` e equivalentes. Ou uma função `afirmar_constante_espelhada <nome> <valor>` chamada uma vez por constante, tornando executável a convenção que o cabeçalho já declara. **Falsificação:** mutante que altera `readonly PORTA_SMTP_CAPTURADOR` só em `provisionar-base.sh` deve reprovar — hoje passa 5/5.
- **Gatilho:** **fechar antes de T6 ou T7 alterarem qualquer porta do provisionador.**

### D2 · médio · security · T2 · Tech Review — **tem gatilho; depende de D3**
- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh:953-988`
- **Problema:** a instância de fila sobe sem `requirepass`, presa a 127.0.0.1 com `protected-mode yes`.
- **Impacto:** qualquer usuário local deste host — categoria que inclui o que a pilha CloudPanel/nginx/PHP voltada para a internet executa — fala com a fila do backend novo sem credencial. Como o Redis expõe `CONFIG SET dir`/`dbfilename` e `MODULE LOAD`, o alcance vai até escrita de arquivo arbitrário com a identidade do usuário `redis`. O Tech Review julgou **aceitável adiar, não aceitável deixar sem dono**: T2 não *degrada* a postura do host (o Redis do legado na 6379 já roda sem autenticação, então o caminho de escalação já existia) e na F0 a fila está vazia.
- **O que fazer:** ligar `requirepass` e gravar o segredo em `REDIS_URL`. **Pré-requisito: o D3 precisa estar fechado**, porque acrescentar o segredo exige que o P06 saiba evoluir um arquivo de ambiente já existente.
- **Gatilho:** **antes de T6 gravar o primeiro trabalho de negócio na fila.**

### D3 · baixo · testability · T2 · Tech Review — **tem gatilho**
- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh:852-866`
- **Problema:** o ramo de acréscimo de chave do P06 — a **única** escrita no arquivo que guarda a credencial viva, fora da criação — não tem asserção nenhuma, e a lista de chaves está triplicada (bloco de criação 917-920, laço 463, `case` 855-857).
- **Impacto:** trocar `>>` por `>` nas linhas 856-857 **destrói a credencial** — a única cópia — e nada reprova; a execução seguinte aborta instruindo o operador a "remover o original", que já não tem o segredo. Com a lista triplicada, quem acrescentar a 4ª chave em 463 sem acrescentá-la em 855-857 cai num ramo cuja instrução é exatamente "salve uma cópia, remova o original" sobre o arquivo da credencial de produção. Hoje o ramo está **dormente** no servidor (o arquivo tem as três chaves).
- **O que fazer:** colapsar a lista numa fonte única (`declare -A CHAVES_AMBIENTE=…` consumida pelos três pontos) e extrair a ação numa `acrescentar_chaves_ao_ambiente <arquivo> <chaves...>` parametrizada pelo caminho, no mesmo molde que tornou o predicado exercitável — com asserção que exija, após a chamada, a linha `DATABASE_URL` byte a byte idêntica e a chave nova com o valor esperado.
- **Gatilho:** **quando F1, F4 ou T6 acrescentarem chave ao `backend.env` — fechar antes do merge, não depois.**

### D4 · baixo · adr_compliance · T2 · Tech Review
- **Onde:** `docs/plano-backend-novo/plano-execucao.md:385` e `deploy/scripts/instalacao/verificar-provisionamento.sh:503`
- **Problema:** o item que arma o marcador `/etc/sysloc/producao` entrou no **gate de desinstalação** (passo 4 da §F7), um passo depois do momento em que a instalação vira produção (passo 3, a virada).
- **Impacto:** entre a virada e a desinstalação a instalação **já é** produção e o marcador ainda não existe por obrigação nenhuma — e é exatamente a janela em que alguém rodaria a bateria para "conferir que está tudo de pé depois da virada", reiniciando `redis-server@sysloc` (CT-004) e reexecutando o provisionamento (CT-002/CT-003). Ponto secundário: `instalacao_liberada_para_bateria` usa `[[ ! -e "$1" ]]`, e `-e` devolve falso para symlink pendurado — um marcador apontando para caminho inexistente **libera** a bateria.
- **O que fazer:** ao especificar `virada-e-desinstalacao/v1`, mover a **criação** do marcador para o checklist de virada (`deploy/scripts/virada.md`) e deixar no gate de desinstalação a **conferência** (`test -e`). Guarda de segurança deve falhar fechado: `[[ ! -e "$1" && ! -L "$1" ]]`.

### ~~D5 · baixo · adr_compliance · T2 · Tech Review~~ — ✅ **RESOLVIDO nesta sessão**
- **Era:** a ADR-0006 é *load-bearing* nesta task — razão de existir de todo o bloco `(f)` do CT-005, do guarda e do marcador — e não aparecia na rastreabilidade canônica de nenhum dos dois lados.
- **Resolvido em:** `tasks/T2.md` §6 passou a listar a ADR-0006 com a decisão concreta, os dois pontos em que ela alcança a task e o path; o `Applied in` da ADR ganhou duas entradas de `fundacao-stack-nativa (v1)` — a T2 (guarda + marcador) e a T4 (a materialização: instâncias efêmeras próprias). A reciprocidade que a `/agent-spec-adr-review` cobra está fechada nos dois sentidos.
- **Junto disso**, foi corrigida a nota 1 da §4: o `CLAUDE.md` listava a ADR-0006 entre as que morreram com o Frappe, contradizendo o `decisao-e-stack.md` §6.1 — que é o **item 1 da própria lista de leitura obrigatória** do `CLAUDE.md` e já a registrava como sobrevivente. Como o `CLAUDE.md` é carregado automaticamente em toda sessão e o `decisao-e-stack.md` só sob demanda, todo subagente começava com a informação errada. Corrigido, com o **critério que separa as duas categorias** (o substrato) registrado para a confusão não voltar.

### D6 · baixo · architecture · T2 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-provisionamento.sh` (`ler_credencial_db` e `carregar_funcoes_do_provisionador`)
- **Problema:** o caminho de leitura da credencial existe **duas vezes**, e a duplicação é **policiada** por `sed`+`eval` em vez de eliminada.
- **Impacto:** foi essa mudança que consertou o defeito da rodada 3, e o mecanismo funciona e falha alto. A objeção é de desenho: "quem valida e quem executa são o mesmo código" deveria ser propriedade **estrutural** (uma definição, um arquivo), não **rederivada** por extração textual a cada execução. O recorte depende da forma literal do fonte; o carregamento é parcial; há contrato implícito sobre nomes de globais; e a tabela precisa de duas linhas por cenário para policiar uma duplicação que não precisava existir.
- **O que fazer:** extrair `credencial_manuseavel`, `extrair_credencial_db` e `conferir_coordenadas_do_ambiente` — que já são puras — para `deploy/scripts/lib/credencial-ambiente.sh`, com `source` nos dois lados. Apagar `ler_credencial_db`, `carregar_funcoes_do_provisionador` e o desdobramento das tabelas em dois SUTs.

### D7 · baixo · architecture · T2 · Tech Review — **endereço definido: T5**
- **Onde:** `provisionar-base.sh:803` versus `.env.example:40`
- **Problema:** **duas** divergências com o `.env.example` de T1, não uma. O **esquema** (`postgres://` no exemplo × `postgresql://` no gerado) e a **forma** (`HOSPEDEIRO:PORTA` × socket de domínio Unix). Além disso o `SMTP_URL` existe no arquivo real e não no exemplo.
- **Impacto:** a do esquema é a mais afiada — `extrair_credencial_db` ancora em `^DATABASE_URL=postgresql://`, então um arquivo escrito seguindo **literalmente** o exemplo de T1 não é só inútil para conectar: é **rejeitado** pelo leitor do provisionamento.
- **O que fazer:** **não alterar o `.env.example`** (entregável de T1, aprovado). A reconciliação pertence à **T5**, que lê a configuração e passa a ter os dois lados do contrato na mão: validar esquema e forma na carga (Zod) e atualizar o `.env.example` como parte do seu escopo.

### D8 · baixo · architecture · T2 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-provisionamento.sh` (`main`)
- **Problema:** sete asserções de **texto-fonte** moram dentro da bateria **privilegiada**, cuja reexecução custa uma sessão SSH assistida com o operador.
- **Impacto:** um refactor puramente cosmético do provisionador — trocar `"$senha_db"` por `${senha_db}`, quebrar o `printf` do `ALTER ROLE` em duas linhas — reprova a bateria de aceitação, e descobrir isso exige montar uma sessão privilegiada. Falha alto e diagnosticável, então nunca fica verde em silêncio; o custo é operacional e recai sobre as fatias seguintes.
- **O que fazer:** acrescentar um terceiro modo ao despacho do `main`, ao lado do `retrato` que já existe: `lint`, sem privilégio, rodando só as asserções de texto-fonte. A bateria completa o invoca antes do CT-002, de modo que a cobertura fique idêntica. Vira o gancho natural para um gate de CI quando a F5 montar um.

### D9 · baixo · code_quality · T2 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-provisionamento.sh` (`ct_003`, 281 linhas; arquivo com 1388)
- **Problema:** `ct_003` acumula seis responsabilidades distintas, com três funções locais definidas e destruídas no meio do corpo.
- **Impacto:** nenhum em execução. Foi um dos fatores que fez a lacuna do D1 passar por dois gates — a tabela `(l)` está a 60 linhas das constantes que deveria prender. Como precedente replicado 7 vezes, o custo é multiplicado.
- **O que fazer:** **não refatorar agora** — o arquivo está provado por cinco execuções assistidas. Fixar o formato **antes da próxima fatia** escrever seu `verificar-*.sh`: quebrar cada bloco `(x)` numa função própria, com `ct_003` reduzido a orquestração. E extrair o esqueleto comum (asserções, `caso`/`fechar_caso`, `limpar`, contadores), hoje copiado entre quatro verificadores, para `deploy/scripts/lib/assercoes.sh`.

### D10 · baixo · data_handling · T2 · QA
- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh:468`
- **Problema:** espaço antes do `=` faz uma chave **divergente** ser lida como **ausente**, e a duplicata que o P06 acrescenta fica invisível ao guarda de ambiguidade.
- **Impacto:** dano limitado — o `EnvironmentFile=` do systemd descarta espaço à esquerda e resolve repetição pela **última** atribuição, que é a acrescentada e correta —, mas a linha obsoleta fica no arquivo, e o guarda cuja razão de existir é "o script trabalha com um valor e os serviços com outro" não a enxerga. Valor entre aspas é recusado embora o systemd aceite: recusa indevida, porém segura.
- **O que fazer:** `^[[:space:]]*REDIS_URL=` na extração e `^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=` na detecção de repetição, para que o script e o systemd enxerguem o mesmo conjunto de atribuições.

### D11 · baixo · code_quality · T1 · QA
- **Onde:** `deploy/scripts/instalacao/verificar-workspace.sh:470`
- **Problema:** as cinco variáveis de ambiente são literais em **quatro** lugares do script, sem fonte única.
- **Impacto:** se uma sexta variável entrar no `.env.example` e no `turbo.json` em T4/T5, o CT-003 continua verde (o array é piso, não espelho) e o cenário D não a cobre — a mesma classe de lacuna que o P1 do Gate 2 fechou, reaberta por outra porta. Hoje os quatro conjuntos coincidem.
- **O que fazer:** derivar as listas do cenário D de `VARIAVEIS_EXIGIDAS` por laço, com valor sintético por variável. A variável de controle permanece fora do array, por ser deliberadamente não declarada.

### D12 · baixo · project_pattern · T1 · Tech Review
- **Onde:** `turbo.json:5` e `turbo.json:14`
- **Problema:** o `turbo.json` carrega narrativa forense da revisão (blocos `CAUSA-RAIZ (P1)`/`(P3)`, identificadores de finding) dentro de um arquivo de configuração de produção.
- **Impacto:** nenhum risco técnico. A §6 da própria task declara que "esta task fixa o padrão para o programa inteiro" — se cada arquivo de configuração das 8 fatias acumular uma camada de arqueologia por rodada de gate, as configs ficam ilegíveis por volta da F5. Metade da prosa está no lugar certo: o racional de `build` não declarar as variáveis de conexão impede um dev futuro de "consertar" a omissão.
- **O que fazer:** reduzir os dois blocos ao racional prospectivo, removendo os IDs de finding e o relato do que a tentativa anterior não considerou. A narrativa completa já está na §5.6 do `T1.md`.

### D13 · baixo · code_quality · T1 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-workspace.sh:26` (e `:19`)
- **Problema:** o cabeçalho ficou desatualizado e **autocontraditório** depois que o CT-004 mudou para o clone efêmero — a linha 26 afirma que o caso cria arquivos "na raiz do repositório", na mesma frase que a cláusula "não altera nada fora do diretório temporário", que agora é a verdadeira.
- **Impacto:** o modelo mental errado é exatamente o que a correção existiu para desfazer, e este script é o precedente que `verificar-fundacao.sh` (T7) vai agregar.
- **O que fazer:** linha 26 — "na raiz do clone efêmero". Linha 19 — "(CT-001, CT-002 e CT-004)".

### D14 · baixo · documentation · T1 · QA
- **Onde:** `docs/specs/features/fundacao-stack-nativa/v1/tasks/T1.md:106` (e `:134`)
- **Problema:** as tabelas-índice §5.2 e §5.4 descrevem o CT-002 como parametrizado em 2 cenários, enquanto o card canônico da §5.6 declara 4.
- **Impacto:** inofensivo na prática (o card é a especificação canônica), mas o cenário D — a prova que fecha o achado do `turbo.json` — fica invisível para quem não descer até a §5.6.
- **O que fazer:** atualizar o rótulo nas duas tabelas para "(parametrizado, 4 cenários)" e cortar as colunas em fronteira de palavra.

### Débito residual abaixo do limiar de finding

- `verificar-workspace.sh:63` — `STATUS_INICIAL` no escopo de arquivo embora só usado dentro de `ct_004`; poderia ser `local`.
- `verificar-provisionamento.sh` — a detecção de "a `(f)5` falhou por motivo alheio ao guarda" depende **inteiramente** do companheiro positivo `(f)6`. Se alguém removê-lo, a `(f)5` sozinha volta a ser enganável.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada. T2 chegou a ser marcada `Bloqueado` ao esgotar as 3 tentativas, e o usuário estendeu o limite duas vezes; o bloqueio foi revertido e as dependentes (T4–T7) desbloqueadas.

## 4. Notas para Revisão Humana

**1. A ADR-0006 está viva — o `CLAUDE.md` errava; ✅ CORRIGIDO nesta sessão.** Decidido pelo Gate 2 em T1 e reforçado em T2. O `CLAUDE.md` lista "as ADRs 0002, 0003 e 0006 morreram com o Frappe", mas o `docs/adr/INDEX.md` a registra como `accepted` e os dois gates a trataram como viva nas duas tasks. O critério que separa é o substrato: a 0002 e a 0003 nomeiam primitivas do Frappe (DocType, fixture, DocPerm) e morrem com elas; a 0006 não nomeia mecanismo — a Decision é *"a suíte de verificação nunca executa contra o ambiente que atende a operação; qual ambiente concreto cumpre o papel varia ao longo do tempo — o invariante é a separação, não um servidor específico"*, e uma das alternativas rejeitadas **antecipa literalmente esta migração**. Matá-la deixaria esse invariante sem dono escrito justamente enquanto o Frappe segue de pé na mesma máquina até a F7, e justamente quando **T4 é a materialização dela**. **Feito: o `CLAUDE.md` foi corrigido e a ADR não foi supersedida** — superseder produziria uma ADR nova com a mesma decisão, que é churn. A linha 41 passou a listar a 0006 ao lado da 0001 entre as que sobrevivem inteiras, e o critério do substrato ficou registrado logo abaixo da tabela. Nota que vale para além desta ADR: o `CLAUDE.md` contradizia o `decisao-e-stack.md` §6.1, que é o item 1 da lista de leitura que o próprio `CLAUDE.md` define — e como ele é carregado automaticamente e o outro só sob demanda, a versão errada é a que chegava a todo subagente. Vale reler a tabela de leitura obrigatória procurando outras divergências do mesmo tipo.

**2. Risco carry-forward para T4 — um guarda estrutural foi removido e precisa voltar por construção.** Declarar `DATABASE_URL` e `REDIS_URL` em `test.env` do `turbo.json` (a correção do Gate 2 em T1) tem uma contrapartida: o Strict Environment Mode do Turborepo estava, por acidente, impedindo a suíte de enxergar a conexão operacional. Agora ela consegue. O modo de falha clássico em Vitest/Drizzle é um helper com `process.env.DATABASE_URL ?? subirEfemero()` ou um `drizzle.config` lendo a variável no import: antes isso explodiria alto; agora **conecta silenciosamente no banco que opera** — exatamente o maior raio de dano que a ADR-0006 existe para eliminar. **T4 deve fazer o helper de `embedded-postgres` ignorar `process.env.DATABASE_URL` por construção, com asserção própria**: um caso que exporte `DATABASE_URL` apontando para destino impossível e prove que a suíte subiu a instância efêmera assim mesmo.

**3. Segundo risco para T4 — faixa de portas.** T4 sobe instâncias efêmeras próprias e precisa de porta **fora** de `PORTAS_NOVAS` (6380, 1025, 8025). Nada em T2 reserva faixa, e uma efêmera em 6380 **sequestraria a fila provisionada**. Fixar a faixa na T4.

**4. Recomendação para T3.** O Gate 2 aprovou a adoção do `typescript` 7.0.2 depois de compilar e confirmar que `emitDecoratorMetadata` gera `__metadata("design:paramtypes", [Dep])` — a DI por tipo do NestJS sobrevive. O risco residual não é o compilador, é `tsup`/`rollup-plugin-dts` na geração de `.d.ts`, não exercitável hoje porque nenhum pacote existe. **T3 deve validar a geração de `.d.ts` como primeiro passo, antes de escrever conteúdo.** Recuo para `5.9.3` segue como saída.

**5. Recomendação para T7.** Duas: o CT-004 de T1 passou a depender do CT-001 (precisa do clone efêmero), então o `verificar-fundacao.sh` **deve preservar a ordem de invocação e não paralelizar** os casos; e o `verificar-provisionamento.sh` de T2 declara contrato de agregação no cabeçalho (sem argumentos, `RAIZ_REPO` derivado do próprio caminho, saída 0/1, invocação como subprocesso) que T7 deve honrar.

**6. Lacuna de convenção — ✅ RESOLVIDA nesta sessão.** Não existe `.claude/rules/testing-stack.md` formalizando a convenção de verificação em shell. O `verificar-provisionamento.sh` é o **terceiro** script a derivá-la do mesmo precedente aprovado, e cada cópia ganhou variações próprias. **Feito: `/agent-spec-testing-stack-bootstrap` executado, e a rule `.claude/rules/testing-stack.md` está gravada e staged.** Ela fixa as **duas frentes** (shell para infraestrutura, Vitest para código de aplicação) com o critério de placement entre elas, o vocabulário de asserção do shell derivado dos 4 verificadores, a rastreabilidade `CA-xx → CT-xxx (RN-xx)`, as quatro ADRs traduzidas ao grep certo, e a política de qualidade decidida pelo usuário: **sem cobertura**, **prova de falsificação obrigatória para asserção estática**, **sem retry em flaky**, **mutação por método manual**. O limite de tempo por sondagem também ficou normatizado (constante nomeada no topo, nunca `sleep` fixo).

Dois efeitos colaterais que valem mais que a rule em si: (a) ela registra que `pnpm test` não resolver hoje **não é defeito** — `apps/` e `packages/` estão vazios até T4 —, o que encerra as seis sinalizações de `discovery_needed` deste run; e (b) ela põe em contrato escrito a recomendação carry-forward da nota 2 (o helper de `embedded-postgres` ignorando `process.env.DATABASE_URL` por construção, com a prova positiva descrita), **antes** de T4 começar.

**7. O padrão que custou três rodadas de T2, e que vale virar regra.** Em ALTO-001, ALTO-002, MED-001, MED-002 e agora D1, o defeito foi sempre o mesmo: **o executor provou o que era fácil provar — o predicado, a posição no arquivo, o texto da mensagem — e deixou sem asserção o que era difícil: a combinação de entradas que discrimina, e o efeito terminal.** O código esteve correto em todas essas rodadas; o que falhava era a prova. Há nove candidatos a regra acumulados em `_run/rule-candidates.md`, e o mais valioso é o que exige **prova de falsificação** para asserção estática — aplicar cada asserção a uma cópia com o defeito reintroduzido e exigir que reprove. Se essa regra existisse antes de T2, teria poupado três das cinco rodadas.

**8. Consumo de disco.** O servidor saiu de 79% para 83% durante o run (6,1 → ~5,1 GiB livres). Origem legítima e esperada: toolchain do `mise` (565 MB), `node_modules` (137 MB), store do pnpm (171 MB) e os três serviços provisionados (~134 MB medidos pelo CT-005). Sem vazamento — nenhum clone efêmero, `node_modules` ou resguardo órfão sobrou. **Vale acompanhar**: T4 sobe instâncias efêmeras de banco a cada execução da suíte.

**9. Nada foi commitado.** T1 e T2 estão **staged** (14 arquivos, ~4.000 linhas). O `HEAD` segue em `540c6d9`. A decisão de quando agrupar num commit é sua.
