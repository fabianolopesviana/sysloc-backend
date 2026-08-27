#!/usr/bin/env bash
#
# Grava a credencial do GitHub Packages em ~/.npmrc, sem que o segredo passe por `argv`,
# pelo histórico do shell ou pelo ambiente.
#
# Uso:  bash deploy/scripts/publicacao/autenticar-registry.sh
#
# ⚠️ NÃO recebe o token como argumento, e isso é decisão, não esquecimento: a ADR-0005 proíbe
#    credencial em `argv`, e `argv` é legível por qualquer processo do host enquanto o comando roda.
#
# DECISÃO FECHADA — intervenção dirigida · 2026-08-27
# O QUÊ: a leitura do PAT mora AQUI, e o operador nunca digita uma linha de `read`.
# POR QUÊ: o roteiro pedia `read -rs -p '…' SEU_PAT` digitado à mão. O último argumento é o NOME
#          da variável, e colar o segredo naquela posição é sintaticamente VÁLIDO — não dá erro,
#          cria uma variável com o nome do token, e grava um `_authToken=` vazio. Aconteceu em
#          2026-08-27, e custou a queima de um PAT com `write:packages` + `repo`.
# REVERTER EXIGE: provar que existe forma de o operador informar o segredo sem que o nome da
#                 variável apareça como campo preenchível na linha que ele digita.
set -euo pipefail

readonly REGISTRY='npm.pkg.github.com'
readonly ARQUIVO="${HOME}/.npmrc"

limpar() { unset -v token 2>/dev/null || true; }
trap limpar EXIT INT TERM HUP

printf 'Cole o PAT com escopo write:packages e tecle Enter.\n'
printf 'A digitação NÃO aparece na tela, e o valor não vai para o histórico.\n\n'
printf 'PAT: '
IFS= read -rs token
printf '\n'

# A recusa é o que separa "gravou o segredo" de "gravou vazio e seguiu em frente".
if [[ -z "${token}" ]]; then
	printf 'ABORTADO: nada foi digitado. O arquivo não foi tocado.\n' >&2
	exit 1
fi
if [[ ! "${token}" =~ ^(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})$ ]]; then
	printf 'ABORTADO: o valor digitado não tem forma de PAT do GitHub.\n' >&2
	printf '          Esperado `ghp_` + 36 caracteres, ou `github_pat_…`.\n' >&2
	printf '          O arquivo NÃO foi tocado.\n' >&2
	exit 1
fi

# Nasce 0600, e não vira 0600 depois: a umask deste host é 0002, e um `>>` num arquivo
# inexistente o criaria 0664 — o token viveria legível pelo grupo até o `chmod` seguinte.
# ⚠️ `install -m 600 /dev/null "${ARQUIVO}"` foi tentado e RECUSADO: ele TRUNCA o existente.
( umask 077; [[ -e "${ARQUIVO}" ]] || : > "${ARQUIVO}" )
chmod 600 "${ARQUIVO}"

# Substituição idempotente: sem isto, reexecutar com um PAT novo EMPILHA duas linhas de token.
# Sem temporário de propósito — `printf` de uma substituição TRUNCA o original e por isso
# PRESERVA o modo 0600. Um `> ~/.npmrc.novo` nasceria sob a umask ambiente carregando os tokens
# de OUTROS registries, e sobreviveria a uma interrupção.
printf '%s\n' "$(grep -v "^//${REGISTRY}/:_authToken=" "${ARQUIVO}")" > "${ARQUIVO}"
printf '//%s/:_authToken=%s\n' "${REGISTRY}" "${token}" >> "${ARQUIVO}"

printf 'gravado em %s\n' "${ARQUIVO}"
printf '  modo:            %s (esperado 600)\n' "$(stat -c '%a' "${ARQUIVO}")"
printf '  linhas de token: %s (esperado 1 — nunca acumula)\n' "$(grep -c '_authToken' "${ARQUIVO}")"
