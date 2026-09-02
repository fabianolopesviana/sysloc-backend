# Plano de origem — `painel-master-administradores/v1`

> **Este arquivo é INSUMO AUTORADO, não artefato gerado.** Ele é o plano aprovado pelo usuário em
> 2026-09-01, ao fim da sessão de planejamento que originou a fatia, e foi a entrada do
> `/agent-spec-pre-refinement` e do `/agent-spec-generate-tech-alignment`. Trazido para dentro da
> fatia em 2026-09-01, **byte a byte**, porque vivia apenas na máquina local, fora do versionamento,
> com nome gerado e cópia única.
>
> **O que dele já tem dono no pipeline:**
> - as 8 decisões de produto → `pre-refinement.md` §11 e `prd.md` (10 US · 20 CA · 16 RN);
> - as decisões arquiteturais → `tech-alignment.md` (D1–D6) e a **ADR-0038**.
>
> ⚠️ **O que dele NÃO tem dono ainda, e é a razão de este arquivo existir**: o **fatiamento em 7
> tasks**, os **CTs propostos** (CT-1204 em diante) e os **deltas de âncora declarados task a task**
> (§5.2 de cada uma). Isso é material do `task_plan.md`, que ainda não foi gerado — e a rule
> `ancoras-de-superficie.md` exige que esses deltas sejam **declarados antes** de a spec fechar.
>
> ⚠️ **Ele é registro de um instante, e não se reescreve.** Onde divergir dos artefatos gerados,
> **prevalece o artefato** — a Tech Spec é quem decide o COMO, e o vocabulário canônico é o do
> `docs/specs/domain-glossary.md` (que o PRD já aplicou: *Empresa*, *Admin Empresa*, *Exclusão
> definitiva*; o texto abaixo ainda usa "administrador" e "inquilino").

---

# Painel Master — administradores, edição e exclusão física

> **Escopo: backend apenas.** Nenhum arquivo React, nenhum arquivo na máquina local. O que o
> frontend precisa saber sai no `handoff-master-frontend.md` (T7).
>
> Destino: entrada para `/agent-spec-pre-refinement`.

---

## 1. Contexto — por que esta fatia existe

O Painel Master (`syslocadmin.systera.com.br`, app separado) tem hoje **seis rotas** e um furo
funcional que o próprio handoff documenta três vezes:

> *"**Listar usuários de uma empresa pelo Master** — não há; ele admite administrador e reemite
> senha por id, nada além. ⚠️ **Guarde o `usuarioId` da admissão**: sem ele, a reemissão fica sem
> alvo."* — `docs/plano-backend-novo/handoff-master-frontend.md:575-577`

Ou seja: o operador do SaaS só conhece o identificador de um administrador no instante em que o
admite. Perdeu a tela, perdeu o alvo. É isso que hoje força a reemissão de senha provisória a viver
num menu superior pedindo o UUID à mão.

O cliente pediu: **listar os administradores de cada empresa**, com reemissão de senha como ação de
linha, mais **suspender/reativar**; e — como refactory que vale para as duas listagens — **editar** e
**excluir de fato**, com a exclusão desabilitada e explicada quando a entidade já tiver registros.

**Resultado pretendido:** o Painel Master deixa de ser uma superfície de mão única (cria e nunca mais
enxerga) e passa a ter o ciclo de vida completo das duas entidades que ele governa.

---

## 2. O que **não** muda, e por quê

- **A reemissão de senha provisória não ganha uma linha de código.**
  `POST /v1/master/usuarios/:id/senha-provisoria` (`apps/api/src/master/empresa.controller.ts:326`)
  **sempre** recebeu o `usuarioId` no caminho — nunca e-mail, nunca corpo. O pedido *"pegando o
  identificador automaticamente"* é satisfeito por **existir a listagem**, que passa a fornecer o
  `usuarioId`. Mover o botão do menu para a linha é frontend puro.
- **Nenhuma rota do app da imobiliária é acrescentada, removida ou alterada.** O congelamento do
  marco de entrega alcança a superfície que o `@syslocbr/contracts` entrega ao cliente;
  `/v1/master/*` está **fora** dele por decisão registrada
  (`docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech_spec.md:705`, repetida no docblock de
  `empresa.controller.ts:22-28`).
- **Nenhuma migração.** O critério de exclusão é imposto pelas FKs `ON DELETE no action` que já
  existem. A trilha da ADR-0013 (`identidade.tentativa_login`) fica intacta.
- **`packages/contracts` não é tocado.** O Master não tem contrato publicado, e isso é deliberado
  (`empresa.controller.ts:22-28`) — os esquemas Zod vivem inline no controlador.

---

## 3. Decisões do usuário (tomadas neste planejamento — não reabrir)

| # | Decisão | Consequência aceita |
|---|---|---|
| 1 | **Exclusão física é admitida**, com ADR nova declarando que o alcance da ADR-0014 é o cadastro do **domínio** (`negocio`), não o tenant nem a identidade | A objeção da 0014 (*"a fronteira muda com o tempo sem que o usuário entenda por quê"*) fica mitigada porque a superfície **diz** o motivo |
| 2 | **Administrador é excluível apenas enquanto nunca tiver tentado entrar** | Janela curta na vida real; cobre o caso "cadastrei com o e-mail errado". Sem migração |
| 3 | **A listagem devolve apenas `ADMIN_EMPRESA`** | O operador não vê a equipe interna da imobiliária |
| 4 | **Verbo `suspensao`/`reativacao`** para o administrador; a coluna continua `identidade.usuario.ativo` | O Painel Master fala uma língua só; o app do cliente segue com `desativacao` |
| 5 | **A suspensão pelo Master é reversível pelo app do cliente** | Coerente com a ADR-0013: o poder do Master é sobre empresas. Contenção real = suspender a empresa |
| 6 | **Excluir empresa leva os administradores dela junto**, na mesma transação | Não é cascata cega: a FK de **cada** administrador ainda o protege, e a recusa de um aborta tudo |
| 7 | **`impedimentos` é vocabulário fechado de classe**, nunca nome de entidade nem contagem | Preserva a RN-13 (`CT-226`) intacta |
| 8 | **Recusa é `422 CAMPO_INVALIDO` + `detalhes.motivo`** | Reusa o molde de `reemitirSenha` e `admitirEmpresa` no mesmo arquivo; `packages/shared` intocado |

---

## 4. Os dois achados que decidem o desenho

### A1 · Contar linhas de `negocio` a partir do Master **devolve sempre zero**

O Master corre com `empresaId: null`; a unidade de trabalho emite `SET LOCAL app.empresa_id = ''`; a
política é `FORCE ROW LEVEL SECURITY` com
`USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)`
(`packages/db/migracoes/0001_seguranca.sql:41,60-69`).

Logo, `SELECT count(*) FROM negocio.contrato WHERE empresa_id = $1` escrito na camada do Master
devolve **0 para uma empresa cheia** — e a superfície habilitaria apagar um tenant inteiro. É
silencioso: nenhum teste que não o persiga o pega.

**Saída adotada — deixar o banco decidir.** As 16 FKs de `negocio` para `identidade.empresa` são
`ON DELETE no action`, e a verificação de integridade referencial do PostgreSQL **ignora RLS por
construção**. `DELETE FROM identidade.empresa WHERE id = $1` é recusado com `23503` sempre que houver
qualquer linha de negócio, e não há política que o engane. É a mesma doutrina que `admitirEmpresa` já
usa por escrito (`packages/db/src/empresa.ts:126-134`: *"A duplicidade é decidida pelo banco, e não
por uma leitura prévia"*).

**Rejeitadas:** fixar `app.empresa_id` com o `:id` do caminho (é o mutante do `CT-014` e o que a
ADR-0008 proíbe); função `SECURITY DEFINER` (a emenda de 2026-08-13 da ADR-0024 exige função **sem
parâmetro de empresa**, e a nossa precisaria dele).

**Teorema de completude** (precisa de asserção própria — `CT-1219`): das 23 tabelas de `negocio`, 16
têm FK direta para `identidade.empresa` e 7 alcançam por FK composta ao pai **com a coluna do pai
`NOT NULL`**. Logo toda linha das 7 implica linha numa cadeia que termina numa das 16. **Se o
`DELETE` da empresa passa, as 23 estão vazias para ela.**

### A2 · `encerrarSessoesDaPessoa` não serve, e falha em silêncio

`packages/db/src/pessoa.ts:255` alcança a sessão por `USING negocio.acesso_usuario_app` — sob RLS.
Para o Master devolve **0 sempre**, e a suspensão publicaria `sessoesEncerradas: 0` com sessões
vivas. Mesma classe de armadilha. O mesmo vale para `definirAtivoDaPessoa` (`pessoa.ts:214`).

Além disso, o administrador admitido pelo Master **não tem vínculo** em `negocio.acesso_usuario_app`
até alguém agir sobre ele pelo app do cliente — a razão está escrita em `empresa.service.ts:310-334`
(gravar o vínculo ali violaria a ADR-0008, porque o `empresa_id` viria do caminho da requisição).

**Saída:** funções novas, diretas em `identidade` (que não tem RLS), no molde de
`encerrarSessoesDaEmpresa` (`empresa.ts:366`) — legítimo porque, como o cabeçalho daquele módulo
declara (`empresa.ts:24-38`), *"o escopo aqui é a chave, não a política"*.

---

## 5. A superfície nova — 7 rotas

Todas sob `@ExigePerfil('SYSLOC_MASTER')` **declarado na classe**, como as seis existentes
(`empresa.controller.ts:219`). A governança é a **dimensão de perfil**, não uma chave do catálogo: a
ADR-0011 declara o catálogo fechado nas 17 chaves do app da imobiliária, e o docblock do controlador
já registra por extenso por que o Master atravessa por perfil (`:13-17`).

| # | Método e caminho | Entrada | Saída |
|---|---|---|---|
| R1 | `GET /v1/master/empresas/:id/administradores` | `:id` UUID · query `{limite?, deslocamento?}` (reusa `ESQUEMA_DA_JANELA`) | `{ itens: [{usuarioId, nome, email, estado, criadoEm, exclusao}], total, limite, deslocamento }` |
| R2 | `POST /v1/master/usuarios/:id/suspensao` | `:id` UUID, sem corpo | `{ usuarioId, estado: 'SUSPENSO', sessoesEncerradas }` |
| R3 | `POST /v1/master/usuarios/:id/reativacao` | `:id` UUID, sem corpo | `{ usuarioId, estado: 'ATIVO' }` |
| R4 | `PUT /v1/master/usuarios/:id` | corpo `{nome, email}` (reusa `ESQUEMA_DO_ADMINISTRADOR`) | `{ usuarioId, nome, email, estado, criadoEm }` |
| R5 | `DELETE /v1/master/usuarios/:id` | `:id` UUID | `{ usuarioId, nome, email }` |
| R6 | `PUT /v1/master/empresas/:id` | corpo `{nome, documento}` (reusa `ESQUEMA_DA_EMPRESA_NOVA`) | `EmpresaDoContrato` (as 5 chaves de hoje) |
| R7 | `DELETE /v1/master/empresas/:id` | `:id` UUID | `{ id, nome, documento }` |

### Justificativa de forma

- **`PUT` no item, corpo completo.** É a forma canônica deste repositório: **10 `@Put`**, sete deles
  `@Put(':id')` em controladores de cadastro (`conjunto.controller.ts:342`, `imovel.controller.ts:295`,
  `locador.controller.ts:180`, `locatario.controller.ts:255`, `fiador.controller.ts:180`,
  `comodo.controller.ts:169`, `contrato.controller.ts:739`). **`@Patch` = 0.** O invariante já escrito
  (`conjunto.controller.ts:342-345`) é *"o corpo é completo; campo ausente é recusa por campo
  obrigatório"*.
- **`PUT` cumpre a ADR-0021 por construção.** Como `estado`/`suspensaEm`/`ativo` **não existem** nos
  esquemas de entrada, o `strictObject` recusa por chave desconhecida quem tentar transitar estado
  pelo corpo — exatamente o que a emenda de 2026-08-22 descreve para `esquemaDeContratoAlterado`.
- **`DELETE` já significa "a linha some" nesta base.** Há **um** `@Delete` hoje, e está exatamente
  onde a ADR-0014 abre exceção — o cômodo, cujo docblock diz *"**O cômodo é removido de fato** — é a
  exceção que a ADR-0014 declara"* (`comodo.controller.ts:215-221`). Reusar o verbo torna a superfície
  legível sem ler documento: `DELETE` é físico, `POST /:id/suspensao` é lógico. Um `POST /:id/exclusao`
  faria o oposto — poria remoção física na mesma forma sintática das transições lógicas.
- **`administradores` na coleção, `usuarios` nos atos.** O segmento `usuarios` já é publicado
  (`POST /v1/master/usuarios/:id/senha-provisoria`) e removê-lo seria retirada de rota; a coleção
  **filtra** `ADMIN_EMPRESA` e chamá-la `usuarios` mentiria sobre o conteúdo. A assimetria repete a
  que já existe entre `POST empresas/:id/admin` e `POST usuarios/:id/senha-provisoria`, e vai escrita
  no docblock.

### Recusas (ADR-0017, envelope `{codigo, mensagem, campo?, detalhes?}`)

- `401 NAO_AUTENTICADO` / `403 ACESSO_NEGADO` — herdados da guarda.
- `404 RECURSO_NAO_ENCONTRADO` — empresa/pessoa inexistente, sem discriminar causa.
- `422 CAMPO_INVALIDO` `campo:'id'` `detalhes:{perfilExigido:'ADMIN_EMPRESA', perfilDoAlvo}` — alvo de
  outro perfil em R2–R5. **Molde literal de `reemitirSenha`** (`empresa.service.ts:584-593`).
- `422 CAMPO_INVALIDO` `campo:'documento'|'email'` `detalhes:{motivo:'…_JA_REGISTRADO'}` — R4/R6,
  molde de `admitirEmpresa` (`:256-262`) e `admitirAdministrador` (`:349-355`).
- **Recusa de exclusão:**

```json
{ "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "id",
  "detalhes": { "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
                "impedimentos": ["REGISTROS_DE_NEGOCIO"], "alternativa": "SUSPENSAO" } }
```

`alternativa` existe para que a tela não redija a saída por conta própria — é o servidor dizendo o
que sobra. ⚠️ **O `detail` do driver nunca sai na resposta** (carrega valores de chave); só o par
`(code, constraint_name)` é lido.

---

## 6. Camada de acesso

Zero SQL em `apps/api/src` (`CT-012` mede). Dois módulos:

- **`packages/db/src/empresa.ts`** cresce com `alterarEmpresa`, `excluirEmpresa`,
  `elegibilidadeDeExclusaoDaEmpresa`.
- **`packages/db/src/administrador-do-master.ts`** (novo) — `listarAdministradoresDaEmpresa`,
  `lerAdministrador`, `definirAtivoDoAdministrador`, `encerrarSessoesDoAdministrador`,
  `alterarAdministrador`, `excluirAdministrador`, `elegibilidadeDeExclusaoDoAdministrador`.
  **O nome carrega o sujeito de propósito**: ele existe para não ser confundido com `pessoa.ts`, cujas
  funções homônimas alcançam pelo vínculo sob RLS e são inúteis aqui (A2). O docblock abre declarando
  essa distinção.

**Predicados que moram no SQL, nunca na borda:** `perfil = 'ADMIN_EMPRESA'` entra em toda consulta e
em todo `UPDATE`/`DELETE`. A razão está escrita em `listarEmpresasAtivas` (`empresa.ts:283-290`): *"a
enumeração **é** o filtro — a diferença é entre impossível e evitado"*.

**Violação de unicidade vira classe tipada**, no molde exato de `ErroDeIdentificadorMunicipalEmUso`
(`packages/db/src/imovel.ts:834-861`): `tx.savepoint` + reconhecimento por **forma** do par
`(code, constraint_name)` — nunca por texto de mensagem. Constantes medidas:
`23505`, `empresa_documento_unique`, `usuario_email_unique`.

**Edição de e-mail é `UPDATE` puro** — a conta local usa o próprio `usuarioId` como `accountId`
(`packages/auth/src/onboarding.ts:203,215-218`), `identidade.conta` não guarda endereço,
`emailVerificado` não é lido pelo produto e não há `requireEmailVerification`. Nada em `@sysloc/auth`
é chamado.

### A sonda de elegibilidade — uma instrução, dois usos

```ts
// elegibilidadeDeExclusaoDaEmpresa(tx, empresaId) -> { permitida, impedimentos }
try {
  await tx.savepoint(async (sonda) => {
    await excluirEmpresa(sonda, empresaId);   // a MESMA instrução que o ato executa
    throw new SondaConcluida();               // força ROLLBACK TO SAVEPOINT sempre
  });
} catch (erro) { /* SondaConcluida → permitida; 23503 → impedimento traduzido */ }
```

**Por que assim, e não contando linhas:** a sonda executa a mesma instrução do ato. Não existe um
segundo critério que possa divergir do primeiro — que é a classe de defeito que a §5 da
`nao-regressao.md` persegue por escrito. Contar linhas seria a segunda definição, *e* mentiria sob
RLS (A1).

**TOCTOU:** não é eliminada, e não pode ser. O que o desenho garante é que **o clique é
auto-verificado** — decidir e excluir são a mesma instrução, na mesma transação, sob as mesmas FKs. O
pior caso não é exclusão indevida: é uma recusa que **nomeia o motivo**. É precisamente a mitigação da
objeção da ADR-0014.

⚠️ **Propriedade a declarar no docblock, não a esconder:** `ROLLBACK TO SAVEPOINT` **não libera
bloqueios**. A sonda de uma página de até `MAIOR_PAGINA_DE_EMPRESAS = 200` segura `FOR KEY SHARE` nas
linhas visitadas até o fim da transação de leitura.

### Exclusão da empresa — duas instruções, uma transação

```sql
DELETE FROM identidade.usuario WHERE empresa_id = $1;                  -- (a) os admins do Master
DELETE FROM identidade.empresa WHERE id = $1 RETURNING id, nome, documento;  -- (b)
```

(a) é o que o requisito chama de *"além do próprio cadastro feito no Master"* — mas **só passa se
cada administrador for, ele mesmo, elegível**, porque a FK de (a) recusa qualquer um com trilha,
vínculo ou autoria. (b) recusa se sobrou qualquer linha de negócio. Recusa em qualquer das duas
aborta tudo. `conta`, `dois_fatores` e `sessao` somem por `cascade`.

⚠️ `plataforma.notificacao_bancaria` não tem `empresa_id` (ADR-0031) e não é alcançada —
corretamente: uma notícia retida só existe se houve `negocio.cobranca`, que já impede a exclusão.

### Vocabulário fechado (exige âncora de igualdade — `ancoras-de-superficie.md`)

```ts
export const IMPEDIMENTOS_DE_EXCLUSAO = Object.freeze({
  REGISTROS_DE_NEGOCIO: '…',           // as 16 FKs de negocio → identidade.empresa
  ADMINISTRADORES_NAO_ELEGIVEIS: '…',  // usuario_empresa_id_empresa_id_fk, em (a)
  TENTATIVA_DE_ENTRADA: '…',           // tentativa_login_usuario_id_usuario_id_fk
  VINCULO_DE_ACESSO: '…',              // as 2 FKs de acesso_usuario_app
  AUTORIA_EM_REGISTRO: '…',            // as 5 colunas de autoria em negocio
} as const);
```

---

## 7. Suspensão do administrador — o efeito colateral

Molde literal de `EmpresaService.suspender` (`empresa.service.ts:396-429`), **uma transação**:

```
definirAtivoDoAdministrador(tx, usuarioId, false)   // undefined → 404 (após o 422 de perfil)
encerrarSessoesDoAdministrador(tx, usuarioId)       // MESMA transação
```

O encerramento roda **sempre**, não só quando a marca é nova — a razão está em `:392-394`: na
repetição a barreira de admissão já recusa a entrada, e `sessoesEncerradas: 0` passa a ser **fato
medido** em vez de constante escrita num ramo. A resposta publica `sessoesEncerradas` porque ele é a
**prova** de que o encerramento aconteceu no ato: sem ele, uma implementação que só marca passa em
todas as asserções (eixo do `CT-224`).

A reativação **não** devolve sessão (RN-05) e **não** reenfileira nada.

---

## 8. Fatiamento

Dependências: T1,T2,T3 (dados) → T4,T5,T6 (borda) → T7 (documento). CTs a partir de **CT-1204**
(o maior em uso é CT-1203).

### T1 · `@sysloc/db` — leitura e ciclo de estado do administrador
`administrador-do-master.ts` com as quatro primeiras funções + barril.
- `CT-1204` — a listagem devolve **só** `ADMIN_EMPRESA`: arranjo com 2 admins + 1 `USUARIO_EMPRESA` +
  1 admin de **outra** empresa. As duas pernas negativas são o que discrimina.
- `CT-1205` — janela servida, não ecoada; desempate por `(nome, id)` com homônimos.
- `CT-1206` — `definirAtivoDoAdministrador` idempotente e não alcança `USUARIO_EMPRESA`.
- `CT-1207` — **a perna que fecha a A2**: com `app.empresa_id` vazio,
  `encerrarSessoesDoAdministrador` devolve `2` **enquanto** `encerrarSessoesDaPessoa` sobre a mesma
  pessoa devolve `0`. O par é a asserção.
- `CT-1208` — a sessão de outra pessoa da mesma empresa sobrevive (eixo do `CT-228`).

**§5.2** — `packages/db/test/unidade-de-trabalho.spec.ts`, `SIMBOLOS_ESPERADOS` (CT-012): **220 → 224**.

### T2 · `@sysloc/db` — edição das duas entidades
`alterarEmpresa`, `alterarAdministrador`, `ErroDeDocumentoDeEmpresaEmUso`, `ErroDeEmailDeUsuarioEmUso`.
- `CT-1209` — altera e devolve a linha nova; `criadaEm`/`id` intocados; **`suspensa_em` preservado**.
- `CT-1210` — documento repetido levanta a classe e **nada é gravado** (asserção sobre o estado).
- `CT-1211` — o mesmo para e-mail, **com a perna que discrimina o `constraint_name`**: violação de
  `usuario_id_empresa_key` **não** vira `ErroDeEmailDeUsuarioEmUso`. Sem ela, um `catch` genérico de
  `23505` passa.
- `CT-1212` — depois de trocar o e-mail, **a entrada com a credencial existente continua
  funcionando** (prova de que `identidade.conta` não guarda endereço).
- `CT-1213` — `alterarAdministrador` sobre `USUARIO_EMPRESA` devolve `undefined` e não escreve.

**§5.2** — `unidade-de-trabalho.spec.ts`: **224 → 228**.

### T3 · `@sysloc/db` — exclusão e elegibilidade
`excluirEmpresa`, `excluirAdministrador`, as duas sondas, `IMPEDIMENTOS_DE_EXCLUSAO` e o mapa
`constraint_name → impedimento`.
- `CT-1214` — **a perna que fecha a A1, e é a razão da fatia.** Empresa cheia + sonda com
  `app.empresa_id` vazio → `permitida: false` com `REGISTROS_DE_NEGOCIO`. **Perna irmã no mesmo
  caso:** um `SELECT count(*) FROM negocio.conjunto WHERE empresa_id = $1` no mesmo contexto devolve
  **0** — o controle que prova que a alternativa ingênua mentiria. Sem ela a asserção não discrimina.
- `CT-1215` — empresa vazia com 1 admin nunca usado: apaga empresa, usuário e conta (`cascade`), com
  contagem zero **medida contra a contagem antes**.
- `CT-1216` — a sonda não deixa efeito: contagem idêntica antes e depois, e depois do commit.
- `CT-1217` — os **três** impedimentos do administrador, um caso por causa, nenhum colapsado:
  (a) `tentativa_login`; (b) vínculo em `acesso_usuario_app`; (c) autoria em
  `certificado_do_provedor.registrado_por`. `it.each` afirmando o **token**, não só `permitida:false`.
- `CT-1218` — o admin virgem é excluído, e `conta`/`dois_fatores`/`sessao` somem por `cascade`.
- `CT-1219` — **o teorema de completude, por `pg_catalog`**, com igualdade de conjunto e controle
  antivácuo: as 23 tabelas de `negocio`; as 16 com FK direta; as 7 restantes com coluna referenciadora
  `NOT NULL` cujo fecho transitivo alcança as 16. Impede que uma tabela nova nascida sem FK para
  empresa torne a sonda incompleta em silêncio. **Comportamental (lê o catálogo, não o texto do
  fonte) → sem prova de falsificação.**
- `CT-1220` — o mapa cobre, **por igualdade**, o conjunto das FKs `no action` lidas do catálogo. FK
  nova sem entrada reprova aqui, em vez de virar `ERRO_INTERNO` em produção.

**§5.2** — `unidade-de-trabalho.spec.ts`: **228 → 233**.

### T4 · Borda — listagem, suspensão e reativação (R1, R2, R3)
`apps/api/src/master/administrador.controller.ts` + `administrador.service.ts`, em `MasterModule`.
Derivação `ativo → estado` em **ponto único** (`paraContratoDoAdministrador`), molde de `paraContrato`
(`empresa.service.ts:607-613`).
- `CT-1221` — item da listagem com **exatamente** as chaves do contrato (igualdade profunda, molde do
  `CT-226`), nenhum dado de negócio.
- `CT-1222` — só `ADMIN_EMPRESA`, e só da empresa do caminho.
- `CT-1223` — suspender encerra **na origem**: `sessoesEncerradas: 2`, cookie antigo → `401`, e a
  colega de empresa segue `2xx` no mesmo instante.
- `CT-1224` — repetir devolve `sessoesEncerradas: 0` e o mesmo corpo.
- `CT-1225` — reativar **não** devolve sessão; a pessoa entra de novo.
- `CT-1226` — alvo `USUARIO_EMPRESA` → `422` com o corpo **inteiro** por igualdade.
- `CT-1227` — sessão `ADMIN_EMPRESA` nas três rotas → `403`, corpo inteiro por igualdade.

Acessórios **importados** de `apps/api/test/acessorios-de-borda.ts`, nunca redeclarados (convenção
*"acessório de suíte se importa, não se copia"*).

**§5.2** — `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`:
- ⚠️ **`PARES_DO_PAINEL_MASTER`** — metade nomeada **nova**, subtraída no filtro do `CT-318`
  (`:4362-4399`) e na cadeia (`:4540-4563`). **`paresDoMaster()` NÃO é tocado** e
  `ROTAS_PUBLICADAS_ANTES_DA_FATIA` **continua 33** — crescer aquele inventário reprovaria o `CT-318`
  sobre superfície legítima.
- `ROTAS_PUBLICADAS_EM_PRODUCAO` **106 → 109** · `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` **91 → 94** ·
  `PARES_PUBLICOS_DA_SUPERFICIE` **20 → 20** (afirmado, não omitido) ·
  `MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS` **1 → 1**.
- `apps/api/test/validacao.spec.ts`, `IMPORTADORES_ESPERADOS` (CT-343): **17 → 18**.
- `CLAUDE.md` — a linha da superfície vira `109 / 94` **no mesmo diff** (o `CT-1196` lê os três eixos
  por `fs`; a **forma** da frase tem de sobreviver aos moldes de regex).

### T5 · Borda — edição (R4, R6)
Esquemas de entrada **reusados**, não redigitados.
- `CT-1228` — corpo completo altera; resposta é o recurso; chave desconhecida → `422`.
- `CT-1229` — `estado`/`suspensaEm`/`ativo`/`perfil`/`empresaId` no corpo **recusam** e o estado
  gravado não se move (o D7 aplicado à superfície nova).
- `CT-1230` — documento e e-mail repetidos → `422` com corpo inteiro por igualdade, **nada gravado**.
- `CT-1231` — editar entidade suspensa mantém a suspensão (nos dois casos).

**§5.2** — `PARES_DO_PAINEL_MASTER` **3 → 5**; `ROTAS…` **109 → 111**; `MANIPULADORES…` **94 → 96**;
públicas **20**; `CLAUDE.md` no mesmo diff.

### T6 · Borda — exclusão (R5, R7) e `exclusao` na listagem de empresas
`@HttpCode(200)` com corpo, molde do único `@Delete` existente.
- `CT-1232` — empresa vazia é apagada; a prova é a **ausência na listagem seguinte**, não o status.
- `CT-1233` — **o caso central.** Empresa com um contrato: listagem traz `exclusao.permitida: false`
  com `REGISTROS_DE_NEGOCIO`; `DELETE` → `422` com corpo inteiro; e **a empresa continua na listagem,
  ativa**. As três pernas são o par — sem a terceira, um SUT que apagasse e depois falhasse passaria.
- `CT-1234` — o `POST …/suspensao` responde `200` logo depois: a `alternativa` anunciada **existe**.
- `CT-1235` — admin que já tentou entrar → `422` com `TENTATIVA_DE_ENTRADA`; o virgem → `200` e some.
- `CT-1236` — `DELETE` de alvo `USUARIO_EMPRESA` → `422` de perfil, e a pessoa **continua existindo**.
- `CT-1237` — **a corrida.** Listada como `permitida: true`; entre a leitura e o `DELETE` nasce um
  contrato; o `DELETE` responde `422` nomeando `REGISTROS_DE_NEGOCIO` e nada é apagado. Prova que a
  mitigação da objeção da ADR-0014 é real, não retórica.
- `CT-1238` — a listagem com `exclusao` segue sem dado de negócio; `impedimentos` contido em
  `IMPEDIMENTOS_DE_EXCLUSAO`, por igualdade.

**§5.2** — `PARES_DO_PAINEL_MASTER` **5 → 7**; `ROTAS…` **111 → 113**; `MANIPULADORES…` **96 → 98**;
públicas **20**; `CLAUDE.md` no mesmo diff.
- `apps/api/test/ciclo-de-acesso.e2e.spec.ts`, `CT-226`: conjunto fechado de chaves por item **5 → 6**
  (`exclusao`), com `SUT_IS_CORRECT_BECAUSE` declarando que o campo nasce por decisão e que **nenhuma
  chave anterior saiu**. ⚠️ O `CT-221` (criação) **não muda**: `exclusao` é publicado **só na
  listagem**, porque é veredito sobre *agora* e só tem sentido onde o botão vive.

### T7 · ADR, emendas e handoff

**7.1 · `docs/adr/0038-alcance-da-exclusao-logica-e-exclusao-fisica-na-identidade.md`** (`accepted`,
`tags: [data, architecture]`) — a `Decision`: o alcance da ADR-0014 é o cadastro do **domínio**
(`negocio`); `identidade.empresa` e `identidade.usuario` admitem exclusão física, e o critério de
admissibilidade é **a integridade referencial do banco**, nunca contagem na aplicação. A trilha da
ADR-0013 é ela própria um impedimento — esta rota **nunca destrói auditoria**. Declarar por que a
contagem não é alternativa (A1, medido). *Cons* honestos: janela curta; a sonda toma bloqueios que o
`ROLLBACK TO SAVEPOINT` não libera; o Master ganha verbo destrutivo cuja contenção é a FK, não a
autorização.

**7.2 · Emenda na ADR-0014**, texto original preservado byte a byte (molde da emenda de 2026-08-16 da
ADR-0017). Ela existe **porque é a `Decision` que se abre ao citar**, e é só ela que hoje diz *"nunca
é removida fisicamente"* sem qualificar o schema. Sem isso, a próxima sessão lê a 0014 e reprova a
fatia inteira.

**7.3 · `CLAUDE.md`** — o ponto mais delicado:
- os três eixos chegam em **113 / 98 / 20** (já subidos por T4/T5/T6);
- ⚠️ **emenda ao congelamento**, texto original preservado: o `Estado atual` e o item 2 do marco dizem
  hoje que `GET /v1/automacao-de-cobranca/rotinas` é *"a ÚLTIMA rota que este repositório publica"*.
  **A decisão não muda; muda o registro dela.** O congelamento alcança a superfície do
  `@syslocbr/contracts`; `/v1/master/*` está fora por decisão registrada em
  `autorizacao-e-ciclo-de-acesso/v1/tech_spec.md:705`. A emenda declara: **as 7 rotas são do painel do
  operador, e nenhuma rota do app do cliente foi acrescentada, removida ou alterada.** Sem ela a prosa
  mente, e a próxima sessão "corrige" as constantes para baixo;
- contagem da suíte **por pacote**, remedida um a um (`turbo run test` aborta irmãos), com o delta
  atribuído aos CTs que o produziram;
- ADRs **37 → 38 registradas, 30 → 31 `accepted`**, com a 0038 na enumeração e a nota da emenda da
  0014 na linha das ADRs emendadas;
- índice de `DÉBITO COM GATILHO`: as linhas novas, conferindo **as duas pontas** (§3-B);
- ⚠️ **O `D37 · F1/T8` NÃO dispara.** O gatilho é *"a primeira comparação do `:id` do Master com
  identidade da sessão"*, e nenhuma das 7 rotas compara. Escrever isso no relatório, senão o executor
  "resolve" o débito de graça e o `.toLowerCase()` vem junto, mudando comportamento de rota publicada.

**7.4 · `handoff-master-frontend.md`** (594 linhas hoje):
- §4 "As seis rotas" → "As treze rotas", com as 7 novas na mesma forma;
- §5: tela de administradores com as quatro ações de linha, e o diálogo de exclusão com botão
  desabilitado + motivo;
- §6, regras novas: *o botão lê `exclusao.permitida`, nunca uma regra do cliente*; *`impedimentos` é
  vocabulário fechado — traduza por chave, não por texto*; *a listagem traz só `ADMIN_EMPRESA`*;
- §7 "O que NÃO existe": saem as **três** linhas hoje falsas — *"Excluir empresa — não há"*, *"Editar
  nome ou documento de empresa — não há rota"*, *"Listar usuários de uma empresa pelo Master — não
  há"*; deixar nota curta de que saíram;
- §6.9 *"Guarde o `usuarioId` da admissão — é o único alvo possível da reemissão"* deixa de ser
  verdade e sai.

---

## 9. Marcadores a instalar

**`DECISÃO FECHADA`** (protegem — §3 da `nao-regressao.md`):
1. Nos **dois** pontos de escrita de `identidade.usuario.ativo` (`administrador-do-master.ts` e
   `pessoa.ts:214`). `REVERTER EXIGE`: *demonstrar que a função de `pessoa.ts` alcança a pessoa sem
   vínculo e sem contexto de tenant*. É o alvo mais provável de uma R3 — a próxima sessão vai querer
   "unificar", e a fusão devolve uma suspensão silenciosamente inócua.
2. Em `elegibilidadeDeExclusao*`. `REVERTER EXIGE`: *demonstrar que uma contagem sobre `negocio` a
   partir do Master enxerga linha alguma* — é a A1, e é a "simplificação" que virá.

**`DÉBITO COM GATILHO`** (agendam — §3-B):
1. **Dois leitores da mesma linha** — `lerAlvoDeReemissao` (`empresa.ts:392`) e `lerAdministrador`.
   Duas cópias, não três: o Limiar não disparou. `QUANDO FECHA`: o terceiro leitor, ou a primeira task
   autorizada a abrir `reemitirSenha`.
2. **Duas cópias do envelope de recusa por perfil** (`empresa.service.ts:584` e o serviço novo).
   `QUANDO FECHA`: a terceira cópia.

---

## 10. Verificação

**Antes de qualquer edição:** `pnpm test` e registrar a contagem **por pacote** (P1). Ao fim de cada
task, remedir os pacotes tocados um a um — `pnpm --filter @sysloc/<pacote> test` — e comparar caso a
caso (P5). Pacotes em jogo: `db` (T1–T3), `api` (T4–T6), `shared` (T4–T6, pelo `CT-1196`), `auth`
(T2, se o `CT-1212` morar lá).

**Deltas finais para conferência:** `ROTAS_PUBLICADAS_EM_PRODUCAO` 106 → **113** (+7);
`MANIPULADORES_EXAMINADOS_EM_PRODUCAO` 91 → **98** (+7, 1:1 porque nenhum manipulador novo é `@All`);
`PARES_PUBLICOS_DA_SUPERFICIE` **20** (inalterado — as 7 exigem sessão). A contagem final é **refeita
do zero pelas duas medições independentes** do `CT-1095` — enumeração pelo roteador e varredura dos
decoradores —, com a igualdade entre os eixos afirmada **à parte** do valor esperado.

**Ponta a ponta, manual:** admitir empresa → admitir administrador → listar (`usuarioId` aparece) →
reemitir senha pela linha → suspender (sessão cai com `401`) → reativar → editar nome e e-mail →
entrar com a credencial antiga (funciona) → excluir o administrador virgem (`200`) → excluir a empresa
vazia (`200`). E o negativo: empresa com um contrato → `exclusao.permitida: false`, `DELETE` → `422`,
`POST …/suspensao` → `200`.

---

## 11. Arquivos críticos

| Arquivo | Papel |
|---|---|
| `packages/db/src/administrador-do-master.ts` | **novo** — toda a camada de acesso do administrador |
| `packages/db/src/empresa.ts` | edição, exclusão e sonda da empresa |
| `apps/api/src/master/administrador.controller.ts` / `.service.ts` | **novos** — R1–R5 |
| `apps/api/src/master/empresa.controller.ts` / `.service.ts` | R6, R7 |
| `apps/api/src/master/master.module.ts` | registro do controlador novo |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | as três âncoras + `PARES_DO_PAINEL_MASTER` |
| `packages/db/test/unidade-de-trabalho.spec.ts` | `SIMBOLOS_ESPERADOS` (CT-012), 220 → 233 |
| `apps/api/test/ciclo-de-acesso.e2e.spec.ts` | `CT-226`, chaves do item 5 → 6 |
| `CLAUDE.md` | superfície, ADRs, débitos, emenda ao congelamento |
| `docs/adr/0038-*.md` · `docs/adr/0014-*.md` | ADR nova + emenda |
| `docs/plano-backend-novo/handoff-master-frontend.md` | 6 → 13 rotas |
