# Handoff do **Painel Master** para o frontend

> **O que este arquivo é.** O contrato **completo e suficiente** para implementar o frontend do
> Painel Master do SaaS, sem consultar mais nada. Ele é **autossuficiente**: quem o receber não tem
> acesso a este repositório, e tudo o que precisa saber — rotas, corpos, erros, fluxo de sessão,
> regras — está escrito aqui.
>
> **Escopo: SÓ o Master.** O aplicativo do Sysloc (locação) tem handoff próprio, e os dois **não se
> misturam** — nem no build, nem no domínio, nem na sessão.
>
> **Estado do backend: as seis rotas estão TODAS implementadas e verificadas** — publicadas,
> cobertas por testes automatizados e em execução. ⚠️ **Uma pendência do servidor permanece, e ela
> alcança o frontend**: a API ainda não publica CORS nem confia em `Origin` de fora, de modo que o
> painel só funciona servido na **mesma origem** da API até a F7. Está detalhado na §2, e é o débito
> `D23 · F1/T8`.
>
> Gerado em **2026-08-21**, a partir do código em execução, e **conferido linha a linha contra o
> código em 2026-08-21** — a conferência corrigiu a tabela de erros (faltava `CREDENCIAL_INVALIDA`),
> a política de senha (são quatro regras, não duas), as recusas da reemissão de senha (§4.6) e a
> semântica da validade da sessão. As referências `<!-- fonte: … -->` apontam o arquivo e a linha de
> onde cada afirmação saiu.

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

> ### ⚠️ Antes da primeira chamada: hoje a API ainda NÃO aceita este app de outra origem
>
> O servidor **não publica CORS** — não há `@fastify/cors`, `enableCors` nem cabeçalho
> `Access-Control-*` em lugar nenhum de `apps/api/src` (verificado por varredura) —, e a lista de
> origens confiáveis do arcabouço de identidade é só o endereço de escuta local
> (`http://127.0.0.1:<porta>`). Duas consequências, nesta ordem:
>
> 1. o navegador barra a chamada de `https://syslocadmin.systera.com.br` na pré-checagem, por
>    ausência de `Access-Control-Allow-Origin` / `Allow-Credentials`;
> 2. e, ainda que passasse, `/v1/auth/*` recusa o `Origin` que não está na lista.
>
> **É pendência conhecida do backend, com dono e data**: o débito `D23 · F1/T8`, cujo gatilho é a
> publicação atrás do servidor de borda (F7). Enquanto ela não fecha, o app só funciona servido na
> **mesma origem** da API — proxy reverso no próprio domínio do painel, ou proxy do servidor de
> desenvolvimento. `credentials: 'include'` continua obrigatório em qualquer arranjo cuja origem
> difira.
>
> ⚠️ **`SameSite=Lax` aperta mais um grau**: mesmo com CORS liberado, o cookie **não** viaja para
> outro *site*. Painel e API precisam ficar sob o mesmo domínio registrável (`*.systera.com.br`),
> ou o cookie terá de virar `SameSite=None` — o que é mudança **no servidor**, não no frontend.
> <!-- fonte: packages/auth/src/autenticacao.ts:672 · apps/api/src/autenticacao/autenticacao.module.ts:156 -->

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
| fora de `^[0-9]{6}$` | `422 CAMPO_INVALIDO`, com `campo: "code"` → *"o código tem 6 dígitos"* |
| 6 dígitos, mas errado | recusa do arcabouço → *"código inválido"* |
| **10** falhas de verificação | conta trancada por **15 min** |

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

## 4. As seis rotas do Master

Todas exigem sessão de perfil `SYSLOC_MASTER`, sem restrição pendente. Todas respondem
`NAO_AUTENTICADO` (401) sem sessão e `ACESSO_NEGADO` (403) para qualquer outro perfil.

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
  "itens": [ { "id": "uuid", "nome": "...", "documento": "...", "estado": "ATIVA", "criadaEm": "..." } ],
  "total": 137,
  "limite": 50,
  "deslocamento": 0
}
```

`estado` é **`ATIVA`** ou **`SUSPENSA`**, e é o rótulo de situação. `total` é o total geral, para
montar a paginação.

⚠️ **A consulta é FECHADA, como os corpos.** `limite` e `deslocamento` são os **únicos** parâmetros
aceitos: qualquer outro — `?estado=ATIVA`, `?busca=`, um `?_t=` de cache-busting — responde
**`422 CAMPO_INVALIDO`**. **Não existe filtro nem busca no servidor**; ordenação, busca e filtro por
estado são do cliente, sobre a página recebida.

⚠️ **`limite` acima de 200 RECUSA — não trunca.** Truncar em silêncio faria o operador acreditar que
viu tudo.

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

Consequência para a tela: **como não há rota para listar os usuários de uma empresa** (§7), o painel
não tem de onde tirar o `{id}` a não ser da resposta da §4.3. Guarde o `usuarioId` devolvido na
admissão — **ele, não a senha** — para que a reemissão tenha alvo.

<!-- fonte: apps/api/src/master/empresa.controller.ts:198-216 · apps/api/src/master/empresa.service.ts:570-600 -->

---

## 5. Telas sugeridas

O backend não impõe navegação. Estas são as telas que as seis rotas sustentam:

1. **Entrada** — e-mail/senha → segundo fator (com a alternativa do código de recuperação, §3.4) →
   (se preciso) troca de senha → (se preciso) configuração do TOTP. É um **fluxo condicional guiado
   por `GET /v1/sessao`**, não uma tela só.
2. **Empresas** — tabela paginada com nome, documento, estado e data; busca no cliente; ação de
   criar; ações por linha de suspender/reativar.
3. **Nova empresa** — formulário de dois campos, com o erro de documento repetido no campo.
4. **Admitir administrador** — dentro da empresa; termina no diálogo da senha provisória.
5. **Confirmação de suspensão** — diálogo com o nome da empresa digitado ou botão destacado, e o
   resultado mostrando `sessoesEncerradas`.

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
9. **Guarde o `usuarioId` da admissão** — é o único alvo possível da reemissão (§4.6).

---

## 7. O que NÃO existe, e não adianta procurar

- **Cadastro público / auto-registro** — desligado. Pessoas nascem por ato do Master ou do Admin.
- **Recuperação de senha por e-mail para o Master** — o caminho é a reemissão pelo próprio Master
  (§4.6); para o primeiro Master, existe um script de instalação no servidor.
- **Excluir empresa** — não há. O ciclo é suspender/reativar.
- **Editar nome ou documento de empresa** — não há rota.
- **Listar usuários de uma empresa pelo Master** — não há; ele admite administrador e reemite senha
  por id, nada além. ⚠️ **Guarde o `usuarioId` da admissão** (§4.3): sem ele, a reemissão da §4.6
  fica sem alvo.
- **Filtro ou busca no servidor** — a listagem aceita `limite` e `deslocamento`, e nada mais (§4.2).
- **Ordenação declarável** — a ordem é fixa: mais antiga primeiro (§4.2).
- **Qualquer leitura de negócio** — por desenho.

---

## 8. Ambiente e publicação

- O app é servido **só** em `syslocadmin.systera.com.br`, com certificado próprio.
- A API é a mesma do Sysloc — o que separa os dois aplicativos é o **domínio e o build**, não a base
  de dados nem o servidor.
- ⚠️ Enquanto a API não estiver publicada para fora, o app precisa falar com ela por um destino que
  o operador configura. Não fixe endereço no código: leia de configuração de build.
- ⚠️ **E o destino tem de ser da MESMA origem do painel** enquanto o débito `D23 · F1/T8` não fechar
  — o servidor não publica CORS e não confia em `Origin` de fora (§2). Na prática: proxy reverso no
  vhost de `syslocadmin.systera.com.br` encaminhando `/v1/*` para a API, ou proxy do servidor de
  desenvolvimento. **Chamada direta de origem cruzada não funciona hoje**, e isso é do servidor, não
  do app.
