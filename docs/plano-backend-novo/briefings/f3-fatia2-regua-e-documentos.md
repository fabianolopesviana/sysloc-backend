# Briefing de pré-refinamento — F3 · fatia 2 · Régua e documentos

> **Entrada para `/agent-spec-pre-refinement`.** Este documento não é a spec: é o material de
> ancoragem para o brainstorm de produto. Ele reúne o que a fatia é, o terreno que encontra pronto, o
> que a fatia 1 e o pré-refinamento da fase **já fecharam e não se reabre**, e — o que mais importa —
> **as tensões reais que o pré-refinamento precisa explorar e convergir com o usuário**.
>
> Feature prevista: `regua-e-documentos` · versão `v1` · variante `backend` · **fatia 2 da F3** do
> `docs/plano-backend-novo/plano-execucao.md`. ⚠️ **A fatia pode se partir de novo** — a §4.1 é a
> primeira tensão a resolver, e o pré-refinamento da fase deixou essa decisão registrada como
> pertencente a este briefing.
>
> **Precedentes de método, na ordem de leitura:**
> `docs/plano-backend-novo/briefings/f3-cobranca-mora-e-documentos.md` (o briefing da fase, que esta
> fatia continua) e `docs/plano-backend-novo/briefings/f2-fatia2-contratos-de-locacao.md` (o
> precedente de briefing de fatia). O pré-refinamento da fase —
> `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md` — é **leitura obrigatória**:
> metade das decisões desta fatia já está travada lá.

---

## 1. O que esta fatia é

**É o que age e o que sai.** A fatia 1 (`cobranca-e-mora`, concluída em 2026-08-10) entregou a
cobrança como fato financeiro com estado de dono único no servidor — e ela **não toca nada fora do
banco**. Esta fatia é toda ela ação sobre o mundo: a régua que aciona o inadimplente por e-mail, o
contrato em PDF, e a fila que carrega esse trabalho. O corte é **por efeito colateral**, e foi
decidido pela coincidência de três critérios independentes (efeito, objeto e oráculo).

O escopo convergido para esta fatia está na **§8 do pré-refinamento da fase**, em cinco itens:

1. Régua de cobrança portada (core, emailer, runner), **enfileirada** — fecha o **D32 (F0/T6)**;
2. Falha de envio como **fato próprio**, com log e retentativa; o estado da cobrança **não muda**;
3. PDF de contrato, provado por **igualdade sobre texto normalizado** contra o golden;
4. `locatario_email_confirmacao` portado;
5. **D36 (F2/T8)** fechado: o carimbo "CANCELADO" é **efeito** do cancelamento, não pré-condição.

⚠️ **Esses cinco itens não somam o trabalho todo, e a §4.8 mostra a peça que falta.** O briefing da
fase dimensionou a fatia em ~1.800 LOC portadas; a medição de 2026-08-11 encontrou uma sexta peça
ativa que ninguém contou.

---

## 2. O que já está fechado — não reabrir

### 2.1 O que a fatia 1 entregou (11 tasks, dois gates, commitada)

- **`negocio.cobranca` e `negocio.configuracao_de_mora`** — tenantizadas, com RLS forçada e FK
  composta, dinheiro em `numeric(15,2)`.
- **A view `cobranca_derivada` com `security_invoker`** é a **fonte única do estado e da mora**. O
  `status` não é coluna: é derivação dos fatos gravados (`dataVencimento`, `pagoEm`, `canceladoEm`),
  publicada pelo esquema. **Isto é o coração da fatia 1 e não se reabre** — a régua desta fatia lê o
  estado de lá, e não recalcula o seu.
- **A série `COB-{ano}-{7 dígitos}`**, atrás de duas funções `SECURITY DEFINER`, no molde da
  `CTR-{ano}-{5 dígitos}` da F2.
- **A mora travada no instante do pagamento** — `multaAplicada`, `jurosAplicados` e os dois
  percentuais vigentes ficam carimbados na cobrança; mudar a configuração depois **não** reescreve o
  que já foi quitado.
- **As transições por rota própria** (ADR-0021): acusar pagamento e cancelar. A **ADR-0021 foi
  emendada** na T7, por decisão do usuário escalada pelo Gate 2 — a `Decision` ganhou o roster
  explícito das instâncias da segunda classe, e as duas transições de cobrança estão nele por nome.
- **As colunas de conciliação bancária nascem e permanecem nulas** — `nosso_numero`,
  `linha_digitavel`, `codigo_barras`, `data_credito`, `valor_creditado`, `boleto_arquivo` — e **a
  rota de emissão de boleto não existe**. É o molde do `cobrancasGeradas: false` da F2, e é a
  fronteira com a F4.
- **O D28 (F2/T7) fechado**: a ativação do contrato deriva as parcelas e as grava na mesma unidade de
  trabalho.
- **7 rotas novas**, levando a superfície de **75 para 82 rotas / 67 manipuladores**. Suíte de
  **687 para 835 casos**.

### 2.2 As decisões da fase — travadas no pré-refinamento, fora de negociação

Estão na **§11 do `pre-refinement.md` da fase**, subseção *"Decisões já tomadas"*. As que alcançam
esta fatia:

- **A régua é enfileirada já na F3**; a F5 acrescenta **apenas o gatilho de tempo**. *"A fila é a
  forma do trabalho, não o agendamento dele."* **O D32 fecha aqui.**
- **A falha de envio é fato próprio** (E7): log com causa, retentativa respeitando a trava de
  intervalo, e **o estado da cobrança não muda** — uma cobrança cujo e-mail falhou continua devida.
- **O PDF é provado por igualdade sobre texto normalizado** (E2), com a normalização declarada,
  fechada e testada por **prova de falsificação**. Igualdade literal (E1) foi podada por reprovar por
  motivo que não é comportamento; asserção por campo (E3) foi podada por ser **regressão de prova
  (R2)**.
- **O carimbo "CANCELADO" é efeito, não pré-condição** — o golden `contrato_sem_pdf` passa a ser
  **divergência declarada**.
- **O carnê saiu da F3 e foi para a F4**, porque a fonte de cada página é o boleto. ⚠️ É **desvio
  declarado do `plano-execucao.md` §F3 item 5**, e o `roadmap.md` já registra.
- **`whatsapp`/`ambos` são recusados na validação Zod** — recusa declarada, não omissão. Os campos
  permanecem no modelo porque o frontend os lê.
- **A tela de saúde e o disparo do alerta da decisão 34 são F5**; esta fatia **grava o fato** no log.
- **SPF/DKIM é operação (DNS)**, não critério de aceitação.

### 2.3 O oráculo da régua **existe** — e isso muda o jogo

O maior risco que o pré-refinamento da fase identificou era portar 837 LOC sem referência, com a
janela do `/opt/frappe` fechando na F7. **Esse risco está eliminado.** A T1 da fatia 1 capturou o
oráculo em 2026-08-10, no **nível 1 da ordem de queda** — o melhor possível: o despachante foi
substituído dentro do processo, com o percurso completo da régua executando,
`invocacoes_do_despachante_real = 0` e fila do arcabouço em 0.

`docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json` — 51 KB — grava:

| Bloco | O que carrega |
|---|---|
| `entrada` | 10 cobranças de cenário, **13 de carteira herdada**, a configuração da régua, 4 linhas de histórico de envio, e as tuplas puras de `normalize_hhmm` (8), `is_hora_execucao` (3) e intervalo (6) |
| `retorno.automatico` | as **7 mensagens** que a régua decidiu enviar, com corpo, mais o resumo que ela grava |
| `retorno.manual` | os **10 cenários** de envio manual, com resultado por cenário |
| `retorno.template` | os 10 estados que `get_status_template` resolve |
| `retorno.divergencia_de_estado` | os 10 pares automático × manual, lado a lado |
| `estado_resultante` | as 10 cobranças depois, a configuração depois, e as **19 linhas** de `Log Envio Cobranca` |

Quatro máscaras, todas justificadas no `PROCEDENCIA.md`: `<DATA_EXECUCAO>`, `<HORA_EXECUCAO>`,
`<DATA_VENCIMENTO_FORMATADA>` e `<IDENTIFICADOR_DE_REQUISICAO>`.

**Uma limitação está registrada e importa para o desenho:** a captura fixou o horário da régua em
`00:00` para não depender da hora do dia. A janela de horário **não ficou sem oráculo** — foi
capturada à parte, como função pura, com o "agora" passado explicitamente.

### 2.4 As ADRs que vinculam — abra a `Decision`, não a linha-resumo

**0006** (o ambiente de verificação nunca é o que atende a operação), **0011** (catálogo fechado de
permissões), **0013**, **0016** e **0017** (contrato derivado de esquema; chave exposta),
**0018**, **0020** (numeração) e **0021** (transição de estado — **já emendada pela fatia 1**).
`Citar ADR exige abrir a Decision` — as linhas do `CLAUDE.md` e do `INDEX.md` são paráfrases e já
divergiram do texto real.

---

## 3. Restrições que não se negociam

- **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de **toda** edição —
  com força máxima nesta fatia, que reabre `contrato.service.ts` e `cobranca.service.ts`, ambos
  povoados de marcadores.
- **Fronteira**: aqui só se faz backend. Nenhuma linha de React, nenhum arquivo na máquina local.
  Task que peça frontend é **gatilho de parada**.
- **Multi-tenancy é fundação**: `empresa_id`, RLS forçada e FK composta em toda tabela nova — o log
  de envio inclusive.
- **Nenhum segredo versionado**: credencial de SMTP vive fora do repositório.
- **Português brasileiro em tudo; exclusivamente Opus**, na sessão principal e em todo subagente.
- **A superfície da API cresce aqui, e o congelamento é depois da F5** — mas cada fatia precisa saber
  o que publicou (§4.11).

---

## 4. As tensões a explorar — o coração deste briefing

### 4.1 A fatia cabe num run, ou parte de novo?

É a primeira decisão, e ela condiciona todas as outras. O pré-refinamento da fase registrou por
escrito que esta fatia **pode precisar partir**, e deixou a decisão para aqui — no molde exato do que
a F2 fez.

Os dados para decidir:

- **Volume**: ~1.800 LOC portadas pelo dimensionamento da fase, **mais** a peça da §4.8 que ninguém
  contou. A F2 inteira fez ~1.000 LOC em **2 fatias e 21 tasks**; a fatia 1 desta fase fez 11 tasks.
- **O gatilho de upgrade já está escrito** na §15.5 do pré-refinamento da fase: *"a fatia 2 passar de
  **~12 tasks** no task-plan"*.
- **O corte candidato óbvio é régua × documentos** — mas ele não é o único, e não é obviamente o
  melhor. Um corte alternativo é **por natureza de prova**: o que tem oráculo executável
  (régua, com 51 KB de golden) contra o que tem oráculo textual (PDF).
- **Contra-argumento a considerar**: a régua e o PDF **não se tocam**. Não há símbolo compartilhado,
  não há tabela comum, e o e-mail de confirmação (§4.9) não pertence a nenhum dos dois. Três coisas
  independentes numa fatia é o sinal clássico de que ela é um pacote, não uma unidade.

### 4.2 A divergência automático × manual: portar o defeito, ou fechá-lo?

**É o achado que motivou a fase inteira, e agora ele tem oráculo.** No legado existem **três**
derivações do mesmo status: `normalizeStatus` no cliente React, `get_status_template` em `core.py`
(que tem o ramo `Fechada`) e `get_status_template_manual` em `emailer.py` (que **não tem** esse ramo
e testa o vencimento antes de qualquer estado).

O efeito está gravado no cenário `cobranca_cancelada_e_vencida`: o caminho automático **nunca alcança
a cobrança**, porque o `SELECT` do `runner.py` exclui `["Paga","Cancelada"]`; o envio manual monta o
template `Vencida` e **cobra por uma dívida cancelada** — `is_cobranca_paga` conhece `Paga` e não
conhece `Cancelada`. **1 mensagem no manual contra 0 no automático.** O contraste que discrimina está
no cenário vizinho `cobranca_paga`, em que o manual **é** barrado.

A tensão não é *"o defeito é ruim?"* — é **como o golden se comporta quando a fatia o fecha**:

- A fatia 1 já tornou o defeito **estruturalmente impossível**: existe uma única derivação, e ela é a
  view. Não há como o manual discordar do automático.
- Logo, o cenário `cobranca_cancelada_e_vencida` **vai divergir do golden**, e isso é vitória, não
  falha. Mas o teste precisa dizer isso **por escrito**, no molde da *divergência declarada* que a
  fase já usou duas vezes (o zeramento dos 6 campos de conciliação, e o `contrato_sem_pdf`).
- **A pergunta aberta**: quantos dos 10 pares de `retorno.divergencia_de_estado` divergem, e cada um
  é divergência declarada ou regressão? Responder isso caso a caso é trabalho de spec, não de
  execução — e se ficar para a task, o executor decide sozinho o que é vitória.

### 4.3 O gerador do PDF **não é o que o plano diz que é** — e ele morre na F7

> ⚠️ **Medido em 2026-08-11 contra o `/opt/frappe`. Corrige o `plano-execucao.md`, o `roadmap.md`, o
> `decisao-e-stack.md` e o briefing da fase.**

O plano trata as "752 linhas do PDF de contrato" como se fossem um módulo a portar. A medição:

| Afirmação corrente | O que a medição encontrou |
|---|---|
| "o gerador de contrato, 752 linhas" | **Server Script `PDF contrato`**, `Document Event / After Save` sobre `Contrato`, **`disabled=0`** (ativo), **existindo apenas no banco** — o `decisao-e-stack.md:63` já dizia isso, e o resto do plano esqueceu |
| `contrato_pdf/service.py` é o gerador | São **61 linhas** que apenas **servem** o PDF já armazenado em `pdf_contrato_arquivo` — não geram nada |
| "o golden das 752 linhas" | `contrato-pdf.txt` tem **174 linhas de texto extraído**. O 752 é o **fonte**, o 174 é a **saída**. São coisas diferentes e o texto corrente as confunde |

Três consequências que o pré-refinamento precisa converger:

1. **O fonte é volátil de um jeito que nenhuma outra peça desta migração é.** Ele não está em
   arquivo, não está em git, não está em backup versionado — está numa linha de tabela do banco de um
   sistema marcado para desinstalação. **A janela para lê-lo fecha na F7**, exatamente como a da
   régua fechava. E, diferente da régua, **portar o PDF exige ler o fonte**: o golden textual prova a
   saída, não ensina as regras de composição.
2. **`[HIPÓTESE]` a extração do fonte é barata e deveria acontecer antes da implementação** —
   possivelmente como task de prazo, no molde da T1 da fatia 1, que existiu por uma razão que
   expirava. Um `frappe.db.get_value("Server Script", "PDF contrato", "script")` resolve.
3. **O evento é `After Save`**: no legado o PDF é **regerado a cada salvamento do contrato** e
   armazenado. É a premissa que sustenta a guarda *"sem PDF, não cancela"* — e é ela que dissolve
   quando o PDF passa a ser gerado sob demanda (§4.4).

Reprodução da medição:

```bash
cd /opt/frappe && docker compose exec -T backend bench --site frontend console <<'EOF'
print("\n".join("SS| %s | %s | %d linhas | disabled=%s" % (r.name, r.script_type,
  len((frappe.db.get_value("Server Script", r.name, "script") or "").splitlines()), r.disabled)
  for r in frappe.get_all("Server Script", fields=["name","script_type","disabled"], limit_page_length=0)))
EOF
```

### 4.4 O D36 e o carimbo — a decisão está tomada, a consequência não foi desenhada

A fase já decidiu: **o carimbo "CANCELADO" é efeito, não pré-condição**, e a guarda de PDF deixa de
existir. O que **não** está decidido é o que sobra dela:

- Se o PDF é gerado sob demanda, **o que o carimbo carimba?** Um PDF que não existe até alguém pedir.
  `[HIPÓTESE]` o carimbo vira um estado do contrato que o gerador **lê**, e não uma escrita sobre
  bytes armazenados. Se for isso, o "efeito" do cancelamento é gravar o estado, e o carimbo é
  derivação — o mesmo movimento que a fatia 1 fez com o status da cobrança.
- **`pdfContratoArquivo` continua no modelo** (a F2 o portou como um dos dois `Custom Field` de
  negócio do contrato). Se o PDF passa a ser derivado, **esse campo perde referente**. Ele vira
  legado morto, cache, ou some? A pergunta 2 da §7 do briefing da fatia de contratos ficou sem
  resposta e volta aqui, agora com consequência.
- O `PROCEDENCIA.md` registra que **a ordem das guardas é dado, não detalhe** — a guarda de PDF
  precede a de imóvel, e os dois cenários foram capturados separadamente por causa disso. Remover a
  primeira guarda **muda qual mensagem sai** no cenário `contrato_sem_imovel`. Isso precisa entrar na
  divergência declarada, ou o golden reprova por um motivo que ninguém previu.

### 4.5 A régua enfileirada — qual é a unidade de trabalho?

A decisão *"a régua enfileira na F3, a F5 traz o gatilho de tempo"* fixa **que** existe fila. Não fixa
**o que** entra nela, e a escolha tem consequência direta no isolamento de falha que a F5 vai exigir:

- **um job por execução da régua** (o molde literal do `runner.py`, que varre a carteira inteira);
- **um job por empresa** (o que a F5 declara querer: *"um job por empresa ativa, com falha isolada e
  lock por (empresa, rotina)"*);
- **um job por mensagem** (isolamento máximo, retentativa natural, e a trava de intervalo passa a ser
  disputada por N jobs concorrentes).

**O fato que decide não está no golden**: o `SELECT` do `runner.py` **não filtra por contrato nem por
empresa** — ele varre toda cobrança em aberto do site. Num SaaS multi-empresa isso não é portável
como está. `[HIPÓTESE]` a granularidade por empresa é a que o RLS já impõe de graça, porque o
contexto de tenant vem do `AsyncLocalStorage` e uma varredura cross-tenant não teria contexto para
rodar.

Ligado a isso: **o D32 (F0/T6) fecha aqui**, e o marcador sai de `apps/worker/src/fila.ts` no mesmo
commit. A fila existe desde a F0 e **nunca carregou tarefa de negócio** — esta é a primeira.

### 4.6 O log de envio é entidade de primeira classe?

O legado tem `Log Envio Cobranca` como DocType próprio, e o golden grava **19 linhas** dele no
`estado_resultante`. Duas funções distintas se apoiam nele, e o pré-refinamento precisa decidir se
são a mesma tabela:

1. **Trava de intervalo** — `pode_enviar_por_intervalo` lê o log para não recobrar antes do prazo. O
   `PROCEDENCIA.md` registra que a trava foi provada com o negativo que discrimina: uma linha de
   status `Erro` recente, sem a qual *"a trava só conta envio bem-sucedido"* seria indistinguível de
   *"a trava conta qualquer linha"*. **Essa distinção é comportamento, e tem de sobreviver ao porte.**
2. **Trilha de auditoria e insumo do alerta da decisão 34** — a F5 lê daqui para saber que as
   cobranças pararam de sair por limite do provedor.

E a retenção: a F1 já deixou *"retenção de `identidade.tentativa_login`"* como item 5 da §F7. Um log
de envio que cresce sem política tem o mesmo destino. **`[DÚVIDA]` a política de retenção é desta
fatia ou é F7?**

### 4.7 O e-mail de confirmação é **double opt-in**, não e-mail de cobrança

> ⚠️ **Medido em 2026-08-11.** `locatario_email_confirmacao/service.py`, 222 LOC.

O nome sugere "e-mail de confirmação de pagamento". **Não é.** É um fluxo de **verificação de
endereço de e-mail do locatário**, com token: `_gerar_token` grava `email_token_hash` e
`email_token_gerado_em` no `Locatario`, envia um link, e `confirmar_email_locatario` valida o token,
grava `email_token_usado_em` e **apaga o hash**. Tem ainda um gancho `DocType Event` que zera o token
quando o e-mail muda.

Isso levanta três tensões que o item *"`locatario_email_confirmacao` portado"* esconde:

1. **A rota de confirmação é `allow_guest=True` — pública, sem sessão.** Este backend estabeleceu na
   F1 uma **barreira única de admissão de sessão** e uma guarda de cobertura sobre o catálogo, com
   **default que nega**. Publicar uma rota que atende sem sessão é decisão de segurança de primeira
   ordem, não porte de função. **`[DÚVIDA]` como a guarda de cobertura declara uma rota pública?** O
   `semDeclaracao` está vazio hoje e é o que prova a cobertura.
2. **A página que recebe o link é `www/validacao-email.html`, e ela vive no Frappe.** O React não a
   tem. Quando o `/opt/frappe` for desinstalado, **o link aponta para o vazio**. A página é frontend
   e portanto **fora daqui** — o que esta fatia pode entregar é a rota e o contrato; a tela é
   handoff. **É um ponto de Fronteira, e merece ser dito no artefato para não virar surpresa na F6.**
3. **O token é comparado por igualdade e guardado em campo chamado `..._hash`.** Se o valor guardado
   for o token em claro, o nome mente e o porte não deve reproduzir isso — é exatamente a classe de
   coisa que o Protocolo Antirregressão proíbe reintroduzir. **Confirmar antes de portar.**

### 4.8 A peça que ninguém contou: a configuração da régua

> ⚠️ **Medido em 2026-08-11.** Não aparece nas ~1.800 LOC do briefing da fase nem na §8 do
> pré-refinamento.

O Server Script **`Automacao cobranca config api`** — **154 linhas, `disabled=0` (ativo)** — lê e
grava o DocType `Automacao Cobranca Config`, que é a configuração da régua por si: `ativo`,
`dias_antes_vencimento`, `intervalo_dias_a_vencer`, `intervalo_dias_vencida`, `horario_a_vencer`,
`horario_vencida`, `canal_a_vencer`, `canal_vencida`, `nao_enviar_a_vencer` — os nove campos que o
golden grava em `entrada.configuracao_da_regua`.

Consequências:

- **A régua não roda sem configuração**, e configuração é **rota**, não constante. Isso soma
  superfície que a §4.11 precisa contar.
- **É Single no Frappe** — uma configuração para o SaaS inteiro, exatamente o mesmo defeito que a
  mora tinha e que a fatia 1 corrigiu com `negocio.configuracao_de_mora` por empresa. **`[HIPÓTESE]`
  a régua segue o mesmo molde, e a fatia 1 deixou o padrão pronto**, incluindo as duas rotas de
  `/v1/multa-e-juros` e a área `TELA:automacao_de_cobranca`, que **já existe** no catálogo fechado.
- **A área existe, a ação também**: `ACAO:enviar_cobranca_manual` está em `TELA:automacao_de_cobranca`
  no catálogo da ADR-0011. O envio manual desta fatia **já tem chave**; não é preciso abrir catálogo.

**No mesmo inventário, dois fatos de higiene:** existe um Server Script `automacao_cobranca_scheduler`
de **586 linhas, `disabled=1`** — versão anterior da régua, substituída pelo módulo
`cobranca_automation`. **Não portar.** E, somando tudo, **os Server Scripts ativos ainda não portados
são exatamente dois, e ambos são desta fatia**: `PDF contrato` (752) e `Automacao cobranca config
api` (154). Os demais ativos já foram portados na F1 e na F2. **Esta fatia é a última que precisa
olhar para o banco do Frappe em busca de código.**

### 4.9 O envio manual — quem pode, e sobre o quê

O golden traz **10 cenários de envio manual**, e o legado o expõe como Server Script próprio (`Enviar
cobranca email manual`, 247 linhas, hoje `disabled=1` — migrado para o módulo). A tensão:

- A chave `ACAO:enviar_cobranca_manual` existe e é sensível pela ADR-0021 → **rota própria com chave**.
- Mas o envio manual é o caminho que **cobra dívida cancelada** no legado (§4.2). Portar a rota sem
  portar o defeito é o objetivo — e a prova disso é justamente o cenário que **diverge** do golden.
- **`[DÚVIDA]` o envio manual respeita a trava de intervalo?** No legado ele tem caminho próprio, e o
  `PROCEDENCIA.md` registra o `prefixo_request_id` como o que a trava observa. Se o manual ignora a
  trava, isso é comportamento a preservar ou defeito a fechar?

### 4.10 O que a fatia publica — a superfície precisa fechar em número

A F3 leva a superfície de 75 a **82 rotas / 67 manipuladores**, medidos por **dupla medição
independente** no CT-533 da T11. Esta fatia acrescenta pelo menos: configuração da régua (leitura e
gravação), envio manual, o PDF de contrato (binário), e as duas do fluxo de confirmação de e-mail
(disparo e confirmação pública). **O número entra no artefato**, como entrou no da fase — a
`[DÚVIDA] 4` do pré-refinamento da fase cobrou isso e continua válida.

⚠️ **O número da F2 era 75, e não 77.** Não propague a premissa refutada de que *"cada `GET` entra em
dobro por causa do `HEAD`"* — o módulo `cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado.

### 4.11 O PDF binário atravessa uma fronteira que este backend ainda não atravessou

Todas as 82 rotas de hoje falam JSON. O PDF é **resposta binária com download**, e o legado o serve
com `frappe.local.response.type = "download"`. `[HIPÓTESE]` isso é a primeira rota não-JSON do
produto, e por isso toca o `@sysloc/contracts` de um jeito novo: o pacote é **fonte única do
contrato** e deriva esquema Zod: **o que ele publica para uma rota que devolve bytes?** Decisão de
contrato, não de implementação — e é candidata a ADR se a resposta for estrutural.

---

## 5. Fora do escopo desta fatia

- **O carnê** — F4. A fonte de cada página é o boleto emitido, e a emissão é F4 inteira.
- **Emissão de boleto e baixa bancária** — F4. Os campos de conciliação seguem nulos e **nenhuma rota
  os escreve**.
- **O gatilho de tempo da régua** — F5. Esta fatia entrega o trabalho e a fila; a F5 entrega o quando.
- **A tela de saúde e o disparo do alerta** da decisão 34 — F5. Aqui só se grava o fato.
- **Canal WhatsApp** — recusa declarada na validação, não implementação.
- **Qualquer linha de React**, inclusive a página que recebe o link de confirmação de e-mail —
  `[fora do escopo do projeto]`, pela Fronteira do `CLAUDE.md`.
- **Publicar o `@sysloc/contracts`** — item do marco de entrega.
- **Retenção/expurgo do log de envio** — provavelmente F7, mas confirmar (§4.6).

---

## 6. Débitos com gatilho que esta fatia dispara

O `CLAUDE.md` mantém o índice; o detalhe vive na §2 do `run-report.md` da fatia de origem.

- **`D32` · F0/T6** (`apps/worker/src/fila.ts`) — dispara na **primeira fatia que enfileirar tarefa
  de negócio**. **É esta.** Fecha aqui, com o marcador saindo no mesmo commit.
- **`D36` · F2/T8** (`contrato.service.ts`, `cancelar`) — dispara **na F3**, e é aqui que se decide
  se o carimbo é pré-condição ou efeito. **A decisão já está tomada** (§4.4); falta executá-la.
- **`D26` · F3/T8** (`packages/db/src/derivacao-de-cobranca.ts`, `ultimoDiaDoMes`) — dispara no
  **terceiro consumidor de aritmética de calendário**. A régua compara datas o tempo todo: **é
  candidato real a disparar nesta fatia.**
- **`D1` · F3/T2** (`packages/contracts/src/cobranca.ts`) — dispara no **terceiro consumidor
  monetário**. A F4 é a candidata óbvia, mas o corpo da mensagem da régua imprime valor — **verificar
  se esta fatia é o terceiro.**
- **`D20` · F3/T7** (`0010_seguranca_cobranca.sql`) — **o único do índice cujo gatilho fecha em
  silêncio**: a janela para emendar a `0010` termina na primeira aplicação dela a banco durável.
- **`D28` · F0/T5** — já disparado e agravado (~35 ocorrências em ~20 arquivos). Toda suíte nova o
  repete.

---

## 7. Fatos a confirmar durante o pré-refinamento

Marque como `[DÚVIDA]` no artefato o que não se resolver:

1. **O fonte do Server Script `PDF contrato` (752 linhas) é extraível hoje, e o quanto dele é regra
   de composição versus boilerplate do Frappe?** (§4.3 — **decide o tamanho da fatia**)
2. A extração desse fonte é **task de prazo** no molde da T1 da fatia 1, ou basta lê-lo durante a
   implementação?
3. **Quantos dos 10 pares de `divergencia_de_estado` divergem** quando a fonte única da fatia 1 é
   aplicada, e cada um é divergência declarada ou regressão? (§4.2)
4. O que acontece com `pdfContratoArquivo` quando o PDF passa a ser derivado? (§4.4)
5. O `email_token_hash` guarda hash ou o token em claro? (§4.7)
6. Como a guarda de cobertura declara uma **rota pública sem sessão**, com `semDeclaracao` vazio?
7. A configuração da régua vira **por empresa**, no molde da mora? (§4.8)
8. O envio manual respeita a trava de intervalo? (§4.9)
9. Qual é a unidade de trabalho da fila — execução, empresa ou mensagem? (§4.5)
10. A política de retenção do log de envio é desta fatia ou é F7? (§4.6)
11. O que o `@sysloc/contracts` publica para uma rota que devolve **bytes**? (§4.11)
12. Quantas rotas a fatia acrescenta às 82 atuais? (§4.10)

---

## 8. Critérios de saída deste pré-refinamento

O artefato deve permitir decidir, sem reabrir a conversa:

- [ ] **se a fatia cabe num run ou parte de novo**, e por qual critério corta (§4.1)
- [ ] o que se faz sobre o **fonte do PDF que só existe no banco**, com custo e prazo (§4.3)
- [ ] como a **divergência automático × manual** é tratada caso a caso contra o golden (§4.2)
- [ ] o que sobra da guarda de PDF e o destino de `pdfContratoArquivo` (§4.4)
- [ ] a **unidade de trabalho da fila** (§4.5)
- [ ] se o **log de envio** é entidade de primeira classe, e o que ele precisa provar (§4.6)
- [ ] o que é, de fato, o **`locatario_email_confirmacao`**, e o que dele é backend (§4.7)
- [ ] se a **configuração da régua** entra nesta fatia e em que forma (§4.8)
- [ ] o framework recomendado (a fatia 1 rodou **SDD** com 11 tasks; pode promover ou rebaixar)
- [ ] se alguma decisão merece **ADR nova** — candidatas: a rota pública sem sessão (§4.7), o
      contrato de resposta binária (§4.11) e a granularidade da fila (§4.5), as três transversais a
      F4, F5 e ao handoff

---

## 9. Observações de método

- **A régua já tem oráculo, e é o melhor artefato de caracterização que este projeto produziu.** Use
  o `regua-de-cobranca.json` como fonte, não o código Python — o golden registra o comportamento,
  inclusive o defeito, e o `PROCEDENCIA.md` registra por que cada máscara existe. Ler o Python é para
  entender o **porquê**, nunca para decidir o **que é certo**.
- **Três premissas do plano foram medidas e corrigidas neste briefing** (§4.3, §4.7, §4.8). Isso não
  é acidente: é o mesmo padrão que a fatia 1 registrou ao descobrir que a T1 **não exigia `sudo`** e
  ficou diferida por uma premissa que quatro comandos derrubariam. **Premissa que dimensiona trabalho
  merece ser medida antes de ser registrada.**
- O `/opt/frappe` **ainda está de pé** e consultá-lo é legítimo — mas o site `frontend` é
  **produção**: nada destrutivo. Leitura por `docker compose exec -T backend bench --site frontend
  console` é o padrão seguro, e **não exige `sudo`**.
- **Dois fatos operacionais que mordem quem rodar a suíte**: o **`CT-907` é flaky pré-existente**
  (falha por *timeout* é o flake; falha por *asserção* é achado), e o **disco do host está em ~93%** —
  rode `rm -rf /tmp/sysloc-banco-*` entre execuções, porque `No space left on device` se disfarça de
  teste vermelho. Meça a suíte **por pacote** (`pnpm --filter @sysloc/<pacote> test`).
- **Um achado pré-existente segue aberto**: o `verificar-golden.sh` termina REPROVADO no **`CT-013`**
  (credencial aparecendo na árvore versionada, apontando `senha.spec.ts`, `pessoa.ts` e
  `semente.ts`). **Não é regressão da fatia 1** — provado em worktree limpo. Causa provável, não
  confirmada: colisão de agulha. Detalhe na §4 do `_run/run-report.md` da fatia 1.
- O pré-refinamento é brainstorm **de produto**: sem endpoints, sem schema, sem arquitetura fina.
  Onde este briefing cita estrutura, é para ancorar viabilidade — **não para ser copiado na spec**.
- **Esta fatia fecha a F3.** Ao fim dela, quatro das cinco fases que o marco de entrega exige estarão
  concluídas, e o que sobra entre aqui e o handoff é **F4 e F5**.
