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

- **Nome da Ideia / Feature**: `documentos-e-confirmacao` — o contrato em PDF derivado sob demanda e a confirmação do endereço de e-mail do locatário
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f3-fatia2b-documentos-e-confirmacao.md`
- **Autor**: sysloc (usuário) · brainstorm conduzido por `/agent-spec-pre-refinement`
- **Data**: 2026-08-12
- **Versão**: v1
- **Status**: Pronto para próxima etapa
- **Relacionados**:
  - `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` — o pré-refinamento **partilhado** da fatia 2, entrada dos dois runs. **Permanece intacto**; este o especializa para a sub-fatia 2b.
  - `docs/specs/features/regua-de-cobranca/v1/` — a sub-fatia **2a**, concluída em 2026-08-12 (12/12 tasks)
  - `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md` — o pré-refinamento da **fase**
  - `docs/specs/features/caracterizacao-regras-legadas/v1/golden/` — `contrato-pdf-fonte.py` e `contrato-pdf.txt`

> **Esta é a sub-fatia 2b de 2 da fatia 2 da F3, e ela FECHA A FASE 3.** O corte 2a × 2b é
> **objeto × natureza de prova**, decidido no pré-refinamento partilhado e **fora de negociação aqui**.

---

## 2. Ideia Resumida (uma frase)

Portar o que o sistema **entrega para fora** — o contrato em PDF, que deixa de ser arquivo guardado e
passa a ser **derivado sob demanda**, e a confirmação do endereço de e-mail do locatário, que é
portada **com o defeito fechado** em vez de reproduzida.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | O corte da tradução das 759 linhas do gerador de PDF | explorar |
| B | O documento como derivação — o que morre com o arquivo | explorar |
| C | Quem tem direito ao documento — sessão × sem sessão | **adicionado** |
| D | A confirmação de e-mail refeita — token, ciclo, gatilho | explorar |
| E | A prova — um golden cobre um caminho de três eixos | explorar |

> **O ramo C não veio do briefing.** Ele nasceu do **ancoramento**: a **ADR-0024** (aceita, criada na
> 2a) decide que o contexto de tenant vem da carga do próprio trabalho e **nunca é aceito de fonte
> externa**. Como quem clica no link de confirmação é anônimo, a pergunta *"quem mais pode receber
> documento sem sessão?"* passou a ter consequência de arquitetura — e portanto de produto.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — O corte da tradução do PDF

**Medição que abre o ramo** (feita em 2026-08-12 sobre `golden/contrato-pdf-fonte.py`, o 11º artefato
golden, extraído pela T1 da 2a): **759 linhas**, `if` 83 · `elif` 33 · `else` 11 · ternário 14 ·
laço 10 · `try` 10. Vocabulário das condições: **`fiador` 38 · `pj` 15 · `rg` 6**. São ~127 pontos de
ramificação em código em linha reta (`def` = 0), e os três eixos são **todos** vocabulário de
**qualificação de parte**.

**Direções candidatas:**

- **A1 — Por cláusula** (21 unidades + 4 citações): cada cláusula é unidade de tradução e de prova.
  - _Exemplo:_ a cláusula do prazo vira um bloco componível, provado contra a sua fatia do golden.
  - _Viabilidade:_ mapeia 1:1 no texto do golden, que é linear — mas os três eixos **atravessam** as
    cláusulas: a qualificação da parte aparece no preâmbulo e outra vez no fecho de assinaturas.
- **A2 — Por bloco do documento** (qualificação → cláusulas → encerramento): os eixos são resolvidos
  **uma vez**, na qualificação, e o resto compõe sobre o resultado.
  - _Exemplo:_ a "parte qualificada" nasce com PJ×PF e com/sem RG já resolvidos; as 21 cláusulas
    consomem texto pronto, sem reabrir a condição.
  - _Viabilidade:_ ataca a ramificação na origem — transforma ~127 pontos em poucas decisões mais
    composição linear. Reusa o padrão de derivação que a **ADR-0023** já governa.
- **A3 — Por eixo condicional** (com fiador × sem; PJ × PF): a unidade é a variante, não o texto.
  - _Exemplo:_ "contrato com fiador PF" é um caminho inteiro, provado ponta a ponta.
  - _Viabilidade:_ é como o golden de fato prova — mas multiplica a superfície: até 8 documentos a
    sustentar, e nenhum deles reaproveita a tradução do outro.

**Direção escolhida**: **A2, com A1 dentro dele** — o bloco é a unidade de decomposição, a cláusula é
a unidade de composição e de asserção. Decidido com o usuário: os três eixos são vocabulário de
qualificação, e resolvê-los uma vez é o que impede a ramificação de se espalhar pelas 21 cláusulas.
**Podadas / adiadas**: A1 puro (deixaria os eixos espalhados por várias cláusulas); **A3 migra para o
Ramo E** — não é decomposição, é estratégia de prova, e lá ele foi absorvido.

### Ramo B — O documento como derivação: o que morre junto com o arquivo

Três coisas do legado dependem de existir um arquivo armazenado: a coluna `pdf_contrato_arquivo`, o
carimbo "CANCELADO" por `merge_page` (medido na §3-B.2 do partilhado, em
`contrato_cancelamento/pdf_utils.py`), e a guarda do cancelamento — o **D36 (F2/T8)**.

**Direções candidatas:**

- **B1 — Derivação pura, coluna removida**: migração nova retira o campo do modelo.
  - _Exemplo:_ cancelar grava estado; pedir o PDF de um contrato cancelado **compõe** a marca na
    renderização, em vez de mesclar página sobre bytes guardados.
  - _Viabilidade:_ é o que a **ADR-0022** decide (*"o estado publicado é derivado dos fatos gravados,
    nunca uma coluna movida por rotina"*) — mas mexe na migração `0007_dominio_contrato.sql`,
    já escrita, e exige checar se ela já foi aplicada a banco durável (o terreno do **D20**).
- **B2 — Coluna mantida, escrita fechada**: permanece como registro do que o legado gravou.
  - _Exemplo:_ contratos vindos do Frappe preservam o caminho antigo; os criados aqui nascem nulos.
  - _Viabilidade:_ risco zero de migração — **mas o valor guardado é um caminho de arquivo do Frappe, e
    o Frappe é desinstalado na F7**. Não é registro histórico: é ponteiro pendurado com data marcada.
- **B3 — Some do contrato publicado, permanece no banco**: a exposição acaba, o armazenamento fica.
  - _Exemplo:_ o esquema de saída deixa de listar o campo; a coluna continua lá, sem leitor.
  - _Viabilidade:_ adia a decisão sem resolvê-la, e cria a pior combinação — coluna viva que ninguém
    lê e que nenhuma asserção protege.

**Direção escolhida**: **B1** — remover. O argumento do B2 se dissolve na F7: preservar caminho para
arquivo que será apagado é preservar uma mentira com prazo.
**Podadas**: B2 (ponteiro pendurado), B3 (coluna órfã sem leitor nem prova).

**Consequência acoplada, e ela não é opcional**: removida a guarda de PDF do cancelamento, **muda qual
mensagem sai** no cenário `contrato_sem_imovel` — a `[DÚVIDA] 3` herdada. O `PROCEDENCIA.md` registra
que **a ordem das guardas é dado, não detalhe**, e é por isso que os dois cenários foram capturados
separadamente. O veredito precisa estar **escrito antes da execução**, no método que fez a 2a fechar
com uma única divergência.

### Ramo C — Quem tem direito ao documento

**Direções candidatas:**

- **C1 — Só o operador com sessão**: o PDF é rota de domínio como qualquer outra.
  - _Exemplo:_ o operador abre a tela do contrato e baixa o documento; o locatário recebe o contrato
    por fora do sistema, como hoje.
  - _Viabilidade:_ reusa a autorização declarada por rota (**ADR-0011/0018**) inteira; a ADR de rota
    pública passa a governar **um** ato só — a confirmação.
- **C2 — Operador com sessão + locatário por portador de segredo**: o mesmo critério serve dois atos.
  - _Exemplo:_ o link do contrato viaja no mesmo e-mail que confirma o endereço.
  - _Viabilidade:_ torna a ADR geral — mas **dobra a superfície pública**, que é a parte mais arriscada
    da sub-fatia, e exige a mesma maquinaria de portador duas vezes.
- **C3 — O locatário nunca acessa rota; o documento vai anexado ao e-mail**.
  - _Exemplo:_ na ativação, o contrato sai anexado à mensagem.
  - _Viabilidade:_ evita rota pública — e acopla documento a entrega de e-mail, trazendo tamanho de
    anexo, retentativa e retenção para dentro de uma fatia que não os pediu.

**Direção escolhida**: **C1**, com a **ADR redigida larga o bastante para o C2 caber depois sem
emenda**. A **ADR-0024** pesa: contexto de tenant vem do que já está gravado e nunca de fonte externa
— um portador de segredo para o PDF exigiria repetir, para um ganho que ninguém pediu, a maquinaria
mais delicada da sub-fatia.
**Podadas / adiadas**: C2 **adiado** (entra sem mudar o critério, se a F6 pedir); C3 podado
(acoplamento indevido entre documento e canal).

### Ramo D — A confirmação de e-mail refeita

**Medição que abre o ramo** (§3-B.3 do partilhado, sobre `locatario_email_confirmacao/service.py`,
222 LOC): o token é **o ID do locatário concatenado ao timestamp**, gravado **em claro** num campo
chamado `email_token_hash`, comparado por **igualdade simples** — e o ID viaja no próprio link. **O
token é forjável.** Fechar isso é decisão do usuário, registrada na §11 do partilhado.

**Direções candidatas — quanto se fecha:**

- **D1 — Porte mínimo com o defeito fechado**: token aleatório com entropia declarada, hash no banco,
  comparação em tempo constante, expiração.
  - _Exemplo:_ o link expira em horas; o valor no banco não permite reconstruir o token.
  - _Viabilidade:_ resolve as três falhas medidas — mas deixa força bruta sobre token vivo sem
    mitigação, e o **D27 (F1/T6)** registra que o limitador **não tem eixo de origem confiável** antes
    da publicação atrás do servidor de borda, que é F7.
- **D2 — D1 mais uso único**: o token morre ao ser consumido, e o registro guarda **quando**.
  - _Exemplo:_ um link reenviado três vezes tem três tokens; confirmar por um invalida os anteriores.
  - _Viabilidade:_ é a mitigação que **não depende** de coisa que a F7 ainda vai entregar.
- **D3 — D2 mais histórico de tentativas**, no molde do `envio_de_cobranca` da 2a.
  - _Exemplo:_ cada tentativa de confirmação vira linha auditável, com desfecho.
  - _Viabilidade:_ dá auditoria — e cria o **terceiro** log sem política de retenção; os outros dois
    (`identidade.tentativa_login` e o log de envio) já estão empurrados para a F7.

**Direção escolhida**: **D2**.
**Podadas / adiadas**: D1 (deixa o único vetor de força bruta sem mitigação própria); D3 **adiado**
(entra junto com a política de retenção, na F7, se a auditoria for pedida).

**Direções candidatas — quem dispara:**

- **D-a — Só ação explícita do operador**: nada sai sem alguém mandar.
  - _Viabilidade:_ superfície menor — mas o endereço pode ficar anos sem verificação.
- **D-b — Só automático no evento de cadastro**: nasce ou muda o e-mail, sai a confirmação.
  - _Viabilidade:_ o double opt-in acontece sozinho — e o operador fica sem saída quando a mensagem se
    perde.
- **D-c — Automático no cadastro + reenvio manual**.
  - _Exemplo:_ o locatário troca de e-mail e a confirmação sai sozinha; não chegou, o operador reenvia.
  - _Viabilidade:_ **espelha a forma que a 2a já entregou** — automático por política mais disparo
    manual com concessão própria —, então o produto fala a mesma língua nos dois lugares.

**Direção escolhida**: **D-c**.
**Podadas**: D-a (verificação que depende de memória humana não acontece), D-b (operador sem saída).

### Ramo E — A prova

O golden `contrato-pdf.txt` tem **174 linhas** e é a saída de **um** contrato — ele exercita **um**
caminho pelos três eixos que o Ramo A mediu.

**Direções candidatas:**

- **E1 — Igualdade sobre texto normalizado** contra o golden existente; os demais caminhos entram como
  divergência declarada, sem oráculo.
  - _Exemplo:_ o PDF novo é extraído para texto, normalizado pela regra declarada, e comparado por
    igualdade com as 174 linhas.
  - _Viabilidade:_ é o que o escopo do partilhado já previa, e é barato — e **cego** exatamente onde o
    legado ainda poderia responder.
- **E2 — E1 mais captura de goldens novos no legado**, para os eixos que faltam, **enquanto o
  `/opt/frappe` está de pé**.
  - _Exemplo:_ um contrato com fiador e um com locatário PJ, extraídos pelo mesmo caminho autenticado
    que produziu o 11º artefato.
  - _Viabilidade:_ o `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh` já existe, a leitura é
    autenticada e não destrutiva, e **não exige `sudo`** — mas depende de **existirem contratos reais
    cobrindo cada eixo**, o que ninguém mediu ainda (`[DÚVIDA] A`).
- **E3 — Prova por composição**: cada bloco tem caso próprio, e o documento inteiro tem um só.
  - _Exemplo:_ a qualificação de parte PJ é provada isolada, sem montar o documento inteiro.
  - _Viabilidade:_ granularidade que casa com a decomposição escolhida no Ramo A — não amplia
    cobertura de oráculo, e por isso não substitui E1 nem E2.

**Direção escolhida**: **E2, com E3 dentro** — E1 é a base, E2 amplia o oráculo enquanto a janela
existe, E3 dá a granularidade que a decomposição A2 pede.
**Podadas**: nenhuma — as três se compõem. **A urgência é de E2**: a janela fecha na **F7 e não
reabre**, e essa foi literalmente a lição da T1 da 2a.

---

## 5. Problema

- **Qual é a dor real hoje?** Duas, e elas só parecem uma porque saem pelo mesmo lugar. **(1)** O
  contrato em PDF do sistema antigo é um **arquivo guardado**: gerado no `After Save`, anexado ao
  registro, e carimbado por mesclagem de página quando o contrato é cancelado. Isso faz o documento
  poder **divergir do dado** — o registro muda, o arquivo não. **(2)** A confirmação do endereço de
  e-mail do locatário existe, mas **o seu token é forjável**: não é aleatório, não é hash, e o
  identificador que ele deveria proteger viaja no próprio link.
- **Como o problema aparece no dia a dia?** Um contrato alterado depois de salvo continua exibindo o
  PDF antigo até alguém salvar de novo. Um contrato cancelado sem PDF **não pode ser cancelado** no
  legado — a pré-condição existe porque o carimbo precisa de bytes para carimbar. E qualquer pessoa
  que receba um link de confirmação conhece o ID do locatário e o instante do envio, que é quase todo
  o segredo.
- **Quem sente o impacto?** O **operador da imobiliária**, que não confia no documento que baixa; o
  **locatário**, cujo endereço é "confirmado" por um mecanismo que não confirma nada; e a **plataforma**,
  que carrega no modelo um campo apontando para arquivo que a F7 vai apagar.
- **Por que resolver agora?** Porque é a **última sub-fatia da F3**, e porque a janela de leitura do
  legado fecha na F7. O fonte do gerador já foi salvo pela 2a; o que falta capturar — os caminhos que o
  golden atual não cobre — só existe enquanto o `/opt/frappe` estiver de pé.

---

## 6. Objetivo Principal

- **Resultado esperado**: o contrato em PDF passa a ser **derivado do dado no instante do pedido**, com
  o estado de cancelamento aparecendo por **composição** e não por mesclagem sobre arquivo; e o endereço
  de e-mail do locatário passa a ser confirmado por um mecanismo que **não pode ser forjado**.
- **Mudança de comportamento/estado**: deixa de existir arquivo de contrato armazenado — e, com ele, a
  pré-condição *"sem PDF, não cancela"*, que fecha o **D36 (F2/T8) por construção**. O token de
  confirmação passa a ser aleatório, guardado como hash, de **uso único** e com expiração.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: o **operador da imobiliária** — pede o contrato em PDF, dispara e reenvia a
  confirmação, e é quem percebe imediatamente se o documento diverge do cadastro.
- **Persona secundária**: o **locatário** — é alcançado **fora do sistema**, por e-mail, e age **sem
  sessão e sem nunca ter uma**. É esta persona que faz a sub-fatia atravessar as duas fronteiras novas.
- **Persona terciária**: o **operador da plataforma** — lê o que ficou registrado quando algo não sai.
- **Contexto de uso**: o operador, autenticado, na tela de contrato; o locatário, num navegador
  qualquer, vindo de um link recebido por e-mail, numa página que **não existe neste repositório** —
  ela é React, é F6, e é implementada fora daqui.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Tradução do gerador de PDF por bloco do documento** (A2), com os três eixos — com fiador × sem,
      PJ × PF, com RG × sem — resolvidos **uma vez** na qualificação de parte, e as 21 cláusulas
      compondo sobre o resultado
- [ ] **PDF derivado sob demanda**, sem arquivo armazenado, com o **carimbo "CANCELADO" por composição**
      na renderização — **fecha o D36 (F2/T8) por construção**
- [ ] **Remoção da coluna `pdf_contrato_arquivo`** do modelo (B1), com a checagem prévia de aplicação da
      migração `0007` a banco durável
- [ ] **Veredito escrito, ANTES da execução**, sobre qual mensagem sai no cenário `contrato_sem_imovel`
      quando a guarda de PDF é removida — e a divergência declarada correspondente no golden
- [ ] **PDF acessível apenas ao operador com sessão** (C1), sob a autorização declarada por rota
- [ ] **Confirmação de e-mail portada com o defeito fechado** (D2): token aleatório com entropia
      declarada, **hash** no banco, comparação em tempo constante, **expiração** e **uso único**
- [ ] **Disparo automático no evento de cadastro do e-mail + reenvio manual pelo operador** (D-c)
- [ ] **Rota pública de negócio** para a confirmação, entrando na partição `publicas` — o
      `semDeclaracao` **continua vazio**
- [ ] **Resposta binária no contrato**, com a exceção declarada e provada como piso se o arcabouço não
      a suportar
- [ ] **Prova por igualdade sobre texto normalizado**, com a normalização **declarada, fechada e
      provada por falsificação**
- [ ] **Captura de goldens novos no legado** para os eixos que o golden atual não cobre (E2) —
      **task de PRAZO**, condicionada à existência de contratos reais que os exercitem
- [ ] **Prova por composição** bloco a bloco, mais um caso de documento inteiro (E3)
- [ ] **Registro explícito no artefato** de que o link de confirmação aponta para uma página que **não
      existe aqui** — entra no handoff da F6
- [ ] **Superfície medida por dupla medição independente**, no molde do CT-635: `[HIPÓTESE]` **3 rotas
      novas** sobre as **86** atuais

---

## 9. Fora do Escopo (podado / adiado)

Herdado da §9 do pré-refinamento partilhado, e vale integralmente:

- **O carnê** — _F4_: a fonte de cada página é o boleto emitido.
- **Emissão de boleto e baixa bancária** — _F4_.
- **O gatilho de tempo da régua** — _F5_.
- **A tela de saúde e o disparo de alerta** — _F5_.
- **Canal WhatsApp** — _recusa declarada na validação, não omissão_.
- **Retenção e expurgo de log** — _F7_, junto do `identidade.tentativa_login`.
- **Cache do PDF derivado** — _adiado_: entra depois, sem mudar o contrato, se a composição se mostrar
  cara sob carga.
- **Publicar o `@sysloc/contracts`** — item do marco de entrega, não desta sub-fatia.
- **SPF/DKIM no domínio** — operação (DNS), não critério de aceitação.
- **Qualquer linha de React, inclusive a página `validacao-email`** — `[fora do escopo do projeto]`,
  pela Fronteira do `CLAUDE.md`. **Task que peça frontend é gatilho de parada.**

Podado ou adiado **neste** brainstorm:

- **C2 — PDF ao locatário por portador de segredo** — _adiado_: dobra a superfície pública para um
  ganho que ninguém pediu; a ADR nasce larga o bastante para acomodá-lo sem emenda.
- **C3 — PDF anexado ao e-mail** — _podado_: acopla documento a canal de entrega.
- **D3 — histórico de tentativas de confirmação** — _adiado_: seria o terceiro log sem política de
  retenção; entra com a política, na F7.
- **B2/B3 — manter a coluna `pdf_contrato_arquivo`** — _podados_: o valor guardado é caminho para
  arquivo que a F7 apaga.
- **A3 — decomposição por eixo condicional** — _absorvido no Ramo E_ como estratégia de prova.
- **Tudo que a 2a já entregou** — régua, política de aviso por empresa, log de envio, predicado de
  elegibilidade e as 4 rotas de `/v1/automacao-de-cobranca` — não é trabalho aqui.

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend
  Node/NestJS/PostgreSQL **nativo, sem Docker**, que substitui o Frappe/ERPNext de `/opt/frappe`.
  **Só se faz backend aqui** — o React vive na máquina local do usuário. Português brasileiro em tudo;
  **Opus** em toda sessão e todo subagente; **Protocolo Antirregressão** como pré-condição de toda
  edição.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md`; `/docs/prds/` não existe neste
  repositório — só `docs/specs/features/`):
  - `regua-e-documentos/v1` — **pré-refinamento partilhado**: é a entrada dos dois runs, e este
    artefato o **especializa** sem sobrescrever. Escopo da 2b na §8; fatos medidos na §3-B; dúvidas na
    §13; recomendação de framework na §15.
  - `regua-de-cobranca/v1` — **sub-fatia irmã, concluída**: entregou a régua, a política por empresa e
    o log de envio. Dá o precedente de **automático + manual** que o Ramo D adotou, e o de
    **divergência declarada par a par** que o Ramo E adota.
  - `cobranca-e-mora/v1` — cobrança como fato financeiro com estado derivado; origem das ADRs 0022/0023.
  - `contratos-de-locacao/v1` — dona do agregado `Contrato` e do **D36**, que esta sub-fatia fecha.
  - `caracterizacao-regras-legadas/v1` — os goldens e o `PROCEDENCIA.md`.
  - `cobranca-mora-e-documentos/v1` — pré-refinamento da **fase**, que cortou a F3 em duas fatias.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: `packages/db` com RLS forçada, FK composta e contexto por `AsyncLocalStorage` +
    `SET LOCAL`. O agregado `Contrato` já existe (`packages/db/src/contrato.ts`), e a coluna
    `pdf_contrato_arquivo` está na migração `0007_dominio_contrato.sql`.
  - **Autenticação / autorização**: `@RotaPublica()` **já existe e já é usado**
    (`apps/api/src/autenticacao/rota-publica.decorator.ts`), e a guarda particiona a superfície em
    `comExigencia` / `publicas` / `semDeclaracao` — o mecanismo existe; o que falta é o **critério**.
  - **Envio de e-mail**: `nodemailer` **já instalado** em `packages/regua`, com porta de e-mail,
    adaptador de captura e barreira que falha fechado (entregues pela 2a).
  - **Renderização de PDF**: `[HIPÓTESE]` **capacidade nova** — nem `@react-pdf/renderer` nem `pdf-lib`
    aparecem em nenhum `package.json` do monorepo. A stack do `CLAUDE.md` os declara; a instalação não
    aconteceu.
  - **Monorepo hoje**: `packages/{auth,contracts,db,regua,shared}` e `apps/{api,worker}`.
  - **ADRs**: **26 registradas, 20 `accepted`**. Vinculantes aqui: **0011** e **0018** (autorização
    declarada por rota), **0016** e **0017** (esquema como fonte única do contrato; três classes de
    chave exposta), **0021** (transição de estado é rota própria), **0022** (o que se grava e o que se
    deriva num fato financeiro), **0023** (onde vive a derivação de valor não persistido), **0024**
    (origem do contexto de tenant sem requisição), **0008** (isolamento pelo banco).
- **Conflitos / sobreposições detectados**:
  - ⚠️ **O `CLAUDE.md` diz "21 registradas, 15 `accepted`"** — número **desatualizado**: a 2a registrou
    as ADRs **0022 a 0026**. O inventário real é **26 / 20**. Não é conflito de escopo, é índice
    vencido, e alguém precisa corrigi-lo fora deste artefato.
  - **Nenhuma feature existente duplica esta.** A 2a é irmã, não sobreposta: ela age, esta entrega.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` A composição do PDF sob demanda é **barata o bastante** para não exigir cache nesta
  versão — o cache está adiado explicitamente, e entra sem mudar o contrato se a carga mostrar o
  contrário.
- `[HIPÓTESE]` Os três eixos condicionais (fiador, natureza da pessoa, RG) **esgotam** a variação da
  qualificação de parte. A medição encontrou só esses três no vocabulário; um quarto eixo escondido
  mudaria o dimensionamento.
- `[HIPÓTESE]` A sub-fatia acrescenta **3 rotas** sobre as 86 atuais — PDF, disparo/reenvio da
  confirmação, e a confirmação pública. O disparo automático é evento interno, não rota.
- `[HIPÓTESE]` A renderização de PDF entra como **dependência nova** do monorepo.
- `[HIPÓTESE]` Existem, no legado, contratos reais que exercitam os eixos ainda sem golden. Se **não**
  existirem, o E2 é inexequível sem escrever em produção — e escrever em produção **não se faz**.

**Decisões já tomadas (fora de negociação)**:

- O corte **2a × 2b** e a ordem 2a → 2b estão fechados no pré-refinamento partilhado.
- **O defeito do token de confirmação se fecha no porte** — decisão do usuário, registrada na §11 do
  partilhado e reafirmada aqui na escolha do D2.
- **O carimbo "CANCELADO" vira composição na renderização**; o cancelamento apenas grava estado.
- **O carnê é F4**, não F3.
- **WhatsApp não é implementado** — `whatsapp`/`ambos` são **recusados** na validação.
- **Nenhuma linha de React**, inclusive a página `validacao-email`. Task que peça frontend é **gatilho
  de parada**.
- **Português brasileiro em tudo, e Opus em toda sessão e todo subagente.**
- **Protocolo Antirregressão** vale para toda edição: baseline antes e depois, três linhas por
  mudança, `DECISÃO FECHADA` intocável, nenhuma prova enfraquecida.
- **Baseline medida a respeitar**: suíte **1004** casos, medida **por pacote**; superfície **86 rotas /
  71 manipuladores** com `semDeclaracao` vazio.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o PDF derivado sai **diferente** do que o operador está acostumado
  a ver (espaçamento, quebra, ordem), e a diferença é lida como defeito.
  → _Mitigação_: a igualdade é sobre **texto normalizado** contra o golden, e a normalização é
  declarada e fechada; toda diferença remanescente vira **divergência declarada**, com veredito escrito
  antes da execução.
- **Risco de escopo (pode explodir?)**: **sim, e é o risco principal.** A tradução de 759 linhas com
  ~127 pontos de ramificação é o volume da sub-fatia, e a captura de goldens novos acrescenta uma task
  de prazo.
  → _Mitigação_: a decomposição A2 concentra a ramificação num bloco só; o gatilho de upgrade da §15.5
  está armado em **~12 tasks**, com o corte natural já nomeado (**PDF × confirmação de e-mail**, que
  não se tocam).
- **Risco técnico ou operacional**: remover a coluna `pdf_contrato_arquivo` toca a migração `0007`. Se
  ela **já foi aplicada a banco durável**, o arquivo é imutável e a remoção exige migração nova — é o
  mesmo terreno do **D20**, cujo gatilho fecha **em silêncio**.
  → _Mitigação_: verificar a aplicação **antes** de planejar a task, e tratar a resposta como
  pré-condição, não como detalhe de implementação.
- **Risco de privacidade / segurança / compliance**: a rota pública de confirmação é a **primeira rota
  de negócio sem sessão** deste produto, e ela nasce sem limitador de taxa — o **D27** registra que o
  limitador não tem eixo de origem confiável antes da F7.
  → _Mitigação_: **uso único + expiração** (D2) é a mitigação que não depende do eixo que falta; e a
  **ADR-0024** obriga o contexto de tenant a vir do que já está gravado, nunca do que chega na
  requisição.
- **Risco de janela**: a captura de goldens novos (E2) só é possível enquanto o `/opt/frappe` estiver de
  pé, e a F7 o desliga.
  → _Mitigação_: ela é **task de prazo**, e vai **primeiro** — o precedente é a T1 da 2a, e a lição de
  que **premissa que bloqueia trabalho com prazo merece ser medida antes de ser registrada**.

---

## 13. Dúvidas em Aberto

**Herdadas do pré-refinamento partilhado (§13) — estado atualizado:**

1. ✅ **`[DÚVIDA] 1` — RESOLVIDA por medição.** As 752 linhas são **759** com cabeçalho de procedência,
   com 83 `if` + 33 `elif` + 11 `else`, 14 ternários e 10 laços, concentrados em **três** eixos de
   qualificação. É isto que dimensiona a sub-fatia.
2. ✅ **`[DÚVIDA] 2` — RESOLVIDA.** O React **não lê** `pdfContratoArquivo` (o
   `levantamento-frontend.md` não o nomeia; o consumo é de **bytes por endpoint**). Decisão: **remover
   a coluna** (B1).
3. ⚠️ **`[DÚVIDA] 3` — PERMANECE, e virou exigência de escopo.** Removida a guarda de PDF, qual mensagem
   sai no cenário `contrato_sem_imovel`? Precisa de **veredito escrito antes da execução**.
4. ➖ **`[DÚVIDA] 4` — NÃO É DESTA SUB-FATIA.** A migração da configuração `Single` era pergunta da 2a,
   que fechou sem nenhuma task de migração de dados.
5. ➡️ **`[DÚVIDA] 5` — TRANSFERIDA ao tech-alignment.** Se o arcabouço de contrato suporta declarar
   resposta binária (`ts-rest` não instalado; `contentType` sem uso) decide entre publicar a resposta
   binária no contrato e o **piso da exceção declarada e provada**. É insumo da segunda ADR.
6. 🔽 **`[DÚVIDA] 6` — ESTREITADA.** `[HIPÓTESE]` **3 rotas** sobre **86** — o número entra no PRD e é
   fechado por **dupla medição independente** (molde do CT-635). ⚠️ O número da F2 era **75, não 77**.
7. ✅ **`[DÚVIDA] 7` — RESOLVIDA pela escolha do D2.** A mitigação desta sub-fatia é **uso único +
   expiração**; o limitador de taxa fica para quando a borda der eixo de origem (F7, **D27**).

**Novas, nascidas neste brainstorm:**

- **`[DÚVIDA] A`** — Existem no legado contratos reais que exercitem **cada** eixo (com fiador, locatário
  PJ, sem RG)? É o que decide se o **E2 é exequível** — e escrever em produção para fabricá-los **não
  é opção**.
- **`[DÚVIDA] B`** — A migração `0007_dominio_contrato.sql` **já foi aplicada a banco durável**? A
  resposta decide se a coluna sai por emenda ou por migração nova (terreno do **D20**).
- **`[DÚVIDA] C`** — O que exatamente a **normalização** do texto tolera (espaço, quebra de linha, ordem
  dentro de bloco)? Ela precisa ser declarada e **provada por falsificação** — normalização frouxa
  transforma a prova em carimbo.
- **`[DÚVIDA] D`** — Qual é o gatilho de disparo **hoje** no legado, nas 222 LOC de
  `locatario_email_confirmacao`? A escolha foi **automático + reenvio manual**; o que existe hoje
  precisa ser lido para que a divergência seja **declarada**, e não descoberta na execução.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: **A2 com A1 dentro** (tradução por bloco, cláusula como
  unidade de composição); **B1** (coluna removida, PDF derivado puro); **C1** (só operador com sessão,
  ADR redigida larga); **D2 + D-c** (token aleatório, hash, expiração e uso único; automático no
  cadastro mais reenvio manual); **E2 com E3 dentro** (captura de goldens novos enquanto a janela
  existe, mais prova por composição).
- **Descartado com justificativa**: **B2/B3** (o valor guardado é caminho para arquivo que a F7 apaga);
  **C3** (acopla documento a canal de entrega); **D-a** (verificação que depende de memória humana não
  acontece); **D-b** (operador sem saída quando o e-mail se perde); **A1 puro** (deixa os eixos
  espalhados por várias cláusulas).
- **Adiado para v2/v3**: **C2** (PDF ao locatário por portador de segredo — entra sem emendar a ADR);
  **D3** (histórico de tentativas — entra com a política de retenção, na F7); **cache do PDF derivado**.
- **Provocações que mudaram o rumo**:
  1. *"O que exatamente o campo guarda?"* — a resposta (**um caminho de arquivo do Frappe**) dissolveu
     sozinha a opção de mantê-lo por compatibilidade: a F7 apaga o alvo, e o que sobra é ponteiro
     pendurado.
  2. *"Quem mais pode receber documento sem sessão?"* — pergunta que não estava no briefing e que
     nasceu do ancoramento na **ADR-0024**. Ela criou o Ramo C e, com ele, a percepção de que o critério
     da ADR precisa ser **redigido largo mesmo entregando estreito**.
  3. *"O golden prova um caminho de três eixos"* — o que transformou a prova de item de rotina em
     **task de prazo**, e alinhou esta sub-fatia ao precedente que a 2a estabeleceu.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — os cinco ramos sobreviveram, com 13 itens de escopo | confirmado |
| Personas | **múltiplas** — operador da imobiliária, **locatário** (alcançado fora do sistema, sem sessão) e operador da plataforma | confirmado |
| Novidade | **incremento** sobre módulos existentes, com **duas fronteiras nunca atravessadas** (rota pública de negócio, resposta binária) e uma **capacidade nova** (renderização de PDF) | confirmado |
| Decisão arquitetural transversal nova? | **sim — duas**, ambas com consumidor externo já identificado (F4 devolve boleto em PDF; o handoff precisa do critério de rota pública) | confirmado |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — **confirmando** a recomendação da §15.2 do pré-refinamento partilhado, agora
medida contra o brainstorm da sub-fatia isolada.

**Justificativa**: duas dimensões decidem sozinhas. **Personas múltiplas** — o locatário age **sem
sessão e sem nunca ter uma**, e é ele que obriga as duas fronteiras novas. E **duas decisões
arquiteturais transversais**, que viram ADR e que a **F4 e o handoff vão consumir**. Some-se a
amplitude 4+ e o precedente medido: a sub-fatia irmã rodou SDD com 12 tasks e fechou nos dois gates,
sem nenhuma bloqueada.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o gatilho de downgrade que o partilhado deixou escrito
(§15.5) exigia **duas** condições — que a tradução colapsasse em poucas cláusulas **e** que as duas
ADRs fossem absorvidas ao abrir o `Decision` integral da 0016 e da 0017. **As duas falharam.** A
medição encontrou ~127 pontos de ramificação, não poucas cláusulas; e as ADRs abertas mostram que a
0016 e a 0017 governam **derivação do contrato a partir do esquema** e **classe de chave exposta** —
nenhuma delas diz o que se publica para uma resposta que **não é JSON**, nem sob que critério um ato de
negócio dispensa sessão. O miniSpec não comporta ADR, e sem ela a decisão ficaria escrita em código,
que é exatamente a **R3** que o Protocolo Antirregressão persegue.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por ordens de grandeza — ~980 LOC
portadas entre gerador e confirmação, três personas, duas ADRs, remoção de coluna em migração, primeira
rota pública de negócio, primeira resposta binária e uma task de prazo contra janela que fecha na F7.
TaskCard é para ajuste pontual sem decisão arquitetural; nenhuma metade dessa frase se aplica.

### 15.4 Próximo Passo

A ordem importa, e ela tem **duas** razões independentes: as ADRs são insumo do PRD (o critério de rota
pública decide o que a US da confirmação promete), e a **task de prazo** vive dentro do run, não antes
dele.

```bash
# 1) Agora — as duas decisões transversais, que a F4 e o handoff vão consumir
/agent-spec-adr-create "critério para uma rota de negócio dispensar sessão, e o que ela carrega em troca"
/agent-spec-adr-create "o que o contrato publica para uma rota que devolve bytes"

# 2) Depois das ADRs — a sub-fatia que fecha a F3
/agent-spec-sdd-generate-prd "contrato em PDF derivado sob demanda com carimbo de cancelamento por composição, e confirmação de e-mail do locatário com token aleatório de uso único"
```

> A feature é **`documentos-e-confirmacao`**, versão `v1`, variante `backend`. O pré-refinamento
> **partilhado** (`regua-e-documentos/v1/pre-refinement.md`) permanece intacto — ele é a entrada dos
> dois runs, e este artefato o especializa.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (partir de novo) se durante a geração emergirem:
  - a **2b passar de ~12 tasks** no `task_plan` — o corte natural já está nomeado: **PDF × confirmação
    de e-mail**, que não se tocam em nenhum ponto;
  - a `[DÚVIDA] A` revelar que os eixos exigem **captura extensa** no legado, transformando a prova em
    frente própria com janela de prazo;
  - a `[DÚVIDA] B` revelar que a remoção da coluna arrasta migração e **reescrita de leitura** em mais
    de um pacote.
- **Downgrade** se:
  - as duas ADRs forem resolvidas por ADR existente ao abrir o `Decision` integral — hoje improvável, e
    a §15.3 mostra por quê;
  - a tradução couber em ≤ 4 tasks porque a decomposição A2 colapsou a ramificação mais do que o
    esperado **e** a confirmação de e-mail sair para sub-fatia própria — aí o que resta vira miniSpec.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs/capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito, com as duas ADRs antes
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
