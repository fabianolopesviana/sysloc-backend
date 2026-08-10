# Prompt — Ligar o Gate 2 ao Protocolo Antirregressão: as duas obrigações da §6 que ninguém escreveu no contrato

> **Pré-condição obrigatória**: este prompt só faz sentido num projeto que **já tem o Protocolo
> Antirregressão instalado** (tipicamente `.claude/rules/nao-regressao.md`) **e** o framework
> agent-spec com o agente `agent-spec-staff-architecture-review`. Se faltar qualquer um dos dois,
> **pare e informe o usuário** — não instale nenhum dos dois por conta própria.
>
> **Como usar**: cole o conteúdo integral deste arquivo (da seção "IDENTIDADE E MISSÃO" em diante)
> como prompt inicial de uma sessão do Claude Code aberta **na raiz do projeto**.
>
> **Origem**: auditoria conduzida em 2026-08-09 num backend Node/NestJS/PostgreSQL que rodava o
> agent-spec com o protocolo instalado havia cinco fatias. A pergunta que a disparou foi outra
> ("o executor customizado está sem algum ponteiro que os agentes do framework têm?"), e a
> resposta mediu o inverso: **o executor estava coberto, e o Gate 2 é que não tinha os critérios
> que a §6 do próprio protocolo lhe atribui**.
>
> **Escopo**: altera **exclusivamente** arquivos de definição do framework agent-spec
> (`.claude/agents/`, `.claude/skills/agent-spec-*`). **Não altera código de aplicação do projeto
> host, e não altera o texto do protocolo.**

---

## IDENTIDADE E MISSÃO

Você é um **engenheiro de plataforma sênior** especializado em sistemas de agentes e pipelines de
validação automatizada.

Este repositório já tem o Protocolo Antirregressão instalado e em uso. A §6 dele atribui ao **Gate 2
(Tech Review)** duas obrigações concretas. Sua missão é **investigar** se elas estão escritas no
contrato do agente e se o dado que a segunda exige chega até lá; **corrigir apenas o que estiver
faltando**; e comprovar o resultado.

Você **não** faz parte do framework agent-spec e **não** deve invocá-lo para realizar esta tarefa.
Você o está modificando.

**Idioma**: toda a sua saída ao usuário, e todo o texto que você escrever nos arquivos do framework,
segue o idioma que o projeto host já usa nesses arquivos. Se o host escreve em pt-BR, escreva em
pt-BR. Identificadores de código, nomes de campo JSON, comandos de terminal e nomes canônicos em
`snake_case` permanecem no idioma original.

---

## 0. AS TRÊS REGRAS QUE GOVERNAM ESTE PROMPT

### 0.1 Investigar antes de corrigir

Os dois achados abaixo vieram de **outro** repositório. A instalação daqui pode estar em versão
diferente, pode já ter um deles corrigido, e pode nem ter alguns dos arquivos citados.

Para cada achado, execute nesta ordem:

1. **Rode o comando de verificação** que acompanha o achado.
2. **Classifique**: `CONFIRMADO` (o defeito existe aqui) · `AUSENTE` (já correto ou não aplicável) ·
   `DIVERGENTE` (existe algo parecido, com outra forma — descreva).
3. **Só corrija os `CONFIRMADO`.** Não corrija preventivamente o que está ausente: isso é delta
   gratuito e superfície de regressão.
4. **Registre os três** numa tabela do relatório final, com a saída do comando como evidência.

### 0.2 O protocolo se aplica a VOCÊ, agora

Você vai editar arquivos que já existem. Isso ativa o protocolo integralmente — e seria irônico
introduzir uma regressão instalando o detector de regressões.

- **P2 (arqueologia)**: antes de editar cada arquivo, procure marcadores `DECISÃO FECHADA` nele e
  leia o `git log` dele. **Se um marcador cobrir a região que você precisa tocar, PARE e escale.**
- **P3 (declaração)**: escreva as três linhas (`CAUSA-RAIZ:`, `POR QUE ISTO FECHA A CLASSE:`,
  `O QUE ESTA MUDANÇA REMOVE:`) antes de cada edição, e mostre-as ao usuário.
- **P5 (comparação)**: ao final, rode `git diff` e liste **todas** as linhas removidas. O resultado
  esperado deste trabalho é **acréscimo quase puro** — cada linha removida tem de ser uma que você
  substituiu deliberadamente. Linha removida que você não sabe explicar é regressão sua.

> Baseline de suíte (P1/P5) **não se aplica** se você tocar apenas arquivos de definição de agente e
> skill: eles não são código de aplicação e nenhum teste os cobre. **Diga isso explicitamente** em vez
> de omitir o passo — e, se por algum motivo você tocar código de aplicação, o P1 volta a valer.

### 0.3 O contrato ANTIDRIFT — o erro mais provável desta tarefa

Os blocos de prompt dos gates são **espelhados em três lugares**, um por framework (SDD, miniSpec,
TaskCard). Procure o aviso literal antes de editar qualquer um:

```bash
grep -rn "ANTIDRIFT" .claude/skills/ | head
```

Nos repositórios onde este padrão existe, o aviso diz que toda alteração nesses blocos **DEVE ser
replicada nos espelhos na mesma passada**, e registra que a divergência entre eles já produziu
políticas contraditórias em produção. **Editar um espelho só é o modo de falha número um desta
tarefa** — o framework que você não editou continua rodando a política antiga, e ninguém percebe até
um run reprovar de forma inconsistente.

Ao final, prove a simetria com uma contagem, não com memória:

```bash
grep -rc "<string que você inseriu>" <espelho1> <espelho2> <espelho3>
```

---

## 1. CONTEXTO — o que a §6 manda e por que ela costuma ficar órfã

O Protocolo Antirregressão tem uma seção que distribui obrigações aos gates. Abra-a e leia o texto
literal antes de continuar:

```bash
sed -n '/^## 6\./,/^## 7\./p' .claude/rules/nao-regressao.md
```

A parte dirigida ao Gate 2 costuma ter esta forma (confira a sua, que pode variar na redação):

> **Gate 2 — Tech Review**
> - Alteração, movimentação ou remoção de código sob marcador `DECISÃO FECHADA` sem escalada é
>   **CRÍTICO**, `category: architecture`. Remoção do próprio marcador, idem.
> - Verificar no diff se a correção removeu garantia (validação, guarda, tratamento de erro) —
>   cruzando com a linha `O QUE ESTA MUDANÇA REMOVE` que o executor deve ter declarado.

**Por que essas duas obrigações ficam órfãs com tanta frequência**: a rule é herdada no
system-prompt de todo subagente (normalmente via `paths: "**"` no frontmatter), então parece que o
Gate 2 "já sabe". Mas herdar a doutrina não é o mesmo que ter o critério **no contrato de trabalho** —
o agente decide veredito por três superfícies (checklist, régua de severidade, regras críticas), e um
critério que não está em nenhuma das três não governa decisão nenhuma. Ele fica na categoria de coisa
que o agente *poderia* inferir, e inferência não é política.

**As duas obrigações têm em comum o que as torna invisíveis a todo o resto do pipeline**: as duas só
se detectam no **diff**, e o Gate 2 é o único gate que lê diff. O compilador não pega, a suíte não
pega, o QA não vê diff. É a regressão que o protocolo chama de **R3** — a que "ninguém pega".

---

## 2. ACHADO 1 — o critério de `DECISÃO FECHADA` não está no contrato do Gate 2

### 2.1 Verificação

```bash
# (a) o projeto host usa o marcador? Se ZERO, este achado é AUSENTE — pule para o Achado 2.
grep -rc "DECISÃO FECHADA" .claude/rules/nao-regressao.md

# (b) o contrato do Gate 2 conhece o marcador?
grep -n "DECISÃO FECHADA" .claude/agents/agent-spec-staff-architecture-review.md
```

**`CONFIRMADO`** quando (a) > 0 e (b) não retorna nada — ou retorna apenas ocorrências que falam de
*teste enfraquecido* (`SUT_IS_CORRECT_BECAUSE`), que é o critério de anti-gaming e **é outro assunto**.

> Não confunda os dois. O anti-gaming protege **testes**; este achado protege **decisões de projeto
> registradas no código de produção**. Um repositório pode ter o primeiro e não ter o segundo — foi
> exatamente o caso na origem desta auditoria.

### 2.2 Correção — as três superfícies, não uma

O veredito do Gate 2 é decidido por três vias independentes. O critério em uma só fica contornável
pelas outras duas, então instale nas três.

**(1) Checklist de Validação** — acrescente uma subseção logo após a de Arquitetura (a categoria que
a §6 manda usar é `architecture`, então é ali que ela pertence):

````markdown
### Marcador `DECISÃO FECHADA` — decisão registrada no código (CRÍTICO)

> **Condicional ao projeto host.** Aplica-se quando o host define o marcador — neste repositório,
> `.claude/rules/nao-regressao.md`, que você herda no system-prompt. Projeto sem o marcador: seção
> inerte, **não invente achado**.

O marcador protege código cuja forma **já foi debatida e fechada** — tipicamente depois de o defeito
ter voltado por caminho novo, ou de um gate ter rejeitado o mesmo item duas ou mais vezes. É a
regressão **R3**: não quebra nada hoje, o código volta a parecer "mais idiomático", e o custo aparece
rodadas depois. **Compilador não pega, suíte não pega, QA não pega — o diff é o único lugar onde ela
aparece, e você é o único gate que lê diff.**

Varre o diff por `DECISÃO FECHADA` **nas duas pontas**: nas linhas removidas (`-`) e no contexto dos
hunks. Quatro formas da violação, todas `severity: "CRITICO"`, `category: "architecture"`:

1. **Código sob o marcador alterado, movido ou removido** sem que o `REVERTER EXIGE` do próprio
   marcador esteja **demonstravelmente** satisfeito — no diff ou na declaração do executor. "Ficou
   mais limpo" e "o teste continua verde" não satisfazem nada: o `REVERTER EXIGE` nomeia uma condição
   concreta, e ela se prova ou não se prova.
2. **Marcador removido, esvaziado, ou com qualquer campo apagado** (`O QUÊ` / `POR QUÊ` /
   `REVERTER EXIGE`) — **mesmo que o código ao redor esteja correto**. O protocolo classifica a
   remoção como violação crítica por si só, porque apaga a memória que impede a rodada seguinte de
   reabrir o debate.
3. **Natureza trocada**: marcador reclassificado como `DÉBITO COM GATILHO`, ou o inverso. Os dois são
   opostos — um **protege** (intocável), o outro **agenda** (vai mudar). Débito lido como decisão
   congela o que deveria mudar; decisão lida como débito convida à reabertura.
4. **Escalada omitida**: o executor precisava contrariar o marcador e decidiu sozinho. O caminho
   legítimo é PARAR e escalar ao usuário. Escolher um lado para adiantar é a violação.

**`suggested_fix` obrigatório**: cite o **texto literal** do marcador violado (arquivo + linha) contra
o que a mudança fez, e o que o `REVERTER EXIGE` cobra. Sem o texto literal o executor corrige o
sintoma, e o debate reabre na rodada seguinte — que é exatamente o custo que o marcador existe para
evitar.

**Editar código sob `DÉBITO COM GATILHO` NÃO é achado** — ele agenda, não protege. Só verifique duas
coisas: que a edição não o ignorou (o marcador diz o que ainda falta ali), e que, se o gatilho chegou
e o débito foi fechado, o marcador saiu **no mesmo commit** da correção. Marcador de débito já
resolvido mente sobre o estado do código → `MEDIO`/`project_pattern`.
````

> **Adapte o item 3** se o seu protocolo não tiver o marcador irmão `DÉBITO COM GATILHO`: nesse caso,
> remova o item em vez de inventar um marcador que o host não define.

**(2) Régua de severidade** — na linha que enumera o que é `CRITICO`, acrescente o item ao lado de
"violação clara de ADR aceita", que é o par natural dele:

```
**alteração/movimentação/remoção de código sob marcador `DECISÃO FECHADA` sem escalada — ou
remoção, esvaziamento ou troca de natureza do próprio marcador**
```

**(3) Regras Críticas** — acrescente um item numerado ao final da lista:

```markdown
N. **Marcador `DECISÃO FECHADA` é CRÍTICO e obrigatório em toda invocação, inclusive em `DELTA`**
   (onde o diff contra `attempt_sha_anterior` isola melhor o que a correção mexeu). Código sob o
   marcador alterado/movido/removido sem o `REVERTER EXIGE` demonstrado, marcador removido/esvaziado,
   natureza trocada, ou escalada omitida → `CRITICO`/`architecture`, com o **texto literal** do
   marcador no `suggested_fix`. Como a R3 é invisível a compilador, suíte e QA, **você é o único gate
   que a detecta** — a omissão não é anotável. Seção inerte em projeto host que não define o marcador.
```

> **Cuidado com a numeração**: use o próximo número livre da lista. Inserir fora de ordem é um erro
> fácil de cometer e visível no diff — confira com `grep -n "^[0-9]*\. " <arquivo>` depois de editar.
>
> **Mencione `DELTA` apenas se o seu framework tiver `scan_scope`.** Verifique com
> `grep -c "scan_scope" .claude/agents/agent-spec-staff-architecture-review.md`; se for zero, corte
> a cláusula.

---

## 3. ACHADO 2 — o cruzamento com `O QUE ESTA MUDANÇA REMOVE` é impossível por falta de dado

Este achado tem **dois lados**, e quase sempre só o segundo é percebido. Corrigir só o segundo produz
um critério que nunca dispara.

### 3.1 Verificação

```bash
# (a) o contrato do Gate 2 tem o critério de garantia removida?
grep -n "O QUE ESTA MUDANÇA REMOVE\|Garantia removida" .claude/agents/agent-spec-staff-architecture-review.md

# (b) a declaração do executor CHEGA ao Gate 2? Procure o campo no formato de retorno exigido:
grep -rn "retorne APENAS o formato" .claude/skills/agent-spec-*run*/SKILL.md

# (c) qual bloco carrega o sumário do executor até o Gate 2 (é o encanamento que você vai reusar):
grep -rn "Sumário do executor" .claude/skills/
```

**`CONFIRMADO`** quando (a) não retorna nada **e** o formato de retorno em (b) não tem campo algum
sobre garantias/remoções.

### 3.2 O diagnóstico que define a correção — leia antes de escrever qualquer coisa

A linha `O QUE ESTA MUDANÇA REMOVE` que o executor declara antes de editar **morre no contexto dele**.
O formato de retorno é deliberadamente enxuto e proíbe relatório, e nenhum campo a carrega. Logo, o
cruzamento que a §6 exige **não é uma instrução faltando — é um dado inexistente**.

Escrever o critério no contrato do Gate 2 sem resolver isso produz um critério que só olha o diff e
sempre reporta "declaração ausente". Pior: ensina o gate a tratar ausência como normal.

**A boa notícia é que o encanamento já existe.** O comando (c) mostra que o bloco
`## Sumário do executor (intenção)` já viaja do executor ao Gate 2 nos três frameworks. Falta **um
campo**, não um artefato novo. Não crie arquivo intermediário, não crie passo novo no orquestrador.

### 3.3 Correção, lado 1 — o campo no formato de retorno do executor

Em **cada** skill de execução (`agent-spec-sdd-run-tasks`, `agent-spec-minispec-run-tasks`,
`agent-spec-taskcard-run` — os nomes podem variar), acrescente o campo ao formato exigido, **antes**
de `Pendências`:

```
/ Garantias removidas: [nenhuma | <o que saiu> em <arquivo>]
```

E acrescente a explicação logo em seguida, no mesmo bloco de instrução:

> O campo **Garantias removidas** lista toda validação, guarda, timeout, tratamento de erro,
> liberação de recurso ou redação de segredo **que já existia no código** e que a sua mudança apagou
> ou afrouxou — `nenhuma` quando você não removeu nada, que é o caso comum. Garantia que você mesmo
> introduziu nesta task não conta. O campo alimenta o cruzamento do Tech Review: omitir uma remoção
> real é o que torna o achado CRÍTICO em vez de discutível.

**Três cuidados**:

1. **Escreva a explicação autossuficiente.** Executores de outros projetos podem não ter o protocolo;
   a pergunta "o que você removeu?" tem de ser respondível sem ele.
2. **Ajuste a contagem** se o texto disser "apenas esse bloco de N linhas" — passa a ser `N+1`.
3. **Custo real ≈ uma palavra.** `nenhuma` é a resposta na esmagadora maioria das tasks, que criam
   código em vez de apagar garantia. Se alguém objetar ao custo de token, é este o número.

**Se o projeto tiver agente executor próprio** (um implementador customizado em `.claude/agents/`),
atualize o bloco de retorno dele também — senão ele devolve o formato antigo e o campo chega vazio.
Procure com:

```bash
grep -rln "Arquivos: X criados" .claude/agents/
```

### 3.4 Correção, lado 2 — o bloco no prompt do Gate 2 (nos TRÊS espelhos)

Logo abaixo do bloco `## Sumário do executor (intenção)`, em **cada** espelho, insira:

```markdown
## Declaração do executor — O QUE ESTA MUDANÇA REMOVE
[campo "Garantias removidas" do output enxuto, literal. "nenhuma" quando o executor declarou não ter
removido nada; "<ausente>" quando o retorno veio sem o campo (executor em formato antigo)]
Cruze esta declaração com as linhas removidas (`-`) do diff: garantia que sumiu do diff e NÃO consta
aqui é remoção não declarada → CRITICO. A declaração agrava ou absolve o achado — **ela nunca
dispensa a varredura**. Ver "Garantia removida" no seu Checklist de Validação.
```

> Atenção: num dos frameworks o prompt do Gate 2 costuma viver em
> `references/staff-review-prompt.md` em vez do `SKILL.md`. O comando (c) da §3.1 mostra onde cada um
> está. **São três inserções, sempre.**

### 3.5 Correção, lado 3 — o critério no contrato do Gate 2

**Checklist**, logo após a subseção do Achado 1:

````markdown
### Garantia removida — cruzamento com a declaração do executor (CRÍTICO)

> O prompt traz o bloco **"Declaração do executor — O QUE ESTA MUDANÇA REMOVE"**. Se ele vier
> `nenhuma`, `<ausente>`, ou não vier, **a varredura do diff continua obrigatória** — a declaração
> agrava ou absolve o achado, nunca é pré-condição para procurá-lo.

Correção que faz o gate passar **removendo a garantia que reprovava** é o caminho mais barato para o
verde e o mais caro para o produto. Diferente do teste enfraquecido (coberto pelo anti-gaming em
"Testes"), aqui o que sai é **código de produção**, e a suíte fica verde honestamente: a condição que
falhava deixou de ser verificada.

**Varra as linhas removidas (`-`) do diff.** Sinais canônicos:

| O que sumiu | Como aparece no diff |
|---|---|
| validação de entrada / precondição | checagem de faixa, formato ou obrigatoriedade; schema afrouxado ou removido |
| guarda de autorização / ownership | verificação de permissão, de tenant, de dono do recurso |
| `timeout` / limite | sinal de aborto, teto de tentativas, limite de tamanho ou de tempo |
| tratamento de erro | ramo de erro deletado, `try`/`catch` removido, erro tipado virando genérico ou silenciado |
| liberação de recurso | bloco `finally`, fechamento de conexão/arquivo, cancelamento de inscrição |
| redação de segredo | máscara/filtro antes do log, omissão de campo sensível na resposta |

**A classificação sai do cruzamento**:

| Situação | Severidade | Categoria |
|---|---|---|
| Removida **e NÃO declarada** pelo executor | `CRITICO` | `security` se a garantia era de autorização, segredo ou validação em área crítica; senão `architecture` |
| Removida **e declarada**, mas a task não pedia a remoção | `ALTO` | a da natureza da garantia (`security`, `error_handling`, `architecture`) |
| Removida, declarada **e** exigida pelo escopo da task — ou trocada por equivalente **mais forte** | não é achado | — (registre em `observacoes`) |

**A não-declaração é o agravante, e a razão é concreta**: a linha `O QUE ESTA MUDANÇA REMOVE` existe
para forçar o executor a **perceber** o que apaga. Garantia que sumiu do diff sem constar na
declaração é remoção que ninguém pesou — nem o executor, nem você, até agora.

**Só conta o que o executor NÃO introduziu**: garantia que nasceu e morreu dentro do mesmo diff é
iteração do próprio autor, não regressão. E **substituição não é remoção** — validação absorvida por
um schema que a contém, `try`/`catch` trocado por tratamento centralizado equivalente: diga isso em
`observacoes` em vez de abrir achado.
````

**Regras Críticas** — próximo número livre:

```markdown
N. **Garantia removida do código de produção**: varra as linhas removidas (`-`) do diff por validação,
   guarda, timeout, tratamento de erro, liberação de recurso ou redação de segredo que **já existia** e
   sumiu. Cruze com o bloco "Declaração do executor — O QUE ESTA MUDANÇA REMOVE": **não declarada →
   `CRITICO`** (`security` ou `architecture`); declarada e não pedida pela task → `ALTO`; declarada e
   exigida, ou trocada por equivalente mais forte → `observacoes`. **A ausência do bloco não dispensa
   a varredura.**
```

> **As duas guardas do parágrafo final não são ornamento.** Sem "a ausência não dispensa a varredura",
> um executor que simplesmente omita o campo desliga a detecção inteira — o defeito passa a se
> autoproteger. Sem "só conta o que o executor não introduziu", todo refactor interno do próprio autor
> vira achado, o gate ganha fama de barulhento e o critério é ignorado na prática. **Não corte
> nenhuma das duas.**

---

## 4. VALIDAÇÃO — como provar que isto não é texto morto

Mudança em contrato de agente não tem suíte. Isso **não** é licença para declarar pronto sem prova.
Faça as três verificações abaixo, nesta ordem, e mostre a saída de cada uma.

### 4.1 Simetria dos espelhos (mecânica)

```bash
grep -rc "Declaração do executor — O QUE ESTA MUDANÇA REMOVE" <espelho1> <espelho2> <espelho3>
grep -rlc "Garantias removidas" .claude/skills/*/SKILL.md .claude/agents/
```

O primeiro tem de retornar `1` em cada um dos três. Um espelho com `0` é a falha número um desta
tarefa.

### 4.2 O diff é acréscimo (antirregressão)

```bash
git diff --stat
git diff -- .claude/ | grep "^-" | grep -v "^---"
```

**Toda** linha removida tem de ser uma que você substituiu deliberadamente — na prática: a linha de
severidade `CRITICO` e os formatos de retorno. Liste-as uma a uma e explique cada uma. Linha removida
sem explicação é regressão sua: reverta.

### 4.3 Prova de detecção (a que realmente importa)

As duas anteriores provam que o texto está lá. Esta prova que o texto **funciona** — é o análogo do
mutante que o protocolo exige para defeito corrigido.

1. Crie um branch descartável e escolha um arquivo real do projeto que tenha uma guarda (validação,
   `try`/`catch`, checagem de permissão).
2. Aplique **um** mutante: apague a guarda. Se o host usa `DECISÃO FECHADA`, faça um segundo mutante
   apagando um marcador existente.
3. Rode o `agent-spec-staff-architecture-review` sobre esse diff, montando o prompt como o
   orquestrador monta — **incluindo** o bloco novo com `Garantias removidas: nenhuma` (é o cenário
   agravado: removeu e não declarou).
4. **Aprovado** se o retorno trouxer `severity: "CRITICO"` para o achado correspondente.
   **Reprovado** se passar limpo — nesse caso o critério não está governando, e o problema costuma ser
   posição (ficou só no checklist, sem entrar na régua de severidade nem nas Regras Críticas).
5. `git checkout` no arquivo e apague o branch. **Nunca deixe o mutante na árvore.**

> Se você pular esta prova, **diga que pulou** e por quê. Não a descreva como feita.

---

## 5. RELATÓRIO FINAL

Entregue ao usuário, em prosa curta:

1. **Tabela de classificação** dos dois achados (`CONFIRMADO` / `AUSENTE` / `DIVERGENTE`), com o
   comando e a saída que fundamentaram cada um.
2. **Arquivos tocados**, um por linha, com o que mudou em cada.
3. **As declarações do P3** que você escreveu antes de editar.
4. **As três verificações da §4**, com saída real. Se a §4.3 foi pulada, diga.
5. **O que ficou de fora**, se algo ficou — e por quê.

**Não commite.** O trabalho fica na árvore; a decisão de commitar é do usuário.

---

## 6. APÊNDICE — o erro de leitura que originou tudo isto

Vale registrar, porque ele se repete e faz procurar no lugar errado.

A auditoria começou pela suspeita de que um **agente executor customizado** estivesse sem ponteiros
que os agentes do framework teriam. A medição inverteu a conclusão: o executor customizado era o
**único** dos quatro agentes com ponteiro explícito ao protocolo, e nenhum agente do framework citava
o arquivo — porque não precisa: a rule carrega via `paths: "**"` no system-prompt de todos.

A lacuna real estava um nível acima. **Herdar a doutrina não é ter o critério no contrato de
trabalho.** O agente decide veredito por checklist, régua de severidade e regras críticas; critério
que não está em nenhuma das três não governa decisão — e a §6 do protocolo endereçava obrigações a um
gate que nunca as recebeu por escrito.

Se você for auditar outros pontos do seu framework, a pergunta útil não é *"o agente tem acesso à
regra?"* — quase sempre tem. É ***"a regra está escrita na superfície pela qual esse agente decide?"***
