#!/usr/bin/env bash
#
# Provisionamento dos serviços de base do backend Sysloc — T2 da fatia
# `fundacao-stack-nativa`.
#
# Instala e configura, diretamente no sistema operacional e sem camada de
# conteinerização, os três serviços de base:
#
#   1. PostgreSQL 18, do repositório oficial do fornecedor (PGDG), gerenciado
#      pelo sistema operacional e escutando APENAS em socket de domínio Unix;
#   2. uma INSTÂNCIA PRÓPRIA do Redis 7, com persistência em disco (AOF) ligada,
#      em porta e diretório de dados próprios;
#   3. o Mailpit, capturador de e-mail de desenvolvimento, preso ao endereço de
#      retorno (127.0.0.1) e sem exposição externa.
#
# ADR-0005 — rotina operacional versionada no repositório e posicionada por
# procedimento de instalação IDEMPOTENTE. Executar este script duas vezes
# seguidas termina com sucesso nas duas e não produz efeito adicional: serviço
# já instalado não reinstala, papel já existente não recria, configuração já
# correta não é reescrita. Cada passo imprime `CRIADO` (mudou algo) ou `JA-OK`
# (já estava correto), para que a segunda execução seja auditável linha a linha.
#
# ADR-0005, condição de entrada — NENHUMA credencial entra no repositório. A
# credencial do banco é GERADA em tempo de execução, gravada exclusivamente em
# ${ARQ_AMBIENTE} (fora da árvore versionada por construção, não por regra de
# ignore) com modo 0600, e daí em diante apenas LIDA. Ela nunca é impressa,
# nunca trafega por argumento de linha de comando e nunca é regravada quando já
# existe — regerá-la a cada execução quebraria as unidades de serviço que a
# consomem. Por isso o rastreio verboso de comandos do shell jamais é ligado
# aqui: ele ecoaria o valor no log da operação. A bateria de verificação confere
# essa ausência de forma literal.
#
# ADR-0006 — a instância de fila provisionada aqui NÃO é a que a verificação
# automatizada usa. A suíte sobe instância efêmera própria, com diretório e
# porta próprios. Este script provisiona o ambiente que virá a atender a
# operação; a separação entre os dois é o invariante da ADR.
#
# ---------------------------------------------------------------------------
# Convivência com o ambiente legado (guardrail mais caro desta fatia)
# ---------------------------------------------------------------------------
#
# Este servidor é COMPARTILHADO com o ambiente que atende a operação hoje
# (/opt/frappe em Docker, mais uma pilha CloudPanel com nginx, Varnish, Percona,
# memcached e um `redis-server` de sistema na porta 6379). Nada aqui pode
# degradá-lo. Três decisões decorrem disso:
#
#   * O `redis-server` de sistema NÃO é reconfigurado. O pacote do Debian/Ubuntu
#     já traz a unidade-modelo `redis-server@.service`; provisionamos uma
#     INSTÂNCIA nomeada (`redis-server@sysloc`), com arquivo de configuração,
#     diretório de dados, arquivo de log e porta próprios. Reiniciar a nossa
#     instância — na verificação e na operação — nunca afeta a do legado.
#   * O PostgreSQL não abre porta TCP alguma (`listen_addresses = ''`), o que
#     torna colisão de porta estruturalmente impossível para ele. Se alguma
#     fatia futura precisar de TCP, é uma linha no arquivo de sobreposição
#     ${ARQ_PG_DROPIN} — e aí a porta passa a entrar no guarda abaixo.
#   * As portas efetivamente ocupadas são DERIVADAS do estado real da máquina
#     (`ss -ltn`), nunca de lista fixa. Se uma porta que este script pretende
#     usar já estiver ocupada por outro processo, ele ABORTA nomeando a porta e
#     o dono — em vez de tomá-la.
#
# O script também simula a instalação de pacotes antes de executá-la e aborta se
# o gestor de pacotes pretender REMOVER qualquer coisa.
#
# ---------------------------------------------------------------------------
# Parâmetros de operação (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_DESTINO_DISCO      Sistema de arquivos medido antes de instalar
#                             qualquer coisa. Padrão: `/`, que é onde pacotes,
#                             cluster do banco, dados da fila e binário do
#                             capturador de e-mail aterrissam nesta máquina.
#                             Altere se /var passar a viver em volume próprio.
#
#   SYSLOC_MINIMO_DISCO_MIB   Espaço livre mínimo exigido, em MiB.
#                             Padrão: 1024. O valor NÃO é arbitrário — vem da
#                             soma medida dos componentes, com margem:
#
#                               pacotes do PostgreSQL 18 (instalados) .. 47 MiB
#                                 postgresql-18 34,6 + client-18 10,0 +
#                                 common 0,3 + client-common 0,2 + libpq5 1,2
#                               cache de download do apt ............... 10 MiB
#                               listas do repositório novo ............. 25 MiB
#                               cluster inicial (initdb + WAL) ......... 55 MiB
#                               binário do capturador + tarball ........ 45 MiB
#                               folga de crescimento do AOF da fila ... 200 MiB
#                               ------------------------------------------------
#                               subtotal medido ....................... 382 MiB
#                               margem de segurança (~2,7x) .......... 1024 MiB
#
#                             Reduza-o com cuidado: um `apt install` que morre
#                             sem espaço deixa o gestor de pacotes inconsistente
#                             e isso DEGRADA o ambiente legado, que é justamente
#                             o que esta fatia não pode fazer.
#
# Ao subir a versão fixada do capturador de e-mail (MAILPIT_VERSAO), atualize
# junto o MAILPIT_SHA256 — o binário vem de um artefato de release que o
# fornecedor não acompanha de arquivo de somas, então a soma é fixada aqui e
# conferida no download. Para obter a nova soma:
#
#   curl -sL https://github.com/axllent/mailpit/releases/download/<TAG>/mailpit-linux-amd64.tar.gz | sha256sum
#
# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
#
#   sudo bash deploy/scripts/instalacao/provisionar-base.sh
#
# Exige privilégio administrativo e acesso de rede ao repositório do PostgreSQL
# e ao artefato do capturador de e-mail. Verificação correspondente:
#
#   sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh
#

set -Eeuo pipefail

# --------------------------------------------------------------------------- #
# Constantes. O verificador confere que estes valores continuam declarados aqui
# nesta forma literal — mudá-los sem atualizar o verificador reprova a bateria,
# que é exatamente a proteção contra divergência silenciosa.
# --------------------------------------------------------------------------- #
readonly PREFIXO="[provisionar]"

readonly VERSAO_POSTGRES="18"
readonly PAPEL_DB="sysloc_app"
readonly BANCO_DB="sysloc"

readonly INSTANCIA_FILA="sysloc"
readonly PORTA_FILA=6380
readonly ARQ_FILA_CONF="/etc/redis/redis-sysloc.conf"
readonly DIR_FILA_DADOS="/var/lib/redis/sysloc"
readonly UNIDADE_FILA="redis-server@sysloc.service"

readonly PORTA_SMTP_CAPTURADOR=1025
readonly PORTA_HTTP_CAPTURADOR=8025
readonly MAILPIT_VERSAO="v1.30.6"
readonly MAILPIT_SHA256="00f7570bf47c9683944f6189379ce4b7d4974b1c9cd911f93c55d4ad945bf3d2"
readonly BIN_CAPTURADOR="/usr/local/bin/mailpit"
readonly DIR_ESTADO_CAPTURADOR="/var/lib/sysloc-mailpit"
readonly ARQ_UNIDADE_CAPTURADOR="/etc/systemd/system/sysloc-mailpit.service"
readonly UNIDADE_CAPTURADOR="sysloc-mailpit.service"

readonly UNIDADE_BANCO="postgresql.service"

readonly DIR_CONFIG="/etc/sysloc"
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
# Dono do arquivo de ambiente. `root` é deliberado e é o mais restritivo
# possível: o `EnvironmentFile=` das unidades de serviço (T7) é lido pelo
# systemd, que roda como root, ANTES de descer para o usuário do serviço — o
# processo da aplicação nunca precisa de permissão de leitura sobre o arquivo.
readonly DONO_ARQ_AMBIENTE="root"

readonly ARQ_FONTE_PGDG="/etc/apt/sources.list.d/pgdg.sources"
readonly ARQ_CHAVE_PGDG="/usr/share/keyrings/postgresql-pgdg.gpg"
readonly URL_CHAVE_PGDG="https://www.postgresql.org/media/keys/ACCC4CF8.asc"
readonly URL_REPO_PGDG="https://apt.postgresql.org/pub/repos/apt"
# Impressão digital da chave de assinatura do PGDG. Conferida após o download:
# baixar uma chave por HTTPS e confiar nela sem conferir é aceitar o certificado
# como única prova de origem.
readonly IMPRESSAO_CHAVE_PGDG="B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8"

readonly DIR_PG_ETC="/etc/postgresql/18/main"
readonly ARQ_PG_CONF="/etc/postgresql/18/main/postgresql.conf"
readonly DIR_PG_CONFD="/etc/postgresql/18/main/conf.d"
readonly ARQ_PG_DROPIN="/etc/postgresql/18/main/conf.d/10-sysloc.conf"
readonly ARQ_PG_HBA="/etc/postgresql/18/main/pg_hba.conf"
readonly DIR_SOCKET_PG="/var/run/postgresql"
readonly MARCADOR_HBA_INICIO="# >>> sysloc-backend (gerido por provisionar-base.sh) >>>"
readonly MARCADOR_HBA_FIM="# <<< sysloc-backend <<<"

# Portas que este script pretende abrir, com a unidade dona de cada uma. Serve
# ao guarda de colisão: se a porta já estiver ocupada e a unidade dona não for a
# nossa, o script aborta em vez de tomar a porta de alguém.
declare -rA DONO_DA_PORTA=(
	[6380]="redis-server@sysloc.service"
	[1025]="sysloc-mailpit.service"
	[8025]="sysloc-mailpit.service"
)

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
DESTINO_DISCO="${SYSLOC_DESTINO_DISCO:-/}"
MINIMO_DISCO_MIB="${SYSLOC_MINIMO_DISCO_MIB:-1024}"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
disco_antes_mib=0
total_criado=0
total_ja_ok=0
# Comunica a P12 se a configuração da fila mudou em P11 — só nesse caso a
# instância é reiniciada.
CONFIGURACAO_FILA_MUDOU=0
# Credencial do banco. Variável de shell comum, NUNCA exportada: exportá-la a
# colocaria no ambiente de todo processo filho.
senha_db=""
# Porta do cluster, descoberta em P06 a partir do estado real e consumida por P09.
porta_banco=""

# --------------------------------------------------------------------------- #
# Saída legível. Duas marcações estáveis, e só duas:
#
#   CRIADO  o passo alterou o estado do sistema;
#   JA-OK   o passo encontrou o estado já correto e não fez nada.
#
# Toda mensagem de falha diz O QUE falhou, POR QUÊ e O QUE FAZER — este script é
# executado por um humano que cola a saída de volta, não por um depurador.
# --------------------------------------------------------------------------- #
info() { printf '%s ..     %s\n' "${PREFIXO}" "$*"; }

criado() {
	total_criado=$((total_criado + 1))
	printf '%s CRIADO %s %s\n' "${PREFIXO}" "$1" "$2"
}

ja_ok() {
	total_ja_ok=$((total_ja_ok + 1))
	printf '%s JA-OK  %s %s\n' "${PREFIXO}" "$1" "$2"
}

erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer · $3 = código de saída (opc.)
abortar() {
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit "${3:-1}"
}

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara
# o trap de EXIT uma única vez e faz a limpeza acontecer — inclusive a remoção
# do diretório temporário que hospeda o arquivo de senha do cliente do banco.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Sem este gatilho, uma falha inesperada sob `set -e` sairia em silêncio e o
# operador não teria como saber em que ponto o provisionamento parou.
trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"; erro "O QUE FAZER: releia as últimas linhas acima, corrija a causa e execute o script de novo — ele é idempotente e retoma do ponto correto"' ERR

# --------------------------------------------------------------------------- #
# Utilitários.
# --------------------------------------------------------------------------- #

# Grava `destino` com o conteúdo lido da entrada padrão, mas SOMENTE se o
# conteúdo, o modo ou o dono divergirem do desejado. Devolve 0 quando escreveu
# (houve mudança) e 1 quando já estava correto — por isso é sempre chamado
# dentro de um `if`, nunca solto.
aplicar_arquivo() {
	local destino="$1" modo="$2" dono="$3" grupo="$4"
	local conteudo
	conteudo="$(cat)"

	if [[ -f "${destino}" ]] &&
		printf '%s\n' "${conteudo}" | cmp -s - "${destino}" &&
		[[ "$(stat -c '%a %U %G' "${destino}")" == "${modo#0} ${dono} ${grupo}" ]]; then
		return 1
	fi

	install -m "${modo}" -o "${dono}" -g "${grupo}" /dev/null "${destino}"
	printf '%s\n' "${conteudo}" >"${destino}"
	return 0
}

# Garante diretório com modo e dono. Devolve 0 se mudou, 1 se já estava correto.
aplicar_diretorio() {
	local destino="$1" modo="$2" dono="$3" grupo="$4"
	if [[ -d "${destino}" ]] &&
		[[ "$(stat -c '%a %U %G' "${destino}")" == "${modo#0} ${dono} ${grupo}" ]]; then
		return 1
	fi
	install -d -m "${modo}" -o "${dono}" -g "${grupo}" "${destino}"
	return 0
}

pacote_instalado() {
	[[ "$(dpkg-query -W -f='${db:Status-Status}' "$1" 2>/dev/null || true)" == "installed" ]]
}

unidade_habilitada() {
	[[ "$(systemctl is-enabled "$1" 2>/dev/null || true)" == "enabled" ]]
}

unidade_ativa() {
	[[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]
}

# Executa `psql` como o superusuário da instância, com o SQL vindo da ENTRADA
# PADRÃO — nunca por argumento. É o que mantém a credencial fora do `argv` dos
# processos filhos, visível a qualquer usuário da máquina em `ps`.
psql_admin() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -f - "$@"
}

# Consulta de leitura, com a consulta vindo por argumento (nenhuma consulta de
# leitura carrega segredo).
psql_consulta() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -c "$1"
}

# Gera um segredo alfanumérico de 32 caracteres. A restrição a [A-Za-z0-9] é
# deliberada: o valor entra numa URL de conexão, e caractere que exigisse
# codificação percentual viraria defeito silencioso no consumidor.
gerar_segredo() {
	head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-32
}

# O invariante de formato da credencial, num lugar só — usado na GERAÇÃO, na
# LEITURA (P06) e imediatamente antes da única operação que reescreve a senha do
# banco (P09).
#
# CAUSA-RAIZ de tê-lo explícito: a versão anterior tentava validar o alfabeto
# DENTRO da expressão de extração (`\([A-Za-z0-9]*\)`). Uma classe quantificada
# com `*` numa substituição não falha — ela apenas casa um prefixo mais curto e
# substitui assim mesmo. O resultado era um valor TRUNCADO e não-vazio, que
# atravessava o guarda de "formato irreconhecível" (que só testava vazio) e
# chegava ao P09, onde o `ALTER ROLE` rebaixava a senha real do banco para esse
# prefixo — silenciosamente, reportando sucesso. Extração e validação são
# passos separados desde então.
#
# Por que o alfabeto é restrito, e não apenas uma preferência: a credencial
# viaja dentro de `DATABASE_URL`, e numa URL `:`, `@`, `?`, `&` e `/` são
# delimitadores. Sem codificação percentual — que teria de estar correta nas
# duas pontas e provada por asserção — o próprio formato do arquivo não carrega
# valor arbitrário sem ambiguidade. Restringir é a decisão; exigir é o guarda.
credencial_manuseavel() {
	[[ "$1" =~ ^[A-Za-z0-9]+$ ]]
}

# Resultados de `extrair_credencial_db`. Nenhum dos dois é exportado, e
# `CREDENCIAL_LIDA` nunca é impressa.
CREDENCIAL_LIDA=""
CHAVES_REPETIDAS=""

# O CAMINHO DE LEITURA do arquivo de ambiente, inteiro e sem efeito colateral —
# não escreve, não instala, não pede privilégio. Só lê e decide.
#
# Está extraído do P06 de propósito, e isso é o conserto de um defeito de teste,
# não estética: enquanto a leitura vivia dentro de `passo_p06_arquivo_ambiente`
# — que escreve em /etc, consulta o cluster e exige root — ela era intestável, e
# a bateria acabou testando uma REIMPLEMENTAÇÃO da leitura feita no verificador.
# O resultado é que um provisionador com a leitura truncante de volta passava na
# bateria inteira. Agora o verificador extrai ESTA função do arquivo real e a
# exercita diretamente; quem valida e quem executa são o mesmo código.
#
# Devolve, por código de saída:
#   0  credencial íntegra em ${CREDENCIAL_LIDA}
#   1  não consegui interpretar o arquivo (sem DATABASE_URL/REDIS_URL utilizável)
#   2  atribuição repetida — ${CHAVES_REPETIDAS} nomeia as chaves ambíguas
#   3  interpretei, mas o valor está fora de [A-Za-z0-9]
extrair_credencial_db() {
	local arquivo="$1"
	CREDENCIAL_LIDA=""
	CHAVES_REPETIDAS=""

	if [[ ! -f "${arquivo}" ]]; then
		return 1
	fi

	# Atribuição repetida é AMBIGUIDADE, e ambiguidade se recusa — não se resolve
	# escolhendo um lado. O `EnvironmentFile=` do systemd, que é como as unidades
	# de serviço leem este arquivo, resolve repetição pela ÚLTIMA ocorrência; um
	# leitor ingênuo pega a PRIMEIRA. Escolher qualquer uma das duas deixaria a
	# divergência silenciosa: o script trabalharia com uma credencial e os
	# serviços com outra, e o passo que ressincroniza a senha rebaixaria o banco
	# para o valor obsoleto reportando sucesso. A verificação é genérica porque a
	# causa é do formato, não da chave: vale para REDIS_URL e SMTP_URL igual.
	local repetidas
	repetidas="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	if [[ -n "${repetidas// /}" ]]; then
		CHAVES_REPETIDAS="${repetidas% }"
		return 2
	fi

	# Captura GULOSA até o ÚLTIMO '@' da linha. Não é detalhe: com uma classe
	# restrita (`[A-Za-z0-9]*`) ou com `[^@]*`, uma senha que contivesse símbolo
	# — ou o próprio '@' — seria cortada no primeiro deles e o pedaço passaria
	# adiante como se fosse a credencial. Assim ela vem INTEIRA, e a reprovação
	# acontece no guarda explícito abaixo, onde é visível. Não há `head -1`:
	# depois do guarda de repetição existe no máximo uma linha DATABASE_URL.
	local valor
	valor="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}")"
	if [[ -z "${valor}" ]]; then
		return 1
	fi

	if ! credencial_manuseavel "${valor}"; then
		return 3
	fi

	CREDENCIAL_LIDA="${valor}"
	return 0
}

# Resultados de `conferir_coordenadas_do_ambiente`.
COORDENADAS_DIVERGENTES=""
CHAVES_AUSENTES=""

# Confere que o arquivo de ambiente descreve o que ESTE script provisionou —
# não apenas que as chaves têm cara de URL.
#
# CAUSA-RAIZ de existir: o P06 era tudo-ou-nada. Ou o arquivo nascia, ou ele
# apenas validava a credencial. Nada comparava as COORDENADAS declaradas com as
# que o script de fato provisiona, e a validação de forma aceitava
# `REDIS_URL=redis://127.0.0.1:6379` sem ruído nenhum — a porta da instância do
# AMBIENTE LEGADO. A partir da fatia que enfileira trabalho de negócio, isso
# colocaria a fila do backend novo dentro do processo que atende a operação
# hoje: o guardrail mais caro desta fatia furado por um arquivo de configuração,
# não por um comando. As outras duas frestas eram `SMTP_URL` nunca exigida e o
# `port=` de `DATABASE_URL` congelado no instante da criação, enquanto o P09
# valida a credencial contra a porta VIVA do cluster — divergindo, o P09
# imprimiria sucesso e as unidades de serviço apontariam para um socket
# inexistente.
#
# Sem efeito colateral, e a porta do cluster entra por parâmetro em vez de ser
# descoberta aqui dentro: é o que a torna exercitável pela bateria sem banco e
# sem privilégio, do mesmo jeito que `extrair_credencial_db`.
#
# Nenhuma das comparações toca a credencial — de `DATABASE_URL` só se olha o
# papel e o trecho DEPOIS do último '@'. Por isso as mensagens de divergência
# podem citar os valores encontrados sem vazar segredo.
#
# Devolve:
#   0  todas as chaves presentes e coerentes
#   1  ao menos uma coordenada diverge — ${COORDENADAS_DIVERGENTES} descreve
#   2  ao menos uma chave declarada está ausente — ${CHAVES_AUSENTES} nomeia
conferir_coordenadas_do_ambiente() {
	local arquivo="$1" porta_pg="$2"
	COORDENADAS_DIVERGENTES=""
	CHAVES_AUSENTES=""

	local divergentes="" ausentes=""

	local papel destino destino_esperado
	papel="$(sed -n 's|^DATABASE_URL=postgresql://\([^:/]*\):.*|\1|p' "${arquivo}" 2>/dev/null)"
	destino="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:.*@\(.*\)$|\1|p' "${arquivo}" 2>/dev/null)"
	destino_esperado="/${BANCO_DB}?host=${DIR_SOCKET_PG}&port=${porta_pg}"

	if [[ -z "${papel}" ]]; then
		ausentes="${ausentes}DATABASE_URL "
	else
		if [[ "${papel}" != "${PAPEL_DB}" ]]; then
			divergentes="${divergentes}DATABASE_URL[papel esperado '${PAPEL_DB}', encontrado '${papel}'] "
		fi
		if [[ "${destino}" != "${destino_esperado}" ]]; then
			divergentes="${divergentes}DATABASE_URL[destino esperado '${destino_esperado}', encontrado '${destino}'] "
		fi
	fi

	local chave esperado encontrado
	for chave in REDIS_URL SMTP_URL; do
		case "${chave}" in
		REDIS_URL) esperado="redis://127.0.0.1:${PORTA_FILA}" ;;
		SMTP_URL) esperado="smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}" ;;
		esac
		encontrado="$(sed -n "s|^${chave}=||p" "${arquivo}" 2>/dev/null)"
		if [[ -z "${encontrado}" ]]; then
			ausentes="${ausentes}${chave} "
		elif [[ "${encontrado}" != "${esperado}" ]]; then
			divergentes="${divergentes}${chave}[esperado '${esperado}', encontrado '${encontrado}'] "
		fi
	done

	# Divergência tem precedência sobre ausência: acrescentar uma chave a um
	# arquivo que já aponta para o lugar errado seria consertar o detalhe e
	# manter o dano.
	if [[ -n "${divergentes}" ]]; then
		COORDENADAS_DIVERGENTES="${divergentes% }"
		return 1
	fi
	if [[ -n "${ausentes}" ]]; then
		CHAVES_AUSENTES="${ausentes% }"
		return 2
	fi
	return 0
}

# --------------------------------------------------------------------------- #
# Pré-condições. Nenhuma delas altera coisa alguma no sistema.
# --------------------------------------------------------------------------- #
verificar_precondicoes() {
	if [[ "${EUID}" -ne 0 ]]; then
		abortar "este script precisa de privilégio administrativo — ele instala pacotes, cria papel de banco e escreve em /etc" \
			"execute como 'sudo bash deploy/scripts/instalacao/provisionar-base.sh'"
	fi

	local faltando=() ferramenta
	for ferramenta in apt-get dpkg-query systemctl curl gpg install ss stat sha256sum tar runuser getent df; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale os pacotes correspondentes (apt, systemd, curl, gnupg, coreutils, iproute2, util-linux) e execute de novo"
	fi

	if [[ ! "${MINIMO_DISCO_MIB}" =~ ^[0-9]+$ ]]; then
		abortar "SYSLOC_MINIMO_DISCO_MIB precisa ser um inteiro em MiB, e veio como '${MINIMO_DISCO_MIB}'" \
			"exporte um número, por exemplo SYSLOC_MINIMO_DISCO_MIB=1024"
	fi

	if [[ ! -d "${DESTINO_DISCO}" ]]; then
		abortar "o destino de medição de disco '${DESTINO_DISCO}' não existe ou não é um diretório" \
			"aponte SYSLOC_DESTINO_DISCO para um diretório existente (padrão: /)"
	fi

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-provisionar-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"
}

# Conferida DEPOIS do guarda de disco, de propósito: sem espaço nada vai ser
# instalado de qualquer forma, e a mensagem que interessa ao operador é a do
# disco — não um erro de rede que ele iria investigar à toa.
verificar_rede() {
	local codinome
	codinome="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
	if ! curl -fsS --max-time 30 -o /dev/null "${URL_REPO_PGDG}/dists/${codinome}-pgdg/Release"; then
		abortar "o repositório oficial do PostgreSQL não está alcançável em ${URL_REPO_PGDG}" \
			"confirme a saída de rede e a resolução de nomes desta máquina; sem ele não há como instalar o banco na versão fixada"
	fi
}

# --------------------------------------------------------------------------- #
# Guarda de disco. Roda ANTES de qualquer alteração — é a diferença entre um
# guarda e uma mensagem de erro tardia.
# --------------------------------------------------------------------------- #
medir_disco_mib() {
	df -BM --output=avail "$1" | tail -n 1 | tr -dc '0-9'
}

verificar_disco() {
	disco_antes_mib="$(medir_disco_mib "${DESTINO_DISCO}" || true)"
	if [[ -z "${disco_antes_mib}" ]]; then
		abortar "não foi possível medir o espaço livre em '${DESTINO_DISCO}'" \
			"confira se o caminho está montado e acessível"
	fi

	if [[ "${disco_antes_mib}" -lt "${MINIMO_DISCO_MIB}" ]]; then
		local deficit=$((MINIMO_DISCO_MIB - disco_antes_mib))
		erro "espaço livre insuficiente em '${DESTINO_DISCO}' — nada foi instalado"
		printf '%s        requerido=%d MiB  disponivel=%d MiB  deficit=%d MiB\n' \
			"${PREFIXO}" "${MINIMO_DISCO_MIB}" "${disco_antes_mib}" "${deficit}" >&2
		abortar "o provisionamento foi interrompido antes de tocar no gestor de pacotes, de propósito: uma instalação que morre no meio deixa o dpkg inconsistente e degrada o ambiente legado" \
			"libere ao menos ${deficit} MiB em '${DESTINO_DISCO}' e execute de novo; se o mínimo estiver superdimensionado para este ambiente, ajuste SYSLOC_MINIMO_DISCO_MIB (ver o cabeçalho deste script para a origem do valor)"
	fi

	info "espaço livre em '${DESTINO_DISCO}': ${disco_antes_mib} MiB (mínimo exigido: ${MINIMO_DISCO_MIB} MiB)"
}

# --------------------------------------------------------------------------- #
# Guarda de colisão de porta. As portas ocupadas são derivadas do estado real da
# máquina, nunca de lista fixa — o ambiente legado muda sem avisar este script.
# --------------------------------------------------------------------------- #
verificar_portas() {
	local porta unidade dono
	for porta in "${!DONO_DA_PORTA[@]}"; do
		if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
			continue
		fi

		unidade="${DONO_DA_PORTA[${porta}]}"
		if unidade_ativa "${unidade}"; then
			info "porta ${porta} já em uso por ${unidade} (nossa instância)"
			continue
		fi

		dono="$(ss -ltnpH "sport = :${porta}" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1)"
		abortar "a porta ${porta}, destinada a ${unidade}, já está ocupada pelo processo '${dono:-desconhecido}' — este script não toma porta de ninguém" \
			"libere a porta ${porta}, ou altere a constante correspondente no topo deste script (e no verificador) para uma porta livre desta máquina"
	done
}

# =========================================================================== #
# P01 — repositório oficial do PostgreSQL configurado.
# =========================================================================== #
passo_p01_repositorio() {
	local mudancas=0 codinome arquitetura impressao

	codinome="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
	arquitetura="$(dpkg --print-architecture)"

	if [[ ! -s "${ARQ_CHAVE_PGDG}" ]]; then
		curl -fsS --max-time 60 "${URL_CHAVE_PGDG}" \
			-o "${DIR_TEMPORARIO}/pgdg.asc" ||
			abortar "não foi possível baixar a chave de assinatura do PGDG de ${URL_CHAVE_PGDG}" \
				"confira a saída de rede e execute de novo"

		gpg --batch --yes --dearmor -o "${DIR_TEMPORARIO}/pgdg.gpg" "${DIR_TEMPORARIO}/pgdg.asc"

		impressao="$(gpg --batch --with-colons --show-keys "${DIR_TEMPORARIO}/pgdg.gpg" |
			awk -F: '$1 == "fpr" { print $10; exit }')"
		if [[ "${impressao}" != "${IMPRESSAO_CHAVE_PGDG}" ]]; then
			abortar "a chave baixada de ${URL_CHAVE_PGDG} tem impressão digital '${impressao}', e a esperada é '${IMPRESSAO_CHAVE_PGDG}'" \
				"NÃO prossiga: ou o artefato foi substituído, ou a conexão foi interceptada. Confira a chave junto ao fornecedor antes de qualquer outra coisa"
		fi

		install -m 0644 -o root -g root "${DIR_TEMPORARIO}/pgdg.gpg" "${ARQ_CHAVE_PGDG}"
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_FONTE_PGDG}" 0644 root root <<-FONTE
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Repositório oficial do PostgreSQL — a versão fixada pela stack (${VERSAO_POSTGRES})
		# não existe no repositório da distribuição, que traz apenas a 16.
		Types: deb
		URIs: ${URL_REPO_PGDG}
		Suites: ${codinome}-pgdg
		Components: main
		Architectures: ${arquitetura}
		Signed-By: ${ARQ_CHAVE_PGDG}
	FONTE
	then
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		info "atualizando as listas do gestor de pacotes (somente metadados; nada é instalado ou removido aqui)"
		DEBIAN_FRONTEND=noninteractive apt-get update -qq
		criado "P01" "repositório oficial do PostgreSQL configurado (${codinome}-pgdg)"
	else
		ja_ok "P01" "repositório oficial do PostgreSQL já configurado (${codinome}-pgdg)"
	fi
}

# =========================================================================== #
# P02 — pacotes do PostgreSQL instalados.
# =========================================================================== #
passo_p02_pacotes_banco() {
	local pacotes=("postgresql-${VERSAO_POSTGRES}" "postgresql-client-${VERSAO_POSTGRES}")
	local pendentes=() pacote

	for pacote in "${pacotes[@]}"; do
		pacote_instalado "${pacote}" || pendentes+=("${pacote}")
	done

	if [[ "${#pendentes[@]}" -eq 0 ]]; then
		ja_ok "P02" "pacotes do PostgreSQL ${VERSAO_POSTGRES} já instalados (${pacotes[*]})"
		return
	fi

	# Simulação antes da execução: num servidor compartilhado com o ambiente que
	# atende a operação, uma instalação que REMOVE pacote é dano, não efeito
	# colateral. Melhor abortar e deixar a decisão com quem opera.
	local simulacao remocoes
	simulacao="$(DEBIAN_FRONTEND=noninteractive apt-get install -s -y --no-install-recommends "${pendentes[@]}" 2>&1)"
	remocoes="$(printf '%s\n' "${simulacao}" | sed -n 's/^Remv \([^ ]*\).*/\1/p' | tr '\n' ' ')"
	if [[ -n "${remocoes// /}" ]]; then
		abortar "a instalação de '${pendentes[*]}' pretende REMOVER pacotes já presentes nesta máquina: ${remocoes}" \
			"não prossiga sem avaliar o impacto sobre o ambiente legado; investigue o conflito com 'apt-get install -s ${pendentes[*]}'"
	fi

	info "instalando ${pendentes[*]}"
	DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends "${pendentes[@]}"
	criado "P02" "pacotes do PostgreSQL ${VERSAO_POSTGRES} instalados (${pendentes[*]})"
}

# =========================================================================== #
# P03 — cluster do PostgreSQL configurado.
#
# O sobreposto vive em conf.d/ e não em postgresql.conf: reescrever o arquivo
# principal do fornecedor perderia a diferença entre "o que o pacote entregou" e
# "o que nós decidimos", e faria toda atualização do pacote virar conflito.
# =========================================================================== #
passo_p03_configuracao_banco() {
	local mudancas=0

	if [[ ! -d "${DIR_PG_ETC}" ]]; then
		abortar "o cluster ${VERSAO_POSTGRES}/main não existe — ${DIR_PG_ETC} não foi criado pela instalação do pacote" \
			"confira a saída de 'pg_lsclusters' e recrie o cluster com 'pg_createcluster ${VERSAO_POSTGRES} main --start' antes de executar de novo"
	fi

	if aplicar_diretorio "${DIR_PG_CONFD}" 0755 postgres postgres; then
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_PG_DROPIN}" 0644 postgres postgres <<-DROPIN
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Alteração manual aqui é sobrescrita na próxima execução do provisionamento.

		# Sem porta TCP alguma. A aplicação e o processador conversam com o banco
		# pelo socket de domínio Unix em ${DIR_SOCKET_PG}. Isso atende ao requisito
		# de "escuta em socket local, sem exposição de rede" e, de quebra, torna
		# colisão de porta com o ambiente legado estruturalmente impossível.
		# Se alguma fatia futura precisar de TCP, troque para 'localhost' AQUI e
		# acrescente a porta ao guarda de colisão no topo do script.
		listen_addresses = ''
		unix_socket_directories = '${DIR_SOCKET_PG}'

		# Verificador de senha moderno. Em 18 já é o padrão; declarado para que a
		# propriedade seja explícita no arquivo e não dependa do padrão da versão.
		password_encryption = 'scram-sha-256'
	DROPIN
	then
		mudancas=$((mudancas + 1))
	fi

	# O `pg_createcluster` do Debian normalmente já deixa o include ativo. A
	# conferência existe porque, se ele não estiver, o sobreposto acima seria
	# lido por ninguém e o cluster seguiria escutando em TCP — falha silenciosa,
	# que é a pior espécie.
	if ! grep -qE "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf\.d'" "${ARQ_PG_CONF}"; then
		printf '\n# Acrescentado por provisionar-base.sh (backend Sysloc): carrega %s\ninclude_dir = %s\n' \
			"${DIR_PG_CONFD}" "'conf.d'" >>"${ARQ_PG_CONF}"
		mudancas=$((mudancas + 1))
	fi

	# Regra de autenticação do papel da aplicação. Precede as regras `peer` do
	# Debian de propósito: `peer` casaria o papel com um usuário do sistema
	# homônimo, que não existe — a aplicação autentica por senha.
	if ! grep -qF "${MARCADOR_HBA_INICIO}" "${ARQ_PG_HBA}"; then
		{
			printf '%s\n' "${MARCADOR_HBA_INICIO}"
			printf '# Conexão local por socket do papel da aplicação, autenticada por senha.\n'
			printf '# Restrita ao banco "%s": nenhum outro banco desta instância é\n' "${BANCO_DB}"
			printf '# alcançável por este papel.\n'
			printf 'local   %s   %s   scram-sha-256\n' "${BANCO_DB}" "${PAPEL_DB}"
			printf '%s\n\n' "${MARCADOR_HBA_FIM}"
			cat "${ARQ_PG_HBA}"
		} >"${DIR_TEMPORARIO}/pg_hba.conf"
		install -m 0640 -o postgres -g postgres "${DIR_TEMPORARIO}/pg_hba.conf" "${ARQ_PG_HBA}"
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		info "reiniciando o cluster para carregar a configuração"
		systemctl restart "postgresql@${VERSAO_POSTGRES}-main.service"
		criado "P03" "cluster ${VERSAO_POSTGRES}/main configurado (socket local, sem escuta de rede)"
	else
		ja_ok "P03" "cluster ${VERSAO_POSTGRES}/main já configurado (socket local, sem escuta de rede)"
	fi
}

# =========================================================================== #
# P04 — serviço do banco habilitado no arranque e ativo.
# =========================================================================== #
passo_p04_servico_banco() {
	local mudancas=0
	local instancia="postgresql@${VERSAO_POSTGRES}-main.service"

	if ! unidade_habilitada "${UNIDADE_BANCO}"; then
		systemctl enable "${UNIDADE_BANCO}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${instancia}"; then
		systemctl start "${instancia}"
		mudancas=$((mudancas + 1))
	fi

	esperar_banco_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P04" "${UNIDADE_BANCO} habilitado no arranque e ${instancia} ativo"
	else
		ja_ok "P04" "${UNIDADE_BANCO} já habilitado no arranque e ${instancia} já ativo"
	fi
}

# Sondagem por estado observável, com limite — nunca espera fixa.
esperar_banco_responder() {
	local limite=60 decorrido=0
	while ! runuser -u postgres -- psql -X -q -A -t -c 'SELECT 1' >/dev/null 2>&1; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "o cluster ${VERSAO_POSTGRES}/main não aceitou conexão em ${limite}s" \
				"investigue com 'systemctl status postgresql@${VERSAO_POSTGRES}-main' e 'journalctl -u postgresql@${VERSAO_POSTGRES}-main -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# P05 — diretório de configuração fora da árvore versionada.
# =========================================================================== #
passo_p05_diretorio_config() {
	if aplicar_diretorio "${DIR_CONFIG}" 0750 root root; then
		criado "P05" "diretório de configuração ${DIR_CONFIG} criado (0750 root:root)"
	else
		ja_ok "P05" "diretório de configuração ${DIR_CONFIG} já existe (0750 root:root)"
	fi
}

# =========================================================================== #
# P06 — arquivo de ambiente com a credencial.
#
# O ponto mais sensível do script. Se o arquivo já existe e está íntegro, ele é
# REAPROVEITADO: regerar a credencial a cada execução passaria nos dois códigos
# de saída 0 e quebraria, na reinstalação seguinte, as unidades de serviço que a
# consomem. É o modo de falha que a bateria de verificação caça explicitamente.
# =========================================================================== #
passo_p06_arquivo_ambiente() {
	# Descoberta uma vez e reaproveitada por P09: o cliente do banco precisa da
	# porta mesmo numa conexão por socket, porque é ela que nomeia o arquivo do
	# socket (.s.PGSQL.<porta>).
	porta_banco="$(porta_do_cluster)"

	if [[ -f "${ARQ_AMBIENTE}" ]]; then
		# Toda a leitura acontece em `extrair_credencial_db`, que não tem efeito
		# colateral e é exercitada diretamente pela bateria. Aqui só se traduz o
		# desfecho em diagnóstico — cada um com uma causa e uma saída diferentes,
		# porque "não entendi o arquivo", "o arquivo é ambíguo" e "entendi e não
		# sei manusear o valor" pedem ações distintas do operador.
		local codigo_leitura=0
		extrair_credencial_db "${ARQ_AMBIENTE}" || codigo_leitura=$?
		senha_db="${CREDENCIAL_LIDA}"

		case "${codigo_leitura}" in
		0) : ;;
		1)
			abortar "não consegui interpretar ${ARQ_AMBIENTE}: falta uma linha 'DATABASE_URL=postgresql://USUARIO:SEGREDO@...' de onde ler a credencial" \
				"salve uma cópia do arquivo em local seguro, remova o original e execute de novo — o script gerará uma credencial nova e você precisará aplicá-la a quem já a consumia"
			;;
		2)
			abortar "${ARQ_AMBIENTE} atribui mais de uma vez a(s) chave(s): ${CHAVES_REPETIDAS} — o arquivo é ambíguo e este procedimento se recusa a escolher por você. O systemd (EnvironmentFile=) usa a ÚLTIMA atribuição e um leitor ingênuo usaria a PRIMEIRA; seguir adiante faria o script trabalhar com um valor e os serviços com outro" \
				"NADA foi alterado. Deixe exatamente UMA atribuição de cada chave em ${ARQ_AMBIENTE} (apague as linhas antigas em vez de acrescentar novas) e execute este script de novo"
			;;
		3)
			senha_db=""
			abortar "interpretei ${ARQ_AMBIENTE}, mas a credencial contém caractere fora de [A-Za-z0-9] — este procedimento não a manuseia, porque ela viaja dentro de uma URL de conexão, onde ':', '@', '?', '&' e '/' são delimitadores e exigiriam codificação percentual em ambas as pontas" \
				"NADA foi alterado. Escolha uma credencial só com letras e números, grave-a em ${ARQ_AMBIENTE} E aplique-a no banco com ALTER ROLE \"${PAPEL_DB}\" na MESMA janela; depois execute este script de novo"
			;;
		*)
			abortar "a leitura de ${ARQ_AMBIENTE} devolveu o desfecho inesperado ${codigo_leitura}" \
				"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
			;;
		esac

		local mudancas=0 detalhes=""

		# As COORDENADAS que o arquivo declara precisam ser as que este script
		# provisiona. Divergência aborta; chave declarada e ausente é acrescentada,
		# o que é aditivo — não reescreve a credencial e some na execução seguinte.
		local codigo_coordenadas=0
		conferir_coordenadas_do_ambiente "${ARQ_AMBIENTE}" "${porta_banco}" || codigo_coordenadas=$?
		case "${codigo_coordenadas}" in
		0) : ;;
		1)
			abortar "${ARQ_AMBIENTE} aponta para coordenadas diferentes das que este script provisiona: ${COORDENADAS_DIVERGENTES}. Seguir adiante faria a aplicação falar com outro serviço — no caso da fila, com a instância do ambiente legado, que é justamente o que esta fatia não pode tocar" \
				"NADA foi alterado. Corrija as linhas divergentes em ${ARQ_AMBIENTE} para os valores esperados acima (edite a linha existente, não acrescente outra), ou ajuste as constantes no topo deste script se a mudança for deliberada; depois execute de novo"
			;;
		2)
			local chave
			for chave in ${CHAVES_AUSENTES}; do
				case "${chave}" in
				REDIS_URL) printf 'REDIS_URL=redis://127.0.0.1:%s\n' "${PORTA_FILA}" >>"${ARQ_AMBIENTE}" ;;
				SMTP_URL) printf 'SMTP_URL=smtp://127.0.0.1:%s\n' "${PORTA_SMTP_CAPTURADOR}" >>"${ARQ_AMBIENTE}" ;;
				*)
					abortar "${ARQ_AMBIENTE} não declara '${chave}', e este script não sabe reconstruí-la sem a credencial" \
						"salve uma cópia do arquivo em local seguro, remova o original e execute de novo — o script gerará o arquivo inteiro, e você precisará aplicar a credencial nova a quem já a consumia"
					;;
				esac
			done
			detalhes="${detalhes}chave(s) acrescentada(s): ${CHAVES_AUSENTES}; "
			mudancas=$((mudancas + 1))
			;;
		*)
			abortar "a conferência de coordenadas de ${ARQ_AMBIENTE} devolveu o desfecho inesperado ${codigo_coordenadas}" \
				"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
			;;
		esac

		if [[ "$(stat -c '%a %U' "${ARQ_AMBIENTE}")" != "600 ${DONO_ARQ_AMBIENTE}" ]]; then
			chmod 0600 "${ARQ_AMBIENTE}"
			chown "${DONO_ARQ_AMBIENTE}:${DONO_ARQ_AMBIENTE}" "${ARQ_AMBIENTE}"
			detalhes="${detalhes}permissão corrigida para 0600 ${DONO_ARQ_AMBIENTE}; "
			mudancas=$((mudancas + 1))
		fi

		if [[ "${mudancas}" -gt 0 ]]; then
			criado "P06" "arquivo de ambiente ${ARQ_AMBIENTE} ajustado (${detalhes%; })"
		else
			ja_ok "P06" "arquivo de ambiente ${ARQ_AMBIENTE} já presente, íntegro e coerente com as coordenadas provisionadas (credencial preservada)"
		fi
		return
	fi

	senha_db="$(gerar_segredo)"
	if [[ "${#senha_db}" -ne 32 ]] || ! credencial_manuseavel "${senha_db}"; then
		abortar "a geração da credencial não produziu 32 caracteres alfanuméricos" \
			"confira se /dev/urandom está acessível nesta máquina e execute de novo"
	fi

	# `install` cria o arquivo já com 0600 ANTES de qualquer byte de segredo
	# entrar nele — não há janela em que o conteúdo exista com permissão frouxa.
	install -m 0600 -o "${DONO_ARQ_AMBIENTE}" -g "${DONO_ARQ_AMBIENTE}" /dev/null "${ARQ_AMBIENTE}"
	{
		printf '# Arquivo de ambiente do backend Sysloc.\n'
		printf '#\n'
		printf '# GERADO por deploy/scripts/instalacao/provisionar-base.sh. Vive fora da\n'
		printf '# árvore versionada por construção (ADR-0005, condição de entrada) e é\n'
		printf '# consumido pelas unidades de serviço via EnvironmentFile=.\n'
		printf '#\n'
		printf '# A credencial abaixo NÃO é regerada em execuções seguintes do\n'
		printf '# provisionamento. Se você precisar trocá-la, altere aqui E no banco\n'
		printf '# (ALTER ROLE) na mesma janela, respeitando estas duas regras:\n'
		printf '#\n'
		printf '#   1. A credencial precisa conter apenas letras e números\n'
		printf '#      ([A-Za-z0-9]). Ela viaja dentro da URL de conexão, onde :, @,\n'
		printf '#      ?, & e / são delimitadores; qualquer outro caractere faz o\n'
		printf '#      provisionamento abortar.\n'
		printf '#   2. EDITE a linha existente — não acrescente uma segunda. Cada\n'
		printf '#      chave pode ser atribuída UMA única vez neste arquivo. O systemd\n'
		printf '#      usaria a última atribuição e o provisionamento se recusa a\n'
		printf '#      adivinhar qual vale, então ele também aborta.\n'
		printf '\n'
		printf 'DATABASE_URL=postgresql://%s:%s@/%s?host=%s&port=%s\n' \
			"${PAPEL_DB}" "${senha_db}" "${BANCO_DB}" "${DIR_SOCKET_PG}" "${porta_banco}"
		printf 'REDIS_URL=redis://127.0.0.1:%s\n' "${PORTA_FILA}"
		printf 'SMTP_URL=smtp://127.0.0.1:%s\n' "${PORTA_SMTP_CAPTURADOR}"
	} >"${ARQ_AMBIENTE}"

	criado "P06" "arquivo de ambiente ${ARQ_AMBIENTE} criado (0600 ${DONO_ARQ_AMBIENTE}, credencial gerada em tempo de execução)"
}

porta_do_cluster() {
	# Derivada do estado real do cluster, não fixada: o `pg_createcluster`
	# escolhe a primeira porta livre a partir de 5432, e assumir 5432 aqui
	# produziria um socket inexistente se ela já estivesse tomada.
	local porta
	porta="$(runuser -u postgres -- psql -X -q -A -t -c 'SHOW port' 2>/dev/null | tr -dc '0-9')"
	if [[ -z "${porta}" ]]; then
		abortar "não foi possível descobrir a porta do socket do cluster ${VERSAO_POSTGRES}/main" \
			"confira 'pg_lsclusters' e o estado da unidade postgresql@${VERSAO_POSTGRES}-main"
	fi
	printf '%s' "${porta}"
}

# =========================================================================== #
# P07 — papel da aplicação.
#
# Sem SUPERUSER, sem CREATEDB, sem CREATEROLE e sem REPLICATION. O papel enxerga
# o próprio banco e nada mais.
# =========================================================================== #
passo_p07_papel() {
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_DB}'")" == "1" ]]; then
		ja_ok "P07" "papel de banco '${PAPEL_DB}' já existe"
		return
	fi

	# O SQL trafega pela entrada padrão. `log_statement`/`log_min_duration_statement`
	# são desligados na própria sessão para que a instrução com a credencial não
	# vá parar no log do servidor caso o registro de comandos esteja ligado.
	printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nCREATE ROLE \"%s\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '%s';\n" \
		"${PAPEL_DB}" "${senha_db}" | psql_admin >/dev/null

	criado "P07" "papel de banco '${PAPEL_DB}' criado (sem privilégio administrativo na instância)"
}

# =========================================================================== #
# P08 — banco da aplicação.
# =========================================================================== #
passo_p08_banco() {
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_database WHERE datname = '${BANCO_DB}'")" == "1" ]]; then
		ja_ok "P08" "banco da aplicação '${BANCO_DB}' já existe"
		return
	fi

	printf 'CREATE DATABASE "%s" OWNER "%s";\n' "${BANCO_DB}" "${PAPEL_DB}" | psql_admin >/dev/null
	# Nenhum outro papel da instância conecta neste banco.
	printf 'REVOKE ALL ON DATABASE "%s" FROM PUBLIC;\nGRANT ALL ON DATABASE "%s" TO "%s";\n' \
		"${BANCO_DB}" "${BANCO_DB}" "${PAPEL_DB}" | psql_admin >/dev/null

	criado "P08" "banco da aplicação '${BANCO_DB}' criado com dono '${PAPEL_DB}'"
}

# =========================================================================== #
# P09 — credencial validada de ponta a ponta.
#
# Sem este passo, o script poderia terminar com sucesso e a aplicação ainda não
# conseguir conectar: o arquivo de ambiente e o papel podem ter nascido em
# execuções diferentes, com valores diferentes. O arquivo de ambiente é a fonte
# de verdade, porque é o que as unidades de serviço consomem.
#
# A senha vai ao cliente por PGPASSFILE — arquivo 0600 dentro de um diretório
# temporário 0700 removido pelo trap. É o mecanismo nativo do libpq e o único
# que não coloca o valor no `argv` (visível em `ps`) nem no ambiente do processo
# (visível em /proc/PID/environ).
# =========================================================================== #
passo_p09_credencial_valida() {
	local arq_senha="${DIR_TEMPORARIO}/pgpass"

	escrever_pgpass "${arq_senha}"
	if credencial_conecta "${arq_senha}"; then
		ja_ok "P09" "a credencial de ${ARQ_AMBIENTE} conecta em '${BANCO_DB}' como '${PAPEL_DB}'"
		return
	fi

	# Invariante afirmado NO PONTO da operação perigosa. O `ALTER ROLE` abaixo é a
	# única linha do script que reescreve a senha do banco, e o defeito que este
	# guarda barra é exatamente o de reescrevê-la a partir de um valor lido pela
	# metade: a senha efetiva viraria um prefixo curto da real, com o arquivo de
	# ambiente — fonte que as unidades de serviço consomem — ainda guardando o
	# valor completo. O P06 já reprova antes de chegar aqui; esta afirmação é
	# local à operação porque é aqui que um refactor futuro do P06 faria estrago.
	if ! credencial_manuseavel "${senha_db}"; then
		abortar "recusa de reescrever a senha de '${PAPEL_DB}': a credencial em mãos não passa na verificação de formato, e reescrever a partir dela rebaixaria a senha efetiva do banco" \
			"confira ${ARQ_AMBIENTE} — a credencial precisa conter apenas letras e números; corrija-a lá e no banco (ALTER ROLE) na mesma janela"
	fi

	info "a credencial do arquivo de ambiente não conectou — ressincronizando a senha do papel a partir dele"
	printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nALTER ROLE \"%s\" WITH PASSWORD '%s';\n" \
		"${PAPEL_DB}" "${senha_db}" | psql_admin >/dev/null

	if ! credencial_conecta "${arq_senha}"; then
		abortar "mesmo após ressincronizar a senha, o papel '${PAPEL_DB}' não conecta em '${BANCO_DB}' pelo socket ${DIR_SOCKET_PG}" \
			"confira a regra do papel em ${ARQ_PG_HBA} (bloco '${MARCADOR_HBA_INICIO}') e o log em 'journalctl -u postgresql@${VERSAO_POSTGRES}-main -n 50'"
	fi

	criado "P09" "senha do papel '${PAPEL_DB}' ressincronizada com ${ARQ_AMBIENTE}"
}

escrever_pgpass() {
	local destino="$1"
	install -m 0600 -o root -g root /dev/null "${destino}"
	# Curingas nos três primeiros campos: numa conexão por socket o libpq compara
	# o campo de hospedeiro com o diretório do socket, e fixá-lo aqui só criaria
	# uma forma a mais de errar.
	printf '*:*:%s:%s:%s\n' "${BANCO_DB}" "${PAPEL_DB}" "${senha_db}" >"${destino}"
}

credencial_conecta() {
	PGPASSFILE="$1" psql -X -q -A -t \
		-h "${DIR_SOCKET_PG}" -p "${porta_banco}" -U "${PAPEL_DB}" -d "${BANCO_DB}" \
		-c 'SELECT 1' >/dev/null 2>&1
}

# =========================================================================== #
# P10 — pacote do servidor de fila.
# =========================================================================== #
passo_p10_pacote_fila() {
	if pacote_instalado redis-server; then
		ja_ok "P10" "pacote do servidor de fila já instalado ($(dpkg-query -W -f='${Version}' redis-server))"
		return
	fi

	info "instalando redis-server"
	DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends redis-server
	criado "P10" "pacote do servidor de fila instalado"
}

# =========================================================================== #
# P11 — configuração da instância própria da fila.
#
# Instância NOMEADA sobre a unidade-modelo que o próprio pacote entrega. O
# `redis-server` de sistema (porta 6379) não é tocado: ele pertence ao ambiente
# legado, e reconfigurá-lo colocaria a fila do backend novo dentro do processo
# que atende a operação hoje.
# =========================================================================== #
passo_p11_configuracao_fila() {
	local mudancas=0

	if aplicar_diretorio "${DIR_FILA_DADOS}" 0750 redis redis; then
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_FILA_CONF}" 0640 redis redis <<-FILA
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Instância '${INSTANCIA_FILA}', servida pela unidade-modelo
		# redis-server@.service que o pacote da distribuição entrega.
		# Alteração manual aqui é sobrescrita na próxima execução do provisionamento.

		# Apenas o endereço de retorno. Nada desta instância é alcançável de fora.
		bind 127.0.0.1 -::1
		port ${PORTA_FILA}
		protected-mode yes

		supervised systemd
		daemonize no
		pidfile /run/redis-${INSTANCIA_FILA}/redis-server.pid
		logfile /var/log/redis/redis-server-${INSTANCIA_FILA}.log

		# Diretório de dados próprio — separado do da instância do legado.
		dir ${DIR_FILA_DADOS}
		dbfilename dump-${INSTANCIA_FILA}.rdb

		# Persistência em disco LIGADA. Esta instância guarda a fila de trabalho,
		# não cache: perder o conteúdo significa trabalho não executado. O AOF
		# sincronizado a cada segundo limita a perda a, no máximo, um segundo de
		# escrita — e o instantâneo periódico abaixo é a segunda linha.
		appendonly yes
		appendfsync everysec
		appendfilename "appendonly-${INSTANCIA_FILA}.aof"
		appenddirname "appendonlydir"
		save 900 1
		save 300 10
		save 60 10000

		# Nunca descartar chave por pressão de memória: descarte silencioso aqui
		# seria tarefa da fila desaparecendo sem erro em lugar nenhum.
		maxmemory-policy noeviction
	FILA
	then
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P11" "instância '${INSTANCIA_FILA}' da fila configurada (porta ${PORTA_FILA}, dados em ${DIR_FILA_DADOS}, persistência em disco ligada)"
	else
		ja_ok "P11" "instância '${INSTANCIA_FILA}' da fila já configurada (porta ${PORTA_FILA}, dados em ${DIR_FILA_DADOS}, persistência em disco ligada)"
	fi

	CONFIGURACAO_FILA_MUDOU="${mudancas}"
}

# =========================================================================== #
# P12 — serviço da fila habilitado no arranque e ativo.
# =========================================================================== #
passo_p12_servico_fila() {
	local mudancas=0

	if ! unidade_habilitada "${UNIDADE_FILA}"; then
		systemctl enable "${UNIDADE_FILA}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${UNIDADE_FILA}"; then
		systemctl start "${UNIDADE_FILA}"
		mudancas=$((mudancas + 1))
	elif [[ "${CONFIGURACAO_FILA_MUDOU}" -gt 0 ]]; then
		info "reiniciando ${UNIDADE_FILA} para carregar a configuração nova"
		systemctl restart "${UNIDADE_FILA}"
		mudancas=$((mudancas + 1))
	fi

	esperar_fila_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P12" "${UNIDADE_FILA} habilitado no arranque e ativo"
	else
		ja_ok "P12" "${UNIDADE_FILA} já habilitado no arranque e já ativo"
	fi
}

esperar_fila_responder() {
	local limite=60 decorrido=0
	while [[ "$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" ping 2>/dev/null || true)" != "PONG" ]]; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "a instância '${INSTANCIA_FILA}' da fila não respondeu na porta ${PORTA_FILA} em ${limite}s" \
				"investigue com 'systemctl status ${UNIDADE_FILA}' e 'journalctl -u ${UNIDADE_FILA} -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# P13 — binário do capturador de e-mail de desenvolvimento.
# =========================================================================== #
passo_p13_binario_capturador() {
	local versao_nua="${MAILPIT_VERSAO#v}"

	if [[ -x "${BIN_CAPTURADOR}" ]] &&
		"${BIN_CAPTURADOR}" version 2>/dev/null | grep -qF "${versao_nua}"; then
		ja_ok "P13" "capturador de e-mail já instalado na versão ${MAILPIT_VERSAO} em ${BIN_CAPTURADOR}"
		return
	fi

	local url="https://github.com/axllent/mailpit/releases/download/${MAILPIT_VERSAO}/mailpit-linux-$(dpkg --print-architecture).tar.gz"
	local tarball="${DIR_TEMPORARIO}/mailpit.tar.gz"

	info "baixando o capturador de e-mail ${MAILPIT_VERSAO}"
	curl -fsSL --max-time 180 "${url}" -o "${tarball}" ||
		abortar "não foi possível baixar o capturador de e-mail de ${url}" \
			"confira a saída de rede desta máquina; se a versão fixada tiver saído do ar, atualize MAILPIT_VERSAO e MAILPIT_SHA256 no topo deste script"

	local soma
	soma="$(sha256sum "${tarball}" | cut -d' ' -f1)"
	if [[ "${soma}" != "${MAILPIT_SHA256}" ]]; then
		abortar "a soma SHA-256 do artefato baixado é '${soma}', e a fixada neste script é '${MAILPIT_SHA256}'" \
			"NÃO instale: ou o artefato da versão ${MAILPIT_VERSAO} foi republicado, ou o download foi adulterado. Confira junto ao fornecedor e só então atualize MAILPIT_SHA256"
	fi

	tar -xzf "${tarball}" -C "${DIR_TEMPORARIO}" mailpit
	install -m 0755 -o root -g root "${DIR_TEMPORARIO}/mailpit" "${BIN_CAPTURADOR}"
	criado "P13" "capturador de e-mail ${MAILPIT_VERSAO} instalado em ${BIN_CAPTURADOR} (soma SHA-256 conferida)"
}

# =========================================================================== #
# P14 — unidade do capturador de e-mail, habilitada no arranque e ativa.
#
# A unidade é gerada aqui, e não versionada em deploy/systemd/, porque aquele
# diretório pertence às unidades da aplicação e do processador, instaladas por
# outro procedimento. O conteúdo continua versionado — está neste arquivo.
#
# `DynamicUser=yes` evita criar um usuário de sistema só para o capturador: o
# systemd aloca um identificador efêmero e o `StateDirectory` nasce com o dono
# certo a cada arranque.
# =========================================================================== #
passo_p14_servico_capturador() {
	local mudancas=0

	if aplicar_arquivo "${ARQ_UNIDADE_CAPTURADOR}" 0644 root root <<-UNIDADE
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		[Unit]
		Description=Capturador de e-mail de desenvolvimento do backend Sysloc (Mailpit)
		Documentation=https://mailpit.axllent.org/
		After=network.target

		[Service]
		Type=simple
		DynamicUser=yes
		StateDirectory=sysloc-mailpit
		# Preso ao endereço de retorno nas duas portas: o capturador serve ao
		# ciclo de desenvolvimento e não é alcançável de fora desta máquina.
		ExecStart=${BIN_CAPTURADOR} --database ${DIR_ESTADO_CAPTURADOR}/mailpit.db --listen 127.0.0.1:${PORTA_HTTP_CAPTURADOR} --smtp 127.0.0.1:${PORTA_SMTP_CAPTURADOR}
		Restart=always
		RestartSec=5

		NoNewPrivileges=yes
		PrivateTmp=yes
		PrivateDevices=yes
		ProtectSystem=strict
		ProtectHome=yes
		ProtectKernelTunables=yes
		ProtectKernelModules=yes
		ProtectControlGroups=yes
		RestrictAddressFamilies=AF_INET AF_INET6
		RestrictNamespaces=yes
		RestrictRealtime=yes
		RestrictSUIDSGID=yes
		LockPersonality=yes
		SystemCallArchitectures=native

		[Install]
		WantedBy=multi-user.target
	UNIDADE
	then
		systemctl daemon-reload
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_habilitada "${UNIDADE_CAPTURADOR}"; then
		systemctl enable "${UNIDADE_CAPTURADOR}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${UNIDADE_CAPTURADOR}"; then
		systemctl start "${UNIDADE_CAPTURADOR}"
		mudancas=$((mudancas + 1))
	elif [[ "${mudancas}" -gt 0 ]]; then
		info "reiniciando ${UNIDADE_CAPTURADOR} para carregar a unidade nova"
		systemctl restart "${UNIDADE_CAPTURADOR}"
	fi

	esperar_capturador_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P14" "${UNIDADE_CAPTURADOR} instalado, habilitado no arranque e ativo (SMTP ${PORTA_SMTP_CAPTURADOR}, painel ${PORTA_HTTP_CAPTURADOR}, ambos em 127.0.0.1)"
	else
		ja_ok "P14" "${UNIDADE_CAPTURADOR} já instalado, habilitado no arranque e ativo (SMTP ${PORTA_SMTP_CAPTURADOR}, painel ${PORTA_HTTP_CAPTURADOR}, ambos em 127.0.0.1)"
	fi
}

esperar_capturador_responder() {
	local limite=60 decorrido=0
	while ! ss -ltnH "sport = :${PORTA_SMTP_CAPTURADOR}" 2>/dev/null | grep -q .; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "o capturador de e-mail não abriu a porta ${PORTA_SMTP_CAPTURADOR} em ${limite}s" \
				"investigue com 'systemctl status ${UNIDADE_CAPTURADOR}' e 'journalctl -u ${UNIDADE_CAPTURADOR} -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# Encerramento.
# =========================================================================== #
resumir() {
	local disco_depois_mib consumo
	disco_depois_mib="$(medir_disco_mib "${DESTINO_DISCO}" || true)"
	disco_depois_mib="${disco_depois_mib:-0}"
	consumo=$((disco_antes_mib - disco_depois_mib))

	printf '\n'
	info "resumo: ${total_criado} passo(s) alterado(s), ${total_ja_ok} passo(s) já corretos"
	info "disco em '${DESTINO_DISCO}': ${disco_antes_mib} MiB livres antes, ${disco_depois_mib} MiB depois (consumo ${consumo} MiB)"

	if [[ "${disco_depois_mib}" -lt "${MINIMO_DISCO_MIB}" ]]; then
		erro "o espaço livre em '${DESTINO_DISCO}' caiu para ${disco_depois_mib} MiB, abaixo do mínimo de ${MINIMO_DISCO_MIB} MiB"
		erro "O QUE FAZER: o provisionamento terminou, mas a próxima execução vai abortar no guarda de disco. Libere espaço antes de seguir para as etapas seguintes da fatia."
	fi

	info "credencial e cadeias de conexão em ${ARQ_AMBIENTE} (0600 ${DONO_ARQ_AMBIENTE}) — fora da árvore versionada"
	info "provisionamento concluído"
}

main() {
	printf '%s provisionamento dos serviços de base do backend Sysloc\n' "${PREFIXO}"

	verificar_precondicoes
	verificar_disco
	verificar_rede
	verificar_portas

	passo_p01_repositorio
	passo_p02_pacotes_banco
	passo_p03_configuracao_banco
	passo_p04_servico_banco
	passo_p05_diretorio_config
	passo_p06_arquivo_ambiente
	passo_p07_papel
	passo_p08_banco
	passo_p09_credencial_valida
	passo_p10_pacote_fila
	passo_p11_configuracao_fila
	passo_p12_servico_fila
	passo_p13_binario_capturador
	passo_p14_servico_capturador

	resumir
}

main "$@"
