# Relatório do Run — saas-multi-empresa/v2-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **4/4 tasks concluídas** · suíte com placar idêntico ao oráculo (`Ran 169 tests · FAILED (failures=9, errors=161, skipped=1)`, vermelho pré-existente) · sem análise estática disponível no host (shellcheck ausente)

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Cleanup de evidência da T8 | sonnet | 1 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |
| T2 | Endurecer o predicado do `veredito_suite.sh` | sonnet | 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Fechar o `exit 1` espúrio e documentar a receita no portão | sonnet | 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T4 | Cleanup de evidência e inventário da T9 | sonnet | 1 mod | ✅ APROVADO | — (gates=[qa]) |

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado (severidade baixa não bloqueia). Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/saas-multi-empresa/v2-debits/`.

### D1 · baixo · documentation · T1 · QA
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md`
- **Problema:** um achado de severidade baixa foi registrado pelo Gate 1 da T1, mas **o detalhe não foi preservado** no log de telemetria pelo orquestrador — apenas a contagem.
- **Impacto:** o débito existe mas não é acionável como está; exige reler o `T8.md` para redescobrir o que era.
- **O que fazer:** ao rodar a próxima `/agent-spec-debt-resolution`, tratar como "revisar `T8.md` em busca de imprecisão de documentação remanescente" em vez de item específico. Falha de instrumentação do orquestrador, registrada na §4.

### D2 · BAIXO · code_quality · T2 · Tech Review
- **Onde:** `deploy/scripts/veredito_suite.sh:101`, `:125`, `:132` + §6 de `docs/specs/features/saas-multi-empresa/v2-debits/tasks/T2.md`
- **Problema:** os ponteiros que evitam duplicação de racional são **texto em prosa** ("secao CONTRATO, item (c)", "ver POLITICA DESTE SCRIPT"), não âncora estável.
- **Impacto:** um cleanup futuro pode renomear o título citado sem atualizar quem o cita; o resultado é ponteiro morto, sem erro de sintaxe, teste ou grep que acuse a quebra.
- **O que fazer:** trocar o título citado em prosa por marca literal dedicada (ex.: `# ANCORA: CONTRATO-C`, `# ANCORA: POLITICA-GREP`) nos blocos-fonte e nos ponteiros, sobrevivendo a reescritas de título.

### D3 · baixo · error_handling · T3 · QA — ✓ em cleanup (v3-debits)
- **Onde:** `deploy/scripts/portao_orfaos.py:388`
- **Problema:** o `finally: frappe.destroy()` executa depois de o `except Exception` já ter computado o retorno. Se `destroy()` levantar, o retorno é descartado e a exceção propaga — o Python sai **1**, que é o código reservado ao VERMELHO, sem nenhum `PORTAO_VEREDITO`.
- **Impacto:** é o mesmo modo de falha que o D-010 fechou, num caminho que a correção não cobre. **Pré-existente** (idêntico na versão anterior à task), probabilidade baixa (`destroy()` fecha conexões e reseta locals).
- **O que fazer:** envolver o corpo do `finally` — `try: frappe.destroy() except Exception: pass` — ou trocar por um `_invalida` de teardown, para que nenhum caminho de exceção do arquivo produza exit 1 sem veredito correspondente.

### D4 · baixo · documentation · T3 · QA
- **Onde:** `deploy/scripts/portao_orfaos.py:171`
- **Problema:** a citação do guard apresenta como uma linha só o que são duas (`delete_doc.py:78` tem o predicado `if not (...)`; o `frappe.throw(...)` está em `:79`), e omite o wrapper de tradução `_()` da chamada real.
- **Impacto:** puramente de precisão — o conteúdo semântico do argumento está correto e foi validado. Mas o arquivo declara explicitamente que suas citações são evidência auditável por comando; uma citação imprecisa enfraquece essa promessa.
- **O que fazer:** citar `delete_doc.py:78-79` (ou as duas linhas separadamente) e incluir o `_()` na chamada citada.

### D5 · baixo · documentation · T3 · QA
- **Onde:** `deploy/scripts/portao_orfaos.py:167`
- **Problema:** o parêntese de justificativa do passo 1 de REMOVER tem **15 linhas** de conteúdo técnico dentro de um item numerado de uma receita operacional que deveria ser seguida linearmente.
- **Impacto:** custo de usabilidade da precisão — quem segue a receita tropeça na justificativa antes de chegar no passo 2.
- **O que fazer:** mover a justificativa detalhada para nota após a lista REMOVER, mantendo no item 1 apenas a ação e uma referência curta à nota.

### D6 · BAIXO · error_handling · T3 · Tech Review — ✓ em cleanup (v3-debits)
- **Onde:** `deploy/scripts/portao_orfaos.py:383`
- **Problema:** o `except Exception` do corpo registra apenas `type(e).__name__` e `str(e)[:160]`, sem localização. Replica fielmente o padrão do bootstrap, mas o bootstrap protege ~4 linhas autoexplicativas enquanto o corpo protege ~130 (scan de DocTypes, `clear_controller_cache`, laço de `get_controller`, chamadas a `get_value`, montagem de baldes).
- **Impacto:** baixo — não compromete a corretude do veredito (exit 2 continua certo), apenas aumenta o esforço de diagnóstico, exigindo bissecção manual em vez de ir direto à linha.
- **O que fazer:** acrescentar ao texto de `_invalida` a última linha do traceback, via `traceback.extract_tb(e.__traceback__)[-1]` truncado, mantendo o resto do padrão inalterado.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

**O orçamento de tentativas foi estourado em duas tasks, com autorização explícita do usuário nas duas.** A T2 acumulou 4 rejeições de gate (3 QA + 1 Tech Review) contra um orçamento de 3; a T3 acumulou 5 (3 QA + 2 Tech Review). Em ambas o **código** foi aprovado cedo e ficou byte-inalterado — todas as rejeições foram de **prosa de comentário/docstring**, com afirmação técnica sobre o framework que não se sustentava na medição.

**O padrão dominante do run tem nome e contagem: "corrigi num lugar e não varri os vizinhos", 8 ocorrências.** Três delas originadas em instruções do orquestrador, não do executor. A mais instrutiva: exigi que cada afirmação sobre o framework fosse ancorada em `file:linha` — exigência que pegou uma afirmação falsa — e a própria exigência criou um acoplamento novo que o inventário do arquivo não cobria.

**Três falhas de verificação do orquestrador, registradas:**
1. Capturei `$?` depois de um pipe para `tail` ao medir os exit codes do portão — estava medindo o `tail`. Refeito.
2. Validei uma cadeia de sub-afirmações verdadeiras sem validar a **conclusão** que elas sustentavam (premissas certas, conclusão falsa sobre guard de `custom` no delete).
3. Conferi uma afirmação de **completude** com um padrão de busca que **pré-selecionava** os arquivos que eu já conhecia (`(delete_doc|doctype)\.py:`) em vez do genérico (`[a-z_]+\.py:`) — a consulta que só podia confirmar, não a que podia refutar. Foi o mesmo método que eu havia prescrito ao executor duas mensagens antes.

**O que quebrou o ciclo não foi mais cuidado — foi trocar o método de medição.** Três técnicas fecharam achados que rodadas de oráculo não fechavam: (a) **diferencial contra a versão do index** (`git show :arquivo`), que revelou perda de cobertura fora do contrato dos casos de teste; (b) **injeção seletiva de falha** por chamada de `grep`, provando que cada uma falha fechada individualmente; (c) **prova por hash** (AST sem docstring; linhas executáveis) em vez de reauditoria, o que permitiu de-escalar gates de opus para sonnet com segurança.

**Uma prova nova nasceu no run e vale para o projeto:** `python3 -W error::SyntaxWarning -c "ast.parse(...)"`. Ela pegou um escape inválido (`\.` em docstring não-raw) que teria feito o portão escrever no stderr quando o contentor migrar de Python 3.11 para 3.12+. Vale para qualquer docstring que passe a conter padrão de regex.

**Falha de instrumentação minha:** o detalhe do débito baixo da T1 não foi preservado no log (ver D1). Registrei apenas a contagem, o que torna o débito não-acionável sem releitura.

**Duas lacunas de ferramental, registradas por decisão explícita do usuário de não abrir débito agora:** não há harness de teste versionado para os predicados de `deploy/scripts/` (a prova dos 11 casos do `veredito_suite.sh` e dos 4 estados do `portao_orfaos.py` existe como saída colada, que ninguém reexecuta), e não há shellcheck no host.
