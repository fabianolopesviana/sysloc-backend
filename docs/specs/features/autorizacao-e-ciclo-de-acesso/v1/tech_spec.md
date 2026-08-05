# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: `autorizacao-e-ciclo-de-acesso` — segunda e última fatia da Fase 1
- **Variante**: backend
- **Stack**: Node 24 LTS · TypeScript strict · NestJS + Fastify · Drizzle + drizzle-kit + postgres.js · PostgreSQL 18 · better-auth · Vitest + embedded-postgres
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-04
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/autorizacao-e-ciclo-de-acesso/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/tech-alignment.md` (7 decisões: D1 a D7)

---

## 2. Resumo Técnico da Solução

A autorização nasce como **decisão de um ponto único**: a guarda global que hoje resolve a sessão e fixa o contexto de tenant passa a **consultar** um módulo de decisão publicado em `@sysloc/auth`, sem redefinir a regra ali — o mesmo arranjo que já governa o alcance da sessão restrita. Cada rota declara o que exige em **duas dimensões ortogonais** (perfil e chave do catálogo) por metadado de reflexão, e **a ausência de declaração recusa**; uma verificação de cobertura consulta o roteador montado e reprova se qualquer rota publicada ficar sem declaração.

O **efetivo** de cada pessoa é `(matriz do perfil ∪ concedidas) − negadas`, com a negação vencendo, e viaja em duas colunas de arranjo no registro de sessão junto de `versaoPermissoes`. Cada requisição autenticada compara essa versão com a corrente — que chega na leitura por chave primária de identidade **já existente**, sem consulta nova — e, ao divergir, **relê o efetivo e reescreve o registro de sessão**, atendendo a requisição normalmente. Encerramento de acesso (suspensão de empresa, desativação de pessoa) acontece **na origem do evento**, apagando registros de sessão pelo caminho do arcabouço — nunca por reavaliação na guarda.

Duas migrações: a `0003` gerada do schema (efeito do ajuste, unicidade do trio, contador, colunas do efetivo na sessão, e a **conciliação estrutural** que torna vínculo cross-tenant impossível pelo banco) e a `0004` à mão para o valor novo do enum de desfecho. A fatia fecha cinco débitos herdados — **D7**, **D21**, **D5**, **P-T6-1** e a metade acionável do **P-T6-2**.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                         requisição HTTP
                               │
                    ┌──────────▼───────────┐
                    │  ContextoGuard [M]   │  ponto de aplicação ÚNICO (D1)
                    │  canActivate         │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │ 1. resolve sessão    │ 2. consulta regras    │ 3. fixa tenant
        ▼                      ▼                       ▼
  carregarPessoa        ┌─────────────┐          contextoDeTenant
  DaSessao [M]          │ sessao-     │          + SET LOCAL [R]
  (traz versão          │ restrita[R] │
   e efetivo)           ├─────────────┤
        │               │ autorizacao │  ← decide; NÃO mora na guarda
        │               │   .ts   [N] │
        │               └──────┬──────┘
        │                      │ consulta
        │               ┌──────▼──────────────────────┐
        │               │ catalogo-de-permissoes [N]  │ 17 chaves + mapa ação→tela
        │               │ matriz-de-perfil       [N]  │ default por perfil
        │               │ efetivo                [N]  │ (perfil ∪ conc) − negadas
        │               └─────────────────────────────┘
        │
        └── divergiu a versão? → relê ajustes (sob RLS) → reescreve registro de sessão

  ┌────────────────────── rotas ──────────────────────┐
  │ /v1/master/*  [N]  ciclo de vida da empresa       │ exige PERFIL
  │ /v1/usuarios/*[N]  ciclo de vida das pessoas      │ exige TELA/AÇÃO
  │ /v1/sessao    [M]  + telas, ações, versão         │ marca "não exige"
  │ /v1/sessao/senha [N] troca (substitui a nativa)   │ marca "não exige"
  └───────────────────────────────────────────────────┘
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| `catalogo-de-permissoes` | União fechada das 17 chaves (10 telas + 7 ações) e o mapa total ação→tela (RN-02, RN-15) | domínio (`@sysloc/auth`) |
| `matriz-de-perfil` | Conjunto default de chaves por perfil, derivado do enum do schema | domínio (`@sysloc/auth`) |
| `efetivo` | Cálculo `(perfil ∪ concedidas) − negadas` com precedência da negação (RN-01) | domínio (`@sysloc/auth`) |
| `autorizacao` | Decide se uma sessão alcança uma exigência declarada; **consultado**, nunca embutido | domínio (`@sysloc/auth`) |
| `onboarding` | Geração da Senha provisória e criação de pessoa pelo adaptador (fecha D7) | domínio (`@sysloc/auth`) |
| `permissao` | Leitura e escrita dos ajustes individuais sob contexto de tenant | dados (`@sysloc/db`) |
| `ContextoGuard` | Ponto de aplicação único: resolve sessão, consulta autorização, fixa tenant | apresentação (`apps/api`) |
| `exigencia.decorator` | Metadado por rota nas duas dimensões + marca explícita de "não exige" | apresentação (`apps/api`) |
| `cobertura-de-autorizacao` | Consulta o roteador montado e reprova rota sem declaração (ADR-0011) | apresentação (`apps/api`) |
| `MasterModule` | Ciclo de vida da empresa e admissão de administradores | apresentação (`apps/api`) |
| `UsuariosModule` | Ciclo de vida das pessoas da própria empresa | apresentação (`apps/api`) |
| `SenhaController` | `POST /v1/sessao/senha` — troca na forma do produto (fecha D21) | apresentação (`apps/api`) |

### 3.3 Camadas e Fronteiras

**Layered com fronteira de pacote**, direção de dependência estritamente para dentro: `apps/api` → `@sysloc/auth` → `@sysloc/db` → `@sysloc/shared`. Nenhuma inversão.

Duas fronteiras herdadas e **preservadas**:

- **`apps/api` não sabe montar consulta a `identidade`.** A leitura por chave primária vive em `@sysloc/auth` e é publicada; a aplicação a consome. A Revisão Técnica da fatia anterior rejeitou a forma em que a consulta morava na guarda, porque duas leituras da mesma linha divergem com o tempo. O contador de versão e o efetivo entram **nessa leitura**, não numa segunda.
- **Regra fora do ponto de aplicação.** `autorizacao.ts` decide; `ContextoGuard` pergunta. Uma segunda avaliação em qualquer manipulador é regressão de topologia — e o **CT-216** a reprova por varredura de fontes.

### 3.4 Visão em Árvore

```
apps/
├── api/
│   ├── src/
│   │   ├── app.module.ts                                    [M]
│   │   ├── autenticacao/
│   │   │   ├── autenticacao.controller.ts                   [M]
│   │   │   ├── autenticacao.module.ts                       [M]
│   │   │   ├── contexto.guard.ts                            [M]
│   │   │   ├── cobertura-de-autorizacao.ts                  [N]
│   │   │   ├── exigencia.decorator.ts                       [N]
│   │   │   ├── rota-publica.decorator.ts                    [R]
│   │   │   ├── senha.controller.ts                          [N]
│   │   │   ├── sessao.controller.ts                         [M]
│   │   │   └── sessao-restrita.ts                           [R]
│   │   ├── comum/
│   │   │   └── filtro-excecao.ts                            [R]
│   │   ├── master/
│   │   │   ├── empresa.controller.ts                        [N]
│   │   │   ├── empresa.service.ts                           [N]
│   │   │   └── master.module.ts                             [N]
│   │   ├── saude/
│   │   │   └── saude.controller.ts                          [M]
│   │   └── usuarios/
│   │       ├── usuario.controller.ts                        [N]
│   │       ├── usuario.service.ts                           [N]
│   │       └── usuarios.module.ts                           [N]
│   └── test/
│       ├── autenticacao.e2e.spec.ts                         [M]
│       ├── autorizacao.e2e.spec.ts                          [N]
│       ├── campos-fechados.e2e.spec.ts                      [N]
│       ├── ciclo-de-acesso.e2e.spec.ts                      [N]
│       ├── contexto.e2e.spec.ts                             [M]
│       └── sessao-restrita.e2e.spec.ts                      [M]
packages/
├── auth/
│   ├── src/
│   │   ├── admissao.ts                                      [M]
│   │   ├── autenticacao.ts                                  [M]
│   │   ├── autorizacao.ts                                   [N]
│   │   ├── catalogo-de-permissoes.ts                        [N]
│   │   ├── efetivo.ts                                       [N]
│   │   ├── index.ts                                         [M]
│   │   ├── matriz-de-perfil.ts                              [N]
│   │   ├── onboarding.ts                                    [N]
│   │   └── perfis.ts                                        [R]
│   └── test/
│       ├── auditoria.spec.ts                                [R]
│       ├── autorizacao.spec.ts                              [N]
│       ├── bloqueio.spec.ts                                 [R]
│       └── identidade-efemera.ts                            [M]
├── db/
│   ├── migracoes/
│   │   ├── 0003_autorizacao.sql                             [N]
│   │   └── 0004_desfecho_de_recusa.sql                      [N]
│   ├── src/
│   │   ├── esquema/
│   │   │   ├── identidade.ts                                [M]
│   │   │   └── negocio.ts                                   [M]
│   │   ├── index.ts                                         [M]
│   │   ├── permissao.ts                                     [N]
│   │   └── unidade-de-trabalho.ts                           [R]
│   └── test/
│       ├── banco-efemero.ts                                 [R]
│       ├── isolamento.spec.ts                               [R]
│       ├── permissao.spec.ts                                [N]
│       └── varredura-de-fontes.ts                           [R]
└── shared/
    └── src/
        └── erros.ts                                         [R]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/auth/src/catalogo-de-permissoes.ts` | 17 chaves como união fechada + mapa total ação→tela | domínio |
| `packages/auth/src/matriz-de-perfil.ts` | Default por perfil, sobre o enum do schema | domínio |
| `packages/auth/src/efetivo.ts` | Cálculo do efetivo com precedência da negação | domínio |
| `packages/auth/src/autorizacao.ts` | Decisão consultada pelo ponto de aplicação | domínio |
| `packages/auth/src/onboarding.ts` | Senha provisória e criação de pessoa pelo adaptador | domínio |
| `packages/db/src/permissao.ts` | Leitura/escrita de ajustes sob contexto de tenant | dados |
| `packages/db/migracoes/0003_autorizacao.sql` | **Gerada** — efeito, unicidade do trio, contador, colunas de efetivo na sessão, conciliação estrutural | dados |
| `packages/db/migracoes/0004_desfecho_de_recusa.sql` | **À mão** — valor novo no enum de desfecho (P-T6-1) | dados |
| `apps/api/src/autenticacao/exigencia.decorator.ts` | Metadado de exigência nas duas dimensões + marca "não exige" | apresentação |
| `apps/api/src/autenticacao/cobertura-de-autorizacao.ts` | Verificação de cobertura sobre o roteador montado | apresentação |
| `apps/api/src/autenticacao/senha.controller.ts` | `POST /v1/sessao/senha` | apresentação |
| `apps/api/src/master/master.module.ts` · `empresa.controller.ts` · `empresa.service.ts` | Ciclo de vida da empresa | apresentação |
| `apps/api/src/usuarios/usuarios.module.ts` · `usuario.controller.ts` · `usuario.service.ts` | Ciclo de vida das pessoas | apresentação |
| `packages/auth/test/autorizacao.spec.ts` | CT-201 a CT-205, CT-203 | teste |
| `packages/db/test/permissao.spec.ts` | CT-206 a CT-210, CT-219 | teste |
| `apps/api/test/autorizacao.e2e.spec.ts` | CT-211 a CT-218, CT-220 | teste |
| `apps/api/test/ciclo-de-acesso.e2e.spec.ts` | CT-221 a CT-233 | teste |
| `apps/api/test/campos-fechados.e2e.spec.ts` | CT-235 | teste |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/db/src/esquema/negocio.ts` | Coluna de efeito em `acesso_usuario_permissao`; unicidade `(acesso_id, tipo, chave)`; FK composta do vínculo para o par da pessoa | A2, D6 |
| `packages/db/src/esquema/identidade.ts` | `versao_permissoes` em `usuario`; unicidade `(id, empresa_id)` em `usuario`; `telas`, `acoes` e `versao_permissoes` em `sessao`; valor novo no enum de desfecho | D3, D4, D6, P-T6-1 |
| `packages/db/src/index.ts` | Publicar o módulo de permissão | superfície do pacote |
| `packages/auth/src/autenticacao.ts` | `perfil` e `empresa_id` como campos adicionais com **escrita fechada**; ligar o limitador de taxa; **remover** os marcadores D7 e D21 | D7, D21, P-T6-2 |
| `packages/auth/src/admissao.ts` | A leitura por chave primária passa a trazer `versao_permissoes`; o tipo publicado da pessoa ganha o campo | D3 |
| `packages/auth/src/index.ts` | Publicar catálogo, matriz, efetivo, autorização e onboarding | superfície do pacote |
| `packages/auth/test/identidade-efemera.ts` | Acessório passa a semear vínculo e ajustes | suporte de teste |
| `apps/api/src/autenticacao/contexto.guard.ts` | Consultar a decisão de autorização; comparar versão e reescrever a sessão ao divergir | D1, D4 |
| `apps/api/src/autenticacao/sessao.controller.ts` | Publicar `telas`, `acoes` e `versaoPermissoes` (8 → 11 campos) | CA-19 |
| `apps/api/src/autenticacao/autenticacao.controller.ts` | Deixar de publicar `/change-password` no encaminhador | D7 (alinhamento), D21 |
| `apps/api/src/autenticacao/autenticacao.module.ts` | Compor a rota de troca do produto | E-t1 |
| `apps/api/src/app.module.ts` | Registrar os módulos de Master e de usuários | wiring |
| `apps/api/test/autenticacao.e2e.spec.ts` | **CT-018 (d)**: inventário de `/v1/auth` passa de 6 para 5 rotas — ver §21, *mudança de escopo declarada* | D21 |
| `apps/api/test/contexto.e2e.spec.ts` | Asserção de 8 campos da sessão passa a 11 | CA-19 |
| `apps/api/test/sessao-restrita.e2e.spec.ts` | Alcance da sessão restrita inclui a rota do produto | CT-232, CT-233 |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `apps/api/src/autenticacao/sessao-restrita.ts` | Padrão canônico de "decisão fora do ponto de aplicação" |
| `apps/api/src/autenticacao/rota-publica.decorator.ts` | Padrão de metadado por reflexão a imitar |
| `apps/api/src/comum/filtro-excecao.ts` | Envelope da ADR-0012 e preservação de status de origem |
| `packages/shared/src/erros.ts` | `ACESSO_NEGADO` → 403 e a tabela de status por código |
| `packages/auth/src/perfis.ts` | Derivação do enum em vez de lista redigitada |
| `packages/db/src/unidade-de-trabalho.ts` | Transação com `SET LOCAL` |
| `packages/db/src/catalogo.ts` | Precedente da verificação de cobertura por consulta |
| `packages/db/test/varredura-de-fontes.ts` | Acessório de asserção estática (CT-216) |
| `packages/db/test/banco-efemero.ts` | Instância efêmera (ADR-0006) |
| `.claude/rules/testing-stack.md` | Prova de falsificação e invocação por script do pacote |
| `.claude/rules/nao-regressao.md` | Baseline, marcadores e proibições |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

> `Auth` indica a exigência **declarada** (ADR-0011). Toda rota declara; ausência recusa.

| Ação | Método | Rota | Payload | Resposta | Status | Auth |
|---|---|---|---|---|---|---|
| Criar empresa | POST | `/v1/master/empresas` | `{ nome, documento }` | `{ id, nome, documento, estado, criadaEm }` | 201, 401, 403, 422 | `PERFIL:SYSLOC_MASTER` |
| Listar empresas | GET | `/v1/master/empresas` | `?limite&deslocamento` (ambos opcionais; padrão `50`, teto `200`) | `{ itens, total, limite, deslocamento }` | 200, 401, 403, **422** | `PERFIL:SYSLOC_MASTER` |
| Admitir administrador | POST | `/v1/master/empresas/:id/admin` | `{ nome, email }` | `{ usuarioId, email, senhaProvisoria }` | 201, 401, 403, 404, 422 | `PERFIL:SYSLOC_MASTER` |
| Suspender empresa | POST | `/v1/master/empresas/:id/suspensao` | — | `{ id, estado, suspensaEm, sessoesEncerradas }` | 200, 401, 403, 404 | `PERFIL:SYSLOC_MASTER` |
| Reativar empresa | POST | `/v1/master/empresas/:id/reativacao` | — | `{ id, estado }` | 200, 401, 403, 404 | `PERFIL:SYSLOC_MASTER` |
| Reemitir senha (Master) | POST | `/v1/master/usuarios/:id/senha-provisoria` | — | `{ usuarioId, senhaProvisoria }` | 200, 401, 403, 404, **422** | `PERFIL:SYSLOC_MASTER` — **alvo restrito a `ADMIN_EMPRESA`**; alvo de outro perfil responde `422` (ver §11.2) |
| Criar pessoa | POST | `/v1/usuarios` | `{ nome, email, perfil }` | `{ usuarioId, email, perfil, senhaProvisoria }` | 201, 401, 403, 422 | `TELA:usuarios` |
| Listar pessoas | GET | `/v1/usuarios` | — | `{ itens, total, limite, deslocamento }` | 200, 401, 403 | `TELA:usuarios` |
| Ajustar permissões | POST | `/v1/usuarios/:id/permissoes` | `{ ajustes: [{ tipo, chave, efeito }] }` | `{ usuarioId, telas, acoes, versaoPermissoes }` | 200, 401, 403, 404, 422 | `TELA:usuarios` — **alvo ≠ quem age** |
| Trocar perfil | POST | `/v1/usuarios/:id/perfil` | `{ perfil, descartarAjustes? }` | `{ usuarioId, perfil, versaoPermissoes }` | 200, 401, 403, 404, 422 | `TELA:usuarios` — **alvo ≠ quem age** |
| Desativar pessoa | POST | `/v1/usuarios/:id/desativacao` | — | `{ usuarioId, ativo, sessoesEncerradas }` | 200, 401, 403, 404, **422** | `TELA:usuarios` — **alvo ≠ quem age** |
| Reativar pessoa | POST | `/v1/usuarios/:id/reativacao` | — | `{ usuarioId, ativo }` | 200, 401, 403, 404, **422** | `TELA:usuarios` — **alvo ≠ quem age** |
| Reemitir senha (Admin) | POST | `/v1/usuarios/:id/senha-provisoria` | — | `{ usuarioId, senhaProvisoria }` | 200, 401, 403, 404, **422** | `TELA:usuarios` — **alvo ≠ quem age** |
| Ler sessão | GET | `/v1/sessao` | — | 11 campos (§4.2) | 200, 401 | marca "não exige" |
| Trocar senha | POST | `/v1/sessao/senha` | `{ senhaAtual, senhaNova }` | `{ trocada: true }` | 200, 401, 422, **429** | marca "não exige" |

> **Emenda (T9, rodada 2) — a troca de senha declara o `429` do limitador de taxa.** A linha acima
> dizia `200, 401, 422`, e a razão era que a T9 planejava gravar a credencial por
> `auth.api.changePassword` — chamada de servidor que **não passa pelo limitador**, porque ele vive no
> `onRequest` do roteador do arcabouço. A Revisão Técnica mediu isso e reprovou: a conferência de
> `senhaAtual` ficava **sem teto nenhum**, num caminho em que o contador por conta da RN-06 não
> corre, e cujo acerto encerra as demais sessões e expulsa o titular. A correção repassa a gravação
> ao **manipulador**, de modo que a regra `'/change-password'` de `customRules` volta a valer para
> esta rota — o teto mais estreito da política (§11.5).
>
> O `429` não é código novo nem corpo novo: é o `REQUISICAO_RECUSADA` que o enum já publica, no
> mesmo envelope da ADR-0012, com o status de origem preservado pela `DECISÃO FECHADA — T8 / Gate 2
> (P1)` do filtro global. **A superfície
> não cresceu** — a rota é a mesma, o corpo de entrada e o de sucesso são os mesmos; o que muda é a
> tabela deixar de omitir uma recusa que o cliente pode receber. Provado por
> `CT-236 (d)` em `apps/api/test/campos-fechados.e2e.spec.ts`.
>
> **E cabeçalho nenhum acompanha essa recusa** (emenda da rodada 3, mesmo P1). A redação anterior
> anunciava o `x-retry-after` "que só o limitador escreve", e a medição do caminho a desmentiu: em
> recusa a borda entrega apenas o par (status, corpo) — `comoRecusa()` reduz a resposta do
> manipulador a `{ statusCode, body }` e o filtro global responde `send(corpo)` sem escrever
> cabeçalho algum; a única cópia de cabeçalhos da borda corre no caminho de aceitação. O
> `x-retry-after` existe na **instância** do arcabouço, e não na superfície publicada. Declará-lo
> seria o mesmo defeito do parágrafo acima com o sinal trocado: um documento que anuncia cabeçalho
> inexistente descreve uma resposta que não existe — e este documento congela e vira o handoff.

> **Emenda (T8, rodada 3) — as cinco rotas de `/v1/usuarios/:id` recusam o AUTO-ALVO.** A tabela
> declarava a exigência (`TELA:usuarios`) e nada sobre **quem** pode ser alvo, e a superfície inteira
> pressupunha, sem verificar, que alvo e ator fossem pessoas distintas. Como a exigência é de
> **chave** e não de perfil (o que é decisão certa, §10.1), conceder `TELA:usuarios` a uma pessoa
> `USUARIO_EMPRESA` a faz alcançar as sete rotas — e, sobre si mesma, `POST /:id/perfil` a promove a
> `ADMIN_EMPRESA` e `POST /:id/permissoes` lhe dá as outras dezesseis chaves: dois caminhos
> independentes para a mesma **escalada de privilégio dentro da empresa**, com efeito imediato (a
> versão incrementa e a sessão relê o efetivo, ADR-0010) e irreversível para quem concedeu.
>
> As **cinco** recusam com `422 CAMPO_INVALIDO`, `campo: 'id'`, `detalhes: { motivo:
> 'ALVO_E_QUEM_AGE' }` — a mesma forma com que `POST /v1/master/usuarios/:id/senha-provisoria` já
> recusa alvo de perfil errado. **Não é `403 ACESSO_NEGADO`**: aquele código é do ponto de aplicação
> único da guarda, com `detalhes.exigido` (RN-14, ADR-0011), e emiti-lo de um manipulador seria uma
> segunda definição de recusa de autorização. A recusa mora num ponto único (`sobreAPessoa`), o mesmo
> por onde as cinco abrem a unidade de trabalho — fechar só `/perfil` deixaria `/permissoes` aberta, e
> fechar as duas deixaria a sexta rota nascer sem a propriedade.
>
> **Nenhuma das cinco tem auto-alvo legítimo**, e a medição está registrada: *reativação* é
> inalcançável (estar desativado e ter sessão viva são mutuamente exclusivos — a desativação encerra
> as sessões no mesmo commit e a barreira de admissão recusa a entrada de quem está desativado);
> *desativação* era alcançável e **trancava a administração** (o único Admin podia se desativar, e o
> socorro seria externo, pelo Master); *senha provisória* não tem caso de uso, porque a própria pessoa
> troca a senha por `/change-password`. Prova: `CT-237`, com as cinco rotas para dois atores, o
> efetivo inalterado e a perna positiva (o Admin alcança **outro** Admin nas cinco).

> **Emenda (T7, rodada 3)** — a linha da listagem de empresas declarava `Payload: —` e
> `Status: 200, 401, 403`. Isso estava **incompleto**, e não descrevia superfície a menos: a
> **ADR-0012** manda publicar `limite` e `deslocamento` no envelope de lista, e publicá-los na
> resposta ignorando-os no pedido faria a resposta afirmar uma janela que o cliente não pediu — e
> deixaria a segunda página inalcançável. Declará-los no pedido traz o `422` junto, porque pedido
> acima do teto **recusa** em vez de truncar em silêncio (truncar faria o cliente acreditar que viu
> tudo). A implementação e o `CT-226 (b)` já os cobrem dos dois lados; a tabela é que estava atrás.

> **Risco residual, nomeado (T8, rodada 3) — `POST /v1/usuarios` é um oráculo de existência de conta
> ENTRE empresas.** O espaço de login é **global**: `identidade.usuario.email` é único no banco
> inteiro, e não por empresa. A conferência de endereço ocupado é, por isso, global também — e a
> consequência é que um Admin da empresa A descobre, pelo `422 CAMPO_INVALIDO` com
> `detalhes.motivo: 'EMAIL_JA_REGISTRADO'`, que um endereço **tem conta em alguma outra empresa**. Ele
> aprende a existência, e nada além dela: nem o nome, nem o perfil, nem qual empresa. **É limite
> aceito**, e as duas alternativas foram rejeitadas com motivo:
>
> * **recortar a conferência pela empresa do contexto** — a colisão deixaria de ser vista na borda e
>   bateria na unicidade global, chegando ao cliente como `500` sobre condição de domínio. Seria
>   **pior e continuaria sendo oráculo**: o `500` naquela posição discrimina exatamente o mesmo fato,
>   com uma resposta mentirosa por cima;
> * **responder sucesso sem criar** — mentiria sobre o efeito, e o Admin esperaria por uma pessoa que
>   nunca vai entrar.
>
> O que fecharia de verdade é o **espaço de login por empresa** (login composto), que é decisão de
> produto e não desta rota: mudaria a forma de entrar, o formulário do frontend e a unicidade da
> coluna. Enquanto o espaço for global, a recusa tem de acontecer, e com honestidade. **Sem mudança de
> comportamento nesta rodada** — o que mudou foi a declaração, aqui e no docblock de `criarPessoa`.

### 4.1.1 Exemplo de Payload por Endpoint

Nenhum endpoint desta fatia aceita **atualização parcial** — a transição de estado é expressa por sub-recurso (decisão desta spec), e cada sub-recurso tem payload fechado ou vazio. **Todos os campos declarados são obrigatórios**; não há `PUT`/`PATCH` parcial nesta superfície, e portanto nenhuma cláusula de "campos ausentes são ignorados" se aplica.

O único payload com campo opcional é a troca de perfil, e ele **não é atualização parcial** — é declaração de intenção:

```
POST /v1/usuarios/:id/perfil

Caso A — pessoa sem ajustes individuais:
  { "perfil": "ADMIN_EMPRESA" }
  → 200

Caso B — pessoa COM ajustes, sem intenção declarada:
  { "perfil": "ADMIN_EMPRESA" }
  → 422 { codigo: "CAMPO_INVALIDO", campo: "perfil",
          detalhes: { ajustesDescartados: 3 } }

Caso C — mesma pessoa, intenção declarada:
  { "perfil": "ADMIN_EMPRESA", "descartarAjustes": true }
  → 200, e os 3 ajustes deixam de existir

Regra: `descartarAjustes` ausente é tratado como `false` — nunca como consentimento.
```

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|---|---|---|---|
| `SessaoDoProduto` | OpenAPI (`apps/api`) | os 8 herdados + `telas: string[]`, `acoes: string[]`, `versaoPermissoes: number` | v1 (11 campos) |
| `CorpoErro` | `@sysloc/shared` (ADR-0012) | `codigo`, `mensagem`, `campo?`, `detalhes?` | herdado |
| `Empresa` | OpenAPI (`apps/api`) | `id`, `nome`, `documento`, `estado`, `criadaEm` | v1 |
| `PessoaDaEmpresa` | OpenAPI (`apps/api`) | `usuarioId`, `nome`, `email`, `perfil`, `ativo` | v1 |
| `AjusteDePermissao` | OpenAPI (`apps/api`) | `tipo: TELA\|ACAO`, `chave`, `efeito: CONCEDIDA\|NEGADA` | v1 |
| `ChaveDoCatalogo` | `@sysloc/auth` | união fechada das 17 chaves | v1 |

**A chave exposta é UUID** para empresa e pessoa, conforme a **ADR-0012**: são entidades de identidade, não de negócio tenantizado, e não há código legível a preservar.

> **O caminho `/v1/usuarios` alcança TODAS as pessoas da empresa**, de qualquer perfil — inclusive `ADMIN_EMPRESA` —, e não apenas as de perfil `Usuario Empresa`. O nome espelha a **área de tela `Usuários`**, que é decisão fechada e é a própria chave que autoriza essas rotas (`TELA:usuarios`); divergir dela criaria distância entre a chave que protege e o caminho protegido. O glossário-feature registra esse alcance, porque o glossário global marca "usuário" como termo ambíguo já resolvido em outro sentido.

> **A matriz do perfil `SYSLOC_MASTER` é vazia**, e isso é estrutural, não omissão. As 17 chaves do catálogo são áreas e ações **do app da imobiliária**, e o Master não alcança dado de negócio por nenhum caminho. Ele alcança as rotas dele pela **dimensão de perfil**, nunca por chave. Some-se que ele **não pode ter ajustes individuais**: eles vivem em `negocio.acesso_usuario_permissao`, presa ao vínculo de acesso, que é tenantizado — e o Master não pertence a empresa alguma. Logo o efetivo dele é **sempre** a matriz do perfil, sem ajuste possível, e `GET /v1/sessao` devolve `telas: []` e `acoes: []` para ele.

### 4.3 Eventos Publicados / Consumidos

N/A — esta fatia não publica nem consome eventos. O encerramento de sessão é **síncrono e transacional** com o evento que o causa (D5); enfileirá-lo introduziria janela em que a suspensão não teria efeito, contra a RN-04.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Requisição autenticada qualquer** (o fluxo que toda rota atravessa):

1. `ContextoGuard.canActivate` lê o metadado de exigência da rota por reflexão. **Ausente** → recusa `403` (ADR-0011).
   > **Rota pública não chega aqui.** A guarda **retorna antes** para rota marcada como pública — comportamento herdado e verificado no código. `@RotaPublica()` **é** a declaração dessa rota, e por isso ela não recebe (nem precisa de) marca de "não exige permissão": uma segunda marca no mesmo manipulador nunca seria lida.
2. Resolve a sessão pelo cookie; ausente ou expirada → `401 NAO_AUTENTICADO`.
3. `carregarPessoaDaSessao` devolve, **numa leitura por chave primária**, a identidade mais `versao_permissoes` corrente.
4. Compara com a versão gravada no registro de sessão:
   - **iguais** → o efetivo do registro de sessão é o corrente;
   - **divergem** → relê os ajustes sob o contexto de tenant, recalcula o efetivo e **reescreve** as três colunas do registro de sessão (D4).
5. Consulta `sessao-restrita`: exigência pendente e rota fora do alcance → `403` nomeando a pendência.
6. Consulta `autorizacao` com a exigência declarada e o efetivo. Não alcança → `403 ACESSO_NEGADO` com `detalhes.exigido`.
7. Fixa o contexto de tenant e prossegue; a transação abre com `SET LOCAL`.

**Admissão de empresa (Master):** cria a empresa → cria a pessoa pelo adaptador com `perfil` e `empresa_id` **injetados pelo servidor** (nunca pelo corpo) → gera Senha provisória → marca `senha_provisoria` → devolve a senha **uma única vez**.

**Ajuste de permissões (Admin):** valida a coerência ação→tela contra o efetivo resultante → grava os ajustes e incrementa `versao_permissoes` **na mesma transação** → devolve o efetivo novo.

**Encerramento (D5):** suspensão marca a empresa e **apaga os registros de sessão** de todas as pessoas dela; desativação faz o mesmo para uma pessoa. As duas operações são transacionais com a marcação.

### 5.2 Fluxos Alternativos

- **Ação sem a tela** → `422 CAMPO_INVALIDO` com `detalhes.telaExigida`, antes de qualquer escrita.
- **Troca de perfil com ajustes e sem intenção** → `422` com `detalhes.ajustesDescartados`; nada é alterado, e o contador **não** incrementa.
- **Sessão restrita** → só a leitura da própria sessão e a troca de senha; todo o resto `403` nomeando a pendência.
- **Pessoa de outra empresa** → o vínculo não existe sob o contexto corrente; `404 RECURSO_NAO_ENCONTRADO`, e a recusa vem da RLS, não de comparação na aplicação.
- **Senha provisória reemitida** → a anterior deixa de derivar; a recusa é **indistinguível** de credencial incorreta (RN-10 herdada).

### 5.3 Mapeamento de User Stories → Fluxos

| User Story | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | `POST` e `GET /v1/master/empresas` | `MasterModule`, `EmpresaService` |
| US-02 | `POST /v1/master/empresas/:id/admin` | `MasterModule`, `onboarding`, adaptador de identidade |
| US-03 | `POST /v1/master/usuarios/:id/senha-provisoria` | `MasterModule`, `onboarding` |
| US-04 | `POST /v1/master/empresas/:id/suspensao` | `EmpresaService`, encerramento de sessão |
| US-05 | `POST /v1/master/empresas/:id/reativacao` | `EmpresaService` |
| US-06 | `GET /v1/master/empresas` | `MasterModule` |
| US-07 | `POST /v1/master/empresas/:id/admin` (reuso) | `MasterModule`, `onboarding` |
| US-08 | `POST /v1/usuarios` | `UsuariosModule`, `onboarding` |
| US-09 | `POST /v1/usuarios/:id/permissoes` | `UsuarioService`, `permissao`, `efetivo`, `catalogo` |
| US-10 | `POST /v1/usuarios/:id/perfil` | `UsuarioService`, `permissao`, `efetivo` |
| US-11 | `POST /v1/usuarios/:id/desativacao` | `UsuarioService`, encerramento de sessão |
| US-12 | `POST /v1/usuarios/:id/reativacao` | `UsuarioService` |
| US-13 | `POST /v1/sessao/senha` | `SenhaController`, `sessao-restrita` |
| US-14 | `GET /v1/sessao` | `SessaoController`, `ContextoGuard`, `efetivo` |
| US-15 | toda rota autenticada (passo 4 do §5.1) | `ContextoGuard`, `admissao`, `permissao` |
| US-16 | toda rota com exigência (passo 6 do §5.1) | `ContextoGuard`, `autorizacao`, `filtro-excecao` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|---|---|---|
| Chave do ajuste ∈ catálogo | `POST /v1/usuarios/:id/permissoes` | `422 CAMPO_INVALIDO`, `campo: "ajustes"` |
| Coerência ação→tela sobre o efetivo resultante | idem | `422` com `detalhes.telaExigida` e `detalhes.acao` |
| Intenção declarada quando há ajustes a descartar | `POST /v1/usuarios/:id/perfil` | `422` com `detalhes.ajustesDescartados` |
| Perfil ∈ enum do schema | criação de pessoa e troca de perfil | `422 CAMPO_INVALIDO` |
| `SYSLOC_MASTER` não é criável pelas rotas de empresa | `POST /v1/usuarios` | `422` — a restrição do schema já o impede estruturalmente |
| Força da senha nova | `POST /v1/sessao/senha` | `422` (política herdada) |
| Identificador na rota é UUID | todas as rotas de `:id` | `422` antes de qualquer consulta |
| Alvo de rota de `:id` ≠ quem age (RN-18) | as cinco rotas de `:id` de `/v1/usuarios` | `422 CAMPO_INVALIDO`, `campo: "id"`, `detalhes.motivo: "ALVO_E_QUEM_AGE"`, antes de a unidade de trabalho abrir |
| Identificador na rota é **canonizado** em minúsculas na borda | as cinco rotas de `:id` de `/v1/usuarios` | — (transformação, não recusa: o banco é insensível à caixa do `uuid` e a aplicação compara identidade por string). O `:id` das **quatro rotas de `/v1/master` NÃO é canonizado** — ele não é comparado com identidade em lugar nenhum, e o que elas ecoam e registram ou sai do `RETURNING` do banco (suspensão, reativação) ou preserva a grafia enviada (`admin`, `senha-provisoria`) |

### 6.2 Transformações de Dados

- **Efetivo → contrato**: o conjunto interno é serializado em dois arranjos ordenados (`telas`, `acoes`), sem o prefixo de tipo redundante dentro de cada arranjo.
- **Ajustes → linhas**: cada item vira uma linha `(acesso_id, tipo, chave, efeito)`; a unicidade do trio impede concessão e negação coexistirem.
- **Senha provisória**: gerada com a mesma política de força da senha comum, devolvida **em texto uma única vez** e persistida apenas na forma derivada.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|---|---|---|---|
| RN-01 | RN-01 | Efetivo = (perfil ∪ concedidas) − negadas; **negação vence** | — (invariante do cálculo) |
| RN-02 | RN-02 | Ação exige a tela correspondente; incoerência **recusada ao salvar** | `CAMPO_INVALIDO` + `detalhes.telaExigida` |
| RN-03 | RN-03 | Mudança de permissão não interrompe: relê e segue | — |
| RN-04 | RN-04 | Suspensão/desativação **encerra** sessões na origem | `NAO_AUTENTICADO` na operação seguinte |
| RN-05 | RN-05 | Reativação não devolve sessão | — |
| RN-06 | RN-06 | Nada é apagado — não há exclusão | — (ausência de rota) |
| RN-07 | RN-07 | Senha provisória exibida uma única vez | — |
| RN-08 | RN-08 | Sem expiração por tempo | — |
| RN-09 | RN-09 | Reemissão invalida a anterior | `CREDENCIAL_INVALIDA` (indistinguível) |
| RN-10 | RN-10 | Sessão restrita até a troca | `ACESSO_NEGADO` nomeando a pendência |
| RN-11 | RN-11 | Troca de perfil descarta ajustes; exige intenção declarada | `CAMPO_INVALIDO` + `detalhes.ajustesDescartados` |
| RN-12 | RN-12 | Admin alcança apenas a própria empresa | `RECURSO_NAO_ENCONTRADO` (via RLS) |
| RN-13 | RN-13 | Master não ajusta permissão nem alcança dado de negócio | `ACESSO_NEGADO` |
| RN-14 | RN-14 | Recusa nomeia a permissão exigida | `ACESSO_NEGADO` + `detalhes.exigido` |
| RN-15 | RN-15 | Catálogo fechado em 17 chaves | `CAMPO_INVALIDO` |
| RN-16 | — | Toda rota declara exigência; ausência recusa (ADR-0011) | `ACESSO_NEGADO` |
| RN-17 | — | Contador incrementa na mesma transação da escrita | — (invariante transacional) |
| RN-18 | — | Alvo de rota de `:id` **não pode ser quem age** — as cinco rotas de `:id` do Admin recusam o auto-alvo antes de abrir a unidade de trabalho | `CAMPO_INVALIDO` + `campo: 'id'` + `detalhes.motivo: 'ALVO_E_QUEM_AGE'` |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, com os dois schemas da ADR-0009: `identidade` (sem regime de tenant) e `negocio` (RLS habilitada e **forçada**, cobertura verificada por consulta ao catálogo do sistema).

### 7.2 Tabelas / Coleções

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|---|---|---|---|---|
| `negocio.acesso_usuario_permissao` **[M]** | `+ efeito` | enum `efeito_permissao` (`CONCEDIDA`,`NEGADA`), NOT NULL | `unique (acesso_id, tipo, chave)` **[N]** | existente `(empresa_id, acesso_id)` |
| `negocio.acesso_usuario_app` **[M]** | — | — | `fk (usuario_id, empresa_id) → identidade.usuario (id, empresa_id)` **[N]** (D6) | existentes |
| `identidade.usuario` **[M]** | `+ versao_permissoes` | `integer NOT NULL DEFAULT 0` | `unique (id, empresa_id)` **[N]** — alvo da FK composta | existentes |
| `identidade.sessao` **[M]** | `+ telas`, `+ acoes`, `+ versao_permissoes` | `text[] NOT NULL DEFAULT '{}'` ×2, `integer NOT NULL DEFAULT 0` | — | existente `(usuario_id)` |
| `identidade.desfecho_tentativa` **[M]** | valor novo | enum | acréscimo retrocompatível (ADR-0012) | — |

> **A unicidade `(id, empresa_id)` em `identidade.usuario` não tenantiza a tabela** — não introduz política de isolamento. Ela apenas torna o par referenciável, que é o que a FK composta do vínculo exige. A ADR-0009 permanece intacta. A pessoa sem empresa (Master) continua existindo: `unique` com nulo admite múltiplas linhas, e a FK só se aplica a valores não nulos.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|---|---|---|
| 0003 | `0003_autorizacao.sql` | up — **gerada** por `drizzle-kit generate` a partir do schema declarado; renomeada à mão para o nome descritivo, no padrão de `0000`–`0002` |
| 0004 | `0004_desfecho_de_recusa.sql` | up — **à mão**; o gerador não emite acréscimo a enum com a ordenação exigida |

**Por que duas e não uma**: o precedente do projeto é gerada para o que o schema declara, à mão para o que o gerador não emite (`0001_seguranca.sql` fez isso para `FORCE ROW LEVEL SECURITY`). Misturar conteúdo gerado e autoral no mesmo arquivo faz uma regeneração futura sobrescrever o trecho autoral em silêncio.

**Nenhuma concessão nova é necessária**: o `GRANT ... ON ALL TABLES` de `0001_seguranca.sql` é por tabela e alcança coluna acrescentada depois. Nenhuma tabela nova nasce em `negocio`, então a guarda de cobertura de RLS não muda de conjunto.

### 7.4 Estratégia de Transação e Consistência

- **Escrita de permissão e incremento do contador são atômicos** (RN-17): a unidade de trabalho já abre transação com `SET LOCAL`; o ajuste (em `negocio`, sob RLS) e o contador (em `identidade`, sem RLS) são escritos na **mesma** transação — as duas fronteiras, um commit. Operação recusada não deixa contador incrementado (**CT-210**).
- **Encerramento de sessão é transacional com o evento** que o causa. Isolamento `read committed` (padrão) basta: a suspensão marca e apaga na mesma transação, e uma requisição concorrente ou vê a sessão viva (e é atendida) ou não a encontra (e recebe 401) — nunca um estado intermediário.
- **Reescrita do efetivo na sessão** é idempotente por construção: escreve o efetivo calculado da versão corrente. Duas requisições concorrentes que detectem a mesma divergência escrevem o mesmo valor.
- **Sem bloqueio pessimista**: nenhuma operação desta fatia disputa linha sob concorrência real.

### 7.5 Política de Retenção / Archival

**Nada é apagado** (RN-06): empresa e pessoa têm estado, não exclusão. Registros de sessão **são** apagados — pelo evento de encerramento e pela expiração, comportamento herdado.

A retenção de `identidade.tentativa_login` (metade do **P-T6-2**) fica **fora desta fatia**, endereçada à operação/F7. Registrada aqui para não se perder ao fechar a outra metade.

---

## 8. Integração com APIs Externas

N/A — esta fatia não integra nenhum serviço externo. O canal de e-mail, que seria o candidato natural para entregar a Senha provisória, nasce só na F3; até lá a entrega é **fora de banda** (decisão E1 do discovery), e a rota não muda quando o canal chegar — ela apenas ganha o envio como efeito adicional.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

N/A — ver §4.3. O encerramento de sessão é síncrono por exigência da RN-04.

### 9.2 Idempotência

Duas operações são naturalmente idempotentes e devem permanecer assim: **suspender empresa já suspensa** e **desativar pessoa já desativada** respondem `200` com o mesmo corpo, sem erro — o campo `sessoesEncerradas` vem `0` na repetição. **Reemitir Senha provisória não é idempotente** por natureza: cada chamada gera uma senha nova e invalida a anterior (RN-09).

### 9.3 Outbox / Saga

N/A — não há consistência distribuída nesta fatia; tudo acontece num banco só, em transações locais.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|---|---|---|---|
| Falta permissão declarada | `ACESSO_NEGADO` (403) | canônica + `detalhes.exigido` | guarda (ponto único) |
| Sessão restrita não alcança | `ACESSO_NEGADO` (403) | canônica nomeando a pendência | `sessao-restrita` (herdado) |
| Sem sessão válida | `NAO_AUTENTICADO` (401) | canônica | guarda (herdado) |
| Pessoa/empresa fora do tenant | `RECURSO_NAO_ENCONTRADO` (404) | canônica | serviço, sobre resultado vazio da RLS |
| Ajuste incoerente ou chave fora do catálogo | `CAMPO_INVALIDO` (422) | canônica + `detalhes` | serviço |
| Troca de perfil sem intenção | `CAMPO_INVALIDO` (422) | canônica + `detalhes.ajustesDescartados` | serviço |
| **Alvo de rota de `:id` é quem age** | `CAMPO_INVALIDO` (422) | canônica + `campo: 'id'`, `detalhes.motivo: 'ALVO_E_QUEM_AGE'` | serviço, no ponto único de abertura da unidade |
| Entrada recusada (inclui senha provisória vencida por reemissão) | `CREDENCIAL_INVALIDA` (401) | **indistinguível** (RN-10 herdada) | barreira de admissão |
| Recusa do limitador de taxa | `REQUISICAO_RECUSADA` | status de origem preservado | filtro global (herdado) |

**Nenhum código novo entra no enum.** Os seis códigos usados já existem — o que muda é o campo `detalhes` passar a carregar `exigido`, `telaExigida`/`acao`, `ajustesDescartados` e `motivo`. Pela ADR-0012, acrescentar código seria retrocompatível; **não acrescentar é melhor**, porque cada código novo é superfície versionada.

### 10.2 Resiliência

Sem dependência externa, não há retry, circuit breaker nem fallback a especificar. O **limitador de taxa nativo** (P-T6-2) entra no caminho de entrada como **camada adicional, não substituto** do bloqueio por conta — a §11.5 da fatia anterior já declarava isso, e o **CT-236** prova que as duas coexistem.

### 10.3 Estratégia de Logging de Erros

Registro estruturado herdado, com redação de segredo por entrada única de despacho. **A Senha provisória nunca é registrada** — nem em corpo de resposta ecoado, nem em contexto de erro. Recusa de autorização é registrada em nível `warn` com a exigência que faltou e o identificador da pessoa; **o efetivo inteiro não vai para o registro** (ruído e superfície de vazamento sem ganho diagnóstico).

---

## 11. Segurança

### 11.1 Autenticação

Herdada e **não reaberta**: `better-auth` com senha ≥ 10 e verificação de força, bloqueio após 5 tentativas, sessão de 8h renovável por atividade, cookie `httpOnly`+`Secure`+`SameSite`, 2FA obrigatório para o Master, trilha de auditoria. A barreira única de admissão continua sendo o lugar onde conta bloqueada, pessoa desativada e empresa suspensa recusam **na entrada**.

### 11.2 Autorização

**É o que esta fatia entrega.** Modelo: perfil como default com ajuste por pessoa, avaliado num **ponto único** (guarda), com a regra em módulo consultado. Declaração por rota em duas dimensões, **default que nega**, cobertura verificada sobre o roteador montado (ADR-0011).

Três invariantes que a implementação não pode desfazer:

1. **A negação vence** (RN-01) — prova de falsificação por mutante de ordem é obrigatória (**CT-203**).
2. **Um ponto de aplicação** — nenhum manipulador reavalia (**CT-216**, varredura de fontes).
3. **Nenhum filtro por empresa na aplicação** — o efetivo é montado sob RLS (**CT-209**, com mutante que reintroduz o filtro).

#### O alcance exato da garantia do Sysloc Master — limite declarado

A garantia que a fatia anterior provou é sobre **a sessão do Master**: nenhuma requisição autenticada como Master devolve dado de negócio, porque o contexto sem empresa não casa política alguma. Ela **não** é, e nunca foi, uma garantia sobre o que ele pode **fabricar**.

O onboarding desta fatia torna isso concreto: ao criar o Admin inicial de uma empresa (US-02) ou ao admitir um administrador adicional em socorro (US-07), o Master **recebe a Senha provisória em texto**, uma vez. Quem emite a credencial pode usá-la. Isso é consequência direta das decisões 14 e 39 — onboarding por senha provisória entregue fora de banda —, e **não** é defeito desta implementação: qualquer modelo em que um ator emite credencial para outro tem essa propriedade.

Três consequências que a spec fixa, para que o limite seja auditável em vez de implícito:

1. **A reemissão pelo Master alcança apenas `ADMIN_EMPRESA`** (§4.1). Alvo de outro perfil responde `422` — o Master não tem caminho direto para uma sessão de `Usuario Empresa`. Reduzir a superfície não elimina a propriedade, mas encurta o caminho.
2. **A emissão é registrada com autoria** — `emitidaPor` no registro estruturado (§13.1). O que a criptografia não impede, a trilha torna reconstituível.
3. **A entrada subsequente é registrada como qualquer outra** na trilha de tentativas, com o desfecho e a origem — de modo que "o Master emitiu e alguém entrou" é uma sequência legível, não um vazio.

> **Nota para os gates**: encontrar `POST /v1/master/empresas/:id/admin` devolvendo credencial ao lado da afirmação *"o Master não alcança dado de negócio"* **não é contradição** — é este limite, declarado aqui. O que seria violação: o Master obtendo dado de negócio **pela própria sessão**, que continua sendo o que o `CT-020` da fatia anterior prova e que nada nesta fatia altera.

### 11.3 Criptografia

Senha derivada pelo mecanismo do arcabouço (herdado). A Senha provisória segue o mesmo caminho — **em texto ela existe apenas no corpo da resposta de criação**, e em nenhum outro lugar. Confidencialidade entre empresas permanece garantida **apenas na aplicação** (decisão 16, risco aceito e declarado).

### 11.4 Sanitização e Validação

Consultas parametrizadas por Drizzle e postgres.js. Entrada validada por Zod na borda, com o identificador de rota validado como UUID **antes** de qualquer consulta. A exceção auditada herdada (`SET LOCAL` não aceita parâmetro vinculado) permanece como está, com seu caso negativo dedicado.

**Superfície de escrita fechada (D7)**: `perfil` e `empresa_id` são campos adicionais do modelo do arcabouço declarados com **escrita fechada**. Sem isso, `perfil` seria escrevível pelo corpo a partir de qualquer sessão autenticada (**elevação de privilégio**) e `empresa_id` faria a origem do contexto de RLS ser o request (**fuga de tenant**, contra o invariante 2 e o texto literal da ADR-0008). A restrição existente cobre só metade do espaço — a troca lateral entre empresas mantendo o mesmo perfil passa por ela, e o schema de identidade não tem RLS por decisão da ADR-0009. **CT-235** persegue exatamente esse vetor.

### 11.5 Rate Limiting / Anti-abuse

O limitador nativo do arcabouço é ligado no caminho de entrada (P-T6-2, metade acionável). Ele **não substitui** o bloqueio por conta: são camadas distintas, e o **CT-236** assere as duas na mesma execução, impedindo que ligar uma mascare a remoção da outra.

### 11.6 Secrets Management

Herdado, sem mudança: segredos em `EnvironmentFile` 0600 fora do repositório, validados na partida por esquema que recusa subir nomeando a variável ausente.

---

## 12. Performance

### 12.1 Metas

- Latência p95: **< 150 ms** em rota autenticada simples (a comparação de versão acrescenta a leitura de um inteiro numa linha já lida).
- Latência p99: **< 400 ms**.
- Throughput esperado: dezenas de requisições por segundo — 20 a 300 empresas com equipes pequenas (decisão 2).

### 12.2 Estratégias

- **O contador viaja na leitura que já acontece** (D3): zero consulta adicional no caminho comum.
- **Reescrita do efetivo só na divergência** (D4): uma escrita por mudança de permissão, não por requisição.
- **Índices**: `(usuario_id)` em sessão e `(empresa_id, acesso_id)` em permissões já existem e atendem; a unicidade nova do trio cria o índice que a leitura de ajustes usa.
- **Sem cache externo**: introduzir um segundo lugar de verdade nesta escala é over-engineering (alternativa rejeitada no tech-alignment).

### 12.3 Limites Conhecidos

- **Suspensão de empresa custa uma operação de encerramento por pessoa.** Irrelevante nesta escala; se uma empresa passar de centenas de pessoas, reavaliar.
- **O custo da leitura de versão por requisição não foi medido sob carga** — declarado como cenário não coberto pelo QA e registrado como risco (§20), não como fato verificado.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|---|---|---|---|
| Recusa por autorização | `warn` | `rota`, `exigido`, `usuarioId`, `empresaId` | sem efetivo, sem dado de negócio |
| Empresa suspensa/reativada | `info` | `empresaId`, `sessoesEncerradas` | — |
| Pessoa desativada/reativada | `info` | `usuarioId`, `empresaId`, `sessoesEncerradas` | — |
| Senha provisória emitida/reemitida | `info` | `usuarioId`, `emitidaPor` | **a senha nunca é registrada** |
| Ajuste de permissão | `info` | `usuarioId`, `versaoPermissoes` | sem o conjunto de chaves |
| Divergência de versão reconciliada | `debug` | `usuarioId`, `versaoAnterior`, `versaoCorrente` | — |

Padrão JSON, biblioteca herdada, com redação de segredo por entrada única de despacho.

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---|---|---|---|
| `autorizacao_recusas_total` | counter | `exigido`, `dimensao` | — (sinal de configuração errada) |
| `sessoes_encerradas_total` | counter | `motivo` (`suspensao`\|`desativacao`) | — |
| `efetivo_reescritas_total` | counter | — | proporção baixa sobre requisições |
| `versao_divergente_total` | counter | — | — |

Instrumentação por OpenTelemetry, já na stack. **Nenhum painel nem alerta nasce nesta fatia** — o destino de métricas é decisão de operação, e a fatia anterior não o estabeleceu.

### 13.3 Tracing

Herdado. A consulta de autorização entra como atributo do span da requisição (exigência declarada e desfecho), não como span próprio — ela é uma comparação em memória.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|---|---|---|---|
| — | — | — | N/A nesta fatia |

Sem destino de alerta estabelecido no projeto. Registrado como lacuna conhecida, a resolver na F7 junto do runbook.

---

## 14. Feature Flags

### 14.1 Solução

N/A — o projeto não tem solução de feature flag, e esta fatia não introduz uma. A superfície nasce completa ou não nasce.

### 14.2 Flags Envolvidas

Nenhuma.

---

## 15. Versionamento de API

### 15.1 Estratégia

Prefixo no caminho (`/v1`), herdado e aplicado globalmente. As rotas desta fatia nascem sob ele.

### 15.2 Compatibilidade

**Esta é a fatia que fecha a superfície do app do cliente.** O congelamento do marco de entrega alcança `/v1/usuarios/*` e `/v1/sessao*`; `/v1/master/*` fica **fora** dele por decisão registrada — o painel do operador, pós-F7, pode acrescentar rotas ali sem violar o marco.

Compatibilidade dentro do congelamento: acrescentar rota ou campo é permitido; renomear e remover, não. O mesmo vale para o enum de código de erro (ADR-0012).

**Uma remoção acontece nesta fatia, e é deliberada**: `/v1/auth/change-password` deixa de ser publicada. Ela nunca foi consumida por cliente algum — a fatia anterior a publicou como efeito colateral do encaminhador, e o débito D21 mediu que ela grava a credencial antes de conferir a política. Ver §21.

### 15.3 Schemas / Contratos

Documento OpenAPI gerado das anotações. As rotas desta fatia **entram nele desde o nascimento** — diferente das seis de `/v1/auth`, que ficaram de fora por serem publicadas pelo encaminhador. A publicação do pacote de contratos é da fase de entrega, não desta fatia.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Sem CI/CD. A verificação é local (`pnpm build`, `pnpm lint`, `pnpm test`) mais os verificadores de shell no cluster real, conduzidos pelo operador.

### 16.2 Empacotamento

**Nativo, sem contêiner** — unidades systemd por serviço, `Restart=always`. Nada muda nesta fatia.

### 16.3 Infraestrutura como Código

Scripts idempotentes de `deploy/scripts/instalacao/` (ADR-0005). **Esta fatia não altera nenhum** — a migração nova é aplicada pelo `migrar-banco.sh` existente, que lê o diretório de migrações.

### 16.4 Estratégia de Rollout

Aplicação da migração seguida de reinício do serviço. **Ordem obrigatória**: migração antes do código novo, porque as colunas precisam existir quando a leitura passar a trazê-las. As duas migrações são aditivas — colunas com valor padrão e restrições sobre dados que hoje não violam nenhuma delas (as tabelas de permissão estão vazias).

### 16.5 Escalabilidade

Vertical, num servidor. Fora do escopo desta fatia.

### 16.6 Rollback

Reverter o código é suficiente: as colunas novas ficam ignoradas pelo código antigo, e nenhuma restrição nova recusa escrita que ele faria. **Reverter a migração não é necessário nem recomendado** — migração é imutável no projeto.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| US-01 | `empresa` ganha rota de criação e listagem; estado derivado de `suspensa_em` | §4.1, §7.2, `EmpresaService` |
| US-02 | Criação de pessoa pelo adaptador com campos fechados (D7) + Senha provisória | §11.4, `onboarding`, migração 0003 |
| US-03 | Reemissão regenera a derivação e invalida a anterior | §6.2, `onboarding` |
| US-04 | Marcação transacional + encerramento por pessoa da empresa (D5) | §7.4, §5.1 |
| US-05 | Limpeza da marcação; sessões **não** retornam | §7.4, RN-05 |
| US-06 | Listagem paginada no formato da ADR-0012, sem dado de negócio | §4.1, §4.2 |
| US-07 | Reuso da rota de admissão de administrador | §4.1, RN-13 |
| US-08 | Criação sob contexto de tenant, com vínculo criado na mesma transação | §7.4, D6 |
| US-09 | Ajustes com efeito bidirecional + coerência ação→tela + incremento do contador | §6.1, §6.3, §7.2 |
| US-10 | Troca de perfil com intenção declarada; ajustes removidos na mesma transação | §4.1.1, RN-11 |
| US-11 | `ativo = false` + encerramento das sessões da pessoa | §7.4, D5 |
| US-12 | `ativo = true`; efetivo preservado porque os ajustes não foram apagados | RN-06 |
| US-13 | Rota do produto substitui a nativa; recusa antes de qualquer escrita (D21) | §15.2, §21 |
| US-14 | Sessão publica 11 campos; os três novos vêm do efetivo | §4.2, §5.1 |
| US-15 | Comparação de versão + releitura + reescrita do registro de sessão (D4) | §5.1 passo 4, §7.4 |
| US-16 | `ACESSO_NEGADO` com `detalhes.exigido`, nas duas dimensões | §10.1, ADR-0011 |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|---|---|---|---|
| Framework | NestJS + Fastify | herdado | já em uso |
| ORM | Drizzle + drizzle-kit | herdado | schema e geração da migração 0003 |
| Driver | postgres.js | herdado | conexão e transação |
| Identidade | better-auth | 1.6.25 | campos adicionais, encerramento de sessão, limitador de taxa |
| Validação | Zod | herdado | validação de borda |
| Observabilidade | Pino + OpenTelemetry | herdado | registro e métricas |
| Teste | Vitest + embedded-postgres | herdado | instância efêmera (ADR-0006) |

**Nenhuma dependência nova.** Os três recursos que a fatia precisa do arcabouço de identidade — campos adicionais com escrita fechada, encerramento de sessão por pessoa e limitador de taxa — **já existem na versão instalada**, medidos pela fatia anterior.

---

## 19. Estratégia de Testes

> **Resumo**: 36 casos de teste | Unitários: 4 | Integração: 6 | E2E: 19 | Segurança: 7
> **Padrão**: Vitest com `embedded-postgres` (instância efêmera própria), `*.spec.ts` e `*.e2e.spec.ts` em `test/` por pacote. **Mock evitado por decisão** — 30 dos 36 casos atravessam banco ou HTTP real. Rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção INVARIANTES por arquivo.
> **Numeração**: CT-201 a CT-236 — a fatia anterior usou CT-001 a CT-106.
> **JSON lossless**: `_run/test-cases.json`.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | Empresa admitida sem intervenção manual | CT-221 |
| CA-02 | Senha provisória exibida uma única vez | CT-222 |
| CA-03 | Reemissão invalida a anterior | CT-223 |
| CA-04 | Suspensão encerra sessões na hora | CT-224 |
| CA-05 | Reativação não devolve sessões | CT-225 |
| CA-06 | Listagem sem dado de negócio | CT-226 |
| CA-07 | Socorro por administrador adicional | CT-227 |
| CA-08 | Admin cria pessoa com senha provisória | CT-222 |
| CA-09 | Concessão individual alcança uma chave | CT-202, CT-204, CT-211 |
| CA-10 | Retirada vence o default do perfil | CT-202, CT-203, CT-211 |
| CA-11 | Ação sem tela é recusada ao salvar | CT-205 |
| CA-12 | Troca de perfil sem intenção é recusada | CT-231 |
| CA-13 | Com intenção, ajustes são zerados | CT-231 |
| CA-14 | Desativação encerra na hora | CT-228 |
| CA-15 | Reativação devolve as permissões | CT-229 |
| CA-16 | Admin não alcança outra empresa | CT-207, CT-209, CT-230, CT-235 · **CT-237** (nem a si mesmo como alvo) |
| CA-17 | Sessão restrita antes da troca | CT-232 |
| CA-18 | Trocada a senha, alcança tudo | CT-233, CT-234 |
| CA-19 | Sessão publica telas e ações | CT-220 |
| CA-20 | Revogação vale na operação seguinte | CT-210, CT-217, CT-219 |
| CA-21 | Concessão vale na operação seguinte | CT-210, CT-218, CT-219 |
| CA-22 | Recusa nomeia a permissão | CT-214, CT-215, CT-211 |
| CA-23 | Cobertura das 17 chaves nos dois sentidos | CT-201, CT-202, CT-211, CT-212, CT-213 |

**Todos os 23 CA cobertos.** Três casos têm `criterios_aceitacao_validados` vazio de propósito, por serem fechamento de débito e não CA de produto: **CT-208** (P-T6-1), **CT-216** (ponto de aplicação único) e **CT-236** (P-T6-2).

**Cenários deliberadamente não cobertos** (registrados como risco, §20): custo da leitura de versão sob carga; retenção de `tentativa_login` (fora da fatia); corrida entre revogação e requisição em voo; evolução do catálogo além das 17 chaves.

### 19.1 Testes Unitários

#### Domínio: catálogo, matriz e efetivo (`packages/auth/test/autorizacao.spec.ts`)

Mock: nenhum — o SUT é função pura sobre constantes do próprio módulo.

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Mock | Setup |
|---|---|---|---|---|---|---|---|
| CT-201 | catálogo fechado e mapa total | CA-23 | Exatamente 10 telas e 7 ações, sem duplicata entre eixos; toda ação tem uma tela no mapa, e o valor pertence às 10 | as constantes do SUT, nunca lista redigitada | `telas.length===10`, `acoes.length===7`, união = 17; chaves do mapa = ações; valores ⊂ telas | — | — |
| CT-202 | efetivo por tabela sobre os 3 perfis | CA-09, CA-10, CA-23 | Para qualquer perfil e ajustes, efetivo = (matriz ∪ concedidas) − negadas, por **igualdade de conjunto inteiro** | tabela com um cenário por linha, 3 perfis × 3 estados da chave | cada linha igual ao esperado; sem ajustes devolve a matriz declarada | — | — |
| CT-204 | concessão alcança exatamente uma chave | CA-09 | A diferença simétrica entre efetivo com e sem a concessão tem cardinalidade 1 | `USUARIO_EMPRESA` ± `ACAO:emitir_boleto` | diferença simétrica = `['ACAO:emitir_boleto']` | — | — |
| CT-205 | ação sem tela é recusada, nomeando a tela | CA-11 | A validação recusa ação concedida cuja tela não está no efetivo resultante, e nomeia a tela | dois sentidos da incoerência + caso coerente | `CAMPO_INVALIDO`, `campo:'permissoes'`, `detalhes:{telaExigida, acao}`; coerente não levanta | — | — |

### 19.2 Testes de Integração

#### Dados + domínio, contra banco efêmero (`packages/db/test/permissao.spec.ts`)

Setup: instância efêmera própria (ADR-0006), migrações aplicadas, contexto de tenant fixado pela unidade de trabalho.

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-206 | conceder e negar a mesma chave é impossível | CA-09, CA-10 | A unicidade `(acesso_id, tipo, chave)` recusa a segunda linha do trio — precedência nunca precisa arbitrar dado inconsistente | duas linhas de efeito oposto no mesmo trio + par de controle | `23505` na restrição nomeada; controle sucede; contagens 1 e 1 | fixar contexto pela unidade de trabalho (tabela sob RLS forçada) |
| CT-207 | vínculo cross-tenant é impossível (D6) | CA-16 | A FK composta recusa vínculo cuja empresa difere da empresa da pessoa | incoerente, coerente e controle do Master sem empresa | `23503` na FK nomeada; coerente sucede; Master inserido com empresa nula | idem, mais leitura restrita de identidade |
| CT-208 | enum ganha valor sem mudar os anteriores (P-T6-1) | — | Acréscimo retrocompatível: 5 rótulos preservados com a mesma grafia, mais o novo | consulta ao catálogo + duas tentativas de origens distintas | 6 rótulos, nenhum renomeado; recusa de política grava o rótulo novo | imitar `packages/auth/test/auditoria.spec.ts` |
| CT-209 | efetivo montado sob RLS, sem filtro na aplicação | CA-16 | Ajustes de A invisíveis sob contexto de B; o único mecanismo de escopo é a política do banco | mesma consulta sob 3 contextos + varredura de fontes | 3 / 0 / 0 linhas; varredura devolve `[]` ocorrências de filtro; **mutante com filtro reprova** | alternar contexto pela unidade de trabalho |
| CT-210 | contador incrementa na mesma transação | CA-20, CA-21 | Incremento exatamente uma vez por operação que altere perfil ou ajustes; operação recusada não incrementa | 4 operações: ajuste válido, troca de perfil, ajuste recusado, mudança de nome | 1, 2, permanece 2 e contagem de ajustes inalterada, permanece 2 | escrita cruza `negocio` (RLS) e `identidade` (sem RLS) na mesma transação |
| CT-219 | efetivo reescrito só na divergência | CA-20, CA-21 | Ao divergir, servidor reescreve efetivo e versão no registro de sessão; sem divergência nada muda | leitura antes / requisição pós-mudança / requisição sem mudança | versões e arranjos conforme; segunda requisição não altera colunas | inspecionar `identidade.sessao` pelo acesso restrito |

### 19.3 Testes End-to-End

> 19 fluxos, todos por HTTP black-box contra servidor em porta dinâmica, com entrada real por `POST /v1/auth/sign-in/email`. Os quatro mais estruturais vêm detalhados; os demais em tabela, com invariante e validação-chave preservados.

#### Fluxo: as 17 chaves concedem e recusam (CT-211)
- **Framework**: HTTP black-box (Vitest + servidor real)
- **CA**: CA-23, CA-09, CA-10, CA-22
- **Objetivo**: para **cada** uma das 17 chaves, a rota que a exige responde sucesso a quem a tem e `403` nomeando-a a quem não a tem — os dois sentidos, sem exceção
- **Pré-condições**: tabela de 17 linhas **derivada do catálogo exportado**, nunca redigitada; duas sessões reais por chave, com efetivos controlados pela rota de Admin
- **Passos**: 1) montar as duas sessões por chave; 2) 17 chamadas positivas; 3) 17 negativas
- **Validações**: 17 respostas 2xx; 17 respostas `403` com corpo exatamente `{ codigo:'ACESSO_NEGADO', mensagem:<canônica>, detalhes:{ exigido:<chave> } }`, cada uma nomeando **a sua** chave

#### Fluxo: permissão retirada vale na operação seguinte (CT-217)
- **CA**: CA-20 · **Framework**: HTTP black-box
- **Objetivo**: retirar permissão faz a operação seguinte que dependia dela ser recusada, **mantém a sessão válida** e **não produz erro em nenhuma outra operação** que a pessoa ainda alcança
- **Pré-condições**: duas sessões simultâneas — a pessoa operando e o Admin da mesma empresa
- **Passos**: 1) rota X responde 2xx; 2) Admin nega a chave de X; 3) X de novo; 4) `GET /v1/sessao`; 5) rota Y, preservada
- **Validações**: X passa a `403` com `detalhes.exigido`; `GET /v1/sessao` responde **200** (não desconectou) e já não lista a chave; **Y continua 2xx** — as três asserções, não só a recusa

#### Fluxo: suspensão encerra sessões na origem (CT-224)
- **CA**: CA-04 · **Objetivo**: a suspensão **encerra** os registros de sessão de todas as pessoas da empresa no próprio ato — não os marca para recusa posterior
- **Validações**: contagem de sessões vai de 2 para **0**; operações com cookie anterior respondem `401`; nova entrada também é recusada enquanto durar a suspensão

#### Fluxo: rota nativa desligada e recusa antes da escrita (CT-234)
- **CA**: CA-18 · **Objetivo**: `/v1/auth/change-password` não é mais alcançável, e na rota do produto **toda recusa acontece antes** de a credencial ser gravada e antes de qualquer sessão ser apagada
- **Validações**: a rota nativa não troca a senha e a derivação permanece inalterada; **o inventário de `/v1/auth` passa a 5 entradas** sem `/change-password`; na rota do produto, pessoa desativada é recusada com a senha **intacta** e as sessões **preservadas** — o cenário exato do débito D21

| CT | Fluxo | CA | Objetivo (invariante) | Validação-chave |
|---|---|---|---|---|
| CT-214 | recusa nomeia a exigência | CA-22 | `403` no envelope literal com `detalhes.exigido`, distinguível de falta de sessão e de não encontrado | corpo com no máximo 4 chaves; `401` e `404` distintos |
| CT-215 | as duas dimensões são distinguíveis | CA-22 | O cliente sabe **qual** dimensão faltou | `detalhes.exigido` = `PERFIL:SYSLOC_MASTER` vs `TELA:usuarios` |
| CT-218 | concessão vale sem novo login | CA-21 | Mesmo cookie passa a ser aceito; sessão lista a chave e a versão incrementa | 403 → 2xx no mesmo cookie; nenhuma entrada nova |
| CT-220 | sessão publica 11 campos | CA-19 | Exatamente 11 chaves — os 8 herdados mais três | igualdade de conjunto de chaves, nem uma a mais |
| CT-221 | Master admite empresa | CA-01 | Empresa criada existe ativa na listagem sem intervenção externa | 201 com `estado:'ATIVA'`; Admin recebe 403 |
| CT-222 | senha exibida uma única vez | CA-02, CA-08 | Devolvida na criação e em nenhuma outra resposta | 0 ocorrências do literal nas consultas posteriores |
| CT-223 | reemissão invalida a anterior | CA-03 | A anterior deixa de servir; recusa **indistinguível** | corpo idêntico ao de credencial incorreta |
| CT-225 | reativação não devolve sessões | CA-05 | Devolve a capacidade de entrar, não as sessões | cookies antigos seguem 401; contagem continua 0 |
| CT-226 | listagem sem dado de negócio | CA-06 | Só identificação e estado por item | conjunto de chaves do item é exato |
| CT-227 | socorro por Admin adicional | CA-07 | Master admite outro Admin sem alcançar permissão nem dado | novo Admin administra; Master segue sem alcance |
| CT-228 | desativação encerra na hora | CA-14 | Encerra as sessões **da pessoa**, não da empresa | colega continua 2xx |
| CT-229 | reativação devolve o efetivo | CA-15 | Inclui os ajustes individuais preservados | efetivo igual ao instantâneo anterior |
| CT-231 | troca de perfil exige intenção | CA-12, CA-13 | Recusa informando quantos; declarada, remove todos | `422` com `ajustesDescartados:3`, nada alterado; depois 0 ajustes |
| CT-232 | sessão restrita não alcança nada | CA-17 | Só a própria sessão e a troca; inclusive as rotas novas recusam | `403` nomeando a pendência nas três rotas |
| CT-233 | trocada a senha, alcança tudo | CA-18 | A marca cai e a **mesma** sessão passa a alcançar o efetivo | rota antes recusada responde 2xx |
| CT-236 | limitador é camada adicional | — | Limitador recusa acima do limite **e** bloqueio por conta continua trancando | as duas asserções na mesma execução |

### 19.4 Cenários de Erro e Segurança

| Cenário | CA | Objetivo (invariante) | Trigger | Status / Resultado Esperado |
|---|---|---|---|---|
| **CT-203** — a negação vence por todos os caminhos | CA-10 | Chave negada nunca aparece no efetivo, qualquer que seja o perfil, a coexistência de concessão e a **ordem** dos ajustes | 3 caminhos × 2 ordens | negada ausente nos 6; **mutante `(perfil − negadas) ∪ concedidas` REPROVA** em 2 caminhos |
| **CT-212** — rota sem declaração é recusada | CA-23 | Rota publicada sem declaração recusa até para a sessão de maior alcance; só a marca explícita libera | duas rotas gêmeas que diferem só na declaração | sem declaração `403` para Master **e** Admin; com marca, 200 |
| **CT-213** — nenhuma rota publicada sem declaração | CA-23 | Duas asserções: **(a)** entre as rotas que a guarda governa, o conjunto sem declaração é **vazio**; **(b)** o conjunto das rotas **públicas** é exatamente o inventário esperado | enumeração do roteador montado | (a) conjunto `[]`, e **com rota sem declaração registrada REPROVA nomeando-a**; (b) igualdade de conjunto com o inventário, e **marcar uma rota de negócio como pública REPROVA** |
| **CT-216** — decisão consultada num ponto só | — | O módulo de decisão é consumido por **exatamente um** arquivo de `apps/api/src` | varredura de fontes pelo símbolo | cardinalidade 1; **com segunda consulta plantada, REPROVA nomeando o intruso** |
| **CT-230** — Admin não alcança outra empresa | CA-16 | Pessoa resolvida pelo vínculo tenantizado: sob o contexto de A, o vínculo de B não existe | 5 rotas de `:id` com identificador de outra empresa | `404 RECURSO_NAO_ENCONTRADO`; identificador de B não aparece em nenhuma serialização |
| **CT-234** — rota nativa desligada (D21) | CA-18 | Ver bloco detalhado em §19.3 | — | inventário de 6 → 5 rotas |
| **CT-235** — campos fechados (D7) | CA-16 | Nenhum caminho autenticado altera `perfil` ou `empresa_id` pelo corpo | 3 tentativas, incluindo a **troca lateral** que passa pela restrição existente | colunas idênticas antes e depois; nenhuma resposta 2xx confirma escrita; **abrir a escrita REPROVA** |

> **Cinco provas de falsificação são obrigatórias** — CT-203, CT-209, CT-213, CT-216 e CT-235. Todas devem rodar por `pnpm --filter @sysloc/<pacote> test`, **nunca** por `vitest run` avulso: o pacote resolve pela fronteira e o mutante não alcançaria o que executa, produzindo falso negativo. A `testing-stack.md` documenta a medição que fixa essa regra.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **A precedência da negação ser burlada por um caminho de leitura** — permissão retirada continua valendo | Média | **Crítico** (é o eixo de segurança da fatia) | CT-203 com mutante de ordem nos 3 caminhos; unicidade do trio (CT-206) impede o dado inconsistente que exigiria arbitragem |
| **Segunda avaliação de autorização nascer num manipulador** — a regra instalada por ponto sobrevive até o ponto seguinte | Média | Alto | CT-216 por varredura de fontes, com mutante que planta a segunda consulta |
| **Rota nova nascer sem declaração** e passar despercebida | Alta (ao longo das F2–F5) | Alto | Default fechado + CT-213 sobre o roteador montado; o esquecimento vira `403`, não abertura |
| **Correção do D7 abrir escrita de `perfil`/`empresa_id`** — elevação de privilégio ou fuga de tenant | Baixa | **Crítico** | CT-235 pelo vetor da troca lateral, que a restrição existente não pega |
| **Desligar `/change-password` quebrar outra rota do encaminhador** | Baixa | Alto | CT-234 assere o inventário completo, não só a ausência da rota removida |
| **Migração falhar por ordenação do acréscimo ao enum** | Média | Médio | Migração separada (`0004`), à mão, com a ordenação exigida pelo banco |
| **Custo da leitura de versão sob carga** — não medido | Baixa | Médio | Declarado, não testado. O caminho comum não acrescenta consulta; se medir mal, o plano B do discovery (D1) é local à guarda e não muda contrato |
| **Corrida entre revogação e requisição em voo** | Baixa | Baixo | Aceito. Janela de milissegundos; pior desfecho é uma requisição atendida com o efetivo anterior |
| **Contador não incrementado numa escrita nova** — revogação que não reflete | Média | Alto | CT-210 cobre as 4 operações; a regra é invariante transacional declarada (RN-17) |

---

## 21. Observações Técnicas

### Mudança de escopo declarada — o inventário de `/v1/auth` (CT-018 d)

O desligamento de `/v1/auth/change-password` **reduz de 6 para 5** as rotas que o encaminhador publica, e o `CT-018 (d)` da fatia anterior fixa esse inventário **por asserção**. A edição daquele caso é **mudança de escopo deliberada desta fatia**, não ajuste de teste — e precisa vir acompanhada da linha:

```
SUT_IS_CORRECT_BECAUSE: o desligamento da rota nativa de troca de senha é entrega
declarada desta fatia (decisão D7 do tech-alignment, fechamento do débito D21);
o inventário de 6 rotas descrevia o estado anterior, e a rota removida grava a
credencial antes de conferir a política — que é o defeito que o D21 mediu.
```

Sem essa linha, o Gate 1 classifica a alteração como `weakening_test_to_pass` (AP-24), que é **crítico**. Com ela, é o registro correto de uma superfície que mudou de propósito.

### Marcadores a remover no mesmo commit da correção

`packages/auth/src/autenticacao.ts` carrega os marcadores `DÉBITO COM GATILHO` do **D7** e do **D21**. Fechados os débitos, os marcadores **saem no mesmo commit**, e as linhas correspondentes saem do índice do `CLAUDE.md` — a §3-B do Protocolo Antirregressão trata marcador de débito resolvido como *"pior que nenhum"*. O **D5** não tem marcador; sai apenas do relatório.

### ADRs Aplicáveis nesta Feature

Inventário confrontado contra o texto literal da `Decision` de cada ADR aplicável.

- **ADR-0012 — Forma canônica do contrato, com a chave exposta variando por classe de entidade** · **APLICÁVEL**. Conformidade literal: as rotas expõem **UUID** para empresa e pessoa, que a `Decision` classifica como entidades de identidade (§4.2); o corpo fala camelCase; a listagem usa `{ itens, total, limite, deslocamento }` (§4.1); o erro traz `{ codigo, mensagem, campo?, detalhes? }` com código de enum fechado, e **nenhum código novo entra** (§10.1). **Esta ADR nasceu deste tech spec**: o conflito entre o texto anterior (*"todo recurso… com o UUID como PK interna que não trafega"*) e as rotas de identidade foi detectado na FASE 4A, escalado, e resolvido superseder a ADR-0007.
- **ADR-0011 — Cobertura de autorização declarada por rota, com default que nega** · **APLICÁVEL**. Conformidade literal: *"duas dimensões independentes — perfil e chave do catálogo fechado"* → §4.1 coluna `Auth`; *"a rota que não declara nada é recusada"* → §5.1 passo 1 e CT-212; *"propriedade consultada sobre a superfície publicada… nunca uma lista de exceções mantida à mão"* → `cobertura-de-autorizacao.ts` enumera o roteador montado (CT-213).
- **ADR-0010 — Efetivo do perfil com overrides, transportado na sessão, revalidado por versão** · **APLICÁVEL**. Conformidade literal: *"perfil somado aos overrides, com a negação vencendo"* → RN-01 e CT-203; *"contador de versão por usuário"* → §7.2, coluna em `identidade.usuario`; *"divergiu, o servidor relê o efetivo e atende — em vez de recusar"* → §5.1 passo 4 e CT-219.
- **ADR-0009 — Fronteira identidade × negócio por schema** · **APLICÁVEL**. Conformidade literal: *"identidade, sem noção de tenant"* — a unicidade `(id, empresa_id)` acrescentada em `identidade.usuario` **não introduz política de isolamento**; é alvo de referência, não regime de tenant (§7.2). *"negócio, onde toda tabela nasce vinculada a empresa, com RLS habilitada e forçada"* — nenhuma tabela nova nasce em `negocio`, e a guarda de cobertura não muda de conjunto.
- **ADR-0008 — Isolamento garantido pelo banco** · **APLICÁVEL**. Conformidade literal: *"nenhum filtro por empresa na aplicação"* → o efetivo é montado sob o contexto fixado por `SET LOCAL`, e o **CT-209** prova por varredura mais mutante. *"FK composta como padrão de referência entre entidades tenantizadas"* → o D6 **estende** essa forma a uma referência de `negocio` para `identidade`; é aplicação da mesma primitiva a uma fronteira que a ADR não nomeia, não contradição.
- **ADR-0006 — Ambiente de verificação separado** · **APLICÁVEL**. Toda a suíte roda contra instância efêmera própria; nenhum caso alcança o ambiente que atende a operação.
- **ADR-0005 — Rotinas operacionais versionadas, sem credencial no repositório** · **PARCIAL**. Esta fatia não cria rotina agendada; a Senha provisória **nunca** é escrita em script, arquivo versionado ou registro.
- **ADR-0007** · **SUPERSEDED por 0012** em 2026-08-04, nesta fatia. Não é mais fonte.
- **ADR-0001, 0002, 0003, 0004** · **N/A**. A 0001 trata de cobrança bancária (F4). As 0002, 0003 e 0004 nomeiam primitivas do Frappe (estrutura versionada do app, `Custom DocPerm`, `Server Script`) e não alcançam esta stack. ⚠️ **Observação para o usuário**: as três continuam `accepted` no corpus, embora o `CLAUDE.md` declare que a 0002 e a 0003 morreram com o Frappe — divergência de registro, fora do escopo desta spec.

### Candidatos a ADR (FASE 4B)

Aplicados os 5 critérios canônicos a cada decisão técnica desta spec:

- **Transação única cruzando as duas fronteiras de schema** (ajuste em `negocio` sob RLS + contador em `identidade` sem RLS, num commit) — **Candidato a ADR parcial (4/5)**. Passa em C1 (toda fatia que escreva permissão repetirá), C2 (`data`/`architecture`), C4 (a coexistência de dois regimes numa transação surpreende) e C5 (a alternativa — duas transações com reconciliação — foi considerada e rejeitada). **Falha em C3**: reverter é local à unidade de trabalho, não é refactor ≥ médio. Fica registrado em §7.4.
- **Transição de estado por sub-recurso** em vez de `PATCH` no recurso — **0-1/5**. É convenção de superfície, não decisão arquitetural; registrada em §4.1 e no tech-alignment.
- **Migração gerada + migração à mão como par** — **0-1/5**. É o precedente já estabelecido pela `0001_seguranca.sql`, não decisão nova.

**Candidato confirmado (5/5), acrescentado pela sessão de challenge de 2026-08-04:**

- **O alcance da garantia do operador do SaaS** — ela vale para a **sessão** do Master, não para credencial que ele emite; emitir credencial é poder distinto, aceito e auditado. **C1**: vale para qualquer caminho futuro de emissão, incluindo o envio por e-mail da F3. **C2**: `security`, `auth`. **C3**: reverter implica mudar o modelo de onboarding fixado pelas decisões 14 e 39. **C4**: é exatamente o ponto em que um gate lê contradição entre duas afirmações verdadeiras. **C5**: restringir o alvo da reemissão vs. não restringir, e o convite por link já rejeitado pelas decisões 14/39.

```bash
/agent-spec-adr-create "o alcance da garantia do operador do SaaS vale para a sessao dele, nao para credencial que ele emite"
```

Além dele, as duas decisões que qualificavam já viraram ADR nesta sessão (0010 e 0011), e a terceira produziu a supersede (0012).

### Sessão de challenge — 2026-08-04

Quatro ajustes inline, todos confrontados contra o código real antes de virarem pergunta:

1. **Limite da garantia do Master declarado** (§11.2) e **alvo da reemissão restrito a `ADMIN_EMPRESA`** (§4.1). O onboarding entrega credencial alheia ao Master; a garantia da fatia anterior é sobre a sessão dele. Estava implícito e leria como contradição no gate.
2. **Regra de rotas públicas na verificação de cobertura** (§5.1 e CT-213). O código retorna antes para rota pública, o que tornava **inócua** a modificação que a spec pedia em `saude.controller.ts` — removida do §3.6. O CT-213 ganhou uma segunda asserção, sobre o inventário das públicas, para que a marca não vire porta sem contador.
3. **Alcance de `/v1/usuarios` canonizado** (§4.2 e glossário-feature). O caminho usa um termo que o glossário global marca como ambíguo, e entra na superfície que congela; mantido por espelhar a área de tela que o autoriza, com o alcance registrado.
4. **Matriz do `SYSLOC_MASTER` declarada vazia** (§4.2), com a razão estrutural: as 17 chaves são do app da imobiliária, e ele não pode sequer ter ajustes individuais, porque eles vivem presos ao vínculo de acesso.

### Termos de domínio — canonizados em 2026-08-04

Os quatro termos foram para o **glossário global** (`docs/specs/domain-glossary.md`): **Área de tela**, **Ação sensível**, **Efetivo de permissão** e **Ajuste individual** — todos são consumidos pelas fases seguintes, que declararão exigência por chave e lerão o efetivo. O global ganhou também três relacionamentos e a ambiguidade *"permissão" (a chave) × "permissão" (o conjunto)*.

Dois termos ficaram no **glossário-feature** (`docs/specs/features/autorizacao-e-ciclo-de-acesso/domain-glossary.md`, criado nesta sessão): **Área de tela "Usuários"**, com o alcance canonizado, e **Intenção declarada**, que é regra operacional desta feature.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD — as 16 US mapeadas em §17, e também em §5.3 (visões distintas)
- [x] Resumo técnico claro e objetivo (§2)
- [x] Arquitetura definida com componentes e camadas (§3)
- [x] Contratos de API com payloads, status e schemas (§4)
- [x] Fluxos de negócio descritos (§5)
- [x] Regras de processamento e validações — 15 RN do PRD rastreadas, mais 2 técnicas (§6)
- [x] Persistência: tabelas, índices, migrações, transação (§7)
- [x] Integrações externas — N/A justificado (§8)
- [x] Sincronização: eventos N/A, idempotência declarada (§9)
- [x] Gerenciamento de erros e resiliência (§10)
- [x] Segurança: autenticação, autorização, criptografia, sanitização (§11)
- [x] Performance: metas, estratégias, limites (§12)
- [x] Logs, métricas, tracing e alertas (§13)
- [x] Feature flags — N/A justificado (§14)
- [x] Versionamento de API, com a remoção deliberada declarada (§15)
- [x] Deploy e infraestrutura (§16)
- [x] Dependências externas — nenhuma nova (§18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada, com rastreabilidade CA→CT e os 23 CA cobertos (§19)
- [x] Riscos técnicos identificados (§20)
- [x] Observações técnicas: mudança de escopo declarada, marcadores a remover, inventário de ADRs com conformidade literal, candidatos a ADR (§21)
- [x] Arquivos envolvidos — árvore + criar/modificar/referência (§3.4–3.7)
- [x] Cada CT aparece uma única vez, em exatamente uma camada
- [x] Pronto para geração das TASKS
