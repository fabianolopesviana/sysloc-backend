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

- **Nome da Ideia / Feature**: Painel Master — administradores, edição e exclusão física
- **Fonte da ideia**: `plano-de-origem.md`, neste mesmo diretório — o plano aprovado pelo usuário em 2026-09-01, após sessão de planejamento com 8 decisões coletadas. Trazido para dentro da fatia em 2026-09-01; até então vivia só na máquina local, fora do versionamento
- **Autor**: sysloc
- **Data**: 2026-09-01
- **Versão**: v1
- **Status**: Pronto para próxima etapa
- **Relacionados**:
  - `autorizacao-e-ciclo-de-acesso/v1` — criou as 6 rotas atuais do Master e **adiou esta fatia por nome**
  - `fundacao-multitenancy-identidade/v1` — criou `identidade.empresa` e `identidade.usuario`
  - `publicacao-e-backup/v1` — F7 item 1, a fatia imediatamente anterior
  - ADR-0013, ADR-0014, ADR-0008, ADR-0011, ADR-0017, ADR-0021, ADR-0024, ADR-0031

---

## 2. Ideia Resumida (uma frase)

Dar ao operador do SaaS o **ciclo de vida completo** das duas entidades que ele governa — empresa e administrador de empresa —, substituindo a superfície de mão única de hoje (que cria e nunca mais enxerga) por listar, editar, suspender, reativar e excluir de fato quando ainda não há registro algum.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Visibilidade — o Master enxerga quem administra cada empresa | explorar |
| B | Ciclo de acesso do administrador — retirar e devolver | explorar |
| C | Correção de cadastro — editar o que foi digitado errado | explorar |
| D | Remoção definitiva × retirada de circulação | explorar |
| E | Como a superfície **comunica** o que é possível agora | adicionado (divergente — não estava no pedido) |

> **Como esta fase foi conduzida.** A `.claude/rules/autonomia-do-run.md` §A1 é de escopo universal e manda **não invocar `AskUserQuestion` e adotar a recomendada**. Os cinco ramos e a poda de cada direção não foram inferidos: eles derivam de **8 decisões que o usuário tomou explicitamente** na sessão de planejamento que originou a fonte da ideia (registradas na seção 11). O ramo **E** é o único acréscimo da skill, e ele nasceu de uma frase do próprio pedido — *"com a informação de que só é possível suspender"* —, que descreve um comportamento de produto que o pedido não nomeou como requisito.
>
> `[pre-refinement] decisão auto-resolvida (A1): validar o esqueleto com o usuário antes da Fase 2 → adotada a recomendada: prosseguir com os 5 ramos · razão: os 4 primeiros são transcrição direta do pedido e o 5º é derivado de uma frase literal dele; pausar seria re-litigar decisão fechada.`

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Visibilidade: o Master enxerga quem administra cada empresa

**A dor que abre o ramo é documentada, não suposta.** O handoff do Painel Master diz três vezes que não há listagem de administradores, e tira daí uma instrução operacional: *"**Guarde o `usuarioId` da admissão** — sem ele, a reemissão fica sem alvo"* (`handoff-master-frontend.md:575-577`, repetido em §4.6 e §6.9).

**Direções candidatas:**

- **A1 — Listar todos os usuários da empresa** (`ADMIN_EMPRESA` + `USUARIO_EMPRESA`), com as ações habilitadas só nos administradores.
  - _Exemplo:_ o operador abre "Imobiliária X" e vê 1 administradora e 4 corretores; só a primeira tem botões.
  - _Viabilidade:_ tecnicamente idêntica à A2 — mas entrega ao operador do SaaS o **retrato da equipe interna** da imobiliária, e cria quatro linhas com botão morto.
- **A2 — Listar apenas os administradores** (`ADMIN_EMPRESA`).
  - _Exemplo:_ "Imobiliária X → Administradores: Ana Ribeiro · ana@imobx.com.br · ativa · admitida em 12/03".
  - _Viabilidade:_ coerente com a **ADR-0013**, que já restringe o alvo da reemissão de senha a `ADMIN_EMPRESA` — listar quem ele não pode operar cria botão morto. Reusa `identidade.usuario`, que já tem `perfil`, `empresa_id`, `ativo` e `criado_em`.
- **A3 — Não listar; devolver o administrador na resposta da própria empresa.**
  - _Exemplo:_ a listagem de empresas já traz, em cada linha, o administrador dela.
  - _Viabilidade:_ ruim — quebra a **RN-13**, que fixa que a listagem de empresas devolve *"identificação e estado, e nenhum dado de negócio"* (provada pelo `CT-226`), e não comporta empresa com mais de um administrador.

**Direção escolhida**: **A2** — decisão do usuário. Mantém a operação interna da imobiliária fora da vista do operador do SaaS e não cria ação inalcançável.
**Podadas / adiadas**: **A1** (expõe a equipe da imobiliária sem que ele possa agir sobre ela) · **A3** (fura a RN-13 e não escala para dois administradores).

> **Consequência que fecha o pedido 2 sem custo.** A reemissão de senha provisória **já recebe o identificador** — ela nunca recebeu e-mail. O que a prendia ao menu superior era não haver de onde tirar o `usuarioId`. Existindo a listagem, a função desce para a linha **sem uma linha de mudança no backend**. `[HIPÓTESE]` A movimentação do botão no frontend é trabalho de tela, fora desta fatia — a Fronteira do `CLAUDE.md` proíbe planejar frontend aqui.

---

### Ramo B — Ciclo de acesso do administrador: retirar e devolver

**Direções candidatas:**

- **B1 — Reusar a desativação que o app do cliente já tem.**
  - _Exemplo:_ o Painel Master chama a mesma rota que a administradora da imobiliária usa para desligar um corretor.
  - _Viabilidade:_ **impossível, e por dois motivos independentes.** A rota exige a chave `TELA:usuarios`, e a matriz do Master é vazia por decisão da ADR-0011 — ele recebe `403`. E o alcance dela passa pelo vínculo de acesso, que é governado pela política de isolamento — o Master, que não pertence a empresa alguma, alcançaria **zero pessoas**. Pior: o administrador recém-admitido pelo Master **sequer tem vínculo** até alguém agir sobre ele pelo app do cliente.
- **B2 — Suspensão própria do Master, sobre o mesmo fato.**
  - _Exemplo:_ "Ana Ribeiro — Suspender" no Painel Master; as sessões dela caem no ato e ela recebe recusa no próximo acesso; "Reativar" devolve a entrada, e ela loga de novo.
  - _Viabilidade:_ é a forma que a **suspensão de empresa já usa** — marcar e encerrar sessões na mesma transação. O fato é o mesmo (`ativo`), o que muda é por onde se alcança a pessoa.
- **B3 — Estado próprio, que a imobiliária não possa desfazer.**
  - _Exemplo:_ o operador suspende um administrador por inadimplência e nem outro administrador da casa consegue reativá-lo.
  - _Viabilidade:_ exige um terceiro estado de acesso e mexe na barreira de admissão — mecanismo central que hoje decide toda entrada.

**Direção escolhida**: **B2** — decisão do usuário, com o verbo **`suspensao`/`reativacao`**, para que o Painel Master fale uma língua só (suspende empresa, suspende administrador). O app do cliente segue com `desativacao`; são superfícies distintas, para públicos distintos.
**Podadas / adiadas**: **B1** (inalcançável por construção) · **B3** (adiada — ver a consequência abaixo).

> ⚠️ **Consequência aceita, e ela é de produto, não técnica.** Como o fato é o mesmo, **um administrador colega da imobiliária pode desfazer a suspensão feita pelo Master**. O usuário decidiu que é aceitável, e a razão é a ADR-0013: o poder do Master é sobre **empresas**, e a gestão interna da equipe é da imobiliária. Quando o operador precisar de contenção real, o instrumento existe e é outro — **suspender a empresa**, que derruba todo mundo.

---

### Ramo C — Correção de cadastro

**Direções candidatas:**

- **C1 — Edição completa dos campos cadastrais**: nome e documento da empresa; nome e e-mail do administrador.
  - _Exemplo:_ o operador digitou "ana@imobx.com.bt" e a administradora não consegue entrar; ele corrige o endereço e ela entra com a mesma senha provisória que já recebeu.
  - _Viabilidade:_ o e-mail é a identidade de entrada, mas **não é a chave da credencial** — a conta local se ancora no identificador da pessoa. Corrigir o endereço não invalida a senha nem derruba sessão. `emailVerificado` não é lido pelo produto.
- **C2 — Só o nome; e-mail e documento imutáveis.**
  - _Exemplo:_ errou o e-mail? Exclua e recrie.
  - _Viabilidade:_ funciona **só enquanto** a pessoa nunca entrou — depois disso, o Ramo D fecha a porta da exclusão, e o cadastro fica errado para sempre.
- **C3 — Edição com reenvio automático de credencial nova.**
  - _Exemplo:_ mudou o e-mail → nova senha provisória emitida junto.
  - _Viabilidade:_ mistura dois atos que o produto separa por decisão, e emitiria credencial sem que ninguém a pedisse. A reemissão já é rota própria.

**Direção escolhida**: **C1** — pedido literal do usuário (*"edição das informações que são passíveis de edição"*).
**Podadas / adiadas**: **C2** (deixa erro permanente exatamente no caso que motivou o pedido) · **C3** (acopla dois atos separados por decisão).

> **Nota de coerência com a ADR-0021**: mudar **estado** nunca é campo de edição. Suspender continua sendo ato próprio (Ramo B) — a edição alcança dado cadastral, e nada mais.

---

### Ramo D — Remoção definitiva × retirada de circulação

**O ramo que colide com decisão registrada, e por isso foi o primeiro a subir ao usuário.** A **ADR-0014** decide que entidade referenciável *"nunca é removida fisicamente"*, e rejeitou **nominalmente** a alternativa *"exclusão física com recusa por vínculo"* — com a razão: *"a fronteira 'tem vínculo / não tem' muda com o tempo, então a mesma ação dá resultados diferentes em momentos diferentes sem que o usuário entenda por quê"*.

**Direções candidatas:**

- **D1 — Nada se exclui; só se suspende.**
  - _Exemplo:_ a empresa "Teste 3" criada por engano fica na listagem para sempre, suspensa.
  - _Viabilidade:_ honra a ADR-0014 ao pé da letra e contraria o pedido. A dor não é hipotética: o operador engorda a listagem com lixo que nunca sai.
- **D2 — Excluir de fato, com a recusa vinda do próprio banco.**
  - _Exemplo:_ empresa criada por engano, sem imóvel, contrato ou cobrança → o botão exclui. Empresa com um contrato → o botão está desabilitado e a tela diz *"só é possível suspender, pois já existem registros"*.
  - _Viabilidade:_ a **ADR-0014 nomeia o cadastro do domínio** — conjunto, imóvel, locador, locatário, fiador, contrato, cobrança —, tudo no schema de negócio. Empresa e administrador vivem no schema de identidade, e a empresa é o **próprio inquilino**, não um cadastro dentro dele. Exige ADR nova declarando esse alcance.
- **D3 — Excluir só o administrador; empresa nunca.**
  - _Exemplo:_ o administrador com e-mail errado some; a empresa vazia fica.
  - _Viabilidade:_ menor superfície de risco, e atende metade do pedido.

**Direção escolhida**: **D2** — decisão do usuário, com ADR nova. **A objeção da ADR-0014 fica mitigada pelo próprio desenho que o pedido descreve**: a fronteira continua mudando com o tempo, mas a superfície **diz** por que mudou. O que a 0014 rejeitou foi a recusa muda.
**Podadas / adiadas**: **D1** (contraria o pedido; a empresa criada por engano fica para sempre) · **D3** (atende metade).

**Sub-ramo D-a — o que conta como "nenhum registro" para um administrador**

- **D-a1 — Quem nunca tentou entrar.** _Exemplo:_ admitido com e-mail errado às 10h, excluído às 10h05 — ele nunca chegou a tentar. _Viabilidade:_ a trilha de tentativas de entrada é ela própria uma barreira, e a **ADR-0013** diz que essa trilha **é a mitigação** da garantia do operador do SaaS (*"sem isso, ela não existe"*). Nenhuma migração; nenhuma auditoria destruída.
- **D-a2 — Também quem já entrou**, afrouxando a trilha para desvincular em vez de barrar. _Exemplo:_ administradora que trabalhou seis meses é apagada, e a trilha guarda só o endereço digitado. _Viabilidade:_ amplia muito o alcance e **enfraquece a mitigação nomeada pela ADR-0013** — exigiria emendá-la.

**Escolhida**: **D-a1** — decisão do usuário. **Podada**: **D-a2** (destrói a mitigação de uma ADR aceita para ganhar um caso que a suspensão já resolve).

**Sub-ramo D-b — o que acontece com os administradores ao excluir a empresa**

- **D-b1 — Vão junto, no mesmo ato.** _Exemplo:_ "Teste 3" tinha só o administrador de teste; um clique remove os dois. _Viabilidade:_ **não é remoção em cascata cega** — cada administrador continua submetido ao seu próprio critério (D-a1), e a recusa de um aborta a operação inteira, nomeando o motivo.
- **D-b2 — Excluir os administradores antes, um a um.** _Exemplo:_ três cliques para uma empresa com dois administradores. _Viabilidade:_ mais explícito, e cobra do operador uma sequência que ele não tem como adivinhar na primeira vez.

**Escolhida**: **D-b1** — decisão do usuário. **Podada**: **D-b2** (N+1 passos e uma recusa a mais para interpretar).

---

### Ramo E — Como a superfície comunica o que é possível agora

> **Ramo divergente, acrescentado pela skill.** Ele não estava no pedido como requisito, mas está nele como frase: *"essa exclusão fica desabilitada **com a informação de que** só é possível suspender"*. Isso é comportamento de produto, e é **exatamente** o que responde à objeção da ADR-0014 — sem ele, o Ramo D não se sustenta.

**Direções candidatas:**

- **E1 — Booleano seco.** _Exemplo:_ o botão está cinza e nada explica. _Viabilidade:_ é literalmente a situação que a ADR-0014 rejeitou (*"sem que o usuário entenda por quê"*).
- **E2 — Classe do impedimento, em vocabulário fechado.** _Exemplo:_ o botão está cinza e a tela diz *"Só é possível suspender: esta empresa já tem registros no sistema"*; para uma pessoa, *"…já houve tentativa de entrada com este acesso"*. _Viabilidade:_ preserva a **RN-13** intacta e basta para redigir a frase que o pedido descreve. O servidor também informa **qual é a alternativa**, para que a tela não a invente.
- **E3 — Nomear as entidades, ou contá-las.** _Exemplo:_ *"12 imóveis, 3 contratos, 47 cobranças"*. _Viabilidade:_ mais informativo, e entrega ao operador do SaaS um **retrato do volume do inquilino** — reabre a fronteira da RN-13 e da ADR-0013 sem que ninguém tenha decidido reabri-la.

**Direção escolhida**: **E2** — decisão do usuário.
**Podadas / adiadas**: **E1** (reproduz a objeção da 0014) · **E3** (fura a RN-13 por informação que a tela não usa).

**Sub-ramo E-a — a fronteira muda entre ver e clicar.** Provocação levantada e resolvida: entre o momento em que a tela lê "pode excluir" e o clique, um registro pode nascer. A resposta de produto é que **o pior caso não é exclusão indevida — é uma recusa que nomeia o motivo**, e o operador vê a razão em vez de um erro genérico. É essa propriedade que torna a mitigação real em vez de retórica.

---

## 5. Problema

- **Qual é a dor real hoje?** O Painel Master é uma superfície de **mão única**: ele cria empresa e administrador, e depois nunca mais os enxerga nem os corrige. Das operações que um operador de SaaS precisa fazer, ele tem cinco; faltam listar administradores, editar qualquer coisa, retirar o acesso de uma pessoa e remover um cadastro errado.
- **Como o problema aparece no dia a dia?**
  - O operador admite a administradora da "Imobiliária X" e **perde a tela**. A senha provisória aparece uma única vez — e o identificador dela também. Para reemitir a senha depois, ele precisa ter anotado um UUID à mão. É por isso que o handoff instrui, em três lugares, a *"guardar o `usuarioId` da admissão"*.
  - Digitou o e-mail errado na admissão: a pessoa não entra, e **não há como corrigir nem como apagar**. O endereço fica ocupado para sempre, porque é único.
  - Criou "Teste 1", "Teste 2", "Teste 3" para conferir o cadastro: as três ficam na listagem permanentemente.
  - Uma administradora deixou a imobiliária: **o operador não tem como retirar o acesso dela**. Só existe suspender a empresa inteira — que derruba todo mundo.
- **Quem sente o impacto?** O **Sysloc Master** — persona única desta fatia. O operador do SaaS perde tempo, guarda identificadores em papel e convive com uma listagem que só cresce.
- **Por que resolver agora?** Porque é o momento previsto. A fatia `autorizacao-e-ciclo-de-acesso` adiou esta feature **por nome** — *"é a feature `painel-master`, especificada depois da F7, com persona e domínio próprios"* (`pre-refinement.md:150`) —, e a F7 item 1 fechou em 2026-08-27. Além disso, o Painel Master é o **único app cujo backend está completo**: o handoff dele está pronto desde 2026-08-21, e o frontend será construído contra esta superfície.

---

## 6. Objetivo Principal

- **Resultado esperado**: o operador do SaaS opera o ciclo de vida completo das duas entidades que governa — vê quem administra cada empresa, corrige o que digitou errado, retira e devolve acesso, e remove o que criou por engano.
- **Mudança de estado**: o Painel Master deixa de exigir que o operador guarde identificadores fora do sistema, e a listagem deixa de acumular cadastros que nunca poderão sair.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Sysloc Master** — o operador do SaaS. Persona **única** desta fatia.
- **Persona secundária**: nenhuma. ⚠️ O `ADMIN_EMPRESA` é **alvo** das ações, nunca ator: nenhuma rota desta fatia é alcançável por ele. A única superfície em que ele participa é o efeito colateral já decidido no Ramo B — ele pode reativar, pelo app dele, quem o Master suspendeu.
- **Contexto de uso**: navegador desktop, aplicação React **separada** em `syslocadmin.systera.com.br`, com build próprio. Sessão de 8 h renovável.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **A2** — Listar os administradores (`ADMIN_EMPRESA`) de uma empresa, com identificação, estado e data de admissão, em janela paginada
- [ ] **B2** — Suspender e reativar um administrador, com as sessões dele encerradas no ato da suspensão e a quantidade publicada como prova
- [ ] **C1** — Editar nome e documento da empresa; editar nome e e-mail do administrador
- [ ] **D2 + D-a1 + D-b1** — Excluir de fato empresa e administrador, quando e somente quando não houver registro algum; excluir a empresa leva junto os administradores dela, cada um sujeito ao seu próprio critério
- [ ] **E2** — A listagem informa se a exclusão é possível; a recusa nomeia a **classe** do impedimento e a alternativa disponível
- [ ] **ADR nova** declarando o alcance da ADR-0014, mais emenda na própria 0014 e no registro do congelamento da superfície

> **Fora do escopo por Fronteira do projeto, não por decisão desta fatia**: todo o frontend. Mover o botão de reemissão do menu para a linha, desabilitar o botão de exclusão e redigir a frase ao operador são trabalho da aplicação React, que **não vive neste servidor** (`CLAUDE.md` → Fronteira). Esta fatia entrega o que a tela precisa para fazê-lo.

---

## 9. Fora do Escopo (podado / adiado)

- **A1** — Listar `USUARIO_EMPRESA` — _entrega ao operador do SaaS o retrato da equipe interna da imobiliária, e cria linhas com botão morto._
- **A3** — Administrador embutido na listagem de empresas — _fura a RN-13 e não escala para mais de um administrador._
- **B1** — Reusar a desativação do app do cliente — _inalcançável por construção: chave que o Master não tem, e alcance por vínculo que ele não possui._
- **B3** — Estado de suspensão próprio do Master, irreversível pela imobiliária — _adiada: exige terceiro estado de acesso e migração. Reconsiderar se o operador relatar suspensão desfeita indevidamente._
- **C3** — Reemitir credencial junto com a edição — _acopla dois atos que o produto separa por decisão._
- **D-a2** — Excluir administrador que já entrou — _enfraquece a mitigação nomeada pela ADR-0013 para ganhar um caso que a suspensão já resolve._
- **E3** — Nomear entidades ou contá-las na recusa — _reabre a fronteira da RN-13 e da ADR-0013 por informação que a tela não usa._
- **Histórico de suspensão e auditoria consultável pelo Master** — _era o ramo **D-iii** da fatia `autorizacao-e-ciclo-de-acesso`, adiado para o `painel-master`. **Continua adiado**: é feature própria, com valor próprio, e não é pré-requisito de nenhuma direção escolhida aqui._
- **Ajuste de permissões de pessoas de uma empresa pelo Master** — _`[fora do escopo do projeto]`: a fatia `autorizacao-e-ciclo-de-acesso` deixou isso como `[DÚVIDA] 4` e registrou a leitura consistente como **não** — o Master cria o Admin inicial e para aí. Nada nesta fatia a reabre._
- **Qualquer alteração na superfície do app da imobiliária** — _o congelamento do marco de entrega continua valendo integralmente para `/v1/usuarios/*` e `/v1/sessao*`._

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL nativo, sem Docker, substituindo o Frappe/ERPNext. Multi-tenancy imposta pelo banco é fundação. **Só se faz backend aqui** — o React vive na máquina local do usuário.

- **PRDs / specs existentes consultados** (`docs/specs/**/*.md` + `docs/prds/**/*.md` — 22 fatias e 13 PRDs varridos):
  - **`autorizacao-e-ciclo-de-acesso/v1`** — **a relação mais forte, e é de continuidade planejada, não de duplicação.** Ela criou as 6 rotas atuais do Master (ramo **D-ii**) e **podou por nome** o que esta fatia realiza: *"`[fora do escopo do projeto]` — é a feature `painel-master`, especificada **depois da F7**, com persona e domínio próprios"* (`pre-refinement.md:150`, `:153`, `:273`). Ela também registra o recorte que torna esta fatia possível: *"o congelamento alcança o app do cliente, **não o domínio `/master`**"* (`:333`, e `tech_spec.md:705`).
  - `fundacao-multitenancy-identidade/v1` — criou `identidade.empresa` (com `suspensa_em`) e `identidade.usuario` (com `perfil`, `empresa_id`, `ativo`, `senha_provisoria`) e provou a metade positiva da ADR-0013. **Nada a duplicar**: as colunas de que esta fatia precisa já existem.
  - `publicacao-e-backup/v1` — F7 item 1, fatia anterior. Declarou no escopo dela *"não alterar rota; as âncoras saem intactas"*. **Sem conflito**: aquilo era o escopo daquela fatia, não proibição universal.
  - `dominio-locacao/v1` — é onde a **ADR-0014** foi aplicada (`Applied in`), e é o que confirma que o alcance dela é o cadastro do domínio.
  - Demais 18 fatias — **nenhuma toca `/v1/master`**; as menções são de passagem, sobre a persona.

- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: `@sysloc/db`. `identidade.empresa` e `identidade.usuario` já têm **todas** as colunas necessárias — nenhuma migração. O critério de exclusão já está imposto pelas chaves estrangeiras existentes.
  - **Autenticação / autorização**: `@sysloc/auth`. O Master já atravessa por perfil (ADR-0011), a barreira de admissão já lê `ativo` e `suspensa_em`, e a senha provisória já tem emissão e reemissão prontas.
  - **Outros**: o envelope de erro da ADR-0017 com os 11 códigos; o padrão de listagem paginada com janela servida; a forma de edição de item já usada em 7 controladores; e o único caso de remoção física já existente, cujo docblock declara a exceção da ADR-0014.

- **Conflitos / sobreposições detectados**:
  1. ⚠️ **Com a ADR-0014** — real, levado ao usuário, resolvido por decisão dele: ADR nova declarando o alcance, mais emenda na 0014. Não é contorno; é registro do alcance que a 0014 nunca qualificou.
  2. ⚠️ **Com a prosa do `CLAUDE.md`** — o `Estado atual` e o item 2 do marco afirmam que a última rota já foi publicada, **sem qualificar o domínio**, enquanto `autorizacao-e-ciclo-de-acesso/v1/tech_spec.md:705` recorta `/v1/master/*` para fora. Um agente que leia só o `CLAUDE.md` para e escala. A emenda a esse registro é entrega obrigatória.
  3. **Sem sobreposição funcional**: nenhuma fatia existente lista, edita ou exclui administrador ou empresa.

---

## 11. Premissas e Decisões já tomadas

**Premissas:**

- `[HIPÓTESE]` O operador do SaaS é **um punhado de pessoas de confiança**, não um público amplo — a base tem dezenas a poucas centenas de empresas. É o que torna aceitável um verbo destrutivo cuja contenção é a integridade do banco, e não uma segunda camada de autorização.
- `[HIPÓTESE]` A janela real de exclusão é **curta**: basta um cadastro, ou uma tentativa de entrada, para fechá-la. O valor está concentrado no engano recente — "criei agora e errei" —, não em limpeza retroativa de base.
- `[HIPÓTESE]` A maioria das empresas terá **um** administrador; o pedido, porém, fala em lista, e o desenho não pressupõe cardinalidade.
- `[HIPÓTESE]` O frontend do Painel Master **ainda não foi construído** — o handoff está pronto desde 2026-08-21 e a construção acontece na máquina local. Logo, acrescentar campo à listagem não quebra tela existente.

**Decisões já tomadas (fora de negociação):**

- A exclusão física é admitida; o alcance da ADR-0014 é o cadastro do domínio, e não o inquilino nem a identidade — registrado em ADR nova.
- O administrador é excluível apenas enquanto nunca tiver tentado entrar; sem migração, com a trilha da ADR-0013 intacta.
- A listagem de administradores devolve apenas `ADMIN_EMPRESA`, nunca `USUARIO_EMPRESA`.
- O verbo do ato sobre o administrador é `suspensao`/`reativacao`; o app do cliente segue com `desativacao`.
- A suspensão feita pelo Master é reversível pelo app do cliente, e isso é aceitável.
- Excluir a empresa leva junto os administradores dela, na mesma operação, cada um sujeito ao seu próprio critério.
- A recusa informa a **classe** do impedimento, em vocabulário fechado — nunca nome de entidade nem contagem.
- A recusa usa o código de campo inválido com motivo discriminante, sem acrescentar código novo ao enum de erro.
- Somente backend. Nenhum arquivo de frontend, nenhum arquivo na máquina local.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação** — o operador tenta excluir, é recusado, e não entende por quê; ou pior, entende que "o sistema está quebrado". → _Mitigação:_ é o Ramo **E2** inteiro, e ele é **requisito**, não polimento: a recusa nomeia a classe do impedimento **e** a alternativa. Sem ele, o Ramo D não deveria ser construído.
- **Risco de escopo** — a listagem convida a crescer: filtro, busca, ordenação, contagem de imóveis por empresa, histórico de suspensão. → _Mitigação:_ a janela paginada reusa a forma já estabelecida, e a seção 9 já poda nominalmente a contagem (**E3**) e o histórico (**D-iii**). A **RN-13** é a fronteira e tem teste que a prova.
- **Risco técnico ou operacional** — ⚠️ **o mais grave desta fatia, e ele é silencioso.** Uma consulta que **conte registros** de uma empresa a partir da sessão do Master devolve **zero para uma empresa cheia**, por causa do isolamento imposto pelo banco. Uma implementação ingênua habilitaria a exclusão de um inquilino inteiro, e nenhum teste que não persiga o caso a pegaria. → _Mitigação:_ o critério **nunca é uma contagem** — é a própria integridade referencial do banco, que ignora o isolamento por construção. E a verificação prévia executa **a mesma operação** que o ato executa, de modo que não existe um segundo critério livre para divergir do primeiro. Precisa de caso de teste dedicado, com o controle que demonstra que a alternativa ingênua mentiria.
- **Risco de privacidade / segurança / compliance** — a exclusão física apaga dado pessoal; e a **ADR-0013** amarra a garantia do operador do SaaS à trilha de auditoria (*"sem isso, a mitigação não existe"*). → _Mitigação:_ a trilha é ela própria um impedimento — **esta superfície nunca destrói auditoria**, porque a existência de trilha bloqueia a exclusão. Como efeito lateral favorável, a exclusão física é o **único mecanismo de eliminação de dado pessoal** que o produto passa a ter, e a ADR-0014 registra a retenção indefinida como dívida explícita em aberto.
- **Risco de regressão de decisão (R3)** — dois caminhos passam a escrever o mesmo fato de acesso, com verbos diferentes. Uma sessão futura vai querer "unificar", e a fusão devolve uma suspensão **silenciosamente inócua**. → _Mitigação:_ marcador `DECISÃO FECHADA` nos dois pontos de escrita, com o `REVERTER EXIGE` nomeando a razão medida.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **A listagem de administradores precisa de filtro por estado?** Hoje ela devolve ativos e suspensos misturados, ordenados por nome. Com um ou dois administradores por empresa isso é irrelevante; se alguma empresa acumular vários suspensos, a tela pode querer separá-los. _Não bloqueia_ — a janela paginada já está no desenho e o campo de estado vem em cada linha; filtrar é decisão de tela.
2. `[DÚVIDA]` **A empresa deve poder ser excluída enquanto estiver suspensa?** Nada no desenho o impede — os dois estados são ortogonais —, mas é combinação que o pedido não menciona. `[HIPÓTESE]` Sim, e é até o caso frequente: o operador suspende primeiro, confere que ninguém reclamou, e só então exclui. _Não bloqueia._
3. `[DÚVIDA]` **A edição deve registrar autoria?** As ações do Master hoje registram no diário quem as emitiu (a admissão e a reemissão o fazem). A edição de dado cadastral seguiria o mesmo padrão. `[HIPÓTESE]` Sim, por simetria com o que já existe. _Não bloqueia_ — é decisão de implementação dentro do padrão estabelecido.

> **Nenhuma das três é bloqueante.** As duas primeiras são decisões de tela ou combinações naturais; a terceira segue padrão já estabelecido no mesmo arquivo. O pré-refinamento pode seguir para a próxima etapa.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial**: **A2** (listar só administradores) · **B2** (suspensão própria do Master, com encerramento de sessões no ato) · **C1** (edição completa dos campos cadastrais) · **D2** (exclusão física com o banco como critério) · **D-a1** (só quem nunca tentou entrar) · **D-b1** (a empresa leva os administradores junto) · **E2** (classe do impedimento e alternativa, em vocabulário fechado).
- **Descartado com justificativa**: **A1** e **A3** (expõem a equipe da imobiliária, ou furam a RN-13) · **B1** (inalcançável por construção — chave ausente e alcance por vínculo inexistente) · **C2** (deixa erro permanente no caso que motivou o pedido) e **C3** (acopla dois atos separados por decisão) · **D1** (contraria o pedido) e **D3** (atende metade) · **D-a2** (enfraquece a mitigação da ADR-0013) · **E1** (reproduz a objeção da ADR-0014) e **E3** (fura a RN-13).
- **Adiado para v2/v3**: **B3** (estado de suspensão próprio do Master, irreversível pela imobiliária — reconsiderar se houver relato de suspensão desfeita indevidamente) · **histórico de suspensão e auditoria consultável** (era o D-iii da fatia anterior, e segue sendo feature própria).
- **Provocações que mudaram o rumo**:
  1. *"E se contar os registros da empresa simplesmente não funcionar a partir do Master?"* — mudou o **critério inteiro** do Ramo D. A contagem ingênua devolve zero para uma empresa cheia, e a superfície habilitaria apagar um inquilino. O critério passou a ser a integridade do próprio banco.
  2. *"O que a ADR-0014 rejeitou foi a exclusão condicional, ou a recusa muda?"* — foi a recusa muda. Essa leitura é o que **transformou o Ramo E de detalhe de tela em requisito**, e é o que sustenta o Ramo D.
  3. *"Quem mais pode desfazer a suspensão do Master?"* — revelou que o administrador colega da imobiliária pode. Não mudou a direção escolhida, mas transformou uma consequência oculta em decisão consciente, com o instrumento de contenção real nomeado (suspender a empresa).
  4. *"Reusar a rota de desativação que já existe não resolveria tudo?"* — parecia a economia óbvia, e caiu por **dois** motivos independentes, um deles invisível de fora: o administrador admitido pelo Master sequer possui o vínculo pelo qual aquela rota alcança pessoas.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — cinco ramos explorados, **sete direções** absorvidas (A2, B2, C1, D2, D-a1, D-b1, E2) | confirmado |
| Personas | **só dev** — persona **única** (Sysloc Master). O `ADMIN_EMPRESA` é alvo, nunca ator | confirmado |
| Novidade | **incremento** — sobre superfície e fundação já provadas; nenhuma migração, nenhuma coluna nova | confirmado |
| Decisão arquitetural transversal nova? | **sim** — o alcance da exclusão lógica × física na identidade, e o critério de admissibilidade da exclusão. Além disso, **emenda a uma ADR aceita** (0014) e ao registro do congelamento da superfície | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: as duas dimensões decisivas são **amplitude (4+)** e a **decisão arquitetural transversal nova**, e a segunda bastaria sozinha. A decisão de que o alcance da ADR-0014 é o cadastro do domínio — e de que o critério de exclusão é a integridade referencial, nunca uma contagem na aplicação — governa **toda** exclusão futura na identidade, e é consumida por quem não participou deste debate: é o perfil exato de uma ADR. Some-se que a fatia **emenda uma ADR aceita** e o registro do congelamento no `CLAUDE.md`, e que ela publica sete rotas, o que aciona a rule `ancoras-de-superficie.md` §5.2 — as âncoras de igualdade e a contagem em prosa precisam ser **declaradas antes** de a spec fechar, e é a Tech Spec do SDD que tem onde declará-las. O que **não** sustenta o SDD, e vale registrar por honestidade, são as personas: é **uma só**, e essa dimensão puxa para baixo.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): ela é o candidato honesto — persona única e incremento sobre fundação provada são exatamente o perfil dela, e a tentação é real. Cai por três razões concretas. **(1)** Sete direções absorvidas passam da faixa de 2-3 do miniSpec. **(2)** O desempate da própria skill é literal: *"qualquer sinal SDD — decisão arquitetural nova — vence"*, e aqui há uma ADR nova **mais** emenda a uma aceita. **(3)** A razão que decide de fato: o miniSpec não tem Tech Spec, e portanto **não tem onde declarar antecipadamente as âncoras de superfície** que a rule §5.2 exige. O antipadrão que ela nomeia — *"§5.2 listando só o controlador novo, com as âncoras descobertas na execução"* — é precisamente o que aconteceria, e o custo medido está escrito na rule: *"os dois gates gastam uma passagem decidindo se foi alargamento de escopo"*.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por duas ordens de grandeza. Sete rotas, dois pacotes, ADR nova, emenda a ADR aceita, emenda ao `CLAUDE.md` e a armadilha de isolamento da seção 12 — que exige caso de teste com controle negativo dedicado. Um TaskCard perderia a rastreabilidade de critério de aceitação para task, e o `pre-refinement.md:406` da fatia `publicacao-e-backup` já lista *"alterar, acrescentar ou remover rota"* como **gatilho declarado de upgrade para SDD**.

### 15.4 Próximo Passo

```bash
# 1º — registre a decisão arquitetural transversal ANTES do PRD:
/agent-spec-adr-create "alcance da exclusao logica e da exclusao fisica na identidade"

# 2º — o PRD da fatia:
/agent-spec-sdd-generate-prd "painel-master-administradores: listagem dos administradores de cada empresa pelo operador do SaaS restrita ao perfil ADMIN_EMPRESA com identificacao estado e data de admissao, suspensao e reativacao do administrador encerrando as sessoes no ato e publicando a quantidade como prova, edicao dos campos cadastrais de empresa e de administrador, e exclusao fisica de ambos admitida somente quando nao houver registro algum — com o criterio imposto pela integridade referencial do banco e nunca por contagem na aplicacao, a recusa nomeando a classe do impedimento e a alternativa disponivel, e a exclusao da empresa levando junto os administradores dela cada um sujeito ao proprio criterio; declara o alcance da ADR-0014 em ADR nova, emenda a 0014 e emenda o registro do congelamento da superficie, que nao alcanca /v1/master por decisao registrada"
```

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (não há acima do SDD; estes são gatilhos de **fatiar em duas**): se a ADR nova for reprovada e a exclusão física cair, sobram A2+B2+C1 — o que **rebaixaria para miniSpec**; se o ramo **B3** (estado próprio do Master) for reativado, entra migração e mudança na barreira de admissão, e ele merece fatia própria; se o histórico de auditoria (D-iii) voltar ao escopo, entra persona de auditoria e a fatia dobra.
- **Downgrade** para **miniSpec** se: o usuário podar o Ramo D inteiro (a decisão arquitetural sai junto, e sobram cinco rotas de incremento sobre padrão estabelecido); **ou** se decidir que a ADR nova não é necessária porque uma emenda à 0014 basta — caso em que some o sinal que hoje é decisivo.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, com a condução registrada conforme a §A1 da rule de autonomia
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs e capacidades concretas, e os 3 conflitos declarados
- [x] Toda inferência marcada `[HIPÓTESE]`; 3 dúvidas listadas, nenhuma bloqueante
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado / provocações
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas, e com a dimensão que puxa contra declarada
- [x] **Alternativas (15.3)** explicam por que NÃO miniSpec e por que NÃO TaskCard
- [x] **Comando exato (15.4)** escrito, com o `/agent-spec-adr-create` antes
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
