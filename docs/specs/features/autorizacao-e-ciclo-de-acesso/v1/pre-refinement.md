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

- **Nome da Ideia / Feature**: `autorizacao-e-ciclo-de-acesso` — **segunda e última fatia da Fase 1** do programa `backend-nativo-sysloc`
- **Fonte da ideia**: `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/entrada-pre-refinamento.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-04
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**:
  - `docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md` — o brainstorm que **partiu a F1 em duas** (ramo A, direção A3) e convergiu quatro direções que caem aqui: **B2**, **C2**, **D3+D2** e **E1**
  - `docs/specs/features/fundacao-multitenancy-identidade/v1/tech_spec.md` e `_run/run-report.md` — a fatia 1, **concluída e provada no cluster real**; o terreno sobre o qual esta nasce e a fonte dos débitos herdados
  - `docs/plano-backend-novo/plano-execucao.md` §F1 — itens 9 a 12 e a tabela do desdobramento
  - `.claude/plans/plano-saas-decisoes.md` — decisões **8, 11, 13, 14, 15, 38, 39**
  - `.claude/plans/plano-saas.md` §0.5 — a lista fechada de **10 áreas de tela** e **7 ações sensíveis**
  - `docs/adr/0007-forma-canonica-do-contrato-da-api.md`, `docs/adr/0008-isolamento-multi-tenant-garantido-pelo-banco.md`, `docs/adr/0009-fronteira-identidade-negocio-por-schema.md` — ADRs ativas e vinculantes

> **Abrangência**: este artefato cobre **apenas a segunda fatia**. A primeira já foi especificada, executada e provada. As quatro direções que a fatia 1 convergiu para cá entraram como **fechadas** — o brainstorm explorou **como** implementá-las, nunca **se**.

---

## 2. Ideia Resumida (uma frase)

Fazer o SaaS saber **o que cada pessoa pode**, e reagir na hora quando isso muda — a matriz de telas e ações com ajuste por usuário, a sessão que a carrega, o ciclo de vida de empresa e pessoa em rota, e o onboarding por senha temporária.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Forma do efetivo: como override e perfil se combinam | explorar |
| B | Detecção de revogação: granularidade do `versaoPermissoes` e efeito da divergência | explorar |
| C | A recusa: o que acontece quando falta permissão, e o que o menu recebe | explorar |
| D | Ciclo de vida de empresa e pessoa: quais estados, quem os move, o que morre junto | explorar |
| E | A primeira senha: geração, entrega única, reemissão e a troca obrigatória | explorar |
| F | Dívida herdada: quanto desta fatia é fechamento do que a fatia 1 deixou aberto | **adicionado** |

**Por que o F foi adicionado**: os dois `P-T6-*` (`tasks/T8.md` §7) estão **abertos e sem dono**, e não cabem em nenhum dos cinco ramos de produto. Sem um ramo próprio, eles escorregariam para a F2 pela mesma via que os trouxe até aqui — ninguém decidir sobre eles.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Forma do efetivo (perfil como default + override por usuário)

**O terreno já constrange a escolha.** A fatia 1 criou `negocio.acesso_usuario_permissao` com `(tipo: TELA|ACAO, chave)` e **sem coluna de efeito** — ela só sabe representar permissão *concedida*. A tabela nasceu **estrutural e vazia**, sem nenhum consumidor (`packages/db/src/esquema/negocio.ts`: *"povoá-la é da fatia seguinte, e antecipar seria construir para um futuro que ainda não foi decidido"*).

**Direções candidatas:**

- **A1 — Override só aditivo**: o perfil é o piso, a tabela lista o que se soma. Efetivo = perfil ∪ concedidas.
  - _Exemplo:_ Maria é `Usuario Empresa`; o Admin acrescenta a linha `ACAO:emitir_boleto` e ela passa a emitir boleto sem alcançar Usuários nem Integrações bancárias.
  - _Viabilidade:_ **zero migração** — a tabela atual já comporta. Mas o Admin **nunca consegue tirar** nada: para que "desmarcar" signifique alguma coisa, os perfis teriam de ser pisos quase vazios, e aí o Admin volta a marcar tudo na criação de cada pessoa — que é o **C3 já podado** na fatia 1, com outro nome.
- **A2 — Override bidirecional (conceder e negar)**: coluna de efeito (`CONCEDIDA`/`NEGADA`); efetivo = (perfil ∪ concedidas) − negadas, com a negação vencendo sempre.
  - _Exemplo:_ João é `Admin Empresa` — perfil que por default alcança tudo na própria empresa —, mas o dono da imobiliária não quer que ele mexa em conta bancária: linha `ACAO:configurar_integracao` com efeito `NEGADA`. **Este caso é impossível no A1**, porque não há como subtrair do default de um perfil.
  - _Viabilidade:_ uma coluna numa tabela **vazia e sem consumidor** — entra na migração `0003` que esta fatia emite de qualquer forma. É a leitura literal do C2 fechado (*"o Admin marca e desmarca telas e ações para cada pessoa"*). Custo: precedência a fixar por escrito e três estados a exibir (herdado / concedido / negado).
- **A3 — Efetivo materializado no salvamento**: o perfil só semeia o formulário; grava-se o conjunto final por pessoa.
  - _Exemplo:_ corrigir o default do perfil `Usuario Empresa` não alcança ninguém que já exista — cada pessoa carrega o retrato do dia em que foi criada.
  - _Viabilidade:_ leitura trivial (uma consulta, sem cálculo) e `versaoPermissoes` fácil de manter. Mas mata o perfil como conceito vivo — é o **C3 podado** de novo, agora pelo lado da persistência.

**Direção escolhida**: **A2** — é o que a direção C2 fechada diz literalmente, e o custo estrutural nunca mais será tão baixo quanto agora, com a tabela vazia. O caso que decide entre A1 e A2 é concreto: **retirar uma ação sensível de um `Admin Empresa`**, que o A1 não sabe expressar.
**Podadas / adiadas**: **A1** (obriga perfis a serem pisos mínimos e reintroduz o C3) · **A3** (o perfil deixa de ser conceito vivo; corrigir um default não alcança ninguém).

> **Sub-decisão registrada, não explorada como direção**: se uma **ação sensível exige também a tela** correspondente (emitir boleto sem alcançar Financeiro), a matriz ganha uma dependência entre os dois eixos. `[DÚVIDA 1]` — não é bloqueante para o PRD, mas precisa de resposta antes da tech spec.

### Ramo B — Detecção de revogação (`versaoPermissoes`)

Este ramo responde a **dúvida 3 da fatia 1**, deixada explicitamente em aberto (*"por usuário, por empresa, ou os dois?"*).

**Achado do ancoramento que muda a pergunta**: a matriz por perfil vive em `@sysloc/auth` — é **constante de código, não dado de runtime** (item 9 da §F1). E suspensão de empresa **apaga sessões** (D3), sem usar versão nenhuma. Logo, **todo evento que resta é por-pessoa**: mudou o perfil dela, mudou um override dela.

**Direções candidatas — granularidade:**

- **B1 — Contador por usuário**: cada pessoa tem o seu, incrementado quando o perfil dela ou um override dela muda.
  - _Exemplo:_ o Admin libera "emitir boleto" para a Maria às 14h02; a sessão do João não muda em nada.
  - _Viabilidade:_ uma coluna. Precisão total, zero sessão inocente afetada, incremento numa linha só.
- **B2 — Contador por empresa**: um só por empresa; qualquer mudança invalida o efetivo de todos.
  - _Exemplo:_ mexer na Maria faz o João recarregar o contexto na próxima requisição.
  - _Viabilidade:_ só se justifica se existir permissão de **escopo empresa** que mude em runtime — módulo contratado, plano, "esta imobiliária não assinou cobrança automática". **Nenhuma decisão dessas existe** no `plano-saas-decisoes.md`.
- **B3 — Par (empresa, usuário)**: a sessão carrega os dois e diverge se qualquer um divergir.
  - _Exemplo:_ override incrementa o da pessoa; mudança de escopo-empresa incrementaria o da empresa.
  - _Viabilidade:_ cobre os dois eventos — mas o segundo **não tem nenhum gatilho que o incremente**. Infraestrutura sem evento.

**Direção escolhida**: **B1** — e isso **dissolve a dúvida 3 em vez de respondê-la**: só existe um escopo com eventos reais. Se um dia nascer permissão por empresa (plano/módulo), o B3 volta como incremento, sem quebrar contrato — acrescentar campo é retrocompatível.
**Podadas / adiadas**: **B2** e **B3** (sem evento que os alimente hoje; reavaliar se surgir permissão de escopo-empresa).

**Direções candidatas — efeito da divergência:**

- **(i) Recusar com código próprio**: o servidor responde erro; o cliente traduz em "suas permissões mudaram" e recarrega `GET /v1/sessao`.
  - _Exemplo:_ requisição das 14h02:01 devolve `409` com código novo; o React recarrega o menu e repete.
  - _Viabilidade:_ é o que o **D2 convergido descreve literalmente**. Exige código novo no enum fechado (retrocompatível pela ADR-0007) e trata mudança de permissão como **erro**, que ela não é.
- **(ii) Relê e segue**: divergiu, o servidor recarrega o efetivo do banco e atende normalmente; a sessão gorda vira **cache otimista**.
  - _Exemplo:_ o Admin revoga "cancelar contrato" às 14h02; a requisição das 14h02:01 é atendida **com o efetivo novo** — se ela for justamente cancelar contrato, responde `403`; qualquer outra passa sem o usuário perceber nada.
  - _Viabilidade:_ satisfaz o critério de aceitação *"revogação de permissão reflete na requisição seguinte"* com melhor experiência. Custa **ler um inteiro por requisição** — não montar o efetivo, apenas comparar a versão.
- **(iii) Derrubar a sessão**: divergência encerra a sessão e a pessoa loga de novo.
  - _Exemplo:_ ganhar uma permissão nova desloga a pessoa.
  - _Viabilidade:_ simples no servidor, e confunde **mudança de permissão** com **revogação de acesso** — dois eventos que o D3+D2 existe justamente para separar.

**Direção escolhida**: **(ii)** — relê e segue.
**Podadas / adiadas**: **(i)** (trata mudança de permissão como erro e gasta um código do enum) · **(iii)** (apaga a distinção entre os dois eventos do D3+D2).

> ⚠️ **Nota de conformidade com a direção fechada D2** — registrada para que nenhuma rodada futura leia isto como regressão de decisão (R3). O D2 convergido diz *"o servidor recusa quando a versão da sessão diverge da corrente"*. A escolha (ii) **preserva o mecanismo do D2** — a sessão gorda continua sendo a fonte do efetivo e `versaoPermissoes` continua sendo o comparador — e troca apenas o **efeito** da divergência. O que ela empresta é uma fatia do **D1**, que a fatia 1 guardou explicitamente como *"plano B declarado, caso a comparação de versão se mostre frágil na prática; a troca é local ao guard e não muda contrato"*: aqui a leitura por requisição é reduzida a **um inteiro**, e não ao estado inteiro que o D1 propunha. Decidido com o usuário nesta sessão, com as três direções à vista.

### Ramo C — A recusa por falta de permissão

`CodigoErro.ACESSO_NEGADO` → `403` **já existe** em `packages/shared/src/erros.ts`, documentado como *"há sessão válida, mas ela não alcança o que foi pedido"*, e a ADR-0007 já prevê o campo opcional `detalhes`.

**Direções candidatas:**

- **C1 — 403 uniforme**: toda falta de permissão responde igual, sem dizer o que faltou.
  - _Exemplo:_ `{ codigo: "ACESSO_NEGADO", mensagem: "acesso negado" }` para qualquer uma das 17 chaves.
  - _Viabilidade:_ zero superfície nova. Transfere ao suporte o trabalho de descobrir qual marcação faltava numa matriz de 10 × 7.
- **C2 — 403 nomeando a permissão exigida** no campo `detalhes`.
  - _Exemplo:_ `{ codigo: "ACESSO_NEGADO", mensagem: "acesso negado", detalhes: { exigido: "ACAO:emitir_boleto" } }` — o Admin lê a mensagem do usuário e sabe exatamente qual caixa marcar.
  - _Viabilidade:_ reusa `detalhes` da ADR-0007, sem código novo. A **RN-10** (recusas indistinguíveis) existe para o **login**, onde o ator é anônimo e a informação confirmaria a existência da conta; aqui o ator já está autenticado e **dentro da empresa**, e o menu que ele recebe já lhe diz o que ele alcança — nomear a permissão não vaza nada novo.
- **C3 — 404 para tela não liberada, 403 para ação**: esconde a existência do recurso.
  - _Exemplo:_ pedir `/v1/relatorios` sem a tela Relatórios responde "não existe".
  - _Viabilidade:_ colide com `RECURSO_NAO_ENCONTRADO`, que na ADR-0007 já significa outra coisa, e obriga o cliente a distinguir dois `404` de naturezas diferentes.

**Direção escolhida**: **C2**.
**Podadas / adiadas**: **C1** (esconde do Admin a informação que ele precisa para agir) · **C3** (sobrecarrega um código já ocupado e complica o cliente).

> **Uma decisão que acompanha o C2 e não virou direção**: o **catálogo das 10 telas e 7 ações é único**, em `@sysloc/auth`, e o vocabulário que o servidor exige é **exatamente** o que a sessão entrega ao menu. Dois catálogos — um para autorizar, outro para desenhar a navegação — divergiriam em silêncio, que é o modo de falha que a fatia 1 evitou derivando `PERFIS` do enum do schema em vez de redigitar a lista (`packages/auth/src/perfis.ts`).

### Ramo D — Ciclo de vida de empresa e pessoa

O **B2** fechado entrega as rotas do **Master** para a empresa. Fica aberto quem move o estado das **pessoas** — e o item 12 e o D3 dependem de um evento, *"desativação de usuário"*, que **nenhuma rota produz hoje**. É literalmente o argumento que gerou o B2 na fatia 1: comportamento implementado e não exercitável.

**Direções candidatas:**

- **D-i — Só o Master tem rotas**: criar empresa, criar Admin inicial, suspender, reativar, listar. Pessoas seguem por semente.
  - _Exemplo:_ desativar a Maria exige SQL na máquina.
  - _Viabilidade:_ menor escopo. Deixa a tela **Usuários** — uma das 10 da matriz — sem backend, e torna **metade do evento do D3** inalcançável por rota, repetindo exatamente o defeito que o B2 corrigiu.
- **D-ii — Master (empresa) + Admin (pessoas da própria empresa)**.
  - _Exemplo:_ `POST /v1/usuarios` (com senha temporária), `PATCH /v1/usuarios/:id/permissoes`, `POST /v1/usuarios/:id/desativacao` e a reativação simétrica — todas sob o contexto de tenant que a fatia 1 já resolve por `AsyncLocalStorage`.
  - _Viabilidade:_ é o que a **decisão 39** (*"os demais usuários da empresa são criados pelo Admin dela"*) e a tela Usuários exigem. +4-5 rotas, todas dentro da superfície que congela no marco de entrega.
- **D-iii — D-ii mais histórico de suspensão e auditoria de login consultável**.
  - _Exemplo:_ tela de saúde do SaaS com contagem de empresas ativas e últimas falhas de entrada.
  - _Viabilidade:_ **[fora do escopo do projeto]** — é o ramo **B3** da fatia 1, já classificado como a feature `painel-master`, especificada **depois da F7**, com persona e domínio próprios.

**Direção escolhida**: **D-ii, com a reativação de pessoa incluída** — sem ela, uma desativação acidental só se desfaz fora da API, e o Admin fica dependente de intervenção no servidor para um erro trivial.
**Podadas / adiadas**: **D-i** (deixa a tela Usuários sem backend e o evento do D3 pela metade) · **D-iii** (`[fora do escopo do projeto]`: é o `painel-master`, pós-F7).

> **Nenhuma rota de exclusão, em nenhum dos dois níveis.** A **decisão 11** fecha: revogação bloqueia na hora, *"automações da empresa param, **nada é apagado**"*. A ação sensível "excluir cadastro" da matriz se refere a cadastros de negócio (locador, locatário, fiador), que chegam na F2 — não a empresa nem a usuário.

### Ramo E — A primeira senha e a troca obrigatória

O **E1** fechado entrega a forma: senha temporária exibida **uma vez** a quem cria, entregue fora de banda, com troca obrigatória no primeiro acesso. Fica aberto o ciclo de vida dela.

**Direções candidatas — validade:**

- **E-i — Sem validade, com reemissão explícita**: a senha vale até ser trocada; reemitir gera outra e mata a anterior na hora.
  - _Exemplo:_ o Master anotou a senha do Admin da "Imobiliária X" num papel e perdeu → reemite pela rota, a anterior deixa de servir, e o Admin recebe a nova por telefone.
  - _Viabilidade:_ o dano de uma senha temporária vazada já é **estruturalmente limitado**: a sessão que ela abre é **restrita** e alcança apenas a própria troca — `apps/api/src/autenticacao/sessao-restrita.ts` já prova isso por comportamento, e *"o que a sessão restrita não alcança é exatamente o que a RLS protege"*.
- **E-ii — Com validade (ex.: 72h)**, mais reemissão.
  - _Exemplo:_ a senha do Admin criado na segunda-feira não entra mais na sexta; o Master reemite.
  - _Viabilidade:_ mais seguro contra a senha esquecida indefinidamente numa conversa de WhatsApp. Custa uma coluna na mesma migração **e um quarto motivo de recusa** entrando na RN-10, que hoje unifica quatro causas numa resposta indistinguível.
- **E-iii — Sem reemissão**: perdeu, cria-se outra pessoa.
  - _Exemplo:_ o Admin inicial da empresa vira dois registros, um deles morto.
  - _Viabilidade:_ ruim no caminho Master→Admin, onde o Admin inicial é único por empresa e recriar deixa sujeira permanente numa tabela onde **nada é apagado**.

**Direção escolhida**: **E-i** — sem validade, com reemissão explícita que invalida a anterior.
**Podadas / adiadas**: **E-ii** (adiada — a mitigação que ela traz é parcialmente coberta pela sessão restrita, e o custo é um quinto caso na RN-10; se voltar, volta como uma coluna) · **E-iii** (produz registro morto numa base onde nada se apaga).

**Direções candidatas — topologia da troca de senha (é onde mora o D21):**

Hoje `/v1/auth/change-password` é rota **nativa do arcabouço**, publicada pelo encaminhador `@All('*')` de `apps/api/src/autenticacao/autenticacao.controller.ts`. O **D21** mediu, no pacote instalado, que ela grava a credencial nova e apaga as sessões **antes** de o gancho da barreira rodar: uma pessoa desativada ou de empresa suspensa que tente trocar a senha sai com a senha trocada, todas as sessões apagadas e um `401` que a RN-10 torna indistinguível de "senha atual errada" — **perda de acesso irreversível com a resposta afirmando que nada aconteceu**.

- **E-t1 — Rota própria do produto, nativa desligada**: `POST /v1/sessao/senha` no modelo camelCase, e o encaminhador deixa de publicar `/change-password`.
  - _Exemplo:_ a única forma de trocar senha passa a ser a rota que confere **antes** de escrever.
  - _Viabilidade:_ fecha o D21 **pela topologia** — a rota que escreve antes de conferir deixa de existir, em vez de ganhar mais uma guarda. É o que o próprio débito pede (*"barrar antes da escrita — topologia por rota"*). Muda o inventário que o `CT-018 (d)` fixa por asserção, e reduz de seis para cinco as rotas de `/v1/auth` fora do documento OpenAPI.
- **E-t2 — Manter a nativa e barrar antes**: continua encaminhando, com verificação instalada antes da escrita de credencial.
  - _Exemplo:_ a mesma rota de hoje, com uma guarda nova na frente.
  - _Viabilidade:_ menos superfície nova, e a correção fica **acoplada ao comportamento interno do arcabouço** — a ordem `updateAccount` → `deleteUserSessions` → `createSession` medida em `better-auth@1.6.25` pode mudar a cada atualização, e a defesa silenciosamente deixa de proteger.
- **E-t3 — As duas convivem**: rota do produto para o React, nativa preservada para o cliente oficial do arcabouço.
  - _Viabilidade:_ exige que a defesa cubra duas topologias, e a segunda continua sendo a que escreve antes de conferir.

**Direção escolhida**: **E-t1** — rota própria, nativa desligada.
**Podadas / adiadas**: **E-t2** (amarra a defesa a detalhe interno de dependência de terceiro) · **E-t3** (mantém viva justamente a topologia defeituosa).

### Ramo F — Dívida herdada da fatia 1

**Direções candidatas:**

- **F1 — Só o obrigatório**: D7 e D21, sem os quais a fatia não funciona.
  - _Exemplo:_ o onboarding é escrito, o D5 continua aberto e os dois `P-T6-*` seguem sem dono.
  - _Viabilidade:_ menor diff. Reproduz exatamente o problema que a entrada aponta: os `P-T6-*` escorregam para a F2 pela mesma via que os trouxe até aqui.
- **F2 — O obrigatório mais tudo que compartilha a migração `0003` ou o caminho já reaberto**: D7, D21, D5, `P-T6-1` e a metade acionável do `P-T6-2` (ligar o limitador de taxa nativo).
  - _Exemplo:_ o valor novo do enum `desfecho_tentativa` entra na mesma migração que cria a coluna de efeito do A2 e o `versaoPermissoes` do B1.
  - _Viabilidade:_ é o **momento barato, e ele não se repete**. Pela ADR-0007, acrescentar valor a enum fechado é retrocompatível — mas o `P-T6-1` registra que, depois de a coluna acumular volume, separar as causas exige **migração sobre dados**. E o limitador é uma configuração no caminho de entrada que esta fatia reabre de qualquer forma ao criar pessoas.
- **F3 — Tudo, incluindo a retenção da trilha**: acrescenta a política de purga de `identidade.tentativa_login` (janela, timer).
  - _Viabilidade:_ retenção é **política operacional** — timer systemd, janela, prova em cluster —, e puxar operação para dentro de uma fatia de autorização amplia a superfície de gate sem relação com o tema.

**Direção escolhida**: **F2** — com o `P-T6-2` **dividido honestamente**: ligar o limitador entra; decidir retenção vira **débito com gatilho** endereçado à operação/F7.
**Podadas / adiadas**: **F1** (deixa os `P-T6-*` sem dono, que é o problema declarado) · **F3** (retenção é política operacional, não autorização).

**O que entra, item a item:**

| Item | Por que entra aqui |
|---|---|
| **D7** (`packages/auth/src/autenticacao.ts`) | **Bloqueante.** Criar pessoa pelo adaptador é inexequível hoje; o gatilho é a primeira rota de criação de pessoa, que é o onboarding desta fatia. Tem eixo de segurança: `perfil` aberto é **elevação de privilégio**, `empresa_id` aberto é **fuga de tenant** — a correção declara os dois como campos adicionais com escrita fechada. |
| **D21** (mesmo arquivo) | Dono declarado é esta fatia. Fechado pelo **E-t1**, na topologia. |
| **D5** (`packages/db/src/esquema/negocio.ts`) | O custo *"se materializa na fatia de autorização"*, e o débito adverte: *"sem o registro no ponto, a conciliação tende a nascer como validação de aplicação"* — o padrão que a ADR-0008 rejeita nominalmente. Esta fatia calcula o efetivo cruzando as duas pontas, então é ela quem paga. |
| **P-T6-1** (enum `desfecho_tentativa`) | Esta fatia já emite a migração `0003`. Depois que a coluna acumular volume, separar as causas exige migração sobre dados. |
| **P-T6-2, metade** (limitador de taxa) | O caminho de entrada é reaberto aqui pela criação de pessoas; a §11.5 da tech spec da fatia 1 já declara o limitador como *"camada adicional, e não substituto"* do bloqueio por conta — falta ligá-lo. |

**O que fica fora, com dono nomeado:** a **retenção de `identidade.tentativa_login`** (outra metade do `P-T6-2`) → débito com gatilho para a F7/operação.

---

## 5. Problema

- **Qual é a dor real hoje?** Depois da fatia 1 **dá para logar e o isolamento está provado**, mas o sistema **não sabe o que ninguém pode**. Os três perfis existem apenas como rótulo de identidade — `packages/auth/src/perfis.ts` declara por escrito: *"nesta fatia o perfil é apenas rótulo (RN-13): nenhuma decisão de permissão é tomada a partir dele"*. A tabela de permissões existe **vazia**, `GET /v1/sessao` publica oito campos e **nenhum** deles diz o que a pessoa alcança, e não há rota alguma para criar empresa, criar pessoa, suspender ou reativar: tudo isso só acontece por semente.
- **Como o problema aparece no dia a dia?** O Master não consegue admitir um cliente novo sem alguém rodar SQL no servidor. O Admin da imobiliária não consegue delegar sem entregar tudo — que é o mesmo problema do backend antigo, onde *"não existe modelo de papéis, renderização condicional por permissão, nem escopo de dados por usuário"* (`levantamento-frontend.md` §5). E a suspensão de uma empresa inadimplente é comportamento previsto por decisão sem nenhum caminho que a exercite.
- **Quem sente o impacto?** O **Sysloc Master**, que não consegue operar o SaaS pela API; o **Admin Empresa**, que não consegue delegar em partes; e o **Usuário Empresa**, que hoje ou tem acesso a tudo ou não existe.
- **Por que resolver agora?** Porque é o que falta para valer o *"ao fim da F1 o SaaS existe — vazio, mas completo"*, e porque **duas fatias inteiras dependem disso estruturalmente**: as rotas que nascem aqui entram na superfície que **congela** no marco de entrega, e o `@sysloc/contracts` que o React vai importar é gerado a partir delas.

---

## 6. Objetivo Principal

- **Resultado esperado ao final desta fatia:** o SaaS pode ser **operado inteiramente pela API** — criar empresa, criar o Admin dela, o Admin criar as pessoas e ajustar o que cada uma alcança, suspender e reativar —, e cada requisição é autorizada contra o efetivo da pessoa, que reflete a última mudança **na requisição seguinte**.
- **Resultado esperado ao final da F1 (as duas fatias):** *"o SaaS existe — vazio, mas completo"*. Tudo que a F2 a F5 construírem nasce dentro disso.
- **Mudança de estado:** a autorização deixa de ser **rótulo** e passa a ser **decisão** — tomada no servidor, a partir de dado que o banco isola e que a sessão carrega.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Admin Empresa** — cria as pessoas da imobiliária (decisão 39), ajusta o que cada uma alcança (A2), desativa e reativa. É quem opera a matriz no dia a dia, e é ele quem lê a mensagem de recusa do C2 para saber qual caixa marcar.
- **Personas secundárias**:
  - **Sysloc Master** — o operador do SaaS: cria empresa, cria o Admin inicial, suspende, reativa, lista. Segue **sem alcançar dado de negócio por nenhum caminho**, e a fatia 1 já provou isso.
  - **Usuário Empresa** — opera o que lhe foi liberado; não administra ninguém. É quem sente a revogação refletir na requisição seguinte.
- **Contexto de uso**: navegador desktop, aplicação React em `sysloc.systera.com.br`; o Master ganha tela própria só depois da F7 (`syslocadmin.systera.com.br`). Sessão de 8h renovável, cookie `httpOnly`+`Secure`+`SameSite`. A senha temporária trafega **fora de banda** — telefone ou WhatsApp —, porque o canal de e-mail só nasce na F3.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Catálogo canônico** das 10 áreas de tela e 7 ações sensíveis em `@sysloc/auth`, fonte única para o enforcement do servidor **e** para o menu do cliente (decisões 15 e 38)
- [ ] **Matriz por perfil** como default, em código, para os três perfis
- [ ] **Override bidirecional por usuário** (**A2**): coluna de efeito em `negocio.acesso_usuario_permissao`; efetivo = (perfil ∪ concedidas) − negadas, com a negação vencendo
- [ ] **`versaoPermissoes` por usuário** (**B1**), incrementado quando o perfil da pessoa ou um override dela muda
- [ ] **Sessão gorda**: `GET /v1/sessao` passa a publicar telas e ações efetivas mais `versaoPermissoes`
- [ ] **Divergência relê e segue** (**B-ii**): o servidor compara a versão por requisição e, ao divergir, recarrega o efetivo e atende — a revogação reflete na requisição seguinte sem erro visível
- [ ] **Recusa nomeando a exigência** (**C2**): `403 ACESSO_NEGADO` com `detalhes.exigido`, na forma da ADR-0007
- [ ] **Invalidação de sessão por evento** (**D3**): suspender empresa ou desativar pessoa **apaga as sessões ativas** — 401 na requisição seguinte
- [ ] **Rotas do Master** (**B2**): criar empresa, criar o Admin inicial, suspender, reativar, listar
- [ ] **Rotas do Admin** (**D-ii**): criar pessoa, ajustar permissões, desativar, reativar — no contexto de tenant que a fatia 1 resolve
- [ ] **Onboarding por senha temporária** (**E1** + **E-i**): exibida uma vez a quem cria, sem validade, com reemissão que invalida a anterior; troca obrigatória no primeiro acesso, nos dois caminhos (Master→Admin e Admin→Usuário)
- [ ] **Rota própria de troca de senha** (**E-t1**): `POST /v1/sessao/senha` no modelo do produto, e `/v1/auth/change-password` deixa de ser publicada
- [ ] **Fechamento de dívida** (**F2**): **D7** (campos adicionais com escrita fechada), **D21** (fechado pelo E-t1), **D5** (conciliação `acesso_usuario_app.empresa_id` × `identidade.usuario`), **P-T6-1** (valor novo em `desfecho_tentativa`, migração `0003`) e **P-T6-2 parcial** (ligar o limitador de taxa nativo)

---

## 9. Fora do Escopo (podado / adiado)

- **A1 e A3 — override só aditivo / efetivo materializado** — _podadas: reintroduzem, por caminhos opostos, o C3 que a fatia 1 já havia podado._
- **B2 e B3 — contador por empresa / par empresa+usuário** — _adiadas: nenhum evento os incrementa hoje; voltam se nascer permissão de escopo-empresa._
- **(i) e (iii) — recusar por divergência / derrubar a sessão** — _podadas: tratam mudança de permissão como erro ou como revogação de acesso._
- **C1 e C3 — recusa muda / recusa por 404** — _podadas: escondem do Admin a informação que ele precisa, ou sobrecarregam um código já ocupado._
- **D-iii — histórico de suspensão e auditoria consultável** — _`[fora do escopo do projeto]`: é a feature `painel-master`, depois da F7 (ramo B3 da fatia 1)._
- **E-ii — senha temporária com validade** — _adiada: a sessão restrita já limita o dano, e o custo é um quinto caso na RN-10._
- **E-iii — sem reemissão** — _podada: produz registro morto numa base onde nada é apagado._
- **E-t2 e E-t3 — manter a rota nativa de troca de senha** — _podadas: mantêm viva a topologia que escreve antes de conferir._
- **Retenção de `identidade.tentativa_login`** — _adiada para a operação/F7: é política operacional, não autorização. Fica com débito com gatilho._
- **Envio da senha temporária por e-mail** — _adiado para a F3, onde nascem o emissor, o remetente único do SaaS e o SPF/DKIM._
- **Reabrir qualquer entrega da fatia 1** — schema e RLS, FK composta, `SET LOCAL`, `AsyncLocalStorage`, guarda de cobertura, `better-auth`, barreira de admissão, recusas indistinguíveis da RN-10 — _entregue e provado no cluster real; tocar nisso é regressão._
- **Qualquer código de frontend** — _fronteira do `CLAUDE.md`: aqui só se faz backend._

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo o Frappe/ERPNext de `/opt/frappe`. Português brasileiro em tudo, **exclusivamente Opus**, Protocolo Antirregressão como pré-condição de toda edição, e a fronteira que proíbe frontend.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`):
  - `fundacao-multitenancy-identidade/v1` — **a fatia irmã, concluída e provada**. Dela vêm as quatro direções fechadas (B2, C2, D3+D2, E1), a dúvida 3 (resolvida aqui pelo Ramo B) e os cinco itens de dívida do Ramo F.
  - `fundacao-stack-nativa/v1` — a F0, concluída; entrega o monorepo, PostgreSQL 18, Redis, Vitest com `embedded-postgres` e as units systemd.
  - `caracterizacao-regras-legadas/v1` — concluída; oráculo das regras legadas para a F3 e a F5. **Sem sobreposição.**
  - `backend-nativo-sysloc/v1` — o pré-refinamento do **programa**, que propôs SDD para a F1 com a **válvula C3** de reavaliar o peso na entrada de cada fatia. É essa válvula que este artefato aciona.
  - `integracao-bancaria-configuravel`, `contencao-credencial-exposta` — histórico Frappe, sem sobreposição.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: `@sysloc/db` com os dois schemas da ADR-0009. `negocio.acesso_usuario_app` e `negocio.acesso_usuario_permissao` **já existem** — a segunda com `(tipo: TELA|ACAO, chave)`, vazia e sem consumidor. `identidade.usuario` já tem `perfil`, `empresa_id`, `ativo`, `senha_provisoria` e o `CHECK` que amarra Master ⇔ sem empresa. `identidade.empresa` já tem `suspensa_em`. Migrações `0000`–`0002` aplicadas; esta fatia emite a **`0003`**.
  - **Autenticação**: `@sysloc/auth` com `admissao.ts` (barreira única, `MOTIVOS_DE_RECUSA`, `RESTRICOES_DE_SESSAO`), `bloqueio.ts`, `senha.ts`, `auditoria.ts`, `perfis.ts` (os três perfis derivados do enum do schema).
  - **Autorização**: **nenhuma** — é o que nasce aqui.
  - **API**: `apps/api` com o prefixo `/v1`, `contexto.guard.ts` (resolve a sessão e fixa o tenant), `sessao.controller.ts` (`GET /v1/sessao`, oito campos), `sessao-restrita.ts` (o que uma sessão restrita alcança), `filtro-excecao.ts` (envelope da ADR-0007) e o encaminhador `@All('*')` de `/v1/auth`.
  - **Contrato de erro**: `CodigoErro.ACESSO_NEGADO` → `403` **já existe**, com `detalhes` previsto pela ADR-0007.
  - **ADRs ativas consumidas**: **ADR-0007** (forma canônica do contrato — o envelope de erro, o camelCase, o enum fechado de código), **ADR-0008** (isolamento pelo banco — **nenhum filtro por empresa na aplicação**, o que vincula o cálculo do efetivo) e **ADR-0009** (fronteira identidade × negócio por schema — a razão de `identidade.usuario` não ser tenantizada, e a raiz do D5).
- **Conflitos / sobreposições detectados**:
  - **Nenhuma sobreposição de feature.** Todo item deste escopo é um dos itens 9 a 12 da §F1 ou dívida explicitamente endereçada a esta fatia.
  - **Nenhum conflito com ADR ativa.** O A2 e o B1 vivem no schema `negocio`, sob RLS, e o efetivo é calculado **sem filtro por empresa na aplicação** — a RLS é o único caminho para o dado, como a ADR-0008 exige.
  - **O E-t1 muda um inventário fixado por asserção**: desligar `/change-password` altera o conjunto que o `CT-018 (d)` da fatia 1 audita. É mudança **legítima e deliberada**, não regressão — mas precisa entrar na spec com esse nome, para que o gate não a leia como teste enfraquecido.
  - **A superfície de `/v1/auth` fora do OpenAPI encolhe de seis para cinco rotas.** O dono declarado dessa pendência continua sendo a publicação do `@sysloc/contracts`, não esta fatia.
  - **`grep` de marcadores**: `packages/auth/src/autenticacao.ts` carrega os marcadores do **D7** e do **D21**; os dois são endereçados aqui, e o Protocolo Antirregressão §3-B manda **remover marcador e linha do índice do `CLAUDE.md` no mesmo commit da correção**.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` A matriz por perfil é **constante de código** em `@sysloc/auth`, e não configuração por empresa. É a leitura do item 9 da §F1 (*"autorização própria em `@sysloc/auth`"*), e é o que sustenta a escolha B1 — se um dia houver plano/módulo por empresa, o B3 volta.
- `[HIPÓTESE]` A coluna de efeito do A2 cabe na tabela existente sem alterar as chaves que ela já declara — a única restrição em jogo é a ausência de unicidade em `(acesso_id, tipo, chave)`, que a `0003` precisa acrescentar para que "conceder" e "negar" a mesma chave não coexistam.
- `[HIPÓTESE]` Ler `versaoPermissoes` por requisição (B-ii) é barato o bastante para não exigir cache — é um inteiro numa linha já indexada por chave primária. A tech spec deve confirmar contra o custo real do `SET LOCAL` já em vigor.
- `[HIPÓTESE]` A correção do D7 (campos adicionais com escrita fechada) **não inviabiliza o onboarding server-side** — o próprio débito registra a medição de que `transformInput` nunca consulta `input`, então a criação continua passando o par. A medição vale para `better-auth@1.6.25` e precisa ser reconfirmada se a versão mudar.
- `[HIPÓTESE]` Desligar `/change-password` do encaminhador `@All('*')` é exequível sem quebrar as demais rotas nativas — o encaminhador é um manipulador só, e a recusa seletiva precisa acontecer dentro dele.
- `[HIPÓTESE]` Esta fatia comporta **~10-12 tasks**; estimado do inventário da seção 8, sem tech spec em mãos.

**Decisões já tomadas (fora de negociação)** — restrições travadas pelo usuário:

- Este projeto roda **exclusivamente em Opus** — sessão principal e **todo subagente**, executor e gates inclusive. **Sonnet e Haiku estão proibidos**, mesmo onde a heurística do framework os resolveria por default.
- **Todas as respostas e interações em português brasileiro**, não só a documentação.
- O **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição, com força máxima em ciclo de correção de gate. **Nenhuma correção reabre o que já foi fechado.**
- **Aqui só se faz backend** — task que peça implementação de frontend é gatilho de parada.
- **Nada da fatia 1 se reabre**: schema e RLS, FK composta, `SET LOCAL`, `AsyncLocalStorage`, guarda de cobertura, `better-auth`, barreira de admissão, recusas indistinguíveis da RN-10 e os 3 perfis como rótulo.
- **As quatro direções convergidas pela fatia 1 são fechadas** — **B2** (ciclo de vida da empresa em rota, e nada além), **C2** (perfil como default, ajuste por usuário), **D3+D2** (suspensão/desativação apaga sessões; mudança de permissão mantém a sessão e compara `versaoPermissoes`) e **E1** (senha temporária exibida uma vez, entregue fora de banda). Explorar **como**, nunca **se**; inviabilidade contra o terreno é motivo de **parar e escalar**.
- **Decisão 8**: 3 perfis **+ permissões ajustáveis por usuário**.
- **Decisão 11**: revogação bloqueia **na hora** — sessões ativas mortas, automações param, **nada é apagado**.
- **Decisão 14**: o Admin inicial recebe **senha temporária** do Master, com **troca obrigatória** no primeiro acesso.
- **Decisão 39**: os demais usuários da empresa são criados **pelo Admin dela**, com a mesma mecânica.
- **Decisões 15 / 38**: permissão **por tela + ações sensíveis separadas**, com a lista fechada de **10 áreas de tela** e **7 ações sensíveis**.
- **A superfície da API congela no marco de entrega** — as rotas que esta fatia criar são as que o `@sysloc/contracts` publica e o React consome. O congelamento alcança o app do cliente, não o domínio `/master`.
- **Os 8 invariantes do `CLAUDE.md`**, com destaque para o 1 (multi-tenancy é fundação), o 2 (contexto nunca lido do request) e o 6 (a API fala camelCase).

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: a matriz 10×7 com override bidirecional pode ser complexa demais para um Admin que hoje não administra permissão nenhuma. → _Mitigação:_ o perfil entrega o conjunto pronto e o override é **opcional** — quem não mexer tem um produto igual ao de perfil puro. O C2 (recusa nomeando a exigência) é o que torna a matriz **diagnosticável** quando alguém mexe.
- **Risco de escopo**: é a fatia que mais **cria rotas** (9-10) e ela as cria dentro da superfície que **congela**. Errar a forma aqui custa o handoff inteiro. → _Mitigação:_ a ADR-0007 já fixa envelope, camelCase e enum fechado, e a fatia 1 já provou os três em produção.
- **Risco técnico ou operacional**:
  - **O efetivo calculado é o novo caminho para o dado.** Se ele for montado com filtro por empresa na aplicação, a ADR-0008 é violada nominalmente. → _Mitigação:_ o cálculo roda sob o contexto que a fatia 1 já fixa por `SET LOCAL`; a RLS é quem escopa, não um `WHERE`. É exatamente o que o **D5** adverte.
  - **Elevação de privilégio pelo D7.** `perfil` aberto à escrita por request é elevação; `empresa_id` aberto é **fuga de tenant**, contra o invariante 2. E o `CHECK` existente **cobre só metade do espaço** — a troca lateral entre empresas mantendo `ADMIN_EMPRESA` passa por ele, e nenhuma suíte pega, porque `identidade` não tem RLS por decisão da ADR-0009. → _Mitigação:_ escrita fechada nos campos adicionais **e** prova de falsificação sobre a rota nativa que os alcançaria.
  - **A negação que não vence.** No A2, se a precedência não for provada por teste, um override `NEGADA` pode ser silenciosamente ignorado por um caminho de leitura — e uma permissão retirada continuar valendo. → _Mitigação:_ prova de falsificação obrigatória sobre a precedência, com mutante que inverta a ordem.
  - **Desligar `/change-password` mexe num inventário fixado por asserção** (`CT-018 (d)`). → _Mitigação:_ declarar a mudança como item de escopo, com a razão escrita — não como ajuste de teste.
- **Risco de privacidade / segurança / compliance**: a **decisão 16** segue valendo — confidencialidade garantida apenas na aplicação, sem criptografia por campo; quem tem root lê tudo. Risco **aceito e documentado**, que precisa continuar visível para não ser reinterpretado como defeito numa rodada de gate.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **Uma ação sensível exige também a tela correspondente?** "Emitir boleto" faz sentido para quem não alcança Financeiro? Se sim, a matriz ganha uma dependência entre os dois eixos e o efetivo passa a ter validação de coerência. Se não, os dois eixos são independentes e uma ação pode existir sozinha. **A resolver até a tech spec.**
2. `[DÚVIDA]` **O que acontece com o `versaoPermissoes` quando a pessoa muda de perfil?** Incrementa (é mudança de permissão) — mas os **overrides antigos** continuam valendo sobre o perfil novo, ou são zerados? Um `Usuario Empresa` promovido a `Admin Empresa` carregando uma negação antiga é um Admin mutilado que ninguém entende. **A resolver até o PRD.**
3. `[DÚVIDA]` **A reativação de empresa restaura as sessões?** Não — elas foram apagadas. Confirmar que a expectativa é "todos precisam logar de novo", e que isso é aceitável para uma suspensão por inadimplência resolvida em minutos.
4. `[DÚVIDA]` **O Master pode ajustar permissões de pessoas de uma empresa?** O B2 diz "ciclo de vida da empresa em rota, e nada além", e o D-ii dá o ajuste ao Admin. A leitura consistente é **não** — o Master cria o Admin inicial e para aí. Confirmar, porque isso define se existe rota de socorro quando o Admin único se tranca para fora.

> Nenhuma das quatro bloqueia a geração do PRD — as duas primeiras são decisões de produto que o próprio PRD fecha, e as duas últimas são confirmações de expectativa.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: **A2** (override bidirecional) · **B1** (`versaoPermissoes` por usuário) · **B-ii** (divergência relê e segue) · **C2** (403 nomeando a exigência) · **D-ii** (rotas do Master **e** do Admin, com reativação de pessoa) · **E-i** (senha temporária sem validade, com reemissão) · **E-t1** (rota própria de troca de senha, nativa desligada) · **F2** (D7, D21, D5, P-T6-1 e o limitador do P-T6-2).
- **Descartado com justificativa**: **A1** e **A3** (reintroduzem o C3 podado, por caminhos opostos) · **(i)** e **(iii)** do Ramo B (tratam mudança de permissão como erro ou como revogação) · **C1** e **C3** (escondem do Admin o que ele precisa saber, ou sobrecarregam um código ocupado) · **D-i** (deixa a tela Usuários sem backend) · **D-iii** (`[fora do escopo do projeto]` — é o `painel-master`) · **E-iii** (registro morto) · **E-t2** e **E-t3** (mantêm viva a topologia que escreve antes de conferir) · **F1** (deixa os `P-T6-*` sem dono) · **F3** (puxa operação para dentro de autorização).
- **Adiado**: **B2/B3** (voltam se nascer permissão de escopo-empresa) · **E-ii** (validade da senha temporária, se a entrega fora de banda se mostrar frouxa) · **retenção de `tentativa_login`** (operação/F7) · **envio por e-mail** (F3).
- **Provocações que mudaram o rumo**:
  - *"A matriz por perfil é dado de runtime ou constante de código?"* — a resposta **dissolveu a dúvida 3 da fatia 1** em vez de respondê-la: se o perfil é código e a suspensão apaga sessões, não sobra nenhum evento de escopo-empresa, e o contador por empresa vira infraestrutura sem gatilho.
  - *"Qual é o caso concreto que o override aditivo não sabe expressar?"* — retirar uma ação sensível de um `Admin Empresa`. Foi o que separou A1 de A2 sem apelo à teoria.
  - *"O que a fatia constrói que ninguém consegue chamar?"* — a mesma pergunta que gerou o B2 na fatia 1, aplicada de novo: a desativação de pessoa era metade do evento do D3 e **nenhuma rota a produzia**. Produziu o D-ii.
  - *"O D21 se fecha com mais uma guarda ou tirando a rota?"* — expôs que barrar antes da escrita amarraria a defesa à ordem interna de uma dependência de terceiro, que muda a cada atualização.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — efetivo com override, detecção de revogação, forma da recusa, ciclo de vida em dois níveis, onboarding com senha temporária, fechamento de dívida | confirmado |
| Personas | **múltiplas personas** — Sysloc Master, Admin Empresa e Usuário Empresa, com **regras opostas**: o Master opera empresas e não alcança dado de negócio; o Admin administra pessoas da própria empresa; o Usuário só opera o que lhe liberaram | confirmado |
| Novidade | **incremento** sobre a fundação da fatia 1 — `@sysloc/db`, `@sysloc/auth` e `apps/api` já existem; a **autorização** é que nasce do zero | confirmado |
| Decisão arquitetural transversal nova? | **sim** — o efetivo de permissão é calculado do perfil com overrides bidirecionais, **viaja na sessão** e é revalidado por comparação de versão por usuário, com releitura em vez de recusa. Vale para **toda rota das F2 a F5** | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: **confirmo o SDD que o plano indica**, e por razões que a entrada pediu para verificar em vez de assumir. As duas dimensões decisivas são **múltiplas personas** e a **decisão arquitetural transversal nova** — e cada uma bastaria sozinha. As três personas não são variações de acesso: elas têm regras **mutuamente exclusivas**, uma delas definida por uma proibição verificável (o Master não alcança dado de negócio), e a matriz 10×7 existe justamente para diferenciá-las. E o mecanismo de autorização que nasce aqui — efetivo na sessão, comparado por versão e recarregado em vez de recusado — é consumido por **toda rota que as fatias F2 a F5 escreverem**, sem que elas participem do debate: é o perfil exato de uma ADR. O que **não** sustenta o SDD, e vale registrar por honestidade, é a novidade: isto é **incremento** sobre uma fundação já provada, não greenfield.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): a miniSpec não comporta rastreabilidade de user story por persona nem ADR, e as duas são necessárias. A **válvula C3** do pré-refinamento do programa previa explicitamente reavaliar isto na entrada da fatia, e o gatilho de downgrade que a fatia 1 registrou era *"se a matriz 10×7 for tabela e regra, sem persona nova"*. A **primeira metade é verdadeira, a segunda não é**: não há persona nova, mas as três existentes passam a ter **comportamento diferenciado pela primeira vez** — até aqui o perfil era rótulo. Some-se que a fatia cria ~9-10 rotas dentro da superfície que **congela** no marco de entrega, e cruza `db_migrations`, `auth` e `security` — três categorias de Critical Path, todas com `[qa, tech_review]` obrigatórios. O outro gatilho de downgrade registrado — *"se a dúvida 3 for respondida com um contador por empresa, e ponto"* — **disparou ao contrário**: o Ramo B a dissolveu com um contador por usuário, o que reduz incerteza mas não reduz superfície.

**Por que NÃO TaskCard** (mais distante): sub-dimensionado por ordens de grandeza. O escopo atravessa `packages/auth`, `packages/db` (migração `0003`), `apps/api` e a suíte, com ~10-12 tasks, cinco itens de dívida herdada com eixo de segurança, e rastreabilidade de caso de teste por critério de aceitação. TaskCard é 1 objetivo, só dev, sem decisão nova.

### 15.4 Próximo Passo

```bash
# 1. Registre a decisão arquitetural transversal ANTES do PRD — ela passa nos 5 critérios:
#    transversal (toda rota das F2-F5 a consome), tag auth/security, custo de reversão alto
#    (muda toda rota já escrita), surpreendente sem contexto (por que a sessão carrega o
#    efetivo em vez de o servidor consultar o banco?), e trade-off real (D1 consulta a cada
#    requisicao, A1 override aditivo e A3 efetivo materializado foram considerados e rejeitados).
/agent-spec-adr-create "efetivo de permissao calculado do perfil com overrides bidirecionais, transportado na sessao e revalidado por versao por usuario"

# 2. Gere o PRD da fatia:
/agent-spec-sdd-generate-prd "autorizacao-e-ciclo-de-acesso: matriz de 10 telas e 7 acoes sensiveis em @sysloc/auth com o perfil como default e override bidirecional por usuario (conceder e negar, negacao vence), efetivo transportado na sessao gorda com versaoPermissoes por usuario e relido quando a versao diverge, recusa 403 ACESSO_NEGADO nomeando a permissao exigida, invalidacao de sessao por evento na suspensao de empresa e na desativacao de pessoa, rotas do Master para o ciclo de vida da empresa e rotas do Admin para as pessoas da propria empresa, onboarding por senha temporaria sem validade com reemissao e troca obrigatoria em rota propria do produto — fecha os debitos D7, D21, D5, P-T6-1 e o limitador do P-T6-2 herdados da fatia fundacao-multitenancy-identidade"
```

> As quatro dúvidas da seção 13 **não são bloqueantes** — as duas primeiras são decisões que o PRD fecha, as duas últimas são confirmações de expectativa.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** — não há nível acima do SDD; o gatilho equivalente é **partir de novo**. Se a `tech-alignment` mostrar que a correção do **D7** não sustenta o onboarding server-side na versão instalada do arcabouço — a medição que o débito registra vale para `better-auth@1.6.25` —, a criação de pessoa vira problema próprio e merece fatia separada da matriz.
- **Upgrade de escopo** — se aparecer permissão de **escopo empresa** (plano, módulo contratado), o Ramo B reabre no B3 e o PRD precisa ser refeito antes da tech spec: muda o contrato da sessão, que congela.
- **Downgrade** — se as dúvidas 1 e 2 forem respondidas com "os dois eixos são independentes" e "overrides são zerados na troca de perfil", e se a `tech-alignment` mostrar que o enforcement cabe numa guarda só, a fatia encolhe para ~7 tasks. **Ainda assim não desce para miniSpec** enquanto as rotas que congelam a superfície estiverem aqui — o que desceria de fato seria tirar as rotas do Admin (D-i), e isso já foi podado por deixar a tela Usuários sem backend.
- **Downgrade estrutural** — se o usuário decidir que o override é **só aditivo** (A1), some a coluna de efeito, some a precedência a provar e some metade da migração `0003`. Seria a única mudança capaz de tirar a fatia da faixa do SDD — e ela contraria a direção C2 fechada.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 6 ramos (5 propostos + 1 acrescentado pelo usuário), validado na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]` (D-iii)
- [x] Direções já convergidas pela fatia 1 tratadas como **fechadas**, com o Ramo B registrando por escrito a única leitura que as tangencia
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs, arquivos e ADRs concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo, confrontando os gatilhos de downgrade que a fatia 1 deixou registrados
- [x] **Comando exato (15.4)** escrito, com a ADR antes
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
