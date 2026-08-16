# Tech Alignment — `fundacao-bancaria` (v1)

## 1. Metadados

- **Feature**: `fundacao-bancaria` — fatia (i) de 3 da F4 (`integracao-bancaria-sicoob`)
- **Versão**: v1
- **Framework**: SDD
- **Variante**: `backend`
- **Documento de definição**: `docs/prds/features/fundacao-bancaria/v1/prd.md` (Aprovado, 2026-08-14)
- **Discovery lido**: `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md` ·
  `docs/plano-backend-novo/briefings/f4-integracao-bancaria-sicoob.md` · nenhum `handoff*.md` desta
  feature (o de `integracao-bancaria-configuravel/v1` é do produto legado e não é insumo técnico daqui)
- **ADRs consultadas com a `Decision` aberta**: 0001, 0008, 0009, 0011, 0016, 0017, 0018, 0020, 0022,
  0025, 0029, 0031
- **Data**: 2026-08-14
- **Status**: Decidido — pronto para o TECH_SPEC

---

## 2. Contexto técnico

O produto passa a guardar, pela primeira vez, um segredo **de terceiro que precisa ser usado**. Todos
os segredos que ele guarda hoje são verificáveis e irreversíveis — senha e portador de confirmação vão
para o banco como resumo criptográfico, e nada os recupera. O material que identifica a empresa perante
o provedor é o oposto: ele tem de voltar em claro, dentro do processo, a cada aperto de mão mútuo com o
provedor. Isso muda a classe do problema de *"provar que ninguém lê"* para *"limitar quem, quando e por
quanto tempo lê"*.

A fatia entrega três capacidades e nenhuma emissão: a **admissão** do material (conferido na entrada
contra a senha que o abre e contra a validade), a **publicação do que se pode dizer dele** (titular,
validade, impressão digital, autoria e o estado derivado da vigência) e um **ato de verificação** contra
o provedor, sem efeito colateral. Some-se a fundação numérica: um contador de escopo do SaaS inteiro,
cujo avanço não participa do desfazimento, que a fatia seguinte consome para numerar cada cobrança
perante o provedor.

Dois invariantes atravessam tudo o que segue. **O material nunca retorna** por nenhuma superfície do
produto — nem por consulta, nem por erro, nem por diagnóstico —, e a garantia é **medida, não lida**: o
precedente direto é o achado crítico da fase anterior, em que um segredo em claro alcançou o diário do
sistema por um caminho que a redação não cobria e que nenhuma revisão de código teria visto. E **não há
identidade de reserva**: a ausência de material próprio é uma recusa nomeada, jamais a identidade de
outra empresa.

### 2.1 Medições feitas para esta decisão (2026-08-14)

Duas soluções abaixo dependiam de um fato que o projeto registrava por memória. Foi medido, e o registro
estava errado:

| # | Medido | Consequência |
|---|---|---|
| N1 | `X509Certificate` **não** lê o material no formato em que o provedor o entrega (`ERR_OSSL_PEM_NO_START_LINE`) | ⚠️ A linha da stack do `CLAUDE.md` que atribui a `node:crypto X509Certificate` a *"leitura de `.pfx`"* é **imprecisa** — ver Pontos em aberto |
| N2 | A conferência de que a senha abre o material é obtenível pela API pública de TLS: senha correta cria o contexto; senha errada ou ausente levanta `mac verify failure` | A RN-03 e a CA-05 são satisfeitas **sem dependência nova** |
| N3 | Titular, validade e impressão digital são obteníveis por dois caminhos sem dependência nova — um por aperto de mão local (API pública) e outro por um acessório nativo **não documentado** | É o que torna a **D2** uma decisão real, e não um chute |
| N4 | `undici` **não é dependência do monorepo hoje** | A fatia a introduziria; ver **D6** e Pontos em aberto |

---

## 3. Soluções técnicas decididas

### D1 — Onde o material cifrado repousa

**Por que decidir**: define o que o backup precisa restaurar em conjunto, quem impõe o isolamento do
material entre empresas, e o que a instalação do zero precisa provisionar.

**Solução recomendada: D1-b — bytes cifrados na própria linha do certificado**, com cifra simétrica
autenticada e a chave vivendo fora da árvore, no arquivo de ambiente restrito que as unidades de serviço
já consomem.

Caminhos viáveis avaliados:

- **D1-a — arquivo no sistema de arquivos, referência no banco.** Espelha o desenho já existente para os
  bytes do boleto, que guarda caminho e nunca conteúdo.
  - _Exemplo:_ um arquivo cifrado por empresa, em diretório restrito, com a linha apontando para ele.
  - _Prós:_ o material não entra no dump do banco; o descarte é a remoção do arquivo.
  - _Contras:_ cria estado no sistema de arquivos que a instalação do zero precisa provisionar — e o
    débito **D39** já registra que o provisionamento tem lacuna. Pior: o backup da F7 passa a ter **duas**
    fontes que só valem restauradas juntas, e a linha presente com arquivo ausente é exatamente a classe
    de defeito que o discovery teve de resolver com re-obtenção automática no caso do boleto. Aqui não há
    de onde re-obter: o material vem do Admin.
  - _Viabilidade:_ reusa um padrão do projeto, mas o padrão nasceu para um fato de terceiro grande e
    recuperável. O material medido tem ~2,6 KB e é irrecuperável.
- **D1-b — bytes cifrados na própria linha (recomendada).**
  - _Exemplo:_ registro e renovação cabem numa unidade de trabalho só; restaurar o banco restaura a
    aptidão de cobrar, sem segundo passo e sem ordem entre passos.
  - _Prós:_ uma fonte só; o isolamento entre empresas é o que a política de linha do banco já impõe, e não
    permissão de diretório mantida à parte; o descarte que a RN-05 exige vira escrita na mesma transação
    da substituição, verificável por consulta.
  - _Contras:_ o dump passa a conter material cifrado. É aceitável porque a chave vive fora dele
    (invariante 3), mas **obriga a dizer isso por escrito** no item de backup da F7 — dump e chave nunca
    viajam no mesmo pacote.
  - _Viabilidade:_ reusa `@sysloc/db` inteiro (política de linha forçada, chave estrangeira composta,
    unidade de trabalho). Nenhuma dependência nova.
- **D1-c — cofre externo (KMS/Vault).**
  - _Contras:_ infraestrutura que este servidor não tem, num projeto declaradamente nativo e sem Docker.
    Over-engineering para a escala real.

**Decisão direta acoplada — a chave da cifra é única do SaaS, não por empresa.** Chave por empresa exigiria
guardá-la em algum lugar, e esse lugar seria o mesmo banco — o que não acrescenta barreira, só indireção.
Rotacionar a chave única obriga a recifrar o material de todas as empresas; é aceitável porque a renovação
já é por substituição e o volume é o número de empresas, não de cobranças.

**Trade-off aceito**: material cifrado dentro do dump do banco, com a separação chave × dump virando
cláusula do runbook de backup.

---

### D2 — Como o material é lido para publicar titular, validade e impressão digital

**Por que decidir**: é a única porta pela qual o produto aprende o que pode dizer sobre o certificado, e
a medição N1 derrubou o caminho que o projeto supunha existir.

**Solução escolhida: D2-a — aperto de mão TLS em laço local, usando apenas API pública** — escolha do
usuário no checkpoint, sobre as três medidas.

Caminhos viáveis avaliados:

- **D2-a — aperto de mão em laço local (escolhida).** Sobe-se um ponto de escuta TLS local com o material,
  conecta-se a ele e lê-se o certificado apresentado pelo par.
  - _Exemplo:_ medido devolvendo titular, validade e impressão digital completos.
  - _Prós:_ tudo o que usa é público e documentado; nada quebra em silêncio numa atualização do runtime.
  - _Contras:_ um aperto de mão pago no registro — ato raro, sob comando do Admin.
  - _Viabilidade:_ zero dependência nova.
- **D2-b — acessório nativo do contexto seguro.** Devolve o certificado codificado direto, e é muito mais
  curto.
  - _Prós:_ o caminho mais simples dos três; medido funcionando.
  - _Contras:_ apoia-se num acessório **não documentado** do runtime. Numa atualização ele pode sumir sem
    aviso, e some num caminho que decide se uma empresa está apta a cobrar.
  - _Rejeitada por:_ superfície não contratada num caminho que move dinheiro.
- **D2-c — biblioteca de terceiro que interpreta o formato.**
  - _Contras:_ dependência nova posta **exatamente sobre o segredo** que a fatia existe para conter, e
    nenhuma outra parte do projeto a usa.
  - _Rejeitada por:_ alarga a superfície de confiança no ponto de maior risco, sem resolver nada que N2 e
    N3 já não resolvam.

**Decisão direta acoplada — a conferência de que a senha abre o material usa a API pública de TLS (N2)**, e
o desfecho de senha errada é indistinguível do de material ilegível na resposta ao Admin, ainda que sejam
razões distintas no registro interno. É o que os fluxos alternativos do PRD pedem sem devolver conteúdo.

---

### D3 — Como o material atravessa a borda

**Por que decidir**: é a primeira rota do produto a **receber** bytes, e o que se decidir aqui vale para
todas as futuras. A ADR-0028 governa a rota que devolve bytes; não há decisão registrada para a que recebe.

**Solução recomendada: D3-b — conteúdo binário codificado em texto dentro do corpo estruturado**, com o
limite de tamanho declarado no próprio esquema.

Caminhos viáveis avaliados:

- **D3-a — corpo em partes múltiplas.** É o idioma consagrado de envio de arquivo.
  - _Prós:_ sem inchaço de codificação; comporta fluxo contínuo.
  - _Contras:_ exige extensão nova no servidor HTTP, e — o que pesa mais — o corpo deixa de ser descrito
    pelo esquema declarado. A **ADR-0016** decide que *"o esquema declarado no pacote de contratos é a fonte
    única: a conferência de entrada, o tipo da resposta e o documento publicado derivam dele"*. Abrir a
    exceção aqui a abre para toda rota de entrada de bytes que vier depois.
  - _Viabilidade:_ conflita com ADR ativa, e o conflito não é aparente — é direto.
- **D3-b — texto codificado no corpo estruturado (recomendada).**
  - _Exemplo:_ o material medido de ~2,6 KB vira ~3,5 KB codificados; o limite entra como restrição do
    esquema, e a recusa por tamanho sai pelo envelope de erro da ADR-0017, não pelo servidor HTTP.
  - _Prós:_ a ADR-0016 continua verdadeira sem exceção; nenhuma dependência nova; o contrato que o React
    importa descreve o campo, o que é o que torna o handoff confiável.
  - _Contras:_ ~33% a mais no corpo e uma decodificação a mais. Irrelevante na escala medida.
- **D3-c — envio em duas etapas** (reserva e depois envio).
  - _Contras:_ maquinaria de sessão de envio para 2,6 KB. Over-engineering claro.

⚠️ **Risco que a escolha carrega, e que a D4 fecha**: o material passa a ser **campo de um objeto
validado**, e objeto validado é precisamente o que uma falha de validação tende a ecoar de volta.

---

### D4 — Onde a fronteira do segredo se fecha

**Por que decidir**: é a restrição de método que o PRD declara e que a fase anterior pagou caro para
aprender. Errar aqui não produz teste vermelho — produz vazamento silencioso.

**Solução recomendada: D4-b — contenção estrutural na entrada, com a redação do registrador como segunda
barreira**, e a garantia afirmada por medição sobre a saída real, nunca por leitura do código.

Caminhos viáveis avaliados:

- **D4-a — confiar na redação existente.** O módulo compartilhado já tem entrada única de despacho e já
  nomeia a senha deste material por escrito.
  - _Contras:_ **provado insuficiente**. O achado crítico da sub-fatia anterior foi um segredo alcançando o
    diário do sistema por um caminho que a redação não alcança, e ele foi pego por medição. Confiar nela
    sozinha é reencenar a premissa que já falhou.
  - _Viabilidade:_ reusa o que existe, mas como **segunda** barreira, não como única.
- **D4-b — contenção estrutural mais redação (recomendada).** O material e a senha existem como valor
  apenas dentro do módulo que os cifra e decifra; não são campo de objeto que viaje para registro, erro,
  resposta ou carga de fila.
  - _Exemplo:_ os vetores desta fatia, nomeados para que a medição tenha alvo — o erro de validação do
    esquema (que carrega o corpo validado), o erro do cliente de banco (que carrega os parâmetros da
    consulta), o erro do cliente TLS (que carrega as opções do agente), o documento de contrato publicado
    (que pode carregar exemplo) e o diagnóstico da própria falha de leitura do material.
  - _Prós:_ fecha a **classe**, e não os caminhos um a um — é a lição que o Protocolo Antirregressão
    registra por extenso sobre o vazamento que sobreviveu a quatro correções pontuais.
  - _Contras:_ o módulo de cifra vira ponto de passagem obrigatório, com o custo de indireção que a
    ADR-0001 já aceitou para a porta.
- **D4-c — cifra de ponta a ponta, feita antes do envio.**
  - _Contras:_ exigiria código de frontend. **Fronteira do projeto** — não é caminho.

⚠️ **Ganho de desenho que precisa estar escrito**: o vetor exato da fase anterior **não existe nesta
fatia**, por construção. Os três atos são síncronos e permanecem em linha pela ADR-0029 — nenhum passa por
fila —, logo não há carga de tarefa a ser empurrada como argumento de comando. Isso é propriedade **desta**
fatia, e a fatia (ii), que terá fila e levará o mesmo material a ela, **não a herda**.

---

### D5 — Que superfície a porta do provedor declara nesta fatia

**Por que decidir**: a ADR-0001 nomeia cinco operações, e esta fatia exerce uma. Declarar as cinco agora
é decidir quatro assinaturas sem o caso de uso que as define.

**Solução recomendada: D5-b — a porta declara apenas o que a fatia exerce** (a verificação de que o
provedor aceita a identidade da empresa), mais o modelo canônico com o meio de recebimento previsto.

Caminhos viáveis avaliados:

- **D5-a — declarar as cinco operações da ADR-0001 desde já**, quatro sem implementação.
  - _Prós:_ a forma final fica visível, e a ADR fica literalmente atendida.
  - _Contras:_ quatro assinaturas escolhidas antes de existir quem as chame — a fatia (ii) as reescreveria,
    e reescrever porta publicada é o que a ADR-0025 encarece, já que o adaptador depende do domínio por
    compilação. É complexidade especulativa pelo nome que o catálogo do Gate 2 usa.
- **D5-b — só o que se exerce (recomendada).**
  - _Exemplo:_ esta fatia prova *"a identidade desta empresa é aceita pelo provedor"*; a fatia (ii)
    acrescenta emitir, consultar e dar baixa quando souber a forma delas, contra a API real.
  - _Prós:_ a cláusula que importa da ADR-0001 — *"nenhum campo, URL ou vocabulário específico de provedor
    cruza a porta"* — vale igual para uma operação ou para cinco. Declarar menos não cria dívida; declarar
    cedo demais cria.
  - _Contras:_ a ADR-0001 nomeia as cinco, então a fatia precisa **dizer por escrito** que as outras chegam
    com a fatia que as exerce — senão a divergência é lida como omissão por quem chegar depois.

**Decisão direta — onde a porta mora.** Não é ponto: a **ADR-0025** já decide que *"o pacote de domínio
declara o tipo do dado que atravessa e a interface da porta; o adaptador importa dele"*, e o precedente do
projeto põe domínio e adaptador **no mesmo pacote** (o adaptador de e-mail vive dentro do pacote da régua).
Um pacote novo, com a porta e o adaptador do provedor dentro, e a direção de dependência apontando do
adaptador para o domínio.

---

### D6 — Ciclo de vida do cliente que fala com o provedor

**Por que decidir**: é o que determina por quanto tempo o material decifrado fica residente na memória do
processo.

**Solução recomendada: D6-b — construir o cliente por chamada nesta fatia**; o agrupamento de conexões por
empresa entra quando a emissão em lote existir.

Caminhos viáveis avaliados:

- **D6-a — agrupamento de conexões por empresa desde já.** É o que o discovery esboça.
  - _Prós:_ poupa apertos de mão na emissão mensal em lote.
  - _Contras:_ o agrupamento **mantém o material decifrado residente por tempo indefinido**, e o único
    consumidor desta fatia é um ato raro e sob comando. Paga-se o risco antes do benefício. Pior: a
    invalidação do que está agrupado (renovação, vencimento) vira máquina de estado sem nenhum caso de uso
    que a exercite — a fatia não tem como prová-la.
- **D6-b — por chamada (recomendada).**
  - _Exemplo:_ o ato de verificação decifra, monta o cliente, fala com o provedor e descarta. A janela de
    residência do segredo é a duração do ato.
  - _Prós:_ a decisão de segurança e a de simplicidade coincidem; e o agrupamento entra na fatia (ii)
    tendo **quem o exercite**, com a invalidação provada em vez de suposta.
  - _Contras:_ um aperto de mão por ato — irrelevante na frequência real.

⚠️ **Consequência que muda uma premissa do discovery, e que o TECH_SPEC deve fechar por medição.** O
discovery declara `undici` como o meio do mTLS, e N4 mediu que ele **não é dependência do monorepo hoje**.
O que `undici` acrescenta sobre o cliente nativo é justamente o **agrupamento de conexões** — que a D6-b
adia. Se a medição confirmar que o cliente nativo entrega o aperto de mão mútuo por chamada, **introduzir
`undici` nesta fatia é dependência sem benefício exercido**, e ela pertence à fatia (ii). A decisão é do
TECH_SPEC, por medição; a recomendação é adiar. (O `CLAUDE.md` já declara `undici` na stack para este fim,
então adiá-la não contraria plano nenhum — apenas escolhe a fatia em que ela é paga.)

---

### D7 — Como a aplicação alcança o contador de escopo do SaaS

**Por que decidir**: o mecanismo já está decidido por ADR; o que sobra é a superfície pela qual a aplicação
o consome — e ela é o que impede o contador de avançar por caminho não previsto.

**Solução recomendada: D7-b — função no banco, sem parâmetro de empresa, com privilégio de execução
concedido nominalmente ao papel da aplicação** e nada concedido sobre o contador em si.

Caminhos viáveis avaliados:

- **D7-a — conceder o uso do contador diretamente ao papel da aplicação.**
  - _Prós:_ nenhuma função a escrever; o caminho mais curto.
  - _Contras:_ perde-se o ponto único de passagem — qualquer consulta do papel da aplicação avançaria o
    contador do SaaS, e as guardas de faixa e de forma deixariam de existir num número que **nunca volta
    atrás**.
  - ⚠️ _Leitura obrigatória antes de invocar o precedente:_ as duas séries existentes recusam essa concessão
    sob marcador `DECISÃO FECHADA`. O `REVERTER EXIGE` daqueles marcadores fala do contador **da cobrança**,
    cujo escopo por empresa e ano é imposto pela função — argumento que **não alcança** este contador, que
    não tem escopo por empresa a impor. A recusa aqui se sustenta por razão **própria** (ponto único de
    passagem), não por extensão daquele marcador. **Nada nesta fatia altera, move ou remove aqueles
    marcadores**: eles governam a série da cobrança e seguem valendo inteiros.
- **D7-b — função sem parâmetro (recomendada).**
  - _Exemplo:_ o produto passa a ter três séries — duas leem a empresa do contexto da transação e uma não
    lê nada. A **ausência de parâmetro é a declaração de escopo**, do mesmo modo que, nas outras duas, a
    ausência de parâmetro de empresa é o que torna o pedido cruzado irrepresentável.
  - _Prós:_ a ADR-0020 fixa o mecanismo (*"contador do próprio banco … cujo avanço não participa do
    desfazimento"*), e a ADR-0031 fixa o lugar (*"fora do schema de negócio … e não carrega `empresa_id`"*).
    Esta decisão só escolhe a superfície, e escolhe a que já é idioma do projeto.
  - _Contras:_ uma terceira forma de série a manter.

**Simplificação que o escopo permite, e que precisa estar escrita para não ser lida como esquecimento**: a
série da cobrança precisa de **duas** funções porque o escopo dela inclui o ano e, portanto, nasce em tempo
de execução. O escopo do SaaS **não tem parte variável** — o contador nasce uma vez, na migração. Logo,
**uma função só**, e nenhuma criação em tempo de execução. É a ADR-0020 instanciada com *menos* maquinaria,
não com mais.

**Decisão direta acoplada — a composição das 18 posições.** O contador entrega o número; a composição do
identificador (prefixo de competência mais o número preenchido à esquerda) é do lado da aplicação, no molde
das duas séries existentes. E o prefixo tira a competência da **mesma fonte de "hoje" que o banco já
publica** — nunca do relógio da aplicação. Nesta fatia não há emissão, então a competência é a do instante
do consumo; a medição do sistema antigo confirma que ali o prefixo também sai do instante da emissão e é
**decorativo**, já que quem garante a unicidade é a sequência.

---

### D8 — Onde o estado da vigência é derivado

**Por que decidir**: a RN-04 proíbe marca gravada, mas não diz de que lado da fronteira a derivação
acontece — e o projeto tem precedente forte para os dois lados.

**Solução recomendada: D8-b — derivar na aplicação**, a partir da validade lida do certificado contra a
data corrente que o banco publica.

Caminhos viáveis avaliados:

- **D8-a — visão no banco**, no molde da visão que publica o estado da cobrança.
  - _Prós:_ o estado fica disponível a qualquer consulta; é o precedente mais forte do projeto, e a fatia da
    régua chegou a pôr o predicado de elegibilidade no banco.
  - _Contras:_ aquela visão existe porque o estado da cobrança **filtra conjunto** — a régua pergunta
    *quais* cobranças são elegíveis, sobre milhares de linhas. Aqui não há conjunto: cada empresa tem um
    certificado vigente, e a pergunta é sobre ele. Visão para uma linha é maquinaria sem caso que a
    justifique.
- **D8-b — na aplicação (recomendada).**
  - _Exemplo:_ a consulta devolve a faixa e quantos dias faltam; a fatia (ii) pergunta *"esta empresa está
    apta?"* na borda da emissão, que é decisão de aplicação e não filtro de linhas.
  - _Prós:_ a fonte do "hoje" continua **única** — a mesma função de data corrente que a cobrança consulta.
    Nenhum relógio de aplicação entra no caminho, que é o que faz o estado ser reprodutível em teste.
  - _Contras:_ se a fatia (ii) vier a precisar **filtrar empresas** por estado de certificado em consulta, a
    derivação sobe para o banco. Fica registrado como gatilho, não como dívida silenciosa.
- **D8-c — coluna gravada, movida por rotina.**
  - _Contras:_ a segunda cláusula da **ADR-0022** a proíbe para fato financeiro, e a RN-04 do PRD a proíbe
    por escrito aqui. Não é caminho.

⚠️ **O limiar de 30 dias é regra publicada** (RN-04, CA-04): definição única, num lugar só, da qual as três
respostas do produto derivam. Duas declarações do mesmo limiar é a forma exata do débito **D14** que a fase
anterior deixou aberto sobre o fuso — não a repita.

---

### D9 — Como a substituição preserva o registro do anterior

**Por que decidir**: a CA-09 exige que o anterior continue consultável **e** que o material secreto dele
deixe de existir, no mesmo ato. Como as duas coisas coexistem é escolha de forma.

**Solução recomendada: D9-b — um registro por certificado registrado, na mesma tabela**; o vigente é o mais
recente não substituído, e o material secreto do anterior é anulado na mesma unidade de trabalho da
substituição.

Caminhos viáveis avaliados:

- **D9-a — duas tabelas**, uma para o vigente e outra para o histórico.
  - _Contras:_ o que o produto publica sobre o anterior é **exatamente** o que publica sobre o vigente —
    titular, validade, impressão digital, autoria e desde quando. Seriam duas tabelas de mesma forma mais
    uma cópia entre elas a cada renovação, e cópia entre tabelas é onde a divergência mora.
- **D9-b — uma tabela (recomendada).**
  - _Exemplo:_ renovar é inserir o novo e anular o material do anterior no mesmo ato. Falha na leitura do
    material novo **não deixa a empresa pior do que estava** (fluxo alternativo do PRD), porque nada foi
    anulado antes de o novo ser aceito.
  - _Prós:_ *"o material secreto do anterior deixa de existir"* vira **escrita verificável por consulta**, e
    não promessa; a política de linha forçada e a chave estrangeira composta cobrem os dois estados sem
    regra nova.
  - _Contras:_ *"qual é o vigente"* passa a ser propriedade derivada — coerente com a doutrina do projeto,
    mas exige que a unicidade do vigente por empresa seja **imposta pelo banco**, nunca conferida pela
    aplicação. É a mesma exigência que o invariante 1 já faz em outras tabelas.
- **D9-c — sobrescrever a linha.**
  - _Contras:_ perde o registro do anterior, contrariando a CA-09 diretamente. Não é caminho.

---

## 4. Candidatas a ADR

### 4.1 Confirmada — guarda de segredo operável de terceiro

**Decisão a registrar**: segredo de terceiro que o produto precisa **usar** (e não apenas conferir) é
guardado cifrado de forma reversível, com a chave fora da árvore e fora do dump; ele não retorna por
nenhuma superfície do produto; e a não-fuga é afirmada por **medição da saída real**, nunca por leitura do
código.

Os cinco critérios, um a um:

| # | Critério | Por quê |
|---|---|---|
| C1 | transversal | É regra de **classe** — separa segredo *verificável* (resumo irreversível, como senha e portador) de segredo *operável*. Vale para qualquer credencial de terceiro que o produto venha a guardar |
| C2 | tag-alvo | `security`, `data` |
| C3 | custo de reversão | Alto — mudar onde o material mora alcança banco, borda, backup e o runbook da virada |
| C4 | surpreendente sem contexto | Sim. Todos os outros segredos do produto são irreversíveis; quem chegar depois vai perguntar por que **este** é decifrável, e a resposta óbvia ("descuido") é a errada |
| C5 | trade-off real | Sim. O arquivo restrito no servidor — que é como o produto guarda os outros segredos hoje — foi rejeitado por razão concreta (D1-a) |

```bash
/agent-spec-adr-create "segredo de terceiro que o produto precisa usar é cifrado de forma reversível, nunca retorna e a não-fuga se prova por medição"
```

> A skill de ADR revalida os critérios. **Esta skill não cria ADR.**

### 4.2 Parcial — entrada de bytes pela borda

Espelho da ADR-0028, que governa a rota que **devolve** bytes. Falha em **C1**: há um único consumidor
hoje, e o segundo (o carnê da fatia iii) **devolve** bytes, não recebe. Registrada aqui como decisão de
feature (**D3**); promova a ADR se e quando uma segunda rota de entrada de bytes aparecer.

---

## 5. Restrições e invariantes técnicas

Herdadas, não decididas aqui — qualquer implementação as respeita:

- **Isolamento pelo banco (ADR-0008/0009, invariante 1)**: a tabela do certificado é dado **da empresa** —
  nasce com `empresa_id`, política de linha forçada e chave estrangeira composta. ⚠️ **Não confunda com o
  contador**: pela **ADR-0031**, este vive fora do schema de negócio e **não carrega coluna de empresa**.
  Duas tabelas novas nesta fatia, em lados opostos da fronteira, e o lado é declarado pelo **lugar**.
- **O contexto de tenant nunca vem do pedido (invariante 2)** — vale para os três atos.
- **Contrato derivado do esquema (ADR-0016/0017)**: nenhuma descrição escrita à mão em paralelo; o envelope
  de erro e a forma da resposta são os canônicos. A chave exposta do certificado é **UUID**, porque não há
  série declarada para ele (ADR-0017).
- **Autorização declarada por rota, com default que nega (ADR-0011/0018)**: os três atos são do Admin da
  empresa; nenhum é público e nenhum é do operador da plataforma. `semDeclaracao` continua vazio.
- **Efeito externo (ADR-0029)**: o ato de verificação é chamada síncrona cujo retorno o solicitante espera
  na própria resposta — **permanece em linha, e não é exceção**. Nada nesta fatia vai para fila.
- **Nenhum segredo versionado (invariante 3)**: a chave da cifra vive no arquivo de ambiente restrito, fora
  da árvore; nenhum material de teste real entra no repositório.
- **Mecanismo e lugar do contador (ADR-0020 + ADR-0031)**: contador do banco cujo avanço não participa do
  desfazimento, fora do schema de negócio, com o roster daquele schema **enumerado** e conferido no catálogo
  nas duas pontas.
- **Protocolo Antirregressão**: os marcadores `DECISÃO FECHADA` das duas séries existentes são **intocáveis**
  nesta fatia — ver a advertência na D7-a.
- **Fronteira do projeto**: nenhum código de frontend. As telas do Admin saem do handoff.
- **Superfície da API**: cresce em **3 ações** (registrar, consultar, verificar), de 89/74 para uma contagem
  que o TECH_SPEC fecha por **dupla medição independente com a igualdade entre os eixos afirmada** — o
  precedente são os CT-533, CT-635 e CT-732.
- **Método de prova**: a garantia de não-vazamento é **medida**, e a suíte roda **por pacote**
  (`pnpm --filter @sysloc/<pacote> test`), com `rm -rf /tmp/sysloc-banco-*` entre execuções.

---

## 6. Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC:**

1. **`undici` nesta fatia ou na (ii)** — decidir **por medição**, conforme a D6. Se o cliente nativo entregar
   o aperto de mão mútuo por chamada, a dependência pertence à fatia que exercer o agrupamento de conexões.
2. **Nome do pacote novo** — o discovery sugeriu `@sysloc/banking`; o idioma declarado do projeto é pt-BR e o
   monorepo mistura as duas convenções (`contracts`/`shared` × `regua`/`documentos`). Escolha do TECH_SPEC.
3. **Como o ato de verificação é provado sem tocar o provedor real** — a fronteira de execução real é
   governada por `.claude/rules/testing-stack.md`; a forma da prova (e o que, se algo, exercita a API de
   homologação) é do TECH_SPEC.
4. **Qual operação do provedor serve de sonda de identidade** — obtenção de credencial de acesso ou consulta
   inócua. Depende do que a API de homologação aceitar sem efeito colateral (RN-06).
5. **Débitos com gatilho que esta fatia provavelmente dispara** — **D26** (terceiro consumidor de aritmética
   de calendário, pelo prefixo de competência) e **D14** (fuso da operação, se a data corrente for tocada).
   Confirmar **contra o código**, não contra o índice. São observação, não proposta.

**Dependências de produto — sinalizadas, não decididas aqui:**

6. **Validade da habilitação junto ao provedor, conferida por data e não por memória.** O ato de verificação
   não é demonstrável de ponta a ponta sem ela. O PRD já a registra como dependência externa; ela não é
   decisão técnica.
7. **Divergência de vocabulário a canonizar** — o glossário global define *Contador sequencial* como número
   mantido pela imobiliária, e esta feature o torna único do SaaS. O PRD §9 atribui a correção à etapa de
   **challenge**, que é a dona do glossário. Não é decisão desta skill.

**Observação fora do escopo desta fatia (registrada, não proposta):**

8. ⚠️ A linha da stack do `CLAUDE.md` que atribui a `node:crypto X509Certificate` a *"leitura de `.pfx`"* está
   **imprecisa** — medido em N1. O que aquele acessório lê é certificado em PEM ou DER; o material do
   provedor exige o caminho da **D2**. Corrigir o `CLAUDE.md` não pertence a esta fatia nem a esta skill;
   fica registrado para que ninguém implemente contra a linha errada.
