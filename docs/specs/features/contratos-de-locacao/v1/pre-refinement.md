# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário ou medido no sistema).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `contratos-de-locacao`
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f2-fatia2-contratos-de-locacao.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-08
- **Versão**: v1
- **Status**: Pronto para próxima etapa
- **Relacionados**:
  - `docs/plano-backend-novo/briefings/f2-dominio-locacao.md` — briefing da fase (antecessor obrigatório)
  - `docs/specs/features/dominio-locacao/v1/pre-refinement.md` — pré-refinamento da fase, que partiu a F2 em duas
  - `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/` — fatia 1, concluída em 2026-08-08
  - `docs/specs/features/caracterizacao-regras-legadas/v1/` — os 6 goldens e o roteiro reutilizável de captura
  - ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018 — vinculantes nesta fatia

---

## 2. Ideia Resumida (uma frase)

Entregar `Contrato` e `ContratoFiador` como entidades de primeira classe do backend novo — com código legível próprio, ciclo de vida governado pelo servidor e o núcleo local das regras de ativação e cancelamento portado do Frappe — fechando a F2 e deixando os efeitos que atravessam cobrança e banco declarados como débito com gatilho.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Prova das duas regras portadas — golden, leitura ou equivalência declarada | explorar |
| B | Ciclo de vida do contrato pelos olhos do usuário | explorar |
| C | Onde corta o "núcleo local" das regras de 340 e 174 linhas | explorar |
| D | O contrato e o que ele aponta — fiador, e referência fora de circulação | explorar |
| E | Continuidade do identificador legível na virada | adicionado (divergente — nasceu de fato medido no legado) |

> O ramo E não estava no briefing. Ele nasceu da consulta ao `/opt/frappe`: a série real está em **20** e usa **5 dígitos**, e o plano de execução escreve `CTR-2026-0001`, com **4**. A divergência só apareceu porque o dado foi lido.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

> **Nota de método.** O usuário delegou a decisão do ramo A com o objetivo declarado *"frappe excluído e backend novo totalmente funcional"*. As escolhas abaixo foram tomadas sob esse critério e vêm justificadas; nenhuma foi devolvida como pergunta. Cada uma é revisível — a seção 15 diz como.

### O que foi medido no legado antes de decidir

Consulta somente-leitura ao `/opt/frappe`, que ainda está de pé (§9 do briefing autoriza; nada destrutivo foi executado):

| O que | Valor real medido |
|---|---|
| `autoname` do DocType `Contrato` | `CTR-.YYYY.-.#####` — **5 dígitos**, ano no prefixo |
| Série viva | `CTR-2026-` com contador em **20** |
| Contratos existentes em produção | **1** (`CTR-2026-00020`, Ativo, `gerar_cobrancas_automaticamente = 1`) — ou seja, **19 furos** na sequência |
| `Fiadores` (child table) | **um único campo**: `fiador` (Link, obrigatório). Nenhum atributo próprio |
| Fiadores do contrato vivo | **zero** |
| `gerar_cobrancas_automaticamente` | `Custom Field` tipo `Check`, **default `1`** |
| `pdf_contrato_arquivo` | `Custom Field` tipo `Attach` → guarda **caminho** (URL de arquivo privado), não bytes |
| `status_contrato` | `Select` obrigatório: `Rascunho`, `Ativo`, `Encerrado`, `Rescindido`, `Cancelado` |
| Escritas de `status_contrato` no app legado | apenas `Ativo`, `Cancelado` e `Encerrado`. **`Rescindido` tem zero caminho de escrita** |
| `imovel.contrato_ativo` | `Link` para `Contrato` — DocField regular do legado; a fatia 1 **não** criou essa coluna |
| Tamanho real das regras | ativação **340 LOC**, cancelamento **174 LOC** |

---

### Ramo A — Prova das duas regras portadas

**Direções candidatas:**

- **A1 — Nenhum golden; derivar por leitura do código legado.** Aceita equivalência declarada, não provada.
  - _Exemplo:_ ler `contrato_ativacao/service.py` e reescrever as 7 validações em TypeScript, confiando na leitura.
  - _Viabilidade:_ mais barato e imediato. **Falha num ponto concreto**: `data_fim_locacao = add_days(add_months(inicio, prazo), -1)` depende de `frappe.utils.add_months`, que **não está no arquivo lido** — o comportamento de virada de mês (início em 29, 30 ou 31) mora na biblioteca do framework, não no código portado. Ler o arquivo não revela essa regra.
- **A2 — Capturar golden agora das duas regras inteiras**, reusando o roteiro da `caracterizacao-regras-legadas` (`bench backup` → site efêmero → cenários sintéticos).
  - _Exemplo:_ cenários de ativação cobrindo início em 31/01 com prazo 1 mês (a data-fim que `add_months` produz), dia de vencimento acima de 28, prazo zero, imóvel já locado; e de cancelamento cobrindo contrato com e sem imóvel vinculado.
  - _Viabilidade:_ **precedente medido no projeto** — a fatia `caracterizacao-regras-legadas` fechou em **1 task** e produziu 6 artefatos. A TaskCard dela é roteiro reutilizável. O site de produção tem 1 contrato só, então os cenários são sintetizados no site efêmero de qualquer jeito — a pobreza do dado real não limita a captura.
- **A3 — Capturar só a ativação**, que tem cascata e o dobro do tamanho.
  - _Exemplo:_ golden de `ativar_contrato_e_gerar_cobrancas`; cancelamento portado por leitura.
  - _Viabilidade:_ economiza pouco (o cancelamento é o menor dos dois) e **obriga uma segunda sessão de captura** se a F3 precisar do cancelamento em cascata com baixa — e é a F3 que precisa.
- **A4 — Fatiar de novo: as regras vão para uma fatia 3.**
  - _Exemplo:_ F2.2 entrega só schema, código legível e CRUD; F2.3 entrega ativação e cancelamento.
  - _Viabilidade:_ adia sem reduzir. A F2 fecharia entregando contrato que não se pode ativar — que é meio-produto de verdade, diferente do caso do ramo C.

**Direção escolhida**: **A2 — capturar golden das duas regras inteiras, como task de abertura da fatia.**

Três razões, na ordem em que pesam:

1. **O que a leitura não alcança.** A aritmética de data-fim vive em `frappe.utils.add_months`, fora do arquivo portado. Ela decide a `dataFimLocacao` de **todo contrato que começa em 29, 30 ou 31** — e nenhuma dessas datas é rara num produto de locação. É exatamente o tipo de regra que a caracterização existe para capturar.
2. **Captura-se uma vez e usa-se duas.** A F2 implementa só o núcleo local (ramo C), mas a parte de aritmética mais delicada — a montagem das N cobranças, com competência, referência `"dd/mm/aaaa à dd/mm/aaaa"` e `min(dia, 28)` — é **F3**. Capturar agora as regras inteiras evita uma segunda janela de captura numa fase em que o `/opt/frappe` estará mais perto do fim.
3. **A janela fecha e não reabre.** O `/opt/frappe` só existe até a F7, e o objetivo declarado do usuário é *"frappe excluído e backend novo totalmente funcional"*. Golden não capturado é risco que só aparece na virada, quando não há mais oráculo para consultar.

**Podadas / adiadas**: A1 (a regra que decide a data-fim não está no arquivo que se leria); A3 (economia marginal, com custo de segunda captura recaindo na F3); A4 (adia sem reduzir, e entrega contrato inativável).

---

### Ramo B — Ciclo de vida do contrato pelos olhos do usuário

**Direções candidatas:**

- **B1 — Contrato nasce ativo.** `POST /contratos` cria e ativa num passo.
  - _Exemplo:_ o usuário preenche o formulário completo e o contrato já sai valendo, com o imóvel marcado Locado.
  - _Viabilidade:_ **colide com o catálogo fechado de permissões.** `ACAO:ativar_contrato` existe como chave e não pode ser removida. Se criar já ativa, a rota de criação teria de exigir também a ação sensível — e quem pode cadastrar mas não pode ativar ficaria sem conseguir **cadastrar**. A matriz da F1 foi desenhada separando os dois poderes.
- **B2 — Nasce rascunho; ativar é rota própria.** Criação em uma requisição; ativação numa segunda, governada por `ACAO:ativar_contrato`.
  - _Exemplo:_ `POST /contratos` grava o rascunho sem exigir prazo nem valor completos; depois a ativação exige as 7 validações e é ela que marca o imóvel como Locado.
  - _Viabilidade:_ reusa o molde de rota governada da fatia 1 e dá sentido à chave que já existe. Atende à crítica do `levantamento-frontend.md` — as **três** requisições de hoje (`POST` rascunho → `GET` doc inteiro → `frappe.client.submit`) viram **duas**, uma por intenção, e a leitura do doc inteiro morre.
- **B3 — Sem status persistido; derivar de datas.**
  - _Exemplo:_ contrato é "ativo" se hoje está entre início e fim.
  - _Viabilidade:_ impossível — cancelamento é decisão, não data. E `ACAO:cancelar_contrato` precisaria de estado para gravar.

**Direção escolhida**: **B2 — nasce rascunho, e ativar é rota própria.**

**Sub-decisões deste ramo:**

- **Rascunho é `status`, não ausência de ativação.** O enum do backend novo carrega **quatro** valores: `RASCUNHO`, `ATIVO`, `CANCELADO`, `ENCERRADO`. **`RESCINDIDO` é podado**, com evidência: **zero caminhos de escrita** no app legado inteiro — ele existe no `Select` do Frappe e nunca é gravado; o frontend só o "conhece" porque lê uma string crua. `ENCERRADO` fica no enum mas é escrito pela **F5** — é o mesmo padrão que a fatia 1 usou com `LOCADO` em `status_locacao`: valor reservado no enum, escrito por fatia posterior.
- **O `docstatus` do Frappe morre aqui.** A dupla fonte (`status_contrato` + fallback `docstatus`) é exatamente o que a ADR-0017 proíbe: `status` é calculado no servidor, nunca derivado no cliente. Some junto o `contratoStatusFromDocstatus()` do frontend.
- **O rascunho consome número da série.** Três razões: a ADR-0017 fixa o código legível como **a** chave exposta do contrato — um rascunho sem código precisaria de uma segunda classe de chave, contrariando a ADR; a ADR-0015 aceita furo explicitamente (*"furo na sequência é aceito"*); e o legado **já tem 19 furos** (série em 20, 1 contrato vivo) sem que ninguém notasse.
- **Cancelar e retirar de circulação são operações distintas, e ambas existem nesta fatia.** `ACAO:cancelar_contrato` é transição de status com efeito no imóvel; `ACAO:excluir_cadastro` é a retirada de circulação da ADR-0014 (contrato está nomeado na lista dela). Um rascunho criado por engano precisa de retirada — cancelar um rascunho não faz sentido. Um contrato cancelado permanece nas listagens, porque o histórico é o que a ADR-0014 preserva.
- **A retirada de circulação é puramente de visibilidade: ela não libera o imóvel.** Retirar um contrato ativo é permitido e não recusa por vínculo — a ADR-0014 diz literalmente que *"a recusa por vínculo deixa de existir como caso de borda"*. O imóvel só volta a `DISPONIVEL` por cancelamento ou encerramento. Não há risco de dupla locação: a guarda do ramo C recusa ativar contrato sobre imóvel que já tem um ativo, e essa guarda não consulta circulação.

**Podadas / adiadas**: B1 (quebra a separação de poderes que a matriz da F1 estabeleceu); B3 (não representa cancelamento).

---

### Ramo C — Onde corta o "núcleo local"

O princípio já estava fechado no painel do roadmap; a fronteira concreta não. Ela foi traçada **lendo as 514 linhas**, não estimando.

**Direções candidatas:**

- **C1 — Corte por efeito colateral externo.** Fica o que altera apenas `contrato` e `imovel`; vira gatilho tudo que cria, altera ou consulta outra entidade, ou fala com o mundo externo.
  - _Exemplo:_ a validação de prazo fica; a geração das N cobranças vira gatilho da F3.
  - _Viabilidade:_ mede ~**115 LOC** de núcleo local contra ~**400 LOC** de extensão. A fronteira é verificável linha a linha, não interpretativa.
- **C2 — Corte por "tudo que não precisa de rede".** Fica tudo menos Sicoob.
  - _Exemplo:_ a F2 geraria as cobranças, mas não emitiria boletos.
  - _Viabilidade:_ a F2 teria de criar a entidade `Cobranca`, que é da F3. Invade a fatia seguinte e refaz o corte por agregado que já foi decidido.
- **C3 — Portar tudo e deixar inerte atrás de flag.**
  - _Exemplo:_ código de emissão presente, desligado por configuração.
  - _Viabilidade:_ código morto que nenhum teste exercita, contra entidades que não existem. Não compila sem inventar `Cobranca`.

**Direção escolhida**: **C1 — corte por efeito colateral externo.**

**A fronteira concreta, medida:**

| Regra | Fica na F2 (núcleo local) | Vira débito com gatilho |
|---|---|---|
| **Ativação** (340 LOC) | as 7 validações de entrada; as 2 derivações (`dataFimLocacao = início + prazo meses − 1 dia`; `valorTotalContrato = valorMensal × prazoMeses`); a guarda "imóvel já tem contrato ativo"; o efeito no imóvel (`LOCADO` + vínculo); a transição para `ATIVO` | geração das N cobranças → **F3** · emissão de boletos com 3 retentativas e enfileiramento → **F4** |
| **Cancelamento** (174 LOC) | a guarda "contrato tem imóvel vinculado"; a liberação do imóvel (`DISPONIVEL` + desfaz vínculo); a transição para `CANCELADO` | cancelar cobranças `Pendente`/`Vencida` → **F3** · solicitar baixa Sicoob e **abortar tudo se qualquer baixa falhar** → **F4** · carimbar "CANCELADO" no PDF → **F3** |

**A pré-condição que NÃO é portada, e por quê.** A primeira coisa que `cancelar_contrato` faz no legado é exigir o PDF privado do contrato e `throw` se não houver. Portada literal, ela tornaria o cancelamento **impossível** numa fatia em que o PDF é F3 — e permanentemente impossível para qualquer contrato sem PDF anexado. É acidente do desenho legado: lá o cancelamento **existe para** carimbar o PDF. Registra-se como **débito com gatilho** ligado à fatia do PDF (F3), onde se decide se o carimbo é pré-condição ou efeito.

**Ativar sem gerar cobrança é estado coerente do produto — não é meio-produto.** A prova está no próprio legado: `gerar_cobrancas_automaticamente` é um interruptor com default ligado, e existe um caminho que ativa sem gerar (`deve_gerar_cobrancas_automaticamente` retorna falso). O produto **já admite** contrato ativo sem cobranças; a F2 entrega o estado que o legado já reconhece, não um estado novo e estranho.

**O interruptor é persistido nesta fatia, mesmo sem leitor.** `gerarCobrancasAutomaticamente` é decisão do usuário no cadastro e nasce com o contrato, com default **`true`** (igual ao legado). Se ficasse para a F3, a F3 teria de migrar dado de contratos já criados. `pdfContratoArquivo` segue a mesma lógica: guarda **caminho**, é do contrato, e a F3 é quem o preenche.

**O cancelamento em cascata cancela um conjunto vazio — e isso é correto, não degradado.** Não há cobranças porque a entidade não existe ainda; quando a F3 chegar, o conjunto passa a ter elementos e o mesmo código percorre. O que a fatia deve provar é o efeito que **existe**: ativar e cancelar, e afirmar que o imóvel voltou a `DISPONIVEL` e o vínculo se desfez.

**Podadas / adiadas**: C2 (invade a F3 criando `Cobranca`); C3 (código morto contra entidade inexistente).

---

### Ramo D — O contrato e o que ele aponta

**D-i · `ContratoFiador` é vínculo ou entidade de cadastro?**

**Direções candidatas:**

- **D1 — Vínculo puro.** A linha representa a ligação; removê-la é o mecanismo legítimo. Sem `retiradoEm`.
  - _Exemplo:_ trocar o fiador de um contrato é remover a linha e inserir outra, exatamente como o ajuste bidirecional da matriz de permissões faz em `acesso_usuario_permissao`.
  - _Viabilidade:_ **é o que o discriminador da ADR-0014 determina.** O discriminador é *"ser referenciável"*, e **nada aponta para uma linha de `ContratoFiador`** — nem no legado, nem no modelo de domínio do `levantamento-frontend.md`. Medido: a child table `Fiadores` tem **um único campo**, `fiador`. Nenhum percentual, nenhuma data de entrada, nenhuma ordem de negócio.
- **D2 — Entidade referenciável, com exclusão lógica.**
  - _Exemplo:_ a ligação ganha `retiradoEm` e histórico de quem garantiu o quê e quando.
  - _Viabilidade:_ inventa requisito que o legado não tem. E contraria a ADR-0014, que exclui do alcance *"vínculo ou concessão, cuja linha representa estado de relacionamento"*.
- **D3 — Vínculo com atributos próprios** (ordem, percentual de responsabilidade).
  - _Exemplo:_ dois fiadores respondendo 50% cada.
  - _Viabilidade:_ nenhum desses campos existe no legado. O `idx` que aparece em `ContratoFiadorResponse` é **posição na child table do Frappe**, e o próprio levantamento o lista entre os acoplamentos a remover.

**Direção escolhida**: **D1 — vínculo puro, sem `retiradoEm` e sem atributos próprios.**

- **Zero fiadores é permitido** — o campo `fiadores` é `reqd: 0` no legado e o único contrato de produção tem zero.
- **Sem máximo declarado** — o legado não impõe teto, e inventar um seria requisito novo.
- **Consequência aceita: não há histórico de quem garantiu o contrato.** O registro jurídico é o contrato assinado (o PDF), não a linha de tabela. `[HIPÓTESE]` — é a única decisão deste ramo que poderia doer depois, e está na seção 11 para validação.

**D-ii · Referência a registro fora de circulação** (a fatia 1 não enfrentou isto porque nenhuma entidade dela apontava para outra retirável).

**Direções candidatas:**

- **D4 — Simétrica: recusa nos dois sentidos.** Não cria contrato sobre retirado, e não retira quem tem contrato ativo.
  - _Exemplo:_ tentar retirar um locatário com contrato vigente devolve erro.
  - _Viabilidade:_ a metade "não retira quem tem vínculo" **contraria o texto da ADR-0014**, que registra como benefício justamente o fim da recusa por vínculo — *"não posso excluir porque há contrato"* é nomeado lá como o erro que o usuário mais encontraria.
- **D5 — Assimétrica: recusa na criação, livre na retirada.**
  - _Exemplo:_ montar contrato só oferece e só aceita imóvel, locador, locatário e fiador em circulação; retirar um imóvel que tem contrato ativo funciona e não recusa — o contrato existente continua legível e o imóvel continua `LOCADO`.
  - _Viabilidade:_ **é a leitura literal da ADR-0014 e do glossário**, que define retirada de circulação como *"deixa de ser oferecido ao montar um contrato, permanece legível por quem já o referencia"*. E reusa a porta de leitura com predicado de circulação que a fatia 1 já entregou. O legado corrobora: o formulário de contrato já filtra os selects por `ativo = 1`.
- **D6 — Permissiva nos dois sentidos.**
  - _Exemplo:_ aceita montar contrato sobre imóvel retirado.
  - _Viabilidade:_ incoerente — o seletor não oferece o registro e a rota o aceita por caminho direto.

**Direção escolhida**: **D5 — recusa na criação e na ativação; livre na retirada.**

> Esta regra **não precisa de ADR nova**: ela é corolário direto do texto da ADR-0014 e da definição de *retirada de circulação* já canonizada no glossário global. Registrar uma ADR para ela seria churn.

---

### Ramo E — Continuidade do identificador legível na virada

**Direções candidatas:**

- **E1 — Formato de 4 dígitos, como o plano de execução escreve** (`CTR-2026-0001`), contador começando em 1.
  - _Exemplo:_ o primeiro contrato do backend novo sai `CTR-2026-0001`, num sistema onde `CTR-2026-00020` já foi emitido e possivelmente já circulou fora do sistema.
  - _Viabilidade:_ **contraria o dado medido.** O `autoname` real é `CTR-.YYYY.-.#####`, com 5 dígitos. O código legível é o **título do contrato** nas telas e a `label` dos selects — mudar a largura muda o que o usuário reconhece.
- **E2 — Formato real de 5 dígitos, contador começando em 1.**
  - _Exemplo:_ primeiro contrato sai `CTR-2026-00001`.
  - _Viabilidade:_ preserva a forma que o usuário já lê. Convive com o dado antigo sem colidir na largura, mas nasce "atrás" do `CTR-2026-00020` já emitido.
- **E3 — Formato de 5 dígitos e contador semeável por empresa**, podendo continuar de onde a série do Frappe parou.
  - _Exemplo:_ ao provisionar a empresa na virada, o contador nasce em 20 e o próximo contrato sai `CTR-2026-00021` — sem colisão e sem regressão de ordem.
  - _Viabilidade:_ a ADR-0015 já manda que **cada série declare o próprio escopo** e que o contador seja **único por empresa** — um valor inicial por empresa cabe dentro dela sem ADR nova.

**Direção escolhida**: **E2 na forma, E3 na mecânica — 5 dígitos, e valor inicial do contador como parâmetro por empresa, não constante.**

A F2 **não decide se haverá migração de dado** — isso é da F7, que é quem conduz a virada. O que a F2 tem de fazer é **não impedir a decisão**: um contador que só sabe começar em 1 forçaria, lá na frente, renumerar contrato já emitido ou conviver com ordem invertida. Deixar o valor inicial parametrizável custa quase nada agora e preserva as duas saídas.

**Podadas / adiadas**: E1 (contraria o formato medido); a **semeadura efetiva** na virada fica adiada para a **F7**, com o mecanismo pronto desde aqui.

> **Divergência de documentação a registrar.** O `plano-execucao.md` (§F2), o `CLAUDE.md` e o briefing da fase escrevem `CTR-2026-0001`, com 4 dígitos. O real é 5. A spec desta fatia usa **5**, com a evidência acima. Corrigir o texto do plano não é trabalho deste artefato — está na seção 13 como pendência nomeada.

---

## 5. Problema

- **Qual é a dor real hoje?** O contrato de locação — o documento central do negócio — só existe dentro do Frappe, que precisa ser desligado. Sem `Contrato` no backend novo, nada da F3 (cobrança), da F4 (banco) e da F5 (automações) tem onde se apoiar, e o marco de entrega do backend fica inalcançável.
- **Como o problema aparece no dia a dia?** Criar um contrato hoje custa **três requisições** ao Frappe (grava rascunho, lê o documento inteiro, submete) e o status que a tela mostra é **derivado no cliente** a partir do `docstatus` do framework, com uma segunda fonte de verdade em `status_contrato`. As duas fontes podem divergir, e a tela mostra o que quiser.
- **Quem sente o impacto?** Quem monta e ativa contratos na imobiliária — hoje sujeito a um fluxo de três passos que pode falhar no meio, deixando rascunho órfão. E o projeto inteiro, que não pode desligar o Frappe enquanto o contrato viver lá.
- **Por que resolver agora?** Esta é a fatia que **fecha a F2**. Com ela, três das cinco fases exigidas pelo marco estão concluídas, e sobram F3, F4 e F5 entre aqui e o handoff. Além disso, o oráculo das regras portadas só existe enquanto o `/opt/frappe` estiver de pé — até a F7.

---

## 6. Objetivo Principal

- **Resultado esperado ao final:** `Contrato` e `ContratoFiador` existem no backend novo com isolamento garantido pelo banco, código legível próprio, ciclo de vida governado pelo servidor, e o núcleo local da ativação e do cancelamento provado contra golden capturado do legado. A F2 fecha.
- **Mudança de comportamento/estado:** o contrato deixa de ser um documento do Frappe com `docstatus` e passa a ser um recurso da API com `status` calculado no servidor; criar deixa de custar três requisições; ativar e cancelar passam a ser ações governadas por chave própria do catálogo; e criar contrato da empresa A sobre imóvel da B passa a ser recusado **pelo banco**, não por validação de aplicação.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Usuário Empresa** — monta o contrato (cadastra o rascunho) e consulta a carteira.
- **Persona secundária**: **Admin Empresa** — é quem, na configuração padrão da matriz, alcança as ações sensíveis `ACAO:ativar_contrato` e `ACAO:cancelar_contrato`. A separação entre quem cadastra e quem ativa é o que o ramo B preserva.
- **Persona terciária**: **Sysloc Master** — não alcança dado de negócio nenhum (ADR-0013); aparece aqui só para registrar que o contrato está **fora** do alcance dele.
- **Contexto de uso**: app web da imobiliária, em horário comercial, na tela Contratos. O código legível (`CTR-2026-00021`) é o que o usuário lê como título do contrato e como rótulo nos seletores do Financeiro.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Golden de ativação e cancelamento** capturado do `/opt/frappe`, pelo roteiro da `caracterizacao-regras-legadas` (site efêmero, cenários sintéticos), cobrindo as regras **inteiras** — inclusive as partes que só a F3 vai implementar *(ramo A)*
- [ ] **`Contrato`** em `negocio`, com `empresa_id`, RLS forçada e FK composta, no molde da fatia 1, e sob a guarda de cobertura existente
- [ ] **`ContratoFiador` como vínculo puro** — sem `retiradoEm`, sem atributos próprios, zero a N por contrato *(ramo D)*
- [ ] **Código legível `CTR-{ano}-{5 dígitos}`**, série por empresa com o ano no escopo, contador com **valor inicial parametrizável**, furo aceito, número nunca reusado *(ramo E, ADR-0015)*
- [ ] **Ciclo de vida com quatro estados** — `RASCUNHO`, `ATIVO`, `CANCELADO`, `ENCERRADO` (o último reservado, escrito pela F5); `RESCINDIDO` podado; `docstatus` eliminado *(ramo B)*
- [ ] **Criação em uma requisição**, nascendo `RASCUNHO` e já consumindo número da série
- [ ] **Ativação como rota própria**, exigindo `ACAO:ativar_contrato`: as 7 validações, as 2 derivações, a guarda de imóvel já locado, o efeito no imóvel e a transição *(ramo C)*
- [ ] **Cancelamento como rota própria**, exigindo `ACAO:cancelar_contrato`: guarda de imóvel vinculado, liberação do imóvel e transição *(ramo C)*
- [ ] **Retirada de circulação do contrato**, exigindo `ACAO:excluir_cadastro`, puramente de visibilidade — não libera o imóvel e não recusa por vínculo *(ramo B, ADR-0014)*
- [ ] **Os 2 campos de negócio**: `gerarCobrancasAutomaticamente` (default `true`) e `pdfContratoArquivo` (caminho), persistidos aqui e lidos pela F3
- [ ] **A ligação contrato ↔ imóvel** que a fatia 1 não criou, e que a ativação e o cancelamento manipulam
- [ ] **Recusa de referência a registro fora de circulação** na criação e na ativação; retirada livre no sentido inverso *(ramo D)*
- [ ] **Contratos de rota em `@sysloc/contracts`**, com o documento da API derivado dos esquemas (ADR-0016) e exigência declarada em toda rota (ADR-0011, ADR-0018)
- [ ] **Débitos com gatilho registrados** para os efeitos que atravessam F3 e F4, incluindo a pré-condição de PDF que **não** é portada

> Ponto de partida para o PRD — não é definitivo.

---

## 9. Fora do Escopo (podado / adiado)

- **Geração das cobranças na ativação** — F3. Ativar sem gerar é estado que o legado já admite pelo próprio interruptor.
- **Emissão de boletos e enfileiramento com retentativas** — F4. É o que dispararia o débito **D32 · F0/T6**; como a ativação da F2 é síncrona e não enfileira, **ele não dispara aqui**.
- **Cancelamento das cobranças e baixa Sicoob** — F3 e F4.
- **PDF do contrato e o carimbo "CANCELADO"** — F3. A pré-condição legada *"sem PDF, não cancela"* fica registrada como débito com gatilho e **não é portada**.
- **Encerramento automático de contrato vencido** — F5, e tem golden próprio (`encerrar-contratos-vencidos.json`). O valor `ENCERRADO` fica no enum, sem caminho de escrita nesta fatia.
- **`RESCINDIDO`** — podado do enum: zero caminhos de escrita no legado.
- **Histórico de fiador** — `[HIPÓTESE]` de que não é necessário; o registro jurídico é o contrato assinado.
- **Migração de dado do Frappe e semeadura efetiva do contador** — F7. A F2 só garante que o mecanismo aceite valor inicial.
- **Publicação do `@sysloc/contracts`** — entregável do marco, depois da F5.
- **Painel Master** — feature própria, posterior à F7.
- **Qualquer código de frontend** — `[fora do escopo do projeto]`, gatilho de parada do repositório inteiro.
- **Uma terceira fatia para a F2** — descartada: o núcleo local mede ~115 das 514 linhas e o golden é uma task.

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis, backend Node/NestJS/PostgreSQL nativo, substituindo integralmente o Frappe/ERPNext de `/opt/frappe`. Fronteira rígida: **só backend**.
- **PRDs / specs existentes consultados**:
  - `dominio-locacao/v1/pre-refinement.md` — pré-refinamento da **fase**, que partiu a F2 em duas por agregado. **Antecessor direto**; sete das oito tensões dele já fechadas.
  - `cadastro-de-imoveis-e-pessoas/v1/` — **fatia 1, é o molde**. 6 entidades, 33 rotas, exclusão lógica, porta de leitura com predicado de circulação. Não conflita: entrega os agregados que o contrato **aponta**.
  - `caracterizacao-regras-legadas/v1/` — os 6 goldens e o **roteiro reutilizável** de captura. Nenhum deles cobre ativação ou cancelamento; é a lacuna que o ramo A fecha.
  - `autorizacao-e-ciclo-de-acesso/v1/` — a matriz 10×7 e o catálogo fechado que já contém `ACAO:ativar_contrato`, `ACAO:cancelar_contrato`, `ACAO:excluir_cadastro` e `TELA:contratos`.
  - `integracao-bancaria-configuravel/` — F4; é o dono dos efeitos Sicoob que esta fatia declara como gatilho.
  - `docs/specs/domain-glossary.md` — glossário global. **Termos que esta fatia consome**: *Retirada de circulação*, *Ação sensível*, *Imóvel*, *Locador*, *Locatário*, *Fiador*, *Empresa*. **Termos que ela precisa acrescentar**: `[DÚVIDA]` — *Contrato*, *Ativação*, *Cancelamento* e o ciclo de vida ainda não estão lá.
- **ADRs vinculantes** (texto integral lido, não a linha-resumo): **0014** (exclusão lógica; contrato nomeado na lista; discriminador *ser referenciável*), **0015** (contador único por empresa, escopo declarado por série, furo aceito, número nunca reusado), **0016** (esquema como fonte única do contrato), **0017** (chave exposta é o código legível quando há série; `status` calculado no servidor; envelope de erro fechado), **0018** (declaração no método substitui a da classe). Também ativas: **0008** (isolamento pelo banco), **0011** (cobertura com default que nega), **0013** (alcance do Master), **0006** (ambiente de verificação separado — governa a captura do ramo A).
- **Capacidades reutilizáveis** (só para viabilidade):
  - **Persistência**: schema `negocio` com o padrão `empresa_id` + RLS forçada + FK composta e a **guarda de cobertura** que reprova tabela que nasça sem os três. Migrações vão até `0006_seguranca_dominio.sql`; esta fatia abre a `0007`. `statusLocacao` **já tem `LOCADO` no enum**, reservado pela fatia 1 para "a ativação, que é fatia seguinte".
  - **Autenticação / autorização**: sessão `better-auth` com `versaoPermissoes`, contexto por `AsyncLocalStorage` + `SET LOCAL`, catálogo fechado com as três chaves desta fatia já declaradas, e a verificação que impede publicar rota governada sem exigência.
  - **Outros módulos internos**: `apps/api/src/comum/` — `validacao.ts`, `esquema-de-erro.ts`, `esquema-publicado.ts`, `contexto-da-sessao.ts`. **Os controladores desta fatia importam de lá, não copiam.** E `@sysloc/contracts`, criado pela fatia 1, que ganha os contratos de contrato.
- **Conflitos / sobreposições detectados**:
  1. **`imovel.contrato_ativo` existe no legado e não existe no schema novo.** É `Link` para `Contrato`; a fatia 1 criou `status_locacao` mas não a ligação. A forma que essa ligação toma é decisão desta fatia — não há sobreposição de dono, mas há trabalho não previsto no briefing.
  2. **Divergência de formato do código legível** entre o plano (`CTR-2026-0001`, 4 dígitos) e o legado real (`CTR-.YYYY.-.#####`, 5). Resolvida em favor do medido; o texto do plano fica como pendência.
  3. **Nenhuma duplicação de feature** — nenhuma spec existente cobre `Contrato`.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` **Não é necessário preservar histórico de fiador.** O vínculo é substituível por remoção e inserção, e o registro jurídico de quem garantiu é o contrato assinado. Se for falsa, `ContratoFiador` muda de classe na ADR-0014 e o ramo D se reabre — é a premissa mais cara deste artefato.
- `[HIPÓTESE]` **`ACAO:ativar_contrato` e `ACAO:cancelar_contrato` pertencem, por padrão do perfil, ao Admin Empresa**, e o Usuário Empresa cadastra sem ativar. É a leitura da matriz 10×7; o ajuste individual pode conceder a qualquer um.
- `[HIPÓTESE]` **A ativação da F2 é síncrona e não enfileira nada** — o que mantém o débito **D32 · F0/T6** sem disparar nesta fatia. Se a spec decidir enfileirar, o débito dispara e fecha aqui.
- `[HIPÓTESE]` **O `/opt/frappe` continuará de pé e responsivo durante a execução da fatia**, permitindo a captura do ramo A. Hoje ele responde: a consulta somente-leitura deste pré-refinamento funcionou.
- `[HIPÓTESE]` **Não há entidade nova escondida.** As 8 entidades da fase cobrem os 35 endpoints do frontend no que toca a contrato — `Cobranca` e `Log Envio Cobranca` aparecem no inventário, mas são F3, não entidades faltantes desta fase.

**Decisões já tomadas (fora de negociação)**:

- "o que preciso alcançar é: frappe excluido e backend novo totalmente funcional" — objetivo declarado pelo usuário, e o critério sob o qual o ramo A foi decidido a favor da captura de golden.
- Português brasileiro em tudo, sem exceção — sessão principal e todo subagente.
- O projeto roda exclusivamente em **Opus** — inclusive executores e os dois gates.
- O **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição.
- **Nada de frontend** — gatilho de parada do repositório inteiro.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o usuário ativa um contrato e não vê cobrança nenhuma, porque a F3 não chegou. → *Mitigação*: o legado já admite esse estado pelo interruptor `gerarCobrancasAutomaticamente`; a resposta da ativação deve dizer explicitamente o que fez e o que não fez, em vez de sugerir sucesso completo.
- **Risco de escopo**: a captura de golden do ramo A cobre as regras **inteiras**, inclusive partes que só a F3 implementa — o que pode ser lido como convite a implementar a F3 aqui. → *Mitigação*: a fronteira do ramo C é explícita e medida; o golden extra é **insumo arquivado**, não backlog desta fatia.
- **Risco técnico ou operacional**: a captura roda contra o `/opt/frappe`, que atende a operação. → *Mitigação*: **ADR-0006** e o padrão já provado pela `caracterizacao-regras-legadas` — o site `frontend` recebe apenas `bench backup`; tudo mais acontece em site efêmero. A TaskCard de lá tem um caso de teste dedicado a reprovar qualquer script que toque o site de produção.
- **Risco de regressão silenciosa**: `imovel.statusLocacao` passa a ser escrito por duas rotas novas (ativação e cancelamento) num campo que a fatia 1 entregou com entrada assimétrica (`SITUACOES_INFORMAVEIS` não aceita `LOCADO`). Uma "simplificação" que unifique os dois enums desfaz a decisão da fatia 1. → *Mitigação*: a assimetria está documentada no código com a razão; o Protocolo Antirregressão (P2, arqueologia) cobre.
- **Risco de privacidade / segurança / compliance**: a ADR-0014 já registra como dívida explícita a retenção indefinida de dado pessoal. O contrato acrescenta **dado financeiro** (valor mensal, valor total) ao conjunto retido. → *Mitigação*: nenhuma nesta fatia; a dívida é a mesma já registrada, ampliada em classe de dado. Fica anotada.
- **Risco de decisão**: o formato de 5 dígitos diverge do que o plano de execução e o `CLAUDE.md` escrevem. Um agente futuro que leia só o plano pode "corrigir" para 4. → *Mitigação*: a evidência medida entra na spec; considerar marcador `DECISÃO FECHADA` no ponto do código que define o formato.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **O contrato precisa de histórico de fiador?** Se sim, `ContratoFiador` deixa de ser vínculo e passa a ser entidade referenciável — o ramo D inteiro se reabre. *(a premissa mais cara do artefato)*
2. `[DÚVIDA]` **A ligação contrato ↔ imóvel é coluna no imóvel (como no legado) ou derivada do contrato?** O legado tem `imovel.contrato_ativo` denormalizado; a fatia 1 não criou nada. É decisão de modelagem que a spec resolve, mas com impacto de produto: o que a tela de imóveis mostra sobre o contrato vigente.
3. `[DÚVIDA]` **Quem corrige o formato do código legível no `plano-execucao.md` e no `CLAUDE.md`?** Os dois escrevem `CTR-2026-0001`; o real é `CTR-2026-00001`. Não é trabalho desta fatia, mas fica desalinhado se ninguém o fizer.
4. `[DÚVIDA]` **O glossário global ganha os termos desta fatia** — *Contrato*, *Ativação de contrato*, *Cancelamento de contrato*, *Rascunho* — nesta fatia ou no `/agent-spec-challenge-spec`? A rule diz que a `challenge-spec` é a dona da escrita.
5. `[DÚVIDA]` **`ENCERRADO` no enum sem caminho de escrita** repete o padrão que a fatia 1 usou com `LOCADO`. Confirmar que a guarda de cobertura e a suíte aceitam valor de enum sem produtor nesta fatia.
6. `[DÚVIDA]` **A retirada de circulação de contrato tem uso real?** Ela é coerente (rascunho criado por engano) e a ADR-0014 nomeia contrato, mas nenhum dos 35 endpoints legados exclui contrato. Vale confirmar que a rota se justifica agora, e não só por simetria.

> Nenhuma destas é **bloqueante**: as seis podem ser respondidas dentro do PRD ou da tech spec sem reabrir o brainstorm. A única que mudaria uma decisão já tomada é a **1**.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**:
  **A2** (golden das duas regras inteiras, captura agora) · **B2** (nasce rascunho, ativar é rota própria, quatro estados, número consumido na criação, cancelar ≠ retirar) · **C1** (corte por efeito colateral externo: ~115 LOC ficam, ~400 viram gatilho) · **D1** (`ContratoFiador` é vínculo puro) · **D5** (recusa na criação, livre na retirada) · **E2+E3** (5 dígitos, contador com valor inicial parametrizável).
- **Descartado com justificativa**:
  **A1**, **A3** (a regra que decide a data-fim não está no arquivo que se leria; e adiar a captura joga o custo na F3) · **B1** (quebra a separação entre quem cadastra e quem ativa, que a matriz da F1 estabeleceu) · **B3** (não representa cancelamento) · **C2**, **C3** (invadem a F3 ou produzem código morto) · **D2**, **D3** (inventam requisito que o legado não tem) · **D4** (contraria o texto da ADR-0014) · **D6** (incoerente com o seletor) · **E1** (contraria o formato medido) · **A4** e a terceira fatia (adiam sem reduzir).
- **Adiado para depois**:
  semeadura efetiva do contador na virada → **F7** · `ENCERRADO` ganha produtor → **F5** · a pré-condição de PDF no cancelamento → **F3**, como débito com gatilho · correção do formato no plano e no `CLAUDE.md` → fora desta fatia.
- **Provocações que mudaram o rumo**:
  1. **"O que a leitura do código não alcança?"** — levou a `frappe.utils.add_months`, que decide a `dataFimLocacao` de todo contrato iniciado em 29, 30 ou 31 e **não está no arquivo portado**. Foi o argumento que decidiu o ramo A a favor da captura.
  2. **"Se o rascunho consumir número, quantos furos isso cria?"** — levou à série real: contador em **20** com **1** contrato vivo. O legado já tem 19 furos e ninguém notou. A ADR-0015 aceita furo; a preocupação era teórica.
  3. **"O que o cancelamento faz primeiro?"** — revelou que ele **exige PDF e bloqueia sem ele**, o que tornaria o cancelamento impossível nesta fatia. O briefing não previa; virou a poda mais importante do ramo C.
  4. **"Qual é o formato real do código legível?"** — abriu o ramo E, que não existia no esqueleto proposto pelo briefing.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — cinco ramos convergiram, e o escopo inicial tem 14 itens | confirmado (Fase 1 e 2 com o usuário) |
| Personas | **múltiplas personas** — Usuário Empresa cadastra, Admin Empresa ativa e cancela, Sysloc Master é explicitamente excluído | inferido da matriz 10×7 da F1 |
| Novidade | **incremento** sobre o molde da fatia 1, **com regra de negócio portada nova** (as duas mais complexas da fase) | confirmado |
| Decisão arquitetural transversal nova? | **sim** — o ciclo de vida do contrato (estados, quem transita, o que cada transição faz ao imóvel) atravessa F3, F5 e F7 | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: as duas dimensões decisivas são **amplitude 4+** (cinco ramos convergidos, 14 itens de escopo, duas entidades, série nova, três rotas governadas por chaves distintas do catálogo e uma task de captura contra sistema externo) e a **decisão arquitetural transversal nova** — o ciclo de vida do contrato não se resolve dentro desta fatia: a F3 faz a cobrança nascer da ativação, a F5 escreve `ENCERRADO`, e a F7 decide a continuidade do identificador. É também o que a fatia 1 rodou, com 11 tasks aprovadas nos dois gates, e esta tem menos entidades porém mais regra portada — a formalização PRD + Tech Spec paga o rastreamento `CA-xx → CT-xxx (RN-xx)` que as regras exigem.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o miniSpec comporta 2-3 rumos, `dev+1` persona e **nenhuma decisão arquitetural transversal nova**. Aqui os três critérios falham de uma vez — cinco ramos, três perfis de produto com poderes distintos, e uma ADR nova a registrar. Além disso, o miniSpec não tem onde acomodar a **task de captura de golden**, que executa contra sistema externo sob a ADR-0006 e precisa de critério de aceitação próprio, com prova de que o site de produção não foi tocado.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por larga margem. A fatia atravessa `packages/db`, `packages/contracts`, `apps/api` e uma captura fora do repositório, e as regras portadas exigem rastreabilidade caso a caso contra o golden — exatamente o que o TaskCard não carrega.

### 15.4 Próximo Passo

```bash
# 1) A decisão arquitetural transversal nova, ANTES do PRD:
/agent-spec-adr-create "ciclo de vida do contrato de locação e quem transita cada estado"

# 2) Depois, o PRD da fatia:
/agent-spec-sdd-generate-prd "contratos de locação — Contrato e ContratoFiador, código legível CTR, ciclo de vida com ativação e cancelamento portados do Frappe"
```

> **Só uma ADR, não duas.** A candidata "referência a registro fora de circulação" (ramo D-ii) **não** vira ADR: ela é corolário direto do texto da ADR-0014 e da definição de *retirada de circulação* já canonizada no glossário global. ADR para ela seria churn.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** — não há degrau acima do SDD; o que muda é o **tamanho**. Parta para uma terceira fatia se: (a) a captura do ramo A revelar comportamento legado divergente do que a leitura sugere em **mais de duas** das sete validações; (b) a ligação contrato ↔ imóvel (dúvida 2) exigir alterar tabela entregue pela fatia 1 de forma que reabra os testes dela; (c) a premissa do histórico de fiador cair, e `ContratoFiador` mudar de classe na ADR-0014.
- **Downgrade** para miniSpec se: (a) o usuário decidir dispensar o golden do ramo A **e** a ADR do ciclo de vida, o que derruba as duas dimensões decisivas de uma vez; (b) o escopo se fechar a `Contrato` sem `ContratoFiador` e sem retirada de circulação.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs, ADRs e capacidades concretas
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito, com a ADR antes
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
