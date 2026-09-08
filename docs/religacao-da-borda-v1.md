# Religação da borda `/v1` em `sysloc.systera.com.br` — incidente, diagnóstico e plano de correção

> **Destinatário**: equipe de backend / infraestrutura do Sysloc
> **Emissor**: frontend (SPA React) — `sysloc`, commit `17bc795`
> **Data**: 2026-09-07
> **Severidade**: **ALTA** — aplicação publicada e não funcional; mais uma credencial a revogar
> **Ação requerida do backend**: 3 itens, detalhados na §8. Nenhum deles é alteração de código de aplicação.

---

## 1. Sumário executivo

O deploy do SPA para `https://sysloc.systera.com.br` foi executado em 2026-09-07 e **publicou os
arquivos com sucesso**, mas a aplicação **não funciona**, por causa de configuração da borda (nginx).
Há ainda uma credencial que precisa ser revogada.

| # | Item | Natureza | Prioridade | Dono |
|---|---|---|---|---|
| **1** | Revogar o par de API do usuário de serviço `servico-app@dominio.com` no ERPNext | Segurança | **Imediata** | Backend/Infra |
| **2** | Encaminhar `location /v1/` para `127.0.0.1:3000` **antes** do `try_files` do SPA | Configuração nginx | **Imediata** — o app está quebrado sem isso | Infra |
| **3** | Incluir `https://sysloc.systera.com.br` nas origens confiáveis do serviço de identidade | Configuração do serviço | **Alta** — o login falha sem isso, mesmo com o item 2 feito | Backend |

**O item 3 é o motivo principal deste documento.** Ele não apareceu no log do deploy e **só se
manifesta depois** que o item 2 for aplicado — na tela de login, como `ACESSO_NEGADO`. Está descrito
na §7 para que a equipe não gaste um ciclo de diagnóstico redescobrindo-o.

Nada precisa ser alterado no repositório do frontend. O build satisfaz todas as guardas de
publicação; a evidência está na §9.

---

## 2. Contexto arquitetural — o que mudou no frontend

Quem acompanhou a migração pode pular para a §4.

O SPA passou por uma migração de 10 fatias, concluída em 2026-09-07, cujo efeito relevante aqui é
este:

| | Antes | Agora |
|---|---|---|
| **Backend** | ERPNext/Frappe, via `/api/*` | serviço multi-empresa, via `/v1/*` |
| **Autenticação** | token de API (`Authorization: token <key>:<secret>`), embutido no bundle | **cookie de sessão** (`httpOnly`), emitido pelo serviço |
| **Portas HTTP no cliente** | duas (legada + nova) | **uma** — `requestV1` (ADR-0018) |
| **Credencial no cliente** | sim, por desenho da arquitetura anterior | **nenhuma** — não há segredo no bundle |

A decisão está registrada na **ADR-0018** do repositório do frontend. O cliente HTTP legado, o
encaminhamento `/api` e a allowlist de áreas migradas **foram removidos do código** — não é uma
convivência, é uma substituição concluída.

**Consequência operacional direta, e é a raiz de tudo o que segue:** o bundle publicado hoje contém
**zero** referências a `/api/`. Toda comunicação da aplicação — sem exceção — sai como `/v1/...` em
caminho relativo, para o mesmo host de onde o SPA foi servido. Se a borda não encaminhar esse
prefixo, **nenhuma tela funciona**.

---

## 3. Ambiente e identificadores

| | |
|---|---|
| Domínio público | `https://sysloc.systera.com.br` |
| Servidor | `177.185.117.139`, SSH porta 22, usuário `sysloc` |
| Diretório publicado (raiz do vhost) | `/opt/react/sysloc/html` |
| Serviço `/v1` | escuta em **`127.0.0.1:3000`** no próprio servidor, sem endereço público |
| Bundle publicado | `static/js/main.0a8603df.js` |
| Backup do bundle anterior | `~/html-backup-20260907-194003` (criado pelo script de deploy) |
| Commit do frontend | `17bc795` |

---

## 4. Sintoma 1 — credencial do ERPNext publicada no bundle *(corrigido no frontend; ação pendente no servidor)*

### 4.1 O que aconteceu

A primeira execução do deploy foi **abortada pela guarda do próprio script**, antes de publicar:

```
[FALHA] O build carrega variaveis REACT_APP_ERPNEXT_* — ele ainda fala com o Frappe.
        O backend novo autentica por COOKIE de sessao; nao ha token de API no bundle.
```

A guarda estava correta. Verificado no artefato:

```bash
$ grep -c "<valor de REACT_APP_ERPNEXT_API_SECRET>" build/static/js/main.*.js
1
```

**A API key e o API secret do usuário de serviço `servico-app@dominio.com` estavam em texto claro no
JavaScript público.**

### 4.2 Causa-raiz

O Create React App **não embute o que o código lê — embute o que o ambiente declara**. Ele monta o
`DefinePlugin` a partir de *toda* variável com prefixo `REACT_APP_` presente no `process.env`
(carregado dos arquivos `.env*`), independentemente de existir uma única referência a ela no código.

O código do frontend havia deixado de ler essas variáveis desde a Fatia 10. O arquivo `.env.local`
continuou declarando-as. **O bundle continuou publicando-as.**

### 4.3 Correção aplicada no frontend

- As quatro variáveis `REACT_APP_*` foram removidas de `.env.local` e `.env.example`. O projeto **não
  possui mais nenhuma variável `REACT_APP_*`**, e a ausência é agora uma decisão travada por teste.
- Foi removida a última sonda de conectividade que ainda montava `Authorization: token <key>:<secret>`
  e chamava `method/auth_locacao_imoveis`, `method/all_imoveis` e `resource/Conjunto`.
- Duas cercas automatizadas passaram a reprovar a reintrodução: uma sobre os arquivos `.env*`, outra
  sobre todo o código-fonte (incluindo arquivos de teste).

Bundle reconferido após a correção: **zero** ocorrências do nome e do valor das credenciais.

### 4.4 ⚠️ Ação requerida do backend — item 1

**A correção no frontend não desvaza a credencial.** O bundle que esteve publicado carregava o par em
texto claro e foi servido publicamente. Deve-se assumir que ele foi exposto.

> **Revogar o par de API de `servico-app@dominio.com` no ERPNext.**
> Cópia de referência no servidor: `/opt/frappe/secrets/servico-app-credenciais.txt`.

Não é necessário emitir um par novo para o frontend: **a aplicação não usa mais token de API em
nenhum caminho**. Se algum outro consumidor (integração, script, rotina) usa esse mesmo par, ele
precisa receber um par próprio antes da revogação — vale conferir antes de revogar.

---

## 5. Sintoma 2 — `/v1/*` é engolido pelo fallback do SPA *(ação no servidor)*

### 5.1 O que o deploy reportou

Corrigido o item anterior, o deploy passou pelas três guardas de build, publicou os arquivos e
reprovou na validação final:

```
[ ok  ] Build sem credencial do Frappe.
[ ok  ] Build sem caminhos herdados do ERPNext.
[ ok  ] Build sem source maps.
[aviso] A borda ainda NAO encaminha /v1/* (tipo: 'text/html').
...
[ ok  ] GET / -> HTTP 200
[ ok  ] GET /contratos -> HTTP 200
[ ok  ] Bundle publicado confere com o build local (/static/js/main.0a8603df.js) e responde 200.
[FALHA] GET /v1/sessao -> HTTP 200, tipo 'text/html'.
        O vhost esta engolindo /v1/* no fallback do SPA
```

### 5.2 Confirmação independente

```bash
$ curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://sysloc.systera.com.br/v1/sessao
200 text/html

$ curl -s https://sysloc.systera.com.br/v1/sessao | head -c 60
<!doctype html><html lang="en"><head><meta charset="utf-8"/>
```

O serviço deveria responder **`401 application/json`** para essa rota sem sessão. Está respondendo o
`index.html` do SPA.

### 5.3 Diagnóstico

O vhost de `sysloc.systera.com.br` está configurado para servir uma *single-page application*, o que
implica um `try_files ... /index.html` capturando qualquer caminho não resolvido — comportamento
correto e necessário para as rotas de navegação do app (`/contratos`, `/financeiro`, …), que não
existem como arquivos em disco.

**Não existe um `location /v1/` declarado antes dele.** O prefixo da API cai no mesmo fallback, e o
nginx devolve HTML com status 200.

O modo de falhar é particularmente ruim de diagnosticar de fora: **não é 404 nem 502** — é `200` com
corpo HTML. Para o cliente HTTP do app, isso chega como resposta bem-sucedida com corpo inválido, e o
erro observável é `Unexpected token '<'` em toda tela.

### 5.4 Impacto atual

**A aplicação está publicada e inoperante.** A primeira requisição que o SPA emite ao abrir é
`GET /v1/sessao`, para descobrir a identidade e o alcance do usuário. Ela recebe HTML e falha antes
de qualquer tela renderizar.

**Rollback não é uma saída aceitável.** O backup em `~/html-backup-20260907-194003` contém o bundle
anterior, que fala `/api` **com a credencial do ERPNext embutida** (§4). Restaurá-lo troca uma falha
visível por um vazamento silencioso, e reintroduz a dependência do backend legado que a migração
eliminou. **A correção é para frente.**

---

## 6. Configuração proposta para o vhost

Aplicar no `server { }` de `sysloc.systera.com.br`, **antes** do `location /` que contém o
`try_files`. A ordem é o ponto inteiro: o `try_files` do SPA captura tudo que não casou em um
`location` anterior.

```nginx
# ---------------------------------------------------------------------------
# API do serviço multi-empresa. DEVE vir ANTES do `location /` com try_files.
# ---------------------------------------------------------------------------
location /v1/ {
    proxy_pass http://127.0.0.1:3000;      # sem barra final: preserva o URI /v1/... no upstream
    proxy_http_version 1.1;

    proxy_set_header Host              127.0.0.1:3000;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin            $http_origin;    # ver §7 — depende do item 3

    # O cookie de sessão não pode chegar ao navegador com o Domain do upstream:
    # o navegador o descartaria, e o sintoma se lê (erradamente) como
    # "o serviço não emitiu sessão".
    proxy_cookie_domain 127.0.0.1 $host;

    # Downloads de documento (PDF) passam por aqui e podem ser grandes.
    proxy_read_timeout 60s;
    proxy_buffering off;
}
```

### 6.1 Notas sobre cada diretiva

| Diretiva | Por quê |
|---|---|
| `proxy_pass` **sem** path | com `location /v1/` e `proxy_pass http://127.0.0.1:3000;`, o nginx repassa o URI original íntegro (`/v1/sessao`). Acrescentar uma barra final ao `proxy_pass` faria o nginx **remover** o prefixo `/v1` e o serviço receberia `/sessao` |
| `Host: 127.0.0.1:3000` | paridade com o ambiente de desenvolvimento, que usa `changeOrigin: true` (reescreve o `Host` para o do alvo). Se o serviço roteia por `Host`, confirmar o valor esperado antes de aplicar |
| `Origin: $http_origin` | repassa a origem real do navegador. **Depende do item 3** (§7); sem ele, `/v1/auth/*` recusa |
| `proxy_cookie_domain` | a sessão é por cookie `httpOnly`; sem esta linha o `Set-Cookie` pode chegar com domínio do upstream e ser descartado |
| `proxy_buffering off` | a rota de documentos devolve bytes de PDF, não JSON |

### 6.2 Escopo do encaminhamento — encaminhar **apenas** `/v1/`

O script de deploy verifica isso e emite aviso se detectar excesso:

```
[aviso] /docs esta servindo o Swagger da API para FORA — o vhost encaminha mais que /v1/.
        Encaminhe apenas 'location /v1/' para a API; /docs deve cair no fallback do app.
```

O documento OpenAPI do serviço (`/docs`) **não deve ser exposto** no domínio público. Qualquer
`location` mais amplo (`/`, `/api`, `/docs`) que aponte ao serviço é excesso.

---

## 7. Obstáculo previsto — conferência de `Origin` em `/v1/auth/*` *(item 3)*

**Este é o ponto que não aparece no log do deploy e que fará o login falhar mesmo depois da §6.**

### 7.1 O que se sabe, e como se sabe

O serviço de identidade confere o cabeçalho `Origin` das requisições a `/v1/auth/*` contra uma lista
de origens confiáveis, recusando as demais com `ACESSO_NEGADO` **antes de qualquer lógica de
negócio**. O comportamento foi **medido contra o serviço em 2026-08-27** e está registrado no handoff
de frontend (§24.2):

| `Origin` enviado | Resposta medida |
|---|---|
| `http://127.0.0.1:3000` (origem do próprio serviço) | ✅ atravessa |
| `https://syslocadmin.systera.com.br` | ✅ atravessa |
| `http://localhost:<porta do dev-server>` | ❌ `ACESSO_NEGADO` |
| origem qualquer de terceiro | ❌ `ACESSO_NEGADO` |
| **sem** cabeçalho `Origin` | ✅ atravessa |

### 7.2 O problema

O domínio recém-publicado é **`sysloc.systera.com.br`** — sem o `admin`. **Ele não consta da lista
medida.** A entrada `syslocadmin.systera.com.br` é do painel administrativo, que é outra aplicação,
com domínio e build próprios.

Assim que o item 2 for aplicado, o navegador passará a enviar
`Origin: https://sysloc.systera.com.br` nas chamadas de autenticação, e o serviço as recusará. O
sintoma será: **as telas carregam, mas o login falha com `ACESSO_NEGADO`** — sem relação aparente com
credencial incorreta.

Se a lista já tiver sido atualizada desde a medição de agosto, nada há a fazer. O teste da §8.3
confirma em um comando.

### 7.3 Recomendação — e por que **não** usar o atalho

**Recomendado: incluir `https://sysloc.systera.com.br` nas origens confiáveis do serviço.** Essa
passou a ser a origem pública legítima da aplicação; registrá-la é descrever a realidade, não
afrouxar a política.

> ⚠️ Isto **não** contradiz a orientação existente de *"não afrouxar as origens públicas"*, que se
> refere a incluir **`localhost`** para viabilizar desenvolvimento. São coisas distintas: aquilo
> abriria a produção para uma origem de máquina de desenvolvedor; isto registra o domínio de produção
> do próprio produto.

**Alternativa técnica que existe e que desaconselhamos em produção:** fazer o nginx sobrescrever o
cabeçalho com `proxy_set_header Origin http://127.0.0.1:3000;`. Funciona — é o mecanismo usado no
ambiente de desenvolvimento, onde não há alternativa. **Em produção, anula a proteção contra CSRF**
que a conferência de `Origin` existe para fornecer, para *toda* requisição que entre pelo vhost.
Use apenas como mitigação temporária consciente, e reverta assim que o item 3 for aplicado.

---

## 8. Plano de execução e verificação

### 8.1 Item 1 — revogar a credencial *(independente dos demais; pode ser feito já)*

Conferir antes se algum outro consumidor usa o mesmo par; se usar, emitir par próprio para ele.
Depois revogar. A aplicação frontend **não** precisa de substituto.

### 8.2 Item 2 — religar a borda

No servidor, **antes** de recarregar o nginx, confirmar que o serviço está de pé:

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://127.0.0.1:3000/v1/sessao
# esperado: 401 application/json
```

Aplicar o bloco da §6 e recarregar:

```bash
nginx -t && systemctl reload nginx
```

Verificar de fora:

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://sysloc.systera.com.br/v1/sessao
# esperado: 401 application/json      (hoje: 200 text/html)

curl -s -o /dev/null -w '%{http_code}\n' https://sysloc.systera.com.br/docs
# esperado: 200 servindo o SPA (fallback), NÃO o Swagger da API
```

### 8.3 Item 3 — verificar e corrigir a conferência de `Origin`

Executar **depois** do item 2, de fora do servidor:

```bash
curl -s -i -X POST https://sysloc.systera.com.br/v1/auth/entrar \
  -H 'Origin: https://sysloc.systera.com.br' \
  -H 'Content-Type: application/json' \
  -d '{"email":"inexistente@exemplo.com","senha":"senha-errada"}' | head -20
```

| Resultado | Leitura | Ação |
|---|---|---|
| recusa de **credencial** (`401`/`403` com código de credencial inválida) | a origem foi aceita — o item 3 já está resolvido | nenhuma |
| **`ACESSO_NEGADO`** | a origem foi recusada **antes** da checagem de credencial | aplicar o item 3 (§7.3) |

*(O e-mail e a senha do comando são propositalmente inválidos: o teste discrimina **em que camada** a
requisição foi recusada, e por isso não precisa de conta real.)*

### 8.4 Fecho

Com os itens 2 e 3 aplicados, executar novamente `./deploy-sysloc.sh` a partir da máquina de
desenvolvimento. A validação final (`check_api_v1`) deve reportar:

```
[ ok  ] A API responde no mesmo dominio: GET /v1/sessao -> 401 JSON (sem sessao).
```

---

## 9. Evidências de que o frontend está correto

| Verificação | Resultado |
|---|---|
| Guarda "sem credencial do Frappe" | ✅ zero ocorrências de `REACT_APP_ERPNEXT` e dos valores no bundle |
| Guarda "sem caminhos herdados do ERPNext" | ✅ zero ocorrências de `/api/resource/` e `/api/method/` |
| Guarda "sem source maps" | ✅ |
| Bundle publicado × build local | ✅ conferem (`main.0a8603df.js`), HTTP 200 |
| Rotas de navegação do SPA | ✅ `GET /` e `GET /contratos` → HTTP 200 |
| Suíte de testes | ✅ 2015 aprovados + 6 ignorados = 2021, em 180 suítes |
| Typecheck (`tsc --noEmit`) | ✅ limpo |
| Build de produção (`CI=true npm run build`) | ✅ compilado sem *warning* |

---

## 10. Anexo A — superfície `/v1` consumida pela aplicação

Encaminhar `/v1/` cobre todos eles; a lista serve para dimensionamento e conferência de rotas
publicadas, não para configurar `location` individuais.

**Identidade e sessão** — `auth/*` (entrada, saída, verificação de segundo fator, código de
recuperação, preparo de segundo fator), `sessao`, `sessao/senha`, `confirmacoes-de-email`.

**Domínio** — `imoveis`, `conjuntos`, `contratos`, `locadores`, `locatarios`, `fiadores`, `usuarios`,
`cobrancas`, `financeiro`, `cobranca-bancaria`, `automacao-de-cobranca`, `integracoes-bancarias`,
`multa-e-juros`, `documentos`.

**Observações relevantes para a borda:**

1. Todas as chamadas são feitas em **caminho relativo**, para o mesmo host que serviu o SPA. A
   aplicação nunca constrói URL absoluta para a API.
2. Todas enviam **cookies** (`credentials: 'include'`). O caminho do `Set-Cookie` precisa chegar
   íntegro ao navegador — daí a diretiva `proxy_cookie_domain`.
3. A rota de **documentos** responde `application/pdf` (bytes), não JSON. Buffering e timeout
   precisam acomodá-la.
4. Listagens usam paginação por `?limite=&deslocamento=`; nenhuma depende de reescrita de query pela
   borda.

---

## 11. Anexo B — referências

Documentos do repositório do frontend, disponíveis mediante solicitação:

| Documento | Conteúdo relevante |
|---|---|
| `docs/adr/0018-*.md` | a decisão de porta única e sessão por cookie |
| `.claude/plans/handoff-frontend.md` §24.1–24.3 | a tabela medida de `Origin`, o alvo do encaminhamento e a armadilha do caminho relativo |
| `.claude/plans/handoff-frontend.md` §24.7 | *"Quando o app for publicado, ele assume `sysloc.systera.com.br`… a troca é procedimento do operador"* |
| `docs/prontidao-do-backend-sysloc.md` | medição do serviço em 2026-08-27 |
| `src/setupProxy.js` | os três requisitos não-opcionais do encaminhamento, com as razões |
| `deploy-sysloc.sh` | as guardas de publicação e a validação `check_api_v1` |

---

## 12. Contato e retorno

Após aplicar os itens 2 e 3, avisar o time de frontend para reexecutar o deploy e confirmar o fecho.
Se algum item deste documento divergir do estado real do servidor — em especial a lista de origens
confiáveis da §7.1, medida em agosto — a medição corrente do backend prevalece, e agradecemos a
correção para que o handoff seja atualizado.
