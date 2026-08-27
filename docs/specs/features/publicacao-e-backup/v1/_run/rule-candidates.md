# Rule candidates — publicacao-e-backup/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] Premissa de negócio que autoriza a fatia

**Regra que isto sugere:** toda fatia que dependa de uma premissa de negócio verificável declara essa premissa como gatilho de parada explícito.

**O que ela faria (simples):** sem a declaração, a fatia continua correndo depois que a premissa cai, e o dano só aparece na virada; com ela, o executor PARA e escala no instante em que a premissa deixa de valer.

- Evidência: "O cliente não usa o sistema antigo, está esperando o app novo, e os cadastros vão nascer pela tela do backend novo" — decisão do usuário, 2026-08-25 — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] A prova de um backup é a restauração

**Regra que isto sugere:** entrega de cópia de segurança só se declara concluída com uma restauração executada e conferida — o dump por si não é prova.

**O que ela faria (simples):** impede que um `pg_dump` que roda sem erro seja aceito como backup funcional; o critério de aceite passa a ser a base restaurada.

- Evidência: "**A prova é a restauração**, não o dump." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] Superfície congelada é âncora executável, não promessa

**Regra que isto sugere:** fatia posterior ao congelamento da superfície reafirma as âncoras `106 / 91 / 20` por medição, e nenhuma rota nasce, muda ou sai.

**O que ela faria (simples):** garante que o handoff de frontend continua verdadeiro; qualquer rota nova quebraria o contrato já entregue ao app.

- Evidência: "**A superfície da API está congelada**: as âncoras `106 / 91 / 20` saem intactas." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] Sem janela de rollback por tempo

**Regra que isto sugere:** a rede de segurança de uma operação irreversível é o artefato preservado (o dump), nunca um prazo para desfazer.

**O que ela faria (simples):** evita desenhar mecanismo de reversão temporal que ninguém vai operar; concentra o esforço em preservar e provar a restauração.

- Evidência: "**Sem janela de rollback por tempo** (revisão 2 do plano) — a rede é o dump preservado." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] O backend antigo fica intacto e de pé ao fim do marco

**Regra que isto sugere:** nenhuma task do marco de entrega desliga, desinstala ou degrada `/opt/frappe`.

**O que ela faria (simples):** separa construção de virada; a virada é sessão operacional futura, e um executor não pode antecipá-la por conveniência.

- Evidência: "**`/opt/frappe` intacto e de pé** ao fim do marco." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] Desenho do backup fixado no plano de execução

**Regra que isto sugere:** o desenho fixado em `plano-execucao.md §F7 item 1` é entrada fechada da fatia e não se rediscute na execução.

**O que ela faria (simples):** impede que cada task reabra a escolha de formato/retenção/destino; a discussão já aconteceu e está registrada.

- Evidência: "O desenho do backup está fixado no `plano-execucao.md` §F7 item 1 e não se rediscute." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [pre_refinement_decision] Idioma e modelo fixos para sessão e subagentes

**Regra que isto sugere:** português brasileiro em toda saída e Opus em todo agente — sessão principal e todo subagente de qualquer skill.

**O que ela faria (simples):** a regra já existe no `CLAUDE.md`; o sinal registra que ela precisou ser reafirmada no pré-refinamento, o que indica que a heurística de modelo das skills continua sugerindo sonnet e sendo sobrescrita a cada run.

- Evidência: "**Português brasileiro em tudo; exclusivamente Opus**, sessão principal e todo subagente." — `pre-refinement.md §11`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-minispec-run-tasks` · 2026-08-25T00:00:00Z

---

## [repeated_fixture] Arranjo de raiz de segredos em caixa de areia

**Regra que isto sugere:** o arranjo das três raízes de caixa de areia (backup, chave, segredos) sai de um montador único em vez de ser redigitado por caso.

**O que ela faria (simples):** quatro casos da bateria repetem o mesmo bloco de quatro linhas — declarar `raiz_backup`/`raiz_chave`/`raiz_segredos` sob a base do caso, criar dois deles com `mkdir -p` e chamar `montar_raiz_de_segredos`. A função já existe e é compartilhada, mas o arranjo em torno dela não, e é ele que vai divergir: basta um caso ganhar um quarto diretório para os outros três ficarem para trás sem que nada acuse.

- Evidência: bloco `local raiz_backup/raiz_chave/raiz_segredos` + `mkdir -p` + `montar_raiz_de_segredos` repetido em 4 casos — `deploy/scripts/backup/verificar-backup.sh:849` (também 992, 1048, 1192) — T2 / bateria verificar-backup.sh
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-25T19:02:00Z

---

## [repeated_assertion_shape] Asserção de desfecho zero do alvo executado

**Regra que isto sugere:** o desfecho de sucesso de um alvo executado se afirma por um acessório nomeado, não por `afirmar_igual ... "0" "${CODIGO_DO_ALVO}"` redigitado.

**O que ela faria (simples):** a mesma forma de asserção aparece sete vezes na bateria, variando só o rótulo. Um acessório do tipo `afirmar_alvo_aprovado "<rótulo>"` — que já despejasse a saída de erro do alvo quando reprovasse, como três dos sete casos fazem à mão e os outros quatro não — daria diagnóstico uniforme e removeria a assimetria atual, em que reprovar em alguns casos imprime a causa e em outros não.

- Evidência: forma `afirmar_igual "... termina com sucesso" "0" "${CODIGO_DO_ALVO}"` em 7 pontos — `deploy/scripts/backup/verificar-backup.sh:570` (também 756, 820, 870, 955, 1058, 1066) — T2 / bateria verificar-backup.sh
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-25T19:02:00Z

---

## [repeated_fixture] Resposta de confirmação lida do alvo

**Regra que isto sugere:** o arranjo que entrega o token de confirmação ao alvo tem um acessório único, e o token nunca é reescrito do lado da prova.

**O que ela faria (simples):** o par `escrever_resposta … "${TOKEN_DO_ALVO}"` foi montado à mão em três casos; uma regra apontando o acessório evita que um deles um dia reescreva a palavra literal, que é justamente o que poria o alvo sob prova nos dois lados da comparação.

- Evidência: `escrever_resposta` com `TOKEN_DO_ALVO` em 3 casos distintos — `deploy/scripts/backup/verificar-backup.sh:2424` (também 2473, 2937) — T3 / bateria de restauração de base
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-25T22:56:00Z

---

## [repeated_assertion_shape] Controle antivácuo do destino vazio

**Regra que isto sugere:** criar base de destino e afirmar que ela começa em zero relações é um par indissociável, com acessório próprio.

**O que ela faria (simples):** o mesmo shape — `criar_base_vazia` seguido de `afirmar_igual "0" "$(contar_relacoes_da_base …)"` — aparece em cinco pontos; uma regra que o nomeie evita que um caso futuro crie a base e esqueça o controle, e um caso sem ele aprovaria um destino já povoado como se a restauração tivesse acontecido.

- Evidência: `criar_base_vazia` + `afirmar_igual 0 contar_relacoes_da_base` em 5 pontos — `deploy/scripts/backup/verificar-backup.sh:2421` (também 2526, 2607, 2641, 2960) — T3 / bateria de restauração de base
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-25T22:56:00Z

---

## [scope_deviation] Âncora de superfície na lista declarada

**Regra que isto sugere:** toda âncora de superfície que a publicação obriga a atualizar no mesmo diff consta da §5.2/§3.2 de arquivos a modificar da task.

**O que ela faria (simples):** a regra de âncoras manda atualizar a âncora no mesmo diff em que a superfície cresce, mas nenhuma regra manda declarar esse arquivo na lista de escopo da task — então a task o omite e o gate encontra um arquivo tocado fora do declarado, que na apuração automática é indistinguível de um toque não autorizado. A regra faria as duas obrigações apontarem para o mesmo lugar.

- Evidência: `packages/db/test/cobranca.spec.ts` alterado (âncora `CT-512 (b)`, igualdade de conjunto sobre `deploy/systemd/`) sem constar da §3.2 da T4 — `packages/db/test/cobranca.spec.ts:478` (também 509) — T4 / publicação de duas unidades systemd
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-26T00:55:00Z

---

## [repeated_fixture] Montagem da aplicação real em suíte e2e

**Regra que isto sugere:** centralizar a montagem da aplicação real de e2e (instância efêmera de banco e fila, semeadura de `process.env`, porta dinâmica, `criarAplicacao` e `listen`) num acessório compartilhado de `apps/api/test`.

**O que ela faria (simples):** o mesmo bloco `beforeAll` está copiado em 28 suítes, e esta task fez a 29ª. Como cada cópia é livre para divergir, toda variável nova exigida na partida obriga a revisar dezenas de arranjos — foi exatamente esse custo que levou esta task a declarar `ORIGENS_PUBLICAS` no `vitest.config.ts` para não editar 35 arquivos. Uma regra apontando a casa comum faria a próxima variável entrar num lugar só.

- Evidência: bloco `beforeAll` de montagem da aplicação real repetido em 28 suítes de `apps/api/test`, agora 29 — `apps/api/test/origem-publica.e2e.spec.ts:158` — T7 / fatia publicacao-e-backup
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-26T10:04:00Z

---

## [repeated_assertion_shape] Predicado do nome do cookie de sessão

**Regra que isto sugere:** publicar o predicado do cookie de sessão como símbolo único do acessório de borda, e proibir a redeclaração local da extração do nome do cookie.

**O que ela faria (simples):** a expressão que extrai o nome do cookie e o compara com o sufixo de sessão aparece em ~30 arquivos de teste, já em **três formas ligeiramente diferentes** — inclusive dentro da própria casa compartilhada. Endurecer uma cópia deixa as outras para trás, que é o modo de falha que o Limiar de Três existe para evitar.

- Evidência: predicado `(x.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO)` medido em ~30 arquivos, em 3 formas divergentes — `apps/api/test/origem-publica.e2e.spec.ts:274` vs `apps/api/test/acessorios-de-borda.ts:278` — T7 / fatia publicacao-e-backup
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T10:04:00Z

---

## [repeated_assertion_shape] Pedido atendido sem cabeçalho do limitador

**Regra que isto sugere:** afirmar "o pedido passou pelo limitador" pelo par status-esperado + ausência do cabeçalho de espera, por um verificador nomeado em vez de duas linhas repetidas.

**O que ela faria (simples):** a mesma dupla de asserções aparece **oito vezes** no arquivo, cinco delas nesta task. Escrita à mão em cada perna, basta alguém esquecer a segunda linha para o caso passar a aprovar um `429` disfarçado.

- Evidência: par `expect(X.status).toBe(STATUS_DE_RECUSA_SEM_SESSAO)` + `expect(X.cabecalhos.get(CABECALHO_DE_ESPERA)).toBeNull()` repetido 8× — `packages/auth/test/bloqueio.spec.ts:1008` — T8 / limitador com eixo de origem
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T11:40:00Z

---

## [repeated_assertion_shape] Laço de esgotamento do teto e lista de status

**Regra que isto sugere:** extrair o esgotamento do teto por uma origem para um acessório que devolva a lista de status, já afirmada por igualdade contra o teto.

**O que ela faria (simples):** o mesmo laço até o teto seguido do `toEqual(Array.from(...))` aparece **cinco vezes**, três delas nesta task. Cada cópia é livre para divergir no teto que percorre, e um laço que pare cedo deixaria o caso verde afirmando outra coisa.

- Evidência: laço de esgotamento + `expect(dentroDoTeto).toEqual(Array.from({ length: TETO... }))` repetido 5× — `packages/auth/test/bloqueio.spec.ts:973` — T8 / limitador com eixo de origem
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T11:40:00Z

---

## [repeated_fixture] Preâmbulo de pré-condição de borda efêmera

**Regra que isto sugere:** casos de rede de uma bateria declaram a pré-condição por um invólucro único, e não por bloco de guarda copiado caso a caso.

**O que ela faria (simples):** o mesmo bloco de sete linhas está copiado literalmente em **sete** casos. Se a frase ou o comando mudar, seis cópias ficam para trás em silêncio, e o operador passa a receber instruções divergentes para a mesma degradação.

- Evidência: guarda `if ! borda_disponivel` idêntico em 7 casos de rede — `deploy/scripts/borda/verificar-borda-do-app.sh:819` — T9 / bateria da borda pública
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-26T14:10:00Z

---

## [repeated_assertion_shape] Contagem de diretiva no gabarito por grep

**Regra que isto sugere:** asserção sobre presença ou ausência de diretiva em arquivo de configuração usa um auxiliar nomeado que já embute o antivácuo, em vez de `grep -c … || true` inline.

**O que ela faria (simples):** o mesmo molde aparece **sete vezes seguidas**, e cada cópia repete o `|| true` que engole erro de padrão malformado — um padrão quebrado devolveria zero e a asserção de **ausência** passaria por vacuidade. A proteção depende de quem escreve a próxima cópia lembrar dela.

- Evidência: molde `afirmar_igual … "$(grep -cE … "${GABARITO}" || true)"` em 7 asserções do `CT-1188` — `deploy/scripts/borda/verificar-borda-do-app.sh:1243` — T9
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T14:10:00Z

---

## [repeated_fixture] Acessório de borda efêmera em duas baterias

**Regra que isto sugere:** o arranjo de borda efêmera (certificado gerado no arranjo, porta livre, serviço de trilha atrás, guarda de isolamento do `listen`, nginx em prefixo descartável) mora numa casa comum de `deploy/scripts/borda/`, e a bateria nova o importa em vez de recriá-lo.

**O que ela faria (simples):** o mesmo arranjo de rede foi montado do zero em duas baterias de borda, e nesta task uma das cópias foi endurecida (modo de espera por arquivo de controle) enquanto a outra ficou para trás; uma regra apontando a casa comum evitaria que a terceira borda pública nascesse com a terceira cópia já divergente.

- Evidência: `subir_borda_efemera` e o heredoc `servico.mjs` declarados por inteiro nas duas baterias de borda — `deploy/scripts/borda/verificar-notificacao-bancaria.sh:965` e `deploy/scripts/borda/verificar-borda-do-app.sh:764` — T10 / proteção da borda de entrada de fato de terceiro
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-26T20:10:00Z

---

## [repeated_assertion_shape] Travessia afirmada pela tripla codigo-origem-location

**Regra que isto sugere:** a travessia de um caminho pela borda se afirma pela medida composta `codigo|origem|location` inteira, nunca só pelo status — é ela que separa a resposta que veio de dentro da que a borda produziu.

**O que ela faria (simples):** o mesmo molde de asserção se repete em três casos da bateria, sempre comparando a medida inteira contra `204|<origem do serviço>|`; escrita como regra, ela fixa por que o status sozinho não basta e impede que a próxima bateria de borda afirme só o código e aprove uma recusa da borda como se fosse travessia.

- Evidência: `afirmar_igual <rótulo> "204|${ORIGEM_DO_SERVICO}|" "${medida}"` em três casos — `deploy/scripts/borda/verificar-notificacao-bancaria.sh:1164`, `:1408` e `:1417` — T10 / `CT-1005 (c)` e `CT-1192`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T20:10:00Z

---

## [repeated_fixture] Leitura do CLAUDE.md como fixture da barreira

**Regra que isto sugere:** na barreira do protocolo, o texto do `CLAUDE.md` é lido uma vez por módulo e reusado pelos `describe`, em vez de reaberto em cada um.

**O que ela faria (simples):** a mesma abertura `ler(CAMINHO_DAS_INSTRUCOES)` aparece em cinco pontos do arquivo, e cada `describe` novo copia a linha do vizinho. Não quebra nada hoje — o conteúdo é imutável dentro da rodada —, mas é o mesmo mecanismo de cópia que a convenção *"acessório de suíte se importa, não se copia"* existe para conter: quando alguém precisar variar a leitura (recorte, normalização, espelho), cinco pontos terão de mudar juntos.

- Evidência: `ler(CAMINHO_DAS_INSTRUCOES)` em 5 pontos do mesmo arquivo, dois deles acrescentados por esta task — `packages/shared/test/protocolo-antirregressao.spec.ts:419`, `:498`, `:642`, `:816`, `:947` — T11 / barreira executável do Protocolo Antirregressão
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-26T21:40:00Z

---

## [repeated_assertion_shape] As duas pontas de um débito afirmadas como par

**Regra que isto sugere:** conferência de débito nas duas pontas se afirma sobre o objeto `{marcadores, linhasDoIndice}` inteiro, por igualdade, nunca sobre uma ponta de cada vez.

**O que ela faria (simples):** o molde `expect(asDuasPontasDe(par, …)).toEqual({ marcadores: N, linhasDoIndice: M })` aparece quatro vezes no `CT-1198`, e é justamente essa forma — as duas pontas na MESMA estrutura — que faz o objeto da falha dizer qual delas ficou para trás. Escrever a regra evita que a próxima conferência de débito volte a afirmar uma ponta por vez, que é o formato em que marcador órfão e linha órfã ficam indistinguíveis.

- Evidência: molde `asDuasPontasDe(...) → toEqual({marcadores, linhasDoIndice})` em 4 pontos — `packages/shared/test/protocolo-antirregressao.spec.ts:952`, `:987`, `:997`, `:1005` — T11 / `CT-1198`, conferência do índice de débito
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-26T21:40:00Z

---
