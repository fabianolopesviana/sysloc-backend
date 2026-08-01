# Relatório do Run — fundacao-stack-nativa/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: 4/7 tasks concluídas · **CA-14 fechada** (apuração privilegiada executada pelo operador em 2026-08-01: verificação 18.4 · operação 18.4, sem divergência) · T1 verde em 62 asserções · T2 verde em 5/5 casos e 69 asserções, provada por 5 execuções assistidas no servidor real · T3 verde em 66 casos de Vitest, com 4 vazamentos de segredo encontrados e fechados · T4 verde em 79 casos de Vitest e 76 asserções de shell

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Fundação do monorepo — ferramental fixado e workspace construível | opus | 11 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Provisionamento dos serviços de base por script idempotente | opus | 2 criados, 2 mod | ✅ APROVADO | ⚠️ PARCIAL (P9 aceito como débito por decisão do usuário) |
| T3 | Pacote compartilhado — contrato de erro e registro estruturado | opus | 11 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T4 | Infraestrutura de verificação — instâncias efêmeras e apuração de versão | opus | 9 criados, 6 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES |

**T5 a T7 pendentes.** Nenhuma bloqueada — T5 e T6 estão desbloqueadas.

**Sobre o custo de T4**: quatro rodadas, com o limite de 3 estendido uma vez. O Gate 1 rejeitou uma vez (1 crítico) e o Gate 2, duas. As três rejeições foram por classes diferentes, e a terceira é a mais instrutiva: **uma correção de severidade baixa que eu mandei aplicar virou um ALTO**. O guarda de alfabeto importou de `provisionar-base.sh` uma restrição cuja razão era outra — lá a credencial viaja dentro de uma URL, aqui vai para um arquivo de senha, e os dois formatos têm caracteres especiais diferentes. O resultado: o comando privilegiado que fecha o CA-14 abortava em **63,7% das execuções** (medido em 20.000 amostras), com uma mensagem que culpava o operador por uma credencial que o próprio helper gerou. Fechou por escape em vez de recusa, e a taxa foi a 0%.

**Sobre o custo de T3**: quatro rodadas, com o limite de 3 estendido uma vez por decisão do usuário. O Gate 1 rejeitou uma vez e o Gate 2, duas. **O mesmo vazamento de segredo foi redescoberto quatro vezes, por quatro portas diferentes** no mesmo arquivo — objeto com `toJSON`, herança da própria propriedade `toJSON` na cópia redigida, promoção de `err.message` para a chave de topo, e a posição raiz do evento. Cada rodada fechou o caminho apontado e a seguinte encontrou outro, porque a redação estava *instalada em pontos* em vez de ter *entrada única de despacho*. A rodada 4 atacou a estrutura, e o Gate 2 confirmou o fechamento **por topologia**, não por amostragem: pela API que `criarLogger` expõe, todo dado do chamador chega à linha por três escritas, e as três estão interceptadas. Nenhuma das três rejeições foi burocrática — todas pegaram vazamento real, provado por sonda contra o artefato compilado.

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

### ~~D15 · baixo · error_handling · T3 · Tech Review~~ — ✅ **RESOLVIDO na rodada 4**
- **Onde:** `packages/shared/src/log.ts:336-352`
- **Problema:** `redigirErro` descarta os sub-erros de `AggregateError` — a varredura usa `Object.keys`, e `AggregateError.errors` é própria **não-enumerável**.
- **Impacto:** diagnóstico, não segurança. `AggregateError` é o que `Promise.any` e conexões multi-host produzem; perder os sub-erros deixa o journal só com "agregado", contrariando o "mascarar não é apagar" que o arquivo repete três vezes. O serializador padrão do pino trata o caso; `redigirErro` o substitui de propósito. Baixo hoje porque a F0 não tem código que os produza.
- **O que fazer:** após a pilha, `if (Array.isArray((erro as AggregateError).errors)) { saida.erros = (erro as AggregateError).errors.map((e) => redigirValor(e, emVisita)); }`.

### D16 · baixo · project_pattern · T3 · Tech Review — **tem gatilho: antes de T4 começar**
- **Onde:** `.claude/rules/testing-stack.md`
- **Problema:** três afirmações da rule ficaram falsas por causa desta task — "a frente TypeScript está declarada e ainda não instalada", "nenhum pacote declara a tarefa `test`… o QA não deve reportar `discovery_needed` por causa disso" e "**Config**: `vitest.config.ts` na raiz do monorepo". Além disso, a correção do P3 previa registrar ali o padrão de `tsconfig.test.json` "para T4 herdar"; o código foi feito, o registro não.
- **Impacto:** a rule é fonte de verdade **consumida pelos gates**. O QA de T4/T5/T6 lê que a frente TypeScript não existe e que a config vive na raiz, e pode aceitar como esperado um pacote sem `tsconfig.test.json` — reabrindo exatamente o furo do P3 (nenhum teste sob verificação de tipos) num pacote novo.
- **O que fazer:** atualizar via `/agent-spec-testing-stack-bootstrap` — marcar a frente TypeScript como instalada a partir de T3, registrar `tsconfig.test.json` por pacote como padrão obrigatório, e substituir "config na raiz" pela regra de dois níveis (agregada na raiz a partir de T4 + preparação local por pacote quando ele compilar a si mesmo).

### D17 · baixo · project_pattern · T3 · Tech Review — **endereço definido: T4**
- **Onde:** `turbo.json` (tarefa `lint`) e `packages/shared/package.json`
- **Problema:** `turbo run lint` executa **0 tarefas** porque nenhum pacote declara script `lint`; toda a cobertura vem do `biome check .` da raiz.
- **Impacto:** nenhum funcional. O Gate 2 **decidiu o mérito**: o padrão do monorepo **não** deve exigir script `lint` por pacote — o Biome tem configuração única na raiz, sem override por pacote, e N invocações do mesmo binário sobre subconjuntos do mesmo conjunto seriam mais lentas e divergiriam em flags. O pacote está certo em não declarar. O resíduo é a **declaração órfã** herdada de T1, que sugere ao próximo autor de pacote que ele deve implementá-la.
- **O que fazer:** remover a tarefa `lint` do `turbo.json` e reduzir o script da raiz a `biome check .`; ou mantê-la com comentário registrando que existe para uma frente futura (o `turbo.json` já usa comentários com esse propósito). Pertence à T4, que revisita o ferramental da raiz.

### ~~D18 · baixo · tests · T3 · QA~~ — ✅ **RESOLVIDO na rodada 4** (texto livre e interpolação ganharam falsificador; o mutante M7 passou a reprovar 4 casos, contra 2 antes)
- **Onde:** `packages/shared/test/log.spec.ts:398`
- **Problema:** das três origens da mensagem que o cabeçalho declara cobrir — texto livre, interpolação e promoção de `erro.message` —, só a terceira tem falsificador. As três foram sondadas e de fato mascaram, mas a suíte só exercita a via da exceção.
- **Impacto:** as três convergem numa única linha nossa (`serializers[CHAVE_DA_MENSAGEM]`), o que limita o risco; mas a aplicação do serializador à mensagem **interpolada** é propriedade do pino, não nossa. Um bump que deixasse de aplicar serializador ao resultado do `format()` faria segredo interpolado voltar a sair cru com a suíte verde.
- **O que fazer:** acrescentar duas emissões sem exceção ao caso que já existe — `logger.info('conectado a ' + CADEIA_CRUA)` e `logger.info('conectado a %s', CADEIA_CRUA)` — asserindo que o conteúdo integral do arquivo não contém a sentinela.

### ~~D19 · baixo · code_quality · T3 · QA~~ — ✅ **RESOLVIDO na rodada 4** (helper `loggerEmArquivo`)
- **Onde:** `packages/shared/test/log.spec.ts:71` (e 97, 127, 250, 288, 323, 347, 365, 418, 449, 489)
- **Problema:** o par `const destino = join(diretorio, 'eventos.log'); const logger = criarLogger({ nivel: 'info', destino });` aparece literalmente em **11 casos**, com o mesmo nome de arquivo repetido em todos (AP-19, `magic_strings`).
- **Impacto:** inofensivo hoje — nenhum caso depende do nome. Mas trocar o destino ou o nível padrão obriga a editar onze lugares, e um ficar para trás não produz falha visível.
- **O que fazer:** extrair um helper local ao lado de `esvaziar`/`linhasNaoVazias` — `function loggerEmArquivo(nivel: NivelDeLog = 'info'): { logger: Logger; destino: string }` — e uma constante única para o nome do arquivo. Não abstrair além disso.

### D20 · baixo · security · T3 · Tech Review — **tem gatilho: T5, quando acrescentar contexto de processo**
- **Onde:** `packages/shared/src/log.ts:200` (bloco `formatters`) e a afirmação de `log.ts:29`
- **Problema:** existe uma **quarta escrita** no pino — `base` / `formatters.bindings` — que não atravessa `formatters.log` e portanto **contorna o redator**. Sonda do Gate 2 confirma: `pino({ base: { segredoDeBase: 'X' }, formatters: { log: … } })` emite `segredoDeBase` cru.
- **Impacto:** nenhum hoje — a porta é **inalcançável pela API atual**, porque `OpcoesDeLogger` expõe só `nivel` e `destino` e o objeto de opções é literal dentro de `criarLogger`. Está trancada **por omissão, não por construção**, e o cabeçalho afirma o absoluto "não há segunda porta a fechar depois" justamente para quem vai editar esta fábrica. O risco é de edição futura: T5 acrescenta `base: { servico, versao }` sem perceber que essa opção não passa pelo redator, e o próximo campo que alguém puser ali sai cru.
- **O que fazer:** uma linha fecha por construção — acrescentar `bindings: redigirRegistro` ao bloco `formatters`. É idempotente com o embrulho de `child` (reaplicar a redação sobre uma cópia já redigida não muda nada) e torna a afirmação de `log.ts:29` literalmente verdadeira em vez de condicionalmente verdadeira.
- **Gatilho:** **antes de T5 acrescentar qualquer campo a `base`.**

### D21 · baixo · code_quality · T3 · Tech Review
- **Onde:** `packages/shared/src/log.ts:104` (comentário) e `:56` (cabeçalho); asserções em `test/log.spec.ts:343,350`
- **Problema:** a chave de embrulho do valor avulso tem **duas formas** e o comentário nega uma colisão que existe. (a) `redigirValor` de uma visão de memória devolve `{tipo, bytes}`, que **é** objeto literal e portanto passa em `ehRegistroDeCampos` e é **espalhado no topo** em vez de embrulhado em `valor` — o pacote escreve cinco chaves (`nivel`, `mensagem`, `valor`, `tipo`, `bytes`), não três. (b) `logger.child({ valor: 'DO-FILHO' }).info(new Date(…))` emite **chave duplicada**, porque os vínculos entram por `asChindings`, que o pino concatena antes das chaves do evento. (c) Combinado: `logger.child({tipo, bytes}).info(buffer)` produz **duas** chaves duplicadas de uma vez, e `tipo` é nome de vínculo inteiramente plausível num código em pt-BR.
- **Impacto:** sem vazamento (ambos os lados passam pela redação) e sem perda de correlação (`idCorrelacao` nunca colide). O dano é perda silenciosa do vínculo do chamador por parsers de último-ganha, e um envelope com dois lugares para o mesmo conceito — herdado por T4/T5/T6, o que torna a mudança posterior uma quebra de formato para quem já consome o journal.
- **Causa-raiz** (nomeada pelo Gate 2): `ehRegistroDeCampos` classifica pela **forma da saída** (o protótipo do que o despacho devolveu), não pelo **ramo** que o despacho tomou — e o resumo de bytes é indistinguível de um registro de campos do chamador.
- **O que fazer:** fazer o resumo de visão de memória devolver **cadeia** (`` `${valor.constructor.name}(${valor.byteLength} bytes)` ``) em vez de objeto. O resumo deixa de passar em `ehRegistroDeCampos`, é embrulhado em `valor` como qualquer avulso, `tipo`/`bytes` somem do topo, e o contrato do envelope vira exatamente o que o cabeçalho já promete. Ajustar as duas asserções junto e corrigir `log.ts:104` para dizer o que sobra: a colisão residual é com um vínculo literalmente chamado `valor`.

### D22 · baixo · project_pattern · T3 · Tech Review — **puramente documental, custo de minutos**
- **Onde:** `docs/specs/features/fundacao-stack-nativa/v1/tasks/T3.md:190` e `:201`
- **Problema:** o card do CT-003 na §5.6 continua declarando o invariante **antigo** ("e todo valor do enum casa `^[A-Z][A-Z0-9_]*$`") e o companheiro negativo antigo, contradizendo a §6 nova e o teste entregue. A §6 foi acrescentada, a §5.6 não foi atualizada.
- **Impacto:** documental, mas no ponto exato que quatro rodadas discutiram. Quem reabrir a T3 lê um invariante que o teste não satisfaz — e é a incoerência que faz uma asserção deliberadamente reduzida **parecer** contorno de gate quando alguém reler daqui a três fatias.
- **O que fazer:** reescrever `:190` para "…e os quatro valores fixados casam `^[A-Z][A-Z0-9_]*$`; a grafia dos códigos de negócio que chegam em F4 é decisão de F4 (ver §6)" e ajustar `:201` para descrever o companheiro negativo que o teste de fato tem (valor fixado renomeado ou regrafado em minúsculo). Nenhuma mudança de código.

### D23 · baixo · code_quality · T3 · Tech Review — **endereço definido: cleanup de T5**
- **Onde:** `packages/shared/src/log.ts` (447 linhas)
- **Problema:** o arquivo carrega **duas responsabilidades separáveis** — a fábrica (opções, destino, ciclo de vida do filho, ~80 linhas) e o motor de redação (radicais, padrão de credencial, despacho por tipo, erro, ciclo; ~90 linhas de código e ~200 de prosa). Cerca de dois terços do arquivo é comentário, misturando dois gêneros: contrato de consumo (a fronteira do mascaramento, a convenção que T5 herda) e **arqueologia das quatro rodadas**.
- **Impacto:** custo de leitura, nenhum defeito funcional. O veredito do Gate 2 sobre a pergunta "virou colcha de retalhos?" foi explícito: **o código melhorou** (11 funções pequenas, `redigirValor` é escada linear de complexidade ~10) — *"ainda é coeso, mas está no limite"*. O que inchou foi a prosa, e o lugar da arqueologia é a mensagem de commit ou uma ADR, não o topo do módulo que toda fatia importa.
- **O que fazer:** extrair `packages/shared/src/redacao.ts` (não exportado por `index.ts`) com `redigirRegistro`, `redigirValor`, `redigirObjeto`, `redigirErro`, `ehRegistroDeCampos`, `ehChaveSensivel`, `mascararCredencial`, `mascararMensagem` e as constantes. `log.ts` fica com ~80 linhas. Ganhos: a redação passa a ter arquivo de teste próprio, exercitável sem montar logger e arquivo; a lista de radicais cresce sem tocar a fábrica; a arqueologia fica confinada onde é pertinente. **O próprio Gate 2 recomendou não fazer agora** se implicar mais uma rodada.

### D24 · baixo · error_handling · T4 · Tech Review
- **Onde:** `deploy/scripts/instalacao/apurar-versao-banco.sh:236-283` (`decompor_url`)
- **Problema:** a remoção do guarda de alfabeto (que era o defeito ALTO da rodada 3) deixou a **codificação-percentual** sem defesa nem diagnóstico. `decompor_url` nunca decodificou `%XX`, e o guarda barrava o `%` por efeito colateral. Sem ele, `postgresql://papel:p%3Ass@host:5432/banco` — a **forma canônica de URI** para expressar `:` numa senha, e o que `postgres.js`/libpq decodificam — atravessa como o literal `p%3Ass`, o servidor recusa a autenticação, e o `abortar` diz "confirme que a instância daquele endereço e porta está de pé".
- **Impacto:** é o diagnóstico que culpa o servidor por um defeito de configuração — exatamente o que o cabeçalho do arquivo declara existir para não produzir. A assimetria é o ponto: o procedimento hoje aceita `:` e `@` **crus** (fora do padrão de URI) e quebra em silêncio no `%` (dentro do padrão). **Sem alcance para T5/T6/T7 nem para o caminho privilegiado**: nem `provisionar-base.sh` (letras e números) nem `postgres-efemero.ts` (base64url) emitem `%`. O cenário é o arquivo de ambiente regravado à mão — que o próprio comentário do bloco de escape antecipa.
- **O que fazer:** decodificar `%XX` nos campos de credencial antes de escapá-los (`printf '%b' "${valor//%/\\x}"` com validação prévia de `^([^%]|%[0-9A-Fa-f]{2})*$`), mais um caso na tabela do CT-007 com credencial percent-encoded. Alternativa mais barata: guarda que recusa `%` **nomeando a codificação-percentual como causa** e o valor cru como forma aceita.

### Débito residual abaixo do limiar de finding

- `verificar-workspace.sh:63` — `STATUS_INICIAL` no escopo de arquivo embora só usado dentro de `ct_004`; poderia ser `local`.
- `verificar-provisionamento.sh` — a detecção de "a `(f)5` falhou por motivo alheio ao guarda" depende **inteiramente** do companheiro positivo `(f)6`. Se alguém removê-lo, a `(f)5` sozinha volta a ser enganável.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada. **Duas chegaram a ser marcadas `Bloqueado` ao esgotar as 3 tentativas** — T2 (limite estendido duas vezes, fechou em 5 rodadas) e T3 (estendido uma vez, fechou em 4) — e nos dois casos o bloqueio foi revertido por decisão do usuário e a task fechou nos dois gates. **Toda extensão concedida até agora pegou defeito real**, nenhuma foi burocracia.

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

**9. Estado do git.** T1 e T2 estão **commitadas** (`0ff5492` e `d967169`). **T3 está staged, não commitada** — 11 arquivos de `packages/shared/` mais o `pnpm-lock.yaml`, 1775 linhas. O `HEAD` segue em `e10488c`. A decisão de commitar é sua; **vale fazê-lo antes da T4**, porque a T4 modifica `packages/shared/package.json` e, sem o commit, o `base_sha` dela arrastaria a T3 inteira para dentro dos gates.

**10. O padrão de T3: o mesmo defeito redescoberto quatro vezes por quatro portas — e fechado na quinta por mudança estrutural.** Cada rodada fechou exatamente o caminho apontado e a seguinte encontrou outro — objeto com `toJSON`, herança da própria propriedade `toJSON` na cópia redigida, promoção de `err.message` para a chave de topo, posição raiz do evento. Vale registrar três coisas que isso ensina:

- **Corrigir o caso apontado não é corrigir a classe.** O executor acertou cada fix e mesmo assim o vazamento sobreviveu, porque a redação foi *instalada em pontos* em vez de ter *uma entrada única de despacho*. O Gate 2 nomeou isso na terceira passagem, depois de ler o caminho de escrita do pino inteiro e declarar a topologia fechada. **A rodada 4 atacou a estrutura e fechou** — o executor foi obrigado a escrever uma linha `POR QUE ISTO FECHA A CLASSE:` antes de editar, com a advertência de que, se não conseguisse escrevê-la com convicção, o fix ainda seria pontual. Essa exigência é barata e vale repetir sempre que um defeito reaparecer por caminho novo.
- **Os gates funcionaram, e não por sorte.** O QA achou o que encaminhou; o Gate 2 confirmou por sonda em vez de aceitar de palavra; o QA da rodada 2 achou a **causa-raiz** de por que o defeito atravessara os dois gates (a posição `objeto_de_erro` do CT-008 anexava o sentinela como propriedade da exceção, com mensagem inócua — o vetor nunca era exercitado); e o executor achou sozinho um corolário que nenhum gate tinha visto. Nenhuma das três rejeições foi burocrática.
- **A prova de falsificação pagou.** Foi ela que transformou "as duas linhas de `mascararCredencial` em `redigirErro`" de código-de-segurança-sem-rede em código-de-segurança-com-rede: o mutante que as removia mantinha a suíte 52/52 verde, e hoje reprova. É a mesma regra que a nota 7 já apontava como a mais valiosa do run.

**11. ✅ CA-14 FECHADA — a ação privilegiada foi executada.** Era a pendência mais importante deste relatório e está resolvida. O operador rodou a apuração com privilégio em 2026-08-01, e o `VERSAO-BANCO.md` agora traz `Operação (instância provisionada)`, com configuração lida de `/etc/sysloc/backend.env` e destino `/var/run/postgresql:5432`. **Verificação = 18.4 · operação = 18.4 (Ubuntu 18.4-1.pgdg24.04+1) → sem divergência.**

Três coisas que as quatro rodadas de gate compraram, e que só ficaram visíveis agora:

- **O destino confirmou o diagnóstico do QA.** O cluster atende em `/var/run/postgresql:5432` — **socket unix**, não TCP. Foi exatamente com esse fato que o QA provou, na rodada 1, que o valor originalmente registrado *não podia* ter vindo do cluster provisionado.
- **O texto derivado era derivado mesmo.** Depois do carimbo, `PENDENTE`, "Não trate esta apuração" e "indício favorável" caíram todos para **zero ocorrências**, sem ninguém editar o arquivo. É o que o QA previu ao simular o ramo privilegiado sem `sudo` na rodada 3 — e é o que impede o espelho do defeito original (um registro que dissesse "PENDENTE" depois de fechado).
- **A bateria mudou de estado sozinha.** `grep -cE 'CA-14.*EM ABERTO'` = 0, e o resumo final passou a dizer *"lado da operação carimbado com instância provisionada — CA-14 fechada"*. O sinal condicional que o Gate 2 exigiu no P1 funciona nos dois estados, não só num.

O andaime da execução (subir a efêmera pelo helper da suíte, gravar o `.env` 0600, chamar com privilégio, derrubar no `trap`) ficou no scratchpad da sessão de propósito — é ferramenta de operação, não entregável, e o repositório não deve carregá-lo.

**Nota para quem tocar `apurar-versao-banco.sh`**: o cabeçalho documenta `sudo -E`, mas a execução que funcionou usou `sudo env VAR=... bash ...`. A forma com `-E` depende de `setenv`/`env_keep` no sudoers e **não foi exercitada** — não afirmo que falha, apenas que a documentada não é a testada.

**12. Requisito que a T7 tem de cumprir — o Gate 2 pediu que ficasse registrado aqui.** A bateria `verificar-apuracao-versao.sh` sai `exit 0` **por desenho** mesmo com o CA-14 aberto, porque `aviso` não conta como falha. Então:

> T7 deve agregar `verificar-apuracao-versao.sh` **por texto**, não só pelo código de saída: não silenciar stdout nem stderr do filho, e tratar qualquer linha que case `grep -E 'CA-14.*EM ABERTO'` em **qualquer** dos dois canais como pendência de fatia que impede declará-la fechada.

O token `CA-14` + `EM ABERTO` é estável e casa as três emissões (o `aviso` da bateria, o do procedimento, e o bloco `ATENÇÃO` do resumo). A ressalva é emitida **nos dois canais de propósito**, o que fecha os quatro modos de agregação — só stdout, só stderr, fundidos, e código de saída, sendo este último o único que perde o sinal.

**13. Orientação de tamanho para T7.** O `ct_007` foi extraído em seis sub-funções nesta task e o Gate 2 registrou o teto: **oito pontas é o limite** — "uma nona pede um CT próprio, não mais uma sub-função". Vale para os verificadores que T7 vai escrever.

**14. `embedded-postgres` está fixado numa versão `-beta`** (`18.4.0-beta.17`), porque o pacote só publica betas. O Gate 2 julgou o risco aceitável — versão exata, lock com integridade por plataforma, alcance em devDependencies de um pacote, e superfície exercitada a cada execução por quatro CTs ("um beta que regrida quebra vermelho, não silencioso"). Mas registrou o gatilho: **a subida para o canal estável deve ser uma task deliberada, com reexecução da apuração de versão** — não um bump automático.

**15. Um achado de T3 que alcança a F4 e a F6.** O comentário do enum de códigos afirma continuidade com os símbolos que o cliente já trata (`sem_certificado_proprio`, `requer_decisao`, `sem_config_ativa`) — mas esses são **minúsculo-com-sublinhado**, e o enum nasceu `MAIÚSCULO_COM_SUBLINHADO` porque a §4 da T3 mandou. O `levantamento-frontend.md:466` lista `campo_invalido`, que é o mesmo código que aqui virou `CAMPO_INVALIDO`. Não é violação da ADR-0007 (o `Decision` fixa "enum fechado", não a grafia), mas a asserção de grafia em `erros.spec.ts:167` roda sobre o enum **inteiro** — então quem acrescentar os códigos do Sicoob em F4 escolhe entre quebrar o `switch` do cliente ou enfraquecer um teste de contrato. **A decisão de mapeamento precisa ser tomada antes de F4 publicar os códigos**, e o lugar natural do adaptador é a ADR-0001.
