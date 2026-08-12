# Roadmap — Backend Sysloc

> **Para que serve este arquivo.** O `plano-execucao.md` é a fonte da verdade sobre *o que* cada fase
> faz, e é longo porque precisa ser. Este roadmap é o **mapa de onde estamos**: uma tela para
> responder "o que já foi feito, o que vem agora, e o que exatamente é cada fase" sem ler 522 linhas.
>
> **Divisão de trabalho entre os dois:** mudou o escopo de uma fase? Edita-se o `plano-execucao.md`,
> e depois aqui. Terminou uma task ou uma fatia? **Não se edita nada** — o painel é gerado.

## Como ler

| Símbolo | Significa |
|---|---|
| ✅ | concluída — todas as tasks aprovadas nos dois gates |
| 🔄 | em andamento |
| 📋 | **especificada, execução pendente** — a spec existe e o trabalho pode começar agora |
| ⬜ | não iniciada — ainda precisa de pré-refinamento |

**Fase × fatia.** Uma fase é uma unidade do plano; uma **fatia** é uma feature do agent-spec, com
`v1` próprio, que se executa num run. Quase toda fase é uma fatia só — mas quando a amplitude não
cabe num run, ela se parte. **A F1 e a F2 foram partidas em duas, e a F3 em três**, e nenhuma dessas
partições foi prevista no plano: todas se decidiram em pré-refinamento. A F1 cortou *depois da
autenticação*; a F2 corta *por agregado*, com imóveis e pessoas antes de contratos; a F3 corta *por
efeito*, com o dado e o cálculo antes do que age e do que sai — e a **segunda fatia dela partiu de
novo**, por *objeto × natureza de prova*, separando o que age do que sai. Outras fases podem se
partir pelo mesmo motivo; quando isso acontecer, as fatias novas aparecem aqui.

> **O pré-refinamento de uma fase partida tem casa própria.** O da F2 vive em
> `docs/specs/features/dominio-locacao/v1/pre-refinement.md` e o da F3 em
> `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md`; cada um cobre as fatias da
> sua fase. A sub-partição da fatia 2 da F3 tem o seu próprio, em
> `docs/specs/features/regua-e-documentos/v1/pre-refinement.md`, que é a **entrada dos dois runs**
> (2a e 2b). Nenhum dos três é fatia executável, e por isso não aparecem no painel — nem no mapa
> `FATIAS_DA_FASE` do gerador.

---

## Painel

<!-- PAINEL:INICIO -->
| Fase | O quê | Estado | Progresso |
|---|---|---|---|
| **F0** | Stack instalada e provada | ✅ concluída | 7/7 tasks |
| **F1** | Fundação SaaS — isolamento, identidade e autorização | ✅ concluída | 20/20 tasks |
| **F2** | Domínio de locação | ✅ concluída | 21/21 tasks |
| **F3** | Cobrança, mora e documentos | 🔄 em andamento | 2 de 3 fatias · 23/23 tasks |
| **F4** | Integração bancária (Sicoob) | ⬜ não iniciada | — |
| **F5** | Automações agendadas | ⬜ não iniciada | — |
| **F6** | Frontend religado — só o handoff sai daqui | ⬜ não iniciada | — |
| **F7** | Virada e desinstalação — partida em duas | ⬜ não iniciada | — |
<!-- PAINEL:FIM -->

<!-- RODAPE:INICIO -->
_Painel gerado por `deploy/scripts/roadmap/atualizar-roadmap.sh` — não edite à mão._
<!-- RODAPE:FIM -->

---

## Antes de tudo — `caracterizacao-regras-legadas`

**Não é uma fase.** É a fatia que capturou o comportamento do Frappe **antes** de ele ser
substituído, para que a reimplementação tenha um oráculo em vez de uma leitura de código.

Produziu **6 artefatos golden** versionados, que são o critério de equivalência das regras portadas
na F2 e na F3 — entre eles o texto extraído do PDF de contrato, 174 linhas de saída produzidas por
um Server Script de 752 linhas que existe **só no banco**. Sem eles, "o PDF novo está certo" seria
opinião.

✅ **Concluída.** Os goldens estão em `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`.

---

## F0 — Stack instalada e provada

**O que é:** o servidor deixa de depender de Docker e passa a rodar a stack nativa. Nada de negócio
entra aqui — é fundação de infraestrutura.

**Entrega:** Node 24 + pnpm + Turborepo fixados por `mise`; PostgreSQL 18 e Redis 7 instalados e
configurados; monorepo com os pacotes vazios porém compiláveis; unidades systemd por serviço com
`Restart=always`; suíte Vitest com `embedded-postgres`; `mprocs` para o desenvolvimento.

**O que a torna diferente:** a aceitação é **executável, não declarada**. `verificar-fundacao.sh`
agrega os verificadores e roda contra a instalação real — e o critério mais duro, a recuperação após
reboot, foi provado com **reinício de verdade** da máquina, com tarefa enfileirada antes do boot
consumida depois dele.

<!-- ESTADO:F0:INICIO -->
> ✅ **concluída** — 7/7 tasks
>
> ✅ `fundacao-stack-nativa/v1` — 7/7 tasks
<!-- ESTADO:F0:FIM -->

---

## F1 — Fundação SaaS: multi-tenancy e identidade

**O que é:** o isolamento entre empresas e a identidade das pessoas. É a fase que decide se o
produto é multi-empresa de verdade ou se apenas finge ser.

**Por que foi partida em duas:** o corte natural pareceria ser *isolamento* × *identidade*, e ele foi
**rebatido** — atravessa a mesma camada, e a fonte legítima do `empresa_id` é a sessão, que é
identidade. O corte que funcionou foi **depois da autenticação**: primeiro dar para entrar com
isolamento provado, depois decidir o que cada pessoa alcança.

### Fatia 1 — `fundacao-multitenancy-identidade`

`empresa_id`, **RLS forçada** e **FK composta `(id, empresa_id)`** em toda tabela de negócio —
referência cross-tenant é impossível **pelo banco**, não impedida por validação de aplicação.
Contexto por `AsyncLocalStorage` + `SET LOCAL`, nunca lido do request. `better-auth` com barreira
única de admissão de sessão.

### Fatia 2 — `autorizacao-e-ciclo-de-acesso`

A matriz **10 telas × 7 ações sensíveis** com ajuste individual **nos dois sentidos** (conceder *e*
retirar). Ponto de aplicação único, com revalidação por `versaoPermissoes` quando a versão da pessoa
diverge da gravada na sessão. Guarda de cobertura que impede publicar rota governada sem declaração,
com **default que nega**. Ciclo de vida de empresas (Master) e de pessoas (Admin), com onboarding por
**senha provisória** e troca obrigatória.

<!-- ESTADO:F1:INICIO -->
> ✅ **concluída** — 20/20 tasks
>
> ✅ `fundacao-multitenancy-identidade/v1` — 11/11 tasks
> ✅ `autorizacao-e-ciclo-de-acesso/v1` — 9/9 tasks
<!-- ESTADO:F1:FIM -->

---

## F2 — Domínio de locação

**O que é:** as entidades do negócio, que até aqui não existem. É a primeira fase que um usuário
final enxergaria.

**As 7 entidades:** `Conjunto`, `Imovel`, `Comodo`, `Locador`, `Locatario`, `Fiador` e `Contrato`,
mais o vínculo entre contrato e fiadores. O plano falava em oito, contando um `ContratoFiador` que
**não existe no legado**: lá a child table chama-se `Fiadores` e tem um único campo, o elo com o
fiador.

**Por que foi partida em duas:** o corte é **por agregado**, e a dependência dá a ordem — `Contrato`
aponta para imóvel e para pessoas, então eles vêm antes. Cada fatia é vertical (schema → rota →
contrato → teste), o que rebate o corte por camada que a F1 já havia descartado.

### Fatia 1 — `cadastro-de-imoveis-e-pessoas`

Conjunto, imóvel, cômodos e os três papéis de pessoa, com **metragem derivada na leitura** provada
contra o golden, exclusão lógica (nada é apagado, exceto cômodo, que é detalhe de composição) e
unicidade por empresa de documento e identificador municipal. Nasce aqui o **`@sysloc/contracts`**.

### Fatia 2 — `contratos-de-locacao`

`Contrato`, o vínculo com fiadores, o código legível `CTR-{ano}-{sequencial}` e o **núcleo local** da
ativação e do cancelamento.

**Entrega:**

1. Schema com RLS e FK composta. **Código legível só onde há série declarada** — hoje contrato e
   cobrança. As demais entidades expõem o identificador opaco: seis das oito nunca tiveram código no
   legado, e inventá-lo daria ao imóvel um segundo identificador ao lado do municipal (ADR-0017,
   que substituiu a 0012 por isso).
2. **Tipos reais**: dinheiro em `numeric(15,2)`, datas em `date`/`timestamptz`, status em enum. Com
   isso some a camada de coerção do frontend (`toInt`, `toDouble`, `isTruthy`).
3. Os **2 `Custom Field` de negócio** desta fase — `gerarCobrancasAutomaticamente` e
   `pdfContratoArquivo`, ambos de `Contrato`. O terceiro do site pertence à `Cobranca` e é F3.
4. **Regras portadas do Frappe**, e é aqui que os goldens são cobrados. Mas só a **metragem** tem
   golden: ativação (340 linhas) e cancelamento (174 linhas) **atravessam F3 e F4** — geram cobrança,
   emitem boleto, exigem PDF e pedem baixa bancária. A F2 porta o **núcleo local** delas (validações,
   transição de status, efeito no imóvel) e declara os pontos de extensão como débito com gatilho.
5. **`@sysloc/contracts`** — nasce **interno**, com esquema compartilhado como fonte única do contrato
   e documento derivado dele (ADR-0016). A publicação acontece no marco; `ts-rest`, que a stack
   declara, fica para quando a superfície congelar.

**Aceitação:** a caracterização de metragem passa contra a implementação nova · criar `Contrato` da
empresa A apontando `Imovel` da B é **recusado pelo banco**.

<!-- ESTADO:F2:INICIO -->
> ✅ **concluída** — 21/21 tasks
>
> ✅ `cadastro-de-imoveis-e-pessoas/v1` — 11/11 tasks
> ✅ `contratos-de-locacao/v1` — 10/10 tasks
<!-- ESTADO:F2:FIM -->

---

## F3 — Cobrança, mora e documentos

**O que é:** o dinheiro. Ciclo de cobrança, cálculo de mora e os documentos que o cliente recebe.

**Por que foi partida em duas — e depois a segunda partiu de novo:** o primeiro corte é **por efeito
colateral**, e três critérios independentes (efeito, objeto e oráculo) coincidem no mesmo ponto. A
fatia 1 não toca nada fora do banco; a fatia 2 é toda ela ação sobre o mundo — fila, e-mail, PDF. A
viabilidade decidiu: a F2 inteira fez ~1.000 LOC em 2 fatias e 21 tasks, e a F3 num run só seria o
dobro disso. O aviso de que a fatia 2 "pode precisar partir de novo" **se confirmou** no
pré-refinamento dela, em 2026-08-11: o segundo corte é **objeto × natureza de prova**, que coincidem
— a **2a** é o que age, com oráculo executável de 51 KB; a **2b** é o que sai, com oráculo textual ou
nenhum. A 2a veio primeiro porque carregava a **task de prazo** que extrai o fonte do PDF do banco do
Frappe antes do desligamento.

### Fatia 1 — `cobranca-e-mora`

O agregado `Cobranca`, o **`status` com fonte única no servidor** (view `cobranca_derivada` com
`security_invoker`, em vez do `normalizeStatus` que hoje cada tela calcula por conta própria), a
**mora por empresa** e a série `COB-{ano}-{7 dígitos}`. Fecha o **D28 (F2/T7)**: a ativação do
contrato passa a gerar as parcelas na mesma unidade de trabalho.

### Fatia 2a — `regua-de-cobranca`

A régua de cobrança com a fila (é a **primeira fatia que enfileira tarefa de negócio**, e por isso
fechou o **D32 (F0/T6)** nas duas pontas). Entrega `negocio.politica_de_aviso` e
`negocio.envio_de_cobranca` sob RLS forçada, o **predicado de elegibilidade no banco** sobre
`cobranca_derivada`, o pacote **`@sysloc/regua`** e 4 rotas novas sob `/v1/automacao-de-cobranca`.
A **política é por empresa** — o legado a tinha **Single**, uma para o SaaS inteiro, o mesmo defeito
que a mora corrigiu na fatia 1.

### Fatia 2b — `documentos-e-confirmacao`

O que sai: o **PDF de contrato** portado para `@react-pdf/renderer` e validado contra o golden
textual, e o porte do `locatario_email_confirmacao`. Fecha o **D36 (F2/T8)** — e **por construção**:
com o PDF derivado sob demanda não existe arquivo preexistente de que o cancelamento possa depender.
⚠️ Ela **já tem pré-refinamento** (o de `regua-e-documentos/v1`, que cobre as duas sub-fatias) e o
que falta é o run próprio; o ⬜ do painel é o gerador não distinguindo esse caso. **Duas ADRs são
pré-requisito**: o critério para uma rota de negócio dispensar sessão, e o que o contrato publica
para uma rota que devolve bytes.

⚠️ **O carnê NÃO está mais aqui** — foi para a **F4** em 2026-08-10, por decisão do pré-refinamento
da fase: a fonte de cada página é o **boleto emitido**, e a emissão é F4 inteira.

⚠️ **Duas peças desta fatia viviam só no banco do Frappe, e o fonte delas morre na F7. Uma já foi
salva.** O Server Script `PDF contrato` (752 linhas, `After Save` sobre `Contrato`) foi **extraído
pela T1 da 2a** e está versionado em `golden/contrato-pdf-fonte.py` — a janela de prazo da 2b, essa,
fechou bem. O `Automacao cobranca config api` (154 linhas), a configuração **Single** da régua,
**continua só no banco e sem golden**; a 2a a substituiu por `politica_de_aviso` por empresa, então
cabe à 2b decidir se ainda precisa lê-lo. Detalhe em
`docs/plano-backend-novo/briefings/f3-fatia2-regua-e-documentos.md`.

**Entrega:**

1. `Cobranca` com o ciclo completo e **`status` com fonte única no servidor** — hoje é derivado no
   cliente por `normalizeStatus`, o que significa que duas telas podem discordar.
2. **Mora por empresa**: multa e juros deixam de ser configuração global única. `_calcular_mora()` é
   pura e idempotente.
3. **Régua de cobrança** — porte de **837 linhas** medidas (core, emailer, runner, helpers, service,
   scheduler), mais a **configuração que a governa**: o Server Script `Automacao cobranca config
   api` (154 linhas, só no banco), hoje **Single** — uma configuração para o SaaS inteiro, o mesmo
   defeito que o item 2 corrige na mora.
4. **PDF de contrato**: o Server Script `PDF contrato` — **752 linhas de fonte, existindo apenas no
   banco** — portado para `@react-pdf/renderer` e validado contra o golden textual, que tem **174
   linhas** de saída. O 752 é o fonte; o 174 é o que ele produz.
5. ~~**Carnê** montado com `pdf-lib` no servidor.~~ **Movido para a F4** — ver a seção dela.
6. **`locatario_email_confirmacao`** (222 LOC) — apesar do nome, **não é e-mail de cobrança**: é a
   **verificação do endereço do locatário** (double opt-in) com token. A rota de confirmação é
   pública, **sem sessão** (`allow_guest`), e a página que recebe o link vive no Frappe — ou seja, é
   **handoff**, não trabalho deste repositório.
7. **WhatsApp**: os campos permanecem no modelo porque o frontend os lê, mas o canal **não é
   implementado** — `whatsapp`/`ambos` são recusados na validação Zod, em vez de aceitos em silêncio.

**Aceitação:** o texto extraído do PDF gerado bate com a referência · o e-mail sai com o remetente e
o `reply_to` da empresa certa.

<!-- ESTADO:F3:INICIO -->
> 🔄 **em andamento** — 2 de 3 fatias · 23/23 tasks
>
> ✅ `cobranca-e-mora/v1` — 11/11 tasks
> ✅ `regua-de-cobranca/v1` — 12/12 tasks
> ⬜ `documentos-e-confirmacao/v1`
<!-- ESTADO:F3:FIM -->

---

## F4 — Integração bancária (Sicoob)

**O que é:** o porte do cliente bancário. **A homologação com o Sicoob já está feita** — certificado
e credenciais seguem válidos, então isto é trabalho de código, não espera de banco.

**Entrega:**

1. **`@sysloc/banking`** com o adaptador por provedor da ADR-0001 (que sobrevive intacta ao Frappe),
   generalizado para **meio de recebimento** (`boleto` | `pix`) — prepara o Pix sem implementá-lo.
2. **mTLS com `undici`**: certificado **por empresa**, cifrado em repouso (AES-256-GCM), com pool por
   empresa. O **fallback global é removido** — empresa sem certificado próprio falha explicitamente.
3. **Contador `seu_numero` único do SaaS**, formato `AAAAMM` + 12 dígitos. Resolve um bug que
   quebraria no primeiro dia multi-empresa.
4. **Webhook**: `persistir payload cru → responder 200 → processar assíncrono`. A empresa é derivada
   do **documento encontrado, nunca do payload**. Idempotência por identificador de baixa.
5. **A API é a fonte da verdade** — o payload não decide nada; reconciliação diária substitui o
   polling 7×/dia.
6. **Carnê** montado com `pdf-lib` **no servidor** — sai do browser, que hoje baixa N boletos.
   ⚠️ **Veio da F3** em 2026-08-10: a fonte de cada página é o **boleto emitido**, que nasce nesta
   fase. Depende dos itens 1 a 4, e o critério de pronto **não é aceitação visual**.

⚠️ **Pré-condição não resolvida:** confirmar contra boleto real que o `seuNumero` de 18 caracteres
**retorna íntegro** da API. Se truncar, uma decisão precisa ser revista **antes** desta fase.

<!-- ESTADO:F4:INICIO -->
> ⬜ **não iniciada**
>
> ⬜ `integracao-bancaria-sicoob/v1`
<!-- ESTADO:F4:FIM -->

---

## F5 — Automações agendadas

**O que é:** o que roda sozinho. O gatilho sai do cron e vai para **systemd timers**.

**Entrega:**

1. Timers versionados com **`Persistent=true`** — se o servidor estiver fora do ar na hora marcada, o
   timer dispara ao voltar, em vez de pular o dia em silêncio (que é o que o cron atual faz).
2. **Despachante por horário**: a rotina de 1 minuto faz **uma** consulta — quais empresas têm
   horário para agora — e enfileira só essas. Hoje o runner varre todas as cobranças abertas a cada
   minuto e grava na config a cada execução, o que produziu um log de 10 MB.
3. Um job por empresa ativa, com **falha isolada** e lock por (empresa, rotina).
4. Alerta de rotina atrasada, tela de saúde, e alerta de falha de envio por limite do provedor.

**Aceitação:** duas empresas com horários distintos rodam cada uma no seu · erro em A não impede B ·
rotina parada gera alerta · o instalador roda duas vezes sem duplicar entrada.

<!-- ESTADO:F5:INICIO -->
> ⬜ **não iniciada**
>
> ⬜ `automacoes-agendadas/v1`
<!-- ESTADO:F5:FIM -->

---

## F6 — Frontend religado

> ⚠️ **Esta fase é de natureza diferente das outras, e é a que mais confunde.**

**O fonte do React não está neste servidor** — ele vive na máquina local. Nenhum agente daqui escreve
uma linha dele. O que este repositório entrega é o **contrato e o mapa**:

- **`@sysloc/contracts` publicado** no GitHub privado e versionado — é o que o React importa;
- **`handoff-frontend.md`**, com o modelo de domínio camelCase, o envelope de erro, a autenticação
  por sessão e o **mapa endpoint-a-endpoint** ligando cada um dos **35 caminhos ERPNext antigos** à
  rota nova.

A religação em si — os ~100 arquivos, os specs Playwright — acontece **na máquina local, por outro
agente**. Pedir implementação de frontend aqui é gatilho de parada.

<!-- ESTADO:F6:INICIO -->
> ⬜ **não iniciada**
>
> ⬜ `frontend-religado/v1`
<!-- ESTADO:F6:FIM -->

---

## F7 — Virada e desinstalação

> ⚠️ **Partida em duas por uma fronteira que não se pode dissolver.**

### Entra no marco de entrega do backend (construção, não depende de frontend)

- **Backup e restauração**: `pg_dump -Fc` + tar dos segredos, autenticação por `.pgpass` 0600
  (**nenhuma senha em script versionado**), timer das 02:30 e — o que de fato prova — **restauração
  conferida num banco vazio**.
- **Redação** do `deploy/scripts/virada.md`, com o gate de desinstalação de 5 itens.

### Fica para uma sessão operacional futura

- **Execução** da virada: parar as rotinas do Frappe, apontar o CloudPanel para a API nova.
- **Desinstalação** do `/opt/frappe`, contêineres, volumes e as entradas de cron do root.
- **Retenção da trilha de tentativas de entrada** — a metade não acionável de um débito da F1.

**Por que a separação:** o primeiro critério de aceitação desta fase é *"app funcionando
integralmente contra o backend novo"*, e isso só é verificável com o frontend pronto — que é
implementado fora daqui. As duas metades exigem **este** servidor, porque é onde o `/opt/frappe` e o
CloudPanel existem. Essa sessão é **operação, não construção**: horas, não dias. Defeito encontrado
nela se corrige como correção; **não reabre a construção do backend**.

<!-- ESTADO:F7:INICIO -->
> ⬜ **não iniciada**
>
> ⬜ `virada-e-desinstalacao/v1`
<!-- ESTADO:F7:FIM -->

---

## Onde a construção deste repositório termina

O **marco de entrega do backend** não é a F7 inteira — é a F1–F5 concluídas, mais a superfície da API
congelada, o `@sysloc/contracts` publicado, o `handoff-frontend.md` gerado, o backup/restore provado
e o runbook da virada escrito. A lista fechada, com as caixas de verificação, está no `CLAUDE.md`.

**Fora do escopo daqui, em qualquer hipótese:** código React, arquivos na máquina local, os specs
Playwright, e a execução da virada.

---

## Features que existem no repositório e **não** são deste plano

Um alerta para quem for procurar: `docs/specs/features/` guarda também fatias do **backend Frappe
antigo**, que não fazem parte de F0–F7. São elas:

| Feature | O que é |
|---|---|
| `contencao-credencial-exposta` | a F0 do plano *Frappe*, que saiu do caminho crítico do plano novo |
| `integracao-bancaria-configuravel` | a integração Sicoob **no Frappe** — é **insumo de leitura da F4**, não a F4 |
| `backend-nativo-sysloc` | a spec do programa como um todo, anterior ao recorte em fases |

---

## Manutenção

**O painel e os blocos de estado são gerados.** Para atualizá-los:

```bash
bash deploy/scripts/roadmap/atualizar-roadmap.sh
```

Ele lê o `_run/*state.yaml` de cada fatia — que é escrito pelo próprio pipeline ao fechar uma task —
e reescreve **apenas** o conteúdo entre os marcadores `<!-- PAINEL -->`, `<!-- ESTADO:Fn -->` e
`<!-- RODAPE -->`. A prosa nunca é tocada, então rodar duas vezes é inofensivo.

**Fatia nova numa fase?** Acrescente-a ao mapa `FATIAS_DA_FASE` no topo do script, separada por `;`,
e escreva a prosa dela na seção da fase. Fatia que ainda não existe no disco é reportada como não
iniciada — o que é a informação correta, e não um erro.
