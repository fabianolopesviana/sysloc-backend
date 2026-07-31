# Levantamento do frontend Sysloc — insumo para o backend novo

> Produzido em 2026-07-30 por agente rodando **na máquina local do usuário**, sobre
> `/home/fibron/dev/projetos/react/sysloc` (branch `main`, commit `af37983`).
> Levantamento somente-leitura; nenhum arquivo do frontend foi alterado.
>
> **Por que este arquivo existe aqui**: o fonte do React não vive neste servidor. Este é o único
> registro do estado do frontend disponível ao backend, e é insumo direto da **F2** (contratos
> ts-rest), da **F3** e da **F6** inteira.

---

## 1. Stack e tamanho

| Item | Valor |
|---|---|
| Framework | React 19.2.6 |
| Toolchain | **Create React App** (`react-scripts` 5.0.1) — não é Vite nem Next |
| Linguagem | TypeScript 4.9.5, `strict: true`, target `es5` |
| Proxy de dev | `http://177.185.117.139:8200` |
| **Gerenciador de estado** | **Nenhum** — `useState`/`useContext` + Contexts caseiros |
| **Roteador** | **Nenhuma lib** — roteador caseiro sobre History API (`src/app/routes.tsx`, `providers.tsx`) |
| **Biblioteca de formulários** | **Nenhuma** — `useState` + validações manuais |
| UI | CSS próprio (21 arquivos, 4.764 linhas) + componentes internos |
| Ícones | `lucide-react`, centralizado em `shared/components/Icon.tsx` |
| Gráficos | `recharts` |
| PDF | `@react-pdf-viewer/*` (exibir), `pdf-lib` (montar), `@react-pdf/renderer` (relatório), `pdfjs-dist` |
| Toast | `react-toastify`, encapsulado em `shared/feedback/toast.ts` |
| Cripto | `node-forge` (lê certificado `.pfx` **no browser**, feature Sicoob) |

**Contagem**: 104 `.ts` + 89 `.tsx`; **25.566 LOC** totais — **16.380 de produção** (126 arquivos)
e **9.186 de teste** (67 arquivos). 26 rotas, 22 páginas, 108 componentes.

**Testes**: 391 casos em 67 arquivos co-localizados; 4 specs Playwright em `e2e/`.
`src/shared/api/apiEndpointContracts.test.ts` **trava 35 strings de endpoint ERPNext** — é o
inventário oficial do contrato de hoje e o primeiro arquivo que quebra na troca.

---

## 2. Inventário de chamadas ao backend

62 call-sites de `apiRequest`, 5 de `fetchResourcePages`, 3 de `fetch` cru.
**35 endpoints distintos.** Paths relativos à `baseUrl` (`/api/` por padrão).

### 2.1 Autenticação

| Tipo | Método | Path | Corpo / retorno | Origem |
|---|---|---|---|---|
| method | POST | `method/auth_locacao_imoveis` | `{usuario, senha}` → `{success, nome, usuario}` | `authService.ts:5` |
| method | POST | `method/locacao_automation.usuario_app.service.verificar_senha_usuario_app` | `{usuario, senha}` → `{message:{ok}}` | `usuarioService.ts:58` |

### 2.2 Usuários

| Método | Path | Detalhe |
|---|---|---|
| GET | `resource/Usuario` | `fields=["name","nome","usuario","modified"]`, `order_by=nome asc`, `limit=500` |
| POST | `resource/Usuario` | `{nome, usuario, senha}` |
| PUT | `resource/Usuario/{name}` | senha omitida se vazia |
| DELETE | `resource/Usuario/{name}` | — |

### 2.3 Imóveis

| Método | Path | Detalhe |
|---|---|---|
| GET | `method/all_imoveis` | **agregador** → `{conjuntos:[{conjunto_id, nome_conjunto, imoveis:[{…, comodos:[…]}]}]}`. Alimenta Imóveis, Dashboard, Relatório de Ocupação e o select de contrato |
| GET | `resource/Conjunto?fields=["name","nome_conjunto"]&order_by=nome_conjunto` | query **na string do path** |
| POST | `resource/Imovel` | trata `exc_type === 'UniqueValidationError'` em `identificador_municipal` |
| PUT | `resource/{doctype}/{name}` | **PUT universal** (`putDoctype`) — ver §2.11 |
| PUT | `method/atualizar_comodo` | `{imovel_name, comodo_name, nome_comodo, metragem, observacoes}` |

### 2.4 Conjuntos

`GET resource/Conjunto` · `POST resource/Conjunto` · `PUT` via `putDoctype`.

### 2.5 Contratos

| Método | Path | Detalhe |
|---|---|---|
| GET | `resource/Contrato` (paginado 500) | `CONTRATO_FIELDS` (12 campos, inclui `docstatus`), `order_by=creation desc` |
| GET | `resource/{Imovel\|Locador\|Locatario}` | **join manual N+1** (`mapByName`) para resolver rótulos |
| GET | `resource/{Imovel,Locador,Locatario,Fiador}` | selects do formulário; `filters=[["ativo","=",1]]` |
| POST | `resource/Contrato` | inclui `docstatus`, `gerar_cobrancas_automaticamente:0`, `fiadores:[{fiador}]` |
| GET | `resource/Contrato/{name}` | doc inteiro, **só para o submit** |
| POST | `method/frappe.client.submit` | `{doc: JSON.stringify(fullDoc)}` — **única menção literal ao core do Frappe** |
| GET | `resource/Contrato/{name}` | lê child table `fiadores` |
| GET | `resource/Fiador` | resolve nomes dos fiadores |
| POST | `method/locacao_automation.contrato_cancelamento.service.cancelar_contrato` | `{name}` |
| GET | `resource/Cobranca` | cobranças a vencer para o **carnê** — filtro complexo, refiltrado no cliente |
| GET | `resource/Cobranca` | detecção de duplicidade antes de gerar parcelas |
| POST | `resource/Cobranca` | parcelas manuais; corpo inclui `doctype:'Cobranca'` |
| POST | `method/locacao_automation.cobranca_sicoob.emissao.emitir_boleto_sicoob` | `{cobranca_id}` |
| GET (binário) | `method/locacao_automation.contrato_pdf.service.abrir_contrato?contrato={name}` | PDF do contrato |

### 2.6 Financeiro / Cobranças

| Método | Path | Detalhe |
|---|---|---|
| GET | `resource/Cobranca` (paginado) | `COBRANCA_FIELDS` — **26 campos**. Carga total; base de Financeiro, Recebíveis e Repasse |
| GET | `resource/Locatario` (chunks de 200) | **join manual** — nome/contato |
| GET | `resource/Contrato` (chunks) | join fatura → contrato |
| GET | `resource/Imovel` (chunks) | join contrato → imóvel |
| GET | `resource/Conjunto` (chunks) | join imóvel → conjunto |
| GET | `resource/Cobranca` (janela de datas) | KPIs do Dashboard; **sem** os joins |
| POST | `method/automacao_cobranca_config_api` | `{acao:'get'}` — **leitura e escrita no mesmo path**, discriminado por `acao` |
| POST | `method/automacao_cobranca_config_api` | `{acao:'save', ativo, a_vencer{…}, vencida{…}}` |
| POST | `method/locacao_automation.cobranca_automation.service.enviar_cobranca_email_manual` | `{fatura_id}` |
| GET | `resource/Log Envio Cobranca` (paginado) | **DocType com espaços no nome** |
| GET | `resource/Cobranca/{id}` | estado atual antes de regerar boleto |
| POST | `method/locacao_automation.cobranca_sicoob.baixa.solicitar_baixa_boleto_sicoob` | `{cobranca_id}` |
| PUT | `resource/Cobranca/{id}` | `{status_cobranca:'Cancelada'}` |
| POST | `resource/Cobranca` | cobrança substituta |
| PUT | `resource/Cobranca/{id}` | acusar pagamento — **zera 6 campos de conciliação bancária** |
| POST | `resource/Cobranca` | novo título (água/condomínio/energia/…) |
| GET (binário) | `method/locacao_automation.cobranca_boleto.service.abrir_boleto?cobranca={name}` | boleto e montagem do carnê |

### 2.7 Pessoas (Locatário / Locador / Fiador)

| Método | Path | Detalhe |
|---|---|---|
| GET | `resource/Locatario` | `LOCATARIO_FIELDS` — **33 campos**, inclui toda a máquina de validação de e-mail/WhatsApp |
| POST | `resource/Locatario` | 33 chaves snake_case |
| GET | `resource/Locatario` | resolve o `name` do recém-criado (o POST nem sempre devolve utilizável) |
| POST | `method/locacao_automation.locatario_email_confirmacao.service.enviar_confirmacao_email_locatario` | `{locatario}` |
| GET/POST | `resource/Locador` | 15 campos |
| GET/POST | `resource/Fiador` | 15 campos — ⚠️ **sem `limit_page_length`**, usa o default do Frappe (20) |
| PUT | `resource/{Fiador\|Locatario\|Locador}/{name}` | via `putDoctype`, corpo cru montado na página |
| PUT | `resource/Locatario/{name}` | **reset da máquina de e-mail: 9 colunas escritas pelo frontend** |

### 2.8 Configuração de atraso

`GET`/`PUT resource/Atraso/Atraso` → `{multa, juros}`. **Single DocType** (nome do doc = nome do
DocType) — no backend novo vira tabela com uma linha **por empresa**.

### 2.9 Integração Sicoob

Base: `method/locacao_automation.integracao_bancaria_api.service`

| Método | Sufixo | Detalhe |
|---|---|---|
| GET | `.obter_configuracao` | → `{success, configuracao{12 chaves}, certificado{8 chaves}, pendente?}` |
| POST | `.salvar_configuracao` | payload **parcial**; retorno union: `sucesso`/`requer_decisao`/`cancelamento`/`erro` |
| POST | `.enviar_certificado` | `{arquivo_base64, senha, nome_arquivo?}` |
| POST | `.testar_conexao` | round-trip real; em sucesso **o backend ativa a config** |
| POST | `.remover_certificado` | — |
| GET | `.apurar_boletos_abertos` | `{total, identificadores[]}` — sem envelope `success` |
| GET | `.resumir_consolidado_boletos_abertos` | `{total, disponiveis[], ausentes[]}` — operação cara |
| GET | `.verificar_saude_integracao` | 403 → `sem_permissao` |
| GET (binário) | `.baixar_consolidado_boletos_abertos` | falha discriminada por **status HTTP**, sem envelope |

### 2.10 Externo

`GET https://viacep.com.br/ws/{cep}/json/` — autocompletar endereço. **Não afetado pela migração.**

### 2.11 Chamadas montadas dinamicamente

Três lugares constroem a URL em runtime — invisíveis a um `grep` por endpoint literal:

```ts
// shared/api/resourcePagination.ts:15 — paginação genérica sobre qualquer DocType
apiRequest(`resource/${resource}`, { query: {…, limit_page_length, limit_start} })

// features/imoveis/services/imovelService.ts:161 — PUT universal
putDoctype(doctype, name, body)   // chamado com 'Conjunto'|'Imovel'|'Fiador'|'Locatario'|'Locador'

// features/contratos/services/contratoService.ts:72 — resolução de rótulos
mapByName(resource, labelField, ids)
```

---

## 3. Camada de acesso a dados

| Arquivo | LOC | Papel |
|---|---|---|
| `shared/api/httpClient.ts` | 116 | **Único cliente HTTP.** Injeta baseUrl, `Authorization`, timeout 30 s, `credentials:'omit'` |
| `shared/api/apiConfig.ts` | 37 | Lê env, junta base+path |
| `shared/api/apiTypes.ts` | 27 | `HttpMethod`, `ApiRequestOptions`, `ApiError` |
| `shared/api/apiResponse.ts` | 37 | Desembrulha envelopes Frappe (`{data}`, `{message}`) |
| `shared/api/resourcePagination.ts` | 29 | Loop `limit_start`/`limit_page_length` |
| `shared/pdf/pdfEndpoints.ts` | 89 | `fetch` cru para binários + URL autenticada |
| `shared/types/modelHelpers.ts` | 64 | `toInt`/`toDouble`/`isTruthy`/`parseDate` — coerção porque o Frappe devolve tipos frouxos |

**Arquitetura respeitada**: nenhum componente chama `fetch` ou `apiRequest` direto. A cadeia é
`componente → hook use{X}Commands → {entidade}Service → apiRequest → fetch`. 11 services.
**Sem cache, sem deduplicação, sem invalidação** — cada tela refaz a carga inteira. Duas telas
fazem **polling de 30 s** (Dashboard e Financeiro), desligável por `REACT_APP_AUTO_SYNC_ENABLED`.

### Mapeadores snake_case → camelCase

**~36 no total**: ~21 de leitura (`toXItem`, `mapX`) nos services, ~15 de escrita
(`toXRequestJson`) nos `types/`. Convenção: tipos de payload cru levam sufixo `Json`.

**Com a API nova falando camelCase, todos os 36 são deletados.**

Dois casos que não são só tradução de nome:

- `toFinanceiroFaturaItem` (`financeiroService.ts:160`) recebe **4 mapas de join** montados no
  cliente e deriva `status` localmente (`normalizeStatus`) — o backend não devolve status.
- `toCobrancaContratoManualPayload` (`contratoTypes.ts:324`) **valida pagamento, decide
  `status_cobranca`, zera 9 campos de conciliação e injeta `doctype:'Cobranca'`**. É regra de
  negócio no mapeador — vai para o servidor.

---

## 4. Vazamento do Frappe fora da camada de dados

`__islocal` e `amended_from`: **zero ocorrências**. Os demais aparecem em **15 arquivos** que
deveriam estar limpos.

### 4.1 Tipos de domínio (6 arquivos)

| Arquivo | O que vaza |
|---|---|
| `contratos/types/contratoTypes.ts` | `docstatus` em `ContratoRequest`, `ContratoDataResponse` e **`ContratoListItem`** (o item que a UI inteira consome); `idx` em `ContratoFiadorResponse`; `contratoStatusFromDocstatus()` mapeando `0→Rascunho, 1→Ativo, 2→Cancelado` — **regra de negócio sobre o ciclo de vida de documento do Frappe** |
| `imoveis/types/imoveisTypes.ts` | `ImovelData` com `owner`, `creation`, `modified`, `modifiedBy`, `docstatus`, `idx`, `doctype`. **`ComodoResponse` reproduz o modelo de child table inteiro**: `parent`, `parentfield`, `parenttype`, `unsaved` |
| `locador/`, `locatario/`, `fiador/`, `conjunto/` types | os mesmos 7 metadados em `*Data` |

### 4.2 Hooks (4 arquivos)

- `usePessoasCommands.ts` — **`doctype`, `nameBodyKey`, `typeBodyKey` viraram config de UI**, ao
  lado de `title` e `emptyMessage`. Literais `'Fiador'`/`'nome_fiador'`, `'Locatario'`/
  `'locatario_nome'`, `'Locador'`/`'locador_nome'`. E o reset de e-mail escrevendo **9 colunas**.
- `useConjuntosCommands.ts`, `useImoveisCommands.ts` — `putDoctype('X', …)`.
- `useContratosCommands.ts` — `export type JsonPatch = JsonMap`.

### 4.3 Páginas (4 arquivos)

- `HomeContratosPage.tsx:373` — envia `docstatus: 0`; `:561` — **simula `docstatus: 2` no estado
  local** após cancelar.
- `HomeImoveisPage.tsx` — monta corpo cru; `openField(…, 'nomeImovel', 'nome_imovel')` passa o par
  (campo de domínio, coluna Frappe) **como argumento de JSX**.
- `HomePessoasPage.tsx` — idem, com `documento_principal` literal.
- `IntegracaoSicoobPage.tsx:190` — lê chaves snake_case cruas de `campos_divergentes`.

### 4.4 Lógica de negócio

`relatoriosService.ts:115` — a classificação da carteira (`ativo`/`vencendo`/`encerrado`)
**depende de `docstatus`**.

### 4.5 `name` como chave primária — vazamento estrutural

O app usa `name` (ID textual do Frappe) como chave de domínio em **11 interfaces**, e o
**exibe ao usuário**:

- `HomeContratosPage.tsx:287,574` — `<strong>{contrato.name}</strong>` é o **título do contrato**
- `HomeFinanceiroPage.tsx:539` — `<option value={contrato.name}>{contrato.name}</option>` é a
  **label do select**
- `HomePessoasPage.tsx:468` — exibido como campo **"Identificador"**
- Busca textual em Usuários e Conjuntos **inclui o `name`**

> **Esta é a decisão de contrato de API mais impactante do projeto.** Com IDs textuais legíveis
> preservados (`CTR-2026-0001`), o custo é quase zero — só renomear `name` → `id`. Com UUID, as
> telas precisam de um campo de exibição novo. **Decisão tomada: preservar IDs legíveis.**

### 4.6 Comportamento (não só campos)

1. **Ciclo draft/submit/cancel** — `contratoStatusFromDocstatus` consumido por Dashboard,
   Carteira e Contratos.
2. **Envelope `{data}`/`{message}`** — isolado em `apiResponse.ts`, mas lido direto em
   `contratoService.ts:153` e `financeiroService.ts:334`.
3. **`_server_messages`** — parser do erro do Frappe (JSON dentro de JSON dentro de string) em
   `httpClient.ts:30-46`.

---

## 5. Autenticação e configuração

**Duas autenticações independentes que não se falam** — o achado mais importante do levantamento.

**(a) Transporte, para o Frappe**: token estático `Authorization: token ${apiKey}:${apiSecret}`,
**igual para todos os usuários**, embutido no bundle. `credentials:'omit'` deliberado
(comentário no código cita ADR-0008 e o CSRF do Frappe).

**(b) Aplicação, para o usuário**: `POST method/auth_locacao_imoveis` retorna
`{success, nome, usuario}` — **sem token, sem sessão**. O que persiste é só o username:

```ts
// sessionStorageService.ts — localStorage['usuario']
// authRepository.ts:4
export async function isSignedIn(): Promise<boolean> { return getInfoUser() !== null; }
```

> **Consequência para o backend novo**: o backend **não sabe qual usuário está agindo**. Todas as
> escritas chegam com a mesma credencial de serviço. JWT/sessão por usuário muda isso
> estruturalmente — mas exige o fluxo de token/refresh que **hoje não existe em lugar nenhum** do
> frontend.

### Variáveis de ambiente

| Variável | Papel | Default |
|---|---|---|
| `REACT_APP_BACKEND_BASE_URL` | base da API | `/api/` |
| `REACT_APP_ERPNEXT_API_KEY` | **exposta no bundle** | `''` |
| `REACT_APP_ERPNEXT_API_SECRET` | **exposta no bundle** | `''` |
| `REACT_APP_AUTO_SYNC_ENABLED` | polling de 30 s; **opt-out** (`!== 'false'`) | ligado |
| `GENERATE_SOURCEMAP` | `false` em produção | — |

O `.env.example` do projeto já documenta o risco: *"toda variável `REACT_APP_*` é embutida em
TEXTO CLARO no bundle público… O sufixo `_SECRET` não a torna secreta."*

### Controle de acesso no frontend

Três mecanismos, **todos client-side**: whitelist de rotas públicas (`App.tsx`), reconfirmação de
senha para `/usuarios` (gravada em `sessionStorage`), e um único caso de permissão do backend
refletida na UI (403 → `sem_permissao` na saúde do Sicoob).

**Não existe** modelo de papéis, renderização condicional por permissão, nem escopo de dados por
usuário. A autorização real é a do usuário de serviço.

---

## 6. Modelo de domínio (como o frontend enxerga)

> **É este o modelo que a API nova deve falar** (estratégia C). Os ~36 mapeadores existem para
> produzi-lo a partir do formato Frappe; com a API devolvendo-o direto, eles somem.

### Contrato

```ts
interface ContratoListItem {
  name: string;                       // ← ID (preservar formato legível)
  imovel?: string | null;  imovelNome?: string | null;      // resolvido por join no cliente
  locador?: string | null; locadorNome?: string | null;
  locatario?: string | null; locatarioNome?: string | null;
  dataInicioLocacao?: string | null;  // "YYYY-MM-DD"
  dataFimLocacao?: string | null;
  prazoMeses?: number | null;
  valorMensal?: number | null;
  valorTotalContrato?: number | null;
  statusContrato?: string | null;
  diaVencimento?: number | null;
  docstatus: number;                  // ← vazamento; sai no backend novo
}
```

### Cobrança / Fatura — o modelo mais rico

```ts
interface FinanceiroFaturaItem {
  id: string;                    // = Cobranca.name
  contratoId: string;  contratoLabel: string;
  locatarioNome: string;  email?: string|null;  telefone?: string|null;
  emailVerificado: boolean;  whatsappVerificado: boolean;
  imovelNome: string;            // via join contrato→imóvel
  conjuntoNome: string;          // via join imóvel→conjunto
  referencia: string;            // "MM/AAAA" ou rótulo livre
  vencimento: Date;
  valor: number;                 // valor_total, ou soma original+juros+multa
  valorPago: number;  dataPagamento?: Date|null;
  // conciliação bancária
  dataHoraPagamentoBanco?: Date|null;  valorPagamentoBanco?: number|null;
  linhaDigitavel?: string|null;  codigoBarras?: string|null;
  nossoNumero?: string|null;  seuNumero?: string|null;
  dataEmissaoBoleto?: Date|null;  situacaoBoletoSicoob?: string|null;
  numeroIdentificadorBaixa?: string|null;
  codigoBancoRecebedor?: string|null;  codigoAgenciaRecebedora?: string|null;
  conciliadoEm?: Date|null;
  status: string;                // ← DERIVADO no cliente hoje; vai para o servidor
  ultimoEnvioEmail?: Date|null;  ultimoEnvioWhatsapp?: Date|null;
}
```

### Imóvel, Cômodo, Conjunto

```ts
interface ImovelGeralItem {
  comodos: Comodos[];  name: string;
  conjunto: string;  nomeConjunto: string;
  nomeImovel: string;  identificadorMunicipal: string;   // único (constraint)
  tipoImovel: string;
  logradouro: string; numero: string; complemento?: string|null;
  bairro: string; cidade: string; estado: string; cep: string;
  metragemTotal: number;  statusLocacao: string;
  contratoAtivo?: string|null;  observacoes?: string|null;
}
interface Comodos { name?: string|null; nomeComodo: string; metragem: number; observacoes?: string|null; }
interface Conjuntos { conjuntoId: string; nomeConjunto: string; imoveis: ImovelGeralItem[]; }
```

### Pessoas — o frontend já as unifica

```ts
interface PessoaItem {
  name: string;  nome: string;               // ← locatario_nome | locador_nome | nome_fiador
  tipo: 'Pessoa Física' | 'Pessoa Jurídica';
  documentoPrincipal: string;                // CPF/CNPJ, só dígitos
  rg?: string|null;  email?: string|null;  telefone?: string|null;
  logradouro?: string|null; numero?: string|null; complemento?: string|null;
  bairro?: string|null; cidade?: string|null; estado?: string|null; cep?: string|null;
  ativo: number;                             // 0|1 — não é boolean hoje
}
```

Locatário tem **17 campos extras** de validação de e-mail/WhatsApp: `emailVerificado`,
`emailStatusValidacao`, `emailTokenHash`, `emailTokenGeradoEm`, `emailTokenUsadoEm`,
`emailConfirmadoIp`, `emailConfirmadoUserAgent`, `emailReenvios`, `whatsappVerificado`,
`whatsappStatusValidacao`, `whatsappNumeroE164`, `whatsappUltimaMensagemId`,
`whatsappUltimaTentativaEm`, `whatsappUltimoRetorno`, `whatsappReenvios`, `whatsappUltimoStatus`,
`whatsappUltimoStatusEm`.

### Demais

```ts
interface UsuarioItem { name: string; nome: string; usuario: string; modified?: string|null; }
interface AtrasoConfig { multa: number; juros: number; }              // Single → por empresa
interface FinanceiroAutomacaoConfig {
  naoEnviarAVencer: boolean; diasAntesVencimento: number; intervaloDiasAVencer: number;
  horarioAVencer: string; canalAVencer: string;
  intervaloDiasVencida: number; horarioVencida: string; canalVencida: string;
}
interface FinanceiroLogEnvioItem {
  faturaId: string; locatarioNome: string; canal: string; tipoEnvio: string;
  status: string; erro?: string|null; requestId?: string|null; dataEnvio: Date;
}
interface ConfiguracaoConta {
  name: string; provedor: string; ativo: number; ambiente: string;
  authUrl: string; apiBaseUrl: string; clientId: string; scope: string;
  numeroCliente: number|null; numeroContaCorrente: number|null;
  codigoModalidade: number|null; parametrosProvedor: string;
}
interface CertificadoInfo {
  presente: boolean; titular: string|null; documento: string|null; emissor: string|null;
  validoDe: Date|null; validoAte: Date|null; diasParaVencer: number|null;
  origem: 'upload'|'legado'|null;
}
```

### Relacionamentos

```
Conjunto (1) ──< (N) Imovel ──< (N) Comodo            [child table]
                     └──(0..1) contratoAtivo → Contrato
Contrato (N) ──> (1) Imovel · (1) Locador · (1) Locatario
         (1) ──< (N) ContratoFiador ──> (1) Fiador     [child table com idx]
         (1) ──< (N) Cobranca
Cobranca (N) ──> (1) Contrato  E  (N) ──> (1) Locatario   ⚠️ FK dupla, redundante
         (1) ──< (N) Log Envio Cobranca                [por fatura_id, sem FK real]
Atraso · Automação de cobrança  → Single global (viram por-empresa)
ConfiguracaoConta               → 1 ativa + 0..1 pendente
Usuario                         → isolado (morre; vira better-auth)
```

> ⚠️ **`Cobranca` aponta para `contrato` E para `locatario`.** O join do cliente usa o `contrato`
> para chegar ao imóvel/conjunto e o `locatario` da cobrança para nome/contato — se divergirem, a
> tela mostra dados inconsistentes. **Resolver no servidor.**

### Enums e status

| Domínio | Valores |
|---|---|
| Status de contrato (domínio) | `rascunho`, `ativo`, `encerrado`, `rescindido`, `cancelado`, `desconhecido` |
| Status de contrato (raw) | `'Rascunho'`, `'Ativo'`, `'Encerrado'`, `'Rescindido'`, `'Cancelado'` |
| Status de contrato (via docstatus) | `0→Rascunho`, `1→Ativo`, `2→Cancelado` |
| Status de cobrança (UI, derivado) | `'Paga'`, `'Vencida'`, `'A vencer'`, `'Cancelada'` |
| Status de cobrança (raw) | `'Paga'`, `'Vencida'`, `'Cancelada'`, `'Pendente'` |
| Status de locação do imóvel | `'Disponível'`, `'Locado'`, `'Indisponível'` |
| Ocupação (relatório) | `'locado'`, `'vago'` |
| Classificação de carteira | `'ativo'`, `'vencendo'` (≤30 dias), `'encerrado'` |
| Tipo de pessoa | `'Pessoa Física'`, `'Pessoa Jurídica'` |
| Tipo de imóvel | `'Residencial'`, `'Comercial'`, `'Misto'` (hard-coded no frontend) |
| Referência de novo título | Água, Condomínio, Energia elétrica, Esgoto, Limpeza, Manutenção, Outras cobranças |
| Canal de envio | `'email'`, `'whatsapp'`; config aceita `'ambos'` |
| Tipo de envio (log) | `'automacao'`, `'lote'`, `'manual'` |
| Status de log de envio | `'Sucesso'`, `'Erro'` |
| Faixas de aging | `1–30`, `31–60`, `61–90`, `90+` dias |
| Sicoob — símbolo de erro | `requer_decisao`, `cancelado_pelo_gestor`, `certificado_ilegivel`, `sem_config_ativa`, `campo_invalido`, `certificado_invalido`, `decisao_invalida`, `sem_certificado_proprio`, `desconhecido` |
| Sicoob — decisão de troca | `'aceitar'`, `'nao_aceitar'`, `'aceitar_com_consolidado'` |
| Sicoob — saúde | `saudavel`, `erro_sicoob`, `indisponivel`, `sem_permissao` |

---

## 7. Avaliação de custo da troca

### 7.1 Arquivos que mudam

**~24 de religação mecânica + ~12 de refatoração de vazamento** (≈29% dos 126 de produção),
**+ 67 arquivos de teste com fixtures novas**.

| Bloco | Arquivos | Natureza |
|---|---|---|
| Cliente HTTP | 6 | trocar auth (token → sessão), remover parser `_server_messages`, remover helpers de envelope, trocar paginação |
| Services | 11 | trocar paths; **remover mapeadores**; remover joins manuais |
| Tipos de payload cru | 9 | **deletados** — `*RequestJson` e `to*RequestJson` deixam de existir |
| Vazamento | 12 | ver §4 |

**Trabalho que some (ganho, não custo)**: os ~36 mapeadores; `mapByName` e `fetchByIds`
(**5 a 9 round-trips por carregamento da tela Financeiro**); `fetchResourcePages`;
`normalizeStatus`, `contratoStatusFromDocstatus`, `parseLocalDate`, `isTruthy`, `toInt`/`toDouble`.

### 7.2 Fluxos que precisam ser repensados, não religados

1. **Criação de contrato** — hoje: `POST` rascunho → `GET` doc inteiro → `frappe.client.submit` →
   verificar `docstatus === 1`. **Três requisições** para o que é um `POST /contratos`.
2. **Status de contrato** — dupla fonte (`status_contrato` + fallback `docstatus`), consumida por
   4 telas.
3. **Financeiro + Recebíveis + Repasse** — joins no cliente; `status` derivado localmente.
4. **Fluxos de boleto — transações distribuídas na UI**: `regerarBoleto` encadeia **6 chamadas sem
   transação**; `cancelarCobrancaComBaixa` **engole deliberadamente** o erro da baixa;
   `acusarPagamentoCobranca` devolve `{baixaSolicitada, baixaErro}` para a tela decidir. **Se um
   passo falhar, ninguém faz rollback.**
5. **Autenticação inteira** — não há token de usuário (§5).
6. **Edição campo-a-campo** via `putDoctype` com objeto de uma chave; as páginas conhecem os nomes
   das colunas.
7. **Reset de validação de e-mail** — um hook React escreve 9 colunas do banco. **Operação de
   domínio implementada na UI** → `POST /locatarios/:id/email`.
8. **Config de automação** — um endpoint faz leitura e escrita por `{acao}` → `GET`/`PUT`.
9. **`Atraso/Atraso`** Single → `GET`/`PUT /config/atraso` por empresa.
10. **Sicoob** — 9 endpoints RPC; `classificarErro` discrimina o tipo **pelo prefixo do texto da
    mensagem** e `extrairCampoInvalido` usa regex sobre `"O campo 'X'"`. **A API nova deve devolver
    códigos de erro estruturados.**

### 7.3 Existe algo impossível de adaptar?

**Não.** Nenhum SDK Frappe, nenhum `frappe.ui`, nenhum socket do Desk, nenhum iframe, nenhuma
dependência de runtime Frappe no `package.json`. A única menção literal ao core é uma linha:
`contratoService.ts:149 → 'method/frappe.client.submit'`.

Cinco acoplamentos de forma, em ordem de custo:

| # | Acoplamento | Custo |
|---|---|---|
| 1 | **`name` como chave e como rótulo exibido** | **Alto se o formato do ID mudar** · quase zero com IDs legíveis preservados |
| 2 | `docstatus` como fonte de status | Médio — 1 função + 4 telas |
| 3 | `frappe.client.submit` | Médio — redesenho de 1 fluxo |
| 4 | Envelope `{data}`/`{message}` e `_server_messages` | Baixo — isolado |
| 5 | Query DSL (`fields=[…]`, `filters=[[…]]`, `limit_start`) | Baixo/médio — some com os services |

### 7.4 Conclusão do relatório

> A arquitetura em camadas foi respeitada no essencial — nenhum componente chama `fetch` direto, e
> ~36 mapeadores fazem a tradução. **Isso torna a troca viável.** O que encarece são os 15 arquivos
> onde a disciplina vazou e os 10 fluxos desenhados *em torno* das limitações do Frappe.
>
> **O maior risco não é técnico — é decidir o contrato da nova API antes de escrever qualquer
> linha**, porque cada decisão (formato de ID, quem calcula `status`, quem faz os joins, transações
> de boleto) redefine quais arquivos mudam e quanto.
