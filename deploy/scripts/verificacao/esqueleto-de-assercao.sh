#!/usr/bin/env bash
#
# Esqueleto de asserção das baterias de shell — a casa comum que fecha o
# `D9 · F0/T2` (T5 da fatia `publicacao-e-backup`).
#
# Carregue-o por `source`; ele não faz nada sozinho:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"
#
# ===========================================================================
# POR QUE ELE EXISTE — e por que só agora
# ===========================================================================
#
# O vocabulário de asserção que `.claude/rules/testing-stack.md` fixa estava
# COPIADO em cada `verificar-*.sh` do repositório. O `D9 · F0/T2` registrou o
# débito em 2026-08-19 e mediu o que ele realmente era: as cópias não eram o
# mesmo esqueleto repetido — eram DIALETOS do mesmo esqueleto, cada um livre
# para divergir. A medição de 2026-08-26, ao fechá-lo, confirmou a natureza e
# enumerou as divergências, que são exatamente quatro:
#
#   (1) `caso` contava os casos executados em 4 das 12 baterias e nas outras 8
#       não; `fechar_caso` contava os aprovados em 3;
#   (2) `aviso` existia em 9 das 12, somava `avisos_totais` em 5 dessas 9 e saía
#       pela saída de erro em 5 — combinações que não coincidem entre si;
#   (3) `nota` existia em 9 das 12, com dois prefixos distintos (`..` em 5,
#       `nota` em 4);
#   (4) `afirmar_diferente` existia em 11 das 12, com TRÊS redações distintas de
#       mensagem de falha.
#
# Nenhuma dessas divergências era decisão de ninguém: eram o resíduo de cada
# bateria nova ter nascido copiando a vizinha mais próxima. Endurecer uma cópia
# deixava as outras onze para trás — que é o defeito que o Limiar de Três do
# `CLAUDE.md` nomeia, e que aqui já estava em doze.
#
# ===========================================================================
# O QUE ENTRA AQUI, E O QUE NÃO ENTRA
# ===========================================================================
#
# Entram os OITO símbolos das sete linhas do vocabulário canônico da
# `testing-stack.md` — a última linha da tabela dela (`aviso`/`nota`) tem dois
# símbolos, e por isso sete linhas dão oito nomes.
#
# ⚠️ Entra TAMBÉM, desde 2026-08-26, o RECORTE DE FUNÇÃO DO INSTALADOR
# (`texto_da_funcao_do_instalador` e os dois carregadores que o consomem). Ele
# NÃO é vocabulário de asserção e NÃO entra em `SIMBOLOS_DO_ESQUELETO`; ele mora
# aqui pelo mesmo motivo que os oito — o Limiar de Três disparou literalmente, e
# as três declarações locais já haviam divergido. A seção no fim deste arquivo
# mede a divergência.
#
# NÃO entram, e a razão de cada uma é medida:
#
#   `limpar`  — cada bateria libera recursos próprios (instância de banco, borda
#               efêmera, ponto de montagem). Uma casa comum aqui seria um corpo
#               vazio que cada bateria sobrescreveria, isto é, nada.
#   `afirmar_contem`
#             — existe em quatro baterias, e elas NÃO são o mesmo símbolo:
#               `verificar-captura.sh` recebe `<descrição> <arquivo> <agulha>` e
#               grepa um ARQUIVO, enquanto as outras três recebem
#               `<descrição> <agulha> <texto>` e comparam uma STRING. Unificá-las
#               exigiria decidir qual assinatura vence e reescrever chamadas em
#               bateria que este host não executa sem privilégio — troca de
#               duplicação conhecida por regressão invisível, que é exatamente o
#               que o `POR QUE NÃO AGORA` do `D9` recusava.
#   as de domínio (`afirmar_desfecho_dos_caminhos`, `afirmar_forma_e_procedencia`,
#               `afirmar_sem_bloqueio`, …) — falam do que a bateria prova, e não
#               de como ela afirma.
#
# ===========================================================================
# AS QUATRO UNIFICAÇÕES, E POR QUE CADA UMA É A UNIÃO E NUNCA A INTERSEÇÃO
# ===========================================================================
#
# Onde os dialetos divergiam, esta casa adota a forma que PRESERVA informação —
# nunca a que a descarta. Contador que só quatro baterias mantinham passa a
# existir nas doze: as oito que não o liam continuam sem lê-lo, e nenhuma perde
# o que já tinha. A alternativa (adotar a interseção, isto é, o menor
# denominador) apagaria o resumo `N/M casos aprovados` de três baterias que o
# imprimem, e isso seria regressão de prova travestida de simplificação.
#
#   `caso`            soma `casos_executados`  (união de 4/12)
#   `fechar_caso`     soma `casos_aprovados`   (união de 3/12)
#   `aviso`           soma `avisos_totais` E sai pela SAÍDA DE ERRO — a razão
#                     está escrita em `verificar-fundacao.sh` desde a F0:
#                     *"`aviso` é degradação declarada e vai para a saída de erro
#                     — o canal que um agregador reencaminha —, `nota` é
#                     diagnóstico de execução e fica na saída padrão"*.
#   `nota`            adota o prefixo `..`, de 5 das 9 que a declaravam.
#   `afirmar_diferente`
#                     adota a redação de 6 das 11 que a declaravam.
#
# ⚠️ A (4) tem uma consequência que NÃO é cosmética, e que a extração fecha de
# graça: `verificar-preparacao-do-material.sh` não declarava `afirmar_diferente`
# alguma. Sob `set -e`, um caso que precisasse da negativa cairia em
# `command not found` e ABORTARIA a bateria no meio, em vez de reprovar um caso —
# defeito que o comentário de `verificar-captura.sh` já nomeava desde a F0, e que
# ele resolvia copiando a função mais uma vez.
#
# ⚠️ `avisos_totais` NÃO governa o código de saída de bateria alguma, e não pode
# passar a governar: quem o governa é `falhas_totais`, e só ele. O contador
# existe porque o RESUMO é a linha que o operador lê — anunciar "N/N casos
# aprovados" numa execução em que uma asserção não pôde ser medida transforma
# medição parcial em aprovação lida como completa.
#
# ===========================================================================
# POR QUE O NOME NÃO COMEÇA COM `verificar-`
# ===========================================================================
#
# `deploy/scripts/verificacao/rodar-baterias.sh` descobre as baterias por
# `find deploy/scripts -name 'verificar-*.sh'`. Um arquivo que casasse esse
# molde seria EXECUTADO como bateria, e este aqui não afirma nada — sairia
# sempre verde, inflando o quadro com uma aprovação vazia. É a mesma proteção
# que o cabeçalho do agregador declara para si.
#

# Ele define funções e contadores; executá-lo direto não faz nada útil e
# esconde o erro de quem quis `source`.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	printf 'ERRO: %s é para ser carregado por `source`, não executado.\n' "${BASH_SOURCE[0]}" >&2
	exit 64
fi

# --------------------------------------------------------------------------- #
# Contadores — a fonte única. Toda bateria roda sob `set -u`, e é por eles
# nascerem aqui que nenhuma precisa lembrar de declarar o contador que o
# esqueleto lê.
# --------------------------------------------------------------------------- #
falhas_totais=0
falhas_caso=0
avisos_totais=0
casos_executados=0
casos_aprovados=0

# Os RÓTULOS das degradações declaradas, na ordem em que saíram.
#
# O contador diz quantas; ele não diz QUAIS. A bateria que precisa afirmar o
# conjunto das asserções que este host não permitiu medir — é o caso do CT-1121
# de `verificar-backup.sh` — precisa dos rótulos, e registrá-los na entrada
# única é o que impede a lista de depender de alguém lembrar de alimentá-la no
# ponto de cada degradação nova.
DEGRADACOES_OBSERVADAS=()

# --------------------------------------------------------------------------- #
# As sete linhas do vocabulário canônico (oito símbolos).
# --------------------------------------------------------------------------- #

caso() {
	printf '\n[%s] %s\n' "$1" "$2"
	falhas_caso=0
	casos_executados=$((casos_executados + 1))
}

ok() { printf '    OK   %s\n' "$*"; }

falhar() {
	falhas_caso=$((falhas_caso + 1))
	falhas_totais=$((falhas_totais + 1))
	printf '    FALHA %s\n' "$*" >&2
}

afirmar_igual() {
	if [[ "$2" == "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — esperado [$2], obtido [$3]"
	fi
}

afirmar_diferente() {
	if [[ "$2" != "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — obtido [$3], que não deveria ser [$2]"
	fi
}

# A entrada ÚNICA de degradação. Ver o bloco das unificações, acima.
aviso() {
	avisos_totais=$((avisos_totais + 1))
	DEGRADACOES_OBSERVADAS+=("$*")
	printf '    AVISO %s\n' "$*" >&2
}

nota() { printf '    ..   %s\n' "$*"; }

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		casos_aprovados=$((casos_aprovados + 1))
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# =========================================================================== #
# O RECORTE DE FUNÇÃO DO INSTALADOR — acréscimo de 2026-08-26 (T9).
#
# ⚠️ Ele NÃO é vocabulário de asserção, e por isso NÃO entra em
# `SIMBOLOS_DO_ESQUELETO` (a lista dos oito, em `verificar-backup.sh`). Ele mora
# aqui pela mesma razão que os oito: o Limiar de Três do `CLAUDE.md` disparou
# LITERALMENTE — eram três declarações locais em duas baterias, e elas já
# haviam divergido.
#
# A divergência foi MEDIDA no Gate 2 da T9:
#
#   · `verificar-borda-do-app.sh` recortava por `awk` que PULA o corpo de cada
#     heredoc, porque `validar_vhost_isolado` escreve um `nginx.conf` cuja chave
#     de fecho do bloco `http {` começa na COLUNA ZERO;
#   · `verificar-notificacao-bancaria.sh` recortava por `sed -n "/^nome() {/,/^}/p"`
#     em DUAS declarações (`carregar_funcao_do_instalador` e
#     `..._como`), e `instalar-borda-de-notificacao.sh` tem a MESMA
#     `validar_vhost_isolado`, com o MESMO heredoc e a MESMA chave em coluna
#     zero. Ali a armadilha estava ARMADA e não disparada: aquela bateria só não
#     quebrava porque a função está fora do elenco que ela carrega.
#
# Um recorte cortado ao meio faz o `eval` morrer com `unexpected end of file`, e
# a bateria fica SEM SUT — o que ela reporta como falha, mas por razão errada.
# A união (o `awk`) é estritamente mais capaz: para função sem heredoc, ele
# recorta exatamente o mesmo texto que o `sed` recortava.
#
# ⚠️ `INSTALADOR` é declarado pela BATERIA, não aqui: cada uma tem o seu. As
# doze que não o declaram simplesmente nunca chamam estas funções — o `set -u`
# acusaria na hora se chamassem.
# =========================================================================== #

# O TEXTO de uma função do instalador real, do cabeçalho `nome() {` até a chave
# que fecha a FUNÇÃO — nunca a primeira chave em coluna zero, que pode ser de um
# heredoc. Devolve 1 quando não encontra a função.
texto_da_funcao_do_instalador() {
	local nome="$1" trecho
	trecho="$(awk -v nome="${nome}" '
		$0 == nome "() {" { dentro = 1 }
		dentro {
			print
			if (delimitador != "") {
				if ($0 == delimitador) { delimitador = "" }
				next
			}
			if (match($0, /<<-?[A-Za-z_][A-Za-z0-9_]*/)) {
				delimitador = substr($0, RSTART, RLENGTH)
				sub(/<<-?/, "", delimitador)
				next
			}
			if ($0 == "}") { exit }
		}
	' "${INSTALADOR}")"
	[[ -n "${trecho}" ]] || return 1
	printf '%s\n' "${trecho}"
}

# Carrega uma função do INSTALADOR REAL, pelo texto do arquivo. Quem valida e
# quem executa passam a ser o mesmo código, e uma reimplementação na bateria
# aprovaria um instalador com o defeito de volta.
carregar_funcao_do_instalador() {
	local nome="$1" trecho
	trecho="$(texto_da_funcao_do_instalador "${nome}")" || return 1
	eval "${trecho}"
	declare -F "${nome}" >/dev/null
}

# Carrega uma função do instalador SOB OUTRO NOME.
#
# Existe por uma colisão concreta: a função de limpeza de um dos instaladores se
# chama `limpar`, e é esse o nome da função que a bateria registra em
# `trap ... EXIT`. Carregá-la pelo nome próprio substituiria a limpeza do
# verificador pelo SUT — a bateria passaria a se limpar com o código que ela
# está medindo, e um defeito na limpeza do instalador vazaria para o teardown.
#
# O corte é do cabeçalho `nome() {` para diante; o corpo inteiro, chaves e todo
# o resto, continua sendo o do arquivo real.
carregar_funcao_do_instalador_como() {
	local nome="$1" apelido="$2" trecho
	trecho="$(texto_da_funcao_do_instalador "${nome}")" || return 1
	eval "${apelido}() {${trecho#*\{}"
	declare -F "${apelido}" >/dev/null
}
