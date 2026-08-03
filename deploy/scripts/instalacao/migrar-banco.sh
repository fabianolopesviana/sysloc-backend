#!/usr/bin/env bash
#
# Aplicação das migrações do backend Sysloc — T5 da fatia
# `fundacao-multitenancy-identidade`.
#
# Aplica, em ordem, os arquivos de `packages/db/migracoes/` ao banco da operação,
# conectando com o papel `sysloc_migracao` — o DONO das tabelas, que não atende
# requisição nenhuma.
#
# ---------------------------------------------------------------------------
# Por que a migração roda FORA do processo que atende
# ---------------------------------------------------------------------------
#
# Porque quem cria a tabela é dono dela, e dono ignora a política de linha
# enquanto não houver `FORCE ROW LEVEL SECURITY`. Se o processo que atende
# requisição aplicasse migração, ele precisaria conectar como dono — e a partir
# daí o isolamento seria uma propriedade de qual conexão o código escolheu, e não
# do banco (ADR-0008). Com os dois papéis separados, contornar o isolamento passa
# a exigir duas falhas independentes: o `FORCE` teria de sumir E a aplicação teria
# de estar conectada com o papel errado.
#
# Decorre daí a divisão de trabalho com `provisionar-base.sh`: os papéis e os dois
# schemas nascem LÁ, com privilégio administrativo; aqui só nascem TABELAS, que
# pertencem ao migrador por consequência de ele ser quem as cria. Não há nenhum
# `ALTER ... OWNER` neste caminho, e não pode haver: transferir propriedade exige
# pertencer ao papel de destino, e esse pertencimento é exatamente o que a suíte
# de isolamento prova não existir.
#
# ---------------------------------------------------------------------------
# ADR-0005 — idempotência e transporte do segredo
# ---------------------------------------------------------------------------
#
# IDEMPOTÊNCIA. Executar duas vezes seguidas termina com sucesso nas duas e não
# produz efeito adicional. O estado do que já foi aplicado mora NO BANCO, numa
# tabela de registro (${TABELA_REGISTRO}), e não num arquivo ao lado do script:
# o registro precisa acompanhar o banco em restauração de cópia de segurança e
# ser por banco, não por máquina. Cada arquivo aplicado é registrado com a soma
# SHA-256 do conteúdo, e um arquivo cuja soma mudou depois de aplicado ABORTA em
# vez de reaplicar — reaplicar SQL estrutural já executado é o caminho curto para
# um banco em estado que ninguém sabe descrever.
#
# SEGREDO. A credencial do papel de migração trafega por `PGPASSFILE` — arquivo
# 0600 dentro de um diretório temporário 0700, removido pelo `trap`. É o
# mecanismo nativo do libpq e o único que não coloca o valor no `argv` (visível
# em `ps` para qualquer usuário desta máquina) nem no ambiente do processo
# (visível em `/proc/PID/environ`). O rastreio verboso de comandos do shell
# jamais é ligado aqui, pelo mesmo motivo: ele ecoaria o valor na saída.
#
# ---------------------------------------------------------------------------
# Parâmetros de operação (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_BANCO_ALVO   Banco que recebe as migrações. Padrão: o banco declarado
#                       na cadeia de conexão de ${ARQ_AMBIENTE_MIGRACAO}, que é o
#                       da operação. Existe para a bateria
#                       `verificar-migracao.sh` apontar o script a um banco
#                       DESCARTÁVEL — o único outro nome que a regra de
#                       autenticação do ${ARQ_PG_HBA} alcança. Não é um segredo:
#                       é um nome de banco.
#
# Uso:
#   sudo bash deploy/scripts/instalacao/migrar-banco.sh
#
# Exige privilégio administrativo — ele lê ${ARQ_AMBIENTE_MIGRACAO}, que é 0600 e
# pertence ao root. Verificação correspondente:
#
#   sudo bash deploy/scripts/instalacao/verificar-migracao.sh
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

# --------------------------------------------------------------------------- #
# Constantes espelhadas de `provisionar-base.sh`. A bateria de verificação
# confere que os dois arquivos continuam declarando os mesmos valores — é o que
# impede este script de envelhecer em silêncio.
# --------------------------------------------------------------------------- #
readonly PREFIXO="[migrar]"

readonly PAPEL_MIGRACAO="sysloc_migracao"
readonly PAPEL_DB="sysloc_app"
readonly SCHEMA_IDENTIDADE="identidade"
readonly SCHEMA_NEGOCIO="negocio"
readonly ARQ_AMBIENTE_MIGRACAO="/etc/sysloc/migracao.env"
readonly ARQ_PG_HBA="/etc/postgresql/18/main/pg_hba.conf"

# Diretório dos arquivos de migração e o padrão que os reconhece. O mesmo par que
# `packages/db/test/banco-efemero.ts` usa para aplicar as MESMAS migrações na
# instância efêmera da suíte — dois consumidores, uma fonte.
readonly DIR_MIGRACOES="${RAIZ_REPO}/packages/db/migracoes"
readonly PADRAO_MIGRACAO='^[0-9]{4}_[A-Za-z0-9_-]+\.sql$'

# Onde mora o registro do que já foi aplicado.
#
# Ele vive em `identidade` porque é o único schema disponível que NÃO está sob o
# regime de isolamento: uma tabela em `negocio` sem `empresa_id` e sem RLS
# forçada seria acusada pela guarda de cobertura da ADR-0009 — corretamente,
# porque `negocio` é o schema em que toda tabela é de negócio. Registro de
# migração não é dado de tenant e não tem empresa a que pertencer.
#
# Ele não é dado de aplicação tampouco: o alcance do papel que atende requisição
# a esta tabela é retirado DENTRO da mesma transação que aplica cada arquivo (ver
# `aplicar_arquivo_de_migracao`), e de novo ao fim da execução (ver
# `retirar_alcance_da_aplicacao`). A primeira é a que vale em execução
# interrompida; a segunda é rede de um caminho que já não existe.
readonly TABELA_REGISTRO="${SCHEMA_IDENTIDADE}.migracao_aplicada"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
ARQ_PGPASS=""
# Credencial do papel de migração. Variável de shell comum, NUNCA exportada:
# exportá-la a colocaria no ambiente de todo processo filho.
senha_migracao=""
hospedeiro_banco=""
porta_banco=""
banco_alvo=""
total_aplicado=0
total_ja_ok=0

# --------------------------------------------------------------------------- #
# Saída legível — as mesmas duas marcações de `provisionar-base.sh`:
#
#   CRIADO  o passo alterou o estado do banco;
#   JA-OK   o passo encontrou o estado já correto e não fez nada.
# --------------------------------------------------------------------------- #
info() { printf '%s ..     %s\n' "${PREFIXO}" "$*"; }

criado() {
	total_aplicado=$((total_aplicado + 1))
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
	# O `return` com código diferente de zero, na saída de um `abortar`, dispara o
	# gatilho de erro abaixo — que então imprime "falha inesperada" LOGO DEPOIS de
	# uma recusa já explicada, mandando o operador procurar um defeito que não
	# existe. Desarmá-lo aqui é o que mantém a última linha da saída sendo a causa
	# real. O gatilho já cumpriu o papel dele neste ponto: se a morte foi
	# inesperada, ele imprimiu a linha e o comando antes de o encerramento começar.
	trap - ERR
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara o
# trap de EXIT uma única vez e remove o diretório que hospeda o arquivo de senha.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"; erro "O QUE FAZER: releia as últimas linhas acima e corrija a causa; este script é idempotente e pode ser executado de novo — a migração que falhou não deixou metade aplicada, porque cada arquivo vai numa transação só"' ERR

# --------------------------------------------------------------------------- #
# Leitura da credencial.
#
# Espelha `extrair_credencial_migracao` de `provisionar-base.sh`, e as três
# propriedades que ela carrega são as mesmas, cada uma fechando um defeito real
# registrado lá por extenso:
#
#   1. atribuição repetida é AMBIGUIDADE e se recusa;
#   2. a captura é GULOSA até o ÚLTIMO '@' — classe restrita dentro da expressão
#      de extração não falha, ela TRUNCA;
#   3. a validação de alfabeto é um passo SEPARADO da extração.
#
# O valor sai por stdout do subshell e é capturado numa variável local pelo
# chamador — nunca é impresso, nunca vai para argumento de comando, nunca é
# gravado fora do arquivo 0600 do `PGPASSFILE`.
# --------------------------------------------------------------------------- #
credencial_manuseavel() {
	[[ "$1" =~ ^[A-Za-z0-9]+$ ]]
}

# Devolve, por código de saída: 0 íntegra · 1 ilegível · 2 ambígua · 3 alfabeto.
CREDENCIAL_LIDA=""
CHAVES_REPETIDAS=""
extrair_credencial_migracao() {
	local arquivo="$1"
	CREDENCIAL_LIDA=""
	CHAVES_REPETIDAS=""

	[[ -f "${arquivo}" ]] || return 1

	local repetidas
	repetidas="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	if [[ -n "${repetidas// /}" ]]; then
		CHAVES_REPETIDAS="${repetidas% }"
		return 2
	fi

	local valor
	valor="$(sed -n 's|^MIGRATION_DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}")"
	[[ -n "${valor}" ]] || return 1
	credencial_manuseavel "${valor}" || return 3

	CREDENCIAL_LIDA="${valor}"
	return 0
}

# O DESTINO declarado pela cadeia — tudo depois do último '@'. Não carrega
# credencial, e é por isso que as mensagens de erro podem citá-lo.
extrair_destino_de_migracao() {
	sed -n 's|^MIGRATION_DATABASE_URL=postgresql://.*@\(.*\)$|\1|p' "$1"
}

# --------------------------------------------------------------------------- #
# Acesso ao banco.
# --------------------------------------------------------------------------- #

# Toda conexão deste script passa por aqui. `-w` recusa qualquer prompt de senha:
# sem ele, uma credencial errada faria o script travar esperando digitação em vez
# de falhar. O caminho do arquivo de senha entra por atribuição de comando único —
# é um CAMINHO, não o segredo, e ele não sobrevive ao processo filho.
psql_migrador() {
	PGPASSFILE="${ARQ_PGPASS}" psql -v ON_ERROR_STOP=1 -X -q -A -t -w \
		-h "${hospedeiro_banco}" -p "${porta_banco}" -U "${PAPEL_MIGRACAO}" -d "${banco_alvo}" "$@"
}

escrever_pgpass() {
	local destino="$1"
	install -m 0600 -o root -g root /dev/null "${destino}"
	# Curingas nos três primeiros campos: o cliente casa a entrada pelo hospedeiro
	# que ele próprio resolveu, e fixá-lo aqui só criaria uma forma a mais de
	# errar — a entrada deixaria de casar por um detalhe do lado do cliente e a
	# falha apareceria como "senha errada".
	printf '*:*:%s:%s:%s\n' "${banco_alvo}" "${PAPEL_MIGRACAO}" "${senha_migracao}" >"${destino}"
}

# --------------------------------------------------------------------------- #
# Pré-condições — tudo o que precisa estar de pé ANTES de a primeira instrução
# estrutural ser enviada.
# --------------------------------------------------------------------------- #
exigir_privilegio() {
	if [[ "${EUID}" -ne 0 ]]; then
		printf 'ERRO: este procedimento precisa de privilégio administrativo — ele lê %s, que é 0600 e pertence ao root.\n' \
			"${ARQ_AMBIENTE_MIGRACAO}" >&2
		printf '      Execute como: sudo bash deploy/scripts/instalacao/migrar-banco.sh\n' >&2
		exit 1
	fi
}

exigir_ferramentas() {
	local faltando=() ferramenta
	for ferramenta in psql sha256sum install mktemp sed grep sort; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale o pacote que a fornece (o cliente do PostgreSQL vem em 'postgresql-client-18') e execute de novo"
	fi
}

# Os dois schemas precisam existir E pertencer ao migrador. Sem esta conferência,
# a primeira migração falharia com "permission denied for database" — mensagem que
# aponta para o sintoma e esconde a causa, que é o provisionamento não ter rodado.
exigir_schemas_do_provisionamento() {
	local esperado="${SCHEMA_IDENTIDADE}=${PAPEL_MIGRACAO} ${SCHEMA_NEGOCIO}=${PAPEL_MIGRACAO}"
	local obtido
	obtido="$(psql_migrador -c "
		SELECT string_agg(n.nspname || '=' || r.rolname, ' ' ORDER BY n.nspname)
		FROM pg_catalog.pg_namespace n
		JOIN pg_catalog.pg_roles r ON r.oid = n.nspowner
		WHERE n.nspname IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}')" 2>/dev/null || true)"

	if [[ "${obtido}" != "${esperado}" ]]; then
		abortar "o banco '${banco_alvo}' não está preparado para receber migração — esperava os schemas [${esperado}] e encontrei [${obtido:-nenhum}]" \
			"execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh' antes desta migração: é ele quem cria os dois schemas com dono '${PAPEL_MIGRACAO}', porque criá-los aqui exigiria conceder CREATE sobre o banco ao migrador"
	fi
}

# --------------------------------------------------------------------------- #
# Registro do que já foi aplicado.
# --------------------------------------------------------------------------- #
garantir_tabela_de_registro() {
	# `client_min_messages = warning` cala o aviso de "relação já existe" que o
	# `IF NOT EXISTS` emite a cada execução a partir da segunda. Não é cosmética:
	# a saída deste script é comparada linha a linha pela bateria de verificação,
	# e ruído previsível numa das execuções e não na outra é diferença que não veio
	# de mudança de estado.
	#
	# A retirada vai JUNTO, e no mesmo `psql -c`, porque a criação também é um ponto
	# de concessão. `0001_seguranca.sql` instala `ALTER DEFAULT PRIVILEGES FOR ROLE
	# "${PAPEL_MIGRACAO}" IN SCHEMA identidade GRANT ... ON TABLES TO "${PAPEL_DB}"`,
	# que se aplica NO INSTANTE DO `CREATE` — de modo que num banco onde o 0001 já
	# foi aplicado e o livro-razão não exista (remoção manual, restauração parcial)
	# a tabela nasceria já com os quatro verbos, e nessa execução todo arquivo sai
	# JA-OK ou ela aborta antes, sem a transação de aplicação passar por aqui.
	# `psql -c` com várias instruções é UMA transação implícita: criação e retirada
	# commitam juntas também neste ponto.
	#
	# TERCEIRO SÍTIO da mesma decisão — ver o marcador `DECISÃO FECHADA — T5 /
	# Gate 2` em `aplicar_arquivo_de_migracao`. O `REVOKE` abaixo NÃO é redundante
	# com `retirar_alcance_da_aplicacao`, apesar de a instrução ser idêntica: aquela
	# é rede de fim de execução, esta commita junto com o `CREATE` que torna a
	# concessão possível. Removê-la exige o que o `REVERTER EXIGE` daquele marcador
	# pede — não a observação de que "já existe outra igual".
	psql_migrador -c "
		SET client_min_messages = warning;
		CREATE TABLE IF NOT EXISTS ${TABELA_REGISTRO} (
			arquivo     text        PRIMARY KEY,
			soma_sha256 text        NOT NULL,
			aplicada_em timestamptz NOT NULL DEFAULT now()
		);
		REVOKE ALL ON TABLE ${TABELA_REGISTRO} FROM PUBLIC, \"${PAPEL_DB}\"" >/dev/null
}

# A tabela de registro não é dado de aplicação. A concessão `ON ALL TABLES IN
# SCHEMA identidade` do `0001_seguranca.sql` alcança tudo o que existir no schema
# no instante em que ela roda — inclusive esta tabela, que já existe nesse ponto.
# Retirar o alcance é o que mantém o registro fora do que o papel que atende
# requisição pode ler ou escrever, sem precisar que o SQL da migração conheça uma
# tabela que não é dele.
#
# ESTA CHAMADA NÃO É A DEFESA — ela é a rede dela. A defesa está dentro da
# transação de `aplicar_arquivo_de_migracao`, onde a retirada commita junto com a
# concessão que a torna necessária; ver o marcador `DECISÃO FECHADA` lá. Esta
# chamada permanece porque custa uma instrução no-op ao fim de uma execução bem-
# sucedida e cobre o dia em que alguém conceda o alcance por fora das migrações.
retirar_alcance_da_aplicacao() {
	psql_migrador -c "REVOKE ALL ON TABLE ${TABELA_REGISTRO} FROM PUBLIC, \"${PAPEL_DB}\"" >/dev/null
}

# A soma registrada para um arquivo, ou vazio se ele nunca foi aplicado.
soma_registrada() {
	psql_migrador -c "SELECT soma_sha256 FROM ${TABELA_REGISTRO} WHERE arquivo = '$1'"
}

# --------------------------------------------------------------------------- #
# Aplicação.
# --------------------------------------------------------------------------- #

# O conteúdo do arquivo e o registro dele vão na MESMA transação. Não é detalhe:
# em transações separadas, uma queda entre as duas deixaria a estrutura aplicada e
# o registro ausente, e a execução seguinte tentaria reaplicar tudo — que é
# exatamente o modo de falha que a idempotência existe para impedir.
#
# `--single-transaction` é o que embrulha o arquivo inteiro; `ON_ERROR_STOP=1` é o
# que faz o erro no meio abortar em vez de seguir para a instrução seguinte.
aplicar_arquivo_de_migracao() {
	local caminho="$1" nome="$2" soma="$3"

	# Os dois valores são interpolados em literais SQL, então o formato de cada um
	# é EXIGIDO em vez de presumido. `nome` vem de `basename` sobre um arquivo que
	# já casou ${PADRAO_MIGRACAO}, e `soma` vem de `sha256sum` — as duas
	# afirmações abaixo são baratas e fecham a porta para o dia em que uma das duas
	# origens mudar.
	if [[ ! "${nome}" =~ ${PADRAO_MIGRACAO} ]]; then
		abortar "o nome de arquivo de migração '${nome}' não casa o padrão esperado" \
			"renomeie o arquivo em ${DIR_MIGRACOES} para a forma NNNN_nome.sql e execute de novo"
	fi
	if [[ ! "${soma}" =~ ^[0-9a-f]{64}$ ]]; then
		abortar "a soma SHA-256 calculada para '${nome}' não tem a forma esperada: [${soma}]" \
			"isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
	fi

	# O `printf` de quebra de linha antes do INSERT não é ornamento: o gerador de
	# migração não garante quebra de linha ao fim do arquivo, e sem ela o INSERT
	# seria concatenado ao último comando.
	# DECISÃO FECHADA — T5 / Gate 2 · 2026-08-02
	# O QUÊ: a retirada do alcance da aplicação sobre o livro-razão vai DENTRO da
	#        transação que aplica cada arquivo, e não só ao fim de `main`.
	# POR QUÊ: instalada apenas no fim, ela era ação compensatória POSTERIOR à
	#          concessão, e toda saída anterior a pulava — o `abortar` de soma
	#          divergente, o gatilho ERR de SQL que falha, qualquer sinal. Como
	#          `0001_seguranca.sql` concede os quatro verbos `ON ALL TABLES IN SCHEMA
	#          identidade` e a tabela de registro JÁ EXISTE nesse instante (ela é
	#          criada antes do laço), uma execução interrompida DEPOIS do 0001
	#          deixava `${PAPEL_DB}` com escrita sobre a tabela que decide se SQL
	#          estrutural é aplicado — e uma linha forjada com nome e soma corretos
	#          faz este script reportar JA-OK e NUNCA aplicar aquele arquivo, o
	#          próprio 0001 inclusive. Aqui a concessão e a retirada commitam
	#          JUNTAS. O alcance desta linha é ESTE ponto de entrada: o outro em que
	#          o livro-razão pode nascer já concedido é `garantir_tabela_de_registro`,
	#          alcançado pelo `ALTER DEFAULT PRIVILEGES` do 0001 no instante do
	#          `CREATE`, e ele fecha a sua concessão no próprio `psql -c` (Gate 1,
	#          rodada 3). Os dois estão cobertos; a chamada ao fim de `main` deixou
	#          de ser a única defesa em qualquer dos dois.
	# REVERTER EXIGE: provar que nenhum caminho de saída deste script — aborto,
	#          gatilho ERR, sinal, queda do processo — pode terminar entre o
	#          `GRANT ... ON ALL TABLES IN SCHEMA identidade` de uma migração e a
	#          chamada de `retirar_alcance_da_aplicacao` ao fim de `main`.
	#
	# Sobre o 0000 a instrução é no-op SILENCIOSO — nada foi concedido ainda e o
	# cliente não emite linha alguma, medido; sobre os arquivos seguintes é no-op
	# idempotente. Medição do par, em instância própria e efêmera, com um `0002`
	# sintético que falha: 4 verbos remanescentes com a retirada só no fim, 0 com
	# ela aqui. O CT-031 (i) de `verificar-migracao.sh` é essa medição virada
	# asserção, contra o cluster real.
	{
		cat "${caminho}"
		printf '\nINSERT INTO %s (arquivo, soma_sha256) VALUES (%s, %s);\n' \
			"${TABELA_REGISTRO}" "'${nome}'" "'${soma}'"
		printf 'REVOKE ALL ON TABLE %s FROM PUBLIC, "%s";\n' \
			"${TABELA_REGISTRO}" "${PAPEL_DB}"
	} | psql_migrador --single-transaction -f - >/dev/null
}

# --------------------------------------------------------------------------- #
main() {
	exigir_privilegio
	exigir_ferramentas

	if [[ -n "${1:-}" ]]; then
		printf 'ERRO: este procedimento não recebe argumentos (recebido: %s)\n' "$1" >&2
		printf '      uso: sudo bash %s\n' "$(basename "${BASH_SOURCE[0]}")" >&2
		printf '      para apontá-lo a outro banco, use SYSLOC_BANCO_ALVO=<banco>\n' >&2
		exit 64
	fi

	printf '%s aplicação das migrações do backend Sysloc\n' "${PREFIXO}"

	if [[ ! -d "${DIR_MIGRACOES}" ]]; then
		abortar "o diretório de migrações não existe em ${DIR_MIGRACOES}" \
			"confira se este script está sendo executado a partir do repositório versionado"
	fi

	local codigo_leitura=0
	extrair_credencial_migracao "${ARQ_AMBIENTE_MIGRACAO}" || codigo_leitura=$?
	senha_migracao="${CREDENCIAL_LIDA}"
	case "${codigo_leitura}" in
	0) : ;;
	1)
		abortar "não consegui ler uma credencial de migração de ${ARQ_AMBIENTE_MIGRACAO}: o arquivo não existe ou não tem uma linha 'MIGRATION_DATABASE_URL=postgresql://USUARIO:SEGREDO@...'" \
			"execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh' — é ele quem gera a credencial do papel '${PAPEL_MIGRACAO}' e grava esse arquivo com modo 0600"
		;;
	2)
		abortar "${ARQ_AMBIENTE_MIGRACAO} atribui mais de uma vez a(s) chave(s): ${CHAVES_REPETIDAS} — o arquivo é ambíguo e este procedimento se recusa a escolher por você" \
			"NADA foi alterado. Deixe exatamente UMA atribuição de cada chave nesse arquivo e execute de novo"
		;;
	3)
		senha_migracao=""
		abortar "a credencial em ${ARQ_AMBIENTE_MIGRACAO} contém caractere fora de [A-Za-z0-9] — ela viaja dentro de uma URL de conexão, onde ':', '@', '?', '&' e '/' são delimitadores" \
			"NADA foi alterado. Corrija a credencial nesse arquivo E no banco (ALTER ROLE) na mesma janela; depois execute de novo"
		;;
	*)
		abortar "a leitura de ${ARQ_AMBIENTE_MIGRACAO} devolveu o desfecho inesperado ${codigo_leitura}" \
			"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
		;;
	esac

	# O destino vem da MESMA cadeia que carrega a credencial: hospedeiro, porta e
	# banco declarados por quem provisionou, não presumidos aqui. Presumir 5432
	# produziria conexão a um cluster que pode nem ser o nosso.
	local destino banco_declarado
	destino="$(extrair_destino_de_migracao "${ARQ_AMBIENTE_MIGRACAO}")"
	hospedeiro_banco="${destino%%:*}"
	porta_banco="${destino#*:}"
	porta_banco="${porta_banco%%/*}"
	banco_declarado="${destino#*/}"

	if [[ -z "${hospedeiro_banco}" || ! "${porta_banco}" =~ ^[0-9]+$ || -z "${banco_declarado}" ]]; then
		abortar "não consegui interpretar o destino declarado em ${ARQ_AMBIENTE_MIGRACAO}: [${destino}]" \
			"a cadeia precisa ter a forma postgresql://USUARIO:SEGREDO@HOSPEDEIRO:PORTA/BANCO; corrija-a e execute de novo"
	fi

	banco_alvo="${SYSLOC_BANCO_ALVO:-${banco_declarado}}"

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-migrar-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"
	ARQ_PGPASS="${DIR_TEMPORARIO}/pgpass"
	escrever_pgpass "${ARQ_PGPASS}"

	info "banco alvo: ${banco_alvo} em ${hospedeiro_banco}:${porta_banco}, como '${PAPEL_MIGRACAO}'"

	if ! psql_migrador -c 'SELECT 1' >/dev/null 2>&1; then
		abortar "o papel '${PAPEL_MIGRACAO}' não conecta em '${banco_alvo}' por ${hospedeiro_banco}:${porta_banco}" \
			"execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh' para ressincronizar a credencial, e confira a regra 'host' do papel em ${ARQ_PG_HBA}"
	fi

	exigir_schemas_do_provisionamento
	garantir_tabela_de_registro

	local -a arquivos=()
	local caminho
	while IFS= read -r caminho; do
		[[ -n "${caminho}" ]] || continue
		[[ "$(basename "${caminho}")" =~ ${PADRAO_MIGRACAO} ]] || continue
		arquivos+=("${caminho}")
	done < <(find "${DIR_MIGRACOES}" -maxdepth 1 -type f -name '*.sql' | sort)

	if [[ "${#arquivos[@]}" -eq 0 ]]; then
		abortar "nenhum arquivo de migração encontrado em ${DIR_MIGRACOES}" \
			"gere as migrações com 'pnpm --filter @sysloc/db gerar-migracao' antes de aplicar"
	fi

	local nome soma registrada
	for caminho in "${arquivos[@]}"; do
		nome="$(basename "${caminho}")"
		soma="$(sha256sum "${caminho}" | cut -d' ' -f1)"
		registrada="$(soma_registrada "${nome}")"

		if [[ -z "${registrada}" ]]; then
			aplicar_arquivo_de_migracao "${caminho}" "${nome}" "${soma}"
			criado "${nome}" "aplicada como '${PAPEL_MIGRACAO}' (soma ${soma:0:12}…)"
			continue
		fi

		if [[ "${registrada}" != "${soma}" ]]; then
			abortar "a migração '${nome}' já foi aplicada em '${banco_alvo}', mas o conteúdo do arquivo MUDOU desde então (registrada ${registrada:0:12}…, atual ${soma:0:12}…)" \
				"NADA foi alterado. Migração aplicada é imutável: reverta a edição de ${caminho} e escreva a mudança como um arquivo NOVO, com o número seguinte"
		fi

		ja_ok "${nome}" "já aplicada em '${banco_alvo}' (soma confere)"
	done

	retirar_alcance_da_aplicacao

	printf '\n'
	info "resumo: ${total_aplicado} migração(ões) aplicada(s), ${total_ja_ok} já estava(m) aplicada(s)"
	info "migração concluída"
}

main "$@"
