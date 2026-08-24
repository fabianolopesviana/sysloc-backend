# Handoff do **Sysloc** para o frontend

> **O que é este documento.** O contrato completo entre o backend novo (Node/NestJS/PostgreSQL,
> neste servidor) e o aplicativo React da imobiliária, que vive fora deste repositório e será
> implementado por outro agente, noutra máquina. Ele é a **única** fonte que aquele agente precisa:
> não presume acesso a este código, não presume leitura das specs, e não deixa nada para "consultar
> depois".
>
> **Medido contra o código em execução em 2026-08-24**, com a superfície da API **congelada** — a F5
> fechou e nenhuma fatia posterior acrescenta, remove ou altera rota. O que está escrito aqui não
> muda mais por trabalho de backend.
>
> **Idioma e vocabulário.** A API fala **português, camelCase**. A única exceção são as rotas de
> identidade sob `/v1/auth`, que preservam o vocabulário em inglês do arcabouço — e estão nomeadas
> uma a uma na §4.

---

## 0. Como ler este documento

| Se você vai… | Leia, nesta ordem |
|---|---|
| entender **o que mudou de verdade** | §1, §11 |
| escrever o **cliente HTTP** | §2, §3, §6 |
| desenhar a **entrada** (login) | §4 |
| desenhar o **menu e as permissões** | §5, §13 |
| implementar **uma tela** | §7 (a área dela) + §9 (o percurso) |
| implementar **Integrações bancárias** | §7.13 + §8 (inteira) |
| religar uma tela que **já existia** | §10 (o mapa endpoint-a-endpoint) |
| saber o que **não** procurar | §12 |
| entender por que algo **não funciona ainda** | §14 |
| conferir se terminou | §15 |
| **montar mocks sem o backend rodando** | **§20** (as fixtures) |
| **saber que estados de tela são obrigatórios** | **§19** |
| **escrever os testes mínimos da integração** | **§21** + §20 |
| **saber o que ainda é hipótese** | **§22** |

**Convenção de citação.** Onde um fato é medido no código, a linha
`<!-- fonte: caminho → símbolo -->` diz onde. Você não precisa abrir nada; a citação existe para
auditoria e para o dia em que alguém duvidar do documento. ⚠️ **Ela nomeia o SÍMBOLO, nunca a
linha** — número de linha envelhece a cada edição do backend e viraria mentira; um `grep` pelo
símbolo continua achando.

⚠️ **Três avisos que valem para o documento inteiro:**

1. **Classifique erro pelo `codigo`, nunca pela `mensagem`.** O texto é para exibir.
2. **Corpos e consultas são fechados.** Um campo a mais no corpo, ou um parâmetro a mais na
   query string, é `422` — não é ignorado.
3. **O Painel Master não é assunto deste handoff.** Ele existe, está pronto, e é **outro
   aplicativo**, com domínio, build e handoff próprios. Ver §16.

---

## 1. A mudança de fundo: de app de uma empresa para SaaS multi-empresa

**Este é o coração da migração, e nenhuma tela escapa dele.**

O sistema antigo servia **uma** imobiliária. Não havia noção de empresa, não havia usuário de
verdade — o frontend guardava um nome em `localStorage` e todas as escritas chegavam ao servidor com
**a mesma credencial de serviço**, embutida em texto claro no bundle público. O backend **não sabia
quem estava agindo**, e o controle de acesso era inteiramente client-side: uma whitelist de rotas e
uma reconfirmação de senha guardada em `sessionStorage`.

O backend novo é um **SaaS multi-empresa** com três perfis, isolamento imposto pelo banco de dados e
autorização declarada rota a rota. As cinco consequências, em ordem de impacto no frontend:

### 1.1 Toda requisição acontece dentro de **uma** empresa, e o app nunca a escolhe

O identificador da empresa **não é aceito em corpo, em caminho ou em parâmetro de consulta, em rota
alguma do produto**. Ele é derivado da sessão, no servidor, e imposto por *Row-Level Security* no
PostgreSQL: um dado de outra empresa é **inalcançável pelo banco**, não filtrado pela aplicação.

Na prática, para o frontend:

- **Não existe seletor de empresa.** Uma pessoa pertence a uma empresa e pronto.
- **Não mande `empresaId` em lugar nenhum.** Se mandar, o corpo é fechado e a resposta é `422`.
- **`404` e "de outra empresa" são a mesma resposta**, byte a byte, em toda leitura por
  identificador. Não tente distinguir: a indistinguibilidade é deliberada.

### 1.2 Existe usuário de verdade, com sessão de verdade

Sessão por **cookie** `httpOnly`, emitida na entrada, renovada a cada requisição, encerrada no
`sign-out`. O frontend **não lê, não guarda e não envia token**: o navegador cuida disso. Some o
`Authorization: token apiKey:apiSecret` do bundle, e some o risco que o próprio `.env.example` do
projeto antigo já documentava.

### 1.3 Existe autorização de verdade, e ela decide o menu

Um catálogo **fechado** de 17 chaves — 10 áreas de tela e 7 ações sensíveis — governa a superfície.
Cada rota declara o que exige; a sessão carrega o que a pessoa alcança. **O menu é uma função da
sessão** (§5), e não uma lista fixa no código do app.

### 1.4 Pessoas nascem por ato administrativo, com senha provisória

Não há auto-registro. O Master cria a empresa e admite o primeiro Admin; o Admin cria as demais
pessoas da empresa. A senha provisória é devolvida **uma única vez**, no corpo da criação, e nenhuma
consulta posterior a recupera.

### 1.5 O servidor passou a ser o dono das regras que o cliente calculava

Estado de cobrança, mora, metragem, joins, totais de contrato: tudo é decidido e devolvido pelo
servidor, pronto. Os ~36 mapeadores `snake_case → camelCase`, o `mapByName`, o `fetchByIds`, o
`normalizeStatus`, o `contratoStatusFromDocstatus`, o `toInt`/`toDouble`/`isTruthy` — **todos deixam
de existir**. Isso é ganho, não custo: a tela Financeiro fazia de 5 a 9 idas ao servidor por
carregamento; agora faz uma.

---

## 2. Base da API, transporte e sessão

### 2.1 Endereço e prefixo

Todas as rotas do produto vivem sob o prefixo de versão **`/v1`**. Ficam **fora** do prefixo apenas
`/saude`, `/saude/pronto`, `/docs` e `/docs/json`.
<!-- fonte: apps/api/src/main.ts → `ROTAS_FORA_DO_PREFIXO`, `setGlobalPrefix` · apps/api/src/configuracao/ambiente.ts → `PREFIXO_DE_VERSAO` -->

⚠️ **Não fixe o endereço da API no código.** Leia de configuração de build. Enquanto o backend não
estiver publicado atrás do servidor de borda, o destino é decidido pelo operador — ver §14.

### 2.2 Formato

JSON em requisição e resposta, com **três exceções**, todas nomeadas neste documento:

| Exceção | Onde | O que trafega |
|---|---|---|
| PDF do contrato | `GET /v1/contratos/:codigo/documento` | `application/pdf` + `Content-Disposition` |
| PDF do boleto e do carnê | `GET /v1/cobrancas/:codigo/boleto`, `GET /v1/contratos/:codigo/carne` | idem |
| Corpo sem conteúdo | `POST /v1/notificacoes-bancarias` | `204`, sem corpo — **não é rota de tela** |

**Teto de corpo: 64 KB.** Vale para todo `POST`/`PUT`. É o que dimensiona o envio do certificado
digital (§7.13), que é o maior corpo que o produto aceita.
<!-- fonte: apps/api/src/main.ts → `MAIOR_CORPO_ACEITO` -->

### 2.3 Sessão

Cookie `httpOnly` + `Secure` + `SameSite=Lax`. **Validade de 8 horas de inatividade**, e não 8 horas
desde a entrada: o servidor renova a sessão a cada requisição. Quem usa o app sem parar não cai; quem
para 8 horas cai.
<!-- fonte: packages/auth/src/autenticacao.ts → `DURACAO_DA_SESSAO_EM_SEGUNDOS`, `RENOVACAO_DA_SESSAO_EM_SEGUNDOS` -->

O cliente HTTP precisa de **`credentials: 'include'`** em toda chamada. Não há nada mais a fazer: não
se lê o cookie, não se guarda, não se renova à mão.

### 2.4 Documento OpenAPI

A API publica `/docs` (interface) e `/docs/json` (documento). Ele é **gerado do código** e é a fonte
técnica que confirma este handoff. ⚠️ **As rotas de `/v1/auth` não constam dele** — elas são
publicadas por um encaminhador curinga e estão descritas na §4 deste documento, que é a fonte delas.
<!-- fonte: apps/api/src/autenticacao/autenticacao.controller.ts → `@ApiExcludeController` -->

---

## 3. Envelope de erro — idêntico em toda recusa

```json
{
  "codigo": "CAMPO_INVALIDO",
  "mensagem": "requisição inválida",
  "campo": "documentoPrincipal",
  "detalhes": { "conflito": "RETIRADO_DE_CIRCULACAO" }
}
```

`codigo` e `mensagem` são **sempre** presentes. `campo` e `detalhes` são opcionais — quando ausentes,
a chave **não existe** no JSON (nunca `null`, nunca `undefined`).
<!-- fonte: packages/shared/src/erros.ts → `CorpoErro`, `ErroDeAplicacao.paraCorpo` -->

### 3.1 Os onze códigos

| `codigo` | HTTP | Significa | O que a tela faz |
|---|---|---|---|
| `CAMPO_INVALIDO` | **422** (produto) / **400** (identidade) | corpo ou consulta recusados; `campo` diz qual | marca o campo no formulário |
| `RECURSO_NAO_ENCONTRADO` | 404 | não existe — **ou não é desta empresa** | "não encontrado", nunca "sem permissão" |
| `ERRO_INTERNO` | 500 | falha do servidor | erro genérico + botão de tentar de novo |
| `SERVICO_INDISPONIVEL` | 503 | dependência fora do ar (banco, fila, provedor bancário) | "tente em instantes"; **nada foi alterado** |
| `CREDENCIAL_INVALIDA` | 401 | a **entrada** não resultou em acesso | "não foi possível entrar" |
| `NAO_AUTENTICADO` | 401 | sem sessão, ou sessão expirada | manda para a tela de entrada |
| `ACESSO_NEGADO` | 403 | autenticado, sem alcance — **ou sessão restrita** | ver §4.3 e §5.5 |
| `REQUISICAO_RECUSADA` | **o status de origem** (na prática **429**) | recusa que este vocabulário não nomeia | ver §3.3 |
| `MATERIAL_EM_FORMATO_NAO_SUPORTADO` | 422 | o arquivo enviado não é um certificado legível | ver §7.13 |
| `SENHA_DO_MATERIAL_NAO_ABRE` | 422 | a senha não abre o certificado | ver §7.13 |
| `CERTIFICADO_COM_VALIDADE_ENCERRADA` | 422 | o certificado é legível e já venceu | ver §7.13 |

<!-- fonte: packages/shared/src/erros.ts → `CodigoErro`, `STATUS_POR_CODIGO` · apps/api/src/comum/filtro-excecao.ts → `MENSAGEM_POR_CODIGO` -->

### 3.2 As mensagens são canônicas

`mensagem` é **sempre** o texto do `codigo`, nunca o texto de quem recusou:

```
requisição inválida · recurso não encontrado · erro interno no processamento da requisição
serviço temporariamente indisponível · credencial inválida · sessão inválida ou expirada
acesso negado para esta sessão · requisição recusada
o arquivo enviado não é um certificado que o produto consiga ler — confira o arquivo escolhido
a senha apresentada não abre o certificado enviado — confira a senha
a validade do certificado apresentado já terminou
```

A **única** exceção é o `403` da sessão restrita, que traz mensagem própria — §4.3.
<!-- fonte: apps/api/src/comum/filtro-excecao.ts → `MENSAGEM_POR_CODIGO` -->

Isso significa que a mensagem **não serve para explicar ao usuário o que ele errou** num formulário.
Quem explica é o par (`campo`, `detalhes`), e este documento diz, rota a rota, o que vem em cada um.

### 3.3 `CREDENCIAL_INVALIDA` é um código para quatro causas

Senha incorreta, conta trancada por tentativas, pessoa desativada e empresa suspensa produzem
resposta **idêntica**: mesmo status, mesmo código, mesma mensagem, mesmos campos. Distinguir
confirmaria ao atacante que a conta existe.

⚠️ **Não prometa na tela um diagnóstico que a API não dá.** Nada de "senha errada" ou "tente em 15
minutos". A frase honesta é *"não foi possível entrar"*.
<!-- fonte: packages/shared/src/erros.ts → `CodigoErro.CREDENCIAL_INVALIDA` -->

### 3.4 O `429` vem sem cabeçalho algum

Nada de `Retry-After`. É só o par (status, corpo). O limitador escreve o cabeçalho na instância do
arcabouço e ele morre na travessia até o cliente. Se a tela quiser sugerir uma espera, o número tem
de ser do frontend.
<!-- fonte: apps/api/src/autenticacao/senha.controller.ts → `@ApiTooManyRequestsResponse` e a DECISÃO FECHADA — T9/Gate 2 acima dele -->

### 3.5 O que **não** existe mais

Acabou o `{data}` / `{message}` do Frappe. Acabou o `_server_messages` (JSON dentro de JSON dentro
de string). Acabou o `exc_type === 'UniqueValidationError'`. Acabou a classificação de erro por
**prefixo do texto da mensagem** e a extração de campo por regex sobre `"O campo 'X'"` — que era como
a integração Sicoob antiga funcionava. **Delete o parser inteiro.**

---

## 4. Entrada e as duas restrições de sessão

**Leia esta seção inteira antes de desenhar a tela de entrada.** A entrada é um **fluxo
condicional**, não uma tela só.

### 4.1 As quatro rotas de identidade

São as **únicas** rotas de `/v1/auth` que o produto declara. Elas falam inglês porque preservam o
vocabulário do arcabouço, e o corpo delas **não** segue o camelCase do resto da API.

| Ato | Rota | Corpo |
|---|---|---|
| Entrar | `POST /v1/auth/sign-in/email` | `{ "email": "...", "password": "..." }` |
| Verificar / ativar 2º fator | `POST /v1/auth/two-factor/verify-totp` | `{ "code": "123456" }` |
| Preparar 2º fator | `POST /v1/auth/two-factor/enable` | `{ "password": "<senha atual>" }` |
| Sair | `POST /v1/auth/sign-out` | — |

<!-- fonte: apps/api/test/autenticacao.e2e.spec.ts → `SUPERFICIE_DECLARADA` -->

⚠️ **O prefixo publica mais rotas do que estas quatro.** O encaminhador é um curinga, e sob ele
respondem ~35 caminhos do arcabouço (`update-user`, `list-sessions`, `revoke-session`,
`request-password-reset`, `two-factor/disable`, …). **Elas são toleradas, não oferecidas**: parte
está inerte por configuração, e o resto opera sobre a identidade da própria pessoa. **O app do Sysloc
não deve chamar nenhuma delas**, com duas exceções que este documento autoriza explicitamente:
`POST /v1/auth/two-factor/verify-backup-code` (código de recuperação, §4.4) e
`GET /v1/auth/get-session` (sonda de sessão do arcabouço — mas prefira `GET /v1/sessao`).
<!-- fonte: apps/api/test/autenticacao.e2e.spec.ts → `SUPERFICIE_TOLERADA` -->

⚠️ **`POST /v1/auth/change-password` responde `404`.** Ela foi **despublicada** de propósito: gravava
a credencial antes de conferir a política de admissão. Quem troca senha neste produto é
`POST /v1/sessao/senha` (§7.1).
<!-- fonte: apps/api/src/autenticacao/autenticacao.controller.ts → `CAMINHOS_NAO_PUBLICADOS` -->

### 4.2 O fluxo de entrada, passo a passo

```
1. POST /v1/auth/sign-in/email   { email, password }
      ├── 200 { "twoFactorRedirect": true, "twoFactorMethods": ["totp"] }
      │      → a sessão NÃO está completa; vá para o passo 2
      ├── 200 (sem twoFactorRedirect) → sessão emitida; vá para o passo 3
      ├── 401 CREDENCIAL_INVALIDA → "não foi possível entrar"
      └── 429 REQUISICAO_RECUSADA → limite de taxa

2. POST /v1/auth/two-factor/verify-totp   { code }
      → emite credencial de sessão NOVA e apaga a anterior

3. GET /v1/sessao   ← SEMPRE, imediatamente após entrar
      → decide o roteamento pelas bandeiras (§4.3) e monta o menu (§5)
```

**Os limites que a tela vai encontrar:**

| Limite | Valor | Resposta |
|---|---|---|
| Falhas consecutivas por conta | **5** → tranca **15 min** | `401 CREDENCIAL_INVALIDA` (a tranca **não** é distinguível) |
| Falhas de verificação do 2º fator | **10** → tranca **15 min** | recusa do arcabouço |
| Taxa em `/v1/auth/sign-in/email` | **30 / minuto** por origem | `429 REQUISICAO_RECUSADA` |
| Taxa nos demais `/v1/auth/*` | **120 / minuto** | `429 REQUISICAO_RECUSADA` |

<!-- fonte: packages/auth/src/bloqueio.ts → `LIMITE_DE_FALHAS_CONSECUTIVAS`, `DURACAO_DO_BLOQUEIO_EM_MINUTOS` · packages/auth/src/autenticacao.ts → `JANELA_DO_LIMITADOR_EM_SEGUNDOS`, `TETO_DE_ENTRADAS_POR_JANELA`, `TETO_GERAL_POR_JANELA`, bloco `rateLimit` -->

⚠️ **`verify-totp` emite cookie novo e mata o anterior.** Com `credentials: 'include'` isso é
transparente. Qualquer código que guarde o valor do cookie à mão passa a guardar um valor morto.

⚠️ **Requisições a `/v1/auth/*` que levem cookie exigem o cabeçalho `Origin`**, conferido pelo
servidor. Um navegador o envia sozinho; a nota existe para quem testar por linha de comando.

### 4.3 As duas restrições — e como a tela as detecta

`GET /v1/sessao` devolve duas bandeiras booleanas. Enquanto **qualquer uma** for `true`, a sessão
está **restrita**:

| Bandeira | Enquanto `true` | Como resolver |
|---|---|---|
| `senhaProvisoria` | toda rota de negócio responde `403 ACESSO_NEGADO` | `POST /v1/sessao/senha` (§7.1) |
| `segundoFatorPendente` | idem | configurar o TOTP (§4.4) |

**A sessão restrita alcança exatamente três coisas, e nada mais:**

- `GET /v1/sessao`
- `POST /v1/sessao/senha`
- tudo sob `/v1/auth/*` (é onde a configuração do TOTP mora)

<!-- fonte: apps/api/src/autenticacao/sessao-restrita.ts → `ROTAS_DA_SESSAO_RESTRITA`, `sessaoRestritaPermite` -->

**Como detectar.** O `403` da sessão restrita **não traz `campo` nem `detalhes`**; o único sinal
textual é a `mensagem`, e ela é uma destas três, literalmente:

```
acesso negado: esta sessão está restrita até a troca da senha provisória
acesso negado: esta sessão está restrita até a configuração do segundo fator
acesso negado: esta sessão está restrita até a troca da senha provisória e a configuração do segundo fator
```

⚠️ **Não roteie por esse texto.** O caminho correto: ao receber `403`, **refaça `GET /v1/sessao`** —
que a sessão restrita sempre alcança — e decida pelas **duas bandeiras**. Exiba a `mensagem` ao
usuário se quiser; roteie pelas bandeiras.
<!-- fonte: apps/api/src/autenticacao/sessao-restrita.ts → `CUMPRIMENTO_POR_RESTRICAO`, `ABERTURA_DA_RECUSA` -->

### 4.4 Segundo fator

**Obrigatório para o perfil `SYSLOC_MASTER`. Opcional para `ADMIN_EMPRESA` e `USUARIO_EMPRESA`** —
que é o que interessa a este app. Ou seja: no Sysloc, `segundoFatorPendente` só é `true` se a pessoa
tiver começado a configurar o TOTP e não tiver concluído.

Configuração, quando a pessoa quiser (ou quando a política da empresa exigir por processo):

```
POST /v1/auth/two-factor/enable      { "password": "<senha atual>" }
   → { totpURI, backupCodes }
POST /v1/auth/two-factor/verify-totp { "code": "123456" }
   → segundoFatorPendente vira false
```

- `totpURI` gera o QR Code; o emissor é `"Sysloc"`.
- `backupCodes`: **mostre uma vez**, com aviso de guardar fora do sistema.
- O código é de **exatamente 6 dígitos**, e a forma é conferida antes da verificação: fora de
  `^[0-9]{6}$` responde `422 CAMPO_INVALIDO` com `campo: "code"`; 6 dígitos errados é recusa do
  arcabouço.
- Código de recuperação: `POST /v1/auth/two-factor/verify-backup-code` `{ "code": "..." }` — a tela
  de entrada precisa oferecer essa alternativa.

<!-- fonte: packages/auth/src/autenticacao.ts → `FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA`, `TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS`, `CAMINHO_DA_VERIFICACAO_DO_SEGUNDO_FATOR`, plugin `twoFactor` -->

### 4.5 Sair

```
POST /v1/auth/sign-out
```

A sessão é apagada **no servidor**, não só no cliente: o mesmo cookie deixa de autenticar na
requisição seguinte.

---

## 5. Autorização — o catálogo, os perfis, e como o menu nasce

**Esta seção decide o menu. Implemente-a exatamente como está escrito.**

### 5.1 O catálogo é fechado: 10 áreas + 7 ações = 17 chaves

**As 10 áreas de tela** (`telas` na sessão):

| Chave | Área |
|---|---|
| `TELA:resumo` | Resumo / Dashboard |
| `TELA:imoveis` | Imóveis, conjuntos e cômodos |
| `TELA:contratos` | Contratos |
| `TELA:cadastros` | Locadores, locatários e fiadores |
| `TELA:financeiro` | Cobranças, boletos e conferência bancária |
| `TELA:automacao_de_cobranca` | Régua de cobrança e rotinas |
| `TELA:integracoes_bancarias` | Certificado, identidade e webhook do banco |
| `TELA:multa_e_juros` | Política de multa e juros |
| `TELA:relatorios` | Relatórios |
| `TELA:usuarios` | Pessoas da empresa e permissões |

**As 7 ações sensíveis** (`acoes` na sessão), cada uma dentro de **uma** área:

| Chave | Área que a comporta | Governa |
|---|---|---|
| `ACAO:emitir_boleto` | `TELA:financeiro` | emitir/reemitir boleto e abrir emissão em lote |
| `ACAO:solicitar_baixa_de_boleto` | `TELA:financeiro` | revogar boleto |
| `ACAO:ativar_contrato` | `TELA:contratos` | ativar contrato |
| `ACAO:cancelar_contrato` | `TELA:contratos` | cancelar contrato |
| `ACAO:excluir_cadastro` | `TELA:cadastros` | retirar/recircular cadastro, imóvel, conjunto e contrato |
| `ACAO:configurar_integracao` | `TELA:integracoes_bancarias` | certificado, identidade e webhook |
| `ACAO:enviar_cobranca_manual` | `TELA:automacao_de_cobranca` | disparo manual de aviso |

<!-- fonte: packages/auth/src/catalogo-de-permissoes.ts → `CHAVES_DE_TELA`, `MAPA_ACAO_TELA` -->

⚠️ **Uma ação só vale para quem alcança a área dela.** O servidor exige a **conjunção inteira** —
área **e** ação — nas rotas sensíveis, e a recusa nomeia a **primeira** exigência ausente, na ordem
declarada (a área vem antes). Portanto: quem tem `ACAO:emitir_boleto` sem `TELA:financeiro` **não
emite nada**, e a tela nem deve oferecer.

⚠️ **`ACAO:excluir_cadastro` mora em `TELA:cadastros` e governa retirada em quatro áreas** — imóveis,
conjuntos, cadastros de pessoa **e contratos**. É o único caso em que a ação e a área da tela em que
o botão aparece **não coincidem**. Nessas rotas, a exigência é a conjunção `área da tela` +
`ACAO:excluir_cadastro`: retirar um imóvel exige `TELA:imoveis` **e** `ACAO:excluir_cadastro`.

### 5.2 Os três perfis

| Perfil | Padrão de permissões | Onde opera |
|---|---|---|
| `ADMIN_EMPRESA` | **as 17 chaves** | o app do Sysloc, na empresa dele |
| `USUARIO_EMPRESA` | **só `TELA:resumo`** | o app do Sysloc, na empresa dele |
| `SYSLOC_MASTER` | **nenhuma chave** (`telas: []`, `acoes: []`) | **outro aplicativo** — ver §16 |

<!-- fonte: packages/auth/src/matriz-de-perfil.ts → `MATRIZ_POR_PERFIL` -->

⚠️ **`USUARIO_EMPRESA` nasce vendo apenas o Resumo.** É o piso mínimo, deliberado: a pessoa entra, vê
a tela de chegada, e tudo o mais é concedido pelo Admin, área por área. Uma tela de "primeiro acesso"
que assuma alcance largo vai mostrar menu vazio para todo usuário novo — o correto é o menu refletir
a sessão, e o Resumo ser uma página que **funciona sozinha**.

⚠️ **Se um `SYSLOC_MASTER` entrar neste app, ele verá menu vazio, e isso é correto.** Ele não opera
por chave de tela. O app do Sysloc pode detectar `perfil === "SYSLOC_MASTER"` e exibir uma página
dizendo que o painel dele é outro endereço — mas **não** deve tentar montar menu a partir de
`telas`/`acoes` vazios nem tratá-lo como erro.

### 5.3 A sessão gorda

`GET /v1/sessao` devolve **onze campos, todos obrigatórios** (os dois anuláveis vêm `null`, nunca
ausentes):

```json
{
  "usuarioId": "3f1c…",
  "nome": "Maria Souza",
  "email": "maria@imobiliaria.com.br",
  "perfil": "ADMIN_EMPRESA",
  "empresaId": "9a2b…",
  "empresaNome": "Imobiliária Exemplo",
  "senhaProvisoria": false,
  "segundoFatorPendente": false,
  "telas": ["TELA:resumo", "TELA:imoveis", "TELA:contratos", "…"],
  "acoes": ["ACAO:emitir_boleto", "…"],
  "versaoPermissoes": 7
}
```

<!-- fonte: apps/api/src/autenticacao/sessao.controller.ts → `ESQUEMA_DA_SESSAO` -->

`empresaId` e `empresaNome` são `null` **apenas** para o `SYSLOC_MASTER`. Para qualquer perfil deste
app eles vêm preenchidos, e `empresaNome` é o que a barra superior exibe.

### 5.4 `versaoPermissoes` — o mecanismo que substitui o "sair e entrar de novo"

É um inteiro que **muda toda vez que alguém ajusta as permissões ou o perfil da pessoa**. O servidor
compara a versão gravada na sessão com a versão corrente da pessoa **a cada requisição**; se
divergirem, ele recalcula o efetivo e a **requisição seguinte já reflete o ajuste — sem encerrar a
sessão**.
<!-- fonte: apps/api/src/autenticacao/contexto.guard.ts → `efetivoCorrente`, `recalcularEfetivo` -->

**O que o frontend faz com isso:**

1. Guarde `versaoPermissoes` junto com o menu, em memória.
2. Refaça `GET /v1/sessao` **sempre** que receber um `403 ACESSO_NEGADO` inesperado.
3. Se a versão voltar diferente, **remonte o menu e as permissões da tela** — o alcance mudou
   enquanto a pessoa estava logada.
4. Opcionalmente, refaça `GET /v1/sessao` ao voltar de segundo plano ou em intervalo longo.

**O que o frontend NÃO faz:** não força logout ao ver versão nova; não usa a versão para invalidar
cache de dados de negócio (ela é só de permissão); não a envia em cabeçalho nenhum.

### 5.5 Os dois `403` são diferentes, e a tela reage diferente

| `403` | Como reconhecer | O que a tela faz |
|---|---|---|
| **Sem alcance** | `detalhes.exigido` presente, nomeando a chave faltante | não deveria acontecer — o menu não devia oferecer. Registre; mostre "sem permissão"; refaça `GET /v1/sessao` |
| **Sessão restrita** | **sem** `campo` e **sem** `detalhes`; mensagem própria | roteie para troca de senha / configuração de 2º fator (§4.3) |

<!-- fonte: apps/api/src/autenticacao/contexto.guard.ts → `admitir`, `decidirAcesso` -->

O corpo do primeiro:

```json
{
  "codigo": "ACESSO_NEGADO",
  "mensagem": "acesso negado para esta sessão",
  "detalhes": { "exigido": "TELA:financeiro" }
}
```

⚠️ `detalhes.exigido` nomeia a **primeira** chave ausente, e a área vem antes da ação. Quem já tem a
área e não tem a ação ouve o nome da **ação**; quem não tem nem a área ouve o nome da **área**.


---

## 6. Convenções que valem em toda a superfície

Estas onze regras valem para **todas** as rotas do produto. Elas não se repetem em cada endpoint da
§7 — leia-as uma vez e assuma-as em todo lugar.

### 6.1 Corpo de entrada é **fechado e completo**

- **Fechado**: chave desconhecida é `422 CAMPO_INVALIDO`, com `campo` nomeando a chave. Nunca é
  ignorada em silêncio.
- **Completo**: **não existe atualização parcial**. Todo `PUT` (e todo `POST` de configuração) exige
  o corpo inteiro. Campo ausente é recusa por campo obrigatório — nunca "preserve o valor atual".

⚠️ Isso mata o `putDoctype(doctype, name, { umaChaveSó })` do app antigo. Para alterar um campo,
carregue o recurso, mude o campo, mande o objeto inteiro.

### 6.2 Consulta (`query string`) também é fechada

`limite=50&deslocamento=0` é aceito; `limite=50&ordenar=nome` é `422`, com `campo: "ordenar"`.
Não existe `fields=[…]`, não existe `filters=[[…]]`, não existe `order_by`, não existe
`limit_page_length`/`limit_start`. **A query DSL do Frappe acabou inteira.**

### 6.3 Paginação: `limite` e `deslocamento`

| Parâmetro | Padrão | Teto |
|---|---|---|
| `limite` | **50** | **200** |
| `deslocamento` | **0** | — |

Pedido acima do teto **recusa com `422`** — não trunca em silêncio. A resposta é sempre o envelope:

```json
{ "itens": [ … ], "total": 137, "limite": 50, "deslocamento": 0 }
```

`total` é o total **da empresa sob o recorte pedido**, não o tamanho da página. É ele que dimensiona
o paginador.
<!-- fonte: packages/contracts/src/comum.ts → `MAIOR_PAGINA`, `PAGINA_PADRAO`, `esquemaDaJanela`, `envelopeDeLista` -->

**Os tetos são os mesmos em toda listagem**, inclusive na de pessoas da empresa. O que **não** usa
este envelope são as leituras que devolvem objeto único — política de mora, política de aviso,
estado das rotinas, certificado, identidade e entrega da notícia —, e as duas listas sem janela: os
`itens` do lote de emissão (§7.12) e os do histórico bancário (§7.9).

### 6.4 Corpo vazio é `{}` — e é **fechado**

As rotas de ato sem parâmetro (`ativacao`, `cancelamento`, `retirada`, `recirculacao`,
`verificacao`, `conferencias`, `entrega-da-noticia/ativacao`, `confirmacao-de-email`,
`avisos`) aceitam **corpo vazio ou ausente**. Qualquer chave dentro dele é `422`.
Mande `{}` ou nada; nunca invente campo.

### 6.5 Datas e instantes

| Tipo | Formato | Exemplo | Onde |
|---|---|---|---|
| Data | `YYYY-MM-DD` | `"2026-03-15"` | `dataInicioLocacao`, `dataVencimento`, `competencia`, `pagoEm`, `dataDoCredito` |
| Instante | ISO 8601 UTC | `"2026-03-15T14:22:03.117Z"` | `retiradoEm`, `criadoEm`, `verificadaEm`, `validoAte`, `canceladoEm` |
| Hora do dia | `HH:MM` (24 h) | `"08:30"` | `janelaInicio`, `janelaFim` |

⚠️ **Nunca construa data de negócio com o relógio do navegador.** O que decide vencimento, atraso e
encerramento é a **data corrente da operação**, avaliada no banco, no fuso da operação. Um cliente em
outro fuso que calcule "está vencida" localmente vai discordar do servidor por até um dia. **Exiba o
que o servidor mandou.**
<!-- fonte: packages/db/src/encerramento-de-contratos.ts → seção "O RELÓGIO É O DO BANCO" (ADR-0026) -->

### 6.6 Dinheiro

Sempre `number` com **duas casas decimais**, nunca string, nunca centavos inteiros. O teto é
`9.999.999.999.999,99`. A escala é `0.01`: um valor com três decimais é `422`.

### 6.7 Identificadores — três formas, e elas não se misturam

| Forma | Onde | Exemplo |
|---|---|---|
| **Código legível** | contrato e cobrança | `CTR-2026-00001`, `COB-2026-0000001` |
| **UUID** | todas as demais entidades | `9a2b0f1e-…` |
| **UUID no caminho** | rotas por `:id` | idem |

**As larguras são exatas e diferentes:**

- Contrato: `CTR-` + **4 dígitos de ano** + `-` + **5 dígitos** de sequencial.
- Cobrança: `COB-` + **4 dígitos de ano** + `-` + **7 dígitos** de sequencial.

<!-- fonte: packages/contracts/src/contrato.ts → `LARGURA_DO_SEQUENCIAL_DE_CONTRATO` · packages/contracts/src/cobranca.ts → `LARGURA_DO_SEQUENCIAL_DE_COBRANCA` -->

⚠️ **Cinco dígitos no contrato, sete na cobrança.** Dimensione campo, rótulo e busca por isso. O
código é aceito no caminho em **qualquer caixa** (é normalizado para maiúsculas antes de casar), e
código malformado é `422` **sem tocar o banco**.

⚠️ **UUID é normalizado para minúsculas.** Você pode mandar em qualquer caixa; a resposta sempre vem
em minúsculas. Não compare identificadores sem normalizar.

⚠️ **O `name` do Frappe se partiu em dois, e o acoplamento nº 1 do levantamento mora aqui.** No
sistema antigo, `name` era **ao mesmo tempo** a chave e o **rótulo exibido** — título de contrato,
label de select, campo "Identificador". Agora:

| Entidade | Chave | O que a tela EXIBE |
|---|---|---|
| Contrato | `codigo` (`CTR-2026-00001`) | **o próprio `codigo`** — segue servindo de rótulo |
| Cobrança | `codigo` (`COB-2026-0000001`) | **o próprio `codigo`** |
| Imóvel | `id` (UUID) | **`nomeImovel`** (e `identificadorMunicipal` como identificação externa) |
| Conjunto | `id` (UUID) | **`nome`** |
| Locador / Locatário / Fiador | `id` (UUID) | **`nome`** (e `documentoPrincipal` como identificação) |
| Cômodo | `id` (UUID) | **`nomeComodo`** |
| Pessoa da empresa | `usuarioId` (UUID) | **`nome`** |

**Nunca exiba um UUID ao usuário**, e nunca o use como label de `<option>`. Onde o app antigo
mostrava `name`, ou existe um código legível (contrato, cobrança) ou existe um campo de nome — e é
ele que vai para a tela.

⚠️ **Os códigos nunca são reusados.** Cancelar uma cobrança não libera o código dela. Uma cobrança
substituta recebe **código novo**, e **não há vínculo publicado** entre as duas — se a tela quiser
mostrar "substitui a COB-…", esse vínculo é do frontend.

### 6.8 Circulação: nada é apagado

Cinco entidades — conjunto, imóvel, locador, locatário, fiador e contrato — têm **retirada de
circulação** em vez de exclusão:

- `retiradoEm: null` → em circulação. Preenchido → retirado.
- Listagens devolvem **só os em circulação**; `?incluirRetirados=true` alcança os dois. ⚠️ O
  parâmetro aceita **exatamente** as cadeias `true` e `false` — `1`, `sim` ou vazio são `422`.
- A leitura por identificador **sempre alcança o retirado** (`200` com `retiradoEm` preenchido) —
  sem isso a recirculação seria inalcançável pela interface.
- Retirar é **idempotente**: repetir mantém a **mesma** marca e responde `200`.
- **A unicidade alcança os retirados**: recadastrar um documento ou identificador municipal de um
  cadastro retirado é `422` com `detalhes.conflito: "RETIRADO_DE_CIRCULACAO"` — e a saída é
  **recircular**, não criar outro.

<!-- fonte: apps/api/src/cadastros/superficie-de-cadastro.ts → `DESCRICOES` (ADR-0014) -->

**A exceção é o cômodo**, que é removido de fato: ele é detalhe de composição e nada o referencia.

⚠️ **Retirada não é cancelamento, e as duas coexistem no contrato.** Retirar um contrato **não muda o
estado dele e não libera o imóvel**: um contrato `ATIVO` retirado continua vigente. Quem libera o
imóvel é o **cancelamento**. Um rascunho abandonado se **retira**; um contrato que vale se **cancela**.

### 6.9 Atos de estado não são idempotentes, e isso é decisão

`ativacao`, `cancelamento` (de contrato e de cobrança) e `pagamento` **recusam a repetição** com
`422`, `campo: "status"` (contrato) ou `campo: "codigo"` (cobrança) e:

```json
{ "detalhes": { "estadoAtual": "CANCELADO", "transicaoPedida": "CANCELAMENTO" } }
```

A razão: um segundo pedido significa que quem o fez **não sabia o estado**. A tela deve reler o
recurso e mostrar o estado real, não repetir a chamada.

**São idempotentes**, ao contrário: retirada, recirculação, definição de política (mora e aviso),
disparo de conferência bancária e ativação da entrega da notícia.

### 6.10 A resposta traz o recurso **inteiro**, já derivado

Nenhuma rota devolve `{ "ok": true }` sem contexto. Toda escrita devolve o objeto como ele ficou,
com os campos derivados prontos — inclusive os que o app antigo calculava. Não faça `GET` depois de
`POST`/`PUT` para "atualizar a tela".

**Duas exceções úteis:** o cômodo devolve o **imóvel inteiro** (com `metragemTotal` recalculada), e a
ativação de contrato devolve o contrato **mais** `efeitos.cobrancasGeradas`.

### 6.11 Efeitos externos que não cabem na requisição saem por fila

Envio de e-mail, emissão em lote e conferência bancária **não** acontecem dentro da requisição. A
resposta afirma **só o que já aconteceu** — e é por isso que o reenvio de confirmação responde `202`,
e não `200`. Não prometa na tela um desfecho que a resposta não carrega.

---

## 7. Catálogo de endpoints

**A superfície publicada tem 106 rotas / 91 manipuladores**, das quais **81 manipuladores** são as
rotas de tela deste app, mais as 4 rotas de identidade da §4. O resto é: 6 do Painel Master (outro
app, §16), 1 do webhook do banco (§7.15), 2 de saúde e 9 do documento OpenAPI.
<!-- fonte: apps/api/test/cobertura-de-autorizacao.e2e.spec.ts → `ROTAS_PUBLICADAS_EM_PRODUCAO`, `MANIPULADORES_EXAMINADOS_EM_PRODUCAO`, `PARES_PUBLICOS_DA_SUPERFICIE` -->

**Convenção desta seção.** Cada rota traz: método, caminho, o que exige, o corpo, a resposta e as
recusas **específicas dela**. As recusas gerais — `401` sem sessão, `403` sem alcance, `422` por
corpo/consulta malformados, `404` por identificador de outra empresa — valem em **todas** e não se
repetem.

### 7.1 Sessão — 2 rotas

#### `GET /v1/sessao`
**Exige:** sessão válida. **Não exige chave alguma** (é a rota que a pessoa sem nenhuma permissão usa
para descobrir por quê). Alcançável com **sessão restrita**.
**Resposta `200`:** o objeto de onze campos da §5.3.

#### `POST /v1/sessao/senha`
**Exige:** sessão válida. Alcançável com **sessão restrita** — é o caminho de saída dela.
**Corpo:** `{ "senhaAtual": "…", "senhaNova": "…" }` (fechado; os dois obrigatórios).
**Resposta `200`:** `{ "trocada": true }` — e nada além.

Concluída a troca, `senhaProvisoria` cai e **a mesma sessão** passa a alcançar tudo, **sem novo
login**. As **outras** sessões da pessoa são encerradas; a desta requisição permanece.

**A política de força tem QUATRO regras**, e a recusa devolve **todas** as violadas de uma vez, em
`detalhes.motivos`, nesta ordem fixa:

| Motivo | Regra |
|---|---|
| `COMPRIMENTO_MINIMO` | menos de **10** caracteres |
| `CONTEM_DADO_PESSOAL` | contém o nome, o e-mail, ou pedaço deles com **3+** caracteres |
| `SEQUENCIA_CONSECUTIVA` | **4** caracteres consecutivos (`abcd`, `1234`) |
| `REPETICAO` | **4** caracteres repetidos (`aaaa`) |

```json
{ "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida",
  "campo": "senha", "detalhes": { "motivos": ["COMPRIMENTO_MINIMO", "SEQUENCIA_CONSECUTIVA"] } }
```

Como o servidor devolve todos os motivos juntos, a tela pode marcar as quatro regras de uma vez em
vez de revelá-las uma por vez.

| Situação | Resposta |
|---|---|
| `senhaAtual` incorreta | `422 CAMPO_INVALIDO` — **não** é `401` |
| sem sessão, ou pessoa que a admissão não admite mais | `401 NAO_AUTENTICADO` |
| janela de tentativas esgotada (**10 por minuto**) | `429 REQUISICAO_RECUSADA`, sem cabeçalho |

⚠️ **Toda recusa acontece antes de qualquer escrita**: senha fraca, senha atual errada, pessoa
desativada ou empresa suspensa deixam a credencial intacta e as sessões preservadas.
<!-- fonte: apps/api/src/autenticacao/senha.controller.ts → `SenhaController.trocar` · packages/auth/src/senha.ts → `COMPRIMENTO_MINIMO_DE_SENHA` e os quatro motivos -->

### 7.2 Pessoas da empresa — 7 rotas · `TELA:usuarios`

Todas exigem **`TELA:usuarios`**, que no padrão só o `ADMIN_EMPRESA` tem.

⚠️ **Regra que atravessa cinco destas rotas: o alvo não pode ser quem age.** Ajustar as próprias
permissões, trocar o próprio perfil, autodesativar-se, autorreativar-se ou reemitir a própria senha
responde `422 CAMPO_INVALIDO` com `detalhes.motivo: "ALVO_E_QUEM_AGE"`. A tela deve **esconder** essas
ações na linha da própria pessoa.

#### `POST /v1/usuarios`
**Corpo:** `{ "nome": "…", "email": "…", "perfil": "ADMIN_EMPRESA" | "USUARIO_EMPRESA" }`
**Resposta `201`:** `{ usuarioId, email, perfil, senhaProvisoria }`

⚠️ **A senha provisória vem no corpo, uma única vez.** Nenhuma consulta a recupera. Exiba, ofereça
copiar, **não persista** no cliente. A pessoa nasce na empresa **da sessão** — a empresa nunca é
aceita no corpo. Só os dois perfis administráveis são aceitos; `SYSLOC_MASTER` é `422`.

#### `GET /v1/usuarios?limite=&deslocamento=`
**Resposta `200`:** `{ itens: [{ usuarioId, nome, email, perfil, ativo }], total, limite, deslocamento }`

Devolve **todas** as pessoas da empresa, de qualquer perfil, **inclusive as desativadas** — é o que
torna a reativação alcançável pela tela.

#### `POST /v1/usuarios/:id/permissoes`
**Corpo:** o conjunto **completo** de ajustes individuais.

```json
{ "ajustes": [
    { "tipo": "TELA", "chave": "financeiro",     "efeito": "CONCEDIDA" },
    { "tipo": "ACAO", "chave": "emitir_boleto",  "efeito": "CONCEDIDA" },
    { "tipo": "TELA", "chave": "usuarios",       "efeito": "NEGADA"    }
] }
```

⚠️ **`chave` vem SEM o prefixo** — o prefixo é o `tipo`. `TELA` + `financeiro` reconstrói
`TELA:financeiro`. Chave fora do catálogo é `422` com `campo: "ajustes"`; a mesma chave duas vezes
também.

**O ajuste vai nos dois sentidos**: `CONCEDIDA` acrescenta sobre o padrão do perfil, `NEGADA` retira.
Um arranjo **vazio** remove todos os ajustes e devolve a pessoa ao padrão do perfil dela.
**É substituição, nunca mesclagem**: o que não estiver no corpo deixa de existir.

Uma **ação concedida sem a área correspondente** é `422` nomeando a tela exigida, **antes de qualquer
escrita**.

**Resposta `200`:** `{ usuarioId, telas, acoes, versaoPermissoes }` — o efetivo novo e a versão que
passa a datá-lo.
<!-- fonte: apps/api/src/usuarios/usuario.controller.ts → `ESQUEMA_DOS_AJUSTES`, `ajustarPermissoes` -->

#### `POST /v1/usuarios/:id/perfil`
**Corpo:** `{ "perfil": "ADMIN_EMPRESA" | "USUARIO_EMPRESA", "descartarAjustes": false }`

A troca **descarta todos** os ajustes individuais — eles são desvios sobre a matriz de um perfil.
Havendo o que descartar, ela **exige `descartarAjustes: true`**: sem a intenção declarada, responde
`422` com `detalhes.ajustesDescartados` (quantos seriam perdidos) e **nada muda** — nem o perfil, nem
os ajustes, nem a versão.

A tela correta é: pedir a troca → receber `422` → mostrar o diálogo *"isto descarta N ajustes
individuais"* → repetir com `descartarAjustes: true`.

**Resposta `200`:** `{ usuarioId, perfil, versaoPermissoes }`

#### `POST /v1/usuarios/:id/desativacao`
**Resposta `200`:** `{ usuarioId, ativo: false, sessoesEncerradas: 3 }`

As sessões da pessoa são apagadas **no próprio ato**, na mesma transação. As demais pessoas da
empresa seguem operando. Repetir devolve `sessoesEncerradas: 0`. **Nada é apagado**: os ajustes
individuais permanecem e a reativação os devolve.

#### `POST /v1/usuarios/:id/reativacao`
**Resposta `200`:** `{ usuarioId, ativo: true }`

Devolve a capacidade de entrar, e **não** as sessões encerradas: os cookies anteriores continuam
inválidos.

#### `POST /v1/usuarios/:id/senha-provisoria`
**Resposta `200`:** `{ usuarioId, senhaProvisoria: "…" }`

A senha anterior deixa de servir no mesmo ato, e a recusa dela é **indistinguível** de credencial
incorreta. A sessão da pessoa passa a ser **restrita** até que ela troque a senha. O alvo é qualquer
pessoa da empresa, de qualquer perfil, **menos quem age**.

### 7.3 Conjuntos — 6 rotas · `TELA:imoveis`

Um conjunto agrupa imóveis (um condomínio, um prédio, uma rua).

| Rota | Exige | Corpo | Resposta |
|---|---|---|---|
| `POST /v1/conjuntos` | `TELA:imoveis` | `{ "nome": "…" }` | `201` Conjunto |
| `GET /v1/conjuntos` | `TELA:imoveis` | — | `200` página |
| `GET /v1/conjuntos/:id` | `TELA:imoveis` | — | `200` Conjunto |
| `PUT /v1/conjuntos/:id` | `TELA:imoveis` | `{ "nome": "…" }` | `200` Conjunto |
| `POST /v1/conjuntos/:id/retirada` | `TELA:imoveis` **+** `ACAO:excluir_cadastro` | `{}` | `200` Conjunto |
| `POST /v1/conjuntos/:id/recirculacao` | `TELA:imoveis` **+** `ACAO:excluir_cadastro` | `{}` | `200` Conjunto |

**Conjunto:** `{ id, nome, retiradoEm }`

**A listagem tem um parâmetro que substitui um agregador inteiro do sistema antigo:**

```
GET /v1/conjuntos?expandir=imoveis&incluirRetirados=false&limite=50&deslocamento=0
```

Com `expandir=imoveis`, cada item vem com `imoveis: [Imóvel]`, e cada imóvel com os **cômodos
ordenados por posição** e a **`metragemTotal`** — **numa consulta só**, e idêntica à composição das
leituras individuais. **Sem `expandir`, o item não traz a chave `imoveis`** (ela não vem vazia: não
vem).

⚠️ **Este é o sucessor do `GET method/all_imoveis`**, o agregador que alimentava Imóveis, Dashboard,
Relatório de Ocupação e o select de contrato. A decisão de circulação vale para os **dois níveis** da
árvore: nenhum retirado aparece em nível algum, e `incluirRetirados=true` alcança os dois.
<!-- fonte: apps/api/src/imoveis/conjunto.controller.ts → `listar` -->

### 7.4 Imóveis — 7 rotas · `TELA:imoveis`

**Imóvel:**

```json
{
  "id": "uuid", "conjuntoId": "uuid",
  "nomeImovel": "Apto 302", "identificadorMunicipal": "1234.567.8901-2",
  "tipoImovel": "RESIDENCIAL",
  "logradouro": "…", "numero": "…", "complemento": null,
  "bairro": "…", "cidade": "…", "estado": "SP", "cep": "01310100",
  "statusLocacao": "LOCADO",
  "observacoes": null,
  "comodos": [ { "id": "uuid", "nomeComodo": "Sala", "metragem": 24.5, "posicao": 1, "observacoes": null } ],
  "metragemTotal": 78.5,
  "contratoVigente": { "codigo": "CTR-2026-00001", "locatario": { "id": "uuid", "nome": "João" } },
  "retiradoEm": null
}
```

- `tipoImovel`: `RESIDENCIAL` · `COMERCIAL` · `MISTO`
- `statusLocacao` (leitura): `DISPONIVEL` · `LOCADO` · `INDISPONIVEL`
- `statusLocacao` (escrita): **só** `DISPONIVEL` e `INDISPONIVEL`
- `metragemTotal` é **derivada na leitura**, somando os cômodos. Não é campo gravado, não é aceito em
  corpo algum.
- `contratoVigente` é `null` quando não há contrato ativo. Quando há, **já traz o código e o nome do
  locatário** — o join que o app antigo fazia no cliente.
- `cep` chega mascarado e é guardado **só com dígitos** (8). `estado` é normalizado para maiúsculas e
  tem exatamente 2 caracteres.

| Rota | Exige | Corpo |
|---|---|---|
| `POST /v1/imoveis` | `TELA:imoveis` | Imóvel novo (ver abaixo) |
| `GET /v1/imoveis?limite=&deslocamento=&incluirRetirados=` | `TELA:imoveis` | — |
| `GET /v1/imoveis/:id` | `TELA:imoveis` | — |
| `PUT /v1/imoveis/:id` | `TELA:imoveis` | Imóvel novo **sem** `statusLocacao` |
| `POST /v1/imoveis/:id/situacao-de-locacao` | `TELA:imoveis` | `{ "statusLocacao": "DISPONIVEL" }` |
| `POST /v1/imoveis/:id/retirada` | `TELA:imoveis` **+** `ACAO:excluir_cadastro` | `{}` |
| `POST /v1/imoveis/:id/recirculacao` | `TELA:imoveis` **+** `ACAO:excluir_cadastro` | `{}` |

**Corpo de criação** (fechado, completo): `conjuntoId`, `nomeImovel`, `identificadorMunicipal`,
`tipoImovel`, os 7 campos de endereço, `statusLocacao` (só `DISPONIVEL`/`INDISPONIVEL`),
`observacoes` (aceita `null`).

⚠️ **O `PUT` NÃO aceita `statusLocacao`** — a chave foi retirada do corpo e é recusada como chave
desconhecida (`422`). A situação de locação tem **rota própria**, e essa é a única porta por onde uma
requisição a escreve.

⚠️ **`LOCADO` não é informável.** Ele é produzido pela **ativação de contrato**. Informá-lo na rota de
situação é `422` por valor fora da união.

⚠️ **Imóvel com contrato vigente recusa a mudança de situação:** `422`, `campo: "statusLocacao"`,
`detalhes: { "conflito": "IMOVEL_COM_CONTRATO_VIGENTE" }`. Para liberá-lo, **cancele o contrato**.

⚠️ **`INDISPONIVEL` significa "não ofereça nas buscas", não "proibido de locar".** Um imóvel
`INDISPONIVEL` **é ativável** por um contrato. A tela não deve bloquear isso.

**Mudar o imóvel de conjunto acontece pelo `PUT`** — `conjuntoId` é campo como outro qualquer, e o
destino passa pela mesma conferência de alcance da criação.

**Unicidade:** `identificadorMunicipal` é único por empresa e **alcança os retirados**. A recusa é
`422` nomeando o campo, com `detalhes.conflito` valendo `EM_CIRCULACAO` ou `RETIRADO_DE_CIRCULACAO`.

### 7.5 Cômodos — 3 rotas · `TELA:imoveis`

O cômodo **não tem representação própria na API**: as três rotas devolvem o **imóvel inteiro**, com
`comodos` ordenados por posição e `metragemTotal` já recalculada.

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /v1/imoveis/:id/comodos` | `{ nomeComodo, metragem?, observacoes? }` | `201` **Imóvel** |
| `PUT /v1/imoveis/:id/comodos/:comodoId` | idem, completo | `200` **Imóvel** |
| `DELETE /v1/imoveis/:id/comodos/:comodoId` | — | `200` **Imóvel** |

- `posicao` é atribuída pelo servidor (`max + 1`) e **não é aceita no corpo**.
- `metragem` ausente vale **`0`**; `null` explícito é `422`.
- `observacoes` ausente vale `null`.
- O `PUT` **não toca a posição** — alterar metragem não reordena a planta.
- **O cômodo é removido de fato** (exceção da regra de circulação), e as posições dos remanescentes
  **não são reatribuídas**: remover o do meio deixa `1` e `3`. Não presuma sequência contígua.
- Cômodo que não pertence a este imóvel responde `404`, igual a inexistente.

### 7.6 Locadores e Fiadores — 6 rotas cada · `TELA:cadastros`

As duas superfícies são **idênticas** em forma. Troque o segmento.

| Rota | Exige |
|---|---|
| `POST /v1/locadores` · `POST /v1/fiadores` | `TELA:cadastros` |
| `GET /v1/locadores` · `GET /v1/fiadores` | `TELA:cadastros` |
| `GET /v1/locadores/:id` · `GET /v1/fiadores/:id` | `TELA:cadastros` |
| `PUT /v1/locadores/:id` · `PUT /v1/fiadores/:id` | `TELA:cadastros` |
| `POST /v1/…/:id/retirada` | `TELA:cadastros` **+** `ACAO:excluir_cadastro` |
| `POST /v1/…/:id/recirculacao` | `TELA:cadastros` **+** `ACAO:excluir_cadastro` |

**Pessoa:**

```json
{
  "id": "uuid", "nome": "…", "tipoPessoa": "PESSOA_FISICA",
  "documentoPrincipal": "12345678909", "rg": null,
  "email": "…", "telefone": "…",
  "logradouro": "…", "numero": "…", "complemento": null,
  "bairro": "…", "cidade": "…", "estado": "SP", "cep": "01310100",
  "retiradoEm": null
}
```

- `tipoPessoa`: `PESSOA_FISICA` · `PESSOA_JURIDICA`
- `documentoPrincipal` chega **mascarado** (`123.456.789-09`) e é guardado **só com dígitos**. O
  **dígito verificador é conferido**: documento inválido é `422` nomeando o campo, sem gravar nada.
- `email` é normalizado para minúsculas.
- **Unicidade por empresa E por papel**: a mesma pessoa pode ser locadora **e** fiadora da mesma
  empresa. A unicidade **alcança os retirados**, com o mesmo `detalhes.conflito` da §6.8.
- O `PUT` aplica **a mesma** conferência de dígito e **a mesma** unicidade da criação.
- Cadastro **de outro papel** é indistinguível de inexistente: `404`.

⚠️ **Isto substitui os 15 campos snake_case por papel do sistema antigo.** Os três papéis já falavam
o mesmo modelo no cliente (`PessoaItem`); agora falam o mesmo modelo **no servidor**. E `ativo: 0|1`
virou `retiradoEm: string|null`.

### 7.7 Locatários — 7 rotas · `TELA:cadastros`

Tudo da §7.6, **mais** um campo e **mais** uma rota.

**Locatário** = Pessoa **+** `"emailConfirmadoEm": "2026-03-15T…Z" | null`

#### `POST /v1/locatarios/:id/confirmacao-de-email`
**Exige:** `TELA:cadastros` (a área da classe; **nenhuma ação nova**).
**Corpo:** `{}`
**Resposta `202`:** `{ "reenviadoEm": "…Z", "expiraEm": "…Z" }`

Emite um portador novo com prazo de **72 h** e **invalida todos os anteriores** do locatário. É a
saída de quem não recebeu a mensagem.

⚠️ **`202`, não `200`, e a diferença é conteúdo**: a resposta afirma só o que **já** aconteceu — o
portador foi gravado e os anteriores foram invalidados. **A entrega do e-mail corre fora da
requisição.** A tela não pode dizer "e-mail enviado"; pode dizer *"reenvio solicitado; o link expira
em <expiraEm>"*.

⚠️ **A confirmação em si acontece numa tela pública, fora do shell autenticado** — §7.14 e §9.6.

⚠️ **Os 17 campos de validação de e-mail/WhatsApp do sistema antigo NÃO existem.** Não há
`emailStatusValidacao`, `emailTokenHash`, `emailReenvios`, nem nada de WhatsApp. O que existe é
`emailConfirmadoEm` (um instante, ou `null`) e a rota de reenvio acima. **O hook React que escrevia 9
colunas do banco para "resetar a máquina de e-mail" some inteiro** — aquilo era operação de domínio
implementada na UI.

**O e-mail de confirmação é disparado automaticamente** quando um locatário é **criado** (o campo
`email` é obrigatório em todo cadastro de pessoa) e quando o e-mail dele **muda** num `PUT`. A tela
não precisa pedir nada nesses dois casos — o reenvio manual é a saída de quem não recebeu.

### 7.8 Contratos — 10 rotas · `TELA:contratos`

**Contrato:**

```json
{
  "codigo": "CTR-2026-00001",
  "status": "ATIVO",
  "imovelId": "uuid", "locadorId": "uuid", "locatarioId": "uuid",
  "fiadores": [ { "id": "uuid", "nome": "Ana" } ],
  "dataInicioLocacao": "2026-03-01",
  "prazoMeses": 30,
  "valorMensal": 2500.00,
  "diaVencimento": 10,
  "dataFimLocacao": "2028-08-31",
  "valorTotalContrato": 75000.00,
  "gerarCobrancasAutomaticamente": true,
  "retiradoEm": null
}
```

**Os quatro estados:** `RASCUNHO` · `ATIVO` · `CANCELADO` · `ENCERRADO`

| Estado | Quem produz |
|---|---|
| `RASCUNHO` | a criação — o contrato **não vale** e **não ocupa o imóvel** |
| `ATIVO` | `POST /:codigo/ativacao` |
| `CANCELADO` | `POST /:codigo/cancelamento` |
| `ENCERRADO` | **uma rotina automática**, quando a `dataFimLocacao` passa — §9.7 |

⚠️ **`ENCERRADO` não tem rota.** Não existe "encerrar contrato" pela tela, e isso é decisão
registrada: o ato equivalente com ator transfere direito (libera o imóvel) e exigiria uma chave que
o catálogo fechado não tem. **Não desenhe esse botão.** O que a tela pode fazer com um contrato
vencido é **cancelá-lo** (se ainda `ATIVO`) ou esperar a rotina.
<!-- fonte: packages/db/src/encerramento-de-contratos.ts → "Isto NÃO fundamenta um encerramento manual pela tela" -->

| Rota | Exige | Corpo | Resposta |
|---|---|---|---|
| `POST /v1/contratos` | `TELA:contratos` | Contrato novo | `201` Contrato |
| `GET /v1/contratos?limite=&deslocamento=&incluirRetirados=` | `TELA:contratos` | — | `200` página |
| `GET /v1/contratos/:codigo` | `TELA:contratos` | — | `200` Contrato |
| `GET /v1/contratos/:codigo/documento` | `TELA:contratos` | — | `200` **PDF** |
| `GET /v1/contratos/:codigo/carne?de=&ate=` | `TELA:contratos` | — | `200` **PDF** |
| `PUT /v1/contratos/:codigo` | `TELA:contratos` | Contrato novo | `200` Contrato |
| `POST /v1/contratos/:codigo/ativacao` | `TELA:contratos` **+** `ACAO:ativar_contrato` | `{}` | `200` Contrato + `efeitos` |
| `POST /v1/contratos/:codigo/cancelamento` | `TELA:contratos` **+** `ACAO:cancelar_contrato` | `{}` | `200` Contrato |
| `POST /v1/contratos/:codigo/retirada` | `TELA:contratos` **+** `ACAO:excluir_cadastro` | `{}` | `200` Contrato |
| `POST /v1/contratos/:codigo/recirculacao` | `TELA:contratos` **+** `ACAO:excluir_cadastro` | `{}` | `200` Contrato |

**Corpo de criação e alteração** (fechado, completo, idêntico nos dois):

```json
{
  "imovelId": "uuid", "locadorId": "uuid", "locatarioId": "uuid",
  "fiadoresIds": ["uuid", "uuid"],
  "dataInicioLocacao": "2026-03-01",
  "prazoMeses": 30,
  "valorMensal": 2500.00,
  "diaVencimento": 10,
  "gerarCobrancasAutomaticamente": true
}
```

- `fiadoresIds` aceita **arranjo vazio**; o mesmo fiador duas vezes é `422`.
- `diaVencimento` vive em **`[1, 28]`** — não há dia 29, 30 ou 31.
- `prazoMeses` ≥ 1; e `valorMensal × prazoMeses` não pode estourar o teto monetário (`422` nomeando
  `prazoMeses`).
- `gerarCobrancasAutomaticamente` ausente vale **`true`**.
- **`dataFimLocacao` e `valorTotalContrato` saem `null` no rascunho** — são derivados na ativação.
  A tela pode exibir a projeção (`valorMensal × prazoMeses`), mas o campo é nulo até ativar.

**Criação:** o contrato nasce como `RASCUNHO`, **em circulação**, na empresa da sessão. Imóvel,
locador, locatário e cada fiador precisam existir na empresa (`404` se não) **e estar em circulação**
(`422` nomeando o campo, com `detalhes.circulacao: "RETIRADO_DE_CIRCULACAO"`).

**Alteração (`PUT`):** aceita **somente enquanto `RASCUNHO`**. Sobre `ATIVO`, `CANCELADO` ou
`ENCERRADO` responde `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`, e
nada é gravado. **Mudar os termos de um contrato que já vale exige cancelar e montar outro.**
`fiadoresIds` é **substituída por inteiro**, nunca mesclada. O `codigo` não muda.

#### Ativação — o ato mais consequente do produto

`POST /v1/contratos/:codigo/ativacao` transita `RASCUNHO → ATIVO` **num commit só**, e faz **quatro
coisas juntas**:

1. reconfere que imóvel, locador, locatário e fiadores continuam **em circulação** (a montagem pode
   ter sido há semanas);
2. deriva `dataFimLocacao` e `valorTotalContrato`;
3. marca o imóvel como **`LOCADO`**;
4. **gera as parcelas de aluguel**: `prazoMeses` cobranças de natureza `ALUGUEL`, com código próprio
   da série `COB-{ano}-{7 dígitos}`, competência no primeiro dia de cada mês e vencimento no
   `diaVencimento`.

**Resposta `200`:** o Contrato **mais**:

```json
{ "efeitos": { "cobrancasGeradas": 30 } }
```

Contrato com `gerarCobrancasAutomaticamente: false` gera **zero** e responde `cobrancasGeradas: 0`.

**Falha em qualquer etapa deixa o contrato `RASCUNHO`, o imóvel exatamente como estava e NENHUMA
cobrança.** Não há estado intermediário a tratar.

| Recusa | Resposta |
|---|---|
| não é `RASCUNHO` | `422`, `campo: "status"`, `detalhes: { estadoAtual, transicaoPedida }` |
| imóvel já tem contrato vigente | `422`, `campo: "imovelId"`, `detalhes: { conflito: "IMOVEL_COM_CONTRATO_VIGENTE", contratoVigente: "CTR-…" }` |
| alguma parte retirada de circulação | `422` nomeando o campo, `detalhes.circulacao` |

⚠️ **`detalhes.contratoVigente` traz o código do contrato que ocupa o imóvel** — é o que a tela mostra
ao usuário para ele saber **o que cancelar**.

⚠️ **Isto substitui um fluxo de três requisições do sistema antigo** (`POST` rascunho → `GET` doc
inteiro → `frappe.client.submit` → conferir `docstatus === 1`). Agora é **um `POST` sem corpo**.
E o `docstatus` **não existe**: quem diz o estado é `status`.

#### Cancelamento

`POST /v1/contratos/:codigo/cancelamento` transita `ATIVO → CANCELADO` **num commit só**:

- grava o contrato como `CANCELADO`;
- devolve o imóvel a **`DISPONIVEL`**, liberando-o para um contrato novo;
- **cancela em cascata as cobranças do contrato que ainda podem ser canceladas** — as que não foram
  pagas nem canceladas.

⚠️ **As pagas e as já canceladas ficam exatamente como estavam**: valor pago, instante do
cancelamento e os carimbos de multa e juros **não são reescritos**.

⚠️ **O contrato permanece na carteira.** Nada é apagado; ele continua listado e legível como
histórico, e `dataFimLocacao` e `valorTotalContrato` **não são zerados** — eles descrevem o que o
contrato foi enquanto valeu.

| Recusa | Resposta |
|---|---|
| não é `ATIVO` | `422`, `campo: "status"`, `detalhes: { estadoAtual, transicaoPedida }` |
| já cancelado | idem, com `estadoAtual: "CANCELADO"` — **não é idempotente, por decisão** |

⚠️ **Um rascunho abandonado se RETIRA, não se cancela.** As duas operações têm efeitos distintos, e o
servidor recusa a confusão. A tela deve oferecer "cancelar" só em contrato `ATIVO`.

#### Documento do contrato (PDF)

`GET /v1/contratos/:codigo/documento` → `application/pdf`, com
`Content-Disposition: attachment; filename="CTR-2026-00001.pdf"`.

- **Composto no instante do pedido** a partir do cadastro. O documento **não é armazenado** em lugar
  nenhum, e por isso **não existe "regerar"**: alterar o contrato e pedir de novo já devolve o texto
  novo.
- Um contrato `CANCELADO` sai com a **marca de cancelamento** logo abaixo do título.
- Um `RASCUNHO` sai com o valor total derivado de `valorMensal × prazoMeses`, ainda que o campo esteja
  nulo.

#### Carnê (PDF)

`GET /v1/contratos/:codigo/carne?de=2026-01-01&ate=2026-06-01`

Reúne, **num documento só**, os boletos das cobranças deste contrato cujas competências caem no
intervalo — **as duas pontas inclusive**, cada uma no formato `YYYY-MM-01`. As parcelas saem na ordem
**crescente de vencimento**.

| Regra | Detalhe |
|---|---|
| Largura máxima | **12 competências**. Mais que isso é `422` nomeando `ate` |
| `de` posterior a `ate` | `422` nomeando `de` |
| Competência fora do dia 1 | `422` |
| Recorte sem cobrança alguma | `404` com `detalhes: { "carne": "SEM_COBRANCAS" }` |
| Cobrança do recorte **sem boleto** | `404` com `detalhes: { "carne": "BOLETO_AUSENTE", "cobranca": "COB-…" }` — nomeando a **primeira** na ordem de vencimento |
| Provedor indisponível na rebusca | `503`, sem alterar nada |

⚠️ **O carnê nunca sai com parcela faltando.** Se algum boleto não existe, a resposta é `404`
nomeando qual — e a tela manda o usuário emitir aquele boleto primeiro. Isso é diferente do sistema
antigo, que montava o carnê no cliente com o que tivesse.

Nome sugerido do arquivo: `CTR-2026-00001-2026-01-2026-06.pdf`.

### 7.9 Cobranças — 9 rotas · `TELA:financeiro`

**Cobrança — 22 campos, e cinco deles são derivados na leitura:**

```json
{
  "codigo": "COB-2026-0000001",
  "contratoCodigo": "CTR-2026-00001",
  "locatarioId": "uuid",
  "natureza": "ALUGUEL",
  "referencia": "Aluguel 03/2026",
  "competencia": "2026-03-01",
  "dataVencimento": "2026-03-10",
  "valorOriginal": 2500.00,

  "status": "VENCIDA",
  "diasAtraso": 7,
  "valorMulta": 50.00,
  "valorJuros": 8.75,
  "valorTotal": 2558.75,

  "pagoEm": null, "valorPago": null, "canceladoEm": null,
  "multaPercentualAplicado": null, "jurosPercentualAplicado": null,

  "numeroDoTituloNoProvedor": "000012345678",
  "linhaDigitavel": "75691.12345 …",
  "codigoDeBarras": "756900000…",
  "dataDoCredito": null,
  "valorCreditado": null
}
```

- `natureza`: `ALUGUEL` · `AGUA` · `CONDOMINIO` · `ENERGIA` · `OUTRO`
- `status`: `A_VENCER` · `VENCIDA` · `PAGA` · `CANCELADA`

⚠️ **`status`, `diasAtraso`, `valorMulta`, `valorJuros` e `valorTotal` são DERIVADOS no instante da
leitura**, a partir dos fatos gravados e da política de mora vigente. **Não existe rotina que
"marca como vencida"**, e não existe coluna de status a mover. A mesma cobrança lida em dias
diferentes vem com `status` e mora diferentes — isso é correto.
<!-- fonte: packages/db/src/derivacao-de-cobranca.ts · ADR-0022 -->

⚠️ **`natureza` é o que distingue aluguel de água/condomínio/energia — nunca o texto de
`referencia`**, que é livre. O sistema antigo discriminava por rótulo; **não faça isso**.

⚠️ **`locatarioId` é derivado da junção com o contrato.** Não é aceito no corpo e não é gravado em
coluna própria. Aquela FK dupla `Cobranca → Contrato` **e** `Cobranca → Locatario`, que podia
divergir, **deixou de existir**: há uma fonte só.

| Rota | Exige | Corpo | Resposta |
|---|---|---|---|
| `POST /v1/cobrancas` | `TELA:financeiro` | Cobrança nova | `201` Cobrança |
| `GET /v1/cobrancas?…` | `TELA:financeiro` | — | `200` página |
| `GET /v1/cobrancas/:codigo` | `TELA:financeiro` | — | `200` Cobrança |
| `POST /v1/cobrancas/:codigo/pagamento` | `TELA:financeiro` | `{ pagoEm, valorPago }` | `200` Cobrança |
| `POST /v1/cobrancas/:codigo/cancelamento` | `TELA:financeiro` | `{}` | `200` Cobrança |
| `POST /v1/cobrancas/:codigo/emissao-de-boleto` | `TELA:financeiro` **+** `ACAO:emitir_boleto` | `{}` | `200` Cobrança |
| `POST /v1/cobrancas/:codigo/revogacao-de-boleto` | `TELA:financeiro` **+** `ACAO:solicitar_baixa_de_boleto` | `{}` | `200` Cobrança |
| `GET /v1/cobrancas/:codigo/boleto` | `TELA:financeiro` | — | `200` **PDF** |
| `GET /v1/cobrancas/:codigo/historico-bancario` | `TELA:financeiro` | — | `200` trilha |

**Listagem** — três recortes **opcionais e independentes**, além da janela:

```
GET /v1/cobrancas?contrato=CTR-2026-00001&status=VENCIDA&natureza=ALUGUEL&limite=50&deslocamento=0
```

Ausência quer dizer **sem filtro**; rótulo fora da união é `422`. A ordem é **por vencimento**, com o
código desempatando. `total` é o da empresa sob o recorte pedido.

⚠️ **Não há mais filtro por data, por locatário, por conjunto, nem ordenação declarável.** Se a tela
Financeiro precisa de recorte por período, ela lê a página e recorta no cliente — ou usa o filtro por
`status`, que é o que responde a maioria das perguntas.

**Criação** (fechado, completo):

```json
{ "contratoCodigo": "CTR-2026-00001", "natureza": "AGUA", "referencia": "Água 03/2026",
  "competencia": "2026-03-01", "dataVencimento": "2026-03-20", "valorOriginal": 187.40 }
```

`competencia` **precisa ser o primeiro dia do mês** (`422` nomeando o campo, senão). Contrato de
outra empresa é `404`; contrato retirado de circulação é `422` nomeando `contratoCodigo`.

#### Pagamento

`POST /v1/cobrancas/:codigo/pagamento` `{ "pagoEm": "2026-03-12", "valorPago": 2558.75 }`

Registra **dinheiro que já se moveu fora do sistema** — não o move. Grava data e valor, e **carimba
na mesma instrução** a multa, os juros e os dois percentuais vigentes no instante do ato. A partir
daí `status` é `PAGA`, e `valorMulta`/`valorJuros`/`valorTotal` **deixam de acompanhar a política**:
alterar multa e juros depois disso **não move um centavo** desta cobrança.

⚠️ **Multa e juros NÃO são aceitos no corpo.** Os dois campos de fato, e mais nenhum: quem paga não
escreve o próprio recibo.

⚠️ **Os seis campos de conciliação bancária permanecem exatamente como estavam** — divergência
declarada contra o sistema antigo, que os **zerava** ao acusar pagamento. Eles são fato do banco, não
consequência do ato do operador.

Sobre cobrança já paga ou cancelada: `422`, `campo: "codigo"`,
`detalhes: { estadoAtual, transicaoPedida }`, **sem escrever nada**.

⚠️ **Não existe "marcar como paga".** Existe *"registrar que foi paga em X, no valor Y"*. O estado é
consequência.

#### Cancelamento de cobrança

`POST /v1/cobrancas/:codigo/cancelamento` `{}`

Nada é apagado: a cobrança continua legível, continua na carteira com os termos originais, e o código
segue **ocupado**. A mora deixa de ser apurada mesmo com vencimento passado. Cobrar de novo o mesmo
fato é lançar uma **substituta** por `POST /v1/cobrancas`, que recebe código novo.

Sobre já paga ou já cancelada: `422` com `detalhes: { estadoAtual, transicaoPedida }` — não é
idempotente, e o instante do primeiro cancelamento é preservado.

#### Emissão de boleto

`POST /v1/cobrancas/:codigo/emissao-de-boleto` `{}` — exige a **conjunção** `TELA:financeiro` +
`ACAO:emitir_boleto`.

- Sobre cobrança **sem** boleto vivo: emite direto.
- Sobre cobrança **com** boleto vivo: **revoga o anterior, espera a confirmação do provedor, e só
  então emite o novo**. Em nenhum instante existem dois boletos pagáveis.

**Resposta `200`:** a cobrança inteira, já com `numeroDoTituloNoProvedor`, `linhaDigitavel` e
`codigoDeBarras` preenchidos. `dataDoCredito` e `valorCreditado` seguem `null` até a conferência
apurar o crédito.

| Recusa | Resposta |
|---|---|
| cobrança paga ou cancelada | `422` nomeando o estado, **sem falar com o provedor** |
| empresa sem certificado vigente, ou com um vencido | `422` dizendo o que falta |
| revogação confirmada mas emissão falhou | `503` nomeando a cobrança, com `detalhes: { "boleto": "SEM_BOLETO", "revogacao": "CONFIRMADA" }` |

⚠️ **Aquele `503` é um estado declarado, não um erro genérico.** A cobrança ficou **sem boleto**. A
tela deve dizer isso e oferecer emitir de novo — não "tente mais tarde" genérico.

⚠️ **Isto substitui o `regerarBoleto` do sistema antigo, que encadeava SEIS chamadas sem transação e
sem rollback.** Agora é **uma** chamada, e o servidor garante a ordem e a consistência.

#### Revogação de boleto

`POST /v1/cobrancas/:codigo/revogacao-de-boleto` `{}` — exige `TELA:financeiro` +
`ACAO:solicitar_baixa_de_boleto`.

Derruba o título junto ao provedor e **espera a confirmação** antes de apagar qualquer coisa.
Confirmada: os campos de emissão voltam a `null`, o arquivo é apagado, e a trilha ganha
`BOLETO_REVOGADO`.

⚠️ **A cobrança continua em aberto** — revogar boleto **não** cancela cobrança. Emitir de novo depois
acontece como a primeira vez.

| Recusa | Resposta |
|---|---|
| sem boleto vivo | `422` com `detalhes: { "boleto": "SEM_BOLETO" }` |
| confirmação não veio dentro do teto | `503` com `detalhes: { "revogacao": "PEDIDA_NAO_CONFIRMADA" }`, e **nada é apagado** |

⚠️ **O `cancelarCobrancaComBaixa` do sistema antigo — que engolia deliberadamente o erro da baixa — e
o `{ baixaSolicitada, baixaErro }` que a tela precisava interpretar **não existem mais**. Cancelar
cobrança e revogar boleto são **dois atos separados**, cada um com resposta própria.

#### Boleto (PDF)

`GET /v1/cobrancas/:codigo/boleto` → `application/pdf`, `filename="COB-2026-0000001.pdf"`.

Devolve **os bytes que o provedor emitiu**, tal como ele os entregou. Se o arquivo sumiu do disco,
ele é **rebuscado do provedor e regravado**, de forma transparente.

| Situação | Resposta |
|---|---|
| nunca teve boleto | `404` com `detalhes: { "boleto": "NUNCA_EMITIDO" }` |
| boleto revogado | `404` igual — **a existência é decidida pelo estado no banco, nunca pelo arquivo** |
| provedor indisponível na rebusca | `503`, sem alterar nada |

#### Histórico bancário

`GET /v1/cobrancas/:codigo/historico-bancario` → `{ "itens": [ … ] }`

```json
{ "tipo": "COBRANCA_LIQUIDADA", "origem": "CONFERENCIA",
  "ocorridoEm": "2026-03-12T09:14:00.000Z",
  "diagnostico": "liquidação confirmada pelo provedor", "valorInformado": 2558.75 }
```

- `tipo`: `BOLETO_EMITIDO` · `BOLETO_REVOGADO` · `EMISSAO_RECUSADA` · `COBRANCA_LIQUIDADA` ·
  `LIQUIDACAO_ESTORNADA` · `DIVERGENCIA_DE_VALOR` · `NOTICIA_RECUSADA`
- `origem`: `ATO_DO_ADMIN` · `CONFERENCIA` · `NOTICIA_DO_PROVEDOR`
- Ordem: **do mais antigo para o mais recente**.

⚠️ **A trilha registra EFEITO, nunca tentativa.** A passada da conferência que nada mudou, e a
revogação pedida e não confirmada, **não aparecem aqui**. Cobrança sem efeito bancário responde `200`
com `itens: []` — que é diferente de `404`.

⚠️ **`DIVERGENCIA_DE_VALOR` é o item que a tela precisa destacar**: o provedor informou um valor
diferente do esperado. `valorInformado` traz o que ele disse.

### 7.10 Multa e juros — 2 rotas · `TELA:multa_e_juros`

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /v1/multa-e-juros` | — | `200` `{ multaPercentual, jurosPercentual }` |
| `PUT /v1/multa-e-juros` | `{ multaPercentual, jurosPercentual }` | `200` idem |

- Os dois vivem em **`[0, 100]`**, com **duas casas decimais**.
- **A multa é aplicada UMA vez** sobre o valor original; **os juros são ao mês**, simples, sobre base
  de **trinta dias**.
- A empresa que nunca configurou recebe `200` com `{ "multaPercentual": 0, "jurosPercentual": 0 }` —
  **nunca `404`** —, e a leitura **não cria linha alguma**.
- O `PUT` é idempotente e **não reescreve cobrança nenhuma**: o que está em aberto passa a refletir a
  política nova **na leitura seguinte**; o que já foi pago mantém os carimbos do dia do pagamento.

⚠️ Isto substitui o `Atraso/Atraso` (Single DocType global). Agora é **por empresa**.

### 7.11 Automação de cobrança — 5 rotas · `TELA:automacao_de_cobranca`

#### `GET /v1/automacao-de-cobranca` e `PUT /v1/automacao-de-cobranca`

```json
{
  "ativo": true,
  "diasAntesDoVencimento": 3,
  "intervaloMinimoDias": 5,
  "janelaInicio": "08:00",
  "janelaFim": "18:00",
  "canal": "EMAIL"
}
```

| Campo | Domínio |
|---|---|
| `diasAntesDoVencimento` | `[0, 90]` |
| `intervaloMinimoDias` | `[1, 90]` — intervalo mínimo entre dois avisos da **mesma** cobrança |
| `janelaInicio` / `janelaFim` | `HH:MM`; **`janelaFim` ≥ `janelaInicio`** (senão `422` nomeando `janelaFim`) |
| `canal` | **só `EMAIL`** — é o único implementado |

- Corpo **completo**: os seis campos são obrigatórios.
- A empresa que nunca configurou recebe `200` com a régua **desligada** (`ativo: false`, janela
  `00:00`–`23:59`) — **nunca `404`** —, e a leitura **não cria linha**.
- O `PUT` é idempotente e **não dispara aviso nenhum**: define o que a passagem seguinte vai obedecer.

⚠️ **WhatsApp não existe.** O sistema antigo tinha `canal: 'email' | 'whatsapp' | 'ambos'` e uma
máquina de validação inteira. **Nada disso foi portado**, e não há rota que o faça.

⚠️ **A régua antiga tinha dois blocos** (`a_vencer` e `vencida`) com horários e intervalos separados,
e usava um único endpoint discriminado por `{acao: 'get'|'save'}`. Agora é **uma** política, com
`GET` e `PUT` separados.

#### `GET /v1/automacao-de-cobranca/cobrancas/:codigo/avisos?limite=&deslocamento=`

Todas as tentativas de aviso daquela cobrança — automáticas e manuais —, **da mais recente para a
mais antiga**:

```json
{ "id": "uuid", "cobrancaCodigo": "COB-2026-0000001",
  "criadoEm": "2026-03-07T08:03:11.000Z",
  "caminho": "AUTOMATICO", "desfecho": "ENVIADA",
  "destinatario": "joao@exemplo.com", "causa": null }
```

- `caminho`: `AUTOMATICO` · `MANUAL`
- `desfecho`: `ENVIADA` · `FALHOU` · `SEM_DESTINATARIO`
- `causa`: `null` quando a mensagem saiu; preenchida quando não saiu.

Cobrança sem tentativa alguma responde `200` com lista vazia — **nunca `404`**.

#### `POST /v1/automacao-de-cobranca/cobrancas/:codigo/avisos`
**Exige:** `TELA:automacao_de_cobranca` **+** `ACAO:enviar_cobranca_manual`. **Corpo:** `{}`

Envia o aviso **na hora**. Ele **ignora a janela de horário, o intervalo mínimo e o recorte de dias de
antecedência** — os três governam a passagem automática, e quem clica está dizendo "agora".

⚠️ **Mas não ignora o estado**: cobrança **paga** ou **cancelada** é `422` com `campo: "codigo"` e
`detalhes.estadoAtual`, e **nenhuma mensagem sai nem linha nasce**.

**Resposta `200`:** a linha do registro, **inclusive quando a entrega falhou** — ali `desfecho` é
`FALHOU` e `causa` diz por quê, e ainda assim o código é `200`: a requisição foi atendida, a
tentativa foi feita e registrada, e o que fracassou foi a comunicação com terceiro.

⚠️ **A tela precisa ler o `desfecho`, não o status HTTP.** Um `200` com `desfecho: "FALHOU"` é um
aviso que **não** chegou. Locatário sem endereço de contato registra `SEM_DESTINATARIO`.

#### `GET /v1/automacao-de-cobranca/rotinas`

O estado das rotinas agendadas da empresa. **Sempre as três, sempre na mesma ordem**, sem corpo e sem
parâmetro:

```json
{ "itens": [
  {
    "rotina": "AVISO_DE_COBRANCA",
    "cadencia": { "tipo": "A_CADA_MINUTO" },
    "ultimaExecucao": "2026-03-15T11:04:00.000Z",
    "resumo": { "avaliadas": 42, "enviadas": 3 },
    "proximaEsperada": "2026-03-15T11:05:00.000Z",
    "atrasada": false,
    "impedimento": null,
    "historicoRecente": [ { "ocorridaEm": "…", "resumo": { … } } ]
  }
] }
```

| `rotina` | `cadencia` | O que faz |
|---|---|---|
| `AVISO_DE_COBRANCA` | `A_CADA_MINUTO` | passa a régua de aviso |
| `ENCERRAMENTO_DE_CONTRATOS` | `DIARIA`, `hora: "00:02"` | encerra os contratos vencidos |
| `CONFERENCIA_DE_LIQUIDACAO` | `DIARIA`, `hora: "03:00"` | apura junto ao provedor o que aconteceu com os boletos |

**`impedimento`** é `null`, ou um `{ codigo, mensagem }` com um destes três — todos **na alçada do
Admin**, resolvíveis por ele sozinho:

| `codigo` | O que a tela oferece |
|---|---|
| `REGUA_DESLIGADA` | link para a política de aviso (§7.11) |
| `AVISOS_RECUSADOS_PELO_PROVEDOR` | link para o histórico de avisos |
| `INTEGRACAO_BANCARIA_PENDENTE` | link para Integrações bancárias (§7.13) |

**`atrasada`** é derivada: `A_CADA_MINUTO` tolera **15 minutos**; `DIARIA` tolera **26 horas**.

Empresa sem passagem alguma responde `200` com `ultimaExecucao` e `resumo` nulos e
`historicoRecente` vazio — **nunca `404`**, e a leitura **não cria linha**.
<!-- fonte: packages/contracts/src/rotina-agendada.ts → `CADENCIA_DA_ROTINA`, `LIMIAR_DE_ATRASO_POR_CADENCIA`, `CODIGOS_DE_IMPEDIMENTO` -->

⚠️ **`resumo` é um mapa livre `{ [chave]: número }`** — as chaves variam por rotina. Renderize
genericamente (par nome/valor), não com campos fixos.

⚠️ **Há outras três rotinas no sistema** (vigilância, manutenção, retomada de notícias) que **não são
publicadas** e não aparecem aqui. Não as procure.

### 7.12 Cobrança bancária — 3 rotas · `TELA:financeiro`

#### `POST /v1/cobranca-bancaria/emissoes`
**Exige:** `TELA:financeiro` **+** `ACAO:emitir_boleto`. **Corpo:** `{ "competencia": "2026-03-01" }`

Abre a emissão em lote dos boletos de uma competência e manda o processo de trabalho executá-la.

⚠️ **O Admin NÃO escolhe cobrança.** O conjunto é decidido no banco: as cobranças **daquela
competência, em aberto e sem boleto**. É isso que torna reexecutar a mesma competência
**idempotente**, sem guarda escrita para isso.

**Resposta `201`:** o lote `EM_ANDAMENTO`, com `emitidas` e `recusadas` em zero e `itens` vazio. A
prestação de contas **cresce enquanto o percurso acontece**, e é lida pelo `GET`.

| Recusa | Resposta |
|---|---|
| competência fora do dia 1 | `422` nomeando `competencia` |
| já há lote em andamento | `422` com `detalhes.loteEmCurso` informando qual, e **nada é gravado** |
| fila indisponível | `503` — **e o lote permanece**; repetir o pedido reencontra o mesmo |

#### `GET /v1/cobranca-bancaria/emissoes/:id`

```json
{
  "id": "uuid", "competencia": "2026-03-01", "estado": "CONCLUIDA",
  "criadoEm": "…", "concluidoEm": "…", "interrompidoEm": null, "motivoDaInterrupcao": null,
  "emitidas": 27, "recusadas": 3,
  "itens": [ { "cobrancaCodigo": "COB-2026-0000042", "desfecho": "RECUSADO",
               "motivo": "conta corrente inválida" } ]
}
```

- `estado`: `EM_ANDAMENTO` · `CONCLUIDA` · `INTERROMPIDA` — **derivado** dos instantes de desfecho.
- `desfecho` do item: `EMITIDO` · `RECUSADO`; no recusado, `motivo` traz **o que o provedor informou**.
- **Não há janela sobre `itens`** — o conjunto é o de uma competência, conhecido antes de começar.
- O lote **interrompido é devolvido** com o motivo e com os itens que chegaram a ser gravados.

⚠️ **É este `GET` que a tela consulta em intervalo** (a cada poucos segundos) enquanto
`estado === "EM_ANDAMENTO"`. Não há notificação por push; não há websocket.

#### `POST /v1/cobranca-bancaria/conferencias`
**Exige:** `TELA:financeiro` (só a área). **Corpo:** `{}`

Manda apurar junto ao provedor o que aconteceu com os boletos vivos — **é por aqui que o produto
descobre pagamento feito fora dele**.

```json
{ "id": "uuid", "iniciadaEm": "…", "concluidaEm": null,
  "iniciadaAgora": true, "cobrancasConferidas": 0, "efeitos": 0 }
```

- Uma empresa tem **uma** conferência em curso por vez, e o disparo repetido **não é erro**: responde
  `200` com **`iniciadaAgora: false`** e o recurso da execução que já está acontecendo. O `POST` é
  **idempotente**, e nada é enfileirado de novo.
- `cobrancasConferidas` e `efeitos` são distintos de propósito: a apuração que perguntou por trinta
  cobranças e nada mudou publica `30` e `0`.
- Fila indisponível: `503`, e a conferência **permanece** aberta.

⚠️ **A tela deve dizer "conferência em andamento desde <iniciadaEm>"** quando `iniciadaAgora` for
`false` — e não "erro" nem "iniciada".

⚠️ **Esta rotina também roda sozinha, diariamente às 03:00** (§7.11). O botão é para quem não quer
esperar.

### 7.13 Integrações bancárias — 7 rotas · `TELA:integracoes_bancarias`

**É a área de configuração que não existia no sistema antigo na forma que existe aqui.** Ela tem
**três objetos** — certificado, identidade e entrega da notícia — e a ordem entre eles importa.

| Rota | Exige | Objeto |
|---|---|---|
| `POST /v1/integracoes-bancarias/certificados` | área **+** `ACAO:configurar_integracao` | certificado |
| `GET /v1/integracoes-bancarias/certificado` | **só a área** | certificado |
| `POST /v1/integracoes-bancarias/certificado/verificacao` | **só a área** | certificado |
| `POST /v1/integracoes-bancarias/identidade` | área **+** `ACAO:configurar_integracao` | identidade |
| `GET /v1/integracoes-bancarias/identidade` | área **+** `ACAO:configurar_integracao` | identidade |
| `POST /v1/integracoes-bancarias/entrega-da-noticia/ativacao` | área **+** `ACAO:configurar_integracao` | webhook |
| `GET /v1/integracoes-bancarias/entrega-da-noticia` | área **+** `ACAO:configurar_integracao` | webhook |

⚠️ **Repare na assimetria de `certificados` (plural, POST) e `certificado` (singular, GET).** São
caminhos diferentes de propósito: o plural é a coleção onde se registra, o singular é o recurso
vigente.

⚠️ **A exigência NÃO é uniforme nesta área, e a tela precisa disso.** Só **duas** rotas se contentam
com a área: consultar o certificado vigente e verificar a identidade contra o provedor. **As outras
cinco exigem a conjunção**, incluindo as duas **leituras** de identidade e de entrega da notícia.

Portanto, para quem tem `TELA:integracoes_bancarias` **sem** `ACAO:configurar_integracao`, a tela
mostra **só o bloco do certificado** (dados e botão de verificar) — os blocos 2 e 3 da §8.5 devem
ficar ocultos ou marcados como indisponíveis, porque **até o `GET` deles responde `403`**. Montar a
tela inteira e deixar dois blocos em erro permanente é o defeito previsível aqui.

#### `POST /v1/integracoes-bancarias/certificados` — registrar ou renovar

**Corpo** (fechado, os dois obrigatórios):

```json
{ "material": "<PKCS#12 em base64>", "senha": "<a senha que o abre>" }
```

| Limite | Valor |
|---|---|
| `material` | base64, no máximo **32 768** caracteres (o maior arquivo real observado tem ~12 900) |
| `senha` | 1 a **128** caracteres |

⚠️ **O arquivo `.pfx`/`.p12` é lido pelo navegador e enviado em base64 dentro do JSON** — não há
`multipart/form-data` em rota alguma deste produto. Some o `nome_arquivo` que o sistema antigo
mandava: ele não é aceito, e mandá-lo é `422`.

**Resposta `201`:**

```json
{
  "id": "uuid", "titular": "IMOBILIARIA EXEMPLO LTDA:12345678000190",
  "validoDe": "2026-01-10T00:00:00.000Z", "validoAte": "2027-01-10T23:59:59.000Z",
  "impressaoDigital": "AB:CD:…",
  "estado": "VIGENTE", "diasParaVencer": 301,
  "registradoPor": { "id": "uuid", "nome": "Maria Souza" },
  "registradoEm": "2026-03-15T10:00:00.000Z",
  "materialConvertido": true
}
```

⚠️ **O material e a senha NÃO voltam em resposta alguma, nem nesta nem em nenhuma outra.** O que sai
é o que se lê do certificado.

⚠️ **`materialConvertido` declara se o arquivo enviado precisou ser convertido para ser aceito.**
Material embalado na cifra que a Autoridade Certificadora entrega é convertido no servidor, e o que
se guarda é o convertido. **A tela não precisa fazer nada com isso** além de, se quiser, informar ao
Admin que o arquivo foi normalizado. **O Admin envia o arquivo exatamente como recebeu da AC** — não
há etapa de preparo, não há comando a rodar, não há suporte a acionar.

**Registrar de novo SUBSTITUI**: o certificado anterior continua consultável no histórico e o segredo
dele deixa de existir no mesmo ato. Por isso a resposta é `201`, e não `200`.

**As três recusas têm CÓDIGOS DISTINTOS** — e é isto que a tela usa para dizer ao Admin o que fazer:

| `codigo` | HTTP | Significa | Mensagem sugerida na tela |
|---|---|---|---|
| `SENHA_DO_MATERIAL_NAO_ABRE` | 422 | a senha não abre o arquivo | "confira a senha" |
| `MATERIAL_EM_FORMATO_NAO_SUPORTADO` | 422 | o arquivo não se deixa ler nem converter | "confira o arquivo escolhido" |
| `CERTIFICADO_COM_VALIDADE_ENCERRADA` | 422 | abriu, é legível, e já venceu — traz `detalhes.validoAte` | "este certificado venceu em <data>; peça um novo à AC" |

⚠️ **Isto é o oposto exato do `CREDENCIAL_INVALIDA`, e a assimetria é deliberada.** Ali um código
responde por quatro causas porque distinguir informaria um atacante. **Aqui não há atacante a
informar**: quem pede está autenticado, detém a ação sensível e apresentou as duas metades. Dizer
qual delas não serve não revela nada — e o silêncio tem custo medido: em 2026-08-20 um operador
caçou por horas uma senha errada que não existia.
<!-- fonte: packages/shared/src/erros.ts → `MATERIAL_EM_FORMATO_NAO_SUPORTADO`, `SENHA_DO_MATERIAL_NAO_ABRE`, `CERTIFICADO_COM_VALIDADE_ENCERRADA` -->

#### `GET /v1/integracoes-bancarias/certificado` — o vigente

Devolve o mesmo objeto **sem** `materialConvertido`.

- `estado` e `diasParaVencer` são **derivados** da validade contra a data corrente — nunca colunas
  gravadas. Por isso a mesma linha é publicada com estados diferentes em dias diferentes, e **nenhuma
  rotina "atualiza" estado**.
- `estado`: **`VENCIDO`** quando a validade já passou · **`VENCENDO`** quando faltam **30 dias ou
  menos** · **`VIGENTE`** no restante.
- **Um certificado vencido continua sendo o vigente e sai com `200`** — é o que a empresa tem, e é o
  que ela precisa ver para renovar.
- Empresa que nunca registrou: **`404`** nomeando a ausência. Não existe certificado de reserva.

⚠️ **`VENCENDO` é o gatilho de aviso na tela.** Trinta dias é o limiar; use-o para o banner.

#### `POST /v1/integracoes-bancarias/certificado/verificacao`
**Corpo:** `{}`

Apresenta ao provedor o certificado vigente e responde se ele foi aceito.

```json
{ "aceito": true, "verificadoEm": "2026-03-15T10:05:00.000Z",
  "detalhe": "a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. …" }
```

⚠️ **A pergunta é respondida nos DOIS desfechos com `200`.** Recusado pelo provedor **também é `200`**,
com `aceito: false` — a recusa é resposta, não falha do serviço. Um `5xx` diria ao Admin que o sistema
quebrou, quando o fato é que a identidade não serve. Não alcançar a instituição, ou ela não concluir
no prazo, degrada do mesmo jeito.

**`detalhe` é um de cinco textos fixos**, e ele é preenchido **também no desfecho positivo**:

| Situação | O que `detalhe` diz, em resumo |
|---|---|
| aceite | a instituição aceitou o certificado. ⚠️ **Isto confirma a identidade da empresa perante ela; NÃO confirma que a emissão de cobrança já está habilitada** |
| recusa pelo par | a instituição não aceitou; confira se é o certificado que ela emitiu para esta empresa e se continua válido |
| indisponível | não foi possível alcançar a instituição; o certificado não chegou a ser apresentado |
| tempo esgotado | a conferência não concluiu no prazo; não confirma nem recusa |
| não iniciado | a verificação não chegou a começar; confira certificado e senha registrados |

<!-- fonte: packages/contracts/src/integracao-bancaria.ts → `DETALHES_DA_VERIFICACAO` -->

⚠️ **Exiba `detalhe` literalmente.** Ele foi escrito para o Admin ler, e a ressalva do aceite
(*"não confirma que a emissão já está habilitada"*) evita exatamente a leitura errada que faria o
Admin achar que terminou a configuração.

**Nada é gravado** por esta rota — a linha do certificado permanece como estava — e nada é
enfileirado. Empresa sem certificado: `404`, **sem que identidade alguma seja tentada**.

#### `POST /v1/integracoes-bancarias/identidade` — quem a empresa é perante o banco

**Corpo** (fechado, completo):

```json
{ "identificadorDaAplicacao": "…", "numeroDoCliente": 123456,
  "numeroDaContaCorrente": 98765, "codigoDaModalidade": 1 }
```

- `identificadorDaAplicacao`: 1 a **256** caracteres.
- Os três números são **inteiros positivos**.

**Resposta `201`:**

```json
{ "id": "uuid", "numeroDoCliente": 123456, "numeroDaContaCorrente": 98765,
  "codigoDaModalidade": 1,
  "registradoPor": { "id": "uuid", "nome": "Maria Souza" },
  "registradoEm": "…" }
```

⚠️ **`identificadorDaAplicacao` NÃO volta em resposta alguma.** Ele existe cifrado e é usado apenas na
composição do pedido de credencial ao provedor. A tela **não pode exibi-lo**, **não pode
pré-preenchê-lo** num formulário de edição, e **não pode compará-lo**. Para trocá-lo, o Admin digita
de novo.

**Registrar de novo SUBSTITUI**: a anterior fica no histórico e o identificador dela deixa de existir
no mesmo ato — por isso `201`, não `200`. `GET` sem identidade registrada: `404`.

⚠️ **Isto substitui as 12 chaves de `ConfiguracaoConta` do sistema antigo** (`provedor`, `ambiente`,
`authUrl`, `apiBaseUrl`, `clientId`, `scope`, `parametrosProvedor`, `ativo`…). **Endereços, escopo e
ambiente são configuração do SERVIDOR, não da empresa** — eles saíram da superfície. E **não existe
mais o par "config ativa + config pendente"** nem o retorno union
`sucesso`/`requer_decisao`/`cancelamento`/`erro`: registrar substitui, ponto.

#### As duas rotas da entrega da notícia (webhook) — §8

Elas têm seção própria, porque são o ponto do produto onde mais coisa pode dar certo de um jeito que
parece errado.

### 7.14 Confirmação de e-mail — 1 rota **pública**

#### `POST /v1/confirmacoes-de-email`
**Exige: NADA.** É a **única rota de negócio sem sessão** do produto.
**Corpo:** `{ "segredo": "<43 caracteres base64url>" }`
**Resposta `200`:** `{ "confirmado": true }`

⚠️ **O segredo viaja no CORPO, nunca no caminho nem na query string.** Isso é decisão de segurança: o
caminho e a consulta aparecem em log de servidor, em histórico de navegador e em `Referer`.

**O link que chega ao locatário é `<base-do-app>/confirmar-email#<segredo>`** — o segredo vai no
**fragmento**, que **não é enviado ao servidor** pelo navegador. A página lê `window.location.hash`,
tira o `#` e manda no corpo do `POST`.
<!-- fonte: packages/documentos/src/mensagem-de-confirmacao.ts → `CAMINHO_DA_PAGINA` e a composição do link -->

⚠️ **A página `/confirmar-email` é responsabilidade DESTE frontend, e ela vive FORA do shell
autenticado.** É rota pública do app: sem menu, sem sessão, sem redirect para login. Quem a abre é o
locatário, que **não é usuário do sistema**.

**Comportamento que a página precisa acertar:**

| Situação | Resposta | O que a página mostra |
|---|---|---|
| segredo válido | `200 { confirmado: true }` | "endereço confirmado" |
| **mesmo link, de novo, dentro das 72 h** | `200 { confirmado: true }` | o mesmo — e **nada é alterado**; o instante da confirmação não é reescrito |
| portador inválido, vencido **ou** já invalidado | `404`, **byte a byte igual nos três casos** | "link inválido ou expirado — peça um novo reenvio à imobiliária" |
| segredo malformado (≠ 43 caracteres base64url) | `422` | idem |

⚠️ **A repetição responder sucesso é deliberada**: impede que a pré-visualização de link feita pelo
provedor de e-mail queime o link antes do locatário clicar. **Não trate o segundo `200` como erro.**

⚠️ **A resposta NÃO diz qual dos três motivos causou o `404`.** Não invente diagnóstico na tela.

**Prazo: 72 horas.** Um reenvio (§7.7) **invalida todos os portadores anteriores** do locatário.

### 7.15 O que existe na superfície e **não** é rota de tela

| Rota | O que é | O frontend… |
|---|---|---|
| `POST /v1/notificacoes-bancarias` | **entrada do webhook do banco**, sem sessão | …**nunca chama**. Ver §8.4 |
| `GET /saude` · `GET /saude/pronto` | verificação de vida e de dependências | …pode usar `/saude` numa tela de diagnóstico, se quiser. `pronto` é do operador |
| `GET /docs` · `GET /docs/json` | documento OpenAPI | …usa em desenvolvimento, não em produção |
| 6 rotas sob `/v1/master` | Painel Master | …**não chama**. Outro aplicativo — §16 |

---

## 8. Habilitar webhook — a seção que decide a tela de Integrações bancárias

**O que é.** O provedor bancário (Sicoob) precisa saber para onde avisar este produto quando alguma
coisa acontece com um título — pagamento, estorno, divergência. Esse cadastro do canal de aviso é o
que a tela chama de *"Habilitar webhook"*, e o que a API chama de **entrega da notícia**.

**Por que ela é a mais delicada da superfície.** Porque o ato tem **quatro desfechos legítimos** e
**três deles não são erro** — e uma tela que trate tudo que não é "habilitada" como falha vai mentir
para o Admin.

### 8.1 As duas rotas

```
POST /v1/integracoes-bancarias/entrega-da-noticia/ativacao   { }   → 200
GET  /v1/integracoes-bancarias/entrega-da-noticia                  → 200
```

Ambas exigem `TELA:integracoes_bancarias` **+** `ACAO:configurar_integracao`.

**As duas devolvem o MESMO objeto:**

```json
{
  "habilitada": false,
  "situacao": "EM_VALIDACAO",
  "verificadaEm": "2026-03-15T10:07:00.000Z",
  "motivo": null
}
```

| Campo | Domínio |
|---|---|
| `habilitada` | `boolean` |
| `situacao` | `HABILITADA` · `EM_VALIDACAO` · `DESABILITADA` |
| `verificadaEm` | instante ISO, ou `null` se nunca se tentou |
| `motivo` | `null`, ou `{ codigo, mensagem, diagnostico }` — ver §8.3 |

<!-- fonte: packages/contracts/src/integracao-bancaria.ts → `ESTADOS_DA_ENTREGA`, `esquemaDoEstadoDaEntrega`, `esquemaDoMotivoDaRecusa` -->

### 8.2 As três pré-condições, e a recusa antes de qualquer chamada externa

A ativação **recusa antes de falar com o provedor** quando falta configuração. As três recusas são
`422 CAMPO_INVALIDO`, e o que as distingue é `detalhes`:

| Falta | `detalhes` | Mensagem |
|---|---|---|
| certificado nunca registrado | `{ "certificado": "AUSENTE" }` | "esta empresa não tem certificado registrado" |
| certificado **vencido** | `{ "validoAte": "2026-01-10T…Z" }` | "a validade do certificado apresentado já terminou" |
| identidade não registrada | `{ "identidade": "AUSENTE" }` | "esta empresa não tem identidade registrada no provedor" |

<!-- fonte: apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts → `exigirCertificadoVigente`, `exigirIdentidadeVigente` -->

⚠️ **A ORDEM DA TELA é: certificado → identidade → webhook.** O botão "Habilitar webhook" deve estar
**desabilitado**, com a razão escrita ao lado, enquanto `GET /certificado` responder `404` ou
`estado: "VENCIDO"`, ou `GET /identidade` responder `404`. Deixar o botão clicável para receber um
`422` funciona, mas é uma tela pior.

### 8.3 Os quatro desfechos da ativação — **todos com `200`**

**A recusa do provedor não é falha.** Ela sai com `200` e `habilitada: false`, com o `motivo`
preservado íntegro.

| # | Desfecho | Corpo | O que a tela diz |
|---|---|---|---|
| 1 | **Habilitada** | `habilitada: true`, `situacao: "HABILITADA"`, `motivo: null` | ✅ "Webhook habilitado" |
| 2 | **Em validação** | `habilitada: false`, `situacao: "EM_VALIDACAO"`, `motivo: null` | ⏳ "Cadastro aceito; o provedor está validando. Consulte de novo em alguns minutos" |
| 3 | **Recusada pelo provedor** | `habilitada: false`, `situacao: "DESABILITADA"`, `motivo: { … }` | ⚠️ o `motivo.mensagem`, exibido literalmente |
| 4 | **Provedor mudo** (fora do ar, ou sem concluir no prazo) | o **estado anterior**, inalterado | ⚠️ "não foi possível falar com o provedor agora; nada foi alterado" |

⚠️ **O desfecho 4 é o mais fácil de errar.** Quando o provedor não responde, **nada é gravado** e a
rota devolve **o estado que já estava lá**. Uma tela que compare "antes e depois" e não veja mudança
vai achar que o clique não funcionou. **A tela precisa distinguir o 4 dos demais**, e o jeito é
guardar o `verificadaEm` de antes do clique: se ele **não mudou**, foi o desfecho 4.

⚠️ **`EM_VALIDACAO` é desfecho normal e frequente**, não um estado transitório de segundos. O cadastro
foi aceito e o provedor ainda está validando. A tela oferece **"Consultar de novo"** (o `GET`), não
"tentar de novo" (o `POST`).

⚠️ **O desfecho 4 é só o caso em que NÃO HÁ NADA A REGISTRAR.** Quando a falha de comunicação vem
acompanhada de um motivo que o provedor conseguiu emitir, ela **é gravada** e o desfecho é o 3, com
`situacao: "DESABILITADA"` e o `motivo` preenchido. O 4 é o silêncio puro — e é por isso que ele não
altera o estado: gravar "desabilitada" porque a rede caiu apagaria uma habilitação que continua
válida no provedor.

**`motivo`, quando existe:**

```json
{ "codigo": "<código do provedor>", "mensagem": "<mensagem do provedor>",
  "diagnostico": { "campo": "valor", "…": "…" } }
```

- `codigo` e `mensagem` são **do provedor**, preservados como ele os emitiu — **não** são do
  vocabulário deste produto e **não** estão na lista da §3.1.
- `diagnostico` é um mapa livre (no máximo **32 chaves** / **8 192 caracteres**), ou `null`. Ele varia
  por recusa. **Renderize genericamente** — par nome/valor, ou um bloco `<pre>` —, nunca com campos
  fixos.

⚠️ **Exiba `motivo.mensagem` literalmente ao Admin.** É o que o banco disse, e é o que o suporte do
banco vai reconhecer se ele ligar para lá.

### 8.4 O que a ativação faz por baixo, e o que a tela pode prometer

A rota faz **duas coisas**: cadastra o canal junto ao provedor **e em seguida consulta** para
confirmar que o cadastro está de pé. **A entrega só fica habilitada com os dois positivos, e é a
consulta que decide** — cadastro recusado porque *"a vaga já está ocupada"*, com consulta positiva, é
**habilitada**.

Consequências que a tela precisa carregar:

1. **O ato é idempotente.** Repetir substitui o desfecho anterior, sem acumular histórico. Clicar
   duas vezes não estraga nada.
2. **Nada do cadastro de terceiro é alterado.** Se o canal já pertence a outra aplicação, o produto
   **não o altera nem o reativa**: ele tenta cadastrar o próprio, e quem decide é o provedor — cuja
   recusa chega como desfecho 3, com o motivo dele.
3. **NÃO EXISTE "desabilitar".** A operação não existe no provedor, e portanto não existe rota. **Não
   desenhe esse botão.** O que existe é reativar/corrigir por meio do mesmo `POST`.
4. **O `GET` não fala com o provedor.** Ele lê o estado persistido — é por isso que a recusa
   sobrevive à requisição em que aconteceu, e é por isso que consultar é barato.
5. **Empresa que nunca tentou** recebe `200` com `habilitada: false`, `situacao: "DESABILITADA"`,
   `verificadaEm: null` e `motivo: null` — **nunca `404`**. A ausência de tentativa é estado
   declarado, não recurso inexistente.

### 8.5 A tela de Integrações bancárias, inteira

```
┌─ Integrações bancárias ─────────────────────────────────────────────┐
│                                                                     │
│ 1. Certificado digital                          [ VIGENTE · 301 d ] │
│    Titular: IMOBILIARIA EXEMPLO LTDA:12345678000190                 │
│    Válido até 10/01/2027 · registrado por Maria Souza em 15/03/2026 │
│    [ Enviar novo certificado ]*        [ Verificar identidade ]     │
│                                                                     │
│ 2. Identidade no provedor                              [ registrada ]│
│    Cliente 123456 · conta 98765 · modalidade 1                      │
│    registrada por Maria Souza em 15/03/2026                         │
│    [ Registrar / substituir ]*                                      │
│                                                                     │
│ 3. Aviso do banco (webhook)                       [ EM VALIDAÇÃO ]  │
│    Última verificação: 15/03/2026 10:07                             │
│    [ Habilitar webhook ]*             [ Consultar de novo ]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
   * botões que exigem ACAO:configurar_integracao
```

**Regras de habilitação dos controles:**

| Controle | Habilitado quando |
|---|---|
| Enviar novo certificado | sempre (com a ação) |
| Verificar identidade | há certificado (mesmo vencido) |
| Registrar identidade | sempre (com a ação) |
| **Habilitar webhook** | há certificado **não vencido** **E** há identidade |
| Consultar de novo | sempre |

**O banner de topo**, por prioridade: certificado ausente > certificado vencido > identidade ausente >
webhook não habilitado > certificado `VENCENDO`.

---

## 9. Percursos completos

Cada percurso é uma sequência de chamadas reais, com os desfechos que a tela precisa tratar.

### 9.1 Primeiro acesso de uma pessoa da empresa

```
1. O Admin cria a pessoa:      POST /v1/usuarios          → 201 { usuarioId, senhaProvisoria }
   (a senha é exibida UMA vez; o Admin a entrega à pessoa por fora)
2. A pessoa entra:             POST /v1/auth/sign-in/email → 200
3. O app consulta a sessão:    GET  /v1/sessao             → senhaProvisoria: true
4. O app ROTEIA para a troca (não para o Dashboard)
5. A pessoa troca a senha:     POST /v1/sessao/senha       → 200 { trocada: true }
6. O app reconsulta:           GET  /v1/sessao             → senhaProvisoria: false, telas: [...]
7. O app monta o menu e entra
```

⚠️ **Entre os passos 3 e 5, qualquer outra chamada responde `403`.** Não pré-carregue dados nesse
intervalo.

### 9.2 Cadastrar um imóvel completo

```
1. POST /v1/conjuntos                     { nome }                    → 201  (se ainda não existe)
2. POST /v1/imoveis                       { conjuntoId, …, statusLocacao: "DISPONIVEL" } → 201
3. POST /v1/imoveis/:id/comodos           { nomeComodo, metragem }    → 201 Imóvel (metragemTotal já somada)
   … repetir por cômodo …
```

Recusas típicas: `identificadorMunicipal` repetido → `422` com `detalhes.conflito`; se for
`RETIRADO_DE_CIRCULACAO`, a saída é `POST /v1/imoveis/:id/recirculacao`, **não** criar outro.

### 9.3 Do rascunho ao contrato ativo com parcelas

```
1. POST /v1/locadores      → 201       (se ainda não existem)
   POST /v1/locatarios     → 201       (dispara o e-mail de confirmação sozinho)
   POST /v1/fiadores       → 201
2. POST /v1/contratos      { imovelId, locadorId, locatarioId, fiadoresIds, … } → 201 RASCUNHO
   (dataFimLocacao e valorTotalContrato vêm null — é esperado)
3. (opcional) PUT /v1/contratos/:codigo  → ajustes, só enquanto RASCUNHO
4. POST /v1/contratos/:codigo/ativacao   { } → 200
      Contrato ATIVO + efeitos.cobrancasGeradas: 30
      → o imóvel virou LOCADO
      → 30 cobranças de ALUGUEL nasceram, já visíveis em GET /v1/cobrancas?contrato=CTR-…
```

**Se o passo 4 recusar** com `detalhes.conflito: "IMOVEL_COM_CONTRATO_VIGENTE"`, mostre o
`detalhes.contratoVigente` e ofereça abrir aquele contrato.

### 9.4 Ciclo de vida de uma cobrança com boleto

```
1. (nasce na ativação, ou)  POST /v1/cobrancas  { contratoCodigo, natureza, … } → 201
2. POST /v1/cobrancas/:codigo/emissao-de-boleto  { } → 200
      linhaDigitavel, codigoDeBarras e numeroDoTituloNoProvedor preenchidos
3. GET  /v1/cobrancas/:codigo/boleto → PDF  (download)
4a. O locatário paga o boleto:
      → a conferência (automática às 03:00, ou POST /v1/cobranca-bancaria/conferencias)
        apura o crédito e a cobrança passa a PAGA, com dataDoCredito e valorCreditado
4b. O locatário paga fora do boleto:
      → POST /v1/cobrancas/:codigo/pagamento { pagoEm, valorPago } → 200 PAGA
5. GET  /v1/cobrancas/:codigo/historico-bancario → a trilha do que aconteceu
```

**Reemitir** (mudou o vencimento, mudou o valor): `POST /…/emissao-de-boleto` de novo — o servidor
revoga o anterior, espera a confirmação e emite o novo. **Uma chamada.**

**Cancelar a cobrança com boleto vivo**: são **dois atos**, nesta ordem:
`POST /…/revogacao-de-boleto` e depois `POST /…/cancelamento`.

### 9.5 Emissão em lote de uma competência

```
1. POST /v1/cobranca-bancaria/emissoes  { competencia: "2026-04-01" } → 201 EM_ANDAMENTO
2. GET  /v1/cobranca-bancaria/emissoes/:id   ← em intervalo (5 s, por exemplo)
      … enquanto estado === "EM_ANDAMENTO", a lista de itens cresce …
3. estado vira CONCLUIDA (ou INTERROMPIDA, com motivoDaInterrupcao)
      → a tela mostra emitidas / recusadas e a lista de recusas com o motivo de cada uma
```

⚠️ **`422` com `detalhes.loteEmCurso` significa que já há um lote acontecendo** — leve a tela para o
acompanhamento daquele, não mostre erro.

### 9.6 Confirmação de e-mail do locatário (fora do shell autenticado)

```
1. O locatário é criado (ou tem o e-mail alterado) → o produto dispara a mensagem sozinho
2. Ele clica no link:  https://<app>/confirmar-email#<43 caracteres>
3. A página lê window.location.hash, remove o '#'
4. POST /v1/confirmacoes-de-email  { segredo }  → 200 { confirmado: true }
5. A página mostra "endereço confirmado". Fim — não há login, não há redirect.

Se o Admin precisar reenviar:
   POST /v1/locatarios/:id/confirmacao-de-email  { } → 202 { reenviadoEm, expiraEm }
```

### 9.7 O que acontece sem ninguém clicar

Três rotinas rodam sozinhas, **por empresa**, e a tela as observa por
`GET /v1/automacao-de-cobranca/rotinas`:

| Rotina | Quando | Efeito visível na tela |
|---|---|---|
| `AVISO_DE_COBRANCA` | a cada minuto | linhas novas no histórico de avisos da cobrança |
| `ENCERRAMENTO_DE_CONTRATOS` | diária, 00:02 | contratos vencidos passam a `ENCERRADO`; o imóvel volta a `DISPONIVEL` |
| `CONFERENCIA_DE_LIQUIDACAO` | diária, 03:00 | cobranças passam a `PAGA`; `dataDoCredito`/`valorCreditado` preenchidos; trilha ganha itens |

⚠️ **O encerramento só devolve `LOCADO → DISPONIVEL`.** Um imóvel `INDISPONIVEL` tem o contrato
encerrado normalmente e a situação **preservada** — `INDISPONIVEL` é decisão deliberada do Admin, e a
rotina não a apaga.
<!-- fonte: packages/db/src/encerramento-de-contratos.ts → "Só `LOCADO → DISPONIVEL`" -->

⚠️ **Nenhuma rotina "marca cobrança como vencida" nem "atualiza atrasos".** As duas do sistema antigo
que faziam isso **não têm sucessora, e isso é desenho**: o estado é derivado na leitura.

---

## 10. Mapa endpoint-a-endpoint: ERPNext antigo → API nova

**Como ler.** A coluna da esquerda traz os caminhos do inventário do frontend atual
(`levantamento-frontend.md` §2 — 62 call-sites, **35 caminhos distintos**). A da direita traz a rota
nova, ou a razão de não haver uma. Vários call-sites compartilham caminho (o `putDoctype` universal
sozinho atende cinco DocTypes), por isso há mais linhas aqui do que 35.

⚠️ **Uma linha marcada "não existe" não é lacuna do backend** — é decisão registrada. A razão está
sempre escrita.

### 10.1 Autenticação

| Antes | Agora |
|---|---|
| `POST method/auth_locacao_imoveis` | **`POST /v1/auth/sign-in/email`** — agora emite **sessão real por cookie**, não `{success, nome, usuario}` |
| `POST method/…verificar_senha_usuario_app` (reconfirmação de senha para `/usuarios`) | **não existe** — a proteção da área de usuários é `TELA:usuarios` no servidor (§5), não uma reconfirmação client-side gravada em `sessionStorage` |
| `Authorization: token apiKey:apiSecret` no bundle | **não existe** — some a credencial de serviço embutida; a sessão é por cookie `httpOnly` |
| — | **novo:** `POST /v1/auth/two-factor/enable`, `POST /v1/auth/two-factor/verify-totp`, `POST /v1/auth/sign-out`, `GET /v1/sessao`, `POST /v1/sessao/senha` |

### 10.2 Usuários

| Antes | Agora |
|---|---|
| `GET resource/Usuario` | **`GET /v1/usuarios`** — campos `{ usuarioId, nome, email, perfil, ativo }` |
| `POST resource/Usuario` `{nome, usuario, senha}` | **`POST /v1/usuarios`** `{nome, email, perfil}` — ⚠️ **a senha NÃO é escolhida por quem cria**: o servidor devolve uma provisória |
| `PUT resource/Usuario/{name}` (senha omitida se vazia) | **quatro rotas distintas**: `…/perfil`, `…/permissoes`, `…/desativacao`, `…/reativacao`. Nome e e-mail **não são editáveis** |
| `DELETE resource/Usuario/{name}` | **`POST /v1/usuarios/:id/desativacao`** — ⚠️ **pessoa não se apaga**; desativa-se, e a reativação devolve tudo |
| — | **novo:** `POST /v1/usuarios/:id/senha-provisoria` (reemissão) |
| — | **novo:** o conceito de **perfil** e **permissão** (§5) — não havia equivalente |

### 10.3 Imóveis, conjuntos e cômodos

| Antes | Agora |
|---|---|
| `GET method/all_imoveis` (agregador `{conjuntos:[{…, imoveis:[{…, comodos}]}]}`) | **`GET /v1/conjuntos?expandir=imoveis`** — mesma árvore, uma consulta, com `metragemTotal` e `contratoVigente` já resolvidos |
| `GET resource/Conjunto?fields=[…]&order_by=…` | **`GET /v1/conjuntos`** — sem `fields`, sem `order_by` |
| `POST resource/Conjunto` | **`POST /v1/conjuntos`** |
| `POST resource/Imovel` (+ `exc_type === 'UniqueValidationError'`) | **`POST /v1/imoveis`** — a colisão vem como `422` com `campo` e `detalhes.conflito`; **delete o tratamento por `exc_type`** |
| `PUT resource/{doctype}/{name}` — **`putDoctype` universal** | **quatro rotas tipadas**: `PUT /v1/conjuntos/:id`, `PUT /v1/imoveis/:id`, `PUT /v1/{locadores\|locatarios\|fiadores}/:id`. ⚠️ Corpo **completo**, nunca uma chave só |
| `PUT method/atualizar_comodo` `{imovel_name, comodo_name, …}` | **`PUT /v1/imoveis/:id/comodos/:comodoId`** — devolve o **imóvel inteiro** com `metragemTotal` recalculada |
| — | **novo:** `POST` e `DELETE` de cômodo (antes o cômodo só era editável) |
| — | **novo:** `POST /v1/imoveis/:id/situacao-de-locacao` — a situação saiu do corpo do `PUT` |
| — | **novo:** retirada/recirculação de conjunto e imóvel |

### 10.4 Contratos

| Antes | Agora |
|---|---|
| `GET resource/Contrato` (paginado 500, `CONTRATO_FIELDS` com `docstatus`) | **`GET /v1/contratos`** — teto de página **200**; `docstatus` **não existe** |
| `GET resource/{Imovel\|Locador\|Locatario}` — **join manual N+1** (`mapByName`) | **não existe, e é ganho**: `GET /v1/imoveis/:id` já traz `contratoVigente.locatario.nome`; o contrato traz `fiadores[].nome`. **Delete `mapByName` e `fetchByIds`** |
| `POST resource/Contrato` (com `docstatus`, `fiadores:[{fiador}]`) | **`POST /v1/contratos`** — `fiadoresIds: ["uuid"]`, sem `docstatus` |
| `GET resource/Contrato/{name}` (doc inteiro, só para o submit) | **não é mais necessário** |
| `POST method/frappe.client.submit` `{doc: JSON.stringify(fullDoc)}` | **`POST /v1/contratos/:codigo/ativacao`** `{}` — ⚠️ **três requisições viraram uma**, e ela devolve `efeitos.cobrancasGeradas` |
| `GET resource/Contrato/{name}` (ler child table `fiadores`) + `GET resource/Fiador` | **não existe** — `fiadores` já vem com `{ id, nome }` |
| `POST method/…cancelar_contrato` `{name}` | **`POST /v1/contratos/:codigo/cancelamento`** `{}` — agora **cancela as cobranças em cascata** no mesmo commit |
| `GET resource/Cobranca` (cobranças a vencer para o carnê, refiltrado no cliente) | **`GET /v1/contratos/:codigo/carne?de=&ate=`** — o servidor monta o **PDF único** |
| `GET resource/Cobranca` (detecção de duplicidade antes de gerar parcelas) | **não existe** — as parcelas nascem **na ativação**, num commit só; não há o que deduplicar |
| `POST resource/Cobranca` (parcelas manuais, com `doctype:'Cobranca'`) | **`POST /v1/cobrancas`** — para cobrança **avulsa**; as de aluguel são automáticas |
| `POST method/…emitir_boleto_sicoob` `{cobranca_id}` | **`POST /v1/cobrancas/:codigo/emissao-de-boleto`** `{}` |
| `GET method/…abrir_contrato?contrato={name}` (PDF) | **`GET /v1/contratos/:codigo/documento`** |
| — | **novo:** `PUT /v1/contratos/:codigo` (alterar rascunho), retirada e recirculação |

### 10.5 Financeiro / Cobranças

| Antes | Agora |
|---|---|
| `GET resource/Cobranca` (paginado, **26 campos**) | **`GET /v1/cobrancas`** — 22 campos, com os 5 derivados prontos |
| `GET resource/Locatario` em chunks de 200 (**join manual**) | **não existe** — a cobrança traz `locatarioId`; nome e contato vêm de `GET /v1/locatarios/:id` quando a tela precisar |
| `GET resource/Contrato` / `resource/Imovel` / `resource/Conjunto` em chunks (**3 joins manuais**) | **não existem** — ⚠️ os **5 a 9 round-trips por carregamento da tela Financeiro** somem |
| `GET resource/Cobranca` (janela de datas, KPIs do Dashboard) | **`GET /v1/cobrancas?status=…`** — ⚠️ **não há filtro por data no servidor**; recorte por período é do cliente, sobre a página |
| `POST method/automacao_cobranca_config_api` `{acao:'get'}` | **`GET /v1/automacao-de-cobranca`** |
| `POST method/automacao_cobranca_config_api` `{acao:'save', ativo, a_vencer{…}, vencida{…}}` | **`PUT /v1/automacao-de-cobranca`** — ⚠️ **uma** política, não dois blocos |
| `POST method/…enviar_cobranca_email_manual` `{fatura_id}` | **`POST /v1/automacao-de-cobranca/cobrancas/:codigo/avisos`** `{}` |
| `GET resource/Log Envio Cobranca` (DocType com espaços no nome) | **`GET /v1/automacao-de-cobranca/cobrancas/:codigo/avisos`** — ⚠️ **por cobrança**, não global |
| `GET resource/Cobranca/{id}` (estado antes de regerar boleto) | **não é mais necessário** — a reemissão é atômica no servidor |
| `POST method/…solicitar_baixa_boleto_sicoob` `{cobranca_id}` | **`POST /v1/cobrancas/:codigo/revogacao-de-boleto`** `{}` |
| `PUT resource/Cobranca/{id}` `{status_cobranca:'Cancelada'}` | **`POST /v1/cobrancas/:codigo/cancelamento`** `{}` — status **não é escrito pelo cliente** |
| `POST resource/Cobranca` (substituta) | **`POST /v1/cobrancas`** — ⚠️ código novo, **sem vínculo publicado** com a cancelada |
| `PUT resource/Cobranca/{id}` (acusar pagamento — **zerava 6 campos de conciliação**) | **`POST /v1/cobrancas/:codigo/pagamento`** `{pagoEm, valorPago}` — ⚠️ **os 6 campos NÃO são mais zerados** (divergência declarada) |
| `POST resource/Cobranca` (novo título: água/condomínio/energia…) | **`POST /v1/cobrancas`** com `natureza` — ⚠️ discriminada por **enum**, nunca pelo texto de `referencia` |
| `GET method/…abrir_boleto?cobranca={name}` | **`GET /v1/cobrancas/:codigo/boleto`** |
| — | **novo:** `GET /v1/cobrancas/:codigo/historico-bancario` |
| — | **novo:** emissão em lote (`/v1/cobranca-bancaria/emissoes`) e conferência (`/v1/cobranca-bancaria/conferencias`) |

### 10.6 Pessoas

| Antes | Agora |
|---|---|
| `GET resource/Locatario` (**33 campos**) · `POST resource/Locatario` | **`GET`/`POST /v1/locatarios`** — 15 campos + `emailConfirmadoEm`. ⚠️ **os 17 campos de máquina de e-mail/WhatsApp somem** |
| `GET resource/Locatario` para resolver o `name` do recém-criado | **não existe** — o `POST` devolve o recurso com `id` |
| `POST method/…enviar_confirmacao_email_locatario` `{locatario}` | **`POST /v1/locatarios/:id/confirmacao-de-email`** `{}` → `202`. ⚠️ E o **primeiro** envio é automático na criação |
| `GET/POST resource/Locador` (15 campos) | **`GET`/`POST /v1/locadores`** |
| `GET/POST resource/Fiador` (15 campos, **sem `limit_page_length`** — pegava 20) | **`GET`/`POST /v1/fiadores`** — padrão **50**, teto **200**, e `total` no envelope |
| `PUT resource/{Fiador\|Locatario\|Locador}/{name}` via `putDoctype` | **`PUT /v1/{…}/:id`** com corpo **completo** |
| `PUT resource/Locatario/{name}` — **reset da máquina de e-mail, 9 colunas escritas pelo frontend** | **`POST /v1/locatarios/:id/confirmacao-de-email`** — ⚠️ **operação de domínio que estava na UI voltou para o servidor**; o hook React some inteiro |
| `ativo: 0 \| 1` | **`retiradoEm: string \| null`** — e retirar/recircular são rotas próprias |

### 10.7 Configuração de atraso

| Antes | Agora |
|---|---|
| `GET resource/Atraso/Atraso` (Single global) | **`GET /v1/multa-e-juros`** — **por empresa**; sem configuração devolve zeros, nunca `404` |
| `PUT resource/Atraso/Atraso` `{multa, juros}` | **`PUT /v1/multa-e-juros`** `{multaPercentual, jurosPercentual}` |

### 10.8 Integração Sicoob — a área que mais mudou

| Antes (`…integracao_bancaria_api.service`) | Agora |
|---|---|
| `GET .obter_configuracao` → `{success, configuracao{12 chaves}, certificado{8 chaves}, pendente?}` | **duas rotas**: `GET /v1/integracoes-bancarias/certificado` e `GET /v1/integracoes-bancarias/identidade`. ⚠️ **`pendente` não existe** — não há mais "config pendente" |
| `POST .salvar_configuracao` (payload **parcial**; retorno union `sucesso`/`requer_decisao`/`cancelamento`/`erro`) | **`POST /v1/integracoes-bancarias/identidade`** — corpo **completo**, resposta `201` com o recurso. ⚠️ **A union some**: `requer_decisao` e `cancelamento` não existem |
| `POST .enviar_certificado` `{arquivo_base64, senha, nome_arquivo?}` | **`POST /v1/integracoes-bancarias/certificados`** `{material, senha}` — ⚠️ **`nome_arquivo` não é aceito** |
| `POST .testar_conexao` (em sucesso, **o backend ativava a config**) | **`POST /v1/integracoes-bancarias/certificado/verificacao`** `{}` — ⚠️ **NADA é gravado**; é sonda pura. Não existe mais "ativar por teste" |
| `POST .remover_certificado` | **não existe** — o certificado se **substitui** registrando outro. Não há empresa sem certificado depois de ter tido um |
| `GET .apurar_boletos_abertos` → `{total, identificadores[]}` | **`GET /v1/cobrancas?status=A_VENCER`** (e `VENCIDA`) — a pergunta virou um recorte da carteira |
| `GET .resumir_consolidado_boletos_abertos` (operação **cara**) | **não existe** — o carnê por contrato (`GET /v1/contratos/:codigo/carne`) resolve o caso de uso real |
| `GET .baixar_consolidado_boletos_abertos` (binário, falha por **status HTTP** sem envelope) | **`GET /v1/contratos/:codigo/carne?de=&ate=`** — recorte por competência, teto de 12, envelope de erro canônico |
| `GET .verificar_saude_integracao` (403 → `sem_permissao`) | **`GET /v1/integracoes-bancarias/entrega-da-noticia`** + `GET …/certificado` — a "saúde" virou **três estados observáveis** (§8) |
| `classificarErro` por **prefixo do texto da mensagem**; `extrairCampoInvalido` por **regex sobre `"O campo 'X'"`** | **`codigo` + `campo` estruturados** (§3). ⚠️ **Delete as duas funções** |
| símbolos `requer_decisao`, `cancelado_pelo_gestor`, `certificado_ilegivel`, `sem_config_ativa`, `campo_invalido`, `certificado_invalido`, `decisao_invalida`, `sem_certificado_proprio`, `desconhecido` | **os 11 códigos da §3.1**. O mais próximo de `certificado_ilegivel` é `MATERIAL_EM_FORMATO_NAO_SUPORTADO`; de `campo_invalido`, `CAMPO_INVALIDO`. Os demais **não têm sucessor** porque o conceito sumiu |
| — | **novo:** `POST /v1/integracoes-bancarias/entrega-da-noticia/ativacao` e `GET …/entrega-da-noticia` (§8) |

### 10.9 Externo

| Antes | Agora |
|---|---|
| `GET https://viacep.com.br/ws/{cep}/json/` | **inalterado** — é chamada direta do navegador, não passa por este backend |

### 10.10 Chamadas montadas dinamicamente — as três somem

| Antes | Agora |
|---|---|
| `apiRequest('resource/${resource}', {query:{limit_page_length, limit_start}})` | **`?limite=&deslocamento=`** em cada rota tipada |
| `putDoctype(doctype, name, body)` — chamado com 5 DocTypes | **rotas tipadas por recurso**, corpo completo |
| `mapByName(resource, labelField, ids)` | **não existe** — o servidor já devolve os rótulos |

---

## 11. O que mudou de comportamento — e por quê

Estas mudanças **não acrescentam endpoint**. Ignorá-las produz um frontend que compila e está errado.

1. **Envelope de erro único.** `{ codigo, mensagem, campo?, detalhes? }` sobre HTTP semântico.
   Classifique pelo `codigo`. Some o `_server_messages`, o `{data}`/`{message}` e o `exc_type`. (§3)

2. **Sessão gorda com `versaoPermissoes`.** O menu vem da sessão; a versão diz quando ele está velho.
   Não existia. (§5)

3. **Duas restrições de sessão.** `senhaProvisoria` e `segundoFatorPendente` bloqueiam tudo com `403`
   até serem resolvidas. **A entrada é fluxo condicional, não uma tela.** (§4)

4. **O `docstatus` acabou.** Quem diz o estado do contrato é `status`, com quatro valores. Some
   `contratoStatusFromDocstatus` e a dupla fonte que quatro telas consumiam.

5. **Estado da cobrança é derivado, nunca movido.** Não existe "marcar como paga": grava-se o
   pagamento, e o estado é consequência. Some `normalizeStatus`. (§7.9)

6. **Identificadores legíveis com larguras diferentes**: contrato **5** dígitos, cobrança **7**.
   Ajuste largura de campo, rótulo e busca. (§6.7)

7. **Boleto, carnê e documento do contrato são rotas de BYTES**, com mídia e nome de arquivo
   declarados. O frontend faz download; não renderiza JSON. (§6.2)

8. **Confirmação de e-mail é fluxo sem sessão**, por portador de uso único, numa **página pública do
   próprio app** (`/confirmar-email#<segredo>`). (§7.14)

9. **O modelo é camelCase em português.** Os ~36 mapeadores, o `toInt`, o `toDouble`, o `isTruthy` e
   o `parseLocalDate` **deixam de existir**. Os tipos `*RequestJson` e as funções `to*RequestJson`
   são **deletados**.

10. **Sem cadastro público.** Pessoas nascem por ato do Master ou do Admin, com senha provisória
    entregue uma única vez.

11. **Não há transação distribuída na UI.** O `regerarBoleto` de 6 chamadas, o
    `cancelarCobrancaComBaixa` que engolia erro, e o `{baixaSolicitada, baixaErro}` que a tela tinha
    de interpretar: **todos substituídos por um ato atômico no servidor**. Se um passo falha, o
    servidor desfaz — o frontend não faz rollback de nada.

12. **Os joins acabaram.** O servidor devolve os rótulos. A tela Financeiro deixa de fazer 5 a 9
    round-trips por carregamento.

13. **Multa e juros são por empresa**, não globais, e **nenhuma cobrança é reescrita** quando a
    política muda: o que está em aberto reflete na leitura seguinte; o que foi pago mantém o carimbo.

14. **A régua de cobrança é uma só**, com `canal: "EMAIL"`. **WhatsApp não foi portado.**

15. **O log de envio é por cobrança**, não uma listagem global.

16. **A conciliação bancária deixou de ser zerada no pagamento manual.** Os seis campos são fato do
    banco; o ato do operador não os apaga.

17. **Três rotinas rodam sozinhas** e a tela pode observá-las (`/rotinas`), com impedimento acionável.
    Não existia. (§7.11)

---

## 12. O que NÃO existe — e não adianta procurar

**Na superfície:**

- **Excluir** empresa, pessoa, imóvel, conjunto, cadastro, contrato ou cobrança. O que existe é
  retirar de circulação (reversível) e desativar. **A exceção é o cômodo.**
- **Encerrar contrato pela tela.** `ENCERRADO` é produzido por rotina. (§7.8)
- **Desabilitar o webhook.** A operação não existe no provedor. (§8.4)
- **Remover certificado.** Substitui-se registrando outro. (§10.8)
- **Editar nome ou e-mail de uma pessoa da empresa.** Só perfil, permissões e estado.
- **Recuperação de senha por e-mail** para usuários do sistema. O caminho é a reemissão pelo Admin.
- **Cadastro público / auto-registro.**
- **WhatsApp**, em qualquer forma.
- **Filtro por data, por locatário, por conjunto** no servidor. Os recortes publicados são os da §7.9.
- **Ordenação declarável.** Cada listagem tem ordem fixa, documentada na §7.
- **Busca textual** em qualquer listagem.
- **Relatórios.** Existe a área `TELA:relatorios` no catálogo, e **nenhuma rota sob ela** — o que a
  tela de relatórios consome são as listagens existentes.
- **Notificação por push, websocket ou SSE.** O acompanhamento de lote e de conferência é por
  consulta em intervalo. (§9.5)
- **Upload `multipart/form-data`.** O único arquivo que entra é o certificado, em base64 no JSON.
- **Endpoint de "dashboard" ou "KPI".** Os números saem das listagens.

**No comportamento:**

- **`exc_type`, `_server_messages`, `{data}`, `{message}`, `docstatus`.**
- **Query DSL** (`fields`, `filters`, `order_by`, `limit_page_length`, `limit_start`).
- **Token de API no bundle.**
- **Config bancária "pendente"** e a union `requer_decisao`/`cancelamento`.
- **Classificação de erro por texto.**

---

## 13. Telas, menu e permissões

### 13.1 O menu é uma função da sessão

```
menu = AREAS.filter(area => sessao.telas.includes(area.chave))
```

Nada de lista fixa; nada de `if (perfil === 'admin')`. **Remonte quando `versaoPermissoes` mudar.**

### 13.2 Mapa área → tela → rotas

| Área (`TELA:`) | Tela | Rotas que ela consome |
|---|---|---|
| `resumo` | Resumo / Dashboard | ⚠️ **nenhuma rota própria.** Ela compõe do que a pessoa alcança. Para quem só tem `TELA:resumo`, ela precisa **funcionar sem dado nenhum de negócio** |
| `imoveis` | Imóveis, Conjuntos, Cômodos | §7.3, §7.4, §7.5 |
| `contratos` | Contratos, documento, carnê | §7.8 |
| `cadastros` | Locadores, Locatários, Fiadores | §7.6, §7.7 |
| `financeiro` | Cobranças, boletos, emissão em lote, conferência | §7.9, §7.12 |
| `automacao_de_cobranca` | Régua de cobrança, avisos, rotinas | §7.11 |
| `integracoes_bancarias` | Integrações bancárias | §7.13, §8 |
| `multa_e_juros` | Multa e juros | §7.10 |
| `relatorios` | Relatórios | ⚠️ **sem rota própria** — consome as listagens que a pessoa alcança |
| `usuarios` | Pessoas e permissões | §7.2 |

⚠️ **`TELA:resumo` e `TELA:relatorios` não governam rota alguma.** Elas governam **a existência da
tela**, e o conteúdo vem do que a pessoa alcança por outras chaves. Uma pessoa com
`TELA:resumo` + `TELA:relatorios` e mais nada verá as duas telas **vazias** — e isso é correto.

### 13.3 Ações sensíveis → controles

| Ação | Controles que ela habilita |
|---|---|
| `ACAO:ativar_contrato` | botão **Ativar** na ficha do contrato em `RASCUNHO` |
| `ACAO:cancelar_contrato` | botão **Cancelar** na ficha do contrato `ATIVO` |
| `ACAO:excluir_cadastro` | **Retirar/Recircular** em imóvel, conjunto, locador, locatário, fiador **e contrato** |
| `ACAO:emitir_boleto` | **Emitir boleto**, **Reemitir**, **Abrir emissão em lote** |
| `ACAO:solicitar_baixa_de_boleto` | **Revogar boleto** |
| `ACAO:enviar_cobranca_manual` | **Enviar aviso agora** |
| `ACAO:configurar_integracao` | **Enviar certificado**, **Registrar identidade**, **Habilitar webhook** |

**Regra de ouro:** um controle cuja rota exige `ÁREA + AÇÃO` só aparece quando a sessão tem **as
duas**. Se aparecer sem, o usuário toma `403` — e o menu mentiu.

### 13.4 Telas novas, que não existiam

| Tela | Por quê |
|---|---|
| **Entrada com fluxo condicional** | senha provisória e segundo fator (§4) |
| **Troca de senha obrigatória** | com as quatro regras da política (§7.1) |
| **Configuração do segundo fator** | QR Code + códigos de recuperação (§4.4) |
| **Pessoas e permissões** | matriz de 17 chaves, com concessão e negação (§7.2) |
| **Integrações bancárias** | certificado, identidade, webhook (§8.5) |
| **Emissão em lote** | abrir + acompanhar (§9.5) |
| **Rotinas agendadas** | estado, atraso e impedimento (§7.11) |
| **Multa e juros** | por empresa (§7.10) |
| **`/confirmar-email` (pública)** | fora do shell autenticado (§7.14) |
| **Histórico bancário da cobrança** | a trilha de efeitos (§7.9) |

---

## 14. Pendências do backend que afetam o frontend

**Nenhuma delas é bug, e nenhuma se resolve no frontend.** Estão aqui para que ninguém perca tempo
depurando o que é do servidor.

### 14.1 ⚠️ Hoje a API não aceita chamada de outra origem

O servidor **não publica CORS** — não há `@fastify/cors`, `enableCors` nem cabeçalho
`Access-Control-*` em `apps/api/src` —, e a lista de origens confiáveis do arcabouço de identidade é
só o endereço de escuta local. Duas consequências, nesta ordem:

1. o navegador barra a chamada na pré-checagem, por ausência de
   `Access-Control-Allow-Origin`/`Allow-Credentials`;
2. e, ainda que passasse, `/v1/auth/*` recusa o `Origin` que não está na lista.

**É pendência conhecida, com dono e gatilho**: o débito `D23 · F1/T8`, cujo gatilho é a publicação
atrás do servidor de borda (F7). Enquanto ela não fecha, **o app só funciona servido na mesma origem
da API** — proxy reverso no próprio domínio, ou proxy do servidor de desenvolvimento.
`credentials: 'include'` continua obrigatório em qualquer arranjo.

⚠️ **`SameSite=Lax` aperta mais um grau**: mesmo com CORS liberado, o cookie **não** viaja para outro
*site*. App e API precisam ficar sob o mesmo domínio registrável, ou o cookie teria de virar
`SameSite=None` — mudança **no servidor**, não no frontend.

**O que isso significa na prática para o desenvolvimento:** configure o proxy do servidor de
desenvolvimento (`/v1/*` → endereço da API) e chame caminhos relativos. **Não fixe o endereço da API
no código.**

### 14.2 `/docs` atende sem sessão

O documento OpenAPI é público enquanto a API é local (débito `D24 · F1/T5`, mesmo gatilho da F7).
Não construa nada que dependa disso em produção.

### 14.3 O `429` não traz `Retry-After`

§3.4. Se a tela quiser sugerir espera, o número é do frontend.

### 14.4 O que **não** é pendência, e parece

| Parece pendência | É decisão |
|---|---|
| "faltou o endpoint de encerrar contrato" | §7.8 — não há chave no catálogo para o ato |
| "faltou desabilitar webhook" | §8.4 — não existe no provedor |
| "faltou remover certificado" | §10.8 — substitui-se |
| "faltou filtro por data nas cobranças" | §7.9 — o recorte publicado é o da rota |
| "faltou rota de relatórios" | §13.2 — a área não governa rota |
| "o `403` não diz que a sessão está restrita" | §4.3 — o caminho é reler `GET /v1/sessao` |

---

## 15. Checklist de aceitação do frontend

O app **reflete o backend** quando todos estes itens forem verdadeiros. Cada um é verificável.

**Transporte e erro**

- [ ] Todas as chamadas usam `credentials: 'include'` e caminho relativo sob `/v1`.
- [ ] O cliente HTTP **não** injeta `Authorization`.
- [ ] O parser de `_server_messages`, os helpers de envelope `{data}`/`{message}` e o tratamento por
      `exc_type` foram **deletados**.
- [ ] Todo erro é classificado por `codigo`; **nenhuma** decisão de fluxo lê `mensagem`.
- [ ] `401 NAO_AUTENTICADO` leva à tela de entrada; `401 CREDENCIAL_INVALIDA` mostra
      *"não foi possível entrar"*, sem diagnóstico inventado.
- [ ] `429` é tratado sem esperar `Retry-After`.

**Sessão e permissão**

- [ ] Após entrar, o app **sempre** chama `GET /v1/sessao` antes de rotear.
- [ ] `twoFactorRedirect: true` leva à verificação TOTP, não ao Dashboard.
- [ ] `senhaProvisoria: true` e `segundoFatorPendente: true` roteiam para a resolução, e o app **não**
      pré-carrega dados nesse estado.
- [ ] Ao receber `403`, o app refaz `GET /v1/sessao` e decide pelas bandeiras — nunca pelo texto.
- [ ] O menu é derivado de `sessao.telas`; os controles sensíveis, de `sessao.acoes` **com a área
      correspondente**.
- [ ] `versaoPermissoes` é guardada e o menu é remontado quando ela muda.
- [ ] Um `SYSLOC_MASTER` que entre neste app vê uma página explicativa, não um menu vazio nem um erro.

**Contrato**

- [ ] Nenhum corpo carrega `empresaId`, `status`, `docstatus`, `posicao`, `metragemTotal`,
      `locatarioId` ou qualquer campo derivado.
- [ ] Todo `PUT` manda o objeto **completo**.
- [ ] Nenhuma query string carrega parâmetro fora do documentado na §7.
- [ ] Os códigos legíveis são exibidos e buscados com as larguras corretas (**5** e **7** dígitos).
- [ ] Datas de negócio vêm do servidor; o app **não** calcula vencimento nem atraso.

**Fluxos**

- [ ] Criar contrato é **um** `POST`; ativar é **um** `POST` sem corpo.
- [ ] A tela lê `efeitos.cobrancasGeradas` e informa quantas parcelas nasceram.
- [ ] Reemitir boleto é **uma** chamada; não há encadeamento de 6 no cliente.
- [ ] Cancelar cobrança e revogar boleto são **dois** atos distintos na interface.
- [ ] O `422` de repetição (`detalhes.estadoAtual`) releva o recurso, não repete a chamada.
- [ ] A emissão em lote é acompanhada por consulta em intervalo, e o `422` com `detalhes.loteEmCurso`
      leva ao acompanhamento do lote existente.
- [ ] O disparo de conferência com `iniciadaAgora: false` mostra "já em andamento", não erro.
- [ ] O aviso manual com `200` e `desfecho: "FALHOU"` é apresentado como **falha de entrega**.
- [ ] A página pública `/confirmar-email` existe, lê o **fragmento** da URL, e trata o segundo `200`
      como sucesso.

**Integrações bancárias**

- [ ] Os três códigos de recusa do certificado produzem **três mensagens distintas** na tela.
- [ ] `estado: "VENCENDO"` gera aviso; `VENCIDO` não impede a consulta.
- [ ] `identificadorDaAplicacao` **nunca** é exibido nem pré-preenchido.
- [ ] O botão "Habilitar webhook" só habilita com certificado não vencido **e** identidade.
- [ ] Os **quatro** desfechos da ativação são distinguidos, inclusive o "provedor mudo" (comparando
      `verificadaEm`).
- [ ] `motivo.mensagem` é exibida literalmente; `motivo.diagnostico` é renderizado genericamente.
- [ ] **Não existe** botão de desabilitar webhook nem de remover certificado.

**Higiene**

- [ ] Os ~36 mapeadores, `mapByName`, `fetchByIds`, `fetchResourcePages`, `putDoctype`,
      `normalizeStatus`, `contratoStatusFromDocstatus`, `parseLocalDate`, `isTruthy`, `toInt`,
      `toDouble` e os tipos `*RequestJson` **não existem mais no código**.
- [ ] Nenhuma senha, senha provisória ou segredo de confirmação é persistido no cliente.
- [ ] Nenhuma variável de build carrega segredo.

---

## 16. O Painel Master — mencionado, não coberto

O SaaS tem um **segundo aplicativo**, o **Painel Master**, usado pelo operador do Sysloc para criar
empresas, admitir o primeiro administrador de cada uma, suspender e reativar empresas e reemitir
senha provisória de administrador.

**Três fatos, e nada além disso:**

1. Ele é **aplicativo separado**, com domínio (`syslocadmin.systera.com.br`) e build próprios.
   **Não é tela do Sysloc**, e nada dele entra neste app.
2. O backend dele está **completo**: são 6 rotas sob `/v1/master`, e este app **não chama nenhuma**.
3. Ele tem **handoff próprio, já gerado**: `docs/plano-backend-novo/handoff-master-frontend.md`.
   Quem for implementá-lo lê aquele documento, não este.

⚠️ **Não misture as telas, não replique as rotas do Master aqui, e não tente detectar "modo
administrador" neste app.** A separação é de aplicativo, não de permissão.

---

## 17. Referência rápida — a superfície em uma página

```
IDENTIDADE (§4)
  POST   /v1/auth/sign-in/email                          { email, password }
  POST   /v1/auth/two-factor/enable                      { password }
  POST   /v1/auth/two-factor/verify-totp                 { code }
  POST   /v1/auth/sign-out
  (POST  /v1/auth/two-factor/verify-backup-code          { code }   — tolerada, autorizada)

SESSÃO (§7.1)                                            exige
  GET    /v1/sessao                                      sessão (alcança restrita)
  POST   /v1/sessao/senha                                sessão (alcança restrita)

PESSOAS DA EMPRESA (§7.2)                                TELA:usuarios
  POST   /v1/usuarios
  GET    /v1/usuarios
  POST   /v1/usuarios/:id/permissoes
  POST   /v1/usuarios/:id/perfil
  POST   /v1/usuarios/:id/desativacao
  POST   /v1/usuarios/:id/reativacao
  POST   /v1/usuarios/:id/senha-provisoria

CONJUNTOS (§7.3)                                         TELA:imoveis
  POST   /v1/conjuntos
  GET    /v1/conjuntos            ?expandir=imoveis&incluirRetirados=&limite=&deslocamento=
  GET    /v1/conjuntos/:id
  PUT    /v1/conjuntos/:id
  POST   /v1/conjuntos/:id/retirada                      + ACAO:excluir_cadastro
  POST   /v1/conjuntos/:id/recirculacao                  + ACAO:excluir_cadastro

IMÓVEIS (§7.4)                                           TELA:imoveis
  POST   /v1/imoveis
  GET    /v1/imoveis              ?incluirRetirados=&limite=&deslocamento=
  GET    /v1/imoveis/:id
  PUT    /v1/imoveis/:id
  POST   /v1/imoveis/:id/situacao-de-locacao             { statusLocacao }
  POST   /v1/imoveis/:id/retirada                        + ACAO:excluir_cadastro
  POST   /v1/imoveis/:id/recirculacao                    + ACAO:excluir_cadastro

CÔMODOS (§7.5)  — todas devolvem o IMÓVEL                TELA:imoveis
  POST   /v1/imoveis/:id/comodos
  PUT    /v1/imoveis/:id/comodos/:comodoId
  DELETE /v1/imoveis/:id/comodos/:comodoId

CADASTROS (§7.6, §7.7)                                   TELA:cadastros
  POST   /v1/{locadores|locatarios|fiadores}
  GET    /v1/{locadores|locatarios|fiadores}   ?incluirRetirados=&limite=&deslocamento=
  GET    /v1/{locadores|locatarios|fiadores}/:id
  PUT    /v1/{locadores|locatarios|fiadores}/:id
  POST   /v1/{…}/:id/retirada                            + ACAO:excluir_cadastro
  POST   /v1/{…}/:id/recirculacao                        + ACAO:excluir_cadastro
  POST   /v1/locatarios/:id/confirmacao-de-email         → 202

CONTRATOS (§7.8)                                         TELA:contratos
  POST   /v1/contratos
  GET    /v1/contratos            ?incluirRetirados=&limite=&deslocamento=
  GET    /v1/contratos/:codigo
  GET    /v1/contratos/:codigo/documento                 → PDF
  GET    /v1/contratos/:codigo/carne     ?de=&ate=       → PDF
  PUT    /v1/contratos/:codigo                           (só RASCUNHO)
  POST   /v1/contratos/:codigo/ativacao                  + ACAO:ativar_contrato
  POST   /v1/contratos/:codigo/cancelamento              + ACAO:cancelar_contrato
  POST   /v1/contratos/:codigo/retirada                  + ACAO:excluir_cadastro
  POST   /v1/contratos/:codigo/recirculacao              + ACAO:excluir_cadastro

COBRANÇAS (§7.9)                                         TELA:financeiro
  POST   /v1/cobrancas
  GET    /v1/cobrancas            ?contrato=&status=&natureza=&limite=&deslocamento=
  GET    /v1/cobrancas/:codigo
  POST   /v1/cobrancas/:codigo/pagamento                 { pagoEm, valorPago }
  POST   /v1/cobrancas/:codigo/cancelamento
  POST   /v1/cobrancas/:codigo/emissao-de-boleto         + ACAO:emitir_boleto
  POST   /v1/cobrancas/:codigo/revogacao-de-boleto       + ACAO:solicitar_baixa_de_boleto
  GET    /v1/cobrancas/:codigo/boleto                    → PDF
  GET    /v1/cobrancas/:codigo/historico-bancario

MULTA E JUROS (§7.10)                                    TELA:multa_e_juros
  GET    /v1/multa-e-juros
  PUT    /v1/multa-e-juros

AUTOMAÇÃO DE COBRANÇA (§7.11)                            TELA:automacao_de_cobranca
  GET    /v1/automacao-de-cobranca
  PUT    /v1/automacao-de-cobranca
  GET    /v1/automacao-de-cobranca/cobrancas/:codigo/avisos   ?limite=&deslocamento=
  POST   /v1/automacao-de-cobranca/cobrancas/:codigo/avisos   + ACAO:enviar_cobranca_manual
  GET    /v1/automacao-de-cobranca/rotinas

COBRANÇA BANCÁRIA (§7.12)                                TELA:financeiro
  POST   /v1/cobranca-bancaria/emissoes    { competencia }    + ACAO:emitir_boleto
  GET    /v1/cobranca-bancaria/emissoes/:id
  POST   /v1/cobranca-bancaria/conferencias

INTEGRAÇÕES BANCÁRIAS (§7.13, §8)                        TELA:integracoes_bancarias
  POST   /v1/integracoes-bancarias/certificados          + ACAO:configurar_integracao
  GET    /v1/integracoes-bancarias/certificado
  POST   /v1/integracoes-bancarias/certificado/verificacao
  POST   /v1/integracoes-bancarias/identidade            + ACAO:configurar_integracao
  GET    /v1/integracoes-bancarias/identidade            + ACAO:configurar_integracao
  POST   /v1/integracoes-bancarias/entrega-da-noticia/ativacao   + ACAO:configurar_integracao
  GET    /v1/integracoes-bancarias/entrega-da-noticia            + ACAO:configurar_integracao

PÚBLICA (§7.14)                                          nenhuma exigência
  POST   /v1/confirmacoes-de-email                       { segredo }

NÃO É DO FRONTEND (§7.15)
  POST   /v1/notificacoes-bancarias      ← webhook do banco
  /v1/master/*                           ← outro aplicativo (§16)
  GET    /saude · /saude/pronto · /docs · /docs/json
```

---

## 18. Procedência deste documento

- **Medido em 2026-08-24**, contra o código deste repositório, com a superfície **congelada** (F0 a
  F5 concluídas — 147 tasks aprovadas nos dois gates).
- **Superfície publicada:** 106 rotas / 91 manipuladores; 20 rotas públicas. Os três números são
  constantes executáveis de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`, e a suíte reprova
  se a superfície divergir deles.
- **Suíte do backend:** 1943 casos em 9 pacotes.
- **Fontes primárias:** os controladores em `apps/api/src/**/*.controller.ts`, os esquemas de
  contrato em `packages/contracts/src/`, o catálogo de permissões em
  `packages/auth/src/catalogo-de-permissoes.ts`, o envelope de erro em `packages/shared/src/erros.ts`
  e o inventário do frontend atual em `docs/plano-backend-novo/levantamento-frontend.md` (§2 e §8).
- **Decisões arquiteturais citadas:** ADR-0001, 0008, 0010, 0011, 0013, 0014, 0016, 0017, 0018,
  0021, 0022, 0025, 0026, 0027, 0029, 0030, 0032, 0033, 0034, 0035, 0036.
- **O que este documento NÃO cobre, por decisão:** o Painel Master (handoff próprio, §16) e a
  execução da virada do sistema antigo, que é operação futura neste servidor.

---

## 19. Estados de UI exigidos por operação

> **Esta seção é mecânica, e existe para ser conferida linha a linha.** As §7 e §8 dizem, em prosa,
> o que cada rota devolve; esta tabela diz **quais estados a tela é obrigada a ter**. Um `✓` sem
> tratamento no código é defeito de frontend, ainda que a chamada funcione.

⚠️ **Duas colunas do vocabulário usual da indústria não existem aqui, e a diferença é de contrato:**

1. **Não há `409`.** O conflito de transição de estado — cancelar o que já está cancelado, ativar o
   que não é rascunho, pagar o que já foi pago — chega como **`422 CAMPO_INVALIDO`** com
   `detalhes: { estadoAtual, transicaoPedida }`. Quem procurar `409` não vai achar nunca. A coluna
   **`conflito`** abaixo é esse `422`, e ele é **diferente** do `422` de campo malformado: o primeiro
   releva o recurso na tela, o segundo marca um campo do formulário.
2. **O `503` é estado declarado, não "erro genérico".** Ele carrega uma promessa: **nada foi
   alterado**. A coluna **`indisponivel`** existe por isso — e em três rotas ela traz `detalhes` que
   a tela precisa ler (emissão de boleto, revogação, carnê). Tratá-la junto do `500` perde a única
   informação que ela dá.

| Operação (família) | carregando | sucesso | vazio | erro_de_campo | conflito | sem_sessão | sem_alcance | não_encontrado | limite_excedido | indisponivel | erro_interno |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Entrar (`sign-in/email`) | ✓ | ✓ | — | ✓ | — | ✓ | — | — | ✓ | — | ✓ |
| Verificar 2º fator (`verify-totp`) | ✓ | ✓ | — | ✓ | — | ✓ | — | — | ✓ | — | ✓ |
| `GET /v1/sessao` | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | ✓ |
| `POST /v1/sessao/senha` | ✓ | ✓ | — | ✓ | — | ✓ | — | — | ✓ | — | ✓ |
| Listagem paginada | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | — | ✓ |
| Leitura de item | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Criação (`POST` de coleção) | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Alteração (`PUT` completo) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Retirada / recirculação | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Ativação de contrato | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Cancelamento (contrato, cobrança) | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Pagamento de cobrança | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Emissão de boleto | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | **✓** | ✓ |
| Revogação de boleto | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | **✓** | ✓ |
| PDF (documento, boleto) | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| PDF do carnê | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | **✓** | — | ✓ | ✓ |
| Histórico bancário | ✓ | ✓ | **✓** | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Configuração singular (`multa-e-juros`, `automacao-de-cobranca`) | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | — | — | — | ✓ |
| Aviso manual (`POST …/avisos`) | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Abrir emissão em lote | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Acompanhar emissão em lote | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Disparar conferência | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ |
| Registrar certificado | ✓ | ✓ | — | **✓** | — | ✓ | ✓ | — | — | — | ✓ |
| Ler certificado vigente | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Verificar certificado | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Registrar / ler identidade | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Ativar / ler entrega da notícia | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — | — | ✓ |
| Confirmar e-mail (pública) | ✓ | ✓ | — | ✓ | — | — | — | ✓ | — | — | ✓ |
| Cômodos (`POST`/`PUT`/`DELETE`) | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ |

**As sete leituras da tabela que mais custam se forem ignoradas:**

1. **`vazio` só aparece em três lugares** — listagem paginada (`itens: []` com `total: 0`), histórico
   bancário (`itens: []`, que é `200` e **não** `404`) e a lista de avisos. Em todo o resto, ausência
   é `404`.
2. **`sem_alcance` (`403`) não existe na entrada nem em `GET /v1/sessao`** — as duas são alcançáveis
   com sessão restrita, e é exatamente por isso que servem de saída dela (§4.3).
3. **`limite_excedido` (`429`) só existe sob `/v1/auth` e em `POST /v1/sessao/senha`** — as duas
   atravessam o limitador do arcabouço. **Nas rotas de negócio não há limitador**, e **a rota pública
   de confirmação também não tem**: não desenhe o banner nelas. Medido: não há limitador global em
   `apps/api/src/main.ts` nem decorador de taxa em `confirmacao.controller.ts`.
4. **`indisponivel` com `detalhes` legíveis** aparece na emissão de boleto
   (`{ boleto: "SEM_BOLETO", revogacao: "CONFIRMADA" }`), na revogação
   (`{ revogacao: "PEDIDA_NAO_CONFIRMADA" }`) e nos PDFs que rebuscam do provedor. Nos três, a
   mensagem certa **não** é "tente mais tarde".
5. **`erro_de_campo` no registro de certificado é de três sabores com códigos próprios** —
   `SENHA_DO_MATERIAL_NAO_ABRE`, `MATERIAL_EM_FORMATO_NAO_SUPORTADO` e
   `CERTIFICADO_COM_VALIDADE_ENCERRADA` —, e o `422` genérico de campo **não** os cobre (§7.13).
6. **`não_encontrado` no carnê carrega qual cobrança falta** (`detalhes.cobranca`), e a tela deve
   nomeá-la. Um `404` mudo aqui é a diferença entre o usuário resolver e o usuário abrir chamado.
7. **A ativação do webhook não tem coluna de falha** — os quatro desfechos saem com `200` (§8.3). A
   tela que trata "provedor mudo" como erro está errada; ela precisa comparar `verificadaEm`.

---

## 20. Fixtures

> **Para que servem.** O app React é implementado noutra máquina, sem este backend rodando. Estas
> fixtures são o suficiente para montar o cliente HTTP, o roteamento por sessão, os estados da §19 e
> os testes da §21 **antes** de haver ambiente integrado. Todas são **derivadas dos payloads das §4
> a §8 deste documento** — nenhuma é inventada, e nenhuma acrescenta campo que a API não devolva.
>
> ⚠️ **Elas não substituem a integração.** Fixture que diverge do servidor é pior que fixture
> nenhuma: quando o ambiente integrado existir, confira as respostas reais contra estas e corrija
> **as fixtures**, nunca o código do cliente.
>
> **Convenção:** cada fixture é um objeto `{ name, request, response }`. Toda requisição autenticada
> presume `credentials: 'include'`; **nenhuma** leva `Authorization` (§2.3).
>
> **Cobertura, declarada sem truncar em silêncio.** São **90 fixtures**, cobrindo **toda operação que
> altera estado** com pelo menos o sucesso e uma recusa de cliente, e **toda listagem** com o cheio e
> o vazio. As famílias que compartilham forma **por decisão do backend** — locador, locatário e
> fiador falam o mesmo modelo (§7.6); conjunto, imóvel e contrato compartilham retirada e
> recirculação (§6.8) — trazem **uma** fixture com a nota de derivação, em vez de três cópias que
> divergiriam. Onde a forma diverge, a fixture é própria.

### 20.1 Entrada e sessão

```json
[
  { "name": "entrar/exige-segundo-fator",
    "request": { "method": "POST", "path": "/v1/auth/sign-in/email",
                 "body": { "email": "maria@exemplo.com.br", "password": "senha-forte-de-verdade" } },
    "response": { "status": 200, "body": { "twoFactorRedirect": true, "twoFactorMethods": ["totp"] } } },

  { "name": "entrar/sessao-emitida",
    "request": { "method": "POST", "path": "/v1/auth/sign-in/email",
                 "body": { "email": "maria@exemplo.com.br", "password": "senha-forte-de-verdade" } },
    "response": { "status": 200, "body": {} } },

  { "name": "entrar/recusada",
    "request": { "method": "POST", "path": "/v1/auth/sign-in/email",
                 "body": { "email": "maria@exemplo.com.br", "password": "errada" } },
    "response": { "status": 401,
                  "body": { "codigo": "CREDENCIAL_INVALIDA", "mensagem": "credencial inválida" } } },

  { "name": "entrar/limite-de-taxa",
    "request": { "method": "POST", "path": "/v1/auth/sign-in/email",
                 "body": { "email": "maria@exemplo.com.br", "password": "errada" } },
    "response": { "status": 429, "headers": {},
                  "body": { "codigo": "REQUISICAO_RECUSADA", "mensagem": "requisição recusada" } } },

  { "name": "sessao/admin-completa",
    "request": { "method": "GET", "path": "/v1/sessao" },
    "response": { "status": 200, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000001",
      "nome": "Maria Souza", "email": "maria@exemplo.com.br",
      "perfil": "ADMIN_EMPRESA",
      "empresaId": "8b2d9f10-2222-4e3c-8b55-000000000002",
      "empresaNome": "Imobiliária Exemplo",
      "senhaProvisoria": false, "segundoFatorPendente": false,
      "telas": ["TELA:resumo","TELA:imoveis","TELA:contratos","TELA:cadastros","TELA:financeiro",
                "TELA:automacao_de_cobranca","TELA:integracoes_bancarias","TELA:multa_e_juros",
                "TELA:relatorios","TELA:usuarios"],
      "acoes": ["ACAO:emitir_boleto","ACAO:solicitar_baixa_de_boleto","ACAO:ativar_contrato",
                "ACAO:cancelar_contrato","ACAO:excluir_cadastro","ACAO:configurar_integracao",
                "ACAO:enviar_cobranca_manual"],
      "versaoPermissoes": 4 } } },

  { "name": "sessao/restrita-por-senha-provisoria",
    "request": { "method": "GET", "path": "/v1/sessao" },
    "response": { "status": 200, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000003",
      "nome": "João Lima", "email": "joao@exemplo.com.br",
      "perfil": "USUARIO_EMPRESA",
      "empresaId": "8b2d9f10-2222-4e3c-8b55-000000000002",
      "empresaNome": "Imobiliária Exemplo",
      "senhaProvisoria": true, "segundoFatorPendente": false,
      "telas": ["TELA:resumo","TELA:imoveis","TELA:contratos","TELA:cadastros","TELA:financeiro"],
      "acoes": [], "versaoPermissoes": 1 } } },

  { "name": "sessao/master-sem-empresa",
    "request": { "method": "GET", "path": "/v1/sessao" },
    "response": { "status": 200, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000009",
      "nome": "Operador Sysloc", "email": "operador@sysloc.com.br",
      "perfil": "SYSLOC_MASTER",
      "empresaId": null, "empresaNome": null,
      "senhaProvisoria": false, "segundoFatorPendente": false,
      "telas": [], "acoes": [], "versaoPermissoes": 0 } } },

  { "name": "sessao/sem-sessao",
    "request": { "method": "GET", "path": "/v1/sessao" },
    "response": { "status": 401,
                  "body": { "codigo": "NAO_AUTENTICADO", "mensagem": "sessão inválida ou expirada" } } },

  { "name": "trocar-senha/aceita",
    "request": { "method": "POST", "path": "/v1/sessao/senha",
                 "body": { "senhaAtual": "provisoria-Ab12", "senhaNova": "outra-senha-boa-2026" } },
    "response": { "status": 200, "body": { "trocada": true } } },

  { "name": "trocar-senha/politica-violada",
    "request": { "method": "POST", "path": "/v1/sessao/senha",
                 "body": { "senhaAtual": "provisoria-Ab12", "senhaNova": "abcd1234" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "senha",
      "detalhes": { "motivos": ["COMPRIMENTO_MINIMO", "SEQUENCIA_CONSECUTIVA"] } } } },

  { "name": "qualquer/sessao-restrita",
    "request": { "method": "GET", "path": "/v1/contratos" },
    "response": { "status": 403, "body": {
      "codigo": "ACESSO_NEGADO",
      "mensagem": "acesso negado: esta sessão está restrita até a troca da senha provisória" } } },

  { "name": "qualquer/sem-alcance",
    "request": { "method": "GET", "path": "/v1/usuarios" },
    "response": { "status": 403, "body": {
      "codigo": "ACESSO_NEGADO", "mensagem": "acesso negado para esta sessão",
      "detalhes": { "exigido": "TELA:usuarios" } } } }
]
```

⚠️ **A mensagem de `qualquer/sessao-restrita` é a única exceção à canonicidade da §3.2** — e mesmo
assim **a tela não a lê**: ela decide por `GET /v1/sessao` e pelas bandeiras (§4.3, §5.5). A fixture
traz o texto para provar que ele existe, não para virar comparação no código.

### 20.2 Listagem — o envelope, o vazio e a recusa da janela

```json
[
  { "name": "listar-contratos/pagina-cheia",
    "request": { "method": "GET", "path": "/v1/contratos?limite=50&deslocamento=0" },
    "response": { "status": 200, "body": {
      "itens": [
        { "codigo": "CTR-2026-00001", "status": "ATIVO",
          "imovelId": "11111111-1111-4111-8111-111111111111",
          "locadorId": "22222222-2222-4222-8222-222222222222",
          "locatarioId": "33333333-3333-4333-8333-333333333333",
          "fiadores": [ { "id": "44444444-4444-4444-8444-444444444444", "nome": "Ana Prado" } ],
          "dataInicioLocacao": "2026-03-01", "prazoMeses": 30, "valorMensal": 2500.00,
          "diaVencimento": 10, "dataFimLocacao": "2028-08-31", "valorTotalContrato": 75000.00,
          "gerarCobrancasAutomaticamente": true, "retiradoEm": null }
      ],
      "total": 137, "limite": 50, "deslocamento": 0 } } },

  { "name": "listar-contratos/vazio",
    "request": { "method": "GET", "path": "/v1/contratos?limite=50&deslocamento=0" },
    "response": { "status": 200,
                  "body": { "itens": [], "total": 0, "limite": 50, "deslocamento": 0 } } },

  { "name": "listar-contratos/limite-acima-do-teto",
    "request": { "method": "GET", "path": "/v1/contratos?limite=500" },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "limite" } } },

  { "name": "listar-contratos/parametro-desconhecido",
    "request": { "method": "GET", "path": "/v1/contratos?ordenar=nome" },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "ordenar" } } },

  { "name": "listar-cobrancas/recorte-por-status",
    "request": { "method": "GET",
                 "path": "/v1/cobrancas?status=VENCIDA&natureza=ALUGUEL&limite=50&deslocamento=0" },
    "response": { "status": 200, "body": {
      "itens": [
        { "codigo": "COB-2026-0000001", "contratoCodigo": "CTR-2026-00001",
          "locatarioId": "33333333-3333-4333-8333-333333333333",
          "natureza": "ALUGUEL", "referencia": "Aluguel 03/2026",
          "competencia": "2026-03-01", "dataVencimento": "2026-03-10", "valorOriginal": 2500.00,
          "status": "VENCIDA", "diasAtraso": 7,
          "valorMulta": 50.00, "valorJuros": 8.75, "valorTotal": 2558.75,
          "pagoEm": null, "valorPago": null, "canceladoEm": null,
          "multaPercentualAplicado": null, "jurosPercentualAplicado": null,
          "numeroDoTituloNoProvedor": "000012345678",
          "linhaDigitavel": "75691.12345 40000.000012 34567.890123 4 98760000255875",
          "codigoDeBarras": "75694987600002558751123454000000123456789012",
          "dataDoCredito": null, "valorCreditado": null }
      ],
      "total": 12, "limite": 50, "deslocamento": 0 } } }
]
```

⚠️ **O envelope é o mesmo em toda listagem paginada** (§6.3), então a fixture de contratos serve de
molde para imóveis, conjuntos, locadores, locatários, fiadores, pessoas da empresa e avisos —
trocando o item. **As três listas SEM janela** (`itens` do lote, histórico bancário e a lista de
avisos por cobrança quando lida sem janela) não trazem `total`/`limite`/`deslocamento`.

### 20.3 Pessoas da empresa

```json
[
  { "name": "criar-usuario/sucesso",
    "request": { "method": "POST", "path": "/v1/usuarios",
                 "body": { "nome": "João Lima", "email": "joao@exemplo.com.br",
                           "perfil": "USUARIO_EMPRESA" } },
    "response": { "status": 201, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000003",
      "email": "joao@exemplo.com.br", "perfil": "USUARIO_EMPRESA",
      "senhaProvisoria": "Xk7-provisoria-2026" } } },

  { "name": "ajustar-permissoes/sucesso",
    "request": { "method": "POST", "path": "/v1/usuarios/3f1c0e7a-1111-4c2b-9a44-000000000003/permissoes",
                 "body": { "ajustes": [
                   { "tipo": "TELA", "chave": "financeiro", "efeito": "CONCEDIDA" },
                   { "tipo": "ACAO", "chave": "emitir_boleto", "efeito": "CONCEDIDA" } ] } },
    "response": { "status": 200, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000003",
      "telas": ["TELA:resumo","TELA:imoveis","TELA:contratos","TELA:cadastros","TELA:financeiro"],
      "acoes": ["ACAO:emitir_boleto"],
      "versaoPermissoes": 5 } } },

  { "name": "ajustar-permissoes/acao-sem-a-area",
    "request": { "method": "POST", "path": "/v1/usuarios/3f1c0e7a-1111-4c2b-9a44-000000000003/permissoes",
                 "body": { "ajustes": [
                   { "tipo": "ACAO", "chave": "emitir_boleto", "efeito": "CONCEDIDA" } ] } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "permissoes",
      "detalhes": { "telaExigida": "TELA:financeiro", "acao": "ACAO:emitir_boleto" } } } },

  { "name": "trocar-perfil/exige-intencao-de-descartar",
    "request": { "method": "POST", "path": "/v1/usuarios/3f1c0e7a-1111-4c2b-9a44-000000000003/perfil",
                 "body": { "perfil": "ADMIN_EMPRESA", "descartarAjustes": false } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "perfil",
      "detalhes": { "ajustesDescartados": 3 } } } },

  { "name": "desativar/sucesso",
    "request": { "method": "POST",
                 "path": "/v1/usuarios/3f1c0e7a-1111-4c2b-9a44-000000000003/desativacao", "body": {} },
    "response": { "status": 200, "body": {
      "usuarioId": "3f1c0e7a-1111-4c2b-9a44-000000000003", "ativo": false,
      "sessoesEncerradas": 3 } } },

  { "name": "qualquer-ato/alvo-e-quem-age",
    "request": { "method": "POST",
                 "path": "/v1/usuarios/3f1c0e7a-1111-4c2b-9a44-000000000001/desativacao", "body": {} },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "id",
      "detalhes": { "motivo": "ALVO_E_QUEM_AGE" } } } }
]
```

⚠️ **`detalhes.telaExigida` e `detalhes.ajustesDescartados` são as duas formas do `detalhes` desta
área que a tela precisa ler** — a primeira nomeia a área a conceder junto, a segunda alimenta o
diálogo de confirmação (§7.2).

### 20.4 Contratos — o percurso mais consequente

```json
[
  { "name": "criar-contrato/rascunho",
    "request": { "method": "POST", "path": "/v1/contratos",
                 "body": { "imovelId": "11111111-1111-4111-8111-111111111111",
                           "locadorId": "22222222-2222-4222-8222-222222222222",
                           "locatarioId": "33333333-3333-4333-8333-333333333333",
                           "fiadoresIds": ["44444444-4444-4444-8444-444444444444"],
                           "dataInicioLocacao": "2026-03-01", "prazoMeses": 30,
                           "valorMensal": 2500.00, "diaVencimento": 10,
                           "gerarCobrancasAutomaticamente": true } },
    "response": { "status": 201, "body": {
      "codigo": "CTR-2026-00001", "status": "RASCUNHO",
      "imovelId": "11111111-1111-4111-8111-111111111111",
      "locadorId": "22222222-2222-4222-8222-222222222222",
      "locatarioId": "33333333-3333-4333-8333-333333333333",
      "fiadores": [ { "id": "44444444-4444-4444-8444-444444444444", "nome": "Ana Prado" } ],
      "dataInicioLocacao": "2026-03-01", "prazoMeses": 30, "valorMensal": 2500.00,
      "diaVencimento": 10,
      "dataFimLocacao": null, "valorTotalContrato": null,
      "gerarCobrancasAutomaticamente": true, "retiradoEm": null } } },

  { "name": "criar-contrato/parte-retirada-de-circulacao",
    "request": { "method": "POST", "path": "/v1/contratos", "body": { "…": "como acima" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "locatarioId",
      "detalhes": { "circulacao": "RETIRADO_DE_CIRCULACAO" } } } },

  { "name": "ativar-contrato/sucesso-com-parcelas",
    "request": { "method": "POST", "path": "/v1/contratos/CTR-2026-00001/ativacao", "body": {} },
    "response": { "status": 200, "body": {
      "codigo": "CTR-2026-00001", "status": "ATIVO",
      "imovelId": "11111111-1111-4111-8111-111111111111",
      "locadorId": "22222222-2222-4222-8222-222222222222",
      "locatarioId": "33333333-3333-4333-8333-333333333333",
      "fiadores": [ { "id": "44444444-4444-4444-8444-444444444444", "nome": "Ana Prado" } ],
      "dataInicioLocacao": "2026-03-01", "prazoMeses": 30, "valorMensal": 2500.00,
      "diaVencimento": 10, "dataFimLocacao": "2028-08-31", "valorTotalContrato": 75000.00,
      "gerarCobrancasAutomaticamente": true, "retiradoEm": null,
      "efeitos": { "cobrancasGeradas": 30 } } } },

  { "name": "ativar-contrato/imovel-ja-ocupado",
    "request": { "method": "POST", "path": "/v1/contratos/CTR-2026-00002/ativacao", "body": {} },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "imovelId",
      "detalhes": { "conflito": "IMOVEL_COM_CONTRATO_VIGENTE",
                    "contratoVigente": "CTR-2026-00001" } } } },

  { "name": "ativar-contrato/nao-e-rascunho",
    "request": { "method": "POST", "path": "/v1/contratos/CTR-2026-00001/ativacao", "body": {} },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "status",
      "detalhes": { "estadoAtual": "ATIVO", "transicaoPedida": "ATIVO" } } } },

  { "name": "alterar-contrato/nao-e-rascunho",
    "request": { "method": "PUT", "path": "/v1/contratos/CTR-2026-00001",
                 "body": { "…": "objeto completo" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "status",
      "detalhes": { "estadoAtual": "ATIVO", "transicaoPedida": "RASCUNHO" } } } },

  { "name": "carne/boleto-ausente",
    "request": { "method": "GET", "path": "/v1/contratos/CTR-2026-00001/carne?de=2026-01-01&ate=2026-06-01" },
    "response": { "status": 404, "body": {
      "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado",
      "detalhes": { "carne": "BOLETO_AUSENTE", "cobranca": "COB-2026-0000003" } } } },

  { "name": "carne/sem-cobrancas-no-recorte",
    "request": { "method": "GET", "path": "/v1/contratos/CTR-2026-00001/carne?de=2027-01-01&ate=2027-06-01" },
    "response": { "status": 404, "body": {
      "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado",
      "detalhes": { "carne": "SEM_COBRANCAS" } } } },

  { "name": "documento/pdf",
    "request": { "method": "GET", "path": "/v1/contratos/CTR-2026-00001/documento" },
    "response": { "status": 200,
                  "headers": { "content-type": "application/pdf",
                               "content-disposition": "attachment; filename=\"CTR-2026-00001.pdf\"" },
                  "body": "<bytes>" } }
]
```

⚠️ **`efeitos.cobrancasGeradas` só existe na resposta da ativação** — não é campo do Contrato, e não
aparece em nenhum `GET`. A tela que quiser reexibi-lo depois precisa tê-lo guardado, ou contar as
cobranças do contrato.

### 20.5 Cobranças e boleto

```json
[
  { "name": "pagar/sucesso",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000001/pagamento",
                 "body": { "pagoEm": "2026-03-12", "valorPago": 2558.75 } },
    "response": { "status": 200, "body": {
      "codigo": "COB-2026-0000001", "contratoCodigo": "CTR-2026-00001",
      "locatarioId": "33333333-3333-4333-8333-333333333333",
      "natureza": "ALUGUEL", "referencia": "Aluguel 03/2026",
      "competencia": "2026-03-01", "dataVencimento": "2026-03-10", "valorOriginal": 2500.00,
      "status": "PAGA", "diasAtraso": 7,
      "valorMulta": 50.00, "valorJuros": 8.75, "valorTotal": 2558.75,
      "pagoEm": "2026-03-12", "valorPago": 2558.75, "canceladoEm": null,
      "multaPercentualAplicado": 2.00, "jurosPercentualAplicado": 0.0333,
      "numeroDoTituloNoProvedor": "000012345678",
      "linhaDigitavel": "75691.12345 40000.000012 34567.890123 4 98760000255875",
      "codigoDeBarras": "75694987600002558751123454000000123456789012",
      "dataDoCredito": null, "valorCreditado": null } } },

  { "name": "pagar/ja-paga",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000001/pagamento",
                 "body": { "pagoEm": "2026-03-13", "valorPago": 2558.75 } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "codigo",
      "detalhes": { "estadoAtual": "PAGA", "transicaoPedida": "PAGA" } } } },

  { "name": "emitir-boleto/sucesso",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000002/emissao-de-boleto",
                 "body": {} },
    "response": { "status": 200, "body": {
      "codigo": "COB-2026-0000002", "status": "A_VENCER",
      "numeroDoTituloNoProvedor": "000012345679",
      "linhaDigitavel": "75691.12345 40000.000012 34567.890124 1 98770000250000",
      "codigoDeBarras": "75691987700002500001123454000000123456789013",
      "dataDoCredito": null, "valorCreditado": null,
      "…": "e os demais campos da Cobrança" } } },

  { "name": "emitir-boleto/revogou-mas-nao-emitiu",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000002/emissao-de-boleto",
                 "body": {} },
    "response": { "status": 503, "body": {
      "codigo": "SERVICO_INDISPONIVEL", "mensagem": "serviço temporariamente indisponível",
      "detalhes": { "boleto": "SEM_BOLETO", "revogacao": "CONFIRMADA" } } } },

  { "name": "revogar-boleto/sem-boleto-vivo",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000002/revogacao-de-boleto",
                 "body": {} },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida",
      "detalhes": { "boleto": "SEM_BOLETO" } } } },

  { "name": "revogar-boleto/nao-confirmada",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000002/revogacao-de-boleto",
                 "body": {} },
    "response": { "status": 503, "body": {
      "codigo": "SERVICO_INDISPONIVEL", "mensagem": "serviço temporariamente indisponível",
      "detalhes": { "revogacao": "PEDIDA_NAO_CONFIRMADA" } } } },

  { "name": "boleto-pdf/nunca-emitido",
    "request": { "method": "GET", "path": "/v1/cobrancas/COB-2026-0000005/boleto" },
    "response": { "status": 404, "body": {
      "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado",
      "detalhes": { "boleto": "NUNCA_EMITIDO" } } } },

  { "name": "historico-bancario/com-divergencia",
    "request": { "method": "GET", "path": "/v1/cobrancas/COB-2026-0000001/historico-bancario" },
    "response": { "status": 200, "body": { "itens": [
      { "tipo": "BOLETO_EMITIDO", "origem": "ATO_DO_ADMIN",
        "ocorridoEm": "2026-03-01T11:00:00.000Z",
        "diagnostico": "boleto emitido no provedor", "valorInformado": null },
      { "tipo": "DIVERGENCIA_DE_VALOR", "origem": "NOTICIA_DO_PROVEDOR",
        "ocorridoEm": "2026-03-12T09:10:00.000Z",
        "diagnostico": "valor informado difere do esperado", "valorInformado": 2500.00 },
      { "tipo": "COBRANCA_LIQUIDADA", "origem": "CONFERENCIA",
        "ocorridoEm": "2026-03-12T09:14:00.000Z",
        "diagnostico": "liquidação confirmada pelo provedor", "valorInformado": 2558.75 }
    ] } } },

  { "name": "historico-bancario/sem-efeito-algum",
    "request": { "method": "GET", "path": "/v1/cobrancas/COB-2026-0000009/historico-bancario" },
    "response": { "status": 200, "body": { "itens": [] } } }
]
```

⚠️ **`historico-bancario/sem-efeito-algum` é `200` com lista vazia, jamais `404`** — e é a fixture
que prova o estado `vazio` da §19. Uma tela que trate lista vazia como "não encontrado" mostra erro
para toda cobrança que ainda não teve movimento bancário, que é a maioria delas.

### 20.6 Emissão em lote e conferência

```json
[
  { "name": "abrir-lote/aceito",
    "request": { "method": "POST", "path": "/v1/cobranca-bancaria/emissoes",
                 "body": { "competencia": "2026-03-01" } },
    "response": { "status": 201, "body": {
      "id": "55555555-5555-4555-8555-555555555555", "competencia": "2026-03-01",
      "estado": "EM_ANDAMENTO",
      "criadoEm": "2026-03-01T12:00:00.000Z", "concluidoEm": null,
      "interrompidoEm": null, "motivoDaInterrupcao": null,
      "emitidas": 0, "recusadas": 0, "itens": [] } } },

  { "name": "abrir-lote/ja-ha-um-em-curso",
    "request": { "method": "POST", "path": "/v1/cobranca-bancaria/emissoes",
                 "body": { "competencia": "2026-03-01" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "competencia",
      "detalhes": { "loteEmCurso": "55555555-5555-4555-8555-555555555555" } } } },

  { "name": "acompanhar-lote/concluido-com-recusas",
    "request": { "method": "GET",
                 "path": "/v1/cobranca-bancaria/emissoes/55555555-5555-4555-8555-555555555555" },
    "response": { "status": 200, "body": {
      "id": "55555555-5555-4555-8555-555555555555", "competencia": "2026-03-01",
      "estado": "CONCLUIDA",
      "criadoEm": "2026-03-01T12:00:00.000Z", "concluidoEm": "2026-03-01T12:04:37.000Z",
      "interrompidoEm": null, "motivoDaInterrupcao": null,
      "emitidas": 27, "recusadas": 3,
      "itens": [
        { "cobrancaCodigo": "COB-2026-0000042", "desfecho": "RECUSADO",
          "motivo": "conta corrente inválida" },
        { "cobrancaCodigo": "COB-2026-0000043", "desfecho": "EMITIDO", "motivo": null } ] } } },

  { "name": "conferencia/iniciada-agora",
    "request": { "method": "POST", "path": "/v1/cobranca-bancaria/conferencias", "body": {} },
    "response": { "status": 200, "body": {
      "id": "66666666-6666-4666-8666-666666666666",
      "iniciadaEm": "2026-03-12T09:00:00.000Z", "concluidaEm": null,
      "iniciadaAgora": true, "cobrancasConferidas": 0, "efeitos": 0 } } },

  { "name": "conferencia/ja-em-andamento",
    "request": { "method": "POST", "path": "/v1/cobranca-bancaria/conferencias", "body": {} },
    "response": { "status": 200, "body": {
      "id": "66666666-6666-4666-8666-666666666666",
      "iniciadaEm": "2026-03-12T09:00:00.000Z", "concluidaEm": null,
      "iniciadaAgora": false, "cobrancasConferidas": 12, "efeitos": 0 } } }
]
```

⚠️ **`conferencia/ja-em-andamento` é `200`, não erro.** É a fixture do caso que o handoff aponta como
o mais fácil de errar nesta área (§7.12): a tela diz *"conferência em andamento desde
`iniciadaEm`"*, e não "erro" nem "iniciada".

### 20.7 Integrações bancárias — as três recusas do certificado e os quatro desfechos do webhook

```json
[
  { "name": "registrar-certificado/sucesso",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificados",
                 "body": { "material": "<PKCS#12 em base64>", "senha": "a-senha-do-arquivo" } },
    "response": { "status": 201, "body": {
      "id": "77777777-7777-4777-8777-777777777777",
      "titular": "IMOBILIARIA EXEMPLO LTDA:12345678000190",
      "validoDe": "2026-01-10T00:00:00.000Z", "validoAte": "2027-01-10T23:59:59.000Z",
      "impressaoDigital": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
      "estado": "VIGENTE", "diasParaVencer": 301,
      "registradoPor": { "id": "3f1c0e7a-1111-4c2b-9a44-000000000001", "nome": "Maria Souza" },
      "registradoEm": "2026-03-15T10:00:00.000Z",
      "materialConvertido": true } } },

  { "name": "registrar-certificado/senha-nao-abre",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificados",
                 "body": { "material": "<base64>", "senha": "errada" } },
    "response": { "status": 422, "body": {
      "codigo": "SENHA_DO_MATERIAL_NAO_ABRE",
      "mensagem": "a senha apresentada não abre o certificado enviado — confira a senha" } } },

  { "name": "registrar-certificado/formato-nao-suportado",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificados",
                 "body": { "material": "<base64 de algo que não é PKCS#12>", "senha": "x" } },
    "response": { "status": 422, "body": {
      "codigo": "MATERIAL_EM_FORMATO_NAO_SUPORTADO",
      "mensagem": "o arquivo enviado não é um certificado que o produto consiga ler — confira o arquivo escolhido" } } },

  { "name": "registrar-certificado/ja-vencido",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificados",
                 "body": { "material": "<base64>", "senha": "a-senha-do-arquivo" } },
    "response": { "status": 422, "body": {
      "codigo": "CERTIFICADO_COM_VALIDADE_ENCERRADA",
      "mensagem": "a validade do certificado apresentado já terminou",
      "detalhes": { "validoAte": "2025-11-30T23:59:59.000Z" } } } },

  { "name": "ler-certificado/vencendo",
    "request": { "method": "GET", "path": "/v1/integracoes-bancarias/certificado" },
    "response": { "status": 200, "body": {
      "id": "77777777-7777-4777-8777-777777777777",
      "titular": "IMOBILIARIA EXEMPLO LTDA:12345678000190",
      "validoDe": "2026-01-10T00:00:00.000Z", "validoAte": "2027-01-10T23:59:59.000Z",
      "impressaoDigital": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
      "estado": "VENCENDO", "diasParaVencer": 22,
      "registradoPor": { "id": "3f1c0e7a-1111-4c2b-9a44-000000000001", "nome": "Maria Souza" },
      "registradoEm": "2026-03-15T10:00:00.000Z" } } },

  { "name": "ler-certificado/empresa-nunca-registrou",
    "request": { "method": "GET", "path": "/v1/integracoes-bancarias/certificado" },
    "response": { "status": 404, "body": {
      "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado" } } },

  { "name": "verificar-certificado/aceito",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificado/verificacao",
                 "body": {} },
    "response": { "status": 200, "body": {
      "aceito": true, "verificadoEm": "2026-03-15T10:05:00.000Z",
      "detalhe": "a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. …" } } },

  { "name": "verificar-certificado/recusado-pelo-par",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/certificado/verificacao",
                 "body": {} },
    "response": { "status": 200, "body": {
      "aceito": false, "verificadoEm": "2026-03-15T10:06:00.000Z",
      "detalhe": "a instituição não aceitou o certificado; confira se é o que ela emitiu para esta empresa e se continua válido" } } },

  { "name": "registrar-identidade/sucesso",
    "request": { "method": "POST", "path": "/v1/integracoes-bancarias/identidade",
                 "body": { "identificadorDaAplicacao": "<segredo do provedor>",
                           "numeroDoCliente": 123456, "numeroDaContaCorrente": 98765,
                           "codigoDaModalidade": 1 } },
    "response": { "status": 201, "body": {
      "id": "88888888-8888-4888-8888-888888888888",
      "numeroDoCliente": 123456, "numeroDaContaCorrente": 98765, "codigoDaModalidade": 1,
      "registradoPor": { "id": "3f1c0e7a-1111-4c2b-9a44-000000000001", "nome": "Maria Souza" },
      "registradoEm": "2026-03-15T10:10:00.000Z" } } },

  { "name": "ativar-webhook/1-habilitada",
    "request": { "method": "POST",
                 "path": "/v1/integracoes-bancarias/entrega-da-noticia/ativacao", "body": {} },
    "response": { "status": 200, "body": {
      "habilitada": true, "situacao": "HABILITADA",
      "verificadaEm": "2026-03-15T10:20:00.000Z", "motivo": null } } },

  { "name": "ativar-webhook/2-em-validacao",
    "request": { "method": "POST",
                 "path": "/v1/integracoes-bancarias/entrega-da-noticia/ativacao", "body": {} },
    "response": { "status": 200, "body": {
      "habilitada": false, "situacao": "EM_VALIDACAO",
      "verificadaEm": "2026-03-15T10:21:00.000Z", "motivo": null } } },

  { "name": "ativar-webhook/3-recusada-pelo-provedor",
    "request": { "method": "POST",
                 "path": "/v1/integracoes-bancarias/entrega-da-noticia/ativacao", "body": {} },
    "response": { "status": 200, "body": {
      "habilitada": false, "situacao": "DESABILITADA",
      "verificadaEm": "2026-03-15T10:22:00.000Z",
      "motivo": { "codigo": "<código do provedor>",
                  "mensagem": "<mensagem do provedor, exibida literalmente>",
                  "diagnostico": { "campo": "contaCorrente", "valorRecebido": "98765" } } } } },

  { "name": "ativar-webhook/4-provedor-mudo",
    "request": { "method": "POST",
                 "path": "/v1/integracoes-bancarias/entrega-da-noticia/ativacao", "body": {} },
    "response": { "status": 200, "body": {
      "habilitada": false, "situacao": "DESABILITADA",
      "verificadaEm": "2026-03-10T08:00:00.000Z", "motivo": null } } },

  { "name": "ler-webhook/empresa-que-nunca-tentou",
    "request": { "method": "GET", "path": "/v1/integracoes-bancarias/entrega-da-noticia" },
    "response": { "status": 200, "body": {
      "habilitada": false, "situacao": "DESABILITADA",
      "verificadaEm": null, "motivo": null } } }
]
```

⚠️ **`ativar-webhook/4-provedor-mudo` é a fixture mais importante desta seção**, e a única que só se
reconhece **em par**: o corpo dela é indistinguível de um desfecho 3 antigo. O `verificadaEm`
(`2026-03-10`) é **anterior** ao clique (`2026-03-15`) — é isso, e só isso, que denuncia o desfecho
4 (§8.3). Um teste que use esta fixture **precisa** guardar o `verificadaEm` de antes.

⚠️ **`ler-webhook/empresa-que-nunca-tentou` é `200`, jamais `404`** (§8.4, item 5).

### 20.8 Confirmação de e-mail — a única rota pública de tela

```json
[
  { "name": "confirmar-email/sucesso",
    "request": { "method": "POST", "path": "/v1/confirmacoes-de-email",
                 "body": { "segredo": "<o valor lido do FRAGMENTO da URL>" } },
    "response": { "status": 200, "body": { "confirmado": true } } },

  { "name": "confirmar-email/segundo-clique-no-mesmo-link",
    "request": { "method": "POST", "path": "/v1/confirmacoes-de-email",
                 "body": { "segredo": "<o mesmo valor>" } },
    "response": { "status": 200, "body": { "confirmado": true } } },

  { "name": "confirmar-email/portador-invalido-vencido-ou-ja-invalidado",
    "request": { "method": "POST", "path": "/v1/confirmacoes-de-email",
                 "body": { "segredo": "<43 caracteres base64url que não abrem nada>" } },
    "response": { "status": 404, "body": {
      "codigo": "RECURSO_NAO_ENCONTRADO", "mensagem": "recurso não encontrado" } } },

  { "name": "confirmar-email/segredo-malformado",
    "request": { "method": "POST", "path": "/v1/confirmacoes-de-email",
                 "body": { "segredo": "curto-demais" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "segredo" } } }
]
```

⚠️ **O segundo clique no mesmo link é `200`, e a tela mostra sucesso** — não "link já usado". A
fixture existe para que o teste da §21 prove isso.

⚠️ **As duas recusas têm status DIFERENTES, e a tela mostra o MESMO texto.** Portador inválido,
vencido ou já invalidado é `404` — **byte a byte igual nos três casos**, de propósito (§7.14) —, e
só o segredo malformado (≠ 43 caracteres base64url) é `422`. A página não deve inventar diagnóstico
em nenhum dos dois.

### 20.9 Imóveis, cadastros, circulação e as configurações singulares

```json
[
  { "name": "criar-conjunto/sucesso",
    "request": { "method": "POST", "path": "/v1/conjuntos", "body": { "nome": "Edifício Aurora" } },
    "response": { "status": 201, "body": {
      "id": "99999999-9999-4999-8999-999999999999",
      "nome": "Edifício Aurora", "retiradoEm": null } } },

  { "name": "listar-conjuntos/expandido",
    "request": { "method": "GET",
                 "path": "/v1/conjuntos?expandir=imoveis&incluirRetirados=false&limite=50&deslocamento=0" },
    "response": { "status": 200, "body": {
      "itens": [ { "id": "99999999-9999-4999-8999-999999999999", "nome": "Edifício Aurora",
                   "retiradoEm": null, "imoveis": [] } ],
      "total": 1, "limite": 50, "deslocamento": 0 } } },

  { "name": "criar-imovel/sucesso",
    "request": { "method": "POST", "path": "/v1/imoveis",
                 "body": { "conjuntoId": "99999999-9999-4999-8999-999999999999",
                           "nomeImovel": "Apto 302", "identificadorMunicipal": "1234.567.8901-2",
                           "tipoImovel": "RESIDENCIAL",
                           "logradouro": "Av. Paulista", "numero": "1000", "complemento": null,
                           "bairro": "Bela Vista", "cidade": "São Paulo", "estado": "SP",
                           "cep": "01310-100",
                           "statusLocacao": "DISPONIVEL", "observacoes": null } },
    "response": { "status": 201, "body": {
      "id": "11111111-1111-4111-8111-111111111111",
      "conjuntoId": "99999999-9999-4999-8999-999999999999",
      "nomeImovel": "Apto 302", "identificadorMunicipal": "1234.567.8901-2",
      "tipoImovel": "RESIDENCIAL",
      "logradouro": "Av. Paulista", "numero": "1000", "complemento": null,
      "bairro": "Bela Vista", "cidade": "São Paulo", "estado": "SP", "cep": "01310100",
      "statusLocacao": "DISPONIVEL", "observacoes": null,
      "comodos": [], "metragemTotal": 0,
      "contratoVigente": null, "retiradoEm": null } } },

  { "name": "criar-imovel/identificador-municipal-de-um-retirado",
    "request": { "method": "POST", "path": "/v1/imoveis", "body": { "…": "como acima" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida",
      "campo": "identificadorMunicipal",
      "detalhes": { "conflito": "RETIRADO_DE_CIRCULACAO" } } } },

  { "name": "alterar-imovel/status-de-locacao-e-chave-desconhecida",
    "request": { "method": "PUT", "path": "/v1/imoveis/11111111-1111-4111-8111-111111111111",
                 "body": { "statusLocacao": "DISPONIVEL", "…": "e os demais campos" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida",
      "campo": "statusLocacao" } } },

  { "name": "situacao-de-locacao/imovel-com-contrato-vigente",
    "request": { "method": "POST",
                 "path": "/v1/imoveis/11111111-1111-4111-8111-111111111111/situacao-de-locacao",
                 "body": { "statusLocacao": "INDISPONIVEL" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "statusLocacao",
      "detalhes": { "conflito": "IMOVEL_COM_CONTRATO_VIGENTE" } } } },

  { "name": "criar-comodo/devolve-o-imovel-inteiro",
    "request": { "method": "POST",
                 "path": "/v1/imoveis/11111111-1111-4111-8111-111111111111/comodos",
                 "body": { "nomeComodo": "Sala", "metragem": 24.5, "observacoes": null } },
    "response": { "status": 201, "body": {
      "id": "11111111-1111-4111-8111-111111111111",
      "nomeImovel": "Apto 302",
      "comodos": [ { "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "nomeComodo": "Sala",
                     "metragem": 24.5, "posicao": 1, "observacoes": null } ],
      "metragemTotal": 24.5,
      "…": "e os demais campos do Imóvel" } } },

  { "name": "remover-comodo/posicoes-nao-sao-reatribuidas",
    "request": { "method": "DELETE",
                 "path": "/v1/imoveis/11111111-1111-4111-8111-111111111111/comodos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    "response": { "status": 200, "body": {
      "id": "11111111-1111-4111-8111-111111111111",
      "comodos": [ { "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "nomeComodo": "Sala",
                     "metragem": 24.5, "posicao": 1, "observacoes": null },
                   { "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "nomeComodo": "Quarto",
                     "metragem": 18.0, "posicao": 3, "observacoes": null } ],
      "metragemTotal": 42.5,
      "…": "e os demais campos do Imóvel" } } },

  { "name": "criar-pessoa/sucesso",
    "request": { "method": "POST", "path": "/v1/locadores",
                 "body": { "nome": "Ana Prado", "tipoPessoa": "PESSOA_FISICA",
                           "documentoPrincipal": "123.456.789-09", "rg": null,
                           "email": "ANA@Exemplo.com.BR", "telefone": "11999990000",
                           "logradouro": "Rua das Flores", "numero": "42", "complemento": null,
                           "bairro": "Centro", "cidade": "São Paulo", "estado": "sp",
                           "cep": "01310-100" } },
    "response": { "status": 201, "body": {
      "id": "22222222-2222-4222-8222-222222222222",
      "nome": "Ana Prado", "tipoPessoa": "PESSOA_FISICA",
      "documentoPrincipal": "12345678909", "rg": null,
      "email": "ana@exemplo.com.br", "telefone": "11999990000",
      "logradouro": "Rua das Flores", "numero": "42", "complemento": null,
      "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "cep": "01310100",
      "retiradoEm": null } } },

  { "name": "criar-pessoa/documento-com-digito-invalido",
    "request": { "method": "POST", "path": "/v1/locadores", "body": { "…": "como acima" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida",
      "campo": "documentoPrincipal" } } },

  { "name": "criar-locatario/campo-a-mais-que-o-locador",
    "request": { "method": "GET", "path": "/v1/locatarios/33333333-3333-4333-8333-333333333333" },
    "response": { "status": 200, "body": {
      "id": "33333333-3333-4333-8333-333333333333",
      "nome": "João Lima", "tipoPessoa": "PESSOA_FISICA",
      "documentoPrincipal": "98765432100", "rg": null,
      "email": "joao@exemplo.com.br", "telefone": "11988880000",
      "logradouro": "Rua das Flores", "numero": "44", "complemento": null,
      "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "cep": "01310100",
      "emailConfirmadoEm": null,
      "retiradoEm": null } } },

  { "name": "reenviar-confirmacao/aceito",
    "request": { "method": "POST",
                 "path": "/v1/locatarios/33333333-3333-4333-8333-333333333333/confirmacao-de-email",
                 "body": {} },
    "response": { "status": 202, "body": {
      "reenviadoEm": "2026-03-15T10:30:00.000Z",
      "expiraEm": "2026-03-18T10:30:00.000Z" } } },

  { "name": "retirar-de-circulacao/sucesso",
    "request": { "method": "POST", "path": "/v1/locadores/22222222-2222-4222-8222-222222222222/retirada",
                 "body": {} },
    "response": { "status": 200, "body": {
      "id": "22222222-2222-4222-8222-222222222222", "nome": "Ana Prado",
      "retiradoEm": "2026-03-15T10:40:00.000Z",
      "…": "e os demais campos da Pessoa" } } },

  { "name": "retirar-de-circulacao/repetida-e-idempotente",
    "request": { "method": "POST", "path": "/v1/locadores/22222222-2222-4222-8222-222222222222/retirada",
                 "body": {} },
    "response": { "status": 200, "body": {
      "id": "22222222-2222-4222-8222-222222222222", "nome": "Ana Prado",
      "retiradoEm": "2026-03-15T10:40:00.000Z",
      "…": "a MESMA marca — o instante não é reescrito" } } },

  { "name": "recircular/sucesso",
    "request": { "method": "POST",
                 "path": "/v1/locadores/22222222-2222-4222-8222-222222222222/recirculacao",
                 "body": {} },
    "response": { "status": 200, "body": {
      "id": "22222222-2222-4222-8222-222222222222", "nome": "Ana Prado",
      "retiradoEm": null,
      "…": "e os demais campos da Pessoa" } } },

  { "name": "criar-cobranca/avulsa",
    "request": { "method": "POST", "path": "/v1/cobrancas",
                 "body": { "contratoCodigo": "CTR-2026-00001", "natureza": "AGUA",
                           "referencia": "Água 03/2026", "competencia": "2026-03-01",
                           "dataVencimento": "2026-03-20", "valorOriginal": 187.40 } },
    "response": { "status": 201, "body": {
      "codigo": "COB-2026-0000031", "contratoCodigo": "CTR-2026-00001",
      "locatarioId": "33333333-3333-4333-8333-333333333333",
      "natureza": "AGUA", "referencia": "Água 03/2026",
      "competencia": "2026-03-01", "dataVencimento": "2026-03-20", "valorOriginal": 187.40,
      "status": "A_VENCER", "diasAtraso": 0,
      "valorMulta": 0, "valorJuros": 0, "valorTotal": 187.40,
      "pagoEm": null, "valorPago": null, "canceladoEm": null,
      "multaPercentualAplicado": null, "jurosPercentualAplicado": null,
      "numeroDoTituloNoProvedor": null, "linhaDigitavel": null, "codigoDeBarras": null,
      "dataDoCredito": null, "valorCreditado": null } } },

  { "name": "criar-cobranca/competencia-fora-do-dia-1",
    "request": { "method": "POST", "path": "/v1/cobrancas",
                 "body": { "contratoCodigo": "CTR-2026-00001", "natureza": "AGUA",
                           "referencia": "Água 03/2026", "competencia": "2026-03-15",
                           "dataVencimento": "2026-03-20", "valorOriginal": 187.40 } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "competencia" } } },

  { "name": "cancelar-cobranca/sucesso",
    "request": { "method": "POST", "path": "/v1/cobrancas/COB-2026-0000031/cancelamento",
                 "body": {} },
    "response": { "status": 200, "body": {
      "codigo": "COB-2026-0000031", "status": "CANCELADA",
      "canceladoEm": "2026-03-16T09:00:00.000Z",
      "…": "e os demais campos da Cobrança, com os termos originais preservados" } } },

  { "name": "multa-e-juros/empresa-que-nunca-configurou",
    "request": { "method": "GET", "path": "/v1/multa-e-juros" },
    "response": { "status": 200, "body": { "multaPercentual": 0, "jurosPercentual": 0 } } },

  { "name": "multa-e-juros/gravar",
    "request": { "method": "PUT", "path": "/v1/multa-e-juros",
                 "body": { "multaPercentual": 2.00, "jurosPercentual": 1.00 } },
    "response": { "status": 200, "body": { "multaPercentual": 2.00, "jurosPercentual": 1.00 } } },

  { "name": "automacao/gravar-politica",
    "request": { "method": "PUT", "path": "/v1/automacao-de-cobranca",
                 "body": { "ativo": true, "diasAntesDoVencimento": 3, "intervaloMinimoDias": 5,
                           "janelaInicio": "08:00", "janelaFim": "18:00", "canal": "EMAIL" } },
    "response": { "status": 200, "body": {
      "ativo": true, "diasAntesDoVencimento": 3, "intervaloMinimoDias": 5,
      "janelaInicio": "08:00", "janelaFim": "18:00", "canal": "EMAIL" } } },

  { "name": "automacao/janela-invertida",
    "request": { "method": "PUT", "path": "/v1/automacao-de-cobranca",
                 "body": { "ativo": true, "diasAntesDoVencimento": 3, "intervaloMinimoDias": 5,
                           "janelaInicio": "18:00", "janelaFim": "08:00", "canal": "EMAIL" } },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "janelaFim" } } },

  { "name": "aviso-manual/enviado",
    "request": { "method": "POST",
                 "path": "/v1/automacao-de-cobranca/cobrancas/COB-2026-0000001/avisos", "body": {} },
    "response": { "status": 200, "body": {
      "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "cobrancaCodigo": "COB-2026-0000001",
      "criadoEm": "2026-03-15T11:00:00.000Z",
      "caminho": "MANUAL", "desfecho": "ENVIADA",
      "destinatario": "joao@exemplo.com.br", "causa": null } } },

  { "name": "aviso-manual/200-mas-a-entrega-falhou",
    "request": { "method": "POST",
                 "path": "/v1/automacao-de-cobranca/cobrancas/COB-2026-0000001/avisos", "body": {} },
    "response": { "status": 200, "body": {
      "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "cobrancaCodigo": "COB-2026-0000001",
      "criadoEm": "2026-03-15T11:02:00.000Z",
      "caminho": "MANUAL", "desfecho": "FALHOU",
      "destinatario": "joao@exemplo.com.br",
      "causa": "o servidor de e-mail recusou a mensagem" } } },

  { "name": "aviso-manual/cobranca-paga",
    "request": { "method": "POST",
                 "path": "/v1/automacao-de-cobranca/cobrancas/COB-2026-0000001/avisos", "body": {} },
    "response": { "status": 422, "body": {
      "codigo": "CAMPO_INVALIDO", "mensagem": "requisição inválida", "campo": "codigo",
      "detalhes": { "estadoAtual": "PAGA" } } } },

  { "name": "rotinas/estado-das-tres",
    "request": { "method": "GET", "path": "/v1/automacao-de-cobranca/rotinas" },
    "response": { "status": 200, "body": { "itens": [
      { "rotina": "AVISO_DE_COBRANCA", "cadencia": { "tipo": "A_CADA_MINUTO" },
        "ultimaExecucao": "2026-03-15T11:04:00.000Z",
        "resumo": { "avaliadas": 42, "enviadas": 3 },
        "proximaEsperada": "2026-03-15T11:05:00.000Z",
        "atrasada": false, "impedimento": null,
        "historicoRecente": [ { "ocorridaEm": "2026-03-15T11:03:00.000Z",
                                "resumo": { "avaliadas": 41, "enviadas": 0 } } ] },
      { "rotina": "ENCERRAMENTO_DE_CONTRATOS", "cadencia": { "tipo": "DIARIA", "hora": "00:02" },
        "ultimaExecucao": "2026-03-15T00:02:00.000Z",
        "resumo": { "encerrados": 0 },
        "proximaEsperada": "2026-03-16T00:02:00.000Z",
        "atrasada": false, "impedimento": null, "historicoRecente": [] },
      { "rotina": "CONFERENCIA_DE_LIQUIDACAO", "cadencia": { "tipo": "DIARIA", "hora": "03:00" },
        "ultimaExecucao": null, "resumo": null,
        "proximaEsperada": "2026-03-16T03:00:00.000Z",
        "atrasada": true,
        "impedimento": { "codigo": "INTEGRACAO_BANCARIA_PENDENTE",
                         "mensagem": "a integração bancária desta empresa ainda não está completa" },
        "historicoRecente": [] } ] } } }
]
```

⚠️ **`criar-pessoa/sucesso` é a fixture que prova as três normalizações do servidor** — o documento
volta **só com dígitos**, o e-mail volta **em minúsculas** e o `estado` volta **em maiúsculas**. Um
teste que mande o valor já normalizado não prova nada; mande mascarado, como o formulário manda.

⚠️ **`retirar-de-circulacao/repetida-e-idempotente` só discrimina em PAR com a anterior**: as duas
respostas são iguais **de propósito**, e o que se prova é que o `retiradoEm` **não foi reescrito**
(§6.8). Sozinha, ela passa com qualquer implementação.

⚠️ **Locador, locatário e fiador falam o mesmo modelo** (§7.6): as fixtures de pessoa servem para os
três, trocando o segmento do caminho — o locatário apenas acrescenta `emailConfirmadoEm`. Do mesmo
modo, `retirada`/`recirculacao` têm forma idêntica em conjunto, imóvel, contrato e nos três papéis de
pessoa, e devolvem **o recurso daquela família**, não um envelope próprio.

⚠️ **`aviso-manual/200-mas-a-entrega-falhou` é a fixture do erro mais fácil desta área**: o HTTP é
`200` e a entrega **não aconteceu**. Quem decidir pelo status vai anunciar sucesso ao usuário. Quem
decide é `desfecho` (§7.11).

---

## 21. Testes mínimos do frontend

> **Enxuto por decisão.** Não é a suíte do app; é o **piso** que prova que a integração respeita este
> contrato. Cada linha é um comportamento verificável contra as fixtures da §20, sem backend rodando.
> Os quatro percursos ponta a ponta (Playwright) que o plano prevê **rodam na máquina do frontend**,
> não neste servidor.

| # | Tipo | Comportamento provado | Fixture |
|---|---|---|---|
| 1 | cliente HTTP | toda chamada sai com `credentials: 'include'` e **sem** `Authorization` | qualquer |
| 2 | cliente HTTP | erro é classificado por `codigo`; trocar o texto de `mensagem` **não** muda o fluxo | `entrar/recusada` |
| 3 | cliente HTTP | `429` é tratado sem ler `Retry-After` (o cabeçalho não existe) | `entrar/limite-de-taxa` |
| 4 | entrada | `twoFactorRedirect: true` roteia para o 2º fator, **não** para o Dashboard | `entrar/exige-segundo-fator` |
| 5 | entrada | após entrar, `GET /v1/sessao` é chamado **antes** de qualquer roteamento | `sessao/admin-completa` |
| 6 | entrada | `401 CREDENCIAL_INVALIDA` mostra *"não foi possível entrar"*, sem diagnóstico inventado | `entrar/recusada` |
| 7 | sessão | `senhaProvisoria: true` roteia para a troca e **não** dispara carga de dados | `sessao/restrita-por-senha-provisoria` |
| 8 | sessão | `403` numa rota qualquer refaz `GET /v1/sessao` e decide pelas bandeiras, nunca pelo texto | `qualquer/sessao-restrita` |
| 9 | sessão | `SYSLOC_MASTER` vê a página explicativa, não menu vazio nem erro | `sessao/master-sem-empresa` |
| 10 | menu | o menu é derivado de `telas`; controle sensível exige a **ação e a área** | `sessao/restrita-por-senha-provisoria` |
| 11 | menu | mudança de `versaoPermissoes` remonta o menu | as duas fixtures de sessão |
| 12 | senha | os motivos de `detalhes.motivos` marcam **todas** as regras violadas de uma vez | `trocar-senha/politica-violada` |
| 13 | listagem | `total: 0` com `itens: []` renderiza o estado vazio, não erro | `listar-contratos/vazio` |
| 14 | listagem | o paginador dimensiona por `total`, não pelo tamanho de `itens` | `listar-contratos/pagina-cheia` |
| 15 | listagem | nenhuma query string carrega parâmetro fora do documentado | `listar-contratos/parametro-desconhecido` |
| 16 | formulário | `422` com `campo` marca **aquele** campo; `422` com `detalhes.estadoAtual` releva o recurso | `ativar-contrato/nao-e-rascunho` |
| 17 | contratos | criar é **um** `POST`; ativar é **um** `POST` sem corpo | `criar-contrato/rascunho`, `ativar-contrato/sucesso-com-parcelas` |
| 18 | contratos | a tela informa quantas parcelas nasceram, lendo `efeitos.cobrancasGeradas` | `ativar-contrato/sucesso-com-parcelas` |
| 19 | contratos | `IMOVEL_COM_CONTRATO_VIGENTE` exibe o `contratoVigente` para o usuário saber o que cancelar | `ativar-contrato/imovel-ja-ocupado` |
| 20 | contratos | **não existe** botão "encerrar contrato" em lugar nenhum | — (§7.8) |
| 21 | contratos | `PUT` manda o objeto **completo**; nenhum envio parcial sai do cliente | `alterar-contrato/nao-e-rascunho` |
| 22 | cobranças | `status` e a mora vêm do servidor; o cliente **não** os calcula | `listar-cobrancas/recorte-por-status` |
| 23 | cobranças | reemitir boleto é **uma** chamada — nenhum encadeamento no cliente | `emitir-boleto/sucesso` |
| 24 | cobranças | o `503` com `boleto: "SEM_BOLETO"` diz *"a cobrança ficou sem boleto"* e oferece emitir de novo | `emitir-boleto/revogou-mas-nao-emitiu` |
| 25 | cobranças | cancelar cobrança e revogar boleto são **dois** controles distintos | `revogar-boleto/sem-boleto-vivo` |
| 26 | cobranças | histórico vazio é `200` e renderiza *"sem movimento bancário"*, não "não encontrado" | `historico-bancario/sem-efeito-algum` |
| 27 | cobranças | `DIVERGENCIA_DE_VALOR` é destacado na trilha, com `valorInformado` | `historico-bancario/com-divergencia` |
| 28 | lote | `detalhes.loteEmCurso` leva ao acompanhamento do lote existente, não a erro | `abrir-lote/ja-ha-um-em-curso` |
| 29 | lote | a tela consulta em intervalo enquanto `estado === "EM_ANDAMENTO"` e para ao concluir | `abrir-lote/aceito`, `acompanhar-lote/concluido-com-recusas` |
| 30 | conferência | `iniciadaAgora: false` mostra *"em andamento desde …"*, não erro nem "iniciada" | `conferencia/ja-em-andamento` |
| 31 | integrações | os **três** códigos de recusa do certificado produzem **três** mensagens distintas | as três fixtures de recusa |
| 32 | integrações | `estado: "VENCENDO"` gera o banner; `VENCIDO` **não** impede a consulta | `ler-certificado/vencendo` |
| 33 | integrações | `identificadorDaAplicacao` **nunca** é exibido nem pré-preenchido | `registrar-identidade/sucesso` |
| 34 | integrações | os **quatro** desfechos da ativação são distinguidos comparando `verificadaEm` | as quatro fixtures de ativação |
| 35 | integrações | **não existe** botão de desabilitar webhook nem de remover certificado | — (§8.4) |
| 36 | integrações | sem `ACAO:configurar_integracao`, os blocos 2 e 3 da tela ficam ocultos — **não** em erro | `sessao/restrita-por-senha-provisoria` |
| 37 | pública | a página de confirmação lê o **fragmento** da URL e trata o segundo `200` como sucesso | `confirmar-email/segundo-clique-no-mesmo-link` |
| 38 | higiene | nenhuma senha, senha provisória ou segredo é persistido no cliente | `criar-usuario/sucesso` |
| 39 | cadastros | documento mascarado, e-mail em maiúsculas e UF minúscula são aceitos, e a tela reexibe **o que o servidor devolveu** | `criar-pessoa/sucesso` |
| 40 | circulação | retirar duas vezes é `200` e **não** reescreve `retiradoEm`; a tela não anuncia "retirado agora" na segunda | as duas fixtures de retirada |
| 41 | imóveis | o `PUT` do imóvel **não** manda `statusLocacao`; mudar situação usa a rota própria | `alterar-imovel/status-de-locacao-e-chave-desconhecida` |
| 42 | imóveis | remover cômodo do meio deixa posições **não contíguas**, e a planta não reordena | `remover-comodo/posicoes-nao-sao-reatribuidas` |
| 43 | automação | `200` com `desfecho: "FALHOU"` é apresentado como **falha de entrega**, com a `causa` | `aviso-manual/200-mas-a-entrega-falhou` |
| 44 | automação | `impedimento` vira o link que o resolve, e `resumo` é renderizado genericamente | `rotinas/estado-das-tres` |

⚠️ **Os testes 40 e 42 só discriminam em par com a fixture certa** — o primeiro compara o
`retiradoEm` entre as duas respostas, o segundo confere que as posições saíram `1` e `3`. Escritos
como "responde 200", os dois passam com qualquer implementação.

⚠️ **Os testes 20, 35 e 36 provam AUSÊNCIA**, e por isso não têm fixture: eles se escrevem como
asserção negativa sobre a árvore renderizada. São os três que mais fácil passam despercebidos, e são
exatamente os três em que o sistema antigo tinha um botão que aqui não pode existir.

---

## 22. Dúvidas, hipóteses e o que esta auditoria mediu

> **Este documento não tem `[DÚVIDA]`, e a ausência é resultado, não omissão.** A convenção da skill
> que auditou este handoff marca `[DÚVIDA]` no que bloqueia a implementação e `[HIPÓTESE]` no que é
> inferência razoável mas não confirmada. Abaixo está o que a auditoria de 2026-08-24 mediu, e as
> **duas** marcas que ela julgou devidas.

### 22.1 O que foi conferido contra o código, e bateu

| Afirmação do documento | Como foi medida | Resultado |
|---|---|---|
| 106 rotas / 91 manipuladores, superfície congelada | varredura dos decoradores de rota em `apps/api/src/**/*.controller.ts`, com as constantes de caminho resolvidas | **91 manipuladores**, igual à constante executável `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` |
| a §17 cobre a superfície inteira | diferença entre as rotas extraídas do código e as citadas no documento | **nenhuma rota do código ficou de fora**; as ausências aparentes eram segmento elidido (`/v1/…/:id/retirada`) ou o Painel Master, fora de escopo por decisão (§16) |
| os onze códigos de erro | `CodigoErro` e `STATUS_POR_CODIGO` em `packages/shared/src/erros.ts` | **11 e 11**, com os mesmos status da §3.1 |
| o catálogo 10 × 7 | `packages/auth/src/catalogo-de-permissoes.ts` | **10 telas, 7 ações**, e cada ação atada à área que a §5.1 declara |
| `versaoPermissoes` em camelCase | `apps/api/src/autenticacao/sessao.controller.ts` | confirmado, junto de `senhaProvisoria`, `segundoFatorPendente`, `telas` e `acoes` |
| paginação `limite`/`deslocamento`, teto 200, padrão 50 | `packages/contracts/src/comum.ts` → `MAIOR_PAGINA`, `PAGINA_PADRAO`, `envelopeDeLista` | confirmado, e o envelope tem exatamente os quatro campos da §6.3 |
| `REQUISICAO_RECUSADA` sai com o status de origem | `apps/api/src/comum/filtro-excecao.ts` | confirmado — e ele é **código de fecho do filtro**, proibido a código de negócio por marcador `DECISÃO FECHADA`, de modo que o `400` da tabela padrão **não alcança o cliente** |

### 22.2 As duas marcas devidas

- `[HIPÓTESE]` **As duas rotas toleradas de `/v1/auth` continuarão respondendo.** A §4.1 autoriza
  `POST /v1/auth/two-factor/verify-backup-code` e `GET /v1/auth/get-session`, e as nomeia a partir de
  `SUPERFICIE_TOLERADA` em `apps/api/test/autenticacao.e2e.spec.ts`. Elas são **toleradas, não
  declaradas**: nascem do encaminhador curinga do arcabouço, não de rota que este produto publique.
  O congelamento da superfície (§18) alcança as rotas **declaradas** — uma atualização do arcabouço
  poderia mexer nas toleradas sem que nenhuma âncora deste repositório reprovasse. **O frontend pode
  usar as duas**, como o documento autoriza; o que ele não deve fazer é construir fluxo que **só**
  funcione por elas. Para `get-session` a saída já está escrita: prefira `GET /v1/sessao`.
- `[HIPÓTESE]` **A chamada de outra origem depende de configuração que ainda não existe.** A §14.1
  declara que hoje a API não aceita requisição de origem diferente, e que a religação acontece na F7,
  atrás do servidor de borda. Enquanto isso não for feito, o desenvolvimento local do React
  **precisa** de um proxy que sirva app e API no mesmo endereço. Isso é **pendência conhecida do
  backend**, não incerteza sobre o contrato: nenhum payload, código de erro ou permissão desta §7
  muda por causa dela.

### 22.3 O que **não** virou dúvida, e por quê

Três candidatos foram examinados e recusados:

1. **As 6 rotas de `/v1/master`.** Não são omissão: o Painel Master é outro aplicativo, com handoff
   próprio (§16), e o app do Sysloc **não as chama**.
2. **`GET /saude` e `GET /saude/pronto`.** Estão declaradas na §7.15 como superfície que não é rota
   de tela. O documento diz o que a tela pode fazer com cada uma.
3. **A ausência de `409` em toda a superfície.** Não é lacuna do documento: é o contrato. O conflito
   de transição é `422` com `detalhes.estadoAtual`, e a §19 o registra como coluna própria.

### 22.4 Quatro precisões que esta auditoria acrescentou

Nenhuma contradiz as §0 a §18 — as quatro **completam** o que elas diziam sem o detalhe que o
cliente HTTP precisa. As fixtures da §20 já saem corrigidas.

| Onde | O documento dizia | O código diz, e a fixture agora traz |
|---|---|---|
| ação concedida sem a área (§7.2) | *"`422` nomeando a tela exigida"* | `campo: "permissoes"` — **não** `"ajustes"`, que é o campo do outro `422` da mesma rota — e `detalhes: { telaExigida, acao }`, com **as duas** chaves <br><!-- fonte: packages/auth/src/efetivo.ts → `validarCoerenciaDeAjustes` --> |
| troca de perfil com ajustes a perder (§7.2) | *"`422` com `detalhes.ajustesDescartados`"* | o `campo` é **`"perfil"`** <br><!-- fonte: apps/api/src/usuarios/usuario.service.ts → `trocarPerfil` --> |
| alvo é quem age (§7.2) | *"`422` com `detalhes.motivo: "ALVO_E_QUEM_AGE"`"* | o `campo` é **`"id"`** <br><!-- fonte: apps/api/src/usuarios/usuario.service.ts → `CAMPO_DO_ALVO`, `MOTIVO_DE_AUTO_ALVO` --> |
| limitador de taxa (§3.4, §7.1) | os tetos de `/v1/auth` e da troca de senha | **não há mais nenhum**: sem limitador global em `main.ts`, e a rota pública de confirmação não tem decorador de taxa. O `429` **não** acontece em rota de negócio |

⚠️ **A terceira linha importa mais do que parece.** `campo: "id"` num `422` é contraintuitivo — o
`id` está no **caminho**, não no corpo —, e uma tela que só marque campos de formulário pelo `campo`
do envelope vai procurar um campo `id` que não existe no formulário. Este `422` se apresenta como
aviso do ato, não como marca de campo.

---

## 23. Procedência desta ampliação

- **As §19 a §22 foram geradas em 2026-08-24** por `/agent-spec-backend-contract-handoff`, sobre o
  documento já existente. **As §0 a §18 não foram reescritas** — o handoff foi escrito à mão por
  decisão expressa do usuário, e o Protocolo Antirregressão (`.claude/rules/nao-regressao.md`) trata
  desfazer decisão registrada como regressão. Esta ampliação **acrescenta**, e a única alteração
  fora dela é a linha nova no mapa de leitura da §0.
- **Entrada da skill.** A skill exige `tech_spec.md`, `scope.md` ou TaskCard como âncora. O argumento
  recebido foi o próprio handoff. Sob a `.claude/rules/autonomia-do-run.md` §A1, a pergunta não
  bloqueia: adotou-se a recomendada — **as 15 specs de fatia que publicam rota**
  (`docs/specs/features/*/{v1,v*}/tech_spec.md` e `scope.md`) como âncora coletiva, já que o handoff
  cobre a superfície inteira e não uma fatia.
- **O que a skill exigia e não existia:** fixtures (§20), a matriz de estados de UI (§19), os testes
  mínimos (§21) e as marcas `[DÚVIDA]`/`[HIPÓTESE]` (§22). O que já existia e foi **conferido, não
  reescrito**: contratos por operação (§7, §8), permissões por rota (§5, §7), mapeamento de erro para
  comportamento de tela (§3.1) e rastreabilidade por símbolo (39 citações `<!-- fonte: -->`).
- **Auditoria de drift: nenhuma divergência encontrada** entre o documento e o código. O detalhe está
  na §22.1.
