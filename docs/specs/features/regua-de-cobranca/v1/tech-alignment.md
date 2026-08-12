# Tech Alignment — `regua-de-cobranca` v1

## 1. Metadados

- **Feature**: `regua-de-cobranca` — sub-fatia **2a** da fatia 2 da F3 (a que **age**)
- **Versão**: `v1`
- **Framework**: **SDD** (entrada: `prd.md`)
- **Variante**: **backend**
- **Documento de definição**: `docs/prds/features/regua-de-cobranca/v1/prd.md`
- **Discovery lido**: `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` (o pré-refinamento
  das duas sub-fatias); `docs/specs/features/cobranca-e-mora/v1/` (a fatia anterior, concluída);
  `docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json` (o oráculo).
  Nenhum `handoff*.md` existe ainda neste repositório.
- **ADRs consultadas** (`Decision` aberta, não a linha-resumo do `INDEX.md`): **0006**, **0008**,
  **0009**, **0011**, **0016**, **0017**, **0018**, **0021**, **0022**, **0023**
- **Data**: 2026-08-11
- **Status**: decidido — pronto para o TECH_SPEC

---

## 2. Contexto técnico

A fatia introduz a **primeira execução de trabalho fora do ciclo de uma requisição** deste produto, e
é isso que ordena todas as decisões abaixo. Até aqui, todo caminho de escrita nasceu de uma sessão
admitida: a guarda publica a sessão, dela sai o contexto de tenant, e a unidade de trabalho fixa
`app.empresa_id` por transação. Um trabalho enfileirado não tem sessão — logo, ou ele ganha uma
origem de contexto legítima e declarada, ou o isolamento que a ADR-0008 impõe pelo banco fica sem
quem o alimente.

O segundo eixo é a **primeira ação sobre o mundo externo**. Um defeito de destinatário, de filtro de
empresa ou de estado publicado não produz teste vermelho — produz cobrança indevida na caixa de uma
pessoa. Por isso a saída de e-mail é tratada como fronteira com barreira que **falha fechado**, e não
como dependência configurável a mais.

O terceiro eixo é a **fonte única do estado**. A fatia 1 fixou `negocio.cobranca_derivada` como o
único lugar onde o estado da cobrança e a mora se apuram (ADR-0022). A régua **consulta** essa fonte
e não recalcula estado por conta própria — é essa propriedade, e não uma guarda escrita na régua, que
torna impossível o caminho manual discordar do automático, que é o defeito medido no legado (REG-08).

Invariantes que a implementação herda, todos já estabelecidos: `empresa_id` com RLS forçada e FK
composta em toda tabela nova; contexto de tenant **ambiente**, nunca parâmetro; esquema Zod como
fonte única do contrato; exigência de autorização declarada por rota, com default que nega;
verificação jamais executando contra o ambiente que atende a operação.

**Estado medido do repositório em 2026-08-11** — os quatro fatos que sustentam as decisões:

| Fato | Medição |
|---|---|
| `apps/worker` **não fala com o banco** | depende só de `@sysloc/shared`, `bullmq` e `ioredis`; `lerAmbiente` exige exatamente `LOG_LEVEL` e `REDIS_URL` |
| `apps/api` **não fala com a fila** | tem `ioredis` (sessão), **não tem `bullmq`** |
| **`nodemailer` não existe** no repositório | grep vazio nos `package.json`; a stack o declara, a árvore ainda não o tem |
| **`ts-rest` não existe** no repositório | o contrato é Zod + `esquemaPublicado` derivando o documento (ADR-0016) — irrelevante para a 2a, decisivo para a 2b |

---

## 3. Soluções técnicas decididas

### D1 — Onde o trabalho da régua executa, e quem detém o contrato da fila

**O que está em jogo**: o processo que hoje consome fila não alcança o banco, e o que alcança o banco
não consome fila. A escolha decide onde nasce a régua, quantos processos mudam e como o **D32
(F0/T6)** fecha.

**Escolhida — A3: a régua vive em pacote de domínio próprio, executa no `worker`, e o contrato da
fila sai para pacote compartilhado.**

Caminhos avaliados:

- **A1 — Consumidor de fila dentro do processo da API.**
  - _Exemplo:_ o módulo Nest registra o consumidor na partida e o job roda no mesmo processo que
    atende requisição.
  - _Prós:_ reusa banco, contexto de tenant e injeção já montados; nenhuma variável de ambiente nova
    no `worker`. _Contras:_ um envio lento passa a disputar o laço de eventos que atende o operador;
    desfaz a separação de unidades systemd que a F0 estabeleceu e provou por reinício real; e o
    encerramento gracioso da fila, que hoje tem prazo próprio no `worker`, passaria a competir com o
    encerramento do servidor HTTP.
  - _Viabilidade:_ exige `bullmq` novo em `apps/api`; conflita com a topologia de processos da F0
    (não com ADR).
- **A2 — Régua dentro de `apps/api`, chamada pelo `worker`.**
  - _Exemplo:_ o job importaria `apps/api/src/...` para reusar o serviço.
  - _Prós:_ nenhum pacote novo. _Contras:_ **inexequível** — `apps/api` é aplicação privada sem
    `exports`, e é exatamente o que o marcador do D32 registra sobre o lado produtor.
  - _Viabilidade:_ descartada por construção.
- **A3 — Pacote de domínio próprio + `worker` com acesso ao banco** (recomendada).
  - _Exemplo:_ a decisão de quem avisar, a composição da mensagem e a gravação do log vivem num
    pacote consumido pelo `worker`; `apps/api` consome o mesmo pacote para o disparo manual, de modo
    que os dois caminhos executam **a mesma** decisão.
  - _Prós:_ um só lugar decide quem é avisado — que é a propriedade que fecha o defeito do legado, em
    que dois caminhos decidiam separado; o `worker` continua sendo o processo de trabalho de fundo;
    o pacote é testável sem subir processo. _Contras:_ o `worker` passa a exigir as variáveis de
    banco, e a superfície de pacotes do monorepo cresce de 4 para 5.
  - _Viabilidade:_ reusa `@sysloc/db` inteiro (unidade de trabalho, contexto, esquema); nenhum
    conflito com ADR.

**Trade-off aceito**: mais um pacote e mais configuração no `worker`, em troca de o caminho automático
e o manual não poderem divergir e de o processo que atende requisição não ganhar trabalho de fundo.

**Fechamento do D32, que dispara aqui.** O marcador em `apps/worker/src/fila.ts` prescreve, no campo
`QUANDO FECHA`, extrair **nome, opções e tipos de carga** para lugar compartilhado, ou declarar a
repetição como deliberada nos dois lados. A decisão é **extrair** — a alternativa (marcador nos dois
lados) preserva a duplicação que o débito nomeia. O marcador sai no **mesmo commit** da extração, e a
linha correspondente sai do índice do `CLAUDE.md`.

### D2 — De onde vem o contexto de tenant quando não há sessão

**O que está em jogo**: `contextoDeTenant.executarCom` declara, no próprio cabeçalho, um **escritor
único** — a guarda de contexto de `apps/api`, com valor derivado da sessão. Um job não tem sessão. Sem
uma origem declarada, ou o job roda sem contexto (e a RLS devolve vazio, silenciosamente), ou alguém
inventa uma origem por ponto — que é a forma exata que a ADR-0008 existe para impedir.

**Escolhida — B1: a carga do job é a origem, `executarCom` continua sendo o escritor único, e a
enumeração de empresas ativas é a única leitura fora de contexto de empresa.**

Caminhos avaliados:

- **B1 — Contexto derivado da carga do job** (recomendada).
  - _Exemplo:_ quem enfileira grava a empresa na carga; o consumidor abre o contexto com ela **uma
    vez**, na borda do job, e tudo abaixo herda — mesma disciplina da borda HTTP, com outra borda.
  - _Prós:_ preserva o invariante que importa (contexto **ambiente**, escritor único, `SET LOCAL` por
    transação); a fronteira continua sendo do banco. _Contras:_ acrescenta um segundo escritor
    legítimo a um símbolo cujo cabeçalho hoje nomeia um só — exige emenda do cabeçalho e marcador no
    ponto.
  - _Viabilidade:_ a enumeração das empresas lê `identidade.empresa`, que a **ADR-0009** define como
    schema **sem noção de tenant**, e já tem porta própria (`abrirAcessoAIdentidade`). Não é exceção
    ao isolamento — é o lado da fronteira onde empresa ainda não é contexto.
- **B2 — Sessão de serviço sintética.**
  - _Exemplo:_ o worker autentica com uma credencial de serviço e herda contexto pelo caminho normal.
  - _Prós:_ nenhum escritor novo. _Contras:_ cria credencial de longa duração que a F1 fechou por
    barreira única de admissão, e uma sessão que nenhuma pessoa possui — a auditoria passa a atribuir
    ato a um usuário que não existe.
  - _Viabilidade:_ conflita com o espírito da ADR-0013 (o alcance da garantia é da sessão) e amplia
    superfície de credencial. Descartada.
- **B3 — Papel de banco próprio para o worker, sem RLS.**
  - _Prós:_ dispensa contexto. _Contras:_ **contorna** o isolamento em vez de usá-lo; a varredura
    volta a ser cross-tenant, que é o defeito medido do legado.
  - _Viabilidade:_ contradiz o `Decision` da ADR-0008. Descartada.

**Trade-off aceito**: um escritor legítimo a mais para o contexto, em troca de manter a fronteira no
banco e a origem do contexto explícita e única por borda.

> **Candidata a ADR — e é a mais forte desta fatia.** A pergunta *"qual é a origem legítima do
> contexto de tenant quando não há requisição"* é transversal por construção: a **F5** tem N rotinas
> agendadas com exatamente este problema, e a F4 terá o retorno do webhook bancário, que chega sem
> sessão. Registrar aqui e não em ADR faria cada fase redecidir. Ver §4.

### D3 — Como o trabalho de uma empresa é acionado nesta fatia

**O que está em jogo**: a RN-14 tira o gatilho de tempo do escopo, mas o trabalho precisa ser
acionável — inclusive pela suíte, que exercita CA-02, CA-03, CA-04, CA-12 e CA-16.

**Escolhida — C1: porta de aplicação enfileirável, sem rota nova** (confirmada pelo usuário no
checkpoint).

Caminhos avaliados:

- **C1 — Porta de aplicação chamável, mais o produtor da fila** (recomendada).
  - _Exemplo:_ a F5 chama a mesma porta a partir do relógio dela; a suíte a chama diretamente,
    sem passar por HTTP.
  - _Prós:_ não cresce a superfície que congela depois da F5; nenhum CA exige acionar a régua inteira
    pela API; a F5 herda o ponto de entrada pronto. _Contras:_ o operador não tem um "rodar agora" da
    empresa inteira — só o disparo manual por cobrança, que é o que o PRD lhe dá.
  - _Viabilidade:_ reusa a fila de pé desde a F0; nenhuma rota nova a auditar na dupla medição.
- **C2 — Rota que enfileira o trabalho da empresa da sessão.**
  - _Prós:_ dá o "rodar agora" e é exercitável por HTTP. _Contras:_ +1 rota numa superfície que a F5
    pode tornar redundante, e uma operação publicada cujo único consumidor previsto é diagnóstico.
  - _Viabilidade:_ possível sem abrir catálogo (a área já existe). Podada por escopo.

**Trade-off aceito**: menos observabilidade operacional nesta fatia, em troca de superfície menor até
o congelamento.

### D4 — Onde vive a decisão de elegibilidade — **decisão direta**

Sem leque: a **ADR-0023** determina. A `Decision` diz que a derivação vive **no banco** quando
participa de **seleção** — filtro, ordenação ou paginação. Escolher quem avisar *é* seleção: filtra
por estado publicado, por dia relativo ao vencimento e pela ausência de tentativa recente.

Consequências que a tech spec detalha, e que já ficam fixadas na forma:

- o conjunto de candidatas se apura **no banco**, sobre `negocio.cobranca_derivada` — nunca sobre a
  tabela-base, porque é a view que publica o estado e a mora (ADR-0022);
- a **trava de intervalo mínimo** é apurada contra o registro de envios **no mesmo predicado**, não
  por leitura ampla filtrada depois na aplicação. O golden prova que a trava conta **qualquer**
  tentativa, inclusive a que falhou;
- a **janela de horário** fica **na aplicação**: ela é propriedade do job, não da linha — não
  discrimina uma cobrança de outra, e não participa de seleção;
- a derivação no banco **preserva o isolamento por empresa**, como a mesma ADR exige: nada de objeto
  derivado com direitos próprios; a view atual usa `security_invoker` e a nova leitura herda a
  política pelo contexto da transação.

Ler tudo em aberto e filtrar em TypeScript foi **descartado** — contraria a `Decision` da ADR-0023 e
transporta para a aplicação linhas que o predicado descartaria.

### D5 — A porta de saída de e-mail e a barreira da RN-15

**O que está em jogo**: a primeira dependência externa de saída do produto, e um critério de aceite
(CA-17) que exige que **nenhuma verificação alcance destinatário real**. A biblioteca declarada na
stack ainda não existe na árvore.

**Escolhida — E1: porta de aplicação com adaptador de produção e adaptador de captura, e barreira que
falha fechado.**

Caminhos avaliados:

- **E1 — Porta (interface) de envio, com dois adaptadores** (recomendada).
  - _Exemplo:_ o domínio da régua conhece apenas "entregar esta mensagem a este endereço"; quem
    monta o processo escolhe o adaptador. A verificação injeta o de captura e **afirma sobre o que
    foi capturado** — que é a única forma de provar CA-04, CA-11 e CA-16 sem enviar nada.
  - _Prós:_ a prova dos critérios não depende de rede; o domínio não conhece SMTP; trocar de provedor
    não toca regra. _Contras:_ uma interface a mais entre a régua e a biblioteca.
  - _Viabilidade:_ introduz `nodemailer` como dependência nova — justificado por incompatibilidade
    com o existente (não há cliente de e-mail no repositório) e por já constar da stack declarada.
- **E2 — `nodemailer` direto, com o transporte de teste da própria biblioteca.**
  - _Prós:_ nenhuma interface intermediária. _Contras:_ a barreira passa a depender de **configuração
    correta na suíte**; uma variável de ambiente herdada do host basta para um envio real escapar. A
    RN-15 é declarada como **pré-condição, não recomendação** — e configuração não é pré-condição.
- **E3 — Servidor SMTP de captura local.**
  - _Prós:_ exercita o protocolo de verdade. _Contras:_ processo externo novo num projeto **nativo,
    sem Docker**; a suíte passa a depender de porta e de serviço de pé.
  - _Viabilidade:_ conflita com a decisão de stack do projeto. Descartada.

**A barreira falha fechado, e é parte da decisão**: sem transporte declarado explicitamente, o
adaptador de produção **não envia e não degrada em silêncio** — recusa a partida do processo, no
molde do `lerAmbiente` que já existe nos dois pontos de entrada. O modo perigoso é o inverso do
habitual: aqui, "tentar mesmo assim" é o que alcança a caixa de uma pessoa.

**Trade-off aceito**: uma indireção a mais e uma dependência nova, em troca de a prova dos critérios
não depender de rede nem de configuração da suíte.

### D6 — A unidade de retentativa da falha de envio

**O que está em jogo**: a RN-09 e o CA-10 exigem que a falha seja **fato próprio, repetido sem
intervenção, sem tocar o estado financeiro**. A fila já tem política de repetição declarada
(`OPCOES_PADRAO_DA_TAREFA`), e duplicá-la por dentro do job criaria duas políticas para o mesmo fato.

**Escolhida — F1: a retentativa é a do job da empresa, e a idempotência vem da própria trava de
intervalo.**

Caminhos avaliados:

- **F1 — Retentativa do job da empresa** (recomendada).
  - _Exemplo:_ o job da empresa falha ao enviar a quinta de dez cobranças; a fila o repete; na
    repetição, as quatro já avisadas estão **fora do conjunto de candidatas**, porque cada uma tem
    tentativa registrada dentro do intervalo mínimo — e o predicado do D4 as descarta sem que ninguém
    escreva uma guarda para isso.
  - _Prós:_ **uma** política de repetição, a que já está declarada; o registro de envios, que existe
    para a trava e para a auditoria, entrega a idempotência de graça; nenhum estado novo a
    reconciliar. _Contras:_ a repetição refaz a seleção da empresa inteira — custo de uma consulta, e
    a consulta é o predicado que já roda.
  - _Viabilidade:_ reusa `attempts`/`backoff` do pacote compartilhado do D1. **A prova de que a
    repetição não duplica aviso é caso de teste obrigatório** — é a asserção que sustenta esta
    escolha, e sem ela a decisão fica só argumentada.
- **F2 — Laço de retentativa por mensagem dentro do job.**
  - _Prós:_ isola a falha de um destinatário. _Contras:_ segunda política de repetição, convivendo
    com a da fila; um job longo segurando conexão de banco; e a trava passa a ser disputada dentro do
    próprio job.
- **F3 — Job por mensagem.**
  - _Viabilidade:_ **já podado no pré-refinamento** (C3/C4) por disputa da trava, que é comportamento
    provado pelo oráculo. Adiado para a F5, se o isolamento por mensagem se mostrar necessário — e
    entra como segundo nível, sem mudar a unidade.

**Trade-off aceito**: a repetição reprocessa a seleção da empresa, em troca de uma única política de
repetição e de idempotência derivada de um fato que já se grava por outra razão.

---

## 4. Candidatas a ADR

**Uma**, e vem do **D2**:

> **Qual é a origem legítima do contexto de tenant quando não existe requisição.**

Ela é transversal por três consumidores já identificados: a **F5** (rotinas agendadas, N jobs), a
**F4** (retorno do webhook bancário, que chega sem sessão) e esta fatia. O que a decisão fixa é o
**critério** — que a origem é a carga do trabalho, que o escritor continua único por borda, e que a
enumeração de tenants é a única leitura legítima fora de contexto de empresa, por viver no schema que
a ADR-0009 declara sem noção de tenant.

```bash
/agent-spec-adr-create "origem legítima do contexto de tenant quando não há requisição"
```

> **Não é a mesma ADR recusada no pré-refinamento.** Lá se recusou a ADR da **granularidade da fila**
> (*"um job por empresa"*), por ser churn: o `Decision` só repetiria o que o RLS e a F5 já forçam.
> Esta é outra pergunta — não *quantos jobs*, mas *de onde o job tira o direito de ler*. O RLS não a
> responde: ele impõe que exista contexto, e não diz quem pode estabelecê-lo.

As **duas ADRs** que o pré-refinamento declarou pré-requisito (critério de rota pública de negócio;
o que o contrato publica para rota que devolve bytes) são da **sub-fatia 2b** e **não bloqueiam esta**
— nenhuma decisão acima depende delas.

---

## 5. Restrições e invariantes técnicas

Herdadas, e vinculantes para qualquer implementação desta fatia:

1. **Isolamento é propriedade do banco** (ADR-0008): a tabela nova de registro de envios nasce com
   `empresa_id`, RLS habilitada com `USING` e `WITH CHECK`, e FK composta `(id, empresa_id)`. O
   contexto nunca vem do pedido.
2. **Estado publicado é derivado, nunca movido por rotina** (ADR-0022): a régua **lê**
   `negocio.cobranca_derivada` e não escreve estado de cobrança em hipótese alguma. Falha de envio
   **não toca** a cobrança nem a mora.
3. **Derivação que participa de seleção vive no banco** (ADR-0023) — ver D4.
4. **Toda rota declara o que exige, e a que não declara é recusada** (ADR-0011, ADR-0018): a
   configuração e a consulta do histórico exigem a **área** `TELA:automacao_de_cobranca`; o disparo
   manual exige, **em conjunção**, a área e a chave `ACAO:enviar_cobranca_manual`. Declaração de
   método **substitui** a de classe — a rota do disparo manual declara a conjunção inteira, nunca só
   a ação.
5. **O catálogo de permissões não abre.** A área e a ação já existem em
   `packages/auth/src/catalogo-de-permissoes.ts`. Nenhuma chave nasce aqui, e portanto nada supersede
   a ADR-0011.
6. **Transição de estado é rota própria, governada pela natureza do ato** (ADR-0021): o disparo
   manual é ato sensível por nomeação do catálogo.
7. **O esquema é a fonte única do contrato** (ADR-0016, ADR-0017): entrada, tipo de resposta e
   documento publicado derivam do mesmo objeto Zod em `@sysloc/contracts`. Canal não implementado é
   **recusado na entrada** por esquema — nunca aceito e ignorado.
8. **A verificação nunca executa contra o ambiente que atende a operação** (ADR-0006), e **nenhum
   envio real acontece em verificação** (RN-15) — barreira do D5.
9. **Dinheiro em `numeric(15,2)`**; o corpo da mensagem imprime valor e **por isso** precisa conferir
   o gatilho do **D1 (F3/T2)** — terceiro consumidor monetário de `@sysloc/contracts`.
10. **A régua compara datas o tempo todo** — conferir o gatilho do **D26 (F3/T8)**, terceiro consumidor
    de aritmética de calendário em `packages/db`. Os dois são verificação barata contra o marcador; se
    dispararem, fecham nesta fatia com o marcador saindo no mesmo commit.
11. **Protocolo Antirregressão com força máxima**: a fatia reabre arquivos povoados de marcadores
    `DECISÃO FECHADA` (`fila.ts` tem dois, e o D32 convive com eles). Editar código sob
    `DÉBITO COM GATILHO` é normal; sob `DECISÃO FECHADA`, **PARA e escala**.
12. **A `0010` não pode ser emendada** se já tiver sido aplicada a banco durável — é o **D20**, cujo
    gatilho fecha em silêncio. Esta fatia cria migrações **novas**; nenhuma decisão acima altera a
    `0010`.
13. **Divergência contra o oráculo é declarada par a par, antes da execução** (decisão travada no
    pré-refinamento): REG-08 diverge **por vitória**; os outros nove convergem — REG-02, REG-04 e
    REG-10 **por decisão** (o manual ignora janela e trava), e REG-07 porque diverge em template e
    **não** em efeito.
14. **A superfície da API é medida por dupla medição independente**, no molde do CT-533 — e a base é
    **82 rotas / 67 manipuladores**. Não propague a premissa refutada do `HEAD` em dobro.
15. **Aqui só se faz backend.** Task que peça frontend é gatilho de parada.

---

## 6. Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC:**

1. **Os campos da política de aviso e o formato de cada um** — o PRD os delega explicitamente. O que
   está decidido é a **forma**: recurso singular por empresa, no molde de
   `negocio.configuracao_de_mora` e das duas rotas de `/v1/multa-e-juros`, com corpo **completo** no
   `PUT` (campo ausente é recusa, nunca "preserve o valor atual") e leitura que **não responde 404**.
2. **Onde o conteúdo do aviso é composto.** A recomendação de forma é **em código, no pacote de
   domínio do D1** — o PRD fecha personalização por empresa fora de escopo, então o texto não é dado
   configurável. Se a tech spec precisar de variação por estado da cobrança, ela declara quais.
3. **Se a recusa por locatário sem endereço de contato deixa registro próprio** (CA-16). O PRD
   delega. Observação técnica: registrar torna a régua auditável para o caso mais silencioso —
   ninguém percebe a cobrança que nunca foi tentada —, ao custo de o registro de envios passar a
   conter linhas que não são tentativa de envio.
4. **Quantas rotas exatamente a fatia acrescenta às 82.** Com o D3 (sem rota de acionamento), a
   estimativa cai para **3 a 4**: configuração em leitura e em gravação, disparo manual e,
   possivelmente, consulta do histórico. O número sai da dupla medição, na task de fecho.
5. **Como o veredito dos dez cenários fica escrito antes da execução** — a decisão de *que seja
   escrito antes* está travada; o **onde** (tech spec, task, ou tabela de casos) é do arquiteto.
6. **A forma exata do predicado de elegibilidade** (view nova × consulta parametrizada sobre a view
   existente) — o D4 fixa que vive no banco; qual objeto o materializa é da tech spec.

**Dependências de produto — sinalizadas, não decididas:**

7. **A migração da configuração `Single` do legado para configuração por empresa acontece nesta fatia,
   ou a régua nasce desligada e a configuração inicial é item da virada?** O PRD **responde**: fora de
   escopo, a régua nasce desligada, e a configuração inicial entra no handoff. O pré-refinamento
   registrava a `[DÚVIDA] 4` em aberto — **o PRD a fechou**, e é o PRD que vale. Fica aqui só para
   que o arquiteto não a reabra vendo a dúvida no discovery.
8. **A régua nascer desligada muda o comportamento no dia da virada** em relação ao legado, onde a
   política era única e sempre valia. O PRD manda comunicar no handoff e no roteiro da virada — é
   dependência de produto, não decisão técnica, e nada acima a resolve.

**Observações fora do escopo desta fatia** (não viram proposta):

9. O **D27** registra que o limitador de taxa ainda não tem eixo de origem confiável até a publicação
   atrás do servidor de borda, na F7. Isso alcança a **rota pública da 2b**, não esta fatia — nenhuma
   rota daqui dispensa sessão.
10. **Retenção e expurgo do registro de envios** — F7, junto do irmão `identidade.tentativa_login`,
    que já é o item 5 da §F7 do plano de execução.
