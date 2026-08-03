# Relatório do Run — fundacao-multitenancy-identidade/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: ✅ **11/11 tasks concluídas** · suíte verde com **271 casos** · `pnpm build` e `pnpm lint` verdes · zero regressão em todas as tasks

> **Contagem em duas medidas**, porque este relatório passou a cobrir dois momentos: o **run** fechou
> com **260 casos** (baseline de entrada dele: **115**); o **fechamento da F1** (§4) acrescentou 11 —
> `CT-105` (10) e `CT-106` (1) —, sem retirar nenhum, chegando aos 271 acima.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Redação de segredo em cadeia de consulta (fecha o D25) | opus | 4 mod | ✅ APROVADO (2ª) | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Pacote `@sysloc/db`: schemas, migrações e instância efêmera com dois papéis | opus | 18 criados, 4 mod | ✅ APROVADO (2ª) | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Contexto de tenant, unidade de trabalho e suíte de isolamento | opus | 5 criados, 6 mod | ✅ APROVADO (2ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T4 | Guarda de cobertura de isolamento no catálogo | opus | 2 criados, 4 mod | ✅ APROVADO (3ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T5 | Provisionamento, script de migração e verificação no cluster real | opus | 2 criados, 4 mod | ✅ APROVADO (4ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T6 | Pacote `@sysloc/auth`: arcabouço, política de senha, bloqueio e trilha | opus | 22 criados, 12 mod | ✅ APROVADO_COM_OBSERVACOES (5ª) | ✅ APROVADO_COM_OBSERVACOES (4ª) |
| T7 | Barreira única de admissão de sessão | opus | 2 criados, 3 mod | ✅ APROVADO (3ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T8 | Códigos de erro, prefixo de versão e rotas de autenticação | opus | 3 criados, 14 mod | ✅ APROVADO_COM_OBSERVACOES (3ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T9 | Guarda de contexto, rotas públicas e rota de sessão | opus | 4 criados, 11 mod | ✅ APROVADO_COM_OBSERVACOES (3ª) | ✅ APROVADO_COM_OBSERVACOES (2ª) |
| T10 | Sessão restrita: troca de senha provisória e segundo fator do Master | opus | 5 criados, 8 mod | ✅ APROVADO (4ª) | ✅ APROVADO_COM_OBSERVACOES (3ª) |
| T11 | Recusas indistinguíveis: bloqueio, desativação e suspensão | opus | 1 criado | ✅ APROVADO (1ª) | ✅ APROVADO_COM_OBSERVACOES (1ª) |

**A T11 é a única task da fatia aprovada de primeira nos dois gates** — e entregou **um** arquivo de código, sem tocar produção.

**Fora do pipeline** — uma intervenção dirigida de infraestrutura de teste (ver §4).

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado. Resolva de uma vez com `/agent-spec-debt-resolution docs/specs/features/fundacao-multitenancy-identidade/v1/`.
>
> **Numeração**: a sequência `Dnn` corre **dentro desta §2**. O identificador de um débito é o par `Dnn · F{n}/T{n}` mais o caminho do `ÍNDICE` — **nunca o número sozinho**. A F0 tem um `D6` e um `D7` diferentes destes, e ambos são legítimos.

### D1 · BAIXO · security · T1 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/shared/src/log.ts:236-255`
- **Problema:** o docblock do terceiro eixo declara a fronteira da âncora, mas **afirma o absoluto** sobre a fronteira do valor.
- **Impacto:** documental. Duas fronteiras reais medidas: `?token=SEG]REDO` → `token=[REDIGIDO]]REDO` (cauda sobrevive) e `?a=1;token=SEGREDO` atravessa **intacto** (o `;` não delimita). Nenhuma é corrigível sem reabrir a mutilação que o eixo custou uma rodada para evitar — **o código está certo, o comentário promete demais**. Num arquivo cuja tese é distinguir "fechei a classe" de "fechei o caminho apontado", isso importa.
- **O que fazer:** declarar as duas fronteiras ao lado da que já existe para a âncora. Nenhuma mudança de código.

### D2 · BAIXO · code_quality · T1 · Tech Review
- **Onde:** `packages/shared/src/log.ts:400` e `:364`
- **Problema:** o nome das duas funções é mais estreito que o comportamento — `redigirValorEmCadeiaDeConsulta` também alcança o **fragmento**, e `mascararCredencial` virou a composição dos dois eixos.
- **Impacto:** nenhum hoje. **Nome estreito é o que faz um eixo novo nascer num ponto de escrita em vez de dentro da porta** — a classe que a T1 existe para fechar.
- **O que fazer:** renomear para `redigirValorDeParametroDeEndereco` e `mascararPorFormaDoValor`. Toca 5 call sites; fazer junto do D1.
- **⚠️ NÃO feito no fechamento da F1, embora o D1 tenha sido — decisão registrada.** O "fazer junto do D1" não foi cumprido de propósito, e a razão é o arquivo: `packages/shared/src/log.ts` é o módulo de redação de credencial que a §7 do Protocolo Antirregressão documenta como tendo **sobrevivido a quatro correções**, cada uma fechando o caminho apontado enquanto o defeito voltava por outro. O D1 é comentário e não toca uma linha de código; o D2 move 5 call sites ali dentro, pelo benefício de nomenclatura. Trocar risco de regressão por nome, no arquivo com o pior histórico da base, não se paga — e o próprio D2 declara o impacto de hoje como **nenhum**. **Continua aberto e sem gatilho**: o momento barato é a próxima fatia que já precise editar o módulo por mérito próprio, quando o diff de renomeação viajar junto de mudança que a suíte exercita de qualquer forma.

### D3 · BAIXO · technical_requirement · T2 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `docs/specs/features/fundacao-multitenancy-identidade/v1/tasks/T2.md:59`
- **Problema:** o critério 5 do §4 afirma que `conexaoDeMigracao()` é o "**único** acesso privilegiado", e a implementação expõe dois.
- **Impacto:** o segundo acessório está **arquitetonicamente certo** — com `FORCE` ativo a conexão de migração **não consegue** demonstrar leitura cross-tenant, e sem a superusuária o eixo do CT-002 seria indemonstrável. O defeito é de **registro**: um auditor que confie no §4 procuraria uma entrada e não acharia `conexaoSuperusuaria`.
- **O que fazer:** reescrever o item 5. Nenhuma linha de `packages/db/**` muda.

### D4 · BAIXO · security · T2 · Tech Review — **respondido na T6, resíduo aberto**
- **Onde:** `packages/db/src/index.ts:28` e `packages/db/src/semente.ts`
- **Problema:** `semear()` é público e aceita `cadeiaDeConexao` **sem discriminação de destino**.
- **Impacto:** o gatilho declarado ("a T6, quando a carga passar a definir credencial") **disparou e foi respondido**: a credencial entra por **injeção** (`semear(cadeia, { derivarSenha })`), então `semear(cadeia)` continua sem escrever credencial alguma — e isso agora **tem prova** (`packages/db/test/semente.spec.ts`, par positivo/negativo). **Resíduo:** a função ainda aceita destino arbitrário, e `SENHA_DA_CARGA` segue na superfície pública.
- **O que fazer:** guarda de destino em `semear`, ou mover o export para subcaminho próprio no `exports`. **Sem gatilho concreto** — por isso fica só aqui, sem marcador (§3-B).

### D5 · BAIXO · architecture · T2 · Tech Review
- **Onde:** `packages/db/src/esquema/negocio.ts:57-67`
- **Problema:** nada no banco concilia `acesso_usuario_app.empresa_id` com `identidade.usuario.empresa_id` — as duas FKs são simples e independentes.
- **Impacto:** **não é violação** (conforme a tech spec §7.2 e a ADR-0008, cuja chave composta vale "entre entidades tenantizadas", e `identidade.usuario` não é tenantizada por decisão da ADR-0009) e **não é escalação nesta fatia** (vínculo incoerente produz linha inalcançável). O custo é dado inconsistente, e se materializa na fatia de autorização. **Sem o registro no ponto, a conciliação tende a nascer como validação de aplicação** — o padrão que a ADR-0008 rejeita nominalmente.
- **O que fazer:** 3-4 linhas no bloco de `:57-61` nomeando a consequência e o dono. Se a conciliação tiver de ser estrutural, o caminho sem quebrar a ADR-0009 é um `CHECK` por função ou a promoção de `usuario` a par `(id, empresa_id)` — decisão de spec, a escalar.

### D6 · BAIXO · testability · F1/T5 · Tech Review — **tem marcador** — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `deploy/scripts/instalacao/verificar-fundacao.sh:116` (`DÉBITO COM GATILHO — D6 · F1/T5`)
- **Problema:** `VERIFICADORES_DA_FATIA` declara os três verificadores da F0; a quarta bateria (`verificar-migracao.sh`, F1/T5) **não é invocada por agregador nenhum** e só roda se alguém lembrar do caminho completo.
- **Impacto:** regressão na infraestrutura provada pela F1 — papéis, propriedade dos schemas, cobertura de RLS e higiene da credencial no cluster real — deixa de ter execução por rotina. *"O risco não é hoje; é na F7, quando o runbook da virada precisar de uma invocação única que prove a fundação inteira."*
- **O que fazer:** a **task de fechamento da F1** cria o agregador. **Ordem já decidida**: `verificar-migracao.sh` **depois** de `verificar-provisionamento.sh` — ela cria e remove banco no cluster e depende do estado que P15/P16 deixam; ambas exigem `:root`.

### D7 · BAIXO · security/architecture · F1/T6 · Tech Review — **tem marcador**
- **Onde:** `packages/auth/src/autenticacao.ts:198` (`DÉBITO COM GATILHO — D7 · F1/T6`), acima do bloco `user: { fields: … }`
- **Problema:** **criar pessoa pelo adaptador é inexequível.** `perfil` e `empresa_id` são colunas do produto; o modelo `user` não as declara; o `transformInput` descarta toda chave que não seja campo do modelo; e `perfil` é `NOT NULL` sem DEFAULT. O `INSERT` sai com `perfil` em `default` e o servidor recusa. **Medido duas vezes, por executor e por gate, com sonda descartável.**
- **Impacto:** **nenhuma task da F1 tropeça** — T7 a T11 não criam pessoa. O bloqueio cai sobre a fatia **`autorizacao-e-ciclo-de-acesso`** (onboarding e rotas do Master).
- **O que fazer:** declarar `perfil` e `empresa_id` como `additionalFields`, **com a escrita fechada** (`input: false`). **As duas consequências têm gravidade diferente**: `perfil` aberto é **elevação de privilégio** (`POST /update-user` a partir de qualquer sessão autenticada); `empresa_id` aberto faz **a origem do contexto de RLS ser o request** — contra o invariante 2 do `CLAUDE.md` e o texto literal da ADR-0008 (*"sua origem nunca é o request"*), o que é **fuga de tenant**. O `usuario_master_sem_empresa_chk` **cobre só metade do espaço**: a troca lateral entre empresas mantendo `ADMIN_EMPRESA` passa no `CHECK`, e **nenhuma suíte pega** (`identidade` não tem RLS, por decisão da ADR-0009). `input: false` é defesa de **aplicação**; a estrutural é o caminho do **D5**.

> **Medições do D7 contra `better-auth@1.6.25`** (Staff, Gate 2 rodada 2). Caminhos de **saída de build de terceiro** — deixam de valer no próximo bump; por isso vivem aqui e não no marcador.
> **(a)** Sem `input: false`, `perfil` seria escrito pelo corpo de `POST /update-user` a partir de qualquer sessão autenticada: `dist/api/routes/update-user.mjs:54` chama `parseUserInput(..., 'update')` com o **corpo do request**, e o `parseInputData` de `dist/db/schema.mjs:59-77` só lança `FIELD_NOT_ALLOWED` quando o campo declara `input: false`.
> **(b)** `input: false` **não inviabiliza o onboarding server-side**: o `transformInput` nunca consulta `input`, então a criação continua passando o par.

### D8 · BAIXO · testability · T3 · Tech Review
- **Onde:** `packages/db/test/isolamento.spec.ts` — o alcance do CT-005
- **Problema:** `CAMINHO_DO_DADO` é **lista de inclusão mantida à mão** (4 arquivos). Arquivo **renomeado** levanta; arquivo **acrescentado** fica fora **sem alarme**.
- **Impacto:** o CT-014, irmão desta asserção, **descobre** os alvos no disco justamente para não envelhecer. Materialidade real: a fatia em que a camada de repositório nascer.
- **O que fazer:** inverter para **descoberta + exclusões declaradas** (`listarFontesTs('packages/db/src')` menos `esquema/*.ts` e `index.ts`, com a razão de cada exclusão), e acrescentar ao controle negativo uma perna que **crie arquivo novo** e prove que ele **é** alcançado.

### D9 · BAIXO · testability · T3 · Tech Review
- **Onde:** `packages/db/test/varredura-de-fontes.ts:76-81` (`semComentarios`)
- **Problema:** aplica as substituições sobre o texto cru, **sem consciência de literal** — um `//` dentro de cadeia apaga o resto da linha; um `/*` apaga até o próximo `*/`.
- **Impacto:** falso **negativo** silencioso, numa função que é **ponto único de dois eixos estáticos**. A `testing-stack.md` registra *"asserção que casava `ALTER ROLE` em comentário"* como defeito real deste projeto — o eixo já mordeu aqui uma vez.
- **O que fazer:** declarar a fronteira no docblock (mínimo), ou neutralizar literais antes de remover comentários, com perna de controle provando que linha com URL e chamada juntas continua detectada.

### D10 · BAIXO · security · T3 · Tech Review
- **Onde:** `packages/db/src/unidade-de-trabalho.ts`, junto de `emUnidadeDeTrabalho`
- **Problema:** a fixação de abertura neutraliza **resíduo de sessão**, mas o `trabalho` recebe o `tx` cru e **pode emitir `SET LOCAL app.empresa_id` para outro valor dentro da transação já fixada** — a RLS obedece ao valor novo até o `COMMIT`.
- **Impacto:** **latente** — não há consumidor de `emUnidadeDeTrabalho` no fonte de produção. Material na **primeira fatia que escrever repositório sobre a unidade de trabalho**. Menos provável que o caso do `executarCom` (escrever `tx.unsafe("SET LOCAL …")` num serviço não parece legítimo em revisão).
- **O que fazer:** o ferramental já existe — estender o **CT-014** com um segundo eixo varrendo `app.empresa_id` no fonte de produção e afirmando, por igualdade de conjunto, os **dois** escritores legítimos de hoje (`unidade-de-trabalho.ts` e `semente.ts`).

### D11 · BAIXO · architecture · T3 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/db/src/unidade-de-trabalho.ts` (marcador do `ErroDeUnidadeAninhada`)
- **Problema:** a consequência que a **fatia 2** herda — quem abre a unidade quando serviço chama serviço — vive **só dentro de um `DECISÃO FECHADA`**, que **protege**, não **agenda**. E a mensagem do erro prescreve *"reúna as operações numa única unidade"*, que é a remediação certa para aninhamento acidental e **a errada para composição de serviços**.
- **Impacto:** baixo, porque o modo de falha é **ruidoso e seguro** (erro nomeado, no ponto exato). O custo é uma rodada de descoberta na fatia 2 e o risco de a mensagem empurrar para a solução errada (fundir serviços em vez de mover a abertura para a borda).
- **O que fazer:** nomear as duas alternativas (unidade na borda com `tx` passado adiante × `SAVEPOINT` via `tx.begin`); opcionalmente ampliar a mensagem do erro.

### D12 · BAIXO · testability · T3 · QA
- **Onde:** `packages/db/test/{isolamento,unidade-de-trabalho}.spec.ts`
- **Problema:** fixture duplicada — limites de tempo, `CONSULTA_ACESSOS`, `IDENTIFICADORES_DE_A/B`, `ordenado()` e o par `beforeAll`/`afterAll` replicados.
- **Impacto:** risco de **divergência silenciosa**; é justamente `CONSULTA_ACESSOS` que o CT-003 audita como prova da ausência de filtro por empresa.
- **O que fazer:** promover a um acessório comum do pacote, na linha do que a própria T3 fez com `varredura-de-fontes.ts`. **Não isoladamente** — o diff de extração sobre arquivos verdes é superfície de regressão sem causa-raiz (§4.5).

### D13 · BAIXO · code_quality · T4 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/db/src/catalogo.ts` — o critério de exclusão
- **Problema:** o critério escrito (*"não guarda nem expõe linha de negócio"*) é **literalmente falso** para índice (`i`,`I`) e TOAST (`t`), que **armazenam**. O que os torna seguros é **não serem legíveis como relação de negócio**.
- **Impacto:** fail-closed em qualquer direção, zero efeito na saída. O custo é o marcador mandar o próximo agente aplicar **uma regra que a lista atual viola**.
- **O que fazer:** separar as razões (não armazenam: `S`, `c` · armazenam mas não são relação legível: `i`, `I`, `t` · reavalia a política: `v`) e trocar a frase do `REVERTER EXIGE` por *"não é legível como relação que devolva linha de negócio"*.

### D14 · BAIXO · project_pattern · T4 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `docs/specs/features/fundacao-multitenancy-identidade/v1/tasks/T4.md` §5
- **Problema:** a §5.2 não lista `packages/db/test/unidade-de-trabalho.spec.ts` (modificado); a §5.1 diz "três variantes" onde há cinco mais o M6; e ainda atribui `pg_policies` a `catalogo.ts`.
- **Impacto:** a §5 é o que a Camada 0 do QA e o P2 do protocolo leem para apurar escopo. **Não é `scope_deviation`** — a modificação é compelida pelo critério 5 do §4 somado à igualdade de conjunto do CT-012. A falha é do card.
- **O que fazer:** acrescentar o arquivo à §5.2 e corrigir as duas descrições vencidas.

### D15 · BAIXO · project_pattern · T5 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `deploy/scripts/instalacao/migrar-banco.sh:320` (`garantir_tabela_de_registro`)
- **Problema:** a decisão "a retirada commita junto com a concessão" tem **três sítios**; dois apontam para o marcador e **este não**.
- **Impacto:** R3 residual. Um agente que abra a função para acrescentar coluna vê um `REVOKE` que **parece redundante** — `retirar_alcance_da_aplicacao` existe, tem nome de defesa e faz o mesmo — e não encontra contrato de reversão no sítio. Atenuado pelo comentário local, pelo `POR QUÊ` do marcador e pelo par (h-bis) — *"mas a bateria que carrega essa prova é justamente a que o D6 registra como não invocada por agregador nenhum"*.
- **O que fazer:** uma linha apontando para o marcador, no formato já usado em `:332`.

### D16 · BAIXO · testability · T5 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** todo `deploy/scripts/**/*.sh`
- **Problema:** a frente shell entrega **~2.700 linhas nesta task sem nenhuma análise estática**. `biome check` roda mas **não processa shell**; `turbo run lint` resolve para 0 tarefas; **`shellcheck` está ausente do host**.
- **Impacto:** nenhum defeito presente (o Staff varreu SC2155 à mão: **zero**). O custo é cumulativo — a F1 ainda tem T7–T11 e a F7 traz o runbook, e as classes que o shellcheck pega são **silenciosas até a janela de operação**.
- **O que fazer:** acrescentar `shellcheck` ao `.mise.toml` e um alvo `pnpm lint:shell` encadeado no `lint` raiz, começando na severidade que passe limpo hoje. Destino: a **task de fechamento da F1**, junto do D6.

### D17 · BAIXO · testability · T6 · Tech Review
- **Onde:** `packages/db/src/esquema/identidade.ts` — colunas OAuth de `identidade.conta`
- **Problema:** a tabela não tem colunas para `accessToken`, `refreshToken`, `idToken`, `scope`, `accessTokenExpiresAt`, `refreshTokenExpiresAt` do modelo `account`.
- **Impacto:** **inócuo hoje** — os seis são `required: false` sem `defaultValue`, não entram na carga de criação de conta `credential`, a única desta fatia. E o modo de falha é **ruidoso e na primeira tentativa** (`BetterAuthError`), não silencioso. **Não acrescentar é a decisão certa** — pagar seis colunas hoje seria complexidade especulativa.
- **O que fazer:** nada agora. **Migração é imutável**: se alguma fatia ligar provedor externo, a coluna nasce noutra migração.

### D18 · BAIXO · project_pattern · T6 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/db/src/esquema/identidade.ts:84` e `packages/auth/src/autenticacao.ts:444`
- **Problema:** os dois ponteiros para a pendência do `ACESSO_RECUSADO` citam o **card da T6**, não o dono novo (`T8.md §7 · P-T6-1`).
- **Impacto:** navegacional — chega-se ao destino em dois saltos. Mas o **oráculo do vocabulário** fica apontando para a §7 de uma task concluída, que é o padrão que o próprio ciclo da T6 condenou.
- **O que fazer:** uma linha em cada arquivo, nomeando `T8.md §7 · P-T6-1`.

### D19 · BAIXO · code_quality · T6 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/auth/src/autenticacao.ts:142-154` — o `REVERTER EXIGE` do marcador do `zod`
- **Problema:** a restrição que impede a saída errada (**anotar o tipo à mão**) está no parágrafo **adjacente**, fora do campo.
- **Impacto:** um leitor que faça o que a §3 manda pode anotar o tipo, ver o `.d.ts` emitir, remover o `zod` e **concluir que reverteu legitimamente**. Risco pequeno (a nota é contígua e inequívoca), não nulo.
- **O que fazer:** oito palavras no campo — *"… emitir o `.d.ts` sem a dependência **E SEM anotação de tipo manual** (ver nota abaixo)"*.

### D20 · BAIXO · project_pattern · T6 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `CLAUDE.md:214-218`
- **Problema:** a **regra de identificação de débito** foi escrita dentro do bloco "Débitos com gatilho ativo", que a §3-B declara *"derivado e transitório"* e manda **apagar inteiro** quando o último marcador sair.
- **Impacto:** no dia em que o último débito fechar, o bloco é apagado **e a regra vai junto** — e a colisão volta a ser descoberta do zero pela primeira fatia que registrar um `D6`. A colisão é **real e verificada**: a F0 já tem `D6 · T2` e `D7 · T2`.
- **O que fazer:** mover as quatro linhas para a §3-B da `.claude/rules/nao-regressao.md`, deixando no `CLAUDE.md` só a remissão. **Edição de rule — decisão deliberada, fora do escopo de task.**

### D21 · BAIXO · security · F1/T7 · Tech Review — **tem marcador**
- **Onde:** `packages/auth/src/autenticacao.ts:224` (`DÉBITO COM GATILHO — D21 · F1/T7`), acima do bloco `databaseHooks`
- **Problema:** **a recusa da barreira não desfaz o que a rota já escreveu.** Medido no pacote instalado (`better-auth@1.6.25`, `dist/api/routes/update-user.mjs`): `internalAdapter.updateAccount(account.id, { password: passwordHash })` na linha 178 precede `deleteUserSessions` (`:181`) e `createSession` (`:182`), e **não há transação** envolvendo as três. Quando o gancho `databaseHooks.session.create.before` levanta, a escrita da credencial e a exclusão das sessões **já ocorreram**.
- **Impacto:** o invariante que a T7 prova — nenhuma sessão nasce — **segue íntegro**, e não há elevação de privilégio, fuga de tenant nem oráculo de existência de conta: o caminho exige sessão válida **mais** a senha atual correta, então o ator é o dono da conta. O que fica aberto é outro eixo, que o Staff nomeou e o QA não tinha alcançado: uma pessoa **desativada** ou de **empresa suspensa** que tente trocar a senha sai da requisição com **(i)** a senha efetivamente trocada, **(ii)** todas as sessões apagadas e **(iii)** um `401` que a RN-10 torna **indistinguível de "senha atual errada"**. Reativada depois pelo Master, ela não entra com a senha antiga e não sabe a nova — *perda de acesso irreversível sem intervenção administrativa, com a resposta afirmando que nada aconteceu*.
- **🔴 GATILHO DISPARADO — F1/T8 (2026-08-02).** A alcançabilidade **deixou de ser zero**. O encaminhador `@All('*')` de `apps/api/src/autenticacao/autenticacao.controller.ts` publica sob `/v1/auth` toda rota nativa do arcabouço, `/change-password` inclusive (inventário fixado pelo `CT-018 (d)`). Basta **sessão válida mais a senha atual correta**. O marcador em `packages/auth/src/autenticacao.ts:241` foi reescrito no mesmo ciclo.
- **O que fazer:** barrar **antes** da escrita de credencial — topologia **por rota**, distinta da barreira de emissão que a T7 entrega. Dono inalterado: a fatia `autorizacao-e-ciclo-de-acesso`, que é quem redesenha a superfície de troca de senha.

### D22 · BAIXO · error_handling · F1/T7 · Tech Review
- **Onde:** `packages/auth/src/autenticacao.ts:272` (o `throw new APIError('UNAUTHORIZED', RECUSA_DE_CREDENCIAL)` da barreira, que carrega o código discriminante) e `:536-554` (a nota adjacente à `DECISÃO FECHADA — T6 / Gate 2 (P5)` que documenta a janela). O ramo que classifica o erro — onde a correção incidiria — é `:556`.
- **Problema:** a barreira reusa **deliberadamente** o código `INVALID_EMAIL_OR_PASSWORD` — é o que produz a indistinguibilidade da RN-10 —, e esse mesmo código é o **discriminador** que a `DECISÃO FECHADA — T6 / Gate 2 (P5)` usa para separar "credencial incorreta" de "falha de servidor". O `hooks.after` classificaria a recusa de política como `CREDENCIAL_INCORRETA` e chamaria `registrarFalha`.
- **Impacto:** contador da RN-06 incrementado e desfecho `CREDENCIAL_INCORRETA` gravado numa tentativa cuja credencial estava **correta** — a trilha afirmando sobre a pessoa um fato que é da política, a mesma classe de mentira que a decisão fechada combate. Alcançabilidade **estreita e verificada**: `hooks.before`/`hooks.after` só rodam para `/sign-in/email`, e ali o `before` já recusou antes; sobra a **corrida** em que o estado muda entre a leitura do `before` e a do gancho de banco. Nos demais caminhos emissores o `after` não roda. Dano desprezível — a conta já está recusada de qualquer modo.
- **O que fazer:** consultar a barreira no `hooks.after` antes de classificar (o desfecho passa a ser `DESFECHO_POR_MOTIVO[motivo]`), o que também dispensa a segunda leitura de `buscarPessoa`. **Não feito agora por decisão do orquestrador**: muda comportamento na vizinhança de uma `DECISÃO FECHADA` por dano que o próprio Staff qualifica como desprezível. **Sem gatilho concreto** — por isso fica só aqui, sem marcador (§3-B).

### D23 · BAIXO · security · F1/T8 · Tech Review — **tem marcador**
- **Onde:** `apps/api/src/autenticacao/autenticacao.module.ts:91` (`DÉBITO COM GATILHO — D23 · F1/T8`), junto do `enderecoBase`
- **Problema:** o arcabouço deriva a **origem confiável** do endereço base, que hoje é o de retorno (`127.0.0.1` + porta). Medido em `better-auth@1.6.25` (`dist/api/middlewares/origin-check.mjs`): `Origin`/`Referer` são conferidos para todo método ≠ GET/HEAD/OPTIONS com cookie **e também para a entrada sem cookie**, porque `validateFormCsrf` chama `validateOrigin(ctx, true)` assim que qualquer cabeçalho `Sec-Fetch-*` está presente — o que um navegador **sempre** envia.
- **Impacto:** depois da virada da F7, `Origin` será o endereço público e o base continuará `http://127.0.0.1:<porta>`: **toda requisição com cookie e o próprio login** passam a ser recusados com `FORBIDDEN / INVALID_ORIGIN` antes de qualquer manipulador — **o serviço inteiro inacessível a navegador**. Nulo até lá; nada publica esta API na rede antes da virada.
- **O que fazer:** variável de ambiente própria para a origem pública, validada na partida pelo mesmo esquema de `ambiente.ts` que já recusa a partida nomeando a variável ausente. Gatilho: a publicação atrás do servidor de borda na F7.

### D24 · BAIXO · scope_deviation · F1/T8 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `docs/specs/features/fundacao-multitenancy-identidade/v1/tasks/T8.md` §5.3 e §5.2 · `apps/api/src/comum/filtro-excecao.ts:68,85`
- **Problema:** o card lista `filtro-excecao.ts` na **§5.3 (De Referência)**, e a task o modificou. O Staff **contradisse a razão** que o QA havia aceitado: só as três entradas de `MENSAGEM_POR_CODIGO` são forçadas pelo compilador (`Readonly<Record<CodigoErro, string>>`); `CODIGO_POR_STATUS` é `Readonly<Record<number, CodigoErro>>` e **não** é alcançada por valor novo no enum.
- **Impacto:** card e diff divergem sobre a fronteira da task, e a memória do run registraria como "arrasto de compilação" o que é **mudança de comportamento** do filtro global de erro — e a rodada 2 aprofundou a intervenção (classificação por faixa). Segunda ocorrência da mesma classe na fatia; a primeira foi o **D14** da T4.
- **O que fazer:** acrescentar o arquivo à §5.2 do card com a modificação descrita ("duas entradas em `CODIGO_POR_STATUS` para os status que o encaminhador levanta; três em `MENSAGEM_POR_CODIGO`, estas exigidas pelo compilador"). Sem alteração de código. **Candidato a regra já emitido** — ver `_run/rule-candidates.md`.

### D25 · BAIXO · code_quality · F1/T8 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `apps/api/src/comum/filtro-excecao.ts:246-250` (a nota adjacente à `DECISÃO FECHADA — T8 / Gate 2 (P1)`)
- **Problema:** a nota afirma que o status de origem preservado é *"o único ponto do sistema em que a resposta NÃO usa o status que `STATUS_POR_CODIGO` associa ao código"*. **É verdadeiro hoje** — não há nenhum `new ErroDeAplicacao(CodigoErro.REQUISICAO_RECUSADA, …)` em produção —, mas o código é exportado no enum público de `@sysloc/shared` e nada, nem tipo nem asserção, impede que uma fatia futura o levante diretamente.
- **Impacto:** nulo hoje. Se uma fatia futura o levantar, o **mesmo código** sai com `400` num ponto e `415`/`429` noutro, e um cliente que combine `codigo` com semântica de repetição não consegue decidir só pelo código — **sem que nenhum teste reprove**.
- **O que fazer:** uma frase na nota adjacente fixando que `REQUISICAO_RECUSADA` é código de **fecho do filtro**, não código de negócio levantável; avaliar na task de fechamento da F1 uma asserção que reprove o aparecimento de levantamento direto em produção.

### D26 · BAIXO · architecture · F1/T8 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `apps/api/test/autenticacao.e2e.spec.ts:212-247` (`SUPERFICIE_TOLERADA`)
- **Problema:** 35 pares `MÉTODO /caminho` que a §4.1 da tech spec não declara são aceitos hoje por uma **constante de teste** — não por ADR, não por seção de spec, não por marcador. O docblock do `@ApiExcludeController` nomeia dono para declarar as **seis** rotas da §4.1 no contrato publicado, mas **ninguém** para decidir o destino das 35.
- **Impacto:** **sem alcance de segurança hoje** — o Staff verificou no pacote que as perigosas estão inertes (`change-email`, `delete-user`, `request-password-reset`, `sign-up/email` e social todas exigem opção não passada), e o que está vivo é auto-escopado por sessão e não cruza tenant. O custo é de processo: o marco de entrega exige *"Superfície da API congelada"*, e o congelamento chegaria sem que ninguém tivesse decidido sobre 35 rotas — por descoberta, não por agendamento.
- **O que fazer:** decidir o destino do conjunto tolerado — contrato, desligamento por configuração, ou tolerância declarada — **antes** de congelar a superfície e publicar `@sysloc/contracts`. Dono: **task de fechamento da F1**.

### D27 · BAIXO · error_handling · F1/T8 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `apps/api/src/comum/filtro-excecao.ts:172-178` (`caminhoSemConsulta`) · asserção em `apps/api/test/autenticacao.e2e.spec.ts:610`
- **Problema:** `caminhoSemConsulta` prefere `requisicao.routeOptions.url` ao caminho concreto — decisão da T5, para agrupar o journal por rota em vez de por instância. Com o encaminhador `@All('*')`, o padrão casado das 40 rotas de identidade é **um só**, e o `CT-018 (e)` fixa isso por asserção: `expect(evento.caminho).toBe('/v1/auth/*')` numa requisição que foi de fato para `/v1/auth/sign-in/email`.
- **Impacto:** o operador que lê o journal **não distingue tentativa de entrada de qualquer outra recusa da superfície**. Degrada o artefato que a `DECISÃO FECHADA — T6 / Gate 2 (P5)` nomeia como *"aquele que a operação lê para decidir se houve ataque"*, restrito à superfície de identidade. **Mitigado**: o artefato projetado para detecção de ataque à entrada é a trilha `identidade.tentativa_login` (T7, por pessoa e com desfecho), íntegra e fora deste caminho. O comportamento atual é **o mais seguro dos dois óbvios** — registrar o caminho concreto vazaria segmento sensível (`GET /reset-password/:token`, `GET /callback/:id`), e a redação da T1 opera por nome de chave e por forma, não por segmento.
- **O que fazer:** derivar o rótulo do journal do **registro de pontas do arcabouço** — o mesmo objeto que `superficieEfetiva()` já lê —, que devolve o **padrão** da rota (`/reset-password/:token`, não o token): granularidade por rota sem reintroduzir o vazamento que a T5 fechou. Dono: task de fechamento da F1.

### D28 · BAIXO · code_quality · F1/T8 · QA
> ⚠️ **Não confundir com o `D28 · F0/T5`**, que está ativo e tem três marcadores. São débitos diferentes; o identificador é o par `Dnn · F{n}/T{n}` mais o `ÍNDICE`.
- **Onde:** `apps/api/test/autenticacao.e2e.spec.ts:588`
- **Problema:** `expect(recusa.status).not.toBe(500)` vem **depois** de `expect(recusa.status).toBe(STATUS_FORA_DA_TABELA)` (415) — a segunda é logicamente implicada pela primeira e, isolada, **não pode falhar**.
- **Impacto:** apenas ruído. **Não é AP-29**: a asserção é aditiva, não substitutiva, e a prova real do eixo é forte — a falsificação do QA reprovou por `expected 500 to be 415`, não por ela.
- **O que fazer:** em cleanup futuro, manter só `expect(recusa.texto).not.toContain(CodigoErro.ERRO_INTERNO)` como companheiro negativo (esse **não** é implicado pela igualdade de status) e remover o `not.toBe(500)`. **Não mexer agora** — a linha não enfraquece nada.

### D29 · BAIXO · project_pattern · F1/T9 · Tech Review + QA — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/auth/src/admissao.ts:234` (docblock de `carregarPessoa`)
- **Problema:** o docblock abre com *"a **única** leitura da linha de `identidade.usuario` que existe neste sistema"* — **falso ao grep**, por dois caminhos: `buscarPessoa` (`packages/auth/src/autenticacao.ts:630-643`) lê a mesma linha por e-mail como sonda de existência da trilha, e o adaptador Drizzle do arcabouço a lê a cada `getSession`.
- **Impacto:** **a substância está fechada** — a unificação do P1 é real e o absoluto **não é load-bearing**: `buscarPessoa` é privada, projeta só `{ id }`, não decide nada e não alimenta rota alguma, então a §11.2 continua satisfeita sobre a forma **verdadeira** da afirmação. O resíduo é **erosão de autoridade**: este projeto usa docblock como carregador de decisão, e um absoluto que o grep desmente leva o próximo agente ou a concluir que o invariante foi abandonado, ou a *restaurá-lo* fundindo `buscarPessoa` — refatoração que ninguém pediu, no caminho de login, contra a §4.5 do Protocolo.
- **O que fazer:** trocar por *"a única leitura que **projeta o estado de admissão**"* e nomear a fronteira no padrão que `packages/db/src/acesso-identidade.ts` já pratica (*"fronteira declarada em vez de absoluto falso"*).

### D30 · BAIXO · project_pattern · F1/T9 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/auth/src/index.ts:26`
- **Problema:** afirma que publicar `carregarPessoaDaSessao` *"mantém **topológica** (e não disciplinar) a contenção que a §11.2 exige"* — sem nomear o caminho residual. O Staff julgou a pergunta diretamente: a contenção **melhorou muito e é, no essencial, estrutural**, com a barreira forte sendo `TOKEN_ACESSO_A_IDENTIDADE` **fora do `exports:` de `AutenticacaoModule`**. Mas **sobrou** um caminho: de dentro daquele módulo, um provider novo pode fazer `acesso.identidade.query.usuario.findFirst({ where: (u, { eq }) => … })` — a API relacional do Drizzle entrega os operadores **por callback**, então a leitura nova **não precisa importar `drizzle-orm` nem `esquemaIdentidade`**, e nenhuma prova atual a alcança.
- **Impacto:** baixo e indireto — **nenhuma superfície aberta hoje**. O risco é de leitura: um agente futuro lê "topológica", entende que a estrutura o impede, e não confere ao acrescentar provider no módulo de autenticação.
- **O que fazer:** substituir o absoluto pela barreira concreta e nomear o resíduo, no mesmo padrão da seção *"Risco residual, nomeado"* que **esta própria rodada** escreveu no docblock de `rotasDaTabelaDoRoteador`. **Sem marcador `DÉBITO COM GATILHO`** — não há gatilho concreto e reconhecível, e a §3-B manda débito sem gatilho ficar só no relatório.

### D31 · BAIXO · tests · F1/T10 · QA — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `apps/api/src/autenticacao/sessao-restrita.ts:171`
- **Problema:** o ramo de **duas exigências pendentes simultâneas** não é exercitado em camada nenhuma. `sessaoRestritaPermite()` compõe a mensagem juntando as pendências com `' e '`, e nenhum caso produz `senhaProvisoria: true` **e** `segundoFatorPendente: true` ao mesmo tempo — o CT-019 isola o segundo fator, o CT-021/CT-022 isolam a senha provisória. O `join` com dois elementos é código introduzido pela task e **nunca executado por asserção alguma**.
- **Impacto:** o estado é **real e chega na fatia seguinte** — o primeiro acesso do Master no onboarding tem as duas marcas de pé. **Não é bloqueante**: a recusa em si está provada dos dois lados (o `403` vem de `pendentes.length === 0` ser falso), e *"não existe estado em que um defeito no `join` libere acesso — o que varia é apenas a redação da mensagem"*.
- **O que fazer:** teste unitário de `sessaoRestritaPermite()` (`apps/api/test/sessao-restrita.spec.ts`, camada `unit` — a mais baixa que detecta, Iron Law #3), table-driven sobre as quatro combinações de exigências × rota dentro/fora de `ROTAS_DA_SESSAO_RESTRITA`, com asserção **literal** da mensagem composta.

### D32 · BAIXO · tests · F1/T10 · QA
> ⚠️ **Não confundir com o `D32 · F0/T6`** (`apps/worker/src/fila.ts`), que está ativo e tem marcador.
- **Onde:** `packages/auth/test/admissao.spec.ts:352` (o inventário `SUPERFICIE_DO_PACOTE` do CT-026)
- **Problema:** o inventário compara `Object.keys(indiceDoPacote)`, que só enxerga **bindings de runtime** — `type` é apagado na compilação. Um `type` novo publicado no índice **não reprova**. A prova está na própria constante: ela lista os três `COMPRIMENTO_*` (que são `const`) e **nenhum** dos nove tipos que o índice publica.
- **Impacto:** o próprio ciclo demonstrou o furo — `PessoaDaSenha` foi publicada sem leitor externo e **passou pelo CT-026 sem reprovar**; quem a pegou foi o QA à mão. **Baixo** por três razões: a limitação **já está declarada** no comentário do inventário; o invariante que o CT-026 protege — nenhum caminho de emissão de sessão escapa da barreira — é **inalcançável por um tipo**, que não existe em runtime; e fechar exigiria varredura estática do fonte.
- **O que fazer:** se valer a pena, uma segunda asserção varrendo `export { … } from` do próprio `src/index.ts` e comparando os nomes precedidos de `type` com uma lista declarada — mesma igualdade nos dois sentidos, com prova de falsificação.

### D33 · BAIXO · code_quality · F1/T10 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `packages/auth/src/autenticacao.ts:921-927` (doc de `donoDoTokenDeRedefinicao`)
- **Problema:** a doc estabelece a classe *"valor que o gancho relê do mesmo pedido que o manipulador"* e conclui que, fora o token, *"a leitura daqui é **subconjunto estrito** da do manipulador"* para `newPassword`, `code`, `email` e `password`. Para o `email` de `/sign-in/email` **é o contrário do que foi medido nesta mesma rodada**: a barreira normaliza com `.trim().toLowerCase()` enquanto o manipulador valida o e-mail **cru** (`dist/api/routes/sign-in.mjs:286`, sem `trim()`) — o gancho é **superconjunto** nesse eixo.
- **Impacto:** **nenhum em comportamento**. A divergência **falha fechado** (` ana@x ` resolve no gancho e é recusado no manipulador com `INVALID_EMAIL` antes), a decisão de **não tocar** está certa (mexer seria R3, proibição 5 do Protocolo), e a conclusão do fechamento da classe permanece válida. O custo é de **leitura futura**: quem tomar a frase como premissa parte de um fato que já se sabe falso para um dos quatro valores.
- **O que fazer:** enunciar a propriedade na forma correta — *"a leitura do gancho **nunca é estritamente menor** que a do manipulador"* (superconjunto e subconjunto a satisfazem) — e nomear o `email` como exceção conhecida e deliberada, com a medição que a sustenta. **Sem marcador `DECISÃO FECHADA`**: a §3 adverte contra marcador em item que não teve defeito de volta nem rejeição repetida.

### D34 · BAIXO · testability · F1/T11 · Tech Review — ⚠️ **o mais importante da §2** — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `.claude/rules/testing-stack.md` (seção "Prova de falsificação") · `apps/api/package.json:5`
- **Problema:** **prova de falsificação contra `dist/` obsoleto é falso negativo silencioso.** `@sysloc/auth` e `@sysloc/db` resolvem por `exports` para `./dist/index.js`. Um mutante aplicado ao **fonte** (`packages/*/src/*.ts`) **não alcança o SUT** quando a suíte é invocada por `vitest run` direto — o consumidor continua carregando o `dist/` da compilação anterior, e **a suíte fica VERDE afirmando que o mutante sobreviveu**. Só `pnpm --filter @sysloc/api test` alcança, porque o script é `tsc --build && tsc -p tsconfig.test.json && vitest run`. **Medido pelo QA na primeira execução do mutante 1 da T11.**
- **Impacto:** a **T11 não é afetada** (o executor usou o caminho com build e o QA reexecutou). O risco é **de classe**: a rule documenta o comando certo mas **em nenhum ponto liga a escolha do comando à validade da prova** — que ela própria torna obrigatória e que o P4 do Protocolo estende a todo defeito corrigido. *"O modo de falha é silencioso e **inverte a conclusão**: verde lido como 'mutante sobreviveu' quando o mutante nunca foi executado."* Numa fatia cujo eixo é segurança, **prova inconclusiva é pior que ausente — ela consta como feita**.
- **O que fazer:** acrescentar à seção "Prova de falsificação" da `testing-stack.md` a exigência explícita do script `test` do pacote para todo mutante sobre fonte de `packages/*`, **nomeando `vitest run` avulso como inválido**. Se o fechamento da F1 quiser certeza sobre as provas já feitas, **reexecutar os mutantes das tasks de eixo de segurança (T6, T7, T9) pelo caminho com build** — a lista está nos cabeçalhos dos respectivos arquivos de teste.

### D35 · BAIXO · architecture · F1/T11 · Tech Review — ⚠️ **três gatilhos disparam sem dono** — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `docs/specs/features/fundacao-multitenancy-identidade/v1/task_plan.md` (a fatia termina na T11)
- **Problema:** **a T11 encerra a fatia, mas três artefatos delegam trabalho a uma "task de fechamento da F1" que não existe no plano.** São eles: **(a)** o **D6** (`verificar-fundacao.sh:118-132`), cujo gatilho é literalmente *"a task de fechamento da F1"* — `verificar-migracao.sh` **não está** em `VERIFICADORES_DA_FATIA` e só roda se alguém lembrar do caminho completo; **(b)** `autenticacao.controller.ts`, cujo cabeçalho declara que as **seis rotas de `/v1/auth` estão fora de `/docs`** por `@ApiExcludeController()` e que declará-las *"pertence à task de fechamento da F1, junto da publicação do `@sysloc/contracts`"*; **(c)** o próprio **marco de entrega** do `CLAUDE.md`, que faz `handoff-frontend.md` e `@sysloc/contracts` dependerem daquele documento.
- **Impacto:** com a T11 aprovada, **os três gatilhos disparam sem dono no plano**. O D6 é o mais concreto — a F1 fecha com um verificador que ninguém invoca. A ausência das seis rotas no documento OpenAPI é pré-requisito declarado de **dois dos sete itens do marco de entrega do backend**.
- **O que fazer:** criar a task de fechamento (ou reendereçar explicitamente a `autorizacao-e-ciclo-de-acesso`) carregando, no mínimo: inserir `verificar-migracao.sh:root` em `VERIFICADORES_DA_FATIA` **depois** de `verificar-provisionamento.sh` (ordem já decidida no marcador) e **remover o marcador D6 no mesmo commit**; declarar as seis rotas da §4.1 no documento OpenAPI a partir do inventário do `CT-018 (d)`.

### D36 · BAIXO · project_pattern · F1/T11 · Tech Review — ✅ RESOLVIDO (fechamento da F1, 2026-08-02)
- **Onde:** `CLAUDE.md`, linha do **D28** (coluna "Onde")
- **Problema:** o índice ficou **defasado do terreno**. O marcador do D28 vive hoje em **seis** arquivos; a coluna nomeia **dois**, e o texto do gatilho ainda descreve `banco-efemero.ts` como *"o **quarto** consumidor"*. A §3-B fixa que o bloco é **derivado** dos marcadores.
- **Impacto:** baixo e de leitura — uma sessão nova **subdimensiona o alcance** do D28: o fechamento parece tocar dois consumidores quando toca seis, **o que muda o custo estimado**.
- **O que fazer:** trocar a enumeração por `grep -rln --exclude-dir=dist "D28 · F0/T5" apps packages deploy` (o mesmo padrão que a §3-B já usa) e corrigir o numeral. **Não enumerar arquivos que envelhecem a cada task.**

### D37 · BAIXO · project_pattern · F1/T11 · Tech Review — **padrão, não ocorrência**
- **Onde:** a "Precondição privilegiada" da §6.6 dos cards **T10** e **T11** (e, antes, a do CT-021)
- **Problema:** **três vezes nesta fatia** um card afirmou como estado da carga inicial algo que `packages/db/src/semente.ts` **não escreve** — `senha_provisoria`, `ativo` e `suspensa_em`, todas com padrão do schema. Em cada uma o executor teve de **diagnosticar a divergência, escolher o arranjo e justificar por escrito** por que não criou caminho de escrita.
- **Impacto:** **nenhum no código entregue** — a conduta foi correta nas três (arranjo no próprio caso, pelo padrão que a T7 estabeleceu e os dois gates aprovaram, sem rota/bandeira/símbolo de produção). O custo é **de ciclo**, e a repetição indica que **o gerador de casos não confronta a semente**.
- **O que fazer:** na mineração de regras, propor que a geração de "Precondição privilegiada" **confronte o estado afirmado contra `packages/db/src/semente.ts`** antes de escrevê-lo no card. **Candidato a regra já emitido.**

### D38 · BAIXO · security · F1/fechamento · revisão da intervenção — ✅ RESOLVIDO (2026-08-02)
> ⚠️ **Descoberto DURANTE o fechamento da F1**, não durante o run. É achado novo, não um dos 37 — por isso o número continua a sequência desta §2.
- **Onde:** `packages/db/src/catalogo.ts`, no critério de exame de `verificarCoberturaDeIsolamento`
- **Problema:** `v` (visão) era excluído do exame sob a razão de que reavalia a política da origem a cada consulta. **A razão é condicional**: o PostgreSQL avalia a política com os direitos da **dona da visão**, salvo `security_invoker = true`. Visão cuja dona contorne RLS devolvia todas as empresas — e a exclusão a tirava de `tabelasExaminadas`, que é o mesmo "terceiro estado" que a ADR-0009 declara não existir, pela porta da visão em vez da materializada.
- **Impacto:** o cabeçalho da guarda **já declarava o resíduo** e o delegava ao verificador de infraestrutura, sob o argumento de que `BYPASSRLS` é propriedade de papel e não se lê no catálogo de objeto. O argumento estava errado por um detalhe decisivo: a assimetria não era do papel de quem consulta, e sim da visão **emprestar** o privilégio da dona a qualquer leitor — de modo que um papel sem privilégio nenhum lia todas as empresas. Isso é propriedade de objeto, é legível no catálogo, e é desta guarda.
- **Decisão (delegada ao usuário e tomada nesta intervenção): visão passa a ser EXAMINADA, exigindo `security_invoker = true`.** O invariante que isso instala: *uma visão em `negocio` não pode ser caminho mais fraco que a tabela que ela lê*. Com a opção, só o privilégio de **quem consulta** conta — exatamente como no acesso direto —, e o resíduo de `BYPASSRLS` volta a ser simétrico entre os dois caminhos, seja quem for a dona.
- **Alternativas recusadas:** (a) *simplesmente parar de excluir `v`* — toda visão reprovaria como `OBJETO_SEM_ISOLAMENTO_POSSIVEL`, o que é **falso** para a visão segura e proibiria um padrão legítimo sem ganho de segurança; (b) *reprovar pela dona* (`rolsuper`/`rolbypassrls`) — reprovaria visão segura cuja dona por acaso é superusuária, e faria uma verificação de objeto depender de estado de papel do cluster.
- **Provas.** Motivo novo `VISAO_NAO_DELEGA_ISOLAMENTO`. No `CT-009`, variante de visão sem a opção (reprova, com `empresa_id` presente para tornar o motivo discriminante) e companheiro positivo `CT-009 (v-ok)` — visão **com** a opção é aprovada **e** aparece em `tabelasExaminadas`, que é o que separa "foi olhada e passou" de "não foi olhada". Três mutantes reprovam: critério vazio, reexclusão de `v` (o defeito original) e visão cobrada pelas propriedades da tabela.
- **E a prova que faltava, comportamental:** `CT-107` em `isolamento.spec.ts`, porque o cabeçalho da guarda de catálogo é explícito em delegar semântica à suíte de isolamento. Duas visões de corpo IDÊNTICO sobre a mesma tabela: a criada pelo papel de migração **com** a opção devolve só os identificadores da empresa do contexto; a criada pela **superusuária sem** a opção devolve os das duas — lida pelo mesmo papel sem privilégio, no mesmo contexto fixado. O mutante que acrescenta a opção à visão vazante faz o vazamento **desaparecer**, o que fecha o par nos dois sentidos. Sem este caso o critério repousaria numa afirmação de comentário sobre o comportamento do PostgreSQL.
- **Sobre a redação apertada do `REVERTER EXIGE` da T4**, proposta na revisão e **deliberadamente não aplicada**: ela existia para cobrir a imprecisão que o `v` introduzia no campo. Com o `v` fora da lista de exclusão, o campo vigente passou a ser **verdadeiro sobre as quatro espécies restantes** (`i`, `I`, `S`, `c`, `t`), e reescrevê-lo seria a terceira alteração do mesmo contrato em dois dias por ganho marginal. A frase fica registrada aqui caso uma espécie nova volte a exigi-la. A decisão do aperto entrou como **`DECISÃO FECHADA` própria**, adjacente à da T4 e sem tocá-la — ela aperta o conjunto examinado, e a da T4 protege contra afrouxá-lo.

### D39 · MEDIO · technical_requirement · F1/fechamento · bateria privilegiada — **tem marcador**
> ⚠️ **Descoberto na primeira execução do agregador depois que o D6 foi fechado.** É achado novo, não um dos 37 — e é **MEDIO**, não BAIXO: instalação do zero produz servidor em que a API não sobe.
- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh` (`DÉBITO COM GATILHO — D39 · F1/fechamento`), na lista de chaves que o provisionamento cobra do arquivo de ambiente
- **Problema:** a F1/T8 tornou `BETTER_AUTH_SECRET` **exigida na partida** (`apps/api/src/configuracao/ambiente.ts`, mínimo de 32 caracteres) e a documentou no `.env.example`, mas **não** ensinou `provisionar-base.sh` a gerá-la. O script escreve `/etc/sysloc/backend.env` sem ela.
- **Impacto medido (2026-08-02, neste servidor):** `sysloc-api.service` em `failed` com `NRestarts=5`. Journal: *"configuração inválida na partida: BETTER_AUTH_SECRET: ausente"*. Consequência em cascata na bateria agregada: **11 das 14 falhas** — CT-002 (7), CT-004 (4, incluindo as 8 da sub-bateria de serviços), com todo `GET /saude`, `/saude/pronto` e `/docs` respondendo `000`. **O fail-fast funcionou como projetado**: o defeito é a lacuna de provisionamento, não a recusa.
- **Contornado nesta máquina** acrescentando a chave à mão ao arquivo de ambiente. **A causa segue aberta**: instalação nova continua nascendo quebrada.
- **O que fazer:** acrescentar a chave à lista cobrada e gerá-la no passo que escreve o arquivo, com a mesma disciplina das demais credenciais — **gerar se ausente e NUNCA regerar**, porque regerar invalida toda sessão em curso (o `.env.example` registra isso como alavanca de emergência deliberada, não como acidente). Valor alfanumérico, pelo mesmo motivo dos outros segredos: o leitor do arquivo recusa `@ : / ? & # %`.
- **Por que não foi feito na intervenção:** a única prova possível é a bateria privilegiada, que exige `sudo` interativo e que nenhum agente executa. Código que escreve credencial em `/etc` sem prova é o que a `testing-stack.md` chama de prova inconclusiva. **Escalado ao usuário, que decidiu adiar com gatilho.**

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

**FECHAMENTO DA F1 — intervenção dirigida fora do pipeline (2026-08-02).** Por decisão do usuário,
os débitos foram atacados **sem** `/agent-spec-debt-resolution` e sem gerar `v2-debits/`: a análise
mostrou que dos 37 apenas 6 eram trabalho de código, 14 eram escrituração, 10 já tinham dono em
fatia futura e 5 eram explicitamente "não fazer". **22 fechados, 15 abertos** (marcados acima).
Baseline comparada nos dois extremos, conforme P1/P5 do Protocolo.

O que a intervenção entregou além da escrituração:

- **Agregador da fatia (D6)** — `verificar-migracao.sh` entrou em `VERIFICADORES_DA_FATIA`, na ordem
  já decidida (depois de `verificar-provisionamento.sh`). Marcador removido no mesmo commit.
- **Análise estática da frente shell (D16)** — `shellcheck` fixado no `.mise.toml` e `pnpm lint:shell`
  encadeado no `lint` raiz, em `--severity=error` (0 achados hoje; `warning` tem 7, registrados).
  **Portão provado por falsificação**: script com `fi` ausente reprova, controle passa.
- **Rótulo de rota no journal (D27)** — as ~40 rotas de identidade não colapsam mais em `/v1/auth/*`.
  O encaminhador declara a rota real **só quando ela é padrão LITERAL** do registro do arcabouço;
  padrão com segmento variável não entra, e o `CT-106` prova que o valor do segmento não alcança o
  journal. Dois casos (`CT-018 e`, `CT-029`) foram atualizados com a linha `SUT_IS_CORRECT_BECAUSE:`
  e **fortalecidos**, não afrouxados.
- **Combinação de exigências sem prova (D31)** — `CT-105` novo, table-driven sobre as quatro
  combinações × rota dentro/fora, com asserção literal da mensagem. Dois mutantes (conector trocado,
  ordem invertida) reprovam pelo caso que antes não existia.
- **Flake do `eco.spec.ts`** — o `CT-005` deixou de **esperar** o estado de travamento e passou a
  **construí-lo**: uma tarefa em voo num processador que bloqueia até o teste liberar faz
  `close()` esperar por contrato. Três execuções seguidas verdes; mutante que cala a desistência
  reprova com a mesma mensagem que o flake produzia — que agora só pode significar SUT quebrado.
- **Validade da prova de falsificação (D34)** — a `testing-stack.md` passou a exigir o script `test`
  do pacote para todo mutante, nomeando `vitest run` avulso como inválido. **Medido nos dois
  sentidos**: mutante em `packages/auth/src/admissao.ts` com `vitest run --root apps/api` devolve
  *10 passed* (falso negativo) e reprova pelo caminho com build; e o contraexemplo (mutante alcançado
  mesmo sem build, quando a suíte importa o fonte por caminho relativo) está registrado para impedir
  a leitura errada da regra.
- **Regra de identificação de débito (D20)** — movida do bloco transitório do `CLAUDE.md` para a §3-B
  da `nao-regressao.md`, que é permanente. A §3-B ganhou também a **verificação de duas pontas**,
  executada aqui: 10 marcadores conferidos nos dois sentidos, todos OK.

**Três decisões merecem conferência humana:**

1. **D26 — as 35 rotas toleradas ficaram TOLERADAS**, por escolha do usuário entre três saídas. A
   razão está escrita no ponto (`SUPERFICIE_TOLERADA`), com o gatilho de revisão no congelamento da
   superfície. Comportamento inalterado.
2. **D25 (item 2) — a asserção automatizada foi avaliada e RECUSADA**, com as duas formas possíveis
   descartadas por razão concreta: estreitar o tipo do construtor obrigaria a enfraquecer o `CT-005`
   de `erros.spec.ts` (`it.each` sobre todo o enum), e varrer o fonte esbarraria no próprio
   comentário que descreve a construção. Fica a regra escrita.
3. **D35 — o trabalho foi feito, a task não foi criada.** Os itens que o débito delega à "task de
   fechamento da F1" estão entregues aqui; o único que **não** está é declarar as seis rotas da §4.1
   no documento OpenAPI, cujo dono foi precisado no código: a **publicação do `@sysloc/contracts`**,
   porque declará-las antes produziria contrato que o congelamento reescreveria.

🔴 **As baterias privilegiadas da T5 foram EXECUTADAS pelo operador, e ao menos uma REPROVOU.**
Correção de fato registrada em 2026-08-02: a nota mais abaixo desta §4, escrita durante o run, diz
que elas "não foram executadas" — era verdade quando o run fechou e **deixou de ser**. A intervenção
de fechamento repetiu a afirmação vencida sem verificar, e isto a corrige.

**É achado, não escrituração.** As três (`CT-030`, `CT-031`, `CT-032`) são a verificação de
infraestrutura contra o **cluster real** — papéis, propriedade dos schemas, cobertura de RLS e
higiene da credencial. A suíte automatizada não as substitui: ela roda contra instância efêmera por
decisão da ADR-0006, e a §20 da tech spec registra a duplicação como deliberada justamente porque
"a propriedade que interessa — o isolamento onde a operação acontece — só é observável ali".

**O que falta para fechar**: o desfecho POR CASO não está registrado em lugar nenhum, e sem ele não
se sabe o que a fatia provou sobre o cluster que opera. Reexecução:
`sudo bash deploy/scripts/instalacao/verificar-fundacao.sh` (com `pnpm build` antes) — o agregador
agora invoca as quatro baterias de uma vez. ⚠️ A execução reescreve o `pg_hba` e reinicia o cluster.

**Também abertos, e fora do escopo desta intervenção**: `P-T6-1` e `P-T6-2` (§7 do card da T8) — o
`ACESSO_RECUSADO` sobrecarregado exige valor novo no enum mais migração `0003`, e o blast radius
medido pela decisão D-E3 do `workflow-report.md` não cabia numa varredura de débito.

---


**Autorização do usuário no meio do run (2026-08-02):** pausas pré-respondidas com a opção recomendada, e **limite de 3 tentativas suspenso**. Foi usado — a T6 precisou de 6 correções, 5 rodadas de QA e 4 de Tech Review.

**Um conflito de spec resolvido por escalada, na T1.** O card do CT-027 exigia redigir `callbackURL`, contra (a) a Obs do CT-028 na mesma §6.6, (b) o caso verde `CT-008` da F0 e (c) o texto do próprio marcador D25. O QA reproduziu o mutante e **confirmou que redigi-lo causaria regressão R1**. O **card foi corrigido**, com a razão inline. **É o único ponto do run em que uma spec foi alterada — vale conferência humana.**

**Uma intervenção dirigida fora do pipeline: o TOCTOU de `reservarPorta()`.** O Gate 2 da T4 investigou uma instabilidade, **rejeitou a hipótese de contenção genérica** e diagnosticou TOCTOU em `packages/shared/test/efemero-comum.ts`. Sob a `testing-stack.md` (*"flaky é defeito: para a fila até ser corrigido"*), a fila foi parada antes de T6–T11 acrescentarem mais suítes. **O executor refinou o diagnóstico**: a partição por `VITEST_WORKER_ID` que o Staff recomendou **não fecharia a classe** (o Turbo roda 4 pacotes em paralelo, cada um com "worker 1"). Corrigido por **trava atômica no núcleo** (soquete de domínio Unix abstrato). A corrida foi demonstrada duas vezes no código antigo — inclusive **a baseline do próprio executor reprovou** com `porta 24381: Address already in use` — e é impossível com a correção. **Prova versionada** em `packages/shared/test/reserva-de-porta.spec.ts`.

**Três vezes um executor falsificou uma sugestão de gate, com evidência, e o gate se retratou.** (1) A T2 mostrou que uma asserção classificada como tautológica era a **guarda de conjunto vazio**. (2) A T6 mostrou que a asserção de duração *contra a constante do SUT* que o QA pediu é **tautológica** — *"o CT-015 ficou verde sobre a política errada"*. (3) A T6 mediu que remover `zod` de `dependencies` **quebra a emissão de declaração** (`TS2883`), revertendo a recomendação do Staff, e deixou a advertência que vale para o repositório: *"um `pnpm build` incremental passa mesmo sem `zod`; só o build forçado com estado limpo mede"*.

**Dois erros de numeração de débito, meus, corrigidos.** Atribuí `D33`/`D34` sem notar que a F0 já os usava; renumerei para `D41`/`D42`; o Staff então mostrou que a nota que escrevi (*"numeração global"*) era **falsa contra esta §2**, que numera localmente. Resolvido adotando **numeração por fatia** com o identificador sendo o par `Dnn · F{n}/T{n}` — os marcadores são hoje `D6` e `D7`.

**Pendências herdadas que ganharam dono explícito no card da T8** (§7, `P-T6-1` e `P-T6-2`), porque *"endereçar a pendência apenas na §7 do card de origem é pior que não registrá-la"*: o `ACESSO_RECUSADO` sobrecarregado (**a janela fecha na T7**, quando o volume nascer) e o limite de taxa/retenção de `tentativa_login` (vetor medido: e-mail cercado de espaços grava linha com `usuario_id` resolvido **sem pagar `scrypt`**).

**A T5 tem baterias que exigem `sudo` interativo e não foram executadas** — ⚠️ **VENCIDA: elas foram executadas depois, e ao menos uma reprovou; ver o item em vermelho no topo desta §4.** Mantida como estava porque é o registro do que valia no fecho do run.

**(Texto original.)** — `verificar-provisionamento.sh` (CT-030) e `verificar-migracao.sh` (CT-031, CT-032). É o papel do gate, não suíte pulada (`testing-stack.md`). **Precisam ser rodadas pelo operador**: `sudo bash provisionar-base.sh` (duas vezes), `sudo bash migrar-banco.sh`, `sudo bash verificar-provisionamento.sh`, `sudo bash verificar-migracao.sh`, com `pnpm build` antes. ⚠️ **A primeira execução após a T5 reescreve o `pg_hba` e reinicia o cluster** — comportamento projetado do P03, mas impacto operacional real.

**A T7 reprovou por uma prova que não podia falhar — e o padrão é novo.** As reprovações anteriores desta fatia foram por *asserção* fraca. Aqui a asserção estava certa e a **procedência da referência** é que estava corrompida: o caso comparava a recusa da barreira contra "a recusa que o arcabouço emite", mas um caso anterior do mesmo `describe` havia desativado o sujeito e nunca o restaurou, então os dois lados da igualdade eram a mesma constante. O mutante `message: 'Credenciais invalidas'` **sobrevivia à suíte inteira** e só reprovava com o caso rodando isolado. Vale para quem escrever prova de indistinguibilidade daqui em diante — **a T11 (CT-016) é a próxima**: referência herdada de arranjo alheio é literal disfarçado.

**O QA testou a propriedade da correção, não a presença dela.** Depois de reproduzir o mutante, ele injetou um arranjo hostil numa **terceira** dimensão que o caso corrigido não restaura (bloqueio por cinco falhas) e verificou que o caso **reprova alto e no ponto certo** em vez de degradar em silêncio. É a diferença entre conferir que a correção existe e conferir que ela fecha a classe.

**Um erro de numeração de débito, agora vindo do gate.** O Staff sugeriu registrar o débito novo como `D8`, por sucessão sobre os débitos **com marcador** (D6, D7). O universo é esta §2, que ia até **D20** — o número certo é **D21**. Corrigido antes de chegar ao código; o gate registrou e aceitou. É a terceira vez que a numeração morde nesta fatia, sempre pela mesma causa: **confundir o conjunto dos marcadores com o conjunto dos débitos.**

**O defeito da T8 que a suíte não podia pegar — e por quê.** O limitador de taxa do arcabouço sobe **sozinho em produção** (`enabled ?? isProduction`) e emite `429`; o filtro colapsava todo status fora de uma tabela de quatro entradas em `500 ERRO_INTERNO`, **registrado como "falha do serviço"**. Ou seja: o journal afirmaria falha do servidor **no exato momento de um ataque**. Nenhum caso poderia tê-lo pego — o e2e roda com `NODE_ENV='test'`, onde o limitador está desligado. Foi achado por **leitura do pacote instalado**, não por teste. Vale para quem for revisar integração com biblioteca de terceiro: *o que a suíte não alcança por construção não é ausência de risco.*

**Duas mudanças de política autorizadas pelo usuário no meio da T8 (2026-08-02).** Ele perguntou por que os débitos estavam sendo escritos no `CLAUDE.md` e se isso custava rodadas. Medi antes de responder: o bloco ocupava **5.794 de 20.607 caracteres (28%)** do arquivo que entra no contexto de **todo subagente, em toda task**, com linhas de até **1.185 caracteres** — contra a §3-B, que manda o registro ser *"ponteiro curto"*. E das 5 reprovações do Gate 2 da T8, **duas eram escrituração**, metade de uma rodada gasta em contabilidade. Decisões: **(1)** a tabela virou índice de uma linha por débito — de 5.794 para **2.513 caracteres**, maior linha de 1.185 para **186** —, com o detalhe só na §2; é cumprimento da §3-B, não mudança de regra. **(2)** escrituração de débito passa a ser reportada como `BAIXO` pelos gates, anotada em vez de disparar correção; se o defeito em si é bloqueante por mérito próprio, entra como achado separado. Persistida em memória para valer nas sessões seguintes.

**Flake pré-existente que precisa de dono — não é regressão de nenhuma task desta fatia.** `apps/worker/test/eco.spec.ts > CT-005` (F0/T6) reprovou numa execução da suíte completa (`expected 'RECURSOS-DEVOLVIDOS' to be 'PRAZO-ESTOURADO'`) e passou isolado e nas duas execuções seguintes; `git diff -- apps/worker/` é **vazio**. O próprio arquivo admite (linhas 43-45) que *"com o pedido logo após a queda, o travamento acontece em cerca de metade das execuções"* — sob a concorrência do Turbo, o timing muda e o caso reprova por **não observar o defeito que ele existe para cortar**. A `testing-stack.md` é explícita: *"flaky é defeito: para a fila até ser corrigido"*. Precisa de uma forma de **forçar deterministicamente** o estado de travamento, em vez de depender de o ambiente produzi-lo. Dono sugerido: task de fechamento da F1.

**Verificação de duas pontas que o fecho da fatia deve executar** (recomendação do Staff): para cada marcador devolvido por `grep -rl --exclude-dir=dist "DÉBITO COM GATILHO" apps packages deploy`, conferir que **(i)** existe `### D{n}` na §2 que o `ÍNDICE` nomeia e **(ii)** o par `F{n}/T{n}` do cabeçalho bate com a linha da tabela do `CLAUDE.md`. Foi essa segunda ponta que pegou o `D32 (F0/T5)` errado.
