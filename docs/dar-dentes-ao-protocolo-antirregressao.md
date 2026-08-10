# Prompt de endurecimento — dar dentes ao Protocolo Antirregressão (genérico, portável)

> **Para quem é este arquivo**: para um **agente de codificação** (Claude Code, Cursor, Codex, ou
> qualquer agente com acesso a arquivos e shell) que vai trabalhar num projeto onde o **Protocolo
> Antirregressão já está instalado** — o arquivo de regra existe, o arquivo de instruções aponta para
> ele, e ele carrega automaticamente.
>
> **Como usar**: entregue este arquivo inteiro ao agente com a instrução
> *"leia e execute o endurecimento descrito aqui neste repositório"*.
>
> **O problema que ele resolve**: um protocolo instalado pela ligação mínima é **vinculante e sem
> dentes**. Nada reprova quem o viola, e nada reprova quem o esvazia. Ele depende de um agente
> autoavaliando a própria disciplina — que é precisamente o modo de falha que o protocolo descreve. Um
> mês depois, o arquivo continua lá, ninguém o violou explicitamente, e ninguém sabe dizer se ele
> mudou alguma coisa.
>
> **O que este roteiro instala**: as cinco lacunas medidas entre "instalado" e "operante", mais a rede
> executável que impede as cinco de serem desfeitas em silêncio. Ao fim, existe algo que fica
> **vermelho** quando o protocolo é violado, e algo que fica **vermelho** quando o protocolo é
> esvaziado.

---

## 0. Contrato deste endurecimento

Ao terminar, o repositório-alvo deve satisfazer **todos** os itens abaixo. Não declare concluído sem
provar cada um na §6.

- [ ] Quem revisa **diff** (gate automatizado, hook de revisão, ou o próprio agente em
      autoverificação declarada) reprova como **severidade máxima** a alteração/remoção de código sob
      o marcador de decisão fechada, e a remoção do marcador.
- [ ] Quem executa a suíte compara a **contagem de casos por unidade de execução** entre rodadas —
      não só o resultado. Teste que falha já era pego; teste **deletado** não falha.
- [ ] A **escrituração** de débito (marcador ausente, índice vencido, entrada faltando) tem severidade
      **fixa e baixa**, registrada na fonte única de severidade do projeto.
- [ ] Quem implementa recebe a **ordem de precedência** entre o protocolo e as demais instruções, sem
      que nenhuma numeração existente tenha sido alterada.
- [ ] Existe uma **barreira executável** que reprova se qualquer um dos itens acima — ou o núcleo do
      protocolo — for removido ou esvaziado.
- [ ] Cada asserção dessa barreira foi **falsificada**: existe um mutante registrado que a mata, e a
      tabela de mutantes está no relatório final.
- [ ] A contagem de casos da suíte **antes** e **depois** está registrada, e a diferença é
      **exatamente** o número de casos que você acrescentou.

**Regra que vale para o endurecimento inteiro**: o protocolo que você está endurecendo **vale para
você agora**. Meça a baseline antes da primeira edição (P1), faça a arqueologia de cada trecho antes
de tocá-lo (P2), escreva as três linhas antes de cada mudança (P3), deixe a rede (P4) e compare a
baseline no fim (P5). Se você endurecer o protocolo violando-o, entregou um documento, não uma
barreira. **A §5 deste arquivo existe porque o agente que o escreveu tropeçou em oito armadilhas
enquanto fazia exatamente isto** — e três das suas próprias asserções eram decorativas até a prova de
falsificação revelar.

---

## 1. Fase 0 — Reconhecimento (não escreva nada ainda)

Levante os fatos abaixo **lendo o repositório**, nunca supondo. Metade deste roteiro é descobrir
**onde** cada mudança tem entrada única; instalar a coisa certa no lugar errado é o desperdício mais
comum aqui.

| # | O que descobrir | Como | Por que muda o plano |
|---|---|---|---|
| 1 | **Comando de verificação** e se ele imprime contagem **por unidade** ou só total | rodar de verdade; `package.json`/`Makefile`/CI | a asserção de contagem depende do formato real da saída |
| 2 | **Baseline atual**: contagem por unidade + total | rodar e **registrar os números** | é o P1 do seu próprio trabalho |
| 3 | Existe **cache de build/teste** que replica resultado? (turbo, nx, bazel, gradle, pytest-cache) | config do runner | cache faz a comparação provar que o cache está íntegro, não os testes |
| 4 | Existe **revisão automatizada** (gates, subagentes, CI de review, hooks)? Qual deles vê **diff**? | `.claude/agents/`, workflows de CI, configs de orquestração | só quem vê diff detecta regressão de decisão |
| 5 | Onde vive a **classificação de severidade** — e ela tem **fonte única com espelhos**? | grep por "severidade"/"severity"/"blocking" nas regras e contratos | editar espelho em vez de fonte cria divergência; editar N lugares quando a regra manda 1 é desperdício |
| 6 | Existe **regra de propagação** declarada (o que pode ser espelhado e o que não)? | ler a vizinhança da fonte de severidade | ela diz quantos arquivos você deve tocar — obedeça-a |
| 7 | Como o **implementador** recebe instruções: system-prompt herdado, bloco injetado, ou nada? | contratos de agente, references de orquestrador | define onde a precedência entra e se ela chega |
| 8 | Se há bloco injetado: **como ele é delimitado e extraído**, e a numeração dele é **citada em outros arquivos**? | grep pela numeração ("Regra 3", "Rule #5") | acrescentar item renumeraria referências espalhadas — proibido |
| 9 | Arquivos que **afirmam** ser symlink/gerados/espelhos — **são?** | `test -L`, `md5sum`, `stat -c %i`, `git ls-files -s` | doc que mente sobre a própria estrutura faz você editar 1 e divergir 3 |
| 10 | O projeto já tem **barreira executável de convenção** (teste que valida documentação/estrutura)? | procurar testes que leem `.md`/configs por `fs` | se existir, **imite o padrão dela**; não invente um segundo estilo |
| 11 | Onde o projeto registra **débito por extenso** (o alvo do campo de índice do marcador) | relatório de entrega, `TODO.md`, issues | o marcador é ponteiro; sem alvo ele apodrece |
| 12 | **Idioma** dos artefatos e **sintaxe de comentário** predominante | commits e comentários existentes | não imponha o seu |

**Saída desta fase**: o bloco de 12 respostas, mostrado ao usuário **antes** de escrever qualquer
arquivo. Se dois ou mais itens ficarem ambíguos, pergunte.

---

## 2. Fase 1 — As cinco lacunas, e o padrão de correção de cada uma

Cada lacuna abaixo foi **medida** num repositório onde o protocolo estava instalado e ligado. Nenhuma
delas é hipótese. Instale as cinco; se alguma já existir no projeto-alvo (acontece — pipelines
maduros já cobrem parte), **verifique e registre que já existia, não duplique**.

### L1 · Ninguém detecta a regressão de decisão

**O sintoma**: o protocolo declara o marcador de decisão intocável, e nenhum revisor o conhece. A R3
não quebra teste, não quebra build, e o revisor humano não tem como saber que aquela forma esquisita
era deliberada.

**A correção**: no contrato de **quem vê diff**, uma seção própria que reprova como severidade máxima:

1. código sob o marcador **alterado, movido ou removido** sem que a condição de reversão declarada no
   próprio marcador esteja **demonstravelmente** satisfeita;
2. o **marcador em si** removido ou esvaziado — mesmo que o código ao redor esteja correto;
3. **cruzamento** da linha "o que esta mudança remove" (que o protocolo obriga o implementador a
   declarar) contra o que o diff **de fato** remove: garantia removida e não declarada é achado.

**Duas precisões que evitam estrago:**

- Exija que o achado cite o **texto literal** do marcador, e que a correção sugerida seja **escalar**,
  não decidir.
- Diga explicitamente que o **marcador de débito não protege nada** — editar código sob ele é normal.
  Confundir os dois marcadores congela o que deveria mudar. Só é achado o marcador de débito **órfão**
  (débito já fechado, marcador esquecido), e esse é **baixo** (ver L3).

**Se não houver gate que veja diff**: a seção vira **autoverificação obrigatória antes de declarar
concluído**, escrita no arquivo de instruções — e a barreira da §3 passa a ser a única fiscalização
real. Diga isso ao usuário sem suavizar.

> **Não crie categoria/taxonomia nova** para isto se o projeto já tiver vocabulário de categorias. O
> dente vem da **severidade**, não do rótulo. Categoria nova obriga a atualizar partições, espelhos e
> ledgers — superfície de mudança sem ganho de efeito.

### L2 · Teste deletado não falha — desaparece

**O sintoma**: quem executa a suíte rejeita **teste que falha**. Um teste **removido** deixa a suíte
verde com menos prova do que antes. É o buraco da regressão de prova, e nada o vê.

**A correção**: no contrato de **quem executa a suíte**:

1. registrar a contagem de casos **por unidade de execução** (pacote, módulo, arquivo — o que o runner
   emitir), não só o total. Total esconde compensação: uma unidade perde 3, outra ganha 4;
2. em rodada de correção, **comparar** contra a contagem da rodada anterior; queda **não explicada** em
   qualquer unidade é severidade máxima, com o rótulo que o projeto já usa para enfraquecimento de
   teste. "Explicada" = a task pedia consolidar N casos num parametrizado, e o diff mostra isso;
3. exigir a **rede** do defeito corrigido: para cada problema declarado resolvido, o caso que
   **falharia com o código antigo**. Caso que passa nas duas versões não é rede.

**A precisão que inverte a conclusão se faltar**: se o projeto tem cache de build/teste (item 3 do
reconhecimento), unidade reportada como cacheada **replica a contagem anterior** — a comparação passa
a provar que o cache está íntegro. Exija a flag que força reexecução quando a mudança cruza fronteira
de unidade, ou que o revisor **declare** que comparou sobre resultado cacheado. Isto não é
preciosismo: no repositório de origem, uma mutação que removia uma validação de contrato passou
despercebida porque o runner leu o artefato compilado antigo — o verde se leu como "a asserção não
pega isso" quando o correto era "a asserção nunca viu o mutante".

### L3 · Escrituração sem severidade fixa vira bloqueio por burocracia

**O sintoma**: marcador ausente, índice vencido, entrada faltando no registro — sem classificação
declarada, cada gate decide na hora, e um deles vai bloquear entrega por falta de anotação.

**A correção**: na **fonte única de severidade** do projeto, fixar escrituração em **baixo**, em
categoria que o projeto já trate como não-bloqueante. O que se classifica ali é o **registro**, não o
risco. Gate que bloqueia por burocracia ensina todo mundo a contornar o protocolo, o que custa mais
que o débito não escriturado.

**A fronteira que precisa estar escrita junto**: faltou *anotar* → baixo. Desfez-se o que estava
*fechado* → severidade máxima (L1). São coisas diferentes e a confusão entre elas é o que faz um
projeto ou ignorar o protocolo ou ser paralisado por ele.

> **Antes de editar**: leia a regra de propagação (item 6). Se ela exige espelhar apenas alterações de
> uma partição específica, e a sua mudança é de **severidade** e não daquela partição, então é **uma**
> edição, não três. Verifique — não replique por reflexo.

### L4 · Quem implementa não sabe a precedência

**O sintoma**: o implementador herda o protocolo e também recebe um conjunto próprio de regras de
execução. Nada diz qual vence. Na dúvida ele segue o que está mais saliente no prompt.

**A correção**: declarar a ordem completa de precedência onde o implementador **de fato lê** —
tipicamente o bloco injetado no prompt dele, não só a regra herdada. Ordem canônica:

```
decisão arquitetural ativa > Protocolo Antirregressão > regras do executor > instinto idiomático
```

Inclua o mínimo operante: medir antes/depois, as três linhas antes de editar, o marcador como
**gatilho de parada adicional**, e a instrução de **repetir a linha "o que esta mudança remove" no
sumário final** — é ela que o revisor de L1 vai cruzar contra o diff. Sem isso, L1 fica sem insumo.

**Três restrições que não são negociáveis:**

- **Não crie item numerado novo** se a numeração existente é citada em outros arquivos (item 8). Entre
  no parágrafo que já resolve conflito de precedência.
- Verifique **onde o bloco termina** para o extrator. Se a instrução de cópia diz que o bloco acaba num
  parágrafo específico, conteúdo escrito depois dele é **cortado na extração** e nunca chega ao
  implementador — falha totalmente silenciosa.
- Se o bloco existir em **N cópias** (item 9), aplique por script com verificação de igualdade no fim.
  Editar uma à mão deixa as outras com a versão antiga.

### L5 · Tudo acima é texto normativo

**O sintoma**: L1–L4 são prosa em arquivos de configuração. Nenhuma suíte prova que continuam lá.
Alguém "consolida" uma seção seis meses depois e nada fica vermelho.

**A correção**: a barreira executável da §3. Sem ela, este roteiro entrega um protocolo mais bem
escrito e igualmente sem dentes.

---

## 3. Fase 2 — A barreira executável

Um teste que lê os arquivos de configuração por `fs` e prova o **substrato** de que o protocolo
depende. **Imite o padrão de barreira que o projeto já tiver** (item 10): mesmo diretório, mesma
convenção de nome, mesmo estilo de mensagem de erro. Se não houver, crie no lugar onde a suíte
principal a exercite.

**Ela não julga prosa.** Toda asserção é presença, contagem ou igualdade — verificável sem
interpretar texto. O que ela prova:

| # | Invariante | Por que ela e não outra |
|---|---|---|
| 1 | **Mecanismo de entrega**: a regra declara o escopo universal que a faz carregar sempre | sem isso a regra não chega a sessão nenhuma e o protocolo deixa de existir sem nada ficar vermelho |
| 2 | **Núcleo íntegro**: os 5 passos, as 3 formas de regressão, as 7 proibições (**contagem exata**), as 3 linhas nomeadas literalmente | o template permite adaptar encanamento e proíbe adaptar o núcleo; um resumo bem-intencionado é a forma mais provável de perdê-lo. Conte: "6 proibições" continua parecendo lista completa |
| 3 | **Ligações**: o arquivo de instruções aponta para a regra e carrega o resumo mínimo com a contagem certa de itens | resumir o resumo é o erro clássico |
| 4 | **Não-duplicação**: nenhum contrato de agente contém o texto do protocolo | duas cópias divergem, e a cópia é sempre a desatualizada |
| 5 | **Dentes**: as âncoras de L1, L2 e L3 estão nos arquivos onde foram instaladas | é o que transforma protocolo em barreira |
| 6 | **Cópias idênticas** (se houver N cópias de bloco injetado) | quando a doc afirma symlink e são cópias, a asserção é a única coisa que as mantém em dia |
| 7 | **Índice de débito nas duas pontas**: marcador vivo no código ⇔ linha no índice; e cada campo de índice aponta para caminho existente | marcador órfão e linha órfã são o mesmo defeito em direções opostas, e ambos chegam a todo agente antes de qualquer arquivo |

**Três exigências de construção que separam barreira de teatro:**

- **Não use `slice(indexOf(ancora))`** para recortar trecho. Com a âncora ausente — que é exatamente o
  defeito perseguido — `indexOf` devolve `-1` e o `slice` devolve o **último caractere**: string
  não-vazia que passa em "não está vazio". Use uma função que **falha explicitamente** quando a âncora
  não existe. Isto aconteceu de verdade, em três asserções, e só a prova de falsificação revelou.
- **Controle de não-cegueira obrigatório.** Se a barreira varre o código procurando marcadores e hoje
  não existe nenhum, ela é vacuamente verde — e uma expressão de busca quebrada fica verde igual, por
  não enxergar. Acrescente: (a) casos positivos e negativos da detecção contra exemplos literais; (b)
  um controle de não-vacuidade provando que a varredura encontra arquivos de verdade e exclui saída de
  build.
- **Exclua o próprio arquivo de teste da varredura**, explicitamente e com comentário. Ele cita o nome
  do marcador como dado; sem a exclusão a barreira acusa a si mesma.

---

## 4. Fase 3 — Prova de falsificação (obrigatória; é o que separa isto de decoração)

Para **cada** invariante da §3: reintroduza o defeito, rode a suíte pelo **mesmo comando** que ela usa,
exija **vermelho**, restaure, e confirme byte-a-byte que o repositório voltou ao estado original.
Automatize num script — mutante restaurado à mão é mutante esquecido no repositório.

**Mutantes mínimos** (adapte os nomes ao projeto):

1. escopo de carregamento da regra deixa de ser universal;
2. uma proibição removida (7 → 6);
3. um dos cinco passos renomeado, saindo da contagem;
4. a segunda das três linhas do passo de declaração, apagada;
5. a seção de L1 removida do revisor de diff;
6. a seção de L2 removida de quem executa a suíte;
7. a classificação de L3 deixa de ser fixa;
8. as cópias do bloco injetado divergem entre si;
9. a precedência de L4 movida para **fora** do trecho extraído;
10. o resumo no arquivo de instruções perde um item;
11. marcador vivo no código **sem** linha no índice;
12. linha no índice **sem** marcador vivo;
13. campo de índice apontando para caminho inexistente.

**A regra que evita a falsa vitória**: um mutante morto **pela asserção errada** não prova a asserção
que você pretendia. O mutante 13, ingênuo, também dispara o 11 — e você conclui que testou o índice
quando testou a outra ponta. Construa-o **composto** (índice presente **e** caminho quebrado) para
isolar, e **confira qual teste falhou pelo nome**, não só que algo ficou vermelho.

Falsifique também **os controles de não-cegueira**: afrouxe a expressão de busca em duas direções e
exija que ambas morram.

Registre a tabela `mutante → morto/sobreviveu` no relatório. **Mutante sobrevivente é asserção que não
pode falhar** — conserte a asserção antes de declarar concluído.

---

## 5. As oito armadilhas medidas (leia antes de escrever a primeira linha)

Estas custaram tempo real no repositório de origem. Nenhuma é dedutível do resultado final.

| # | Armadilha | Como se manifesta | O que fazer |
|---|---|---|---|
| A1 | **Asserção que não pode falhar** | `slice(indexOf())` + "não está vazio" passa no cenário que devia reprovar | função que falha explícito; falsificar **cada** asserção |
| A2 | **Mutante impreciso** | mata por asserção diferente da pretendida; você conclui que provou | mutante composto; conferir o **nome** do teste que falhou |
| A3 | **Barreira cega** | varredura sem alvo hoje fica verde por não enxergar | fixtures positivas e negativas + controle de não-vacuidade |
| A4 | **Auto-detecção** | o teste cita o marcador e se acusa | excluir o próprio arquivo, com comentário |
| A5 | **Delimitador por substring** | casa a **menção inline** do delimitador na instrução, recortando trecho vazio | ancorar em início de linha |
| A6 | **Doc que mente sobre a estrutura** | afirma symlink; são cópias com inodes distintos — edita 1, divergem 3 | `test -L` / `md5sum` / `stat`; **verificar, não presumir** |
| A7 | **Espelho editado em vez da fonte** | severidade divergente entre gates; ou N edições onde a regra pedia 1 | achar a fonte única **e** a regra de propagação antes de editar |
| A8 | **Numeração citada fora do arquivo** | acrescentar item renumera referências em vários arquivos | entrar em parágrafo existente; nunca renumerar |

> **A meta-lição**: das oito, **seis** foram descobertas pela arqueologia (P2) e pela prova de
> falsificação (P4) — os dois passos que um agente apressado corta primeiro, por parecerem cerimônia.
> Cortá-los aqui produz um endurecimento que parece completo e não é.

---

## 6. Fase 4 — Verificação final (não pule)

Mostre a saída de cada item:

1. **Baseline depois**, pelo mesmo comando do P1, com contagem **por unidade**. A diferença contra o
   P1 tem de ser **exatamente** os casos que você acrescentou; qualquer unidade que perdeu caso é
   regressão sua. Se o projeto tem cache, rode **forçando reexecução** — senão você comparou replay.
2. **Tabela de mutantes** completa, com o nome do teste que morreu em cada um.
3. **Análise estática** (lint/typecheck/format) no estado que o projeto exige. Erro de formatação
   introduzido por você é seu, mesmo sendo cosmético.
4. **Estado do repositório limpo**: nenhum mutante remanescente, nenhum arquivo temporário. Prove com
   o status do controle de versão.
5. **Teste de fumaça**: escolha um arquivo existente e escreva a declaração de três linhas para uma
   mudança hipotética nele, **sem editar nada**. Se não conseguir preencher a linha do meio, o
   protocolo está operante e você acabou de demonstrar.

**Não commite** a menos que o usuário peça.

---

## 7. Relatório final ao usuário

1. **Arquivos criados e modificados**, com caminho e delta de linhas.
2. **Quais das cinco lacunas já existiam** no projeto e quais você instalou — com a evidência de que
   as existentes existiam. Instalar em cima do que já estava lá cria duplicata divergente.
3. **Baseline antes → depois** e a tabela de mutantes.
4. **O que ficou de fora e por quê** — agente não autorizado, gate inexistente, débito encontrado e
   não consertado. Escopo reduzido em silêncio é o defeito que o protocolo combate.
5. **Uma avaliação honesta**: o que passou a ter dente, e o que continua dependendo de boa-fé. Não
   venda o resultado.

---

## 8. O que NÃO tente resolver (e diga ao usuário)

- **A honestidade das três linhas do passo de declaração não é testável.** Um agente pode escrevê-las
  como cerimônia — texto plausível antes de editar — e o efeito colapsa sem deixar rastro. Nenhuma
  asserção alcança isso. Declare o limite; não finja cobertura.
- **Débito estrutural que você descobrir e que não seja sua causa-raiz** (arquivo que afirma ser
  symlink, gerador que não roda, cópia divergente) — **reporte, não conserte**. Cada linha de diff que
  não serve ao endurecimento é superfície de regressão de graça. Se a barreira puder **fiscalizar** o
  débito, isso é melhor que consertá-lo por conta própria: passa a existir algo que fica vermelho se
  piorar.
- **Não edite agentes, skills ou contratos personalizados sem autorização explícita.** Liste quais
  precisam da mudança, mostre o texto exato que acrescentaria, e **pergunte** antes de tocar em cada
  um.

---

## Anexo — a diferença medida, para calibrar expectativa

No repositório de origem, o protocolo estava instalado e ligado (regra carregando sempre, resumo no
arquivo de instruções, ponteiro nos contratos de agente). A avaliação honesta naquele momento:
melhora modesta — a medição de baseline e o conhecimento operacional da stack tinham valor; o resto
dependia de boa-fé, **nenhum gate reprovava por violação**, e existiam **zero** marcadores no código.

Depois do endurecimento descrito aqui:

- quem executa a suíte passou a enxergar **teste deletado**, que antes não falhava — desaparecia;
- quem vê diff passou a ser **detector de regressão de decisão**, que antes não tinha detector nenhum;
- **41 asserções** passaram a reprovar se qualquer peça for removida;
- **13 mutantes** confirmaram que as asserções podem falhar — e o processo revelou que **três delas
  eram decorativas** antes da correção;
- baseline **670 → 711**, sem cache, sem nenhuma unidade perdendo caso.

O que **não** mudou: a honestidade das três linhas continua fora do alcance de qualquer teste. Essa
fronteira é real e vale declará-la — um relatório que a omite está vendendo.
