# Tech Alignment — cobranca-e-mora / v1

| | |
|---|---|
| **Feature** | `cobranca-e-mora` (fatia 1 de 2 da F3) |
| **Versão** | v1 |
| **Framework** | SDD |
| **Variante** | backend |
| **Definição** | `docs/prds/features/cobranca-e-mora/v1/prd.md` |
| **Discovery lido** | `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md` |
| **ADRs consultadas** | 0008, 0009, 0011, 0014, 0015, 0016, 0017, 0018, 0020, 0021, 0022 |
| **Data** | 2026-08-09 |
| **Status** | Decidido |

---

## Contexto técnico

A fatia introduz um agregado cujo **estado publicado e cujo valor devido são funções do tempo** —
`(fatos registrados, data corrente, configuração da empresa)`. Nenhum agregado existente tem essa
propriedade: as duas derivações já provadas no produto (metragem total e contrato vigente) dependem
apenas de dado guardado, e por isso vivem na camada de dados sem consequência.

O invariante que a fatia precisa estabelecer é de **unicidade estrutural**: qualquer caminho de
leitura devolve o mesmo estado para a mesma cobrança. Ele não é higiene — o sistema de origem tem
**três** avaliações divergentes do mesmo estado, e a divergência é alcançável (o envio manual não
reconhece o cancelamento e trata como vencida uma cobrança cancelada). Unicidade obtida por
disciplina de chamada reproduz esse defeito na primeira leitura nova; unicidade obtida por
construção não.

O segundo invariante é de **exatidão monetária sob composição**. A F2 enfrentou resíduo binário num
único produto e o resolveu multiplicando centavos inteiros. Aqui a composição tem três termos
(original, multa, juros) e um deles é proporcional a dias — a mesma técnica escalaria, mas o
problema deixa de existir se a aritmética não passar por ponto flutuante.

O terceiro é de **prazo**: a referência executável da régua só é obtenível enquanto o sistema de
origem estiver de pé, e a obtenção não pode produzir efeito externo.

---

## Soluções técnicas decididas

### D1 · A derivação dependente de data vive no banco, como expressão única

**Escolhida**: expressão única no schema de negócio, reusada por toda leitura de cobrança — estado e
mora compostos a partir dos fatos registrados e da configuração da empresa.

**Avaliadas e rejeitadas:**

- *Derivar na aplicação após a leitura* (o molde da F2). Rejeitada por não satisfazer o critério de
  unicidade com a força pedida: ela depende de todo caminho de leitura chamar a mesma função. Custos
  concretos somados: filtro, ordenação e paginação por estado deixam de ser possíveis sobre a leitura
  mais pesada do produto, e a composição monetária volta a correr em ponto flutuante.
- *Coluna materializada por rotina.* Rejeitada pela ADR-0022 — estado de fato financeiro não é coluna
  movida por rotina.

**Trade-off aceito**: regra de domínio expressa fora do TypeScript, e a obrigação explícita de que a
definição derivada **preserve o isolamento por empresa** — objeto derivado que rode com direitos
próprios furaria a ADR-0008. Testar exige banco, o que já é a norma da suíte.

**Ancoragem**: reusa o schema de negócio com isolamento forçado e a instância efêmera da suíte.
**Diverge do padrão de derivação da F2** — daí a candidata a ADR abaixo.

### D2 · A data corrente vem do relógio do banco

**Escolhida**: a expressão avalia contra a data corrente da sessão; cenários de teste posicionam o
dado por deslocamento relativo ao dia da execução.

**Avaliadas e rejeitadas:**

- *Data corrente como parâmetro de toda leitura.* Rejeitada porque transforma **cada chamador num
  ponto onde a resposta pode sair errada** — reproduzindo a divergência que a fatia fecha, por caminho
  novo. O ganho (consulta retroativa) não é pedido pela definição, e adotá-lo seria configurabilidade
  especulativa.
- *Relógio da aplicação injetado.* Mesma fragilidade, sem o ganho.

**Trade-off aceito**: não há consulta em data arbitrária, e teste de fronteira de virada de dia se
monta pelo dado, não pelo relógio.

**Ancoragem**: é a convenção que as referências capturadas já adotaram — as rotinas gravam
deslocamento em dias relativos ao dia da captura, precisamente para serem reconstruíveis em qualquer
dia.

### D3 · A cobrança recebe par próprio de funções de emissão de número

**Escolhida**: um par análogo ao do contrato, com o prefixo e a largura da série da cobrança, escopo
por empresa e ano, e o mesmo desenho de contador do banco fora do desfazimento (ADR-0020).

**Avaliadas e rejeitadas:**

- *Generalizar as funções existentes.* Rejeitada porque as guardas delas estão amarradas ao formato do
  contrato — inclusive à largura, que é objeto de `DECISÃO FECHADA` no pacote de contrato. Alterá-las
  numa fatia que não é a do contrato é risco de regressão sobre superfície publicada em troca de
  elegância, e pelo Protocolo Antirregressão exigiria escalada antes de qualquer edição.
- *Par genérico novo, só para a cobrança.* Rejeitada por produzir **dois mecanismos** no produto em vez
  de duas instâncias de um, e por generalizar para um consumidor futuro que não existe: o contador do
  provedor da fase seguinte é de outra natureza (não reinicia).

**Trade-off aceito**: duas instâncias do mesmo desenho. Mitigação: o raciocínio não se duplica — a
migração nova referencia a existente em vez de recopiar o argumento. Uma terceira série do mesmo
formato tornaria a extração devida.

### D4 · As parcelas nascem na unidade de trabalho que a ativação já abre

**Escolhida**: o serviço de contrato invoca a porta de dados de cobrança dentro da transação única da
ativação.

**Avaliadas e rejeitadas:**

- *Orquestrador acima dos dois módulos.* Abstração antecipada — dois participantes, um fluxo — que
  ainda move a atomicidade para uma camada inexistente.
- *Evento consumido dentro da mesma transação.* Indireção sem barramento no projeto; obrigado a correr
  na mesma transação, o evento é uma chamada com roupa de evento.

**Trade-off aceito**: o módulo de contratos passa a depender do de cobrança. A direção segue a do
domínio (a cobrança é filha do contrato), e a fatia seguinte a herda.

**Ganho direto**: a atomicidade exigida pela definição — ativação recusada não deixa parcela — sai do
commit único que já existe, sem mecanismo novo. O débito **D28** é fechado exatamente onde já está
declarado.

### D5 · A captura substitui o ponto de despacho, com plano B e piso declarados

**Escolhida**, em ordem de queda fixada **antes** de começar:

1. **Substituir o despachante dentro do processo de captura**, registrando destinatário, assunto e
   corpo, com o percurso completo da régua executando sobre cenários sintéticos — configuração e
   histórico de envio semeados.
2. **Plano B** — servidor de recebimento local que aceita e descarta, caso o despachante não seja
   substituível no processo.
3. **Piso** — capturar apenas as frentes que não produzem envio, com a consequência declarada por
   escrito na procedência.

**Rejeitada**: *desabilitar o envio e capturar a falha* — muda o caminho de código e o oráculo passaria
a registrar o comportamento de falha em vez do de envio, degradando exatamente o que se quer capturar.

**Trade-off aceito**: a opção 1 depende de o despachante ser substituível no processo. Medido: o envio
está concentrado em dois pontos de chamada do mesmo despachante do arcabouço.

**Ancoragem**: estende o script de captura existente, que já executa dentro do contêiner, já monta
cenários sintéticos de cobrança e já produz artefatos de referência para seis regras. Nenhuma infra
nova na opção 1. O conteúdo da mensagem é **parte do oráculo** — a régua decide a quem cobrar *e com
que texto* —, e é por preservá-lo que 1 e 2 vencem 3.

---

## Candidata a ADR

**D1 — onde vive a derivação dependente de tempo.** A escolha **diverge de um padrão estabelecido**: a
F2 deriva na camada de dados, e esta fatia deriva no banco. Sem registro, a fatia seguinte encontra
duas formas de derivar no mesmo produto e não tem como saber qual é a regra — e a F4 e a F5 leem
cobrança. A ADR-0022 decidiu **o que** se grava e **o que** se deriva; esta decide **onde** a derivação
é avaliada, e as duas não se substituem.

```bash
/agent-spec-adr-create "onde vive a derivacao dependente de tempo"
```

> Registrar **antes** do TECH_SPEC. A skill de ADR revalida os critérios.

---

## Restrições e invariantes técnicas

Herdadas, e não reabertas nesta fatia:

- **Isolamento por empresa é do banco** (ADR-0008): toda tabela de negócio nasce com vínculo de
  empresa, isolamento forçado e chave estrangeira composta. A definição derivada de D1 está sujeita ao
  mesmo invariante — preservá-lo é condição da escolha, não detalhe.
- **A fronteira entre identidade e negócio é por schema** (ADR-0009): a empresa vive na identidade,
  logo a configuração de mora, sendo dado de negócio, nasce no schema de negócio, tenantizada. **Não é
  ponto aberto** — a forma está determinada.
- **O que se grava e o que se deriva** está decidido (ADR-0022): deriva-se enquanto o fato está aberto;
  grava-se no ato que o liquida, junto da configuração vigente. O carimbo inclui os percentuais, não só
  os valores — versionar a configuração já foi avaliado e rejeitado na própria ADR.
- **O esquema é a fonte única do contrato** (ADR-0016): o estado derivado é publicado pelo mesmo
  esquema que publica a cobrança, nunca por um segundo esquema — foi assim que o contrato vigente
  entrou na F2.
- **A chave exposta é código legível quando há série declarada** (ADR-0017), emitida por contador do
  banco fora do desfazimento (ADR-0020), por empresa (ADR-0015).
- **Transição de estado é rota própria, governada conforme a natureza do ato** (ADR-0021). Decidido no
  discovery: **nenhuma transição desta fatia é ação sensível** — o catálogo fechado da ADR-0011 não é
  aberto, e as operações exigem apenas a área de tela Financeiro.
- **Toda rota publicada declara o que exige, e a cobertura confere conteúdo** (ADR-0018).
- **Dinheiro com duas casas decimais, nunca ponto flutuante** — D1 satisfaz o invariante por
  construção, em vez de contorná-lo.
- **Protocolo Antirregressão** é pré-condição de toda edição, com força máxima sobre os pontos que já
  carregam marcador.

Nascidas das decisões acima:

- O **fuso da sessão do banco** precisa ser fixado, sob pena de a virada do dia — e portanto a
  transição para vencida — ocorrer em hora diferente da esperada. Consequência direta de D2.
- A **captura não produz efeito externo**. É pré-condição, não recomendação, e vale para as três opções
  da ordem de queda de D5.
- O sistema de origem está **em produção**. A captura executa contra cópia descartável; nada
  destrutivo.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

1. A forma concreta da definição derivada de D1 e como as leituras a alcançam preservando o isolamento
   — a decisão fixa o lugar e a obrigação, não o mecanismo.
2. Se a marca booleana de pagamento confirmado do sistema de origem sobrevive, dado que a data de
   pagamento já responde à mesma pergunta sob D1. A referência capturada precisa registrar o
   comportamento atual antes de qualquer eliminação.
3. Se a cobrança substituta guarda vínculo explícito com a cancelada. A definição não pede rastrear a
   substituição, e o mecanismo do arcabouço que hoje a expressa morre com ele — na ausência de
   requisito, o default é não criar o vínculo.
4. Como a expressão de D1 se comporta para cobrança sem configuração de mora registrada na empresa —
   ausência de configuração é caso alcançável no primeiro dia de uma empresa nova.

**Dependências de produto — não decididas aqui:**

5. Os valores exatos da lista fechada de natureza da cobrança. A definição fixa a existência da lista e
   cita aluguel, água, condomínio, energia e outro; se a operação usa outras naturezas hoje, a lista
   precisa ser confirmada contra o dado real antes de fechar.
6. O comportamento esperado quando a configuração de mora de uma empresa é alterada enquanto há
   cobranças em aberto **já apresentadas** ao operador. A regra está decidida (a mora em aberto
   acompanha a configuração); o que não está é se isso exige aviso ao operador — a definição registra a
   consideração de experiência, sem resolvê-la.

**Observação fora do escopo desta fatia** (registrada, não proposta):

7. O débito **D32** — o lado produtor da fila vive numa aplicação sem exportação, e o primeiro produtor
   real terá de duplicar ou ignorar as opções de repetição. **Ele não dispara nesta fatia**: nada aqui
   enfileira. O gatilho é a fatia seguinte, quando a régua for portada. O discovery da fase o atribuiu
   à F3 sem distinguir as duas fatias.
