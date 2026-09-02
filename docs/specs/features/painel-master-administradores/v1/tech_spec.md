# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação

- **Feature**: Painel Master — ciclo de vida de Empresas e Admin Empresa
- **Versão**: v1 · **Variante**: `backend`
- **PRD**: `docs/prds/features/painel-master-administradores/v1/prd.md` (10 US · 20 CA · 16 RN)
- **Tech Alignment**: `docs/specs/features/painel-master-administradores/v1/tech-alignment.md` (D1–D6)
- **Discovery**: `pre-refinement.md` · `plano-de-origem.md`
- **Design Relacionado**: — (backend não tem design)
- **Data**: 2026-09-01 · **Status**: Draft

---

## 2. Resumo Técnico da Solução

Sete operações novas sob `/v1/master`, todas governadas por `@ExigePerfil('SYSLOC_MASTER')` declarado na classe. Duas camadas: um módulo de acesso novo em `@sysloc/db` (`administrador-do-master.ts`) mais extensões em `empresa.ts`; e um controlador/serviço novo em `apps/api/src/master/` mais extensões nos existentes. **Nenhuma migração** — as colunas de estado e as chaves estrangeiras que sustentam o critério de exclusão já existem.

As duas propriedades que dominam o desenho, ambas medidas e ambas de falha **silenciosa**:

1. **Contagem sobre `negocio` a partir do Master devolve zero.** A sessão do Sysloc Master corre com `empresaId: null`; a política de `0001_seguranca.sql` é `FORCE` e casa `empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`. O critério de exclusão é, portanto, a **integridade referencial** (D1-b), nunca uma contagem.
2. **As funções de `pessoa.ts` alcançam pelo vínculo sob RLS.** `definirAtivoDaPessoa` e `encerrarSessoesDaPessoa` devolvem zero/`undefined` para esta persona, sem erro. A suspensão do Master usa caminho próprio, direto em `identidade` (D3-b).

A prévia de elegibilidade executa **a mesma instrução do ato** dentro de `tx.savepoint`, desfeita incondicionalmente (D2-b) — não existe segundo critério que possa divergir do primeiro.

⚠️ **O critério só vale enquanto a integridade referencial for COMPLETA, e isso vira guarda executável.** Medido em 2026-09-01: das 23 tabelas de `negocio`, 16 têm FK direta para `identidade.empresa` e 7 só chegam lá transitivamente, por colunas de ligação que hoje são todas `NOT NULL`. Nada afirmava essa propriedade — o CT-1215 confere **vocabulário**, não **cobertura**. O CT-1242/CT-1243 fecham a lacuna (§19.2).

Decisões herdadas do tech-alignment: D1-b (integridade referencial), D2-b (ensaio do ato), D3-b (caminho próprio), D4-a (dois escritores protegidos), D5-b (vocabulário conferido contra o catálogo), D6-b (partição de superfície nova).

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

Borda (NestJS/Fastify) → serviço → `AcessoAoBanco.emUnidadeDeTrabalho` → funções de acesso de `@sysloc/db`. **Zero SQL em `apps/api/src`** (invariante auditado pelo `CT-012`). O contexto de tenant **não é estabelecido** nestas rotas: a persona não tem empresa, e o alcance é global por perfil.

### 3.2 Componentes / Módulos

| Componente | Papel |
|---|---|
| `AdministradorController` (novo) | R1–R5 — listagem, suspensão, reativação, edição e exclusão de Admin Empresa |
| `AdministradorService` (novo) | orquestra as unidades de trabalho; traduz recusa do banco em recusa de domínio |
| `EmpresaController` / `EmpresaService` (estendidos) | R6–R7 — edição e exclusão de Empresa; `exclusao` na listagem existente |
| `packages/db/src/administrador-do-master.ts` (novo) | acesso à pessoa **direto em `identidade`**, sem passar pelo vínculo |
| `packages/db/src/empresa.ts` (estendido) | edição, exclusão e sonda de elegibilidade da Empresa |

### 3.3 Camadas e Fronteiras

- **Borda**: valida com Zod (`z.strictObject` na entrada — rule `contrato-publicado.md`), publica o envelope da ADR-0017, e **não** decide regra.
- **Serviço**: abre a unidade de trabalho, ordena as chamadas, traduz `ErroDe*` em `ErroDeAplicacao`.
- **Acesso**: SQL. Nenhuma função nova estabelece `app.empresa_id`.
- ⚠️ **Fronteira que o desenho não cruza**: `administrador-do-master.ts` **não importa nem reusa** `pessoa.ts`. O docblock do módulo abre declarando por quê (D3-b).

### 3.4 Visão em Árvore

```
apps/api/src/master/
├── administrador.controller.ts   [criar]
├── administrador.service.ts      [criar]
├── empresa.controller.ts         [modificar]  R6, R7 + esquemas
├── empresa.service.ts            [modificar]  alterar, excluir, exclusao na listagem
└── master.module.ts              [modificar]  registrar o controlador novo
packages/db/src/
├── administrador-do-master.ts    [criar]
├── empresa.ts                    [modificar]
└── index.ts                      [modificar]  barril
apps/api/test/
├── master-administradores.e2e.spec.ts   [criar]
├── cobertura-de-autorizacao.e2e.spec.ts [modificar]  âncoras + partição nova
└── validacao.spec.ts                    [modificar]  IMPORTADORES_ESPERADOS
packages/db/test/
├── administrador-do-master.spec.ts      [criar]
├── catalogo.spec.ts                     [modificar]  vocabulário (D5) + cobertura do critério
└── unidade-de-trabalho.spec.ts          [modificar]  SIMBOLOS_ESPERADOS
packages/shared/test/
└── protocolo-antirregressao.spec.ts     [modificar]  CT-1196 estendido às 4 normativas
CLAUDE.md                                [modificar]  âncoras nas 4 ocorrências normativas + ADRs
```

### 3.5 Arquivos a Criar

| Arquivo | Conteúdo |
|---|---|
| `packages/db/src/administrador-do-master.ts` | 7 funções de acesso + `IMPEDIMENTOS_DE_EXCLUSAO` + tipos |
| `apps/api/src/master/administrador.controller.ts` | R1–R5, esquemas Zod inline, documento OpenAPI |
| `apps/api/src/master/administrador.service.ts` | orquestração das 5 operações |
| `apps/api/test/master-administradores.e2e.spec.ts` | CT-1220 a CT-1239 |
| `packages/db/test/administrador-do-master.spec.ts` | CT-1204 a CT-1214, CT-1217 a CT-1219 |

### 3.6 Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `packages/db/src/empresa.ts` | `alterarEmpresa`, `excluirEmpresa`, `elegibilidadeDeExclusaoDaEmpresa`, `ErroDeDocumentoDeEmpresaEmUso` |
| `packages/db/src/index.ts` | barril — 12 símbolos novos |
| `apps/api/src/master/empresa.controller.ts` | R6, R7, `ESQUEMA_DA_EMPRESA_ALTERADA`, esquemas de saída |
| `apps/api/src/master/empresa.service.ts` | `alterar`, `excluir`, `exclusao` por item na listagem |
| `apps/api/src/master/master.module.ts` | registrar `AdministradorController`/`AdministradorService` |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | 3 âncoras + `paresDoCicloDeVidaDoMaster()` |
| `apps/api/test/validacao.spec.ts` | `IMPORTADORES_ESPERADOS` 17 → 18 |
| `packages/db/test/unidade-de-trabalho.spec.ts` | `SIMBOLOS_ESPERADOS` **216 → 228**. ⚠️ **A linha anterior dizia `220 → 233` e estava errada nas duas pontas** — a base foi **medida** em 2026-09-01 (216 entradas, comparadas por `toEqual` contra as chaves de runtime do barril) e o delta é **12**, o mesmo declarado na linha do `index.ts` logo acima. **Não reponha 220 nem 233.** O conjunto conta só símbolo de runtime: as 7 funções de acesso, `IMPEDIMENTOS_DE_EXCLUSAO`, `alterarEmpresa`, `excluirEmpresa`, `elegibilidadeDeExclusaoDaEmpresa` e `ErroDeDocumentoDeEmpresaEmUso` — **`interface` e `type` não entram**, e publicar um símbolo a mais move o número no mesmo diff |
| `packages/db/test/catalogo.spec.ts` | CT-1215, CT-1216 (vocabulário) + **CT-1242, CT-1243** (cobertura do critério) — `describe` novos, com instância dedicada, no molde já usado por CT-301 e CT-421 |
| `packages/shared/test/protocolo-antirregressao.spec.ts` | **CT-1196 estendido** — pernas novas em caso existente (não move contagem; o `CT-902` confere `describe`, não perna) |
| `CLAUDE.md` | âncoras 113/98/20 nas **4 ocorrências normativas** (L77, L85–90, L372, L619), emenda do congelamento, ADRs 39/32, contagens de suíte |
| `docs/adr/0014-*.md` | emenda: alcance remetido à ADR-0038 |
| `docs/plano-backend-novo/handoff-master-frontend.md` | 6 → 13 rotas; a §7 perde **3 marcadores** ("Excluir empresa", "Editar nome ou documento", "Listar usuários"), e o aviso **"Guarde o `usuarioId` da admissão"**, aninhado no terceiro, cai junto — a CA-03 o refuta. ⚠️ A **§8 também já está falsa**, por razão alheia a esta fatia: ela condiciona o painel ao débito `D23 · F1/T8`, **fechado em 2026-08-26** (`ORIGENS_PUBLICAS` existe e a origem do painel atravessa) |

### 3.7 Arquivos de Referência (somente leitura)

`packages/db/src/pessoa.ts` (o contraste do D3) · `packages/db/src/esquema/identidade.ts` · `packages/auth/src/onboarding.ts` (a conta ancora no `usuarioId`) · `apps/api/src/autenticacao/exigencia.decorator.ts` · `apps/api/src/comum/esquema-publicado.ts` (o derivador de JSON-Schema que 15 dos 22 controladores usam — §4.2) · `apps/api/test/acessorios-de-borda.ts` · `packages/db/test/banco-efemero.ts` · `packages/db/src/imovel.ts:834-861` (molde do reconhecimento de unicidade) · `packages/db/migracoes/0001_seguranca.sql`

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

| Método | Caminho | Exigência | Sucesso |
|---|---|---|---|
| `GET` | `/v1/master/empresas/:id/administradores` | `PERFIL:SYSLOC_MASTER` | `200` |
| `POST` | `/v1/master/usuarios/:id/suspensao` | idem | `200` (`@HttpCode`) |
| `POST` | `/v1/master/usuarios/:id/reativacao` | idem | `200` (`@HttpCode`) |
| `PUT` | `/v1/master/usuarios/:id` | idem | `200` |
| `DELETE` | `/v1/master/usuarios/:id` | idem | `200` (`@HttpCode`, com corpo) |
| `PUT` | `/v1/master/empresas/:id` | idem | `200` |
| `DELETE` | `/v1/master/empresas/:id` | idem | `200` (`@HttpCode`, com corpo) |

⚠️ **`PUT` no item e corpo completo** é a forma canônica do repositório (**5** manipuladores usam `@Put(':id')` e **9** controladores usam alguma forma de `@Put`; `@Patch` = **0**, medido em 2026-09-01). ⚠️ **`DELETE` significa remoção física** nesta base — a única ocorrência atual é o cômodo, cujo docblock declara a exceção da ADR-0014. A ADR-0038 declara a segunda.

### 4.1.1 Exemplo de Payload

```jsonc
// PUT /v1/master/usuarios/:id — corpo COMPLETO, strictObject
{ "nome": "Ana Ribeiro", "email": "ana@imobx.com.br" }
// chave desconhecida (estado, ativo, perfil, empresaId) => 422, nomeando a chave

// GET .../administradores — item
{ "usuarioId": "…", "nome": "Ana Ribeiro", "email": "ana@imobx.com.br",
  "estado": "ATIVO", "criadoEm": "2026-03-12T14:02:11.000Z",
  "exclusao": { "disponivel": false, "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
                "impedimentos": ["TENTATIVA_DE_ENTRADA"], "alternativa": "SUSPENSAO" } }

// POST .../suspensao
{ "usuarioId": "…", "estado": "SUSPENSO", "sessoesEncerradas": 2 }
```

### 4.2 Schemas / DTOs

Zod **inline no controlador**, reusando `ESQUEMA_DO_IDENTIFICADOR`, `ESQUEMA_DA_JANELA`, `ESQUEMA_DA_EMPRESA_NOVA` e `ESQUEMA_DO_ADMINISTRADOR` já existentes. Saídas descritas em JSON-Schema para o documento.

⚠️ **O controlador NOVO nasce conforme à ADR-0016.** `administrador.controller.ts` deriva o JSON-Schema publicado do próprio Zod, por `esquemaPublicado(...)` de `apps/api/src/comum/esquema-publicado.ts` (`z.toJSONSchema`) — como fazem **15 dos 22 controladores** da base, medido em 2026-09-01. **Não escreva `schema:` à mão neste arquivo.**

⚠️ **A divergência remanescente é do arquivo EXISTENTE, e ela não cresce.** `master/empresa.controller.ts` mantém seis descrições à mão (`ESQUEMA_DA_EMPRESA`, `ESQUEMA_DA_PAGINA`, `ESQUEMA_DO_ADMINISTRADOR_ADMITIDO`, `ESQUEMA_DA_SUSPENSAO`, `ESQUEMA_DA_REATIVACAO` e a da senha provisória); R6 e R7 seguem a forma local do arquivo, porque o Protocolo Antirregressão proíbe refatorar fora da causa-raiz e converter as seis reescreveria a descrição de rotas já publicadas sem que CA alguma o peça. **Débito com gatilho** — ver §21.

⚠️ **A justificativa anterior desta linha foi REFUTADA por medição, e não se repõe.** Ela dizia que a `Decision` da 0016 *"ancora em pacote de contratos, que o Master não publica"*, citando `empresa.controller.ts:22-28`. Três coisas: a `Decision` tem uma segunda metade **categórica e sem sujeito qualificado** (*"Nenhuma descrição de contrato é escrita à mão em paralelo ao esquema"*); as linhas 22–28 citadas falam do **congelamento**, não da 0016; e os 15 controladores conformes **também** não publicam pacote — logo publicar-pacote nunca foi o discriminador.

### 4.3 Eventos Publicados / Consumidos

N/A — nenhuma operação desta feature publica ou consome evento. A reativação de **Empresa** (existente) segue enfileirando notícias retidas; a reativação de **Admin Empresa** não.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

1. Guarda decide por perfil, publica sessão com `empresaId: null`.
2. Borda valida `:id` como UUID **antes de qualquer consulta** (§6.1) e o corpo como `strictObject`.
3. Serviço abre `emUnidadeDeTrabalho` (sem contexto de tenant).
4. Acesso executa; recusa do banco vira `ErroDe*` tipado; serviço traduz em `ErroDeAplicacao`.

### 5.2 Fluxos Alternativos

| Situação | Desfecho |
|---|---|
| Alvo não é `ADMIN_EMPRESA` | `422`, `campo:'id'`, `detalhes:{perfilExigido, perfilDoAlvo}` — molde de `reemitirSenha` |
| Empresa/pessoa inexistente | `404 RECURSO_NAO_ENCONTRADO`, sem discriminar causa |
| Documento/e-mail em uso | `422`, `campo:'documento'|'email'`, `detalhes.motivo` |
| Exclusão impedida | `422`, `campo:'id'`, `detalhes:{motivo, impedimentos[], alternativa}` |
| Registro nasce entre a leitura e o ato | recusa nomeando a classe; **nada removido** (o ato é auto-verificado) |

### 5.3 Mapeamento de User Stories → Fluxos

| US | Rota / fluxo |
|---|---|
| US-01 | R1 |
| US-02 | R1 fornece o `usuarioId`; a reemissão existente o consome **sem mudança** |
| US-03, US-04 | R2, R3 |
| US-05, US-06 | R6, R4 |
| US-07 | `exclusao` por item em R1 e na listagem de empresas |
| US-08, US-09 | R5, R7 |
| US-10 | `detalhes.motivo` + `impedimentos` + `alternativa` em toda recusa de exclusão |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

- `:id` como `z.uuid()` **antes de tocar o banco** — malformado é `422`, nunca `404` (evita oráculo de existência).
- Corpo em `z.strictObject`: chave desconhecida recusa nomeando a chave (`unrecognized_keys`).
- `email` normalizado para minúsculas **na borda, num lugar só**.

### 6.2 Transformações de Dados

- `ativo → estado` (`ATIVO`/`SUSPENSO`) em **ponto único** (`paraContratoDoAdministrador`), no molde declarado de `paraContrato`.
- `constraint_name → classe de impedimento` por mapa fechado (§6.3).

### 6.3 Regras de Domínio

| RN | Implementação |
|---|---|
| RN-01 | `perfil = 'ADMIN_EMPRESA'` **na consulta**, nunca filtro de borda |
| RN-03/RN-05 | marcação + `encerrarSessoesDoAdministrador` na mesma transação; encerramento roda **sempre** |
| RN-06 | leitura do alvo antes do ato + `AND perfil = 'ADMIN_EMPRESA'` na escrita (dupla barreira) |
| RN-08 | `UPDATE` puro — a conta local ancora no `usuarioId` |
| RN-10/RN-11 | integridade referencial; nenhuma contagem |
| RN-12 | `DELETE usuario WHERE empresa_id` + `DELETE empresa`, mesma transação |
| RN-13 | prévia = ato dentro de `tx.savepoint`, desfeito |
| RN-15 | `IMPEDIMENTOS_DE_EXCLUSAO` fechado e chaveado por **`constraint_name`** — é o que o erro `23503` entrega no campo `constraint`, sem consulta extra. São **25** restrições `ON DELETE no action`, medidas em 2026-09-01: **8** apontando para `identidade.usuario` e **17** para `identidade.empresa`. ⚠️ **A `negocio.acesso_usuario_app` carrega DUAS** (`acesso_usuario_app_usuario_id_usuario_id_fk`, simples, e `acesso_usuario_app_usuario_empresa_fkey`, composta), e o PostgreSQL **não garante qual dispara primeiro** — as duas recebem a mesma classe, e classificar só uma faria metade das recusas degradar para erro genérico. `detail` do driver **nunca** sai |
| RN-16 | a trilha é impedimento — a operação jamais a apaga |

---

## 7. Persistência de Dados

### 7.1 Banco Principal
PostgreSQL 18, `postgres.js` via `AcessoAoBanco`. Schemas `identidade` (sem RLS, ADR-0009) e `negocio` (RLS `FORCE`).

### 7.2 Tabelas
Leitura/escrita: `identidade.empresa`, `identidade.usuario`, `identidade.sessao`. Leitura de catálogo: `pg_constraint`. **Nenhuma tabela nova, nenhuma coluna nova.**

### 7.3 Migrações
**Nenhuma.** O critério de D1 é imposto pelas chaves estrangeiras já existentes; `ON DELETE cascade` de `conta`/`dois_fatores`/`sessao` também.

### 7.4 Transação e Consistência
Uma unidade por operação. A exclusão de Empresa é **um commit** para as duas instruções (RN-12). A sonda usa `tx.savepoint` e **sempre** retorna ao ponto anterior.
⚠️ `ROLLBACK TO SAVEPOINT` **não libera bloqueios** — a sonda retém `FOR KEY SHARE` até o fim da transação de leitura. Declarado no docblock, com o teto de página (`MAIOR_PAGINA_DE_EMPRESAS = 200`).

### 7.5 Retenção
N/A. A exclusão física é a única eliminação, e é ato do operador.

---

## 8. Integração com APIs Externas
N/A — nenhuma integração externa é alcançada.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas
N/A para as 7 operações novas.

### 9.2 Idempotência
Suspensão e reativação são idempotentes **sem ramo condicional**: a coluna é booleana e o `UPDATE` devolve a linha. Exclusão não é idempotente — a segunda chamada é `404`, que é o correto.

### 9.3 Outbox / Saga
N/A.

---

## 10. Gerenciamento de Erros

### 10.1 Erro de Negócio → HTTP

| Código | HTTP | Quando |
|---|---|---|
| `NAO_AUTENTICADO` | 401 | sem sessão |
| `ACESSO_NEGADO` | 403 | perfil diferente de `SYSLOC_MASTER` |
| `RECURSO_NAO_ENCONTRADO` | 404 | empresa/pessoa inexistente |
| `CAMPO_INVALIDO` | 422 | forma, perfil do alvo, unicidade, exclusão impedida |

**Nenhum código novo no enum** — decisão registrada no PRD §9.

### 10.2 Resiliência
Falha do banco sobe como `ERRO_INTERNO`; a sonda que falhar por causa não reconhecida **não** vira "elegível" (fail-closed).

### 10.3 Logging de Erros
Recusa de exclusão loga classe e alvo, **nunca** a mensagem crua do driver (carrega valores de chave).

---

## 11. Segurança

### 11.1 Autenticação
Sessão better-auth por cookie; barreira de admissão no login. Sessão restrita (senha provisória pendente) **não alcança** rota alguma do Master.

### 11.2 Autorização
`@ExigePerfil('SYSLOC_MASTER')` na classe, dimensão de **perfil** (ADR-0011 rejeita inflar o catálogo com chaves sintéticas). ADR-0018: a cobertura confere **conteúdo**, não só existência — daí o CT-1241.

### 11.3 Criptografia
N/A — nenhum segredo novo. A senha provisória segue pelo caminho existente.

### 11.4 Sanitização e Validação
`strictObject` na entrada; UUID validado antes da consulta; `detail` do driver retido.

### 11.5 Rate Limiting
Herdado. Nenhum teto novo.

### 11.6 Secrets
N/A.

---

## 12. Performance

### 12.1 Metas
Listagem de administradores sob o teto de página em tempo comparável à listagem de empresas.

### 12.2 Estratégias
Índice `usuario_empresa_id_idx` já existe e serve à RN-01. Contagem e página na mesma transação.

### 12.3 Limites Conhecidos
⚠️ A sonda por item escala com a página e retém bloqueios (§7.4). **Medir uma vez** a latência no teto e registrar no `_run/run-report.md` — o ponto em aberto 4 do tech-alignment depende desse número. **Não** virar asserção (carga está fora da stack).

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados
Pino. Toda operação loga `{ usuarioId | empresaId, emitidaPor }` — autoria, no molde de `admitirAdministrador`/`reemitirSenha`. **Nunca** senha, nunca `detail` do driver.

### 13.2 Métricas / 13.3 Tracing / 13.4 Alertas
N/A — o projeto não tem OpenTelemetry instalado (a stack medida do `CLAUDE.md` o exclui).

---

## 14. Feature Flags
N/A — não há solução de feature flag no projeto, e a feature não a pede.

---

## 15. Versionamento de API
Prefixo `/v1` herdado. **Compatibilidade**: acrescentar é permitido; renomear e remover, não. ⚠️ Estas 7 operações estão **fora** do congelamento por decisão registrada — **ADR-0039**.

---

## 16. Deploy e Infraestrutura
Sem mudança. Nenhuma variável de ambiente nova, nenhuma unidade systemd nova, nenhum passo de instalação novo. O `dist/` é reconstruído pelo pipeline existente.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| US | Componentes | Acesso |
|---|---|---|
| US-01 | `AdministradorController.listar` | `listarAdministradoresDaEmpresa` |
| US-02 | — (rota existente) | — |
| US-03 | `.suspender` | `definirAtivoDoAdministrador` + `encerrarSessoesDoAdministrador` |
| US-04 | `.reativar` | `definirAtivoDoAdministrador` |
| US-05 | `EmpresaController.alterar` | `alterarEmpresa` |
| US-06 | `.alterarAdministrador` | `alterarAdministrador` |
| US-07 | ambas as listagens | `elegibilidadeDeExclusao*` |
| US-08 | `.excluirAdministrador` | `excluirAdministrador` |
| US-09 | `EmpresaController.excluir` | `excluirEmpresa` |
| US-10 | tradução da recusa | `IMPEDIMENTOS_DE_EXCLUSAO` |

---

## 18. Dependências Externas
Nenhuma dependência nova. Tudo dentro de `@sysloc/db`, `@sysloc/shared` e NestJS/Zod já instalados.

---

## 19. Estratégia de Testes

> Gerada por `agent-spec-qa-test-generator` (frente `backend`) e validada pelo arquiteto. JSON lossless em `_run/test-cases.json`. **40 casos, CT-1204 a CT-1243.** Stack: Vitest 4.1.10 · `embedded-postgres` (Postgres real, efêmero) · HTTP real em porta dinâmica. **Nenhum caso usa dublê** — os 38 atravessam `db` ou `http`.
>
> ⚠️ **Toda execução roda pelo script do pacote** (`pnpm --filter @sysloc/db test`, `pnpm --filter @sysloc/api test`). `vitest run` avulso é **inválido** aqui: `apps/api/test/` carrega `@sysloc/db` e `@sysloc/auth` pela fronteira do pacote e leria o `dist/` anterior — o modo de falha é silencioso e **inverte a conclusão**.

### Rastreabilidade: Critérios de Aceite → Testes

| CA | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | lista só os `ADMIN_EMPRESA` da empresa | CT-1217, CT-1220 |
| CA-02 | item traz as chaves do contrato, sem dado de negócio | CT-1220 |
| CA-03 | reemissão pela linha, sem identificador anotado | CT-1221 |
| CA-04 | suspender encerra 2 sessões e informa 2 | CT-1206, CT-1207, CT-1222 |
| CA-05 | a colega ativa segue operando | CT-1223 |
| CA-06 | suspender já suspenso → 0, sem erro | CT-1224 |
| CA-07 | reativar devolve entrada, não sessões | CT-1225 |
| CA-08 | alvo `USUARIO_EMPRESA` recusado, pessoa inalterada | CT-1226 |
| CA-09 | editar suspensa mantém suspensa | CT-1227, CT-1230 |
| CA-10 | corrigido o e-mail, entra com a senha já recebida | CT-1228 |
| CA-11 | documento/e-mail duplicado recusa sem gravar | CT-1218, CT-1219, CT-1229 |
| CA-12 | `exclusao` indisponível com classe e alternativa | CT-1208, CT-1231 |
| CA-13 | `DELETE` recusa; empresa continua ativa | CT-1204, CT-1232 |
| CA-14 | a alternativa anunciada é aceita | CT-1233 |
| CA-15 | empresa vazia + admin virgem: ambos somem | CT-1205, CT-1209, CT-1214, CT-1234 |
| CA-16 | 1 admin inelegível → nada removido | CT-1213, CT-1235 |
| CA-17 | admin que já tentou entrar → `TENTATIVA_DE_ENTRADA` | CT-1210, CT-1212, CT-1236 |
| CA-18 | admin virgem é excluído e some | CT-1211, CT-1237 |
| CA-19 | registro nasce entre consulta e ação → recusa | CT-1204, CT-1208, CT-1238 |
| CA-20 | recusa não nomeia entidade nem quantidade | CT-1215, CT-1216, CT-1239 |

**20/20 CAs cobertos.** Nenhum CT referencia CA inexistente. CT-1240, CT-1241, **CT-1242 e CT-1243** não mapeiam CA — são âncora de superfície, cobertura de autorização e a guarda de cobertura do critério de exclusão: invariantes do repositório, não critérios desta feature.

### 19.1 Testes Unitários

**N/A — justificado.** Nenhuma decisão desta feature é pura: cada uma depende de comportamento do armazenamento (política de isolamento, integridade referencial, `savepoint`, unicidade). Um teste unitário aqui exigiria dublar o banco, e é exatamente o que a armadilha A1 torna enganoso — um dublê responde o que lhe mandarem responder, inclusive a contagem que na realidade vem zero. O `owning_layer` correto é `service-integration`.

### 19.2 Testes de Integração

**Arquivo novo `packages/db/test/administrador-do-master.spec.ts`** (exceto CT-1215/CT-1216, que vão para `catalogo.spec.ts`).
Setup: instância efêmera migrada; unidade de trabalho aberta com `{ empresaId: null }` — o contexto real do Master. **Importar** `banco-efemero.ts`, nunca redeclarar.

| CT | Teste | CA | Objetivo (invariante) | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|
| CT-1204 | armadilha A1 — sonda recusa, contagem devolve zero | CA-13, CA-19 | sob contexto vazio, a sonda de empresa **cheia** recusa por `23503` **e** a contagem ingênua na mesma unidade devolve `0` | contagem `=== 0` **e** `{elegivel:false, impedimentos:['REGISTROS_DE_NEGOCIO']}` | imite `isolamento.spec.ts` (CT-005): `emUnidadeDeTrabalho` com `{empresaId:null}` |
| CT-1205 | empresa vazia é elegível, com a mesma contagem zero | CA-15 | os dois zeros com desfechos opostos discriminam | `{elegivel:true, impedimentos:[]}` por igualdade de array | idem |
| CT-1206 | armadilha A2 — encerramento: 2 contra 0 | CA-04 | a função nova devolve `2`; `encerrarSessoesDaPessoa` devolve `0` sobre a mesma pessoa | os **quatro** números afirmados um a um | vínculo semeado **sob** o contexto de A; medição sob `{empresaId:null}` |
| CT-1207 | armadilha A2 — marcação: `false` contra `undefined` | CA-04 | a nova grava `ativo=false`; `definirAtivoDaPessoa` devolve `undefined` | duas leituras **cruas** da coluna são a prova, não o retorno | idem |
| CT-1208 | a prévia não deixa efeito, nem após o commit | CA-12, CA-19 | contagens idênticas antes/depois, medidas em unidades **separadas** | igualdade com os valores capturados, nunca `> 0` | imite `unidade-de-trabalho.spec.ts` |
| CT-1209 | a sonda que **aceita** também não remove | CA-15 | só o ato remove | empresa `1` após a sonda; `0` após o ato | idem |
| CT-1210 | as **8 restrições** de impedimento sobre `identidade.usuario`, uma a uma (`it.each`) | CA-17 | cada restrição sozinha torna inelegível, com a classe exata | igualdade de array por linha, nunca `toContain` | arranjo **sob** o contexto da empresa; medição sob contexto vazio. ⚠️ **São 8 restrições em 7 tabelas** — a `acesso_usuario_app` entra **duas vezes**, e é esse par que discrimina um mapa chaveado por tabela de um chaveado por `constraint_name` (RN-15). Não o colapse em 7 |
| CT-1211 | admin virgem removido; cascata em conta/2FA/sessão | CA-18 | `usuario` perde 1 linha; as 3 dependentes somem sem apagá-las | o **colega** permanece — é o controle contra `DELETE` sem cláusula | INSERT direto nas tabelas de `identidade` |
| CT-1212 | a recusa **nunca** destrói a trilha | CA-17 | contagem e `id` da linha de trilha preservados | `id` literalmente igual ao capturado | INSERT em `tentativa_login` com enum real |
| CT-1213 | 2 admins, 1 inelegível → recusa atômica | CA-16 | nem o admin **elegível** é removido | `usuario WHERE empresa_id` continua `2` | unidade que **comita**; medição em unidade nova |
| CT-1214 | empresa vazia + admin virgem: ambos somem | CA-15 | um único commit; nenhuma outra empresa tocada | empresa de **controle** intacta | idem |
| CT-1215 | vocabulário **igual** ao catálogo de dependências | CA-20 | conjunto das **25** FKs `no action` sobre `identidade.usuario` e `identidade.empresa` == conjunto classificado, **por `constraint_name`** | controle antivácuo **antes**; `{excedentes:[], ausentes:[]}` | — |
| CT-1216 | dependência nova é acusada **por nome** | CA-20 | FK nova sem classe aparece em `excedentes`; some após o `DROP` | `['dependencia_descartavel_empresa_fk']` | `conexaoDeMigracao(banco)`; `DROP` no mesmo caso |
| CT-1217 | listagem alcança só os `ADMIN_EMPRESA` de A | CA-01 | conjunto exato — sem o `USUARIO_EMPRESA` e sem o admin de B | diferença de conjunto vazia; `total` numérico | `emUnidadeDeTrabalho` com `{empresaId:null}` |
| CT-1218 | e-mail em uso recusa e **nada** é gravado | CA-11 | recusa atribuída a `email`; o `nome` novo **não** é gravado | releitura bit a bit igual | — |
| CT-1219 | documento em uso recusa; nenhuma das duas muda | CA-11 | restrição **nomeada**, no molde de `admitirEmpresa` | as duas linhas idênticas campo a campo | — |
| **CT-1242** | **cobertura do critério** — toda tabela de `negocio` tem caminho bloqueante até `identidade.empresa` | — | o critério do D1-b só vale se **nenhuma** tabela puder guardar linha de uma empresa sem barrar a exclusão dela. Medido em 2026-09-01: das **23** tabelas de `negocio`, **16** têm FK direta e **7** (`imovel`, `comodo`, `contrato`, `contrato_fiador`, `cobranca`, `acesso_usuario_permissao`, `item_da_emissao_em_lote`) só chegam lá **transitivamente** — e a corrente só barra porque **toda coluna de ligação é `NOT NULL`**. Uma tabela futura com `empresa_id` e ligação anulável tornaria excluível uma empresa cheia, deixando órfãos que a RLS torna invisíveis | `examinadas` igual às 23 por igualdade de array (controle antivácuo); `excecoes` igual a `[]` | `describe` novo em `catalogo.spec.ts`, instância dedicada — molde do CT-301/CT-421 |
| **CT-1243** | a guarda do CT-1242 **pode falhar** | — | prova de falsificação: sem ela, `excecoes: []` sobre qualquer schema passaria por vacuidade | criada `negocio.<tabela avulsa>` com `empresa_id` e **sem** caminho até a empresa, `excecoes` nomeia exatamente aquela tabela com `SEM_CAMINHO_ATE_EMPRESA`; após o `DROP`, volta a `[]` | `conexaoDeMigracao(banco)` em instância **dedicada**; `CREATE`/`DROP` no mesmo caso |

### 19.3 Testes End-to-End

**Arquivo novo `apps/api/test/master-administradores.e2e.spec.ts`.** Framework: Vitest sobre HTTP real em porta dinâmica.
⚠️ **Acessórios são importados de `apps/api/test/acessorios-de-borda.ts`, nunca copiados.** `entrarComSegundoFatorCumprido` já tem **seis** cópias no diretório e o `DÉBITO COM GATILHO — D32 · F5/T7` declara o Limiar de Três disparado: esta suíte é a sétima e **fecha o débito** subindo o acessório para a casa compartilhada.

- **CT-1220** (CA-01, CA-02) — envelope e chaves fechadas, sem dado de negócio. Objetivo: as chaves do envelope e de cada item batem por **igualdade de conjunto**, e a serialização não contém o contrato, o vínculo nem a chave de permissão semeados. Validação: varredura da saída **com controle positivo** (agulhas plantadas acusadas por igualdade) — método da ADR-0032.
- **CT-1221** (CA-03) — reemissão a partir da linha. Objetivo: o `usuarioId` **vem da listagem**; o da admissão é deliberadamente descartado. Validação: reemissão `200`, entrada com a senha nova `200`, senha anterior recusada de forma indistinguível.
- **CT-1222** (CA-04) — suspensão encerra no ato. Objetivo: corpo `{usuarioId, estado:'SUSPENSO', sessoesEncerradas:2}`; contagem crua de 2 a 0; os dois cookies em `401`. Validação: **a contagem** distingue *encerrada* de *marcada*.
- **CT-1223** (CA-05) — a colega sobrevive. Objetivo: reprova um encerramento por **empresa** em vez de por pessoa. Validação: `2xx` e contagem dela inalterada.
- **CT-1224** (CA-06) — idempotência. Objetivo: `200` com `sessoesEncerradas: 0`, corpo diferindo **apenas** nesse campo. Validação: nunca `409`, nunca `422`.
- **CT-1225** (CA-07) — reativar não devolve sessão. Objetivo: contagem **continua** `0`; cookies antigos seguem em `401`. Validação: só a entrada nova restabelece.
- **CT-1226** (CA-08) — alvo de outro perfil nas **5** rotas (`it.each`). Objetivo: envelope inteiro por igualdade; a pessoa **e a sessão dela** intactas. Validação: a sessão continuar servindo reprova uma recusa que já encerrou sessões antes de recusar.
- **CT-1227** (CA-09) — editar suspensa. Objetivo: `suspensa_em` relido é **o mesmo instante**. Validação: igualdade de instante, não de nulidade.
- **CT-1228** (CA-10) — e-mail corrigido, senha antiga vale. Objetivo: a credencial ancora no `usuarioId`. Validação: entrada real com o e-mail novo `200`; com o antigo, recusa indistinguível.
- **CT-1229** (CA-11) — documento duplicado na borda. Objetivo: `campo:'documento'` no envelope. Validação: as duas empresas idênticas campo a campo.
- **CT-1230** (CA-09) — chaves proibidas no corpo (`it.each`, 6 combinações). Objetivo: `strictObject` recusa nomeando a chave. Validação: um `z.object` responderia `200` ignorando — é isso que o caso reprova.
- **CT-1231** (CA-12) — `exclusao` no par cheia/vazia. Objetivo: `{disponivel:false, motivo, impedimentos, alternativa}` contra `{disponivel:true, impedimentos:[]}`. Validação: o par é obrigatório — uma prévia sempre-`false` passaria com metade.
- **CT-1232** (CA-13) — `DELETE` recusado; empresa ativa. Objetivo: a recusa vem da integridade referencial traduzida. Validação: envelope inteiro; contagens cruas inalteradas.
- **CT-1233** (CA-14) — a alternativa é executável. Objetivo: a rota seguinte é escolhida a partir do valor **lido do corpo**, não escrito no teste. Validação: suspensão `200`.
- **CT-1234** (CA-15) — empresa vazia removida. Objetivo: diferença de conjunto `{excedentes:[], ausentes:['<A>']}`. Validação: a empresa de **controle** permanece.
- **CT-1235** (CA-16) — 1 admin já entrou → recusa. Objetivo: `ADMINISTRADORES_NAO_ELEGIVEIS`; os **dois** admins sobrevivem. Validação: trilha produzida por entrada **real**, mesmo malsucedida.
- **CT-1236** (CA-17) — admin com trilha. Objetivo: classe `TENTATIVA_DE_ENTRADA`, **não** `REGISTROS_DE_NEGOCIO` nem genérica. Validação: é o caso que o D5-c perde.
- **CT-1237** (CA-18) — admin virgem removido. Objetivo: o colega permanece. Validação: igualdade de conjunto pega as **duas** direções.
- **CT-1240** — âncora de superfície. Objetivo: `113` / `98` / `20` pelos **dois eixos independentes**, com a igualdade entre eles afirmada **à parte** do valor esperado; `paresDoMaster()` **intocado**. Validação: controle antivácuo antes; `{excedentes:[], ausentes:[]}`.

### 19.4 Cenários de Erro e Segurança

| Cenário | CT | CA | Objetivo | Trigger | Esperado |
|---|---|---|---|---|---|
| Corrida entre a leitura e o ato | CT-1238 | CA-19 | o ato é **auto-verificado**; o pior caso é recusa que nomeia o motivo | contrato criado pela imobiliária **entre** a listagem e o `DELETE` | `422` com `REGISTROS_DE_NEGOCIO`; nada removido |
| Vazamento na recusa | CT-1239 | CA-20 | nenhuma das 4 recusas nomeia entidade ou quantidade | os 4 corpos **reais** varridos | achados `[]` nos 4; **controle positivo** acusa todas as agulhas |
| Escalada por perfil | CT-1241 | — | as 7 rotas exigem `SYSLOC_MASTER`; a recusa não deixa efeito | sessão de `ADMIN_EMPRESA` e requisição sem sessão | `403` nomeando `PERFIL:SYSLOC_MASTER`; `401` sem sessão; 3 contagens de estado inalteradas |

### Cenários não cobertos (declarados)

Corrida real com conexões concorrentes (mediria o SGBD, não o produto) · custo/retenção de bloqueios da prévia (carga está fora da stack — vira medição registrada no run-report) · filtro por estado e exclusão de empresa suspensa (pontos em aberto 5 e 6 do tech-alignment — **produto não decidido**) · autoria da edição no diário (ponto 7) · rotas sob sessão restrita (invariante transversal já coberto por `sessao-restrita.spec.ts`; repetir seria AP-26).

---

## 20. Riscos Técnicos

| Risco | Severidade | Mitigação |
|---|---|---|
| Implementar a elegibilidade por **contagem** | **Crítico** — habilitaria apagar empresa cheia | CT-1204 com o par contagem/sonda; marcador `DECISÃO FECHADA` no critério |
| "Unificar" a suspensão com `pessoa.ts` | **Alto** — devolve suspensão silenciosamente inócua | CT-1206 e CT-1207; marcador `DECISÃO FECHADA` nos dois pontos de escrita |
| Esquecer o `savepoint` na prévia | **Alto** — a prévia removeria a empresa elegível | CT-1209 (o caminho em que o `DELETE` teria sucesso) |
| Crescer `paresDoMaster()` | **Médio** — reprova o `CT-318` sobre superfície legítima | CT-1240; partição nomeada nova (D6-b) |
| Esquecer a emenda do `CLAUDE.md` | **Médio** — `CT-1196` fica vermelho e o P5 lê como regressão | as duas emendas são entrega declarada (§21) |
| Dependência nova sem classe de impedimento | **Médio** — recusa degrada para erro genérico | CT-1215 + CT-1216 |
| `detail` do driver escapar na resposta | **Alto** — carrega valores de chave | CT-1239 com controle positivo |
| Tabela futura em `negocio` **sem caminho bloqueante** até `identidade.empresa` | **Crítico** — empresa cheia vira excluível, deixando órfãos que a RLS torna invisíveis | CT-1242 + CT-1243 (guarda de cobertura com prova de falsificação) |
| Classificar **uma só** das duas restrições da `acesso_usuario_app` | **Médio** — metade das recusas de exclusão de admin degrada para erro genérico, contra a RN-15 | CT-1210 com as **8** restrições em `it.each`; CT-1215 por `constraint_name` |
| Propagar a divergência da ADR-0016 ao controlador **novo** | **Médio** — a violação deixa de ser pré-existente e passa a ser introduzida por esta fatia | §4.2: `administrador.controller.ts` usa `esquemaPublicado(...)`, como 15 dos 22 |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

| ADR | Classe | Conformidade literal |
|---|---|---|
| **0008** | APLICÁVEL | *"sua origem nunca é o request"* — §6.3 e D1: nenhuma operação fixa `app.empresa_id` a partir do `:id` do caminho. É o que elimina a contagem prévia |
| **0009** | APLICÁVEL | as tabelas tocadas são de `identidade`, *"sem noção de tenant"*; nenhuma tabela nova em `negocio`, logo a cobertura de RLS forçada segue intacta |
| **0011** | APLICÁVEL | *"toda rota declara o que exige em duas dimensões"* — `@ExigePerfil('SYSLOC_MASTER')` na classe; o catálogo **não** é inflado com chave sintética |
| **0013** | APLICÁVEL | a trilha é a mitigação declarada — RN-16 e CT-1212 garantem que a exclusão **nunca** a destrói |
| **0014** | APLICÁVEL | alcance declarado pela **ADR-0038**; emenda na 0014 é entrega desta feature |
| **0016** | APLICÁVEL **no código novo**; divergência pré-existente **contida** | *"Nenhuma descrição de contrato é escrita à mão em paralelo ao esquema"* — a segunda metade da `Decision` é **categórica e sem sujeito qualificado**, e é ela que decide. O controlador **novo** deriva o JSON-Schema do Zod por `esquemaPublicado(...)`, como **15 dos 22** controladores (medido 2026-09-01). O `empresa.controller.ts` **existente** conserva seis descrições à mão; esta fatia **não as amplia** e **não as converte** — vira débito com gatilho. ⚠️ A leitura anterior (*"a `Decision` ancora em pacote de contratos, que o Master não publica"*) foi **refutada por medição** e não se repõe: os 15 conformes também não publicam pacote |
| **0017** | APLICÁVEL | *"o erro é status HTTP semântico mais `{codigo, mensagem, campo?, detalhes?}`, com `codigo` de enum fechado"* — §10.1, sem código novo. Chave exposta é **UUID** (não há série declarada para pessoa nem empresa) |
| **0018** | APLICÁVEL | *"a cobertura confere também o conteúdo"* — CT-1241 afirma **o que** cada rota exige, não só que exige |
| **0021** | APLICÁVEL | metade categórica — *"rota própria, nunca campo gravado por atualização parcial"*: `estado`/`ativo` não existem nos esquemas de entrada, e o `strictObject` os recusa (CT-1230). A governança é por **perfil**, precedente das 6 rotas irmãs |
| **0024** | PARCIAL | a emenda de 2026-08-13 admite função privilegiada **sem parâmetro de empresa** — a alternativa D1-c precisaria de um, e por isso foi rejeitada |
| **0026** | APLICÁVEL | *"toda leitura de tempo que decide comportamento vem do banco"* — `suspensa_em` de `coalesce(…, now())`; `criadoEm` é dado exibido, não decisão |
| **0030** | APLICÁVEL | *"artefato derivado é composto no instante do pedido e nunca armazenado"* — a elegibilidade é derivada sob demanda e **não tem caminho de escrita** (D2-b) |
| **0031** | PARCIAL | `plataforma.notificacao_bancaria` não tem `empresa_id` e **não é alcançada** pela exclusão — corretamente: uma notícia retida só existe se houve cobrança, que já impede |
| **0038** | APLICÁVEL | a decisão central de D1/D2 |
| **0039** | APLICÁVEL | as 7 rotas estão **fora** do congelamento; nenhuma rota do app do cliente é tocada |
| **0006** | APLICÁVEL | a suíte usa instância efêmera própria; nenhum caso toca o ambiente que opera |

**N/A**: 0001, 0005, 0010, 0020, 0022, 0023, 0025, 0027, 0028, 0029, 0032, 0033, 0034, 0035, 0036, 0037.

### Candidatos a ADR

**Nenhum novo.** As duas decisões transversais desta feature **já foram registradas**: ADR-0038 (alcance da exclusão) e ADR-0039 (alcance do congelamento). As demais (D3, D4, D5) são feature-scoped — consequências do alcance desta persona, não padrões do projeto (0-1 de 5 critérios).

**Candidato a ADR parcial** (challenge de 2026-09-01) — *"a completude da integridade referencial que sustenta um critério de exclusão é guarda executável, não propriedade presumida"* (CT-1242/CT-1243). Bate **C1** (transversal: alcança as 23 tabelas de `negocio` e toda fatia que criar a 24ª) e **C2** (tag `data`). **Falha C3** — o custo de reverter é apagar um caso de teste —, **C4** e **C5**: não há alternativa concorrente real, e a guarda é aplicação direta do P4 do Protocolo Antirregressão, não decisão nova. **2 de 5 — não vira ADR.**

### Glossário da feature

Criado nesta sessão: `docs/specs/features/painel-master-administradores/domain-glossary.md` — **Impedimento de exclusão** (a unidade é a **restrição**, não a tabela), **Caminho bloqueante**, **Prévia de elegibilidade** e **Superfície do operador do SaaS**, mais as duas ambiguidades resolvidas (*origem* × *restrição*; *exclusão* lógica × física). O vocabulário de negócio permanece no glossário global, sem duplicação.

### Entregas de documento obrigatórias

1. **Emenda ao `CLAUDE.md` — âncoras, nas QUATRO ocorrências normativas**: `106 → 113`, `91 → 98`, `20` inalterado, **no mesmo diff** da constante. ⚠️ **Não é um lugar só.** Medido em 2026-09-01, os números e a afirmação do congelamento aparecem em **cinco** pontos do arquivo, e a classificação é entrega desta fatia:

   | Linha | O que diz | Classe |
   |---|---|---|
   | **L77** | prosa da F5 — *"nenhuma fase restante acrescenta, remove ou altera rota"* | **normativa** — sobe e ganha a qualificação da ADR-0039 |
   | **L85–90** | bullet **Superfície** — os três números; a única que o `CT-1196` lê hoje | **normativa** — 113 / 98 / 20 |
   | **L372** | marco de entrega, item 2 — *"Nenhuma fatia posterior acrescenta, remove ou altera rota"* | **normativa** — sobe e ganha a qualificação |
   | **L619** | bloco de débitos — *"as 8 rotas `GET /docs*` das **106**"* | **normativa** — sobe para 113 |
   | **L405** | auditoria de drift do handoff, datada de **2026-08-24** | **histórica** — **não se reescreve**; ganha só a marca de que é medição daquela data |

2. **Extensão do `CT-1196`** (`packages/shared/test/protocolo-antirregressao.spec.ts`): ele passa a afirmar a igualdade eixo a eixo nas **quatro normativas**, com controle antivácuo (zero ocorrências reprova), e não apenas no bullet Superfície. ⚠️ **Fecha a classe, não a ocorrência**: hoje ele guarda um lugar e deixa três divergirem em silêncio — que é exatamente o defeito que ele nasceu para pegar. ⚠️ **Entra como pernas novas em caso existente**, e por isso **não move contagem** — alterar `describe` do arquivo é o que o `CT-902` protege.
3. **Emenda ao `CLAUDE.md` — congelamento**: as ocorrências normativas afirmam o congelamento **sem qualificar o público**. Texto original preservado; a emenda remete à ADR-0039.
4. **Emenda à ADR-0014**: uma linha remetendo o alcance à ADR-0038, com o texto original preservado byte a byte.
5. **`CLAUDE.md` — ADRs**: 37/30 → **39/32**.
6. **`handoff-master-frontend.md`**: 6 → 13 rotas; a §7 perde os **três** marcadores hoje falsos, e com o terceiro cai o aviso **"Guarde o `usuarioId` da admissão"**, que a CA-03 refuta. ⚠️ **A §8 também está falsa**, por razão alheia a esta fatia: ela condiciona o painel ao débito `D23 · F1/T8`, fechado em **2026-08-26**. Corrigi-la é entrega desta fatia porque o arquivo já é tocado; **não** é alargamento de escopo para outros documentos.

### Débitos a registrar

- **Seis descrições de contrato à mão em `master/empresa.controller.ts`**, contra a metade categórica da ADR-0016 — `ESQUEMA_DA_EMPRESA`, `ESQUEMA_DA_PAGINA`, `ESQUEMA_DO_ADMINISTRADOR_ADMITIDO`, `ESQUEMA_DA_SUSPENSAO`, `ESQUEMA_DA_REATIVACAO` e a da senha provisória. ⚠️ **O débito NÃO alcança o controlador novo**, que nasce conforme (§4.2). Gatilho: a primeira task autorizada a abrir `master/empresa.controller.ts` para reformar a publicação do contrato — a conversão é para `esquemaPublicado(...)`, que já existe e é usado por 15 dos 22 controladores.
- **Dois leitores da mesma linha** — `lerAlvoDeReemissao` e `lerAdministrador`. Duas cópias; o Limiar de Três **não** disparou.
- **Duas cópias do envelope de recusa por perfil**. Gatilho: a terceira.

### Marcadores `DECISÃO FECHADA` (nascem com a implementação)

1. Nos **dois** pontos de escrita do fato de acesso. `REVERTER EXIGE`: demonstrar que a função de `pessoa.ts` alcança a pessoa sem vínculo e sem contexto. Rede: CT-1206, CT-1207.
2. No critério de elegibilidade. `REVERTER EXIGE`: demonstrar que uma contagem sobre `negocio` a partir do Master enxerga linha alguma. Rede: CT-1204.

### Débito que esta feature FECHA

`D32 · F5/T7` — `entrarComSegundoFatorCumprido` sobe para `acessorios-de-borda.ts`. A suíte nova seria a **sétima** cópia; o Limiar de Três já estava disparado e declarado.

### O que NÃO dispara

⚠️ **`D37 · F1/T8` não dispara.** O gatilho é *"a primeira comparação do `:id` do Master com identidade da sessão"*, e **nenhuma** das 7 rotas compara. Não "resolver" o débito de graça — o `.toLowerCase()` viria junto e mudaria comportamento de rota publicada.

---

## 22. Checklist Final

- [x] Variante `backend` decidida e registrada (§1 e `_run/sdd_state.yaml`)
- [x] Todas as 10 US mapeadas (§17) · 20/20 CAs cobertos (§19)
- [x] Arquitetura com componentes, camadas e fronteiras (§3)
- [x] Arquivos envolvidos: 5 a criar, **13** a modificar, **9** de referência (§3.4–3.7)
- [x] Contratos, persistência, erros, segurança, versionamento e deploy preenchidos
- [x] Estratégia de testes delegada ao `agent-spec-qa-test-generator` e validada; JSON lossless em `_run/test-cases.json`
- [x] Cada CT em exatamente 1 camada; IDs únicos **CT-1204 a CT-1243** (40 casos)
- [x] Riscos técnicos com mitigação nomeada (§20)
- [x] Inventário de ADRs com conformidade **literal**, conferida abrindo a `Decision` de cada uma; a divergência da 0016 **resolvida** no código novo e **contida** no existente, não apenas declarada (§4.2, §21)
- [x] Candidatos a ADR: nenhum novo — as duas transversais já estão registradas
- [x] Pronto para o TASK PLAN
