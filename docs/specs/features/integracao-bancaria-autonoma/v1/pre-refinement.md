# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

> ### ⚠️ Autonomia do run (A1) — nenhuma pergunta foi feita ao usuário
>
> `.claude/rules/autonomia-do-run.md` é **autorização permanente e de escopo universal**: onde o
> `SKILL.md` manda `AskUserQuestion` e pausar — a validação do esqueleto na Fase 1, a convergência de
> cada ramo na Fase 2, o versionamento —, a conduta é **decidir pela recomendada, registrar a razão e
> seguir**. As decisões auto-resolvidas estão marcadas **`(A1)`** ao longo da seção 4 e consolidadas
> na seção 14. Nenhuma delas contraria marcador `DECISÃO FECHADA` ou ADR ativa; onde houve tensão com
> decisão registrada, a escolhida foi a **conservadora**, como a rule manda.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `integracao-bancaria-autonoma` — F5, fatia (i)
- **Fonte da ideia**: `docs/specs/features/integracao-bancaria-autonoma/v1/insumo-do-pre-refinamento.md`
- **Autor**: sysloc (usuário) · discovery conduzido por `/agent-spec-pre-refinement`
- **Data**: 2026-08-21
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**:
  - `docs/plano-backend-novo/plano-execucao.md` §F5 (i) — as duas frentes, entregas e aceitação
  - `docs/specs/features/fundacao-bancaria/v1/_run/run-report.md` §2, `D64` — o débito da frente B, agravado em 2026-08-21
  - `docs/specs/features/webhook-e-carne/v1/` — a recepção da notícia, já implementada
  - `docs/specs/features/automacoes-agendadas/v1/insumo-do-pre-refinamento.md` — a fatia (ii), que roda **depois** desta
  - `docs/plano-backend-novo/levantamento-frontend.md` §8.3 — o que o handoff precisa saber que ainda vai mudar
  - `deploy/scripts/borda/prompt-de-ativacao-do-webhook.md` — o runbook da borda em produção
  - `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` — o roteiro de conversão já provado

---

## 2. Ideia Resumida (uma frase)

**Tirar do terminal as duas únicas coisas da integração bancária que ainda exigem alguém logado no
servidor** — ativar o webhook do provedor por cliente e aceitar o certificado no formato em que a
Autoridade Certificadora o entrega —, para que o Admin da imobiliária resolva as duas sozinho, pela
tela.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

> Os 5 rumos de alto nível que enquadram a feature do ponto de vista de produto. Cada ramo é uma
> dimensão a explorar, não um requisito fechado.

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | A forma da conversão do material legado — a arquitetura em aberto | explorar **(A1)** |
| B | A cerimônia do ato de ativar — quem pode, e com que chave | explorar **(A1)** |
| C | A vida do estado do webhook — persistência, recusa, reconferência | explorar **(A1)** |
| D | O que a tela promete e o que ela confessa | explorar **(A1)** |
| E | A fronteira do congelamento — o que **não** entra, e some da lista | adicionado pela skill **(A1)** |

**`(A1)` — decisão auto-resolvida:** explorar os cinco. As **sete perguntas abertas** do insumo §6.2
se distribuem em A–D sem sobra (1 e 7 → D; 2 e 5 → B; 3 e 4 → C; 6 → C e D), e a decisão de
arquitetura da §6.1 é o ramo A inteiro. O **ramo E não foi pedido** e foi acrescentado porque esta é
a última fatia da integração bancária que acrescenta rota: o que não for decidido aqui não tem onde
nascer depois. _Razão da recomendação: nenhum ramo é dispensável, e o E é barato — o desfecho
esperado dele é "nada novo entra", registrado com o porquê._

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — A forma da conversão do material legado

> A única **decisão de arquitetura não tomada** da fatia (insumo §6.1; `plano-execucao.md` §F5,
> frente B). Medido: a AC entregou em `RC2-40-CBC` nas **duas emissões consecutivas** — julho/2025 e
> agosto/2026 —, o OpenSSL 3 recusa a cifra por padrão e o Node 24 falha com
> `ERR_CRYPTO_UNSUPPORTED_OPERATION`.

**Direções candidatas:**

- **A1 — Reembalar no servidor, invocando o `openssl` do host a partir do produto**: a rota de
  registro detecta o material que o runtime não abre, reembala em cifra moderna e grava o resultado,
  preservando o par certificado/chave.
  - _Exemplo:_ o Admin envia o `.pfx` que a AC mandou; a rota tenta abrir, recebe
    `ERR_CRYPTO_UNSUPPORTED_OPERATION`, reembala, confere que **série, titular e validade** são
    idênticos aos do enviado, cifra o material convertido e responde `201` com
    `materialConvertido: true`.
  - _Viabilidade:_ **o roteiro já está provado e versionado** —
    `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` faz exatamente isto, é
    idempotente **por medição** (pergunta ao runtime do produto, não ao `openssl`), lê a senha por
    **descritor de arquivo** e mantém a chave em claro apenas num pipe entre dois processos, sem tocar
    o disco. O que a fatia acrescenta é a guarda de execução: caminho absoluto do binário, sem shell,
    teto de tempo, e a saída fora do diário. Custo baixo, e nenhuma dependência nova no manifesto.
- **A2 — Ligar o provider legado do Node** (`--openssl-legacy-provider` na unidade systemd).
  - _Exemplo:_ uma linha no `ExecStart` da `sysloc-api.service` e o `lerMaterial` passa a abrir RC2
    sem que uma linha de TypeScript mude.
  - _Viabilidade:_ custo baixíssimo e **risco desproporcional** — habilita cifra fraca **no processo
    inteiro**, que é o mesmo que decifra todo segredo operável do produto (ADR-0032). O `D64`
    recomenda por escrito **recusar**, e a razão registrada é essa.
- **A3 — Biblioteca de PKCS#12 em JavaScript** (ex.: `node-forge`).
  - _Exemplo:_ o produto analisa o PFX em JS puro e o reexporta com cifra moderna, sem processo
    externo e sem provider global.
  - _Viabilidade:_ custo médio; **traz código de criptografia de terceiro para o caminho do segredo** e
    acrescenta dependência ao manifesto. O `CLAUDE.md` registra o precedente oposto — o `undici` foi
    **avaliado e recusado** em favor do cliente nativo, com a razão no docblock do adaptador.

**Direção escolhida (A1)**: **A1 — reembalar invocando o `openssl` do host**, com escopo cirúrgico:
a conversão acontece **apenas na borda de registro**, nunca no caminho de uso do material; o que se
cifra e guarda é o **convertido**; o original nunca é persistido. _Razão:_ é a única das três que não
alarga a superfície do processo (A2) nem o conjunto de código que toca o segredo (A3), e o roteiro
que ela executa já está provado contra o material real.

**Podadas / adiadas**:
- **A2 — podada.** Compra conveniência com superfície, e o `D64` já registra a recusa.
- **A3 — adiada, com gatilho.** Volta se o `openssl` deixar de estar garantido no host, ou se a guarda
  de processo externo se mostrar cara demais na tech spec.

> ⚠️ **Consequência que muda a recomendação de framework:** *"o produto passa a executar processo
> externo"* é **decisão arquitetural transversal nova** — não existe precedente dela nesta base, e ela
> vale para todo caminho futuro que precise de uma ferramenta do host. Ela deve ser registrada em
> **ADR própria antes** do PRD (ver §15.4). Isto **não** contradiz o insumo §5.3: aquele item declara
> que **a porta irmã de webhook** não exige ADR nova, o que segue verdadeiro; a decisão nova é a da
> frente B, que o próprio insumo §6.1 declara em aberto.

---

### Ramo B — A cerimônia do ato de ativar

> Responde às perguntas **2** (*"ativar o webhook é ato sensível?"*) e **5** (*"quem pode ativar?"*)
> do insumo §6.2.

**Direções candidatas:**

- **B1 — Reusar as chaves do certificado**: `AREA_DAS_INTEGRACOES_BANCARIAS` **mais**
  `ACAO:configurar_integracao`, o par que já governa registrar certificado e registrar identidade.
  - _Exemplo:_ `@ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)` na rota de
    ativação, exatamente como em `identidade.controller.ts:71` e `certificado.controller.ts:293`.
  - _Viabilidade:_ **reusa integralmente**. A chave existe no catálogo fechado
    (`packages/auth/src/catalogo-de-permissoes.ts:112`), **nenhuma chave nova nasce** (ADR-0011), e o
    `plano-execucao.md` §F5 já prescreve *"com as mesmas chaves do certificado"*. O decorador
    **plural** é obrigatório: o singular no método **apaga a área da classe em silêncio**, e isso está
    registrado no docblock do `certificado.controller.ts`.
- **B2 — Chave de ação nova** (`ACAO:ativar_webhook`), concedível à parte.
  - _Exemplo:_ um perfil que configura o certificado mas não ativa webhook.
  - _Viabilidade:_ exige tocar o **catálogo fechado** da ADR-0011 e mexer na `versaoPermissoes` da
    sessão gorda. Ganha uma granularidade que **ninguém pediu** e que não corresponde a papel real: os
    dois atos são da mesma tela e do mesmo responsável.
- **B3 — Restringir ao Master** (operador do SaaS).
  - _Exemplo:_ o Admin abre chamado e o operador ativa pelo painel `syslocadmin`.
  - _Viabilidade:_ **contraria o problema que a fatia existe para resolver** e é impossível por
    invariante — o cadastro no provedor usa o certificado e o identificador **daquele cliente**, e o
    Master não os alcança.

**Direção escolhida (A1)**: **B1**, para as **duas** rotas — a de ativar e a de consultar o estado.
_Razão:_ é o que o plano prescreve, é o que o precedente do certificado faz, e a exigência da `ACAO`
(e não só da área) responde a pergunta 2 com **sim: é ato sensível** — ele muda como o dinheiro chega
ao produto, e a ADR-0021 reserva a chave de ação exatamente para isso.

**Podadas / adiadas**:
- **B2 — podada**, com gatilho de reconsideração: volta se aparecer perfil que configure integração
  sem poder ativar webhook.
- **B3 — podada.** É a poda que mais importa registrar: ela é a descrição do problema, não uma
  solução dele.

> **Sobre a trilha (ADR-0034):** a ativação **muda estado** e a recusa é **desfecho anômalo** — as
> duas são *efeito*, e entram na trilha publicada. A tentativa que **nada mudou** (reconsulta que
> confirma o que já estava gravado) **não** entra. O registro operacional de diagnóstico segue livre
> para registrar todo contato, e a ADR diz isso explicitamente.

---

### Ramo C — A vida do estado do webhook

> Responde às perguntas **3** (*"o estado precisa ser reconferido sozinho?"*) e **4** (*"a recusa fica
> registrada por quanto tempo?"*) do insumo §6.2.

**Direções candidatas:**

- **C1 — Estado persistido por empresa, com o desfecho da última tentativa; a reconferência é sob
  demanda, pelo botão.**
  - _Exemplo:_ tabela nova com dono-empresa, RLS e chave composta, guardando a situação e o **motivo
    íntegro** da última tentativa — código, mensagem e todos os campos que o provedor devolveu. O
    `GET` devolve o que está gravado, sem falar com o provedor. O cliente que tem a vaga ocupada por
    sistema de terceiro vê a recusa `10260` do provedor, com o texto dela, dias depois de ter clicado.
  - _Viabilidade:_ é a entrega **4** do `plano-execucao.md` (*"a recusa é dado, não exceção"*).
    Multi-tenancy pelo banco é o Invariante 1 e o padrão da casa; a ADR-0031 **não** se aplica (a
    tabela tem dono-empresa). Requer migração nova.
- **C2 — Sem persistência: cada `GET` consulta o provedor ao vivo.**
  - _Exemplo:_ abrir a tela de integrações dispara o aperto de mão mútuo e uma consulta ao Sicoob.
  - _Viabilidade:_ **contraria a entrega 4** — a recusa não sobreviveria à requisição, e a tela não
    teria o que mostrar quando o provedor estivesse fora. Cada abertura de tela custaria token e mTLS.
- **C3 — Persistido **e** reconferido sozinho, periodicamente** — o provedor pode desativar um webhook
  que falha demais, e o produto descobriria sem ninguém abrir a tela.
  - _Exemplo:_ rotina diária reconsulta o cadastro de cada empresa; se caiu, a tela já mostra
    **Desabilitado** com o motivo na próxima visita.
  - _Viabilidade:_ **é literalmente o domínio da fatia (ii)**, `automacoes-agendadas/v1`, que roda em
    seguida e cujo insumo §5.4 já prevê **rota de estado das rotinas por tenant**. Fazer aqui
    duplicaria a maquinaria de agendamento que ainda não existe.

**Direção escolhida (A1)**: **C1 agora; C3 adiado para a fatia (ii)**, com o gancho declarado por
escrito nesta fatia para que a seguinte o encontre. _Razão:_ além de C3 pertencer ao domínio da (ii),
**a urgência dele é baixa por construção** — a degradação é primeira classe, e webhook morto não
perde dinheiro, só velocidade: a conferência diária continua liquidando e estornando.

**Podadas / adiadas**:
- **C2 — podada**, por contrariar a entrega 4.
- **C3 — adiada para `automacoes-agendadas/v1`**, com o gancho registrado.

> **A resposta à pergunta 4, explicitamente:** o motivo da última tentativa **não expira por tempo** —
> ele é **substituído** pela tentativa seguinte, porque o campo guarda *a última*, não um histórico. O
> histórico de efeitos vive na trilha (ADR-0034). _Razão da escolha (A1):_ política de retenção com
> prazo seria inventar um requisito que ninguém pediu, e o dado é pequeno e por empresa.

---

### Ramo D — O que a tela promete e o que ela confessa

> Responde às perguntas **1** (*"o que a tela mostra quando o material foi convertido?"*), **6**
> (*"o que acontece na renovação com webhook já ativo?"*) e **7** (*"a tela deve oferecer
> desativar?"*) do insumo §6.2.

**Direções candidatas:**

- **D1 — Transparência declarada**: a resposta do registro diz que o material foi convertido, e as
  três causas de recusa produzem **três desfechos distintos**, classificáveis pelo código do envelope.
  - _Exemplo:_ o Admin envia o `.pfx` da AC e lê *"o arquivo enviado estava num formato antigo e foi
    convertido para o produto conseguir usá-lo; o titular, a série e a validade não mudaram"*. Se a
    senha estiver errada, lê outra coisa; se o certificado estiver vencido, outra ainda — hoje as três
    dizem a mesma frase, culpando a senha, e isso **custou uma rodada de diagnóstico ao operador**,
    medido em 2026-08-20.
  - _Viabilidade:_ o envelope de erro único é a ADR-0017 e a §8.2(1) do levantamento manda
    **classificar pelo código, nunca pela mensagem**. A saída da projeção do certificado é **aberta**
    (`z.object`, `.claude/rules/contrato-publicado.md`), de modo que o campo novo não quebra o
    contrato. Fecha o `D64`.
- **D2 — Silêncio**: converter e não contar.
  - _Exemplo:_ o Admin envia, funciona, e ele nunca sabe que o arquivo guardado por ele não é byte a
    byte o que o produto usa.
  - _Viabilidade:_ barato e **contraria a entrega 3 da frente B**. Corrói a confiança no registro
    justamente na renovação seguinte, quando o Admin não entender por que "daquela vez funcionou".
- **D3 — Oferecer desativar o webhook pela tela.**
  - _Exemplo:_ um botão "Desabilitar" ao lado do "Habilitar".
  - _Viabilidade:_ **impossível, e é medido** — não existe escopo `webhooks_exclusao`; a concessão
    recusa com `invalid_scope`. O provedor só oferece inclusão, consulta e alteração. Prometer
    desativar seria prometer o que o provedor não dá.

**Direção escolhida (A1)**: **D1**, mais a **declaração da degradação na própria tela** — *"o produto
funciona sem o webhook"* —, que é a entrega 5 e **já está implementada**: a fatia declara e testa, não
constrói. **D3 é podada e vira restrição a carregar no handoff.**

**Podadas / adiadas**:
- **D2 — podada**, por contrariar a entrega 3.
- **D3 — podada por impossibilidade medida.** Registrar a razão importa mais que a poda: sem ela,
  a próxima leitura da tela vai pedir o botão de volta.

> ### A resposta à pergunta 6 — **DECIDIDA pelo usuário em 2026-08-21**
>
> **Assume-se que o cadastro SOBREVIVE à troca do certificado — e o produto deixa de depender
> disso.** O cadastro no provedor é recurso do `numeroCliente` e guarda URL, tipo de movimento e
> período; o certificado é credencial de **transporte** do mTLS, não campo do cadastro, e renová-lo
> não muda `numeroCliente` nem `client_id`. Na direção em que o webhook de fato opera — o provedor
> chamando a nossa URL —, quem apresenta certificado é **ele**, não o produto.
>
> **Mas "provável" não é "medido", e a decisão não para na premissa:** o **registro de certificado
> novo dispara uma reconsulta do estado do webhook**, cujo resultado grava o estado. É
> **best-effort** — reconsulta que falha **não** faz o registro do certificado falhar: grava-se o
> motivo e preserva-se o estado anterior. _Custo:_ uma consulta, dentro do fluxo em que já se tem
> certificado válido em mãos. _Ganho:_ se a premissa estiver errada, o produto descobre **no mesmo
> ato**, e a tela mostra Desabilitado com o motivo — sem que ninguém precise saber que a dúvida
> existiu.
>
> **Alternativas rejeitadas:** marcar *"precisa reconfirmar"* a cada renovação inventaria estado novo
> na máquina de estados e mentiria nas vezes — a maioria — em que o cadastro sobreviveu; **não fazer
> nada** (a conduta que este artefato registrava antes) é segura, mas entrega a descoberta ao acaso,
> dependendo de o Admin abrir a tela e clicar.

---

### Ramo E — A fronteira do congelamento

> Ramo acrescentado pela skill. Esta é a **última fatia da integração bancária que acrescenta rota**;
> o que não nascer aqui não nasce mais antes do handoff.

**Direções candidatas:**

- **E1 — Escopo travado nas duas frentes**: webhook por tenant e material do certificado, nada além.
  - _Exemplo:_ duas rotas novas (ativar, consultar estado) e a rota de registro do certificado passando
    a aceitar o material legado — a superfície cresce de 103 para 105 rotas.
  - _Viabilidade:_ é o que o `plano-execucao.md` §F5 (i) especifica, e o que a §8.3 do levantamento do
    frontend já anuncia ao handoff.
- **E2 — Ampliar para "tudo que hoje exige terminal na integração bancária"**: expurgo dos boletos
  guardados (`D26 · F4/T9`), limitador do vhost (`D27 · F4/T11`), segundo provedor (`D43`), rotação da
  chave de cifra.
  - _Exemplo:_ uma tela de manutenção da integração bancária.
  - _Viabilidade:_ **nenhum dos quatro é tela.** Os três primeiros são infraestrutura com gatilho
    próprio já registrado; a rotação da chave é operação de servidor **por construção** — a ADR-0032
    faz da separação entre material e chave uma cláusula de operação, e trazê-la para a tela juntaria
    os dois lados que ela existe para separar.
- **E3 — Uma rota de saúde agregada da integração** (certificado + identidade + webhook num `GET`).
  - _Exemplo:_ `GET /v1/integracoes-bancarias/situacao` devolvendo os três de uma vez.
  - _Viabilidade:_ acrescenta rota que ninguém pediu; a tela compõe as três consultas que já existem
    (ou existirão). Conveniência de frontend paga com superfície congelada.

**Direção escolhida (A1)**: **E1**. _Razão:_ nenhum item de E2 é rota, e E3 troca superfície
permanente por conveniência de uma tela — o congelamento torna essa troca irreversível.

**Podadas / adiadas**: **E2** e **E3** — podadas, com a razão acima registrada para que a varredura de
fecho da F5 não as redescubra como esquecimento.

---

### Provocação — "se só desse para uma frente, qual?"

A **frente B** (material do certificado). _Razão:_ sem ela, o certificado vence e a cobrança
bancária **para**; sem a frente A, o produto opera **degradado mas correto**, porque a conferência
diária liquida e estorna sem o webhook. Isso **não** parte a fatia — as duas continuam juntas, como o
`plano-execucao.md` decidiu, por terem a mesma causa —, mas **ordena as tasks dentro dela**: a frente
B primeiro. O runbook da borda mede o certificado vencendo em **2026-08-22**, e hoje é 2026-08-21.

---

## 5. Problema

- **Qual é a dor real hoje?** Duas operações da integração bancária só acontecem com alguém logado no
  servidor: **ativar o webhook do provedor** (que é por cliente, com o certificado e o identificador
  daquele cliente) e **registrar o certificado no formato em que a AC o entrega** (cifra legada, que o
  runtime recusa). Num SaaS multiempresa, cada cliente novo e cada renovação viram um chamado para
  quem opera a máquina.
- **Como o problema aparece no dia a dia?**
  - O Admin renova o certificado pela tela, recebe `422` dizendo que **a senha está errada** — e a
    senha está certa. Medido em 2026-08-20: o operador foi caçar uma senha que não existia.
  - Um cliente novo entra e, até alguém com acesso ao servidor cadastrar o webhook dele no provedor, o
    pagamento dele só é reconhecido pela conferência do dia seguinte.
- **Quem sente o impacto?** O **Admin da imobiliária**, que não consegue resolver o que é dele; e o
  **operador do SaaS**, que vira gargalo de um trabalho que cresce com o número de clientes.
- **Por que resolver agora?** Três razões, e as três têm data. (1) A AC entregou em cifra legada nas
  **duas emissões consecutivas** — é o padrão dela, não exceção. (2) O certificado vigente vence em
  **2026-08-22**. (3) Esta é a **última fatia da integração bancária que acrescenta rota** antes do
  congelamento da superfície, que é item do marco de entrega do backend.

---

## 6. Objetivo Principal

- **Qual é o resultado esperado ao final?** O Admin de cada imobiliária ativa o próprio webhook e
  renova o próprio certificado **pela tela, sem terminal e sem `sudo`** — e, quando o provedor recusa,
  ele lê **o motivo completo**, íntegro, e pode tentar de novo.
- **Qual mudança de comportamento/estado deve acontecer?**
  - Entrar cliente novo deixa de exigir intervenção de quem opera o servidor.
  - Renovar certificado deixa de depender do formato que a AC escolheu entregar.
  - A recusa do provedor deixa de ser exceção transitória e passa a ser **dado que a tela lê depois**.
  - A ausência de webhook deixa de ser silêncio e passa a ser **estado declarado**, com o produto
    operando normalmente pela conferência.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Admin da imobiliária** (tenant). Configura a integração bancária da própria
  empresa; tem a chave `ACAO:configurar_integracao` na tela `TELA:integracoes_bancarias`; **não tem —
  nem deve ter — acesso ao servidor**.
- **Persona secundária**: **operador do SaaS**. Hoje é o gargalo; o sucesso da fatia é medido por ele
  **deixar de ser acionado** nos dois fluxos.
- **Persona terciária**: `[HIPÓTESE]` o **agente que implementa o frontend** na máquina local do
  usuário — ele consome o contrato desta fatia pelo `handoff-frontend.md` e **não** pode perguntar
  nada a este repositório depois do congelamento.
- **Contexto de uso**: navegador, dentro da área autenticada do Sysloc, na tela de integrações
  bancárias. Uso **raro e de alta consequência**: ativação uma vez por cliente, renovação uma vez por
  ano.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Porta irmã de configuração** para as operações de webhook do provedor — **cadastrar** e
      **consultar** —, com a conformidade **varrida por teste** no molde do `CT-809 (b)`, que hoje faz
      isso para a `PortaDeIdentidadeBancaria` (Ramo B / insumo §5.3)
- [ ] **Escopos por família de operação** no adaptador — hoje o escopo é constante
      (`adaptador-sicoob.ts:1069`); a família de webhook exige
      `webhooks_inclusao webhooks_consulta webhooks_alteracao`, e **não existe** `webhooks_exclusao`
- [ ] **Rota de ativação**: cadastra no provedor e **confirma por consulta**; só declara habilitado com
      os dois positivos (Ramo B → B1)
- [ ] **Rota de consulta do estado**: habilitado/desabilitado e, quando desabilitado, o **motivo
      completo** devolvido pelo provedor — mensagem e código íntegros, sem interpretação (Ramo C → C1)
- [ ] **Persistência do estado por empresa** com o desfecho da última tentativa, em tabela com
      dono-empresa, RLS e chave composta (Ramo C → C1)
- [ ] **As duas rotas sob `@ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)`** — as
      mesmas chaves do certificado, nenhuma chave nova no catálogo fechado (Ramo B → B1)
- [ ] **A rota de registro do certificado aceita material em cifra legada**, convertendo-o por
      reembalagem em processo externo isolado, com série, titular e validade **idênticos**, afirmado
      por medição (Ramo A → A1)
- [ ] **Três causas de recusa, três desfechos distintos** — cifra não suportada, senha incorreta e
      validade encerrada —, classificáveis pelo código do envelope. **Fecha o `D64`** (Ramo D → D1)
- [ ] **A resposta do registro informa que o material foi convertido** (Ramo D → D1)
- [ ] **Degradação declarada e testada**: com o webhook desabilitado, a conferência continua
      liquidando e estornando. Já implementado — a fatia **declara e testa** (Ramo D)
- [ ] **Trilha**: a ativação e a recusa entram como efeito; a reconsulta que nada muda, não (ADR-0034)
- [ ] **Registrar certificado novo dispara reconsulta do estado do webhook**, best-effort: falhar não
      faz o registro do certificado falhar, e o motivo é gravado (Ramo D — decisão de 2026-08-21)
- [ ] **O gancho da reconferência automática** deixado por escrito para a fatia (ii) (Ramo C → C3)

---

## 9. Fora do Escopo (podado / adiado)

- **Ligar o provider legado do OpenSSL no runtime (A2)** — _habilitaria cifra fraca no processo que
  manipula todo segredo operável; o `D64` recomenda recusar._
- **Biblioteca de PKCS#12 em JS (A3)** — _adiada; traz criptografia de terceiro para o caminho do
  segredo e uma dependência nova. Volta se o `openssl` deixar de estar garantido no host._
- **Chave de permissão nova para ativar webhook (B2)** — _granularidade sem papel real
  correspondente; mexeria no catálogo fechado da ADR-0011._
- **Ativação pelo Painel Master (B3)** — _é a descrição do problema, não uma solução; e é impossível:
  o cadastro usa credenciais do cliente, que o Master não alcança._
- **Consulta ao vivo a cada leitura de estado (C2)** — _a recusa não sobreviveria à requisição,
  contrariando a entrega 4._
- **Reconferência automática do estado do webhook (C3)** — _adiada para `automacoes-agendadas/v1`, que
  traz o agendamento e já publica rota de saúde por tenant. Urgência baixa: a degradação é primeira
  classe._
- **Botão de desativar o webhook (D3)** — _impossível por medição: não existe escopo
  `webhooks_exclusao`; a concessão recusa com `invalid_scope`._
- **Expurgo dos boletos guardados, limitador do vhost, segundo provedor, rotação da chave de cifra
  (E2)** — _nenhum é rota nem tela; os três primeiros têm gatilho próprio já registrado, e a rotação é
  operação de servidor por construção (ADR-0032)._
- **Rota de saúde agregada da integração (E3)** — _a tela compõe as consultas existentes; superfície
  congelada não se gasta com conveniência._
- **Qualquer alteração no webhook de terceiro do cliente que já tem a vaga ocupada** — _decisão do
  usuário: intocável._
- **A tela em si** `[fora do escopo do projeto]` — _o React vive na máquina local do usuário; aqui só
  se faz backend, e a fronteira é gatilho de parada._
- **Reabrir "uma URL ou uma por cliente"** — _resolvido e em produção: URL única, roteamento pelo
  identificador próprio, empresa derivada da cobrança encontrada._

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multiempresa de gestão de locação de imóveis; backend
  Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo o Frappe/ERPNext de `/opt/frappe`.
  **F0–F4 concluídas; falta a F5**, cuja fatia (i) é exatamente esta. Superfície medida: **103 rotas /
  88 manipuladores**; suíte em **1737 casos** distribuídos em 9 pacotes.
- **PRDs / specs existentes consultados**:
  - `plano-backend-novo/plano-execucao.md` §F5 (i) — **é a fonte**: nomeia as duas frentes, as 5 + 3
    entregas, a aceitação de cada uma e os gatilhos do handoff. Este pré-refinamento **converge sobre
    ela**, não a substitui.
  - `fundacao-bancaria/v1/_run/run-report.md` §2 `D64` — o débito da frente B, **agravado em
    2026-08-21**, com as três formas da conversão e a recusa registrada da segunda.
  - `webhook-e-carne/v1/` — **cobre a recepção**, que já está pronta (rota `POST
    /v1/notificacoes-bancarias`, vhost, tabela `plataforma.notificacao_bancaria`). Esta fatia cobre a
    **ativação**, que aquela deixou declaradamente em aberto. **Sem sobreposição.**
  - `emissao-e-conciliacao/v1/` — origem do adaptador, da conferência e do escopo constante que aqui
    precisa virar escopo por operação. **Adjacente.**
  - `automacoes-agendadas/v1/insumo-do-pre-refinamento.md` — a fatia (ii), que roda **depois** e cujo
    §5.4 publica rota de saúde das rotinas por tenant. **É onde o C3 vai morar** — registrado para não
    duplicar.
  - `integracao-bancaria-configuravel/` (v1–v6) e `integracao-bancaria-sicoob/v1` — material **do
    repositório Frappe antigo**; vocabulário reaproveitável, implementação não.
  - `levantamento-frontend.md` §8.3 — **já anuncia esta fatia** ao handoff, nominalmente.
- **Capacidades reutilizáveis** (só para viabilidade):
  - **Persistência**: `@sysloc/db` com Drizzle sobre PostgreSQL 18, RLS forçada e FK composta
    `(id, empresa_id)`; contexto de tenant por `AsyncLocalStorage` + `SET LOCAL app.empresa_id`.
  - **Autenticação / autorização**: `packages/auth` com catálogo **fechado** de permissões — a chave
    `ACAO:configurar_integracao` já existe e já governa certificado e identidade; decorador
    `@ExigeChaves` (plural, obrigatório).
  - **Integração com o provedor**: `packages/cobranca-bancaria` — `adaptador-sicoob.ts` (mTLS por
    `node:https` nativo), `porta-de-identidade.ts` (**o precedente de porta irmã**),
    `leitura-do-material.ts`, `conferencia.ts` (a degradação, já implementada).
  - **Conversão do material**: `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` —
    **o roteiro provado**, idempotente por medição, senha por descritor de arquivo.
  - **Contrato**: `packages/contracts` em Zod puro. ⚠️ **Não há cliente ts-rest** — o handoff troca
    tipos, não cliente.
  - **Varredura de vocabulário**: `TERMOS_DO_DIALETO_DA_NOTICIA` **já carrega** `codigoTipoMovimento`,
    `codigoPeriodoMovimento`, `codigoSituacao`, `idWebhook`, `validacaoWebhook` e `tipoMovimento` —
    acrescentados **antes** de existir a porta, de propósito.
- **Conflitos / sobreposições detectados**: **nenhum.** A `webhook-e-carne` é complementar (recepção ×
  ativação); a `automacoes-agendadas` recebe o C3 por decisão explícita e registrada. A única tensão é
  de **fronteira temporal**: a decisão do Ramo A é arquitetural e precisa de ADR antes do PRD.

---

## 11. Premissas e Decisões já tomadas

**Premissas:**

- ~~`[HIPÓTESE]` O cadastro de webhook sobrevive à troca do certificado~~ → **RESOLVIDA em
  2026-08-21**: assume-se que sobrevive, **e o desenho não depende da premissa** — o registro do
  certificado reconsulta o estado do webhook. Ver o fecho do Ramo D.
- `[HIPÓTESE]` O `openssl` estará **sempre presente** no host onde a API roda — hoje está, e o script
  versionado já depende disso, mas nada no provisionamento o **garante executavelmente**. → **[DÚVIDA] 3**
- `[HIPÓTESE]` A quantidade de empresas por instalação é pequena o bastante (dezenas, não milhares)
  para que a ativação ser **um clique por empresa** seja aceitável, sem ativação em lote.
- `[HIPÓTESE]` O agente que implementa o frontend consegue exibir o objeto de motivo **sem esquema
  fixo** — os campos que o provedor devolve variam por código de recusa, e a tela os exibe como vieram.
- ~~`[HIPÓTESE]` A renovação de agosto/2026 já foi aplicada à mão~~ → **MEDIDA em 2026-08-21, e é
  meia-verdade**: o material renovado foi baixado (`certificado-novo.pfx`, 14:08) e **convertido**
  (`certificado-novo-moderno.pfx`, 14:12), mas **converter no disco não registra nada** — o produto
  usa o que está cifrado em `negocio.certificado_do_provedor`, e só a rota o põe lá. A renovação
  fica pendente de **um registro pela tela**, e o convertido a rota já aceita hoje.

**Decisões já tomadas (fora de negociação):**

- **Uma URL para todos os tenants.** Roteamento por identificador próprio; empresa derivada do dado
  encontrado. Já implementado e em produção — não há subdomínio, vhost nem rota por cliente.
- **A degradação é primeira classe.** Sem webhook, a conferência por consulta liquida e estorna. Já
  implementado; a fatia **declara e testa**, não constrói.
- **A porta nova é conforme à arquitetura** — porta irmã de configuração, autorizada por critério de
  classe já registrado. **Não há ADR nova nem emenda a fazer** *para a porta*.
- **Nenhum vocabulário do provedor cruza a porta.** Os termos da família de webhook já foram
  acrescentados à lista varrida **antes** de existir a porta, para que não nasçam contornados.
- **O webhook de terceiro de um cliente específico é intocável.** Nada na fatia pode alterar,
  desativar ou substituir cadastro que não seja do próprio produto.
- **O comportamento da tela está definido**: um botão "Habilitar webhook" por cliente, disparando o
  ciclo **cadastrar → consultar para confirmar**; exibe **Habilitado** só com os dois positivos;
  exibe **Desabilitado + motivo completo** caso contrário, com **"Tentar novamente"** repetindo o mesmo
  ciclo. Com o webhook desabilitado, **o produto opera normalmente**.
- **Este repositório só faz backend.** A tela é implementada fora daqui, a partir do handoff.
- **Multi-tenancy é do banco**: tabela nova nasce com dono-empresa, isolamento forçado e chave
  composta. Sem exceção.
- **Segredo de terceiro é cifrado e não retorna por superfície alguma** — provado por **medição da
  saída real**, nunca por leitura de código.
- **O projeto roda exclusivamente em Opus**, e tudo é em **português brasileiro**.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o Admin clica, o provedor recusa (vaga ocupada por sistema de
  terceiro), e ele conclui que **o produto está quebrado**. → _Mitigação:_ o motivo íntegro do
  provedor na tela, mais a declaração explícita de que **o produto funciona sem o webhook**. O cliente
  da vaga ocupada é o **teste vivo** do desenho, não uma exceção a tratar.
- **Risco de escopo**: o Ramo E existe porque o congelamento cria pressão para "aproveitar e incluir".
  → _Mitigação:_ E2 e E3 estão podados **com a razão registrada**, e a razão é verificável.
- **Risco técnico**: executar processo externo a partir da API é **superfície nova** — caminho do
  binário, argumentos, término, tempo, e a senha que não pode aparecer em `argv` nem em diário. →
  _Mitigação:_ caminho absoluto, sem shell, senha por descritor de arquivo, teto de tempo, saída fora
  do diário — tudo já demonstrado pelo script versionado. **Merece ADR** (§15.4).
- **Risco operacional com data**: o certificado vigente vence em **2026-08-22** (medido em 2026-08-16,
  runbook da borda) e **hoje é 2026-08-21**. → _Mitigação:_ o contorno de servidor existe e o operador
  tem acesso; a fatia remove a dependência para a renovação **seguinte**. Ordena a frente B primeiro.
- **Risco de privacidade / segurança**: a conversão manipula **chave privada em claro**. → _Mitigação:_
  ADR-0032 na íntegra — em claro só dentro do processo, nada em claro no disco, nada de volta por
  superfície alguma, e a ausência de vazamento **afirmada por medição da saída real**.
- ✅ ~~**Risco de falso conforto no contorno atual**~~ → **DOIS defeitos medidos e CORRIGIDOS em
  2026-08-21**, em correção dirigida autorizada pelo usuário, fora do pipeline de fatia:
  1. **O caminho de geração nunca funcionou neste host.** `openssl pkcs12 -export` exige entrada
     **seekable**, e o script alimentava o segundo `openssl` por **pipe** — medido: com
     `-in <arquivo>` produz o PKCS#12; por stdin, pipe ou `/dev/fd/N` falha com
     `Could not read any certificates`. Todo caminho de reembalagem terminava em *"a reembalagem
     falhou"*. O intermediário passou a ser arquivo `0600` em **tmpfs** (`/dev/shm`), removido por
     `trap` em qualquer desfecho — inclusive erro e sinal.
  2. **A idempotência era afirmada sobre a pergunta errada.** No ramo em que o preparado já existe,
     perguntava-se *"o runtime o abre?"* em vez de *"é o mesmo certificado que o original de
     agora?"*. Com a renovação entregue **sob o mesmo nome**, o script aprovava o material da
     emissão anterior. Agora os dois ramos — gerar e reusar — comparam **titular, série e
     validade**, e a recusa nomeia o certificado obsoleto.

  **Rede permanente:** `deploy/scripts/cobranca-bancaria/verificar-preparacao-do-material.sh`
  (**CT-1011 a CT-1013**), com prova de falsificação em cada caso. Medido: reprova o script anterior
  (CT-1011, 3 falhas), reprova o mutante que reintroduz só o defeito 2 (CT-1012, 3 falhas), e aprova
  3/3 o corrigido. Os dois pontos corrigidos levam marcador `DECISÃO FECHADA`.
  ⚠️ **O verificador é o 11º `verificar-*.sh` e toca o gatilho do `D9 · F0/T2`** — ele copia o
  esqueleto do irmão de diretório em vez de criar forma nova, mas **não fecha o D9**, cuja
  unificação segue pendente.
  → _Consequência para a fatia:_ a frente B move essa conversão para **dentro do produto**, onde o
  material conferido é o que acabou de ser enviado e a comparação deixa de depender de nome de
  arquivo. O achado (1) reforça a escolha do **Ramo A**: a guarda do processo externo precisa tratar
  o intermediário, e o roteiro provado agora **é de fato executável**.
- **Risco de prova**: o defeito **não aparece na suíte** — os testes geram material em execução, e
  material gerado pelo Node nasce com cifra moderna. → _Mitigação:_ o caso exige material legado
  **gerado em execução** (`openssl` com `-legacy`); é a parte cara, e é a razão de o `D64` seguir
  aberto. Sem ela, a frente B é indistinguível de não ter sido feita.
- **Risco de handoff**: o que esta fatia publicar é a **última chance** de acertar o contrato antes do
  congelamento. → _Mitigação:_ os quatro gatilhos do handoff já estão escritos no `plano-execucao.md`
  §F5 (i).

---

## 13. Dúvidas em Aberto

1. ~~**[DÚVIDA]** O cadastro de webhook sobrevive à troca do certificado?~~ → **RESOLVIDA pelo
   usuário em 2026-08-21**: assume-se que sim, e o registro do certificado passa a **reconsultar** o
   estado do webhook, de modo que a premissa errada se corrige sozinha no mesmo ato. Fundamentação e
   alternativas rejeitadas no fecho do Ramo D.
2. ~~**[DÚVIDA]** A renovação de agosto/2026 já foi aplicada ao servidor?~~ → ✅ **RESOLVIDA por
   medição em 2026-08-21: SIM, e não há ação pendente.** Consulta a
   `negocio.certificado_do_provedor`: o vigente é a emissão de **2026-08-21 → 2027-08-21**
   (`OU=videoconferencia`), registrado às **14:18:26**; o anterior
   (`OU=presencial`, 2025-08-22 → 2026-08-22) recebeu `substituido_em` no mesmo instante. **O
   pré-requisito operacional da fatia está satisfeito** — há certificado válido para medir contra a
   conta real do provedor durante toda a F5.
   ⚠️ **A correspondência do par foi conferida depois, com o script já corrigido**, e bate: *"é o
   MESMO certificado — nada a fazer"*. Ela **não** havia sido conferida no momento do registro, e os
   dois certificados têm titular diferente (`videoconferencia` × `presencial`) — o falso conforto da
   seção 12 teria trocado um pelo outro em silêncio.
3. **[DÚVIDA]** O `openssl` é **garantido** no host pelo provisionamento, ou é presença de fato? Se for
   de fato, o verificador de provisionamento deveria passar a afirmá-lo — e isso muda o custo relativo
   de A1 contra A3.
4. **[DÚVIDA]** As três causas de recusa da frente B viram **três códigos** no envelope da ADR-0017, ou
   um código com `detalhes` discriminante? A §8.2(1) manda classificar **pelo código**, o que puxa para
   três. _Resolver no `tech-alignment`_ — é forma de contrato, não decisão de produto.
5. **[DÚVIDA]** A recusa `10260` (vaga ocupada) merece **texto próprio do produto** acima do motivo
   íntegro do provedor, ou o íntegro basta? O requisito diz "motivo completo"; acrescentar
   interpretação é acréscimo, não substituição. _Recomendado:_ o íntegro basta na v1.

> Nenhuma das cinco é **bloqueante**: 1 e 5 têm conduta conservadora escolhida, 2 e 3 são operacionais
> e verificáveis por comando, 4 pertence ao `tech-alignment`. O pipeline pode seguir.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial**: **A1** (reembalar por processo externo isolado, só na borda de
  registro) · **B1** (as mesmas chaves do certificado, nas duas rotas) · **C1** (estado persistido por
  empresa com o desfecho da última tentativa) · **D1** (transparência: material convertido informado e
  três causas de recusa distintas) · **E1** (escopo travado nas duas frentes).
- **Descartado com justificativa**: **A2** (cifra fraca no processo inteiro) · **B2** (granularidade
  sem papel real) · **B3** (impossível — o Master não alcança as credenciais do cliente) · **C2** (a
  recusa não sobreviveria à requisição) · **D2** (corrói a confiança no registro) · **D3**
  (**impossível por medição** — não existe `webhooks_exclusao`) · **E2** e **E3** (nada ali é rota; a
  superfície congelada não se gasta com conveniência).
- **Adiado**: **A3** (biblioteca em JS — volta se o `openssl` deixar de ser garantido) · **C3**
  (reconferência automática — vai para `automacoes-agendadas/v1`, com o gancho registrado aqui).
- **Provocações que mudaram o rumo**:
  1. *"Se só desse para uma frente, qual?"* → a **B**, porque sem ela a cobrança **para**, e sem a A o
     produto opera degradado mas correto. Não partiu a fatia; **ordenou as tasks dentro dela**.
  2. *"O que mais some da lista quando a superfície congelar?"* (ramo E, não pedido) → nada precisa
     entrar, e agora a razão está registrada em vez de ser redescoberta como esquecimento.
  3. *"A decisão do ramo A é mesmo só desta fatia?"* → **não**: "o produto executa processo externo" é
     transversal e não tem precedente nesta base. Virou o `/agent-spec-adr-create` da §15.4, e é o que
     empurra a recomendação de framework.
- **Decisões do usuário em 2026-08-21** (posteriores ao brainstorm, incorporadas): (a) o cadastro de
  webhook **sobrevive** à troca do certificado, **e** o registro do certificado reconsulta o estado
  do webhook para que a premissa não precise estar certa; (b) duas dúvidas saíram da seção 13 — a 1
  por decisão, a 2 por medição —, e a medição rendeu um **risco novo** na seção 12: o contorno de
  servidor aprova o arquivo errado quando o preparado já existe.
- **Decisões auto-resolvidas (A1)**, todas registradas em linha na seção 4: explorar os 5 ramos ·
  escolher A1, B1, C1, D1, E1 · não expirar o motivo da última tentativa por tempo · não prometer nada
  quanto à renovação com webhook ativo (conservadora) · reusar `v1` como versão do artefato, já que o
  diretório existe apenas com o insumo e a fatia nunca teve pré-refinamento.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — 5 ramos explorados, 5 direções absorvidas, 12 itens no escopo inicial | inferido |
| Personas | **múltiplas** — Admin da imobiliária (primária), operador do SaaS (secundária, cujo sucesso é deixar de ser acionado), agente do frontend (consome o contrato congelado) | inferido |
| Novidade | **incremento** — módulo `integracoes-bancarias` já existe; entram porta nova, tabela nova, migração nova e 2 rotas | inferido |
| Decisão arquitetural transversal nova? | **sim** — "o produto executa processo externo do host", sem precedente nesta base; a §6.1 do insumo a declara **em aberto** | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: duas dimensões decidem, e cada uma sozinha bastaria pela tabela de decisão —
**decisão arquitetural transversal nova** (a forma da conversão do material, que o `plano-execucao.md`
e o `D64` declaram por escrito como não tomada) e **múltiplas personas** (o Admin que ganha autonomia e
o operador que deixa de ser gargalo são pessoas distintas, com critérios de sucesso distintos). Some-se
a amplitude **4+** e o fato de esta ser a **última fatia da integração bancária que acrescenta rota**:
o contrato que ela publicar alimenta o `handoff-frontend.md`, item do marco de entrega, e depois do
congelamento **não há revisão**. O precedente da casa confirma: as três fatias da F4 —
`fundacao-bancaria`, `emissao-e-conciliacao` e `webhook-e-carne` — rodaram todas em SDD, com PRD em
`docs/prds/features/<fatia>/v1/prd.md` mais `tech-alignment.md` e `tech_spec.md`.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o INTENT do miniSpec **não comporta ADR** nem contrato
formal, e as duas coisas são exigidas aqui — a decisão do Ramo A precisa de registro evergreen, e o
contrato das duas rotas precisa estar **completo** para o handoff, porque o frontend é implementado em
outra máquina, por outro agente, sem poder perguntar nada depois. Além disso a fatia carrega **duas
frentes com causas-raiz distintas** (ativação × formato do material) sob uma causa comum; um INTENT
único diluiria a rastreabilidade `CA-xx → CT-xxx` que este repositório mantém por convenção.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por larga margem. O escopo atravessa
contrato (`@sysloc/contracts`), domínio (`@sysloc/cobranca-bancaria`, porta nova), persistência
(`@sysloc/db`, **migração nova** com RLS e FK composta), borda (`apps/api`, 2 rotas + a de registro
alterada) e adaptador (escopo por operação) — cinco pacotes, 12 itens de escopo e 4 dúvidas abertas.
TaskCard perderia a rastreabilidade US→task justamente na fatia cujo contrato congela.

### 15.4 Próximo Passo

```bash
# 1) A decisão arquitetural transversal do Ramo A precisa ser registrada ANTES do PRD:
/agent-spec-adr-create "conversão de material criptográfico legado por processo externo na borda de registro"

# 2) Depois, o PRD da fatia:
/agent-spec-sdd-generate-prd "integração bancária autônoma — ativação do webhook por tenant e aceitação do material do certificado como a AC o entrega"
```

> ⚠️ A ADR **não** contradiz o insumo §5.3: aquele item declara que **a porta irmã de webhook** não
> exige ADR nova — o que segue verdadeiro, por critério de classe da emenda de 2026-08-15 da ADR-0001.
> A decisão a registrar é **outra**: a da frente B, que a §6.1 do próprio insumo declara em aberto.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (nada acima de SDD — o gatilho é **partir a fatia em duas**) se: a guarda do processo
  externo se revelar cara a ponto de a frente B virar trabalho próprio; **ou** a [DÚVIDA] 1 mostrar que
  o webhook **não** sobrevive à troca do certificado, acoplando as duas frentes por um fluxo novo;
  **ou** aparecer um segundo provedor bancário durante a execução (o `D43` já prevê o gatilho).
- **Downgrade** para miniSpec se: a decisão do Ramo A for tomada e registrada **antes** do PRD **e** a
  frente B couber em alterar `lerMaterial` mais a mensagem da rota, sem tabela nem porta nova — o que
  só aconteceria se a frente A fosse retirada da fatia, contrariando o `plano-execucao.md`.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, convergido por A1 com a razão registrada
- [x] **Árvore de rumos (seção 4)**: cada ramo com 2-3 direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs, ADRs e capacidades concretas
- [x] Toda inferência marcada `[HIPÓTESE]`; 5 dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado / provocações / decisões A1
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO miniSpec e por que NÃO TaskCard
- [x] **Comando exato (15.4)** escrito, com a ADR antes
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar o PRD
