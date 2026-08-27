# Relatório do Run — webhook-e-carne/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **12/12 tasks concluídas** · suíte **1710 casos** verdes nos 9 pacotes (contracts 398 · api 349 · shared 249 · db 225 · documentos 158 · worker 122 · auth 89 · cobranca-bancaria 90 · regua 30) · **CT-1005** da frente shell verde (4 frentes, 115 asserções)

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Terceira emenda à ADR-0024 | opus | 0 criados, 5 mod | — (sem gates) | — (sem gates) |
| T4 | Domínio puro da notícia | opus | 2 criados, 3 mod | ✅ APROVADO (rodada 2) | — (gates=[qa]) |
| T2 | Migração 0019 e o renome do D14 | opus | 4 criados, 28 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO_COM_OBSERVACOES |
| T5 | Porta de mesclagem e adaptador `pdf-lib` | opus | 3 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Migração 0020 e o módulo de acesso ao cru | opus | 4 criados, 8 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO (rodada 2) |
| T6 | A rota pública da notícia (âncora 100/85) | opus | 5 criados, 17 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 4) | ✅ APROVADO_COM_OBSERVACOES (rodada 3) |
| T7 | A tarefa da notícia (da carga ao desfecho) | opus | 2 criados, 11 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T8 | Idempotência, expurgo dos 90 dias e a prova de que nada vaza | opus | 0 criados, 3 mod | ✅ APROVADO (rodada 1) | ✅ APROVADO_COM_OBSERVACOES (rodada 1) |
| T9 | Retenção por suspensão e retomada na reativação | opus | 1 criado, 12 mod | ✅ APROVADO (rodada 5) | ✅ APROVADO (rodada 2) |
| T10 | O carnê — contrato do recorte, `CarneService`, rota e entrega (âncora 101/86) | opus | 3 criados, 13 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T11 | A borda externa — vhost, instalador idempotente e verificador por medição | opus | 3 criados, 4 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T12 | Fecho — vocabulário canônico, o D38 e a reconciliação do índice | opus | 0 criados, 7 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 1) | — (gates=[qa]) |

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/webhook-e-carne/v1/`.
>
> ⚠️ **Renumerados na rodada 2 da T2.** O QA da rodada 1 anotou oito (D1–D8) e o executor **fechou quatro na própria correção**: a casa compartilhada de `diferencasDeConjunto` com as duas cópias convertidas (era D3), o docblock de `@sysloc/contracts` (D4), a tabela de INVARIANTES de `evento-bancario.spec.ts` (D5) e a contagem da suíte no `CLAUDE.md` (D6). Restam os quatro abaixo.

### D1 · medio · code_quality · T2 · QA
- **Onde:** `packages/db/test/catalogo-de-plataforma.spec.ts:546`
- **Problema:** AP-26 — `CT-994 (c)` é duplicata semântica da variante (a) do `CT-813`, no mesmo arquivo.
- **Impacto:** a tupla `(nome, alvo, parâmetros, resultado)` coincide nos **quatro** campos: os dois criam `plataforma.residuo_com_empresa` pela mesma `executarPrivilegiado`, chamam `conferirAdmissaoDePlataforma` e afirmam o mesmo objeto. A justificativa escrita no `(c)` era verdadeira **antes** desta task e deixou de ser **dentro** dela — o mesmo diff atualizou o `examinadasEsperadas` da variante (a) para o que o `(c)` dizia acrescentar. Custo: uma subida/derrubada de tabela a mais por execução, sem ganho de discriminação.
- **O que fazer:** remover o sub-caso `CT-994 (c)` e anotar no docblock do `CT-813` que a variante (a) passou a cobrar também a ordem normativa sobre roster povoado; ou, se o ID precisar existir por rastreabilidade, apontá-lo para a variante (a) em vez de reexecutá-la. **Exige a linha `SUT_IS_CORRECT_BECAUSE:`** — é remoção de caso, e a contagem de `@sysloc/db` cai de 221 para 220.

### D2 · medio · code_quality · T2 · QA
- **Onde:** `packages/db/test/catalogo-de-plataforma.spec.ts:429`
- **Problema:** AP-26 — `CT-994 (a)` é duplicata semântica do `CT-812`, no mesmo arquivo.
- **Impacto:** os dois chamam `conferirAdmissaoDePlataforma` sobre o mesmo banco íntegro e afirmam o mesmo resultado. A parte de roster também não acrescenta poder: o `CT-812` já afirma `expect(ROSTER_DE_PLATAFORMA).toEqual([TABELA_ADMITIDA])`, e `toEqual` sobre array é igualdade exata em conteúdo, ordem **e** comprimento — estritamente mais forte que o par `length === 1` + `diferencasDeConjunto` que o `(a)` usa. A redundância veio do card da §6.6 da task, que prescreveu a forma de conjunto sem notar que o `CT-812` já a subsumia.
- **O que fazer:** fundir — mover para o `CT-812` as duas asserções que o `(a)` tem de próprio (o literal qualificado de `ROSTER_DE_PLATAFORMA[0]` e o controle antivácuo) e remover o sub-caso; ou inverter, deixando o `(a)` como caso único do roster e reduzindo o `CT-812` ao que ele tem de exclusivo (o congelamento por `Object.isFrozen`). Mesma ressalva do D1 quanto à contagem.

### D3 · baixo · documentation · T2 · QA
- **Onde:** `deploy/scripts/instalacao/verificar-migracao.sh:214`
- **Problema:** o cabeçalho ainda declara que o roster de tabelas de `plataforma` é vazio.
- **Impacto:** o bloco afirma *"O roster de TABELAS daquele schema é vazio nesta fatia, e o vazio é o conteúdo (ADR-0031)"*, e esta task o povoou com `plataforma.notificacao_bancaria`. A asserção executável **não** quebra — a guarda de cobertura examina `negocio` —, então é estritamente prosa vencida; mas é a prosa que o próximo autor lê para decidir se acrescenta algo à lista.
- **O que fazer:** reescrever dizendo que o roster passou a ter uma tabela na fatia `webhook-e-carne` e que ela continua fora desta lista pela razão já escrita: a guarda examina `${SCHEMA_NEGOCIO}`, e o que vive em `plataforma` é conferido por `conferirAdmissaoDePlataforma`.

### D4 · baixo · documentation · T2 · QA
- **Onde:** `apps/api/src/cobrancas/boleto.service.ts:1149` (mais 6 pontos: `boleto.service.ts:100,559,644` e `cobranca.service.ts:355,362,369`)
- **Problema:** sete comentários seguem nomeando a coluna pelo nome antigo.
- **Impacto:** citam `nosso_numero` como nome de coluna de `negocio.cobranca` — inclusive um que cita literalmente *"o `WHERE nosso_numero IS NULL` de `gravarBoletoDaCobranca`"*, trecho que esta task renomeou. Nenhum é código executável (medido: zero ocorrência de `nosso_numero` em SQL executável fora da `0009` histórica e da própria `0019`), e os arquivos estão fora do escopo declarado — por isso baixo, e por isso não é achado de escopo.
- **O que fazer:** substituição textual nos sete pontos, em passada dirigida, sem tocar em código executável.

### D5 · BAIXO · project_pattern · T2 · Tech Review
- **Onde:** `packages/db/migracoes/0019_dominio_webhook_e_carne.sql:158` (e o cabeçalho, linhas 78-83)
- **Problema:** a convivência **gerado × autoral** na `0019` está registrada só em prosa — falta o marcador `DÉBITO COM GATILHO`, a linha no índice do `CLAUDE.md` e a entrada nesta §2.
- **Impacto:** o **mérito está resolvido e o Tech Review o endossou** — a rede (`CT-510 (e)`) é executável e discriminante, a alternativa do tech spec foi refutada por medição, e não existe correção que não crie dependência com a T3. O que se perde é a **memória** de que a instrução é autoral e de quando ela deve sair: a T3 abre a `0020` para escrever a segurança da fatia e não tem nada que a avise de que existe uma instrução esperando abrigo. Agravante medido: o cabeçalho declara a regeração deste arquivo como **esperada e recorrente**, e o detector executável do projeto (`naturezasMisturadas`) **não alcança este caso** — é aplicado só à `0017`/`0018` por nome, e seus padrões (`CREATE POLICY`, `FORCE ROW LEVEL SECURITY`) não casam um `RENAME COLUMN`.
- **O que fazer:** ⚠️ **dono designado: a T3**, e a janela é real — a `0019` ainda **não** foi aplicada a banco durável, então o `sha256sum` do `migrar-banco.sh` ainda não a congelou; o precedente do `D20 · F3/T7` (que hoje não pode mais sair) mostra o custo de perder essa janela. Duas saídas, ambas sem dependência entre tasks: **(a)** mover o `ALTER TABLE … RENAME COLUMN` da visão para a `0020` autoral, deixando a `0019` puramente gerada — o `CT-510 (e)` segue sendo a rede nos dois casos, sem alteração; **(b)** manter onde está e escriturar: marcador `DÉBITO COM GATILHO — D5 · F4/T2` junto da instrução, com `QUANDO FECHA: a próxima migração autoral desta fatia`, mais a linha no bloco do `CLAUDE.md` (que passa de 28 para 29). A **(a)** é a preferida, porque fecha em vez de agendar.

### D6 · BAIXO · project_pattern · T2 · Tech Review
- **Onde:** `CLAUDE.md:320`
- **Problema:** o índice de débitos ficou divergente do marcador — a linha do **D13 (F4/T6, fatia `emissao-e-conciliacao`)** ainda nomeia `nosso_numero`, coluna que esta task extinguiu.
- **Impacto:** o marcador vivo correspondente, em `packages/db/src/boleto-da-cobranca.ts:331-343`, **foi** corretamente atualizado por este mesmo diff para `numero_do_titulo_no_provedor`; o índice não acompanhou. É a única ocorrência de `nosso_numero` que restou no `CLAUDE.md`, e ela nomeia coluna que deixou de existir. O agente que ler a linha procurará a coluna no banco e não achará — exatamente a fricção que o bloco existe para eliminar.
- **O que fazer:** trocar `restrição pareando \`linha_digitavel\` com \`nosso_numero\`` por `restrição pareando \`linha_digitavel\` com \`numero_do_titulo_no_provedor\``, alinhando com o texto que o marcador já traz. A linha continua dentro do teto de ~150 caracteres. Dono natural: a **T12**, que já reconcilia o índice no fecho da fatia.

### D7 · BAIXO · adr_compliance · T2 · Tech Review
- **Onde:** `docs/adr/0009-*.md` (a `Decision`)
- **Problema:** a `Decision` da **ADR-0009** — *"As tabelas ficam em **dois schemas**: identidade… e negócio…"* — tornou-se literalmente falsa nesta task, e não há emenda registrada nela.
- **Impacto:** até aqui a frase era verdadeira: `plataforma` existe desde a `0016` mas guardava só uma sequência e duas funções, **nenhuma tabela**. A `0019` cria a primeira. **Não é violação de mérito**: a ADR-0031 é posterior, `accepted`, autoriza expressamente, nomeia a 0009 na `Context` e declara nos `Prós` que *"o predicado da ADR-0009 continua verdadeiro sem exceção"* — e o predicado verificável (nenhuma tabela de **negócio** sem RLS forçada) segue intacto. O vão é de **registro**: quem cita a 0009 abrindo a `Decision`, que é o que o `CLAUDE.md` manda fazer, lê contradição com o invariante de multi-tenancy e pode "corrigir" a tabela de volta para `negocio` — literalmente a alternativa que a `Context` da 0031 rejeita por escrito. É risco de **R3**, e este repositório já pagou **quatro vezes** por esse mesmo vão (ADRs 0001, 0017, 0021, 0024).
- **O que fazer:** emenda na ADR-0009 no molde das existentes, com o texto original preservado byte a byte, declarando que o *"dois"* era exaustivo na data em que foi escrito, que a ADR-0031 institui depois o terceiro schema, que o sujeito da 0009 é a fronteira **identidade × negócio** e que o predicado dela continua verdadeiro sem exceção — mais a linha da 0009 no `INDEX.md` com o marcador de emenda. Encerrar com *"não 'corrija' tabela de `plataforma` para `negocio`"*.

### D8 · baixo · documentation · T5 · QA — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19, e por um caminho melhor que o pedido. O `D5 · F3/T7` que este débito mandava marcar como vencido **já havia sido fechado** pela T10: `extrairTextoDePdf` desceu para `apps/api/test/documento.ts` e o marcador saiu. O que restava era a duplicação em si, e a medição achou o dano **real**: as três cópias já haviam divergido no **comportamento**, não só na forma — as duas de `packages/documentos/test/` faziam cópia defensiva do buffer, e a de `apps/api` passava `data: bytes` direto; como o extrator **assume a posse** e transfere o buffer, o arranjo do chamador ficava com `byteLength: 0`, e o que salvava aquela suíte era só a **ordem das linhas** (`textoInicialDe(bytes)` corre antes da extração). Pago em três movimentos: (1) nasceu `packages/documentos/test/pdf.ts`, a casa comum do diretório, com `extrairPaginasDePdf` e `extrairTextoDeArquivoPdf` sobre um núcleo único; (2) as duas suítes do pacote passaram a importá-la (−116 linhas duplicadas); (3) o endurecimento foi **propagado** à terceira cópia. Rede: **`CT-1002 (h)`** — extrair duas vezes os mesmos bytes devolve o mesmo resultado e o `byteLength` não vai a zero. Discrimina por construção: com `data: bytes`, a segunda chamada levanta `DOMException`. `@sysloc/documentos` 158 → **159 verdes**; `@sysloc/api` **349 verdes**.
- **Onde:** `apps/api/test/documento-do-contrato.e2e.spec.ts:487` (o marcador do **D5 · F3/T7**)
- **Problema:** o gatilho do débito `D5 · F3/T7` **venceu nesta task** e não foi escriturado.
- **Impacto:** o marcador declara que fecha com *"o terceiro consumidor de extração de texto de PDF (o carnê da F4)"*, e a suíte da T5 é esse terceiro consumidor — `extrairPaginasDePdf` repete o miolo `getDocument` + percurso de `TextItem` que já existe em `documento-do-contrato.e2e.spec.ts:521` e em `packages/documentos/test/renderizador-pdf.spec.ts:131`. O executor **declarou** a pendência, mas o campo `QUANDO FECHA` segue descrevendo um gatilho já ocorrido e a linha do índice não registra o vencimento. Mesma classe do `D38 · F4/T10`, cujo gatilho já está declarado **VENCIDO** no índice.
- **O que fazer:** marcar o D5 como `⚠️ GATILHO VENCIDO` na linha do `CLAUDE.md`, no molde já usado pelo D38, nomeando a **T10** como dona natural do fecho; e acrescentar a terceira cópia (`packages/documentos/test/mesclador-pdf.spec.ts`, `extrairPaginasDePdf`) ao campo `O QUÊ` do marcador. **Não fechar o débito aqui** — a promoção de `extrairTextoDePdf` para casa comum é da T10 por atribuição da §5.3.

### D9 · baixo · tests · T5 · QA · `smell: vague_existence_assertion`
- **Onde:** `packages/documentos/test/mesclador-pdf.spec.ts:279`
- **Problema:** a varredura estática do `CT-1002 (g)` não alcança `import` por **subcaminho profundo** da biblioteca.
- **Impacto:** o predicado exige a aspa de fechamento imediatamente após o nome do módulo. O QA **testou-o por execução** contra dez formas e confirmou que ele casa as seis realistas — import estático, `import type`, import de efeito colateral, `import()` dinâmico, `require()`, `export * from` e a forma quebrada em várias linhas — e corretamente não casa prosa. O resíduo é `import { PDFDocument } from 'pdf-lib/cjs/api/PDFDocument'`, que **não** casa; e `pdf-lib@1.17.1` não declara campo `exports` (só `main`/`module`/`types`), de modo que o subcaminho profundo é resolvível por Node e por TypeScript. Um segundo arquivo que se ligasse por essa forma passaria pela igualdade de conjunto. **Contido estruturalmente pelo isolamento do pnpm** — só `@sysloc/documentos` declara `pdf-lib` no manifesto, então nenhum outro pacote sequer resolve o módulo. A asserção **não** é infalível: tem controle positivo, controle negativo, piso antivácuo de 200 fontes, igualdade de conjunto, e reprovou de fato na prova de falsificação.
- **O que fazer:** alargar o padrão para admitir subcaminho mantendo a recusa de escopo transitivo — `(?:from|import|require)\s*\(?\s*['"`]pdf-lib(?:/[^'"`]*)?['"`]` — e acrescentar ao bloco de controles do `(g)` um terceiro positivo (`import { X } from '${MODULO_DA_BIBLIOTECA}/cjs/api';` → `true`), mantendo o negativo de `@pdf-lib/...`, que hoje já não casa e deve continuar não casando.

### D10 · BAIXO · project_pattern · T5 · Tech Review
- **Onde:** `packages/documentos/src/index.ts:90-92`
- **Problema:** dois símbolos novos no barril de `@sysloc/documentos` **sem âncora de superfície** que fixe o conjunto publicado.
- **Impacto:** nenhuma asserção do repositório fixa por igualdade de conjunto o que esse barril publica — o `CT-1002 (g)` ancora o caminho do **adaptador**, não o barril; o único `superficie-publica.spec.ts` do monorepo é de `packages/shared`, e o único inventário análogo é o `vocabulario-canonico.spec.ts` de `packages/cobranca-bancaria`. A lacuna é **preexistente** e a causa está a montante do executor: a §5.2 da T5 não declara arquivo-âncora, e ele a seguiu com fidelidade — mas o barril foi de fato alargado aqui, o que traz a lacuna para dentro do escopo revisado. Hoje o compilador pega a **retirada** acidental de um símbolo; nada reprova o **crescimento** silencioso, que é a direção que a rule existe para pegar e a que morde — retirar depois o que se publicou sem querer é mudança incompatível, exatamente o que o docblock do próprio barril declara três vezes como razão de listar símbolo a símbolo. O pacote é consumido por `apps/api`, `apps/worker` e `packages/db`.
- **O que fazer:** **não** corrigir dentro da T5 — criar a âncora do pacote inteiro é escopo maior que o declarado. Fechar na **T10**, que é a próxima a tocar a superfície deste pacote: um caso em `packages/documentos/test/` que leia o texto de `src/index.ts`, extraia os símbolos exportados e afirme `expect(observados.sort()).toEqual(DECLARADOS)` com controle antivácuo, no molde de `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`. Merece marcador `DÉBITO COM GATILHO` no cabeçalho do barril, com `QUANDO FECHA: a próxima task que publicar símbolo neste barril`.

### D11 · medio · tests · T3 · QA · `smell: brittle_selector`
- **Onde:** `packages/db/test/isolamento-bancario.spec.ts:519`
- **Problema:** a âncora seleciona a política da cobrança **por posição**, e a `0020` acrescentou a segunda política à mesma tabela.
- **Impacto:** `politicas.find((p) => p.tabela === TABELA_ANCORA)` devolve a **primeira** linha cuja tabela é `cobranca`, sobre um resultado `ORDER BY tablename, policyname`. Até esta task havia uma política só e a seleção era determinada; agora ela só continua apontando para `cobranca_isolamento_empresa` porque `isolamento` **ordena antes** de `roteamento` no alfabeto. A corretude passou a depender de **acidente lexicográfico**: uma política futura chamada, por exemplo, `cobranca_auditoria` viraria a âncora, e as comparações do laço passariam a medir a expressão errada. **Não bloqueia** porque o modo de falha é vermelho ruidoso, não verde silencioso — e o executor **declarou** a fragilidade em vez de escondê-la.
- **O que fazer:** selecionar pelo **nome**: `politicas.find((p) => p.nome === 'cobranca_isolamento_empresa')`. É a única forma de a âncora sobreviver a uma terceira política. A guarda antivácuo existente continua cobrindo a âncora ausente.

### D12 · medio · tests · T3 · QA · `smell: brittle_selector`
- **Onde:** `packages/db/test/coerencia-de-migracoes.spec.ts:998`
- **Problema:** a mesma âncora posicional, no mesmo molde e com o mesmo `TABELA_ANCORA = 'cobranca'`.
- **Impacto:** repetição literal do D11. **As duas cópias são a razão de o achado vir em dois itens**: endurecer uma deixa a outra para trás, que é o Limiar de Três do `CLAUDE.md` em ação.
- **O que fazer:** mesma correção do D11 — selecionar por `nome`. **Corrigir as duas no mesmo diff**; corrigir só uma reinstala a divergência que o Limiar de Três descreve.

### D13 · BAIXO · project_pattern · T6 · Tech Spec §21.4 — ✅ **RESOLVIDO** pela T8 da fatia `automacoes-agendadas` (2026-08-23)

> **Débito COM GATILHO, nascido nesta task por prescrição do tech spec** (§21.4, tabela *"nascem
> nesta fatia"*). Não é achado de gate: é dívida declarada antes da execução, e o marcador
> correspondente vive no código.

- **Onde:** `apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts`, junto do `catch` do
  método `enfileirar` (marcador `DÉBITO COM GATILHO — D13 · F4/T6`), mais a linha do índice do
  `CLAUDE.md`.
- **Problema:** notícia que fica em `RECEBIDO` porque o enfileiramento falhou **não tem quem a
  reprocesse**.
- **Impacto:** o cru **está gravado** e é alcançável — nada se perde, e é essa a razão de a falha de
  fila ser absorvida em vez de propagada (§5.2 (b) do tech spec: propagar `5xx` faria o provedor
  reenviar, provocando a reentrega que a idempotência existe para absorver). O que falta é o
  **avanço**: a única varredura de pendências do produto é a da reativação de empresa suspensa
  (`listarRetidas`), e ela enxerga apenas `desfecho = 'RETIDO'`. Uma notícia em `RECEBIDO` só volta a
  andar por intervenção manual, e ela é expurgada aos 90 dias como qualquer outro cru (RN-11) — de
  modo que a janela de recuperação é finita. A rede de produto que sobra é a **conferência diária**
  da fatia (ii), que descobre a liquidação por outro caminho: o que se perde é a *origem* na trilha,
  não o recebimento.
- **O que fazer:** na **F5**, que traz o agendamento por temporizador do sistema, acrescentar ao
  varredor periódico a leitura das notícias em `RECEBIDO` mais antigas que um limite nomeado, e
  reenfileirá-las pelo **mesmo** caminho de `enfileirarNotificacaoBancaria` — o tratamento já é
  idempotente pelas três camadas da §9.2, então a reentrega é segura por construção. **Não** criar um
  varredor próprio aqui: seria um segundo mecanismo de agendamento sem consumidor medido, e ele
  teria de ser desfeito quando o primeiro chegasse.
- **✅ Fechado em 2026-08-23**, pela **T8** da fatia `automacoes-agendadas`, exatamente como este bloco
  prescrevia. O gatilho literal — *"a **F5**, que traz o agendamento"* — disparou. O que fechou:
  - `listarNaoTratadas(tx, folgaEmMinutos)`, em `packages/db/src/notificacao-bancaria.ts` — as
    notícias com `desfecho = 'RECEBIDO'` e `recebido_em` mais antigo que a folga, com o corte saindo
    de `now()` **do banco** (ADR-0026);
  - a rotina `RETOMADA_DE_NOTICIAS` do despachante efêmero (`apps/worker/src/despachante.ts`), que
    reenfileira cada uma pela **mesma** `FILA_DA_NOTIFICACAO_BANCARIA` que a borda HTTP alimenta, com
    carga `{ notificacaoId }` — **sem campo de empresa**, porque na entrada de fato de terceiro a
    empresa é o *resultado* da travessia nominal (ADR-0035 + emenda de 2026-08-18 da ADR-0024);
  - a cadência é `A_CADA_10_MIN` (`CADENCIA_DA_ROTINA`), e a folga é de **uma cadência inteira** — a
    notícia que acabou de chegar está sendo tratada agora, e retomá-la produziria duas passagens
    concorrentes sobre o mesmo cru.
  - **Nenhum varredor próprio nasceu no serviço de recepção**, como este bloco pedia: o `catch` que
    absorve a falha do enfileiramento permanece **intacto**, e o docblock dele passou a apontar para
    a rotina que faz o avanço.
  - **Rede**: `CT-1079` (`apps/worker/test/despachante.spec.ts`) semeia **5** notícias cruzando
    desfecho e idade e afirma, por igualdade de conjunto, que exatamente as **2** `RECEBIDO` vencidas
    são reenfileiradas, com `Object.keys(carga)` igual a `['notificacaoId']`.
  - O marcador saiu do código e a linha saiu do índice do `CLAUDE.md`, **no mesmo commit** (§3-B).

### D14 · BAIXO · project_pattern · T6 · Tech Review (rodada 2, P3)

> **Resíduo do D63 · F4/fechamento.** O débito antigo foi **fechado corretamente** — a casa
> compartilhada existe (`apps/api/test/acessorios-de-borda.ts`), é importada pelas suítes novas, o
> marcador saiu do código e a linha saiu do `CLAUDE.md`. O que sobreviveu foi o **risco que ele
> nomeava**, e é ele que esta entrada reinscreve. Sem marcador no código, de propósito: não há um
> ponto único onde a tentação aconteça, e a §3-B é literal — sem marcador vivo, **não** entra linha
> no índice do `CLAUDE.md`.

- **Onde:** `apps/api/test/` — as ~30 suítes de borda que ainda declaram o próprio `pedir`/`entrar`
  em vez de importar `./acessorios-de-borda.ts`. A conta se refaz numa linha:
  `grep -rln "async function pedir" apps/api/test/`.
- **Problema:** o `O QUÊ` do marcador do D63 era *"endurecer um deles deixa as outras cópias para
  trás, em silêncio"*, e esse risco é **idêntico ao de ontem** para as cópias remanescentes. A
  medição da T6 encontrou `pedir` em **30** arquivos (o marcador dizia 24), e as cópias **já
  divergiram em 11 formas distintas** — cabeçalho `origin`, tratamento de `set-cookie`, decisão de
  desserializar o corpo, suporte a corpo bruto, entre outras.
- **Impacto:** BAIXO e de manutenção, não de produto. Nenhuma prova está errada hoje; o que não
  existe é a garantia de que endurecer o acessório compartilhado alcance as suítes que não o
  importam — exatamente o modo de falha que o `CLAUDE.md` descreve em *"acessório de suíte se
  importa, não se copia"* (quem duplica copia de **uma** vizinha, para ele é sempre a segunda cópia,
  e o Limiar de Três nunca dispara).
- **O que fazer:** **não** converter as ~30 suítes em bloco — a §3.e do tech spec proíbe, e um diff
  dessa largura é superfície de regressão de graça sobre provas que estão verdes. O gatilho é o que o
  `CLAUDE.md` já pratica: **a próxima task autorizada a abrir cada suíte converte a dela**, trocando
  a declaração local pela importação de `./acessorios-de-borda.ts` e acrescentando à casa comum o que
  faltar (nunca o contrário). Quando a contagem do `grep` acima chegar a zero, esta entrada sai.

### D15 · MEDIO · project_pattern · T6 · Tech Review (rodada 3, P1)
- **Onde:** `apps/api/src/notificacoes-bancarias/notificacao-bancaria.controller.ts:121` (⚠️ **`@ApiOperation.description` — o documento OpenAPI publicado**), mais `:42`, `apps/api/test/notificacao-bancaria.e2e.spec.ts:38` e `:760`, `docs/specs/features/webhook-e-carne/v1/tech_spec.md:498`, e `tasks/T6.md:279` e `:378`
- **Problema:** a correção do teto de corpo **criou um segundo `4xx`** na rota (o `413`), e a afirmação *"o único `4xx` desta rota é `422`"* sobreviveu em **sete** pontos.
- **Impacto:** dois danos, ambos moderados. **(a)** O documento OpenAPI — artefato do handoff para o React, e a superfície que a ADR-0011/0017 fazem valer — **afirma ao consumidor que o `413` não existe**. **(b)** A T7 ou a T10 abrem a suíte, leem *"é o único `4xx` desta rota"* e concluem que o `413` do `CT-020 (e)` é defeito, ou o removem por coerência. **Não há dano de comportamento** — o código está correto e o `CT-020 (e)` prova o envelope canônico. É a **mesma classe** do achado que o próprio Tech Review abriu na rodada 2 (*"a única rota de negócio sem sessão"*), e que o executor corrigiu **bem** em quatro lugares nesta mesma rodada: ele viu a forma da falsificação num eixo e não a viu no eixo que a própria correção dele abriu.
- **O que fazer:** emendar os sete pontos para nomear **dois** `4xx` de transporte, ambos anteriores ao manipulador e ambos sem gravar nada — `422` para corpo que não é JSON, `413` para corpo acima de `MAIOR_CORPO_ACEITO`. No `@ApiOperation.description` a emenda é **obrigatória** (é contrato publicado); nos demais basta trocar *"o único"* por *"os dois"*. ⚠️ **Não** declarar `@ApiPayloadTooLargeResponse`: o Tech Review julgou que o `413` **não** pertence à declaração do manipulador, porque desde a T6 ele é propriedade da **composição raiz** e alcança as cem rotas — declará-lo em uma só criaria a assimetria enganosa de sugerir que as outras 99 não o produzem.

### D16 · baixo · tests · T6 · QA (rodada 3) · `smell: test_order_dependency`
- **Onde:** `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:590` (o `CT-934`)
- **Problema:** o caso reprova de forma **intermitente** — `expected [ 'GET /v1/cobrancas/:codigo/boleto' ] to deeply equal []`, a leitura de sucesso do boleto devolvendo status ≥ 300.
- **Impacto:** reprovou **uma** vez em cinco execuções ao longo das rodadas 3 e 4, e passou nas demais. **Não é regressão desta task**: é um `GET` sem corpo, que o teto de 64 KiB não alcança, e o arquivo está **fora do delta**. A hipótese medida do QA é recurso compartilhado entre suítes concorrentes — o diretório da guarda de boletos é resolvido a partir da composição raiz e o nome do arquivo deriva do **código da cobrança**, que suítes com bancos efêmeros distintos podem repetir; a mesma suíte revoga o boleto logo depois de lê-lo.
- **O que fazer:** isolar o diretório-base da guarda de boletos **por suíte** (um `mkdtemp` por arquivo de teste, entregue à composição raiz da aplicação montada), de modo que duas suítes concorrentes não disputem o mesmo nome derivado do código da cobrança. Dono: a fatia que abrir aquela suíte por outra razão.

### D17 · BAIXO · project_pattern · T7 · Tech Spec §21.3 (2)

> **Débito com gatilho** — marcador em `apps/worker/src/tarefas/notificacao-bancaria.ts`, junto de
> `conferirNumeroDoTitulo`, e linha no índice do `CLAUDE.md`. Ele **agenda** a segunda metade de uma
> regra que só pôde ser cumprida pela metade; ele não protege nada, e editar o código sob ele é
> normal.

- **Onde:** `apps/worker/src/tarefas/notificacao-bancaria.ts`, na função `conferirNumeroDoTitulo`.
- **Problema:** a RN-05 e a CA-08 mandam conferir, contra o gravado, *"o número do título no provedor
  **e o identificador do cliente**"*. Só a primeira metade existe: o produto **não modela a
  identidade da empresa perante o provedor** — identificador da aplicação, endereço de autorização e
  dados da conta (o número do cliente entre eles) —, e portanto **não há valor gravado contra o qual
  comparar** a segunda. É medição, não previsão: o **D36 · F4/T10** a fez em 2026-08-15 e a reafirmou
  em 2026-08-17.
- **Impacto:** médio-baixo, e limitado a um cenário estreito. A conferência que existe já barra o
  aviso cujo número do título não bate com o gravado, e o roteamento é feito por chave **que o
  próprio produto emitiu** e que é única no SaaS inteiro (ADR-0033) — de modo que a notícia de outra
  conta do provedor não alcança cobrança nossa por acidente. O que fica sem rede é o caso em que o
  provedor devolvesse, para um identificador nosso, o título de **outro cliente da mesma
  instituição**, com o número do título coincidindo: hipótese que nenhuma medição observou e que a
  unicidade global do identificador torna improvável.
- **O que fazer:** quando o produto modelar a identidade da empresa perante o provedor — **o mesmo
  gatilho do D36 · F4/T10** —, acrescentar a segunda comparação ao lado da primeira, na mesma função,
  e o caso que a exercita ao lado do `CT-975`. **Não** antecipá-la: trazê-la agora exige campo novo em
  `esquemaDoCertificadoNovo`, isto é, **superfície publicada**, às vésperas do congelamento da API —
  o que o próprio D36 mede como pior que adiar.

### D18 · BAIXO · project_pattern · T7 · Tech Review (rodada 1, TR-P2) — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19, que é a *"primeira task autorizada a abrir aquele arquivo"* que este débito aguardava. O `QUANDO FECHA` do marcador do **D34** em `packages/cobranca-bancaria/src/emissao-em-lote.ts` foi **emendado**, com o texto original preservado byte a byte: a primeira metade do gatilho (*"a fatia que trouxer a notícia recebida do provedor (a (iii))"*) está declarada **VENCIDA e REFUTADA por medição** — a notícia dá observabilidade, não reconciliação —, e o gatilho vigente é o que sobra: *"a fatia que persistir o identificador enviado ANTES da chamada ao provedor, ou a que ampliar o modelo canônico para perguntar por ele"*. A linha do D34 no índice do `CLAUDE.md` acompanhou. O **D34 segue aberto** na sua própria fatia, como este débito sempre disse — o que se pagou aqui foi a escrituração.

> **Escrituração de gatilho vencido — não é débito novo desta fatia.** O débito é o **D34 · F4/T11**,
> da fatia `emissao-e-conciliacao`, e ele **continua aberto lá**. O que esta entrada registra é que o
> gatilho dele **chegou** aqui e **não pôde ser cumprido**, mais o que a medição encontrou. O
> marcador de origem **não foi editado** (`packages/cobranca-bancaria/src/emissao-em-lote.ts` está
> fora da §5.2 da T7); o que mudou foi a linha do índice do `CLAUDE.md`, que passou a trazer a marca
> `⚠️ GATILHO VENCIDO`, no molde literal do **D38 · F4/T10**.

- **Onde:** `packages/cobranca-bancaria/src/emissao-em-lote.ts`, junto de `guarda.gravar` (marcador
  do D34), e a linha do D34 no índice do `CLAUDE.md`.
- **Problema:** o `QUANDO FECHA` do D34 diz *"a fatia que trouxer a notícia recebida do provedor (a
  (iii))"* — e esta **é** a (iii). O gatilho venceu na T7, e a escrituração não o registrava: `grep
  D34` neste relatório não devolvia nada, e o índice do `CLAUDE.md` seguia anunciando um gatilho já
  chegado como se fosse futuro.
- **Impacto:** de **registro**, não de risco. Índice que anuncia como futuro um gatilho já chegado
  ensina a próxima fatia a não procurá-lo, que é a mesma mentira do marcador órfão na direção
  contrária. O defeito que o D34 descreve — o título órfão sem chave de correlação — **não** mudou de
  tamanho com esta fatia.
- **O que foi medido:** o gatilho **venceu, e mesmo assim o débito não fecha aqui**, por duas razões
  independentes. (i) A notícia recebida dá ao órfão **observabilidade**, e não **reconciliação**: a
  T7 grava `identificador_perante_o_provedor` na linha crua em todo desfecho, inclusive
  `SEM_CORRESPONDENCIA` (é o que o `CT-974` afirma, por igualdade de lista contra os cinco
  identificadores forjados), de modo que o órfão deixa de ser invisível — mas continua sem caminho
  para virar cobrança conciliada, porque a notícia do provedor só chega para título que o provedor
  conhece, e o órfão é justamente aquele cujo `identificadorNoProvedor` nunca foi persistido.
  (ii) Fechá-lo exige o que o próprio marcador enumera — migração sobre `negocio.cobranca` depois da
  `0017`, alteração do predicado de `selecionarCobrancasAConferir` (T5 da (ii), fechada) e operação
  nova na porta —, e a terceira **contraria a emenda de 2026-08-17 da ADR-0001**, que fixa a porta em
  quatro operações.
- **O que fazer:** **emendar o `QUANDO FECHA` do D34**, não fechá-lo. A redação recomendada troca *"a
  fatia que trouxer a notícia recebida do provedor (a (iii))"* pelo gatilho que a medição desta fatia
  mostrou ser o verdadeiro: *"a fatia que persistir o identificador enviado **antes** da chamada ao
  provedor, ou a que ampliar o modelo canônico para perguntar por ele"* — as duas metades que sobram
  do gatilho original. A emenda toca `packages/cobranca-bancaria/src/emissao-em-lote.ts`, que está
  **fora da §5.2 da T7**, e por isso não foi feita aqui: ela pertence à primeira task autorizada a
  abrir aquele arquivo. É o corolário que o `CLAUDE.md` já registra — *a frase que explica por que
  algo não pode ser feito envelhece mais rápido que o débito que ela justifica*.

### D19 · BAIXO · code_quality · T7 · Tech Review (rodada 2, P1)
- **Onde:** `packages/cobranca-bancaria/src/emissao-em-lote.ts:46`
- **Problema:** a linha de comentário corrigida ficou com **118 colunas**, sem reflow.
- **Impacto:** a troca de `nosso_numero IS NULL` por `numero_do_titulo_no_provedor IS NULL` foi feita por substituição no lugar, sem reencaixar o parágrafo — a linha destoa das quatro vizinhas do mesmo bloco (98/101/102 colunas). O `biome.json` declara `formatter.lineWidth: 100`, e **o Biome não reflui comentário**, de modo que `pnpm lint` segue verde e nada acusa. Cosmético e local: não altera comportamento, não altera o predicado descrito e não toca o marcador do `D34`.
- **O que fazer:** reencaixar as linhas 44-49 do docblock a ~100 colunas — basta quebrar `), e é dele, e de mais nada,` para a linha seguinte. Uma edição, sem efeito em código. ⚠️ O Tech Review registrou que **o lugar certo dessa correção era o diff da T2**, que fez o renome.

### D20 · BAIXO · project_pattern · T8 · Tech Review (rodada 1, P1)
- **Onde:** `apps/worker/src/tarefas/notificacao-bancaria.ts:877`
- **Problema:** `motivoDaFalhaAcessoria` — e a constante `MOTIVO_NAO_IDENTIFICADO` que ela devolve — nasce como **segunda** declaração no repositório, com corpo idêntico linha a linha à primeira, privada de `apps/api/src/cobrancas/boleto.service.ts:406`. O executor **viu e registrou** a duplicação, mas **em prosa**, no docblock, e não na forma greppável `DÉBITO COM GATILHO` que a §3-B da `.claude/rules/nao-regressao.md` fixa.
- **Impacto:** baixo e diferido, e a decisão de **não** subir para casa comum está correta — o Limiar de Três só paga a promoção no terceiro consumidor, e a primeira cópia vive em `apps/api`, fora da lista de arquivos desta task. O que se perde é o **alcance do registro**: a prosa não é encontrada pelo `grep -rl "DÉBITO COM GATILHO" apps packages deploy` que o ciclo de vida do índice usa, nem pela arqueologia do P2 do Protocolo Antirregressão. O terceiro consumidor — que por definição chega por um terceiro arquivo — não tem como contar as cópias. É exatamente o modo de falha que a nota *"Acessório de suíte se importa, não se copia"* do `CLAUDE.md` descreve: *"para ele é a segunda cópia, nunca a enésima, e o gatilho nunca dispara"*.
- **O que fazer:** escrituração apenas — **nenhuma linha de código muda, e a função não sobe de pacote**. (1) Converter o parágrafo final do docblock no marcador canônico `DÉBITO COM GATILHO — D20 · F4/T8 · registrado 2026-08-19`, com `O QUÊ` (as duas cópias e a divergência que ameaçam: endurecer a redação de um lado deixa o outro para trás, e a divergência sai como linha de journal que redige num processo o que publica no outro — ADR-0032), `QUANDO FECHA` (o **terceiro** consumidor, ou a primeira alteração do que a função publica), `POR QUE NÃO AGORA` (o Limiar de Três só paga no terceiro, e a casa comum obrigaria a abrir `boleto.service.ts`, fora da lista desta task) e `ÍNDICE` apontando para esta §2. (2) Acrescentar a linha correspondente ao bloco "Débitos com gatilho ativo" do `CLAUDE.md`, dentro do limite de ~150 caracteres. (3) Conferir depois as **duas pontas** do §3-B. ⚠️ A ordem importa: a linha do `CLAUDE.md` só entra **junto** com o marcador — índice sem marcador vivo deixa `packages/shared/test/protocolo-antirregressao.spec.ts` vermelho.

### D21 · BAIXO · project_pattern · T9 · executor (Limiar de Três)
- **Onde:** `apps/api/test/retomada-de-retidas.spec.ts` (junto de `semearCobranca`)
- **Problema:** o arranjo *"cobrança com boleto vivo + certificado vigente da empresa"* passou a ter **três** cópias no repositório: `apps/worker/test/notificacao-bancaria.spec.ts` (`semearCobrancaSemCertificado` + `garantirCertificadoVigente`), `apps/api/test/notificacao-bancaria.e2e.spec.ts` (`semearCobrancaComBoleto`) e esta, criada pela T9. O **Limiar de Três** do `CLAUDE.md` disparou no ato — e ele disparou *nesta* cópia justamente pelo modo de falha que a nota *"Acessório de suíte se importa, não se copia"* descreve: quem escreve a suíte nova copia de **uma** vizinha, e para ele é sempre a segunda cópia.
- **Impacto:** baixo e contido a `test/`. Nenhuma delas é código de produção, e as três montam o mesmo estado por portas de produção. O que se perde é o que o Limiar protege: endurecer uma (acrescentar coluna ao boleto, mudar a validade do certificado, trocar a natureza da cobrança) deixa as outras duas para trás, e a divergência só aparece quando um caso reprova por arranjo — longe da causa. As três já **divergem** de fato: a do worker devolve o par em claro do certificado (o `CT-990` precisa dele), a da API não registra certificado algum, e esta memoiza o registro por empresa porque o índice `certificado_do_provedor_vigente_uidx` admite um vigente por empresa.
- **O que fazer:** subir o arranjo para casa compartilhada em **`packages/db/test/`** — o único diretório que `apps/api/test/` e `apps/worker/test/` já alcançam os dois (é de lá que vem `banco-efemero.ts`). A casa nova publica a semeadura completa parametrizada pelo que hoje diverge (devolver ou não o par em claro; registrar ou não o certificado), e as três suítes passam a importá-la. **Gatilho:** a primeira task autorizada a abrir as duas suítes irmãs por outra razão. **Não agora:** subir o arranjo obrigaria a reescrever duas suítes de fronteira real fora da lista da T9, com ~180 casos verdes dependendo delas.
- **⚠️ Destino corrigido por medição em 2026-08-23** (T11 da fatia `automacoes-agendadas`; o marcador no código foi emendado no mesmo diff, com o texto original preservado byte a byte): **`packages/db/test/` NÃO serve como casa do arranjo**. Os acessórios de lá alcançam `contextoDeTenant` pelo **fonte** (`unidade-sob-contexto.ts` → `../src/contexto.ts`), enquanto `apps/*/test/` o alcançam pela fronteira publicada de `@sysloc/db`, que o `package.json` manda para `./dist/index.js` — são **dois `AsyncLocalStorage` distintos**, e como o arranjo é necessariamente sob contexto, toda escrita dele cairia em violação de política de linha. O destino viável é um pacote de teste que consuma `@sysloc/db` **pelo barril**; `packages/shared/test/` também não serve, porque `@sysloc/shared` não pode depender de `@sysloc/db` sem inverter o grafo. **O gatilho não muda.** É o corolário do `CLAUDE.md` outra vez: *a frase que explica onde algo deve ser feito envelhece antes do débito que ela justifica.*

### D22 · baixo · error_handling · T9 · QA (rodada 4) · ✅ **FECHADO na intervenção dirigida de 2026-08-22**

> **Como fechou:** exatamente a forma que o bloco prescrevia — o `map` das esperas passou a
> registrar o assentamento no ponto em que ele acontece (`assentadas.add(fila.name)` **depois**
> do `await`, para que a espera que rejeita continue contando como não assentada), e o alerta
> publica `filas` filtrado pelos pendentes mais o campo `pendentes` com a contagem. Sob marcador
> `DECISÃO FECHADA`, cujo argumento é estrutural: `pendentes` é derivado da MESMA lista `filas`
> que o fecho percorre, sem lista paralela que possa divergir.
>
> **Rede (P4):** o `CT-1007` ganhou a asserção de `pendentes` — campo que o alerta anterior
> **não publicava**, de modo que um retorno a `filas.map(…)` o deixa `undefined` e reprova — e a
> coerência entre a contagem e a lista. ⚠️ **Ressalva declarada no caso e aqui:** ele **não**
> prova a filtragem em assentamento PARCIAL. O arranjo derruba o servidor antes de qualquer
> conexão — é o que o torna determinístico — e nele nenhuma fila assenta, de modo que o conjunto
> filtrado coincide com o completo. Assentamento parcial exigiria injetar fila por fila, que é
> símbolo *test-only* na produção (Iron Law #6). `apps/api` segue em **374**.
- **Onde:** `apps/api/src/comum/produtor-de-fila.ts:504`
- **Problema:** o alerta do prazo abandonado nomeia **todas** as filas, e não as que não assentaram.
- **Impacto:** a linha publica `{ limiteMs, filas: filas.map((fila) => fila.name) }` — a lista completa das quatro filas, idêntica em todo estouro. Ela responde *"quantas filas existem"*, não *"quantas ficaram para trás e qual"*. O comentário acima dela declara que a linha existe porque **uma garantia foi ABANDONADA**, e o operador que a ler num desligamento real não distingue "as quatro estavam pendentes" de "uma só travou". Não bloqueia: a linha não é ruído (o campo `limiteMs` e a mensagem já dizem o essencial) e o caminho é patológico por construção.
- **O que fazer:** instrumentar o `map` das esperas (`filas.map(async (fila) => { await fila.waitUntilReady(); assentadas.add(fila.name); })`) e publicar `filas: filas.filter((f) => !assentadas.has(f.name)).map((f) => f.name)` mais `pendentes: <contagem>`. O CT-1007 acompanha sem alteração: no cenário dele nenhuma assenta, e a igualdade com as quatro filas continua valendo.

### D23 · MEDIO · project_pattern · T10 · Tech Review (rodada 2, P2)
- **Onde:** `apps/api/src/contratos/contrato.controller.ts:673`
- **Problema:** terceira cópia inline da declaração de corpo binário do OpenAPI — o Limiar de Três disparou e nada subiu para casa comum.
- **Impacto:** o literal `content: { [<mídia>]: { schema: { type: 'string', format: 'binary' } } }` existe agora em três pontos de produção (`contrato.controller.ts:544` documento, `cobranca.controller.ts:731` boleto e `contrato.controller.ts:673` carnê), cada um com um texto de justificativa próprio ao redor. Sem risco funcional nem de segurança — o alcance é o documento OpenAPI publicado —, mas no dia em que a forma da declaração binária mudar, três pontos precisam mudar juntos e o que ficar para trás mente no contrato que o frontend consome. ⚠️ **Não é violação da ADR-0028**: a cláusula da prova está cumprida (o `CT-1004` reprova nomeando a rota ausente, com falsificação registrada). O que se cobra é a convenção do `CLAUDE.md`.
- **O que fazer:** extrair para ponto único — ex. `apps/api/src/comum/resposta-em-bytes.ts` exportando `conteudoBinario(midia: string)` —, movendo para lá o bloco `⚠️ format: 'binary' NÃO é declaração de forma`, e passar as três rotas a consumi-lo. `CT-1004` e `CT-921` já provam a presença de cada rota no documento publicado, logo a extração é coberta pela suíte existente. **Alternativa legítima**, se não se quiser tocar rota de outra fatia no mesmo diff: registrar `DÉBITO COM GATILHO` no ponto, com `QUANDO FECHA` = *"a quarta rota que devolver bytes, ou a primeira alteração da forma da declaração binária"*.

### D24 · BAIXO · scope_deviation · T10 · Tech Review (rodada 2, P1)
- **Onde:** `docs/specs/features/webhook-e-carne/v1/tasks/T10.md` §5.2 (e §5.3)
- **Problema:** cinco arquivos tocados fora da §5.1/§5.2, e um pacote inteiro (`@sysloc/db`) fora do blast radius declarado — que diz *"`@sysloc/api` inteiro, mais `@sysloc/contracts`"*. Agravante de forma: `packages/db/src/cobranca.ts` está listado na **§5.3 (Referência)**, isto é, a task o classificou como arquivo a *consultar*, e ele foi *modificado*.
- **Impacto:** ⚠️ **O defeito é da DECLARAÇÃO, não da implementação** — o Tech Review revisou os cinco individualmente e mediu que **nenhum é desvio de julgamento do executor**: (a) filtrar/ordenar o recorte fora do banco contradiz a `Decision` da ADR-0023, logo o SQL tinha de nascer em `packages/db`; (b) o barril e as duas âncoras de igualdade ficariam **vermelhos** se não subissem no mesmo diff, que é o que a `ancoras-de-superficie.md` manda; (c) redeclarar um cliente HTTP de bytes na suíte nova violaria o *"acessório de suíte se importa, não se copia"*. O risco que a subdeclaração cria é de outra ordem: escopo de validação que omite um pacote pode deixar regressão daquele pacote sem suíte medida numa task futura em que a omissão não seja percebida.
- **O que fazer:** mover `packages/db/src/cobranca.ts` da §5.3 para a §5.2 e acrescentar `packages/db/src/index.ts`, `packages/db/test/unidade-de-trabalho.spec.ts`, `apps/api/test/contexto.e2e.spec.ts` e `apps/api/test/acessorios-de-borda.ts`, com o escopo de validação passando a `@sysloc/api` + `@sysloc/contracts` + `@sysloc/db`. **Nenhuma linha de código precisa mudar.**

### D25 · BAIXO · code_quality · T10 · Tech Review (rodada 2, P3)
- **Onde:** `apps/api/src/contratos/contrato.controller.ts:645`
- **Problema:** o teto de 12 competências vira literal em prosa na descrição do `@ApiOperation`, ao lado de `LARGURA_MAXIMA_DO_RECORTE`.
- **Impacto:** `packages/contracts/src/carne.ts` declara a constante e a publica pelo barril justamente porque *"o cliente precisa dela"*, e a mensagem do `refine` já a interpola em vez de escrever o número. Se o teto mudar, o esquema, a mensagem de recusa e o cliente acompanham; a descrição publicada no OpenAPI, não — e ela é o texto que o consumidor do contrato lê para saber o limite **antes** de pedir.
- **O que fazer:** importar `LARGURA_MAXIMA_DO_RECORTE` de `@sysloc/contracts` no controlador e trocar o `**12**` da descrição pela interpolação da constante.

### D26 · BAIXO · code_quality · T10 · Tech Review (rodada 2, P4)
- **Onde:** `apps/api/src/contratos/contrato.controller.ts:188`
- **Problema:** o mesmo diff carrega duas contagens incompatíveis dos manipuladores do `ContratoController` — a emenda diz *"a **oitava** rota desta superfície"*, e `cobertura-de-autorizacao.e2e.spec.ts:2635`, escrito na mesma task, diz *"passou de **nove** para **dez** manipuladores"*.
- **Impacto:** a contagem do teste é a **medida** e está certa (6 de cadastro + 2 transições + 2 de circulação = 10). A do docblock continua uma sequência que **já estava defasada antes da T10** — a linha 175 chama a rota do documento de *"a sétima"*. A T10 não introduziu o erro, mas **propagou-o num texto novo em vez de medi-lo**. Classe que este repositório já pagou caro: o `CLAUDE.md` carrega hoje três avisos *"não 'corrija' para N"* nascidos de contagem em prosa que envelheceu, e a próxima passada que ler *"oitava"* vai escrever a nona com aparência de continuidade.
- **O que fazer:** trocar *"a **oitava** rota desta superfície"* por *"o **décimo** manipulador desta superfície"*, ou acrescentar linha registrando que a sequência *"sétima/oitava"* do parágrafo original não é contagem de manipuladores e que a medida é a do `CT-355` (86 no total, 10 neste controlador). ⚠️ **Não alterar o parágrafo original preservado pela emenda.**

### D27 · BAIXO · security · T11 · executor (débito declarado pela spec, §3.e da task) — ✅ **RESOLVIDO** pela T10 da fatia `publicacao-e-backup` (2026-08-26)
- **Onde:** `deploy/nginx/sysloc-notificacao-bancaria.conf` (cabeçalho)
- **Problema:** o vhost publica um caminho para fora — a primeira superfície externa do produto — e **não há limitador de abuso nele**: nem por taxa, nem por endereço de origem. Quem descobrir o hostname pode gravar linhas em `plataforma.notificacao_bancaria`.
- **Impacto:** contido e medido. O custo por notícia forjada é **uma escrita pequena** no cru mais uma tarefa de fila, e **zero** consultas ao provedor — a RN-06 (`SEM_CORRESPONDENCIA`) descarta o órfão antes de qualquer chamada, e nenhum caminho de escrita nasce do recebido (RN-04). O que sobra é volume de disco no cru, que o expurgo de 90 dias (CA-12) já colhe. O teto de corpo da borda é 64 KiB, espelhado de `MAIOR_CORPO_ACEITO`, de modo que nem o tamanho da escrita é livre.
- **Por que não agora:** um limitador por endereço de origem faria uma **rajada legítima do provedor** ser descartada, e perder notícia é exatamente o dano que esta fatia existe para não ter. Além disso não há eixo: o vhost fala direto com a API, e o endereço que chegaria a um limitador é o do próprio provedor, indistinguível entre notícia legítima e reenvio.
- **O que fazer:** ao publicar a API inteira na F7, instalar o limitador no servidor de borda com a **origem já confiável** (é a mesma condição que os D23, D24 e D27 da F1 esperam), com teto dimensionado pelo volume real medido — a §16.5 do tech spec projeta uma notícia por pagamento ocorrido, não por cobrança em aberto. **Gatilho:** a publicação da API inteira na F7.
- **Prova exigida ao fechar:** medição de rede contra a borda, mostrando (a) que a rajada legítima do provedor atravessa inteira e (b) que a origem forjada é recusada — no molde do `CT-1005 (c)`, que já mede por rede.
- ✅ **Fecho (2026-08-26, T10 da fatia `publicacao-e-backup`):** o vhost passou a declarar `limit_conn_zone $binary_remote_addr zone=notificacao_bancaria:1m` e `limit_conn notificacao_bancaria 16` no `location` da notícia, e **continua sem teto de taxa**. O marcador saiu do gabarito, a linha saiu do índice do `CLAUDE.md` e a menção literal saiu de `deploy/scripts/borda/prompt-de-ativacao-do-webhook.md`. Rede permanente: `CT-1191` a `CT-1194`, em `deploy/scripts/borda/verificar-notificacao-bancaria.sh` — a bateria foi de 4 para 8 frentes e de 148 para 182 asserções, com três execuções idênticas.
- ⚠️ **A metade (b) da prova exigida acima FOI SUPERADA, e a divergência é declarada e medida.** Ela pressupunha um limitador **por origem forjada**, e a **ADR-0037** (2026-08-25, posterior a este registro) decide o contrário: nesta rota o teto por origem é **ausente por decisão**, porque o eixo de origem do provedor é um endereço só e o mesmo teto que barra o abuso descarta a rajada legítima. Provar (b) exigiria instalar exatamente o que a ADR rejeita nominalmente. O que a substitui são três frentes que a ADR nomeia: o teto de **corpo** no byte exato (`CT-1192`), o teto de **concorrência** por origem, com o par simultâneo/sequencial (`CT-1194`), e a **ausência executável** do teto de taxa (`CT-1193`, com prova de falsificação nos dois mutantes). O expurgo do cru não reconhecido, terceira frente da ADR, já tinha rede no `CT-1087 (f)`. É o precedente registrado no `CLAUDE.md`: *a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica*.

### D28 · MEDIO · project_pattern · T11 · Tech Review (rodada 2, P1)
- **Onde:** `deploy/scripts/borda/verificar-notificacao-bancaria.sh:203-241`
- **Problema:** a frente shell de verificação (`caso`/`ok`/`falhar`/`afirmar_igual`/`afirmar_diferente`/`aviso`/`nota`/`fechar_caso`) é redeclarada pela **décima** vez, e as cópias **já divergiram**.
- **Impacto:** medido — `grep -rln '^afirmar_igual() {' deploy/scripts/` devolve **10 arquivos**; `aviso()` escreve em stderr em duas cópias e não escreve em três outras; `nota()` imprime formato diferente em duas famílias. A cópia da T11 é **a melhor delas** (única que conta a degradação em `avisos_totais` e a reporta no resumo), e é exatamente esse o sintoma: endurecer uma cópia deixa as outras nove para trás. O `avisos_totais` — que impede "medição parcial lida como aprovação completa" — não alcança as outras nove baterias. A convenção violada (*Limiar de Três* + *acessório de suíte se importa, não se copia*) está escrita no `CLAUDE.md`; estamos na décima.
- **O que fazer:** extrair para casa comum de shell, no molde do que `apps/api/test/acessorios-de-borda.ts` fez para as suítes Vitest — ex. `deploy/scripts/comum/frente-de-verificacao.sh`, carregada por `source` —, migrando as baterias por **conversão dirigida**. ⚠️ **Não é correção desta task**: ela seguiu o molde que a §3.c dela prescreve e que **nove precedentes** estabeleceram; refatorar aqui violaria o *menor delta possível*.

### D29 · BAIXO · security · T11 · Tech Review (rodada 2, P2) — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19, pelo caminho que o próprio débito indicou **e mais um degrau**. `subir_borda_efemera` passa agora `127.0.0.1:${PORTA_HTTPS}` e `127.0.0.1:${PORTA_HTTP}` a `renderizar_vhost`, de modo que o rendido traz `listen 127.0.0.1:<porta> ssl;` e o nginx deixa de ligar `0.0.0.0`. **Nada muda no gabarito versionado nem na borda de produção** — lá se continua passando `"443"` e `"80"`, sem endereço. O degrau a mais é a **guarda de sanidade**, e ela é do ARQUIVO RENDIDO, não da chamada: igualdade entre as diretivas `listen` em laço local e o total de `listen`, com **controle antivácuo** (vhost sem `listen` nenhum falha nomeando o vácuo, em vez de passar por "não escuta fora do laço"). É o que faz qualquer forma futura de montar a borda que volte a omitir o endereço reprovar — não só esta linha. `bash -n` limpo; `shellcheck -S warning` sem achado novo (os 7 `SC2034` são pré-existentes, nas linhas 638-644).
- **Onde:** `deploy/scripts/borda/verificar-notificacao-bancaria.sh` (`subir_borda_efemera`, ~linha 745)
- **Problema:** a borda efêmera do CT-1005 (c) escuta em **todas as interfaces**, enquanto o docblock declara isolamento. O gabarito recebe só o número da porta, produz `listen <porta> ssl;` sem endereço, e o nginx liga `0.0.0.0`.
- **Impacto:** baixo e transitório — durante os segundos da bateria a borda responde `404` em tudo e `204` no caminho da notícia, **sem dado nenhum atrás** (a trilha vive num `mktemp -d` 0700). O dano concreto é de **determinismo, não de vazamento**: uma requisição de fora no caminho exato incrementaria a trilha e faria a asserção de fecho reprovar — **falso negativo, nunca falso positivo**. Ainda assim, bateria que a ADR-0006 obriga a rodar isolada não deveria abrir superfície de rede num host onde `/opt/frappe` opera.
- **O que fazer:** passar `127.0.0.1:${PORTA_HTTPS}` e `127.0.0.1:${PORTA_HTTP}` como valor dos marcadores na chamada de `renderizar_vhost` dentro de `subir_borda_efemera` — `listen 127.0.0.1:36011 ssl;` é sintaxe válida, o `--resolve` já aponta para 127.0.0.1, e **nada muda no gabarito versionado nem na produção**. Complementarmente, estender a guarda de sanidade para afirmar que o vhost efêmero só declara `listen` em endereço de laço local.

### D30 · BAIXO · security · T11 · Tech Review (rodada 2, P3) — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19, **exatamente na forma que o débito prescreve, e só nela**: o registro, não a troca. O cabeçalho do `location` ganhou o bloco que separa os dois cabeçalhos de origem — `X-Real-IP $remote_addr` é o valor **confiável** (endereço do salto imediato, observado pelo servidor) e `X-Forwarded-For $proxy_add_x_forwarded_for` chega **contaminado**, porque apenda ao que o cliente enviou e deixa o elemento mais à esquerda sob escolha de quem chama. O bloco declara também **por que não se mexe agora**: o eixo de origem é matéria dos D23/D24/D27 da F1, cujo gatilho é a publicação na F7, e antecipá-lo aqui desfaria decisão agendada. Nenhum `proxy_set_header` foi alterado.
- **Onde:** `deploy/nginx/sysloc-notificacao-bancaria.conf` (dentro do `location = /v1/notificacoes-bancarias`)
- **Problema:** a borda **mais externa** repassa `X-Forwarded-For $proxy_add_x_forwarded_for` (que **apenda** ao valor que o cliente enviou, deixando o elemento mais à esquerda sob escolha de quem chama) e `Host $host`.
- **Impacto:** **nulo hoje** — nenhuma rota consome esses cabeçalhos, que é precisamente o que os **D23/D24/D27 da F1** registram ao dizer que *"o limitador não tem eixo de origem"*. O risco é de estrutura e se materializa na **F7**: o consumidor que a publicação da API inteira vai escrever herda dois cabeçalhos de origem, um confiável (`X-Real-IP $remote_addr`, já presente e correto) e um contaminado, sem nada no ponto de leitura dizendo qual é qual.
- **O que fazer:** ⚠️ **não alterar nesta task** — o eixo de origem é matéria dos D23/D24/D27, cujo gatilho é a publicação na F7, e mexer agora antecipa decisão agendada. Cabe **uma linha** no cabeçalho do `location`, ao lado do comentário que já explica por que o método não é restringido, registrando que `X-Real-IP` é o valor confiável e que `X-Forwarded-For` chega contaminado por vir da borda mais externa — para que o consumidor da F7 não escolha o errado por descuido.

### D31 · BAIXO · error_handling · T11 · QA (rodada 2)
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:580`
- **Problema:** janela residual entre a escrita real do vhost e a abertura de `ESCRITA_PENDENTE` — o estado é ligado **depois** que `posicionar_vhost` retorna, e é **dentro** dela (num subshell de substituição de comando) que o `install` escreve.
- **Impacto:** ⚠️ **não é reabertura do ALTO-002** — a janela **grande**, a que cobre a execução do `nginx -t` do P04 e leva tempo real, está fechada e provada pelo par de asserções do CT-1005 (b). O que resta é resíduo de ordenação, de microssegundos, com probabilidade prática desprezível num script rodado à mão por operador com sudo. Se o sinal chegar exatamente ali, o desfecho é o mesmo defeito que a rodada 2 fechou.
- **O que fazer:** inverter para **pessimista** — ligar `ESCRITA_PENDENTE="sim"` **antes** de chamar `posicionar_vhost`, e desligá-la no ramo `JA-OK` (onde nada foi escrito e desfazer removeria um vhost correto). O invariante passa a ser *"a janela abre antes de qualquer possibilidade de escrita e fecha quando se sabe que não houve"*, sem depender de o retorno da função preceder o efeito dela.

### D32 · BAIXO · tests · T11 · QA (rodada 1) · `smell: magic_strings`
- **Onde:** `deploy/scripts/borda/verificar-notificacao-bancaria.sh:675` (e 586, 678, 765, 772, 838, 684, 841)
- **Problema:** limites de tempo escritos como literais no meio do caso (`--max-time 10`, `--max-time 2`, `limite=50`, `limite=25`, `sleep 0.2`), contra a convenção vinculante da `.claude/rules/testing-stack.md` (*"todo limite de tempo é constante nomeada no topo do arquivo"*).
- **Impacto:** a espera em si está **correta** e não é AP-07 — é sondagem por estado observável com teto declarado, que é o que a rule manda. O desvio é só de forma.
- **O que fazer:** promover a `readonly` no topo: `SEGUNDOS_DE_ESPERA_POR_RESPOSTA=10`, `TENTATIVAS_ATE_A_BORDA_SUBIR=50`, `TENTATIVAS_ATE_A_BORDA_MORRER=25`, `INTERVALO_DE_SONDAGEM=0.2`.

### D33 · BAIXO · tests · T11 · QA (rodada 1) · `smell: non_deterministic_input`
- **Onde:** `deploy/scripts/borda/verificar-notificacao-bancaria.sh:838`
- **Problema:** o CT-1005 (d) compara a lista **inteira** de processos nginx do host (53 nesta máquina) por `diff` vazio entre abertura e fecho — vetor de instabilidade alheio ao SUT. Somado a isso, o laço que espera a borda efêmera morrer sai por **esgotamento do limite sem falhar**, de modo que um teardown lento faz os processos efêmeros aparecerem no retrato de fecho e reprovarem.
- **Impacto:** qualquer reciclagem de worker do nginx de produção durante os ~40 s da bateria produz falha sem que nada da task tenha mudado. A asserção é **legítima e sem substituto óbvio** (é ela que separa *"não escrevi nada"* de *"não mexi em nada"*), e saiu verde nas duas rodadas.
- **O que fazer:** (a) filtrar do retrato os processos cujo comando contenha `${DIR_TRABALHO}`, em vez de depender de o teardown ter terminado, e fazer o laço emitir `aviso` ao esgotar o limite; (b) restringir a comparação ao processo **mestre** do nginx e à contagem de workers, tolerando reciclagem alheia.

### D34 · BAIXO · error_handling · T11 · QA (rodada 1) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-23
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:481` (`passo_p05_recarregar`)
- **Problema:** a idempotência é medida **no disco**, não no servidor em execução — `total_criado` deriva da comparação do arquivo.
- **Impacto:** se o vhost já está correto em disco mas **nunca chegou a ser carregado** (execução anterior interrompida entre escrita e reload, ou arquivo posto à mão), o script reporta `JA-OK` e sai 0 **sem recarregar**, e a borda segue sem atender. Estado convergente no disco não é estado convergente no processo. A decisão de não recarregar à toa está **certa** (micro-indisponibilidade numa borda compartilhada); falta o segundo sinal.
- **O que fazer:** antes de decidir o reload, conferir se o servidor em execução já atende o vhost — ex. comparando o instante de modificação do arquivo com o de início do processo mestre do nginx. Alternativa mais barata: declarar no resumo que a prova de que a borda atende é o `verificar-notificacao-bancaria.sh`, e registrar o caso como limitação conhecida.

- **Como foi fechado (2026-08-23):** `passo_p05_recarregar` ganhou o SEGUNDO sinal — `servidor_ja_carregou`,
  função pura nova que compara o `mtime` do vhost com o instante de início do **worker mais antigo**
  do nginx. ⚠️ O discriminador é o **worker**, nunca o mestre: `reload` substitui os workers e
  **preserva** o mestre, de modo que o início do mestre não separa configuração carregada de
  configuração nunca lida — a sugestão original do débito (*"instante de início do processo mestre"*)
  **não funcionaria**, e a divergência foi medida antes de agir. A decisão de não recarregar à toa
  fica intacta: com `total_criado == 0` e o servidor já tendo carregado, segue `JA-OK`; só recarrega
  quando o disco está convergente e o **processo** não. O terceiro código (2, não deu para decidir)
  mantém o comportamento antigo e **avisa** — na dúvida não se recarrega, porque errar para esse lado
  custa uma execução do verificador e errar para o outro custa indisponibilidade.
- **Rede:** `CT-1005 (b)`, três asserções — arquivo anterior aos workers (já carregado), posterior
  (não carregado) e inexistente (não se decide). O par antigo/recente é o que discrimina; a perna dos
  workers é pulada com `aviso` explícito num host sem nginx, nunca em silêncio.
### D35 · BAIXO · error_handling · T11 · QA (rodada 1) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-23
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:458` (`restaurar_destino`)
- **Problema:** o backup é guardado com `cp -p` (que **preserva** o modo) e reposto com `install -m "${MODO_DO_VHOST}"` (que **fixa** 0644); um destino que estava em 0600 volta com 644. E a mensagem de :475 (*"o estado anterior foi restaurado"*) afirma mais do que aconteceu.
- **Impacto:** conteúdo certo, permissão alterada — numa borda compartilhada com produção.
- **O que fazer:** capturar o modo original junto com o backup (`stat -c '%a'`) e usá-lo no `install -m`; ou trocar por `cp -p`, simétrico ao que criou o backup. E ajustar a frase para dizer o que de fato é garantido.

- **Como foi fechado (2026-08-23):** o modo do arquivo anterior passou a ser **capturado junto com o backup**
  (`MODO_ANTERIOR_DO_DESTINO`, via `stat -c '%a'`, no mesmo ponto e instante do `cp -p`) e é ele que
  `restaurar_destino` repõe — nunca mais `MODO_DO_VHOST`. A distinção é de propriedade: `MODO_DO_VHOST`
  é a permissão que **este** produto dá ao vhost que ele instala; o arquivo restaurado é de quem
  estava ali antes, numa borda compartilhada. A mensagem passou a nomear o que de fato se garante
  (*"o conteúdo e a permissão anteriores … foram restaurados"*), e a frase do P04 idem.
- **Rede:** `CT-1005 (b)`, duas asserções sobre `restaurar_destino` — que era carregada pela bateria e
  **nunca exercitada**: repõe o conteúdo anterior, e repõe a permissão `0600` anterior em vez de 0644.
### D36 · BAIXO · code_quality · T11 · QA (rodada 1) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-23
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:224` (e :249)
- **Problema:** duas expressões estreitas, **latentes hoje**: (a) o guarda de marcador residual usa `'__[A-Z_]+__'`, que **não casa dígito** — um `__PORTA_8080__` futuro escaparia do guarda e entraria em produção; (b) `${modo#0}` remove **um** zero à esquerda, correto para `0644` mas errado para `0044`, que viraria `044` contra o `44` do `stat` e faria o arquivo ser julgado divergente e reescrito em toda execução, quebrando a idempotência em silêncio.
- **Impacto:** nenhuma das duas está ativa — os seis marcadores atuais são alfabéticos e o modo é 0644.
- **O que fazer:** (a) trocar por `'__[A-Z0-9_]+__'`; (b) normalizar os dois lados com aritmética de base 8 em vez de recorte de texto — `[[ "$(stat -c '%a' "${destino}")" == "$(printf '%o' "$((8#${modo}))")" ]]`.

- **Como foi fechado (2026-08-23):** (a) a classe do guarda de marcador residual passou a `'__[A-Z0-9_]+__'`
  — o que define um marcador do gabarito é a **forma**, não o alfabeto do nome; (b) a comparação de
  modo saiu do recorte de texto (`${modo#0}`) para **valor em base 8**, extraída na função pura
  `modo_igual`. ⚠️ **A extração não é estilo, é PROVA**: o único par que discrimina o defeito é um modo
  sem permissão para o dono (`0044` contra o `44` do `stat`), e um arquivo assim não pode ser lido
  pelo usuário que roda a bateria — o `cmp` de `vhost_diverge` falharia por I/O **antes** da
  comparação de modo, e a asserção estaria medindo outra coisa. Medido: a primeira versão da rede
  reprovou exatamente assim.
- **Rede:** `CT-1005 (b)` — o marcador com dígito é **acrescentado** ao gabarito (não trocado por um
  real), para que a recusa só possa vir do guarda de residual; e três asserções sobre `modo_igual`,
  incluindo o controle negativo (`600` continua diferente de `0644`).
### D37 · BAIXO · error_handling · T11 · QA (rodada 1) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-23
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:396`
- **Problema:** a conferência de `include` é de **um nível só**, e é **pulada em silêncio** quando a configuração do servidor não é legível (`[[ -r … ]] &&` sem `aviso`).
- **Impacto:** instalação em que o `nginx.conf` inclui um arquivo que por sua vez inclui o diretório dos vhosts — **padrão do CloudPanel, que é o que atende `/opt/frappe` neste host** — faz o script abortar indevidamente; a falha é fechada e a mensagem é acionável, o que a torna suportável. O que **não** é suportável é o outro ramo: `/etc/nginx` é 0700 root nesta máquina, isto é, **o ramo silencioso é o que de fato vai correr**.
- **O que fazer:** emitir `aviso` explícito nomeando a checagem não feita quando a configuração não for legível — a convenção da `testing-stack.md` (*"ferramenta ou estado ausente nunca faz o caso passar em silêncio"*) vale igualmente para pré-condição de instalador. E resolver `include` transitivamente (um nível de recursão) antes de decidir o aborto.

- **Como foi fechado (2026-08-23):** a conferência virou a função pura `configuracao_inclui_diretorio`, com
  **três** códigos — inclui (0), não inclui (1) e **não deu para decidir** (2). O terceiro é o que
  elimina o ramo mudo: *"não consegui ler"* e *"não inclui"* levam a condutas opostas, e fundi-las era
  o defeito. O caso não-legível emite `info "⚠️ …"` nomeando a checagem que **não** foi feita, pela
  convenção da `testing-stack.md` (*"ferramenta ou estado ausente nunca faz o caso passar em
  silêncio"*). E o `include` passou a ser resolvido **transitivamente (um nível)**, que é o padrão do
  painel que administra a borda deste host.
- ⚠️ **Uma premissa do débito estava VENCIDA e foi refutada por medição:** *"o ramo silencioso é o que
  de fato vai correr"* pressupõe leitura sem privilégio, mas o instalador **aborta com `EUID != 0`** e
  root lê `0700 root`. Medido em 2026-08-23: `/etc/nginx` é `drwx------ root root`, e como root o
  `nginx.conf` **é** legível. O ramo mudo corre quando a configuração está em **outro prefixo** — o
  que continua plausível e é o que a correção cobre. A correção da resolução transitiva é
  **independente do privilégio** e era a metade que mais mordia.
- **Rede:** `CT-1005 (b)`, quatro asserções — direto, transitivo (era 1, agora 0), não inclui (1) e
  ilegível (2).
### D38 · BAIXO · data_handling · T11 · QA (rodada 1) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-23
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:286` (`valor_no_arquivo_de_ambiente`)
- **Problema:** a leitura toma a **primeira** atribuição (`head -1`), enquanto o systemd (`EnvironmentFile=`) usa a **última** — resolução na direção **oposta**, sem nada acusar. Também não há tratamento de `
` (CRLF), aspas ou espaço à direita.
- **Impacto:** as três chaves lidas aqui **não** são semeadas pelo provisionador e entram à mão, o que torna a duplicata plausível. ⚠️ O Tech Review considerou **elevar** e manteve em débito, por duas razões: não é evidência nova, e o arquivo é gravado pelo `provisionar-base.sh`, que já barra a duplicata a montante.
- **O que fazer:** seguir o precedente do repositório — `provisionar-base.sh:1536` **aborta** diante de chave duplicada em vez de escolher em silêncio, e é essa a correção certa. ⚠️ **Não** troque `head -1` por `tail -1`: alinharia com o systemd mas mantém a escolha silenciosa. Acrescentar `tr -d '\r'` e recorte de espaço à direita.

- **Como foi fechado (2026-08-23):** seguindo o precedente que o próprio débito nomeia
  (`provisionar-base.sh`, `extrair_credencial_db`), a ambiguidade passou a ser **recusada** em vez de
  resolvida em silêncio: `chaves_repetidas_no_ambiente` é conferida em `verificar_precondicoes`
  **antes** de qualquer leitura, e o script aborta nomeando a chave repetida. ⚠️ O `head -1`
  **permaneceu**, como o débito manda — trocá-lo por `tail -1` alinharia com o systemd e manteria a
  escolha silenciosa. Ele agora é seguro **por pré-condição**, e o docblock diz isso. Acrescentados
  `tr -d '\r'` e recorte de espaço à direita, porque o valor vira caminho de certificado e diretiva
  do vhost.
- **Rede:** `CT-1005 (b)`, quatro asserções — o antivácuo (arquivo sem repetição **não** acusa) antes
  do positivo (acusa nomeando a chave), mais CR e espaço à direita fora do valor lido.
### D39 · BAIXO · documentation · T11 · QA (rodada 1)
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh:292`
- **Problema:** o docblock de `validar_vhost_isolado` afirma que a validação acontece *"num prefixo efêmero e sem privilégio"*, mas `verificar_precondicoes` aborta quando `EUID != 0`, de modo que ela **sempre** roda como root.
- **Impacto:** o leitor que confiar na frase conclui, errado, que dá para exercitar o passo sem `sudo`.
- **O que fazer:** reescrever para o que é verdade e é o ponto real: *"não EXIGE privilégio — é exercitável isoladamente pela bateria de verificação, embora dentro deste script corra como root como todo o resto"*.

### D40 · BAIXO · documentation · T12 · QA (rodada 1)
- **Onde:** `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:414`
- **Problema:** o canal do **corpo binário do carnê** é ilegível ao varredor, e o docblock declara uma medição que **não discrimina**.
- **Impacto:** ⚠️ **medido por execução independente pelo próprio gate**: o PDF do renderizador e o mesclado por `pdf-lib` **comprimem os fluxos de conteúdo** — plantada a agulha `AGULHA_nossoNumero_MARCA` no bloco renderizado, ela **não** aparece em texto claro nem no renderizado (1544 bytes) nem no mesclado (1139 bytes). Logo a parcela da asserção que incide sobre os bytes do documento **não pode acusar termo algum**; o que discrimina naquela resposta são apenas os dois cabeçalhos (`content-type` e `content-disposition`, este composto pelo produto). ⚠️ **NÃO é AP-24** — nenhuma asserção pré-existente dependia do buffer antigo (ele aparecia uma única vez em `HEAD`, na definição do par, e a rota do carnê não era exercitada nesta suíte antes da T12) — **nem AP-29**, porque a asserção agregada é falível pelos cabeçalhos. O defeito é **de registro**: o docblock afirma *"nenhum dos treze termos aparece no PDF renderizado nem no mesclado"* e o comentário do bloco 4 diz que a não-vacuidade *"pega o corpo vazio"*; lidas juntas, as duas frases induzem o próximo agente a acreditar que o **conteúdo** do carnê foi varrido. Hoje o risco é contido — o carnê só **mescla** (medido: `carne.service.ts:208`) e o conteúdo é fato de terceiro pela cláusula de exclusão da **ADR-0030** —, mas no dia em que ele ganhar capa ou página gerada pelo produto a varredura continuará devolvendo zero **por não conseguir ler**.
- **O que fazer:** declarar a limitação por extenso no docblock de `documentoDeBoletoDoPar` e no comentário do bloco 4. Se quiser tornar o canal discriminante, **o repositório já tem a capacidade**: `extrairPaginasDePdf` de `packages/documentos/test/mesclador-pdf.spec.ts` (CT-1002) extrai o texto de volta página a página — bastaria varrer o texto extraído em vez dos bytes crus, com controle positivo que plante um termo no bloco renderizado e confirme que a varredura o acusa.

### D41 · BAIXO · documentation · T12 · QA (rodada 1)
- **Onde:** `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:54` (e o nome do `it` na linha 2104)
- **Problema:** a tabela de INVARIANTES diz *"as **cinco** capacidades **da porta**"*, colidindo com a **emenda de 2026-08-17 da ADR-0001**.
- **Impacto:** ⚠️ **o teste está CERTO** — as cinco chaves que ele afirma são as **quatro** da porta de cobrança (`emitir`, `solicitarRevogacaoDeBoleto`, `confirmarRevogacaoDeBoleto`, `consultarSituacao`) **mais** `verificarIdentidade`, da porta de **identidade**, e o docblock de `CAPACIDADES_DO_ADAPTADOR` o diz com precisão. O problema é a frase abreviada *"da porta"*, no singular, **na posição mais lida do arquivo**. O `CLAUDE.md` adverte literalmente *"Não 'corrija' a porta para cinco"*, e este é exatamente o vão de registro que o repositório já pagou **quatro vezes** (ADRs 0001, 0017, 0021, 0024). **Risco R3** (regressão de decisão), não R1.
- **O que fazer:** trocar por *"as cinco capacidades **do adaptador** — as quatro da porta de cobrança mais a sonda de identidade"* nas duas linhas. Alinha o texto curto com o docblock da constante, que já está certo.

### D42 · BAIXO · documentation · T12 · QA (rodada 1)
- **Onde:** `CLAUDE.md:320`
- **Problema:** a reconciliação **não cumpriu o D6 da §2**, que designava a T12 como dona: a linha do `D13` (fatia `emissao-e-conciliacao`) ainda nomeia a **coluna extinta** `nosso_numero`.
- **Impacto:** ⚠️ **medido** — a coluna foi renomeada **por esta própria fatia** (`packages/db/migracoes/0019_dominio_webhook_e_carne.sql:143` executa `RENAME COLUMN "nosso_numero" TO "numero_do_titulo_no_provedor"`), e o **marcador vivo correspondente já foi atualizado** (`packages/db/src/boleto-da-cobranca.ts:337-338`). É a **única** ocorrência de `nosso_numero` restante no `CLAUDE.md`, e ela nomeia coluna que não existe mais. O `D6 · T2 · Tech Review` designa por escrito *"Dono natural: a **T12**, que já reconcilia o índice no fecho da fatia"* — e a T12 é a última da fatia, de modo que, não saindo aqui, **o índice fecha a F4 mentindo sobre o esquema**.
- **O que fazer:** trocar `nosso_numero` por `numero_do_titulo_no_provedor` na linha 320. A linha permanece dentro do teto de ~150 caracteres, e a barreira executável **não é afetada** — ela confere o par `Dnn · F{n}/{origem}`, não o corpo da célula.

### D43 · BAIXO · code_quality · fechamento · intervenção dirigida (2026-08-20)
- **Onde:** `deploy/scripts/borda/instalar-borda-de-notificacao.sh` (junto de `NOME_DO_VHOST`)
- **Problema:** o nome do arquivo de vhost instalado é uma constante `readonly`, de modo que o instalador comporta **um** hostname de notícia bancária. Rodá-lo com um segundo hostname **sobrescreve** o vhost do primeiro em vez de criar outro — e o primeiro deixa de ser atendido sem que nada acuse.
- **Impacto:** ⚠️ **medido em 2026-08-20**, durante a ativação da borda em produção. Hoje é **inócuo**: há um provedor só, e a pergunta do usuário que originou este registro (*"e se eu criar outro webhook de outra integração?"*) não tem caso real. O que o torna registrável é o **modo de falha**: a sobrescrita é silenciosa, e o sintoma apareceria como notícia que deixa de chegar do primeiro provedor. Não confundir com a **disputa de `server_name`**, que é outro assunto e foi tratada na mesma data (prefixo `000-` no nome instalado, mais o passo **P03-B**, que aborta quando outro vhost vence e nomeia o rival): dois vhosts NOSSOS de hostnames diferentes **não** competem entre si — nomes diferentes, disputas separadas. O que falta aqui é poderem **coexistir como arquivos**.
- **O que fazer:** derivar o nome do arquivo do hostname (algo como `000-sysloc-notificacao-<hostname>.conf`), preservando o prefixo de precedência, e estender `remover_vhost_de_nome_legado` para não apagar o vhost de **outro** hostname. ⚠️ **O vhost é a menor parte do que faltaria**: a rota publicada é uma só (`/v1/notificacoes-bancarias`) e o domínio modela **um** provedor (ver `D36 · F4/T10` e `D17 · F4/T7`, que registram a identidade da empresa perante o provedor). Fechar só o nome do arquivo daria a impressão de que multi-provedor está resolvido, quando não está.
- **Prova exigida:** a tabela da disputa de `server_name` no `CT-1005 (b)` já cobre a precedência; para este débito, o que se exige é asserção de que **dois hostnames distintos produzem dois arquivos distintos**, e de que instalar o segundo **não remove** o primeiro.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

> ⚠️ **Duas pendências abaixo são OPERACIONAIS e do usuário — não são falha medida.** Elas fecham a
> fatia do lado do código, mas não do lado da máquina.

### O que ficou para o usuário fazer (nesta ordem)

1. ✅ **`verificar-migracao.sh` — RESOLVIDO em 2026-08-19, após o fecho do run.** Está **verde, 2/2
   casos**. Fica registrado porque o episódio é instrutivo e o precedente vale para as próximas fatias.

   **O que era:** o verificador reprovava em 2 de 2 casos, e o banco da operação estava na `0018` — a
   `0019` e a `0020` **nunca haviam sido aplicadas**. A causa **não era defeito de código**: os papéis
   `sysloc_resolucao` e `sysloc_roteamento` nascem no **provisionador**, nunca numa migração, e o
   `provisionar-base.sh` (passo **P15**, que esta fatia ampliou em 34 linhas para criar o
   `sysloc_roteamento`) não fora reexecutado no cluster. A `0020` abortava **limpa, dentro da
   transação, sem deixar metade aplicada**, com `RAISE EXCEPTION` e `HINT` nomeando o script e o
   passo — **o guard funcionou exatamente como projetado**.

   ⚠️ **Por que nenhum agente pegou, e é estrutural — não descuido:** o provisionador exige `sudo`,
   que nenhum agente do run tinha; e o banco efêmero da suíte **cria esses papéis por conta própria**
   (`PAPEIS_DE_FUNCAO` em `packages/db/test/banco-efemero.ts`), de modo que os 1710 casos ficam verdes
   **independentemente do estado do cluster real**. A suíte inclusive tem
   `erroAoMigrarSemPapelDeRoteamento()`, que prova este mesmo aborto — mas contra uma instância
   própria. **A suíte não consegue, por construção, medir o cluster de verdade; só as baterias
   `verificar-*.sh` conseguem, e elas exigem privilégio.**

   **Sequência que fechou** (a ordem importa — a `0019` renomeia `negocio.cobranca.nosso_numero` para
   `numero_do_titulo_no_provedor`, e serviço rodando build antigo quebra contra o schema novo):
   provisionar → `verificar-provisionamento.sh` → `pnpm build` → `migrar-banco.sh` →
   `systemctl restart sysloc-api sysloc-worker` → `verificar-migracao.sh`.

   **Estado final medido:** produção em `0020`, `plataforma.notificacao_bancaria` existente,
   `GET /saude` respondendo `200` e nenhum erro nos diários dos dois serviços após o restart.
2. **O rollout da borda em produção não foi executado**, e a razão é conformidade com a **ADR-0006**
   (*"a suíte de verificação nunca executa contra o ambiente que atende a operação"*), não falta de
   entrega. Os três passos da §3.f da T11 têm **ponto de parada declarado entre eles**: (1) instalar o
   vhost e provar com o verificador; (2) subir a API e provar o `204` de fora; (3) **cadastrar o
   webhook no portal do provedor** — o critério de pronto da CA-20.
3. **O hostname da borda continua decisão sua.** A `[DÚVIDA] 4` do discovery segue aberta; vhost e
   verificador leem de configuração (`SYSLOC_HOSTNAME_DA_NOTIFICACAO` ou
   `HOSTNAME_DA_NOTIFICACAO_BANCARIA` em `/etc/sysloc/backend.env`).
4. ⚠️ **Risco R1 — o certificado em uso vence em 2026-08-22.** O passo 3 depende dele.

### Duas outras linhas do `CLAUDE.md` estão vencidas — MEDIDAS na T12, e deliberadamente NÃO alteradas

- **A contagem da suíte** diz `1640`; o medido hoje é **1710**.
- **A superfície publicada** diz `99 rotas / 84 manipuladores`; a fatia fechou em **101/86**.

Não foram corrigidas porque a §5.2 da T12 declara o `CLAUDE.md` **apenas** para a reconciliação do
bloco de débitos, e porque a segunda **exige a dupla medição independente do `CT-937`**. As duas devem
fechar **juntas**, na revisão de fecho da fatia — é trabalho de fecho, não de task. A linha do
inventário de ADRs, essa sim, foi corrigida na T12 (33/26 → **35/28**, medido), porque esta §4 a
atribuía nominalmente a ela.

### Achado pré-existente, alheio a esta fatia

`deploy/scripts/instalacao/verificar-workspace.sh` **reprova com 5 falhas** (contagem de pacotes da F0
e `pnpm test` em clone). Foi medido três vezes ao longo do run, sempre com texto idêntico, **antes e
depois** das tasks que poderiam tê-lo afetado. Não é regressão desta fatia.

### O que um humano precisa saber para julgar o run

- **A T11 responde por 13 dos 42 débitos** — quase um terço. Não é qualidade pior: é a única task com
  ~1700 linhas de **shell**, superfície em que o catálogo de antipadrões é menos maduro e o gate
  reporta mais achados de forma. Onze dos treze são `BAIXO`.
- **Nenhum débito bloqueou.** Os 7 `MÉDIO` são todos de categoria anotável (`project_pattern`,
  `code_quality`, `tests`/manutenibilidade) pela partição da rule.
- **Duas tasks custaram caro em rodadas**: T6 (QA rodada 4, TR rodada 3) e T9 (QA rodada 5). T8 passou
  limpa nos dois gates na rodada 1.
- **Um gate corrigiu o outro, e vale registrar**: na T10, o Gate 1 reordenou asserções tautológicas e
  **declarou o resíduo que a própria remediação deixa** — numa cadeia de três igualdades entre três
  objetos, duas sempre implicam a terceira, de modo que reordenar move *qual* fica implicada, nunca
  elimina a implicação. Ele não reportou como achado novo, citando a §5 do Protocolo Antirregressão.
- **O Gate 1 da T12 reproduziu a prova de falsificação em vez de aceitá-la**, e **mediu a compressão do
  PDF** para julgar a troca de arranjo que o executor declarou. Foi assim que nasceu o **D40**, que é o
  achado mais útil do fecho: o canal do corpo do carnê **não pode acusar termo algum**, porque o
  `pdf-lib` comprime os fluxos — hoje inofensivo (o carnê só mescla, e o conteúdo é fato de terceiro
  pela cláusula de exclusão da ADR-0030), mas a varredura continuará devolvendo zero **por não
  conseguir ler** no dia em que o carnê ganhar página gerada pelo produto.

### Recomendações de emenda de gatilho — registradas, NÃO executadas

- **D34 · F4/T11** — o gatilho *"a fatia que trouxer a notícia recebida do provedor"* **não se cumpre**:
  medido, a notícia **não fornece** a chave de correlação que falta. Recomendação: emendar o
  `QUANDO FECHA` para *"a fatia que persistir o identificador perante o provedor antes da chamada de
  emissão"*, **preservando o texto original**. Emendar marcador vivo de outra fatia é decisão do dono
  dele.
- **D63 · F4/fechamento** — o marcador falava em *"24 de 24 suítes"*; medido, `pedir` estava declarado
  em **30** arquivos. O débito foi **fechado** pela T6, então a divergência é histórica: fica a
  medição registrada, e **não** se "corrige" a contagem retroativamente.

---

### Registro anterior da §4 (preservado)
### A T9 fechou nos dois gates — e as 7 rodadas dizem algo que vale ler

Gate 1 **APROVADO** na rodada 5 (zero problemas, 8/8 critérios) e Gate 2 **APROVADO** na rodada 2 (zero
problemas). Nove invocações de gate no total.

⚠️ **Uma verificação foi impossível, e o Tech Review a declarou em vez de presumi-la**: o `attempt_sha`
da rodada 4 era um commit solto e **já não existe** no repositório (coletado pelo GC). Com ele foi-se o
único snapshot que continha o parágrafo protegido da `DECISÃO FECHADA` na forma em que nasceu, de modo
que a emenda foi julgada por coerência interna, pela declaração do executor e pela conferência do
Gate 1 — **não por diff**. É um custo real do mecanismo de `attempt_sha`, não um defeito da task, e
merece decisão do usuário: snapshot de tentativa que precise sobreviver ao GC teria de ser ancorado
(uma `ref` temporária), o que hoje não se faz.

**A T9 custou 5 rodadas, e vale registrar por quê** — o padrão é instrutivo e não foi desperdício:
o defeito não estava no que a task construiu (retenção, retomada, emenda do docblock: aprovados na
rodada 1 e nunca reabertos), e sim numa **corrida de desligamento de fila** que a suíte nova apenas
tornou observável. Duas hipóteses de causa caíram **por medição** antes da terceira acertar — e as duas
refutações vieram de quem estava sendo corrigido, com evidência bruta e reprodutor determinístico, não
com argumento. A correção final é uma **mudança de ordem** em `produtor-de-fila.ts` (`disconnect` →
assentar → fechar filas), e ela **fechou um defeito de produção real**: o desligamento podia não terminar,
com o supervisor recorrendo a `SIGKILL`.

**Duas decisões de fronteira foram tomadas no caminho**, ambas registradas: o orquestrador **reabriu a
§5.2** da task (rodada 3) para tornar o §4 item 8 alcançável, em vez de fechar a task com um critério de
aceite declaradamente falso; e o Gate 2 **recolheu** um membro de porta publicada (`pronto()`) que nascera
para satisfazer teste, **refutando** a saída que o Gate 1 recomendara — que teria pendurado a subida da API
com o Redis fora.

- **⚠️ A T6 custou QUATRO rodadas, e a causa foi de SPEC, não de execução — está corrigida, e a correção alcança as tasks seguintes.** O `CA-11` e a `§5.2` da T6 delimitavam a baseline e o blast radius a **três** pacotes, enquanto a task publicava símbolos cujas **âncoras de igualdade de conjunto moram em `packages/db/test/`**. Resultado: `@sysloc/db` não foi executado por três rodadas **enquanto duas asserções estavam vermelhas** — a fila nova fora de `FILAS_DECLARADAS` e o serviço novo fora de `ABRIDORES_LEGITIMOS`. O QA os achou na rodada 3 **por exceder o blast radius declarado**. A métrica do ledger registra o custo com dado: **16 achados, 11 originados em rodada > 1, 2 suspeitos de incompletude da rodada 1** — e os 2 suspeitos são exatamente os dois críticos.
  **O que foi feito, nas duas pontas**: (i) o `CA-11` e a `§5.2` da T6 foram corrigidos para exigir a baseline do **repositório inteiro**, com o comando de busca que deriva os arquivos-âncora; (ii) o orquestrador **corrigiu também a `§5.2` da T7** antes de despachá-la, porque o Tech Review foi explícito de que anotar isso como débito não resolveria — o débito só seria lido **depois** de a T7 já ter reprovado no mesmo `CT-326`. A T7 cria a **quinta** tarefa de `apps/worker/src/tarefas/` a abrir unidade de trabalho.
- **⚠️ Duas ações de OPERADOR ficaram pendentes, e nenhum agente deste ambiente pode executá-las.**
  As duas baterias de shell recusam execução sem privilégio administrativo, e `sudo` neste host pede
  senha interativa — a `.claude/rules/testing-stack.md` declara essa fronteira por escrito.
  **(a)** `deploy/scripts/instalacao/verificar-migracao.sh`, que cobre as migrações `0019` e `0020`;
  **(b)** `deploy/scripts/instalacao/verificar-provisionamento.sh`, cujo `CT-030` a T3 estendeu para
  os **quatro** papéis. O que foi feito no lugar, e que **não substitui** as baterias: a parte
  estática de (a) foi reproduzida (0 `CREATE SCHEMA` em código, 16 na varredura ingênua — o controle
  antivácuo continua vivo), e em (b) as quatro consultas novas foram executadas contra instância
  efêmera com os quatro papéis provisionados, devolvendo `4/f/f/f`, com o *wiring* conferido por
  inspeção estática pelos dois gates. **Recomendação: rodar as duas com o operador antes de a fatia
  fechar.**
- **⚠️ Flake pré-existente de nível de projeto, sem dono, que morde a F7.** A suíte de `@sysloc/api`
  fecha **317/317 verdes** mas o processo sai com **código não-zero** de forma intermitente, por
  rejeição não tratada do `ioredis`/`bullmq` no encerramento (*"Stream isn't writeable and
  enableOfflineQueue options is false"*). Reexecutar dá `EXIT=0`. Já foi julgado **pré-existente
  puro** pelos dois gates em **quatro** fatias anteriores, com origem em
  `apps/api/src/comum/produtor-de-fila.ts:245`. Nenhuma task deste run o causa. Registro aqui porque
  o primeiro critério de aceitação da F7 pressupõe saída confiável: **um `exit 1` intermitente
  quebra CI com a suíte verde.**
- **Estado parcial encontrado na árvore, e a decisão sobre ele.** O bloco de emenda de 2026-08-18 à
  ADR-0024 já existia não commitado quando o run começou — foi escrito pela sessão de challenge desta
  fatia, que o declarou como ação pendente. O orquestrador optou por **retomar completando** em vez de
  reexecutar do zero: `git checkout` teria descartado texto arquitetural insubstituível
  mecanicamente. O executor conferiu o bloco contra as quatro declarações da §3 da T1 e o aprovou sem
  reescrever; o que faltava — a ressalva na linha-resumo do `INDEX.md` e a menção no `CLAUDE.md` — foi
  escrito por ele.
- **⚠️ Divergência medida no `CLAUDE.md`, fora do escopo da T1.** A tabela de leitura obrigatória
  ainda afirma *"33 registradas, 26 `accepted`"*; medido hoje são **35 registradas e 28 `accepted`**
  (a 0034 e a 0035 entraram depois da última atualização daquela linha). Não foi corrigido porque a
  §5.2 da T1 não a declara e a Regra 3 da Disciplina do Executor proíbe alargar. **Dono natural: a
  T12**, que já reconcilia índice no fecho da fatia.
- **⚠️ A ressalva do `INDEX.md` é sobrescrevível por regeneração.** A linha-resumo da 0024 é gerada
  por `.claude/skills/agent-spec-adr-reindex/scripts/reindex.cjs`; uma reindexação futura apagaria a
  ressalva manual. O precedente já existe na linha da 0015. Não é defeito desta task — é propriedade
  do gerador, registrada aqui para que a próxima reindexação não a perca em silêncio.
- **⚠️ Pela sexta vez neste projeto, o executor que divergiu da prescrição de um gate tinha razão — e desta vez a divergência salvou a rede.** O QA da T4 sugeriu, para provar a recusa de número no identificador da liquidação, submeter `Number(IDENTIFICADOR_DA_LIQUIDACAO)` (≈ `1.6e18`). O executor mediu e refutou: fora do inteiro seguro as **duas** leituras coincidem, de modo que esse caso passaria idêntico com e sem a guarda — teria fechado o achado **sem fechar o defeito**. Ele escreveu a tabela com as duas faixas, e o próprio QA, na rodada 2, confirmou a refutação por verificação exaustiva de tipo de entrada. O precedente *"prescrição de gate é hipótese, não ordem"* segue valendo, e o corolário é o que importa: **quem diverge tem de declarar e medir** — foi o que ele fez.
- **Guards de paralelismo derrubaram 2 das 4 tasks do lote declarado.** `{T1, T2, T4, T5}` virou
  `{T2, T4}`: a T1 divide o `CLAUDE.md` com a T2 (fallback já previsto na §4.2 do task_plan), e a T5
  reescreve `pnpm-lock.yaml` e o `node_modules` do workspace inteiro ao instalar o `pdf-lib` —
  concorrer com duas suítes na mesma árvore produziria flake em task inocente.

### Fecho da fatia (T12) — as duas emendas de gatilho RECOMENDADAS, e a reconciliação medida

**As duas recomendações abaixo são registro, não execução.** A T12 não altera marcador de débito de
outra fatia: emendar o `QUANDO FECHA` de um marcador vivo é decisão de quem é dono dele, e o molde
canônico (o das emendas das ADRs 0001, 0017, 0021 e 0024) exige **preservar o texto original byte a
byte** e acrescentar o bloco datado ao lado. Fica aqui a medição que autoriza cada uma.

1. **`D34 · F4/T11` (fatia `emissao-e-conciliacao`) — o gatilho NÃO se cumpre, e precisa ser
   emendado.** O texto vigente é *"a fatia que trouxer a notícia recebida do provedor"*, e essa fatia
   é esta. Medido (§21.3 (3) do tech spec): a notícia **não fornece a chave de correlação** que falta
   para reconciliar o boleto órfão — ela traz o *Identificador perante o provedor* e o *Número do
   título no provedor*, e o que o órfão precisa é do identificador que a emissão usou **antes** de a
   chamada partir. A notícia dá **observabilidade** ao órfão; reconciliar segue sem caminho.
   **Recomendação**: emendar o `QUANDO FECHA` para *"a fatia que persistir o identificador perante o
   provedor **antes** da chamada de emissão"*, preservando o texto original. A medição já está
   escriturada como `D18` da §2 desta fatia.
2. **`D63 · F4/fechamento` — divergência HISTÓRICA de contagem, e não se corrige retroativamente.**
   O marcador falava em *"`pedir` em 24 de 24 suítes"*; medido em 2026-08-18 sobre
   `apps/api/test/*.ts`, `pedir` estava declarado em **30** arquivos, `entrar` em 28, `conceder` em 12
   e `credencialDeSessao` em 7. O débito foi **fechado pela T6** (a casa
   `apps/api/test/acessorios-de-borda.ts`), de modo que o marcador já não existe e a divergência é
   registro do passado. **Recomendação: não "corrigir" o número retroativamente** — relatório de
   fatia fechada é registro histórico e não se reescreve; a medição nova já está no docblock da casa
   nova, que é onde o próximo leitor a encontra.

**A reconciliação do índice fechou nas DUAS pontas, medida com multiplicidade.** 29 marcadores
canônicos vivos (excluído o `D99 · F7/T3`, que é **dado de fixture** de
`packages/shared/test/protocolo-antirregressao.spec.ts` e nunca entra no índice) contra 29 linhas do
bloco do `CLAUDE.md`; nenhum marcador órfão, nenhuma linha órfã, e todo campo `ÍNDICE` apontando para
um `### D{n}` existente na §2 que ele nomeia. ⚠️ **A comparação tem de ser com multiplicidade**: os
**dois `D13 · F4/T6`** repetem o par inteiro (fatias `emissao-e-conciliacao` e `webhook-e-carne`), e
uma reconciliação por conjunto simples devolve 28 de cada lado e conclui falsamente que há órfão.

**Movimento do índice na fatia, conferido**: saíram `D5 · F3/T7` (T10), `D14 · F4/T6` (T2),
`D63 · F4/fechamento` (T6) e `D38 · F4/T10` (T12); entraram `D17 · F4/T7`, `D13 · F4/T6` e
`D27 · F4/T11`; `D58 · F4/T16` e `D52 · F4/T16` foram **atualizados na T8 e permanecem**.

### Duas outras linhas do `CLAUDE.md` estão vencidas — MEDIDAS na T12, e deliberadamente NÃO alteradas

Registro com número, para que a próxima intervenção não as remeça:

- **Contagem da suíte.** A linha da §*Estado atual* diz *"1640 casos"*, medidos na T2 desta fatia.
  Medido pacote a pacote no fecho da T12 (P5 do Protocolo Antirregressão): **1710** — `contracts` 398 ·
  `api` **349** · `shared` 249 · `db` **225** · `documentos` **158** · `worker` **122** · `auth` 89 ·
  `cobranca-bancaria` **90** · `regua` 30.
- **Superfície publicada.** A mesma seção diz *"99 rotas / 84 manipuladores"*, medidos no fecho da
  fatia (ii). Esta fatia publicou **duas** rotas novas (a entrada da notícia e o carnê), de modo que o
  número está vencido.

**Por que não foram corrigidas aqui, e a decisão é deliberada** (A1 da `autonomia-do-run.md`): ao
contrário da linha das ADRs — que o próprio §4 acima atribui à **T12** por escrito —, nenhuma das duas
foi atribuída a esta task, e a §5.2 dela declara a modificação do `CLAUDE.md` como *"reconciliação do
bloco de débitos"*. Corrigir a contagem da suíte **sem** a da superfície produziria a mesma meia-verdade
que se quer evitar, e a da superfície exige a **dupla medição independente do `CT-937`**, que é trabalho
de fecho de fatia e não está na lista de arquivos desta task. **Recomendação: fechar as duas juntas na
revisão de fecho da fatia**, com a dupla medição rodada.

### A divergência do inventário de ADRs no `CLAUDE.md` foi corrigida na T12

A nota acima registrava que a tabela de leitura obrigatória afirmava *"33 registradas, 26
`accepted`"* e nomeava a **T12 como dono natural**. Medido em 2026-08-19: são **35 registradas e 28
`accepted`** — a `0034` e a `0035` nasceram nesta fatia e não constavam da linha nem da enumeração.
Os dois números e a enumeração foram corrigidos no mesmo diff, com a data da medição escrita ao lado.
O `CLAUDE.md` está na §5.2 desta task, e a linha chega a **todo** agente antes de qualquer arquivo do
repositório — deixá-la errada no fecho da fatia que criou as duas ADRs seria a mesma classe de mentira
que o índice de débito existe para não ter.

---

## ▶️ Retomada — 2026-08-19 (sessão 3), com 9/12 concluídas

O run foi retomado depois de duas pausas **a pedido explícito do usuário** (cláusula 2 da §A3 da
`.claude/rules/autonomia-do-run.md`). A segunda parou com a T9 `Em Progresso` e o Gate 1 já aprovado;
a retomada aplicou a opção **(a) retomar nos gates** do fluxo de *resume pós-interrupção*, despachando
apenas o Gate 2 — reexecutar do zero descartaria cinco rodadas de correção e as medições que as sustentam.

| | |
|---|---|
| **Concluídas** | T1 · T2 · T3 · T4 · T5 · T6 · T7 · T8 · **T9** |
| **A Fazer** | T10 (o carnê) · T11 (a borda externa) · T12 (fecho) |
| **Suíte** | **1695** verdes nos 9 pacotes |
| **Git** | tudo `staged`, **nada commitado** — o pipeline nunca commita, a decisão é do usuário |

### O que as três tasks restantes precisam saber

1. **A T10 sobe a âncora de superfície de 100/85 para 101/86** (`CT-1004`) — é a segunda e **última**
   subida da fatia, e a asserção estática exige **prova de falsificação executada**.
2. **A T10 fecha o D5 · F3/T7**: `extrairTextoDePdf` desce para `apps/api/test/documento.ts`, o marcador
   sai e a linha sai do `CLAUDE.md`.
3. **O D38 · F4/T10 está com o gatilho VENCIDO** e o dono natural é a T12, que o fecha.
4. **A T11 é a primeira publicação do produto para fora** e se prova **por medição** — o verificador
   afirma que nenhum outro caminho responde e que o vhost da operação não foi tocado.

---

## 7. Intervenção dirigida de 2026-08-19 — a quinta, e o que ela mediu

> **Fora do pipeline**, no molde das quatro anteriores (2026-08-09, 2026-08-10, 2026-08-12 e
> 2026-08-16). Pedida pelo usuário depois de um parecer sobre rodar `/agent-spec-debt-resolution`
> sobre o estoque inteiro. Duas frentes, executadas em sequência: a **higienização da §2 das treze
> fatias** e uma **lista curta de onze débitos de consequência**.

### 7.1 O parecer sobre a skill — NÃO pela quinta vez, com um argumento que ninguém tinha medido

O parecer da §6.1 do `run-report.md` da `fundacao-bancaria` é **reafirmado**, e ganha a razão que
faltava — a mais decisiva das cinco, porque não é sobre custo, e sim sobre **correção**:

**`references/debt-collection.md` declara que *"a §2 já contém apenas débito não resolvido — não
precisa de filtro de já-resolvido"*. Isso é FALSO nesta base, e o desvio foi medido: 39 dos 499
blocos registravam o fecho apenas no campo `Status:` do corpo**, com o cabeçalho
`### Dnn · sev · cat · Tn · Gate` idêntico ao de um débito aberto. A skill os recolheria como
abertos e geraria 39 tasks mandando um executor "corrigir" o que já está corrigido — o cenário
exato da regressão **R3**, que nem compilador, nem suíte, nem gate pegam.

Provado com um caso, e não por argumento: o `D1` e o `D2` de `contratos-de-locacao` mandam instalar
`CONDICOES_DE_RECUSA` e os seis pares `(dia, ano)` em `verificar-golden.sh`. Os dois **já estão no
código** (`:951` e `:1108`), pagos na intervenção de 2026-08-09 com mutante discriminante. Uma task
de cleanup mandaria reescrever exatamente a prova de falsificação que aquele mutante custou.

As demais medições desta rodada, todas novas:

| Medida | Valor |
|---|---|
| Blocos na §2 / fechados / **abertos** | 499 / 127 / **372** |
| Débitos que casam Critical Path por **glob textual** (o Gate 2 ligaria) | **35 de 383 (9%)** |
| …e por leitura **semântica** generosa de pt-BR | 94 (25%) — logo, **75% rodariam sem Gate 2** |
| Débitos anotados **pelo Tech Review** (quem não conferiria o pagamento) | 192 de 499 |
| **Não pagáveis hoje**, por razão registrada no próprio débito | **138** |
| Fechos por **intervenção dirigida** / pela **skill** | **45** / 20 — e os 20 são todos do repositório Frappe antigo, com suíte de 113–169 testes |
| Custo de uma execução de suíte (medido, 9 pacotes) | **428 s** — com P1+P5+Gate 1, ~21 min por task |

### 7.2 Frente 1 — higienização da §2 (as duas pontas passam a concordar)

Os **39** blocos cujo fecho vivia só no corpo tiveram a marca promovida ao cabeçalho. **Dois deles
não eram fechos**: o `D12` e o `D22` de `autorizacao-e-ciclo-de-acesso` estão 🟡 **parciais**, e
receberam a marca correta em vez de `RESOLVIDO` — promover um parcial como pago seria trocar um
erro de leitura por outro.

### 7.3 Frente 2 — os onze débitos, e o que a medição fez com cada um

**Sete pagos por inteiro:**

| Débito | O que fechou | Prova |
|---|---|---|
| **D8 · F4/T5** (esta fatia) | nasceu `packages/documentos/test/pdf.ts`, a casa comum do diretório; as duas suítes do pacote passaram a importá-la (−116 linhas) | `CT-1002 (h)`; `@sysloc/documentos` 158 → **159** |
| **D18 · F4/T7** (esta fatia) | o `QUANDO FECHA` do D34 foi **emendado** (original preservado), e a linha do índice acompanhou | a medição da própria T7, citada no marcador |
| **D29 · F4/T11** (esta fatia) | a borda efêmera passa a escutar **só em laço local**, e uma guarda o afirma sobre o **arquivo rendido** | `bash -n` limpo; `shellcheck` sem achado novo |
| **D30 · F4/T11** (esta fatia) | o `location` declara qual dos dois cabeçalhos de origem é confiável, e **por que não se mexe agora** | nenhum `proxy_set_header` alterado |
| **D31 · F4/T9** (`emissao-e-conciliacao`) | a fronteira **léxica** da guarda de boletos, com a razão de `realpath` ter sido descartado | `@sysloc/cobranca-bancaria` **90** |
| **D53 · F4/T16** (`emissao-e-conciliacao`) | nota de fronteira na **ADR-0032** (sem tocar a `Decision`) + o marcador que faltava, junto de `redigirErro` | `@sysloc/shared` **249**; desenho de `log.ts` **inalterado** |
| **D10 · F1/T3** (`fundacao-multitenancy-identidade`) | o `CT-014` ganhou o **segundo eixo**: quem **escreve** `app.empresa_id`, por igualdade de conjunto | `CT-014 (b)` + falsificação com controle **negativo** (leitura não casa) e positivo; `@sysloc/db` 225 → **227** |

**Um já estava pago, e o que faltava era a escrituração:** o **D38 · F4/T10** foi fechado pela
**T12 desta fatia** (`CT-1008`/`CT-1009`, com o eixo do não-eco), e o marcador saiu do fonte na
mesma ocasião. Verificado por leitura antes de escriturar.

**Três NÃO foram executados como pedido, e em todos a razão é medição, não falta de tempo.** Nos
três, a conduta seguiu a §3 da `.claude/rules/autonomia-do-run.md`: reconhecer o conflito, nomear a
recomendada com a razão, **não esperar**, e adotar a **conservadora**.

- **D23 · F0/T3** — extrair `redacao.ts` **moveria código sob duas `DECISÃO FECHADA`**, e a §3.2 do
  Protocolo proíbe literalmente (*"não altere, não MOVA…"*). Nenhum dos dois `REVERTER EXIGE` se
  demonstra — um deles pede **nova decisão do usuário**. Pago com o marcador que declara que o
  débito **não** espera disponibilidade, e sim uma de duas condições nomeadas.
- **D9 · F0/T2** — o esqueleto de asserções está em **10** verificadores (não 4, não 7), e o achado
  que muda a natureza do débito é que **as 10 cópias são 10 formas DISTINTAS**, de 35 a 63 linhas,
  nenhum md5 repetido. Só **2 dos 10** rodam sem privilégio: as outras 8 conversões ficariam sem a
  baseline que o P1/P5 exige. Pago com o marcador que carrega a medição e manda fechar **com a
  janela assistida agendada**.
- **D28 · F0/T5** — são **41 arquivos, 127 ocorrências e 6 `tsconfig`** (contra 3 e ~20). E a
  correção prometida **não entrega o ganho**: declarar `"./test"` sobre `dist/` exige emitir `test/`,
  o que `packages/shared/tsconfig.test.json` rejeita por escrito e quebraria os cenários de
  subprocesso; sobre fonte cru, o `rootDir` alargado **permanece**. Marcador canônico emendado com a
  medição, a colisão e a advertência: **não comece pela conversão dos 41 arquivos**.

### 7.4 O achado de método — desta vez o inverso do de 2026-08-16

A §6.3 da `fundacao-bancaria` registrou que *"a frase que explica por que algo não pode ser feito
envelhece mais rápido que o débito que ela justifica"*. Esta rodada encontrou a **forma inversa, e
ela é mais cara**: **a frase que explica COMO algo deve ser feito também envelhece** — e envelhece
sem alarme, porque ninguém a relê antes de executá-la.

Três dos onze traziam prescrição que a medição refutou: o `D8` mandava marcar um débito **já
fechado**; o `D28` promete um ganho que a solução proposta **não produz**; o `D9` prescreve extrair
um esqueleto que **não é um só**. Nos três, seguir o `O que fazer` ao pé da letra teria produzido
trabalho errado — e nos três o custo de descobrir foi um comando. **A lição operacional: o campo
`O que fazer` de um débito é hipótese datada, exatamente como a prescrição de gate — meça a
premissa antes de executá-la.** É o mesmo precedente que o `CLAUDE.md` já registra para gate,
agora estendido ao débito.

### 7.5 Nota de baseline (P1) — o que já estava vermelho

`deploy/scripts/instalacao/verificar-workspace.sh` foi executado neste host e **reprova com 5
falhas** — o mesmo número que a §4 deste relatório já anotava, medido três vezes durante o run.
Estado **pré-existente**, não tocado por esta intervenção, e registrado porque o P1 manda: é
informação, não obstáculo.

⚠️ **Fechado em 2026-08-20**, em intervenção seguinte: o verificador roda **4/4 aprovados**. A causa
não era envelhecimento — três das cinco falhas eram **linhas de inventário que quatro fatias
deixaram de escrever** (o contrato está no docblock de `MEMBROS_DO_WORKSPACE`), uma era **timeout**
(`LIMITE_PNPM_TEST=120` contra 428 s de suíte) e uma era diagnóstico de lint real. Detalhe na §2 do
`run-report.md` da `fundacao-stack-nativa`, no `D9`.
