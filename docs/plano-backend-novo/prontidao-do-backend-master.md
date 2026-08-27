# O backend está pronto — instruções para a implementação do **Painel Master**

> **Para quem é:** o agente que implementa o frontend React do **Painel Master**
> (`syslocadmin.systera.com.br`), na máquina local, a partir de `handoff-master-frontend.md`.
>
> **Data desta medição: 2026-08-27.** Tudo abaixo foi **medido neste servidor**, não estimado.

---

## 1. O que está pronto

| | |
|---|---|
| Fases F0 a F5 | **concluídas** — 147 tasks aprovadas em dois gates |
| Suíte automatizada | **2004 casos**, 9 pacotes, todos verdes |
| Superfície da API | **106 rotas / 91 manipuladores** — **CONGELADA** |
| Backend do Master | **completo** — as **6** rotas existem e respondem |
| Pacote de contratos | `@syslocbr/contracts@1.0.0`, publicado e privado |
| API em execução | `active`, respondendo pela borda pública |

⚠️ **O Painel Master é aplicativo SEPARADO**, com build próprio, servido de
`syslocadmin.systera.com.br`. Ele **não** compartilha código nem telas com o app Sysloc, e o
`handoff-master-frontend.md` é autossuficiente — não é preciso ler o handoff do outro app.

---

## 2. As 6 rotas do Master

Todas sob o prefixo `/v1/master`, todas exigindo sessão de perfil **`SYSLOC_MASTER`**:

```
GET   /v1/master/empresas                        lista as empresas
POST  /v1/master/empresas                        registra empresa nova, ativa
POST  /v1/master/empresas/:id/admin              cria o Admin da empresa
POST  /v1/master/empresas/:id/suspensao          suspende a empresa
POST  /v1/master/empresas/:id/reativacao         reativa a empresa
POST  /v1/master/usuarios/:id/senha-provisoria   emite senha provisória
```

⚠️ **São seis, e a superfície está congelada** — nenhuma rota nova nascerá. O contrato de cada corpo
está em `handoff-master-frontend.md` e nos esquemas Zod do pacote.

⚠️ **Suspender uma empresa impede a entrada de TODOS os usuários dela** (RN-10). É a ação mais
destrutiva do painel em termos de impacto ao cliente — trate-a na interface como tal, com
confirmação explícita.

---

## 3. O pacote de contratos

O escopo **mudou em 2026-08-27**:

```bash
pnpm add zod@4.4.3
pnpm add @syslocbr/contracts@1.0.0
```

⚠️ **`@syslocbr`, e NÃO `@sysloc`.** O GitHub Packages exige que o escopo case com o login do dono, e
`sysloc` pertence a conta de terceiro criada em 2019 — medido por API. Texto antigo que diga
`@sysloc/contracts` está vencido.

⚠️ **`zod@4.4.3` EXATAMENTE.** É dependência normal e fixada do pacote. Outra versão faz o gerenciador
instalar uma segunda cópia aninhada, e `instanceof ZodError` deixa de valer entre um esquema do
pacote e um `z` local. O sintoma aparece só em runtime.

⚠️ **Não há cliente ts-rest** — o pacote é Zod puro. Você importa os esquemas e valida de verdade.

---

## 4. Como alcançar a API — você tem duas vias, e a primeira é mais simples

### Via A — pela borda pública (recomendada, **sem túnel**)

O painel já é servido de `syslocadmin.systera.com.br`, e **a API responde no mesmo hostname**, sob
`/v1/*`. Medido em 2026-08-27:

```
GET  https://syslocadmin.systera.com.br/           -> 200 (text/html, o painel)
GET  https://syslocadmin.systera.com.br/v1/sessao  -> 401 (application/json, a API)
```

**Em produção não há CORS nenhum** — painel e API dividem a origem, que é o arranjo mais simples que
existe. No **desenvolvimento local**, aponte o proxy do dev server para lá:

```ts
// vite.config.ts
server: {
  proxy: {
    '/v1': {
      target: 'https://syslocadmin.systera.com.br',
      changeOrigin: true,
      configure: (proxy) =>
        proxy.on('proxyReq', (r) => r.setHeader('origin', 'https://syslocadmin.systera.com.br')),
    },
  },
}
```

### Via B — pelo túnel SSH (se precisar da API sem passar pela borda)

```bash
ssh -N -L 3000:127.0.0.1:3000 sysloc@<servidor>
```

E o proxy apontando para `http://127.0.0.1:3000`, com `origin` reescrito para o **mesmo** valor.

### ⚠️ Por que a reescrita de `origin` é obrigatória nas duas vias

A API confere a origem. Comportamento **medido em 2026-08-27**:

| `Origin` enviado | Resposta |
|---|---|
| `https://syslocadmin.systera.com.br` | ✅ atravessa |
| `http://127.0.0.1:3000` | ✅ atravessa |
| `http://localhost:5173` | ❌ **`ACESSO_NEGADO`** |
| `https://evil.example.com` | ❌ `ACESSO_NEGADO` |
| **sem cabeçalho `Origin`** | ✅ atravessa |

Sem a reescrita, o navegador manda `Origin: http://localhost:5173` e **toda** requisição falha com
403. ⚠️ **Não peça para incluir `localhost` nas origens confiáveis do servidor** — isso afrouxa a
produção para viabilizar o desenvolvimento, e o proxy resolve sem esse custo.

### ⚠️ A armadilha que quebra o build de produção

**Chame sempre `/v1/...` em caminho relativo.**

```ts
fetch('/v1/master/empresas')                                          // ✅ certo
fetch('https://syslocadmin.systera.com.br/v1/master/empresas')        // ❌ evite
fetch('http://127.0.0.1:3000/v1/master/empresas')                     // ❌ quebra em produção
```

O proxy só existe em `vite dev` — o `vite build` ignora a chave `server` inteira. URL absoluta
embutida sai no bundle e quebra quando o painel é servido da origem real.

---

## 5. Como autenticar

Sessão em cookie, via `better-auth`, sob `/v1/auth`. Estado dos dados, medido em 2026-08-27:

| | |
|---|---|
| `SYSLOC_MASTER` | **1** — há com que entrar no painel |
| `ADMIN_EMPRESA` | **1** |
| Empresas | **1** — `TECHTEL TECNOLOGIA EM TELECOMUNICACOES LTDA`, **não suspensa** |

⚠️ **Os perfis são `SYSLOC_MASTER`, `ADMIN_EMPRESA` e `USUARIO_EMPRESA`.** Não existe `ADMIN` — quem
escrever esse literal erra a comparação em silêncio.

⚠️ **As 6 rotas do Master exigem perfil `SYSLOC_MASTER`.** Uma sessão de `ADMIN_EMPRESA` recebe
`ACESSO_NEGADO` (403) — o que é correto, e é um bom caso de teste.

⚠️ **O cadastro público está DESLIGADO** (`disableSignUp`). O primeiro `SYSLOC_MASTER` não nasce pela
API — ele é criado por script no servidor, uma vez. Não implemente tela de auto-registro.

⚠️ **A senha provisória sai UMA ÚNICA VEZ** na resposta de
`POST /v1/master/usuarios/:id/senha-provisoria`. Nenhuma consulta posterior a recupera. A interface
precisa exibi-la de forma que o operador consiga copiá-la antes de sair da tela — se ele perder, o
único caminho é emitir outra.

---

## 6. ⚠️ Há exatamente UMA empresa cadastrada

Isso importa para as suas telas:

- a **listagem** tem 1 item — implemente e teste o **estado vazio** e a **paginação** criando
  empresas pela própria rota `POST /v1/master/empresas`;
- **cada teste deve criar o que precisa.** É a única forma de ser repetível;
- ⚠️ **o banco é o da operação** — não há base de teste separada. Dado que seus testes criam **fica
  lá**. Use nomes reconhecíveis e converse com o operador sobre limpeza. **Não escreva teste que
  apague em massa**, e não suspenda a TECHTEL num teste: ela é a empresa real.

---

## 7. O contrato de erro — 11 códigos, e só

Forma única: `{ codigo, mensagem, campo?, detalhes? }`.

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

⚠️ **Trate pelo `codigo`, nunca pela `mensagem`** — a mensagem é para humanos e pode mudar.

⚠️ Os três últimos são do material de certificado bancário e **não aparecem no Painel Master** —
estão aqui para a lista ficar completa e você não tratá-los como erro desconhecido.

**Paginação:** `limite` máximo **200**, padrão **50**. Acima do teto a API **recusa** com
`CAMPO_INVALIDO` — não trunca em silêncio.

---

## 8. Rodando testes contra a API real

**Testes de integração (Vitest/node) funcionam direto** — sem navegador, não enviam `Origin`, e a
tabela da §4 mostra que a API os aceita. Aponte a base para `https://syslocadmin.systera.com.br` (ou
para o túnel) e chame.

Para Playwright, suba o dev server com o proxy da §4.

⚠️ **Se usar a via A, seus testes batem na borda pública real.** Isso é ótimo para fidelidade e exige
cuidado: são requisições contra o ambiente que atende a operação. Prefira leitura, crie pouco e com
marcação reconhecível.

---

## 9. Se algo não funcionar, verifique nesta ordem

1. **`ACESSO_NEGADO` (403) em tudo?** É a reescrita de `origin` faltando no proxy (§4).
2. **`ACESSO_NEGADO` só nas rotas `/v1/master/*`?** A sessão não é `SYSLOC_MASTER`. Isso é a
   autorização funcionando.
3. **`NAO_AUTENTICADO` (401)?** Não há sessão — cookie não enviado, ou expirado.
4. **`CREDENCIAL_INVALIDA` (401) no login?** Senha errada.
5. **`CAMPO_INVALIDO` (422)?** O corpo não bate com o esquema Zod; o campo ofensor vem em `campo`.
6. **`pnpm add @syslocbr/contracts` dá 404?** Falta `@syslocbr:registry=…` no `.npmrc`. Dá 401? É o
   token de leitura (`read:packages`).

Nenhum desses é defeito do backend — todos foram medidos e têm causa conhecida.
