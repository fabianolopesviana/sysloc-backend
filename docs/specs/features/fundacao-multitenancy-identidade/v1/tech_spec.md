# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação

- **Feature/Projeto**: `fundacao-multitenancy-identidade` — fatia 1 da F1
- **Variante**: backend
- **Stack**: Node 24.18.1 · TypeScript 7.0.2 · NestJS 11 + Fastify 5 · PostgreSQL 18 · Drizzle 0.45.2 + postgres.js 3.4.9 · better-auth 1.6.25 · Zod 4 · Vitest 4 + embedded-postgres
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-01
- **Versão**: v1
- **Status**: Aprovado
- **PRD Relacionado**: `docs/prds/features/fundacao-multitenancy-identidade/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/fundacao-multitenancy-identidade/v1/tech-alignment.md` (D1–D7)

---

## 2. Resumo Técnico da Solução

Nascem dois pacotes: `@sysloc/db` (schema, migrações, unidade de trabalho e guarda de catálogo) e `@sysloc/auth` (identidade, política de senha e barreira de admissão). O banco recebe **dois schemas** — `identidade`, sem noção de tenant, e `negocio`, onde toda tabela tem `empresa_id`, RLS habilitada **e forçada**, chave estrangeira composta `(id, empresa_id)` e concessão ao papel da aplicação (D1, ADR-0008, ADR-0009).

O isolamento é imposto exclusivamente pelo banco: nenhum repositório aplica filtro por empresa. O contexto chega via `AsyncLocalStorage` e é fixado por `SET LOCAL` dentro de uma **unidade de trabalho obrigatória** — `@sysloc/db` não exporta caminho de acesso sem contexto (D3). A propriedade das tabelas fica com um papel de migração distinto do papel que atende requisição (D2), de modo que contornar o isolamento exija duas falhas independentes.

A identidade usa `better-auth` com adaptador Drizzle. Três lacunas medidas do arcabouço são cobertas por código próprio: verificação de força de senha (só o comprimento é nativo), bloqueio por tentativas persistido na conta (o limitador nativo é por rota e janela) e obrigatoriedade do segundo fator para o Master. As cinco recusas de admissão convergem numa **barreira única**, com cada regra como predicado nomeado (D6) — a forma que fechou a classe de defeito registrada em `.claude/rules/nao-regressao.md` §7.

Fecha-se também o débito **D25**: a redação de segredo do registro estruturado ganha o terceiro eixo previsto no marcador, pois o arcabouço trafega `token` e `callbackURL` em cadeia de consulta.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                    HTTP (127.0.0.1, prefixo /v1)
                              │
                    ┌─────────▼──────────┐
                    │  apps/api (Nest)   │
                    │  FiltroExcecao ────┼── ADR-0007 (já existe)
                    └─────────┬──────────┘
              ┌───────────────┴────────────────┐
              │                                │
   ┌──────────▼──────────┐         ┌───────────▼────────────┐
   │ AutenticacaoModule  │         │  GuardaDeContexto      │
   │  rotas do arcabouço │         │  sessão → ALS          │
   └──────────┬──────────┘         └───────────┬────────────┘
              │                                │
   ┌──────────▼──────────────────────┐         │
   │ @sysloc/auth                    │         │
   │  · barreira de admissão (D6)    │         │
   │  · política de senha (RN-05)    │         │
   │  · bloqueio por conta (RN-06)   │         │
   │  · trilha de tentativas (RN-11) │         │
   └──────────┬──────────────────────┘         │
              │                                │
   ┌──────────▼────────────────────────────────▼────────────┐
   │ @sysloc/db                                             │
   │  · unidade de trabalho: BEGIN + SET LOCAL + COMMIT     │
   │  · schema identidade (sem tenant)                      │
   │  · schema negocio (RLS + FORCE + FK composta)          │
   │  · guarda de catálogo (cobertura de isolamento)        │
   └──────────┬─────────────────────────────────────────────┘
              │ postgres.js — papel `sysloc_app` (não dono, não superusuário)
   ┌──────────▼─────────────────────────────────────────────┐
   │ PostgreSQL 18 — banco `sysloc`                         │
   │  objetos pertencem a `sysloc_migracao`                 │
   └────────────────────────────────────────────────────────┘
```

Fora do processo que atende: `deploy/scripts/instalacao/migrar-banco.sh` aplica migrações com o papel `sysloc_migracao` (D2), no padrão idempotente da ADR-0005.

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| `esquema/identidade` | Empresa, usuário, credencial, sessão, segundo fator e trilha de tentativas. Sem tenant. | Dados |
| `esquema/negocio` | Vínculo de acesso e sua tabela-filha. Toda tabela com `empresa_id`, RLS forçada, FK composta. | Dados |
| `unidade-de-trabalho` | Abre transação, aplica `SET LOCAL app.empresa_id`, executa e confirma. Única porta de acesso. | Dados |
| `contexto` | `AsyncLocalStorage` com a empresa da sessão. Escrito só pela guarda; lido só pela unidade de trabalho. | Infra |
| `catalogo` | Consulta de cobertura: tabela em `negocio` sem RLS forçada, sem `empresa_id` ou sem FK composta. | Dados |
| `autenticacao` (better-auth) | Credencial, sessão de 8 h, segundo fator, cookie. Adaptador Drizzle. | Identidade |
| `admissao` | Barreira única de criação de sessão; 5 predicados nomeados. | Identidade |
| `senha` | Comprimento mínimo e as regras de força sem rede (RN-05). | Identidade |
| `bloqueio` | Contador de tentativas e instante de liberação, persistidos na conta (RN-06). | Identidade |
| `auditoria` | Registro de toda tentativa de entrada, com desfecho (RN-11). | Identidade |
| `GuardaDeContexto` | Resolve a sessão da requisição e popula o `AsyncLocalStorage`. Nunca lê empresa do pedido. | Apresentação |
| `AutenticacaoModule` | Monta as rotas do arcabouço sob `/v1/auth` e a rota de sessão do produto. | Apresentação |

### 3.3 Camadas e Fronteiras

**Layered com fronteira de pacote.** Direção única: `apps/api` → `@sysloc/auth` → `@sysloc/db` → `@sysloc/shared`. Nenhuma seta volta.

Duas fronteiras são **invariantes de compilação**, não convenção:

1. `@sysloc/db` exporta a unidade de trabalho, o schema e **um acesso tipado restrito ao schema `identidade`**; **não exporta** cliente, pool nem executor com alcance ao schema `negocio`. Consulta a dado de negócio sem contexto de tenant não é escrevível fora do pacote.

   O acesso restrito existe por necessidade verificada: o adaptador oficial tem assinatura `drizzleAdapter(db, config)` e **exige a instância** para operar as tabelas de identidade — que não são tenantizadas por definição (ADR-0009). Sem ele, a autenticação não é montável. O tipo do acesso restrito enumera apenas as tabelas de `identidade`, de modo que alcançar `negocio` por esse caminho **não compila** — a garantia continua valendo onde ela importa, em vez de valer no papel e ser contornada na montagem.
2. `@sysloc/auth` exporta a barreira de admissão e a instância configurada; **não exporta** os caminhos internos do arcabouço que criam sessão.

O `apps/worker` não participa desta fatia — nenhuma tarefa de negócio é enfileirada, e o débito D32 permanece fechado (o gatilho dele é a primeira fatia que enfileira).

### 3.4 Visão em Árvore

```
apps/
└── api/
    ├── src/
    │   ├── app.module.ts                                [M]
    │   ├── configuracao/ambiente.ts                     [M]
    │   ├── comum/filtro-excecao.ts                      [R]
    │   ├── main.ts                                      [M]
    │   └── autenticacao/
    │       ├── autenticacao.module.ts                   [N]
    │       ├── autenticacao.controller.ts               [N]
    │       ├── sessao.controller.ts                     [N]
    │       └── contexto.guard.ts                        [N]
    └── test/
        ├── autenticacao.e2e.spec.ts                     [N]
        ├── contexto.e2e.spec.ts                         [N]
        └── saude.e2e.spec.ts                            [R]
packages/
├── auth/
│   ├── package.json                                     [N]
│   ├── tsconfig.json · tsconfig.test.json               [N]
│   ├── vitest.config.ts                                 [N]
│   ├── src/
│   │   ├── index.ts                                     [N]
│   │   ├── autenticacao.ts                              [N]
│   │   ├── admissao.ts                                  [N]
│   │   ├── senha.ts                                     [N]
│   │   ├── bloqueio.ts                                  [N]
│   │   ├── auditoria.ts                                 [N]
│   │   └── perfis.ts                                    [N]
│   └── test/
│       ├── admissao.spec.ts                             [N]
│       ├── senha.spec.ts                                [N]
│       ├── bloqueio.spec.ts                             [N]
│       └── superficie-publica.spec.ts                   [N]
├── db/
│   ├── package.json                                     [N]
│   ├── tsconfig.json · tsconfig.test.json               [N]
│   ├── vitest.config.ts · drizzle.config.ts             [N]
│   ├── migracoes/
│   │   ├── 0000_fundacao.sql                            [N]
│   │   └── 0001_seguranca.sql                           [N]
│   ├── src/
│   │   ├── index.ts                                     [N]
│   │   ├── conexao.ts                                   [N]
│   │   ├── contexto.ts                                  [N]
│   │   ├── unidade-de-trabalho.ts                       [N]
│   │   ├── catalogo.ts                                  [N]
│   │   ├── semente.ts                                   [N]
│   │   └── esquema/
│   │       ├── identidade.ts                            [N]
│   │       └── negocio.ts                               [N]
│   └── test/
│       ├── banco-efemero.ts                             [N]
│       ├── isolamento.spec.ts                           [N]
│       ├── catalogo.spec.ts                             [N]
│       ├── unidade-de-trabalho.spec.ts                  [N]
│       └── papel-de-conexao.spec.ts                     [N]
└── shared/
    ├── src/log.ts                                       [M]
    ├── test/log.spec.ts                                 [M]
    └── test/postgres-efemero.ts                         [R]
deploy/
├── scripts/instalacao/
│   ├── provisionar-base.sh                              [M]
│   ├── verificar-provisionamento.sh                     [M]
│   ├── migrar-banco.sh                                  [N]
│   └── verificar-migracao.sh                            [N]
└── systemd/sysloc-api.service                           [R]
.env.example                                             [M]
CLAUDE.md                                                [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/db/src/esquema/identidade.ts` | Tabelas sem tenant: empresa, usuário, credencial, sessão, segundo fator, trilha de tentativas | Dados |
| `packages/db/src/esquema/negocio.ts` | Vínculo de acesso e tabela-filha, com `empresa_id`, `enableRLS()` e FK composta | Dados |
| `packages/db/src/contexto.ts` | `AsyncLocalStorage` do tenant; leitura e escrita separadas por tipo | Infra |
| `packages/db/src/unidade-de-trabalho.ts` | Transação + `SET LOCAL app.empresa_id`; única porta pública de acesso a dado | Dados |
| `packages/db/src/conexao.ts` | Cliente `postgres.js` interno ao pacote, **não exportado** no índice | Dados |
| `packages/db/src/catalogo.ts` | Consulta de cobertura sobre `pg_class`/`pg_policies`/`pg_constraint` | Dados |
| `packages/db/src/semente.ts` | Carga inicial: Master, duas empresas e usuários de verificação | Dados |
| `packages/db/migracoes/0000_fundacao.sql` | Schemas, tabelas, chaves e índices (gerado pelo drizzle-kit) | Migração |
| `packages/db/migracoes/0001_seguranca.sql` | `FORCE ROW LEVEL SECURITY`, políticas, `REVOKE`/`GRANT` e propriedade dos objetos | Migração |
| `packages/db/test/banco-efemero.ts` | Envolve a instância efêmera da F0 e provisiona os dois papéis e os dois schemas | Teste |
| `packages/auth/src/autenticacao.ts` | Instância `better-auth`: adaptador Drizzle, sessão de 8 h, cookie, segundo fator | Identidade |
| `packages/auth/src/admissao.ts` | Barreira única e os 5 predicados de recusa | Identidade |
| `packages/auth/src/senha.ts` | Comprimento mínimo e regras de força sem rede | Identidade |
| `packages/auth/src/bloqueio.ts` | Contador de tentativas e instante de liberação | Identidade |
| `packages/auth/src/auditoria.ts` | Escrita da trilha de tentativas, com desfecho | Identidade |
| `packages/auth/src/perfis.ts` | União fechada dos três perfis | Identidade |
| `apps/api/src/autenticacao/autenticacao.controller.ts` | Encaminha `/v1/auth/*` ao manipulador do arcabouço | Apresentação |
| `apps/api/src/autenticacao/sessao.controller.ts` | `GET /v1/sessao` no modelo de domínio camelCase | Apresentação |
| `apps/api/src/autenticacao/contexto.guard.ts` | Resolve sessão e popula o `AsyncLocalStorage` | Apresentação |
| `deploy/scripts/instalacao/migrar-banco.sh` | Aplica migrações com o papel de migração, idempotente | Infra |
| `deploy/scripts/instalacao/verificar-migracao.sh` | Verificador shell: papéis, propriedade e cobertura de RLS no cluster real | Infra |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/shared/src/log.ts` | Terceiro eixo de redação na entrada única de despacho, por forma do valor em cadeia de consulta | Fecha o **D25**, cujo gatilho é esta fatia |
| `packages/shared/test/log.spec.ts` | Casos para `token`/`callbackURL` em cadeia de consulta, com prova de falsificação | Rede do P4 do Protocolo Antirregressão |
| `apps/api/src/app.module.ts` | Importa `AutenticacaoModule` e registra a guarda de contexto | Composição raiz é onde infraestrutura de processo nasce |
| `apps/api/src/configuracao/ambiente.ts` | Nova variável exigida: segredo de assinatura de sessão | Validação de partida é a fonte única do que o processo exige |
| `apps/api/src/main.ts` | Prefixo global `/v1`, **excluindo `saude` e o caminho do contrato** | Versionamento decidido nesta fatia (§15). A exclusão preserva os endereços que `verificar-fundacao.sh` e o e2e da F0 já consultam |
| `deploy/scripts/instalacao/provisionar-base.sh` | Dois passos novos, idempotentes: papel `sysloc_migracao` sem privilégio administrativo, e os schemas `identidade`/`negocio` com dono `sysloc_migracao` e uso concedido ao `sysloc_app` | D2 — dono dos objetos separado de quem atende requisição; criar o schema aqui evita conceder `CREATE` no banco ao migrador (§7.3) |
| `deploy/scripts/instalacao/verificar-provisionamento.sh` | Caso novo: o papel de migração existe e não é superusuário | Todo passo de provisionamento tem verificador |
| `.env.example` | Documenta o segredo de sessão e a cadeia de conexão de migração | Arquivo documenta o que o processo exige |
| `CLAUDE.md` | Remove a linha do D25 do índice de débitos com gatilho | §3-B do Protocolo: marcador e índice saem no mesmo commit |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `packages/shared/test/postgres-efemero.ts` | Contrato da instância efêmera. **Não alterar** — o novo helper a envolve, preservando a propriedade auditada pela ADR-0006 |
| `packages/shared/test/efemero-comum.ts` | Reserva de porta, sondagem com limite e registro de descarte |
| `packages/shared/src/erros.ts` | Enum fechado de códigos e envelope da ADR-0007 |
| `apps/api/src/comum/filtro-excecao.ts` | Tradução de exceção para o envelope canônico |
| `apps/api/src/saude/saude.controller.ts` | Padrão de controlador, anotação de contrato e uso de `ErroDeAplicacao` |
| `apps/api/test/saude.e2e.spec.ts` | Padrão de verificação de ponta a ponta com servidor real em porta dinâmica |
| `deploy/scripts/instalacao/provisionar-base.sh` | Padrão de passo idempotente e transporte de segredo por `PGPASSFILE` |
| `.claude/rules/testing-stack.md` | Convenção `CT-NNN`, prova de falsificação e fronteiras de execução real |
| `.claude/rules/nao-regressao.md` | Protocolo obrigatório antes de editar arquivo existente |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Todas as rotas sob o prefixo `/v1`. As de autenticação preservam os caminhos nativos do arcabouço sob `/v1/auth`, para que o cliente oficial funcione sem tradução; as rotas próprias do produto falam o modelo de domínio camelCase do invariante 6.

| Ação | Método | Rota | Payload | Resposta | Status | Auth |
|---|---|---|---|---|---|---|
| Entrar | POST | `/v1/auth/sign-in/email` | `{ email, password }` | sessão ou desafio de segundo fator | 200, 401, 422 | não |
| Verificar segundo fator | POST | `/v1/auth/two-factor/verify-totp` | `{ code }` | sessão estabelecida | 200, 401 | desafio |
| Sair | POST | `/v1/auth/sign-out` | — | `{ sucesso: true }` | 200, 401 | sessão |
| Trocar senha | POST | `/v1/auth/change-password` | `{ currentPassword, newPassword }` | `{ sucesso: true }` | 200, 401, 422 | sessão |
| Preparar segundo fator | POST | `/v1/auth/two-factor/enable` | `{ password }` | `{ totpURI, backupCodes }` | 200, 401, 422 | sessão |
| Ativar segundo fator | POST | `/v1/auth/two-factor/verify-totp` | `{ code }` | `{ sucesso: true }` | 200, 401 | sessão |
| Sessão corrente | GET | `/v1/sessao` | — | objeto de sessão (§4.2) | 200, 401 | sessão |

**Sem verbo de atualização parcial nesta fatia** — a subseção 4.1.1 do template não se aplica: nenhum `PUT`/`PATCH` é publicado.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|---|---|---|---|
| `Sessao` | Zod + contrato publicado | `usuarioId`, `nome`, `email`, `perfil`, `empresaId`, `empresaNome`, `senhaProvisoria`, `segundoFatorPendente` | v1 |
| `CorpoErro` | `@sysloc/shared` (ADR-0007) | `codigo`, `mensagem`, `campo?`, `detalhes?` | herdado |
| `EntradaCredencial` | Zod | `email`, `password` | v1 |

`empresaId` e `empresaNome` são **nulos apenas para o Master**, que não pertence a empresa alguma. A sessão desta fatia **não** carrega telas nem ações — isso é da fatia 2, junto de `versaoPermissoes`.

### 4.3 Eventos Publicados / Consumidos

N/A — esta fatia não produz nem consome tarefa de fila. O débito D32 (`apps/worker/src/fila.ts`) **não dispara** aqui: seu gatilho é a primeira fatia que enfileira tarefa de negócio.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal — entrada com identificação e senha

1. `POST /v1/auth/sign-in/email` chega ao controlador, que delega ao manipulador do arcabouço.
2. O arcabouço resolve a credencial. **Antes de emitir sessão**, a barreira de admissão é consultada com o usuário resolvido.
3. A barreira avalia os predicados, nesta ordem, e para no primeiro que recusa:
   - `contaBloqueada` — há instante de liberação no futuro;
   - `pessoaDesativada`;
   - `empresaSuspensa` — só se aplica a quem pertence a empresa;
   - `senhaProvisoriaPendente` — não recusa: marca a sessão como **restrita**;
   - `segundoFatorExigido` — perfil Master sem segundo fator ativo marca a sessão como **restrita**; com segundo fator ativo, interrompe para o desafio.
4. Credencial incorreta: `bloqueio` incrementa o contador da conta; ao atingir cinco, grava o instante de liberação.
5. `auditoria` registra a tentativa — com desfecho, autor quando identificável, momento e origem — **nos dois caminhos**, sucesso e falha.
6. Sessão emitida em cookie `httpOnly`+`Secure`+`SameSite`, validade de 8 h renovada por atividade. O contador de tentativas da conta é zerado.

### 5.2 Fluxos Alternativos

- **Sessão restrita**: enquanto `senhaProvisoria` ou `segundoFatorPendente` valerem, a guarda de contexto autoriza apenas `GET /v1/sessao`, as rotas de troca de senha e as de configuração do segundo fator. Qualquer outra rota responde `403` no envelope da ADR-0007. Concluídas as duas exigências, a restrição cai sem novo login.
- **Empresa suspensa ou pessoa desativada**: recusa com o **mesmo** código e mensagem da credencial incorreta — distinguir confirmaria a existência da conta (§9 do PRD).
- **Requisição autenticada**: a guarda lê a sessão, obtém `empresaId` **da sessão** e o publica no `AsyncLocalStorage`. Toda consulta subsequente corre na unidade de trabalho com `SET LOCAL`.
- **Master consultando dado de negócio**: o contexto fica sem empresa; `SET LOCAL app.empresa_id` recebe valor vazio, nenhuma política casa, e o resultado é vazio — sem ramo de aplicação que trate o Master à parte.
- **Sessão expirada**: `401`, com nova entrada exigida.

### 5.3 Mapeamento de User Stories → Fluxos

| User Story | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | Toda requisição autenticada | `contexto.guard`, `unidade-de-trabalho`, políticas de `negocio` |
| US-02 | Acesso direto ao banco, sem aplicação | `0001_seguranca.sql`, `banco-efemero`, `papel-de-conexao.spec` |
| US-03 | Gravação com referência cruzada | FK composta em `esquema/negocio` |
| US-04 | Sessão do Master em qualquer consulta de negócio | `contexto`, políticas de `negocio` |
| US-05 | `POST /v1/auth/sign-in/email` | `autenticacao`, `admissao`, `auditoria` |
| US-06 | `POST /v1/auth/sign-in/email` e troca de senha | `senha`, `bloqueio` |
| US-07 | `POST /v1/auth/two-factor/*` | `autenticacao` (plugin), `admissao` |
| US-08 | `POST /v1/auth/change-password` | `admissao`, `senha` |
| US-09 | `POST /v1/auth/sign-out` e expiração | `autenticacao`, `contexto.guard` |
| US-10 | `POST /v1/auth/sign-in/email` | `admissao` (dois predicados) |
| US-11 | Todo desfecho de entrada | `auditoria` |
| US-12 | Todo evento registrado | `packages/shared/src/log.ts` |
| US-13 | Verificação do projeto | `catalogo`, `catalogo.spec`, `verificar-migracao.sh` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|---|---|---|
| Endereço de e-mail bem formado | Entrada e criação de credencial | `422` `CAMPO_INVALIDO`, `campo: "email"` |
| Endereço de e-mail **normalizado para minúsculas** antes de chegar ao banco | Mesma validação de entrada, ponto único | — (transformação, não recusa) |
| Comprimento mínimo de 10 | Toda definição de senha | `422` `CAMPO_INVALIDO`, `campo: "senha"` |
| Força da senha (§6.3, RN-05) | Toda definição de senha | `422` `CAMPO_INVALIDO` com o motivo em `detalhes` |
| Código do segundo fator com 6 dígitos | Desafio e ativação | `422` `CAMPO_INVALIDO` |
| Nenhum valor de empresa aceito no pedido | Toda rota | Campo inexistente no schema; se enviado, é ignorado (RN-03) |

### 6.2 Transformações de Dados

- Banco em `snake_case` e português; API em `camelCase` (invariante 6). A tradução acontece na borda do controlador, nunca no repositório.
- As tabelas do arcabouço são mapeadas para os nomes do projeto por configuração do adaptador — não se adota o vocabulário em inglês do arcabouço no schema.
- Senha nunca trafega nem é registrada: só o resultado de derivação persistida pelo arcabouço.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro associado |
|---|---|---|---|
| RN-01 | RN-01 | Toda linha em `negocio` tem `empresa_id` não nulo, vindo do contexto | Recusa do banco (`WITH CHECK`) |
| RN-02 | RN-02 | Referência entre entidades tenantizadas usa FK composta `(id, empresa_id)` | Violação de chave estrangeira |
| RN-03 | RN-03 | A empresa vem da sessão; valor no pedido é ignorado | — (inexistente por construção) |
| RN-04 | RN-04 | Contexto sem empresa não casa nenhuma política de `negocio` | Resultado vazio, sem erro |
| RN-05 | RN-05 | Senha ≥ 10, sem conter nome ou parte local do e-mail, sem sequência de 4+ caracteres consecutivos e sem repetição de 4+ iguais | `CAMPO_INVALIDO` |
| RN-06 | RN-06 | Cinco falhas consecutivas gravam instante de liberação; sucesso zera o contador | Recusa genérica de credencial |
| RN-07 | RN-07 | Sessão de 8 h, renovada por atividade | `401` ao expirar |
| RN-08 | RN-08 | Master sem segundo fator ativo entra em sessão restrita; Admin é opcional | `403` fora das rotas permitidas |
| RN-09 | RN-09 | Senha provisória força sessão restrita até a troca; após a troca a marca cai | `403` fora das rotas permitidas |
| RN-10 | RN-10 | Pessoa desativada ou empresa suspensa não obtém sessão | Recusa **idêntica** à de credencial incorreta |
| RN-11 | RN-11 | Toda tentativa gera uma linha na trilha, inclusive quando o e-mail não existe | — |
| RN-12 | RN-12 | Nenhum segredo legível no registro, inclusive em cadeia de consulta | — (D25) |
| RN-13 | RN-13 | Os três perfis são união fechada; nenhuma decisão de permissão nesta fatia | — |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18 (cluster provisionado na F0), banco `sysloc`. Acesso por `postgres.js` 3.4.9 com Drizzle 0.45.2. **Dois schemas**: `identidade` e `negocio` (D1, ADR-0009).

### 7.2 Tabelas / Coleções

**Schema `identidade`** — sem `empresa_id`, sem RLS.

| Nome | Colunas | Tipos | Constraints | Índices |
|---|---|---|---|---|
| `empresa` | `id`, `nome`, `documento`, `suspensa_em`, `criada_em` | uuid, text, text, timestamptz null, timestamptz | PK `id`; único `documento` | `documento` |
| `usuario` | `id`, `email`, `nome`, `perfil`, `empresa_id`, `ativo`, `senha_provisoria`, `dois_fatores_ativo`, `tentativas_falhas`, `bloqueado_ate`, `criado_em` | uuid, text, text, enum, uuid null, bool, bool, bool, int, timestamptz null, timestamptz | PK `id`; único `email`; FK `empresa_id`; `CHECK` (perfil Master ⇔ `empresa_id` nulo) | `email`, `empresa_id` |
| `conta` | credencial derivada, mapeada pelo adaptador | — | FK `usuario_id` | `usuario_id` |
| `sessao` | token, expiração, origem, agente | — | FK `usuario_id` | `token`, `usuario_id` |
| `verificacao` | identificador, valor, expiração | — | — | identificador |
| `dois_fatores` | segredo, códigos de recuperação | — | FK `usuario_id` | `usuario_id` |
| `tentativa_login` | `id`, `email_informado`, `usuario_id`, `desfecho`, `origem`, `agente`, `ocorrida_em` | uuid, text, uuid null, enum, inet, text, timestamptz | FK `usuario_id` opcional | `ocorrida_em`, `email_informado` |

`tentativa_login.usuario_id` é **anulável de propósito**: tentativa com e-mail inexistente precisa ser registrada (RN-11) e não tem a quem se vincular.

**Schema `negocio`** — toda tabela com `empresa_id`, RLS habilitada e forçada, FK composta.

| Nome | Colunas | Tipos | Constraints | Índices |
|---|---|---|---|---|
| `acesso_usuario_app` | `id`, `empresa_id`, `usuario_id`, `criado_em` | uuid, uuid, uuid, timestamptz | PK `id`; **único `(id, empresa_id)`**; único `(empresa_id, usuario_id)`; FK `empresa_id`; FK `usuario_id` | `(empresa_id, usuario_id)` |
| `acesso_usuario_permissao` | `id`, `empresa_id`, `acesso_id`, `tipo`, `chave` | uuid, uuid, uuid, enum, text | PK `id`; único `(id, empresa_id)`; **FK composta `(acesso_id, empresa_id)` → `acesso_usuario_app (id, empresa_id)`** | `(empresa_id, acesso_id)` |

`acesso_usuario_permissao` nasce **estrutural e vazia**: nenhuma tela ou ação é povoada, nenhuma regra a lê. É o par tenantizado que torna a FK composta verificável com dado real (CA-04); povoá-la é da fatia seguinte.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|---|---|---|
| 0000 | `packages/db/migracoes/0000_fundacao.sql` | up — tabelas, chaves, índices, `ENABLE ROW LEVEL SECURITY` (gerado pelo drizzle-kit) |
| 0001 | `packages/db/migracoes/0001_seguranca.sql` | up — `FORCE ROW LEVEL SECURITY`, políticas `USING`/`WITH CHECK`, `REVOKE ALL FROM PUBLIC` e `GRANT` ao papel da aplicação |

**Os dois schemas não são criados pela migração.** `provisionar-base.sh`, que já roda com privilégio administrativo, cria `identidade` e `negocio` com dono `sysloc_migracao` e concede uso ao `sysloc_app`. A migração conecta **como** o migrador e cria apenas tabelas — que nascem dele por consequência, sem nenhum `ALTER ... OWNER`. Duas razões: transferir propriedade exigiria que quem executa pertencesse ao papel de destino, e permitir que o migrador criasse schemas exigiria conceder-lhe `CREATE` sobre um banco cujo dono é o papel da aplicação — poder maior do que a tarefa pede.

O 0001 é **SQL escrito à mão** por decisão (D4): o gerador não emite `FORCE ROW LEVEL SECURITY` nem concessões. Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta é restauração de backup.

Política de `negocio`, idêntica em `USING` e `WITH CHECK`:
```sql
empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
```
`current_setting(..., true)` devolve nulo quando a variável não foi fixada, e a comparação com nulo não casa nada — contexto ausente resulta em vazio, nunca em dado alheio.

### 7.4 Estratégia de Transação e Consistência

- **Unidade de trabalho obrigatória** (D3): `BEGIN` → `SET LOCAL app.empresa_id` → operações → `COMMIT`. `SET LOCAL` morre com a transação, o que impede o valor de vazar para a conexão seguinte do pool.
- Nível padrão `READ COMMITTED` — nenhuma operação desta fatia depende de isolamento mais forte.
- O contador de tentativas é atualizado com incremento no próprio `UPDATE`, sem leitura prévia, o que o torna correto sob concorrência sem bloqueio explícito.
- Semente idempotente: reexecutar não duplica empresa nem usuário.

### 7.5 Política de Retenção / Archival

`tentativa_login` cresce indefinidamente nesta fatia. Não há expurgo — o volume esperado (dezenas de entradas por dia) não justifica particionamento, e apagar trilha de auditoria é decisão que não cabe a esta fatia. Registrado como limite conhecido (§12.3).

---

## 8. Integração com APIs Externas

N/A — nenhuma. A verificação de força de senha foi decidida **sem rede** (RN-05), justamente para não colocar terceiro no caminho da entrada e da troca obrigatória.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas
N/A — esta fatia não enfileira nem consome tarefa.

### 9.2 Idempotência
Aplica-se a dois pontos fora do caminho HTTP: a semente e os scripts de provisionamento e migração, todos reexecutáveis sem efeito adicional (padrão da ADR-0005).

### 9.3 Outbox / Saga
N/A — não há consistência distribuída nesta fatia.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|---|---|---|---|
| Credencial incorreta, conta bloqueada, pessoa desativada, empresa suspensa | `CREDENCIAL_INVALIDA` (novo) | idêntica nos quatro casos | `admissao` |
| Sessão ausente ou expirada | `NAO_AUTENTICADO` (novo) | "sessão inválida ou expirada" | `contexto.guard` |
| Rota fora do que a sessão restrita permite | `ACESSO_NEGADO` (novo) | nomeia a exigência pendente | `contexto.guard` |
| Senha reprovada na força | `CAMPO_INVALIDO` | motivo em `detalhes` | `senha` |
| Código de segundo fator inválido | `CREDENCIAL_INVALIDA` | — | `autenticacao` |

Três códigos novos entram no enum fechado de `@sysloc/shared`, com o status semântico correspondente (`401`, `401`, `403`). Acrescentar valor é retrocompatível pela ADR-0007; a tabela `Record<CodigoErro, number>` obriga o mapeamento de status a acompanhar, sob pena de não compilar.

### 10.2 Resiliência

Sem tentativa automática: as operações desta fatia não são idempotentes do lado do cliente e repetir entrada malsucedida alimentaria o bloqueio. Banco indisponível já é coberto pela verificação profunda de saúde existente.

### 10.3 Estratégia de Logging de Erros

Registro estruturado existente (`packages/shared/src/log.ts`), pela entrada única de despacho já estabelecida. Toda recusa de admissão registra em `warn` com o predicado que recusou; nenhuma senha, código, token de sessão ou código de recuperação chega ao registro — inclusive quando o valor viaja em cadeia de consulta, que é a lacuna que o D25 fecha nesta fatia.

---

## 11. Segurança

### 11.1 Autenticação

`better-auth` 1.6.25 com adaptador Drizzle. Sessão em banco, cookie `httpOnly`+`Secure`+`SameSite=Lax`, validade de 8 h renovada por atividade. Segundo fator TOTP por plugin. Validação da sessão na guarda global, antes de qualquer controlador.

**A guarda é global e as exceções são explícitas**, marcadas no próprio controlador: as rotas de entrada e de segundo fator, as duas verificações de saúde e o contrato publicado. O default importa — rota nova nasce **protegida por omissão**, de modo que o esquecimento produz `401` em vez de superfície aberta. Um caso de teste enumera as rotas públicas efetivas e falha se a lista crescer sem revisão, o que impede que a exceção vire porta de entrada silenciosa.

### 11.2 Autorização

Nesta fatia a autorização é **binária e mínima**: sessão válida ou não, e sessão restrita ou plena. A matriz de telas e ações é da fatia seguinte. A única regra de alcance de dado é a RLS — não há verificação de empresa em serviço nem em repositório, e essa ausência é deliberada (ADR-0008: não há dois caminhos para o dado).

**Limite declarado — identidade não é protegida pelo banco.** A RLS cobre o schema `negocio`; o schema `identidade` não tem política, por decisão da ADR-0009 (o login precisa operar antes de existir contexto de empresa). Na prática: nada no banco impede que uma consulta a `identidade` alcance usuários ou empresas de outros tenants. Nesta fatia isso não é alcançável de fora, porque **nenhuma rota expõe identidade além da própria sessão de quem pede** — `GET /v1/sessao` devolve a pessoa autenticada e a empresa dela, e não há listagem. Expor qualquer listagem, a começar pelas rotas do Master, **exige a autorização da fatia seguinte**, e essa é a camada que passa a responder por esse alcance. Isto é limite conhecido e declarado, não defeito: quem reencontrar esta ausência de política em `identidade` deve ler esta linha antes de tratá-la como esquecimento.

### 11.3 Criptografia

Derivação de senha pelo arcabouço (padrão `scrypt`). Segredo de assinatura de sessão em `EnvironmentFile` 0600, fora da árvore versionada. Sem cifragem por campo — decisão 16, limite declarado e aceito. TLS termina no servidor de borda; o processo escuta apenas no endereço de retorno.

### 11.4 Sanitização e Validação

Consultas parametrizadas por `postgres.js` e Drizzle — nenhuma interpolação de valor em SQL. **Exceção auditada**: `SET LOCAL` não aceita parâmetro vinculado, então o valor da empresa é validado como UUID antes de compor a instrução, e a validação tem caso negativo dedicado. Entrada validada por Zod na borda.

### 11.5 Rate Limiting / Anti-abuse

Bloqueio por conta após cinco falhas consecutivas, persistido (RN-06). O limitador nativo do arcabouço (por rota e janela) **não** é usado como substituto — ele não cumpre a regra por conta —, mas permanece disponível como camada adicional futura.

### 11.6 Secrets Management

`/etc/sysloc/backend.env`, 0600, dono `root`, lido pela unidade systemd. O segredo de sessão entra ali. A credencial do papel de migração **não** vai para esse arquivo: ela é usada pelo script de migração, fora do processo que atende, via `PGPASSFILE` — mesmo mecanismo do provisionamento (ADR-0005: segredo nunca em `argv` nem em variável exportada).

---

## 12. Performance

### 12.1 Metas

- Latência p95 da entrada: < 400 ms (dominada pela derivação de senha, deliberadamente cara).
- Latência p95 de requisição autenticada: < 80 ms.
- Vazão esperada: dezenas de requisições por segundo — 20 a 300 empresas (decisão 2).

### 12.2 Estratégias

Índice em `usuario.email`, em `acesso_usuario_app (empresa_id, usuario_id)` e em `sessao.token`. Reserva de conexões do `postgres.js` compartilhada. Sem cache de sessão em memória nesta fatia: a leitura é indexada e por chave, e cache introduziria uma segunda fonte de verdade justamente onde a fatia seguinte precisa invalidar por evento.

### 12.3 Limites Conhecidos

- Toda leitura abre transação (custo aceito em D3).
- Escrita no caminho de login, inclusive no de falha (custo aceito em D5).
- `tentativa_login` sem política de expurgo.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|---|---|---|---|
| Entrada bem-sucedida | info | `usuarioId`, `perfil`, `empresaId`, `origem` | sem credencial |
| Recusa de admissão | warn | `predicado`, `origem`, `emailInformado` redigido | e-mail redigido pelo eixo por nome |
| Bloqueio atingido | warn | `usuarioId`, `bloqueadoAte` | — |
| Falha de política no banco | error | `codigoSql`, `tabela` | sem valor de linha |
| Cobertura de isolamento reprovada | error | `tabelas` | — |

Biblioteca `pino` 10.3.1 via `criarLogger`, com a entrada única de despacho que redige por nome, por forma de credencial embutida e — a partir desta fatia — por forma de valor em cadeia de consulta.

### 13.2 Métricas

N/A nesta fatia. O projeto declara OpenTelemetry na stack, mas nenhum coletor está provisionado e a F0 não o instalou; introduzir emissão sem destino seria código sem consumidor. Registrado como diferido, não como esquecido.

### 13.3 Tracing

N/A — mesma justificativa da 13.2.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|---|---|---|---|
| Cobertura de isolamento reprovada | verificador de migração retorna diferente de zero | crítica | saída do script, bloqueando a instalação |

Não há sistema de alerta em execução; o gate é o próprio script, no momento da migração.

---

## 14. Feature Flags

N/A — nenhuma. Não há caminho alternativo a ser ligado ou desligado nesta fatia: o isolamento não é opcional, e uma chave capaz de desligá-lo seria exatamente o escape que a ADR-0008 rejeita.

---

## 15. Versionamento de API

### 15.1 Estratégia

**Prefixo de versão no caminho**, desde a primeira rota: `/v1`. Aplicado globalmente na montagem da aplicação. Decidido nesta fatia porque é a primeira a publicar recurso — `main.ts` registrava a decisão como diferida "porque ainda não há recurso publicado", e essa condição deixa de valer aqui.

**Exceção declarada e obrigatória**: `saude` e o caminho do contrato publicado ficam **fora** do prefixo. As duas verificações de saúde são consumidas pelo supervisor do sistema operacional e por `deploy/scripts/instalacao/verificar-fundacao.sh`, que as consulta em 16 asserções — inclusive no caso de recuperação após reinício real, critério de aceitação da F0. Movê-las para `/v1/saude` tornaria vermelho um conjunto de casos que está verde, o que o P5 do Protocolo Antirregressão classifica como regressão a ser revertida, não como teste a ser ajustado. A exceção é registrada no próprio `main.ts`, junto ao motivo, para que uma rodada futura não a leia como esquecimento.

### 15.2 Compatibilidade

Acrescentar rota ou campo é retrocompatível. Remover ou renomear exige `/v2` convivendo com `/v1`. O marco de entrega do backend congela a superfície do app do cliente antes do handoff; o prefixo é o que torna esse congelamento reversível sem quebrar o React já religado.

### 15.3 Schemas / Contratos

Documento de contrato já publicado em `/docs/json` pela F0. Os schemas desta fatia são declarados nas anotações do controlador, no mesmo padrão de `saude.controller.ts`. O pacote `@sysloc/contracts` que o React importará é do marco de entrega, não desta fatia.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Sem CI remoto — a verificação roda na máquina (`pnpm lint`, `pnpm test`) e os verificadores shell no host. A instalação segue os scripts idempotentes de `deploy/scripts/instalacao/`.

### 16.2 Empacotamento

Nativo, sem contêiner: artefato compilado em `dist/`, executado pelo Node fixado no `.mise.toml`, sob unidade systemd com `Restart=always`.

### 16.3 Infraestrutura como Código

`provisionar-base.sh` (papéis, banco, arquivo de ambiente) e `instalar-unidades.sh` (systemd), ambos idempotentes — ADR-0005. Esta fatia acrescenta `migrar-banco.sh` no mesmo padrão.

### 16.4 Estratégia de Rollout

Migração aplicada com o serviço parado, antes de subir a versão nova. Não há tráfego externo até a virada da F7, o que torna dispensável rollout progressivo.

### 16.5 Escalabilidade

Processo único por serviço. A escala prevista (20 a 300 empresas) cabe com folga; a RLS não impede escala horizontal futura, pois o contexto é por transação e não por processo.

### 16.6 Rollback

Sem descida de migração. O rollback é: parar o serviço, restaurar o artefato anterior e, se a estrutura mudou, restaurar o backup. A rotina de backup provada é item da F7 — até lá, o banco não carrega dado de operação.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| US-01 | Políticas RLS em `negocio` com contexto por transação | §7.2, §7.3, §7.4 |
| US-02 | `FORCE ROW LEVEL SECURITY` + papel da aplicação não dono | §7.3, §11.2, `0001_seguranca.sql` |
| US-03 | FK composta `(id, empresa_id)` entre entidades tenantizadas | §7.2 (`acesso_usuario_permissao`) |
| US-04 | Contexto sem empresa não casa política; sem ramo de aplicação para o Master | §5.2, §7.3 |
| US-05 | Credencial e sessão pelo arcabouço, com adaptador Drizzle | §11.1, `packages/auth/src/autenticacao.ts` |
| US-06 | Política de senha própria e bloqueio persistido | §6.3 RN-05/RN-06, `senha.ts`, `bloqueio.ts` |
| US-07 | Plugin de segundo fator e predicado de exigência por perfil | §11.1, `admissao.ts` |
| US-08 | Marca de senha provisória e sessão restrita | §5.2, §6.3 RN-09 |
| US-09 | Encerramento de sessão e expiração de 8 h | §11.1, §6.3 RN-07 |
| US-10 | Predicados de pessoa desativada e empresa suspensa | `admissao.ts`, §6.3 RN-10 |
| US-11 | Trilha de tentativas com desfecho, gravada nos dois caminhos | §7.2 (`tentativa_login`), `auditoria.ts` |
| US-12 | Terceiro eixo de redação na entrada única de despacho | §10.3, `packages/shared/src/log.ts` |
| US-13 | Guarda de catálogo sobre `pg_class`/`pg_policies`/`pg_constraint` | §7.3, `catalogo.ts`, `verificar-migracao.sh` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|---|---|---|---|
| ORM / query builder | `drizzle-orm` | 0.45.2 | Schema tipado, `enableRLS()` e `pgPolicy()` declarativos |
| Migrações | `drizzle-kit` | compatível com 0.45.2 | Geração da migração estrutural |
| Driver | `postgres` | 3.4.9 | Já dependência de `apps/api` |
| Identidade | `better-auth` | 1.6.25 | Credencial, sessão, cookie e segundo fator |
| Adaptador | `@better-auth/drizzle-adapter` | 1.6.25 | Distribuído junto do pacote de identidade |
| Validação | `zod` | 4.4.3 | Já em uso na validação de partida |
| Verificação | `embedded-postgres` | 18.4.0-beta.17 | Instância efêmera própria (ADR-0006) |

Nenhuma dependência nova além destas. `zxcvbn` e o plugin de senhas vazadas foram **descartados** pela decisão de força sem rede (RN-05).

---

## 19. Estratégia de Testes

> **Resumo**: 32 casos de teste | Unitários: 3 | Integração: 13 | E2E: 11 | Segurança: 5
> **Padrão**: Vitest 4 com instância efêmera própria de PostgreSQL e servidor HTTP real em porta dinâmica; frente shell sem framework para o que só é observável no cluster real. Mock evitado por decisão — 28 dos 32 casos atravessam fronteira de execução real. Rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de INVARIANTES por arquivo.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | Consulta no contexto de A devolve só dados de A | CT-003, CT-010, CT-018 |
| CA-02 | Acesso direto ao banco não alcança dado alheio | CT-004, CT-005, CT-010, CT-011, CT-012 |
| CA-03 | Isolamento removido de propósito faz a suíte reprovar | CT-002, CT-007 |
| CA-04 | Vínculo entre empresas distintas é recusado pelo banco | CT-006 |
| CA-05 | Master enxerga vazio em dado de negócio | CT-005, CT-020 |
| CA-06 | Credencial correta estabelece sessão identificada | CT-018, CT-026 |
| CA-07 | Senha curta ou fraca é recusada com motivo | CT-013, CT-014, CT-022 |
| CA-08 | Cinco falhas consecutivas bloqueiam a conta | CT-015, CT-016 |
| CA-09 | Master só conclui acesso após o segundo fator | CT-019, CT-026 |
| CA-10 | Senha provisória obriga troca antes de tudo | CT-021, CT-022 |
| CA-11 | Encerrar sessão invalida o acesso na hora | CT-023 |
| CA-12 | Sessão inativa além do máximo é recusada | CT-024 |
| CA-13 | Desativada ou suspensa não obtém acesso | CT-017, CT-026 |
| CA-14 | Toda tentativa de entrada fica registrada | CT-025 |
| CA-15 | Nenhum segredo legível no registro interno | CT-027, CT-028, CT-029 |
| CA-16 | Tabela sem isolamento reprova a verificação | CT-008, CT-009, CT-031 |
| CA-17 | A conexão da prova não contorna o isolamento | CT-001, CT-002, CT-030 |

### 19.1 Testes Unitários

#### Dados — `packages/db`

Mock: nenhum — os dublês foram evitados por decisão do projeto.

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-011 | Valor de contexto que não é UUID é recusado antes de compor o SET LOCAL | CA-02 | A unidade de trabalho valida o identificador de empresa como UUID antes de compô-lo na instrução `SET LOCAL` (que não aceita parâmetro vinculado); valor que não seja UUID levanta erro nomeado e nenhu… | {'descricao': 'Tabela de valores inválidos, incluindo a tentativa de injeção, e um valor válido de controle.', 'valores': {'invalidos': ["0… | Nos quatro valores inválidos: erro cuja mensagem nomeia `app.empresa_id` e declara 'identificador de empresa inválido', com o valor recusado redigido; contagem de instruções emiti… | — | imite `apps/api/test/saude.e2e.spec.ts (padrão de observar o boundary real — sentinela na porta — em vez de instrumentar o SUT)`: (b) observar pelo boundary real, não por dublê: rodar contra a instân… |

#### Identidade — `packages/auth`

Mock: nenhum — os dublês foram evitados por decisão do projeto.

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-013 | Senha que satisfaz comprimento e força é aceita | CA-07 | Senha com 10 ou mais caracteres, que não contenha o nome nem a parte local do e-mail da pessoa, sem sequência de 4 caracteres consecutivos e sem repetição de 4 iguais, é aprovada pela política sem mo… | {'descricao': 'Senhas aprovadas, com a fronteira de comprimento incluída.', 'valores': {'pessoa': {'nome': 'Marina Duarte', 'email': 'marin… | Para as três senhas: `aprovada = true` e `motivos = []`. A senha de exatamente 10 caracteres é aprovada — a fronteira é `>= 10`, não `> 10`. | — | — |
| CT-014 | Senha curta ou fraca é recusada com o motivo específico da regra violada | CA-07 | Cada regra de força tem rótulo próprio no motivo devolvido: comprimento, dado pessoal, sequência consecutiva e repetição são distinguíveis por quem chama, e a senha reprovada não passa a valer. | {'descricao': 'Uma senha por regra, mais a fronteira de comprimento em 9.', 'valores': {'pessoa': {'nome': 'Marina Duarte', 'email': 'marin… | Nas cinco linhas: `aprovada = false` e `motivos` igual a `[<rótulo da linha>]` — em particular, `K9mvt#Qzp` (9 caracteres) devolve `COMPRIMENTO_MINIMO`, e nenhum motivo carrega a… | — | — |

### 19.2 Testes de Integração

#### Dados — `packages/db`

Setup: Instância efêmera migrada, conexão pelo papel `sysloc_app`; Semente: empresas A e B, 2 vínculos de acesso em A e 3 em B, com identificadores conhecidos

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-003 | Consulta no contexto da empresa A devolve exatamente as linhas de A e nenhuma de B | CA-01 | Dentro de uma unidade de trabalho com `app.empresa_id` fixado na empresa A, toda leitura em `negocio` devolve o conjunto exato de identificadores de A e nenhum de B — sem que nenhum repositório apliq… | Para cada cenário da tabela, escrever o contexto da empresa no `AsyncLocalStorage` pelo escritor público; Abrir a unidade de trabalho e ler a tabela inteira, sem cláusula de empre… | No contexto de A: conjunto devolvido igual a `{acesso-A-1, acesso-A-2}`, interseção com `{acesso-B-1, acesso-B-2, acesso-B-3}` vazia. No contexto de B: conjunto igual a `{acesso-B… | sem análogo — (b) construir pelo caminho real: a carga inicial de `packages/db/src/semente.ts`, que é o mesmo caminho que a op… |
| CT-004 | No contexto de A, gravar linha da empresa B é recusado pelo banco e nada é gravado | CA-02 | Com o contexto fixado em A, `INSERT` com `empresa_id` de B é recusado por `WITH CHECK`, e `UPDATE`/`DELETE` sobre linha de B afetam zero linhas — o estado de B, lido em seguida no contexto de B, é bi… | Tomar o snapshot do estado de B (conjunto de linhas completo) no contexto de B; Fixar o contexto em A e abrir a unidade de trabalho; Executar o `INSERT` com `empresa_id` de B e ca… | O `INSERT` levanta erro do banco com SQLSTATE `42501` e mensagem contendo 'row-level security policy'. O `UPDATE` afeta `0` linhas e o `DELETE` afeta `0` linhas, ambos sem levanta… | imite `CT-003, no mesmo arquivo `packages/db/test/isolamento.spec.ts``: (a) imitar o CT-003: mesma semente pelo caminho real e mesmo escritor público de contexto. A leitura de conferência do estado d… |
| CT-005 | Sem empresa no contexto — o caso do Sysloc Master — toda leitura de negócio é vazia e toda gravação é recusada | CA-05, CA-02 | Quando o contexto não carrega empresa (`app.empresa_id` não fixado, ou fixado em cadeia vazia), `nullif(current_setting('app.empresa_id', true),'')::uuid` é nulo, nenhuma política casa: toda leitura… | Para cada cenário, abrir a unidade de trabalho no contexto sem empresa; Ler `negocio.acesso_usuario_app` e `negocio.acesso_usuario_permissao` inteiras; Afirmar que ambas devolvem… | Leitura devolve `[]` (zero linhas) nas duas tabelas e nos dois cenários, com status de sucesso e sem exceção. O `INSERT` levanta SQLSTATE `42501`. A contagem em A permanece exatam… | imite `CT-003, no mesmo arquivo`: (b) construir pelo boundary real: usar o mesmo escritor público do `AsyncLocalStorage` que a guarda usa, passando o contexto sem empresa que o tipo já admite (a §4.2… |
| CT-006 | Vincular informação de A a informação de B é recusado pela chave estrangeira composta | CA-04 | `negocio.acesso_usuario_permissao` só aceita `acesso_id` cujo par `(acesso_id, empresa_id)` exista em `negocio.acesso_usuario_app (id, empresa_id)`; apontar para um acesso de outra empresa viola a ch… | Fixar o contexto em A e gravar a permissão legítima; afirmar que gravou; Ainda no contexto de A, gravar a permissão cruzada e capturar o erro; Afirmar o SQLSTATE e o nome da restr… | A gravação legítima resulta em 1 linha. A cruzada levanta erro com SQLSTATE `23503`, mensagem contendo o nome da restrição composta `(acesso_id, empresa_id)` referenciando `acesso… | imite `CT-003, no mesmo arquivo `packages/db/test/isolamento.spec.ts``: (a) imitar o CT-003: semente pelo caminho real e contexto pelo escritor público. O identificador do acesso de B é obtido lendo-… |
| CT-007 | Isolamento removido de propósito faz a suíte de isolamento REPROVAR | CA-03 | Aplicado o mutante que remove o isolamento — política derrubada, ou `NO FORCE ROW LEVEL SECURITY` — os casos CT-003, CT-004, CT-005 e CT-006 reprovam; com o schema íntegro, os quatro passam. A suíte… | Rodar a bateria CT-003 a CT-006 sobre o schema íntegro, capturando resultados — controle; Aplicar o mutante 1 pela conexão de migração; Rodar a bateria de novo e capturar quais pr… | Controle: os 4 casos passam. Mutante 1 (política derrubada): o CT-003 reprova porque a leitura no contexto de A devolve também os 3 identificadores de B, e o CT-004 reprova porque… | imite `CT-002 (mesmo padrão de captura de reprovação em vez de deixá-la abortar o caso)`: (b) usar o acessório `conexaoDeMigracao()` do helper `banco-efemero.ts` (mesma origem do CT-002) numa instânc… |
| CT-008 | Guarda de catálogo aprova o schema íntegro sem apontar exceção | CA-16 | Sobre o schema produzido por `0000_fundacao.sql` + `0001_seguranca.sql`, a consulta de cobertura devolve lista vazia de exceções, e a contagem de tabelas de `negocio` que ela examinou é maior que zer… | Aplicar as duas migrações na instância efêmera; Invocar a guarda de catálogo pela API pública de `@sysloc/db`; Afirmar que a lista de exceções é vazia; Afirmar que a lista de tabe… | Exceções: `[]`. Tabelas examinadas: conjunto exatamente igual a `{acesso_usuario_app, acesso_usuario_permissao}`. Guarda retorna o resultado sem levantar exceção. | — |
| CT-009 | Tabela de negócio nascida sem isolamento faz a verificação reprovar apontando a tabela | CA-16 | Criada em `negocio` uma tabela com qualquer um dos três defeitos — sem `empresa_id`, sem RLS forçada, sem a restrição única `(id, empresa_id)` — a guarda de catálogo devolve exceção nomeando aquela t… | Para cada variante, criar a tabela defeituosa pela conexão de migração; Invocar a guarda de catálogo; Afirmar que a lista de exceções contém exatamente uma entrada, com o nome da… | Variante 1: exceções = `[{ tabela: 'negocio.sem_empresa', motivo: 'SEM_COLUNA_EMPRESA' }]`. Variante 2: `[{ tabela: 'negocio.sem_forca', motivo: 'RLS_NAO_FORCADA' }]`. Variante 3:… | imite `CT-007 (mesma origem de conexão privilegiada e mesmo isolamento por instância dedicada)`: (b) usar `conexaoDeMigracao()` do helper `banco-efemero.ts`, numa instância efêmera dedicada a este ca… |
| CT-010 | Contexto de tenant não vaza entre requisições na conexão reaproveitada da reserva | CA-01, CA-02 | `SET LOCAL app.empresa_id` morre com a transação: numa segunda unidade de trabalho aberta sobre a MESMA conexão física, o valor lido de `current_setting('app.empresa_id', true)` não é o da unidade an… | Abrir a unidade 1 no contexto de A, ler `pg_backend_pid()` e as linhas visíveis; Abrir a unidade 2 sem contexto, ler `pg_backend_pid()`, `current_setting('app.empresa_id', true)`… | Os três `pg_backend_pid()` são o mesmo número. Unidade 1: `{acesso-A-1, acesso-A-2}`. Unidade 2: `current_setting` devolve cadeia vazia ou nulo e a leitura devolve `[]`. Unidade 3… | sem análogo — (b) provar pelo boundary real: reduzir a reserva de conexões do `postgres.js` a UMA (opção de configuração legítima, a mesma que a produção usa com valo… |

#### Identidade — `packages/auth`

Setup: Instância efêmera migrada e semeada; Pessoa ativa em empresa ativa, com senha conhecida

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-015 | Cinco falhas consecutivas gravam o bloqueio na conta; a quarta não bloqueia e o sucesso zera o contador | CA-08 | O contador de tentativas vive na própria conta: após a 4ª falha consecutiva `bloqueado_ate` continua nulo; na 5ª ele recebe instante no futuro; uma entrada bem-sucedida zera `tentativas_falhas` e lim… | Executar 4 tentativas com a senha errada, passando pela barreira de admissão; Ler `tentativas_falhas` e `bloqueado_ate` da conta; Executar a 5ª tentativa com a senha errada; Ler a… | Após a 4ª: `tentativas_falhas = 4` e `bloqueado_ate = null`. Após a 5ª: `tentativas_falhas = 5` e `bloqueado_ate` estritamente maior que o instante corrente. Após a entrada bem-su… | sem análogo — (b) construir pelo caminho real: a conta nasce da carga inicial `packages/db/src/semente.ts`, com a senha definida pelo mesmo caminho de derivação que a… |

#### Identidade — `packages/auth` + `apps/api`

Setup: Servidor HTTP real em porta dinâmica, contra instância efêmera migrada e semeada; `identidade.tentativa_login` vazia no início

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-025 | Toda tentativa de entrada é registrada com autor, momento, origem e desfecho | CA-14 | Cada tentativa de entrada — sucesso, credencial incorreta, recusa por bloqueio e e-mail inexistente — grava exatamente uma linha em `identidade.tentativa_login`, com desfecho próprio, momento, origem… | Executar as quatro tentativas pela rota HTTP; Ler a trilha inteira; Afirmar a contagem total de linhas, contando as 5 falhas usadas para produzir o bloqueio; Afirmar, linha a linh… | Contagem total exata e conhecida (4 tentativas do caso + 5 falhas do preparo do bloqueio = 9 linhas). Desfechos distintos e nomeados para sucesso, credencial incorreta e bloqueio.… | imite `CT-015 e CT-016`: (a) imitar o CT-015 para chegar ao bloqueio por tentativas reais. A leitura da trilha é consulta ao schema `identidade` na instância efêmera — o PRD proíbe superfície de CONS… |

#### Compartilhado — `packages/shared`

Setup: Registrador criado pelo caminho legítimo, com destino em arquivo de diretório temporário próprio (padrão já vigente em `log.spec.ts`)

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-027 | D25 — valor de parâmetro sensível em cadeia de consulta é redigido, preservando o nome do parâmetro e o resto do endereço | CA-15 | O terceiro eixo da entrada única de despacho substitui pelo sentinela o VALOR de parâmetro de cadeia de consulta cujo nome case os radicais sensíveis (`token`, `callbackURL`, `code`, `secret`, `senha… | Para cada combinação de endereço e posição, emitir o evento e esvaziar pelo mecanismo do próprio registrador; Ler a linha JSON e afirmar que o literal do segredo não aparece em ne… | Em todas as combinações: a cadeia `SEGREDO_LITERAL`, o valor de `callbackURL`, `123456` e `abc` estão ausentes da linha inteira; a linha contém `token=[REDIGIDO]`, `callbackURL=[R… | — |
| CT-028 | D25 — endereço legítimo sem parâmetro sensível atravessa o registro byte a byte idêntico | CA-15 | O terceiro eixo é delimitado pelo NOME do parâmetro: endereço sem parâmetro sensível atravessa o registro sem alteração de um único byte, inclusive quando traz `@`, `=` ou `?` no valor de um parâmetr… | Emitir cada endereço legítimo em campo, em mensagem e na posição raiz; Ler a linha e comparar o endereço extraído com o informado, por igualdade literal; Afirmar que o sentinela d… | Os três endereços atravessam idênticos, caractere a caractere, nas três posições; `[REDIGIDO]` ausente de todas as linhas. Sobre a cópia com o padrão largo demais, o caso reprova… | — |

#### Infraestrutura — `deploy/scripts/instalacao`

Setup: Banco descartável criado no cluster real; Guarda de recusa em produção consultada

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-032 | `migrar-banco.sh` é idempotente e não expõe a credencial de migração |  | Executado duas vezes seguidas, o script sai `0` nas duas e a segunda execução não altera nada; e em nenhuma delas a credencial do papel de migração aparece em `argv` de processo filho, em variável ex… | Executar `migrar-banco.sh` contra o banco descartável e capturar código de saída e instantâneo do catálogo; Executar de novo e capturar código de saída e instantâneo; `afirmar_igu… | Códigos de saída `0` e `0`; instantâneos do catálogo idênticos entre a primeira e a segunda execução. Contagem `0` para cada um dos quatro padrões proibidos no fonte. Nenhum `argv… | imite `deploy/scripts/instalacao/verificar-provisionamento.sh CT-001 (dupla execução com comparação de estado) e CT-003 (higiene de credencial: argv, log e árvore versionada)`: (c) mesmo mecanismo já… |

### 19.3 Testes End-to-End (E2E)


#### Fluxo: Conta bloqueada com credencial correta recebe recusa indistinguível da de credencial incorreta (CT-016)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-08
- **Objetivo**: A resposta a uma entrada com credencial correta sobre conta bloqueada é idêntica, campo a campo, à resposta a uma credencial incorreta — mesmo status, mesmo `codigo`, mesma `mensagem`, mesmo conjunto de chaves e ausência de cabeçalho de sessão — de modo que a resposta não confirma a existência da conta.
- **Pré-condições**: Servidor HTTP real em porta dinâmica, contra a instância efêmera migrada e semeada; Conta levada ao bloqueio por 5 tentativas malsucedidas reais
- **Passos**:
  1. Levar a conta ao bloqueio por 5 `POST /v1/auth/sign-in/email` com senha errada
  2. Capturar a resposta da tentativa com credencial CORRETA sobre a conta bloqueada
  3. Capturar a resposta de uma credencial incorreta sobre conta NÃO bloqueada (baseline)
  4. Capturar a resposta de um e-mail inexistente
  5. Comparar as três respostas por igualdade profunda de status, corpo e conjunto de chaves de cabeçalho relevante
- **Validações**: As três respostas são iguais: status `401`, corpo exatamente `{ codigo: 'CREDENCIAL_INVALIDA', mensagem: <mesma cadeia nas três> }` no envelope da ADR-0007, sem `Set-Cookie`, e sem qualquer campo que diferencie os casos (`detalhes` ausente nas três). Nenhuma linha nova em `identidade.sessao`.
- **Observação**: Arquivo novo proposto: `apps/api/test/autenticacao.e2e.spec.ts` (§3.4). Comparar as respostas ENTRE SI, e não cada uma contra um literal, é o que prova a indistinguibilidade: dois literais escritos à mão continuariam iguais mesmo se o SUT divergisse em ambos. Este é o ponto crítico 5 declarado na i…


#### Fluxo: Pessoa desativada e empresa suspensa recebem a mesma recusa, e nenhuma sessão é criada (CT-017)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-13
- **Objetivo**: Pessoa desativada e pessoa de empresa suspensa, ambas com credencial correta, recebem resposta idêntica à de credencial incorreta e não têm sessão criada — nem o corpo nem o tempo de resposta permitem distinguir qual predicado recusou.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente com: pessoa ativa em empresa ativa; pessoa desativada em empresa ativa; pessoa ativa em empresa suspensa — as três com a MESMA senha conhecida
- **Passos**:
  1. Contar as linhas de `identidade.sessao` antes das requisições
  2. Executar as três requisições
  3. Comparar as respostas dos dois primeiros cenários com a do baseline, por igualdade profunda
  4. Contar as linhas de `identidade.sessao` de novo
  5. Afirmar que a trilha registrou as três tentativas com desfecho de recusa
- **Validações**: As três respostas são iguais: `401` com corpo `{ codigo: 'CREDENCIAL_INVALIDA', mensagem: <mesma cadeia> }`, sem `Set-Cookie`. A contagem de `identidade.sessao` é idêntica antes e depois. `identidade.tentativa_login` ganhou exatamente 3 linhas, todas com desfecho de recusa.
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. A asserção sobre a contagem de sessões é o que impede a versão frouxa ('respondeu 401') de passar enquanto uma sessão é criada em silêncio por caminho paralelo — o CT-026 fecha essa classe de forma estrutural.


#### Fluxo: Pessoa ativa em empresa ativa entra, é identificada individualmente e tem a empresa fixada pela sessão (CT-018)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-06, CA-01
- **Objetivo**: Credencial correta de pessoa ativa em empresa ativa produz sessão que identifica a pessoa e fixa a empresa: `GET /v1/sessao` devolve o usuário e a empresa dela, e uma leitura de negócio na mesma sessão devolve apenas dados dessa empresa — sem que o pedido carregue empresa alguma.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente: empresas A e B com vínculos de acesso próprios; pessoa ativa em A
- **Passos**:
  1. Executar `POST /v1/auth/sign-in/email` com a credencial correta
  2. Afirmar status e atributos do cookie devolvido
  3. Reenviar o cookie em `GET /v1/sessao` e afirmar o corpo campo a campo
  4. Com o mesmo cookie, executar a leitura de negócio disponível e afirmar o conjunto de identificadores devolvido
  5. Repetir a leitura com uma sessão da empresa B e afirmar que o conjunto é o de B
- **Validações**: Entrada: `200` com `Set-Cookie` marcado `HttpOnly`, `Secure` e `SameSite=Lax`. `GET /v1/sessao`: `200` com `{ usuarioId: <id da pessoa>, nome, email: 'usuario.a@exemplo.com.br', perfil: 'ADMIN_EMPRESA', empresaId: <id de A>, empresaNome: <nome de A>, senhaProvisoria: false, segundoFatorPendente: false }` — exatamente…
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. O eixo de 'fixar a empresa' precisa da leitura de negócio: provar só o corpo de `/v1/sessao` demonstraria que a sessão CARREGA a empresa, não que ela GOVERNA o alcance do dado — que é o que o CA-06 pede e o que a ADR-0008 impõe.


#### Fluxo: O Sysloc Master só conclui o acesso após o segundo fator; sem ele nenhuma sessão plena existe (CT-019)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-09
- **Objetivo**: Para o perfil Master, a senha correta sozinha não produz sessão plena: enquanto o segundo fator não é satisfeito, a sessão é restrita e qualquer rota fora do conjunto permitido responde `403`; com código TOTP válido a sessão passa a plena, e com código inválido ela permanece restrita.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente com um Sysloc Master (`empresa_id` nulo) e senha conhecida
- **Passos**:
  1. Entrar com a senha correta do Master ainda sem segundo fator ativo
  2. Afirmar que `GET /v1/sessao` responde `200` com `segundoFatorPendente: true` e que uma rota de negócio responde `403`
  3. Configurar o segundo fator pelas rotas públicas e afirmar que a restrição cai
  4. Encerrar a sessão e entrar de novo, agora com segundo fator ativo
  5. Afirmar que a resposta é o desafio e que ainda não há sessão plena
  6. Submeter o código inválido e depois o mal formatado, afirmando as recusas e a permanência da restrição
  7. Submeter o código válido e afirmar que a sessão passou a plena
- **Validações**: Antes do segundo fator: `GET /v1/sessao` = `200` com `segundoFatorPendente: true`; rota de negócio = `403` com `{ codigo: 'ACESSO_NEGADO', mensagem: <nomeia a exigência de segundo fator> }`. Código `000000`: `401` `CREDENCIAL_INVALIDA`, sessão ainda restrita. Código `12a4`: `422` `CAMPO_INVALIDO`, sessão ainda restrit…
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. Cobre o ponto em aberto 2 do tech-alignment (§5): a barreira marca o Master sem segundo fator como RESTRITO em vez de recusá-lo, o que resolve o impasse do primeiro acesso sem abrir janela de obrigatoriedade — e este caso é a prova de que a janela n…


#### Fluxo: Sysloc Master autenticado consultando qualquer dado de negócio recebe vazio, não erro (CT-020)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-05
- **Objetivo**: Com sessão plena de Master, toda consulta a dado de negócio devolve `200` com conjunto vazio, em qualquer empresa e em qualquer tabela — sem mensagem que sugira existir algo do outro lado e sem ramo de aplicação que trate o Master à parte.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente com empresas A e B povoadas e um Master com segundo fator ativo
- **Passos**:
  1. Obter sessão plena de Master
  2. Consultar cada rota de leitura de negócio
  3. Afirmar `200` e corpo vazio em todas
  4. Afirmar que nenhum corpo de resposta contém mensagem de erro, código de erro ou indicação de existência
  5. Repetir com a sessão do Admin de A e afirmar corpo não vazio igual aos identificadores de A
- **Validações**: Master: `200` com corpo `[]` em todas as rotas de leitura de negócio, nenhum campo `codigo` nem `mensagem` presente. Admin de A: `200` com o conjunto exato dos identificadores de A na mesma rota. `GET /v1/sessao` do Master devolve `empresaId: null` e `empresaNome: null`.
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. O CT-005 prova a mesma invariante na camada de dados; este a prova atravessando guarda, unidade de trabalho e política, que é onde o defeito 'ramo especial para o Master' se instalaria. Não é duplicação cross-layer: o CT-005 não passa pela guarda e…


#### Fluxo: Senha provisória obriga a troca antes de qualquer outra ação, e após a troca deixa de valer (CT-021)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-10
- **Objetivo**: Enquanto a senha em uso for provisória a sessão é restrita: apenas `GET /v1/sessao`, a troca de senha e a configuração do segundo fator respondem; toda outra rota responde `403` nomeando a exigência. Concluída a troca, a restrição cai sem novo login e a senha provisória não autentica mais.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente com pessoa ativa, em empresa ativa, com `senha_provisoria = true` e senha conhecida
- **Passos**:
  1. Entrar com a senha provisória e afirmar `200` com `senhaProvisoria: true`
  2. Para cada rota permitida, afirmar que a resposta não é `403`
  3. Para cada rota proibida, afirmar `403` com o envelope e a exigência nomeada
  4. Trocar a senha pela rota de troca, com o MESMO cookie (sem novo login)
  5. Afirmar que `GET /v1/sessao` passa a devolver `senhaProvisoria: false` e que as rotas antes proibidas respondem normalmente
  6. Encerrar a sessão e tentar entrar de novo com a senha provisória antiga
- **Validações**: Antes da troca: rotas proibidas respondem `403` com `{ codigo: 'ACESSO_NEGADO', mensagem: <nomeia a troca de senha pendente> }`; rotas permitidas não respondem `403`. Após a troca, com o mesmo cookie: `GET /v1/sessao` devolve `senhaProvisoria: false` e a leitura de negócio devolve `200` com os identificadores da empre…
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. O eixo 'a provisória deixa de valer' precisa da tentativa de reentrada com a senha antiga — sem ela, a asserção provaria que a nova funciona, não que a velha morreu, que é a metade do CA-10 que importa em segurança. A queda da restrição SEM novo log…


#### Fluxo: Troca obrigatória com senha nova curta ou fraca é recusada com o motivo, e a exigência permanece (CT-022)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-10, CA-07
- **Objetivo**: A troca obrigatória aplica a mesma política de força da definição de senha: senha nova reprovada devolve `422` com o motivo específico e não passa a valer — a pessoa permanece na sessão restrita e a senha provisória continua sendo a que autentica.
- **Pré-condições**: Mesmas do CT-021, com a sessão restrita já aberta
- **Passos**:
  1. Para cada linha, chamar a rota de troca com o cookie da sessão restrita
  2. Afirmar o status e o corpo da recusa
  3. Após as três, afirmar que `GET /v1/sessao` ainda devolve `senhaProvisoria: true`
  4. Afirmar que uma rota de negócio ainda responde `403`
  5. Afirmar que a senha PROVISÓRIA ainda autentica numa nova entrada, e que nenhuma das três senhas recusadas autentica
- **Validações**: Nas três linhas: `422` com corpo `{ codigo: 'CAMPO_INVALIDO', mensagem: <mensagem canônica>, campo: 'senha', detalhes: <objeto contendo o rótulo da linha> }`. Depois delas: `senhaProvisoria: true`, rota de negócio em `403`, entrada com a provisória em `200` e entrada com qualquer uma das três recusadas em `401`.
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. O último passo (nenhuma das recusadas autentica) é o que impede o defeito silencioso mais perigoso da troca: gravar a senha nova e SÓ DEPOIS reprovar a validação, devolvendo `422` com o estado já alterado. Sem ele, a resposta correta esconderia a pe…


#### Fluxo: Encerrar a sessão invalida o acesso imediatamente (CT-023)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-11
- **Objetivo**: Depois de `POST /v1/auth/sign-out`, o mesmo cookie deixa de autenticar na requisição seguinte e a linha correspondente some de `identidade.sessao` — a invalidação é de estado no banco, não de expiração do cookie no cliente.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Sessão ativa obtida por entrada legítima
- **Passos**:
  1. Afirmar que `GET /v1/sessao` com o cookie responde `200`
  2. Contar as linhas de `identidade.sessao` do usuário
  3. Executar `POST /v1/auth/sign-out` com o cookie
  4. Repetir `GET /v1/sessao` com o MESMO cookie e afirmar a recusa
  5. Contar de novo as linhas de `identidade.sessao`
  6. Repetir com o cookie de token inexistente e comparar as duas respostas de recusa
- **Validações**: Antes: `200` e 1 linha em `identidade.sessao`. Depois do encerramento: `GET /v1/sessao` = `401` com `{ codigo: 'NAO_AUTENTICADO', mensagem: 'sessão inválida ou expirada' }`, e 0 linhas em `identidade.sessao` para aquele usuário. A resposta ao cookie de token inexistente é idêntica, campo a campo, à do cookie encerrado.
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. A contagem no banco é o que distingue 'invalidou' de 'apenas mandou o navegador esquecer o cookie' — a segunda passaria a asserção de status e deixaria a sessão viva para quem guardou o valor.


#### Fluxo: Sessão sem atividade além do máximo é recusada e exige nova entrada; atividade dentro do prazo a renova (CT-024)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-12
- **Objetivo**: Passado o período máximo sem atividade, a próxima requisição com o cookie é recusada e exige nova entrada; uma requisição feita dentro do prazo renova a expiração persistida, adiando o vencimento.
- **Pré-condições**: Servidor HTTP real em porta dinâmica, com o arcabouço instanciado com duração de sessão curta pela opção de configuração legítima; Constante nomeada de limite de sondagem declarada no topo do arquivo
- **Passos**:
  1. Entrar e capturar o `expires_at` persistido da sessão
  2. Fazer uma requisição autenticada dentro do prazo e afirmar `200`
  3. Reler o `expires_at` e afirmar que é estritamente maior que o anterior
  4. Sondar, com o limite declarado, até que o `expires_at` corrente esteja no passado
  5. Fazer nova requisição com o mesmo cookie e afirmar a recusa
  6. Entrar de novo com a credencial correta e afirmar que a nova sessão funciona
- **Validações**: Requisição dentro do prazo: `200`, e `expires_at` novo estritamente maior que o anterior. Após o vencimento: `401` com `{ codigo: 'NAO_AUTENTICADO', mensagem: 'sessão inválida ou expirada' }`. Nova entrada: `200`, com uma linha nova em `identidade.sessao`. Nenhuma espera de tempo fixo aparece no caso.
- **Observação**: Mora em `apps/api/test/autenticacao.e2e.spec.ts`. O eixo de renovação é obrigatório: um SUT que expirasse a sessão em tempo absoluto desde a criação (sem renovar por atividade) passaria o eixo negativo e violaria a RN-07 em silêncio.


#### Fluxo: Não existe caminho paralelo de emissão de sessão: todo caminho do arcabouço instalado passa pela barreira de admissão (CT-026)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-06, CA-09, CA-13
- **Objetivo**: Para um usuário que a barreira recusa, NENHUM dos caminhos de emissão de sessão publicados pelo arcabouço instalado produz linha em `identidade.sessao`; e o conjunto desses caminhos é fechado e conhecido, de modo que uma versão nova do arcabouço que acrescente um caminho faz a verificação reprovar.
- **Pré-condições**: Servidor HTTP real em porta dinâmica; Semente com um usuário para cada predicado de recusa da barreira
- **Passos**:
  1. Obter a lista de caminhos publicados pelo manipulador do arcabouço
  2. Classificar quais emitem sessão e afirmar que o conjunto é exatamente o esperado — a lista é constante nomeada no topo do arquivo
  3. Para cada par (caminho emissor × usuário recusado), executar a requisição com credencial correta
  4. Contar `identidade.sessao` antes e depois do produto cartesiano inteiro
  5. Afirmar que cada resposta é a recusa canônica
  6. Gerar cópia com um caminho emissor acrescentado à superfície e demonstrar que a asserção de conjunto reprova
- **Validações**: Conjunto de caminhos emissores exatamente igual à constante declarada. Contagem de `identidade.sessao` idêntica antes e depois de todas as combinações. Cada resposta é `401` com `{ codigo: 'CREDENCIAL_INVALIDA', mensagem: <a mesma cadeia do CT-016> }`. Sobre a cópia com caminho acrescentado, a asserção de conjunto rep…
- **Observação**: Arquivo novo proposto: `packages/auth/test/superficie-publica.spec.ts` para o eixo estático (conjunto fechado de caminhos e não-exportação dos internos) e `apps/api/test/autenticacao.e2e.spec.ts` para o eixo comportamental (produto cartesiano). Atende à obrigação de PROVA declarada em D6 do tech-al…


#### Fluxo: Nenhum segredo de autenticação legível no registro durante o fluxo real de entrada (CT-029)
- **Framework**: Vitest 4 exercitando HTTP real contra servidor em porta dinâmica (padrão de `apps/api/test/saude.e2e.spec.ts`)
- **CA**: CA-15
- **Objetivo**: Percorrido o fluxo real de autenticação — entrada bem-sucedida, entrada recusada, rota inexistente sob `/v1/auth` com segredo na cadeia de consulta — nenhuma linha do registro do processo contém senha, código de segundo fator, token de sessão ou código de recuperação em forma legível.
- **Pré-condições**: Servidor HTTP real em porta dinâmica, com o registrador apontado a arquivo temporário próprio; Semente com pessoa ativa e senha conhecida
- **Passos**:
  1. Executar as quatro requisições
  2. Esvaziar e ler o arquivo de registro inteiro
  3. Afirmar a ausência literal da senha, do código de segundo fator, do valor do cookie de sessão e do literal do segredo na cadeia de consulta
  4. Afirmar que as linhas correspondentes existem — que o registro não ficou mudo
  5. Afirmar que a linha da rota inexistente carrega o nome do parâmetro com o valor redigido
- **Validações**: Nenhuma ocorrência de `chuva7Longe!`, do código de segundo fator informado, do valor do cookie de sessão nem de `SEGREDO_LITERAL` no arquivo inteiro. Ao menos uma linha por requisição está presente, com nível e evento próprios (a recusa de admissão em `warn`, nomeando o predicado). A linha da rota inexistente contém `…
- **Observação**: Arquivo novo proposto: `apps/api/test/autenticacao.e2e.spec.ts`. É a rede do P4 do Protocolo Antirregressão para o D25 fechado nesta fatia: o CT-027 prova o eixo na unidade, este prova que o eixo alcança o caminho real onde o vazamento foi observado. A asserção 'o registro não ficou mudo' é obrigat…

### 19.4 Cenários de Erro e Segurança

| CT | Cenário | CA | Objetivo (invariante) | Trigger | Resultado esperado |
|---|---|---|---|---|---|
| CT-001 | A conexão que a suíte de isolamento usa não tem privilégio capaz de contornar a política | CA-17 | A conexão sobre a qual toda prova de isolamento roda pertence a um papel com `rolsuper = false`, `rolbypassrls = false`, sem pertencimento (direto ou herdado) ao papel dono, e que não é `ta… | {'descricao': 'Nenhuma entrada de negócio: as consultas são ao catálogo do sistema, sobre a identidade da própria conexão.', 'valores': {'c… | `current_user = 'sysloc_app'`; `rolsuper = false`, `rolbypassrls = false`, `rolcreaterole = false`; `pg_has_role(current_user,'sysloc_migracao','MEMBER') = false`; `tableowner = '… |
| CT-002 | Execução privilegiada não passa por verde: com o papel dono, a bateria de papel e as provas de isolamento reprovam | CA-17, CA-03 | Executada sobre uma conexão privilegiada (papel dono das tabelas, ou superusuário do cluster), a bateria do CT-001 reprova em cada predicado e a leitura cross-tenant do CT-003 devolve linha… | {'descricao': 'As mesmas consultas do CT-001 e do CT-003, com a conexão trocada por uma privilegiada.', 'valores': {'conexao_1': 'papel sys… | Sobre o papel dono: a bateria reprova nomeando `tableowner = 'sysloc_migracao' = current_user`. Sobre o superusuário: reprova nomeando `rolsuper = true` e `rolbypassrls = true`. E… |
| CT-012 | `@sysloc/db` não oferece caminho de acesso a dado fora da unidade de trabalho | CA-02 | O índice público de `@sysloc/db` expõe um conjunto fechado e conhecido de símbolos, no qual não há cliente, reserva de conexões nem executor cru — escrever consulta sem contexto de tenant é… | {'descricao': 'O conjunto de nomes exportados pelo índice, e o valor de cada um.', 'valores': {'esperado': 'conjunto fechado declarado no p… | Conjunto exportado exatamente igual ao esperado (unidade de trabalho, escritor/leitor de contexto, guarda de catálogo, schema e tipos). Nenhum valor exportado possui as propriedad… |
| CT-030 | No cluster real, os dois papéis existem e nenhum deles tem privilégio capaz de contornar o isolamento | CA-17 | Depois do provisionamento, `sysloc_app` e `sysloc_migracao` existem, ambos com `rolsuper = f` e `rolbypassrls = f`, e `sysloc_app` não é membro de `sysloc_migracao` — no cluster real, não s… | {'descricao': 'Consulta ao catálogo do cluster real, por papel.', 'valores': {'consulta': "SELECT rolname, rolsuper, rolbypassrls, rolcreat… | Contagem de papéis encontrados = `2`. Para `sysloc_app` e `sysloc_migracao`: `rolsuper = f`, `rolbypassrls = f`, `rolcreaterole = f`. `pg_has_role('sysloc_app','sysloc_migracao','… |
| CT-031 | No cluster real, toda tabela de negócio tem isolamento forçado e pertence ao papel de migração | CA-16 | Aplicadas as migrações no cluster real, nenhuma tabela do schema `negocio` fica sem RLS habilitada e forçada, sem política com `USING` e `WITH CHECK`, sem `empresa_id` não nulo ou sem a res… | {'descricao': 'Consulta de cobertura sobre o catálogo, mais o mutante em banco descartável.', 'valores': {'eixos': ['relrowsecurity', 'relf… | No banco `sysloc`: 0 exceções, 2 tabelas examinadas (`acesso_usuario_app`, `acesso_usuario_permissao`), `tableowner = sysloc_migracao` nas duas, código de saída `0`. Contra o banc… |

Cenários de erro detalhados nas subseções anteriores, listados aqui para leitura conjunta (cada CT pertence a uma única camada):

| CT | Cenário | CA | Onde está detalhado |
|---|---|---|---|
| CT-004 | No contexto de A, gravar linha da empresa B é recusado pelo banco e nada é gravado | CA-02 | 19.2 |
| CT-005 | Sem empresa no contexto — o caso do Sysloc Master — toda leitura de negócio é vazia e toda gravação é recusada | CA-05, CA-02 | 19.2 |
| CT-007 | Isolamento removido de propósito faz a suíte de isolamento REPROVAR | CA-03 | 19.2 |
| CT-009 | Tabela de negócio nascida sem isolamento faz a verificação reprovar apontando a tabela | CA-16 | 19.2 |
| CT-010 | Contexto de tenant não vaza entre requisições na conexão reaproveitada da reserva | CA-01, CA-02 | 19.2 |
| CT-014 | Senha curta ou fraca é recusada com o motivo específico da regra violada | CA-07 | 19.1 |
| CT-015 | Cinco falhas consecutivas gravam o bloqueio na conta; a quarta não bloqueia e o sucesso zera o contador | CA-08 | 19.2 |
| CT-022 | Troca obrigatória com senha nova curta ou fraca é recusada com o motivo, e a exigência permanece | CA-10, CA-07 | 19.3 |
| CT-024 | Sessão sem atividade além do máximo é recusada e exige nova entrada; atividade dentro do prazo a renova | CA-12 | 19.3 |
| CT-028 | D25 — endereço legítimo sem parâmetro sensível atravessa o registro byte a byte idêntico | CA-15 | 19.2 |

### 19.5 Notas do gerador de casos

**Cenários deliberadamente não cobertos:**

- **Carga e concorrência sobre o contador de tentativas malsucedidas (duas requisições simultâneas na mesma conta)** — A §7.4 da tech spec resolve o problema por construção — o incremento acontece no próprio `UPDATE`, sem leitura prévia, o que o torna correto sob concorrência sem bloqueio explícito. Testar corrida aqui provaria o motor do banco, não o SUT. Registrado como risco conhecido, não como lacuna de prova.
- **Latência p95 da entrada (< 400 ms) e da requisição autenticada (< 80 ms), declaradas na §12.1** — Teste de desempenho está fora do escopo da geração de casos e a máquina de verificação não é a de operação. A meta de entrada é dominada pela derivação de senha, deliberadamente cara — medi-la numa máquina compartilhada produziria número sem significado e caso instável.
- **Encerramento imediato de sessões JÁ ABERTAS ao suspender empresa ou desativar pessoa** — Explicitamente fora do escopo pelo PRD §4.2 (decisão 11): esta fatia entrega a barreira na ENTRADA; derrubar sessão viva é da fatia `autorizacao-e-ciclo-de-acesso`. Gerar caso aqui anteciparia comportamento que o SUT não deve ter.
- **Emissão da senha provisória por quem cria a conta, e recuperação de senha esquecida** — Fora do escopo pelo PRD §4.2 — a emissão é da fatia seguinte e a recuperação depende de canal de e-mail, que nasce na Fase 3. Nesta fatia só existe a obrigação de trocar, coberta por CT-021 e CT-022.
- **Confidencialidade contra quem tem acesso administrativo ao servidor ou ao banco** — Limite declarado e aceito pela decisão 16 (PRD §9). É risco aceito e documentado, não defeito — e a §9 do PRD pede explicitamente que continue legível assim para não ser reaberto como problema em revisão futura.
- **Consulta ao registro de tentativas de entrada por superfície de produto** — O PRD §4.2 declara que a trilha não é consultável nesta fatia. O CT-025 observa o estado persistido pela verificação, o que é legítimo; testar uma rota de consulta seria testar recurso que não deve existir.

**Recomendações para a fase de tasks:**

- Resolver, antes da task de `senha.ts`, o ponto em aberto 1 do tech-alignment (§5): o critério concreto de força além do comprimento. Os CT-013/CT-014 estão escritos sobre as quatro regras que a §6.3 (RN-05) já fixa — comprimento, dado pessoal, sequência de 4 consecutivos, repetição de 4 iguais. Se o produto alterar o critério, os dois casos e a tabela de rótulos precisam ser reescritos ANTES da implementação, não de…
- O helper `packages/db/test/banco-efemero.ts` é o ponto de maior alavancagem desta fatia e o de maior risco: ele ENVOLVE `packages/shared/test/postgres-efemero.ts` (marcado 'não alterar' na §3.7) e é quem separa a cadeia do papel `sysloc_app` da cadeia privilegiada. Recomenda-se que ele seja a primeira task da fatia e que a conexão privilegiada seja oferecida por acessório com nome que denuncie o privilégio (`conexao…
- Preservar o `_run/test-cases.json` desta geração: os casos de mutante (CT-002, CT-007, CT-009, CT-031) e os de prova de falsificação (CT-012, CT-026, CT-027, CT-028, CT-032) são os primeiros candidatos a serem cortados por pressão de prazo, e são exatamente os que impedem o modo de falha que o usuário nomeou como o mais perigoso da fatia — uma suíte verde que não prova nada.
- Os CT-030, CT-031 e CT-032 rodam na frente shell e exigem `sudo` interativo, que nenhum subagente executa (`.claude/rules/testing-stack.md`). Planejar a execução deles junto ao operador e preservar a saída para auditoria do gate; o QA reportará `executou_testes: false` para eles, o que reflete o papel do gate e não suíte pulada.
- Registrar a linha de INVARIANTES do CT-027 e do CT-028 no bloco do topo de `packages/shared/test/log.spec.ts` no MESMO commit que remove o marcador `DÉBITO COM GATILHO` do D25 e a linha correspondente do índice do `CLAUDE.md` — a §3-B do Protocolo Antirregressão exige que os três saiam juntos, e o índice órfão é descrito ali como 'a mesma mentira do marcador órfão'.
- Rodar `pnpm test` e registrar a contagem exata de casos verdes ANTES de tocar `packages/shared/src/log.ts` e `packages/shared/test/log.spec.ts` (P1 do Protocolo Antirregressão) e comparar caso a caso ao fim (P5). São os dois únicos arquivos existentes e provados que esta fatia modifica em conteúdo comportamental — a §20 da tech spec classifica a regressão neles como probabilidade média e impacto alto.
- Os casos foram distribuídos assumindo os arquivos declarados na §3.4 da tech spec. Como nenhum deles existe ainda, todo `existing_suite` de `packages/db` e `packages/auth` traz `NO_SUITE_FOUND` com o arquivo proposto nomeado em `observacoes`; as duas exceções são `packages/shared/test/log.spec.ts` e `deploy/scripts/instalacao/verificar-provisionamento.sh`, que existem e devem ser ESTENDIDOS, nunca substituídos.

Conformidade com `agent-spec-testing-best-practices`: orçamento de dublês respeitado (`mock_budget_observado: true`) e os 7 gates aplicados (invariant_first, owning_layer, real_execution, failure_means_fix_production, no_snapshot_without_contract, no_self_set_mock_assertion, negative_companion). Nenhum erro de leitura de arquivo. `discovery_needed: false` — a stack de teste veio da rule do projeto, não de suposição.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Suíte conectando com papel privilegiado — verde sem provar nada | **alta** | **crítico** | `papel-de-conexao.spec` afirma que a conexão não é superusuário nem dona das tabelas; a suíte de isolamento tem mutante que desabilita a política e deve reprovar (CA-03, CA-17) |
| `FORCE` esquecido numa tabela | média | crítico | Guarda de catálogo reprova a migração e a suíte; verificador shell repete a checagem no cluster real |
| Caminho paralelo do arcabouço criando sessão sem passar pela barreira | média | alto | Teste que enumera os caminhos de emissão de sessão do pacote instalado e afirma que todos passam pela barreira — obrigação declarada em D6 |
| Contexto vazando entre requisições pela reserva de conexões | baixa | crítico | `SET LOCAL` morre com a transação; caso dedicado executa duas requisições de empresas diferentes na mesma conexão reaproveitada |
| Regressão em `log.ts` ao fechar o D25 | média | alto | Baseline antes e depois, prova de falsificação, e nenhuma alteração no que os eixos existentes já redigem |
| Mapeamento de nomes do arcabouço divergindo do schema | média | médio | Migração e configuração do adaptador nascem no mesmo commit; caso de integração exercita entrada real de ponta a ponta |
| `embedded-postgres` em versão beta com comportamento distinto do cluster real | baixa | médio | Verificador shell confere papéis, propriedade e cobertura no cluster real, além da suíte |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

- **ADR-0008 — Isolamento multi-tenant garantido pelo banco** · **APLICÁVEL**. Confronto literal com a `Decision`: *"toda tabela de negócio nasce com `empresa_id`, RLS habilitada com `USING` e `WITH CHECK`, e chave estrangeira composta `(id, empresa_id)`"* → §7.2 e §7.3; *"o contexto que a RLS consome é fixado por transação com `SET LOCAL`, e sua origem nunca é o request"* → §7.4 e §5.2; *"a camada de aplicação não implementa filtro por empresa equivalente"* → §11.2, que declara a ausência como deliberada. Os dois *Cons* da ADR (`FORCE` e papel não-superusuário) são materializados em `0001_seguranca.sql` e no passo novo do provisionamento.
- **ADR-0009 — Fronteira entre identidade e negócio por schema** · **APLICÁVEL**. *"dois schemas: identidade, sem noção de tenant; e negócio, onde toda tabela nasce vinculada a empresa, com RLS habilitada e forçada"* → §7.1 e §7.2; *"a cobertura do isolamento é uma propriedade consultada no catálogo do sistema"* → `catalogo.ts` e `verificar-migracao.sh`. A trilha de tentativas em `identidade` segue o exemplo literal da ADR.
- **ADR-0007 — Forma canônica do contrato da API** · **APLICÁVEL**. Os três códigos novos entram no enum fechado com status semântico (§10.1); o corpo permanece nos quatro campos. Nenhum código existente é renomeado ou removido.
- **ADR-0006 — Ambiente de verificação separado** · **APLICÁVEL**. `packages/db/test/banco-efemero.ts` **envolve** a instância efêmera existente em vez de alterá-la, preservando a propriedade de não ler coordenada de conexão do ambiente — auditada pelo grep canônico de `.claude/rules/testing-stack.md`.
- **ADR-0005 — Rotinas operacionais versionadas com instalação idempotente** · **APLICÁVEL**. `migrar-banco.sh` e o passo novo de `provisionar-base.sh` seguem o padrão; a credencial de migração trafega por `PGPASSFILE`, nunca por `argv` ou variável exportada.
- **ADR-0001** (cobrança), **ADR-0002**, **ADR-0003**, **ADR-0004** (herdados do Frappe) · **N/A** — esta fatia não toca cobrança, estrutura de dados do framework antigo, permissão de DocType nem endpoints herdados.

Nenhum conflito spec × ADR e nenhuma contradição ADR × ADR foi detectada.

### Candidatos a ADR

- **Barreira única de admissão de sessão** — *candidato parcial* (4/5). Passa em C2 (`auth`), C3, C4 e C5; **falha parcialmente em C1**: hoje alcança esta fatia e a seguinte, ambas da mesma capacidade. Reavaliar na entrada da fatia de autorização — se o mesmo padrão reger a decisão de permissão, a transversalidade se confirma. Já registrado como parcial no `tech-alignment.md` §3.
- **Prefixo de versão no caminho desde a primeira rota** — *candidato parcial* (3/5). Passa em C1 e C3; falha em C4 (é a escolha idiomática, não surpreende) e é fraco em C5 (as alternativas foram consideradas, mas nenhuma tinha defesa forte). Fica como decisão desta spec, §15.
- **Guarda global com exceções explícitas e default fechado** — *candidato parcial* (4/5), levantado na sessão de challenge. Passa em C1 (rege toda rota futura do produto), C2 (`security`), C3 (inverter o default obrigaria revisar todos os controladores) e C5 (a alternativa por controlador foi considerada e rejeitada por inverter o default para aberto). **Falha em C4**: é a escolha defensável e pouco surpreendente. Fica como decisão desta spec, §11.1.

### Termos de domínio

Canonizados na sessão de challenge de 2026-08-01. Seis foram para o glossário **global** (`docs/specs/domain-glossary.md`), por aparecerem em ao menos duas features: **Empresa**, **Sysloc Master**, **Admin Empresa**, **Usuário Empresa**, **senha provisória** e **vínculo de acesso**. Um foi para o glossário **da feature** (`docs/specs/features/fundacao-multitenancy-identidade/domain-glossary.md`): **sessão restrita**, que é estado do fluxo de admissão e não vocabulário do produto.

Três ambiguidades foram resolvidas junto: "usuário" (pessoa autenticada × perfil), "empresa"/"tenant" (produto × isolamento no banco) e "sessão pendente" (sessão restrita × desafio de segundo fator, em que **não existe sessão**).

### Trade-offs registrados

- Os caminhos de `/v1/auth/*` preservam o vocabulário do arcabouço, em inglês, para que o cliente oficial funcione sem tradução. É exceção consciente ao invariante 6, limitada às rotas de autenticação; todo recurso do produto — a começar por `/v1/sessao` — fala camelCase em português.
- `acesso_usuario_permissao` nasce vazia. É estrutura sem comportamento, justificada por tornar a FK composta verificável com dado real; povoá-la aqui seria antecipar a fatia 2.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-13 mapeadas em 17)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6)
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8 — N/A justificado)
- [x] Sincronização: eventos, idempotência (seção 9)
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13)
- [x] Feature flags listadas (seção 14 — N/A justificado)
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura (seção 16)
- [x] Dependências externas listadas (seção 18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19)
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4-3.7)
- [x] Pronto para geração das TASKS
