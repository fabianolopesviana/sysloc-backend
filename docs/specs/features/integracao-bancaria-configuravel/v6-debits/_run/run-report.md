# Relatório do Run — integracao-bancaria-configuravel/v6-debits

> Relatório para revisão humana. Telemetria de pipeline vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **2/2 tasks concluídas** · 139 testes verdes (136 baseline + 3 novos)

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Tornar observáveis as chaves ignoradas do payload | sonnet → opus (retry) | 2 mod | ✅ APROVADO (2ª tentativa) | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Tornar o CT-039 auto-contido quanto a `frappe.local.response` | sonnet | 1 mod | ✅ APROVADO | — (gates=[qa]) |

**O que foi entregue** — os 2 débitos anotados na v5, ambos resolvidos:

- **D-001** (`best_practices`): `salvar_configuracao` continua aceitando qualquer chave no payload (o `**_ignorados` é contrato), mas as não reconhecidas passam a ser registradas por **nome** em `Error Log`. `cmd` — a única chave que o Frappe injeta incondicionalmente numa chamada `/api/method` — é filtrada, então chamada legítima não gera log. Nenhum valor do payload é registrado (RN-06).
- **D-002** (`tests`): `_BaseDecisaoTrocaTest.setUp` passa a zerar `frappe.local.response` e restaurar o valor anterior por `addCleanup`. O CT-039 deixou de depender da higiene de `test_boletos_abertos.py`.

## 2. Débitos Técnicos Não Resolvidos

> ✅ **Ambos foram resolvidos** em 2026-07-22, por correção direta (sem ciclo de gates), a pedido do usuário. Os blocos abaixo ficam como registro do que era o débito e de como foi fechado. Nenhum débito em aberto nesta versão.

### D1 · BAIXO · error_handling · T1 · Tech Review — ✅ RESOLVIDO (corrigido direto, fora do framework, 2026-07-22)
- **Onde:** `integracao_bancaria_api/service.py:876`
- **Problema:** o rastro de D-001 compartilha a transação da requisição e é descartado em rollback. `frappe.log_error(...)` é chamado sem `defer_insert`, então o insert acontece na transação corrente; se uma exceção ocorrer depois desse ponto, `handle_exception` faz `frappe.db.rollback()` e o registro some junto.
- **Impacto:** cenário estreito — nos caminhos-alvo de D-001 (chave desconhecida → sucesso, ou `_falha`/`requer_decisao`, que retornam dict e comitam) o log persiste normalmente. A perda só ocorre no caminho de exceção não tratada. Ainda assim é justamente na chamada que quebrou que o rastro sumiria.
- **O que fazer:** avaliar `defer_insert=True`. Atenção ao trade-off real: com ele o insert deixa de ser síncrono e CT-041/CT-043, que leem `Error Log` logo após a chamada, precisariam de flush explícito ou outro ponto de observação. Se não compensar, registrar a limitação em 1 linha no comentário do bloco (o rastro é best-effort dentro da transação) em vez de mudar o código.

### D2 · BAIXO · code_quality · T1 · Tech Review — ✅ RESOLVIDO (corrigido direto, fora do framework, 2026-07-22)
- **Onde:** `integracao_bancaria_api/service.py:877`
- **Problema:** o título do log — `"salvar_configuracao recebeu chave(s) desconhecida(s) no payload (D-001)"` — existe como literal em dois lugares: `service.py:877` (argumento `title=`) e `tests/test_integracao_bancaria_api.py:716` (`TITULO_LOG`), que filtra `Error Log` por `method` usando a cópia.
- **Impacto:** baixo e **não silencioso** — alterar o título só em `service.py` faz o helper voltar vazio e CT-041/CT-043 falharem em `assertEqual(len(novos), 1)`. Falha ruidosa, não teste verde falso. É custo de manutenção, não risco de correção.
- **O que fazer:** extrair o título para constante de módulo em `service.py` (ex.: `_TITULO_LOG_CHAVES_DESCONHECIDAS`) e importá-la no teste — mesma disciplina que o arquivo já aplica a `_ROTULOS_CONTA` e `_CHAVES_FRAMEWORK_IGNORAVEIS`.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

**O QA reprovou T1 na primeira tentativa por um motivo que vale registrar.** A implementação estava correta desde o início — o que não estava era a **prova**. O CT-043 assertava que o valor de `certificado_senha` não aparecia no log, mas `certificado_senha` é parâmetro **nomeado** da assinatura e por isso nunca entra em `**_ignorados`: a asserção passava por construção, não por corretude do código. O único valor que de fato atravessava o catch-all (`campo_typo`) tinha apenas asserção de presença do **nome**. A regressão mais provável de RN-06 — trocar o `join` de nomes por um dump `nome=valor` — passaria verde.

O executor corrigiu com o **teste de mutação** exigido: com o dump, CT-043 fica vermelho; sem ele, verde. Os dois gates confirmaram independentemente que a mutação foi revertida sem resíduo.

**Falha de instrumentação minha (orquestrador), apontada pelo Tech Review.** Eu afirmei aos dois gates que o diff working-tree-vs-index continha exatamente os 2 arquivos da task. Continha 3: o `v1/handoff-frontend.md` estava unstaged desde antes do run. O TR verificou por mtime e conteúdo que não era trabalho de T1 e não abriu desvio de escopo — mas a causa é real: minha checagem rodou `git diff --stat -- app-sync/`, filtrada por diretório, e seria cega a um arquivo criado fora dela. Corrigido a partir de T2 (`git status --porcelain` sem filtro).

**Em T2, o QA construiu a prova que o executor não tinha.** O executor demonstrou o isolamento rodando o módulo sozinho (21/21). Isso não prova nada: num processo novo `frappe.local.response` já começa limpo, então esse cenário passaria **antes** da mudança também. Encaminhei o ceticismo ao QA, que confirmou a lacuna e resolveu por conta própria — criou um probe temporário com duas subclasses do CT-039, uma sujando `frappe.local.response` **antes** do `setUp` e outra **depois** (simulando a ausência do fix). Resultado: falhou exatamente uma, a sem fix (`AssertionError: b'%PDF-SUJO' is not None`). Ficou provado que o débito era real e que a correção o elimina. O probe foi removido; conferi que não sobrou resíduo em `tests/`.

**Verificação de RN-06 que nenhum dos dois gates precisava fazer, e o TR fez.** Ele foi ao `frappe/utils/error.py:56` e encontrou que, se `message` fosse falsy, o Frappe capturaria o traceback **com contexto de variáveis locais** — o que dumparia `certificado_senha` e `_ignorados` inteiros no `Error Log`. Aqui é inalcançável (a mensagem é sempre o prefixo não-vazio concatenado), mas é o tipo de brecha que só aparece lendo o framework, não o diff.
