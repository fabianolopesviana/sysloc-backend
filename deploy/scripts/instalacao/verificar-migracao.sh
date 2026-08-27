#!/usr/bin/env bash
#
# Verificação da migração aplicada ao cluster real — T5 da fatia
# `fundacao-multitenancy-identidade`.
#
# Casos cobertos: CT-031, CT-032.
#
# O que este script prova, em uma frase por caso:
#
#   CT-031  no cluster real, toda tabela do schema de negócio tem RLS habilitada
#           E forçada, tem a coluna de empresa e a unicidade composta, pertence
#           ao papel de MIGRAÇÃO, e o papel da aplicação tem sobre ela os quatro
#           verbos de manipulação de dado e NADA além;
#   CT-032  `migrar-banco.sh` executado duas vezes seguidas sai 0 nas duas, a
#           segunda não altera nada, e em nenhuma delas a credencial do papel de
#           migração aparece no `argv` de processo filho, na saída ou na árvore
#           versionada.
#
# ---------------------------------------------------------------------------
# Por que este verificador existe ao lado da suíte automatizada
# ---------------------------------------------------------------------------
#
# A suíte de `packages/db` cobre a mesma classe de invariante contra uma
# instância EFÊMERA, subida por `embedded-postgres` em versão beta. A duplicação
# é deliberada e está registrada na §20 da tech spec: comportamento de uma versão
# beta pode divergir do cluster real, e a propriedade que interessa — o
# isolamento onde a operação acontece — só é observável aqui. Além disso, três
# coisas simplesmente não existem na instância efêmera: a PROPRIEDADE das tabelas
# no cluster provisionado, o script de migração de operação, e a árvore
# versionada em que uma credencial poderia vazar.
#
# ---------------------------------------------------------------------------
# Uma implementação, dois consumidores
# ---------------------------------------------------------------------------
#
# A consulta de cobertura NÃO é reescrita aqui. Ela é `verificarCoberturaDeIsolamento`,
# de `packages/db/src/catalogo.ts`, invocada pelo ponto de entrada público do
# pacote; este script traduz o que ela devolve em código de saída e linhas de
# diagnóstico. A alternativa — reimplementar a consulta em SQL dentro do
# verificador — é o antipadrão que a F0 pagou caro e que
# `.claude/rules/testing-stack.md` registra: um verificador que reimplementava o
# leitor aprovou 5/5 um alvo com o defeito de volta.
#
# Pelo mesmo motivo, a preparação do banco descartável é feita com a função
# `sql_preparar_banco_para_migracao` EXTRAÍDA de `provisionar-base.sh`: o mutante
# só prova alguma coisa se o banco em que ele vive for montado do mesmo jeito que
# o banco da operação.
#
# ---------------------------------------------------------------------------
# ADR-0006 — a bateria e o ambiente de operação
# ---------------------------------------------------------------------------
#
# ESTA BATERIA ALTERA O SISTEMA REAL: ela cria e remove um banco descartável no
# cluster e executa o script de migração contra ele. Por isso
# `recusar_bateria_em_producao` é consultada ANTES do primeiro caso, com o mesmo
# mecanismo e a mesma justificativa de `verificar-provisionamento.sh` — marcador
# no sistema de arquivos, porque o sujeito do guarda é a INSTALAÇÃO e não a
# invocação.
#
# O banco descartável é criado e removido pelo próprio caso, e o `trap` o remove
# também quando a bateria morre no meio. O banco da operação é apenas LIDO.
#
# A guarda não é só declarada: o bloco (j) do CT-032 exercita o predicado nos dois
# lados, afirma a posição da chamada no `main` e — o que importa — mede, num
# processo NOVO, que a recusa TERMINA o processo. Guarda sem essa última asserção
# passa verde com `exit 1` trocado por `return 0`.
#
# ---------------------------------------------------------------------------
# Subcomando
# ---------------------------------------------------------------------------
#
#   sudo bash verificar-migracao.sh cobertura <banco>
#
# Roda SÓ a guarda de cobertura contra o banco indicado, imprime uma linha
# `EXAMINADA <tabela>` por tabela alcançada e uma linha `EXCECAO <tabela>
# <motivo>` por tabela sem isolamento, e sai 0 quando não há exceção. É o que o
# CT-031 executa contra o banco descartável com o mutante — o SUT é este mesmo
# arquivo, num processo novo, e não uma cópia da lógica dentro do caso.
#
# Uso:
#   sudo bash deploy/scripts/instalacao/verificar-migracao.sh
#   sudo bash deploy/scripts/instalacao/verificar-migracao.sh cobertura sysloc
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO
readonly SCRIPT_PROVISIONAR="${RAIZ_REPO}/deploy/scripts/instalacao/provisionar-base.sh"
readonly SCRIPT_MIGRAR="${RAIZ_REPO}/deploy/scripts/instalacao/migrar-banco.sh"
readonly SCRIPT_VERIFICAR_PROVISIONAMENTO="${RAIZ_REPO}/deploy/scripts/instalacao/verificar-provisionamento.sh"

# --------------------------------------------------------------------------- #
# Constantes espelhadas de `provisionar-base.sh`, de `migrar-banco.sh` e da
# bateria irmã `verificar-provisionamento.sh`.
#
# Espelhar valor é cópia, e cópia diverge em silêncio. A rede contra isso é o
# bloco (i) do CT-032: para CADA constante abaixo há, em `ESPELHOS_DE_CONSTANTE`,
# a linha LITERAL que a declara no arquivo de origem, e o caso afirma que essa
# linha continua existindo lá. Trocar um valor na origem sem trocá-lo aqui
# reprova a bateria — que é a única forma de o espelhamento não envelhecer.
# --------------------------------------------------------------------------- #
readonly PAPEL_DB="sysloc_app"
readonly PAPEL_MIGRACAO="sysloc_migracao"
readonly BANCO_DB="sysloc"
readonly BANCO_VERIFICACAO="sysloc_verificacao"
readonly SCHEMA_IDENTIDADE="identidade"
readonly SCHEMA_NEGOCIO="negocio"
# O terceiro schema, da ADR-0031, acrescentado pela T4 da fatia
# `fundacao-bancaria`. Ele entra no retrato do catálogo e nas asserções de
# privilégio, e NÃO na lista de tabelas: o roster de tabelas dele é vazio, e os
# objetos que a `0016` cria lá são uma sequência e uma função.
readonly SCHEMA_PLATAFORMA="plataforma"
readonly ARQ_AMBIENTE_MIGRACAO="/etc/sysloc/migracao.env"
readonly ARQ_MARCADOR_PRODUCAO="/etc/sysloc/producao"

# Onde `migrar-banco.sh` registra o que já aplicou. Ela mora em `identidade` e
# NÃO é dado de aplicação: o script retira o alcance do papel que atende
# requisição DENTRO da transação que aplica cada arquivo, porque a concessão
# `ON ALL TABLES IN SCHEMA identidade` de `0001_seguranca.sql` a alcança.
#
# Três blocos do CT-031 cercam essa propriedade, e cada um cobre o que o anterior
# não alcança: o (d) afirma o resultado no banco da operação, o (h) prova que a
# afirmação sabe acusar o contrário, e o (i) mede o estado deixado por uma
# execução ABORTADA — que é onde a retirada, enquanto foi só a última instrução de
# `main`, não acontecia.
readonly TABELA_REGISTRO="${SCHEMA_IDENTIDADE}.migracao_aplicada"

# Cada entrada é `<arquivo de origem>|<linha literal que declara a constante lá>`.
#
# A entrada de `TABELA_REGISTRO` guarda a linha da origem COMO ELA É ESCRITA —
# com a referência a `${SCHEMA_IDENTIDADE}` por expandir. Não é descuido: o valor
# do schema já é conferido pela entrada de `SCHEMA_IDENTIDADE`, e exigir a linha
# na forma literal é o que detecta alguém trocar a composição lá (por um nome
# fixo, por outro schema) sem tocar nesta bateria.
readonly -a ESPELHOS_DE_CONSTANTE=(
	"${SCRIPT_PROVISIONAR}|readonly PAPEL_DB=\"${PAPEL_DB}\""
	"${SCRIPT_PROVISIONAR}|readonly PAPEL_MIGRACAO=\"${PAPEL_MIGRACAO}\""
	"${SCRIPT_PROVISIONAR}|readonly BANCO_DB=\"${BANCO_DB}\""
	"${SCRIPT_PROVISIONAR}|readonly BANCO_VERIFICACAO=\"${BANCO_VERIFICACAO}\""
	"${SCRIPT_PROVISIONAR}|readonly SCHEMA_IDENTIDADE=\"${SCHEMA_IDENTIDADE}\""
	"${SCRIPT_PROVISIONAR}|readonly SCHEMA_NEGOCIO=\"${SCHEMA_NEGOCIO}\""
	"${SCRIPT_PROVISIONAR}|readonly SCHEMA_PLATAFORMA=\"${SCHEMA_PLATAFORMA}\""
	"${SCRIPT_PROVISIONAR}|readonly ARQ_AMBIENTE_MIGRACAO=\"${ARQ_AMBIENTE_MIGRACAO}\""
	"${SCRIPT_MIGRAR}|readonly PAPEL_DB=\"${PAPEL_DB}\""
	"${SCRIPT_MIGRAR}|readonly PAPEL_MIGRACAO=\"${PAPEL_MIGRACAO}\""
	"${SCRIPT_MIGRAR}|readonly SCHEMA_IDENTIDADE=\"${SCHEMA_IDENTIDADE}\""
	"${SCRIPT_MIGRAR}|readonly SCHEMA_NEGOCIO=\"${SCHEMA_NEGOCIO}\""
	"${SCRIPT_MIGRAR}|readonly SCHEMA_PLATAFORMA=\"${SCHEMA_PLATAFORMA}\""
	"${SCRIPT_MIGRAR}|readonly ARQ_AMBIENTE_MIGRACAO=\"${ARQ_AMBIENTE_MIGRACAO}\""
	"${SCRIPT_MIGRAR}|readonly TABELA_REGISTRO=\"\${SCHEMA_IDENTIDADE}.migracao_aplicada\""
	"${SCRIPT_VERIFICAR_PROVISIONAMENTO}|readonly ARQ_MARCADOR_PRODUCAO=\"${ARQ_MARCADOR_PRODUCAO}\""
)

readonly DIR_MIGRACOES="${RAIZ_REPO}/packages/db/migracoes"
readonly MANIFESTO_DB="${RAIZ_REPO}/packages/db/package.json"
# O ponto de entrada publicado por `@sysloc/db`. Ele é conferido contra o campo
# `exports["."].default` do manifesto na asserção (a) do CT-031: apontar para um
# arquivo que o manifesto não publica faria a bateria exercitar código que nenhum
# consumidor real carrega.
readonly ENTRADA_PUBLICA_DB="./dist/index.js"
readonly CAMINHO_ENTRADA_DB="${RAIZ_REPO}/packages/db/dist/index.js"

# As tabelas que as fatias criam em `negocio`. Escrever os nomes AQUI é
# legítimo e é o oposto do que `catalogo.ts` proíbe: lá a lista substituiria a
# consulta ao catálogo (e a tabela nova nasceria invisível); aqui ela é o valor
# ESPERADO contra o qual o resultado da consulta é comparado. Sem ele, uma
# consulta que não alcançasse tabela nenhuma devolveria zero exceções e "nada
# violou" seria indistinguível de "nada foi olhado".
#
# ELA É UM FIO DE TROPEÇO, E O TROPEÇO É DE PROPÓSITO — o que exige anunciar a
# obrigação aqui, e não só justificar a lista:
#
#   QUANDO ATUALIZAR: a fatia que acrescentar tabela em `${SCHEMA_NEGOCIO}`
#   atualiza esta lista NO MESMO COMMIT da migração que cria a tabela.
#   POR QUE NÃO SE AUTOMATIZA: derivar a lista do catálogo faria o valor esperado
#   vir da mesma fonte que o obtido, e a asserção (b) do CT-031 deixaria de poder
#   falhar — é exatamente o defeito que ela existe para não cometer.
#   COMO A FALHA APARECE: a asserção "(b) as tabelas de negócio examinadas são
#   exatamente as da fatia" reprova nomeando a diferença; é ruidosa e
#   autoexplicativa, não silenciosa.
#
#   ATUALIZADA EM 2026-08-05 pela T2 da fatia `cadastro-de-imoveis-e-pessoas`,
#   no mesmo commit da migração `0005_dominio_locacao.sql`, que acrescenta as
#   seis entidades do domínio de locação — o tropeço funcionou como previsto.
#   ATUALIZADA EM 2026-08-09 pela T3 da fatia `contratos-de-locacao`, no mesmo
#   commit da migração `0007_dominio_contrato.sql`, que acrescenta o contrato e o
#   vínculo de fiador — o tropeço funcionou de novo, e a suíte de `@sysloc/db`
#   (CT-300, CT-301, CT-421) reprovou pela mesma razão, no mesmo instante.
#   ATUALIZADA EM 2026-08-10 pela T3 da fatia `cobranca-e-mora`, no mesmo commit
#   das migrações `0009_dominio_cobranca.sql` e `0010_seguranca_cobranca.sql`,
#   que acrescentam a cobrança, a configuração de mora e a VISÃO derivada.
#   ATUALIZADA EM 2026-08-11 pela T3 da fatia `regua-de-cobranca`, no mesmo commit
#   das migrações `0011_dominio_regua.sql` e `0012_seguranca_regua.sql`, que
#   acrescentam a política de aviso e o registro de envios.
#   ATUALIZADA EM 2026-08-13 pela T3 da fatia `documentos-e-confirmacao`, no mesmo
#   commit das migrações `0013_dominio_documentos_e_confirmacao.sql` e
#   `0014_seguranca_confirmacao.sql`, que acrescentam o portador da confirmação de
#   endereço. A mesma `0013` REMOVE a coluna `contrato.pdf_contrato_arquivo`
#   (ADR-0030), e isso não move esta lista: ela enumera OBJETOS, nunca colunas.
#   ATUALIZADA EM 2026-08-14 pela T4 da fatia `fundacao-bancaria`, no mesmo commit
#   das migrações `0015_dominio_bancario.sql` e `0016_seguranca_bancaria.sql`, que
#   acrescentam o certificado do provedor. ATUALIZADA EM 2026-08-16 pela T2 da
#   fatia `emissao-e-conciliacao`, no mesmo commit das migrações
#   `0017_dominio_emissao_e_conciliacao.sql` e
#   `0018_seguranca_emissao_e_conciliacao.sql`, que acrescentam as QUATRO tabelas
#   da emissão e da conciliação — todas em '${SCHEMA_NEGOCIO}', porque têm
#   dono-empresa (ADR-0031, pela contrapositiva).
#
#   OS OBJETOS DE '${SCHEMA_PLATAFORMA}' NÃO ENTRAM AQUI, e a ausência é a decisão,
#   por duas razões que se somam: esta lista é comparada com o que a guarda de
#   cobertura devolve, e a guarda examina '${SCHEMA_NEGOCIO}'; e nenhum dos dois
#   objetos que a `0016` cria lá é tabela — são uma sequência e uma função. O
#   roster de TABELAS daquele schema é vazio nesta fatia, e o vazio é o conteúdo
#   (ADR-0031). Acrescentar qualquer um deles faria a asserção (b) reprovar um
#   schema íntegro, exatamente como acrescentar a sequência do contador faria.
#   Esta lista é a MESMA
#   `TABELAS_DE_NEGOCIO_ESPERADAS` que `packages/db/test/papel-de-conexao.spec.ts`
#   declara — as duas frentes de teste (shell e Vitest) a mantêm em paralelo, e o
#   cabeçalho de `packages/db/src/esquema/negocio.ts` nomeia as duas. Esquecer uma
#   delas faz a outra reprovar sozinha, que é a rede funcionando.
#
#   A VISÃO ENTRA AQUI, e a sequência continua fora — a distinção não é
#   arbitrária, é a espécie: `negocio.cobranca_derivada` é `relkind = 'v'`, que a
#   guarda EXAMINA por um critério próprio (`security_invoker = true`, ADR-0023) e
#   devolve entre as examinadas; a sequência do contador é `relkind = 'S'`, que a
#   guarda exclui por construção e nunca devolve. Omitir a visão faria a asserção
#   (b) reprovar um schema íntegro, exatamente como acrescentar a sequência faria.
#
#   A SEQUÊNCIA DO CONTADOR NÃO ENTRA AQUI, e a ausência é a decisão: a migração
#   `0008_seguranca_contrato.sql` traz para `${SCHEMA_NEGOCIO}` um objeto de
#   espécie nova — a sequência do escopo `(empresa, ano)`, criada em tempo de
#   execução pelas funções `SECURITY DEFINER` (ADR-0020). A guarda de cobertura
#   exclui `relkind = 'S'` do exame POR CONSTRUÇÃO, então ela nunca aparece no
#   resultado que esta lista compara. Acrescentá-la faria a asserção (b) reprovar
#   um schema íntegro.
readonly TABELAS_DE_NEGOCIO_ESPERADAS="negocio.acesso_usuario_app negocio.acesso_usuario_permissao negocio.certificado_do_provedor negocio.cobranca negocio.cobranca_derivada negocio.comodo negocio.conferencia_bancaria negocio.configuracao_de_mora negocio.conjunto negocio.contrato negocio.contrato_fiador negocio.emissao_em_lote negocio.entrega_da_noticia negocio.envio_de_cobranca negocio.evento_bancario negocio.execucao_de_rotina negocio.fiador negocio.identidade_no_provedor negocio.imovel negocio.item_da_emissao_em_lote negocio.locador negocio.locatario negocio.politica_de_aviso negocio.portador_de_confirmacao"

# Os quatro transportes de segredo que a ADR-0005 proíbe. O `[=]` é classe de
# caractere de UM elemento — casa exatamente o que o sinal solto casaria, sem
# perder poder de detecção — e existe para quebrar a AUTO-REFERÊNCIA: escrito
# solto, o texto deste padrão seria ele próprio uma instância do padrão, e a
# auditoria de `deploy/scripts/**/*.sh` exigida por `.claude/rules/testing-stack.md`
# nunca fecharia no repositório. Mesma forma já adotada em
# `verificar-provisionamento.sh` e em `verificar-apuracao-versao.sh`.
readonly -a PADROES_PROIBIDOS=(
	'set[[:space:]]+-x'
	'--password[= ]'
	'--dbpassword[= ]'
	'PGPASSWORD[=]'
)
readonly -a ROTULOS_PROIBIDOS=(
	'rastreio verboso de comandos do shell'
	'segredo em --password'
	'segredo em --dbpassword'
	'segredo em variável de ambiente'
)

# Piso de plausibilidade para a prova dinâmica de `argv`. Uma execução completa
# da migração dispara dezenas de `execve` (o cliente do banco por arquivo, mais
# as consultas de registro); uma que aborta no primeiro guarda dispara menos de
# uma dezena. O piso separa as duas situações sem depender do número exato.
readonly MINIMO_EXECVE=10

DIR_TEMPORARIO=""
BANCO_DESCARTAVEL_CRIADO=""

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# --------------------------------------------------------------------------- #
# Limpeza — armada ANTES de criar o banco descartável.
# --------------------------------------------------------------------------- #
limpar() {
	local codigo=$?

	if [[ -n "${BANCO_DESCARTAVEL_CRIADO}" ]]; then
		remover_banco_descartavel "${BANCO_DESCARTAVEL_CRIADO}" || true
		BANCO_DESCARTAVEL_CRIADO=""
	fi

	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi

	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Sem estes, um
# Ctrl-C no meio do CT-032 deixaria o banco descartável de pé no cluster e o
# diretório com o arquivo de senha em disco.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# --------------------------------------------------------------------------- #
# Acesso administrativo ao cluster. Só LEITURA no banco da operação; a escrita
# acontece exclusivamente no banco descartável.
# --------------------------------------------------------------------------- #
psql_admin() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -c "$1"
}

psql_admin_no_banco() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -d "$1" -c "$2"
}

psql_admin_entrada_no_banco() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -d "$1" -f -
}

exigir_privilegio() {
	if [[ "${EUID}" -ne 0 ]]; then
		printf 'ERRO: esta bateria precisa de privilégio administrativo — ela lê %s, consulta o cluster como o superusuário da instância e cria um banco descartável.\n' \
			"${ARQ_AMBIENTE_MIGRACAO}" >&2
		printf '      Execute como: sudo bash deploy/scripts/instalacao/verificar-migracao.sh\n' >&2
		exit 1
	fi
}

# --------------------------------------------------------------------------- #
# ADR-0006 — recusa de executar contra a instalação que atende a operação.
#
# Mesmo mecanismo e mesma justificativa de `verificar-provisionamento.sh`:
# marcador no sistema de arquivos, porque o sujeito do guarda é a INSTALAÇÃO e
# não a invocação. Aqui o que se recusa é criar banco no cluster e executar o
# script de migração — contra uma instalação em produção isso é operação, não
# verificação.
#
# Recebe o caminho por parâmetro para ser exercitável sem privilégio.
# --------------------------------------------------------------------------- #
instalacao_liberada_para_bateria() {
	[[ ! -e "$1" ]]
}

recusar_bateria_em_producao() {
	instalacao_liberada_para_bateria "${ARQ_MARCADOR_PRODUCAO}" && return 0

	printf 'ERRO: esta instalação está marcada como a que atende a operação (%s existe).\n' \
		"${ARQ_MARCADOR_PRODUCAO}" >&2
	printf '      A ADR-0006 é literal: "a suíte de verificação nunca executa contra o ambiente\n' >&2
	printf '      que atende a operação". Esta bateria CRIA e REMOVE um banco no cluster e EXECUTA\n' >&2
	printf '      o script de migração; contra uma instalação em produção isso é operação, não\n' >&2
	printf '      verificação.\n' >&2
	printf '      O QUE FAZER: reconstrua a instalação num ambiente separado a partir deste\n' >&2
	printf '      repositório — `provisionar-base.sh` e `migrar-banco.sh` são idempotentes e\n' >&2
	printf '      reconstrutíveis por desenho — e rode a bateria lá.\n' >&2
	exit 1
}

# --------------------------------------------------------------------------- #
# Credencial de migração e a cadeia de conexão derivada dela.
#
# A credencial sai por stdout do subshell e é capturada numa variável local pelo
# chamador — nunca é impressa, nunca vai para argumento de comando. A leitura
# repete as três propriedades do leitor de `migrar-banco.sh` (recusa de
# atribuição repetida, captura gulosa até o último '@', validação de alfabeto em
# passo separado); ela existe aqui porque a bateria precisa da MESMA agulha para
# procurar vazamento, e uma agulha truncada enfraqueceria as varreduras.
# --------------------------------------------------------------------------- #
ler_credencial_de_migracao() {
	local arquivo="$1"

	[[ -f "${arquivo}" ]] || return 1

	if printf '%s\n' "$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d)" | grep -q .; then
		return 1
	fi

	local valor
	valor="$(sed -n 's|^MIGRATION_DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}" 2>/dev/null)"
	if [[ ! "${valor}" =~ ^[A-Za-z0-9]+$ ]]; then
		return 1
	fi
	printf '%s' "${valor}"
}

# O destino declarado pela cadeia — `HOSPEDEIRO:PORTA/BANCO`. Não carrega
# credencial, e por isso pode aparecer em mensagem.
ler_destino_de_migracao() {
	sed -n 's|^MIGRATION_DATABASE_URL=postgresql://.*@\(.*\)$|\1|p' "$1"
}

# Monta a cadeia de conexão do migrador para o banco indicado. O segredo entra
# como parâmetro posicional de uma função do próprio shell — sem `exec`, sem
# linha de comando nova para `ps` mostrar e sem exportar nada.
#
# $1 = credencial · $2 = destino (HOSPEDEIRO:PORTA/BANCO) · $3 = banco alvo
montar_cadeia_de_migracao() {
	local destino="$2"
	printf 'postgresql://%s:%s@%s:%s/%s' \
		"${PAPEL_MIGRACAO}" "$1" "${destino%%:*}" "$(porta_do_destino "${destino}")" "$3"
}

porta_do_destino() {
	local resto="${1#*:}"
	printf '%s' "${resto%%/*}"
}

# --------------------------------------------------------------------------- #
# A guarda de cobertura, invocada pelo ponto de entrada público de `@sysloc/db`.
#
# O runtime não está no PATH sob `sudo` (ele vive no diretório pessoal do usuário
# de trabalho, pelo gerenciador de versões), daí a busca em dois passos — a mesma
# de `verificar-provisionamento.sh`.
# --------------------------------------------------------------------------- #
localizar_runtime_node() {
	local caminho
	if caminho="$(command -v node 2>/dev/null)"; then
		printf '%s' "${caminho}"
		return 0
	fi

	local versao dono lar
	versao="$(sed -n 's|^node = "\(.*\)"$|\1|p' "${RAIZ_REPO}/.mise.toml" 2>/dev/null | head -1)"
	dono="$(stat -c '%U' "${RAIZ_REPO}" 2>/dev/null || true)"
	lar="$(getent passwd "${dono}" 2>/dev/null | cut -d: -f6)"
	[[ -n "${versao}" && -n "${lar}" ]] || return 1

	caminho="${lar}/.local/share/mise/installs/node/${versao}/bin/node"
	[[ -x "${caminho}" ]] || return 1
	printf '%s' "${caminho}"
}

# Lê a cadeia de conexão da ENTRADA PADRÃO — nunca do `argv`, que é visível em
# `ps` para qualquer usuário desta máquina — e imprime o resultado da guarda em
# linhas estáveis. Sai 0 sem exceção, 1 com exceção.
executar_guarda_de_cobertura() {
	local runtime="$1"
	"${runtime}" --input-type=module -e "
		import { verificarCoberturaDeIsolamento } from 'file://${CAMINHO_ENTRADA_DB}';
		let entrada = '';
		for await (const parte of process.stdin) entrada += parte;
		let apurado = null;
		try {
			apurado = await verificarCoberturaDeIsolamento(entrada.trim());
		} catch (erro) {
			// Falha de APURAÇÃO sai com 2, nunca com 1. Deixar a exceção subir daria
			// código 1 — o mesmo que 'apurei e achei exceção' —, e 'não consegui olhar'
			// passaria a ser indistinguível de 'olhei e o isolamento está furado'.
			process.stderr.write('ERRO: a guarda de cobertura não pôde apurar: ' + (erro && erro.message) + '\n');
			process.exitCode = 2;
		}
		if (apurado !== null) {
			for (const tabela of apurado.tabelasExaminadas) {
				process.stdout.write('EXAMINADA ' + tabela + '\n');
			}
			for (const excecao of apurado.excecoes) {
				process.stdout.write('EXCECAO ' + excecao.tabela + ' ' + excecao.motivo + '\n');
			}
			// \`process.exitCode\`, e não \`process.exit()\`: a saída vai para um cano, a escrita
			// nele é assíncrona, e encerrar o processo à força truncaria justamente as linhas
			// que o caso vai afirmar. A guarda já encerra a reserva de conexão por dentro,
			// então o laço de eventos drena sozinho.
			process.exitCode = apurado.excecoes.length === 0 ? 0 : 1;
		}
	"
}

# Subcomando `cobertura <banco>`.
#
# Códigos de saída: 0 sem exceção · 1 com exceção · 2 não foi possível apurar.
# O 2 é distinto de propósito: "não consegui olhar" jamais pode ser confundido
# com "olhei e está tudo certo".
subcomando_cobertura() {
	local banco="$1"

	local runtime
	if ! runtime="$(localizar_runtime_node)"; then
		printf 'ERRO: runtime Node não encontrado — a guarda de cobertura vive em @sysloc/db e precisa dele.\n' >&2
		exit 2
	fi
	if [[ ! -f "${CAMINHO_ENTRADA_DB}" ]]; then
		printf 'ERRO: %s não existe — execute "pnpm build" antes desta bateria.\n' "${CAMINHO_ENTRADA_DB}" >&2
		exit 2
	fi

	local credencial destino
	if ! credencial="$(ler_credencial_de_migracao "${ARQ_AMBIENTE_MIGRACAO}")"; then
		printf 'ERRO: não foi possível ler uma credencial íntegra de %s.\n' "${ARQ_AMBIENTE_MIGRACAO}" >&2
		exit 2
	fi
	destino="$(ler_destino_de_migracao "${ARQ_AMBIENTE_MIGRACAO}")"

	local codigo=0
	printf '%s' "$(montar_cadeia_de_migracao "${credencial}" "${destino}" "${banco}")" |
		executar_guarda_de_cobertura "${runtime}" || codigo=$?
	exit "${codigo}"
}

# --------------------------------------------------------------------------- #
# Banco descartável — criado e removido pelo próprio caso, JAMAIS o da operação.
#
# A criação espelha o P08 do provisionamento (dono, retirada de PUBLIC) e a
# preparação usa a função REAL extraída de `provisionar-base.sh`: o mutante só
# prova alguma coisa se o banco em que ele vive for montado como o da operação.
# --------------------------------------------------------------------------- #
carregar_preparacao_do_provisionador() {
	local trecho
	trecho="$(sed -n '/^sql_preparar_banco_para_migracao() {/,/^}/p' "${SCRIPT_PROVISIONAR}")"
	[[ -n "${trecho}" ]] || return 1
	eval "${trecho}"
	[[ "$(type -t sql_preparar_banco_para_migracao)" == "function" ]] || return 1
}

criar_banco_descartavel() {
	local banco="$1"

	# O `IF EXISTS` cobre o resíduo de uma execução anterior interrompida por
	# sinal antes do trap alcançar o cluster.
	psql_admin "DROP DATABASE IF EXISTS \"${banco}\" WITH (FORCE)" >/dev/null
	psql_admin "CREATE DATABASE \"${banco}\" OWNER \"${PAPEL_DB}\"" >/dev/null
	BANCO_DESCARTAVEL_CRIADO="${banco}"
	psql_admin "REVOKE ALL ON DATABASE \"${banco}\" FROM PUBLIC" >/dev/null
	psql_admin "GRANT ALL ON DATABASE \"${banco}\" TO \"${PAPEL_DB}\"" >/dev/null

	sql_preparar_banco_para_migracao "${banco}" | psql_admin_entrada_no_banco "${banco}" >/dev/null
}

# A remoção tolera falha de propósito: ela é chamada tanto no caminho normal
# quanto pelo `trap`, e abortar a bateria porque a limpeza não deu certo trocaria
# um resíduo por um diagnóstico perdido. O resíduo, se houver, é removido pelo
# `DROP ... IF EXISTS` que abre a próxima criação.
remover_banco_descartavel() {
	local banco="$1"
	[[ -n "${banco}" ]] || return 0
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t \
		-c "DROP DATABASE IF EXISTS \"${banco}\" WITH (FORCE)" >/dev/null 2>&1 || true
	BANCO_DESCARTAVEL_CRIADO=""
}

# Retrato determinístico do que a migração produziu num banco. Só nomes — nenhum
# identificador interno, nenhum instante —, para que a comparação entre a 1ª e a
# 2ª execução acuse mudança de estado e nunca ruído.
instantaneo_do_catalogo() {
	local banco="$1"
	# Todo valor não textual entra com `::text` explícito. Sem o cast, `text ||
	# c.relkind` é AMBÍGUO — `relkind` é `"char"`, e o PostgreSQL recusa a consulta
	# inteira com "operator is not unique". A consulta abortada devolveria retrato
	# PARCIAL, e dois retratos parciais também são idênticos entre si: a asserção
	# de idempotência passaria sem ter olhado as relações. É por isso que o caso
	# afirma, além da igualdade, a presença de cada seção.
	psql_admin_no_banco "${banco}" "
		SELECT 'RELACAO ' || n.nspname || '.' || c.relname
			|| ' tipo=' || c.relkind::text
			|| ' dono=' || pg_get_userbyid(c.relowner)::text
			|| ' rls=' || c.relrowsecurity::text
			|| ' forcada=' || c.relforcerowsecurity::text
			|| ' acl=' || coalesce(c.relacl::text, '(padrao)')
		FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}', '${SCHEMA_PLATAFORMA}')
		ORDER BY 1"
	psql_admin_no_banco "${banco}" "
		SELECT 'COLUNA ' || table_schema || '.' || table_name || '.' || column_name
			|| ' ' || data_type || ' nulo=' || is_nullable
		FROM information_schema.columns
		WHERE table_schema IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}', '${SCHEMA_PLATAFORMA}')
		ORDER BY 1"
	psql_admin_no_banco "${banco}" "
		SELECT 'POLITICA ' || schemaname || '.' || tablename || '.' || policyname
			|| ' usando=' || coalesce(qual, '(nenhum)')
			|| ' checando=' || coalesce(with_check, '(nenhum)')
		FROM pg_policies
		WHERE schemaname IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}', '${SCHEMA_PLATAFORMA}')
		ORDER BY 1"
	psql_admin_no_banco "${banco}" "
		SELECT 'REGISTRO ' || arquivo || ' ' || soma_sha256
		FROM ${SCHEMA_IDENTIDADE}.migracao_aplicada
		ORDER BY 1"
}

# Quantos dos sete verbos de tabela o papel que atende requisição ainda tem sobre
# a tabela de registro de migrações. O esperado é ZERO, em qualquer banco.
#
# UMA função e não duas consultas: a asserção do banco da operação (CT-031 (d)) e
# o par de falsificação no banco descartável (CT-031 (h)) precisam exercitar o
# MESMO SQL, senão o par não prova nada sobre a asserção que importa — provaria
# sobre uma cópia dela.
#
# `has_table_privilege` é consultado por NOME qualificado, e não por OID: a
# tabela precisa existir para a pergunta fazer sentido, e uma tabela ausente faz a
# consulta ERRAR em vez de devolver zero em silêncio — que é o desfecho certo,
# porque "não existe" nunca pode passar por "existe e está sem privilégio".
verbos_concedidos_na_tabela_de_registro() {
	psql_admin_no_banco "$1" "
		SELECT count(*)
		FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS verbo
		WHERE has_table_privilege('${PAPEL_DB}', '${TABELA_REGISTRO}', verbo)"
}

# --------------------------------------------------------------------------- #
# Auditorias estáticas. Todas recebem o caminho por parâmetro para poderem ser
# apontadas a uma cópia com o defeito de volta — é assim que se prova que elas
# reprovam (`.claude/rules/testing-stack.md`, prova de falsificação).
# --------------------------------------------------------------------------- #

# $1 = arquivo · $2 = padrão. Só a CONTAGEM sai daqui.
contar_padrao_no_arquivo() {
	grep -cE -- "$2" "$1" 2>/dev/null || true
}

# $1 = arquivo · $2 = linha LITERAL e INTEIRA. `-x` e `-F` juntos de propósito: a
# conferência de constante espelhada precisa casar a declaração inteira, não um
# pedaço dela — sem `-x`, `readonly BANCO_DB="sysloc"` casaria dentro de
# `readonly BANCO_DB="sysloc_outro"` e a divergência passaria despercebida.
contar_linha_literal() {
	grep -cxF -- "$2" "$1" 2>/dev/null || true
}

# Cópia de `migrar-banco.sh` com UM defeito plantado: a função por onde passa
# TODA conexão do script deixa de transportar o segredo por `PGPASSFILE` e passa
# a entregar a cadeia inteira — credencial incluída — no `argv` do cliente.
#
# É a forma pela qual este script vazaria de verdade, e é o companheiro de
# falsificação da varredura dinâmica do CT-032 (f): sem ele, a asserção de
# ausência no rastreio nunca demonstrou saber acusar uma presença. O resto do
# arquivo sai idêntico ao original — um mutante que mudasse mais de uma coisa não
# provaria qual delas a varredura pegou.
substituir_psql_migrador_por_argv() {
	awk '
		/^psql_migrador\(\) \{$/ { dentro = 1; print "psql_migrador() {"; next }
		dentro && /^\}$/ {
			dentro = 0
			print "\tpsql -v ON_ERROR_STOP=1 -X -q -A -t -w \\"
			print "\t\t\"postgresql://${PAPEL_MIGRACAO}:${senha_migracao}@${hospedeiro_banco}:${porta_banco}/${banco_alvo}\" \"$@\""
			print "}"
			next
		}
		!dentro { print }
	' "$1"
}

# SEGUNDO mutante, e ele existe por um motivo preciso: o primeiro vaza por `argv`,
# que o strace registra COM OU SEM `-v`. Sem este, remover o `-v` da invocação
# deixaria TODAS as asserções verdes, e a metade "nem por variável exportada" do
# invariante — metade literal da ADR-0005 — perderia todo alcance dinâmico.
#
# Aqui o transporte proibido é o OUTRO: variável de ambiente EXPORTADA. O nome
# escolhido não casa nenhum dos quatro padrões de (a) DE PROPÓSITO — é o que
# torna este mutante invisível à auditoria estática e visível apenas ao rastreio
# com `-v`, que é exatamente a propriedade sob prova. O `PGPASSFILE` permanece
# para que a execução conclua: o sujeito da asserção é o rastreio, não o desfecho.
exportar_senha_em_variavel_de_ambiente() {
	awk '
		/^psql_migrador\(\) \{$/ { dentro = 1; print "psql_migrador() {"; next }
		dentro && /^\}$/ {
			dentro = 0
			print "\texport SYSLOC_SENHA_MIGRACAO=\"${senha_migracao}\""
			print "\tPGPASSFILE=\"${ARQ_PGPASS}\" psql -v ON_ERROR_STOP=1 -X -q -A -t -w \\"
			print "\t\t-h \"${hospedeiro_banco}\" -p \"${porta_banco}\" -U \"${PAPEL_MIGRACAO}\" -d \"${banco_alvo}\" \"$@\""
			print "}"
			next
		}
		!dentro { print }
	' "$1"
}

# Cópia de `migrar-banco.sh` que lê as migrações de OUTRO diretório. É o que
# permite ao CT-031 (i) interromper uma execução no meio sem tocar em
# `packages/db/migracoes/`: o diretório mutante recebe um `0002` que falha.
#
# Repontar esta ÚNICA constante basta, e não é sorte: `RAIZ_REPO` só é usada para
# compor `DIR_MIGRACOES`, de modo que a cópia fora da árvore não perde nada mais.
apontar_migracoes_para() {
	sed "s|^readonly DIR_MIGRACOES=.*\$|readonly DIR_MIGRACOES=\"$2\"|" "$1"
}

# Cópia com a retirada de privilégio DE VOLTA para fora da transação — isto é, o
# código anterior à correção do Gate 2. É o companheiro de falsificação do
# CT-031 (i): sem ele, a afirmação "após um aborto o livro-razão está sem
# privilégio" nunca teria demonstrado saber acusar o contrário.
#
# O `,+1` alcança a linha de continuação dos argumentos do `printf`. A asserção
# de que o mutante FOI plantado (contagem 1 -> 0) é o que impede um padrão que
# deixasse de casar de produzir duas cópias idênticas e um par que não prova nada.
remover_retirada_em_transacao() {
	sed "/printf 'REVOKE ALL ON TABLE %s FROM PUBLIC/,+1d" "$1"
}

# Cópia sem a retirada que acompanha a CRIAÇÃO da tabela de registro — o código
# anterior à correção do BAIXO-001. É o companheiro de falsificação de (h-bis).
#
# A linha é SUBSTITUÍDA em vez de removida porque ela carrega o fechamento da
# aspa e o `>/dev/null` do `psql_migrador -c`: apagá-la deixaria a cópia
# sintaticamente inválida, e uma cópia que nem roda não prova nada sobre
# privilégio. O que entra no lugar fecha o comando logo após o `;` do `CREATE`.
# A retirada DENTRO da transação de aplicação e a chamada ao fim de `main`
# ficam intactas de propósito — o sujeito aqui é este ponto de entrada, e um
# mutante que apagasse os três não diria qual deles a asserção pegou.
remover_retirada_na_criacao() {
	sed 's|^\t\tREVOKE ALL ON TABLE ${TABELA_REGISTRO} FROM PUBLIC.*$|\t\t" >/dev/null|' "$1"
}

# --------------------------------------------------------------------------- #
# Onde uma cópia EXECUTÁVEL de `migrar-banco.sh` tem de morar — e por quê
#
# CAUSA-RAIZ (achada na primeira execução desta bateria, 2026-08-02, em DOIS
# sítios): o script sob teste deriva a raiz do repositório do PRÓPRIO caminho
# (`migrar-banco.sh:72`, `dirname "${BASH_SOURCE[0]}"/../../..`) e é dali que
# monta `DIR_MIGRACOES`. Cópia escrita direto em `${DIR_TEMPORARIO}` calcula
# `RAIZ_REPO=/`, procura `//packages/db/migracoes`, não acha e ABORTA na
# conferência do diretório — antes de tocar no banco.
#
# O efeito é pior que a falha, e é o que fez o defeito sobreviver aos dois
# gates: em (h-bis) a asserção do aborto PASSAVA pelo motivo errado e deixava a
# seguinte inalcançável; em (f) do CT-032 as duas cópias com vazamento plantado
# abortavam antes de invocar o cliente, de modo que o rastreio não continha
# credencial nenhuma e a asserção que exige o vazamento não tinha como passar.
# Nos dois casos, uma prova que NÃO PODIA PASSAR — o espelho do padrão que a §7
# do Protocolo Antirregressão registra.
#
# POR QUE O ESPELHO, e não reescrever `DIR_MIGRACOES` na cópia como faz
# `apontar_migracoes_para` (bloco (i), que por isso nunca sofreu deste defeito):
# as cópias de (f) são cobradas por uma asserção de que são BYTE A BYTE idênticas
# ao original fora de `psql_migrador`. Reescrever conteúdo as invalidaria. O
# espelho muda a LOCALIZAÇÃO, não os bytes.
#
# As migrações são COPIADAS, não ligadas por atalho: `find … -type f` não
# enxerga atalho como arquivo comum, e uma ligação trocaria um aborto
# ("diretório não existe") por outro ("nenhuma migração encontrada").
#
# Idempotente de propósito — é chamada em substituição de comando, portanto em
# subshell, e não pode depender de estado que sobreviva à chamada.
# --------------------------------------------------------------------------- #
caminho_no_espelho() {
	local espelho="${DIR_TEMPORARIO}/espelho-do-repo"
	install -d -m 0700 \
		"${espelho}/deploy/scripts/instalacao" "${espelho}/packages/db/migracoes"
	cp "${DIR_MIGRACOES}"/*.sql "${espelho}/packages/db/migracoes/"
	printf '%s/deploy/scripts/instalacao/%s' "${espelho}" "$1"
}

# A rede que impede o defeito de voltar em silêncio: qualquer mudança futura no
# caminho de uma cópia executável faz esta asserção reprovar ANTES das que
# dependem de o script ter chegado ao banco.
afirmar_copia_enxerga_migracoes() {
	afirmar_igual "$1" "1" \
		"$([[ -d "$(cd "$(dirname "$2")/../../.." && pwd)/packages/db/migracoes" ]] && echo 1 || echo 0)"
}

# `CREATE SCHEMA` em CÓDIGO — comentário não conta.
#
# A exclusão de comentário não é zelo: o cabeçalho de `0000_fundacao.sql` cita as
# duas instruções removidas EM COMENTÁRIO, e uma varredura ingênua as casaria e
# reprovaria um arquivo correto. O caso prova as duas pontas — que a varredura
# ingênua acusa e que a com exclusão não —, porque é o par que detecta.
contar_create_schema_em_codigo() {
	local dir="$1" total=0 arquivo parcial
	for arquivo in "${dir}"/*.sql; do
		[[ -f "${arquivo}" ]] || continue
		parcial="$(sed 's/--.*$//' "${arquivo}" | grep -cEi 'CREATE[[:space:]]+SCHEMA' || true)"
		total=$((total + parcial))
	done
	printf '%s' "${total}"
}

contar_create_schema_ingenuo() {
	local dir="$1" total=0 arquivo parcial
	for arquivo in "${dir}"/*.sql; do
		[[ -f "${arquivo}" ]] || continue
		parcial="$(grep -cEi 'CREATE[[:space:]]+SCHEMA' "${arquivo}" || true)"
		total=$((total + parcial))
	done
	printf '%s' "${total}"
}

# `drizzle-kit push` no manifesto de `@sysloc/db`.
#
# Por que isto é assunto desta bateria: `push` INTROSPECTA o banco e propõe o
# diferencial contra o schema declarado em TypeScript. As políticas de RLS, o
# `FORCE` e as concessões vivem em `0001_seguranca.sql`, escrito à mão, e não no
# schema declarado — então `push` os veria como objetos a mais e proporia
# `DROP POLICY`. Um script `push` no manifesto é, portanto, um caminho de uma
# linha para desfazer o isolamento que esta bateria acabou de provar.
contar_push_no_manifesto() {
	grep -cE 'drizzle-kit[[:space:]]+push' "$1" 2>/dev/null || true
}

# --------------------------------------------------------------------------- #
# Varredura da árvore versionada — só a POSIÇÃO da ocorrência sai daqui, nunca o
# valor encontrado.
# --------------------------------------------------------------------------- #
git_em() {
	local dir="$1"
	shift
	git -c "safe.directory=${dir}" -C "${dir}" "$@"
}

varrer_arvore_versionada() {
	local dir="$1"
	local agulha
	IFS= read -r agulha

	# `--cached --others --exclude-standard` soma o que está no índice ao que
	# ainda não é rastreado mas é rastreável: neste pipeline o `git add` só
	# acontece depois que os gates aprovam, então sem `--others` os arquivos novos
	# da própria entrega ficariam de fora — que é exatamente o caso que mais
	# importa.
	local -a arquivos=()
	mapfile -d '' arquivos < <(git_em "${dir}" ls-files -z --cached --others --exclude-standard)
	if [[ "${#arquivos[@]}" -eq 0 ]]; then
		return 0
	fi

	local achados=""
	achados="$(cd "${dir}" && printf '%s\n' "${agulha}" |
		grep -nIHF -f - -- "${arquivos[@]}" 2>/dev/null | cut -d: -f1,2)" || true

	if [[ -n "${achados}" ]]; then
		printf '%s\n' "${achados}"
		return 1
	fi
	return 0
}

# Conta as ocorrências da agulha (primeira linha da entrada padrão) nos arquivos
# passados por argumento. Só a CONTAGEM sai daqui.
contar_ocorrencias() {
	local agulha
	IFS= read -r agulha
	local total=0
	total="$(printf '%s\n' "${agulha}" | grep -IF -f - -- "$@" 2>/dev/null | wc -l)" || true
	printf '%s' "${total}"
}

# =========================================================================== #
# CT-031 — No cluster real, toda tabela de negócio tem isolamento forçado e
#          pertence ao papel de migração.
#
# A asserção sobre a CONTAGEM DE TABELAS EXAMINADAS é tão importante quanto a de
# exceções: sem ela, uma consulta que não alcançasse tabela nenhuma — schema
# errado, filtro apertado demais, migração não aplicada — devolveria zero
# exceções e passaria verde sem ter olhado nada.
# =========================================================================== #
ct_031() {
	caso "CT-031" "No cluster real, toda tabela de negócio tem isolamento forçado e pertence ao papel de migração"

	# (a) o arquivo invocado é o que o manifesto publica ---------------------- #
	afirmar_igual "(a) o manifesto de @sysloc/db publica ${ENTRADA_PUBLICA_DB} como ponto de entrada" "1" \
		"$(grep -cF "\"default\": \"${ENTRADA_PUBLICA_DB}\"" "${MANIFESTO_DB}" || true)"

	if [[ ! -f "${CAMINHO_ENTRADA_DB}" ]]; then
		falhar "(a) ${CAMINHO_ENTRADA_DB} não existe — a guarda de cobertura vive lá e sem ela o caso não tem SUT"
		nota "execute 'pnpm build' na raiz do repositório e rode a bateria de novo"
		fechar_caso "CT-031"
		return
	fi

	# (b) cobertura do banco da OPERAÇÃO -------------------------------------- #
	local saida_cobertura codigo_cobertura=0
	saida_cobertura="$(bash "${BASH_SOURCE[0]}" cobertura "${BANCO_DB}" 2>&1)" || codigo_cobertura=$?

	if [[ "${codigo_cobertura}" -eq 2 ]]; then
		falhar "(b) não foi possível apurar a cobertura de '${BANCO_DB}': ${saida_cobertura}"
		fechar_caso "CT-031"
		return
	fi

	afirmar_igual "(b) a guarda de cobertura aprova o banco '${BANCO_DB}'" "0" "${codigo_cobertura}"
	afirmar_igual "(b) nenhuma tabela de negócio é exceção" "0" \
		"$(printf '%s\n' "${saida_cobertura}" | grep -c '^EXCECAO ' || true)"
	afirmar_igual "(b) as tabelas de negócio examinadas são exatamente as da fatia" \
		"${TABELAS_DE_NEGOCIO_ESPERADAS}" \
		"$(printf '%s\n' "${saida_cobertura}" | sed -n 's/^EXAMINADA //p' | sort | tr '\n' ' ' | sed 's/ $//')"

	# (c) propriedade das tabelas -------------------------------------------- #
	afirmar_igual "(c) nenhuma tabela de '${SCHEMA_NEGOCIO}' tem dono diferente de '${PAPEL_MIGRACAO}'" "0" \
		"$(psql_admin_no_banco "${BANCO_DB}" "
			SELECT count(*) FROM pg_catalog.pg_tables
			WHERE schemaname = '${SCHEMA_NEGOCIO}' AND tableowner <> '${PAPEL_MIGRACAO}'")"
	afirmar_igual "(c) o papel da aplicação não é dono de tabela alguma nos três schemas" "0" \
		"$(psql_admin_no_banco "${BANCO_DB}" "
			SELECT count(*) FROM pg_catalog.pg_tables
			WHERE schemaname IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}', '${SCHEMA_PLATAFORMA}')
			  AND tableowner = '${PAPEL_DB}'")"
	afirmar_diferente "(c) há tabela de negócio a examinar (a asserção acima teria objeto)" "0" \
		"$(psql_admin_no_banco "${BANCO_DB}" "
			SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = '${SCHEMA_NEGOCIO}'")"

	# (d) privilégio concedido — nem a mais, nem a menos ---------------------- #
	#
	# A guarda de cobertura responde por RLS, coluna e unicidade; ela NÃO olha
	# privilégio. Sem esta asserção, um `GRANT` excessivo acrescentado a uma
	# migração futura — `TRUNCATE`, `REFERENCES`, `CREATE` no schema — passaria
	# despercebido: nada quebraria, e a superfície do papel que atende requisição
	# cresceria em silêncio. A afirmação é por PAR (tabela, verbo) e cobre os dois
	# sentidos do erro de uma vez, porque compara o privilégio efetivo com o
	# conjunto exato dos quatro verbos de manipulação de dado.
	afirmar_igual "(d) '${PAPEL_DB}' tem exatamente SELECT/INSERT/UPDATE/DELETE nas tabelas de '${SCHEMA_NEGOCIO}'" "0" \
		"$(psql_admin_no_banco "${BANCO_DB}" "
			SELECT count(*)
			FROM pg_catalog.pg_class c
			JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
			CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS verbo
			WHERE n.nspname = '${SCHEMA_NEGOCIO}'
			  AND c.relkind IN ('r', 'p')
			  AND has_table_privilege('${PAPEL_DB}', c.oid, verbo)
			      <> (verbo IN ('SELECT','INSERT','UPDATE','DELETE'))")"
	# Sem cast para texto: `psql -A -t` já rende booleano como `t`/`f`, e
	# `booleano::text` renderia `true`/`false` — duas grafias para a mesma coisa
	# na mesma bateria seriam uma fonte gratuita de asserção que nunca casa.
	afirmar_igual "(d) '${PAPEL_DB}' não pode criar objeto em '${SCHEMA_NEGOCIO}'" "f" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_NEGOCIO}', 'CREATE')")"
	afirmar_igual "(d) '${PAPEL_DB}' não pode criar objeto em '${SCHEMA_IDENTIDADE}'" "f" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_IDENTIDADE}', 'CREATE')")"
	afirmar_igual "(d) '${PAPEL_DB}' não pode criar objeto em '${SCHEMA_PLATAFORMA}'" "f" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_PLATAFORMA}', 'CREATE')")"
	# As três abaixo impedem que as três acima sejam vacuamente verdadeiras: um
	# papel sem alcance NENHUM aos schemas também não pode criar objeto neles, e
	# passaria pelas asserções de CREATE sem que a concessão de uso existisse.
	afirmar_igual "(d) '${PAPEL_DB}' alcança '${SCHEMA_IDENTIDADE}'" "t" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_IDENTIDADE}', 'USAGE')")"
	afirmar_igual "(d) '${PAPEL_DB}' alcança '${SCHEMA_NEGOCIO}'" "t" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_NEGOCIO}', 'USAGE')")"
	# `USAGE` em '${SCHEMA_PLATAFORMA}' é pré-condição de a aplicação sequer
	# RESOLVER o nome da função do identificador bancário — sem ele a chamada morre
	# em 42501 antes de o `EXECUTE` concedido importar. Ele vem das duas frentes: do
	# provisionamento (P16) e da própria `0016`.
	afirmar_igual "(d) '${PAPEL_DB}' alcança '${SCHEMA_PLATAFORMA}'" "t" \
		"$(psql_admin_no_banco "${BANCO_DB}" "SELECT has_schema_privilege('${PAPEL_DB}', '${SCHEMA_PLATAFORMA}', 'USAGE')")"

	# A tabela de REGISTRO da migração, que a fatia introduziu, é o ponto em que a
	# mesma classe de erro reaparece por um caminho que nenhuma asserção acima
	# alcança: `0001_seguranca.sql` concede os quatro verbos `ON ALL TABLES IN
	# SCHEMA identidade`, e a tabela de registro JÁ EXISTE quando essa concessão
	# roda — ela é criada antes, pela própria execução de `migrar-banco.sh`. A
	# concessão a alcança, e é `retirar_alcance_da_aplicacao` que a desfaz, ao fim
	# de cada execução.
	#
	# Sem esta asserção, remover, quebrar ou REORDENAR aquela função não seria
	# acusado por nada: o retrato de `instantaneo_do_catalogo` compara a 1ª com a 2ª
	# execução, e as duas são pós-retirada — a igualdade passaria igualmente se a
	# retirada sumisse das duas.
	afirmar_igual "(d) '${PAPEL_DB}' não tem verbo algum sobre a tabela de registro '${TABELA_REGISTRO}'" "0" \
		"$(verbos_concedidos_na_tabela_de_registro "${BANCO_DB}")"

	# (e) a migração não volta a criar os schemas ----------------------------- #
	afirmar_igual "(e) nenhum CREATE SCHEMA em código nos arquivos de migração" "0" \
		"$(contar_create_schema_em_codigo "${DIR_MIGRACOES}")"
	# A ponta que prova que (e) não é vacuamente verdadeira: os mesmos arquivos
	# CITAM as instruções removidas em comentário, e a varredura ingênua as acusa.
	# Se esta afirmação parar de valer, a exclusão de comentário deixou de estar
	# sendo exercitada e (e) virou uma asserção que não pode falhar.
	afirmar_diferente "(e) a varredura ingênua (sem excluir comentário) acusaria — é o que torna a exclusão necessária" "0" \
		"$(contar_create_schema_ingenuo "${DIR_MIGRACOES}")"

	local dir_mutante="${DIR_TEMPORARIO}/migracoes-com-create-schema"
	install -d -m 0700 "${dir_mutante}"
	cp "${DIR_MIGRACOES}"/*.sql "${dir_mutante}/"
	printf '\nCREATE SCHEMA "%s";\n' "${SCHEMA_NEGOCIO}" >>"${dir_mutante}/0001_seguranca.sql"
	afirmar_diferente "(e) com CREATE SCHEMA reintroduzido em CÓDIGO, a varredura acusa" "0" \
		"$(contar_create_schema_em_codigo "${dir_mutante}")"
	rm -rf "${dir_mutante}"

	# (f) o manifesto não expõe `drizzle-kit push` ---------------------------- #
	afirmar_igual "(f) o manifesto de @sysloc/db não expõe 'drizzle-kit push'" "0" \
		"$(contar_push_no_manifesto "${MANIFESTO_DB}")"

	local manifesto_mutante="${DIR_TEMPORARIO}/package-com-push.json"
	sed 's|"gerar-migracao": "drizzle-kit generate"|"gerar-migracao": "drizzle-kit generate",\n    "empurrar": "drizzle-kit push"|' \
		"${MANIFESTO_DB}" >"${manifesto_mutante}"
	afirmar_diferente "(f) com um script 'push' reintroduzido, a varredura do manifesto acusa" "0" \
		"$(contar_push_no_manifesto "${manifesto_mutante}")"
	rm -f "${manifesto_mutante}"

	# (g) o mutante em banco DESCARTÁVEL -------------------------------------- #
	#
	# Sem esta ponta, (b) provaria apenas que a guarda diz "está tudo certo" —
	# nunca que ela SABE dizer o contrário. O mutante é uma tabela de negócio com
	# tudo no lugar EXCETO `FORCE`: é o defeito exato que a ADR-0008 registra nos
	# Cons, e o único que ela deve reportar.
	if ! carregar_preparacao_do_provisionador; then
		falhar "(g) não consegui extrair 'sql_preparar_banco_para_migracao' de ${SCRIPT_PROVISIONAR} — sem ela o banco descartável não seria montado como o da operação, e o mutante não provaria nada"
		fechar_caso "CT-031"
		return
	fi

	criar_banco_descartavel "${BANCO_VERIFICACAO}"

	local codigo_migracao=0
	SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" bash "${SCRIPT_MIGRAR}" \
		>"${DIR_TEMPORARIO}/migracao-descartavel.log" 2>&1 || codigo_migracao=$?
	afirmar_igual "(g) a migração do banco descartável concluiu (senão não há o que mutar)" "0" "${codigo_migracao}"
	if [[ "${codigo_migracao}" -ne 0 ]]; then
		nota "(g) últimas linhas: $(tail -3 "${DIR_TEMPORARIO}/migracao-descartavel.log" | tr '\n' ' ')"
		remover_banco_descartavel "${BANCO_VERIFICACAO}"
		fechar_caso "CT-031"
		return
	fi

	local codigo_integro=0 saida_integro
	saida_integro="$(bash "${BASH_SOURCE[0]}" cobertura "${BANCO_VERIFICACAO}" 2>&1)" || codigo_integro=$?
	afirmar_igual "(g) contra o banco descartável ÍNTEGRO, o verificador sai 0" "0" "${codigo_integro}"
	afirmar_igual "(g) contra o banco descartável íntegro, nenhuma exceção é reportada" "0" \
		"$(printf '%s\n' "${saida_integro}" | grep -c '^EXCECAO ' || true)"

	psql_admin_entrada_no_banco "${BANCO_VERIFICACAO}" >/dev/null <<-MUTANTE
		SET ROLE "${PAPEL_MIGRACAO}";
		CREATE TABLE "${SCHEMA_NEGOCIO}"."sem_forca" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
			"empresa_id" uuid NOT NULL,
			CONSTRAINT "sem_forca_id_empresa_id_unique" UNIQUE ("id", "empresa_id")
		);
		ALTER TABLE "${SCHEMA_NEGOCIO}"."sem_forca" ENABLE ROW LEVEL SECURITY;
	MUTANTE

	local codigo_mutante=0 saida_mutante
	saida_mutante="$(bash "${BASH_SOURCE[0]}" cobertura "${BANCO_VERIFICACAO}" 2>&1)" || codigo_mutante=$?

	afirmar_igual "(g) com o mutante, o verificador sai 1" "1" "${codigo_mutante}"
	afirmar_igual "(g) com o mutante, a saída nomeia a tabela e o motivo" "1" \
		"$(printf '%s\n' "${saida_mutante}" | grep -cxF "EXCECAO ${SCHEMA_NEGOCIO}.sem_forca RLS_NAO_FORCADA" || true)"
	afirmar_igual "(g) o mutante é a ÚNICA exceção — as tabelas da fatia continuam íntegras" "1" \
		"$(printf '%s\n' "${saida_mutante}" | grep -c '^EXCECAO ' || true)"

	# (h) o par que torna a asserção (d) sobre a tabela de registro uma prova ---- #
	#
	# A asserção (d) afirma AUSÊNCIA de privilégio no banco da operação. Sozinha ela
	# é da família que este projeto já pagou caro: uma consulta escrita errada —
	# nome de tabela trocado, papel trocado, predicado invertido — devolveria zero
	# para sempre e a ausência ficaria provada por acidente.
	#
	# Aqui a MESMA função é apontada ao banco descartável, que acabou de receber a
	# migração inteira: primeiro sem nada concedido (tem de dar 0, como no banco da
	# operação), depois com UM verbo concedido (tem de acusar), depois com ele
	# retirado (tem de voltar a 0). O ciclo completo é o que distingue "a consulta
	# vê zero" de "a consulta não vê nada".
	afirmar_igual "(h) no banco descartável recém-migrado, '${PAPEL_DB}' também não tem verbo sobre '${TABELA_REGISTRO}'" "0" \
		"$(verbos_concedidos_na_tabela_de_registro "${BANCO_VERIFICACAO}")"

	psql_admin_no_banco "${BANCO_VERIFICACAO}" \
		"GRANT SELECT ON TABLE ${TABELA_REGISTRO} TO \"${PAPEL_DB}\"" >/dev/null
	afirmar_igual "(h) com um GRANT SELECT reintroduzido, a MESMA consulta acusa exatamente um verbo" "1" \
		"$(verbos_concedidos_na_tabela_de_registro "${BANCO_VERIFICACAO}")"

	psql_admin_no_banco "${BANCO_VERIFICACAO}" \
		"REVOKE ALL ON TABLE ${TABELA_REGISTRO} FROM PUBLIC, \"${PAPEL_DB}\"" >/dev/null
	afirmar_igual "(h) retirado o GRANT, a mesma consulta volta a zero" "0" \
		"$(verbos_concedidos_na_tabela_de_registro "${BANCO_VERIFICACAO}")"

	# (h-bis) o OUTRO ponto em que o livro-razão pode nascer já concedido ----- #
	#
	# A retirada dentro da transação de aplicação — que (i) prova — cobre a
	# concessão emitida PELAS migrações. Ela não alcança a CRIAÇÃO da tabela:
	# `0001_seguranca.sql` instala `ALTER DEFAULT PRIVILEGES ... GRANT ... ON TABLES
	# TO "${PAPEL_DB}"`, que se aplica no INSTANTE do `CREATE`, e
	# `garantir_tabela_de_registro` roda numa invocação própria, ANTES do laço. Num
	# banco com o 0001 já aplicado e o livro-razão inexistente — remoção manual,
	# restauração parcial —, a tabela nasceria com os quatro verbos; e como o
	# registro vazio manda reaplicar o `0000`, cujo `CREATE TABLE` não é
	# `IF NOT EXISTS`, a execução aborta e a chamada ao fim de `main` não roda.
	#
	# O banco descartável de (g)/(h) já está no estado exato que o cenário pede:
	# migrado por inteiro, portanto com o `ALTER DEFAULT PRIVILEGES` instalado.
	# Basta derrubar o livro-razão e reexecutar — nenhuma criação de banco a mais.
	# Medido em instância própria e efêmera antes de virar asserção: 4 verbos com a
	# cópia sem a retirada na criação, 0 com o script atual, e nenhuma das duas
	# emite linha alguma (o `REVOKE` no-op é silencioso porque quem o emite é o dono
	# da tabela — não polui a saída que o CT-032 compara).
	# A cópia vive num ESPELHO do repositório — ver `caminho_no_espelho`.
	local copia_sem_retirada_na_criacao
	copia_sem_retirada_na_criacao="$(caminho_no_espelho migrar-sem-retirada-na-criacao.sh)"
	remover_retirada_na_criacao "${SCRIPT_MIGRAR}" >"${copia_sem_retirada_na_criacao}"

	afirmar_copia_enxerga_migracoes \
		"(h-bis) a cópia enxerga o mesmo diretório de migrações que o original" \
		"${copia_sem_retirada_na_criacao}"

	afirmar_igual "(h-bis) a cópia sem a retirada na criação é sintaticamente válida" "0" \
		"$(bash -n "${copia_sem_retirada_na_criacao}" 2>/dev/null && echo 0 || echo 1)"
	# Referência EXTERNA ao mutante, como em (i): a forma exata do diferencial. Uma
	# linha trocada por uma, e nada mais. Medido: padrão que deixasse de casar rende
	# `0 0`; padrão que arrastasse junto a retirada da transação rende `3 1`. Os dois
	# reprovam, que é o que uma comparação do mutante consigo mesmo não faria.
	afirmar_igual "(h-bis) a cópia difere do original em EXATAMENTE uma linha trocada" "1 1" \
		"$(diff "${SCRIPT_MIGRAR}" "${copia_sem_retirada_na_criacao}" | grep -c '^<') $(diff "${SCRIPT_MIGRAR}" "${copia_sem_retirada_na_criacao}" | grep -c '^>')"
	afirmar_igual "(h-bis) a cópia conserva a retirada DENTRO da transação de aplicação" "1" \
		"$(contar_padrao_no_arquivo "${copia_sem_retirada_na_criacao}" 'REVOKE ALL ON TABLE %s FROM PUBLIC')"

	local variante_criacao rotulo_criacao codigo_recriacao verbos_apos_criacao
	for variante_criacao in "${SCRIPT_MIGRAR}" "${copia_sem_retirada_na_criacao}"; do
		rotulo_criacao="${variante_criacao##*/}"

		# O cenário fora de banda que o BAIXO-001 descreve, reproduzido: o livro-razão
		# some de um banco que já recebeu o 0001.
		psql_admin_no_banco "${BANCO_VERIFICACAO}" \
			"DROP TABLE IF EXISTS ${TABELA_REGISTRO}" >/dev/null

		codigo_recriacao=0
		SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" bash "${variante_criacao}" \
			>"${DIR_TEMPORARIO}/recriacao-${rotulo_criacao}.log" 2>&1 || codigo_recriacao=$?

		# Sem esta, um cenário em que a execução concluísse levaria
		# `retirar_alcance_da_aplicacao` a rodar ao fim de `main` e a asserção
		# seguinte passaria pela razão errada, provando a rede em vez da defesa.
		afirmar_diferente "(h-bis) ${rotulo_criacao}: com o registro vazio a reaplicação do 0000 ABORTA (logo a chamada ao fim de main não roda)" \
			"0" "${codigo_recriacao}"
		afirmar_igual "(h-bis) ${rotulo_criacao}: a tabela de registro foi recriada antes do aborto (senão a asserção seguinte não teria objeto)" "1" \
			"$(psql_admin_no_banco "${BANCO_VERIFICACAO}" "
				SELECT count(*) FROM pg_catalog.pg_tables
				WHERE schemaname = '${SCHEMA_IDENTIDADE}' AND tablename = 'migracao_aplicada'")"

		verbos_apos_criacao="$(verbos_concedidos_na_tabela_de_registro "${BANCO_VERIFICACAO}")"
		if [[ "${variante_criacao}" == "${copia_sem_retirada_na_criacao}" ]]; then
			afirmar_diferente "(h-bis) sem a retirada na criação, a tabela NASCE concedida a '${PAPEL_DB}' pelo ALTER DEFAULT PRIVILEGES" \
				"0" "${verbos_apos_criacao}"
			nota "(h-bis) verbos deixados pela cópia sem a retirada na criação: ${verbos_apos_criacao}"
		else
			afirmar_igual "(h-bis) com a retirada no mesmo 'psql -c' da criação, a tabela nasce SEM verbo para '${PAPEL_DB}'" \
				"0" "${verbos_apos_criacao}"
		fi
	done

	# Este bloco deixa o banco descartável com o registro vazio e o 0000 meio
	# aplicado, e não o limpa de propósito: (i) abre CADA volta com
	# `criar_banco_descartavel`, que derruba e recria. Recriar aqui seria uma
	# criação de banco a mais pagando por nada.

	# (i) o estado deixado por uma execução ABORTADA -------------------------- #
	#
	# (d) e (h) descrevem e provam corretamente o estado final de uma execução
	# BEM-SUCEDIDA. Nenhum dos dois alcança o estado que uma execução interrompida
	# deixa para trás — e era ali que o defeito morava: a retirada de privilégio era
	# a última instrução útil de `main`, de modo que todo caminho de saída anterior
	# a pulava, enquanto `0001_seguranca.sql` já tinha concedido os quatro verbos
	# `ON ALL TABLES IN SCHEMA identidade` sobre uma tabela de registro que existe
	# desde antes do laço.
	#
	# O que este bloco mede é a propriedade, não a ocorrência: interrompe-se a
	# execução DEPOIS do 0001 — com um `0002` sintético que falha, num diretório de
	# migrações descartável — e pergunta-se ao banco o que sobrou. O par que o torna
	# prova é a segunda cópia, com a retirada de volta para FORA da transação: ela é
	# o código anterior à correção, e tem de acusar. Medido em instância própria
	# antes de virar asserção: 4 verbos remanescentes na cópia regredida, 0 na atual.
	local dir_migracoes_falhando="${DIR_TEMPORARIO}/migracoes-com-0002-que-falha"
	rm -rf "${dir_migracoes_falhando}"
	install -d -m 0700 "${dir_migracoes_falhando}"
	cp "${DIR_MIGRACOES}"/*.sql "${dir_migracoes_falhando}/"
	printf 'SELECT 1 FROM tabela_que_nao_existe_ct031_i;\n' \
		>"${dir_migracoes_falhando}/0002_falha_sintetica.sql"

	# Estas duas ficam no temporário PLANO, e não no espelho, de propósito:
	# `apontar_migracoes_para` reescreve `DIR_MIGRACOES` nelas para um caminho
	# absoluto, então a raiz que o script deriva do próprio caminho deixa de
	# importar. É por isso que este bloco nunca sofreu do defeito que
	# `caminho_no_espelho` fecha — e é a razão de haver DOIS mecanismos: aqui o
	# conteúdo pode ser reescrito; em (h-bis) e em (f) do CT-032, não.
	local copia_abortando="${DIR_TEMPORARIO}/migrar-abortando.sh"
	local copia_regredida="${DIR_TEMPORARIO}/migrar-abortando-sem-retirada-na-transacao.sh"
	apontar_migracoes_para "${SCRIPT_MIGRAR}" "${dir_migracoes_falhando}" >"${copia_abortando}"
	remover_retirada_em_transacao "${copia_abortando}" >"${copia_regredida}"

	afirmar_igual "(i) a cópia que aborta é sintaticamente válida" "0" \
		"$(bash -n "${copia_abortando}" 2>/dev/null && echo 0 || echo 1)"
	afirmar_igual "(i) a cópia regredida é sintaticamente válida" "0" \
		"$(bash -n "${copia_regredida}" 2>/dev/null && echo 0 || echo 1)"
	afirmar_igual "(i) a cópia lê as migrações do diretório descartável" "1" \
		"$(contar_linha_literal "${copia_abortando}" "readonly DIR_MIGRACOES=\"${dir_migracoes_falhando}\"")"
	afirmar_igual "(i) o script real retira o privilégio DENTRO da transação de aplicação" "1" \
		"$(contar_padrao_no_arquivo "${SCRIPT_MIGRAR}" 'REVOKE ALL ON TABLE %s FROM PUBLIC')"
	afirmar_igual "(i) a cópia regredida perdeu essa retirada — o mutante foi plantado" "0" \
		"$(contar_padrao_no_arquivo "${copia_regredida}" 'REVOKE ALL ON TABLE %s FROM PUBLIC')"
	# Fora da retirada, as duas cópias são a MESMA coisa. Um mutante que mudasse
	# mais de uma coisa não diria qual delas a asserção pegou.
	#
	# A referência é EXTERNA à função sob prova, e é essa a razão da forma. A versão
	# anterior comparava `remover_retirada_em_transacao "${copia_abortando}"` com o
	# próprio `${copia_regredida}` — arquivo produzido acima por essa mesma chamada
	# com essa mesma entrada, isto é, `sha256(f(x)) == sha256(f(x))` sobre um `sed`
	# determinístico: não podia reprovar por defeito nenhum. Medido: com uma
	# `remover_retirada_em_transacao` larga demais, que arrastasse junto o `printf`
	# do INSERT no livro-razão, aquela asserção seguia verde — e com o INSERT também
	# removido o `0001` nunca é registrado, de modo que os verbos remanescentes que
	# este par atribui à retirada fora da transação passariam a ter OUTRA causa, sem
	# uma única asserção vermelha.
	#
	# O que se afirma agora é a FORMA EXATA do diferencial: duas linhas retiradas,
	# nenhuma acrescentada. Qualquer mutante que tire mais ou menos que as duas
	# linhas da retirada muda essa contagem — padrão largo, âncora deslocada, `,+N`
	# maior, remoção adicional —, e `2 0` só é possível se todo o resto das duas
	# cópias for idêntico linha a linha. Medido: função commitada rende `2 0`;
	# variante larga demais rende `4 0` e esta asserção REPROVA.
	afirmar_igual "(i) a cópia regredida difere da outra em EXATAMENTE as duas linhas da retirada" "2 0" \
		"$(diff "${copia_abortando}" "${copia_regredida}" | grep -c '^<') $(diff "${copia_abortando}" "${copia_regredida}" | grep -c '^>')"

	local variante codigo_abortado log_abortado verbos_apos_aborto
	for variante in "${copia_abortando}" "${copia_regredida}"; do
		# Banco NOVO a cada volta: o `GRANT` do 0001 precisa acontecer DENTRO da
		# execução que aborta. Contra um banco já migrado, o 0001 sairia como JA-OK,
		# concessão nenhuma seria emitida, e a asserção passaria sem objeto.
		criar_banco_descartavel "${BANCO_VERIFICACAO}"

		log_abortado="${DIR_TEMPORARIO}/aborto-$(basename "${variante}").log"
		codigo_abortado=0
		SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" bash "${variante}" \
			>"${log_abortado}" 2>&1 || codigo_abortado=$?

		afirmar_diferente "(i) ${variante##*/}: a execução ABORTA no 0002 sintético" "0" "${codigo_abortado}"
		# Sem esta, um aborto ANTES do 0001 daria zero verbos por não ter havido
		# concessão nenhuma — a asserção seguinte passaria sem poder falhar.
		afirmar_igual "(i) ${variante##*/}: a execução chegou a aplicar 0001_seguranca.sql (senão a concessão nunca existiu)" "1" \
			"$(grep -cE '^\[migrar\] CRIADO +0001_seguranca\.sql' "${log_abortado}" || true)"
		afirmar_igual "(i) ${variante##*/}: o 0002 que falhou NÃO ficou registrado" "0" \
			"$(psql_admin_no_banco "${BANCO_VERIFICACAO}" "
				SELECT count(*) FROM ${TABELA_REGISTRO} WHERE arquivo = '0002_falha_sintetica.sql'")"

		verbos_apos_aborto="$(verbos_concedidos_na_tabela_de_registro "${BANCO_VERIFICACAO}")"
		if [[ "${variante}" == "${copia_regredida}" ]]; then
			afirmar_diferente "(i) com a retirada de volta para FORA da transação, o aborto DEIXA privilégio sobre '${TABELA_REGISTRO}'" \
				"0" "${verbos_apos_aborto}"
			nota "(i) verbos remanescentes na cópia regredida: ${verbos_apos_aborto}"
		else
			afirmar_igual "(i) com a retirada dentro da transação, o aborto NÃO deixa privilégio sobre '${TABELA_REGISTRO}'" \
				"0" "${verbos_apos_aborto}"
		fi

		remover_banco_descartavel "${BANCO_VERIFICACAO}"
	done

	rm -rf "${dir_migracoes_falhando}"
	rm -f "${copia_abortando}" "${copia_regredida}"

	fechar_caso "CT-031"
}

# =========================================================================== #
# CT-032 — `migrar-banco.sh` é idempotente e não expõe a credencial de migração.
#
# As duas metades são inseparáveis: um script de migração que reaplicasse SQL
# estrutural deixaria o banco em estado indescritível, e um que vazasse a
# credencial do papel DONO das tabelas entregaria, a qualquer usuário desta
# máquina compartilhada, o poder que a separação de papéis existe para negar.
#
# Os dois últimos blocos guardam a BATERIA, e não o script, e moram aqui porque é
# este caso quem cria banco no cluster e roda a migração contra ele: (i) confere
# que as constantes espelhadas continuam declaradas na origem, e (j) que a recusa
# de rodar contra a instalação que atende a operação de fato TERMINA o processo.
# =========================================================================== #
ct_032() {
	caso "CT-032" "migrar-banco.sh executado duas vezes é idempotente e não expõe a credencial de migração"

	# (a) auditoria estática dos quatro transportes proibidos ----------------- #
	local indice
	for indice in "${!PADROES_PROIBIDOS[@]}"; do
		afirmar_igual "(a) o script não usa ${ROTULOS_PROIBIDOS[${indice}]}" "0" \
			"$(contar_padrao_no_arquivo "${SCRIPT_MIGRAR}" "${PADROES_PROIBIDOS[${indice}]}")"
	done

	# (b) prova de falsificação da auditoria acima ---------------------------- #
	#
	# Sem isto, uma expressão errada devolveria 0 para sempre e ninguém
	# perceberia — a asserção seria infalível, que é o defeito documentado em
	# `.claude/rules/testing-stack.md`. Cada padrão ganha a SUA cópia com o
	# defeito de volta, porque são quatro expressões independentes e provar uma
	# não prova as outras.
	#
	# As linhas plantadas são compostas em pedaços (`%s`) de propósito: escritas
	# inteiras, o texto DESTE arquivo passaria a ser ele próprio uma instância do
	# transporte proibido, e a auditoria de `deploy/scripts/**/*.sh` nunca
	# fecharia no repositório.
	local -a plantios=(
		"$(printf 'set %sx\n' '-')"
		"$(printf 'psql %spassword%s"segredo-sintetico"\n' '--' '=')"
		"$(printf 'bench %sdbpassword%s"segredo-sintetico"\n' '--' '=')"
		"$(printf 'PGPASSWORD%s"segredo-sintetico" psql -c "SELECT 1"\n' '=')"
	)
	local copia
	for indice in "${!PADROES_PROIBIDOS[@]}"; do
		copia="${DIR_TEMPORARIO}/migrar-com-defeito-${indice}.sh"
		cp "${SCRIPT_MIGRAR}" "${copia}"
		printf '%s\n' "${plantios[${indice}]}" >>"${copia}"
		afirmar_diferente "(b) com ${ROTULOS_PROIBIDOS[${indice}]} reintroduzido, a auditoria acusa" "0" \
			"$(contar_padrao_no_arquivo "${copia}" "${PADROES_PROIBIDOS[${indice}]}")"
		rm -f "${copia}"
	done

	# (c) a agulha — sem ela as varreduras dinâmicas não têm o que procurar --- #
	local credencial
	if ! credencial="$(ler_credencial_de_migracao "${ARQ_AMBIENTE_MIGRACAO}")"; then
		falhar "(c) não foi possível ler uma credencial íntegra de ${ARQ_AMBIENTE_MIGRACAO} — ausente, ambígua, ou com caractere fora de [A-Za-z0-9]; o caso não tem agulha confiável para procurar"
		fechar_caso "CT-032"
		return
	fi
	afirmar_igual "(c) o arquivo da credencial de migração é 0600 e pertence ao root" "600 root" \
		"$(stat -c '%a %U' "${ARQ_AMBIENTE_MIGRACAO}")"

	# O sujeito desta asserção é `provisionar-base.sh`, e NÃO a constante local.
	#
	# A versão anterior comparava a constante deste arquivo contra a raiz do
	# repositório: provava que quem digitou esta linha digitou um caminho absoluto
	# fora do repositório, e nada mais. A propriedade que interessa é ONDE O
	# PROVISIONAMENTO GRAVA a credencial — se ela passar a ser gravada dentro da
	# árvore versionada, a asserção antiga continuaria verde. Ler o caminho da
	# origem antes de julgá-lo é o que a faz poder falhar pelo defeito que persegue.
	local caminho_gravado_pela_origem
	caminho_gravado_pela_origem="$(sed -n 's|^readonly ARQ_AMBIENTE_MIGRACAO="\(.*\)"$|\1|p' \
		"${SCRIPT_PROVISIONAR}" | head -1)"
	afirmar_igual "(c) 'provisionar-base.sh' declara o mesmo caminho de credencial que esta bateria audita" \
		"${ARQ_AMBIENTE_MIGRACAO}" "${caminho_gravado_pela_origem}"
	# O `-n` não é zelo: extração vazia também não é prefixada pela raiz, e sem ele
	# um `sed` que deixasse de casar faria a asserção passar por não ter olhado nada.
	afirmar_igual "(c) o caminho que 'provisionar-base.sh' grava fica fora da raiz do repositório" "1" \
		"$([[ -n "${caminho_gravado_pela_origem}" && "${caminho_gravado_pela_origem}" != "${RAIZ_REPO}"/* ]] && echo 1 || echo 0)"

	# (d) duas execuções contra o banco descartável --------------------------- #
	if ! carregar_preparacao_do_provisionador; then
		falhar "(d) não consegui extrair 'sql_preparar_banco_para_migracao' de ${SCRIPT_PROVISIONAR}"
		fechar_caso "CT-032"
		return
	fi

	criar_banco_descartavel "${BANCO_VERIFICACAO}"

	local log1="${DIR_TEMPORARIO}/migracao-1.log"
	local log2="${DIR_TEMPORARIO}/migracao-2.log"
	local retrato1="${DIR_TEMPORARIO}/catalogo-1.txt"
	local retrato2="${DIR_TEMPORARIO}/catalogo-2.txt"
	local codigo1=0 codigo2=0

	SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" bash "${SCRIPT_MIGRAR}" >"${log1}" 2>&1 || codigo1=$?
	afirmar_igual "(d) código de saída da 1ª execução" "0" "${codigo1}"
	if [[ "${codigo1}" -ne 0 ]]; then
		nota "(d) últimas linhas da 1ª execução: $(tail -3 "${log1}" | tr '\n' ' ')"
		remover_banco_descartavel "${BANCO_VERIFICACAO}"
		fechar_caso "CT-032"
		return
	fi
	instantaneo_do_catalogo "${BANCO_VERIFICACAO}" >"${retrato1}"

	SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" bash "${SCRIPT_MIGRAR}" >"${log2}" 2>&1 || codigo2=$?
	afirmar_igual "(d) código de saída da 2ª execução" "0" "${codigo2}"
	instantaneo_do_catalogo "${BANCO_VERIFICACAO}" >"${retrato2}"

	afirmar_igual "(d) o instantâneo do catálogo é idêntico entre as duas execuções" \
		"$(sha256sum <"${retrato1}" | cut -d' ' -f1)" "$(sha256sum <"${retrato2}" | cut -d' ' -f1)"
	if ! cmp -s "${retrato1}" "${retrato2}"; then
		nota "(d) primeira divergência: $(diff "${retrato1}" "${retrato2}" | head -4 | tr '\n' ' ')"
	fi

	# O instantâneo precisa ter TODAS as seções. Dois retratos vazios também são
	# idênticos, e dois retratos PARCIAIS pelo mesmo motivo — foi o que aconteceu
	# quando uma das quatro consultas abortava por ambiguidade de tipo: a
	# igualdade passava verde sobre um retrato sem as relações. Afirmar a presença
	# de cada seção é o que torna a igualdade uma prova.
	local secao
	for secao in RELACAO COLUNA POLITICA REGISTRO; do
		afirmar_diferente "(d) o instantâneo do catálogo tem a seção ${secao}" "0" \
			"$(grep -c "^${secao} " "${retrato1}" || true)"
	done
	afirmar_igual "(d) a 1ª execução aplicou ao menos uma migração" "1" \
		"$([[ "$(grep -cE '^\[migrar\] CRIADO ' "${log1}" || true)" -ge 1 ]] && echo 1 || echo 0)"
	afirmar_igual "(d) a 2ª execução não tem NENHUMA linha de aplicação" "0" \
		"$(grep -cE '^\[migrar\] CRIADO ' "${log2}" || true)"

	# Cada arquivo aplicado na 1ª aparece como já aplicado na 2ª. A lista é
	# DERIVADA da saída, nunca escrita à mão — assim o caso não envelhece quando a
	# fatia seguinte acrescentar uma migração.
	local aplicadas_1 aplicadas_2
	aplicadas_1="$(grep -oE '^\[migrar\] CRIADO +[0-9]{4}_[A-Za-z0-9_-]+\.sql' "${log1}" |
		grep -oE '[0-9]{4}_[A-Za-z0-9_-]+\.sql' | sort | tr '\n' ' ')"
	aplicadas_2="$(grep -oE '^\[migrar\] JA-OK +[0-9]{4}_[A-Za-z0-9_-]+\.sql' "${log2}" |
		grep -oE '[0-9]{4}_[A-Za-z0-9_-]+\.sql' | sort | tr '\n' ' ')"
	afirmar_diferente "(d) a 1ª execução nomeou ao menos uma migração" "" "${aplicadas_1// /}"
	afirmar_igual "(d) cada migração da 1ª execução aparece como já aplicada na 2ª" \
		"${aplicadas_1}" "${aplicadas_2}"
	nota "(d) migrações observadas: ${aplicadas_1}"

	# (e) a saída das duas execuções não carrega a credencial ----------------- #
	afirmar_igual "(e) a credencial não aparece na saída das duas execuções" "0" \
		"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${log1}" "${log2}")"

	# (f) prova dinâmica: nenhum argv de processo filho carrega a credencial --- #
	if command -v strace >/dev/null 2>&1; then
		local rastreio="${DIR_TEMPORARIO}/execve.txt"
		local saida_rastreada="${DIR_TEMPORARIO}/migracao-rastreada.log"
		local codigo_rastreado=0
		# `-s 4096` e `-v` NÃO são ajuste fino, e cada um tem O SEU companheiro de
		# falsificação mais abaixo — sem eles esta asserção não pode falhar pelo
		# defeito que persegue, e a afirmação de que estão protegidos seria só uma
		# promessa de comentário.
		#
		# `-s 4096` — o padrão do strace é `-s 32`, e cada cadeia registrada é
		# truncada nesse tamanho. A credencial que `provisionar-base.sh` gera tem
		# exatamente 32 caracteres, e a forma pela qual este script vazaria é a cadeia
		# que ele próprio monta, `postgresql://sysloc_migracao:SEGREDO@…`, cujo
		# prefixo tem 29: sobrariam TRÊS caracteres do segredo no rastreio, e a busca
		# pela agulha inteira devolveria 0 com o vazamento acontecendo na frente dela.
		# Quem o protege é o mutante de `argv` (`substituir_psql_migrador_por_argv`):
		# removido o `-s 4096`, a asserção dele deixa de acusar.
		#
		# `-v` — desabrevia o ambiente, que o strace resume como `/* N vars */` por
		# padrão. O mutante de `argv` NÃO o protege: `argv` é registrado com ou sem
		# `-v`, e removê-lo deixaria todas as asserções verdes enquanto a metade "nem
		# em variável exportada" do invariante — metade literal da ADR-0005 — perderia
		# todo alcance dinâmico. Quem o protege é o SEGUNDO mutante
		# (`exportar_senha_em_variavel_de_ambiente`), cujo único canal de vazamento é
		# o ambiente do processo.
		SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" strace -f -v -s 4096 -e trace=execve -o "${rastreio}" \
			bash "${SCRIPT_MIGRAR}" >"${saida_rastreada}" 2>&1 || codigo_rastreado=$?

		# Sem estas duas afirmações, uma execução que abortasse cedo registraria
		# pouquíssimos `execve`, a contagem daria 0 e a asserção passaria sem ter
		# provado nada — e esta é a ÚNICA prova dinâmica do caso.
		afirmar_igual "(f) a execução rastreada concluiu (senão não há argv a inspecionar)" \
			"0" "${codigo_rastreado}"
		if [[ "${codigo_rastreado}" -ne 0 ]]; then
			nota "(f) última linha de erro: $(grep -E '^\[migrar\] (ERRO|O QUE FAZER):' "${saida_rastreada}" | tail -1)"
		fi

		local execves
		execves="$(grep -c 'execve(' "${rastreio}" || true)"
		afirmar_igual "(f) o rastreio registrou execve suficientes para a inspeção ter objeto (>= ${MINIMO_EXECVE})" "1" \
			"$([[ "${execves}" -ge "${MINIMO_EXECVE}" ]] && echo 1 || echo 0)"
		nota "(f) chamadas execve registradas: ${execves}"

		afirmar_igual "(f) nenhum argv nem ambiente registrado por execve contém a credencial" "0" \
			"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${rastreio}")"
		afirmar_igual "(f) nenhuma linha da execução rastreada contém a credencial" "0" \
			"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${saida_rastreada}")"

		# O companheiro de falsificação da varredura acima.
		#
		# Ele faltava, e esta era a ÚNICA asserção deste caso a afirmar ausência sem
		# ter demonstrado que a busca sabe acusar presença — exatamente a família de
		# defeito que `.claude/rules/testing-stack.md` cataloga. As quatro auditorias
		# estáticas de (a) têm o seu par em (b), e a varredura da árvore de (g) tem o
		# dela em (h); a varredura dinâmica não tinha nenhum.
		#
		# A cópia recebe UM defeito, o do mundo real: a cadeia inteira no `argv` do
		# cliente. Ela roda contra o MESMO banco descartável, sob o MESMO rastreio,
		# com as MESMAS opções, e é varrida pela MESMA função com a MESMA agulha — se
		# o par não usasse tudo isso igual, provaria sobre outra coisa.
		# No ESPELHO, e não em `${DIR_TEMPORARIO}`: fora dele a cópia aborta antes de
		# invocar o cliente, o rastreio sai sem credencial e a asserção que exige o
		# vazamento não tem como passar. Ver `caminho_no_espelho`.
		local copia_vazando
		copia_vazando="$(caminho_no_espelho migrar-vazando-em-argv.sh)"
		substituir_psql_migrador_por_argv "${SCRIPT_MIGRAR}" >"${copia_vazando}"
		afirmar_copia_enxerga_migracoes \
			"(f) a cópia com o vazamento plantado enxerga o diretório de migrações" \
			"${copia_vazando}"
		afirmar_igual "(f) a cópia com o vazamento plantado é sintaticamente válida" "0" \
			"$(bash -n "${copia_vazando}" 2>/dev/null && echo 0 || echo 1)"
		afirmar_igual "(f) a cópia com o vazamento plantado entrega a cadeia inteira no argv do cliente" "1" \
			"$(grep -cF 'postgresql://${PAPEL_MIGRACAO}:${senha_migracao}@' "${copia_vazando}" || true)"
		afirmar_igual "(f) fora de 'psql_migrador', a cópia é idêntica ao original" "1" \
			"$([[ "$(sed '/^psql_migrador() {/,/^}/d' "${copia_vazando}" | sha256sum)" == \
				"$(sed '/^psql_migrador() {/,/^}/d' "${SCRIPT_MIGRAR}" | sha256sum)" ]] && echo 1 || echo 0)"

		local rastreio_vazando="${DIR_TEMPORARIO}/execve-vazando.txt"
		local codigo_vazando=0
		SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" strace -f -v -s 4096 -e trace=execve -o "${rastreio_vazando}" \
			bash "${copia_vazando}" >"${DIR_TEMPORARIO}/migracao-vazando.log" 2>&1 || codigo_vazando=$?
		nota "(f) a cópia com vazamento saiu com código ${codigo_vazando} (o desfecho dela não é o sujeito da asserção; o rastreio é)"
		afirmar_diferente "(f) com a cadeia no argv, a MESMA varredura no MESMO rastreio acusa a credencial" "0" \
			"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${rastreio_vazando}")"

		# O companheiro do `-v`, pelo mesmo molde e pelo OUTRO transporte proibido.
		#
		# O par acima prova que a varredura acusa o segredo no `argv`. Ele não prova
		# nada sobre o `-v`, porque `argv` aparece no rastreio de qualquer jeito. A
		# ADR-0005 proíbe DOIS transportes, e o segundo — variável de ambiente
		# exportada, visível em `/proc/PID/environ` — só é observável no rastreio com
		# `-v`. Sem este mutante, remover o `-v` de ambas as invocações deixaria a
		# bateria inteira verde e apagaria metade do invariante deste caso.
		local copia_exportando
		copia_exportando="$(caminho_no_espelho migrar-exportando-em-ambiente.sh)"
		exportar_senha_em_variavel_de_ambiente "${SCRIPT_MIGRAR}" >"${copia_exportando}"
		afirmar_copia_enxerga_migracoes \
			"(f) a cópia que exporta o segredo enxerga o diretório de migrações" \
			"${copia_exportando}"
		afirmar_igual "(f) a cópia que exporta o segredo é sintaticamente válida" "0" \
			"$(bash -n "${copia_exportando}" 2>/dev/null && echo 0 || echo 1)"
		afirmar_igual "(f) a cópia que exporta o segredo o coloca no ambiente do processo filho" "1" \
			"$(grep -cF 'export SYSLOC_SENHA_MIGRACAO="${senha_migracao}"' "${copia_exportando}" || true)"
		# Esta é a asserção que explica por que o `-v` faz falta: a auditoria estática
		# de (a) não alcança este transporte — o nome da variável não casa nenhum dos
		# quatro padrões —, então quem tem de acusá-lo é o rastreio, e só com `-v`.
		local estatico_no_exportando=0
		for indice in "${!PADROES_PROIBIDOS[@]}"; do
			estatico_no_exportando=$((estatico_no_exportando +
				$(contar_padrao_no_arquivo "${copia_exportando}" "${PADROES_PROIBIDOS[${indice}]}")))
		done
		afirmar_igual "(f) a auditoria estática de (a) NÃO alcança este transporte — só o rastreio com -v alcança" \
			"0" "${estatico_no_exportando}"

		local rastreio_exportando="${DIR_TEMPORARIO}/execve-exportando.txt"
		local codigo_exportando=0
		SYSLOC_BANCO_ALVO="${BANCO_VERIFICACAO}" strace -f -v -s 4096 -e trace=execve -o "${rastreio_exportando}" \
			bash "${copia_exportando}" >"${DIR_TEMPORARIO}/migracao-exportando.log" 2>&1 || codigo_exportando=$?
		nota "(f) a cópia que exporta saiu com código ${codigo_exportando} (o rastreio é o sujeito, não o desfecho)"
		afirmar_diferente "(f) com o segredo em variável EXPORTADA, a MESMA varredura no MESMO rastreio acusa a credencial" "0" \
			"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${rastreio_exportando}")"

		rm -f "${copia_vazando}" "${rastreio_vazando}" "${DIR_TEMPORARIO}/migracao-vazando.log"
		rm -f "${copia_exportando}" "${rastreio_exportando}" "${DIR_TEMPORARIO}/migracao-exportando.log"
	else
		aviso "(f) strace ausente no PATH — asserção dinâmica de argv PULADA (degradação declarada)"
		aviso "    instale 'strace' e execute a bateria de novo para cobrir esta asserção"
	fi

	remover_banco_descartavel "${BANCO_VERIFICACAO}"

	# (g) a árvore versionada não carrega a credencial ------------------------ #
	local achados codigo_varredura=0
	achados="$(printf '%s\n' "${credencial}" | varrer_arvore_versionada "${RAIZ_REPO}")" || codigo_varredura=$?
	afirmar_igual "(g) a varredura da árvore versionada não encontra a credencial" "0" "${codigo_varredura}"
	if [[ -n "${achados}" ]]; then
		falhar "(g) ocorrências na árvore versionada: ${achados}"
	fi

	# (h) prova de que a varredura de (g) não é oca --------------------------- #
	#
	# A agulha é SINTÉTICA, e isso é decisão de segurança, não simplificação: a
	# propriedade provada aqui é do MECANISMO — que a varredura acha o que existe
	# e omite o valor da saída —, jamais do segredo. Usar a credencial viva a
	# colocaria no `argv` de um `grep` e a plantaria em texto claro no clone.
	local agulha_sintetica="AGULHASINTETICADOCT032H"
	local clone="${DIR_TEMPORARIO}/clone-com-agulha-plantada"
	git -c "safe.directory=${RAIZ_REPO}" clone --no-hardlinks --quiet "${RAIZ_REPO}" "${clone}"
	printf 'AGULHA_PLANTADA_PELO_CT_032=%s\n' "${agulha_sintetica}" >"${clone}/plantado-pelo-ct-032.txt"
	git_em "${clone}" add plantado-pelo-ct-032.txt

	local achados_plantados codigo_plantado=0
	achados_plantados="$(printf '%s\n' "${agulha_sintetica}" | varrer_arvore_versionada "${clone}")" || codigo_plantado=$?

	afirmar_diferente "(h) com a agulha plantada, a varredura sai != 0" "0" "${codigo_plantado}"
	afirmar_igual "(h) a varredura acusa a ocorrência no formato arquivo:linha" "1" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cxF 'plantado-pelo-ct-032.txt:1' || true)"
	afirmar_igual "(h) a varredura NÃO imprime o valor encontrado" "0" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cF "${agulha_sintetica}" || true)"

	rm -rf "${clone}"
	unset credencial

	# (i) as constantes espelhadas continuam declaradas na origem -------------- #
	#
	# O cabeçalho deste arquivo prometia esta rede e ela não existia — e comentário
	# que mente sobre proteção instalada é pior que comentário nenhum: o próximo
	# agente confia nela. Aqui a promessa vira asserção.
	#
	# Por que a linha LITERAL e não o valor: ler o valor da origem e comparar com o
	# valor daqui aceitaria qualquer forma de declaração, inclusive uma que este
	# arquivo não saiba extrair; exigir a linha inteira, na forma canônica
	# `readonly NOME="valor"`, é o que faz a conferência falhar quando a origem
	# muda de qualquer maneira que importe.
	local espelho origem linha
	for espelho in "${ESPELHOS_DE_CONSTANTE[@]}"; do
		origem="${espelho%%|*}"
		linha="${espelho#*|}"
		afirmar_igual "(i) ${origem##*/} declara [${linha}]" "1" \
			"$(contar_linha_literal "${origem}" "${linha}")"
	done

	# O par que impede (i) de ser infalível: numa cópia com UM valor trocado, a
	# mesma conferência tem de acusar a divergência. Sem ele, uma expressão errada
	# (um `-x` esquecido, um escape a mais) devolveria 1 para sempre.
	local copia_derivada="${DIR_TEMPORARIO}/provisionar-com-constante-derivada.sh"
	sed "s|^readonly BANCO_DB=\"${BANCO_DB}\"\$|readonly BANCO_DB=\"${BANCO_DB}_derivado\"|" \
		"${SCRIPT_PROVISIONAR}" >"${copia_derivada}"
	afirmar_igual "(i) o mutante de constante foi de fato plantado na cópia" "1" \
		"$(contar_linha_literal "${copia_derivada}" "readonly BANCO_DB=\"${BANCO_DB}_derivado\"")"
	afirmar_igual "(i) com a constante trocada na cópia, a conferência acusa a divergência" "0" \
		"$(contar_linha_literal "${copia_derivada}" "readonly BANCO_DB=\"${BANCO_DB}\"")"
	rm -f "${copia_derivada}"

	# (j) a bateria se recusa a rodar contra a instalação que atende a operação #
	#
	# Pertence a ESTE caso porque é ele quem executa as operações que a guarda
	# existe para impedir: o CT-032 cria banco no cluster e roda `migrar-banco.sh`
	# duas vezes contra ele. É o mesmo pareamento do irmão provado
	# `verificar-provisionamento.sh`, onde o bloco equivalente mora no CT-002 — o
	# caso que reexecuta o provisionamento.
	#
	# CAUSA-RAIZ de ter faltado: a guarda foi escrita, colocada no lugar certo do
	# `main` e nunca asserida. É o terceiro defeito catalogado em
	# `.claude/rules/testing-stack.md`, na sua forma extrema — lá a asserção provava
	# o predicado, a posição e o texto mas não o aborto; aqui não havia asserção
	# alguma, e trocar o `exit 1` da recusa por `return 0` deixava a bateria criando
	# e removendo banco no cluster DEPOIS de anunciar que não faria isso.
	local marcador_falso="${DIR_TEMPORARIO}/marcador-de-producao-sintetico"
	rm -f "${marcador_falso}"
	afirmar_igual "(j) sem o marcador de produção, a bateria é liberada" "0" \
		"$(instalacao_liberada_para_bateria "${marcador_falso}" && echo 0 || echo 1)"
	: >"${marcador_falso}"
	afirmar_igual "(j) com o marcador de produção presente, a bateria é recusada" "1" \
		"$(instalacao_liberada_para_bateria "${marcador_falso}" && echo 0 || echo 1)"
	rm -f "${marcador_falso}"

	# A guarda precisa ser consultada ANTES do primeiro caso, senão ela não guarda
	# nada — o banco descartável já teria sido criado quando ela falasse.
	afirmar_igual "(j) o main consulta a guarda antes de executar o primeiro caso" "1" \
		"$(awk '/^\trecusar_bateria_em_producao$/ { guarda = NR }
			/^\tct_031$/ { primeiro = NR }
			END { print (guarda > 0 && primeiro > guarda ? 1 : 0) }' "${BASH_SOURCE[0]}")"
	afirmar_igual "(j) a mensagem de recusa cita a ADR-0006" "1" \
		"$(sed -n '/^recusar_bateria_em_producao() {/,/^}/p' "${BASH_SOURCE[0]}" |
			grep -c 'ADR-0006' || true)"

	# A asserção que prende a guarda ao EFEITO, e não aos seus arredores: as quatro
	# acima provam o predicado, a posição da chamada e o texto da mensagem. Nenhuma
	# prova a única coisa que a guarda promete — TERMINAR O PROCESSO.
	#
	# O processo é NOVO (`bash -c`), e não um subshell `( )`: `ARQ_MARCADOR_PRODUCAO`
	# é `readonly` neste arquivo, o atributo é herdado por subshell, e a reatribuição
	# falharia com código 1 — o que faria a asserção de "termina o processo" passar
	# pelo motivo errado, medindo o erro de atribuição em vez da guarda. Um processo
	# novo não herda o atributo, então o que se mede é o `exit` da própria função.
	executar_guarda_isolado() { # $1 = marcador a enxergar
		bash -c '
			ARQ_MARCADOR_PRODUCAO="$1"
			eval "$(sed -n "/^instalacao_liberada_para_bateria() {/,/^}/p" "$2")"
			eval "$(sed -n "/^recusar_bateria_em_producao() {/,/^}/p" "$2")"
			recusar_bateria_em_producao
		' _ "$1" "${BASH_SOURCE[0]}" >/dev/null 2>&1
	}

	local codigo_recusa=0
	: >"${marcador_falso}"
	executar_guarda_isolado "${marcador_falso}" || codigo_recusa=$?
	afirmar_diferente "(j) com o marcador presente, a recusa TERMINA o processo (código != 0)" \
		"0" "${codigo_recusa}"

	# Companheiro positivo: sem ele, a asserção acima passaria com uma guarda que
	# abortasse SEMPRE — e a bateria nunca mais rodaria em lugar nenhum.
	local codigo_liberado=0
	rm -f "${marcador_falso}"
	executar_guarda_isolado "${marcador_falso}" || codigo_liberado=$?
	afirmar_igual "(j) sem o marcador, a recusa devolve o controle e a bateria segue (código 0)" \
		"0" "${codigo_liberado}"

	unset -f executar_guarda_isolado

	fechar_caso "CT-032"
}

# =========================================================================== #
main() {
	exigir_privilegio

	local faltando=() ferramenta
	# `node` NÃO entra nesta lista: ele não está instalado no sistema, e sim sob o
	# diretório pessoal do usuário de trabalho, pelo gerenciador de versões — sob
	# `sudo` o PATH não o alcança. `localizar_runtime_node` o procura, e a ausência
	# dele reprova o CT-031 em vez de passar em silêncio: a guarda de cobertura é o
	# SUT do caso, não uma conveniência.
	for ferramenta in git psql runuser stat sha256sum install mktemp cp awk sed grep cmp diff; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: ferramenta obrigatória ausente do PATH: %s\n' "${faltando[*]}" >&2
		exit 1
	fi

	if [[ "${1:-}" == "cobertura" ]]; then
		if [[ -z "${2:-}" ]]; then
			printf 'ERRO: uso: %s cobertura <banco>\n' "$(basename "${BASH_SOURCE[0]}")" >&2
			exit 64
		fi
		subcomando_cobertura "$2"
	fi

	if [[ -n "${1:-}" ]]; then
		printf 'ERRO: subcomando desconhecido: %s\n' "$1" >&2
		printf '      uso: %s [cobertura <banco>]\n' "$(basename "${BASH_SOURCE[0]}")" >&2
		exit 64
	fi

	local arquivo
	for arquivo in "${SCRIPT_PROVISIONAR}" "${SCRIPT_MIGRAR}" "${SCRIPT_VERIFICAR_PROVISIONAMENTO}" "${MANIFESTO_DB}"; do
		if [[ ! -f "${arquivo}" ]]; then
			printf 'ERRO: arquivo obrigatório não encontrado: %s\n' "${arquivo}" >&2
			exit 1
		fi
	done

	# Depois do despacho de `cobertura` de propósito: apurar cobertura é leitura e
	# continua legítimo em qualquer instalação. O que se recusa é a BATERIA, que
	# cria banco no cluster e executa o script de migração.
	recusar_bateria_em_producao

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-verificar-migracao-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"

	printf 'Verificação da migração aplicada ao cluster real\n'
	printf '  repositório:      %s\n' "${RAIZ_REPO}"
	printf '  banco da operação: %s (somente leitura)\n' "${BANCO_DB}"
	printf '  banco descartável: %s (criado e removido por esta bateria)\n' "${BANCO_VERIFICACAO}"

	ct_031
	ct_032

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-migracao: %d/%d casos aprovados (CT-031, CT-032)\n' \
			"${casos_aprovados}" "${casos_executados}"
		exit 0
	fi
	printf 'verificar-migracao: %d falha(s) em %d caso(s) — REPROVADO\n' \
		"${falhas_totais}" "$((casos_executados - casos_aprovados))" >&2
	exit 1
}

main "$@"
