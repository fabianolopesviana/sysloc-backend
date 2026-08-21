#!/usr/bin/env bash
# ===========================================================================
# PREPARA O MATERIAL DO CERTIFICADO DO PROVEDOR para o runtime deste produto.
#
# ---------------------------------------------------------------------------
# POR QUE ESTE SCRIPT EXISTE — o achado é MEDIDO, em 2026-08-20
# ---------------------------------------------------------------------------
#
# O `.pfx` que a Autoridade Certificadora entrega costuma vir embalado com
# `RC2-40-CBC`. O OpenSSL 3 moveu esse algoritmo para o provider `legacy` e o
# recusa por padrão, de modo que o Node 24 (OpenSSL 3.5.7) falha ao abrir o
# material com `ERR_CRYPTO_UNSUPPORTED_OPERATION: Unsupported PKCS12 PFX data`.
#
# ⚠️ NÃO é defeito do certificado, e NÃO é senha errada. O mesmo arquivo era
# lido sem cerimônia pelo backend Frappe, que é Python sobre OpenSSL 1.1.x —
# ali RC2 é padrão, não legado. É consequência da troca de stack, e ela não
# aparece em teste: as suítes geram o material EM EXECUÇÃO
# (`gerarMaterialDeTeste`), e material gerado pelo Node nasce com cifra
# moderna. Só o material real do provedor exibe o defeito.
#
# ---------------------------------------------------------------------------
# O QUE ELE FAZ, e o que ele NÃO faz
# ---------------------------------------------------------------------------
#
# Reembala o PKCS#12 em cifra que o runtime aceita, PRESERVANDO o par
# certificado/chave: mesma AC, mesma validade, MESMO NÚMERO DE SÉRIE. O que
# muda é só o invólucro — o que viaja no TLS é o certificado e a chave, e o
# provedor não vê diferença.
#
# É IDEMPOTENTE por medição, não por convenção: se o runtime já abre o
# material, ele não faz nada. Rodar sempre é seguro, e é a conduta recomendada
# a cada renovação — não se tenta adivinhar o formato que a AC vai entregar.
#
# O arquivo ORIGINAL nunca é alterado nem removido.
#
# ---------------------------------------------------------------------------
# SEGREDO (ADR-0005 e ADR-0032)
# ---------------------------------------------------------------------------
#
# A senha é lida do terminal com eco desligado e trafega por DESCRITOR DE
# ARQUIVO — nunca por `argv`, nunca por variável exportada. A chave privada em
# claro existe apenas num PIPE entre dois processos: nada em claro toca o
# disco. O material novo nasce `0600` e usa a MESMA senha do original, para não
# criar um segundo segredo a guardar.
# ===========================================================================
set -uo pipefail

readonly ORIGINAL="${1:-/home/sysloc/certificado.pfx}"
readonly PREPARADO="${2:-${ORIGINAL%.pfx}-moderno.pfx}"
readonly PREFIXO="[preparar-material]"

info() { printf '%s ..     %s\n' "${PREFIXO}" "$1"; }
feito() { printf '%s FEITO  %s\n' "${PREFIXO}" "$1"; }
erro() { printf '%s ERRO   %s\n' "${PREFIXO}" "$1" >&2; }

# Devolve 0 se o RUNTIME DO PRODUTO abre o material — é a mesma chamada de
# `packages/cobranca-bancaria/src/leitura-do-material.ts`. Perguntar ao openssl
# em vez de ao Node mediria outro programa.
runtime_abre() {
  local arquivo="$1"
  printf '%s' "${SENHA}" | node --input-type=module -e '
    import { readFileSync } from "node:fs";
    import { createServer } from "node:https";
    const material = readFileSync(process.env.SYSLOC_ARQ_DO_MATERIAL);
    let senha = "";
    for await (const parte of process.stdin) senha += parte;
    try { createServer({ pfx: material, passphrase: senha }).close(); process.exit(0); }
    catch { process.exit(1); }
  ' 2>/dev/null
  # O caminho vai por ambiente por ser NOME DE ARQUIVO, não segredo; a senha,
  # essa, continua indo por entrada padrão.
}

identificacao() {
  local arquivo="$1" flag="${2:-}"
  # shellcheck disable=SC2086
  printf '%s' "${SENHA}" | openssl pkcs12 -in "${arquivo}" -nokeys -passin stdin ${flag} 2>/dev/null |
    openssl x509 -noout -subject -serial -dates 2>/dev/null
}

main() {
  [ -f "${ORIGINAL}" ] || { erro "material não encontrado: ${ORIGINAL}"; exit 1; }
  command -v node >/dev/null || { erro "node não está no PATH — ele é quem decide se o material serve"; exit 1; }

  read -r -s -p "Senha do material (não será exibida): " SENHA
  echo
  [ -n "${SENHA}" ] || { erro "senha vazia"; exit 1; }

  export SYSLOC_ARQ_DO_MATERIAL="${ORIGINAL}"
  if runtime_abre "${ORIGINAL}"; then
    feito "o runtime JÁ abre ${ORIGINAL} — nada a preparar"
    unset SENHA
    exit 0
  fi
  info "o runtime NÃO abre ${ORIGINAL}; reembalando em cifra aceita"

  if [ -e "${PREPARADO}" ]; then
    export SYSLOC_ARQ_DO_MATERIAL="${PREPARADO}"
    if runtime_abre "${PREPARADO}"; then
      feito "${PREPARADO} já existe e o runtime o abre — nada a fazer"
      unset SENHA
      exit 0
    fi
    erro "${PREPARADO} já existe e o runtime NÃO o abre — remova-o e rode de novo"
    unset SENHA
    exit 1
  fi

  umask 077
  if ! openssl pkcs12 -legacy -in "${ORIGINAL}" -passin fd:3 -nodes 3< <(printf '%s' "${SENHA}") |
    openssl pkcs12 -export -out "${PREPARADO}" -passout fd:4 4< <(printf '%s' "${SENHA}"); then
    erro "a reembalagem falhou — o material continua intacto em ${ORIGINAL}"
    rm -f "${PREPARADO}"
    unset SENHA
    exit 1
  fi
  chmod 600 "${PREPARADO}"

  # ⚠️ A prova de que é O MESMO certificado, e não um material qualquer que
  # abre: a identificação inteira tem de bater — titular, SÉRIE e validade.
  local antes depois
  antes="$(identificacao "${ORIGINAL}" -legacy)"
  depois="$(identificacao "${PREPARADO}")"
  if [ -z "${antes}" ] || [ "${antes}" != "${depois}" ]; then
    erro "o material preparado NÃO é o mesmo certificado — descartando"
    printf 'antes:\n%s\ndepois:\n%s\n' "${antes}" "${depois}" >&2
    rm -f "${PREPARADO}"
    unset SENHA
    exit 1
  fi

  export SYSLOC_ARQ_DO_MATERIAL="${PREPARADO}"
  if ! runtime_abre "${PREPARADO}"; then
    erro "o material foi reembalado mas o runtime continua sem abri-lo — descartando"
    rm -f "${PREPARADO}"
    unset SENHA
    exit 1
  fi
  unset SENHA

  feito "${PREPARADO} (0600) — mesmo certificado, cifra que o runtime aceita"
  printf '%s\n' "${depois}" | sed "s|^|${PREFIXO} ..     |"
  info "registre ESTE arquivo no produto; o original permanece intacto"
}

main "$@"
