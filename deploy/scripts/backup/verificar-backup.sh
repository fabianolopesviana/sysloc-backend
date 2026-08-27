#!/usr/bin/env bash
#
# Verificação da preservação — T2 da fatia `publicacao-e-backup`.
#
# Casos cobertos nesta task: CT-1098 a CT-1106.
#
#   CT-1098  a cópia nasce em formato de restauração seletiva e SÓ ENTÃO vira a
#            do dia — assinatura, listagem com conteúdo, um arquivo com o nome do
#            dia, nenhum resíduo `.parcial`;
#   CT-1099  cópia interrompida não é publicada nem deixa resíduo — a instância é
#            derrubada NO MEIO da cópia, e o que se afirma é que a cópia do dia
#            ou existe íntegra ou não existe;
#   CT-1100  o expurgo decide POR IDADE, nunca por nome nem por extensão, com o
#            par de nomes trocados provando o eixo e o par de fronteira a borda;
#   CT-1100 (b)  o expurgo RECUSA um destino que não é o acervo desta rotina —
#            inclusive quando ele é alcançado por travessia (`..`), que é a forma
#            exata que alcançaria a preservação do sistema legado;
#   CT-1100 (c)  destino ILEGÍVEL não é destino vazio: a varredura que não pôde
#            ler o destino recusa em vez de imprimir `removidas=0 mantidas=0`;
#   CT-1100 (d)  cópia vencida que RESISTE à remoção é contada e nomeada, e o
#            expurgo não termina com sucesso;
#   CT-1100 (e)  a trilha `copiar` — a que o relógio dispara — NÃO ADOTA raiz
#            alheia: não corrige o modo dela, não grava a sentinela nela, e a
#            execução seguinte segue recusando. Com o controle da adoção
#            legítima ao lado, para que a recusa não possa ser "recusar tudo";
#   CT-1100 (f)  os CINCO ramos de recusa da entrada única da propriedade da
#            raiz, POR ENUMERAÇÃO e nos dois modos — a tabela do docblock dele é
#            o que faz o ramo seguinte nascer com perna;
#   CT-1101  prazo inválido recusa SEM REMOVER NADA — `0` não é "apague tudo";
#   CT-1102  a chave de cifra não está no pacote de segredos, medido no CONTEÚDO
#            extraído, com controle positivo obrigatório;
#   CT-1103  a chave dentro do que iria para o pacote RECUSA a execução antes da
#            escrita, nas duas formas que o eixo por nome não alcança sozinho;
#   CT-1103 (b)  destinos que se contêm RECUSAM a execução (ADR-0032), nas SEIS
#            grafias — inclusive `.`, `..`, vínculo simbólico e caminho relativo,
#            que a comparação textual não alcançava —, com controle antivácuo;
#   CT-1103 (c)  raiz de segredos com trecho ILEGÍVEL não é raiz limpa: a
#            preservação RECUSA em vez de publicar um pacote SEM os arquivos
#            daquele trecho — com a perna legível que discrimina;
#   CT-1104  nenhuma credencial escapa por nenhum dos cinco canais de saída, com
#            controle positivo que planta a sentinela canal a canal;
#   CT-1105  nenhum dos dois scripts carrega credencial em linha de comando nem
#            liga rastreio de shell — com prova de falsificação;
#   CT-1106  destino preexistente com modo frouxo é CORRIGIDO, e não apenas
#            acertado na criação;
#   CT-1106 (b)  destino que é VÍNCULO SIMBÓLICO recusa, e o diretório alvo não
#            tem o modo alterado nem o acervo expurgado.
#
# Casos acrescentados pela T3 — a RESTAURAÇÃO, que é a prova da fatia:
#
#   CT-1107  a restauração REPRODUZ a origem, conferida por conjunto de relações
#            e por contagem de linhas, com o destino medido em ZERO antes;
#   CT-1108  base de destino NÃO VAZIA é recusada e fica intacta — com a linha da
#            sequência solta, que é o que separa um guarda de OBJETOS de um que
#            só conta tabelas;
#   CT-1109  o ensaio lista e NÃO escreve, nas duas formas de entrada padrão: a
#            fechada e a aberta e muda, que é a que prova que ele não bloqueia;
#   CT-1110  sem o token EXATO a restauração não acontece — seis respostas, cinco
#            recusadas e a sexta como antivácuo do próprio caso;
#   CT-1111  o conteúdo é exibido ANTES de escrever, provado pelo EFEITO numa
#            execução que termina em recusa;
#   CT-1112  o destino que ATENDE À OPERAÇÃO é recusado e a recusa é TERMINAL —
#            medida no diário do servidor, com auditoria estática da ordem no
#            fonte e as duas falsificações dela;
#   CT-1113  restauração INCOMPLETA é acusada, inclusive quando o restaurador
#            terminou bem e a relação se perdeu DEPOIS.
#
# Casos acrescentados pela T5 — o fecho da bateria e do `D9 · F0/T2`:
#
#   CT-1119  a bateria é DESCOBERTA pelo agregador, com a expressão de descoberta
#            EXTRAÍDA do fonte dele, e sai da descoberta se mudar de casa;
#   CT-1120  o contrato de saída em quatro partidas — `0` só com zero falhas e
#            tudo medido, `1` reprovação, `2` pré-condição, e a ferramenta fora do
#            CAMINHO abortando em vez de sair verde;
#   CT-1121  ela roda SEM PRIVILÉGIO, e cada frente que exigiria root degrada com
#            aviso NOMEADO, dizendo o que não foi medido e o comando que o mediria;
#   CT-1122  o FRESCOR da cópia do dia, com a borda exata do teto declarado e a
#            mensagem que separa "acervo velho" de "acervo vazio";
#   CT-1123  a bateria EXECUTA DE FATO uma restauração em base efêmera — destino
#            medido em ZERO antes, três relações depois, e nada de pé no fim;
#   CT-1124  nenhuma asserção estática escreve na ÁRVORE DE TRABALHO, comparado
#            entre duas fotos do git e com o controle positivo que planta uma;
#   CT-1125  o `D9` está FECHADO: as doze baterias consomem UM esqueleto, e cada
#            símbolo do vocabulário tem uma definição só;
#   CT-1126  a extração NÃO ENGOLIU caso algum, contra a tabela `bateria → casos`
#            medida uma vez, ANTES dela.
#
# ===========================================================================
# O VOCABULÁRIO DE ASSERÇÃO NÃO MORA MAIS AQUI
# ===========================================================================
#
# Ele vem de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, carregado por
# `source`. Foi a T5 que o extraiu, fechando o `D9 · F0/T2` — o débito registrado
# em 2026-08-19, cujo gatilho era literalmente *"a próxima fatia que escrever um
# `verificar-*.sh`"*. O CT-1125 é a rede permanente disso.
#
# ===========================================================================
# POR QUE ESTA BATERIA EXISTE, E POR QUE ELA NASCE AQUI
# ===========================================================================
#
# Nada do que estes dois scripts fazem é observável de dentro do processo Node:
# formato de arquivo produzido, tempo de modificação de item de diretório, modo
# de permissão, conteúdo de pacote e canal de saída de processo são invariantes
# do sistema operacional e do sistema de arquivos. É o critério de placement da
# `.claude/rules/testing-stack.md` — *"se o invariante só é observável
# inspecionando o sistema operacional, o git ou o filesystem, é shell"*.
#
# Ela nasce junto com o que prova porque o P4 do Protocolo Antirregressão exige
# que toda propriedade nova deixe uma rede que reprova se o defeito voltar. Sem
# ela, a preservação fecharia sem rede permanente — e a fatia inteira existe
# porque 1943 casos verdes não perceberam seis rotinas ausentes do servidor.
#
# ===========================================================================
# COMO ELA RODA SEM PRIVILÉGIO — e onde o privilégio ainda falta (ADR-0006)
# ===========================================================================
#
# Ela levanta as PRÓPRIAS instâncias de banco, em diretório temporário e porta
# própria, e nunca toca o agrupamento que atende a operação. A faixa de portas
# (26001-26999) é deliberadamente distinta da faixa da suíte de TypeScript
# (24001-24999) e da faixa de `verificar-apuracao-versao.sh` (25001-25999): as
# três podem estar de pé ao mesmo tempo, e disputar porta produziria falha
# intermitente que nada tem a ver com o que se quer provar.
#
# ⚠️ A variável de conexão do ambiente é IGNORADA POR CONSTRUÇÃO. Esta bateria a
# exporta apontando para um destino impossível e prova, no CT-1098, que a cópia
# saiu mesmo assim da instância efêmera — que é a forma positiva da ADR-0006.
#
# **O que ela NÃO alcança**: a raiz real dos segredos (`/etc/sysloc`) é do
# superusuário, e são DUAS as frentes que dependem dela — a (b) do CT-1102, que
# mede o pacote da raiz real, e a do nome real da base da operação no CT-1112.
# As duas medem quando o arquivo é legível por quem executa; quando não é, cada
# uma emite `aviso` nomeado, NÃO conta a asserção como aprovada, e a bateria sai
# com código 2 — o idioma que a `testing-stack.md` fixa para "o que se prova está
# íntegro, e o único vermelho é a saúde do ambiente deste host". ⚠️ Rodar com
# `sudo` NÃO resolve, e a razão está no bloco de uso, no fim deste cabeçalho: a
# bateria não pode ser executada como root.
#
# ⚠️ E a frente do CT-1112 NUNCA executa o alvo contra o agrupamento que atende
# à operação, mesmo quando o arquivo é legível: o que ela faz é ler dali o NOME
# da base e exercitar a guarda com esse valor DENTRO da caixa de areia. Executar
# contra a operação para provar a ADR-0006 seria violá-la para prová-la.
#
# ===========================================================================
# CONTRATO DE SAÍDA
# ===========================================================================
#
#   0  zero falhas, e a raiz real dos segredos foi medida.
#   1  reprovou o que esta bateria existe para provar.
#   2  zero falhas, e o arquivo de ambiente REAL da operação não pôde ser lido
#      por falta de privilégio — há asserção declarada e NÃO MEDIDA neste host.
#
# Ferramenta ou estado ausente NUNCA faz caso passar em silêncio.
#
# Uso:
#   bash deploy/scripts/backup/verificar-backup.sh
#
# ⚠️ ELA NÃO RODA COMO SUPERUSUÁRIO, e isso não é escolha: o preparo de uma
# instância de banco RECUSA root, e esta bateria levanta duas. Rodá-la com
# `sudo` a mataria no arranjo, antes da primeira asserção — por isso ela recusa
# root explicitamente, com a razão na mensagem.
#
# A consequência é que, NESTE host, a frente (b) do CT-1102 e a do nome real do
# CT-1112 nunca são medidas, e a bateria termina em 2 de forma estável. Isso é a declaração honesta de uma
# asserção pendente, e não uma reprovação: o que ela prova está íntegro, e o
# vermelho é a saúde do ambiente. Fechá-lo exige ou tornar `/etc/sysloc` legível
# a quem executa, ou dar a esta bateria a capacidade de descer de identidade
# para levantar as instâncias — nenhuma das duas está no alcance desta task.
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly SCRIPT_COPIAR="${RAIZ_REPO}/deploy/scripts/backup/copiar-base.sh"
readonly SCRIPT_SEGREDOS="${RAIZ_REPO}/deploy/scripts/backup/preservar-segredos.sh"
readonly SCRIPT_RESTAURAR="${RAIZ_REPO}/deploy/scripts/backup/restaurar-base.sh"

# A raiz REAL dos segredos de operação — a frente (b) do CT-1102.
readonly RAIZ_REAL_DOS_SEGREDOS="/etc/sysloc"

# O arquivo de ambiente REAL da operação — a frente privilegiada do CT-1112. É
# dele que sai a identidade da base que atende a operação, e ele é do
# superusuário: quando não for legível, o caso degrada com `aviso` e a bateria
# termina em 2, como já faz a frente (b) do CT-1102.
readonly ARQ_AMBIENTE_REAL_DA_OPERACAO="${RAIZ_REAL_DOS_SEGREDOS}/backend.env"

# Faixa de portas desta bateria — ver o cabeçalho para a razão de ela não ser a
# de nenhuma das outras duas frentes.
readonly PORTA_INICIAL=26001
readonly PORTA_FINAL=26999

# Portas que uma instância desta bateria não pode ocupar em hipótese alguma: as
# três que o provisionamento abre e as duas padrão do banco e da fila. A faixa
# acima já as exclui — este guarda existe para o dia em que alguém a alargar.
readonly PORTAS_INTOCAVEIS=(1025 5432 6379 6380 8025)

# Limite de espera pelo estado observável "o cluster aceita conexão".
readonly LIMITE_SUBIDA_S=30

readonly SEGUNDOS_POR_DIA=86400

# Folga, em segundos, com que o par de fronteira do CT-1100 é posicionado em
# torno da linha do prazo.
#
# ⚠️ ELA NÃO É ZELO, E NÃO PODE SER ZERO. O tempo de modificação é fixado por
# esta bateria num instante, e o expurgo lê o relógio DELE alguns instantes
# depois: um arquivo posto exatamente sobre a linha já a terá cruzado quando o
# alvo o examinar, e a asserção viraria cara ou coroa. Com a folga, os dois lados
# do par ficam a 5 minutos e a 1 minuto da linha, em sentidos opostos — margem
# que nenhum atraso de execução desta bateria consome, e estreita o bastante para
# que um prazo de 13 ou de 15 dias reprove os dois.
readonly FOLGA_DA_BORDA_S=300

# Quanto o par de nomes trocados se afasta da linha, em dias. Bem longe dela nos
# dois sentidos: o que este par prova é o EIXO da decisão, não a borda.
readonly DIAS_DO_ORFAO_ANTIGO=400

# Volume semeado no CT-1099. A cópia dele leva alguns segundos, enquanto a
# sondagem que a interrompe reage em centésimos — a margem medida neste host é de
# mais de uma ordem de grandeza, e é ela que torna a interrupção determinística.
readonly LINHAS_DA_TABELA_VOLUMOSA=200000
readonly LIMITE_DA_SONDAGEM=500
readonly INTERVALO_DA_SONDAGEM_S=0.02

# Os cinco canais de saída que o CT-1104 varre. A ordem é a da declaração, e é
# ela que torna a lista de achados comparável por igualdade.
#
# ⚠️ Os canais 3 e 4 são de NOMES, não de conteúdo — e a distinção é o ponto: o
# pacote de segredos e o arquivo da chave carregam segredo POR DESENHO, e varrer
# o conteúdo deles acusaria a própria entrega. O que não pode vazar por ali é o
# nome do artefato.
readonly CANAIS_DE_SAIDA=(
	saida-padrao
	saida-de-erro
	nomes-no-destino-da-copia
	nomes-no-destino-dos-segredos
	residuo-temporario
)

# As quatro formas de credencial em linha de comando que o CT-1105 procura. Os
# rótulos são conteúdo: a reprovação nomeia a forma, e não apenas a linha.
readonly FORMA_ARGUMENTO="credencial-em-argumento"
readonly FORMA_AMBIENTE="credencial-em-variavel-exportada"
readonly FORMA_CADEIA="cadeia-de-conexao-com-segredo"
readonly FORMA_RASTREIO="rastreio-de-shell-ligado"

# Marcadores que o cabeçalho de um script pode usar para mostrar o FORMATO de uma
# cadeia de conexão sem escrever credencial nenhuma.
readonly MARCADORES_DE_DOCUMENTACAO='SEGREDO|SENHA|PASSWORD|CREDENCIAL|xxx'

# A referência que o script que fala com o banco PRECISA carregar: sem ela, ele
# não estaria entregando o segredo por arquivo de modo restrito.
readonly REFERENCIA_AO_ARQUIVO_DE_CREDENCIAL="PGPASSFILE"

# O nome da variável da chave de cifra, como `preservar-segredos.sh` a conhece.
readonly NOME_DA_CHAVE="CHAVE_DE_CIFRA_DO_CERTIFICADO"

# =========================================================================== #
# T5 — o que a bateria passa a medir, e as âncoras que a T5 declara.
# =========================================================================== #

# O agregador que descobre as baterias. O CT-1119 EXTRAI dele a expressão de
# descoberta; reescrevê-la aqui poria a reimplementação sob prova, e o caso
# aprovaria um agregador que descobrisse outra coisa.
readonly AGREGADOR="${RAIZ_REPO}/deploy/scripts/verificacao/rodar-baterias.sh"

# A casa comum do vocabulário de asserção — o que fecha o `D9 · F0/T2`.
readonly ESQUELETO="${RAIZ_REPO}/deploy/scripts/verificacao/esqueleto-de-assercao.sh"

# Os OITO símbolos das sete linhas do vocabulário canônico da
# `.claude/rules/testing-stack.md` — a última linha da tabela dela (`aviso`/`nota`)
# tem dois símbolos, e é por isso que sete linhas dão oito nomes. O CT-1125 afirma
# que cada um tem UMA definição no repositório.
#
# ⚠️ `afirmar_contem` NÃO está aqui, e a razão é medida: as quatro cópias dela não
# são o mesmo símbolo (a de `verificar-captura.sh` recebe um ARQUIVO e grepa; as
# outras três recebem uma STRING e comparam). Ver o cabeçalho do esqueleto.
readonly SIMBOLOS_DO_ESQUELETO=(
	caso
	ok
	falhar
	afirmar_igual
	afirmar_diferente
	aviso
	nota
	fechar_caso
)

# A superfície das baterias de shell, por extenso — o conjunto que o CT-1119
# afirma por IGUALDADE contra o que o agregador descobre.
#
# ⚠️ São QUATORZE desde a T9, e o índice do `CLAUDE.md` dizia dez: aquele número
# é de 2026-08-19 e não conhece `verificar-preparacao-do-material.sh`, esta
# bateria, `verificar-unidades-agendadas.sh` nem `verificar-borda-do-app.sh`.
#
# ⚠️ ESTA LISTA É A CANCELA DA SUPERFÍCIE DE BATERIAS. O CT-1119 a compara por
# IGUALDADE contra o que o agregador descobre por `find`, e é por isso que ela é
# escrita por extenso: bateria nova que não entre aqui REPROVA a suíte no mesmo
# diff em que nasce, e não tem como ficar invisível ao agregador em silêncio.
# Quem acrescenta uma bateria acrescenta as TRÊS constantes desta seção.
readonly BATERIAS_DECLARADAS=(
	backup/verificar-backup.sh
	borda/verificar-borda-do-app.sh
	borda/verificar-notificacao-bancaria.sh
	caracterizacao/verificar-captura.sh
	caracterizacao/verificar-golden.sh
	cobranca-bancaria/verificar-guarda-de-boletos.sh
	cobranca-bancaria/verificar-preparacao-do-material.sh
	documentos/verificar-isolamento-de-verificacao.sh
	instalacao/verificar-apuracao-versao.sh
	instalacao/verificar-fundacao.sh
	instalacao/verificar-migracao.sh
	instalacao/verificar-provisionamento.sh
	instalacao/verificar-unidades-agendadas.sh
	instalacao/verificar-workspace.sh
)

# --------------------------------------------------------------------------- #
# A tabela do CT-1126 — `bateria | quantidade | IDs`, MEDIDA UMA VEZ, em
# 2026-08-26, ANTES da extração do esqueleto.
#
# ⚠️ Ela é escrita por extenso de propósito. Derivá-la do próprio texto no momento
# da execução faria a asserção CONCORDAR COM QUALQUER CONTAGEM — uma extração que
# engolisse metade dos casos passaria, porque o esperado teria encolhido junto. É
# a rede de maior valor da T5: o fecho do `D9` edita onze arquivos que já
# existiam, e caso que some sem ninguém notar é R2 (regressão de prova) no
# Protocolo Antirregressão.
#
# A ÚNICA linha cuja quantidade não é a de antes da extração é a desta bateria:
# a T5 acrescenta a ela os oito casos CT-1119 a CT-1126, e o valor abaixo é o
# final. As outras onze são as medidas antes, byte a byte.
#
# ⚠️ DUAS linhas são POSTERIORES à extração, e por isso não têm "antes": a de
# `instalacao/verificar-unidades-agendadas.sh` (T6) e a de
# `borda/verificar-borda-do-app.sh` (T9). As duas baterias nasceram já
# consumindo a casa comum, e os casos de cada uma são os declarados no cabeçalho
# dela. Cada linha entra aqui no MESMO diff que publica a bateria — ver a
# cancela declarada em `BATERIAS_DECLARADAS`.
#
# ⚠️ A linha de `borda/verificar-notificacao-bancaria.sh` foi de 4 para 8 na T10,
# e o total de 107 para 111: são as quatro frentes da proteção contra abuso
# (CT-1191 a CT-1194), acrescentadas no MESMO diff em que aquela bateria as
# publica. Número narrativo que fica para trás convida a próxima task a
# "corrigir" a âncora executável para o valor errado. **Não reponha o 4 nem o
# 107.**
# --------------------------------------------------------------------------- #
readonly CASOS_DECLARADOS_POR_BATERIA=(
	"backup/verificar-backup.sh|24|CT-1098;CT-1099;CT-1100;CT-1101;CT-1102;CT-1103;CT-1104;CT-1105;CT-1106;CT-1107;CT-1108;CT-1109;CT-1110;CT-1111;CT-1112;CT-1113;CT-1119;CT-1120;CT-1121;CT-1122;CT-1123;CT-1124;CT-1125;CT-1126"
	"borda/verificar-borda-do-app.sh|12|CT-1180;CT-1181;CT-1182;CT-1183;CT-1184;CT-1185;CT-1186;CT-1187;CT-1188;CT-1188 (b);CT-1189;CT-1190"
	"borda/verificar-notificacao-bancaria.sh|8|CT-1005 (a);CT-1005 (b);CT-1005 (c);CT-1005 (d);CT-1191;CT-1192;CT-1193;CT-1194"
	"caracterizacao/verificar-captura.sh|13|CT-001;CT-002;CT-003;CT-004;CT-005;CT-006;CT-007;CT-008;CT-009;CT-012;CT-013;CT-502;CT-603"
	"caracterizacao/verificar-golden.sh|11|CT-010;CT-011;CT-013;CT-014;CT-433;CT-501;CT-503;CT-601;CT-602;CT-640;CT-701"
	"cobranca-bancaria/verificar-guarda-de-boletos.sh|3|CT-947 (infra-a);CT-947 (infra-b);CT-947 (infra-c)"
	"cobranca-bancaria/verificar-preparacao-do-material.sh|3|CT-1011 (infra);CT-1012 (infra);CT-1013 (infra)"
	"documentos/verificar-isolamento-de-verificacao.sh|3|CT-733 (a);CT-733 (b);CT-733 (c)"
	"instalacao/verificar-apuracao-versao.sh|3|CT-007;CT-008;CT-009"
	"instalacao/verificar-fundacao.sh|9|AGREGACAO;CT-001;CT-002;CT-003;CT-004;CT-005;CT-006;CT-007;SERVICOS"
	"instalacao/verificar-migracao.sh|2|CT-031;CT-032"
	"instalacao/verificar-provisionamento.sh|8|CT-001;CT-002;CT-003;CT-004;CT-005;CT-030;CT-647;CT-1045"
	"instalacao/verificar-unidades-agendadas.sh|8|CT-1146;CT-1147;CT-1148;CT-1149;CT-1150;CT-1151;CT-1152;CT-1154"
	"instalacao/verificar-workspace.sh|4|CT-001;CT-002;CT-003;CT-004"
)

# A soma das quantidades acima. Escrita à parte porque é o CONTROLE ANTIVÁCUO do
# CT-1126: um extrator quebrado devolveria zero para todas as baterias, e a lista
# de divergências ficaria vazia por vacuidade — igual à de uma árvore íntegra.
readonly CASOS_DECLARADOS_NO_TOTAL=111

# --------------------------------------------------------------------------- #
# O teto de frescor da cópia do dia — CT-1122.
#
# São 26 horas, e não 24. A cópia é disparada por `sysloc-backup-da-base.timer`
# às 02:45, e o relógio do supervisor não é pontual por contrato: `Persistent=true`
# dispara a execução PERDIDA quando a máquina volta, e `AccuracySec` mais a fila
# de partida do supervisor deslocam a execução real em minutos. Um teto de 24 h
# reprovaria toda vez que a execução de hoje atrasasse alguns minutos em relação à
# de ontem — vermelho por relógio, não por cópia ausente, que é o vermelho que
# ensina o operador a não ler o vermelho.
#
# As duas horas de folga são o intervalo que separa "a rotina atrasou" de "a
# rotina não rodou": um dia inteiro perdido dá 48 h e reprova com sobra.
readonly TETO_DE_FRESCOR_EM_HORAS=26

readonly SEGUNDOS_POR_HORA=3600

# A unidade do relógio que dispara a cópia. Declarada aqui e CONFERIDA contra o
# arquivo versionado no CT-1122: constante que ninguém confere é constante que já
# divergiu.
readonly UNIDADE_DO_RELOGIO="sysloc-backup-da-base.timer"

# --------------------------------------------------------------------------- #
# As frentes que só são observáveis com privilégio — a âncora do CT-1121.
#
# Cada linha é `rótulo | quantas degradações a ausência dela produz`. O rótulo é a
# substring que a mensagem do `aviso` carrega, e é por ele que o caso liga a
# degradação observada à frente que a produziu.
#
# ⚠️ A tabela declara DUAS degradações para o arquivo de ambiente, e não uma: são
# duas frentes distintas que dependem do mesmo arquivo — a (b) do CT-1102 (a
# separação medida contra a raiz REAL) e a do CT-1112 (o NOME REAL da base da
# operação). A §5.2 da task escreveu "exatamente 3 avisos"; a medição de
# 2026-08-26 mostra 4, porque aquele número contava FRENTES e o que sai são
# LINHAS. Afirmar a tabela, e não o total, é o que torna o caso verdadeiro nos
# dois hosts: onde a pré-condição existir, a frente é medida e a linha não sai.
# --------------------------------------------------------------------------- #
readonly FRENTES_PRIVILEGIADAS=(
	"ambiente-real|2"
	"acervo-real|1"
	"relogio-no-supervisor|1"
)

# A frase que TODA degradação declarada carrega, para que o operador saiba o que
# fazer com ela. Sem o comando, o aviso diz que algo não foi medido e deixa o
# leitor sem saída — que é a forma mais barata de um aviso virar ruído.
readonly MARCA_DO_COMANDO_QUE_MEDIRIA="o comando que a mediria:"

# O comando que torna o arquivo de ambiente real legível por quem executa, e o
# devolve ao estado anterior. Ele é reversível de propósito: afrouxar o modo de um
# arquivo de segredo em definitivo, para medir uma asserção, seria trocar a
# asserção pelo defeito que ela persegue.
readonly COMANDO_QUE_MEDIRIA_O_AMBIENTE_REAL="setfacl -m u:\$(id -un):r <arquivo> (sob sudo, na janela assistida), rodar esta bateria e desfazer com setfacl -x"

# O estado da árvore versionada no início da bateria — o CT-1124 compara contra
# ele. Comparar contra VAZIO reprovaria toda execução feita com trabalho em curso,
# que é o estado normal de quem desenvolve. ⚠️ E o simétrico também vale, e custou
# uma reprovação real: a árvore LIMPA é o estado de todo clone novo e de toda
# execução logo após um commit, e ela torna esta global a string vazia — por isso
# a comparação passa por `linhas_do_estado`, e o antivácuo do caso afirma que HÁ
# repositório, nunca que HÁ sujeira.
ESTADO_GIT_INICIAL=""

# O arquivo que o controle positivo do CT-1124 planta na árvore de trabalho.
# Registrado em global porque o `trap limpar` precisa alcançá-lo: é o único ponto
# desta bateria que escreve fora da caixa de areia, e ele existe justamente para
# provar que a comparação detecta quem faz isso.
ARQUIVO_PLANTADO_NA_ARVORE=""

DIR_TRABALHO=""
DIR_BIN_PG=""
INSTANCIAS_ATIVAS=()

# A sentinela e o valor da chave nascem com nonce a CADA execução.
#
# ⚠️ Sentinela fixa acaba commitada numa fixture, e a varredura seguinte casa
# consigo mesma: o caso fica verde por encontrar o próprio literal, e não por o
# produto estar limpo.
SENHA_SENTINELA=""
CHAVE_SENTINELA=""

# Ligado quando a raiz REAL dos segredos não pôde ser lida — governa o código 2,
# nunca o veredito dos casos.
PRECONDICAO_PRIVILEGIADA_AUSENTE=0

# O token de confirmação, LIDO do alvo da restauração — nunca reescrito aqui.
TOKEN_DO_ALVO=""

# O nonce desta execução, que compõe os nomes de base do CT-1112. Ele existe
# para que a contagem no diário do servidor seja atribuível A ESTA execução: um
# nome fixo tornaria a agulha indistinguível da de uma execução anterior que
# tivesse deixado registro no mesmo arquivo.
NONCE_DA_EXECUCAO=""

# As duas cópias que os casos da T3 restauram, ambas produzidas pelo ALVO DA T2.
# Usar o produtor real, e não um `pg_dump` avulso, é o que amarra as duas tasks:
# uma cópia que a T2 publique e a T3 não consiga restaurar reprova aqui.
COPIA_PRINCIPAL=""
COPIA_VOLUMOSA=""

# --------------------------------------------------------------------------- #
# O que a T5 LÊ do alvo em vez de reescrever — ver a razão em
# `ler_constante_do_alvo`. Preenchidas no arranjo de `main`.
# --------------------------------------------------------------------------- #
PREFIXO_DA_COPIA_DO_ALVO=""
SUFIXO_DA_COPIA_DO_ALVO=""
RAIZ_DAS_COPIAS_DO_ALVO=""
SUBDIRETORIO_DAS_COPIAS_DO_ALVO=""

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# Fora do esqueleto compartilhado — ver a razão medida no cabeçalho de
# `deploy/scripts/verificacao/esqueleto-de-assercao.sh`. ⚠️ **Esta cópia É o mesmo
# símbolo das outras duas de comparação de STRING**, e a unificação está ADIADA,
# não descartada: o que a impede é o quarto homônimo, o de `verificar-captura.sh`,
# que recebe um ARQUIVO e grepa. Conte as cópias ao abrir este ponto — são quatro,
# três idênticas e uma divergente. Ler "não são o mesmo símbolo" e parar de contar
# é exatamente o mecanismo que produziu o `D9 · F0/T2`.
afirmar_contem() {
	if [[ "$3" == *"$2"* ]]; then
		ok "$1"
	else
		falhar "$1 — não encontrei [$2] na saída"
	fi
}

limpar() {
	local codigo=$?
	local instancia
	# O único ponto desta bateria que escreve fora da caixa de areia é o controle
	# positivo do CT-1124, e ele existe justamente para provar que a comparação
	# detecta quem faz isso. Se o script morrer no meio dele, o arquivo sai aqui.
	if [[ -n "${ARQUIVO_PLANTADO_NA_ARVORE}" && -e "${ARQUIVO_PLANTADO_NA_ARVORE}" ]]; then
		rm -f "${ARQUIVO_PLANTADO_NA_ARVORE}"
	fi
	for instancia in "${INSTANCIAS_ATIVAS[@]:-}"; do
		[[ -n "${instancia}" ]] || continue
		if [[ -n "${DIR_BIN_PG}" && -d "${instancia}" ]]; then
			"${DIR_BIN_PG}/pg_ctl" -D "${instancia}" -m immediate stop >/dev/null 2>&1 || true
		fi
	done
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	return "${codigo}"
}
trap limpar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# --------------------------------------------------------------------------- #
# Infraestrutura: instâncias próprias de banco, sem privilégio.
# --------------------------------------------------------------------------- #
localizar_binarios_do_banco() {
	local candidato
	if candidato="$(pg_config --bindir 2>/dev/null)" && [[ -x "${candidato}/initdb" ]]; then
		DIR_BIN_PG="${candidato}"
		return 0
	fi
	# O empacotamento da distribuição não põe `initdb` e `pg_ctl` no PATH — eles
	# vivem no diretório da versão. A ordem reversa pega a mais nova.
	for candidato in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -Vr); do
		if [[ -x "${candidato}/initdb" && -x "${candidato}/pg_ctl" ]]; then
			DIR_BIN_PG="${candidato}"
			return 0
		fi
	done
	if candidato="$(command -v initdb 2>/dev/null)"; then
		DIR_BIN_PG="$(dirname "${candidato}")"
		return 0
	fi
	return 1
}

porta_livre() {
	local porta intocavel proibida
	for ((porta = PORTA_INICIAL; porta <= PORTA_FINAL; porta++)); do
		proibida=0
		for intocavel in "${PORTAS_INTOCAVEIS[@]}"; do
			if [[ "${porta}" -eq "${intocavel}" ]]; then
				proibida=1
				break
			fi
		done
		[[ "${proibida}" -eq 1 ]] && continue
		if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
			printf '%s' "${porta}"
			return 0
		fi
	done
	return 1
}

# Sobe uma instância própria e devolve a porta em ${PORTA_DA_INSTANCIA} e o
# diretório de dados em ${DADOS_DA_INSTANCIA}.
#
# O resultado sai por variável, e não pela saída padrão, porque substituição de
# comando roda em subshell: o registro em ${INSTANCIAS_ATIVAS} se perderia com
# ele, e o `trap` deixaria um cluster de pé depois da bateria.
#
# $1 = nome (compõe o diretório) · $2 = a credencial da instância
PORTA_DA_INSTANCIA=""
DADOS_DA_INSTANCIA=""
ARQ_AMBIENTE_DA_INSTANCIA=""
subir_instancia() {
	local nome="$1" credencial="$2"
	local base="${DIR_TRABALHO}/instancias/${nome}"
	local dados="${base}/dados"
	local porta
	PORTA_DA_INSTANCIA=""
	DADOS_DA_INSTANCIA=""
	ARQ_AMBIENTE_DA_INSTANCIA=""
	porta="$(porta_livre)" || return 1

	mkdir -p "${base}"
	local arq_credencial="${base}/credencial"
	install -m 0600 /dev/null "${arq_credencial}"
	printf '%s' "${credencial}" >"${arq_credencial}"

	"${DIR_BIN_PG}/initdb" -D "${dados}" -U verificacao -A scram-sha-256 \
		--pwfile="${arq_credencial}" --no-sync -E UTF8 >"${base}/initdb.log" 2>&1 || return 1

	"${DIR_BIN_PG}/pg_ctl" -D "${dados}" \
		-o "-p ${porta} -h 127.0.0.1 -k ${base}" -l "${base}/servidor.log" -w start \
		>"${base}/pg_ctl.log" 2>&1 || return 1

	INSTANCIAS_ATIVAS+=("${dados}")

	# Sondagem por estado observável, com limite declarado — nunca espera fixa.
	local decorrido=0
	until "${DIR_BIN_PG}/pg_isready" -h 127.0.0.1 -p "${porta}" -q >/dev/null 2>&1; do
		if [[ "${decorrido}" -ge "${LIMITE_SUBIDA_S}" ]]; then
			return 1
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done

	local arq_pgpass="${base}/pgpass"
	install -m 0600 /dev/null "${arq_pgpass}"
	printf '127.0.0.1:%s:postgres:verificacao:%s\n' "${porta}" "${credencial}" >"${arq_pgpass}"

	ARQ_AMBIENTE_DA_INSTANCIA="${base}/ambiente.env"
	install -m 0600 /dev/null "${ARQ_AMBIENTE_DA_INSTANCIA}"
	printf 'DATABASE_URL=postgresql://verificacao:%s@127.0.0.1:%s/postgres\n' \
		"${credencial}" "${porta}" >"${ARQ_AMBIENTE_DA_INSTANCIA}"

	PORTA_DA_INSTANCIA="${porta}"
	DADOS_DA_INSTANCIA="${dados}"
	PGPASS_DA_INSTANCIA="${arq_pgpass}"
}

PGPASS_DA_INSTANCIA=""
consultar() {
	local porta="$1" comando="$2"
	PGPASSFILE="${PGPASS_DA_INSTANCIA}" psql -X -q -A -t -w \
		-h 127.0.0.1 -p "${porta}" -U verificacao -d postgres -c "${comando}"
}

derrubar_instancia() {
	"${DIR_BIN_PG}/pg_ctl" -D "$1" -m immediate stop >/dev/null 2>&1 || true
}

# Credencial no alfabeto que o provisionamento gera: letras e números apenas,
# porque ela viaja DENTRO de uma cadeia de conexão, onde os demais caracteres são
# delimitadores. O nonce vem do gerador de aleatoriedade do sistema.
gerar_nonce_alfanumerico() {
	head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-"${1:-24}"
}

# --------------------------------------------------------------------------- #
# A sentinela que marca a raiz como acervo da rotina de cópia.
#
# O nome é LIDO do alvo, e não reescrito aqui: reescrevê-lo poria o alvo sob
# prova nos dois lados da comparação, e a asserção não poderia falhar — a mesma
# razão pela qual o CT-1100 lê o prazo de guarda de lá.
#
# O arranjo dos casos de expurgo precisa marcá-la porque o modo `expurgar` NÃO
# passa por `preparar_destino`: quem grava a sentinela é o modo `copiar`.
# --------------------------------------------------------------------------- #
NOME_DA_SENTINELA=""
marcar_acervo() {
	install -m 0600 /dev/null "$1/${NOME_DA_SENTINELA}"
	printf 'acervo montado pela verificação\n' >"$1/${NOME_DA_SENTINELA}"
}

# --------------------------------------------------------------------------- #
# Acessórios de medição do sistema de arquivos.
# --------------------------------------------------------------------------- #
contar_por_padrao() {
	find "$1" -maxdepth 1 -type f -name "$2" 2>/dev/null | grep -c . || true
}

listar_nomes() {
	find "$1" -maxdepth 1 -type f -printf '%P\n' 2>/dev/null |
		LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}

modo_de() { stat -c '%a' "$1" 2>/dev/null || printf 'ausente'; }

# A FORMA do item, e não apenas a existência dele: é o que separa "a sentinela
# não foi gravada" de "a sentinela que já estava lá continua sendo o que era".
# `-L` vem PRIMEIRO porque `-e`, `-d` e `-f` seguem o vínculo — a mesma razão pela
# qual a entrada única do alvo testa nessa ordem.
forma_do_caminho() {
	if [[ -L "$1" ]]; then
		printf 'vinculo'
	elif [[ ! -e "$1" ]]; then
		printf 'ausente'
	elif [[ -d "$1" ]]; then
		printf 'diretorio'
	elif [[ -p "$1" ]]; then
		printf 'fifo'
	elif [[ -f "$1" ]]; then
		printf 'arquivo'
	else
		printf 'outro'
	fi
}

# Executa um alvo capturando os dois canais e o código, sem deixar `set -e`
# abortar a bateria quando o alvo reprova de propósito.
CODIGO_DO_ALVO=0
executar_alvo() {
	local saida="$1" erro="$2"
	shift 2
	CODIGO_DO_ALVO=0
	"$@" >"${saida}" 2>"${erro}" || CODIGO_DO_ALVO=$?
}

# Monta uma raiz de segredos de mentira, no formato da real: os arquivos de
# ambiente que as unidades de serviço consomem, com a chave de cifra declarada.
#
# $1 = caminho da raiz · $2 = o valor da chave de cifra a declarar
montar_raiz_de_segredos() {
	local raiz="$1" chave="$2"
	mkdir -p "${raiz}"
	chmod 700 "${raiz}"

	install -m 0600 /dev/null "${raiz}/backend.env"
	printf 'DATABASE_URL=postgresql://verificacao:%s@127.0.0.1:%s/postgres\n%s=%s\nOUTRA_COISA=valor-inerte\n' \
		"${SENHA_SENTINELA}" "${PORTA_PRINCIPAL}" "${NOME_DA_CHAVE}" "${chave}" >"${raiz}/backend.env"

	install -m 0600 /dev/null "${raiz}/migracao.env"
	printf 'DATABASE_URL=postgresql://migracao:%s@127.0.0.1:%s/postgres\n' \
		"${SENHA_SENTINELA}" "${PORTA_PRINCIPAL}" >"${raiz}/migracao.env"
}

# Conta as linhas de DADOS de uma cópia, atravessando o arquivo inteiro. É o que
# separa "a cópia lista três tabelas" de "a cópia carrega as sete linhas".
contar_linhas_de_dados() {
	pg_restore -f - "$1" 2>/dev/null |
		awk '/^COPY /{dentro=1;next} dentro && /^\\\.$/{dentro=0;next} dentro{n++} END{print n+0}'
}

# --------------------------------------------------------------------------- #
# A varredura do CT-1102 — UMA função, aplicada ao pacote real e ao de controle.
#
# Ela EXTRAI o pacote e procura o valor no conteúdo de cada membro. Devolve os
# membros que o contêm, um por linha, e status 1 quando encontra algum — o status
# é parte do contrato: uma varredura que apenas imprimisse ficaria verde sobre o
# controle. O valor chega por parâmetro e nunca é impresso.
#
# Duas funções parecidas provariam que duas implementações concordam, não que
# esta discrimina.
# --------------------------------------------------------------------------- #
varrer_pacote_por_valor() {
	local pacote="$1" valor="$2"
	local area
	area="$(mktemp -d -p "${DIR_TRABALHO}")"

	tar -xzf "${pacote}" -C "${area}" >/dev/null 2>&1 || true

	local achados
	achados="$(grep -rlF -e "${valor}" "${area}" 2>/dev/null | sed "s|^${area}/||" | LC_ALL=C sort || true)"

	rm -rf "${area}"

	if [[ -z "${achados}" ]]; then
		return 0
	fi

	printf '%s\n' "${achados}"
	return 1
}

membros_do_pacote() {
	tar -tzf "$1" 2>/dev/null | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}

# --------------------------------------------------------------------------- #
# A varredura do CT-1104 — UMA função, aplicada aos canais reais e aos de
# controle. Devolve os canais em que a agulha aparece, na ordem da declaração,
# separados por espaço; status 1 quando achou algum.
# --------------------------------------------------------------------------- #
varrer_canais() {
	local diretorio="$1" agulha="$2"
	local canal achados=""

	for canal in "${CANAIS_DE_SAIDA[@]}"; do
		if [[ -f "${diretorio}/${canal}" ]] && grep -qF -e "${agulha}" "${diretorio}/${canal}"; then
			achados="${achados}${achados:+ }${canal}"
		fi
	done

	printf '%s' "${achados}"
	[[ -z "${achados}" ]]
}

# --------------------------------------------------------------------------- #
# A auditoria do CT-1105 — UMA função, aplicada aos scripts reais e ao mutante.
#
# ⚠️ Reimplementá-la para o mutante aprovaria 2/2 um alvo com o defeito de volta:
# o que se prova é que ESTA auditoria discrimina, não que duas concordam.
#
# Devolve uma linha por ocorrência, no formato `<forma>:<linha>:<trecho>`, e
# status 1 quando encontra alguma. Os padrões são escritos com classe de
# caractere onde precisam: sem isso, o texto desta própria bateria casaria com
# eles se ela fosse auditada.
# --------------------------------------------------------------------------- #
auditar_credencial_em_argv() {
	local script="$1"
	local -a achados=()
	local linha

	# (a) segredo viajando por argumento de linha de comando — qualquer usuário da
	#     máquina o leria na tabela de processos.
	while IFS= read -r linha; do
		achados+=("${FORMA_ARGUMENTO}:${linha}")
	done < <(grep -nE -- '--(password|dbpassword)[= ]' "${script}" || true)

	# (b) segredo em variável de ambiente exportada — todo processo filho a herda.
	#     O padrão vai com classe de caractere para que esta própria linha não case.
	while IFS= read -r linha; do
		achados+=("${FORMA_AMBIENTE}:${linha}")
	done < <(grep -nE 'PGPASS[W]ORD[=]' "${script}" || true)

	# (c) cadeia de conexão com segredo embutido. Marcador de documentação NÃO é
	#     credencial: o cabeçalho precisa mostrar o formato aceito.
	while IFS= read -r linha; do
		achados+=("${FORMA_CADEIA}:${linha}")
	done < <(grep -nE "postgres(ql)?://[^[:space:]\"']*:[^[:space:]\"'@/]+@" "${script}" |
		grep -vE ":(${MARCADORES_DE_DOCUMENTACAO})@" || true)

	# (d) rastreio verboso de comandos — ele ecoaria o segredo no diário do sistema.
	while IFS= read -r linha; do
		achados+=("${FORMA_RASTREIO}:${linha}")
	done < <(grep -nE 'set[[:space:]]+-x|set[[:space:]]+-o[[:space:]]+xtrace' "${script}" || true)

	if [[ "${#achados[@]}" -eq 0 ]]; then
		return 0
	fi

	printf '%s\n' "${achados[@]}"
	return 1
}

contar_referencias_ao_arquivo_de_credencial() {
	grep -cF "${REFERENCIA_AO_ARQUIVO_DE_CREDENCIAL}" "$1" || true
}

contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# --------------------------------------------------------------------------- #
# A auditoria do CT-1100 (f) — quantos ramos de recusa a entrada única do alvo
# tem HOJE, lidos do FONTE.
#
# ⚠️ É ela que amarra a enumeração daquele caso ao alvo. Enquanto a tabela do
# docblock e o array `RAMOS_DA_RECUSA` eram a única "garantia", um sexto
# `recusar_raiz_alheia` instalado em `afirmar_propriedade_da_raiz` deixava a
# bateria inteira em 226 OK e 0 FALHA: nenhum dos dois lê `${SCRIPT_COPIAR}`.
#
# O recorte é o CORPO da função, do cabeçalho até o `}` da coluna 1 — fora dele
# moram a definição de `recusar_raiz_alheia` e as menções dos comentários, que
# não são ramos.
#
# Função não encontrada devolve string VAZIA, nunca `0`: zero seria
# indistinguível de "a entrada única existe e não recusa em ramo algum", e a
# igualdade contra a enumeração precisa reprovar nos dois casos. É o que impede
# uma renomeação de deixar a amarra muda.
#
# A contagem é de OCORRÊNCIAS (`gsub`), não de linhas: dois ramos escritos na
# mesma linha contam dois.
# --------------------------------------------------------------------------- #
contar_recusas_da_entrada_unica() {
	awk '
		/^afirmar_propriedade_da_raiz\(\) \{$/ { dentro = 1; next }
		dentro && /^\}$/ { print total + 0; achou = 1; exit }
		dentro { total += gsub(/recusar_raiz_alheia/, "&") }
		END { if (!achou) print "" }
	' "$1"
}

# =========================================================================== #
# Acessórios da T3 — a restauração.
#
# Eles nascem aqui, e não numa cópia dentro de cada caso, porque a `CLAUDE.md`
# é explícita: acessório de suíte se importa, não se copia. Os casos da T3
# precisam de bases próprias no MESMO agrupamento efêmero, e o arranjo é o
# mesmo em todos.
# =========================================================================== #

# O arquivo de credencial que alcança QUALQUER base do agrupamento efêmero. O
# `pgpass` que `subir_instancia` grava tem o nome da base fixado em `postgres`,
# e os casos da T3 falam com as bases de destino que eles mesmos criam.
ARQ_PGPASS_GERAL=""

# O diário do servidor da instância principal. É por ele que o `CT-1112` mede o
# que nenhuma outra observação alcança: se o alvo CHEGOU A ABRIR conexão com o
# destino recusado. O caminho é o que `subir_instancia` compõe.
LOG_DO_SERVIDOR_PRINCIPAL=""

# Limite de tempo de cada execução de alvo da T3. Ele existe porque dois casos
# medem que o alvo NÃO BLOQUEIA esperando a entrada padrão: sem limite, um alvo
# que bloqueasse penduraria a bateria inteira em vez de reprovar. `timeout`
# devolve 124 quando o limite estoura, e 124 é afirmado como desfecho distinto
# da recusa legítima.
readonly LIMITE_DO_ALVO_S=180

# Consulta contra uma base NOMEADA do agrupamento efêmero.
consultar_base() {
	local base="$1" comando="$2"
	PGPASSFILE="${ARQ_PGPASS_GERAL}" psql -X -q -A -t -w \
		-h 127.0.0.1 -p "${PORTA_PRINCIPAL}" -U verificacao -d "${base}" -c "${comando}"
}

criar_base_vazia() {
	consultar_base postgres "CREATE DATABASE $1" >/dev/null
}

# O conjunto de relações de uma base, na forma `esquema.nome`, separado por
# espaço. É a mesma pergunta que o alvo faz ao conferir — feita aqui contra o
# CATÁLOGO, que é o estado observável, e não contra o texto do alvo.
relacoes_da_base() {
	consultar_base "$1" "
		SELECT n.nspname || '.' || c.relname
		  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE c.relkind IN ('r','p','S','v','m')
		   AND n.nspname NOT IN ('pg_catalog','information_schema')
		 ORDER BY 1" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}

contar_relacoes_da_base() {
	consultar_base "$1" "
		SELECT count(*)
		  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE c.relkind IN ('r','p','S','v','m')
		   AND n.nspname NOT IN ('pg_catalog','information_schema')"
}

# A soma das linhas de todas as tabelas de uma base.
contar_linhas_da_base() {
	consultar_base "$1" "
		SELECT coalesce(sum(linhas), 0)::text FROM (
		  SELECT (xpath('/row/c/text()',
		           query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
		                        false, true, '')))[1]::text::bigint AS linhas
		    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		   WHERE c.relkind IN ('r','p') AND c.relispartition = false
		     AND n.nspname NOT IN ('pg_catalog','information_schema')
		) t"
}

# Um arquivo de ambiente no formato que o alvo consome, apontando para uma base
# do agrupamento efêmero. É o MESMO parâmetro documentado (`SYSLOC_ARQ_AMBIENTE`)
# que a operação usa — a caixa de areia faz o papel do arquivo de /etc, sem que
# nenhum símbolo de produção seja criado ou alargado para isso.
escrever_ambiente_para() {
	local base="$1" arquivo="$2"
	install -m 0600 /dev/null "${arquivo}"
	printf 'DATABASE_URL=postgresql://verificacao:%s@127.0.0.1:%s/%s\n' \
		"${SENHA_SENTINELA}" "${PORTA_PRINCIPAL}" "${base}" >"${arquivo}"
}

# Executa o alvo alimentando a entrada padrão, sob limite de tempo.
#
# `FECHADA` no lugar do arquivo fecha o descritor em vez de ligá-lo a /dev/null:
# a diferença é conteúdo, porque um alvo que leia de /dev/null recebe fim de
# arquivo imediato, e o que os casos do ensaio querem provar é que ele não lê.
executar_alvo_com_entrada() {
	local entrada="$1" saida="$2" erro="$3"
	shift 3
	CODIGO_DO_ALVO=0
	if [[ "${entrada}" == "FECHADA" ]]; then
		timeout "${LIMITE_DO_ALVO_S}" "$@" 0<&- >"${saida}" 2>"${erro}" || CODIGO_DO_ALVO=$?
	else
		timeout "${LIMITE_DO_ALVO_S}" "$@" <"${entrada}" >"${saida}" 2>"${erro}" || CODIGO_DO_ALVO=$?
	fi
}

# Roda o alvo da restauração contra uma base de destino, com a confirmação
# vinda de um arquivo. Devolve por ${CODIGO_DO_ALVO}, ${SAIDA_DA_RESTAURACAO} e
# ${ERRO_DA_RESTAURACAO}.
SAIDA_DA_RESTAURACAO=""
ERRO_DA_RESTAURACAO=""
executar_restauracao() {
	local rotulo="$1" ambiente="$2" destino="$3" copia="$4" modo="$5" entrada="$6"
	local base="${DIR_TRABALHO}/${rotulo}"
	mkdir -p "$(dirname "${base}")"
	SAIDA_DA_RESTAURACAO="${base}.out"
	ERRO_DA_RESTAURACAO="${base}.err"

	executar_alvo_com_entrada "${entrada}" "${SAIDA_DA_RESTAURACAO}" "${ERRO_DA_RESTAURACAO}" env \
		SYSLOC_ARQ_AMBIENTE="${ambiente}" \
		SYSLOC_BANCO_DE_DESTINO="${destino}" \
		bash "${SCRIPT_RESTAURAR}" "${copia}" "${modo}"
}

# Um arquivo com a resposta a ser entregue à confirmação. O conteúdo chega cru:
# `RESTAURAR ` com espaço a mais precisa CHEGAR com o espaço.
escrever_resposta() {
	printf '%s\n' "$2" >"$1"
}

# As entradas do índice de uma cópia, como conjunto ordenado numa linha só.
entradas_do_indice() {
	pg_restore -l "$1" 2>/dev/null | grep -E '^[0-9]' | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}

# As entradas do índice que o ALVO exibiu, extraídas da saída dele. A extração é
# do texto que saiu — não uma segunda implementação da decisão do alvo.
entradas_exibidas_pelo_alvo() {
	sed -nE 's/^[[:space:]]+([0-9]+; .*)$/\1/p' "$1" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//'
}

# Quantas vezes o diário do servidor registrou uma tentativa de conexão a uma
# base pelo nome. `grep` é tratado pela FAIXA: 1 é "não achou" e é desfecho
# normal; acima disso o arquivo não pôde ser lido, e aí a contagem não se afirma.
tentativas_de_conexao_a() {
	local agulha="$1" total="" codigo=0
	total="$(grep -cF "database \"${agulha}\" does not exist" "${LOG_DO_SERVIDOR_PRINCIPAL}" 2>/dev/null)" ||
		codigo=$?
	if [[ "${codigo}" -gt 1 ]]; then
		printf 'ilegivel'
		return
	fi
	printf '%s' "${total}"
}

# --------------------------------------------------------------------------- #
# A auditoria do CT-1112 — UMA função, aplicada ao alvo e aos mutantes.
#
# ⚠️ Reimplementá-la para o mutante aprovaria 2/2 um alvo com o defeito de volta:
# o que se prova é que ESTA auditoria discrimina, não que duas concordam. É o
# molde já provado do CT-1105 e do CT-1100 (f).
#
# Ela pergunta uma coisa só: no corpo de `main`, a guarda da ADR-0006 é
# consultada ANTES de qualquer chamada que alcance o destino?
#
# O conjunto do que "alcança o destino" é DERIVADO do fonte, e não listado: a
# semente são as funções cujo corpo entrega `--dbname=` a um cliente, e a
# propagação inclui toda função que chame uma delas, iterando até estabilizar.
# Uma lista literal envelheceria no dia em que uma função nova falasse com o
# destino — que é exatamente o dia em que esta auditoria precisa acusar.
#
# Devolve uma linha por anomalia, no formato `<forma>:<linha>:<símbolo>`, e
# status 1 quando encontra alguma.
# --------------------------------------------------------------------------- #
readonly GUARDA_DA_ADR_0006="recusar_destino_da_operacao"

auditar_guarda_antes_do_destino() {
	awk -v guarda="${GUARDA_DA_ADR_0006}" '
		# --- corpo de cada função, com o número ABSOLUTO da linha ------------- #
		/^[a-z_]+\(\) \{$/ {
			atual = substr($0, 1, index($0, "(") - 1)
			nomes[atual] = 1
			next
		}
		atual != "" && /^\}$/ { atual = ""; next }
		atual != "" {
			# Linha de comentário NÃO entra no corpo. Sem isto, a frase "restaurar
			# contra um agrupamento…", escrita num comentário de `extrair_url_do_arquivo`,
			# fazia aquela função ser classificada como quem alcança o destino — e a
			# auditoria acusava a leitura do arquivo de ambiente como se fosse conexão.
			if ($0 ~ /^[\t ]*#/) { next }
			corpo[atual] = corpo[atual] "\n" $0
			if ($0 ~ /--dbname=/) { alcanca[atual] = 1 }
			if (atual == "main") { linhas[++total] = NR; textos[total] = $0 }
			next
		}

		END {
			# Propagação até estabilizar: quem chama quem alcança, alcança.
			#
			# ⚠️ `f in alcanca` e NUNCA `alcanca[f]`: referenciar um elemento CRIA-O
			# em awk, e a forma indexada punha toda função conhecida dentro de
			# `alcanca` com valor vazio — a varredura seguinte então propagava a
			# partir de qualquer nome, e a auditoria acusava `conferir_invocacao` e
			# `ler_conexao_da_operacao`, que não falam com o destino.
			#
			# Os recém-descobertos entram numa lista à parte e só são aplicados
			# depois da varredura: alterar `alcanca` durante `for (g in alcanca)` é
			# comportamento indefinido.
			mudou = 1
			while (mudou) {
				mudou = 0
				delete novos
				for (f in nomes) {
					if (f in alcanca) { continue }
					for (g in alcanca) {
						# A chamada é reconhecida no INÍCIO da linha, depois da
						# indentação: é como um statement de shell invoca uma função.
						# Menção dentro de uma cadeia de texto — "…para restaurar de
						# verdade" — não é invocação, e contá-la marcaria como conexão
						# toda função cuja mensagem cite outra.
						if (corpo[f] ~ ("(^|\n)[\t ]*" g "([^A-Za-z0-9_]|$)")) {
							novos[f] = 1
							mudou = 1
							break
						}
					}
				}
				for (f in novos) { alcanca[f] = 1 }
			}

			# A linha da guarda no corpo de `main`.
			linha_da_guarda = 0
			for (i = 1; i <= total; i++) {
				if (textos[i] ~ ("^[\t ]*" guarda "([^A-Za-z0-9_]|$)")) {
					linha_da_guarda = linhas[i]
					break
				}
			}

			if (linha_da_guarda == 0) {
				print "guarda-ausente-em-main:0:" guarda
				exit 1
			}

			# ÂNCORA ANTIVÁCUO da própria auditoria: se nada em `main` alcança o
			# destino, não há ordem a auditar e o verde acima seria vácuo.
			achou_alcance = 0
			achados = 0
			for (i = 1; i <= total; i++) {
				for (g in alcanca) {
					if (g == "main") { continue }
					if (textos[i] ~ ("^[\t ]*" g "([^A-Za-z0-9_]|$)")) {
						achou_alcance = 1
						if (linhas[i] < linha_da_guarda) {
							print "destino-antes-da-guarda:" linhas[i] ":" g
							achados++
						}
					}
				}
			}
			if (!achou_alcance) {
				print "nada-em-main-alcanca-o-destino:0:main"
				achados++
			}
			exit (achados > 0 ? 1 : 0)
		}
	' "$1"
}

# =========================================================================== #
# CT-1098 — a cópia nasce em formato de restauração seletiva e só então vira a
# do dia.
#
# INVARIANTE: arquivo que não atravessa a conferência NUNCA recebe o nome do dia,
# e a cópia publicada carrega o que foi semeado.
# =========================================================================== #
ct_1098() {
	caso "CT-1098" "a cópia nasce em formato de restauração seletiva e só então vira a do dia"

	local raiz="${DIR_TRABALHO}/ct-1098"
	mkdir -p "${raiz}"
	local saida="${DIR_TRABALHO}/ct-1098.out" erro="${DIR_TRABALHO}/ct-1098.err"

	executar_alvo "${saida}" "${erro}" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
		bash "${SCRIPT_COPIAR}"

	afirmar_igual "a cópia termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${erro}" >&2 || true
		fechar_caso "CT-1098"
		return
	fi

	local diario="${raiz}/daily"
	local nome_do_dia
	nome_do_dia="base-$(date +%F).dump"

	# Igualdade de CONJUNTO: o destino tem exatamente a cópia do dia, e nada mais.
	# Contenção deixaria passar o resíduo ao lado dela.
	afirmar_igual "o destino tem exatamente a cópia do dia" \
		"${nome_do_dia}" "$(listar_nomes "${diario}")"
	afirmar_igual "exatamente um arquivo com o nome do dia" \
		"1" "$(contar_por_padrao "${diario}" "${nome_do_dia}")"
	afirmar_igual "nenhum resíduo .parcial ficou para trás" \
		"0" "$(contar_por_padrao "${diario}" '*.parcial')"

	local copia="${diario}/${nome_do_dia}"

	afirmar_igual "a assinatura é a do formato de restauração seletiva" \
		"PGDMP" "$(head -c 5 "${copia}")"

	local listagem="${DIR_TRABALHO}/ct-1098.listagem"
	local codigo_da_listagem=0
	pg_restore -l "${copia}" >"${listagem}" 2>/dev/null || codigo_da_listagem=$?
	local entradas
	entradas="$(grep -cE '^[0-9]' "${listagem}" || true)"

	afirmar_igual "a listagem do conteúdo sai 0" "0" "${codigo_da_listagem}"
	if [[ "${entradas}" -ge 1 ]]; then
		ok "a listagem devolve ${entradas} entrada(s) — pelo menos uma"
	else
		falhar "a listagem não devolveu entrada nenhuma — o verde acima seria vácuo"
	fi

	# ADR-0006, na forma POSITIVA: a variável de conexão do ambiente aponta para
	# um destino impossível durante toda esta bateria, e a cópia saiu mesmo assim
	# da instância efêmera. A prova não é o código de saída — é o CONTEÚDO: as três
	# tabelas e as sete linhas só existem lá.
	afirmar_igual "as três tabelas semeadas estão na cópia" \
		"a b c" \
		"$(pg_restore -l "${copia}" 2>/dev/null | sed -nE 's/.*TABLE DATA public ([a-z]+) .*/\1/p' |
			LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "as sete linhas semeadas estão na cópia" \
		"7" "$(contar_linhas_de_dados "${copia}")"
	afirmar_diferente "a variável de conexão do ambiente aponta para destino impossível" \
		"" "${DATABASE_URL}"

	fechar_caso "CT-1098"
}

# =========================================================================== #
# CT-1099 — cópia interrompida não é publicada nem deixa resíduo.
#
# INVARIANTE: a cópia do dia OU EXISTE ÍNTEGRA OU NÃO EXISTE.
#
# A interrupção é obtida DERRUBANDO A INSTÂNCIA, e não editando o alvo: o que se
# quer provar é o comportamento do procedimento real diante de uma falha real.
# =========================================================================== #
ct_1099() {
	caso "CT-1099" "cópia interrompida não é publicada nem deixa resíduo"

	local credencial
	credencial="$(gerar_nonce_alfanumerico 24)"
	if ! subir_instancia "interrupcao" "${credencial}"; then
		falhar "não consegui levantar a instância própria do CT-1099"
		fechar_caso "CT-1099"
		return
	fi

	local dados="${DADOS_DA_INSTANCIA}" ambiente="${ARQ_AMBIENTE_DA_INSTANCIA}"
	local porta="${PORTA_DA_INSTANCIA}"

	consultar "${porta}" \
		"CREATE TABLE volumosa(t text); INSERT INTO volumosa SELECT md5(g::text) || md5((g + 1)::text) FROM generate_series(1, ${LINHAS_DA_TABELA_VOLUMOSA}) g;" \
		>/dev/null

	local raiz="${DIR_TRABALHO}/ct-1099"
	mkdir -p "${raiz}"
	local saida="${DIR_TRABALHO}/ct-1099.out" erro="${DIR_TRABALHO}/ct-1099.err"
	local arq_codigo="${DIR_TRABALHO}/ct-1099.codigo"

	local nome_do_dia
	nome_do_dia="base-$(date +%F).dump"
	local parcial="${raiz}/daily/${nome_do_dia}.parcial"

	(
		codigo=0
		env SYSLOC_ARQ_AMBIENTE="${ambiente}" SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
			bash "${SCRIPT_COPIAR}" >"${saida}" 2>"${erro}" || codigo=$?
		printf '%s' "${codigo}" >"${arq_codigo}"
	) &
	local trabalho=$!

	# Sondagem por estado observável, com limite nomeado — nunca espera fixa.
	local iteracoes=0
	while [[ ! -e "${parcial}" ]]; do
		sleep "${INTERVALO_DA_SONDAGEM_S}"
		iteracoes=$((iteracoes + 1))
		if [[ "${iteracoes}" -ge "${LIMITE_DA_SONDAGEM}" ]]; then
			break
		fi
	done

	derrubar_instancia "${dados}"
	wait "${trabalho}" || true

	if [[ "${iteracoes}" -ge "${LIMITE_DA_SONDAGEM}" ]]; then
		falhar "o intermediário nunca apareceu em ${LIMITE_DA_SONDAGEM} sondagens — a interrupção não aconteceu no meio da cópia, e o que segue não prova o invariante"
		fechar_caso "CT-1099"
		return
	fi
	nota "o intermediário apareceu na sondagem ${iteracoes} e a instância foi derrubada em seguida"

	afirmar_igual "a cópia interrompida termina com código de falha" \
		"1" "$(cat "${arq_codigo}")"
	afirmar_igual "nenhum arquivo com o nome do dia foi publicado" \
		"0" "$(contar_por_padrao "${raiz}/daily" "${nome_do_dia}")"
	afirmar_igual "nenhum resíduo .parcial ficou para trás" \
		"0" "$(contar_por_padrao "${raiz}/daily" '*.parcial')"
	afirmar_igual "o destino ficou vazio" "" "$(listar_nomes "${raiz}/daily")"
	afirmar_contem "a saída de erro nomeia a conferência reprovada" \
		"conferência de integridade" "$(cat "${erro}")"

	fechar_caso "CT-1099"
}

# =========================================================================== #
# CT-1100 — o expurgo decide POR IDADE, e o par de nomes trocados é o que
# discrimina.
#
# INVARIANTE: o expurgo remove exatamente as cópias que passaram do prazo e
# mantém as demais; O NOME NÃO PARTICIPA DA DECISÃO.
#
# ⚠️ As quatro entradas NÃO se colapsam. O par de nomes trocados prova o EIXO da
# decisão (um filtro por nome, ou por extensão, erra os dois); o par de fronteira
# prova a BORDA (um prazo de 13 ou de 15 dias erra um dos dois). Uma prova sem a
# outra deixa metade do defeito passar — foi assim que o `CT-1087 (f)` nasceu, na
# rodada 2 de um gate.
# =========================================================================== #
ct_1100() {
	caso "CT-1100" "o expurgo decide por idade, nunca por nome nem por extensão"

	# O prazo é LIDO do alvo, e não reescrito aqui: reescrevê-lo poria o alvo sob
	# prova nos dois lados da comparação, e a asserção não poderia falhar.
	local prazo
	prazo="$(sed -n 's|^readonly PRAZO_DE_GUARDA_EM_DIAS=||p' "${SCRIPT_COPIAR}" | head -1)"
	if [[ ! "${prazo}" =~ ^[0-9]+$ ]]; then
		falhar "não consegui ler PRAZO_DE_GUARDA_EM_DIAS de ${SCRIPT_COPIAR} — obtive [${prazo}]"
		fechar_caso "CT-1100"
		return
	fi
	nota "prazo de guarda lido do alvo: ${prazo} dia(s)"

	local diario="${DIR_TRABALHO}/ct-1100/daily"
	mkdir -p "${diario}"
	# O modo `expurgar` não passa por `preparar_destino`; a sentinela do acervo é
	# marcada aqui, no mesmo lugar em que aquele a grava.
	marcar_acervo "${DIR_TRABALHO}/ct-1100"

	local agora
	agora="$(date +%s)"
	local linha=$((agora - prazo * SEGUNDOS_POR_DIA))

	# (1) nome antiquíssimo, tempo de modificação RECENTE  ⇒ PERMANECE
	# (2) nome de hoje e extensão de resíduo, tempo ANTIGO ⇒ REMOVIDO
	# (3) dentro da linha, por ${FOLGA_DA_BORDA_S} s      ⇒ PERMANECE
	# (4) fora da linha, por um minuto                    ⇒ REMOVIDO
	local orfao_de_nome_recente
	orfao_de_nome_recente="base-$(date +%F).dump.parcial"

	: >"${diario}/base-2020-01-01.dump"
	: >"${diario}/${orfao_de_nome_recente}"
	: >"${diario}/base-borda-dentro.dump"
	: >"${diario}/base-borda-fora.dump"

	touch -d "@$((agora - 3600))" "${diario}/base-2020-01-01.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" "${diario}/${orfao_de_nome_recente}"
	touch -d "@$((linha + FOLGA_DA_BORDA_S))" "${diario}/base-borda-dentro.dump"
	touch -d "@$((linha - 60))" "${diario}/base-borda-fora.dump"

	local saida="${DIR_TRABALHO}/ct-1100.out" erro="${DIR_TRABALHO}/ct-1100.err"
	executar_alvo "${saida}" "${erro}" env \
		SYSLOC_RAIZ_DO_BACKUP="${DIR_TRABALHO}/ct-1100" \
		bash "${SCRIPT_COPIAR}" expurgar

	afirmar_igual "o expurgo termina com sucesso" "0" "${CODIGO_DO_ALVO}"

	# IGUALDADE DE CONJUNTO, nunca contenção: contenção aprovaria um expurgo que
	# não removesse nada.
	afirmar_igual "permanecem exatamente as duas que não passaram do prazo" \
		"base-2020-01-01.dump base-borda-dentro.dump" \
		"$(listar_nomes "${diario}")"

	afirmar_igual "o resumo declara o que saiu, o que ficou e o que resistiu" \
		"1" "$(grep -cF 'removidas=2 mantidas=2 nao_removidas=0' "${saida}" || true)"

	ct_1100_acervo_alheio
	ct_1100_destino_ilegivel
	ct_1100_remocao_que_resiste
	ct_1100_adocao_da_raiz_alheia
	ct_1100_ramos_da_entrada_unica

	fechar_caso "CT-1100"
}

# =========================================================================== #
# CT-1100 (b) — o expurgo RECUSA um destino que não é o acervo desta rotina.
#
# INVARIANTE: o acervo sob expurgo é reconhecido pelo DIRETÓRIO, e nenhuma
# grafia de caminho o contorna. As entradas VENCIDAS de uma árvore alheia
# permanecem intactas.
#
# ⚠️ A forma `por-travessia` é o ponto: `<raiz>/vizinho/../legado` NÃO começa
# pelo prefixo literal da árvore alheia, o `find` a resolve normalmente, e o
# expurgo por idade removeria o acervo do sistema legado — que segue de pé e só é
# desligado na F7. A forma `direta` prova que o mesmo vale sem travessia nenhuma.
#
# ⚠️ Isto NÃO é decisão por nome no eixo do expurgo: as entradas alheias que
# ficam intactas são VENCIDAS por idade, e o que as salva é o diretório não ser o
# acervo desta rotina — a pergunta que o CT-1100 acima não faz.
# =========================================================================== #
ct_1100_acervo_alheio() {
	local base="${DIR_TRABALHO}/ct-1100-alheio"
	local alheia
	mkdir -p "${base}/legado/daily" "${base}/vizinho"
	alheia="$(realpath -m -- "${base}/legado")"

	local agora
	agora="$(date +%s)"
	: >"${alheia}/daily/preservacao-do-legado.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" \
		"${alheia}/daily/preservacao-do-legado.dump"

	local antes
	antes="$(listar_nomes "${alheia}/daily")"
	afirmar_igual "acervo alheio: o arranjo tem a cópia vencida da árvore alheia" \
		"preservacao-do-legado.dump" "${antes}"

	local forma raiz
	for forma in por-travessia direta; do
		case "${forma}" in
		por-travessia) raiz="${base}/vizinho/../legado" ;;
		direta) raiz="${alheia}" ;;
		esac

		executar_alvo "${base}/${forma}.out" "${base}/${forma}.err" env \
			SYSLOC_RAIZ_DO_BACKUP="${raiz}" bash "${SCRIPT_COPIAR}" expurgar

		afirmar_igual "acervo alheio [${forma}]: termina com código de falha" \
			"1" "${CODIGO_DO_ALVO}"
		afirmar_contem "acervo alheio [${forma}]: a recusa nomeia o destino RESOLVIDO" \
			"${alheia}/daily" "$(cat "${base}/${forma}.err")"
		afirmar_contem "acervo alheio [${forma}]: a recusa diz que o destino não é o acervo desta rotina" \
			"NÃO é o acervo desta rotina" "$(cat "${base}/${forma}.err")"
		afirmar_igual "acervo alheio [${forma}]: a cópia VENCIDA da árvore alheia continua lá" \
			"${antes}" "$(listar_nomes "${alheia}/daily")"
	done
}

# =========================================================================== #
# CT-1100 (c) — destino ILEGÍVEL não é destino vazio.
#
# INVARIANTE: a varredura que não conseguiu ler o destino RECUSA, e o resumo
# `removidas=… mantidas=…` não chega a ser impresso.
#
# ⚠️ É a propriedade que o docblock de `expurgar()` declarava e o código não
# entregava: a listagem vinha de substituição de processo, cujo código de saída
# `set -euo pipefail` NÃO alcança, e um destino sem permissão de leitura produzia
# `removidas=0 mantidas=0` com saída 0 — o mesmo par de um destino limpo.
#
# ⚠️ A asserção sobre o TEXTO da recusa também fixa a ORDEM das guardas: com o
# modo `000` a sentinela do acervo é invisível, e um alvo que conferisse o acervo
# antes de saber ler o destino culparia o operador pelo caminho errado.
# =========================================================================== #
ct_1100_destino_ilegivel() {
	local modo raiz diario
	for modo in 000 300; do
		raiz="${DIR_TRABALHO}/ct-1100-ilegivel-${modo}"
		diario="${raiz}/daily"
		mkdir -p "${diario}"
		marcar_acervo "${raiz}"

		local agora
		agora="$(date +%s)"
		: >"${diario}/base-vencida.dump"
		touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" "${diario}/base-vencida.dump"

		chmod "${modo}" "${diario}"
		executar_alvo "${raiz}.out" "${raiz}.err" env \
			SYSLOC_RAIZ_DO_BACKUP="${raiz}" bash "${SCRIPT_COPIAR}" expurgar
		chmod 700 "${diario}"

		afirmar_igual "destino ilegível [${modo}]: termina com código de falha" \
			"1" "${CODIGO_DO_ALVO}"
		afirmar_contem "destino ilegível [${modo}]: a recusa nomeia a varredura que não pôde ler o destino" \
			"NÃO pôde ser lido por inteiro" "$(cat "${raiz}.err")"
		afirmar_igual "destino ilegível [${modo}]: NENHUM resumo de expurgo foi impresso" \
			"0" "$(grep -c 'expurgo: removidas=' "${raiz}.out" || true)"
		afirmar_igual "destino ilegível [${modo}]: a cópia vencida continua lá" \
			"base-vencida.dump" "$(listar_nomes "${diario}")"
	done
}

# =========================================================================== #
# CT-1100 (d) — cópia vencida que RESISTE à remoção é contada e nomeada.
#
# INVARIANTE: a entrada vencida que não pôde ser removida aparece no resumo, é
# nomeada na saída de erro, e o expurgo NÃO termina com sucesso.
#
# ⚠️ Antes, `if rm -f …; then removidas=…; fi` tratava a falha como silêncio: a
# entrada não entrava em `removidas`, não entrava em `mantidas`, e não aparecia
# em lugar nenhum — e quem executa isto é um relógio.
# =========================================================================== #
ct_1100_remocao_que_resiste() {
	local raiz="${DIR_TRABALHO}/ct-1100-resistente"
	local diario="${raiz}/daily"
	mkdir -p "${diario}"
	marcar_acervo "${raiz}"

	local agora
	agora="$(date +%s)"
	: >"${diario}/base-vencida.dump"
	: >"${diario}/base-recente.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" "${diario}/base-vencida.dump"
	touch -d "@$((agora - 3600))" "${diario}/base-recente.dump"

	# Legível e navegável, mas NÃO gravável: a varredura enxerga tudo e a remoção
	# é que falha.
	chmod 500 "${diario}"
	executar_alvo "${raiz}.out" "${raiz}.err" env \
		SYSLOC_RAIZ_DO_BACKUP="${raiz}" bash "${SCRIPT_COPIAR}" expurgar
	chmod 700 "${diario}"

	afirmar_igual "remoção que resiste: termina com código de falha" "1" "${CODIGO_DO_ALVO}"
	afirmar_igual "remoção que resiste: o resumo declara os TRÊS lados" \
		"1" "$(grep -cF 'removidas=0 mantidas=1 nao_removidas=1' "${raiz}.out" || true)"
	afirmar_contem "remoção que resiste: a saída de erro NOMEIA o caminho que resistiu" \
		"${diario}/base-vencida.dump" "$(cat "${raiz}.err")"
	afirmar_igual "remoção que resiste: as duas entradas continuam lá" \
		"base-recente.dump base-vencida.dump" "$(listar_nomes "${diario}")"
}

# =========================================================================== #
# CT-1100 (e) — a trilha `copiar` NÃO ADOTA uma raiz que não é desta rotina.
#
# INVARIANTE: nenhuma trilha adota uma raiz que ela não possa afirmar ser sua.
# Adotar é gravar a sentinela e corrigir o modo; nenhuma das duas coisas acontece
# numa árvore alheia, nem quando a cópia é pedida pelo modo PADRÃO.
#
# ⚠️ ELE É O PAR DO CT-1100 (b), E OS DOIS NÃO SE COLAPSAM. Aquele prova a trilha
# `expurgar`; este prova a trilha `copiar`, que é a que a
# `sysloc-backup-da-base.service` dispara pelo relógio — e foi exatamente a
# ausência dele que deixou o furo atravessar uma rodada inteira de gate com a
# bateria em 159 OK e 0 FALHA: `preparar_destino` fazia `chmod 700` na raiz e no
# `daily` ALHEIOS e gravava a sentinela lá, INCONDICIONALMENTE. A partir daí a
# árvore alheia estava marcada, e a execução seguinte — inclusive `expurgar`, com
# a guarda da rodada 2 no lugar — a reconhecia como acervo próprio e removia por
# idade as cópias de produção do sistema legado.
#
# ⚠️ A ASSERÇÃO QUE DISCRIMINA é a do modo do diretório alheio somada à da
# sentinela ausente: as duas observam o efeito de `preparar_destino`, e ele roda
# ANTES de a cópia sequer falar com o banco — o `chmod` acontecia mesmo quando
# todo o resto abortava. Afirmar apenas o código de saída aprovaria o alvo
# defeituoso, porque a cópia já saía 1 por não achar o arquivo de ambiente.
#
# ⚠️ E o CONTROLE é obrigatório: sem a adoção legítima da raiz preexistente e
# VAZIA, um alvo que recusasse toda raiz que ele não tivesse criado passaria nas
# asserções acima e quebraria a primeira execução de todo operador que criou o
# destino com `mkdir`.
# =========================================================================== #
ct_1100_adocao_da_raiz_alheia() {
	local base="${DIR_TRABALHO}/ct-1100-adocao"
	local alheia="${base}/legado" vazia="${base}/vazia"
	mkdir -p "${alheia}/daily" "${vazia}"

	local agora
	agora="$(date +%s)"
	: >"${alheia}/daily/preservacao-do-legado.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" \
		"${alheia}/daily/preservacao-do-legado.dump"

	# O modo alheio começa em 755 DE PROPÓSITO: é o valor que o CT-1106 prova que
	# esta rotina corrige quando o destino é dela. Se a raiz fosse adotada, os dois
	# níveis viriam a 700 — e é essa diferença que a asserção observa.
	chmod 755 "${alheia}" "${alheia}/daily"

	# O ambiente é o LEGÍTIMO, e não um caminho inexistente: assim a recusa não
	# pode ser confundida com "a cópia abortou por falta de credencial", e o alvo
	# defeituoso chegaria de fato a publicar na árvore alheia.
	executar_alvo "${base}/copia.out" "${base}/copia.err" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${alheia}" \
		bash "${SCRIPT_COPIAR}"

	afirmar_igual "adoção alheia [copiar]: termina com código de falha" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_contem "adoção alheia [copiar]: a recusa diz que o destino não é o acervo desta rotina" \
		"NÃO é o acervo desta rotina" "$(cat "${base}/copia.err")"
	afirmar_igual "adoção alheia [copiar]: o modo da RAIZ alheia segue intacto" \
		"755" "$(modo_de "${alheia}")"
	afirmar_igual "adoção alheia [copiar]: o modo do DIÁRIO alheio segue intacto" \
		"755" "$(modo_de "${alheia}/daily")"
	afirmar_igual "adoção alheia [copiar]: NENHUMA sentinela foi gravada na raiz alheia" \
		"ausente" "$(modo_de "${alheia}/${NOME_DA_SENTINELA}")"
	afirmar_igual "adoção alheia [copiar]: nada foi publicado na árvore alheia" \
		"preservacao-do-legado.dump" "$(listar_nomes "${alheia}/daily")"

	# A segunda execução é o que fecha a prova: é ela que o alvo defeituoso
	# aprovaria, porque a primeira já teria deixado a marca.
	executar_alvo "${base}/expurgo.out" "${base}/expurgo.err" env \
		SYSLOC_RAIZ_DO_BACKUP="${alheia}" \
		bash "${SCRIPT_COPIAR}" expurgar

	afirmar_igual "adoção alheia [expurgar depois]: termina com código de falha" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_igual "adoção alheia [expurgar depois]: a cópia VENCIDA da árvore alheia continua lá" \
		"preservacao-do-legado.dump" "$(listar_nomes "${alheia}/daily")"

	# A sentinela que é VÍNCULO SIMBÓLICO não prova propriedade — nos DOIS modos.
	# `[[ -f ]]` a seguiria e aceitaria a árvore alheia como acervo próprio.
	ln -s "${alheia}/daily/preservacao-do-legado.dump" "${alheia}/${NOME_DA_SENTINELA}"
	local modo
	for modo in copiar expurgar; do
		executar_alvo "${base}/vinculo-${modo}.out" "${base}/vinculo-${modo}.err" env \
			SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
			SYSLOC_RAIZ_DO_BACKUP="${alheia}" \
			bash "${SCRIPT_COPIAR}" "${modo}"

		afirmar_igual "sentinela-vínculo [${modo}]: termina com código de falha" \
			"1" "${CODIGO_DO_ALVO}"
		afirmar_contem "sentinela-vínculo [${modo}]: a recusa nomeia o vínculo simbólico" \
			"é um vínculo simbólico" "$(cat "${base}/vinculo-${modo}.err")"
		afirmar_igual "sentinela-vínculo [${modo}]: a cópia VENCIDA da árvore alheia continua lá" \
			"preservacao-do-legado.dump" "$(listar_nomes "${alheia}/daily")"
	done
	rm -f "${alheia}/${NOME_DA_SENTINELA}"

	# CONTROLE ANTIVÁCUO — a raiz preexistente e VAZIA É adotada, e a cópia sai.
	executar_alvo "${base}/vazia.out" "${base}/vazia.err" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${vazia}" \
		bash "${SCRIPT_COPIAR}"

	afirmar_igual "controle: a raiz preexistente VAZIA é adotada e a cópia termina com sucesso" \
		"0" "${CODIGO_DO_ALVO}"
	afirmar_igual "controle: a raiz adotada recebeu a sentinela com modo 600" \
		"600" "$(modo_de "${vazia}/${NOME_DA_SENTINELA}")"
	afirmar_igual "controle: a cópia do dia foi publicada na raiz adotada" \
		"base-$(date +%F).dump" "$(listar_nomes "${vazia}/daily")"
}

# =========================================================================== #
# CT-1100 (f) — os CINCO ramos de recusa da entrada única, POR ENUMERAÇÃO.
#
# INVARIANTE: nenhum ramo de `afirmar_propriedade_da_raiz` decide sozinho. Cada
# um recusa nos DOIS modos, nomeando o que observou, e nenhum deles chega a
# corrigir modo nem a gravar sentinela na árvore que ele não pôde afirmar sua.
#
# ⚠️ POR QUE ENUMERAÇÃO, E NÃO TRÊS CASOS NOVOS. Esta é a TERCEIRA rodada seguida
# em que uma guarda desta task nasce com ramo sem perna — `TR-P3` (a guarda da
# ADR-0032), `QA-ALTO-001` (a guarda do acervo na trilha `copiar`) e agora os
# ramos R1, R3 e R4. A §5 de `.claude/rules/nao-regressao.md` manda atacar a
# TOPOLOGIA quando o mesmo item reaparece: cobrir os três ramos apontados
# fecharia de novo só as ocorrências. A tabela abaixo é o mapa legível dos ramos;
# quem os AMARRA ao alvo é a perna estática que abre o caso, e que conta as
# chamadas a `recusar_raiz_alheia` dentro do corpo de `afirmar_propriedade_da_raiz`
# no FONTE, afirmando por igualdade que esse número é o que `RAMOS_DA_RECUSA`
# enumera.
#
# | #  | Ramo de `afirmar_propriedade_da_raiz`, na ordem do código | Coberto por |
# |----|-----------------------------------------------------------|-------------|
# | R1 | a raiz existe e NÃO é um diretório                         | (f) linha `R1` |
# | R2 | a sentinela é um vínculo simbólico                         | (f) linha `R2` · e o (e), nos dois modos |
# | R3 | a sentinela existe e NÃO é um arquivo comum                | (f) linhas `R3a` (diretório) e `R3b` (FIFO) |
# | R4 | a raiz NÃO pôde ser varrida por inteiro                    | (f) linha `R4` |
# | R5 | a raiz guarda acervo que não é desta rotina                | (f) linha `R5` · e os (b) e (e) |
#
# ⚠️ RAMO NOVO NA ENTRADA ÚNICA REPROVA ESTE CASO ATÉ GANHAR LINHA EM
# `RAMOS_DA_RECUSA`. A amarra desiguala no instante em que o sexto
# `recusar_raiz_alheia` aparece no corpo da função no fonte, em qualquer posição
# e sob qualquer condição — e é ela, não a tabela, que impede um ramo de entrar em
# produção sem asserção que o alcance. A tabela acompanha a mão e é o que se lê.
#
# ⚠️ O ALCANCE EXATO DA AMARRA, para que este bloco não volte a prometer demais:
# o eixo é a CHAMADA a `recusar_raiz_alheia` dentro do corpo, que é a saída única
# de recusa da guarda (`copiar-base.sh`, `DECISÃO FECHADA — T2 / Gate 1 rodada 3`).
# Ramo que recusasse por outro caminho ficaria fora do alcance dela — e seria, ele
# mesmo, um desvio daquela decisão, não uma lacuna desta.
#
# ⚠️ ATÉ A RODADA 4 ESTE BLOCO PROMETIA ESSA GARANTIA SEM TÊ-LA: a tabela era
# prosa, o array era lista literal, e nenhum dos dois lia `${SCRIPT_COPIAR}` — um
# sexto ramo instalado na entrada única saía em 226 OK e 0 FALHA, indistinguível
# da árvore íntegra. Foi assim que o R4 entrou nu, e o dano de um comentário
# assim é ATIVO: quem abre a entrada única lê, no lugar exato onde procuraria a
# garantia, que ela existe — e não a confere.
#
# ⚠️ O R4 É O QUE PESA, e ele é o `TR-P4` num objeto NOVO. Aquele bloqueante da
# rodada 1 perguntava *"destino ilegível é destino vazio?"* sobre o DIRETÓRIO DAS
# CÓPIAS; a entrada única da rodada 3 refez a mesma pergunta sobre a RAIZ, e desta
# vez sem rede: INVERTER o ramo — adotar quando a varredura falha, em vez de
# recusar — deixava a bateria inteira em 176 OK e 0 FALHA. Ele é a metade *"não
# saber é o mesmo que não poder afirmar"* de uma decisão de ADOÇÃO.
#
# ⚠️ A ASSERÇÃO QUE DISCRIMINA cada linha é o par sentinela+modo da raiz, e não o
# código de saída: `preparar_destino` corrige o modo e grava a sentinela ANTES de
# a cópia falar com o banco, de modo que um alvo que adotasse a raiz deixaria a
# marca mesmo abortando depois. E o ambiente entregue é o LEGÍTIMO nos dois modos,
# então o alvo defeituoso não abortaria: ele publicaria.
# =========================================================================== #
ct_1100_ramos_da_entrada_unica() {
	# Uma linha por ramo, na ORDEM em que `afirmar_propriedade_da_raiz` os avalia.
	# Campos: identificador | forma do arranjo | agulha que a recusa tem de trazer
	#         | forma da sentinela DEPOIS da recusa | modo da raiz DEPOIS da recusa
	local -a RAMOS_DA_RECUSA=(
		"R1|raiz-nao-diretorio|existe e NÃO é um diretório|ausente|640"
		"R2|sentinela-vinculo|é um vínculo simbólico|vinculo|755"
		"R3a|sentinela-diretorio|existe e NÃO é um arquivo comum|diretorio|755"
		"R3b|sentinela-fifo|existe e NÃO é um arquivo comum|fifo|755"
		"R4|raiz-nao-varrivel|não consegui varrer|ausente|755"
		"R5|raiz-com-acervo-alheio|não tem ${NOME_DA_SENTINELA} e guarda [|ausente|755"
	)

	# DECISÃO FECHADA — T2 / Gate 1 rodada 5 · 2026-08-25
	# O QUÊ: a enumeração acima é amarrada ao FONTE da entrada única por contagem,
	#          e a amarra é falsificada no próprio caso.
	# POR QUÊ: até a rodada 4 o docblock AFIRMAVA essa garantia sem tê-la, e o QA a
	#          falsificou por execução — sexto ramo instalado, 226 OK e 0 FALHA. É a
	#          segunda ocorrência da mesma classe no mesmo diff (`TR-P4`): comentário
	#          que promete mais do que o código sustenta.
	# REVERTER EXIGE: provar que nenhum ramo acrescentado a
	#          `afirmar_propriedade_da_raiz` pode chegar a produção sem uma asserção
	#          desta bateria que o alcance — sem apoiar a prova em prosa nem em lista
	#          literal, que foi o que já falhou.
	#
	# ⚠️ Asserção ESTÁTICA: ela lê o TEXTO de `${SCRIPT_COPIAR}` em vez de exercitá-lo,
	# e por isso a falsificação logo abaixo é obrigatória
	# (`.claude/rules/testing-stack.md`, P4 de `.claude/rules/nao-regressao.md`).
	#
	# O esperado sai do PRÓPRIO array, e não de uma constante solta: as duas pontas
	# ficam amarradas uma na outra. `R3a` e `R3b` são duas formas do MESMO ramo, e é
	# por isso que o sufixo cai antes de contar.
	local ramos_enumerados
	ramos_enumerados="$(printf '%s\n' "${RAMOS_DA_RECUSA[@]}" |
		cut -d'|' -f1 | sed 's/[ab]$//' | LC_ALL=C sort -u | grep -c .)"

	# ÂNCORA ANTIVÁCUO: array esvaziado daria zero, e zero contra zero passaria.
	afirmar_diferente "a enumeração dos ramos não está vazia" "0" "${ramos_enumerados}"
	afirmar_igual "a entrada única do alvo recusa em exatamente os ${ramos_enumerados} ramos enumerados" \
		"${ramos_enumerados}" "$(contar_recusas_da_entrada_unica "${SCRIPT_COPIAR}")"

	# PROVA DE FALSIFICAÇÃO, no molde do CT-1105: a MESMA função de auditoria é
	# aplicada a cópias defeituosas. Reimplementá-la para o mutante aprovaria 2/2
	# uma amarra que não discrimina nada.
	#
	# Os mutantes vivem em diretório temporário e NUNCA na árvore de trabalho: um
	# `copiar-base.sh` adulterado versionado é pior que a lacuna que ele prova.
	local mutante="${DIR_TRABALHO}/mutante-sexto-ramo.sh"
	awk '
		{ print }
		/^afirmar_propriedade_da_raiz\(\) \{$/ {
			print "\trecusar_raiz_alheia \"sexto ramo, instalado pela prova de falsificação\""
		}
	' "${SCRIPT_COPIAR}" >"${mutante}"
	afirmar_igual "a auditoria REPROVA o alvo com um SEXTO ramo instalado" \
		"$((ramos_enumerados + 1))" "$(contar_recusas_da_entrada_unica "${mutante}")"

	# A outra ponta: sem a entrada única no fonte, a auditoria devolve VAZIO e não
	# `0` — que a igualdade confundiria com "existe e não recusa em ramo algum".
	local mutante_renomeado="${DIR_TRABALHO}/mutante-entrada-unica-renomeada.sh"
	sed 's/^afirmar_propriedade_da_raiz() {$/afirmar_propriedade_da_raiz_renomeada() {/' \
		"${SCRIPT_COPIAR}" >"${mutante_renomeado}"
	afirmar_igual "a auditoria devolve VAZIO quando a entrada única não é achada" \
		"" "$(contar_recusas_da_entrada_unica "${mutante_renomeado}")"

	local linha ramo forma agulha sentinela_esperada modo_esperado
	local base raiz modo
	for linha in "${RAMOS_DA_RECUSA[@]}"; do
		IFS='|' read -r ramo forma agulha sentinela_esperada modo_esperado <<<"${linha}"

		base="${DIR_TRABALHO}/ct-1100-ramos/${ramo}"
		raiz="${base}/raiz"
		mkdir -p "${base}"

		case "${forma}" in
		raiz-nao-diretorio)
			# A raiz É um arquivo comum. O modo é fixado para que a asserção não
			# dependa do `umask` de quem executa a bateria.
			: >"${raiz}"
			chmod 640 "${raiz}"
			;;
		sentinela-vinculo)
			# O alvo do vínculo vive FORA da raiz: dentro dela ele seria vestígio, e
			# o ramo R5 dispararia antes deste.
			mkdir -p "${raiz}"
			chmod 755 "${raiz}"
			: >"${base}/alvo-do-vinculo"
			ln -s "${base}/alvo-do-vinculo" "${raiz}/${NOME_DA_SENTINELA}"
			;;
		sentinela-diretorio)
			mkdir -p "${raiz}/${NOME_DA_SENTINELA}"
			chmod 755 "${raiz}"
			;;
		sentinela-fifo)
			# A segunda forma do MESMO ramo, e ela não é redundante: um alvo que
			# testasse `! -d` no lugar de `! -f` recusaria o diretório e ACEITARIA o
			# FIFO, cuja leitura bloqueia o processo do relógio para sempre.
			mkdir -p "${raiz}"
			chmod 755 "${raiz}"
			mkfifo "${raiz}/${NOME_DA_SENTINELA}"
			;;
		raiz-nao-varrivel)
			# SEM arquivo algum na raiz, de propósito: o que a varredura não consegue
			# é ATRAVESSAR a árvore inteira, e é isso que separa este ramo do R5. O
			# subdiretório volta a 700 depois dos dois modos, como o CT-1100 (c) faz.
			mkdir -p "${raiz}/oculto"
			chmod 755 "${raiz}"
			chmod 000 "${raiz}/oculto"
			;;
		raiz-com-acervo-alheio)
			mkdir -p "${raiz}"
			chmod 755 "${raiz}"
			: >"${raiz}/preservacao-do-legado.dump"
			;;
		esac

		for modo in copiar expurgar; do
			# O ambiente é o LEGÍTIMO nos dois modos: assim a recusa não pode ser
			# confundida com "abortou por falta de credencial", e um alvo que adotasse
			# a raiz chegaria de fato a marcá-la e a publicar nela.
			executar_alvo "${base}/${modo}.out" "${base}/${modo}.err" env \
				SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
				SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
				bash "${SCRIPT_COPIAR}" "${modo}"

			afirmar_igual "ramo ${ramo} [${modo}]: termina com código de falha" \
				"1" "${CODIGO_DO_ALVO}"
			afirmar_contem "ramo ${ramo} [${modo}]: a recusa nomeia o que ela observou" \
				"${agulha}" "$(cat "${base}/${modo}.err")"
			afirmar_igual "ramo ${ramo} [${modo}]: a sentinela desta rotina NÃO foi gravada" \
				"${sentinela_esperada}" "$(forma_do_caminho "${raiz}/${NOME_DA_SENTINELA}")"
			afirmar_igual "ramo ${ramo} [${modo}]: o modo da raiz segue intacto" \
				"${modo_esperado}" "$(modo_de "${raiz}")"
		done

		case "${forma}" in
		raiz-nao-varrivel)
			# `stat -c '%a'` NÃO imprime zeros à esquerda: o modo `000` sai como `0`.
			afirmar_igual "ramo ${ramo}: o subdiretório que não pôde ser lido segue sem bit algum" \
				"0" "$(modo_de "${raiz}/oculto")"
			chmod 700 "${raiz}/oculto"
			;;
		raiz-com-acervo-alheio)
			afirmar_igual "ramo ${ramo}: o acervo alheio continua lá, e nada foi acrescentado" \
				"preservacao-do-legado.dump" "$(listar_nomes "${raiz}")"
			;;
		esac
	done
}

# =========================================================================== #
# CT-1101 — prazo inválido recusa SEM REMOVER NADA.
#
# INVARIANTE: `0` não é lido como "apague tudo". Valor inválido aborta antes de
# qualquer remoção, e a listagem do destino sai idêntica à de antes.
#
# O controle antivácuo no fim é obrigatório: sem ele, um expurgo que NUNCA
# removesse nada passaria nas três linhas da tabela.
# =========================================================================== #
ct_1101() {
	caso "CT-1101" "prazo inválido recusa sem remover nada"

	local raiz="${DIR_TRABALHO}/ct-1101"
	local diario="${raiz}/daily"
	mkdir -p "${diario}"
	marcar_acervo "${raiz}"

	local agora
	agora="$(date +%s)"
	: >"${diario}/base-antiga.dump"
	: >"${diario}/base-recente.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" "${diario}/base-antiga.dump"
	touch -d "@$((agora - 3600))" "${diario}/base-recente.dump"

	local antes
	antes="$(listar_nomes "${diario}")"
	afirmar_igual "o arranjo tem as duas cópias" "base-antiga.dump base-recente.dump" "${antes}"

	local invalido
	for invalido in "0" "-1" "catorze"; do
		local saida="${DIR_TRABALHO}/ct-1101-${invalido}.out"
		local erro="${DIR_TRABALHO}/ct-1101-${invalido}.err"

		executar_alvo "${saida}" "${erro}" env \
			SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
			SYSLOC_PRAZO_DE_GUARDA_EM_DIAS="${invalido}" \
			bash "${SCRIPT_COPIAR}" expurgar

		afirmar_igual "prazo [${invalido}] termina com código de falha" "1" "${CODIGO_DO_ALVO}"
		afirmar_contem "prazo [${invalido}]: a recusa nomeia a variável" \
			"PRAZO_DE_GUARDA_EM_DIAS" "$(cat "${erro}")"
		afirmar_contem "prazo [${invalido}]: a recusa nomeia o valor recebido" \
			"[${invalido}]" "$(cat "${erro}")"
		afirmar_igual "prazo [${invalido}]: a listagem sai idêntica — zero remoções" \
			"${antes}" "$(listar_nomes "${diario}")"
	done

	# CONTROLE ANTIVÁCUO: com o prazo padrão, a antiga SAI. Sem esta linha, as três
	# acima seriam satisfeitas por um expurgo que nunca remove coisa alguma.
	executar_alvo "${DIR_TRABALHO}/ct-1101-valido.out" "${DIR_TRABALHO}/ct-1101-valido.err" \
		env SYSLOC_RAIZ_DO_BACKUP="${raiz}" bash "${SCRIPT_COPIAR}" expurgar
	afirmar_igual "o expurgo com prazo válido termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	afirmar_igual "com prazo válido a cópia vencida SAI — as recusas acima não eram vácuo" \
		"base-recente.dump" "$(listar_nomes "${diario}")"

	fechar_caso "CT-1101"
}

# =========================================================================== #
# CT-1102 — a chave não está no pacote, MEDIDO no conteúdo extraído.
#
# INVARIANTE: nenhum membro do pacote contém o valor da chave de cifra, e pacote
# e cópia são DOIS ARTEFATOS DISTINTOS, nenhum contido no outro (ADR-0032).
#
# ⚠️ O CONTROLE POSITIVO É OBRIGATÓRIO. A ADR-0032 é literal quanto ao método —
# a ausência de vazamento se afirma "por medição da saída real, nunca por leitura
# do código". Sem o controle, uma varredura quebrada devolveria zero achados e
# APROVARIA UM PACOTE VAZANDO TUDO, que é o AP-29.
#
# Duas frentes:
#   (a) sandbox  — a raiz dos segredos é montada aqui e apontada pelo MESMO
#                  parâmetro que o operador já usa (SYSLOC_DIR_CONFIG);
#   (b) raiz real — /etc/sysloc é do superusuário. Quando ilegível, sai `aviso`
#                  nomeado, a asserção NÃO conta como aprovada, e a bateria
#                  termina com código 2.
# =========================================================================== #
ct_1102() {
	caso "CT-1102" "a chave de cifra não está no pacote de segredos, medido no conteúdo extraído"

	local base="${DIR_TRABALHO}/ct-1102"
	local raiz_backup="${base}/backup"
	local raiz_chave="${base}/chave"
	local raiz_segredos="${base}/etc"
	mkdir -p "${raiz_backup}" "${raiz_chave}"
	montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

	# A cópia da base vai para a MESMA raiz de backup: sem ela, a asserção de que
	# o diretório de cópias não contém o pacote seria vácuo — não há o que separar
	# quando não há cópia nenhuma.
	executar_alvo "${base}/copia.out" "${base}/copia.err" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		bash "${SCRIPT_COPIAR}"
	afirmar_igual "a cópia da base foi produzida na mesma raiz" "0" "${CODIGO_DO_ALVO}"

	executar_alvo "${base}/segredos.out" "${base}/segredos.err" env \
		SYSLOC_DIR_CONFIG="${raiz_segredos}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		SYSLOC_DESTINO_DA_CHAVE="${raiz_chave}" \
		bash "${SCRIPT_SEGREDOS}"

	afirmar_igual "a preservação dos segredos termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${base}/segredos.err" >&2 || true
		fechar_caso "CT-1102"
		return
	fi

	local data
	data="$(date +%F)"
	local pacote="${raiz_backup}/segredos/segredos-${data}.tar.gz"

	# Igualdade de conjunto sobre os membros: é ela que impede o verde de vácuo —
	# um pacote vazio também não conteria a chave.
	afirmar_igual "o pacote tem exatamente os arquivos de ambiente da raiz" \
		"backend.env migracao.env" "$(membros_do_pacote "${pacote}")"

	local codigo_da_varredura=0 achados
	achados="$(varrer_pacote_por_valor "${pacote}" "${CHAVE_SENTINELA}")" || codigo_da_varredura=$?
	afirmar_igual "nenhum membro do pacote real contém a chave" "0" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a varredura não acusa nada no pacote real" "0" "${codigo_da_varredura}"

	# CONTROLE POSITIVO — a MESMA varredura, sobre um pacote com a chave plantada.
	local area_controle="${base}/controle"
	mkdir -p "${area_controle}"
	tar -xzf "${pacote}" -C "${area_controle}"
	printf 'CONTEXTO_HERDADO=%s\n' "${CHAVE_SENTINELA}" >"${area_controle}/backend.env.anterior"
	local pacote_de_controle="${base}/controle.tar.gz"
	(
		cd "${area_controle}"
		find . -type f -printf '%P\n' | LC_ALL=C sort |
			tar --owner=0 --group=0 --numeric-owner -czf "${pacote_de_controle}" -T -
	)

	codigo_da_varredura=0
	achados="$(varrer_pacote_por_valor "${pacote_de_controle}" "${CHAVE_SENTINELA}")" ||
		codigo_da_varredura=$?
	afirmar_igual "o pacote de controle REPROVA a mesma varredura" "1" "${codigo_da_varredura}"
	afirmar_igual "o controle acusa exatamente um membro" "1" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "o controle NOMEIA o membro que carrega a chave" \
		"backend.env.anterior" "${achados}"

	# Os dois artefatos são distintos, e nenhum vive dentro do outro.
	afirmar_igual "nenhum membro do pacote é uma cópia da base" \
		"0" "$(membros_do_pacote "${pacote}" | tr ' ' '\n' | grep -c '\.dump$' || true)"
	afirmar_igual "o diretório das cópias não guarda pacote de segredos" \
		"0" "$(contar_por_padrao "${raiz_backup}/daily" '*.tar.gz')"
	afirmar_igual "o diretório das cópias guarda exatamente a cópia do dia" \
		"base-${data}.dump" "$(listar_nomes "${raiz_backup}/daily")"
	afirmar_igual "a chave foi preservada em destino próprio, fora da raiz do backup" \
		"chave-de-cifra-${data}.env" "$(listar_nomes "${raiz_chave}")"
	afirmar_igual "o destino da chave não fica dentro da raiz do backup" \
		"0" "$(printf '%s' "${raiz_chave}/" | grep -c "^${raiz_backup}/" || true)"

	ct_1102_raiz_real

	fechar_caso "CT-1102"
}

# Frente (b) do CT-1102 — a raiz REAL dos segredos.
ct_1102_raiz_real() {
	local arq_real="${RAIZ_REAL_DOS_SEGREDOS}/backend.env"

	if [[ ! -r "${arq_real}" ]]; then
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
		aviso "[ambiente-real] ${arq_real} não é legível por este usuário — a separação NÃO foi medida contra a raiz REAL dos segredos; a frente (a), em caixa de areia, seguiu medida; ${MARCA_DO_COMANDO_QUE_MEDIRIA} ${COMANDO_QUE_MEDIRIA_O_AMBIENTE_REAL}"
		return
	fi

	local valor_real
	valor_real="$(sed -n "s|^${NOME_DA_CHAVE}=||p" "${arq_real}" | tail -1)"
	if [[ -z "${valor_real}" ]]; then
		aviso "[ambiente-real] ${NOME_DA_CHAVE} não está declarada em ${arq_real} — a frente da raiz real não tem o que medir; ${MARCA_DO_COMANDO_QUE_MEDIRIA} declarar ${NOME_DA_CHAVE} em ${arq_real} na janela assistida"
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
		return
	fi

	local base="${DIR_TRABALHO}/ct-1102-real"
	mkdir -p "${base}/backup" "${base}/chave"

	executar_alvo "${base}/saida.out" "${base}/saida.err" env \
		SYSLOC_DIR_CONFIG="${RAIZ_REAL_DOS_SEGREDOS}" \
		SYSLOC_RAIZ_DO_BACKUP="${base}/backup" \
		SYSLOC_DESTINO_DA_CHAVE="${base}/chave" \
		bash "${SCRIPT_SEGREDOS}"

	afirmar_igual "a preservação da raiz REAL termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${base}/saida.err" >&2 || true
		return
	fi

	local data
	data="$(date +%F)"
	local pacote="${base}/backup/segredos/segredos-${data}.tar.gz"
	local membros
	membros="$(membros_do_pacote "${pacote}")"
	afirmar_diferente "o pacote da raiz REAL não está vazio" "" "${membros}"

	local codigo_da_varredura=0 achados
	achados="$(varrer_pacote_por_valor "${pacote}" "${valor_real}")" || codigo_da_varredura=$?
	afirmar_igual "nenhum membro do pacote REAL contém a chave de cifra" \
		"0" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a varredura não acusa nada no pacote REAL" "0" "${codigo_da_varredura}"
	nota "membros do pacote da raiz real: ${membros}"
}

# =========================================================================== #
# CT-1103 — a chave dentro do que iria para o pacote RECUSA a execução.
#
# INVARIANTE: a recusa acontece ANTES da escrita, e não depois com remoção
# compensatória — empacotar e depois remover deixaria, no intervalo, um pacote
# completo em disco, e o intervalo é tudo o que um backup precisa para vazar.
#
# As duas formas existem porque o eixo por NOME não alcança a segunda: a nota de
# fronteira da própria ADR-0032 registra que segredo sob nome neutro escapa dele.
# =========================================================================== #
ct_1103() {
	caso "CT-1103" "a chave dentro do que iria para o pacote recusa a execução, nas duas formas"

	local forma
	for forma in arquivo-proprio-na-raiz linha-sob-nome-neutro; do
		local base="${DIR_TRABALHO}/ct-1103-${forma}"
		local raiz_backup="${base}/backup" raiz_chave="${base}/chave" raiz_segredos="${base}/etc"
		mkdir -p "${raiz_backup}" "${raiz_chave}"
		montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

		local esperado
		case "${forma}" in
		arquivo-proprio-na-raiz)
			install -m 0600 /dev/null "${raiz_segredos}/chave-avulsa.txt"
			printf '%s\n' "${CHAVE_SENTINELA}" >"${raiz_segredos}/chave-avulsa.txt"
			esperado="chave-avulsa.txt"
			;;
		linha-sob-nome-neutro)
			# Nome NEUTRO de propósito: a omissão por nome não o alcança, e só a
			# medição por valor o pega.
			printf 'CONTEXTO_ANTERIOR=%s\n' "${CHAVE_SENTINELA}" >>"${raiz_segredos}/migracao.env"
			esperado="migracao.env"
			;;
		esac

		executar_alvo "${base}/saida.out" "${base}/saida.err" env \
			SYSLOC_DIR_CONFIG="${raiz_segredos}" \
			SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
			SYSLOC_DESTINO_DA_CHAVE="${raiz_chave}" \
			bash "${SCRIPT_SEGREDOS}"

		afirmar_igual "${forma}: termina com código de falha" "1" "${CODIGO_DO_ALVO}"
		afirmar_contem "${forma}: a recusa nomeia o arquivo" \
			"[${esperado}]" "$(cat "${base}/saida.err")"
		afirmar_igual "${forma}: nenhum pacote foi produzido" \
			"0" "$(contar_por_padrao "${raiz_backup}/segredos" '*.tar.gz')"
		afirmar_igual "${forma}: nenhum resíduo .parcial ficou para trás" \
			"0" "$(contar_por_padrao "${raiz_backup}/segredos" '*.parcial')"
		afirmar_igual "${forma}: a chave não foi preservada em destino nenhum" \
			"" "$(listar_nomes "${raiz_chave}")"
		# A recusa é anterior à escrita: nem o valor da chave chega à saída de erro.
		afirmar_igual "${forma}: a recusa não ecoa o valor da chave" \
			"0" "$(grep -cF -e "${CHAVE_SENTINELA}" "${base}/saida.err" || true)"
	done

	ct_1103_destinos_que_se_contem
	ct_1103_raiz_ilegivel

	fechar_caso "CT-1103"
}

# =========================================================================== #
# CT-1103 (b) — destinos que se contêm RECUSAM a execução (ADR-0032).
#
# INVARIANTE: a chave e o material cifrado NUNCA são salvaguardados na mesma
# árvore, e a recusa acontece ANTES de qualquer escrita — zero pacote, zero
# arquivo de chave, em lugar nenhum da árvore do caso.
#
# ⚠️ É a ÚNICA propriedade desta task cuja violação é literalmente proibida pela
# `Decision` de uma ADR aceita, e ela ficara sem rede: a guarda podia ser
# removida inteira de `preservar-segredos.sh` sem que caso algum reprovasse.
#
# ⚠️ AS QUATRO ÚLTIMAS GRAFIAS SÃO O PONTO. As duas primeiras a comparação por
# prefixo textual já pegava; `.`, `..`, vínculo simbólico e caminho relativo
# atravessavam-na e ainda assim reuniam os dois artefatos na mesma árvore. Uma
# tabela só com as duas primeiras provaria apenas o que a implementação antiga já
# acertava.
#
# ⚠️ A asserção NÃO reproduz a comparação do alvo — reproduzi-la a tornaria
# incapaz de discriminar a classe de defeito. O que se observa é o DESFECHO:
# código de saída, texto da recusa e artefatos produzidos.
#
# O controle antivácuo no fim é obrigatório: sem ele, um alvo que nunca
# produzisse artefato nenhum satisfaria as seis linhas da tabela.
# =========================================================================== #
ct_1103_destinos_que_se_contem() {
	local raiz_do_caso="${DIR_TRABALHO}/ct-1103-convivencia"

	local forma
	for forma in chave-dentro-do-backup backup-dentro-da-chave chave-com-ponto \
		chave-com-travessia chave-por-vinculo backup-relativo; do
		local base="${raiz_do_caso}/${forma}"
		local raiz_segredos="${base}/etc"
		local grafia_backup grafia_chave trabalho
		mkdir -p "${base}/backup"
		montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

		grafia_backup="${base}/backup"
		trabalho="${DIR_TRABALHO}"
		case "${forma}" in
		chave-dentro-do-backup)
			grafia_chave="${base}/backup/chave"
			;;
		backup-dentro-da-chave)
			# O sentido inverso: a raiz do backup é que vive dentro do destino da
			# chave.
			grafia_chave="${base}"
			;;
		chave-com-ponto)
			# ⚠️ O ponto vai ANTES do componente que difere, e a posição é o caso.
			# Em `<raiz>/backup/./chave` o prefixo literal `<raiz>/backup/` casaria
			# assim mesmo, e a linha provaria só o que a comparação textual já
			# acertava; em `<raiz>/./backup/chave` ele NÃO casa, e o caminho resolve
			# dentro da raiz do backup do mesmo jeito.
			grafia_chave="${base}/./backup/chave"
			;;
		chave-com-travessia)
			grafia_chave="${base}/fora/../backup/chave"
			;;
		chave-por-vinculo)
			# A guarda textual nem chegava a olhar o ALVO do vínculo.
			mkdir -p "${base}/backup/chave"
			ln -s "${base}/backup/chave" "${base}/atalho"
			grafia_chave="${base}/atalho"
			;;
		backup-relativo)
			# A raiz do backup é escrita em forma relativa, e o alvo roda com o
			# diretório de trabalho posicionado — a grafia não tem prefixo algum
			# em comum com o destino da chave.
			grafia_backup="backup"
			grafia_chave="${base}/backup/chave"
			trabalho="${base}"
			;;
		esac

		executar_alvo "${base}/saida.out" "${base}/saida.err" env \
			SYSLOC_DIR_CONFIG="${raiz_segredos}" \
			SYSLOC_RAIZ_DO_BACKUP="${grafia_backup}" \
			SYSLOC_DESTINO_DA_CHAVE="${grafia_chave}" \
			bash -c 'cd "$1" || exit 1; exec bash "$2"' _ "${trabalho}" "${SCRIPT_SEGREDOS}"

		afirmar_igual "convivência [${forma}]: termina com código de falha" \
			"1" "${CODIGO_DO_ALVO}"
		afirmar_contem "convivência [${forma}]: a recusa nomeia a ADR-0032" \
			"ADR-0032" "$(cat "${base}/saida.err")"
		afirmar_contem "convivência [${forma}]: a recusa nomeia a grafia do destino da chave" \
			"(${grafia_chave} → " "$(cat "${base}/saida.err")"
		afirmar_contem "convivência [${forma}]: a recusa nomeia a grafia da raiz do backup" \
			"(${grafia_backup} → " "$(cat "${base}/saida.err")"
		afirmar_igual "convivência [${forma}]: NENHUM pacote foi produzido em lugar nenhum" \
			"0" "$(find "${base}" -name '*.tar.gz' 2>/dev/null | grep -c . || true)"
		afirmar_igual "convivência [${forma}]: NENHUM arquivo de chave foi produzido em lugar nenhum" \
			"0" "$(find "${base}" -name 'chave-de-cifra-*' 2>/dev/null | grep -c . || true)"
		afirmar_igual "convivência [${forma}]: a recusa não ecoa o valor da chave" \
			"0" "$(grep -cF -e "${CHAVE_SENTINELA}" "${base}/saida.err" || true)"
	done

	# CONTROLE ANTIVÁCUO — o MESMO arranjo, com destinos que não se contêm.
	local base="${raiz_do_caso}/controle"
	mkdir -p "${base}/backup" "${base}/chave"
	montar_raiz_de_segredos "${base}/etc" "${CHAVE_SENTINELA}"

	executar_alvo "${base}/saida.out" "${base}/saida.err" env \
		SYSLOC_DIR_CONFIG="${base}/etc" \
		SYSLOC_RAIZ_DO_BACKUP="${base}/backup" \
		SYSLOC_DESTINO_DA_CHAVE="${base}/chave" \
		bash "${SCRIPT_SEGREDOS}"

	afirmar_igual "convivência [controle]: destinos separados terminam com sucesso" \
		"0" "${CODIGO_DO_ALVO}"
	afirmar_igual "convivência [controle]: UM pacote foi produzido — as recusas acima não eram vácuo" \
		"1" "$(find "${base}" -name '*.tar.gz' 2>/dev/null | grep -c . || true)"
	afirmar_igual "convivência [controle]: UM arquivo de chave foi produzido" \
		"1" "$(find "${base}" -name 'chave-de-cifra-*' 2>/dev/null | grep -c . || true)"
}

# =========================================================================== #
# CT-1103 (c) — raiz de segredos com trecho ILEGÍVEL não é raiz limpa.
#
# INVARIANTE: quando um trecho da raiz dos segredos não pode ser lido, a
# preservação RECUSA — código 1, nenhum pacote, nenhum resíduo `.parcial` nos
# DOIS destinos, nenhuma chave preservada — em vez de publicar um pacote sem os
# arquivos daquele trecho.
#
# ⚠️ É o irmão exato do `CT-1100 (c)`, e a ASSIMETRIA entre os dois scripts era o
# defeito: `copiar-base.sh` capturava o desfecho das suas DUAS varreduras e
# `preservar-segredos.sh` descartava o das suas duas — a guarda de entrada
# inesperada com `|| true`, e a enumeração dos membros por SUBSTITUIÇÃO DE
# PROCESSO, que `set -Eeuo pipefail` não alcança. Medido antes da correção: o
# `trap ERR` imprimia a falha, o script SEGUIA, e o pacote publicado saía com
# `backend.env` apenas — sem o arquivo de ambiente da subárvore. A descoberta
# viria no dia da restauração, que é quando o pacote é a única coisa que restou.
#
# ⚠️ A ASSERÇÃO QUE DISCRIMINA é `pacotes publicados`: com o código antigo ela
# valia 1 (e o conteúdo do pacote estava incompleto); com o novo vale 0, porque
# a recusa é anterior a qualquer escrita em destino.
#
# ⚠️ A SEGUNDA PERNA É O QUE SEPARA AS DUAS CAUSAS. Sem ela, um alvo que
# recusasse toda raiz com subdiretório — legível ou não — satisfaria a primeira
# inteira. É o MESMO arranjo, com o mesmo subdiretório e o mesmo arquivo,
# mudando SÓ o modo; e ela afirma o conteúdo do pacote por IGUALDADE DE
# CONJUNTO, de modo que é também a rede positiva da enumeração dos membros: uma
# listagem que perdesse a subárvore reprovaria aqui.
#
# ⚠️ POR QUE NÃO HÁ PERNA PRÓPRIA PARA A ENUMERAÇÃO DOS MEMBROS. As duas
# travessias percorrem a MESMA árvore com a mesma descida, e o que se MEDIU é
# isto: o mutante com apenas o ponto (10) revertido sai INDISTINGUÍVEL do código
# íntegro, porque a guarda de entrada inesperada recusa ANTES de a enumeração ser
# alcançada. ⚠️ Note o que esta frase NÃO diz: ela não afirma que nenhum arranjo
# do sistema de arquivos separe as duas — isso não foi provado, e a redação
# anterior o afirmava no absoluto a partir de um mutante só. O que sustenta a
# ausência de perna própria é outra coisa, e ela é verificável: as duas são
# fechadas pela mesma decisão e enumeradas uma a uma no MAPA DE DESFECHOS de
# `preservar-segredos.sh`, de modo que a discriminação da segunda é por
# ENUMERAÇÃO da superfície mais a perna positiva do conjunto — nunca por caso.
#
# O modo é restaurado ANTES das asserções, como o `CT-1100 (c)` faz: sem isso o
# `rm -rf` do diretório de trabalho não alcança a subárvore.
# =========================================================================== #
ct_1103_raiz_ilegivel() {
	local perna modo codigo_esperado pacotes_esperados
	while read -r perna modo codigo_esperado pacotes_esperados; do
		[[ -n "${perna}" ]] || continue

		local base="${DIR_TRABALHO}/ct-1103-raiz-${perna}"
		local raiz_backup="${base}/backup" raiz_chave="${base}/chave" raiz_segredos="${base}/etc"
		mkdir -p "${raiz_backup}" "${raiz_chave}"
		montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

		# O arquivo de ambiente que só existe DENTRO da subárvore: é ele que o pacote
		# perdia em silêncio.
		mkdir -p "${raiz_segredos}/sub"
		install -m 0600 /dev/null "${raiz_segredos}/sub/escondido.env"
		printf 'OUTRA_COISA=valor-inerte\n' >"${raiz_segredos}/sub/escondido.env"
		chmod "${modo}" "${raiz_segredos}/sub"

		executar_alvo "${base}/saida.out" "${base}/saida.err" env \
			SYSLOC_DIR_CONFIG="${raiz_segredos}" \
			SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
			SYSLOC_DESTINO_DA_CHAVE="${raiz_chave}" \
			bash "${SCRIPT_SEGREDOS}"

		chmod 700 "${raiz_segredos}/sub"

		afirmar_igual "raiz ${perna}: o código de saída" \
			"${codigo_esperado}" "${CODIGO_DO_ALVO}"
		afirmar_igual "raiz ${perna}: pacotes publicados" \
			"${pacotes_esperados}" "$(contar_por_padrao "${raiz_backup}/segredos" '*.tar.gz')"
		afirmar_igual "raiz ${perna}: resíduo .parcial no destino dos pacotes" \
			"0" "$(contar_por_padrao "${raiz_backup}/segredos" '*.parcial')"
		afirmar_igual "raiz ${perna}: resíduo .parcial no destino da chave" \
			"0" "$(contar_por_padrao "${raiz_chave}" '*.parcial')"

		if [[ "${codigo_esperado}" -eq 1 ]]; then
			afirmar_contem "raiz ${perna}: a recusa nomeia a árvore que não pôde ser lida por inteiro" \
				"NÃO pôde ser lida por inteiro" "$(cat "${base}/saida.err")"
			afirmar_contem "raiz ${perna}: a recusa CITA o diagnóstico da travessia" \
				"${raiz_segredos}/sub" "$(cat "${base}/saida.err")"
			afirmar_igual "raiz ${perna}: a chave não foi preservada em destino nenhum" \
				"" "$(listar_nomes "${raiz_chave}")"
			afirmar_igual "raiz ${perna}: a recusa não ecoa o valor da chave" \
				"0" "$(grep -cF -e "${CHAVE_SENTINELA}" "${base}/saida.err" || true)"
		else
			# O controle que discrimina: o MESMO arranjo com a subárvore legível
			# publica, e o membro escondido está DENTRO do pacote.
			afirmar_igual "raiz ${perna}: o pacote leva os TRÊS membros, inclusive o da subárvore" \
				"backend.env migracao.env sub/escondido.env" \
				"$(tar -tzf "${raiz_backup}/segredos/"*.tar.gz |
					LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')"
			afirmar_igual "raiz ${perna}: a chave foi preservada em destino próprio" \
				"1" "$(contar_por_padrao "${raiz_chave}" 'chave-de-cifra-*.env')"
		fi
	done <<-'TABELA'
		ilegivel 000 1 0
		legivel 700 0 1
	TABELA
}

# =========================================================================== #
# CT-1104 — a credencial não escapa por nenhum dos cinco canais de saída.
#
# INVARIANTE: a senha do banco e a chave de cifra não aparecem em nenhum dos
# cinco canais, e a varredura que o afirma SABE ACHÁ-LAS.
#
# ⚠️ Os canais 3 e 4 são de NOMES, e não de conteúdo: o pacote de segredos e o
# arquivo da chave carregam segredo POR DESENHO — varrer o conteúdo deles
# acusaria a própria entrega, não um vazamento.
# =========================================================================== #
ct_1104() {
	caso "CT-1104" "a credencial não escapa por nenhum dos cinco canais de saída"

	local base="${DIR_TRABALHO}/ct-1104"
	local raiz_backup="${base}/backup" raiz_chave="${base}/chave" raiz_segredos="${base}/etc"
	local temporario="${base}/temporario" canais="${base}/canais"
	mkdir -p "${raiz_backup}" "${raiz_chave}" "${temporario}" "${canais}"
	montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

	executar_alvo "${base}/copia.out" "${base}/copia.err" env \
		TMPDIR="${temporario}" \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		bash "${SCRIPT_COPIAR}"
	afirmar_igual "a cópia termina com sucesso" "0" "${CODIGO_DO_ALVO}"

	executar_alvo "${base}/segredos.out" "${base}/segredos.err" env \
		TMPDIR="${temporario}" \
		SYSLOC_DIR_CONFIG="${raiz_segredos}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		SYSLOC_DESTINO_DA_CHAVE="${raiz_chave}" \
		bash "${SCRIPT_SEGREDOS}"
	afirmar_igual "a preservação dos segredos termina com sucesso" "0" "${CODIGO_DO_ALVO}"

	cat "${base}/copia.out" "${base}/segredos.out" >"${canais}/saida-padrao"
	cat "${base}/copia.err" "${base}/segredos.err" >"${canais}/saida-de-erro"
	find "${raiz_backup}/daily" -printf '%P\n' 2>/dev/null >"${canais}/nomes-no-destino-da-copia"
	{
		find "${raiz_backup}/segredos" -printf '%P\n' 2>/dev/null
		find "${raiz_chave}" -printf '%P\n' 2>/dev/null
	} >"${canais}/nomes-no-destino-dos-segredos"
	# `-r` no `xargs` é o que impede `cat` sem argumento de ficar lendo a entrada
	# padrão quando não sobrou resíduo nenhum — que é justamente o caso esperado.
	find "${temporario}" -type f -print0 2>/dev/null |
		xargs -0 -r cat >"${canais}/residuo-temporario" 2>/dev/null || true

	# ÂNCORA ANTIVÁCUO: os cinco canais existem e o principal tem conteúdo. Sem
	# isto, cinco arquivos vazios passariam limpos por não terem sido olhados.
	local canal presentes=0
	for canal in "${CANAIS_DE_SAIDA[@]}"; do
		[[ -f "${canais}/${canal}" ]] && presentes=$((presentes + 1))
	done
	afirmar_igual "os cinco canais foram capturados" "5" "${presentes}"
	afirmar_diferente "o canal da saída padrão tem conteúdo" "" "$(cat "${canais}/saida-padrao")"

	local achados
	achados="$(varrer_canais "${canais}" "${SENHA_SENTINELA}")" || true
	afirmar_igual "a senha do banco não aparece em canal nenhum" "" "${achados}"

	achados="$(varrer_canais "${canais}" "${CHAVE_SENTINELA}")" || true
	afirmar_igual "a chave de cifra não aparece em canal nenhum" "" "${achados}"

	# CONTROLE POSITIVO — a MESMA varredura, com a sentinela plantada canal a
	# canal. A lista de achados é afirmada por IGUALDADE, e não por contagem: uma
	# varredura que só olhasse um canal e o repetisse cinco vezes daria 5 também.
	local controle="${base}/controle"
	mkdir -p "${controle}"
	for canal in "${CANAIS_DE_SAIDA[@]}"; do
		cp "${canais}/${canal}" "${controle}/${canal}"
		printf '%s\n' "${SENHA_SENTINELA}" >>"${controle}/${canal}"
	done

	local codigo_da_varredura=0
	achados="$(varrer_canais "${controle}" "${SENHA_SENTINELA}")" || codigo_da_varredura=$?
	afirmar_igual "o controle positivo acha a sentinela nos CINCO canais" \
		"${CANAIS_DE_SAIDA[*]}" "${achados}"
	afirmar_igual "a varredura acusa o controle" "1" "${codigo_da_varredura}"

	fechar_caso "CT-1104"
}

# =========================================================================== #
# CT-1105 — nenhum dos dois scripts carrega credencial em linha de comando nem
# liga rastreio de shell, e a auditoria que o afirma PODE FALHAR.
#
# INVARIANTE: nos dois scripts, as quatro formas ocorrem ZERO vezes, e existe ao
# menos uma referência ao arquivo de credencial.
#
# ⚠️ Asserção ESTÁTICA — ela inspeciona o texto do alvo em vez de exercitá-lo, e
# por isso a prova de falsificação é obrigatória (`.claude/rules/testing-stack.md`).
# A função de auditoria é UMA SÓ, aplicada ao alvo e ao mutante: reimplementá-la
# para o mutante aprovaria 2/2 um alvo com o defeito de volta.
#
# O mutante vive SEMPRE em diretório temporário. Plantá-lo na árvore de trabalho
# deixaria um script com credencial versionável se a bateria morresse no meio.
# =========================================================================== #
ct_1105() {
	caso "CT-1105" "nenhum script carrega credencial em linha de comando nem liga rastreio de shell"

	# ⚠️ O elenco cresceu com a T3, e a razão é a mesma que fez o caso nascer: um
	# script de produção desta pasta que fala com o banco e NÃO estivesse aqui
	# ficaria fora da varredura de credencial em linha de comando. As asserções
	# por script são as mesmas, uma a uma.
	local script codigo achados
	for script in "${SCRIPT_COPIAR}" "${SCRIPT_SEGREDOS}" "${SCRIPT_RESTAURAR}"; do
		codigo=0
		achados="$(auditar_credencial_em_argv "${script}")" || codigo=$?
		afirmar_igual "$(basename "${script}"): a auditoria não acha nada" "" "${achados}"
		afirmar_igual "$(basename "${script}"): a auditoria não acusa" "0" "${codigo}"
	done

	# A referência é exigida de quem FALA COM O BANCO: sem ela, o script não
	# estaria entregando o segredo por arquivo de modo restrito.
	local referencias
	referencias="$(contar_referencias_ao_arquivo_de_credencial "${SCRIPT_COPIAR}")"
	if [[ "${referencias}" -ge 1 ]]; then
		ok "copiar-base.sh referencia ${REFERENCIA_AO_ARQUIVO_DE_CREDENCIAL} ${referencias} vez(es) — o segredo vem de arquivo"
	else
		falhar "copiar-base.sh não referencia ${REFERENCIA_AO_ARQUIVO_DE_CREDENCIAL} — o segredo não estaria vindo de arquivo de modo restrito"
	fi

	# PROVA DE FALSIFICAÇÃO. As linhas defeituosas são montadas em pedaços de
	# propósito: escritas inteiras, o texto desta bateria casaria com os próprios
	# padrões que ela procura.
	local mutante="${DIR_TRABALHO}/mutante-copiar-base.sh"
	cp "${SCRIPT_COPIAR}" "${mutante}"

	# Controle limpo no MESMO arreio: a cópia intacta continua passando.
	codigo=0
	achados="$(auditar_credencial_em_argv "${mutante}")" || codigo=$?
	afirmar_igual "a cópia íntegra passa limpa no mesmo arreio" "0" "${codigo}"

	printf 'set %s\n' '-x' >>"${mutante}"
	printf 'psql --pass%s"s3nh4RealDoBanco" -h 127.0.0.1\n' 'word=' >>"${mutante}"

	codigo=0
	achados="$(auditar_credencial_em_argv "${mutante}")" || codigo=$?
	afirmar_igual "a auditoria REPROVA o script com os defeitos de volta" "1" "${codigo}"
	afirmar_igual "a auditoria acha exatamente duas ocorrências" "2" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "cada achado nomeia a forma e a linha" \
		"${FORMA_ARGUMENTO} ${FORMA_RASTREIO}" \
		"$(printf '%s\n' "${achados}" | cut -d: -f1 | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "os dois achados trazem número de linha" \
		"2" "$(printf '%s\n' "${achados}" | cut -d: -f2 | grep -cE '^[0-9]+$' || true)"

	fechar_caso "CT-1105"
}

# =========================================================================== #
# CT-1106 — destino preexistente com modo frouxo é CORRIGIDO.
#
# INVARIANTE: o modo é corrigido a cada execução, e não apenas acertado na
# criação. O caso comum é o diretório que já existe frouxo, e ele não se conserta
# sozinho.
#
# ⚠️ Afirmado por IGUALDADE, nunca por "não é mais frouxo que": `750` também é
# menos frouxo que `755`, e ainda assim expõe o acervo ao grupo.
# =========================================================================== #
ct_1106() {
	caso "CT-1106" "destino preexistente com modo frouxo é corrigido, e não só acertado na criação"

	local base="${DIR_TRABALHO}/ct-1106"
	local raiz_backup="${base}/backup" raiz_chave="${base}/chave" raiz_segredos="${base}/etc"
	mkdir -p "${raiz_backup}/daily" "${raiz_backup}/segredos" "${raiz_chave}"
	montar_raiz_de_segredos "${raiz_segredos}" "${CHAVE_SENTINELA}"

	# O arranjo: tudo preexistente e frouxo.
	chmod 755 "${raiz_backup}" "${raiz_backup}/daily" "${raiz_backup}/segredos" "${raiz_chave}"
	afirmar_igual "o arranjo começa com o destino frouxo" "755" "$(modo_de "${raiz_backup}/daily")"

	# A máscara também é frouxa: sem a correção explícita, os artefatos nasceriam
	# legíveis a terceiros.
	local umask_anterior
	umask_anterior="$(umask)"
	umask 022

	executar_alvo "${base}/copia.out" "${base}/copia.err" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		bash "${SCRIPT_COPIAR}"
	local codigo_da_copia="${CODIGO_DO_ALVO}"

	executar_alvo "${base}/segredos.out" "${base}/segredos.err" env \
		SYSLOC_DIR_CONFIG="${raiz_segredos}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz_backup}" \
		SYSLOC_DESTINO_DA_CHAVE="${raiz_chave}" \
		bash "${SCRIPT_SEGREDOS}"
	local codigo_dos_segredos="${CODIGO_DO_ALVO}"

	umask "${umask_anterior}"

	afirmar_igual "a cópia termina com sucesso sob máscara frouxa" "0" "${codigo_da_copia}"
	afirmar_igual "a preservação termina com sucesso sob máscara frouxa" "0" "${codigo_dos_segredos}"

	local data
	data="$(date +%F)"

	afirmar_igual "a raiz do backup ficou 700" "700" "$(modo_de "${raiz_backup}")"
	afirmar_igual "o destino das cópias ficou 700" "700" "$(modo_de "${raiz_backup}/daily")"
	afirmar_igual "o destino dos pacotes ficou 700" "700" "$(modo_de "${raiz_backup}/segredos")"
	afirmar_igual "o destino da chave ficou 700" "700" "$(modo_de "${raiz_chave}")"

	afirmar_igual "a cópia da base ficou 600" \
		"600" "$(modo_de "${raiz_backup}/daily/base-${data}.dump")"
	afirmar_igual "o pacote de segredos ficou 600" \
		"600" "$(modo_de "${raiz_backup}/segredos/segredos-${data}.tar.gz")"
	afirmar_igual "o arquivo da chave ficou 600" \
		"600" "$(modo_de "${raiz_chave}/chave-de-cifra-${data}.env")"

	ct_1106_vinculo_no_destino

	fechar_caso "CT-1106"
}

# =========================================================================== #
# CT-1106 (b) — destino que é VÍNCULO SIMBÓLICO recusa, e não é seguido.
#
# INVARIANTE: o diretório ALVO do vínculo não tem o modo alterado nem o acervo
# expurgado, nos DOIS modos do procedimento.
#
# ⚠️ É a negativa do caso positivo acima, e ela existe porque a correção de modo
# é feita com `chmod` sem `-h`: um destino apontando para a preservação do
# sistema legado faria esta rotina reescrever o modo do diretório alheio, e o
# expurgo agiria por idade sobre o acervo dele.
#
# O modo do alvo começa em 755 DE PROPÓSITO: é o valor que o CT-1106 acima prova
# que esta rotina corrige. Se o vínculo fosse seguido, ele viraria 700 — e é essa
# a diferença que a asserção observa.
# =========================================================================== #
ct_1106_vinculo_no_destino() {
	local base="${DIR_TRABALHO}/ct-1106-vinculo"
	local raiz="${base}/backup" alheia="${base}/alheia"
	mkdir -p "${raiz}" "${alheia}/daily"
	chmod 755 "${alheia}" "${alheia}/daily"

	local agora
	agora="$(date +%s)"
	: >"${alheia}/daily/preservacao-alheia.dump"
	touch -d "@$((agora - DIAS_DO_ORFAO_ANTIGO * SEGUNDOS_POR_DIA))" \
		"${alheia}/daily/preservacao-alheia.dump"

	ln -s "${alheia}/daily" "${raiz}/daily"

	executar_alvo "${base}/copia.out" "${base}/copia.err" env \
		SYSLOC_ARQ_AMBIENTE="${AMBIENTE_PRINCIPAL}" \
		SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
		bash "${SCRIPT_COPIAR}"

	afirmar_igual "vínculo no destino: a cópia termina com código de falha" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_contem "vínculo no destino: a recusa nomeia o vínculo simbólico" \
		"é um vínculo simbólico" "$(cat "${base}/copia.err")"
	afirmar_igual "vínculo no destino: o modo do diretório ALVO não foi alterado" \
		"755" "$(modo_de "${alheia}/daily")"
	afirmar_igual "vínculo no destino: nada foi publicado na árvore alheia" \
		"preservacao-alheia.dump" "$(listar_nomes "${alheia}/daily")"

	executar_alvo "${base}/expurgo.out" "${base}/expurgo.err" env \
		SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
		bash "${SCRIPT_COPIAR}" expurgar

	afirmar_igual "vínculo no destino: o expurgo termina com código de falha" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_igual "vínculo no destino: a cópia VENCIDA da árvore alheia continua lá" \
		"preservacao-alheia.dump" "$(listar_nomes "${alheia}/daily")"
	afirmar_igual "vínculo no destino: o modo do diretório ALVO segue intacto após o expurgo" \
		"755" "$(modo_de "${alheia}/daily")"
}

# =========================================================================== #
# Arranjo comum e execução.
# =========================================================================== #
AMBIENTE_PRINCIPAL=""
PORTA_PRINCIPAL=""

# Esta bateria recusa root: o preparo de instância de banco não roda como
# superusuário, e ela levanta duas. A conferência fica ANTES de tudo — abortar no
# meio do arranjo produziria uma mensagem do preparador, e não a razão real.
#
# ⚠️ A FORMA da condição importa, e este comentário é escrito com cuidado por
# isso: `rodar-baterias.sh` decide quem roda com privilégio grepando o texto da
# bateria por duas marcas — o nome da função de exigência e a comparação de
# identidade efetiva DIFERENTE de zero. Escrever a recusa como `-eq 0`, e não
# citar aqui nenhuma das duas marcas por extenso, é o que mantém esta bateria
# fora daquele conjunto. Citá-las literalmente faria o agregador executá-la como
# root — e ela abortaria no guarda logo abaixo.
# =========================================================================== #
# CT-1107 — a restauração REPRODUZ a origem, conferida por conjunto e por
# contagem.
#
# INVARIANTE: o alvo só sai 0 depois de CONFERIR o destino contra a cópia —
# nunca por o restaurador ter terminado.
#
# ⚠️ A medição do destino ANTES é o controle antivácuo do caso: sem ela, um
# destino que já trouxesse as três relações aprovaria a asserção de depois sem
# que restauração alguma tivesse acontecido.
# =========================================================================== #
ct_1107() {
	caso "CT-1107" "a restauração reproduz a origem, conferida por conjunto e por contagem"

	local destino="destino_ct1107"
	criar_base_vazia "${destino}"

	afirmar_igual "antes: o destino não tem relação alguma (controle antivácuo)" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	local resposta="${DIR_TRABALHO}/ct-1107.resposta"
	escrever_resposta "${resposta}" "${TOKEN_DO_ALVO}"

	executar_restauracao "ct-1107" "${AMBIENTE_PRINCIPAL}" "${destino}" \
		"${COPIA_PRINCIPAL}" "restaurar" "${resposta}"

	afirmar_igual "a restauração termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${ERRO_DA_RESTAURACAO}" >&2
		fechar_caso "CT-1107"
		return
	fi

	# IGUALDADE DE CONJUNTO, nunca contenção: contenção aprovaria um destino com
	# relações a mais, que numa base que começou vazia é anomalia.
	afirmar_igual "depois: o destino tem exatamente as três relações semeadas" \
		"public.a public.b public.c" "$(relacoes_da_base "${destino}")"
	afirmar_igual "depois: o destino tem as sete linhas semeadas" \
		"7" "$(contar_linhas_da_base "${destino}")"

	# O resumo é conteúdo: é a única coisa que o operador lê no fim, e é ele que
	# afirma que a conferência aconteceu.
	afirmar_igual "o resumo declara os dois números conferidos" \
		"1" "$(grep -cF 'relacoes=3 linhas=7' "${SAIDA_DA_RESTAURACAO}" || true)"

	fechar_caso "CT-1107"
}

# =========================================================================== #
# CT-1108 — base não vazia é RECUSADA, e o conteúdo dela permanece intacto.
#
# INVARIANTE: a recusa acontece ANTES de qualquer escrita, e o destino sai da
# execução idêntico ao que entrou.
#
# ⚠️ A linha `apenas-uma-sequencia` é O DISCRIMINADOR do caso: um guarda que
# contasse TABELAS declararia vazia uma base que só tem uma sequência, a
# restauração colidiria no meio e o destino ficaria em estado misto. A linha da
# tabela alheia sozinha não distingue os dois guardas.
# =========================================================================== #
ct_1108() {
	caso "CT-1108" "base não vazia é recusada, e o conteúdo dela permanece intacto"

	# Campos: rótulo | base | semeadura | agulha da contagem no diagnóstico
	local -a NAO_VAZIAS=(
		"tabela-alheia|destino_ct1108_tabela|CREATE TABLE alheia(i int); INSERT INTO alheia SELECT generate_series(1,4);|relacoes=1"
		"apenas-uma-sequencia|destino_ct1108_sequencia|CREATE SEQUENCE apenas_uma;|relacoes=1"
	)

	local linha rotulo destino semeadura agulha antes
	local resposta="${DIR_TRABALHO}/ct-1108.resposta"
	escrever_resposta "${resposta}" "${TOKEN_DO_ALVO}"

	for linha in "${NAO_VAZIAS[@]}"; do
		IFS='|' read -r rotulo destino semeadura agulha <<<"${linha}"

		criar_base_vazia "${destino}"
		consultar_base "${destino}" "${semeadura}" >/dev/null
		antes="$(relacoes_da_base "${destino}")"

		afirmar_diferente "${rotulo}: o arranjo deixou o destino NÃO vazio" "" "${antes}"

		executar_restauracao "ct-1108-${rotulo}" "${AMBIENTE_PRINCIPAL}" "${destino}" \
			"${COPIA_PRINCIPAL}" "restaurar" "${resposta}"

		afirmar_igual "${rotulo}: termina com código de falha" "1" "${CODIGO_DO_ALVO}"
		afirmar_contem "${rotulo}: a recusa nomeia a base de destino" \
			"${destino}" "$(cat "${ERRO_DA_RESTAURACAO}")"
		afirmar_contem "${rotulo}: a recusa nomeia a contagem que ela observou" \
			"${agulha}" "$(cat "${ERRO_DA_RESTAURACAO}")"

		# IGUALDADE com o de ANTES: é o que separa "recusou" de "recusou sem
		# escrever". Uma asserção de "não tem as tabelas da origem" sozinha passaria
		# num destino que tivesse sido esvaziado pelo próprio alvo.
		afirmar_igual "${rotulo}: o conteúdo do destino está idêntico ao de antes" \
			"${antes}" "$(relacoes_da_base "${destino}")"
		afirmar_igual "${rotulo}: nenhuma relação da origem existe no destino" \
			"0" "$(consultar_base "${destino}" "
				SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
				 WHERE n.nspname = 'public' AND c.relname IN ('a','b','c')")"
	done

	fechar_caso "CT-1108"
}

# =========================================================================== #
# CT-1109 — o ensaio LISTA e NÃO ESCREVE, e não depende de interação.
#
# INVARIANTE: o ensaio percorre tudo, exibe o conteúdo e termina sem escrever —
# e sem nunca ler a entrada padrão.
#
# ⚠️ São DUAS pernas, e a segunda é a que discrimina. Com a entrada FECHADA, um
# alvo que tentasse ler receberia erro imediato e terminaria mesmo assim: a
# perna (a) não distingue "não lê" de "leu e falhou". A perna (b) liga a entrada
# a um canal COM ESCRITOR e sem dado, onde uma leitura BLOQUEIA — e o limite de
# tempo transforma o bloqueio em reprovação nomeada, em vez de pendurar a
# bateria.
# =========================================================================== #
ct_1109() {
	caso "CT-1109" "o ensaio lista e não escreve"

	local destino="destino_ct1109"
	criar_base_vazia "${destino}"
	afirmar_igual "antes: o destino não tem relação alguma (controle antivácuo)" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	# --- (a) entrada padrão FECHADA ---------------------------------------- #
	executar_restauracao "ct-1109-fechada" "${AMBIENTE_PRINCIPAL}" "${destino}" \
		"${COPIA_PRINCIPAL}" "ensaio" "FECHADA"

	afirmar_igual "(a) com a entrada padrão fechada, o ensaio termina com sucesso" \
		"0" "${CODIGO_DO_ALVO}"
	afirmar_diferente "(a) o ensaio não estourou o limite de tempo" \
		"124" "${CODIGO_DO_ALVO}"

	local esperado
	esperado="$(entradas_do_indice "${COPIA_PRINCIPAL}")"
	afirmar_diferente "(a) o índice da cópia não está vazio (controle antivácuo)" "" "${esperado}"
	afirmar_igual "(a) a lista exibida é igual, como conjunto, à do arquivo" \
		"${esperado}" "$(entradas_exibidas_pelo_alvo "${SAIDA_DA_RESTAURACAO}")"

	afirmar_igual "(a) o destino continua sem relação alguma" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	# --- (b) entrada padrão ligada a um canal que NUNCA recebe dado --------- #
	local canal="${DIR_TRABALHO}/ct-1109.canal"
	mkfifo "${canal}"
	# O descritor 9 mantém o canal COM ESCRITOR: sem ele a abertura para leitura
	# bloquearia o próprio arranjo, e nada seria medido.
	exec 9<>"${canal}"

	executar_restauracao "ct-1109-canal" "${AMBIENTE_PRINCIPAL}" "${destino}" \
		"${COPIA_PRINCIPAL}" "ensaio" "${canal}"

	exec 9>&-

	afirmar_igual "(b) com a entrada aberta e muda, o ensaio termina com sucesso" \
		"0" "${CODIGO_DO_ALVO}"
	afirmar_diferente "(b) o ensaio NÃO bloqueou aguardando a entrada padrão" \
		"124" "${CODIGO_DO_ALVO}"
	afirmar_igual "(b) o destino continua sem relação alguma" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	fechar_caso "CT-1109"
}

# =========================================================================== #
# CT-1110 — sem o token EXATO a restauração não acontece.
#
# INVARIANTE: a confirmação é comparada LITERALMENTE contra a constante do alvo.
#
# ⚠️ O token é LIDO do alvo, e as cinco respostas recusadas são DERIVADAS dele —
# a minúscula por transformação, a de espaço por concatenação. Reescrever a
# palavra aqui poria o alvo sob prova nos dois lados da comparação, e a asserção
# não poderia falhar.
#
# ⚠️ A sexta linha é o ANTIVÁCUO do próprio caso: sem ela, um alvo que recusasse
# TUDO passaria nas cinco primeiras.
# =========================================================================== #
ct_1110() {
	caso "CT-1110" "sem o token exato a restauração não acontece"

	local token_minusculo
	token_minusculo="$(printf '%s' "${TOKEN_DO_ALVO}" | tr '[:upper:]' '[:lower:]')"
	afirmar_diferente "o token em minúsculas difere do token do alvo" \
		"${TOKEN_DO_ALVO}" "${token_minusculo}"

	# Campos: rótulo | resposta entregue | código esperado | relações esperadas
	local -a RESPOSTAS=(
		"vazia||1|0"
		"sim|sim|1|0"
		"inicial|s|1|0"
		"minusculo|${token_minusculo}|1|0"
		"com-espaco|${TOKEN_DO_ALVO} |1|0"
		"exato|${TOKEN_DO_ALVO}|0|3"
	)

	local linha rotulo resposta codigo_esperado relacoes_esperadas
	local destino arq_resposta
	for linha in "${RESPOSTAS[@]}"; do
		IFS='|' read -r rotulo resposta codigo_esperado relacoes_esperadas <<<"${linha}"

		destino="destino_ct1110_${rotulo//-/_}"
		criar_base_vazia "${destino}"
		afirmar_igual "${rotulo}: o destino começa sem relação alguma" \
			"0" "$(contar_relacoes_da_base "${destino}")"

		arq_resposta="${DIR_TRABALHO}/ct-1110-${rotulo}.resposta"
		escrever_resposta "${arq_resposta}" "${resposta}"

		executar_restauracao "ct-1110-${rotulo}" "${AMBIENTE_PRINCIPAL}" "${destino}" \
			"${COPIA_PRINCIPAL}" "restaurar" "${arq_resposta}"

		afirmar_igual "${rotulo}: o código de saída é o esperado" \
			"${codigo_esperado}" "${CODIGO_DO_ALVO}"
		afirmar_igual "${rotulo}: o destino tem exatamente ${relacoes_esperadas} relação(ões)" \
			"${relacoes_esperadas}" "$(contar_relacoes_da_base "${destino}")"
	done

	fechar_caso "CT-1110"
}

# =========================================================================== #
# CT-1111 — o conteúdo é exibido ANTES de escrever, inclusive quando a execução
# termina em recusa.
#
# INVARIANTE: a listagem completa já saiu quando a confirmação é negada.
#
# ⚠️ A ordem é verificada pelo EFEITO, nunca pela leitura do fonte: um teste que
# grepasse a posição das linhas no script aprovaria um alvo que listasse depois
# de já ter restaurado em memória. Aqui o que se afirma é que a listagem INTEIRA
# está na saída de uma execução que NÃO escreveu nada.
# =========================================================================== #
ct_1111() {
	caso "CT-1111" "o conteúdo é exibido antes de escrever, inclusive quando termina em recusa"

	local destino="destino_ct1111"
	criar_base_vazia "${destino}"
	afirmar_igual "antes: o destino não tem relação alguma (controle antivácuo)" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	local resposta="${DIR_TRABALHO}/ct-1111.resposta"
	escrever_resposta "${resposta}" "nao"

	executar_restauracao "ct-1111" "${AMBIENTE_PRINCIPAL}" "${destino}" \
		"${COPIA_PRINCIPAL}" "restaurar" "${resposta}"

	afirmar_igual "com a confirmação negada, termina com código de falha" "1" "${CODIGO_DO_ALVO}"

	local esperado
	esperado="$(entradas_do_indice "${COPIA_PRINCIPAL}")"
	afirmar_diferente "o índice da cópia não está vazio (controle antivácuo)" "" "${esperado}"
	afirmar_igual "a listagem está COMPLETA na saída da execução recusada" \
		"${esperado}" "$(entradas_exibidas_pelo_alvo "${SAIDA_DA_RESTAURACAO}")"

	afirmar_igual "o destino continua sem relação alguma" \
		"0" "$(contar_relacoes_da_base "${destino}")"

	fechar_caso "CT-1111"
}

# =========================================================================== #
# CT-1112 — a recusa do destino que ATENDE A OPERAÇÃO é TERMINAL, e isso é
# provado pelo EFEITO.
#
# INVARIANTE (ADR-0006): apontado para a base que atende a operação, o alvo
# recusa e ABORTA ANTES DE ABRIR CONEXÃO com ela.
#
# ⚠️ A asserção que discrimina NÃO é o código de saída, e nem o texto da
# mensagem. É a MEDIÇÃO DA CONEXÃO, feita no diário do servidor da instância
# efêmera: a base da operação usada aqui NÃO EXISTE no agrupamento, de modo que
# qualquer tentativa de conectar-se a ela deixa `database "…" does not exist`
# registrado. Zero registros é a única evidência de que a recusa aconteceu antes
# de qualquer conexão.
#
# A razão de a asserção ser essa está medida no passo (4) abaixo: com a recusa
# trocada por um aviso que devolve o controle, o alvo AINDA SAI 1 e AINDA IMPRIME
# a ADR — porque ele falha adiante, ao não achar a base. Provar o predicado, a
# posição e o texto deixaria passar exatamente esse defeito, que é o terceiro dos
# padrões de reprovação registrados em `.claude/rules/testing-stack.md`.
#
# Quatro passos: (1) comportamental nas duas formas · (2) auditoria estática da
# ordem no fonte · (3) falsificação da estática · (4) falsificação complementar,
# que troca a recusa terminal por recusa que devolve o controle e mostra a perna
# comportamental REPROVANDO.
# =========================================================================== #
ct_1112() {
	caso "CT-1112" "o destino que atende à operação é recusado, e a recusa é terminal"

	local base_da_operacao="op_ct1112_${NONCE_DA_EXECUCAO}"
	local ambiente="${DIR_TRABALHO}/ct-1112-operacao.env"
	escrever_ambiente_para "${base_da_operacao}" "${ambiente}"

	# PRÉ-CONDIÇÃO do caso: a base da operação NÃO existe no agrupamento efêmero.
	# É ela que torna a asserção discriminante — um alvo SEM guarda falharia por
	# outra razão, e a medição da conexão separa os dois desfechos.
	afirmar_igual "a base da operação usada aqui não existe no agrupamento" \
		"0" "$(consultar_base postgres "SELECT count(*) FROM pg_database WHERE datname = '${base_da_operacao}'")"

	# CONTROLE ANTIVÁCUO DA MEDIÇÃO: o diário do servidor registra, sim, uma
	# tentativa de conexão a base inexistente. Sem isto, o zero afirmado adiante
	# seria compatível com um diário que nunca registra nada.
	local sonda="op_sonda_${NONCE_DA_EXECUCAO}"
	consultar_base "${sonda}" "SELECT 1" >/dev/null 2>&1 || true
	afirmar_diferente "o diário do servidor registra tentativa de conexão a base inexistente" \
		"0" "$(tentativas_de_conexao_a "${sonda}")"

	# --- (1) perna comportamental, nas duas formas -------------------------- #
	#
	# Campos: rótulo | valor de SYSLOC_BANCO_DE_DESTINO
	#
	# A segunda forma é o footgun documentado do cliente: um `dbname` que se
	# pareça com cadeia de conexão é EXPANDIDO, e resolve para a MESMA base. Uma
	# guarda que só comparasse texto deixaria essa porta aberta.
	local -a FORMAS_DO_DESTINO=(
		"literal|${base_da_operacao}"
		"expandida|postgresql://127.0.0.1:${PORTA_PRINCIPAL}/${base_da_operacao}"
	)

	local linha rotulo destino
	for linha in "${FORMAS_DO_DESTINO[@]}"; do
		IFS='|' read -r rotulo destino <<<"${linha}"

		executar_restauracao "ct-1112-${rotulo}" "${ambiente}" "${destino}" \
			"${COPIA_PRINCIPAL}" "restaurar" "FECHADA"

		afirmar_igual "${rotulo}: termina com código de falha" "1" "${CODIGO_DO_ALVO}"
		afirmar_contem "${rotulo}: a recusa nomeia a ADR-0006" \
			"ADR-0006" "$(cat "${ERRO_DA_RESTAURACAO}")"
		afirmar_contem "${rotulo}: a recusa nomeia a base recusada" \
			"${base_da_operacao}" "$(cat "${ERRO_DA_RESTAURACAO}")"
	done

	# A medição do EFEITO TERMINAL, depois das duas formas: nenhuma conexão foi
	# aberta com a base da operação.
	afirmar_igual "nenhuma conexão foi aberta com a base que atende à operação" \
		"0" "$(tentativas_de_conexao_a "${base_da_operacao}")"

	ct_1112_ordem_no_fonte
	ct_1112_recusa_nao_terminal
	ct_1112_arquivo_real

	fechar_caso "CT-1112"
}

# --- (2) e (3): a auditoria estática da ordem, e a falsificação dela -------- #
#
# ⚠️ Asserção ESTÁTICA: ela lê o TEXTO do alvo em vez de exercitá-lo, e por isso
# a prova de falsificação abaixo é obrigatória (`.claude/rules/testing-stack.md`,
# P4 de `.claude/rules/nao-regressao.md`). A função de auditoria é UMA SÓ,
# aplicada ao alvo e aos mutantes: reimplementá-la para o mutante aprovaria 2/2
# uma auditoria que não discrimina nada.
#
# Os mutantes vivem em diretório temporário e NUNCA na árvore de trabalho: um
# `restaurar-base.sh` adulterado versionado é pior que a lacuna que ele prova.
ct_1112_ordem_no_fonte() {
	local codigo=0 achados
	achados="$(auditar_guarda_antes_do_destino "${SCRIPT_RESTAURAR}")" || codigo=$?
	afirmar_igual "(estática) a auditoria não acha anomalia de ordem no alvo" "" "${achados}"
	afirmar_igual "(estática) a auditoria não acusa o alvo" "0" "${codigo}"

	# Mutante A — a guarda some de `main`.
	local mutante_sem_guarda="${DIR_TRABALHO}/mutante-sem-guarda.sh"
	awk -v guarda="${GUARDA_DA_ADR_0006}" '
		/^main\(\) \{$/ { dentro = 1 }
		dentro && $0 ~ ("^\t" guarda "$") { next }
		{ print }
	' "${SCRIPT_RESTAURAR}" >"${mutante_sem_guarda}"

	codigo=0
	achados="$(auditar_guarda_antes_do_destino "${mutante_sem_guarda}")" || codigo=$?
	afirmar_igual "(estática) a auditoria REPROVA o alvo sem a guarda em main" "1" "${codigo}"
	afirmar_igual "(estática) sem a guarda, a auditoria acha exatamente um achado" \
		"1" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "(estática) o achado nomeia a forma e o símbolo" \
		"guarda-ausente-em-main:0:${GUARDA_DA_ADR_0006}" "${achados}"

	# Mutante B — a guarda continua lá, mas DEPOIS da primeira chamada que alcança
	# o destino. Ele é o que prova que a auditoria mede ORDEM, e não presença: o
	# mutante A sozinho ficaria verde num alvo que consultasse a guarda no fim.
	local mutante_fora_de_ordem="${DIR_TRABALHO}/mutante-guarda-fora-de-ordem.sh"
	awk -v guarda="${GUARDA_DA_ADR_0006}" '
		/^main\(\) \{$/ { dentro = 1 }
		dentro && $0 ~ ("^\t" guarda "$") { next }
		dentro && /^\tlistar_conteudo_da_copia$/ { print "\t" guarda }
		{ print }
	' "${SCRIPT_RESTAURAR}" >"${mutante_fora_de_ordem}"

	codigo=0
	achados="$(auditar_guarda_antes_do_destino "${mutante_fora_de_ordem}")" || codigo=$?
	afirmar_igual "(estática) a auditoria REPROVA a guarda posta fora de ordem" "1" "${codigo}"
	afirmar_igual "(estática) fora de ordem, o achado nomeia a chamada que a precede" \
		"destino-antes-da-guarda" "$(printf '%s' "${achados}" | cut -d: -f1 | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/ $//')"

	# Mutante C — nada em `main` alcança o destino. É a ÂNCORA ANTIVÁCUO da
	# própria auditoria: sem ela, um alvo que não falasse com o banco em lugar
	# nenhum passaria na asserção de ordem por não haver ordem a violar.
	local mutante_sem_destino="${DIR_TRABALHO}/mutante-sem-alcance-ao-destino.sh"
	awk '
		/^main\(\) \{$/ { dentro = 1 }
		dentro && /^\t\texigir_destino_vazio$/ { next }
		dentro && /^\t\trestaurar$/ { next }
		dentro && /^\tconferir_resultado$/ { next }
		dentro && /^\tlistar_conteudo_da_copia$/ { next }
		{ print }
	' "${SCRIPT_RESTAURAR}" >"${mutante_sem_destino}"

	codigo=0
	achados="$(auditar_guarda_antes_do_destino "${mutante_sem_destino}")" || codigo=$?
	afirmar_igual "(estática) a auditoria REPROVA um main que não alcança o destino" "1" "${codigo}"
	afirmar_igual "(estática) o achado do vácuo nomeia a própria ausência de alcance" \
		"nada-em-main-alcanca-o-destino:0:main" "${achados}"
}

# --- (4) falsificação COMPLEMENTAR: a recusa deixa de ser terminal ---------- #
#
# O mutante troca a saída de erro da guarda por um aviso que DEVOLVE O CONTROLE,
# preservando o texto. É a forma exata do defeito que a `testing-stack.md`
# registra: a asserção que prova predicado, posição e texto continua verde.
#
# O que este bloco mede é justamente isso — no mutante, o código de saída SEGUE
# sendo 1 e a mensagem SEGUE citando a ADR —, e mostra a única asserção que
# reprova: a da conexão aberta com o destino recusado.
ct_1112_recusa_nao_terminal() {
	local mutante="${DIR_TRABALHO}/mutante-recusa-nao-terminal.sh"
	awk '
		/^recusar_destino_da_operacao\(\) \{$/ {
			print "erro_e_seguir() { erro \"$1\"; return 0; }"
			print
			dentro = 1
			next
		}
		dentro && /^\t\tabortar \\$/ { print "\t\terro_e_seguir \\"; next }
		dentro && /^\}$/ { dentro = 0 }
		{ print }
	' "${SCRIPT_RESTAURAR}" >"${mutante}"

	# O mutante precisa ser executável — um mutante com erro de sintaxe reprovaria
	# por não rodar, e a falsificação não teria provado nada.
	local codigo_da_sintaxe=0
	bash -n "${mutante}" 2>/dev/null || codigo_da_sintaxe=$?
	afirmar_igual "(falsificação) o mutante é sintaticamente executável" "0" "${codigo_da_sintaxe}"
	afirmar_diferente "(falsificação) o mutante difere do alvo" \
		"$(sha256sum <"${SCRIPT_RESTAURAR}")" "$(sha256sum <"${mutante}")"

	local base_do_mutante="op_ct1112_mut_${NONCE_DA_EXECUCAO}"
	local ambiente="${DIR_TRABALHO}/ct-1112-mutante.env"
	escrever_ambiente_para "${base_do_mutante}" "${ambiente}"

	local base="${DIR_TRABALHO}/ct-1112-mutante"
	local codigo=0
	timeout "${LIMITE_DO_ALVO_S}" env \
		SYSLOC_ARQ_AMBIENTE="${ambiente}" \
		SYSLOC_BANCO_DE_DESTINO="${base_do_mutante}" \
		bash "${mutante}" "${COPIA_PRINCIPAL}" restaurar 0<&- \
		>"${base}.out" 2>"${base}.err" || codigo=$?

	# As DUAS asserções que NÃO discriminam, medidas de propósito: é a prova de
	# que o código de saída e o texto da mensagem, sozinhos, aprovariam o defeito.
	afirmar_igual "(falsificação) no mutante o código de saída CONTINUA 1" "1" "${codigo}"
	afirmar_contem "(falsificação) no mutante a mensagem CONTINUA citando a ADR-0006" \
		"ADR-0006" "$(cat "${base}.err")"

	# A asserção que DISCRIMINA: com a recusa não-terminal, o alvo chegou a abrir
	# conexão com o destino recusado. É ela que REPROVA o mutante, e é por isso
	# que ela é a asserção da perna comportamental acima.
	afirmar_diferente "(falsificação) com a recusa não-terminal, a conexão com o destino recusado ACONTECE" \
		"0" "$(tentativas_de_conexao_a "${base_do_mutante}")"
}

# --- A frente privilegiada: a base REAL que atende à operação -------------- #
#
# A identidade da base da operação vive num arquivo de dono do superusuário, e
# `sudo -n` falha neste host. O caminho legítimo é o do CT-1102 (b): tentar, e
# ao não conseguir emitir `aviso` nomeado SEM contabilizar a asserção como
# aprovada, com a bateria terminando em 2.
#
# ⚠️ Quando o arquivo É legível, o que se faz é ler dele o NOME da base da
# operação e exercitar a guarda com esse valor real DENTRO da caixa de areia,
# pelo mesmo parâmetro documentado (`SYSLOC_ARQ_AMBIENTE`). O alvo NUNCA é
# executado contra o agrupamento que atende à operação — fazê-lo seria violar a
# própria ADR-0006 que este caso existe para provar.
ct_1112_arquivo_real() {
	local arq_real="${ARQ_AMBIENTE_REAL_DA_OPERACAO}"

	if [[ ! -r "${arq_real}" ]]; then
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
		aviso "[ambiente-real] ${arq_real} não é legível por este usuário — a guarda da ADR-0006 NÃO foi medida contra o NOME REAL da base da operação; as duas formas em caixa de areia seguiram medidas; ${MARCA_DO_COMANDO_QUE_MEDIRIA} ${COMANDO_QUE_MEDIRIA_O_AMBIENTE_REAL}"
		return
	fi

	local url_real nome_real
	url_real="$(sed -n 's|^DATABASE_URL=||p' "${arq_real}" | tail -1)"
	nome_real="${url_real##*/}"
	nome_real="${nome_real%%\?*}"
	if [[ -z "${nome_real}" ]]; then
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
		aviso "[ambiente-real] não consegui apurar o nome da base da operação em ${arq_real} — a frente do nome real não tem o que medir; ${MARCA_DO_COMANDO_QUE_MEDIRIA} declarar DATABASE_URL em ${arq_real} na janela assistida"
		return
	fi

	# O ambiente é o da CAIXA DE AREIA, com o NOME REAL no lugar da base: a guarda
	# é exercitada com o valor que ela precisa recusar, sem que uma única conexão
	# saia em direção ao agrupamento que atende à operação.
	local ambiente="${DIR_TRABALHO}/ct-1112-nome-real.env"
	escrever_ambiente_para "${nome_real}" "${ambiente}"

	executar_restauracao "ct-1112-nome-real" "${ambiente}" "${nome_real}" \
		"${COPIA_PRINCIPAL}" "restaurar" "FECHADA"

	afirmar_igual "(nome real) apontado para a base REAL da operação, o alvo recusa" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_contem "(nome real) a recusa nomeia a ADR-0006" \
		"ADR-0006" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_contem "(nome real) a recusa nomeia a base da operação" \
		"${nome_real}" "$(cat "${ERRO_DA_RESTAURACAO}")"
	nota "nome real da base da operação lido de ${arq_real}"
}

# =========================================================================== #
# CT-1113 — restauração INCOMPLETA é acusada, mesmo com o restaurador tendo
# devolvido sucesso.
#
# INVARIANTE: a conferência mede o ESTADO DO DESTINO, e não o código de saída do
# restaurador.
#
# ⚠️ A linha (b) é a que prova o invariante: nela o restaurador terminou BEM — a
# restauração saiu 0 e foi conferida —, e a relação se perde DEPOIS. Uma
# conferência que relesse o desfecho do restaurador não teria o que acusar; a
# que mede o destino acusa, e nomeia a relação que falta.
# =========================================================================== #
ct_1113() {
	caso "CT-1113" "restauração incompleta é acusada, mesmo com o restaurador devolvendo sucesso"

	local resposta="${DIR_TRABALHO}/ct-1113.resposta"
	escrever_resposta "${resposta}" "${TOKEN_DO_ALVO}"

	# --- (a) cópia TRUNCADA ------------------------------------------------- #
	local truncada="${DIR_TRABALHO}/ct-1113-truncada.dump"
	local tamanho
	tamanho="$(stat -c '%s' "${COPIA_VOLUMOSA}")"
	head -c "$((tamanho / 2))" "${COPIA_VOLUMOSA}" >"${truncada}"

	# PRÉ-CONDIÇÕES do arranjo, afirmadas: o índice da cópia truncada ainda
	# declara as três relações (senão não haveria `origem=3` a comparar), e a
	# travessia dela REPROVA (senão ela não estaria truncada).
	afirmar_igual "(a) o índice da cópia truncada ainda declara as três relações" \
		"alfa beta gama" \
		"$(pg_restore -l "${truncada}" 2>/dev/null |
			sed -nE 's/^[0-9]+; [0-9]+ [0-9]+ TABLE public ([a-z]+).*/\1/p' |
			LC_ALL=C sort -u | tr '\n' ' ' | sed 's/ $//')"
	local codigo_da_travessia=0
	pg_restore -f /dev/null "${truncada}" >/dev/null 2>&1 || codigo_da_travessia=$?
	afirmar_diferente "(a) a travessia da cópia truncada reprova" "0" "${codigo_da_travessia}"

	local destino_a="destino_ct1113_truncada"
	criar_base_vazia "${destino_a}"
	afirmar_igual "(a) o destino começa sem relação alguma" \
		"0" "$(contar_relacoes_da_base "${destino_a}")"

	executar_restauracao "ct-1113-truncada" "${AMBIENTE_PRINCIPAL}" "${destino_a}" \
		"${truncada}" "restaurar" "${resposta}"

	afirmar_igual "(a) termina com código de falha" "1" "${CODIGO_DO_ALVO}"
	afirmar_contem "(a) a acusação traz o número da origem" \
		"origem=3" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_contem "(a) a acusação traz o número do destino" \
		"destino=0" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_contem "(a) a acusação nomeia as relações que faltam" \
		"public.alfa public.beta public.gama" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_igual "(a) o destino ficou sem relação alguma" \
		"0" "$(contar_relacoes_da_base "${destino_a}")"

	# --- (b) cópia ÍNTEGRA, seguida da perda de uma relação ----------------- #
	local destino_b="destino_ct1113_perda"
	criar_base_vazia "${destino_b}"

	executar_restauracao "ct-1113-integra" "${AMBIENTE_PRINCIPAL}" "${destino_b}" \
		"${COPIA_VOLUMOSA}" "restaurar" "${resposta}"

	afirmar_igual "(b) a restauração da cópia íntegra termina com SUCESSO" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${ERRO_DA_RESTAURACAO}" >&2
		fechar_caso "CT-1113"
		return
	fi
	afirmar_igual "(b) o destino recebeu as três relações" \
		"public.alfa public.beta public.gama" "$(relacoes_da_base "${destino_b}")"

	# A perda: o restaurador já terminou, e terminou bem. O que muda daqui em
	# diante é o DESTINO, e é só ele que a conferência tem para medir.
	consultar_base "${destino_b}" "DROP TABLE beta" >/dev/null

	executar_restauracao "ct-1113-conferencia" "${AMBIENTE_PRINCIPAL}" "${destino_b}" \
		"${COPIA_VOLUMOSA}" "conferir" "FECHADA"

	afirmar_igual "(b) a conferência do destino que perdeu uma relação REPROVA" \
		"1" "${CODIGO_DO_ALVO}"
	afirmar_contem "(b) a acusação traz o número da origem" \
		"origem=3" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_contem "(b) a acusação traz o número do destino" \
		"destino=2" "$(cat "${ERRO_DA_RESTAURACAO}")"
	afirmar_contem "(b) a acusação nomeia a relação que falta" \
		"public.beta" "$(cat "${ERRO_DA_RESTAURACAO}")"

	fechar_caso "CT-1113"
}

# =========================================================================== #
# Arranjo da T3 — as duas bases de origem e as duas cópias que os casos
# restauram.
#
# ⚠️ As cópias são produzidas pelo ALVO DA T2 (`copiar-base.sh`), e não por um
# `pg_dump` avulso. É o que amarra as duas tasks: uma cópia que a T2 publique e
# a T3 não consiga restaurar reprova aqui, que é exatamente o defeito que uma
# rotina de salvaguarda não pode ter.
#
# A base volumosa existe para o CT-1113: o índice de uma cópia custom sobrevive
# a um truncamento generoso QUANDO os dados ocupam a maior parte do arquivo, e é
# isso que permite truncar metade e ainda ler `origem=3`. Com a base de sete
# linhas, o corte que quebra a travessia quebra também o índice, e o caso
# mediria outra coisa.
# =========================================================================== #
readonly LINHAS_DA_ORIGEM_VOLUMOSA=5000

produzir_copia_pelo_alvo_da_t2() {
	local rotulo="$1" ambiente="$2"
	local area="${DIR_TRABALHO}/copias/${rotulo}"
	local raiz="${area}/acervo"
	mkdir -p "${area}"

	# ⚠️ A saída do produtor fica FORA da raiz do acervo. Gravá-la dentro punha um
	# arquivo lá antes da execução, e a entrada única de propriedade do alvo da T2
	# recusa uma raiz que já guarda acervo alheio — o arranjo é que estaria
	# violando a guarda que o CT-1100 (f) prova.
	local codigo=0
	env SYSLOC_ARQ_AMBIENTE="${ambiente}" SYSLOC_RAIZ_DO_BACKUP="${raiz}" \
		bash "${SCRIPT_COPIAR}" >"${area}/copiar.out" 2>"${area}/copiar.err" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${area}/copiar.err" >&2
		return 1
	fi

	# O arquivo é LOCALIZADO, e não composto a partir da data: uma execução que
	# cruzasse a meia-noite comporia um nome que não existe.
	local publicada=""
	publicada="$(find "${raiz}/daily" -maxdepth 1 -type f -name '*.dump' -print -quit)"
	[[ -n "${publicada}" ]] || return 1
	printf '%s' "${publicada}"
}

preparar_arranjo_da_restauracao() {
	# A credencial que alcança QUALQUER base do agrupamento: o `pgpass` de
	# `subir_instancia` fixa a base em `postgres`, e os casos da T3 falam com as
	# bases de destino que eles mesmos criam.
	ARQ_PGPASS_GERAL="${DIR_TRABALHO}/pgpass-de-todas-as-bases"
	install -m 0600 /dev/null "${ARQ_PGPASS_GERAL}"
	printf '127.0.0.1:%s:*:verificacao:%s\n' \
		"${PORTA_PRINCIPAL}" "${SENHA_SENTINELA}" >"${ARQ_PGPASS_GERAL}"

	LOG_DO_SERVIDOR_PRINCIPAL="${DIR_TRABALHO}/instancias/principal/servidor.log"
	if [[ ! -f "${LOG_DO_SERVIDOR_PRINCIPAL}" ]]; then
		printf 'ERRO: não encontrei o diário do servidor da instância própria em %s.\n' \
			"${LOG_DO_SERVIDOR_PRINCIPAL}" >&2
		printf '      o CT-1112 mede nele a ausência de conexão com o destino recusado.\n' >&2
		exit 1
	fi

	TOKEN_DO_ALVO="$(sed -n 's|^readonly TOKEN_DE_CONFIRMACAO="\(.*\)"$|\1|p' \
		"${SCRIPT_RESTAURAR}" | head -1)"
	if [[ -z "${TOKEN_DO_ALVO}" ]]; then
		printf 'ERRO: não consegui ler TOKEN_DE_CONFIRMACAO de %s.\n' "${SCRIPT_RESTAURAR}" >&2
		exit 1
	fi

	NONCE_DA_EXECUCAO="$(gerar_nonce_alfanumerico 12 | tr '[:upper:]' '[:lower:]')"
	if [[ -z "${NONCE_DA_EXECUCAO}" ]]; then
		printf 'ERRO: não consegui gerar o nonce desta execução.\n' >&2
		exit 1
	fi

	# A origem volumosa do CT-1113 — três relações, uma delas com volume.
	criar_base_vazia "origem_volumosa"
	consultar_base "origem_volumosa" \
		"CREATE TABLE alfa(i int); CREATE TABLE beta(t text); CREATE TABLE gama(x int, t text);
		 INSERT INTO alfa SELECT generate_series(1, 3);
		 INSERT INTO beta VALUES ('primeira'), ('segunda');
		 INSERT INTO gama SELECT g, repeat('x', 200) FROM generate_series(1, ${LINHAS_DA_ORIGEM_VOLUMOSA}) g;" >/dev/null

	local ambiente_volumosa="${DIR_TRABALHO}/ambiente-da-origem-volumosa.env"
	escrever_ambiente_para "origem_volumosa" "${ambiente_volumosa}"

	COPIA_PRINCIPAL="$(produzir_copia_pelo_alvo_da_t2 "principal" "${AMBIENTE_PRINCIPAL}")" || {
		printf 'ERRO: não consegui produzir a cópia da base principal com %s.\n' "${SCRIPT_COPIAR}" >&2
		exit 1
	}
	COPIA_VOLUMOSA="$(produzir_copia_pelo_alvo_da_t2 "volumosa" "${ambiente_volumosa}")" || {
		printf 'ERRO: não consegui produzir a cópia da base volumosa com %s.\n' "${SCRIPT_COPIAR}" >&2
		exit 1
	}

	nota "cópias produzidas por copiar-base.sh: $(basename "${COPIA_PRINCIPAL}") (principal) e $(basename "${COPIA_VOLUMOSA}") (volumosa)"
	nota "token de confirmação lido do alvo: ${TOKEN_DO_ALVO}"
}

# --------------------------------------------------------------------------- #
# A disponibilidade de cada frente privilegiada, observada DIRETAMENTE no host.
#
# Ela responde "este host permite medir a frente?" — que é a pergunta que decide
# entre medir e degradar, e é estado do sistema, não lógica de nenhum alvo.
#
# Rótulo desconhecido ABORTA: um `case` que caísse no ramo neutro faria a frente
# nova nascer sem pré-condição e degradar em silêncio, que é o defeito inteiro.
# --------------------------------------------------------------------------- #
precondicao_privilegiada_disponivel() {
	case "$1" in
	ambiente-real)
		[[ -r "${ARQ_AMBIENTE_REAL_DA_OPERACAO}" ]]
		;;
	acervo-real)
		[[ -d "${RAIZ_DAS_COPIAS_DO_ALVO}/${SUBDIRETORIO_DAS_COPIAS_DO_ALVO}" &&
			-r "${RAIZ_DAS_COPIAS_DO_ALVO}/${SUBDIRETORIO_DAS_COPIAS_DO_ALVO}" ]]
		;;
	relogio-no-supervisor)
		systemctl is-enabled "${UNIDADE_DO_RELOGIO}" >/dev/null 2>&1
		;;
	*)
		printf 'ERRO: frente privilegiada desconhecida: %s\n' "$1" >&2
		exit 1
		;;
	esac
}

# =========================================================================== #
# Acessórios da T5 — auditorias da árvore de baterias.
#
# As três funções abaixo são usadas DUAS vezes cada: sobre a árvore real
# (controle) e sobre um mutante em `mktemp -d` (falsificação). É a exigência da
# `.claude/rules/testing-stack.md` para asserção estática, e é o par que detecta:
# uma auditoria que nunca acha nada passa no controle e reprova no mutante; uma
# que acha tudo faz o contrário. Nenhuma das duas passa nas duas.
# =========================================================================== #

# Lê uma constante `readonly NOME=valor` de um alvo. Ler, e não reescrever, é o
# que impede o alvo de aparecer nos dois lados da comparação.
ler_constante_do_alvo() {
	local valor
	valor="$(sed -n "s|^readonly ${2}=||p" "$1" | head -1)"
	valor="${valor%\"}"
	printf '%s' "${valor#\"}"
}

# --------------------------------------------------------------------------- #
# A expressão de descoberta do agregador, EXTRAÍDA do fonte dele.
#
# Imprime `<subdiretório>\t<molde do nome>`. Devolve 1 quando não conseguiu
# extrair — que é o antivácuo desta função: sem ele, um agregador reescrito faria
# a descoberta rodar sobre a string vazia e devolver a árvore inteira.
# --------------------------------------------------------------------------- #
expressao_de_descoberta_do_agregador() {
	local linha subdiretorio molde
	linha="$(grep -m1 'mapfile -t BATERIAS < <(find' "${AGREGADOR}" 2>/dev/null || true)"
	[[ -n "${linha}" ]] || return 1
	subdiretorio="$(printf '%s' "${linha}" | sed -n 's|.*RAIZ_REPO}/\([^"]*\)".*|\1|p')"
	molde="$(printf '%s' "${linha}" | sed -n "s|.*-name '\([^']*\)'.*|\1|p")"
	[[ -n "${subdiretorio}" && -n "${molde}" ]] || return 1
	printf '%s\t%s' "${subdiretorio}" "${molde}"
}

# Aplica a expressão extraída a uma raiz qualquer, e imprime os caminhos
# relativos ao subdiretório, um por linha e em ordem estável.
descobrir_baterias_em() {
	local raiz="$1" expressao subdiretorio molde
	expressao="$(expressao_de_descoberta_do_agregador)" || return 1
	subdiretorio="${expressao%%$'\t'*}"
	molde="${expressao##*$'\t'}"
	[[ -d "${raiz}/${subdiretorio}" ]] || return 0
	find "${raiz}/${subdiretorio}" -name "${molde}" -printf '%P\n' 2>/dev/null | LC_ALL=C sort
}

# --------------------------------------------------------------------------- #
# Auditoria do esqueleto — CT-1125.
#
# Imprime uma linha `forma:bateria[:símbolo]` por achado:
#
#   redeclara:<bateria>:<símbolo>   a bateria define localmente um símbolo da casa
#   sem-esqueleto:<bateria>         a bateria não carrega a casa comum
#
# ⚠️ O agregador fica FORA desta auditoria de propósito: ele não afirma nada —
# apenas executa e resume —, e por isso não carrega nem redeclara o vocabulário.
# --------------------------------------------------------------------------- #
auditar_esqueleto_em() {
	local raiz="$1" bateria simbolo
	local -a baterias=()
	mapfile -t baterias < <(find "${raiz}" -name 'verificar-*.sh' 2>/dev/null | LC_ALL=C sort)

	for bateria in "${baterias[@]}"; do
		if ! grep -q '^source .*esqueleto-de-assercao\.sh"$' "${bateria}"; then
			printf 'sem-esqueleto:%s\n' "$(basename "${bateria}")"
		fi
		for simbolo in "${SIMBOLOS_DO_ESQUELETO[@]}"; do
			if grep -qE "^${simbolo}\(\)" "${bateria}"; then
				printf 'redeclara:%s:%s\n' "$(basename "${bateria}")" "${simbolo}"
			fi
		done
	done
}

# Quantos arquivos do VOCABULÁRIO definem um símbolo, numa raiz qualquer.
#
# ⚠️ O escopo é `verificar-*.sh` mais a casa comum, e não `*.sh`: dois scripts de
# PRODUÇÃO deste repositório (`apurar-versao-banco.sh` e `extrair-fonte-do-pdf.sh`)
# têm `aviso`/`nota` próprias, que nada têm a ver com o vocabulário de asserção.
# Contá-las acusaria duplicação onde há apenas homonímia.
definicoes_do_simbolo_em() {
	grep -rlE "^${2}\(\)" --include='verificar-*.sh' --include='esqueleto-de-assercao.sh' \
		"$1" 2>/dev/null | grep -c . || true
}

# --------------------------------------------------------------------------- #
# Auditoria dos casos declarados — CT-1126.
#
# Imprime uma linha por divergência entre a árvore e `CASOS_DECLARADOS_POR_BATERIA`:
#
#   contagem:<bateria>:<medido>:<esperado>
#   ausente:<bateria>:<id>       o caso declarado sumiu da bateria
#   excedente:<bateria>:<id>     a bateria abriu um caso que a tabela não declara
# --------------------------------------------------------------------------- #
auditar_casos_em() {
	local raiz="$1" entrada relativo esperado ids_esperados arquivo
	local medido ids_medidos id
	for entrada in "${CASOS_DECLARADOS_POR_BATERIA[@]}"; do
		relativo="${entrada%%|*}"
		esperado="${entrada#*|}"
		ids_esperados="${esperado#*|}"
		esperado="${esperado%%|*}"
		arquivo="${raiz}/${relativo}"
		if [[ ! -f "${arquivo}" ]]; then
			printf 'contagem:%s:ausente:%s\n' "${relativo}" "${esperado}"
			continue
		fi
		medido="$(grep -cE '^[[:space:]]*caso "' "${arquivo}" || true)"
		[[ "${medido}" == "${esperado}" ]] ||
			printf 'contagem:%s:%s:%s\n' "${relativo}" "${medido}" "${esperado}"

		# ⚠️ Os identificadores da tabela são separados por `;`, e não por espaço:
		# há IDs com espaço no meio (`CT-1005 (a)`), e separar por espaço os
		# partiria em pedaços que nunca casariam com o medido.
		ids_medidos="$(grep -oE '^[[:space:]]*caso "[^"]+"' "${arquivo}" |
			sed 's/.*caso "//; s/"$//' | LC_ALL=C sort)"
		while IFS= read -r id; do
			[[ -n "${id}" ]] || continue
			printf '%s\n' "${ids_medidos}" | grep -qxF "${id}" ||
				printf 'ausente:%s:%s\n' "${relativo}" "${id}"
		done < <(printf '%s' "${ids_esperados}" | tr ';' '\n' | LC_ALL=C sort)
		while IFS= read -r id; do
			[[ -n "${id}" ]] || continue
			printf '%s' "${ids_esperados}" | tr ';' '\n' | grep -qxF "${id}" ||
				printf 'excedente:%s:%s\n' "${relativo}" "${id}"
		done < <(printf '%s\n' "${ids_medidos}")
	done
}

# Conta as linhas não vazias de uma lista de achados — `grep -c .` devolve 1 e
# status 1 quando a lista está vazia, e sob `pipefail` isso mataria a contagem.
contar_achados() {
	printf '%s' "$1" | grep -c . || true
}

# =========================================================================== #
# CT-1119 — a bateria é DESCOBERTA pelo agregador, e sai da descoberta se mudar
# de casa.
#
# INVARIANTE: bateria que o agregador não enxerga não é rede — é a aparência de
# uma. O agregador varre `deploy/scripts` por `verificar-*.sh`, e um arquivo fora
# dali é invisível a ele sem que nada acuse.
#
# ⚠️ A expressão de descoberta é EXTRAÍDA do fonte do agregador, nunca reescrita
# aqui: reescrevê-la poria a reimplementação sob prova, e o caso continuaria
# verde com um agregador que descobrisse outra coisa.
# =========================================================================== #
ct_1119() {
	caso "CT-1119" "a bateria é descoberta pelo agregador, e sai da descoberta se mudar de casa"

	local expressao=""
	expressao="$(expressao_de_descoberta_do_agregador)" || expressao=""
	afirmar_diferente "a expressão de descoberta foi extraída do fonte do agregador" "" "${expressao}"
	if [[ -z "${expressao}" ]]; then
		falhar "sem a expressão não há o que exercitar — o agregador mudou de forma"
		fechar_caso "CT-1119"
		return
	fi
	nota "expressão extraída: find <raiz>/${expressao%%$'\t'*} -name '${expressao##*$'\t'}'"

	local descobertas
	descobertas="$(descobrir_baterias_em "${RAIZ_REPO}")"

	afirmar_igual "(controle) o agregador descobre as ${#BATERIAS_DECLARADAS[@]} baterias declaradas" \
		"${#BATERIAS_DECLARADAS[@]}" "$(contar_achados "${descobertas}")"
	afirmar_igual "(controle) o conjunto descoberto é IGUAL ao declarado" \
		"$(printf '%s\n' "${BATERIAS_DECLARADAS[@]}" | LC_ALL=C sort | tr '\n' ' ')" \
		"$(printf '%s\n' "${descobertas}" | tr '\n' ' ')"
	afirmar_igual "(controle) esta bateria está entre as descobertas" \
		"1" "$(printf '%s\n' "${descobertas}" | grep -cxF 'backup/verificar-backup.sh' || true)"
	afirmar_igual "(controle) o agregador NÃO encontra a si mesmo" \
		"0" "$(printf '%s\n' "${descobertas}" | grep -c 'rodar-baterias' || true)"

	# O mutante: a mesma expressão, sobre uma árvore em que esta bateria mudou de
	# casa. A cópia é sempre `mktemp -d` — plantar na árvore de trabalho deixaria
	# lixo versionável se o script morresse no meio.
	local sandbox="${DIR_TRABALHO}/ct-1119-mutante"
	mkdir -p "${sandbox}/deploy" "${sandbox}/fora-de-deploy-scripts"
	cp -a "${RAIZ_REPO}/deploy/scripts" "${sandbox}/deploy/scripts"
	mv "${sandbox}/deploy/scripts/backup/verificar-backup.sh" \
		"${sandbox}/fora-de-deploy-scripts/verificar-backup.sh"

	local no_mutante
	no_mutante="$(descobrir_baterias_em "${sandbox}")"
	afirmar_igual "(mutante) a bateria fora de deploy/scripts some da descoberta" \
		"$((${#BATERIAS_DECLARADAS[@]} - 1))" "$(contar_achados "${no_mutante}")"
	afirmar_igual "(mutante) e a que falta é NOMEADA" \
		"backup/verificar-backup.sh" \
		"$(comm -23 <(printf '%s\n' "${BATERIAS_DECLARADAS[@]}" | LC_ALL=C sort) \
			<(printf '%s\n' "${no_mutante}") | tr '\n' ' ' | sed 's/ $//')"

	fechar_caso "CT-1119"
}

# =========================================================================== #
# CT-1120 — o contrato de saída, e a prova de que NENHUM outro caminho produz
# verde.
#
# INVARIANTE: `0` se e somente se `falhas_totais == 0` E nenhuma asserção ficou
# por medir; `1` quando reprova o que a bateria existe para provar; `2` quando o
# que ela prova está íntegro e o único vermelho é a saúde deste host.
#
# ⚠️ As três primeiras partidas exercitam `desfecho_da_bateria` — a MESMA função
# que decide o código de saída real, e não uma reimplementação dela — com o
# estado forjado em SUBSHELL. A §5.2 da task descrevia as partidas pelas
# condições que as produzem ("cópia do dia ausente", "ferramenta fora do
# caminho"); rodar a bateria inteira três vezes de dentro dela mesma seria
# recursão, e custaria seis instâncias de banco para provar três comparações de
# inteiro. A quarta partida fecha a lacuna que a forja deixaria: ela remove a
# ferramenta do CAMINHO de verdade, sem editar o alvo, e prova que a ausência
# aborta em vez de sair verde.
# =========================================================================== #
ct_1120() {
	caso "CT-1120" "o contrato de saída: 0 só com zero falhas, 1 reprovação, 2 pré-condição"

	local codigo saida
	saida="${DIR_TRABALHO}/ct-1120"
	mkdir -p "${saida}"

	codigo=0
	(
		falhas_totais=0
		avisos_totais=0
		PRECONDICAO_PRIVILEGIADA_AUSENTE=0
		desfecho_da_bateria
	) >"${saida}/integra.out" 2>&1 || codigo=$?
	afirmar_igual "(a) íntegra e tudo medido sai 0" "0" "${codigo}"
	afirmar_contem "(a) e o resumo declara os casos aprovados" \
		"casos aprovados" "$(cat "${saida}/integra.out")"

	codigo=0
	(
		falhas_totais=1
		avisos_totais=0
		PRECONDICAO_PRIVILEGIADA_AUSENTE=0
		desfecho_da_bateria
	) >"${saida}/reprovada.out" 2>&1 || codigo=$?
	afirmar_igual "(b) uma falha sai 1" "1" "${codigo}"
	afirmar_contem "(b) e o resumo diz REPROVADO" "REPROVADO" "$(cat "${saida}/reprovada.out")"

	codigo=0
	(
		falhas_totais=0
		avisos_totais=1
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
		desfecho_da_bateria
	) >"${saida}/precondicao.out" 2>&1 || codigo=$?
	afirmar_igual "(c) zero falhas com asserção não medida sai 2 — nunca 0" "2" "${codigo}"
	afirmar_contem "(c) e o resumo carrega a frase da asserção não medida" \
		"NÃO MEDIDA" "$(cat "${saida}/precondicao.out")"

	# (d) A pré-condição obtida REMOVENDO A FERRAMENTA DO CAMINHO — o alvo não é
	# editado, e é a partida que prova que ferramenta ausente aborta em vez de
	# passar em silêncio.
	codigo=0
	(
		PATH="${DIR_TRABALHO}/caminho-vazio"
		exigir_ferramentas
	) >"${saida}/sem-ferramenta.out" 2>&1 || codigo=$?
	afirmar_diferente "(d) com a ferramenta fora do caminho, a bateria não segue" "0" "${codigo}"
	afirmar_contem "(d) e a recusa nomeia a ferramenta obrigatória ausente" \
		"ferramenta obrigatória ausente" "$(cat "${saida}/sem-ferramenta.out")"

	fechar_caso "CT-1120"
}

# =========================================================================== #
# CT-1121 — a bateria roda SEM PRIVILÉGIO, e o que exige root degrada com aviso
# nomeado.
#
# INVARIANTE: executada sem privilégio, ela mede tudo que não o exige e NUNCA
# aborta por falta dele; cada asserção que exigiria root sai como `aviso`
# nomeado, e nenhuma é contabilizada como aprovada.
#
# 🔴 É o caso que impede esta bateria de nascer no grupo das que ninguém executa
# — que é a razão pela qual o `CT-647` ficou quebrado por três fatias e o banco
# durável cinco migrações atrás, sem constar de débito algum.
#
# ⚠️ Ele NÃO afirma um total fixo de avisos, e a divergência é declarada: a §5.2
# da task escreveu "exatamente 3", contando FRENTES; o que sai são LINHAS, e o
# arquivo de ambiente real produz DUAS (a separação do CT-1102 (b) e o nome real
# do CT-1112). Afirmar a tabela `FRENTES_PRIVILEGIADAS`, e não o total, é o que
# torna o caso verdadeiro nos dois hosts — naquele em que a pré-condição falta e
# naquele em que ela existe e a frente é medida de fato.
#
# ⚠️ ELE NÃO LÊ MAIS `falhas_totais`, nem direta nem indiretamente — rodada 2 da
# T5. Aquele acumulador é alimentado por todos os casos que rodaram antes, e as
# duas asserções que o liam faziam este caso reprovar por defeito de outro: na
# execução do Gate 1, DUAS das 3 falhas apareceram sob o rótulo `CT-1121` e
# NENHUMA era defeito dele — as duas eram reflexo do CT-1122. O dano é de
# diagnóstico (quem lê `CT-1121 REPROVADO` procura problema de PRIVILÉGIO onde há
# problema de relógio) e tem uma segunda ponta pior: enquanto qualquer caso
# anterior estiver vermelho, este caso NUNCA consegue provar a própria
# invariante — justamente a que impede esta bateria de nascer no grupo das que
# ninguém executa. As duas asserções continuam existindo, com o mesmo valor
# esperado, em `auditar_o_fecho_da_bateria`, que é onde o sujeito delas existe.
#
# O que ficou aqui e É dele: `casos_executados` contra a tabela do CT-1126. Ela
# mede "não abortou no meio", que é a invariante deste caso, e não reflete falha
# alheia — um caso que reprova continua sendo um caso ABERTO.
# =========================================================================== #
# Quantos casos a tabela do CT-1126 declara para ESTA bateria. Lido de lá, e não
# reescrito aqui: dois números para o mesmo fato divergem sem que nada acuse.
casos_declarados_desta_bateria() {
	local entrada
	for entrada in "${CASOS_DECLARADOS_POR_BATERIA[@]}"; do
		if [[ "${entrada}" == "backup/verificar-backup.sh|"* ]]; then
			entrada="${entrada#*|}"
			printf '%s' "${entrada%%|*}"
			return 0
		fi
	done
	return 1
}

ct_1121() {
	caso "CT-1121" "a bateria roda sem privilégio, e o que exige root degrada com aviso nomeado"

	afirmar_diferente "esta bateria não está sendo executada como superusuário" "0" "${EUID}"
	afirmar_igual "e ela abriu TODOS os casos declarados, sem abortar no meio" \
		"$(casos_declarados_desta_bateria)" "${casos_executados}"

	# (i) Nenhuma degradação sem frente declarada, e nenhuma frente acima do teto
	# que a tabela lhe dá.
	local entrada rotulo teto observadas degradacao fora_do_universo=0
	for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
		[[ -n "${degradacao}" ]] || continue
		local conhecida=0
		for entrada in "${FRENTES_PRIVILEGIADAS[@]}"; do
			[[ "${degradacao}" == *"[${entrada%%|*}]"* ]] && conhecida=1
		done
		[[ "${conhecida}" -eq 1 ]] || fora_do_universo=$((fora_do_universo + 1))
	done
	afirmar_igual "toda degradação pertence a uma frente privilegiada declarada" \
		"0" "${fora_do_universo}"

	# (ii) A disjunção que impede uma frente de sumir em silêncio: pré-condição
	# ausente OBRIGA degradação; pré-condição presente PROÍBE degradação.
	for entrada in "${FRENTES_PRIVILEGIADAS[@]}"; do
		rotulo="${entrada%%|*}"
		teto="${entrada##*|}"
		observadas=0
		for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
			[[ "${degradacao}" == *"[${rotulo}]"* ]] && observadas=$((observadas + 1))
		done
		if precondicao_privilegiada_disponivel "${rotulo}"; then
			afirmar_igual "a frente [${rotulo}] está disponível neste host, e nenhuma linha degradou" \
				"0" "${observadas}"
		else
			afirmar_diferente "a frente [${rotulo}] indisponível NÃO passa em silêncio" \
				"0" "${observadas}"
			afirmar_igual "e não excede as ${teto} linha(s) que a tabela lhe dá" \
				"1" "$((observadas <= teto ? 1 : 0))"
		fi
	done

	afirmar_igual "o contador de degradações bate com o que a entrada única registrou" \
		"${#DEGRADACOES_OBSERVADAS[@]}" "${avisos_totais}"

	# (iii) Toda degradação diz o que não foi medido E o comando que o mediria.
	# Sem o comando, o aviso deixa o operador sem saída — e aviso sem saída vira
	# ruído, que é o que ensina a não ler os avisos que importam.
	local sem_comando=0 sem_rotulo=0
	for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
		[[ -n "${degradacao}" ]] || continue
		[[ "${degradacao}" == *"${MARCA_DO_COMANDO_QUE_MEDIRIA}"* ]] || sem_comando=$((sem_comando + 1))
		[[ "${degradacao}" =~ \[[a-z-]+\] ]] || sem_rotulo=$((sem_rotulo + 1))
	done
	afirmar_igual "toda degradação nomeia o comando que a mediria" "0" "${sem_comando}"
	afirmar_igual "toda degradação carrega o rótulo da frente que a produziu" "0" "${sem_rotulo}"

	# ⚠️ O DESFECHO NÃO SE AFIRMA AQUI — rodada 2 da T5. Ele lê `falhas_totais`,
	# que é acumulador de TODA a bateria, e afirmá-lo dentro de um caso fazia este
	# caso reprovar por defeito alheio: das 3 falhas de uma execução do Gate 1,
	# DUAS eram deste caso e nenhuma era defeito dele. Ver
	# `auditar_o_fecho_da_bateria`.

	nota "degradações declaradas nesta execução: ${#DEGRADACOES_OBSERVADAS[@]}"
	fechar_caso "CT-1121"
}

# =========================================================================== #
# CT-1122 — o frescor da cópia do dia, com a borda EXATA.
#
# INVARIANTE: a cópia mais recente do acervo não é mais velha que o teto
# declarado; acervo VAZIO e acervo VELHO são dois defeitos distintos e reprovam
# com mensagens distintas.
#
# As quatro partidas rodam em caixa de areia porque a borda precisa ser posta com
# precisão de hora, e o acervo real não se deixa envelhecer. A frente real vem
# depois: onde ela existir, é medida; onde não, degrada nomeada.
#
# ⚠️ O INSTANTE DE MEDIÇÃO É PARÂMETRO, e não zelo — rodada 2 da T5.
#
# Até a rodada 1, a avaliação lia o relógio de parede no instante da MEDIÇÃO
# enquanto o plantio o lera no instante do ARRANJO, de modo que a idade obtida
# era `horas*3600 + (T1 - T0)`. Entre T0 e T1 correm `install`, `printf`,
# `touch`, a criação de um subshell, um `find` e um `sort`: qualquer virada de
# segundo de parede no meio disso empurrava a partida de borda EXATA (o teto em
# ponto, comparado com `-le`) para o lado de fora do teto, e ela reprovava por
# relógio. Não é hipótese — a mesma árvore saiu `2 · 408 OK` nesta máquina e
# `1 · 405 OK · 3 falhas` na do Gate 1.
#
# A saída NÃO é afrouxar a borda com folga, como o `CT-1100` faz com o par de
# fronteira dele: ali a folga é necessária porque quem lê o relógio é o ALVO, e
# esta bateria não tem como injetá-lo. Aqui quem lê é a própria bateria, e por
# isso o instante vira argumento — a partida planta e mede com o MESMO valor, e
# `T1 - T0` passa a ser zero por construção em vez de por sorte. A borda exata
# continua sendo afirmada com o valor exato do teto, que é o que a folga teria
# custado.
#
# O default preserva o relógio de parede: a partida REAL, logo abaixo, mede um
# acervo que envelheceu de verdade e é ali que ler o relógio é o correto.
# =========================================================================== #
avaliar_frescor_do_acervo() {
	local dir="$1" agora="${2:-$(date +%s)}" recente idade_s
	if [[ ! -d "${dir}" ]]; then
		printf 'não há acervo em %s' "${dir}"
		return 2
	fi
	recente="$(find "${dir}" -maxdepth 1 -type f \
		-name "${PREFIXO_DA_COPIA_DO_ALVO}*${SUFIXO_DA_COPIA_DO_ALVO}" \
		-printf '%T@\n' 2>/dev/null | LC_ALL=C sort -rn | head -1)"
	if [[ -z "${recente}" ]]; then
		printf 'acervo sem cópia alguma em %s' "${dir}"
		return 2
	fi
	idade_s=$((agora - ${recente%.*}))
	printf 'idade medida %dh, teto %dh' \
		"$((idade_s / SEGUNDOS_POR_HORA))" "${TETO_DE_FRESCOR_EM_HORAS}"
	[[ "${idade_s}" -le "$((TETO_DE_FRESCOR_EM_HORAS * SEGUNDOS_POR_HORA))" ]]
}

# Planta uma cópia de mentira com a idade pedida, em horas, contadas a partir do
# instante que o terceiro argumento fixa — o MESMO que a avaliação vai receber.
# É o par que torna a borda exata determinística; ver o bloco acima.
plantar_copia_com_idade() {
	local dir="$1" horas="$2" agora="$3"
	mkdir -p "${dir}"
	local arquivo="${dir}/${PREFIXO_DA_COPIA_DO_ALVO}2026-08-26${SUFIXO_DA_COPIA_DO_ALVO}"
	install -m 0600 /dev/null "${arquivo}"
	printf 'PGDMP\n' >"${arquivo}"
	touch -d "@$((agora - horas * SEGUNDOS_POR_HORA))" "${arquivo}"
}

ct_1122() {
	caso "CT-1122" "o frescor da cópia do dia, com a borda exata do teto declarado"

	afirmar_diferente "o molde do nome da cópia foi lido do alvo, não reescrito aqui" \
		"" "${PREFIXO_DA_COPIA_DO_ALVO}${SUFIXO_DA_COPIA_DO_ALVO}"
	afirmar_igual "a unidade do relógio declarada existe no repositório" \
		"arquivo" "$(forma_do_caminho "${RAIZ_REPO}/deploy/systemd/${UNIDADE_DO_RELOGIO}")"

	local base="${DIR_TRABALHO}/ct-1122" horas codigo diagnostico

	# O instante das partidas sintéticas, lido UMA vez e usado nas duas pontas —
	# plantio e medição. Ver o bloco de `avaliar_frescor_do_acervo`.
	local agora_do_arranjo
	agora_do_arranjo="$(date +%s)"

	for horas in 25 "${TETO_DE_FRESCOR_EM_HORAS}" 27; do
		local dir="${base}/idade-${horas}h"
		plantar_copia_com_idade "${dir}" "${horas}" "${agora_do_arranjo}"
		codigo=0
		diagnostico="$(avaliar_frescor_do_acervo "${dir}" "${agora_do_arranjo}")" || codigo=$?
		if [[ "${horas}" -le "${TETO_DE_FRESCOR_EM_HORAS}" ]]; then
			afirmar_igual "(${horas}h) dentro do teto, o frescor aprova" "0" "${codigo}"
		else
			afirmar_igual "(${horas}h) além do teto, o frescor reprova" "1" "${codigo}"
			afirmar_contem "(${horas}h) e a reprovação declara a idade medida contra o teto" \
				"idade medida ${horas}h, teto ${TETO_DE_FRESCOR_EM_HORAS}h" "${diagnostico}"
		fi
	done

	local vazio="${base}/vazio"
	mkdir -p "${vazio}"
	codigo=0
	diagnostico="$(avaliar_frescor_do_acervo "${vazio}" "${agora_do_arranjo}")" || codigo=$?
	afirmar_igual "(vazio) acervo sem cópia alguma reprova" "2" "${codigo}"
	afirmar_contem "(vazio) e a mensagem é DISTINTA da de cópia velha" \
		"sem cópia alguma" "${diagnostico}"
	afirmar_igual "(vazio) e não se confunde com o defeito da idade" \
		"0" "$(printf '%s' "${diagnostico}" | grep -c 'idade medida' || true)"

	# A frente real. Onde o acervo estiver instalado, ela é medida; onde não, sai
	# a degradação nomeada — que é o que o CT-1121 confere depois.
	local acervo_real="${RAIZ_DAS_COPIAS_DO_ALVO}/${SUBDIRETORIO_DAS_COPIAS_DO_ALVO}"
	if precondicao_privilegiada_disponivel "acervo-real"; then
		codigo=0
		diagnostico="$(avaliar_frescor_do_acervo "${acervo_real}")" || codigo=$?
		afirmar_igual "(real) o acervo que atende a operação tem cópia dentro do teto" "0" "${codigo}"
		afirmar_igual "(real) o acervo é do dono do processo e ninguém mais o enxerga" \
			"700" "$(modo_de "${acervo_real}")"
		nota "acervo real: ${diagnostico}"
	else
		aviso "[acervo-real] o acervo ${acervo_real} não existe ou não é legível — o frescor da cópia do dia e a propriedade dos artefatos REAIS não foram medidos; ${MARCA_DO_COMANDO_QUE_MEDIRIA} sudo bash deploy/scripts/instalacao/instalar-unidades.sh e, na janela assistida, uma execução de deploy/scripts/backup/copiar-base.sh"
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
	fi

	if precondicao_privilegiada_disponivel "relogio-no-supervisor"; then
		afirmar_igual "(real) o relógio da cópia está armado no supervisor" \
			"enabled" "$(systemctl is-enabled "${UNIDADE_DO_RELOGIO}" 2>/dev/null || printf 'ausente')"
	else
		aviso "[relogio-no-supervisor] ${UNIDADE_DO_RELOGIO} não está instalada neste host — o estado REAL do relógio da cópia não foi medido; ${MARCA_DO_COMANDO_QUE_MEDIRIA} sudo bash deploy/scripts/instalacao/instalar-unidades.sh seguido de systemctl is-enabled ${UNIDADE_DO_RELOGIO}"
		PRECONDICAO_PRIVILEGIADA_AUSENTE=1
	fi

	fechar_caso "CT-1122"
}

# =========================================================================== #
# CT-1123 — a bateria EXECUTA DE FATO uma restauração, contra base efêmera.
#
# INVARIANTE: o que prova uma rotina de salvaguarda é a restauração acontecendo,
# e não a leitura do script que a faria. Uma bateria que só varra texto aprova um
# backup que nunca restaurou.
#
# ⚠️ É a forma POSITIVA da ADR-0006: a variável de conexão do ambiente aponta,
# durante toda a bateria, para um destino impossível — e o agrupamento sobe assim
# mesmo, porque a instância é PRÓPRIA e nada aqui lê aquela variável. Ao fim, a
# instância é derrubada e o caso afirma que não sobrou processo nem diretório:
# verificação que deixa agrupamento de pé passa a ser o ambiente de alguém.
# =========================================================================== #
# Conta as relações da base de destino no agrupamento efêmero desta prova.
relacoes_no_destino_efemero() {
	PGPASSFILE="$1" psql -X -q -A -t -w -h 127.0.0.1 -p "$2" -U verificacao -d "$3" \
		-c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		    WHERE n.nspname = 'public' AND c.relkind = 'r'"
}

ct_1123() {
	caso "CT-1123" "a bateria executa de fato uma restauração em base efêmera, e não deixa rastro"

	afirmar_contem "a variável de conexão do ambiente aponta para destino impossível" \
		"destino-impossivel" "${DATABASE_URL}"

	if ! subir_instancia "restauracao-de-prova" "${SENHA_SENTINELA}"; then
		falhar "não consegui levantar a instância efêmera desta prova"
		fechar_caso "CT-1123"
		return
	fi
	local dados="${DADOS_DA_INSTANCIA}"
	local porta="${PORTA_DA_INSTANCIA}"
	local ambiente="${ARQ_AMBIENTE_DA_INSTANCIA}"
	local pgpass="${PGPASS_DA_INSTANCIA}"
	afirmar_diferente "o agrupamento efêmero subiu APESAR do destino impossível" "" "${porta}"
	afirmar_diferente "e não é o agrupamento que atende a operação" "5432" "${porta}"

	local area="${DIR_TRABALHO}/ct-1123"
	mkdir -p "${area}"
	local destino="destino_do_ct_1123"
	PGPASSFILE="${pgpass}" psql -X -q -w -h 127.0.0.1 -p "${porta}" -U verificacao -d postgres \
		-c "CREATE DATABASE ${destino}" >/dev/null

	# A credencial que alcança QUALQUER base deste agrupamento — o `pgpass` que
	# `subir_instancia` monta fixa a base em `postgres`.
	local pgpass_geral="${area}/pgpass"
	install -m 0600 /dev/null "${pgpass_geral}"
	printf '127.0.0.1:%s:*:verificacao:%s\n' "${porta}" "${SENHA_SENTINELA}" >"${pgpass_geral}"

	local antes depois
	antes="$(relacoes_no_destino_efemero "${pgpass_geral}" "${porta}" "${destino}")"
	afirmar_igual "o destino começa medido em ZERO relações" "0" "${antes}"

	printf '%s\n' "${TOKEN_DO_ALVO}" >"${area}/resposta"
	executar_restauracao "ct-1123" "${ambiente}" "${destino}" \
		"${COPIA_PRINCIPAL}" "restaurar" "${area}/resposta"
	afirmar_igual "a restauração de fato termina com sucesso" "0" "${CODIGO_DO_ALVO}"
	if [[ "${CODIGO_DO_ALVO}" -ne 0 ]]; then
		sed 's/^/         /' "${ERRO_DA_RESTAURACAO}" >&2 || true
	fi

	depois="$(relacoes_no_destino_efemero "${pgpass_geral}" "${porta}" "${destino}")"
	afirmar_igual "e o destino passa de zero para as três relações da origem" "3" "${depois}"

	derrubar_instancia "${dados}"
	rm -rf "${dados}"
	afirmar_igual "encerrada, a instância não deixa diretório de dados" \
		"ausente" "$(forma_do_caminho "${dados}")"
	afirmar_igual "e não deixa processo órfão apontando para ele" \
		"0" "$(pgrep -fc -- "${dados}" 2>/dev/null || true)"

	fechar_caso "CT-1123"
}

# =========================================================================== #
# CT-1124 — nenhuma asserção estática suja a ÁRVORE DE TRABALHO.
#
# INVARIANTE: todo mutante desta bateria nasce em `mktemp -d`. Plantar na árvore
# versionada deixaria lixo commitável se o script morresse no meio — e a T4 desta
# mesma fatia levou débito por exatamente isso.
#
# ⚠️ A comparação é ENTRE DUAS FOTOS do estado do git, e não contra vazio: a
# árvore pode ter alteração legítima em curso, e comparar contra vazio reprovaria
# toda execução feita por quem está trabalhando.
#
# O plantio deliberado é o CONTROLE POSITIVO — sem ele, uma comparação quebrada
# devolveria "nada mudou" para uma bateria que sujou tudo.
# =========================================================================== #
estado_git_da_arvore() {
	git -C "${RAIZ_REPO}" status --porcelain 2>/dev/null | LC_ALL=C sort
}

# Escreve um estado como LINHAS, e escreve NADA quando o estado é vazio.
#
# DECISÃO FECHADA — intervenção dirigida · 2026-08-26
# O QUÊ: a comparação do CT-1124 passa por aqui, e nunca por `printf '%s\n'` direto.
# POR QUÊ: `printf '%s\n' ""` emite UMA LINHA EM BRANCO, não nada. Com a árvore
#          LIMPA — que é o estado de todo clone novo e de toda execução logo após
#          um commit — os dois lados viravam "uma linha em branco" contra "uma
#          linha real", e as TRÊS asserções de diferença do caso mediam o
#          artefato do `printf` em vez do estado da árvore. Medido em 2026-08-26:
#          árvore suja 408 OK / saída 2; árvore limpa 404 OK / 4 FALHA / saída 1.
# REVERTER EXIGE: provar que a bateria fica verde com a árvore LIMPA sem este
#          recorte — isto é, rodá-la logo após um commit, com `git status
#          --porcelain` devolvendo vazio.
linhas_do_estado() {
	[[ -n "$1" ]] && printf '%s\n' "$1"
	return 0
}

ct_1124() {
	caso "CT-1124" "nenhuma asserção estática desta bateria escreve na árvore de trabalho"

	local agora
	agora="$(estado_git_da_arvore)"
	# Antivácuo. NÃO se afirma que a foto é não-vazia: árvore limpa é o estado mais
	# saudável possível, e exigir sujeira aqui reprovava todo clone novo. O que
	# discrimina "não consegui fotografar" de "não havia o que fotografar" é o
	# repositório responder — e a detecção quem prova é o controle positivo abaixo.
	afirmar_igual "há repositório para fotografar" \
		"true" "$(git -C "${RAIZ_REPO}" rev-parse --is-inside-work-tree 2>/dev/null || true)"
	afirmar_igual "depois de todos os mutantes, o estado da árvore é o mesmo do início" \
		"0" "$(contar_achados "$(diff <(linhas_do_estado "${ESTADO_GIT_INICIAL}") \
			<(linhas_do_estado "${agora}") | grep -E '^[<>]' || true)")"

	# Controle positivo: um arquivo plantado FORA da caixa de areia tem de
	# aparecer, e aparecer como UMA linha.
	ARQUIVO_PLANTADO_NA_ARVORE="${RAIZ_REPO}/.mutante-do-ct-1124-$$"
	printf 'plantado pelo controle positivo do CT-1124\n' >"${ARQUIVO_PLANTADO_NA_ARVORE}"
	local sujo
	sujo="$(estado_git_da_arvore)"
	afirmar_igual "(controle) plantar na raiz acusa EXATAMENTE uma linha de diferença" \
		"1" "$(contar_achados "$(diff <(linhas_do_estado "${ESTADO_GIT_INICIAL}") \
			<(linhas_do_estado "${sujo}") | grep -E '^[<>]' || true)")"
	afirmar_igual "(controle) e a linha nomeia o arquivo plantado" \
		"1" "$(printf '%s\n' "${sujo}" | grep -c "$(basename "${ARQUIVO_PLANTADO_NA_ARVORE}")" || true)"

	rm -f "${ARQUIVO_PLANTADO_NA_ARVORE}"
	ARQUIVO_PLANTADO_NA_ARVORE=""
	afirmar_igual "(controle) removido, a árvore volta ao estado inicial" \
		"0" "$(contar_achados "$(diff <(linhas_do_estado "${ESTADO_GIT_INICIAL}") \
			<(linhas_do_estado "$(estado_git_da_arvore)") | grep -E '^[<>]' || true)")"

	fechar_caso "CT-1124"
}

# =========================================================================== #
# CT-1125 — o `D9 · F0/T2` está FECHADO: as doze baterias consomem UM esqueleto.
#
# INVARIANTE: cada símbolo do vocabulário canônico tem UMA definição no
# repositório, e toda bateria a carrega por `source`. Enquanto havia doze cópias,
# endurecer uma deixava onze para trás — e elas já haviam divergido em quatro
# pontos, nenhum deles decidido por ninguém.
#
# ⚠️ O agregador fica FORA da auditoria: ele não afirma nada, apenas executa e
# resume, e por isso não carrega nem redeclara o vocabulário.
# =========================================================================== #
ct_1125() {
	caso "CT-1125" "o D9 está fechado: as baterias declaradas consomem um esqueleto só"

	afirmar_igual "a casa comum existe" "arquivo" "$(forma_do_caminho "${ESQUELETO}")"
	afirmar_igual "e o agregador NÃO a carrega — ele não afirma nada" \
		"0" "$(grep -c 'esqueleto-de-assercao' "${AGREGADOR}" || true)"

	local achados
	achados="$(auditar_esqueleto_em "${RAIZ_REPO}/deploy/scripts")"
	afirmar_igual "(controle) a árvore real não tem achado algum" "" "${achados}"

	local bateria carregam=0 validas=0
	for bateria in "${BATERIAS_DECLARADAS[@]}"; do
		grep -q '^source .*esqueleto-de-assercao\.sh"$' "${RAIZ_REPO}/deploy/scripts/${bateria}" &&
			carregam=$((carregam + 1))
		bash -n "${RAIZ_REPO}/deploy/scripts/${bateria}" 2>/dev/null && validas=$((validas + 1))
	done
	afirmar_igual "as ${#BATERIAS_DECLARADAS[@]} baterias carregam a casa comum por source" \
		"${#BATERIAS_DECLARADAS[@]}" "${carregam}"
	afirmar_igual "e as ${#BATERIAS_DECLARADAS[@]} seguem sintaticamente válidas depois da extração" \
		"${#BATERIAS_DECLARADAS[@]}" "${validas}"

	local simbolo
	for simbolo in "${SIMBOLOS_DO_ESQUELETO[@]}"; do
		afirmar_igual "\`${simbolo}\` tem UMA definição no vocabulário do repositório" \
			"1" "$(definicoes_do_simbolo_em "${RAIZ_REPO}/deploy/scripts" "${simbolo}")"
	done

	# Os dois mutantes, em `mktemp -d`: um redeclara localmente, o outro deixa de
	# carregar a casa. Dois defeitos, dois achados — nomeando bateria e forma.
	local sandbox="${DIR_TRABALHO}/ct-1125-mutante"
	mkdir -p "${sandbox}"
	cp -a "${RAIZ_REPO}/deploy/scripts" "${sandbox}/scripts"
	printf '\nafirmar_igual() { :; }\n' >>"${sandbox}/scripts/instalacao/verificar-migracao.sh"
	sed -i '/^source .*esqueleto-de-assercao\.sh"$/d' \
		"${sandbox}/scripts/caracterizacao/verificar-golden.sh"

	local no_mutante
	no_mutante="$(auditar_esqueleto_em "${sandbox}/scripts")"
	afirmar_igual "(mutante) a auditoria acusa exatamente dois achados" \
		"2" "$(contar_achados "${no_mutante}")"
	afirmar_igual "(mutante) e nomeia a bateria que redeclara, e o símbolo" \
		"1" "$(printf '%s\n' "${no_mutante}" |
			grep -cxF 'redeclara:verificar-migracao.sh:afirmar_igual' || true)"
	afirmar_igual "(mutante) e a bateria que deixou de carregar a casa comum" \
		"1" "$(printf '%s\n' "${no_mutante}" |
			grep -cxF 'sem-esqueleto:verificar-golden.sh' || true)"
	afirmar_igual "(mutante) e a contagem de definições de \`afirmar_igual\` deixa de ser UMA" \
		"2" "$(definicoes_do_simbolo_em "${sandbox}/scripts" afirmar_igual)"

	fechar_caso "CT-1125"
}

# =========================================================================== #
# CT-1126 — a extração NÃO ENGOLIU caso algum.
#
# INVARIANTE: depois da extração, o número e os identificadores dos casos de CADA
# bateria são os da tabela medida ANTES dela. A refatoração que tocou onze
# arquivos não remove, não renomeia e não funde caso.
#
# ⚠️ É a rede de maior valor da T5. A comparação "antes × depois" não sobrevive ao
# fim da task — quem vier depois não tem o antes. A tabela declarada é o que a
# substitui, e é por isso que ela é escrita por extenso em vez de derivada.
# =========================================================================== #
ct_1126() {
	caso "CT-1126" "a extração do esqueleto não engoliu caso algum"

	local declarado_no_total=0 entrada
	for entrada in "${CASOS_DECLARADOS_POR_BATERIA[@]}"; do
		entrada="${entrada#*|}"
		declarado_no_total=$((declarado_no_total + ${entrada%%|*}))
	done
	afirmar_igual "a soma da tabela bate com o total declarado à parte" \
		"${CASOS_DECLARADOS_NO_TOTAL}" "${declarado_no_total}"
	afirmar_igual "a tabela cobre as ${#BATERIAS_DECLARADAS[@]} baterias declaradas" \
		"${#BATERIAS_DECLARADAS[@]}" "${#CASOS_DECLARADOS_POR_BATERIA[@]}"

	local medido_no_total=0 bateria
	for bateria in "${BATERIAS_DECLARADAS[@]}"; do
		medido_no_total=$((medido_no_total +
			$(grep -cE '^[[:space:]]*caso "' "${RAIZ_REPO}/deploy/scripts/${bateria}" || true)))
	done
	# Controle antivácuo: um extrator quebrado devolveria zero em toda bateria, e a
	# lista de divergências ficaria vazia por vacuidade.
	afirmar_igual "o extrator mede os ${CASOS_DECLARADOS_NO_TOTAL} casos da árvore" \
		"${CASOS_DECLARADOS_NO_TOTAL}" "${medido_no_total}"

	local achados
	achados="$(auditar_casos_em "${RAIZ_REPO}/deploy/scripts")"
	afirmar_igual "(controle) nenhuma bateria diverge da tabela medida antes da extração" \
		"" "${achados}"

	# O mutante: uma bateria perde uma chamada de caso. Uma remoção, dois achados —
	# a contagem que caiu e o identificador que sumiu.
	local sandbox="${DIR_TRABALHO}/ct-1126-mutante"
	mkdir -p "${sandbox}"
	cp -a "${RAIZ_REPO}/deploy/scripts" "${sandbox}/scripts"
	sed -i '/^[[:space:]]*caso "CT-032"/d' "${sandbox}/scripts/instalacao/verificar-migracao.sh"

	local no_mutante
	no_mutante="$(auditar_casos_em "${sandbox}/scripts")"
	afirmar_igual "(mutante) a auditoria acusa exatamente dois achados" \
		"2" "$(contar_achados "${no_mutante}")"
	afirmar_igual "(mutante) e declara a contagem medida contra a esperada" \
		"1" "$(printf '%s\n' "${no_mutante}" |
			grep -cxF 'contagem:instalacao/verificar-migracao.sh:1:2' || true)"
	afirmar_igual "(mutante) e NOMEIA o identificador órfão" \
		"1" "$(printf '%s\n' "${no_mutante}" |
			grep -cxF 'ausente:instalacao/verificar-migracao.sh:CT-032' || true)"

	fechar_caso "CT-1126"
}

recusar_privilegio() {
	if [[ "${EUID}" -eq 0 ]]; then
		printf 'ERRO: esta bateria não roda como superusuário — o preparo de instância de banco recusa root.\n' >&2
		printf '      execute como o dono do repositório: bash %s\n' "${BASH_SOURCE[0]}" >&2
		exit 1
	fi
}

exigir_ferramentas() {
	local faltando="" ferramenta
	for ferramenta in psql pg_dump pg_restore tar find stat touch xargs realpath ln mkfifo \
		timeout comm wc sha256sum head; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando="${faltando} ${ferramenta}"
	done
	if ! localizar_binarios_do_banco; then
		faltando="${faltando} initdb/pg_ctl"
	fi
	if [[ -n "${faltando// /}" ]]; then
		printf 'ERRO: ferramenta obrigatória ausente:%s\n' "${faltando}" >&2
		printf '      esta bateria levanta instâncias próprias de banco e não roda sem o cliente do PostgreSQL.\n' >&2
		exit 1
	fi
}

# =========================================================================== #
# O DESFECHO — a única decisão do código de saída desta bateria.
#
# Extraído de `main` na T5 para que o CT-1120 possa exercitá-lo nos três estados
# em SUBSHELL, com o estado forjado. É a MESMA função que decide o desfecho real:
# uma reimplementação no caso de teste provaria a reimplementação, e continuaria
# verde com um `main` que saísse 0 tendo reprovado.
# =========================================================================== #
desfecho_da_bateria() {
	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${PRECONDICAO_PRIVILEGIADA_AUSENTE}" -ne 0 ]]; then
			printf 'verificar-backup: %d/%d casos sem falha, e há asserção declarada e NÃO MEDIDA neste host por falta de privilégio (ver as linhas AVISO acima)\n' \
				"${casos_aprovados}" "${casos_executados}" >&2
			printf '  cada linha AVISO nomeia a frente que ficou por medir e o comando que a mediria — esta bateria NÃO roda como root (ver o cabeçalho).\n' >&2
			exit 2
		fi
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-backup: %d/%d casos aprovados (CT-1098 a CT-1113 e CT-1119 a CT-1126)\n' \
				"${casos_aprovados}" "${casos_executados}"
		else
			printf 'verificar-backup: %d/%d casos sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${casos_aprovados}" "${casos_executados}" "${avisos_totais}"
		fi
		exit 0
	fi

	printf 'verificar-backup: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

# =========================================================================== #
# O VEREDITO DE FECHO — as duas leituras GLOBAIS, no único lugar onde elas têm
# sujeito.
#
# INVARIANTE: a execução inteira, feita SEM privilégio, termina sem falha; e o
# código de saída que o estado REAL desta execução produz é o que o contrato de
# saída promete para esse estado.
#
# Estas duas asserções viviam dentro do `CT-1121` até a rodada 2 da T5, e ali
# liam `falhas_totais` — acumulador alimentado por TODOS os casos anteriores.
# A invariante é legítima e é global; o que estava errado era a POSIÇÃO. Veredito
# de fecho de bateria afirmado dentro de um caso faz o caso responder pelo que
# não é dele: o rótulo da falha aponta para o caso errado, e o caso perde a
# capacidade de provar a si mesmo enquanto qualquer anterior estiver vermelho.
#
# ⚠️ ELA NÃO ABRE `caso`, e isso é conteúdo: `casos_executados` é conferido
# contra a tabela `CASOS_DECLARADOS_POR_BATERIA` do CT-1126 — pelo próprio
# CT-1121 e pela auditoria do CT-1126 —, e um caso a mais aqui reprovaria as
# duas. O que ela produz, se reprovar, é falha contada como qualquer outra, e o
# desfecho real logo abaixo a transforma no código 1.
# =========================================================================== #
auditar_o_fecho_da_bateria() {
	printf '\n[fecho] o veredito global desta execução\n'

	# O desfecho é medido ANTES das asserções deste bloco: uma asserção daqui que
	# reprovasse somaria `falhas_totais` e mudaria o desfecho que ela mesma afirma.
	local codigo=0
	(desfecho_da_bateria) >/dev/null 2>&1 || codigo=$?

	# Os três estados são disjuntos e cobrem o contrato inteiro. O ramo da falha
	# existe para que uma bateria vermelha produza UMA linha de diagnóstico — a de
	# baixo —, e não duas em cascata pela mesma causa.
	if [[ "${falhas_totais}" -ne 0 ]]; then
		afirmar_igual "com falha registrada, o desfecho desta execução é 1 — nunca 0" \
			"1" "${codigo}"
	elif [[ "${#DEGRADACOES_OBSERVADAS[@]}" -eq 0 ]]; then
		afirmar_igual "sem degradação alguma, o desfecho desta execução é 0" "0" "${codigo}"
	else
		afirmar_igual "com asserção por medir, o desfecho desta execução é 2 — nunca 0" \
			"2" "${codigo}"
	fi

	afirmar_igual "nada reprovou nesta execução — a falta de privilégio não vira falha" \
		"0" "${falhas_totais}"
}

main() {
	printf 'Verificação da preservação — %s\n' "${RAIZ_REPO}"

	recusar_privilegio
	exigir_ferramentas

	DIR_TRABALHO="$(mktemp -d)"
	chmod 700 "${DIR_TRABALHO}"

	SENHA_SENTINELA="$(gerar_nonce_alfanumerico 24)"
	CHAVE_SENTINELA="$(head -c 32 /dev/urandom | base64)"

	NOME_DA_SENTINELA="$(sed -n 's|^readonly NOME_DA_SENTINELA="\(.*\)"$|\1|p' "${SCRIPT_COPIAR}" | head -1)"
	if [[ -z "${NOME_DA_SENTINELA}" ]]; then
		printf 'ERRO: não consegui ler NOME_DA_SENTINELA de %s.\n' "${SCRIPT_COPIAR}" >&2
		exit 1
	fi

	# O molde do nome da cópia e a casa do acervo saem do ALVO, e não daqui: um
	# segundo lugar declarando o mesmo fato diverge sem que nada acuse.
	PREFIXO_DA_COPIA_DO_ALVO="$(ler_constante_do_alvo "${SCRIPT_COPIAR}" PREFIXO_DA_COPIA)"
	SUFIXO_DA_COPIA_DO_ALVO="$(ler_constante_do_alvo "${SCRIPT_COPIAR}" SUFIXO_DA_COPIA)"
	RAIZ_DAS_COPIAS_DO_ALVO="$(ler_constante_do_alvo "${SCRIPT_COPIAR}" RAIZ_DO_BACKUP_PADRAO)"
	SUBDIRETORIO_DAS_COPIAS_DO_ALVO="$(ler_constante_do_alvo "${SCRIPT_COPIAR}" SUBDIRETORIO_DAS_COPIAS)"
	if [[ -z "${PREFIXO_DA_COPIA_DO_ALVO}" || -z "${SUFIXO_DA_COPIA_DO_ALVO}" ||
		-z "${RAIZ_DAS_COPIAS_DO_ALVO}" || -z "${SUBDIRETORIO_DAS_COPIAS_DO_ALVO}" ]]; then
		printf 'ERRO: não consegui ler o molde do nome da cópia nem a casa do acervo de %s.\n' \
			"${SCRIPT_COPIAR}" >&2
		exit 1
	fi

	# A foto contra a qual o CT-1124 compara. Tirada ANTES do primeiro caso: é o
	# estado legítimo da árvore de quem executa, e não o vazio.
	ESTADO_GIT_INICIAL="$(estado_git_da_arvore)"

	# ADR-0006, na forma imperativa: a variável de conexão do ambiente aponta para
	# um destino IMPOSSÍVEL durante toda a bateria. O que os alvos leem é o arquivo
	# de ambiente da instância efêmera, e o CT-1098 prova isso pelo CONTEÚDO da
	# cópia. O literal não carrega a sentinela: o ambiente é herdado por todo
	# processo filho, e pôr a sentinela nele contaminaria a medição do CT-1104.
	export DATABASE_URL="postgresql://ninguem:destino-impossivel@127.0.0.1:1/inexistente"

	if ! subir_instancia "principal" "${SENHA_SENTINELA}"; then
		printf 'ERRO: não consegui levantar a instância própria desta bateria.\n' >&2
		exit 1
	fi
	AMBIENTE_PRINCIPAL="${ARQ_AMBIENTE_DA_INSTANCIA}"
	PORTA_PRINCIPAL="${PORTA_DA_INSTANCIA}"

	# Três tabelas, sete linhas — o que o CT-1098 afirma encontrar dentro da cópia.
	consultar "${PORTA_PRINCIPAL}" \
		"CREATE TABLE a(i int); CREATE TABLE b(t text); CREATE TABLE c(x int);
		 INSERT INTO a SELECT generate_series(1, 3);
		 INSERT INTO b VALUES ('primeira'), ('segunda');
		 INSERT INTO c SELECT generate_series(1, 2);" >/dev/null

	nota "instância própria de pé na porta ${PORTA_PRINCIPAL}; sentinelas com nonce desta execução"

	# As duas auditorias da própria bateria vêm primeiro: elas não dependem do
	# arranjo de banco, e uma bateria invisível ao agregador ou com contrato de
	# saída quebrado não vale a pena executar por inteiro.
	ct_1119
	ct_1120

	ct_1098
	ct_1099
	ct_1100
	ct_1101
	ct_1102
	ct_1103
	ct_1104
	ct_1105
	ct_1106

	preparar_arranjo_da_restauracao

	ct_1107
	ct_1108
	ct_1109
	ct_1110
	ct_1111
	ct_1112
	ct_1113

	ct_1122
	ct_1123

	# ⚠️ A ORDEM DESTES TRÊS É CONTEÚDO. O CT-1124 compara o estado da árvore
	# versionada contra a foto do início, e por isso vem DEPOIS de todo caso que
	# planta mutante — se viesse antes, aprovaria uma bateria que sujasse a árvore
	# no CT-1125 ou no CT-1126. E o CT-1121 é o ÚLTIMO: ele audita as degradações
	# declaradas pelos demais, e um caso que degradasse depois dele ficaria fora
	# da conta.
	ct_1125
	ct_1126
	ct_1124
	ct_1121

	# Depois do último CASO, e antes do desfecho real: o veredito global, que é o
	# único lugar em que `falhas_totais` tem sujeito. Ver o bloco dela.
	auditar_o_fecho_da_bateria

	desfecho_da_bateria
}

main "$@"
