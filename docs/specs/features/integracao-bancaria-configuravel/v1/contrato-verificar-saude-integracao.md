# Contrato do Endpoint — Verificar Saúde da Integração Bancária

> **Documento autossuficiente.** Contém tudo que o frontend precisa para implementar **este e apenas este** endpoint. Você **não** precisa de nenhum outro documento para esta tarefa.
> Verificado contra o código em produção (`integracao_bancaria_api/service.py`, commit da entrega). Gerado em 2026-07-22.

---

## 1. O que este endpoint faz

Responde a uma pergunta: **a integração bancária ativa está saudável?** Ele faz uma autenticação real (round-trip de token) contra o Sicoob e devolve o resultado. É **somente leitura** — não altera nada no servidor.

O ponto central para o frontend: **quando a integração falha, este endpoint entrega o MOTIVO REAL vindo do Sicoob**, verbatim, para você exibir/diagnosticar.

**Caso de uso típico**: um selo de status na tela ("Integração OK" / "Integração com problema") e, no caso de problema, mostrar o detalhe real do erro.

---

## 2. Como chamar

| Item | Valor |
|---|---|
| **Método HTTP** | `GET` |
| **URL** | `/api/method/locacao_automation.integracao_bancaria_api.service.verificar_saude_integracao` |
| **Query string** | nenhuma obrigatória. Opcional: `?provedor=Sicoob` (default já é Sicoob — pode omitir) |
| **Corpo** | nenhum |
| **Autenticação** | **cookie de sessão do Frappe** (mesma origem). Nada de token no header |
| **Permissão** | exige o papel **System Manager**. Sem ele → **HTTP 403** |

⚠️ **É `GET`, não `POST`.** O endpoint é read-only. Não envie corpo.

⚠️ **É uma chamada real ao banco** (autentica no Sicoob por trás). Portanto: **chame sob demanda** (ao abrir a tela, ou num botão "Verificar agora"). **Nunca em polling frequente** — cada chamada bate no Sicoob.

---

## 3. O envelope do Frappe (leia antes de tudo)

O Frappe **embrulha** o retorno do método na chave `message` do corpo HTTP. O que este documento chama de "resposta" nas seções abaixo é o **conteúdo de `body.message`**, não o corpo inteiro.

```jsonc
// corpo HTTP real:
{ "message": { "success": true, "status_code": 200, "message": "...", "sicoob": {...} } }
//             └──────────────────── isto é a "resposta" ────────────────────┘
```

No cliente:
```js
const res = await fetch(url, { method: "GET", credentials: "same-origin" });
const dados = (await res.json()).message;   // <-- desembrulha aqui
// agora use dados.success, dados.status_code, dados.sicoob, ...
```

> ⚠️ Repare que existe um `message` **dentro** do `message`. O externo é o envelope do Frappe; o interno é um resumo humano do nosso endpoint. Não confunda: `body.message.message` é uma string de resumo.

---

## 4. Formato da resposta

`body.message` tem **sempre 4 chaves**:

| Campo | Tipo | Significado |
|---|---|---|
| `success` | `boolean` | `true` **se e somente se** o Sicoob respondeu `< 400` **e** autenticou. É o seu sinal binário de saúde. |
| `status_code` | `number \| null` | O HTTP **que o Sicoob** devolveu. **`null`** quando nem se chegou ao banco (ver casos B e C abaixo). **Não é o HTTP do nosso endpoint** — o nosso é sempre 200, exceto 403 sem permissão. |
| `message` | `string` | Resumo humano. ⚠️ **Num erro do Sicoob NÃO é o motivo real** — é genérico. O motivo real está em `sicoob.corpo`. |
| `sicoob` | `object \| null` | **Tudo que veio do Sicoob.** `null` quando não se alcançou o banco. Detalhe no §5. |

### Os 4 casos possíveis

**Caso A — Saudável** (Sicoob autenticou):
```json
{
  "success": true,
  "status_code": 200,
  "message": "Integracao ativa saudavel; autenticacao no Sicoob bem-sucedida.",
  "sicoob": { "token_type": "Bearer", "expires_in": 300, "scope": "cobranca" }
}
```

**Caso B — Sicoob recusou** (ex.: credencial/certificado inválido no banco):
```json
{
  "success": false,
  "status_code": 401,
  "message": "Falha ao obter token do Sicoob.",
  "sicoob": {
    "status_code": 401,
    "corpo": "{\"error\":\"invalid_client\",\"error_description\":\"Client authentication failed\"}"
  }
}
```
→ **O motivo real é `sicoob.corpo`**, não `message`. O `status_code` do Sicoob pode ser 400/401/403/500/etc.

**Caso C — Não chegou ao banco** (erro de rede/timeout, OU não há configuração ativa):
```json
{
  "success": false,
  "status_code": null,
  "message": "Nenhuma configuracao de integracao bancaria ativa foi encontrada.",
  "sicoob": null
}
```
→ `status_code` e `sicoob` são `null`. O motivo está em `message` (é um erro do nosso lado / rede, não uma resposta do Sicoob).

**Caso D — Sem permissão**: o servidor devolve **HTTP 403** (não é `body.message`; é uma exceção do Frappe). Trate pelo **status HTTP**, não pelo corpo.

---

## 5. O campo `sicoob` — a razão de existir deste endpoint

É onde vive a informação crua do banco. O formato **muda conforme o caso**:

| Situação | `sicoob` contém |
|---|---|
| Sucesso (Caso A) | `{ token_type, expires_in, scope }` — metadados do token |
| Erro HTTP do Sicoob (Caso B) | `{ status_code, corpo }` — **`corpo` é a resposta CRUA do Sicoob, byte a byte** |
| Não alcançou o banco (Caso C) | `null` |

**Sobre `sicoob.corpo`** (o motivo real do erro):
- É uma **string**. Se o Sicoob respondeu JSON (o normal), a string é esse JSON. Faça `JSON.parse(dados.sicoob.corpo)` no cliente se quiser os campos (`error`, `error_description`, etc.).
- ⚠️ **Caso raro**: se o Sicoob devolver 200 mas sem token, `sicoob` terá só `{ status_code: 200 }` **sem** `corpo`. Programe defensivamente: se `sicoob?.corpo` não existir, use `message` como texto de fallback.

🔒 **O que você NÃO recebe (por segurança, não por esquecimento):**
- **Nunca** vem o `access_token` (a credencial bearer do banco). Não conte com ele; ele não existe na resposta. Você recebe só os metadados do token (tipo, expiração, escopo).
- Nunca vem senha de certificado nem caminho de arquivo do servidor.

---

## 6. Como o frontend deve decidir o estado

```js
const dados = (await res.json()).message;   // se o fetch retornou 200

if (dados.success) {
  // ✅ Integração saudável.
  // Opcional: dados.sicoob.expires_in / scope para exibir.
} else if (dados.status_code != null) {
  // ⚠️ O Sicoob RESPONDEU com erro. Motivo real = dados.sicoob.corpo (cru).
  //    Ex.: parse e mostre error_description, ou exiba o corpo numa área técnica.
} else {
  // ⚠️ Não se chegou ao banco (sem config ativa OU rede/timeout).
  //    Motivo = dados.message.
}
```

E o 403 (sem permissão) é tratado **antes**, pelo status HTTP do `fetch`:
```js
if (res.status === 403) { /* usuário sem System Manager */ }
```

**Regra de ouro**: para exibir o **porquê** de uma falha do Sicoob, leia **`sicoob.corpo`** — nunca `message` (que é genérico no erro HTTP).

---

## 7. Tipo TypeScript (opcional, mas recomendado)

```ts
type SaudeIntegracao = {
  success: boolean;
  status_code: number | null;
  message: string;
  sicoob:
    | { token_type: string | null; expires_in: number | null; scope: string | null } // sucesso
    | { status_code: number; corpo?: string }                                          // erro HTTP do Sicoob
    | null;                                                                             // não alcançou o banco
};
```

---

## 8. Cliente de referência (completo)

```js
const PATH =
  "/api/method/locacao_automation.integracao_bancaria_api.service.verificar_saude_integracao";

async function verificarSaudeIntegracao() {
  const res = await fetch(PATH, { method: "GET", credentials: "same-origin" });

  if (res.status === 403) {
    return { estado: "sem_permissao" };
  }

  const dados = (await res.json()).message;

  if (dados.success) {
    return { estado: "saudavel", detalhes: dados.sicoob };
  }

  if (dados.status_code != null) {
    // Sicoob respondeu erro — extrai o motivo real do corpo cru.
    let motivo = dados.message;
    try {
      const corpo = JSON.parse(dados.sicoob?.corpo ?? "");
      motivo = corpo.error_description || corpo.error || dados.sicoob?.corpo || motivo;
    } catch {
      motivo = dados.sicoob?.corpo || dados.message;
    }
    return { estado: "erro_sicoob", statusSicoob: dados.status_code, motivo, corpoCru: dados.sicoob?.corpo };
  }

  // Não chegou ao banco (sem config ativa ou rede).
  return { estado: "indisponivel", motivo: dados.message };
}
```

---

## 9. Critérios de aceite

- [ ] A chamada é **GET** para o path do §2, com `credentials: "same-origin"`, sem corpo.
- [ ] A resposta é lida de **`body.message`** (envelope do Frappe), nunca do corpo raiz.
- [ ] O estado de saúde é decidido por **`success`** (booleano), não pelo texto.
- [ ] Numa falha do Sicoob, o motivo exibido/logado vem de **`sicoob.corpo`** (cru), não de `message`.
- [ ] `status_code === null` (sem config / rede) é tratado como "não alcançou o banco", distinto de um erro HTTP do Sicoob.
- [ ] **HTTP 403** vira estado "sem permissão", tratado pelo status, sem expor detalhe do backend.
- [ ] A chamada é **sob demanda** (abrir a tela / botão), **nunca em polling frequente**.
- [ ] O código **não** depende de `access_token` na resposta (ele nunca vem).
- [ ] `sicoob.corpo` é tratado como **string** (parse defensivo com try/catch); ausência de `corpo` cai para `message`.

---

## 10. Testes mínimos

| # | Tipo | Comportamento |
|---|---|---|
| 1 | Integration | `success: true` → estado saudável; usa `sicoob.token_type/expires_in/scope` |
| 2 | Integration | `success: false` com `status_code: 401` → exibe o motivo real de `sicoob.corpo` (parse do JSON), **não** o `message` genérico |
| 3 | Integration | `status_code: null`, `sicoob: null` → estado "não alcançou o banco", motivo de `message` |
| 4 | Integration | HTTP 403 → estado "sem permissão", sem expor detalhe |
| 5 | Component | corpo cru que **não** é JSON (string qualquer) → não quebra; cai no fallback |
| 6 | Component | resposta sem `sicoob.corpo` (edge 200-sem-token) → usa `message` como motivo |

---

## 11. Mocks prontos (use como fixtures de teste)

```json
{ "message": {
  "success": true, "status_code": 200,
  "message": "Integracao ativa saudavel; autenticacao no Sicoob bem-sucedida.",
  "sicoob": { "token_type": "Bearer", "expires_in": 300, "scope": "cobranca" }
} }
```
```json
{ "message": {
  "success": false, "status_code": 401,
  "message": "Falha ao obter token do Sicoob.",
  "sicoob": {
    "status_code": 401,
    "corpo": "{\"error\":\"invalid_client\",\"error_description\":\"Client authentication failed\"}"
  }
} }
```
```json
{ "message": {
  "success": false, "status_code": null,
  "message": "Nenhuma configuracao de integracao bancaria ativa foi encontrada.",
  "sicoob": null
} }
```

Para o 403 (Caso D), o mock é no nível do HTTP: `status: 403` com um corpo de exceção do Frappe (a forma exata das chaves varia com a versão — **trate pelo status**, não pelo corpo).

---

## 12. Fora do escopo desta tarefa

Este endpoint é **independente**. Para implementá-lo você **não** precisa mexer em configuração, certificado, boletos, nem no fluxo de troca de conta. Se a sua tarefa é só o indicador de saúde, **concentre-se apenas neste documento** — o resto do contrato da tela não é necessário agora.
