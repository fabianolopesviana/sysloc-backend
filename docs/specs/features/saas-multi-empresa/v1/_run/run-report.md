# Relatório do Run — saas-multi-empresa/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: 1 task concluída · 1 concluída parcial (sem aprovação de gate, por decisão do usuário) · 1 bloqueada · 7 não iniciadas

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T8 | Remover o ambiente de homologação obsoleto e medir a folga de disco | opus | 0 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |
| T9 | Subir a stack nova isolada, com banco vazio (**parcial**) | opus | 3 criados, 1 mod | ❌ REJEITADO (8ª rodada) | ❌ REJEITADO (4ª rodada) |
| T1 | Validar a premissa da convergência e versionar o cadastro piloto | opus | 3 criados, 1 mod | ✅ APROVADO (8ª rodada) | ❌ REJEITADO |

**A T9 foi aceita como parcial sem aprovação de nenhum gate**, por decisão explícita do usuário após 8 rodadas. Os **9** achados abertos da T9 estão na §2 como débito (D4–D12), somados aos 3 da T8 (D1–D3) — **12 no total**. Isso não é aprovação de gate.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado e, no caso da T9, por decisão de aceitação. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/saas-multi-empresa/v1/`.

### D1 · baixo · documentation · T8 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md:343`
- **Problema:** a §7.9 conta "15 volumes anônimos, todos sem contêiner associado"; são 16, e 2 **não** são órfãos.
- **Impacto:** a seção projeta uma limpeza futura; um seletor sobre a premissa "é anônimo" alcançaria dois volumes em uso.
- **O que fazer:** corrigir a contagem e registrar que a limpeza deve filtrar por `docker volume ls --filter dangling=true`.

### D2 · baixo · documentation · T8 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md:99`
- **Problema:** o cabeçalho da §7.A promete saídas "coladas na íntegra", mas vários blocos têm anotações e comandos elididos.
- **Impacto:** nenhum fato muda, mas a evidência do estado *antes* é irrecuperável e é a promessa de literalidade que a sustenta.
- **O que fazer:** colar a saída crua com anotações fora do bloco; não elidir comandos.

### D3 · baixo · documentation · T8 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md:167`
- **Problema:** a conferência pré-destrutiva do Server Script provou **existência**, não **conteúdo** — sendo o conteúdo o que se perderia.
- **Impacto:** a decisão foi materialmente correta (o campo `script` tem 21031 caracteres), mas o rigor ficou aquém numa operação irreversível.
- **O que fazer:** em conferência pré-destrutiva, interrogar exatamente a propriedade cuja perda é irreversível.

### D4 · MEDIO · documentation · T9 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:59` (e o checklist na `:1302`)
- **Problema:** a §5.1 e o checklist §8 listam **dois** arquivos criados; a task cria **três** — falta `deploy/scripts/veredito_suite.sh`.
- **Impacto:** não é artefato oculto (está em §7.A.19 com justificativa), mas a §5.1 é a lista que a **Camada 0 de qualquer gate futuro** lê para cruzar declarado × entregue. Sem linha lá, o script fica sem task de origem rastreável.
- **O que fazer:** acrescentar a linha na tabela §5.1 com a justificativa da promoção, e corrigir o checklist para enumerar os três arquivos.

### D5 · baixo · documentation · T9 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `deploy/scripts/veredito_suite.sh:25` (e `T9.md:1250`)
- **Problema:** a justificativa da promoção cita "arquivo temporário" que a implementação **não usa** (`grep mktemp|/tmp|trap` vazio).
- **Impacto:** a justificativa substantiva (três condições + eliminar sincronização) permanece válida; a menção falsa convida o leitor a procurar mecanismo inexistente.
- **O que fazer:** remover "com arquivo temporario" das duas ocorrências.

### D6 · baixo · error_handling · T9 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `deploy/scripts/veredito_suite.sh:62`
- **Problema:** o `-a` do grep da linha 57 não foi replicado no grep que monta o motivo.
- **Impacto:** com byte inválido no fluxo, o VERMELHO sai **sem motivo** e vaza `binary file matches` no stderr. O exit code está correto; o dano é de diagnóstico, no cenário em que o humano mais precisa do motivo.
- **O que fazer:** trocar `grep -E` por `grep -aE` na linha 62.

### D7 · baixo · logic · T9 · QA — ✓ em cleanup (v2-debits)
- **Onde:** `deploy/scripts/veredito_suite.sh:61`
- **Problema:** a condição (c) ancora `FAILED`/`NO TESTS RAN` em início de linha — um prefixo escapa da guarda.
- **Impacto:** o QA **tentou e não conseguiu** construir falso-verde plausível (exigiria `^OK` limpo *e* `FAILED` escondido ao mesmo tempo). A guarda composta se sustenta; o que fica é âncora mais frágil do que o cabeçalho declara.
- **O que fazer:** buscar o placar de falha em qualquer posição da linha, sobre o fluxo bruto, e atualizar a linha 34 do cabeçalho.

### D8 · MEDIO · documentation · T9 · QA (rodada 6) — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:1239`
- **Problema:** a §7.A.20 diz "Cinco variações" sobre uma tabela de **seis** linhas, e a conclusão ("mudar a classe fechou o problema") está superdeclarada — as rodadas 7 e 8 produziram a sétima e a oitava variação.
- **Impacto:** é a seção que a T2 herda como aprendizado. Publicada assim, ensina que o problema acabou.
- **O que fazer:** corrigir a contagem, acrescentar as variações 7 e 8, e reescrever a conclusão: a mudança de classe fechou **uma** superfície (o portão); as demais dependem de sincronização manual entre artefatos.

### D9 · MEDIO · documentation · T9 · QA (rodada 6) — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:1243`
- **Problema:** as correções de bootstrap e piso não têm seção §7.A própria; o checklist remete a §7.A.16/§7.A.19, que não contêm as medições.
- **Impacto:** afirmação sem seção que a sustente, num artefato cujo valor é evidência auditável.
- **O que fazer:** abrir seção com as medições literais dos caminhos de `RODADA_INVALIDA` e corrigir a referência do checklist.

### D10 · baixo · error_handling · T9 · QA (rodada 6) — ✓ em cleanup (v2-debits)
- **Onde:** `deploy/scripts/portao_orfaos.py` (bloco `try/finally` do corpo)
- **Problema:** o bootstrap foi protegido, o **corpo** não — exceção não prevista escapa e o Python sai 1, código reservado ao VERMELHO.
- **Impacto:** falha fechada (bloqueia o migrate), por isso baixo. Mas a máquina de `RODADA_INVALIDA` existe para essa distinção.
- **O que fazer:** acrescentar `except Exception` ao bloco do corpo, retornando `RODADA_INVALIDA`, preservando o `finally: frappe.destroy()`.

### D11 · baixo · documentation · T9 · QA (rodada 6) — ✓ em cleanup (v2-debits)
- **Onde:** `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:1188` e `:613`
- **Problema:** as frases "não há mais mapa publicado em lugar nenhum" e "não há mapa publicado aqui de propósito" são desmentidas por blocos 2 e 10 linhas abaixo, respectivamente.
- **Impacto:** quem grepar por IP encontra a afirmação contradita no mesmo arquivo.
- **O que fazer:** trocar por afirmação verificável (nenhum mapa como *estado atual*; capturas datadas acompanhadas do comando que as deriva).

### D12 · baixo · documentation · T9 · QA (rodadas 6 e 7) — ✓ em cleanup (v2-debits)
- **Onde:** `deploy/scripts/portao_orfaos.py` (docstring, teste de falsificabilidade) e `T9.md:571`, `:1062`, `:1101`
- **Problema:** a receita de plantio/remoção do órfão sintético não está no docstring, e as três amostras de saída publicadas não têm o campo `piso em vigor`.
- **Impacto:** o docstring manda plantar um órfão e não diz como removê-lo — e a limpeza incompleta já aconteceu duas vezes neste run.
- **O que fazer:** registrar a receita completa (ver §4, "A receita de limpeza") e atualizar as três amostras.

## 3. Tasks Bloqueadas

### T1 — BLOQUEADA após 8 tentativas

- **Onde parou:** Gate 1 aprovou (6/6, zero problemas). Gate 2 retornou `REJEITADO` com CRÍTICO.
- **O CRÍTICO:** a ordem operacional do contrato **apagaria os 13 cadastros de `tabDocType`**. Os 13 têm hoje duas proteções (`custom=1` os mantém fora do filtro do `remove_orphan_doctypes`; `import_controller` devolve `Document` sem tocar no módulo enquanto `custom` for truthy). O passo 1 do contrato remove as duas ao mesmo tempo.
- **A causa estrutural:** a base empírica da T1 **excluía `bench migrate`**. Oito rodadas substituíram, por inspeção de código, um experimento que ela não podia fazer contra produção.
- **Estado atual — mudou:** o ambiente destrutível **existe** e o experimento **foi feito** (ver §4). A T1 pode ser revalidada com observação em vez de inferência, e o portão anti-órfão está pronto para ser rodado antes de qualquer migrate.
- **Próximo passo:** decisão do usuário sobre reabrir a T1 com os dados novos.

### Tasks não iniciadas

T2, T3, T4, T5, T6, T7 e T10. **T2 e T3 não devem começar** antes de a T1 fechar — a T2 consome o contrato em disputa. T4 é independente e destrava T5/T6/T7. T10 é independente, mas **não é coberta pelo ambiente novo** (escreve em `/etc/cron.d` e `/var/log` do host).

## 4. Notas para Revisão Humana

### O que o run entregou de mais valioso

**O experimento que oito rodadas de inferência não conseguiram produzir.** O `bench migrate` rodou pela primeira vez, e o comportamento do `remove_orphan_doctypes` foi observado — duas vezes de forma independente, com registro-sentinela:

- Um DocType `custom=0` sem controller **tem a definição apagada**. Confirma o CRÍTICO da T1.
- **Mas só a definição some** — a tabela física e as linhas sobrevivem como órfãs. Perde-se list view, API, permissões e relatórios; não os dados.
- `Conjunto` foi preservado com `modified` **byte a byte** igual ao `.json` — o arquivo versionado é a fonte (ADR-0002).

### O gatilho real, refinado quatro vezes

Cada gate estreitou a definição. A versão final é substancialmente diferente da que o `tech_spec` afirmava:

1. **`tech_spec` §5.1:** "zerar `custom` é o que faz o arquivo virar fonte" — **falso**.
2. **T9 rodada 1:** "`custom=0` + Module Def existente + controller ausente" — o QA corrigiu a si mesmo: `Locação de imóveis` **existe** como Module Def mas **não está no `modules.txt`**; o certo é "**resolvível**".
3. **Tech Review:** o predicado não é "controller ausente", é **`get_controller()` levantar `ImportError`**, por **quatro** caminhos — módulo ausente, import interno quebrado, **classe com nome fora do derivado**, classe que não herda `BaseDocument`. Mais um quinto fator: `override_doctype_class`.
4. **Verificação final:** o quinto fator é **exercitado mas não load-bearing** (`Address` está em `class_overrides`, mas resolve limpo por si só).

**Para a T2**, verificado: entregar `.json` + `.py` no mesmo commit **não basta**. `Verificar scheduler` exige a classe `Verificarscheduler` (s minúsculo); `INATIVO_2` exige `INATIVO_2` (o `_` **não** é removido). Uma classe mal nomeada satisfaz a regra escrita e ainda assim faz o migrate apagar a definição.

**`INATIVO` e `INATIVO_2` estão seguros por acidente de configuração.** Se a T2 registrar `Locação de imóveis` num `modules.txt`, os dois entram na condição de órfão no mesmo migrate. **Decidir antes, não depois.**

### O portão anti-órfão — o artefato mais reutilizável do run

`deploy/scripts/portao_orfaos.py` roda antes de qualquer migrate e responde por código de saída: **0** verde, **1** há DocType que o migrate apagaria, **2** rodada inválida. Provado falsificável nos três estados, com 13 pontos de invalidação, seletor `{"custom": 0}` **sem** recorte de módulo, `clear_controller_cache()` + `in_migrate` para ser tão estrito quanto o migrate, e piso de amostra obrigatório.

Ele nasceu de um defeito instrutivo: publicado como bloco de prosa **sem imports**, reportava `739 verificados, 0 órfãos` **sem testar nada** — os `NameError` eram engolidos pelo `except Exception`. Virou arquivo executado por redirecionamento de stdin, o que elimina o passo de cópia onde a divergência nascia.

### A receita de limpeza (para T2/T3, que vão plantar e remover repetidamente)

`frappe.delete_doc(force=True)` **arquiva** o documento antes de removê-lo. Limpeza completa exige: `custom=1` → `delete_doc(force=True)` → `DROP TABLE` → purgar `tabDeleted Document`, `tabVersion` **e `tabComment`** → varredura por nome em todas as tabelas com FK de nome de DocType. **A varredura tem de ser a última ação da rodada** — foi por ser intermediária que uma confirmação de limpeza envelheceu e o resíduo reapareceu.

### Uma hipótese perigosa descartada por experimento

O Tech Review suspeitou que perder o `PYTHONPATH` tornaria **todos** os DocTypes do app órfãos de uma vez. **Testou: não acontece** — o migrate aborta antes, em `Could not find app`. Ele registrou: "estava a um passo de virar um CRÍTICO infundado — a diferença foi executar em vez de inferir".

### O padrão que atravessou o run

**Corrigir num lugar e não varrer os vizinhos** — oito variações, sempre com a informação correta já escrita em algum lugar:

o eixo `custom` corrigido e o `module` deixado na mesma tabela; a conclusão do AC-4 mudada e o parágrafo que a citava intacto; o veredito-por-exit-code dado ao portão e o comando irmão duas linhas acima continuando a reportar sucesso ao falhar; a armadilha do IP literal demolida no compose e reintroduzida na prosa uma linha depois; a §7.A.20 dizendo "Cinco variações" numa tabela de seis — o erro ocorrendo **dentro do parágrafo sobre ele**; e o `veredito_suite.sh` entrando na §7.A.19 sem entrar na §5.1.

**A defesa que funcionou não foi mais cuidado — foi mudar a classe**: o portão virou arquivo executado por stdin (sem passo de cópia) e ganhou `RODADA_INVALIDA` exigindo prova de execução. Onde a sincronização entre artefatos continuou manual, o padrão continuou aparecendo.

### Pendências que precisam de decisão sua

1. **`frontend` ainda tem `allow_tests: true`.** A ADR-0006 é uma *proibição*; o run entregou a *capacidade* de obedecê-la. `bench --site frontend set-config allow_tests false` custa um comando, não depende da T2, e o Tech Review recomendou task própria. **Não executei** — é ação sobre produção.
2. **Nenhum ambiente está pronto para a T2 exportar DocTypes**: `developer_mode` é `0` no `frontend` e não está setado na stack nova, onde o mount do app é read-only.
3. **A T10 não é coberta pelo ambiente novo** — escreve em `/etc/cron.d` e `/var/log` do host, e vai exercitar o instalador contra o host real na primeira execução, com um script que hoje carrega senha de banco em texto plano.
4. **A emenda da ADR-0002** (declara como "Neutro" que o modo de desenvolvimento está habilitado; `frontend` tem `developer_mode: 0`). Insumo pronto no achado 1 da §7.1 da T1, para `/agent-spec-adr-supersede`.

### Segurança

`reference/backups-tc001/` (21 MB) continha a senha do Administrator em texto claro, só em disco. Removido após confirmar que nada estava versionado. **Só apareceu porque o executor da T8 se recusou a apagar às cegas** e escalou a ambiguidade.

### Decisões interativas registradas

Seguir com o backup diário de 02:30 antes de a T1 tocar produção · cinco extensões do limite da T1 · autorização explícita para a remoção irreversível da T8 · antecipar o ambiente destrutível · remover o diretório com a credencial e manter os demais resíduos · executar a T9 apenas na infraestrutura · cinco extensões do limite da T9 · manter o wrapper em vez de removê-lo · **aceitar a T9 parcial sem aprovação de gate**.

### Observação de execução

O paralelismo T1×T4 previsto no task_plan foi descartado: paths e símbolos disjuntos, mas ambas operam sobre o mesmo banco de produção — independência de recurso não demonstrável, fallback para sequencial.
