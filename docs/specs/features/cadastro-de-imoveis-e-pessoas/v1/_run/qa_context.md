# QA Context — cadastro-de-imoveis-e-pessoas/v1

> Extrato denso do `tech_spec.md` para alimentar o `agent-spec-qa-test-generator` nas tasks sem CT
> correspondente. A Estratégia de Testes completa está em `tech_spec.md` §19; os casos lossless em
> `_run/test-cases.json`.

## Stack de teste

Vitest + `embedded-postgres` (instância efêmera própria por execução, ADR-0006) · HTTP real em **porta
reservada** (`reservarPorta()` de `packages/shared/test/efemero-comum.ts`), nunca dinâmica · arquivos
`*.spec.ts` / `*.e2e.spec.ts` em `test/` por pacote · mock evitado por decisão · rastreabilidade
`CA-xx → CT-xxx (RN-xx)` com seção INVARIANTES por arquivo · **faixa CT-300+** (o projeto usa até
CT-239) · mutante sempre pelo script `test` do pacote, nunca `vitest run` avulso.

## Componentes

| Componente | Camada | Task |
|---|---|---|
| `@sysloc/contracts` — esquemas e enums | contrato | T1 |
| schema `negocio` + migrações 0005/0006 | dados | T2 |
| `@sysloc/shared/documento` — CPF/CNPJ | compartilhado | T3 |
| `apps/api/src/comum/validacao.ts` | borda | T4 |
| `db/conjunto.ts` + `ConjuntoService` + `ConjuntoController` | dados/domínio/apresentação | T5 |
| `db/imovel.ts` + `ImovelService` + `ImovelController` | idem | T6 |
| `db/comodo.ts` + `ComodoService` + `ComodoController` | idem | T7 |
| `db/cadastro-de-pessoa.ts` + `CadastroDePessoaService` | dados/domínio | T8 |
| três controladores de pessoa | apresentação | T9 |
| carteira expandida | dados | T10 |
| cobertura de autorização + suítes existentes | teste | T11 |

## Critérios de aceite (PRD)

CA-01 conjunto · CA-02 imóvel vinculado · CA-03 identificador municipal único por empresa ·
CA-04 metragem somada · CA-05 cômodo sem metragem conta zero · CA-06 alterar cômodo isolado ·
CA-07 três pessoas · CA-08 documento inválido recusado · CA-09 documento único por empresa ·
CA-10 retirada some das escolhas · CA-11 filtro de retirados e volta · CA-12 área de tela exigida ·
CA-13 ação sensível exigida · CA-14 isolamento entre empresas · CA-15 carteira numa consulta ·
CA-16 tipos sem conversão no consumidor.

## Mapa CA → CT (distribuição por task)

| CA | CTs | Tasks |
|---|---|---|
| CA-01 | CT-331 | T10 |
| CA-02 | CT-325, CT-326, CT-331, CT-332 | T7, T11, T10, T9 |
| CA-03 | CT-310, CT-312 | T6, T9 |
| CA-04 | CT-305, CT-307, CT-309 | T7 |
| CA-05 | CT-305, CT-306 | T7 |
| CA-06 | CT-308, CT-317 | T7 |
| CA-07 | CT-331, CT-332 | T10, T9 |
| CA-08 | CT-313, CT-314 | T9, T3 |
| CA-09 | CT-311, CT-312 | T9 |
| CA-10 | CT-315, CT-316 | T9 |
| CA-11 | CT-315, CT-316 | T9 |
| CA-12 | CT-318, CT-319, CT-321 | T11 |
| CA-13 | CT-320 | T11 |
| CA-14 | CT-300..304, CT-321, CT-323, CT-333 | T2, T11, T6 |
| CA-15 | CT-307, CT-329, CT-330 | T7, T10 |
| CA-16 | CT-305, CT-322, CT-324, CT-327, CT-328 | T7, T11 |

## Tasks sem CT correspondente (geração necessária)

**T1** (pacote de contratos), **T4** (extração da tradução de validação — débito D38), **T5**
(conjunto), **T8** (acesso a dado e serviço parametrizado de pessoa).

## Invariantes que os testes desta fatia perseguem

1. Isolamento é recusado **pelo banco**, não por filtro de aplicação.
2. Metragem derivada: um ponto único de soma; normalização do cômodo na escrita.
3. Retirado não aparece sem o parâmetro **e** aparece com ele — o par é o que detecta.
4. Unicidade alcança retirados, e a recusa discrimina `EM_CIRCULACAO` × `RETIRADO_DE_CIRCULACAO`.
5. Toda rota governada declara exigência; a ação sensível é nomeada na recusa, nunca a área.
6. Corpo fechado; `empresaId` no corpo é fuga de tenant.
7. Ordem dos cômodos é da posição, não do retorno do banco.
8. Nenhum campo exige conversão de tipo pelo consumidor.
