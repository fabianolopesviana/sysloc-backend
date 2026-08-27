# O backend está pronto — instruções para a implementação do **app Sysloc**

> **Para quem é:** o agente que implementa o frontend React do **Sysloc** (app de gestão de locação),
> na máquina local, a partir de `handoff-frontend.md`.
>
> **Data desta medição: 2026-08-27.** Tudo abaixo foi **medido neste servidor**, não estimado. Onde
> um número aparece, ele saiu de um comando cuja saída foi lida.

---

## 1. O que está pronto

| | |
|---|---|
| Fases F0 a F5 | **concluídas** — 147 tasks aprovadas em dois gates (QA + Tech Review) |
| Suíte automatizada | **2004 casos**, 9 pacotes, todos verdes |
| Superfície da API | **106 rotas / 91 manipuladores / 20 públicas** — **CONGELADA** |
| Pacote de contratos | `@syslocbr/contracts@1.0.0`, publicado e privado |
| API em execução | `active`, respondendo |
| Processador de trabalho | `active`, com 6 rotinas agendadas rodando |

**A superfície está congelada**: nenhuma rota será acrescentada, removida ou alterada. O que
`handoff-frontend.md` descreve é o que existe, e continuará existindo. Você pode implementar contra
ele sem medo de retrabalho por mudança de contrato.

⚠️ **`handoff-frontend.md` continua sendo a fonte** do modelo de domínio, do catálogo de telas, do
contrato rota a rota e do mapa dos 35 caminhos ERPNext antigos. **Este documento não o substitui** —
ele acrescenta o que faltava: como alcançar a API, como autenticar e como rodar testes de verdade.

---

## 2. O pacote de contratos

O escopo **mudou em 2026-08-27** e isto é a primeira coisa a acertar:

```bash
pnpm add zod@4.4.3
pnpm add @syslocbr/contracts@1.0.0
```

⚠️ **O escopo é `@syslocbr`, e NÃO `@sysloc`.** O GitHub Packages exige que o escopo do pacote case
com o login do dono, e `sysloc` pertence a uma conta pessoal de terceiro criada em 2019 — medido por
API. A organização `syslocbr` foi criada para isso. Se você encontrar `@sysloc/contracts` em algum
texto antigo, é referência vencida.

⚠️ **`zod@4.4.3` EXATAMENTE.** `zod` é dependência normal e fixada do pacote. Com qualquer outra
versão do seu lado, o gerenciador instala uma **segunda cópia aninhada**, e as duas não se conhecem:
`instanceof ZodError` passa a ser falso entre um esquema do pacote e um `z` local, e o bundle carrega
`zod` duas vezes. O sintoma aparece só em tempo de execução, e é difícil de diagnosticar.

O pacote é **Zod puro em runtime** — você importa os esquemas e valida de verdade, não apenas os
tipos. ⚠️ **Não há cliente ts-rest.** Se algum documento o mencionar, está vencido: ele foi avaliado
e não existe nos manifests.

---

## 3. Como alcançar a API — túnel, e por quê

**A API escuta apenas em `127.0.0.1:3000` do servidor.** Ela não tem endereço público próprio, e
isso é deliberado: `sysloc.systera.com.br` ainda serve o sistema **antigo** (Frappe/ERPNext), e só
passa a apontar para o backend novo na virada, que acontece depois que o seu trabalho estiver pronto.

Portanto, para desenvolver:

### 3.1 Túnel SSH — deixe rodando

```bash
ssh -N -L 3000:127.0.0.1:3000 sysloc@<servidor>
```

Enquanto ele estiver aberto, `http://127.0.0.1:3000` **na sua máquina** é a API real. Confira:

```bash
curl -s http://127.0.0.1:3000/v1/sessao
# esperado: {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
```

### 3.2 Proxy do dev server — obrigatório para o navegador

```ts
// vite.config.ts
server: {
  proxy: {
    '/v1': {
      target: 'http://127.0.0.1:3000',
      changeOrigin: true,
      configure: (proxy) =>
        proxy.on('proxyReq', (r) => r.setHeader('origin', 'http://127.0.0.1:3000')),
    },
  },
}
```

⚠️ **A linha do `setHeader('origin', …)` não é opcional.** A API confere a origem, e o comportamento
foi **medido em 2026-08-27**:

| `Origin` enviado | Resposta |
|---|---|
| `http://127.0.0.1:3000` | ✅ atravessa |
| `https://syslocadmin.systera.com.br` | ✅ atravessa |
| `http://localhost:5173` | ❌ **`ACESSO_NEGADO`** |
| `https://evil.example.com` | ❌ `ACESSO_NEGADO` |
| **sem cabeçalho `Origin`** | ✅ atravessa |

Sem a reescrita, o navegador manda `Origin: http://localhost:5173` e **toda** requisição autenticada
falha com 403. Com ela, a requisição chega com a origem derivada do endereço de escuta, que o
arcabouço de identidade considera confiável por construção.

⚠️ **Não peça para afrouxar `ORIGENS_PUBLICAS` no servidor** para incluir `localhost`. Isso enfraquece
a produção para viabilizar o desenvolvimento, e a reescrita no proxy resolve sem esse custo.

### 3.3 ⚠️ A armadilha que quebra o build de produção

**Chame sempre `/v1/...` em caminho relativo.** Nunca embuta `http://127.0.0.1:3000` no código.

```ts
fetch('/v1/imoveis')                        // ✅ certo
fetch('http://127.0.0.1:3000/v1/imoveis')   // ❌ quebra em produção
```

O proxy só existe em `vite dev` — o `vite build` ignora a chave `server` inteira. Uma URL absoluta
embutida sai no bundle apontando para o loopback da máquina que compilou. Em produção, o frontend
será servido da **mesma origem** da API, e o caminho relativo funciona naturalmente.

---

## 4. Como autenticar

Autenticação é **por sessão em cookie**, via `better-auth`, sob `/v1/auth`. O `handoff-frontend.md`
descreve o fluxo; o que segue é o estado dos dados neste servidor.

### O que existe hoje (medido em 2026-08-27)

| | |
|---|---|
| `SYSLOC_MASTER` | **1** |
| `ADMIN_EMPRESA` | **1** |
| Empresas | **1** — `TECHTEL TECNOLOGIA EM TELECOMUNICACOES LTDA`, **não suspensa** |

⚠️ **O perfil chama-se `ADMIN_EMPRESA`**, não `ADMIN`. Os três perfis são `SYSLOC_MASTER`,
`ADMIN_EMPRESA` e `USUARIO_EMPRESA`.

⚠️ **O cadastro público está DESLIGADO** (`disableSignUp`). Não existe tela de auto-registro, e
tentar criar conta pela API não funciona por decisão de produto. Pessoas nascem por ato do Master ou
do Admin da empresa.

### Se a senha do Admin não for conhecida

O operador do SaaS emite senha provisória:

```
POST /v1/master/usuarios/:id/senha-provisoria     (sessão SYSLOC_MASTER)
POST /v1/usuarios/:id/senha-provisoria            (sessão ADMIN_EMPRESA)
```

A senha provisória sai **uma única vez** na resposta — nenhuma consulta posterior a recupera.

⚠️ **Empresa suspensa impede a entrada de todos os usuários dela** (RN-10), e o erro não diz isso
explicitamente. A TECHTEL **não** está suspensa hoje; se um login inexplicável começar a falhar,
confira isso antes de procurar bug no frontend.

---

## 5. ⚠️ A base de negócio está VAZIA

Medido em 2026-08-27:

| Imóveis | Locadores | Locatários | Contratos | Cobranças |
|---|---|---|---|---|
| **0** | **0** | **0** | **0** | **0** |

**Isso não é defeito, e não bloqueia nada** — mas muda como você trabalha:

- as telas de listagem começam **vazias**; implemente e teste o estado vazio primeiro, que é um
  estado real e frequentemente esquecido;
- para exercitar filtro, paginação, ordenação e detalhe, **crie os dados pelas rotas de cadastro**;
- **cada teste deve criar o que precisa** e não depender de dado pré-existente. É a única forma de o
  teste ser repetível — e é como a suíte do backend já funciona.

Sequência mínima para um cenário completo, com sessão de `ADMIN_EMPRESA`:

```
POST /v1/locadores      → cria o proprietário
POST /v1/imoveis        → cria o imóvel (vincula o locador)
POST /v1/locatarios     → cria o inquilino
POST /v1/contratos      → cria o contrato (imóvel + locatário)
                        → as cobranças derivam do contrato
```

Confira os campos exatos de cada corpo no `handoff-frontend.md` e nos esquemas Zod do pacote — **não
os digite de memória**, os esquemas são a fonte e recusam campo desconhecido na entrada.

---

## 6. O contrato de erro — 11 códigos, e só

Todo erro da API tem a mesma forma: `{ codigo, mensagem, campo?, detalhes? }`.

| Código | HTTP |
|---|---|
| `CAMPO_INVALIDO` | 422 |
| `RECURSO_NAO_ENCONTRADO` | 404 |
| `ERRO_INTERNO` | 500 |
| `SERVICO_INDISPONIVEL` | 503 |
| `CREDENCIAL_INVALIDA` | 401 |
| `NAO_AUTENTICADO` | 401 |
| `ACESSO_NEGADO` | 403 |
| `REQUISICAO_RECUSADA` | 400 |
| `MATERIAL_EM_FORMATO_NAO_SUPORTADO` | 422 |
| `SENHA_DO_MATERIAL_NAO_ABRE` | 422 |
| `CERTIFICADO_COM_VALIDADE_ENCERRADA` | 422 |

⚠️ **São exatamente estes 11.** Não trate código que não esteja na lista, e não invente tratamento
por `mensagem` — a mensagem é para humanos e pode mudar; o `codigo` é o contrato.

⚠️ Os dois `401` são perguntas diferentes: `CREDENCIAL_INVALIDA` é "a entrada não foi aceita";
`NAO_AUTENTICADO` é "não há sessão válida". O `403` (`ACESSO_NEGADO`) é outra ainda: **há** sessão, e
ela não alcança o pedido.

⚠️ **`429` não existe** em rota de negócio. Ele só aparece sob `/v1/auth` e em `POST /v1/sessao/senha`.

**Paginação:** `limite` máximo **200**, padrão **50**. Pedir acima do teto **recusa** com
`CAMPO_INVALIDO` — a API não trunca em silêncio.

---

## 7. Rodando testes contra a API real

**Testes de integração (Vitest/node, sem navegador) funcionam pelo túnel sem nada especial** — eles
não enviam cabeçalho `Origin`, e a tabela da §3.2 mostra que a API os aceita. Aponte a base para
`http://127.0.0.1:3000` e chame direto.

Para testes de navegador (Playwright), suba o dev server com o proxy da §3.2 e aponte a base para
ele — a mesma reescrita de `Origin` vale.

⚠️ **Pré-condição de todo teste de integração: o túnel aberto.** Se ele cair, os testes falham com
recusa de conexão, e o sintoma parece defeito de código. Verifique o túnel antes de investigar.

⚠️ **O banco é o da operação.** Não há base de teste separada do outro lado do túnel. Isso tem
consequência prática: **dado que seus testes criam, fica lá.** Prefira criar registros com marcação
reconhecível e limpar ao final, ou converse com o operador sobre uma janela de limpeza. Não escreva
teste que apague em massa.

---

## 8. Como o build será servido — o que o handoff não diz

⚠️ **O `handoff-frontend.md` não tem seção de publicação** (o do Painel Master tem; o seu não). Estas
são as exigências da borda que já está versionada em `deploy/nginx/sysloc-app.conf`, e elas decidem
escolhas de arquitetura que custam caro para desfazer depois:

- **Página única estática.** O vhost declara `root <raiz do aplicativo>` e `index index.html`, e
  serve arquivos do disco. **Não há Node servindo o frontend** — nada de SSR, nada de framework que
  exija processo próprio em produção. O build tem de produzir HTML/CSS/JS estáticos.
- **Fallback de SPA:** `try_files $uri $uri/ /index.html`. Roteamento no cliente funciona, e
  recarregar uma rota profunda devolve o `index.html`. Você **não** precisa de hash router.
- **A aplicação vive na RAIZ (`/`)**, não em subpath. Não configure `base` do Vite para um prefixo.
- ⚠️ **`/v1` é reservado para a API** e é encaminhado antes do fallback. **Nenhuma rota de interface
  pode começar com `/v1`** — ela seria engolida pelo proxy e nunca chegaria ao seu roteador.
- ⚠️ **`/docs`, `/docs/json` e `/docs-yaml` são recusados na borda**, por decisão de segurança: o
  contrato OpenAPI não é público. Não conte com eles em produção — use os esquemas do pacote.
- Em produção, **frontend e API dividem a origem**, e é por isso que caminho relativo (`/v1/...`)
  funciona sem CORS e sem configuração alguma.

⚠️ **Quando o app for publicado, ele assume `sysloc.systera.com.br`** — o mesmo hostname que hoje
serve o sistema antigo. A troca é feita pelo operador, num procedimento próprio, e **não é trabalho
seu**. O que cabe a você é entregar um build que satisfaça a lista acima.

---

## 9. O que **não** existe, e não adianta procurar

- **Cliente ts-rest** — avaliado e recusado; o pacote é Zod puro.
- **Tela de auto-registro** — cadastro público desligado por decisão.
- **Rota nova** — a superfície está congelada; se algo parece faltar, é caso de conversar, não de
  esperar.
- **CORS configurado** — por decisão. O caminho é proxy no dev e mesma origem em produção.
- **Endereço público da API** — só o túnel, até a virada.

---

## 10. Se algo não funcionar, verifique nesta ordem

1. **O túnel está aberto?** `curl -s http://127.0.0.1:3000/v1/sessao` deve responder JSON.
2. **A resposta é `ACESSO_NEGADO` (403)?** É a reescrita de `Origin` faltando no proxy (§3.2).
3. **É `NAO_AUTENTICADO` (401)?** Não há sessão — o cookie não está sendo enviado, ou expirou.
4. **É `CREDENCIAL_INVALIDA` (401) no login?** Senha errada, ou a empresa está suspensa.
5. **É `CAMPO_INVALIDO` (422)?** O corpo não bate com o esquema Zod. O campo ofensor vem em `campo`.
6. **`pnpm add @syslocbr/contracts` dá 404?** Falta a linha `@syslocbr:registry=…` no `.npmrc`.
   Dá 401? É o token de leitura.

Nenhum desses casos é defeito do backend — todos foram medidos e têm causa conhecida.
