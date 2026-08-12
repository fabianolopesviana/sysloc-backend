# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário, ou **medido** contra o código/`/opt/frappe` durante este brainstorm).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `regua-e-documentos` — F3 · fatia 2 (a fatia que **age** e que **sai**)
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f3-fatia2-regua-e-documentos.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-11
- **Versão**: v1
- **Status**: Pronto para próxima etapa
- **Relacionados**:
  - `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md` — o pré-refinamento **da fase**, onde metade das decisões desta fatia já está travada
  - `docs/specs/features/cobranca-e-mora/v1/` — a fatia 1, concluída em 2026-08-10
  - `docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json` — o oráculo
  - `docs/plano-backend-novo/briefings/f3-cobranca-mora-e-documentos.md` — o briefing da fase

> ⚠️ **Este artefato converge para DUAS sub-fatias**, e por isso vive sob o nome que o briefing previu
> (`regua-e-documentos`), não sob o nome de nenhuma delas. É o mesmo padrão da fase: o pré-refinamento
> ficou em `cobranca-mora-e-documentos/v1/` e as fatias ganharam diretório próprio a partir do PRD.

---

## 2. Ideia Resumida (uma frase)

Portar para o backend nativo tudo o que a locação **faz sair para o mundo** — a régua que cobra o
inadimplente por e-mail (enfileirada, configurável por empresa e auditada em log), o contrato em PDF
gerado a partir das suas regras de composição, e a confirmação do e-mail do locatário —, fechando na
passagem os defeitos que o legado carrega e que o oráculo agora prova.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | O corte da fatia — cabe num run, ou parte? por qual critério? | explorar |
| B | O fonte do PDF que só existe no banco, e o que sobra do carimbo | explorar |
| C | A forma do trabalho da régua — fila, configuração e log | explorar |
| D | O que o golden prova quando a fatia fecha o defeito | explorar |
| E | As duas fronteiras que este backend nunca atravessou | explorar |

O usuário aprovou **os cinco**, sem adição nem repriorização.

---

## 3-B. Fatos medidos durante o brainstorm — e cinco correções ao briefing

> Medidos em 2026-08-11 contra o `/opt/frappe` (leitura por `docker compose exec -T backend`, **nada
> destrutivo**, **sem `sudo`**) e contra a árvore versionada. Registrados aqui porque **dimensionam
> trabalho e mudam decisões** — a §9 do briefing pede exatamente isso: *"premissa que dimensiona
> trabalho merece ser medida antes de ser registrada."*

### 3-B.1 O fonte do PDF é **regra de composição**, não boilerplate — e é extraível hoje

O briefing (§7, pergunta 1) marca esta como a medição que **decide o tamanho da fatia**. Medido:

| Sinal no fonte de `PDF contrato` (752 linhas) | Contagem |
|---|---|
| `CLÁUSULA` / `cláusula` | **21** + 4 |
| `def ` (definição de função) | **0** |
| `get_pdf` | 1 |
| `frappe.attach` | 1 |
| `pdf_contrato_arquivo` | **0** |
| `CANCELADO` / `watermark` | **0** |

É redação jurídica codificada em linha reta: qualificação das partes, formatação de CEP e de
endereço, montagem das cláusulas. **Quase não há boilerplate do arcabouço** — as únicas amarras ao
Frappe são o cabeçalho de Document Event e os `frappe.db.get_value` de carga. Portar isto é traduzir
regra de composição, não desembaraçar framework.

### 3-B.2 O carimbo "CANCELADO" **não está** naquele Server Script

Ele vive em `contrato_cancelamento/pdf_utils.py`, e é **marca d'água real de PDF**:
`WATERMARK_TEXT = "CANCELADO"`, `PdfReader`, `_criar_pagina_marca_dagua`, `page.merge_page(...)`. O
`contrato_cancelamento/service.py` (174 linhas) aplica a marca sobre os **bytes já armazenados** e
**sobrescreve** `pdf_contrato_arquivo` (linhas 95, 130, 159, 173).

**Consequência que o briefing §4.4 anteviu e agora está medida**: o carimbo do legado só existe
porque existe um arquivo armazenado para carimbar. Sob PDF derivado sob demanda, ele **deixa de ser
merge de página e vira composição** — e é isso que faz o **D36 fechar por construção**.

### 3-B.3 O `email_token_hash` não é hash, e o token **não é aleatório**

> ⚠️ **Correção ao briefing §4.7 item 3**, que suspeitava e pedia confirmação. Confirmado, e pior do
> que a suspeita.

```python
def _gerar_token(locatario_name):
    return (str(locatario_name) + str(now())).replace(" ", "").replace(":", "")...
```

Três defeitos compostos, todos medidos em `locatario_email_confirmacao/service.py` (222 LOC):

1. **Não é hash** — o valor é gravado em claro em `email_token_hash` (linha 63) e comparado por
   igualdade simples: `if token_recebido != token_salvo` (linha 155). **O nome do campo mente duas
   vezes.**
2. **Não é aleatório** — é o **ID do locatário concatenado ao timestamp**, com a pontuação removida.
   Não há `secrets`, não há `sha256`, não há `uuid` no módulo.
3. **O ID do locatário viaja no próprio link** (`/validacao-email?locatario=X&token=X<timestamp>`).
   Quem recebe um link conhece o ID e conhece o instante — e o espaço restante é o segundo do envio.

**O token é forjável.** É exatamente a classe de coisa que o Protocolo Antirregressão proíbe
reintroduzir. **Decisão do usuário nesta sessão: fechar o defeito no porte** (seção 11).

### 3-B.4 A divergência automático × manual é **medível hoje**, e tem três naturezas, não uma

O briefing (§7, pergunta 3) pergunta quantos dos 10 pares divergem. Lidos do
`retorno.divergencia_de_estado` do golden:

| Par | Cenário | auto → manual | Natureza |
|---|---|---|---|
| REG-01 | `a_vencer_dentro_da_janela` | 1 → 1 | converge |
| REG-02 | `a_vencer_fora_da_janela` | 0 → 1 | **janela de horário** |
| REG-03 | `vencida_sem_envio_previo` | 1 → 1 | converge |
| REG-04 | `vencida_com_envio_recente` | 0 → 1 | **trava de intervalo** |
| REG-05 | `vencida_com_envio_antigo` | 1 → 1 | converge |
| REG-06 | `cobranca_com_pagamento_confirmado` | 0 → 0 | converge |
| REG-07 | `cobranca_paga` | 0 → 0 | **template diverge** (`Fechada` × `Vencida`), efeito **não** |
| REG-08 | `cobranca_cancelada_e_vencida` | 0 → **1** | **o defeito** |
| REG-09 | `cobranca_sem_locatario` | 0 → 0 | converge |
| REG-10 | `vencida_com_envio_de_prefixo_legado` | 0 → 1 | **trava de intervalo** |

**A correção que isto traz**: o briefing tratava "a divergência" como um fenômeno único. São **três**:
derivação de status (REG-07 e REG-08), janela de horário (REG-02) e trava de intervalo (REG-04,
REG-10). Só a primeira é defeito. As outras duas são o manual sendo manual — e confundi-las faria a
fatia fechar comportamento legítimo achando que fechava defeito.

**O contraste que discrimina está preservado**: REG-07 diverge em template e **não** em efeito, porque
`is_cobranca_paga` barra os dois lados. REG-08 tem o mesmo desacordo de template e **produz mensagem**,
porque `is_cobranca_paga` conhece `Paga` e não conhece `Cancelada`. É esse par que prova que a causa é
a derivação, não o canal.

### 3-B.5 A guarda de cobertura **já sabe** declarar rota pública

> ⚠️ **Correção ao briefing §4.7 item 1 e à pergunta 6**, que tratam isto como problema em aberto.

`apps/api/src/autenticacao/cobertura-de-autorizacao.ts` particiona a superfície em **três** conjuntos —
`comExigencia`, `publicas` e `semDeclaracao` —, e o decorator `@RotaPublica()` existe em
`apps/api/src/autenticacao/rota-publica.decorator.ts` e **já é usado**, no encaminhador de `/v1/auth`.

Uma rota pública entra em **`publicas`**, não em `semDeclaracao` — o `semDeclaracao` vazio, que é o que
prova a cobertura, **continua verdadeiro**. A pergunta não é *"como declarar?"*: é **sob que critério
uma rota de NEGÓCIO pode dispensar sessão**, já que hoje só a autenticação o faz. É por isso que a
decisão vira ADR (seção 15.4), e não por falta de mecanismo.

### 3-B.6 O `SELECT` do `runner.py` não filtra empresa — e isso decide a fila

Medido em `cobranca_automation/runner.py:82`: `"status_cobranca": ["not in", ["Paga", "Cancelada"]]`,
sem cláusula de contrato nem de empresa. A varredura é do site inteiro. **Num SaaS multi-empresa isso
não é portável como está**, e a razão não é política: sob RLS forçada, uma varredura cross-tenant não
teria contexto de tenant para executar.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — O corte da fatia

**Direções candidatas:**

- **A1 — Fatia única.** Régua + configuração + log + manual + PDF + carimbo + confirmação num run só.
  - _Exemplo:_ 14–16 tasks, ~2.000 LOC portadas (as ~1.800 do dimensionamento da fase, mais as 154 da
    peça da §4.8 do briefing).
  - _Viabilidade:_ estoura o **gatilho de upgrade já escrito** na §15.5 do pré-refinamento da fase
    (*"a fatia 2 passar de ~12 tasks no task-plan"*). Seria decidir contra um critério que o próprio
    projeto fixou **antes** de conhecer o tamanho.
- **A2 — Corte por objeto**: régua (régua + configuração + log + manual) × documentos (PDF + carimbo +
  confirmação de e-mail).
  - _Exemplo:_ sub-fatia 2a ≈ 8–9 tasks; sub-fatia 2b ≈ 6–7.
  - _Viabilidade:_ reusa o precedente da F2 (duas fatias) e da própria F3.
- **A3 — Corte por natureza de prova**: o que tem oráculo executável (a régua, com 51 KB de golden)
  × o que tem oráculo textual ou nenhum (o PDF, com 174 linhas de saída; a confirmação, sem golden).
  - _Exemplo:_ a suíte da 2a compara contra JSON estruturado; a da 2b compara texto normalizado e, na
    confirmação, não compara com oráculo nenhum.
  - _Viabilidade:_ é o critério que a própria fase usou para cortar a fatia 1.
- **A4 — Corte por prazo**: extrair antes de tudo o fonte do PDF, cuja janela fecha na F7.
  - _Viabilidade:_ **não é um corte concorrente** — é uma **task**, e pelo precedente do projeto ela
    vai na fatia *anterior* à que consome. Foi assim que a T1 da fatia 1 capturou o oráculo da régua
    dentro da fatia que **não** usava a régua, para que a falha aparecesse com folga.

**Direção escolhida**: **A2 ≡ A3**, com a extração do fonte do PDF como **task de prazo na 2a** (A4
absorvido) — decidido com o usuário.

A convergência veio de os dois cortes **coincidirem quase inteiramente**: a régua *é* o que tem oráculo
executável, o PDF *é* o que tem oráculo textual. A única peça que eles alocariam diferente é a
confirmação de e-mail, que não tem oráculo nenhum e não é nem régua nem documento — por isso ela é
alocada **explicitamente** à 2b, não por omissão.

**As duas sub-fatias:**

| | **2a — `regua-de-cobranca`** | **2b — `documentos-e-confirmacao`** |
|---|---|---|
| **Objeto** | o que **age** periodicamente | o que **sai** como documento e o que **confirma** contato |
| **Oráculo** | executável (`regua-de-cobranca.json`, 51 KB) | textual (`contrato-pdf.txt`) e, na confirmação, **nenhum** |
| **Conteúdo** | régua portada · fila · configuração por empresa · log de envio · envio manual · **extração do fonte do PDF (prazo)** | PDF derivado · carimbo como composição · confirmação de e-mail com token forte |
| **Débitos** | **D32** fecha | **D36** fecha |
| **ADR** | nenhuma | **duas**, e são pré-requisito |
| **Tamanho** | ≈ 8–9 tasks | ≈ 6–7 tasks |

**Podadas / adiadas**: **A1** (contra o gatilho de upgrade já escrito, e contra o precedente medido da
F2) · **corte em três** (a confirmação de e-mail isolada não paga o custo fixo de abrir uma fatia:
222 LOC e duas rotas) · **A4 como corte** (rebaixado a task dentro da 2a, que é o seu lugar canônico
neste projeto).

### Ramo B — O fonte do PDF e o que sobra do carimbo

**Direções candidatas — o fonte:**

- **B1 — Extrair o fonte como artefato versionado.**
  - _Exemplo:_ um `frappe.db.get_value("Server Script", "PDF contrato", "script")` grava o **11º
    artefato** em `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`.
  - _Viabilidade:_ comando único, **já executado durante este brainstorm** — custa minutos, e o
    resultado entra no repositório, onde sobrevive à F7.
- **B2 — Ler durante a implementação, sem artefato.**
  - _Exemplo:_ a task do gerador abre o console do Frappe e lê o script na hora.
  - _Viabilidade:_ funciona enquanto o Frappe estiver de pé — mas faz o executor de uma task **depender
    de um sistema externo vivo** para saber qual é a regra, e a regra fica fora do repositório.
- **B3 — Não extrair; derivar do golden textual.**
  - _Exemplo:_ reconstituir a composição a partir das 174 linhas de `contrato-pdf.txt`.
  - _Viabilidade:_ **inviável, e é o argumento que decide o ramo.** As 174 linhas são a saída de **um**
    contrato. Não ensinam os ramos condicionais — com fiador × sem, pessoa jurídica × física, com RG ×
    sem — e são justamente eles que as 21 cláusulas do fonte percorrem. O golden prova a **saída**; ele
    não ensina a **regra**.

**Direções candidatas — o carimbo:**

- **B-i — PDF derivado sob demanda; o carimbo é composição.** O gerador lê o estado do contrato e
  desenha a marca na renderização.
  - _Exemplo:_ pedir o PDF de um contrato cancelado devolve, na hora, o documento com a marca; o
    cancelamento não escreve byte nenhum.
  - _Viabilidade:_ é o **mesmo movimento que a fatia 1 fez com o status da cobrança** — fato gravado,
    derivação publicada. `pdfContratoArquivo` perde referente.
- **B-ii — PDF armazenado; carimbo por merge de página** (porte literal do `pdf_utils.py`).
  - _Viabilidade:_ reintroduz armazenamento de bytes, regeneração a cada salvamento (o evento legado é
    `After Save`) e **ressuscita a guarda "sem PDF, não cancela"** que a fase decidiu matar.
- **B-iii — Derivado com cache.** _Viabilidade:_ adia a decisão sobre o campo, ao custo de um segundo
  estado a invalidar.

**Direção escolhida**: **B1 + B-i** — decidido com o usuário.

O que fecha o ramo é a cadeia: sem arquivo preexistente, **o cancelamento não tem como depender de um**,
e o **D36 fecha por construção**, não por remoção de uma linha de guarda. E o `pdfContratoArquivo`
recebe destino nomeado: **perde referente**, e a spec da 2b decide entre removê-lo do modelo ou mantê-lo
nulo por compatibilidade de leitura do frontend (`[DÚVIDA] 2`).

**Podadas / adiadas**: **B2** (a regra ficaria fora do repositório, dependente de sistema marcado para
desinstalação) · **B3** (o golden é saída, não regra — não cobre os ramos condicionais) · **B-ii** (
ressuscita a guarda que a fase matou) · **B-iii** (segundo estado a invalidar, sem caso de uso medido —
**adiado**: se a composição se mostrar cara sob carga, o cache entra depois sem mudar o contrato).

### Ramo C — A forma do trabalho da régua

**Direções candidatas — a unidade de trabalho da fila:**

- **C1 — Um job por execução da régua** (molde literal do `runner.py`).
  - _Exemplo:_ um job varre toda a carteira em aberto e envia o que for devido.
  - _Viabilidade:_ **não portável** — o `SELECT` medido (§3-B.6) não filtra empresa, e sob RLS forçada
    a varredura cross-tenant não teria contexto de tenant para executar.
- **C2 — Um job por empresa.**
  - _Exemplo:_ N jobs, um por empresa ativa, cada um rodando sob o contexto da sua empresa; a falha de
    um não alcança os outros.
  - _Viabilidade:_ é o que a **F5 declara querer** por escrito (*"um job por empresa ativa, com falha
    isolada e lock por (empresa, rotina)"*), e o RLS impõe a fronteira de graça.
- **C3 — Um job por mensagem.**
  - _Exemplo:_ o varredor enfileira um job por cobrança a cobrar; cada envio tem retentativa própria.
  - _Viabilidade:_ isolamento máximo, mas **a trava de intervalo passa a ser disputada por N jobs
    concorrentes** — e a trava é comportamento provado no golden, inclusive pelo negativo (uma linha de
    status `Erro` recente também conta).
- **C4 — Dois níveis**: job por empresa que enfileira job por mensagem.
  - _Viabilidade:_ dobra a superfície de fila numa fatia já grande, e reintroduz a disputa da trava.

**Direção escolhida**: **C2** — decidido com o usuário. A retentativa fica **no job**, que é onde a
decisão **E7** da fase já a colocou (*"falha de envio é fato próprio, com log e retentativa; o estado da
cobrança não muda"*).

**Duas sub-decisões que vão junto**, e nelas o brainstorm não encontrou tensão real:

- **Configuração da régua: por empresa**, no molde de `negocio.configuracao_de_mora`. O legado é
  **Single** (uma configuração para o site inteiro) — exatamente o defeito que a fatia 1 corrigiu na
  mora. O padrão está pronto: as duas rotas de `/v1/multa-e-juros`, e a área
  `TELA:automacao_de_cobranca`, que **já existe** no catálogo fechado
  (`packages/auth/src/catalogo-de-permissoes.ts:74`), com `ACAO:enviar_cobranca_manual` mapeada para
  ela (linha 113). **Não é preciso abrir o catálogo, e portanto não há risco de superseder a ADR-0011**
  — foi o que o D43 custou à F2.
- **Log de envio: tabela própria tenantizada, entidade de primeira classe.** A alternativa (derivar a
  trava de um campo `ultimoEnvioEm` na cobrança) **não sobrevive ao oráculo**: o golden prova que a
  trava conta **qualquer** linha, inclusive `Erro`, e um campo único não distingue envio de erro sem
  virar dois campos. A tabela preserva a distinção que o `PROCEDENCIA.md` registra como comportamento,
  e é ela que a F5 lê para o alerta da decisão 34.

**Podadas / adiadas**: **C1** (inexecutável sob RLS) · **C3** (disputa da trava provada) · **C4**
(_adiado_: se o isolamento por mensagem se mostrar necessário na F5, ele entra como segundo nível sem
mudar a unidade) · **campo `ultimoEnvioEm` no lugar do log** (perde a distinção envio × erro) ·
**retenção/expurgo do log** (_adiado para a F7_, junto do irmão `identidade.tentativa_login`, que já é
o item 5 da §F7 do plano de execução).

### Ramo D — O que o golden prova quando a fatia fecha o defeito

**Direções candidatas — como tratar a divergência:**

- **D1 — Divergência declarada caso a caso, decidida na spec.** Cada um dos 10 pares recebe veredito
  escrito **antes** da execução.
  - _Exemplo:_ a spec afirma *"REG-08 diverge, e a divergência é a vitória: 1 mensagem → 0"*, e o teste
    carrega essa frase.
  - _Viabilidade:_ é o molde que a fase já usou duas vezes (o zeramento dos 6 campos de conciliação, e
    o `contrato_sem_pdf`).
- **D2 — Rodar contra o golden e tratar cada vermelho quando aparecer.**
  - _Viabilidade:_ é o risco que o briefing nomeia — **o executor decide sozinho o que é vitória**, no
    meio de uma task, sem o contraste dos outros nove pares à vista.
- **D3 — Não usar o golden como asserção, só como referência de leitura.**
  - _Viabilidade:_ **regressão de prova (R2)** pela definição do Protocolo Antirregressão.

**Direção escolhida**: **D1**, com o veredito dos 10 pares **já rascunhado** a partir da medição
(§3-B.4) e a confirmar na tech spec:

| Veredito | Pares | Razão |
|---|---|---|
| **Convergem** (6) | REG-01, REG-03, REG-05, REG-06, REG-09 e **REG-07** | REG-07 diverge em **template** e não em **efeito** — barrado dos dois lados. É o contraste que discrimina, e ele **tem de continuar barrando** |
| **Divergência declarada por vitória** (1) | **REG-08** | A fonte única da fatia 1 torna impossível o manual discordar do automático. O manual deixa de cobrar dívida cancelada: 1 mensagem → 0 |
| **Convergem por decisão** (3) | REG-02, REG-04, REG-10 | O manual ignora a janela de horário e a trava de intervalo — **comportamento preservado** (abaixo) |

**Direções candidatas — o envio manual e a trava** (§4.9 do briefing, pergunta 8):

- **D-i — Preservar, e gravar no log.** O manual continua ignorando janela e trava.
  - _Exemplo:_ o operador reenvia a cobrança de um locatário que ligou reclamando que não recebeu, dez
    minutos depois do envio automático — e a linha de log registra que foi manual.
  - _Viabilidade:_ os três pares convergem com o golden; nenhuma divergência nova a declarar.
- **D-ii — Fechar: o manual respeita a trava.**
  - _Viabilidade:_ uniformiza, mas cria **três divergências declaradas a mais** e tira do operador a
    saída para casos legítimos.
- **D-iii — Preservar a trava, fechar a janela de horário.** _Viabilidade:_ meio-termo que diverge em
  REG-04 e REG-10 e converge em REG-02.

**Direção escolhida**: **D-i** — decidido com o usuário. A razão registrada: **a trava existe para
impedir o automático de recobrar em excesso, não para impedir um operador que agiu deliberadamente** e
que, pela ADR-0021, carrega chave de ação sensível (`ACAO:enviar_cobranca_manual`). Mas o manual
**grava no log** — sem isso, a auditoria e o alerta da F5 ficam cegos justamente para o canal que um
humano acionou.

**Podadas / adiadas**: **D2** (delega ao executor a decisão do que é vitória) · **D3** (R2) · **D-ii** e
**D-iii** (fecham comportamento legítimo achando que fecham defeito — a confusão que a §3-B.4 desfaz).

### Ramo E — As duas fronteiras que este backend nunca atravessou

**Direções candidatas — E-a · a rota pública de negócio:**

- **E-a1 — `@RotaPublica()`, entrando na partição `publicas`.**
  - _Exemplo:_ o locatário clica no link do e-mail e a rota de confirmação atende sem sessão nenhuma,
    enquanto `semDeclaracao` continua vazio.
  - _Viabilidade:_ **o mecanismo já existe e já é usado** (§3-B.5).
- **E-a2 — Atrás de sessão.** _Viabilidade:_ **inviável por construção** — o locatário não é usuário do
  sistema e não tem sessão para estabelecer. Confirmar e-mail *é* o ato de quem ainda não é ninguém.
- **E-a3 — Não publicar a rota nesta fatia**, já que a página que recebe o link é frontend e só chega
  na F6.
  - _Viabilidade:_ possível, mas inverte a ordem do handoff: o React precisa do contrato para construir
    a tela, e é este backend que produz o contrato.

**Direção escolhida**: **E-a1**, com **token forte** como contrapartida (seção 11) e o critério
registrado em **ADR** — porque a pergunta que sobra não é *como declarar*, é **sob que critério uma rota
de negócio dispensa sessão e o que ela carrega em troca**.

**Direções candidatas — E-b · a resposta binária:**

- **E-b1 — O contrato declara resposta binária**, e o `@sysloc/contracts` publica isso.
  - _Exemplo:_ a rota do PDF aparece no contrato com tipo de conteúdo e disposição de download, e o
    cliente gerado sabe que recebe bytes.
  - _Viabilidade:_ depende do que o arcabouço de contrato suporta — `[DÚVIDA] 5`.
- **E-b2 — A rota do PDF fora do contrato derivado**, como exceção declarada e provada.
  - _Viabilidade:_ **piso garantido** se E-b1 não for alcançável; o custo é a primeira exceção ao
    *"fonte única do contrato"*, que precisa ser visível e testada, não silenciosa.
- **E-b3 — JSON com o PDF em base64.**
  - _Exemplo:_ `{ "arquivo": "JVBERi0xLjQK..." }`.
  - _Viabilidade:_ mantém o contrato uniforme, mas infla ~33%, obriga o cliente a decodificar e
    **deixa de ser download** — o legado serve com `frappe.local.response.type = "download"`.

**Direção escolhida**: **E-b1, com E-b2 como piso garantido** — registrada em **ADR**, porque é
transversal: a F4 devolve boleto e carnê em PDF, e o handoff precisa da forma única.

**Podadas / adiadas**: **E-a2** (inexecutável) · **E-a3** (inverte a ordem do handoff) · **E-b3**
(infla, e perde o download).

**Sobre a terceira candidata a ADR — a granularidade da fila — a decisão foi NÃO**, delegada pelo
usuário e fundamentada assim: *"um job por empresa"* não é escolha entre alternativas arquiteturais
legítimas — é **imposta** pelo que já está decidido (o RLS mais o `AsyncLocalStorage` tornam a
varredura cross-tenant inexecutável) e pelo que a F5 já declarou querer. Uma ADR cujo `Decision` apenas
repete o que duas decisões anteriores forçam é **churn** — o mesmo critério que o `CLAUDE.md` invoca
para não superseder a 0006. O lugar da decisão é a tech spec da 2a, com marcador no ponto do código.

---

## 5. Problema

- **Qual é a dor real hoje?** Todo o efeito externo da locação — cobrar quem atrasou, entregar o
  contrato assinável, confirmar que o e-mail do locatário existe — vive em código que só existe dentro
  de um sistema marcado para desinstalação. Duas peças ativas (**752 e 154 linhas**) não estão em
  arquivo, não estão em git, não estão em backup versionado: estão em linhas de tabela do banco do
  Frappe. **A janela para lê-las fecha na F7.**
- **Como o problema aparece no dia a dia?** A cobrança já é um fato correto no servidor desde a fatia 1
  — mas **ninguém é avisado**. O locatário que atrasou não recebe nada, porque a régua ainda mora no
  sistema antigo. E o contrato, que a F2 sabe criar e ativar, **não pode ser impresso** pelo backend
  novo.
- **Quem sente o impacto?** O **locatário**, que deixa de ser avisado do vencimento e não recebe o
  documento do seu contrato. O **operador da imobiliária**, que perde a régua e o envio manual e volta
  a cobrar por fora do sistema. E o **projeto**, cujo marco de entrega exige a F3 fechada.
- **Por que resolver agora?** Três prazos convergem: a janela do `/opt/frappe`, que fecha na F7; o
  congelamento da superfície da API, que só acontece depois da F5; e o fato de que **esta é a última
  fatia que precisa olhar para o banco do Frappe em busca de código** — os únicos dois Server Scripts
  ativos ainda não portados são desta fatia.

---

## 6. Objetivo Principal

- **Resultado esperado**: o backend nativo **age sobre o mundo** — envia cobrança pela régua, entrega o
  contrato em PDF, e confirma o e-mail do locatário — sem depender de nenhuma linha viva do
  `/opt/frappe`, e sem portar os defeitos que o oráculo agora prova que existem.
- **Mudança de comportamento/estado**:
  - a régua deixa de varrer o site inteiro e passa a rodar **por empresa**, enfileirada, com a fronteira
    de tenant imposta pelo banco;
  - o status que a régua consulta deixa de ter **três derivações discordantes** e passa a ter uma só —
    a da fatia 1 — o que faz o manual **parar de cobrar dívida cancelada**;
  - o PDF deixa de ser um arquivo regravado a cada salvamento e passa a ser **derivado do estado**, com
    o carimbo como composição;
  - o token de confirmação deixa de ser **previsível e guardado em claro**;
  - a fila do BullMQ, de pé desde a F0 e nunca usada, **carrega a primeira tarefa de negócio do
    produto**.

---

## 7. Público / Usuário Envolvido

- **Persona primária — o operador da imobiliária** (perfis Admin e Operacional): configura a régua da
  sua empresa (dias, intervalos, horários, canais), dispara o envio manual quando precisa, e consulta o
  log para saber o que saiu. Age pelo app React, em desktop, em horário comercial.
- **Persona secundária — o locatário**: **não usa o sistema**. Ele é alcançado *pelo* sistema — recebe o
  e-mail de cobrança na caixa dele, clica no link de confirmação de e-mail, e recebe o contrato em PDF.
  É a persona que torna esta fatia diferente da fatia 1: o efeito acontece **fora** do produto.
- **Persona terciária — o operador da plataforma** (Master): lê o log de envio agregado para saber se as
  cobranças pararam de sair por limite do provedor. Nesta fatia ele só ganha **o fato gravado**; a tela
  e o alerta são F5.
- **Contexto de uso**: a régua roda sem ninguém presente, em horário configurado por empresa. O envio
  manual e o PDF são sob demanda. A confirmação de e-mail chega ao locatário **fora do sistema**, por
  e-mail, e o link o traz de volta a uma página que **ainda não existe** — ela é frontend, e é F6.

---

## 8. Escopo Inicial (resultado da convergência)

### Sub-fatia 2a — `regua-de-cobranca` (o que **age**)

- [ ] **Extrair o fonte do Server Script `PDF contrato`** (752 linhas) como **11º artefato golden**
      versionado — **task de prazo**, no molde da T1 da fatia 1 (A4 dentro de A2)
- [ ] Régua de cobrança portada (core, emailer, runner), **enfileirada** — **D32 (F0/T6) fechado**, com
      o marcador saindo de `apps/worker/src/fila.ts` no mesmo commit
- [ ] **Unidade de trabalho: um job por empresa** (C2), sob o contexto de tenant da empresa
- [ ] **Configuração da régua por empresa** (os nove campos), no molde de
      `negocio.configuracao_de_mora` — a área `TELA:automacao_de_cobranca` **já existe** no catálogo
- [ ] **Log de envio como entidade de primeira classe**, tenantizado com RLS forçada e FK composta,
      servindo à trava de intervalo, à auditoria e ao insumo do alerta da F5
- [ ] **Falha de envio é fato próprio** (E7): log com causa, retentativa no job, e **o estado da
      cobrança não muda**
- [ ] **Envio manual por rota própria** com `ACAO:enviar_cobranca_manual` (ADR-0021), **preservando** o
      fato de ignorar janela de horário e trava de intervalo — **e gravando no log** (D-i)
- [ ] **A régua lê o estado da view `cobranca_derivada`** — nunca recalcula o seu
- [ ] **Divergência declarada, par a par**: os 10 pares de `divergencia_de_estado` com veredito escrito
      na spec (§3-B.4); **REG-08 diverge por vitória**, os demais convergem
- [ ] `whatsapp`/`ambos` **recusados na validação Zod** — recusa declarada; os campos permanecem no
      modelo porque o frontend os lê

### Sub-fatia 2b — `documentos-e-confirmacao` (o que **sai**)

- [ ] **PDF de contrato derivado sob demanda** a partir do fonte extraído na 2a, provado por
      **igualdade sobre texto normalizado** contra `contrato-pdf.txt`, com a normalização declarada,
      fechada e testada por **prova de falsificação** (E2)
- [ ] **O carimbo "CANCELADO" é composição na renderização**, e o cancelamento apenas grava o estado —
      **D36 (F2/T8) fechado por construção**, e o golden `contrato_sem_pdf` vira divergência declarada
- [ ] **Destino nomeado para `pdfContratoArquivo`** — perde referente (`[DÚVIDA] 2`)
- [ ] **A ordem das guardas do cancelamento** revisada: remover a guarda de PDF **muda qual mensagem
      sai** no cenário `contrato_sem_imovel`, e isso entra na divergência declarada
- [ ] **Confirmação de e-mail do locatário** portada **com o defeito fechado**: token **aleatório**,
      **hash** no banco, comparação em tempo constante e **expiração** — divergência declarada, sem
      oráculo a contrariar
- [ ] **Rota pública de negócio** por `@RotaPublica()`, entrando na partição `publicas`; o
      `semDeclaracao` **continua vazio**
- [ ] **Resposta binária no contrato** (E-b1), com a exceção declarada e provada como piso (E-b2)
- [ ] **Registrar no artefato que o link de confirmação aponta para uma página que não existe aqui** —
      é frontend, é F6, e precisa entrar no handoff para não virar surpresa

### Transversal às duas

- [ ] **A superfície da API cresce**, e cada sub-fatia registra **quanto** — a 2a e a 2b somam
      `[HIPÓTESE]` **6 a 7 rotas** sobre as 82 atuais (`[DÚVIDA] 6`), medidas por **dupla medição
      independente**, no molde do CT-533
- [ ] **Verificar se esta fatia dispara o D26 e o D1** (terceiro consumidor de aritmética de calendário
      e terceiro consumidor monetário) — a régua compara datas o tempo todo e o corpo da mensagem
      imprime valor

---

## 9. Fora do Escopo (podado / adiado)

- **O carnê** — _F4_: a fonte de cada página é o boleto emitido, e a emissão é a F4 inteira. Desvio
  declarado do `plano-execucao.md` §F3 item 5, já registrado no `roadmap.md`.
- **Emissão de boleto e baixa bancária** — _F4_: os seis campos de conciliação seguem nulos e **nenhuma
  rota os escreve**.
- **O gatilho de tempo da régua** — _F5_: esta fatia entrega o trabalho e a fila; a F5 entrega o
  **quando**. *"A fila é a forma do trabalho, não o agendamento dele."*
- **A tela de saúde e o disparo do alerta da decisão 34** — _F5_: aqui só se **grava o fato** no log.
- **Canal WhatsApp** — _recusa declarada na validação, não omissão_.
- **Retenção e expurgo do log de envio** — _F7_, junto do irmão `identidade.tentativa_login` (item 5 da
  §F7). Um log que cresce sem política tem o mesmo destino do outro, e a política é a mesma conversa.
- **Cache do PDF derivado (B-iii)** — _adiado_: entra depois, sem mudar o contrato, se a composição se
  mostrar cara sob carga.
- **Job por mensagem (C3/C4)** — _adiado_: se a F5 exigir isolamento por mensagem, ele entra como
  segundo nível sem mudar a unidade.
- **Qualquer linha de React, inclusive a página `validacao-email` que recebe o link** —
  `[fora do escopo do projeto]`, pela Fronteira do `CLAUDE.md`. **Task que peça frontend é gatilho de
  parada.**
- **Publicar o `@sysloc/contracts`** — item do marco de entrega, não desta fatia.
- **SPF/DKIM no domínio** — operação (DNS), não critério de aceitação.
- **O Server Script `automacao_cobranca_scheduler`** (586 linhas, `disabled=1`) — **não portar**: é a
  versão anterior da régua, substituída pelo módulo `cobranca_automation`.
- **ADR da granularidade da fila** — _podada com justificativa_: o `Decision` só repetiria o que o RLS e
  a F5 já forçam (Ramo E).

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis, backend
  Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo integralmente o Frappe/ERPNext de
  `/opt/frappe`. **Backend apenas** — nenhuma linha de frontend, e o ponto de término está declarado no
  marco de entrega.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md`; `/docs/prds/` contém apenas
  `features/`):
  - `cobranca-mora-e-documentos/v1/pre-refinement.md` — **o pré-refinamento da fase**, de onde vêm as
    decisões travadas da seção 11 e o registro escrito de que esta fatia **pode partir de novo**.
  - `cobranca-e-mora/v1/` — **a fatia 1**, concluída: a view `cobranca_derivada` com `security_invoker`
    como fonte única do estado, a série `COB-{ano}-{7 dígitos}`, a mora travada no pagamento, e o molde
    de configuração por empresa que a régua repete.
  - `contratos-de-locacao/v1/` — origem do **D36**, que a 2b fecha; e o molde de ciclo de vida governado.
  - `caracterizacao-regras-legadas/v1/golden/` — **o oráculo**: `regua-de-cobranca.json` (51 KB, nível 1
    da ordem de queda) e `contrato-pdf.txt` (174 linhas); o `PROCEDENCIA.md` registra por que cada
    máscara existe. **O 11º artefato nasce nesta fatia.**
  - `integracao-bancaria-configuravel/` — **F4**, que recebeu o carnê e que consumirá a ADR da resposta
    binária.
  - `fundacao-multitenancy-identidade/v1/` e `autorizacao-e-ciclo-de-acesso/v1/` — a fundação que esta
    fatia consome sem reabrir: RLS, contexto por `AsyncLocalStorage`, guarda de cobertura.
  - **Nenhuma spec existente cobre régua, PDF de contrato ou confirmação de e-mail.** Sem duplicação.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Fila**: `apps/worker/src/fila.ts` — BullMQ + Redis com AOF, de pé desde a F0 e **sem tarefa de
    negócio até hoje**. É o **D32**, e o marcador está nas linhas 165 e seguintes.
  - **Autorização**: `packages/auth/src/catalogo-de-permissoes.ts` — `TELA:automacao_de_cobranca` na
    linha 74 e `ACAO:enviar_cobranca_manual` na 113. **Já existem: o catálogo não precisa abrir.**
  - **Cobertura**: `apps/api/src/autenticacao/cobertura-de-autorizacao.ts` — partição em
    `comExigencia` / `publicas` / `semDeclaracao`, e o decorator `@RotaPublica()` em
    `rota-publica.decorator.ts`, **já em uso** no encaminhador de `/v1/auth`.
  - **Persistência**: `packages/db` — Drizzle sobre PostgreSQL 18, `empresa_id` com RLS forçada e FK
    composta `(id, empresa_id)`, contexto por `AsyncLocalStorage` + `SET LOCAL`.
  - **Configuração por empresa**: `negocio.configuracao_de_mora` e as duas rotas de `/v1/multa-e-juros`
    — o molde exato que a configuração da régua repete.
  - **Contrato da API**: `@sysloc/contracts` — fonte única, esquema derivado (ADR-0016/0017).
  - **Estado da cobrança**: a view `cobranca_derivada` — a régua **lê de lá**.
- **Conflitos / sobreposições detectados**: **cinco**, todos medidos e registrados na §3-B —
  (1) o fonte do PDF é **regra**, não boilerplate, e o `plano-execucao.md` o trata como módulo a portar;
  (2) o carimbo **não está** naquele Server Script, e sim em `contrato_cancelamento/pdf_utils.py`;
  (3) o `email_token_hash` **não é hash** e o token **não é aleatório**;
  (4) a divergência automático × manual tem **três naturezas**, não uma;
  (5) o briefing trata a declaração de rota pública como problema em aberto, e **o mecanismo já existe
  e já é usado**.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` A composição do PDF em `@react-pdf/renderer` alcança o texto do golden **sem** reproduzir
  o HTML intermediário do legado — o oráculo é o texto extraído, não a marcação.
- `[HIPÓTESE]` A extração do fonte do Server Script cabe numa task curta: o comando foi executado
  durante este brainstorm e devolveu as 752 linhas na primeira tentativa, sem `sudo`.
- `[HIPÓTESE]` A sub-fatia 2a cabe em ~8–9 tasks e a 2b em ~6–7 — abaixo do gatilho de ~12 em ambas.
- `[HIPÓTESE]` A fatia acrescenta **6 a 7 rotas** às 82 atuais (`[DÚVIDA] 6`).
- `[HIPÓTESE]` O envio de e-mail em produção usa **nodemailer** (declarado na stack do `CLAUDE.md`) e
  ainda **não existe no repositório** — o grep por `nodemailer` nos `package.json` voltou vazio. A 2a
  introduz a dependência.
- `[HIPÓTESE]` A régua dispara o **D26** (terceiro consumidor de aritmética de calendário) e talvez o
  **D1** (terceiro consumidor monetário). Verificação barata na task, contra o marcador.
- `[HIPÓTESE]` Nenhuma das duas sub-fatias aplica a migração `0010` a banco durável — se aplicar, a
  janela do **D20** fecha **em silêncio** e o arquivo vira imutável.

**Decisões já tomadas (fora de negociação)** — restrições travadas pelo usuário:

- A fatia 2 **parte em duas sub-fatias**, no corte onde objeto e natureza de prova coincidem: **2a
  `regua-de-cobranca`** (o que age, com oráculo executável) e **2b `documentos-e-confirmacao`** (o que
  sai, com oráculo textual ou nenhum). A confirmação de e-mail é alocada **explicitamente** à 2b.
- **A extração do fonte do Server Script `PDF contrato` é task de prazo na 2a**, não na 2b — a task de
  prazo vai na fatia anterior à que consome, para que a falha apareça com folga. É o precedente da T1
  da fatia 1.
- O fonte extraído vira **artefato golden versionado**; derivar a regra do golden textual está podado
  porque as 174 linhas são a **saída** de um contrato e não ensinam os ramos condicionais.
- **O PDF é derivado sob demanda, e o carimbo "CANCELADO" é composição na renderização** —
  `pdfContratoArquivo` perde referente, e o **D36 fecha por construção**.
- **A unidade de trabalho da fila é um job por empresa** — a varredura cross-tenant do legado não é
  portável sob RLS, e a F5 já declarou querer lock por `(empresa, rotina)`.
- **A configuração da régua é por empresa**, no molde de `negocio.configuracao_de_mora`. **O catálogo de
  permissões não abre** — a área e a ação já existem.
- **O log de envio é entidade de primeira classe**, em tabela própria tenantizada — um campo na cobrança
  não distingue envio de erro, e o golden prova que a trava conta as duas coisas.
- **O envio manual preserva o fato de ignorar a janela de horário e a trava de intervalo, e grava no
  log.** A trava governa o automático, não o operador que agiu deliberadamente.
- **A divergência contra o golden é declarada par a par na spec**, antes da execução — REG-08 diverge
  por vitória; os outros nove convergem.
- **O token de confirmação de e-mail é aleatório, guardado como hash, comparado em tempo constante e com
  expiração.** O legado concatena o ID do locatário com o timestamp e guarda em claro num campo chamado
  `_hash`; portar isso reintroduziria segredo forjável no banco novo. Divergência declarada, sem oráculo
  a contrariar.
- **A rota pública de negócio usa `@RotaPublica()` e entra na partição `publicas`** — o `semDeclaracao`
  continua vazio.
- **Duas ADRs, e não três**: a do critério de rota pública de negócio e a do contrato de resposta
  binária. A da granularidade da fila foi **recusada** — o `Decision` só repetiria o que o RLS e a F5
  já forçam.
- Português brasileiro em tudo; **só Opus**, na sessão principal e em todo subagente.
- **Aqui só se faz backend.** A página que recebe o link de confirmação é frontend e é F6.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: a régua passa a rodar **por empresa** e com configuração por
  empresa. Uma imobiliária que hoje herda a configuração única do site verá o comportamento mudar no
  dia da virada, e pode ler isso como erro.
  → _mitigação_: a migração de dados leva a configuração `Single` atual para **cada** empresa, de modo
  que o comportamento no dia 1 seja idêntico ao de hoje; a divergência passa a existir só quando alguém
  editar. Registrar no handoff.
- **Risco de escopo — o maior desta fatia**: o fonte do PDF tem **752 linhas de regra**, e a medição
  mostrou que quase nada delas é boilerplate descartável. Traduzir 21 cláusulas com ramos condicionais
  é maior do que "portar um módulo".
  → _mitigação_: o corte em duas sub-fatias isola esse trabalho na 2b, onde ele é **o** trabalho; e a
  extração vem antes, na 2a, para que a 2b comece com a regra em mãos. Se a 2b passar de ~12 tasks no
  task-plan, ela parte de novo (§15.5).
- **Risco de prazo, e ele fecha em silêncio**: o fonte do PDF e o da configuração da régua existem
  **apenas em linhas de tabela** do banco de um sistema marcado para desinstalação. Não estão em git,
  não estão em backup versionado. **A janela fecha na F7.**
  → _mitigação_: a extração é **task de prazo na primeira sub-fatia**, exatamente como a captura do
  oráculo da régua foi T1 da fatia 1. É o padrão que o projeto já provou.
- **Risco técnico / operacional**: esta é a **primeira tarefa de negócio da fila** desde que ela subiu
  na F0. O que nunca rodou em produção não tem comportamento conhecido sob falha.
  → _mitigação_: a decisão E7 já separa falha de envio do estado da cobrança; o job por empresa isola a
  falha; e o log de envio grava a causa. O D32 sai no mesmo commit.
- **Risco de segurança**: a fatia publica a **primeira rota de negócio sem sessão** do produto, num
  backend cuja F1 estabeleceu barreira única de admissão com default que nega.
  → _mitigação_: o critério vira **ADR** antes do PRD da 2b; o token é aleatório, hasheado, com
  expiração; e a rota entra em `publicas`, com o `semDeclaracao` vazio continuando a provar a cobertura.
  Avaliar limitador de taxa na rota (o **D27** registra que o limitador ainda não tem eixo de origem
  confiável — e ele só ganha isso na F7).
- **Risco de privacidade**: a régua **envia e-mail para pessoas reais**. Um defeito de destinatário, de
  filtro de empresa ou de contexto de tenant não é um teste vermelho — é uma cobrança indevida na caixa
  de alguém.
  → _mitigação_: RLS forçada no log e na cobrança; job por empresa sob contexto de tenant; e a ADR-0006
  garante que a suíte nunca executa contra o ambiente que atende a operação. Nenhum envio real em teste.
- **Risco de regressão (R3)**: a fatia reabre `contrato.service.ts` e `cobranca.service.ts`, **ambos
  povoados de marcadores `DECISÃO FECHADA`**, para fechar o D36 e ligar a régua.
  → _mitigação_: o Protocolo Antirregressão com força máxima; as três linhas do P3 antes de cada edição;
  o marcador do D36 sai no mesmo commit da correção; e **a `DECISÃO FECHADA` que mencionar a ADR-0019
  superseded não se toca** — duas citações permanecem por decisão registrada.

---

## 13. Dúvidas em Aberto

1. **`[DÚVIDA]`** Quanto das 752 linhas sobrevive à tradução? Medi que **21 cláusulas** e as rotinas de
   formatação são regra genuína e que `def` = 0 (código em linha reta), mas **não medi quantos ramos
   condicionais distintos** existem (com fiador × sem, PJ × PF, com RG × sem). É o número que dimensiona
   a 2b, e sai da leitura do artefato extraído — **portanto depois da task de prazo da 2a, não antes**.
2. **`[DÚVIDA]`** O que acontece com `pdfContratoArquivo` quando o PDF passa a ser derivado: some do
   modelo, ou permanece nulo por compatibilidade de leitura do frontend? A pergunta 2 da §7 do briefing
   da fatia de contratos ficou sem resposta e volta aqui, agora com consequência. **Verificável no
   `levantamento-frontend.md`**: se o React lê o campo, ele permanece nulo; se não lê, sai.
3. **`[DÚVIDA]`** A ordem das guardas do cancelamento: removida a de PDF, qual mensagem passa a sair no
   cenário `contrato_sem_imovel`? O `PROCEDENCIA.md` registra que **a ordem é dado, não detalhe**, e os
   dois cenários foram capturados separadamente por causa disso. Precisa de veredito escrito na spec da
   2b, ou o golden reprova por um motivo que ninguém previu.
4. **`[DÚVIDA]`** A migração da configuração `Single` para configuração por empresa acontece nesta
   fatia (com dado real do legado) ou nasce com padrões e é preenchida na virada? Decide se a 2a tem
   task de migração de dados.
5. **`[DÚVIDA]`** O arcabouço de contrato deste projeto suporta declarar resposta binária? O grep por
   `ts-rest` nos `package.json` voltou **vazio**, e não há uso de `contentType` nos contratos — a stack
   do `CLAUDE.md` o declara, mas a verificação de como o contrato é publicado hoje pertence ao
   **tech-alignment**. É o que decide entre **E-b1** e o piso **E-b2**, e é insumo da ADR.
6. **`[DÚVIDA]`** Quantas rotas exatamente cada sub-fatia acrescenta às 82 atuais? Estimativa
   `[HIPÓTESE]`: 2a com 3–4 (configuração em leitura e gravação, envio manual, e possivelmente consulta
   ao log) e 2b com 3 (PDF, disparo da confirmação, confirmação pública). **Estimável só na tech spec,
   mas o número entra no PRD** — e a medição é a **dupla medição independente** do CT-533. ⚠️ O número
   da F2 era **75, não 77** — não propague a premissa refutada do `HEAD` em dobro.
7. **`[DÚVIDA]`** A rota pública de confirmação precisa de limitador de taxa nesta fatia? O **D27**
   registra que o limitador não tem eixo de origem confiável até a publicação atrás do servidor de borda
   na F7. Decidir se a mitigação nesta fatia é outra (expiração curta, token de uso único) ou se o
   limitador entra assim mesmo.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: **A2≡A3 + A4 embutido** (duas sub-fatias, extração como
  task de prazo na 2a) · **B1** (fonte extraído como 11º artefato golden) · **B-i** (PDF derivado,
  carimbo como composição, D36 fechado por construção) · **C2** (um job por empresa) · **configuração
  por empresa** e **log como entidade de primeira classe** · **D1** (divergência declarada par a par,
  com o veredito dos 10 já rascunhado) · **D-i** (envio manual preserva janela e trava, e grava no log)
  · **E-a1 + token forte** (rota pública por `@RotaPublica()`, com o defeito do token fechado) ·
  **E-b1 com E-b2 como piso** (resposta binária no contrato) · **duas ADRs**.
- **Descartado com justificativa**: **A1** (contra o gatilho de ~12 tasks já escrito) · **corte em três**
  (a confirmação não paga o custo fixo de uma fatia) · **B2** (a regra ficaria fora do repositório) ·
  **B3** (o golden é saída, não regra — não cobre os ramos condicionais; **é o argumento que decidiu o
  ramo B**) · **B-ii** (ressuscita a guarda que a fase matou) · **C1** (inexecutável sob RLS) · **C3**
  (disputa da trava, que é comportamento provado) · **D2** (delega ao executor decidir o que é vitória)
  · **D3** (R2) · **D-ii** e **D-iii** (fecham comportamento legítimo achando que fecham defeito) ·
  **E-a2** (o locatário não tem sessão para estabelecer) · **E-a3** (inverte a ordem do handoff) ·
  **E-b3** (infla 33% e perde o download) · **ADR da granularidade da fila** (churn: repetiria o que o
  RLS e a F5 já forçam) · **portar o token como está** (reintroduz segredo forjável).
- **Adiado**: **cache do PDF derivado** (B-iii — entra sem mudar contrato, se a composição custar) ·
  **job por mensagem** (C3/C4 — segundo nível, se a F5 exigir) · **retenção do log de envio** (F7, com
  `identidade.tentativa_login`) · **o carnê** e a **emissão de boleto** (F4) · **o gatilho de tempo** e
  **a tela de saúde/alerta** (F5).
- **Provocações que mudaram o rumo** — as quatro medições:
  1. *"O golden não basta?"* — não: as 174 linhas são a saída de **um** contrato e não ensinam os ramos
     condicionais. Isso matou B3 e fez a extração virar task de prazo.
  2. *"O carimbo está no Server Script do PDF?"* — não, está em `pdf_utils.py`, e é **merge de página
     sobre bytes armazenados**. É por isso que derivar o PDF **fecha o D36 por construção**, em vez de
     apenas remover uma guarda.
  3. *"O `_hash` guarda hash?"* — não, e o token nem aleatório é. Mudou a decisão de "portar" para
     "portar fechando o defeito".
  4. *"Quantos pares divergem?"* — a pergunta estava mal posta: são **três naturezas** de divergência, e
     só uma é defeito. Sem isso, a fatia fecharia comportamento legítimo achando que fechava defeito —
     e o executor decidiria sozinho, no meio de uma task.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (5 ramos explorados, todos com direção escolhida; ≈15 itens de escopo entre as duas sub-fatias) | confirmado |
| Personas | **múltiplas** — operador da imobiliária (configura e dispara), **locatário** (recebe e-mail, clica no link, recebe o PDF) e operador da plataforma (lê o log) | confirmado |
| Novidade | **incremento** sobre módulos existentes, mas com **duas fronteiras nunca atravessadas** (rota pública de negócio, resposta binária) e a **primeira tarefa de negócio na fila** | confirmado |
| Decisão arquitetural transversal nova? | **sim — duas** (critério de rota pública de negócio; contrato de resposta binária), ambas transversais a F4, F5 e ao handoff | confirmado |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — **um run por sub-fatia**, na ordem 2a → 2b.

**Justificativa**: duas dimensões decidem sozinhas. **Personas múltiplas** — o locatário é alcançado
*fora* do sistema, por e-mail e por link, e é a persona que torna esta fatia diferente da fatia 1, que
não tocava nada fora do banco. E **duas decisões arquiteturais transversais novas**, que viram ADR e que
a F4 e o handoff vão consumir. Some-se a amplitude 4+ e o precedente medido: a fatia 1 desta mesma fase
rodou SDD com 11 tasks e fechou nos dois gates. O que **não** se repete é o tamanho — a fatia foi
partida em duas justamente para que cada run fique abaixo do gatilho de ~12 tasks.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): ele não comporta ADR, e esta fatia tem **duas** —
ambas com consumidor externo já identificado (a F4 devolve boleto em PDF; o handoff precisa do critério
de rota pública). Além disso, o miniSpec não carrega a rastreabilidade US→task que a **divergência
declarada par a par** exige: os 10 pares do golden precisam de veredito escrito ligado a caso de teste,
e é o `task_plan` do SDD que faz esse amarrado. Rodar miniSpec aqui seria descobrir na execução que
falta onde registrar a decisão — que é exatamente a R3 que o Protocolo Antirregressão persegue.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por duas ordens de grandeza. São
~2.000 LOC portadas, três personas, duas ADRs, migração de configuração, primeira tarefa de fila,
primeira rota pública de negócio e primeira resposta binária. TaskCard é para ajuste pontual sem decisão
arquitetural — nenhuma das duas metades desta frase se aplica.

**Por que NÃO um run único de SDD para as duas sub-fatias**: estouraria o gatilho de upgrade que o
pré-refinamento da fase já deixou escrito (*"passar de ~12 tasks"*), e contra o precedente medido da F2,
onde o corte em duas fatias fechou 21 tasks sem nenhuma bloqueada.

### 15.4 Próximo Passo

A ordem importa: a **2a** vem primeiro porque carrega a **task de prazo** (extrair o fonte do PDF), e a
**2b** consome o que ela extraiu. As duas ADRs são pré-requisito **da 2b**, não da 2a.

```bash
# 1) Agora — a sub-fatia que age, e que carrega a task de prazo
/agent-spec-sdd-generate-prd "régua de cobrança enfileirada, configurável por empresa e auditada em log, com envio manual — e a extração do fonte do gerador de PDF do contrato como task de prazo"

# 2) Antes do PRD da 2b — as duas decisões transversais
/agent-spec-adr-create "critério para uma rota de negócio dispensar sessão, e o que ela carrega em troca"
/agent-spec-adr-create "o que o contrato publica para uma rota que devolve bytes"

# 3) Depois das ADRs — a sub-fatia que sai
/agent-spec-sdd-generate-prd "PDF de contrato derivado sob demanda com carimbo de cancelamento por composição, e confirmação de e-mail do locatário com token forte"
```

> A feature da 2a é **`regua-de-cobranca`** e a da 2b é **`documentos-e-confirmacao`**. Este
> pré-refinamento permanece em `regua-e-documentos/v1/` e é a entrada das duas — o mesmo padrão que a
> fase usou (`cobranca-mora-e-documentos/v1/pre-refinement.md` alimentou `cobranca-e-mora/v1/`).

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (partir de novo) se durante a geração emergirem:
  - a **2b passar de ~12 tasks** no `task_plan` — provável se a `[DÚVIDA] 1` revelar muitos ramos
    condicionais nas 752 linhas. O corte natural seria **PDF × confirmação de e-mail**, que já não se
    tocam;
  - a **2a passar de ~12 tasks**, o que aconteceria se a migração da configuração `Single`
    (`[DÚVIDA] 4`) trouxer dado real e virar frente própria;
  - uma **terceira decisão arquitetural** aparecer — candidata conhecida: se a `[DÚVIDA] 5` revelar que
    o contrato **não** suporta resposta binária e o piso E-b2 exigir mecanismo novo.
- **Downgrade** se:
  - a `[DÚVIDA] 1` revelar que as 752 linhas colapsam em poucas cláusulas com pouquíssimos ramos, e a
    2b couber em ≤ 4 tasks sem ADR própria — aí ela vira **miniSpec**;
  - as duas ADRs forem resolvidas por ADR existente ao abrir a `Decision` integral (a **0016** e a
    **0017** governam contrato derivado e chave exposta; **abrir o texto, não a linha-resumo**).

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade
      + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs e capacidades concretas, com `path:linha` onde a
      afirmação é verificável
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado, e as quatro provocações medidas
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo e o mais distante
- [x] **Comando exato (15.4)** escrito, com as duas ADRs posicionadas na ordem certa
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
