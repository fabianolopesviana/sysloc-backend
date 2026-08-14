# Alinhamento Técnico — `documentos-e-confirmacao` (v1)

## 1. Metadados

- **Feature**: `documentos-e-confirmacao` · **Versão**: `v1` · **Framework**: SDD · **Variante**: `backend`
- **Documento de definição**: `docs/prds/features/documentos-e-confirmacao/v1/prd.md`
- **Discovery lido**: `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md` (especializado) e
  `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` (partilhado, intacto)
- **ADRs consultadas**: 0008, 0011, 0016, 0017, 0018, 0021, 0022, 0023, 0024, 0025, **0027**, **0028**
- **Data**: 2026-08-12 · **Status**: decidido com o usuário (checkpoint único, três direções cravadas)

---

## 2. Contexto técnico

Duas frentes independentes sob o mesmo artefato, e elas não se tocam em ponto algum — o corte já
nomeado (**documento × confirmação**) é também o corte técnico.

**O documento** troca *artefato armazenado* por *função pura do estado gravado*. Hoje o legado
compõe HTML, converte com `frappe.utils.pdf.get_pdf` e guarda **base64 num campo** (medido em
`golden/contrato-pdf-fonte.py`, 759 linhas); o produto novo carrega o resíduo dessa forma em
`negocio.contrato.pdf_contrato_arquivo`, que alcança **três superfícies** — a migração `0007`, o
caminho de escrita e leitura em `packages/db/src/contrato.ts`, e o **contrato publicado**
(`packages/contracts/src/contrato.ts`). O invariante que a feature instala: *não existe estado em
que documento e cadastro possam discordar*, e ele é garantido por **ausência de armazenamento**, não
por rotina de invalidação. A marca de cancelamento passa a ser **parâmetro da composição**, o que
elimina a pré-condição do legado por construção (D36).

**A confirmação** instala o **primeiro ato de negócio sem sessão** do produto. O invariante crítico
não é o segredo em si — é que a ausência de sessão **não pode abrir buraco no isolamento**: o
contexto de tenant sai do registro que o portador resolve (ADR-0024), e todo o resto do ato corre
sob RLS forçada como qualquer outra escrita. O segundo invariante é a **indistinguibilidade da
recusa**: link inválido, vencido e consumido fora da validade produzem a mesma resposta, e nenhum
deles altera estado.

Restrição de fundo que atravessa as duas frentes: **renderização de PDF é capacidade nova** — nem
`@react-pdf/renderer`, nem `pdf-lib`, nem navegador headless aparecem em manifesto algum do
monorepo, embora a stack do `CLAUDE.md` declare os dois primeiros.

---

## 3. Soluções técnicas decididas

### D1 — Motor de composição do PDF · `@react-pdf/renderer`

**O que está em jogo**: o que entra no servidor nativo (sem Docker) para transformar dado em bytes.

**Escolhida**: `@react-pdf/renderer` — declarado na stack do `CLAUDE.md`, é JS puro, resolve
justificação, quebra de linha e paginação por conta própria, e não introduz processo externo nem
binário de sistema. **Trade-off aceito**: arrasta `react` e o reconciliador para dentro do backend.
Isso **não** viola a Fronteira do projeto — o que ela proíbe é código de interface do produto, e
aqui React é motor de renderização server-side, sem DOM, sem navegador e sem arquivo entregue ao
frontend. O artefato precisa dizer isso explicitamente, porque um leitor futuro que veja `react` num
`package.json` deste repositório vai suspeitar do contrário.

**Rejeitadas**:
- **`pdfkit`/`pdf-lib` imperativo** — dependência menor e sem React, mas quebra de linha,
  justificação e paginação viram **código nosso**, na exata dimensão que o golden mede. Aumenta a
  superfície de defeito onde a prova é mais cara. _Viabilidade_: `pdf-lib` permanece candidato
  natural para a F4 (manipular boleto já emitido), que é outro problema.
- **HTML → PDF com navegador headless** — fidelidade máxima ao legado, que é literalmente HTML+CSS.
  Rejeitada pelo custo operacional: ~300 MB de Chromium, um processo externo a supervisionar e uma
  superfície de execução nova numa máquina que a F0 fixou como nativa e reinicializável.

### D2 — Onde vive a composição · pacote de domínio próprio, no molde de `@sysloc/regua`

**Escolhida**: um **pacote de domínio novo** que compõe o documento a partir de dados já resolvidos
e **declara a porta de renderização** que a infraestrutura satisfaz (ADR-0025). A borda HTTP
orquestra: lê o agregado, chama a composição, devolve bytes. **Viabilidade**: é o precedente medido
da 2a — `@sysloc/regua` compõe mensagem sem conhecer banco nem SMTP, e foi isso que tornou o domínio
exercitável sem infraestrutura de pé. Pacotes 5 → 6. **Trade-off aceito**: um pacote a mais no
monorepo e a fiação de build/test correspondente.

**Rejeitada**: compor dentro de `apps/api` — mais barato hoje, mas coloca a biblioteca de
renderização no processo que atende requisição sem fronteira nenhuma, e força a prova da composição
a subir aplicação. **Consequência dirigida**: a F4 (boleto, carnê) herda o lugar pronto em vez de
decidir de novo.

### D3 — Alvo da igualdade com o oráculo · texto composto, com um caso que renderiza de verdade

**O que está em jogo**: o golden `contrato-pdf.txt` é **saída extraída de PDF do wkhtmltopdf** — traz
as quebras de linha do layout dele e ligaduras tipográficas (`ﬁ`). Perseguir igualdade sobre texto
extraído do **nosso** PDF é perseguir o layout de outro motor, e a normalização necessária para
alcançá-la seria tão frouxa que a prova viraria carimbo (o risco que a `[DÚVIDA] C` nomeia).

**Escolhida**: a composição produz uma **representação textual intermediária** (blocos → parágrafos),
e é **sobre ela** que a igualdade normalizada com o golden corre, com a normalização **declarada,
fechada e provada por falsificação**. Somada a ela, **ao menos um caso renderiza o PDF de fato e
extrai o texto**, para provar que a renderização não perde, reordena nem trunca conteúdo — sem essa
segunda ponta, a etapa que produz o artefato entregue ficaria sem oráculo nenhum.

**Rejeitadas**: (a) **só texto extraído do PDF** — frágil por construção e cego quanto à causa de
cada diferença, além de tornar a normalização o lugar onde as divergências se escondem; (b) **só
representação intermediária** — barata e estável, mas deixa o passo final sem prova.

### D4 — Como `pdf_contrato_arquivo` sai · migração nova, nunca emenda da `0007`

**Escolhida**: **migração nova**. Ela é correta nos **dois** estados possíveis do banco, o que
dissolve a `[DÚVIDA] B` como bloqueio: o `migrar-banco.sh` registra `sha256sum` por arquivo aplicado
e **aborta** quando um arquivo já aplicado muda, e a unidade `sysloc-api.service` está **ativa**
nesta máquina contra o banco da operação — indício forte de que a `0007` já é imutável. Emendar
custaria a verificação como pré-condição bloqueante e, se a resposta fosse "sim", exigiria refazer o
trabalho. **Trade-off aceito**: um arquivo de migração a mais para uma remoção de coluna.

**Nota de escopo**: a remoção alcança **três** superfícies (migração, camada de dados e contrato
publicado). A do contrato é **mudança incompatível deliberada** e está coberta pelo CA-07 — a coluna
some do que se guarda **e** do que se publica.

### D5 — Como o ato sem sessão atravessa a RLS forçada · função `SECURITY DEFINER` que resolve o portador

**O que está em jogo**: sem sessão não há `app.empresa_id`, e sob RLS forçada isso significa
**leitura vazia em silêncio** — o pior modo de falha que a ADR-0008 fechou. Alguma coisa precisa
resolver o portador antes de existir contexto.

**Escolhida**: uma função **`SECURITY DEFINER`** de superfície mínima que recebe o **derivado do
segredo apresentado** e devolve o par que o ato precisa — empresa e objeto —, ou nada. A partir daí
o contexto é estabelecido **uma vez, na borda que o recebe**, e a confirmação corre sob RLS como
qualquer outra escrita (ADR-0024). **Viabilidade**: é o padrão já provado nas migrações `0008` e
`0010`, onde a série de contrato e a de cobrança atravessam a política pela mesma forma — nenhuma
delas aceita `empresa_id` por parâmetro, e esta também não deve.

**Rejeitadas**: (a) **política de RLS permissiva para a tabela do portador** — abriria leitura por
caminho declarativo cuja abrangência é difícil de auditar, e a auditoria da superfície RLS é hoje
uniforme; (b) **papel de banco próprio para a rota pública** — um terceiro papel a provisionar,
gerir e proteger, para atender um único ato.

**Trade-off aceito**: mais uma função com direitos elevados no banco. Ela é mínima, não aceita tenant
por parâmetro, e a prova precisa afirmar que ela **não** devolve nada além do necessário para
resolver o ato.

### D6 — Forma do portador e do que se guarda · aleatório de 256 bits, derivado por SHA-256 indexado

**Escolhida**: segredo **aleatório de 256 bits** de fonte criptográfica, transportado em codificação
segura para URL; o banco guarda **SHA-256** dele, com unicidade; a apresentação deriva e **procura
pelo derivado**. **Por que basta**: com 256 bits de entropia, o custo de reverter o derivado é
irrelevante — derivação cara existe para segredo de baixa entropia escolhido por gente, que não é o
caso. **Sobre "verificação que não revela pelo tempo"** (RN-11): a propriedade é alcançada porque
**segredo nunca é comparado com segredo** — a busca acontece sobre o derivado, e a recusa é a mesma
em todos os casos (RN-14). Onde sobrar comparação em memória, ela usa a primitiva de tempo constante.

**Rejeitadas**: (a) **derivação cara (scrypt/argon2)** — custo por verificação sem ganho para segredo
de alta entropia, e a API já paga scrypt no caminho de senha, onde ele é devido; (b) **HMAC com
chave de servidor** — daria defesa extra contra dump de banco isolado, ao custo de mais um segredo a
provisionar, custodiar e rotacionar, e de um modo de falha novo (chave perdida invalida todo portador
vivo). Fica registrada como o caminho de endurecimento futuro, se ele for pedido.

### D7 — Onde mora o estado da confirmação · registro próprio do portador, estado derivado do fato

**Escolhida**: um **registro próprio** para o portador — derivado, prazo e instante de consumo —,
porque RN-09 (reenviar invalida os anteriores) e RN-10 (reapresentar dentro da validade responde
sucesso) **exigem que o portador consumido continue existindo**: sem ele, a reapresentação não teria
como distinguir "já foi usado" de "nunca existiu". No cadastro do locatário grava-se o **fato** — o
instante em que a confirmação aconteceu —, e o estado que o produto publica é **derivado** dele
(ADR-0022: grava-se o que aconteceu, deriva-se o que se conclui).

**Rejeitada**: **tudo em colunas do locatário** — mais simples à primeira vista, mas um portador por
vez torna a reemissão destrutiva e apaga a informação de que o link anterior existiu, que é
exatamente o que a RN-10 precisa ler. **Trade-off aceito**: uma tabela nova sob RLS forçada e FK
composta, e um registro que cresce sem política de retenção — a retenção é F7, e este registro entra
na conta de lá.

### D8 — O disparo automático · enfileirado para o worker · **candidata a ADR**

**Escolhida**: cadastrar ou alterar o endereço **enfileira uma tarefa**; quem alcança o mundo é o
`worker`. **Viabilidade**: é o caminho de **menor** mudança estrutural, ao contrário do que parece —
o adaptador SMTP de produção, a barreira que falha fechado e a política de repetição já vivem no
`worker` e em `@sysloc/shared`; ensinar SMTP à API duplicaria a barreira mais delicada do produto
(`packages/regua/src/adaptador-smtp.ts` proíbe por escrito o ramo de ambiente que a duplicação
convidaria). O contexto de tenant viaja **na carga**, produzido por quem já detinha direito a ele
(ADR-0024). **Trade-off aceito**: BullMQ entra nas dependências da API e o disparo passa a depender
do Redis — que já é invariante do projeto, com AOF ligado.

**Rejeitadas**: (a) **enviar da API após o commit** — sem infra nova, mas coloca latência e falha de
SMTP no caminho do cadastro, e a única rede seria o reenvio manual; (b) **outbox no banco drenado
pelo worker** — entrega garantida sem perder atomicidade, e tecnicamente superior; rejeitada por
YAGNI nesta versão: acrescenta tabela, consumidor e política de drenagem para uma mensagem cuja
perda já tem saída de produto declarada (RN-13, o reenvio manual). Se a F4 trouxer efeito externo
que **não** possa se perder, o outbox entra por cima desta decisão sem contradizê-la.

> **Alcance transversal — recomendo registrar ADR**: *"efeito externo disparado por ato de negócio
> sai por fila, e não em linha na borda"* já governa a régua (2a), governa esta entrega e vai
> governar a F4 (emissão bancária) e a F5 (rotinas). Está hoje escrito só em código.
> `/agent-spec-adr-create "efeito externo de ato de negócio sai por fila, nunca em linha na borda"`

---

## 4. Restrições e invariantes técnicas (herdadas — não são decisão desta etapa)

1. **A resposta binária cabe no arcabouço vigente** — `ApiResponseCommonMetadata` estende
   `ResponseObject`, que aceita `content`. Logo a rota declara mídia e nome de arquivo **dentro** do
   contrato (ADR-0028) e a **cláusula de exceção daquela ADR não se ativa**. Não escreva exceção
   declarada onde ela não é necessária.
2. **O documento é rota com sessão** — `@ExigeChave` da área de contratos, na empresa dona
   (ADR-0011/0018). Não há caminho sem sessão para o documento (C1 do discovery, RN-05).
3. **A rota de confirmação é declarada `publicas`** — via `@RotaPublica()`, no controlador. A
   partição `semDeclaracao` permanece **vazia**, e a superfície é medida por **dupla medição
   independente** (molde do CT-635).
4. **Contexto de tenant nunca vem da requisição** (ADR-0024) — vale para a rota sem sessão e para a
   carga da tarefa enfileirada.
5. **Toda tabela nova nasce com `empresa_id`, RLS forçada e FK composta** (ADR-0008, invariante 1).
6. **O contrato deriva do esquema** (ADR-0016) e a chave exposta segue as três classes da ADR-0017 —
   contrato por código legível.
7. **A sub-fatia irmã não se altera** — régua, política de aviso, registro de envio e elegibilidade
   permanecem como foram provados. O estado de confirmação é **informativo** e não entra em
   elegibilidade (RN-06, CA-16).
8. **Nada de frontend**, inclusive a página que recebe o link — gatilho de parada.
9. **Protocolo Antirregressão** em toda edição; a baseline é **1004 casos por pacote** e a superfície
   **86 rotas / 71 manipuladores**.

---

## 5. Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC**

- **Ferramenta de extração de texto do PDF** para o caso de ponta a ponta do D3 (dependência apenas
  de verificação). O que a decisão fixa é *que existe* esse caso, não com o quê ele lê os bytes.
- **Regra exata da normalização** do D3 — o que ela tolera em espaço, quebra de linha, ligadura
  tipográfica e ordem dentro de bloco. Ela precisa nascer **fechada e provada por falsificação**
  (`[DÚVIDA] C` do discovery); uma normalização frouxa transforma a prova em carimbo.
- **Prazo de vida do registro do portador** — quando consumido ou vencido, ele fica. A retenção é
  F7; o TECH_SPEC só registra que este registro entra naquela conta.
- **Confirmação da `[DÚVIDA] B`** (a `0007` já aplicada a banco durável) — deixa de ser
  bloqueante pelo D4, mas vale medir e registrar, porque a resposta interessa ao **D20**, cujo
  gatilho fecha em silêncio.

**Dependências de produto — não decididas aqui**

- **Veredito escrito antes da execução** para os dois cenários de cancelamento capturados
  (*sem documento* e *sem imóvel*), com a divergência declarada correspondente — o PRD o exige
  (CA-05, CA-06, RN-15), e ele é **insumo**, não subproduto da execução.
- **Termo canônico** para o que o legado chamava de carimbo no documento — o glossário já usa
  *Carimbo* com outro sentido, e o PRD delega a canonização ao challenge.
- **Existência, no legado, de contratos reais** que exercitem cada eixo ainda sem oráculo
  (`[DÚVIDA] A`) — mede-se na task de prazo; ausência é **registrada como ausência medida**, e nada
  se escreve no sistema antigo para fabricá-la.

**Observação fora de escopo (não vira proposta)**

- O §10 do pré-refinamento registra o inventário de ADRs como **26 / 20**, e ele envelheceu com o
  registro da 0027 e da 0028 — o real, conferido no diretório e no `INDEX.md`, é **28 / 22**, que é
  o que o `CLAUDE.md` já diz. Nada a corrigir no código; a nota existe só para que ninguém
  "conserte" a contagem para o número menor ao ler o discovery.
