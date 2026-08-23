# Tech Alignment — `automacoes-agendadas/v1`

| | |
|---|---|
| **Feature** | Automações agendadas — F5, fatia (ii) |
| **Versão** | v1 |
| **Framework** | SDD |
| **Variante** | `backend` |
| **Definição** | `docs/prds/features/automacoes-agendadas/v1/prd.md` |
| **Discovery lido** | `docs/specs/features/automacoes-agendadas/v1/pre-refinement.md` · `insumo-do-pre-refinamento.md` |
| **ADRs consultadas** | 0008, 0009, 0021 **(pelas duas emendas)**, 0022, 0024 **(pelas duas emendas)**, 0025, 0026, 0029, 0031 |
| **Data** | 2026-08-22 |
| **Status** | Decidido |

> ⚠️ **Decisões auto-resolvidas pela regra A1** (`.claude/rules/autonomia-do-run.md`, escopo
> universal): o checkpoint da Fase 3.1 foi **formulado com direção recomendada e adotado** em vez de
> pausar. Todas reversíveis.

---

## Contexto técnico

O produto tem seis filas, um processo de trabalho supervisionado e **nenhum produtor periódico**.
Cinco filas são alimentadas por ato de borda; a da régua **não tem produtor algum**. O que falta é a
camada de **provocação**: quem, sem requisição, decide que é hora e enfileira.

Três invariantes do projeto governam essa camada e não são negociáveis aqui:

- **O contexto de tenant nunca vem da requisição, e fora dela vem da carga do trabalho** (ADR-0024),
  aberto uma vez na borda que a recebe, pelo escritor único.
- **O isolamento é do banco, não da aplicação** — as tabelas de negócio estão sob `FORCE ROW LEVEL
  SECURITY` com política nominal. Medido: a tabela de cobrança está nessa condição.
- **A hora e a data do domínio vêm do banco** (ADR-0026), nunca do relógio do processo.

E dois fatos medidos moldam quase todas as decisões abaixo:

1. **O processo de trabalho é um serviço supervisionado de tipo simples, sem linha de comando** — não
   existe hoje um executável que "faça uma passagem e saia".
2. **O projeto não usa gatilho de banco em lugar nenhum** — zero, em quinze migrações. Toda garantia
   estrutural é feita por restrição declarativa ou índice único parcial.

---

## Decisões

### D1 · O gatilho do SO provoca; o trabalho continua no processo de trabalho

**Em jogo**: o gatilho precisa executar *algo*, e o processo de trabalho é daemon.

**Escolhida — processo efêmero de despacho**: o gatilho executa um processo curto que abre a unidade
de trabalho, decide o que enfileirar, enfileira e termina. Todo trabalho de domínio continua correndo
onde já corre.

Rejeitadas:
- **Trabalho em linha no processo do gatilho** — duplicaria a composição de portas, a decifra do
  segredo operável e o contexto de tenant fora do lugar onde a ADR-0025 os injeta. Cada rotina
  reconstruiria o mundo.
- **Agendamento interno da biblioteca de fila** (trabalho repetível) — contraria a decisão 30
  refinada, que põe o gatilho no SO **de propósito**, pela experiência medida de agendador embutido
  parar sem aviso. Não reabrir.

**Trade-off aceito**: um artefato executável a mais no build, e o custo de partida de um processo por
disparo. Em troca, o trabalho tem um lugar só, e o gatilho é substituível sem tocar em domínio.

---

### D2 · O despachante enumera e enfileira; não pergunta quem tem trabalho

**Em jogo — e este é o ponto que a medição reformulou.** O discovery propôs *"uma consulta por minuto
que devolve as empresas com trabalho"*, e o argumento era custo. Medindo, o problema é outro e é
maior: **essa pergunta é cross-tenant sobre dado tenantizado**. A tabela de cobrança está sob
isolamento forçado com política nominal; o índice parcial que a régua usa é ancorado no
identificador da empresa. Não existe consulta que responda *"quais empresas têm candidata"* sem
**uma travessia nominal nova** — e a ADR-0024, na emenda de 2026-08-13, declara **duas** leituras
legítimas sem contexto e o discriminador que separa a segunda de um contorno do isolamento. Uma
terceira exigiria repetir toda a maquinaria: papel sem conexão, de propósito único, política própria,
concessão mínima, execução revogada do público.

**Escolhida — enumerar as empresas ativas e enfileirar sem perguntar pelo trabalho.** A enumeração de
tenants é a **primeira** leitura legítima sem contexto da ADR-0024, e ela vive no schema sem noção de
tenant. Cada trabalho enfileirado leva o identificador da empresa — que é exatamente o caso que a
emenda de 2026-08-18 autoriza, pois **quem enfileirou já detinha direito a ele**. A decisão de haver
trabalho passa para dentro do próprio trabalho, sob contexto, onde o índice parcial já é alcançado.

Rejeitadas:
- **Travessia nominal de propósito único** que responda o conjunto de empresas com candidata, sem
  devolver dado de negócio. Tecnicamente conforme e a mais eficiente. Rejeitada por **custo
  desproporcional**: instala um furo declarado no isolamento para poupar trabalho que já é barato, e
  cada furo desses é superfície permanente de auditoria. Se a medição futura mostrar que o volume de
  disparos pesa, **é esta a alternativa a reabrir** — e aí vira candidata a ADR.
- **Laço que abre contexto por empresa e pergunta antes de enfileirar** — conforme, mas troca N
  trabalhos baratos por N transações mais uma decisão duplicada: o predicado passaria a existir no
  despachante *e* no trabalho.

**Trade-off aceito**: passagens que não encontram trabalho existem, e são o custo de não furar o
isolamento. Ele é contido por três propriedades que já existem — a régua **seleciona por índice
parcial** em vez de varrer; a idempotência dela vem do predicado, não de guarda; e a **RN-15 proíbe
registrar passagem sem efeito**, de modo que a passagem vazia não deixa rastro. É o oposto do defeito
do sistema antigo, que varria a base inteira **e** escrevia a cada minuto.

⚠️ **Isto não reabre a decisão 25.** Ela quer que o desperdício acabe; a forma que ela supunha
pressupunha um horário pontual, e o campo real é uma **janela** — que o glossário canoniza como
*"quando é permitido, nunca quando acontece"*.

---

### D3 · Uma leitura de estado, com o histórico recente embutido

**Em jogo**: é a **última superfície** que este repositório publica antes do congelamento. Errar por
falta é dívida sem correção possível; errar por excesso congela superfície que ninguém pediu.

**Escolhida — uma leitura de estado por empresa, com o histórico recente embutido e limitado.**
Ancorada no molde da casa, que é uniforme e medido: cada área de configuração publica **uma** leitura
de estado corrente, e leitura por identificador **só onde há recurso identificável** (o lote de
emissão tem; a identidade, o certificado e a entrega da notícia não têm).

Rejeitada:
- **Duas superfícies — estado corrente e histórico paginado à parte.** É o desenho certo *se* a tela
  precisar percorrer meses. A decisão 31 descreve *"última execução, próxima esperada, falhas
  recentes"* — todas de horizonte curto —, e a retenção fechada em 90 dias limita o conjunto por
  construção. Publicar a segunda superfície "por precaução" congela o que não se provou necessário.

**Trade-off aceito, e a condição de reversão é explícita**: se a tela vier a exigir percurso longo,
será preciso ampliar a leitura existente em vez de acrescentar outra — o que é possível porque **saída
é contrato aberto** (`.claude/rules/contrato-publicado.md`), e campo novo na saída nasce sem quebrar
cliente publicado. É a assimetria que torna esta a escolha reversível, e a outra não.

⚠️ **A leitura não se junta à de saúde de infraestrutura existente**, que atende sem sessão e é de
outra natureza. Nome parecido, alcance oposto.

---

### D4 · Registro de execução tenantizado, com as contagens do oráculo

**Escolhida — decisão direta**, determinada pelo projeto: registro **por empresa**, no schema
tenantizado, com identificador de empresa, isolamento e chave estrangeira composta (invariante 1),
seguindo o molde de índice de histórico que **cinco tabelas já usam**. Não é caso da ADR-0031, que
governa tabela **sem** dono-empresa.

O que ele guarda é determinado pelo oráculo: o golden versionado do encerramento já devolve
`total_candidatos`, `total_encerrados`, `total_ignorados` e o **motivo** de cada descarte. Essas
contagens são o conteúdo do registro — em vocabulário do produto (RN-19), não do processo.

**Trade-off aceito**: rotinas diferentes produzem contagens diferentes, então o registro carrega um
corpo variável em vez de colunas fixas por rotina. A forma exata é do TECH_SPEC.

---

### D5 · Rotina parada se detecta pela ausência de registro, não por evento

**Em jogo — e o discovery não viu isto.** O mecanismo de falha do supervisor dispara quando a unidade
**falha**. Rotina que **não executou** — unidade desabilitada, gatilho não instalado, máquina fora do
ar prolongada — **não produz evento algum**. Alerta ancorado só em falha é cego exatamente para o
defeito que a decisão 31 quer cobrir: *"nada avisa quando uma rotina para"*.

**Escolhida — duas metades complementares**:
1. **Falha** → mecanismo do supervisor, por rotina, para o operador. É o que a decisão 31 pede e sai
   de graça.
2. **Ausência** → **derivada do registro de execução**: comparar a última execução de cada rotina
   contra o limiar próprio dela (RN-17). A mesma derivação serve à leitura do Admin (D3) e à
   vigilância — **uma regra, dois consumidores**.

A vigilância que compara os limiares é, ela própria, uma rotina agendada.

Rejeitadas:
- **Processo observador dedicado** — introduz um serviço supervisionado novo para um trabalho de uma
  consulta. Over-engineering, e o observador também pode parar.
- **Batimento gravado a cada passagem** — contraria a **RN-15** frontalmente: passagem sem trabalho
  passaria a gravar, que é o defeito de 12 MB do sistema antigo com outro nome.

**Trade-off aceito, declarado**: a vigilância **não se vigia**. Se ela mesma parar, a falha dela cai
na metade 1 (o supervisor), mas a parada silenciosa dela não é detectada por nada dentro do produto.
Fechar essa recursão exige observação **de fora**, que é da F7 e não desta fatia.

---

### D6 · O `D44` não fecha aqui, e o gatilho dele **não** disparou

**Em jogo**: esta fatia cria o **terceiro** escritor do par contrato-vigente / situação-do-imóvel.

**Escolhida — não introduzir a restrição, e registrar o agravamento.**

A leitura do gatilho é literal e importa: o `D44` dispara *"na fatia que criar no banco a restrição
pareando as duas colunas"*. Criar essa restrição **não é requisito de nada** que o PRD pede — o
gatilho, portanto, **não disparou**; o débito continua aberto legitimamente.

E a viabilidade pesa contra fechá-lo aqui: a restrição é **entre duas tabelas**, o que restrição
declarativa não expressa. Ela exigiria **o primeiro gatilho de banco do projeto** — medido: **zero em
quinze migrações** —, que é decisão transversal e candidata a ADR, muito além do escopo desta fatia.
O que já existe e continua valendo é o índice único parcial que garante **um contrato vigente por
imóvel**; o que falta é o pareamento com a situação do imóvel.

**O que esta fatia faz em vez disso**: o encerramento escreve as duas pontas **na mesma unidade de
trabalho**, que é a propriedade pela qual a ativação de contrato já mantém o par coerente — e o
docblock daquela sequência a declara por extenso. A fatia não amplia a janela de corrida existente;
acrescenta um escritor que **nasce com a disciplina certa**.

**Trade-off aceito**: o débito segue aberto, e o agravamento (terceiro escritor) precisa ser
**anotado na §2 da fatia**, não silenciado.

---

### D7 · O banco decide o dia; o gatilho apenas provoca

**Em jogo**: o gatilho do SO usa o fuso do sistema; o domínio usa a data corrente do banco
(ADR-0026). Medido: **nenhuma das duas unidades declara fuso** — hoje acerta por acidente, porque a
máquina está no fuso da operação.

**Escolhida — assimetria explícita, com as duas metades**:
1. **A data que decide é sempre a do banco.** Nenhuma rotina deriva "hoje" do relógio do processo. Já
   é a regra da régua, e a única rede daquele defeito é uma asserção estática — a mesma classe de
   prova se aplica às rotinas novas.
2. **Declarar o fuso nas unidades**, para o horário de disparo deixar de depender do acidente.

Rejeitada:
- **Disparar mais cedo e deixar o trabalho decidir** — funciona, mas troca uma dependência
  compreendida por uma margem arbitrária, e a margem é exatamente o tipo de constante que ninguém
  revisa.

**Trade-off aceito**: o instante do disparo e o dia do domínio continuam vindo de relógios distintos.
A assimetria é deliberada — o gatilho **provoca**, e provocar cedo ou tarde por minutos não muda
resultado, porque quem decide o que é "vencido" é o banco. É o que impede a rotina de 00:02 de
encerrar contrato de ontem.

---

### D8 · O expurgo vira rotina própria, em vez de andar de carona

**Em jogo**: o expurgo da retenção da notícia **já existe** e já usa o corte de 90 dias — mas é
chamado **de dentro do processamento de uma notícia**. Consequência medida: quando a entrega da
notícia está desabilitada — que é um estado **suportado e declarado** do produto —, nenhuma notícia
chega, e **o expurgo para junto**. A retenção deixa de ser cumprida exatamente na empresa em que
menos se olha.

**Escolhida — promover o expurgo a rotina própria de manutenção**, reusando a operação de expurgo que
já existe (não reescrevê-la) e acolhendo os outros dois descartes que o PRD pede: o registro de
execução e os boletos guardados.

Rejeitada:
- **Manter o expurgo de carona e acrescentar os novos do mesmo jeito** — propaga um acoplamento cuja
  falha já é conhecida, e faz a retenção depender do volume de tráfego.

**Trade-off aceito**: os três descartes têm alcances diferentes — um é tenantizado, outro é conteúdo
guardado fora do banco. A rotina os trata como itens distintos de uma passagem, não como um mecanismo
genérico de expurgo. **Nenhuma abstração de "expurgo configurável"**: são três alvos conhecidos.

⚠️ **Isto fecha, pelo mecanismo, os dois débitos cujo gatilho é literalmente "a F5, que traz o
agendamento"** — o dos boletos guardados e o da notícia sem quem a reprocesse.

---

## Candidatas a ADR

**Nenhuma.** As três decisões de maior alcance apoiam-se em ADR **já vigente**, e nenhuma a estende:

- o contexto do trabalho e a enumeração de tenants (D2) — ADR-0024, pelas **duas** emendas;
- a transição de estado sem ator humano (o encerramento) — ADR-0021, pela **emenda de 2026-08-22**,
  registrada antes desta etapa;
- a fonte do tempo (D7) — ADR-0026.

⚠️ **Duas ficam pré-qualificadas caso a condição delas chegue**, e ambas estão nomeadas acima como
alternativa rejeitada, não como proposta: a **travessia nominal de terceira leitura sem contexto**
(D2) e o **primeiro gatilho de banco do projeto** (D6). Se qualquer uma for reaberta, o caminho é
`/agent-spec-adr-create` **antes** da implementação, não durante.

---

## Restrições e invariantes que a implementação herda

- **O gatilho é do SO, com recuperação do disparo perdido** — decisão 30 refinada; instalação
  idempotente; **não reabrir**.
- **Contexto de tenant vem da carga**, aberto uma vez na borda que a recebe, pelo escritor único
  (ADR-0024). Nenhuma sessão de serviço sintética.
- **A carga leva o identificador de empresa** porque quem enfileira já detinha direito a ele — e a
  cláusula de exclusão da emenda de 2026-08-18 (entrada de fato de terceiro) **não se aplica** aqui.
- **Toda tabela de negócio nasce com dono-empresa, isolamento e chave estrangeira composta.**
- **A data e a hora do domínio vêm do banco** (ADR-0026).
- **Portas chegam por parâmetro** (ADR-0025) — a mesma injeção vale para operação e verificação, sem
  bandeira nem ramo que escolha entre elas.
- **Efeito externo cujo resultado não compõe a resposta sai por fila** (ADR-0029).
- **Estado de fato financeiro é derivado, nunca movido por rotina** (ADR-0022 e RN-14). É a razão de
  duas rotinas do sistema antigo não terem sucessora, e o ponto merece marcador `DECISÃO FECHADA` no
  código, com `REVERTER EXIGE` citando a ADR.
- **Entrada fechada, saída aberta** — é o que torna o D3 reversível.
- **A superfície publicada é afirmada por igualdade de conjunto com controle antivácuo**, e a âncora
  sobe no mesmo diff da publicação. Superfície medida hoje: **105 rotas / 90 manipuladores**.
- **O processo de trabalho e o de borda sobem sozinhos após reinício** — o gatilho novo entra nessa
  prova (invariante 7).

---

## Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC:**

1. **Granularidade do artefato de despacho** (D1): um executável por rotina, ou um só que recebe qual
   rotina executar. Ambos servem; o segundo tende a menos duplicação de composição raiz, o primeiro a
   unidades mais legíveis.
2. **Forma do corpo variável do registro de execução** (D4) — contagens por rotina.
3. **Onde a derivação de "rotina atrasada" mora** (D5), dado que ela tem dois consumidores.
4. **Como o encerramento em massa se relaciona com o índice único parcial de vigência** — encerrar
   libera a posição, e a ordem das escritas dentro da unidade importa.
5. **Se a vigilância e o expurgo compartilham uma passagem** ou são rotinas distintas.

**Dependências de produto — não decididas aqui:**

6. **Prazo de retenção dos boletos guardados.** O PRD fixou 90 dias para o **histórico de execução**,
   e a retenção da notícia já usa 90. O prazo do conteúdo guardado é decisão de produto e **não está
   tomada** — a projeção de crescimento é de ~1,4 GB/mês.
7. **Encerramento manual pela tela** permanece decisão de produto não tomada, e o PRD a registra como
   fora do escopo.

**Observação fora do escopo — não é proposta:**

8. O `D44` teria solução **estrutural** se a situação de locação do imóvel fosse **derivada** do
   contrato vigente, em vez de gravada — que é exatamente o mecanismo pelo qual a ADR-0022 dissolveu
   duas rotinas nesta mesma fatia. Isso é refactor de área que esta feature não exige, e fica
   registrado como observação para quem um dia pagar o `D44`.
