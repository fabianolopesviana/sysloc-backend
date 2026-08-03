# Tech Alignment — fundacao-multitenancy-identidade (v1)

- **Feature / versão**: `fundacao-multitenancy-identidade` · v1 (fatia 1 da F1)
- **Framework**: SDD · **Variante**: backend
- **Definição de entrada**: `docs/prds/features/fundacao-multitenancy-identidade/v1/prd.md` (13 US, 17 CA)
- **Discovery lido**: `docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md`
- **ADRs consultadas**: ADR-0008 (vinculante), ADR-0006, ADR-0007, ADR-0005
- **Data**: 2026-08-01 · **Status**: decidido

---

## 1. Contexto técnico

Fatia greenfield de persistência: não existe schema, migração nem camada de dados no repositório. O que existe da F0 e é reusado: driver `postgres` 3.4.9 (já dependência do serviço de aplicação), instância efêmera de banco para verificação, registro estruturado com redação de segredo por entrada única de despacho, contrato de erro da ADR-0007 e validação de configuração que falha na partida.

Dois invariantes governam o desenho e se tocam num único ponto. O primeiro: o isolamento é propriedade do banco, e a camada de aplicação **não** tem filtro equivalente (ADR-0008) — logo, esquecer o filtro devolve vazio, nunca dado alheio. O segundo: o contexto de tenant **nunca** é lido do pedido, e sua origem legítima é a sessão. O ponto de contato é a autenticação, que precisa operar **antes** de existir contexto de empresa — e é essa assimetria que comanda as decisões D1 e D6.

Três fatos medidos no terreno reposicionaram hipóteses do discovery:

1. **A instância efêmera conecta como superusuário do cluster** (`packages/shared/test/postgres-efemero.ts` — o papel que ela cria é o dono do cluster e é o único exposto na cadeia de conexão). O PostgreSQL ignora RLS para superusuário: uma suíte de isolamento escrita sobre essa conexão fica **verde sem provar nada**. É o modo de falha que a ADR-0008 nomeia nos *Cons* e que o CA-17 existe para barrar.
2. **`drizzle-orm` 0.45.2 declara `enableRLS()`, `pgPolicy()` e `pgRole()`, mas não emite `FORCE ROW LEVEL SECURITY`** (zero ocorrências no pacote publicado). O que a ADR chama de indispensável é exatamente o que o caminho declarativo não cobre.
3. **`better-auth` 1.6.25 cobre menos que o suposto**: `minPasswordLength` existe (default 8, configurável) mas **não há verificação de força**; **não há bloqueio por tentativas na conta** — apenas limitação por janela e rota, em memória ou armazenamento secundário; e `twoFactorEnabled` é atributo *opt-in por usuário*. Há adaptador Drizzle oficial e ganchos de banco (`databaseHooks`) como pontos de extensão.

A hipótese do discovery de que o arcabouço entregaria as três coisas por configuração está **refutada**. O gatilho de reclassificação da §15.5 do pré-refinamento — *"se cada um virar implementação própria, a autenticação merece fatia separada"* — foi avaliado e **não se aplica**: o que sobra de implementação própria são três regras de admissão que convergem numa única barreira (D6), não três subsistemas.

---

## 2. Soluções técnicas decididas

### D1 — Fronteira entre identidade e negócio: separação por schema

**Escolhida**: dois schemas no mesmo banco. Identidade em um schema sem noção de tenant; negócio em um schema onde toda tabela nasce vinculada a empresa, com RLS habilitada e forçada, e com concessão ao papel da aplicação.

O ganho decisivo é a **definição operacional de "tabela de negócio"** que o CA-16 exige: ela deixa de ser lista mantida à mão e vira predicado sobre o catálogo do banco — *existe alguma tabela neste schema sem RLS forçada?*. A trilha de tentativas de entrada fica no schema de identidade, porque tentativa malsucedida pode não ter usuário nem empresa a que se vincular.

Rejeitadas:
- **Regime único com via privilegiada no login** — todas as tabelas sob o mesmo regime, com o fluxo de autenticação escapando por uma via própria. _Contra:_ cria precisamente o segundo caminho para o dado que a ADR-0008 rejeita, e esse escape passa a ser o alvo óbvio de qualquer defeito futuro. _Viabilidade:_ não exige nada novo, mas contraria a decisão vinculante.
- **Convenção por presença da coluna de empresa** — é de negócio quem tem a coluna. _Contra:_ a guarda vira heurística e a tabela que nascer sem a coluna é invisível para o detector — defeito e detecção compartilham a mesma causa, que é o oposto do que o CA-16 compra.

**Trade-off aceito**: consultas que cruzem as duas classes passam a exigir qualificação explícita, e a fronteira precisa ser respeitada por convenção de escrita — em troca, a prova de cobertura vira mecânica.

### D2 — Papéis de banco: dono/migrador separado do papel da aplicação

**Escolhida**: o papel que cria e altera estrutura não é o papel que atende requisição, e a migração é executada **fora do processo que serve a aplicação**. Herda a forma do instalador idempotente da ADR-0005.

A ADR-0008 já fecha *papel de aplicação não-superusuário* e *FORCE RLS* — isso é restrição, não decisão. O que estava aberto era a **propriedade das tabelas**, e ela importa porque o dono também escapa da RLS por padrão.

Rejeitadas:
- **Papel único (dono = aplicação), confiando apenas no FORCE** — _Contra:_ basta um FORCE ausente em uma tabela para o acesso irrestrito voltar a quem atende requisição. Uma única falha derruba a garantia; não há rede.
- **Aplicação migra na partida com o próprio papel** — _Contra:_ exige poder de alteração de estrutura em quem serve requisição, e a separação da ADR-0006 existe justamente contra esse tipo de contaminação.

**Trade-off aceito**: mais uma credencial a provisionar e a configuração passa a ter duas identidades de conexão — hoje há uma só. Em troca, contornar o isolamento exige **duas** falhas independentes.

### D3 — Fixação do contexto: unidade de trabalho obrigatória

**Escolhida**: toda operação de dado corre dentro de uma transação que fixa o contexto de empresa antes da primeira instrução, com o contexto vindo do armazenamento assíncrono e nunca de parâmetro. O caminho de acesso sem contexto **não é exportado** — consulta fora da unidade de trabalho deixa de ser possível de escrever, em vez de depender de revisão.

Rejeitadas:
- **Conexão dedicada por requisição, com contexto fixado na conexão** — evita o custo de transação em leitura. _Contra:_ contexto que sobreviva ao fim do pedido vaza para a requisição seguinte, que é o modo de falha mais caro concebível nesta fatia; e a ADR-0008 fixa por transação, não por conexão.
- **Interceptação no driver** — transparente para quem escreve consulta. _Contra:_ é implícito, não se prova por teste, e um caminho que não passe pelo interceptador é indetectável.

**Trade-off aceito**: até a leitura mais trivial abre transação.

### D4 — Origem do DDL de segurança: híbrido declarativo + SQL explícito

**Escolhida**: estrutura, vínculos e políticas onde o caminho declarativo alcança; `FORCE`, concessões e o que o gerador não emite em SQL explícito, na mesma migração. A rede é a guarda de catálogo do CA-16, que não confia em nenhum dos dois lados — ela pergunta ao banco.

Rejeitadas:
- **Tudo declarativo** — _Contra:_ o gerador comprovadamente não emite `FORCE` nem concessões, e o schema **pareceria completo** sem elas; é falha silenciosa por omissão.
- **Tudo em SQL manual** — _Contra:_ descarta a checagem de tipos entre schema e código, que é metade do valor do ORM já escolhido na stack.

**Trade-off aceito**: duas origens para o mesmo objeto de banco, mitigado por a guarda de catálogo ser a autoridade final sobre o estado real.

### D5 — Lacunas do arcabouço de identidade: bloqueio persistido na conta

**Escolhida**: contador de tentativas e instante de liberação persistidos como estado da própria conta — sobrevive a reinício, é auditável e é a mesma fonte que a barreira de admissão (D6) consulta.

Rejeitadas:
- **Estado no armazenamento de fila já provisionado** — mais barato, com expiração embutida. _Contra:_ o bloqueio de uma conta vira dado sem dono, fora do banco onde a trilha de auditoria vive, e expiração de cache não é a mesma coisa que decisão de negócio revogável.
- **Usar apenas a limitação nativa do arcabouço** — _Contra:_ ela é por rota e janela de tempo, não por conta: cinco tentativas suficientemente espaçadas passam ilesas, e a RN-06 fala de conta. Não cumpre o requisito.

Decisões diretas que acompanham (determinadas pelos fatos medidos, sem leque):
- **Comprimento mínimo de senha** é configuração do arcabouço; **verificação de força** é implementação própria — o arcabouço não a oferece.
- **2FA obrigatório para o Master** é regra da barreira D6, não configuração: o atributo do arcabouço é adesão por usuário.

**Trade-off aceito**: escrita no banco no caminho de login, inclusive no caminho de falha.

### D6 — Imposição das recusas: barreira única de admissão

**Escolhida**: uma entrada única por onde toda criação de sessão passa, com cada regra de recusa — empresa suspensa, pessoa desativada, conta bloqueada, senha provisória pendente, segunda verificação exigida pelo perfil — expressa como predicado nomeado e testável isoladamente.

Rejeitada:
- **Um gancho por regra, nos pontos de extensão que o arcabouço oferece** — é a forma idiomática. _Contra:_ é **literalmente a topologia que produziu o vazamento de credencial de quatro rodadas neste repositório** (`.claude/rules/nao-regressao.md` §7): propriedade instalada por ponto, defeito reaparecendo por caminho novo a cada correção. O arcabouço tem mais de um caminho que cria sessão, o que multiplica os pontos a lembrar.

O precedente é direto: a entrada única de despacho da redação de segredo é `DECISÃO FECHADA` neste repositório justamente por ter fechado a classe onde quatro correções pontuais falharam. A fatia seguinte confirma o ganho — acrescentar a recusa por permissões obsoletas vira acrescentar um predicado, não caçar pontos de extensão.

**Trade-off aceito**: exige **provar** que o arcabouço não possui caminho paralelo de criação de sessão que contorne a barreira. Isso é obrigação de prova desta fatia, não suposição — e é a mesma exigência que a ADR-0008 faz ao papel de conexão.

### D7 — Empresa como entidade de domínio própria

**Escolhida**: empresa é entidade do domínio, a pessoa pertence a uma empresa, e a sessão carrega essa empresa sem que ninguém a escolha.

Rejeitada:
- **Plugin de organização do arcabouço** — traria pertencimento múltiplo, convites e organização ativa prontos. _Contra decisivo:_ a organização ativa é **escolhida pelo cliente**, o que colide de frente com o invariante 2 do projeto e com a ADR-0008. Somam-se: o produto não pede pessoa em várias empresas (decisão 2 e decisão 8), e adotá-lo amarraria o modelo de tenant ao ciclo de versões de terceiro num ponto que a ADR declara propriedade do banco. O ganho só existiria se convite e pertencimento múltiplo fossem requisito — não são.

---

## 3. Candidatas a ADR

- **D1 — Fronteira entre identidade e negócio por schema, com a cobertura de isolamento verificada no catálogo.** Satisfaz os cinco critérios: é transversal (toda tabela das F2 a F5 nasce sob ela), tem custo de reversão alto, é surpreendente sem contexto, e teve três alternativas com rejeição fundamentada. Não é redundante com a ADR-0008: aquela decide **onde** o isolamento é imposto; esta decide **como se sabe que ele cobre tudo**.

  ```
  /agent-spec-adr-create "Fronteira entre identidade e negocio por schema, com cobertura de isolamento verificada no catalogo"
  ```

- **D6 — Barreira única de admissão de sessão** — candidata **parcial**. Falha parcialmente em C1 (transversal): hoje alcança esta fatia e a seguinte, ambas da mesma capacidade. Reavaliar na entrada da fatia de autorização: se o mesmo padrão for adotado para a decisão de permissão, a transversalidade se confirma e ela merece registro.

---

## 4. Restrições e invariantes técnicas

Herdadas, não reabertas nesta fatia:

- **ADR-0008** — RLS com `USING` e `WITH CHECK`, chave estrangeira composta como forma de referência entre entidades tenantizadas, contexto fixado por transação e nunca originado do pedido, e **nenhum filtro equivalente na aplicação**.
- **ADR-0006** — a verificação nunca executa contra o ambiente que atende a operação. O helper de instância efêmera **ignora a configuração de conexão do ambiente por construção**, e isso é auditado por grep canônico (`.claude/rules/testing-stack.md`). Qualquer extensão dele preserva essa propriedade.
- **ADR-0007** — toda recusa descrita no PRD responde no envelope canônico, com código vindo do enum fechado. Códigos novos são acréscimo; renomear ou remover é ruptura de contrato.
- **ADR-0005** — segredo nunca trafega por linha de comando nem por variável exportada em script; a credencial adicional da D2 obedece à mesma regra.
- **Invariantes 1 a 4 do `CLAUDE.md`** — multi-tenancy como fundação, contexto nunca lido do pedido, nenhum segredo versionado, dinheiro em decimal exato.
- **Débito D25** — a redação de segredo do registro estruturado não alcança valor em cadeia de consulta, e **esta é a fatia do gatilho**. O marcador em `packages/shared/src/log.ts` já prescreve a forma: um terceiro eixo na **entrada única de despacho** que já existe, não redação na borda; o marcador declara explicitamente que o dono não é o filtro de exceção. Isso é restrição herdada, não decisão aberta. Fechar o débito remove o marcador e a linha do índice do `CLAUDE.md` no mesmo commit.
- **Prova de falsificação** obrigatória para asserção estática (`.claude/rules/testing-stack.md`), e a guarda de catálogo da D4 é asserção sobre estado, não sobre comportamento — ela exige o mutante que a veja reprovar.
- **Protocolo Antirregressão** — a extensão do helper efêmero e a alteração do registro estruturado tocam código existente e provado; exigem baseline antes e depois.

Nascidas das decisões acima:

- Nenhum caminho de leitura ou escrita de dado de negócio existe fora da unidade de trabalho com contexto (D3).
- Nenhuma criação de sessão existe fora da barreira de admissão (D6) — e isso é obrigação de **prova**, não de convenção.
- A conexão usada pela suíte de isolamento não pode ter privilégio que contorne a política; provar o papel de conexão é parte da suíte, não pré-condição implícita (CA-17, ADR-0008).

---

## 5. Pontos em aberto

**Dependências de produto** (não decididas aqui):

1. **O que é "senha forte" além do comprimento mínimo.** O PRD (RN-05) exige verificação de força; o arcabouço só oferece comprimento. O critério — entropia, listas de senhas comuns, proibição de dados pessoais — é decisão de produto, com efeito direto na experiência de quem cadastra. Sem ela, a implementação escolheria o critério por conta própria.
2. **Como o Master inicial habilita a segunda verificação.** O 2FA é obrigatório para o perfil (RN-08) e a adesão é atributo por usuário; nesta fatia o Master nasce por carga inicial. Se a barreira recusar Master sem 2FA configurado, o primeiro acesso fica impossível; se permitir, existe uma janela em que a obrigatoriedade não vale. A resolução é de produto e precisa entrar antes da task de admissão.

**Técnicos, a critério do arquiteto do TECH_SPEC**:

3. Forma concreta da verificação de força — em particular, se ela pode consultar serviço externo no caminho de login. O arcabouço traz um plugin que consulta base de senhas vazadas pela rede; **rede externa dentro do login** é decisão de disponibilidade que depende do critério do item 1.
4. Como a suíte obtém conexão não privilegiada: estender o helper efêmero existente ou provisionar os papéis numa camada acima dele. O helper é código provado da F0 com propriedades declaradas que não podem ser enfraquecidas — a escolha entre estender e envolver é do arquiteto, com a ADR-0006 como limite.
5. Granularidade da guarda de catálogo — se ela roda como caso da suíte, como verificador de infraestrutura, ou nos dois lugares. As duas frentes de teste existem e o critério de placement está em `.claude/rules/testing-stack.md`.

**Observação fora do escopo** (não vira proposta): o vínculo de acesso já nasce nesta fatia com estrutura preparada para os ajustes por usuário da fatia seguinte (direção C2 do pré-refinamento). Preparar a estrutura é escopo; **implementar o ajuste não é** — antecipá-lo seria complexidade especulativa.
