# Relatório do Run — contencao-credencial-exposta/v3-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, paralelismo, escolha de executor) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **2/2 tasks concluídas** · **169 testes verdes** · **ambas aprovadas na primeira tentativa** · zero retry

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Teste de wiring do `after_migrate` (D-001) | sonnet | 0 criados, 1 mod | ✅ APROVADO | — (gates=[qa]) |
| T2 | Delimitar o escopo da falha na ADR-0003 (D-003) | sonnet | 0 criados, 1 mod | ✅ APROVADO | — (gates=[qa]) |

Primeiro run desta feature sem nenhuma rejeição de gate. A `v1` precisou de 2 tentativas na TC-001; a `v2-debits` precisou de 3 na T1.

### O que foi entregue

**T1 — a rede regressiva que faltava.** O `after_migrate` registrado em `hooks.py` é o único mecanismo que impede permissão residual de sobreviver no papel `Servico App` — cuja credencial de API está publicada no bundle por desenho. Até agora, apagar essa linha deixaria os 168 testes verdes. O CT novo resolve o dotted path pelo **mesmo mecanismo do framework** (`frappe.get_hooks` + `frappe.get_attr`, como `frappe/migrate.py:145-147`), semeia um `Custom DocPerm` residual e chama a **função resolvida** — não o import direto. Isso cobre a cadeia inteira: `hooks.py` → `get_hooks` → `get_attr` → função convergente.

**T2 — a delimitação que faltava na ADR.** A subseção "Veículo de imposição" dizia corretamente o que o `patches.txt` **não** faz, mas não o que ele **continua** fazendo. A leitura natural ("patches.txt é vestigial") tensionava a ADR-0002 e podia levar alguém a mover uma migração one-shot não-idempotente para o `after_migrate` — o inverso exato do erro que a `v2-debits` corrigiu.

### Qualidade da validação

**O QA de T1 fez mutation testing manual.** Não aceitou a afirmação de falsificabilidade do executor: mutou `hooks.py` e o patch (com backup e restauração byte-a-byte, diff vazio confirmado) e verificou os três modos de falha um a um. Achado relevante do modo 3 (função renomeada): a detecção acontece por `ImportError` na coleção do módulo inteiro, porque o topo do arquivo já importa `execute` para os outros 14 CTs — blast radius maior que o descrito no card, mas a Iron Law #1 permanece satisfeita. Propriedade estrutural pré-existente, fora do escopo desta task.

**O QA de T2 verificou a precisão factual na fonte.** Foi a `frappe/installer.py:498-504` e `frappe/modules/patch_handler.py:54-76` confirmar que a frase nova descreve o comportamento real — `set_all_patches_as_completed` cobre apenas os patches presentes **no instante da instalação**; um patch acrescentado depois fica fora do `Patch Log` e roda normalmente. A frase não trocou uma imprecisão por outra, que era o risco.

## 2. Débitos Técnicos Não Resolvidos

✅ **Nenhum débito técnico anotado neste run.** Ambos os QAs retornaram `APROVADO` com zero problemas em todas as severidades.

Um candidato a regra foi emitido (não é débito): `repeated_fixture` — o dict de semeadura do `Custom DocPerm` residual foi copiado do CT-063 para o CT-064. Registrado em `_run/rule-candidates.md` para curadoria futura.

> **Débitos herdados que continuam abertos** (fora do escopo desta rodada, com endereço declarado): da `v2-debits`, o **D-002** (invariante permanente ancorada em `patches/v1_0/`) → `saas-multi-empresa` v2. Da `v1`, cinco débitos (`allow_guest` sem `limit_req`, regex da allowlist, contagem "15 métodos", `setUp` no site de produção, helper replicado) → F2, F3 ou curadoria de regra.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

### Decisão sua neste run

**Commit da `v2-debits` para resetar o baseline** — mesma situação da rodada anterior: a versão anterior estava staged sem commit, e as duas tasks desta versão tocam exatamente dois dos arquivos que ela modificou. Commit `7a53158`.

### Falha minha de execução, registrada

Anunciei o despacho paralelo de T1 e T2 mas emiti apenas o `Agent` de T1; despachei T2 em seguida. **Os guards de paralelismo estavam satisfeitos** (paths disjuntos, DAG independente, símbolos `N/A`, nenhum de alta contenção) — a serialização não foi decisão técnica, foi erro meu. Custo: wall-clock. Nenhum efeito sobre o resultado.

Já os **QAs** foram serializados deliberadamente: a letra do guard exige ≥2 tasks com testes não-vazios e só T1 tem, mas o QA de T2 também executa a suíte completa, e a suíte roda contra o site de **produção**. O QA da `v2-debits` registrou um `Custom DocPerm` residual causado por sessão concorrente — evidência empírica suficiente para não arriscar.

### O encadeamento de cleanups fecha aqui

Esta foi a **terceira versão consecutiva** da feature: `v1` → `v2-debits` → `v3-debits`. Diferente das anteriores, **este run não gerou débito novo** — o encadeamento converge naturalmente.

O `intent.md §7` já registrava: se surgisse uma `v4-debits`, valeria parar. Não surgiu. O único débito remanescente da linhagem (D-002, mover o módulo de `patches/v1_0/` para local permanente) tem endereço declarado em `saas-multi-empresa` v2, que vai mexer em papéis e paths naquela área de qualquer forma.

### Fase B da TC-001 continua retida

Nada neste run tocou produção. A credencial `bc237221b65b5ed` do `Administrator` **segue válida**, os 3 `.map` seguem publicados, `developer_mode` segue em 1 e os 6 dumps seguem na raiz de `/opt/frappe`. É o que falta para a contenção original estar completa.
