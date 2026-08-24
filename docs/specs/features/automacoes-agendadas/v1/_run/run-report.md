# Relatório do Run — automacoes-agendadas/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining)
> vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **11/11 tasks concluídas** · as cinco fases encerradas · suítes medidas **por pacote**
(`turbo run test` aborta os irmãos e a saída agregada não é confiável).

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Roster publicado das rotinas em `@sysloc/contracts` | opus | 1 criado, 2 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T2 | As duas filas novas e as duas cargas em `@sysloc/shared` | opus | 0 criados, 5 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Tabela `negocio.execucao_de_rotina` + migrações 0026/0027 | opus | 3 criados, 11 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES (convergência) |
| T4 | `execucao-de-rotina.ts`: gravação, leitura derivada e expurgo | opus → opus[xhigh] | 6 criados, 9 mod | ✅ APROVADO | ✅ APROVADO |
| T5 | `encerrarContratosVencidos`: transição pareada numa unidade | opus | 2 criados, 5 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T6 | Consumidor único das quatro rotinas por empresa | opus → opus[xhigh] | 3 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO |
| T7 | Manutenção do acervo (fecha `D26 · F4/T9`) | opus | 2 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES (2 passagens) |
| T8 | Despachante efêmero e as leituras sem contexto (fecha `D13 · F4/T6`) | opus → opus[xhigh] | 2 criados, 7 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO |
| T9 | As 13 unidades systemd, o instalador e a asserção estática | opus → opus[xhigh] | 14 criados, 4 mod | ✅ APROVADO_COM_OBSERVACOES (3 rodadas) | ✅ APROVADO (2 passagens) |
| T10 | `GET …/rotinas` e a âncora de superfície | opus → opus[xhigh] | 1 criado, 6 mod | ✅ APROVADO (3 rodadas) | ✅ APROVADO_COM_OBSERVACOES |
| T11 | Rede antirregressão da RN-14 e a escrituração das duas pontas | opus | 0 criados, 7 mod | ✅ APROVADO (2 rodadas) | ✅ APROVADO (2 passagens) |

**Suíte ao fim da fatia: 1943 casos** — `contracts` 438 · `api` 394 · `shared` 271 · `db` 268 ·
`worker` 180 · `documentos` 159 · `cobranca-bancaria` 114 · `auth` 89 · `regua` 30. Eram **1842** na
abertura do run.

**Superfície: 106 rotas / 91 manipuladores**, `publicas` em 20 e `semDeclaracao` vazio — remedido do
zero na T10 pelas duas medições independentes. ⚠️ `GET /v1/automacao-de-cobranca/rotinas` é a
**última rota que este repositório publica**; o congelamento é logo depois desta fatia.

**Rodadas por task**: T1 em 2 · T2 em 1 · T3 em 3 (convergência) · T4 em 3 · T5 em 1 · T6 em 4 ·
T7 em 2 · T8 em 2 · T9 em 3 · T10 em 3 · T11 em 1.

**Débitos de outras fatias que mudaram de estado**: fecharam o `D25 · F4/T7` (`fundacao-bancaria`),
o `D26 · F4/T9` (`emissao-e-conciliacao`, pela T7), o `D13 · F4/T6` (`webhook-e-carne`, pela T8) e o
`D3 · F5/T2` (pela T9). O `D21 · F4/T9` **melhorou** na T4 (a casa do arranjo nasceu), **piorou** na
T6 (quarta cópia, por fronteira estrutural `dist`/fonte) e teve o **gatilho emendado** na T11, com o
texto original preservado byte a byte. O `D44 · F2/T10` foi **agravado** pela T5 — ver `D24`.

**Débitos novos com marcador emitidos nesta fatia**: `D5 · F5/T3`, `D11 · F5/T6`, `D12 · F5/T6`,
`D15 · F5/T7`, `D16 · F5/T8` e `D17 · F5/T8`. O índice do `CLAUDE.md` fecha em **41 marcadores = 41
linhas**, bijeção conferida nas duas direções pela T11 e refeita de forma independente pelo Gate 1.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer
> categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com
> `/agent-spec-debt-resolution docs/specs/features/automacoes-agendadas/v1/`.

### D1 · baixo · documentation · T2 · QA
- **Onde:** `packages/shared/src/fila.ts:90`
- **Problema:** a citação *"terceira emenda da ADR-0024"* nomeia uma emenda que a ADR não tem.
- **Impacto:** a ADR-0024 tem **duas** emendas (2026-08-13 e 2026-08-18); a de 2026-08-18 é a
  **segunda** dela, e a **terceira ocorrência da classe** no repositório — a frase conflata as duas
  contagens. A substância citada foi conferida e está literal na ADR; o defeito é só o ordinal. Quem
  abrir a ADR procurando a "terceira emenda" não a encontra, e pode concluir que o docblock cita texto
  morto. ⚠️ A imprecisão é **pré-existente**: das quatro ocorrências em `fila.ts` (linhas 62, 90, 382,
  424), três antecedem esta task.
- **O que fazer:** **não** corrigir em task de escopo estreito — o menor delta deixaria o arquivo com
  duas nomenclaturas concorrentes. Intervenção dirigida que troque *"terceira emenda da ADR-0024"* por
  *"emenda de 2026-08-18 da ADR-0024"* nas quatro ocorrências num diff só, varrendo antes o repositório
  por `grep -rn "terceira emenda" --exclude-dir=dist apps packages docs`.

### D2 · MEDIO · project_pattern · T2 · Tech Review
- **Onde:** `packages/shared/test/fila.spec.ts:234` (uso na 849)
- **Problema:** a lista paralela `NOMES_DE_FILA_DO_PRODUTO` não tem âncora de completude — a igualdade
  fechada só alcança a lista de símbolos irmã.
- **Impacto:** `SIMBOLOS_DE_NOME_DE_FILA` é ancorada por igualdade contra o barril, com controle
  antivácuo; `NOMES_DE_FILA_DO_PRODUTO` só aparece numa asserção auto-referente
  (`new Set(x).size === x.length`), verdadeira para **qualquer** subconjunto. Publicada uma décima fila,
  nada obriga a acrescentá-la à segunda lista — e a fila cujo **valor** colidisse com o de uma existente
  passaria pela suíte. É literalmente o modo de falha que o docblock do próprio arquivo descreve para
  justificar a igualdade instalada na lista irmã: o defeito foi fechado pela metade.
- **O que fazer:** uma linha junto da 849 — `expect(NOMES_DE_FILA_DO_PRODUTO.length).toBe(SIMBOLOS_DE_NOME_DE_FILA.length);`
  — que amarra a lista de valores à de símbolos, já amarrada ao barril. Alternativa mais forte: derivar
  `NOMES_DE_FILA_DO_PRODUTO` de um `Record<typeof SIMBOLOS_DE_NOME_DE_FILA[number], string>` exaustivo,
  no molde do `Record<RotinaDeTrabalho, true>` que o próprio arquivo já usa, onde a exaustividade é
  cobrada pelo compilador.

### D3 · BAIXO · code_quality · T2 · Tech Review
- **Onde:** `packages/db/test/cobranca.spec.ts:461`
- **Problema:** o docblock de `UNIDADES_DECLARADAS` mantém uma razão que a justificativa acrescentada
  60 linhas abaixo, no mesmo diff, torna imprecisa.
- **Impacto:** ele afirma *"um agendamento novo seria a forma de reintroduzi-lo"*, enquanto a nova
  estabelece o discriminador correto — *"a distinção tem de ser feita sobre o que cada uma **escreve** —
  nunca sobre quem a dispara"*. As duas convivem sem contradizer fato algum hoje (não há `.timer` no
  repositório), mas a primeira prescreve um critério que a segunda refuta e que a **T9 vai exercer** ao
  instalar os seis timers. Risco concreto: rodada perdida na T9, com o executor concluindo que precisa
  escalar conflito com a ADR-0022 quando a resposta já está escrita no mesmo arquivo.
- **O que fazer:** **na T9**, ao acrescentar os `.timer` a `UNIDADES_DECLARADAS`, substituir a frase pelo
  discriminador vigente — o que a ADR-0022 proíbe é a rotina ser **dona do estado publicado de um fato
  financeiro**; o disparo por relógio é neutro. Não antecipar: a asserção segue verdadeira e o escopo é
  da T9.

### D4 · baixo · documentation · T3 · QA — ✅ **RESOLVIDO** na rodada 2 da T3 (2026-08-22)
- **Onde:** `CLAUDE.md:95`
- **Problema:** a escrituração da contagem da suíte ficou para trás (`db` 237 → 238).
- **Impacto:** a linha declara `db` **237** e o total **1842**, os dois defasados em 1. O próprio
  `CLAUDE.md` adverte que *"número narrativo que fica para trás convida a próxima task a corrigir a
  contagem para o valor errado"*, e já registra três episódios dessa exata classe. A omissão foi decisão
  A1 legítima do executor — arquivo de alta contenção, com três executores paralelos na mesma fatia.
- **O que fazer:** ~~no fecho do lote ou da fatia~~ — **feito**, e refeito na rodada 3 com os três
  deltas da Fase 1 já finais e MEDIDOS um a um: `contracts` **425 → 438** (T1), `shared` **263 → 267**
  (T2) e `db` **237 → 238** (T3, delta de um caso: o `CT-1073`). ⚠️ **O total é 1860** — conferido
  somando os nove pacotes, e **não 1856**, que é o valor a que se chega esquecendo os 4 do `shared`.
  ⚠️ A escrituração ainda vai crescer com as tasks seguintes da fatia — quem escriturar de novo parte
  de **1860**.

### D5 · BAIXO · project_pattern · T3 · Tech Review
- **Onde:** `packages/db/drizzle.config.ts` (junto de `out: './migracoes'`) — marcador
  `DÉBITO COM GATILHO — D5 · F5/T3`
- **Problema:** a saída de `drizzle-kit generate` tem **duas** classes de intervenção manual
  obrigatória, e nenhuma é automatizada: a supressão dos dois `CREATE SCHEMA` (já registrada desde a
  `0019`) e, agora, a supressão do **delta de migração autoral** que alterou estrutura declarada no
  Drizzle e por isso não deixou snapshot em `meta/`.
- **Impacto:** medido na T3 — a `0025_estado_ternario_da_entrega.sql` é a primeira autoral do produto
  a alterar estrutura declarada, e a `0026` reemitiu as **cinco** instruções dela. Mantê-las aborta a
  aplicação com `42701` (*column already exists*) e derruba a suíte inteira via `banco-efemero.ts`.
  ⚠️ **As duas correções intuitivas são erradas, e uma é destrutiva**: editar a `0025` — ⚠️ **a premissa de que ela estava APLICADA era falsa até 2026-08-23**, e foi refutada
  pelo `CT-031` do `verificar-migracao`, que mediu o banco durável e não encontrou
  `negocio.entrega_da_noticia`. O banco estava na `0022`, cinco migrações atrás do journal. As
  cinco foram aplicadas em 2026-08-23 e a bateria passou a sair 2/2 (118 OK, 0 FALHA), de modo que a
  frase virou verdadeira **depois** de ser escrita. A proibição de editar segue valendo, e agora
  pela razão que ela alegava: a `0025` está registrada com `sha256` em `identidade.migracao_aplicada` ou regerar
  a `0026` clobberando a supressão. O **caminho incremental já está fechado** pelo
  `meta/0026_snapshot.json` (medido: `prevId` dele = `id` de `meta/0023_snapshot.json`, já com o
  estado pós-`0025`); o que continua aberto é a **geração DO ZERO**.
- **O que fazer:** nada agora — o docblock de `drizzle.config.ts` (seção *"A SEGUNDA classe de
  intervenção manual: o delta da migração AUTORAL reemitido"*) e o cabeçalho da `0026` já separam
  incremental de do-zero e dizem qual é a correção certa. **Fecha quando** a próxima migração autoral
  alterar estrutura declarada em `src/esquema/*.ts`, **ou** numa regeração do zero (`meta/`
  descartado): nos dois casos a supressão é refeita à mão e o marcador é revisitado. Automatizar
  exigiria o `drizzle-kit` aceitar snapshot escrito por migração autoral — comportamento dele, não
  deste repositório.
- ⚠️ **RECORRENTE — o gatilho NÃO extingue o débito.** Refeita a supressão, a obrigação volta idêntica
  na regeração seguinte, porque a causa está no `drizzle-kit` (snapshot só nasce em migração gerada) e
  não neste repositório. **Cumprir o gatilho não autoriza remover o marcador nem a linha do índice do
  `CLAUDE.md`** — o que ele pede é reler o docblock de `drizzle.config.ts` antes de aceitar a saída do
  gerador. A §3-B canoniza o ciclo *"sai quando o gatilho chegar e o débito for fechado"*, e este é dos
  que **não fecham assim**: mesma leitura das linhas `D28 · F0/T5`, `D20 · F3/T7` e `D51 · F4/T16` do
  índice. Ele só sai se a causa sumir — o `drizzle-kit` passar a registrar snapshot de migração
  autoral, ou o produto deixar de escrever migração autoral que altere estrutura declarada.


### D6 · BAIXO · project_pattern · T1 · Tech Review
- **Onde:** `packages/contracts/src/automacao-de-cobranca.ts:161` (`EXPRESSAO_DA_HORA_DO_DIA`)
- **Problema:** o molde `HH:MM` chegou ao terceiro consumidor sem subir para casa compartilhada — o
  Limiar de Três executou meia prescrição.
- **Impacto:** o executor evitou a terceira **cópia literal** (usou `z.iso.time({ precision: -1 })`, e o
  Tech Review **mediu** que ele publica `^(?:[01]\d|2[0-3]):[0-5]\d$`, idêntico ao regex irmão), mas as
  duas cópias existentes — `EXPRESSAO_DA_HORA_DO_DIA` e `MOLDE_DA_HORA_DO_DIA` em
  `packages/db/test/envio-de-cobranca.spec.ts:279` — seguem livres para divergir, e o pacote passa a
  expressar o mesmo fato do contrato por **dois mecanismos**. Baixo e diferido: hoje concordam por
  medição; o risco é divergência silenciosa numa subida de versão do Zod, ou a próxima hora publicada
  nascer numa quarta forma por não achar dono.
- **O que fazer:** ⚠️ **o Limiar de Três NÃO disparou** — o Tech Review da rodada 2 mediu que há **duas**
  declarações executáveis em produção, e o gatilho é o **terceiro** consumidor. Por isso o marcador
  `DÉBITO COM GATILHO` **não** foi registrado, e essa ausência está correta pela própria §3-B (*"só para
  débito com gatilho concreto"*). Quando o quarto consumidor chegar, ou na primeira alteração da forma
  publicada da hora, mover `esquemaDaHoraDoDia()` para `packages/contracts/src/comum.ts` — a casa
  compartilhada que `camposDeEndereco()` e `envelopeDeLista()` já ocupam.

### D7 · BAIXO · scope_deviation · T3 · Tech Review
- **Onde:** `docs/specs/features/automacoes-agendadas/v1/tasks/T3.md` (§5.1/§5.2)
- **Problema:** três arquivos obrigatórios ficaram fora do escopo declarado — `packages/db/test/papel-de-conexao.spec.ts`,
  `deploy/scripts/instalacao/verificar-migracao.sh` e `packages/db/migracoes/meta/0026_snapshot.json`.
- **Impacto:** **nulo nesta instância** — os três foram tocados e a igualdade de conjunto preservada em
  todos; os dois gates concordaram que o executor fez o certo e declarou os três. O defeito é do
  **registro de escopo**, e é literalmente o exemplo ❌ da `.claude/rules/ancoras-de-superficie.md`.
  Residual: o `verificar-migracao.sh` **não é exercido pela suíte Vitest** (é verificador shell de
  instalação), de modo que, esquecido, a divergência ficaria silenciosa até uma execução real. Foi o
  cuidado do executor, e não a spec, que cobriu esse eixo.
- **O que fazer:** ao gerar a §5.2 de task que faz nascer tabela em `negocio`, **derivar o roster por
  busca** sobre a tabela irmã mais recente (`grep -rln 'entrega_da_noticia' packages/db/test deploy/scripts`)
  em vez de listar só o esquema, as migrações e as suítes óbvias — o roster completo aparece em **5**
  arquivos-âncora, não em 3.

### D8 · BAIXO · testability · T3 · Tech Review
- **Onde:** `packages/db/src/esquema/negocio.ts` (docblock de `rotinaAgendada`)
- **Problema:** o conjunto dos **três rótulos** do enum `negocio.rotina_agendada` é publicado sem âncora
  de igualdade no mesmo diff — a prova está alocada ao `CT-1070`, da **T4**.
- **Impacto:** o **símbolo** tem âncora aqui (`SIMBOLOS_ESPERADOS`), mas o **conjunto dos rótulos** não:
  nenhuma asserção do diff lê `pg_enum`. Os dois gates mediram e confirmaram que **nada** ancora conjunto
  nem ordem deste enum hoje. E a **ordem é conteúdo** num enum do PostgreSQL — `enumsortorder` governa
  comparação e `ORDER BY` —, de modo que **reordenar os rótulos muda semântica de consulta com a suíte
  verde**. A janela do conjunto fecha quando a T4 aterrissar; a da **ordem não fecha**, porque o
  `CT-1070` afirma **igualdade de conjunto**, que é invariante sob reordenação.
- **O que fazer:** o vínculo escrito **já existe** no docblock e nomeia o vão em vez de o esconder — foi
  a mitigação acordada, e ela custou duas rodadas para ficar honesta. Não duplicar o `CT-1070`. Se a
  ordem precisar de rede, escrever âncora nova no molde já presente na base
  (`array_agg(e.enumlabel ORDER BY e.enumsortorder)`, como em `coerencia-de-migracoes.spec.ts` e
  `catalogo-de-plataforma.spec.ts`) — mas note que **nenhuma das duas alcança este enum**, as duas
  filtram `typname` nominalmente.

### Pagos no percurso, e registrados para o histórico não os reabrir

Quatro achados de gate **não** viraram débito porque foram fechados dentro do run, e um deles apesar de
convertido pela convergência:

- **T3 · TR rodada 2 · P2** — o ponteiro `src/../drizzle.config.ts` na `0026`, que não resolvia de lugar
  nenhum. Fechado **dentro da janela**: o `migrar-banco.sh` calcula `sha256sum` sobre o arquivo inteiro,
  comentário incluído, e depois de aplicada a migração o ponteiro ficaria congelado.
- **T3 · TR rodada 2 · P3** — o `QUANDO FECHA` do `D5` nomeava evento **recorrente**, deixando o marcador
  permanente por construção sem o dizer. Fechado com `⚠️ RECORRENTE` nas **três** pontas.
- **T3 · TR rodada 2 · P4** — a escrituração do `CLAUDE.md` caracterizava a T2 como pendente estando
  concluída. Fechado consolidando os três deltas.
- **T3 · TR rodada 3 · P1** — a coordenada da citação apontava `§6.4` onde o texto está em `§6.2`, e o
  destino errado contém uma linha **homônima do mesmo CT**. **Convertido em débito pela Convergência**
  (rodada 3, `MEDIO`/`testability`, `fingerprint` inédito) e **ainda assim pago no fecho**, porque a
  correção era de um caractere, com risco nulo, num artefato cuja única função é ser auditável.


### D9 · BAIXO · project_pattern · T4 · Tech Review
- **Onde:** `docs/specs/features/automacoes-agendadas/v1/tasks/T4.md` (§5.2)
- **Problema:** a §5.2 declara **um** arquivo a modificar e a entrega tocou **sete**.
- **Impacto:** **não é `scope_deviation`**, e os dois gates concordaram: a §7 da própria task manda medir
  os três débitos e, se dispararem, fechá-los no mesmo commit — o que torna cinco deles **entrega
  mandatada**; e as duas âncoras de igualdade são o caso que a `.claude/rules/ancoras-de-superficie.md`
  atribui **à spec** por escrito. O custo já foi pago: os dois gates gastaram uma passagem cada decidindo
  se houve alargamento de escopo, que é exatamente o que a rule existe para evitar.
- **O que fazer:** nada retroativo. Nas tasks seguintes (T5, T6, T10), **derivar a §5.2 por busca** antes
  de escrevê-la — as âncoras de igualdade que a publicação faz crescer, e os arquivos de qualquer débito
  que a §7 mande medir.

### D10 · baixo · documentation · T4 · QA
- **Onde:** `packages/db/test/certificado-do-provedor.spec.ts:424` e `:1067`
- **Problema:** o fecho do `D25` deixou duas menções em **prosa** que descrevem o débito como aberto.
- **Impacto:** elas afirmam *"o fuso já tem três declarações executáveis no pacote"* — depois do fecho são
  **duas**. ⚠️ **A barreira executável NÃO quebra**, e o QA verificou por quê: o `PADRAO_DE_MARCADOR` de
  `packages/shared/test/protocolo-antirregressao.spec.ts:146` exige o par completo `D\d+ · F\d+/…`, e as
  duas menções param em `D25`. A prosa era **verdadeira** antes desta fatia e passou a ser falsa por causa
  dela — é o modo de falha que a §3-B nomeia (*"ele mente sobre o estado do código, e o próximo agente
  gasta uma rodada reabrindo o que já estava fechado"*).
- **O que fazer:** na primeira task autorizada a abrir `packages/db/test/certificado-do-provedor.spec.ts`
  por outra razão — **o mesmo gatilho já registrado** no docblock de `packages/db/test/relogio-da-operacao.ts`
  para a migração do acessório homônimo —, atualizar as duas linhas: o `D25` fechou em 2026-08-23, o fuso
  tem casa única em `packages/db/src/fuso-da-operacao.ts`, e o que resta é o `D14`. **Não abrir o arquivo
  só para isto.**

### Pagos na T4, e registrados para o histórico não os reabrir

Quatro achados de gate da T4 **não** viraram débito porque foram fechados dentro do run:

- **`QA-ALTO-001`** — o `CT-1074 (d)` derivava `proximaEsperada` numa transação e verificava em outra;
  como `now()` é `transaction_timestamp()`, a borda do minuto podia reprovar **com o SUT íntegro**.
  Fechado eliminando a **fonte** (uma única `emUnidade`), e o caso **ganhou** controle antivácuo.
- **`QA-BAIXO-001` / `TR-P1`** — a derivação de `AVISOS_RECUSADOS_PELO_PROVEDOR` era o único dos três
  impedimentos sem cobertura. Aceito como débito na rodada 1 e **reaberto** pelo Gate 2 com severidade
  elevada, porque a **T6 consome esta derivação e vem antes da T10**, que era o destino do adiamento.
  Pago com **quatro** pernas — uma a mais que a prescrita, e o executor mostrou por quê.
- **`TR-P2`** — segunda declaração de *"vigente e não vencido"* sem rede. Pago pela **alternativa forte**
  (a borda do dia, que separa `>=` de `>`) em vez do marcador, e de quebra corrigiu um não-determinismo
  latente: o arranjo passou a ancorar a validade no **meio-dia do fuso da operação lido do banco**.
- **`TR-P3`** e **`TR-P5`** — a casa compartilhada de `emUnidade` e a ponta do índice do `D14`.


### D11 · BAIXO · project_pattern · T6 · Tech Review
- **Onde:** `apps/worker/test/acessorios-de-borda.ts` (marcador `DÉBITO COM GATILHO — D11 · F5/T6`)
- **Problema:** o acessório `emUnidade` tem **7 declarações locais** em `apps/worker/test/`; a casa
  compartilhada nasceu com **1** consumidor e as **6** restantes não foram migradas.
- **Impacto:** endurecer uma cópia deixa as outras seis para trás — o modo de falha que o Limiar de Três
  existe para fechar. ⚠️ O risco aqui é **concreto e já medido**: a resolução `dist/` × fonte é a armadilha
  que custou uma rodada nesta task, e cada cópia futura escrita por quem copiar de uma vizinha reabre a
  descoberta do zero. A casa nova declara `emUnidade` sobre a **fronteira publicada** (`contextoDeTenant`
  de `@sysloc/db`), com o docblock que **mede** por que o acessório de `packages/db/test/` não serve.
- **O que fazer:** migrar cada uma das seis irmãs **quando outra task abrir cada arquivo por outra razão**
  — nunca todas de uma vez (proibição 5 do Protocolo Antirregressão). O gatilho está escrito no marcador.

### D12 · ALTO (metade b, diferida) · architecture · T6 · Tech Review → **endereçado à T11**
- **Onde:** `packages/db/src/conferencia-bancaria.ts` (`abrirConferencia`) — **fora do escopo da T6**
- **Problema:** conferência abandonada por **esgotamento das repetições** fica irrecuperável.
- **Impacto:** a metade (a) do achado foi **fechada na T6** (a reentrada refaz a passada contra a
  conferência que a ativação anterior deixou aberta). O que resta é o caso em que **não há mais ativação**:
  sem ativação não há reentrada, a linha fica `concluida_em IS NULL` para sempre, e o índice único parcial
  `conferencia_bancaria_em_andamento_uidx` **não tem janela de obsolescência, timeout nem varredura de
  recolhimento**. Nesse estado, **nem o relógio nem a rota manual do Admin destravam** — a recuperação
  exige intervenção direta no banco.
- **O que fazer:** **na T11**, ou por decisão do usuário: janela de obsolescência em `abrirConferencia`
  (reabrir ou recolher a que está aberta há mais que um limiar) **ou** varredura de recolhimento na rotina
  de manutenção. A limitação está escrita por extenso no docblock de `conferirAsLiquidacoes`, apontando
  para a T11.
- **⚠️ O que a T11 fez, e por que NÃO implementou (decisão registrada, 2026-08-23):** a metade (b)
  **permanece aberta**, agora com a ponta que lhe faltava — um marcador `DÉBITO COM GATILHO — D12 ·
  F5/T6` junto de `abrirConferencia`, em `packages/db/src/conferencia-bancaria.ts`, mais a linha no
  índice do `CLAUDE.md`. Três razões medidas, e a terceira é a que decide:
  1. **o arquivo está fora da §5.2 da T11** (que declara três: a derivação, a suíte da cobrança e o
     `CLAUDE.md`), e a task não tem CA nem CT para comportamento novo de produção;
  2. **o remédio exige fixar um limiar de obsolescência**, que é decisão de produto — quanto tempo
     uma conferência em andamento pode ficar aberta antes de ser recolhida? —, e errá-lo troca um
     estado travado raro por uma conferência **recolhida no meio da passada**, que é pior;
  3. **a forma prescrita em primeiro lugar colide com desenho registrado por extenso**: o cabeçalho de
     `conferencia-bancaria.ts` declara que `abrirConferencia` *"não lê nada antes de inserir"*, com as
     três razões do `ON CONFLICT … DO NOTHING`. Uma janela de obsolescência ali é leitura-antes-de-gravar
     por outro nome. **A forma viável é a segunda** — varredura de recolhimento na rotina `MANUTENCAO`,
     que já corre por empresa —, e ela é fatia de trabalho, não linha de escrituração.
  ⚠️ **Isto é divergência declarada da prescrição da T11**, na forma que o `CLAUDE.md` registra como
  precedente: *prescrição de gate é hipótese, não ordem* — quem diverge, mede e registra.

### D13 · BAIXO · project_pattern · T6 · Tech Review — ✅ **RESOLVIDO na T11 (2026-08-23)**

> **Como fechou:** exatamente como o bloco prescrevia. O `QUANDO FECHA` do marcador em
> `apps/api/test/retomada-de-retidas.spec.ts` recebeu uma **emenda** — o texto original preservado
> byte a byte, na forma que as ADRs deste repositório usam —, declarando que `packages/db/test/`
> **não serve** como destino, com a razão medida (dois `AsyncLocalStorage`: o fonte contra o
> `dist/`), que `packages/shared/test/` também não serve (inverteria o grafo de dependências) e que
> o destino viável é um pacote de teste que consuma `@sysloc/db` **pelo barril**. O **gatilho não
> mudou**. A §2 da fatia `webhook-e-carne`, que o `ÍNDICE` do débito nomeia, acompanhou no mesmo
> diff.
- **Onde:** `apps/api/test/retomada-de-retidas.spec.ts:1126-1136` (o `QUANDO FECHA` do `D21 · F4/T9`)
- **Problema:** o marcador prescreve `packages/db/test/` como destino do arranjo, e **a medição da T6 o
  refutou**.
- **Impacto:** os acessórios de `packages/db/test/` resolvem `contextoDeTenant` pelo **fonte**
  (`unidade-sob-contexto.ts:43` → `../src/contexto.ts`), enquanto `apps/*/test/` resolvem `@sysloc/db` pela
  fronteira publicada, que `package.json` manda para `./dist/index.js` — **dois `AsyncLocalStorage`**, e
  toda escrita cai em violação de política de linha. O arranjo que o `D21` endereça é necessariamente **sob
  contexto**. A primeira task que tentar seguir a prescrição gastará uma rodada redescobrindo isso.
  ⚠️ É o corolário do `CLAUDE.md` acontecendo de novo — *a frase que explica **onde** algo deve ser feito
  envelheceu antes do débito que ela justifica*.
- **O que fazer:** **na T11**, emendar o `QUANDO FECHA` do marcador **preservando o texto original** (forma
  que as ADRs deste repositório já usam), registrando a razão medida e que o destino viável é um pacote de
  teste que consuma `@sysloc/db` **pelo barril**. ⚠️ `packages/shared/test/` **não serve** — `@sysloc/shared`
  não pode depender de `@sysloc/db` sem ciclo. A §2 da fatia `webhook-e-carne`, que o `ÍNDICE` do `D21`
  nomeia, acompanha no mesmo diff.


### D15 · BAIXO · project_pattern · T7 · Tech Review (rodada 2)

- **Onde:** `packages/cobranca-bancaria/src/guarda-de-boletos.ts` — marcador
  `DÉBITO COM GATILHO — D15 · F5/T7`, junto de `MILISSEGUNDOS_POR_DIA`
- **Problema:** a constante é a **terceira** declaração de produção do mesmo conceito, e **nasceu com
  nome divergente** (`MS_POR_DIA`). As duas anteriores — `packages/db/src/derivacao-de-contrato.ts` e
  `apps/api/src/integracoes-bancarias/certificado.service.ts` — já se chamavam
  `MILISSEGUNDOS_POR_DIA`, e já **divergiam entre si na forma do literal**: `24 * 60 * 60 * 1000`
  contra `86_400_000`. É o Limiar de Três no caso literal que a convenção do `CLAUDE.md` descreve.
- **Impacto:** baixo hoje (o valor é o mesmo nas três). O que o nome divergente destrói é o
  **mecanismo do gatilho**: o Limiar de Três pressupõe que quem duplica saiba contar as cópias, e um
  `grep` só as encontra juntas se elas se chamarem igual — a quarta nasceria sem que nada acusasse.
- **O que a T7 fez na rodada 2:** alinhou o nome ao já em uso, tornando as três detectáveis por **um**
  identificador, e registrou o débito nas **três pontas** (marcador, índice do `CLAUDE.md`, esta §2).
- **O que falta:** publicar em `@sysloc/shared` sob o mesmo nome. **Medido pelo Tech Review**: os três
  pacotes já declaram `@sysloc/shared` em `dependencies`, de modo que a subida **não acrescenta aresta
  ao grafo**.
- **Por que não agora:** publicar exige editar dois arquivos de produção **fora da lista** da T7 e
  rodar `@sysloc/api` e `@sysloc/db` inteiros numa rodada de **correção** declarada aditiva — a
  proibição 5 do Protocolo Antirregressão (*"nunca aproveitar que estou aqui"*) pesa contra, e a
  superfície de regressão seria desproporcional a um literal.
- ⚠️ **As TRÊS cópias em TESTE ficam fora do débito**, por decisão explícita do Gate 2: elas declaram
  o valor à mão de propósito (*"literal do caso, jamais importado do artefato sob prova"*), e
  importá-las do SUT poria expectativa e artefato sob a mesma autoria. **Não migrar nenhuma das três.**
  A enumeração é escrita **em função do mecanismo do gatilho**, que se aciona por
  `grep MILISSEGUNDOS_POR_DIA` — medido em 2026-08-23:
  - `packages/db/test/derivacao-de-contrato.spec.ts:667` — **homônima**, e a **única das três que
    aquele grep devolve**. É a que vai aparecer na tela de quem acionar o gatilho, e por isso é a que
    mais precisava estar nomeada aqui;
  - `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` e
    `apps/worker/test/manutencao-do-acervo.spec.ts` — declaram sob `MS_POR_DIA`, de modo que o grep do
    gatilho **não as devolve**. Ficam nomeadas para que a ausência delas na busca não seja lida como
    *"já foram migradas"*.
  > ⚠️ **A redação anterior dizia "as duas cópias em teste" e estava errada em duas frentes**: a
  > contagem, e — o que agrava — **quais**. Ela blindava por descrição exatamente as duas que o grep do
  > gatilho não devolve, e calava sobre a única que ele devolve: a proteção estava **invertida em
  > relação ao mecanismo que o débito existe para servir**. Achado do Gate 2 na rodada 2, medido.
  > **Não a reponha.**

### D14 · baixo · tests · T6 · QA — `smell: test_order_dependency`
- **Onde:** `apps/worker/test/rotina-agendada.spec.ts:941` (o `CT-1085 (c)`)
- **Problema:** o caso termina **deixando a apuração aberta** — é o que ele prova —, e isso quebra o
  `describe` **em ordem invertida**.
- **Impacto:** ⚠️ **Severidade rebaixada de propósito** (o catálogo dá `ALTO` ao AP-08), com três razões
  medidas **pelos dois gates**: (i) a ordem é **determinística** — `grep` por `shuffle|sequence` nos 10
  `vitest.config.ts` do monorepo não devolve nada —, e o `(c)` é o **último** do `describe`; (ii) o `(c)`
  **não depende** de caso anterior: semeia o próprio cenário e usa asserções **relativas** exatamente para
  não depender — o acoplamento é **unidirecional e futuro**; (iii) o acoplamento sobre a empresa da carga
  inicial é **pré-existente**, e o `CT-1085` original já passara por três rodadas de gate com ele.
  ⚠️ **A nuance que o Gate 2 acrescentou, e que é mais forte que "o teste reprova invertido"**: o que o
  `(c)` deixa é um **travamento**, não sobra de dado — um caso futuro sobre a `EMPRESA_A` naquele `describe`
  cairia no ramo do no-op e **poderia passar vazio**.
- **O que fazer:** fechar a apuração num **`onTestFinished` do próprio `(c)`, DEPOIS de todas as asserções**
  — preserva integralmente o que ele prova e remove a poluição. A mitigação vigente é o **aviso escrito no
  ponto exato da tentação** (fim do próprio caso), que é o mecanismo que este repositório já usa.

### D16 · BAIXO · project_pattern · T8 · executor (escrituração)
- **Onde:** `apps/worker/src/despachante.ts` (marcador `DÉBITO COM GATILHO — D16 · F5/T8`, junto de
  `lerAmbienteDoDespacho`)
- **Problema:** a conferência de partida das **três** variáveis comuns aos dois pontos de entrada de
  `apps/worker` — `LOG_LEVEL`, `DATABASE_URL` e `REDIS_URL` — passa a ter **duas** declarações:
  `lerAmbienteDoDespacho` (T8) e `lerAmbiente` (`apps/worker/src/main.ts`, T6/T8 da F0). Medido em
  2026-08-23: `grep -rn "LOG_LEVEL: ausente" --exclude-dir=dist apps packages` devolve **um** ponto
  antes desta task e **dois** depois. A terceira instância do produto (`apps/api/src/configuracao/
  ambiente.ts`) usa **outro mecanismo** — esquema Zod —, e por isso ela não conta como cópia deste
  molde; ela é o outro lado do `D51 · F4/T16`.
- **Impacto:** os dois pontos de entrada sobem do **mesmo** `EnvironmentFile`. Endurecer uma das duas
  declarações — apertar a forma da cadeia da fila, acrescentar uma severidade — faz um ponto de entrada
  subir e o outro recusar o mesmo arquivo, e a divergência aparece **no boot**, que é o momento mais caro
  para descobri-la. O risco é atenuado por as duas **importarem** as regras de forma de `@sysloc/shared`
  (`NIVEIS_DE_LOG`, `ehCadeiaDeFilaValida`, `EXIGENCIA_DA_CADEIA_DE_FILA`): o que está duplicado é a
  **composição** (quais variáveis, e a redação da recusa), não o predicado.
- **O que fazer:** fechar **junto do `D51 · F4/T16`** — a task que subir `ehChaveDeCifraAceitavel` e
  `ehDiretorioGravavel` para `packages/shared/src/ambiente.ts` leva estas três leituras no mesmo
  movimento, e aí o produto passa a ter **uma** casa para toda regra de partida compartilhada. Antes
  disso, não: reusar `lerAmbiente` a partir do despachante exigiria importar `apps/worker/src/main.ts`,
  e o grafo de importe do processo efêmero passaria a alcançar `criarAdaptadorSicoob`,
  `criarAdaptadorSmtp` e `criarGuardaDeBoletos` — num processo que a ADR-0025 e a ADR-0032 dizem, por
  escrito, que **não compõe porta externa alguma**.

### D17 · BAIXO · tests · T8 · executor (escrituração)
- **Onde:** `apps/worker/test/despachante.spec.ts` (`executarDespachante`, junto do `spawn`)
- **Problema:** o lançador de **subprocesso real** com ambiente montado explicitamente passa a ter
  **duas** declarações privadas: esta e `executarCenario`, em
  `packages/shared/test/ambiente-efemero.spec.ts`. Medido em 2026-08-23:
  `grep -rln "env: ambiente" --include='*.spec.ts' apps packages` devolve os dois.
  ⚠️ **O eixo do comando é o AMBIENTE EXPLÍCITO, e não o `spawn`.** Medir por
  `grep -rln "spawn(process.execPath" …` devolve **TRÊS**, e o terceiro —
  `packages/shared/test/reserva-de-porta.spec.ts` — **não conta**: ele **herda** `process.env`, e não é
  o *"lançador com ambiente montado explicitamente"* que o campo `O QUÊ` deste débito delimita. O que
  está duplicado é a construção do ambiente variável a variável, sem a qual a prova de *"a partida
  recusa sem a variável"* passa a depender do ambiente de quem roda a suíte. **Quem for medir o
  gatilho, meça por este eixo** — o comando anterior, registrado na rodada 1, levaria a próxima fatia
  a ler três e concluir que o Limiar de Três disparou.
- **Impacto:** o Limiar de Três **não disparou** (são duas), mas endurecer uma deixa a outra para trás —
  e o que está em jogo aqui não é estilo: o lançador é quem garante que o ambiente do filho seja
  **construído variável a variável**, e não herdado. Uma cópia futura escrita por quem copiar de uma
  vizinha herdaria `process.env` sem perceber, e a prova de *"a partida recusa sem a variável"* passaria
  a depender do ambiente de quem roda a suíte.
- **O que fazer:** ao **terceiro** consumidor, subir o lançador para a casa compartilhada do diretório —
  `packages/shared/test/` se o consumidor for de outro pacote, `apps/worker/test/` se for irmão. Não
  agora: migrar `ambiente-efemero.spec.ts` é abrir arquivo que esta task não tem razão para tocar
  (proibição 5 do Protocolo Antirregressão).

### D18 · MEDIO · project_pattern · T10 · Tech Review

- **Onde:** `apps/api/test/rotinas-agendadas.e2e.spec.ts:1023`
- **Problema:** a suíte declara a **sétima** cópia de `emUnidade` em `apps/api/test/`, e **três
  assinaturas já divergiram** (sem contexto · com contexto parametrizado · com empresa fixa). As
  outras seis: `boleto-da-cobranca.e2e.spec.ts:2411`, `equivalencia-com-o-oraculo.spec.ts:1172`,
  `historico-bancario.e2e.spec.ts:1188`, `notificacao-bancaria.e2e.spec.ts:1142` (`emUnidadeDeA`),
  `recusa-indistinguivel.e2e.spec.ts:1621` (`emUnidadeDe`) e `retomada-de-retidas.spec.ts:875`.
- **Impacto:** endurecer uma cópia deixa as outras seis para trás. ⚠️ **A condição existe sem registro
  algum** — nada em `.claude/rules/`, no índice do `CLAUDE.md` ou em marcador nomeia estas 7 cópias,
  de modo que a próxima suíte de borda copia da vizinha e o gatilho **nunca dispara**. É a mesma
  classe que o `D11 · F5/T6` registrou para o espelho de `apps/worker/test/`, e o docblock de
  `emUnidade` justifica só a não-importação de `packages/db/test/unidade-sob-contexto.ts` (a divisão
  barril × fonte do `AsyncLocalStorage`, constrangimento **real e medido**), sem endereçar a casa do
  **próprio** diretório, onde aquele constrangimento não se aplica.
- **O que fazer:** mover `emUnidade` e `interface Contexto` para `apps/api/test/acessorios-de-borda.ts`
  (adição pura, sem tocar as 6 suítes existentes) e importá-los — é o que a convenção *"acessório de
  suíte se importa, não se copia"* literalmente manda, e a suíte já consome daquela casa.

### D19 · BAIXO · documentation · T9 e T10 · QA e Tech Review (escrituração)

- **Onde:** `docs/specs/features/automacoes-agendadas/v1/tasks/T9.md` §5.2 e `tasks/T10.md` §5.2
- **Problema:** as §5.2 não declararam os arquivos-âncora que a publicação faria crescer. Na **T9**:
  `packages/db/test/cobranca.spec.ts` (`UNIDADES_DECLARADAS`, 2 → 15) e
  `packages/db/test/barreira-de-envio.spec.ts` (`CLASSES_NAO_CARREGAVEIS`, classe `.timer` nova). Na
  **T10**: `apps/api/test/contexto.e2e.spec.ts` (`ROTAS_PROTEGIDAS_ACEITAS`) e
  `apps/api/src/automacao/automacao.module.ts` (contagem narrativa do docblock).
- **Impacto:** **o custo já foi pago e é medido** — a âncora de `barreira-de-envio.spec.ts` só apareceu
  pela suíte **vermelha** no Gate 1 da rodada 1 da T9, queimando uma rodada inteira de correção. É o
  modo de falha que o contraexemplo ❌ da `ancoras-de-superficie.md` nomeia literalmente.
- **O que fazer:** nada no código — as quatro âncoras subiram corretamente, com `SUT_IS_CORRECT_BECAUSE:`
  onde devido. ⚠️ **A série do `D26 · F2/T6` encerra aqui**: com o congelamento da superfície, nenhuma
  fatia posterior publica rota, e a condição que gera este débito **deixa de existir**. Se o `D26`
  tiver marcador vivo, ele sai no fecho, no mesmo commit (§3-B).

### D20 · MEDIO · code_quality · T9 · Tech Review

- **Onde:** `deploy/systemd/sysloc-rotina-*.{service,timer}` (12 arquivos)
- **Problema:** ~100 linhas de **prosa** byte a byte idênticas nos seis `.service` (que têm 140 linhas
  cada, ~110 de comentário) e nos seis `.timer`. A justificativa da cópia vale para as **diretivas** —
  o formato `.ini` não tem herança, e o argumento do executor está certo —, **não** para a prosa, que
  supervisor nenhum lê.
- **Impacto:** doze cópias livres para divergir, **e a divergência já se manifestou neste mesmo diff**
  (ver `D21`). Corrigir a explicação numa deixa as outras onze para trás, e o próximo leitor não tem
  como saber qual das doze está certa.
- **O que fazer:** reduzir os blocos comuns a uma linha com ponteiro (`# Ver o cabeçalho de
  deploy/scripts/instalacao/instalar-unidades.sh — «O relógio: HABILITA-SE O .timer, NUNCA O .service»`),
  preservando integralmente o que é específico de cada unidade.

### D21 · BAIXO · code_quality · T9 · Tech Review

- **Onde:** `deploy/systemd/sysloc-rotina-encerramento-de-contratos.timer`,
  `…-conferencia-de-liquidacao.timer` e `…-manutencao.timer`
- **Problema:** o bloco que justifica `AccuracySec=1s` nos três timers **diários** é cópia literal do
  bloco dos timers de intervalo: *"num relógio de alta frequência isso faz o disparo andar dentro da
  janela"*. Nenhum dos três dispara mais de uma vez por dia.
- **Impacto:** prosa que não descreve o próprio arquivo. É a **primeira evidência concreta** do `D20`.
  ⚠️ A diretiva em si está **certa** nos seis — sem ela o padrão de 1 min faria o disparo das 00:02
  andar até 00:03; o que está errado é só a razão escrita.
- **O que fazer:** reescrever a segunda frase dos três blocos para a razão do caso — o **deslocamento
  do horário marcado** —, ou absorvê-la no ponteiro único proposto no `D20`.

### D22 · BAIXO · documentation · T9 · QA (rodada 3)

- **Onde:** `packages/shared/test/unidades-agendadas.spec.ts` (docblock de `extrairFragmentoDoPasso`)
- **Problema:** o `REVERTER EXIGE` do marcador `DECISÃO FECHADA — T9 / Gate 2 · 2026-08-23` promete
  *"provar que nenhum ponto de chamada executa esta função num subshell"*, e a extração é **por linha**:
  ela alcança qualquer mecanismo **linha-local** (substituição de comando, crase), e **não** alcança um
  ponto futuro envolvido por cano (`… | while read x; do proximo_passo; …; done`), que seria extraído
  **fora** do cano e passaria em verde.
- **Impacto:** ⚠️ **Isto NÃO invalida a rede** — os dois gates registraram que ela discrimina o defeito
  real (12 saídas `P01`, conjunto de 1 contra 12) e é **estritamente mais forte** que a asserção
  estática originalmente prescrita. E o antivácuo `pontos.length === PONTOS_DE_CHAMADA_DO_PASSO`
  reprova quando um quinto ponto nascer, trazendo o autor de volta. Falta a **fronteira estar escrita
  onde o próximo leitor a encontre**.
- **O que fazer:** acrescentar **uma linha** ao docblock de `extrairFragmentoDoPasso` declarando que a
  extração é por linha e o que ela não alcança. ⚠️ **Sem tocar o marcador** — texto sob `DECISÃO
  FECHADA` não se altera (§3).

### D23 · BAIXO · tests · T10 · QA e Tech Review — ⚠️ **premissa corrigida por medição**

- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:327` (`ESQUEMAS_POR_ROTA` / `ROTAS_DESCRITAS = 48`)
- **Problema:** `ESQUEMAS_POR_ROTA` é lista **curada à mão sem âncora de completude contra a superfície
  publicada** — nada afirma que toda rota que devolve corpo JSON consta dela. A tabela cobre **48 de
  106** rotas, por desenho declarado no próprio `describe`; **58 ficam fora** da prova de que o
  documento publicado deriva do esquema Zod (`CT-327`).
- ⚠️ **DUAS premissas da escrituração original foram REFUTADAS por medição do Gate 2, e conferidas por
  mim. Não as reponha:**
  1. *"a âncora é `toBeGreaterThanOrEqual` e por isso não reprova"* — **falso**. Aquela desigualdade
     (`:810`) vive no **`CT-945`** (a rota que devolve bytes, ADR-0028) e é ali um **piso antivácuo**,
     papel que cumpre corretamente. A âncora do `CT-327` é `expect(tabela.length).toBe(ROTAS_DESCRITAS)`
     — **igualdade exata**, em `:528` e `:593`. Trocá-la não fecharia lacuna e enfraqueceria um
     controle que está certo.
  2. *"`GET …/rotinas` é a única rota fora da prova"* — **falso**. `grep -c 'automacao-de-cobranca'`
     naquele arquivo devolve **0**: as **quatro** rotas de automação que já existiam também estão fora.
- **Impacto:** ⚠️ **Não é violação da ADR-0016 e não é achado contra a T10** — a `Decision` cobra
  **derivação**, e o controlador usa `esquemaPublicado(esquemaDoEstadoDasRotinas, 'output')`. Falta a
  **prova**, que a ADR não exige por rota. A lacuna é **estrutural e antecede esta fatia**.
- **O que fazer:** criar âncora de **completude** sobre `ESQUEMAS_POR_ROTA` (48 → 106, ou partição
  explícita do que fica de fora e por quê). ⚠️ **A urgência é do congelamento**: depois desta fatia a
  superfície **não cresce mais**, então a tabela passa a ser fechável de uma vez — hoje é **mais
  barato do que nunca, não mais caro**.

### D24 · BAIXO · project_pattern · T11 · executor (escrituração) — o `D44 · F2/T10` **agravado**

- **Onde:** `apps/api/src/imoveis/imovel.service.ts` (`definirSituacaoDeLocacao`), marcador
  `DÉBITO COM GATILHO — D44 · F2/T10` — o débito é de outra fatia
  (`docs/specs/features/contratos-de-locacao/v1/_run/run-report.md §2, D44`), e esta entrada
  **registra o agravamento**, não o substitui.
- **Problema:** o `D44` nomeia a ausência, no banco, de restrição que pareie `contrato.status = 'ATIVO'`
  com `imovel.status_locacao` — hoje nada fecha a janela da guarda de aplicação. Até esta fatia havia
  **dois** escritores do par; a **T5** criou o **terceiro**: `encerrarContratosVencidos`, que encerra o
  contrato e libera o imóvel na mesma unidade, **sem passar pelo serviço da API**.
- **Impacto:** o gatilho literal do débito — *"a fatia que criar no banco a restrição pareando …"* —
  **não disparou**, e por isso o marcador **fica onde está, com o texto que tem** (§21.3 do tech spec).
  O que mudou é a **superfície de divergência**: com três escritores, um deles fora da camada de
  serviço, a coerência do par passou a depender de disciplina em três lugares em vez de dois. Nenhum
  deles é alcançado pela guarda do outro.
- **O que fazer:** nada nesta fatia — **anotar, não silenciar**. A rede possível enquanto a restrição
  de banco não existir é o **`CT-1069`** (`packages/db/test/encerramento-de-contratos.spec.ts`), que
  afirma o par pelo dado: o contrato encerrado e o imóvel do contrato encerrado **na mesma leitura**,
  de modo que um encerramento que deixasse o imóvel ocupado reprova. Ele cobre o **terceiro** escritor;
  os dois primeiros seguem cobertos pelas suítes da F2. O fecho definitivo continua sendo o do `D44`:
  a restrição no banco, que torna o estado incoerente **irrepresentável**.

### D25 · BAIXO · testability · T11 · Tech Review

- **Onde:** `packages/db/test/cobranca.spec.ts` (`FONTES_NOVOS_DA_FATIA`) e
  `packages/db/src/derivacao-de-cobranca.ts:125` (o `REVERTER EXIGE`)
- **Problema:** a premissa *"os **CINCO** fontes que a fatia `automacoes-agendadas` acrescentou ao
  produto"* é **falsa por medição**: `git diff --name-status <base_sha> -- 'apps/*/src/*'
  'packages/*/src/*'` devolve **sete**. Ficaram de fora `packages/contracts/src/rotina-agendada.ts`
  (370 linhas) e `packages/db/src/fuso-da-operacao.ts` (78 linhas — a extração que o `D14 · F3/T5`
  moveu, e cuja mudança de path a própria T11 corrigiu no índice).
- **Impacto:** ⚠️ **Nenhum furo prático**, e é por isso que é `BAIXO`: os dois excluídos são
  **incapazes da falha procurada** — `rotina-agendada.ts` é Zod puro (zero `UPDATE`/`INSERT`) e
  `fuso-da-operacao.ts` exporta uma única constante, sem SQL. E o `CT-510` já varre
  `packages/db/src/**`, `apps/api/src/**`, `packages/regua/src/**` e `apps/worker/src/**` **inteiros**
  por rótulo de estado, com igualdade de lista. O que se perde é a **precisão da afirmação** numa rede
  cujo propósito é fechar o risco R3 de probabilidade ALTA — quem ler *"todos os fontes novos da
  fatia"* e não medir acreditará numa cobertura que a lista literal não tem.
- **O que fazer:** ⚠️ **corrigir a REDAÇÃO, não inflar a lista** — incluir dois arquivos incapazes de
  falhar não acrescenta poder de detecção e obriga a remedir a suíte. Trocar por *"os cinco fontes que
  a fatia acrescentou **e que emitem SQL**"*, nomeando os dois de fora e por quê, e ajustar o
  `REVERTER EXIGE` na mesma passada. A âncora `expect(varredura.arquivos).toBe(5)` **fica como está** —
  ela mede o que foi lido, e continua correta.

### D26 · BAIXO · scope_deviation · T11 · Tech Review

- **Onde:** `docs/specs/features/automacoes-agendadas/v1/tasks/T11.md` §5.2
- **Problema:** a §5.2 declara três arquivos a modificar; o diff toca também
  `packages/db/src/conferencia-bancaria.ts` (+18) e `apps/api/test/retomada-de-retidas.spec.ts` (+12).
  Medido pelo gate: **zero linhas removidas** e **zero linhas de código** nas duas — são 30 linhas de
  comentário, e `it(`/`expect(` de `retomada-de-retidas.spec.ts` ficaram em 4 e 48, antes e depois.
- **Impacto:** risco material **nulo**. ⚠️ **E há atenuante estrutural que o gate reconheceu**: a §3.3
  da própria task **encarrega** a T11 da conferência das duas pontas, e o conjunto de marcadores que
  ela vai emendar **não é conhecível antes de ela rodar** — a §5.2 não teria como enumerá-lo.
- **O que fazer:** nada no código. Para as próximas tasks de **fecho de fatia**, a §5.2 deve trazer
  uma linha do tipo *"mais os arquivos dos marcadores que a conferência das duas pontas apontar"*,
  separando o desvio real do desvio que a própria spec torna inevitável.

### D27 · BAIXO · testability · T11 · Tech Review

- **Onde:** `packages/db/test/cobranca.spec.ts`, `CT-1096 (c)` (`posicaoDaEscrita`)
- **Problema:** a posição esperada sai de `integro.split('\n').findIndex(...)` sobre o resultado **cru**
  de `readFile`, e é comparada contra `daCopia.ocorrencias`, que vem de `varrerArquivos` — e este
  aplica `semComentarios(...)` **antes** de casar. Os dois eixos concordam **hoje** porque
  `'UPDATE negocio.contrato'` tem **exatamente uma** ocorrência em `encerramento-de-contratos.ts`, em
  posição executável. Mas `String.prototype.replace` sem flag global substitui só a **primeira**: se um
  docblock futuro daquele arquivo citar a cadeia acima da linha real, o defeito passa a ser injetado
  **dentro de um comentário**, `semComentarios` o apaga, e a perna reprova com `ocorrencias: []` —
  **pelo motivo errado**.
- **Impacto:** fragilidade **latente**, sem efeito hoje, e que falha **na direção segura** (reprova o
  certo, não deixa passar o errado). ⚠️ Mas *"um caso que reprova o certo é desativado na primeira vez
  que atrapalha"* — que é o mesmo argumento que o executor usou, **com razão**, para deixar
  `INSERT INTO negocio.cobranca` fora da lista de agulhas.
- **O que fazer:** aplicar `semComentarios` ao conteúdo antes do `findIndex` (o acessório já é
  exportado por `./varredura-de-fontes.ts` e o `CT-510` o importa assim), **ou** — menor mudança,
  preservando a leitura atual — acrescentar
  `expect(integro.split(ESCRITA_INTEGRA_DO_ENCERRAMENTO).length - 1).toBe(1)`, que reprova **nomeando
  o problema** no dia em que a cadeia ganhar uma segunda ocorrência. É o mesmo cuidado que o `CT-510`
  já formaliza no docblock: *"se o `(d)` tivesse detector próprio, a falsificação provaria que aquele
  detector pega o mutante, e nada sobre a asserção que roda no disco"*.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada. As 11 fecharam nos dois gates.

## 4. Notas para Revisão Humana

**1 · O Gate 2 pegou dois defeitos que a suíte inteira não tinha como pegar, e os dois em infraestrutura.**
Na T9, `proximo_passo` era chamada dentro de `$( )` — substituição de comando roda em subshell, o
incremento morria com ele, e as **32 linhas** do registro de instalação sairiam todas rotuladas `P01`,
contra o CA-04, que exige auditabilidade **linha a linha**. O revisor mediu na máquina. ⚠️ **A suíte
não podia pegá-lo**: ela não lê `proximo_passo`, e o instalador exige `sudo` interativo, deixado fora
da suíte por decisão registrada (§16.1). Na T11, o marcador `DECISÃO FECHADA` declarava alcançar *"o
arquivo inteiro"* e **congelaria as duas funções que um débito do mesmo arquivo agenda mover** — e o
precedente é real: o `D23 · F0/T3` já consta no índice como *"BLOQUEADO por protocolo, não por tempo"*
pelo mesmo mecanismo. **Os dois são o argumento empírico mais forte deste run a favor de manter o
Gate 2 ligado onde o código é protegido.**

**2 · A §5 do Protocolo Antirregressão foi acionada uma vez, e mudou o desfecho.** Na T10, a mesma
classe de asserção infalível reapareceu **três vezes em três rodadas**, sempre num ponto novo do mesmo
arquivo. Em vez de mandar corrigir a linha apontada, o executor foi mandado **varrer o arquivo
inteiro**: examinou **55 `expect(` em 4 casos** e achou **5 pontos / 11 asserções** — a amostra do
gate era **um** deles. Todas movidas, nenhuma removida (55 = 55). Os outros quatro pontos teriam
voltado como rodadas 4, 5 e 6. **E ele declarou as absolvições com razão para cada uma**, o que tornou
a varredura auditável em vez de uma afirmação de boa-fé; o QA a refez de forma independente e não
achou sexta ocorrência.

**3 · O precedente de método foi confirmado mais quatro vezes, e uma delas em direção nova.**
*"Prescrição de gate é hipótese, não ordem"* — o executor que divergiu **declarando e medindo** teve
razão em todas. ⚠️ **Duas ocorrências são inéditas em espécie**: (i) na T10 rodada 3, a divergência foi
por **excesso de rigor** (ampliar o escopo prescrito), não por refutar premissa; (ii) na T9, **o
próprio autor da prescrição a retirou** — o Gate 2 havia pedido asserção estática, e ao revê-la
percebeu que ela *"seria FALSIFICADA HOJE pela própria prosa do marcador"*, que cita a forma proibida
num comentário para nomeá-la.

**4 · Três premissas escritas foram refutadas por medição, e duas eram do orquestrador.** (i) O débito
do contrato publicado fora escriturado como se a rota nova fosse a única fora da prova de derivação e
como se a causa fosse uma desigualdade — **as duas coisas eram falsas**: são **58 de 106** rotas fora,
por desenho declarado, e a desigualdade em questão é um piso antivácuo correto noutro caso; a âncora
real é igualdade exata. Corrigido no `D23`. (ii) O guard que serializou os QAs da Fase 4 alegava
colisão de `embedded-postgres`; **a medição mostrou que as instâncias arbitram porta entre processos
por soquete de espaço abstrato** e não colidem — o hazard real é o `tsc --build` concorrente sobre o
`dist/` compartilhado, e passou a ser cercado por `flock`, devolvendo o paralelismo. (iii) O par do
débito fechado pela T9 era `D3 · F5/T2`, não `F5/T7` — erro meu, propagado ao executor.

**5 · A T11 fechou uma regressão de prova antes de ela virar defeito.** O `CT-512` apoiava o *"nenhuma
rotina correu"* na premissa *"não há rotina no produto"* — **e esta fatia a tornou falsa**. O `CT-1096`
converte a premissa em **medição** (`count(*) === 0` antes da leitura, na mesma unidade). Sem isso, o
caso seguiria verde provando cada vez menos.

**6 · Duas falhas operacionais minhas, registradas.** Não capturei o `attempt_sha` antes de despachar
as correções da Fase 4, e as duas rodadas 2 caíram em `FULL` em vez de `DELTA` — a cláusula de
fallback funcionou, e o custo foi só de tokens. E parti a tabela da §1 deste relatório ao inserir as
linhas de T9/T10 depois de um parágrafo em prosa, deixando-as órfãs e T7/T8 de fora; o Gate 1 da T11 o
pegou, e a §1 foi regenerada por inteiro.

**7 · O que fica aberto, e o que não é pagável agora.** A §2 tem **27 blocos**. O `D12 · F5/T6` (metade
b) segue aberto **por razão de produto**, não por esquecimento: o remédio exige fixar um **limiar de
obsolescência**, e a forma prescrita em primeiro lugar **colide com desenho registrado por extenso** no
arquivo. O `D44 · F2/T10` foi **agravado** pela T5 (terceiro escritor do par contrato-vigente /
situação-do-imóvel) e está anotado no `D24`, com o `CT-1069` nomeado como a rede possível enquanto a
restrição de banco não existir. O `D23` ganhou nota de urgência do revisor: **com a superfície
congelando logo após esta fatia, a tabela do contrato publicado passa a ser fechável de uma vez — hoje
é mais barato do que nunca, não mais caro.**

**8 · A bijeção do índice de débito fecha em 41/41**, conferida **três vezes de forma independente** —
pela T11, pelo Gate 1 e pelo Gate 2 —, mais a barreira executável (`CT-907`). O 42º casamento é o
fixture `D99 · F7/T3`, que vive numa **string literal** do `CT-908` e é o controle de não-cegueira da
própria detecção. ⚠️ **O executor da T11 conferiu, sem que ninguém pedisse, que a citação
`` `D26 · F3/T8` `` que ele escreveu no marcador NÃO casa o padrão do `CT-908`** — se casasse, entraria
como 42º marcador sem linha no índice e quebraria a conferência.
