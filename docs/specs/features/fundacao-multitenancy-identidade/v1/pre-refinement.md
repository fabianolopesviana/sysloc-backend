# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `fundacao-multitenancy-identidade` — fatia F1 do programa `backend-nativo-sysloc`
- **Fonte da ideia**: texto livre (argumento do comando), ancorado em `docs/plano-backend-novo/plano-execucao.md` § "F1 — Fundação SaaS: multi-tenancy e identidade"
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-01
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**:
  - `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` — pré-refinamento do **programa**, que fatiou as 8 fases em features e propôs SDD para a F1 (ramo C, direção C2)
  - `docs/specs/features/fundacao-stack-nativa/v1/` — a F0, **concluída e provada** (7/7 tasks); é a base sobre a qual esta fatia nasce
  - _a tentativa desta mesma capacidade **no Frappe** (`saas-multi-empresa`) foi abandonada e **excluída do repositório em 2026-08-01**, por decisão do usuário: plano legado sobre um backend que morre só pode contaminar o trabalho novo. Ver `docs/plano-backend-novo/decisao-e-stack.md` §9_
  - `.claude/plans/plano-saas-decisoes.md` — decisões 2, 8, 11, 13, 14, 15, 16, 38, 39
  - `docs/adr/0008-isolamento-multi-tenant-garantido-pelo-banco.md` — **ADR nascida deste pré-refinamento** (2026-08-01, `accepted`); fixa o tripé RLS + FK composta + `SET LOCAL` e é vinculante para esta fatia
  - `docs/adr/0006-ambiente-de-verificacao-separado-do-que-atende-a-operacao.md` — ADR ativa que a suíte de isolamento consome
  - `docs/adr/0007-forma-canonica-do-contrato-da-api.md` — ADR ativa que as rotas desta fatia consomem

> **Abrangência deste artefato**: o brainstorm cobre a **F1 inteira**. A convergência do Ramo A a partiu em **duas fatias**; este arquivo vive no diretório da **primeira** e serve de entrada para o PRD dela. A segunda fatia ganha pré-refinamento próprio na sua entrada (válvula C3 do pré-refinamento do programa), reaproveitando as direções já convergidas aqui (B2, C2, D3+D2, E1).

---

## 2. Ideia Resumida (uma frase)

Construir a fundação SaaS do backend nativo — isolamento entre empresas garantido pelo banco e identidade por sessão — de modo que toda entidade de negócio das fatias seguintes nasça já isolada e já sabendo quem age.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Fatiamento: isolamento e identidade em uma fatia, duas, ou fases internas | explorar |
| B | Superfície do Master agora: o que a F1 expõe do operador do SaaS | explorar |
| C | Granularidade da permissão: perfil puro ou perfil com ajuste por usuário | explorar |
| D | Revogação e suspensão: como "morre na hora" se prova e se propaga | explorar |
| E | Onboarding: por onde a senha temporária chega ao usuário | explorar |

**Ordem deliberada de expansão**: B, C, D e E foram expandidos primeiro porque **dimensionam** a fatia; o A foi expandido depois, com o tamanho já conhecido. Fatiar antes de saber o que cabe dentro seria decidir no escuro — e o A é o ramo que comanda a recomendação de framework.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Fatiamento

**Inventário que dimensiona a fatia** (após B2 + C2 + D3&D2 + E1 fecharem): schema `empresa`/`usuario`/`acesso_usuario_app` com overrides · RLS `USING`+`WITH CHECK` · FK composta `(id, empresa_id)` · `SET LOCAL app.empresa_id` por transação · `AsyncLocalStorage`+guard · teste-guarda de RLS · suíte de isolamento parametrizada · better-auth (força de senha, lockout, sessão 8h, cookie, 2FA, auditoria de login) · 3 perfis · matriz 10×7 · overrides por usuário · sessão gorda com `versao_permissoes` · invalidação de sessão por evento · onboarding em dois caminhos (Master→Admin, Admin→Usuário) · 5 rotas do Master · prova de que o Master vê vazio. **Da ordem de 14 tasks em duas áreas críticas** (`db_migrations` e `auth`/`security`), ambas com `[qa, tech_review]` obrigatórios pela heurística de Critical Paths.

**Direções candidatas:**

- **A1 — Fatia única, SDD, com fases internas no `task_plan`**: fase 1 isolamento, fase 2 identidade, num só PRD e num só `tech_spec`.
  - _Exemplo:_ T1–T6 fecham schema, RLS, FK composta, `AsyncLocalStorage`+guard, teste-guarda e suíte; T7–T14 fecham better-auth, matriz, sessão gorda, onboarding e Master. O CA *"o SaaS existe, vazio mas completo"* fecha de uma vez só.
  - _Viabilidade:_ preserva a atomicidade do critério de aceitação e cobre num único documento duas metades que **de fato se acoplam**. Risco: run longo em duas áreas críticas, e gate que reprove tarde custa caro. Precedente contrário observado neste repositório: a tentativa desta mesma capacidade no Frappe era um SDD de 10 tasks que parou em `2/10`, com uma bloqueada e 9 rodadas de gate numa única task.

- **A2 — Duas fatias no corte isolamento × identidade**: `fundacao-isolamento-tenant` (miniSpec) e depois `identidade-e-autorizacao` (SDD).
  - _Exemplo:_ a fatia 1 prova o isolamento com um contexto de teste que define `empresa_id` explicitamente; a fatia 2 troca a fonte do contexto por "sessão do usuário autenticado".
  - _Viabilidade:_ **rebatida.** O corte atravessa exatamente o único ponto em que as duas metades se tocam — a camada 5 do plano mestre, *"a resolução nunca lê do request"*. A fonte legítima do `empresa_id` **é a sessão**; cortar ali obriga a inventar uma fonte provisória e substituí-la depois, que é a definição de retrofit — contra o **invariante 1** do `CLAUDE.md` (*"multi-tenancy é fundação, não retrofit"*). A fatia 1 só parece leve o bastante para miniSpec **porque** empurra o acoplamento para frente.

- **A3 — Duas fatias, cortando *depois* do acoplamento**: fatia 1 = isolamento **+ autenticação**; fatia 2 = autorização e ciclo de vida do acesso.
  - _Exemplo:_ a fatia 1 entrega schema, RLS, FK composta, `SET LOCAL`, `AsyncLocalStorage`+guard, teste-guarda, suíte de isolamento e better-auth com login/lockout/sessão 8h/2FA, mais os 3 perfis como rótulo — ao fim dela **dá para logar e o isolamento está provado com sessão real**, sem costura provisória. A fatia 2 entrega matriz 10×7, overrides por usuário, `versao_permissoes`, invalidação por evento, onboarding com senha temporária e as rotas do Master.
  - _Viabilidade:_ ~8 e ~6 tasks, cada uma com CA verificável de ponta a ponta e uma única área crítica dominante por fatia. O corte segue a divisão conceitual limpa **identidade** (quem você é) × **autorização** (o que você pode).

**Direção escolhida**: **A3** — duas fatias, cortando após a autenticação. A pergunta que abriu o brainstorm era "uma fatia ou duas"; a resposta convergida é *duas, mas não no corte que a pergunta sugeria*.
**Podadas / adiadas**: **A1** (defensável e mais fiel ao *"vazio mas completo"*, mas paga com um run de ~14 tasks em duas áreas críticas simultâneas) · **A2** (o corte intuitivo, rejeitado por separar a RLS da sua única fonte legítima de contexto e produzir retrofit).

### Ramo B — Superfície do Master na F1

**Direções candidatas:**

- **B1 — Master só como perfil e prova negativa**: a fatia cria o perfil, o 2FA obrigatório e o teste de que o Master vê vazio; criar empresa e Admin inicial acontece por seed/fixture.
  - _Exemplo:_ `pnpm --filter @sysloc/db seed:empresa "Imobiliária X"`; a rota nasce só no `painel-master`, depois da F7.
  - _Viabilidade:_ mínimo, e serve às F2–F5, que precisam de empresas para testar. Mas implementa suspensão e senha temporária sem nenhum caminho HTTP que as exercite.
- **B2 — Ciclo de vida da empresa em rota, e nada além**: criar empresa, criar o Admin inicial, suspender, reativar, listar.
  - _Exemplo:_ `POST /master/empresas`, `POST /master/empresas/:id/admin`, `POST /master/empresas/:id/suspensao`. A tela vem depois; o contrato congela aqui.
  - _Viabilidade:_ 4–5 rotas. As decisões 11 e 14 já obrigam o comportamento a existir; isto apenas o torna alcançável e congelável antes do handoff.
- **B3 — Master completo agora**, incluindo métricas, auditoria de login consultável e histórico de suspensão.
  - _Exemplo:_ tela de saúde do SaaS com contagem de empresas ativas e últimas falhas de login.
  - _Viabilidade:_ **[fora do escopo do projeto]** nesta fatia — `plano-execucao.md` § "Depois: `painel-master`" registra o painel como feature de produto própria, especificada **após a F7**, com persona, domínio (`syslocadmin.systera.com.br`) e ciclo de vida distintos.

**Direção escolhida**: **B2** — o comportamento já é obrigatório aqui; sem rota ele fica implementado e não exercitável, e o marco de entrega do backend exige superfície congelada antes do handoff. **Cai na fatia 2 do A3.**
**Podadas / adiadas**: **B1** (adotado apenas *dentro* da fatia 1, como fixture de teste, até as rotas chegarem na fatia 2) · **B3** (fora do escopo — é o `painel-master`, pós-F7).

### Ramo C — Granularidade da permissão

**Direções candidatas:**

- **C1 — Perfil puro**: a matriz 10×7 é constante por perfil em `@sysloc/auth`; o usuário herda tudo do perfil.
  - _Exemplo:_ todo `Usuario Empresa` vê as mesmas telas; liberar "emitir boleto" para uma pessoa exige promovê-la a Admin.
  - _Viabilidade:_ o mais simples de provar e de exibir — e **contraria a decisão 8**, que fecha *"3 perfis **+ permissões ajustáveis por usuário**"*.
- **C2 — Perfil como default, ajuste por usuário**: o perfil define o conjunto inicial; o Admin marca e desmarca telas e ações para cada pessoa.
  - _Exemplo:_ Maria é `Usuario Empresa` (sem ações sensíveis por default) e o Admin libera apenas "emitir boleto" para ela, sem lhe dar acesso a Usuários nem a Integrações bancárias.
  - _Viabilidade:_ é o que a decisão 8 e o esboço de `Acesso Usuario App` (`plano-saas-decisoes.md` §4, *"child table de telas permitidas, checks de ações sensíveis"*) descrevem. Custo concentrado: a sessão passa a carregar o **efetivo calculado**, e `versao_permissoes` tem de mudar também quando muda um override, não só quando muda o perfil.
- **C3 — Matriz cheia por usuário, perfil vira rótulo de onboarding**: cada usuário tem suas 10 telas e 7 ações marcadas individualmente na criação.
  - _Exemplo:_ criar usuário abre um formulário com 17 caixas de seleção.
  - _Viabilidade:_ transfere ao Admin um trabalho que ele hoje não faz — no Frappe atual **não existe autorização alguma** (`levantamento-frontend.md` §5: *"não existe modelo de papéis, renderização condicional por permissão, nem escopo de dados por usuário"*).

**Direção escolhida**: **C2** — é o que a decisão fechada diz, e o custo real recai sobre `versao_permissoes`, que já está no escopo. **Cai na fatia 2 do A3.**
**Podadas / adiadas**: **C1** (contraria a metade "ajustáveis por usuário" da decisão 8) · **C3** (perde o perfil como conceito de produto e sobrecarrega o Admin).

> **Achado do ancoramento**: o `plano-execucao.md` §F1 item 9 fala apenas em *"matriz 10 telas × 7 ações sensíveis"*, sem dizer se ela é atributo do perfil ou do usuário. A metade *"+ permissões ajustáveis por usuário"* da decisão 8 não aparece no texto da fase. Este ramo fecha essa lacuna.

### Ramo D — Revogação e suspensão "na hora"

**Direções candidatas:**

- **D1 — Estado consultado a cada requisição**: o guard lê usuário e empresa no banco em todo request.
  - _Exemplo:_ o Admin desmarca "cancelar contrato" às 14h02; a requisição das 14h02:01 já responde 403.
  - _Viabilidade:_ garantia máxima, ao custo de uma consulta indexada por request. Tornaria `versao_permissoes` quase redundante no servidor — ela passaria a servir só ao frontend, para saber que precisa recarregar o menu.
- **D2 — Sessão gorda + `versao_permissoes` comparada**: o efetivo viaja na sessão; o servidor recusa quando a versão da sessão diverge da corrente.
  - _Exemplo:_ a sessão da Maria diz `versao_permissoes: 7`, o servidor está em 8 → erro que o frontend traduz em "suas permissões mudaram" e recarrega o contexto.
  - _Viabilidade:_ é literalmente o item 10 da F1. Exige um lugar barato para ler a versão corrente.
- **D3 — Invalidação por evento**: suspender empresa ou desativar usuário apaga as sessões ativas no armazenamento do better-auth.
  - _Exemplo:_ suspender "Imobiliária X" apaga as 5 sessões dela; o próximo request de qualquer uma responde 401.
  - _Viabilidade:_ o mais fiel à decisão 11 (*"sessões ativas mortas na hora, não só no próximo login"*). Sozinho **não** cobre mudança de permissão numa sessão que segue legitimamente válida.

**Direção escolhida**: **D3 + D2 combinados** — são **dois eventos distintos** que o plano trata como um só. Suspensão de empresa ou desativação de usuário = a sessão deixa de existir (401, D3). Mudança de permissão = a sessão continua válida, mas o efetivo está obsoleto (D2). **Cai na fatia 2 do A3.**
**Podadas / adiadas**: **D1** — mantido como **plano B declarado**, caso a comparação de versão se mostre frágil na prática; a troca é local ao guard e não muda contrato.

### Ramo E — Onboarding e a senha temporária

**Direções candidatas:**

- **E1 — Exibida uma vez a quem cria, entregue fora de banda**.
  - _Exemplo:_ `POST /master/empresas/:id/admin` responde `{ usuario, senhaTemporaria }`, mostrada uma única vez; o Master repassa por telefone ou WhatsApp. O mesmo vale para o Admin criando usuários da empresa (decisão 39).
  - _Viabilidade:_ zero dependência externa. Não antecipa nodemailer, o remetente único do SaaS (decisão 10) nem SPF/DKIM no domínio — todos previstos só para a **F3** (`plano-execucao.md` §F3 item 6). O Mailpit da F0 é explicitamente *"só em desenvolvimento"*.
- **E2 — Por e-mail já nesta fatia**.
  - _Exemplo:_ o Admin recém-criado recebe a senha temporária no e-mail cadastrado.
  - _Viabilidade:_ puxa da F3 o emissor, o remetente do SaaS e a configuração **SPF/DKIM**, que é dependência de DNS fora do código e fora do controle do run.
- **E3 — Convite por link, com o usuário definindo a própria senha**.
  - _Exemplo:_ o Admin recebe um link de uso único válido por 24h.
  - _Viabilidade:_ **contraria as decisões 14 e 39**, que fixam senha temporária com troca obrigatória no primeiro acesso — e ainda depende de e-mail.

**Direção escolhida**: **E1** — a rota não muda quando a F3 chegar; ela apenas ganha o envio como efeito adicional. **Cai na fatia 2 do A3.**
**Podadas / adiadas**: **E2** (adiada para a F3, que é onde o canal de e-mail nasce) · **E3** (contraria decisões fechadas).

---

## 5. Problema

- **Qual é a dor real hoje?** O backend em operação **não tem conceito de empresa** (decisão 13: *"0 ocorrências de `empresa|tenant|company` nos 122 arquivos do frontend e em nenhum DocType"*) e **não sabe qual usuário está agindo** — toda escrita chega com a mesma credencial de serviço, embutida em texto claro no bundle público. Não existe modelo de papéis nem escopo de dados por usuário.
- **Como o problema aparece no dia a dia?** Uma segunda imobiliária não pode ser atendida sem que veja os dados da primeira. A tela `/usuarios` se protege reconfirmando a senha e guardando-a no `sessionStorage` do navegador. Um 403 do backend só existe num único caso, e é convertido em rótulo de UI.
- **Quem sente o impacto?** O operador do SaaS (não consegue vender para o segundo cliente), o Admin da imobiliária (não consegue delegar sem entregar tudo) e o dono do dado (não tem garantia de confidencialidade entre empresas).
- **Por que resolver agora?** Porque é a fundação: toda entidade de negócio das fatias F2–F5 nasce dentro dela. Retrofitar isolamento depois de existirem contratos, cobranças e boletos é ordens de grandeza mais caro — daí o invariante 1 do projeto.

---

## 6. Objetivo Principal

- **Resultado esperado ao final da F1 (as duas fatias):** o SaaS existe — vazio, mas completo. Dá para cadastrar empresa, criar usuário, logar, e o isolamento está provado **pelo banco**, não por validação de aplicação.
- **Resultado esperado ao final da fatia 1 (este artefato):** dá para logar com sessão real, e a empresa A não alcança dado da empresa B **mesmo com a camada de aplicação desligada**.
- **Mudança de estado:** a autorização deixa de ser uma convenção do cliente e passa a ser uma propriedade do servidor e do banco.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Admin Empresa** — quem administra a imobiliária no dia a dia, cria os usuários dela (decisão 39) e ajusta o que cada um alcança.
- **Personas secundárias**:
  - **Sysloc Master** — o operador do SaaS. Cria empresas e o Admin inicial, suspende e reativa. **Não alcança dado de negócio por nenhum caminho**, e há teste que prova.
  - **Usuário Empresa** — opera as telas que lhe foram liberadas; não administra ninguém.
- **Contexto de uso**: navegador desktop, aplicação React em `sysloc.systera.com.br` (o Master, quando ganhar tela, em `syslocadmin.systera.com.br`, depois da F7). Sessão de 8 horas renovável por atividade, cookie `httpOnly`+`Secure`+`SameSite`.

---

## 8. Escopo Inicial (resultado da convergência)

**Fatia 1 — `fundacao-multitenancy-identidade/v1` (esta):**

- [ ] `@sysloc/db` com `empresa`, `usuario` e `acesso_usuario_app` (estrutura já preparada para os overrides do C2)
- [ ] RLS habilitada com `USING` **e** `WITH CHECK` em toda tabela de negócio
- [ ] FK composta `(id, empresa_id)` como padrão de referência entre entidades tenantizadas
- [ ] `SET LOCAL app.empresa_id` por transação
- [ ] Contexto de tenant em `AsyncLocalStorage` + guard NestJS, **nunca lido do request** (camada 5)
- [ ] Teste-guarda que falha se alguma tabela de negócio nascer sem RLS habilitada
- [ ] Suíte de isolamento parametrizada, executando contra instância efêmera (ADR-0006)
- [ ] `better-auth`: senha ≥ 10 com verificação de força, lockout após 5 tentativas, sessão de 8h renovável, cookie `httpOnly`+`Secure`+`SameSite`, 2FA obrigatório para o Master e opcional para o Admin, trilha de auditoria de login
- [ ] Os 3 perfis existindo como rótulo de identidade (`Sysloc Master`, `Admin Empresa`, `Usuario Empresa`)
- [ ] Prova de que o Master enxerga vazio nos dados de negócio
- [ ] Empresas e usuários de teste criados por **fixture/seed** (B1 aplicado internamente, até as rotas chegarem na fatia 2)

**Fatia 2 — autorização e ciclo de vida do acesso** `[HIPÓTESE]` de nome: `autorizacao-e-ciclo-de-acesso/v1`:

- [ ] Matriz **10 telas × 7 ações sensíveis** em `@sysloc/auth` (decisão 38)
- [ ] Overrides por usuário sobre o default do perfil (C2, decisão 8)
- [ ] Objeto de sessão "gordo" com empresa, perfil, telas e ações liberadas, mais `versao_permissoes` (D2)
- [ ] Invalidação de sessão por evento na suspensão de empresa e na desativação de usuário (D3, decisão 11)
- [ ] Onboarding com senha temporária exibida uma vez e troca obrigatória no primeiro acesso, nos dois caminhos: Master→Admin (decisão 14) e Admin→Usuário (decisão 39) — **E1**
- [ ] Rotas do Master para o ciclo de vida da empresa: criar, criar Admin inicial, suspender, reativar, listar — **B2**

---

## 9. Fora do Escopo (podado / adiado)

- **A2 — corte isolamento × identidade** — _rebatido: separa a RLS da sua única fonte legítima de contexto e produz retrofit, contra o invariante 1._
- **A1 — fatia única de ~14 tasks** — _podado: duas áreas críticas simultâneas num só run, com precedente de SDD grande emperrado neste repositório._
- **B3 — Master completo (métricas, auditoria consultável, histórico)** — _`[fora do escopo do projeto]` nesta fatia: é a feature `painel-master`, especificada depois da F7._
- **C1 e C3 — granularidade sem override / sem perfil** — _podadas: contrariam a decisão 8 em direções opostas._
- **D1 — estado lido a cada requisição** — _não descartado: mantido como plano B declarado se a comparação de versão se mostrar frágil._
- **E2 — senha temporária por e-mail** — _adiada para a F3, que é onde nascem o emissor, o remetente único do SaaS e o SPF/DKIM._
- **E3 — convite por link** — _podado: contraria as decisões 14 e 39._
- **Qualquer código de frontend** — _fronteira declarada no `CLAUDE.md`: aqui só se faz backend; a religação do React acontece na máquina local do usuário, a partir do handoff._
- **Criptografia por campo e auditoria de acesso técnico** — _decisão 16: o usuário optou conscientemente por garantir confidencialidade **apenas na aplicação**. Quem tem root no servidor ou no banco lê os dados de qualquer empresa; é limite físico, declarado, não configurável._

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo integralmente o Frappe/ERPNext de `/opt/frappe`. Idioma pt-BR em tudo; modelo exclusivamente Opus; Protocolo Antirregressão como pré-condição de toda edição.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`):
  - `backend-nativo-sysloc/v1/pre-refinement.md` — **cobre o nível acima**: fatiou o programa em 9 features e propôs **SDD para a F1** (ramo C, direção C2), com a válvula C3 de reavaliar o peso na entrada de cada fatia. É exatamente essa válvula que este artefato aciona.
  - `fundacao-stack-nativa/v1/` — **adjacente e pré-requisito**, concluída (`_run/minispec_state.yaml`: `tasks_completed: 7`). Entrega o monorepo, PostgreSQL 18, Redis com AOF, Vitest com `embedded-postgres`, units systemd e a recuperação provada por reinício real.
  - `caracterizacao-regras-legadas/v1` — **concluída**; os 6 artefatos golden versionados são o oráculo das regras legadas. Sem sobreposição com esta fatia.
  - `integracao-bancaria-configuravel`, `contencao-credencial-exposta` — histórico Frappe, sem sobreposição com esta fatia.
  - _a mesma capacidade já tinha sido tentada no Frappe (`saas-multi-empresa`, SDD de 10 tasks parado em `2/10` com uma bloqueada). Essa feature e seu PRD foram **excluídos do repositório em 2026-08-01**; o aviso de dimensionamento que ela dava está preservado no Ramo A deste documento._
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: nenhuma ainda — não há schema, migration nem Drizzle no repositório. `@sysloc/db` **nasce nesta fatia**. A instância efêmera de teste (`embedded-postgres`) já existe, entregue pela T4 da F0.
  - **Autenticação / autorização**: **nenhuma**. `packages/shared/src/log.ts` já antecipa `better-auth` na redação de segredos, e é onde vive o débito **D25** — cujo gatilho é literalmente *"a fatia de autenticação entrar"*, ou seja, **esta**.
  - **Outros módulos internos**: `packages/shared` (contrato de erro `erros.ts`, registro estruturado `log.ts`, `ambiente.ts`), `apps/api` (NestJS+Fastify com `/health`, configuração, comum), `apps/worker` (BullMQ). `deploy/systemd/` com units e instalador idempotente.
  - **ADRs ativas consumidas**: **ADR-0008** (isolamento multi-tenant garantido pelo banco — **nasceu desta fatia**, criada em 2026-08-01, e é vinculante para ela e para toda entidade de negócio das F2 a F5), **ADR-0006** (a suíte de verificação nunca executa contra o ambiente que atende a operação — é o que a suíte de isolamento herda) e **ADR-0007** (forma canônica do contrato da API — vale para as rotas do Master e para o objeto de sessão).
- **Conflitos / sobreposições detectados**:
  - **Débito D25 dispara nesta fatia** — `packages/shared/src/log.ts` tem marcador `DÉBITO COM GATILHO` cujo gatilho é a entrada da autenticação: o `better-auth` trafega `token` e `callbackURL` em cadeia de consulta, e a redação atual não alcança esse formato. Entra como item de escopo da fatia 1.
  - **`CLAUDE.md` desatualizado** — o bloco "Estado atual" declara *"Em andamento: T5 … restam T6 e T7"*, mas a F0 está fechada (7/7, commit `9487c25`). Como esse bloco é lido por todo subagente antes de qualquer arquivo, corrigi-lo é pré-condição de iniciar a fatia. `[DÚVIDA 1]`
  - **Lacuna entre decisão 8 e o texto da F1** — a metade *"+ permissões ajustáveis por usuário"* não aparece no `plano-execucao.md` §F1 item 9. Resolvida aqui pelo Ramo C (direção C2); o `plano-execucao.md` deve ser atualizado. `[DÚVIDA 2]`
  - Nenhum conflito com ADR ativa.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` O nome da segunda fatia é `autorizacao-e-ciclo-de-acesso` — proposto aqui, ainda não registrado no `plano-execucao.md`. O nome de capacidade sobrevive mesmo que a ordem mude.
- `[HIPÓTESE]` A fatia 1 comporta ~8 tasks e a fatia 2 ~6, estimadas a partir do inventário do Ramo A; nenhuma foi dimensionada com uma `tech_spec` em mãos.
- `[HIPÓTESE]` `better-auth` cobre nativamente lockout por tentativas, verificação de força de senha e 2FA por plugin, sem exigir implementação própria — a `tech-alignment` da fatia deve confirmar contra a versão instalada.
- `[HIPÓTESE]` `embedded-postgres` (o da F0) sobe com RLS utilizável e permite conectar como papel **não superusuário** — condição necessária para a suíte de isolamento significar alguma coisa, já que superusuário **ignora RLS por padrão** no PostgreSQL.
- `[HIPÓTESE]` Os overrides por usuário (C2) cabem no mesmo `versao_permissoes` que o perfil, sem contador separado.
- `[HIPÓTESE]` A prova de "Master vê vazio" é obtenível pela própria RLS (política que não casa nenhuma linha para o contexto do Master), sem uma segunda camada de aplicação — a tradução da camada 2 no `plano-execucao.md` diz *"a mesma RLS — não há dois caminhos para o dado"*.

**Decisões já tomadas (fora de negociação)** — restrições travadas pelo usuário:

- Este projeto roda **exclusivamente em Opus** — sessão principal e **todo subagente** despachado por qualquer skill do agent-spec, incluindo executor, `agent-spec-qa-validator` e `agent-spec-staff-architecture-review`. **Sonnet e Haiku estão proibidos**, mesmo onde o `SKILL.md` os recomenda ou a heurística de `gates`/`model` os resolveria por default.
- **Todas as respostas e interações em português brasileiro** — não só documentação e mensagens de commit.
- O **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição, com força máxima em ciclo de correção de gate.
- **Aqui só se faz backend** — nenhum agente deste repositório escreve, edita ou planeja código de frontend. Task que peça implementação de frontend é gatilho de parada.
- **Multi-tenancy é fundação, não retrofit**: RLS e FK composta antes da primeira entidade de negócio.
- **O contexto de tenant nunca é lido do request** — `AsyncLocalStorage` + `SET LOCAL app.empresa_id` por transação.
- **Nenhum segredo versionado** — segredos fora do repositório, em `EnvironmentFile` 0600.
- **Decisão 2**: escala de 20 a 300 empresas ⇒ **isolamento lógico por empresa**, não banco por cliente.
- **Decisão 8**: **3 perfis** (Master SaaS, Admin Empresa, Usuário) **+ permissões ajustáveis por usuário**.
- **Decisão 11**: revogação bloqueia **na hora** — sessões ativas mortas, automações da empresa param, **nada é apagado**.
- **Decisão 13**: senha mínima de 10 com verificação de força, bloqueio após 5 tentativas, sessão de 8h renovável por atividade, cookie `httpOnly`+`Secure`+`SameSite`, 2FA opcional para Admin e **obrigatório para o Master**, trilha de auditoria de login.
- **Decisão 14**: Admin inicial recebe **senha temporária** do Master, com **troca obrigatória** no primeiro acesso.
- **Decisão 15 / 38**: permissão **por tela + ações sensíveis separadas**, com a lista fechada de **10 áreas de tela** (Resumo, Imóveis, Contratos, Cadastros, Financeiro, Automação de cobrança, Integrações bancárias, Multa e juros, Relatórios, Usuários) e **7 ações sensíveis** (emitir boleto, solicitar baixa, ativar contrato, cancelar contrato, excluir cadastro, configurar integração, enviar cobrança manual).
- **Decisão 16**: confidencialidade garantida **apenas na aplicação** — sem auditoria de acesso técnico e sem criptografia por campo. Quem tem root no servidor ou no banco lê os dados de qualquer empresa. **Risco assumido conscientemente pelo usuário.**
- **Decisão 39**: os demais usuários da empresa são criados **pelo Admin dela**, com a mesma mecânica de senha temporária.
- **O Master SaaS não pode ser superusuário do banco nem papel administrativo irrestrito** — consequência não-óbvia registrada na rodada 10 (`permissions.py:85` curto-circuitava o hook no Frappe); no PostgreSQL o análogo é o superusuário **ignorar RLS**.
- **A superfície da API congelada do marco de entrega alcança o app do cliente, não o domínio `/master`** — decidido nesta sessão. O `painel-master`, pós-F7, pode acrescentar rotas em `/master` sem violar o marco, porque o congelamento existe para tornar o handoff do React confiável.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: a matriz 10×7 com overrides por usuário pode ser complexa demais para um Admin de imobiliária que hoje não administra permissão nenhuma. → _Mitigação:_ o perfil entrega o conjunto pronto (C2), e o override é opcional — quem não mexer tem um produto igual ao C1.
- **Risco de escopo**: a F1 é a fatia com maior densidade de decisões consumidas (9) e é a única que atravessa **duas** áreas críticas. → _Mitigação:_ o corte A3 separa `db_migrations`+`auth` (fatia 1) de `security`/`authorization` (fatia 2), reduzindo o run e concentrando a atenção do gate por vez.
- **Risco técnico ou operacional**:
  - **RLS provada contra o papel errado** — se a suíte conectar como superusuário, a RLS é silenciosamente ignorada e a suíte fica verde sem provar nada. É o modo de falha mais perigoso desta fatia, porque **parece sucesso**. → _Mitigação:_ o teste-guarda deve provar também o papel de conexão, e a prova de falsificação exigida por `.claude/rules/testing-stack.md` precisa incluir um mutante que desabilite a política e veja a suíte reprovar.
  - **`FORCE ROW LEVEL SECURITY`** — o dono da tabela também escapa da RLS por default. → _Mitigação:_ tratar como item explícito do escopo, não como detalhe de migration.
  - **Débito D25 dispara agora** — a redação de segredos não alcança `token`/`callbackURL` em cadeia de consulta, formato que o `better-auth` usa. → _Mitigação:_ item de escopo da fatia 1, fechando o marcador e a linha do índice no `CLAUDE.md` no mesmo commit.
- **Risco de privacidade / segurança / compliance**: a decisão 16 declara o limite — root no servidor ou no banco lê tudo. → _Mitigação:_ nenhuma técnica; é risco **aceito e documentado**, e precisa continuar visível no PRD para não ser reinterpretado como defeito numa rodada futura de gate.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **Atualizar o bloco "Estado atual" do `CLAUDE.md`** antes de iniciar a fatia — hoje ele diz que a T5 da F0 está em andamento, quando a F0 está fechada. Todo subagente lê esse bloco antes de qualquer arquivo. É correção de uma linha, mas é pré-condição.
2. `[DÚVIDA]` **Registrar no `plano-execucao.md`** o desdobramento da F1 em duas fatias e a granularidade C2 (perfil + override por usuário), que hoje não consta do item 9 da fase. O plano é o índice do programa; sem isso ele passa a divergir do que será construído.
3. `[DÚVIDA]` **O `versao_permissoes` é por usuário, por empresa, ou os dois?** Suspender uma empresa afeta todas as sessões dela; alterar o override de uma pessoa afeta só a dela. Um contador só resolve ambos ao custo de invalidar sessões inocentes. A resolver até o PRD.
4. `[DÚVIDA]` **A trilha de auditoria de login (decisão 13) é escrita por qual fatia?** É identidade (fatia 1) por natureza, mas só se torna consultável quando o `painel-master` existir. Proposta: escrever na fatia 1, expor depois.

> Nenhuma das quatro é bloqueante para gerar o PRD — as duas primeiras são correções de documento, e as duas últimas são decisões que o próprio PRD pode fechar.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: **A3** (duas fatias, cortando após a autenticação) · **B2** (ciclo de vida da empresa em rota, fatia 2) · **C2** (perfil como default com ajuste por usuário, fatia 2) · **D3+D2** (invalidação por evento para suspensão, `versao_permissoes` para mudança de permissão, fatia 2) · **E1** (senha temporária exibida uma vez, entregue fora de banda, fatia 2) · congelamento da superfície limitado ao app do cliente.
- **Descartado com justificativa**: **A2** (corta no acoplamento e produz retrofit) · **B3** (é o `painel-master`, pós-F7) · **C1** e **C3** (contrariam a decisão 8 em direções opostas) · **E3** (contraria as decisões 14 e 39).
- **Adiado**: **A1** como forma de fatiar (permanece defensável se a fatia 2 se mostrar pequena demais para SDD própria) · **D1** como plano B do guard · **E2** para a F3, quando o canal de e-mail nascer.
- **Provocações que mudaram o rumo**:
  - *"Qual é o único ponto em que isolamento e identidade se tocam?"* — a resposta (a camada 5: a resolução do tenant nunca lê do request, logo sua fonte legítima é a sessão) **inverteu** a leitura do fatiamento: o corte intuitivo passou de óbvio a rejeitado, e um corte que ninguém tinha proposto virou a escolha.
  - *"O que a F1 constrói que ninguém consegue chamar?"* — expôs que suspensão e senha temporária estavam previstas como comportamento sem nenhuma rota que as exercitasse, o que produziu o B2.
  - *"Como a senha temporária chega, se o e-mail só nasce na F3?"* — expôs uma dependência de DNS (SPF/DKIM) que teria entrado sem ser notada.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

Dimensões avaliadas para a **fatia 1** (`fundacao-multitenancy-identidade/v1`), que é o que o próximo comando gera:

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — isolamento estrutural, resolução de contexto, autenticação por sessão, prova de isolamento e prova negativa do Master | confirmado |
| Personas | **múltiplas personas** — Sysloc Master (2FA obrigatório e a prova de que vê vazio), Admin Empresa, Usuário Empresa | confirmado |
| Novidade | **greenfield** — não existe persistência, não existe autenticação, não existe autorização; `@sysloc/db` nasce aqui | confirmado |
| Decisão arquitetural transversal nova? | **sim** — o isolamento é garantido pelo banco (RLS), não pela aplicação; a resolução do tenant nunca lê do request | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: **confirmo a proposta C2 do pré-refinamento do programa** — os três sinais de SDD estão presentes de forma independente, e bastaria um. **Múltiplas personas**: três perfis com comportamentos distintos, um deles definido por uma *proibição* verificável (o Master não alcança dado de negócio). **Greenfield com decisão arquitetural transversal nova**: a escolha de tornar a RLS o enforcement único do dado — em vez de filtro no ORM ou validação de serviço — vale para toda tabela de negócio das fatias F2 a F5 e tem custo de reversão altíssimo, exatamente o perfil de uma ADR. O que a convergência do Ramo A muda **não é o framework, é quantas vezes ele roda**: dois SDDs menores em vez de um de ~14 tasks.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): a miniSpec não comporta rastreabilidade de user story por persona nem ADR, e ambas são necessárias aqui — a fatia tem três personas com regras opostas e produz uma decisão arquitetural que as fatias seguintes vão herdar sem participar do debate. A F0 coube em miniSpec justamente porque tinha **zero persona e zero regra de negócio**; esta fatia tem as duas coisas. O único caminho que faria a miniSpec caber era o **A2**, e ele só ficava leve porque adiava o acoplamento — comprando cerimônia mais barata ao preço de um retrofit contra o invariante 1.

**Por que NÃO TaskCard** (mais distante): sub-dimensionado por três ordens de grandeza. O escopo atravessa `packages/db`, `packages/auth`, `apps/api` e a suíte de testes, com ~8 tasks, duas áreas críticas e rastreabilidade de casos de teste por critério de aceitação. TaskCard é 1 objetivo, só dev, sem decisão nova.

### 15.4 Próximo Passo

```bash
# 1. ✅ FEITO em 2026-08-01 — a decisão arquitetural transversal virou a ADR-0008
#    (docs/adr/0008-isolamento-multi-tenant-garantido-pelo-banco.md, accepted,
#     tags architecture/security/data). Ela fixa o tripé — RLS com USING e WITH CHECK,
#     FK composta (id, empresa_id) e SET LOCAL por transação — e registra que a camada
#     de aplicação NÃO tem filtro por empresa equivalente: não há dois caminhos para o dado.

# 2. Gere o PRD da fatia 1:
/agent-spec-sdd-generate-prd "fundacao-multitenancy-identidade: isolamento por empresa garantido pelo banco (RLS com USING e WITH CHECK, FK composta, SET LOCAL por transacao, contexto em AsyncLocalStorage nunca lido do request) e identidade por sessao com better-auth (senha forte, lockout, sessao de 8h, 2FA obrigatorio para o Master), com os 3 perfis como rotulo e a prova de que o Master enxerga vazio — consome a ADR-0008 (isolamento multi-tenant garantido pelo banco), que ja esta aceita e e vinculante para esta fatia"
```

> As dúvidas 1 e 2 da seção 13 — correções no `CLAUDE.md` e no `plano-execucao.md`, que todo subagente lê antes de abrir arquivo — eram pré-condição do passo 2 e **já foram resolvidas em 2026-08-01**.
>
> A **fatia 2** entra depois, com pré-refinamento próprio (`/agent-spec-pre-refinement`) que reaproveita as direções B2, C2, D3+D2 e E1 já convergidas aqui.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** — não há nível acima do SDD; o gatilho equivalente é **partir de novo**: se a `tech-alignment` da fatia 1 revelar que `better-auth` não cobre lockout, força de senha ou 2FA nativamente e cada um virar implementação própria, a autenticação passa a merecer fatia separada do isolamento (voltando a algo próximo do A2, mas pelo motivo certo).
- **Upgrade de escopo** — se surgir uma persona nova (ex.: um perfil de suporte com acesso de leitura entre empresas), ou se o `versao_permissoes` exigir infraestrutura própria (Redis, invalidação distribuída), o PRD precisa ser reaberto antes da `tech_spec`.
- **Downgrade** — se a `tech-alignment` mostrar que `better-auth` entrega quase tudo por configuração e a fatia 1 encolher para 4-5 tasks concentradas em `packages/db`, a **fatia 2 pode caber em miniSpec** (a matriz 10×7 é tabela e regra, sem persona nova além das já estabelecidas aqui). Reavaliar na entrada dela — é a válvula C3 do programa.
- **Downgrade estrutural** — se a dúvida 3 (`versao_permissoes`) for respondida com "um contador por empresa, e ponto", a fatia 2 perde a parte mais incerta do seu escopo.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]` (B3)
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com PRDs/capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
