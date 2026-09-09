# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário ou medido na árvore).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: Cobrança pagável por Pix — boleto híbrido, Pix autônomo e comprovante de pagamento
- **Fonte da ideia**: `/home/sysloc/.claude/plans/vamos-come-ar-a-planejar-indexed-beacon.md` (plano técnico de 730 linhas, aprovado pelo usuário em 2026-09-09) + `docs/Pix.postman_collection` (coleção oficial "API PIX Sicoob")
- **Autor**: usuário (direção de 2026-09-09)
- **Data**: 2026-09-09
- **Versão**: v1
- **Status**: Refinado — pronto para próxima etapa
- **Relacionados**:
  - `docs/specs/features/fundacao-bancaria/v1` — publicou `MEIOS_DE_RECEBIMENTO = ['BOLETO','PIX']` e a porta `AdaptadorCobrancaBancaria`
  - `docs/specs/features/emissao-e-conciliacao/v1` — emissão de boleto; registrou por escrito a ausência do QR Pix como divergência consciente
  - `docs/specs/features/webhook-e-carne/v1` — a borda pública e o molde de roteamento sem contexto de empresa
  - `docs/specs/features/integracao-bancaria-autonoma/v1` — a entrega da notícia junto ao provedor
  - `.claude/plans/plano-saas-decisoes.md` **decisão 18** — *"Pix próprio (sem boleto) → preparar o terreno agora, implementar depois"*

> ⚠️ **A fonte da ideia vive fora do repositório**, num diretório de rascunho de plano. Ela é a
> referência técnica medida de que as tasks de medição dependem. Preservá-la dentro da fatia é
> recomendação da seção 13.

---

## 2. Ideia Resumida (uma frase)

Fazer com que a mesma cobrança de aluguel possa ser paga por Pix — primeiro pelo QR embutido no próprio boleto, depois por Pix autônomo sem boleto por trás —, com baixa automática por qualquer dos caminhos e um comprovante que registre **por qual meio** e **por qual instituição recebedora** o dinheiro entrou.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Por qual **instrumento** a cobrança se torna pagável por Pix | explorar |
| B | Como o produto **sabe que foi pago** e **por qual meio** | explorar |
| C | Que **prova de pagamento** o produto entrega — o comprovante | explorar |
| D | Como o modelo acomoda o **segundo banco** sem retrofit | explorar |
| E | O que fazer quando o locatário **paga duas vezes** | adicionado pela skill |

> **Ramo E é a provocação**: ele não estava no pedido. Ele nasce de uma consequência direta de A —
> ver §14, "Provocações que mudaram o rumo".

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Por qual instrumento a cobrança se torna pagável por Pix

**Direções candidatas:**

- **A1 — Só boleto híbrido**: o boleto nasce com QR Pix vinculado; quem paga o QR liquida o título.
  - _Exemplo:_ o locatário recebe o PDF do aluguel de outubro, aponta o app do banco para o QR impresso nele e paga. A notícia chega pela API de Cobrança que já existe, e a cobrança vira `PAGA`.
  - _Viabilidade:_ **restaura paridade perdida**. Medido nesta sessão: `codigoCadastrarPIX` **não aparece em nenhum `.ts` de `apps/` ou `packages/`** — o boleto que o backend novo emite não tem QR. O legado o enviava, e a virada da F7 (2026-09-08) desativou a única coisa que fazia isso. Reusa a emissão e o webhook de cobrança já construídos; zero rota, zero tabela, zero ADR.
- **A2 — Só Pix autônomo**: cobrança Pix própria, sem boleto por trás.
  - _Exemplo:_ a imobiliária cobra uma taxa avulsa de vistoria sem emitir boleto; o Admin gera o QR na tela e manda o copia-e-cola pelo WhatsApp.
  - _Viabilidade:_ requer porta nova, modelo de dados novo, ~6 rotas, borda pública nova, família de escopo nova junto ao provedor e **emenda à ADR-0001**. É a construção maior.
- **A3 — As duas, em fases** ✅
  - _Exemplo:_ Fase A entrega o QR no boleto em dias e vai a produção sozinha; Fase B entrega o Pix autônomo depois, sem depender daquela.
  - _Viabilidade:_ as duas são independentes por construção — o híbrido cai no ramo do boleto e não precisa de nada da Fase B.

**Direção escolhida**: **A3** — decisão do usuário, sem negociação (*"implementar as duas"*). A ordem A→B é da skill: A restaura uma perda que **já está em produção** e é a mais barata; B é construção nova.
**Podadas / adiadas**: **A1 sozinha** — não atende ao requisito de Pix como meio autônomo, que o usuário declarou. **A2 sozinha** — deixaria a regressão do híbrido de pé por mais ~16 tasks, sem razão.

---

### Ramo B — Como o produto sabe que foi pago, e por qual meio

**Sub-eixo B-i — a chegada da notícia:**

- **B1 — Só webhook**: o provedor avisa quando o pagamento cai.
  - _Exemplo:_ pagamento às 14h02 → a cobrança aparece `PAGA` na tela do Admin em segundos.
  - _Viabilidade:_ o molde existe. ⚠️ **Mas o webhook de cobrança está construído há meses e nunca entregou uma notícia** — depender só dele é repetir uma aposta que já não pagou.
- **B2 — Só varredura periódica**: uma rotina pergunta ao banco o que foi recebido na janela.
  - _Exemplo:_ a rotina das 03:00 percorre os Pix recebidos no dia anterior e baixa as cobranças.
  - _Viabilidade:_ reusa a rotina de conferência de liquidação que já roda. Latência de até 24 h — o Admin que acabou de receber a confirmação do locatário continuaria vendo `EM ABERTO`.
- **B3 — Webhook com varredura como rede** ✅
  - _Exemplo:_ o pagamento das 14h02 cai por webhook em segundos; o que se perder na madrugada é recolhido pela varredura seguinte, e o Admin nunca precisa dar baixa à mão por falha de terceiro.
  - _Viabilidade:_ os dois moldes já existem no produto; o custo incremental da rede é uma rotina agendada.

**Sub-eixo B-ii — como o meio fica registrado:**

- **B4 — O meio vem declarado no corpo do pagamento**: quem dá a baixa informa se foi Pix ou boleto.
  - _Exemplo:_ o Admin marca "recebido por Pix" ao baixar manualmente.
  - _Viabilidade:_ ❌ **contraria decisão registrada e medida**: `packages/contracts/src/cobranca.ts:308` e `apps/api/src/cobrancas/cobranca.controller.ts:485` declaram, por extenso, que *"quem paga não escreve o próprio recibo"* — e é a razão de o corpo do pagamento ter dois campos e não seis.
- **B5 — O meio é derivado do fato gravado** ✅
  - _Exemplo:_ há registro de Pix recebido para aquela cobrança → o meio é `PIX`; não há, mas há título liquidado no provedor → o meio é `BOLETO`, **inclusive quando o pagamento veio pelo QR do híbrido**; nenhum dos dois (baixa manual do Admin) → o meio é vazio, e o vazio é honesto: o produto não sabe por onde o dinheiro entrou.
  - _Viabilidade:_ é exatamente a forma que `status`, multa e valor total já usam. Vocabulário publicado e congelado desde a `fundacao-bancaria`: `MEIOS_DE_RECEBIMENTO = ['BOLETO','PIX']`, e o docblock dele diz que existe para *"impedir que a fatia que o implementar precise alargar o vocabulário publicado"*.

**Direção escolhida**: **B3 + B5**.
**Podadas / adiadas**: **B1** e **B2** isoladas (uma repete a aposta que não pagou, a outra entrega tarde demais); **B4** (contraria decisão registrada).

> ⚠️ **O discriminador do meio é decisão do usuário e é o eixo de tudo**: *"se pagar pelo Pix do
> boleto híbrido, a forma será **boleto**"*. O que se grava não é como a pessoa tocou no celular —
> é **qual instrumento de cobrança foi liquidado**. Consequência boa e não óbvia: a **Fase A não
> precisa de nada** na derivação, porque o híbrido já cai no ramo do boleto por construção.

---

### Ramo C — Que prova de pagamento o produto entrega

**Direções candidatas:**

- **C1 — Nenhuma; o histórico da tela basta**.
  - _Exemplo:_ o locatário pede prova e o Admin manda uma captura de tela.
  - _Viabilidade:_ custo zero. ❌ Contraria a direção do usuário, que pediu comprovante com meio e banco.
- **C2 — Comprovante em PDF, composto sob demanda e nunca armazenado** ✅
  - _Exemplo:_ o locatário pede prova do aluguel de setembro; o Admin abre a cobrança e baixa um PDF que traz identificador, competência, vencimento, valor original, multa e juros aplicados, valor pago, data, **meio de recebimento** e **instituição recebedora**.
  - _Viabilidade:_ **não existe hoje** — medido: `packages/documentos/src/` publica o documento do contrato, a mensagem de confirmação, o renderizador e o mesclador de PDF, e nada mais; as menções a "comprovante"/"recibo" na árvore são texto de cláusula contratual e a metáfora acima. O PDF do boleto é **documento do banco**, não recibo do Sysloc. Reusa `renderizador-pdf.ts`, a mesma máquina do documento do contrato.
- **C3 — Comprovante gerado uma vez e guardado em arquivo**.
  - _Exemplo:_ o PDF é salvo quando a cobrança é paga e servido depois.
  - _Viabilidade:_ ❌ **viola a ADR-0030 na regra geral** — artefato derivado de dado gravado é composto sob demanda e nunca armazenado. A coerência com o cadastro vem da **ausência de cópia**. (O PDF do boleto se guarda porque é fato de terceiro, que é a cláusula de **exclusão** da mesma ADR — não o caso aqui.)
- **C4 — Envio automático do comprovante ao locatário quando a cobrança é paga** ⏸️
  - _Exemplo:_ pagou às 14h02, recebe o comprovante por e-mail às 14h03, sem ninguém pedir.
  - _Viabilidade:_ reusa a régua e a mensagem de confirmação. É **acréscimo de comportamento** além do pedido — adiado.

**Direção escolhida**: **C2**, e ele **entra já na Fase A** (direção do usuário).
**Podadas / adiadas**: **C1** (contraria a direção); **C3** (viola ADR-0030); **C4** adiado para v2 — não foi pedido, e emitir documento sob demanda é pré-requisito de enviá-lo automaticamente.

> ⚠️ **Só cobrança paga tem comprovante.** Sobre cobrança em aberto ou cancelada, o produto recusa
> nomeando o estado — comprovante de algo não pago é o documento que não pode existir.

---

### Ramo D — Como o modelo acomoda o segundo banco

**Direções candidatas:**

- **D1 — Não registrar instituição; hoje só há Sicoob**.
  - _Exemplo:_ o comprovante diz apenas "pago por Pix".
  - _Viabilidade:_ ❌ no dia do segundo banco, todo comprovante antigo fica sem resposta e a correção vira migração retroativa sobre dado histórico.
- **D2 — Registrar o banco PAGADOR**.
  - _Exemplo:_ o comprovante diz "pago pelo Nubank".
  - _Viabilidade:_ ❌ **dobrado**. Contraria a direção do usuário; e é tecnicamente frágil — o identificador da transação carrega o código do PSP que **originou** o pagamento, isto é, o lado do pagador, e usá-lo como recebedor **inverteria o dado no comprovante**. Ainda exigiria uma tabela de participantes do Bacen que envelhece sozinha.
- **D3 — Registrar o banco RECEBEDOR, gravado no ato da emissão** ✅
  - _Exemplo:_ o comprovante diz "recebido via Sicoob"; no dia em que a imobiliária X operar por outro banco, os comprovantes dela passam a dizer o nome dele, e os antigos continuam corretos.
  - _Viabilidade:_ **o produto já sabe** — é a instituição pela qual ele mesmo emitiu a cobrança. Não depende de o provedor informar coisa alguma. Vocabulário fechado de um item hoje, no molde exato de `MEIOS_DE_RECEBIMENTO`: banco novo entra por **acréscimo à lista**, que a ADR-0039 permite, e não por mudança de contrato.

**Direção escolhida**: **D3** — decisão do usuário: *"teremos integrações com outros bancos posteriormente, aumentando o leque de opções para meu cliente do SaaS"*.
**Podadas / adiadas**: **D1** (cria retrofit programado); **D2** (inverte o dado e contraria a direção).

> Quando a notícia do provedor trouxer identificação de instituição, ela é tratada como
> **conferência** — divergência se registra e se recusa, nunca se aplica —, e não como fonte. É a
> cláusula literal da ADR-0035.

---

### Ramo E — Pagamento em duplicidade `[provocação da skill]`

Com boleto e Pix vivos ao mesmo tempo, o locatário pode pagar os dois. Hoje o produto garante que *"em nenhum instante existem dois boletos pagáveis"*; com **dois instrumentos**, essa garantia não se aplica.

**Direções candidatas:**

- **E1 — Aceitar a janela**: ao liquidar por um, derrubar o outro no provedor.
  - _Exemplo:_ pagou o Pix às 10h00; o produto pede a revogação do boleto às 10h00m02s; quem pagar o boleto às 10h01 ainda consegue, e o dinheiro entra duas vezes.
  - _Viabilidade:_ barato, mas deixa a janela aberta justamente no cenário mais provável (o locatário na dúvida entre os dois).
- **E2 — Devolver o segundo pagamento automaticamente**.
  - _Exemplo:_ o segundo pagamento é devolvido em minutos e a trilha registra a devolução.
  - _Viabilidade:_ o provedor oferece a operação. Exige poder de **movimentar dinheiro** junto ao banco — devolução automática sem decisão humana é risco de produto desproporcional ao problema.
- **E3 — Um instrumento vivo por vez** ✅
  - _Exemplo:_ emitir o Pix autônomo sobre uma cobrança que já tem boleto **revoga o boleto no mesmo ato**; a cobrança nunca tem dois instrumentos pagáveis, e o desempate é estrutural, não uma corrida entre dois avisos.
  - _Viabilidade:_ é a mesma propriedade que o produto já garante para boletos, estendida ao segundo instrumento.
- **E4 — Constatação: na Fase A o problema não existe.**
  - _Exemplo:_ o QR do híbrido e o código de barras são **duas trilhas do mesmo título**. Pagou por uma, o título está liquidado e a outra deixa de ser pagável — pelo banco, não por regra nossa.

**Direção escolhida**: **E3 na Fase B**, e **E4 é fato na Fase A**.
**Podadas / adiadas**: **E1** (deixa a janela aberta no cenário mais provável); **E2** adiada — só se a medição mostrar que a duplicidade acontece na prática, e ainda assim como ato do Admin, nunca automático.

> ⚠️ **Esta é a provocação que mudou o rumo, e ela reenquadra o pedido.** O usuário pediu *"uma
> cobrança pagável por boleto ou por Pix"*. **Quem entrega isso é a Fase A**, com um instrumento só
> e duplicidade impossível. A Fase B **não** é "a mesma cobrança pagável pelos dois ao mesmo tempo"
> — é o Pix para a cobrança que **não tem** boleto, ou que passa a não ter. Lidos assim, os dois
> objetivos deixam de competir, e o problema da duplicidade some do desenho em vez de virar
> tratamento.

---

## 5. Problema

**Qual é a dor real hoje?** Quatro, todas medidas:

1. **O boleto emitido pelo produto novo não tem QR Pix.** É **perda funcional em relação ao sistema que ele substituiu** — o legado emitia com QR, e a desativação do Frappe em 2026-09-08 tirou de operação a única coisa que fazia isso. A ausência está registrada como divergência consciente numa spec de agosto, mas **nunca foi escriturada como perda**.
2. **Não existe Pix sem boleto por trás.** Cobrança avulsa, acordo, taxa — tudo passa obrigatoriamente pela emissão de um título.
3. **O produto não emite comprovante de pagamento.** O que existe é o PDF do banco (documento de terceiro) e o histórico bancário (auditoria interna). Nenhum dos dois é o papel que o locatário pede e o locador arquiva.
4. **O produto não registra por qual meio nem por qual instituição o dinheiro entrou** — e sem isso, o dia do segundo banco vira migração retroativa em vez de acréscimo.

**Como aparece no dia a dia?** O locatário abre o boleto do aluguel, não acha QR e digita 47 dígitos de código de barras, ou pede à imobiliária "manda o Pix" — e a imobiliária manda uma chave solta, fora do sistema, cujo pagamento **não dá baixa em lugar nenhum** e volta como conciliação manual. Quando alguém pede comprovante, o Admin manda captura de tela.

**Quem sente o impacto?** O **locatário** (paga pior); o **Admin da imobiliária** (responde à pergunta do Pix, concilia à mão o que entrou fora do sistema, não tem documento para enviar); o **locador** (recebe repasse sem prova formal do recebimento).

**Por que resolver agora?** A perda do item 1 está **em produção neste momento** e nasceu de uma virada concluída há um dia. E a decisão 18 do plano do SaaS — *"preparar o terreno agora, implementar depois"* — é justamente a metade adiada que está chegando: o vocabulário foi publicado e congelado esperando por esta fatia.

---

## 6. Objetivo Principal

- A cobrança de aluguel pode ser paga por Pix, e o produto **dá baixa sozinho** por qualquer caminho de pagamento, sem conciliação manual.
- O produto sabe dizer, para toda cobrança paga, **por qual meio** e **por qual instituição recebedora** o dinheiro entrou — e entrega isso num **comprovante** que o Admin envia ao locatário ou ao locador.
- O modelo nasce **multi-provedor**: acrescentar um segundo banco é acréscimo a uma lista, não reforma do que já foi gravado.

**Mudança de comportamento esperada**: pagamento por Pix deixa de ser um caminho paralelo fora do sistema e passa a ser um caminho do sistema, com baixa automática e prova documental.

---

## 7. Público / Usuário Envolvido

- **Persona primária — Admin da imobiliária**: emite a cobrança, registra a chave Pix da empresa, consulta o estado do pagamento e entrega o comprovante. É quem opera o produto.
- **Persona secundária — locatário**: não usa o sistema; **recebe** o boleto com QR (ou o QR/copia-e-cola avulso) e o comprovante. É quem sente o valor primeiro.
- **Persona secundária — locador**: recebe o comprovante como prova do recebimento do aluguel do seu imóvel.
- **Persona de operação — operador do SaaS**: nenhum efeito direto `[HIPÓTESE]` — o painel do operador não trata de cobrança, e a superfície dele não é tocada por este escopo.
- **Contexto de uso**: o Admin no navegador, em horário comercial; o locatário no celular, no app do banco, a qualquer hora — inclusive em fim de semana e feriado, quando ninguém da imobiliária está disponível para conciliar à mão.

---

## 8. Escopo Inicial (resultado da convergência)

### Fase A — o caminho curto, vai a produção sozinha

- [ ] **Registro da chave Pix da empresa** — hoje não existe lugar para ela no produto, e ela é pré-requisito de tudo (ramo A)
- [ ] **Boleto híbrido**: o boleto passa a nascer com QR Pix vinculado, restaurando a paridade com o legado (ramo A, direção A1 dentro de A3)
- [ ] **Instituição recebedora** gravada no ato da emissão, com vocabulário fechado de um item (ramo D, direção D3)
- [ ] **Meio de recebimento derivado** do fato gravado, publicado no contrato da cobrança (ramo B, direção B5)
- [ ] **Comprovante de pagamento em PDF**, composto sob demanda e nunca armazenado (ramo C, direção C2)
- [ ] **Medição contra a conta real** antes de qualquer linha de produção: a emissão aceita o campo do QR e o PDF volta com ele?

### Fase B — Pix autônomo, depois e sem depender da Fase A

- [ ] **Medição contra a conta real** dos escopos Pix, das operações e do formato da notícia — **antes** de qualquer código
- [ ] **Emenda à ADR-0001** e decisões arquiteturais registradas (ramo A, direção A2)
- [ ] **Cobrança Pix própria**: emitir, consultar e revogar, com QR e copia-e-cola para o locatário
- [ ] **Baixa automática por webhook, com varredura periódica como rede** (ramo B, direção B3)
- [ ] **Um instrumento vivo por vez** — emitir o Pix sobre cobrança com boleto revoga o boleto no mesmo ato (ramo E, direção E3)
- [ ] **O comprovante da Fase A acolhe o meio `PIX`** — o mesmo documento, não um segundo
- [ ] **Ativação ponta a ponta com pagamento real**, feito por uma pessoa

> Ponto de partida para o PRD — não é definitivo. O fatiamento task a task, com as dependências de
> medição marcadas, está no plano citado em §1.

---

## 9. Fora do Escopo (podado / adiado)

- **Qualquer código de frontend** `[fora do escopo do projeto]` — o fonte React vive na máquina local do usuário; as telas de Pix e do comprovante viram **handoff**. Task que peça implementação de frontend é **gatilho de parada** declarado no `CLAUDE.md`.
- **Envio automático do comprovante por e-mail ao pagar** (C4) — adiado para v2: é acréscimo de comportamento além do pedido, e emitir sob demanda é pré-requisito dele.
- **Devolução automática de pagamento em duplicidade** (E2) — adiada: com "um instrumento vivo por vez" (E3), a duplicidade deixa de ser o cenário provável. Reconsiderar só com caso real medido, e ainda assim como ato do Admin.
- **Comprovante armazenado em arquivo** (C3) — podado: viola a regra geral da ADR-0030.
- **Meio declarado no corpo do pagamento** (B4) — podado: contraria decisão registrada e medida no contrato publicado.
- **Banco pagador no comprovante** (D2) — podado: contraria a direção do usuário e inverteria o dado.
- **Renovação do certificado, cadastro da empresa e concessão dos escopos junto ao banco** — são **pré-requisitos de operação**, não construção. Nenhuma linha de código os substitui (§11, §12).
- **Reescrever o que a F3 e a F4 fecharam** — a régua, a mora, a derivação da cobrança e a emissão de boleto estão fechadas; esta fatia as **consome**.

---

## 10. Ancoramento no Projeto (guarda de escopo)

**O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL nativo, sem Docker. Sete itens do marco de entrega alcançados; superfície da imobiliária congelada desde 2026-08-23. Cobrança bancária integrada ao Sicoob (emissão, revogação, consulta, notícia de liquidação construída).

**PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md` — 24 fatias, 14 PRDs):

| Spec | Relação |
|---|---|
| `fundacao-bancaria/v1` | **fundação direta** — publicou `MEIOS_DE_RECEBIMENTO = ['BOLETO','PIX']` e a porta `AdaptadorCobrancaBancaria`. O docblock declara que o `PIX` existe para esta fatia **não precisar alargar contrato** |
| `emissao-e-conciliacao/v1` | **adjacente e tocada** — a emissão do boleto ganha o QR. O `workflow-report` dela registra a ausência do QR como divergência consciente |
| `webhook-e-carne/v1` | **molde** — a borda pública e o roteamento sem contexto de empresa |
| `integracao-bancaria-autonoma/v1` | **molde** — a entrega da notícia junto ao provedor, incluindo a porta irmã de nome próprio |
| `integracao-bancaria-sicoob/v1` (pre-refinement) | **precedente direto** — declarou a API Pix `[fora do escopo]` **daquela** fatia por decisão 18, com a ressalva de que o legado já recebia por Pix pelo QR do boleto |
| `cobranca-e-mora/v1` | **consumida** — a mora derivada e carimbada no pagamento; o comprovante a exibe |
| `documentos-e-confirmacao/v1` | **capacidade reutilizável** — a máquina de PDF |
| `painel-master-administradores/v1` | **nada a ver** — superfície do operador do SaaS, não tocada |

**Capacidades reutilizáveis** (só para viabilidade):

- **Persistência**: PostgreSQL 18 com RLS por empresa e FK composta; toda tabela de negócio já nasce isolada pelo banco.
- **Autenticação / autorização**: sessão + catálogo fechado de 10 telas × 7 ações, que **gera o menu do frontend**. Duas ações novas o levam de 17 para 19 chaves — acréscimo autorizado pela ADR-0039, mas com custo declarado. ⚠️ **A Fase A não mexe no catálogo**: reusa a ação de emitir boleto.
- **Documentos**: `packages/documentos/src/renderizador-pdf.ts` — a mesma máquina do documento do contrato, reaproveitável pelo comprovante.
- **Cobrança bancária**: `packages/cobranca-bancaria/` — adaptador Sicoob com mTLS, credencial por família de escopo, tradução de recusa do provedor.
- **Liquidação**: porta única de liquidação pelo provedor, que já delega à mesma baixa da conciliação manual — **os centavos de mora saem iguais pelos dois caminhos, por construção**.
- **Automação**: rotinas agendadas por empresa com batimento de relógio (corrigido em 2026-09-09) — a varredura do ramo B tem onde morar.

**Conflitos / sobreposições detectados**:

1. **Nenhuma sobreposição de feature** — nenhuma spec existente implementa Pix. Todas o declaram fora, por decisão 18.
2. ⚠️ **Conflito com uma asserção executável, e ele é conhecido**: um caso da suíte afirma hoje que *"o conjunto de operações sobre `PIX` é **vazio**"*, varrendo o pacote inteiro sem distinguir maiúsculas. **Declarar qualquer símbolo com "pix" no nome ali reprova a suíte** — o caso tem de ser reescrito no mesmo diff, trocando "vazio" pela lista exata. Batizar as operações com outro nome para o caso continuar verde seria **evasão de nome**, e o Protocolo Antirregressão a trata como regressão de prova.
3. ⚠️ **Consequência de escopo que precisa ser escriturada**: o marco de entrega está em 7/7 e o `CLAUDE.md` declara que, alcançado o marco, *"encerra-se a construção aqui"*. Implementar Pix é **construção nova além do marco** — decisão do usuário, e legítima —, mas duas coisas se movem no mesmo passo: a superfície ganha operações (autorizado pela ADR-0039) e o handoff do frontend deixa de descrever a superfície inteira até ser reemitido.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` O aplicativo do produto junto ao banco tem — ou pode ter — a API Pix concedida. Se o `client_id` só carrega escopos de boleto, a Fase B depende de um cadastro no portal que ninguém do time controla. **Uma chamada responde isso**, e ela é a primeira task da Fase B.
- `[HIPÓTESE]` O identificador de transação que o produto emitir volta íntegro na notícia do provedor. Se ele for truncado ou não devolvido, a chave de roteamento cai e não há plano B barato.
- `[HIPÓTESE]` Cada imobiliária tem chave Pix própria. Se várias compartilham a conta do banco, o cadastro da notificação passa a ser por chave e não por empresa.
- `[HIPÓTESE]` A cobrança Pix própria aceita vencimento, multa e juros — e o produto a emitirá **com valor original e sem mora do lado do banco**, porque a mora do Sysloc é derivada e carimbada no pagamento. Se o banco aplicar a mora dele, todo pagamento divergiria do carimbo.
- `[HIPÓTESE]` A chave Pix **não é segredo operável**: ela viaja no QR e é pública por natureza, logo não se cifra. A razão precisa estar escrita no ponto do código, senão a rodada seguinte "corrige" para cifrar.
- Os três **pré-requisitos operacionais** estão ao alcance do usuário: certificado renovado (o conhecido venceu em 2026-08-22), ao menos uma empresa cadastrada na base de produção (hoje vazia por decisão) e a chave Pix registrada. **Sem eles nem a Fase A sai do lugar.**

**Decisões já tomadas (fora de negociação)** — declaradas pelo usuário em 2026-09-09:

- **Implementar as duas** — o boleto híbrido (Fase A) e o Pix sem boleto por trás, pela API própria do Pix (Fase B).
- **O comprovante de pagamento carrega o meio, e o pagamento pelo QR do boleto híbrido tem meio `BOLETO`, porque o discriminador é o instrumento liquidado.**
- **O comprovante carrega o banco RECEBEDOR, nunca o pagador** — porque virão integrações com outros bancos, ampliando o leque de opções do cliente do SaaS.
- **O comprovante entra já na Fase A**, e não depois.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o locatário continua digitando o código de barras por hábito, e o QR não muda nada. → *Mitigação*: a Fase A é barata o bastante para que o custo seja irrelevante mesmo com adoção baixa — e ela restaura uma capacidade que **o sistema anterior tinha**, então o piso é a paridade, não a aposta.
- **Risco de escopo (pode explodir?)**: **alto e conhecido**. A Fase B tem ~16 tasks, toca a superfície publicada, o catálogo que gera o menu do frontend, uma ADR ativa e uma borda pública. → *Mitigação*: **as duas fases são independentes e a Fase A vai a produção sozinha**. Se a Fase B travar numa medição, o valor da A já está entregue.
- **Risco operacional — o bloqueio não é técnico**: o webhook de cobrança está construído e provado há meses e **nunca entregou uma notícia**, porque faltam certificado vigente, empresa cadastrada e o cadastro junto ao provedor. **Nenhuma dessas causas some com o Pix.** → *Mitigação*: as duas primeiras tasks de cada fase são **medição contra a conta real**, e nenhuma linha de produção as precede.
- **Risco de "código provado não é ambiente provado"**: é a classe que já mordeu duas vezes neste repositório em uma semana — sete rotas em `404` com a suíte verde, e doze dias de backup falhando com a suíte verde. → *Mitigação*: a verificação ponta a ponta com **pagamento real de centavos, feito por uma pessoa**, é passo obrigatório e **não tem substituto**. A suíte prova a árvore; ela não prova que o banco entrega a notícia.
- **Risco de regressão de prova**: a asserção que hoje afirma "nenhuma operação sobre PIX" precisa ser **reescrita e falsificada**, nunca contornada por renomeação (§10, conflito 2). → *Mitigação*: declarar a reescrita na spec da task, com a prova de falsificação executada.
- **Risco de privacidade / compliance**: baixo. A chave Pix é pública por natureza e **não** é segredo operável; nenhum material de certificado ou senha muda de tratamento. O comprovante nomeia locador e locatário — mesma classe de dado que o documento do contrato já carrega, sob o mesmo isolamento por empresa.
- **Risco de dinheiro entrar duas vezes**: tratado no ramo E e **removido do desenho** por "um instrumento vivo por vez", em vez de tratado por devolução.

---

## 13. Dúvidas em Aberto

Perguntas objetivas. **As quatro primeiras são de produto e são para o usuário**; as demais são de medição contra a conta real e se respondem nas tasks A1/B1.

1. `[DÚVIDA]` **Confirma o reenquadramento do ramo E?** A Fase A entrega "pagável por boleto ou por Pix" com **um instrumento só**; a Fase B entrega Pix para cobrança **sem** boleto, e emitir o Pix sobre uma cobrança com boleto **revoga o boleto**. Isso é o que você quis dizer, ou você espera boleto e Pix pagáveis **ao mesmo tempo**, aceitando a janela de pagamento duplo?
2. `[DÚVIDA]` **Quem pode baixar o comprovante?** Só o Admin da imobiliária (que o repassa), ou existe caminho para o locatário obtê-lo direto, sem sessão — como já acontece com o boleto?
3. `[DÚVIDA]` **A cobrança Pix autônoma nasce a partir de uma cobrança existente, ou é um tipo novo de cobrança avulsa?** O escopo assume a primeira: sempre sobre uma cobrança que já existe no produto. Cobrança avulsa sem contrato é feature diferente.
4. `[DÚVIDA]` **Emitir o Pix é ação sensível própria** (entra no catálogo de permissões, levando 17 → 19 chaves e mexendo no menu do frontend), **ou reusa a permissão de emitir boleto** (custo zero, mas quem pode emitir boleto passa a poder emitir Pix)?
5. `[DÚVIDA]` O `client_id` atual tem escopos Pix concedidos? *(medição B1)*
6. `[DÚVIDA]` O copia-e-cola vem pronto do provedor — e portanto se guarda como fato de terceiro — ou o produto tem de compô-lo, e portanto **não** pode guardá-lo? *(medição B1; bifurcação de modelo)*
7. `[DÚVIDA]` A notícia do provedor identifica a instituição recebedora? Se identificar, a conferência tem o que conferir; se não, a gravação na emissão continua sendo a fonte e a conferência simplesmente não roda. *(medição B1 — em nenhum caso se deriva do identificador da transação)*
8. `[DÚVIDA]` O provedor sonda a URL cadastrada antes de aceitá-la? Se sondar, uma borda incompleta reprova o cadastro em silêncio. *(medição B1)*

> **Nenhuma das quatro primeiras bloqueia o início da Fase A.** As dúvidas 1, 3 e 4 são da Fase B; a
> dúvida 2 alcança a Fase A e tem resposta conservadora por padrão: **só com sessão**, no molde de
> quem já opera a cobrança. Ampliar depois é acréscimo; restringir depois é quebra de contrato.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial**: **A3** (as duas, em fases), **B3** (webhook com varredura como rede), **B5** (meio derivado do fato, com o híbrido contando como `BOLETO`), **C2** (comprovante sob demanda, nunca armazenado, já na Fase A), **D3** (instituição recebedora gravada na emissão, vocabulário fechado), **E3/E4** (um instrumento vivo por vez; na Fase A o problema não existe).
- **Descartado com justificativa**: **A1/A2 isoladas** (não atendem ao pedido inteiro); **B1** e **B2** isoladas (a aposta que já não pagou / latência de 24 h); **B4** (contraria decisão registrada no contrato publicado); **C1** (contraria a direção); **C3** (viola a ADR-0030); **D1** (retrofit programado); **D2** (inverteria o dado no comprovante e contraria a direção); **E1** (deixa a janela aberta no cenário mais provável).
- **Adiado para v2/v3**: **C4** (envio automático do comprovante ao pagar) e **E2** (devolução automática de duplicidade).
- **Provocações que mudaram o rumo**:
  1. **"O boleto de hoje não é híbrido"** — medido nesta sessão. Transformou o pedido de *"integrar a API Pix"* numa fatia barata que **restaura uma perda em produção** mais uma fatia grande de construção nova. Sem essa medição, a Fase A não existiria e a perda continuaria de pé por ~16 tasks.
  2. **"E se o locatário pagar os dois?"** — ramo que ninguém pediu. Ele reenquadrou o objetivo: quem entrega *"pagável pelos dois"* é a Fase A, com duplicidade **impossível**; a Fase B é o Pix para a cobrança **sem** boleto. Lidos assim, o problema some do desenho em vez de virar tratamento.
  3. **"O recebedor o produto já conhece"** — a direção do usuário (banco recebedor, não pagador) é, além de decisão de produto, a **mais barata e mais confiável**: o produto sabe por qual instituição ele mesmo emitiu, e não depende do provedor informar nada.

### Decisões auto-resolvidas nesta sessão (registro A1)

> `.claude/rules/autonomia-do-run.md` §A1 — formuladas como pergunta, resolvidas pela recomendada,
> registradas, sem pausar. **Este bloco não é decisão do usuário** — o bloco dele é a §11.

| # | Pergunta | Adotada | Razão |
|---|---|---|---|
| 1 | Pausar na Fase 1 para validar o esqueleto, como a skill manda? | **Não pausar; apresentar o esqueleto e a árvore na resposta** | A1 tem escopo universal e diz: onde o framework mandar perguntar, decida pela recomendada e registre. O esqueleto fica visível e contestável sem custo |
| 2 | Um pré-refinamento para as duas fases, ou um por fatia? | **Um só, cobrindo as duas** | Pré-refinamento é discovery **anterior** ao fatiamento; a §14 registra o corte em duas fatias, e cada uma gera o próprio PRD |
| 3 | Ordem das fases | **A antes de B** | A restaura perda que já está em produção, é a mais barata e não depende de B |
| 4 | Ramo E (duplicidade): E1, E2 ou E3? | **E3 — um instrumento vivo por vez** | Remove o problema do desenho em vez de tratá-lo; é a mesma propriedade que o produto já garante para boletos. Levantado como dúvida 1 por mudar o que o locatário vê |
| 5 | O comprovante alcança o locatário sem sessão? | **Não, na v1 — só com sessão** | Conservadora: ampliar depois é acréscimo, restringir depois é quebra de contrato. Registrado como dúvida 2 |
| 6 | A ADR-0001 vira ADR nova ou emenda? | **Emenda** | A decisão de fundo não muda, e é a `Decision` que se abre ao citar. ADR paralela deixaria o *"apenas"* sem qualificação, e o próximo gate leria violação — custo que a emenda de 2026-08-15 registra por escrito |
| 7 | Registrar a emenda por `/agent-spec-adr-create`? | **Não — edição manual, dentro da fatia** | A skill cria ADR **nova**, que é exatamente o que a decisão 6 recusa; e não há skill de emenda. O repositório já emendou cinco vezes à mão, preservando o texto original |

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — cinco ramos explorados, seis direções absorvidas no escopo inicial | confirmado (brainstorm) |
| Personas | **múltiplas** — Admin da imobiliária (opera), locatário (paga e recebe o comprovante), locador (recebe a prova) | inferido |
| Novidade | **Fase A: incremento** · **Fase B: greenfield** (porta nova, modelo de dados novo, borda pública nova, família de escopo nova junto ao provedor) | confirmado |
| Decisão arquitetural transversal nova? | **sim, na Fase B** — emenda à ADR-0001. **Não na Fase A** | confirmado |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — **duas rodadas, uma por fase**.

**Justificativa**: as duas dimensões decisivas são **múltiplas personas** e **decisão arquitetural nova**. Pela tabela de decisão, qualquer sinal SDD vence o desempate, e aqui há dois na Fase B (emenda à ADR-0001 + módulo novo) e um na Fase A (múltiplas personas). Some-se a amplitude de 4+ rumos convergidos. A Fase A é a menor das duas, mas **publica rota nova, documento novo e mudança de contrato** — move as três âncoras de superfície e a versão do pacote que o frontend importa —, e neste repositório toda fatia com esse alcance passou por PRD + Tech Spec + Task Plan.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo — e ele foi considerado a sério para a Fase A): a Fase A tem 7 tasks e nenhuma decisão arquitetural nova, o que a coloca perto da faixa da miniSpec. Ela cai por **duas razões medidas**: (i) atinge **três personas**, não "dev+1" — o Admin ganha operação nova, o locatário passa a receber documento novo, o locador ganha prova formal; (ii) o INTENT da miniSpec não comporta a **rastreabilidade `CA-xx → CT-xxx (RN-xx)`** que esta base exige por convenção, nem o registro de âncoras de superfície na §5.2 da task — e esta fatia move âncora, catálogo publicado e versão de contrato. Para a **Fase B** a miniSpec não é sequer defensável: 16 tasks, emenda de ADR, borda pública nova e sete pontos bloqueados por medição contra terceiro.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por larga margem. O escopo atravessa contratos, camada de dados, adaptador de provedor, borda HTTP, documentos e rotinas agendadas — seis módulos —, e o TaskCard perde a rastreabilidade US→task que os dois gates deste repositório consomem. Ele seria adequado a **uma** task isolada desta fatia, nunca ao conjunto.

**Por que não uma rodada só de SDD para as duas fases**: as fases são independentes por construção, e a Fase A **vai a produção sozinha**. Um PRD único as acoplaria — a Fase A ficaria esperando as sete medições da Fase B, das quais não depende.

### 15.4 Próximo Passo

```bash
# 1) Fase A — o caminho curto, restaura a paridade perdida e entrega o comprovante
/agent-spec-sdd-generate-prd "boleto híbrido com QR Pix, meio de recebimento, instituição recebedora e comprovante de pagamento"

# 2) Fase B — depois da Fase A em produção; a emenda à ADR-0001 é task DENTRO da fatia,
#    feita à mão no molde das cinco emendas existentes. NÃO use /agent-spec-adr-create:
#    ela cria ADR nova, que é exatamente o que a decisão A1 #6 recusa.
/agent-spec-sdd-generate-prd "cobrança Pix autônoma com baixa automática por webhook e varredura"
```

⚠️ **Antes do primeiro comando**, dois pré-requisitos **não são código** e não têm substituto:
certificado renovado e ao menos uma empresa cadastrada na base de produção. E a **primeira task de
cada fase é medição contra a conta real** — implementar contra a coleção Postman produziria
assinaturas que a primeira medição reescreve, que é o defeito que a fatia `fundacao-bancaria` já
recusou por escrito.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (nada acima de SDD; o gatilho é **partir a fatia**, não trocar de framework):
  - a medição B1 revelar que os escopos Pix não estão concedidos → a Fase B **para** e vira conversa com o banco, antes de qualquer spec;
  - a dúvida 3 for respondida como "cobrança avulsa sem contrato" → é **feature nova**, com pré-refinamento próprio;
  - a duplicidade (ramo E) exigir devolução automática → movimentar dinheiro é decisão de produto com ADR própria.
- **Downgrade**:
  - se o usuário decidir entregar **só a Fase A sem o comprovante** — restando apenas o QR no boleto e o meio derivado —, o escopo cai para 3 tasks num módulo, sem rota nova e sem mudança de contrato: aí é **miniSpec**;
  - se a medição A1 mostrar que basta um campo no pedido de emissão e o comprovante for adiado, a Fase A cabe num **TaskCard**.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos — apresentado na resposta; validação por A1, não por pausa
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs e capacidades concretas, e com os dois conflitos detectados
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado / provocações / decisões A1
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO miniSpec e por que NÃO TaskCard
- [x] **Comando exato (15.4)** escrito, com a ressalva sobre a emenda de ADR
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
