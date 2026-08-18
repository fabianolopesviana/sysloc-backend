# Tech Alignment — `emissao-e-conciliacao` v1

- **Feature / versão**: `emissao-e-conciliacao` / `v1` — fatia (ii) da F4
- **Framework**: SDD · **Variante**: backend
- **Definição de entrada**: `docs/prds/features/emissao-e-conciliacao/v1/prd.md` (aprovado 2026-08-16)
- **Discovery lido**: `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md`, **incluindo
  a emenda §13-A de 2026-08-16** (vinculante sobre a §13). Não há `pre-refinement.md` sob o diretório
  desta feature: o discovery é o da fase, compartilhado pelas três fatias.
- **ADRs consultadas** (texto integral da `Decision`, não a linha-resumo): 0001 **com a emenda de
  2026-08-15**, 0022, 0028, 0029, 0030, 0031, 0032
- **Data**: 2026-08-16 · **Status**: decidido

---

## Contexto técnico

A fatia (i) entregou a fronteira de **identidade** com o provedor — `PortaDeIdentidadeBancaria`,
`MeioDeRecebimento`, leitura de material e o adaptador de aperto de mão. A porta de **operação de
cobrança** não existe: o nome `AdaptadorCobrancaBancaria` está reservado pela ADR-0001 às cinco
operações que ela nomeia (`obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`,
`consultar`), e é esta fatia que o faz nascer no backend nativo.

Três propriedades do terreno condicionam tudo o que segue. **Primeira**: a operação de cobrança
precisa do material do certificado decifrado, e a chave que o abre é o segredo mais forte do sistema
— hoje declarada apenas no ambiente da API. **Segunda**: o provedor é **assíncrono na retirada** —
o legado documenta por escrito que a baixa pode não ter refletido, e trata isso como sucesso com
confirmação negativa —, o que colide com o invariante do PRD de que apenas um boleto seja pagável.
**Terceira**: a trilha bancária é publicada por rota, e a medição do legado mostra que **1.837 dos
1.864 eventos são consultas sem efeito** — registrar contato em vez de efeito reproduziria na trilha
exatamente a distorção que esta fase existe para corrigir.

---

## Soluções técnicas decididas

### D1 — Onde a emissão em lote executa, e como o material chega até lá

**Decidido: A2 — executar no processo de trabalho, com a carga da tarefa levando apenas
identificadores.**

- **A1 — lote em linha no processo da borda**, em segundo plano. _Exemplo:_ a rota aceita a
  competência e itera sem devolver o resultado. _Contras:_ não sobrevive a reinício, não tem
  repetição, e a emissão do mês é justamente o que não pode ser perdido no meio.
  _Viabilidade:_ **conflita com a ADR-0029**, cuja `Decision` enfileira todo efeito externo cujo
  resultado não compõe a resposta do pedido.
- **A2 — processo de trabalho** (decidida). _Exemplo:_ a carga leva empresa e competência, e nada
  mais; o processo resolve certificado e cobranças pelo banco, sob o contexto de tenant.
  _Prós:_ repetição e sobrevivência a reinício de graça; é o padrão já estabelecido — a tarefa da
  régua carrega **apenas `empresaId`**, e o docblock declara que isso é *"disciplina de quem
  enfileira"*. _Viabilidade:_ reusa `apps/worker`, `OPCOES_PADRAO_DA_TAREFA` e o contrato de fila de
  `@sysloc/shared`. **Requer** declarar a chave de cifra no ambiente fechado do processo de trabalho
  — que já a **recebe fisicamente**, pelo `EnvironmentFile=/etc/sysloc/backend.env` compartilhado
  entre as duas unidades; o que falta é consumo declarado, e a assimetria atual é deliberada e está
  registrada por escrito nos dois lados.
- **A3 — a carga transporta o material cifrado ou o segredo.** _Contras:_ é **o vetor exato do achado
  crítico da fase anterior** — a biblioteca de fila empurra a carga como argumento de comando ao
  servidor de fila, o cliente a anexa ao erro, e a redação não alcança. _Viabilidade:_ **rejeitada
  por ADR-0032**, cuja `Decision` proíbe o segredo retornar por superfície alguma e exige que a
  ausência de vazamento seja afirmada por medição da saída real.

**Trade-off aceito**: a superfície que pode decifrar o segredo mais forte passa de um processo para
dois. Em contrapartida o material **não trafega pela fila**, e esta fatia é a que **mede** essa
superfície: o débito **D58 · F4/T13** a nomeia como o item 14 da enumeração da ADR-0032, hoje não
medido por não existir carga de tarefa. **O D58 fecha aqui.**

### D2 — Granularidade da tarefa do lote

**Decidido: B1 — uma tarefa por lote, percorrida em sequência.**

- **B1 — uma tarefa por lote** (decidida). _Exemplo:_ a tarefa recebe empresa e competência, reúne o
  conjunto e percorre. _Prós:_ a **RN-02** (falha da empresa interrompe o lote) é natural, porque só
  quem tem o conjunto pode interrompê-lo; a repetição da tarefa é segura porque a **RN-03** já a torna
  idempotente — reexecutar tenta apenas quem ainda não tem boleto.
- **B2 — uma tarefa por cobrança.** _Exemplo:_ 47 tarefas independentes. _Prós:_ isolamento de falha e
  repetição fina. _Contras:_ certificado vencido produziria **47 falhas idênticas** — precisamente o
  que a RN-02 existe para evitar —, e interromper exigiria cancelar em massa as pendentes.
  _Viabilidade:_ tecnicamente possível, mas exige coordenação que a feature não pede.
- **B3 — tarefa coordenadora despachando subtarefas.** _Contras:_ soma os dois modelos e a
  complexidade de ambos. _Viabilidade:_ rejeitada por YAGNI — a feature não cobra esse trade-off.

**Trade-off aceito**: uma cobrança lenta atrasa as seguintes do mesmo lote. Aceitável — a emissão é
mensal, e a medição do legado mostra 22 emissões para 16 cobranças ao longo de toda a operação.

### D3 — A retirada de boleto contra um provedor assíncrono

**Decidido: C2 — pedir a retirada, sondar a confirmação por tempo limitado, e emitir o novo apenas
depois de confirmada.**

- **C1 — pedir e emitir em seguida.** _Contras:_ durante a janela em que o provedor ainda não
  refletiu, **os dois boletos ficam pagáveis** — quebra o invariante da CA-05. A janela não é
  hipótese: o legado a documenta como desfecho normal (*"baixa ainda não refletiu"*, tratado como
  sucesso com confirmação negativa).
- **C2 — sondar a confirmação antes de emitir** (decidida). _Exemplo:_ pedida a retirada, o produto
  consulta a situação até o limite declarado; confirmada, emite; não confirmada, **falha declarando
  que a retirada foi pedida e o novo não foi emitido**. _Prós:_ é exatamente o desfecho que a
  **CA-06** já prevê, e preserva o invariante em vez de negociá-lo. _Viabilidade:_ usa as duas
  operações que a ADR-0001 já reserva na porta (`solicitar_baixa` e `confirmar_baixa`), compostas
  num único ato de domínio; o limite é constante nomeada, nunca espera fixa, pela convenção de
  determinismo de `.claude/rules/testing-stack.md`.
- **C3 — persistir um estado intermediário de retirada pendente**, com retomada posterior.
  _Contras:_ grava marca de processo, quando a **ADR-0022** manda derivar estado dos fatos; e cria um
  estado que a operação precisaria aprender a interpretar.

**Trade-off aceito**: a reemissão passa a poder demorar alguns segundos ou falhar declaradamente. Em
troca, **em nenhum instante existem dois boletos pagáveis** — e o estado que sobra (cobrança sem
boleto) é resolvido pela conferência seguinte sem intervenção.

### D4 — O que a trilha bancária registra

**Decidido: D2 — evento por mudança de estado e por desfecho anômalo; contato sem efeito não vira
evento.**

- **D1 — todo contato com o provedor vira evento.** _Contras:_ **medido**: no legado seriam 1.837 de
  1.864 eventos (98,6%) puramente consultas sem efeito. A trilha é o que a rota de histórico publica
  (US-08), e enterrar o que importa sob a varredura é reproduzir na leitura a distorção que a fase
  veio corrigir.
- **D2 — efeito e anomalia** (decidida). _Exemplo:_ emissão, retirada, liquidação, estorno,
  divergência de valor e recusa geram evento; a conferência diária que encontra tudo como estava não
  gera nenhum. _Prós:_ a trilha responde exatamente a pergunta que o PRD lhe atribui — *por que esta
  cobrança está assim*.
- **D3 — registrar tudo e filtrar na leitura.** _Contras:_ paga o custo de escrita e de crescimento
  sem o benefício, e filtro de leitura é decisão que se perde na primeira consulta nova.

**Trade-off aceito**: a trilha deixa de provar que a conferência rodou e nada mudou. Isso é
informação **operacional** da cobrança, não fato de negócio — a forma de registrá-la é do TECH_SPEC.

**Candidata a ADR** — ver abaixo.

### D5 — Obtenção e reaproveitamento da credencial de acesso ao provedor

**Decidido: E1 — cache em memória por processo, chaveado por empresa, renovado por expiração.**

A credencial expira em **300 s** (medido na §13-A.4 do discovery), e dois processos passam a operar
contra o provedor.

- **E1 — cache por processo** (decidida). _Prós:_ nenhuma infraestrutura nova; a validade curta é
  tratada por expiração, não por invalidação. _Contras:_ os dois processos mantêm caches
  independentes. _Viabilidade:_ no pior caso 2 obtenções por empresa a cada 5 minutos — irrisório
  frente às ~420 mil chamadas/dia do polling que esta fase elimina.
- **E2 — cache compartilhado no servidor de fila.** _Contras:_ passa a guardar credencial de acesso
  viva na mesma infraestrutura cujo cliente **já vazou segredo por anexação ao erro** na fase
  anterior. Ganho operacional nulo, risco real.
- **E3 — obter a cada operação.** _Contras:_ num lote de 47 boletos, 47 obtenções desnecessárias.

**Fecha o D36 · F4/T10**: `client_id` e `scope` passam ao envelope cifrado, a sonda de identidade da
fatia (i) sobe para a obtenção real de credencial, e o desfecho positivo dela perde a ressalva de
alcance que o marcador registra.

### D6 — Onde os bytes do boleto moram e quem os provisiona

**Decidido: F1 — diretório próprio no host, provisionado pela instalação, com o caminho vindo do
ambiente.**

Responde a `[DÚVIDA] 5` do discovery, que a deixou explicitamente aberta.

- **F1 — diretório no host** (decidida). _Prós:_ a coluna guarda **caminho, nunca bytes**, que é o
  que o esquema já declara por escrito; o arquivo é **cache recuperável** (direção E3 do discovery),
  então a perda não é dano. _Viabilidade:_ **requer fechar a lacuna de provisionamento que o D39 da
  F1 sinaliza** — diretório, dono e permissão entram na instalação, e a origem entra no backup do
  item 1 da F7.
- **F2 — bytes no banco.** _Contras:_ contraria a decisão já escrita no esquema e infla o backup.
- **F3 — não guardar, rebuscar sempre.** _Viabilidade:_ **conflita com a ADR-0030**, cuja cláusula de
  exclusão nomeia o boleto — *"boleto emitido pelo provedor … não é artefato derivado"* — e com o
  docblock do esquema, que fixa *"o boleto é fato e se guarda"*.

---

## Candidatas a ADR

**Uma**, decorrente de D4 — *trilha de integração com terceiro registra efeito, não tentativa*. É
transversal: a fatia (iii) enfrentará a mesma pergunta para a notificação recebida, e qualquer
integração futura também. Registrar impede que a próxima fatia decida ao contrário sem saber que houve
decisão.

```bash
/agent-spec-adr-create "trilha de integracao com terceiro registra efeito, nao tentativa"
```

> A skill de ADR revalida os critérios — esta skill sinaliza e **não cria**.

As demais decisões são feature-scoped ou já cobertas: D1 e D5 aplicam a ADR-0032 sem estendê-la; D3
compõe operações que a ADR-0001 já reserva; D6 aplica a cláusula de exclusão da ADR-0030.

---

## Restrições e invariantes técnicas

Herdadas, não reabertas — qualquer implementação as respeita:

- **ADR-0001 + emenda de 2026-08-15**: o nome `AdaptadorCobrancaBancaria` é **reservado** à porta das
  cinco operações nomeadas, e é esta fatia que a institui. Nenhum campo, URL ou vocabulário do
  provedor cruza a porta — exigível **por medição**. A porta irmã de identidade da fatia (i) é
  conforme e não se funde a esta.
- **ADR-0029**: o lote vai por fila; a emissão unitária permanece **em linha e não é exceção**,
  porque o solicitante espera o resultado na própria resposta.
- **ADR-0032**: o material cifrado de forma reversível, a chave fora da árvore versionada e fora do
  pacote que salvaguarda o material, nada retornando por superfície alguma, e a ausência de vazamento
  afirmada **por medição da saída real com controle positivo** — nunca por leitura do código.
- **ADR-0022**: o estado da cobrança permanece **derivado dos fatos**; nenhuma coluna de status.
- **ADR-0028**: a rota que devolve bytes declara mídia e nome de arquivo e mantém o mesmo envelope de
  erro.
- **Invariantes do projeto**: a trilha roteada nasce com `empresa_id`, RLS habilitada nas duas
  direções e FK composta (invariante 1); o contexto de tenant nunca é lido do pedido (invariante 2);
  dinheiro em `numeric(15,2)` (invariante 4).
- **Determinismo**: espera por estado observável é sondagem com **limite nomeado**, nunca pausa fixa.
- **Protocolo Antirregressão**: baseline medida **por pacote** antes e depois; `turbo run test` aborta
  os pacotes irmãos e não dá contagem confiável.

**Débitos com gatilho que esta fatia dispara** — o **D58** e o **D36** nomeiam a fatia (ii) por
escrito, e o **D27 · F4/T8** teve o gatilho emendado para ela. Os demais (D25, D1, D26) se conferem
contra o diff no TECH_SPEC; o marcador sai no mesmo commit da correção, e a linha correspondente do
índice do `CLAUDE.md` junto.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

- O **limite da sondagem** de confirmação da retirada (D3) — o valor, e o que fazer com a cobrança
  que ficou sem boleto além de declará-lo.
- A **forma de registrar a última conferência** de uma cobrança (D4), já que ela deixa de ser evento.
- A **política de expurgo** do diretório de boletos (D6) e a forma exata do provisionamento.
- O **conjunto de tipos de evento** da trilha e sua granularidade.
- A **contagem exata da superfície publicada**, por dupla medição independente — o PRD já declara que
  ela cresce **acima da estimativa do discovery** (5 previstas, mais retirar de circulação e entregar
  o boleto).

**Dependências externas — sinalizadas, não decididas aqui:**

- **A renovação do certificado A1**, que vence em **2026-08-22**. Decisão do usuário registrada no
  PRD §9: assumir a renovação. Sem ela nada desta fatia opera contra o provedor.
- **O esclarecimento do motivo de cancelamento não documentado** com o provedor (decisão 22). **Não
  bloqueia**: a RN-15 do PRD torna motivo desconhecido inócuo por construção — ele é registrado como
  diagnóstico e não vira regra.

**Observação fora do escopo** (não vira proposta): a integração está **desligada em produção desde
2026-07-21**, com o arquivo do certificado renomeado (§13-A.3 do discovery). Nada disso é alterado
por esta fatia — o sistema antigo segue atendendo a operação até a F7.
