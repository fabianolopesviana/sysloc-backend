#!/usr/bin/env bash
#
# Preservação dos segredos de operação — T2 da fatia `publicacao-e-backup`.
#
# Empacota o que vive em `/etc/sysloc` — os arquivos de ambiente que as unidades
# de serviço consomem — e preserva, POR CAMINHO E DESTINO PRÓPRIOS, a chave que
# decifra o segredo operável do provedor bancário.
#
# ===========================================================================
# POR QUE A CHAVE DE CIFRA NÃO ENTRA NESTE PACOTE — cláusula literal da ADR-0032
# ===========================================================================
#
# A `Decision` da ADR-0032 diz, textualmente:
#
#   "Segredo de terceiro que o produto precisa usar, e não apenas conferir, é
#    guardado cifrado de forma reversível, com a chave vivendo fora da árvore
#    versionada E FORA DO MESMO PACOTE EM QUE O MATERIAL CIFRADO É
#    SALVAGUARDADO."
#
# O material cifrado é coluna do banco, e portanto viaja dentro da CÓPIA DA BASE
# que `copiar-base.sh` produz. A chave é a variável `CHAVE_DE_CIFRA_DO_CERTIFICADO`
# do arquivo de ambiente, e portanto viajaria dentro DESTE pacote. Preservar os
# dois lado a lado, no mesmo destino, reúne chave e material cifrado no mesmo
# pacote de salvaguarda — que é exatamente o que a ADR proíbe, e cujo efeito é a
# cifra deixar de proteger coisa alguma contra quem obtenha o backup.
#
# ⚠️ ISTO NÃO É OMISSÃO A CORRIGIR. O plano de execução (§F7, item 1) mandava os
# dois artefatos no mesmo destino; o conflito foi levantado e resolvido por
# conformação à ADR na §5.2 do escopo da fatia. Reunir os dois "para simplificar
# a arrumação" desfaz uma garantia por conveniência — e é a razão de este bloco
# existir aqui, e não só no relatório.
#
# ---------------------------------------------------------------------------
# A SEPARAÇÃO É MEDIDA, NÃO DECLARADA — e é assim porque a ADR exige
# ---------------------------------------------------------------------------
#
# A mesma `Decision` fecha dizendo que a ausência de vazamento é afirmada "por
# MEDIÇÃO DA SAÍDA REAL, nunca por leitura do código". Este procedimento aplica
# isso a si mesmo, em duas etapas que não se substituem:
#
#   (1) omissão POR NOME    — as linhas que atribuem a chave são retiradas da
#                             cópia de trabalho antes de qualquer empacotamento;
#   (2) medição POR VALOR   — todo membro preparado é varrido pelo VALOR da
#                             chave, e a presença dele RECUSA a execução.
#
# A (2) não é redundância da (1), e a nota de fronteira da própria ADR-0032 diz
# por quê: o eixo por NOME DE CHAVE não alcança um segredo gravado sob nome
# neutro. Uma chave copiada para `CHAVE_ANTERIOR=`, ou para um arquivo avulso na
# raiz dos segredos, atravessa a (1) inteira e só a (2) a pega.
#
# A recusa acontece ANTES de qualquer escrita nos destinos. Empacotar e depois
# remover deixaria, no intervalo, um pacote completo em disco — e o intervalo é
# tudo o que um backup precisa para vazar.
#
# ---------------------------------------------------------------------------
# POR QUE A CHAVE PRESERVADA NUNCA É SOBRESCRITA NEM EXPURGADA
# ---------------------------------------------------------------------------
#
# Cada cópia da base foi produzida com o material cifrado pela chave vigente NA
# DATA dela. Sobrescrever a chave numa rotação, ou expurgá-la por idade, tornaria
# indecifrável todo o material das cópias anteriores — e a descoberta viria no
# dia em que a restauração é a única coisa que restou. Por isso o arquivo da
# chave é datado, e por isso este procedimento NÃO tem expurgo.
#
# ---------------------------------------------------------------------------
# ADR-0005 — NENHUMA CREDENCIAL NESTE ARQUIVO
# ---------------------------------------------------------------------------
#
# Este script é versionado e não carrega segredo. Ele LÊ a chave em tempo de
# execução, mantém-na em variável do próprio processo — nunca exportada, nunca em
# argumento de linha de comando — e jamais a imprime: nenhuma mensagem deste
# procedimento interpola o valor, nem em modo de diagnóstico. Pela mesma razão, o
# rastreio verboso de comandos do shell jamais é ligado aqui.
#
# ---------------------------------------------------------------------------
# MAPA DE DESFECHOS — o desfecho de TODA travessia é decidido, nunca herdado
# ---------------------------------------------------------------------------
#
# DECISÃO FECHADA — T2 / Gate 2 rodada 5 · 2026-08-25
# O QUÊ: cada comando externo e cada travessia deste procedimento declara, na
#        PRÓPRIA LINHA, o que acontece com o desfecho dele. A lista é EXAUSTIVA
#        e numerada de (1) a (28); o total sobe no mesmo diff que acrescentar
#        comando externo novo.
# POR QUÊ: a classe "desfecho descartado" reapareceu CINCO vezes nesta task,
#        sempre em lugar novo, e o irmão `copiar-base.sh` já a fechara duas
#        (`CT-1100 (c)` e o ramo `R4` da entrada única). Corrigir a ocorrência
#        apontada fechava um caminho e deixava os outros abertos — o que fecha a
#        classe é a ENUMERAÇÃO da superfície, não a correção da ocorrência.
# REVERTER EXIGE: demonstrar que `set -Eeuo pipefail` alcança as QUATRO formas
#        que ele estruturalmente não alcança — substituição de processo
#        (`done < <(cmd)`), `|| true`, comando externo em condição de `if` (que
#        colapsa "erro" com "não é o caso") e cano fechado cedo por `head`, que
#        sob `pipefail` devolve 141 e sepulta o desfecho real.
#
# O invariante é o do irmão, e vale em todos os pontos: NÃO SABER É O MESMO QUE
# NÃO PODER AFIRMAR. Uma raiz de segredos parcialmente ilegível não é uma raiz
# limpa, e o pacote que sai dela sem um arquivo de ambiente só é descoberto no
# dia da restauração — que é quando o pacote é a única coisa que restou.
#
# As formas de conferir, e quantos pontos cada uma responde:
#
#   (a) `set -e` alcança      20 — comando simples, atribuição simples ou
#                                  subshell fora de condição e fora de `||`;
#   (b) desfecho CAPTURADO     5 — `cmd … || codigo=$?` seguido de recusa com
#                                  diagnóstico próprio. São as duas travessias
#                                  da raiz dos segredos, os dois exames de
#                                  membro e a medição por valor da ADR-0032;
#   (c) recusa explícita       2 — `cmd || abortar …`;
#   (d) desfecho INALCANÇÁVEL  1 — `$(dirname …)` como argumento; a falha dele
#                                  vira argumento vazio, que o comando seguinte
#                                  recusa por (a).
#
# ⚠️ NENHUM `|| true` sobrevive neste arquivo, e o número é ZERO por decisão, não
# por acaso: `grep` que devolve 1 por não haver correspondência é desfecho
# NORMAL e é tratado como tal — pela FAIXA do código (0 / 1 / >1), nunca por
# descarte. Descartar o código para tolerar o 1 tolera junto o 2, que é a árvore
# que não pôde ser lida.
#
# ---------------------------------------------------------------------------
# PARÂMETROS (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_DIR_CONFIG          Raiz dos segredos de operação a preservar.
#                              Padrão: /etc/sysloc
#
#   SYSLOC_RAIZ_DO_BACKUP      Raiz do destino do pacote. O pacote fica em
#                              <raiz>/segredos.
#                              Padrão: /opt/backups/sysloc
#
#   SYSLOC_DESTINO_DA_CHAVE    Destino da chave de cifra. Tem de ficar FORA de
#                              SYSLOC_RAIZ_DO_BACKUP — é a cláusula da ADR-0032,
#                              e este procedimento a recusa quando não é o caso.
#                              Padrão: /opt/salvaguarda-da-chave
#
# ---------------------------------------------------------------------------
# USO E CONTRATO DE SAÍDA
# ---------------------------------------------------------------------------
#
#   sudo bash deploy/scripts/backup/preservar-segredos.sh
#
# O privilégio é exigido apenas para LER `/etc/sysloc`, que é do superusuário.
#
#   0  o pacote de segredos e a chave foram preservados, em destinos distintos.
#   1  reprovou. Nesse caso NÃO há pacote produzido e NÃO há resíduo `.parcial`.
#
#   ⚠️ O código 1 tem UM ramo em que os dois artefatos JÁ foram publicados: a
#   limpeza da área de preparo — que guarda cópia EM CLARO dos segredos — falhar
#   ao fim do processo. Sair 0 ali esconderia do operador uma cópia em claro
#   deixada em disco, e por isso o desfecho da limpeza também não é descartado.
#   Ver o MAPA DE DESFECHOS abaixo, pontos (1) e (2).
#
# Verificação correspondente:
#
#   bash deploy/scripts/backup/verificar-backup.sh
#

set -Eeuo pipefail

readonly PREFIXO="[preservar-segredos]"

# --------------------------------------------------------------------------- #
# Constantes.
# --------------------------------------------------------------------------- #
readonly DIR_CONFIG_PADRAO="/etc/sysloc"
readonly RAIZ_DO_BACKUP_PADRAO="/opt/backups/sysloc"
# Fora da raiz do backup POR CONSTRUÇÃO — ver o bloco da ADR-0032 no cabeçalho.
readonly DESTINO_DA_CHAVE_PADRAO="/opt/salvaguarda-da-chave"

readonly SUBDIRETORIO_DOS_SEGREDOS="segredos"

# O nome da variável que carrega a chave de cifra do segredo operável. É por ele
# que a omissão da etapa (1) reconhece a linha a retirar — e é justamente por o
# eixo por nome não bastar que existe a etapa (2), por valor.
readonly NOME_DA_CHAVE="CHAVE_DE_CIFRA_DO_CERTIFICADO"

# O arquivo de ambiente onde a chave é declarada, relativo à raiz dos segredos.
readonly ARQ_AMBIENTE_RELATIVO="backend.env"

readonly PREFIXO_DO_PACOTE="segredos-"
readonly SUFIXO_DO_PACOTE=".tar.gz"
readonly PREFIXO_DA_CHAVE="chave-de-cifra-"
readonly SUFIXO_DA_CHAVE=".env"
readonly SUFIXO_PARCIAL=".parcial"

readonly MODO_DO_DIRETORIO="700"
readonly MODO_DO_ARQUIVO="600"

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
DIR_CONFIG="${SYSLOC_DIR_CONFIG:-${DIR_CONFIG_PADRAO}}"
RAIZ_DO_BACKUP="${SYSLOC_RAIZ_DO_BACKUP:-${RAIZ_DO_BACKUP_PADRAO}}"
DESTINO_DA_CHAVE="${SYSLOC_DESTINO_DA_CHAVE:-${DESTINO_DA_CHAVE_PADRAO}}"

DIR_DOS_PACOTES="${RAIZ_DO_BACKUP}/${SUBDIRETORIO_DOS_SEGREDOS}"

# --------------------------------------------------------------------------- #
# Estado interno. Nenhuma variável é exportada: exportá-las poria a chave no
# ambiente de todo processo filho.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
PACOTE_PARCIAL=""
CHAVE_PARCIAL=""
VALOR_DA_CHAVE=""
MEMBRO_COM_A_CHAVE=""

# --------------------------------------------------------------------------- #
# Saída legível. NENHUMA destas funções recebe o valor da chave — o que se
# imprime é caminho e nome de arquivo.
# --------------------------------------------------------------------------- #
info() { printf '%s ..    %s\n' "${PREFIXO}" "$*"; }
erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer
abortar() {
	trap - ERR
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit 1
}

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		# MAPA (1) · `set -e` alcança, E A DECISÃO É MANTER ASSIM: a área de preparo
		# guarda cópia EM CLARO dos segredos, e não conseguir removê-la é falha que o
		# operador precisa ver — mesmo com os dois artefatos já publicados.
		rm -rf "${DIR_TEMPORARIO}"
	fi
	# Os intermediários nunca sobrevivem ao processo: um pacote pela metade ao
	# lado dos íntegros é indistinguível deles pelo nome, e ninguém o interpreta.
	local intermediario
	for intermediario in "${PACOTE_PARCIAL}" "${CHAVE_PARCIAL}"; do
		if [[ -n "${intermediario}" && -f "${intermediario}" ]]; then
			# MAPA (2) · `set -e` alcança, pela razão de (1): intermediário que resiste
			# à remoção é exatamente o resíduo que o contrato de saída nega existir.
			rm -f "${intermediario}"
		fi
	done
	return "${codigo}"
}
trap limpar EXIT

trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"' ERR

# --------------------------------------------------------------------------- #
# A cláusula da ADR-0032 como GUARDA EXECUTÁVEL: a chave não pode ser preservada
# dentro da raiz que guarda a cópia da base, nem a raiz do backup pode viver
# dentro do destino da chave.
#
# ⚠️ OS DOIS LADOS SÃO CANONIZADOS ANTES DE SEREM COMPARADOS, e isto é a guarda,
# não zelo. Comparar a GRAFIA decidia por prefixo de string, e três formas
# medidas atravessavam enquanto reuniam chave e material cifrado na mesma
# árvore: `/opt/backups/./sysloc/chave` e `/opt/backups/outro/../sysloc/chave`
# não começam pelo prefixo literal e ainda assim resolvem dentro dele; e um
# destino que É (ou vira) vínculo simbólico para dentro da raiz do backup nem
# chegava a ter o alvo examinado. O sentido inverso — raiz do backup escrita em
# forma relativa — tinha o mesmo furo. Com a comparação sobre o caminho
# RESOLVIDO, não sobra grafia alternativa a fechar caso a caso.
#
# `realpath -m` resolve `.`, `..`, caminho relativo e vínculo simbólico SEM
# exigir que o caminho já exista — que é justamente o caso da primeira execução,
# em que nenhum dos dois destinos foi criado ainda.
#
# A comparação segue sendo feita com a barra final nos dois lados, de modo que
# `/opt/backups/sysloc-outro` não seja lido como estando dentro de
# `/opt/backups/sysloc`.
#
# A recusa nomeia a grafia informada E o caminho resolvido: sem o resolvido, o
# operador cujo `/opt/salvaguarda-da-chave` é um vínculo leria uma mensagem que
# ele consideraria falsa, e a trataria como defeito desta rotina.
# --------------------------------------------------------------------------- #
conferir_separacao_dos_destinos() {
	# MAPA (3) e (4) · desfecho CAPTURADO na forma degradada: `realpath` que falha
	# devolve cadeia vazia, e quem decide é a recusa logo abaixo. Descartar o
	# desfecho aqui faria uma grafia irresolvível atravessar as duas comparações
	# por vacuidade — cadeia vazia é prefixo de qualquer coisa.
	local chave_resolvida backup_resolvida
	chave_resolvida="$(realpath -m -- "${DESTINO_DA_CHAVE}" 2>/dev/null)" || chave_resolvida=""
	backup_resolvida="$(realpath -m -- "${RAIZ_DO_BACKUP}" 2>/dev/null)" || backup_resolvida=""

	if [[ -z "${chave_resolvida}" || -z "${backup_resolvida}" ]]; then
		abortar \
			"não consegui resolver os destinos à forma canônica — chave (${DESTINO_DA_CHAVE}), backup (${RAIZ_DO_BACKUP}); sem isso a separação exigida pela ADR-0032 não pode ser conferida, e NENHUM pacote foi produzido" \
			"informe SYSLOC_DESTINO_DA_CHAVE e SYSLOC_RAIZ_DO_BACKUP com caminhos absolutos"
	fi

	local chave="${chave_resolvida%/}/"
	local backup="${backup_resolvida%/}/"

	if [[ "${chave}" == "${backup}"* ]]; then
		abortar \
			"o destino da chave (${DESTINO_DA_CHAVE} → ${chave_resolvida}) fica DENTRO da raiz do backup (${RAIZ_DO_BACKUP} → ${backup_resolvida}) — a ADR-0032 exige a chave fora do pacote em que o material cifrado é salvaguardado" \
			"informe SYSLOC_DESTINO_DA_CHAVE apontando para fora de ${backup_resolvida}"
	fi

	if [[ "${backup}" == "${chave}"* ]]; then
		abortar \
			"a raiz do backup (${RAIZ_DO_BACKUP} → ${backup_resolvida}) fica DENTRO do destino da chave (${DESTINO_DA_CHAVE} → ${chave_resolvida}) — a separação exigida pela ADR-0032 não existiria" \
			"informe destinos que não contenham um ao outro"
	fi
}

# --------------------------------------------------------------------------- #
# Lê o valor da chave de cifra do arquivo de ambiente.
#
# Ausência é RECUSA, e não empacotamento silencioso: sem saber qual é o valor, a
# medição por valor da etapa (2) não teria o que procurar, e o pacote sairia com
# a garantia da ADR-0032 apenas declarada. A conferência de partida da aplicação
# já exige esta variável — ausente aqui, a configuração está incompleta.
# --------------------------------------------------------------------------- #
ler_valor_da_chave() {
	local arquivo="${DIR_CONFIG}/${ARQ_AMBIENTE_RELATIVO}"

	if [[ ! -r "${arquivo}" ]]; then
		abortar \
			"o arquivo de ambiente ${arquivo} não existe ou não é legível por este usuário" \
			"execute com privilégio, ou informe SYSLOC_DIR_CONFIG apontando para uma raiz legível"
	fi

	# A leitura pega a ÚLTIMA atribuição, que é a que o `EnvironmentFile=` do
	# systemd usa — o valor conferido tem de ser o valor que a aplicação enxerga.
	# MAPA (5) · `set -e` alcança: é atribuição simples, e `pipefail` propaga o
	# desfecho do `sed`. O valor ausente tem recusa própria logo abaixo.
	VALOR_DA_CHAVE="$(sed -n "s|^${NOME_DA_CHAVE}=||p" "${arquivo}" | tail -1)"

	if [[ -z "${VALOR_DA_CHAVE}" ]]; then
		abortar \
			"${NOME_DA_CHAVE} está ausente ou vazia em ${arquivo}" \
			"grave a chave de cifra no arquivo de ambiente antes de preservar os segredos"
	fi
}

# --------------------------------------------------------------------------- #
# Monta a área de preparo: uma cópia de trabalho da raiz dos segredos, com as
# linhas que atribuem a chave RETIRADAS (etapa (1) — omissão por nome).
#
# Só arquivo comum é preservado. O que não é arquivo comum RECUSA a execução, em
# vez de ser ignorado em silêncio: um vínculo simbólico na raiz dos segredos ou
# aponta para fora dela — e o pacote levaria coisa que ninguém declarou — ou
# aponta para dentro, e o pacote levaria o mesmo segredo duas vezes. Nos dois
# casos, quem decide é o operador, não esta rotina.
# --------------------------------------------------------------------------- #
AREA_DE_PREPARO=""
montar_area_de_preparo() {
	if [[ ! -d "${DIR_CONFIG}" ]]; then
		abortar "a raiz dos segredos ${DIR_CONFIG} não existe" \
			"informe SYSLOC_DIR_CONFIG apontando para a raiz correta"
	fi

	# A área temporária nasce ANTES das travessias porque é nela que o diagnóstico
	# de cada uma é recolhido — e diagnóstico descartado é a metade calada do
	# desfecho descartado: a recusa que não cita a causa manda o operador procurar
	# sozinho o que a varredura já sabia.
	# MAPA (6) e (7) · `set -e` alcança.
	DIR_TEMPORARIO="$(mktemp -d)"
	chmod 700 "${DIR_TEMPORARIO}"

	# MAPA (8) · desfecho CAPTURADO. Era `|| true`, e o `|| true` fazia esta guarda
	# passar como se a árvore estivesse limpa: soquete, dispositivo ou vínculo
	# escondido num subdiretório ILEGÍVEL não é entrada ausente — é entrada que
	# esta rotina não pôde ver, e são exatamente essas que ela declara recusar.
	local inesperados="" codigo_das_inesperadas=0
	local diagnostico_das_inesperadas="${DIR_TEMPORARIO}/varredura-de-entradas.erro"
	inesperados="$(find "${DIR_CONFIG}" -mindepth 1 ! -type f ! -type d -printf '%P ' \
		2>"${diagnostico_das_inesperadas}")" || codigo_das_inesperadas=$?
	if [[ "${codigo_das_inesperadas}" -ne 0 ]]; then
		abortar \
			"a varredura da raiz dos segredos ${DIR_CONFIG} terminou com código ${codigo_das_inesperadas} — a árvore NÃO pôde ser lida por inteiro, e uma entrada que não é arquivo comum pode estar no trecho ilegível; NENHUM pacote foi produzido: $(tr '\n' ' ' <"${diagnostico_das_inesperadas}")" \
			"execute com privilégio, ou informe SYSLOC_DIR_CONFIG apontando para uma raiz legível por inteiro"
	fi
	if [[ -n "${inesperados// /}" ]]; then
		abortar \
			"a raiz dos segredos ${DIR_CONFIG} tem entrada que não é arquivo comum nem diretório: ${inesperados% }" \
			"resolva a entrada — esta rotina não decide sozinha se ela deve ou não ser preservada"
	fi

	# MAPA (9) · `set -e` alcança.
	AREA_DE_PREPARO="${DIR_TEMPORARIO}/preparo"
	mkdir -m 700 "${AREA_DE_PREPARO}"

	# MAPA (10) · desfecho CAPTURADO. A enumeração dos membros vinha de SUBSTITUIÇÃO
	# DE PROCESSO (`done < <(find …)`), que `set -Eeuo pipefail` não alcança: o
	# `trap ERR` imprimia a falha e o script SEGUIA, publicando um pacote sem os
	# arquivos do trecho ilegível — descoberto no dia da restauração. A listagem vai
	# a ARQUIVO, no molde de `expurgar()` em `copiar-base.sh`, e o laço lê dela.
	#
	# As duas listas e os diagnósticos vivem em ${DIR_TEMPORARIO}, IRMÃOS da área de
	# preparo e nunca dentro dela: dentro, entrariam no pacote.
	local lista="${DIR_TEMPORARIO}/membros-a-preservar"
	local diagnostico_dos_membros="${lista}.erro"
	local codigo_dos_membros=0
	find "${DIR_CONFIG}" -mindepth 1 -type f -printf '%P\0' \
		>"${lista}" 2>"${diagnostico_dos_membros}" || codigo_dos_membros=$?
	if [[ "${codigo_dos_membros}" -ne 0 ]]; then
		abortar \
			"a enumeração dos membros de ${DIR_CONFIG} terminou com código ${codigo_dos_membros} — a raiz NÃO pôde ser lida por inteiro e o pacote sairia SEM os arquivos do trecho ilegível; NENHUM pacote foi produzido: $(tr '\n' ' ' <"${diagnostico_dos_membros}")" \
			"execute com privilégio, ou informe SYSLOC_DIR_CONFIG apontando para uma raiz legível por inteiro"
	fi

	local diagnostico_do_membro="${DIR_TEMPORARIO}/exame-do-membro.erro"
	local relativo origem alvo
	while IFS= read -r -d '' relativo; do
		origem="${DIR_CONFIG}/${relativo}"
		alvo="${AREA_DE_PREPARO}/${relativo}"
		# MAPA (11) · desfecho INALCANÇÁVEL pela forma — `$(…)` como argumento. Um
		# `dirname` que falhasse viraria argumento vazio, e o (12) o recusa.
		# MAPA (12) e (13) · `set -e` alcança.
		mkdir -p "$(dirname "${alvo}")"
		install -m "${MODO_DO_ARQUIVO}" "${origem}" "${alvo}"

		# A omissão por nome só toca arquivo de TEXTO em que a atribuição existe:
		# reescrever um arquivo binário para tirar uma linha o corromperia.
		#
		# MAPA (14) · desfecho CAPTURADO por FAIXA, e não lido em condição de `if`:
		# `grep` devolve 1 quando a linha não está lá — desfecho NORMAL — e >1 quando
		# não pôde LER o arquivo. O `if` colapsava os dois, e não saber se a chave
		# está no membro é o mesmo que não poder afirmar que ela não está.
		local desfecho_do_exame=0
		grep -Iq "^${NOME_DA_CHAVE}=" "${alvo}" 2>"${diagnostico_do_membro}" ||
			desfecho_do_exame=$?
		if [[ "${desfecho_do_exame}" -gt 1 ]]; then
			abortar \
				"não consegui examinar [${relativo}] para saber se ele declara ${NOME_DA_CHAVE} (o exame terminou com código ${desfecho_do_exame}); NENHUM pacote foi produzido: $(tr '\n' ' ' <"${diagnostico_do_membro}")" \
				"confira a permissão de leitura de ${DIR_CONFIG}/${relativo} e execute de novo"
		fi

		if [[ "${desfecho_do_exame}" -eq 0 ]]; then
			# MAPA (15) · desfecho CAPTURADO por FAIXA. Era `|| true`, e o `mv` da linha
			# seguinte PUBLICAVA o dano: `grep -v` devolve 1 quando nenhuma linha sobrou
			# — o arquivo que só tinha a atribuição, desfecho normal — e >1 quando a
			# leitura ou a escrita falhou, caso em que o `mv` sobrepunha o membro por um
			# arquivo truncado, e o pacote levava o segredo mutilado em vez do arquivo.
			local desfecho_da_omissao=0
			grep -v "^${NOME_DA_CHAVE}=" "${alvo}" >"${alvo}.sem-a-chave" \
				2>"${diagnostico_do_membro}" || desfecho_da_omissao=$?
			if [[ "${desfecho_da_omissao}" -gt 1 ]]; then
				abortar \
					"não consegui retirar a linha ${NOME_DA_CHAVE}= de [${relativo}] (a omissão terminou com código ${desfecho_da_omissao}) — o membro iria para o pacote truncado, ou com a chave; NENHUM pacote foi produzido: $(tr '\n' ' ' <"${diagnostico_do_membro}")" \
					"confira a permissão de leitura de ${DIR_CONFIG}/${relativo} e execute de novo"
			fi
			# MAPA (16) e (17) · `set -e` alcança.
			mv -f "${alvo}.sem-a-chave" "${alvo}"
			chmod "${MODO_DO_ARQUIVO}" "${alvo}"
			info "a linha ${NOME_DA_CHAVE}= foi retirada de ${relativo} (ADR-0032)"
		fi
	done <"${lista}"
}

# --------------------------------------------------------------------------- #
# Etapa (2) — MEDIÇÃO POR VALOR sobre o que seria empacotado.
#
# Devolve 0 quando nenhum membro contém o valor, e 1 quando algum contém, com o
# membro em ${MEMBRO_COM_A_CHAVE}. Há um TERCEIRO desfecho, e ele não devolve
# nada: não ter conseguido varrer a raiz por inteiro ABORTA aqui dentro — uma
# medição que não mediu não pode ser relatada como "nenhum membro contém".
#
# O valor chega por parâmetro e nunca é impresso: o que a recusa nomeia é o
# ARQUIVO, jamais o segredo — e `grep -l` só emite nomes, nos dois canais.
#
# `grep -F -e` de propósito: o valor é base64 e pode começar por '-' ou conter
# caracteres que uma expressão regular interpretaria.
# --------------------------------------------------------------------------- #
medir_presenca_do_valor() {
	local raiz="$1" valor="$2"
	MEMBRO_COM_A_CHAVE=""

	# MAPA (18) · desfecho CAPTURADO por FAIXA — 0 achou, 1 não achou (o desfecho
	# esperado), >1 não PÔDE varrer. Era `… | head -1 || true`, com dois furos na
	# mesma linha: o `|| true` engolia o código 2 de uma raiz que o `grep` não
	# conseguiu ler por inteiro, e o cano fechado cedo pelo `head` devolvia 141 sob
	# `pipefail`. Nos dois casos a etapa (2) — a que a ADR-0032 exige "por MEDIÇÃO
	# DA SAÍDA REAL" — passava sem ter medido, e o pacote saía assim mesmo.
	#
	# Por isso a listagem vai a ARQUIVO em vez de a um cano: com o cano, o desfecho
	# real do `grep` era irrecuperável.
	local lista="${DIR_TEMPORARIO}/medicao-por-valor"
	local diagnostico="${lista}.erro"
	local codigo=0
	grep -rlF -e "${valor}" "${raiz}" >"${lista}" 2>"${diagnostico}" || codigo=$?

	if [[ "${codigo}" -gt 1 ]]; then
		abortar \
			"a medição por valor não pôde varrer ${raiz} por inteiro (terminou com código ${codigo}) — sem ela a garantia da ADR-0032 ficaria apenas DECLARADA, e NENHUM pacote foi produzido: $(tr '\n' ' ' <"${diagnostico}")" \
			"confira a permissão de leitura da raiz dos segredos e execute de novo"
	fi

	if [[ "${codigo}" -eq 0 ]]; then
		# MAPA (19) · `set -e` alcança: com código 0 a lista tem ao menos uma linha.
		local achado
		achado="$(head -1 "${lista}")"
		MEMBRO_COM_A_CHAVE="${achado#"${raiz}"/}"
		return 1
	fi

	return 0
}

# --------------------------------------------------------------------------- #
# Prepara um destino: cria o que falta e CORRIGE o modo do que já existia — o
# caso comum é o diretório preexistente com modo frouxo, que só se conserta
# quando alguém o corrige de fato.
# --------------------------------------------------------------------------- #
preparar_diretorio() {
	local diretorio="$1"
	# MAPA (20) e (21) · recusa EXPLÍCITA — `cmd || abortar …`, nas duas linhas.
	if [[ ! -d "${diretorio}" ]]; then
		mkdir -p "${diretorio}" ||
			abortar "não consegui criar o destino ${diretorio}" \
				"confira a permissão de escrita do caminho"
	fi
	chmod "${MODO_DO_DIRETORIO}" "${diretorio}" ||
		abortar "não consegui corrigir o modo de ${diretorio} para ${MODO_DO_DIRETORIO}" \
			"confira o dono do caminho — segredo de operação não fica legível a terceiros"
}

main() {
	conferir_separacao_dos_destinos
	ler_valor_da_chave
	montar_area_de_preparo

	# A medição acontece ANTES de qualquer escrita em destino — nem os diretórios
	# chegam a ser criados quando ela recusa.
	if ! medir_presenca_do_valor "${AREA_DE_PREPARO}" "${VALOR_DA_CHAVE}"; then
		abortar \
			"o valor de ${NOME_DA_CHAVE} foi encontrado em [${MEMBRO_COM_A_CHAVE}], que iria para o pacote — a ADR-0032 proíbe chave e material cifrado no mesmo pacote de salvaguarda; NENHUM pacote foi produzido" \
			"retire a chave de ${MEMBRO_COM_A_CHAVE} na raiz dos segredos e execute de novo; a chave é preservada em ${DESTINO_DA_CHAVE}"
	fi

	info "medição por valor: nenhum membro do pacote contém ${NOME_DA_CHAVE}"

	preparar_diretorio "${RAIZ_DO_BACKUP}"
	preparar_diretorio "${DIR_DOS_PACOTES}"
	preparar_diretorio "${DESTINO_DA_CHAVE}"

	# MAPA (22) · `set -e` alcança: é atribuição simples.
	local data
	data="$(date +%F)"

	local pacote="${DIR_DOS_PACOTES}/${PREFIXO_DO_PACOTE}${data}${SUFIXO_DO_PACOTE}"
	PACOTE_PARCIAL="${pacote}${SUFIXO_PARCIAL}"

	# Empacota pelos nomes relativos, em ordem estável, com dono neutro: o pacote
	# é restaurado por outro processo, e carregar o identificador numérico de quem
	# o produziu só cria divergência na hora de repor.
	# MAPA (23) · `set -e` alcança o subshell inteiro: ele é comando simples, fora
	# de condição e fora de `||`, e as opções do shell são herdadas — `pipefail`
	# propaga a falha do `find` e do `sort`, e o `cd` que falhasse aborta ali. É a
	# diferença entre este cano e o que existia na medição por valor: aqui nenhum
	# membro do cano fecha o de trás cedo, então não há 141 a mascarar desfecho.
	(
		umask 077
		cd "${AREA_DE_PREPARO}"
		find . -type f -printf '%P\n' | LC_ALL=C sort |
			tar --owner=0 --group=0 --numeric-owner -czf "${PACOTE_PARCIAL}" -T -
	)

	# MAPA (24) e (25) · `set -e` alcança. O (25) é a publicação do pacote: falhar
	# aqui deixa o `.parcial`, que `limpar` remove — o contrato de saída o promete.
	chmod "${MODO_DO_ARQUIVO}" "${PACOTE_PARCIAL}"
	mv -f "${PACOTE_PARCIAL}" "${pacote}"
	PACOTE_PARCIAL=""
	info "pacote de segredos publicado: ${pacote}"

	local arq_chave="${DESTINO_DA_CHAVE}/${PREFIXO_DA_CHAVE}${data}${SUFIXO_DA_CHAVE}"
	CHAVE_PARCIAL="${arq_chave}${SUFIXO_PARCIAL}"

	# MAPA (26), (27) e (28) · `set -e` alcança as três. O arquivo nasce com o modo
	# restrito ANTES de receber a chave, e só então é publicado — a ordem é a
	# garantia, e o desfecho de cada passo é o que a sustenta.
	install -m "${MODO_DO_ARQUIVO}" /dev/null "${CHAVE_PARCIAL}"
	printf '%s=%s\n' "${NOME_DA_CHAVE}" "${VALOR_DA_CHAVE}" >"${CHAVE_PARCIAL}"
	mv -f "${CHAVE_PARCIAL}" "${arq_chave}"
	CHAVE_PARCIAL=""
	info "chave de cifra preservada em destino próprio: ${arq_chave}"

	info "os dois artefatos vivem em destinos distintos, como a ADR-0032 exige"
}

main
