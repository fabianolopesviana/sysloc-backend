# INTENT – Publicação e Backup

## 1. Identificação

- **Nome da Tarefa / Feature**: `publicacao-e-backup`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-25
- **Status**: Aprovado
- **Relacionados**:
  - `docs/specs/features/publicacao-e-backup/v1/pre-refinement.md` — discovery que originou esta INTENT
  - `docs/plano-backend-novo/plano-execucao.md` §F7 — o desenho da preservação, já travado
  - `CLAUDE.md` — os sete itens do marco de entrega do backend
  - **ADR-0037** — política de limitação de abuso na borda pública (registrada em 2026-08-25, antes desta INTENT)
  - ADR-0005 (segredos fora da árvore versionada) · ADR-0006 (o ambiente que verifica nunca é o que opera)

---

## 2. Contexto & Motivação

**O produto está pronto e inalcançável, não é recuperável, e não trabalha sozinho.** São três
lacunas distintas entre o que foi construído e o que existe no servidor, e as três aparecem juntas
no instante em que alguém tenta usar o sistema:

- **Inalcançável.** O aplicativo do cliente pede dados ao produto e recebe de volta a própria página
  do aplicativo. O pedido não falha — ele é atendido com o conteúdo errado —, de modo que o defeito
  aparece como erro do aplicativo e não do servidor. O painel do operador, publicado pelo mesmo
  produto, já responde corretamente: a lacuna é só do endereço do cliente.
- **Não recuperável.** Não existe cópia de segurança do banco de dados onde os cadastros do cliente
  vão nascer. O plano já eliminou a possibilidade de voltar atrás por decurso de prazo, e assumiu
  como rede de segurança justamente uma cópia preservada — que hoje não é produzida.
- **Não trabalha sozinho.** As **Rotinas agendadas** entregues e aprovadas não estão instaladas no
  servidor. Sem elas não há **Aviso** ao locatário, não há conferência de liquidação, não há
  encerramento de contrato por vencimento de prazo, não há retomada de **Notícia do provedor** parada
  e não há vigilância sobre as próprias rotinas.

**Por que agora.** A urgência não é de calendário, é de premissa: o cliente **não usa o sistema
antigo**, está esperando o produto novo, e os cadastros dele vão **nascer** pela tela do produto
novo. Isso muda a natureza do risco. Enquanto o sistema antigo operava, um incidente custava
retrabalho; a partir do primeiro cadastro no produto novo, o mesmo incidente custa **dado que não
existe em nenhum outro lugar**.

**Custo de não fazer.** Sem a primeira lacuna fechada, o cliente não usa o produto — o trabalho
inteiro permanece invisível. Sem a segunda, o primeiro incidente de disco é irreversível. Sem a
terceira, o produto atende quem entra e **não cobra ninguém**: um sistema que parece funcionar
enquanto deixa de fazer exatamente aquilo para o que foi contratado — e essa é a falha que ninguém
percebe no dia em que acontece.

---

## 3. Objetivo

- **Tornar o produto alcançável** pelo aplicativo do cliente, no endereço dele, entregando os dados
  pedidos em vez da página do aplicativo.
- **Tornar o produto recuperável**, produzindo diariamente uma cópia de segurança do banco de dados e
  dos segredos de operação, cuja validade seja **demonstrada por restauração**, não presumida.
- **Fazer o servidor executar o que o produto entrega** — as **Rotinas agendadas** aprovadas passam a
  correr sozinhas, e o que sobe após um reinício é o conjunto completo, não um subconjunto herdado.
- **Proteger a superfície no instante em que ela deixa de ser local**, aplicando a política já
  decidida na ADR-0037 e liquidando os pontos de exposição que aguardavam este momento.

---

## 4. Resultado Esperado

Um observador externo constata, sem acesso ao código:

1. **O aplicativo do cliente conversa com o produto.** Um pedido de dados ao endereço do cliente
   volta como dado, com o tipo de conteúdo correspondente — e não como página. A verificação afirma o
   **tipo do conteúdo**, nunca apenas o código de resposta: o modo de falhar de hoje é uma resposta
   bem-sucedida com o corpo errado, que um teste de status aprovaria.
2. **Existe de onde voltar.** Uma cópia do dia é produzida sozinha, na janela noturna já fixada pelo
   plano; cópias antigas saem por idade; e **uma restauração foi executada num banco de dados vazio**,
   com o resultado conferido. É a restauração que conta como prova — a existência do arquivo não é
   prova de nada.
3. **O produto trabalha sem que ninguém peça.** Cada **Rotina agendada** aprovada está instalada,
   habilitada e com próxima execução conhecida; nenhuma delas depende de alguém lembrar de acioná-la;
   e o conjunto sobrevive a um reinício do servidor.
4. **A exposição é deliberada.** A superfície publicada está protegida conforme a decisão registrada,
   os pontos de exposição que aguardavam a publicação foram reavaliados **contra medição** e fechados
   ou reescritos conforme o que a medição mostrar, e nenhuma entrada legítima de terceiro passou a ser
   recusada por causa da proteção nova.
5. **Nada regrediu.** A superfície publicada permanece **idêntica em conjunto** — nada nasce, muda ou
   sai —, a suíte permanece verde na mesma contagem, e as baterias de verificação foram **executadas**
   nos dois extremos do trabalho, não apenas declaradas executáveis.

---

## 5. Restrições

**Decisões já tomadas — fora de negociação:**

- **O cliente não usa o sistema antigo, e os cadastros vão nascer pela tela do produto novo**
  (decisão do usuário, 2026-08-25). É a premissa que autoriza esta fatia a existir agora. **Se ela
  deixar de valer, o trabalho PARA e escala** — não se decide sozinho seguir mesmo assim.
- **O desenho da preservação está fixado** no plano de execução (§F7, item 1) e **não se rediscute**.
  O que esta fatia decide é apenas o que o plano deixou em aberto.
- **A prova é a restauração, não a cópia.**
- **Não há volta atrás por decurso de prazo** — a rede de segurança é a cópia preservada.
- **A superfície publicada está congelada.** Nada nela nasce, muda ou sai; as âncoras que a fixam
  saem intactas.
- **O sistema antigo permanece intacto e de pé.** Desligá-lo não pertence a esta fatia.
- **A política de limitação de abuso já está decidida** (ADR-0037) — esta fatia a aplica, não a
  redecide.
- **Português brasileiro em tudo, e exclusivamente Opus** — sessão principal e todo subagente.
- **Nada de frontend.** Nenhuma linha de código do aplicativo, nenhum arquivo na máquina local do
  usuário. Pedido nesse sentido é gatilho de parada.

**Limitações conhecidas:**

- **O trabalho exige o usuário presente.** Parte das verificações precisa de privilégio
  administrativo, e obtê-lo neste servidor pede interação humana — nenhum agente as executa sozinho.
  São necessárias **duas janelas assistidas**: uma no início, para estabelecer a linha de base, e uma
  no fim, para compará-la caso a caso. Elas não são etapas do trabalho; são a **moldura** em volta
  dele, porque o próprio trabalho altera a infraestrutura que as verificações medem.
- **A ordem entre as duas metades é questão de segurança, não de conveniência.** A preservação vem
  **antes** da publicação. A sequência inversa — expor à internet o banco de dados onde os dados do
  cliente vão nascer, sem cópia preservada — é a única irreversível deste trabalho.
- **A verificação automatizada existente não alcança o objeto desta fatia.** Ela não mede ponto de
  entrada público, nem relógio do sistema operacional, nem restauração — e a terceira lacuna do §2 é
  a prova disso: passou despercebida por uma suíte inteira verde.
- **O ambiente que verifica nunca é o que opera** (ADR-0006). Enquanto o sistema antigo estiver de
  pé, essa separação restringe o que pode ser exercitado aqui.
- **Nenhum segredo entra na árvore versionada** (ADR-0005) — o que a cópia preserva inclui segredos,
  e eles vivem fora do repositório.
- **Uma exposição herdada permanece aberta enquanto o caminho antigo existir**: material público
  servido pelo endereço antigo carrega credencial legível. Fechá-la depende de uma decisão de
  topologia que ainda não foi tomada.

**Fora desta versão:**

- Publicar o pacote de contratos que o aplicativo consome — é item próprio do marco de entrega.
- A prova do percurso do primeiro dia, o roteiro da virada e os adendos aos documentos de repasse.
- A **execução** da virada e a desinstalação do sistema antigo — pertencem a uma sessão operacional
  futura, e dependem do aplicativo já funcionando.

**Pontos ainda em aberto** (levantados no discovery, a resolver na primeira janela assistida — não
bloqueiam esta INTENT, mas condicionam o desenho):

1. Por quantos dias as cópias são preservadas.
2. Como a preservação do produto novo convive com a preservação já existente do sistema antigo, que
   ocupa a mesma janela noturna e o mesmo destino-pai.
3. Se o caminho antigo de consulta ao sistema legado sai ou permanece.
4. Se a primeira execução das **Rotinas agendadas** recém-instaladas produz algum efeito sobre dados
   existentes.

---

## 6. Checklist Final

- [x] INTENT descreve apenas O QUE / POR QUE
- [x] Objetivo claro e mensurável
- [x] Sem detalhes de implementação ou arquitetura
- [x] Resultado esperado específico
- [x] Restrições explícitas
- [x] Pronto para definição de SCOPE
