# Briefing de pré-refinamento — F4 · Integração bancária (Sicoob)

> **Entrada da skill `/agent-spec-pre-refinement`.** Este arquivo é a *ideia bruta* da F4, já
> ancorada no projeto e com o que foi possível **medir** medido. Ele não é o pré-refinamento: o
> artefato sai em `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md`, depois da
> Fase 1 (esqueleto validado com o usuário) e da Fase 2 (árvore de rumos).
>
> **Nome da feature: `integracao-bancaria-sicoob`.** ⚠️ Não confundir com
> `integracao-bancaria-configuravel`, que já existe em `docs/specs/features/` — aquela é a
> integração **no Frappe**, com seis versões e `-debits`, e é **insumo de leitura** desta fase, nunca
> a fase. Reusar o nome sobrescreveria história de outro produto.
>
> **Idioma pt-BR e modelo Opus** valem aqui e em todo subagente (`CLAUDE.md`, topo). O
> **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição.

---

## 0. Como usar este briefing

1. **Não converta este texto em escopo.** As seções 4 e 5 são *tensões a explorar*, não decisões
   tomadas; várias têm mais de uma saída defensável, e a escolha é do usuário na Fase 2.
2. **A pergunta central da fase é a partição** — ver §4. Ela deve ser respondida no pré-refinamento,
   e é a mesma classe de pergunta que a F2 e a F3 responderam nos deles.
3. **Separe FATO × `[HIPÓTESE]` × `[DÚVIDA]`.** Tudo que este briefing traz como número foi medido
   hoje (2026-08-14) e está marcado com a origem; o que é leitura minha está marcado `[HIPÓTESE]`.
4. **Fronteira**: nenhum código de frontend, aqui, em nenhuma hipótese. Ver §6.

---

## 1. O que a F4 é

O porte da integração bancária para o backend nativo — **emitir boleto, consultar, dar baixa e
conciliar** —, mais três coisas que **não existem hoje em lugar nenhum**: o **webhook** de baixa, o
**contador de `seu_numero` único do SaaS** e o **carnê montado no servidor**.

É a primeira fase do produto que **fala com um terceiro em produção**. Tudo que a F3 fez de externo
sai do sistema (e-mail); aqui o sistema **pede** algo a um provedor, sob mTLS, e **recebe** um fato
que move dinheiro.

**A homologação com o Sicoob já está feita** — certificado e credenciais válidos. Isto é trabalho de
código, não espera de banco.

---

## 2. O que já está fechado — não reabrir

Estas decisões estão registradas e **não** são tema de brainstorm. Cite-as; não as reproponha.

| # | Decisão | Onde |
|---|---|---|
| **17** | Webhook é o caminho normal de baixa; o polling cai de 7×/dia para **1×/dia** (reconciliação do dia anterior) | `.claude/plans/plano-saas-decisoes.md`, rodada 5 |
| **18** | Pix: **generalizar** o modelo para meio de recebimento (`boleto` \| `pix`) e **não implementar** a API Pix | rodada 5 |
| **19** | Baixa marca **`Paga` na hora**, com **reversão** em estorno (respeitando o vencimento). **Não** se cria estado intermediário | rodada 6 |
| **20** | **Webhook é gatilho, a API é a verdade** — consulta autenticada decide; payload forjado não produz efeito | rodada 6 |
| **21** | **URL única**; notificação que não casa com cobrança é registrada e **descartada sem chamar a API**; empresa suspensa → bloqueio **lógico** | rodada 6 |
| **23** | Contador de `seu_numero` **único do SaaS**, formato `AAAAMM` + 12 dígitos, **em linha própria** — não na configuração da empresa | rodada 7 |
| **24** | Roteamento **por `seu_numero`**; **a empresa é derivada do documento encontrado, nunca do payload**; `nossoNumero` e `numeroCliente` viram **conferência** | rodada 7 |
| **ADR-0001** | Porta `AdaptadorCobrancaBancaria` e modelo canônico; nenhum campo ou vocabulário de provedor cruza a porta | `docs/adr/0001-*.md` — `accepted`, sobrevive intacta ao Frappe |

⚠️ **Citar ADR exige abrir a `Decision`.** As linhas-resumo do `CLAUDE.md` e do `INDEX.md` são
paráfrases e já divergiram do texto real.

---

## 3. Restrições que não se negociam

- **Invariante 1** — toda tabela nova nasce com `empresa_id`, **RLS forçada** e **FK composta
  `(id, empresa_id)`**. **Invariante 3** — nenhum segredo versionado. **Invariante 4** — dinheiro em
  `numeric(15,2)`.
- **ADR-0022** (abra a `Decision`): valor derivado de configuração é derivado enquanto o fato está
  aberto e **gravado no instante que o liquida**; e *"o estado publicado de um fato financeiro é
  derivado dos fatos gravados, nunca uma coluna movida por rotina"*. **É o que a baixa tensiona** —
  ver §5.2.
- **ADR-0030**: artefato derivado é composto sob demanda e nunca armazenado — **com cláusula de
  exclusão nomeando o boleto**: *"boleto emitido pelo provedor … não é artefato derivado"*. O carnê
  cai dentro da ADR; o boleto está fora dela.
- **ADR-0029**: efeito externo cujo resultado **não compõe a resposta** sai por fila. A própria
  `Decision` diz que chamada síncrona cujo retorno o solicitante espera **permanece em linha e não é
  exceção**. Ver §5.5 — a tensão não é a que parece.
- **ADR-0028**: rota que devolve bytes permanece no contrato, declarando mídia, nome do arquivo e o
  mesmo envelope de erro. O carnê é o **segundo** consumidor dela.
- **ADR-0027**: rota de negócio dispensa sessão **apenas quando o ato é do titular do dado** e esse
  titular nunca terá sessão, sempre com portador de segredo. Ver §5.3 — **o webhook não cabe aqui**.
- **ADR-0016/0017**: contrato derivado de esquema; chave exposta é código legível onde há série
  declarada. **ADR-0011/0018**: autorização declarada por rota, com default que nega.

---

## 4. O dimensionamento — e a pergunta que ele obriga

**Medido hoje, no `/opt/frappe` de pé** (`docker compose exec -T backend`, `wc -l`, fonte sem
testes):

| Módulo legado | LOC | Maiores arquivos |
|---|---|---|
| `integracao_bancaria_api` | **1.737** | `service.py` **1.524** |
| `cobranca_sicoob` | **1.896** | `emissao.py` 468 · `sincronizacao.py` 322 · `consulta.py` 311 · `confirmacao_baixa.py` 202 · `baixa.py` 168 · `rotina_pagamentos.py` 163 · `auth.py` 148 · `sequencial.py` 113 |
| `cobranca_bancaria` (porta + adaptador) | **1.881** | `adaptadores/sicoob/mapeamento.py` 455 · `configuracao.py` 356 · `certificado.py` 266 · `modelo.py` 247 · `adapter.py` 194 · `http.py` 148 |
| **Total de fonte** | **5.514** | — |

Mais **6.499 linhas de teste**, em **15 arquivos** — e **todos os 15 tocam** um dos três módulos
acima, isto é, **a suíte do app legado é inteiramente bancária**. Isso confirma a decisão 18 (*"testes
concentrados só em integração bancária"*, que media ~4.400 linhas em 16 arquivos) e mostra que ela
**cresceu ~48% desde o levantamento** — o que muda a pergunta da §8.4 de "existe oráculo?" para "o
que este oráculo cobre?".

**A comparação que decide:** a régua de cobrança tinha **837 LOC** medidas e virou uma sub-fatia de
**12 tasks**, com run próprio. A F4 tem **6,6× isso**. A F2 inteira fez ~1.000 LOC em 2 fatias e 21
tasks; a F3, em 3 fatias e 35 tasks.

> **`[HIPÓTESE]` — a F4 não cabe num run só.** É a leitura mais provável, mas o *corte* é decisão do
> usuário, e ele é a **primeira pergunta do pré-refinamento**, não uma conclusão deste briefing.

**Dois eixos de corte candidatos**, e eles **não coincidem** — é isso que torna a pergunta real:

- **(a) Por natureza da prova** — o que **tem oráculo** (emissão, consulta, baixa, conciliação: 5.514
  LOC de fonte legado + 6.499 de teste) contra o que **não tem oráculo nenhum**. Foi o eixo que
  cortou a fatia 2 da F3, e a medição favorece: **`webhook` tem 0 (zero) ocorrências no fonte legado**
  — medido com `grep -rn webhook --include='*.py'` excluindo testes; `origem_evento` aparece em 5
  pontos, sempre com o literal `'api'`. O DocType previa `'webhook'` e **nunca foi usado**. O carnê
  também não existe no backend legado (0 ocorrências): hoje **o browser baixa N boletos** e monta
  (`levantamento-frontend.md`, linhas 88 e 114). Ou seja: **metade da F4 é porte com oráculo; a outra
  metade é construção do zero.**
- **(b) Por dependência** — a decisão 24 e o item 6 do `plano-execucao.md` §F4 declaram que o carnê
  **depende dos itens 1 a 4**: sem emissão não há boleto para concatenar. Isso dá **ordem**, e talvez
  ordem baste em vez de corte.

---

## 5. As tensões a explorar — o coração deste briefing

### 5.1 A baixa contra a fonte única do estado

**FATO.** Não existe coluna de status em `negocio.cobranca`. O estado é **derivado** na view
`cobranca_derivada` (`packages/db/migracoes/0010_seguranca_cobranca.sql`, §4), por precedência de
fatos gravados:

```
cancelado_em IS NOT NULL      → CANCELADA
pago_em      IS NOT NULL      → PAGA
data_vencimento < data_corrente_da_operacao() → VENCIDA
senão                          → A_VENCER
```

A decisão 19 manda **marcar `Paga` na hora e reverter em estorno**. Nesse modelo, "marcar `Paga`" é
gravar `pago_em`/`valor_pago`; e **"reverter" é apagar um fato que aconteceu** — a reversão para
`Vencida`/`Pendente` que a decisão descreve sai de graça pela precedência, mas **ao custo de o
sistema deixar de saber que houve uma baixa e um estorno**.

**A pergunta de produto:** onde mora a trilha do que o banco disse? A cobrança guarda o **estado**, e
o histórico bancário precisa de casa própria — o legado tinha o DocType `Cobranca Integracao Sicoob`
com `origem_evento`. Quanto dessa trilha o produto novo precisa expor, e para quem: operação,
auditoria, ou ninguém?

⚠️ **Não confunda com a ADR-0022.** A segunda cláusula dela (*"estado publicado … nunca uma coluna
movida por rotina"*) **proíbe** a saída fácil de criar um `status` gravado que o webhook escreve.

### 5.2 O webhook não cabe na ADR-0027 — e isso é uma decisão nova

**FATO.** A `Decision` da 0027 condiciona a rota sem sessão a **o ato ser exercido pelo titular do
dado**, com portador de segredo de uso único. **O Sicoob não é titular de nada**: é um terceiro
notificando um fato sobre o dado de outrem, a notificação é repetível, e o "segredo" proposto na
rodada 5b é um **token opaco por empresa na URL** — que não expira, não é de uso único e, pela
decisão 21, a URL é **única**, não por empresa.

Some-se o que a documentação do Sicoob impõe (rodada 5b): resposta **200/201/204 apenas** — `202`
**reprova** o webhook, e redirect é proibido. ⚠️ O primeiro `202` do produto nasceu na F3 (reenvio de
confirmação); aqui ele é **proibido**, e a rota tem de responder direto e síncrono.

**A pergunta:** o critério da 0027 se **estende** (ADR nova para "rota de entrada de terceiro"), se
**emenda** (precedente existe: a ADR-0024 foi emendada, não superseded, na T11 da 2b), ou o webhook
usa outra porta de entrada que não seja rota de negócio? Seja qual for a saída, `semDeclaracao`
continua vazio e a rota entra no inventário — ver §5.7.

### 5.3 A borda que a F7 ia resolver, e que o webhook antecipa

**FATO.** Três débitos com gatilho — **D23**, **D24** e **D27** (F1) — têm por gatilho declarado *"a
publicação atrás do servidor de borda na F7"*. E a rodada 5b registra que o webhook exige **HTTPS na
443, sem redirect**, enquanto **o CloudPanel é dono de 80/443** e o `/opt/frappe` segue de pé
atendendo a operação até a F7.

**A tensão:** o Sicoob só entrega numa URL pública válida. Ou a F4 **antecipa** um pedaço da
publicação de borda (e então três débitos da F1 disparam aqui, não na F7), ou o webhook é entregue
**provado por outra via** — e aí a pergunta é qual prova o usuário aceita como suficiente para uma
rota que ninguém conseguiu exercitar de fora.

> `[DÚVIDA]` — isto é decisão **operacional** com efeito no escopo, e é das poucas que podem
> justificar mexer na ordem das fases. Merece pergunta direta ao usuário na Fase 2.

### 5.4 O certificado por empresa — e a lição que a F3 pagou caro

**FATO.** O item 2 da fase manda: certificado **por empresa**, cifrado em repouso (AES-256-GCM), pool
por empresa, **fallback global removido** — empresa sem certificado próprio **falha explicitamente**.
É o primeiro segredo de **terceiro** que o produto guarda (até aqui os segredos eram do próprio
sistema, em `EnvironmentFile` 0600).

⚠️ **A lição direta da 2b:** o achado **CRÍTICO** da T9 foi um **segredo em claro alcançando o
journal por `err.command.args`** — o `bullmq` empurra `job.data` como argumento de comando Redis, o
`ioredis` o anexa ao erro, e a redação **não alcança**. A F4 põe senha de `.pfx` e material de
certificado perto exatamente dessa maquinaria. **Isso foi pego por medição, não por leitura.**

**A pergunta de produto:** quem opera o certificado? Sobe por tela (a spec legada trilhou "operar por
tela em vez de deploy"), por arquivo no servidor, ou pelo Master? E o que acontece com a cobrança de
uma empresa cujo certificado **expirou** — falha na emissão, alerta, ou bloqueio antes?

### 5.5 A emissão: lote, e não uma chamada

A ADR-0029 **já resolve o caso simples**: retorno que o solicitante espera na resposta fica em linha,
por escrito, e não é exceção. A tensão real é outra: **a emissão do produto é mensal e em lote** — a
decisão 23 fala em contenção do `FOR UPDATE` e a aceita justamente porque *"emissão é mensal e em
lote"*. Um lote de N boletos não tem "a resposta" que o solicitante espera.

**A pergunta:** o ato de negócio é *"emitir o boleto desta cobrança"* (síncrono, uma resposta) ou
*"emitir os boletos do mês"* (lote, assíncrono, com acompanhamento)? A resposta muda a superfície da
API, o desenho da fila e o que o frontend precisa saber — e o **`@sysloc/shared`** já tem o contrato
de fila (`FILA_DA_REGUA`, `FILA_DA_CONFIRMACAO`, `OPCOES_PADRAO_DA_TAREFA`) para reusar.

### 5.6 O contador único do SaaS contra o isolamento por empresa

**FATO.** As duas séries que o produto tem hoje — `CTR-{ano}-{5}` e `COB-{ano}-{7}` — são **por
`(empresa, ano)`**, atrás de funções `SECURITY DEFINER`. A decisão 23 pede o oposto: **uma sequência
para todas as empresas**, em linha própria, fora da configuração da empresa.

**A tensão:** uma tabela sem `empresa_id` num produto cujo **invariante 1** diz que toda tabela de
negócio nasce com `empresa_id` e RLS forçada. É legítimo — o contador **não é dado de negócio de
ninguém** —, mas precisa ser dito com todas as letras, porque é a primeira exceção do produto e
alguém vai querer "corrigir" depois. `[HIPÓTESE]` — é forte candidata a `DECISÃO FECHADA` no ponto do
código, e possivelmente a ADR.

### 5.7 O carnê é derivado; o boleto é fato — e o código já sabe disso

**FATO.** `negocio.cobranca` **já tem** as colunas de conciliação, e elas nascem nulas **sem
produtor**: `nosso_numero`, `linha_digitavel`, `codigo_barras`, `data_credito`, `valor_creditado` e
`boleto_arquivo`. O docblock de `boleto_arquivo` (`packages/db/src/esquema/negocio.ts:942`) já
antecipa esta fase, por escrito: *"Não confundir os dois na F4: o carnê é derivado e se compõe sob
demanda; o boleto é fato e se guarda."* **A F4 é o produtor que faltava.**

**A pergunta:** `boleto_arquivo` guarda **caminho, nunca bytes** — então onde os bytes moram, quem os
apaga, e o que acontece quando o arquivo some mas a linha existe? E o carnê, sendo derivado (0030),
recompõe-se a partir de quê quando um dos boletos do mês não foi emitido?

### 5.8 A superfície, o congelamento e a F5

**FATO.** A superfície é **89 rotas / 74 manipuladores**, `semDeclaracao` vazio, medida por dupla
medição independente (CT-732). O **congelamento da superfície é item do marco de entrega**, e ele só
pode acontecer **depois de F4 e F5** — as duas ainda publicam rota.

**A fronteira a desenhar com a F5:** a **reconciliação diária** é da F4 (o *que* reconcilia) ou da F5
(o *quando* dispara)? O `plano-execucao.md` põe o gatilho na F5 (systemd timers, `Persistent=true`) e
a lógica na F4. Vale declarar isso no pré-refinamento para a F4 não entregar timer e a F5 não
entregar regra bancária.

---

## 6. Fora do escopo — em qualquer hipótese

- **Qualquer código de frontend.** O fonte React vive na máquina local; task que peça isso é
  **gatilho de parada**. O que o carnê e o boleto exigem do frontend vira **handoff**, não trabalho
  daqui.
- **A API Pix** (`cob`/`cobv`/`lotecobv`/`pix`) — decisão 18: generaliza-se o modelo, não se
  implementa. ⚠️ E o esclarecimento da rodada 5 vale repetir: **o sistema já recebe via Pix hoje**,
  porque o boleto nasce com QR vinculado (`codigoCadastrarPIX: 1`). O que não existe é a API Pix.
- **A execução da virada e a desinstalação do Frappe** — sessão operacional futura, pós-marco.
- **Reescrever o que a F3 fechou.** A régua, a mora, a `cobranca_derivada` e os documentos estão
  fechados; a F4 os **consome**.

---

## 7. Débitos com gatilho que esta fase provavelmente dispara

Estão no índice do `CLAUDE.md`; o detalhe vive na §2 do `run-report.md` da fatia de origem. **Dois
nomeiam a F4 por escrito:**

| Débito | Gatilho declarado | Por que dispara aqui |
|---|---|---|
| **D5** (F3/T7) | *"o terceiro consumidor de extração de texto de PDF (**o carnê da F4**)"* | a prova do carnê é textual, como a do contrato |
| **D12** (F3/T10) | *"a **terceira** mensagem de e-mail do produto (**o boleto, na F4**)"* | `MensagemDeEmail` e a porta de envio sobem para `@sysloc/shared` |
| **D1** (F3/T2) | terceiro consumidor monetário de `@sysloc/contracts` | valores do boleto e do crédito |
| **D26** (F3/T8) | terceiro consumidor de aritmética de calendário | vencimento, `AAAAMM`, D0/D+1 |
| **D3** (F3/T1) | **quarto** consumidor do caminho de leitura autenticada do legado | se houver task de captura de oráculo no `/opt/frappe` |
| **D23 · D24 · D27** (F1) | *"a publicação atrás do servidor de borda na F7"* | ver §5.3 — o webhook pode antecipá-los |

---

## 8. Fatos a confirmar durante o pré-refinamento

1. ⚠️ **`seuNumero` de 18 caracteres retorna íntegro da API?** É a **pré-condição não resolvida** da
   fase, registrada no `plano-execucao.md` e no `roadmap.md`: o exemplo do Sicoob traz `"00-03"`, e a
   decisão 24 aposta no campo como **chave de roteamento**. Se truncar, **a decisão 24 precisa ser
   revista antes da fase**. ⚠️ **Precedente que vale citar**: na F3, uma premissa que bloqueava a task
   de prazo foi derrubada por **quatro comandos** — *"premissa que bloqueia trabalho com prazo merece
   ser medida antes de ser registrada"*. Esta se confirma consultando **um boleto real** pela API.
2. **`codigoMotivoCancelamento: 2`** — aparece no payload de exemplo e **não consta** na lista
   documentada (que começa em 11). Pendência **do usuário** com o Sicoob (decisão 22); não bloqueia o
   plano, mas define o que o produto faz com motivo desconhecido.
3. **A homologação segue válida?** Certificado e credenciais foram declarados válidos; confirmar a
   validade **por data**, não por memória.
4. **O que do legado tem oráculo utilizável.** São 6.499 linhas em 15 arquivos, **todas bancárias**
   (§4) — `[DÚVIDA]` se elas servem de oráculo (como o `regua-de-cobranca.json` serviu) ou se o
   oráculo precisa ser capturado antes do desligamento. ⚠️ Se precisar ser capturado, **é task de
   prazo** e vem primeiro na fatia — o precedente são a T1 da `cobranca-e-mora` e a T1 da
   `regua-de-cobranca`, as duas fechadas antes de o Frappe cair.

---

## 9. Critérios de saída deste pré-refinamento

O pré-refinamento está pronto quando responder, com o usuário no loop:

1. **A F4 se parte?** Em quantas fatias, por qual eixo (§4), em que ordem — e **por quê**.
2. **Onde mora a trilha bancária** e o que o estado derivado publica (§5.1).
3. **Como o webhook entra** sem contrariar a ADR-0027, e se isso é ADR nova, emenda ou outra coisa
   (§5.2) — a skill deve sinalizar candidato a ADR, **nunca criá-la**.
4. **O que se faz sobre a borda pública** (§5.3), inclusive a possibilidade de antecipar F7.
5. **Quem opera o certificado** e o que acontece quando ele falha (§5.4).
6. **A unidade do ato de emissão** — uma cobrança ou o lote do mês (§5.5).
7. **A fronteira com a F5** — o que é regra bancária e o que é agendamento (§5.8).
8. **O que fica fora**, com motivo registrado.

---

## 10. Observações de método

- **Prescrição de gate é hipótese, não ordem.** Precedente estabelecido na 2b: por três vezes o
  executor divergiu **declarando e medindo**, e nas três o gate lhe deu razão — numa delas o Gate 1
  **se retratou por escrito** depois de reproduzir o experimento.
- **Os três achados de segurança da 2b vieram de MEDIÇÃO, nenhum de leitura.** Numa fase que move
  dinheiro e guarda certificado de terceiro, isto não é anedota — é o método.
- **Meça a suíte por pacote** (`pnpm --filter @sysloc/<pacote> test`): o `turbo run test` aborta os
  pacotes irmãos. E rode `rm -rf /tmp/sysloc-banco-*` entre execuções — o disco está em ~96% e
  `No space left on device` **se disfarça de teste vermelho**.
- **O `/opt/frappe` é produção.** Consultá-lo é legítimo (`docker compose exec -T backend …`); nada
  destrutivo. As medições da §4 foram obtidas exatamente assim, somente com leitura.
