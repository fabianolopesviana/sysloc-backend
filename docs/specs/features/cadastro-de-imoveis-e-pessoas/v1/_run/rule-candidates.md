# Rule candidates — cadastro-de-imoveis-e-pessoas/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Asserção de recusa de esquema nomeando o campo

**Regra que isto sugere:** padronizar a asserção de recusa de esquema Zod num acessório único que afirme desfecho, código do problema e campo nomeado.

**O que ela faria (simples):** o mesmo formato de asserção — conferir `success === false` e em seguida o `path`/`keys` do primeiro problema — foi reescrito em quatro pontos independentes do arquivo, um por caso de teste. Uma regra apontando o acessório evitaria que uma das cópias afirmasse menos que as outras (só o desfecho, sem o campo), que é o modo pelo qual uma recusa passa a ser provada mais fraca em um lugar do que nos demais.

- Evidência: asserção de recusa com campo nomeado em 4 locais distintos (`success === false` + `issues[0].path`/`issues[0].keys`) — `packages/contracts/test/esquemas.spec.ts:144`, `:260`, `:282`, `:363` — `T1 / pacote @sysloc/contracts, suíte de esquemas`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-05

---

## [convention_drift] Canonização de campo na borda do contrato

**Regra que isto sugere:** todo campo de entrada com forma canônica conhecida é canonizado no esquema do contrato, num ponto único, e nunca a jusante.

**O que ela faria (simples):** o projeto já aprendeu na F1 — ao custo de quatro rodadas de gate sobre uma escalada de privilégio — que caixa e máscara divergentes entre as pontas produzem defeito silencioso, e por isso canoniza UUID, e-mail e documento no próprio esquema. A regra nunca foi escrita: vive só na prosa de um marcador `DECISÃO FECHADA` dentro de um controlador. Sem ela escrita, o pacote de contratos novo canonizou três campos e deixou dois de fora, um deles com uma justificativa que não se verifica. A regra tornaria a decisão verificável na revisão, em vez de depender de quem leu qual comentário.

- Evidência: no mesmo bloco de campos, `documentoPrincipal` remove a máscara e `cep` a recusa; `email` vira minúsculas e `estado` conserva a caixa que o cliente enviou — `packages/contracts/src/comum.ts:53`, `:139`, `:144`, `packages/contracts/src/pessoa.ts:37`, `:44` — `T1 / esquemas de entrada de imóvel e de cadastro de pessoa`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-05

---

## [repeated_assertion_shape] Controle verde da guarda de cobertura

**Regra que isto sugere:** o controle "schema íntegro" da guarda de isolamento sai de um auxiliar nomeado, em vez de repetir o objeto literal por caso.

**O que ela faria (simples):** a mesma asserção — `expect(cobertura).toEqual({ excecoes: [], tabelasExaminadas: TABELAS_LEGITIMAS })` — foi reescrita sete vezes no arquivo, e cada tabela nova da próxima fatia obriga a percorrer as sete outra vez. Uma regra apontando um auxiliar único faria a atualização acontecer num lugar só, sem afrouxar a igualdade que dá valor à asserção.

- Evidência: objeto de controle `{ excecoes: [], tabelasExaminadas: TABELAS_LEGITIMAS }` repetido em 7 pontos — `packages/db/test/catalogo.spec.ts:457`, `:515`, `:566`, `:609`, `:653`, `:696` — `T2 / schema do domínio e migrações 0005-0006`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-05

---

## [repeated_fixture] Sessão do Master com segundo fator cumprido

**Regra que isto sugere:** centralizar num acessório compartilhado de teste a entrada do `SYSLOC_MASTER` que cumpre o segundo fator pelas rotas reais.

**O que ela faria (simples):** a mesma sequência de seis passos — entrar, `POST /two-factor/enable`, ler o `secret` do `totpURI`, derivar o código por `generateTOTP`, `POST /two-factor/verify-totp` e recolher o cookie reemitido — já foi recopiada em seis suítes E2E, e esta task acrescentou a sexta. Uma regra apontando o acessório único evita que cada suíte nova reescreva o preparo e que uma delas divirja em silêncio quando a rota do arcabouço mudar.

- Evidência: preparo do segundo fator por `/two-factor/enable` recopiado em 6 suítes E2E — `apps/api/test/campos-fechados.e2e.spec.ts:907`, `administracao-de-pessoas.e2e.spec.ts:1787`, `recusa-indistinguivel.e2e.spec.ts:934`, `cobertura-de-autorizacao.e2e.spec.ts:966`, `ciclo-de-acesso.e2e.spec.ts:1392`, `contexto.e2e.spec.ts:1490` — `T4 / extração de validar() na borda`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-05

---

## [repeated_assertion_shape] Envelope de recusa afirmado por objeto inteiro

**Regra que isto sugere:** afirmar a recusa da ADR-0017 sempre por igualdade do corpo **inteiro**, nunca por presença de campo.

**O que ela faria (simples):** o mesmo formato de asserção — `toEqual({ codigo: CodigoErro.CAMPO_INVALIDO, mensagem: <a canônica>, campo: <o esperado> })` — já aparece em mais de vinte pontos de seis suítes, sempre com a mesma razão escrita à mão em comentário: um envelope que ganhasse `detalhes` vazaria a entrada recusada. Escrever a regra torna o formato obrigatório em vez de imitado, e livra cada caso novo de reexplicar por que não se afirma presença de campo.

- Evidência: asserção `toEqual` do envelope `{ codigo, mensagem, campo }` de `CAMPO_INVALIDO` repetida em 6 suítes — `apps/api/test/validacao.spec.ts:244`, `campos-fechados.e2e.spec.ts:871`, `sessao-restrita.e2e.spec.ts:706`, `administracao-de-pessoas.e2e.spec.ts:867`, `ciclo-de-acesso.e2e.spec.ts:458`, `autenticacao.e2e.spec.ts:990` — `T4 / extração de validar() na borda`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-05

---

## [convention_drift] Remoção de marcador exige varrer referências

**Regra que isto sugere:** ao remover um marcador (`DÉBITO COM GATILHO` ou `DECISÃO FECHADA`), varrer o repositório por referências cruzadas a ele e escalar as que ficarem falsas.

**O que ela faria (simples):** a §3-B da `nao-regressao.md` manda tirar o marcador e a linha do `CLAUDE.md`, e checa as duas pontas marcador↔índice — mas nada manda procurar OUTROS comentários que citavam o marcador removido. Aqui um `DECISÃO FECHADA` de área crítica passou a afirmar que existe, logo abaixo dele, um marcador que a task acabara de apagar; o executor viu, achou que a §3.2 o impedia de corrigir (e estava certo) e seguiu sem escalar (§3.3), porque a rule não fecha esse caminho. A regra faria a varredura e a escalada serem parte do fechamento de qualquer débito, em vez de depender do agente notar sozinho.

- Evidência: marcador `DECISÃO FECHADA` referenciando por posição ("mais abaixo neste mesmo arquivo") um `DÉBITO COM GATILHO` removido no mesmo diff — `apps/api/src/autenticacao/senha.controller.ts:252` — `T4 / extração de validar() e fecho do D38`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-05

---

## [convention_drift] Ponteiro de linha em comentário de teste

**Regra que isto sugere:** comentário de teste — registro de mutante, docblock de caso, `SUT_IS_CORRECT_BECAUSE:` — referencia código por **âncora simbólica** (nome do caso, do símbolo ou da asserção), nunca por número de linha.

**O que ela faria (simples):** número de linha embutido em comentário mente sozinho, sem que nada acuse: basta a edição seguinte deslocar o arquivo. Aconteceu **três vezes neste run**, e nas três o número foi escrito **na mesma edição que o invalidou** — o autor mediu antes de acrescentar o bloco de cabeçalho que empurrou as linhas. Com a regra, o ponteiro acompanha o código que nomeia e o modo de falha deixa de existir, em vez de ser recalibrado para o valor de hoje. É a mesma razão pela qual a rule do Ledger de Achados proíbe número de linha em `fingerprint`.

- Evidência: T7 — dois ponteiros no registro de `MT7-8 (a)/(b)`, defasados de exatamente 28 (o tamanho do bloco de cabeçalho escrito depois da medição) — `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`
- Evidência: T8 — ponteiro no registro corrigido de `MT8-1`, off-by-14, apontando para a segunda linha do comentário de abertura do bloco em vez da asserção nomeada — `packages/db/test/cadastro-de-pessoa.spec.ts`
- Sinal: `convention_drift` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-06T00:00:00Z

---

## [convention_drift] Export sem consumidor externo

**Regra que isto sugere:** símbolo só recebe `export` quando existe consumidor **fora do módulo**; consumidor apenas de teste **não conta**.

**O que ela faria (simples):** o repositório já reprovou isto **três vezes por veredito de gate** — a T8 despublicou `MENSAGEM_POR_CODIGO` como `dead_code`, `TABELA_POR_PAPEL` teve o `export` removido pelo mesmo critério (também na T8), e a T9 repetiu com quatro constantes de `superficie-de-cadastro.ts`. A regra nunca foi escrita em `.claude/rules/` nem em ADR, então **cada task nova a redescobre no gate**. Escrita, ela pouparia a rodada e evitaria que a superfície pública dos módulos de borda cresça sem demanda — que é a porta pela qual a duplicação por ponto (a classe do D12 e do D38) volta a entrar.

- Evidência: T8 — `TABELA_POR_PAPEL` exportado com o único importador sendo o próprio teste, e o docblock apoiado numa analogia falsa — `packages/db/src/cadastro-de-pessoa.ts`
- Evidência: T9 — quatro constantes exportadas sem nenhum importador (de produção ou de teste), num módulo novo cujos análogos nos três controladores irmãos são `const` sem `export` — `apps/api/src/cadastros/superficie-de-cadastro.ts`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-06T00:00:00Z

---

## [repeated_fixture] Gerador de CPF válido nos testes E2E

**Regra que isto sugere:** acessório único e compartilhado para gerar documento, corpo de pessoa e corpo de imóvel válidos nos testes de `apps/api`.

**O que ela faria (simples):** as duas suítes E2E novas da T11 reescreveram o mesmo gerador de CPF com dígito de controle, e com ele a regra da RN-04 que a borda confere. Com a regra, a regra de negócio existiria em um lugar só — hoje, se `conferirDocumento` mudar de algoritmo, a cópia que ficar para trás faz um caso reprovar por `422` de validação enquanto ele media outra coisa.

- Evidência: `cpfValido`/`digitoDeControle` e `corpoDePessoa` duplicados byte a byte — `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:815` e `apps/api/test/contrato-publicado.e2e.spec.ts:974` — T11 / provas de segurança e de contrato
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-08T00:00:00Z

---

## [repeated_assertion_shape] Envelope de erro asserido por objeto inteiro

**Regra que isto sugere:** toda recusa de borda é asserida pelo corpo INTEIRO por igualdade, nunca pela presença de campos nem só pelo status.

**O que ela faria (simples):** o mesmo formato de asserção repete-se em várias suítes, sempre com o mesmo motivo escrito por extenso no comentário — um envelope que ganhasse `detalhes` vazaria o valor recusado. Escrita como regra, ela pouparia o comentário repetido e impediria que uma suíte nova asserisse só o status.

- Evidência: `expect(<resposta>.corpo).toEqual({ codigo, mensagem, campo })` em quatro pontos — `apps/api/test/contrato-publicado.e2e.spec.ts:427`, `:483`, `apps/api/test/campos-fechados.e2e.spec.ts:963`, `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:337` — T11 / recusas de autorização, de corpo e de identificador
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-08T00:00:00Z

---

## [convention_drift] Acessório de suíte E2E duplicado por arquivo

**Regra que isto sugere:** acessório de teste que carregue regra de domínio (gerador de documento, corpo canônico de entidade) tem definição única; cliente HTTP e entrada de sessão seguem um molde nomeado.

**O que ela faria (simples):** cada suíte E2E nova recopia o cliente HTTP, a rotina de entrada, os corpos de entidade e — desta vez — o algoritmo do dígito verificador de CPF, porque não existe lugar de onde importar: os diretórios `test/` dos pacotes não têm fronteira declarada. O executor não errou, topou com uma restrição real; a regra tornaria a restrição visível e daria à próxima fatia um destino para o acessório em vez de mais uma cópia.

- Evidência: `cpfValido`/`digitoDeControle` em 2 cópias byte-a-byte criadas na mesma task; `corpoDePessoa` em 4 arquivos; `async function pedir(` em 17 arquivos de `apps/api/test` — `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:815` e `apps/api/test/contrato-publicado.e2e.spec.ts:974` — T11 / as duas suítes E2E novas
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-08T00:00:00Z

---
