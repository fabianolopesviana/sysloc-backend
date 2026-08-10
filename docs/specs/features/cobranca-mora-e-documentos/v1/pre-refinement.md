# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário, ou medido contra o código/`/opt/frappe`).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `cobranca-mora-e-documentos` — F3 do `plano-execucao.md`
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f3-cobranca-mora-e-documentos.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-09
- **Versão**: v1
- **Status**: Refinado — pronto para próxima etapa
- **Relacionados**: `docs/specs/features/dominio-locacao/v1/pre-refinement.md` (precedente de método — fase partida em duas fatias) · `docs/specs/features/contratos-de-locacao/v1/` (o molde que esta fase repete) · `docs/specs/features/caracterizacao-regras-legadas/v1/golden/` (o oráculo) · `docs/specs/features/integracao-bancaria-configuravel/` (F4, que recebe o carnê)

---

## 2. Ideia Resumida (uma frase)

Trazer o dinheiro para o backend novo: a cobrança como entidade com estado de dono único no servidor,
a mora por empresa, a régua que aciona o inadimplente e o contrato em PDF — portando ~1.960 linhas de
Python legado, a maior delas **sem oráculo capturado e com a janela de captura fechando na F7**.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | O corte da fase — sete itens e ~1.960 LOC cabem num run? | explorar |
| B | O oráculo ausente da régua — a janela fecha na F7 | explorar (a fundo, por decisão do usuário) |
| C | A natureza da cobrança — estados, origens, o que grava e o que deriva | explorar |
| D | As três fronteiras — F3×F4 (boleto), F3×F5 (agendamento), F3×F2 (débitos) | explorar |
| E | A saída para o mundo — PDF, carnê, e-mail e a falha de envio | explorar |

Os cinco ramos cobrem as nove tensões da §4 do briefing sem sobreposição. O ramo **C** absorveu uma
tensão que o briefing não antecipou (as três origens distintas de uma cobrança, e a FK dupla
redundante), e o ramo **E** absorveu outra (o carnê não tem o que concatenar antes da F4).

---

## 3-B. Fatos medidos durante a Fase 2 — e uma correção ao briefing

> Esta seção existe porque três medições feitas durante o brainstorm **mudaram o desenho** de mais de
> um ramo. Elas são FATO, não hipótese: saíram da leitura do código, não de estimativa.

### 3-B.1 Correção ao briefing — o catálogo de autorização

O briefing (§2.1) afirma que *"`TELA:financeiro`, `TELA:recebiveis` e as ações de cobrança já existem
no catálogo fechado"*. Medido contra `packages/auth/src/catalogo-de-permissoes.ts`:

- **`TELA:recebiveis` NÃO existe.** As 10 áreas são `resumo`, `imoveis`, `contratos`, `cadastros`,
  `financeiro`, `automacao_de_cobranca`, `integracoes_bancarias`, `multa_e_juros`, `relatorios`,
  `usuarios`. Recebíveis é tela do frontend e cai sob `TELA:financeiro`.
- **Três das 7 ações tocam a F3**: `ACAO:emitir_boleto` e `ACAO:solicitar_baixa_de_boleto` (ambas em
  `TELA:financeiro`) e `ACAO:enviar_cobranca_manual` (em `TELA:automacao_de_cobranca`).
- **NÃO existe `ACAO:cancelar_cobranca`.** O catálogo é fechado pela **ADR-0011**; abrir exige
  supersedê-la. Ver a `[DÚVIDA] 1`, que é a única pendência bloqueante deste artefato.

### 3-B.2 A régua tem 837 LOC, e o efeito de e-mail está confinado a dois call sites

`/opt/frappe/app-sync/locacao_automation/locacao_automation/cobranca_automation/`:

| Módulo | LOC | Envia e-mail? |
|---|---|---|
| `helpers.py` | 103 | não |
| `core.py` | 184 | não |
| `runner.py` | 215 | não (chama o emailer) |
| `emailer.py` | 297 | **sim — `frappe.sendmail` nas linhas 203 e 251** |
| `service.py` | 25 | não |
| `scheduler.py` | 13 | não |

**502 LOC — a seleção das cobranças, a janela de horário, a trava de intervalo por último envio, a
derivação do status e a montagem do corpo da mensagem (`template_email`) — não enviam nada.** A frase
do `PROCEDENCIA.md` §4 (*"tem efeito colateral de envio de e-mail e ficou fora do escopo desta
captura"*) é verdadeira sobre `emailer.py` e larga demais sobre o restante da régua. É o que torna a
direção **B1** viável a custo baixo.

### 3-B.3 O servidor legado já discorda de si mesmo sobre o status da cobrança

Existem hoje **três** derivações do mesmo status, não duas:

1. `normalizeStatus`, no cliente React (`levantamento-frontend.md` §6);
2. `get_status_template(cobranca, hoje)`, em `core.py` — **tem o ramo `"Fechada"`**, que sai de
   `STATUS_FECHADA = ("paga","pago","cancelada","cancelado")`;
3. `get_status_template_manual(cobranca)`, em `emailer.py` — **não tem o ramo `"Fechada"`**, e testa o
   vencimento antes de qualquer status.

Consequência verificável no código: `enviar_email_manual` barra a cobrança **Paga** por
`is_cobranca_paga`, mas essa função **não reconhece `Cancelada`**. Logo, envio manual sobre uma
cobrança **cancelada e vencida** monta o template `"Vencida"` e dispara e-mail de cobrança. A régua
automática nunca faz isso, porque o `SELECT` do `runner.py` já exclui `["Paga","Cancelada"]`.

**Isto reposiciona o item 1 da §F3**: *"status com fonte única no servidor"* não é higiene de
arquitetura — fecha um defeito vivo que hoje cobra o cliente por uma dívida cancelada.

### 3-B.4 O carnê é a concatenação de N boletos, e o boleto é F4

`levantamento-frontend.md` linha 114 registra o carnê como montagem sobre
`abrir_boleto?cobranca={name}` — a fonte de cada página é o **boleto emitido**. Como a emissão é F4
inteira (mTLS, certificado por empresa, webhook), o carnê montado na F3 não teria o que concatenar.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — O corte da fase

**Direções candidatas:**

- **A1 — fase única**: os sete itens num run só.
  - _Exemplo:_ ~1.960 LOC (837 régua + 752 PDF + 222 e-mail de confirmação + 151 mora) portadas de
    uma vez, mais o agregado `Cobranca` novo.
  - _Viabilidade:_ **contra o precedente medido** — a F2 fez ~1.000 LOC em **2 fatias e 21 tasks**.
    Isto é o dobro numa fatia só.
- **A2 — por natureza do efeito**: o que só escreve no banco · o que sai para fora.
  - _Exemplo:_ `Cobranca` e mora de um lado; e-mail e PDF do outro.
  - _Viabilidade:_ reusa o molde inteiro da `contratos-de-locacao`.
- **A3 — por objeto**: `Cobranca` + mora (o dado e o cálculo) · régua + documentos (o que age).
  - _Exemplo:_ o mesmo conjunto do A2, chegando por outro critério.
  - _Viabilidade:_ idem.
- **A4 — por dependência de oráculo**: o que tem golden · o que não tem.
  - _Exemplo:_ de um lado `contrato-ativacao.json`, `calcular-mora.json`,
    `marcar-cobrancas-vencidas.json`, `atualizar-atrasos-cobrancas.json`; do outro só
    `contrato-pdf.txt`, e nada para a régua.
  - _Viabilidade:_ idem.

> **O achado do ramo A: os três critérios traçam a mesma linha.** A2, A3 e A4 são independentes entre
> si e convergem no mesmo ponto de corte. **Corte sobredeterminado é o sinal mais forte que um corte
> pode dar** — e nenhum dos três precisou ceder para caber nos outros dois.

**Direção escolhida**: **A2 ≡ A3 ≡ A4 — duas fatias no ponto onde os três critérios coincidem.**

- **Fatia 1 — `cobranca-e-mora`**: o agregado `Cobranca`, o `status` com fonte única no servidor, a
  mora por empresa, e o **D28** (a ativação do contrato gera as parcelas na mesma unidade de
  trabalho). Quatro goldens já capturados. **Zero efeito externo.**
- **Fatia 2 — `regua-e-documentos`**: a régua de cobrança (com a fila), o PDF de contrato, o
  `locatario_email_confirmacao`, e o **D36**. Um golden (`contrato-pdf.txt`) mais o que o ramo B
  capturar.

**Registrado desde já**: a fatia 2 **pode precisar partir de novo** (régua · documentos). A decisão
pertence ao briefing dela, no molde do que a F2 fez — não se antecipa aqui.

**Por que a fatia 1 entrega valor sozinha**: uma cobrança que existe, tem estado com dono único,
calcula mora corretamente e nasce da ativação do contrato é a base que as telas Financeiro,
Recebíveis e Dashboard consomem — as três leem `Cobranca` (`levantamento-frontend.md` linhas 98 e
103). Não é meia ponte; é a ponte inteira de um rio menor.

**Podadas / adiadas**: **A1** (podada — contra o precedente medido da F2, com o dobro do volume).

### Ramo B — O oráculo ausente da régua

**Direções candidatas:**

- **B1 — capturar a régua inteira, com o envio interceptado em vez de efetivado**.
  - _Exemplo:_ o site efêmero da ADR-0006 recebe cobranças sintéticas, a configuração e o
    `Log Envio Cobranca` semeados; o `runner.py` roda de verdade; grava-se **quem foi selecionado, com
    que template, que corpo de mensagem e que log**; a chamada de envio é registrada, não disparada.
  - _Viabilidade:_ o `deploy/scripts/caracterizacao/capturar.py` (**1.662 linhas**) já faz exatamente
    isso para 6 regras, contra dump restaurado em site efêmero. O ponto de intercepção é **um arquivo,
    dois call sites** (§3-B.2). Nada toca o site `frontend`, que é produção.
- **B2 — capturar só as frentes puras, por invocação** (o molde do `_calcular_mora`).
  - _Exemplo:_ tuplas de entrada/saída para `normalize_hhmm`, `is_hora_execucao`,
    `get_status_template`, `pode_enviar_por_intervalo`, `template_email`.
  - _Viabilidade:_ barata e sem risco algum, mas **deixa o `runner.py` sem oráculo** — e é ali que mora
    a orquestração que decide a quem cobrar.
- **B3 — portar por leitura**, com a consequência declarada.
  - _Viabilidade:_ é o que o `PROCEDENCIA.md` implicitamente propõe hoje. 837 LOC sem referência é a
    maior aposta da fase, e **a janela não reabre**.
- **B4 — recortar**: a régua sai da F3.
  - _Viabilidade:_ **piora o problema** — empurra a régua para a F5, que é ainda mais perto do
    desligamento do `/opt/frappe` na F7.

**Direção escolhida**: **B1, com B2 como piso garantido.**

O argumento que decide não é preferência: **o efeito que justificou pular a captura está confinado a
dois call sites, e capturar o restante não custa mais do que já custou capturar as 6 regras
existentes**. Se a intercepção se mostrar inviável na execução, cai-se para B2 sem perder a fase.

**Prazo — e ele importa mais que o método.** A régua é implementada na **fatia 2**, mas capturá-la na
T1 da fatia 2 é tarde demais em risco: entre hoje e lá existem duas fatias inteiras. A captura deve
acontecer **antes ou no início da fatia 1**. `[HIPÓTESE]` a forma mais barata é uma **task de captura
como T1 da fatia 1**, no molde exato da T1 da `contratos-de-locacao`, que existiu por uma razão que
expirava — e não uma intervenção fora do pipeline, porque a captura precisa dos gates.

**O que a captura precisa registrar, além do que já registra**: a **divergência das três derivações de
status** (§3-B.3) é ela própria comportamento do legado e deve entrar no golden — inclusive o caminho
em que o envio manual cobra uma cobrança cancelada. Sem isso, a fonte única do servidor "corrige" um
defeito sem prova de que ele existia.

**Podadas / adiadas**: **B3** (podada — a janela é irreversível e o custo de B1 é baixo); **B4**
(podada — agrava exatamente o risco que tenta evitar).

### Ramo C — A natureza da cobrança

#### C-I · O que a cobrança **grava** e o que ela **deriva**

O eixo é um só e vale para o `status` e para a mora. O discriminador que a F2 já usou na prática:
**deriva-se o que é função pura do dado guardado; grava-se a decisão tomada num instante** — metragem
deriva na leitura, `valorTotalContrato` grava na ativação.

- **C-a — tudo gravado**: `status` é coluna movida só por rota de transição; mora gravada quando
  incide.
  - _Exemplo:_ a rotina noturna escreve `Vencida`; a multa de ontem fica congelada mesmo se a
    configuração mudar hoje.
  - _Viabilidade:_ **se o timer da F5 falhar uma noite, o sistema mente por um dia** — e cria
    dependência da F5 para um estado que o calendário já determina sozinho.
- **C-b — fatos gravados, `status` e mora derivados**: guarda-se `pagoEm`, `canceladoEm`,
  `vencimento`, `valorOriginal`; deriva-se tudo o mais.
  - _Exemplo:_ à meia-noite a cobrança fica vencida sozinha, sem rotina nenhuma.
  - _Viabilidade:_ fonte única literal, mas **mudar a multa de 2% para 5% reescreve a mora de tudo,
    inclusive do que já foi quitado** — consequência contábil, não técnica.
- **C-c — misto com trava temporal no pagamento**: deriva-se enquanto a cobrança está aberta;
  **grava-se no instante do pagamento** (multa aplicada, juros aplicados, e a configuração vigente
  naquele instante).
  - _Exemplo:_ o locatário paga hoje com a multa de hoje; amanhã a imobiliária muda a multa e o recibo
    de ontem não se altera; a cobrança ainda aberta passa a exibir a multa nova.
  - _Viabilidade:_ reusa o `numeric(15,2)` e a multiplicação por centavos inteiros que a F2 já provou
    contra o resíduo binário. Custa colunas de carimbo e um teste de idempotência — que o
    `_calcular_mora()` puro e idempotente (golden com 6 casos e 7 tuplas) torna barato.

**Direção escolhida**: **C-c**. C-a mente quando o timer falha; C-b reescreve recibo já emitido. C-c é
a única que satisfaz *"fonte única no servidor"* **e** não altera dinheiro já quitado.

**Junto dela vai o zeramento dos 6 campos de conciliação bancária.** O *"acusar pagamento"* do legado
zera seis campos de conciliação (`levantamento-frontend.md` linha 112 — e o mapeador do cliente zera
nove). **Não se porta.** Não há golden para esse caminho, e não é preservação de defeito de
comportamento: é **destruição do rastro que a F4 vai precisar** para conciliar. Fica registrado como
**divergência declarada** em relação ao legado.

**Podadas / adiadas**: **C-a** (podada — mente na falha do timer); **C-b** (podada — reescreve o
passado contábil).

#### C-II · De onde nasce uma cobrança

Tensão não antecipada pelo briefing. O legado tem **FK dupla e redundante** — `Cobranca` aponta para
`contrato` **e** para `locatario` (`levantamento-frontend.md` linhas 436 e 443) — e a tela cria
cobrança por **três caminhos**: geração automática na ativação (o D28), parcela manual, e *"novo
título (água/condomínio/energia)"*. Há ainda um quarto: a **cobrança substituta** criada depois de um
cancelamento.

- **C-d — sempre filha de contrato**: o locatário deriva do contrato, e a FK dupla morre. Título
  avulso é cobrança do mesmo contrato com natureza diferente.
  - _Exemplo:_ a conta de água do imóvel X é uma cobrança do contrato vigente de X, com
    `natureza: 'AGUA'` — não um objeto solto ligado a uma pessoa.
  - _Viabilidade:_ **a FK composta `(id, empresa_id)` da F1 já impede a incoerência que a FK dupla
    permite hoje** — uma cobrança apontando para o locatário A enquanto seu contrato é do locatário B.
    Derivar é de graça, porque `contrato → locatario` já existe no schema da F2.
- **C-e — pode existir sem contrato**, ligada só ao locatário.
  - _Exemplo:_ cobrança avulsa a um ex-locatário depois do encerramento.
  - _Viabilidade:_ preserva a flexibilidade do legado **e o custo de duas fontes de verdade para o
    mesmo vínculo**.
- **C-f — duas entidades distintas** (cobrança de contrato · título avulso).
  - _Viabilidade:_ dobra a superfície de rotas e de esquema por um caso que o levantamento não mostra
    acontecendo separadamente.

**Direção escolhida**: **C-d — sempre filha de contrato.**

**Podadas / adiadas**: **C-e** (podada — reintroduz a incoerência que a FK composta existe para tornar
impossível); **C-f** (podada — custo de superfície sem caso de uso medido).

#### C-III · A ADR-0014 se aplica à cobrança?

`[HIPÓTESE]` **Não, e a razão é que não existe o ato "excluir cobrança" no produto.** A ADR-0014 rege
**exclusão lógica de entidade de cadastro**; a cobrança é **fato financeiro**, e o que o produto faz
com ela é **cancelar** — que é transição de estado, regida pela **ADR-0021**, num eixo diferente. Uma
cobrança não é apagada nem lógica nem fisicamente. Precisa de confirmação ao abrir o texto integral
das duas ADRs no PRD (`Citar ADR exige abrir a Decision`).

#### C-IV · Os estados e quais transições são atos sensíveis

Estados brutos do legado: `Pendente`, `Vencida`, `Paga`, `Cancelada`. Derivado na UI: `A vencer`,
`Vencida`, `Paga`, `Cancelada` — mais o booleano `pagamento_confirmado`, redundante com `Paga`.

`[HIPÓTESE]` sob C-c, a forma publicada é: **fatos gravados** (`vencimento`, `pagoEm`, `canceladoEm`,
`valorOriginal`, os carimbos de mora) e **`status` derivado e publicado** pelo esquema
(`@sysloc/contracts`), à maneira do `contratoVigente` que a T10 da F2 acrescentou — **crescimento de
esquema, nunca troca de igualdade por asserção de presença**.

Pela **ADR-0021**, cada transição é rota própria, e a chave de ação só entra quando o ato é sensível:

| Transição | Ator | `[HIPÓTESE]` exigência |
|---|---|---|
| `Vencida` | **nenhum** — é o calendário | não é rota; é derivação |
| acusar pagamento | humano | rota própria · `TELA:financeiro` |
| cancelar | humano | rota própria · `TELA:financeiro` — ver `[DÚVIDA] 1` |

### Ramo D — As três fronteiras

**Direções candidatas e escolha, por fronteira:**

- **F3×F4 (o boleto que ainda não existe)**
  - **D1 — molde `cobrancasGeradas: false`**: os campos de conciliação nascem no modelo, nulos, e a
    **rota de emissão não existe na F3**. — **escolhida**
  - **D2 — a rota existe e sempre recusa**: publica superfície que a F4 reescreve, e o cliente ganha um
    caminho que nunca funciona. — _podada_
  - **D3 — nem campo nem rota**: obrigaria a F4 a migrar o schema de uma tabela já povoada. — _podada_
  - _Precedente:_ o literal `efeitos: { cobrancasGeradas: false }` da F2 obriga quem for gerar cobrança
    a **tocar o contrato publicado**, em vez de mudar o significado da resposta por omissão.
- **F3×F5 (a régua roda quando)**
  - **D4 — a régua é enfileirada já na F3; a F5 acrescenta só o gatilho de tempo.** — **escolhida**
  - **D5 — a régua roda síncrona por rota na F3; a F5 leva tudo para a fila junto com o timer.** —
    _podada_
  - _Razão da escolha:_ **a fila é a forma do trabalho, não o agendamento dele.** N cobranças e N
    e-mails não rodam dentro de um request HTTP para depois "virar fila" — isso seria reescrever a
    régua na F5. Corte limpo: **a F3 é dona do trabalho e de como ele entra na fila; a F5 é dona do
    quando.**
  - _Consequência:_ **o D32 (F0/T6) fecha aqui** — a régua é a primeira fatia que enfileira tarefa de
    negócio, e é a fatia 2 quem remove o marcador de `apps/worker/src/fila.ts`.
- **F3×F2 (os débitos herdados)**
  - **D28 (F2/T7)** — fecha na **fatia 1**: a ativação passa a gerar as parcelas **na mesma unidade de
    trabalho**, o literal `z.literal(false)` é afrouxado, e o marcador sai no mesmo commit. O golden
    `contrato-ativacao.json` já tem os três cenários, incluindo a saturação do dia de vencimento em 28
    e o texto da referência.
  - **D36 (F2/T8)** — fecha na **fatia 2**, e é o mais delicado. No legado, *"sem PDF não cancela"*
    existe porque o carimbo "CANCELADO" é aplicado **sobre o PDF armazenado**. No sistema novo o PDF é
    **gerado sob demanda a partir do dado**, e a premissa da guarda dissolve — o carimbo vira
    **efeito**, não pré-condição. — **escolhida**
    - _Consequência aceita:_ o golden `contrato_sem_pdf` passa a ser **divergência declarada**, não um
      caso que aprova. A precedência das guardas que o `PROCEDENCIA.md` §4 registra como dado
      permanece registrada; o que muda é a guarda de PDF deixar de existir.
    - _Alternativa podada:_ portar a guarda como pré-condição — preservaria o golden ao custo de
      recriar no sistema novo uma dependência que só fazia sentido quando o PDF era o artefato
      armazenado.

### Ramo E — A saída para o mundo

#### E-I · O critério de pronto do PDF de contrato

- **E1 — igualdade literal do texto extraído.**
  - _Exemplo:_ uma quebra de linha diferente do `@react-pdf/renderer` reprova a task.
  - _Viabilidade:_ **reprova por motivo que não é comportamento** — a biblioteca mudou de propósito.
- **E2 — igualdade sobre texto normalizado, com a normalização declarada e fechada.**
  - _Exemplo:_ colapsar espaços repetidos, normalizar quebras de linha, e a máscara
    `<DATA_GERACAO_EXTENSO>` que o golden já usa. A normalização é código versionado e testado por
    **prova de falsificação** — muda-se uma palavra do contrato e o teste tem de reprovar.
  - _Viabilidade:_ o `PROCEDENCIA.md` §2 já estabeleceu o precedente da máscara pelo mesmo motivo
    ("acusaria diferença onde não há diferença de comportamento").
- **E3 — asserção por campo/conteúdo.**
  - _Viabilidade:_ **é regressão de prova (R2)** — troca igualdade por presença, exatamente o que a
    `.claude/rules/nao-regressao.md` §4.2 proíbe.

**Direção escolhida**: **E2.** E1 é frágil pelo motivo errado; E3 é proibido pelo protocolo.

#### E-II · O carnê

- **E4 — o carnê vai para a F4.** — **escolhida**
  - _Exemplo:_ a F3 entrega o PDF de contrato; a montagem do carnê nasce na F4, junto do boleto que é a
    fonte de cada uma de suas páginas.
  - _Viabilidade:_ §3-B.4 — **o carnê é a concatenação de N boletos, e o boleto é F4 inteira.** Montar
    o continente sem o conteúdo não é entregável nem testável, e a ausência de golden deixa de ser um
    problema a resolver aqui.
- **E5 — carnê na F3 com fonte substituível** (página por cobrança com dados da parcela, trocada pelo
  boleto real na F4).
  - _Viabilidade:_ cumpre literalmente o item 5 da §F3 ("sai do browser"), mas entrega um documento que
    **ninguém pediu e que a F4 descarta** — e o critério de pronto seria a estrutura de um artefato
    provisório.
- **E6 — carnê na F3 sem critério objetivo de pronto** (aceitação visual).
  - _Viabilidade:_ **incompatível com a `testing-stack.md`** — prova por snapshot aceito sem leitura é
    o que a `nao-regressao.md` §4.4 nomeia como prova mais frouxa.

> ⚠️ **Isto é desvio declarado do `plano-execucao.md` §F3, item 5.** O plano coloca o carnê na F3. A
> razão do desvio é factual e não estava disponível quando o plano foi escrito: a fonte de cada página
> do carnê é o boleto emitido, e a emissão é F4. **Registrar no PRD e propagar ao `roadmap.md`.**

**Podadas / adiadas**: **E1**, **E3**, **E5** e **E6**.

#### E-III · O e-mail que não sai (decisões 10 e 34)

- **E7 — a falha de envio é fato próprio, com log e retentativa; o estado da cobrança não muda.** —
  **escolhida**
  - _Exemplo:_ a cobrança segue `Vencida` (que é do **dinheiro**); o `Log Envio Cobranca` registra
    tentativa, status, erro e `request_id`; a retentativa respeita a trava de intervalo do
    `pode_enviar_por_intervalo`.
  - _Viabilidade:_ **o legado já modela assim** — `Log Envio Cobranca` é DocType próprio
    (`levantamento-frontend.md` linha 107), e a régua já grava sucesso e erro nele.
- **E8 — a cobrança entra em estado "pendente de envio".**
  - _Viabilidade:_ acopla o estado do dinheiro ao estado de um canal de comunicação. Uma cobrança cujo
    e-mail falhou continua devida.

**O alerta da decisão 34** (avisar quando as cobranças não estiverem saindo por limite do provedor):
`[HIPÓTESE]` **a F3 grava o fato, a F5 exibe e alerta.** A F3 é dona do log de envio com a causa
discriminada; a tela de saúde e o disparo do alerta pertencem à fase das automações agendadas.

**SPF/DKIM** (implicado pela decisão 10): `[HIPÓTESE]` **item de operação, não critério de aceitação
desta fase.** É configuração de DNS, não código; e o critério de aceitação declarado — *"o e-mail sai
com o remetente e o `reply_to` da empresa certa"* — é verificável sem tocar em DNS.

---

## 5. Problema

- **Qual é a dor real hoje?** O backend novo tem o domínio de locação inteiro e **nada nele cobra**. A
  operação financeira da imobiliária continua inteiramente no `/opt/frappe`, que precisa ser desligado
  na F7 — e o dinheiro é a última grande peça entre hoje e o marco de entrega.
- **Como o problema aparece no dia a dia?** Três sintomas medidos:
  1. **O status da cobrança não tem dono.** É derivado no cliente por `normalizeStatus`, e o servidor
     legado tem **outras duas** derivações que discordam entre si (§3-B.3) — a ponto de o envio manual
     poder cobrar por uma dívida **cancelada**.
  2. **A mora é global.** `Atraso` é Single no Frappe: uma multa para todas as empresas do SaaS, o que
     é incompatível com multi-empresa.
  3. **O carnê é montado no browser**, que baixa N boletos um a um.
- **Quem sente o impacto?** O **locatário** (recebe cobrança errada ou indevida), o **operador da
  imobiliária** (não confia no status que a tela mostra), a **imobiliária** (não consegue política de
  mora própria) e o **projeto** (a janela de captura do oráculo fecha na F7).
- **Por que resolver agora?** Duas razões com prazo. A **janela de captura** do `/opt/frappe` fecha na
  F7 e não reabre; e **F4 e F5 dependem desta fase** — não há boleto sem cobrança, nem automação
  agendada sem régua.

---

## 6. Objetivo Principal

- **Resultado esperado**: a cobrança existe no backend novo como fato financeiro tenantizado, com
  estado de **dono único no servidor**, mora calculada por empresa e travada no instante do pagamento,
  nascendo da ativação do contrato — e, na segunda fatia, a régua que aciona o inadimplente e o
  contrato em PDF equivalente ao legado.
- **Mudança de comportamento/estado**: duas telas nunca mais discordam sobre o status de uma cobrança,
  porque só existe uma derivação e ela é do servidor. Cada imobiliária define a própria multa e juros
  sem afetar as demais nem o que já foi quitado. Nenhuma cobrança cancelada é cobrada por e-mail.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **operador da imobiliária** (perfil com `TELA:financeiro`) — cria, cancela e
  acusa pagamento de cobranças, e lê o Financeiro/Recebíveis.
- **Persona secundária**: **administrador da empresa** — define multa e juros (`TELA:multa_e_juros`) e
  configura a régua (`TELA:automacao_de_cobranca`).
- **Persona terciária (não usa o sistema, mas recebe o efeito)**: **o locatário** — destinatário do
  e-mail da régua e do e-mail de confirmação, e quem paga a mora calculada aqui.
- **Contexto de uso**: web, no escritório da imobiliária, durante o expediente; o efeito sobre o
  locatário chega por **e-mail**, fora do sistema, e em horário definido pela configuração da régua.

---

## 8. Escopo Inicial (resultado da convergência)

**Fatia 1 — `cobranca-e-mora`** (o dado e o cálculo; zero efeito externo):

- [ ] Capturar o oráculo da régua contra o `/opt/frappe`, com o envio interceptado — **T1, por prazo**
      (ramo B1), incluindo a divergência das três derivações de status
- [ ] Agregado `Cobranca` tenantizado, **sempre filho de contrato**, sem FK dupla (C-d)
- [ ] `status` com **fonte única no servidor**, derivado dos fatos gravados e publicado pelo esquema
      (C-c, C-IV)
- [ ] Mora **por empresa**, derivada enquanto aberta e **travada no instante do pagamento** (C-c)
- [ ] O terceiro `Custom Field` de negócio, que pertence à `Cobranca` — a confirmar (`[DÚVIDA] 3`)
- [ ] Transições por rota própria pela ADR-0021: acusar pagamento e cancelar
- [ ] **Não portar** o zeramento dos 6 campos de conciliação bancária — divergência declarada
- [ ] **D28** fechado: a ativação gera as parcelas na mesma unidade de trabalho; marcador removido
- [ ] `whatsapp`/`ambos` **recusados na validação Zod**; os campos permanecem no modelo

**Fatia 2 — `regua-e-documentos`** (o que age e o que sai):

- [ ] Régua de cobrança portada (core, emailer, runner), **enfileirada** — **D32 fechado**
- [ ] Falha de envio como **fato próprio** com log e retentativa; o estado da cobrança não muda (E7)
- [ ] PDF de contrato em `@react-pdf/renderer`, provado por **igualdade sobre texto normalizado** (E2)
- [ ] `locatario_email_confirmacao` portado
- [ ] **D36** fechado: o carimbo "CANCELADO" é **efeito**, não pré-condição

---

## 9. Fora do Escopo (podado / adiado)

- **O carnê** — _movido para a **F4**_: é a concatenação de N boletos, e o boleto é F4 inteira (§3-B.4,
  E4). ⚠️ **Desvio declarado do `plano-execucao.md` §F3 item 5** — propagar ao `roadmap.md`.
- **Emissão de boleto e baixa bancária** — _F4_: mTLS, certificado por empresa e webhook. Na F3 os
  campos de conciliação nascem nulos e **a rota de emissão não existe** (D1).
- **O gatilho de tempo da régua** — _F5_: a F3 entrega o trabalho e a fila; a F5 entrega o quando (D4).
- **A tela de saúde e o disparo do alerta da decisão 34** — _F5_: a F3 grava o fato no log.
- **Canal WhatsApp** — _recusa declarada, não omissão_: os campos ficam no modelo porque o frontend os
  lê, e os valores são recusados na validação.
- **Qualquer linha de React** — `[fora do escopo do projeto]`: a Fronteira do `CLAUDE.md`. Inclusive a
  tela que baixa o carnê.
- **Publicar o `@sysloc/contracts`** — item do marco de entrega, não desta fase.
- **SPF/DKIM no domínio** — item de operação (DNS), não critério de aceitação desta fase.
- **Fase única (A1)** — podada contra o precedente medido da F2.
- **Cobrança sem contrato (C-e) e título avulso como entidade própria (C-f)** — podados: reintroduzem
  incoerência que a FK composta torna impossível, ou custam superfície sem caso de uso medido.
- **Igualdade literal (E1) e asserção por campo (E3) no PDF** — podados: a primeira reprova por motivo
  que não é comportamento; a segunda é regressão de prova (R2).

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis, backend
  Node/NestJS/PostgreSQL nativo, substituindo integralmente o Frappe/ERPNext de `/opt/frappe`.
  **Backend apenas** — nenhuma linha de frontend.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md`; `/docs/prds/` contém apenas
  `features/`):
  - `dominio-locacao/v1/pre-refinement.md` — **precedente direto de método**: fase partida em duas
    fatias decidida no pré-refinamento, SDD por fatia, ADRs antes do PRD. Nada a ver com o conteúdo.
  - `contratos-de-locacao/v1/` — **o molde que a F3 repete** (schema com RLS e FK composta, porta de
    dados em `packages/db`, serviço em `apps/api`, contrato em `@sysloc/contracts`, teste contra
    fronteira real) e a origem dos débitos **D28** e **D36**, que esta fase fecha.
  - `cadastro-de-imoveis-e-pessoas/v1/` — origem do **D3**; estabeleceu o padrão de esquema derivado.
  - `caracterizacao-regras-legadas/v1/golden/` — **o oráculo**: `calcular-mora.json`,
    `contrato-ativacao.json`, `contrato-pdf.txt`, `marcar-cobrancas-vencidas.json`,
    `atualizar-atrasos-cobrancas.json`, e o `PROCEDENCIA.md` que declara a régua **não capturada**.
  - `integracao-bancaria-configuravel/` — **F4, que passa a receber o carnê**. Conferir ao abrir a F4.
  - `fundacao-multitenancy-identidade/v1/` e `autorizacao-e-ciclo-de-acesso/v1/` — a fundação que esta
    fase consome sem reabrir.
  - **Nenhuma spec existente cobre cobrança, mora ou documentos.** Sem duplicação.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: `packages/db` — Drizzle sobre PostgreSQL 18, `empresa_id` com RLS forçada e FK
    composta `(id, empresa_id)` em toda tabela de negócio; contexto por `AsyncLocalStorage` +
    `SET LOCAL`.
  - **Autenticação / autorização**: `packages/auth` — catálogo **fechado** de 10 telas × 7 ações
    (`catalogo-de-permissoes.ts`), guarda de cobertura sobre as 75 rotas publicadas, `semDeclaracao`
    vazio.
  - **Contrato da API**: `@sysloc/contracts` — fonte única; 42 rotas do domínio já derivam esquema
    dele.
  - **Fila**: `apps/worker/src/fila.ts` — BullMQ + Redis com AOF, pronta e **sem tarefa de negócio até
    hoje** (é o D32).
  - **Série declarada**: o mecanismo `CTR-{ano}-{5 dígitos}` da F2 (duas funções `SECURITY DEFINER`,
    contador por `(empresa, ano)`), reaproveitável para o código legível da cobrança pela **ADR-0017**.
  - **Captura de golden**: `deploy/scripts/caracterizacao/capturar.py` (1.662 linhas) e
    `verificar-golden.sh`.
  - **Dinheiro**: `numeric(15,2)` e a multiplicação por centavos inteiros que a F2 provou contra o
    resíduo binário.
- **Conflitos / sobreposições detectados**: **dois**, ambos registrados acima —
  (1) o briefing afirma existir `TELA:recebiveis` no catálogo, e **ela não existe** (§3-B.1);
  (2) o `plano-execucao.md` §F3 item 5 coloca o carnê nesta fase, e a convergência o **move para a
  F4** (§3-B.4, E4).

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` A intercepção do envio de e-mail no site efêmero é viável sem alterar o app legado de
  forma persistente — o efeito está em dois call sites de um módulo (§3-B.2). Se falhar, cai-se para
  B2.
- `[HIPÓTESE]` A captura da régua cabe numa task (T1 da fatia 1), no molde da T1 da
  `contratos-de-locacao`.
- `[HIPÓTESE]` A ADR-0014 **não** se aplica à cobrança, porque não existe o ato "excluir cobrança" — o
  que existe é cancelar, regido pela ADR-0021. Confirmar abrindo o texto integral das duas.
- `[HIPÓTESE]` A cobrança tem **série declarada** e portanto código legível pela ADR-0017, reusando o
  mecanismo de contador da ADR-0020 (o legado usa `COB-*`).
- `[HIPÓTESE]` O alerta da decisão 34 se parte: a F3 grava o fato no log de envio, a F5 exibe e alerta.
- `[HIPÓTESE]` SPF/DKIM é item de operação, não critério de aceitação desta fase.
- `[HIPÓTESE]` A fatia 2 pode precisar partir de novo (régua · documentos) — decisão do briefing dela.

**Decisões já tomadas (fora de negociação)** — restrições travadas pelo usuário:

- A fase se parte em **duas fatias**, no corte onde os três critérios (efeito, objeto, oráculo)
  coincidem: fatia 1 = `Cobranca` + status com fonte única + mora + D28; fatia 2 = régua + PDF +
  e-mail de confirmação + D36.
- A régua será **capturada por inteiro contra o `/opt/frappe`, com o envio interceptado em vez de
  disparado** (B1), tendo B2 como piso garantido caso a intercepção se mostre inviável.
- A cobrança **deriva enquanto aberta e grava no instante do pagamento** (C-c): multa, juros e a
  configuração vigente ficam travados no pagamento e não são reescritos por mudança posterior de
  configuração.
- A cobrança é **sempre filha de um contrato**; o locatário deriva do contrato e a FK dupla do legado
  não é portada.
- Os campos de conciliação bancária nascem no modelo, **nulos**, e a **rota de emissão de boleto não
  existe na F3** — molde do `cobrancasGeradas: false`.
- A régua é **enfileirada já na F3**; a F5 acrescenta apenas o gatilho de tempo. **O D32 fecha nesta
  fase.**
- O carimbo "CANCELADO" no PDF é **efeito** do cancelamento, não pré-condição — e o golden
  `contrato_sem_pdf` passa a ser divergência declarada.
- **O carnê sai da F3 e vai para a F4**, porque a fonte de cada página é o boleto, que é F4.
- O PDF de contrato é provado por **igualdade sobre texto normalizado**, com a normalização declarada,
  fechada e testada por prova de falsificação.
- Português brasileiro em tudo; **só Opus**, na sessão principal e em todo subagente.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: mudar a configuração de multa passa a alterar a mora exibida de
  todas as cobranças **em aberto** — comportamento novo, que o operador pode ler como erro.
  → _mitigação_: o carimbo da configuração vigente no pagamento torna o efeito **auditável** (dá para
  responder "por que este recibo tem 2% e aquele 5%"); documentar no handoff.
- **Risco de escopo**: a fatia 2 concentra ~1.800 LOC e é maior do que a F2 inteira.
  → _mitigação_: já registrado que ela **pode partir de novo**; a decisão pertence ao briefing dela, e
  o gatilho de upgrade está na §15.5.
- **Risco de oráculo — o maior da fase**: se a intercepção do envio falhar, 837 LOC são portadas com
  cobertura parcial, e **a janela não reabre**.
  → _mitigação_: B2 é piso garantido (as frentes puras são capturáveis sem risco algum); e a captura é
  **T1 da fatia 1**, não da fatia 2, para que a falha seja descoberta com duas fatias de folga.
- **Risco técnico**: dinheiro em escala maior que a F2 — mora, juros e totais. O resíduo binário do
  produto ingênuo já foi medido pela F2 (`500.03 × 13 = 6500.389999999999`).
  → _mitigação_: reusar a multiplicação por centavos inteiros já provada; o `_calcular_mora()` é puro e
  idempotente, com golden de 6 casos e 7 tuplas.
- **Risco de autorização**: se a decisão da `[DÚVIDA] 1` for criar `ACAO:cancelar_cobranca`, a fase
  **precisa superseder a ADR-0011** — foi o que o D43 custou à F2.
  → _mitigação_: decidir **antes** do PRD; a recomendação registrada é **não abrir o catálogo**.
- **Risco de segurança / privacidade**: a captura roda contra dump restaurado, com **dado real de
  locatários** (nomes, e-mails). A régua envia e-mail.
  → _mitigação_: a ADR-0006 já exige site efêmero destruído ao fim; o envio é **interceptado, nunca
  disparado**; nenhum byte de e-mail real sai. Nenhum golden versiona endereço de e-mail sem máscara —
  **confirmar na captura**.
- **Risco de regressão (R3)**: a fase toca `contrato.service.ts`, que tem marcadores e literais
  fixados. Afrouxar `z.literal(false)` é edição de código sob débito com gatilho.
  → _mitigação_: o Protocolo Antirregressão é pré-condição; o marcador do D28 sai **no mesmo commit**
  da correção, e as três linhas do P3 são obrigatórias.

---

## 13. Dúvidas em Aberto

1. **`[DÚVIDA]` Cancelar uma cobrança é ato sensível para efeito da ADR-0021?** Não existe
   `ACAO:cancelar_cobranca` no catálogo fechado da ADR-0011, e criar a chave exige supersedê-la.
   **Recomendação registrada: não abrir o catálogo** — o cancelamento de cobrança tem substituta
   prevista (o legado cria uma cobrança nova logo em seguida), o que o torna reversível, e o critério
   da ADR-0021 pede chave de ação só quando o ato é sensível. `TELA:financeiro` bastaria. **É a única
   pendência bloqueante: precisa ser decidida antes do PRD, porque muda o custo da fase.**
2. **`[DÚVIDA]` A captura da régua é T1 da fatia 1 ou intervenção dirigida antes do run?** A T1
   ganha os gates; a intervenção é mais rápida. O precedente da `contratos-de-locacao` é a T1.
3. **`[DÚVIDA]` Qual é o terceiro `Custom Field` de negócio da `Cobranca`?** A F2 portou os dois de
   `Contrato` (`gerarCobrancasAutomaticamente` e o outro). O terceiro é desta fase e ainda não foi
   nomeado — verificação barata contra o `/opt/frappe`.
4. **`[DÚVIDA]` Quantas rotas a F3 acrescenta às 75 atuais?** A superfície congela depois da F5, e cada
   fase precisa saber o que publicou. Estimável só no tech spec, mas o **número** entra no PRD.
5. **`[DÚVIDA]` A natureza da cobrança (aluguel · água · condomínio · energia) é enum fechado ou texto
   livre?** O legado trata como "novo título" sem lista aparente. Decide se cabe no esquema derivado.
6. **`[DÚVIDA]` O `pagamento_confirmado` booleano sobrevive?** É redundante com `Paga` no legado, e a
   régua filtra pelos dois (`pagamento_confirmado: 0` **e** `status_cobranca not in [...]`). Sob C-c,
   `pagoEm` já responde — mas a captura precisa registrar o comportamento antes de eliminá-lo.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: **A2≡A3≡A4** (duas fatias no corte sobredeterminado) ·
  **B1** com **B2** como piso (capturar a régua com envio interceptado, na T1 da fatia 1) · **C-c**
  (derivar enquanto aberta, gravar no pagamento) · **C-d** (cobrança sempre filha de contrato) ·
  **D1** (campos nulos, sem rota de emissão) · **D4** (a régua enfileira na F3; D32 fecha aqui) ·
  **D28** na fatia 1 e **D36** na fatia 2 (carimbo como efeito) · **E2** (igualdade sobre texto
  normalizado) · **E4** (carnê para a F4) · **E7** (falha de envio é fato próprio).
- **Descartado com justificativa**: **A1** (fase única — contra o precedente medido da F2) · **B3** e
  **B4** (a janela do oráculo é irreversível e o custo de B1 é baixo) · **C-a** (mente quando o timer
  falha) · **C-b** (reescreve recibo já emitido) · **C-e** e **C-f** (reintroduzem incoerência, ou
  custam superfície sem caso medido) · **D2** e **D3** (rota que nunca funciona; migração de tabela
  povoada) · **D5** (a fila é a forma do trabalho, não o agendamento) · **E1**, **E3**, **E5**, **E6**
  (frágil pelo motivo errado; regressão de prova; artefato provisório; prova mais frouxa) · **E8**
  (acopla o estado do dinheiro ao canal de comunicação) · o **zeramento dos 6 campos de conciliação**
  (destrói rastro que a F4 precisa, e não tem golden).
- **Adiado**: o **carnê** (F4) · o **gatilho de tempo** da régua e a **tela de saúde/alerta** da
  decisão 34 (F5) · a decisão de **partir a fatia 2** (briefing dela) · **SPF/DKIM** (operação).
- **Provocações que mudaram o rumo** — três, e todas vieram de medir em vez de estimar:
  1. **"Onde exatamente está o efeito de e-mail?"** — respondeu *"em dois call sites"*, e transformou
     B3 (portar por leitura) de opção defensável em opção podada. Foi a provocação de maior efeito.
  2. **"O servidor legado concorda consigo mesmo sobre o status?"** — respondeu *"não"*, e mostrou que
     o item 1 da §F3 fecha um defeito vivo, não um débito estético.
  3. **"O carnê é feito do quê?"** — respondeu *"de boletos"*, e moveu um item inteiro do plano para a
     fase seguinte.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (5 ramos explorados, 11 direções escolhidas) | confirmado |
| Personas | **múltiplas personas** (operador, administrador da empresa, e o locatário como destinatário do efeito) | confirmado |
| Novidade | **greenfield de agregado sobre base existente** — `Cobranca` não existe, e ela é a base de F4 e F5 | confirmado |
| Decisão arquitetural transversal nova? | **sim** — o que o dinheiro grava e o que deriva, e a trava temporal no pagamento | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — para **cada uma das duas fatias**, executadas em sequência.

**Justificativa**: duas dimensões decidem sozinhas. **Decisão arquitetural transversal = sim**: a
política de *o que o dinheiro grava e o que ele deriva* atravessa a F4 (conciliação bancária lê os
carimbos), a F5 (as rotinas deixam de ser as donas do estado) e o handoff ao frontend — é decisão
evergreen, não nota de task. **Novidade = greenfield de agregado**: `Cobranca` não tem uma linha hoje,
e errar a forma dela custa duas fases seguintes, exatamente como a F2 custaria se tivesse errado o
contrato. A amplitude (11 direções convergidas) e as múltiplas personas confirmam, mas não são o que
decide.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o miniSpec atende `2-3` rumos, incremento e **nenhuma
decisão arquitetural transversal nova** — falha nos três critérios aqui. O `scope.md` que ele entrega
não comporta o que esta fase mais precisa: a rastreabilidade `CA → CT (RN)` sobre **regras portadas de
um sistema legado com oráculo capturado**, que é a espinha de prova de toda a F3, nem o espaço para
registrar as três fronteiras (F4, F5, F2) com precisão suficiente para impedir desvio de escopo. Numa
fase que já **moveu um item para a fase seguinte** durante o próprio brainstorm, a formalização é a
mitigação, não a burocracia.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por ordens de grandeza. TaskCard é
`0-1` rumo, só dev, ajuste pontual, sem decisão arquitetural. Aqui há um agregado novo, ~1.960 LOC
portadas de Python, uma captura de oráculo com prazo irreversível, três débitos com gatilho a fechar
e ao menos uma ADR. O fast-path CRUD também não se aplica: **nada nesta fase é CRUD** — o `status` é
derivado, a mora é travada no tempo e a régua é orquestração com efeito externo.

### 15.4 Próximo Passo

```bash
# 0. DECIDA a [DÚVIDA] 1 antes de tudo — ela muda o custo da fase.
#    Se a resposta for "cancelar cobrança é ato sensível", a F3 precisa supersede da ADR-0011,
#    e isso entra como ADR ANTES do PRD. A recomendação registrada é NÃO abrir o catálogo.

# 1. Registre a decisão transversal ANTES do PRD — ela atravessa F4, F5 e o handoff:
/agent-spec-adr-create "o que a cobranca grava e o que deriva, com trava temporal no pagamento"

# 2. Depois, o PRD da PRIMEIRA fatia:
/agent-spec-sdd-generate-prd "cobranca e mora por empresa com status de fonte unica no servidor"

# 3. Só quando a fatia 1 fechar, a segunda:
# /agent-spec-sdd-generate-prd "regua de cobranca e documentos do contrato"
```

> **Por que uma ADR, e por que antes do PRD.** A decisão **C-c** — deriva-se enquanto aberto, grava-se
> no instante do pagamento, junto da configuração vigente — não é escolha de implementação da F3: é a
> política de **como este produto trata dinheiro no tempo**. A F4 lê os carimbos para conciliar; a F5
> perde a titularidade do estado que hoje suas rotinas escrevem; e o handoff ao frontend precisa dizer
> ao React que `status` e mora são **derivados publicados**, não campos editáveis. Nenhuma ADR
> existente cobre isso: a 0014 é sobre exclusão, a 0020 é sobre numeração, a 0021 é sobre transição de
> estado — e a diferença entre *transição* e *derivação* é justamente o que esta decisão fixa.
>
> **Uma fatia de cada vez.** Duas fatias significam **dois ciclos completos de SDD**, não dois PRDs
> escritos de uma vez. A fatia 2 herda o agregado, o esquema publicado e o padrão de rota que a fatia 1
> estabelece — especificá-la antes disso seria adivinhar.
>
> **Dois artefatos a atualizar fora do pipeline**, porque a convergência divergiu do plano:
> o `plano-execucao.md` §F3 item 5 e o `roadmap.md` precisam registrar que **o carnê passou para a
> F4**. Não é correção de texto: é mudança de escopo de duas fases.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (partir mais fino) se durante a execução emergir:
  - a captura B1 revelar que o `runner.py` **consulta ou escreve** em mais entidades do que o
    `Log Envio Cobranca` e a `Cobranca` — a régua sozinha viraria fatia;
  - a fatia 2 passar de **~12 tasks** no task-plan — é o sinal que a F2 usou para saber que uma fatia
    não cabe;
  - a `[DÚVIDA] 1` for decidida como *"ato sensível"* — o supersede da ADR-0011 acrescenta trabalho de
    catálogo, guarda de cobertura e matriz de perfil a uma fase que já está cheia;
  - aparecer uma segunda decisão transversal não prevista (ex.: a natureza da cobrança exigir política
    própria de numeração além da ADR-0020).
- **Downgrade** se:
  - a captura B1 mostrar que a régua é substancialmente menor do que os 837 LOC sugerem (muito código
    morto ou duplicado nos `.bak`), **e** a `[DÚVIDA] 1` for resolvida sem tocar a ADR-0011 — as duas
    juntas, e só então a fatia 2 poderia caber em miniSpec.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com PRDs/capacidades concretos, incluindo dois conflitos detectados
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar PRD / INTENT / TaskCard
