#!/usr/bin/env bash
#
# Gancho de `PostToolUse` que mantém o roadmap em dia sozinho.
#
# Recebe na entrada padrão o JSON que o Claude Code entrega ao gancho, decide se o arquivo escrito é
# um estado de pipeline (`_run/*state.yaml` sob `docs/specs/features/`) e, só nesse caso, roda o
# atualizador do roadmap. Para qualquer outro arquivo ele sai em silêncio e sem custo.
#
# ## Por que um invólucro em vez do comando direto no `settings.json`
#
# Três razões, todas práticas:
#
#   1. **`jq` não está instalado neste host.** O padrão que a documentação de ganchos sugere depende
#      dele para extrair o caminho do JSON; aqui o parse é feito por `python3`, que existe e é
#      confiável com escape de aspas — coisa que um `grep` sobre JSON não é.
#   2. **O comando fica testável.** Um invólucro se executa à mão com uma entrada sintética; uma
#      linha longa dentro do JSON de configuração, não.
#   3. **O `settings.json` fica legível.** Quem abrir aquele arquivo lê o que o gancho faz, não uma
#      linha de 300 caracteres.
#
# ## Sobre falhar em silêncio
#
# O gancho **nunca** interrompe o fluxo: qualquer erro sai como aviso e o código de saída é sempre 0.
# Um roadmap desatualizado é um incômodo; um gancho que bloqueia a escrita de um arquivo de estado no
# meio de um run é um estrago.

set -uo pipefail

DIRETORIO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATUALIZADOR="$DIRETORIO/atualizar-roadmap.sh"

# O caminho do arquivo tocado, ou vazio se a entrada não trouxer nenhum.
#
# `tool_input.file_path` é o que `Write` e `Edit` trazem; `tool_response.filePath` é a forma que
# algumas respostas usam. Tentamos os dois, nessa ordem, e devolvemos vazio em vez de quebrar quando
# a entrada não é o que se espera.
caminho_do_arquivo() {
  python3 -c '
import json, sys

try:
    entrada = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)

if not isinstance(entrada, dict):
    sys.exit(0)

for chave, campo in (("tool_input", "file_path"), ("tool_response", "filePath")):
    bloco = entrada.get(chave)
    if isinstance(bloco, dict) and isinstance(bloco.get(campo), str):
        print(bloco[campo])
        break
' 2>/dev/null || true
}

main() {
  local caminho
  caminho="$(caminho_do_arquivo)"

  # Nada a fazer se não veio caminho, ou se ele não é um estado de pipeline. O casamento é sobre o
  # sufixo `state.yaml` dentro de `docs/specs/features/`, que cobre tanto `sdd_state.yaml` quanto
  # `minispec_state.yaml` sem depender de qual framework a fatia usou.
  if [[ -z "$caminho" ]]; then
    exit 0
  fi

  if [[ ! "$caminho" =~ docs/specs/features/.*state\.yaml$ ]]; then
    exit 0
  fi

  if [[ ! -x "$ATUALIZADOR" && ! -f "$ATUALIZADOR" ]]; then
    echo "gancho do roadmap: atualizador não encontrado em $ATUALIZADOR" >&2
    exit 0
  fi

  if bash "$ATUALIZADOR" >/dev/null 2>&1; then
    printf '{"systemMessage":"Roadmap atualizado — o estado de uma fatia mudou.","suppressOutput":true}\n'
  else
    echo "gancho do roadmap: o atualizador falhou; o roadmap pode estar defasado" >&2
  fi

  exit 0
}

main "$@"
