# QA Context — cobranca-e-mora/v1 (variante `backend`)

> Extrato condensado do `tech_spec.md` para alimentar subagentes `agent-spec-qa-test-generator`.
> Gerado pela `agent-spec-sdd-generate-task-plan`. **Não é fonte canônica** — em divergência,
> vale `docs/specs/features/cobranca-e-mora/v1/tech_spec.md`.

## Componentes (camada · responsabilidade)

| Componente | Camada | Responsabilidade |
|---|---|---|
| `negocio.cobranca` (tabela) | Banco | Só **fatos** (`data_vencimento`, `pago_em`, `cancelado_em`, `valor_original`) e **carimbos** do pagamento. Sem coluna `status`, sem mora em aberto, sem `locatario_id` |
| `negocio.configuracao_de_mora` (tabela) | Banco | Política de multa e juros de **uma** empresa; uma linha por empresa (`unique(empresa_id)`) |
| `negocio.cobranca_derivada` (view, `security_invoker = true`) | Banco | **Fonte única** de `status`, `dias_atraso`, `valor_multa`, `valor_juros`, `valor_total`, `contrato_codigo` e `locatario_id` |
| `negocio.data_corrente_da_operacao()` | Banco | `STABLE`, `(now() AT TIME ZONE 'America/Sao_Paulo')::date` — ponto único da data corrente |
| `garantir_contador_de_cobranca()` · `proximo_numero_de_cobranca()` | Banco | Série `(empresa, ano)`, `SECURITY DEFINER`, sem parâmetro de empresa, fora do desfazimento |
| `packages/db/src/cobranca.ts` | Dados | Porta: cria, lista pela view, localiza, acusa pagamento, cancela, cancela em cascata |
| `packages/db/src/configuracao-de-mora.ts` | Dados | Porta da configuração de mora (upsert `ON CONFLICT (empresa_id)`) |
| `packages/db/src/derivacao-de-cobranca.ts` | Dados (puro) | `derivarParcelasDoContrato` — competência, vencimento, referência, valor |
| `packages/contracts/src/cobranca.ts` | Contrato | Enums, formato `COB-{ano}-{7 dígitos}`, corpos e recurso publicado |
| `packages/contracts/src/configuracao-de-mora.ts` | Contrato | Esquema da política de multa e juros |
| `apps/api/src/cobrancas/*` | Aplicação/Apresentação | 5 rotas `/v1/cobrancas` sob `TELA:financeiro` |
| `apps/api/src/mora/*` | Aplicação/Apresentação | 2 rotas `/v1/multa-e-juros` sob `TELA:multa_e_juros` |
| `apps/api/src/contratos/contrato.service.ts` (mod.) | Aplicação | Ativação gera parcelas; cancelamento cancela em cascata |

## Fluxos técnicos

- **A** `PUT /v1/multa-e-juros` → `validar` → `sobContextoDaSessao` → upsert por `empresa_id`. Nenhuma cobrança é reescrita.
- **B** `POST /v1/contratos/:codigo/ativacao` → **1ª unidade** garante o contador da cobrança e **commita**; **2ª unidade** (um commit) confere estado, deriva término/valor, transiciona, ocupa o imóvel, deriva N parcelas, emite N números, insere N linhas.
- **C** `GET /v1/cobrancas` → `SELECT … FROM negocio.cobranca_derivada … ORDER BY data_vencimento, codigo LIMIT/OFFSET`; filtro por `status` é predicado SQL sobre coluna derivada.
- **D** `POST /v1/cobrancas/:codigo/pagamento` → lê a **view** → `exigirEstado(A_VENCER|VENCIDA)` → grava `pago_em`, `valor_pago` e os **4 carimbos** na mesma instrução. Não toca conciliação bancária.
- **E** `POST /v1/cobrancas/:codigo/cancelamento` → `exigirEstado(A_VENCER|VENCIDA)` → `cancelado_em = now()`; registro segue legível, substituta é `POST` comum.
- **F** `POST /v1/cobrancas` → **1ª unidade** garante o contador e commita; **2ª** localiza contrato (404/422), consome número, grava. `locatarioId` derivado, nunca gravado.

## Critérios de aceite (PRD)

| CA | Regra em uma linha |
|---|---|
| CA-01 | Régua capturada com a divergência de estado, sem enviar mensagem a ninguém |
| CA-02 | Ativar contrato de N meses gera N parcelas iguais às do legado |
| CA-03 | Ativação recusada não deixa parcela |
| CA-04 | Estado idêntico em qualquer caminho de leitura |
| CA-05 | Consta vencida sem rotina ter rodado |
| CA-06 | Cobrança de água distinguível pela **natureza**, sem interpretar texto |
| CA-07 | Acusar pagamento registra valor e data |
| CA-08 | Multa alterada não move a cobrança já paga |
| CA-09 | Cancelar preserva o histórico e libera substituta |
| CA-10 | Nenhuma operação faz a cobrança deixar de existir |
| CA-11 | Cada empresa apura pela própria configuração |
| CA-12 | Mora coincide com o golden centavo a centavo |
| CA-13 | 60 dias dobram os juros; a multa é a mesma |
| CA-14 | Cobrança em aberto reflete a política nova |
| CA-15 | Cancelar contrato cancela só as canceláveis |
| CA-16 | Pagamento não apaga a conciliação bancária |
| CA-17 | Sem alcance à área, a operação é recusada e nada muda |

## Mapa CA → CT (39 casos, `_run/test-cases.json`)

`CA-01 → CT-501,502,503` · `CA-02 → CT-504..508,535,536,537` · `CA-03 → CT-509` ·
`CA-04 → CT-510,511,527` · `CA-05 → CT-512,513` · `CA-06 → CT-514,515,537` ·
`CA-07 → CT-516,517` · `CA-08 → CT-518` · `CA-09 → CT-519,520,535,536` ·
`CA-10 → CT-517,519,520,521,530` · `CA-11 → CT-522,523,524,538,539` · `CA-12 → CT-525,526,527` ·
`CA-13 → CT-528` · `CA-14 → CT-529` · `CA-15 → CT-530,531` · `CA-16 → CT-532` · `CA-17 → CT-533,534`

## Validações de entrada (§6.1 do tech spec)

- `contratoCodigo` canônico `CTR-\d{4}-\d{5}` (importado, nunca redigitado) → `422 CAMPO_INVALIDO`
- `codigo` da cobrança canônico `COB-\d{4}-\d{7}` (caminho da rota)
- `natureza` ∈ `{ALUGUEL, AGUA, CONDOMINIO, ENERGIA, OUTRO}`
- `referencia` não vazia, ≤ `MAIOR_TEXTO_CURTO` (200)
- `competencia` é o **1º dia do mês**
- `valorOriginal`/`valorPago` `> 0`, ≤ `MAIOR_VALOR_MONETARIO`, múltiplo de `ESCALA_MONETARIA`
- `multaPercentual`/`jurosPercentual` em `[0, 100]`, escala `0.01`
- `strictObject` em todo corpo; nenhum corpo parcial em nenhuma rota
- Campos ausentes do corpo por decisão: `codigo`, `locatarioId`, `status`, `diasAtraso`, `valorMulta`, `valorJuros`, `valorTotal`, `pagoEm`, `valorPago`, `canceladoEm`, os 4 carimbos, os 6 de conciliação e `empresaId`

## Regras de domínio críticas

- **RD-04** precedência `CANCELADA → PAGA → VENCIDA → A_VENCER`; `VENCIDA` é `data_vencimento < data_corrente` (fronteira **estrita**, decisão desta fatia, não porte)
- **RD-07** `multa = round(vo × m/100, 2)`; `juros = round(vo × (j/100) / 30 × dias, 2)`; `total = round(vo + multa + juros, 2)`; juros simples, mês comercial de 30, **não** incidem sobre a multa; `ROUND_HALF_UP`
- **RD-08/RD-21** empresa sem configuração apura **zero** (`LEFT JOIN` + `COALESCE`) e **lê** `{0, 0}` com `200`, sem criar linha
- **RD-19** início de período **iterativo com saturação**: `inicio[i] = addMeses(inicio[i-1], 1)` — `31/01`, `28/02`, **`28/03`**
- **RD-16** toda aritmética monetária em `numeric`; nenhum valor derivado passa por ponto flutuante

## Paths relevantes

`packages/db/migracoes/{0009_dominio_cobranca.sql,0010_seguranca_cobranca.sql}` ·
`packages/db/src/{cobranca.ts,configuracao-de-mora.ts,derivacao-de-cobranca.ts,esquema/negocio.ts,index.ts}` ·
`packages/contracts/src/{cobranca.ts,configuracao-de-mora.ts,contrato.ts,index.ts}` ·
`apps/api/src/{cobrancas,mora}/*` · `apps/api/src/contratos/{contrato.service.ts,contrato.controller.ts}` ·
`deploy/scripts/caracterizacao/{capturar.py,verificar-captura.sh,verificar-golden.sh}` ·
`docs/specs/features/caracterizacao-regras-legadas/v1/golden/{regua-de-cobranca.json,calcular-mora.json,contrato-ativacao.json}`

## Suítes existentes (molde e alvo de modificação)

`packages/db/test/{isolamento,catalogo,coerencia-de-migracoes,contrato,derivacao-de-contrato,janela}.spec.ts` ·
`packages/contracts/test/{esquemas,folha}.spec.ts` ·
`apps/api/test/{contratos,cobertura-de-autorizacao,autorizacao-do-dominio}.e2e.spec.ts`

Padrão: Vitest + `embedded-postgres` (instância efêmera própria); E2E em Vitest sobre HTTP real em
porta dinâmica; verificadores em `bash` com `caso`/`ok`/`falhar`/`afirmar_igual`. **Mock é evitado por
decisão de projeto.** Mutante roda sempre por `pnpm --filter @sysloc/<pacote> test`.
