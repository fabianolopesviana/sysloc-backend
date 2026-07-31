# Relatório do Run — integracao-bancaria-configuravel/v5

> Relatório para revisão humana. Telemetria de pipeline vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **2/2 tasks concluídas** · 136 testes verdes (124 baseline + 12 novos) · **1 tentativa cada**

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Expor apuração e resumo do consolidado (RN-09/CA-10) | sonnet | 2 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T2 | Decisão explícita na troca com boletos em aberto (RN-08/CA-08) | opus | 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

**O que foi entregue** — dois requisitos que estavam no `tech_spec.md` da v1 e não haviam sido implementados:

- **RN-09 / CA-10**: `apurar_boletos_abertos` (`{total, identificadores}`) e `resumir_consolidado_boletos_abertos` (`{total, disponiveis, ausentes}`), ambos whitelisted e exigindo System Manager. O streaming de `baixar_consolidado_boletos_abertos` ficou **byte-a-byte inalterado**.
- **RN-08 / CA-08**: o fluxo de decisão em `salvar_configuracao`, com as três opções literais da spec (`aceitar`, `nao_aceitar`, `aceitar_com_consolidado`), o retorno `{success: False, requer_decisao: True, total_abertos, opcoes, message}` e a mensagem byte-a-byte de `tech_spec.md:516`.

Com isso, as duas [DÚVIDA] bloqueantes do handoff frontend deixam de existir.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado. Resolva com `/agent-spec-debt-resolution docs/specs/features/integracao-bancaria-configuravel/v5/`.

### D1 · BAIXO · best_practices · T2 · Tech Review — ✓ em cleanup (v6-debits)
- **Onde:** `integracao_bancaria_api/service.py:790`
- **Problema:** `salvar_configuracao` mantém `**_ignorados`. A correção resolve o caso de `decisao` (virou parâmetro nomeado, então o catch-all não o captura mais e valor inválido é recusado), mas o catch-all **segue mudo para qualquer outro nome**. Um cliente que envie `decisao_troca`, `decisão` (com acento) ou `numero_conta` (typo) recebe sucesso normal sem efeito.
- **Impacto:** baixo e latente — nenhum comportamento atual está errado. O custo é diagnóstico: **foi exatamente esse silêncio que produziu a falha da v1** e consumiu quatro versões até a auditoria do handoff descobri-la.
- **O que fazer:** manter o catch-all por compatibilidade, mas logar as chaves não reconhecidas — `if _ignorados: frappe.logger().warning(...)`, filtrando as de framework (`cmd`, `csrf_token`). Converte falha silenciosa em falha observável, sem mudar contrato.

### D2 · BAIXO · tests · T2 · QA — ✓ em cleanup (v6-debits)
- **Onde:** `tests/test_integracao_bancaria_api.py:636`
- **Problema:** a prova de que nenhum PDF foi gerado usa `assertIsNone(frappe.local.response.get("filecontent"))`, mas `frappe.local.response` é estado **global do processo** e o teste não o inicializa no próprio `setUp`. Hoje passa em qualquer ordem só porque `test_boletos_abertos.py:274` o restaura via `addCleanup`.
- **Impacto:** acoplamento latente entre arquivos. Se um teste futuro escrever ali sem cleanup, este caso falha por motivo alheio ao SUT.
- **O que fazer:** inicializar `frappe.local.response = frappe._dict()` no `setUp` de `_BaseDecisaoTrocaTest` com `addCleanup` restaurando — mesmo padrão de `test_boletos_abertos.py:272-274`.

## 3. Tasks Bloqueadas

✅ **Nenhuma task bloqueada.** Ambas aprovaram na primeira tentativa.

## 4. Notas para Revisão Humana

**Esta versão existe porque a rastreabilidade por ID falhou.** A matriz da v1 mapeava `CA-08 → CT-019`, e um `CT-019` existia — testando a apuração do filtro RN-02, não os três caminhos de decisão. O identificador foi reaproveitado, a matriz ficou verde apontando para o teste errado, e o requisito atravessou 13 gates sem ser cobrado. Os gates validam a task que recebem; nenhuma task da v1 pediu o fluxo de decisão.

É a **segunda** colisão de ID nesta feature (a primeira foi CT-030, na v3). As tasks da v5 exigiram grep antes de escolher — CT-037/038 e CT-039/040 foram verificados livres, e a colisão histórica está registrada nos cabeçalhos de rastreabilidade.

**O QA auditou a ordem no código, não pelos testes** — e explicou por quê: `FrappeTestCase` roda em transação com rollback, então um commit indevido **não apareceria** no resultado dos testes. Foi assim que a v4-debits quase deixou passar um pendente parcial commitado. A sequência confirmada: `_exigir_system_manager` → `_nome_ativa` → validações puras → bloco RN-08 → **só então** `_preparar_pendente`, o primeiro ponto que escreve.

**O Tech Review reforçou o argumento do executor com um dado que ele não tinha usado.** Sobre `aceitar_com_consolidado` ser sinônimo de `aceitar`: o `tech_spec.md:290` não apenas põe o download no cliente — ele manda o cliente, **após baixar**, chamar `salvar_configuracao` com `decisao=aceitar`. A spec nunca previu que `aceitar_com_consolidado` chegasse ao backend. Tratá-lo como sinônimo é a única leitura coerente, já que a resposta `opcoes` publica os três valores e recusar um deles se contradiria.

**Divergência entre os gates, resolvida a favor do executor.** O `tests/test_certificado_api.py` foi tocado fora da §3.2 (6 chamadas ganharam `decisao="aceitar"`). Encaminhei ao Tech Review como candidato a `scope_deviation`; ele **discordou** e foi direto ao ponto: *"desvio de escopo é surface area nova ou trabalho não pedido; isto é o oposto — é o custo mínimo de não deixar a suíte quebrada. O defeito real está na §3.2 da task, que não mapeou os call sites."* Concordo: a falha foi minha ao escrever a task, não do executor.

**Observação de processo**: o executor de T2 fez `git add` por conta própria — o stage é responsabilidade do orquestrador. Sem impacto no código, mas mudou a estratégia de diff dos gates (passou a exigir `git diff a0cfa67`, trazendo T1+T2 juntas).

**2 sinais de rule mining** persistidos: `repeated_fixture` × 2 (helper `_criar_usuario` duplicado; `decisao="aceitar"` replicado em 14 chamadas).

## 5. Pós-merge (fora do run)

1. **Atualizar `v1/handoff-frontend.md`** — as [DÚVIDA] #1 e #6 deixam de ser bloqueantes; o bloco 12 muda; as fixtures do fluxo de decisão passam a existir; três endpoints novos entram no contrato.
2. Avaliar se a matriz de rastreabilidade da v1 (`CA-08 → CT-019`) deve ser corrigida — o ID aponta hoje para outro contrato.
