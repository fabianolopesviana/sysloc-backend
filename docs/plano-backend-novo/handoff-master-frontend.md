# Handoff do **Painel Master** para o frontend

> **O que este arquivo é.** O contrato **completo e suficiente** para implementar o frontend do
> Painel Master do SaaS, sem consultar mais nada. Ele é **autossuficiente**: quem o receber não tem
> acesso a este repositório, e tudo o que precisa saber — rotas, corpos, erros, fluxo de sessão,
> regras — está escrito aqui.
>
> **Escopo: SÓ o Master.** O aplicativo do Sysloc (locação) tem handoff próprio, e os dois **não se
> misturam** — nem no build, nem no domínio, nem na sessão.
>
> **Estado do backend: as treze rotas estão TODAS implementadas e verificadas** — publicadas,
> cobertas por testes automatizados e em execução.
>
> ⚠️ **Sete delas são novas** e chegaram depois da primeira geração deste documento: o ciclo de vida
> do **Admin Empresa** visto pelo operador — listar por empresa, suspender, reativar, corrigir o
> cadastro e **remover em definitivo** — mais a **correção cadastral** e a **remoção definitiva** de
> empresa. Elas estão na §4, da §4.7 à §4.13. **Três coisas que a versão anterior deste documento
> dizia não existir passaram a existir**: excluir empresa, editar nome/documento de empresa e listar
> os usuários de uma empresa.
>
> ⚠️ **A pendência de origem do servidor CAIU.** O débito `D23 · F1/T8` foi **fechado em
> 2026-08-26**, e desde **2026-08-27** a origem `https://syslocadmin.systera.com.br` é aceita pela
> barreira de origem da API. O que permanece **não** é pendência, é o arranjo de publicação: a API
> não fala CORS, e o painel conversa com ela pelo **próprio domínio**, com `/v1/*` encaminhado pelo
> servidor de borda. Detalhado na §2 e na §8.
>
> Gerado em **2026-08-21**, a partir do código em execução, e **conferido linha a linha contra o
> código em 2026-08-21** — a conferência corrigiu a tabela de erros (faltava `CREDENCIAL_INVALIDA`),
> a política de senha (são quatro regras, não duas), as recusas da reemissão de senha (§4.6) e a
> semântica da validade da sessão. **Revisado e ampliado em 2026-09-02**, contra o código publicado
> pelas rotas novas: as §4.7 a §4.13 nasceram aí, e a §2, a §4.2, a §4.6, a §5, a §6, a §7 e a §8
> foram acertadas no que a publicação tornou falso. As referências `<!-- fonte: … -->` apontam o
> arquivo e a linha de onde cada afirmação saiu.

---

## 1. O que o Master é — e o que ele deliberadamente NÃO é

O Master é o **operador do SaaS**: quem cria empresas, admite o primeiro administrador de cada uma,
suspende e reativa. É a única persona que existe **fora** de qualquer empresa.

⚠️ **O Master não acessa dado de negócio de empresa alguma. Isso é garantido pelo banco, não por
convenção** — as tabelas de negócio têm isolamento por empresa forçado no PostgreSQL, e a sessão do
Master não carrega empresa. Uma tela que tente listar imóveis, contratos ou cobranças **não vai
receber dados vazios: vai receber `403`**, e isso é o desenho, não um defeito a contornar.

Consequência prática para o frontend: **não existe menu de negócio no Master.** As únicas telas são
as de administração de empresas descritas neste documento.

### App separado — decisão firmada

| | |
|---|---|
| Domínio | `syslocadmin.systera.com.br` |
| Build | **próprio**, separado do app do Sysloc |
| Servido | **só** nesse domínio |

Não é uma rota escondida dentro do app de locação, nem um menu condicional. São dois aplicativos.

---

## 2. Base da API e formato geral

**Base:** todas as rotas abaixo são relativas ao endereço da API, com prefixo de versão `/v1`.

**Corpo:** JSON em requisição e resposta (a única exceção é a entrada de sessão, descrita adiante).

**Sessão:** por **cookie**, `httpOnly` + `Secure` + `SameSite=Lax`. A validade é de **8 horas de
inatividade**, e **não** de 8 horas desde a entrada: o servidor renova a sessão a **cada
requisição**. Quem usa o app sem parar não cai na oitava hora; quem para 8 horas cai. O navegador
envia o cookie sozinho; o frontend **não** lê nem guarda token.
<!-- fonte: packages/auth/src/autenticacao.ts:117,129,801-804 (`DURACAO_DA_SESSAO_EM_SEGUNDOS = 8*60*60`, `RENOVACAO_DA_SESSAO_EM_SEGUNDOS = 0`) -->

> ### ⚠️ Antes da primeira chamada: como este app fala com a API
>
> **A API não publica CORS** — não há `@fastify/cors`, `enableCors` nem cabeçalho `Access-Control-*`
> em lugar nenhum de `apps/api/src`, verificado por varredura em **2026-09-02**. E isso **não é
> pendência**: é o arranjo de publicação. O painel é servido no domínio dele, e o servidor de borda
> encaminha `/v1/*` para a API no **mesmo host**. Para o navegador é sempre **mesma origem**, e
> pré-checagem nenhuma acontece.
>
> **O que mudou desde a primeira versão deste documento.** A lista de origens confiáveis do
> arcabouço de identidade era só o endereço de escuta local (`http://127.0.0.1:<porta>`), e por isso
> `/v1/auth/*` recusava o `Origin` do painel que o proxy repassa — era o débito `D23 · F1/T8`. Ele
> foi **fechado em 2026-08-26**: as origens públicas passaram a ser declaradas no ambiente do
> servidor (`ORIGENS_PUBLICAS`), o processo **não sobe** sem elas, e
> `https://syslocadmin.systera.com.br` está entre as declaradas desde **2026-08-27**. O paliativo que
> reescrevia o `Origin` no proxy do painel foi removido no mesmo passo — **não** o reintroduza.
>
> ⚠️ **Origem não declarada é recusada, e a recusa é do servidor, não do navegador.** A entrada em
> `/v1/auth/*` com um `Origin` fora da lista responde **`403`** com corpo exatamente
> `{ "codigo": "ACESSO_NEGADO", "mensagem": "acesso negado para esta sessão" }` e **sem** emitir
> cookie. Isso alcança o desenvolvimento: `http://localhost:5173` **não** atravessa. Rode o servidor
> de desenvolvimento com **proxy** de `/v1/*` para a API — o mesmo arranjo da produção — em vez de
> apontar o app direto para a API. Requisição **sem** cabeçalho `Origin` (ferramenta de linha de
> comando) atravessa.
>
> ⚠️ **`SameSite=Lax` é a segunda razão para o mesmo arranjo**: o cookie **não** viaja para outro
> *site*. Painel e API precisam ficar sob o mesmo domínio registrável (`*.systera.com.br`), ou o
> cookie terá de virar `SameSite=None` — o que é mudança **no servidor**, não no frontend.
> <!-- fonte: packages/auth/src/autenticacao.ts:613,812 · apps/api/src/autenticacao/autenticacao.module.ts:160 · apps/api/src/configuracao/ambiente.ts:681 · apps/api/test/origem-publica.e2e.spec.ts:10-23 -->

### Envelope de erro — idêntico em toda recusa

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "documento",
  "detalhes": { }
}
```

`codigo` e `mensagem` são **sempre** presentes; `campo` e `detalhes` são opcionais.

⚠️ **Como ler o `campo` — ele nomeia o culpado quando há um a nomear, e só então.** A recusa de uma
**propriedade ou parâmetro conhecido** traz **o nome dele** (`"deslocamento"`, `"nome"`, `"email"`,
`"documento"`), e é essa a que a tela pode rotear para o controle correspondente. A recusa que
**não tem o que nomear** — a **chave desconhecida** em corpo ou consulta fechados — cai no **campo
padrão daquela rota**, que é **declarado por rota** e não é universal: `"corpo"` em **toda** rota
do Master que leva corpo, `"limite"` nas **duas** listagens (§4.2 e §4.9) e `"senha"` na troca de
senha (§3.3). Aí o `campo` **não** é a chave que você enviou, e destacar um input por ele
destacaria o **controle errado** — trate esse caso como erro do formulário inteiro. O identificador
do caminho é sempre `"id"`.
<!-- fonte: apps/api/src/comum/validacao.ts:50-63 -->

⚠️ **Classifique pelo `codigo`, nunca pela `mensagem`.** O texto é para exibir; a lógica é do código.

São **oito**, e dois deles não têm status fixo.

| `codigo` | HTTP | Significa |
|---|---|---|
| `NAO_AUTENTICADO` | 401 | sem sessão, ou sessão expirada, **nas rotas do produto** (`/v1/sessao`, `/v1/sessao/senha`, `/v1/master/*`) → **mande para a tela de entrada** |
| `CREDENCIAL_INVALIDA` | 401 | a tentativa de **entrada** não resultou em acesso. É o código que `/v1/auth/*` devolve |
| `ACESSO_NEGADO` | 403 | autenticado, mas sem alcance (inclui sessão restrita — ver §3.2) |
| `CAMPO_INVALIDO` | **422** *ou* **400** | corpo ou consulta recusados; `campo` diz qual. **422** nas rotas do produto; **400** quando a recusa nasce no arcabouço de identidade |
| `RECURSO_NAO_ENCONTRADO` | 404 | id inexistente, ou caminho de `/v1/auth` que não é publicado |
| `REQUISICAO_RECUSADA` | **o status de origem** | recusa que este vocabulário não nomeia. **400** apenas quando o produto a levanta direto; vinda do arcabouço, ela **preserva o status original** — na prática, **429** do limitador de taxa |
| `ERRO_INTERNO` | 500 | falha do servidor |
| `SERVICO_INDISPONIVEL` | 503 | dependência fora do ar |

<!-- fonte: packages/shared/src/erros.ts:43-120 · apps/api/src/comum/filtro-excecao.ts:69-79,242-322 -->

⚠️ **`CREDENCIAL_INVALIDA` é um código para quatro causas, de propósito**: senha incorreta, conta
trancada por tentativas, pessoa desativada e empresa suspensa produzem resposta **idêntica** — mesmo
status, mesmo código, mesma mensagem, mesmos campos. Distinguir confirmaria ao atacante que a conta
existe. **Não prometa na tela um diagnóstico que a API não dá** — nada de "senha errada" ou "tente
em 15 minutos"; a frase honesta é "não foi possível entrar".

⚠️ **`mensagem` é sempre o texto canônico do `codigo`**, nunca o texto de quem recusou. Os oito são,
literalmente: `requisição inválida` · `credencial inválida` · `sessão inválida ou expirada` ·
`acesso negado para esta sessão` · `recurso não encontrado` · `requisição recusada` · `erro interno
no processamento da requisição` · `serviço temporariamente indisponível`. A **única** exceção é o
`403` da sessão restrita, que traz mensagem própria — e ela é tratada na §3.2.

---

## 3. Fluxo de sessão — leia inteiro antes de desenhar a tela de entrada

O Master tem **duas exigências obrigatórias** que o app precisa conduzir. Ignorá-las produz um app
que entra e recebe `403` em tudo.

### 3.1 Entrar

```
POST /v1/auth/sign-in/email
{ "email": "...", "password": "..." }
```

Resposta `200`. Se a conta tiver segundo fator ativo, o corpo é **exatamente** este — e a sessão
**ainda não está completa**:

```json
{ "twoFactorRedirect": true, "twoFactorMethods": ["totp"] }
```

<!-- fonte: apps/api/test/sessao-restrita.e2e.spec.ts:472 -->

Nesse caso, o passo seguinte:

```
POST /v1/auth/two-factor/verify-totp
{ "code": "123456" }
```

**Entrada recusada → `401 CREDENCIAL_INVALIDA`**, com as quatro causas indistinguíveis (§2).

**Dois limites que a tela de entrada vai encontrar**, e que o operador precisa entender:

| Limite | Valor | O que o app recebe |
|---|---|---|
| Tentativas por conta | **5 falhas consecutivas** trancam por **15 min** | mais `401 CREDENCIAL_INVALIDA` — a tranca **não** é distinguível |
| Taxa em `/v1/auth/sign-in/email` | **30 por minuto**, por origem | `429 REQUISICAO_RECUSADA` |
| Taxa nos demais `/v1/auth/*` | **120 por minuto** | `429 REQUISICAO_RECUSADA` |

⚠️ **O `429` vem sem cabeçalho algum** — nada de `Retry-After`. É só o par (status, corpo): o
limitador escreve o cabeçalho na instância do arcabouço, e ele morre na travessia até o cliente. Se
a tela quiser sugerir uma espera, o número tem de ser do frontend, não da resposta.

<!-- fonte: packages/auth/src/bloqueio.ts:33,44 · packages/auth/src/autenticacao.ts:149,173,214,258,602-620 · apps/api/src/autenticacao/senha.controller.ts:250-284 (DECISÃO FECHADA — T9/Gate 2) -->

### 3.2 As duas restrições

Depois de entrar, **sempre** consulte:

```
GET /v1/sessao
```

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

⚠️ **`telas` e `acoes` vêm VAZIOS para o Master, e isso é correto.** Ele não opera por permissão de
tela — o alcance dele é dado pelo **perfil**. Não interprete o vazio como "sem permissão para nada";
se você espelhar o menu nessas listas, o Master fica sem menu nenhum.

**As duas bandeiras que bloqueiam tudo:**

| Bandeira | Enquanto for `true` | Como resolver |
|---|---|---|
| `senhaProvisoria` | toda rota de negócio responde `403` | `POST /v1/sessao/senha` |
| `segundoFatorPendente` | idem | configurar o TOTP (§3.4) |

**O Master é obrigado a ter segundo fator.** Não é opcional, não é "recomendado": enquanto
`segundoFatorPendente` for `true`, ele não cria empresa nenhuma.

**Enquanto restrita, a sessão alcança exatamente três coisas** — e nada mais:

- `GET /v1/sessao`
- `POST /v1/sessao/senha`
- tudo sob `/v1/auth/*` (é onde a configuração do TOTP mora)

Qualquer outra rota responde `403 ACESSO_NEGADO`. <!-- fonte: apps/api/src/autenticacao/sessao-restrita.ts:152-159,173-193 -->

#### Como o app detecta que a sessão está restrita

⚠️ **Não classifique pela mensagem** — vale aqui como em todo o resto. O `403` da sessão restrita
**não traz `campo` nem `detalhes`**: o único sinal textual é a `mensagem`, e ela é uma destas três,
literalmente:

```
acesso negado: esta sessão está restrita até a troca da senha provisória
acesso negado: esta sessão está restrita até a configuração do segundo fator
acesso negado: esta sessão está restrita até a troca da senha provisória e a configuração do segundo fator
```

**O caminho correto é o estruturado**: ao receber `403`, **refaça `GET /v1/sessao`** — que a sessão
restrita sempre alcança — e decida pelas duas bandeiras booleanas. Exiba a `mensagem` ao operador,
mas **roteie pelas bandeiras**. <!-- fonte: apps/api/src/autenticacao/sessao-restrita.ts:121-130 · apps/api/src/autenticacao/contexto.guard.ts:460 -->

### 3.3 Trocar a senha provisória

```
POST /v1/sessao/senha
{ "senhaAtual": "...", "senhaNova": "..." }
```

**`200`:** `{ "trocada": true }` — e nada além disso.

Concluída a troca, a marca `senhaProvisoria` cai e **a mesma sessão** passa a alcançar tudo, sem
novo login. As **outras** sessões da pessoa são encerradas; a desta requisição permanece.

**Política de força — são QUATRO regras, não duas.** A recusa vem como `CAMPO_INVALIDO` com
`campo: "senha"` e **todos** os motivos violados em `detalhes.motivos`, nesta ordem fixa:

| Motivo | Regra |
|---|---|
| `COMPRIMENTO_MINIMO` | menos de **10** caracteres |
| `CONTEM_DADO_PESSOAL` | contém o nome, o endereço de e-mail, ou pedaço dele com **3+** caracteres |
| `SEQUENCIA_CONSECUTIVA` | **4** caracteres consecutivos (`abcd`, `1234`) |
| `REPETICAO` | **4** caracteres repetidos (`aaaa`) |

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "senha",
  "detalhes": { "motivos": ["COMPRIMENTO_MINIMO", "SEQUENCIA_CONSECUTIVA"] }
}
```

Como o servidor devolve **todos** os motivos de uma vez, a tela pode marcar as quatro regras juntas
em vez de revelá-las uma por vez.

**As outras recusas desta rota:**

| Situação | Resposta |
|---|---|
| `senhaAtual` incorreta | `422 CAMPO_INVALIDO` — **não** é `401` |
| sem sessão, ou pessoa que a política de admissão não admite mais | `401 NAO_AUTENTICADO` |
| janela de tentativas esgotada | **`429 REQUISICAO_RECUSADA`**, sem cabeçalho |

⚠️ **Toda recusa acontece antes de qualquer escrita**: senha fraca, senha atual errada, pessoa
desativada ou empresa suspensa deixam a credencial intacta e as sessões preservadas.

<!-- fonte: apps/api/src/autenticacao/senha.controller.ts:160,176-178,203-207,223-290 · packages/auth/src/senha.ts:33-96 -->

### 3.4 Configurar o segundo fator

```
POST /v1/auth/two-factor/enable
{ "password": "<a senha atual>" }
```

Devolve `totpURI` (para gerar o QR Code, emitido com `issuer: "Sysloc"`) e `backupCodes` (mostre-os
**uma vez**, com aviso de guardar fora do sistema). Depois:

```
POST /v1/auth/two-factor/verify-totp
{ "code": "123456" }
```

Só então `segundoFatorPendente` vira `false`.

**O código é de exatamente 6 dígitos**, e a forma é conferida **antes** da verificação — o que
separa erro de digitação de código errado:

| Entrada | Resposta |
|---|---|
| fora de `^[0-9]{6}$` | `422 CAMPO_INVALIDO`, com `campo: "codigo"` → *"o código tem 6 dígitos"* |
| 6 dígitos, mas errado | recusa do arcabouço → *"código inválido"* |
| **10** falhas de verificação | conta trancada por **15 min** |

⚠️ **O `campo` da recusa é `"codigo"`, com a chave do corpo sendo `code`** — o envelope fala o
vocabulário do produto (pt-BR), o corpo fala o do arcabouço. Não é erro de digitação deste
documento: uma tela que case `campo` com o `name` do input pelo nome enviado não acharia o controle.

⚠️ **`verify-totp` emite credencial de sessão NOVA e apaga a anterior.** Com
`credentials: 'include'` isso é transparente (o `Set-Cookie` chega junto), mas qualquer código que
guarde o valor do cookie à mão passa a guardar um valor morto.

**Os códigos de recuperação têm onde ser usados** — a tela de entrada precisa oferecer a alternativa:

```
POST /v1/auth/two-factor/verify-backup-code
{ "code": "..." }
```

E há `POST /v1/auth/two-factor/disable` (`{ "password": "..." }`), publicado pelo arcabouço.
⚠️ **O painel do Master não deve expor essa ação**: o segundo fator é obrigatório para o perfil, e
desligá-lo devolve a sessão ao estado restrito.

<!-- fonte: packages/auth/src/autenticacao.ts:274,277,380-394,839-871 · apps/api/test/contexto.e2e.spec.ts:1951-1998 -->

⚠️ **Requisições ao `/v1/auth/*` que levem cookie exigem o cabeçalho `Origin`** conferido pelo
servidor. Um navegador o envia sozinho — isto é uma nota para quem testar com ferramenta de linha
de comando.

### 3.5 Sair

```
POST /v1/auth/sign-out
```

---

## 4. As treze rotas do Master

Todas exigem sessão de perfil `SYSLOC_MASTER`, sem restrição pendente. Todas respondem
`NAO_AUTENTICADO` (401) sem sessão e `ACESSO_NEGADO` (403) para qualquer outro perfil.

**O quadro completo**, com o método e o caminho exatos — os treze são medidos nos dois controladores
do servidor, e não somados de cabeça:

| § | Método e caminho | O que faz |
|---|---|---|
| 4.1 | `POST /v1/master/empresas` | cria empresa |
| 4.2 | `GET /v1/master/empresas` | lista empresas, com a prévia de exclusão de cada uma |
| 4.3 | `POST /v1/master/empresas/{id}/admin` | admite administrador, com Senha provisória |
| 4.4 | `POST /v1/master/empresas/{id}/suspensao` | suspende empresa |
| 4.5 | `POST /v1/master/empresas/{id}/reativacao` | reativa empresa |
| 4.6 | `POST /v1/master/usuarios/{id}/senha-provisoria` | reemite Senha provisória |
| 4.7 | `PUT /v1/master/empresas/{id}` | corrige nome e documento da empresa |
| 4.8 | `DELETE /v1/master/empresas/{id}` | **remove a empresa em definitivo**, com as pessoas dela |
| 4.9 | `GET /v1/master/empresas/{id}/administradores` | lista os Admin Empresa da empresa |
| 4.10 | `POST /v1/master/usuarios/{id}/suspensao` | suspende um Admin Empresa |
| 4.11 | `POST /v1/master/usuarios/{id}/reativacao` | reativa um Admin Empresa |
| 4.12 | `PUT /v1/master/usuarios/{id}` | corrige nome e e-mail do Admin Empresa |
| 4.13 | `DELETE /v1/master/usuarios/{id}` | **remove o Admin Empresa em definitivo** |

⚠️ **As §4.1 a §4.6 são as seis originais e a numeração delas NÃO mudou** — as sete novas entram no
fim, de 4.7 a 4.13, para que toda referência já escrita (§4.3, §4.6) continue apontando para o mesmo
lugar. A ordem da tabela é a da publicação, não a da navegação: a §5 sugere as telas.

<!-- fonte: apps/api/src/master/empresa.controller.ts:386,401,416,468,501,535,555,574 · apps/api/src/master/administrador.controller.ts:158,189,226,258,318 -->

> ### ⚠️ Duas operações desta lista são IRREVERSÍVEIS
>
> As §4.8 e §4.13 **apagam** — não retiram de circulação, não marcam como inativo: apagam. Não há
> desfazer, não há lixeira e não há campo de "excluído em" a consultar depois. O resto do produto
> **não** funciona assim: no domínio de locação (imóvel, contrato, pessoa) a exclusão é sempre
> lógica, e o registro continua legível. Estas duas são a exceção declarada, e valem **só** para
> empresa e para a pessoa do Admin Empresa.
>
> A tela precisa: pedir confirmação com o nome escrito, dizer que é definitivo, e **ler a prévia
> `exclusao`** que a listagem já entrega por item antes de sequer oferecer o botão (§4.2 e §4.9).

### 4.1 Criar empresa

```
POST /v1/master/empresas
{ "nome": "TECHTEL TECNOLOGIA LTDA", "documento": "07.719.758/0001-23" }
```

| Campo | Regra |
|---|---|
| `nome` | obrigatório, 1–200 caracteres |
| `documento` | obrigatório, 1–64 caracteres |

⚠️ **Corpo fechado**: campo desconhecido é **recusado**, não ignorado. Não mande `id`, `estado` nem
`criadaEm`.

**`201`:**

```json
{ "id": "uuid", "nome": "...", "documento": "...", "estado": "ATIVA", "criadaEm": "2026-08-21T01:00:00.000Z" }
```

**`422 CAMPO_INVALIDO`** — inclusive quando o **documento já existe**. A empresa não é criada, e o
que discrimina a duplicidade de um campo malformado é `detalhes.motivo`:

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "documento",
  "detalhes": { "motivo": "DOCUMENTO_JA_REGISTRADO" }
}
```

⚠️ **O documento é comparado como veio** — não há normalização de pontuação no servidor.
`07.719.758/0001-23` e `07719758000123` são dois documentos distintos para a unicidade. Se o painel
quiser impedir a duplicata mascarada, a normalização é **do frontend**. <!-- fonte: apps/api/src/master/empresa.service.ts:251-267 · packages/db/src/empresa.ts:144 -->

### 4.2 Listar empresas

```
GET /v1/master/empresas?limite=50&deslocamento=0
```

| Parâmetro | Padrão | Limites |
|---|---|---|
| `limite` | **50** | 1 a **200** |
| `deslocamento` | **0** | ≥ 0 |

**`200`:**

```json
{
  "itens": [
    {
      "id": "uuid",
      "nome": "...",
      "documento": "...",
      "estado": "ATIVA",
      "criadaEm": "...",
      "exclusao": { "disponivel": true, "impedimentos": [] }
    }
  ],
  "total": 137,
  "limite": 50,
  "deslocamento": 0
}
```

`estado` é **`ATIVA`** ou **`SUSPENSA`**, e é o rótulo de situação. `total` é o total geral, para
montar a paginação.

⚠️ **`exclusao` é a prévia da remoção definitiva da §4.8**, e ela existe por item desde que aquela
rota foi publicada. Quando a exclusão está indisponível vêm mais dois campos:

```json
{
  "disponivel": false,
  "motivo": "EXCLUSAO_IMPEDIDA_POR_REGISTROS",
  "impedimentos": ["REGISTROS_DE_NEGOCIO"],
  "alternativa": "SUSPENSAO"
}
```

`motivo` e `alternativa` **só aparecem quando `disponivel` é `false`** — a ausência deles já diz que
a exclusão está disponível, e a tela não precisa lê-los para decidir. O vocabulário de
`impedimentos` é **fechado**, e está descrito na §4.8. Use a prévia para **habilitar ou desabilitar
o botão de excluir**, e mostre `alternativa` como o caminho que resta.

⚠️ **`impedimentos` traz exatamente UMA classe** — a da primeira restrição que o banco recusou, não
a lista completa dos motivos. Resolver essa e tentar de novo pode revelar outra. Não escreva a tela
como se ela recebesse um inventário.

⚠️ **A prévia é do instante da leitura, não uma promessa.** Ela é obtida executando o próprio ato em
ensaio e desfazendo-o; entre a listagem e o clique, um registro novo pode ter nascido. Trate um
`422` na §4.8 como resultado normal, não como defeito da tela.

⚠️ **A criação (§4.1) NÃO devolve `exclusao`** — uma empresa recém-criada é elegível por
construção, e a assimetria é deliberada. Não escreva um leitor que exija o campo nas duas respostas.
<!-- fonte: apps/api/src/master/empresa.controller.ts:272-310 · apps/api/src/master/empresa.service.ts:420-440 -->

⚠️ **A consulta é FECHADA, como os corpos.** `limite` e `deslocamento` são os **únicos** parâmetros
aceitos: qualquer outro — `?estado=ATIVA`, `?busca=`, um `?_t=` de cache-busting — responde
**`422 CAMPO_INVALIDO`**. **Não existe filtro nem busca no servidor**; ordenação, busca e filtro por
estado são do cliente, sobre a página recebida.

⚠️ **`limite` acima de 200 RECUSA — não trunca.** Truncar em silêncio faria o operador acreditar que
viu tudo.

⚠️ **E as três recusas da consulta nomeiam campos DIFERENTES**, pela regra do *Envelope de erro*
(§2): `limite` fora de faixa traz `campo: "limite"`; `deslocamento` negativo traz
`campo: "deslocamento"`; o **parâmetro
desconhecido** traz `campo: "limite"`, que é o padrão da rota e **não** a chave que foi enviada. É
idêntico na §4.9. <!-- fonte: apps/api/src/master/empresa.controller.ts:218-225,413 -->

**A ordem é fixa e crescente: `criada_em`, e `id` como desempate** — a empresa **mais antiga vem
primeiro**. O servidor não aceita declarar outra. Se a tela quiser "mais recentes primeiro", ela
inverte no cliente — e, nesse caso, **inverta também o cálculo do `deslocamento`**, ou a segunda
página virá errada. <!-- fonte: apps/api/src/master/empresa.controller.ts:135-148 · packages/db/src/empresa.ts:166-167 -->

⚠️ **A listagem devolve identificação e estado, e NENHUM dado de negócio.** Não há contagem de
imóveis, contratos ou faturamento — nem virá a haver, por decisão de isolamento.

### 4.3 Admitir o administrador da empresa

```
POST /v1/master/empresas/{id}/admin
{ "nome": "Fulano de Tal", "email": "fulano@exemplo.com" }
```

O e-mail é normalizado para minúsculas pelo servidor. O perfil é fixo (`ADMIN_EMPRESA`) e a empresa
é a do caminho — **não** os mande no corpo (é fechado).

**`201`:**

```json
{ "usuarioId": "uuid", "email": "fulano@exemplo.com", "senhaProvisoria": "..." }
```

> ### ⚠️ A senha provisória aparece UMA ÚNICA VEZ
>
> Nenhuma consulta posterior a recupera. A tela **precisa**:
> 1. exibi-la com destaque e botão de copiar;
> 2. avisar, antes de fechar, que ela não será mostrada de novo;
> 3. **nunca** gravá-la em `localStorage`, log, ou estado que sobreviva à tela.
>
> Perdida, o caminho é reemitir (§4.6).

Atende tanto o **primeiro** admin quanto o **socorro** de uma empresa cujo único admin ficou
inacessível.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` — recusado **antes** de tocar o banco |
| empresa não existe | `404 RECURSO_NAO_ENCONTRADO` |
| e-mail já em uso | `422 CAMPO_INVALIDO`, `campo: "email"`, `detalhes.motivo: "EMAIL_JA_REGISTRADO"` |

O e-mail é único **no sistema inteiro**, não por empresa: um endereço que já administra a empresa A
não pode ser admitido na empresa B.

<!-- fonte: apps/api/src/master/empresa.controller.ts:95-97,110-127 · apps/api/src/master/empresa.service.ts:341-357 -->

### 4.4 Suspender empresa

```
POST /v1/master/empresas/{id}/suspensao
```

Sem corpo.

**`200`:**

```json
{ "id": "uuid", "estado": "SUSPENSA", "suspensaEm": "...", "sessoesEncerradas": 3 }
```

⚠️ **A suspensão encerra as sessões ativas NA HORA** — não no próximo login. `sessoesEncerradas` diz
quantas caíram, e vale mostrar ao operador: é a confirmação de que quem estava dentro foi posto para
fora. **É ação de efeito imediato sobre gente trabalhando: peça confirmação explícita**, com o nome
da empresa escrito.

**É idempotente.** Repetir sobre empresa já suspensa devolve `200` com o **mesmo `suspensaEm`** da
primeira vez e `sessoesEncerradas: 0` — nunca um erro de conflito. Um duplo clique é inofensivo.

**`404`** se a empresa não existe · **`422`** se `{id}` não é UUID.

<!-- fonte: apps/api/src/master/empresa.service.ts:400-420 · packages/db/src/empresa.ts:218-236 -->

### 4.5 Reativar empresa

```
POST /v1/master/empresas/{id}/reativacao
```

Sem corpo. **`200`:** `{ "id": "uuid", "estado": "ATIVA" }`

⚠️ **Reativar devolve a capacidade de entrar, e NÃO as sessões que a suspensão encerrou.** Todos os
cookies anteriores seguem inválidos: quem estava dentro entra de novo. Diga isso na tela — é a
pergunta que o operador faz.

**`404`** se a empresa não existe · **`422`** se `{id}` não é UUID. <!-- fonte: apps/api/src/master/empresa.service.ts:576-596 -->

### 4.6 Reemitir senha provisória de um usuário

```
POST /v1/master/usuarios/{id}/senha-provisoria
```

Sem corpo. **`200`:**

```json
{ "usuarioId": "uuid", "senhaProvisoria": "..." }
```

Mesmas regras de exibição da §4.3 — **uma única vez**. A senha anterior deixa de servir **no mesmo
ato**, e quem a tentar recebe a recusa indistinguível de credencial incorreta.

⚠️ **O alvo é restrito ao perfil `ADMIN_EMPRESA`.** O `{id}` de um Master, ou de um
`USUARIO_EMPRESA`, é recusado — e a recusa nomeia os dois perfis, o exigido e o do alvo.

| Situação | Resposta |
|---|---|
| `{id}` não é UUID | `422 CAMPO_INVALIDO`, `campo: "id"` |
| usuário não existe | `404 RECURSO_NAO_ENCONTRADO` |
| alvo não é `ADMIN_EMPRESA` | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes: { "perfilExigido": "ADMIN_EMPRESA", "perfilDoAlvo": "SYSLOC_MASTER" }` |

De onde sai o `{id}`: da **listagem de administradores da empresa** (§4.9), que devolve o
`usuarioId` de cada pessoa. ⚠️ **Não é mais preciso guardar o `usuarioId` da admissão** — a versão
anterior deste documento mandava guardá-lo porque a listagem não existia; ela existe desde 2026-09-02
e é o caminho normal para alcançar qualquer pessoa da empresa.

<!-- fonte: apps/api/src/master/empresa.controller.ts:198-216 · apps/api/src/master/empresa.service.ts:570-600 -->

### 4.7 Corrigir o cadastro da empresa

```
PUT /v1/master/empresas/{id}
{ "nome": "TECHTEL TECNOLOGIA LTDA", "documento": "07.719.758/0001-23" }
```

| Campo | Regra |
|---|---|
| `nome` | **obrigatório**, 1–200 caracteres |
| `documento` | **obrigatório**, 1–64 caracteres |

⚠️ **É `PUT` com corpo COMPLETO — não é atualização parcial.** Os dois campos são obrigatórios;
omitir `documento` para "não mexer nele" responde `422`. Preencha o formulário com os valores atuais
vindos da listagem e mande os dois de volta.

⚠️ **Corpo fechado, e o que ele recusa é conteúdo**: `estado`, `suspensaEm` e `empresaId` **não
existem** no esquema, e enviá-los responde `422 CAMPO_INVALIDO` com `campo: "corpo"`. Não há como
suspender ou reativar por aqui — transição de estado tem rota própria (§4.4 e §4.5). Corrigir uma
empresa suspensa a **mantém suspensa**, com exatamente o mesmo `suspensaEm`.

**`200`** — a **linha inteira da listagem**, prévia de exclusão inclusive, no mesmo formato da §4.2:

```json
{
  "id": "uuid",
  "nome": "...",
  "documento": "...",
  "estado": "SUSPENSA",
  "criadaEm": "...",
  "exclusao": { "disponivel": true, "impedimentos": [] }
}
```

Isso é deliberado: a tela **substitui a linha que ela já tem**, em vez de remontar o item a partir de
duas formas diferentes do mesmo fato.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` — recusado **antes** de tocar o banco |
| empresa não existe | `404 RECURSO_NAO_ENCONTRADO` |
| campo do corpo inválido (nome vazio, documento longo demais) | `422 CAMPO_INVALIDO`, `campo` com o nome do campo (`"nome"` / `"documento"`) |
| chave desconhecida no corpo | `422 CAMPO_INVALIDO`, `campo: "corpo"` |
| documento já registrado por **outra** empresa | `422 CAMPO_INVALIDO`, `campo: "documento"`, `detalhes.motivo: "DOCUMENTO_JA_REGISTRADO"` |

⚠️ **A recusa por documento repetido não deixa efeito nenhum** — nem o `nome` válido que viajou no
mesmo corpo fica gravado. A tela pode reapresentar o formulário como o usuário o preencheu.

⚠️ **O documento continua sendo comparado como veio**, sem normalização de pontuação no servidor
(§4.1). `07.719.758/0001-23` e `07719758000123` são dois documentos distintos para a unicidade.

<!-- fonte: apps/api/src/master/empresa.controller.ts:416-467 · apps/api/src/master/empresa.service.ts:469-505 -->

### 4.8 Excluir empresa — **em definitivo**

```
DELETE /v1/master/empresas/{id}
```

Sem corpo. **Não mande `{}`** — não é preciso, e nada é lido dele.

**`200`:**

```json
{ "id": "uuid", "removida": true }
```

> ### ⚠️ Isto apaga o tenant inteiro, e não há desfazer
>
> A empresa **e as pessoas dela** somem num único commit — junto com credencial, segundo fator e
> sessões de cada uma, por cascata. Não é retirada de circulação, não é `estado: "EXCLUIDA"`, não
> volta. Esta e a §4.13 são as **duas únicas** operações de apagar que este painel oferece, e elas
> existem porque são o único mecanismo de eliminação de dado pessoal que o produto tem.
>
> A tela deve exigir confirmação com o **nome da empresa digitado**, e nunca oferecê-la quando a
> prévia `exclusao.disponivel` da §4.2 for `false`.

⚠️ **O campo chama-se `removida`** — com **a**. O corpo irmão da §4.13 publica `removido`, com
**o**: a concordância acompanha o substantivo (empresa / administrador). Não escreva um leitor único
para os dois campos.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` |
| empresa não existe | `404 RECURSO_NAO_ENCONTRADO` |
| há registro apontando para a empresa, ou para uma pessoa dela | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes` — abaixo |

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

`impedimentos` fala um vocabulário **fechado** de cinco classes, o mesmo das prévias da §4.2 e da
§4.9 — mas **cada rota só usa a parte que é dela**:

| Classe | O que ela diz | Onde aparece |
|---|---|---|
| `REGISTROS_DE_NEGOCIO` | há dado de locação (imóvel, contrato, cobrança…) apontando para a empresa | empresa (§4.2, §4.8) |
| `ADMINISTRADORES_NAO_ELEGIVEIS` | ao menos uma pessoa da empresa é ela própria inelegível | empresa (§4.2, §4.8) |
| `TENTATIVA_DE_ENTRADA` | há trilha de tentativa de entrada da pessoa — auditoria **nunca** é destruída | pessoa (§4.9, §4.13) |
| `AUTORIA_EM_REGISTRO` | a pessoa consta como autora de algum registro | pessoa (§4.9, §4.13) |
| `VINCULO_DE_ACESSO` | há vínculo ou concessão de acesso apontando para a pessoa | pessoa (§4.9, §4.13) |

⚠️ **A recusa da empresa NUNCA nomeia a classe fina de uma pessoa.** Quando o impedimento vem de um
administrador, o que chega é `ADMINISTRADORES_NAO_ELEGIVEIS` — atribuir `TENTATIVA_DE_ENTRADA` à
*empresa* seria imputar a ela um fato que é de alguém. O operador desce ao detalhe pela §4.9, onde
cada pessoa traz a **própria** prévia. É o desenho, e a tela deve conduzir exatamente esse caminho:
recusa da empresa → listagem dos administradores → prévia de cada um.

⚠️ **`impedimentos` traz exatamente UMA classe**, a da primeira restrição que o banco recusou — não
o inventário dos motivos.

⚠️ **Nunca virá a entidade nem a quantidade.** Não espere `"3 contratos"` nem o código de um
contrato: a resposta nomeia a **classe** e a **alternativa**, e o painel não alcança dado de negócio
(§1). O que a tela deve exibir é a classe traduzida e o caminho que sobra — `alternativa:
"SUSPENSAO"` é a rota da §4.4.

⚠️ **A recusa não deixa efeito.** Nada é removido quando ela acontece.

<!-- fonte: apps/api/src/master/empresa.controller.ts:468-500 · apps/api/src/master/empresa.service.ts:539-568,939-993 -->

### 4.9 Listar os administradores de uma empresa

```
GET /v1/master/empresas/{id}/administradores?limite=25&deslocamento=0
```

| Parâmetro | Padrão | Limites |
|---|---|---|
| `limite` | **25** | 1 a **50** |
| `deslocamento` | **0** | ≥ 0 |

⚠️ **O teto aqui é 50, e NÃO os 200 da listagem de empresas.** O número saiu de medição: cada item
carrega a prévia de exclusão, que custa ~3,4 ms porque é o próprio ato executado em ensaio e
desfeito. Não copie a paginação da §4.2 — `?limite=200` responde `422`.

**`200`:**

```json
{
  "itens": [
    {
      "usuarioId": "uuid",
      "nome": "Fulano de Tal",
      "email": "fulano@exemplo.com",
      "estado": "ATIVO",
      "criadoEm": "2026-09-01T12:00:00.000Z",
      "exclusao": { "disponivel": true, "impedimentos": [] }
    }
  ],
  "total": 3,
  "limite": 25,
  "deslocamento": 0
}
```

| Campo | O que é |
|---|---|
| `usuarioId` | o `{id}` que as §4.6 e §4.10 a §4.13 consomem — **nada precisa ter sido anotado antes** |
| `estado` | **`ATIVO`** ou **`SUSPENSO`** (masculino: é pessoa, não empresa) |
| `criadoEm` | quando a pessoa foi admitida |
| `exclusao` | a prévia da remoção da §4.13, na mesma forma da §4.2 |

⚠️ **Só o perfil `ADMIN_EMPRESA` aparece.** O Usuário Empresa e o próprio operador **não** entram na
lista — não é filtro do cliente, é recorte do servidor. Uma tela que prometesse "todos os usuários da
empresa" mentiria.

⚠️ **Nenhum dado de negócio vem junto** — nem contagem de imóveis, nem de contratos. Por desenho.

⚠️ **A ordem é fixa: `nome`, com `id` como desempate.** O servidor não aceita declarar outra. Se a
tela quiser outra ordenação, ela ordena a página recebida — e, se inverter, **inverta também o
cálculo do `deslocamento`**.

⚠️ **A consulta é FECHADA**, como as demais: `limite` e `deslocamento` são os únicos parâmetros
aceitos, e qualquer outro (`?estado=`, `?busca=`, um `?_t=` de cache-busting) responde
`422 CAMPO_INVALIDO` com `campo: "limite"`.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` |
| **empresa não existe** | `404 RECURSO_NAO_ENCONTRADO` — e **não** uma página vazia |
| `limite` acima de 50, abaixo de 1, ou não inteiro | `422 CAMPO_INVALIDO`, `campo: "limite"` |
| `deslocamento` negativo, ou não inteiro | `422 CAMPO_INVALIDO`, **`campo: "deslocamento"`** — o campo culpado, não `"limite"` |
| parâmetro desconhecido (`?estado=`, `?busca=`, `?_t=`) | `422 CAMPO_INVALIDO`, `campo: "limite"` — o **padrão da rota** (*Envelope de erro*, §2), pois a chave desconhecida não tem o que nomear |

⚠️ **Página vazia e empresa inexistente são coisas diferentes, e o servidor as distingue.** `itens:
[]` com `200` significa *"a empresa existe e não tem administrador"* — é o estado em que cabe
oferecer a admissão da §4.3.

<!-- fonte: apps/api/src/master/administrador.controller.ts:158-187 · apps/api/src/master/administrador.contrato.ts:114,117,130,215,237 · apps/api/src/master/administrador.service.ts:184-217 · packages/db/src/administrador-do-master.ts:511 -->

### 4.10 Suspender um administrador

```
POST /v1/master/usuarios/{id}/suspensao
```

Sem corpo.

**`200`:**

```json
{ "usuarioId": "uuid", "estado": "SUSPENSO", "sessoesEncerradas": 2 }
```

⚠️ **A suspensão encerra as sessões da pessoa NA HORA** — não no próximo login. `sessoesEncerradas`
diz quantas caíram, e vale mostrar ao operador. **É ação de efeito imediato sobre alguém
trabalhando: peça confirmação explícita**, com o nome da pessoa escrito.

⚠️ **O alcance é por PESSOA, não por empresa.** A colega ativa da mesma empresa continua operando no
mesmo instante — não confunda com a §4.4, que derruba a empresa inteira.

**É idempotente.** Repetir sobre quem já está suspenso devolve o mesmo corpo, com
`sessoesEncerradas: 0`. Um duplo clique é inofensivo.

⚠️ **O corpo é vazio e FECHADO.** Se o app mandar `{"estado":"ATIVO"}` por engano, a resposta é
`422 CAMPO_INVALIDO` com `campo: "corpo"` — nunca um `200` que descarta o que foi enviado em
silêncio.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` |
| usuário não existe | `404 RECURSO_NAO_ENCONTRADO` |
| alvo não é `ADMIN_EMPRESA` | `422 CAMPO_INVALIDO`, `campo: "id"`, `detalhes: { "perfilExigido": "ADMIN_EMPRESA", "perfilDoAlvo": "SYSLOC_MASTER" }` — e **nenhuma sessão é encerrada** |
| corpo com qualquer campo | `422 CAMPO_INVALIDO`, `campo: "corpo"` |

<!-- fonte: apps/api/src/master/administrador.controller.ts:189-224 · apps/api/src/master/administrador.service.ts:232-256,570-579 -->

### 4.11 Reativar um administrador

```
POST /v1/master/usuarios/{id}/reativacao
```

Sem corpo. **`200`:** `{ "usuarioId": "uuid", "estado": "ATIVO" }`

⚠️ **Reativar devolve a capacidade de entrar, e NÃO as sessões que a suspensão encerrou.** Os
cookies anteriores seguem inválidos: a pessoa entra de novo. Diga isso na tela.

⚠️ **Não há `sessoesEncerradas` aqui, e a ausência é conteúdo** — publicá-lo com zero sugeriria que
houve algum encerramento medido. Não escreva um leitor que exija o campo nas duas respostas.

**É idempotente**: repetir sobre quem já está ativo devolve o mesmo corpo.

⚠️ **Reativar a pessoa não reativa a empresa.** Se a empresa dela estiver suspensa, ela continua sem
entrar — são dois estados independentes, e a rota de empresa é a §4.5.

Mesmas recusas da §4.10, com o mesmo corpo vazio e fechado.

<!-- fonte: apps/api/src/master/administrador.controller.ts:226-256 · apps/api/src/master/administrador.service.ts:268-280 -->

### 4.12 Corrigir o cadastro de um administrador

```
PUT /v1/master/usuarios/{id}
{ "nome": "Fulana de Tal", "email": "fulana@exemplo.com" }
```

| Campo | Regra |
|---|---|
| `nome` | **obrigatório**, 1–200 caracteres |
| `email` | **obrigatório**, endereço válido; normalizado para minúsculas pelo servidor |

⚠️ **É `PUT` com corpo COMPLETO**, como a §4.7: os dois campos são obrigatórios.

⚠️ **Corpo fechado**: `estado`, `ativo`, `perfil` e `empresaId` **não existem** no esquema, e
enviá-los responde `422 CAMPO_INVALIDO` com `campo: "corpo"`. Não se muda estado por aqui (§4.10 e
§4.11), não se muda perfil, e não se muda a pessoa de empresa. Editar quem está suspenso o **mantém
suspenso**.

**`200`** — a **linha inteira da listagem** da §4.9, prévia de exclusão inclusive:

```json
{
  "usuarioId": "uuid",
  "nome": "Fulana de Tal",
  "email": "fulana@exemplo.com",
  "estado": "SUSPENSO",
  "criadoEm": "...",
  "exclusao": { "disponivel": true, "impedimentos": [] }
}
```

⚠️ **A Senha provisória sobrevive à troca de e-mail.** A credencial ancora no `usuarioId`, não no
endereço: quem recebeu a senha antes da correção entra com ela depois. Mas **a entrada passa a ser
pelo endereço novo** — é por ele que a admissão de sessão procura a pessoa. Diga isso na tela: o
e-mail de entrada mudou, a senha não.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` — conferido **antes** do corpo |
| usuário não existe | `404 RECURSO_NAO_ENCONTRADO` |
| alvo não é `ADMIN_EMPRESA` | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes.perfilExigido` / `detalhes.perfilDoAlvo` — **antes de qualquer escrita** |
| campo do corpo inválido | `422 CAMPO_INVALIDO`, `campo: "nome"` ou `campo: "email"` |
| chave desconhecida no corpo | `422 CAMPO_INVALIDO`, `campo: "corpo"` |
| e-mail já registrado por outra pessoa | `422 CAMPO_INVALIDO`, `campo: "email"`, `detalhes.motivo: "EMAIL_JA_REGISTRADO"` |

⚠️ **A recusa por e-mail em uso não grava nada** — nem o `nome` válido do mesmo corpo. E o endereço
da outra pessoa **não** aparece na resposta: o e-mail é único no sistema inteiro (§4.3), e confirmar
qual conta o ocupa seria dizer o que a persona não alcança.

<!-- fonte: apps/api/src/master/administrador.controller.ts:258-294 · apps/api/src/master/administrador.contrato.ts:316-325 · apps/api/src/master/administrador.service.ts:306-353,505-511 -->

### 4.13 Remover um administrador — **em definitivo**

```
DELETE /v1/master/usuarios/{id}
```

Sem corpo. **`200`:**

```json
{ "usuarioId": "uuid", "removido": true }
```

> ### ⚠️ Isto apaga a pessoa, e não há desfazer
>
> A pessoa some de verdade — credencial, segundo fator e sessões vão junto, por cascata. **Não
> existe contrapartida lógica**: não há "administrador removido" a listar depois, não há reativação
> e não há campo de retirada a consultar. Quem quiser algo reversível usa a **suspensão** (§4.10),
> que é justamente a `alternativa` que a recusa oferece.
>
> A tela deve exigir confirmação, e nunca oferecer o botão quando `exclusao.disponivel` da §4.9 for
> `false`.

⚠️ **O campo chama-se `removido`** — com **o**; a §4.8 publica `removida`, com **a**.

**As recusas:**

| Situação | Resposta |
|---|---|
| `{id}` não é UUID bem formado | `422 CAMPO_INVALIDO`, `campo: "id"` |
| usuário não existe | `404 RECURSO_NAO_ENCONTRADO` |
| alvo não é `ADMIN_EMPRESA` | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes.perfilExigido` / `detalhes.perfilDoAlvo` — e **nada é removido** |
| há registro apontando para a pessoa | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes.motivo` / `detalhes.impedimentos` / `detalhes.alternativa` |

O corpo da recusa por impedimento tem a **mesma forma** da §4.8 e a mesma
`alternativa: "SUSPENSAO"` — e, pela mesma razão, **nunca** a entidade nem a quantidade. As classes
que aparecem aqui são as **três de pessoa**: `TENTATIVA_DE_ENTRADA`, `AUTORIA_EM_REGISTRO` e
`VINCULO_DE_ACESSO` (tabela da §4.8), sempre **uma** por resposta.

⚠️ **A trilha de tentativas de entrada impede a remoção, e isso é desenho**: a auditoria não é
destruída por esta rota. Na prática, uma pessoa que já tentou entrar alguma vez **não é mais
removível** — a janela é curta na vida real, e a saída é a suspensão.

<!-- fonte: apps/api/src/master/administrador.controller.ts:318-353 · apps/api/src/master/administrador.contrato.ts:344-347 · apps/api/src/master/administrador.service.ts:380-410,525-546 -->

---

## 5. Telas sugeridas

O backend não impõe navegação. Estas são as telas que as treze rotas sustentam:

1. **Entrada** — e-mail/senha → segundo fator (com a alternativa do código de recuperação, §3.4) →
   (se preciso) troca de senha → (se preciso) configuração do TOTP. É um **fluxo condicional guiado
   por `GET /v1/sessao`**, não uma tela só.
2. **Empresas** — tabela paginada com nome, documento, estado e data; busca no cliente; ação de
   criar; ações por linha de suspender/reativar.
3. **Nova empresa** — formulário de dois campos, com o erro de documento repetido no campo.
4. **Admitir administrador** — dentro da empresa; termina no diálogo da senha provisória.
5. **Confirmação de suspensão** — diálogo com o nome da empresa digitado ou botão destacado, e o
   resultado mostrando `sessoesEncerradas`.
6. **Editar empresa** — o mesmo formulário de dois campos da tela 3, preenchido com os valores
   atuais e mandando os dois de volta (§4.7). O erro de documento repetido volta no campo.
7. **Administradores da empresa** — tabela dentro da empresa, com nome, e-mail, estado e as ações
   por linha: suspender/reativar (§4.10, §4.11), editar (§4.12), reemitir senha (§4.6) e excluir
   (§4.13). A ação de excluir sai da prévia `exclusao` de cada linha, não de uma regra do cliente.
8. **Confirmação de exclusão definitiva** — uma para empresa (§4.8) e outra para pessoa (§4.13),
   com o nome digitado e a advertência de que não há desfazer. Quando a recusa vier, a tela traduz
   as classes de `impedimentos` e oferece a `alternativa` (suspender).

---

## 6. Regras que o frontend precisa respeitar

1. **Nunca mostre menu ou tela de dado de negócio.** O Master não os alcança, e a API responde `403`.
2. **Não espelhe o menu em `telas`/`acoes`** — elas são vazias para o Master de propósito (§3.2).
3. **Trate `401` globalmente**: qualquer `401` — `NAO_AUTENTICADO` ou `CREDENCIAL_INVALIDA` —
   significa sessão ausente ou expirada → tela de entrada. A sessão dura 8 h **de inatividade**, e é
   renovada a cada requisição.
4. **Trate `403` refazendo `GET /v1/sessao`**: exiba a `mensagem` do servidor, mas **roteie pelas
   bandeiras** `senhaProvisoria` / `segundoFatorPendente` (§3.2). A mensagem é texto; ela não é
   discriminador.
5. **Trate `429`**: é `REQUISICAO_RECUSADA` com o status 429 e **sem `Retry-After`** — desabilite o
   botão por um intervalo que o próprio app escolha.
6. **Senha provisória é efêmera**: exibir uma vez, copiar, nunca persistir.
7. **Suspensão é destrutiva de sessão**: confirmação explícita.
8. **Corpos e consultas são fechados**: campo ou parâmetro a mais é `422`, não é ignorado (§4.1, §4.2).
9. **O `usuarioId` vem da listagem de administradores** (§4.9) — é dela que saem os alvos da
   reemissão, da suspensão, da correção e da remoção. Não é preciso guardar o da admissão.
10. **Exclusão definitiva é irreversível, e a decisão de oferecê-la é do servidor**: leia
    `exclusao.disponivel` de cada item (§4.2, §4.9) antes de habilitar o botão, e trate um `422` no
    clique como resultado normal — a prévia é do instante da leitura, não uma promessa.
11. **Não confunda os dois eixos de suspensão**: a da empresa (§4.4) derruba todo mundo dela; a da
    pessoa (§4.10) derruba uma só. E reativar a pessoa **não** reativa a empresa.

---

## 7. O que NÃO existe, e não adianta procurar

- **Cadastro público / auto-registro** — desligado. Pessoas nascem por ato do Master ou do Admin.
- **Recuperação de senha por e-mail para o Master** — o caminho é a reemissão pelo próprio Master
  (§4.6); para o primeiro Master, existe um script de instalação no servidor.
- **Filtro ou busca no servidor** — as duas listagens aceitam `limite` e `deslocamento`, e nada
  mais (§4.2, §4.9).
- **Ordenação declarável** — a ordem é fixa: empresa mais antiga primeiro (§4.2); administrador por
  nome (§4.9).
- **Listar os Usuários Empresa** — a listagem da §4.9 alcança **só** o perfil `ADMIN_EMPRESA`. O
  usuário comum da imobiliária é governado pelo Admin Empresa dela, no outro aplicativo.
- **Desfazer uma exclusão definitiva** — não há. As §4.8 e §4.13 apagam, e não existe lixeira,
  reativação nem registro do que foi apagado.
- **Atualização parcial** — não há `PATCH` em rota alguma; as duas correções (§4.7, §4.12) são `PUT`
  com o corpo completo.
- **Qualquer leitura de negócio** — por desenho.

⚠️ **Três itens saíram desta lista em 2026-09-02, porque deixaram de ser verdade**: *excluir
empresa*, *editar nome ou documento de empresa* e *listar usuários de uma empresa pelo Master*. As
três operações existem — §4.8, §4.7 e §4.9. Se você estiver lendo uma cópia antiga deste documento
que ainda as nega, é a cópia que está velha.

---

## 8. Ambiente e publicação

- O app é servido **só** em `syslocadmin.systera.com.br`, com certificado próprio.
- A API é a mesma do Sysloc — o que separa os dois aplicativos é o **domínio e o build**, não a base
  de dados nem o servidor.
- ⚠️ O destino da API é **configuração de build**, e o operador é quem o define. Não fixe endereço
  no código.
- ⚠️ **E o destino é da MESMA origem do painel**, por arranjo de publicação e não por pendência: a
  API não fala CORS (§2). Na prática, o vhost de `syslocadmin.systera.com.br` encaminha `/v1/*` para
  a API, e o servidor de desenvolvimento faz o mesmo por proxy. **Não aponte o app direto para a
  API** — chamada de origem cruzada esbarra na ausência de CORS e, em `/v1/auth/*`, na barreira de
  origem.
- ✅ **O débito `D23 · F1/T8` está FECHADO desde 2026-08-26**, e a origem
  `https://syslocadmin.systera.com.br` é aceita pelo servidor desde **2026-08-27**. A frase da versão
  anterior deste documento — *"chamada direta de origem cruzada não funciona hoje … é o débito
  `D23`"* — **não vale mais**, e nenhum contorno de origem é necessário: o paliativo que reescrevia
  `Origin` no proxy do painel foi removido no mesmo passo. **Não o reintroduza.**
