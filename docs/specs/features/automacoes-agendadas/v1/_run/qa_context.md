# QA Context — automacoes-agendadas/v1

> Extrato denso do `tech_spec.md` para consumo do `agent-spec-qa-test-generator`.
> **Nesta fatia o generator NÃO foi reinvocado**: `_run/test-cases.json` já existia com os **41 casos
> lossless** (CT-1057 a CT-1097), cada um com `arquivo_alvo`, `invariant`, `passos`,
> `resultado_esperado` e `criterios_aceitacao_validados`. A FASE 4 da skill manda, nesse caso, fazer
> **redistribuição** (componente ↔ task) e só disparar QA para task sem match. **Nenhuma task ficou
> sem match** — a distribuição cobre os 41 casos, um arquivo-alvo por CT.

## 1. Stack descoberta (`stack_discovery` do JSON)

- **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js ·
  PostgreSQL 18 · Zod 4 · BullMQ + Redis 7 · systemd 255 · Bash (frente de infraestrutura)
- **Framework de teste**: Vitest 4.1.10 com `embedded-postgres` (instância efêmera própria), Redis
  efêmero próprio e servidor HTTP real em porta dinâmica.
- **Comando**: `pnpm --filter @sysloc/<pacote> test` — **por pacote**. `turbo run test` aborta os
  irmãos e a saída agregada não é confiável.
- **Convenção de rastreabilidade**: `CA-xx → CT-xxxx (RD-xx)` com seção de INVARIANTES por arquivo,
  no molde de `apps/worker/test/regua.spec.ts`.
- **Prova de falsificação**: obrigatória para toda asserção **estática**, e só vale rodada pelo
  script `test` do pacote. Asserção **comportamental não se falsifica por execução** (mutation
  testing está fora da stack desde 2026-08-16) — declara-se qual asserção discrimina.

## 2. Mapa CA → CT (fonte: §19 do tech_spec, conferido contra o JSON)

| CA | Descrição resumida | CTs |
|---|---|---|
| CA-01 | Aviso entregue dentro da Janela da própria empresa | CT-1057, CT-1080 |
| CA-02 | Falha de uma empresa não impede as demais, e fica registrada | CT-1076, CT-1077, CT-1078, CT-1084, CT-1089 |
| CA-03 | Rotina parada além do limiar avisa, nomeando qual | CT-1059, CT-1074, CT-1086, CT-1090 |
| CA-04 | Instalação repetível, sem entrada duplicada | CT-1060 |
| CA-05 | Contrato vencido com imóvel: encerra e libera no mesmo ato | CT-1061, CT-1063, CT-1064, CT-1069 |
| CA-06 | Contrato vencido sem imóvel permanece valendo, com o motivo | CT-1066 |
| CA-07 | Contrato cuja data de fim não chegou permanece valendo | CT-1063, CT-1065 |
| CA-08 | Contrato já encerrado não é tocado | CT-1063, CT-1065 |
| CA-09 | Segunda passagem no mesmo dia produz o mesmo resultado | CT-1061, CT-1067 |
| CA-10 | Indisponibilidade **atrasa**, não perde a execução | CT-1057, CT-1058 |
| CA-11 | Passagem sem trabalho não grava registro | CT-1067, CT-1083 |
| CA-12 | Passagem com efeito grava **um** registro, em vocabulário do produto | CT-1070, CT-1071, CT-1082 |
| CA-13 | Registro com mais de 90 dias deixa de existir | CT-1061, CT-1062, CT-1072, CT-1075, CT-1088, CT-1089 |
| CA-14 | Admin consulta o estado das rotinas da própria empresa | CT-1074, CT-1090, CT-1091, CT-1093, CT-1094, CT-1095 |
| CA-15 | Admin de outra empresa não alcança registro da primeira | CT-1073, CT-1082, CT-1092, CT-1094 |
| CA-16 | Entrega desabilitada: a conferência diária continua descobrindo | CT-1085 |
| CA-17 | Empresa suspensa não executa rotina alguma | CT-1075 |
| CA-18 | Reativação põe em dia **uma vez**, sem Aviso retroativo | CT-1081 |
| CA-19 | Admin sabe que os Avisos pararam por limite do provedor | CT-1093 |
| CA-20 | Notícia retida é reprocessada e o efeito é registrado | CT-1079 |
| CA-21 | Boleto guardado fora do prazo deixa de ocupar espaço | CT-1062, CT-1087, CT-1088 |
| CA-22 | Execução em curso impede a segunda da mesma rotina/empresa | CT-1068, CT-1078 |
| CA-23 | As rotinas voltam sozinhas após reinício | CT-1060 |
| CA-24 | Cobrança fica vencida **sem que rotina alguma passe por ela** | CT-1096 |
| — (RD-20) | Imóvel `INDISPONIVEL` tem a situação preservada no encerramento | CT-1097 |

**24 CAs, 41 CTs, nenhum CA órfão e nenhum CT sem CA** (o CT-1097 sustenta a RD-20, regra técnica
sem CA de origem, e está declarado como tal).

## 3. Componentes e a task que os entrega

| Componente | Camada | Task |
|---|---|---|
| `packages/contracts/src/rotina-agendada.ts` | Contrato | T1 |
| `packages/shared/src/fila.ts` (duas filas + duas cargas) | Contrato de fila | T2 |
| `negocio.execucao_de_rotina` + migrações 0026/0027 | Dados | T3 |
| `packages/db/src/execucao-de-rotina.ts` | Dados / derivação | T4 |
| `packages/db/src/encerramento-de-contratos.ts` | Dados / domínio | T5 |
| `apps/worker/src/tarefas/rotina-agendada.ts` | Aplicação (worker) | T6 |
| `apps/worker/src/tarefas/manutencao-do-acervo.ts` + guarda de boletos | Aplicação (worker) | T7 |
| `apps/worker/src/despachante.ts` + leituras sem contexto | Composição raiz | T8 |
| `deploy/systemd/*` (13) + `instalar-unidades.sh` | Infraestrutura | T9 |
| `apps/api/src/automacao/*` + âncora de superfície | Borda HTTP | T10 |
| Rede antirregressão da RN-14 + escrituração de débito | Verificação / registro | T11 |

## 4. Fluxos que a suíte tem de cobrir

- **(a) O trabalho acontece sozinho** — timer → `.service oneshot` → despachante valida ambiente,
  enumera empresas ativas e enfileira; falha ⇒ código ≠ 0 ⇒ `OnFailure=`.
- **(b) O trabalho de uma empresa é feito** — o consumidor abre o contexto **uma vez** a partir da
  carga (ADR-0024), despacha para a rotina e grava registro **só quando houve efeito** (RN-15).
- **(c) O Admin consulta** — `GET /v1/automacao-de-cobranca/rotinas` sob sessão, com o isolamento
  decidido pela RLS.

## 5. Fronteiras de execução real (nunca simuladas)

`embedded-postgres` efêmero por suíte · Redis efêmero · servidor HTTP real em porta dinâmica ·
sistema de arquivos (`deploy/systemd/`, diretório dos boletos) · subprocesso real
(`packages/shared/test/cenario-subprocesso.ts`) para o ponto de entrada do despachante.

## 6. Acessórios da casa — **importar, nunca copiar**

`packages/db/test/banco-efemero.ts` · `packages/db/test/varredura-de-fontes.ts` ·
`packages/db/test/conjuntos.ts` · `apps/api/test/acessorios-de-borda.ts` ·
`apps/api/test/aplicacao-instrumentada.ts` · `apps/worker/test/varredura-de-segredo.ts` ·
`packages/shared/test/{postgres-efemero,redis-efemero,cenario-subprocesso}.ts`.

> A convenção do `CLAUDE.md` é explícita: *acessório de suíte se importa, não se copia*. Redeclarar
> `pedir`/`entrar`/`bancoEfemero` numa suíte nova é o que fez o `D40 · F5/T9` nascer.
