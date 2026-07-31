# Relatório do Run — integracao-bancaria-configuravel/v2-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **9/9 tasks concluídas** · 113 testes verdes (114 antes de T6, que removeu um teste redundante por design) · nenhuma análise estática configurada no projeto

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T3 | Estreitar `except` na leitura da senha (Patch 1) | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T6 | Remover teste que assere código-fonte | sonnet | 1 mod | ✅ APROVADO | — (gates=[qa]) |
| T1 | Sentinela único em `situacao_cru` | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T2 | Corrigir docstring de `montar_payload_emissao` | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T5 | Ampliar normalização de `mapear_situacao_boleto` | sonnet | 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T4 | `codigo_erro` canônico em `ResultadoConsulta`/`ResultadoBaixa` | sonnet | 5 mod | ✅ APROVADO (2ª rodada) | ✅ APROVADO (2ª rodada) |
| T7 | Enxugar retorno de `listar_boletos_abertos` | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T9 | Bufferizar páginas no PDF consolidado | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T8 | Filtro RN-02 em fonte única | sonnet | 2 mod | ✅ APROVADO (3ª rodada) | ✅ APROVADO_COM_OBSERVACOES |

Todos os gates rodaram em **opus** (escalação automática: os paths estão em Critical Path `payments`; T3 também em `db_migrations`).

**Débitos resolvidos**: 9 de 9 (D-001 a D-009) — os 5 classificados como `recomendado_corrigir` e as 4 `perfumaria`, estas últimas incluídas por decisão explícita do usuário.

## 2. Débitos Técnicos Não Resolvidos

✅ **Nenhum débito técnico anotado neste run.**

Esta versão adota o guardrail "task de cleanup não gera débito novo". Os 4 problemas `BAIXO` levantados pelos gates durante a execução foram **corrigidos na própria task**, em vez de anotados:

| Origem | Problema | Resolução |
|---|---|---|
| QA T5 | `documentation` — docstring não-raw convertia `\xa0` em nbsp invisível no `help()`/`__doc__` | docstring tornada raw |
| QA T5 | `code_quality` — caractere U+00A0 **literal** (invisível) no `.replace`, vulnerável a normalização por editor/formatter, o que reintroduziria D-005 silenciosamente | trocado pelo escape explícito, alinhado ao legado |
| QA T8 | `documentation` — docstring do módulo `boletos_abertos.py` ainda descrevia a duplicação removida, com ponteiro para símbolo inexistente e números de linha obsoletos | reescrita para a fonte única, sem números de linha |
| TR T8 | `code_quality` — assimetria `deepcopy`-vs-global subdocumentada; a leitura natural seria "defensividade supérflua, dá pra remover" — e removê-la reintroduziria a contaminação | comentário explicativo no ponto de uso, incluindo o registro de que `MappingProxyType` foi testado e reprovado |

> **D-010 — RESOLVIDO em 2026-07-21**, fora do escopo das 9 tasks (correção pontual pedida pelo usuário após o fechamento da versão). O audit trail do Patch 1 listava `certificado_senha` como campo migrado mesmo quando a senha estava ausente na legada. Agora `campos_alterados` é montado a partir dos campos **efetivamente populados**, com ordem canônica fixa (`_ORDEM_CAMPOS_OPCIONAIS`) e `api_base_url` sempre ao final.
>
> QA (opus): APROVADO, 8/8, 113 testes OK. Dois achados relevantes: (a) no cenário **com** senha a string gerada é **literalmente idêntica** à hardcoded anterior — o caso já aplicado em produção não muda de formato; (b) o filtro usa `is not None` e não truthiness, então `numero_cliente = 0` entra corretamente na lista (evita o falso-negativo clássico). RN-06 preservado: apenas o booleano `senha_presente` cruza para a montagem.
>
> O registro `fee663a397` já gravado em produção mantém a string antiga — corrigir o código não reescreve auditoria passada, e nenhum dado foi alterado retroativamente.

## 3. Tasks Bloqueadas

✅ **Nenhuma task bloqueada.** T8 chegou ao limite de 3 tentativas mas aprovou na terceira.

## 4. Notas para Revisão Humana

**Conflito de spec escalado ao usuário (T4).** A task se contradizia: mandava ramificar por `codigo_erro` nos "dois consumidores", mas proibia estender o discriminador a `ResultadoBaixa` — e `confirmacao_baixa.py` consome justamente `ResultadoBaixa`. A proibição fora escrita sobre premissa falsa. O usuário decidiu **estender também a `ResultadoBaixa`** (não a `ResultadoEmissao`, que não tem consumidor ramificando por string). A cláusula está tachada na §4.3 da task, com a justificativa.

**T8 exigiu 3 tentativas por um defeito real, não por ruído de gate.** A unificação do filtro RN-02 trocou um dict local recriado a cada chamada por um dict de nível de módulo compartilhado entre dois pacotes — e o retorno do dry_run o expunha ao caller. O QA provou empiricamente que mutar o retorno redefinia a regra de negócio financeira **nos dois módulos, process-wide** num worker de vida longa, sem sintoma. A primeira correção (`dict()`) era cópia rasa e o QA derrubou de novo com `['status_cobranca'][1].append('Paga')`. Fechou com `copy.deepcopy` no retorno público, mantendo o global direto no `filters=`.

**Achado operacional relevante para o projeto**: o executor tentou endurecer a constante com `types.MappingProxyType` e a suíte **quebrou silenciosamente** — o construtor de filtros do Frappe não aceita mapping não-`dict`, **não levanta erro** e simplesmente retorna 0 resultados (CT-019 caiu de 3 para 0 matches). Vale como conhecimento de stack: nunca passar mapping não-`dict` como `filters` no Frappe.

**Domicílio da constante RN-02 — resíduo consciente.** O Tech Review julgou aceitável manter `FILTROS_BOLETO_ABERTO` em `cobranca_sicoob/rotina_pagamentos.py` (onde a regra nasceu), apesar de RN-02 ser agnóstica de provedor e o pacote ter nome de provedor. Mover para `cobranca_bancaria` seria **pior**: injetaria preocupação de persistência/Frappe no pacote que a ADR-0001 criou para ser domínio puro (`modelo.py` declara "nenhum import de `frappe`"). O resíduo real é de **nomenclatura de pacote**, herdado, e seu endereçamento correto seria reorganizar o pacote de operação — não realocar uma constante.

**Verificação empírica pelos gates.** Vale registrar o padrão que se mostrou decisivo neste run: em T5, T8 e T9 os gates **executaram código no container** em vez de concluir por leitura — o QA de T5 comparou o normalizador novo com o do legado em 118.044 entradas (0 divergências); o de T9 provou que `pypdf` materializa o grafo de objetos no `add_page` destruindo a fonte antes do merge; o de T8 reproduziu 4 ataques de mutação. Duas preocupações minhas foram refutadas assim, e um defeito real foi confirmado assim.

**Pendência herdada da v1 — conteúdo pronto, aplicação bloqueada por permissão**: `reference/contexto_backend.md` e `reference/runbook_frappe.md` foram atualizados (seção nova em cada + 5 correções de trechos que a migração tornou factualmente falsos: config legada descrita como ativa, contador e emissão apontando para a DocType legada). Os arquivos finais estão preparados no scratchpad da sessão, junto com `aplicar_reference.sh`, que faz backup na convenção do repo e preserva `root:root 644`. **Não aplicados**: os arquivos são `root:root` e `sudo` exige senha — depende de ação do usuário. Diff puramente aditivo (145 + 95 linhas, 0 removidas).

Dois fatos apurados durante essa atualização, ambos registrados nos docs: (a) `mariadb_all.sql.gz` e `frappe_sites.tar.gz` passaram a ter **acoplamento** — `certificado_senha` é campo `Password`, cifrado com a `encryption_key` do `site_config.json` (volume `sites`); restaurar os dois de backups diferentes quebra a descriptografia, com sintoma de falha de autenticação e configuração aparentemente correta na tela; (b) `certificado_valido_ate` está `null` em produção, mas **RN-07 continua ativo** — a validade vem do `not_valid_after` do PFX lido em runtime, e os campos da DocType são só espelho do upload, que nunca foi usado.

**Incidente do orquestrador (recuperado, sem perda).** Um script meu de atualização de estado usou `open(p,'w').write(open(p).read())`, que trunca o arquivo antes de lê-lo, zerando `tasks/T4.md`, `tasks/T5.md` e `_run/minispec_state.yaml` — artefatos de spec, untracked, sem cobertura de git. **Nenhum arquivo de código foi afetado.** T4.md foi recuperado íntegro do transcript da sessão (o tool_use `Write` original); T5.md e o state foram reconstruídos do conteúdo em contexto. Detalhe em `_run/workflow-report.md`.
