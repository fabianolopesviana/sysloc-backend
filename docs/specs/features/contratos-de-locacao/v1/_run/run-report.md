# Relatório do Run — contratos-de-locacao/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **10/10 tasks concluídas — as três fases fechadas** · `pnpm test` **664/664 verdes** (baseline da fatia anterior era 541) · `pnpm build` e `pnpm lint` verdes · superfície publicada em **75 rotas / 60 manipuladores**, `semDeclaracao` vazio (baseline da fatia anterior era 541; nenhum pacote encolheu em nenhuma rodada) · `pnpm build` e `pnpm lint` verdes

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Capturar o golden de ativação e cancelamento do sistema antigo | opus | 2 criados, 4 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Contrato de tipos do contrato de locação em `@sysloc/contracts` | opus | 1 criado, 2 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Schema e migrações do contrato — tabelas isoladas, vigência única e o contador da série | opus | 4 criados, 7 mod | ✅ APROVADO_COM_OBSERVACOES (3ª rodada) | ✅ APROVADO_COM_OBSERVACOES (3ª rodada) |
| T4 | Derivações puras do contrato — término da locação e valor total, provados contra o oráculo | opus | 2 criados, 2 mod | ✅ **APROVADO** (sem ressalva) | ✅ APROVADO_COM_OBSERVACOES |
| T5 | Porta de dados do contrato — emissão da série, escritas do ciclo de vida e traduções de unicidade | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES (2ª rodada) | ✅ APROVADO_COM_OBSERVACOES (2ª rodada) |
| T6 | Superfície de cadastro do contrato — montar, consultar, alterar e retirar de circulação | opus | 4 criados, 8 mod | ✅ **APROVADO** (sem ressalva, nas duas rodadas) | ✅ APROVADO_COM_OBSERVACOES (2ª rodada) |
| T7 | Ativação do contrato — ato governado, derivações e efeito no imóvel | opus | 0 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T8 | Cancelamento do contrato — ato governado, liberação do imóvel e o histórico que permanece | opus | 0 criados, 10 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T9 | Contrato vigente nas consultas de imóvel — leitura em lote, custo independente de N | opus | 0 criados, 9 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T10 | A situação de locação sai do corpo do `PUT` e ganha rota própria | opus | 0 criados, 14 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/contratos-de-locacao/v1/`.

### D1 · medio · tests · T1 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:828`
- **Problema:** CT-433 prova a virada de mês e a cobertura de fevereiro de forma DESACOPLADA — o produto cartesiano que a §4-2 exige não é asserido.
- **Impacto:** o bloco acumula `dias_de_inicio` e `anos_de_fevereiro` como conjuntos independentes e os afirma separadamente. Nada liga os dois. Provado por mutante executado pelo QA: um golden em que a virada de mês nunca encosta em fevereiro — exatamente o caso que a task chama de "a razão inteira de capturar em vez de ler" — sai `exit 0`. O artefato entregue hoje satisfaz o critério (29/30/31 × fev-2027 e fev-2028, conferidos um a um); o que falta é poder de detecção, e ele importa mais que o normal porque este verificador é o que protege o oráculo depois da F7, quando não houver mais como recapturar.
- **O que fazer:** acumular o par `(inicio.day, destino.year)` quando `destino.month == 2` e afirmar que o conjunto cobre `{29,30,31} × {bissexto, não-bissexto}` — seis pares. Falsificação exigida: reaplicar o mutante (A) do QA e demonstrar que ele passa a reprovar.

### D2 · medio · tests · T1 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:778`
- **Problema:** CT-433 conta recusas em vez de discriminá-las — `len(recusadas) < 6` não prova "uma por condição de entrada".
- **Impacto:** seis recusas da MESMA condição satisfazem a asserção, embora a própria mensagem de erro declare "as seis condições de entrada exigem ao menos um cada". Provado por mutante executado: seis cópias de `sem_locatario` saem `exit 0`. O golden real cobre as seis corretamente.
- **O que fazer:** declarar as seis condições no script e ligá-las às mensagens literais da regra (`Data de início da locação é obrigatória.`, `Prazo da locação deve ser maior que zero.`, `Valor mensal inválido.`, `Dia de vencimento deve estar entre 1 e 28.`, `Contrato sem imóvel vinculado.`, `Contrato sem locatário vinculado.`), afirmando que as seis aparecem entre as recusas. Falsificação exigida: reaplicar o mutante (B).

### D3 · baixo · tests · T1 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:814`
- **Problema:** a invariância de relógio dos DOIS artefatos novos é afirmada no `PROCEDENCIA.md` e não é asserida por caso nenhum.
- **Impacto:** o manifesto afirma que `contrato-cancelamento.json` não grava data absoluta e que nenhuma data de `contrato-ativacao.json` deriva de `nowdate()`. O CT-005 — a máquina que prova isso deslocando o relógio em +37 dias — continua limitado a `golden_rotinas`, com os três artefatos originais. Verdadeiro hoje (verificado), risco prospectivo, num artefato que precisa sobreviver à desinstalação do Frappe.
- **O que fazer:** (a) acrescentar `contrato-cancelamento.json` a `golden_rotinas` no CT-005; ou, melhor para durabilidade porque sobrevive à F7, (b) afirmar no CT-433 (offline) que `grep -cE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` sobre `contrato-cancelamento.json` devolve 0.

### D4 · baixo · security · T1 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:397`
- **Problema:** CT-013 reprova com 43 ocorrências e a lista nominal `PREEXISTENTES` (11 entradas) está vencida.
- **Impacto:** **pré-existente e alheio à T1** — a varredura acusa `apps/api/test/*`, `packages/auth/{src,test}/*`, `packages/db/src/{pessoa,semente}.ts`, `docs/specs/domain-glossary.md` e artefatos da fatia `autorizacao-e-ciclo-de-acesso`, nenhum tocado por esta task; a baseline do script do HEAD sobre a mesma árvore já reprovava. Mas é um verificador de **segurança** vermelho: enquanto o estado for ambíguo, o sinal do CT-013 é ruído — o modo de falha que a varredura existe para evitar.
- **O que fazer:** fora do escopo desta task. Decidir entre (a) rotacionar a credencial do `/opt/frappe` — a correção real, já apontada como pendência aberta no `CLAUDE.md`, e que também neutraliza a exposição que permanece no histórico do git; ou (b) reconciliar `PREEXISTENTES` com as 43 posições atuais, classificando cada uma como falso-positivo de palavra de dicionário ou como exposição. A opção (b) sozinha só recompra o verde e volta a envelhecer.

### D5 · baixo · tests · T1 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:223`
- **Problema:** o script pressupõe que `capturar.py` já rodou contra o site corrente e não guarda a precondição.
- **Impacto:** pré-existente. Invocado fora da sequência canônica, CT-006 a CT-009 reprovam com "documento ausente do site efêmero" e o CT-001 diverge em sha — sintomas que apontam para o golden, não para a ordem de invocação. **Custou uma rodada inteira de diagnóstico neste próprio run.**
- **O que fazer:** no `main`, antes do primeiro caso, conferir a precondição e abortar nomeando-a (site efêmero existe e os 8 artefatos de `GOLDEN_DE_CARACTERIZACAO` presentes com mtime posterior à criação do site); na falta, `exit 2` com a sequência canônica escrita na mensagem. Mesmo padrão do gate de sanidade que o `capturar.py` já usa.

### D6 · BAIXO · code_quality · T1 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:96`
- **Problema:** `afirmar_diferente` foi acrescentada sem nenhum ponto de chamada.
- **Impacto:** código morto num verificador que precisa sobreviver ao desligamento do `/opt/frappe`. O `shellcheck --severity=error` não sinaliza função não usada (é SC2329, `info`), então passa limpo pelo lint. Atenuante: a `.claude/rules/testing-stack.md` lista `afirmar_diferente` no vocabulário canônico e descreve esse vocabulário como derivado de `verificar-golden.sh` — o acréscimo reconcilia o arquivo com a rule que o nomeia como origem.
- **O que fazer:** remover a função, ou dar-lhe consumidor no CT-433 — `afirmar_diferente "o conjunto versionado deixou de ser o de 7 caminhos" "7" "$(...)"` é o companheiro negativo natural da contagem que o caso já afirma.

### D7 · BAIXO · code_quality · T1 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:35`
- **Problema:** o conjunto de artefatos golden é declarado em três listas paralelas no mesmo arquivo, sem asserção de coerência.
- **Impacto:** vale `GOLDEN_ESPERADOS == PROCEDENCIA.md + GOLDEN_DA_CAPTURA_ORIGINAL + GOLDEN_DE_CONTRATO`, mas a identidade é mantida à mão. O comentário declara `GOLDEN_ESPERADOS` como "fonte única do conjunto E da contagem" — verdade para a contagem, falso para o conjunto assim que as outras duas listas existem ao lado. Acrescentar um décimo artefato continua exigindo lembrar de três lugares, que é o atrito que os comentários dizem eliminar.
- **O que fazer:** compor em vez de transcrever: `GOLDEN_ESPERADOS=("PROCEDENCIA.md" "${GOLDEN_DA_CAPTURA_ORIGINAL[@]}" "${GOLDEN_DE_CONTRATO[@]}")`, declarada depois das duas sublistas. Uma linha, sem mudar asserção alguma. A quarta lista, em `verificar-captura.sh`, fica onde está — aquele script tem de continuar executável de forma independente.

### D8 · BAIXO · testability · T1 · Tech Review
- **Onde:** `docs/specs/features/caracterizacao-regras-legadas/v1/golden/PROCEDENCIA.md:8`
- **Problema:** depois da F7 nenhuma asserção offline liga o conteúdo dos golden a um digest registrado.
- **Impacto:** hoje há duas redes: o CT-008 do `verificar-captura.sh` (confere `estado_resultante` contra o banco) — que **morre com o `/opt/frappe` na F7 e não volta` — e o CT-433, que por decisão correta não confere valor algum (reimplementar a derivação aprovaria um golden errado desde que errasse igual). A partir da F7, uma edição cirúrgica de valor dentro dos artefatos — o vetor clássico de ajustar o oráculo para casar com implementação defeituosa na F3/F5 — não é detectável offline. **Pré-existente**: os seis artefatos originais têm a mesma propriedade. Registrado aqui porque a T1 é a última captura possível.
- **O que fazer:** coluna de sha256 por artefato na §1 do `PROCEDENCIA.md`, emitida por `capturar.py` junto do manifesto, mais asserção no `verificar-golden.sh` conferindo cada digest. Endereçar junto da próxima captura, se houver, ou por um caso que fixe os digests atuais como constantes versionadas — recapturar só por isto não se paga.

### D9 · medio · code_quality · T2 · QA
- **Onde:** `packages/contracts/test/esquemas.spec.ts:731`
- **Problema:** duplicata semântica — a recusa de `empresaId` em `esquemaDeContratoNovo` é provada duas vezes com a mesma tupla.
- **Impacto:** o item `{ chave: 'empresaId', valor: EMPRESA_ALHEIA }` da tabela `DECIDIDOS_PELO_SERVIDOR` coincide integralmente com o caso que o **CT-337** já gera (mesmo alvo, mesmos parâmetros, mesmo resultado esperado — `unrecognized_keys`, `keys: ['empresaId']`). O CT-337 é ainda estritamente mais forte, porque acrescenta a metade declarativa. Os outros quatro itens da tabela (`status`, `codigo`, `dataFimLocacao`, `valorTotalContrato`) **não** são cobertos pelo CT-337 e são legítimos.
- **O que fazer:** remover a linha de `empresaId` e registrar no docblock que ela é coberta pela varredura do CT-337 — a lista dos cinco continua nomeada na prosa (RN-03) sem repetir a asserção. Alternativa aceitável: manter e registrar a duplicação como deliberada; nesse caso o débito fecha por decisão, não por edição.

### D10 · baixo · tests · T2 · QA
- **Onde:** `packages/contracts/test/esquemas.spec.ts:1021`
- **Problema:** a fronteira imediata do teto monetário não é exercitada — mutante medido sobrevive.
- **Impacto:** trocar `.max(MAIOR_VALOR_MONETARIO)` por `.max(MAIOR_VALOR_MONETARIO * 2)` deixa a suíte **126/126 verde**. As outras três grandezas do arquivo têm o par de fronteira imediata; o dinheiro é a única sem. **O impacto é delimitado pela medição**: o mutante não aprova valor indevido, porque a conferência conjunta `.refine` recusa de qualquer forma — o que se perde é a **atribuição de campo** na faixa `(teto, 2×teto]`, que passaria a acusar `prazoMeses` quando o culpado é `valorMensal`, contrariando a §6.1.
- **O que fazer:** acrescentar à tabela `RECUSADOS` do CT-428 (b) a linha `{ rotulo: 'um centavo acima do teto da coluna', remendo: { valorMensal: MAIOR_VALOR_MONETARIO + ESCALA_MONETARIA }, campo: 'valorMensal' }`. Medido: mata exatamente o mutante que hoje sobrevive.

### D11 · baixo · documentation · T2 · QA
- **Onde:** `packages/contracts/src/contrato.ts:121`
- **Problema:** ponteiro morto — o docblock de `formatarCodigoDeContrato` remete a "Ver Pendências da T2", seção que a T2 não tem (a §7 chama-se `Notas / Observações`).
- **Impacto:** o ponteiro sustenta a decisão de desenho mais discutível do arquivo e aponta para lugar nenhum.
- **O que fazer:** acrescentar o item à §7 da T2 (a consequência acima de 99 999, por que é inalcançável na operação, e por que a recusa ruidosa é preferível à colisão silenciosa), ou trocar a remissão para o destino que efetivamente registra a decisão.

### D12 · baixo · documentation · T2 · QA + Tech Review (P1)
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T2.md:35` e `docs/specs/features/contratos-de-locacao/v1/tech_spec.md` §4.2/§6.1
- **Problema:** a largura publicada é `\d{5}` exato, contra `\d{5,}` declarado em **três** artefatos — e a justificativa registrada no código para a escolha é **falsificável pelo próprio arquivo de teste**.
- **Impacto:** os dois gates concordam com o **resultado** (`\d{5}` exato, porque o passo 5 do CT-428 é exigência bloqueante e a task se contradiz internamente). Mas o Tech Review **mediu** que a razão escrita no docblock — "`\d{5,}` deixaria a largura sem asserção pelo lado de cima" — é **falsa**: a largura seguiria presa por `expect([PREFIXO, LARGURA]).toEqual(['CTR', 5])` e por `expect(formatarCodigoDeContrato(2026,1)).toBe('CTR-2026-00001')`, ambas independentes do regex. **Razão falsa dentro de docblock protetor é a matéria-prima da R3** — foi exatamente o que derrubou o marcador de `ESCALA_DA_METRAGEM` neste mesmo pacote em 2026-08-05. Alcança o consumidor externo: o `handoff-frontend.md` e o `plano-execucao.md` §F2 derivam da spec, e a superfície da API se congela contra artefatos que hoje discordam do pacote publicado.
- **O que fazer:** fechar **pela spec, não pelo teste**. Corrigir `tech_spec.md` §4.2/§6.1 e a §3 da T2 para `\d{5}` exato, e substituir no docblock e no cabeçalho do CT-428 a razão falsa pela verdadeira (o passo 5 do CT-428 exige a recusa de seis dígitos; a largura já está presa pelas duas asserções sobre formatador e constantes). **NÃO** inverter o regex removendo o caso dos seis dígitos — isso é remoção de asserção existente (R2 / AP-24).

### D13 · BAIXO · technical_requirement · T2 · Tech Review
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tech_spec.md` §4.2 e §6.1
- **Problema:** a spec descreve `MAIOR_PRAZO_EM_MESES` por uma fórmula que o código corretamente **não** seguiu, e não declara a conferência conjunta que ele acrescentou.
- **Impacto:** duas divergências, ambas com o código do lado certo. (1) A §4.2 dá `999_999_999_999_999`, acima do teto de `integer` que a própria §7.2 declara para `prazo_meses`; o código toma o mínimo das duas capacidades (`2_147_483_647`). (2) A §7 da T2 afirma que "o teto do fator garante o teto do produto", o que é impossível para teto por campo isolado — a garantia real vem do `.refine` conjunto, que **nenhum artefato de spec declara**. Consequência: restrição publicada que o consumidor externo encontra na prática (um corpo com os dois fatores dentro dos tetos é recusado com `422` em `prazoMeses`) sem que documento nenhum explique por quê. Alcança T5 e T7, que implementam a borda a partir da §6.1.
- **O que fazer:** atualizar a §4.2 (derivação = `min` das duas capacidades) e acrescentar uma linha à tabela da §6.1 para a conferência conjunta, com o campo nomeado. A aritmética do código foi conferida na fronteira e está exata.

### D14 · BAIXO · code_quality · T2 · Tech Review
- **Onde:** `packages/contracts/src/contrato.ts:288`
- **Problema:** `pdfContratoArquivo` recebe o teto de `MAIOR_TEXTO_CURTO`, cuja documentação enumera outra classe de campo, e nenhuma spec declara teto para ele.
- **Impacto:** a coluna é `text` sem limite (§7.2) e a §6.1 declara apenas "texto ou `null`" — o teto é invenção da implementação. `MAIOR_TEXTO_CURTO` documenta-se como "nome, logradouro, bairro, cidade", classe à qual um caminho de arquivo não pertence. É a **única** restrição do arquivo que não deriva de capacidade a jusante, num arquivo cuja doutrina inteira é "o teto é a capacidade da coluna". Se a organização do armazenamento passar a aninhar por empresa/ano/UUID, a recusa aparece como `422` sobre caminho legítimo e ninguém saberá por que o número é 200.
- **O que fazer:** ou declarar o teto na §6.1 e citá-lo no docblock do campo, ou introduzir `MAIOR_CAMINHO_DE_ARQUIVO` com a razão do valor escrita, no molde de `MAIOR_TEXTO_CURTO`/`MAIOR_TEXTO_LIVRE`.

### D15 · baixo · documentation · T3 · QA
- **Onde:** `packages/db/test/catalogo.spec.ts:683` e `:687`
- **Problema:** o CT-430 diz "sete entidades de cadastro" onde a asserção cobre **seis**, e o comentário da linha 701 já escreve o número certo.
- **Impacto:** o arquivo se contradiz sobre a própria contagem. Não há defeito de asserção — a igualdade é exata e cobre as seis que de fato carregam `retirado_em`. O que está errado é a prosa, e ela é o que o próximo leitor usa para decidir se a lista está completa.
- **O que fazer:** trocar "sete" por "seis" nas duas linhas, ou explicitar como "as cinco de cadastro mais o contrato" — a forma da linha 701, que não envelhece com entidades novas.

### D16 · baixo · tests · T3 · QA
- **Onde:** `packages/db/test/catalogo.spec.ts:1113`
- **Problema:** `expect(contador).not.toBe('')` no CT-421 é infalível depois do `toHaveLength(1)` que o precede.
- **Impacto:** o índice 0 existe (garantido pela asserção anterior) e `relname` nunca é cadeia vazia — a linha é artefato de estreitamento de tipo do `?? ''`, não afirmação de conteúdo. Não compromete o caso (a prova real é `not.toContain(contador)` mais a igualdade sobre `tabelasExaminadas`), mas uma linha decorativa entre duas asserções fortes ensina a ler as demais como se também fossem decorativas.
- **O que fazer:** remover a linha, ou trocá-la por algo falseável sem recompor o nome inteiro — `expect(contador).toContain(\`contrato_${ANO_DO_CONTADOR}_\`)`, que é o que o CT-431 já faz pelo predicado do `find`.

### D17 · baixo · code_quality · T3 · QA
- **Onde:** `packages/db/test/papel-de-conexao.spec.ts:456` e `packages/db/test/catalogo.spec.ts:555`
- **Problema:** `sequenciasDeNegocio` e o caminho de criação do contador ficaram duplicados entre os dois specs, com **formatos de retorno divergentes** (nome qualificado num, nome nu no outro). O mesmo vale para o par `criarContadorPeloCaminhoDaAplicacao` / `emitirNumero`.
- **Impacto:** nada está errado hoje e a divergência de projeção é deliberada em cada ponto de uso. O risco é de deriva: quando a forma do nome do contador mudar, são dois lugares a corrigir e um pode ficar para trás sem que nada acuse, porque cada arquivo confere só o seu.
- **O que fazer:** promover o acessório para um ponto único da suíte de `@sysloc/db` (ao lado de `banco-efemero.ts`), com o nome qualificado como retorno e o desqualificado derivado dele — ou, se a duplicação for aceita, deixar em cada cópia um ponteiro para a irmã.

### D18 · baixo · error_handling · T3 · QA (rodada 2)
- **Onde:** `packages/db/migracoes/0008_seguranca_contrato.sql:204`
- **Problema:** a guarda irmã de `p_inicio` não recebeu o `IS NULL` que `p_ano` ganhou — a assimetria contradiz o comentário que as declara irmãs.
- **Impacto:** comparação com NULL devolve NULL, nunca verdadeiro: `garantir_contador_de_contrato(2026, NULL)` atravessa a guarda e chega ao SQL dinâmico, onde `format('%s', NULL)` rende cadeia vazia — a instrução vira `… START WITH  MINVALUE  NO CYCLE`, erro de sintaxe (42601) em vez da recusa nomeada. **Não há resíduo nem escopo indeterminado** (o `EXCEPTION` não captura 42601 e nada é criado), o que separa este caso do defeito que o TR fechou em `p_ano`. O impacto real é a mensagem: o único caminho que passa `p_inicio` explicitamente é a **semeadura da virada (F7)**, e ela receberia erro de sintaxe de SQL dinâmico em vez de recusa nomeada.
- **O que fazer:** trocar por `IF p_inicio IS NULL OR p_inicio < 1 THEN`, alinhando a forma à da irmã. Sem prova de falsificação exigida — o caminho já levanta hoje; o que muda é qual mensagem o operador da F7 lê.

### D19 · baixo · code_quality · T3 · QA (rodada 3)
- **Onde:** `packages/db/test/coerencia-de-migracoes.spec.ts:123`
- **Problema:** terceira cópia do padrão de nome de migração, e **a do shell é mais estrita que as duas de TypeScript**.
- **Impacto:** `PADRAO_MIGRACAO` (`/^\d{4}_.+\.sql$/`) repete `packages/db/test/banco-efemero.ts:78`, enquanto `deploy/scripts/instalacao/migrar-banco.sh:93` usa `^[0-9]{4}_[A-Za-z0-9_-]+\.sql$`, que recusa ponto e hífen no miolo. A rede afirma coerência do ledger sobre o conjunto que o aplicador **de teste** reconhece, não sobre o que o aplicador **de produção** aplica: uma migração nomeada de forma que só o shell recusa entraria no diretório, entraria no journal, passaria nesta rede e seria **pulada em produção** sem que nada acusasse. A divergência é **pré-existente** (nasce entre `banco-efemero.ts` e `migrar-banco.sh`); o delta apenas herda o lado permissivo ao definir o universo da própria afirmação. Não exportar a constante está certo — seria o seam que a Iron Law #6 proíbe.
- **O que fazer:** (a) alinhar o literal desta cópia ao do shell — `/^\d{4}_[A-Za-z0-9_-]+\.sql$/` —, fazendo a rede afirmar sobre o conjunto que produção aplica; ou (b) deixar como está e registrar, já que nenhum nome real exercita a diferença e o `drizzle-kit` só emite nomes conformes — nesse caso, uma linha no docblock dizendo que o universo da afirmação é o do aplicador de teste.

### D20 · BAIXO · code_quality · T3 · Tech Review (rodada 3)
- **Onde:** `packages/db/test/coerencia-de-migracoes.spec.ts:129-134`
- **Problema:** o docblock da âncora dá uma razão **que já morreu** — e a razão viva não está escrita.
- **Impacto:** o comentário justifica `MIGRACOES_IMUTAVEIS` por *"um `readdir` que devolvesse lista vazia **e** um journal ilegível fariam `[] toEqual []` passar"* — cenário **inalcançável**, porque `coerenciaDoLedger` levanta na linha 219 com diretório vazio e `lerEntradasDoJournal` levanta em quatro pontos com journal ilegível. A razão que a âncora de fato cumpre — descobridor **parcialmente** quebrado, devolvendo subconjunto não vazio (filtro errado, `sort` trocado, `readdir` recursivo alcançando `meta/`) — não está escrita em lugar nenhum. Um agente futuro conclui, corretamente, que o cenário descrito é impossível, e daí conclui, **erradamente**, que a âncora é redundante e pode sair — perdendo a única asserção que reprova descobridor que devolve subconjunto, o modo de falha em que as duas listas encolhem juntas e a igualdade passa por coerência falsa.
- **O que fazer:** trocar a segunda frase do docblock pelo cenário vivo. Uma linha de prosa; não toca asserção nenhuma.

### D21 · BAIXO · code_quality · T4 · Tech Review
- **Onde:** `packages/db/src/derivacao-de-contrato.ts:141`
- **Problema:** `Date.UTC` remapeia anos de 1 a 99 para `1900+ano`, e a data de fim sai ~1900 anos errada **em silêncio**.
- **Impacto:** medido contra o módulo construído — `derivarTerminoDaLocacao('0050-03-15', 12)` devolve `'1951-03-14'` (correto seria `'0051-03-14'`); a partir de `0100` o comportamento volta ao certo. O `formatarEmUtc` imprime o ano remapeado com quatro dígitos, de modo que **o resultado tem a forma correta e o valor errado**. A entrada é **alcançável**: `esquemaDeContratoNovo.safeParse` aceita `dataInicioLocacao: '0050-03-15'` (o `z.iso.date()` admite ano de dois dígitos significativos), a coluna `data_inicio_locacao` não tem restrição de faixa, e não há `CHECK` de `data_fim_locacao >= data_inicio_locacao`. Um erro de digitação no século atravessaria a borda e o banco, e a ativação da T7 gravaria data de fim **anterior** à de início sem erro nenhum. É `BAIXO` porque a faixa é implausível no domínio de locação, não porque seja inofensiva. **É o único ramo do calendário defeituoso**: 498.555 pares `(início, prazo)` entre 2020 e 2110 foram conferidos contra implementação de referência independente, com **zero** divergências.
- **O que fazer:** trocar a construção por `setUTCFullYear` sobre um `Date` de época (não remapeia), **ou** acrescentar ao bloco `PRÉ-CONDIÇÃO DAS ENTRADAS` do cabeçalho a linha que hoje falta — o ano de `dataInicio` é ≥ 100. Se corrigido, o caso de prova cabe no CT-401 como asserção isolada, **fora do golden** (o oráculo não tem cenário nessa faixa e não vai ganhar um).

### D22 · BAIXO · architecture · T5 · Tech Review
- **Onde:** `packages/db/src/contrato.ts:235` (`NumeroDaSerie`) e `:621` (`emitirNumeroDeContrato`)
- **Problema:** `NumeroDaSerie` tem **dois produtores** — o par é montado à mão na borda, e a discordância continua construível **fora** da porta.
- **Impacto:** dentro de `criarContrato` a discordância está fechada (é o que a rodada 2 corrigiu). Fora dela não: `emitirNumeroDeContrato(tx, ano)` devolve **só o número**, então quem monta o par é a borda, a partir de duas chamadas independentes — nada impede `criarContrato(tx, dados, { ano: A, numero: <emitido com B> })`. Baixo hoje (não há chamador de produção), mas é **janela**: enquanto o par for montado à mão, a discordância entre o ano do contador e o ano anunciado no código legível fica a um erro de digitação de distância, **na fronteira que a T6 vai escrever em seguida**. Fechar agora é gratuito; depois de T6 e T7 escritas, exige tocar chamadores.
- **O que fazer:** trocar o retorno para `emitirNumeroDeContrato(tx, ano): Promise<NumeroDaSerie>` (`{ ano, numero }`, com o mesmo `ano` que selecionou o contador) e ajustar `montarContrato` e o CT-403 (c). O CT-403 (c) fica **mais forte**: passa a provar que o par gravado é literalmente o que o emissor devolveu.

### D23 · BAIXO · error_handling · T5 · Tech Review
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T6.md:14` e a tabela §6.4 dela
- **Problema:** a alteração passou a produzir `ErroDeImovelComContratoVigente`, e a **T6** — dona do `PUT` — não declara essa classe entre o que consome nem a mapeia.
- **Impacto:** com o envoltório instalado na rodada 2, `alterarContrato` virou **segunda origem** da classe. A T6 lista em §1 apenas `garantirContadorDeContrato, ErroDeCodigoEmUso ← T5`, e a §6.4 não tem entrada para conflito de vigência. A RD-05 recusa `PUT` sobre contrato que não é `RASCUNHO`, então o caminho só se abre **na janela de corrida** entre o `SELECT` da guarda e o `UPDATE` — uma ativação concorrente do mesmo contrato. **Se a T6 não mapear a classe, essa janela devolve `500`**: a tradução morre na borda e o defeito da rodada 1 reaparece um andar acima, com a porta correta.
- **O que fazer:** acrescentar `ErroDeImovelComContratoVigente` aos símbolos consumidos da T6 e uma linha na §6.4: *"imóvel de destino já com contrato vigente (corrida com ativação concorrente) → `422 CAMPO_INVALIDO`, `campo: 'imovelId'`, `detalhes.conflito: 'IMOVEL_COM_CONTRATO_VIGENTE'"*. Mesmo mapeamento da T7, num ponto único se a borda já compartilhar o tradutor.

### D24 · baixo · architecture · T5 · Tech Review (rodada 1)
- **Onde:** `packages/db/src/contrato.ts:884` (`ativarContrato`) e `:917` (`cancelarContrato`)
- **Problema:** o par *"contrato ATIVO ⇔ imóvel LOCADO"* **não tem pareamento estrutural** — a T7 o herda como disciplina de serviço.
- **Impacto:** as duas escritas precisam ocorrer na mesma unidade e **nos dois sentidos**, mas nada na estrutura as pareia: são duas chamadas independentes que o serviço da T7 tem de lembrar de emitir. O docblock da porta estreita já nomeia o modo de falha — *"um imóvel que ficasse `DISPONIVEL` com contrato vigente não acusaria nada até a segunda locação ser recusada"*. Nenhuma restrição do banco recusa esse estado, e ele só se manifesta **longe da causa**. Agravante menor: a porta estreita aceita o enum **completo** `SituacaoDeLocacao`, de modo que a rota da T10 poderá lhe passar `LOCADO` se não mantiver `SituacaoInformavel` na borda — a proteção que a fatia 1 fechou é de **contrato (Zod)**, não de assinatura.
- **O que fazer:** exigir da T7 um CT que asserte os **dois** sentidos na mesma unidade (ativar ⇒ imóvel `LOCADO`; cancelar ⇒ `DISPONIVEL`) e um CT **negativo** que reprove se apenas uma das duas escritas ocorrer. Para a T10, manter explicitamente `SituacaoInformavel` na borda e **asseri-lo**.

### D25 · baixo · documentation · T5 · QA (rodada 2)
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T5.md:48`
- **Problema:** a §3.2 da task ainda declara `criarContrato(tx, dados, numero)`; a assinatura entregue é `criarContrato(tx, dados, serie: NumeroDaSerie)`.
- **Impacto:** quem envelheceu foi a task, não o código — a mudança fechou o achado de que a porta relia o ano. Mas a §3.2 é **o que a T6 lê** para escrever a borda que chama esta porta em duas unidades sequenciais, e ela ainda descreve a forma anterior.
- **O que fazer:** atualizar a §3.2 registrando em uma linha que o ano viaja junto do número **porque a borda abre duas unidades sequenciais e a virada do ano cabe entre elas** — ou corrigir na abertura da T6, que é a task que lerá a seção.

### D26 · BAIXO · project_pattern · T6 · Tech Review (rodada 2)
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T6.md:106` (§5.2), e as §5.2 de **T7, T8 e T10**
- **Problema:** a §5.2 não declara os arquivos-âncora de igualdade de conjunto que a task **obrigatoriamente** faz crescer.
- **Impacto:** a T6 tocou `packages/db/test/unidade-de-trabalho.spec.ts` (+98 linhas, inventário exato de símbolos do índice de `@sysloc/db`) e `apps/api/test/contexto.e2e.spec.ts` (+22, conjunto de rotas protegidas por igualdade), nenhum dos dois declarado. **É a terceira ocorrência do run** (após T3 e T4), o que a tira da classe de descuido pontual e a põe na de **convenção não escrita**. Cada rodada gasta a análise de escopo dos **dois** gates para reafirmar o que já foi decidido duas vezes, e o próximo executor não tem como saber pela task que precisa abrir esses arquivos — **o que convida a descobrir a âncora pela suíte vermelha, e daí a tentação de contê-la em vez de subi-la**.
- **O que fazer:** acrescentar as duas linhas à §5.2 da T6 e — **o que de fato paga** — às §5.2 de **T7, T8 e T10**, que publicam caminho novo (`/v1/contratos/{codigo}/ativacao`, `/cancelamento`, `/v1/imoveis/{id}/situacao-de-locacao`) e portanto farão `contexto.e2e.spec.ts` reprovar. **A T9 já se antecipou corretamente**: declara `lerContratosVigentesDeImoveis` como não publicada pelo índice, e por isso não toca o inventário.

### D27 · BAIXO · code_quality · T6 · Tech Review (rodada 2)
- **Onde:** `packages/db/src/cadastro-de-pessoa.ts:501` (`localizarPessoas`)
- **Problema:** a função troca **igualdade semântica de `uuid`** por **igualdade de cadeia**, e a pré-condição não está escrita.
- **Impacto:** a busca é `id = ANY(…::uuid[])` — comparação de `uuid`, **insensível à caixa** —, e o resultado volta num `Map` chaveado pelo `id` que o banco produz, **sempre minúsculo**. Quem chama recupera por `Map.get(fiadorId)`, que é igualdade **exata de cadeia**. As duas discordam quando o identificador vem em caixa alta: **a consulta acha a linha e o `Map.get` não**. A irmã singular `localizarPessoa` não tem essa aresta. **Não há defeito hoje** — `ESQUEMA_DO_IDENTIFICADOR` canoniza para minúsculas antes do serviço, e o consumidor previsto da T7 monta a lista a partir de linhas já lidas do banco. O risco é de **consumidor futuro**: quem passar identificador cru do cliente recebe `undefined` e a borda traduz em `404` — **recusa silenciosa de um cadastro que existe e é alcançável**, indistinguível da ausência legítima justamente porque o `404` é deliberadamente indistinguível (ADR-0008).
- **O que fazer:** acrescentar ao docblock a pré-condição (identificadores canonizados por `ESQUEMA_DO_IDENTIFICADOR`, porque a recuperação é por cadeia e a consulta é por `uuid`, e as duas só coincidem em caixa baixa). **Alternativa mais forte**, se o custo compensar: chavear o mapa por `pessoa.id.toLowerCase()` e recuperar com `fiadorId.toLowerCase()` — **fecha a classe em vez de documentá-la**.

### D28 · BAIXO · technical_requirement · T7 · executor (débito com gatilho)
- **Onde:** `apps/api/src/contratos/contrato.service.ts` (a constante `EFEITOS_DA_ATIVACAO`), com marcador `DÉBITO COM GATILHO` no ponto e linha no índice do `CLAUDE.md`
- **Problema:** a ativação **não gera as cobranças** do contrato. A declaração de efeito que a rota publica é o literal `efeitos: { cobrancasGeradas: false }`, fixado no esquema por `z.literal(false)`.
- **Impacto:** nenhum hoje — é decisão de escopo da fatia (RD-12), e o literal é deliberado: ele obriga quem for gerar cobrança a **tocar o contrato publicado** para afrouxá-lo, em vez de mudar o significado da resposta por omissão. O sistema antigo gera as parcelas no mesmo ato (`montar_dados_cobrancas_contrato`), e o golden **já capturou** os três cenários delas (`entrada.cobrancas` de `golden/contrato-ativacao.json`), incluindo a saturação do dia de vencimento em 28 e o texto da referência — de modo que o oráculo da F3 está pronto e versionado.
- **O que fazer (na F3):** afrouxar `esquemaDaAtivacaoDeContrato` para publicar quantas cobranças nasceram, gerar as parcelas dentro da **mesma unidade de trabalho** da ativação, e **remover o marcador e a linha do índice do `CLAUDE.md` no mesmo commit**. A prova de equivalência é contra `entrada.cobrancas`/`retorno.cobrancas` do golden, nunca por reimplementação lida do código legado.
- **Por que não agora:** `negocio.cobranca` não existe, e a competência, a referência e o vencimento saturado das parcelas são a entrega da F3 — antecipá-los aqui seria escrever a regra de outra fatia contra um oráculo que esta não prova.

### D29 · baixo · documentation · T7 · QA
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T8.md:14`
- **Problema:** `ErroDeTransicaoInvalida` foi declarado na §1 da T7 como símbolo público criado, **não existe no código**, e a **§1 da T8 declara consumi-lo da T7**.
- **Impacto:** a divergência **procede em substância** — a §10.1 da tech spec fixa a recusa como `CAMPO_INVALIDO | 422 | campo status | { estadoAtual, transicaoPedida }`, e `ErroDeTransicaoInvalida` aparece na §6.3 apenas como "Erro de Domínio Associado" **conceitual**. `ContratoService.exigirEstado` é o ponto único e **preserva as duas formas**: o CT-409 afirma `transicaoPedida: 'ALTERACAO'` e o CT-414 afirma `'ATIVACAO'`, os dois verdes; `transicaoPedida` é **parâmetro** justamente porque as duas transições partem do **mesmo** estado exigido e derivá-lo as tornaria indistinguíveis. **O Tech Review foi enfático**: a ausência está **certa**, e se a T8 criar a classe para "cumprir" a §1, nasce uma **segunda guarda com uma segunda forma de recusa** sobre um `detalhes` que é contrato publicado — o padrão exato dos débitos D12/D38/D40 desta base.
- **O que fazer:** antes de executar a T8, acertar a §1, a §3 e a §6.5 dela para nomear `ContratoService.exigirEstado` em vez de `ErroDeTransicaoInvalida`. Alternativamente, remover o símbolo da §1 da T7. **Nenhuma das duas toca código de produção.**

### D30 · baixo · documentation · T7 · QA
- **Onde:** `apps/api/test/contratos.e2e.spec.ts:131`
- **Problema:** a metade de **log** do cenário 6 da §6.4 não é provada nem declarada como divergência.
- **Impacto:** o cenário pede, além do desfecho de estado, *"linha `error` com a pilha, sem dado de negócio"*. O CT-413 (b) prova a metade **comportamental**, mas a falha é levantada dentro de uma unidade do **próprio teste** e nunca alcança o filtro global — **nenhuma linha `error` é produzida nem afirmada**. A convenção do arquivo é declarar divergências dessa natureza no cabeçalho, e foi seguida nas outras quatro.
- **O que fazer:** acrescentar um item à seção "DIVERGÊNCIAS DECLARADAS DA T7" registrando que a metade de log não é alcançável sem seam de produção (Iron Law #6), pela mesma razão já escrita para o desfecho de estado.

### D31 · baixo · tests · T7 · QA
- **Onde:** `apps/api/test/contratos.e2e.spec.ts:1935`
- **Problema:** literal `'6500.3899'` escrito à mão **ao lado da constante que ele deveria derivar** (`TOTAL_INGENUO_COM_RESIDUO = 6500.389999999999`).
- **Impacto:** se o par do resíduo mudar, a constante muda e o literal não — **a asserção passaria a não perseguir nada, em silêncio**. É o único ponto do delta em que um valor de contrato é redigitado.
- **O que fazer:** derivar da constante — `expect(derivada.texto).not.toContain(String(TOTAL_INGENUO_COM_RESIDUO))`, ou uma constante `PREFIXO_DO_RESIDUO_NO_TEXTO` definida a partir dela.

### D32 · baixo · documentation · T7 · QA
- **Onde:** `CLAUDE.md:321`
- **Problema:** a frase *"Um já disparou e segue aberto — o D28, na F1/T2"* ficou **ambígua** com dois D28 no índice.
- **Impacto:** a linha é anterior à T7 e nomeia o débito **pelo número solto**, o que a §3-B proíbe justamente porque o identificador é o par `Dnn · F{n}/{origem}`. Com o `D28 (F2/T7)` agora no mesmo índice, a frase deixa de identificar qual dos dois disparou. O aviso que a T7 acrescentou mitiga, mas **não desambigua esta linha**.
- **O que fazer:** trocar por *"o **D28 (F0/T5)**, na F1/T2"*.

### D33 · BAIXO · project_pattern · T7 · Tech Review
- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:592`, `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts:639`, `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:342`
- **Problema:** **contagens narrativas envelheceram** em três âncoras revisadas à mão, enquanto as **executáveis subiram corretamente**.
- **Impacto:** o docblock de `ESQUEMAS_POR_ROTA` diz "As **39** rotas" e a tabela tem 40; o de `PARES_DA_FATIA_DE_CONTRATOS` diz "Os **seis** pares" e a constante carrega sete; o `describe` de `autorizacao-do-dominio` segue "as três provas … sobre as 33 rotas" com **quatro** casos dentro. Nenhum caso prova menos — as asserções derivam das funções, não da prosa. **O custo é na superfície de revisão**: a próxima task lê "39" sobre uma tabela de 40 e o desfecho provável é *"corrigir" o número executável para baixo* — exatamente o modo de falha que o docblock de `ROTAS_DE_ESCRITA` nomeia por escrito. **Com T8, T9 e T10 ainda por vir tocando os mesmos inventários, o ruído é cumulativo.**
- **O que fazer:** três edições de uma linha — "As **40** rotas"; "Os **sete** pares … de cadastro (T6) e a ativação (T7)"; e o `describe` sem o numeral, já que o número vive nas âncoras logo abaixo.

### D34 · BAIXO · code_quality · T7 · Tech Review
- **Onde:** `apps/api/src/contratos/contrato.service.ts:315-316` e `:730`
- **Problema:** `transicaoPedida` é **`string` solto**, enquanto o estado irmão da mesma recusa é preso à união fechada — **e a T8 acrescenta o terceiro valor**.
- **Impacto:** `ALTERACAO` e `ATIVACAO` são literais sem anotação. Uma linha acima, o docblock de `ESTADO_ALTERAVEL`/`ESTADO_ATIVAVEL` declara o princípio **oposto** e a razão: *"a anotação é `EstadoDoContrato` porque literal fora da união fechada não compila"*. Os dois valores viajam no **mesmo** objeto `detalhes` da **mesma** recusa, e os dois são contrato publicado — mas só um tem o compilador atrás. Um `'CANCELAMETO'` na T8 compila, passa build e lint, e só é pego pelo caso E2E da própria T8 — rede real, mas **tardia**, e que depende de o executor não copiar o typo do produto.
- **O que fazer:** declarar `type TransicaoPedida = typeof ALTERACAO | typeof ATIVACAO` (estendida para `'CANCELAMENTO'` em T8) e trocar a assinatura. **Duas linhas, e a T8 herda o ponto de extensão nomeado.**

### D35 · BAIXO · architecture · T7 · Tech Review
- **Onde:** `apps/api/src/contratos/contrato.service.ts:80-87` (o cabeçalho) e `packages/db/src/contrato.ts:956` (`ativarContrato`)
- **Problema:** a janela de corrida entre o `PUT` e a ativação deixa **derivações defasadas**, e o cabeçalho **atribui à porta uma cobertura que ela não tem**.
- **Impacto:** o cabeçalho diz *"quem fecha essa janela é o envoltório `gravarSobIndiceDeVigencia` da porta"* — exato para **uma** das duas classes (a colisão com o índice de vigência, que vira `422` em vez de `500`). **Não alcança a outra**: `ativarContrato` grava `WHERE codigo = $1`, **sem predicado de `status`**, e as duas derivações são calculadas em memória a partir do `atual` lido na etapa 1. Em READ COMMITTED, um `PUT` concorrente que commite entre o `SELECT` e o `UPDATE` faz a ativação gravar `ATIVO` com derivações dos **termos antigos** sobre os **termos novos**. O `RETURNING` devolve a linha já misturada — **o CT-413 não tem como acusar**, e o índice tampouco (ele só olha `imovel_id` sob `status='ATIVO'`). Resultado: contrato `ATIVO` com `valorTotalContrato ≠ valorMensal × prazoMeses`, **base do PDF e das cobranças da F3**. Exige duas requisições concorrentes da mesma empresa sobre o mesmo contrato em milissegundos, num domínio de dezenas de contratos por ano — improvável, e **corrida de backend em MVP é não-objetivo declarado dos gates**. Vale para a T8 pela forma idêntica, com exposição menor.
- **O que fazer:** **nenhuma mudança de comportamento é pedida.** O que fecha o achado é uma frase no cabeçalho delimitando o que a porta cobre — o envoltório fecha a corrida **do índice de vigência**; a guarda de estado e as derivações continuam sendo leitura-antes-de-gravar. Se a fatia quiser fechá-lo de fato (decisão de spec), o caminho barato é `AND status = 'RASCUNHO'` no `WHERE` de `ativarContrato`, com a ausência de linha traduzida como **conflito de estado** — nunca como o `404` que `exigir()` hoje produziria.

### D36 · BAIXO · technical_requirement · T8 · executor (débito com gatilho)
- **Onde:** `apps/api/src/contratos/contrato.service.ts` (o corpo de `ContratoService.cancelar`), com marcador `DÉBITO COM GATILHO` no ponto e linha no índice do `CLAUDE.md`
- **Problema:** a pré-condição legada **"sem PDF privado, não cancela"** não é portada (RN-13). No sistema antigo ela é a **primeira** coisa que `cancelar_contrato` faz — `obter_pdf_privado_bytes("Contrato", name, "pdf_contrato_arquivo")`, com queda para `decodificar_pdf_base64(contrato.pdf_contrato)` e `frappe.throw` se nenhum dos dois render bytes.
- **Impacto:** nenhum hoje, e a ausência é **decisão de escopo**, não esquecimento. Portada literal, ela tornaria o cancelamento **impossível nesta fatia** (o PDF do contrato é entrega da F3) e **permanentemente impossível** para todo contrato sem PDF anexado — inclusive os que a virada importar. É acidente do desenho legado: lá o cancelamento **existe para** carimbar o PDF (`aplicar_marca_cancelado_em_pdf_bytes` + `salvar_pdf_privado`), e a guarda protege o carimbo, não o negócio. O golden a captura na recusa `contrato_sem_pdf` de `golden/contrato-cancelamento.json`, de modo que o oráculo da decisão futura já está versionado. **A ausência tem prova**: o `CT-415` cancela um contrato com `pdfContratoArquivo: null` e recebe `200` — se a pré-condição nascesse, aquele caso reprovaria.
- **O que fazer (na F3):** decidir se o carimbo "CANCELADO" no PDF é **pré-condição** do ato ou **efeito** dele. Se for efeito — que é a leitura provável, porque o cancelamento é do negócio e o documento é consequência —, o débito fecha **sem guarda alguma**: basta gerar o PDF carimbado dentro da mesma unidade de trabalho. Se for pré-condição, ela entra como recusa de domínio nomeando o campo, e o `CT-415` passa a arranjar o PDF. Nos dois casos, **remover o marcador e a linha do índice do `CLAUDE.md` no mesmo commit**.
- **Por que não agora:** não há o que conferir — `pdf_contrato_arquivo` existe como coluna e nenhum caminho desta fatia o preenche. Antecipar a guarda seria escrever a regra de outra fatia contra uma decisão que ainda não foi tomada, com o efeito colateral de tornar a rota inalcançável no marco de entrega.

### D37 · baixo · documentation · T8 · QA
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T8.md:147` (§6.4) e `:181-182` (§6.6)
- **Problema:** a task escreve `transicaoPedida: 'ATIVO'` / `'CANCELADO'` — o nome do **estado** — onde a implementação publica `'ATIVACAO'` / `'CANCELAMENTO'` — o nome do **ato**.
- **Impacto:** **a implementação está certa** e mudá-la seria regressão de contrato publicado na T7 (é o vocabulário que a T7 estabeleceu e que a §10.1 da tech spec fixou). O problema é o **registro**: o cabeçalho de `contratos.e2e.spec.ts` mantém uma seção "DIVERGÊNCIAS DECLARADAS DA T8" com **cinco** itens, exaustiva a ponto de declarar a ausência de `contratoVigente` — e esta divergência, que incide sobre **campo de contrato publicado**, não está entre eles. O leitor seguinte que comparar a §6.6 com o teste encontra o desencontro **sem a nota que diz qual dos dois lados é o certo**.
- **O que fazer:** acrescentar um sexto item à seção de divergências, nos moldes dos cinco existentes — a task nomeia o ato pelo estado, o valor publicado é o do ato, e "corrigir" o teste em direção ao texto da task **regrediria o contrato**. Opcionalmente, corrigir as duas linhas da T8.md.

### D38 · BAIXO · project_pattern · T8 · Tech Review
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/_run/run-report.md:228` (o bloco do **D35**)
- **Problema:** o D35 **não nomeia a rota de cancelamento** nem a segunda manifestação que a T8 criou — e a promessa de **não-idempotência agora é publicada**.
- **Impacto:** o **Onde** do D35 lista só `contrato.service.ts:80-87` e `ativarContrato`, alcançando a T8 por uma cláusula de passagem. Mas a T8 acrescentou algo que **não é a forma idêntica**: ela passou a **publicar** a consequência como contrato — a descrição OpenAPI diz *"a operação não é idempotente por decisão — repetir recebe `422` com `estadoAtual: CANCELADO`"*. **A afirmação é verdadeira em série e falsa sob concorrência**: dois cancelamentos simultâneos do mesmo contrato `ATIVO` leem ambos `ATIVO` em READ COMMITTED, o segundo `UPDATE` bloqueia, reavalia e — **sem predicado** — casa de novo, e **os dois recebem `200`**. É exatamente o padrão que o D35 abriu para nomear: cabeçalho que atribui cobertura que o código não tem. **O modo de falha grave adjacente NÃO é alcançável** (verificado): cancelar C1 concorrente com ativar C2 sobre o mesmo imóvel é **serializado pelo índice parcial**, de modo que o `LOCADO` sempre pousa depois do `DISPONIVEL`. O custo é na fatia que fechar o D35: lendo *"Onde: `ativarContrato`"*, ela aplica o predicado numa rota e deixa a outra com **uma promessa publicada sem lastro** — e a do cancelamento é a que está **no documento OpenAPI que o handoff do frontend entrega**.
- **O que fazer:** duas linhas na §2, **sem tocar código**: acrescentar ao **Onde** do D35 `packages/db/src/contrato.ts:993` (`cancelarContrato`) e `apps/api/src/contratos/contrato.service.ts:707`; e registrar no **Impacto** que a T8 publicou a não-idempotência, de modo que fechar a corrida do cancelamento é o que torna a afirmação publicada verdadeira — com a mesma ressalva que o D35 já escreve (a ausência de linha traduzida como **conflito de estado**, nunca como `404`).

### D39 · baixo · documentation · T9 · QA
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T9.md:96` (§5.2)
- **Problema:** as **três divergências** da §5.2 não foram registradas na task.
- **Impacto:** a §5.2 declara dez arquivos; **oito** foram modificados. `contrato-publicado.e2e.spec.ts` **não precisou** (o corpo esperado **deriva** de `esquemaDoImovel` — ADR-0016 — e o CT-328 percorre recursivamente, então o campo entra **por consequência**); `circulacao-de-cadastro.e2e.spec.ts` **não precisou** (compara resposta contra resposta, nunca contra literal). Em compensação, `packages/contracts/test/esquemas.spec.ts` **precisou e não estava listado**. O item 8 do §4 foi marcado com o texto "as quatro suítes da fatia 1 alteradas" quando **duas** foram alteradas e duas não precisaram — a **substância** do critério está satisfeita, a **letra** não. O próximo leitor encontra uma §5.2 que não descreve o entregue e **perde a justificativa** de por que dois arquivos ficaram intocados.
- **O que fazer:** acrescentar à §7 da T9 um parágrafo com as três divergências e a razão de cada uma; qualificar o item 8 do §4 para *"as suítes da fatia 1 que comparam corpo por igualdade contra literal"*.

### D40 · baixo · documentation · T9 · QA
- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:121`
- **Problema:** o cabeçalho declara uma disciplina que o campo novo deixou de cumprir.
- **Impacto:** o arquivo declara que os registros são criados *"com todos os campos opcionais preenchidos, para que nenhum campo escape da varredura do CT-328 por estar nulo"*. `contratoVigente` é sempre `null` naquele cenário e `percorrer` retorna cedo em `null`, de modo que a subárvore nunca é visitada. **A perda de detecção é NULA na prática** (verificada): `percorrer` só reprova nomes de `CAMPOS_NUMERICOS`, `LISTAS_FECHADAS` e `retiradoEm`, e nenhum campo da subárvore pertence a esses conjuntos; o valor não-nulo é exercitado pelo CT-419 nas três superfícies e pelo CT-335 contra o esquema. **O que ficou desatualizado é a frase**, não a cobertura — e frase de invariante que deixou de valer é o começo de uma leitura errada.
- **O que fazer:** acrescentar uma linha declarando `contratoVigente` como a exceção conhecida, com a razão. Alternativa (mais cara, sem ganho medido): montar um contrato ativo em `montarCenarioCompleto`.

### D41 · MEDIO · project_pattern · T9 · Tech Review
- **Onde:** `packages/db/src/index.ts:144`
- **Problema:** a **quarta** ausência deliberada do índice de `packages/db` não foi registrada no docblock do índice.
- **Impacto:** `lerContratosVigentesDeImoveis` é exportada do módulo e **deliberadamente ausente** do índice; a razão foi escrita só no cabeçalho de `contrato.ts`. Mas **o índice é o registro que o projeto usa** para enumerar cada ausência e o porquê — ele o faz para `lerImoveisDeConjuntos` (`:101`), `lerComodosDeImoveis`/`contexto-de-escrita.js` (`:114`) e `lerFiadoresDeContratos` (`:144`). **A seção de `./contrato.js` continua dizendo que UMA coisa não sai de lá, quando agora são duas.** E **não há teste mecânico** assertando a lista de exportações do índice, de modo que esse docblock é o **único** registro — e é a completude dele que torna verificável a afirmação de que o alcance a `negocio` é enumerável a partir da borda. O risco é de **erosão do registro**: o próximo símbolo contido tende a seguir o precedente mais recente e ficar igualmente fora.
- **O que fazer:** estender a frase da linha 144 para nomear as **duas** ausências, com a razão própria da segunda (publicá-la ofereceria a `apps/api` um caminho para ler contrato **por imóvel** fora das portas que o contrato publica). **Edição de comentário, sem efeito em código.**

### D42 · BAIXO · security · T9 · Tech Review
- **Onde:** `packages/contracts/src/imovel.ts:106-140` (o docblock de `esquemaDoContratoVigente`)
- **Problema:** **a fronteira da divulgação entre áreas passa a existir sem estar escrita em lugar nenhum.**
- **Impacto:** a partir da T9, `contratoVigente.codigo`, `.locatario.id` e `.locatario.nome` trafegam nas três superfícies governadas por **`TELA:imoveis`** — dados cujas rotas próprias exigem **outras áreas** (`TELA:contratos` e `TELA:cadastros`). Como os ajustes por usuário são **bidirecionais** (ADR-0010), um usuário com `TELA:imoveis` e **sem** as outras duas passa a ler o código do contrato e a identidade do locatário. **Isto É a US-11** e reproduz o `mapByName` que o frontend legado já fazia por N+1 — **não é defeito**: é escopo aprovado, o recorte é mínimo (nem documento, nem e-mail, nem telefone, nem endereço atravessam) e a fronteira de empresa continua sendo do banco. **O que não existe é o registro da fronteira**: a §11.2 raciocina exaustivamente sobre as chaves declaradas pelas 9 rotas e é **silenciosa sobre o alargamento do corpo**. Sem ela escrita, o próximo campo pedido pela tela (`locatario.telefone`, `locatario.documento`) entra **por consequência**, sob a mesma exigência, sem que nada obrigue a reabrir a pergunta.
- **O que fazer:** um parágrafo no docblock declarando (a) que este é o **único** ponto em que a superfície de `TELA:imoveis` publica dado governado por outra área; (b) que o recorte é o mínimo que a US-11 exige; (c) que **qualquer campo adicional de pessoa aqui é decisão de autorização, não de tela**, e exige registro próprio. **Não** exigir conjunção nas rotas de imóvel — reabriria a US-11 e quebraria o CT-419.

### D43 · BAIXO · adr_compliance · T10 · Tech Review
- **Onde:** `apps/api/src/imoveis/imovel.controller.ts` (o cabeçalho, na seção *"A rota de SITUAÇÃO DE LOCAÇÃO exige apenas a ÁREA"*), com marcador `DÉBITO COM GATILHO` no ponto e linha no índice do `CLAUDE.md`
- **Problema:** `POST /v1/imoveis/:id/situacao-de-locacao` cumpre **metade** da `Decision` da ADR-0019. A metade da forma — *"rota própria, nunca campo em atualização do recurso"* — é obedecida ao pé da letra; a metade da governança — *"governada pela chave de ação sensível correspondente do catálogo fechado"* — **não é satisfeita**, porque não existe ação sensível para esta transição e o catálogo é fechado pela ADR-0011.
- **Impacto:** **nenhum hoje, e a divergência é decisão do usuário, não esquecimento.** A emenda da ADR foi **oferecida e adiada** na sessão de challenge desta fatia (registro em `_run/workflow-report.md`), e o código cumpre a decisão adotada ao pé da letra — a rota exige `TELA:imoveis`, e reusar `ACAO:excluir_cadastro` foi avaliado e descartado (a própria ADR-0019 rejeita o reuso nominalmente nas Alternativas: *"são efeitos diferentes"*). **O defeito estava no registro, não na escolha**: o débito foi aceito com **prazo** — o congelamento da superfície da API para o handoff —, e até 2026-08-09 a única coisa que o levava até lá era um parágrafo de prosa no docblock do controlador. É exatamente o modo de falha que a §3-B da `.claude/rules/nao-regressao.md` nomeia: quem chegar ao congelamento abre o `CLAUDE.md`, não o cabeçalho do controlador. Depois do congelamento, a divergência entre o texto da ADR e a superfície publicada deixa de ser corrigível sem custo de contrato, porque o documento entregue ao frontend passa a citá-la.
- **O que fazer (antes do handoff):** rodar `/agent-spec-adr-supersede 0019`, recortando do `Decision` o caso *"atributo operacional que não é ato sensível"* e nomeando a **situação de locação do imóvel** como a instância — é o recorte que a leitura adotada já aplica, e superseder é o único caminho legítimo para mudar ADR ativa. A alternativa (criar `ACAO:definir_situacao_de_locacao`) contraria a ADR-0011 e **não deve ser tomada sem supersedê-la também**. Fechado o débito, **remover o marcador do controlador e a linha do índice do `CLAUDE.md` no mesmo commit**.
- **Por que não agora:** a T10 não tem mandato para emendar ADR — o caminho é a skill de supersede, e a decisão de adiar é do usuário. Criar a chave por conta própria trocaria uma divergência declarada por uma violação silenciosa de outra ADR ativa.

### D44 · baixo · concurrency · T10 · QA
- **Onde:** `apps/api/src/imoveis/imovel.service.ts:246`
- **Problema:** a janela de corrida da guarda de vigência **não tem marcador `DÉBITO COM GATILHO`**, e o docblock a **equipara indevidamente** à guarda de estado do contrato.
- **Impacto:** `definirSituacaoDeLocacao` é leitura-antes-de-gravar; uma ativação concorrente que commite entre a leitura e a escrita deixa `contrato.status='ATIVO'` ao lado de `imovel.status_locacao` divergente — **exatamente o par que o CT-434 declara irrepresentável**. O docblock **declara** a janela (correto), mas afirma que ela é *"a mesma da guarda de estado do contrato"* — e a equivalência é falsa no ponto que importa: lá o índice `contrato_imovel_vigente_uidx` **fecha** a janela no banco; **aqui não existe restrição alguma pareando as duas colunas**, e o próprio `REVERTER EXIGE` do marcador `DECISÃO FECHADA` reconhece isso. **Não é regressão da T10** — antes dela o furo era **determinístico** (todo `PUT` apagava o `LOCADO`); a T10 o estreita para uma janela concorrente e a declara.
- **O que fazer:** emitir `DÉBITO COM GATILHO` no ponto da guarda, com `QUANDO FECHA` = *"a fatia que introduzir no banco a restrição que pareia `contrato.status = 'ATIVO'` com `imovel.status_locacao`"*, mais a linha no `CLAUDE.md`; e corrigir a frase para dizer que **lá o índice fecha a janela e aqui nada a fecha**.

### D45 · baixo · documentation · T10 · QA
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tech_spec.md:807` (§11.2), e as linhas 1212 e 1214
- **Problema:** o tech spec continua escrevendo **`77`** em três pontos, com o raciocínio aritmético que a medição **refuta**.
- **Impacto:** a varredura mede **75** pares, e a T10 registrou a divergência na task e no docblock — mas o tech spec não foi tocado. A §11.2 justifica o `+2` com *"cada rota GET entra em dobro na tabela do roteador (GET e HEAD)"*, e **essa premissa é falsa** contra o módulo implementado: `cobertura-de-autorizacao.ts` **suprime explicitamente** o `HEAD` derivado de `GET` (linhas 356 e 401) — é por isso que a T6 contou **6 pares para 6 rotas**, das quais duas eram `GET`. Número desatualizado em artefato de spec **convida a próxima task a "corrigir" a âncora do teste para o valor errado** — o modo de falha que o docblock de `ROTAS_DE_ESCRITA` já nomeia nesta base. **Os dois gates confirmaram os 60 manipuladores por varredura independente**, o que localiza o erro na **soma do total**, não no escopo entregue.
- **O que fazer:** corrigir §11.2 para `66 | 75 | +9`, **removendo a justificativa do `+2` por `HEAD` derivado**, e atualizar as linhas 1212 e 1214 para `rotasEnumeradas === 75`.

### D46 · baixo · documentation · T10 · QA
- **Onde:** `docs/specs/features/contratos-de-locacao/v1/tasks/T10.md:119` (§5.2)
- **Problema:** a §5.2 não declara os **quatro** arquivos de arrasto — **o D26 reaparece pela quinta vez**.
- **Impacto:** `packages/contracts/test/esquemas.spec.ts`, `apps/api/test/autorizacao-do-dominio.e2e.spec.ts`, `apps/api/test/contexto.e2e.spec.ts` e `packages/db/src/index.ts` foram tocados fora da §5.2, **todos por arrasto direto e legítimo** (verificado). O problema é de **registro**: a recomendação literal do D26 (F2/T6) era declarar `contexto.e2e.spec.ts` nas §5.2 de **T7, T8 e T10**, e a T10 novamente não o fez. **Um débito cuja recomendação é ignorada cinco vezes deixou de ser débito e virou ruído.**
- **O que fazer:** registrar de uma vez que o D26 vale para **toda** task que publique rota nova, e **fazer o gerador de tasks incluir `contexto.e2e.spec.ts` e `cobertura-de-autorizacao.e2e.spec.ts` por padrão** em task que publica rota. É candidato forte a **regra do framework** — os dois gates o disseram.

### D47 · baixo · documentation · T10 · QA
- **Onde:** `apps/api/test/contratos.e2e.spec.ts:160`
- **Problema:** a divergência declarada aponta o `CT-319` como cobertura do cenário 4 da §6.4, e **o `CT-319` não alcança a rota nova**.
- **Impacto:** o cabeçalho justifica não exercitar *"rota de situação sem `TELA:imoveis` → `403`"* dizendo que o eixo é do `CT-319`. Verificado: `rotasDoDominio` é **lista literal fixa de 33 rotas da fatia anterior**, e a rota nova **não está nela**. O eixo comportamental do `403` sobre a rota nova **não é exercitado por teste algum** — o que existe é a prova **estrutural** do `CT-427` (`exigenciaEfetiva === ['TELA:imoveis']`, `semDeclaracao === []`) mais o comportamento da guarda provado sobre **outras** rotas da mesma área. **É cobertura defensável** (a guarda tem ponto único e a exigência efetiva é afirmada por igualdade exata) — o defeito é **a frase**, que afirma cobertura que não existe e vai fazer a próxima revisão concluir *"já está coberto"* sem conferir.
- **O que fazer:** reescrever a divergência 3 para dizer o que é verdade; ou acrescentar a rota a `rotasDoDominio` e subir a âncora de 33 para 34.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

- **A premissa de `sudo` da T1 é falsa e vale corrigir nos artefatos.** A §7 da task e a §6 do `task_plan.md` afirmam que `verificar-captura.sh` exige `sudo` e que "nenhum subagente o executa". `grep -c sudo` em `deploy/scripts/caracterizacao/*.sh` devolve **zero** — o acesso ao `/opt/frappe` é por `docker compose`, que o usuário `sysloc` tem sem elevação. A afirmação é herdada dos verificadores de `deploy/scripts/instalacao/`, esses sim privilegiados. A execução foi conduzida pelo orquestrador de qualquer forma, por ser contra o sistema em produção — decisão que continua certa pela razão certa.
- **Dois achados de detecção (D1, D2) foram provados por mutante, não inferidos por leitura.** O QA extraiu o bloco Python do CT-433 e o executou contra cópias mutadas num sandbox descartável: seis mutantes reprovando (incluindo os três cenários de erro da §6.4) e dois mutantes **passando** — os que expõem os vãos. Merecem atenção acima do peso de "médio anotável": este verificador é a única rede que sobrevive à F7.
- **A captura consumiu três rodadas do fluxo contra o `/opt/frappe`.** A segunda foi erro de sequência do orquestrador (invocar `verificar-captura.sh` sem `capturar.py` antes), e produziu falsos sinais de não-determinismo em `contrato-cancelamento.json` que a terceira rodada desmentiu. O D5 existe para que a próxima pessoa não pague esse diagnóstico de novo.
- **Determinismo provado de forma mais forte do que a suíte exige**: os dois artefatos novos foram levados ao índice após a primeira captura, e uma segunda captura completa — site efêmero **restaurado do zero a partir de um dump novo** — os reproduziu byte a byte.
- **Uma lacuna de oráculo fica declarada e sem débito**, por decisão dos dois gates: o ramo `baixas_sicoob.solicitadas/erros` do cancelamento não foi capturado porque alcançá-lo exigiria boleto real e conexão mTLS contra a instituição financeira a partir de um site sintético — efeito externo e irreversível que a ADR-0006 não admite. O registro vive no `PROCEDENCIA.md` §4, que é o que a F3 e a F4 vão ler; durabilidade maior que uma linha aqui.
- **Achado de produto preservado sem correção**, como manda a convenção de caracterização: `min(dia_vencimento, 28)` é inalcançável pelo caminho real, porque a validação recusa dia fora de 1..28 antes. O golden grava os dois fatos lado a lado sem corrigir nem remover o `min`.

### T3 — três rodadas, e o que elas ensinaram

- **A T3 é a única task da fatia até aqui que precisou de correção**, e as duas rejeições foram do Gate 2. A primeira pegou um defeito que nenhuma outra rede pegaria: a migração autoral `0008` ficou fora do `meta/_journal.json`, e o `drizzle-kit` tira o número da próxima migração **do último item do journal, não do diretório** — a fatia seguinte teria emitido um segundo `0008_*.sql`. O executor **reproduziu a colisão** (`0008_kind_toro.sql`) antes de corrigir.
- **O executor falsificou a premissa do revisor antes de aplicar a correção, e estava certo.** O Tech Review sugerira copiar `0007_snapshot.json` para `0008_snapshot.json` "byte a byte", inferindo isso do tamanho igual dos precedentes. A medição mostrou que os pares diferem exatamente em `{id, prevId}`, e que **a cópia literal seria ativamente destrutiva** — dois snapshots com o mesmo `prevId` fazem o `validateWithReport` abortar por colisão. O revisor reconheceu o erro na rodada seguinte e declarou a conduta exemplar, sem penalidade. **É o comportamento que o P2 do Protocolo Antirregressão existe para produzir.**
- **A segunda rejeição foi pelo P4, não pelo código**: a correção do journal fechou *o caso* e não *a classe* — nada reprovaria a próxima migração autoral que ficasse de fora. A rede resultante (`coerencia-de-migracoes.spec.ts`) compara duas fontes independentes por igualdade ordenada, com o lado esquerdo derivado do disco, de modo que **toda migração futura entra sozinha na cobertura**. Quatro mutantes a provam, dois deles autorais do próprio QA.
- **Uma decisão de forma foi deliberada em dois gates e vale registrar**: o caso da rede recebeu `RG-T3-01`, **fora** da faixa `CT-401`–`CT-434`. A `testing-stack.md` é **silenciosa** sobre como identificar caso que nasce de correção de gate, e o silêncio forçou a deliberação. O veredito: a letra da rule governa caso *planejado* (`CA → CT`), este parte de veredito de gate, e um `CT-4xx` inventado seria **pior** — faria o caso passar por planejado e desalinharia a distribuição contra `_run/test-cases.json`. **É candidato a regra de projeto.**
- **Dois riscos remanescentes que o Tech Review registrou sem abrir achado**, e que a próxima migração autoral precisa saber: (1) a rede guarda a coerência diretório ↔ journal e **não alcança** `meta/{idx}_snapshot.json` — o vizinho de porta ficou sem guarda; (2) a rede é hoje a **única** guarda de uma convenção que nenhuma rule escreve, e apagar o arquivo não quebra build, lint nem qualquer outro caso.


---

## Fecho da fatia — notas finais

**As três fases fecharam. 10/10 tasks aprovadas nos dois gates, nenhuma bloqueada.** Suíte de **541 → 664** casos, com crescimento monotônico: **nenhum pacote encolheu em nenhuma das 16 rodadas de gate**. `pnpm build` e `pnpm lint` verdes.

**Quatro tasks precisaram de correção**, e o que cada uma ensinou:

- **T3 (3 rodadas)** — a única com duas rejeições. A primeira pegou um defeito que nenhuma outra rede pegaria: a migração autoral `0008` fora do `meta/_journal.json`, e o `drizzle-kit` tira o número da próxima migração **do journal, não do diretório**. A segunda foi **pelo P4, não pelo código**: a correção fechou *o caso* e não *a classe*. E o executor **falsificou a premissa do revisor** antes de aplicar — os snapshots não são cópia byte a byte, precisam encadear `prevId`, e a cópia literal **abortaria** por colisão. O revisor reconheceu o erro na rodada seguinte.
- **T5** — o revisor apontou que `alterarContrato` escreve `imovel_id`, **a chave do índice de vigência**, e que a frase do docblock que dispensava a tradução **era falsa**. O executor recusou o caminho mínimo que o revisor preferia, com argumento concreto (a RD-05 é leitura-antes-de-gravar e **não fecha nem depois de existir**), e o revisor concordou: *"eu otimizei tamanho de diff em cima de fechamento de classe"*.
- **T6** — uma consulta por fiador, em laço, sobre coleção que a RD-06 declara **sem teto**: ~26 mil UUIDs cabem no `bodyLimit`, e o pool é **compartilhado entre tenants**. A tech spec já avaliara o custo, mas **pelo eixo da escrita**; o eixo das N **leituras** nasceu naquela task.
- **T10** — não foi correção de defeito: foi a **escrituração de um anotável com prazo**.

**Três premissas de artefato foram refutadas por medição durante o run**, e as três estão registradas como débito:
1. O `sudo` da T1 (`grep -c sudo` = **zero** nos scripts de caracterização).
2. O alerta que o próprio Tech Review deixou na T4 — *"o golden é cego à multiplicação ingênua"* — **era falso**: `numeric(15,2)` normaliza o resíduo no `RETURNING`, e o erro do float no teto do domínio (0,00222) é **menor que meio centavo**. O QA confirmou com **400 mil sorteios**.
3. A superfície de **77 rotas** da §11.2: a medição dá **75**, e a premissa do `+2` por `HEAD` derivado é **falsa contra o módulo implementado**, que o suprime explicitamente. **Os manipuladores batem exatamente** (51 → 60), o que localiza o erro **na soma do total, não no escopo entregue** (**D45**).

**O que o marco de entrega recebe, e a única condição pendente:** a superfície está coerente — 75 rotas, 60 manipuladores, `semDeclaracao` vazio, 42 rotas do domínio com esquema derivado de `@sysloc/contracts`. **O congelamento fica condicionado à decisão do D43**: a rota de situação de locação obedece a metade *"rota própria"* da ADR-0019 e **não** a metade *"governada por ação sensível"*, porque **não existe chave correspondente** e a ADR-0011 proíbe criar. **A decisão já é do usuário** (registrada na sessão de challenge, que adiou a emenda), e o marcador `DÉBITO COM GATILHO` agora existe para que ela **chegue ao congelamento** em vez de depender de alguém lembrar. **Rodar `/agent-spec-adr-supersede 0019` antes do handoff é o remédio nomeado.**

**Ressalva para o handoff**: os esquemas de **entrada** não aparecem no documento OpenAPI, porque **nenhum** controlador desta base descreve corpo de requisição. É consistente e registrado, mas o `handoff-frontend.md` precisa deixar explícito que **os corpos de requisição viajam pelo pacote `@sysloc/contracts`, não pelo documento**.

**Dois defeitos foram do orquestrador**, e ficam registrados: o one-liner Python que truncou `tasks/T4.md` a zero byte (o executor detectou e restaurou), e o `task_plan.md` que manteve a T4 em `Em Progresso` até o Tech Review da T10 acusar (P3). Os dois foram corrigidos.

**O débito D26 reapareceu pela quinta fatia consecutiva** — a §5.2 não declarar os arquivos-âncora que a publicação de rota ou de símbolo faz crescer. Os dois gates o classificaram como **candidato forte a regra do framework**, e ele está no `_run/rule-candidates.md` como `convention_drift`.
