#!/usr/bin/env bash
#
# 03-ligar-email-real.sh — Virada F7, etapa 3: o produto passa a entregar
# e-mail de verdade.
#
# ---------------------------------------------------------------------------
# POR QUE ESTE SCRIPT NÃO INSTALA SERVIDOR DE E-MAIL
# ---------------------------------------------------------------------------
#
# Decisão do usuário, 2026-09-08: a caixa `sysloc@systera.com.br` é IDENTIDADE
# DE REMETENTE, e não caixa postal. Ela não recebe. As duas razões são do
# produto, não de conveniência:
#
#   · o corpo do aviso diz, desde o sistema antigo, «NAO RESPONDA ESSA MENSAGEM!
#     CONTA DE EMAIL NAO MONITORADA»;
#   · a resposta do locatário vai para o e-mail da EMPRESA, pelo `Reply-To`.
#
# Uma caixa que ninguém escreve e ninguém lê custaria Postfix como domínio
# virtual, Dovecot, porta 993 exposta, certificado próprio para
# `mail.systera.com.br` (com a porta 80 ocupada pelo CloudPanel) e administração
# de spam. Nada disso é necessário para ENVIAR.
#
# ---------------------------------------------------------------------------
# POR QUE A SAÍDA VAI POR RELAY, e não direto deste servidor
# ---------------------------------------------------------------------------
#
# MEDIDO em 2026-09-08: o PTR de 177.185.117.139 é
# `clt-home-139.117.185.177.fibron.com.br` — faixa de cliente, e não bate com
# `systera.com.br`. A porta 25 de saída está aberta e o IP não está na Spamhaus
# ZEN nem na SpamCop, de modo que enviar daqui é tecnicamente POSSÍVEL; o que
# não se consegue é ENTREGAR na caixa de entrada. `From:` de domínio próprio
# saindo de PTR residencial sem correspondência direta é a combinação que Gmail
# e Outlook mais punem, e o que estaria em jogo é o aviso de cobrança de um
# cliente real.
#
# ---------------------------------------------------------------------------
# ⚠️ O SEGREDO NÃO PASSA POR AQUI EM TEXTO VISÍVEL
# ---------------------------------------------------------------------------
#
# A chave SMTP vem do AMBIENTE (`BREVO_CHAVE_SMTP`), nunca de argumento de linha
# de comando — `argv` é legível por qualquer processo do host via /proc. Ela é
# gravada no `EnvironmentFile` (0600 root) e NUNCA é impressa: toda saída deste
# script mascara a credencial.
#
# Uso:
#   sudo BREVO_LOGIN='<login-smtp>' BREVO_CHAVE_SMTP='<chave>' \
#        bash /opt/sysloc-backend/deploy/scripts/virada/03-ligar-email-real.sh
#
#   # com envio de prova para um endereço real:
#   sudo BREVO_LOGIN=... BREVO_CHAVE_SMTP=... DESTINO_DE_PROVA='voce@exemplo.com' \
#        bash /opt/sysloc-backend/deploy/scripts/virada/03-ligar-email-real.sh
#
#   sudo bash .../03-ligar-email-real.sh --desfazer     # volta ao capturador local
set -uo pipefail

RAIZ="/opt/sysloc-backend"
ARQ_AMBIENTE="/etc/sysloc/backend.env"
REMETENTE_NOVO="sysloc@systera.com.br"
HOSPEDEIRO_DO_RELAY="smtp-relay.brevo.com"
# 465 (TLS implícito) e não 587 (STARTTLS): com `smtps:` o adaptador marca
# `secure: true` e o canal nasce cifrado, sem a janela em claro do STARTTLS em
# que um intermediário pode suprimir o anúncio da extensão e rebaixar a conexão.
PORTA_DO_RELAY="465"
CARIMBO="$(date +%Y%m%d-%H%M%S)"

# Ver a seção "COMO A PROVA RODA", no passo 3: este host resolve `node` pelo
# gerenciador de versões do usuário dono da árvore, e não pelo sistema.
DONO_DA_ARVORE="$(stat -c '%U' "${RAIZ}")"
HOME_DO_DONO="$(getent passwd "${DONO_DA_ARVORE}" | cut -d: -f6)"

# ⚠️ O binário é DERIVADO do `ExecStart` da unidade que já opera — nunca escrito
# aqui como literal. Duas razões, e as duas são medidas:
#
#   · o SHIM do mise (`~/.local/share/mise/shims/node`) exige que o diretório
#     corrente pertença a um projeto com `.mise.toml`, ou que haja versão global
#     declarada. MEDIDO em 2026-09-08, de /tmp: `mise ERROR No version is set
#     for shim: node`. O script roda do diretório em que o operador estiver, e
#     não se pode contar com ele;
#   · escrever o caminho literal criaria a SEGUNDA declaração da versão de Node
#     do produto, livre para divergir da que a unidade executa — e a prova
#     passaria a rodar num runtime diferente do que atende.
NODE_DA_PRODUCAO="$(systemctl show sysloc-api -p ExecStart --value 2>/dev/null \
	| sed -nE 's#.*path=([^ ;]+).*#\1#p')"

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."
[ -f "${ARQ_AMBIENTE}" ] || falha "${ARQ_AMBIENTE} não existe."

# Troca UMA chave EDITANDO a linha existente. Nunca acrescenta uma segunda: o
# systemd usaria a última atribuição e `provisionar-base.sh` ABORTA quando acha
# a mesma chave duas vezes, por se recusar a adivinhar qual vale.
definir_chave() {
	local chave="$1" valor="$2"
	if grep -q "^${chave}=" "${ARQ_AMBIENTE}"; then
		# O valor entra por arquivo, e não por expressão do sed: uma chave com
		# `&`, `/` ou `\` seria reinterpretada pelo sed e gravaria outra coisa.
		python3 - "${ARQ_AMBIENTE}" "${chave}" "${valor}" <<'PY'
import sys
arquivo, chave, valor = sys.argv[1], sys.argv[2], sys.argv[3]
linhas = open(arquivo, encoding='utf-8').read().splitlines(keepends=True)
saida = []
for linha in linhas:
    if linha.startswith(chave + '='):
        fim = '\n' if linha.endswith('\n') else ''
        saida.append(f'{chave}={valor}{fim}')
    else:
        saida.append(linha)
open(arquivo, 'w', encoding='utf-8').writelines(saida)
PY
	else
		printf '%s=%s\n' "${chave}" "${valor}" >> "${ARQ_AMBIENTE}"
	fi
}

reiniciar_e_conferir() {
	info "Reiniciando os dois processos que leem o arquivo de ambiente"
	# A API PRIMEIRO: ela é quem atende o cliente. Se a variável nova estiver
	# malformada, a partida é recusada (falha fechada, deliberada) e descobrimos
	# antes de mexer no worker.
	systemctl restart sysloc-api || falha "sysloc-api NÃO subiu. Rode: journalctl -u sysloc-api -n 40"
	local i=0
	while [ "${i}" -lt 60 ]; do
		[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3000/v1/sessao)" = "401" ] && break
		i=$((i + 1)); sleep 0.5
	done
	[ "${i}" -lt 60 ] || falha "sysloc-api reiniciou mas não atendeu em 30s."
	ok "sysloc-api de pé e atendendo."

	systemctl restart sysloc-worker || falha "sysloc-worker NÃO subiu. Rode: journalctl -u sysloc-worker -n 40"
	sleep 2
	[ "$(systemctl is-active sysloc-worker)" = "active" ] \
		&& ok "sysloc-worker ativo." \
		|| falha "sysloc-worker não ficou ativo."
}

# ---------------------------------------------------------------------------
# Desfazimento: volta ao capturador local. Existe porque a troca do destino do
# e-mail é a mudança mais perigosa desta virada — depois dela, uma mensagem
# entregue alcança a caixa de uma pessoa real, e isso não tem volta.
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--desfazer" ]; then
	info "Voltando o destino do e-mail ao capturador local (mailpit)"
	cp -a "${ARQ_AMBIENTE}" "${ARQ_AMBIENTE}.antes-do-desfazimento-${CARIMBO}"
	definir_chave SMTP_URL "smtp://127.0.0.1:1025"
	definir_chave EMAIL_REMETENTE "avisos@sysloc.invalid"
	reiniciar_e_conferir
	ok "Destino do e-mail de volta ao capturador. Nenhuma mensagem alcança pessoa real."
	exit 0
fi

# ===========================================================================
# GUARDAS
# ===========================================================================
info "Guardas de pré-condição"
[ -n "${BREVO_LOGIN:-}" ]      || falha "Defina BREVO_LOGIN (o login SMTP que o Brevo mostra em SMTP & API)."
[ -n "${BREVO_CHAVE_SMTP:-}" ] || falha "Defina BREVO_CHAVE_SMTP (a chave SMTP, não a chave de API v3)."
ok "Credenciais recebidas pelo ambiente (não por argumento)."

[ -n "${NODE_DA_PRODUCAO}" ] && [ -x "${NODE_DA_PRODUCAO}" ] || falha \
	"Não consegui derivar o runtime do ExecStart de sysloc-api (obtido: '${NODE_DA_PRODUCAO:-vazio}').
       Confira com: systemctl show sysloc-api -p ExecStart --value"
ok "Runtime da produção: ${NODE_DA_PRODUCAO}"

# O relay precisa estar alcançável ANTES de a configuração mudar. Descobrir que
# a porta está fechada só quando o primeiro aviso falhar seria descobrir tarde.
ENDERECO_DO_RELAY="$(getent ahostsv4 "${HOSPEDEIRO_DO_RELAY}" | awk '{print $1; exit}')"
[ -n "${ENDERECO_DO_RELAY}" ] || falha "${HOSPEDEIRO_DO_RELAY} não resolve neste host."
if timeout 10 bash -c "exec 3<>/dev/tcp/${ENDERECO_DO_RELAY}/${PORTA_DO_RELAY}" 2>/dev/null; then
	ok "${HOSPEDEIRO_DO_RELAY}:${PORTA_DO_RELAY} alcançável (${ENDERECO_DO_RELAY})."
else
	falha "Não consigo abrir ${HOSPEDEIRO_DO_RELAY}:${PORTA_DO_RELAY}. Nada foi alterado."
fi

# A credencial viaja DENTRO de uma URL, onde `:`, `@`, `/`, `?` e `#` são
# delimitadores. Percent-encoding resolve, mas é preciso aplicá-lo — e é aqui,
# não na cabeça do operador.
LOGIN_CODIFICADO="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "${BREVO_LOGIN}")"
CHAVE_CODIFICADA="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "${BREVO_CHAVE_SMTP}")"
ok "Credenciais codificadas para transporte em URL."

# ===========================================================================
# PASSO 1 — gravar o destino real
# ===========================================================================
info "Passo 1: gravar o destino real no arquivo de ambiente"
cp -a "${ARQ_AMBIENTE}" "${ARQ_AMBIENTE}.antes-da-virada-${CARIMBO}" \
	&& chmod 600 "${ARQ_AMBIENTE}.antes-da-virada-${CARIMBO}" \
	&& ok "Cópia preservada em ${ARQ_AMBIENTE}.antes-da-virada-${CARIMBO}" \
	|| falha "Não consegui preservar o arquivo de ambiente."

definir_chave SMTP_URL "smtps://${LOGIN_CODIFICADO}:${CHAVE_CODIFICADA}@${HOSPEDEIRO_DO_RELAY}:${PORTA_DO_RELAY}"
definir_chave EMAIL_REMETENTE "${REMETENTE_NOVO}"
chmod 600 "${ARQ_AMBIENTE}"

# A conferência imprime a linha MASCARADA — nunca o valor.
ok "CRIADO: SMTP_URL = $(grep '^SMTP_URL=' "${ARQ_AMBIENTE}" | sed -E 's#(://[^:@]*:)[^@]*@#\1***CHAVE***@#')"
ok "CRIADO: $(grep '^EMAIL_REMETENTE=' "${ARQ_AMBIENTE}")"

# Cada chave, uma vez só — o provisionamento aborta se houver duas.
for chave in SMTP_URL EMAIL_REMETENTE; do
	QUANTAS="$(grep -c "^${chave}=" "${ARQ_AMBIENTE}")"
	[ "${QUANTAS}" -eq 1 ] || falha "${chave} aparece ${QUANTAS} vezes em ${ARQ_AMBIENTE}. Corrija à mão."
done
ok "Cada chave tem exatamente uma atribuição."

# ===========================================================================
# PASSO 2 — reiniciar
# ===========================================================================
reiniciar_e_conferir

# ===========================================================================
# PASSO 3 — prova de entrega real
# ===========================================================================
info "Passo 3: prova de entrega"
if [ -z "${DESTINO_DE_PROVA:-}" ]; then
	aviso "DESTINO_DE_PROVA não definido — o envio de prova foi PULADO."
	aviso "A configuração está gravada e os serviços subiram, mas NADA prova que o"
	aviso "relay aceita a credencial. Rode de novo com DESTINO_DE_PROVA='voce@exemplo.com'."
else
	# O envio de prova usa o MESMO adaptador da produção, pelo mesmo caminho:
	# um teste que falasse SMTP por conta própria provaria o relay, e não o
	# produto. Ele roda como script Node dentro da árvore, lendo a mesma variável.
	info "Enviando mensagem de prova para ${DESTINO_DE_PROVA} ..."
	# ---------------------------------------------------------------------
	# COMO A PROVA RODA — três decisões, cada uma por uma razão medida
	# ---------------------------------------------------------------------
	#
	# 1. COMO O DONO DA ÁRVORE, e com o PATH dos shims do mise. MEDIDO em
	#    2026-09-08: este host NÃO tem `node` no sistema — `/usr/bin/node` e
	#    `/usr/local/bin/node` não existem, e o `ExecStart` das unidades aponta
	#    para o binário do mise. Rodar como root daria `node: command not found`,
	#    e a prova seria lida como credencial recusada.
	#
	# 2. O SEGREDO ENTRA POR `stdin`. A ADR-0005 é literal: segredo trafega por
	#    entrada padrão ou arquivo 0600, **nunca** por `argv` (legível em
	#    /proc/PID/cmdline) nem por variável exportada (legível em
	#    /proc/PID/environ). `DESTINO` e `EMAIL_REMETENTE` vão por ambiente
	#    porque não são segredo.
	#
	# 3. O ADAPTADOR ENTRA POR CAMINHO ABSOLUTO do `dist/`. A resolução de
	#    dependência parte do MÓDULO importado, e não do diretório de trabalho —
	#    é isso que faz o `nodemailer`, que é dependência de `packages/regua`,
	#    ser encontrado. Foi aqui que a primeira versão falhou, com
	#    `ERR_MODULE_NOT_FOUND`.
	# ⚠️ DIRETÓRIO PRÓPRIO, e não um arquivo solto em /tmp — e a escrita vem ANTES
	# da troca de dono. MEDIDO em 2026-09-08: com `fs.protected_regular = 2` (o
	# padrão deste host) e `/tmp` sticky e gravável por todos (`drwxrwxrwt`), o
	# kernel impede **até o root** de abrir para escrita um arquivo cujo dono seja
	# outro. A versão anterior dava `chown` antes do `cat` e morria com
	# `Permission denied` — sendo root, o que engana quem lê a mensagem.
	#
	# As duas defesas são independentes: `mktemp -d` cria um diretório 700 de root,
	# onde a proteção não se aplica; e escrever antes de entregar o dono tornaria a
	# operação válida mesmo em /tmp. Qualquer uma sozinha resolve — juntas, fecham
	# a classe nos dois caminhos.
	DIR_DA_PROVA="$(mktemp -d /tmp/prova-de-envio-XXXXXX)"
	chmod 700 "${DIR_DA_PROVA}"
	ARQUIVO_DA_PROVA="${DIR_DA_PROVA}/prova.mjs"
	cat > "${ARQUIVO_DA_PROVA}" <<'MJS'
const { criarAdaptadorSmtp } = await import(process.env.MODULO_DO_ADAPTADOR);

const urlDoTransporte = await new Promise((resolver) => {
	let acumulado = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', (parte) => {
		acumulado += parte;
	});
	process.stdin.on('end', () => resolver(acumulado.trim()));
});

const email = criarAdaptadorSmtp({
	urlDoTransporte,
	remetente: process.env.EMAIL_REMETENTE,
});

await email.enviar(process.env.DESTINO, {
	assunto: '[Sysloc] Prova de entrega da virada F7',
	corpo:
		'Se voce recebeu esta mensagem, o relay de saida do Sysloc esta operante.\n' +
		'Ela foi enviada pelo adaptador de PRODUCAO, pelo mesmo caminho de um aviso de cobranca.',
});

console.log('ENTREGUE');
MJS

	# O dono muda DEPOIS de o conteúdo estar gravado: o `node` roda como o dono da
	# árvore e só precisa LER o arquivo — leitura não é alcançada pela proteção.
	chmod 600 "${ARQUIVO_DA_PROVA}"
	chown -R "${DONO_DA_ARVORE}" "${DIR_DA_PROVA}"

	SAIDA_DA_PROVA="$(grep '^SMTP_URL=' "${ARQ_AMBIENTE}" | cut -d= -f2- \
		| runuser -u "${DONO_DA_ARVORE}" -- \
			env HOME="${HOME_DO_DONO}" \
			    MODULO_DO_ADAPTADOR="${RAIZ}/packages/regua/dist/adaptador-smtp.js" \
			    EMAIL_REMETENTE="${REMETENTE_NOVO}" \
			    DESTINO="${DESTINO_DE_PROVA}" \
			"${NODE_DA_PRODUCAO}" "${ARQUIVO_DA_PROVA}" 2>&1)"
	rm -rf "${DIR_DA_PROVA}"

	if printf '%s' "${SAIDA_DA_PROVA}" | grep -q 'ENTREGUE'; then
		ok "Mensagem de prova ACEITA pelo relay. Confira a caixa de ${DESTINO_DE_PROVA}."
	else
		# A saída é mascarada: a exceção do transporte pode citar a URL.
		printf '\033[1;31m[FALHA]\033[0m O envio de prova NÃO foi aceito:\n%s\n' \
			"$(printf '%s' "${SAIDA_DA_PROVA}" | sed -E 's#(://[^:@]*:)[^@]*@#\1***CHAVE***@#')"
		aviso "A configuração ficou gravada. Para voltar ao capturador: sudo bash $0 --desfazer"
		exit 1
	fi
fi

echo
ok "E-MAIL REAL LIGADO."
aviso "A partir de agora, mensagem entregue alcança a caixa de uma pessoa real — e isso não tem volta."
aviso "Desfazimento (volta ao capturador local): sudo bash $0 --desfazer"
