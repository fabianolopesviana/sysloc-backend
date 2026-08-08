# Relatório do Run — cadastro-de-imoveis-e-pessoas/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **11/11 tasks concluídas — as quatro fases completas** · `pnpm test` verde, 10/10 tarefas turbo, **541 casos** · `pnpm build` e `pnpm lint` verdes

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Pacote `@sysloc/contracts` — esquemas base e enums | opus | 12 criados, 2 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Schema do domínio e migrações `0005`/`0006` | opus | 4 criados, 11 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Conferência de CPF e CNPJ em `@sysloc/shared` | opus | 2 criados, 4 mod | ✅ APROVADO | — (gates=[qa]) |
| T4 | Extração da tradução de validação — fecha o D38 | opus | 2 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T5 | Conjunto — dado, serviço e as seis rotas | opus | 8 criados, 12 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T6 | Imóvel — unicidade, circulação e as seis rotas | opus | 3 criados, 7 mod | ✅ APROVADO | ✅ APROVADO |
| T7 | Cômodos e metragem total derivada | opus | 5 criados, 13 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES |
| T8 | Pessoas — dado e serviço parametrizado | opus | 4 criados, 11 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T9 | Os três controladores e a circulação transversal | opus | 6 criados, 14 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T10 | Carteira expandida e janela de listagem | opus | 2 criados, 12 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES |
| T11 | Cobertura de autorização, contrato e fechamento | opus | 2 criados, 4 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO_COM_OBSERVACOES |

**A T8 entrega uma implementação para três recursos**, com o papel como **parâmetro** e não como ramo
condicional espalhado. O modo de falha que ela persegue é **silencioso** — uma parametrização malfeita
escreve na tabela errada sem que nada acuse —, e é por isso que o `CT-350` afirma as **três contagens na
mesma asserção**: contar só a tabela esperada não detecta escrita duplicada. O conjunto de papéis é
fechado no **compilador** (`Record<PapelDePessoa, string>`), e o nome da tabela chega ao SQL pelo
**construtor de identificador** do driver, nunca por interpolação — o Gate 2 confirmou a impossibilidade
estrutural de injeção e acrescentou duas camadas que ninguém tinha visto: o `exports` do
`package.json` publica só `"."`, e o `CT-012` fixa o conjunto do índice por igualdade exata. Suíte de
**506 para 514 casos**.

**Fechou o débito D7 por inteiro.** A metade `incluirRetirados` virou `esquemaDaJanelaComCirculacao` em
`@sysloc/contracts` — a fonte única que a ADR-0016 declara —, com equivalência conferida elemento a
elemento pelos dois gates, e as duas definições locais apagadas.

**Três rodadas, e as duas rejeições vieram do Gate 2 conferindo o OUTRO LADO de afirmações que o Gate 1
tinha aceitado** — que é exatamente o valor de ter dois gates com contratos diferentes:
- o `CT-313` da T9, nomeado como dono da conferência de dígito verificador, **só cobria criação**: o
  Gate 2 foi ler os quatro passos declarados e varreu T9 e T10 inteiras. O ramo de `alterar()` embarcaria
  sem prova em camada alguma. Fechado emendando o card — e o Gate 1 então foi **além do texto** para
  julgar a emenda, conferindo que o esquema de entrada **não** confere DV e que o mutante portanto
  atravessa até o serviço;
- `TABELA_POR_PAPEL` era **exportado sem consumidor de produção**, com o docblock apoiado numa analogia
  falsa (`somarMetragem` **tem** consumidor real; este não tinha). O Gate 2 provou que o `export` era
  redundante usando o **registro de mutantes do próprio executor**.

**Fase 2 (Imóveis) concluída, e a T7 é a task que fecha a equivalência com o sistema legado.** A metragem
total é **derivada na leitura**, com ponto único de soma (`somarMetragem`), e os **quatro cenários do
golden** capturado do Frappe/ERPNext — 0, 25.5, 67.75 e 58.5 — são reproduzidos lendo o
`metragem.json` **do arquivo versionado**, nunca redigitado no teste. A contagem de cenários exercitados
é ela mesma afirmada em 4, âncora contra golden truncado. Suíte de **497 para 506 casos**.

Fechou **dois débitos**: o **D11** (as três pontas — marcador, índice do `CLAUDE.md` e §2 — no mesmo
passo) e a metade `empresaDoContexto` do **D7**, que ganhou lar único em
`packages/db/src/contexto-de-escrita.ts`, com a expressão do recorte de tenant conferida **caractere a
caractere** pelo Gate 2 contra as políticas de `0006_seguranca_dominio.sql` **e** de `0001_seguranca.sql`.
E fechou, fora do escopo, o **D9** — ver a nota no cabeçalho da §2.

**Quatro rodadas, e a leitura delas importa mais que o número.** A rodada 1 aprovou no QA quanto ao
mérito da task e reprovou por um defeito de **outra fatia**; a rodada 2 recebeu do Gate 2 dois
bloqueantes `MEDIO`/`testability` com a **mesma razão estrutural** — *o código documenta longamente uma
guarda e nada a mantém no lugar*, que é a §7 do Protocolo Antirregressão em estado puro; a rodada 3
fechou os dois com rede medida; a 4 tirou dois ponteiros de linha que mentiam.

**Nove mutantes** aplicados e revertidos. Dois merecem registro por terem mudado o desenho:
- **`MT7-8 (a)`/`(b)`** — partir o mutante em dois é o que provou que **duas** metades eram necessárias:
  com a cláusula fora das duas instruções, o caso aborta na metade 4 e **nunca exercita o `DELETE``**.
- **`MT7-9`** — o par `0.29 + 0.07` que o Gate 2 sugeriu nominalmente **não diverge** (é exatamente
  `0.36` em ponto flutuante), e um caso construído sobre ele teria ficado **verde sobre o próprio
  mutante**. O executor mediu, recusou a sugestão e usou pares medidos com controle negativo; os dois
  gates reproduziram a aritmética de forma independente e o Gate 2 registrou por escrito que *"a
  contradição do executor à minha sugestão está certa: eu é que estava errado"*.

**T6 fechada em 2026-08-06, em duas rodadas e sem nenhum bloqueio de gate.** A rodada 1 aprovou nos dois
gates (`APROVADO_COM_OBSERVACOES`, zero bloqueantes); a rodada 2 **adotou três das seis recomendações
não-bloqueantes** e fechou com `APROVADO` limpo nos dois. A suíte foi de **496 para 497 casos** — o
crescimento é de **um** porque a prova nova de `apps/api` entrou como **segunda família de entrada
dentro** do `CT-333 (b)` (+8 asserções, mesma invariante), decisão que os dois gates julgaram
agrupamento correto e não caso escondido, com rastreabilidade própria (`CA-03 → CT-333 (b) (RN-03)`) e
mutante nomeado.

O que a T6 entrega de próprio: as seis rotas de `/v1/imoveis`, a **unicidade do identificador municipal
imposta pelo banco e alcançando os retirados** (restrição TOTAL, sem predicado parcial), e a recusa que
**discrimina** o conflito em `detalhes.conflito` ∈ `{ EM_CIRCULACAO, RETIRADO_DE_CIRCULACAO }`. O achado
técnico da task é o **`tx.savepoint`**: a violação `23505` aborta a transação, então a leitura que
enriquece a mensagem seria impossível na mesma unidade — a escrita corre atrás de um ponto de retorno e
a porta só lê o registro em conflito **depois** do `rollback to`. Os dois gates verificaram
independentemente que isso **não** é leitura-antes-de-gravar e que a `DECISÃO FECHADA` de
`unidade-de-trabalho.ts` não foi tocada; o Gate 2 foi além e mostrou que o `REVERTER EXIGE` dela está
**satisfeito**, não contornado.

**Seis mutantes** foram aplicados e revertidos na task, todos reprovando: MT6-1 (discriminador constante),
MT6-2 (criação sem conferência de alcance), MT6-3 (`PUT` sem conferência do destino), MT6-4 (`savepoint`
removido), e os dois da rodada 2 — **MT6-5** (envoltório de unicidade removido só de `alterarImovel`,
que sobrevivia à suíte inteira) e **MT6-6** (`tx.savepoint(cb)` → `cb(tx)`, que a nova prova de
`packages/db` mata).

**Fase 1 (Fundação) concluída** — as quatro tasks fechadas e staged. O débito **D38** foi fechado: o marcador saiu de `senha.controller.ts`, a linha saiu do índice do `CLAUDE.md`, e a rede que impede a quarta cópia passou a fechar a **classe** (qualquer forma sintática), não só a forma que existia. O índice de débitos com gatilho ficou em **oito** linhas.

A suíte de `@sysloc/contracts` nasceu com **48 casos** (CT-334 a CT-341), a de `@sysloc/db` foi de 40 para **44** (CT-300 a CT-304), a de `@sysloc/shared` de 126 para **190** (CT-314) e a de `@sysloc/api` de 86 para **98** (CT-340 a CT-343); a suíte do repositório passou de **350 para 414 casos**.

**Sobre a contagem de rodadas**, que é atípica e tem explicação: a T1 consumiu 6 e a T2 consumiu 3, mas **apenas uma rodada em todo o run veio de bloqueio de gate** — a rodada 2 da T1, pelo defeito de `metragem` sem teto. Todas as demais foram adoção de recomendações **não-bloqueantes** que a política padrão mandaria anotar como débito. Isso é decisão de coordenação: o usuário autorizou resolver toda pausa pelo recomendado e dispensou o teto de 3 tentativas. O efeito mensurável é que a T2 fechou **sem nenhum débito anotado**, e a T1 com dois.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/`.

> **Fechado na T8 e por isso ausente abaixo:** o **`D7`**, agora **inteiro**. A metade
> `empresaDoContexto` já tinha fechado na T7 (lar único em `packages/db/src/contexto-de-escrita.ts`);
> a metade **`incluirRetirados`** fechou aqui, e o prazo era duro porque a T9 publica os três
> controladores de pessoa e faria nascer as cópias três, quatro e cinco de uma vez. A extensão
> `esquemaDaJanela.extend({ incluirRetirados })` foi **promovida a `@sysloc/contracts`** como
> `esquemaDaJanelaComCirculacao` — a fonte única que a ADR-0016 declara, e o pacote que o frontend
> importa —, e as duas definições locais (`conjunto.controller.ts` e `imovel.controller.ts`) foram
> apagadas: os dois controladores passaram a consumir o símbolo publicado, e o esquema resultante é
> caractere a caractere o mesmo (união fechada `'true' | 'false'`, padrão `'false'`, transformação
> para booleano). **Conferência das duas pontas antes de fechar**:
> `grep -rn "esquemaDaJanela\.extend" apps packages` devolve **uma** ocorrência, a do próprio
> `comum.ts`, e `grep -rn "function empresaDoContexto" packages` devolve **uma**, a de
> `contexto-de-escrita.ts` — não sobrou terceira metade. O débito **não tinha marcador
> `DÉBITO COM GATILHO` no código nem linha no índice do `CLAUDE.md`** (ele nunca sobreviveu a um
> fecho de fatia), então nada a remover de lá. O símbolo novo entrou nas varreduras `CT-336`/`CT-337`
> de `packages/contracts/test/esquemas.spec.ts`, cuja contagem exata subiu de 5 para 6 com
> `SUT_IS_CORRECT_BECAUSE:` — sem isso, um esquema de entrada estaria fora das duas afirmações
> universais que aqueles casos fazem.
>
> **Fechados na T7 e por isso ausentes abaixo — os números não voltam à circulação:**
> o **`D11`** (`comAgregadoDeComodos` com metragem constante), cujo gatilho era o primeiro escritor de
> `negocio.comodo` — a T7 é ele, e as três pontas saíram no mesmo passo: marcador, linha do índice do
> `CLAUDE.md` e bloco desta seção; e o **`D9`** (falha intermitente não nomeada em `apps/api/test/`),
> cujo gatilho declarado era *"a segunda ocorrência, **ou** a primeira que venha nomeada com log
> íntegro"*. **As duas condições se cumpriram na rodada 1 do QA da T7**, e o caso finalmente ganhou
> nome: `CT-001` de `apps/api/test/saude.e2e.spec.ts`, `AssertionError: expected 528.32… to be less
> than 500`. O diagnóstico dirigido estava escrito **no próprio arquivo desde a F0/T5** — o comentário
> das linhas 470-477 já declarava, *medido e não suposto*, que a latência **não discrimina** o
> invariante, e que quem o prova é o sentinela de conexões. A asserção de relógio de parede era custo
> sem benefício, e saiu com `SUT_IS_CORRECT_BECAUSE:` e prova de falsificação: o mutante **`MT-D9`**
> (fazer a rota rasa consultar o banco) reprova o caso **pelo sentinela** (`expected 498 to be +0`) e
> pelo espião do `CT-001 (b)` — nunca pelo tempo. Depois da remoção **nenhuma asserção do arquivo lê
> relógio de parede**, então o que fechou foi a classe, e não o caso. Três execuções integrais em
> `505` casos, idênticas pacote a pacote. **Não** se subiu o teto, **não** se capou concorrência e
> **não** se usou retry — os três estão vedados por escrito.
>
> Os números consumidos não se reciclam. Dois débitos anotados na rodada 1 da T1 foram **corrigidos**
> antes do fecho da task e por isso não aparecem abaixo: o `D1` (contagem duplicada entre CT-336 e
> CT-337, AP-26) e o `D2` (canonização de borda aplicada a três campos e omitida em dois). O `D3`
> permanece aberto — o que a rodada 2 fechou foi a **escrituração** dele, não o débito.

### D3 · BAIXO · project_pattern · T1 · Tech Review
- **Onde:** `packages/contracts/src/comum.ts` (junto de `ESQUEMA_DO_IDENTIFICADOR`, onde vive o marcador) e `apps/api/src/usuarios/usuario.controller.ts` (a outra definição)
- **Problema:** `ESQUEMA_DO_IDENTIFICADOR` tem **duas definições** — a publicada pelo pacote de contratos e a do controlador de usuários, esta sob `DECISÃO FECHADA` da F1. A ADR-0016 declara o esquema fonte única do contrato, e duas definições da mesma canonização são exatamente o que ela existe para impedir.
- **Impacto:** Baixo hoje, porque as duas cópias são idênticas e a do controlador está protegida por marcador — a réplica foi ordenada pela §3 da própria task, e refatorar o controlador nesta fatia seria trabalho fora de escopo. O risco é de divergência futura: duas definições da mesma regra ficam livres para divergir, e é o defeito de classe que o projeto já pagou caro na F1, ali sobre a caixa do UUID.
- **O que fazer:** Na **primeira task que abrir `apps/api/src/usuarios/usuario.controller.ts` por outra razão** — que é o gatilho declarado no marcador —, trocar a cópia local pelo consumo do símbolo publicado por `@sysloc/contracts`. Isso satisfaz o `REVERTER EXIGE` do `DECISÃO FECHADA` daquele arquivo por construção: a canonização muda de arquivo, não deixa de existir. **Prova exigida:** a suíte de `apps/api` segue verde nos casos que exercitam o `:id` em caixa mista, e o marcador `DÉBITO COM GATILHO — D3 · F2/T1` sai de `comum.ts` no mesmo commit, junto com a linha do índice no `CLAUDE.md`.

### D4 · BAIXO · architecture · T1 · Tech Review
- **Onde:** `packages/contracts/src/index.ts`
- **Problema:** O envelope de erro da ADR-0017 fica fora do pacote que a ADR-0016 declara fonte única, e é o pacote que o frontend importa.
- **Impacto:** A ADR-0017 fixa o erro como status HTTP semântico mais `{ codigo, mensagem, campo?, detalhes? }` com `codigo` de enum fechado — parte da forma canônica do contrato, tanto quanto o envelope de lista, que este pacote declara. O envelope de erro vive em `apps/api/src/comum/esquema-de-erro.ts` e em `CodigoErro` de `@sysloc/shared`. A ausência é coerente com o escopo da T1 e com a §4.2 da tech spec, mas o `CLAUDE.md` exige que o `handoff-frontend.md` carregue o envelope de erro, e trazê-lo depois esbarra na propriedade folha: `CodigoErro` mora em `@sysloc/shared`, que arrasta `pino`.
- **O que fazer:** Decidir explicitamente na fatia (tech spec §21 ou task de consolidação do contrato): publicar o esquema do erro e o enum de códigos em `@sysloc/contracts`, com `apps/api` e `@sysloc/shared` derivando dele; ou registrar por escrito que o envelope fica fora e que o handoff o carrega por outro caminho. Não é trabalho da T1 — é a escolha que a T1 tornou visível.

### D5 · BAIXO · code_quality · T4 · Tech Review
- **Onde:** `apps/api/test/campos-fechados.e2e.spec.ts:951`
- **Problema:** O acessório `credencialDeSessao` duplica, no mesmo arquivo, o predicado de extração de cookie que `entrarCom` já executa inline (linhas 1096-1105).
- **Impacto:** Nulo em produção — são 4 linhas duplicadas dentro de uma suíte de teste, e o formato do cookie é fixado pelo arcabouço. O risco é de manutenção: duas escritas do mesmo fato a 140 linhas de distância, livres para divergir se o formato mudar. **O Gate 2 determinou explicitamente que não fosse fechado nesta task**: reescrever `entrarCom`, que é precondição de toda a suíte e não é a causa-raiz da T4, seria o "aproveitar que estou aqui" vedado pela proibição 5 da §4 do Protocolo Antirregressão.
- **O que fazer:** Na próxima task que já abrir `campos-fechados.e2e.spec.ts` por outra razão, fazer `entrarCom` chamar `credencialDeSessao` e levantar quando ela devolver `undefined` — o comportamento observável não muda e a regra de leitura passa a ter um ponto só. É a mesma topologia que a T4 aplicou ao `validar()`.

### D6 · BAIXO · testability · T4 · Tech Review
- **Onde:** `apps/api/src/autenticacao/senha.controller.ts:291`
- **Problema:** A chamada de `validar()` na rota de troca de senha não é exercitada por caso algum pela borda — nem novo, nem preexistente. As recusas 422 que a suíte cobre naquela rota vêm da senha atual incorreta e da política de força, não do esquema.
- **Impacto:** Baixo, e a lacuna é **preexistente** — aquela rota nunca teve caso E2E de recusa de esquema, então a T4 não a piorou. Os dois gates concordaram em não reprovar, com três razões: a equivalência é fechada **por construção** (o CT-343 prova por igualdade de conjunto que existe uma definição e que aquele controlador a importa); o único risco por-ponto-de-chamada numa extração é o argumento ter mudado, e o diff prova isso diretamente; e a função é pura, sem estado por ponto de chamada. Ressalva do Gate 2: `senha.controller.ts` é área de `auth`, e uma recusa 422 de esquema é alcançável pelo cliente ali.
- **O que fazer:** Acrescentar um caso E2E de recusa de esquema à rota de troca de senha. Dono declarado: quem for tocar a superfície de troca de senha. Não é dívida da extração.

### D8 · baixo · documentation · T5 · QA
- **Onde:** `apps/api/src/imoveis/conjunto.controller.ts:222`
- **Problema:** `GET /v1/conjuntos` publica corpo e respostas derivados, mas nenhum dos três parâmetros de consulta (`limite`, `deslocamento`, `incluirRetirados`).
- **Impacto:** `incluirRetirados` é justamente o parâmetro cuja grafia exata importa (união fechada `'true'|'false'`; qualquer outra grafia recusa com `422`), e o cliente não tem como descobri-lo pelo contrato. Não viola a ADR-0016 — que proíbe descrição escrita à mão em paralelo ao esquema, não omissão —, mas deixa o handoff do frontend incompleto no parâmetro menos adivinhável.
- **O que fazer:** Derivar os parâmetros de `esquemaDaJanelaComCirculacao` com `esquemaPublicado(…, 'input')` e emiti-los como `@ApiQuery` a partir das propriedades do JSON Schema resultante — mantém a fonte única e não escreve descrição à mão. **Ponteiro atualizado na T8**: o esquema chamava-se `ESQUEMA_DA_CONSULTA` e era declarado dentro de cada controlador; com o fecho do D7 ele passou a ser `esquemaDaJanelaComCirculacao`, publicado por `@sysloc/contracts`, e as duas rotas de listagem o importam. Isso **facilita** o fecho deste débito: o alvo é um só, e os três controladores de pessoa da T9 herdam a mesma derivação.

### D10 · BAIXO · technical_requirement · T6 · Tech Review
- **Onde:** `apps/api/src/comum/filtro-excecao.ts:150-166` (o emissor genérico) e `apps/api/src/imoveis/imovel.service.ts:225-244` (a tradução que levanta sem registrar)
- **Problema:** A §13.1 do tech_spec declara três eventos que caem na superfície da T6. Dois foram implementados — `Cadastro criado` (info, com `empresaId`, `entidade`, `id`) e `Retirada / recirculação` (info, com `acao`). O terceiro, **`Recusa por unicidade | warn | requestId, empresaId, entidade, campo, conflito`, não tem emissor**: `traduzirConflitoDeIdentificador` apenas levanta o `ErroDeAplicacao`, e a única linha que sai é o `warn` genérico do `FiltroExcecaoGlobal`, cujo evento carrega `codigo`, `status`, `metodo`, `caminho` e `idCorrelacao` — **sem `empresaId` e sem `entidade` em campo nomeado**.
- **Impacto:** Baixo e limitado a operação: a recusa **é** registrada em `warn` com correlação e caminho, então nada some do journal — faltam os campos que permitiriam agrupar por empresa e por entidade. **Nota positiva verificada no diff, e ela importa**: o erro do driver **não** é encadeado na tradução (`new ErroDeIdentificadorMunicipalEmUso(...)` sem `cause`), de modo que o `detail` do Postgres — que carrega o identificador municipal recusado **por extenso** — nunca alcança o registro. A proibição da §13.1 (*"nunca o valor"*) está cumprida, e cumprida **por construção**.
- **O que fazer:** **Não corrigir dentro da T6** — determinação literal do Gate 2. A forma certa é enriquecer o evento do `FiltroExcecaoGlobal` com `campo`/`detalhes` do `ErroDeAplicacao` e com o `empresaId` do contexto, o que é mudança **transversal** em `comum/filtro-excecao.ts` e alcança **também as recusas da T5**, pela mesma lacuna. Dono: a task que fechar a superfície de erro da fatia — a **T11**, que já tem contrato e fechamento no escopo.

### D12 · baixo · documentation · T7 · QA — ✅ **FECHADO na T9 (2026-08-06)**
- **Onde:** era `apps/api/src/imoveis/comodo.controller.ts` (o docblock que declarava), mais `conjunto.controller.ts` e `imovel.controller.ts` (as outras duas cópias)
- **Problema:** `sobContextoDaSessao` estava na **terceira** cópia byte a byte. A **decisão de não extrair na T7 estava correta e o Gate 1 a validou** — é a proibição 5 da §4 do Protocolo Antirregressão, o mesmo raciocínio com que o D7 atribuiu `ESQUEMA_DA_CONSULTA` à T8. O que faltava era a **escrituração**: o débito vivia só no docblock e na §7.2 da task, sem bloco nesta seção, que é a fonte que a `/agent-spec-debt-resolution` consome.
- **Impacto:** Nulo enquanto durou — as três cópias eram idênticas e o método era privado a cada controlador. O risco era a **T9**, que publica os três controladores de pessoa e faria nascer as cópias **quatro, cinco e seis** de uma vez.
- **Como fechou:** a T9 extraiu o método para `apps/api/src/comum/contexto-da-sessao.ts`, no mesmo desenho de `comum/validacao.ts` (D38) e `comum/esquema-de-erro.ts` (D40). Os três controladores de imóvel passaram a importar a função e perderam o método privado, e os três controladores de pessoa **nascem** consumindo o lar único — via `cadastros/superficie-de-cadastro.ts`, que é onde as seis operações dos três papéis são escritas uma vez. A superfície saiu de três cópias para **zero**, com **18** pontos de chamada — conjunto 5, imóvel 5, cômodo 3 e a superfície de cadastro 5.
  > **Correção de escrituração (Gate 2 da T9).** Esta linha dizia *"sete pontos de chamada"*. O Gate 2 refez a contagem por grep e mediu **18**, com o detalhe por arquivo acima; o erro era do **relato do executor**, não do código. Registrado porque a §2 é a fonte que a `/agent-spec-debt-resolution` consome, e um número seis vezes menor **subestima o alcance da extração**.
- **O que a extração mudou de comportamento, declarado:** a mensagem interna da recusa da sessão sem empresa passou de `'rota de cadastro de imóveis alcançada por sessão sem empresa'` para `'rota de cadastro alcançada por sessão sem empresa'`. Nenhum teste a asseria, e a perda é menor do que parece: os **três** métodos removidos levantavam a **mesma** mensagem, isto é, ela já **não distinguia** conjunto de imóvel de cômodo — o que se perde é o adjetivo *"de imóveis"*, num diagnóstico que já era ambíguo entre os três.
  > **Correção de escrituração (Gate 2 da T9), e esta importa mais que a primeira.** Esta linha afirmava que a mensagem *"nunca chega ao cliente (o filtro publica a mensagem canônica do código)"*. **É falso, e o caminho é curto**: `apps/api/src/comum/filtro-excecao.ts`, em `traduzir()`, devolve `excecao.paraCorpo()` para **todo** `ErroDeAplicacao` — **sem** passar por `MENSAGEM_POR_CODIGO` —, e `paraCorpo()` monta `{ codigo, mensagem: this.message }`. A substituição canônica só ocorre no ramo do que **não** é `ErroDeAplicacao`. Portanto a mensagem **sai no corpo do `500`**. O comportamento é **pré-existente** (T5/T6/T7 já lançavam pelo mesmo caminho) e não é regressão da T9; o que a T9 introduziu foi a **afirmação falsa sobre ele**, num docblock que quatro módulos atravessam. O docblock foi corrigido na rodada 2, e o texto novo diz o que é verdade: a mensagem é publicada, e é **por isso** que ela não nomeia sessão, pessoa, empresa nem controlador — enriquecê-la seria publicá-los.
- **Nota de numeração:** o Gate 1 sugeriu reaproveitar o número `D11`, livre desde que a T7 o fechou. **Recusado** — o cabeçalho desta seção declara que *"os números consumidos não se reciclam"*, e reciclar faria dois débitos distintos partilharem identificador no histórico do run.

### D13 · baixo · tests · T7 · QA
- **Onde:** `apps/worker/test/eco.spec.ts:629` e `:725`, alimentadas por `performance.now()` nas linhas 478, 492 e 717
- **Problema:** **A classe do D9 foi fechada no arquivo, não no repositório.** Duas asserções de **relógio de parede** da mesma forma sobrevivem no `@sysloc/worker`: `expect(recusa.decorridoMs).toBeLessThan(LIMITE_DE_ENFILEIRAMENTO_RECUSADO_MS)` e `expect(performance.now() - inicio).toBeLessThan(LIMITE_DE_ENCERRAMENTO_OBSERVADO_MS)`. É o **mesmo mecanismo** que atravessou duas tasks desta fatia sem ser nomeado.
- **Impacto:** Nenhum hoje — o `@sysloc/worker` não reprovou uma vez sequer nas execuções deste run, e ele tem só 16 casos contra os 110 de `@sysloc/api`, o que reduz a exposição à contenção. O risco é o já pago: asserção de tempo reprova sob carga e o diagnóstico se perde, porque a falha **não nomeia o defeito** — ela nomeia a máquina. O código da F0/T6 é anterior ao aprendizado do D9.
- **O que fazer:** Aplicar o mesmo tratamento que fechou o D9, e **na mesma ordem**: para cada uma das duas, perguntar se a asserção **discrimina** o invariante ou se quem o prova é outra asserção do caso; se não discriminar, remover com `SUT_IS_CORRECT_BECAUSE:` e **prova de falsificação** — um mutante que reintroduza o defeito e demonstre que ele continua sendo pego pelas asserções que ficam. **Vedado**, como no D9: subir o teto, usar retry, capar `maxWorkers`/`fileParallelism`. **Gatilho:** a **primeira reprovação por contenção no `@sysloc/worker`**, ou a próxima task que abrir `eco.spec.ts` por outra razão — o que vier primeiro. Levantado pelo Gate 1 na rodada 2 da T7, que explicitamente **não** bloqueou por ele: é dívida alheia à task, e reprovar a T7 por ela seria cobrar do executor um defeito da F0.

### D14 · baixo · code_quality · T9 · QA
- **Onde:** `apps/api/src/cadastros/cadastro-de-pessoa.service.ts` e `apps/api/src/imoveis/imovel.service.ts` (as duas definições)
- **Problema:** `DISCRIMINADOR_DO_CONFLITO = 'conflito'` tem **duas definições**, e as duas nomeiam a **mesma chave de contrato publicado** (`detalhes.conflito`, §10.1 do tech_spec).
- **Impacto:** Contido, e a rede é real — o Gate 1 a conferiu: o `CT-312` e o `CT-310 (b)` afirmam o **corpo inteiro** da recusa por igualdade, cada um no seu arquivo, com a chave literal. Um nome escolhido por conveniência de qualquer dos lados **reprova no próprio arquivo**. O que falta é a extração, não a prova.
- **O que fazer:** Na **primeira task que já abrir `imoveis/imovel.service.ts` por outra razão**, extrair `DISCRIMINADOR_DO_CONFLITO` e o par `EM_CIRCULACAO`/`RETIRADO_DE_CIRCULACAO` para ponto único — o candidato natural é `apps/api/src/comum/`, no mesmo desenho de `validacao.ts` e `esquema-de-erro.ts`. **Não fazer antes**: o diff extra é superfície de regressão fora da causa-raiz.

### D15 · baixo · tests · T9 · QA
- **Onde:** `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`, na tabela de recusas do `CT-332`
- **Problema:** Duas variantes que o card do `CT-332` lista seguem **sem prova em camada alguma**, e as duas são da superfície de **imóvel**: `POST /v1/imoveis` **sem `identificadorMunicipal`** e com **`tipoImovel: 'RURAL'`**. O Gate 1 varreu e mediu: o literal `RURAL` **não existe** em `apps/` nem em `packages/`. A terceira variante que o executor declarou (`statusLocacao: 'ALUGADO'`) **está** coberta, pelo `CT-335` na camada de esquema.
- **Impacto:** Baixo, e o gate explicou por que não é o `AP-16` que o catálogo põe em ALTO: o mecanismo que elas exercitariam é o **mesmo ponto único** que o `CT-332` desta task já prova de ponta a ponta na superfície de **pessoa**, e esse ponto é `comum/validacao.ts`, cuja definição única e lista de importadores o `CT-343` afirma **por igualdade de conjunto**. O conteúdo por campo é a própria declaração do esquema num `strictObject`, de modo que o raio de explosão é **a linha do esquema**, não um ramo de código.
- **O que fazer:** Acrescentar as duas variantes à tabela do `CT-332` de `cadastro-de-imoveis.e2e.spec.ts` — cada uma diferindo do corpo válido por **UMA** alteração, afirmando `422` com `campo` nomeado e a contagem crua inalterada. É trabalho de uma task de limpeza sobre aquele arquivo.

### D16 · BAIXO · code_quality · T9 · Tech Review
- **Onde:** `apps/api/test/validacao.spec.ts`
- **Problema:** O arquivo passou a agrupar por **mecanismo** (varredura estática sobre `apps/api/src`) e não por assunto. Ele hospeda a tradução de recusa de `validar` (CT-340, CT-341, CT-343) **e** o `CT-356`, que não tem relação alguma com validação — afirma a cardinalidade dos importadores de `criarPessoa`/`alterarPessoa`. O nome do arquivo **já não localiza** o `CT-356`.
- **Impacto:** Baixo e de **descoberta**, não de correção — a prova existe, é forte e roda. O custo aparece na leitura futura: quem abrir `validacao.spec.ts` para mexer em `validar` encontra uma invariante de cadastro que não esperava, e quem procurar a rede do compositor não pensa em olhar ali.
- **O que fazer:** **NÃO renomear agora** — determinação explícita do Gate 2, com razão: os CT-340/341/343 estão escriturados com este path na `T4.md`, e o rename cria **deriva de documentação entre tasks** por ganho apenas cosmético. **Gatilho:** a chegada de um **terceiro caso estático de assunto novo** — aí o arquivo deixa de ser exceção e vira padrão, e a escolha passa a ser entre extrair os estáticos para `apps/api/test/invariantes-de-borda.spec.ts` (levando `FONTE_DA_APLICACAO` e os acessórios, hoje compartilhados) ou assumir o agrupamento por mecanismo com um nome que o diga.

### D17 · baixo · tests · T11 · QA
- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:792`
- **Problema:** No `CT-322`, as duas rotas de cômodo (`POST .../comodos` e `PUT .../comodos/:comodoId`) declaram `colecaoDaContagem: CAMINHO_DOS_IMOVEIS` com `crescimentoEsperado: 0`. A asserção "o `422` não gravou linha nenhuma" observa a contagem de **imóveis**, que a gravação de um **cômodo** não moveria — nessas duas rotas ela é incapaz de detectar o defeito que persegue.
- **Impacto:** Baixo e delimitado. O eixo primário do caso (status `422` + envelope inteiro) segue provado nas 12 rotas, e o comentário da linha 790 **já declara a lacuna** e a defere ao `CT-308`. É perda de uma rede secundária em 2 de 12 vetores, não ausência de prova.
- **O que fazer:** dar às duas rotas de cômodo uma contagem que discrimine — um campo opcional `contagemAlternativa?: () => Promise<number>` que leia `GET /v1/imoveis/:id` e devolva `comodos.length`, usado no lugar de `contar(colecaoDaContagem)` quando presente. O corpo da resposta dessas rotas já é o imóvel inteiro com `comodos[]`, então o dado está disponível sem consulta extra.

### D18 · MEDIO · code_quality · T11 · Tech Review
- **Status:** ✅ **RESOLVIDO** em 2026-08-08, por intervenção dirigida fora do pipeline. `cpfValido`/`digitoDeControle` têm definição única em **`apps/api/test/documento.ts`**, com o sequencial entrando por parâmetro (cada suíte mantém o próprio contador). Falsificado por mutação: quebrar o dígito de controle no ponto único reprova **as duas** suítes (3 casos), revertido e conferido por `diff`. ⚠️ **A premissa do `O que fazer` abaixo foi REFUTADA**: o D28 (F0/T5) **não** era condição habilitante — ele trata de importar `packages/shared/test/` **atravessando fronteira de pacote**, e os dois consumidores aqui são irmãos no mesmo diretório, com importação `./documento.ts`. O precedente é `apps/api/test/base32.ts`, cujo cabeçalho registra o mesmo raciocínio. `corpoDePessoa`/`pedir`/`entrar` **seguem duplicados** e continuam válidos como débito — só a regra de domínio (o algoritmo do dígito) foi extraída, que é o discriminador que este próprio bloco nomeia.
- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:815` e `apps/api/test/contrato-publicado.e2e.spec.ts:974`
- **Problema:** `cpfValido()` e `digitoDeControle()` existem em duas cópias byte-a-byte, e o grep confirma que são as **únicas** ocorrências de `function digitoDeControle` no monorepo — as duas cópias não herdaram de um precedente: **nasceram juntas, nesta task**. `corpoDePessoa()` sobe a quatro cópias; `corpoDeImovel()`, `pedir()` e `entrar()` repetem o padrão (`async function pedir(` aparece em 17 arquivos de `apps/api/test`). O agravante que o separa do resto: o gerador de CPF **reimplementa o algoritmo de controle** que `packages/shared/src/documento.ts` (`conferirDocumento`) implementa em produção — é **regra de domínio replicada**, não boilerplate de transporte. Anotado, não bloqueante (categoria `code_quality` é anotável na partição de severidade MÉDIA).
- **Impacto:** Baixo hoje e nomeadamente contido — as duas cópias são **arranjo, não asserção**, e um gerador errado reprova em voz alta (`422` de documento inválido na criação), nunca em silêncio. O risco é divergência futura: duas cópias corrigidas em momentos diferentes produzem suítes que discordam sobre o que é um CPF válido, e a discordância aparece como falha de arranjo, no lugar errado.
- **O que fazer:** **vincular ao D28 (F0/T5), que é a condição habilitante** — enquanto `@sysloc/shared` e `@sysloc/auth` não declararem o subpath `"./test"`, ou enquanto não existir `@sysloc/test-utils`, não há de onde importar, e a extração hoje seria justamente o refactor de manifesto que o D28 declara fora de escopo. Ao fechar o D28, `cpfValido`/`digitoDeControle`/`corpoDePessoa`/`pedir`/`entrar` são a **primeira carga a migrar**. Enquanto isso, um comentário de uma linha em cada cópia nomeando a gêmea evita que uma seja corrigida sozinha. *(Absorve o `BAIXO-002` que o QA registrou sobre o mesmo tema — o Tech Review subiu a severidade pelo discriminador da regra de domínio.)*

### D19 · BAIXO · testability · T11 · Tech Review
- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:282`
- **Problema:** No `CT-327`, o lado esperado é `esquemaPublicado(rota.esquema, 'output')` e o lado observado é o documento OpenAPI, que os seis controladores produziram chamando **a mesma** `esquemaPublicado(...)`. Um defeito **dentro** de `apps/api/src/comum/esquema-publicado.ts` aparece dos dois lados e cancela — e nenhum outro teste do repositório exercita essa função.
- **Impacto:** Estreito, e não anula o caso. O invariante que a **ADR-0016** fixa — *derivado, nunca escrito à mão* — está genuinamente provado, e o par assimétrico `MT11-2` (reprova) / `MT11-3` (verde) é a forma correta de prová-lo. A degeneração grosseira já está fechada pelas linhas 315-320. O que sobra é o caso intermediário: se `esquemaPublicado` deixasse de emitir `properties` preservando `required`, ambos os lados perderiam juntos e o caso seguiria verde — e o `CT-328`, que observa o que a API entrega, não cruza com o documento.
- **O que fazer:** acrescentar ao `CT-327` três ou quatro asserções **literais** sobre uma rota conhecida — por exemplo, que o `properties` de `GET /v1/conjuntos/{id}` contém `id`, `nome` e `retiradoEm`, escritos por extenso. É a mesma técnica de âncora de não-vacuidade que o `CT-328` já aplica (linhas 357-365) e que o `CT-318` aplica ao inventário; custa quatro linhas e fecha a classe.


## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

- **A T6 foi retomada nos gates, e a retomada exigiu um cuidado que vale registrar.** A sessão anterior
  parou com o executor da T6 concluído e nenhum gate rodado. O resume correto era a opção (a) — não
  reexecutar o executor —, mas o `git diff <base_sha>` **mente** neste run: T1–T5 estão *staged sem
  commit*, o `HEAD` não se moveu, e o diff contra a base é cumulativo. O delta real da T6 saiu do
  `git diff --name-only` **não-staged** (worktree vs índice). Os dois gates foram instruídos a usar
  `git diff -- <path>` como diff primário. **Enquanto o usuário não commitar, todo gate deste run
  precisa da mesma instrução** — sem ela, o Tech Review revisa do zero código que já aprovou, e a lista
  de "tocados" do QA mente para a Camada 0.
- **Um número que três agentes independentes conferiram e que continua batendo.** A âncora
  `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` foi para 30 na T6, e a contagem foi refeita **por grep dos
  decoradores de rota**, do zero, pelo QA e pelo Tech Review — nunca derivada de outra âncora. A razão
  está registrada desde a T5 e vale para as tasks seguintes: ela conta **manipuladores**, não pares
  método+caminho, e um `@All('*')` é um manipulador com sete pares. Aqui as duas âncoras cresceram seis
  por acidente da forma destas rotas; derivar uma da outra erraria na próxima superfície com curinga.
- **O Gate 2 corrigiu a atribuição de um arquivo não declarado, e a correção é útil para o resto do run.**
  `deploy/scripts/roadmap/atualizar-roadmap.sh` **não** é produto do gancho `PostToolUse` — o gancho
  *executa* o script, não o edita. A linha alterada troca o mapeamento da F2, e é edição de coordenação
  da fase de spec. Os outros três não-declarados (`roadmap.md`, `domain-glossary.md`, `tasks/T1.md`)
  confirmaram-se como gerado, spec e escrituração.
- **O `D11` é uma referência para a frente, e isso tem um custo que o Gate 2 nomeou.** *(Ele foi
  fechado na T7, em 2026-08-06 — marcador, entrada da §2 e linha do índice do `CLAUDE.md` saíram
  juntos. A nota fica porque a lição de numeração é permanente.)* O marcador no
  código foi escrito reivindicando `D11` **antes** de a §2 ter o `D10`. Fechou certo porque a
  coordenação registrou exatamente um débito (`D10`) antes dele — mas se tivesse registrado dois ou
  nenhum, o número colidiria ou furaria, que é o modo de falha que a §3-B nomeia. **Reserve o número na
  §2 antes de mandar o executor escrever o marcador**, e não depois.
- **Paralelismo da Fase 1 descartado pelo orquestrador.** O `task_plan` derivou `Sim` para T1, T3 e T4 lendo o guard de arquivos de alta contenção como "nenhum arquivo em comum". O pseudocódigo canônico da rule é mais estrito — duas tasks que tocam *qualquer* arquivo de registro saem ambas do lote —, e T1 toca manifesto enquanto T3 toca barrel. Execução caiu para sequencial. Vale reconciliar as duas leituras no gerador ou na rule, porque a divergência vai reaparecer em toda fase com lote declarado.
- **A §5.1 da T1 está desatualizada quanto ao molde do monorepo.** Ela pede `tsup.config.ts`, e a §5.3 chega a citar `packages/auth/tsup.config.ts`, que não existe: os três pacotes irmãos constroem por `tsc --build` e `tsup` não é dependência do repositório, embora conste do §Stack do `CLAUDE.md` como ferramenta prevista. Executor e os dois gates convergiram, cada um com evidência própria, em que criar o arquivo seria configuração morta. Se `tsup` não for adotado até o fim da fatia, vale corrigir a menção no `CLAUDE.md`.
- **⚠️ O QUE T6–T9 HERDAM DO MOLDE DA T5 — sete itens, e o executor de cada uma precisa recebê-los.** A T5 teve o único crítico de segurança do run, e a rede que o fecha é estrutural: **(1)** exigência da **área na CLASSE**, com constante nomeada, nunca literal repetido; **(2)** as duas rotas de circulação declaram `@ExigeChaves(<área da classe>, 'ACAO:excluir_cadastro')`, **nesta ordem, sempre — inclusive nos três controladores de pessoa da T9**, onde a coerência do catálogo tornaria a área aparentemente redundante (é ali que o defeito fica invisível por comportamento, porque a área da classe coincide com a que o mapa associa à ação); **(3)** `@ExigeChave` **no método é proibido** em classe que já declara — substitui, não soma; se precisar exigir algo além, é `@ExigeChaves` com a declaração inteira; **(4)** ao acrescentar rotas sobem **quatro** âncoras em `cobertura-de-autorizacao.e2e.spec.ts` (não três) mais `ROTAS_PROTEGIDAS_ACEITAS` e `IMPORTADORES_ESPERADOS`, cada uma com `SUT_IS_CORRECT_BECAUSE:` — e a quarta, `MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 24`, **não é derivável das outras**: sobe por **manipulador** acrescentado, nunca por par método+caminho (o `@All('*')` é um manipulador para sete pares, e as nove rotas do contrato publicado não têm manipulador — derivá-la do total de rotas erraria por 15); **(5)** o predicado de circulação mora na **porta**, por padrão, com `incluirRetirados` nomeado; a leitura por `:id` **não** tem predicado (senão a recirculação fica inalcançável); a idempotência é da **instrução** (`coalesce`), nunca de um `if`; e o `WHERE` jamais compara empresa; **(6)** unidade de trabalho abre no **controlador**, serviço recebe o `tx`, e `esquemaPublicado`/`validar`/`esquemaDoErro` são **importados** de `comum/`, nunca copiados; **(7)** se alguma rota precisar exigir **menos** que a classe, a saída é **remover a declaração da classe** — nunca contrariá-la no método. A fonte consultável agora é a **ADR-0018** e a §11.2 do `tech_spec.md`, não mais só o docblock.
- **⚠️ Decisão de produto com prazo, herdada da T4 — precisa ser tomada ANTES do congelamento da superfície.** A extração cimentou, para toda a API, que uma chave desconhecida em `strictObject` publica `campo: <campoPadrao>` (tipicamente `'corpo'`) e **nunca o nome da chave que sobrou**. A causa é do Zod v4: `unrecognized_keys` vem com `path: []`, e o nome viaja em `keys`, que `validar()` não lê nem nunca leu. Com as ~33 rotas de corpo estrito que T5–T11 acrescentam, "cliente mandou campo a mais" passa a ser a recusa mais frequente da API — e ela não diz qual campo. Isso entra no `@sysloc/contracts` e no `handoff-frontend.md` no congelamento. A T4 fez o certo em **não** mudar (era extração, e a §3 proíbe), e o valor da extração é exatamente este: hoje a decisão custa a edição de **uma** função; antes dela, seriam três, divergindo em silêncio.
- **Aviso operacional para os gates de T5–T11.** O CT-343 afirma `IMPORTADORES_ESPERADOS` por **igualdade de conjunto**. O primeiro controlador novo que importar `validar()` deixa o caso vermelho, e o conserto é estender a lista esperada. **Isso é legítimo e não é AP-24** — é a mesma convenção que `cobertura-de-autorizacao.e2e.spec.ts:599` já usa com `ROTAS_COM_EXIGENCIA`. A marca de que a edição é legítima: o conjunto de **importadores** cresce enquanto a ponta da **definição** permanece em `['comum/validacao.ts']`. Se a ponta da definição mudar, aí sim é defeito.
- **Dois requisitos que a T3 impõe à T8/T9, levantados pelo QA e que precisam chegar ao executor daquelas tasks.** Nenhum é débito — são condições para que o que a T3 entregou não seja desfeito adiante. **(a)** `conferirDocumento` recusa espaço em volta do valor, por decisão correta desta camada (espaço é caractere não numérico, e a invariante do CT-314 o exige). Se o esquema Zod da borda **não** aplicar `.trim()` antes de delegar a conferência, um documento legítimo colado do clipboard recebe 422 — que é literalmente o modo de falha que o próprio `documento.ts` declara ser "o mais caro dos quatro": falso-negativo em documento válido, que recusa cadastro e não deixa rastro de erro. A T8/T9 precisa do `.trim()` e de um caso de teste com valor cercado de espaço. **(b)** A conferência deve ser delegada a `conferirDocumento` por `refine`/`superRefine`, **nunca reimplementada dentro do esquema** — uma segunda implementação do módulo 11 divergiria em silêncio, e o CT-313 deixaria de provar a mesma regra que o CT-314 prova.
- **Erro de spec corrigido na T3, e a razão de não o deixar como débito.** A §5.2 da `T3.md` e a linha 186 do `tech_spec.md` afirmavam que `packages/shared/test/superficie-publica.spec.ts` compara a superfície do pacote por igualdade de conjunto. Não compara — afirma por **presença**, com a razão escrita no arquivo desde a F0 ("acrescentar export é retrocompatível"), e ela não reprovou ao publicar os dois símbolos novos. O executor diagnosticou, recusou-se a converter a asserção (seria desfazer decisão documentada — R3) e o QA confirmou pelo `git diff`. A spec foi corrigida na mesma rodada porque, como o QA registrou, deixá-la errada arma a mesma armadilha para a próxima task que publicar símbolo naquele pacote.
- **Nota do Tech Review para T5–T11, sem achado associado:** `esquemaDaJanela` é `strictObject` e declara só `limite` e `deslocamento`, mas a §4.1 da tech spec documenta `incluirRetirados` e `expandir=imoveis` nas listagens. O caminho certo é cada rota compor por `esquemaDaJanela.extend({...})`, e **não** acrescentar os dois parâmetros à janela compartilhada — o que os faria passar em rotas que não os suportam. O CT-336 varre os esquemas de entrada exportados e aprovaria uma janela alargada sem alarme.

- **A T11 custou uma rodada de correção, e o que a disparou merece leitura.** O QA reprovou o `CT-326`
  por uma asserção que **não podia falhar**: o laço `for (const linha of varredura.linhas)
  expect(linha).toMatch(ABERTURA_DE_UNIDADE)` comparava cada linha com **o mesmo predicado que a havia
  selecionado** — `varrerArquivos` só empurra a linha para `linhas` dentro do `if (casa(linha))`. Pior
  que a asserção oca era o comentário acima dela, que lhe **atribuía um eixo positivo** que quem de fato
  fechava era a linha anterior. É o modo de falha que a `testing-stack.md` chama de *"provou-se o que era
  fácil provar"*, e ele passou pelo executor e por dois mutantes antes de o gate pegá-lo.
- **A correção mostrou por que a posição da asserção importa, e não só o seu conteúdo.** O executor
  trocou o predicado por um independente (`DECLARACAO_DE_UNIDADE`) **e moveu o eixo positivo para antes**
  de `auditarAberturas`. A razão não é estética: atrás da igualdade de conjunto, o piso
  `toBeGreaterThanOrEqual` é **implicado** por `ausentes: []` e vira infalível naquela posição; e um
  afrouxamento do predicado poria o próprio `packages/db/src/unidade-de-trabalho.ts` em `excedentes`,
  fazendo o caso reprovar **acusando o arquivo errado**. À frente, a mesma mutação reprova nomeando a
  linha e o predicado, que é a causa real.
- **O executor contradisse a forma sugerida pelo gate, com razão.** O QA ofereceu como alternativa
  `arquivosDe(varredura.ocorrencias) toEqual ABRIDORES_LEGITIMOS`; o executor demonstrou que ela é
  *logicamente idêntica* a `auditarAberturas(...) toEqual {excedentes: [], ausentes: []}` — listas
  ordenadas e deduplicadas, e igualdade de conjunto nos dois sentidos é igualdade de array ordenado —,
  logo não reprovaria por caminho nenhum que a auditoria já não cobrisse. **É a segunda vez neste run**
  que o executor recusa uma sugestão de gate por medição própria e está certo; a primeira foi o par de
  ponto flutuante da T7.
- **Uma economia deliberada que vale como método.** As duas primeiras invocações do QA da T11 morreram
  por limite de API sem emitir veredito, queimando ~265k tokens cada. A terceira concluiu porque o
  orquestrador **mediu a suíte antes** (`pnpm test`, exit 0, 541 casos) e a entregou apurada, com o log
  íntegro em disco para o gate auditar por `grep` em vez de reexecutar. A rodada 2, já em `DELTA`,
  custou 137k. **Medir por fora e entregar apurado é mais barato que mandar o gate descobrir.**
- **Três arquivos modificados não pertencem a nenhuma task, e foram staged mesmo assim**:
  `deploy/scripts/roadmap/atualizar-roadmap.sh` (mapa de fatias da F2),
  `docs/plano-backend-novo/roadmap.md` (gerado pelo gancho `PostToolUse`) e
  `docs/specs/domain-glossary.md` (artefato da fase de especificação). O Tech Review os identificou e
  confirmou que nenhum é código. Ficaram no stage porque o painel do roadmap é **gerado** pelo
  script — deixar o par fora produziria um diff pendente perpétuo, e o glossário é artefato da
  especificação desta mesma fatia. **O commit segue sendo decisão do usuário**: o pipeline nunca
  commita.
