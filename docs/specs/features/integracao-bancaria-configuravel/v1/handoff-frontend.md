# Backend Contract Handoff — Integração bancária configurável

> Gerado em: 2026-07-20 (PRÉ-RUN) · Reescrito em: 2026-07-21 (PÓS-RUN v1–v4) · **Atualizado em: 2026-07-22 (PÓS v5 + v6-debits)**
> **Fonte primária: o CÓDIGO em produção** — `locacao_automation/integracao_bancaria_api/service.py`, `.../boletos_abertos.py`, `locacao_automation/cobranca_bancaria/{certificado,configuracao}.py`, `locacao_automation/locacao_automation/doctype/configuracao_integracao_bancaria/configuracao_integracao_bancaria.py`, e o próprio Frappe (`frappe/handler.py`, `frappe/app.py`, `frappe/utils/response.py`, `frappe/exceptions.py`).
> Referências secundárias (contexto de produto, não de contrato): `prd.md`, `pre-refinement.md`, `tech-alignment.md`, `tech_spec.md`, ADR-0001, ADR-0002.
>
> ✅ **ESTADO: BACKEND COMPLETO.** Rodaram v1 (implementação), v2-debits, v3 (correção de incidente de segurança), v4-debits, **v5 (RN-08 + RN-09)** e **v6-debits** — todas com QA + Tech Review. Suíte: **139 testes verdes**. Cada afirmação de contrato abaixo foi **verificada contra o código real**; onde há citação `arquivo:linha`, ela aponta para o código, não para a spec.
>
> 🟢 **AS DUAS [DÚVIDA] BLOQUEANTES FORAM FECHADAS** (#1 canal dos boletos ausentes, #6 fluxo de decisão na troca). O que a revisão anterior deste documento declarava impossível de construir **agora tem backend**. Ver bloco 12.6.
>
> ⚠️ **O que continua sendo hipótese está marcado `[DÚVIDA]`** (bloco 11). Nada aqui foi preenchido por suposição plausível. **Nenhuma dúvida remanescente é bloqueante para começar a implementar.**
>
> 📍 **Sobre as citações `arquivo:linha` — leia se for abrir o código.** Elas são **ponteiros de leitura, não âncoras estáveis**. As citações dos blocos escritos em 2026-07-22 (3, 4.2.1, 4.8, 4.9, 12.6) valem para o commit **`e460191`**. As citações mais antigas foram escritas contra a árvore **anterior à v5**, que inseriu ~100 linhas no meio do `service.py` — elas estão **defasadas em algumas dezenas de linhas** e não foram recalculadas uma a uma (fazer isso à mão em ~55 pontos introduziria mais erro do que corrige). **O anchor confiável é sempre o nome do símbolo**, que vem junto em praticamente toda citação: procure por `_falha`, `_bloco_certificado`, `_normalizar_decisao` etc. em vez de pular para o número. Nenhuma afirmação de **contrato** deste documento depende do número da linha — todas foram verificadas lendo o código atual.
>
> 🚨 **Se você leu a revisão de 2026-07-21, releia os blocos 4.2, 4.8, 4.9, 6 e 8.6.** Aquela versão afirmava que `requer_decisao`/`decisao`/`total_abertos` não existiam — **hoje existem**. E o bloco 6 ganhou uma **correção de segurança de mapeamento** (colisão de texto de erro) que invalida uma regra da versão anterior.

---

## 1. Feature

Tela de configuração da integração bancária (Fase 2 do roadmap): o gestor da imobiliária troca conta, titular e certificado digital, testa a conexão e confirma — sem SSH nem Desk. O frontend consome **9 métodos whitelisted** do Frappe.

## 2. Scope

- **Entra**: os 9 endpoints de configuração/certificado/boletos-abertos/saúde do bloco 3; os estados de UI e o mapeamento de erro de cada um; o badge de vencimento; o ciclo pendente→teste→ativação; **o fluxo de decisão na troca com boletos em aberto (RN-08)**; **a verificação de saúde da integração (endpoint 9)**.
- **NÃO entra**: emissão/baixa/consulta de boletos (essas operações **não mudaram de contrato** — ver bloco 13); notificação ativa de vencimento (adiada, PRD §4.2); qualquer canal externo (e-mail).
- **Transporte**: RPC do Frappe sobre HTTP — `/api/method/<dotted.path>`. Autenticação por **sessão/cookie do Frappe**; cliente é **JSON-only**.

### 2.1 Envelope do Frappe (⚠️ NÃO estava no handoff PRÉ-RUN)

O valor retornado por um método whitelisted é **embrulhado na chave `message`** pelo handler do Frappe (`frappe/handler.py:58` — `frappe.response["message"] = data`). Ou seja, o que os blocos 4.x descrevem como "Response" é o **conteúdo de `body.message`**, não o corpo inteiro:

```jsonc
// corpo HTTP real de obter_configuracao
{ "message": { "success": true, "message": "Configuracao ativa carregada.", "configuracao": {...}, ... } }
```

No cliente: `const r = (await res.json()).message;` e só então `r.success`. **Exceção**: `baixar_consolidado_boletos_abertos` não devolve JSON (bloco 4.6).

### 2.2 Verbo HTTP (⚠️ regra dura, não estilística)

`@frappe.whitelist()` sem `methods` aceita GET/POST/PUT/DELETE (`frappe/__init__.py:815-816`) — então uma chamada GET a um método de escrita **executa e retorna 200 com `success: true`**… e o Frappe **faz rollback**, porque só commita em métodos "unsafe" (`frappe/app.py:405` + `frappe/auth.py:27`: `UNSAFE_HTTP_METHODS = {POST, PUT, DELETE, PATCH}`).

| Endpoint | Verbo obrigatório | Por quê |
|---|---|---|
| `obter_configuracao` | GET (POST também funciona) | leitura pura |
| `salvar_configuracao` | **POST** | escreve — GET seria descartado silenciosamente |
| `enviar_certificado` | **POST** | escreve |
| `testar_conexao` | **POST** | escreve (carimbo + ativação) |
| `remover_certificado` | **POST** | escreve |
| `baixar_consolidado_boletos_abertos` | GET | leitura pura, devolve arquivo |
| `apurar_boletos_abertos` | GET | leitura pura |
| `resumir_consolidado_boletos_abertos` | GET | leitura pura |

## 3. Backend Entry Points

| # | Operação | Método | Path (dotted) | Assinatura real |
|---|---|---|---|---|
| 1 | Obter configuração | GET | `locacao_automation.integracao_bancaria_api.service.obter_configuracao` | `(provedor=None)` |
| 2 | Salvar configuração (parcial) | POST | `…service.salvar_configuracao` | `(provedor=None, ambiente, auth_url, api_base_url, client_id, scope, numero_cliente, numero_conta_corrente, codigo_modalidade, parametros_provedor, certificado_senha, **`decisao=None`**, **_ignorados)` |
| 3 | Enviar certificado | POST | `…service.enviar_certificado` | `(arquivo_base64=None, nome_arquivo=None, senha=None, provedor=None)` |
| 4 | Testar conexão | POST | `…service.testar_conexao` | `(provedor=None)` |
| 5 | Remover certificado | POST | `…service.remover_certificado` | `(provedor=None)` |
| 6 | Baixar consolidado (arquivo) | GET | `…service.baixar_consolidado_boletos_abertos` | `()` — sem parâmetros |
| 7 | **Apurar boletos em aberto** (novo, v5) | GET | `…service.apurar_boletos_abertos` | `()` — sem parâmetros |
| 8 | **Resumir consolidado** (novo, v5) | GET | `…service.resumir_consolidado_boletos_abertos` | `()` — sem parâmetros |
| 9 | **Verificar saúde da integração** (novo) | GET | `…service.verificar_saude_integracao` | `(provedor=None)` |

<!-- fonte: service.py:776, :808, :1201, :1009, :1287, :1363, :1385, :1401 -->

- `provedor` é opcional; default `"Sicoob"` (`service.py:85`). O DocType só aceita `"Sicoob"` como opção. Passar outro provedor cai em "Nenhuma configuracao … ativa foi encontrada."
- Em `salvar_configuracao`, os campos editáveis têm **default sentinela `_AUSENTE`** (`service.py:89`): **omitir a chave** = manter inalterado. Enviar `""` é uma alteração (para vazio) e é validada. ⚠️ **`decisao` é a exceção**: o default é `None`, não `_AUSENTE` — ausente e vazio são equivalentes e significam "o gestor ainda não decidiu".
- ⚠️ `salvar_configuracao` mantém `**_ignorados` — chave desconhecida **não gera erro**, o retorno é o de sucesso normal. **Mas desde a v6-debits ela não é mais muda**: toda chave não reconhecida (exceto `cmd`, que o Frappe injeta) é registrada por **nome** num `Error Log` (`service.py:886-897`). Um typo do cliente vira rastro auditável no servidor — mas **continua invisível para a tela**. Não confie no backend para detectar erro de digitação no payload: valide os nomes de campo no cliente.
- Os endpoints 7 e 8 são **irmãos JSON** do 6 e usam **exatamente o mesmo filtro RN-02** (importado, não duplicado — `boletos_abertos.py:28`). Não existe divergência possível entre o que o PDF contém e o que eles reportam.

> **Convenção de erro (confirmada, com uma correção importante)**: erro de **negócio** retorna **HTTP 200** com `{"success": false, "message": "<texto>"}` — o frontend decide pelo campo `success`, **não** pelo status.
> ❌ **Não existe `error_code` em nenhuma resposta dos 8 endpoints.** `_falha()` (`service.py:195-199`) devolve **só** `{success, message}` (+ `detalhes` quando aplicável). O handoff PRÉ-RUN prometia `error_code`/`CONFIGURACAO_AUSENTE`/`VALIDATION_ERROR`/`CERTIFICADO_INVALIDO` na resposta — esses códigos existem **apenas internamente** (`cobranca_bancaria/configuracao.py:77-82`, `certificado.py:51`) e **não cruzam a fronteira whitelisted**. A discriminação no cliente tem de ser por **texto literal da mensagem** (bloco 6) ou por contexto da chamada.

### 3.1 Códigos HTTP possíveis

| HTTP | Quando | Corpo |
|---|---|---|
| 200 | sucesso **e** erro de negócio | `{"message": {"success": true|false, ...}}` |
| 403 | sem papel System Manager (`frappe.PermissionError`, `frappe/exceptions.py:34-35`) | envelope de exceção do Frappe |
| 417 | `frappe.ValidationError` não capturada — ex.: `ambiente` fora do Select do DocType, ou falha de invariante no `validate()` do controller | envelope de exceção do Frappe |
| 5xx | erro inesperado | envelope de exceção do Frappe |

## 4. Contracts

### 4.1 Obter configuração — `obter_configuracao(provedor=None)`

- GET · Auth obrigatória · **System Manager** (`service.py:686`) · leitura pura · **não cachear**.

**Request**: sem corpo. Query opcional `?provedor=Sicoob`.

**Response `body.message` (sucesso)** — shape **exato**, campo a campo (`service.py:695-707`):

```json
{
  "success": true,
  "message": "Configuracao ativa carregada.",
  "configuracao": {
    "name": "80eee0d13b",
    "provedor": "Sicoob",
    "ativo": 1,
    "ambiente": "Producao",
    "auth_url": "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
    "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
    "client_id": "********f456",
    "scope": "boletos_inclusao boletos_consulta ...",
    "numero_cliente": 12345,
    "numero_conta_corrente": 67890,
    "codigo_modalidade": 1,
    "parametros_provedor": "{}"
  },
  "certificado": {
    "presente": true,
    "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
    "documento": "12345678000190",
    "emissor": "AC SOLUTI Multipla v5",
    "valido_de": "2025-08-22",
    "valido_ate": "2026-08-22",
    "dias_para_vencer": 32,
    "origem": "upload"
  },
  "pendente": {
    "name": "c699b0110f",
    "campos_divergentes": { "numero_conta_corrente": 222 },
    "carimbo": "nao_testado"
  }
}
```

**Bloco `configuracao`** (`_bloco_configuracao`, `service.py:291-306`) — 12 chaves, **sempre presentes**:
`name`, `provedor`, `ativo` (int 0/1), `ambiente` (`"Producao"` | `"Homologacao"`), `auth_url`, `api_base_url`, `client_id` (**mascarado**), `scope`, `numero_cliente` (int|null), `numero_conta_corrente` (int|null), `codigo_modalidade` (int|null), `parametros_provedor` (**string JSON crua**, não objeto).

**Máscara do `client_id`** (`_mascarar`, `service.py:185-192`): preserva **os 4 ÚLTIMOS** caracteres, substitui todos os anteriores por `*`. `"abc123def456"` → `"********f456"`. Com ≤ 4 caracteres, tudo vira `*`. Vazio → `""`.
❌ **O handoff PRÉ-RUN dizia `"abc1****"` (4 primeiros) — estava invertido.**

**Bloco `certificado`** (`_bloco_certificado`, `service.py:309-329`) — 8 chaves, **sempre presentes**:

| Campo | Tipo | Semântica |
|---|---|---|
| `presente` | bool | `true` se há `certificado_arquivo` (upload) **ou** `pfx_path_legado` (fallback) |
| `titular` | string\|null | CN do subject do certificado. Formato ICP-Brasil típico: `"NOME:CPFCNPJ"` |
| `documento` | string\|null | **só dígitos**, 11 (CPF) ou 14 (CNPJ). **Sem máscara** — formate na tela |
| `emissor` | string\|null | CN do issuer |
| `valido_de` | `"YYYY-MM-DD"`\|null | |
| `valido_ate` | `"YYYY-MM-DD"`\|null | |
| `dias_para_vencer` | int\|null | `valido_ate − hoje`, **com sinal**. `null` quando não há `valido_ate` |
| `origem` | `"upload"`\|`"legado"`\|null | `"upload"` quando há File privado; `"legado"` só quando **não** há upload e existe `pfx_path_legado`; `null` quando não há certificado algum |

❌ **Nomes corrigidos**: o PRÉ-RUN previa `titular_nome` e `titular_documento`; o código usa **`titular`** e **`documento`**.
✅ **Em produção hoje `origem == "upload"`** (config ativa `80eee0d13b` tem `certificado_arquivo = /private/files/certificado.pfx`). O `pfx_path_legado` (`/run/secrets/sicoob/certificado.pfx`) permanece preenchido como fallback (RN-10) mas **não é usado** enquanto houver upload.

**Bloco `pendente`** (`_bloco_pendente`, `service.py:341-354`):

- ⚠️ **A chave `pendente` só existe quando há registro pendente** (`service.py:703-705`). Quando não há, **a chave está AUSENTE** do JSON — não vem `{"presente": false}`.
  ❌ O PRÉ-RUN previa `pendente.presente` — **esse campo não existe**. Teste com `"pendente" in resposta`.
- Chaves: `name` (string), `campos_divergentes` (objeto), `carimbo` (`"testado"` | `"nao_testado"`).
- `campos_divergentes`: só os campos de `CAMPOS_EDITAVEIS` (`service.py:93-104`) cujo valor **em texto** difere do ativo — `provedor`, `ambiente`, `auth_url`, `api_base_url`, `client_id`, `scope`, `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade`, `parametros_provedor`. `client_id`, se divergir, vem **mascarado** (`service.py:347-348`). Objeto vazio `{}` = pendente idêntico ao ativo.
  ⚠️ **O certificado NÃO entra em `campos_divergentes`.** Trocar só o certificado deixa `campos_divergentes: {}` — a tela precisa comparar o bloco `certificado`/impressão digital por outro meio, ou tratar "existe pendente" como sinal suficiente de "em edição".
- `carimbo` (`_estado_carimbo`, `service.py:332-338`): `"testado"` **somente** quando `conexao_testada_em` e `conexao_testada_hash` estão preenchidos **E** o hash bate com `calcular_impressao_conexao(doc)` recalculado agora. Qualquer divergência → `"nao_testado"`.

**Erros possíveis**

| HTTP | `success` | `message` literal | Quando |
|---|---|---|---|
| 200 | false | `Nenhuma configuracao de integracao bancaria ativa foi encontrada.` | Nenhum registro com `ativo=1` para o provedor |
| 403 | — | (exceção Frappe) | Sem System Manager |

- ❌ **`CONFIGURACAO_DUPLICADA` não é alcançável aqui.** `_nome_ativa` (`service.py:266-274`) usa `order_by=modified desc, limit=1` — duas ativas simultâneas devolvem a mais recente **sem erro**. O código `CONFIGURACAO_DUPLICADA` existe só no resolvedor interno (`configuracao.py:302-324`), usado pela emissão, não por este endpoint.

---

### 4.2 Salvar configuração — `salvar_configuracao(...)`

- POST · Auth obrigatória · **System Manager** · **atualização parcial**.
- **Semântica confirmada (RN-04)**: grava num registro **pendente (`ativo=0`)**, **não ativa nada**, e **limpa o carimbo** (`service.py:797-800`). A configuração em vigor permanece intocada.
- Se ainda não existe pendente, ele é criado como **cópia integral do ativo** (`_criar_pendente_de_ativa`, `service.py:571-592`) — incluindo certificado, senha e `pfx_path_legado`. Por isso alterar só a conta **não perde** a credencial em vigor.

**Request** (todos opcionais; **omitir = manter**):
```json
{
  "provedor": "Sicoob",
  "ambiente": "Homologacao",
  "auth_url": "https://...",
  "api_base_url": "https://...",
  "client_id": "...",
  "scope": "...",
  "numero_cliente": 12345,
  "numero_conta_corrente": 222,
  "codigo_modalidade": 1,
  "parametros_provedor": "{}",
  "certificado_senha": "...",
  "decisao": "aceitar"
}
```

Validações **no serviço**, todas *antes* de qualquer escrita (`service.py:743-784`):

| Campo | Regra | Mensagem literal em caso de recusa |
|---|---|---|
| `auth_url`, `api_base_url` | URL **absoluta `https`** com host (`_url_valida`, `service.py:206-214`) | `O campo auth_url deve ser uma URL https absoluta valida.` / `O campo api_base_url deve ser uma URL https absoluta valida.` |
| `numero_cliente` | inteiro > 0 | `O campo 'Numero do Cliente' e obrigatorio e deve ser um inteiro maior que zero.` · `… deve ser um inteiro maior que zero (valor nao numerico).` · `… deve ser um inteiro maior que zero.` |
| `numero_conta_corrente` | idem | idem, rótulo `'Numero da Conta Corrente'` |
| `codigo_modalidade` | idem | idem, rótulo `'Codigo da Modalidade'` |
| `parametros_provedor` | JSON válido (string vazia é aceita) | `O campo parametros_provedor deve ser um JSON valido.` |
| `ambiente` | ⚠️ **não validado no serviço** — só pelo Select do DocType no `save()` | valor fora de `Producao`/`Homologacao` → **HTTP 417** (`frappe.ValidationError`), não 200 |
| `client_id`, `scope` | apenas `strip()`; sem validação | — |
| `certificado_senha` | ✅ **só gravada quando NÃO-VAZIA** (`service.py:779-783`). `""`/whitespace/ausente **não apaga** a senha existente | — |

**Response `body.message` (sucesso)** (`service.py:802-809`):
```json
{
  "success": true,
  "message": "Alteracoes salvas em uma configuracao pendente. Teste a conexao para coloca-la em vigor.",
  "configuracao": { "…": "bloco _bloco_configuracao do PENDENTE (12 chaves, client_id mascarado)" }
}
```
⚠️ O bloco devolvido é o **do pendente**, com `ativo: 0` e `name` diferente do ativo. Não é a config em vigor.

**Erros possíveis** (todos HTTP 200, `success: false`, chave `message`):

| `message` literal | Quando |
|---|---|
| `Nenhuma configuracao de integracao bancaria ativa foi encontrada para editar.` | Não há ativa para o provedor |
| (tabela de validação acima) | Campo inválido — **nada é gravado** |
| `O campo 'decisao' e invalido. Valores aceitos: aceitar, nao_aceitar, aceitar_com_consolidado.` | v5 — `decisao` com valor fora dos três literais |
| `A troca de configuracao foi cancelada a pedido do gestor; nenhuma alteracao foi feita.` | v5 — `decisao: "nao_aceitar"`. ⚠️ **Não é erro** — é o cancelamento pedido pelo usuário. Ver a armadilha em 4.2.1 |
| `O vinculo do certificado alvo e invalido (precisa ser um arquivo privado); nenhuma alteracao foi feita.` | v4-debits — ver 4.7 |
| `O certificado alvo nao foi encontrado; nenhuma alteracao foi feita.` | v4-debits — ver 4.7 |

---

### 4.2.1 🆕 Fluxo de decisão na troca com boletos em aberto (RN-08 · v5)

> Este contrato **não existia** na revisão anterior deste handoff. Ele fecha a `[DÚVIDA] #6`.

**Como funciona.** Quando `salvar_configuracao` é chamada **sem `decisao`** e existe **pelo menos 1 boleto em aberto** (filtro RN-02 do bloco 8.7), o backend **recusa a gravação** e devolve um shape diferente, pedindo a decisão do gestor:

**Response `body.message` — pedido de decisão** (`service.py:966-980`) — **5 chaves, shape próprio**:

```json
{
  "success": false,
  "requer_decisao": true,
  "total_abertos": 7,
  "opcoes": ["aceitar", "nao_aceitar", "aceitar_com_consolidado"],
  "message": "Existem 7 boletos em aberto emitidos pela conta atual."
}
```

- ⚠️ **Não há chave `configuracao` neste shape.** É a única resposta da família com `requer_decisao`.
- `total_abertos` é interpolado na `message` — o texto **varia**. Mapeie por `requer_decisao === true`, **nunca** pelo texto.
- `opcoes` vem do backend; **renderize a partir dela**, não de uma lista hard-coded. Se o backend acrescentar uma quarta opção, a tela acompanha sem deploy.

**Os três valores de `decisao`** (literais, `service.py:174-184`):

| Valor | Efeito no backend | O que a tela faz |
|---|---|---|
| `aceitar` | Grava o pendente normalmente. Resposta = sucesso padrão do 4.2. | Prossegue |
| `nao_aceitar` | **Recusa**, zero escrita. `{success: false, message: "A troca de configuracao foi cancelada a pedido do gestor; nenhuma alteracao foi feita."}` | Fecha o diálogo, mantém o formulário como estava. **Não é erro** |
| `aceitar_com_consolidado` | ⚠️ **Sinônimo exato de `aceitar`** — o backend faz **exatamente a mesma coisa**. Não baixa, não anexa, não envia nada. | Ver abaixo |

🚨 **A armadilha do `aceitar_com_consolidado`.** O nome sugere que o backend produz o consolidado; **ele não produz**. O download é **responsabilidade do cliente**. A sequência correta é:

```
1. POST salvar_configuracao {…}                      → {requer_decisao: true, total_abertos: 7}
2. (gestor escolhe "baixar antes de trocar")
3. GET  baixar_consolidado_boletos_abertos           → blob PDF  ← o CLIENTE baixa
4. POST salvar_configuracao {…, decisao: "aceitar"}  → sucesso
```

O `tech_spec.md:290` prescreve `decisao=aceitar` no passo 4. Enviar `aceitar_com_consolidado` produz o mesmo resultado e também é aceito — mas **em nenhum dos dois casos o backend baixa o PDF por você**. Se a tela pular o passo 3, o gestor troca a conta sem nunca ter recebido o consolidado.

**Ordem de avaliação — importa para exibir o erro certo** (`service.py:900-980`):

```
_exigir_system_manager()          → 403
└─ config ativa não existe         → "… para editar."
   └─ decisao INVÁLIDA             → erro de decisão   ← ANTES das validações de campo
      └─ validações de campo       → erro de campo
         └─ decisao == nao_aceitar → cancelamento
            └─ decisao ausente E há boletos abertos → requer_decisao
               └─ grava (primeiro ponto que escreve)
```

Consequência prática: se o payload tiver **ao mesmo tempo** um `decisao` inválido e um `numero_conta_corrente` inválido, a resposta é a do **`decisao`**. A tela não pode assumir que recebeu todos os erros de validação de uma vez.

**Garantia de zero escrita.** Todos os ramos de recusa acima acontecem **antes** de `_preparar_pendente`, o primeiro ponto que insere ou altera registro (`service.py:983`). Foi auditado no código pelo QA — e não pelos testes, porque `FrappeTestCase` roda em transação com rollback e um commit indevido não apareceria. Você pode repassar ao usuário: **recusa = nada mudou**.

⚠️ **A decisão NÃO é lembrada.** Ela vale para **uma chamada**. Enquanto houver boleto em aberto, **toda** `salvar_configuracao` sem `decisao` volta a exigir a decisão — inclusive a segunda edição do mesmo formulário na mesma sessão. Se a tela salva em etapas (ex.: conta, depois avançado), cada `POST` precisa carregar `decisao`. Guarde a escolha do gestor no estado da tela e reenvie.

ℹ️ **Custo**: a apuração só roda quando `decisao` está ausente (`service.py:961`). Enviar `decisao` explicitamente **evita a query** — mais um motivo para reenviá-la nas gravações seguintes.

---

### 4.3 Enviar certificado — `enviar_certificado(arquivo_base64, nome_arquivo, senha, provedor=None)`

- POST · Auth obrigatória · **System Manager** · **substituição total** do certificado do pendente.

**Request**
```json
{
  "arquivo_base64": "MIIKzQIBAzCCCo...",
  "nome_arquivo": "certificado.pfx",
  "senha": "<senha do PKCS#12>"
}
```

**Formato do base64** (`service.py:1027-1033`):
- Base64 **puro**, padrão (com padding `=`). **Sem prefixo data-URI** — `"data:application/x-pkcs12;base64,…"` é **recusado** (`b64decode(..., validate=True)`).
- **Whitespace é tolerado**: quebras de linha/espaços são removidos antes de decodificar (`"".join(str(...).split())`).
- `nome_arquivo` é opcional; é **saneado** (`[^A-Za-z0-9_.-]` → `-`) e cai em `certificado.pfx` quando vazio (`service.py:944-947`). Não há validação de extensão.
- `senha` opcional (`None` → `""`), para PKCS#12 sem senha.

**Ordem das validações — nada toca o banco até tudo passar** (`service.py:1026-1041`, docstring `:1006-1015`):
1. Existe configuração ativa? Senão → falha.
2. `arquivo_base64` vazio → falha.
3. Base64 inválido → falha.
4. **Tamanho** fora da faixa → falha (`certificado.py:164-171`).
5. **Senha incorreta / não é PKCS#12** → falha (`certificado.py:177-192`).
6. Só então cria/obtém o pendente, grava o File privado, popula os metadados, **invalida o carimbo** e audita.

**Faixa de tamanho** (`certificado.py:42-43`) — ⚠️ **valores PROVISÓRIOS, marcados `TODO(a-definir)` no código**:
- `TAMANHO_MIN_PFX_BYTES = 256`
- `TAMANHO_MAX_PFX_BYTES = 32 * 1024` (**32768** bytes)
- O frontend **pode** pré-validar client-side com esses números (evita upload inútil), mas **a fonte da verdade é o backend** e a faixa pode mudar sem aviso. Nunca hard-code a mensagem de erro; use a `message` devolvida.
- 📏 A faixa é sobre os **bytes decodificados**, não sobre o comprimento do base64 (que é ~33% maior).

**Response `body.message` (sucesso)** (`service.py:1080-1087`):
```json
{
  "success": true,
  "message": "Certificado validado e anexado a configuracao pendente. Teste a conexao para coloca-lo em vigor.",
  "certificado": {
    "presente": true,
    "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
    "documento": "12345678000190",
    "emissor": "AC SOLUTI Multipla v5",
    "valido_de": "2026-03-12",
    "valido_ate": "2027-03-12",
    "dias_para_vencer": 234,
    "origem": "upload"
  }
}
```
✅ **Confirmado**: o bloco `certificado` é o mesmo `_bloco_certificado` da op. 1, com metadados **extraídos do próprio arquivo** — é o que a tela mostra para o gestor confirmar "é esta a conta?" antes de ativar.

**Erros possíveis** (HTTP 200, `success: false`):

| `message` literal | Quando |
|---|---|
| `Nenhuma configuracao de integracao bancaria ativa foi encontrada.` | Sem ativa |
| `O arquivo do certificado (base64) e obrigatorio.` | `arquivo_base64` ausente/vazio |
| `O arquivo do certificado nao contem um base64 valido.` | base64 malformado / data-URI |
| `Tamanho do certificado ({N} bytes) fora da faixa aceitavel (256-32768 bytes).` | fora da faixa (`{N}` = tamanho real) |
| `Senha incorreta ou arquivo nao e um PKCS#12 valido.` | ⚠️ senha errada **e** formato inválido dão a **MESMA** mensagem — a `cryptography` não distingue os dois casos por design (anti-oráculo). A tela **não pode** dizer "senha errada" com certeza |
| `PKCS#12 nao contem um certificado.` | PKCS#12 válido mas sem certificado |
| `O vinculo do certificado alvo e invalido (…)` / `O certificado alvo nao foi encontrado; (…)` | v4-debits — ver 4.7 |

---

### 4.4 Testar conexão — `testar_conexao(provedor=None)`

- POST · Auth obrigatória · **System Manager**.
- ⚠️ **Semântica AMPLIADA em relação ao handoff PRÉ-RUN**: este método **não só testa — ele ATIVA**. Em caso de sucesso ele grava o carimbo, revalida-o e, se válido, **ativa o pendente (`ativo=1`) e desativa o anterior na mesma transação** (`service.py:864-915`). **Não existe endpoint "ativar" separado.**
- Falha → **não carimba e não ativa**; o ativo continua em vigor.

**Request**: `{}` (opcionalmente `{"provedor": "Sicoob"}`). Opera sobre o **pendente**.

**Response `body.message`** — shape **fixo de 6 chaves em todos os casos** (`_resposta_teste`, `service.py:925-938`):
```json
{
  "success": true,
  "message": "Conexao testada com sucesso; a configuracao foi ativada.",
  "mensagem": "Conexao testada com sucesso; a configuracao foi ativada.",
  "detalhes": null,
  "expires_in": 3600,
  "scope": "boletos_inclusao boletos_consulta ..."
}
```
- `message` e `mensagem` carregam **sempre o mesmo texto** (redundância deliberada). Use qualquer uma; prefira `message` (shape canônico da família).
- Em falha: `success: false`, `expires_in: null`, `scope: null`, `detalhes` frequentemente preenchido.
- ⚠️ **`detalhes` pode conter texto técnico e, no ramo do certificado legado, o CAMINHO ABSOLUTO do arquivo no servidor** (`configuracao.py:151-166` passa `details=caminho`). **Não exiba `detalhes` cru para o gestor** — use só em log/área técnica.

**Mensagens de falha possíveis** (HTTP 200, `success: false`):

| `message` literal | Origem |
|---|---|
| `Nenhuma configuracao pendente para testar. Salve alteracoes antes de testar a conexao.` | `service.py:827-831` — não há registro `ativo=0` |
| `O vinculo do certificado alvo e invalido (precisa ser um arquivo privado); nenhuma alteracao foi feita.` | v4-debits (4.7) |
| `O certificado alvo nao foi encontrado; nenhuma alteracao foi feita.` | v4-debits (4.7) |
| `Nenhum certificado foi enviado e o caminho do certificado legado nao esta configurado.` | `configuracao.py:145-149` |
| `Certificado legado nao encontrado no caminho configurado.` | `configuracao.py:151-156` |
| `Certificado legado nao pode ser lido no caminho configurado.` | `configuracao.py:161-166` |
| `Certificado enviado nao pode ser lido: o arquivo referenciado nao foi encontrado ou nao e legivel.` | `configuracao.py:213-218` — File privado sumiu |
| `Senha incorreta ou arquivo nao e um PKCS#12 valido.` | senha gravada não abre o PFX em vigor |
| `Tamanho do certificado ({N} bytes) fora da faixa aceitavel (256-32768 bytes).` | idem |
| `Provedor sem adaptador cadastrado para testar a conexao.` | `service.py:850-854` |
| `Falha ao testar a conexao com o provedor.` **ou** o texto vindo do adaptador | `service.py:856-862` — falha real de token (credencial/rede/mTLS). ⚠️ o texto vem do adaptador e **não é enumerável aqui** |
| `O carimbo de conexao nao corresponde ao estado atual; teste novamente antes de ativar.` | `service.py:875-879` — corrida rara |

**Carimbo / invalidação (RN-04) — confirmado como trava estrutural**:
- Campos componentes da conexão (`configuracao_integracao_bancaria.py:40-49`): **`auth_url`, `api_base_url`, `client_id`, `scope`, `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade`, `certificado_impressao_digital`**.
  ✅ Isso confirma e **detalha** a lista do PRÉ-RUN: a "conta" são os **três** campos, e o certificado entra pela **impressão digital**. `ambiente` e `parametros_provedor` **NÃO** compõem o carimbo — alterá-los não exige novo teste.
- A invalidação é feita **no `validate()` do DocType** (`:93-106`), não por convenção: qualquer `save()` com componente alterado zera `conexao_testada_em`/`conexao_testada_hash`. Além disso `salvar_configuracao`, `enviar_certificado` e `remover_certificado` **zeram o carimbo explicitamente**, sempre.

---

### 4.5 Remover certificado — `remover_certificado(provedor=None)`

- POST · Auth obrigatória · **System Manager**.
- Apaga o(s) File privado(s) do **pendente**, zera os metadados derivados **e a senha**, invalida o carimbo e audita (`service.py:1129-1151`).
- **RN-10 confirmada**: só remove **certificado próprio** (campo `certificado_arquivo`). O `pfx_path_legado` **não é removível por aqui** e continua como fallback.
- A recusa é avaliada **antes de criar qualquer pendente** (`service.py:1109-1119`) — o caminho de erro produz **zero mudança**.

**Response `body.message` (sucesso)** (`service.py:1153-1160`):
```json
{
  "success": true,
  "message": "Certificado removido da configuracao pendente. Teste a conexao para coloca-la em vigor sem o certificado proprio.",
  "certificado": {
    "presente": true, "titular": null, "documento": null, "emissor": null,
    "valido_de": null, "valido_ate": null, "dias_para_vencer": null, "origem": "legado"
  }
}
```
⚠️ **Cuidado**: `certificado.presente` continua `true` e `origem` vira `"legado"` **quando existe `pfx_path_legado`** (é o caso em produção). Só vira `presente: false` / `origem: null` quando também não há fallback. Não assuma `presente === false` após remover.

**Erros possíveis** (HTTP 200, `success: false`):

| `message` literal | Quando |
|---|---|
| `Nenhuma configuracao de integracao bancaria ativa foi encontrada.` | Sem ativa |
| `A configuracao nao possui certificado proprio para remover (o fallback legado nao e removivel por aqui).` | ✅ **É a mensagem real** do caso que o PRÉ-RUN chamava de `CERTIFICADO_LEGADO_INDISPONIVEL` — o código **não** é devolvido, só este texto |
| `O vinculo do certificado alvo e invalido (…)` / `O certificado alvo nao foi encontrado; (…)` | v4-debits (4.7) |

---

### 4.6 Baixar consolidado — `baixar_consolidado_boletos_abertos()`

- GET · Auth obrigatória · **System Manager** (⚠️ **não** é `allow_guest`, diferente de `abrir_boleto` — exporia a carteira inteira).
- ⚠️ **Único endpoint que devolve ARQUIVO, não JSON.**

**Request**: sem parâmetros.

**Response (sucesso)** — o serviço grava em `frappe.local.response` e **não retorna nada** (`service.py:1182-1185`):

| Header/propriedade | Valor |
|---|---|
| `Content-Type` | `application/pdf` (deduzido do filename por `mimetypes.guess_type`, `frappe/utils/response.py:108-114`) |
| `Content-Disposition` | `inline; filename="boletos-abertos-consolidado.pdf"` (`display_content_as = "inline"`) |
| corpo | bytes do PDF |

**No cliente**: trate como **download/blob** — `await res.blob()`, nunca `res.json()`. Como não há envelope, `success` não existe aqui: **falha = status HTTP ≠ 200**.

**Comportamento quando não há boleto com PDF** (`boletos_abertos.py:48-103`):
- Boletos em aberto **sem PDF disponível** ou com **PDF corrompido/ilegível** **não interrompem** a montagem — entram na lista interna `ausentes`.
- Sem nenhum boleto com PDF, o `PdfWriter` é serializado vazio → **PDF mínimo de 0 páginas**, ainda com HTTP 200 e `application/pdf`. **Não é 404, não é corpo vazio.** A tela precisa lidar com um PDF que abre em branco.

ℹ️ **A `[DÚVIDA] #1` (lista de ausentes) FOI FECHADA — mas não por este endpoint.** `baixar_consolidado_boletos_abertos` continua descartando `total`/`disponiveis`/`ausentes` e devolvendo só os bytes; **isso é deliberado** (o streaming ficou byte-a-byte inalterado para não arriscar regressão). O canal escolhido foi um **endpoint JSON irmão**: `resumir_consolidado_boletos_abertos` (4.9).

---

### 4.8 🆕 Apurar boletos em aberto — `apurar_boletos_abertos()` (v5)

- GET · Auth obrigatória · **System Manager** (`service.py:1394`) · leitura pura · **não cachear**.
- **A leitura mais barata da família**: uma única query. Use quando precisar só da contagem.

**Request**: sem parâmetros.

**Response `body.message`** (`service.py:1385-1396` → `boletos_abertos.py:37-49`) — **2 chaves, sempre presentes**:

```json
{
  "total": 7,
  "identificadores": ["COB-0001", "COB-0002", "COB-0007"]
}
```

| Campo | Tipo | Semântica |
|---|---|---|
| `total` | int | Quantidade de boletos em aberto (filtro RN-02, bloco 8.7). `0` quando não há |
| `identificadores` | string[] | `name` das Cobranças, ordenados por `data_vencimento asc, name asc`. Lista vazia quando `total == 0` |

- ⚠️ **Não há `success` aqui.** O shape é `{total, identificadores}` cru — não é a família `_falha`. Erro só por status HTTP (403).
- ⚠️ `identificadores` são `name` de `Cobranca` — **identificadores internos**, não nosso-número nem nome de sacado. Para exibir algo legível ao gestor você precisa de outra fonte; hoje **não há endpoint que devolva os dados de exibição do boleto**. Ver `[DÚVIDA] #7`.
- **Uso recomendado**: mostrar o aviso "existem N boletos em aberto" **ao abrir a tela de edição**, antes de o gestor mexer em qualquer campo — em vez de deixá-lo descobrir só ao clicar em Salvar e tomar o `requer_decisao`.

---

### 4.9 🆕 Resumir consolidado — `resumir_consolidado_boletos_abertos()` (v5)

- GET · Auth obrigatória · **System Manager** (`service.py:1421`) · leitura pura · **não cachear**.
- **É o canal que fecha a `[DÚVIDA] #1`**: entrega quem ficou de fora do PDF, sem devolver byte algum de PDF.

**Request**: sem parâmetros.

**Response `body.message`** (`service.py:1401-1427`) — **3 chaves, sempre presentes**:

```json
{
  "total": 7,
  "disponiveis": ["COB-0001", "COB-0002"],
  "ausentes": ["COB-0007"]
}
```

| Campo | Tipo | Semântica |
|---|---|---|
| `total` | int | Total de boletos em aberto (mesmo número do 4.8) |
| `disponiveis` | string[] | Os que **entraram** no PDF consolidado |
| `ausentes` | string[] | Os que **ficaram de fora** — sem PDF anexado **ou** com PDF corrompido/ilegível |

- **Invariante**: `len(disponiveis) + len(ausentes) == total`. As duas listas particionam o conjunto.
- ⚠️ **Não há `success`** — mesmo caso do 4.8.
- ⚠️ **Este endpoint é CARO.** Ele monta o consolidado **inteiro em memória** para saber quem falhou, e descarta os bytes (`service.py:1411-1419`). O custo é o mesmo do download, sem entregar o arquivo. O backend documenta explicitamente que **não há atalho mais barato**: um boleto só é classificado como ausente após a tentativa **real** de leitura via `PdfReader` falhar — checar só a presença de bytes seria mais rápido, mas contaria como "disponível" um PDF anexado porém corrompido, divergindo do consolidado real.
  - ✅ **Chame sob demanda**, no momento em que a informação é mostrada.
  - ❌ **Nunca em polling**, nunca no `mount` da tela, nunca em cada tecla digitada. Use o 4.8 (barato) para a contagem e reserve o 4.9 para o momento do consolidado.
- **Uso recomendado**: **depois** de baixar o consolidado (ou junto), avisar *"3 de 7 boletos não puderam ser incluídos no PDF"*. É a informação que o gestor precisa para não achar que o consolidado está completo.

---

### 4.10 🆕 Verificar saúde da integração — `verificar_saude_integracao(provedor=None)`

- GET · Auth obrigatória · **System Manager** · **read-only, ZERO efeito colateral**.
- **Faz um round-trip de token real** (mTLS) contra o Sicoob na config **ATIVA** e reporta o resultado. **Não** cria pendente, **não** ativa nada, **não** grava carimbo — diferente de `testar_conexao` (4.4), que opera no pendente e o **ativa**. Use este para um indicador de saúde; use `testar_conexao` para ativar.
- **Objetivo: dar ao frontend o MOTIVO REAL de uma falha de integração.** Quando o Sicoob responde erro, o corpo cru da resposta e o status HTTP vão **verbatim** para a tela.

**Request**: sem corpo. Query opcional `?provedor=Sicoob`.

**Response `body.message`** — **4 chaves, sempre presentes**:

```jsonc
// sucesso (Sicoob autenticou)
{
  "success": true,
  "status_code": 200,
  "message": "Integracao ativa saudavel; autenticacao no Sicoob bem-sucedida.",
  "sicoob": { "token_type": "Bearer", "expires_in": 300, "scope": "cobranca" }
}
```
```jsonc
// erro do Sicoob (ex.: credencial inválida)
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

| Campo | Tipo | Semântica |
|---|---|---|
| `success` | bool | `true` **sse** o Sicoob respondeu `< 400` **e** devolveu token. É o seu sinal binário de saúde |
| `status_code` | int\|**null** | HTTP do Sicoob. **`null`** quando não houve resposta (erro de transporte/rede) **ou** erro local (sem config ativa) — nesses casos nem se chegou ao banco |
| `message` | string | Resumo humano. ⚠️ **Não é o motivo real** num erro HTTP — é genérico (`"Falha ao obter token do Sicoob."`). O motivo real está em `sicoob.corpo` |
| `sicoob` | object\|**null** | **Tudo que veio do Sicoob** (ver abaixo). `null` quando não se alcançou o banco |

**O campo `sicoob` — a razão de existir deste endpoint:**

- **Sucesso**: `{token_type, expires_in, scope}` — os metadados não-secretos do token.
- **Erro HTTP (≥400)**: `{status_code, corpo}` — onde **`corpo` é a resposta CRUA do Sicoob, byte a byte**. É aqui que está o `invalid_client` / `error_description` / seja lá o que o banco disse. **Para diagnosticar, leia `sicoob.corpo`, não `message`.** Se o corpo for JSON, ele vem como **string** — faça `JSON.parse` no cliente se quiser os campos.
- **Erro de transporte** (rede/timeout, sem resposta HTTP): `sicoob` é `null`, `status_code` é `null`, e o motivo (texto do erro de transporte) vem em `message`.

🔒 **RN-06 — o que você NÃO recebe (por segurança, não esquecimento):**

- O **`access_token`** nunca é devolvido. Ele é uma credencial bearer do banco — se vazasse para o browser, qualquer um com ele chamaria o Sicoob em nome do titular. Você recebe os metadados do token (tipo, expiração, escopo), nunca o token.
- A **senha do certificado** nunca transita (usada só localmente no mTLS).
- Em erro **local** (sem config, certificado ilegível), o `details` técnico — que pode conter caminho absoluto do servidor — **não** é repassado; só a `message` de negócio.

**Erros possíveis:**

| HTTP (do NOSSO endpoint) | `success` | Quando |
|---|---|---|
| 200 | true | Sicoob autenticou |
| 200 | false | Sicoob recusou (`status_code` traz o HTTP do banco), OU erro de transporte (`status_code: null`), OU sem config ativa (`status_code: null`, `sicoob: null`) |
| 403 | — | Sem System Manager (`frappe.PermissionError`) |

**Uso recomendado**: indicador de saúde da integração na tela de configuração (ex.: um selo "Integração OK / com problema"). Como faz um round-trip real ao banco, **chame sob demanda** (ao abrir a tela, num botão "Verificar agora") — **não** em polling agressivo. Quando `success: false`, exiba `message` como resumo e ofereça o detalhe técnico (`sicoob.corpo`) numa área expansível/log, não cru para o gestor comum.

---

### 4.7 Erro transversal do vínculo de certificado (novo em v4-debits)

Introduzido por `_validar_url_alvo_certificado` (`service.py:408-459`), que **pré-valida** a `url_alvo` do certificado **antes de qualquer escrita ou deleção**. Levanta `VinculoCertificadoInvalidoError`, capturada e convertida em erro de negócio nos **4 endpoints** abaixo.

**Duas mensagens literais**:

1. `O vinculo do certificado alvo e invalido (precisa ser um arquivo privado); nenhuma alteracao foi feita.`
   — a url não começa com `/private/files/`, **ou** escapa do diretório privado por travessia (`..`).
2. `O certificado alvo nao foi encontrado; nenhuma alteracao foi feita.`
   — a url é bem-formada mas o binário **não existe no disco**.

**Onde chegam**:

| Endpoint | Como chega |
|---|---|
| `salvar_configuracao` | `_falha(str(exc))` → `{success:false, message}` (`service.py:789-790`) |
| `enviar_certificado` | `_falha(str(exc))` (`service.py:1046-1047`) |
| `remover_certificado` | `_falha(str(exc))` (`service.py:1124-1125`) |
| `testar_conexao` | `_resposta_teste(False, str(exc))` → shape de 6 chaves (`service.py:839-840`) |

**O que a tela deve fazer**: é um erro de **estado inconsistente do servidor**, não de input do usuário. Mensagem própria do tipo *"O certificado atual não pôde ser lido. Envie o certificado novamente."*, oferecendo o botão de **novo upload** (que é o caminho de recuperação). A garantia contratual é forte e deve ser repassada ao usuário: **"nenhuma alteração foi feita"** — nada foi apagado, o estado anterior está intacto.

⚠️ **Exceção documentada (assimetria deliberada, `service.py:909-915`)**: há um 5º ponto de chamada (`_ressincronizar_ex_ativo`, após a ativação em `testar_conexao`) que **não** captura a exceção. Se ela ocorrer ali, o Frappe aborta a request com **HTTP 417** e faz **rollback integral da troca de ativa**. Do ponto de vista da tela: chamada não-200 → tratar como erro inesperado e **recarregar `obter_configuracao`** (o estado no servidor voltou ao anterior).

---

## 5. UI States Required

| Operação | loading | success | empty | validation_error | forbidden | conflict | unexpected_error |
|---|---|---|---|---|---|---|---|
| 1 Obter configuração | ✓ | ✓ | ✓ (sem config ativa) | — | ✓ (403) | — | ✓ |
| 2 Salvar configuração | ✓ | ✓ | — | ✓ | ✓ | ✅ **`requer_decisao`** (RN-08) | ✓ (inclui **417**) |
| 3 Enviar certificado | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| 4 Testar conexão | ✓ | ✓ (**e ativou**) | — | ✓ (falha de conexão) | ✓ | — | ✓ (inclui **417**) |
| 5 Remover certificado | ✓ | ✓ | — | ✓ (sem cert próprio) | ✓ | — | ✓ |
| 6 Baixar consolidado | ✓ | ✓ (download) | ✓ (**PDF de 0 páginas**) | — | ✓ | — | ✓ |
| 7 Apurar boletos abertos | ✓ | ✓ | ✓ (`total: 0`) | — | ✓ | — | ✓ |
| 8 Resumir consolidado | ✓ (**pode demorar**) | ✓ | ✓ (`total: 0`) | — | ✓ | — | ✓ |
| 9 Verificar saúde | ✓ (**round-trip real**) | ✓ (`success:true`) | — | ✓ (`success:false` + `sicoob.corpo`) | ✓ | — | ✓ (transporte: `status_code:null`) |

> **Estado novo — `conflict` na op. 2**: a revisão anterior marcava este estado como inexistente. Ele existe: é o diálogo de decisão do RN-08 (4.2.1). Precisa de: contagem, três ações, e a ação "baixar consolidado" ligada à op. 6.
> **Estado novo — `cancelled` na op. 2**: `decisao: "nao_aceitar"` devolve `success: false`, mas **não é erro**. Não tem linha na tabela porque não é um estado de erro — é o fechamento normal do diálogo.
> ⚠️ **`loading` da op. 8 é diferente**: ela monta o consolidado inteiro em memória. Trate como operação lenta (spinner com texto, não skeleton instantâneo).

> `forbidden` (403) aplica-se a **todas**: usuário sem System Manager vê "Sem permissão", sem detalhes do backend.
> ⚠️ Novo estado a prever: **417** (`frappe.ValidationError` não capturada) — `ambiente` inválido, invariante do DocType, ou o 5º ponto de 4.7. Trate como `unexpected_error` + recarregar `obter_configuracao`.

## 6. Error Mapping

> Como **não há `error_code`**, a discriminação é por **contexto da chamada** + **texto literal** de `message`. Prefira mapear por **prefixo estável** do texto (as mensagens com interpolação são a de tamanho, as de campo de conta e a de `requer_decisao`).

> 🚨 **CORREÇÃO CRÍTICA em relação à revisão de 2026-07-21 — leia antes de copiar o mapeamento antigo.**
>
> Aquela versão instruía: *"qualquer `message` contendo `"nenhuma alteracao foi feita."` → estado de erro do 4.7, com CTA de reenviar o certificado"*. **Essa regra agora está ERRADA e produziria um bug de UX sério.**
>
> A v5 introduziu uma terceira mensagem terminada com a mesma frase:
> `A troca de configuracao foi cancelada a pedido do gestor; nenhuma alteracao foi feita.`
>
> Ou seja: o gestor clica em **"Cancelar"** no diálogo de troca, e a tela — seguindo a regra antiga — responde *"O certificado atual não pôde ser lido. Envie o certificado novamente."* Um cancelamento normal viraria um alarme falso de certificado corrompido.
>
> **Regra correta**: discrimine pelo **prefixo**, nunca pelo sufixo compartilhado.
>
> | Prefixo | Significado | Estado |
> |---|---|---|
> | `O vinculo do certificado alvo e invalido` | certificado ilegível (4.7) | erro de estado + CTA de upload |
> | `O certificado alvo nao foi encontrado` | certificado ilegível (4.7) | erro de estado + CTA de upload |
> | `A troca de configuracao foi cancelada` | **cancelamento do usuário** (RN-08) | **não é erro** — fecha o diálogo |

| Op | Sinal backend | Estado UI | O que a tela faz |
|---|---|---|---|
| 1 | `message == "Nenhuma configuracao de integracao bancaria ativa foi encontrada."` | `empty` | Oferecer primeira configuração / instruir admin |
| 2 | `message` começa com `"O campo auth_url"` / `"O campo api_base_url"` | inline no campo de URL | Exibir `message`; nada foi gravado |
| 2 | `message` começa com `"O campo '"` (conta) | inline no campo correspondente (`Numero do Cliente`, `Numero da Conta Corrente`, `Codigo da Modalidade`) | Exibir `message` |
| 2 | `message == "O campo parametros_provedor deve ser um JSON valido."` | inline no avançado | Exibir `message` |
| 2 | `message` termina com `"para editar."` | `empty` | Sem config ativa |
| 3 | `message == "O arquivo do certificado (base64) e obrigatorio."` | inline no campo arquivo | Reanexar |
| 3 | `message == "O arquivo do certificado nao contem um base64 valido."` | inline no campo arquivo | Bug de encoding do cliente — checar prefixo data-URI |
| 3 | `message` começa com `"Tamanho do certificado ("` | inline no campo arquivo | Exibir `message` (traz os limites atuais) |
| 3 | `message == "Senha incorreta ou arquivo nao e um PKCS#12 valido."` | inline, **junto** a senha **e** arquivo | ⚠️ Não afirme "senha errada": pode ser o arquivo. Texto sugerido: *"Não foi possível abrir o certificado: verifique o arquivo e a senha."* |
| 3/5 | `message == "PKCS#12 nao contem um certificado."` | inline no campo arquivo | Arquivo inadequado |
| 4 | `success:false` (qualquer `message`) | banner de falha | Exibir `message`; **config anterior permanece em vigor**; `detalhes` só em área técnica |
| 4 | `message == "Nenhuma configuracao pendente para testar. …"` | apontar "Salvar" | Não há o que testar |
| 5 | `message == "A configuracao nao possui certificado proprio para remover (o fallback legado nao e removivel por aqui)."` | aviso | Explicar que o certificado em uso é o do servidor (legado) |
| 2 | `requer_decisao === true` (campo booleano, **não** texto) | `conflict` — diálogo de decisão | Renderizar as opções a partir de `opcoes[]`; mostrar `total_abertos`. Ver 4.2.1 |
| 2 | `message == "O campo 'decisao' e invalido. Valores aceitos: aceitar, nao_aceitar, aceitar_com_consolidado."` | `unexpected_error` (**bug do cliente**) | A tela nunca deveria enviar um valor fora de `opcoes[]`. Logar; não expor ao gestor |
| 2 | `message` começa com `"A troca de configuracao foi cancelada"` | **nenhum** — não é erro | Fechar o diálogo, preservar o formulário. **Não** mostrar erro |
| 2/3/4/5 | `message` começa com `"O vinculo do certificado alvo e invalido"` **ou** `"O certificado alvo nao foi encontrado"` | erro de estado (ver 4.7) | *"O certificado atual não pôde ser lido. Envie o certificado novamente."* + CTA de upload |
| qualquer | HTTP 403 | `forbidden` | "Sem permissão", sem detalhes |
| qualquer | HTTP 417 | `unexpected_error` | "Não foi possível concluir" + recarregar `obter_configuracao` |
| qualquer | HTTP 5xx | `unexpected_error` | "Erro inesperado" + log; retry com backoff |

## 7. Fixtures

> ✅ **Todas as fixtures abaixo foram REESCRITAS contra o código.** As do handoff PRÉ-RUN estavam erradas em: envelope `message` ausente, `error_code` inexistente, `titular_nome`/`titular_documento`, `pendente.presente`, máscara do `client_id` invertida, e a fixture de `requer_decisao` (que na época **não** existia no backend — hoje existe e está reescrita abaixo, contra o código da v5).

```json
{
  "name": "obter_configuracao/success-com-pendente",
  "request": { "method": "GET", "path": "/api/method/locacao_automation.integracao_bancaria_api.service.obter_configuracao" },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "message": "Configuracao ativa carregada.",
    "configuracao": {
      "name": "80eee0d13b", "provedor": "Sicoob", "ativo": 1, "ambiente": "Producao",
      "auth_url": "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
      "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
      "client_id": "********f456", "scope": "boletos_inclusao boletos_consulta",
      "numero_cliente": 12345, "numero_conta_corrente": 67890, "codigo_modalidade": 1,
      "parametros_provedor": "{}"
    },
    "certificado": {
      "presente": true, "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
      "documento": "12345678000190", "emissor": "AC SOLUTI Multipla v5",
      "valido_de": "2025-08-22", "valido_ate": "2026-08-22",
      "dias_para_vencer": 32, "origem": "upload"
    },
    "pendente": {
      "name": "c699b0110f",
      "campos_divergentes": { "numero_conta_corrente": 222 },
      "carimbo": "nao_testado"
    }
  } } }
}
```
```json
{
  "name": "obter_configuracao/success-sem-pendente",
  "comment": "quando NAO ha pendente, a chave `pendente` esta AUSENTE (nao vem presente:false)",
  "response": { "status": 200, "body": { "message": {
    "success": true, "message": "Configuracao ativa carregada.",
    "configuracao": { "name": "80eee0d13b", "provedor": "Sicoob", "ativo": 1, "ambiente": "Producao",
      "auth_url": "https://auth.sicoob.com.br/...", "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
      "client_id": "********f456", "scope": "boletos_inclusao", "numero_cliente": 12345,
      "numero_conta_corrente": 67890, "codigo_modalidade": 1, "parametros_provedor": "{}" },
    "certificado": { "presente": true, "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
      "documento": "12345678000190", "emissor": "AC SOLUTI Multipla v5",
      "valido_de": "2025-08-22", "valido_ate": "2026-08-22", "dias_para_vencer": 32, "origem": "upload" }
  } } }
}
```
```json
{
  "name": "obter_configuracao/sem-configuracao-ativa",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "Nenhuma configuracao de integracao bancaria ativa foi encontrada."
  } } }
}
```
```json
{
  "name": "salvar_configuracao/sucesso-parcial",
  "request": { "method": "POST", "path": "/api/method/locacao_automation.integracao_bancaria_api.service.salvar_configuracao",
               "body": { "numero_conta_corrente": 222 } },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "message": "Alteracoes salvas em uma configuracao pendente. Teste a conexao para coloca-la em vigor.",
    "configuracao": { "name": "c699b0110f", "provedor": "Sicoob", "ativo": 0, "ambiente": "Producao",
      "auth_url": "https://auth.sicoob.com.br/...", "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
      "client_id": "********f456", "scope": "boletos_inclusao", "numero_cliente": 12345,
      "numero_conta_corrente": 222, "codigo_modalidade": 1, "parametros_provedor": "{}" }
  } } }
}
```
```json
{
  "name": "salvar_configuracao/conta-invalida",
  "request": { "method": "POST", "path": "…service.salvar_configuracao", "body": { "numero_conta_corrente": 0 } },
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "O campo 'Numero da Conta Corrente' deve ser um inteiro maior que zero."
  } } }
}
```
```json
{
  "name": "enviar_certificado/sucesso",
  "request": { "method": "POST", "path": "…service.enviar_certificado",
               "body": { "arquivo_base64": "MIIKzQIBAzCCCo...", "nome_arquivo": "certificado.pfx", "senha": "1234" } },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "message": "Certificado validado e anexado a configuracao pendente. Teste a conexao para coloca-lo em vigor.",
    "certificado": { "presente": true, "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
      "documento": "12345678000190", "emissor": "AC SOLUTI Multipla v5",
      "valido_de": "2026-03-12", "valido_ate": "2027-03-12", "dias_para_vencer": 234, "origem": "upload" }
  } } }
}
```
```json
{
  "name": "enviar_certificado/senha-errada-ou-formato-invalido",
  "comment": "backend NAO distingue senha errada de arquivo invalido (anti-oraculo)",
  "response": { "status": 200, "body": { "message": {
    "success": false, "message": "Senha incorreta ou arquivo nao e um PKCS#12 valido."
  } } }
}
```
```json
{
  "name": "enviar_certificado/tamanho-fora-da-faixa",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "Tamanho do certificado (120 bytes) fora da faixa aceitavel (256-32768 bytes)."
  } } }
}
```
```json
{
  "name": "testar_conexao/sucesso-e-ativou",
  "request": { "method": "POST", "path": "…service.testar_conexao", "body": {} },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "message": "Conexao testada com sucesso; a configuracao foi ativada.",
    "mensagem": "Conexao testada com sucesso; a configuracao foi ativada.",
    "detalhes": null, "expires_in": 3600, "scope": "boletos_inclusao boletos_consulta"
  } } }
}
```
```json
{
  "name": "testar_conexao/sem-pendente",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "Nenhuma configuracao pendente para testar. Salve alteracoes antes de testar a conexao.",
    "mensagem": "Nenhuma configuracao pendente para testar. Salve alteracoes antes de testar a conexao.",
    "detalhes": null, "expires_in": null, "scope": null
  } } }
}
```
```json
{
  "name": "remover_certificado/sem-certificado-proprio",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "A configuracao nao possui certificado proprio para remover (o fallback legado nao e removivel por aqui)."
  } } }
}
```
```json
{
  "name": "qualquer/vinculo-certificado-invalido",
  "comment": "v4-debits — chega em salvar_configuracao, enviar_certificado, remover_certificado (shape _falha) e testar_conexao (shape de 6 chaves)",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "O vinculo do certificado alvo e invalido (precisa ser um arquivo privado); nenhuma alteracao foi feita."
  } } }
}
```
```json
{
  "name": "obter_configuracao/certificado-vencido",
  "response": { "status": 200, "body": { "message": {
    "success": true, "message": "Configuracao ativa carregada.",
    "configuracao": { "name": "80eee0d13b", "provedor": "Sicoob", "ativo": 1, "ambiente": "Producao",
      "auth_url": "https://auth.sicoob.com.br/...", "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
      "client_id": "********f456", "scope": "boletos_inclusao", "numero_cliente": 12345,
      "numero_conta_corrente": 67890, "codigo_modalidade": 1, "parametros_provedor": "{}" },
    "certificado": { "presente": true, "titular": "IMOBILIARIA FULANO LTDA:12345678000190",
      "documento": "12345678000190", "emissor": "AC SOLUTI Multipla v5",
      "valido_de": "2025-07-01", "valido_ate": "2026-07-01",
      "dias_para_vencer": -20, "origem": "upload" }
  } } }
}
```
```json
{
  "name": "salvar_configuracao/requer-decisao",
  "comment": "v5/RN-08 — shape de 5 chaves, SEM `configuracao`. Mapeie por requer_decisao, nunca pelo texto (total_abertos e interpolado).",
  "request": { "method": "POST", "path": "…service.salvar_configuracao",
               "body": { "numero_conta_corrente": 222 } },
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "requer_decisao": true,
    "total_abertos": 7,
    "opcoes": ["aceitar", "nao_aceitar", "aceitar_com_consolidado"],
    "message": "Existem 7 boletos em aberto emitidos pela conta atual."
  } } }
}
```
```json
{
  "name": "salvar_configuracao/decisao-aceitar-grava",
  "comment": "com `decisao` presente o backend NAO apura boletos — resposta e o sucesso padrao do 4.2",
  "request": { "method": "POST", "path": "…service.salvar_configuracao",
               "body": { "numero_conta_corrente": 222, "decisao": "aceitar" } },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "message": "Alteracoes salvas em uma configuracao pendente. Teste a conexao para coloca-la em vigor.",
    "configuracao": { "name": "c699b0110f", "provedor": "Sicoob", "ativo": 0, "ambiente": "Producao",
      "auth_url": "https://auth.sicoob.com.br/...", "api_base_url": "https://api.sicoob.com.br/cobranca-bancaria/v3",
      "client_id": "********f456", "scope": "boletos_inclusao", "numero_cliente": 12345,
      "numero_conta_corrente": 222, "codigo_modalidade": 1, "parametros_provedor": "{}" }
  } } }
}
```
```json
{
  "name": "salvar_configuracao/decisao-nao-aceitar-cancela",
  "comment": "NAO E ERRO — e o cancelamento do gestor. Cuidado: termina com a mesma frase dos erros de certificado do 4.7. Discrimine pelo PREFIXO.",
  "request": { "method": "POST", "path": "…service.salvar_configuracao",
               "body": { "numero_conta_corrente": 222, "decisao": "nao_aceitar" } },
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "A troca de configuracao foi cancelada a pedido do gestor; nenhuma alteracao foi feita."
  } } }
}
```
```json
{
  "name": "salvar_configuracao/decisao-invalida",
  "comment": "bug do cliente: a tela so deve enviar valores vindos de `opcoes[]`. Avaliado ANTES das validacoes de campo.",
  "request": { "method": "POST", "path": "…service.salvar_configuracao",
               "body": { "numero_conta_corrente": 222, "decisao": "talvez" } },
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "message": "O campo 'decisao' e invalido. Valores aceitos: aceitar, nao_aceitar, aceitar_com_consolidado."
  } } }
}
```
```json
{
  "name": "apurar_boletos_abertos/com-boletos",
  "comment": "shape CRU — nao ha chave `success` nesta familia",
  "request": { "method": "GET", "path": "/api/method/locacao_automation.integracao_bancaria_api.service.apurar_boletos_abertos" },
  "response": { "status": 200, "body": { "message": {
    "total": 7,
    "identificadores": ["COB-0001", "COB-0002", "COB-0003", "COB-0004", "COB-0005", "COB-0006", "COB-0007"]
  } } }
}
```
```json
{
  "name": "apurar_boletos_abertos/carteira-vazia",
  "response": { "status": 200, "body": { "message": { "total": 0, "identificadores": [] } } }
}
```
```json
{
  "name": "resumir_consolidado_boletos_abertos/com-ausentes",
  "comment": "invariante: len(disponiveis) + len(ausentes) == total. Endpoint CARO — chamar sob demanda, nunca em polling.",
  "request": { "method": "GET", "path": "…service.resumir_consolidado_boletos_abertos" },
  "response": { "status": 200, "body": { "message": {
    "total": 7,
    "disponiveis": ["COB-0001", "COB-0002", "COB-0003", "COB-0004"],
    "ausentes": ["COB-0005", "COB-0006", "COB-0007"]
  } } }
}
```
```json
{
  "name": "resumir_consolidado_boletos_abertos/todos-disponiveis",
  "response": { "status": 200, "body": { "message": {
    "total": 2, "disponiveis": ["COB-0001", "COB-0002"], "ausentes": []
  } } }
}
```
```json
{
  "name": "verificar_saude_integracao/saudavel",
  "comment": "access_token NUNCA vem (RN-06); so metadados do token",
  "request": { "method": "GET", "path": "/api/method/locacao_automation.integracao_bancaria_api.service.verificar_saude_integracao" },
  "response": { "status": 200, "body": { "message": {
    "success": true,
    "status_code": 200,
    "message": "Integracao ativa saudavel; autenticacao no Sicoob bem-sucedida.",
    "sicoob": { "token_type": "Bearer", "expires_in": 300, "scope": "cobranca" }
  } } }
}
```
```json
{
  "name": "verificar_saude_integracao/erro-do-sicoob",
  "comment": "o MOTIVO REAL esta em sicoob.corpo (cru, verbatim), NAO em message. corpo e string; JSON.parse no cliente.",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "status_code": 401,
    "message": "Falha ao obter token do Sicoob.",
    "sicoob": {
      "status_code": 401,
      "corpo": "{\"error\":\"invalid_client\",\"error_description\":\"Client authentication failed\"}"
    }
  } } }
}
```
```json
{
  "name": "verificar_saude_integracao/sem-config-ativa",
  "comment": "erro LOCAL: nem chegou ao banco -> status_code e sicoob nulos",
  "response": { "status": 200, "body": { "message": {
    "success": false,
    "status_code": null,
    "message": "Nenhuma configuracao de integracao bancaria ativa foi encontrada.",
    "sicoob": null
  } } }
}
```
```json
{
  "name": "qualquer/sem-permissao",
  "comment": "envelope de excecao do Frappe; a forma exata das chaves varia com a versao — trate pelo status",
  "response": { "status": 403, "body": {
    "exc_type": "PermissionError",
    "_server_messages": "[\"{\\\"message\\\": \\\"Acesso restrito a administradores do sistema (System Manager).\\\"}\"]"
  } }
}
```

## 8. Frontend Implementation Notes

**8.1 — Layout (decisões de produto — ✅ CONTINUAM VÁLIDAS)**
- **Seção "Configurações avançadas" colapsada** (acordeão) contendo `auth_url`, `api_base_url`, `ambiente` e `parametros_provedor`. Motivo: editar URL de API por engano quebra a integração em silêncio.
  ✅ **Reforçado pelo código**: o próprio DocType agrupa `parametros_provedor` numa seção "Avancado". `auth_url`/`api_base_url` são os campos com validação `https` estrita.
- `auth_url`/`api_base_url`/demais campos chegam **pré-preenchidos** de `obter_configuracao().configuracao`.
- Duas personas na mesma tela: **gestor** (não-técnico, fluxo comum) e **admin técnico** (abre o avançado).
- Tela **autoexplicativa** — uso raro (renovação anual), sem familiaridade acumulada.
- ⚠️ **Campo sem espelho na tela**: `client_id` chega **mascarado**. Se a tela reenviar o valor exibido, gravará a máscara (`********f456`) como client_id real. **Só envie `client_id` quando o usuário digitar um valor novo**; caso contrário, **omita a chave** (a semântica de atualização parcial preserva o valor). O mesmo vale para `certificado_senha`.

**8.2 — Certificado e vencimento (✅ CONTINUAM VÁLIDAS)**
- **Badge "vence em X dias"** ao abrir a tela, de `certificado.dias_para_vencer` (int com sinal, ou `null`).
- **Escalonamento visual**: `dias_para_vencer <= 30` → aviso informativo; `< 0` → **destaque crítico** com chamada para renovação. `null` → sem badge (não há validade conhecida).
- **Confirmação antes de ativar**: após `enviar_certificado`, mostrar `titular`/`documento`/`emissor`/`valido_de`/`valido_ate` extraídos e perguntar *"É esta a conta?"*. Salvaguarda contra upload do arquivo errado. ✅ Confirmado: o backend devolve exatamente esses metadados e **não ativa nada** nesse passo.
- **Formatação**: `documento` vem **só com dígitos** (11 ou 14) — a máscara CPF/CNPJ é responsabilidade da tela. `titular` costuma vir no formato ICP-Brasil `NOME:DOCUMENTO`; exibir só a parte antes do `:` é aceitável.

**8.3 — RN-07: certificado vencido (✅ confirmada, com detalhe novo)**
- O bloqueio por vencimento **não** acontece nesta tela: acontece **na emissão do boleto** (`cobranca_sicoob/emissao.py:311-318`), que recusa **antes** de qualquer HTTP e **antes** de consumir o sequencial, com:
  - `error_code: "SICOOB_CERTIFICADO_VENCIDO"`
  - mensagem: `O certificado digital da configuracao ativa esta vencido (fora do prazo de validade); regularize o certificado antes de emitir o boleto.`
- Critério **estrito**: vencido é `validade_fim < hoje` (`dias_para_vencer < 0`). Um certificado que **vence hoje** (`dias_para_vencer == 0`) **ainda emite**.
- Por isso o **badge é preventivo**: é o único aviso que o gestor recebe antes de a emissão começar a falhar. `certificado.valido_ate` + `dias_para_vencer` são exatamente o insumo para isso.
- ⚠️ `testar_conexao` **não** valida vencimento — um certificado vencido pode passar no teste e ser ativado; a emissão é que recusa depois.

**8.4 — Ciclo de ativação: a sequência OBRIGATÓRIA (✅ confirmada e agora exata)**

```
1. GET  obter_configuracao            → estado atual (ativo + pendente, se houver)
2. POST salvar_configuracao {…}       → grava PENDENTE, carimbo = nao_testado
   e/ou POST enviar_certificado {…}   → grava PENDENTE, carimbo = nao_testado
3. POST testar_conexao {}             → testa o PENDENTE; em SUCESSO carimba E ATIVA
4. GET  obter_configuracao            → recarregar (o pendente virou ativo)
```

- **Salvar não ativa.** ✅ Confirmado.
- ⚠️ **Não existe botão "Ativar" separado.** O PRÉ-RUN previa um; no backend, **`testar_conexao` é o botão de ativar**. O rótulo na tela deve refletir isso — sugestão: *"Testar e ativar"*, com aviso de que um teste bem-sucedido coloca a nova configuração em vigor imediatamente.
- A tela distingue **"em vigor"** (bloco `configuracao`, `ativo: 1`) de **"em edição"** (presença da chave `pendente`). Enquanto `pendente` existir com `campos_divergentes` não vazio, há alteração não aplicada.
- `pendente.carimbo` serve para **indicar** se o teste ainda vale — mas como a ativação acontece dentro do próprio `testar_conexao`, na prática o usuário verá `"nao_testado"` na maior parte do tempo. Após uma ativação bem-sucedida, o ex-ativo é re-sincronizado como cópia do novo ativo (`_ressincronizar_ex_ativo`), então o pendente remanescente volta a ter `campos_divergentes: {}` e `carimbo: "nao_testado"`.
- **Após qualquer sucesso de 2 ou 3, recarregue `obter_configuracao`** — não infira o novo estado localmente.
- **Campos que invalidam o teste**: `auth_url`, `api_base_url`, `client_id`, `scope`, `numero_cliente`, `numero_conta_corrente`, `codigo_modalidade`, impressão digital do certificado. Alterar `ambiente` ou `parametros_provedor` **não** invalida o carimbo.

**8.5 — Upload de certificado**
- Base64 dentro do JSON (não multipart). No browser: `FileReader.readAsDataURL` → **remover o prefixo `data:...;base64,`** antes de enviar, ou usar `readAsArrayBuffer` + `btoa`.
- Pré-validar client-side: `256 <= arquivo.size <= 32768` bytes (⚠️ **valores provisórios** — ver 4.3). Falhar client-side com a mesma mensagem do backend seria frágil; prefira uma mensagem própria e deixe o backend ser a autoridade.
- Capacidade nova no frontend (não havia upload de arquivo antes).

**8.6 — Fluxo de troca com boletos em aberto (✅ COM BACKEND desde a v5)**

> Substitui integralmente a versão anterior deste bloco, que dizia "SEM BACKEND". Tudo abaixo tem contra-parte verificada no código.

**Sequência completa, com os três caminhos:**

```
      GET apurar_boletos_abertos            (opcional, barato — aviso preventivo)
                    │
       POST salvar_configuracao {campos}    ← sem `decisao`
                    │
        ┌───────────┴───────────┐
   total_abertos == 0      requer_decisao: true
        │                        │
     sucesso            ┌────────┼────────────────────┐
                        │        │                    │
                   "aceitar"  "nao_aceitar"   "aceitar_com_consolidado"
                        │        │                    │
                        │     cancela        GET baixar_consolidado…  (o CLIENTE baixa)
                        │   (nada mudou)     GET resumir_consolidado… (quem ficou de fora)
                        │                             │
                        └────────────┬────────────────┘
                                     │
              POST salvar_configuracao {campos, decisao: "aceitar"}
                                     │
                                  sucesso
```

**Regras que a tela precisa respeitar:**

1. **Reenvie os campos junto com a `decisao`.** O primeiro POST foi recusado — **nada foi gravado**. O segundo POST precisa carregar o payload inteiro de novo, não só `{decisao}`.
2. **Guarde a decisão no estado da tela e reenvie em toda gravação seguinte** enquanto houver boleto em aberto. A decisão não é lembrada pelo servidor (4.2.1).
3. **`aceitar_com_consolidado` não baixa nada.** Se o gestor escolher essa opção, **a tela** chama `baixar_consolidado_boletos_abertos` antes de confirmar. Ver a armadilha em 4.2.1.
4. **Avise sobre os ausentes.** Depois do download, `resumir_consolidado_boletos_abertos` diz quem ficou de fora. Sem esse aviso, o gestor acredita que o PDF está completo — e ele pode não estar (boleto sem PDF anexado ou com PDF corrompido).
5. **Aviso preventivo é melhor que diálogo surpresa.** Chame `apurar_boletos_abertos` (barato) ao abrir a edição e mostre "existem N boletos em aberto" antes de o gestor preencher o formulário. O `requer_decisao` vira confirmação, não notícia.
6. ⚠️ **Só `salvar_configuracao` exige decisão.** `enviar_certificado`, `remover_certificado` e `testar_conexao` **não** consultam boletos em aberto. Trocar o certificado (que muda a conta efetiva tanto quanto trocar o número) **não** dispara o RN-08. Se o produto quiser cobrir esse caminho, é decisão nova de backend — ver `[DÚVIDA] #8`.

**8.7 — Filtro RN-02 "boleto em aberto" (fonte única, confirmada)**

`cobranca_sicoob/rotina_pagamentos.py:16-21` — `FILTROS_BOLETO_ABERTO`, importado (não duplicado) por `integracao_bancaria_api/boletos_abertos.py:28`:

```python
FILTROS_BOLETO_ABERTO = {
    "status_cobranca": ["in", ["Pendente", "Vencida"]],
    "boleto_gerado": 1,
    "nosso_numero": ["not in", ["", None]],
}
```

Ou seja: **Cobrança com `status_cobranca` em (`Pendente`, `Vencida`) E `boleto_gerado = 1` E `nosso_numero` preenchido.** Ordenação do consolidado: `data_vencimento asc, name asc` (`boletos_abertos.py:40`).

## 9. Acceptance Criteria

- [ ] A tela lê `body.message` (envelope do Frappe), nunca o corpo raiz.
- [ ] Todas as operações de escrita usam **POST** (GET seria descartado por rollback).
- [ ] A tela distingue visualmente config "em vigor" de "em edição" pela **presença da chave `pendente`** (não por `pendente.presente`).
- [ ] `api_base_url`/`auth_url`/`ambiente`/`parametros_provedor` ficam sob "Configurações avançadas" colapsada, pré-preenchidos.
- [ ] `client_id` mascarado **nunca** é reenviado ao backend; a chave é omitida quando o usuário não digitou um novo valor. Idem `certificado_senha`.
- [ ] Badge de vencimento aparece ao abrir, de `certificado.dias_para_vencer`; vira destaque crítico quando `< 0`; some quando `null`.
- [ ] Após `enviar_certificado`, a tela mostra `titular`/`documento`/`emissor`/validade extraídos e exige confirmação antes de testar/ativar.
- [ ] `documento` é formatado como CPF/CNPJ na exibição (o backend devolve só dígitos).
- [ ] "Senha incorreta ou arquivo nao e um PKCS#12 valido" é apresentada **sem afirmar** que a culpa é da senha.
- [ ] O botão de ativação é rotulado como **"Testar e ativar"** e avisa que o sucesso coloca a configuração em vigor imediatamente.
- [ ] Após sucesso de qualquer escrita, a tela **recarrega `obter_configuracao`** em vez de inferir estado.
- [ ] Falha de `testar_conexao` mostra `message` (nunca `detalhes` cru) e comunica que a configuração anterior segue em vigor.
- [ ] Qualquer `message` contendo `"nenhuma alteracao foi feita."` vira o estado de erro do 4.7, com CTA de novo upload e garantia explícita de que nada mudou.
- [ ] `baixar_consolidado_boletos_abertos` é tratado como **blob/download** (`Content-Disposition: inline`), nunca `.json()`.
- [ ] O caso "PDF consolidado de 0 páginas" é tratado sem quebrar a tela.
- [ ] HTTP 403 mostra "Sem permissão" sem expor detalhes; HTTP 417 vira erro inesperado + reload.

**Acrescentados na auditoria de 2026-07-22 (RN-08 / RN-09):**

- [ ] O diálogo de decisão é disparado por **`requer_decisao === true`**, nunca pelo texto de `message` (que interpola `total_abertos`).
- [ ] As opções do diálogo são renderizadas a partir de **`opcoes[]` da resposta**, não de uma lista hard-coded no cliente.
- [ ] 🚨 A mensagem de **cancelamento** (`"A troca de configuracao foi cancelada…"`) **não** é tratada como o erro de certificado do 4.7 — a discriminação é por **prefixo**, nunca pelo sufixo `"nenhuma alteracao foi feita."` compartilhado pelas três.
- [ ] Ao confirmar a decisão, a tela **reenvia o payload completo** junto com `decisao` (o primeiro POST não gravou nada).
- [ ] A decisão do gestor fica no estado da tela e é **reenviada nas gravações seguintes** enquanto houver boleto em aberto.
- [ ] `aceitar_com_consolidado` dispara o **download pelo cliente** (`baixar_consolidado_boletos_abertos`) antes de confirmar — a tela não assume que o backend baixou.
- [ ] Depois do download, a tela informa **quantos boletos ficaram de fora** (`resumir_consolidado_boletos_abertos.ausentes`).
- [ ] `resumir_consolidado_boletos_abertos` é chamado **sob demanda**, nunca em polling nem no mount, e com indicador de operação lenta.
- [ ] `apurar_boletos_abertos` (barato) é usado para o aviso preventivo ao abrir a edição; `resumir…` (caro) só no contexto do consolidado.
- [ ] A tela nunca envia um valor de `decisao` fora de `opcoes[]` — receber `"O campo 'decisao' e invalido…"` é bug do cliente e deve ser logado, não exibido ao gestor.
- [ ] As respostas de `apurar_boletos_abertos` e `resumir_consolidado_boletos_abertos` são lidas **sem esperar a chave `success`** (o shape é cru).

## 10. Minimum Tests

| # | Tipo | Comportamento |
|---|---|---|
| 1 | Component | Badge renderiza de `dias_para_vencer`; crítico se `< 0`; ausente se `null` |
| 2 | Component | Metadados (`titular`/`documento`/`emissor`/validade) aparecem antes da confirmação; `documento` formatado |
| 3 | Component | "Em edição" é sinalizado quando a chave `pendente` existe; "em vigor" quando ausente |
| 4 | Integration | `enviar_certificado` com base64 inválido → erro inline; nenhuma outra chamada disparada |
| 5 | Integration | `enviar_certificado` com senha errada → mensagem neutra (arquivo **ou** senha), config intacta |
| 6 | Integration | `testar_conexao` falho → banner com `message`, `detalhes` não exibido, config anterior mantida |
| 7 | Integration | `testar_conexao` com sucesso → recarrega `obter_configuracao` e reflete o novo ativo |
| 8 | Integration | `salvar_configuracao` **não** reenvia `client_id` mascarado nem `certificado_senha` vazia |
| 9 | Integration | Erro `"… nenhuma alteracao foi feita."` em qualquer dos 4 endpoints → mesmo estado de erro + CTA de upload |
| 10 | Integration | Download do consolidado usa blob; PDF de 0 páginas não quebra a tela |
| 11 | Integration | 403 em qualquer chamada → estado `forbidden`; 417 → `unexpected_error` + reload |
| 12 | Integration | `salvar_configuracao` → `requer_decisao: true` abre o diálogo com `total_abertos` e as opções vindas de `opcoes[]` |
| 13 | Integration | Confirmar com `aceitar` **reenvia o payload completo** + `decisao`; a segunda chamada grava |
| 14 | Integration | `nao_aceitar` fecha o diálogo **sem estado de erro** e preserva o formulário |
| 15 | **Regression** | 🚨 Mensagem de cancelamento **não** dispara o estado de erro do 4.7 (CTA de reenviar certificado). Este teste existe porque as três mensagens terminam com a mesma frase — é a armadilha documentada no bloco 6 |
| 16 | Integration | `aceitar_com_consolidado` dispara o download pelo **cliente** antes de confirmar; a tela não assume que o backend baixou |
| 17 | Integration | Após o download, os `ausentes` de `resumir_consolidado_boletos_abertos` viram aviso ao gestor |
| 18 | Integration | Segunda gravação na mesma sessão **reenvia `decisao`** e não reabre o diálogo |
| 19 | Component | `apurar_boletos_abertos` com `total: 0` → nenhum aviso preventivo; com `total > 0` → aviso |
| 20 | Component | Resposta de `apurar`/`resumir` é lida sem depender de `success` (shape cru) |

## 11. Open Questions — status PÓS-RUN das 6 [DÚVIDA] originais

| # | Dúvida original | Status | Detalhe |
|---|---|---|---|
| 1 | **Como a lista nominal de boletos ausentes chega à tela** | ✅ **FECHADA (v5)** | Resolvida pela opção (b) — **endpoint JSON irmão**. `resumir_consolidado_boletos_abertos` devolve `{total, disponiveis, ausentes}` (4.9) e `apurar_boletos_abertos` devolve `{total, identificadores}` (4.8). O streaming de `baixar_consolidado_boletos_abertos` ficou **byte-a-byte inalterado** — a escolha foi acrescentar canal, não alterar o existente. ⚠️ Ressalva: os identificadores são `name` de `Cobranca`, não dados de exibição (ver #7). |
| 2 | **Faixa de tamanho aceitável do `.pfx`** | 🟡 **RESPONDIDA, com ressalva** | `256` a `32768` bytes (`certificado.py:42-43`). ⚠️ **Ambos marcados `TODO(a-definir): limite real`** — são provisórios e dependem de política operacional ainda não fechada. O frontend pode pré-validar, mas a autoridade é o backend e os valores podem mudar. |
| 3 | **Redação do aviso de troca (informativo vs. advertência)** | ✅ **DECIDIDA: advertência, com base factual** | Texto em [`plano-frontend.md`](plano-frontend.md) §14. A pergunta técnica de fundo **foi investigada em 2026-07-22** (auditoria de código, §14.6 do plano): baixa/consulta enviam `numeroCliente`/`codigoModalidade` da **config ATIVA** com o `nossoNumero` do boleto antigo — inconsistente por construção após a troca. **Praticamente certo que falha**, por dois caminhos independentes: entre titulares diferentes o certificado mTLS não tem escopo (aceitar seria falha de autorização em nível de objeto — BOLA/IDOR); dentro do mesmo titular o `nossoNumero` é sequencial por conta e ficaria ambíguo sem o `numeroCliente`. A segurança está no certificado; o `numeroCliente` é chave de busca, não controle de acesso. **Falhar é o desfecho bom.** ⚠️ **Decisão registrada: NÃO corrigir agora** — plano §14.7. |
| 4 | **Ambiente de homologação disponível?** | 🟠 **ABERTA** | Nenhuma resposta no código. O DocType oferece `Producao`/`Homologacao` (Select) e a produção está em `Producao`. Não há credenciais nem URL de homologação declaradas em lugar algum do app. **Impacto na UI**: o seletor `ambiente` deve ficar no avançado e, idealmente, com aviso de que a homologação pode não estar provisionada. |
| 5 | **Nomes internos do bloco `pendente` e dos `error_code`** | ✅ **FECHADA (parcialmente contra a hipótese)** | `campos_divergentes` e `carimbo` ✅ existem, com os valores `"testado"`/`"nao_testado"`. ❌ Mas `pendente.presente` **não existe** (a chave inteira some), e ❌ **nenhum `error_code` é devolvido** — `VALIDATION_ERROR`, `CONFIGURACAO_AUSENTE`, `CERTIFICADO_INVALIDO`, `CERTIFICADO_LEGADO_INDISPONIVEL` **não cruzam a API**. Discriminação por texto (bloco 6). |
| 6 | *(nova, promovida do bloco 8.3 do PRÉ-RUN)* **Fluxo de 3 opções com boletos em aberto** | ✅ **FECHADA (v5)** | Implementado como o PRÉ-RUN previa: `requer_decisao`/`total_abertos`/`opcoes` na resposta e o parâmetro `decisao` com os três literais. A mensagem é byte-a-byte a do `tech_spec.md:516`. Contrato completo em **4.2.1**. ⚠️ Duas ressalvas que a spec não deixava óbvias: `aceitar_com_consolidado` é **sinônimo de `aceitar`** (o download é do cliente), e a decisão **não é lembrada** entre chamadas. |

**Questões abertas — nenhuma bloqueia o início da implementação:**

- 🟡 `[DÚVIDA]` **Envelope exato do 403/417 do Frappe**. Confirmei os status codes no código (`frappe/exceptions.py:34-35`, `:18-19`) e a mensagem literal do throw (`service.py:176-179`). **Não** validei em runtime a forma exata do corpo (`exc_type` / `_server_messages` / `exception`), que varia entre versões do Frappe. **Trate pelo status HTTP**, não pelo corpo.
- 🟡 `[DÚVIDA]` **Texto das falhas reais de `testar_conexao` vindas do provedor** (`resultado.mensagem_erro`, `service.py:858-861`). Vem do adaptador Sicoob e **não é enumerável** a partir deste módulo. A tela deve exibir o texto como veio, sem mapeamento.
- 🟡 **Observação de segurança**: `testar_conexao` pode devolver em `detalhes` o **caminho absoluto** do certificado legado no servidor (`configuracao.py:151-166`). Não exibir `detalhes` ao gestor.
- 🟡 **Observação de estado**: em produção hoje existe um registro pendente (`c699b0110f`) sem `certificado_arquivo` mas com `pfx_path_legado` — ou seja, `obter_configuracao` **já retorna** um bloco `pendente`. A tela vai encontrar "em edição" desde a primeira carga. Confirmar com o backend se isso é o resíduo esperado do ciclo de re-sincronização ou um estado a limpar.

**Levantadas pela auditoria de 2026-07-22 (pós v5/v6-debits):**

- 🟡 `[DÚVIDA] #7` — **Como exibir os boletos em aberto ao gestor.** `apurar_boletos_abertos` e `resumir_consolidado_boletos_abertos` devolvem `name` de `Cobranca` (`COB-0001`…) — **identificadores internos**, não nosso-número, não nome do sacado, não valor, não vencimento. Para uma lista legível (*"3 boletos ficaram de fora: João Silva R$ 1.200 venc. 10/08…"*) faltaria um endpoint que devolva dados de exibição, ou a tela teria que buscar cada `Cobranca` pela API genérica de recursos do Frappe (`/api/resource/Cobranca/<name>`) — **N chamadas**, o que é ruim para uma carteira grande. **Decisão pendente de produto**: (a) mostrar só a contagem (`total`, `len(ausentes)`) — funciona hoje, zero backend novo; (b) pedir um endpoint que devolva a lista enriquecida. **Recomendação: começar por (a).** A contagem já resolve o essencial ("o consolidado não está completo") e não bloqueia nada.
- 🟡 `[DÚVIDA] #8` — **O RN-08 deveria cobrir a troca de certificado?** Hoje **não cobre**: só `salvar_configuracao` consulta boletos em aberto. `enviar_certificado` e `remover_certificado` trocam a credencial efetiva — o que, do ponto de vista do banco, muda tanto quanto trocar o número da conta — **sem exigir decisão alguma**. Isso é fiel à spec (o RN-08 foi escrito para a troca de configuração), mas pode ser uma lacuna de produto. **Não bloqueia**: é uma pergunta para o dono do produto, não para o frontend.
- 🟡 `[DÚVIDA] #9` — **Custo real de `resumir_consolidado_boletos_abertos` em produção.** O endpoint monta o consolidado inteiro em memória. Com a carteira atual, ninguém mediu o tempo de resposta. Se a imobiliária tiver centenas de boletos em aberto com PDF, isso pode passar de alguns segundos. **Mitigação no frontend**: chamar sob demanda com indicador de progresso explícito e timeout generoso; nunca em polling. **Vale medir** antes de colocar a chamada num caminho crítico da UI.

---

## 12. Mudanças desde o handoff PRÉ-RUN

> Leia isto antes de reaproveitar qualquer código escrito contra o handoff antigo.

### 12.1 Contratos que **não existem** (removidos)

> ℹ️ **Uma linha saiu desta tabela na auditoria de 2026-07-22.** `requer_decisao` / `total_abertos` / `opcoes` / `decisao` constavam aqui como "não existe nada disso" — **a v5 os implementou**. Ver 4.2.1 e 12.6.

| O que o PRÉ-RUN prometia | Realidade | Motivo |
|---|---|---|
| `error_code` em todas as respostas de erro | **Não existe.** `_falha()` devolve só `{success, message}` (+`detalhes`) | Os códigos (`CONFIGURACAO_AUSENTE`, `CERTIFICADO_INVALIDO`, …) ficaram no resolvedor **interno** (`configuracao.py`), consumidos pela emissão. Nunca foram promovidos à borda whitelisted. |
| `pendente.presente: false` | A chave `pendente` **some** quando não há pendente | Implementação optou por omissão em vez de flag. |
| Botão/endpoint de "Ativar" separado | **Não existe.** `testar_conexao` testa **e ativa** na mesma chamada | Decisão de implementação (RN-04 como transação única). |

### 12.2 Contratos que **mudaram de forma**

| Campo | PRÉ-RUN | PÓS-RUN (real) |
|---|---|---|
| Envelope | corpo raiz | **`body.message`** (padrão Frappe) |
| `client_id` mascarado | `"abc1****"` (4 primeiros) | `"********f456"` (**4 últimos**) |
| `certificado.titular_nome` | | **`certificado.titular`** |
| `certificado.titular_documento` (formatado) | | **`certificado.documento`** (**só dígitos**) |
| `certificado.valido_de/valido_ate` | ✅ iguais | ✅ iguais |
| `configuracao` | 9 chaves | **12 chaves** (+`name`, +`ativo`, +`parametros_provedor` como **string JSON**) |
| `testar_conexao` | `{success, mensagem, detalhes, expires_in, scope}` | **6 chaves**: `message` **e** `mensagem` com o mesmo texto |
| `salvar_configuracao` sucesso | `"Configuração salva."` | `"Alteracoes salvas em uma configuracao pendente. Teste a conexao para coloca-la em vigor."` |
| Campos do carimbo | "conta" genérica | **os 3 campos de conta** + `certificado_impressao_digital`; `ambiente` e `parametros_provedor` **fora** |

### 12.3 Coisas novas que o frontend precisa saber

1. **Verbo HTTP importa** (2.2) — GET em método de escrita retorna 200 e é revertido.
2. **HTTP 417** é um estado real (validação do DocType / rollback do 4.7).
3. **Duas mensagens de erro novas (v4-debits)** — bloco 4.7, transversais a 4 endpoints.
4. **`salvar_configuracao` aceita chaves desconhecidas sem erro** (`**_ignorados`) — desde a v6-debits elas viram log no servidor, mas **continuam invisíveis para a tela**. Valide os nomes no cliente (bloco 3).
5. **`remover_certificado` pode deixar `presente: true`** (fallback legado assume).
6. **Consolidado vazio = PDF de 0 páginas**, não erro.
7. **Faixa de tamanho do PFX é provisória** (`TODO(a-definir)` no código).
8. **RN-07 é aplicada na emissão**, não nesta tela (8.3).

### 12.4 🚨 Incidente de segurança em produção (v3) — por que o upload é o caminho recomendado

**O que aconteceu (2026-07-21)**: o hook `attach_files_to_document` do Frappe (`core/doctype/file/utils.py`) roda no `on_update` de **todo** documento. Para cada campo `Attach` preenchido, se não encontra um `File` com aquela url **vinculado àquele documento**, ele **cria um File novo sem passar `is_private`** — que nasce **público**, e o Frappe materializa o binário em `public/files/`, **servido sem autenticação**.

Como o fluxo pendente↔ativo copia `certificado_arquivo` entre registros, a url copiada apontava sempre para um File de **outro** documento → o hook caía nesse ramo → **o certificado PKCS#12 foi publicado em `public/files`**.

**Correção (v3)**: `_replicar_vinculo_certificado` (`service.py:462-568`) — todo documento que recebe a url passa a ter um **`File` privado PRÓPRIO** (`is_private=1`, `attached_to_name` = ele mesmo). Assim o hook sempre encontra o vínculo existente e nunca cria um File público. A garantia é do **estado do documento**, não da escrita — por isso o helper é chamado explicitamente em todos os pontos que gravam o campo.

**Endurecimento (v4-debits)**: `_validar_url_alvo_certificado` (`service.py:408-459`) pré-valida a url **antes de qualquer deleção** — exige prefixo `/private/files/`, containment no diretório privado (bloqueia travessia `..`) e presença do binário no disco. É daí que vêm as **duas mensagens novas** do 4.7.

**Por que isso importa para o frontend**:
- O **upload pela tela** (`enviar_certificado`) é o caminho **correto e recomendado**: grava direto como File privado, com validação completa e sem passar por cópia de campo `Attach`.
- Nunca construa uma UI que peça ao usuário para colar/editar a url do certificado, nem use o widget genérico de anexo do Frappe para esse campo — só o endpoint dedicado.
- As mensagens do 4.7 são o **sintoma visível** dessa defesa. Tratá-las como "erro genérico" esconde do gestor o único caminho de recuperação (reenviar o certificado).

### 12.5 Migração do certificado (fora dos runs)

O certificado migrou do **PFX montado no host** (`/run/secrets/sicoob/certificado.pfx`) para o campo **`Attach`** do DocType. Estado verificado em produção (site `frontend`, config ativa `80eee0d13b`):

- `certificado_arquivo = "/private/files/certificado.pfx"` → **`origem == "upload"`**
- `pfx_path_legado = "/run/secrets/sicoob/certificado.pfx"` → permanece **apenas como fallback** (RN-10)

**RN-10 na prática** (`configuracao.py:221-234`): com `certificado_arquivo` preenchido, o sistema lê o File privado (`origem: "upload"`) e **ignora** o legado. Sem `certificado_arquivo`, cai no `pfx_path_legado` (`origem: "legado"`). Sem nenhum dos dois, erro de negócio. A tela deve exibir a origem, porque `"legado"` significa "o certificado em uso não foi enviado por aqui e não pode ser removido por aqui".

### 12.6 🆕 O que mudou na v5 e na v6-debits (2026-07-22)

> **Se você começou a implementar contra a revisão de 2026-07-21, este é o bloco a ler.** Aquela versão declarava dois contratos como inexistentes; eles agora existem.

**Por que a v5 existiu.** RN-08 e RN-09 estavam no `tech_spec.md` da v1 e **nunca foram implementados** — e ninguém percebeu por 13 gates. A causa: a matriz de rastreabilidade da v1 mapeava `CA-08 → CT-019`, e um `CT-019` existia — testando outra coisa (a apuração do filtro RN-02). O identificador foi reaproveitado, a matriz ficou verde apontando para o teste errado. O buraco só apareceu quando alguém foi **consumir o contrato de fora**, na auditoria deste handoff. É o argumento mais forte que temos para o handoff ser escrito contra o código, não contra a spec.

| Mudança | Onde | Impacto no frontend |
|---|---|---|
| **`decisao` virou parâmetro nomeado** de `salvar_configuracao` | 4.2.1 | Alto — fluxo novo de UI |
| **Shape `requer_decisao`** (5 chaves, sem `configuracao`) | 4.2.1, fixtures | Alto — estado `conflict` novo |
| **`apurar_boletos_abertos`** (endpoint novo) | 4.8 | Médio — aviso preventivo |
| **`resumir_consolidado_boletos_abertos`** (endpoint novo) | 4.9 | Médio — lista de ausentes |
| 🚨 **Colisão de texto de erro** — a mensagem de cancelamento termina com `"nenhuma alteracao foi feita."`, igual às duas do 4.7 | 6 | **Alto — corrige uma regra ERRADA da revisão anterior** |
| `salvar_configuracao` **loga** chaves desconhecidas (v6-debits) | 3 | Nenhum — o log é server-side, invisível para a tela |
| Streaming de `baixar_consolidado_boletos_abertos` | 4.6 | **Zero** — byte-a-byte inalterado, deliberadamente |
| **`verificar_saude_integracao`** (endpoint novo) | 4.10 | Médio — indicador de saúde; expõe o motivo real de erro do Sicoob (`sicoob.corpo`) |

**O que NÃO mudou** (verificado, não presumido): os shapes de `obter_configuracao`, `enviar_certificado`, `testar_conexao` e `remover_certificado`; a máscara do `client_id`; a ausência de `error_code`; o envelope `body.message`; a semântica do carimbo; as duas mensagens do 4.7. Se você já implementou contra eles, **não precisa mexer**.

**Uma nota sobre o que o log da v6-debits significa para você.** O `**_ignorados` continua aceitando qualquer chave sem erro — o que mudou é que o servidor agora **registra** as não reconhecidas. Isso ajuda a diagnosticar um bug do cliente **depois** que ele acontece; **não** protege a tela em tempo de execução. Um typo em `numero_conta_corrente` continua produzindo `success: true` sem efeito, do ponto de vista da UI. Valide os nomes no cliente.

---

## 13. Versionamento e Compatibilidade

- **Contrato imutável (não muda nesta feature)**: as operações de cobrança já consumidas pelo frontend existente — `emitir_boleto_sicoob`, `consultar_boleto_sicoob`, `solicitar_baixa_boleto_sicoob`, `confirmar_baixa_boleto_sicoob`, `sincronizar_status_pagamento_sicoob`, `abrir_boleto` — **preservam assinatura e chaves de resposta**. O frontend que as consome **não precisa mudar**.
  - ✅ **Verificado como acréscimo compatível**: a emissão passou a poder devolver `error_code: "SICOOB_CERTIFICADO_VENCIDO"` (RN-07, `emissao.py:311-318`). É **chave adicional** num shape de erro que já existia — não quebra clientes.
  - ℹ️ **Mudança interna, sem efeito no cliente** (v2-debits): `ResultadoConsulta`/`ResultadoBaixa` ganharam `codigo_erro` com a sentinela `BOLETO_NAO_ENCONTRADO` (`cobranca_bancaria/modelo.py:206, :227, :246`). São **dataclasses internas** do adaptador, consumidas por `consulta.py`/`confirmacao_baixa.py` — **não aparecem no JSON** dos endpoints.
  - ℹ️ **Mudança interna, sem efeito no cliente** (v2-debits): a chave `boletos` foi removida do retorno de `listar_boletos_abertos` (função interna). O retorno atual é `{total, identificadores}` — e é exatamente esse shape que a v5 promoveu à borda como `apurar_boletos_abertos` (4.8).
  - ✅ **Verificado como acréscimo compatível** (v5): `salvar_configuracao` ganhou o parâmetro `decisao` com default `None`. **Cliente que não envia `decisao` continua funcionando** — só passa a receber `requer_decisao` quando há boleto em aberto, que antes não existia. Os dois endpoints novos (4.8, 4.9) são adição pura.
  - ⚠️ **A única mudança de comportamento observável para um cliente existente** é essa: uma `salvar_configuracao` que antes gravava direto agora pode ser recusada com `requer_decisao`. Não é quebra de shape (o campo `success` continua lá), mas **é** quebra de fluxo se a tela ignorar o novo campo — ela mostraria "erro ao salvar" sem oferecer saída.
- **Estratégia**: evolução aditiva — chaves novas podem ser acrescentadas; nenhuma é removida ou muda de tipo.
- **Próxima revisão deste handoff**: quando a faixa de tamanho do PFX (#2) for fechada, quando a pergunta de produto sobre a baixa de boleto sob conta antiga (#3) for respondida, ou se a lista enriquecida de boletos (#7) for pedida.

---

## 14. Prontidão para o plano de frontend (auditoria de 2026-07-22)

> Bloco novo. Serve para responder objetivamente: **dá para escrever o plano de frontend com o que está aqui?**

**Sim.** Não há dúvida bloqueante. As duas que bloqueavam (#1 e #6) foram fechadas com backend implementado e testado.

**O que está 100% especificado e pode ser implementado sem consultar ninguém:**

- Os 9 endpoints, com shape campo a campo, tipos e presença/ausência de cada chave.
- Todas as mensagens de erro literais, com a regra de discriminação por prefixo.
- O ciclo pendente → teste → ativação, incluindo o fato de não haver botão "Ativar".
- O fluxo de decisão RN-08 completo, com as duas armadilhas (sinônimo, decisão não lembrada).
- Os estados de UI, o mapeamento de erro e 15 fixtures verificadas contra o código.

**O que exige decisão de PRODUTO antes de virar tela (não de backend):**

1. ~~**Texto do diálogo de decisão** (#3).~~ ✅ **RESOLVIDO em 2026-07-22** — redigido como advertência; deck em [`plano-frontend.md`](plano-frontend.md) §14. A pergunta técnica de fundo **foi investigada** (§14.6): a baixa após a troca é inconsistente por construção e muito provavelmente falha. ⚠️ **Saiu daí um achado que é do backend, não da tela** — a conta emissora já está gravada em cada Cobrança (`emissao.py:377-378`) e não é usada. **Decisão de 2026-07-22: não corrigir agora**, com as razões e o gatilho de reabertura no §14.7 do plano.
2. **Profundidade da lista de boletos** (#7). Contagem resolve; lista nominal exigiria backend novo. Recomendação: começar pela contagem.

**O que é risco conhecido, não bloqueio:**

- Custo de `resumir_consolidado_boletos_abertos` não medido em produção (#9) — mitigável com UX de operação lenta.
- Faixa de tamanho do PFX é provisória (#2) — a tela não deve hard-codear a mensagem.
- Forma exata do corpo de 403/417 não validada em runtime — trate pelo status.
- Existe um pendente residual em produção; a tela abrirá em "em edição" na primeira carga.

**A coisa mais fácil de errar neste documento**, se você ler rápido: a colisão de mensagens do bloco 6. Três erros diferentes terminam com `"nenhuma alteracao foi feita."`, e um deles é um **cancelamento normal do usuário**. O teste #15 do bloco 10 existe só para travar isso.
