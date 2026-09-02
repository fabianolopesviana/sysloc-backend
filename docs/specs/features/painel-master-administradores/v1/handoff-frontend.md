# Backend Contract Handoff — Painel Master · Ciclo de vida de Empresa e Admin Empresa

> **Gerado em:** 2026-09-02
> **Fonte primária:** código backend em execução (`apps/api/src/master/**`, `packages/db/src/**`),
> conferido contra a suíte verde (`@sysloc/api` — **455 casos, exit 0**).
> **Referências:** `tech_spec.md` · `plano-de-origem.md` · `pre-refinement.md` · `tasks/T1..T8.md` ·
> `_run/run-report.md` · ADR-0011, ADR-0013, ADR-0014, ADR-0016, ADR-0017, ADR-0021, ADR-0026,
> ADR-0030, **ADR-0038**, **ADR-0039**.
> **Estado do backend:** **8/8 tasks concluídas**, aprovadas nos dois gates. As 7 rotas estão
> publicadas, cobertas por teste automatizado e em execução.

---

## 0. Como ler este documento

### 0.1 Ele é autossuficiente — e qual a relação com o handoff geral do Master

Este documento é **completo para implementar esta fatia**: quem o receber não precisa de acesso a
este repositório. Ele carrega o contrato integral das operações, o fluxo de sessão que as precede,
os erros, os estados de tela, as fixtures e os testes mínimos.

⚠️ **Existe um segundo documento, e os dois NÃO se contradizem — eles têm recortes diferentes:**

| Documento | Recorte | Quando usar |
|---|---|---|
| `docs/plano-backend-novo/handoff-master-frontend.md` | **O Painel Master inteiro** — as **13** rotas, o app como um todo, telas, ambiente e publicação | Implementar ou manter o painel como produto |
| **este arquivo** | **Só esta fatia** — as **7 rotas novas** mais a mudança aditiva numa oitava, com a rastreabilidade até a spec e as ADRs | Implementar esta entrega, auditar drift, revisar o que mudou |

**Em divergência entre os dois, este vence para o que é desta fatia** — ele foi extraído do código
depois da última task, e cita arquivo e linha. Para o que está fora dela (entrada, troca de senha,
configuração do segundo fator, criação de empresa), o geral é a fonte, e a §1.3 abaixo reproduz o
essencial.

### 0.2 Convenções deste documento

- Toda afirmação não-óbvia carrega `<!-- fonte: arquivo:linha -->`.
- `[DÚVIDA]` — bloqueia ou pode causar drift; **não adivinhe**.
- `[HIPÓTESE]` — inferência razoável; pode prosseguir, mas valide.
- Nomes de campo, códigos e literais estão **exatamente** como o servidor os emite. Não normalize
  caixa, não traduza, não abrevie.

---

## 1. Feature

**O Painel Master ganha o ciclo de vida completo das duas entidades que ele governa** — a Empresa
(tenant) e o **Admin Empresa** (a pessoa que administra a imobiliária).

Até esta fatia o painel era uma **superfície de mão única**: o operador criava a empresa, admitia um
administrador, recebia a senha provisória — e nunca mais enxergava aquela pessoa. O `usuarioId` só
existia no instante da admissão, e por isso a reemissão de senha vivia num menu pedindo o UUID à mão.
<!-- fonte: docs/specs/features/painel-master-administradores/v1/plano-de-origem.md:34-52 -->

**O que o frontend passa a poder entregar:**

1. **Listar** os Admin Empresa de cada empresa, com estado e o `usuarioId` de cada um.
2. **Suspender** e **reativar** um administrador — derrubando as sessões dele **no ato**.
3. **Corrigir** o cadastro (nome e e-mail) de administrador e de empresa.
4. **Remover em definitivo** administrador e empresa, com a **prévia de elegibilidade por linha**:
   o servidor diz, antes do clique, se a exclusão está disponível — e, quando não está, **por quê** e
   **o que fazer no lugar**.
5. **Mover a reemissão de senha provisória** do menu para a ação de linha — sem uma linha de backend
   novo: ela sempre recebeu o `usuarioId` no caminho; o que faltava era a listagem que o fornece.
   <!-- fonte: plano-de-origem.md:56-62 -->

### 1.1 Glossário — use estes termos na UI

| Termo canônico | O que é | Evite |
|---|---|---|
| **Master** / operador do SaaS | A persona única que opera este painel. Perfil `SYSLOC_MASTER`. Vive **fora** de qualquer empresa | "admin", "superusuário", "root" |
| **Empresa** | O tenant — uma imobiliária cliente | "cliente", "conta", "organização" |
| **Admin Empresa** | A pessoa que administra uma empresa. Perfil `ADMIN_EMPRESA` | "usuário", "administrador" (ambíguo com o Master) |
| **Usuário Empresa** | A equipe interna da imobiliária. Perfil `USUARIO_EMPRESA`. **O Master não a alcança** | — |
| **Senha provisória** | Credencial de primeiro acesso, entregue **uma única vez** | "senha temporária", "token" |
| **Suspensão** | Estado **reversível**, com sessões encerradas | "bloqueio", "desativação", "exclusão" |
| **Remoção definitiva** / exclusão | A linha **deixa de existir**. Sem lixeira, sem desfazer | "arquivar", "excluir logicamente" |
| **Prévia de exclusão** (`exclusao`) | O objeto por item que diz se a remoção está disponível **agora** | "permissão", "flag" |
| **Impedimento** | A **classe** do que bloqueia a remoção. Nunca a entidade, nunca a quantidade | "erro", "dependência" |

### 1.2 As duas personas que o painel NÃO alcança

⚠️ **O Master não acessa dado de negócio de empresa alguma, e isso é garantido pelo banco.** As
tabelas de negócio têm isolamento por empresa forçado no PostgreSQL (`FORCE ROW LEVEL SECURITY`), e a
sessão do Master carrega `empresaId: null`. Uma tela que tente listar imóveis, contratos ou cobranças
**não recebe lista vazia: recebe `403`** — e isso é o desenho, não um defeito a contornar.
<!-- fonte: tech_spec.md §7.1; ADR-0009, ADR-0013 -->

Consequência direta desta fatia: **a listagem de administradores devolve apenas `ADMIN_EMPRESA`**. O
Usuário Empresa da imobiliária **não aparece**, e o próprio operador também não. Isso é decisão de
produto registrada (decisão nº 3 do plano), não um filtro que a tela deva refazer.
<!-- fonte: plano-de-origem.md:82; administrador.controller.ts:163-164 -->

### 1.3 Pré-requisitos de sessão — sem isto, tudo responde `403`

Nenhuma operação desta fatia funciona antes de a sessão estar **completa**. O fluxo é condicional e
guiado por `GET /v1/sessao`.

**Entrar:**

```http
POST /v1/auth/sign-in/email
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Se a conta tiver segundo fator ativo, o corpo de `200` é **exatamente** este — e a sessão **ainda não
está completa**:

```json
{ "twoFactorRedirect": true, "twoFactorMethods": ["totp"] }
```

Então:

```http
POST /v1/auth/two-factor/verify-totp
{ "code": "123456" }
```

**Depois de entrar, SEMPRE consulte `GET /v1/sessao`:**

```json
{
  "usuarioId": "uuid",
  "nome": "...",
  "email": "...",
  "perfil": "SYSLOC_MASTER",
  "empresaId": null,
  "empresaNome": null,
  "senhaProvisoria": false,
  "segundoFatorPendente": false,
  "telas": [],
  "acoes": [],
  "versaoPermissoes": 0
}
```

| Bandeira | Enquanto for `true` | Como resolver |
|---|---|---|
| `senhaProvisoria` | **toda** rota desta fatia responde `403` | `POST /v1/sessao/senha` |
| `segundoFatorPendente` | idem | `POST /v1/auth/two-factor/enable` → `verify-totp` |

⚠️ **`telas` e `acoes` vêm VAZIOS para o Master, e isso é correto.** Ele opera por **perfil**, não por
permissão de tela. Se você espelhar o menu nessas listas, o painel fica sem menu nenhum.

⚠️ **O segundo fator é obrigatório para o Master**, não opcional. E **não exponha**
`POST /v1/auth/two-factor/disable` no painel: desligá-lo devolve a sessão ao estado restrito.

⚠️ **Ao receber `403`, refaça `GET /v1/sessao` e roteie pelas duas bandeiras booleanas** — o `403` da
sessão restrita **não traz `campo` nem `detalhes`**, e a `mensagem` é texto para exibir, não
discriminador. <!-- fonte: handoff-master-frontend.md §3.2; apps/api/src/autenticacao/sessao-restrita.ts:121-130 -->

**Sessão:** cookie `httpOnly` + `Secure` + `SameSite=Lax`, **8 horas de inatividade**, renovada a cada
requisição. O navegador envia sozinho — **o frontend não lê nem guarda token**. Use
`credentials: 'include'`.

⚠️ **A API não fala CORS**, e isso é arranjo de publicação, não pendência: o painel é servido no
domínio dele e o servidor de borda encaminha `/v1/*` para a API **no mesmo host**. Em
desenvolvimento, use **proxy** de `/v1/*` — não aponte o app direto para a API.
<!-- fonte: handoff-master-frontend.md §2, §8 -->

---

## 2. Escopo

### 2.1 Entra

- As **7 operações novas** (§3), com contrato, erros, estados e fixtures.
- A **mudança aditiva** em `GET /v1/master/empresas`: cada item passou a carregar `exclusao`.
- As **3 operações pré-existentes** que as telas desta fatia consomem como ação de linha
  (reemissão de senha, suspensão e reativação de empresa) — documentadas em §4.10 por
  conveniência de implementação, com o contrato completo no handoff geral.
- **Versão da API alvo:** `v1`. Todos os caminhos abaixo são relativos ao endereço da API com o
  prefixo `/v1`.

### 2.2 NÃO entra

- **Entrada, troca de senha provisória e configuração do segundo fator** — pré-requisitos, resumidos
  na §1.3; contrato integral no handoff geral, §3.
- **Criação de empresa e admissão de administrador** — pré-existentes e inalteradas por esta fatia.
- **Qualquer leitura de dado de negócio** — por desenho (§1.2).
- **Busca, filtro e ordenação declarável** — não existem em rota alguma desta fatia (§8.2).
- **`PATCH` / atualização parcial** — não existe na base. As duas correções são `PUT` com corpo
  completo. <!-- fonte: administrador.contrato.ts:344-346 -->

### 2.3 O que esta fatia **não** mudou, e é importante saber

- **Nenhuma rota do app da imobiliária** foi acrescentada, removida ou alterada. O congelamento da
  superfície publicada alcança o que o pacote de contratos entrega ao cliente; `/v1/master/*` está
  **fora** dele por decisão registrada na **ADR-0039**. <!-- fonte: plano-de-origem.md:63-70 -->
- **Nenhuma migração de banco.** O critério de exclusão é imposto pelas chaves estrangeiras
  `ON DELETE no action` que já existiam.
- **A reemissão de senha provisória não ganhou uma linha de código.** Ela sempre recebeu o
  `usuarioId` no caminho.

---

## 3. Backend Entry Points

| # | Operação | Transporte | Método | Path | Estado |
|---|---|---|---|---|---|
| R1 | Listar os Admin Empresa de uma empresa | REST | `GET` | `/v1/master/empresas/{id}/administradores` | **novo** |
| R2 | Suspender um Admin Empresa | REST | `POST` | `/v1/master/usuarios/{id}/suspensao` | **novo** |
| R3 | Reativar um Admin Empresa | REST | `POST` | `/v1/master/usuarios/{id}/reativacao` | **novo** |
| R4 | Corrigir o cadastro de um Admin Empresa | REST | `PUT` | `/v1/master/usuarios/{id}` | **novo** |
| R5 | Remover um Admin Empresa em definitivo | REST | `DELETE` | `/v1/master/usuarios/{id}` | **novo** |
| R6 | Corrigir o cadastro de uma empresa | REST | `PUT` | `/v1/master/empresas/{id}` | **novo** |
| R7 | Remover uma empresa em definitivo | REST | `DELETE` | `/v1/master/empresas/{id}` | **novo** |
| R8 | Listar empresas | REST | `GET` | `/v1/master/empresas` | **alterada** (ganhou `exclusao` por item) |
| A1 | Reemitir Senha provisória | REST | `POST` | `/v1/master/usuarios/{id}/senha-provisoria` | pré-existente |
| A2 | Suspender empresa | REST | `POST` | `/v1/master/empresas/{id}/suspensao` | pré-existente |
| A3 | Reativar empresa | REST | `POST` | `/v1/master/empresas/{id}/reativacao` | pré-existente |

**Autenticação:** todas exigem sessão por cookie **e** perfil `SYSLOC_MASTER`, declarado na classe do
controlador. Não há chave de catálogo de permissão envolvida — a governança é a **dimensão de
perfil** (ADR-0011). <!-- fonte: administrador.controller.ts:151-153; empresa.controller.ts:381-383 -->

**Eventos / realtime:** **nenhum**. Esta fatia não publica nem consome evento, não enfileira trabalho
e não tem efeito assíncrono. Toda operação é síncrona e o efeito está commitado quando a resposta
chega. <!-- fonte: tech_spec.md §4.3, §9.1 -->

---

## 4. Contratos

### 4.0 O envelope de erro — idêntico em toda recusa

**Toda** recusa desta fatia usa a mesma forma (ADR-0017):

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "id",
  "detalhes": { }
}
```

- `codigo` e `mensagem` são **sempre** presentes; `campo` e `detalhes` são opcionais.
- ⚠️ **Classifique pelo `codigo`, nunca pela `mensagem`.** O texto é para exibir; a lógica é do código.

**Os códigos que esta fatia produz:**

| `codigo` | HTTP | Mensagem literal | Quando |
|---|---|---|---|
| `CAMPO_INVALIDO` | 422 | `requisição inválida` | validação, alvo de outro perfil, e-mail/documento em uso, exclusão impedida |
| `RECURSO_NAO_ENCONTRADO` | 404 | `recurso não encontrado` | empresa ou pessoa inexistente |
| `NAO_AUTENTICADO` | 401 | `sessão inválida ou expirada` | sem cookie, ou sessão expirada |
| `ACESSO_NEGADO` | 403 | `acesso negado para esta sessão` ⚠️ **só no perfil errado** — ver abaixo | perfil errado, **ou sessão restrita** (§1.3) |
| `ERRO_INTERNO` | 500 | `erro interno no processamento da requisição` | falha não prevista |
| `SERVICO_INDISPONIVEL` | 503 | `serviço temporariamente indisponível` | dependência indisponível |

<!-- fonte: packages/shared/src/erros.ts:43-51; apps/api/src/comum/filtro-excecao.ts:101-115 -->

⚠️ **A `mensagem` de `ACESSO_NEGADO` NÃO é uma só — a sessão restrita emite outra, mais longa.**
O literal da tabela é o do filtro global, que vale para o perfil errado. A guarda da sessão restrita
**nomeia a exigência pendente**, e por isso monta a frase: abertura fixa
`acesso negado: esta sessão está restrita até `, mais o que falta cumprir — `a troca da senha
provisória` e/ou `a configuração do segundo fator`, unidas por ` e ` quando as duas pendem. São,
portanto, **três** textos possíveis:

```text
acesso negado: esta sessão está restrita até a troca da senha provisória
acesso negado: esta sessão está restrita até a configuração do segundo fator
acesso negado: esta sessão está restrita até a troca da senha provisória e a configuração do segundo fator
```

<!-- fonte: apps/api/src/autenticacao/sessao-restrita.ts:122-130 -->

⚠️ **Isto NÃO muda a regra de decisão**: o `codigo` continua sendo `ACESSO_NEGADO` nos dois casos, e
é por ele que a tela decide (§6 manda refazer `GET /v1/sessao` e rotear pelas bandeiras). O que muda
é que **exibir a `mensagem` do servidor** entrega ao operador um texto acionável na sessão restrita e
um texto genérico no perfil errado — não escreva o literal da tabela na tela como se fosse único, e
não case a string para distinguir os casos: as bandeiras de `GET /v1/sessao` é que dizem qual é qual.

⚠️ **`429` NÃO existe em rota desta fatia.** O limitador de taxa vive só sob `/v1/auth/*` e em
`POST /v1/sessao/senha`. Não programe *backoff* aqui.

#### Como ler o `campo` — ele nomeia o culpado quando há um a nomear, e só então

| Situação | `campo` |
|---|---|
| Propriedade ou parâmetro **conhecido** recusado | o nome dele — `"nome"`, `"email"`, `"documento"`, `"deslocamento"` |
| **Chave desconhecida** em corpo fechado | `"corpo"` — **não** a chave que você enviou |
| **Parâmetro desconhecido** na cadeia de consulta | `"limite"` — **não** o parâmetro que você enviou |
| Identificador do caminho | `"id"` |

⚠️ Nos dois casos de chave desconhecida, destacar um input pelo `campo` destacaria o **controle
errado**. Trate-os como erro do formulário inteiro. O **nome da chave recusada** está disponível: o
esquema de entrada é `z.strictObject`, e a recusa carrega `unrecognized_keys` internamente — mas
**a resposta HTTP não o publica**. `[DÚVIDA]` está registrada na §11.
<!-- fonte: apps/api/src/comum/validacao.ts:50-63 -->

#### O vocabulário fechado de impedimentos (RN-15)

`exclusao.impedimentos` e `detalhes.impedimentos` carregam **classes**, nunca o nome da entidade,
nunca a quantidade, nunca a mensagem do banco. São **exatamente cinco**, e o conjunto é fechado:

| Classe | O que significa | Aparece em |
|---|---|---|
| `REGISTROS_DE_NEGOCIO` | A **empresa** tem registros de negócio (imóveis, contratos, cobranças, locadores, locatários, fiadores, configurações…) | empresa |
| `ADMINISTRADORES_NAO_ELEGIVEIS` | A **empresa** tem pessoas que não puderam ser removidas — cada uma sujeita ao próprio critério | empresa |
| `TENTATIVA_DE_ENTRADA` | A **pessoa** já tentou entrar ao menos uma vez, e a trilha de auditoria é preservada | pessoa |
| `VINCULO_DE_ACESSO` | A **pessoa** tem vínculo de acesso ao aplicativo | pessoa |
| `AUTORIA_EM_REGISTRO` | A **pessoa** consta como autora de um registro (certificado, conferência bancária, emissão em lote, entrega de notícia, identidade no provedor) | pessoa |

<!-- fonte: packages/db/src/administrador-do-master.ts:153-158, 265-307 -->

⚠️ **`impedimentos` é um array e pode trazer mais de uma classe.** Traduza cada uma; não assuma
tamanho 1.

⚠️ **A tradução para texto humano é do frontend**, e é intencional: o servidor entrega a classe
justamente para que a tela redija a frase. O que o servidor **já** entrega pronto é a
`alternativa` — veja §4.5.

---

### 4.1 R1 · Listar os Admin Empresa de uma empresa

- **Tipo:** REST · **Método:** `GET` · **Path:** `/v1/master/empresas/{id}/administradores`
- **Auth:** obrigatória — cookie de sessão · **Permissões:** perfil `SYSLOC_MASTER`
- **Idempotência:** leitura pura · **Cache:** sem cabeçalho de cache; **não** cachear (ver §8.3)

**Request**

| Onde | Nome | Tipo | Obrigatório | Regra |
|---|---|---|---|---|
| path | `id` | `string` (uuid) | sim | UUID da **empresa**. Validado **antes** de qualquer consulta |
| query | `limite` | `integer` | não | `1..50`, padrão **25** |
| query | `deslocamento` | `integer` | não | `>= 0`, padrão **0** |

⚠️ **A cadeia de consulta é FECHADA.** Parâmetro desconhecido (`?busca=`, `?estado=`, `?_t=`) responde
`422` com `campo: "limite"`. Não acrescente cache-busters.
<!-- fonte: administrador.contrato.ts:151-159 -->

⚠️ **O teto é 50, e não os 200 da listagem de empresas** — e o número saiu de **medição**, não de
cópia: cada item exige uma sonda de elegibilidade que é o próprio ato de exclusão em ensaio desfeito
(ADR-0030), com custo linear de **~3,4 ms por item**. Uma página de 200 custava ~0,7 s de transação.
`limite=51` **recusa** com `422`, e não trunca em silêncio.
<!-- fonte: administrador.contrato.ts:104-135 (tabela de medição) -->

**Response `200`**

```json
{
  "itens": [
    {
      "usuarioId": "9f1c2a3e-5b6d-4e7f-8a90-1b2c3d4e5f60",
      "nome": "Ana Ribeiro",
      "email": "ana@imobiliariacentro.com.br",
      "estado": "ATIVO",
      "criadoEm": "2026-08-14T13:05:41.220Z",
      "exclusao": { "disponivel": true, "impedimentos": [] }
    },
    {
      "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d",
      "nome": "Bruno Tavares",
      "email": "bruno@imobiliariacentro.com.br",
      "estado": "SUSPENSO",
      "criadoEm": "2026-08-20T09:12:03.884Z",
      "exclusao": {
        "disponivel": false,
        "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
        "impedimentos": ["TENTATIVA_DE_ENTRADA"],
        "alternativa": "SUSPENSAO"
      }
    }
  ],
  "total": 2,
  "limite": 25,
  "deslocamento": 0
}
```

<!-- fonte: administrador.contrato.ts:236-266; administrador.service.ts:466-485 -->

**Notas de forma — cada uma tem consequência de tela:**

- **As chaves do item são exatamente seis**, e o conjunto é fechado por asserção (`CT-1220`). Nenhum
  dado de negócio entra (RN-13).
- **`estado` é derivado no servidor** a partir da coluna `ativo`, em ponto único. `'ATIVO'` ou
  `'SUSPENSO'` — não há terceiro valor.
- **`criadoEm` é ISO-8601 com fuso** (`toISOString()`). Formate no cliente.
- **`exclusao.motivo` e `exclusao.alternativa` só existem quando `disponivel` é `false`.** A ausência
  já diz que está disponível — não é preciso olhar os três campos.
- **`total`** é a contagem do conjunto **inteiro**, não da página.
- **`limite` e `deslocamento` são ecoados do que foi pedido** (com o padrão já aplicado).
- **Ordem fixa:** `nome`, e `id` como desempate. **Não é declarável.**
  <!-- fonte: packages/db/src/administrador-do-master.ts:526 -->

**Erros**

| Status | `codigo` | `campo` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | — | sem cookie ou sessão expirada |
| 403 | `ACESSO_NEGADO` | — | perfil ≠ `SYSLOC_MASTER`, **ou sessão restrita** |
| 404 | `RECURSO_NAO_ENCONTRADO` | — | empresa inexistente — **nunca** uma página vazia |
| 422 | `CAMPO_INVALIDO` | `id` | `:id` não é UUID bem formado |
| 422 | `CAMPO_INVALIDO` | `limite` | `limite` fora de `1..50`, ou parâmetro desconhecido |
| 422 | `CAMPO_INVALIDO` | `deslocamento` | `deslocamento` negativo ou não inteiro |

⚠️ **Empresa inexistente é `404`, e empresa sem administradores é `200` com `itens: []`.** São coisas
diferentes e a tela deve distingui-las: a segunda é o estado em que cabe oferecer *"admitir o primeiro
administrador"*.

**Side effects:** nenhum. É leitura pura — a sonda de elegibilidade roda dentro de um ponto de
salvamento desfeito e **não grava nada**.

---

### 4.2 R2 · Suspender um Admin Empresa

- **Tipo:** REST · **Método:** `POST` · **Path:** `/v1/master/usuarios/{id}/suspensao`
- **Auth:** obrigatória · **Permissões:** `SYSLOC_MASTER`
- **Idempotência:** **sim, por natureza** — repetir devolve o mesmo corpo com `sessoesEncerradas: 0`

**Request**

Path: `id: string (uuid)` — o **`usuarioId`**, que vem da listagem R1.

⚠️ **O corpo é VAZIO e FECHADO.** Envie `{}` ou nada. Qualquer campo — inclusive `{"estado":"SUSPENSO"}`
— responde `422` com `campo: "corpo"`, em vez de ser descartado em silêncio.
<!-- fonte: administrador.controller.ts:216 -->

**Response `200`**

```json
{
  "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d",
  "estado": "SUSPENSO",
  "sessoesEncerradas": 2
}
```

**`sessoesEncerradas` é a prova medida do efeito, e não um contador decorativo.** O encerramento
acontece **no próprio ato**, na mesma transação da marcação: os registros de sessão da pessoa são
apagados, e o número diz quantos foram. Na repetição ele é `0` — **medido**, não constante de ramo.
<!-- fonte: administrador.contrato.ts:268-274; plano-de-origem.md:278-296 -->

**Erros**

| Status | `codigo` | `campo` | `detalhes` | Quando |
|---|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | — | — | sem sessão |
| 403 | `ACESSO_NEGADO` | — | — | perfil errado ou sessão restrita |
| 404 | `RECURSO_NAO_ENCONTRADO` | — | — | pessoa inexistente |
| 422 | `CAMPO_INVALIDO` | `id` | — | `:id` não é UUID |
| 422 | `CAMPO_INVALIDO` | `corpo` | — | qualquer campo no corpo |
| 422 | `CAMPO_INVALIDO` | `id` | `{ perfilExigido, perfilDoAlvo }` | alvo **não é** `ADMIN_EMPRESA` |

**Recusa por perfil — o corpo exato:**

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "id",
  "detalhes": { "perfilExigido": "ADMIN_EMPRESA", "perfilDoAlvo": "USUARIO_EMPRESA" }
}
```

⚠️ **Nada é encerrado quando a recusa por perfil acontece** — a leitura do alvo precede o ato.
<!-- fonte: administrador.service.ts:591-600 -->

**Side effects**

- Marca a pessoa como inativa **e** apaga os registros de sessão dela, na **mesma transação**.
- ⚠️ **O alcance é por PESSOA, não por empresa.** A colega ativa da mesma empresa continua operando no
  mesmo instante. Não confunda com a suspensão de empresa (A2), que derruba todo mundo.
- **Nenhum trabalho é enfileirado.**

---

### 4.3 R3 · Reativar um Admin Empresa

- **Tipo:** REST · **Método:** `POST` · **Path:** `/v1/master/usuarios/{id}/reativacao`
- **Idempotência:** **sim** — repetir sobre quem já está ativo devolve o mesmo corpo

**Request:** path `id: uuid`. **Corpo vazio e fechado**, como R2.

**Response `200`**

```json
{ "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d", "estado": "ATIVO" }
```

⚠️ **Não há `sessoesEncerradas` aqui, e a ausência é conteúdo.** A reativação devolve a **capacidade de
entrar**, e **não** as sessões que a suspensão encerrou (RN-04). Os cookies anteriores continuam
inválidos, e a pessoa entra de novo. Publicar o campo com zero sugeriria um encerramento que não
houve. <!-- fonte: administrador.contrato.ts:279-288 -->

**Erros:** idênticos aos de R2, tabela e corpos inclusive.

**Side effects**

- Marca a pessoa como ativa. **Nada mais.**
- ⚠️ **Nenhum trabalho é enfileirado.** A retomada de notícias bancárias retidas é efeito da reativação
  de **empresa** (A3), não desta. Não replique aquele comportamento na tela.
- ⚠️ **Reativar a pessoa NÃO reativa a empresa.** Se a empresa estiver suspensa, a pessoa continua sem
  entrar. São dois eixos independentes.

---

### 4.4 R4 · Corrigir o cadastro de um Admin Empresa

- **Tipo:** REST · **Método:** `PUT` · **Path:** `/v1/master/usuarios/{id}`
- **Idempotência:** sim (`PUT` com corpo completo)

**Request**

```json
{ "nome": "Ana Ribeiro Costa", "email": "ana.costa@imobiliariacentro.com.br" }
```

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `nome` | `string` | **sim** | `trim`, 1..200 caracteres |
| `email` | `string` | **sim** | `trim` → **minúsculas** → validação de e-mail |

⚠️ **É `PUT` com corpo COMPLETO — não é atualização parcial.** Os dois campos são obrigatórios. Omitir
um responde `422`. Preencha o formulário com os valores atuais (vindos de R1) e mande os dois de volta.

⚠️ **O corpo é FECHADO, e o que ele recusa é o conteúdo da decisão.** `estado`, `ativo`, `perfil` e
`empresaId` **não existem** no esquema, e enviá-los responde `422` com `campo: "corpo"`:

| Chave proibida | Por quê |
|---|---|
| `estado` / `ativo` | Transição de estado tem **rota própria** (ADR-0021) — R2 e R3. Um esquema aberto responderia `200` **ignorando** a chave, e o operador acreditaria ter reativado alguém que continua suspenso |
| `perfil` | Fixo por ADR-0013: o Master governa `ADMIN_EMPRESA`, e nada além. Aceitá-lo seria elevação de privilégio |
| `empresaId` | A pessoa não muda de empresa por correção cadastral — seria mover dado entre tenants pela borda |

<!-- fonte: administrador.contrato.ts:324-361 -->

⚠️ **A normalização do e-mail é do servidor**: ele faz `trim` e minúsculas antes de validar. Não
normalize no cliente, e **não** rejeite ` Ana@Exemplo.com ` na tela — o servidor aceita e grava
`ana@exemplo.com`.

**Response `200`** — a **linha inteira da listagem**, com a prévia de exclusão recomposta:

```json
{
  "usuarioId": "9f1c2a3e-5b6d-4e7f-8a90-1b2c3d4e5f60",
  "nome": "Ana Ribeiro Costa",
  "email": "ana.costa@imobiliariacentro.com.br",
  "estado": "ATIVO",
  "criadoEm": "2026-08-14T13:05:41.220Z",
  "exclusao": { "disponivel": true, "impedimentos": [] }
}
```

**Isto é conveniência real para a tela:** dá para substituir a linha na tabela sem refazer R1.

**Erros**

| Status | `codigo` | `campo` | `detalhes` | Quando |
|---|---|---|---|---|
| 401 / 403 / 404 | — | — | — | como nas anteriores |
| 422 | `CAMPO_INVALIDO` | `id` | — | `:id` não é UUID |
| 422 | `CAMPO_INVALIDO` | `nome` | — | vazio, só espaços, ou > 200 |
| 422 | `CAMPO_INVALIDO` | `email` | — | endereço malformado |
| 422 | `CAMPO_INVALIDO` | `corpo` | — | chave proibida ou campo obrigatório ausente |
| 422 | `CAMPO_INVALIDO` | `email` | `{ motivo: "EMAIL_JA_REGISTRADO" }` | endereço já pertence a outra pessoa |
| 422 | `CAMPO_INVALIDO` | `id` | `{ perfilExigido, perfilDoAlvo }` | alvo de outro perfil |

**E-mail em uso — o corpo exato:**

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "email",
  "detalhes": { "motivo": "EMAIL_JA_REGISTRADO" }
}
```

⚠️ **Quando o e-mail é recusado, NADA é gravado** — nem o `nome` válido que viajou no mesmo corpo. A
tela pode manter o formulário preenchido e marcar só o campo `email`.
<!-- fonte: administrador.service.ts:526-532; run-report.md D18 (CT-1246) -->

⚠️ **A resposta nunca revela o endereço da outra pessoa**, nem o nome da restrição do banco. Não
prometa ao operador *"este e-mail pertence a Fulano"* — o servidor não diz, e por decisão.

**Side effects**

- `UPDATE` puro nas duas colunas.
- ⚠️ **A pessoa continua entrando com a Senha provisória que já recebeu**, mesmo depois de o endereço
  mudar: a credencial ancora no `usuarioId`, não no e-mail (RN-08). **Não** ofereça reemissão
  automática depois de uma correção — seria invalidar o acesso dela sem necessidade.
- ⚠️ **Corrigir quem está suspenso o mantém suspenso.** O estado não é tocado.

---

### 4.5 R5 · Remover um Admin Empresa em definitivo

- **Tipo:** REST · **Método:** `DELETE` · **Path:** `/v1/master/usuarios/{id}`
- **Idempotência:** **não** — a segunda chamada responde `404`
- ⚠️ **IRREVERSÍVEL.** Não há lixeira, não há desfazer, não há registro do que foi apagado.

**Request:** path `id: uuid`. **Sem corpo** — não envie `{}`.
<!-- fonte: administrador.controller.ts:344-348 -->

**Response `200`**

```json
{ "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d", "removido": true }
```

`removido` é sempre `true` — o desfecho é único, e a recusa sai pelo envelope de erro, nunca por um
`removido: false`. O eco do `usuarioId` fecha o par pedido/efeito.
<!-- fonte: administrador.contrato.ts:366-386 -->

**Erros**

| Status | `codigo` | `campo` | `detalhes` | Quando |
|---|---|---|---|---|
| 401 / 403 | — | — | — | como nas anteriores |
| 404 | `RECURSO_NAO_ENCONTRADO` | — | — | pessoa inexistente **ou já removida** |
| 422 | `CAMPO_INVALIDO` | `id` | — | `:id` não é UUID |
| 422 | `CAMPO_INVALIDO` | `id` | `{ perfilExigido, perfilDoAlvo }` | alvo de outro perfil |
| 422 | `CAMPO_INVALIDO` | `id` | `{ motivo, impedimentos[], alternativa }` | **exclusão impedida** |

**Exclusão impedida — o corpo exato:**

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "id",
  "detalhes": {
    "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
    "impedimentos": ["TENTATIVA_DE_ENTRADA"],
    "alternativa": "SUSPENSAO"
  }
}
```

<!-- fonte: administrador.service.ts:546-559 -->

⚠️ **`alternativa` existe para que a tela NÃO redija a saída por conta própria.** É o servidor dizendo
o que sobra. Hoje o único valor é `"SUSPENSAO"`, e ele mapeia para a rota R2. Trate-o como enum, não
como texto: se um valor novo aparecer, a tela deve degradar para uma mensagem genérica em vez de
mostrar o literal.

**O critério é o banco, e não uma regra da aplicação.** A exclusão é **tentada** e desfeita; a recusa
do banco vira a classe do impedimento. Consequências para a tela:

- **A prévia de R1 é do instante da leitura, não uma promessa.** Um `422` no clique é **resultado
  normal**, não um bug — trate-o como tal e refaça R1.
- **Nada fica parcialmente apagado quando a recusa acontece.** O ato é auto-verificado.
- ⚠️ **A trilha de tentativas de entrada é IMPEDIMENTO, nunca colateral.** Esta operação **nunca**
  destrói auditoria (RN-16, ADR-0038). Na prática: uma pessoa que já tentou entrar **uma vez** deixa
  de ser removível para sempre. A janela real é curta, e cobre o caso *"cadastrei com o e-mail
  errado"*.

**Side effects**

- A linha da pessoa **deixa de existir**. Credencial, segundo fator e sessões somem por cascata
  declarada no schema.
- Qualquer sessão viva dela morre junto.

---

### 4.6 R6 · Corrigir o cadastro de uma empresa

- **Tipo:** REST · **Método:** `PUT` · **Path:** `/v1/master/empresas/{id}`

**Request**

```json
{ "nome": "Imobiliária Centro Ltda.", "documento": "12.345.678/0001-90" }
```

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `nome` | `string` | **sim** | `trim`, 1..200 |
| `documento` | `string` | **sim** | `trim`, 1..64 |

⚠️ **`documento` é texto livre de até 64 caracteres** — o servidor **não** valida formato de CNPJ/CPF,
não normaliza pontuação e não confere dígito verificador. Ele só exige unicidade. Se a tela quiser
máscara, ela é do cliente — e **grave o mesmo formato que exibe**, porque a unicidade é sobre o texto.
`[HIPÓTESE]` a política de formato é do produto e não está fixada no backend.
<!-- fonte: empresa.controller.ts:117-118, 146-149 -->

⚠️ **Corpo FECHADO.** `estado`, `suspensaEm` e `empresaId` **não existem** e respondem `422` com
`campo: "corpo"`:

| Chave proibida | Por quê |
|---|---|
| `estado` | Transição tem rota própria (ADR-0021) — A2 e A3 |
| `suspensaEm` | O instante é do servidor; aceitá-lo deixaria o cliente reescrever a história |
| `empresaId` | A empresa é a do caminho — uma segunda origem de identidade poderia contradizer a primeira |

<!-- fonte: empresa.controller.ts:151-185 -->

**Response `200`** — a **linha inteira da listagem**, com a prévia recomposta:

```json
{
  "id": "3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e",
  "nome": "Imobiliária Centro Ltda.",
  "documento": "12.345.678/0001-90",
  "estado": "ATIVA",
  "criadaEm": "2026-07-02T11:40:12.005Z",
  "exclusao": { "disponivel": false, "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS", "impedimentos": ["REGISTROS_DE_NEGOCIO"], "alternativa": "SUSPENSAO" }
}
```

⚠️ **Note a concordância de gênero — ela é a convenção medida desta superfície e não é negociável:**

| Empresa | Pessoa |
|---|---|
| `criadaEm` | `criadoEm` |
| `suspensaEm` | — |
| `removida` | `removido` |
| `estado: "ATIVA" \| "SUSPENSA"` | `estado: "ATIVO" \| "SUSPENSO"` |

<!-- fonte: empresa.controller.ts:326-328 -->

**Erros**

| Status | `codigo` | `campo` | `detalhes` | Quando |
|---|---|---|---|---|
| 401 / 403 / 404 | — | — | — | como nas anteriores |
| 422 | `CAMPO_INVALIDO` | `id` | — | `:id` não é UUID |
| 422 | `CAMPO_INVALIDO` | `nome` / `documento` | — | fora dos limites |
| 422 | `CAMPO_INVALIDO` | `corpo` | — | chave proibida ou campo ausente |
| 422 | `CAMPO_INVALIDO` | `documento` | `{ motivo: "DOCUMENTO_JA_REGISTRADO" }` | documento de outra empresa |

⚠️ **Documento em uso não grava nada** — nem o `nome` válido do mesmo corpo.

**Side effects:** `UPDATE` puro. **Corrigir uma empresa suspensa a mantém suspensa, com o mesmo
instante de suspensão.**

---

### 4.7 R7 · Remover uma empresa em definitivo

- **Tipo:** REST · **Método:** `DELETE` · **Path:** `/v1/master/empresas/{id}`
- **Idempotência:** **não** — a segunda chamada responde `404`
- ⚠️ **IRREVERSÍVEL, e apaga um TENANT INTEIRO.** É a operação mais destrutiva do painel.

**Request:** path `id: uuid`. **Sem corpo.**

**Response `200`**

```json
{ "id": "3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e", "removida": true }
```

**Erros:** os mesmos de R5, com uma diferença no vocabulário de impedimentos — aqui aparecem
`REGISTROS_DE_NEGOCIO` e `ADMINISTRADORES_NAO_ELEGIVEIS`. **Não há recusa por perfil** nesta rota.

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "id",
  "detalhes": {
    "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
    "impedimentos": ["REGISTROS_DE_NEGOCIO"],
    "alternativa": "SUSPENSAO"
  }
}
```

**Side effects**

- ⚠️ **A empresa e as pessoas dela somem num ÚNICO commit** (RN-12) — inclusive os Usuários Empresa,
  não só os Admin Empresa.
- ⚠️ **Cada pessoa permanece sujeita ao SEU próprio critério.** Se **uma só** for inelegível, a
  operação **inteira** é recusada e **nada** sai. Não é cascata cega.
- Credencial, segundo fator e sessões de cada pessoa somem por cascata.

<!-- fonte: empresa.controller.ts:450-467; packages/db/src/empresa.ts:549-570 -->

⚠️ **A recusa nunca vem de uma contagem.** Sob a sessão do Master, `count(*)` sobre as tabelas de
negócio devolve **zero para uma empresa cheia** — a política de isolamento a esconde. Foi medido, e é
por isso que o critério é a integridade referencial. **Não tente "pré-checar" no cliente** contando
nada: a única fonte é `exclusao.disponivel`.

---

### 4.8 R8 · Listar empresas — **alterada por esta fatia**

- **Tipo:** REST · **Método:** `GET` · **Path:** `/v1/master/empresas`

**Request:** query `limite` (`1..200`, padrão **50**), `deslocamento` (`>= 0`, padrão **0**). Cadeia
fechada. <!-- fonte: empresa.service.ts:179-182 -->

**Response `200`** — envelope de lista idêntico ao de R1, com itens de **seis** chaves:

```json
{
  "itens": [
    {
      "id": "3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e",
      "nome": "Imobiliária Centro",
      "documento": "12.345.678/0001-90",
      "estado": "ATIVA",
      "criadaEm": "2026-07-02T11:40:12.005Z",
      "exclusao": { "disponivel": true, "impedimentos": [] }
    }
  ],
  "total": 1,
  "limite": 50,
  "deslocamento": 0
}
```

⚠️ **`exclusao` é NOVO nesta rota** — a mudança é **aditiva**, e nenhuma chave existente saiu ou mudou
de tipo. Um cliente antigo continua funcionando; um cliente novo deve ler `exclusao.disponivel` antes
de habilitar o botão de excluir. <!-- fonte: empresa.controller.ts:283-299 -->

⚠️ **`POST /v1/master/empresas` (criação) continua devolvendo as CINCO chaves, SEM `exclusao`** — e a
assimetria é decisão: uma empresa recém-criada é elegível por construção, e compor a prévia ali
custaria a sonda para responder uma pergunta cuja resposta é conhecida. **Não espere `exclusao` na
resposta da criação.** <!-- fonte: empresa.controller.ts:289-293 -->

**Ordem:** empresa mais antiga primeiro. **Não é declarável.**

---

### 4.9 Matriz de contrato — leitura rápida

| | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 |
|---|---|---|---|---|---|---|---|---|
| Sucesso | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| Corpo na requisição | — | vazio+fechado | vazio+fechado | `{nome,email}` | — | `{nome,documento}` | — | — |
| Idempotente | leitura | **sim** | **sim** | sim | **não** | sim | **não** | leitura |
| Pode dar 404 | sim | sim | sim | sim | sim | sim | sim | **não** |
| Recusa por perfil (`perfilDoAlvo`) | **não** | sim | sim | sim | sim | **não** | **não** | **não** |
| Recusa por unicidade | — | — | — | `email` | — | `documento` | — | — |
| Recusa por impedimento | — | — | — | — | **sim** | — | **sim** | — |
| Destrutivo | — | sessões | — | — | **irreversível** | — | **irreversível** | — |

---

### 4.10 Ações de linha pré-existentes (contrato resumido)

Estas três **não mudaram**, mas as telas desta fatia as consomem como ação de linha. Contrato integral
no handoff geral, §4.4, §4.5 e §4.6.

| Ação | Método e path | Corpo | Resposta `200` |
|---|---|---|---|
| A1 · Reemitir Senha provisória | `POST /v1/master/usuarios/{id}/senha-provisoria` | — | `{ usuarioId, senhaProvisoria }` |
| A2 · Suspender empresa | `POST /v1/master/empresas/{id}/suspensao` | — | `{ id, estado: "SUSPENSA", suspensaEm, sessoesEncerradas }` |
| A3 · Reativar empresa | `POST /v1/master/empresas/{id}/reativacao` | — | `{ id, estado: "ATIVA" }` |

⚠️ **A1 é a razão de esta fatia existir.** O `usuarioId` que ela consome vem de R1 — **não é mais
preciso guardar o da admissão**. E a senha anterior deixa de servir no mesmo ato, com a recusa dela
**indistinguível** da recusa por credencial incorreta.

⚠️ **A Senha provisória é entregue UMA ÚNICA VEZ.** Nenhuma consulta posterior a recupera. Exiba,
ofereça copiar, **nunca persista**.

⚠️ **A1 recusa por perfil exatamente como R2–R5, e a §4.9 não a cobre** (aquela matriz só tem R1–R8).
Sobre alvo que não seja `ADMIN_EMPRESA` ela responde `422` com o **mesmo corpo** da recusa de R2, e
sobre identificador inexistente responde `404`:

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "id",
  "detalhes": { "perfilExigido": "ADMIN_EMPRESA", "perfilDoAlvo": "USUARIO_EMPRESA" }
}
```

<!-- fonte: apps/api/src/master/empresa.service.ts:845-866 -->

Uma tela que sempre tire o `usuarioId` de R1 **nunca** chega a esses dois casos — R1 só devolve
`ADMIN_EMPRESA`. Eles alcançam quem entra por deep-link ou age sobre uma linha vencida, e o
tratamento é o mesmo da linha `R2–R5` da §6: `conflict`, refetch de R1, sem retry.

---

## 5. UI States Required

| Operação | loading | success | empty | validation_error | unauthorized | forbidden | not_found | conflict¹ | unexpected |
|---|---|---|---|---|---|---|---|---|---|
| R1 Listar admins | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| R2 Suspender | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R3 Reativar | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R4 Corrigir pessoa | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R5 Remover pessoa | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R6 Corrigir empresa | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R7 Remover empresa | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| R8 Listar empresas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |

¹ **Não existe `409` nesta API.** A coluna `conflict` cobre os `422` **semânticos** — alvo de outro
perfil, unicidade violada e exclusão impedida —, que a tela trata diferente de um erro de validação de
campo. Estão separados porque a ação do operador é outra: validação corrige o formulário; conflito
exige decidir.

**Estados que merecem tela própria:**

- **`empty` de R1** — empresa existe e não tem administrador. É onde cabe o CTA *"admitir o primeiro
  administrador"*. **Não confunda com `404`.**
- **`impediment` de R5/R7** — a recusa nomeada, com a `alternativa` oferecida como ação. É um estado de
  sucesso do ponto de vista do produto: o servidor **explicou**.

---

## 6. Error Mapping

| Operação | Erro | Estado UI | Mensagem sugerida (chave i18n) | Retry | Invalida cache |
|---|---|---|---|---|---|
| qualquer | `401` (qualquer código) | redireciona para entrada | — | — | limpa tudo |
| qualquer | `403 ACESSO_NEGADO` | **refaz `GET /v1/sessao`** e roteia pelas bandeiras | exibir a `mensagem` do servidor | — | — |
| qualquer | `422` `campo` ∈ campos do formulário | `validation_error` **inline no campo** | `master.erro.campo.{campo}` | não | não |
| qualquer | `422` `campo: "corpo"` | `validation_error` **no formulário inteiro** | `master.erro.corpo` | não | não |
| R1 / R8 | `422` `campo: "limite"` \| `"deslocamento"` | volta à primeira página | `master.erro.paginacao` | não | não |
| R1 | `404` | tela de empresa inexistente | `master.empresa.inexistente` | não | sim (refetch R8) |
| R2–R5 | `422` + `detalhes.perfilDoAlvo` | `conflict` — toast, remove a linha da tabela | `master.erro.perfil` | **não** | sim (refetch R1) |
| R4 | `422` + `detalhes.motivo = EMAIL_JA_REGISTRADO` | `conflict` — inline no campo `email` | `master.erro.emailEmUso` | não | não |
| R6 | `422` + `detalhes.motivo = DOCUMENTO_JA_REGISTRADO` | `conflict` — inline no campo `documento` | `master.erro.documentoEmUso` | não | não |
| R5 / R7 | `422` + `detalhes.motivo = EXCLUSAO_IMPEDIDA_POR_REGISTROS` | `impediment` — diálogo com as classes traduzidas + botão da `alternativa` | `master.impedimento.{classe}` | **não** | **sim (refetch R1/R8)** |
| R2–R7 | `404` | toast "o registro não existe mais" | `master.erro.desapareceu` | não | **sim** |
| qualquer | `5xx` | `unexpected_error` + telemetria | `master.erro.inesperado` | sim, com recuo | não |

**Tradução sugerida das classes de impedimento** (o texto é do frontend, por decisão):

| Classe | Sugestão de texto |
|---|---|
| `REGISTROS_DE_NEGOCIO` | "Esta empresa já tem registros de operação (imóveis, contratos ou cobranças)." |
| `ADMINISTRADORES_NAO_ELEGIVEIS` | "Há pessoas nesta empresa que não podem ser removidas." |
| `TENTATIVA_DE_ENTRADA` | "Esta pessoa já acessou o sistema, e o histórico de acesso é preservado." |
| `VINCULO_DE_ACESSO` | "Esta pessoa tem vínculo de acesso ao aplicativo." |
| `AUTORIA_EM_REGISTRO` | "Esta pessoa consta como autora de registros do sistema." |

**Tradução da `alternativa`:**

| Valor | Ação na tela |
|---|---|
| `"SUSPENSAO"` | Botão *"Suspender em vez de remover"* → R2 (pessoa) ou A2 (empresa) |
| qualquer outro | Mensagem genérica, **sem** botão. Não mostre o literal ao operador |

---

## 7. Fixtures

Fixtures portáveis. Caminhos sugeridos — o frontend escolhe a estrutura final.

```
fixtures/master/
  listar-administradores/success.json
  listar-administradores/empty.json
  listar-administradores/empresa-inexistente.json
  listar-administradores/limite-acima-do-teto.json
  suspender/success.json
  suspender/repeticao.json
  suspender/perfil-invalido.json
  reativar/success.json
  corrigir-administrador/success.json
  corrigir-administrador/email-em-uso.json
  corrigir-administrador/corpo-fechado.json
  remover-administrador/success.json
  remover-administrador/impedido.json
  corrigir-empresa/success.json
  corrigir-empresa/documento-em-uso.json
  remover-empresa/success.json
  remover-empresa/impedido.json
  listar-empresas/success.json
  comum/nao-autenticado.json
  comum/acesso-negado.json
  comum/sessao-restrita.json
```

### 7.1 Fixtures embutidas — as que discriminam

**`listar-administradores/success.json`** — a página com os dois estados de `exclusao`:

```json
{
  "name": "listar-administradores/success",
  "request": {
    "method": "GET",
    "path": "/v1/master/empresas/3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e/administradores?limite=25&deslocamento=0"
  },
  "response": {
    "status": 200,
    "body": {
      "itens": [
        { "usuarioId": "9f1c2a3e-5b6d-4e7f-8a90-1b2c3d4e5f60", "nome": "Ana Ribeiro", "email": "ana@imobiliariacentro.com.br", "estado": "ATIVO", "criadoEm": "2026-08-14T13:05:41.220Z", "exclusao": { "disponivel": true, "impedimentos": [] } },
        { "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d", "nome": "Bruno Tavares", "email": "bruno@imobiliariacentro.com.br", "estado": "SUSPENSO", "criadoEm": "2026-08-20T09:12:03.884Z", "exclusao": { "disponivel": false, "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS", "impedimentos": ["TENTATIVA_DE_ENTRADA"], "alternativa": "SUSPENSAO" } }
      ],
      "total": 2, "limite": 25, "deslocamento": 0
    }
  }
}
```

**`listar-administradores/empty.json`** — empresa existe, sem administradores. **Distinto de `404`:**

```json
{
  "name": "listar-administradores/empty",
  "response": { "status": 200, "body": { "itens": [], "total": 0, "limite": 25, "deslocamento": 0 } }
}
```

**`suspender/repeticao.json`** — a idempotência, com `sessoesEncerradas: 0`:

```json
{
  "name": "suspender/repeticao",
  "request": { "method": "POST", "path": "/v1/master/usuarios/b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d/suspensao", "body": {} },
  "response": { "status": 200, "body": { "usuarioId": "b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d", "estado": "SUSPENSO", "sessoesEncerradas": 0 } }
}
```

**`remover-administrador/impedido.json`** — o estado que a tela precisa acertar:

```json
{
  "name": "remover-administrador/impedido",
  "request": { "method": "DELETE", "path": "/v1/master/usuarios/b7e4d1c0-2f38-4a5b-9c6d-0e1f2a3b4c5d" },
  "response": {
    "status": 422,
    "body": {
      "codigo": "CAMPO_INVALIDO",
      "mensagem": "requisição inválida",
      "campo": "id",
      "detalhes": { "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS", "impedimentos": ["TENTATIVA_DE_ENTRADA", "VINCULO_DE_ACESSO"], "alternativa": "SUSPENSAO" }
    }
  }
}
```

**`suspender/perfil-invalido.json`**:

```json
{
  "name": "suspender/perfil-invalido",
  "response": {
    "status": 422,
    "body": { "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "id", "detalhes": { "perfilExigido": "ADMIN_EMPRESA", "perfilDoAlvo": "USUARIO_EMPRESA" } }
  }
}
```

**`comum/sessao-restrita.json`** — o `403` **sem** `campo` nem `detalhes`, que exige refazer `GET /v1/sessao`:

```json
{
  "name": "comum/sessao-restrita",
  "response": {
    "status": 403,
    "body": { "codigo": "ACESSO_NEGADO", "mensagem": "acesso negado: esta sessão está restrita até a configuração do segundo fator" }
  }
}
```

---

## 8. Frontend Implementation Notes

*(Neutro de framework — descreve o padrão de integração, não impõe biblioteca.)*

### 8.1 Paginação

**Offset-based**, com `limite` e `deslocamento`, e **tetos diferentes por rota**:

| Rota | Teto | Padrão |
|---|---|---|
| R1 administradores | **50** | **25** |
| R8 empresas | **200** | **50** |

⚠️ **Não use um valor único para as duas.** `limite=100` funciona em R8 e responde `422` em R1.

⚠️ **Não implemente scroll infinito sem cuidado**: `total` é do conjunto inteiro, e a ordem é fixa,
mas a exclusão física muda o conjunto entre páginas. Prefira paginação clássica com refetch.

### 8.2 O que não existe no servidor — implemente no cliente ou não implemente

- **Busca e filtro** — não há. Se a tela precisar, filtre a página carregada no cliente e deixe claro
  que o escopo é a página.
- **Ordenação declarável** — não há. R1 é `nome, id`; R8 é a mais antiga primeiro.
- **Contagem prévia de dependências** — não há, e **não tente derivá-la**: sob a sessão do Master,
  contar registros de negócio devolve zero para uma empresa cheia (§4.7). A única fonte é
  `exclusao.disponivel`.

### 8.3 Cache e invalidação

Nenhuma resposta traz `Cache-Control` ou `ETag`. `[HIPÓTESE]` trate tudo como não-cacheável no
navegador; o cache é do cliente.

| Depois de | Invalide |
|---|---|
| R2 / R3 (suspender/reativar pessoa) | a página R1 daquela empresa |
| R4 (corrigir pessoa) | **nada** — a resposta já é a linha inteira; substitua-a localmente |
| R5 (remover pessoa) | a página R1 daquela empresa |
| R6 (corrigir empresa) | **nada** — a resposta já é a linha inteira |
| R7 (remover empresa) | a listagem R8 **e** qualquer estado da empresa removida |
| A1 (reemitir senha) | nada |
| A2 / A3 (suspender/reativar empresa) | a listagem R8 |

⚠️ **`exclusao` de qualquer item pode mudar sem que a tela aja** — basta a imobiliária cadastrar um
imóvel. Revalide antes de abrir o diálogo de exclusão, e trate o `422` no clique como normal.

### 8.4 Atualização otimista

**Aplicável a R2 e R3** (transições idempotentes, com rollback em qualquer 4xx).

⚠️ **NÃO aplique a R5 nem a R7.** A exclusão pode ser recusada pelo servidor, e remover a linha da
tabela antes da resposta faria o operador acreditar que apagou algo que continua lá — que é exatamente
o modo de falha que o `404` distinto de `200` existe para impedir.

⚠️ **Em R2, `sessoesEncerradas` só existe na resposta.** Um otimismo que preencha o número o inventa.

### 8.5 Validação no cliente — o que replicar e o que não

**Replique** (melhora a experiência sem divergir):

| Campo | Regra |
|---|---|
| `nome` (pessoa e empresa) | não vazio após `trim`, ≤ 200 |
| `documento` | não vazio após `trim`, ≤ 64 |
| `limite` / `deslocamento` | inteiros nos limites da rota |

**Não replique:**

- **Formato de e-mail** além do trivial — o servidor faz `trim` + minúsculas **antes** de validar, e
  uma validação cliente mais estrita recusaria endereços que o servidor aceita.
- **Unicidade** de e-mail e documento — só o servidor sabe.
- **Elegibilidade para exclusão** — só o servidor sabe.

### 8.6 Confirmação destrutiva

Três operações merecem confirmação explícita, com pesos diferentes:

| Operação | Peso | Confirmação sugerida |
|---|---|---|
| R2 suspender pessoa | médio — derruba as sessões dela | diálogo simples, com o nome |
| A2 suspender empresa | alto — derruba **todo mundo** da empresa | diálogo com o nome, e o resultado mostrando `sessoesEncerradas` |
| R5 remover pessoa | **irreversível** | nome digitado à mão + advertência de que não há desfazer |
| R7 remover empresa | **irreversível, tenant inteiro** | nome digitado à mão + advertência explícita de que as pessoas vão junto |

### 8.7 Telas que estas rotas sustentam

O backend não impõe navegação. Estas são as telas que a fatia habilita:

1. **Empresas** (existente) — a tabela ganha a ação **editar** (R6) e **excluir** (R7), esta última
   habilitada por `exclusao.disponivel` de cada item.
2. **Editar empresa** — formulário de dois campos preenchido com os valores atuais, mandando os dois
   de volta.
3. **Administradores da empresa** (**nova**) — tabela dentro da empresa, com nome, e-mail, estado e as
   ações de linha: **suspender/reativar** (R2/R3), **editar** (R4), **reemitir senha** (A1) e
   **excluir** (R5).
4. **Editar administrador** — formulário de dois campos, mesma forma da tela 2.
5. **Confirmação de exclusão definitiva** — uma para empresa e outra para pessoa. Quando a recusa
   vier, traduz as classes de `impedimentos` e oferece a `alternativa`.

⚠️ **A ação de excluir sai da prévia `exclusao` de cada linha, nunca de uma regra do cliente.**

---

## 9. Acceptance Criteria

Checklist verificável na UI e na integração.

**Listagem (R1)**

- [ ] A tabela renderiza estado de carregamento enquanto a requisição está pendente.
- [ ] Empresa sem administradores renderiza estado **vazio** com CTA de admitir o primeiro — e **não**
      a tela de "empresa não encontrada".
- [ ] Empresa inexistente (`404`) renderiza tela distinta da anterior.
- [ ] O `usuarioId` de cada linha alimenta as quatro ações de linha, **sem** que a tela guarde nada da
      admissão.
- [ ] A paginação respeita o teto **50** desta rota, e não o 200 da listagem de empresas.
- [ ] Nenhum parâmetro extra é enviado na cadeia de consulta (nem cache-buster).

**Transições (R2, R3)**

- [ ] O corpo enviado é `{}` ou ausente — nunca `{"estado": ...}`.
- [ ] Após suspender, a tela exibe `sessoesEncerradas` ao operador.
- [ ] Repetir a suspensão não é tratado como erro: `sessoesEncerradas: 0` é sucesso.
- [ ] Reativar **não** promete devolver sessões ao operador.
- [ ] A tela deixa claro que suspender a **pessoa** não afeta as colegas dela.

**Correções (R4, R6)**

- [ ] O formulário envia **os dois campos**, sempre — nunca só o alterado.
- [ ] O formulário não envia `estado`, `ativo`, `perfil`, `empresaId` nem `suspensaEm`.
- [ ] `422` com `campo: "email"`/`"documento"` aparece **inline no campo certo**.
- [ ] `422` com `campo: "corpo"` aparece como erro do formulário inteiro, não de um input.
- [ ] Após sucesso, a linha da tabela é substituída pela resposta — **sem** refetch da lista.
- [ ] A tela **não** oferece reemissão de senha automática após corrigir o e-mail.

**Exclusões (R5, R7)**

- [ ] O botão de excluir só fica habilitado quando `exclusao.disponivel` é `true`.
- [ ] O diálogo exige o nome digitado e adverte que **não há desfazer**.
- [ ] O diálogo de empresa adverte que **as pessoas vão junto**.
- [ ] Um `422` no clique é tratado como **resultado normal**: a tela mostra os impedimentos traduzidos
      e oferece a `alternativa`, sem log de erro nem toast de falha genérica.
- [ ] Cada classe de `impedimentos` tem tradução própria; o array é percorrido, não indexado em `[0]`.
- [ ] A linha **não** é removida otimisticamente.
- [ ] Após sucesso, a listagem é refeita.

**Transversal**

- [ ] `401` em qualquer rota leva à tela de entrada e limpa o estado local.
- [ ] `403` dispara `GET /v1/sessao` e roteia pelas bandeiras `senhaProvisoria` / `segundoFatorPendente`.
- [ ] Nenhuma decisão de fluxo usa a `mensagem` do envelope — só o `codigo` e os `detalhes`.
- [ ] O menu **não** é espelhado em `telas`/`acoes` (vazios por desenho).
- [ ] Nenhuma tela de dado de negócio é exibida ao Master.
- [ ] Requisições usam `credentials: 'include'` e mesma origem (proxy em desenvolvimento).

---

## 10. Minimum Tests

| # | Tipo | Comportamento |
|---|---|---|
| 1 | Component | R1 renderiza esqueleto enquanto a requisição está pendente |
| 2 | Component | R1 com `itens: []` renderiza o estado **vazio** com CTA, e não erro |
| 3 | Component | R1 com `404` renderiza "empresa não encontrada", distinto do vazio |
| 4 | Component | Item com `exclusao.disponivel: false` renderiza o botão de excluir **desabilitado** |
| 5 | Component | Item com `exclusao.disponivel: true` renderiza o botão **habilitado** |
| 6 | Integration | R2 envia corpo vazio e exibe `sessoesEncerradas` da resposta |
| 7 | Integration | R2 repetido com `sessoesEncerradas: 0` é tratado como **sucesso** |
| 8 | Integration | R4 envia **os dois campos** mesmo quando só um mudou |
| 9 | Integration | R4 com `EMAIL_JA_REGISTRADO` marca o input `email` e **preserva** o formulário |
| 10 | Integration | `422` com `campo: "corpo"` marca o formulário inteiro, não um input |
| 11 | Integration | R5 recusado por impedimento renderiza as classes traduzidas + botão da `alternativa` |
| 12 | Integration | R5 recusado **não** remove a linha da tabela |
| 13 | Integration | R5 aceito remove a linha e refaz a listagem |
| 14 | Integration | R7 aceito invalida a listagem de empresas |
| 15 | Integration | `impedimentos` com **duas** classes renderiza **as duas** |
| 16 | Integration | `403` dispara `GET /v1/sessao` e roteia pela bandeira, não pela mensagem |
| 17 | Integration | `401` em qualquer rota leva à entrada e limpa o estado |
| 18 | Integration | R1 com `limite=51` não é enviado — a UI respeita o teto 50 |
| 19 | E2E | Admitir → listar → reemitir senha pela linha, **sem** guardar o id da admissão |
| 20 | E2E | Suspender uma pessoa não derruba a colega da mesma empresa |

---

## 11. Open Questions

- [ ] `[DÚVIDA]` **O nome da chave desconhecida não chega ao cliente.** O esquema de entrada é
      `z.strictObject` e a recusa carrega `unrecognized_keys` internamente, mas a resposta HTTP publica
      apenas `campo: "corpo"` (ou `"limite"`). Uma tela que queira dizer *"o campo X não é aceito"*
      **não tem como saber qual foi**. Impacto real é baixo — corpo fechado só é violado por defeito do
      próprio cliente —, mas registre a limitação em vez de inventar a mensagem.
- [ ] `[DÚVIDA]` **Formato de `documento` não é validado pelo servidor** (texto livre ≤ 64, só
      unicidade). Se o produto exigir CNPJ/CPF válido e normalizado, a decisão é do frontend **e precisa
      ser combinada** — dois clientes com máscaras diferentes gravariam o mesmo documento em duas
      formas, e a unicidade não os pegaria.
- [ ] `[HIPÓTESE]` **Nenhuma resposta traz `Cache-Control`/`ETag`** — inferido da ausência de
      configuração; trate tudo como não-cacheável.
- [ ] `[HIPÓTESE]` **`alternativa` só assume `"SUSPENSAO"` hoje.** Tratada como enum extensível: valor
      desconhecido deve degradar para mensagem genérica.
- [ ] `[DÚVIDA]` **Não há endpoint de contagem ou de "posso excluir?" isolado.** A prévia vem embutida
      na listagem. Uma tela que abra o diálogo de exclusão a partir de um deep-link, **sem** ter passado
      pela listagem, não tem a prévia — terá de chamar R1 antes, ou aceitar descobrir no clique.

---

## 12. Versionamento e Compatibilidade

- **Versão atual:** `v1`. Estratégia de versionamento: **prefixo no path**.
- **Compatibilidade desta entrega:** ⚠️ **Nenhuma quebra.** As 7 rotas são **novas**; a única alteração
  numa rota existente (R8) é **aditiva** — `exclusao` foi acrescentado a cada item, e nenhuma chave
  existente saiu ou mudou de tipo.
- **Congelamento:** a superfície do **operador do SaaS** (`/v1/master/*`) está **fora** do congelamento
  que alcança o app da imobiliária (**ADR-0039**). Ela pode crescer sem reabrir o marco de entrega. Já a
  superfície da imobiliária está congelada desde 2026-08-23.
- **Próxima quebra prevista:** nenhuma.
- **Campos deprecados ainda retornados:** nenhum.

---

## 13. Divergências entre o plano e o implementado

> Registradas porque o `plano-de-origem.md` circulou antes da implementação. **O implementado é o que
> vale**, e é o que este documento descreve. Quem tiver lido o plano precisa saber o que mudou.

| # | O plano previa | O servidor entrega | Por quê |
|---|---|---|---|
| 1 | R4 devolve `{usuarioId, nome, email, estado, criadoEm}` | **a linha inteira**, com `exclusao` | Permite substituir a linha na tabela sem refetch |
| 2 | R5 devolve `{usuarioId, nome, email}` | **`{usuarioId, removido: true}`** | O corpo descreve o **ato consumado**, não a entidade que deixou de existir |
| 3 | R6 devolve `EmpresaDoContrato` (5 chaves) | **`EmpresaListada`** (6, com `exclusao`) | Mesma razão de (1) |
| 4 | R7 devolve `{id, nome, documento}` | **`{id, removida: true}`** | Mesma razão de (2) |
| 5 | Teto da listagem de administradores herdado (200) | **50**, padrão **25** | **Medição**: ~3,4 ms por item; 200 custava ~0,7 s por requisição |
| 6 | `exclusao` só na listagem de administradores | também em **R8** e nas respostas de R4/R6 | Uniformidade da prévia entre as duas superfícies |

⚠️ **Nenhuma destas divergências é regressão** — todas foram medidas e aprovadas nos dois gates. As de
(2) e (4) são a distinção deliberada entre a **prévia** (`exclusao`, artefato derivado) e o **ato
consumado** (`removido`/`removida`): fundi-los faria a resposta do `DELETE` carregar um `disponivel`
que já não descreve nada.

---

## 14. Rastreabilidade

| Artefato | Caminho |
|---|---|
| Plano de origem | `docs/specs/features/painel-master-administradores/v1/plano-de-origem.md` |
| Especificação técnica | `docs/specs/features/painel-master-administradores/v1/tech_spec.md` |
| Tasks T1–T8 | `docs/specs/features/painel-master-administradores/v1/tasks/` |
| Relatório do run e débitos | `docs/specs/features/painel-master-administradores/v1/_run/run-report.md` |
| Glossário de domínio | `docs/specs/features/painel-master-administradores/domain-glossary.md` |
| Handoff geral do Painel Master | `docs/plano-backend-novo/handoff-master-frontend.md` |
| Controlador dos administradores | `apps/api/src/master/administrador.controller.ts` |
| Contrato (esquemas Zod e tipos) | `apps/api/src/master/administrador.contrato.ts` |
| Controlador das empresas | `apps/api/src/master/empresa.controller.ts` |
| Vocabulário de impedimentos | `packages/db/src/administrador-do-master.ts` |
| Suíte de borda desta fatia | `apps/api/test/master-administradores.e2e.spec.ts` (CT-1220 … CT-1249) |
| Suíte da camada de dados | `packages/db/test/administrador-do-master.spec.ts` (CT-1204 … CT-1214, CT-1217 … CT-1219) |
| Suíte das guardas de catálogo | `packages/db/test/catalogo.spec.ts` (CT-1215, CT-1216, CT-1242, CT-1243) |

**ADRs vinculantes:** 0011 (autorização por rota), 0013 (alcance do operador do SaaS), 0014 + **0038**
(exclusão lógica × física), 0016 (esquema é a fonte do contrato), 0017 (forma do envelope), 0021
(transição de estado em rota própria), 0026 (o relógio mora no banco), 0030 (artefato derivado é
composto sob demanda), **0039** (alcance do congelamento).

**Evidência de execução:** suíte `@sysloc/api` verde em **455 casos**, `exit 0`, medida em 2026-09-02
após a última task.

⚠️ **A faixa `CT-1220 … CT-1249` é a da SUÍTE DE BORDA, não a da fatia** — os casos da fatia
começam **antes** dela, e vivem em **três** arquivos (medido em 2026-09-02):

| Arquivo | Casos |
|---|---|
| `apps/api/test/master-administradores.e2e.spec.ts` | `CT-1220` … `CT-1249` |
| `packages/db/test/administrador-do-master.spec.ts` | `CT-1204` … `CT-1214`, `CT-1217` … `CT-1219` |
| `packages/db/test/catalogo.spec.ts` | `CT-1215`, `CT-1216`, `CT-1242`, `CT-1243` |

⚠️ **`CT-1218` aparece na suíte de borda, mas NÃO é caso dela** — é uma citação em docblock,
apontando para o caso homônimo da camada de dados. Não o procure ali. Pela mesma razão, os
**455 casos** acima são só os do pacote `@sysloc/api`: a cobertura desta fatia atravessa o `db`
também, e quem for auditá-la roda os dois pacotes.
