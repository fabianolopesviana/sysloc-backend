# Tech Alignment — Painel Master: ciclo de vida de Empresas e Admin Empresa

- **Feature / versão**: `painel-master-administradores` / `v1`
- **Framework**: SDD
- **Variante**: `backend`
- **Definição**: `docs/prds/features/painel-master-administradores/v1/prd.md` (10 US · 20 CA · 16 RN)
- **Discovery lido**: `docs/specs/features/painel-master-administradores/v1/pre-refinement.md` · `plano-de-origem.md` (a hipótese técnica inicial — o plano aprovado em 2026-09-01, hoje versionado na própria fatia) · `docs/plano-backend-novo/handoff-master-frontend.md` (fora da pasta da feature)
- **ADRs consultadas**: 0008, 0009, 0011, 0013, 0014, 0017, 0021, 0024, 0031, **0038**
- **Data**: 2026-09-01 · **Status**: decidido

---

## 1. Contexto técnico

A superfície do operador do SaaS é hoje **unidirecional**: ela admite Empresa e Admin Empresa e não oferece leitura nem mutação posterior sobre nenhum dos dois. A feature acrescenta leitura, mutação cadastral, transição de estado de acesso e remoção física — sobre entidades que vivem no **schema de identidade** (ADR-0009), que não porta política de isolamento, e cujo alcance para esta persona é global por perfil (ADR-0011), não por contexto de Empresa.

**O invariante que domina o desenho**: a sessão do Sysloc Master **não porta contexto de Empresa** — por construção, e por restrição declarada (ADR-0008: a origem do contexto nunca é a requisição). Toda leitura que dependa do isolamento imposto pelo armazenamento é, para esta persona, **vazia por definição** — não vazia por ausência de dado. Qualquer decisão desta feature que se apoie numa contagem sobre o schema de negócio produz um resultado **indistinguível entre "não há registro" e "não tenho alcance"**, e as duas leituras levam a atos opostos. É a fonte de erro mais cara da feature, e ela é **silenciosa**: nenhuma asserção que não a persiga especificamente a revela.

O segundo invariante é da ADR-0013: o poder desta persona sobre credencial é **auditado pela trilha**, e a trilha é a mitigação declarada (*"sem isso, ela não existe"*). Nenhuma decisão aqui pode consumir essa trilha como custo.

---

## 2. Soluções técnicas decididas

### D1 — Critério de admissibilidade da Exclusão definitiva

**Por que decidir**: a RN-10 e a RN-11 condicionam a remoção à ausência de qualquer registro associado. Quem apura essa ausência, e com que autoridade, decide se a feature é correta ou catastrófica.

**Solução: D1-b — a integridade referencial do armazenamento é o critério, e a única autoridade.** A remoção é **tentada**; a recusa por dependência é traduzida em recusa de domínio. Nenhuma contagem é escrita na aplicação.

Caminhos avaliados:

- **D1-a — contagem prévia na aplicação.** _Exemplo:_ somar os registros de negócio da Empresa e permitir a remoção quando o total for zero. _Prós:_ intuitivo, sem dependência do comportamento do armazenamento. _Contras:_ **refutado por medição** — sob o isolamento forçado e sem contexto de Empresa, a contagem devolve zero para uma Empresa cheia, e a superfície habilitaria remover uma Empresa inteira em produção. _Viabilidade:_ **conflita com a ADR-0008** na única saída que a tornaria correta (derivar o contexto do identificador recebido na requisição — exatamente a origem proibida).
- **D1-b — integridade referencial como critério** (recomendada). _Exemplo:_ a remoção da Empresa é recusada pelo armazenamento enquanto existir qualquer registro que a referencie; a recusa vira resposta de domínio. _Prós:_ a verificação de integridade **ignora o isolamento por construção** — é o que garante integridade sob política —, então não há como enganá-la; nenhum código novo pode "esquecer" uma dependência. _Contras:_ o vocabulário de recusa depende de um mapeamento mantido (tratado em D5); a mensagem crua da recusa carrega valores e não pode escapar para a resposta. _Viabilidade:_ **reusa doutrina já escrita e provada no projeto** — a admissão de Empresa já decide duplicidade pelo armazenamento em vez de por leitura prévia, com a razão registrada no próprio código.
- **D1-c — função privilegiada que atravessa o isolamento para contar.** _Exemplo:_ um leitor de propósito único, de identidade própria, autorizado a somar registros de qualquer Empresa. _Prós:_ devolveria uma contagem verdadeira. _Contras:_ é uma segunda definição do critério, livre para divergir da primeira. _Viabilidade:_ **conflita com a ADR-0024** — a emenda de 2026-08-13 admite a forma, mas o discriminador dela exige função **sem parâmetro de Empresa**, e esta precisaria de um; exigiria migração e emenda de ADR para obter o que D1-b já impõe.

**Trade-off aceito**: a completude do critério passa a depender de que toda entidade de negócio seja alcançável por referência à Empresa. É propriedade verdadeira hoje e **precisa de asserção própria** (ver D5 e "Restrições"), sob pena de uma entidade futura nascer fora do alcance em silêncio.

> **Registrada na ADR-0038** (`alcance-da-exclusao-logica-e-fisica-na-identidade`, accepted, 2026-09-01). O tech-alignment **referencia**, não duplica.

---

### D2 — Como a prévia de elegibilidade não diverge do ato

**Por que decidir**: a RN-13 exige que a resposta sobre "posso excluir?" e o ato obedeçam ao mesmo critério. Um segundo critério, escrito à parte, é livre para divergir do primeiro — e é a classe de defeito que o protocolo antirregressão do projeto persegue por escrito.

**Solução: D2-b — a prévia executa o próprio ato, em ensaio, e o desfaz.** O que responde "pode?" é a mesma operação que executa "faça", encerrada com retorno ao ponto anterior. Não existe segundo critério.

Caminhos avaliados:

- **D2-a — predicado próprio para a prévia.** _Exemplo:_ uma consulta de elegibilidade escrita à parte, mantida em paralelo com a operação de remoção. _Prós:_ leitura barata e sem escrita. _Contras:_ duas definições do mesmo critério, que divergem no primeiro crescimento do modelo; e, para a Empresa, a consulta cai na armadilha do D1-a. _Viabilidade:_ reintroduz exatamente o defeito que D1 fecha.
- **D2-b — ensaio do próprio ato** (recomendada). _Exemplo:_ a operação é executada dentro de um ponto de retorno da transação e desfeita incondicionalmente; o desfecho — aceita ou recusada, e por qual dependência — é a resposta. _Prós:_ um critério só, por construção; a prévia **não pode** divergir do ato porque é o ato. _Contras:_ o ensaio toma bloqueios que o retorno ao ponto anterior **não libera** antes do fim da transação de leitura, e o custo cresce com o tamanho da página. _Viabilidade:_ reusa a mecânica de ponto de retorno já empregada no projeto para reconhecer violação de unicidade sem abortar a transação.
- **D2-c — não publicar a prévia; a interface tenta e trata a recusa.** _Exemplo:_ o botão fica sempre habilitado, e a recusa aparece depois do clique. _Prós:_ custo zero na leitura. _Contras:_ **contraria a RN-15 e o objetivo da US-07**; e é precisamente a "recusa muda" que a ADR-0014 rejeitou ao recusar a exclusão condicional.

**Trade-off aceito**: bloqueios retidos durante a montagem de uma página, em troca da impossibilidade de divergência. Aceitável na escala declarada da persona (operador único, dezenas a poucas centenas de Empresas) — e a escala é premissa registrada no PRD, não suposição desta decisão.

**Nota de fronteira (TOCTOU)**: a divergência entre a leitura e o clique **não é eliminável**, e o desenho não pretende eliminá-la. O que ele garante é que **o ato é auto-verificado**: o pior caso é uma recusa que nomeia o motivo (CA-19), nunca uma remoção indevida.

---

### D3 — Como o Painel Master alcança a pessoa para suspender e reativar

**Por que decidir**: existe uma operação equivalente na aplicação da imobiliária, e reusá-la é a economia aparente. Ela é **inalcançável**, por dois motivos independentes — e o segundo não se vê de fora.

**Solução: D3-b — caminho de acesso próprio, direto sobre a identidade.**

Caminhos avaliados:

- **D3-a — reusar a operação da aplicação da imobiliária.** _Exemplo:_ o Painel Master invoca o mesmo caminho que um Admin Empresa usa para retirar o acesso de um Usuário Empresa. _Contras:_ **(i)** aquela operação é governada por chave do catálogo fechado, e a matriz desta persona é vazia por decisão da ADR-0011 — o acesso é negado; **(ii)** o alcance dela chega à pessoa **através do Vínculo de acesso**, sob a política de isolamento, e para esta persona alcançaria zero pessoas; **(iii)** o Admin Empresa admitido pelo próprio Painel Master **não possui vínculo** até que alguém aja sobre ele pela outra aplicação — de modo que, mesmo com (i) e (ii) resolvidos, o alvo mais comum da feature seria invisível. _Viabilidade:_ inviável. Note que (ii) e (iii) falham em **silêncio** — a operação reportaria sucesso com zero efeito.
- **D3-b — caminho próprio sobre a identidade** (recomendada). _Exemplo:_ a marcação de estado e o encerramento dos acessos abertos alcançam a pessoa diretamente, na mesma unidade de trabalho. _Prós:_ é a forma que a suspensão de **Empresa** já usa e que já passou pelos gates; o schema de identidade não porta política, e o escopo do alcance é a chave, não a política. _Contras:_ cria um segundo escritor do mesmo fato (tratado em D4). _Viabilidade:_ reusa desenho existente e provado no mesmo módulo.
- **D3-c — conceder à persona a chave que falta.** _Contras:_ infla o catálogo declarado fechado — alternativa **rejeitada nominalmente pela ADR-0011** (*"o catálogo deixaria de ser a matriz do produto e viraria um índice de rotas"*).

**Trade-off aceito**: duplicação deliberada de duas operações de escrita com alcances distintos, em vez de uma com alcance parametrizado.

---

### D4 — Convivência dos dois escritores do mesmo fato de acesso

**Por que decidir**: consequência direta de D3 e da RN-14. Duas operações passam a escrever o mesmo fato com verbos diferentes, e a "unificação" é a refatoração que qualquer leitor futuro vai propor.

**Solução: D4-a — as duas convivem, com alcances distintos declarados no ponto do código.** A fusão é **proibida** e a proibição é registrada onde a tentação acontece, com a condição objetiva que a reverteria.

Caminhos avaliados:

- **D4-a — duas operações, alcances distintos, protegidas** (recomendada). _Prós:_ preserva o alcance correto de cada persona; a duplicação é **de alcance, não de regra** — o fato gravado é idêntico. _Contras:_ dois pontos a manter em coerência. _Viabilidade:_ o projeto já mantém um par análogo para o encerramento de acessos (por pessoa e por Empresa), com a razão declarada.
- **D4-b — ponto único com alcance parametrizado.** _Exemplo:_ uma operação que recebe o alcance como argumento. _Contras:_ o parâmetro que a torna correta para o Painel Master é justamente o que dispensa o isolamento — e um valor default errado devolve **suspensão silenciosamente inócua**, aprovada por qualquer asserção que só verifique a marcação. _Viabilidade:_ é a "simplificação" que reintroduz o defeito de D3-a por outro caminho.

**Trade-off aceito**: duas cópias de alcance, em troca de tornar o modo de falha **ruidoso** em vez de silencioso.

**Consequência de produto já decidida** (RN-14, não reaberta aqui): a suspensão feita pelo Painel Master é reversível pela aplicação da imobiliária.

---

### D5 — Como o vocabulário de classes de impedimento permanece completo

**Por que decidir**: a RN-15 exige que a recusa nomeie a **classe** do impedimento. Se o modelo crescer com uma dependência nova e o mapeamento não acompanhar, a recusa degrada para falha genérica — e a RN-15 deixa de valer sem que nada acuse.

**Solução: D5-b — vocabulário fechado, conferido por igualdade contra o catálogo do armazenamento.**

Caminhos avaliados:

- **D5-a — mapeamento estático mantido à mão.** _Prós:_ trivial. _Contras:_ dependência nova nasce sem entrada e vira falha genérica em produção, silenciosamente.
- **D5-b — vocabulário fechado com asserção de cobertura** (recomendada). _Exemplo:_ o conjunto das dependências que podem recusar a remoção é lido do próprio catálogo do armazenamento e comparado por **igualdade de conjunto** com o vocabulário publicado; uma dependência nova sem classe correspondente reprova na verificação, não em produção. _Viabilidade:_ é a forma que a rule de âncoras de superfície do projeto já prescreve — igualdade de conjunto com controle antivácuo, nunca contenção.
- **D5-c — classe única genérica** (*"existem registros"*). _Prós:_ nada a manter. _Contras:_ não distingue o impedimento da Empresa do impedimento da pessoa, e a RN-15 exige justamente a classe. Perde o CA-17.

**Trade-off aceito**: uma asserção a mais, em troca de a completude do D1 deixar de depender de disciplina.

---

### D6 — Como a superfície declarada acomoda o crescimento

**Por que decidir**: as operações desta feature crescem a superfície publicada, que é fixada por inventário asserido. Há um inventário **histórico** que fixa o tamanho da superfície anterior a uma feature passada, e crescê-lo reprovaria uma asserção legítima sobre trabalho já entregue.

**Solução: D6-b — partição nomeada nova, subtraída das asserções históricas.** O inventário anterior permanece **intocado**, e o crescimento é declarado à parte.

Caminhos avaliados:

- **D6-a — crescer o inventário existente do Painel Master.** _Contras:_ aquele inventário alimenta a asserção que fixa o tamanho da superfície **anterior** a outra feature; crescê-lo a reprova sobre superfície legítima. E perde a propriedade que o torna útil — ele deixa de detectar a remoção de uma operação antiga.
- **D6-b — partição nomeada nova** (recomendada). _Prós:_ o inventário histórico segue detectando remoção; o crescimento fica atribuído à feature que o produziu. _Viabilidade:_ é o padrão já empregado no projeto — a mesma verificação já carrega várias partições nomeadas, criadas exatamente assim.

**Restrição herdada, não decisão**: o congelamento declarado da superfície alcança a aplicação da imobiliária e **não** o Painel Master, por decisão registrada na tech spec de `autorizacao-e-ciclo-de-acesso (v1)`. O registro geral do projeto afirma o congelamento **sem qualificar o público**, e emendá-lo é entrega obrigatória do PRD (§9) — sem isso a implementação para por conflito aparente.

---

## 3. Candidatas a ADR

- **D1 / D2 — JÁ REGISTRADA.** `ADR-0038 — Alcance da exclusão lógica e da exclusão física na identidade` (accepted, 2026-09-01). Referenciar, não duplicar.
- **D6 — candidata.** O recorte que exclui o Painel Master do congelamento é **transversal e evergreen** (governa toda feature futura desta superfície), custa caro reverter, e é **surpreendente sem contexto** — hoje ele vive apenas numa tech spec de feature fechada, enquanto o registro geral do projeto afirma o oposto sem qualificar. Promovê-lo evita que cada feature futura redescubra o conflito.
  ```
  /agent-spec-adr-create "alcance do congelamento da superficie publicada"
  ```
- **D3, D4, D5** — feature-scoped. Não qualificam: são consequências do alcance desta persona, não padrões do projeto.

---

## 4. Restrições e invariantes técnicas

1. **Nenhuma contagem sobre o schema de negócio decide coisa alguma nesta feature** (D1). A leitura é vazia por construção para esta persona.
2. **O contexto de isolamento nunca deriva do identificador recebido na requisição** (ADR-0008). Vale inclusive para a remoção, e é o que elimina D1-a.
3. **A trilha de auditoria nunca é destruída** (RN-16, ADR-0013): a existência de trilha é impedimento, não obstáculo a contornar.
4. **A recusa informa classe e alternativa, nunca entidade ou quantidade** (RN-15, RN-02) — restrição derivada da garantia de isolamento da ADR-0013.
5. **A mensagem crua de recusa do armazenamento não escapa para a resposta**: ela carrega valores de chave. Só a identificação da dependência é lida.
6. **Nenhuma migração.** As colunas de estado e os vínculos que sustentam RN-03 a RN-11 já existem; o critério de D1 é imposto pelo modelo atual.
7. **Transição de estado é ato próprio, nunca campo de edição** (ADR-0021, metade categórica). A RN-07 é cumprida **por construção** se as entradas de edição forem fechadas — chave desconhecida recusa em vez de ser ignorada (rule de contrato publicado).
8. **A forma da resposta de erro segue a ADR-0017**, sem acrescentar código ao enum — decisão de produto já registrada no PRD.
9. **O inventário histórico de superfície sai intocado** (D6).
10. **Marcadores de decisão fechada** nos pontos de escrita do fato de acesso (D4) e no critério de elegibilidade (D1/D2), com a condição objetiva de reversão — são os dois alvos prováveis de regressão de decisão.

---

## 5. Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

1. **Granularidade da unidade de trabalho da remoção da Empresa** — a RN-12 exige atomicidade entre a remoção das pessoas e a da Empresa; a forma concreta é do TECH_SPEC.
2. **Ordenação e paginação da listagem** — a forma já é padrão do projeto (janela servida, nunca ecoada); o critério de desempate é detalhe do TECH_SPEC.
3. **Onde a asserção de cobertura do D5 vive** e como lê o catálogo — a decisão aqui é que ela exista e afirme por igualdade.
4. **Se a elegibilidade é apurada por item da listagem ou sob demanda** — o custo de D2 escala com a página; a escolha é do TECH_SPEC, dentro do teto de página já declarado.

**Dependências de produto não resolvidas** (sinalizadas, **não** decididas aqui — as três vêm da §13 do pre-refinement e nenhuma bloqueia):

5. Filtro por estado na listagem de Admin Empresa.
6. Se a Empresa pode ser removida enquanto suspensa (os dois estados são ortogonais no desenho).
7. Se a edição registra autoria no diário, por simetria com as operações que já registram.
