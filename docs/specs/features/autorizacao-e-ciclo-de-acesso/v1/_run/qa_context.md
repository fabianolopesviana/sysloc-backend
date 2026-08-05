# Contexto de QA — autorizacao-e-ciclo-de-acesso/v1

> Extrato denso do `tech_spec.md` para consumo por gates e por invocações de QA que precisem de contexto sem reler a spec inteira. A fonte lossless dos casos é `_run/test-cases.json`.

## Stack de teste

Vitest. **Unitário** com asserção nativa; **integração** com `embedded-postgres` (instância efêmera própria, ADR-0006); **E2E** exercitando HTTP real em porta dinâmica. **Mock evitado por decisão** — 30 dos 36 casos atravessam banco ou HTTP real. Arquivos em `test/` por pacote, `*.spec.ts` e `*.e2e.spec.ts`. Rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção INVARIANTES por arquivo.

**Invocação de mutante**: sempre `pnpm --filter @sysloc/<pacote> test`, **nunca** `vitest run` avulso — o pacote resolve pela fronteira e o mutante não alcançaria o que executa.

## Componentes

| Componente | Pacote | Papel |
|---|---|---|
| `catalogo-de-permissoes` | `@sysloc/auth` | 17 chaves + mapa ação→tela |
| `matriz-de-perfil` | `@sysloc/auth` | default por perfil (Master = vazio) |
| `efetivo` | `@sysloc/auth` | `(perfil ∪ concedidas) − negadas`, negação vence |
| `autorizacao` | `@sysloc/auth` | decisão consultada pela guarda |
| `onboarding` | `@sysloc/auth` | Senha provisória e criação de pessoa |
| `permissao` | `@sysloc/db` | ajustes sob contexto de tenant + contador |
| `ContextoGuard` | `apps/api` | ponto de aplicação único |
| `exigencia.decorator` | `apps/api` | metadado nas duas dimensões |
| `cobertura-de-autorizacao` | `apps/api` | consulta o roteador montado |
| `MasterModule` / `UsuariosModule` / `SenhaController` | `apps/api` | superfície |

## Fluxo que toda rota atravessa

1. metadado de exigência (ausente → `403`) → 2. sessão (ausente → `401`) → 3. leitura de identidade com `versao_permissoes` → 4. versão diverge? relê e **reescreve** o registro de sessão → 5. sessão restrita → 6. decisão de autorização (`403` com `detalhes.exigido`) → 7. `SET LOCAL` e prossegue.

> Rota pública **retorna antes** do passo 1 — `@RotaPublica()` é a declaração dela.

## Rastreabilidade CA → CT → Task

| CA | Descrição | CTs | Tasks |
|---|---|---|---|
| CA-01 | Empresa admitida sem intervenção manual | 221 | T7 |
| CA-02 | Senha provisória exibida uma única vez | 222 | T8 |
| CA-03 | Reemissão invalida a anterior | 223 | T7 |
| CA-04 | Suspensão encerra sessões na hora | 224 | T7 |
| CA-05 | Reativação não devolve sessões | 225 | T7 |
| CA-06 | Listagem sem dado de negócio | 226 | T7 |
| CA-07 | Socorro por administrador adicional | 227 | T7 |
| CA-08 | Admin cria pessoa com senha provisória | 222 | T8 |
| CA-09 | Concessão alcança uma chave | 202, 204, 211 | T2, T4 |
| CA-10 | Retirada vence o default do perfil | 202, 203, 211 | T2, T4 |
| CA-11 | Ação sem tela recusada ao salvar | 205 | T2 |
| CA-12 | Troca de perfil sem intenção é recusada | 231 | T8 |
| CA-13 | Com intenção, ajustes zerados | 231 | T8 |
| CA-14 | Desativação encerra na hora | 228 | T8 |
| CA-15 | Reativação devolve permissões | 229 | T8 |
| CA-16 | Admin não alcança outra empresa | 207, 209, 230, 235 | T1, T3, T8, T6 |
| CA-17 | Sessão restrita antes da troca | 232 | T9 |
| CA-18 | Trocada a senha, alcança tudo | 233, 234 | T9 |
| CA-19 | Sessão publica telas e ações | 220 | T4 |
| CA-20 | Revogação vale na operação seguinte | 210, 217, 219 | T3, T4 |
| CA-21 | Concessão vale na operação seguinte | 210, 218, 219 | T3, T4 |
| CA-22 | Recusa nomeia a permissão | 211, 214, 215 | T4 |
| CA-23 | Cobertura das 17 chaves nos dois sentidos | 201, 202, 211, 212, 213 | T2, T4, T5 |

**Sem CA de produto** (fechamento de débito): CT-208 (P-T6-1, T1) · CT-216 (ponto único, T4) · CT-236 (P-T6-2, T6).

## Cinco provas de falsificação obrigatórias

| CT | Task | Mutante que deve REPROVAR |
|---|---|---|
| CT-203 | T2 | inverter para `(perfil − negadas) ∪ concedidas` |
| CT-209 | T3 | reintroduzir filtro por empresa na consulta |
| CT-213 | T5 | registrar rota sem declaração de exigência |
| CT-216 | T4 | plantar segunda consulta de decisão num controlador |
| CT-235 | T6 | abrir a escrita do campo adicional |

## Cenários deliberadamente não cobertos

Custo da leitura de versão sob carga · retenção de `tentativa_login` (F7, item 5) · corrida entre revogação e requisição em voo · evolução do catálogo além das 17 chaves.
