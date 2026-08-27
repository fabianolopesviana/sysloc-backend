# Relatório do Run — publicacao-e-backup/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **11/11 tasks concluídas — FATIA FECHADA em 2026-08-26** · suíte TypeScript em **1987** · **14 baterias shell**, **111 casos declarados** (9 pacotes medidos um a um; era 1943 e 95 no início da fatia) · bateria do backup em **408 asserções / 24 casos** · bateria das unidades em **106 asserções / 8 casos** · bateria da notícia bancária em **187 asserções / 8 casos**

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Linha de base assistida | opus | 1 criado, 0 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |
| T2 | Cópia do banco e preservação de segredos | opus | 3 criados, 0 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Restauração em base vazia | opus | 1 criado, 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T4 | Unidades da cópia diária e roster | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T5 | Fecho da bateria e do `D9` | opus | 1 criado, 15 mod | ✅ APROVADO | ✅ APROVADO |
| T6 | Instalar o roster + bateria de unidades | opus | 2 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T7 | Origens públicas como lista (fecha `D23`) | opus | 1 criado, 14 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T8 | Eixo de origem (fecha `D27 · F1/T6`) | opus | 0 criados, 9 mod | ✅ APROVADO | ✅ APROVADO |
| T9 | Borda pública do app (fecha `D24` e `D39`) | opus | 3 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES¹ |
| T10 | Proteção da entrada de terceiro (fecha `D27 · F4/T11`) | opus | 0 criados, 7 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES |
| T11 | Fecho: comparação caso a caso e escrituração | opus | 1 criado, 4 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |

> A **T6 fechou em 2 rodadas**, e o Gate 2 devolveu **zero problemas** — o único bloqueante da rodada 1 (`TR-P1`, relógio lido no transitório) foi sanado atacando a **leitura**, nunca a asserção, e verificado por execução independente nos DOIS gates, cada um amostrando a virada do minuto. ⚠️ **A T6 tem TRÊS critérios `PARCIAL`, e os três são pendência de JANELA ASSISTIDA, não defeito** — ver a §4.
>
> A **T10 fechou em 2 rodadas.** O único bloqueante da rodada 1 é dos mais finos do run: a guarda do `CT-1194` desviava para `aviso` — e o caso fechava **verde, com desfecho 0** — o desfecho `chegadas > aceitas`, que com o teto funcionando é **fisicamente impossível**, porque o excedente recebe `503` e nunca alcança o serviço. Ou seja, **a única prova comportamental do teto podia ser silenciada pelo próprio defeito que ela existe para pegar.** Um segundo achado, anotável mas corrigido na mesma rodada, mostrou que o **valor** do teto não tinha âncora — e a falsificação, reproduzida por medição **independente** dos dois gates, rebaixou `limit_conn` para `1` e viu o `CT-1194` fechar **verde**. Detalhe na §4.
>
> A **T3 fechou na PRIMEIRA rodada**, nos dois gates. A T2 fechou em **6 rodadas** e 13 invocações de gate. Não houve desperdício: **8 bloqueantes** foram fechados, cada um com medição em caixa de areia, e **dois deles impediam a destruição das 17 cópias de produção do Frappe**. Detalhe na §4.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/publicacao-e-backup/v1/`.

### D1 · médio · documentation · T1 · QA — ✅ **RESOLVIDO em 2026-08-26, na T6**
- **Onde:** `_run/linha-de-base.md:349`
- **Problema:** critério T1(d) parcial — a Dúvida 4 (efeito da primeira passada das Rotinas) fica sem valor medido, marcada `PENDENTE-T6`.
- **Impacto:** três das quatro dúvidas têm valor na forma declarada e comando literal ao lado, reconferidas por medição independente do QA. A quarta não tem valor. **Não é adiamento disfarçado**: a dependência do `CT-1152` está registrada em três pontos, os dois comandos que produzirão o valor estão nomeados, e as cadeias que o `CT-1145` grepa para reprovar (`a definir`, `TBD`, `?`) têm contagem **zero**. A causa-raiz é **conflito interno da spec**: o Critério §1(d) exige as 4 medidas e a Obs do `CT-1145` proíbe medir a quarta antes do `CT-1152` (*"nunca antes"*).
- **RESOLUÇÃO:** o gatilho disparou na T6 (o `CT-1152` afirmou o destino do e-mail) e o valor foi substituído em `linha-de-base.md:349`: **`produziu efeito`** — 938 passadas em ~13h30, zero falhas, discriminadas por rotina. ⚠️ **E a premissa do próprio débito caiu por medição**: o comando estava escrito com `sudo`, mas o `journalctl` responde à identidade `sysloc` neste host — o orquestrador reproduziu (`EXIT=0`). A medição **não** dependia da janela assistida. Barreira do `CLAUDE.md` reconferida verde (276). **A T11 confere que a substituição aconteceu; ela aconteceu.**
- **O que fazer (histórico):** ⚠️ **NÃO corrigir na T1.** **Gatilho:** assim que o `CT-1152` (T6) afirmar o destino do e-mail, executar `sudo systemctl list-timers 'sysloc-*' --all --no-pager` e `sudo journalctl -u 'sysloc-rotina-*' --since '-1h' --no-pager` e substituir `PENDENTE-T6` pelo valor na forma declarada (`produziu efeito`/`não produziu efeito`, com a contagem observada). **A T11 (P5) deve conferir que a substituição aconteceu antes de comparar.**

### D2 · baixo · documentation · T1 · QA
- **Onde:** `tasks/T1.md:90`
- **Problema:** o enum de veredito do card do `CT-1140` tem 4 valores; o agregador emite **5**.
- **Impacto:** `rodar-baterias.sh` (186–190) produz `APROVADA`, `SAUDE-DA-SUITE`, `ESTOUROU O TEMPO` (124), `PRE-CONDICAO ausente` e `REPROVADA`. O card omite `ESTOUROU`. Risco latente **não realizado** (maior duração 759 s contra limite de 1800 s), mas nada agenda a correção: no dia em que uma bateria estourar, o `CT-1140` reprova por **valor legítimo do script**.
- **O que fazer:** acrescentar `ESTOUROU` ao enum do card (§5.2 e §5.6).

### D3 · médio · tests · T2 · QA
- **Onde:** `deploy/scripts/backup/verificar-backup.sh` (asserção da ADR-0006 no `CT-1098`)
- **Problema:** o rótulo promete mais do que a asserção prova — `afirmar_diferente` contra vazio afirma que `DATABASE_URL` **não é vazia**, não que aponta para o destino impossível declarado.
- **Impacto:** trocar o literal exportado por uma cadeia apontando para banco real deixaria a linha verde imprimindo *"a variável de conexão do ambiente aponta para destino impossível"*. O invariante segue provado pelo par de asserções de **conteúdo** logo acima (três tabelas, sete linhas semeadas) — o defeito é a asserção anexa. `smell: vague_existence_assertion`
- **O que fazer:** extrair o destino impossível para constante no topo, exportá-la a partir dela, e trocar por `afirmar_igual` contra a constante.

### D4 · médio · tests · T2 · QA
- **Onde:** `deploy/scripts/backup/verificar-backup.sh` (canal `residuo-temporario` do `CT-1104`)
- **Problema:** o quinto canal é varrido **vazio** — os alvos removem o próprio diretório temporário no `trap limpar EXIT`, e o arquivo do canal sai sempre com zero bytes.
- **Impacto:** a asserção *"a senha não aparece em canal nenhum"* é satisfeita **por vácuo** nesse canal, e o mesmo verde apareceria se os alvos ignorassem `TMPDIR` e escrevessem em `/tmp` — caso em que um resíduo com a credencial existiria **fora** do que a varredura olhou. `smell: vague_existence_assertion`
- **O que fazer:** amarrar o canal ao alvo — afirmar por igualdade que o temporário está vazio **depois** da execução, e capturar **durante** (por sondagem, no molde do `CT-1099`) que ele chegou a receber ao menos uma entrada.

### D5 · baixo · tests · T2 · QA
- **Onde:** `deploy/scripts/backup/verificar-backup.sh` (mutante do `CT-1105`)
- **Problema:** a prova de falsificação exercita **2 das 4** formas que a auditoria procura.
- **Impacto:** as formas `credencial-em-variavel-exportada` e `cadeia-de-conexao-com-segredo` nunca são demonstradas capazes de disparar. Se um dos dois padrões for quebrado numa edição futura, os `afirmar_igual "a auditoria não acha nada"` seguem verdes e o caso passa a aprovar um alvo com o defeito de volta. ⚠️ Medido: os dois padrões **funcionam hoje** — o que falta é a durabilidade da prova. `smell: happy_path_only`
- **O que fazer:** acrescentar as duas linhas ao mutante, montadas em pedaços pelo molde já usado, elevar as asserções para 4 achados, e incluir controle negativo com o marcador de documentação.

### D6 · baixo · code_quality · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/preservar-segredos.sh` (empacotamento, `tar … -T -`)
- **Problema:** o empacotamento passa nomes **por linha** (`-T -`) enquanto o laço irmão do mesmo arquivo usa `-print0`.
- **Impacto:** quebra em nome de arquivo com quebra de linha. A raiz dos segredos torna o caso improvável, mas a inconsistência é **interna ao próprio arquivo** e convida a próxima leitura a concluir que uma das duas formas é desnecessária.
- **O que fazer:** `find . -type f -printf '%P\0' | LC_ALL=C sort -z | tar --null … -T -`. A ordem estável se preserva com `sort -z`.

### D7 · baixo · code_quality · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/preservar-segredos.sh` (publicação da chave)
- **Problema:** o arquivo da chave é **sobrescrito** numa segunda execução do mesmo dia, e o cabeçalho afirma a propriedade oposta.
- **Impacto:** o cabeçalho argumenta que *"cada cópia da base foi produzida com o material cifrado pela chave vigente NA DATA dela"*. Uma rotação de chave seguida de nova execução no mesmo dia sobrescreve a chave preservada pela manhã, enquanto a cópia daquela manhã segue cifrada com a anterior. Janela estreita, rotação rara — o custo real é o cabeçalho afirmar mais do que o código sustenta.
- **O que fazer:** recusar sobrescrita quando o destino já existe com conteúdo diferente, ou acrescentar hora ao nome. Alternativa mínima: declarar o limite no bloco do cabeçalho.

### D8 · baixo · project_pattern · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/verificar-backup.sh` (cabeçalho)
- **Problema:** a bateria nasce como a **12ª cópia** do esqueleto que o `DÉBITO COM GATILHO — D9 · F0/T2` registra, **sem apontar para o débito que ela dispara**.
- **Impacto:** o gatilho literal do marcador (*"a próxima fatia que escrever um `verificar-*.sh`"*) **disparou** com esta bateria. Quem a abrir sem o `CLAUDE.md` na mão não tem como saber que a duplicação é conhecida, datada e endereçada. ⚠️ **O adiamento em si está correto e foi arbitrado pelos dois gates** — o `D9` fecha na **T5**, COM janela assistida, porque 8 das 12 cópias exigem privilégio e converter sem baseline violaria o P1/P5.
- **O que fazer:** uma linha no cabeçalho apontando para o `D9` e para a T5, no molde do aviso do Limiar de Três que o executor já escreveu em `copiar-base.sh`.

### D9 · baixo · error_handling · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/preservar-segredos.sh:493` (anotação `MAPA (19)`)
- **Problema:** a anotação declara **`set -e` alcança**, mas o `errexit` está **suspenso no corpo inteiro** de `medir_presenca_do_valor` — `main` a invoca como `if ! medir_presenca_do_valor …`, e o Bash suspende `errexit` **e o `trap ERR`** para o corpo inteiro de função chamada em condição ou sob inversão.
- **Impacto:** **medido pelos DOIS gates** com par controle/mutante: `/bin/false` no corpo sob `if !` não aborta, o script segue e termina em 0. **Exposição hoje é NULA** — o único comando `errexit`-dependente é um `head` sobre arquivo escrito com código 0 duas linhas acima, e a falha degrada para `abortar` (falha fechada). O dano é **diferido**: é a única função do script sem a rede do `set -e`, é a que materializa a etapa (2) da ADR-0032, e o próximo comando externo acrescentado ali herda desfecho que ninguém decide — **com a anotação dizendo que está coberto**. O `REVERTER EXIGE` do marcador enumera **quatro** formas que `set -e` não alcança e omite esta quinta.
- **O que fazer:** ⚠️ **saída (a), que NÃO toca o marcador e por isso não dispara a escalada da §3**: trocar o call site por captura de desfecho fora de condição — `local codigo=0; medir_presenca_do_valor … || codigo=$?; if [[ "${codigo}" -eq 1 ]]; then abortar …; fi`. Isso restaura `errexit` no corpo inteiro e torna a anotação verdadeira. A saída (b) — reclassificar o ponto e acrescentar a quinta forma ao `REVERTER EXIGE` — **edita texto sob `DECISÃO FECHADA` e exige escalada**; se for a escolhida, pague-a junto do **D10** na mesma passagem autorizada.

### D10 · baixo · code_quality · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/preservar-segredos.sh:102` (cabeçalho, sob `DECISÃO FECHADA`)
- **Problema:** duas divergências dentro do marcador. **(1)** a repartição declarada é **20/5/2/1**; a apuração das anotações em linha dá **18/7/2/1** — a diferença são os pontos (3) e (4), anotados como `CAPTURADO na forma degradada` e contados como alcançados por `set -e`, o que a própria definição da categoria exclui. **(2)** o `O QUÊ` declara a lista **EXAUSTIVA** e cinco invocações de `tr` ficaram sem número (linhas 373, 401, 428, 443, 488).
- **Impacto:** **nulo em execução** — as cinco `tr` são interpolação de diagnóstico dentro de `abortar`, cuja falha vira cadeia vazia num caminho que já está abortando. O total **28 está correto** e as anotações cobrem (1) a (28) sem furo. O custo é **de confiança**: quem confere a repartição encontra a diferença de 2 e passa a tratar o MAPA inteiro como aproximado — o oposto do que ele foi escrito para ser.
- **O que fazer:** corrigir a repartição para 18/7/2/1 e numerar as cinco `tr` como (29)–(33) na categoria (d), ajustando o total. ⚠️ **Edição sob `DECISÃO FECHADA` — exige a escalada da §3.** Pague junto do **D9** numa única passagem autorizada.

### D11 · baixo · testability · T2 · Tech Review
- **Onde:** `deploy/scripts/backup/verificar-backup.sh:1730` (docblock do `CT-1103 (c)`)
- **Problema:** a justificativa da ausência de perna própria para o ponto (10) apoia-se em premissa **mais forte do que o arranjo sustenta** — *"nenhum arranjo do sistema de arquivos faz uma falhar e a outra não"*.
- **Impacto:** as duas travessias são **separadas no tempo** (correm `mktemp -d`, `chmod 700` e um `mkdir -m 700` entre elas) e escrevem em **canais diferentes** — uma é substituição de comando sem escrita em disco, a outra redireciona para arquivo. Uma falha de escrita atinge a segunda e não a primeira. ⚠️ **É a mesma classe de premissa não medida que já caiu duas vezes nesta task** (`TR-P4` e `QA-MED-004`). A cobertura **positiva** existe e é forte (igualdade de conjunto do conteúdo do pacote); o que não tem discriminador é a **captura de desfecho** isolada, e ela é inalcançável na prática porque a guarda anterior recusa antes. `smell: happy_path_only`
- **O que fazer:** trocar a frase absoluta pelo que foi **medido** — que o mutante com apenas o ponto (10) revertido sai indistinguível **porque** a guarda anterior recusa antes, e que a discriminação é por enumeração da superfície mais a perna positiva. ⚠️ **Este docblock NÃO está sob `DECISÃO FECHADA`** — a correção não exige escalada.

### D12 · baixo · project_pattern · T3 · Tech Review
- **Onde:** `deploy/scripts/backup/restaurar-base.sh:178` (a prosa) e o símbolo em `:305`
- **Problema:** o **Limiar de Três disparou** e o débito ficou registrado **em prosa**, sem marcador `DÉBITO COM GATILHO` — e a declaração nomeia **dois** dos **três** símbolos que dispararam.
- **Impacto:** medido por três agentes de forma independente: `extrair_url_do_arquivo` e `decompor_url` têm **três** definições cada (`restaurar-base.sh`, `copiar-base.sh`, `apurar-versao-banco.sh`). ⚠️ **E o Gate 2 achou um terceiro símbolo que ninguém tinha nomeado**: `escapar_para_arquivo_de_senha`, também com três cópias — **byte-idênticas hoje** (conferido por `md5sum` do corpo extraído: `6d98705554…`), e é **a função que escapa CREDENCIAL** para o arquivo de senha. Três consequências: **(1)** `grep -rl --exclude-dir=dist 'DÉBITO COM GATILHO' apps packages deploy` **não enxerga** a prosa, logo não há linha para o índice do `CLAUDE.md`; **(2)** o gatilho declarado é *"a primeira task autorizada a abrir `copiar-base.sh` ou `apurar-versao-banco.sh`"* — **exatamente os dois arquivos onde a nota NÃO está**, que é o modo de falha que a §3-B existe para fechar; **(3)** ⚠️ **a premissa do Limiar já se confirmou empiricamente**: o Gate 2 mediu que `extrair_url_do_arquivo` **já divergiu** entre as três cópias — a nova trata o `grep` por **faixa**, as duas antigas usam `|| true`.
- **O que fazer:** emitir o marcador canônico junto de `extrair_url_do_arquivo` em `restaurar-base.sh`, com os quatro campos, **nomeando os TRÊS símbolos**, `QUANDO FECHA` = *"a primeira task autorizada a abrir `copiar-base.sh` ou `apurar-versao-banco.sh` por outra razão"* e `ÍNDICE` apontando para esta §2; **mais a linha no bloco "Débitos com gatilho ativo" do `CLAUDE.md`** — a §3-B exige **as duas pontas**. ⚠️ **A decisão de NÃO consolidar agora está correta e não deve ser revertida**: a subida arrasta dois consumidores e as duas baterias que auditam o texto deles, todos fora da §3.2 da task. ⚠️ **Cabe naturalmente à T11**, que faz a *"escrituração conferida nos dois sentidos"*.

### D13 · baixo · project_pattern · T3 · Tech Review
- **Onde:** `deploy/scripts/backup/restaurar-base.sh:51-61` (a prosa) e `recusar_destino_da_operacao` em `~:556`
- **Problema:** a divergência do idioma de guarda **casa o terceiro gatilho da §3** do Protocolo (*"a forma escolhida é menos óbvia que a alternativa idiomática, e você só a escolheu depois de descartar a óbvia por razão concreta"*), mas foi registrada como **prosa** em vez de marcador `DECISÃO FECHADA`.
- **Impacto:** risco **R3 — regressão de decisão**, o único que nem compilador, nem suíte, nem QA pegam. A tentação é concreta e nomeável: uma fatia futura que, vendo **quatro** guardas de recusa com nomes parecidos em `deploy/`, proponha **consolidá-las** — colapsando dois eixos (**máquina** vs **destino**) e dois sujeitos (**bateria** vs **script operacional**) que foram deliberadamente separados. O **P2 (arqueologia)** do protocolo manda o agente futuro *"procurar o marcador `DECISÃO FECHADA` no arquivo e ao redor do trecho"* — quem grepar a palavra **não acha nada**. Baixo hoje porque a prosa está no arquivo e é explícita; falta ser **encontrável pela busca que o protocolo manda fazer**.
- **O que fazer:** marcador canônico acima de `recusar_destino_da_operacao`, com o `REVERTER EXIGE` na forma falsificável sugerida pelo gate: *"provar que os dois idiomas coincidem em eixo (máquina vs base de destino), em sujeito (bateria de verificação vs script operacional) e em desfecho — e que a consolidação não torna `restaurar-base.sh` inútil na máquina de produção, que é o único lugar onde ele serve."* A prosa das linhas 51-61 permanece como a razão longa.

### D14 · baixo · tests · T3 · QA
- **Onde:** `deploy/scripts/backup/verificar-backup.sh:2127` (elenco do `CT-1104`)
- **Problema:** `restaurar-base.sh` entrou no elenco do `CT-1105` (auditoria **estática** de credencial em `argv`) mas **não** no do `CT-1104` (prova **comportamental** dos cinco canais de saída), e a assimetria **não é declarada em lugar nenhum**.
- **Impacto:** o terceiro script de produção que manipula a senha do banco não tem a **saída real** varrida. ⚠️ **Risco medido em ZERO nesta rodada**, e é por isso que é baixo: nenhuma das 16 interpolações de mensagem alcança a credencial; `destino_para_exibicao()` existe exatamente para não ecoar a grafia crua do parâmetro (que numa cadeia expandida traria credencial); as demais mensagens rodam **depois** da guarda, quando o destino já é comprovadamente nome simples; e o `trap ERR` com `${BASH_COMMAND}` foi **medido neste host** — o Bash não expande variáveis nesse valor. `smell: happy_path_only`
- **O que fazer:** incluir uma execução de `restaurar-base.sh` no `CT-1104` (contra a instância efêmera, com os cinco canais capturados e o mesmo controle positivo por igualdade de lista), **ou** declarar no docblock do `CT-1104` por que o elenco dele é 2 enquanto o do `CT-1105` é 3 — a assimetria precisa ser **decisão registrada**, não silêncio.

### D15 · baixo · architecture · T4 · Tech Review
- **Onde:** `deploy/systemd/sysloc-backup-da-base.service` (bloco *"As duas travessias, e por que a ordem é esta"*)
- **Problema:** falha do **expurgo** em `copiar-base.sh` suprime `preservar-segredos.sh` no mesmo dia, e **a consequência não está declarada**.
- **Impacto:** ⚠️ **É um cruzamento que nenhum outro agente tinha feito.** O cabeçalho declara num bloco que *"se (1) reprovar, (2) NÃO corre naquele dia"*, justificando pelo caso em que a **cópia** falhou. No bloco **seguinte** ele enumera que `copiar-base.sh` sai com `1` em **dois** desfechos — e o segundo é o **expurgo**, com a cópia do dia **publicada e íntegra**. **Os dois blocos nunca se cruzam.** Nesse desfecho a base está boa, não há razão para pular a preservação dos segredos, e ela é pulada. **Pior**: a causa típica do expurgo reprovar (disco cheio, destino ilegível) é **persistente**, de modo que o argumento compensatório do próprio cabeçalho — *"a preservação do dia seguinte os alcança"* — **não vale justamente no caso que dispara**. Enquanto o alerta não for atendido, `/opt/backups/sysloc/segredos` e `/opt/salvaguarda-da-chave` deixam de ser atualizados **todos os dias**, sem que nada nomeie o efeito.
- **O que fazer:** acrescentar ao bloco a linha que falta, nomeando o cruzamento: quando o desfecho de (1) for o do **expurgo**, a cópia está publicada e íntegra **e** a preservação daquele dia **não aconteceu**; e que, sendo a causa tipicamente persistente, a interrupção é **recorrente** até o atendimento. ⚠️ **O desacoplamento estrutural NÃO cabe aqui** — `copiar-base.sh` é fonte da T2 e carrega marcador `DECISÃO FECHADA`; a correção proporcional é a **declaração**.

### D16 · baixo · testability · T4 · Tech Review
- **Onde:** `packages/shared/test/unidades-agendadas.spec.ts` (comentário de `habilitaServiceIndevidamente`)
- **Problema:** o comentário afirma cobertura **estritamente superior** (*"nada do que era detectado deixou de ser"*), e há um caso estreito em que **não é**.
- **Impacto:** a substituição trocou o disjunto por grafia (`nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_SERVICO)`) por dois eixos derivados de **leitura de arquivo**. Um `sysloc-rotina-<x>.service` que aparecesse **apenas** em `UNIDADES_DO_ARRANQUE`, **sem arquivo versionado**, era pego pelo predicado antigo e **não é pego por nenhum dos dois novos** — nem por `excedentesNoInstalador`, que deriva do array `UNIDADES`, não do de arranque. Exposição praticamente nula (na variante realista `excedentesNoInstalador` pega; na restante `systemctl enable` recusa, com privilégio e um humano olhando). **O custo é de leitura** — o próximo agente lê a frase como garantia e não confere.
- **O que fazer:** acrescentar `|| (nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_SERVICO))` como **quarto disjunto**. Custa **uma linha**, torna a mudança **aditiva** em vez de substitutiva, e faz a frase passar a ser literalmente verdadeira. Alternativa: delimitar a frase ao conjunto realista.

### D17 · baixo · scope_deviation · T4 · Tech Review + QA
- **Onde:** `docs/specs/features/publicacao-e-backup/v1/tasks/T4.md` §3.2
- **Problema:** `packages/db/test/cobranca.spec.ts` foi alterado **fora da §3.2 declarada**.
- **Impacto:** ⚠️ **O achado é contra a SPEC, não contra a execução** — os **dois** gates foram explícitos. A conduta do executor é a **prescrita**: a `.claude/rules/ancoras-de-superficie.md` obriga a atualizar a âncora **no mesmo diff** da publicação, e a alternativa (publicar as duas unidades deixando a âncora vermelha) seria pior. `AP-24` foi examinado **com prioridade pelos dois gates e descartado**: a asserção segue por igualdade sobre a lista inteira, a falsificação `TIMER_FALSIFICADO` está intacta, nenhum caso saiu (`db` em **268**), e a linha `SUT_IS_CORRECT_BECAUSE` é substantiva. O custo é de **auditabilidade**: arquivo tocado fora do escopo declarado é indistinguível, na apuração automática, de toque não autorizado.
- **O que fazer:** acrescentar `packages/db/test/cobranca.spec.ts` à §3.2 com a justificativa em uma linha. Nas fatias seguintes, **derivar os arquivos-âncora por busca** (`grep -rl 'deploy/systemd' --include=*.spec.ts`) antes de a spec fechar. ⚠️ Virou **candidato a regra** (`RC-001`).

### D18 · médio · code_quality · T4 · QA
- **Onde:** `packages/shared/test/unidades-agendadas.spec.ts:1658`
- **Problema:** `CT-1114`/`CT-1115`/`CT-1117` **reproduzem literalmente as pernas de CONTROLE** que a mesma task acabou de acrescentar ao `CT-1060`.
- **Impacto:** três pares coincidem em ≥3 dos 4 campos da tupla, divergindo só no nome. O que é **próprio** de cada CT novo (os mutantes do backup, a asserção por valor do par, a positiva do arquivo de ambiente) **não é duplicata** — a duplicação está só nas **metades de controle**. Não bloqueia (`code_quality` é MÉDIO anotável, e parte da repetição é o controle antivácuo que a `ancoras-de-superficie.md` exige de cada falsificação). O custo: **o mesmo fato passou a ter quatro donos no mesmo arquivo** — mudar a superfície obriga a mexer em quatro lugares, e é assim que uma das cópias fica para trás. `smell: semantically_duplicated_test`
- **O que fazer:** deixar o controle da igualdade de conjunto com **um dono** (o `CT-1060`, que é a suíte canônica) e abrir os demais direto na contribuição própria; **ou** extrair um acessório `afirmarRosterIntegro(retrato)` chamado pelos quatro, dando ponto único de edição.

### D19 · baixo · tests · T4 · QA
- **Onde:** `deploy/systemd/sysloc-backup-da-base.service:168`
- **Problema:** prova de falsificação **avulsa** executada mutando o arquivo **versionado**, e não uma cópia.
- **Impacto:** a `.claude/rules/testing-stack.md` prescreve *"gere uma CÓPIA do arquivo sob teste com o defeito reintroduzido"*. Mutar o versionado deixa a árvore, **durante a janela da prova**, com uma unidade que despejaria `DATABASE_URL` e `CHAVE_DE_CIFRA_DO_CERTIFICADO` no `environ` de cada filho — exatamente o defeito que o `CT-1117` existe para impedir. ⚠️ **Árvore CONFIRMADA íntegra** pelo gate e por medição do orquestrador. **Mitigador**: a prova avulsa era **dispensável**, porque o `CT-1117` já carrega falsificação embutida sobre cópia em raiz temporária, que roda a cada execução. Achado de **conduta**, não de artefato.
- **O que fazer:** nada no artefato. Nas próximas provas sobre unidade systemd, usar `copiarUnidades(raiz, [{ unidade, mutar }])` ou copiar `deploy/systemd` para fora da árvore — foi assim que o gate refez a falsificação, sem tocar arquivo versionado.

### D20 · baixo · documentation · T5 · QA
- **Onde:** `deploy/scripts/verificacao/esqueleto-de-assercao.sh:44`
- **Problema:** o Limiar de Três disparou para `afirmar_contem` na **parcela unificável**, e o débito ficou sem marcador.
- **Impacto:** são 4 cópias. A justificativa do executor é **verdadeira mas cobre só metade**: a de `verificar-captura.sh` tem **outra assinatura** (grepa um **arquivo**). As outras **três** têm assinatura idêntica e corpos iguais exceto pela cauda da mensagem — e **duas são byte a byte idênticas** (`md5sum bb293b69…`). É o padrão que o `CLAUDE.md` nomeia: *a terceira cópia já nasceu divergente*.
- **O que fazer:** emitir `DÉBITO COM GATILHO` junto de `afirmar_contem`, com `QUANDO FECHA` = *"a primeira task autorizada a abrir `verificar-captura.sh`, ou o quarto consumidor do molde"*, mais a linha no índice do `CLAUDE.md`.

### D21 · baixo · documentation · T5 · QA
- **Onde:** `deploy/scripts/verificacao/rodar-baterias.sh:27`
- **Problema:** prosa vencida — cita o `D9` **no presente** e conta **dez** cópias que já não existem.
- **Impacto:** depois da T5 a frase está errada nas duas pontas: o `D9` está **fechado**, e as cópias são **uma só**. Arquivo **fora da §3.2**; não tocá-lo foi *menor delta* correto. É a classe de texto que o `CLAUDE.md` adverte que *"envelhece mais rápido que o débito que ela justifica"*.
- **O que fazer:** reescrever para o tempo passado e para o fato novo, removendo a contagem e a referência ao `D9` como débito vivo.

### D22 · baixo · documentation · T5 · QA
- **Onde:** `docs/specs/features/publicacao-e-backup/v1/tasks/T5.md`
- **Problema:** o `D9` foi fechado **antes** da janela assistida que o gatilho recomendava, e **as 3 baterias privilegiadas seguem sem execução pós-extração**.
- **Impacto:** ⚠️ **Registro de resíduo, NÃO objeção ao fecho** — os dois gates validaram o fecho. `verificar-fundacao`, `verificar-migracao` e `verificar-provisionamento` **abortam na guarda de privilégio antes de abrir qualquer caso**, então nenhum corpo delas foi exercitado depois da extração. O risco é **pequeno e bem cercado** (diff de IDs vazio nas onze, `bash -n` nas doze) e o Gate 2 acrescentou que **essas três são exatamente aquelas cujo dialeto a unificação ADOTOU** — mas não é zero.
- **O que fazer:** na janela assistida da **T11**, executar as três sob `sudo` e conferir código de saída e contagem contra a tabela `CASOS_DECLARADOS_POR_BATERIA`. **Não reabrir o débito nem repor o marcador.**

### D23 · baixo · code_quality · T5 · Tech Review
- **Onde:** `verificar-captura.sh:60`, `verificar-apuracao-versao.sh:113`, `verificar-fundacao.sh:237`, `verificar-backup.sh:457`
- **Problema:** a justificativa de `afirmar_contem` foi **replicada em quatro arquivos**, e em **três** deles afirma uma distinção que **não se aplica àquelas cópias**.
- **Impacto:** ⚠️ **É o mecanismo exato que criou o `D9`**: cada bateria nova nasce copiando a vizinha, e a vizinha carrega um comentário dizendo que a duplicação é legítima. O próximo agente que abrir `verificar-fundacao.sh` lê que aquela cópia é símbolo distinto — **não é** — e deixa de contar as cópias, que é o pressuposto do Limiar de Três.
- **O que fazer:** nos três de comparação de **string**, trocar a frase para dizer que **elas SÃO o mesmo símbolo** e que a unificação está **adiada** por causa do quarto homônimo. Manter o texto atual **apenas** em `verificar-captura.sh`.

### D24 · baixo · testability · T5 · Tech Review
- **Onde:** `deploy/scripts/backup/verificar-backup.sh` (`CT-1125`)
- **Problema:** a rede permanente do `D9` só reconhece a forma `nome()` na coluna 1, e o mutante do caso é escrito **exatamente nessa forma**.
- **Impacto:** escapam `nome ()` com espaço, `function nome {`, e a definição indentada. A falsificação demonstra que a asserção **pode** falhar, mas **não exercita a fronteira do reconhecimento**. Baixo hoje (as 12 usam a mesma forma); o risco é de prazo — **a bateria nº 13 que redeclarasse com um espaço reabriria o `D9` com o caso verde**.
- **O que fazer:** ampliar para `^[[:space:]]*(function[[:space:]]+)?<nome>[[:space:]]*\(\)` e acrescentar um **terceiro mutante** numa forma alternativa. Alternativa: `DÉBITO COM GATILHO` com gatilho *"a primeira bateria que declarar função fora do molde"*.

### D25 · baixo · documentation · T5 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:1637` (campo `POR QUÊ` do marcador)
- **Problema:** o marcador atribui `afirmar_diferente` ao `CT-602` e ao `CT-640`, que usam `afirmar_igual` — e **nesses dois a direção da falha é a OPOSTA** da descrita.
- **Impacto:** medido: só o `CT-701` usa `afirmar_diferente` (as seis). Nos outros dois a contaminação produz **falso NEGATIVO** (reprovar código íntegro), não falso positivo. ⚠️ O Gate 2 mediu que o **`REVERTER EXIGE` NÃO fica falsificável** por causa disso — a cláusula 2 é **agnóstica de direção** e permanece exata. A imprecisão é de **descrição do predicado**, não de alcance do contrato.
- **O que fazer:** reescrever a frase nomeando **as duas direções** e o predicado certo de cada uma.

### D26 · baixo · code_quality · T5 · Tech Review · **PRÉ-EXISTENTE, fora do escopo**
- **Onde:** `deploy/scripts/verificacao/rodar-baterias.sh:167`
- **Problema:** o agregador conta degradações com `grep -c '^    aviso'` — **minúsculo** —, enquanto **toda** bateria emite `    AVISO ` em **maiúsculo**.
- **Impacto:** ⚠️ **O quadro agregado reporta ZERO degradações SEMPRE.** A T5 **não introduziu** isso e **não tocou** o arquivo (não tocá-lo foi *menor delta* correto). Vale escriturar **junto do D21**, que é do mesmo arquivo e do mesmo tipo.
- **O que fazer:** trocar por `grep -c '^    AVISO'`, ou tornar a comparação insensível à caixa. **Pagar junto com o D21.**

### D27 · médio · project_pattern · T6 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` (a maquinaria de degradação)
- **Problema:** a maquinaria de degradação está em **duas cópias** e elas **já divergem**.
- **Impacto:** é o padrão que o Limiar de Três do `CLAUDE.md` descreve — com duas cópias, endurecer uma deixa a outra para trás. O executor **contou e declarou** a segunda cópia no próprio código.
- **O que fazer:** ao **terceiro** consumidor, subir a maquinaria para a casa comum (`deploy/scripts/verificacao/esqueleto-de-assercao.sh`), em vez de ganhar a terceira cópia.

### D28 · baixo · best_practices · T6 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` (`array_do_instalador`)
- **Problema:** o recorte do trecho de constantes do instalador não tem guarda de forma — se o instalador mudar de forma, o recorte pode sair vazio ou parcial sem nada acusar.
- **Impacto:** baixo hoje. O Gate 2 julgou que **a técnica é a certa** (a alternativa reimplementaria um interpretador de shell, que é exatamente o defeito que a task proíbe).
- **O que fazer:** acrescentar asserção de forma sobre o recorte antes de avaliá-lo.

### D29 · baixo · testability · T6 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` (a conferência de instalação em dia)
- **Problema:** os dois lados da comparação usam **moldes diferentes**.
- **Impacto:** baixo — a comparação funciona; o risco é de manutenção, ao evoluir um lado e não o outro.
- **O que fazer:** unificar o molde dos dois lados.

### D30 · baixo · security · T6 · Tech Review
- **Onde:** `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` (`ocorrencias_na_saida`)
- **Problema:** o valor procurado é passado no `argv` do `grep`, onde fica visível na tabela de processos durante a execução.
- **Impacto:** baixo e medido — a bateria roda sem privilégio, e o Gate 2 da rodada 2 confirmou que o trecho permanece **byte a byte** e que o `CT-1152` segue provando a ausência de vazamento **por medição da saída real** (ADR-0032).
- **O que fazer:** passar o valor por entrada padrão (`grep -f -`) em vez do `argv`.

### D31 · baixo · project_pattern · T6 · Tech Review
- **Onde:** `docs/specs/features/publicacao-e-backup/v1/_run/linha-de-base.md` (o bullet do comando da Dúvida 4)
- **Problema:** o texto do bullet ficou **vencido** com o fecho do `D1` — ele ainda descreve o comando com `sudo`, premissa que a medição derrubou.
- **Impacto:** é escrituração vencida, e a classe que este repositório documenta cinco vezes: número ou premissa narrativa que fica para trás convida a próxima task a "corrigir" para o valor errado.
- **O que fazer:** reescrever o bullet declarando que o `journalctl` responde à identidade `sysloc` neste host e que a medição **não** dependia da janela. A **T11** o alcança.

### D32 · baixo · documentation/code_quality · T6 · QA — ⚠️ **detalhe individual PERDIDO**
- **Onde:** `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` e `_run/convergencia-do-host.md`
- **Problema:** foram **quatro** baixos do Gate 1 na rodada 1 da T6 (categorias `documentation` e `code_quality`). O **detalhe individual de cada um se perdeu**: o JSON da rodada 1 vivia no contexto da sessão que foi interrompida na pausa de 2026-08-26, e o Ledger preservava apenas a linha agregada `QA-BAIXO-001..004`.
- **Impacto:** os quatro são anotáveis (nenhum bloqueia), e a rodada 2 passou pelos dois gates sem que nenhum deles fosse reaberto ou elevado. O que se perdeu é o **ponteiro**, não o código.
- **O que fazer:** ao rodar `/agent-spec-debt-resolution`, tratar este bloco como **varredura dirigida** dos dois arquivos em vez de correção pontual. ⚠️ **Registrado como perda declarada, não como omissão** — a alternativa era descartá-los em silêncio.

### D33 · baixo · error_handling · T7 · QA
- **Onde:** `apps/api/src/configuracao/ambiente.ts:247` (`EXIGENCIA_DAS_ORIGENS_PUBLICAS`)
- **Problema:** a exigência publicada na recusa **não nomeia o curinga**. `https://*.exemplo.com.br` — agora recusado — satisfaz **literalmente** as quatro cláusulas da mensagem (absoluto, https, servidor nomeado, sem caminho).
- **Impacto:** o operador que errar por curinga (o erro plausível: tentar liberar subdomínios) lê uma mensagem cujas exigências o valor dele cumpre, e fica sem caminho para corrigir. O `.env.example` repete a lacuna. **Não é falha de segurança** — a partida falha fechada e nomeia a variável.
- **O que fazer:** acrescentar "e sem curinga" ao texto, espelhando no `.env.example` e no `provisionar-base.sh`. ⚠️ **Não escreva `*`/`?` literalmente** sem antes conferir a asserção de não-eco do `CT-1161`.

### D34 · médio · code_quality · T7 · Tech Review
- **Onde:** `packages/auth/src/autenticacao.ts:523`, `apps/api/src/autenticacao/autenticacao.module.ts:51`, `apps/api/test/origem-publica.e2e.spec.ts:65`
- **Problema:** os três docblocks afirmam que o conjunto confiável é a **UNIÃO de DUAS** fontes. São **três** — a refutação está **duas linhas abaixo** do trecho do pacote que o executor citou como medição: `env.BETTER_AUTH_TRUSTED_ORIGINS`.
- **Impacto:** a prosa está no ponto exato onde a próxima decisão sobre a barreira de origem será tomada. Quem a lê conclui que o conjunto é fechado por duas fontes declaradas e **não procura a terceira** — que é o canal não conferido do `D35`. Não muda comportamento hoje; **desarma quem vier depois**. É R3.
- **O que fazer:** trocar por "UNIÃO de TRÊS fontes", nomeando a terceira e declarando que o produto nunca a emite. Se o `D35` for fechado, o texto passa a dizer que a terceira é recusada na partida — a forma que não envelhece.

### D35 · baixo · architecture · T7 · Tech Review (+ QA)
- **Onde:** `packages/auth/src/autenticacao.ts:525` (`criarAutenticacao`) e `apps/api/src/configuracao/ambiente.ts:305`
- **Problema:** a conferência do conjunto confiável está no **canal de configuração**, não na **fronteira de consumo**. Dois canais a contornam: (a) `BETTER_AUTH_TRUSTED_ORIGINS`, lida direto de `process.env` por `getTrustedOrigins` — um `=https://*` reinstalaria em silêncio o buraco que a T7 fechou; (b) a composição direta, já exercida por `packages/auth/test/identidade-efemera.ts:60`.
- **Impacto:** **baixo hoje, e a razão foi MEDIDA pelos dois gates**: quem escreve `BETTER_AUTH_TRUSTED_ORIGINS` no `EnvironmentFile` 0600 é o mesmo que escreve `BETTER_AUTH_SECRET`, que o produto consome (`ambiente.ts:1045`) — com ele forja sessão diretamente, logo **não há elevação de privilégio**. A variável não é mencionada em lugar nenhum do produto, então também não há caminho realista de erro de operador. O que existe é **uma propriedade declarada como fechada que não é**. ⚠️ O `CT-1166` já cobre o terceiro canal **em teste**, porque lê `ctx.context.trustedOrigins`, que é o retorno de `getTrustedOrigins` — é isso que torna este débito barato.
- **O que fazer:** (a) `criarAutenticacao` aplica o predicado sobre `opcoes.origensPublicas` e levanta na composição — fecha o canal (b); **ou** (b) recusar a partida quando `BETTER_AUTH_TRUSTED_ORIGINS` estiver presente. Fechar os dois torna verdadeira a prosa do `D34`.

### D36 · baixo · testability · T7 · Tech Review
- **Onde:** `apps/api/src/configuracao/ambiente.ts:235` (`CURINGAS_DO_PADRAO_DE_ORIGEM`)
- **Problema:** a constante replica um fato do pacote de terceiro (`pattern.includes('*') || pattern.includes('?')`) **sem âncora**. Um upgrade do `better-auth` que acrescentasse um terceiro caractere passaria em silêncio, e a barreira ficaria incompleta sem nada acusar.
- **Impacto:** baixo e futuro — só morde num upgrade. ⚠️ **Uma razão registrada para não ancorar foi REFUTADA por medição**: o Gate 2 mediu que `createRequire(...).resolve('better-auth')` a partir de `packages/auth` resolve **sem hash no fonte**, e o symlink é estável. O caminho estável existe.
- **O que fazer:** emitir `DÉBITO COM GATILHO` junto da constante (gatilho: o próximo upgrade do `better-auth`), **ou** fechar já com perna estática que resolve o pacote, lê `dist/auth/trusted-origins.mjs` e afirma que o predicado menciona exatamente os caracteres da constante — com controle positivo e falsificação.

### D37 · baixo · project_pattern · T7 · Tech Review
- **Onde:** `docs/specs/features/publicacao-e-backup/v1/tasks/T7.md` §3.2
- **Problema:** **seis** arquivos necessários à task ficaram fora da §3.2 — `vitest.config.ts`, `.env.example`, `provisionar-base.sh`, `verificar-provisionamento.sh`, `identidade-efemera.ts`, `admissao.spec.ts`. **Nenhum é desvio material** (os dois gates conferiram um a um), mas a `ancoras-de-superficie.md` §5.2 prescreve a declaração **prévia**.
- **Impacto:** nenhum em produção. O custo é de revisão: cada gate teve de reconstruir a justificativa dos seis, e a declaração prévia é o que separa "consequência necessária" de "aproveitei que estava aqui" sem depender do julgamento de quem revisa. **Causa-raiz de autoria da task**, não da implementação.
- **O que fazer:** nenhuma ação no código. Ao escrever task que introduz variável exigida na partida, declarar o conjunto canônico que ela sempre arrasta: `.env.example`, `provisionar-base.sh`, `verificar-provisionamento.sh` (âncora de contagem), `vitest.config.ts` e as fábricas de teste dos pacotes cuja assinatura muda.

### D38 · baixo · code_quality · T7 · QA
- **Onde:** `apps/api/test/origem-publica.e2e.spec.ts:274` (`cookiesDeSessao`)
- **Problema:** o predicado do cookie de sessão foi **copiado** em vez de importado — é a ~30ª cópia, já em **três formas divergentes**, e a casa comum (`apps/api/test/acessorios-de-borda.ts:278`) já o tem embutido.
- **Impacto:** o modo de falha que o Limiar de Três existe para evitar — endurecer uma cópia deixa as outras para trás. A necessidade nova é legítima (o caso negativo precisa da **lista**, possivelmente vazia; `credencialDeSessao` devolve uma credencial).
- **O que fazer:** publicar `ehCookieDeSessao` em `acessorios-de-borda.ts` e fazer `credencialDeSessao` consumi-lo. ⚠️ **Deliberadamente NÃO feito na T7**, com razão registrada no docblock: tocar a casa comum obrigaria a remedir ~30 suítes para provar que nenhuma asserção se moveu, o que excede uma rodada de correção. **Gatilho: a primeira task autorizada a abrir `acessorios-de-borda.ts` por outra razão.**

### D39 · baixo · security · T8 · Tech Review — ✅ **FECHADO na T9 (2026-08-26)**
- **Onde:** `packages/auth/src/autenticacao.ts` (junto de `SALTOS_CONFIAVEIS`)
- **Problema:** a segurança do eixo de origem depende de **toda** borda que alcance `/v1/auth/*` e `POST /v1/sessao/senha` **apensar** o endereço real (`$proxy_add_x_forwarded_for`), nunca repassar o `X-Forwarded-For` do cliente. Na rodada 1 essa invariante estava escrita como **afirmação em prosa sobre um arquivo que ainda não existe** (`deploy/nginx/sysloc-app.conf`, que nasce na T9).
- **Impacto:** ⚠️ **silencioso e com aparência de correção** — a suíte fica verde nos dois regimes, porque nenhum caso alcança configuração de nginx. Uma borda que repasse o cabeçalho do cliente devolve ao atacante o controle do eixo, e o efeito é **pior que o estado anterior ao fecho**: antes a cadeia resolvia para `null` e todos caíam num balde único **não evadível**; com o salto declarado e a borda errada, o atacante **escolhe o próprio balde** e o limitador deixa de limitar. É literalmente o `Con` que a **ADR-0037** nomeia.
- **O que fazer:** ⚠️ **O gatilho é a T9**, ao criar `deploy/nginx/sysloc-app.conf` — e toda borda posterior que publique caminho da API. Conferir que o vhost novo **apensa** e não repassa. **As duas bordas vivas foram medidas conformes** e permanecem: `/opt/web/syslocadmin/nginx/default.conf:98` e `deploy/nginx/sysloc-notificacao-bancaria.conf:152`, ambas com `$proxy_add_x_forwarded_for`. A prova mais forte é a do Gate 2, por medição ao vivo: `GET /_borda/eco` com e sem `X-Forwarded-For: 203.0.113.99` forjado devolveu o `ip-do-cliente` **idêntico**.

### D40 · baixo · project_pattern · T9 · executor — ⚠️ **DÉBITO COM GATILHO ATIVO**
- **Onde:** `deploy/scripts/borda/verificar-borda-do-app.sh` (junto de `subir_borda_efemera`)
- **Problema:** o acessório de **borda efêmera** — certificado gerado no arranjo, porta livre, serviço de trilha atrás, guarda de isolamento do `listen` e `nginx` em prefixo descartável — nasce na T9 como **segunda cópia**; a primeira é `deploy/scripts/borda/verificar-notificacao-bancaria.sh`.
- **Impacto:** o modo de falha que o Limiar de Três existe para evitar — endurecer uma cópia deixa a outra para trás. Hoje são **duas**, e o gatilho do `CLAUDE.md` dispara na terceira.
- **O que fazer:** extrair `deploy/scripts/borda/acessorios-de-borda.sh` e fazer as duas baterias o consumirem por `source`, no molde de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`. ⚠️ **Deliberadamente NÃO feito na T9**: extrair exige mover ~200 linhas de arranjo de rede entre duas baterias, uma delas verde em **148 asserções** e sem relação com o que a rodada corrigia — o risco de regressão supera o da segunda cópia.
- **⚠️ GATILHO EMENDADO em 2026-08-26 (rodada 3 do Gate 2), e o texto anterior fica registrado.** Ele dizia *"a terceira borda pública, ou a primeira task autorizada a abrir `verificar-notificacao-bancaria.sh` **por outra razão**"* — e essa redação **disparou literalmente na mesma rodada**: a correção do `P2` do Tech Review autorizou abrir aquela bateria para subir `carregar_funcao_do_instalador` à casa comum. Disparou, porém, **pela razão errada**: a autorização era para outro símbolo, em outro arquivo, com outro risco. Fechar o `D40` de carona significaria mover a borda efêmera inteira de duas baterias **dentro de um ciclo de correção de gate** — a *"correção grande com regressão embutida"* que a §5 de `.claude/rules/nao-regressao.md` proíbe. É a terceira ocorrência medida do corolário do `CLAUDE.md`: *a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica*. **Gatilho vigente: a terceira borda pública, ou a primeira task autorizada a abrir `verificar-notificacao-bancaria.sh` PARA MEXER NO ACESSÓRIO DE BORDA EFÊMERA.**
- **⚠️ GATILHO EMENDADO DE NOVO em 2026-08-26 (rodada 2 do Gate 1 da T10), e os DOIS textos anteriores ficam registrados.** Ele **disparou, agora pela razão certa**: a T10 mexeu **no acessório de borda efêmera** da outra bateria — `subir_borda_efemera` de `verificar-notificacao-bancaria.sh` ganhou `ARQUIVO_DE_ESPERA` e `ARQUIVO_DE_LIBERACAO`, e o heredoc `servico.mjs` foi reescrito com o modo de espera e dois argumentos novos —, e o `servico.mjs` é item **nominal** do enunciado acima (*"serviço de trilha atrás"*), medido presente nas **duas** baterias. **Ele NÃO foi fechado**, e a razão é medida: os dois serviços de trilha **já divergiram** (só o da notícia tem o modo de espera, que não tem contraparte na borda sem `limit_conn`), e a extração continua sendo mover ~200 linhas de arranjo de rede **dentro de um ciclo de correção de gate** — o mesmo `POR QUE NÃO AGORA` de sempre, agora com **segunda ocorrência escriturada**. **Gatilho vigente: inalterado.** A próxima task que abrir o acessório herda o débito com **dois disparos registrados**, e não redecide do zero.
- **O que NÃO se confunde com ele:** o `carregar_funcao_do_instalador` era outro débito e **foi fechado** nesta rodada — eram **três** declarações locais em duas baterias, elas **já haviam divergido** (o `sed` ingênuo cortava ao meio uma função com heredoc), e a casa comum já era carregada pelas duas. Ali o Limiar de Três disparou de fato; aqui continuam sendo **duas** cópias.

### D41 · médio · tests · T9 · QA — ⚠️ **DÉBITO COM GATILHO ATIVO**
- **Onde:** `deploy/scripts/borda/verificar-borda-do-app.sh` (junto de `DESTINO_DECLARADO_DO_EMAIL`)
- **Problema:** o `CT-1189` e o `CT-1152` afirmam a **mesma chave** `SMTP_URL` com valores **inconciliáveis** — este declara `smtp.systera.com.br:587` (o destino real, decisão operacional do usuário) e o `CT-1152` de `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` declara o **laço local**, porta 1025 (o que impede envio real a partir de dados de ensaio). Não existe valor que satisfaça os dois. O ponteiro entre eles é de **mão única**: quem abre a bateria da borda é avisado; quem abre a das unidades agendadas, não.
- **Impacto:** quem fizer a troca do destino move **uma** ponta e a outra reprova sem que o texto daquele lado explique por quê. ⚠️ **A constante do `CT-1189` NÃO cede** — rebaixá-la para o endereço do capturador é o que a §5.6 do caso nomeia como **fraude de gate**.
- **O que fazer:** ao trocar o `SMTP_URL` para o destino real, mover **as duas** asserções no mesmo movimento e acrescentar o ponteiro recíproco em `verificar-unidades-agendadas.sh`. ⚠️ **Deliberadamente NÃO feito na T9**: aquela bateria está **fora da lista de arquivos declarada** da task (§3) e a asserção do `CT-1152` foi aprovada antes e não se altera. **Gatilho: a troca do `SMTP_URL` para o destino real.**

### D42 · médio · architecture · T9 · Tech Review — ⚠️ **CONVERGIDO na rodada 3**
- **Onde:** `deploy/scripts/borda/instalar-borda-do-app.sh:400-407` (`publicar_atomicamente`)
- **Problema:** a publicação atômica **não limpa o vizinho `.novo` no caminho de saída anormal**, e a janela fica **fora do desfazimento** — `ESCRITA_PENDENTE` só é ligada **depois** de `posicionar_vhost` retornar, de modo que uma interrupção entre o `install` e o `mv` deixa `limpar` sem o vizinho. **Reproduzido em caixa de areia.**
- **Impacto:** ⚠️ **medido e estreito.** Sob o layout **padrão deste produto** (`include .../*.conf`) o resto é **inerte** — `*.conf` não casa `.conf.novo`. Só o layout Debian (`include ... *;`), que exige sobrescrever `SYSLOC_DIR_DOS_VHOSTS`, o carrega — e aí é vhost completo e válido com `server_name` duplicado. *"Não há indisponibilidade nem impacto de segurança, e o layout padrão deste produto não é alcançado."*
- **O que fazer:** `install ... || { rm -f "${vizinho}"; return 1; }` e estender a janela de `ESCRITA_PENDENTE` para **antes** da chamada (ou registrar o vizinho numa variável que `limpar` consulte — o mesmo mecanismo de estado que a função já usa). Acrescentar ao `CT-1188 (b)` a perna do **caminho anormal**: hoje as duas asserções cobrem só o caminho feliz.

### D43 · médio · testability · T9 · Tech Review — ⚠️ **CONVERGIDO na rodada 3**
- **Onde:** `deploy/scripts/backup/verificar-backup.sh:279-288` (`SIMBOLOS_DO_ESQUELETO`, auditado pelo `CT-1125`)
- **Problema:** os **três símbolos promovidos** à casa comum na rodada 3 (`texto_da_funcao_do_instalador`, `carregar_funcao_do_instalador`, `carregar_funcao_do_instalador_como`) ficam **fora** da lista que o `CT-1125` audita. ⚠️ **A exclusão em si está CERTA** — o que aquele caso afirma é a **identidade** daquela lista com as sete linhas da `testing-stack.md`, e misturá-los a quebraria. O que falta é a **consequência**.
- **Impacto:** **nada reprova se uma bateria futura redeclarar um dos três localmente** — que é **exatamente a classe que a T9 acabou de fechar**, e cujo custo de reabertura já foi medido uma vez nesta fatia. É o P4 do Protocolo sem cumprimento: correção de defeito medido sem rede que o pegue de volta.
- **O que fazer:** segunda lista à parte (`SIMBOLOS_AUXILIARES_DO_ESQUELETO`), passada ao helper `definicoes_do_simbolo_em`, que **já recebe o símbolo por parâmetro e já tem o escopo certo**. O laço de asserção do `CT-1125` é reusável como está, e a identidade da lista original permanece intacta.

### D44 · baixo · testability · T9 · Tech Review
- **Onde:** `deploy/scripts/borda/verificar-borda-do-app.sh:519-522` (`auditar_selecao_de_location`)
- **Problema:** a perna de sombreamento avalia regex do nginx (**PCRE**) com o `=~` do bash (**ERE**). ⚠️ **Falso negativo MEDIDO pelo Gate 2**: o mutante `location ~ ^/v\d/`, que sombrearia a API **inteira**, faz a auditoria devolver `0` e nenhum achado — o bash lê `\d` como literal.
- **Impacto:** **segundo nível de uma defesa em profundidade cujo primeiro nível está íntegro** — a asserção irmã fixa o **conjunto** de regex por igualdade e pegou o mutante. Mas essa defesa **cai no fluxo normal de manutenção**, quando quem acrescenta uma regex legítima atualiza a igualdade junto. Exige a conjunção de quatro condições, por isso baixo.
- **O que fazer:** (a) avaliar com `grep -P` quando disponível, **degradando com `aviso` nomeado** — nunca aprovando em silêncio; ou (b) declarar no docblock que a perna é **secundária** e que a garantia primária é a igualdade de conjunto. Hoje o docblock apresenta as duas como equivalentes.

### D45 · baixo · project_pattern · T9 · Tech Review
- **Onde:** `CLAUDE.md:588` (a linha do `D40` no índice)
- **Problema:** a linha foi de 251 para **366 bytes** e passou a ser a **maior da tabela** (as 39 medem min 214 / mediana 276). O texto acrescentado — a marca da emenda e a razão dela — **já está por extenso na §2**, para onde o campo `ÍNDICE` aponta: o excedente é **cópia**, não ponteiro.
- **Impacto:** nenhum sobre o código. O `CLAUDE.md` entra no contexto de **todo** agente em **toda** task, e é esse o custo que o teto de ~150 caracteres da §3-B existe para conter. ⚠️ **A tabela inteira já viola o teto desde antes desta task** — o que a T9 faz é **estender a deriva**.
- **O que fazer:** encurtar a linha, deixando a justificativa da emenda apenas na §2, que já a carrega íntegra.

### D46 · baixo · best_practices · T10 · Tech Review
- **Onde:** `deploy/nginx/sysloc-notificacao-bancaria.conf:178`
- **Problema:** o `limit_conn` não declara `limit_conn_status`, e o `503` que o comentário afirma como fixo é o **default** da diretiva — sobrescritível a partir do contexto `http` do servidor real, **fora deste arquivo**.
- **Impacto:** baixo e remoto, mas silencioso na direção ruim. A rede que existe **não alcança** a sobrescrita: `subir_borda_efemera` monta o próprio `nginx.conf` com um `http {}` mínimo que só faz `include` do vhost, de modo que o `CT-1194` (que afirma o conjunto `204 503`) e o `CT-1191` (que afirma `0` respostas `429`) medem um `http` que não contém diretiva alguma vinda do host. Um `limit_conn_status 429;` posto no `nginx.conf` global da borda real — hoje **compartilhado** com quem atende a operação — faria a recusa por concorrência sair como `429` sem que **nenhuma** das quatro frentes ficasse vermelha. E `429` é precisamente o código que o `CT-1191` trata como sinal de teto de taxa e que a ADR-0037 quer que **não exista** nesta rota. A premissa que o código sustenta está registrada em `docs/specs/features/webhook-e-carne/v1/tech_spec.md:743`: *"o provedor reenvia por conta própria; a idempotência absorve"* — e é `5xx` que faz o provedor reenviar.
- **O que fazer:** acrescentar `limit_conn_status 503;` junto do `limit_conn` no `location` da notícia, com uma linha dizendo que o valor é o mesmo do default e que está escrito **para não depender do `http` do host** — mesmo molde de `server_tokens off` e `client_max_body_size 64k`, que este vhost já declara em vez de herdar. Se valer o custo, estender o `CT-1193` para afirmar a presença da diretiva com o valor `503` em linha ativa: a `varrer_limitacao_declarada` já tem a forma pronta para mais um par medida/problema.

### D47 · baixo · documentation · T11 · QA
- **Onde:** `CLAUDE.md:39`
- **Problema:** o `CLAUDE.md` aponta a barreira executável como `CT-501 a CT-510`; os casos reais são `CT-901 a CT-910`.
- **Impacto:** **pré-existente ao `HEAD`** — não foi introduzido pela T11. O próprio cabeçalho do arquivo de teste explica a razão: *"a primeira versão deste arquivo nasceu em CT-501 e colidiu inteira com a fatia de cobrança"*, e a faixa foi movida para 9xx. O ponteiro do `CLAUDE.md` ficou na faixa morta. Nenhum caso da barreira o cobre — o `CT-903` afirma o ponteiro para a rule e os 4 itens do resumo, não a faixa de CT. ⚠️ **O erro se propaga**: o orquestrador o repetiu nos prompts dos gates desta task, tendo lido a linha errada como fonte.
- **O que fazer:** trocar `(CT-501 a CT-510)` por `(CT-901 a CT-910)`, ou pela faixa medida acrescida dos casos que a barreira acolheu depois (`CT-638`, `CT-1196`, `CT-1198`). Opcionalmente estender o `CT-903` com uma perna que leia os `describe('CT-` do próprio arquivo e afirme que a faixa narrada os contém — mesma construção do `CT-1196`, aplicada ao **ponteiro** em vez de ao número.

### D48 · baixo · documentation · T11 · QA
- **Onde:** `_run/linha-de-base.md:417`
- **Problema:** três pontos de índice ainda dizem `PENDENTE-T6` depois de a Dúvida 4 ter sido medida.
- **Impacto:** o bullet canônico (linha ~348) foi corrigido para `produziu efeito` (938 passadas, zero falhas) e declara que a premissa do `sudo` caiu por medição — o fecho está certo. Mas as linhas 19, 246 e 417 seguem em `PENDENTE-T6`, e a 417 é a **tabela-resumo**, com o comando ainda escrito com `sudo`. Quem lê o índice em vez do corpo conclui que a medição não aconteceu. `linha-de-base.md` é arquivo de **referência** (§3.3) e está fora da §3.2 da T11, de modo que não tocá-lo é *menor delta* defensável.
- **O que fazer:** substituir `PENDENTE-T6` por `produziu efeito` nas linhas 19, 246 e 417, e remover o `sudo` do comando das linhas 364 e 417 — a premissa que o exigia caiu por medição em 2026-08-26 e já está registrada na linha 350.

### D49 · baixo · documentation · T11 · QA
- **Onde:** `CLAUDE.md:276`
- **Problema:** o par secundário `149 fechados / 476 abertos`, atribuído ao critério antigo de dívida, não é reproduzível pelo critério que a própria linha descreve.
- **Impacto:** os números **primários** reproduzem exatamente com o comando que a linha escreve (625 blocos, 130 com `✅`, 495 abertos, 24 relatórios, 17 fatias — o gate mediu os quatro), e os deltas também. O que não reproduz é o par secundário: lido literalmente sobre o **cabeçalho**, dá `137 / 488`; o mais próximo que o gate reproduziu foi `150 / 475`, procurando `RESOLVIDO|FECHADO` no **bloco inteiro**, e ainda erra por um. Como a linha **declara abertamente** que 8 blocos não foram reconciliados um a um e escreve o comando do critério novo, é registro honesto — mas o par secundário fica sem comando que o gere, que é a condição que a própria linha se impõe.
- **O que fazer:** escrever, junto do par `149/476`, o comando exato que o produz; ou substituí-lo pelo par medido com o critério literalmente descrito (`137 / 488`). O critério novo já é reproduzível e não precisa de mudança.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

### T11 — o P5 executado, e as quatro divergências medidas contra a spec

O quadro completo vive em `_run/comparacao-final.md`; aqui fica só o que morde quem não o abrir.
**Veredito: nenhum caso que estava verde ficou vermelho, nos dois eixos.** Os 9 pacotes foram
remedidos um a um (**1987**, soma conferida, zero `skipped`/`todo`), e as **11** baterias que não
exigem privilégio foram executadas com o **critério literal do agregador** — nenhuma que saía `0`
saiu `1`, e as 3 privilegiadas ficaram **declaradas**, não simuladas.

⚠️ **Quatro números da spec da T11 foram refutados por medição, e nenhum foi "corrigido" no
repositório para caber na spec**: o índice tem **38** linhas (a §5.6 prescrevia 41→36, por
aritmética de planejamento), a fatia fechou **seis** débitos e não cinco (faltava o `D39 · F7/T8`),
as baterias são **14** e não 11, e as ADRs são **37 registradas / 30 `accepted`**. ⚠️ **Ajustar o
índice para caber no `36` teria apagado linha de débito vivo** — a pior forma da regressão que a
própria task existe para pegar.

⚠️ **O `D51 · F4/T16` disparou pela SEGUNDA vez** (a T7 abriu `apps/api/src/configuracao/ambiente.ts`)
e **não fechou**: fechá-lo mexe na partida do processador de trabalho, fora da lista das duas tasks.
A linha do índice do `CLAUDE.md` passou a registrar os **dois** disparos, e a razão está na §6.1 do
`comparacao-final.md`. O `D16 · F5/T8` depende dele e **não** disparou; o `D5 · F5/T3` também não —
a fatia não criou migração alguma.

### A T10 e o teste que podia ser silenciado pelo defeito que perseguia

Vale como achado de **método**, não de task. O `CT-1194` — a única prova **comportamental** de que o
teto de concorrência da borda pública de fato barra — nasceu com duas falhas que se compunham, e
nenhuma delas deixava a bateria vermelha:

1. **A guarda fundia dois desfechos opostos.** `chegadas ≠ aceitas` desviava para `aviso`, com
   desfecho `0`. Mas `chegadas < aceitas` é lentidão de ambiente (degrada legitimamente), enquanto
   `chegadas > aceitas` é **fisicamente impossível com o teto funcionando** — o excedente recebe
   `503` e nunca alcança o serviço. O único caminho que o produz é o teto **não ter barrado**, que é
   exatamente o defeito que o caso existe para pegar. Bastava alguém elevar `limit_conn` numa
   afinação futura para as quatro asserções da distribuição **não executarem** e a bateria fechar
   8/8.
2. **O valor do teto não tinha âncora.** `aceitas` era lido do vhost **renderizado** — o artefato sob
   prova nos dois lados da comparação —, e `total = aceitas + 2`. Logo **qualquer** valor passava: um
   teto rebaixado para `1` fazia o caso afirmar *"2 recusadas, 1 atendida"* e passar. Nem o `CT-1193`
   (casa `limit_conn` com qualquer inteiro) nem o `CT-1191` (rajada sequencial nunca põe duas
   conexões em voo) o alcançavam.

⚠️ **O dano da segunda é assimétrico e aponta para o lado errado**: o frontmatter da task nomeia
`tipo=security — a proteção errada aqui descarta notícia legítima, que é pior que o abuso`. Um teto
baixo demais é exatamente esse descarte, e era o que nenhuma das quatro frentes discriminava.

**A falsificação foi reproduzida por medição independente nos dois gates** — não aceita do executor.
Com `limit_conn` rebaixado para `1` num espelho em `mktemp -d`, o `CT-1194` fechou **verde** e a
**única** linha `FALHA` da execução inteira foi a âncora nova. É a demonstração literal de que o
caso, sozinho, aprovava qualquer teto.

**A lição generalizável**: o padrão que a `testing-stack.md` nomeia — *"provou-se o que era fácil
provar"* — reaparece aqui numa forma nova. O fácil era o teto **lido**; o difícil era o teto
**acordado**. Sempre que uma asserção deriva a expectativa do próprio artefato sob prova, ela mede
consistência interna e chama isso de correção. O arquivo já sabia disso — `TETO_DE_CORPO_NA_BORDA` e
`ZONA_DE_CONCORRENCIA` são terceiras declarações **exatamente por essa razão**, escrita por extenso
no comentário de uma delas. O número do teto ficou fora da disciplina que o próprio arquivo
estabelecia.

### O fecho do `D27 · F4/T11` teve TRÊS pontas, não duas

A §3-B do Protocolo manda remover marcador **e** linha do índice no mesmo movimento. Aqui havia uma
terceira, descoberta por medição: `deploy/scripts/borda/prompt-de-ativacao-do-webhook.md` reproduzia
o marcador **literal**, e a varredura do `CT-907` conta `.md` de `deploy/`. Sem remedi-la, o marcador
seguiria **vivo** para a barreira executável e o índice já sincronizado viraria **órfão** — a mesma
mentira, na direção contrária. ⚠️ **Vale como aviso para quem fechar débito daqui em diante**: a
conferência das "duas pontas" pressupõe que o marcador viva num lugar só, e documentação operacional
que **cita** o marcador quebra essa premissa.

### O `D40 · F7/T9` disparou pela segunda vez e segue aberto — por decisão validada

O gatilho, já emendado na T9, disparou de novo: a T10 mexeu no **serviço de trilha**, que o campo
`O QUÊ` do marcador enumera entre os itens duplicados. A extração **não** foi feita, e o Gate 2
validou a decisão com razão própria: os dois serviços de trilha **já divergiam antes** (10 argumentos
contra 4), o modo de espera **não tem contraparte** na borda que não tem `limit_conn`, e extrair
moveria ~200 linhas de arranjo de rede de **duas** baterias — uma delas fora da lista da task —
**dentro de um ciclo de correção de gate**, que é literalmente a *"correção grande com regressão
embutida"* da §5 do Protocolo. O gatilho ficou escriturado com **dois disparos**, de modo que a
próxima task que abrir o acessório herda o histórico em vez de redecidir.


- **A T2 custou 6 rodadas, e vale saber o que elas compraram.** Dois dos oito bloqueantes eram **destruição de backup de produção**: o expurgo alcançava `/opt/backups/frappe/daily` por `..` numa variável de ambiente, e depois `preparar_destino` adotava a raiz alheia gravando a sentinela **antes** de conferir propriedade — o QA reproduziu em sandbox e **viu um dump do legado desaparecer**. Um terceiro publicava o pacote de segredos **incompleto com código 0**. Nenhum deles era opinião: os três foram medidos.
- **O padrão que dominou o ciclo foi uma classe só** — *guarda sem prova* / *desfecho não conferido* —, reaparecendo cinco vezes em lugares diferentes. Fechou quando a correção parou de atacar a ocorrência e passou a atacar a topologia: entrada única com porta que faz trilha futura **falhar em vez de adotar**, e enumeração **executável** da superfície, amarrada ao fonte e falsificada por mutante.
- **Métrica do ledger da T2**: 17 achados, **7 originados em rodada >1**, mas apenas **1 suspeito de varredura incompleta** — o `TR-P8`, no `preservar-segredos.sh`, que atravessou cinco rodadas porque todas as varreduras se concentraram no arquivo irmão. Os outros seis nasceram das **próprias correções**, que é o custo esperado de mexer em código.
- **Os dois gates convergiram no discriminador de severidade**, e isso dá confiança ao resultado: *dano alcançável*. O Gate 1 convidou explicitamente o Gate 2 a bloquear o `D9`; o Gate 2 **recusou com razão declarada e medição própria**, percorrendo o corpo da função comando a comando para mostrar que toda falha ali degrada para caminho fechado.
- **Três `DECISÃO FECHADA` nasceram nesta task** (não quatro — a contagem que eu havia passado ao gate estava errada, e ele a corrigiu). O Gate 2 julgou a proporcionalidade e aprovou: cada uma satisfaz dois gatilhos independentes da §3.
- ⚠️ **Dois avisos para a T4**, que escreverá a unidade systemd: **(a)** o expurgo reprovado sai `1` **depois** da publicação, então a unidade marcará `failed` numa execução em que a cópia do dia existe e está íntegra — o `OnFailure` precisa refletir isso; **(b)** `verificar-backup.sh` sai `2` de forma estável neste host e o agregador a contará como problema permanente no resumo, por comportamento **preexistente** dele (a T5 reconcilia).
- ⚠️ **O achado A9 da T1 morde a T4 diretamente**: o legado dispara a preservação por **entrada na crontab do root** às **02:30**, no mesmo volume — a `[HIPÓTESE]` do pré-refinamento caiu por medição, e o horário do `.timer` **deixou de ser livre**.
### T9 — o destino declarado do e-mail é decisão operacional, e está registrado aqui

⚠️ **A constante `DESTINO_DECLARADO_DO_EMAIL` de `deploy/scripts/borda/verificar-borda-do-app.sh`
nasceu valendo `smtp.systera.com.br:587`**, e o valor **não é derivável do código** — é decisão
operacional do usuário, adotada pela regra A1 de `.claude/rules/autonomia-do-run.md` e registrada
aqui no mesmo diff em que a constante nasceu. **Razão:** é o domínio que já atende o produto na borda
pública, e `587` é a porta de submissão (RFC 6409). Derivá-lo do valor medido faria a asserção
concordar com qualquer host, que é a asserção tautológica.

⚠️ **A fatia NÃO troca o `SMTP_URL`** (scope §5.9) — a troca entra no gate de desinstalação. O que a
T9 entrega é a asserção cuja divergência reprova: hoje, neste host, ela **degrada com `aviso`**
porque `/etc/sysloc/backend.env` é `0600 root:root` e `sudo -n` falha. O **poder** dela está provado
sem privilégio pelo `CT-1190`, com quatro sondas em diretório descartável — inclusive a que prova que
o endereço do capturador **reprova nomeando os dois valores**.

⚠️ **CONSEQUÊNCIA DECLARADA, para quem fizer a troca:** o `CT-1152` de
`deploy/scripts/instalacao/verificar-unidades-agendadas.sh` afirma o **outro lado da mesma chave** —
que o processo **em execução** aponta para o laço local, que é o que impede um envio real a partir de
dados de ensaio. As duas asserções são as duas pontas do mesmo interruptor, e a troca move as duas
**no mesmo movimento**.

### T9 — duas escriturações que o run precisa fechar

1. O `D24 · F1/T5` **fechou** e o marcador saiu de `apps/api/src/main.ts`; o cabeçalho `### D24` da §2
   de `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/_run/run-report.md` **ainda não carrega a
   marca de fecho** — aquele relatório é de fatia fechada e está fora da lista de arquivos da T9.
2. O `D40` acima foi emitido pelo executor, e não por gate; se a §2 for regenerada a partir do JSON
   dos gates, **o bloco precisa ser preservado** — sem ele o marcador vivo fica órfão de registro.

- **`_run/qa_context.md` está STALE** e foi declarado não-confiável neste run; os gates consultam `intent.md`/`scope.md` diretamente.

### T6 — as três pendências são de janela assistida, e o run não as pode fechar

A T6 fechou nos dois gates com **três critérios `PARCIAL`** (CA-02, CA-05, CA-14). Nenhum é defeito:
os três exigem **privilégio**, e `sudo -n` falha neste host — nenhum agente digita senha. Cada um tem
a degradação nomeada e o comando que a fecharia; o roteiro de 4 passos está em
`_run/convergencia-do-host.md` §4. É o molde já aprovado na T1.

⚠️ **Duas divergências desta task foram declaradas e MEDIDAS antes do despacho, e as duas procedem:**

1. **A premissa da §2 da task está refutada.** Ela diz que o host tem *zero* timers de rotina. O host
   tem as **16 unidades**, com `mtime` uniforme em 2026-08-25 16:25:19 — **17 minutos depois** da
   janela assistida da T1 —, e os 6 relógios correm desde então. A instalação foi **atribuída ao
   operador**, pela evidência do `mtime` num único segundo e do privilégio exigido. A lacuna real são
   as **2 unidades do backup**, que a T4 criou e ninguém instalou.
2. **A ordem irreversível da §4 está MOOT.** Ela mandava afirmar o destino do e-mail, disparar **uma**
   passada com os relógios **parados**, e só então habilitá-los. Os relógios já estavam habilitados —
   e o achado §5.9 do scope **materializou-se**: `SMTP_URL` aponta para o capturador de
   desenvolvimento (`mailpit`, porta 1025) sob `NODE_ENV=production`, com **938 passadas** medidas.
   **Nenhum e-mail alcançou destinatário real**, mas a trilha registra entrega para mensagens que
   ninguém recebeu. **Não é defeito desta fatia — é o risco que o scope nomeou, agora com dado.**

### T7 — o fecho do `D23` quase passou sem prova, e duas medições o impediram

A T7 fechou em **2 rodadas**. O bloqueante da rodada 1 merece registro porque é um furo de segurança
que a própria task **nomeava** e mesmo assim deixou aberto:

`ORIGENS_PUBLICAS=https://*.systera.com.br` — a forma que qualquer operador escreveria ao publicar
dois subdomínios — **passaria na conferência de partida** e faria a barreira de origem aceitar
**qualquer** origem. O `better-auth` desvia para `wildcardMatch` assim que o padrão contém `*`, e
`new URL('https://*').origin` devolve `'https://*'`, atravessando a validação inteira. O `CT-1166`
declara o invariante *"nenhuma entrada contém `*`"* — mas guardava só o caminho do **código**. O
caminho da **configuração**, que é o único que o operador usa, ficou aberto.

A correção fechou a **classe**, não a ocorrência, e isso foi medido em três eixos: o gatilho do
desvio foi lido no pacote publicado e é exatamente dois caracteres (logo a constante é o conjunto
**completo**, não uma amostra); 15 contra-exemplos foram executados, incluindo percent-encoding e
punycode, e nenhum atravessa; e o canal é único, porque a validação e a transformação usam a mesma
função de separação.

⚠️ **Duas premissas foram verificadas em vez de aceitas, e é isso que sustenta o veredito:**

1. **O Gate 2 falsificou a premissa do QA** antes de concordar com ela. O QA classificou o terceiro
   canal como `BAIXO` porque *"quem escreve no `EnvironmentFile` também escreve
   `BETTER_AUTH_SECRET`"*. Se essa variável fosse inerte — opção explícita vencendo o ambiente —, o
   modelo de ameaça cairia inteiro. O Gate 2 mediu: `ambiente.ts:1045` faz
   `segredoDeSessao: validado.BETTER_AUTH_SECRET`. A premissa procede, e o `BAIXO` está certo **por
   medição, não por deferência**.
2. **O Gate 2 discordou de uma razão do QA e a refutou.** O QA dispensou a âncora da constante de
   curingas alegando que o caminho até o pacote seria *"mais frágil que o fato que se quer
   proteger"*. Medido: `createRequire(...).resolve('better-auth')` resolve sem hash no fonte. A
   conclusão (não bloquear) ficou; a razão caiu — e é o corolário que o `CLAUDE.md` registra: *a
   frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela
   justifica*.

**Pendência de janela assistida, e a ordem é irreversível**: sem `ORIGENS_PUBLICAS` em
`/etc/sysloc/backend.env` a **API recusa subir**. A sequência é (1) escrever a linha, (2) implantar e
reiniciar a API, (3) só então recarregar o painel. Inverter derruba o login do painel na janela entre
os passos — o aviso está escrito no próprio vhost.

### Pausa controlada de 2026-08-26 — a segunda desta fatia

O run parou a pedido do usuário com **9 de 11 tasks concluídas**. A T10 foi despachada e
**interrompida antes de escrever qualquer byte**; não há código parcial, e a retomada correta é
**reexecutar do zero**. O roteiro completo está em `_run/RETOMAR.md`.

### Achado de MÉTODO: uma regressão atravessou os dois gates de uma task

`verificar-workspace.sh` passou várias tasks em vermelho sem que ninguém notasse. A causa: o `CT-003`
proíbe IPv4 literal no `.env.example`, e a **T7** acrescentou um comentário com
`http://127.0.0.1:<porta>`. **Os dois gates da T7 aprovaram** — o QA mediu os nove pacotes Vitest e
não rodou bateria shell alguma, porque `.env.example` não é TypeScript e nada no escopo declarado da
task apontava para aquela bateria; o Gate 2 não re-executa suíte.

**Não é desatenção: é lacuna estrutural de cobertura cruzada entre as duas frentes de teste.** O
repositório tem duas suítes independentes (Vitest e baterias shell) e o escopo de gate é derivado dos
arquivos declarados na task — um arquivo que **as duas frentes leem** cai no vão entre elas.

Corrigido por intervenção dirigida: o comentário passou a nomear o endereço pela **função** em vez de
escrever os octetos, e **a asserção não foi tocada** — o teste estava certo. `verificar-workspace.sh`
voltou a **4/4, desfecho 0**.

⚠️ **A mitigação estrutural fica como recomendação para o fecho da fatia**: quando uma task tocar
arquivo de configuração versionado que as baterias shell leem (`.env.example`, `deploy/**`,
`CLAUDE.md`), a §3.2 dela deve declarar a bateria correspondente como âncora — que é exatamente o que
a `.claude/rules/ancoras-de-superficie.md` §5.2 já prescreve para âncoras de superfície, e que aqui
não foi aplicado porque ninguém reconheceu o `.env.example` como âncora.
