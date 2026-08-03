# Rule candidates — fundacao-multitenancy-identidade/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] Modelo fixo em Opus para todo subagente

**Regra que isto sugere:** todo subagente do agent-spec neste projeto roda em Opus; sonnet e haiku são proibidos mesmo quando a heurística de `model`/`gates` os resolveria.

**O que ela faria (simples):** sem ela, cada orquestrador aplica a heurística default do SKILL.md e despacha gate em sonnet, contrariando decisão travada do usuário. Com ela, a resolução de modelo já nasce certa.

- Evidência: "Este projeto roda exclusivamente em Opus — sessão principal e todo subagente despachado por qualquer skill do agent-spec (…). Sonnet e Haiku estão proibidos" — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Português brasileiro em toda interação

**Regra que isto sugere:** respostas de terminal, perguntas de `AskUserQuestion`, raciocínio exibido, documentação, comentários e commits em pt-BR, sem exceção.

**O que ela faria (simples):** evita que subagente responda em inglês por default; hoje a regra só existe no CLAUDE.md e depende de o subagente carregá-lo.

- Evidência: "Todas as respostas e interações em português brasileiro — não só documentação e mensagens de commit." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Protocolo Antirregressão como pré-condição de edição

**Regra que isto sugere:** baseline antes/depois e as três linhas de declaração (`CAUSA-RAIZ` / `POR QUE ISTO FECHA A CLASSE` / `O QUE ESTA MUDANÇA REMOVE`) são obrigatórias antes de editar arquivo existente.

**O que ela faria (simples):** força o executor a diagnosticar antes de editar, em vez de consertar o sintoma e reabrir o ciclo de gate.

- Evidência: "O Protocolo Antirregressão (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição, com força máxima em ciclo de correção de gate." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Fronteira backend — frontend é gatilho de parada

**Regra que isto sugere:** nenhum agente deste repositório escreve, edita ou planeja código de frontend; task que peça isso é PARADA e escalada.

**O que ela faria (simples):** o fonte React não existe neste servidor — sem a regra, um executor tentaria "completar" a entrega escrevendo tela que ninguém pode ler nem rodar aqui.

- Evidência: "Aqui só se faz backend (…). Task que peça implementação de frontend é gatilho de parada." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Multi-tenancy é fundação, não retrofit

**Regra que isto sugere:** toda tabela de negócio nasce com `empresa_id`, RLS (`USING` e `WITH CHECK`) e FK composta `(id, empresa_id)` — antes da primeira entidade de negócio.

**O que ela faria (simples):** impede que uma tabela entre "só por enquanto" sem isolamento e vire retrofit caro depois.

- Evidência: "Multi-tenancy é fundação, não retrofit: RLS e FK composta antes da primeira entidade de negócio." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Contexto de tenant nunca vem do request

**Regra que isto sugere:** o `empresa_id` vem de `AsyncLocalStorage` + `SET LOCAL app.empresa_id` por transação — nunca de cabeçalho, corpo ou parâmetro de rota.

**O que ela faria (simples):** fecha a classe inteira de escalonamento por tenant forjado no request, em vez de validar caso a caso no handler.

- Evidência: "O contexto de tenant nunca é lido do request — `AsyncLocalStorage` + `SET LOCAL app.empresa_id` por transação." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Nenhum segredo versionado

**Regra que isto sugere:** certificado, senha de banco e chave de cifra vivem fora do repositório, em `EnvironmentFile` 0600; `.gitignore` barra `.env`, `*.pfx`, `secrets/`.

**O que ela faria (simples):** evita que um executor "facilite" o teste commitando um `.env` de exemplo com credencial real.

- Evidência: "Nenhum segredo versionado — segredos fora do repositório, em `EnvironmentFile` 0600." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Isolamento lógico por empresa (Decisão 2)

**Regra que isto sugere:** a escala alvo (20 a 300 empresas) implica isolamento lógico por `empresa_id`, não banco por cliente.

**O que ela faria (simples):** barra a proposta recorrente de "um schema/banco por tenant", que muda migração, backup e conexão inteiros.

- Evidência: "Decisão 2: escala de 20 a 300 empresas ⇒ isolamento lógico por empresa, não banco por cliente." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Três perfis com permissão ajustável por usuário (Decisão 8)

**Regra que isto sugere:** o modelo de acesso é 3 perfis (Master SaaS, Admin Empresa, Usuário) **mais** ajuste por usuário — nem só perfil, nem só permissão avulsa.

**O que ela faria (simples):** as duas simplificações opostas (só perfil / só ACL) já foram propostas e rejeitadas; a regra evita reabrir a discussão a cada fatia.

- Evidência: "Decisão 8: 3 perfis (Master SaaS, Admin Empresa, Usuário) + permissões ajustáveis por usuário." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Revogação bloqueia na hora, sem apagar nada (Decisão 11)

**Regra que isto sugere:** revogar acesso mata sessões ativas e para automações da empresa imediatamente; nenhum dado é apagado.

**O que ela faria (simples):** separa "bloquear" de "excluir" — sem a regra, um executor implementaria revogação como remoção de linha e perderia histórico.

- Evidência: "Decisão 11: revogação bloqueia na hora — sessões ativas mortas, automações da empresa param, nada é apagado." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Parâmetros fixos de credencial e sessão (Decisão 13)

**Regra que isto sugere:** senha mínima de 10 com verificação de força, bloqueio após 5 tentativas, sessão de 8h renovável por atividade, cookie `httpOnly`+`Secure`+`SameSite`, 2FA opcional para Admin e obrigatório para o Master, trilha de auditoria de login.

**O que ela faria (simples):** são números fechados pelo usuário; sem a regra o executor herda o default da biblioteca de autenticação e diverge em silêncio.

- Evidência: "Decisão 13: senha mínima de 10 (…), bloqueio após 5 tentativas, sessão de 8h renovável (…), 2FA (…) obrigatório para o Master, trilha de auditoria de login." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Senha temporária com troca obrigatória (Decisão 14)

**Regra que isto sugere:** o Admin inicial recebe senha temporária do Master e é obrigado a trocá-la no primeiro acesso — sessão restrita até a troca.

**O que ela faria (simples):** define que existe um estado de sessão que não dá acesso ao produto; sem ele, o primeiro acesso viraria sessão plena.

- Evidência: "Decisão 14: Admin inicial recebe senha temporária do Master, com troca obrigatória no primeiro acesso." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Matriz fechada de 10 telas × 7 ações sensíveis (Decisões 15/38)

**Regra que isto sugere:** a permissão é por tela mais ações sensíveis separadas, sobre uma lista **fechada** de 10 áreas e 7 ações — acrescentar item é decisão do usuário, não do executor.

**O que ela faria (simples):** impede que cada fatia invente um nome de tela ou de ação novo e a matriz divirja entre backend e frontend.

- Evidência: "Decisão 15 / 38: permissão por tela + ações sensíveis separadas, com a lista fechada de 10 áreas de tela (…) e 7 ações sensíveis (…)." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Confidencialidade só na aplicação — risco aceito (Decisão 16)

**Regra que isto sugere:** sem auditoria de acesso técnico e sem criptografia por campo; quem tem root no servidor ou no banco lê tudo — risco assumido, não defeito.

**O que ela faria (simples):** evita que um gate futuro reprove a ausência de cifra por campo como falha de segurança quando ela é decisão registrada.

- Evidência: "Decisão 16: confidencialidade garantida apenas na aplicação (…). Risco assumido conscientemente pelo usuário." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Usuários da empresa criados pelo Admin dela (Decisão 39)

**Regra que isto sugere:** o Master não cria usuário final; o Admin da empresa cria, com a mesma mecânica de senha temporária.

**O que ela faria (simples):** fixa quem é o ator de cada rota de onboarding — sem isso, a rota nasce no perfil errado.

- Evidência: "Decisão 39: os demais usuários da empresa são criados pelo Admin dela, com a mesma mecânica de senha temporária." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Master SaaS nunca é superusuário do banco

**Regra que isto sugere:** o perfil Master é papel de aplicação; ele não pode ser superusuário do PostgreSQL nem papel administrativo irrestrito, porque superusuário ignora RLS.

**O que ela faria (simples):** é a repetição, no PostgreSQL, do defeito que já aconteceu no Frappe (`permissions.py:85` curto-circuitava o hook) — a regra impede que o privilégio do Master vaze para a camada de banco.

- Evidência: "O Master SaaS não pode ser superusuário do banco nem papel administrativo irrestrito (…); no PostgreSQL o análogo é o superusuário ignorar RLS." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [pre_refinement_decision] Congelamento da API alcança o app do cliente, não `/master`

**Regra que isto sugere:** o congelamento da superfície no marco de entrega vale para as rotas que o React consome; rotas sob `/master` podem ser acrescentadas depois sem violar o marco.

**O que ela faria (simples):** deixa explícito o que "superfície congelada" cobre — sem isso, qualquer rota nova pós-marco parece violação.

- Evidência: "A superfície da API congelada do marco de entrega alcança o app do cliente, não o domínio `/master` — decidido nesta sessão." — pre-refinement §11
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-01T23:58:00Z

---

## [repeated_assertion_shape] Igualdade de conjunto com diferenças nomeadas

**Regra que isto sugere:** asserção de conjunto fechado usa um comparador que devolve excedentes e ausentes **nomeados**, nunca um booleano nem uma comparação de arrays ordenados.

**O que ela faria (simples):** o mesmo formato de asserção — comparar o observado contra o declarado e exigir `{ excedentes: [], ausentes: [] }` — aparece três vezes no mesmo arquivo, e o motivo está escrito no próprio código: reprovação que diz apenas "os conjuntos diferem" obriga quem lê a caçar o item, e essa fricção é o que faz a asserção ser afrouxada na rodada seguinte. Uma regra apontando o comparador evita que o próximo arquivo reinvente a versão booleana.

- Evidência: `expect(diferencasDeConjunto(...)).toEqual({ excedentes: [], ausentes: [] })` em três asserções distintas — `packages/auth/test/admissao.spec.ts:290`, `:299`, `:325` — T7 / barreira de admissão de sessão
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-02T11:20:00Z

---

## [repeated_fixture] Derivação da senha da carga nos testes

**Regra que isto sugere:** a derivação da senha da carga nos testes usa sempre `hashPassword` do arcabouço, nunca uma cadeia forjada à mão.

**O que ela faria (simples):** dois arquivos de teste já derivam a senha da carga pelo mesmo caminho, e o segundo precisou de um comentário de quatro linhas explicando por que não pode ser uma cadeia forjada; uma regra escrita evita que o terceiro consumidor invente a própria derivação e faça a entrada com a senha certa depender de a forja coincidir com o formato que o arcabouço confere.

- Evidência: `hashPassword` de `better-auth/crypto` como derivação da senha da carga em `packages/auth/test/identidade-efemera.ts:72` e `packages/auth/test/admissao.spec.ts:445` — T7 / barreira de admissão em `packages/auth`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-02T11:45:00Z

---

## [convention_drift] Docblock que declara fronteira em vez de absoluto

**Regra que isto sugere:** afirmação de unicidade ou contenção em docblock **nomeia o resíduo que fica de fora**, em vez de fechar em absoluto.

**O que ela faria (simples):** o repositório já pratica isso em três lugares por conta própria — `packages/db/src/acesso-identidade.ts` chama a prática de *"fronteira declarada em vez de absoluto falso"*, e o teste da própria T9 tem uma seção *"Risco residual, nomeado"* —, mas nada disso está escrito em rule ou ADR. Por isso a **mesma rodada** produziu dois docblocks de produção que fecham em absoluto (*"a única leitura"*, *"topológica"*), um deles falsificável por um único grep. Escrita, a regra uniformizaria o padrão e evitaria que a próxima rodada leia um absoluto vencido como invariante abandonado — ou tente "restaurá-lo" com uma refatoração que ninguém pediu.

- Evidência: absoluto de unicidade/contenção sem resíduo nomeado em `packages/auth/src/admissao.ts:234` e `packages/auth/src/index.ts:26`, contra o padrão já praticado em `packages/db/src/acesso-identidade.ts:27-45`; varredura em `.claude/rules/` e `docs/adr/` não encontra regra cobrindo o tema — T9 / guarda de contexto e leitura de identidade
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-02T18:40:00Z

---

## [convention_drift] Prova de mutante exige build do pacote

**Regra que isto sugere:** mutante aplicado a fonte de pacote de workspace **só vale** quando a suíte é invocada pelo script `test` do pacote, que compila antes de rodar.

**O que ela faria (simples):** os pacotes resolvem por `exports` para `dist/`, então um mutante no fonte **não chega ao SUT** quando alguém chama `vitest run` direto — a suíte fica verde e a conclusão sai **invertida**, como se o mutante tivesse sobrevivido. A regra amarra o comando à validade da prova, que a `testing-stack.md` já torna obrigatória mas **não condiciona**.

- Evidência: a primeira execução do mutante 1 da T11 passou verde contra `dist/` obsoleto; só `pnpm --filter @sysloc/api test` (script `tsc --build && tsc -p tsconfig.test.json && vitest run`) alcançou o SUT — `apps/api/package.json:5`, `.claude/rules/testing-stack.md:64`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-02T21:20:00Z

---

## [convention_drift] Precondição de CT conferida contra a semente

**Regra que isto sugere:** a "Precondição privilegiada" de um caso de teste **só afirma estado que a carga inicial efetivamente escreve**, conferido contra o fonte da semente na geração do card.

**O que ela faria (simples):** três cards desta fatia afirmaram como estado de carga algo que a semente não escreve (`senha_provisoria`, `ativo`, `suspensa_em` — todas com padrão do schema), e em cada um o executor teve de descobrir a divergência, arranjar o estado no caso e justificar por escrito por que não criou caminho de escrita. A regra manda conferir contra a semente **antes** de escrever a precondição, e o atrito desaparece na origem.

- Evidência: a §6.6 do T11 declara pessoa desativada e empresa suspensa como estado da carga; `packages/db/src/semente.ts` não escreve `ativo` nem `suspensa_em` — `apps/api/test/recusa-indistinguivel.e2e.spec.ts:87`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-02T21:20:00Z

---
